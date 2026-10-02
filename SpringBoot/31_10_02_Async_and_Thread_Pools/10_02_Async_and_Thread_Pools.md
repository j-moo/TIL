# Spring Boot 비동기 처리와 `@Async`·스레드 풀 — 작업을 넘긴 뒤의 대기·실패·종료까지 이해하기

> **목표**: `@Async`가 만드는 실행 경계를 이해하고, 이름 있는 실행기와 제한된 대기열로 작업을 처리하며 실패·트랜잭션·종료를 구분한다.
>
> **핵심 키워드**: 비동기, 스레드, 프록시, `TaskExecutor`, `ThreadPoolTaskExecutor`, `CompletableFuture`, 대기열, 작업 거절, 트랜잭션 경계
>
> **중요도**: 높음. 응답을 먼저 돌려주는 것만으로 백그라운드 작업의 성공이나 보존이 보장되지는 않는다.
>
> **한눈에 보는 내용**: 호출자는 작업을 제출하고, 실행기는 실행 또는 대기를 결정하며, 작업의 완료·실패는 별도로 관찰한다.
>
> **관련 주제 / 선수 지식**: Bean·DI, Java 예외와 제네릭, [트랜잭션](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md), [Bulkhead](../28_09_29_Bulkhead_and_Rate_Limiting/09_29_Bulkhead_and_Rate_Limiting.md), [Redis 캐시](../30_10_01_Redis_and_Distributed_Cache/10_01_Redis_and_Distributed_Cache.md)

**자료 확인일: 2026-10-02.** Spring Boot 4.1.1, Spring Framework 7.0.9 공식 문서와 Java 21 API를 확인했다. 이 숫자는 문서를 확인한 기준이며, 서로 다른 버전의 라이브러리를 직접 섞어 설치하라는 뜻이 아니다. 실제 프로젝트는 선택한 Boot 버전의 의존성 관리를 따른다. 아래 `@Bean(defaultCandidate = false)`는 Framework 6.2 이상 API를 사용하므로 이전 버전에서는 그대로 복사하지 않는다.

**예제 범위**: 이미 생성된 Boot 프로젝트에 추가하는 Java 파일과 독립 Spring 컨텍스트 테스트다. 전체 웹 애플리케이션·DB·보고서 다운로드 기능을 구현한 예제는 아니다. 이 저장소에서는 문서 검사를 수행하며, 아래 Java 테스트는 실행 환경에서 직접 확인할 실습으로 구분한다.

## 1. 들어가며

사용자가 보고서 생성을 요청했다고 생각해 보자. 서버가 보고서를 다 만들 때까지 요청 스레드가 기다리면 응답이 늦어진다. 별도 스레드에 작업을 넘기면 호출자는 다른 일을 할 수 있다. 하지만 작업을 넘기는 순간 다음 질문이 생긴다.

- 실행 가능한 스레드가 모두 바쁘면 작업은 어디에 머무는가?
- 넘긴 작업이 실패하면 호출자는 어떻게 알 수 있는가?
- 요청에서 진행 중인 DB 트랜잭션을 작업 스레드도 공유하는가?
- 서버가 종료되면 아직 대기 중인 작업은 남아 있는가?

이번 노트는 이 질문을 작은 보고서 예제로 연결한다. 앞선 캐시가 **같은 결과를 다시 계산하지 않는 방법**이었다면, 이번에는 **계산을 어느 실행 흐름에 맡길지**를 배운다. 비동기화 자체가 처리량·정확성·내구성을 한꺼번에 해결하지는 않는다.

## 2. 핵심 개념 정리

| 개념 | 먼저 잡을 의미 | 본문 연결 |
| --- | --- | --- |
| 비동기 | 호출 흐름과 작업 완료를 분리한다 | 3.1 |
| 프록시 | Bean 호출을 가로채 실행기로 넘긴다 | 3.2 |
| 스레드 풀·대기열 | 동시에 실행할 수와 기다릴 수를 제한한다 | 3.3 |
| `CompletableFuture` | 나중에 얻을 결과 또는 실패를 표현한다 | 3.4~3.5 |
| 제출 거절 | 작업을 실행기에 맡기는 단계부터 실패한다 | 3.3~3.5 |
| 트랜잭션·문맥 | 호출 스레드의 상태가 자동으로 옮겨지지 않는다 | 3.7 |
| 종료·관측 | 기다리는 작업과 실행 중인 작업을 함께 관리한다 | 3.8 |

기본 경로는 **호출자 → Spring 프록시 → 실행기 → 실행/대기/거절 → 결과 또는 실패**다. 거절은 작업 본문에 들어가기 전에 발생할 수 있으므로 마지막의 작업 실패와 구분해야 한다.

## 3. 본문 정리

### 3.1 비동기는 실행 흐름을 나누는 것이지 작업을 사라지게 하는 것이 아니다

**스레드**는 프로그램 안에서 코드를 실행하는 흐름이다. 동기 호출에서는 현재 흐름이 메서드의 반환을 기다린다. 비동기 호출은 완료를 기다리는 위치를 분리한다. 여러 작업이 같은 시간대에 진행되는 **동시성**과 여러 CPU에서 실제로 동시에 계산하는 **병렬성**은 관련되지만 같은 말은 아니다.

