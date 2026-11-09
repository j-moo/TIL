# Spring Boot SSE 연결 다중화·자원별 권한과 공유 커서

- 🎯 글의 목표: 한 SSE 연결에서 여러 업로드를 관찰하고, 연결이 끊겨도 업로드마다 마지막 위치 이후부터 이어 읽을 수 있는 계약을 설계한다.
- 🧩 핵심 키워드: SSE 다중화, 고정 구독 범위, 자원별 revision, 벡터 커서, Last-Event-ID, 부분 재동기화
- ⭐ 중요도: 높음. 연결을 줄여도 자원마다 다른 접근 권한과 진행 위치는 그대로 관리해야 한다.
- 📝 한눈에 보는 내용: 볼 대상을 확정 → 여러 위치를 한 ID에 담음 → 한 자원의 이벤트만 적용 → 권한 변경과 이력 만료를 구분
- 🔗 관련 주제: [SSE 이벤트 이력·재생과 재동기화](../51_11_08_SSE_Event_Replay_and_Resynchronization/11_08_SSE_Event_Replay_and_Resynchronization.md), [비동기 작업 상태 조회·폴링과 SSE](../50_11_03_Async_Status_Polling_and_SSE/11_03_Async_Status_Polling_and_SSE.md)
- 🧱 선수 지식: HTTP 요청·JSON, SSE 이벤트 이름과 ID, [Spring Security 인증·인가](../11_09_07_Spring_Security_Fundamentals/09_07_Spring_Security_Fundamentals.md)

> 2026-11-09 기준. Java 21·Spring Boot 4.1.2(Spring Framework 7.0.10·Spring Security 7.1.2)·PostgreSQL 17 기준의 서버 계약과 일부 코드다. 화면 판단 예제는 Node.js 24.18.0에서 실행했다. Spring 서버·PostgreSQL·실제 브라우저는 실행하지 않았다.

## 1. 들어가며

파일 세 개를 업로드하는 화면을 생각해 보자. 파일마다 알림 연결을 하나씩 열어도 동작하지만, 관찰 대상이 늘어날 때마다 서버가 관리할 연결도 늘어난다. **SSE(Server-Sent Events)**는 서버가 열린 HTTP 응답으로 브라우저에 이벤트를 전달하는 방식이다. 여기서는 한 화면의 여러 업로드 이벤트를 하나의 SSE 응답에 섞어 보내는 **다중화**를 다룬다.

지난 노트에서는 한 업로드의 위치만 기억하면 됐다. 이번에는 A의 검사 결과가 도착한 뒤에도 B의 위치를 잃지 않아야 하고, B를 볼 수 없게 되면 이미 열린 연결에서도 B의 새 상태를 보내지 않아야 한다. 업로드마다 이미 가지고 있는 이력을 재사용하고, 여러 업로드 전체에 대한 하나의 시간 순서는 보장하지 않는 설계를 선택한다.

## 2. 핵심 개념 정리

```text
관찰 대상과 권한 확정 → 현재 상태와 초기 위치 받기 → SSE 연결 1개 열기
  → 서버가 A·B의 이력을 번갈아 확인
  → A 이벤트: A 위치만 갱신한 전체 커서를 보냄
  → B 이력 만료: B만 현재 상태로 교체
  → 접근 범위 변경: 기존 연결을 종료하고 새 관찰 범위를 만듦
```

연결은 하나지만 확인할 대상, 최신 상태, 재생 위치는 자원마다 따로 있다. 이 셋을 구분하면 “연결 하나에서 여러 자원을 본다”는 말을 구현 규칙으로 바꿀 수 있다.

## 3. 본문 정리

### 3.1 연결을 합쳐도 재생 위치는 합산할 수 없다

**revision**은 한 업로드의 상태가 바뀔 때마다 증가하는 번호다. A의 8과 B의 3을 이미 반영한 화면에서 A의 9가 도착했다고 하자. `9` 하나를 재개 위치로 저장하면 B에서 다음에 받아야 할 4가 사라진다. 반대로 **벡터 커서**는 자원별 마지막 위치를 정해진 순서로 묶는다. 여기서 벡터는 숫자 목록이라는 뜻이다.

