# 비동기 작업 상태 조회·폴링과 SSE

- 🎯 글의 목표: 오래 걸리는 업로드 검사의 상태를 권한 있는 사용자에게 전달하고, 지연 응답·재연결·화면 종료 상황에서도 최신 상태를 안전하게 표시한다.
- 🧩 핵심 키워드: 상태 스냅샷, revision, 폴링, SSE, EventSource, SseEmitter, 재연결, 권한 재검사, 구독 정리
- ⭐ 중요도: 높음. 작업이 실행되는 것과 사용자가 그 결과를 아는 것은 다른 문제이며, 통신 실패를 작업 실패로 오해하거나 오래된 응답으로 화면을 되돌릴 수 있다.
- 📝 한눈에 보는 내용: 상태 계약 → 권한 있는 GET → 순차 폴링 → SSE 스냅샷 → 재연결·권한·자원 정리 → 대역 검사와 실제 서버 검증
- 🔗 관련 주제: [업로드 실패 주입과 정합성 검증](../49_11_02_Upload_Integration_Testing_and_Consistency/11_02_Upload_Integration_Testing_and_Consistency.md), [업로드 상태·격리와 정리](../46_10_28_Upload_Lifecycle_Quarantine_and_Cleanup/10_28_Upload_Lifecycle_Quarantine_and_Cleanup.md), [비동기 실행과 스레드 풀](../31_10_02_Async_and_Thread_Pools/10_02_Async_and_Thread_Pools.md), [Spring Security](../11_09_07_Spring_Security_Fundamentals/09_07_Spring_Security_Fundamentals.md)
- 🧱 선수 지식: HTTP 상태·JSON, Java record·생성자 주입, DB commit, TypeScript Promise·fetch·이벤트·AbortController

> 기준일: 2026-11-03. Java 21·기존 Spring Boot 4.1.2·Spring Framework 7.0.10·Spring Security 7.1.2 프로젝트를 기준으로 한다. 브라우저 예제는 BigInt·AbortSignal.any/timeout을 지원하는 환경을 전제로 한다. 예제는 현재 상태 스냅샷을 조회/전달하며 모든 과거 이벤트를 재생하는 시스템이 아니다. DB 어댑터·SSE 구독 브리지·인증 구성은 연결 계약으로 남긴다. 실제 수행한 검사와 Java·브라우저 미실행 범위는 3.10에서 구분한다.

## 1. 들어가며

업로드가 접수되었지만 내용 검사는 아직 진행 중이라고 하자. 화면에 무한 로딩만 보여 주면 사용자는 기다려야 하는지, 다시 업로드해야 하는지 알기 어렵다. 반대로 접수 응답을 파일 사용 승인으로 표시하면 검사 전 파일이 준비된 것처럼 보인다.

이전 노트는 저장·검사·취소의 실패 경계를 확인했다. 이번에는 그 결과를 사용자 화면에 전달한다. 핵심 질문은 **“현재 상태를 누가 조회할 수 있고, 나중에 도착한 정보 중 무엇을 최신이라고 믿을 것인가?”**다.

먼저 조회 API와 순차 폴링을 만들고, 더 빠른 갱신이 필요하면 SSE를 추가한다. 작업 실행·취소 API 자체는 다시 구현하지 않으며, 화면의 구독을 닫는 것과 서버 작업을 취소하는 것은 구분한다.

## 2. 핵심 개념 정리

```text
작업자: 상태 변경 + revision 증가를 같은 DB 트랜잭션으로 commit
  → 조회 API: 인증·소유자 확인 후 현재 스냅샷 반환
  → 폴링: 앞 요청이 끝난 뒤 다음 GET
  → SSE: 열린 HTTP 연결에 최신 스냅샷 전달
  → 화면: 같은 작업 ID·더 큰 revision만 반영
  → 연결 유실: 현재 상태 재조회; 작업 실패로 바꾸지 않음
  → 화면 종료: 요청·타이머·구독 정리; 업무 작업은 별개
```

스냅샷은 한 시점의 상태 묶음이고, 이벤트 이력은 그 상태가 되기까지의 변화 기록이다. 이번에는 현재 화면을 복구하는 스냅샷을 중심에 두며, SSE를 유일한 정답 저장소로 사용하지 않는다.

## 3. 본문 정리

### 3.1 전송 완료·검사 완료·조회 실패를 서로 다른 상태로 보기

업로드 바이트 전송이 100%여도 `QUARANTINED`·`SCANNING`일 수 있다. 검사 단계의 실제 진행률을 알 수 없다면 임의의 90%·99%를 만들어 보여 주지 않는다. “전송 완료, 검사 대기”처럼 단계와 설명을 분리한다.

| 서버 상태 | 화면에서 해석할 내용 |
| --- | --- |
| RECEIVING | 저장·완료 검증이 아직 확정되지 않음 |
| QUARANTINED | 정확한 저장 버전을 확보했지만 정책 검사 전 |
| SCANNING | 검사 시도 진행 중; 재시도될 수 있음 |
| READY | 현재 사용 승인 상태; 실제 다운로드에서도 권한·기한 재검사 |
| REJECTED | 사용 승인 거절; 안전한 사유와 후속 행동 표시 |
| DELETE_PENDING / DELETED | 더 이상 신규 사용을 허용하지 않음 / 삭제 확인 |

