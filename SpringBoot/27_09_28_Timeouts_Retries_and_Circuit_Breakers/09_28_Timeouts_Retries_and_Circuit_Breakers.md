# timeout·재시도·circuit breaker: 외부 장애가 내 서비스로 번지지 않게 하기

- 🎯 학습 목표: 외부 HTTP 호출의 대기 시간을 제한하고, 안전한 실패만 정해진 budget 안에서 재시도하며, 장애가 지속될 때 circuit breaker로 호출을 잠시 차단한다.
- 🧩 핵심 키워드: Timeout, Deadline, Retry, Idempotency, Exponential Backoff, Jitter, Retry Budget, Circuit Breaker, Bulkhead, Resilience4j
- ⭐ 중요도: ★★★★★ — 원격 서비스는 느려지거나 응답을 잃을 수 있다. 기다림과 재시도를 제한하지 않으면 우리 서비스의 요청 처리 thread와 외부 호출량까지 함께 고갈될 수 있다.
- 📝 한눈에 보는 내용: 먼저 timeout을 HTTP 전송 팩터리에 설정하고 업무 전체 deadline을 별도로 생각한다. timeout 결과는 상대 작업의 실패 확정이 아니므로 멱등성을 확인한 뒤, 제한된 횟수·지수 backoff·jitter로 재시도한다. 장애율이 임계치를 넘으면 circuit breaker가 요청을 차단하고, 시간이 지난 뒤 일부 probe로 회복 여부를 확인한다.
- 🧱 선수 지식: [RestClient·외부 HTTP API 연동](../13_09_09_External_HTTP_API_and_RestClient/09_09_External_HTTP_API_and_RestClient.md), [멱등성 키와 중복 요청 방지](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md), [Saga와 보상 트랜잭션](../26_09_26_Saga_and_Compensating_Transactions/09_26_Saga_and_Compensating_Transactions.md)
- 🔗 이전 노트: [Saga와 보상 트랜잭션](../26_09_26_Saga_and_Compensating_Transactions/09_26_Saga_and_Compensating_Transactions.md)

> 정리 기준일: 2026-09-28. Spring Boot 4.1·Spring Framework 7.0 문서, Resilience4j 공식 문서, AWS Builders’ Library와 HTTP Semantics(RFC 9110)를 바탕으로 정리했다. 아래 Java/YAML은 동작 원리를 설명하는 실습용 예시이며 TIL 저장소에서 컴파일하거나 Spring Boot 테스트를 실행하지 않았다. Resilience4j 공식 Spring Boot 시작 문서는 현재 Boot 2·3 starter를 안내하므로, Boot 4 프로젝트에 그대로 복사하지 말고 선택한 Resilience4j 버전의 호환성을 먼저 확인한다.

## 1. 외부 서비스는 언젠가 느려지거나 응답을 잃는다

상품 API를 호출하는 서비스가 있다고 하자. 상대 서버가 정상일 때는 다음처럼 단순하다.

```text
우리 API 요청
  → 상품 조회 Service
  → CatalogClient가 외부 HTTP 요청
  → 외부 상품 API 응답
  → 우리 API 응답
```

하지만 외부 시스템이나 네트워크에 문제가 생기면 다음 상황이 서로 다르게 나타난다.

| 상황 | 우리 쪽에서 관찰한 결과 | 중요한 해석 |
| --- | --- | --- |
| 연결이 만들어지지 않음 | connect timeout 또는 연결 오류 | 요청이 상대 애플리케이션까지 도달하지 않았을 수도 있다. |
| 요청을 보냈지만 응답이 늦음 | read/response timeout | 상대가 아직 처리 중이거나 이미 완료했는데 응답만 늦을 수 있다. |
| 명시적인 HTTP 오류 응답 | 4xx·5xx와 응답 본문 | 상대가 어떤 상태로 응답했는지 알 수 있지만 업무상 의미는 따로 해석해야 한다. |
| 우리 서버가 호출을 중단함 | 호출자에게 timeout 예외 | 클라이언트가 기다리기를 멈춘 것일 뿐, 상대 작업의 취소·실패를 보장하지 않는다. |
| 반복 호출이 계속 실패 | timeout·연결 거절·서비스 오류 누적 | 계속 요청하면 상대의 회복을 늦추고 우리 자원도 점유할 수 있다. |

따라서 resilience 설계는 “실패하면 다시 호출한다” 한 문장으로 끝나지 않는다. **얼마나 기다릴지, 어떤 실패만 재시도할지, 몇 번까지 할지, 장애가 지속될 때 어떻게 빠르게 포기할지**를 함께 결정한다.

## 2. timeout은 하나가 아니라 여러 대기 경계다

### 2.1 네트워크 단계별 timeout

| 제한 | 무엇을 기다리는가? | 예시 |
| --- | --- | --- |
| Connection timeout | 새 네트워크 연결을 만들 때까지 | 서버 주소에 연결할 수 없는 상황 |
| Connection-pool acquire timeout | 재사용할 연결을 pool에서 얻을 때까지 | 모든 연결을 다른 요청이 사용 중인 상황 |
| Read/response timeout | 응답 데이터가 오기를 기다리는 시간 | 서버는 연결됐지만 응답이 멈춘 상황 |
| Request timeout | 특정 HTTP 요청의 실행 시간 | 연결·요청 전송·응답을 합친 요청 범위 제한 |
| Business deadline | 한 업무가 시작부터 끝날 때까지 쓸 수 있는 전체 시간 | 외부 호출, 재시도 대기, 변환·DB 작업을 포함한 예산 |

