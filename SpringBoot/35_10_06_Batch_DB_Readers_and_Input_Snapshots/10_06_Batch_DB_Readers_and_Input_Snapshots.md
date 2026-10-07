# Spring Batch DB Reader·안정적인 페이징과 입력 스냅샷

- 🎯 글의 목표: 바뀌는 DB 데이터를 읽을 때 정렬·처리 대상·입력 값·재시작 위치를 구분하고, 불변 스냅샷을 읽는 JDBC Reader를 구성한다.
- 🧩 핵심 키워드: JdbcCursorItemReader, JdbcPagingItemReader, PagingQueryProvider, 고유 정렬 키, pageSize, chunk, ExecutionContext, 입력 스냅샷
- ⭐ 중요도: 높음. 재시작 위치를 저장해도 그 위치가 가리키는 데이터가 달라지면 누락·중복·값 불일치가 생긴다.
- 📝 한눈에 보는 내용: DB 읽기 방식 → OFFSET의 위험 → 고유 키와 재개 → 대상·값 고정 → 스냅샷 발행 → Reader·Step 연결 → 결과 대조·경계 테스트 순서로 이해한다.
- 🔗 관련 주제: [Batch 재시작·체크포인트](../33_10_04_Spring_Batch_and_Restartability/10_04_Spring_Batch_and_Restartability.md), [retry·skip과 결과 검증](../34_10_05_Batch_Retry_Skip_and_Result_Validation/10_05_Batch_Retry_Skip_and_Result_Validation.md), [커서 페이지네이션](../16_09_12_Cursor_Pagination/09_12_Cursor_Pagination.md), [인덱스·실행 계획](../20_09_17_Indexes_and_Execution_Plans/09_17_Indexes_and_Execution_Plans.md)
- 🧱 선수 지식: SELECT·ORDER BY·기본키, JDBC·DataSource, Job·Step·chunk, commit·rollback, ExecutionContext를 이해한다.

> 기준일: 2026-10-06. Spring Boot 4.1.1의 관리 의존성인 Spring Batch 6.0.5·Framework 7.0.9, Java 21, PostgreSQL 17 문서를 기준으로 한다. 아래 Java 파일은 이전 Batch 프로젝트에 추가하며, SQL은 격리된 PostgreSQL 학습 DB용이다. 현재 명령 검색에서 java·javac·Gradle·Maven·psql을 찾지 못했고 저장소에 해당 Boot 빌드 프로젝트가 없어 컴파일·JUnit·DB 실행은 수행하지 않았다. 예상 결과와 문서 정적 검사를 구분한다. [Boot 의존성 표](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)

## 1. 들어가며

이전에는 CSV 입력을 고정한 채 도서 목록을 읽었다. 이제 도서 목록을 DB에서 읽는다면 다른 요청이 도서를 추가·수정·삭제할 수 있다. 첫 페이지를 읽은 뒤 두 번째 페이지를 조회하기 전에 데이터가 바뀌면, 같은 정렬 조건이라도 읽을 위치나 값이 달라진다.

예를 들어 “아직 처리하지 않은 도서”를 세 건씩 읽고 처리한 도서는 조건에서 제외한다고 해 보자. 다음 조회를 `OFFSET 3`으로 실행하면 이미 사라진 세 건을 다시 건너뛰는 셈이 되어, 원래 네 번째부터 여섯 번째였던 항목까지 놓칠 수 있다. 이는 재시작 실패가 아니라 정상 실행 중에도 생기는 입력 변화 문제다.

이번 노트의 질문은 **무엇을 어떤 순서로 읽고, 실패 후에도 같은 입력을 어떻게 이어 읽는가**다. 앞선 retry·skip 정책을 반복 설명하지 않고, 그 정책이 대상으로 삼는 입력을 안정화하는 데 집중한다. 학습 예제는 도서 값 전체를 별도 테이블에 복사해 보존한 뒤 그 스냅샷을 단일 스레드로 읽는다.

## 2. 핵심 개념 정리

```text
변경 가능한 원본 DB
  → 대상 행과 필요한 값을 한 번 복사
  → 스냅샷 ID·건수와 함께 준비 완료로 발행
  → 스냅샷 ID로 범위를 고정하고 고유 키로 페이징
  → chunk 결과·Reader 상태 확정
  → 실패 시 같은 스냅샷·같은 업무로 재개
  → 입력·반영·제외 결과 대조
```

| 구분할 질문 | 관련 절 |
| --- | --- |
| DB 커서와 페이징 Reader는 어떻게 다른가? | 3.1 |
| 안정적인 정렬이 있어도 OFFSET은 왜 위험한가? | 3.2 |
| 페이징 Reader는 어떤 정보로 다시 읽는가? | 3.3 |
| 범위 제한과 입력 값 보존은 어떻게 다른가? | 3.4 |
| 준비 완료 입력은 어떻게 만들고 읽는가? | 3.5~3.6 |
| 기존 Writer·새 Job과 어떻게 연결하는가? | 3.7 |
| 결과와 재시작 경계는 어떻게 확인하는가? | 3.8~3.9 |

## 3. 본문 정리

### 3.1 커서 Reader와 페이징 Reader는 자원을 사용하는 방식이 다르다

**DB 커서는 조회 결과에서 현재 위치를 유지하며 다음 행으로 이동하는 읽기 방식**이다. `JdbcCursorItemReader`는 JDBC의 ResultSet을 열고 `read()`마다 다음 행을 객체로 바꾼다. 전체 결과를 Java List에 먼저 담지 않고 순차적으로 읽을 수 있지만, 실행 동안 연결·커서 자원을 유지하는 비용을 고려해야 한다.

기본 설정의 커서 Reader는 Step 처리 트랜잭션과 별도의 연결을 사용한다. 따라서 “chunk가 commit하면 Reader의 커서도 같은 트랜잭션으로 확정된다”고 단정하지 않는다. 실제 보이는 데이터와 재시작 동작은 DB·드라이버·연결 설정의 계약을 함께 확인한다. [JdbcCursorItemReader API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/JdbcCursorItemReader.html)

