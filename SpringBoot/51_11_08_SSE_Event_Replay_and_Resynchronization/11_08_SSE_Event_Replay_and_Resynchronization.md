# Spring Boot SSE 이벤트 이력·재생과 재동기화

- 🎯 글의 목표: SSE 연결이 끊겼을 때 같은 업로드의 변경 이력을 어디서부터 다시 읽을지 판단하고, 이미 삭제된 구간은 현재 상태로 복원할 수 있다.
- 🧩 핵심 키워드: SSE, Last-Event-ID, 영속 이벤트 이력, 자원별 커서, 보존 경계, 재생, 재동기화
- ⭐ 중요도: 높음. 연결이 복구되었다는 사실만으로, 끊긴 동안의 변경을 화면이 모두 반영했다는 뜻은 아니다.
- 📝 한눈에 보는 내용: 상태와 이력 함께 저장 → 마지막 위치 이후부터 조회 → 보존 범위를 벗어나면 현재 상태로 기준점 교체
- 🔗 관련 주제: [비동기 작업 상태 조회·폴링과 SSE](../50_11_03_Async_Status_Polling_and_SSE/11_03_Async_Status_Polling_and_SSE.md), [Transactional Outbox](../25_09_23_Transactional_Outbox_and_Event_Publishing/09_23_Transactional_Outbox_and_Event_Publishing.md)
- 🧱 선수 지식: GET·JSON·SSE 이벤트의 구조, [DB 트랜잭션](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md)의 commit과 rollback

> 2026-11-08 기준. Java 21·Spring Boot 4.1.2(Spring Framework 7.0.10)·PostgreSQL 17 기준의 저장·전송 일부 코드와 JavaScript 화면 판단 예제다. Node.js 24.18.0에서 화면 판단 로직을 실행했다. Java 서버·PostgreSQL·실제 브라우저는 실행하지 않았다.

## 1. 들어가며

업로드 화면이 `SCANNING`을 표시하다 잠깐 연결이 끊겼다. 그동안 검사 오류로 `QUARANTINED`에 돌아갔다가 다시 `SCANNING`을 거쳐 `READY`가 되었다면, 다시 접속해 현재 상태만 조회해도 다운로드 버튼은 올바르게 표시할 수 있다. 하지만 “왜 검사에 시간이 걸렸는지”를 화면에 보여 주려면 중간 전이도 필요하다.

이전 노트의 **SSE(Server-Sent Events, 서버가 열린 HTTP 응답을 통해 브라우저에 이벤트를 보내는 방식)**는 현재 상태 스냅샷을 다시 읽는 데 집중했다. 이번에는 기존 경로를 바꾸지 않고, 한 업로드의 최근 상태 이력을 보여 주는 별도 경로를 설계한다. 화면용 이력과 법적·운영 감사 기록은 요구되는 보존 기간과 접근 권한이 다르므로 같은 기능으로 취급하지 않는다.

## 2. 핵심 개념 정리

```text
작업자: 업로드 상태 변경 + 새 위치의 이벤트 기록 → 같은 트랜잭션으로 확정
브라우저: 현재 상태 GET → 위치를 가지고 SSE 연결
서버: 위치 이후 이벤트를 순서대로 읽음
  ├─ 이력이 남아 있음 → 이어서 재생하고 같은 방식으로 새 변경도 조회
  └─ 앞부분이 삭제됨 → 현재 상태와 새 위치를 한 프레임으로 전달
브라우저: 중복은 무시하고, 설명되지 않는 누락은 복구 경로로 분리
```

핵심 질문은 두 가지다. “내가 마지막으로 적용한 위치는 어디인가?” 그리고 “서버가 그 다음부터 빠짐없이 제공할 수 있는가?” 이 둘을 함께 확인해야 화면의 현재 상태와 이력이 어긋나지 않는다.

## 3. 본문 정리

### 3.1 스냅샷 버전과 이력 커서는 목적이 다르다

**스냅샷**은 한 시점의 전체 표시 상태이고, **revision**은 그 상태의 갱신 번호다. **커서(cursor)**는 특정 이력에서 어디까지 읽었는지를 알려 주는 위치표다. 예를 들어 “업로드 A의 8번까지 봤다”는 현재 화면의 기준인 동시에, 이력 조회에 “A의 9번부터 주세요”라고 요청하는 근거가 된다.

