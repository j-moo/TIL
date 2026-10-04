# 스케줄링과 `@Scheduled`·중복 실행 제어: 정해진 시간에 시작한 작업을 끝까지 관리하기

- 🎯 글의 목표: 실행 주기와 실제 작업 완료를 구분하고, 같은 작업의 중복·실패·누락을 어느 경계에서 관리해야 하는지 설명한다.
- 🧩 핵심 키워드: 스케줄러, trigger, fixedDelay·fixedRate, cron, 시간대, `TaskScheduler`, 중복 실행, lease, 멱등성, 실행 이력
- ⭐ 중요도: 높음 — 예약 시간에 호출되었다는 사실만으로 업무가 성공하거나 모든 서버에서 한 번만 실행되었다고 판단할 수 없다.
- 📝 한눈에 보는 내용: 주기 선택 → 이름 있는 스케줄러 연결 → 동기 작업과 완료 경계 → 로컬 중복 방지 → 여러 서버의 조정 → 실패·재시작·검증 순서로 이해한다.
- 🔗 관련 주제: [비동기와 스레드 풀](../31_10_02_Async_and_Thread_Pools/10_02_Async_and_Thread_Pools.md), [멱등성 키](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md), [Outbox](../25_09_23_Transactional_Outbox_and_Event_Publishing/09_23_Transactional_Outbox_and_Event_Publishing.md)
- 🧱 선수 지식: Bean과 DI, Java 예외·try/finally, 스레드와 Future, 트랜잭션, DB 유일 제약

> 자료 기준일: 2026-10-03. Spring Boot 4.1.1의 문서, Spring Framework 7.0.9 API·소스, Java 21 API를 확인했다. 설치 시에는 선택한 Boot 버전의 의존성 관리를 따른다. Java 예제는 기존 Boot 프로젝트에 추가하는 파일과 JUnit 테스트이며, DB 예제는 별도 PostgreSQL 17 학습 DB용 설명 조각이다. 명령 검색에서는 Java 8 실행 명령만 확인됐고 JDK 21 컴파일 명령은 찾지 못했다. 저장소에도 Boot 빌드 프로젝트가 없어 Java 테스트와 DB 실행은 수행하지 않았다. 문서 검사와 예상 동작을 구분한다.

## 1. 들어가며

매일 새벽 전날의 도서 대여 통계를 만들거나, 일정 간격으로 만료된 임시 파일을 찾아 정리하는 작업을 생각해 보자. 사용자의 HTTP 요청이 없어도 작업을 시작할 시점이 필요하다. 정해진 시간이나 간격에 맞춰 작업을 호출하는 것이 **스케줄링**이다.

이전 노트의 `@Async`는 작업을 다른 실행 흐름에 넘기는 방법이었다. 이번에는 **누가 언제 그 작업을 호출하는가**를 살핀다. 시작 시각을 정한 뒤에도 오래 걸리는 작업, 여러 서버의 중복 실행, 장애 동안 놓친 작업을 관리해야 한다.

이번 예제는 DB나 실제 파일을 변경하지 않는 임시 정리 작업으로 실행 흐름을 익힌다. 이후 일별 통계처럼 중복 결과가 문제 되는 작업을 DB 제약과 트랜잭션으로 관리하는 설계까지 연결한다.

## 2. 핵심 개념 정리

```text
주기·달력 시각 설정
  → 스케줄러가 실행 시점을 판단
  → 실행 가능한 스레드에서 메서드 호출
  → 작업 실행 / 중복으로 생략 / 실패
  → 완료·실패·업무 진행 위치 기록
  → 다음 실행 또는 복구 판단
```

**스케줄러**는 시점을 관리하는 구성 요소이고, **trigger**는 다음 실행 시점을 정하는 규칙이다. **멱등성**은 같은 업무를 다시 처리해도 결과가 중복 반영되지 않는 성질이다. 시작 시점을 정하는 기능과 업무 결과를 지키는 기능을 함께 연결해야 한다.

| 질문 | 본문에서 확인할 것 |
| --- | --- |
| 완료 후 기다릴까, 일정한 시작 간격을 목표로 할까? | fixedDelay·fixedRate, 3.2 |
| 한국 시간 매일 02:10에 실행하려면? | cron·zone, 3.3 |
| 어느 스레드가 작업 본문을 실행할까? | 이름 있는 TaskScheduler, 3.4~3.5 |
| 비동기로 넘기면 무엇을 완료로 볼까? | 실제 업무와 메서드 반환, 3.6 |
| 여러 서버가 같은 시각에 호출하면? | 로컬 gate·공유 잠금·업무 키, 3.7~3.9 |
| 실패·종료·재시작 뒤에는? | 복구 조건·관측·검증, 3.10~3.12 |

이 표는 학습 지도다. 특히 한 서버의 스레드 충돌과 여러 서버의 동일 업무 중복은 범위가 다르다는 점을 기억해 두면 뒤의 선택 기준을 이해하기 좋다.

## 3. 본문 정리

### 3.1 `@Scheduled`는 Spring이 메서드를 찾아 호출하도록 등록한다

`@Scheduled`는 메서드에 실행 시점 규칙을 붙이는 애너테이션이다. `@EnableScheduling`이 켜진 Spring 컨텍스트에서 관리하는 Bean이어야 등록된다. 직접 `new`로 만든 객체의 애너테이션을 Spring이 자동으로 탐색하는 것은 아니다.

