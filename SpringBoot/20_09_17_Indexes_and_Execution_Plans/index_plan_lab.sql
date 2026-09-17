-- PostgreSQL 17 로컬 실습 전용이다. 기존 애플리케이션 테이블은 사용하지 않는다.
-- psql -X -v ON_ERROR_STOP=1 -d til_index_lab -f index_plan_lab.sql 로 실행한다.
-- 실제 실행·성능 측정 결과가 아니라 재현용 스크립트다.
BEGIN; -- 생성한 임시 객체와 데이터를 마지막에 모두 rollback한다.
SET LOCAL statement_timeout = '30s'; -- 각 문장이 지나치게 오래 실행되는 것을 제한한다.
SET LOCAL lock_timeout = '3s'; -- 예상 밖의 잠금 대기를 짧게 제한한다.

CREATE TEMP TABLE til_plan_books ( -- 같은 이름이 이미 있으면 덮어쓰지 않고 실패한다.
    id bigint PRIMARY KEY, -- 기본키 인덱스는 처음부터 존재한다.
    author_id integer NOT NULL, -- 작성자별 목록의 동등 조건이다.
    status text NOT NULL, -- 공개 상태를 필터링한다.
    created_at timestamptz NOT NULL, -- 첫 번째 내림차순 정렬 키다.
    title text NOT NULL, -- 목록에 표시할 값이다.
    body text NOT NULL -- 목록에서는 읽을 필요가 없는 본문이다.
) ON COMMIT DROP; -- 실수로 commit하더라도 임시 테이블은 유지하지 않는다.

INSERT INTO pg_temp.til_plan_books (id, author_id, status, created_at, title, body)
SELECT g, -- 1부터 100000까지를 직접 ID로 넣어 시퀀스를 만들지 않는다.
       ((g - 1) % 1000) + 1, -- 작성자 1000명에게 100개씩 배분한다.
       CASE WHEN (g / 1000) % 5 = 0 THEN 'DRAFT' ELSE 'PUBLISHED' END, -- 각 작성자에 두 상태가 섞인다.
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + ((g * 37) % 40000) * INTERVAL '1 second', -- ID와 다른 시각 순서·동점을 만든다.
       'Book ' || g, -- ID가 드러나는 결정적인 제목이다.
       repeat(md5(g::text), 8) -- 공개하지 않을 256자 본문을 준비한다.
FROM generate_series(1, 100000) AS sample(g); -- 외부 데이터 없이 반복 가능한 입력을 만든다.

ANALYZE pg_temp.til_plan_books; -- 임시 테이블 통계는 실습 세션에서 직접 수집한다.

CREATE TEMP TABLE til_plan_before ON COMMIT DROP AS -- 인덱스 추가 전 첫 페이지 결과를 보관한다.
SELECT id, created_at, title -- 긴 본문은 목록 결과에서 제외한다.
FROM pg_temp.til_plan_books -- pg_temp를 명시해 일반 테이블과 혼동하지 않는다.
WHERE author_id = 42 AND status = 'PUBLISHED' -- 전체 10만 행 중 80행이 조건에 맞는다.
ORDER BY created_at DESC, id DESC -- 생성 시각이 같아도 고유 ID로 순서를 확정한다.
LIMIT 20; -- 첫 페이지 크기는 20이다.

SELECT 'A: primary key only' AS stage; -- 첫 번째 관찰 지점의 이름이다.
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) -- SELECT를 실제 실행해 행 수·버퍼 사용을 확인한다.
SELECT id, created_at, title -- 위와 같은 조회 계약이다.
FROM pg_temp.til_plan_books -- 이 세션의 실습 테이블만 읽는다.
WHERE author_id = 42 AND status = 'PUBLISHED' -- 필터 조건을 고정한다.
ORDER BY created_at DESC, id DESC -- 정렬도 동일하게 유지한다.
LIMIT 20; -- 반환 크기를 바꾸지 않는다.

CREATE INDEX til_plan_author_idx -- 작성자 조건만 돕는 단일 컬럼 인덱스다.
ON pg_temp.til_plan_books (author_id); -- 임시 테이블의 인덱스도 임시 객체다.

SELECT 'B: author index added' AS stage; -- 두 번째 관찰 지점이다.
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) -- 어떤 계획을 고르는지는 플래너에 맡긴다.
SELECT id, created_at, title -- 조회 컬럼을 유지한다.
FROM pg_temp.til_plan_books -- 데이터는 바꾸지 않았다.
WHERE author_id = 42 AND status = 'PUBLISHED' -- 상태는 후처리 필터가 될 수 있다.
ORDER BY created_at DESC, id DESC -- 단일 작성자 인덱스만으로 이 순서가 정해지지는 않는다.
LIMIT 20; -- 같은 첫 페이지다.