| 방금 적용한 프레임 | A의 위치 | B의 위치 | 다음에 필요한 값 |
| --- | ---: | ---: | --- |
| 최초 스냅샷 | 8 | 3 | A:9, B:4 |
| A:9 | 9 | 3 | A:10, B:4 |
| B:4 | 9 | 4 | A:10, B:5 |

두 자원의 숫자가 달라도 서로 비교하지 않는다. 서버가 A:9와 B:4 중 무엇을 먼저 보내든 각자의 이력 안에서 순서만 유지하면 된다. 브라우저 `EventSource` 객체가 자동 재연결에 사용하는 마지막 이벤트 ID는 하나이므로, 이 목록을 **문자열 하나**로 인코딩한다. [WHATWG EventSource 처리 모델](https://html.spec.whatwg.org/multipage/server-sent-events.html#processing-model)

HTTP/2도 한 연결에 여러 요청·응답을 실을 수 있지만, 그때 SSE 응답을 여러 개 열면 여전히 응답·구독·재생 경로도 여러 개다. 이 노트의 다중화는 HTTP 버전에 관계없이 애플리케이션이 여러 자원의 이벤트를 **한 SSE 응답**으로 묶는 것이다. [RFC 9113: HTTP/2 스트림](https://www.rfc-editor.org/rfc/rfc9113.html#section-5)

### 3.2 관찰할 업로드와 슬롯 순서를 서버가 먼저 고정한다

**관찰 범위(watch)**는 누가 어떤 업로드들을 어떤 순서로 보는지 기록한 서버 측 설정이다. A와 B를 함께 본다면 첫째 칸은 A, 둘째 칸은 B로 정한다. 새 파일 C를 추가할 때 기존 watch의 목록을 덮어쓰면 이전의 두 숫자를 새 목록에 잘못 대입할 수 있으므로, 범위가 바뀌면 새 watch를 만든다.

| 요청 | 담당하는 일 |
| --- | --- |
| `POST /upload-watches` | `uploadIds`에 UUID 1~8개를 받아 중복·형식을 확인한다. 모두 읽을 수 있을 때만, ID의 표준 소문자 문자열 순으로 슬롯을 고정하고 `watchId`와 그 순서의 `items`를 반환한다. |
| `GET /upload-watches/{watchId}/events?after=…` | 현재 로그인 사용자와 watch의 만료·소유 범위를 확인한다. 자원별 권한을 검사한 다음 커서 이후를 재생한다. |

`items`의 각 값은 이전 노트와 같은 `{ id, state, revision }` 스냅샷(한 시점의 화면용 상태)이다. 서버는 만료 시각·생성한 사용자 식별자·고정 ID 목록·각 슬롯의 최초 revision을 여러 서버에서 읽을 수 있는 저장소에 보관한다. 최초 스냅샷은 주 DB의 한 문장에서 읽고, 그때의 revision을 기준점으로 삼는다. PostgreSQL Read Committed의 일반 SELECT는 문장 시작 시점에 보이는 데이터를 읽는다. [PostgreSQL 문장별 스냅샷](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

다음은 [업로드 상태 테이블](../46_10_28_Upload_Lifecycle_Quarantine_and_Cleanup/10_28_Upload_Lifecycle_Quarantine_and_Cleanup.md)의 `owner_subject`와 이전 노트의 `status_revision`을 사용하는 **초기 조회 일부**다. Spring의 이름 있는 매개변수를 처리하는 저장소에서 검증한 UUID 목록과 서버가 인증 결과에서 얻은 사용자 키를 바인딩한다.

```sql
SELECT a.id, a.state, a.status_revision      -- 공개 스냅샷의 상태와 기준 번호만 선택한다.
FROM upload_asset AS a
WHERE a.id IN (:ids)                         -- 서버가 1~8개로 제한한 UUID 목록이다.
  AND a.owner_subject = :subject;           -- 요청 본문이 아닌 인증 결과로 사용자를 좁힌다.
```

호출 측은 조회된 ID 집합이 요청과 정확히 일치하는지 비교하고, 일치할 때만 결과를 슬롯 순서로 정렬한다. 별도 계정 상태나 공유 정책이 있다면 그 권한도 함께 확인한다. 누락·접근 불가가 섞인 요청에서는 일부 상태를 반환하지 않고, 어느 ID가 존재하는지도 응답에 드러내지 않는다. 8개는 교육용 한도이며, 사용량과 재생 비용에 맞춰 정한다.

watch 생성은 서버 상태를 바꾸는 POST다. 쿠키 세션을 쓰는 예제에서는 로그인 사용자의 브라우저를 다른 사이트가 속여 요청하게 만드는 **CSRF**에 대한 Spring Security 보호를 유지하고, 앱이 설정한 방식으로 토큰을 보낸다. SSE GET은 watch를 생성·수정하지 않고 이미 허용된 범위를 관찰한다. [Spring Security CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)

### 3.3 공유 커서는 자리를 확인한 뒤 숫자를 읽는다

이 노트의 커서 형식은 `v1.<watchId>.<revision1>.<revision2>…`다. `v1`은 형식 버전, `watchId`는 숫자 목록의 해석 범위다. 예를 들어 아래 프레임은 A의 9번 상태와 “A:9, B:3 이후부터 다시 읽기”를 함께 전달한다. A와 B는 실제 이름 대신 UUID로 식별한다.

```text
event: transition
id: v1.00000000-0000-0000-0000-000000000052.9.3
data: {"id":"00000000-0000-0000-0000-000000000001","state":"SCANNING","revision":"9"}

```

빈 줄이 이벤트를 끝낸다. `data.id`는 어떤 업로드가 바뀌었는지, SSE의 `id:`는 전체 관찰 범위의 다음 재개 위치를 나타낸다. 같은 객체가 재연결할 때는 브라우저가 보낸 `Last-Event-ID`를 우선하고, 새 객체를 열 때는 마지막 **적용 위치**를 `URLSearchParams`로 인코딩해 `after`에 넣는다. 자동 헤더는 화면 반영 확인 응답이 아니다. [WHATWG Last-Event-ID](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header)

다음 `WatchCursor.java`는 `src/main/java/com/example/upload/`에 둘 수 있는 **파싱 보조 파일 전체**다. 경로에서 조회한 watch가 현재 사용자에게 허용된 것인지 먼저 확인한 후 호출한다. 컨트롤러는 중복 헤더·쿼리 값과 이 함수의 입력 예외를 잘못된 요청으로 처리한다. DB 조회와 실제 이벤트 전송은 이 파일에 포함되지 않는다.

```java
package com.example.upload;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

final class WatchCursor {
    static final int MAX_SLOTS = 8; // 등록 정책과 파서에 같은 슬롯 상한을 사용한다.

    private WatchCursor() {} // 요청 상태를 멤버 변수로 저장하지 않는 도우미다.

    static List<Long> readAfter(UUID watchId, int slots, String header, String query) {
        if (slots < 1 || slots > MAX_SLOTS) throw new IllegalArgumentException("invalid watch size");
        String raw = header != null ? header : query; // 잘못된 헤더를 초기 쿼리로 조용히 우회하지 않는다.
        String prefix = "v1." + watchId + "."; // 조회한 watch와 형식 버전을 함께 맞춘다.
        int maxLength = prefix.length() + 19 * slots + (slots - 1); // 19자리 숫자와 구분점까지만 허용한다.
        if (raw == null || raw.length() > maxLength || !raw.startsWith(prefix)) {
            throw new IllegalArgumentException("invalid watch cursor");
        }
        String[] parts = raw.substring(prefix.length()).split("\\.", -1); // 끝이 빈 칸이어도 버리지 않고 검증한다.
        if (parts.length != slots) throw new IllegalArgumentException("invalid cursor size");

        List<Long> revisions = new ArrayList<>(slots); // 저장한 슬롯 순서 그대로 읽는다.
        for (String part : parts) {
            if (!part.matches("0|[1-9][0-9]{0,18}")) {
                throw new IllegalArgumentException("invalid revision"); // 부호, 공백, 선행 0을 거절한다.
            }
            revisions.add(Long.parseLong(part)); // 19자리여도 signed bigint 범위를 넘으면 실패한다.
        }
        return List.copyOf(revisions); // 검증된 목록을 호출자가 실수로 변경하지 못하게 한다.
    }
}
```

파싱 후에는 각 번호가 `최초 revision <= 요청 위치 <= 현재 revision`인지 확인한다. 등록 이전이나 미래를 가리키는 값은 이 예제에서 400이다. 형식·상한이 맞는 값도 과거 이력이 정리됐을 수 있으므로 보존 경계는 별도로 확인한다. 커서는 인증 토큰이 아니며, 값이 올바르다는 이유만으로 데이터를 제공하지 않는다.

### 3.4 한 프레임은 한 업로드의 위치만 전진시킨다

**보존 경계(floor)**는 그 위치 이후부터 이력을 재생할 수 있는 가장 낮은 번호다. A:8, B:3에서 시작했는데 A의 floor가 10이고 현재 상태가 12라면 A의 이력을 9부터 모두 제공할 수 없다. 서버는 A의 현재 상태와 위치를 함께 담은 `reset`을 보내고 벡터를 `[12, 3]`으로 만든다. B는 다음 이벤트 4부터 정상 재생한다. 정상 만료와 달리, 보존 구간 안에서 이력이 비면 저장 계약 위반으로 기록하고 연결을 종료한다.

다음은 서버 연결 작업자의 **의사 코드**다. `readNext`는 [이전 노트의 조회](../51_11_08_SSE_Event_Replay_and_Resynchronization/11_08_SSE_Event_Replay_and_Resynchronization.md#35-보존-경계와-현재-상태를-같은-시점에서-읽는다)를 슬롯별로 호출해, 다음 이벤트 한 건·현재 상태 reset·정상 대기를 구분한다.

```text
각 라운드에서 고정 슬롯을 차례대로 방문한다.
    종료 신호나 권한 만료가 있으면 연결과 작업을 정리한다.
    해당 슬롯의 마지막 위치 이후를 읽고, DB 읽기를 끝낸다.
    빈 결과면 다른 슬롯으로 넘어간다.
    전송 직전에도 허용 범위를 확인한다.
    새 벡터 = 현재 벡터를 복사하고 이번 슬롯만 프레임의 revision으로 교체
    한 전송 작업자가 이벤트 이름·새 벡터 ID·공개 스냅샷을 함께 보낸다.
    보내기에 성공하면 연결 내 현재 벡터를 새 벡터로 교체한다.
    실패하면 더 보내지 않고 연결을 정리한다.
전체 라운드에 보낼 값이 없으면 잠시 대기한 뒤 다시 조회한다.
```

**라운드 로빈**은 A·B·C처럼 차례대로 돌아가며 기회를 주는 방식이다. 이 예제에서는 한 차례에 한 건씩 보내므로 A에 이력이 많이 쌓여도 B의 차례가 온다. 연결 내 작업자는 프레임을 순차적으로 전송한다. Spring MVC의 `SseEmitter.event()`로 이름·ID·데이터를 묶어 보낼 수 있지만, 서로 다른 작업자가 만들어 낸 벡터의 순서를 Spring이 대신 정하지는 않는다. [Spring SseEventBuilder](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.SseEventBuilder.html)

⚠️ 주의: A와 B를 동시에 읽었다고 해서 A 프레임의 ID에 B의 새 위치까지 넣으면 안 된다. 브라우저가 A만 받은 직후 연결이 끊기면 B를 받지 않았는데도 그 이후부터 재개하게 된다. 읽어 둔 위치가 아니라 **해당 프레임까지 전달하는 위치**만 ID에 담는다.

### 3.5 자원 하나의 권한이 사라지면 관찰 범위를 다시 만든다

로그인 여부를 확인하는 것과 특정 업로드를 볼 수 있는지 확인하는 것은 별개다. Spring Security의 경로 단위 인증을 사용하되, 앱이 watch 소유자·만료·현재 자원 접근 범위를 최초 연결, 재연결, 배치 조회와 전송 경계에서 다시 검사한다. 응답을 열기 전에는 이 예제에서 미인증 요청을 401, 없거나 볼 수 없는 watch를 404로 분류한다. `watchId`를 아는 다른 계정에게 해당 목록·상태를 노출하지 않고, watch ID나 커서를 세션 토큰처럼 사용하지 않는다. `text/event-stream` 응답에는 `Cache-Control: no-store`를 사용한다. [Spring Security 요청 인가](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)

이번 설계에서 B가 더 이상 보이지 않으면 연결 전체를 닫는다. 이미 열린 응답의 HTTP 상태 코드를 404로 바꿀 수 없고, B를 뺀 채 이전 ID로 계속 보내면 벡터의 의미가 바뀐다. 화면은 EventSource 오류만으로 원인을 단정하지 않고 일반 조회 API로 최신 가시 범위를 확인해, 남은 대상을 새 watch로 관찰한다. 권한이 없는 리소스는 화면에서 제거하며, 이미 전송한 데이터는 서버가 회수할 수 없으므로 허용 가능한 철회 감지 지연을 정해 두어야 한다.

운영에서는 watch 수·생성 빈도·연결 수·대기 시간에 한도를 두고 만료된 watch를 정리한다. 느린 소비자에게는 무한히 이벤트를 쌓지 않고 연결을 종료해 재생 경로로 돌아오게 한다. SSE 연결이 열려 있는 동안 DB 트랜잭션을 유지하지 않으며, 오류·종료·timeout 시 반복 조회·타이머와 연결 등록을 함께 정리한다. 상태를 바꾸지 않는 연결 유지용 SSE 주석에는 재개 ID를 넣지 않는다. [Spring MVC 비동기 요청](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html)

### 3.6 화면은 본문과 전체 벡터를 함께 검사한다

클라이언트는 A:9 본문을 받았을 때 A 슬롯만 보지 않는다. 이전 적용 위치가 `[8, 3]`인데 A:9 프레임의 ID가 `[9, 4]`라면, 아직 적용하지 못한 B:4가 있다는 뜻이다. 이때 A만 적용하고 커서를 따라잡으면 B 이력이 조용히 빠진다. 반대로 `[9, 3]`이면 A만 반영해도 안전하다.

아래 `watch-state.mjs`는 **순수 판단 모듈 전체**다. 브라우저 모듈 또는 Node.js에서 쓸 수 있다. `expectedIds`는 화면이 생성 요청에 사용한 UUID 목록이며, `startWatch`가 초기 응답을 검증해 모델을 만든다. 이벤트 이름·`lastEventId`·`data`는 해당 watch의 `EventSource` 콜백에서 전달한다. 예제는 DOM·HTTP·연결 생명주기를 직접 실행하지 않는다.

```javascript
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const maxRevision = 9223372036854775807n; // DB bigint·Java long의 상한을 공유한다.
const states = new Set([
  "RECEIVING", "QUARANTINED", "SCANNING", "READY", "REJECTED", "DELETE_PENDING", "DELETED",
]); // 화면 계약에 포함된 상태만 받아들인다.

function isId(value) {
  return typeof value === "string" && value.length === 36 && uuid.test(value); // 고정 길이의 표준 소문자 UUID만 받는다.
}

function parseRevision(value) {
  if (typeof value !== "string" || value !== value.trim() || !/^(0|[1-9][0-9]{0,18})$/.test(value)) {
    return null; // BigInt로 바꾸기 전에 길이·숫자 형식을 검사한다.
  }
  const revision = BigInt(value); // Number의 안전 정수 범위를 넘는 값도 정확히 보존한다.
  return revision <= maxRevision ? revision : null;
}

function readItem(value, id) {
  if (value?.id !== id || !states.has(value.state) || parseRevision(value.revision) === null) return null;
  return { id, state: value.state, revision: value.revision }; // 상태와 위치의 쌍만 복사한다.
}

export function startWatch(raw, expectedIds) {
  if (!Array.isArray(expectedIds) || expectedIds.length < 1 || expectedIds.length > 8
      || ![...expectedIds].every(isId) || new Set(expectedIds).size !== expectedIds.length) return null;
  if (!isId(raw?.watchId) || !Array.isArray(raw.items) || raw.items.length !== expectedIds.length) return null;
  const ids = [...expectedIds].sort(); // 서버와 같은 소문자 UUID 문자열 순서로 슬롯을 맞춘다.
  const items = ids.map((id, slot) => readItem(raw.items[slot], id));
  if (items.some(item => item === null)) return null; // 빈 자리나 순서가 뒤바뀐 초기 응답을 거절한다.
  return { watchId: raw.watchId, items };
}

export function cursorOf(model) {
  return ["v1", model.watchId, ...model.items.map(item => item.revision)].join("."); // 적용된 슬롯 순서로 위치를 직렬화한다.
}

export function decideWatchFrame(model, name, lastEventId, data) {
  if (name !== "transition" && name !== "reset") return { kind: "invalid" };
  const prefix = "v1." + model.watchId + "."; // 이전 watch의 콜백이 새 화면에 적용되는 것을 막는다.
  const slots = model.items.length;
  if (typeof lastEventId !== "string" || !lastEventId.startsWith(prefix)
      || lastEventId.length > prefix.length + slots * 20 - 1) return { kind: "invalid" };
  const vector = lastEventId.slice(prefix.length).split(".").map(parseRevision);
  if (vector.length !== slots || vector.includes(null)) return { kind: "invalid" };

  let body;
  try {
    body = JSON.parse(data); // 문법이 깨진 이벤트의 위치는 반영하지 않는다.
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { kind: "invalid" };
  }
  const slot = model.items.findIndex(item => item.id === body?.id);
  if (slot < 0) return { kind: "invalid" }; // 관찰 대상이 아닌 본문은 적용하지 않는다.
  const next = readItem(body, model.items[slot].id);
  if (!next || vector[slot] !== BigInt(next.revision)) return { kind: "invalid" };

  const seen = model.items.map(item => BigInt(item.revision)); // 적용된 모델이 재개 위치의 기준이다.
  if (vector.every((value, i) => value <= seen[i])) return { kind: "ignore" }; // 전부 과거면 재전송이다.
  if (vector[slot] <= seen[slot] || vector.some((value, i) => i !== slot && value !== seen[i])) {
    return { kind: "gap" }; // 이번 자원 외에는 앞으로도 뒤로도 움직이면 안 된다.
  }
  if (name === "transition" && vector[slot] !== seen[slot] + 1n) return { kind: "gap" };

  const items = [...model.items]; // 검증이 끝난 뒤 한 슬롯만 복사본에서 바꾼다.
  items[slot] = next;
  return { kind: name === "reset" ? "replace" : "append", slot, model: { ...model, items } };
}
```

`append`는 해당 슬롯의 상태와 이력을 함께 갱신한다. `replace`는 그 슬롯의 상태만 새 기준점으로 삼고 그 자원의 이전 이력이 완전하지 않음을 표시한다. 두 경우 모두 화면 모델이 실제로 반영된 후에만 `cursorOf`의 새 값을 재개에 쓴다. `ignore`는 모델을 그대로 두고, `gap`·`invalid`나 화면 반영 실패 시에는 기존 연결을 닫아 마지막 적용 위치로 제한된 횟수만 재시도한다.

watch가 만료되거나 자원 목록이 바뀌면 일반 API로 권한과 목록을 다시 확인하고 새 watch를 만든다. 새 watch의 최초 스냅샷에서 다시 시작하는 경우, 그 전에 놓친 이벤트까지 재생했다고 표시하지 않는다. 화면 호출부는 **현재 열어 둔 EventSource 객체**인지 확인한 뒤에만 이 모듈을 호출한다. 같은 watch를 새 객체로 재연결할 때도 이전 객체의 늦은 콜백이 복구를 방해하지 않게 하고, 화면을 떠날 때 연결·타이머를 해제한다.

### 3.7 대상 수와 필요한 순서에 따라 설계를 선택한다

이 예제의 벡터는 대상이 적고 고정돼 있을 때 적합하다. 대상 수가 늘면 헤더·URL에 담는 ID와 재생 조회 비용도 함께 커진다. 반대로 현재 상태만 보여 주는 목록이라면, 한 연결에서 상태 스냅샷만 보내고 다시 연결될 때 목록을 조회하는 [스냅샷 방식](../50_11_03_Async_Status_Polling_and_SSE/11_03_Async_Status_Polling_and_SSE.md)으로도 충분하다.

수백 건이 바뀌는 화면에서는 사용자나 테넌트 단위의 **공유 피드**를 고려할 수 있다. 공유 피드는 여러 자원의 변경을 하나의 영속 목록으로 모아 그 목록의 위치를 재개 커서로 삼는 방식이다. 이 경우 커서는 작아지지만, 어떤 사용자에게 무엇을 보여 줄지, 쓰기의 확정 순서를 어떻게 보장할지, 볼 수 없는 이벤트를 건너뛸 때 커서를 어떻게 관리할지가 새 과제가 된다. 서로 다른 업로드의 revision이나 DB 시퀀스 발급 순서를 전역 commit 순서로 가정하지 않는다.

### 3.8 실행 결과와 통합 검증 범위를 구분한다

저장소 루트에서 실행하면 [회귀 검사](./check_watch_state.mjs)가 위 JavaScript 코드 펜스를 직접 읽어 실행한다. 외부 패키지나 서버가 필요하지 않다.

```powershell
# 화면 모델과 공유 커서의 관계를 Node.js에서 검사한다.
node --test SpringBoot/52_11_09_SSE_Multiplexing_and_Scoped_Cursors/check_watch_state.mjs
```

Node.js 24.18.0에서 **14개 테스트 통과**를 확인했다. 초기 순서, A·B 교차 전이, 한 자원만 reset, 중복·과거 이벤트, 누락·벡터 불일치, 다른 watch·자원, 큰 정수와 잘못된 데이터를 다뤘다.

| 통합 시험(이 노트에서 미실행) | 관찰할 결과 |
| --- | --- |
| A 프레임만 받은 뒤 단절 | 같은 객체가 보낸 재연결 헤더로 A 이후와 아직 남은 B 이벤트를 각각 읽는다. |
| 두 서버에 걸친 재연결 | 서버가 바뀌어도 같은 watch의 목록·초기 위치와 확정 이력을 읽는다. |
| 두 업로드의 이력 만료 경계가 다름 | 만료된 업로드만 reset하고 다른 업로드는 이어서 재생한다. |
| 타인 watch 접근·열린 연결의 권한 철회 | 잘못된 범위에 이벤트를 쓰지 않고, 기존 연결은 철회 감지 정책에 따라 닫힌다. |
| 프록시·느린 소비자·timeout | 이벤트 단위 전송과 연결 종료를 관찰하고, 조회 작업·타이머·등록 정보가 남지 않는지 확인한다. |

## 4. 적용 관점에서 다시 보기

현재 상태만 필요하면 스냅샷부터 시작한다. 중간 이력이 필요한 소수의 고정 대상에 벡터 커서를 쓰고, 실제로 대상이 많아지거나 자원 간 전체 순서가 필요해지면 공유 피드의 비용을 검토한다. “한 연결이면 충분한가?”와 “그 연결에 어떤 순서의 이력이 필요한가?”는 따로 답할 질문이다.

문제가 생기면 watch가 맞는지, 슬롯의 자원 순서가 같은지, 본문을 받지 않은 위치가 벡터에 들어갔는지부터 확인한다. 이력 만료는 한 자원의 기준점 교체로 처리하지만, 권한이나 대상 집합 변경은 전체 관찰 범위를 다시 만든다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

여러 업로드가 같은 연결을 공유해도 각 업로드의 순서와 접근 권한은 따로 유지한다. 벡터 커서는 그 위치들을 한 ID에 담으며, 현재 프레임에서 전달하지 않은 위치를 전진시키지 않는다.

### 5.2 이전·다음 학습과의 연결

[SSE 이벤트 이력·재생과 재동기화](../51_11_08_SSE_Event_Replay_and_Resynchronization/11_08_SSE_Event_Replay_and_Resynchronization.md)의 단일 자원 커서를 여러 자원으로 확장했다. 다음에는 **SSE 통합 테스트·권한 철회와 프록시 검증**으로 실제 연결에서 재생·종료가 의도대로 작동하는지 확인한다.

### 5.3 더 파볼 만한 주제

여러 탭이 같은 목록을 볼 때 탭마다 watch를 만들지, 연결을 공유할지를 비교해 볼 수 있다. 공유 피드가 필요하다면 피드의 공개 범위 변경과 보존 이후 초기 스냅샷을 어떻게 일치시킬지도 살펴본다.

### 5.4 참고 자료

- [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) — 객체별 이벤트 ID, 이벤트 해석·재연결.
- [RFC 9113 HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html#section-5) — HTTP 스트림의 다중화 범위.
- [Spring MVC 비동기 요청](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html), [SseEventBuilder](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.SseEventBuilder.html) — SSE 응답과 이름·ID·데이터 구성.
- [Spring Security 요청 인가](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html), [CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html) — 경로 인증과 세션 기반 POST 보호.
- [PostgreSQL 17 트랜잭션 격리](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED), [Spring Boot 관리 버전](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html) — 초기 스냅샷과 예제 버전의 기준.

## 6. 요약 정리

- 다중화는 여러 자원의 이벤트를 하나의 SSE 응답에 싣는 설계다.
- watch의 슬롯 순서를 고정하고, 대상 집합이 바뀌면 새 watch를 만든다.
- SSE 이벤트 ID 하나에 자원별 위치를 함께 담는다. 커서는 권한의 증거가 아니다.
- 서버와 브라우저는 프레임이 전달하는 자원 하나의 위치만 전진시킨다.
- 이력이 만료된 자원만 reset하며, 정상 보존 구간의 누락은 장애로 분리한다.
- 권한을 잃은 자원을 제외하려면 기존 연결을 끝내고 허용된 범위부터 다시 확인한다.

🧠 기억할 것: 연결은 하나여도, 적용 위치와 읽을 권한은 업로드마다 따로 확인한다.

## 7. 미니 퀴즈 또는 체크리스트

1. 현재 위치가 `[8, 3]`일 때 A:9 한 건을 보냈다면 SSE ID에 어떤 위치를 넣는가?
2. 같은 위치에서 A:9의 프레임 ID가 `[9, 4]`라면 화면은 왜 적용을 멈추는가?
3. A의 이력만 만료되어 A:12로 reset하면 B의 상태와 위치는 어떻게 되는가?
4. B를 볼 권한이 철회된 뒤 B를 목록에서 조용히 빼고 같은 watch를 유지하면 무엇이 잘못되는가?
5. HTTP/2 환경에서 업로드마다 EventSource를 열면 이 노트의 방식과 같은가?

<details>
<summary>정답과 해설</summary>

1. `[9, 3]`이다. B의 이벤트를 보내지 않았으므로 B의 위치는 그대로다.
2. B:4는 아직 적용하지 않았는데 전체 ID는 처리한 것처럼 보이기 때문이다. 기존 적용 위치로 복구해야 B를 빠뜨리지 않는다.
3. A만 현재 스냅샷으로 교체한다. B는 이전 상태와 위치를 유지하고 4번부터 이어 받는다.
4. 고정 슬롯과 커서의 대응이 달라지고, 이미 열린 연결에서 권한이 없는 데이터가 전송될 수 있다. 연결을 종료하고 현재 허용 범위로 새 watch를 만든다.
5. 다르다. HTTP/2가 요청들을 한 네트워크 연결에 실을 수 있어도 SSE 응답은 여러 개다. 이 예제는 여러 자원의 이벤트를 하나의 SSE 응답에 실어 재생 위치를 함께 관리한다.

</details>