모든 HTTP 라이브러리가 위 항목을 같은 이름과 방식으로 지원하지 않는다. 설정이 “read timeout”이라고 적혀 있어도 실제로 첫 바이트 대기인지, 다음 데이터 사이의 유휴 시간인지, 전체 응답 시간인지 선택한 HTTP client 문서를 확인해야 한다.

Spring `RestClient`는 실제 전송을 `ClientHttpRequestFactory`에 위임한다. Spring Framework는 JDK `HttpClient`, Apache HttpComponents, Jetty, Reactor Netty, 단순 JDK 기반 팩터리 등을 제공하므로, timeout 설정은 선택한 팩터리와 그 버전에 맞춰야 한다. [Spring REST Clients](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)

### 2.2 timeout 설정은 전송 팩터리에도 명시한다

앞선 외부 API 노트에서 설명한 JDK HTTP client를 다시 사용해 연결·읽기 timeout을 지정하는 예다. 실제 제공자에 연결하지 않는 설명용 구성이다.

```java
package com.example.catalog; // 예제 애플리케이션의 구성 요소를 한 package에 둔다.

import java.net.http.HttpClient; // JDK HTTP 전송 객체를 사용한다.
import java.time.Duration; // 단위를 갖는 timeout 값을 표현한다.
import org.springframework.context.annotation.Bean; // 메서드 결과를 Spring Bean으로 등록한다.
import org.springframework.context.annotation.Configuration; // 설정 클래스임을 Spring에 알린다.
import org.springframework.http.client.JdkClientHttpRequestFactory; // JDK HttpClient를 Spring 요청 팩터리에 연결한다.
import org.springframework.web.client.RestClient; // 동기식 HTTP 요청을 구성하는 Spring API다.

@Configuration(proxyBeanMethods = false) // 이 클래스에서 RestClient Bean 설정을 제공한다.
public class CatalogClientConfiguration { // 외부 상품 API용 클라이언트 구성을 분리한다.
    @Bean // 다른 Bean이 주입받아 재사용할 RestClient를 등록한다.
    RestClient catalogRestClient(RestClient.Builder builder) { // Boot가 준비한 빌더를 주입받는다.
        HttpClient transport = HttpClient.newBuilder() // JDK의 실제 네트워크 전송 구현을 구성한다.
                .connectTimeout(Duration.ofMillis(800)) // 새 연결 수립에 최대 800ms만 기다린다.
                .followRedirects(HttpClient.Redirect.NEVER) // 예상하지 못한 다른 주소로 자동 이동하지 않는다.
                .build(); // 재사용할 HttpClient를 만든다.

        JdkClientHttpRequestFactory requestFactory = // Spring과 JDK client 사이의 연결 팩터리를 만든다.
                new JdkClientHttpRequestFactory(transport); // 방금 설정한 전송 구현을 팩터리에 전달한다.
        requestFactory.setReadTimeout(Duration.ofSeconds(2)); // 응답 읽기 대기 제한을 이 팩터리에 설정한다.

        return builder // Boot가 구성한 메시지 변환 등은 빌더를 통해 이어 간다.
                .baseUrl("https://catalog.example.com") // 외부 제공자 주소를 설정으로 관리한다.
                .requestFactory(requestFactory) // timeout을 명시한 전송 팩터리를 선택한다.
                .build(); // 구성한 클라이언트를 완성해 Bean으로 반환한다.
    }
}
```

`connectTimeout`과 `readTimeout`이 각각 설정됐다고 해서 업무 호출 전체가 정확히 그 두 숫자의 합 안에 끝난다고 보장되지는 않는다. DNS 조회, TLS, 재사용 연결, 요청 본문 전송, 응답 본문 처리, 직렬화와 로컬 작업은 팩터리 구현·실행 환경에 따라 별도 시간을 쓸 수 있다. JDK 팩터리는 자체 `setReadTimeout(Duration)` API를 제공하지만 이 설정도 전체 업무 deadline과 같은 의미는 아니다. [JdkClientHttpRequestFactory API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/client/JdkClientHttpRequestFactory.html)

예시의 800ms·2초는 “정답 값”이 아니다. 제공자 SLA, 네트워크 위치, 우리 API latency 목표, 요청별 중요도, 부하 시험을 근거로 정한다. timeout을 0으로 두면 일부 팩터리에서는 무한 대기를 뜻할 수 있으므로 기본값을 그대로 두지 말고 선택한 구현의 의미를 확인한다.

### 2.3 요청 하나에 전체 deadline을 둔다

들어온 주문 요청을 2초 안에 끝내야 한다고 하자. 외부 상품 API 한 번의 timeout만 2초로 잡으면 실패 후 재시도와 그 사이의 backoff가 전체 예산을 넘어설 수 있다.

```text
업무 deadline: 2,000ms
├─ 첫 번째 외부 요청: 최대 500ms
├─ backoff 대기: 최대 100ms
├─ 두 번째 외부 요청: 최대 500ms
└─ 결과 변환·DB 작업·응답 생성: 남은 시간 안에서 처리
```

다음 관계를 만족하도록 budget을 나눈다.

```text
총 deadline ≥ 시도에 쓴 시간 + backoff 대기 + 나머지 로컬 처리 시간
```

deadline이 지나도 재시도를 계속하면 호출자는 이미 timeout을 받았는데 서버가 뒤에서 작업을 이어 가는 일이 생긴다. 가능하면 각 단계 직전에 남은 시간을 계산하고, 남은 예산이 다음 시도에 필요한 최소 시간보다 작으면 새 시도를 시작하지 않는다. elapsed time 계산에는 시스템 시계가 조정될 수 있는 `currentTimeMillis()` 대신 monotonic한 `System.nanoTime()`을 사용하는 패턴을 고려한다.

