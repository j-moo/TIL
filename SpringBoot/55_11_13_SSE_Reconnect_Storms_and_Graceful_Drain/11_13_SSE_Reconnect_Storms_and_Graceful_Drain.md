# Spring Boot SSE 재연결 폭주·부하 제한과 점진적 종료

- 🎯 글의 목표: 서버가 내려갈 때 여러 SSE 연결이 같은 순간 다시 열리는 이유를 설명하고, 재시도·신규 연결·기존 구독 종료를 각각 제어한다.
- 🧩 핵심 키워드: 재연결 폭주, 백오프, 지터, Retry-After, 연결 슬롯, 드레이닝, 재개 커서
- ⭐ 중요도: 높음. 배포가 끝나도 재연결과 이력 재생이 한꺼번에 몰리면 새 서버가 안정화되기 어렵다.
- 📝 한눈에 보는 내용: 재시도 주체 선택 → 연결과 재생 작업 제한 → 기존 구독을 나눠 종료 → 다른 인스턴스에서 이어 읽기
- 🔗 관련 주제: [SSE 운영 관측성](../54_11_12_SSE_Observability_and_Troubleshooting/11_12_SSE_Observability_and_Troubleshooting.md), [SSE 연결 다중화](../52_11_09_SSE_Multiplexing_and_Scoped_Cursors/11_09_SSE_Multiplexing_and_Scoped_Cursors.md), [Bulkhead·Rate Limiter](../28_09_29_Bulkhead_and_Rate_Limiting/09_29_Bulkhead_and_Rate_Limiting.md)
- 🧱 선수 지식: SSE 이벤트와 ID, HTTP 상태 코드, 구독 등록·정리, [Spring Boot 운영 기초](../12_09_08_Operations_Logging_and_Actuator/09_08_Operations_Logging_and_Actuator.md)

> 2026-11-13 기준. Java 21·Spring Boot 4.1.2 기준의 연결 수 제한 코드와 종료 설계 예시다. 재시도 판단 모듈은 Node.js 24.18.0에서 검증했다. 실제 Spring 서버·브라우저·로드밸런서 종료 및 부하 시험은 미실행이다. 문서의 한도와 시간은 교육용 예시다.

## 1. 들어가며

서버 하나를 교체하면서 그 서버에 연결된 업로드 관찰 화면 600개가 동시에 끊겼다고 하자. 각 화면이 같은 시간만큼 기다렸다 다시 요청하면, 로그인 확인·watch 조회·이력 재생이 다른 서버에 한꺼번에 몰린다. 평소의 활성 연결 수가 적정했어도 복구 순간에는 요청 처리량이 부족할 수 있다. 이처럼 끊긴 연결들이 짧은 시간에 다시 몰리는 현상을 **재연결 폭주**라고 한다.

이전에는 SSE(Server-Sent Events, 열린 HTTP 응답으로 서버가 이벤트를 보내는 방식)의 재연결과 전송 지연을 어떻게 측정할지 살펴봤다. 이번에는 그 지표가 급증할 때 사용할 제어 지점을 설계한다. 파일 업로드 작업 자체를 멈추는 것이 아니라, 화면이 상태를 **관찰하는 연결**을 정리하는 데 초점을 둔다.

## 2. 핵심 개념 정리

```text
클라이언트: 끊김 → 재시도 허용 여부 판단 → 서로 다른 시점에 다시 연결
서버: 요청 도착률 제한 → 활성 연결 슬롯 확인 → 제한된 재생 작업 수행
배포: 새 연결 차단 → 기존 연결을 유예 시간 안에 나눠 정리 → 프로세스 종료
복구: 마지막 적용 위치 → 새 서버에서 권한 재검사 → 재생 또는 해당 자원만 reset
```

기다리는 시간을 흩어 놓는 것만으로 서버 자원이 보호되지는 않는다. 접속 빈도, 동시에 열린 연결, DB 재생에 쓰는 작업량을 각각 제한해야 한다.

## 3. 본문 정리

### 3.1 재연결을 브라우저와 앱이 동시에 맡지 않는다