실행기(executor)는 작업을 어떻게 실행할지 결정하는 객체다. 실행기라는 이름만으로 별도 스레드를 보장하지는 않는다. Spring의 `SyncTaskExecutor`처럼 호출 스레드에서 실행하는 구현도 있다. 이번에는 스레드 풀을 사용하는 `ThreadPoolTaskExecutor`를 선택한다. [Spring 실행기 설명](https://docs.spring.io/spring-framework/reference/integration/scheduling.html)

예를 들어 외부 서버의 응답을 기다리는 작업은 대기 시간 동안 CPU를 거의 사용하지 않을 수 있다. 반면 복잡한 계산을 하는 작업은 스레드를 늘려도 CPU 자원이 늘어나지는 않는다. 따라서 “모든 메서드에 `@Async`를 붙이면 빨라진다”가 아니라 **대기 특성과 자원 한계를 보고 분리할 작업을 고른다**가 출발점이다.

### 3.2 프록시와 이름 있는 실행기를 먼저 연결한다

`@EnableAsync`는 비동기 메서드를 처리하는 Spring 기능을 활성화한다. 기본 프록시 모드에서 다른 Bean이 `@Async` 메서드를 호출하면 프록시가 실행기로 작업을 넘긴다. 같은 객체 안의 `this.generate(...)` 호출이나 `new ReportWorker()`로 직접 만든 객체에는 이 경로가 없다. [EnableAsync API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/annotation/EnableAsync.html)

**준비**: [Initializr 노트](../01_08_25_Spring_Initializr_and_First_Run/08_25_Spring_Initializr_and_First_Run.md)대로 프로젝트를 만든다. 아래는 `build.gradle`의 **의존성 부분 코드**이며 전체 빌드 파일이 아니다. 이미 Web Starter가 있다면 기본 Starter를 중복해서 추가할 필요는 없다.

```groovy
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter' // Spring 컨텍스트와 기본 실행 환경을 사용한다.
    testImplementation 'org.springframework.boot:spring-boot-starter-test' // JUnit과 테스트 단언 도구를 준비한다.
}
```

다음 파일들은 `src/main/java/com/example/async/` 아래에 추가한다. 실제 패키지가 다르면 경로와 `package`를 함께 바꾸고, Boot 시작 클래스의 컴포넌트 스캔 범위 안에 둔다.

**추가 파일 전체: `AsyncReportConfiguration.java`**

```java
package com.example.async; // 보고서 관련 Bean을 같은 패키지에 모은다.

import java.util.concurrent.ThreadPoolExecutor; // 포화 시 사용할 거절 정책을 가져온다.
import org.springframework.context.annotation.Bean; // 메서드의 반환 객체를 Bean으로 등록한다.
import org.springframework.context.annotation.Configuration; // 설정 클래스임을 표시한다.
import org.springframework.scheduling.annotation.EnableAsync; // @Async 처리를 활성화한다.
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor; // Spring 생명주기와 연결되는 풀을 사용한다.

@Configuration(proxyBeanMethods = false) // 설정 메서드끼리 직접 호출하지 않으므로 설정 프록시가 필요 없다.
@EnableAsync // 다른 Bean에서 호출하는 @Async 메서드를 실행기에 위임하도록 한다.
public class AsyncReportConfiguration {
    @Bean(name = "reportExecutor", defaultCandidate = false) // 이름으로만 선택할 전용 실행기를 등록한다.
    public ThreadPoolTaskExecutor reportExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor(); // 아직 초기화 전인 설정 객체를 만든다.
        executor.setCorePoolSize(2); // 작업이 들어올 때 기본적으로 확보할 워커 수를 설정한다.
        executor.setMaxPoolSize(4); // 대기열까지 찼을 때 확장할 워커 수의 상한을 정한다.
        executor.setQueueCapacity(10); // 실행을 기다리는 작업을 최대 10개까지 보관한다.
        executor.setThreadNamePrefix("report-"); // 로그와 테스트에서 보고서 워커를 식별한다.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy()); // 포화를 조용히 숨기지 않고 거절한다.
        executor.setWaitForTasksToCompleteOnShutdown(true); // 정상 종료 시 제출된 작업의 완료를 시도한다.
        executor.setAwaitTerminationSeconds(10); // 컨테이너 종료가 실행기 종료를 기다릴 시간을 제한한다.
        return executor; // Bean 등록 후 Spring이 초기화하므로 여기서 initialize()를 직접 호출하지 않는다.
    }
}
```

이 설정의 숫자는 원리를 보여 주는 **학습용 값**이다. 실제 값은 작업 시간, 허용 대기 시간, 메모리, DB 연결 수를 측정해 정한다. `@Async("reportExecutor")`로 명시적으로 선택하기 때문에 어떤 실행기에 맡기는지 코드에서 드러난다.

Boot의 자동 실행기도 이해해야 한다. 일반적인 사용자 정의 `Executor` Bean은 자동 실행기 구성을 물러나게 할 수 있다. 여기서는 `defaultCandidate = false`로 전용 Bean을 기본 후보에서 제외하여 Boot 자동 실행기를 유지하는 구성을 선택했다. MVC 등의 다른 기능이 사용하는 `applicationTaskExecutor`와 보고서 실행기를 구분하려는 의도다. 또한 직접 `new`로 설정한 이 풀에 `spring.task.execution.*` 설정이 자동으로 적용되는 것은 아니다. [Boot 작업 실행 설정](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html)

⚠️ 주의: `@Async`만 붙이고 실행기 구성을 생략하면 항상 이 노트의 풀을 쓰는 것이 아니다. 실행기 선택과 기본값은 Framework·Boot 구성에 달려 있다. 이름 지정과 스레드 이름 검증을 함께 사용한다.

### 3.3 core → queue → max 순서를 알아야 포화를 예상할 수 있다

풀의 `corePoolSize`는 기본 워커 수이고, `maxPoolSize`는 확장 상한이다. **워커가 core까지 만들어진 다음에는 먼저 대기열에 넣으려 하고, 대기열이 꽉 차야 max까지 워커를 늘린다.** max가 4라고 처음부터 항상 4개를 실행하는 것은 아니다. [JDK ThreadPoolExecutor API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)

위 설정에서 작업들이 끝나지 않고, 하나의 호출자가 차례대로 제출한다고 가정하면 다음 상태를 예상할 수 있다.

| 제출 순서 | 기대 상태 |
| --- | --- |
| 1~2번째 | 기본 워커 두 개에서 실행 |
| 3~12번째 | 대기열 열 칸에 보관 |
| 13~14번째 | 대기열이 차서 추가 워커 두 개에서 실행 |
| 15번째 | 실행 4개·대기 10개가 모두 차서 거절 |

이 표는 완료가 없는 조건의 설명이다. 실제로 작업이 끝나면 빈자리가 생긴다. 또 표에서 보듯 나중에 제출한 작업이 새 워커에서 먼저 시작할 수 있으므로 **제출 순서가 전체 실행 순서를 보장한다고 해석하지 않는다**. 무제한 대기열을 쓰면 max 확장이 의미 없어질 수 있고, 대기 시간과 메모리 사용이 커질 수 있다.

거절 정책도 실행 경계를 바꾼다. `AbortPolicy`는 예외로 거절을 알린다. `CallerRunsPolicy`는 호출자에게 실행을 맡기므로 요청 스레드가 긴 작업을 수행할 수 있다. 조용히 버리는 정책은 실패를 숨기고, 결과를 기다리는 Future가 완료되지 않을 위험도 있다. 이번에는 거절을 드러내는 정책을 선택한다.

Spring 실행기로 제출하다 거절되면 `TaskRejectedException`을 관찰할 수 있다. 이는 작업 내부의 오류가 아니라 **제출 단계 오류**다. [ThreadPoolTaskExecutor API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/concurrent/ThreadPoolTaskExecutor.html), [TaskRejectedException API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/task/TaskRejectedException.html)

### 3.4 입력은 값으로 전달하고 결과는 Future로 돌려준다

다음 두 record는 변경할 수 없는 입력·결과를 표현한다. 여기서는 필드도 숫자와 불변 `String`뿐이다. record 안에 수정 가능한 `List`를 넣으면 내부까지 자동으로 불변이 되는 것은 아니므로 별도의 복사 정책이 필요하다.

**추가 파일 전체: `ReportRequest.java`**

```java
package com.example.async; // 작업 Bean과 같은 패키지를 사용한다.

public record ReportRequest(long reportId, String title) { // 요청 ID와 제목만 값으로 전달한다.
}
```

**추가 파일 전체: `ReportResult.java`**

```java
package com.example.async; // 결과를 사용하는 서비스와 같은 패키지를 사용한다.

public record ReportResult(long reportId, String content, String workerThread) { // 마지막 필드는 학습용 실행 위치다.
}
```

**추가 파일 전체: `ReportWorker.java`**

```java
package com.example.async; // 컴포넌트 스캔 범위 안에 배치한다.

import java.util.Objects; // null 입력을 명확히 검사한다.
import java.util.concurrent.CompletableFuture; // 비동기 결과를 표현한다.
import org.springframework.scheduling.annotation.Async; // 실행할 작업의 실행기를 지정한다.
import org.springframework.stereotype.Service; // Spring이 관리하는 작업 Bean으로 등록한다.

@Service // 직접 new 하지 않고 다른 Bean에 주입해서 사용한다.
public class ReportWorker {
    @Async("reportExecutor") // 프록시가 이 메서드 호출을 보고서 전용 실행기에 제출한다.
    public CompletableFuture<ReportResult> generate(ReportRequest request) {
        Objects.requireNonNull(request, "request는 필수입니다."); // 워커에서 입력 누락을 검사한다.
        if (request.reportId() < 1 || request.title() == null || request.title().isBlank()) { // 최소 입력 조건이다.
            throw new IllegalArgumentException("양수 ID와 제목이 필요합니다."); // 실행 중 실패로 Future에 전달된다.
        }
        String content = "보고서: " + request.title().strip(); // 외부 자원 없이 결과를 만드는 작은 학습 예제다.
        String threadName = Thread.currentThread().getName(); // 실제 메서드 본문을 실행한 스레드를 기록한다.
        ReportResult result = new ReportResult(request.reportId(), content, threadName); // 결과 값을 묶는다.
        return CompletableFuture.completedFuture(result); // 본문이 계산한 값을 프록시에 반환한다.
    }
}
```

`@Async` 메서드는 `void` 또는 Future 계열 반환형을 사용한다. 여기서는 호출자가 결과를 추적할 수 있는 `CompletableFuture`를 선택했다. 메서드 본문이 반환하는 `completedFuture`는 계산한 값을 전달하는 용도다. 외부 호출자는 프록시가 돌려준 비동기 Future를 받으므로 **본문의 `completedFuture` 때문에 호출이 동기로 바뀌는 것은 아니다**. [Async API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/annotation/Async.html)

이 본문 안에서 다시 실행기를 지정하지 않은 `supplyAsync(...)`를 호출할 필요는 없다. 이미 워커에서 실행 중인데 또 다른 기본 풀로 일을 넘기면 이중 실행 경로가 생기고 용량·오류 추적이 복잡해진다.

**추가 파일 전체: `ReportRequestService.java`**

```java
package com.example.async; // 워커를 호출하는 별도의 Bean을 둔다.

import java.util.concurrent.CompletableFuture; // 결과와 거절을 같은 반환형으로 표현한다.
import org.springframework.core.task.TaskRejectedException; // 실행기에 맡기지 못한 경우를 구분한다.
import org.springframework.stereotype.Service; // 호출 계층을 Spring Bean으로 등록한다.

@Service // 워커와 분리하여 프록시를 통과하는 외부 호출을 만든다.
public class ReportRequestService {
    private final ReportWorker worker; // 주입받은 프록시를 보관한다.

    public ReportRequestService(ReportWorker worker) { // 생성자 주입으로 실행 경로를 연결한다.
        this.worker = worker; // 실제 사용은 Spring이 주입한 Bean을 통해 한다.
    }

    public CompletableFuture<ReportResult> request(long reportId, String title) {
        try { // 제출 자체가 거절되는 경우를 관찰할 위치다.
            return worker.generate(new ReportRequest(reportId, title)); // 별도 Bean의 @Async 메서드를 호출한다.
        } catch (TaskRejectedException ex) { // 작업 본문이 아니라 실행기의 포화를 처리한다.
            return CompletableFuture.failedFuture(ex); // 정상 결과로 숨기지 않고 실패한 Future로 바꾼다.
        }
    }
}
```

거절을 실패한 Future로 바꾸는 것은 **이 예제의 API 설계**이지 `@Async`의 자동 보장이 아니다. 워커를 직접 호출하면 Future를 받기도 전에 제출 예외가 발생할 수 있다. 이 서비스의 `try`가 워커 안에서 나중에 발생한 예외까지 잡아 주는 것도 아니다.

### 3.5 제출 실패와 실행 실패는 관찰하는 시점이 다르다

위 서비스는 두 실패를 Future라는 반환형으로 묶었지만 원인은 다르다. 잘못된 ID는 실행된 본문에서 `IllegalArgumentException`을 발생시키고, 포화는 본문 실행 전에 제출을 거절한다. 모니터링에서도 둘을 구분해야 입력 오류를 용량 문제로 오해하지 않는다.

Future의 결과를 `get()`으로 기다리면 실행 실패는 `ExecutionException`의 원인으로 확인한다. `join()`은 실패를 보통 `CompletionException`으로 감싸는 비검사 예외 경로다. `whenComplete` 등으로 관찰할 수도 있지만 관찰 로직이 실패를 성공 값으로 바꿔 버리지 않도록 의도를 분명히 한다. `thenApply` 같은 일반 후속 단계는 특정 전용 스레드 실행을 보장하지 않으며, 실행기를 생략한 비동기 후속 단계는 기본 풀을 사용할 수 있다. [CompletableFuture API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html)

`void` 반환형은 호출자가 결과 Future를 받을 수 없다. 이때 처리되지 않은 오류는 기본적으로 기록되며, `AsyncConfigurer`를 통해 `AsyncUncaughtExceptionHandler`를 구성할 수 있다. 오류 알림·메트릭·복구 정책을 별도로 갖추어야 한다. [Spring 비동기 예외 처리](https://docs.spring.io/spring-framework/reference/integration/scheduling.html)

⚠️ 주의: “비동기라서 예외가 없다”가 아니라 **예외를 받는 통로가 달라진다**. Future를 반환한 뒤 아무도 관찰하지 않으면 호출자가 작업 실패를 놓칠 수 있다.

### 3.6 기다리는 시간과 작업을 멈추는 기능을 구분한다

호출자가 `get(2, TimeUnit.SECONDS)`를 사용하면 결과를 기다리는 시간을 제한한다. 2초가 지나 발생한 `TimeoutException`은 작업이 반드시 중단됐다는 뜻이 아니다. 실행기에서 이미 실행 중인 작업이나 대기 작업의 상태는 별도로 관리한다. [Future API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/Future.html)

`CompletableFuture.orTimeout(...)` 역시 Future를 시간 초과 실패 상태로 만들 뿐 실제 외부 호출을 강제로 종료하지 않는다. `CompletableFuture.cancel(true)`의 인자는 작업 스레드에 대한 중단 보장이 아니다. 따라서 외부 HTTP·DB 작업에는 해당 클라이언트의 타임아웃과 자원 해제 정책도 필요하다. [CompletableFuture 취소·시간 초과 API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html)

또한 같은 작은 풀의 워커가 그 풀에 새 작업을 제출하고 `join()`으로 기다리면 위험하다. 예를 들어 워커 하나뿐인데 부모 작업이 자식 완료를 기다리면, 자식은 부모가 차지한 워커를 얻지 못한다. 이 상황에서는 기다림을 없애거나 실행 경로를 재설계해야 한다. 단순히 타임아웃만 추가하면 원인이 해결되지는 않는다.

⚠️ 주의: Future를 받자마자 같은 요청에서 `join()`으로 기다리면 그 호출자는 다시 대기한다. 비동기화의 이점은 반환형 자체가 아니라 **대기와 후속 처리를 어디에 배치했는가**에 달려 있다.

### 3.7 트랜잭션·사용자 문맥·내구성은 자동으로 따라오지 않는다

일반적인 `PlatformTransactionManager`의 트랜잭션은 스레드에 연결된다. 호출 스레드의 `@Transactional` 범위가 새 작업 스레드로 자동 전달되지 않는다. 워커가 별도의 트랜잭션 서비스 Bean을 호출하면 그 스레드에서 새 경계를 만들 수 있지만, 호출자와 하나의 원자적 작업이 되는 것은 아니다. [Transactional API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html)

이 차이가 중요한 사례는 다음과 같다. 요청 스레드가 DB에 보고서 요청을 저장하고 **commit 전** 비동기 작업을 제출하면 워커는 아직 보이지 않는 데이터를 읽을 수 있다. 반대로 워커가 이미 외부 전송을 마쳤는데 요청 트랜잭션이 rollback될 수도 있다. 그래서 “저장 확정 후 시작”이라는 요구를 먼저 정하고 실행 시점을 연결해야 한다.

commit 이후 제출하는 구조라도 제출 거절이나 프로세스 종료로 작업이 사라질 수 있다. **commit 후 실행**과 **재시작 후 재처리 가능**은 다른 요구다. 처리할 일을 반드시 남겨야 한다면 앞서 배운 [Transactional Outbox](../25_09_23_Transactional_Outbox_and_Event_Publishing/09_23_Transactional_Outbox_and_Event_Publishing.md)처럼 DB에 기록하고 재처리하는 흐름을 검토한다. 이번 메모리 대기열을 메시지 브로커로 오해하지 않는다.

입력 역시 JPA 엔티티나 요청 객체를 통째로 넘기기보다 ID·필요한 값으로 좁힌다. 작업 스레드에서 필요한 최신 데이터를 자신의 트랜잭션으로 다시 조회하는 설계가 경계를 설명하기 쉽다. 이는 모든 상황의 정답이라기보다 변경 가능한 상태와 지연 로딩을 분리하려는 설계 선택이다.

로그의 요청 ID, 사용자 인증 정보처럼 스레드에 보관한 문맥도 주의해야 한다. `TaskDecorator`로 실행 전후의 문맥 처리를 구성할 수 있지만, 복사한 값은 종료 시 반드시 정리하거나 이전 값을 복원해야 풀의 다음 작업에 섞이지 않는다. 데코레이터가 Future 래퍼를 감쌀 수 있으므로 모든 작업 예외가 그곳에서 직접 던져진다고 가정하지 않는다. [TaskDecorator API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/task/TaskDecorator.html)

Spring Security의 사용자 문맥 전달은 `DelegatingSecurityContext...` 실행기 등 별도 구성을 검토한다. 문맥 전달을 설정한다고 DB 트랜잭션까지 복사되는 것은 아니다. [Spring Security 동시성 지원](https://docs.spring.io/spring-security/reference/features/integrations/concurrency.html)

### 3.8 정상 종료·가상 스레드·운영 지표를 함께 해석한다

설정의 `waitForTasksToCompleteOnShutdown(true)`는 정상 종료 시 실행 중인 작업을 즉시 중단하지 않고 대기열 작업까지 완료하도록 시도한다. `awaitTerminationSeconds(10)`은 컨테이너가 실행기 종료를 기다리는 시간을 제한한다. **10초가 지나면 남은 작업이 모두 끝났다는 보장도, 반드시 강제로 중단됐다는 보장도 없다.** 이후 다른 자원이 닫히면 남은 작업이 그 자원을 사용하다 실패할 수 있다. [ExecutorConfigurationSupport 종료 API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/concurrent/ExecutorConfigurationSupport.html)

운영에서는 새 요청 유입 중단, 남은 작업의 최대 실행 시간, DB·HTTP 자원의 종료 순서, 배포 환경의 종료 유예 시간을 맞춰야 한다. 강제 종료·장애에서는 이 정상 종료 절차조차 실행되지 않을 수 있다. 따라서 위 설정은 내구성 대책이 아니다.

Java 21 이상에서 Boot의 `spring.threads.virtual.enabled=true`를 사용하면 자동 실행기의 구현이 달라질 수 있다. 하지만 이 노트에서 직접 만든 `ThreadPoolTaskExecutor`까지 자동으로 가상 스레드 실행기로 바뀌지는 않는다. [Boot 실행기와 가상 스레드](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html)

가상 스레드는 많은 대기 중심 작업의 처리에 유리할 수 있지만 CPU 계산 자체를 빠르게 하거나 DB 연결을 무한히 만드는 기능은 아니다. 실행기 방식이 달라도 외부 시스템에 허용할 동시 호출 수는 제한해야 한다. [Java 21 가상 스레드 안내](https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html)

이 예제의 운영 관측 항목은 다음처럼 나눈다. 직접 만든 실행기의 모든 지표가 자동 수집된다고 전제하지 않고, 프로젝트의 관측 도구 연결을 확인한다.

| 관측 항목 | 읽어낼 문제 |
| --- | --- |
| 실행 중 수·현재 풀 크기 | 워커 사용량과 확장 상태 |
| 대기열 길이·대기 시간 | 아직 시작하지 못한 작업과 지연 |
| 실행 시간·성공/실패 수 | 본문 처리 속도와 실패 원인 |
| 제출 거절 수 | 실행기가 더는 맡을 수 없는 상태 |
| 종료 때 남은 작업 | 정상 종료 제한과 작업 유실 위험 |

서버를 여러 대 띄우면 이 풀과 대기열도 서버마다 생긴다. 워커 상한 4를 서버 3대에 설정하면 전체에서 최대 12개가 실행될 수 있으므로, [Bulkhead 노트](../28_09_29_Bulkhead_and_Rate_Limiting/09_29_Bulkhead_and_Rate_Limiting.md)의 서버별 제한과 전체 자원 예산을 다시 연결한다.

### 3.9 스레드 이름·실행 실패·포화 거절을 작은 테스트로 확인한다

아래는 `src/test/java/com/example/async/AsyncReportTest.java`의 **추가 파일 전체**다. 첫 테스트는 실제 Spring 프록시를 통과하는 실행 위치와 실패 전달을 확인한다. 두 번째는 워커 하나·대기열 하나를 고정해서 거절을 재현한다. 완료 속도만 보고 비동기 여부를 추측하지 않고, 포화 재현에도 임의의 `sleep`을 쓰지 않는다.

```java
package com.example.async; // 예제 설정과 워커에 접근할 수 있는 패키지다.

import java.util.concurrent.CountDownLatch; // 작업 시작과 해제를 명시적으로 맞춘다.
import java.util.concurrent.ExecutionException; // Future.get()의 실패 래퍼를 검사한다.
import java.util.concurrent.ThreadPoolExecutor; // 테스트의 거절 정책도 명시한다.
import java.util.concurrent.TimeUnit; // 테스트가 무한히 기다리지 않도록 시간 단위를 지정한다.
import org.junit.jupiter.api.Test; // JUnit 테스트 메서드를 선언한다.
import org.springframework.context.annotation.AnnotationConfigApplicationContext; // 작은 실제 Spring 컨텍스트를 생성한다.
import org.springframework.core.task.TaskRejectedException; // 제출 거절의 Spring 예외를 검사한다.
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor; // 포화 테스트용 실행기를 직접 구성한다.
import static org.junit.jupiter.api.Assertions.assertEquals; // 결과 내용이 같은지 확인한다.
import static org.junit.jupiter.api.Assertions.assertInstanceOf; // 실패 원인의 타입을 확인한다.
import static org.junit.jupiter.api.Assertions.assertNotEquals; // 호출 스레드와 워커 스레드를 비교한다.
import static org.junit.jupiter.api.Assertions.assertThrows; // 예상 예외가 실제로 발생하는지 검사한다.
import static org.junit.jupiter.api.Assertions.assertTrue; // 스레드 이름과 시작 신호를 검사한다.

class AsyncReportTest {
    @Test // 프록시를 통한 실행과 작업 본문의 실패를 함께 검증한다.
    void runsOnNamedExecutorAndPropagatesFailure() throws Exception {
        try (var context = new AnnotationConfigApplicationContext(
                AsyncReportConfiguration.class, ReportWorker.class, ReportRequestService.class)) { // 필요한 Bean만 등록한다.
            var service = context.getBean(ReportRequestService.class); // 직접 new 하지 않아 프록시 경로를 유지한다.
            String callerThread = Thread.currentThread().getName(); // 비교 기준인 테스트 스레드를 기록한다.
            ReportResult result = service.request(1L, " 월간 정리 ").get(2, TimeUnit.SECONDS); // 결과를 제한 시간 안에 받는다.
            assertEquals("보고서: 월간 정리", result.content()); // 본문의 값 생성 결과를 확인한다.
            assertTrue(result.workerThread().startsWith("report-")); // 지정한 실행기에서 처리했는지 확인한다.
            assertNotEquals(callerThread, result.workerThread()); // 호출자와 실행 흐름이 분리됐는지 확인한다.
            ExecutionException failure = assertThrows(ExecutionException.class,
                    () -> service.request(0L, "실패 예제").get(2, TimeUnit.SECONDS)); // 본문 입력 오류를 기다린다.
            assertInstanceOf(IllegalArgumentException.class, failure.getCause()); // 래퍼 내부의 실제 원인을 확인한다.
        } // 테스트 성공·실패와 관계없이 Spring 컨텍스트를 닫는다.
    }

    @Test // 실행과 대기를 모두 채워 제출 거절을 재현한다.
    void rejectsWhenWorkerAndQueueAreFull() throws Exception {
        var executor = new ThreadPoolTaskExecutor(); // 이번에는 Bean이 아닌 독립 테스트 객체다.
        executor.setCorePoolSize(1); // 실행 중인 작업 하나로 워커를 채운다.
        executor.setMaxPoolSize(1); // 추가 워커 확장을 막는다.
        executor.setQueueCapacity(1); // 기다리는 작업 하나로 대기열을 채운다.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy()); // 다음 제출은 예외로 거절한다.
        executor.initialize(); // Spring Bean이 아니므로 테스트가 직접 초기화한다.
        var entered = new CountDownLatch(1); // 첫 작업이 워커에 진입했음을 알리는 신호다.
        var release = new CountDownLatch(1); // 첫 작업을 테스트가 끝날 때 해제하는 신호다.
        try { // 아래 단언이 실패해도 finally에서 워커를 해제한다.
            executor.execute(() -> {
                entered.countDown(); // 첫 작업이 실제 실행 중임을 테스트에 알린다.
                try {
                    release.await(); // 다음 제출 동안 워커를 점유하도록 기다린다.
                } catch (InterruptedException ex) { // 종료 등에 의한 인터럽트를 무시하지 않는다.
                    Thread.currentThread().interrupt(); // 인터럽트 상태를 복원한다.
                    throw new IllegalStateException("테스트 워커가 중단되었습니다.", ex); // 예상 밖 중단을 드러낸다.
                }
            });
            assertTrue(entered.await(2, TimeUnit.SECONDS)); // 워커가 시작한 뒤에 대기열을 채운다.
            executor.execute(() -> { /* 실행할 일은 없지만 대기열 한 칸을 차지한다. */ });
            assertThrows(TaskRejectedException.class,
                    () -> executor.execute(() -> { /* 세 번째 작업은 제출 단계에서 거절돼야 한다. */ }));
        } finally {
            release.countDown(); // 어떤 결과에서도 대기 중인 워커를 풀어 준다.
            executor.shutdown(); // 테스트 전용 실행기의 스레드와 대기 작업을 정리한다.
        }
    }
}
```

**실습 명령**: Java 프로젝트 루트에서 PowerShell로 `./gradlew.bat test --tests com.example.async.AsyncReportTest`를 실행한다. TIL 저장소 루트에서 실행하는 명령은 아니다.

**예상 결과**: 두 테스트가 통과하고 정상 결과의 스레드 이름이 `report-`로 시작한다. 잘못된 ID는 Future의 실행 실패로, 포화는 `TaskRejectedException`으로 드러난다. 이 결과가 Boot 자동 실행기 유지, HTTP 응답, 실제 DB 트랜잭션, 강제 종료 시 복구까지 검증하는 것은 아니다. 이 항목은 해당 프로젝트의 통합 테스트가 추가로 필요하다.

**이번 작성에서 실제 수행한 검사와의 구분**: Java·Gradle 실행 환경이 없어 위 테스트는 실행하지 않았다. 저장소의 링크·펜스·집계와 공백 검사는 별도로 수행한다. 문서 검사 성공을 Java 테스트 통과로 표현하지 않는다.

## 4. 적용 관점에서 다시 보기

보고서 작업을 실제 서비스에 넣을 때는 본문의 경계를 다음 순서로 다시 묶는다.

1. **일을 넘겨도 되는가**: 호출자가 반드시 기다려야 하는 결과인지, 별도로 관찰할 결과인지 결정한다.
2. **얼마나 맡을 수 있는가**: core·max·queue와 DB·외부 API 용량을 함께 정하고 포화 시 실패를 드러낸다.
3. **무엇을 넘길 것인가**: ID와 필요한 값을 전달하고, 트랜잭션·사용자 문맥은 자동 공유되지 않음을 반영한다.
4. **어떻게 결과를 추적할 것인가**: 제출 거절, 실행 실패, 기다림의 시간 초과를 구분하여 관측한다.
5. **종료 뒤에도 남아야 하는가**: 정상 종료 대기와 내구성 요구를 분리하고 필요한 경우 기존 Outbox 학습을 연결한다.

본문의 짧은 보고서 생성은 이 판단을 연습하는 예제다. 외부 시스템이나 DB를 붙이면 “비동기 어노테이션이 동작하는가”를 넘어 자원 사용량과 실패 후 복구까지 확인해야 한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

`@Async`의 핵심은 프록시를 통한 실행기 위임이다. 작업을 맡기는 성공과 실제 작업의 성공은 다르며, 반환된 Future를 통해 완료를 확인해야 한다. 제한된 풀과 대기열은 무한한 실행·대기를 막지만, 넘치는 요청을 처리하는 정책까지 대신 결정해 주지는 않는다.

### 5.2 이전·다음 학습과의 연결

[Redis 캐시 노트](../30_10_01_Redis_and_Distributed_Cache/10_01_Redis_and_Distributed_Cache.md)에서 최신성·장애 정책을 구분했다면 이번에는 실행 흐름과 작업 실패의 경계를 구분했다. 다음에는 **스케줄링과 `@Scheduled`·중복 실행 제어**를 학습한다. 작업을 언제 시작하는지와 여러 서버에서 같은 일을 중복 수행하지 않도록 관리하는 문제를 이번 실행기 지식과 연결한다.

### 5.3 더 파볼 만한 주제

- 요청 ID를 작업 로그에 전달하고 종료 시 복원하는 `TaskDecorator` 구성
- 실행 시간뿐 아니라 대기 시간까지 측정하는 실행기 관측과 부하 테스트
- 가상 스레드 환경에서도 유지해야 할 외부 자원 동시성 제한
- 재시작 후 처리할 작업 기록, 멱등성, Outbox와 메시지 소비의 연결

### 5.4 참고 자료

아래는 2026-10-02 확인한 공식 자료다. API 계약은 공식 문서를 따르며, 보고서 예제·풀 크기·실패한 Future로의 변환은 학습용 구성이다.

- [Spring Framework — Task Execution and Scheduling](https://docs.spring.io/spring-framework/reference/integration/scheduling.html)
- [Spring Boot — Task Execution and Scheduling](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html)
- [EnableAsync API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/annotation/EnableAsync.html)
- [Async API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/annotation/Async.html)
- [ThreadPoolTaskExecutor API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/concurrent/ThreadPoolTaskExecutor.html)
- [TaskRejectedException API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/task/TaskRejectedException.html)
- [ExecutorConfigurationSupport API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/concurrent/ExecutorConfigurationSupport.html)
- [Transactional API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html)
- [TaskDecorator API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/task/TaskDecorator.html)
- [Spring Security — Concurrency Support](https://docs.spring.io/spring-security/reference/features/integrations/concurrency.html)
- [Java 21 — ThreadPoolExecutor](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)
- [Java 21 — CompletableFuture](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html)
- [Java 21 — Future](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/Future.html)
- [Java 21 — Virtual Threads](https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html)

## 6. 요약 정리

- `@Async`는 기본 프록시 모드에서 외부 Bean 호출을 실행기에 위임한다.
- 이름 있는 실행기로 작업 경로를 분명히 하고 Boot 자동 실행기와의 관계를 확인한다.
- 일반적인 풀은 core → 대기열 → max 확장 → 거절 순서로 제출을 처리한다.
- 제출 거절은 실행 전에, 본문 실패는 실행 후 Future를 통해 드러날 수 있다.
- Future의 시간 초과는 실제 작업 종료와 같지 않다.
- 호출 스레드의 트랜잭션·사용자 문맥은 자동으로 복사되지 않는다.
- 정상 종료 대기는 재시작 후 작업 복구를 보장하지 않는다.
- 테스트는 프록시 경로, 실행 위치, 실패 전달, 포화를 각각 확인한다.

## 7. 미니 퀴즈 또는 체크리스트

1. 같은 객체 안에서 `this.generate(...)`를 호출하면 기본 프록시 모드의 `@Async`가 적용되는가?
2. core 2, max 4, queue 10이고 제출된 작업이 하나도 끝나지 않았다면 몇 번째 제출부터 거절되는가?
3. 본문에서 `completedFuture(result)`를 반환하면 외부 호출도 동기 호출로 바뀌는가?
4. 요청 트랜잭션에서 저장 후 비동기 작업을 호출하면 같은 트랜잭션을 공유하는가? commit 후 제출이면 작업 보존도 보장되는가?
5. Future에서 2초 시간 초과가 발생했다면 워커의 실제 작업도 반드시 종료됐는가?

<details>
<summary>정답과 해설</summary>

1. 아니다. 자기 호출은 Spring 프록시를 통과하지 않는다. 별도 Bean 호출 경로가 필요하다.
2. 15번째다. 최대 실행 4개와 대기 10개를 채운 뒤다. 완료가 없는 가정이며 실제 상태는 실행 중 완료에 따라 달라진다.
3. 아니다. 메서드 본문은 계산한 값을 반환하고, 호출자에게는 프록시가 만든 비동기 결과 경로가 제공된다.
4. 둘 다 아니다. 일반적인 트랜잭션은 스레드 경계를 자동으로 넘지 않는다. commit 이후라도 제출 거절·프로세스 종료로 작업이 유실될 수 있다.
5. 아니다. 기다림의 제한과 실제 작업 중단은 별개다. 사용한 Future·실행기·외부 클라이언트의 취소와 타임아웃 계약을 확인해야 한다.

</details>