```java
long startedAt = System.nanoTime(); // wall-clock 보정과 무관한 경과 시간 측정을 시작한다.
long budgetNanos = Duration.ofSeconds(2).toNanos(); // 이 업무가 쓸 전체 시간 예산을 나노초로 표현한다.
long deadline = startedAt + budgetNanos; // 예산이 끝나는 monotonic 기준점을 계산한다.
long remainingNanos = Math.max(0L, deadline - System.nanoTime()); // 다음 단계가 시작될 때 남은 시간을 구한다.
```

이 코드는 deadline 산술 개념을 보여 준다. `RestClient`의 모든 전송 팩터리에 이 값을 자동으로 연결해 주는 보편적인 한 줄 설정은 아니며, 실제 요청의 timeout·취소·interrupt 동작은 사용하는 HTTP 구현과 호출 구조에 맞게 구성해야 한다.

## 3. timeout은 원격 작업 실패의 증거가 아니다

요청을 보낸 뒤 클라이언트에서 응답 대기 timeout이 발생했다고 해 보자.

```text
우리 서버                         결제 제공자
    │                                  │
    ├── 승인 요청 ────────────────────▶│
    │                                  ├─ 카드 승인 완료
    │     ◀────── 응답 유실 ────────────┤
    ├─ timeout 발생                    │
```

우리 서버는 응답을 받지 못했지만 결제 제공자는 이미 승인했을 수 있다. 이때 새 결제 요청을 보내면 이중 승인될 수 있다. timeout 뒤 상태는 “실패”가 아니라 **결과를 아직 모르는 상태**일 수 있다. AWS의 멱등 API 지침도 응답 유실과 재시도에서 같은 논리 요청의 효과가 중복되지 않도록 idempotency를 설계하는 이유를 설명한다. [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)

### 3.1 먼저 요청이 안전하게 반복될 수 있는지 판단한다

HTTP method 이름만으로 모든 업무 동작의 멱등성을 단정하지 않는다. API 계약과 서버의 실제 side effect를 확인한다.

| 요청 예 | 기본 재시도 판단 | 필요한 확인 |
| --- | --- | --- |
| 상품 상세 `GET` | 비교적 안전하게 후보가 될 수 있음 | 호출이 숨은 변경 작업을 하지 않는지, provider 정책은 어떤지 확인한다. |
| `PUT`으로 같은 값을 지정 | 멱등 계약일 수 있음 | 서버가 반복 처리 때 동일한 최종 상태를 만드는지 확인한다. |
| 주문 생성 `POST` | 무조건 재시도하면 위험 | 같은 idempotency key와 요청 fingerprint로 중복 생성·응답 재생을 방지한다. |
| 결제 승인 `POST` | 무조건 재시도하면 위험 | provider가 보장하는 멱등 키를 유지하고, 결과 조회·응답 재생 규칙을 확인한다. |
| 이메일 발송·외부 알림 | 반복 효과가 사용자에게 보일 수 있음 | 중복 억제 키 또는 중복을 허용하는 업무 계약이 필요하다. |

우리 API의 멱등성 키를 붙였더라도 외부 provider가 그 키를 이해하고 중복을 막아 주는 것은 아니다. 외부 시스템과의 키 전달·저장 기간·동일 key의 payload 변경 규칙을 별도로 맞춘다. [멱등성 키와 중복 요청 방지](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md)

## 4. 어떤 실패를 재시도할지 화이트리스트로 정한다

재시도 설정은 오류가 났다는 사실만 보지 말고 **일시적인가, 다시 성공할 가능성이 있는가, 반복 호출이 안전한가, 남은 deadline 안에 끝날 수 있는가**를 모두 본다.

| 실패 | 재시도 후보? | 이유·주의점 |
| --- | --- | --- |
| 일시적인 연결 실패 | 조건부 후보 | 요청이 상대에게 전달되지 않았을 수 있지만, client가 실제 전송 단계를 확정할 수 있는지 확인한다. |
| 응답 timeout | 조건부 후보 | 원격 업무 결과가 불명일 수 있어 멱등성이 전제다. |
| 429 Too Many Requests | 조건부 후보 | provider의 rate limit 계약과 `Retry-After`, 남은 deadline을 따른다. |
| 502·503·504 | 조건부 후보 | 일시 장애일 수 있지만 모든 업무 요청이 안전한 것은 아니다. |
| 400·401·403 | 보통 재시도하지 않음 | 요청 형식·인증·권한 문제는 같은 요청을 다시 보내도 해결되지 않는다. |
| 404 | 보통 재시도하지 않음 | 도메인상 “없음”일 수 있다. eventual consistency가 명시된 API라면 별도 정책을 세운다. |
| 409·412 동시성 충돌 | 일반적인 network retry와 다름 | 최신 값 조회, 사용자 충돌 응답, 업무 재계산이 필요할 수 있다. |
| 유효성 검증·업무 거절 | 재시도하지 않음 | 입력이나 업무 조건을 바꾸지 않은 재호출은 성공 가능성을 만들지 않는다. |
| circuit breaker OPEN 거부 | 재시도하지 않음 | 차단 상태에서 즉시 재시도하면 짧은 시간에 똑같이 거부될 뿐이다. |