브라우저의 `EventSource`는 SSE를 해석하고 조건이 맞으면 재연결도 수행한다. 이미 열린 스트림에서 서버가 `retry: 2500`을 보내면 해당 객체의 재연결 대기 설정이 밀리초 단위로 바뀐다. 모든 연결에 같은 값을 주면 다시 모일 수 있으므로 분산이 필요하다면 연결별로 다른 값을 정한다. `retry:`는 HTTP 헤더가 아니라 SSE 본문에 쓰는 필드다. 종료 안내에 새 이벤트 ID를 부여하지 않는다. [WHATWG SSE 처리 모델과 필드](https://html.spec.whatwg.org/multipage/server-sent-events.html)

| 구분 | 기본 EventSource가 재연결 | 앱이 Fetch로 재연결 |
| --- | --- | --- |
| 정상 스트림 단절 | 같은 객체가 재연결하고, 비어 있지 않은 마지막 ID를 헤더에 넣는다. | 앱이 이전 읽기를 취소하고 마지막 적용 위치로 새 요청을 만든다. |
| 연결 시작 전 429·503 | 응답의 상태·헤더를 앱의 SSE `error` 이벤트에서 읽을 수 없다. SSE 처리 모델의 비정상 상태 응답은 연결 실패다. | 응답 상태와 `Retry-After`를 읽고 정한 규칙에 따라 기다린다. |
| 204 | 서버가 자동 재연결을 그만두라고 알리는 응답이다. 임시 과부하 신호로 쓰지 않는다. | 이 노트의 정책도 반복하지 않고 종료한다. |

기존 EventSource 구현을 유지한다면 해당 객체에 재연결을 맡기고 오류가 날 때마다 새 객체를 만드는 타이머를 겹쳐 두지 않는다. 새 객체로 복구할 때는 이전 객체를 먼저 닫고, [이전 노트](../52_11_09_SSE_Multiplexing_and_Scoped_Cursors/11_09_SSE_Multiplexing_and_Scoped_Cursors.md)의 마지막 적용 위치를 전달한다. 시작 전 HTTP 상태를 읽고 제어해야 한다면 앱이 Fetch를 쓰는 방식으로 역할을 바꾼다. 그 경우 SSE 파싱·취소·재개도 앱의 책임이다. [WHATWG EventSource](https://html.spec.whatwg.org/dev/server-sent-events.html), [Fetch 표준](https://fetch.spec.whatwg.org/)

⚠️ 주의: `retry:`를 받지 못한 연결에는 새 지연 설정이 적용되지 않는다. 예를 들어 갑작스러운 프로세스 종료로 마지막 안내를 받지 못할 수 있다. 클라이언트의 분산 설정을 서버의 연결 한도 대신 사용하지 않는다.

### 3.2 재시도는 더 늦게, 서로 다른 시점에 한다

**백오프**는 연속 실패할수록 기다리는 범위를 늘리는 방법이다. **지터**는 그 범위에 무작위성을 더해 여러 요청이 다시 겹치는 일을 줄인다. 아래 코드는 지터 범위를 500ms부터 두 배씩 키워 마지막 예약에서 8초로 제한한다. 이 범위에서 뽑은 값을 기본 대기 250ms 또는 서버가 안내한 대기 시간 중 더 긴 값에 더한다. 8초는 지터의 상한이지, 서버가 요구한 대기 시간의 상한이 아니다. [AWS Builders' Library: 백오프와 지터](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

`Retry-After`는 503 응답 등에서 서버가 다음 요청을 얼마나 늦추라고 제안하는 HTTP 헤더다. 429도 이 헤더를 보낼 수 있다. 표준 값은 정수 초 또는 HTTP 날짜다. 이 교육용 서비스 계약에서는 429·503을 보낼 때 **정수 초 형식만** 사용한다. 앱은 날짜나 알 수 없는 헤더를 받으면 즉시 반복하지 않고 자동 복구를 멈춘다. 유효한 서버 대기 시간은 하한이므로, 클라이언트의 시간 예산보다 길어도 억지로 줄이지 않는다. [RFC 9110 Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), [RFC 6585 429](https://www.rfc-editor.org/rfc/rfc6585.html#section-4)

아래 `sse-retry.mjs`는 Fetch 방식에서 사용하는 **순수 판단 모듈 전체**다. `status=null`은 호출부가 판별한 일시적 네트워크 단절 또는 예상하지 못한 스트림 종료만 뜻한다. 화면을 떠나 발생한 취소, 잘못된 SSE 형식, 커서·권한 오류는 네트워크 장애로 넘기지 않는다. 이 코드는 Fetch·SSE 파싱·타이머 실행 자체를 구현하지 않는다.

```javascript
const retryable = new Set([429, 502, 503, 504]); // 이 서비스가 일시 오류로 선택한 상태만 자동 재시도한다.
const maxRetries = 5; // 최초 접속과 별개로 실패 구간당 자동 재시도를 최대 다섯 번 예약한다.
const minDelayMs = 250;

export function planSseRetry({ status, retryAfter = null, retryIndex, remainingMs, random = Math.random }) {
  if (!Number.isSafeInteger(retryIndex) || retryIndex < 0
      || !Number.isFinite(remainingMs) || remainingMs < 0) {
    throw new TypeError("재시도 번호와 남은 시간 예산을 확인하세요.");
  }
  if (status !== null && !retryable.has(status)) return { kind: "stop", reason: "not_retryable" };
  if (retryIndex >= maxRetries) return { kind: "stop", reason: "attempts" };

  let serverMs = 0;
  if ((status === 429 || status === 503) && retryAfter !== null) {
    if (typeof retryAfter !== "string" || !/^\d{1,9}$/.test(retryAfter) || retryAfter !== retryAfter.trim()) {
      return { kind: "stop", reason: "unsupported_retry_after" }; // 날짜나 잘못된 값을 무시해 즉시 반복하지 않는다.
    }
    serverMs = Number(retryAfter) * 1_000; // 9자리 초까지만 허용해 정수 변환을 안전하게 한다.
  }

  const windowMs = 500 * 2 ** retryIndex; // 앞의 횟수 제한 때문에 범위는 500~8,000ms다.
  const fraction = random(); // 테스트에서는 고정 값을 넣어 두 연결의 예약 차이를 확인한다.
  if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) {
    throw new RangeError("난수는 0 이상 1 미만이어야 합니다.");
  }
  const delayMs = Math.max(serverMs, minDelayMs) + Math.floor(fraction * windowMs);
  if (delayMs >= remainingMs) return { kind: "stop", reason: "budget" }; // 마감 전에 다음 요청을 시작할 수 없다.
  return { kind: "retry", delayMs };
}
```

예를 들어 서버가 3초를 안내하고 첫 재시도의 난수가 0.5라면 예상 지연은 3,250ms다. 남은 예산이 2초라면 결과는 `stop/budget`이다. 서버의 지연을 무시하거나 여러 타이머를 만들지 않는다. 401·404·204는 같은 요청을 자동 반복하지 않고, 필요한 경우 로그인이나 관찰 대상의 권한을 새로 확인한다.

호출부는 이전 요청의 본문 읽기와 대기 타이머를 끝내고, 한 watch에 새 접속을 한 번만 예약한다. 취소에는 `AbortController` 등을 사용하고, 타이머가 실행될 때 실제 남은 예산을 다시 계산한다. 이 모듈은 **예약 시점**만 판단하므로, 다음 연결의 헤더나 초기 응답 대기에도 별도의 시간 제한을 둔다. 200 헤더만 받은 뒤 바로 끊기는 상황에서 카운터를 매번 0으로 되돌리면 무한 반복할 수 있다. 충분히 안정적으로 연결되었는지 확인한 뒤에만 실패 구간을 끝낸다. 정상적으로 변화가 없는 화면도 있으므로, 안정화 판단을 상태 변경 수신에만 의존하지 않는다.

### 3.3 접속 빈도·활성 연결·재생 부하는 다른 한도로 보호한다

**접속 빈도 제한**은 일정 시간에 들어오는 요청 수를 제한한다. 반면 **활성 연결 슬롯**은 지금 유지 중인 구독이 차지하는 자원 한 칸이다. 예를 들어 초당 신규 요청이 한 건뿐이어도 연결이 오래 유지되면 활성 구독은 계속 늘 수 있다. 연결 수가 그대로여도 오래된 커서가 한꺼번에 돌아오면 이력 조회가 DB를 바쁘게 만들 수 있다.

| 보호 대상 | 적용 지점 | 제한에 걸렸을 때 |
| --- | --- | --- |
| 짧은 시간에 너무 많은 요청 | 인증 전의 게이트웨이와 인증 후 사용자별 요청률 | 정책에 따라 429. 비싼 조회 전에 거절할 수 있게 한다. |
| 오래 유지되는 활성 구독 | 인스턴스 전체 및 인증된 사용자별 슬롯 | 사용자 한도면 429, 서버 용량 부족이나 드레이닝이면 503으로 응답하는 예시 정책이다. |
| 이력 조회·스트림 전송 처리량 | 재생 작업의 동시 실행 수, 배치 크기·최대 대기열 | 작업을 무한히 쌓지 않는다. 응답이 열렸다면 정리하고 다시 재생할 수 있게 한다. |

다음 `SseSlots.java`는 `src/main/java/com/example/upload/`에 둘 수 있는 **Java 21 클래스 전체**다. 한 인스턴스에서 이 객체 하나를 공유한다. 인증된 사용자의 안정적인 서버 측 키를 받고, 스트림을 열기 전에 검사와 예약을 같은 잠금에서 수행한다. 레이트 리미터, Spring Bean 등록과 HTTP 응답 매핑, 구독 정리는 호출부의 책임이다.

```java
package com.example.upload;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public final class SseSlots {
    public enum Refusal { DRAINING, USER_FULL, SERVER_FULL }
    public sealed interface Admission permits Lease, Rejected {}
    public record Rejected(Refusal reason) implements Admission {}

    private final Map<String, Integer> bySubject = new HashMap<>(); // 활성 슬롯이 있는 사용자만 저장한다.
    private final int totalLimit;
    private final int userLimit;
    private int active;
    private boolean draining;

    public SseSlots(int totalLimit, int userLimit) {
        if (userLimit < 1 || totalLimit < userLimit) throw new IllegalArgumentException("invalid limits");
        this.totalLimit = totalLimit;
        this.userLimit = userLimit;
    }

    public synchronized Admission tryAcquire(String subject) {
        Objects.requireNonNull(subject); // 클라이언트가 임의로 보낸 키가 아니라 인증 결과를 넘긴다.
        if (draining) return new Rejected(Refusal.DRAINING); // 종료를 시작한 인스턴스는 새 슬롯을 받지 않는다.
        int used = bySubject.getOrDefault(subject, 0);
        if (used >= userLimit) return new Rejected(Refusal.USER_FULL);
        if (active >= totalLimit) return new Rejected(Refusal.SERVER_FULL);
        bySubject.put(subject, used + 1); // 검사와 예약 사이에 다른 요청이 끼어들지 못한다.
        active++;
        return new Lease(subject); // 나중에 이 슬롯만 돌려줄 수 있는 내부 핸들이다.
    }

    public synchronized void beginDrain() {
        draining = true; // tryAcquire와 같은 잠금이므로 전환 이후의 예약은 모두 거절한다.
    }

    public final class Lease implements Admission, AutoCloseable {
        private final String subject;
        private boolean released;

        private Lease(String subject) { this.subject = subject; }

        @Override
        public void close() {
            synchronized (SseSlots.this) { // 예약과 반환이 같은 상태를 같은 잠금으로 바꾼다.
                if (released) return; // 완료·오류·timeout 콜백이 겹쳐도 한 번만 반환한다.
                released = true;
                active--;
                int left = bySubject.get(subject) - 1;
                if (left == 0) bySubject.remove(subject); // 끝난 사용자의 키를 계속 보관하지 않는다.
                else bySubject.put(subject, left);
            }
        }
    }
}
```

한도를 넘으면 `Rejected`라서 슬롯이 생기지 않는다. `Lease`를 받은 호출부는 인증 이후의 구독 준비가 실패하면 바로 반환하고, 정상 스트림은 **실제 구독 작업과 대기열을 정리한 뒤** 반환한다. 컨트롤러 메서드가 비동기 SSE 응답 객체를 반환했다고 연결이 끝난 것은 아니므로 그 메서드에 단순히 `try-with-resources`로 슬롯을 묶지 않는다. 이 잠금 안에서는 네트워크나 DB를 호출하지 않는다.

위 클래스는 프로세스 하나의 수만 센다. 인스턴스 세 대가 각각 사용자당 2개를 허용하면 한 사용자의 전체 상한이 자동으로 2가 되지는 않는다. 또 예약 직후, 구독 목록 등록 전에 종료가 시작될 수 있다. 호출부는 등록과 드레이닝 대상 수집을 같은 생명주기 규칙으로 묶거나, 등록 뒤 드레이닝 여부를 다시 확인해 누락된 구독을 정리한다.

### 3.4 드레이닝은 새 연결 차단과 기존 연결 정리의 순서다

**드레이닝(drain)**은 종료할 인스턴스가 새 요청을 받지 않도록 전환한 뒤, 이미 열려 있는 연결을 유예 시간 안에 정리하는 과정이다. **readiness**는 로드밸런서가 이 인스턴스로 새 트래픽을 보낼 수 있는지 판단하는 신호다. 상태를 바꾸고 나서도 반영 지연이 있을 수 있으므로 애플리케이션의 연결 슬롯도 먼저 닫는다. [Spring Boot readiness와 종료](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html#actuator.endpoints.kubernetes-probes), [Kubernetes Pod 종료](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination-flow)

1. 다른 인스턴스가 준비됐고 재생까지 감당할 여유가 있는지 확인한다. 종료 대상은 새 SSE 슬롯을 막고 readiness를 내린다.
2. 로드밸런서가 대상을 제외하는 동안에도 기존 연결은 유예한다. 연결별 작은 시차로 닫아 모든 화면이 동시에 이동하지 않도록 한다.
3. 이미 전송 중인 프레임은 가능한 한 완료한다. 새 커서를 강제로 전진시키지 않는다. 유예가 끝나면 남은 작업을 취소하고 슬롯을 반환한다.
4. 정리가 끝나거나 유예가 만료되면 프로세스 종료를 진행한다. 느린 소비자의 쓰기가 막혀 있어도 유예를 무한히 연장하지 않는다.

기존 연결이 닫힌 화면은 프로세스가 완전히 종료되기 전에도 다른 인스턴스로 옮겨갈 수 있다. 새 서버는 공유 저장소의 watch·이력을 읽고 권한을 다시 검사한 뒤, 마지막 적용 커서 이후를 재생하거나 보존 범위 밖의 자원만 `reset`한다.

이 순서의 1~3은 애플리케이션과 배포 도구가 조정할 **사전 종료 설계**다. Spring Boot 4.1.2의 graceful shutdown은 컨텍스트가 닫힐 때 기존 HTTP 요청에 유예 시간을 주지만, 오래 열어 둔 SSE 구독을 알아서 나눠 닫거나 커서를 다른 서버에 이전하지 않는다. `spring.lifecycle.timeout-per-shutdown-phase`는 한 종료 단계의 상한이다. 배포 환경의 전체 종료 시간에 라우팅 반영·사전 종료 훅·애플리케이션 종료 단계를 함께 계산한다. Kubernetes에서는 `preStop` 실행도 Pod 종료 유예 시간 안에 들어간다. [Spring Boot Graceful Shutdown](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html), [Kubernetes 종료 순서](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination-flow)

⚠️ 주의: 종료 직전에 연결 목록을 한 번 순회했다고 정리가 끝난 것은 아니다. 등록 중인 구독과 느린 소비자도 확인한다. 마지막 프레임의 `send()` 반환은 화면 적용 확인이 아니므로, 종료 안내나 마지막 발송 로그만 보고 브라우저의 커서를 새 값으로 바꾸지 않는다.

### 3.5 실행한 검사와 실제 배포 확인을 나눈다

저장소 루트에서 [재시도 정책 검사](./check_sse_retry.mjs)를 실행한다. 노트의 JavaScript 코드 펜스를 읽어 고정 난수로 실행하므로 Node.js 24 외에는 별도 서버·패키지가 필요하지 않다.

```powershell
# 실제로 재접속하지 않고 예약 판단과 지연 범위를 검증한다.
node --test SpringBoot/55_11_13_SSE_Reconnect_Storms_and_Graceful_Drain/check_sse_retry.mjs
```

Node.js 24.18.0에서 **10개 테스트 통과**를 확인했다. 이 결과는 재시도 판단과 시간 예산의 검증이다. Java 슬롯 동시성, 브라우저 네트워크 취소, 롤링 배포는 아래 조건으로 별도 검증한다.

| 미실행 시험 | 예상 확인 결과 |
| --- | --- |
| 같은 사용자와 다른 사용자의 동시 예약·반환 | 두 한도 모두 넘지 않고, 중복 정리 뒤에도 슬롯이 새지 않는다. |
| 등록과 드레이닝이 겹침 | 종료 대상에서 빠지는 구독이 없으며 readiness 전파 중의 새 요청도 거절한다. |
| 같은 연결의 중간 프레임에서 단절 | 적용하지 않은 위치를 건너뛰지 않고, 다른 인스턴스에서 이어 읽는다. |
| 여러 테스트 화면을 제한된 환경에서 동시에 이동 | 초당 등록·거절 횟수, 활성 연결, DB 재생 대기와 화면 반영 지연을 함께 본다. |

## 4. 적용 관점에서 다시 보기

먼저 자동 재연결을 누가 소유할지 결정한다. 앱이 상태와 헤더를 읽어 재시도한다면, 기존 연결을 닫고 기다리는 작업도 하나만 유지한다. 그다음 서버에 도착률·활성 슬롯·이력 재생 한도를 각각 두어, 클라이언트가 지연 안내를 받지 못해도 자원이 고갈되지 않게 한다.

배포 시험에서는 새 요청이 다른 인스턴스로 이동하는지뿐 아니라 기존 구독이 정해진 시간 안에 사라지고 화면이 누락 없이 복구되는지 확인한다. 연결이 잘 닫혀도 이력 조회가 밀릴 수 있으므로, 종료 사유와 재연결 수, 첫 상태 반영 지연을 함께 읽는다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

백오프와 지터는 재연결 시점을 흩뜨린다. 서버 자원은 별도의 한도로 보호하고, 배포 종료의 성공은 남은 구독 정리와 다른 인스턴스에서의 복구까지 확인해야 판단할 수 있다.

### 5.2 이전·다음 학습과의 연결

[SSE 운영 관측성](../54_11_12_SSE_Observability_and_Troubleshooting/11_12_SSE_Observability_and_Troubleshooting.md)의 연결·종료·지연 지표를 배포 중의 판단 근거로 사용했다. 다음에는 **SSE 용량 계획과 부하 테스트**에서 정상 연결과 복구 트래픽을 나눠 필요한 여유를 추정한다.

### 5.3 더 파볼 만한 주제

서버를 한 대씩 교체할 때도 공유 DB가 먼저 포화되는지 살펴볼 수 있다. 구독 수가 많은 화면에서 SSE 다중화나 제한된 폴링이 연결과 조회 비용을 어떻게 바꾸는지도 비교해 볼 만하다.

### 5.4 참고 자료

- [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html), [Fetch 표준](https://fetch.spec.whatwg.org/) — 자동 재연결과 SSE 필드, 앱이 응답을 다루는 별도 경로.
- [RFC 9110 Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), [RFC 6585 429](https://www.rfc-editor.org/rfc/rfc6585.html#section-4), [AWS Builders' Library](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) — 재요청 지연과 분산.
- [Spring Boot Graceful Shutdown](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html), [Spring Boot Actuator](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html#actuator.endpoints.kubernetes-probes), [Kubernetes Pod 종료](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination-flow) — readiness, 컨텍스트 종료, 전체 유예 시간의 경계.

## 6. 요약 정리

- EventSource와 앱의 재연결을 동시에 실행하지 않는다.
- SSE의 `retry:`와 HTTP의 `Retry-After`는 전달 위치와 처리 주체가 다르다.
- 지터로 시점을 흩뜨리고, 시도 횟수와 시간 예산도 제한한다.
- 요청률, 활성 연결, 재생 작업 한도는 서로 다른 자원을 보호한다.
- 드레이닝은 새 연결을 막고 기존 구독을 유예 시간 안에 나눠 종료한다.
- 재연결은 실제로 적용한 커서부터 시작하고, 새 서버에서도 권한과 보존 범위를 다시 확인한다.

🧠 기억할 것: 연결은 닫아도, 마지막으로 적용한 위치는 건너뛰지 않는다.

## 7. 미니 퀴즈 또는 체크리스트

1. 모든 연결에 같은 백오프를 주면 어떤 일이 다시 생길 수 있는가?
2. Fetch 응답이 `Retry-After: 5`인데 재시도 예산이 2초 남았다면 어떻게 해야 하는가?
3. SSE 컨트롤러가 응답 객체를 반환하자마자 활성 슬롯을 돌려주면 왜 안 되는가?
4. readiness를 내리는 일만으로 기존 SSE 연결이 나눠서 닫히는가?
5. 마지막 프레임이 서버에서 반환됐지만 화면이 적용하지 않았다면 어느 위치에서 이어 읽는가?

<details>
<summary>정답과 해설</summary>

1. 함께 실패한 요청이 같은 시점에 다시 모일 수 있다. 지터를 넣고 서버 한도를 별도로 유지한다.
2. 서버가 제시한 최소 대기 시간을 줄이지 않는다. 남은 예산 안에서는 자동 재시도를 멈춘다.
3. 응답 객체 반환 이후에도 구독과 전송이 계속되기 때문이다. 실제 정리 뒤 반환해야 한도가 맞는다.
4. 아니다. 새 라우팅과 이미 열린 응답은 별개다. 앱이 기존 구독을 시차를 두고 정리해야 한다.
5. 마지막 **적용** 위치다. 서버에서 보냈다는 기록을 반영 확인으로 쓰면 적용하지 않은 프레임을 빠뜨릴 수 있다.

</details>