이번에는 인자가 없고 `void`를 반환하는 동기 메서드를 사용한다. 필요한 서비스는 생성자 주입으로 받는다. 일반적인 동기 메서드의 반환값은 작업 결과를 HTTP 응답처럼 전달하는 데 쓰이지 않는다. reactive 방식은 별도 동작이 있으므로 이 노트 범위에서는 사용하지 않는다. [Scheduled API](https://docs.spring.io/spring-framework/docs/7.0.9/javadoc-api/org/springframework/scheduling/annotation/Scheduled.html)

등록된 예약과 직접 메서드 호출도 구분해야 한다. `job.tick()`을 직접 호출하면 즉시 실행되며 예약 시각을 기다리지 않는다. 애너테이션은 모든 호출에 시간 제한을 붙이는 기능이 아니다.

⚠️ 주의: 같은 클래스의 Bean을 여러 개 만들거나 같은 메서드에 예약을 여러 개 붙이면 등록도 여러 개가 될 수 있다. 작업이 두 번 호출될 때는 서버 수뿐 아니라 Bean 생성 경로와 애너테이션 선언도 확인한다.

### 3.2 fixedDelay와 fixedRate는 시간의 기준이 다르다

`fixedDelay`는 이전 **메서드 실행이 끝난 시점**부터 다음 시작까지 기다리는 간격이다. `fixedRate`는 일정한 시작 간격을 목표로 한다. 작업에 3초가 걸리고 간격이 5초라면 다음 차이가 난다.

| 규칙 | 이상적인 시작 시각 | 기준 |
| --- | --- | --- |
| fixedDelay 5초 | 0초, 8초, 16초 | 완료 후 5초 |
| fixedRate 5초 | 0초, 5초, 10초 | 목표 시작 간격 5초 |

실제 시각은 스레드 대기와 시스템 부하로 늦어질 수 있다. 메서드 종료가 업무 완료를 의미하는 동기 호출이라는 전제도 필요하다. `initialDelay`는 첫 실행까지의 대기이며 완료 간격과는 별도다.

아래는 같은 메서드에 함께 붙이는 코드가 아니라 **규칙을 비교하는 선언 조각**이다.

```java
// 실제 적용할 때 두 방식 중 작업 목적에 맞는 한 가지를 선택한다.
@Scheduled(fixedDelay = 5, initialDelay = 2, timeUnit = TimeUnit.SECONDS)
// 완료한 뒤 5초를 쉬며, 처음에는 2초를 기다린다.
```

이 선언을 사용할 파일에는 `org.springframework.scheduling.annotation.Scheduled`와 `java.util.concurrent.TimeUnit` import가 필요하다. 같은 위치에서 `fixedRate = 5`로 바꾸면 시작 간격을 목표로 하는 선언이 된다. [Spring Scheduling Reference](https://docs.spring.io/spring-framework/reference/integration/scheduling.html)

`ThreadPoolTaskScheduler`가 사용하는 JDK 주기 실행에서는 **같은 주기 작업 하나의 연속 실행이 서로 겹치지 않는다**. 8초 걸리는 작업을 fixedRate 5초로 예약하면 다음 실행은 늦게 시작할 수 있지만 그 이유만으로 같은 작업이 동시에 두 번 실행되는 것은 아니다. [JDK ScheduledThreadPoolExecutor](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ScheduledThreadPoolExecutor.html)

⚠️ 주의: 이 비중첩 특성은 동일한 주기 등록의 동기 작업에 대한 설명이다. 다른 예약·다른 Bean·수동 호출·다른 서버·비동기로 제출한 실제 작업까지 막지는 않는다. 오래 걸리는 fixedRate 작업이 끝난 뒤 곧바로 이어질 수도 있으므로 “매번 5초 쉬는 방식”으로 설명하면 안 된다.

### 3.3 cron은 달력 기준 시각과 시간대를 표현한다

**cron 표현식**은 달력의 필드로 실행 시점을 정하는 문자열이다. Spring은 초를 포함한 여섯 필드를 사용한다. 운영체제의 일부 cron 예제처럼 다섯 필드를 복사하면 맞지 않을 수 있다.

```text
0 10 2 * * *
│ │  │ │ │ └─ 요일
│ │  │ │ └─── 월
│ │  │ └───── 일
│ │  └─────── 시
│ └────────── 분
└──────────── 초

매일 02:10:00에 해당하는 규칙이다.
```

`zone = "Asia/Seoul"`을 지정하면 한국 시간 달력으로 해석한다. 같은 설정을 UTC 시간대 서버에 배포해도 의도를 표현할 수 있다. 서버 로컬 시간에 암묵적으로 의존하면 배포 환경에 따라 업무 날짜가 달라질 수 있다. [CronExpression API](https://docs.spring.io/spring-framework/docs/7.0.9/javadoc-api/org/springframework/scheduling/support/CronExpression.html)

예를 들어 한국 시간 2026-10-03 02:10은 UTC의 2026-10-02 17:10이다. 실행 로그의 UTC 시각과 업무 날짜를 비교할 때는 이 차이를 고려한다. 서머타임이 있는 지역은 존재하지 않거나 반복되는 현지 시각도 시험해야 한다.

cron은 호출 규칙이지 영구 작업 목록은 아니다. 이 노트의 기본 `CronTrigger`는 완료 시점을 기준으로 다음 시점을 계산하므로 오래 실행되는 동안 예약 시각을 건너뛸 수 있다. 프로세스가 꺼져 있던 시각의 작업도 `@Scheduled`만으로 자동 재생되지 않는다. [CronTrigger API](https://docs.spring.io/spring-framework/docs/7.0.9/javadoc-api/org/springframework/scheduling/support/CronTrigger.html)

### 3.4 스케줄러를 이름으로 선택하고 실행 자원을 제한한다

`TaskScheduler`는 작업을 특정 시각이나 주기로 예약하는 Spring 인터페이스다. 이전의 `TaskExecutor`가 작업 제출과 실행을 맡았다면, 스케줄러는 실행 시점도 관리한다.

Boot는 조건에 맞는 스케줄러를 자동 구성할 수 있으며, 가상 스레드 활성화 여부에 따라 구현도 달라진다. 여기서는 동작 범위를 분명히 하기 위해 이름 있는 `ThreadPoolTaskScheduler`를 직접 등록한다. 가상 스레드는 사용하지 않는다. [Boot Task Execution and Scheduling](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html)

아래 3.4~3.5의 파일들은 기존 Boot 프로젝트의 `src/main/java/com/example/scheduling/` 아래에 추가한다. Boot 시작 클래스의 스캔 범위가 이 패키지를 포함해야 한다. 프로젝트에는 기본 Spring Boot Starter와 로깅 구성이 있다고 가정하며, 별도 웹·DB 의존성은 이 데모에 필요 없다.

`SchedulingConfig.java`:

```java
package com.example.scheduling;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
@EnableScheduling // 컨텍스트에서 @Scheduled 메서드를 찾아 등록한다.
public class SchedulingConfig {
    private static final Logger log = LoggerFactory.getLogger(SchedulingConfig.class);

    @Bean(name = "maintenanceScheduler") // 메서드 예약에서 이 이름을 선택한다.
    public ThreadPoolTaskScheduler maintenanceScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2); // 독립 작업 두 개가 실행할 수 있는 학습용 설정이다.
        scheduler.setThreadNamePrefix("maintenance-"); // 로그에서 실행 위치를 찾는다.
        scheduler.setRemoveOnCancelPolicy(true); // 취소된 예약을 큐에서 제거한다.

        // 정상 종료 때 새 반복 실행과 미래 지연 작업을 계속 수행하지 않는다.
        scheduler.setContinueExistingPeriodicTasksAfterShutdownPolicy(false);
        scheduler.setExecuteExistingDelayedTasksAfterShutdownPolicy(false);
        scheduler.setWaitForTasksToCompleteOnShutdown(true); // 진행 중인 실행의 종료를 기다린다.
        scheduler.setAwaitTerminationSeconds(10); // 종료 대기 예시이며 작업 timeout은 아니다.

        // 실패를 로그로 남기고 handler에서 다시 던지지 않는 정책이다.
        // 실패했다는 사실은 관찰하되 다음 주기 실행을 중단시키지 않는다.
        scheduler.setErrorHandler(error -> log.error("예약 작업 실행 실패", error));
        return scheduler; // 초기화와 종료는 Spring Bean 생명주기에 맡긴다.
    }
}
```

`ThreadPoolTaskScheduler`는 스케줄러 스레드에서 작업 본문을 실행한다. 따라서 오래 걸리는 작업 두 개가 두 스레드를 점유하면 다른 예약도 늦어질 수 있다. 2라는 숫자는 보편적인 권장값이 아니라 실습에서 실행 위치를 구분하기 위한 선택이다. [ThreadPoolTaskScheduler API](https://docs.spring.io/spring-framework/docs/7.0.9/javadoc-api/org/springframework/scheduling/concurrent/ThreadPoolTaskScheduler.html)

⚠️ 주의: 이 Bean을 직접 만들었으므로 Boot 자동 구성용 `spring.task.scheduling.pool.size`를 바꾼다고 위 코드의 숫자까지 바뀌는 것은 아니다. 실제로 어느 Bean을 선택하는지와 등록된 스레드 수를 확인한다. `@Scheduled`의 `scheduler` 속성은 Framework 6.1 이상에서 사용한다.

### 3.5 호출 시점과 실제 업무를 별도 Bean으로 나눈다

스케줄 메서드는 입력을 준비하고 업무 서비스를 호출한다. 별도 서비스는 직접 테스트할 수 있고, 나중에 DB 트랜잭션을 적용할 경계도 분명해진다.

`MaintenanceService.java`:

```java
package com.example.scheduling;

import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class MaintenanceService {
    private static final Logger log = LoggerFactory.getLogger(MaintenanceService.class);
    private final AtomicInteger runs = new AtomicInteger(); // 호출 횟수 관찰용 메모리 상태다.

    public void cleanExpiredDrafts() {
        int run = runs.incrementAndGet(); // 여러 스레드에서도 카운터 증가를 한 번에 처리한다.
        log.info("정리 데모 실행 run={}, thread={}", run, Thread.currentThread().getName());
        // 실제 삭제·DB 변경을 하지 않는 데모다. 업무 구현은 이 경계에 추가한다.
    }
}
```

`MaintenanceJob.java`:

```java
package com.example.scheduling;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MaintenanceJob {
    private final MaintenanceService service;

    public MaintenanceJob(MaintenanceService service) {
        this.service = service; // 예약 등록과 실제 정리 업무의 책임을 나눈다.
    }

    @Scheduled(
        scheduler = "maintenanceScheduler", // 3.4에서 등록한 스케줄러를 선택한다.
        cron = "${jobs.cleanup.cron:-}", // '-'는 이 cron 예약을 비활성화하는 값이다.
        zone = "${jobs.cleanup.zone:Asia/Seoul}" // 달력 시각의 기준 시간대를 명시한다.
    )
    public void tick() {
        service.cleanExpiredDrafts(); // 동기 호출이므로 서비스 반환까지 이 실행이 계속된다.
    }
}
```

`src/main/resources/application.yml` 설정은 다음과 같다. 단위와 내용이 보이는 cron 문자열을 따옴표로 감싼다.

```yaml
jobs:
  cleanup:
    # 로컬 관찰용: 매 분 0초와 30초에 실행한다.
    cron: "0/30 * * * * *"
    # 이 예약을 해석할 달력 시간대다.
    zone: "Asia/Seoul"
```

프로젝트 루트에서 Gradle 프로젝트는 `./gradlew.bat bootRun`, Maven 프로젝트는 `./mvnw.cmd spring-boot:run`으로 시작한다. 성공하면 `maintenance-`로 시작하는 스레드 이름과 증가하는 run 값이 로그에 보일 것으로 예상한다. 기동 시점에 즉시 실행된다는 보장은 없다. 예를 들어 12:00:07에 시작했다면 다음 목표 시각은 12:00:30이다.

매일 02:10 규칙을 확인하려면 cron 값을 `"0 10 2 * * *"`로 바꾸고 재시작한다. `"-"`는 해당 cron 등록을 끄지만 다른 예약과 이미 실행 중인 업무를 모두 취소하는 스위치는 아니다. 일반 속성 파일 수정만으로 실행 중인 예약이 자동 갱신된다고 가정하지 않는다.

### 3.6 `@Async`와 결합하면 완료의 의미가 바뀐다

fixedDelay가 기다리는 것은 **스케줄 메서드의 완료**다. 그 메서드가 `@Async` 서비스에 작업만 넘기고 반환하면, 실제 정리 작업은 계속 실행 중이어도 지연 시간 계산은 시작된다.

```text
예약 메서드: 시작 → 비동기 제출 → 반환 → delay 5초 → 다음 제출
실제 워커:            시작 → 작업 20초 동안 진행 ───────→ 완료
```

이때 스케줄러 풀의 비중첩 특성은 제출 메서드에 적용되고 실제 워커 작업에는 적용되지 않는다. 이전 노트의 유한 대기열과 거절 정책을 사용하더라도, 주기적으로 계속 제출하면 queue가 쌓이거나 작업이 거절될 수 있다.

⚠️ 주의: `@Scheduled`와 `@Async`를 붙였다는 이유만으로 주기 작업이 안전하게 빨라지는 것은 아니다. 실제 완료를 기준으로 다음 실행을 정해야 하는 작업은 동기 호출을 유지하거나 별도 실행 상태를 관리한다. 비동기가 필요하면 제출 거절·Future 실패·실행 중복을 각각 관찰해야 한다.

### 3.7 같은 프로세스의 여러 호출 경로를 gate로 제한한다

수동 실행 API와 예약 실행이 같은 업무를 호출할 수도 있다. 여기서는 **gate**를 “이미 실행 중이면 새 호출을 생략하는 진입 상태”로 정의한다. 한 JVM, 즉 하나의 Java 프로세스 안에서 같은 gate 객체를 공유하는 호출에 적용한다.

`LocalRunGate.java`는 Spring 의존성 없이도 사용할 수 있는 완전한 클래스다. 3.5 데모에 자동 적용된 상태는 아니며, 필요하면 Job 또는 서비스에 같은 인스턴스를 연결한다.

```java
package com.example.scheduling;

import java.util.concurrent.atomic.AtomicBoolean;

public final class LocalRunGate {
    private final AtomicBoolean running = new AtomicBoolean(false);

    public boolean runIfIdle(Runnable work) {
        // 확인과 변경을 하나의 원자적 연산으로 처리한다.
        // 두 스레드가 동시에 들어와도 false→true 전환에 성공한 하나만 진행한다.
        if (!running.compareAndSet(false, true)) {
            return false; // 다른 실행을 기다리지 않고 이번 호출을 생략한다.
        }
        try {
            work.run(); // 이 메서드가 반환될 때까지 동기 업무를 실행한다.
            return true; // 정상 수행한 경우만 true를 반환한다.
        } finally {
            running.set(false); // 업무 예외가 나도 다음 호출이 들어갈 수 있게 복원한다.
        }
    }
}
```

Job에서 사용할 호출 조각은 `gate.runIfIdle(service::cleanExpiredDrafts)`다. 메서드 참조는 정리 메서드를 나중에 실행할 동작으로 전달한다. 반환값 false는 업무 실패가 아니라 이번 호출을 생략했다는 뜻이고, 업무 자체의 예외는 호출자에게 전달된다.

⚠️ 주의: gate를 매 호출마다 새로 만들면 상태를 공유하지 못한다. 또한 `work`에서 비동기 제출만 하고 반환하면 gate도 일찍 해제된다. gate를 실제 업무의 전체 실행 경계에 적용해야 하며, 모든 호출 경로가 같은 gate를 사용하는지도 확인한다.

### 3.8 여러 서버의 중복은 공유 조정이 필요하다

서버 A와 B가 모두 같은 `@Scheduled` Bean을 가지면 각각 자신의 스케줄러에서 호출한다. AtomicBoolean도 각 프로세스마다 따로 있다. 서버 A의 true 값으로 B의 호출을 막을 수 없다.

```text
같은 업무 시각
  ├─ 서버 A: 로컬 스케줄러 → A의 gate → 업무 실행
  └─ 서버 B: 로컬 스케줄러 → B의 gate → 업무 실행
```

**분산 잠금**은 여러 프로세스가 함께 접근하는 DB·Redis 등의 저장소를 이용해 실행 소유자를 조정한다. **lease**는 일정 시간이 지나면 소유권이 만료되는 임대형 잠금이다. 소유자가 죽어도 영원히 막히지 않게 하지만, 시간이 만료됐다고 기존 실행이 자동으로 멈추는 것은 아니다.

ShedLock의 공식 문서는 같은 이름의 잠금을 다른 노드가 보유한 경우 해당 실행을 기다리지 않고 건너뛴다고 설명한다. `lockAtMostFor`보다 작업이 오래 실행되면 다른 노드도 실행할 수 있고, 짧은 작업의 시간차에는 `lockAtLeastFor`의 목적도 따로 있다. [ShedLock 공식 저장소](https://github.com/lukas-krecan/ShedLock)

이 노트는 ShedLock을 설치한 실행 예제를 제공하지 않는다. 도입 시에는 실제 버전, LockProvider, DB 시간 사용, 잠금 이름, 최대 실행 시간과 잠금 만료를 함께 검증해야 한다. 기존 Outbox의 lease 기반 작업 선점과도 연결해 볼 수 있다.

⚠️ 주의: 잠금이 끝난 뒤 같은 업무 시각의 늦은 호출이 다시 들어오는 경우도 있다. “한 번에 한 실행”과 “하루 업무가 한 번 반영됨”은 별도의 조건이다. 잠금 만료·지연 호출·재시도까지 고려하려면 다음 절의 업무 키가 필요하다.

### 3.9 업무 키와 DB 트랜잭션으로 결과 중복을 막는다

매일 전날의 대여 통계를 만드는 경우, 서로 다른 실행 ID를 가져도 같은 날의 통계면 동일 업무다. **업무 키**를 `(job_name, business_date)`로 두면 서버·재시작·재시도에 걸쳐 같은 결과를 식별할 수 있다.

아래는 PostgreSQL 17에서 DB 내 결과만 저장하는 설계 조각이다. 별도 DB에 만드는 설명용 테이블이며 실제 대여 집계 쿼리는 구현하지 않는다. Flyway로 프로젝트에 도입할 때는 기존 버전에 맞는 새 마이그레이션 파일로 관리한다.

```sql
-- 어떤 날짜의 어떤 업무를 이미 확정했는지 기록한다.
CREATE TABLE daily_job_completion (
    job_name VARCHAR(80) NOT NULL,
    business_date DATE NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (job_name, business_date) -- 같은 업무 키를 두 번 확정할 수 없다.
);

-- 실제 집계 결과에도 날짜 중복을 막는 규칙을 둔다.
CREATE TABLE daily_loan_summary (
    business_date DATE PRIMARY KEY,
    loan_count BIGINT NOT NULL CHECK (loan_count >= 0)
);
```

처리 흐름은 다음 의사 코드처럼 업무 표시와 결과를 **하나의 DB 트랜잭션**에서 확정한다. 완료 테이블의 이름이 완료라고 해서 첫 INSERT 순간 다른 트랜잭션에 완료가 확정되는 것은 아니다. commit 전에는 함께 rollback될 수 있다.

```text
BEGIN
  업무 키 INSERT ... ON CONFLICT DO NOTHING RETURNING business_date
  → 반환 행이 없으면 이미 확정된 업무이므로 이번 처리를 생략하고 종료
  → 반환 행이 있으면 해당 날짜 집계 후 결과 INSERT
COMMIT
예외 발생 시 ROLLBACK → 업무 표시와 결과가 모두 취소됨
```

실제로 키를 선점하는 SQL은 아래와 같다. 애플리케이션에서는 날짜와 이름을 바인딩하고 반환 행 여부를 판단한다. 이 SQL만 실행하고 트랜잭션을 끝낸 뒤 결과를 별도 저장하는 것은 위 설계와 다르다.

```sql
-- 같은 업무 키의 동시 INSERT는 DB 유일 제약으로 조정한다.
INSERT INTO daily_job_completion (job_name, business_date)
VALUES ('daily-loan-summary', DATE '2026-10-02')
ON CONFLICT (job_name, business_date) DO NOTHING
RETURNING business_date; -- 키를 확보한 실행만 날짜를 돌려받는다.
```

경쟁 상대가 아직 commit하지 않았다면 유일 제약 판단 과정에서 대기할 수 있다. 첫 트랜잭션이 성공하면 후속 호출은 결과를 중복 만들지 않고, 실패하면 다시 처리할 기회가 생긴다. SQL의 동작은 [PostgreSQL INSERT](https://www.postgresql.org/docs/17/sql-insert.html)를 참고한다.

⚠️ 주의: 긴 집계를 하나의 트랜잭션으로 실행하면 잠금 대기와 DB 부하가 커질 수 있다. 외부 메일·결제 전송은 이 DB rollback으로 되돌아가지 않는다. 외부 효과가 필요하면 Outbox와 소비자 멱등성 같은 별도 전달 설계를 연결하고, 긴 작업은 진행 상태·lease·복구 정책을 나누어 설계한다.

### 3.10 실패와 재시작 후 누락을 별도로 관리한다

동기 반복 작업에서 Spring의 기본 오류 처리 도우미는 반복 실행의 예외를 로그로 남기고 억제하는 정책을 제공한다. 이번 3.4 예제도 로그를 남기고 handler에서 다시 던지지 않도록 명시했다. 따라서 이번 호출 실패와 예약 자체의 중단은 구분해야 한다. [TaskUtils 7.0.9 소스](https://raw.githubusercontent.com/spring-projects/spring-framework/v7.0.9/spring-context/src/main/java/org/springframework/scheduling/support/TaskUtils.java)

반대로 일반 JDK 주기 작업에서 예외가 그대로 빠져나가면 후속 실행이 억제될 수 있다. Spring과 JDK의 처리를 혼동하지 말고, 실제 사용한 scheduler·ErrorHandler 경로를 확인한다.

다음 실행이 있다고 업무가 자동 복구되는 것은 아니다. 매일 어제만 처리하는 코드가 3일 동안 꺼져 있었다면, 오늘 실행해도 그 사이의 업무 날짜를 놓칠 수 있다. 다음과 같이 시각과 대상 날짜를 나누는 설계가 필요하다.

```text
스케줄러는 복구 검사를 시작하는 시점만 제공
  → 완료 이력에서 아직 처리하지 않은 날짜를 찾음
  → 정한 개수만 순서대로 처리
  → 날짜별 결과와 완료 이력을 확정
  → 다음 호출에서 나머지 미완료 날짜를 계속 확인
```

예약 호출은 중복될 수 있지만, 업무 날짜별 결과는 3.9의 키로 보호할 수 있다. 업무 날짜는 `LocalDate.now(업무 시간대)`에서 계산하거나 복구 대상으로 명시 전달하고, 테스트에서는 `Clock`을 주입해 날짜를 고정한다. 시스템 기본 시간대를 사용해 업무 기준을 우연히 바꾸지 않는다.

⚠️ 주의: 실패한 작업 안에서 끝없이 즉시 재시도하면 스케줄러 스레드를 계속 점유한다. 횟수·대기·전체 시간 상한을 정하고, 주기 재실행과 내부 재시도를 합친 총 부하를 고려한다.

### 3.11 종료 대기와 업무 관측을 연결한다

정상 종료 때 새 호출을 줄이고 진행 중 작업을 기다릴 수 있어도, 강제 종료나 서버 장애까지 완료를 보장하지는 않는다. 3.4의 10초 대기는 종료를 기다리는 설정이며 실행 중 외부 호출을 10초에 반드시 중단하는 설정이 아니다.

작업 자체의 DB·외부 요청 timeout, 협력적 중단, commit 경계를 먼저 정해야 한다. 실행 중간에 멈춰도 다음 호출이 안전하게 이어갈 수 있도록 처리 대상·상태·업무 키를 저장한다.

| 관측 항목 | 알 수 있는 문제 |
| --- | --- |
| 업무 키·실행 ID·서버 ID | 같은 업무의 중복 호출과 처리 소유자 |
| 시작·완료·소요 시간 | 지연 실행과 실행 시간 증가 |
| 성공·실패·생략 횟수 | 정상 무작업, 잠금 경쟁, 업무 오류의 차이 |
| 마지막 성공과 미완료 대상 수 | 호출은 되지만 실제 처리가 멈춘 상태 |
| 오류 분류·재시도 횟수 | 일시 장애와 영구 입력 오류의 차이 |

이 표의 항목은 관측 설계 예시다. 직접 만든 스케줄러의 모든 지표가 자동 수집된다고 전제하지 않는다. 로그에도 토큰·개인정보·전체 업무 payload를 넣지 않고 문제 추적에 필요한 식별 정보만 남긴다.

### 3.12 시각 계산과 실행 상태를 기다림 없이 검증한다

매일 한 번인 작업을 테스트하려고 실제 다음 날까지 기다릴 필요는 없다. cron의 다음 시점은 고정 입력으로 계산하고, 업무 로직은 예약과 분리해 직접 호출한다.

아래 파일은 `src/test/java/com/example/scheduling/SchedulingRulesTest.java`다. 기존 Boot 테스트 Starter의 JUnit Jupiter와 AssertJ가 있어야 한다. 3.7의 `LocalRunGate`도 같은 프로젝트에 추가한다.

```java
package com.example.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.support.CronExpression;

class SchedulingRulesTest {
    @Test
    void cron은_한국_시간의_다음_시각을_계산한다() {
        var zone = ZoneId.of("Asia/Seoul"); // 서버 기본 시간대에 의존하지 않는다.
        var before = ZonedDateTime.of(2026, 10, 3, 2, 9, 59, 0, zone);
        var expected = ZonedDateTime.of(2026, 10, 3, 2, 10, 0, 0, zone);
        var rule = CronExpression.parse("0 10 2 * * *"); // 실제 Job과 같은 규칙이다.

        assertThat(rule.next(before)).isEqualTo(expected); // 1초 뒤가 다음 목표다.
        assertThat(rule.next(expected)).isEqualTo(expected.plusDays(1)); // 이미 지난 시각은 다시 선택하지 않는다.
    }

    @Test
    void 업무가_실패해도_gate를_다시_사용할_수_있다() {
        var gate = new LocalRunGate();
        assertThatThrownBy(() -> gate.runIfIdle(() -> {
            throw new IllegalStateException("학습용 실패"); // finally 경로를 시험한다.
        })).isInstanceOf(IllegalStateException.class);

        var completed = new AtomicInteger();
        assertThat(gate.runIfIdle(completed::incrementAndGet)).isTrue(); // gate가 복구되어야 한다.
        assertThat(completed.get()).isEqualTo(1); // 실패 뒤의 새 업무가 실행됐는지 확인한다.
    }

    @Test
    void 실행_중인_gate의_새_호출은_생략한다() throws Exception {
        var gate = new LocalRunGate();
        var entered = new CountDownLatch(1); // 첫 작업이 본문에 진입했다는 신호다.
        var release = new CountDownLatch(1); // 첫 작업이 계속 gate를 점유하게 한다.
        var executor = Executors.newSingleThreadExecutor();
        try {
            var first = executor.submit(() -> gate.runIfIdle(() -> {
                entered.countDown(); // 점유한 후 테스트 스레드에 알려 준다.
                try {
                    if (!release.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("시험 해제 신호 시간 초과");
                    }
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt(); // 인터럽트 상태를 보존한다.
                    throw new IllegalStateException(error);
                }
            }));

            assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue(); // 임의 sleep 대신 진입을 확인한다.
            var secondRuns = new AtomicInteger();
            assertThat(gate.runIfIdle(secondRuns::incrementAndGet)).isFalse(); // 기다리지 않고 생략한다.
            assertThat(secondRuns.get()).isZero(); // 두 번째 업무 본문은 실행되지 않아야 한다.
            release.countDown(); // 첫 작업의 정상 반환을 허용한다.
            assertThat(first.get(2, TimeUnit.SECONDS)).isTrue(); // 첫 호출은 정상 수행했다.
        } finally {
            release.countDown(); // assertion 실패 때도 워커를 풀어 준다.
            executor.shutdownNow(); // 테스트 실행 자원을 정리한다.
            executor.awaitTermination(2, TimeUnit.SECONDS);
        }
    }
}
```

프로젝트 루트에서 Gradle은 `./gradlew.bat test --tests com.example.scheduling.SchedulingRulesTest`, Maven은 `./mvnw.cmd -Dtest=SchedulingRulesTest test`로 실행한다. 예상 결과는 세 테스트 통과다. 이 테스트는 계산 규칙과 같은 객체의 gate를 검증하며, `@Scheduled` Bean 등록·스레드 선택·여러 서버의 잠금까지 검증하지는 않는다.

통합 검증은 별도로 범위를 나눈다. 로컬 Boot 기동으로 `maintenance-` 스레드와 설정 비활성화를 확인한다. 여러 서버 검증은 서로 다른 프로세스가 같은 업무 키를 처리하게 하고, DB 결과 한 건과 실패 후 재처리 가능성을 확인한다. 같은 테스트 객체에만 두 번 호출한 결과를 분산 검증으로 표현하지 않는다.

## 4. 적용 관점에서 다시 보기

주기 작업을 추가할 때는 “몇 초마다 호출할까”보다 업무의 시간 기준부터 정한다. 이전 완료 후 쉬어야 하면 fixedDelay, 일정 시작 간격이 목표면 fixedRate, 업무 달력 시각이면 cron과 시간대를 선택한다.

그다음 메서드 반환과 실제 업무 완료가 같은지 확인하고 실행 자원을 연결한다. 비동기 제출이 있으면 실제 작업의 완료·거절·중복 경계를 따로 관리한다. 다중 서버에서는 업무 키와 조정 범위를 정한 뒤, DB 결과와 외부 효과의 보호 방법을 선택한다.

| 상황 | 선택·확인 기준 |
| --- | --- |
| 일별 결과를 저장 | 시간대·업무 날짜·DB 유일 키·결과 commit |
| 무작업이어도 주기적으로 확인 | 완료 후 간격·한 번에 처리할 수·미완료 대상 |
| 서로 다른 작업이 지연됨 | 선택한 스케줄러·실행 시간·스레드 점유 |
| 같은 업무가 두 번 반영됨 | Bean/서버 수·잠금 만료·업무 키·외부 멱등성 |
| 재시작 뒤 날짜가 빠짐 | 예약 호출 대신 미완료 업무 이력으로 복구 |
| 호출 로그는 있는데 결과가 없음 | 제출 실패·업무 예외·commit·실제 완료 기록 |

구현 순서는 주기·시간대 확정, 업무 분리, 스케줄러 선택, 중복 결과 보호, 실패 복구, 종료·관측, 경계별 검증으로 묶을 수 있다. 이 순서는 본문의 개념을 실제 코드 리뷰 질문으로 바꾸기 위한 것이다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

예약은 호출 시점을 정하고, 업무 키와 트랜잭션은 결과를 보호한다. 동기 메서드의 완료, 비동기 제출 완료, 실제 업무 commit은 서로 다른 관찰 시점이므로 주기와 실패 처리를 그 경계에 맞춰야 한다.

### 5.2 이전·다음 학습과의 연결

[비동기 노트](../31_10_02_Async_and_Thread_Pools/10_02_Async_and_Thread_Pools.md)의 실행기·Future 지식에 호출 시점과 재시작 복구를 연결했다. 다음은 [Spring Batch와 대량 작업의 재시작·체크포인트](../33_10_04_Spring_Batch_and_Restartability/10_04_Spring_Batch_and_Restartability.md)다. 스케줄러가 시작한 업무를 여러 단계로 나누고 어느 지점부터 다시 진행할지 저장하는 방법을 학습한다.

### 5.3 더 파볼 만한 주제

Quartz 등 영구 스케줄 저장소의 누락 실행 정책, lease 갱신과 오래된 소유자 차단, 서머타임 지역의 업무 날짜 시험을 심화할 수 있다. 각 도구의 실행 보장과 DB·외부 시스템의 결과 보장을 따로 비교하는 것이 다음 조사 질문이다.

### 5.4 참고 자료

- [Spring Scheduling Reference](https://docs.spring.io/spring-framework/reference/integration/scheduling.html): 예약 활성화·주기·메서드 등록 범위.
- [Scheduled 7.0.9 API](https://docs.spring.io/spring-framework/docs/7.0.9/javadoc-api/org/springframework/scheduling/annotation/Scheduled.html): scheduler·zone·cron 비활성화 값과 버전 조건.
- [Boot Task Execution and Scheduling](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html): 자동 구성과 가상 스레드에 따른 구현 차이.
- [ThreadPoolTaskScheduler 7.0.9 API](https://docs.spring.io/spring-framework/docs/7.0.9/javadoc-api/org/springframework/scheduling/concurrent/ThreadPoolTaskScheduler.html): 실행 스레드·오류 처리·종료 설정.
- [CronExpression API](https://docs.spring.io/spring-framework/docs/7.0.9/javadoc-api/org/springframework/scheduling/support/CronExpression.html), [CronTrigger API](https://docs.spring.io/spring-framework/docs/7.0.9/javadoc-api/org/springframework/scheduling/support/CronTrigger.html): 필드와 다음 실행 계산.
- [JDK ScheduledThreadPoolExecutor](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ScheduledThreadPoolExecutor.html): 같은 주기 작업의 비중첩과 예외 동작.
- [TaskUtils 소스](https://raw.githubusercontent.com/spring-projects/spring-framework/v7.0.9/spring-context/src/main/java/org/springframework/scheduling/support/TaskUtils.java): 반복 작업 기본 오류 처리.
- [ShedLock 공식 저장소](https://github.com/lukas-krecan/ShedLock): 공유 잠금·생략·만료의 경계. 설치 버전은 이 예제에서 지정하지 않았다.
- [PostgreSQL 17 INSERT](https://www.postgresql.org/docs/17/sql-insert.html): ON CONFLICT·RETURNING과 업무 키 선점.

## 6. 요약 정리

1. `@Scheduled`는 Spring Bean에 호출 시점을 등록하며 작업 결과를 영구 보존하는 기능은 아니다.
2. fixedDelay는 메서드 완료 후 간격, fixedRate는 목표 시작 간격, cron은 달력 규칙을 표현한다.
3. 시간대와 업무 날짜를 명시하고, 부하로 실행이 늦거나 건너뛰는 경우를 고려한다.
4. 같은 주기 작업의 비중첩은 다른 서버·수동 호출·비동기 업무의 중복까지 막지 않는다.
5. 이름 있는 스케줄러로 실행 위치를 확인하고 긴 작업의 점유를 관리한다.
6. 로컬 gate·공유 잠금·업무 키는 서로 다른 범위의 중복을 다룬다.
7. 잠금 만료는 기존 실행 중단과 같지 않으며, 외부 효과에는 별도 멱등성이 필요하다.
8. 실패·재시작에는 미완료 업무 이력과 복구 조건이 필요하다.
9. 테스트는 시각 계산·등록·로컬 충돌·분산 결과를 각 범위에 맞춰 검증한다.

🧠 기억할 것: **정해진 시간에 시작하는 일과 같은 업무를 안전하게 끝내는 일은 각각 관리해야 한다.**

## 7. 미니 퀴즈 또는 체크리스트

1. 동기 작업이 3초 걸리고 fixedDelay가 5초라면 0초 시작 뒤의 다음 목표 시작은 언제인가? fixedRate는 어떻게 다른가?
2. 정리 작업을 비동기로 넘기고 즉시 반환하면 fixedDelay는 실제 정리가 끝난 시점부터 계산되는가?
3. 서버 두 대에 AtomicBoolean gate를 각각 두었다. 같은 날짜의 통계 중복 저장을 막았다고 할 수 있는가?
4. 잠금이 30초 만료되고 원래 작업이 50초 걸리면 어떤 문제가 가능하며, 어떤 결과 보호가 필요한가?
5. 서버가 3일 꺼져 있었다. 오늘 cron 실행이 성공했다면 놓친 모든 날짜도 처리됐다고 판단할 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 8초다. 완료가 3초이고 그 뒤 5초를 기다린다. fixedRate 5초의 목표는 0·5·10초이며 실제로는 자원 부족으로 늦어질 수 있다.
2. 아니다. 스케줄 메서드의 반환이 기준이라 실제 작업이 실행 중인 동안 다음 제출이 들어올 수 있다. 실제 업무 완료를 추적해야 한다.
3. 아니다. 두 gate는 메모리를 공유하지 않는다. 공유 조정이 필요하고 날짜별 결과는 DB 유일 키·트랜잭션 등으로 보호한다.
4. 이전 실행이 계속되는 동안 다른 서버가 잠금을 얻어 함께 실행할 수 있다. 만료·갱신 정책을 검토하고 업무 키·조건부 갱신·외부 멱등성으로 결과를 보호해야 한다.
5. 아니다. 기본 예약은 과거 업무를 영구 큐에 보관하지 않는다. 미완료 날짜를 이력에서 찾아 복구할 별도 흐름이 필요하다.

</details>