이번 예제는 **한 업로드의 공개 상태가 바뀔 때마다 revision을 한 칸 올리고, 그 번호로 이벤트를 하나만** 저장한다. 이 전제 덕분에 revision을 커서의 숫자 부분으로 재사용한다. DB는 업로드별 번호를 저장하고, HTTP에서는 `<upload UUID>:<revision>`으로 범위를 드러낸다. 두 업로드의 10번은 서로 다른 위치다. 업로드 ID를 재사용하지 않고, 하나의 업로드가 다른 소유자에게 이전되는 경우는 이 예제에서 다루지 않는다.

| 원하는 화면 | 받은 값 | 판단 |
| --- | --- | --- |
| 현재 상태 배지 | 8번 뒤 11번 스냅샷 | 11번으로 갱신하면 충분하다. |
| 연속된 최근 이력 | 8번 뒤 11번 일반 이벤트 | 9·10번이 비었으므로 적용을 멈추고 복구한다. |
| 보존 경계 이후의 화면 | 8번 뒤 11번 `reset` | 현재 상태를 11번으로 맞추고, 앞 이력이 비었음을 표시한다. |

한 번의 상태 변경이 여러 이벤트를 만들거나, 사용자마다 중간 이벤트를 걸러 보내는 경우에는 이 번호 규칙을 그대로 쓸 수 없다. 전자는 별도 이벤트 순번이 필요하고, 후자는 수신자가 보는 스트림의 범위와 누락 판정을 따로 정해야 한다.

### 3.2 상태가 확정될 때 이력도 같은 DB에 기록한다

상태를 먼저 commit한 뒤 네트워크로만 이벤트를 보내면, 두 작업 사이에 프로세스가 종료될 때 이벤트가 사라진다. **영속 이력**은 프로세스가 재시작해도 DB에 남아 다시 읽을 수 있는 기록이다. 상태와 이력을 한 트랜잭션으로 묶으면, 상태는 `READY`인데 대응하는 전이가 없는 중간 결과를 만들지 않는다. [Outbox 노트](../25_09_23_Transactional_Outbox_and_Event_Publishing/09_23_Transactional_Outbox_and_Event_Publishing.md)와 저장 원리는 같지만, 여기서는 브로커 전달 여부가 아니라 클라이언트에게 재생할 이력을 관리한다.

아래는 [업로드 상태 스키마](../46_10_28_Upload_Lifecycle_Quarantine_and_Cleanup/10_28_Upload_Lifecycle_Quarantine_and_Cleanup.md)의 `upload_asset`과 50번 노트의 `status_revision`을 전제로 하는 **마이그레이션 일부**다. 기존 쓰기를 일시 중단하거나 호환 전환 계획을 마련한다. 스키마와 초기 보존 경계를 한 마이그레이션 트랜잭션에서 적용하고, 이력 저장을 모르는 구버전 작업자가 다시 쓰지 않도록 한 뒤 새 경로를 연다.

```sql
ALTER TABLE upload_asset
    ADD COLUMN replay_floor bigint NOT NULL DEFAULT 0; -- 이 위치 뒤부터 끊김 없이 읽을 수 있다.

UPDATE upload_asset
SET replay_floor = status_revision; -- 기존 상태를 시작점으로 삼는다. 과거 전이를 지어내지 않는다.

ALTER TABLE upload_asset
    ADD CONSTRAINT upload_replay_floor_range
    CHECK (replay_floor >= 0 AND replay_floor <= status_revision); -- 미래 위치까지 삭제할 수 없다.

CREATE TABLE upload_status_event (
    upload_id uuid NOT NULL REFERENCES upload_asset(id) ON DELETE CASCADE, -- 업로드가 사라지면 화면용 이력도 지운다.
    revision bigint NOT NULL CHECK (revision > 0), -- 0은 최초 스냅샷의 기준점이다.
    state text NOT NULL CHECK (state IN (
        'RECEIVING', 'QUARANTINED', 'SCANNING', 'READY',
        'REJECTED', 'DELETE_PENDING', 'DELETED'
    )), -- 표시 가능한 상태만 남긴다. 검사 원문이나 저장 키는 저장하지 않는다.
    PRIMARY KEY (upload_id, revision) -- 같은 업로드의 같은 위치를 두 번 쓸 수 없다.
);
```