상태 조회가 200이라는 것은 조회가 성공했다는 뜻이다. 응답 안의 작업 상태는 REJECTED일 수 있다. 반대로 GET timeout은 통신 결과가 불확실한 것이지 서버 작업이 REJECTED가 되었다는 뜻이 아니다.

READY도 영원한 끝 상태가 아니다. 이후 만료·삭제로 바뀔 수 있다. 예제 클라이언트는 “이번 검사 결과를 기다리는 화면”에서 READY·REJECTED·삭제 상태를 받으면 자동 관찰을 멈추지만, 다시 화면을 열거나 다운로드할 때는 새 조회·권한 검사가 필요하다.

### 3.2 최신성은 상태 순서나 시각이 아니라 revision으로 판단한다

`revision`은 한 자원의 외부 표시 상태가 바뀔 때 증가시키는 번호다. 예를 들어 `SCANNING/revision=8` 뒤 검사 재시도로 `QUARANTINED/revision=9`가 되면, 상태 이름은 앞 단계로 돌아가도 더 최신이다.

반대로 오래된 `SCANNING/8` 응답이 `READY/10` 뒤 도착하면 무시해야 한다. 상태별 순위 비교나 응답 도착 순서만으로는 이 둘을 구분할 수 없다. 서버 시각도 정밀도·시계 차이·동일 시각 갱신 때문에 단독 순서표로 쓰지 않는다.

다음은 기존 업로드 테이블에 합칠 **SQL 설계 예시**다. 실제 Flyway 버전·기존 행 보충·제약과 writer 코드를 함께 맞춰야 한다. 이번 작업에서 DB에 실행한 마이그레이션은 아니다.

```sql
ALTER TABLE upload_asset
    ADD COLUMN status_revision bigint NOT NULL DEFAULT 0
    CHECK (status_revision >= 0); -- 상태 스냅샷의 갱신 번호다.

-- 예: 기존의 검사 token·버전·기한 조건을 유지한 상태 전환 UPDATE에 함께 반영한다.
-- SET state = :next_state, status_revision = status_revision + 1, ...
-- WHERE id = :id AND ...기존 조건...;
```

아래 주석의 UPDATE는 실행 가능한 완성 쿼리가 아니라 **변경 지점 설명**이다. 상태·안전한 사유 코드 등 응답에 포함한 값이 바뀌면 같은 트랜잭션에서 revision도 올려야 한다. 기존 소유자·scan token·만료 조건을 지우지 않는다.

Java long과 PostgreSQL bigint는 JavaScript Number가 정확하게 표현하는 정수 범위보다 크다. 그래서 이 예제는 revision을 JSON 문자열로 보내고, 브라우저에서는 **BigInt**, 즉 큰 정수 타입으로 비교한다. BigInt를 다시 JSON.stringify할 때는 문자열로 변환해야 하며, 여기서는 서버가 보낸 원래 문자열을 유지한다.

### 3.3 상태 조회도 파일 다운로드처럼 자원별 권한을 검사한다

아래 파일들은 기존 프로젝트의 `src/main/java/com/example/upload/`에 추가하는 **파일 전체**다. 기존 `spring-boot-starter-webmvc`·`spring-boot-starter-security` 구성과 애플리케이션 클래스는 [첫 실행 노트](../01_08_25_Spring_Initializr_and_First_Run/08_25_Spring_Initializr_and_First_Run.md) 및 이전 업로드 프로젝트를 전제로 한다. 저장 위치·객체 버전·서명 URL·원본 검사 로그는 상태 DTO에 넣지 않는다.

`UploadStatus.java`:

```java
package com.example.upload;

import java.util.Objects;
import java.util.UUID;

public record UploadStatus(UUID id, State state, String revision) {
    public enum State {
        RECEIVING, QUARANTINED, SCANNING, READY, REJECTED, DELETE_PENDING, DELETED
    }

    public UploadStatus {
        Objects.requireNonNull(id);
        Objects.requireNonNull(state);
        if (revision == null || !revision.matches("0|[1-9][0-9]{0,18}")) {
            throw new IllegalArgumentException("invalid revision"); // 정규화된 정수 문자열만 허용한다.
        }
        Long.parseLong(revision); // DB bigint 범위까지 확인한다. 상태가 바뀔 때마다 같은 행에서 증가한다.
    }
}
```

`UploadStatusReader.java`는 DB 구현을 대신 제공하는 클래스가 아니라 **조회 포트 계약**이다. 구현 Bean이 있어야 실제 Controller가 실행된다.

```java
package com.example.upload;

import java.util.Optional;
import java.util.UUID;

public interface UploadStatusReader {
    Optional<UploadStatus> findVisible(UUID id, String subject);
    // 한 번의 일관된 조회로 ID·서버 인증 소유자·현재 조회 권한과 표시 정책을 확인한다.
    // 없는 자원·다른 소유자·표시 불가 자원은 empty, DB 장애는 예외로 구분한다.
}
```