CREATE INDEX til_plan_author_status_created_id_idx -- 조건과 정렬을 함께 고려한 후보 인덱스다.
ON pg_temp.til_plan_books (author_id, status, created_at DESC, id DESC); -- 동등 조건 뒤에 정렬 키를 둔다.

SELECT 'C: composite index added; author index retained' AS stage; -- 기존 단일 인덱스도 남아 있다.
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) -- 둘 중 무엇을 선택했는지도 관찰한다.
SELECT id, created_at, title -- 결과 계약을 그대로 유지한다.
FROM pg_temp.til_plan_books -- 같은 데이터·통계로 비교한다.
WHERE author_id = 42 AND status = 'PUBLISHED' -- 앞의 두 인덱스 키를 값 하나로 고정한다.
ORDER BY created_at DESC, id DESC -- 나머지 키 순서로 상위 항목을 읽을 수 있는지 본다.
LIMIT 20; -- 특정 실행 계획 이름이나 소요 시간을 강제하지 않는다.

CREATE TEMP TABLE til_plan_after ON COMMIT DROP AS -- 복합 인덱스 추가 후 첫 페이지 결과를 보관한다.
SELECT id, created_at, title -- 인덱스 전과 동일한 컬럼이다.
FROM pg_temp.til_plan_books -- 본문을 읽지 않는다.
WHERE author_id = 42 AND status = 'PUBLISHED' -- 조회 대상을 유지한다.
ORDER BY created_at DESC, id DESC -- 고유한 순서를 유지한다.
LIMIT 20; -- 같은 페이지 크기다.

CREATE TEMP TABLE til_plan_anchor ON COMMIT DROP AS -- 마지막으로 반환한 한 행의 경계를 보관한다.
SELECT created_at, id -- 커서는 두 키를 모두 보존해야 한다.
FROM pg_temp.til_plan_after -- 첫 페이지에서 찾는다.
ORDER BY created_at ASC, id ASC -- 내림차순 결과의 마지막 행을 앞에 놓는다.
LIMIT 1; -- 경계가 하나만 있어 스칼라 서브쿼리로 사용할 수 있다.

SELECT 'D: next cursor page' AS stage; -- 네 번째 관찰 지점이다.
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) -- tuple 경계가 Index Cond로 쓰이는지 확인한다.
SELECT id, created_at, title -- 같은 목록 컬럼이다.
FROM pg_temp.til_plan_books -- 커서에 해당하는 행을 다시 찾을 필요는 없다.
WHERE author_id = 42 AND status = 'PUBLISHED' -- 첫 페이지와 같은 필터 범위다.
  AND (created_at, id) < (SELECT created_at, id FROM pg_temp.til_plan_anchor) -- 두 키를 사전식으로 비교한다.
ORDER BY created_at DESC, id DESC -- 조건의 방향과 정렬을 맞춘다.
LIMIT 20; -- 여기서 offset을 추가하지 않는다.

DO $verify$ -- 실행 계획 모양이 아닌 데이터·정렬·경계의 불변 조건을 검사한다.
DECLARE -- 검증에 필요한 지역 변수다.
    before_ids bigint[]; -- 인덱스 전 첫 페이지의 정렬된 ID들이다.
    after_ids bigint[]; -- 인덱스 후 첫 페이지의 정렬된 ID들이다.
    cursor_ids bigint[]; -- tuple 커서로 읽은 다음 페이지다.
    expanded_ids bigint[]; -- OR로 풀어 쓴 경계로 읽은 다음 페이지다.
    offset_ids bigint[]; -- 변경 없는 데이터에서 offset 20으로 읽은 다음 페이지다.
    anchor_time timestamptz; -- 첫 페이지 마지막 시각이다.
    anchor_id bigint; -- 같은 시각에서의 마지막 ID다.
