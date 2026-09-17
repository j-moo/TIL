# 인덱스와 실행 계획: SQL 한 번이 느린 이유를 DB에서 확인하기

- 🎯 학습 목표: 조회 조건·정렬·제한에 맞는 인덱스 후보를 세우고, 실행 계획과 결과 검증을 분리해 비교한다.
- 🧩 핵심 키워드: B-tree, 복합 인덱스, 선택도, EXPLAIN, ANALYZE, Index Cond·Filter, Sort, BUFFERS, 커서 경계
- ⭐ 중요도: ★★★★★ — N+1을 줄여도 남아 있는 탐색·정렬 비용을 이해하고, 근거 없이 인덱스를 늘리지 않게 한다.
- 📝 한눈에 보는 내용: 작성자별 공개 도서 목록을 예제로 기본키만 있는 상태, 단일 인덱스, 복합 인덱스를 비교한다. 인덱스 전후 결과와 다음 커서의 동점 처리를 별도 검증한다.
- 🧱 선수 지식: SELECT·WHERE·ORDER BY·LIMIT, 기본키, DTO Projection, offset·복합 키 커서
- 🔗 이전 노트: [Batch Fetching과 연관 조회 전략 비교](../19_09_16_Batch_Fetching/09_16_Batch_Fetching.md)

> 정리 기준일: 2026-09-17. 실행 계획 실습은 **PostgreSQL 17** 공식 문서를 기준으로 한다. 최신 버전을 뜻하는 선택이 아니라 DB별 문법과 관찰 기준을 고정하기 위한 선택이다. 이전 Spring Boot·H2 프로젝트는 변경하지 않는다. 첨부 SQL은 별도 로컬 PostgreSQL 학습 DB용이며 이 작성 환경에서 PostgreSQL 실행·계획 측정은 하지 않았다. 아래 계획 구조와 수치는 설명용 예상과 입력 데이터의 계산값이지 실제 실행 로그가 아니다.

## 1. SELECT가 한 번인데도 왜 느릴까?

지난 노트에서는 Batch Fetching으로 연관 조회 횟수를 줄였다. 하지만 SQL 한 번이 백만 행을 읽고 정렬한 뒤 20개만 반환한다면 여전히 오래 걸릴 수 있다. **몇 번 요청하는가**와 **각 요청에서 DB가 얼마나 일하는가**는 다른 문제다.

DB는 SQL을 받으면 가능한 처리 방법 중 하나를 고른다. 이 선택을 하는 부분을 플래너 또는 옵티마이저라고 한다. 실행 계획은 어떤 순서와 방식으로 테이블을 읽고, 조건을 검사하고, 정렬해 결과를 만들지 나타낸 것이다.

이번에는 다음 과정을 따라간다.

```text
목록의 조건·정렬·반환 컬럼 확정
  → 기본 실행 계획 관찰
  → 단일 인덱스 추가 후 같은 쿼리 관찰
  → 복합 인덱스 추가 후 같은 쿼리 관찰
  → 결과·순서·커서 경계가 유지되는지 검사
  → 운영 적용 비용과 미검증 범위 구분
```

인덱스를 만들었다는 사실만으로 성공이라고 판단하지 않는다. 같은 결과를 유지하면서 DB의 불필요한 작업이 줄어드는지 확인하는 것이 목적이다.

## 2. 인덱스는 원본 테이블과 별도로 유지하는 탐색 구조다

인덱스는 특정 컬럼 값을 기준으로 행을 찾기 쉽게 만든 보조 구조다. 책 뒤의 찾아보기처럼 전체를 처음부터 읽지 않고 필요한 위치로 가는 데 도움을 준다. 다만 실제 DB에서는 페이지 접근·캐시·행의 가시성 같은 추가 비용이 있어 비유와 완전히 같지는 않다.