`UploadStatusController.java`:

```java
package com.example.upload;

import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class UploadStatusController {
    private final UploadStatusReader reader;

    public UploadStatusController(UploadStatusReader reader) {
        this.reader = reader; // DB의 현재 스냅샷을 읽는 어댑터를 주입한다.
    }

    @GetMapping("/uploads/{id}/status")
    public ResponseEntity<UploadStatus> status(
            @PathVariable("id") UUID id, Authentication authentication) {
        String subject = requireSubject(authentication); // 요청의 userId를 신뢰하지 않는다.
        UploadStatus body = reader.findVisible(id, subject)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
        // 읽기 전용 GET이다. 조회할 때 검사 재시작·READY 갱신 같은 효과를 만들지 않는다.
    }

    static String requireSubject(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return authentication.getName(); // 실제 서비스의 안정적·유일한 사용자 키와 연결해야 한다.
    }
}
```

메서드 안의 방어적 검사만으로 SecurityFilterChain이 완성되는 것은 아니다. 기존 인증·API용 401/403 처리와 경로 권한을 연결한다. GET에도 소유자 검사를 하며, 다른 사용자의 UUID를 알아도 상태를 읽을 수 없어야 한다. 상태가 DELETED여도 소유자에게 최소 이력을 보여 줄지, 404로 숨길지는 별도 정책이다. [Spring 요청 권한 검사](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)

`Cache-Control: no-store`는 사용자별 상태 응답을 캐시하지 않도록 요청한다. 이것이 브라우저 메모리나 이미 본 정보를 원격 삭제하는 기능은 아니다. 상태 DTO의 READY를 다운로드 권한 증표로 재사용하지 않는다.

### 3.4 폴링은 앞선 요청이 끝난 뒤 다시 조회한다

**폴링**은 일정 간격으로 현재 상태를 다시 요청하는 방식이다. 2초 간격 setInterval 안에서 fetch를 호출하면 한 요청이 5초 걸리는 동안 다음 요청들이 겹칠 수 있다. 이번 코드는 `fetch → 반영 → 대기 → 다음 fetch` 순서로 실행한다.

다음 `upload-status-client.ts`는 **브라우저 프로젝트에 추가하는 도우미 전체**다. 화면 렌더링·버튼·로그인 UI는 호출 계층이 연결한다. 응답은 TypeScript 타입 단언만 하지 않고 실제 JSON 값을 검사한다.