**페이징 Reader는 필요한 행 묶음을 여러 번 조회하는 방식**이다. `JdbcPagingItemReader`는 내부에서 페이지를 조회하지만, 호출자에게는 마찬가지로 `read()` 한 번에 항목 하나를 반환한다. DB마다 SQL 형태가 다르므로 `PagingQueryProvider`가 페이지 조회문을 만든다. [공식 DB Reader 설명](https://docs.spring.io/spring-batch/reference/readers-and-writers/database.html)

| 방식 | 실행 중 관리하는 것 | 확인할 비용 |
| --- | --- | --- |
| 커서 | 열린 조회 결과와 연결, 읽기 위치 | 연결 유지 시간·드라이버 전송·재개 지원 |
| 페이징 | 현재 페이지의 객체와 다음 조회 경계 | 반복 SQL·인덱스·페이지 크기·변경된 입력 |

어느 방식도 이름만으로 “같은 입력이 영구 보존된다”는 뜻은 아니다. 이번 예제는 짧은 페이지 SQL과 체크포인트를 관찰하기 위해 JDBC 페이징을 선택한다.

### 3.2 ORDER BY는 순서를 정하지만 OFFSET의 변화까지 막지는 않는다

**OFFSET은 정렬된 조회 결과의 앞에서 지정한 수만큼 건너뛰는 조건**이다. `ORDER BY`가 없거나 동점 순서를 결정하지 않으면 페이지 결과 자체가 불안정하다. 고유한 순서를 만들더라도 앞부분이 삭제되거나 조회 조건에서 빠지면 OFFSET의 대상이 이동한다. [PostgreSQL LIMIT·OFFSET](https://www.postgresql.org/docs/17/queries-limit.html)

아래는 문제를 설명하는 **조회 일부 코드**다. `catalog_source`의 전체 준비 SQL은 3.5에 제시한다. 아직 처리하지 않은 행을 `processed = false`로 조회한다고 가정한다.

```sql
-- 첫 조회 결과가 ID 1·2·3이라고 가정한다.
SELECT id, book_id, title, stock
FROM catalog_source
WHERE processed = false -- 읽을 때마다 달라질 수 있는 조건이다.
ORDER BY id             -- 순서를 정했지만 대상 집합을 고정하지는 않는다.
LIMIT 3 OFFSET 0;       -- 앞의 세 행을 읽는다.

-- 별도 처리 트랜잭션에서 1·2·3의 processed가 true로 바뀐 뒤 조회한다.
SELECT id, book_id, title, stock
FROM catalog_source
WHERE processed = false -- 이제 후보는 4·5·6·7뿐이다.
ORDER BY id
LIMIT 3 OFFSET 3;       -- 4·5·6을 건너뛰어 7만 읽게 된다.
```

예상 입력 1~7 중 4~6을 놓친다. 이 예시는 Reader 구현 전체가 아니라 OFFSET과 변경 가능한 조건의 관계를 보여 준다. `JdbcPagingItemReader`까지 단순히 페이지 번호를 OFFSET으로 바꾸는 구현이라고 일반화해서는 안 된다.

⚠️ 주의: 단순한 조회 순서 오류와 입력 변경 오류는 별개다. `ORDER BY id`를 추가한 뒤에도 조회 후보가 줄어드는 시나리오를 따로 시험한다.

### 3.3 고유 정렬 키와 저장된 상태를 함께 사용한다

**정렬 키는 다음 구간을 정하는 값**이다. JDBC 페이징 Reader는 재시작에 저장한 정렬 키를 활용한다. 공식 API는 정렬 키의 유일 제약을 요구하며, 성공 처리한 항목이 제거·변경된 경우에도 정렬 키로 재개할 수 있음을 설명한다. 이는 아직 읽지 않은 행이나 모든 값의 일관성까지 보장한다는 뜻이 아니다. [JdbcPagingItemReader API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/JdbcPagingItemReader.html)

이번 예제의 조회 경계는 다음과 같이 이해할 수 있다. 이는 DB별 provider가 생성하는 SQL 원문을 그대로 복사한 것이 아니라 **키 경계를 보여 주는 SQL**이다.

```sql
-- 동일한 입력 안에서 마지막 키가 3이었다면 그보다 큰 구간을 읽는다.
SELECT item_id, book_id, title, stock
FROM catalog_input_snapshot
WHERE snapshot_id = 'catalog-db-v1' -- 이번 업무의 대상 집합을 고정한다.
  AND item_id > 3                  -- 다음 구간의 경계를 마지막 키로 잡는다.
ORDER BY item_id ASC               -- 범위 안에서 유일하고 바뀌지 않는 키다.
LIMIT 3;                          -- pageSize 3의 설명용 조회다.
```

`snapshot_id`로 한 입력을 제한하고, 그 안에서 `item_id`를 유일하게 만든다. 수량이나 수정 시각처럼 바뀌는 값만 정렬 키로 쓰면 항목이 경계 앞뒤로 움직일 수 있다. 복합 정렬이 필요하면 마지막 동점까지 해소하는 고유 키와 provider의 키 순서를 함께 관리한다.

재개 상태를 “마지막 읽은 ID 하나”로만 구현했다고 가정하는 것도 부정확하다. Batch 6.0.5 구현은 읽은 개수와 페이지 경계의 정렬 값을 사용하고, 페이지 중간에서 확정한 경우 해당 페이지의 재개 위치도 고려한다. 따라서 내부 context 키를 직접 덮어쓰지 않고 `open`·`update` 생명주기를 사용한다. [6.0.5 Reader 구현](https://github.com/spring-projects/spring-batch/blob/v6.0.5/spring-batch-infrastructure/src/main/java/org/springframework/batch/infrastructure/item/database/JdbcPagingItemReader.java)

여기서 **pageSize는 한 조회의 행 수**, **chunk 크기는 처리 결과를 commit하는 묶음 수**, **fetchSize는 JDBC 드라이버에 전달하는 전송 힌트**다. 세 값은 같은 개념이 아니다. 예제는 pageSize와 chunk를 모두 3으로 맞춰 관찰하기 쉽게 만들지만, 실제 값은 메모리·SQL 비용·실패 재처리량을 측정해 고른다. [Reader builder API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/builder/JdbcPagingItemReaderBuilder.html)

### 3.4 처리 대상 고정과 입력 값 고정은 별도 요구다

**입력 스냅샷은 이번 업무가 읽을 대상과 필요한 값을 특정 버전으로 보존한 데이터**다. 마지막 ID만 저장하는 체크포인트는 위치 정보이며 입력 보존과 다르다. 다음 선택지를 비교하면 요구를 나누기 쉽다.

| 선택 | 제한하는 것 | 여전히 달라질 수 있는 것 |
| --- | --- | --- |
| 시작 시 최대 ID를 구해 `id <= 상한`으로 조회 | 그 상한보다 큰 ID | 기존 행의 삭제·수정·늦은 commit |
| 대상 ID 목록만 복사 | 처리 대상의 식별자 목록 | 원본에서 다시 읽는 제목·수량 |
| 대상 ID와 필요한 값을 복사 | 대상과 복사된 입력 값 | 복사하지 않은 연관 데이터·외부 조회 값 |

예를 들어 ID 4를 대상 목록에 남겨도 원본 수량이 9에서 1로 바뀌면 재시작 결과가 달라진다. 반면 ID·제목·수량을 함께 복사하면 재시작 시 복사된 수량 9를 다시 읽는다. 이번 도서 가져오기는 이 세 필드가 업무 입력의 전부라는 조건으로 세 번째 방식을 선택한다.

PostgreSQL의 기본 Read Committed에서는 각 조회문이 시작할 때 보이는 확정 데이터를 읽는다. 서로 다른 페이지 SQL이 반드시 같은 시점의 데이터를 보는 것은 아니다. 같은 트랜잭션의 일관된 DB 조회와, 프로세스가 종료된 뒤에도 남는 복사 테이블은 서로 다른 범위다. [PostgreSQL 트랜잭션 격리](https://www.postgresql.org/docs/17/transaction-iso.html)

큰 트랜잭션을 오래 유지하면 자원 비용이 커지고, 프로세스 재시작 후 그 트랜잭션을 그대로 복원할 수도 없다. 이번 예제는 입력을 한 번 복사·commit한 뒤 짧은 chunk로 처리한다. 여러 테이블을 여러 SQL로 복사한다면 그 SQL들 사이의 일관성도 별도로 설계해야 한다.

⚠️ 주의: 증가하는 ID는 commit 순서를 보장하는 시각 값이 아니다. 최대 ID를 상한으로 잡았다는 이유만으로 그 이하의 모든 행이 조회 시점에 확정되어 있었다고 결론내리지 않는다.

### 3.5 스냅샷을 원자적으로 준비하고 준비 완료만 발행한다

**발행은 Reader가 사용할 수 있는 완성된 입력 버전으로 공개하는 것**이다. 일부만 복사된 테이블을 Reader가 읽지 않도록 입력 행과 준비 완료 표식을 한 트랜잭션으로 commit한다. 다음은 이전 `catalog_import`와 Batch JDBC 메타데이터가 준비된 **별도 PostgreSQL 학습 DB에서 한 번 실행하는 추가 스키마·입력 SQL**이다. 기존 테이블을 삭제하거나 재생성하는 명령이 아니다.

```sql
-- 변경 가능한 원본이다. 운영 테이블이 아니라 학습용으로 새로 만든다.
CREATE TABLE catalog_source (
    id bigint PRIMARY KEY,                  -- 읽기 순서를 설명할 고유한 원본 키다.
    book_id varchar(30) NOT NULL UNIQUE,     -- 도서의 업무 식별자다.
    title varchar(200) NOT NULL,             -- 스냅샷에 복사할 제목이다.
    stock integer NOT NULL,                  -- 검증 전 입력이므로 여기서는 음수도 표현할 수 있다.
    processed boolean NOT NULL DEFAULT false -- 3.2의 대상 변화 예시에 사용하는 필드다.
);

-- 스냅샷의 존재·발행 여부·입력 건수를 기록하는 작은 명세 테이블이다.
CREATE TABLE catalog_snapshot_manifest (
    snapshot_id varchar(100) PRIMARY KEY,      -- 재시작에도 유지할 입력 버전이다.
    ready boolean NOT NULL DEFAULT false,     -- 복사가 끝나기 전에는 읽지 않는다.
    item_count bigint NOT NULL CHECK (item_count >= 0) -- 발행한 입력 건수다.
);

-- 원본과 독립적으로 필요한 값을 보존한다.
CREATE TABLE catalog_input_snapshot (
    snapshot_id varchar(100) NOT NULL REFERENCES catalog_snapshot_manifest(snapshot_id),
    item_id bigint NOT NULL,                 -- 범위 안에서 고유한 페이징 키다.
    book_id varchar(30) NOT NULL,             -- 업무 결과와 대조할 도서 ID다.
    title varchar(200) NOT NULL,              -- 원본을 재조회하지 않을 복사된 값이다.
    stock integer NOT NULL,                  -- Processor의 입력 검증은 유지한다.
    PRIMARY KEY (snapshot_id, item_id),       -- 고정 범위·정렬을 함께 지원한다.
    UNIQUE (snapshot_id, book_id)             -- 같은 원본 안의 중복 도서도 막는다.
);

-- 예제의 입력 7건이며, 이 데이터를 대상으로 첫 스냅샷을 만든다.
INSERT INTO catalog_source (id, book_id, title, stock) VALUES
    (1, 'B001', 'Java 입문', 12),
    (2, 'B002', '웹의 동작 원리', 7),
    (3, 'B003', 'SQL 첫걸음', 5),
    (4, 'B004', '트랜잭션 이해', 9),
    (5, 'B005', '자료구조 연습', 4),
    (6, 'B006', '테스트 설계', 8),
    (7, 'B007', '네트워크 기초', 6);
```

원본 키와 업무 식별자를 나누었고 스냅샷에는 필요한 값을 모두 복사할 준비를 했다. 기본키·유일 제약은 중복을 막지만 **준비 완료 뒤 UPDATE·DELETE를 막아 주지는 않는다**. 실제 운영에서는 발행 후 수정 금지와 처리 계정의 읽기 전용 권한·보존 기간을 따로 적용해야 한다. 이 SQL에는 그 권한·삭제 방지 기능을 구현하지 않았다.

아래는 같은 DB에서 한 번 실행하는 **스냅샷 생성 트랜잭션**이다. 이미 있는 ID로 다시 실행하면 실패하도록 했으며, 기존 입력을 덮어쓰는 upsert는 사용하지 않는다.

```sql
BEGIN; -- 입력 행과 준비 완료 표식을 하나의 commit으로 공개한다.

INSERT INTO catalog_snapshot_manifest (snapshot_id, ready, item_count)
VALUES ('catalog-db-v1', false, 0); -- 아직 Reader에 제공하지 않는 새 버전이다.

INSERT INTO catalog_input_snapshot (snapshot_id, item_id, book_id, title, stock)
SELECT 'catalog-db-v1', id, book_id, title, stock
FROM catalog_source
WHERE processed = false; -- 이 한 SQL이 볼 수 있는 대상과 값을 함께 복사한다.

UPDATE catalog_snapshot_manifest
SET item_count = (SELECT count(*) FROM catalog_input_snapshot
                  WHERE snapshot_id = 'catalog-db-v1'), -- 복사된 실제 행을 센다.
    ready = true -- 모든 복사가 끝났음을 표시한다.
WHERE snapshot_id = 'catalog-db-v1';

COMMIT; -- 이 commit이 성공한 다음에만 Job을 시작한다.
```

`INSERT ... SELECT`는 조회 결과를 입력으로 삽입한다. 위 복사는 하나의 원본 조회문이 보이는 값을 보존한다. 다른 트랜잭션에서 아직 commit하지 않은 변경까지 포함한다는 뜻은 아니다. 생성 중 오류가 나면 전체 rollback하고 새 버전의 발행 여부를 확인한 뒤 복구한다. [PostgreSQL INSERT](https://www.postgresql.org/docs/17/sql-insert.html)

예상 발행 건수는 7이다. 그 뒤 원본 B004의 수량이 바뀌어도 이 스냅샷의 B004 수량은 9로 남아야 한다. 새로운 원본으로 작업하려면 새 스냅샷 ID를 발행하고 이전 업무 결과와의 교체·보충 정책을 정한다.

### 3.6 스냅샷 ID와 고유 키를 JDBC Reader에 연결한다

다음은 `src/main/java/com/example/batch/SnapshotBatchConfiguration.java`에 추가하는 파일의 구성이다. 이전 노트의 `Book` record·`CatalogProcessor`·`catalogWriter`·단일 `JdbcTransactionManager`·JDBC JobRepository를 유지한다. 전체 파일은 아래 Reader 부분과 3.7의 Step·Job 부분을 **한 클래스 안에 이어 붙여** 완성한다. Batch 5의 item 패키지와 혼용하지 않는다.

입력 값은 Step 실행 시 연결한다. `@StepScope`를 Reader에 두고 반환 타입도 `JdbcPagingItemReader`로 유지해 ItemStream 생명주기를 드러낸다. [late binding·Step scope](https://docs.spring.io/spring-batch/reference/step/late-binding.html)

```java
package com.example.batch; // 기존 Batch 설정의 컴포넌트 스캔 범위에 둔다.

import java.util.Map; // SQL 파라미터와 정렬 키를 이름으로 연결한다.
import java.util.Objects; // 값 비교와 필수 객체 검사를 수행한다.
import javax.sql.DataSource; // 기존 JDBC 설정과 같은 DB 자원이다.
import com.example.batch.CatalogBatchConfiguration.Book; // 앞선 노트의 입력 record를 재사용한다.
import org.springframework.batch.core.configuration.annotation.StepScope; // 실행별 파라미터를 읽는다.
import org.springframework.batch.core.job.Job; // 이번 DB 적재의 작업 설계도다.
import org.springframework.batch.core.job.builder.JobBuilder; // Job을 구성한다.
import org.springframework.batch.core.job.parameters.DefaultJobParametersValidator; // 필수 키를 검사한다.
import org.springframework.batch.core.repository.JobRepository; // 체크포인트와 실행 이력을 보존한다.
import org.springframework.batch.core.step.Step; // 적재 단계의 타입이다.
import org.springframework.batch.core.step.builder.ChunkOrientedStepBuilder; // Batch 6의 chunk 단계를 만든다.
import org.springframework.batch.infrastructure.item.database.JdbcBatchItemWriter; // 기존 Writer의 타입이다.
import org.springframework.batch.infrastructure.item.database.JdbcPagingItemReader; // 이번 입력 Reader의 타입이다.
import org.springframework.batch.infrastructure.item.database.Order; // SQL 정렬 방향을 명시한다.
import org.springframework.batch.infrastructure.item.database.builder.JdbcPagingItemReaderBuilder;
import org.springframework.batch.infrastructure.item.database.support.SqlPagingQueryProviderFactoryBean;
import org.springframework.beans.factory.annotation.Qualifier; // 기존 Bean을 이름으로 선택한다.
import org.springframework.beans.factory.annotation.Value; // 실행 파라미터를 주입받는다.
import org.springframework.context.annotation.Bean; // 각 구성 요소를 등록한다.
import org.springframework.context.annotation.Configuration; // Spring 설정 클래스다.
import org.springframework.jdbc.core.JdbcTemplate; // 스냅샷 준비 완료 표식을 확인한다.
import org.springframework.jdbc.support.JdbcTransactionManager; // 기존 chunk 트랜잭션을 사용한다.

@Configuration(proxyBeanMethods = false) // 구성 요소는 Bean 메서드 직접 호출 대신 주입받는다.
public class SnapshotBatchConfiguration {
    @Bean
    @StepScope // Job 시작 시 전달한 입력 버전으로 실행별 Reader를 만든다.
    public JdbcPagingItemReader<Book> snapshotCatalogReader(
            DataSource dataSource,
            @Value("#{jobParameters['snapshotId']}") String snapshotId,
            @Value("#{jobParameters['sourceRevision']}") String sourceRevision) throws Exception {
        if (!Objects.equals(snapshotId, sourceRevision)) { // 기존 Writer의 결과 버전과 입력 버전을 맞춘다.
            throw new IllegalArgumentException("snapshotId와 sourceRevision은 같아야 합니다.");
        }
        return createReader(dataSource, snapshotId); // 테스트도 같은 구성 팩터리를 사용한다.
    }

    public static JdbcPagingItemReader<Book> createReader(DataSource dataSource, String snapshotId)
            throws Exception {
        if (snapshotId == null || snapshotId.isBlank() || snapshotId.length() > 100) {
            throw new IllegalArgumentException("유효한 스냅샷 ID가 필요합니다."); // 빈 범위 조회를 막는다.
        }
        Boolean ready = new JdbcTemplate(dataSource).queryForObject(
                "SELECT ready FROM catalog_snapshot_manifest WHERE snapshot_id = ?",
                Boolean.class, snapshotId); // 값 바인딩으로 준비 완료된 입력인지 확인한다.
        if (!Boolean.TRUE.equals(ready)) {
            throw new IllegalStateException("아직 발행하지 않은 스냅샷입니다."); // 미완성 입력은 처리하지 않는다.
        }
        var providerFactory = new SqlPagingQueryProviderFactoryBean(); // DB 종류에 맞는 SQL 생성기를 준비한다.
        providerFactory.setDataSource(dataSource); // JDBC 메타데이터로 DB 종류를 판별할 수 있게 한다.
        providerFactory.setSelectClause("SELECT item_id, book_id, title, stock"); // 정렬 키도 결과에 포함한다.
        providerFactory.setFromClause("FROM catalog_input_snapshot"); // 변경 가능한 원본은 읽지 않는다.
        providerFactory.setWhereClause("WHERE snapshot_id = :snapshotId"); // 이번 입력 버전으로 범위를 고정한다.
        providerFactory.setSortKeys(Map.of("item_id", Order.ASCENDING)); // 고정 범위 안에서 유일한 순서다.
        return new JdbcPagingItemReaderBuilder<Book>()
                .name("snapshotCatalogReader") // 재시작에서 같은 context 키를 사용한다.
                .dataSource(dataSource) // 같은 PostgreSQL DB를 조회한다.
                .queryProvider(Objects.requireNonNull(providerFactory.getObject())) // DB별 페이지 SQL을 사용한다.
                .parameterValues(Map.of("snapshotId", snapshotId)) // named parameter와 같은 이름을 사용한다.
                .pageSize(3) // 한 번에 세 행을 조회하는 학습 값이다.
                .saveState(true) // 읽기 진행 정보를 재시작에 사용한다.
                .rowMapper((rs, rowNumber) -> new Book(
                        rs.getString("book_id"), // 업무 결과에 사용할 도서 ID다.
                        rs.getString("title"), // 스냅샷에서 보존한 제목이다.
                        rs.getInt("stock"))) // 스냅샷에서 보존한 수량이다.
                .build(); // Bean 생명주기가 초기화와 open·update·close를 연결한다.
    }
    // 3.7의 Step·Job 메서드를 여기에 이어 넣고 클래스의 닫는 중괄호를 추가한다.
```

provider는 DB별 페이지 SQL을 생성하고, RowMapper는 조회 행을 `Book`으로 바꾼다. Book에 itemId를 담지 않아도 정렬 키를 SELECT에 포함해야 Reader가 재개 값을 읽을 수 있다. 존재하지 않는 스냅샷이면 준비 여부 조회부터 실패한다. 준비 완료인 빈 스냅샷은 이 예제에서 허용하지만, 업무가 빈 입력을 거부해야 한다면 manifest 건수 검사도 추가한다. [QueryProvider 팩터리 API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/support/SqlPagingQueryProviderFactoryBean.html)

⚠️ 주의: ready 확인은 입력 존재·발행 상태 검사이지 불변성을 강제하는 잠금이 아니다. 실행 중 해당 스냅샷을 수정·삭제하지 않는 운영 규칙이 필요하다. 상태 저장을 끄거나 한 Reader를 여러 스레드가 공유하는 구성은 이번 단일 스레드 재시작 예제와 다르다.

### 3.7 새 Step·Job으로 연결해 기존 실패 실행과 섞지 않는다

다음은 위 클래스에 이어 넣는 나머지 부분이다. 기존 CSV Job과 다른 이름을 사용하므로, 실패한 CSV 업무의 Reader를 DB Reader로 바꿔 재시작하지 않는다. 이번에는 입력 안정성만 확인하기 위해 retry·skip·병렬 처리를 켜지 않으며 검증 오류는 Step을 실패시킨다.

```java
    @Bean
    public Step snapshotImportStep(
            JobRepository jobRepository,
            JdbcTransactionManager transactionManager,
            @Qualifier("snapshotCatalogReader") JdbcPagingItemReader<Book> reader,
            @Qualifier("catalogWriter") JdbcBatchItemWriter<Book> writer) {
        return new ChunkOrientedStepBuilder<Book, Book>("snapshotImportStep", jobRepository, 3)
                .transactionManager(transactionManager) // 결과와 진행 상태를 앞선 단일 DB 경계에서 확정한다.
                .reader(reader) // Reader의 ItemStream 생명주기도 연결한다.
                .processor(new CatalogProcessor()) // 이전에 만든 필드 검증기를 재사용한다.
                .writer(writer) // businessDate·sourceRevision별 기존 결과 테이블에 저장한다.
                .build(); // read·process·write 뒤 묶음을 commit한다.
    }

    @Bean
    public Job snapshotImportJob(JobRepository jobRepository,
            @Qualifier("snapshotImportStep") Step step) {
        String[] required = {"businessDate", "sourceRevision", "snapshotId"}; // 파일 경로는 받지 않는다.
        return new JobBuilder("snapshotImportJob", jobRepository) // CSV 업무와 분리한 안정적인 이름이다.
                .validator(new DefaultJobParametersValidator(required, new String[0])) // 필수 입력 키를 확인한다.
                .start(step) // 스냅샷 적재 단계를 연결한다.
                .build(); // 다음 시도에도 Job·Step·Reader 이름을 유지한다.
    }
} // SnapshotBatchConfiguration의 끝이다.
```

Step builder는 Reader를 직접 받아 생명주기에 연결한다. 만약 Reader를 별도 래퍼로 숨기면 내부 ItemStream의 등록 여부를 다시 확인해야 한다. [ChunkOrientedStepBuilder API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/ChunkOrientedStepBuilder.html)

실행 호출부는 이전 파일용 `CatalogImportService.start(...)`를 그대로 사용할 수 없다. 그 메서드는 파일 경로를 검사하고 CSV Job을 선택한다. 아래는 **보호된 운영 호출부 또는 통합 테스트 안에서 사용하는 일부 코드**다. `operator`는 주입받은 `JobOperator`, `snapshotJob`은 `@Qualifier("snapshotImportJob")`로 선택한 `Job`이며 `JobParametersBuilder` import는 `org.springframework.batch.core.job.parameters` 패키지를 사용한다. HTTP API·권한 확인·완료 대기는 별도 구현 범위다.

```java
var parameters = new JobParametersBuilder()
        .addString("businessDate", "2026-10-06", true) // 결과 테이블의 업무 날짜다.
        .addString("sourceRevision", "catalog-db-v1", true) // 기존 Writer에 전달하는 입력 버전이다.
        .addString("snapshotId", "catalog-db-v1", true) // 실제로 읽는 스냅샷도 같은 식별 값이다.
        .toJobParameters(); // 모두 실행 시각이 아닌 업무 식별 값으로 둔다.
var execution = operator.start(snapshotJob, parameters); // 반환된 이력의 완료 상태는 별도로 확인한다.
```

같은 업무가 실패하면 저장소의 해당 실행 이력으로 restart한다. 같은 snapshotId의 내용을 다시 복사하거나 실행 시각을 식별 파라미터에 추가해 새로운 Instance로 우회하지 않는다. 새 업무로 실행하면 이미 확정한 결과와 충돌할 수 있다. 스냅샷·Batch 메타데이터·결과가 모두 남아 있어야 프로세스 재시작 복구를 시험할 수 있다.

### 3.8 처리 수와 실제 입력·결과를 대조한다

정상 입력 7건을 skip·filter 없이 처음부터 한 번 처리하면 결과 7행을 기대한다. 실패 후 재시작했다면 마지막 Execution의 writeCount는 전체 7이 아닐 수 있으므로, 다음 SQL은 **Job 완료 후 별도 학습 DB 세션**에서 업무 결과를 확인한다.

```sql
-- 발행한 입력과 현재 보존 행 수를 비교한다.
SELECT m.snapshot_id, m.item_count, count(s.item_id) AS retained_count
FROM catalog_snapshot_manifest m
LEFT JOIN catalog_input_snapshot s ON s.snapshot_id = m.snapshot_id
WHERE m.snapshot_id = 'catalog-db-v1'
GROUP BY m.snapshot_id, m.item_count; -- 이번 정상 입력은 두 건수가 모두 7이어야 한다.

-- 반영되지 않았거나 입력 값과 다른 결과를 찾는다.
SELECT s.book_id, s.stock AS input_stock, r.stock AS stored_stock
FROM catalog_input_snapshot s
LEFT JOIN catalog_import r
  ON r.business_date = DATE '2026-10-06' -- 한 업무의 결과만 비교한다.
 AND r.source_revision = s.snapshot_id
 AND r.book_id = s.book_id
WHERE s.snapshot_id = 'catalog-db-v1'
  AND (r.book_id IS NULL OR r.stock IS DISTINCT FROM s.stock
       OR r.title IS DISTINCT FROM trim(s.title)); -- 예제의 일반 공백 입력에 대한 제목 정리를 비교한다.
```

예상 두 번째 조회 결과는 0행이다. 반대 방향으로 결과 테이블에 입력에는 없는 도서가 추가됐는지도 별도로 검사해야 한다. 건수만 같다고 ID와 값이 같은 것은 아니다. SQL의 기본 trim과 Java의 strip이 모든 종류의 공백에서 같은 규칙이라고 가정하지 않으며, 위 대조는 예제의 일반 공백 입력을 전제로 한다. 실제 문자 정리 규칙을 확장하면 대조 규칙도 그에 맞게 변경한다.

스냅샷을 보존하면 저장 공간과 민감 정보 복제 비용도 늘어난다. 어떤 값을 복사할지, 누가 읽을지, 완료·실패 업무의 입력을 언제 삭제할지 정한다. 재시작 가능한 실행이 남아 있는데 입력만 먼저 삭제하면 체크포인트가 있어도 복구할 수 없다.

### 3.9 Reader 재개 테스트와 실제 chunk 복구 테스트를 나눈다

아래는 `src/test/java/com/example/batch/SnapshotReaderTest.java`에 추가하는 **JUnit 통합 테스트 파일**이다. Java 21·기존 Boot 테스트 의존성·PostgreSQL 드라이버와 3.5의 두 스냅샷 테이블이 필요하다. 테스트는 UUID로 자기 입력을 만들고 마지막에 그 ID의 행만 정리한다. 반드시 격리된 학습·테스트 DB를 사용한다.

환경 변수 `BATCH_TEST_DB_URL`, `BATCH_TEST_DB_USER`, `BATCH_TEST_DB_PASSWORD`를 로컬에 설정한다. 값은 저장소에 기록하지 않는다. 이 테스트는 실제 PostgreSQL Reader를 실행하지만, 체크포인트를 메모리로 복사하므로 JobRepository의 commit·프로세스 재시작·Writer rollback을 검증하지 않는다. `ExecutionContext` 복사 생성자는 이전 내용으로 새 context를 만든다. [ExecutionContext API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/ExecutionContext.html)

```java
package com.example.batch; // 같은 Reader 구성 팩터리를 사용한다.

import java.util.ArrayList; // 재개 후 읽은 도서 ID를 모은다.
import java.util.List; // 기대 순서를 표현한다.
import java.util.Objects; // 테스트 DB 설정 누락을 즉시 알린다.
import java.util.UUID; // 다른 실행과 충돌하지 않는 테스트 입력 ID를 만든다.
import com.example.batch.CatalogBatchConfiguration.Book; // Reader의 반환 record다.
import org.junit.jupiter.api.Test;
import org.springframework.batch.infrastructure.item.ExecutionContext; // Reader의 진행 상태를 전달한다.
import org.springframework.jdbc.core.JdbcTemplate; // 자기 입력을 준비·정리한다.
import org.springframework.jdbc.datasource.DriverManagerDataSource; // 테스트에서만 단순 연결을 사용한다.
import org.springframework.jdbc.support.JdbcTransactionManager; // fixture를 한 번에 발행한다.
import org.springframework.transaction.support.TransactionTemplate; // 준비 단계의 commit을 명시한다.
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SnapshotReaderTest {
    @Test
    void resumesFromSavedPageBoundaryRatherThanLastUnsavedRead() throws Exception {
        var dataSource = new DriverManagerDataSource(); // 풀 없이 테스트 연결을 얻는다.
        dataSource.setUrl(requiredEnv("BATCH_TEST_DB_URL")); // 반드시 격리된 PostgreSQL DB를 지정한다.
        dataSource.setUsername(requiredEnv("BATCH_TEST_DB_USER")); // 테스트 DB 계정이다.
        dataSource.setPassword(requiredEnv("BATCH_TEST_DB_PASSWORD")); // 비밀값을 코드에 넣지 않는다.
        var jdbc = new JdbcTemplate(dataSource);
        String snapshotId = "test-" + UUID.randomUUID(); // 이 테스트만 정리할 입력 키다.
        try {
            new TransactionTemplate(new JdbcTransactionManager(dataSource)).executeWithoutResult(status -> {
                jdbc.update("INSERT INTO catalog_snapshot_manifest VALUES (?, false, 0)", snapshotId);
                for (int id = 1; id <= 7; id++) { // 테스트 입력 7건을 복사된 값 형태로 준비한다.
                    jdbc.update("INSERT INTO catalog_input_snapshot VALUES (?, ?, ?, ?, ?)",
                            snapshotId, id, "B%03d".formatted(id), "도서 " + id, id);
                }
                jdbc.update("UPDATE catalog_snapshot_manifest SET ready = true, item_count = 7 "
                        + "WHERE snapshot_id = ?", snapshotId); // 준비 완료와 입력을 함께 확정한다.
            });
            var checkpoint = new ExecutionContext(); // 처음에는 저장한 위치가 없다.
            var first = SnapshotBatchConfiguration.createReader(dataSource, snapshotId);
            first.afterPropertiesSet(); // 직접 생성했으므로 Spring 대신 초기화 계약을 호출한다.
            first.open(checkpoint); // 빈 진행 상태로 Reader를 연다.
            try {
                for (int id = 1; id <= 3; id++) {
                    Book book = first.read(); // 첫 페이지 세 항목을 순서대로 읽는다.
                    assertNotNull(book);
                    assertEquals("B%03d".formatted(id), book.bookId()); // 고유 키 순서를 확인한다.
                }
                first.update(checkpoint); // 세 건 확정 위치를 저장한 상황을 모사한다.
                Book unsaved = first.read(); // 다음 페이지 첫 항목을 읽되 상태는 갱신하지 않는다.
                assertNotNull(unsaved);
                assertEquals("B004", unsaved.bookId()); // 읽은 위치가 확정 위치보다 앞서 나갔다.
            } finally {
                first.close(); // 읽기 종료가 새 체크포인트의 commit을 뜻하지는 않는다.
            }
            var restarted = SnapshotBatchConfiguration.createReader(dataSource, snapshotId);
            restarted.afterPropertiesSet(); // 새 Reader 객체를 초기화한다.
            restarted.open(new ExecutionContext(checkpoint)); // 저장한 세 건의 상태만 전달한다.
            try {
                var ids = new ArrayList<String>();
                Book book;
                while ((book = restarted.read()) != null) { // null은 입력 끝을 나타낸다.
                    ids.add(book.bookId()); // 재개 후 항목을 기록한다.
                }
                assertEquals(List.of("B004", "B005", "B006", "B007"), ids);
                // 미확정 B004를 건너뛰지 않고 다시 읽는지 확인한다.
            } finally {
                restarted.close(); // 재개 Reader의 생명주기도 정리한다.
            }
            jdbc.update("UPDATE catalog_snapshot_manifest SET ready = false WHERE snapshot_id = ?", snapshotId);
            assertThrows(IllegalStateException.class,
                    () -> SnapshotBatchConfiguration.createReader(dataSource, snapshotId));
            // 자신의 fixture만 미발행 상태로 바꿔 준비 완료 검사를 확인한다.
        } finally {
            jdbc.update("DELETE FROM catalog_input_snapshot WHERE snapshot_id = ?", snapshotId);
            jdbc.update("DELETE FROM catalog_snapshot_manifest WHERE snapshot_id = ?", snapshotId);
            // 외래키 순서대로 이 테스트의 UUID 입력만 정리하며 다른 입력을 지우지 않는다.
        }
    }

    private static String requiredEnv(String name) {
        return Objects.requireNonNull(System.getenv(name), name + " 환경 변수가 필요합니다.");
        // 설정 누락을 테스트 성공·자동 건너뛰기로 숨기지 않는다.
    }
}
```

기존 Java 프로젝트 루트의 PowerShell에서 `./gradlew.bat test --tests com.example.batch.SnapshotReaderTest`를 실행한다. 예상 결과는 이 테스트의 통과다. TIL 루트에서 실행하는 명령이 아니며, 이번 작성 환경에서는 실행하지 않았다.

실제 Step에서는 `update(context)`와 업무 결과를 트랜잭션으로 확정한다. Reader 테스트의 메모리 상태 저장이 이 commit까지 대신하는 것은 아니다. [ItemStream 생명주기](https://docs.spring.io/spring-batch/reference/readers-and-writers/item-stream.html)

| 추가 통합 시험 | 예상 관찰 | 확인할 범위 |
| --- | --- | --- |
| 정상 입력 7건으로 새 업무 실행 | 7행 저장, 입력·결과 대조 차이 없음 | Reader·Processor·Writer 연결 |
| 첫 chunk commit 후 두 번째 Writer에서 예외 | 앞 3행 유지, 실패 chunk 결과 없음 | 결과·체크포인트 확정 경계 |
| 같은 실패 실행 restart | 나머지 입력 처리, 최종 도서 7개 | JobRepository와 실제 재시작 |
| 발행 후 원본 B004 수량 변경·새 도서 추가 | 기존 스냅샷 값·7건은 유지 | 원본과 복사 입력의 분리 |
| 존재하지 않는 ID·미발행 입력 | 실행 실패, 조용히 0건 성공하지 않음 | 입력 발행 검증 |
| 제목 동점·연속하지 않는 item_id | item_id 기준으로 누락 없이 읽기 | 고유 정렬 키 |
| 프로세스 종료 후 같은 업무 restart | 입력·메타데이터·확정 결과로 복구 | 지속 가능한 전체 복구 |

시험마다 새 업무 키와 격리된 입력을 사용한다. 특히 실제 재시작 시험에는 실패 주입이 재시작 뒤에는 해제되는 통제된 Writer 대역과 지속 DB가 필요하다. 이 표는 검증 계획이지 실행 완료 기록이 아니다.

## 4. 적용 관점에서 다시 보기

먼저 “처리할 때의 최신 값”인지 “발행 시점에 보존한 값”인지 업무 요구를 정한다. 그다음 대상 범위와 고유 정렬 키를 정하고, 위치 저장만으로 충족되지 않는 값 보존을 스냅샷 설계로 분리한다.

도서 예제는 필요한 값을 복사하고 준비 완료로 발행한 뒤, snapshotId·itemId로 단일 스레드 페이징을 수행한다. pageSize와 chunk는 용도가 다르며, 예제의 같은 숫자를 보편적인 성능 권장값으로 사용하지 않는다.

실패 복구에서는 같은 입력 버전·Job·Step·Reader 상태를 유지한다. 정책과 Reader를 교체한 새 실습은 새 업무로 분리하고, 재시작 가능한 업무가 남아 있으면 입력과 메타데이터를 먼저 삭제하지 않는다.

검증은 Reader의 상태 복원부터 실제 Writer rollback·JobRepository commit·프로세스 재시작까지 넓힌다. 마지막 실행의 처리 수만 보지 않고 발행 입력의 식별자·값과 최종 업무 결과를 대조한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

재시작에는 위치뿐 아니라 그 위치의 의미를 유지하는 입력이 필요하다. 고유 정렬 키는 읽는 순서·경계를 안정화하고, 필요한 값을 보존한 스냅샷은 재시작 전후 입력의 의미를 유지한다.

### 5.2 이전·다음 학습과의 연결

[retry·skip 노트](../34_10_05_Batch_Retry_Skip_and_Result_Validation/10_05_Batch_Retry_Skip_and_Result_Validation.md)의 결과 검증에 안정적인 DB 입력을 연결했다. 다음에는 [Spring Batch Partitioning·작업 분할과 병렬 처리](../36_10_07_Batch_Partitioning_and_Parallel_Processing/10_07_Batch_Partitioning_and_Parallel_Processing.md)를 학습해, 고정된 입력 범위를 여러 작업으로 나눌 때 실행별 Reader·체크포인트·자원 제한을 어떻게 분리하는지 살펴본다.

### 5.3 더 파볼 만한 주제

입력 발행의 승인·보존·내용 검증, 여러 원본 테이블의 일관된 복사, 완료 결과의 별도 검증 Step을 확장할 수 있다. 대용량 복사를 단계로 나눌 때는 부분 입력을 공개하지 않는 발행 절차와 병렬 처리 전의 범위 설계를 함께 검토한다.

### 5.4 참고 자료

- [Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html): 예제의 Boot·Batch·Framework 버전 기준.
- [DB Reader·Writer 설명](https://docs.spring.io/spring-batch/reference/readers-and-writers/database.html): 커서·페이징·provider·RowMapper의 관계.
- [JdbcCursorItemReader](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/JdbcCursorItemReader.html): 기본 연결과 커서 동작.
- [JdbcPagingItemReader](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/JdbcPagingItemReader.html), [Reader builder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/builder/JdbcPagingItemReaderBuilder.html): 고유 정렬 키·재개·페이지 크기·상태 설정.
- [6.0.5 Reader 소스](https://github.com/spring-projects/spring-batch/blob/v6.0.5/spring-batch-infrastructure/src/main/java/org/springframework/batch/infrastructure/item/database/JdbcPagingItemReader.java): 페이지 경계와 context 갱신·복원.
- [QueryProvider 팩터리](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/support/SqlPagingQueryProviderFactoryBean.html): DB 종류별 SQL 생성과 조건 설정.
- [Step scope·late binding](https://docs.spring.io/spring-batch/reference/step/late-binding.html), [Step builder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/ChunkOrientedStepBuilder.html): 실행 파라미터·Reader·Step 연결.
- [ItemStream](https://docs.spring.io/spring-batch/reference/readers-and-writers/item-stream.html), [ExecutionContext](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/ExecutionContext.html): 상태 생명주기와 복사 생성자.
- [PostgreSQL LIMIT·OFFSET](https://www.postgresql.org/docs/17/queries-limit.html), [트랜잭션 격리](https://www.postgresql.org/docs/17/transaction-iso.html), [INSERT](https://www.postgresql.org/docs/17/sql-insert.html): 조회 경계·시점·입력 복사의 SQL 의미.

## 6. 요약 정리

1. 커서 Reader는 열린 결과를 순차적으로 읽고, 페이징 Reader는 내부에서 여러 페이지 SQL을 실행한다.
2. ORDER BY는 순서를 정하지만 변경 가능한 대상 집합의 OFFSET 이동을 막지는 않는다.
3. 고유하고 변하지 않는 정렬 키와 Reader의 진행 상태를 함께 유지한다.
4. pageSize·chunk·fetchSize는 조회·commit·전송이라는 서로 다른 단위다.
5. 최대 ID·ID 목록·값 복사는 보장하는 범위가 다르다.
6. 스냅샷은 필요한 값을 보존하고 준비 완료 상태와 함께 발행하며 이후에는 수정하지 않는다.
7. 같은 실패 업무는 같은 입력·체크포인트로 재개하고 새 업무로 우회하지 않는다.
8. Reader 상태 테스트와 실제 DB·Writer·JobRepository 복구 테스트를 구분한다.
9. 입력의 건수·ID·값과 재시작을 포함한 최종 업무 결과를 대조한다.

🧠 기억할 것: “어디까지 확정했는가”와 “다시 읽을 데이터가 같은가”를 함께 확인한다.

## 7. 미니 퀴즈 또는 체크리스트

1. ID 1~7에서 1~3을 처리한 뒤 조회 조건에서 제외했다. 같은 조건의 `OFFSET 3 LIMIT 3`은 어떤 ID를 반환하며 왜 위험한가?
2. 시작 시 최대 ID를 저장하면 기존 도서 제목·수량도 고정되는가? ID 목록만 복사하면 어떤 차이가 있는가?
3. pageSize 100·chunk 20이면 한 번의 조회 행 수와 한 번의 commit 대상 수는 각각 얼마인가?
4. B001~B003의 상태를 저장한 뒤 B004를 읽고 저장 없이 실패했다. 같은 입력으로 재개할 때 B004를 다시 읽어야 하는가?
5. manifest의 ready가 true이면 입력 행의 UPDATE·DELETE도 자동으로 막히는가? 실패 실행이 남아 있을 때 스냅샷을 삭제해도 되는가?

<details>
<summary>정답과 해설</summary>

1. 남은 후보 4·5·6·7의 앞 세 개를 건너뛰어 7만 반환한다. 4~6은 처리하지 않았는데 페이지 위치 이동으로 누락된다.
2. 아니다. 상한은 범위 일부만 제한하며 기존 값 수정·삭제 등을 막지 않는다. ID 목록은 대상 식별자를 고정하지만 원본 재조회 값까지 보존하지 않는다. 필요한 값을 함께 복사해야 이번 예제의 입력 의미를 유지한다.
3. 한 페이지 SQL은 최대 100행을 요청하고 chunk는 일반적인 정상 경로에서 20항목 단위로 처리·commit한다. 조회된 페이지의 나머지를 메모리에서 이어 읽을 수 있으며 두 설정은 같은 단위가 아니다.
4. 그렇다. 마지막 읽기 위치가 아니라 마지막 확정된 상태부터 진행해야 한다. 이 노트의 Reader 테스트는 미확정 B004가 다시 반환되는지 확인하며, 실제 commit 복구는 추가 통합 시험이 필요하다.
5. 아니다. ready는 발행 표식이며 별도 권한·운영 규칙 없이는 수정할 수 있다. 재시작 가능한 업무가 남아 있으면 필요한 입력을 먼저 삭제하지 않아야 한다.

</details>
