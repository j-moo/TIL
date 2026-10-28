# 파일 업로드 상태 관리·격리 검사와 만료 정리

- 🎯 글의 목표: 업로드 접수와 공개 승인을 구분하고, 검사 중 장애·중복 실행·만료가 발생해도 검증하지 않은 파일을 제공하지 않는 흐름을 설명한다.
- 🧩 핵심 키워드: 상태 머신, 격리 저장, 불변 객체 버전, 검사 결과, lease, 조건부 UPDATE, 재시도, 논리적 만료, 물리적 삭제, 정합성 복구
- ⭐ 중요도: 높음. 파일을 받는 코드만으로는 검사 누락·늦은 결과·저장 공간 누적을 막을 수 없으며, 다운로드 권한까지 하나의 수명주기로 연결해야 한다.
- 📝 한눈에 보는 내용: 접수 이력 → 비공개 저장 → 검사 작업 선점 → 결과 확정 → 권한 있는 다운로드 → 만료 차단 → 삭제와 복구
- 🔗 관련 주제: [업로드 요청과 입력 검증](../45_10_26_File_Upload_Multipart_and_Validation/10_26_File_Upload_Multipart_and_Validation.md), [조건부 UPDATE](../23_09_21_Pessimistic_Locking_and_Atomic_Update/09_21_Pessimistic_Locking_and_Atomic_Update.md), [Transactional Outbox](../25_09_23_Transactional_Outbox_and_Event_Publishing/09_23_Transactional_Outbox_and_Event_Publishing.md), [다운로드 접근 제어](../43_10_23_File_Download_Streaming_and_Access_Control/10_23_File_Download_Streaming_and_Access_Control.md)
- 🧱 선수 지식: multipart·DTO 검증, 인증과 인가, SQL의 WHERE·UPDATE·트랜잭션, Java record·enum·예외, 객체 스토리지의 key와 versionId

> 기준일: 2026-10-28. Java 21, 기존 Spring Boot 4.1.2·Spring Framework 7.0.10 프로젝트와 PostgreSQL 17의 Read Committed를 기준으로 설명한다. 저장소는 버전 관리가 활성화된 비공개 일반 목적 S3 버킷을 가정한다. SQL은 저장 어댑터에 넣는 예시이며 Java 파일은 판단 규칙과 단위 테스트다. 전체 서비스·검사 엔진·S3 어댑터를 구현한 실행 프로젝트가 아니다. PATH에서 Java 8 실행 환경만 확인되었고 javac·Maven·Gradle·psql을 찾지 못했다. Java/JUnit·SQL·실제 S3 호출은 실행하지 않았으며 검증 범위는 3.12에서 구분한다.

## 1. 들어가며

텍스트 파일 업로드에 성공한 직후 서버가 종료되었다고 생각해 보자. 파일은 저장되었는데 검사 예약은 메모리에만 있었을 수 있다. 재시작한 서버가 파일의 존재만 보고 다운로드를 허용하면 검사를 건너뛰고, 반대로 아무 기록도 찾지 못하면 파일이 저장 공간에 계속 남는다.

이전 노트는 요청 형식과 실제 바이트를 검증하고 `QUARANTINED`라는 비공개 접수 상태를 반환했다. 이번에는 그 뒤의 질문인 **“어떤 파일을 누가 검사했고, 언제까지 제공하며, 중간에 멈추면 어디서 다시 시작하는가?”**를 다룬다.

예제는 이전과 같은 최대 64KiB의 UTF-8 텍스트 문서다. 내용을 실행하거나 HTML로 렌더링하지 않으며, 검사 정책이 허용한 문서만 소유자에게 다운로드시킨다. 공개 승인은 인터넷 전체에 공개한다는 뜻이 아니라, 애플리케이션의 권한 검사를 통과한 요청에 제공할 수 있다는 뜻이다.

## 2. 핵심 개념 정리

```text
RECEIVING: 저장 의도 기록
    ↓ 비공개 저장과 바이트 대조 완료
QUARANTINED: 검사 대기
    ↓ 작업 선점
SCANNING: 제한 시간 동안 검사
    ├─ 정책 통과 → READY: 권한 있는 다운로드 가능
    ├─ 정책 거절 → REJECTED: 다운로드 불가
    └─ 일시 장애 → QUARANTINED: 제한된 재시도

각 상태에서 만료/삭제 조건 충족
    → DELETE_PENDING: 신규 다운로드·승인 차단
    → 저장소의 대상 버전 삭제 확인
    → DELETED: 삭제 완료 이력
```

이 상태들은 Spring이나 S3가 자동으로 제공하는 표준 상태가 아니라 이번 예제의 업무 규칙이다. `SCANNING`은 작업자의 실행 여부를 영원히 보증하지 않으므로, 담당 작업의 유효 기간과 결과를 확정할 조건이 함께 필요하다.

| 경계 | 핵심 질문 |
| --- | --- |
| 접수와 저장 | DB 이력과 실제 파일 중 어느 쪽까지 성공했는가? |
| 저장과 검사 | 파일이 존재하는 것과 정책을 통과한 것을 구분하는가? |
| 검사와 승인 | 현재 담당자가 검사한 정확한 버전의 결과인가? |
| 승인과 제공 | READY뿐 아니라 소유자와 만료도 확인하는가? |
| 만료와 삭제 | 사용은 막았지만 바이트가 아직 남아 있는가? |

## 3. 본문 정리

### 3.1 상태는 화면 문구가 아니라 허용할 행동의 경계다

**상태 머신**은 현재 상태와 발생한 사건에 따라 다음 상태와 허용 행동을 정하는 모델이다. 쉽게 말해 `uploaded = true` 하나로 모든 단계를 표현하지 않고, “받는 중”, “검사 대기”, “사용 가능”을 나누는 것이다.

| 상태 | 의미 | 다음 행동 |
| --- | --- | --- |
| RECEIVING | 저장할 의도와 소유자는 기록했지만 저장 완료는 미확정 | 저장 결과 대조 또는 미완료 정리 |
| QUARANTINED | 정확한 저장 버전이 확인되었지만 승인 전 | 검사 작업 선점 |
| SCANNING | 유효한 담당 작업이 검사하는 중 | 결과 확정 또는 담당 기간 만료 복구 |
| READY | 정해진 검사 정책을 통과 | 권한·만료 확인 후 다운로드 |
| REJECTED | 정책 거절 또는 검사 완료 불가로 승인하지 않음 | 사유 조회와 삭제 예약 |
| DELETE_PENDING | 더 이상 사용하지 않도록 차단했고 삭제를 기다림 | 저장소 삭제 재시도·대조 |
| DELETED | 이 업로드에 속한 삭제 대상의 제거를 확인함 | 최소한의 감사 이력 보존 |

예를 들어 검사 서비스가 응답하지 않았다는 이유만으로 “악성 파일”이라고 기록해서는 안 된다. 이 예제의 `REJECTED`는 사용 승인 거절이라는 넓은 상태이고, `POLICY_BLOCKED`와 `INSPECTION_UNAVAILABLE`이라는 사유 코드로 내용 위반과 검사 불가를 구별한다.

**불변 조건**은 어느 단계에서도 깨지면 안 되는 규칙이다. 여기서는 ① 소유자는 서버 인증 결과로 정한다, ② 검사·다운로드는 같은 고정 버전을 사용한다, ③ READY이면서 만료 전인 파일만 제공한다, ④ 삭제 단계에서 READY로 되돌아가지 않는다. 재업로드는 삭제한 행을 재활용하지 않고 새 ID로 접수한다.

### 3.2 격리는 폴더 이름이 아니라 실제 접근 제한이다

**격리 저장**은 승인 전 파일이 일반 사용자·웹 서버·후속 업무 처리기에 노출되지 않도록 보관하는 방식이다. `quarantine/`이라는 이름을 붙여도 버킷이 공개되어 있거나 정적 파일 경로로 연결되어 있으면 격리가 아니다.