`RestClientException`처럼 넓은 부모 예외 타입 전체를 재시도 대상으로 두면 4xx나 변환 오류처럼 반복해도 나아지지 않는 실패까지 재시도할 수 있다. 실제 연동 클라이언트에서 어떤 예외가 생기는지 확인하고 좁은 예외 목록 또는 predicate를 사용한다. HTTP status를 예외로 바꾸지 않고 응답값으로 처리하는 구조라면 status 분류도 정책에 포함한다.

`Retry-After`는 서버가 후속 요청 전에 기다리라고 안내하는 응답 헤더다. 값은 날짜 시각 또는 초 단위 지연으로 올 수 있다. 503 응답의 `Retry-After`는 서버가 예상하는 unavailable 기간을 나타낼 수 있으므로, 임의의 고정 backoff로 덮어쓰기 전에 서버 안내와 우리 업무 deadline을 비교한다. [RFC 9110, Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)

## 5. 재시도 횟수와 전체 retry budget을 제한한다

재시도 횟수 `maxAttempts`를 셀 때는 최초 호출이 포함되는지 확인한다. Resilience4j Retry 문서에서 `maxAttempts`는 최초 호출을 포함한 전체 시도 횟수다. 즉 `maxAttempts: 3`은 최초 1회와 추가 재시도 최대 2회를 뜻한다. [Resilience4j Retry](https://resilience4j.readme.io/docs/retry)

여러 계층이 각각 세 번씩 시도하면 전체 호출은 단순히 세 번이 되지 않는다.

```text
API gateway 3회 × Service 3회 × SDK 3회 = 최대 27번의 downstream 호출
```

따라서 같은 요청에 gateway, service, HTTP client, SDK 등 여러 계층이 중복 retry를 수행하지 않게 책임 계층을 정한다. retries가 필요한 호출 계층에 한정하고, 상위 계층의 전체 deadline을 전달하거나 budget을 나눈다. AWS Well-Architected도 재시도 최대 횟수를 제한하고, exponential backoff와 jitter를 적용하며, 멱등성을 먼저 확인하라고 안내한다. [Control and limit retry calls](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html)

## 6. 지수 backoff와 jitter로 재시도 폭주를 줄인다

고정 100ms로 수천 개 client가 동시에 재시도하면 모든 호출이 다시 같은 시각에 몰릴 수 있다. 지수 backoff는 실패할수록 다음 시도까지 기다리는 간격을 늘린다.

```text
기본 간격: 100ms, 배수: 2, 상한: 2초
시도 후 대기 후보: 100ms → 200ms → 400ms → 800ms → 1,600ms → 최대 2초
```

`jitter`는 이 간격에 임의성을 더해 재시도 시점을 분산한다. 예를 들어 full jitter는 `0`에서 계산된 capped backoff 사이의 임의 지연을 고른다.

```text
상한(n) = min(cap, base × 2ⁿ)
대기(n) = random(0, 상한(n))
```

지수 증가만 하고 임의성을 넣지 않으면 같은 시각에 실패한 client들이 다음 재시도에서도 함께 몰릴 수 있다. AWS는 exponential backoff에 jitter를 넣어 요청 재집중을 줄이는 방법을 설명한다. [Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)

### 6.1 설정 예시는 복사 전에 지원 버전을 확인한다

아래 YAML은 Resilience4j Spring Boot 통합이 지원되는 버전에서 구성할 때의 형태를 보여 준다. 값은 설명용이며, Boot 버전과 Resilience4j starter·AOP·Actuator 의존성을 선택한 프로젝트의 공식 호환성 표로 맞춰야 한다.

```yaml
resilience4j: # resilience4j 설정의 최상위 prefix다.
  retry: # 일시 장애를 재시도할 정책을 지정한다.
    instances: # downstream 별로 독립된 retry 정책을 등록한다.
      catalog: # Catalog API용 정책 이름이다.
        maxAttempts: 3 # 최초 요청을 포함해 최대 3회 시도한다.
        waitDuration: 100ms # 첫 backoff의 기준 대기 시간을 지정한다.
        enableExponentialBackoff: true # 재시도할수록 대기 간격을 늘린다.
        exponentialBackoffMultiplier: 2 # 매 단계 대기 간격을 두 배로 늘린다.
        retryExceptions: # 이 목록의 예외만 retry 후보로 삼는다.
          - org.springframework.web.client.ResourceAccessException # 네트워크 I/O 계열 실패를 후보로 둔다.
        ignoreExceptions: # 재시도 가치가 없는 도메인 오류는 제외한다.
          - com.example.catalog.CatalogNotFoundException # 상품 부재는 다시 요청해도 해결되지 않는다고 가정한다.
  circuitbreaker: # 반복 실패 때 호출을 차단할 정책을 지정한다.
    instances: # downstream 별 회로 차단 상태와 집계를 둔다.
      catalog: # Catalog API용 회로 차단기 이름이다.
        slidingWindowType: COUNT_BASED # 최근 N회 결과로 비율을 계산한다.
        slidingWindowSize: 20 # 최근 20회의 결과를 집계한다.
        minimumNumberOfCalls: 10 # 최소 10회가 쌓여야 임계 비율을 평가한다.
        failureRateThreshold: 50 # 실패 비율이 50% 이상이면 OPEN 후보가 된다.
        slowCallDurationThreshold: 500ms # 500ms 초과 호출을 느린 호출로 센다.
        slowCallRateThreshold: 50 # 느린 호출 비율이 50% 이상이면 열 수 있다.
        waitDurationInOpenState: 5s # OPEN 뒤 HALF_OPEN으로 probe하기까지 기다린다.
        permittedNumberOfCallsInHalfOpenState: 2 # 회복 확인용 호출을 최대 2개 허용한다.
```

주의할 점은 `ResourceAccessException`이 “반드시 재시도해도 안전한 실패”라는 뜻은 아니라는 것이다. 예시 메서드가 읽기 전용 `GET`이라고 가정했기 때문에 후보로 보였다. 변경 요청에서는 전송 오류라도 상대 side effect 결과가 불명일 수 있다. 또 timeout·connection reset 외의 모든 transport 오류가 재시도 가능하다고 단정할 수 없으므로 운영 정책에 맞춰 predicate를 구체화한다.

Resilience4j Retry는 최대 시도 수·대기 시간·예외·결과 predicate를 구성할 수 있고, 기본 간격을 고정하거나 exponential interval function으로 바꿀 수 있다. Starter 기반 Spring Boot 연동은 YAML, annotation, Actuator/metrics를 제공하지만 지원 starter 조합은 공식 getting started 안내에 따라 확인해야 한다. [Resilience4j Spring Boot Getting Started](https://resilience4j.readme.io/docs/getting-started-3)

### 6.2 annotation보다 먼저 decorator 순서를 이해한다

Retry와 CircuitBreaker를 감싸는 순서에 따라 circuit breaker가 관찰하는 실패 단위가 달라진다.

```text
CircuitBreaker(Retry(remoteCall))
  → Retry가 여러 번 시도하고, 바깥 CircuitBreaker는 논리 요청의 최종 결과 하나를 기록

Retry(CircuitBreaker(remoteCall))
  → 각 시도마다 CircuitBreaker를 통과하므로, 개별 attempt 결과가 집계될 수 있음
```

먼저 아래 예처럼 `CircuitBreaker`가 재시도 전체를 감싸게 만들면 breaker는 보통 최종 논리 호출의 성공·실패를 본다. 어떤 측정 의미가 필요한지 정한 뒤 선택한다. Spring AOP annotation을 여러 개 겹칠 때는 annotation 이름 순서로 실행 순서를 추측하지 말고 Resilience4j aspect order 설정과 사용 버전 문서를 확인한다. Starter 문서는 aspect order를 설정할 수 있음을 설명한다.

```java
Supplier<Product> singleAttempt = () -> catalogClient.findProduct(productId); // 실제 외부 조회를 한 번 수행하는 함수를 준비한다.
Supplier<Product> retrying = Retry.decorateSupplier(retry, singleAttempt); // 일시 실패일 때만 함수 호출을 다시 시도하도록 감싼다.
Supplier<Product> protectedCall = CircuitBreaker.decorateSupplier(circuitBreaker, retrying); // 논리 요청의 retry 전체를 회로 차단기로 감싼다.
return protectedCall.get(); // 최종 결과를 반환하거나 허용되지 않은 실패를 호출자에게 전달한다.
```

위 코드에서 Retry 정책이 OPEN breaker의 `CallNotPermittedException`까지 재시도 대상으로 포함하면 안 된다. breaker가 이미 호출을 차단했으므로 잠시 기다리며 재시도해도 유용하지 않다. 실제 exception 목록에서 breaker 거부, 입력 오류, 업무 예외를 제외한다.

반대로 breaker가 **각 attempt**의 결과를 알아야 한다면 `CircuitBreaker.decorateSupplier(circuitBreaker, singleAttempt)`를 먼저 적용하고 Retry를 바깥에 둔다. 이 구조에서는 breaker 실패 집계가 시도 횟수만큼 증가할 수 있으며, breaker가 중간에 열리면 Retry에서 그 차단 예외를 재시도하지 않도록 설정해야 한다.

## 7. Circuit breaker는 자동 복구 마법이 아니라 차단 상태 머신이다

Circuit breaker는 전기 회로 차단기처럼 실패가 일정 수준 쌓였을 때 새 호출을 잠시 막는다. Resilience4j는 sliding window에 호출 결과를 기록하고 실패 비율 또는 느린 호출 비율을 기준으로 상태를 전이한다. [Resilience4j CircuitBreaker](https://resilience4j.readme.io/docs/circuitbreaker)

| 상태 | 동작 | 다음 전이 |
| --- | --- | --- |
| `CLOSED` | 요청을 통과시키며 성공·실패·느린 호출을 window에 기록한다. | 집계한 failure/slow-call 비율이 임계치 이상이면 `OPEN` |
| `OPEN` | 원격 호출 전에 빠르게 거부해 상대 시스템과 우리 요청 thread를 보호한다. | open 대기 시간이 지난 뒤 `HALF_OPEN` |
| `HALF_OPEN` | 제한된 probe 요청만 통과시켜 원격 서비스의 회복 여부를 본다. | 회복 기준 충족 시 `CLOSED`, 실패율 임계치 초과 시 `OPEN` |

추가로 `minimumNumberOfCalls`보다 적은 결과만으로는 rate를 평가하지 않을 수 있다. 트래픽이 아주 적은 API에서 “첫 1회 실패하면 즉시 open”될 것이라고 기대하지 말고 window와 최소 호출 수를 함께 조정한다. 이 값들은 안정성을 자동 보장하는 마법 숫자가 아니며 실제 요청 빈도·장애 패턴과 맞춰야 한다.

### 7.1 Circuit breaker는 동시 호출 수 제한기가 아니다

`slidingWindowSize: 20`은 최근 결과 20개를 집계한다는 뜻이지 동시에 20개만 실행한다는 뜻이 아니다. `CLOSED` 상태에서는 window 크기보다 더 많은 동시 요청도 통과할 수 있다. [Resilience4j CircuitBreaker 문서](https://resilience4j.readme.io/docs/circuitbreaker)는 동시 thread 제한에는 Bulkhead를 사용하라고 구별한다.

| 문제 | 주로 고려할 장치 |
| --- | --- |
| 원격 호출이 오래 걸려 thread가 붙잡힘 | 낮은 전송 timeout, 전체 deadline, 비차단 호출 방식 검토 |
| 실패가 누적되는데도 요청을 계속 보냄 | Circuit breaker |
| 동시에 너무 많은 호출이 실행됨 | Bulkhead·connection pool·동시성 제한 |
| 단위 시간 요청 수가 provider 한도를 넘음 | Rate limiter·queue·provider 계약 |
| 장애 중 요청이 무한히 쌓임 | bounded queue, backpressure, 빠른 거절 |

Circuit breaker와 Bulkhead는 보완 관계다. breaker는 “호출을 허용할지” 판단하고, bulkhead는 “동시에 몇 개를 실행할지” 제한한다.

### 7.2 fallback은 실패를 감추는 값이 아니다

breaker가 열렸거나 retry가 끝났을 때 기본 상품값이나 빈 결제 응답을 돌려 주면 오류가 사라진 것처럼 보일 수 있다. fallback을 적용하려면 그 값이 사용자와 업무에 어떤 의미인지 정한다.

- 상품 추천이라면 오래된 캐시를 반환해도 되는가?
- 상품 가격이라면 낡은 가격을 결제에 사용해도 되는가?
- 결제 승인이라면 provider 응답을 모를 때 “실패”로 표시해도 되는가?
- 주문 생성이라면 실제 결과를 조회하지 않고 성공 또는 실패를 반환해도 되는가?

fallback은 업무 계약이 허용한 degraded response에 한정한다. 모르는 결제 결과를 임의의 성공/실패로 바꾸지 말고 `PENDING_CONFIRMATION` 같은 상태로 보존한 뒤 같은 멱등 key로 상태 조회나 안전한 결과 회복을 진행한다. Saga에서는 `COMPENSATING`이나 `MANUAL_REVIEW`와 마찬가지로 해결되지 않은 상태를 숨기지 않는다.

## 8. 전체 호출 구조를 이어서 보기

안전한 읽기 전용 상품 조회는 아래와 같은 순서를 고려할 수 있다.

```text
1. 업무 deadline에서 남은 budget 확인
2. budget이 충분하면 HTTP client timeout 안에서 한 번 호출
3. 성공이면 결과 반환
4. 재시도 허용 예외이고 최대 횟수·남은 budget·breaker 상태가 허용하면 backoff 후 재시도
5. 실패가 계속되면 breaker에 최종 결과가 기록됨
6. breaker가 OPEN이면 외부 호출 없이 빠르게 실패를 전달
7. 업무가 허용한 stale cache 또는 오류 응답으로 대체
```

하지만 호출이 `POST /payments`처럼 side effect가 있다면 4번 전에 provider 멱등 계약과 결과 조회 경로가 먼저 필요하다. retry는 데이터 효과를 한 번으로 만들지 않으며, 멱등성 설계와 별개다.

## 9. Spring Boot에 붙일 때의 실무 순서

1. 어떤 외부 호출인지 목록화한다. 예: 검색, 상품 읽기, 결제, 이메일, 배송 요청.
2. 호출별 지연 목표와 우리 API의 전체 deadline을 정한다.
3. Spring `RestClient`가 어떤 `ClientHttpRequestFactory`와 실제 HTTP client를 사용하는지 확인한다.
4. connect·read 또는 request timeout을 실제 전송 팩터리에 지정하고 통합 테스트로 적용 여부를 확인한다.
5. 업무 side effect, idempotency key 지원, timeout 결과 조회 방법을 확인한다.
6. 재시도할 일시 예외·상태와 재시도하지 않을 업무·설정 오류를 분리한다.
7. 최대 attempt, capped backoff, jitter, Retry-After 처리, 전체 retry budget을 정한다.
8. failure rate·slow-call rate·minimum calls·open duration·half-open probe로 breaker를 구성한다.
9. 동시 요청이 별도 병목이면 Bulkhead·pool limit도 설정한다.
10. 상태·실패 사유·시도 수·지연을 관찰하고, fallback·수동 복구 경로를 문서화한다.

Spring Boot 자동 설정이 존재한다고 해도 모든 HTTP client timeout·retry·breaker가 자동으로 적절한 값으로 정해지는 것은 아니다. 의존성 추가는 동작 정책 선택을 대신하지 않는다. Resilience4j starter를 추가할 때는 공식 문서가 안내하는 Boot 버전·Actuator·AOP·WebFlux adapter 필요 여부와 현재 프로젝트의 버전을 확인한다. [Resilience4j Spring Boot Getting Started](https://resilience4j.readme.io/docs/getting-started-3)

## 10. 운영에서 꼭 관찰할 항목

| 지표·event | 알 수 있는 것 | 같이 볼 내용 |
| --- | --- | --- |
| 외부 호출 latency와 p95/p99 | 느려짐이 시작됐는가? | HTTP client, endpoint, 배포 버전, 지역 |
| timeout·connect failure 수 | 연결·응답 단계 중 어디서 실패하는가? | retry 수, 요청량, provider 상태 |
| 재시도 attempt 수와 최종 성공률 | retry가 회복을 돕는가, 부하만 늘리는가? | 호출 계층별 중복 retry, 전체 deadline 초과 |
| breaker state와 transition | 언제 열리고 얼마나 유지되는가? | 실패/slow-call 비율, 최소 표본 수 |
| `not permitted` 거절 수 | OPEN 동안 요청을 얼마나 막았는가? | 사용자 오류와 fallback 품질 |
| Bulkhead 거절·in-flight 수 | 동시성이 한도에 닿았는가? | thread·connection pool 포화 |

로그에는 요청 ID, 외부 대상의 논리 이름, attempt 번호, 지연, HTTP status, breaker 상태 같은 진단 정보를 남긴다. Authorization header, cookie, 개인정보, 민감한 요청 본문은 로그에 그대로 적지 않는다. 운영 Actuator endpoint는 현재 프로젝트에서 설정한 인증·노출 정책에 따라 보호한다.

“retry가 성공률을 높였다”만 보지 말고 요청당 실제 외부 호출 수와 tail latency도 함께 본다. retry를 늘렸을 때 성공률은 약간 좋아지지만 평균 응답 시간이 deadline을 넘거나 상대 트래픽이 폭증하면 전체 시스템은 더 나빠질 수 있다.

## 11. 테스트에서는 시간과 실패를 결정적으로 만든다

sleep으로 실제 시간을 오래 기다리는 테스트는 느리고 환경 차이에 민감하다. fake clock, 고정 interval, mock HTTP server, 대기 함수 대역 등으로 경계값을 통제한다.

| 시나리오 | 검증할 결과 |
| --- | --- |
| 첫 호출 timeout, 다음 호출 성공 | 허용한 최대 attempt 안에 성공하고 호출 횟수가 정확하다. |
| 영구 400 또는 업무 오류 | 재시도하지 않고 즉시 분류된 실패를 반환한다. |
| retry 총 시간이 business deadline 초과 | deadline 뒤 새 시도를 시작하지 않는다. |
| 변경 요청 응답 유실 | 같은 provider idempotency key를 유지하고 중복 side effect가 없다. |
| 실패율 threshold 도달 | breaker가 OPEN으로 전이한다. |
| breaker OPEN 중 추가 요청 | 원격 서버가 호출되지 않고 빠르게 거절된다. |
| open wait 이후 probe 성공 | HALF_OPEN에서 제한된 시도 뒤 CLOSED가 된다. |
| probe 실패 | 다시 OPEN으로 전이한다. |
| 429와 `Retry-After` | server hint·deadline·최대 대기 정책을 따르거나 재시도하지 않는다. |
| fallback 응답 | 허용된 degraded 값인지, 결제·주문 성공을 거짓으로 표시하지 않는지 확인한다. |

다중 계층을 사용할 때는 integration test로 **실제 전송 팩터리에 timeout 설정이 적용됐는지**도 확인한다. 숫자 property가 application context에 올라갔다는 사실만으로 실제 client가 그 값을 사용한다고 보장할 수 없다.

## 12. 자주 하는 오해

### “timeout이 났으니 원격 서버도 실패했다”

아니다. timeout은 로컬에서 기다리기를 중단했다는 뜻일 수 있다. 상대의 side effect가 이미 commit됐는지 확인하는 수단이 아니므로, 변경 요청 결과는 조회 또는 동일 멱등 key로 복구한다.

### “재시도 횟수를 늘리면 성공률이 항상 올라간다”

일시 실패에는 도움이 될 수 있지만 이미 과부하된 서버에 요청을 더 보낼 수 있다. attempt와 전체 deadline을 제한하고, backoff·jitter·retry budget을 함께 둔다.

### “모든 5xx는 재시도하면 된다”

상태 코드만으로 요청 side effect의 확정 여부를 알 수 없다. 업무 멱등성, 제공자 계약, 특정 응답이 일시적인지까지 판단한다.

### “Circuit breaker가 동시에 실행되는 호출 수도 막아 준다”

아니다. breaker의 sliding window는 결과를 집계하는 창이다. 동시 실행 한도는 Bulkhead나 connection pool 등으로 따로 관리한다.

### “breaker가 OPEN이면 응답 timeout도 자동으로 생긴다”

반대다. OPEN은 새 호출을 원격 client에 보내기 전에 빠르게 거부한다. HTTP timeout은 호출을 실제 전송한 뒤 기다리는 시간을 제한한다. 두 설정은 서로 다른 실패 경계를 보호한다.

### “fallback에서 빈 값을 주면 장애 처리가 끝났다”

빈 값이 업무상 참인 정상 결과인지 장애 때문에 만든 대체 응답인지 구분해야 한다. 상태와 관찰성을 남기고, 허용되지 않은 성공 응답을 만들지 않는다.

## 13. 핵심 정리와 다음 학습

1. connect·read·pool·request timeout은 각 전송 경계의 제한이고 business deadline은 전체 업무 시간 예산이다.
2. timeout은 remote side effect 실패 확정이 아니다. 응답 유실 뒤 같은 결제·주문을 다시 만들지 않도록 멱등성·결과 조회를 설계한다.
3. retry는 멱등성, 재시도 가능 오류, maximum attempts, capped backoff, jitter, 남은 deadline을 모두 확인한 뒤 적용한다.
4. `maxAttempts`가 최초 시도를 포함하는지 확인하고 여러 계층의 retry가 곱으로 증폭되지 않게 한 계층에 책임을 둔다.
5. circuit breaker는 sliding window와 failure/slow-call 임계치로 `CLOSED → OPEN → HALF_OPEN` 상태를 관리한다.
6. breaker는 동시성 제한기가 아니다. 최대 동시 호출은 Bulkhead·pool로 별도 제한한다.
7. fallback은 업무가 허용하는 degraded response만 반환한다. 결과 불명인 결제·주문을 임의 성공이나 실패로 바꾸지 않는다.
8. retry 횟수·지연·timeout·breaker state·거절량·tail latency를 함께 관찰하고, 장애·복구 경로를 결정적으로 테스트한다.

🧠 기억할 것: **timeout은 내 기다림을 끝내고, retry는 안전한 요청을 한정된 budget 안에서 다시 보내며, circuit breaker는 실패가 계속될 때 새 호출을 잠시 막는다. 셋은 목적이 다르므로 멱등성·deadline·동시성 정책과 함께 조합해야 한다.**

다음 노트인 [Bulkhead·Rate Limiter와 외부 호출 동시성 제어](../28_09_29_Bulkhead_and_Rate_Limiting/09_29_Bulkhead_and_Rate_Limiting.md)에서 breaker가 막지 못하는 동시 요청 수와 provider 요청 한도를 어떻게 제한할지 살펴본다.

## 14. 복습 퀴즈

1. connect timeout과 business deadline은 무엇이 다른가?
2. 결제 승인 요청이 timeout된 뒤 실패라고 단정할 수 없는 이유는 무엇인가?
3. retry 설정의 `maxAttempts: 3`은 통상적으로 실제 호출 몇 번을 허용하는가?
4. 모든 4xx와 5xx를 똑같이 재시도하면 어떤 문제가 생길 수 있는가?
5. exponential backoff에 jitter를 추가하는 이유는 무엇인가?
6. retry와 circuit breaker의 decorator 순서를 바꾸면 breaker가 관찰하는 실패 단위는 어떻게 달라지는가?
7. sliding window size가 20이면 동시에 실행되는 호출도 20개로 제한되는가? 동시성을 제한할 도구는 무엇인가?
8. breaker가 OPEN인 동안 Retry가 `CallNotPermittedException`을 반복 재시도하면 왜 낭비인가?
9. 주문·결제의 timeout 뒤 fallback을 곧바로 성공 또는 실패 응답으로 바꾸면 안 되는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. connect timeout은 새 연결을 만드는 단계의 제한이다. business deadline은 해당 업무의 외부 요청, 재시도 대기와 로컬 처리를 포함한 전체 시간 예산이다.
2. 제공자가 요청을 처리하고 side effect를 commit했지만 응답만 유실됐을 수 있다. 상태 조회 또는 같은 멱등 key로 결과를 확인해야 한다.
3. 최초 호출을 포함한 총 3회다. 따라서 재시도는 최대 2회다.
4. 입력·인증 오류처럼 반복해도 해결되지 않는 요청을 계속 보내고 부하를 늘릴 수 있다. status와 업무·멱등성 의미를 함께 본다.
5. 같은 시점에 실패한 여러 client의 다음 시도 시점을 분산해 재요청이 한 번에 몰리는 현상을 줄인다.
6. `CircuitBreaker(Retry(call))`는 보통 Retry가 끝난 논리 요청의 최종 결과 하나를 기록한다. `Retry(CircuitBreaker(call))`는 각 attempt가 breaker를 통과해 개별 결과를 집계할 수 있다.
7. 아니다. sliding window는 결과 집계 크기다. 동시 실행 수는 Bulkhead·connection pool 등으로 별도 제한한다.
8. breaker가 이미 호출을 허용하지 않으므로 요청을 다시 실행하지 못한다. 기다림 없는 재시도는 처리량·로그만 낭비한다.
9. 응답을 못 받았다는 사실은 외부 업무 결과를 확정하지 않는다. 중복 결제·주문 또는 잘못된 업무 상태를 만들 수 있다.

</details>

## 15. 공식 문서로 이어서 읽기

- [Spring Boot — Calling REST Services](https://docs.spring.io/spring-boot/reference/io/rest-client.html): Boot의 RestClient 구성·Builder 사용
- [Spring Framework — REST Clients](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html): RestClient와 Client Request Factory 선택
- [Spring Framework — JdkClientHttpRequestFactory API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/client/JdkClientHttpRequestFactory.html): JDK 기반 전송의 read timeout API
- [Resilience4j — Retry](https://resilience4j.readme.io/docs/retry): 최대 시도·예외 predicate·interval function·decorator
- [Resilience4j — CircuitBreaker](https://resilience4j.readme.io/docs/circuitbreaker): 상태·sliding window·failure/slow-call threshold·bulkhead 구분
- [Resilience4j — Spring Boot Getting Started](https://resilience4j.readme.io/docs/getting-started-3): Boot starter 조합·YAML·annotation aspect order·Actuator metrics
- [AWS Builders’ Library — Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/): timeout 값 선택, retry와 backoff의 설계 관점
- [AWS Builders’ Library — Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): response loss와 반복 요청의 중복 방지
- [AWS Architecture Blog — Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/): 지수 backoff와 재요청 시점 분산
- [RFC 9110 §10.2.3 — Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3): HTTP-date·초 지연 형태의 server retry hint
- [Saga와 보상 트랜잭션](../26_09_26_Saga_and_Compensating_Transactions/09_26_Saga_and_Compensating_Transactions.md): 결과가 불명인 participant 요청의 재시도·보상·운영 복구
- [멱등성 키와 중복 요청 방지](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md): 재시도 가능한 요청 계약과 중복 effect 방지
