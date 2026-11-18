# Spring Boot SSE·폴링 전환과 장애 시 상태 복구

- 🎯 글의 목표: SSE가 반복해서 끊길 때 현재 상태 조회로 전환하고, 늦은 응답과 오래된 상태를 걸러낸 뒤 SSE로 복귀한다.
- 🧩 핵심 키워드: 폴백, 상태 기계, 관찰 세대, revision, 복귀 탐색, 스냅샷, 적용 커서
- ⭐ 중요도: 높음. 연결을 복구해도 이전 응답이 최신 화면을 덮거나, 상태 조회를 이벤트 이력 재생으로 오해하면 잘못된 결과를 보여 줄 수 있다.
- 📝 한눈에 보는 내용: 전환 가능한 실패 분류 → 이전 관찰 무효화 → 같은 최신성 기준으로 폴링 → 유효한 스냅샷으로 SSE 복귀
- 🔗 관련 주제: [비동기 작업 상태 조회·폴링과 SSE](../50_11_03_Async_Status_Polling_and_SSE/11_03_Async_Status_Polling_and_SSE.md), [SSE 이벤트 이력·재생과 재동기화](../51_11_08_SSE_Event_Replay_and_Resynchronization/11_08_SSE_Event_Replay_and_Resynchronization.md), [SSE 용량 계획과 부하 테스트](../56_11_17_SSE_Capacity_Planning_and_Load_Testing/11_17_SSE_Capacity_Planning_and_Load_Testing.md)
- 🧱 선수 지식: HTTP 상태 코드, 이벤트와 콜백, 상태 갱신 번호(revision), 조회 권한

> 2026-11-18 기준. Spring Boot 4.1.2·Spring MVC 7.0.10의 단일 업로드 상태 API를 전제로 한다. JavaScript 상태 전이 예제는 Node.js 24.18.0에서 검증했다. 실제 브라우저·Spring 서버·DB 통합 시험과 운영 전환은 실행하지 않았다.

## 1. 들어가며

파일 검사 화면에서 SSE(Server-Sent Events, 서버가 열린 HTTP 응답을 통해 이벤트를 보내는 방식)가 끊겼다. 상태 조회 API는 여전히 동작한다. 화면이 이 API를 주기적으로 조회하는 **폴링**으로 바꾸면, 실시간 전달은 잠시 포기해도 검사 결과를 보여 줄 수 있다. 정상 경로가 실패했을 때 사용할 이런 대체 경로를 **폴백**이라고 한다.

문제는 전환 자체보다 경계에 있다. 폴링에서 `READY / 10`을 반영한 직후 이전 SSE의 `SCANNING / 9` 콜백이 늦게 올 수 있다. 또 SSE로 돌아갈 때 HTTP 연결이 열렸지만 첫 상태는 아직 오지 않았을 수 있다. [50번 노트](../50_11_03_Async_Status_Polling_and_SSE/11_03_Async_Status_Polling_and_SSE.md)가 각 관찰 방법을 설명했다면, 이번 노트는 두 방법 사이에서 어떤 상태를 유지하고 언제 전환할지를 다룬다.

## 2. 핵심 개념 정리

```text
SSE 관찰 → 복구 한도 초과 → 이전 세대 취소 → 순차 폴링
폴링에서 유효한 상태 확인 + 대기 시간 경과 → SSE 복귀 시도
  ├─ 마감 전에 현재 이상인 스냅샷 수신 → SSE 관찰 계속
  └─ 시간 초과·전송 실패 → 폴링으로 복귀하고 다시 대기
어느 상태에서든 현재 요청으로 권한 상실 확인 → 관찰 종료·화면 상태 제거
```

판단 기준은 두 가지다. **이 응답이 지금 화면을 갱신할 관찰 작업에서 왔는가?** 그리고 **현재 표시값을 뒤로 돌리지 않는가?** 둘을 독립적으로 확인한다.

## 3. 본문 정리

### 3.1 실패를 먼저 분류하고 전송 방법을 바꾼다

SSE의 일시적 단절, 현재 상태 읽기 불가, 파일 검사 실패는 서로 다르다. 예를 들어 SSE 재연결이 실패했다고 파일 검사 상태에 `REJECTED`를 쓰면 안 된다. 최근 확인값은 별도로 두고, 지금은 자동 갱신이 지연되거나 중단됐음을 표시한다.

