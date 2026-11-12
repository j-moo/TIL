# Spring Boot SSE 운영 관측성·메트릭과 장애 진단

- 🎯 글의 목표: SSE 활성 연결·종료 사유·첫 전송·화면 반영을 각각 측정하고, 지연이 생긴 구간을 지표로 좁힌다.
- 🧩 핵심 키워드: Gauge, Counter, Timer, 히스토그램, PromQL, 합성 점검, 단조 시계
- ⭐ 중요도: 높음. 서버가 전송을 시도했다는 기록과 사용자가 상태를 볼 수 있었다는 증거는 다르다.
- 📝 한눈에 보는 내용: 관측 경계 정의 → 연결 수명 계측 → 인스턴스별 지표 합산 → 알려진 상태 전이로 화면 반영 검증
- 🔗 관련 주제: [SSE 통합 테스트·권한 철회와 프록시 검증](../53_11_10_SSE_Integration_Testing_and_Proxy_Verification/11_10_SSE_Integration_Testing_and_Proxy_Verification.md), [Spring Boot 운영 기초](../12_09_08_Operations_Logging_and_Actuator/09_08_Operations_Logging_and_Actuator.md)
- 🧱 선수 지식: SSE 연결·재생 커서, HTTP 응답, Actuator의 역할

> 2026-11-12 기준. Java 21·Spring Boot 4.1.2(Spring Framework 7.0.10, Micrometer 1.17.2) 기준의 계측 예제와 Prometheus 클래식 히스토그램 쿼리를 설명한다. 화면 측정 모듈은 Node.js 24.18.0에서 검증했다. Spring·Prometheus·실제 브라우저의 배포 검증은 미실행이다.

## 1. 들어가며

업로드 상태 페이지에서 “검사가 끝났는데 화면이 늦게 바뀐다”는 신고가 들어왔다. 서버 로그에는 이벤트를 보냈다고 나오고, HTTP 응답도 200이다. 그렇다면 상태가 늦게 확정됐을까, 프록시가 응답을 모아 보냈을까, 브라우저가 받아 놓고 화면에 적용하지 못했을까?

이전 노트에서는 **SSE(Server-Sent Events)** 연결을 끊고 다시 열어 이런 경계를 재현했다. 이번에는 **관측성**, 즉 실행 중에 남긴 신호로 서비스 내부의 상태를 추론하는 방법을 배운다. 상태를 바꾸는 코드는 그대로 두고, 무엇을 언제 측정해야 원인을 좁힐 수 있는지에 집중한다.

## 2. 핵심 개념 정리

```text
서버: 구독 등록 → 첫 상태 전송 호출 반환 → 구독·작업 정리
클라이언트: 점검 시작 → 연결 열림 → 예상한 상태가 화면 모델에 반영됨
             └─ 화면 반영 전에 닫히거나 마감 시간을 넘기면 별도 결과로 기록
진단: 서버 지표와 점검 결과가 갈리는 지점을 찾아 DB·프록시·화면 중 다음 확인 대상을 선택
```

지표를 붙이기 전에 시작점과 끝점을 말로 설명할 수 있어야 한다. 이름에 “첫 이벤트”라고만 적으면 서버가 작성한 시점과 브라우저가 적용한 시점을 구별할 수 없다.

## 3. 본문 정리

### 3.1 연결 수와 이벤트 반영 시간을 따로 센다