이번 예제는 비공개 저장 객체를 그대로 유지하고, DB 상태로 애플리케이션의 제공 여부만 바꾼다. READY로 바뀌어도 버킷의 공개 접근 권한을 켜지 않는다. 검사자는 대상 버전을 읽고, 다운로드 서버는 DB 승인 후 대상 버전을 읽으며, 정리 작업자는 지정한 버전을 삭제하는 식으로 역할을 나눈다.

검사는 파일 형식 파서·업무 규칙·필요한 악성 코드 검사 등 여러 판단으로 구성될 수 있다. 검사 엔진에도 CPU·메모리·읽기 크기·실행 시간·네트워크 접근 제한을 두고, 장애나 알 수 없는 결과에서는 제공을 허용하지 않는다. 외부 공개 검사 서비스에 원문을 보내면 데이터 유출이 될 수 있으므로 별도 검토가 필요하다. [OWASP 파일 저장·내용 검사 원칙](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html#file-content-validation)

⚠️ 주의: 악성 코드 검사에서 탐지되지 않았다는 결과는 절대적 안전의 증명이 아니다. 허용 형식·내용 처리 방식·권한·브라우저 출력 정책은 계속 필요하다. 원본을 재인코딩하거나 내용을 변환했다면 그것은 새로운 바이트이므로, 원본에 대한 검사 결과를 그대로 복사해 승인하지 않는다.

### 3.3 복구할 수 있으려면 파일을 쓰기 전에 저장 의도를 남긴다

DB와 S3는 서로 다른 시스템이다. DB의 `@Transactional` 안에서 S3를 호출해도 S3 PUT이 DB rollback에 맞춰 자동 취소되지는 않는다. 따라서 **짧은 DB 트랜잭션 → 외부 저장 → 짧은 DB 트랜잭션**으로 경계를 나누고, 중간 상태를 재조회할 수 있게 만든다.

아래는 이전 `PrivateUploadStore.save(owner, title, validatedBytes)`를 구현할 때의 **의사 코드**다. 실제 메서드나 Bean이 모두 제공되었다는 뜻이 아니며, `validatedBytes`는 요청 안에서 검증한 바로 그 바이트다.

```text
1. 서버에서 uploadId와 재사용하지 않을 objectKey를 만든다.
   # 원본 파일명이나 요청 JSON의 owner를 저장 식별자로 사용하지 않는다.
2. validatedBytes의 길이와 SHA-256을 계산한다.
   # SHA-256은 내용의 일치 여부를 대조할 값이지 안전 판정이 아니다.
3. 짧은 DB 트랜잭션으로 RECEIVING 행을 만들고 commit한다.
   # 소유자·제목·key·기대 길이·해시·검사 정책·접수/제공 기한을 저장한다.
4. DB 트랜잭션 밖에서 비공개 단일 PUT을 수행한다.
   # 같은 key를 덮어쓰지 않도록 조건부 쓰기와 고정 바이트를 사용한다.
5. 응답 versionId와 해당 버전의 길이·체크섬을 대조한다.
   # timeout은 실패 확정이 아니므로 같은 저장 의도로 결과를 재조회한다.
6. RECEIVING이고 기한 전인 경우만 versionId를 고정하고 QUARANTINED로 바꾼다.
   # next_scan_at도 DB의 현재 시각으로 설정해 검사 후보에 들어가게 한다.
   # 이미 만료·삭제 단계라면 공개 후보로 되살리지 않고 정리 대상으로 남긴다.
7. commit까지 확인된 경우에만 기존 Controller에 uploadId를 반환한다.
   # 이후 검사는 DB의 QUARANTINED 행을 찾아 진행한다.
```

S3의 조건부 쓰기에서 `If-None-Match: *`는 같은 key의 기존 현재 객체가 있으면 쓰기를 막는다. 삭제 마커가 현재 버전인 경우 등은 별도 동작이므로, 이것만으로 key의 영구 재사용 금지가 구현되는 것은 아니다. 예제에서는 DB의 고유 key와 애플리케이션의 재사용 금지 정책도 유지한다. [S3 조건부 쓰기](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)

SHA-256은 서버가 계산한 전체 파일 값과 실제 저장·검사한 바이트를 대조하는 데 쓴다. S3의 ETag를 항상 전체 파일 SHA-256으로 해석하지 않으며, 업로드 메타데이터에 적힌 해시 문자열을 읽는 것만으로 실제 내용 대조를 대신하지 않는다. S3 체크섬은 알고리즘·인코딩·전체/복합 체크섬 구분을 맞춰 검증한다. [S3 업로드 무결성](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)

| 중단 지점 | 남을 수 있는 상태 | 복구 기준 |
| --- | --- | --- |
| 의도 commit 전 | 행도 객체도 없음 | 새 접수 가능 |
| RECEIVING commit 후 PUT 전 | 행만 있음 | 접수 기한과 실제 저장 여부 확인 |
| PUT 성공 후 응답 유실 | 객체는 있는데 versionId 미기록 | 해당 key·저장 의도·길이·해시 대조 |
| 객체 확인 후 DB 갱신 실패 | RECEIVING + 저장 객체 | 같은 버전을 재대조하고 조건부 확정 |
| QUARANTINED commit 후 검사 시작 전 | 검사 대기 행 | DB polling으로 재발견 |

`polling`은 일정 간격으로 저장된 상태를 조회하는 방식이다. 여기서는 DB 행 자체가 지속되는 작업 목록이므로 메모리 이벤트 한 번에만 의존하지 않는다. `@TransactionalEventListener`는 commit 등 실행 시점을 연결하는 기능이며, 별도의 지속성 장치 없이 프로세스 종료 후 전달을 보장하는 큐가 되지는 않는다. 메시지 브로커를 추가할 때는 이전 Outbox 노트와 연결한다. [Spring 트랜잭션 이벤트](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html)

HTTP 응답을 받지 못한 클라이언트의 POST 재전송까지 같은 접수로 묶으려면 별도의 멱등성 키 계약이 필요하다. 서버 내부의 동일 key 재시도와 사용자의 중복 접수는 같은 문제가 아니다. 이 부분은 [멱등성 키 노트](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md)의 소유자·요청 내용 대조를 적용한다.

### 3.4 상태·시간·검사 대상을 데이터 모델에 함께 둔다

다음은 PostgreSQL 17 실습 DB에 만들 수 있는 **교육용 테이블 정의**다. 운영 DB에 바로 실행하는 마이그레이션이 아니며, 사용자 테이블의 외래 키·감사 이력 테이블·사용량 집계는 생략한다. 기존 프로젝트에 반영할 때는 Flyway 버전과 기존 스키마를 먼저 맞춘다.

```sql
CREATE TABLE upload_asset (
    id uuid PRIMARY KEY,                         -- 서버가 만든 업로드 식별자다.
    owner_subject text NOT NULL,                 -- 인증 결과의 안정적인 사용자 키다.
    title varchar(100) NOT NULL,                  -- 표시 정보이며 저장 경로가 아니다.
    state text NOT NULL CHECK (state IN (
        'RECEIVING', 'QUARANTINED', 'SCANNING', 'READY',
        'REJECTED', 'DELETE_PENDING', 'DELETED'
    )),                                          -- 잘못된 상태 문자열을 거절한다.
    bucket_name text NOT NULL,                   -- 서버 설정에서 선택한 비공개 버킷이다.
    object_key text NOT NULL,                    -- 이 접수에만 쓰는 서버 생성 key다.
    object_version text,                         -- 저장 완료를 대조한 뒤 고정한다.
    byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 65536),
    sha256_hex varchar(64) NOT NULL
        CHECK (sha256_hex ~ '^[0-9a-f]{64}$'),     -- 서버가 계산한 전체 바이트의 해시다.
    policy_version text NOT NULL,                -- 예: text-policy-v1. 적용할 검사 규칙을 식별한다.
    scan_attempts integer NOT NULL DEFAULT 0 CHECK (scan_attempts BETWEEN 0 AND 3),
    scan_token uuid,                             -- 매 검사 시도마다 바꾸는 담당 식별표다.
    scan_lease_until timestamptz,                 -- 이 담당자가 결과를 확정할 수 있는 기한이다.
    next_scan_at timestamptz,                     -- 재시도 폭주를 막기 위한 다음 시도 시각이다.
    result_code text,                            -- 원문·엔진 로그 대신 제한된 업무 사유 코드다.
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    receive_until timestamptz NOT NULL,           -- 미완료 저장을 기다릴 기한이다.
    expires_at timestamptz NOT NULL,              -- 새 다운로드를 허용할 마지막 경계다.
    delete_after timestamptz,                     -- 정리를 시작할 수 있는 시각이다.
    deleted_at timestamptz,                       -- 실제 정리를 확인한 시각이다.
    UNIQUE (bucket_name, object_key),             -- 삭제 이력도 유지하여 key 재사용을 막는다.
    CHECK (created_at < receive_until AND receive_until <= expires_at),
    CHECK ((state = 'SCANNING' AND scan_token IS NOT NULL AND scan_lease_until IS NOT NULL)
        OR (state <> 'SCANNING' AND scan_token IS NULL AND scan_lease_until IS NULL)),
    CHECK (state NOT IN ('QUARANTINED', 'SCANNING', 'READY', 'REJECTED')
        OR object_version IS NOT NULL),          -- 저장 버전 없는 파일은 검사·제공하지 않는다.
    CHECK (state <> 'QUARANTINED' OR next_scan_at IS NOT NULL),
    CHECK (state <> 'READY' OR (result_code IS NOT NULL AND result_code = 'PASSED')),
    CHECK (state <> 'DELETE_PENDING' OR delete_after IS NOT NULL),
    CHECK (state <> 'DELETED' OR deleted_at IS NOT NULL)
);

CREATE INDEX upload_scan_due ON upload_asset (next_scan_at, id)
    WHERE state = 'QUARANTINED';                 -- 대기 중이며 시각이 된 파일을 찾는 후보 인덱스다.
CREATE INDEX upload_scan_lease ON upload_asset (scan_lease_until, id)
    WHERE state = 'SCANNING';                    -- 중단된 검사 후보를 찾는다.
CREATE INDEX upload_expiry ON upload_asset (expires_at, id)
    WHERE state NOT IN ('DELETE_PENDING', 'DELETED');
CREATE INDEX upload_cleanup_due ON upload_asset (delete_after, id)
    WHERE state = 'DELETE_PENDING';              -- 정리 지연을 조회한다.
```

`timestamptz`는 시점 비교를 위한 PostgreSQL 타입이며, Java에서는 `Instant`로 시점을 표현할 수 있다. 화면에 한국 시각으로 표시하는 일과 DB에서 만료를 비교하는 일은 구분한다. 현재 행의 CHECK 제약은 잘못된 값 조합을 막지만, “어떤 이전 상태에서 여기로 왔는가”까지 모두 증명하지 않으므로 아래 UPDATE 조건도 필요하다.

예시 정책은 접수 기한 5분, 보관·제공 기한 접수 후 24시간, 검사 담당 기간 2분, 검사 시도 최대 3회다. 보편적 권장값이 아니며 실제 최대 파일 크기·검사 시간·보존 정책에 맞춰 바꿔야 한다. `expires_at`을 READY 시점에 무조건 다시 24시간 연장하지 않으므로 대기 시간이 길면 사용 가능한 시간이 짧아진다.

아래 SQL의 `:id`, `:token` 같은 값은 Spring `NamedParameterJdbcTemplate` 같은 도구에서 바인딩하는 이름 기반 매개변수다. 일반 JDBC의 `?` 표기나 psql에 그대로 붙여 넣는 문법과 다르며, 값을 문자열로 이어 붙이지 않는다. 각 쿼리는 별도의 짧은 트랜잭션에서 실행하고, 영향 행 수 또는 `RETURNING` 결과를 반드시 확인한다. [Spring JDBC 이름 기반 매개변수](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html#jdbc-NamedParameterJdbcTemplate)

예를 들어 3.3의 저장 대조까지 끝난 뒤에는 다음 SQL로 검사 대기를 확정한다. `:verified_version`은 클라이언트 주장값이 아니라 저장 어댑터가 해당 bucket·key에서 검증한 versionId이고, `:verified_bytes`·`:verified_sha256`도 실제 저장 내용의 대조 결과다.

```sql
UPDATE upload_asset
SET object_version = :verified_version,          -- 이후 검사·제공에서 같은 버전을 사용한다.
    state = 'QUARANTINED',
    next_scan_at = clock_timestamp()             -- 첫 검사부터 작업 목록에 보이게 한다.
WHERE id = :id
  AND state = 'RECEIVING'                        -- 만료·삭제로 넘어간 행을 되살리지 않는다.
  AND object_version IS NULL                    -- 이미 확정한 버전을 바꾸지 않는다.
  AND byte_size = :verified_bytes
  AND sha256_hex = :verified_sha256
  AND receive_until > clock_timestamp()
  AND expires_at > clock_timestamp()
RETURNING id, state;
```

0행이면 같은 성공이 이미 반영되었는지, 기한이 지났는지, 저장 내용이 다른지 다시 대조한다. 저장 완료를 확인하지 않은 상태에서 이 쿼리부터 실행해서는 안 된다. READY 승인은 아직 아니며 다음 검사 단계가 남아 있다.

### 3.5 검사 작업을 선점하고 담당 기간을 기록한다

**선점(claim)**은 여러 작업자 중 누가 현재 작업을 맡았는지 DB에 먼저 확정하는 것이다. **lease**는 그 담당 권한에 붙인 유효 기간이다. 작업자가 죽어도 영원히 SCANNING으로 남지 않도록 하되, lease가 끝났다는 사실만으로 실제 프로세스가 중단되었다고 가정하지 않는다.

먼저 작업자는 처리할 자리가 있을 때만 아래 쿼리로 한 건을 가져온다. `:token`은 서버가 이번 시도용으로 새로 만든 UUID이며 클라이언트 입력이 아니다.

```sql
WITH candidate AS (
    SELECT id
    FROM upload_asset
    WHERE state = 'QUARANTINED'                  -- 저장 완료·미승인 파일만 대상으로 삼는다.
      AND next_scan_at <= clock_timestamp()      -- 재시도 대기 시간이 지난 경우만 읽는다.
      AND expires_at > clock_timestamp()        -- 이미 만료한 파일은 검사하지 않는다.
      AND scan_attempts < 3                     -- 예제의 최대 시도 횟수를 지킨다.
    ORDER BY next_scan_at, id                    -- 같은 시각에서는 ID로 순서를 정한다.
    LIMIT 1                                     -- 처리할 수 있는 한 건만 선점한다.
    FOR UPDATE SKIP LOCKED                      -- 다른 작업자가 잡은 행은 이번에는 건너뛴다.
)
UPDATE upload_asset AS asset
SET state = 'SCANNING',
    scan_attempts = asset.scan_attempts + 1,     -- 검사 결과가 아니라 시작 시도 횟수다.
    scan_token = :token,
    scan_lease_until = clock_timestamp() + interval '2 minutes',
    next_scan_at = NULL,
    result_code = NULL
FROM candidate
WHERE asset.id = candidate.id
RETURNING asset.*;                              -- 검사할 정확한 위치·버전·해시·token을 돌려준다.
```

반환 행이 없으면 지금 맡을 작업이 없다는 뜻이다. 행을 받았더라도 트랜잭션 commit이 확인되기 전에는 외부 검사를 시작하지 않는다. 검사 중에는 DB 행 잠금과 연결을 계속 붙잡고 있지 않는다.

`FOR UPDATE`는 선택한 행에 대한 충돌하는 변경을 조정하고, `SKIP LOCKED`는 잠긴 행을 기다리지 않고 건너뛴다. 모든 행의 일관된 집계에는 적합하지 않지만 여러 소비자가 작업 목록을 나누어 가져갈 때 사용할 수 있다. 잠긴 파일은 다음 polling에서 다시 후보가 된다. [PostgreSQL SELECT 잠금 절](https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE)

여기서는 시간 조건 평가 시 DB의 `clock_timestamp()`를 쓴다. `CURRENT_TIMESTAMP`는 트랜잭션 시작 시각이므로 긴 트랜잭션 안에서 계속 실제 시간이 흐르는 것처럼 쓰면 안 된다. 어떤 함수를 쓰더라도 트랜잭션을 짧게 유지하고 장시간 잠금 대기에는 제한을 둔다. [PostgreSQL 현재 시각 함수](https://www.postgresql.org/docs/17/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT)

### 3.6 검사 결과는 통과·거절·오류를 구분하고 대상 버전과 묶는다

작업자는 claim에서 받은 `bucket + key + versionId`로 바이트를 읽고 길이·SHA-256을 다시 대조한 뒤 정해진 `policy_version`으로 검사한다. **검사 결과**는 문자열 `PASSED` 하나가 아니라 대상 ID·저장 버전·내용 해시·검사 정책·담당 token을 함께 가리켜야 한다.

| 판정 | 뜻 | 이번 정책의 다음 상태 |
| --- | --- | --- |
| PASSED | 요구한 검사를 모두 완료했고 정책 통과 | 유효한 담당자·기한이면 READY |
| BLOCKED | 업무·내용 규칙 위반이 확인됨 | REJECTED, 사유 POLICY_BLOCKED |
| ERROR | timeout·연결 실패 등으로 판정하지 못함 | 남은 횟수면 재대기, 아니면 REJECTED |

검사 엔진의 결과와 애플리케이션 상태를 분리하면 “응답이 없으므로 통과” 같은 실수를 줄일 수 있다. 특히 엔진이 반환한 unknown·unsupported·부분 검사 결과를 성공으로 바꾸지 않는다. 버전이나 해시가 다르면 통과 판정 자체를 받아들이지 않고 무결성 오류로 격리를 유지하며 조사한다.

ERROR 보고서의 대상 정보는 “이 대상을 검사하려다 실패했다”는 식별 정보일 수 있다. 반면 PASSED를 만들려면 어댑터가 실제 읽은 바이트의 길이·해시·버전과 필요한 모든 검사 완료를 확인해야 한다. claim 값을 복사한 뒤 판정만 PASSED로 붙이는 구현은 이 계약을 충족하지 않는다.

다음 `ScanDecisionPolicy.java`는 **기존 Java 21 프로젝트에 추가하는 순수 판단 클래스**다. 패키지 경로는 `src/main/java/com/example/upload/ScanDecisionPolicy.java`이며 Spring Bean·S3·DB를 직접 호출하지 않는다. `Ticket`은 DB 조회 결과, `Report`는 신뢰한 검사 어댑터가 받은 결과이고 외부 요청 DTO가 아니다.

```java
package com.example.upload;

import java.time.Instant; // 시간대 표시와 분리된 시점을 비교한다.
import java.util.Objects; // 비교할 값이 빠졌을 때 승인하지 않고 실패하게 한다.
import java.util.UUID; // 업로드와 검사 시도를 구분하는 식별자다.

public final class ScanDecisionPolicy {
    private ScanDecisionPolicy() {} // 상태를 갖지 않는 규칙 모음이다.

    public enum Verdict { PASSED, BLOCKED, ERROR } // 검사 통과·내용 거절·판정 불가를 구별한다.
    public enum Action { APPROVE, REJECT, RETRY, IGNORE } // 무시된 결과로 DB를 덮어쓰지 않는다.

    public record Ticket(
            UUID id, String state, UUID token, String objectVersion, String sha256Hex,
            String policyVersion, int attempts, Instant leaseUntil, Instant expiresAt
    ) {} // SCANNING 행을 읽어 만든 내부 스냅샷이다.

    public record Report(
            UUID id, UUID token, String objectVersion, String sha256Hex,
            String policyVersion, Verdict verdict
    ) {} // 검사한 대상과 실행 시도를 결과에 함께 보관한다.

    public static Action decide(Ticket ticket, Report report, Instant now) {
        Objects.requireNonNull(ticket); // 입력 누락은 승인으로 처리하지 않는다.
        Objects.requireNonNull(report);
        Objects.requireNonNull(now);
        Objects.requireNonNull(report.verdict()); // 알 수 없는 외부 판정은 어댑터에서 ERROR로 분류한다.

        if (!"SCANNING".equals(ticket.state())) {
            return Action.IGNORE; // 이미 승인·만료·삭제된 행에 늦게 온 결과다.
        }
        if (!Objects.requireNonNull(ticket.id()).equals(report.id())
                || !Objects.requireNonNull(ticket.token()).equals(report.token())
                || !Objects.requireNonNull(ticket.objectVersion()).equals(report.objectVersion())
                || !Objects.requireNonNull(ticket.sha256Hex()).equals(report.sha256Hex())
                || !Objects.requireNonNull(ticket.policyVersion()).equals(report.policyVersion())) {
            return Action.IGNORE; // 다른 작업·버전·바이트·정책의 결과는 사용하지 않는다.
        }
        if (!now.isBefore(Objects.requireNonNull(ticket.leaseUntil()))
                || !now.isBefore(Objects.requireNonNull(ticket.expiresAt()))) {
            return Action.IGNORE; // 기한과 정확히 같은 시각도 유효 범위 밖이다.
        }
        if (ticket.attempts() < 1 || ticket.attempts() > 3) {
            throw new IllegalArgumentException("invalid scan attempts"); // 저장 이력 오류를 숨기지 않는다.
        }
        return switch (report.verdict()) {
            case PASSED -> Action.APPROVE; // 모든 요구 검사가 끝났다는 어댑터 계약이 전제다.
            case BLOCKED -> Action.REJECT; // 내용 위반은 같은 바이트로 반복 검사하지 않는다.
            case ERROR -> ticket.attempts() < 3 ? Action.RETRY : Action.REJECT;
            // 마지막 시도의 장애는 승인하지 않고 검사 불가 사유로 종료한다.
        };
    }
}
```

예상 입력이 `attempts = 1, verdict = ERROR`이고 token·대상·시간이 모두 맞으면 `RETRY`다. 같은 조건에서 `attempts = 3`이면 `REJECT`이며, `now == leaseUntil`이면 판정 종류와 무관하게 `IGNORE`다. `Instant.isBefore`의 엄격한 이전 비교를 사용해 기한 경계를 명확히 한다. [Java 21 Instant](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/Instant.html#isBefore(java.time.Instant))

⚠️ 주의: 이 함수가 APPROVE를 반환한 직후 다른 작업자가 상태를 바꿀 수 있다. 메모리의 판단은 설명·단위 테스트용이며, 실제 동시성 보호는 다음 SQL의 조건부 갱신이 담당한다. IGNORE도 “아무 문제가 없음”이 아니라 중복·오래된 결과 또는 무결성 이상인지 기록·분류할 대상이다.

### 3.7 마지막 결과 확정도 조건부 UPDATE로 수행한다

**조건부 갱신**은 “내가 읽었던 조건이 아직 맞을 때만 바꾼다”를 하나의 UPDATE로 수행하는 것이다. 먼저 조회하고 나중에 ID만으로 READY를 저장하면, 사이에 만료 처리한 상태를 덮어쓸 수 있다.

아래 SQL은 신뢰한 내부 어댑터의 결과를 반영하는 **저장 계층 코드**다. `:verdict`는 위 enum의 세 값으로 제한하고, 나머지 매개변수는 해당 검사 보고서에서 가져온다. 임의 사용자가 이 쿼리의 token·판정·상태를 지정하는 API를 만들지 않는다.

```sql
UPDATE upload_asset
SET state = CASE
        WHEN :verdict = 'PASSED' THEN 'READY'
        WHEN :verdict = 'ERROR' AND scan_attempts < 3 THEN 'QUARANTINED'
        ELSE 'REJECTED'
    END,                                        -- 실패와 미완료를 승인으로 바꾸지 않는다.
    result_code = CASE
        WHEN :verdict = 'PASSED' THEN 'PASSED'
        WHEN :verdict = 'BLOCKED' THEN 'POLICY_BLOCKED'
        WHEN scan_attempts < 3 THEN 'RETRY_WAIT'
        ELSE 'INSPECTION_UNAVAILABLE'
    END,                                        -- 악성/정책 위반과 검사 장애를 구별한다.
    next_scan_at = CASE
        WHEN :verdict = 'ERROR' AND scan_attempts < 3
        THEN clock_timestamp() + interval '1 minute'
        ELSE NULL
    END,                                        -- 예시 지연이며 운영에서는 backoff·jitter를 검토한다.
    scan_token = NULL,
    scan_lease_until = NULL                      -- SCANNING을 벗어나며 담당 권한을 제거한다.
WHERE id = :id
  AND state = 'SCANNING'
  AND scan_token = :token                        -- 이전 작업자의 결과를 차단한다.
  AND object_version = :version
  AND sha256_hex = :sha256
  AND policy_version = :policy                   -- 검사 결과와 현재 승인 대상을 맞춘다.
  AND scan_lease_until > clock_timestamp()
  AND expires_at > clock_timestamp()
  AND :verdict IN ('PASSED', 'BLOCKED', 'ERROR')
RETURNING id, state, result_code;
```

반환이 1행이면 이번 결과를 반영했고, 0행이면 현재 담당자가 아니거나 이미 상태·시간 조건이 달라진 것이다. 0행일 때 “다시 ID만으로 UPDATE”하면 보호 장치를 무너뜨리므로 현재 행을 재조회하여 분류한다. 같은 결과를 두 번 전달해도 첫 번째 반영 후에는 SCANNING 조건이 맞지 않아 추가 효과가 없다.

PostgreSQL Read Committed에서는 경쟁 중인 UPDATE가 앞선 갱신을 기다린 뒤 변경된 행에 WHERE 조건을 다시 평가한다. 단순한 해당 행의 상태·token 조건을 UPDATE 안에 두는 이유다. 다른 DB·격리 수준으로 옮기면 같은 동작을 추정하지 말고 동시 실행 테스트로 확인한다. [PostgreSQL Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

### 3.8 죽은 검사 작업은 복구하되 늦은 결과는 차단한다

작업자 A가 token A로 검사를 시작한 뒤 멈췄다고 하자. 담당 기간이 지나 작업을 다시 대기시키고 B가 token B로 맡으면, 나중에 A가 돌아와 PASSED를 보내도 현재 token과 맞지 않아 반영되지 않는다. 이것은 **오래된 담당자의 DB 쓰기 차단**이지 A 프로세스 자체의 강제 종료가 아니다.

아래는 만료된 검사 담당을 한 건 복구하는 SQL이다. `:id`는 스케줄러가 찾은 후보이며, 후보 조회 이후 상태가 달라질 수 있으므로 UPDATE에서도 조건을 다시 확인한다.

```sql
UPDATE upload_asset
SET state = CASE WHEN scan_attempts < 3 THEN 'QUARANTINED' ELSE 'REJECTED' END,
    result_code = CASE WHEN scan_attempts < 3 THEN 'LEASE_EXPIRED'
                       ELSE 'INSPECTION_UNAVAILABLE' END,
    next_scan_at = CASE WHEN scan_attempts < 3
                       THEN clock_timestamp() + interval '1 minute' ELSE NULL END,
    scan_token = NULL,                           -- 이전 작업자의 승인 권한을 먼저 제거한다.
    scan_lease_until = NULL
WHERE id = :id
  AND state = 'SCANNING'
  AND scan_lease_until <= clock_timestamp()      -- 담당 기한이 지난 행만 복구한다.
  AND expires_at > clock_timestamp()            -- 파일 자체 만료는 삭제 흐름이 담당한다.
RETURNING id, state;
```

전체 작업 흐름은 다음 **의사 코드**처럼 구성한다. Spring에서는 짧은 트랜잭션 메서드를 별도 Bean으로 분리하거나 `TransactionTemplate`로 DB 구간을 명시할 수 있다. 바깥 작업 전체가 이미 트랜잭션에 묶여 있지 않은지 확인해야 한다. [Spring 프로그래밍 방식 트랜잭션](https://docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html)

```text
사용 가능한 worker 자리 확보
  → 짧은 트랜잭션: 한 건 claim하고 commit
  → 트랜잭션 밖: 고정 버전 읽기·내용 대조·제한 시간 내 검사
  → 짧은 트랜잭션: token·버전·기한을 확인하여 결과 확정
  → 스트림·검사 프로세스·worker 자리 정리

별도 복구 순회
  → lease가 만료된 SCANNING 후보 조회
  → 조건부 UPDATE로 재대기 또는 검사 불가 종료
```

선점한 뒤 실행기의 대기열에서 오래 기다리면 시작 전부터 lease가 만료될 수 있다. 따라서 worker의 실제 여유만큼 가져오고 실행 시간 제한은 lease보다 여유 있게 짧게 둔다. 긴 검사에 heartbeat로 lease를 연장하려면 현재 token·아직 유효한 lease·파일 만료 전 조건을 모두 검사해야 하며, 이 예제에는 연장 기능을 넣지 않는다.

검사 작업자는 파일을 읽고 판정할 뿐 승인 파일을 직접 덮어쓰지 않는다. 늦은 A가 외부 파일까지 바꿀 권한을 갖는다면 DB token 비교만으로는 그 부작용을 막을 수 없기 때문이다. 또한 단순 `@Async` 호출이나 서버마다 동작하는 `@Scheduled`만으로 한 번 실행이 보장되지 않으므로 중복을 견디는 DB 조건이 필요하다.

### 3.9 다운로드는 상태 조회 화면과 독립적으로 다시 승인한다

화면이 조금 전 READY를 보았어도 사용자가 다운로드를 누를 때는 만료되었을 수 있다. **상태 조회는 설명용 정보이고 다운로드 API의 재검사가 실제 접근 결정**이다. 상태 조회도 인증된 소유자에게만 제공하며, bucket·key·token·엔진 원문 보고서를 응답하지 않는다.

다음은 다운로드할 대상 메타데이터를 찾는 SQL 조각이다. `:owner`는 요청 JSON이 아닌 인증 결과이며, 반환된 버전을 이전 다운로드 스트리밍 흐름에 연결한다.

```sql
SELECT id, bucket_name, object_key, object_version, byte_size, sha256_hex
FROM upload_asset
WHERE id = :id
  AND owner_subject = :owner                     -- 다른 사용자의 ID를 알아도 조회할 수 없다.
  AND state = 'READY'
  AND result_code = 'PASSED'
  AND expires_at > clock_timestamp();            -- 정리 스케줄러가 늦어도 새 요청은 거부한다.
```

0행이면 객체 조회·서명 URL 발급을 시작하지 않는다. 이 예제의 외부 정책은 존재 여부 노출을 줄이기 위해 해당 다운로드에 404를 반환하고, 소유자에게 제공하는 별도 상태 조회에서만 대기·거절·만료를 안내하는 것이다. 서비스 정책에 따라 403·410 등을 선택할 수 있지만 권한 확인 전에 상태를 노출하지 않는다.

**접근 판단 시점**도 정해야 한다. 이 예제는 다운로드 시작 시점의 승인이다. 승인 직후 삭제가 시작되면 파일 읽기가 실패할 수 있으며, 이미 전달한 바이트는 회수할 수 없다. 진행 중인 다운로드 완료를 보장하려면 읽기 작업의 별도 lease와 삭제 대기를 설계해야 하며 이번 범위에는 포함하지 않는다.

사전 서명 URL은 발급 후 요청이 애플리케이션 DB를 다시 거치지 않을 수 있다. 따라서 DB 상태 변경만으로 이미 발급한 URL이 즉시 취소된다고 말하지 않는다. 이 노트의 강한 상태 재검사 흐름은 애플리케이션을 거치는 다운로드를 기본으로 하고, 서명 URL의 권한·유효 기간은 [다운로드 노트](../43_10_23_File_Download_Streaming_and_Access_Control/10_23_File_Download_Streaming_and_Access_Control.md)에서 별도로 확인한다.

### 3.10 논리적 만료와 물리적 삭제는 두 단계다

**논리적 만료**는 더 이상 새 사용을 허용하지 않는 것이고, **물리적 삭제**는 저장소에서 실제 바이트를 제거하는 것이다. 저장소 장애 때문에 삭제가 늦어져도 접근은 막혀 있어야 하며, 반대로 삭제 요청을 보냈다는 이유만으로 제거 완료라고 기록해서도 안 된다.

아래 SQL은 후보 ID 하나를 정리 단계로 넘긴다. REJECTED는 곧바로 정리하고, RECEIVING은 접수 기한이 지나면 정리하며, 다른 파일은 expires_at이 지나면 정리한다. `delete_after`의 5분은 저장 작업을 조사할 예시 유예 시간이지 진행 중인 PUT이 종료되었다는 증거가 아니다.

```sql
UPDATE upload_asset
SET state = 'DELETE_PENDING',
    scan_token = NULL,
    scan_lease_until = NULL,                     -- 검사 결과가 나중에 돌아와도 승인하지 못하게 한다.
    next_scan_at = NULL,
    result_code = CASE
        WHEN state = 'REJECTED' THEN result_code -- 기존 거절 사유를 보존한다.
        WHEN state = 'RECEIVING' THEN 'RECEIVE_EXPIRED'
        ELSE 'EXPIRED'
    END,
    delete_after = clock_timestamp() + interval '5 minutes'
WHERE id = :id
  AND state NOT IN ('DELETE_PENDING', 'DELETED')
  AND (state = 'REJECTED'
       OR expires_at <= clock_timestamp()
       OR (state = 'RECEIVING' AND receive_until <= clock_timestamp()))
RETURNING id, bucket_name, object_key, object_version, delete_after;
```

UPDATE 오른쪽의 `state`는 변경 전 값을 기준으로 읽으므로 REJECTED 사유가 보존된다. SQL을 실행한 뒤 commit을 확인하고 나서 별도 정리 작업을 진행한다. 삭제 후보를 찾는 조회에는 한 번에 처리할 개수·시간 제한을 두고, API의 만료 검사 자체를 이 스케줄러 성공에 의존시키지 않는다. [PostgreSQL UPDATE 표현식과 RETURNING](https://www.postgresql.org/docs/17/sql-update.html)

저장 버전이 확정된 파일의 정리 절차는 다음과 같다. 이것은 **설계 의사 코드**이며 운영 버킷을 삭제하는 실행 명령이 아니다.

```text
1. DELETE_PENDING이며 delete_after가 지난 행을 다시 확인한다.
   # 클라이언트가 준 경로가 아닌 신뢰한 DB의 대상만 사용한다.
2. 해당 업로드에 새 PUT을 수행할 주체가 없는지 확인한다.
   # DB lease 만료만으로 진행 중인 외부 쓰기가 종료되었다고 단정하지 않는다.
3. 저장소에서 bucket + key + versionId로 정확한 대상 버전을 삭제한다.
   # 같은 key의 최신 버전을 추측하거나 경로 prefix 전체를 지우지 않는다.
4. 성공 응답 또는 권한 있는 대조로 대상 버전의 부재를 확인한다.
   # 403·timeout·알 수 없는 응답은 삭제 완료가 아니다.
5. 짧은 DB 트랜잭션에서 여전히 DELETE_PENDING이고 같은 대상일 때 DELETED로 확정한다.
   # 삭제 성공 후 DB commit이 실패하면 동일 대상 삭제·대조를 재시도한다.
```

버전 관리 S3에서 versionId 없는 DELETE는 보통 **삭제 마커**를 만들어 현재 조회를 가릴 뿐, 이전 바이트를 모두 지우지 않는다. 특정 버전을 영구 제거하려면 그 versionId를 지정해야 하며, 대상 버전 제거는 복구할 수 없는 작업이다. 권한·보존 잠금 때문에 제거하지 못하면 DELETE_PENDING에 남겨 알린다. [S3 DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html), [버전 삭제와 삭제 마커](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeletingObjectVersions.html)

여기서 DELETED는 이 업로드의 추적 대상 객체를 정리했다는 의미다. 백업·복제본·감사 로그·사용자가 이미 받은 사본까지 모두 사라졌다는 전역 보증은 아니다. 예제는 key당 확정 버전 하나를 전제로 하며, 변환본·여러 업로드 시도를 허용하면 별도 객체 목록과 각 삭제 완료 상태가 필요하다.

S3 Lifecycle은 보존 기간에 따른 저장소 정리의 보조 수단이다. 실행 지연이 있을 수 있고, 버전 관리 버킷의 현재 버전 만료와 noncurrent version 제거는 다르다. 따라서 “24시간 만료 정책을 켰으니 정확히 그 시각부터 다운로드 불가”라는 접근 제어를 맡기지 않는다. [S3 Lifecycle 만료 동작](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html)

### 3.11 미완료 파일과 고아 객체는 상태 대조로 정리한다

**고아 객체(orphan object)**는 실제 저장소에는 존재하지만 정상 사용 이력과 연결되지 않은 객체다. 예를 들어 PUT 성공 후 DB 확정 전에 서버가 종료되면 RECEIVING 행과 객체가 남을 수 있다. 행이 있더라도 저장 버전을 아직 연결하지 못했다는 점에서 별도 복구가 필요하다.

RECEIVING 복구자는 서버 생성 key의 결과를 찾고, 소유 업무·예상 길이·실제 해시를 대조한다. 접수 기한 전이고 정확히 맞는 저장 결과가 확인되면 조건부로 QUARANTINED를 확정할 수 있다. 기한이 지났다면 검사·공개로 보내지 않고 DELETE_PENDING에서 발견한 객체 버전을 추적해 정리한다.

여기서 **없는 것처럼 보임**과 **확실히 없음**을 구분해야 한다. S3 HEAD는 접근 권한에 따라 없는 객체도 403으로 보일 수 있으므로 403을 “없으니 정리 끝”으로 바꾸지 않는다. 응답 유실도 같은 원칙으로 대조한다. [S3 HeadObject의 오류·권한](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)

⚠️ 주의: 한 번 조회해서 객체가 없었다고 RECEIVING 이력을 즉시 지우면, 지연된 PUT이 나중에 완료되어 새로운 고아 객체가 생길 수 있다. 생산자의 종료·권한과 재시도 중단을 확인하고, 이전 쓰기가 더 도착할 수 있는 상황은 미확정 상태로 유지한다. timeout이나 고정 유예 시간만으로 외부 쓰기가 취소되었다고 증명하지 않는다.

이 때문에 예제에서는 확정 버전 없는 정리를 자동 성공으로 처리하는 코드를 제시하지 않는다. 해당 key의 버전 목록·진행 중 쓰기·이력 보존을 대조하는 복구 어댑터가 별도로 필요하다. 추적 밖의 객체는 관리 대상 prefix·생성 시각·서버 발급 ID·DB 이력을 묶어 후보로 만들고, 정상 참조와 생산자가 없음을 확인한 뒤에만 삭제한다.

정리 대기 파일도 디스크·스토리지 공간을 차지한다. 사용자별 접수 수·총 바이트 한도에는 활성 파일뿐 아니라 격리·정리 대기 파일도 포함하고, 실제 제거 확인에 맞춰 사용량을 해제한다. 한도를 동시 요청에서 정확히 지키려면 별도의 원자적 사용량 예약이 필요하며 이 노트의 테이블 하나가 그것까지 구현하지는 않는다.

운영 지표는 대기 중 파일의 최고 대기 시간, lease 만료 횟수, 검사 오류 비율, 거절 사유 분포, 삭제 대기 바이트, 가장 오래된 정리 실패를 나누어 본다. 로그에는 uploadId·시도 번호·사유 코드를 남기고 파일 내용·서명 URL·민감한 원본 이름은 기본 기록에서 제외한다.

### 3.12 정상 경로보다 경계·중복·재시작을 먼저 시험한다

다음 `ScanDecisionPolicyTest.java`는 앞 판단 클래스의 **JUnit 단위 테스트 파일**이다. `src/test/java/com/example/upload/`에 두며, 이전 업로드 노트의 JUnit 테스트 의존성과 Java 21 프로젝트를 전제로 한다. DB 경쟁·실제 검사 엔진의 품질을 시험하는 코드가 아니다.

```java
package com.example.upload;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static com.example.upload.ScanDecisionPolicy.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

class ScanDecisionPolicyTest {
    private final UUID id = UUID.fromString("00000000-0000-0000-0000-000000000046");
    private final UUID token = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private final Instant now = Instant.parse("2026-10-28T00:00:00Z"); // 시간 흐름에 영향받지 않는 고정 시각이다.
    private final String hash = "a".repeat(64); // 형식용 테스트 값이며 실제 파일 해시라고 주장하지 않는다.

    @Test
    void approvesOnlyMatchingLiveScan() {
        assertEquals(Action.APPROVE, decide(ticket("SCANNING", 1, now.plusSeconds(120),
                now.plusSeconds(3600)), report(token, "v1", Verdict.PASSED), now));
        // 현재 시도·대상 버전·기한이 모두 맞을 때만 승인 판단을 한다.
    }

    @Test
    void ignoresOldTokenAndOtherObjectVersion() {
        Ticket current = ticket("SCANNING", 1, now.plusSeconds(120), now.plusSeconds(3600));
        UUID oldToken = UUID.fromString("00000000-0000-0000-0000-000000000002");
        assertEquals(Action.IGNORE, decide(current, report(oldToken, "v1", Verdict.PASSED), now));
        assertEquals(Action.IGNORE, decide(current, report(token, "v2", Verdict.PASSED), now));
        // PASSED라도 다른 시도나 파일 버전의 결과이면 쓸 수 없다.
    }

    @Test
    void rejectsExactDeadlineAsNoLongerLive() {
        Report passed = report(token, "v1", Verdict.PASSED);
        assertEquals(Action.IGNORE, decide(ticket("SCANNING", 1, now,
                now.plusSeconds(3600)), passed, now)); // lease와 같은 시각은 만료다.
        assertEquals(Action.IGNORE, decide(ticket("SCANNING", 1, now.plusSeconds(120),
                now), passed, now)); // 파일 제공 기한도 같은 경계 규칙이다.
    }

    @Test
    void separatesBlockedContentFromRetryableError() {
        Ticket first = ticket("SCANNING", 1, now.plusSeconds(120), now.plusSeconds(3600));
        Ticket last = ticket("SCANNING", 3, now.plusSeconds(120), now.plusSeconds(3600));
        assertEquals(Action.REJECT, decide(first, report(token, "v1", Verdict.BLOCKED), now));
        assertEquals(Action.RETRY, decide(first, report(token, "v1", Verdict.ERROR), now));
        assertEquals(Action.REJECT, decide(last, report(token, "v1", Verdict.ERROR), now));
        // 마지막 ERROR는 악성 확정이 아니라 검사 불가로 승인하지 않는 것이다.
    }

    @Test
    void cannotRevivePendingDeletion() {
        assertEquals(Action.IGNORE, decide(ticket("DELETE_PENDING", 1, now.plusSeconds(120),
                now.plusSeconds(3600)), report(token, "v1", Verdict.PASSED), now));
        // 이전 검사 스냅샷의 결과가 삭제 상태를 READY로 되돌릴 수 없어야 한다.
    }

    @Test
    void ignoresDifferentHashAndPolicy() {
        Ticket current = ticket("SCANNING", 1, now.plusSeconds(120), now.plusSeconds(3600));
        assertEquals(Action.IGNORE, decide(current, new Report(id, token, "v1",
                "b".repeat(64), "text-policy-v1", Verdict.PASSED), now));
        assertEquals(Action.IGNORE, decide(current, new Report(id, token, "v1",
                hash, "text-policy-v2", Verdict.PASSED), now));
        // 같은 ID·버전이라도 내용 증거나 적용 정책이 일치해야 한다.
    }

    private Ticket ticket(String state, int attempts, Instant lease, Instant expiry) {
        boolean scanning = "SCANNING".equals(state); // 검사 상태가 아니면 담당 정보는 비워 둔다.
        return new Ticket(id, state, scanning ? token : null, "v1", hash,
                "text-policy-v1", attempts, scanning ? lease : null, expiry);
        // 테스트 입력 도우미이며 실제 DB 저장·상태 전환을 수행하지 않는다.
    }

    private Report report(UUID reportToken, String version, Verdict verdict) {
        return new Report(id, reportToken, version, hash, "text-policy-v1", verdict);
        // 각 테스트에서 바꾸려는 조건만 매개변수로 받는다.
    }
}
```

다음 명령은 위 두 Java 파일과 테스트 의존성을 넣은 **실제 예제 프로젝트 루트**에서 실행한다. TIL 루트에는 Gradle Wrapper가 없으므로 여기서 실행하는 명령이 아니다.

```powershell
# 예상 결과: 판단 규칙을 확인하는 6개 테스트 메서드가 통과한다.
.\gradlew.bat test --tests com.example.upload.ScanDecisionPolicyTest
```

DB와 저장소를 연결한 뒤에는 아래 시험이 추가로 필요하다. `sleep`으로 순서를 추측하기보다 두 DB 연결·동기화 지점·실패 주입으로 순서를 통제하고, 반환 행 수와 최종 저장 결과를 함께 확인한다.

| 시험 | 확인할 결과 |
| --- | --- |
| 두 worker가 한 QUARANTINED를 동시에 claim | 한 시도만 해당 행을 가져가며 token이 중복 확정되지 않음 |
| A lease 만료 → 복구 → B claim → A의 늦은 PASSED | A의 완료 UPDATE가 0행, B의 token·상태 유지 |
| READY 확정과 만료 처리가 경쟁 | 어떤 순서여도 기한 이후 새 다운로드 조회는 0행 |
| 같은 보고서를 두 번 반영 | 첫 확정 이후 두 번째는 상태 조건 불일치, 추가 승인 없음 |
| 첫 ERROR·세 번째 ERROR·검사 프로세스 강제 종료 | 재대기·검사 불가 종료·lease 복구를 구별함 |
| PUT 성공 직후 서버 종료 | RECEIVING 대조로 같은 버전을 연결하거나 삭제 대상으로 분류 |
| 삭제 성공 직후 DB 갱신 실패 | 같은 버전으로 재시도해 수렴하며 다른 버전을 지우지 않음 |
| 삭제 403·timeout·보존 잠금 | DELETED로 오인하지 않고 접근 차단·경고·재시도 유지 |
| 조회 시점엔 객체 없음 → 지연 PUT 완료 | 이력을 성급히 버리지 않고 늦은 객체를 다시 발견함 |
| 다른 소유자·격리 상태·만료 상태로 다운로드 | 객체 읽기 또는 서명 URL 발급 이전에 거절 |
| 정리 스케줄러 중단 | 만료 접근은 차단되고 정리 지연 지표는 증가 |

실제 수행한 검사는 공식 자료·API 의미 대조, 예제 흐름 검토와 저장소의 `python scripts/check_notes.py`·`git diff --check`, 문서 점검 도구 회귀 테스트다. Java 컴파일·위 JUnit·PostgreSQL 동시 실행·프로세스 종료 복구·실제 S3 삭제는 미실행이다. 표의 결과와 6개 테스트 통과는 **확인해야 할 기대 결과**이지 수행했다고 보고하는 결과가 아니다.

## 4. 적용 관점에서 다시 보기

구현 순서는 파일을 먼저 공개한 뒤 검사를 덧붙이는 것이 아니라, 접수 이력과 고정 저장 버전을 만든 뒤 검사·제공·삭제가 그 대상을 함께 참조하도록 하는 것이다. 상태 이름보다 “이 상태에서 누가 어떤 행동을 할 수 있는가”와 “중단되면 어떤 기록으로 다시 판단하는가”를 먼저 확인한다.

운영 장애는 경계별로 좁힌다. 파일이 있는데 대기 중이면 저장 확정과 polling을 확인하고, SCANNING에 오래 머무르면 lease·외부 검사 시간·작업자 여유를 본다. READY인데 다운로드가 안 되면 소유자·기한·고정 버전의 존재를 확인하고, 삭제가 늦으면 접근 차단 여부와 실제 저장소 실패를 별도로 확인한다.

마지막으로 완료의 의미를 구분한다. 접수 완료는 검사 완료가 아니고, 검사 통과는 무제한 공개가 아니며, 만료는 바이트 제거 완료가 아니다. 이 구분을 API·DB·worker·테스트에서 같은 기준으로 유지해야 재시작과 중복 실행에서도 일관된 결과를 얻는다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

업로드의 안전한 수명주기는 파일 존재가 아니라 소유자·상태·버전·검사 증거·기한을 함께 판단하는 과정이다. 외부 작업은 중복되거나 늦어질 수 있으므로, 상태를 확정하는 순간의 조건부 갱신과 재조회 가능한 이력이 중요하다.

### 5.2 이전·다음 학습과의 연결

[업로드 입력 검증](../45_10_26_File_Upload_Multipart_and_Validation/10_26_File_Upload_Multipart_and_Validation.md)의 비공개 저장 계약을 검사 작업·다운로드 승인·만료 복구로 연결했다. 다음에는 **사전 서명 URL 기반 직접 업로드·완료 검증**을 학습해 바이트가 애플리케이션을 거치지 않을 때에도 같은 신뢰 경계를 유지하는 방법을 살펴본다.

### 5.3 더 파볼 만한 주제

검사 정책이 바뀌었을 때 기존 READY 문서를 재검사하는 동안 제공을 허용할지, 사용자가 삭제를 요청할 때 진행 중인 다운로드를 어디까지 보장할지 검토할 수 있다. 대용량·여러 파생 파일·사용량 예약·감사 이력 보존은 별도 데이터 모델과 시험이 필요한 확장 주제다.

### 5.4 참고 자료

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — 비공개 저장·검사·권한·자원 제한의 다층 방어.
- [Spring Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html) — 기존 예제의 Boot 4.1.2 관리 조합 확인.
- [Spring 트랜잭션 이벤트](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html), [프로그래밍 방식 트랜잭션](https://docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html) — commit 시점과 짧은 DB 작업 경계.
- [Spring JDBC](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html) — 이름 기반 매개변수 바인딩과 SQL 호출 역할.
- [PostgreSQL 17 SELECT](https://www.postgresql.org/docs/17/sql-select.html), [UPDATE](https://www.postgresql.org/docs/17/sql-update.html), [Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html), [시각 함수](https://www.postgresql.org/docs/17/functions-datetime.html) — 선점·충돌 시 조건 재평가·기한 비교.
- [S3 조건부 쓰기](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html), [업로드 무결성](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html) — 덮어쓰기 조건과 실제 바이트 대조.
- [S3 HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html), [DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html), [버전 삭제](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeletingObjectVersions.html) — 부재·권한 오류 구분과 정확한 버전 제거.
- [S3 Lifecycle 만료](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html) — 비동기 정리와 현재·이전 버전의 차이.
- [Java 21 Instant](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/Instant.html) — 시점과 엄격한 기한 비교.

## 6. 요약 정리

- 접수·저장 완료·검사·제공·삭제를 구별하고 각 상태의 허용 행동을 정한다.
- 격리 영역은 실제 접근을 제한하며 READY도 소유자에게만 제공할 수 있다.
- DB와 객체 저장은 하나의 원자적 트랜잭션이 아니므로 의도 기록과 결과 대조가 필요하다.
- 검사·다운로드·삭제는 key만이 아니라 정확한 저장 버전을 참조한다.
- lease와 시도 token으로 중단된 작업을 복구하고 오래된 결과의 DB 반영을 막는다.
- 검사 ERROR를 PASSED나 악성 확정으로 해석하지 않고 제한된 재시도·사유를 남긴다.
- 다운로드 시점에 소유자·READY·만료를 다시 확인하므로 정리 지연이 권한 연장이 되지 않는다.
- 논리적 만료 후 정확한 버전 삭제를 확인하며, 불명확한 응답과 지연 PUT은 별도 복구한다.
- 순수 판단 테스트와 실제 DB 경쟁·저장소 실패·재시작 시험은 검증하는 범위가 다르다.

🧠 기억할 것: **파일을 받았는지보다, 지금 이 버전을 누가 어떤 근거로 사용할 수 있는지가 수명주기의 중심이다.**

## 7. 미니 퀴즈 또는 체크리스트

1. PUT은 성공했지만 QUARANTINED로 바꾸는 DB commit 전에 서버가 종료되었다. 무조건 다시 업로드하거나 바로 공개하면 안 되는 이유는?
2. A의 lease가 끝난 뒤 B가 새 token으로 작업을 맡았다. A가 늦게 PASSED를 보내면 어떤 조건으로 막는가?
3. 검사 서비스 timeout을 BLOCKED와 구분해야 하는 이유는? 세 번째 ERROR 뒤에는 무엇을 제공하는가?
4. 정리 스케줄러가 한 시간 멈췄다. 만료한 READY 파일의 다운로드가 허용되지 않으려면 어디에서 무엇을 확인해야 하는가?
5. 버전 관리 S3에 versionId 없는 DELETE를 보냈다. 파일 바이트까지 제거했다고 말할 수 있는가? 객체 조회의 403은 어떻게 판단하는가?

<details>
<summary>정답과 해설</summary>

1. 응답·DB 확정 실패와 실제 저장 실패는 다르다. RECEIVING 이력의 key·기대 길이·해시와 저장 버전을 대조한 뒤, 기한 전이면 조건부로 검사 대기로 보내고 기한 후이면 정리한다. 저장 존재만으로 검사 완료를 추정하지 않는다.
2. 완료 UPDATE의 SCANNING·현재 token·버전·해시·정책·lease·만료 조건을 검사한다. 현재 token은 B이므로 A의 결과는 0행이며, ID만으로 재갱신하지 않는다.
3. timeout은 파일 내용 위반의 증거가 아니라 판정 불가다. 남은 시도에서는 재대기하고, 세 번째면 INSPECTION_UNAVAILABLE 사유로 승인을 거절한다. 파일이나 다운로드 URL을 제공하지 않는다.
4. 다운로드 API의 대상 조회에서 인증 소유자·READY·PASSED·현재 시각이 expires_at 전인지 다시 확인한다. 스케줄러는 실제 정리를 진행할 뿐 접근 차단의 유일한 장치가 아니다.
5. 말할 수 없다. 삭제 마커만 생겨 이전 버전이 남을 수 있으므로 정확한 versionId의 제거를 확인한다. 403은 권한 문제이거나 부재 여부를 확인할 권한이 없는 상황일 수 있어 DELETED로 확정하는 근거가 아니다.

</details>
