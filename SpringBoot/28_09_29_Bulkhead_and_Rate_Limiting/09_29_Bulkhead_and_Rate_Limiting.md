# Bulkhead·Rate Limiter: 외부 호출의 동시 실행 수와 요청량 제어하기

- 🎯 글의 목표: 동시 실행 수와 시간당 호출량을 구분하고, 외부 서비스별 제한을 Spring Boot 호출 경계에 적용하며 거절·재시도·다중 서버 상황을 설명한다.
- 🧩 핵심 키워드: Concurrency, Bulkhead, Semaphore, Thread Pool, Bounded Queue, Rate Limiter, Permit, Local/Global Limit
- ⭐ 중요도: ★★★★★ — 느린 외부 호출이 쌓이는 속도와 외부 업체가 허용하는 요청량은 서로 다르므로 각각 보호 기준이 필요하다.
- 📝 한눈에 보는 내용: 상품 조회 지연 상황에서 출발해 동시성·요청률을 비교한다. Bulkhead의 자리 제한과 Rate Limiter의 주기별 허가를 익히고, Java 예제로 적용 순서·자원 반환·실패 분류·서버 여러 대의 합산 문제를 연결한다.
- 🔗 관련 주제: [이전 노트 — timeout·재시도·circuit breaker](../27_09_28_Timeouts_Retries_and_Circuit_Breakers/09_28_Timeouts_Retries_and_Circuit_Breakers.md), [RestClient와 외부 HTTP 연동](../13_09_09_External_HTTP_API_and_RestClient/09_09_External_HTTP_API_and_RestClient.md)
- 🧱 선수 지식: Java 메서드·예외·람다, Spring Bean과 생성자 주입, HTTP 호출과 timeout

> 기준일: 2026-09-29. Java 21을 사용하는 기존 Spring Boot 실습 프로젝트와 Resilience4j 2.3.0 core API를 기준으로 작성했다. 2.3.0은 예제 기준 버전이며 최신 버전이라는 뜻은 아니다. 아래 Java는 기존 프로젝트에 추가하는 파일·일부 호출 코드다. 공식 문서와 해당 버전 소스를 대조했으며, 현재 작업 환경의 PATH에서 Java·javac·Maven을 찾지 못해 컴파일·Spring 실행·부하 테스트는 수행하지 않았다. 결과 표는 예상 동작이다.

## 1. 들어가며

상품 목록을 보여 주는 우리 API가 외부 상품 서버에서 정보를 가져온다고 하자. 평소에는 응답이 100ms 안에 오지만, 어느 순간 같은 요청이 2초씩 걸리기 시작한다. 요청 수가 그대로여도 이전 요청이 끝나기 전에 새 요청이 도착하므로 기다리는 작업이 많아진다.

이전 노트에서는 timeout으로 기다림을 끝내고, 재시도로 일시 실패를 복구하고, circuit breaker로 반복 실패를 감지했다. Circuit breaker는 최근 결과를 보고 호출 허용 여부를 결정하는 회로 차단기다. 아직 실패 결과가 충분히 쌓이지 않은 동안에도 많은 호출이 동시에 들어갈 수 있다.

이번에는 “지금 실행 중인 상품 조회를 최대 몇 개 허용할 것인가?”와 “일정 시간에 상품 서버로 몇 번 호출할 것인가?”를 다룬다. **Bulkhead는 동시 실행 수를, Rate Limiter는 시간 구간의 호출 허가량을 제어**한다. 동기식 RestClient 앞에 두 장치를 연결하는 범위에 집중하며, 여러 서버가 공유하는 제한 저장소 구현은 후속 과제로 남긴다.

## 2. 핵심 개념 정리

외부 호출을 시작하기 전에는 먼저 실행할 자리와 호출량 예산이 남아 있는지 판단할 수 있다. 아래 그림은 이 노트의 예제 순서다. 두 제한 장치의 대기 시간을 모두 0으로 두므로 자리가 없거나 호출량을 소진하면 바로 거절한다.

```text
우리 Service
  → Bulkhead: 동시에 실행할 자리가 있는가?
      └─ 없음: 로컬 포화로 거절
  → Rate Limiter: 이번 주기의 호출 허가가 남았는가?
      └─ 없음: 로컬 호출량 소진으로 거절
  → timeout이 설정된 RestClient
  → 외부 상품 API
  → 성공/실패와 관계없이 Bulkhead 자리 반환
```

본문에서는 먼저 “자리”와 “주기별 허가”의 차이를 수치로 확인한다. 이어서 실제 실행 thread를 누가 맡는지, 기다릴 요청을 얼마나 보관할지, 재시도 때 어느 제한을 다시 통과할지 살펴본다. 마지막으로 같은 설정을 서버 여러 대에 복제했을 때 전체 한도가 어떻게 달라지는지 연결한다.

## 3. 본문 정리

### 3.1 동시성은 현재 개수, 요청률은 시간당 개수다

**동시성(concurrency)**은 같은 시점에 아직 끝나지 않은 작업 수다. 상품 API 호출 4개가 응답을 기다리는 중이면 해당 경계의 동시성은 4다. **요청률(request rate)**은 단위 시간에 들어오거나 시작되는 요청 수다. 초당 20번 호출하면 20 requests/second, 줄여서 20 RPS라고 표현한다.

같은 20 RPS라도 한 호출이 0.1초 걸릴 때와 2초 걸릴 때 필요한 동시 처리량은 다르다. 안정적으로 흐르는 시스템에서 같은 측정 경계를 사용하면 평균 동시 작업 수는 다음 관계로 추정할 수 있다.