이번에는 PostgreSQL의 기본 인덱스 방식인 **B-tree**를 사용한다. 정렬된 키를 기준으로 동등 조건, 범위 조건, 정렬된 상위 결과를 찾는 후보가 된다. 하나의 인덱스에 여러 컬럼을 키로 두면 복합 인덱스다. [인덱스 종류와 B-tree](https://www.postgresql.org/docs/17/indexes-types.html)를 참고한다.

인덱스는 공짜가 아니다. 저장 공간을 차지하며 INSERT·UPDATE·DELETE 때도 갱신해야 한다. 읽기에 유리한 인덱스라도 자주 바뀌는 테이블에서는 쓰기 비용과 관리 부담을 함께 고려한다. [PostgreSQL 인덱스 소개](https://www.postgresql.org/docs/17/indexes-intro.html)를 참고한다.

### 2.1 인덱스가 있어도 전체 스캔이 합리적일 수 있다

선택도는 조건에 맞는 데이터의 비율과 관련된 말이다. 이번에는 혼동을 줄이기 위해 “전체 10만 행 중 80행이 조건에 맞는다”처럼 실제 비율로 표현한다.

극히 일부 행만 필요하면 인덱스로 위치를 찾는 이점이 클 수 있다. 반대로 작은 테이블이거나 대부분의 행이 필요하면 전체를 순서대로 읽는 것이 더 쌀 수 있다. `Seq Scan`이라는 이름만 보고 실패라고 단정하지 않는다.

## 3. 먼저 조회 계약을 SQL로 적는다

이번 실습은 기존 Book Entity에 필드를 추가하지 않는다. DB 탐색을 분리해 보기 위한 `til_plan_books` 임시 테이블을 만들고 다음 계약을 사용한다.

| 항목 | 실습 계약 |
| --- | --- |
| 필터 | `author_id = 42`, `status = 'PUBLISHED'` |
| 정렬 | `created_at DESC, id DESC` |
| 목록 크기 | 최대 20개 |
| 반환 값 | ID·생성 시각·제목 |
| 반환하지 않는 값 | 긴 본문 body |
| 정렬 키 | created_at·id 모두 NOT NULL |

```sql
SELECT id, created_at, title -- 화면과 다음 커서에 필요한 값만 선택한다.
FROM pg_temp.til_plan_books -- 이번 세션의 실습 테이블이다.
WHERE author_id = 42 -- 작성자 한 명으로 범위를 좁힌다.
  AND status = 'PUBLISHED' -- 공개 도서만 남긴다.
ORDER BY created_at DESC, id DESC -- 같은 시각에서도 ID로 순서를 확정한다.
LIMIT 20; -- 결과가 최대 20개라는 뜻이지 읽는 행도 최대 20개라는 뜻은 아니다.
```

`LIMIT` 앞에서 많은 행을 검사하거나 정렬할 수 있다. Projection으로 본문을 제외해도 DB의 탐색 비용이 자동으로 줄어드는 것은 아니다. 이전 [DTO Projection 노트](../17_09_13_JPA_DTO_Projection/09_13_JPA_DTO_Projection.md)와 연결해 생각한다.

## 4. EXPLAIN, EXPLAIN ANALYZE, ANALYZE는 서로 다르다

| 명령 | 의미 | 주의점 |
| --- | --- | --- |
| `EXPLAIN SELECT ...` | 계획과 추정치 표시 | 일반적인 SELECT의 실제 실행 통계는 아님 |
| `EXPLAIN (ANALYZE, ...) SELECT ...` | SELECT 실행 후 통계 표시 | 실행 부하가 발생함 |
| `ANALYZE 테이블명` | 데이터 분포 통계 수집 | 그 자체가 해당 SELECT의 실행 계획은 아님 |

통계는 플래너가 조건에 맞을 행 수를 추정하는 재료다. 데이터가 크게 바뀌었는데 통계가 맞지 않으면 비용 판단도 빗나갈 수 있다. 이번에는 대량 입력 직후 실습 테이블을 명시해 통계를 수집한다. [ANALYZE 문서](https://www.postgresql.org/docs/17/sql-analyze.html)를 참고한다.

```sql
ANALYZE pg_temp.til_plan_books; -- 범위를 생략하지 않고 실습 테이블만 통계 수집한다.

EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) -- 실제 행 수·버퍼 사용을 관찰하고 노드별 시간 측정은 끈다.
SELECT id, created_at, title -- 본문을 제외한 목록 결과다.
FROM pg_temp.til_plan_books -- 임시 테이블을 대상으로 한다.
WHERE author_id = 42 AND status = 'PUBLISHED' -- 비교 중 조건은 유지한다.
ORDER BY created_at DESC, id DESC -- 비교 중 정렬도 유지한다.
LIMIT 20; -- 비교 중 페이지 크기도 유지한다.
```

`TIMING OFF`는 노드별 시간 측정 비용을 줄이기 위한 선택이다. 전체 실행 시간 요약까지 사라지는 것은 아니다. `EXPLAIN ANALYZE`에는 관찰 오버헤드가 있고 네트워크 전송 시간을 그대로 측정하지도 않는다. [EXPLAIN 옵션](https://www.postgresql.org/docs/17/sql-explain.html)을 참고한다.

⚠️ `EXPLAIN ANALYZE`는 대상 문장을 실제 실행한다. UPDATE·DELETE나 부작용이 있는 함수를 운영 DB에 붙여 실행하면 안 된다. rollback으로 모든 외부 효과까지 취소된다고 일반화하지 않는다. 이번 스크립트의 EXPLAIN 대상은 생성한 임시 데이터의 SELECT뿐이다.

## 5. 실행 계획에서 먼저 읽을 항목

계획은 트리다. 아래쪽의 데이터를 읽는 노드에서 위쪽의 필터·정렬·제한으로 결과가 전달된다고 생각하되, `Limit`처럼 부모가 필요한 만큼만 요청해 자식의 처리를 일찍 멈추게 할 수도 있다.

| 표시 | 읽는 방법 |
| --- | --- |
| `Seq Scan` | 테이블 행을 순차적으로 읽는 경로 |
| `Index Scan` | 인덱스로 찾고 필요한 테이블 행도 읽는 경로 |
| `Bitmap Index Scan` → `Bitmap Heap Scan` | 후보 행 위치를 모은 뒤 테이블 페이지를 읽는 경로 |
| `Index Cond` | 인덱스 접근에 적용한 조건 |
| `Filter` | 해당 노드에서 추가로 거르는 조건 |
| `Sort` | 별도 정렬 작업, 정렬 방식·사용량도 확인 |
| `Limit` | 부모가 요구한 결과 크기 제한 |

`cost`는 밀리초가 아니라 플래너의 상대적 비용 단위다. `rows` 추정은 보통 노드가 내보낼 행 수이지 검사한 모든 행 수가 아니다. 실제 행 수와 `Rows Removed by Filter`를 함께 봐야 읽고 버린 일을 이해할 수 있다.

`loops`가 여러 번이면 표시된 실제 행 수와 시간은 반복당 평균이다. 반복 횟수를 곱해 규모를 해석하되 부모·자식의 누적 시간들을 무작정 모두 더하면 중복 계산할 수 있다. [실행 계획 읽기](https://www.postgresql.org/docs/17/using-explain.html)를 참고한다.

### 5.1 BUFFERS의 local과 temp를 혼동하지 않는다

이번 실습은 TEMP 테이블이라 `Buffers: local ...`이 나타날 수 있다. 일반 테이블·인덱스는 `shared`, 정렬·해시의 작업용 임시 파일 등은 `temp`로 구분된다. 이름이 비슷해도 “임시 테이블이므로 무조건 temp”는 아니다.

hit는 필요한 블록을 캐시에서 찾았다는 뜻이다. read를 곧바로 물리 디스크 접근 횟수와 같다고 보지 않는다. 운영체제 캐시도 개입할 수 있다. 상위 노드의 버퍼 통계에 하위 노드 사용량이 포함되므로 모든 줄을 더하지 않는다. [BUFFERS 정의](https://www.postgresql.org/docs/17/sql-explain.html)를 참고한다.

### 5.2 추정 행 수가 실제와 크게 다르다면

플래너는 모든 쿼리를 미리 실행해서 결과 수를 아는 것이 아니다. 수집한 표본·빈도·분포를 토대로 추정한다. 오래된 통계, 값 쏠림, 컬럼 간 상관관계가 추정 오차의 후보다. 다만 상위 Limit이 자식 실행을 일찍 멈춘 경우에도 추정 전체 행 수와 실제 관찰 행 수는 다를 수 있다.

큰 차이가 보이면 먼저 입력 값과 데이터 분포를 확인한다. 통계 수집만 하면 모든 오차가 해결된다고 단정하지 않는다. [행 수 추정 예제](https://www.postgresql.org/docs/17/row-estimation-examples.html)를 참고한다.

## 6. 인덱스 후보를 조건과 정렬에서 도출한다

### 6.1 단일 인덱스: 작성자만 빠르게 찾을 수 있을까?

```sql
CREATE INDEX til_plan_author_idx -- 후보 인덱스의 목적이 드러나는 이름이다.
ON pg_temp.til_plan_books (author_id); -- 작성자 조건을 위한 단일 키다.
```

작성자 42의 행을 찾는 데 도움이 될 수 있다. 그러나 그 안에서 status를 걸러야 하고, 생성 시각·ID 내림차순도 맞춰야 한다. `Filter`와 `Sort`가 남는지 본다.

```text
설명용 가능한 구조 — 실제 측정 출력이 아님
Limit
  Sort(created_at DESC, id DESC)
    Bitmap Heap Scan 또는 Index Scan
      작성자 인덱스로 후보 찾기 + 상태 필터
```

### 6.2 복합 인덱스: 동등 조건 뒤에 정렬 키를 둔다

```sql
CREATE INDEX til_plan_author_status_created_id_idx -- 이 조회의 조건·순서를 위한 후보다.
ON pg_temp.til_plan_books ( -- 다른 애플리케이션 테이블에 만들지 않는다.
    author_id, -- 작성자 값 하나로 범위를 고정한다.
    status, -- 그 작성자 안에서 공개 상태를 고정한다.
    created_at DESC, -- 다음에는 원하는 시각 순서다.
    id DESC -- 동점도 정해진 순서로 읽게 한다.
);
```

앞의 두 키를 동등 조건으로 고정하면 뒤쪽 키를 목록의 정렬과 연결할 수 있다. 이 쿼리에 대해 **검색 범위 축소와 정렬된 상위 항목 읽기**를 함께 기대하는 후보다. 실제 선택은 계획에서 확인한다.

복합 B-tree는 선두 컬럼의 제약이 중요하다. 그렇다고 “선두 조건이 없으면 어떤 상황에서도 절대 사용 불가”라고 외우지는 않는다. 여기서는 PostgreSQL 17 기준의 효율적인 범위 제한 원리를 배우고, 다른 DB·버전의 추가 최적화와 구분한다. [복합 인덱스 문서](https://www.postgresql.org/docs/17/indexes-multicolumn.html)를 참고한다.

author_id와 status는 이 쿼리에서는 둘 다 동등 조건이다. “무조건 선택도가 높은 컬럼부터”라는 한 문장으로 순서를 결정하지 않는다. 작성자만 조회하는 다른 쿼리 등 **함께 지원해야 할 조회 패턴**도 고려해야 한다.

```text
설명용 가능한 구조 — 실제 측정 출력이 아님
Limit
  Index Scan using til_plan_author_status_created_id_idx
    Index Cond: author_id와 status 조건
    별도 Sort 없이 필요한 상위 결과 전달
```

B-tree는 정렬된 출력을 제공할 수 있고 역방향 스캔도 가능하다. 하지만 복합 키의 ASC·DESC 혼합, NULL 배치, 필터 범위가 달라지면 같은 인덱스로 원하는 전체 순서를 얻을 수 있는지 다시 확인해야 한다. 이번에는 두 정렬 키가 NOT NULL이고 둘 다 DESC다. [인덱스와 ORDER BY](https://www.postgresql.org/docs/17/indexes-ordering.html)를 참고한다.

## 7. 재현용 SQL 실행: 기존 데이터와 분리한다

전체 실습은 같은 폴더의 [index_plan_lab.sql](./index_plan_lab.sql)에 있다. 코드 각 부분에 설명 주석을 붙였으며, 문서의 SQL 조각을 따로 조합할 필요 없이 이 파일을 순서대로 실행하도록 작성했다.

### 7.1 준비와 안전 범위

- 별도로 준비한 **로컬 PostgreSQL 17 학습 DB**와 psql을 사용한다. 예시 DB 이름은 `til_index_lab`이다.
- 실습 계정에는 해당 DB 접속과 TEMP 테이블 생성 권한이 필요하다. 운영 계정이나 운영 연결 문자열을 사용하지 않는다.
- 10만 행과 인덱스를 만들므로 메모리·디스크·CPU를 사용한다. statement timeout 30초는 문장별 제한이지 스크립트 전체 제한이 아니다.
- `BEGIN` 안에서 TEMP 객체를 만들고 마지막에 `ROLLBACK`한다. 기존 테이블 삭제·덮어쓰기는 없다.
- 중간 오류로 열린 SQL 편집기 세션에 실패한 트랜잭션이 남으면 그 세션에서 rollback하고 원인을 확인한다. 다른 작업이 있는 세션에 이 스크립트를 섞지 않는다.

임시 테이블과 그 인덱스는 세션 범위의 객체다. 또한 autovacuum은 임시 테이블에 접근하지 못하므로 입력 뒤 `ANALYZE pg_temp.til_plan_books`를 직접 호출한다. [임시 테이블 문서](https://www.postgresql.org/docs/17/sql-createtable.html)를 참고한다.

### 7.2 데이터는 어떤 모양인가?

스크립트는 외부 자료 대신 규칙으로 데이터를 생성한다.

```sql
-- 전체 스크립트의 입력 생성 부분을 읽기 위한 표현 예시다.
((g - 1) % 1000) + 1 -- 작성자 1000명에게 순환 배분한다.
(g / 1000) % 5 -- 상태를 작성자와 완전히 같은 주기로 고정하지 않도록 한다.
((g * 37) % 40000) -- 시각 순서를 ID 순서와 다르게 만들고 동점도 만든다.
```

ID는 1~100000이며, 작성자별 도서는 100개다. 작성자 42의 공개 도서는 계산상 80개이고 그중 상위 20개를 읽는다. 생성 시각이 같은 행도 경계에 걸리므로 시각만 비교해 다음 페이지를 만드는 오류를 검사할 수 있다.

본문은 256자로 만들지만 목록에서는 선택하지 않는다. 이 데이터는 동작 차이를 드러내기 위한 인공 입력이다. 운영 데이터의 인기 작성자 쏠림이나 자식 개수·시각 분포를 대표하지 않는다.

### 7.3 실행 명령

아래 명령은 **TIL 저장소 루트**의 PowerShell에서 실행한다. psql이 설치되어 있고 로컬 DB를 이미 준비했다는 전제다. `-U` 뒤의 계정은 본인의 실습 계정으로 바꾸며, 비밀번호를 명령에 직접 적지 않는다.

```powershell
psql --version # 클라이언트 버전을 확인한다. 서버 버전은 아래 별도 명령으로 확인한다.
psql -X -h localhost -U postgres -d til_index_lab -c "SHOW server_version;" # 학습용 서버인지 확인한다.
psql -X -h localhost -U postgres -d til_index_lab -v ON_ERROR_STOP=1 -f "SpringBoot/20_09_17_Indexes_and_Execution_Plans/index_plan_lab.sql" # 오류가 나면 중단하며 전체 실습을 실행한다.
```

`-X`는 개인 psql 초기화 파일을 읽지 않는 옵션이다. `ON_ERROR_STOP=1`은 오류가 있어도 뒤쪽 문장을 계속 실행하는 일을 막는다. [psql 실행 옵션](https://www.postgresql.org/docs/17/app-psql.html)을 참고한다. 성공 시 A~D 단계의 계획, 검증 PASS 알림, 마지막 ROLLBACK을 확인한다. **현재 문서에 성공 실행 로그를 제공하는 것은 아니다.**

### 7.4 무엇을 비교하고 무엇을 자동 검사하는가?

| 단계 | 변경 사항 | 계획에서 볼 것 |
| --- | --- | --- |
| A | 기본키 인덱스만 존재 | 큰 범위 스캔·필터·Sort 여부 |
| B | author_id 인덱스 추가 | 후보 범위, 상태 Filter, 남은 Sort |
| C | 복합 인덱스 추가 | 선택한 인덱스, Index Cond, Sort 감소 가능성 |
| D | 복합 키 커서의 다음 구간 | 경계 조건의 인덱스 사용과 읽기 범위 |

C에서는 B의 단일 인덱스를 남겨 둔다. 두 후보 중 무엇을 쓰는지도 관찰한다. 스크립트는 인덱스 선택을 강제하지 않는다. 이후 운영에서 단일 인덱스가 중복인지 판단하는 일은 다른 조회 패턴과 쓰기 비용까지 따로 검토해야 한다.

마지막 검증 블록은 다음을 검사하고, 맞지 않으면 예외로 중단한다.

1. 전체 데이터 10만 행, 대상 공개 도서 80행.
2. 인덱스 전후 첫 20개 ID와 그 순서가 동일함.
3. tuple 커서·OR로 풀어 쓴 커서·변경 없는 데이터의 offset 다음 페이지가 동일함.
4. 다음 페이지도 20개이며 첫 페이지와 겹치지 않음.
5. 경계와 같은 시각의 더 작은 ID를 다음 페이지에 포함함.
6. 존재하지 않는 작성자 1001의 결과가 비어 있음.

반대로 특정 계획 이름이나 “반드시 5ms 이하” 같은 성능 수치는 자동 통과 조건으로 쓰지 않는다. 플래너·통계·캐시·장비에 따라 바뀔 수 있기 때문이다. 결과 검증과 성능 관찰은 별개의 작업이다.

## 8. 기존 커서 조건을 DB의 범위 검색과 연결한다

이전 [커서 페이지네이션 노트](../16_09_12_Cursor_Pagination/09_12_Cursor_Pagination.md)의 내림차순 경계는 다음 형태였다.

```sql
-- 조건 표현만 발췌했다. anchor_time·anchor_id는 검증 블록의 지역 변수다.
created_at < anchor_time -- 더 오래된 시각은 다음 구간이다.
OR (created_at = anchor_time AND id < anchor_id) -- 같은 시각에서는 더 작은 ID만 다음 구간이다.
```

PostgreSQL에서는 이번처럼 두 키가 NOT NULL이고 방향이 같을 때 행 비교로 표현할 수 있다.

```sql
(created_at, id) < (anchor_time, anchor_id) -- 왼쪽부터 비교하고 차이가 나면 그 키로 순서를 정한다.
```

이는 두 컬럼이 모두 각각 작아야 한다는 뜻이 아니다. 시각이 더 작으면 ID가 커도 다음 구간이다. NULL 허용 여부나 ASC·DESC 혼합이 달라지면 같은 변환을 적용하면 안 된다. [행 비교 규칙](https://www.postgresql.org/docs/17/functions-comparisons.html)을 참고한다.

이번 스크립트는 두 표현의 **결과 등가성**을 검사하지만 실행 계획까지 같다고 단정하지 않는다. 실제 애플리케이션의 OR 조건이 Filter로 남거나 다른 계획이 선택될 수도 있다. 운영 SQL의 정확한 형태로 계획을 확인해야 한다.

또한 예제의 tuple 문법을 모든 JPA 제공자가 같은 JPQL로 지원한다고 가정하지 않는다. 애플리케이션 코드 변경 없이 DB 실습으로만 비교한다. 원시 SQL 도입 여부는 타입 매핑·DB 종속성·테스트까지 포함한 별도 선택이다.

offset 대조는 데이터 변경이 없는 임시 테이블에서만 한다. 여러 요청 사이 삽입·삭제가 있을 때 offset과 cursor가 같은 결과를 보장한다는 뜻은 아니다. 인덱스가 생겨도 깊은 offset의 건너뛰기 작업 자체가 사라지는 것은 아니다.

## 9. Spring Boot·JPA 프로젝트로 돌아올 때의 확인 순서

### 9.1 JPQL 문자열보다 실제 SQL과 바인딩을 확인한다

JPA는 Entity 속성명을 DB 컬럼명으로 바꾸고, dialect에 따라 제한·조인 SQL을 만든다. 실제 SQL, 매개변수 값의 분포와 타입, 정렬·제한을 확인한 뒤 같은 조건의 계획을 본다. 로그에 비밀번호·토큰·개인정보를 남기지 않는다.

이전 SqlCapture는 SQL 준비 시점을 관찰하는 도구였다. 값이 모두 치환된 실행 계획을 얻는 도구가 아니다. DB 진단 도구를 연결할 때에는 SQL 문장과 바인딩 값의 의미를 분리해서 확인한다.

PostgreSQL의 prepared statement는 값별 custom plan이나 공유 generic plan을 사용할 수 있다. SQL 클라이언트에 상수를 직접 넣은 결과만으로 애플리케이션의 반복 실행 계획과 항상 같다고 볼 수 없다. 이 노트는 JDBC 드라이버 설정이나 plan_cache_mode를 변경하지 않는다. [PREPARE와 계획 선택](https://www.postgresql.org/docs/17/sql-prepare.html)을 참고한다.

### 9.2 Index Scan과 Index Only Scan을 구분한다

이번 인덱스에는 title이 없다. 제목도 반환하려면 테이블의 값을 읽는 작업이 필요하다. Index Scan이 나타나도 “테이블은 전혀 읽지 않았다”는 뜻이 아니다.

`INCLUDE (title)` 같은 covering 설계는 필요한 값을 인덱스에 더 담는 선택이지만, 인덱스 크기와 쓰기 비용이 늘어난다. PostgreSQL에서는 필요한 컬럼이 모두 있어도 MVCC 가시성 확인 때문에 heap 접근이 남을 수 있다. `Index Only Scan`이라는 이름과 `Heap Fetches`를 함께 본다. 이번 기본 실습에는 INCLUDE나 VACUUM 실험을 추가하지 않는다. [Index-Only Scan 문서](https://www.postgresql.org/docs/17/indexes-index-only-scans.html)를 참고한다.

### 9.3 로컬 DDL을 운영 배포 절차로 복사하지 않는다

운영 인덱스 생성은 테이블 크기, 쓰기 잠금, 자원 사용, 실패 복구를 고려해야 한다. `CREATE INDEX CONCURRENTLY`에는 일반 생성과 다른 제약이 있고 트랜잭션 블록 안에서 실행할 수 없다. 실패한 인덱스 상태 확인도 필요하다. 이번 BEGIN·ROLLBACK 임시 실습을 그대로 운영 migration으로 옮기지 않는다. [CREATE INDEX와 동시 생성](https://www.postgresql.org/docs/17/sql-createindex.html)을 참고한다.

`@Table(indexes = ...)`만 적으면 이미 운영 중인 모든 DB에 안전하게 반영된다고 가정하지 않는다. 개발용 스키마 자동 생성과 운영의 버전 관리된 스키마 변경은 구분해야 한다.

## 10. 관찰 기록을 남기는 방법

한 번 빨라졌다는 숫자보다 **무엇을 유지하고 무엇을 바꿨는지**가 중요하다. 같은 데이터·조건·페이지 크기로 여러 번 실행하되 첫 실행과 캐시가 채워진 반복을 나눠 기록한다. 운영 서버 캐시를 비우는 방식으로 실험하지 않는다.

| 기록 항목 | 작성할 내용 |
| --- | --- |
| 환경 | 서버 버전, DB, 데이터 건수·분포, 설정 |
| 쿼리 계약 | 조건 값·타입, 반환 컬럼, 정렬, LIMIT·offset·cursor |
| 계획 | 스캔 방식, Index Cond·Filter·Sort, 예상/실제 rows·loops |
| 자원 관찰 | 버퍼 종류·hit/read, 정렬 메모리·임시 작업 여부 |
| 비교 결과 | 순서·경계 유지, 반복 실행 시간, 새 인덱스의 공간·쓰기 비용 |
| 미검증 | 동시 부하, 운영 분포, prepared plan, 배포 중 잠금 |

이번 TEMP 테이블 실습은 일반 테이블의 autovacuum·동시 사용자·WAL·운영 캐시를 재현한 부하 테스트가 아니다. 기능과 탐색 구조를 이해한 뒤 대상 환경에서 다시 확인해야 한다.

## 11. 핵심 정리와 다음 학습

1. 쿼리 수를 줄이는 것과 SQL 한 번의 작업량을 줄이는 것은 다르다.
2. 인덱스는 조건·정렬·제한과 실제 데이터 분포를 보고 설계한다.
3. EXPLAIN의 cost와 실제 시간은 단위부터 다르다.
4. rows·loops·Filter·Sort·BUFFERS를 연결해서 읽는다.
5. ANALYZE 통계 수집과 EXPLAIN ANALYZE 실제 실행을 구분한다.
6. 복합 인덱스는 키 순서와 지원할 다른 조회 패턴도 함께 고려한다.
7. 인덱스 전후 결과·순서·커서 동점 처리가 유지되는지 별도로 검사한다.
8. 운영 적용에는 쓰기 비용·잠금·스키마 변경 이력 관리가 필요하다.

다음 확장 주제는 **Flyway와 DB 스키마 마이그레이션**이다. 검토한 테이블·인덱스 변경을 팀과 배포 환경에 일관되게 적용하는 방법을 이어서 학습한다.

## 12. 복습 퀴즈

1. SQL이 한 번이고 반환 행이 20개면 DB가 읽은 행도 20개인가?
2. author_id 인덱스만으로 status 필터와 created_at·id 정렬까지 항상 해결되는가?
3. cost가 100이면 실행 시간이 100ms라는 뜻인가?
4. TEMP 테이블의 BUFFERS에서 local과 temp는 각각 무엇인가?
5. `(created_at, id) < (time, last_id)`는 두 값이 각각 모두 작아야 한다는 뜻인가?
6. 로컬에서 빨라진 CREATE INDEX를 운영 배포 SQL로 바로 복사하면 왜 위험한가?

<details>
<summary>정답과 해설</summary>

1. 아니다. 후보 스캔·필터·정렬에서 더 많은 행을 처리했을 수 있다.
2. 아니다. 작성자 후보 찾기 뒤에 상태 필터와 별도 정렬이 남을 수 있다.
3. 아니다. 플래너의 상대적 비용 단위다. 실제 실행 시간과 구분한다.
4. local은 임시 테이블·인덱스 블록이고, temp는 정렬·해시 등의 작업용 임시 블록이다.
5. 아니다. 왼쪽 키부터 비교해 처음 다른 값으로 순서를 결정한다. 이번 NOT NULL·동일 방향 전제도 중요하다.
6. 운영 규모의 자원 사용·쓰기 잠금·실패 복구·트랜잭션 제약과 스키마 변경 이력을 확인해야 하기 때문이다.

</details>

## 13. 공식 문서로 이어서 읽기

- [PostgreSQL 17 Using EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html): 계획 트리·행 수·반복 해석
- [EXPLAIN 명령](https://www.postgresql.org/docs/17/sql-explain.html): 실제 실행·BUFFERS·TIMING의 의미
- [인덱스 소개](https://www.postgresql.org/docs/17/indexes-intro.html): 탐색 이점과 유지 비용
- [복합 인덱스](https://www.postgresql.org/docs/17/indexes-multicolumn.html): 선두 키와 범위 조건
- [인덱스와 ORDER BY](https://www.postgresql.org/docs/17/indexes-ordering.html): 정렬·역방향 스캔·LIMIT
- [ANALYZE](https://www.postgresql.org/docs/17/sql-analyze.html): 통계 수집
- [Row Estimation Examples](https://www.postgresql.org/docs/17/row-estimation-examples.html): 분포를 이용한 행 수 추정
- [행 비교](https://www.postgresql.org/docs/17/functions-comparisons.html): tuple 비교와 NULL
- [CREATE TABLE](https://www.postgresql.org/docs/17/sql-createtable.html): TEMP와 통계 수집의 제약
- [Index-Only Scan](https://www.postgresql.org/docs/17/indexes-index-only-scans.html): covering과 가시성 확인
- [PREPARE](https://www.postgresql.org/docs/17/sql-prepare.html): custom·generic plan
- [CREATE INDEX](https://www.postgresql.org/docs/17/sql-createindex.html): 운영 생성·CONCURRENTLY 제약
