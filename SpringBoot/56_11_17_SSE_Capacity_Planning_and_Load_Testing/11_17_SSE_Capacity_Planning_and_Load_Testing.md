# Spring Boot SSE 용량 계획과 부하 테스트

- 🎯 글의 목표: 평상시 연결 수와 재연결 시 재생 비용을 각각 추정하고, 상태 전달의 정확성과 지연을 함께 검증할 시험을 설계한다.
- 🧩 핵심 키워드: 리틀의 법칙, 연결 슬롯, 재생 조회량, 여유 용량, 개방형·폐쇄형 부하 모델, 복구 시간
- ⭐ 중요도: 높음. 평상시 연결 수를 감당한다는 사실만으로 재배포 직후의 재생 비용까지 감당할 수 있다는 뜻은 아니다.
- 📝 한눈에 보는 내용: 평균 활성 수 계산 → 인스턴스 한 대 제외 → 재생 비용과 여유 비교 → 시험 합격·중단 조건 정의
- 🔗 관련 주제: [SSE 재연결 폭주·부하 제한과 점진적 종료](../55_11_13_SSE_Reconnect_Storms_and_Graceful_Drain/11_13_SSE_Reconnect_Storms_and_Graceful_Drain.md), [SSE 운영 관측성](../54_11_12_SSE_Observability_and_Troubleshooting/11_12_SSE_Observability_and_Troubleshooting.md)
- 🧱 선수 지식: SSE 재연결·재생 커서, DB 배치 조회, 활성 연결과 누적 지표의 차이

> 2026-11-17 기준. Spring Boot 4.1.2·Spring MVC 7.0.10의 SSE 구성을 전제로 설명한다. 수치와 합격선은 가상의 학습 예시다. Node.js 24.18.0에서 계산 모듈만 검증했다. 실제 Spring 서버·DB·부하 도구는 실행하지 않았다.

## 1. 들어가며

업로드 관찰 화면 1,200개를 서버 세 대에 나누어 연결하고 있다고 하자. 서버 한 대를 교체한 뒤 남은 두 대도 1,200개 연결을 유지할 수 있다면 배포가 안전할까? 평소와 달리 끊긴 화면은 같은 시기에 로그인 확인과 재연결을 거쳐, 못 본 검사 상태를 한꺼번에 다시 읽는다.

이전 노트는 연결을 점진적으로 닫고 마지막 적용 위치에서 재개하는 법을 다뤘다. 이번에는 **용량 계획**을 세운다. 용량 계획은 목표 사용량을 감당하는 데 필요한 자원과 운영 여유를 수치로 가정하고, 그 가정을 시험으로 확인하는 과정이다. 먼저 정상 상태의 비용과 복구 시 추가 비용을 나눈다.

## 2. 핵심 개념 정리

```text
평상시: 실제 등록률 × 평균 유지 시간 → 평균 활성 구독
배포 중: 남은 인스턴스의 연결 슬롯과 재배치 편중 확인
재연결: 이동할 구독 수 ÷ 분산 시간 × 구독당 재생 조회 수 → 추가 DB 처리량
시험: 계획한 부하가 실제로 들어갔는지 확인 → 지연·누락·정리로 판정
```

연결 슬롯, 초당 도착, 초당 DB 처리량은 서로 단위가 다르다. “서버 두 대면 충분하다”는 결론 대신 **어느 자원이 어느 구간에서 충분한지**를 따로 확인한다.

## 3. 본문 정리

### 3.1 평균 등록률과 유지 시간으로 활성 구독을 추정한다

SSE(Server-Sent Events)는 서버가 열린 HTTP 응답으로 상태를 전달하는 방식이다. 여기서 **활성 구독**은 애플리케이션이 등록해 유지 중인 관찰 작업을 뜻한다. `EventSource` 객체 수, TCP 연결 수, 로그인 사용자 수와 반드시 같지는 않다.