**메트릭**은 시간에 따라 숫자로 모은 측정값이다. 현재 열린 관찰 작업은 위아래로 바뀌는 **Gauge**, 지금까지 등록한 작업 수는 증가를 누적하는 **Counter**, 경과 시간은 횟수와 시간을 함께 기록하는 **Timer**로 표현한다. 예를 들어 연결 하나가 종료되면 활성 Gauge는 1 내려가지만, 시작 Counter를 되돌리지는 않는다. [Micrometer Gauges](https://docs.micrometer.io/micrometer/reference/concepts/gauges.html), [Timers](https://docs.micrometer.io/micrometer/reference/concepts/timers.html)

| 이름 | 언제 기록하는가 | 무엇을 뜻하지 않는가 |
| --- | --- | --- |
| `sse.connections.active` | 허용된 구독을 등록하면 +1, 구독과 작업 정리가 끝나면 −1 | TCP 소켓 수나 고유 사용자 수 |
| `sse.connections.started` | 관찰 작업을 등록할 때 한 번 증가. 검증된 재개 헤더 사용 여부를 구분 | 모든 재연결 또는 최초 연결 횟수 |
| `sse.connection.lifetime` | 등록부터 정리까지를 종료 사유별로 기록 | 첫 이벤트 지연 |
| `sse.first.send` | 첫 상태 프레임의 `send()`가 반환했을 때 등록 이후 경과 시간 기록 | 프록시 통과·브라우저 수신·화면 반영 |
| `sse.connections.no.first.send` | 첫 상태 전송 반환을 기록하기 전에 정리됐을 때 증가 | 장애 건수. 변화 없이 정상 대기하다 닫혔을 수도 있다. |

**재개 커서**는 연결이 끊겼을 때 어디부터 다시 읽을지 알려 주는 위치다. 브라우저가 같은 `EventSource` 객체로 재연결하더라도 마지막 이벤트 ID가 없다면 서버에 헤더가 오지 않을 수 있다. 또 새 객체가 URL의 `after` 값으로 재개하는 경우도 있다. 그러므로 `resume=header`는 **검증된 Last-Event-ID를 사용해 등록한 요청**만 세며, 나머지를 “신규 사용자”라고 부르지 않는다. [WHATWG Last-Event-ID](https://html.spec.whatwg.org/dev/server-sent-events.html#the-last-event-id-header)

⚠️ 주의: Spring Framework 7.0.10의 `ResponseBodyEmitter`는 응답 처리기가 준비되기 전의 전송 요청을 내부에 보관할 수 있다. `SseEmitter.send()`가 정상 반환한 시점은 애플리케이션이 관찰할 수 있는 경계일 뿐, 브라우저에 데이터가 도착했다는 확인이 아니다. [Spring Framework 7.0.10 ResponseBodyEmitter 소스](https://github.com/spring-projects/spring-framework/blob/v7.0.10/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/ResponseBodyEmitter.java)

### 3.2 종료 콜백이 겹쳐도 지표는 한 번만 기록한다

**Micrometer**는 Java 애플리케이션의 지표를 등록하고 수집 시스템으로 내보내는 라이브러리다. 다음 `SseMeters.java`는 기존 Spring MVC 애플리케이션의 `src/main/java/com/example/upload/`에 추가하는 **계측 클래스 전체**다. `spring-boot-starter-actuator`와 Prometheus로 내보내기 위한 `micrometer-registry-prometheus`를 Boot 의존성 관리로 추가한다. 실제 업로드 API·구독 작업·종료 처리 코드는 포함하지 않는다. [Spring Boot 메트릭](https://docs.spring.io/spring-boot/reference/actuator/metrics.html), [Boot 관리 버전](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)

```java
package com.example.upload;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

@Component
public final class SseMeters {
    public enum End { COMPLETED, ASYNC_TIMEOUT, IO_ERROR, ACCESS_REVOKED, SERVER_ERROR }

    private final MeterRegistry registry;
    private final AtomicInteger active = new AtomicInteger(); // Gauge가 읽는 값을 Bean이 계속 참조한다.
    private final Counter withHeader;
    private final Counter withoutHeader;
    private final Counter noFirstSend;
    private final Timer firstSend;
    private final EnumMap<End, Timer> lifetimes = new EnumMap<>(End.class); // 종료 사유 집합을 제한한다.

    public SseMeters(MeterRegistry registry) {
        this.registry = registry;
        Gauge.builder("sse.connections.active", active, AtomicInteger::get).register(registry);
        withHeader = registry.counter("sse.connections.started", "resume", "header");
        withoutHeader = registry.counter("sse.connections.started", "resume", "none");
        noFirstSend = registry.counter("sse.connections.no.first.send");
        firstSend = Timer.builder("sse.first.send")
                .publishPercentileHistogram() // 인스턴스끼리 합칠 수 있는 시간 구간별 카운트를 발행한다.
                .serviceLevelObjectives(Duration.ofMillis(500)) // 0.5초 이하 비율을 직접 셀 예시 경계다.
                .register(registry);
        for (End end : End.values()) {
            // 예외 메시지 대신 정해진 이름을 쓴다. 종료 타이머의 count가 정리 횟수다.
            lifetimes.put(end, registry.timer("sse.connection.lifetime", "reason", end.name().toLowerCase(Locale.ROOT)));
        }
    }

    public Connection registered(boolean usedLastEventId) {
        // 구독 등록 성공 경계에서 한 번만 호출하고, 전송·정리 작업에 같은 객체를 넘긴다.
        var connection = new Connection(Timer.start(registry), Timer.start(registry));
        active.incrementAndGet();
        (usedLastEventId ? withHeader : withoutHeader).increment();
        return connection;
    }

    public final class Connection {
        private final Timer.Sample first; // 같은 등록 경계에서 첫 전송까지 걸린 시간을 잰다.
        private final Timer.Sample lifetime; // 첫 전송이 끝나도 정리까지는 별도로 잰다.
        private boolean firstRecorded;
        private boolean closed;

        private Connection(Timer.Sample first, Timer.Sample lifetime) {
            this.first = first;
            this.lifetime = lifetime;
        }

        public synchronized void stateSendReturned() {
            if (closed || firstRecorded) return; // 정리 이후 또는 두 번째 상태부터는 기록하지 않는다.
            firstRecorded = true;
            first.stop(firstSend);
        }

        public synchronized void cleaned(End end) {
            if (closed) return; // timeout·오류·완료가 겹쳐도 Gauge를 두 번 내리지 않는다.
            Objects.requireNonNull(end);
            closed = true;
            active.decrementAndGet(); // 실제 구독과 작업 정리가 끝난 시점에만 호출한다.
            if (!firstRecorded) noFirstSend.increment(); // 첫 반환을 기록하지 못한 연결을 따로 센다.
            lifetime.stop(lifetimes.get(end));
        }
    }
}
```

연결마다 `Connection` 하나를 만들고, 순차 전송 루프의 **상태 이벤트** `send()`가 정상 반환한 다음 `stateSendReturned()`를 호출한다. 연결 유지용 주석은 호출 대상이 아니다. 두 메서드의 `synchronized`는 같은 객체의 지표 상태를 동시에 바꾸지 못하게 한다. 이 잠금 안에서 실제 전송·DB 조회·구독 정리를 수행하지 않는다. Gauge는 순간값을 읽으므로 수집 사이에 열렸다 닫힌 연결은 Gauge에 보이지 않을 수 있지만, 시작 Counter에는 남는다. [Micrometer Gauge의 참조와 수집 시점](https://docs.micrometer.io/micrometer/reference/concepts/gauges.html)

호출부의 종료 경로는 **먼저 사유를 확정 → 실제 작업·타이머·등록 정보 정리 → `cleaned(reason)` 호출** 순으로 통합한다. 예를 들어 권한 철회로 `complete()`를 호출하면 나중에 완료 콜백도 올 수 있으므로, 그 콜백에서 무조건 `COMPLETED`로 바꾸지 않는다. 쓰기 오류는 상대가 탭을 닫았는지 프록시가 닫았는지까지 알려 주지 않으므로 `IO_ERROR`로 분류한다. 정리가 전송 반환의 기록보다 앞서면 `no.first.send`에 포함된다. 이는 “전송 시도가 없었다”는 뜻이 아니다.

**카디널리티**는 지표를 나누는 값 조합이 얼마나 많은지를 뜻한다. `reason`에 다섯 값만 쓰면 인스턴스당 다섯 계열로 제한되지만, 업로드 UUID나 사용자 ID를 붙이면 건수마다 새 계열이 생긴다. 고유 ID·재개 커서·쿠키·파일 이름·예외 원문은 태그에 넣지 않는다. 조사에 로그가 필요하면 권한을 제한하고 헤더·본문을 그대로 남기지 않는 별도 기록 정책을 둔다. [Prometheus 레이블 비용](https://prometheus.io/docs/practices/instrumentation/#do-not-overuse-labels)

### 3.3 Prometheus에서는 누적값의 증가율을 먼저 계산한다

**Prometheus**는 애플리케이션의 지표를 주기적으로 읽어 저장하는 도구이며, **PromQL**은 저장한 시계열을 조회하는 언어다. Spring Boot는 레지스트리를 구성한 뒤 Actuator의 `/actuator/prometheus`에서 지표를 노출할 수 있다. 예를 들어 관리 경로에 `management.endpoints.web.exposure.include=health,prometheus`를 설정하되, 수집기만 접근하도록 관리 네트워크·인증을 따로 구성한다. 노출 설정 자체가 접근 통제는 아니다. [Spring Boot Prometheus](https://docs.spring.io/spring-boot/reference/actuator/metrics.html#actuator.metrics.export.prometheus), [Actuator 보안](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html#actuator.endpoints.security)

다음은 Prometheus 화면에서 **한 식씩** 평가하는 교육용 예시다. `job="upload"`는 실제 수집 작업 이름으로 맞추고, 지표 이름과 레이블은 실제 노출 결과에서 확인한다. 마이크로미터에서 점으로 구분한 이름은 이 레지스트리에서 밑줄로, 타이머 값은 초 단위 계열로 노출된다. [Micrometer의 Prometheus 매핑](https://docs.micrometer.io/micrometer/reference/implementations/prometheus.html)

```promql
# 현재 전체 관찰 작업 수: Gauge는 순간값을 그대로 합친다.
sum(sse_connections_active{job="upload"})

# 최근 5분 종료 사유별 초당 정리 횟수: 인스턴스마다 증가율을 먼저 계산한다.
sum by (reason) (rate(sse_connection_lifetime_seconds_count{job="upload"}[5m]))

# 초당 승인된 등록 중 재개 헤더 사용 비율: 등록이 없으면 비율도 표시하지 않는다.
(
  sum(rate(sse_connections_started_total{job="upload",resume="header"}[5m]))
  / sum(rate(sse_connections_started_total{job="upload"}[5m]))
)
and on () (sum(rate(sse_connections_started_total{job="upload"}[5m])) > 0)
```

`rate()`는 최근 구간의 초당 평균 증가율을 구하며, 프로세스가 재시작해 Counter가 작아진 경우도 처리한다. 그래서 Counter를 합쳐 놓고 `rate()`를 적용하지 않는다. 활성 수가 갑자기 떨어졌을 때는 트래픽 감소로 결론 내리기 전에 `up{job="upload"}`와 배포 이력을 함께 확인한다. 수집에 실패한 인스턴스는 “활성 연결 0”과 다르다. [Prometheus rate()](https://prometheus.io/docs/prometheus/latest/querying/functions/#rate)

**히스토그램**은 측정한 시간이 어느 구간까지 들어갔는지 센다. 아래의 **p95**는 관측한 시간 중 약 95%가 그 값 이하인 지점이다. 예를 들어 100개 중 98개가 500ms 이하면, 그 경계에서의 충족률은 98%다. p95는 구간별 분포에서 추정하고, 500ms 비율은 직접 만든 경계의 카운트로 계산한다.

```promql
# 앱의 첫 send 반환 시간 p95: 인스턴스의 p95끼리 평균하지 않고 구간(le)별로 먼저 합친다.
histogram_quantile(0.95, sum by (le) (rate(sse_first_send_seconds_bucket{job="upload"}[5m])))

# 성공적으로 반환을 기록한 표본 중 0.5초 이내 비율이다. le 표기는 스크레이프 결과를 확인한다.
sum(rate(sse_first_send_seconds_bucket{job="upload",le="0.5"}[5m]))
/
sum(rate(sse_first_send_seconds_count{job="upload"}[5m]))
```

⚠️ 주의: 이 두 식은 **첫 send 반환을 기록한 표본**만 본다. 연결부터 새 상태가 생길 때까지의 정상 대기도 포함하므로, 순수 전송 처리 시간이나 화면 성공률로 해석하지 않는다. 지연 경보는 최소 표본 수·평가 기간을 함께 정하고, 첫 이벤트가 반드시 발생하는 경로는 별도의 점검으로 확인한다. [Micrometer 히스토그램](https://docs.micrometer.io/micrometer/reference/concepts/histogram-quantiles.html), [Prometheus histogram_quantile()](https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile)

### 3.4 화면 성공은 알고 있는 전이가 적용됐을 때만 기록한다

평상시 업로드에 변화가 없다면 상태 프레임이 없는 것이 정상이다. **합성 점검**은 결과를 알고 있는 전용 테스트 시나리오를 만들어 서비스 경로를 확인하는 방식이다. 예를 들어 전용 watch를 준비하고, 점검을 시작한 뒤 테스트 업로드에 기대하는 상태 전이를 한 번 만든다. 연결이 열렸다는 `open`과 그 전이가 화면 모델에 **반영된 시점**을 따로 잰다. 운영 사용자의 업로드를 점검 대상으로 사용하지 않는다.

아래 `sse-probe.mjs`는 **시간 판단 모듈 전체**다. 호출자는 연결을 열기 직전에 생성하고, 같은 실행의 `open` 콜백과 예상 상태가 화면 모델에 실제 반영된 뒤의 값을 전달한다. 브라우저에서는 `performance.now()`를 사용해 같은 실행 안의 경과 시간을 구한다. 서버의 나노초 값과 빼거나 서로 다른 머신의 벽시계 차이로 전달 시간을 계산하지 않는다. [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/)

```javascript
export function createSseProbe({ matches, budgetMs, now = () => performance.now() }) {
  if (typeof matches !== "function" || !Number.isFinite(budgetMs) || budgetMs <= 0) {
    throw new TypeError("비교 함수와 양수 시간 예산이 필요합니다.");
  }
  const startedAt = now(); // 같은 시계에서 재서 시작과 종료의 차이만 사용한다.
  let firstOpenMs = null; // 재연결돼도 첫 open까지의 시간은 덮어쓰지 않는다.
  let settled = false; // 하나의 점검이 성공과 실패를 둘 다 보고하지 못하게 한다.

  const elapsed = () => now() - startedAt;
  function finish(outcome, elapsedMs) {
    settled = true;
    return { outcome, elapsedMs, firstOpenMs }; // 업로드 ID, revision, 세션 값은 내보내지 않는다.
  }

  return {
    opened() {
      if (!settled && firstOpenMs === null) firstOpenMs = elapsed();
    },
    applied(state) {
      if (settled || !matches(state)) return null; // 다른 업로드나 오래된 상태는 합격 근거가 아니다.
      const ms = elapsed();
      return finish(ms < budgetMs ? "applied" : "deadline", ms); // 늦게 실행된 타이머로 성공 범위가 늘어나지 않는다.
    },
    deadline() {
      if (settled) return null;
      const ms = elapsed();
      return ms >= budgetMs ? finish("deadline", ms) : null; // 마감 전에는 점검을 끝내지 않는다.
    },
    stopped() {
      if (settled) return null;
      const ms = elapsed();
      return finish(ms < budgetMs ? "closed" : "deadline", ms); // 실제 관찰 종료만 알린다.
    },
  };
}
```

`matches`는 테스트에서 정한 ID·revision·상태의 일치를 확인하는 함수다. `open`이나 임시 오류만으로 점검을 끝내지 않는다. 실제 종료가 확인되면 `stopped()`를 호출하고, 호출부 타이머가 마감에 도달하면 `deadline()`을 호출한다. 타이머가 일찍 실행되어 결과가 `null`이라면 남은 시간에 다시 확인한다. 결과를 한 번 받으면 연결·타이머를 정리한다. 이 모듈은 연결·상태 변경·원격 결과 전송을 직접 구현하지 않는다.

### 3.5 어떤 조합에서 무엇을 먼저 확인할지 정한다

지표는 원인을 단정하는 증거가 아니라 다음 검사 대상을 고르는 단서다. 예를 들어 서버의 첫 전송 시간이 정상인데 합성 점검만 늦다면, 두 값의 시작점이 서로 다름을 감안하면서 원본 직접 연결과 프록시를 거친 연결부터 비교한다.

| 관찰 조합 | 먼저 확인할 것 |
| --- | --- |
| 헤더 사용 비율과 `ASYNC_TIMEOUT` 정리가 함께 증가 | 최근 배포와 서블릿 시간 제한. 이전부터 정해진 만료 주기가 아닌지 확인한다. |
| 첫 send 지연과 화면 반영 지연이 함께 증가 | 검사가 상태를 확정하기까지의 대기, 확정 이후 조회, 작업 대기열, 이벤트 직렬화·전송 경계 |
| 서버 send 시간은 정상인데 화면 점검만 지연 | 프록시 버퍼링·응답 경로와 브라우저 상태 적용을 분리한다. |
| 화면을 닫았는데 활성 수가 회복되지 않음 | 실제 작업·타이머 정리가 끝났는지와 Gauge 계측이 같은 지점을 가리키는지 확인한다. |

서버·프록시·브라우저의 시계를 맞추지 않고 숫자를 빼서 지연을 계산하지 않는다. [이전 노트의 실습](../53_11_10_SSE_Integration_Testing_and_Proxy_Verification/11_10_SSE_Integration_Testing_and_Proxy_Verification.md)처럼 같은 테스트에서 프레임을 기준으로 두 경로를 비교하고, 화면 합성 점검은 `applied / 점검 횟수`를 별도로 본다. 첫 이벤트 없는 종료율은 원래 유휴 연결이 많은 화면이라면 단독 경보로 사용하지 않는다.

### 3.6 검증한 범위와 운영에서 확인할 범위를 나눈다

저장소 루트에서 [측정 모듈 회귀 검사](./check_sse_probe.mjs)를 실행한다. 문서의 JavaScript 코드 펜스를 읽어 가짜 단조 시계로 실행하므로, Node.js 24 외에 별도 패키지와 서버가 필요하지 않다.

```powershell
# open·적용·마감·중복 종료의 순서를 네트워크 없이 확인한다.
node --test SpringBoot/54_11_12_SSE_Observability_and_Troubleshooting/check_sse_probe.mjs
```

Node.js 24.18.0에서 **9개 테스트 통과**를 확인했다. 다른 상태의 무시, 첫 open 보존, 화면 반영 결과, 연결 종료, 마감 경계, 늦은 이벤트, 중복 종료, 식별자 미노출을 확인했다. 운영에서는 Micrometer 등록 코드의 실행과 실제 Prometheus 출력, 두 종료 콜백이 겹쳤을 때 정리 횟수와 Gauge, 표본이 없는 쿼리, 브라우저에서의 화면 반영을 별도로 검증해야 한다.

## 4. 적용 관점에서 다시 보기

먼저 구독 등록·정리·첫 상태 전송이라는 세 지점에 서버 계측을 붙인다. 그다음 실제 노출 지표에서 계열·단위를 확인하고, Gauge는 현재값을, Counter는 인스턴스별 증가율을 합친다. 유휴 연결은 정상 동작일 수 있으므로 점검용 상태 전이를 발생시키는 별도 시나리오를 준비한다.

장애를 조사할 때는 먼저 수집 자체가 정상인지 보고, 서버와 화면의 지연이 같이 늘었는지 비교한다. 그다음 이전 실습의 직접 연결과 프록시 경로 비교를 반복한다. 모든 경우에 “send 반환”과 “화면 모델 반영”을 서로 다른 이름으로 기록한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

관측 지표에는 시작과 끝이 있어야 한다. 서버에 필요한 운영 신호와 사용자 경험의 증거를 따로 측정해야 같은 숫자에 다른 의미를 붙이지 않는다.

### 5.2 이전·다음 학습과의 연결

[SSE 통합 테스트](../53_11_10_SSE_Integration_Testing_and_Proxy_Verification/11_10_SSE_Integration_Testing_and_Proxy_Verification.md)에서 분리한 재연결·전송·정리 증거를 운영 지표로 옮겼다. 다음에는 **SSE 재연결 폭주·부하 제한과 점진적 종료**를 다뤄 재시작과 장애 복구 동안 부하를 분산하는 방법을 살펴본다.

### 5.3 더 파볼 만한 주제

배포 전후에 합성 점검 경로를 분리하고, 지연이 높을 때 로그와 트레이스를 어떤 접근 정책으로 연결할지 비교할 수 있다. 히스토그램 구간과 점검 예산은 실제 트래픽의 범위를 보고 조정한다.

### 5.4 참고 자료

- [Spring Boot 메트릭](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)과 [Actuator 보안](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html#actuator.endpoints.security) — Prometheus 수집 경로와 접근 통제.
- [Micrometer Gauge](https://docs.micrometer.io/micrometer/reference/concepts/gauges.html), [Timer](https://docs.micrometer.io/micrometer/reference/concepts/timers.html), [히스토그램](https://docs.micrometer.io/micrometer/reference/concepts/histogram-quantiles.html) — 측정 타입, 수명과 시간 구간.
- [Prometheus 함수](https://prometheus.io/docs/prometheus/latest/querying/functions/)와 [계측 지침](https://prometheus.io/docs/practices/instrumentation/) — 증가율·백분위와 레이블 비용.
- [Spring Framework 전송 코드](https://github.com/spring-projects/spring-framework/blob/v7.0.10/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/ResponseBodyEmitter.java), [WHATWG SSE](https://html.spec.whatwg.org/dev/server-sent-events.html), [W3C 시간 측정](https://www.w3.org/TR/hr-time-3/) — 서버 전송 경계, 자동 재개, 같은 실행의 경과 시간.

## 6. 요약 정리

- 활성 작업은 Gauge, 등록 횟수는 Counter, 첫 전송과 정리까지의 경과 시간은 Timer로 기록한다.
- 종료 사유를 먼저 확정하고 정리 완료를 한 번만 계측한다.
- 재개 헤더 비율을 전체 재연결 비율로, send 반환 시간을 화면 반영 시간으로 해석하지 않는다.
- Counter는 인스턴스별로 증가율을 구한 뒤 합산하고, p95는 구간을 합산한 뒤 추정한다.
- 유휴 SSE의 침묵은 정상일 수 있다. 전용 점검에서 예상한 전이를 실제로 반영했는지 본다.
- 개인 식별자나 전체 커서를 지표의 레이블로 사용하지 않는다.

🧠 기억할 것: 시간을 재기 전에 어디서 시작해 어디서 끝나는 시간을 잴지 먼저 정한다.

## 7. 미니 퀴즈 또는 체크리스트

1. 연결 하나가 정상적으로 정리될 때 활성 Gauge와 등록 Counter는 각각 어떻게 바뀌는가?
2. 재개 헤더가 없는 승인 요청을 모두 신규 연결로 집계하면 어떤 경우를 놓치는가?
3. 앱의 첫 send p95는 그대로인데 화면 점검만 늦어졌다. 무엇을 비교하는가?
4. 인스턴스 두 대의 p95를 평균하면 전체 p95가 되는가?
5. 아무 상태 변화도 없는 화면에서 첫 이벤트 미수신이 늘었다. 바로 장애 경보를 울려도 되는가?

<details>
<summary>정답과 해설</summary>

1. Gauge는 1 내려가고 Counter는 그대로다. 현재값과 누적 시작 횟수는 다르다.
2. 이벤트 ID를 받기 전에 자동 재연결하거나, 새 객체에서 `after`로 이어 보는 요청을 놓친다. 헤더 유무만 집계한다고 이름 붙인다.
3. 같은 조건의 원본 직접 연결과 프록시 경로, 브라우저 수신과 화면 적용을 따로 확인한다. 서버의 반환만으로 도착을 증명할 수 없다.
4. 아니다. 인스턴스마다 표본 수와 분포가 다르므로 구간별 카운트를 합친 뒤 전체 p95를 추정한다.
5. 아니다. 유휴 관찰과 실패를 구분하고, 알려진 전이를 실제로 발생시키는 점검에서도 화면 반영이 늦었는지 확인한다.

</details>