| 관찰한 신호 | 예제의 결정 |
| --- | --- |
| SSE 일시 오류 | 브라우저의 자체 재연결을 제한된 시간 동안 기다린다. 앱 타이머로 두 번째 EventSource를 동시에 열지 않는다. |
| SSE 재연결 한도 초과 또는 연결 닫힘 | 이전 객체를 닫고 권한 있는 상태 GET으로 전환한다. 네이티브 `error`만으로 서버 상태 코드나 원인을 추정하지 않는다. |
| 상태 GET에서 HTTP 401·403·404 | 현재 관찰을 끝내고 화면의 상태값을 제거한다. 로그인·접근 불가·삭제는 기존 API 정책에 맞는 화면에서 처리한다. |
| 상태 GET에서 네트워크 일시 장애·429·503 | 기존 상태를 최신이라고 표시하지 않는다. 직전 요청을 끝낸 뒤 대기하고, 재시도 횟수·시간 예산을 둔다. |
| 상태 GET 응답 형식 또는 동일 revision의 내용이 계약과 불일치 | 자동 관찰을 중단하고 계약 오류로 기록한다. |

EventSource는 정상 스트림이 끊기면 조건에 따라 재연결하지만, 200이 아니거나 스트림 형식이 아닌 응답은 연결 실패로 처리한다. `error`에는 HTTP 상태 코드나 `Retry-After`를 읽는 표준 인터페이스가 없다. 이 예제에서는 관찰 중단을 지시하는 204를 상태 스트림의 폴백 신호로 사용하지 않는다. 제품에서 204를 전체 관찰 종료로 계약한다면 네이티브 오류만 보고 폴링하지 말고, 응답을 읽을 수 있는 Fetch 방식이나 별도 제어 응답으로 그 뜻을 구분해야 한다. [WHATWG EventSource 처리 모델](https://html.spec.whatwg.org/multipage/server-sent-events.html#processing-model)

GET이 과부하라면 429·503 응답의 유효한 `Retry-After`와 대기 예산을 비교한다. 서버가 요구한 최소 대기를 줄여 바로 재시도하지 않는다. [이전 재시도 예제](../55_11_13_SSE_Reconnect_Storms_and_Graceful_Drain/11_13_SSE_Reconnect_Storms_and_Graceful_Drain.md)는 정수 초만 지원하는 예시다. HTTP 날짜 등 그 범위를 벗어난 값을 받았을 때 즉시 반복하는 대신 예제의 중단 정책을 따른다. [RFC 9110 Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)

### 3.2 세대와 revision은 다른 질문에 답한다

**관찰 세대(generation)**는 현재 화면을 갱신할 연결 또는 폴링 루프를 식별하는 번호다. 방식이 바뀌면 번호를 올리고, 각 콜백에는 **시작할 때의 번호**를 붙인다. 예를 들어 SSE 세대 1에서 폴링 세대 2로 바꿨다면 세대 1의 응답은 더 큰 revision이어도 무시한다. 그 응답은 지금 관찰의 결과가 아니기 때문이다.

**revision**은 DB가 관리하는 한 업로드의 상태 갱신 번호다. 같은 세대 안에서도 응답이 지연되거나 읽기 복제본이 뒤처지면 과거 상태가 올 수 있다. 예를 들어 마지막 표시값이 `READY / 10`이면 `SCANNING / 9`는 현재 세대에서 받은 값이어도 화면에 쓰지 않는다. 아래 모델은 같은 revision이면 상태도 같아야 한다는 단일 자원 계약을 사용한다.

| 현재 기준 | 수신 | 판단 |
| --- | --- | --- |
| 세대 2, revision 10 | 세대 1의 revision 11 | 이전 관찰의 결과라 무시 |
| 세대 2, revision 10 | 세대 2의 revision 9 | 늦은 상태라 무시 |
| 세대 2, revision 10 | 세대 2의 같은 상태, revision 10 | 화면 상태는 유지. 유효한 응답을 확인한 시각은 기록 가능 |
| 세대 2, revision 10 | 세대 2의 다른 상태, revision 10 | 버전 계약 불일치 |

전환 시 모델을 바꿔 **이전 세대를 먼저 무효화**한 뒤 `EventSource.close()` 또는 `AbortController.abort()`로 자원을 정리한다. 취소는 네트워크·작업을 정리하기 위한 것이고, 세대 비교는 이미 예약되었거나 늦게 끝난 콜백의 영향을 막기 위한 것이다. 페이지·계정·업로드가 바뀔 때는 이전 감시자의 콜백이 새 감시자에 전달되지 않도록 감시 인스턴스도 구분한다. [WHATWG EventSource.close()](https://html.spec.whatwg.org/dev/server-sent-events.html#the-eventsource-interface), [DOM AbortController](https://dom.spec.whatwg.org/#interface-abortcontroller)

### 3.3 복귀는 연결 열림이 아니라 검증된 현재 상태로 판단한다

**스냅샷**은 특정 시점의 전체 표시 상태다. 이번 예제는 50번 노트의 `GET /uploads/{id}/status`와 스냅샷 SSE `GET /uploads/{id}/events`만 사용한다. 두 경로는 권한을 검사하고 `{ id, state, revision }`을 같은 의미로 보낸다. 폴링은 이전 노트처럼 캐시에 저장한 응답이 아니라 서버에서 현재 상태를 확인한다. 서버는 새 SSE 연결에서 권한 확인 후 초기 `snapshot` 이벤트를 보내야 한다. 단순히 헤더를 열어 두거나 SSE 주석 하트비트만 보내는 것은 복귀 성공이 아니다.

폴링에서 안정화 대기 시간인 **쿨다운**이 끝나고, 현재 표시값 이상인 GET을 받으면 SSE로 다시 연결해 본다. 이 **복귀 탐색** 동안에는 GET 루프를 잠시 중지한다. 예를 들어 폴링에서 10을 본 상태로 복귀를 시도했다면 마감 전 같은 10이나 더 큰 번호가 성공 근거다. 9 또는 빈 응답이면 성공으로 세지 않는다. 마감에 실패하면 기존 표시값을 유지한 채 다시 폴링한다.

이 예는 SSE 복귀를 늦춰 반복적인 방식 전환을 줄인다. 폴링은 앞 요청이 완료되거나 취소된 후 다음 요청을 예약하며, 브라우저 여러 개가 같은 시간에 전환하지 않도록 예산 안에서 지연을 분산한다. 초기 상태를 받기 위한 마감과, 연결이 정상적으로 열린 뒤 한동안 상태가 변하지 않는 상황은 다르다. 서버가 주기적인 **이름 있는 점검 이벤트**를 별도 계약하지 않는다면 상태 이벤트가 없다는 이유만으로 정상 유휴 스트림을 장애로 분류하지 않는다. SSE 주석은 프록시 유휴 제한에 도움을 줄 수 있지만 화면 이벤트로 전달되지는 않는다. [WHATWG SSE 이벤트 처리](https://html.spec.whatwg.org/multipage/server-sent-events.html#interpreting-an-event-stream)

⚠️ 주의: 상태 페이지가 `10 → 15`로 바뀌어도 중간 이력 `11~14`를 적용한 것은 아니다. 상태 화면은 전체 스냅샷으로 복구할 수 있지만, 별도의 이력 화면은 마지막 적용 이력 커서부터 다시 읽어야 한다. 보존 경계를 벗어나 `reset`을 받으면 중간 이력은 미제공으로 표시한다. 폴링으로 본 15를 처리 완료된 이력 커서로 복사하지 않는다. [단일 자원 이력 재생](../51_11_08_SSE_Event_Replay_and_Resynchronization/11_08_SSE_Event_Replay_and_Resynchronization.md)

### 3.4 상태 전이 모듈로 최신성 규칙을 한곳에 둔다

아래 `sse-failover.mjs`는 **순수 상태 전이 모듈 전체**다. 이전 모델과 하나의 입력을 받아 새 모델을 반환하며 네트워크·타이머·화면에는 직접 접근하지 않는다. `at`은 호출부가 같은 단조 시계(되돌아가지 않는 경과 시간 기준)의 `performance.now()` 등으로 얻은 밀리초 값이다. 테스트에서 이 값만 앞당겨 마감 처리를 확인한다. [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/#dom-performance-now)

```javascript
const allowedStates = new Set([
  "RECEIVING", "QUARANTINED", "SCANNING", "READY", "REJECTED", "DELETE_PENDING", "DELETED",
]); // 단일 업로드 상태 API의 공개 값만 받는다.
const maxRevision = 9223372036854775807n; // Java long·PostgreSQL bigint의 양수 상한이다.
const probeMs = 5_000; // 예시: 연결 시작부터 초기 상태를 기다리는 전체 시간이다.

export function startWatch(id, at, cooldownMs = 30_000) {
  if (typeof id !== "string" || id.length === 0 || !Number.isFinite(cooldownMs) || cooldownMs <= 0) {
    throw new TypeError("업로드 ID와 양수 대기 시간이 필요합니다.");
  }
  return {
    id, mode: "probe", generation: 1, snapshot: null, verifiedAt: null,
    deadline: at + probeMs, retryAt: null, cooldownMs, reason: null,
  }; // 첫 연결도 상태를 받기 전까지는 검증되지 않았다.
}

function usePolling(model, at, reason) {
  return {
    ...model, mode: "poll", generation: model.generation + 1,
    deadline: null, retryAt: at + model.cooldownMs, reason,
  }; // 전송 방법만 바꾸고 현재 스냅샷은 보존한다.
}

function stop(model, reason, clear) {
  return {
    ...model, mode: "stopped", generation: model.generation + 1,
    deadline: null, retryAt: null, reason,
    snapshot: clear ? null : model.snapshot, verifiedAt: clear ? null : model.verifiedAt,
  }; // 권한 손실·화면 종료 시에는 이전 표시 상태도 제거한다.
}

function parseSnapshot(value, expectedId) {
  if (value?.id !== expectedId || !allowedStates.has(value.state)) return null;
  const rev = value.revision;
  if (typeof rev !== "string" || rev !== rev.trim() || !/^(0|[1-9][0-9]{0,18})$/.test(rev)) return null;
  if (BigInt(rev) > maxRevision) return null; // Number로 바꾸면 큰 revision의 차이가 사라질 수 있다.
  return { id: value.id, state: value.state, revision: rev }; // 원본의 추가 필드는 보존하지 않는다.
}

export function reduceWatch(model, input) {
  if (input.type === "leave") {
    // 이미 예산 소진으로 멈췄더라도 화면 이탈 시 보존했던 표시값을 지운다.
    return model.mode === "stopped" && model.snapshot === null ? model : stop(model, "left", true);
  }
  if (model.mode === "stopped") return model; // 정지 뒤 늦은 이벤트로 다시 시작하지 않는다.
  if (input.generation !== model.generation) return model; // 오래된 응답·오류·타이머를 먼저 제거한다.

  const at = input.at;
  if (input.type === "access-lost") return stop(model, "access", true); // 명시적으로 확인한 권한 오류다.
  if (input.type === "poll-exhausted" && model.mode === "poll") return stop(model, "budget", false);
  if (input.type === "stream-failed" && model.mode !== "poll") return usePolling(model, at, "stream");
  if (model.mode === "probe" && at >= model.deadline
      && (input.type === "stream-state" || input.type === "probe-timeout")) {
    return usePolling(model, at, "probe-timeout"); // 타이머가 늦게 실행돼도 마감은 바뀌지 않는다.
  }

  const poll = model.mode === "poll";
  if (input.type !== (poll ? "poll-state" : "stream-state")) return model; // 현재 방식의 데이터만 받는다.
  const next = parseSnapshot(input.value, model.id);
  const previous = model.snapshot;
  const conflicts = next && previous && next.revision === previous.revision && next.state !== previous.state;
  if (!next || conflicts) {
    return poll ? stop(model, "protocol", false) : usePolling(model, at, "protocol");
  }
  if (previous && BigInt(next.revision) < BigInt(previous.revision)) return model; // 과거 상태로 복귀하지 않는다.

  const updated = { ...model, snapshot: next, verifiedAt: at, reason: null };
  if (poll && at >= model.retryAt) {
    return {
      ...updated, mode: "probe", generation: model.generation + 1,
      deadline: at + probeMs, retryAt: null,
    }; // 방금 본 GET 상태를 복귀 판단의 하한으로 삼는다.
  }
  if (model.mode === "probe") return { ...updated, mode: "sse", deadline: null };
  return updated;
}
```

예를 들어 SSE 세대 1이 revision 8을 받은 뒤 실패하면 폴링 세대 2가 된다. 이 세대의 GET에서 10을 반영하고 쿨다운이 끝나면 복귀 세대 3으로 바뀐다. 세대 3의 `open`은 상태 입력이 아니며, 검증을 통과한 `snapshot / 10`을 받아야 `sse` 모드가 된다. 복귀 탐색과 정상 SSE 관찰은 **같은 연결**이므로 성공 시 세대를 올리거나 EventSource를 다시 만들지 않는다.

`verifiedAt`은 비교를 통과한 응답을 처리한 시점이지, 상태가 그때 변경됐다는 뜻이 아니다. 읽기 복제본이 같은 과거 값을 반복해서 내놓으면 현재보다 새 상태가 없다는 증거가 되지 않는다. 예제는 동일 권한 정책과 현재의 commit된 상태를 읽는 API를 전제로 한다. 응답 검증과 별개로 마지막 확인 시각이 오래되거나 폴링 예산이 끝나면 “마지막 확인값”임을 표시한다.

### 3.5 호출부의 작업 취소 순서와 시험 경계

아래는 브라우저 호출부의 **의사 코드**다. 네트워크 요청과 재시도 스케줄은 50·55번 노트의 정책을 연결한다. 활성 모드마다 요청·타이머를 관리하는 한 관찰 작업만 둔다.

```text
관찰 시작: 초기 모델을 저장하고 현재 세대를 캡처한다.
이벤트 처리: 현재 모델에 입력을 적용하고 새 모델을 먼저 저장한다.
  세대 변경: 예전 연결·요청·타이머에 취소를 요청한다.
             모드가 poll이면 이번 세대로 순차 GET을 시작한다.
             모드가 probe이면 이번 세대로 SSE와 탐색 마감 타이머를 시작한다.
             stopped이면 새 작업을 만들지 않는다.
  probe → sse: 탐색 타이머만 없애고 기존 SSE는 유지한다.
상태 GET: 권한 오류는 access-lost, 성공은 poll-state로 전달한다.
          일시 오류는 단일 대기를 두고, 예산이 소진되면 poll-exhausted를 전달한다.
SSE: snapshot 이벤트를 파싱해 stream-state로 전달한다.
     JSON 파싱 실패도 검증 실패로 전달한다(예: value=null).
     기본 재연결이 종료되거나 예산을 넘으면 stream-failed를 전달한다.
```

새 세대를 만들었더라도 취소 직전 이미 전송한 GET이 서버에서 잠시 처리될 수 있다. 이 순서는 **화면을 갱신할 주체를 하나로 제한**하는 것이지, 서버의 실행 중인 HTTP 요청이 항상 즉시 사라진다는 보장이 아니다. 순차 폴링에서는 GET마다 시간 상한을 두고, 요청이 끝날 때마다 세대와 취소 상태를 확인한 뒤에만 다음 타이머를 예약한다. 브라우저에서 연결을 닫아도 Spring 서버의 구독·작업 정리는 따로 검증한다. [Spring MVC 연결 단절](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html#disconnects)

정상 SSE에서 자동 재연결이 시작되면 호출부가 새 복구 마감을 관리한다. 이 마감은 단순 `open` 이벤트로 초기화하지 않고, 현재 세대에서 스냅샷 검증을 통과했을 때 끝낸다. 복구 중에는 마지막 확인값을 표시하되 실시간 갱신 중인 것처럼 표시하지 않는다.

저장소 루트에서 [회귀 검사](./check_sse_failover.mjs)를 실행하면 문서의 JavaScript 모듈을 직접 읽어 네트워크 없이 테스트한다.

```powershell
# 이전 세대·마감·권한·revision 경계를 결정론적으로 검사한다.
node --test SpringBoot/57_11_18_SSE_Polling_Failover_and_State_Recovery/check_sse_failover.mjs
```

Node.js 24.18.0에서 **12개 테스트 통과**를 확인했다. 테스트 범위는 상태 판단이다. 실제 환경에서는 첫 스냅샷 유실, GET 완료 직전 화면 전환, 재연결 중 권한 철회, 일시 장애에서 쿨다운보다 계속 빠르게 다시 연결하지 않는지를 확인한다. 상태 GET을 쓰는 인스턴스로 트래픽이 옮겨갈 때 DB 조회량과 활성 스트림 수가 어떻게 바뀌는지도 [용량 계획](../56_11_17_SSE_Capacity_Planning_and_Load_Testing/11_17_SSE_Capacity_Planning_and_Load_Testing.md)의 기준으로 확인한다.

## 4. 적용 관점에서 다시 보기

상태 표시가 목적이라면 SSE에서 순차 폴링으로 전환해도 최신 스냅샷을 유지할 수 있다. 전환 시 이전 세대를 먼저 무효화하고, 이전 네트워크 작업을 정리한다. SSE는 연결 열림이 아니라 현재 표시값 이상인 스냅샷을 받아 복귀한다.

오랜 시간 복구가 안 된다면 더 빨리 반복하는 대신 마지막 확인 시각과 실패 상태를 보여 준다. 이력도 필요한 기능이라면 상태 모델의 revision과 이력 소비 위치를 나눠 진단한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

연결 전환은 표시 모델을 초기화하는 일이 아니다. 이전 관찰의 응답은 세대로, 더 오래된 업무 상태는 revision으로 막고, 새 스트림의 복귀에는 실제 상태 응답이 필요하다.

### 5.2 이전·다음 학습과의 연결

[SSE 용량 계획](../56_11_17_SSE_Capacity_Planning_and_Load_Testing/11_17_SSE_Capacity_Planning_and_Load_Testing.md)에서 확인한 과부하를 화면의 대체 조회·복귀 정책에 연결했다. 다음에는 **상태 폴링의 조건부 GET·ETag와 304**를 다뤄, 상태가 바뀌지 않았을 때 응답 본문을 줄이면서 확인 시각을 관리하는 방법을 살펴본다.

### 5.3 더 파볼 만한 주제

여러 업로드를 동시에 보는 화면이라면 자원별 표시값과 공유 스트림의 이력 커서를 따로 유지하는 방법을 비교할 수 있다. 스트림을 닫는 동안에도 화면이 보여 주는 마지막 확인 시각과 업무 상태를 접근성 있게 알리는 방법도 살펴볼 만하다.

### 5.4 참고 자료

- [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) — 브라우저 재연결, 오류 인터페이스, SSE 프레임과 주석.
- [DOM AbortController](https://dom.spec.whatwg.org/#interface-abortcontroller), [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/#dom-performance-now) — 작업 취소 신호와 단조 시계.
- [RFC 9110 Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), [Spring MVC 비동기 요청](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html), [Spring Boot 관리 버전](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html) — 재시도 대기, 서버의 연결 단절 감지, 예제 버전.

## 6. 요약 정리

- SSE 전송 실패와 업로드 검사 실패를 혼동하지 않는다.
- 관찰 세대가 다른 응답은 취소 완료 여부나 revision 크기와 무관하게 무시한다.
- 유효한 현재 세대에서도 더 오래된 상태는 적용하지 않는다.
- 폴링은 순차 실행하고 예산을 둔다. 권한 오류가 확인되면 갱신을 중단하고 표시값을 지운다.
- SSE 복귀는 `open`이 아니라 마감 전의 유효한 스냅샷으로 판단한다.
- 폴링 스냅샷이 갱신되어도 보지 못한 이력까지 처리했다고 간주하지 않는다.

🧠 기억할 것: 연결은 교체하되, 적용한 상태와 확인하지 못한 이력의 경계는 유지한다.

## 7. 미니 퀴즈 또는 체크리스트

1. 폴링 세대 2에서 revision 10을 표시 중이다. 이전 SSE 세대 1에서 revision 11이 오면 반영하는가?
2. 복귀할 SSE의 `open`은 도착했지만 마감 전 상태가 오지 않았다. 어떻게 하는가?
3. 폴링에서 revision 10을 표시하다 잠시 후 15를 받았다. 11~14 이력이 확인됐다고 표시해도 되는가?
4. 상태 GET이 404를 반환했다. 잠시 기다린 뒤 같은 요청을 계속 보내야 하는가?

<details>
<summary>정답과 해설</summary>

1. 아니다. revision이 높아도 이미 종료한 관찰에서 도착했다. 현재 세대의 새 요청 또는 이벤트에서 더 최신 상태를 확인한다.
2. 복귀 실패로 기록하고 해당 SSE를 닫는다. 기존 표시값을 유지하며 폴링을 재개하고 다시 쿨다운을 둔다.
3. 아니다. 스냅샷은 현재 상태만 증명한다. 중간 이력이 필요하면 별도 커서로 재생한다.
4. 아니다. 이 예제에서는 현재 관찰과 표시값을 정리한다. 접근 불가와 삭제가 같은 404로 매핑될 수 있으므로 하나로 단정하지 않는다.

</details>