**리틀의 법칙**은 같은 경계에서 장기간의 평균을 볼 때, 평균 시스템 내 개수 `L`이 평균 도착률 `λ`와 평균 체류 시간 `W`의 곱이라는 관계다. SSE에 적용하면 “실제로 등록된 초당 구독 수 × 등록부터 정리까지의 평균 초”가 된다. 예를 들어 초당 10개가 등록되고 평균 120초 유지된다면, 평균 활성 구독은 `10건/초 × 120초 = 1,200건`이다. [John D. C. Little의 원저자 해설](https://people.cs.umass.edu/~emery/classes/cmpsci691st/readings/OS/Littles-Law-50-Years-Later.pdf)

⚠️ 주의: 거절한 요청까지 등록률에 섞거나, 평균 유지 시간 대신 p95(관측값의 약 95%가 그 값 이하인 지점)를 대입하지 않는다. 접속이 급증하는 구간의 최대치는 이 평균식으로 구할 수 없다. [운영 관측성 노트](../54_11_12_SSE_Observability_and_Troubleshooting/11_12_SSE_Observability_and_Troubleshooting.md)의 활성 Gauge와 등록·정리 지표를 같은 서비스 경계에서 비교한다.

### 3.2 인스턴스 한 대가 빠져도 자원별 여유가 있는지 본다

**안전 슬롯**은 물리적으로 열 수 있는 연결 최대치가 아니라, 지연과 자원 사용률 목표를 지키면서 유지할 수 있다고 시험으로 확인한 연결 수다. 가상의 실험에서 각 인스턴스의 안전 슬롯을 750개로 정했다고 하자. 인스턴스 세 대 중 한 대가 제외되면 남은 안전 슬롯은 `2 × 750 = 1,500`이다. 1,200개가 다시 연결된다고 가정하면 전체 여유는 300개다.

전체 여유가 있어도 특정 인스턴스에 쏠릴 수 있다. 예를 들어 재배치가 70:30이면 한쪽이 `1,200 × 0.7 = 840`개를 맡아 750개를 초과한다. 다중화로 구독당 업로드 수가 커질 때도 같은 750개가 안전하다고 가정하지 않는다. 구독당 평균 자원 수와 이벤트 밀도가 바뀌면 메모리·전송 작업이 달라진다.

| 별도로 확인할 자원 | 막힐 때 볼 증거 |
| --- | --- |
| 열린 응답·구독 등록 정보 | 인스턴스별 활성 수, 제한 거절 수, 종료 뒤 등록 수가 기준선으로 돌아오는지 |
| 이벤트 전송 작업과 대기열 | 느린 소비자에서 대기열이 계속 늘어나는지, 전송·정리 작업이 제때 끝나는지 |
| DB와 프록시 | DB 연결 풀 대기, 쿼리 지연, 프록시를 거친 첫 완성 프레임 도착 시간 |

Spring MVC에서 비동기 요청을 사용한다는 사실만으로 응답 쓰기 작업까지 무제한이라는 뜻은 아니다. 컨트롤러 요청 스레드를 오래 점유하지 않는 것과, 실제 전송 작업 또는 대기열에 필요한 자원을 따로 본다. [Spring MVC 비동기 요청과 스트리밍](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html)

### 3.3 복구에 필요한 DB 조회량을 계산한다

**재생**은 마지막으로 적용한 커서 이후의 이력을 다시 읽는 일이다. 가상의 서비스에서 400개 구독을 20초에 걸쳐 옮기고, 각 구독마다 평균 재생 비용을 조회 4회로 잡았다면 추가 이력 조회는 `400 ÷ 20 × 4 = 80회/초`다. 평소 같은 DB에 45회/초가 들어오고 이 구간의 안전 예산이 110회/초라면 복구 중 추정치는 `45 + 80 = 125회/초`다. 연결 슬롯은 남아 있지만 DB 예산을 초과한다.

이 예의 4회는 예를 들어 읽을 이력 80건을 25건씩 가져오는 페이지 조회 4회를 뜻한다. 실제 API에서는 빈 결과 확인, 여러 업로드의 독립 페이지, 권한 확인, reset용 현재 상태 조회가 추가될 수 있다. `ceil(평균 이벤트 수 / 페이지 크기)`가 실제 평균 조회 횟수와 같다고 가정하지 않는다. 비싼 조회와 가벼운 조회가 섞이면 횟수만으로 자원 비용을 비교하기 어려우므로, 쿼리 구성과 지연·풀 대기도 같이 측정한다.

아래 `sse-capacity.mjs`는 **가상의 계획을 비교하는 계산 모듈 전체**다. 숫자 입력의 단위는 주석에 적었고, 테스트용 분산 시간은 정수 초다. 운영 서버에 연결하거나 요청을 보내지 않는다.

```javascript
export function estimateSseCapacity({
  acceptedPerSecond, meanLifetimeSeconds,
  instances, unavailable, safeSlotsPerInstance,
  reconnecting, spreadSeconds, replayQueriesPerReconnect,
  baselineQueriesPerSecond, safeQueriesPerSecond,
}) {
  // 낮은 지연의 테스트에서 나왔거나 가정한 평균·예산 값만 입력한다.
  const nonNegative = [acceptedPerSecond, meanLifetimeSeconds, replayQueriesPerReconnect,
    baselineQueriesPerSecond, safeQueriesPerSecond];
  if (nonNegative.some(value => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("유한한 0 이상의 평균·예산을 입력하세요.");
  }
  const counts = [instances, unavailable, safeSlotsPerInstance, reconnecting, spreadSeconds];
  if (counts.some(value => !Number.isSafeInteger(value) || value < 0)
      || instances === 0 || unavailable > instances || spreadSeconds === 0) {
    throw new RangeError("인스턴스·슬롯·재연결 수와 양수 분산 시간을 확인하세요.");
  }

  const meanActive = acceptedPerSecond * meanLifetimeSeconds; // 건/초 × 초 → 평균 구독 수
  const survivingSlots = (instances - unavailable) * safeSlotsPerInstance; // 서버 수 × 건/서버
  const reconnectsPerSecond = reconnecting / spreadSeconds; // 주어진 구간의 평균이지 순간 최대가 아니다.
  const extraReplayQueries = reconnectsPerSecond * replayQueriesPerReconnect;
  const estimatedQueries = baselineQueriesPerSecond + extraReplayQueries; // 모두 동일 경계의 회/초다.
  const spareQueries = safeQueriesPerSecond - baselineQueriesPerSecond;

  if (!Number.isSafeInteger(survivingSlots)
      || !Number.isFinite(meanActive) || !Number.isFinite(estimatedQueries)) {
    throw new RangeError("계산 가능한 범위 안의 값을 입력하세요.");
  }

  // 예산 안에 있고 추가 재생이 없으면 0초다. 계산으로 표현할 해가 없으면 null을 유지한다.
  let minimumSpreadSeconds = null;
  if (spareQueries >= 0 && (reconnecting === 0 || replayQueriesPerReconnect === 0)) {
    minimumSpreadSeconds = 0;
  } else if (spareQueries > 0) {
    const seconds = Math.max(1, Math.ceil(reconnecting * replayQueriesPerReconnect / spareQueries));
    if (Number.isSafeInteger(seconds)) minimumSpreadSeconds = seconds; // 초 단위로 올림한다.
  }
  return {
    meanActive,
    survivingSlots,
    slotHeadroom: survivingSlots - meanActive, // 전체 합이며 인스턴스 편중은 반영하지 않는다.
    reconnectsPerSecond,
    estimatedQueries,
    queryHeadroom: safeQueriesPerSecond - estimatedQueries, // 음수라면 초당 조회 예산을 넘는다.
    minimumSpreadSeconds,
  };
}
```

위 예에서는 평균 재연결 20건/초, DB 여유 `110 − 125 = −15회/초`가 나온다. 평상시를 뺀 예산은 65회/초다. 대략 `ceil(400 × 4 ÷ 65) = 25초`로 늘리면 평균 추정치는 `45 + 400 ÷ 25 × 4 = 109회/초`가 된다. 25초는 주어진 평균 가정에 대한 **계산상 하한**이지 운영 설정의 권장값이 아니다. 같은 25초 안에서도 도착이 고르지 않고, 지연이 커지면 재시도가 더 추가될 수 있다.

### 3.4 유지하려는 수와 새로 도착시키려는 수를 구분한다

**폐쇄형 부하 모델**은 정해진 가상 사용자가 이전 작업을 마친 뒤 다음 작업을 시작한다. 오래 열린 관찰 화면 수를 유지하며 연결 수명·느린 소비자·정리를 확인하는 데 적합하다. 하지만 서버가 느려질수록 다음 요청이 덜 들어오므로, “정해진 속도로 도착하는 새 연결”을 검증하기에는 부족하다.

**개방형 부하 모델**은 이전 작업 완료와 별개로 새 작업의 시작 시점을 예약한다. 예를 들어 배포 후 복구 요청이 일정한 빈도로 도착하는 구간을 모델링할 수 있다. 하나의 반복 작업이 긴 SSE 응답을 유지한다면 부하 도구에도 그만큼 동시에 실행할 여유가 필요하다. [Grafana k6: 개방형·폐쇄형](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)

⚠️ 주의: 도구가 예약한 작업을 실제로 시작하지 못했다면 서버가 목표 부하를 감당했다고 판정하지 않는다. k6의 `dropped_iterations` 같은 누락 지표와 예정·시작·서버 승인 수를 각각 확인한다. 누락은 도구 자체의 작업 슬롯 부족이나 대상 응답 지연으로 생길 수 있다. [Grafana k6: Dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/)

### 3.5 시험 시작 전에 합격 기준과 중단 조건을 쓴다

첫 시험은 권한을 받은 격리 환경에서 전용 계정·가짜 업로드·제한된 연결 수로 설계한다. 사용자 데이터와 운영 서비스는 이 노트의 시험 대상이 아니다. 한 번에 여러 조건을 바꾸지 말고, 기본 연결·배포·느린 소비자 순으로 나누어 비교한다.

| 시나리오 | 무엇을 비교하는가 | 합격 기준 예시 |
| --- | --- | --- |
| 정상 유지 | 목표 활성 구독 수를 실제로 유지하며 알려진 상태 전이가 적용되는지 | 10분 동안 활성 수가 목표의 95% 이상이며, 예정 점검의 99% 이상이 2초 이내 반영 |
| 한 대 제외와 재배치 | 배포 전·중·후 인스턴스별 연결 수, 재생 조회, 화면 복구 | 영향을 받은 세션의 99% 이상이 정해 둔 복구 예산 안에 반영. 예상 이력 누락 0건 |
| 느린 소비자 포함 | 일부 스트림의 읽기가 늦을 때 빠른 소비자와 서버 자원이 받는 영향 | 정해 둔 대기열 한도를 넘지 않고, 시험 종료 후 활성 구독·작업이 기준선으로 복귀 |

“2초 내 반영”은 점검 구동기가 알려진 상태 전이를 일으키는 요청을 시작할 때부터, 같은 실행에서 화면 모델 반영을 관찰할 때까지 잰다. 이 정의는 상태 확정에 걸린 시간도 포함하며, 서버의 벽시계와 브라우저의 시각을 서로 빼지 않는다. 결괏값이 없는 점검·시간 초과도 분모에 포함한다. **반영 지연 p95는 성공 표본 수와 함께 기록하고, 실패 비율은 별도로 보고한다.**

복구 정확성은 상태 배지 하나만 보지 않는다. 재생 가능한 범위에서는 자원별 예상 revision과 마지막 적용 커서를 대조하고, 보존 경계 이전만 `reset`으로 분류한다. 늦은 이벤트·중복 수신은 발생할 수 있지만 중복 적용은 허용하지 않는다. 계획된 도착이 도구에서 누락되면 그 실행으로 목표 용량을 판정하지 않는다.

중단 조건은 합격 기준과 별개다. 예를 들어 격리 DB의 풀 대기가 설정한 시간 이상 지속되거나, 정리 대기열이 안전 한도에 닿으면 신규 시험 입력을 중단한다. 그 뒤 활성 구독과 작업을 정리하고 기준선으로 돌아오는지 확인한다. 실제 부하 시험에서는 합격 수치뿐 아니라 설정·데이터 크기·인스턴스 수와 중단 여부도 함께 기록한다.

### 3.6 이번에 검증한 범위

저장소 루트에서 아래 명령을 실행한다. [회귀 검사](./check_sse_capacity.mjs)는 Node.js 24의 내장 테스트 실행기로 문서의 JavaScript 펜스를 읽어 계산한다. 외부 서버와 패키지는 필요하지 않다.

```powershell
# 평균 연결과 재생 예산이 서로 다른 결론을 내는지 확인한다.
node --test SpringBoot/56_11_17_SSE_Capacity_Planning_and_Load_Testing/check_sse_capacity.mjs
```

Node.js 24.18.0에서 **10개 테스트 통과**를 확인했다. 슬롯 여유가 남아도 DB 예산을 초과하는 예, 분산 시간 변경, 쿼리 여유가 없는 경우, 입력 경계를 검사했다. 위 표는 실제 부하 측정 결과가 아니라 Spring·DB·프록시가 있는 격리 환경에서 검증할 계획이다.

## 4. 적용 관점에서 다시 보기

먼저 정상 상태에서 같은 기간의 승인 등록률·평균 유지 시간·활성 연결을 대조한다. 배포에는 남은 인스턴스의 슬롯과 인스턴스별 편중을 따로 보고, 재생 조회의 추가 비용을 공유 DB 예산에서 뺀다. 어느 하나라도 부족하면 연결 이동 시간이나 재생 한도를 다시 정한다.

시험에서는 평상시 유지와 재연결 도착을 나눠 실행한다. 실제 들어간 부하가 계획과 맞아야 결과를 해석할 수 있다. 마지막에는 성공한 이벤트의 지연뿐 아니라, 시간 안에 반영되지 않은 점검과 구독·작업 정리까지 확인한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

평상시에는 오래 열린 구독이 차지하는 자원이 중요하고, 복구 중에는 다시 들어오는 요청과 이력 재생이 중요하다. 둘 중 하나가 안전하다고 나머지도 안전하다는 뜻은 아니다.

### 5.2 이전·다음 학습과의 연결

[SSE 점진적 종료](../55_11_13_SSE_Reconnect_Storms_and_Graceful_Drain/11_13_SSE_Reconnect_Storms_and_Graceful_Drain.md)의 재연결 분산을 평균 조회량과 시험 기준으로 옮겼다. 다음에는 **SSE·폴링 전환과 장애 시 상태 복구**를 다뤄 연결이나 재생이 계속 실패해도 화면을 어떻게 갱신할지 비교한다.

### 5.3 더 파볼 만한 주제

이력 페이지 크기를 늘리면 조회 횟수는 줄어도 한 번에 읽어 들일 데이터가 커진다. 업로드 수와 이력의 분포를 바꾸면서 조회 시간·메모리·화면 반영이 어떻게 바뀌는지 확인해 볼 수 있다.

### 5.4 참고 자료

- [John D. C. Little, Little’s Law as Viewed on Its 50th Anniversary](https://people.cs.umass.edu/~emery/classes/cmpsci691st/readings/OS/Littles-Law-50-Years-Later.pdf) — 도착률·평균 체류 시간·평균 개수의 관계와 경계.
- [Grafana k6: Open and closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/), [Dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/) — 작업 완료와 도착의 관계 및 계획한 시험 입력의 누락.
- [Spring MVC 비동기 요청](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html) — SSE 비동기 응답과 쓰기 작업의 경계.

## 6. 요약 정리

- 같은 경계의 실제 등록률과 평균 수명으로 평상시 평균 구독 수를 추정한다.
- 인스턴스를 제외한 뒤의 전체 슬롯과 인스턴스별 편중을 모두 본다.
- 재연결 시 공유 DB에 들어오는 비용을 평상시 조회와 별도로 계산한다.
- 평균 분산 시간은 순간 최대치나 실제 복구 지연을 보장하지 않는다.
- 열린 구독을 유지하는 시험과 일정 빈도로 새 작업을 예약하는 시험은 목적이 다르다.
- 부하가 실제로 들어갔는지, 예정 상태가 제때 반영됐는지, 자원이 정리됐는지 함께 판정한다.

🧠 기억할 것: 오래 열린 연결을 버티는 능력과 끊긴 연결을 되살리는 능력은 따로 검증한다.

## 7. 미니 퀴즈 또는 체크리스트

1. 초당 10건이 등록되고 평균 120초 유지되면 평균 활성 구독은 몇 건인가? 이것이 절대 최대치인가?
2. 전체 슬롯 여유가 300인데 DB 추정 여유가 −15회/초라면 복구가 안전한가?
3. 400개 구독이 각 4회 조회하고 추가 조회 예산이 65회/초라면, 가정상 몇 초 이상 분산해야 하는가?
4. 성공한 응답의 p95가 빠르더라도 예정 작업이 누락됐다면 무엇을 더 확인해야 하는가?

<details>
<summary>정답과 해설</summary>

1. 평균 1,200건이다. 안정 구간에 관한 평균이므로 순간 최대나 한 서버의 최대치를 알려 주지 않는다.
2. 아니다. 연결 슬롯은 충분해도 공유 DB의 조회 예산을 넘으므로 재연결 분산과 재생 비용을 다시 봐야 한다.
3. 25초다. 1,600회 ÷ 65회/초를 정수 초로 올림한다. 실제로는 편중과 추가 재시도를 고려해 시험한다.
4. 예정·실제 시작·서버 승인과 시간 내 반영 수를 대조한다. 일부 성공 표본의 지연만으로 목표 부하나 사용자 복구를 검증할 수 없다.

</details>