`replay_floor`는 가장 오래된 **이벤트 번호**가 아니라, 서버가 아직 이어서 읽어 줄 수 있는 가장 낮은 **커서 번호**다. 예를 들어 10번까지 지웠다면 floor는 10, 읽을 수 있는 첫 이벤트는 11이다. 기본키는 중복 저장을 막지만 번호 사이의 구멍까지 막지는 않는다. 연속성은 모든 상태 쓰기가 같은 갱신 규칙을 지킬 때 성립한다. [PostgreSQL 기본키·외래 키](https://www.postgresql.org/docs/17/ddl-constraints.html)

다음은 검사 결과가 이미 통과로 검증된 경우에만 호출하는 **조건부 쓰기 일부**다. `:id` 등은 내부 검사 보고서의 값을 바인딩하는 자리다. 거절·재시도·만료 등 다른 상태 전이도 같은 형태로 반영해야 하며, 기존 DB 보호 조건은 제거하지 않는다.

```sql
WITH changed AS (
    UPDATE upload_asset
    SET state = 'READY',                         -- 검증한 버전만 다운로드 가능 상태로 바꾼다.
        result_code = 'PASSED',                 -- 기존 상태 테이블의 READY 조건을 만족시킨다.
        next_scan_at = NULL,                    -- 더는 이 검사에 재시도 시각이 필요하지 않다.
        scan_token = NULL,                      -- 현재 검사 작업자의 확정 권한을 제거한다.
        scan_lease_until = NULL,                -- SCANNING을 벗어나므로 담당 기한도 제거한다.
        status_revision = status_revision + 1   -- 같은 업로드 행의 번호를 정확히 한 칸 올린다.
    WHERE id = :id AND state = 'SCANNING'        -- 대상 업로드가 여전히 검사 중이어야 한다.
      AND scan_token = :token                   -- 과거 작업자의 늦은 결과는 거절한다.
      AND object_version = :version AND sha256_hex = :sha256
      AND policy_version = :policy              -- 검사한 바이트와 정책이 아직 맞는지 확인한다.
      AND scan_lease_until > clock_timestamp()  -- 담당 기한과 업로드 만료를 각각 검사한다.
      AND expires_at > clock_timestamp()
    RETURNING id, status_revision, state        -- 실제로 바뀐 행만 다음 INSERT로 전달한다.
)
INSERT INTO upload_status_event (upload_id, revision, state)
SELECT id, status_revision, state FROM changed  -- 변경 0행이면 이력도 0행이다.
RETURNING revision;                             -- 1행일 때 저장된 이벤트 위치를 얻는다.
```

INSERT가 실패하면 UPDATE도 확정되지 않는다. UPDATE는 같은 업로드 행을 쓰는 트랜잭션끼리 직렬화하므로, 이 설계는 업로드 하나 안에서 순서를 정한다. 서로 다른 행에 발급한 전역 시퀀스 번호나 시간만으로 commit 순서를 추정하면 안 된다. 먼저 번호를 얻은 트랜잭션이 나중에 commit할 수도 있다. [PostgreSQL 데이터 수정 WITH](https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-MODIFYING), [Read Committed의 UPDATE](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

### 3.3 Last-Event-ID는 연결 재개 위치이지 처리 완료 확인이 아니다

브라우저의 `EventSource`는 SSE를 읽는 객체다. 서버가 보낸 `id:` 필드에서 마지막 이벤트 ID를 기억하고, **같은 객체가** 연결을 다시 열 때 값이 비어 있지 않으면 `Last-Event-ID` 요청 헤더를 보낸다. 새로고침이나 새 객체 생성 시 그 객체의 기억은 이어지지 않는다. [WHATWG: Last-Event-ID와 이벤트 해석](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header)

이 예제에서 새 화면은 먼저 기존 `GET /uploads/{id}/status`로 스냅샷을 받는다. 그 스냅샷의 ID와 revision을 합쳐 별도 SSE 경로인 `GET /uploads/{id}/events/replay?after=…`의 첫 위치로 넣는다. URL을 조립할 때는 `URLSearchParams`로 값을 인코딩한다. 이 화면의 이력은 최초 관찰 이후부터 표시한다. 화면을 열기 전의 이력도 보여 주려면 최초 이력 조회 계약이 별도로 필요하다.

자동 재연결에서는 URL에 최초 `after`가 남아 있으므로, **헤더가 있으면 헤더를 우선**해야 새로 본 위치부터 이어진다.

```text
id: 00000000-0000-0000-0000-000000000051:9
event: transition
data: {"id":"00000000-0000-0000-0000-000000000051","state":"QUARANTINED","revision":"9"}

```

이 프레임은 “9번에 재검사 대기로 돌아갔다”는 뜻이다. `id:`는 재개 위치, `event:`는 이름 있는 이벤트의 종류, `data:`는 공개 상태다. 마지막 빈 줄이 프레임을 끝낸다. 다음 연결이 9번에서 시작한다면 서버는 9번이 아니라 **9번보다 큰** 이벤트를 조회한다.

⚠️ 주의: 브라우저가 기억하는 ID는 화면 콜백이 데이터를 성공적으로 적용했다는 확인이 아니다. 파싱·화면 갱신이 실패했는데 자동 재연결에 맡기면 적용하지 않은 위치 이후부터 받을 수 있다. 실패 시 현재 객체를 닫고 마지막으로 **적용한** 위치로 새 연결을 열거나, 현재 상태부터 재동기화한다. 새로고침에도 이어 보려면 사용자·업로드 범위를 묶고 화면 상태와 적용 커서를 함께 저장해야 한다. 이 예제는 브라우저 저장소에 이력을 저장하지 않는다.

### 3.4 커서가 올바르더라도 자원을 조회할 권한은 별도다

SSE 연결을 열기 전에 일반 상태 조회와 같은 세션 인증과 자원 권한을 확인한다. ID가 같다는 것은 이력의 범위가 맞다는 뜻일 뿐, 접근을 허용한다는 뜻은 아니다. 인증되지 않은 요청은 401, 존재하지 않거나 읽을 권한이 없는 업로드는 404로 처리하는 기존 API 정책을 유지한다. 권한 확인 후 커서가 없거나 잘못된 경우, 현재 revision보다 큰 경우는 이 예제에서 400으로 분류한다. [Spring Security 요청 권한](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)

아래 `ReplayFrames.java`는 50번 노트와 같은 `src/main/java/com/example/upload/`에 추가하는 **보조 파일**이다. 기존 `UploadStatus` DTO(응답 필드를 묶은 객체)와 `spring-boot-starter-webmvc`가 필요하다. 컨트롤러가 인증·자원 접근·중복 매개변수 거절을 맡고, 저장 계층이 실제 조회 범위를 검증한다.

```java
package com.example.upload;

import java.io.IOException;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

final class ReplayFrames {
    private ReplayFrames() {} // 연결 상태를 보관하지 않는 도우미라 인스턴스를 만들지 않는다.

    static long readAfter(UUID uploadId, String lastEventId, String queryAfter) {
        // 헤더가 아예 없는 첫 연결만 URL의 after를 쓴다. 잘못된 헤더를 조용히 우회하지 않는다.
        String raw = lastEventId != null ? lastEventId : queryAfter;
        String scope = uploadId + ":"; // 경로에서 검증된 UUID의 표준 문자열로 범위를 고정한다.
        if (raw == null || raw.length() > scope.length() + 19 || !raw.startsWith(scope)) {
            throw new IllegalArgumentException("invalid replay cursor"); // 길이와 다른 업로드의 커서를 거절한다.
        }
        String digits = raw.substring(scope.length()); // 범위를 확인한 뒤 숫자 부분만 검사한다.
        if (!digits.matches("0|[1-9][0-9]{0,18}")) {
            throw new IllegalArgumentException("invalid replay revision"); // 부호·공백·선행 0은 허용하지 않는다.
        }
        return Long.parseLong(digits); // 19자리여도 bigint 범위를 넘으면 NumberFormatException이 발생한다.
    }

    static void send(SseEmitter emitter, UploadStatus status, boolean reset) throws IOException {
        String cursor = status.id() + ":" + status.revision(); // 데이터와 같은 스냅샷에서 ID를 만든다.
        emitter.send(SseEmitter.event()
                .name(reset ? "reset" : "transition") // 이력 한 건과 기준점 교체를 다르게 해석한다.
                .id(cursor) // 브라우저가 프레임을 끝까지 해석하면 이 위치를 재연결에 사용한다.
                .data(status, MediaType.APPLICATION_JSON)); // 내부 컬럼 없이 기존 공개 DTO만 직렬화한다.
    }
}
```

컨트롤러는 `readAfter`에서 발생한 입력 예외만 연결 시작 전 400으로 변환한다. DB 장애나 전송 오류를 잘못된 입력으로 처리하지 않는다. 실제 스트림은 `text/event-stream`이며 응답에 `Cache-Control: no-store`를 둔다. 같은 출처의 세션으로 인증하고, 커서나 URL에 인증 토큰을 넣지 않는다.

`send`는 프레임만 작성한다. DTO를 한 줄 JSON으로 직렬화하는 설정을 전제로 하며, 호출 측에서 한 연결의 전송을 순차 실행하고 실패한 전송 이후에는 다음 이벤트를 이어 보내지 않는다. 연결 유지 신호가 필요하면 위치를 바꾸지 않는 SSE 주석을 보낸다. [Spring SseEventBuilder](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.SseEventBuilder.html), [Spring MVC 비동기 요청](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html)

### 3.5 보존 경계와 현재 상태를 같은 시점에서 읽는다

DB에 남겨 둔 구간만 재생할 수 있다. 예를 들어 현재 revision이 15이고 보존 경계가 10이라면, 10에서 이어 달라는 요청에는 11~15를 줄 수 있지만 9에서는 10번 이벤트를 줄 수 없다. `reset`은 이때 **이미 지나간 전이를 복구했다고 주장하지 않고**, 현재 상태와 앞으로 이어 갈 위치를 한 프레임으로 전달하는 메시지다.

이력 정리는 앞부분만 지운다. 예를 들어 업로드마다 최신 100건을 남기는 정책이라면, 짧은 트랜잭션에서 해당 업로드 행을 `SELECT … FOR UPDATE`로 잠그고 `max(기존 floor, 현재 revision - 100)`을 새 floor로 계산한다. 그 위치 이하의 이력을 삭제하고 floor를 같은 트랜잭션에서 갱신한다. 100건은 예시다. 시간 정책을 쓰더라도 연속된 앞부분만 정리하고, 새 floor보다 뒤의 번호에 구멍을 만들지 않는다. [PostgreSQL 행 잠금](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

다음은 **읽기 저장소에 넣는 SQL 일부**다. `:subject`에는 인증 결과의 사용자 식별자를, `:after`에는 위에서 검증한 번호를 넣는다. `:limit`은 서버가 고정하는 양수(예: 50)다. 예제는 소유자 범위이며, 별도 공유·계정 비활성 정책이 있다면 실제 조회 권한도 확인한다.

```sql
SELECT a.id, a.state AS current_state,                    -- reset에 사용할 현재 표시 상태다.
       a.status_revision AS head, a.replay_floor AS floor, -- 끝 위치와 보존 경계를 같이 읽는다.
       page.revision AS event_revision, page.state AS event_state
FROM upload_asset AS a
LEFT JOIN LATERAL (                                      -- 이 업로드의 작은 배치만 읽는다.
    SELECT e.revision, e.state
    FROM upload_status_event AS e
    WHERE e.upload_id = a.id                              -- 다른 업로드의 이력을 섞지 않는다.
      AND :after BETWEEN a.replay_floor AND a.status_revision -- 재생 가능한 커서만 조회한다.
      AND e.revision > :after AND e.revision <= a.status_revision -- 이미 본 위치는 제외한다.
    ORDER BY e.revision ASC                               -- limit 전에 작은 번호부터 고른다.
    LIMIT :limit
) AS page ON TRUE                                        -- 이력이 없어도 현재 상태 행은 남긴다.
WHERE a.id = :id AND a.owner_subject = :subject            -- 소유자에게만 이력과 현재 상태를 읽어 준다.
ORDER BY page.revision ASC;                               -- 응답 행의 순서까지 명시한다.
```

한 SQL 문장으로 조회하면 PostgreSQL Read Committed에서도 같은 문장 시작 시점에 보이는 데이터를 사용한다. 반대로 “현재 상태 15 조회 → 새 전이 16 commit → 최신 번호 16 조회”를 별개로 수행해 `reset`에 상태 15와 ID 16을 담으면, 브라우저는 16번의 실제 상태를 건너뛴다. [PostgreSQL 문장별 스냅샷](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

| 조회 결과 | 스트림 동작 |
| --- | --- |
| 0행 | 읽을 수 없는 자원이다. 응답 시작 전에는 404, 열린 스트림에서는 새 데이터를 보내지 않고 종료한다. |
| `after < floor` | `reset`의 본문에 현재 상태, 본문 revision과 SSE ID에는 같은 `head`를 넣는다. 다음 조회는 `head` 이후부터다. |
| `floor <= after <= head` | 번호가 연속되는지 확인한 뒤 최대 limit건을 작은 번호부터 보낸다. `after == head`의 빈 배치는 정상 대기다. |
| `after > head` 또는 보존 구간 안에서 빠진 번호 | 미래 커서 또는 저장 계약 위반이다. 미래 커서는 시작 전 거절하고, 불연속 이력은 서버 오류로 기록한다. 이미 열린 응답은 HTTP 상태를 바꿀 수 없으므로 전송을 끝낸다. |

⚠️ 주의: `after < head`인데 첫 행이 `after + 1`이 아니거나, 배치가 비어 있거나, limit에 미달한 배치가 head에 도달하지 못했다면 이력 구멍을 의심한다. 이를 정상 `reset`으로 숨기면 쓰기·정리 오류와 정상 보존 만료를 구별할 수 없다.

### 3.6 재생과 새 변경에 같은 조회 경로를 사용한다

과거 이력을 다 읽은 직후에 실시간 구독을 등록하면, 두 작업 사이에 생긴 이벤트를 놓칠 수 있다. 이 예제는 과거와 실시간을 나누지 않고 **같은 DB 조회를 다음 위치로 반복**한다. 예를 들어 11~13번을 보낸 직후 14번이 commit되면, 다음 조회에서 `revision > 13`으로 14번을 찾는다. 알림을 붙이더라도 “DB에 다시 읽을 것이 있을 수 있다”는 신호로만 사용하고, 알림 유실에 대비해 주기 조회를 남긴다.

각 반복에서 현재 권한과 종료 신호를 확인하고, 제한된 배치를 주 DB에서 읽어 트랜잭션을 끝낸 뒤 네트워크로 보낸다. 서버가 달라져도 같은 확정 이력을 읽도록 한다. 프레임 전송에 실패하면 그 연결의 조회·타이머·구독을 정리한다. 전송 성공은 서버가 **그 연결에서 다음 프레임을 보낼 위치**를 갱신할 근거일 뿐, 브라우저가 처리했다고 DB에 기록할 근거는 아니다. 빈 배치일 때 즉시 무한 조회하지 않고 일정 시간 대기한다.

접근 철회는 다음 조회 또는 별도 권한 철회 신호로 감지한다. 배치를 읽은 뒤 전송하기 전에도 확인하되, 이미 네트워크에 보낸 데이터를 되돌릴 수는 없다. 허용 가능한 철회 지연, 동시 연결 수, 배치 크기, 최대 연결·재생 시간, 느린 소비자의 전송 제한을 정한다. HTTP 연결이 유지되는 동안 DB 트랜잭션이나 업로드 행 잠금을 계속 잡지 않는다.

### 3.7 화면은 재생 이벤트와 reset을 다르게 적용한다

화면의 **적용 커서**는 성공적으로 반영한 스냅샷의 번호다. 동일하거나 과거 번호는 무시하고, 일반 이벤트가 한 칸보다 크게 뛰면 현재 모델을 바꾸지 않는다. 예외적으로 서버가 보낸 유효한 `reset`은 새 기준점을 설치한다. 예를 들어 8번 뒤 12번 `reset`이면 배지를 12번 상태로 갱신하고, 이력 화면에는 9~12번 전이를 모두 보았다고 표시하지 않는다.

다음 `replay-state.mjs`는 브라우저 모듈 또는 Node.js에서 사용할 수 있는 **순수 판단 모듈 전체**다. 첫 GET 응답을 `readSnapshot(body, uploadId)`에 전달하고 `null`이면 연결을 시작하지 않는다. SSE 이벤트 이름·`event.lastEventId`·`event.data`를 `decideReplay`에 넘긴다. DOM, 네트워크 연결과 재시도는 이 모듈이 맡지 않는다.

```javascript
const states = new Set([
  "RECEIVING", "QUARANTINED", "SCANNING", "READY",
  "REJECTED", "DELETE_PENDING", "DELETED",
]); // 화면에 공개할 수 있는 업무 상태만 허용한다.
const maxRevision = 9223372036854775807n; // PostgreSQL bigint·Java long의 양수 최댓값이다.

export function readSnapshot(value, expectedId) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { id, state, revision } = value; // 네트워크 응답에서는 이 세 필드만 꺼낸다.
  if (id !== expectedId || !states.has(state)) return null; // 현재 화면의 자원과 알려진 상태만 받는다.
  if (typeof revision !== "string" || revision.trim() !== revision
      || !/^(0|[1-9][0-9]{0,18})$/.test(revision)
      || BigInt(revision) > maxRevision) return null; // 짧고 정규화된 문자열인지 확인한 뒤 큰 정수로 검사한다.
  return { id, state, revision }; // 원본 객체의 나머지 필드는 화면 모델에 섞지 않는다.
}

export function decideReplay(current, name, lastEventId, data) {
  // current는 GET 또는 앞서 수락한 이벤트에서 얻은, 이미 검사된 스냅샷이다.
  if (name !== "transition" && name !== "reset") return { kind: "invalid" };
  let next;
  try {
    next = readSnapshot(JSON.parse(data), current.id); // JSON이 깨졌거나 다른 업로드면 적용할 수 없다.
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error; // JSON 오류 외의 결함은 숨기지 않는다.
    return { kind: "invalid" };
  }
  if (!next || lastEventId !== `${next.id}:${next.revision}`) {
    return { kind: "invalid" }; // 프로토콜의 위치와 본문의 위치가 동일해야 한다.
  }

  const seen = BigInt(current.revision); // Number로 바꾸면 큰 번호의 차이 1을 잃을 수 있다.
  const incoming = BigInt(next.revision);
  if (incoming <= seen) return { kind: "ignore" }; // 늦은 reset도 최신 화면을 되돌릴 수 없다.
  if (name === "reset") return { kind: "replace", next }; // 새 상태를 쓰고 이력 앞부분 미제공을 표시한다.
  if (incoming !== seen + 1n) return { kind: "gap" }; // 일반 이벤트가 비면 커서를 건너뛰지 않는다.
  return { kind: "append", next }; // 검증한 한 건을 화면의 이력과 상태에 함께 반영한다.
}
```

호출 측은 `append`일 때 이력과 현재 상태를, `replace`일 때 현재 상태와 이력의 표시 기준을 **하나의 화면 모델 갱신**으로 처리한다. `ignore`는 모델을 건드리지 않는다. `gap`·`invalid`이면 기존 객체를 닫은 뒤 마지막 적용 커서로 새 객체를 열어 제한된 횟수만 다시 시도한다. 반복 실패 시 현재 GET으로 돌아가되 이력을 모두 받지 못했음을 표시한다.

EventSource의 `error` 이벤트만으로 서버의 400·401·404 응답 본문을 읽는 방식은 사용하지 않는다. 자동 재연결은 일시 단절에 쓰고, 닫힘·반복 실패는 일반 GET으로 현재 상태와 권한을 확인해 분류한다. 새 연결을 시작하거나 화면을 떠날 때 이전 연결·대기 타이머를 정리하고 늦은 콜백은 무시한다. [WHATWG EventSource 인터페이스와 재연결](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)

### 3.8 무엇을 실행했고 무엇을 더 시험해야 하는가

저장소 루트에서 다음 명령을 실행하면 [회귀 검사](./check_replay_state.mjs)가 문서의 JavaScript 펜스에서 위 모듈을 읽어 직접 실행한다. 별도 패키지나 서버는 필요하지 않다.

```powershell
# 문서에 실제로 실린 코드의 상태·이력 판정을 Node.js에서 검증한다.
node --test SpringBoot/51_11_08_SSE_Event_Replay_and_Resynchronization/check_replay_state.mjs
```

Node.js 24.18.0에서 **13개 테스트 통과**를 확인했다. 정상 전이·재시도 상태·중복·순서 역전·누락·reset·큰 번호·서로 다른 자원·깨진 프레임을 다룬다. 실제 브라우저의 헤더 전송, Java 직렬화, DB 잠금·SQL·commit은 이 검사의 범위가 아니다.

| 별도 통합 시험 | 기대하는 결과(이 노트에서 미실행) |
| --- | --- |
| 이력 INSERT 실패·중복 검사 결과 | 실패한 쓰기는 상태·번호도 rollback한다. 조건을 잃은 재실행은 상태·이력 모두 변경하지 않는다. |
| 재생이 끝난 직후 commit 또는 연결 단절 | 다음 배치 또는 다른 서버로의 재연결에서 마지막 위치 이후 이벤트를 읽는다. |
| 정리와 재생의 동시 실행 | 정리 전의 연속된 배치 또는 정리 후의 reset을 본다. 현재 상태와 reset ID는 같은 revision이다. |
| 같은 객체의 재연결·새 객체 생성 | 같은 객체의 헤더가 초기 쿼리보다 우선한다. 새 객체는 마지막 적용 커서를 명시해 시작한다. |
| 다른 사용자·연결 중 권한 철회 | 권한 없는 연결에서 이력을 제공하지 않는다. 기존 연결은 정해 둔 권한 확인 시점에 종료된다. |

## 4. 적용 관점에서 다시 보기

현재 상태만 필요한 화면은 기존 스냅샷 방식을 유지한다. 중간 변경이 실제로 필요한 화면에서만 이력 저장·보존과 재생 경로를 추가한다. 이때 이력을 쓰는 모든 상태 변경 경로와 정리 작업을 먼저 맞춘 뒤 커서를 노출한다.

복구는 “마지막 적용 위치가 맞는가 → 해당 업로드를 읽을 권한이 있는가 → 이 위치 이후가 보존되어 있는가 → 보낸 프레임을 화면이 적용했는가” 순서로 점검한다. 정상 만료에 따른 reset, 예상 밖의 이력 구멍, 권한 종료를 구분하면 연결 문제와 저장 문제를 따로 추적할 수 있다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

SSE 연결을 복구하는 일과 이력을 복구하는 일은 다르다. 재생할 수 없는 구간에서는 이전 이벤트를 복원한 척하지 않고, 현재 상태와 일치하는 새 위치에서 다시 시작한다.

### 5.2 이전·다음 학습과의 연결

[상태 조회·폴링과 SSE](../50_11_03_Async_Status_Polling_and_SSE/11_03_Async_Status_Polling_and_SSE.md)의 revision을 업로드별 이력 위치로 확장했다. 다음에는 여러 업로드의 상태를 한 화면에서 볼 때 **SSE 연결 다중화·자원별 권한·공유 스트림의 커서**를 어떻게 설계할지 살펴본다.

### 5.3 더 파볼 만한 주제

재생 조회량, 보존 만료 reset 비율, 느린 소비자의 종료 횟수를 관찰하면 보존량과 배치 크기를 실제 사용 패턴에 맞출 수 있다. 감사 기록이 필요하다면 화면용 이력과 별개로 보존·삭제·권한 계약을 검토한다.

### 5.4 참고 자료

- [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) — `id` 필드, 재연결 헤더, 빈 줄, 이벤트 처리 순서.
- [Spring MVC 비동기 요청](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html)과 [SseEventBuilder](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.SseEventBuilder.html) — 전송 프레임 구성과 오류 처리의 범위.
- [PostgreSQL 17 데이터 수정 WITH](https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-MODIFYING), [트랜잭션 격리](https://www.postgresql.org/docs/17/transaction-iso.html), [행 잠금](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS) — 상태·이력 쓰기, 문장 단위 조회 일관성, 보존 정리와 쓰기의 경쟁.
- [Spring Security 요청 권한](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html), [Spring Boot 관리 버전](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html) — 요청 권한의 범위와 예제 버전 확인.

## 6. 요약 정리

- 현재 표시 상태만 필요하다면 스냅샷으로 복원하고, 중간 전이가 필요하면 영속 이력을 둔다.
- 한 업로드의 상태 갱신과 이력 추가를 같은 트랜잭션으로 확정한다.
- 커서의 업로드 범위와 조회 권한을 검증하고, 현재 위치보다 큰 값은 정상 재생으로 취급하지 않는다.
- 보존 경계와 동일한 커서는 유효하다. 그보다 낮으면 현재 스냅샷과 같은 번호로 reset한다.
- 과거와 새 이벤트를 같은 번호 기준으로 읽으면 전환 사이에 생긴 commit도 다음 조회에서 발견할 수 있다.
- 일반 이벤트의 번호가 뛰면 건너뛰지 않는다. 브라우저가 수신한 ID와 화면이 적용한 ID는 다를 수 있다.

🧠 기억할 것: 커서는 재생을 시작할 위치이고, reset은 잃어버린 전이 대신 새 출발점을 알려 주는 메시지다.

## 7. 미니 퀴즈 또는 체크리스트

1. `after=10`, `floor=10`, `head=15`라면 reset이 필요한가? 첫 이벤트는 몇 번인가?
2. 8번을 적용한 화면이 11번 `transition`과 11번 `reset`을 각각 받으면 어떻게 다른가?
3. 서버가 `READY`를 commit하고 재생 이력 INSERT 직전에 종료되면 어떤 문제가 생기는가? 어떻게 예방하는가?
4. `Last-Event-ID`에 같은 업로드 ID가 있고 번호도 올바르다면 이력을 바로 보내도 되는가?
5. 현재 상태 15와 커서 16을 섞어 reset하면 다음 연결에서 어떤 이벤트가 빠질 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 필요 없다. 10번은 이어 읽을 수 있는 가장 낮은 위치이므로 11번부터 받는다.
2. 일반 이벤트는 9·10번이 빠졌으므로 적용하지 않고 복구한다. 유효한 reset은 11번을 새 기준점으로 삼되 앞의 이력이 제공되지 않았음을 표시한다.
3. 현재 상태는 바뀌었지만 화면이 다시 읽을 전이가 없다. 두 변경을 같은 트랜잭션에 넣어 둘 다 확정되거나 둘 다 취소되게 한다.
4. 안 된다. 커서는 어디에서 읽을지를 말할 뿐 누가 읽을 수 있는지는 말하지 않는다. 인증·자원별 권한·보존 범위를 따로 검사한다.
5. 16번이다. 화면은 15번 상태를 표시하지만 서버에는 이미 16번까지 봤다고 전달하므로, 16번에 실제로 바뀐 상태를 놓칠 수 있다.

</details>