BEGIN -- 같은 트랜잭션의 임시 데이터만 검사한다.
    IF (SELECT count(*) FROM pg_temp.til_plan_books) <> 100000 THEN -- 입력 건수를 먼저 확인한다.
        RAISE EXCEPTION 'fixture row count mismatch'; -- 준비 단계부터 잘못되면 비교를 중단한다.
    END IF;
    IF (SELECT count(*) FROM pg_temp.til_plan_books WHERE author_id = 42 AND status = 'PUBLISHED') <> 80 THEN -- 선택도를 확인한다.
        RAISE EXCEPTION 'filtered row count mismatch'; -- 예상한 비교 데이터인지 확인한다.
    END IF;

    SELECT array_agg(id ORDER BY created_at DESC, id DESC) INTO before_ids FROM pg_temp.til_plan_before; -- 저장 순서에 기대지 않는다.
    SELECT array_agg(id ORDER BY created_at DESC, id DESC) INTO after_ids FROM pg_temp.til_plan_after; -- 같은 기준으로 다시 정렬한다.
    IF cardinality(before_ids) IS DISTINCT FROM 20 OR before_ids IS DISTINCT FROM after_ids THEN -- 빈 값도 실패하도록 비교한다.
        RAISE EXCEPTION 'first page changed after index creation'; -- 인덱스가 결과 계약을 바꾸면 안 된다.
    END IF;

    SELECT created_at, id INTO STRICT anchor_time, anchor_id FROM pg_temp.til_plan_anchor; -- 경계 행 하나를 반드시 얻는다.
    SELECT array_agg(id ORDER BY created_at DESC, id DESC) INTO cursor_ids -- 다음 결과를 순서까지 비교한다.
    FROM ( -- 먼저 페이지를 제한한 뒤 배열로 모은다.
        SELECT id, created_at FROM pg_temp.til_plan_books -- 목록 식별자와 정렬 키만 필요하다.
        WHERE author_id = 42 AND status = 'PUBLISHED' -- 같은 대상 집합이다.
          AND (created_at, id) < (anchor_time, anchor_id) -- PostgreSQL 행 생성자 비교다.
        ORDER BY created_at DESC, id DESC LIMIT 20 -- 다음 20개만 읽는다.
    ) AS next_page;

    SELECT array_agg(id ORDER BY created_at DESC, id DESC) INTO expanded_ids -- 이전 커서 노트의 OR 조건을 비교한다.
    FROM (
        SELECT id, created_at FROM pg_temp.til_plan_books -- 같은 정렬 키다.
        WHERE author_id = 42 AND status = 'PUBLISHED' -- 같은 필터다.
          AND (created_at < anchor_time OR (created_at = anchor_time AND id < anchor_id)) -- 두 키 경계를 풀어 쓴다.
        ORDER BY created_at DESC, id DESC LIMIT 20 -- 같은 다음 페이지 크기다.
    ) AS next_page;

    SELECT array_agg(id ORDER BY created_at DESC, id DESC) INTO offset_ids -- 데이터가 고정된 경우의 대조 결과다.
    FROM (
        SELECT id, created_at FROM pg_temp.til_plan_books -- 같은 데이터를 읽는다.
        WHERE author_id = 42 AND status = 'PUBLISHED' -- 같은 필터다.
        ORDER BY created_at DESC, id DESC OFFSET 20 LIMIT 20 -- 첫 20개를 건너뛴다.
    ) AS next_page;

    IF cardinality(cursor_ids) IS DISTINCT FROM 20 -- 빈 배열·NULL 결과도 잘못된 결과로 처리한다.
       OR cursor_ids IS DISTINCT FROM expanded_ids -- tuple과 OR의 결과·순서가 같아야 한다.
       OR cursor_ids IS DISTINCT FROM offset_ids THEN -- 데이터가 바뀌지 않은 조건에서 다음 구간도 같아야 한다.
        RAISE EXCEPTION 'next page boundary mismatch'; -- 경계 누락·정렬 변경을 발견한다.
    END IF;
    IF before_ids && cursor_ids THEN -- 배열의 공통 원소는 첫 페이지 중복을 의미한다.
        RAISE EXCEPTION 'cursor page overlaps first page'; -- 배타적 경계를 확인한다.
    END IF;
    IF NOT EXISTS ( -- 첫 다음 행이 같은 시각의 더 작은 ID인지 확인한다.
        SELECT 1 FROM pg_temp.til_plan_books -- 동점 자료가 실제로 경계에 걸리게 준비했다.
        WHERE id = cursor_ids[1] AND created_at = anchor_time AND id < anchor_id -- 배열 인덱스는 PostgreSQL에서 1부터 시작한다.
    ) THEN
        RAISE EXCEPTION 'tie-breaker fixture or cursor logic changed'; -- 시각만 비교하는 잘못된 커서를 놓치지 않는다.
    END IF;
    IF EXISTS (SELECT 1 FROM pg_temp.til_plan_books WHERE author_id = 1001) THEN -- 준비하지 않은 작성자의 빈 결과를 확인한다.
        RAISE EXCEPTION 'empty-result fixture mismatch'; -- 데이터 생성 범위를 확인한다.
    END IF;
    RAISE NOTICE 'PASS: fixture, first-page order, cursor equivalence, tie-breaker, empty result'; -- 이 메시지는 실제 실행 성공 시에만 출력된다.
END;
$verify$;

ROLLBACK; -- 이번 트랜잭션에서 생성한 임시 테이블·인덱스·데이터를 모두 없앤다.