```text
평균 동시 작업 수 ≈ 초당 처리량 × 평균 작업 시간

20건/초 × 0.1초 = 평균 2건
20건/초 × 2.0초 = 평균 40건
```

이 관계는 AWS의 [Lambda 동시성 설명](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html)에서도 요청률과 처리 시간으로 설명한다. 여기서는 같은 관계를 외부 호출 경계에 적용해 생각한다. 도착 요청이 계속 밀리는 과부하 상태나 순간 최대치를 이 평균 식 하나로 예측할 수는 없다.

| 제한 | 질문 | 예시에서의 의미 |
| --- | --- | --- |
| 동시 실행 최대 4개 | 지금 몇 개까지 점유하게 할 것인가? | 느려져도 보호된 호출이 한 인스턴스에서 4개를 넘지 않게 한다. |
| 주기 1초당 허가 20개 | 이 주기에 몇 번 진입시킬 것인가? | 응답이 빨라도 호출 시작 횟수를 계속 늘릴 수 없게 한다. |
| HTTP timeout 2초 | 한 번의 기다림을 어디까지 허용할 것인가? | 이미 허용된 호출의 전송 대기를 제한한다. |

호출이 2초 걸리고 동시 실행을 4개로 제한했다면, 계속 가득 찬 상태에서 대략 초당 2개가 끝날 수 있다. 주기당 허가를 20개로 설정해도 실제 처리량이 자동으로 20 RPS가 되는 것은 아니다. 느린 처리 단계와 동시 실행 한도가 함께 영향을 준다.

⚠️ 주의: 평균값으로 잡은 한도를 운영 정답으로 사용하지 않는다. 긴 지연, 순간 유입, 호출별 비용과 다른 작업에 남겨 둘 자원을 부하 관찰로 확인한다.

### 3.2 Semaphore Bulkhead: 정해진 자리만 빌려 주기

**Bulkhead**는 한 작업군이 자원을 독점하지 못하게 나누는 패턴이다. 배 안의 격벽처럼 상품 조회가 포화되어도 다른 기능에 쓸 자원을 남기려는 목적이다. 다만 메모리·CPU·HTTP 연결을 모두 자동으로 물리 분리하는 기능은 아니며, 무엇을 제한할지는 구현과 배치에 달려 있다.

**Semaphore(세마포어)**는 사용할 수 있는 허가 수를 관리하는 동기화 도구다. 허가를 한 개 얻고 작업을 시작한 뒤 끝나면 반환한다. **Thread(스레드)**는 프로그램의 코드를 실행하는 흐름이며, 예를 들어 요청을 처리하던 thread가 외부 조회 코드까지 실행할 수 있다.

세마포어 방식의 Bulkhead는 호출자의 thread에서 작업을 실행하면서 동시에 진입한 작업 수를 제한한다. 별도의 실행 thread를 만들어 주지는 않는다.