```typescript
const states = [
  "RECEIVING", "QUARANTINED", "SCANNING", "READY", "REJECTED", "DELETE_PENDING", "DELETED",
] as const;
export type Snapshot = { id: string; state: typeof states[number]; revision: string };
const maxRevision = 9223372036854775807n; // Java long·DB bigint의 양수 범위다.

export function parseSnapshot(raw: unknown, expectedId: string): Snapshot {
  if (!raw || typeof raw !== "object") throw new Error("상태 응답 형식 오류");
  const value = raw as Record<string, unknown>; // 아래에서 각 필드를 실제로 검사한다.
  if (value.id !== expectedId || typeof value.state !== "string"
      || !(states as readonly string[]).includes(value.state)
      || typeof value.revision !== "string" || !/^(0|[1-9][0-9]{0,18})$/.test(value.revision)
      || value.revision.trim() !== value.revision
      || BigInt(value.revision) > maxRevision) {
    throw new Error("작업 ID·상태·revision을 확인하세요.");
  }
  return { id: expectedId, state: value.state as Snapshot["state"], revision: value.revision };
}

export class SnapshotGate {
  private latest = -1n; // 아직 받은 상태가 없다. 자원 ID마다 새 gate를 만든다.
  private readonly id: string;
  constructor(id: string) { this.id = id; }
  accept(value: Snapshot): boolean {
    if (value.id !== this.id) throw new Error("다른 작업의 상태입니다.");
    const revision = BigInt(value.revision);
    if (revision <= this.latest) return false; // 중복·늦은 응답을 무시한다.
    this.latest = revision;
    return true;
  }
}

export function observationDone(value: Snapshot): boolean {
  return ["READY", "REJECTED", "DELETE_PENDING", "DELETED"].includes(value.state);
  // 이번 결과 대기 화면의 관찰 종료 조건이며 영원히 바뀌지 않는 상태라는 뜻은 아니다.
}

export function pause(signal: AbortSignal, ms = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(new DOMException("관찰 중지", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel); // 정상 대기 후에도 이벤트 리스너를 정리한다.
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel(); // 리스너 등록 직전의 취소도 놓치지 않는다.
  });
}

export function startPolling(
  id: string, render: (value: Snapshot) => void, onError: (error: unknown) => void,
  transport: typeof fetch = fetch, wait: (signal: AbortSignal) => Promise<void> = pause,
): { stop: () => void; finished: Promise<void> } {
  const controller = new AbortController(); // 이 화면의 관찰 수명이다.
  const gate = new SnapshotGate(id);
  const finished = (async () => {
    try {
      while (!controller.signal.aborted) {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]);
        const response = await transport("/uploads/" + encodeURIComponent(id) + "/status", {
          credentials: "same-origin", cache: "no-store", redirect: "error",
          headers: { Accept: "application/json" }, signal, // 개별 요청은 최대 10초 대기한다.
        });
        if (!response.ok) throw new Error("상태 조회 실패: HTTP " + response.status);
        const value = parseSnapshot(await response.json(), id);
        if (controller.signal.aborted) break; // 취소 뒤 늦게 끝난 응답을 화면에 반영하지 않는다.
        if (gate.accept(value)) {
          render(value);
          if (observationDone(value)) break; // 무시한 과거 완료 상태 때문에 관찰을 종료하지 않는다.
        }
        await wait(controller.signal); // 요청 완료 후 대기하므로 다음 요청과 겹치지 않는다.
      }
    } catch (error) {
      if (!controller.signal.aborted) onError(error); // 통신 문제를 서버의 REJECTED로 바꾸지 않는다.
    } finally {
      controller.abort(); // 이 관찰에서 남은 취소 가능 작업을 정리한다.
    }
  })();
  return { stop: () => controller.abort(), finished }; // stop은 서버 업무 취소 API가 아니다.
}

export function watchSse(
  id: string, render: (value: Snapshot) => void, onUnavailable: () => void,
  factory: (url: string) => EventSource = url => new EventSource(url),
): () => void {
  const gate = new SnapshotGate(id);
  const source = factory("/uploads/" + encodeURIComponent(id) + "/events");
  let closed = false;
  let errors = 0; // 이번 관찰 수명 전체의 오류 횟수다. 연결 성공마다 0으로 돌리지 않는다.
  const stop = () => {
    if (closed) return;
    closed = true;
    clearTimeout(deadline);
    source.close(); // 브라우저의 자동 재연결도 함께 중지한다.
  };
  const unavailable = () => {
    if (closed) return;
    stop();
    onUnavailable(); // 호출자는 권한 있는 GET이나 사용자 재시도 UI로 전환한다.
  };
  const deadline = setTimeout(unavailable, 120000); // 예제 관찰은 최대 2분이다.
  source.addEventListener("snapshot", event => {
    if (closed) return;
    try {
      const value = parseSnapshot(JSON.parse((event as MessageEvent<string>).data), id);
      if (gate.accept(value)) {
        render(value);
        if (observationDone(value)) stop(); // 최신으로 수락한 완료 상태일 때만 닫는다.
      }
    } catch {
      unavailable(); // 깨진 데이터·ID 불일치도 정상 상태처럼 표시하지 않는다.
    }
  });
  source.onerror = () => {
    errors += 1;
    if (errors >= 3 || source.readyState === 2) unavailable();
    // 그 전에는 EventSource의 기본 재연결을 사용한다. 별도 재연결 타이머를 또 만들지 않는다.
  };
  return stop; // 화면 종료·작업 ID 변경 시 반드시 호출한다.
}
```

polling의 `finished`는 관찰 루프 종료를 기다릴 Promise다. 오류가 나면 이 기본 예제는 자동 재시도하지 않고 onError로 알린다. 운영에서 429·503·네트워크 오류를 재시도할 때는 횟수·전체 대기 기한·backoff·jitter를 제한하고, 401·403을 같은 방식으로 무한 재시도하지 않는다.

SSE 함수도 같은 parser·revision 규칙을 사용한다. 둘을 동시에 돌리지 않고 한 화면에서 어느 방식이 관찰을 담당하는지 정한다. 방식을 전환할 때 이전 관찰을 먼저 닫고 새 관찰의 GET/초기 스냅샷으로 시작한다. UI 콜백은 HTML 문자열 삽입 대신 상태 값에 대응하는 텍스트·배지를 렌더링한다.

각 도우미는 관찰을 새로 시작할 때 gate를 새로 만든다. 이 예제의 현재 상태 조회는 주 DB의 commit된 값을 읽는 것을 전제로 한다. 지연 복제본에서 같은 작업을 계속 관찰하며 방식을 전환하려면 이전에 본 revision을 넘겨 공유하거나 최소 revision 이상으로 재동기화하는 확장이 필요하다. 관찰 수명을 넘는 최신성 보장을 이 코드가 자동 제공하지는 않는다.

### 3.5 SSE는 서버에서 브라우저로 이어지는 단방향 HTTP 스트림이다

**SSE(Server-Sent Events)**는 서버가 열린 HTTP 응답에 이벤트를 계속 보내는 방식이다. 브라우저의 EventSource가 수신·이벤트 구분·기본 재연결을 담당한다. 브라우저에서 서버로 명령을 보내는 양방향 채널은 아니므로 작업 취소·재시작은 별도 인증된 API로 요청한다.

아래는 wire 형식을 설명하는 예시다. 실제 전송은 UTF-8이며 이벤트 마지막에 빈 줄이 있어야 한 이벤트가 끝난다.

```text
event: snapshot
data: {"id":"00000000-0000-0000-0000-000000000050","state":"SCANNING","revision":"8"}

: heartbeat

event: snapshot
data: {"id":"00000000-0000-0000-0000-000000000050","state":"READY","revision":"10"}

```

`event: snapshot`은 이벤트 이름이며, `data:`는 이번 예제의 전체 상태 JSON이다. `: heartbeat`는 주석이라 화면 이벤트로 전달되지 않지만 연결이 살아 있는지 드러내는 쓰기가 될 수 있다. 변경 없는 상태도 재전송할 수 있으므로 클라이언트는 revision으로 중복을 제거한다. [WHATWG SSE 형식](https://html.spec.whatwg.org/multipage/server-sent-events.html)

예제는 `id:`를 붙이지 않는다. EventSource가 Last-Event-ID를 보내는 것만으로 서버의 영속 재생 기능이 생기지 않기 때문이다. 재연결 때 항상 현재 스냅샷을 다시 읽어 보내며, 중간 상태가 생략되어도 현재 화면을 복원할 수 있게 한다. 모든 전이의 감사 기록이 필요하다면 별도 이벤트 저장·보존·순서·재생 계약이 필요하다.


### 3.6 SseEmitter는 HTTP 연결, 구독 브리지는 상태 전달 책임을 맡는다

Spring MVC의 `SseEmitter`는 여러 이벤트를 한 HTTP 응답에 쓰는 도구다. 생성자가 받는 timeout은 밀리초이며, `send`가 파일 검사나 DB commit을 대신하지는 않는다. 현재 기준 버전과 API를 확인했다. [SseEmitter API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.html), [Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)

다음 `SnapshotSubscriptions.java`는 **브리지의 계약**이다. 로컬 이벤트 목록이나 Redis 구독을 구현한 코드가 아니므로 이 인터페이스만으로 SSE 서비스가 완성되지는 않는다.

```java
package com.example.upload;

import java.util.UUID;
import java.util.function.Consumer;

public interface SnapshotSubscriptions {
    AutoCloseable open(UUID id, String subject,
                       Consumer<UploadStatus> onSnapshot, Runnable accessEnded);
    // 계약 1: 사용자별/서버별 연결 수·대기열을 제한하고 초과 요청은 등록 전에 거절한다.
    // 계약 2: 변경 관찰을 먼저 등록한 뒤 DB 현재 상태를 다시 읽어 초기 스냅샷을 보낸다.
    // 계약 3: commit된 값만 보내고, 전송 전 소유자·계정·현재 조회 권한을 확인한다.
    // 계약 4: 같은 구독의 콜백은 직렬 실행한다. 느린 소비자는 최신 값만 남기거나 연결을 종료한다.
    // 계약 5: 권한 종료는 accessEnded, 반환 handle.close()는 예약·리스너·큐를 정리한다.
    // open이 실패하면 반환하지 못한 내부 등록도 브리지 스스로 정리해야 한다.
    // 세션의 즉시 로그아웃 반영은 별도 세션/인가 수명 정책과 연결해야 한다.
}
```

`UploadEventsController.java`는 **브리지 어댑터 파일 전체**다. 앞의 Reader·브리지 구현 Bean·기존 MVC/Security 설정이 있어야 실제 서버에서 동작한다. 25초는 설명용 연결 수명이며 보편적인 SSE timeout 권장값이 아니다.

```java
package com.example.upload;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class UploadEventsController {
    private static final Logger log = LoggerFactory.getLogger(UploadEventsController.class);
    private final UploadStatusReader reader;
    private final SnapshotSubscriptions subscriptions;

    public UploadEventsController(UploadStatusReader reader, SnapshotSubscriptions subscriptions) {
        this.reader = reader;
        this.subscriptions = subscriptions;
    }

    @GetMapping(value = "/uploads/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> events(
            @PathVariable("id") UUID id, Authentication authentication) {
        String subject = UploadStatusController.requireSubject(authentication);
        reader.findVisible(id, subject)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // HTTP 응답을 열기 전에도 조회 권한을 검사한다. 초기 값 전달은 브리지에서 다시 읽는다.

        SseEmitter emitter = new SseEmitter(25_000L);
        AtomicBoolean closed = new AtomicBoolean();
        AtomicReference<AutoCloseable> handle = new AtomicReference<>();
        Runnable cleanup = () -> {
            closed.set(true); // 이후의 늦은 콜백을 더 보내지 않는다.
            AutoCloseable registered = handle.getAndSet(null); // 여러 종료 경로에서도 한 번만 닫는다.
            if (registered != null) {
                try {
                    registered.close(); // 상태 관찰·타이머·대기 항목을 정리한다.
                } catch (Exception failure) {
                    log.warn("status subscription cleanup failed"); // URL·원문·세션 값은 남기지 않는다.
                }
            }
        };
        emitter.onCompletion(cleanup);
        emitter.onTimeout(() -> {
            cleanup.run();
            emitter.complete(); // 애플리케이션이 정한 수명 종료다.
        });
        emitter.onError(ignored -> cleanup.run());

        try {
            AutoCloseable registered = subscriptions.open(id, subject, snapshot -> {
                if (closed.get()) return;
                if (!id.equals(snapshot.id())) {
                    cleanup.run();
                    emitter.completeWithError(new IllegalStateException("snapshot ID mismatch"));
                    return; // 다른 자원의 정보를 보내지 않는다.
                }
                try {
                    emitter.send(SseEmitter.event().name("snapshot")
                            .data(snapshot, MediaType.APPLICATION_JSON)); // 전체 현재 상태를 보낸다.
                } catch (IOException disconnected) {
                    cleanup.run(); // 컨테이너가 오류 완료를 진행한다. completeWithError를 또 호출하지 않는다.
                } catch (RuntimeException failure) {
                    cleanup.run();
                    emitter.completeWithError(failure); // 변환 실패 등은 정상 이벤트로 위장하지 않는다.
                }
            }, () -> {
                if (closed.get()) return;
                cleanup.run();
                emitter.complete(); // 클라이언트는 재조회/재연결에서 현재 권한을 다시 확인한다.
            });
            handle.set(registered); // open 안에서 초기 콜백이 즉시 실행될 수도 있다.
            if (closed.get()) cleanup.run(); // 등록 완료 전 종료된 경합에서도 handle을 빠뜨리지 않는다.
        } catch (RuntimeException registrationFailure) {
            cleanup.run();
            throw registrationFailure; // 등록·할당량 실패를 정상 구독으로 반환하지 않는다.
        }
        return ResponseEntity.ok().contentType(MediaType.TEXT_EVENT_STREAM)
                .cacheControl(CacheControl.noStore()).body(emitter);
    }
}
```

`send`의 IOException은 클라이언트 연결 종료에서 발생할 수 있다. 공식 문서는 이 경우 앱이 `complete`·`completeWithError`를 다시 호출하지 않아도 컨테이너가 오류 완료를 진행한다고 설명한다. 다만 애플리케이션의 DB 관찰·예약·메모리 구독은 스스로 해제해야 한다. [MVC emitter 오류 처리](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html)

구독 해제는 이벤트와 경쟁할 수 있어 이미 시작한 send까지 원격 취소하는 보장은 아니다. 브리지 구현은 전송 직전 권한 확인과 콜백 직렬화, 연결 정리·오류 관찰을 함께 제공해야 한다. 이 코드가 브리지의 다중 서버 전달·세션 폐기·큐 한도까지 구현했다고 해석하지 않는다.

### 3.7 최초 연결 권한과 연결 이후의 권한은 다르다

기본 EventSource 생성자에는 임의 Authorization 헤더를 지정하는 옵션이 없다. 이번 예제는 같은 출처의 기존 세션 쿠키를 사용하는 구조다. 토큰을 URL 쿼리에 넣어 로그·분석·브라우저 기록에 남기는 방식으로 우회하지 않는다. Bearer 전용 환경은 별도 fetch 스트리밍 클라이언트나 다른 인증 계약을 검토해야 한다. [EventSource 인터페이스](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)

처음 연결 때 세션이 유효했다고 해서 로그아웃·계정 정지·소유권 변경이 스트림에 자동 반영되는 것은 아니다. 브리지의 현재 권한 검사, 세션 무효화 시 구독 종료, 짧은 연결 수명과 재인증 같은 정책을 결합한다. subject 문자열만 보관하면 세션 만료가 저절로 검사된다고 주장하지 않는다.

SSE의 GET에는 업무 변경 효과를 넣지 않는다. 작업 취소는 별도의 POST/DELETE API에서 인가·CSRF 정책을 적용한다. 연결이 닫혀도 서버 검사를 계속할지와 작업을 취소할지는 업무 정책이며, 화면 구독 종료만으로 작업을 삭제하지 않는다.

SseEmitter의 마지막 완료·오류는 ASYNC dispatch로 이어질 수 있다. 기존 SecurityFilterChain에서 해당 dispatch를 처리하는 방식을 통합 시험해야 하며, 문제를 피하려고 모든 자원의 조회를 permitAll로 바꾸지 않는다. [요청·dispatch 권한](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)

### 3.8 재연결과 초기 조회 사이의 빈틈을 막기

최초 상태를 읽고 나서 변경 구독을 등록하면, 그 사이 commit된 변경 알림을 놓칠 수 있다. 브리지 계약이 “구독 등록 → 현재 스냅샷 재조회”인 이유다. 먼저 도착한 새 이벤트 뒤 재조회한 오래된 값이 전달되는 경우도 클라이언트 revision gate가 막는다.

이벤트 발행이 DB commit보다 먼저 일어나면 롤백된 상태를 화면에 보낼 수 있다. commit 이후 신호를 보내고, 프로세스 종료로 신호가 사라져도 DB 재조회·주기적 대조로 현재 값을 다시 전달한다. 메모리 알림 한 번을 영속 작업 큐라고 부르지 않는다.

서버가 여러 대이면 한 인스턴스의 로컬 구독 목록에는 다른 인스턴스에서 발생한 commit이 자동으로 들어오지 않는다. 공유 알림 채널이나 DB 재조회가 필요하다. 이번 최신 스냅샷 모델에서는 알림이 누락돼도 주기적 재조회·재연결로 복원하지만, 모든 전이를 한 번씩 전달한다고 보장하지 않는다.

⚠️ 주의: SseEmitter에 `id("10")`을 붙이고 Last-Event-ID를 받는 것만으로 유실 없는 재생이 구현되지는 않는다. 영속 이벤트 이력·조회 권한·커서 보존 기한·중복 제거·누락 시 재동기화가 별도로 있어야 한다. 이번 클라이언트는 스냅샷 복원 모델이므로 id 기반 재생을 사용하지 않는다.

### 3.9 실제 프록시·느린 소비자·재연결 폭주도 고려하기

SSE를 시작했다고 중간 프록시가 즉시 데이터를 전달하는 것은 아니다. 응답 buffering·압축·idle timeout·최대 연결 수를 실제 경로에서 확인한다. 서비스 정책에 맞게 주석 heartbeat를 보내되, heartbeat 수신은 업무가 진행되었다는 증거가 아니다.

연결마다 스레드 하나·무한 큐 하나를 두면 느린 클라이언트가 자원을 오래 붙잡을 수 있다. 브리지에는 사용자별/전체 연결 수, 작은 대기 한도, write 지연 처리, 구독 해제와 서버 종료 정리가 필요하다. 최신 스냅샷만 필요하면 중간 값들을 합쳐 최신 하나만 남기는 방식이 가능하지만, 감사 이벤트 큐에 같은 전략을 무조건 적용하지 않는다.

브라우저 기본 재연결과 앱의 재연결 타이머를 동시에 실행하지 않는다. 예제는 EventSource 재연결을 이용하되 오류 횟수·관찰 총시간을 제한하고, 종료 후 권한 있는 GET이나 사용자 재시도로 전환한다. 204 응답은 EventSource의 재연결 중단에 사용할 수 있지만, 이미 열린 스트림에 나중에 204를 끼워 넣을 수는 없다. [SSE 연결·재연결 규칙](https://html.spec.whatwg.org/multipage/server-sent-events.html)

### 3.10 실행 검사와 실제 서버에서의 검증을 구분하기

[check_status_client.mjs](./check_status_client.mjs)는 이 노트의 TypeScript 블록을 Node.js에서 타입 제거 후 실행하는 회귀 검사다. Node.js 24 이상, 저장소 루트에서 실행한다.

```powershell
# 네트워크 없이 parser·revision·폴링 취소·SSE 대역의 자원 정리를 검사한다.
node SpringBoot/50_11_03_Async_Status_Polling_and_SSE/check_status_client.mjs
```

Node.js 24.18.0에서 **12개 검사 통과**를 확인했다. 큰 revision·응답 형식, 중복/순서 역전, 재시도 상태, 순차 폴링, 인증 오류, 취소 후 늦은 응답, SSE 대역의 과거 완료 상태·오류 한도·중복 정리·타이머 취소를 확인했다. 타입 제거 API의 실험적 경고가 출력될 수 있다.

이는 TypeScript 정적 타입 검사도 실제 브라우저 EventSource 시험도 아니다. Java 21 예제 프로젝트를 준비하면 앞의 Java 파일과 조회/구독 어댑터를 연결한 뒤 다음 시험을 추가한다.

| 시험 범위 | 확인할 결과 |
| --- | --- |
| 상태 DTO·reader | 같은 revision의 필드 일관성, 다른 소유자 거절, DB 장애를 404로 숨기지 않음 |
| MockMvc GET·Security | 인증 없음·타인 ID·정상 상태, 200 + REJECTED와 HTTP 오류 구분 |
| MockMvc async | asyncStarted·초기 이벤트·완료/오류 dispatch와 권한 |
| 실제 HTTP·브라우저 | UTF-8·이벤트 빈 줄·초기 스냅샷·연결 종료·native 재연결 |
| 상태 변경 경쟁 | 최신 SCANNING 뒤 과거 READY가 도착해도 렌더링·관찰 종료를 하지 않음 |
| 로그아웃·권한 변경 | 기존 연결의 종료 정책과 재연결의 거절, 민감 필드 미전달 |
| 두 서버·프로세스 종료 | 다른 서버 commit 전달·놓친 신호 뒤 현재 상태 재동기화 |
| 느린 클라이언트·탭 반복 진입 | 대기열·연결 한도·구독/타이머 정리, 서버 종료 때 해제 |

MockMvc 비동기 시험에는 await할 완료 조건과 asyncDispatch가 필요할 수 있다. 무기한 SSE 전체 본문을 “요청이 끝날 때까지” 기다리는 테스트와, 초기/후속 이벤트·완료를 제어하는 테스트는 다르다. [Spring 비동기 요청 테스트](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/async-requests.html)

이번 실제 수행 결과는 Node 클라이언트 회귀 검사와 저장소 문서·공백 검사, 문서 점검 도구의 회귀 테스트다. PATH에서 Java·javac·Maven·Gradle을 찾지 못해 Java 컴파일·JUnit·실제 MVC/Security 실행은 하지 않았다. DB 어댑터·SSE 브리지·브라우저·프록시·다중 서버·권한 폐기 시험도 미실행 범위다.

## 4. 적용 관점에서 다시 보기

먼저 현재 상태를 안전하게 읽는 GET과 revision을 만들고, 순차 폴링으로 화면의 대기·오류·종료를 연결한다. 더 짧은 갱신 지연이 필요할 때 같은 스냅샷 계약을 SSE로 전달하면 클라이언트의 최신성 판단을 재사용할 수 있다.

장애 진단은 서버 작업·상태 조회·알림 전달·화면 반영을 나누어 진행한다. 작업이 끝났는데 화면이 멈췄다면 DB 상태와 GET부터 확인하고, 이어서 구독 누락·권한·프록시·중복 관찰을 살핀다. 통신 오류를 업무 실패로 덮어쓰지 않는다.

운영 설계에서는 재연결·구독 정리·권한 변경·느린 소비자까지 관찰 수명의 일부로 취급한다. 단순 스냅샷 복원과 모든 이벤트의 영속 재생 중 무엇이 필요한지도 먼저 정한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

비동기 작업 결과의 정답은 연결 상태가 아니라 권한을 확인해 읽은 현재 업무 상태다. revision은 지연·중복 응답을 정리하고, 폴링/SSE 연결은 그 상태를 가져오는 서로 다른 수단이다.

### 5.2 이전·다음 학습과의 연결

[업로드 실패 주입](../49_11_02_Upload_Integration_Testing_and_Consistency/11_02_Upload_Integration_Testing_and_Consistency.md)에서 구분한 서버 효과·응답 유실을 화면의 상태 관찰에 연결했다. 다음 [SSE 이벤트 이력·재생과 재동기화](../51_11_08_SSE_Event_Replay_and_Resynchronization/11_08_SSE_Event_Replay_and_Resynchronization.md)에서는 현재 스냅샷만으로 부족한 경우의 영속 커서·보존 경계·누락 복구를 다룬다.

### 5.3 더 파볼 만한 주제

사용자가 여러 작업을 한 화면에서 보는 경우의 연결 다중화, 폴링의 조건부 GET·ETag 최적화, 접근성 있는 상태 알림을 확장할 수 있다. WebSocket이 필요한 양방향 명령/상호작용과 SSE·일반 HTTP로 충분한 흐름도 비교해 볼 만하다.

### 5.4 참고 자료

- [Spring MVC 비동기·SSE](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html), [SseEmitter API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.html) — 이벤트 전송·timeout·오류 종료의 역할.
- [WHATWG Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) — EventSource 생성자·형식·재연결·Last-Event-ID·204.
- [Spring Security 요청 권한](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html) — 경로·dispatch 권한과 인증 구성.
- [Spring 비동기 테스트](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/async-requests.html), [Boot 관리 버전](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html) — 실제 MVC 시험과 기준 조합.
- [클라이언트 회귀 검사](./check_status_client.mjs) — 문서의 도우미 코드를 대역으로 실행하는 검사.

## 6. 요약 정리

- 파일 전송 완료·검사 완료·조회 실패를 구분한다.
- 상태 GET과 SSE 연결에도 인증·자원별 조회 권한이 필요하다.
- 응답에 포함한 값과 revision을 같은 DB 트랜잭션으로 갱신한다.
- 더 큰 revision만 반영하고, 과거 완료 응답 때문에 관찰을 멈추지 않는다.
- 폴링은 앞 요청이 끝난 뒤 대기하여 중첩을 방지한다.
- SSE 재연결은 최신 상태 재조회와 결합하며 영속 재생을 자동 보장하지 않는다.
- 화면 종료는 관찰 정리이며 서버 업무 취소와 다르다.
- 연결 이후의 권한·세션 변경과 느린 소비자·다중 서버를 별도로 설계한다.

🧠 기억할 것: **연결은 끊겨도 상태는 조회할 수 있어야 하며, 늦게 온 정보가 최신이라는 보장은 없다.**

## 7. 미니 퀴즈 또는 체크리스트

1. HTTP 200 응답 안에 REJECTED 상태가 들어 있을 수 있는 이유는?
2. SCANNING/revision 9 뒤 READY/revision 8이 도착하면 무엇을 해야 하는가?
3. setInterval로 fetch를 시작하는 방식보다 완료 후 대기하는 폴링이 안전한 이유는?
4. EventSource 재연결과 Last-Event-ID만으로 과거 이벤트가 모두 재생되는가?
5. SSE 연결·폴링을 멈추면 서버 파일 검사도 취소되는가?

<details>
<summary>정답과 해설</summary>

1. HTTP 상태는 조회 요청의 성공 여부이고, REJECTED는 조회된 업무 작업의 결과이기 때문이다.
2. revision 8은 오래된 값이므로 렌더링뿐 아니라 관찰 종료 판단에서도 무시한다. 상태 이름의 순위로 비교하지 않는다.
3. 앞선 응답이 지연돼도 같은 화면의 요청이 계속 겹치지 않는다. 그래도 취소·개별 timeout·서버 부하는 따로 관리한다.
4. 아니다. 서버의 이벤트 이력·권한·보존·cursor 처리와 누락 복구가 필요하다. 이번 예제는 최신 스냅샷을 다시 보내는 모델이다.
5. 아니다. 화면의 요청·타이머·구독만 정리한다. 업무 취소는 별도 권한·CSRF 검사를 적용한 API로 요청한다.

</details>