Resilience4j는 세마포어 방식과 thread pool 방식을 제공한다. 세마포어 방식의 주요 설정은 동시 허용 수인 `maxConcurrentCalls`와 포화 시 자리를 기다리는 최대 시간인 `maxWaitDuration`이다. [공식 Bulkhead 문서](https://resilience4j.readme.io/docs/bulkhead)

이 노트의 설계 예시는 상품 조회 자리 4개와 대기 시간 0이다.

```text
요청 A·B·C·D: 각자 자리 1개 확보 → 총 4개 점유
요청 E: 빈자리가 없으므로 즉시 거절
요청 B 완료: 자리 1개 반환
요청 F: 반환된 자리를 확보해 실행
```

여기서 A~D가 서로 다른 thread에서 호출되어야 실제 동시성을 관찰할 수 있다. 요청을 한 thread에서 순서대로 실행하면 매번 이전 자리가 이미 반환되므로 동시 제한을 재현하지 못한다.

⚠️ 주의: 자리 획득을 직접 구현하고 성공 경로에서만 반환하면 예외 때 자리가 누수된다. 2.3.0의 `Bulkhead.decorateSupplier`는 실제 호출을 `try/finally`로 감싸 완료 시 자리를 반환한다. 직접 획득 API를 사용할 때도 같은 수명 관리를 보장해야 한다. [해당 버전 Bulkhead 소스](https://github.com/resilience4j/resilience4j/blob/v2.3.0/resilience4j-bulkhead/src/main/java/io/github/resilience4j/bulkhead/Bulkhead.java)

상품 조회와 결제 승인이 하나의 Bulkhead를 공유하면 상품 요청이 모든 자리를 사용할 수 있다. 예를 들어 `catalog`, `payment`처럼 보호하려는 의존성·업무 단위로 나눈다. 사용자마다 무제한으로 새로운 객체를 만드는 방식은 메모리와 관리 비용도 함께 늘리므로 범위 설계가 필요하다.

### 3.3 Thread-pool Bulkhead와 유한한 대기열

**Thread pool**은 작업을 실행할 thread들을 관리하는 실행기다. Thread-pool Bulkhead는 외부 작업을 별도 pool로 보내고, 실행 중인 작업 외에 대기열에 넣을 작업 수도 제한한다. **Bounded queue**는 보관할 수 있는 작업 수가 정해진 대기열을 뜻한다.

| 방식 | 실제 실행 위치 | 포화 시 고려할 대상 |
| --- | --- | --- |
| Semaphore Bulkhead | 호출자의 실행 흐름 | 허가 대기 중인 호출자와 이미 실행 중인 작업 |
| Thread-pool Bulkhead | 별도로 관리하는 작업 thread | pool의 실행 중 작업, queue의 대기 작업, 넘친 요청 |

예를 들어 core·maximum thread 수를 모두 4, queue 크기를 8로 고정했다고 하자. 첫 4개가 계속 실행 중이고 아무도 끝나지 않았다면 8개를 더 대기시킬 수 있다. 13번째 제출은 실행 자리와 queue가 모두 차서 거절될 수 있다. 이 수치는 해당 조건을 가정한 설명이며, 동시에 작업이 끝나면 관찰 결과가 달라진다.

Queue 크기를 무한히 늘리면 거절이 줄어 보이지만 메모리 사용량과 대기 시간이 커진다. 일반적인 Java thread pool에서도 queue 종류와 크기는 작업 수용 및 거절 동작을 바꾼다. [JDK ThreadPoolExecutor 문서](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)

이전 노트의 **deadline**, 즉 업무 전체의 완료 기한에는 queue 대기도 포함되어야 한다. 별도 thread로 넘기더라도 호출자가 즉시 `join()`으로 결과를 기다리면 호출자 역시 대기한다. 비동기 결과를 반환했다는 이유만으로 요청 처리 전체가 비차단 방식으로 바뀌지는 않는다.

⚠️ 주의: thread가 바뀌면 thread에 묶인 transaction이나 로그 문맥이 자동으로 따라간다고 가정하지 않는다. 작업을 제출하는 시점과 실제 실행 시점을 나누어 보고, 요청 식별자 전달과 transaction 시작 위치를 확인한다.

### 3.4 Rate Limiter: 주기별 호출 허가를 소비하기

**Rate Limiter**는 시간 기준으로 호출 허가량을 제한하는 장치다. **Permit**은 호출 진입을 허용하는 한 단위의 권한이다. Bulkhead의 자리는 작업이 끝나면 반환되지만, 이 예제의 Rate Limiter permit은 호출 후 즉시 되돌려 받는 자리가 아니다. 다음 갱신 주기가 와야 새 예산이 생긴다.

Resilience4j 기본 구현은 시간을 주기로 나누어 허가량을 갱신한다. 아래 세 속성의 의미를 먼저 구분한다. [공식 RateLimiter 문서](https://resilience4j.readme.io/docs/ratelimiter)

| 설정 | 의미 | 이번 예시 값 |
| --- | --- | --- |
| `limitForPeriod` | 한 갱신 주기에 사용할 허가 수 | 20 |
| `limitRefreshPeriod` | 허가를 갱신하는 시간 간격 | 1초 |
| `timeoutDuration` | 호출 허가를 얻기 위해 기다릴 최대 시간 | 0 |

`timeoutDuration`은 HTTP 응답 timeout이 아니다. 허가가 없을 때 얼마나 기다릴지 정한다. 0이면 기다리지 않고 `RequestNotPermitted`로 거절한다. HTTP client의 연결·응답 timeout은 여전히 별도 설정이 필요하다.

“주기당 20개”가 “50ms마다 한 개씩 균일하게 전송”을 뜻하지는 않는다. 다음은 주기 경계 주변에서 가능한 허가 소비를 설명한 가상 예다.

```text
주기 A 종료 10ms 전: 남아 있던 20개 허가를 빠르게 소비
주기 B 시작 10ms 후: 새로 생긴 20개 허가를 빠르게 소비
→ 짧은 20ms 구간에 최대 40개가 몰릴 수 있음
```

이 예시는 Rate Limiter만 보고 계산한 가능성이다. 함께 둔 Bulkhead, 실제 실행 시간, thread 수에 따라 실제 호출은 줄어든다. 외부 업체가 “어떤 연속 1초 구간에서도 20개 이하”를 요구한다면 단순 주기 설정과 같은 계약인지 확인해야 한다.

⚠️ 주의: provider, 즉 외부 API 제공자의 제한이 계정별인지 API key별인지, 일정 주기 기준인지 연속 시간 구간 기준인지 확인한다. 숫자만 같아도 집계 범위와 순간 몰림 허용량이 다르면 계약을 지키지 못할 수 있다.

### 3.5 Java 코드로 두 제한을 한 호출에 적용하기

이 예제는 Resilience4j core API를 직접 조합한다. **Decorator**는 원래 함수를 다른 함수로 감싸 실행 전후에 기능을 추가하는 방식이다. Java의 `Supplier<T>`는 인자 없이 실행해 `T` 타입 값을 반환하는 함수 계약이며, 여기서는 외부 조회 한 번을 감쌀 때 사용한다.

#### 3.5.1 준비 조건과 의존성

기존 Java 21·Spring Boot Gradle 프로젝트가 준비되어 있다고 가정한다. 다음은 그 프로젝트의 `build.gradle`에 병합할 **일부 설정**이다. 아래 두 모듈은 같은 2.3.0 버전을 사용하며, 기본 Spring Boot 의존성·plugin·repository 설정은 기존 프로젝트가 제공한다.

```groovy
dependencies { // 기존 dependencies 블록에 아래 두 항목을 추가한다.
    implementation 'io.github.resilience4j:resilience4j-bulkhead:2.3.0' // 동시 진입 제한 core API를 추가한다.
    implementation 'io.github.resilience4j:resilience4j-ratelimiter:2.3.0' // 주기별 호출 허가 core API를 추가한다.
}
```

이번 방식은 annotation·starter 자동 설정을 사용하지 않는다. 공식 Spring Boot 통합 가이드는 Boot 2·3 starter를 설명하므로, Boot 4에 annotation 방식을 추가할 때는 별도로 지원 조합을 확인한다. Core 객체를 직접 만드는 아래 코드에 YAML을 적는 것만으로 설정이 자동 반영되는 것은 아니다. [2.3.0 릴리스](https://github.com/resilience4j/resilience4j/releases/tag/v2.3.0), [Spring Boot 통합 가이드](https://resilience4j.readme.io/docs/getting-started-3)

#### 3.5.2 CatalogCallGuard.java

파일 위치는 `src/main/java/com/example/catalog/CatalogCallGuard.java`다. 입력은 “실제로 한 번 실행할 함수”, 결과는 그 함수의 반환값이다. 이 클래스는 HTTP 요청을 직접 만들지 않고 진입 조건을 관리한다.

```java
package com.example.catalog; // 상품 연동 코드와 같은 package에 둔다.

import io.github.resilience4j.bulkhead.Bulkhead; // 동시에 실행할 자리를 관리한다.
import io.github.resilience4j.bulkhead.BulkheadConfig; // Bulkhead의 허용 수와 대기를 설정한다.
import io.github.resilience4j.ratelimiter.RateLimiter; // 주기별 호출 허가를 관리한다.
import io.github.resilience4j.ratelimiter.RateLimiterConfig; // 허가 수·갱신 주기·대기를 설정한다.
import java.time.Duration; // 시간 단위를 명시적으로 표현한다.
import java.util.function.Supplier; // 나중에 실행할 반환값 있는 함수를 받는다.

public final class CatalogCallGuard { // 외부 상품 조회의 진입 정책을 한 객체에 모은다.
    private final Bulkhead bulkhead; // 모든 상품 요청이 공유할 동시 실행 한도다.
    private final RateLimiter rateLimiter; // 모든 상품 요청이 공유할 주기별 허가량이다.

    public CatalogCallGuard() { // Spring Bean 생성 시 한 번만 정책 객체를 준비한다.
        BulkheadConfig bulkheadConfig = BulkheadConfig.custom() // 동시성 정책을 구성한다.
                .maxConcurrentCalls(4) // 이 객체를 통과한 호출을 최대 4개까지 동시에 허용한다.
                .maxWaitDuration(Duration.ZERO) // 자리가 없으면 호출자를 기다리게 하지 않는다.
                .build(); // 변경 불가능한 설정을 완성한다.
        bulkhead = Bulkhead.of("catalog", bulkheadConfig); // 상품 조회들이 공유할 Bulkhead를 만든다.

        RateLimiterConfig rateConfig = RateLimiterConfig.custom() // 호출량 정책을 구성한다.
                .limitForPeriod(20) // 갱신 주기마다 허가를 20개 제공한다.
                .limitRefreshPeriod(Duration.ofSeconds(1)) // 허가량의 갱신 주기를 1초로 잡는다.
                .timeoutDuration(Duration.ZERO) // 허가가 없으면 즉시 거절한다.
                .build(); // 호출량 설정을 완성한다.
        rateLimiter = RateLimiter.of("catalog", rateConfig); // 상품 조회용 Rate Limiter를 만든다.
    }

    public <T> T execute(Supplier<T> remoteCall) { // 동기식 외부 호출 한 번을 함수로 받는다.
        Supplier<T> rateChecked = RateLimiter.decorateSupplier( // 먼저 안쪽 wrapper를 준비한다.
                rateLimiter, remoteCall); // 허가를 얻은 경우에만 원래 함수를 실행한다.
        Supplier<T> guarded = Bulkhead.decorateSupplier( // 그 바깥에서 동시 실행 자리를 확인한다.
                bulkhead, rateChecked); // 실제 실행 순서는 Bulkhead → Rate Limiter → 원래 함수다.
        return guarded.get(); // 지금 실행하고 원래 반환값 또는 발생한 예외를 전달한다.
    }
}
```

Decorator를 만드는 두 줄은 외부 요청을 아직 실행하지 않는다. 마지막 `get()`에서 바깥 wrapper부터 들어간다. Rate Limiter가 거절하거나 실제 호출이 예외를 던져도, 이미 얻은 Bulkhead 자리는 바깥 decorator의 완료 처리로 반환된다. 이 반환 동작과 Supplier 감싸기 API는 [Bulkhead 2.3.0 소스](https://github.com/resilience4j/resilience4j/blob/v2.3.0/resilience4j-bulkhead/src/main/java/io/github/resilience4j/bulkhead/Bulkhead.java)와 [RateLimiter 2.3.0 소스](https://github.com/resilience4j/resilience4j/blob/v2.3.0/resilience4j-ratelimiter/src/main/java/io/github/resilience4j/ratelimiter/RateLimiter.java)에서 확인할 수 있다.

#### 3.5.3 Spring Bean으로 한 번 등록하기

다음은 `src/main/java/com/example/catalog/CatalogGuardConfiguration.java` 파일이다. Spring이 설정·컴포넌트 클래스를 찾는 **component scan** 범위에 이 package가 포함되어 있어야 한다. Spring이 생성하고 관리하는 객체인 **Bean**으로 등록해 요청들이 같은 한도를 공유하게 한다.

```java
package com.example.catalog; // Guard와 같은 package를 사용한다.

import org.springframework.context.annotation.Bean; // 메서드 반환 객체를 Bean으로 등록한다.
import org.springframework.context.annotation.Configuration; // Spring 설정 클래스임을 표시한다.

@Configuration(proxyBeanMethods = false) // Bean 간 직접 메서드 호출이 없는 설정이다.
public class CatalogGuardConfiguration { // 상품 호출 정책의 생명주기를 Spring에 맡긴다.
    @Bean // 기본 singleton 범위로 하나의 객체를 공유한다.
    CatalogCallGuard catalogCallGuard() { // Service가 주입받을 Bean을 제공한다.
        return new CatalogCallGuard(); // 애플리케이션 구성 시 정책 객체를 생성한다.
    }
}
```

다음은 기존 Service 메서드 안에 넣는 **일부 코드**다. `guard`는 위 Bean, `catalogRestClient`는 이전 RestClient 노트처럼 timeout과 승인된 기본 주소를 설정한 Bean을 생성자로 주입받았다고 가정한다. 상품 API의 실제 응답 형식에 종속되지 않도록 여기서는 JSON 본문을 문자열로 받는다.

```java
String json = guard.execute(() -> catalogRestClient.get() // 두 진입 제한을 통과한 뒤 GET 요청을 실행한다.
        .uri("/products/{id}", 42) // 예시 상품 번호 42를 URI 변수로 넣는다.
        .retrieve() // HTTP 상태를 확인하며 응답 처리를 준비한다.
        .body(String.class)); // 받은 본문 문자열을 guard의 반환값으로 돌려준다.
```

예상 동작은 다음과 같다. 이 표는 외부 서버에서 실제 요청을 실행한 결과가 아니다.

| 시작 시 조건 | HTTP 호출 | 호출자가 받는 결과 |
| --- | --- | --- |
| 자리와 호출 허가가 남음, HTTP 200 | 수행 | 서버가 돌려준 본문 문자열 |
| 이미 4개의 보호된 호출이 실행 중 | 수행하지 않음 | `BulkheadFullException` |
| 자리는 있지만 주기별 허가 소진 | 수행하지 않음 | `RequestNotPermitted`, 확보했던 자리 반환 |
| 진입 허용 후 HTTP timeout | 수행을 시도함 | HTTP client의 예외, 확보했던 자리 반환 |

⚠️ 주의: Service 메서드 안에서 요청마다 `new CatalogCallGuard()`를 만들면 매번 빈 자리와 새 허가량으로 시작해 요청 전체를 제한하지 못한다. 같은 이름의 `Bulkhead.of("catalog", ...)`를 여러 번 호출해도 이름만으로 같은 인스턴스가 되는 것은 아니다. 이 예제는 공유 Bean으로 그 문제를 막는다.

⚠️ 주의: 이 `execute`는 함수가 반환될 때 호출이 끝나는 **동기식 작업 전용**이다. 실제 작업이 끝나기 전에 `CompletableFuture`만 반환하는 함수를 넣으면 자리가 너무 빨리 반환될 수 있다. 비동기 작업에는 완료 시점까지 자리를 유지하는 `decorateCompletionStage` 등 해당 실행 모델의 API가 필요하다.

### 3.6 적용 순서가 대기 위치와 허가 소비를 바꾼다

위 예제는 `Bulkhead(RateLimiter(call))` 순서다. 자리가 없으면 호출량 허가를 소비하지 않으며, 자리가 있으면 Rate Limiter가 즉시 허가 여부를 판단한다. 실제 실행 전에 두 조건을 확인하지만 이를 하나의 원자적인 획득 연산으로 묶은 것은 아니다.

| 순서 | 먼저 확보하는 것 | 선택 시 살펴볼 점 |
| --- | --- | --- |
| Bulkhead → Rate Limiter → 호출 | 동시 실행 자리 | Rate Limiter가 기다리도록 바뀌면 대기 중에도 자리를 점유한다. |
| Rate Limiter → Bulkhead → 호출 | 시간당 호출 허가 | Bulkhead에서 거절되어 외부 호출을 못 해도 허가가 이미 소비될 수 있다. |

이번에는 두 대기를 0으로 두고 첫 번째 순서를 택했다. 이는 예제의 설계 판단이다. 긴 대기를 추가하려면 “무엇을 잡은 채 어디서 기다리는지”부터 다시 점검한다.

예를 들어 전체 deadline이 1초인데 허가 대기 600ms, 연결 풀 대기 300ms, 실제 HTTP 호출 500ms를 각각 허용하면 전체 예산과 맞지 않는다. 같은 작업에 semaphore, queue, 연결 pool 등 여러 대기 지점을 겹칠 때는 각 대기를 측정하고 남은 기한을 반영한다.

**Connection pool**은 재사용할 네트워크 연결들을 관리하는 집합이다. Bulkhead가 4개의 호출을 허용해도 client pool이 필요한 연결을 2개밖에 내주지 못하면 일부는 그 안에서 기다릴 수 있다. HTTP/2처럼 한 연결에 여러 요청을 처리하는 방식도 있으므로 연결 개수와 동시 호출 수를 항상 1:1로 보지 않는다.

### 3.7 재시도도 호출량을 사용한다

이전 노트의 **retry**는 같은 논리 요청을 다시 실행하는 것이다. 외부 서버 입장에서는 재시도 한 번도 새 요청이므로, provider 호출량을 보호하려면 최초 시도뿐 아니라 각 재시도가 제한을 통과해야 한다.

```text
Retry
  ├─ 시도 1: Bulkhead → Rate Limiter → HTTP
  ├─ backoff: 앞 시도의 자리는 반환된 상태에서 대기
  └─ 시도 2: Bulkhead → Rate Limiter → HTTP
```

반대로 Rate Limiter 바깥에서 한 번만 허가를 얻고 그 안에서 여러 번 retry하면 실제 외부 호출 수를 과소 집계한다. Bulkhead가 retry와 backoff 전체를 감싸면 원격 호출을 하지 않는 대기 중에도 자리를 점유한다. 이 동작이 필요한 업무도 있지만 어떤 시간을 보호하는지 명시해야 한다.

⚠️ 주의: `BulkheadFullException`과 `RequestNotPermitted`는 로컬 제한에 의한 거절이다. 즉시 재시도하면 포화된 장치에 요청을 다시 밀어 넣는다. 일반적인 자동 retry 대상에서 제외하고, circuit breaker를 바깥에 둘 경우에도 원격 장애율에 이 예외들을 섞을지 명시적으로 결정한다. breaker OPEN 거부인 `CallNotPermittedException`도 무조건 재시도하지 않는다.

외부 호출 한 번이 내부적으로 다른 HTTP 호출들을 더 만드는 경우에는 이 Guard가 감싼 단위와 provider가 세는 단위를 대조한다. “Service 메서드 호출 1회”와 “네트워크 요청 1회”가 다를 수 있다.

### 3.8 서버 여러 대의 로컬 제한은 전체 제한과 다르다

**로컬 제한**은 한 프로세스 안의 객체가 관리하는 한도다. **전역 제한**은 같은 API key 등을 공유하는 여러 서버의 호출을 합쳐 관리하는 한도다. 정책 객체를 이름으로 등록하고 찾는 관리소를 **registry**라고 하며, Resilience4j의 기본 registry는 프로세스 메모리 안에 있다. 다음 합산은 각 서버가 독립된 객체를 가진다는 가정의 설계 계산이다.

```text
서버 A: 동시 4개, 자기 주기당 20개 허가
서버 B: 동시 4개, 자기 주기당 20개 허가
서버 C: 동시 4개, 자기 주기당 20개 허가
합산: 동시 최대 12개, 명목 호출 허가량은 초당 총 60개 수준
```

주기 경계에서의 순간 몰림까지 생각하면 이것도 엄격한 연속 1초 제한을 뜻하지 않는다. 외부 업체가 계정 전체 20 RPS만 허용한다면 각 서버를 20으로 설정하는 방식으로는 계약을 지키지 못한다.

해결 방향으로는 서버별 예산을 나누거나, 공통 gateway에서 요청을 제어하거나, 공유 저장소에서 원자적으로 허가를 차감하는 방식이 있다. **원자적 차감**은 여러 서버가 동시에 확인하더라도 하나의 일관된 연산으로 잔여량을 갱신한다는 뜻이다. 공유 저장소의 장애 때 거절할지 제한적으로 허용할지도 함께 결정해야 한다.

⚠️ 주의: 서버 수가 자동으로 늘어나는데 서버당 예산을 고정하면 전체 허가량도 늘어난다. 배포 중 구·신 버전이 함께 실행되는 순간과 서버 재시작으로 로컬 상태가 초기화되는 경우도 계산에 포함한다.

### 3.9 거절을 사용자 응답으로 바꾸는 기준

제한 장치의 예외가 곧 HTTP status인 것은 아니다. 우리 API가 누구의 어떤 한도를 적용했는지 보고 응답 의미를 정한다.

| 상황 | 응답 정책 예시 | 의미 |
| --- | --- | --- |
| 특정 사용자의 우리 API 호출량 초과 | 429 Too Many Requests | 해당 호출자의 요청량 제한 |
| 외부 의존성용 Bulkhead 포화 | 503 Service Unavailable 등 계약된 일시 불가 응답 | 우리 서비스가 지금 처리할 여력이 부족함 |
| 외부 업체 계정 전체 허가량 소진 | 서비스 계약에 따른 일시 불가·대기 상태 | 특정 사용자 개인의 과다 호출로 단정하지 않음 |
| 외부 업체가 429 반환 | provider 안내와 우리 API 계약을 함께 해석 | 외부 제한 사유·재시도 기한이 우리 응답에 그대로 맞는지 판단 |

429는 정해진 시간에 너무 많은 요청을 보낸 경우를 나타내며, 응답에 `Retry-After`를 포함할 수 있다. `Retry-After`는 다시 요청하기 전에 기다릴 시간을 안내하는 헤더다. 위 표의 503 선택은 이 예제의 응답 설계 제안이며 자동 매핑 규칙이 아니다. [RFC 6585 §4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4)

이전 노트의 **fallback**은 원래 기능이 어려울 때 제공하는 대체 응답이다. 상품 추천이라면 오래된 캐시를 허용할 수 있지만, 재고·결제 결과를 빈 값이나 성공으로 바꾸면 업무를 잘못 처리할 수 있다. 캐시는 이전 결과를 저장해 재사용하는 방식이며, 허용할 최신성 기준은 별도의 설계가 필요하다.

⚠️ 주의: 라이브러리 예외를 모두 잡아 200과 빈 목록을 반환하면 “상품이 없음”과 “호출을 시작하지 못함”이 섞인다. 정상 부재, 로컬 거절, 외부 실패를 구별해 사용자 응답과 로그에 반영한다.

### 3.10 무엇을 관찰하고 어떻게 확인할 것인가

**In-flight 호출**은 시작했지만 아직 끝나지 않은 호출이다. 성공률뿐 아니라 이 값과 대기·거절을 함께 봐야 한도가 도움이 되는지 판단할 수 있다.

| 관찰 대상 | 확인할 질문 |
| --- | --- |
| Bulkhead 사용 자리·거절 수 | 실행이 느려져 자리가 오래 점유되는가? |
| Rate Limiter 허가 실패·대기 | 호출량 한도가 지속적으로 부족한가? |
| Pool의 실행 수·queue 깊이 | 외부 호출 전부터 대기가 쌓이는가? |
| 실제 HTTP 시도 수·retry 수 | 논리 요청보다 실제 요청이 얼마나 증가했는가? |
| 전체 응답 지연·timeout | 진입 대기를 줄였는데도 느린 다른 구간이 있는가? |
| 서버 수·provider 전체 429 | 로컬 설정 합계가 외부 계약을 넘는가? |

Core 객체를 직접 Bean으로 만든 예제에는 Actuator metric 자동 등록 코드가 포함되어 있지 않다. 운영에서 관찰하려면 event listener나 metrics 연동을 추가해야 한다. 지원되는 starter 구성에서는 관련 통합 기능을 사용할 수 있지만, 의존성 추가만으로 이 예제 객체까지 자동 수집된다고 가정하지 않는다.

아래는 실습 프로젝트에서 확인할 검증 계획이며 이번 TIL 작업에서 실행한 테스트는 아니다.

| 검증 시나리오 | 기대하는 관찰 |
| --- | --- |
| 4개 호출을 완료시키지 않은 채 5번째 호출 | 5번째 원격 함수는 실행되지 않고 Bulkhead 거절 |
| 점유 중인 호출 하나가 예외 종료 | 자리가 반환되어 다음 호출이 진입 가능 |
| Rate Limiter 거절을 반복 | Bulkhead 잔여 자리가 줄어든 채 남지 않음 |
| 한 주기의 허가량 모두 소진 | 새 허가가 생기기 전에는 원격 함수 미실행 |
| retry가 두 번 실제 HTTP를 수행 | 각 시도가 허가를 확인하고 backoff 중 자리를 잡지 않음 |
| 공유 Bean 대신 매 요청 새 객체 생성 | 제한이 무력화되는 잘못된 구성을 탐지 |
| 독립 Guard 두 개를 사용하는 서버 모델 | 각자의 한도가 따로 적용됨을 확인 |

동시성 실습에서는 `CountDownLatch`처럼 특정 지점 도착·진행을 맞추는 동기화 도구로 4개 호출을 붙잡은 뒤 5번째를 보낸다. 임의로 몇 ms 잠들게 하는 `sleep`만으로 순서를 보장하지 않는다. 호출량 정책의 업무 테스트는 시간과 허가 결과를 제어할 수 있는 대역을 사용하고, 실제 라이브러리의 갱신 경계·동시 실행은 별도 통합 테스트로 확인한다.

## 4. 적용 관점에서 다시 보기

상품 API가 느려지면서 우리 요청도 밀린다면, 다음 순서로 본문에서 배운 기준을 적용한다.

1. **제한할 경계를 정한다.** 상품 조회와 결제를 분리하고, 한 논리 요청이 실제 HTTP를 몇 번 만드는지 확인한다.
2. **동시성과 호출량을 별도로 계산한다.** 처리 시간·자원 여유로 Bulkhead 후보를 정하고, provider 계약으로 Rate Limiter의 단위·주기·범위를 정한다.
3. **대기 위치를 정한다.** 즉시 거절 또는 제한된 대기를 택하되 queue·pool·HTTP 대기가 전체 deadline 안에 들어가는지 본다.
4. **객체와 호출 순서를 확인한다.** 공유 Bean을 사용하고, 자리 반환 시점과 retry마다 허가를 얻는 위치를 확인한다.
5. **거절 응답을 정한다.** 사용자별 한도 초과인지 서비스 수용량 부족인지 나눠 429·일시 불가·업무상 허용된 fallback을 선택한다.
6. **여러 서버를 합산해 관찰한다.** 서버 수 변화, provider 전체 요청량, 로컬 거절과 실제 HTTP 오류를 함께 확인한다.

Rate Limiter 거절만 많으면 시간당 예산이 부족한지 살펴본다. Bulkhead 거절과 호출 지연이 함께 오르면 먼저 원격 응답 지연과 내부 pool 대기를 확인한다. 두 수치를 보지 않고 한도만 올리면 외부 과부하나 우리 자원 점유를 키울 수 있다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

동시 실행 자리는 작업 종료 때 반환되지만 시간당 호출 허가는 같은 방식으로 반환되지 않는다. 호출 전후의 자원 수명을 기준으로 보면 두 장치를 함께 쓰는 이유와 적용 순서의 차이를 설명할 수 있다.

### 5.2 이전·다음 학습과의 연결

이전 timeout·retry·circuit breaker 노트에 호출 진입 한도를 더해 대기·재호출·동시 자원 사용을 연결했다. 다음에는 [Spring Cache와 Caffeine 로컬 캐시](../29_09_30_Spring_Cache_and_Caffeine/09_30_Spring_Cache_and_Caffeine.md)를 학습해 반복 조회 자체를 줄이는 방법과 저장한 결과의 최신성 기준을 살펴본다.

### 5.3 더 파볼 만한 주제

서버 전체가 공유하는 호출량 제한은 저장소의 원자적 연산과 장애 정책을 어떻게 설계해야 할까? 비동기 HTTP 호출에서는 취소·완료 시점까지 자리를 유지하는 방식이 어떻게 달라질지 확장할 수 있다.

### 5.4 참고 자료

- [Resilience4j Bulkhead](https://resilience4j.readme.io/docs/bulkhead): 세마포어·thread pool 방식과 설정 의미
- [Resilience4j RateLimiter](https://resilience4j.readme.io/docs/ratelimiter): 주기·허가량·허가 대기의 구분
- [Bulkhead 2.3.0 소스](https://github.com/resilience4j/resilience4j/blob/v2.3.0/resilience4j-bulkhead/src/main/java/io/github/resilience4j/bulkhead/Bulkhead.java): 동기·비동기 decorator의 완료 처리
- [RateLimiter 2.3.0 소스](https://github.com/resilience4j/resilience4j/blob/v2.3.0/resilience4j-ratelimiter/src/main/java/io/github/resilience4j/ratelimiter/RateLimiter.java): Supplier를 감쌀 때의 permit 획득
- [Resilience4j Spring Boot 통합](https://resilience4j.readme.io/docs/getting-started-3): 지원 starter·annotation 순서·metrics 연동
- [JDK 21 ThreadPoolExecutor](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html): queue·pool·거절 처리의 관계
- [AWS Lambda 동시성](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html): 요청률과 처리 시간으로 평균 동시성을 이해하는 예
- [RFC 6585 §4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4): 429 응답의 의미와 Retry-After 안내

## 6. 요약 정리

1. 동시성은 진행 중 작업 수이고 요청률은 시간당 호출 수다. 응답이 느려지면 같은 요청률에서도 더 많은 작업이 쌓일 수 있다.
2. Semaphore Bulkhead는 호출자 실행 흐름에서 자리를 관리하고, thread-pool 방식은 별도 실행기와 제한된 queue를 사용한다.
3. Bulkhead의 대기 시간과 Rate Limiter의 허가 대기는 HTTP timeout과 다르며 전체 deadline에 포함해야 한다.
4. 주기별 허가 갱신은 균일한 간격이나 엄격한 연속 시간 구간 제한을 자동 보장하지 않는다.
5. 정책 객체를 공유하고, 성공·예외·비동기 완료 등 모든 경로에서 자리 수명이 실제 작업 수명과 맞는지 확인한다.
6. Provider 호출량을 보호하려면 retry도 매번 허가를 확인해야 하며 로컬 거절을 무조건 재시도하지 않는다.
7. 서버별 로컬 한도는 서버 수만큼 합산될 수 있으므로 계정 전체 한도와 구분한다.
8. 거절 원인에 맞는 응답을 정하고, 사용 자리·호출량·queue·지연·서버 수를 함께 관찰한다.

🧠 기억할 것: **Bulkhead는 동시에 빌려 줄 자리를, Rate Limiter는 시간에 따라 사용할 호출 허가를 관리한다. 어디서 기다리고 언제 반환하며 누가 같은 한도를 공유하는지까지 정해야 제한이 실제로 작동한다.**

## 7. 미니 퀴즈 또는 체크리스트

1. 안정적인 20 RPS에서 평균 호출 시간이 0.1초에서 2초로 늘면 평균 동시 호출 수는 어떻게 달라지는가? Rate Limiter만으로 이 점유량이 고정되는가?
2. 예제의 Bulkhead 자리를 얻은 뒤 Rate Limiter가 거절했다. 외부 API가 실행되는지, 자리와 호출 허가는 각각 어떻게 되는지 설명하라.
3. 상품 조회 Service가 매 요청마다 Guard를 새로 만들면 왜 전체 동시 실행 수와 호출량을 제한하지 못하는가?
4. 서버 3대가 각각 동시 4개·주기당 20개를 허용한다. 계정 전체 20 RPS를 자동으로 지키는가? 또 주기당 20개가 50ms마다 한 개 전송을 뜻하는가?
5. retry 전체를 Bulkhead와 Rate Limiter 안에서 실행할 때 생길 수 있는 두 문제와, 로컬 거절을 즉시 재시도하면 안 되는 이유를 설명하라.

<details>
<summary>정답과 해설</summary>

1. 같은 측정 경계에서 평균 2개에서 40개로 늘어날 수 있다. Rate Limiter는 진입률을 제한하므로 오래 점유한 작업 수의 상한은 Bulkhead 등으로 따로 관리해야 한다.
2. 실제 외부 함수는 실행되지 않는다. 얻었던 Bulkhead 자리는 decorator의 완료 처리로 반환된다. 이 예제의 대기 0 설정에서 허가를 얻지 못한 요청은 Rate Limiter를 통과하지 못한다.
3. 요청마다 독립된 빈 자리와 호출량 예산을 가지므로 다른 요청의 점유·소비를 알지 못한다. 동일 대상의 요청들은 공유 Bean이나 같은 registry 인스턴스를 통한 정책 객체를 사용해야 한다.
4. 자동으로 지키지 않는다. 동시 최대 12개와 명목상 초당 총 60개 수준의 허가가 생길 수 있다. 주기별 허가는 짧은 시간에 몰릴 수 있으므로 균일 간격 전송과도 다르다.
5. Bulkhead가 backoff 중에도 자리를 잡고 있을 수 있고, Rate Limiter가 논리 요청 한 번만 세어 실제 재시도를 과소 집계할 수 있다. 로컬 거절은 현재 자원·허가 부족을 뜻하므로 즉시 반복하면 경쟁만 늘어난다.

</details>
