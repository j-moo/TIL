# SQL 쿼리를 결과 집합의 모양으로 읽기: GROUP BY, EXISTS, LIKE ESCAPE

- 🎯 글의 목표: SQL 문법을 한 줄씩 외우지 않고, 각 절이 결과 행의 모양을 어떻게 바꾸는지 이해한다.
- 🧩 핵심 키워드: SELECT, GROUP BY, 집계 함수, 상관 서브쿼리, EXISTS, NOT EXISTS, SELECT 1, LIKE, 와일드카드, ESCAPE
- ⭐ 중요도: ★★★★★ — 조회 쿼리는 문법보다 “현재 결과에 행이 몇 개이고 각 열이 무엇을 대표하는가”를 이해해야 정확히 작성할 수 있다.
- 📝 한눈에 보는 내용: `GROUP BY`는 여러 행을 그룹별 한 행으로 접고, `EXISTS`는 서브쿼리의 값이 아니라 행의 존재 여부만 확인한다. `LIKE`의 `%`와 `_`를 문자 자체로 찾고 싶다면 `ESCAPE`로 탈출 문자를 정한다.
- 🔗 관련 주제: 집계 함수, HAVING, JOIN, 상관 서브쿼리, 문자열 검색
- 🧱 선수 지식: `SELECT`, `FROM`, `WHERE`의 기본 역할

---

## 1. 들어가며

SQL은 위에서 아래로 읽으면 자연스러운 문장처럼 보이지만, 실제 논리 처리 흐름과 결과 집합의 변화까지 생각하지 않으면 자주 헷갈린다. 특히 다음 세 질문은 단순 암기만으로 해결하기 어렵다.

- 집계 함수가 아닌 열은 왜 `GROUP BY`에 넣어야 하는가?
- `EXISTS` 안에서는 왜 `SELECT 1`을 쓰는가?
- `%`와 `_`가 특별한 의미를 가진다면 그 문자 자체는 어떻게 검색하는가?

세 질문의 공통점은 SQL이 “무슨 값을 반환하는가”와 “어떤 조건만 검사하는가”를 구분하는 데 있다.

## 2. 핵심 개념 정리

쿼리를 읽을 때 다음 흐름을 떠올린다.

```text
FROM / JOIN
  └─ 조회할 행의 출발점
        ↓
WHERE
  └─ 개별 행을 먼저 거른다.
        ↓
GROUP BY
  └─ 남은 행을 그룹으로 묶는다.
        ↓
집계 함수
  └─ 그룹마다 하나의 값을 계산한다.
        ↓
HAVING
  └─ 계산된 그룹을 다시 거른다.
        ↓
SELECT
  └─ 최종 결과에 보여줄 열을 정한다.
```

`EXISTS`와 `LIKE`는 이 흐름 안에서 조건을 표현하는 도구다. `EXISTS`는 하위 조회 결과에 행이 있는지를 묻고, `LIKE`는 문자열이 패턴과 일치하는지를 묻는다.

## 3. 본문 정리

### 3.1 `GROUP BY`는 행을 그룹별 대표 행으로 바꾼다

다음 주문 데이터가 있다고 가정한다.

| id | customer_id | amount |
| ---: | ---: | ---: |
| 1 | 10 | 5000 |
| 2 | 10 | 7000 |
| 3 | 20 | 3000 |

고객별 주문 합계를 구하면 다음과 같다.

```sql
SELECT
    customer_id,
    SUM(amount) AS total_amount
FROM orders
GROUP BY customer_id;
```

처리 결과를 손으로 접어 보면 이해가 쉽다.

```text
customer_id = 10 그룹
  ├─ 5000
  └─ 7000
  → SUM = 12000

customer_id = 20 그룹
  └─ 3000
  → SUM = 3000
```

최종 결과는 그룹마다 한 행이다.

| customer_id | total_amount |
| ---: | ---: |
| 10 | 12000 |
| 20 | 3000 |

### 3.2 일반 열을 `GROUP BY`에 넣어야 하는 이유

다음 쿼리는 문제가 있다.

```sql
SELECT
    customer_id,
    id,
    SUM(amount) AS total_amount
FROM orders
GROUP BY customer_id;
```

`customer_id = 10` 그룹에는 주문 `id`가 1과 2 두 개다. 그러나 결과는 고객별 한 행이어야 한다. 데이터베이스 입장에서는 그 한 행의 `id` 칸에 1을 넣어야 할지 2를 넣어야 할지 결정할 근거가 없다.

```text
customer_id = 10
  id = 1, amount = 5000
  id = 2, amount = 7000

결과 한 행의 id는 무엇인가? → 결정 불가능
```

그래서 `SELECT`에 나타나는 열은 보통 다음 둘 중 하나여야 한다.

1. 그룹의 기준이 되는 열
2. 그룹 전체를 하나의 값으로 계산하는 집계 표현식

```sql
SELECT
    customer_id,          -- 그룹 기준
    COUNT(*) AS count,    -- 그룹의 행 수
    SUM(amount) AS total  -- 그룹의 합계
FROM orders
GROUP BY customer_id;
```

데이터베이스 제품은 함수 종속성 등 특정 조건에서 예외를 허용할 수 있지만, 입문 단계에서는 “최종 한 행에서 값이 하나로 결정되는가?”를 기준으로 판단하는 편이 안전하다.

📌 핵심: 집계되지 않은 일반 열이 그룹마다 여러 값을 가질 수 있다면 결과 한 칸의 값을 결정할 수 없다.

### 3.3 `WHERE`와 `HAVING`의 차이

`WHERE`는 그룹화 전에 개별 행을 거르고, `HAVING`은 그룹화와 집계 뒤에 그룹을 거른다.

```sql
SELECT
    customer_id,
    SUM(amount) AS total_amount
FROM orders
WHERE amount >= 4000
GROUP BY customer_id
HAVING SUM(amount) >= 10000;
```

실행 흐름은 다음과 같다.

1. `amount`가 4000 이상인 주문 행만 남긴다.
2. 남은 주문을 `customer_id`별로 묶는다.
3. 고객별 `SUM(amount)`를 계산한다.
4. 합계가 10000 이상인 고객 그룹만 남긴다.

⚠️ 주의: 집계 결과는 개별 행 단계에는 아직 존재하지 않는다. 따라서 `WHERE SUM(amount) ...`처럼 작성하지 않고 `HAVING`을 사용한다.

### 3.4 `EXISTS`는 값이 아니라 행의 존재를 검사한다

`EXISTS (서브쿼리)`는 서브쿼리가 한 행이라도 찾으면 참이고, 한 행도 찾지 못하면 거짓이다.

회원과 주문 테이블이 있을 때 주문 경험이 있는 회원만 조회해 보자.

```sql
SELECT
    u.id,
    u.name
FROM users AS u
WHERE EXISTS (
    SELECT 1
    FROM orders AS o
    WHERE o.user_id = u.id
);
```

바깥 행마다 안쪽 조회가 조건을 확인한다고 생각하면 된다.

```text
현재 사용자 u.id = 10
        ↓
orders에서 o.user_id = 10인 행이 있는가?
        ↓
있으면 EXISTS = true
        ↓
현재 사용자를 결과에 포함
```

이처럼 안쪽 쿼리가 바깥 쿼리의 현재 행 `u.id`를 참조하면 상관 서브쿼리라고 부른다.

### 3.5 `EXISTS` 안에서 `SELECT 1`을 쓰는 이유

`EXISTS`는 서브쿼리의 열 값을 사용하지 않는다. 행이 존재하는지만 확인한다.

따라서 아래 표현은 존재 여부 관점에서 같은 의도를 가진다.

```sql
EXISTS (SELECT 1 FROM orders WHERE ...)
EXISTS (SELECT o.id FROM orders AS o WHERE ...)
EXISTS (SELECT * FROM orders WHERE ...)
```

`SELECT 1`은 “이 값 1이 필요하다”는 뜻이 아니다. 반환 열은 관심 없고 행의 존재만 검사한다는 의도를 독자에게 보여주는 관례다.

```text
서브쿼리 결과가 다음 중 무엇이든

1
999
'hello'
주문의 모든 열

EXISTS가 보는 것은 오직 행이 0개인가, 1개 이상인가이다.
```

💡 이해 포인트: `SELECT 1`은 성능을 위한 마법 문법으로 외우기보다, 값에 관심이 없다는 가독성 표현으로 이해한다. 실제 최적화 방식은 데이터베이스 실행 계획에 따라 결정된다.

### 3.6 `NOT EXISTS`로 관련 행이 없는 대상을 찾기

주문이 한 번도 없는 회원을 찾으려면 조건을 반대로 만든다.

```sql
SELECT
    u.id,
    u.name
FROM users AS u
WHERE NOT EXISTS (
    SELECT 1
    FROM orders AS o
    WHERE o.user_id = u.id
);
```

`NOT EXISTS`는 “모든 값과 다르다”가 아니라 “조건을 만족하는 행이 하나도 없다”를 표현한다. 관련 데이터 부재를 찾을 때 의미가 분명하다.

### 3.7 `LIKE`의 `%`와 `_`

`LIKE`는 문자열을 패턴으로 비교한다.

| 기호 | 의미 | 예시 |
| --- | --- | --- |
| `%` | 0개 이상의 임의 문자 | `'dev%'`는 `dev`, `developer` 등에 일치 |
| `_` | 정확히 한 개의 임의 문자 | `'A_'`는 `A1`, `AB` 등에 일치 |

```sql
-- dev로 시작하는 값
SELECT name
FROM tags
WHERE name LIKE 'dev%';

-- A 다음에 정확히 한 글자가 오는 값
SELECT code
FROM products
WHERE code LIKE 'A_';
```

### 3.8 `%`나 `_` 자체를 찾는 `ESCAPE`

문자열 안의 `%`를 비율 기호 자체로 찾고 싶어도, `LIKE '%10%%'`처럼 쓰면 어떤 `%`가 와일드카드이고 어떤 `%`가 실제 문자인지 읽기 어렵다.

`ESCAPE`는 패턴 안에서 다음 문자를 문자 그대로 해석하게 할 탈출 문자를 지정한다.

```sql
SELECT label
FROM coupons
WHERE label LIKE '%10!%%' ESCAPE '!';
```

패턴을 나누면 다음과 같다.

```text
%    → 앞에 어떤 문자열이 와도 된다.
10   → 실제 문자 1과 0
!%   → !가 탈출 문자이므로 실제 % 한 글자
%    → 뒤에 어떤 문자열이 와도 된다.
```

따라서 `여름 10% 할인`, `10% coupon` 같은 값에 일치할 수 있다.

밑줄 자체를 찾는 예도 같다.

```sql
SELECT file_name
FROM files
WHERE file_name LIKE '%!_%' ESCAPE '!';
```

여기서 `!_`는 임의의 한 글자가 아니라 실제 밑줄 한 글자를 뜻한다.

⚠️ 주의: 문자열 리터럴과 백슬래시 처리 방식은 데이터베이스 제품과 설정에 따라 차이가 날 수 있다. 학습 예제에서는 `!`처럼 눈에 잘 보이는 탈출 문자를 명시하면 의도를 확인하기 쉽다.

## 4. 적용 관점에서 다시 보기

### 쿼리를 작성하기 전 결과 행을 먼저 그린다

다음 질문을 순서대로 적는다.

1. 결과의 한 행은 무엇을 대표하는가?
2. 한 행에 표시할 열은 그 대표 단위에서 하나로 결정되는가?
3. 조건은 개별 원본 행에 적용하는가, 계산된 그룹에 적용하는가?
4. 관련 데이터의 실제 값이 필요한가, 존재 여부만 필요한가?
5. 패턴 문자가 와일드카드인가, 검색할 실제 문자인가?

### 자주 만나는 오류를 해석하는 기준

| 증상 | 먼저 확인할 것 |
| --- | --- |
| `GROUP BY` 관련 열 오류 | `SELECT`의 일반 열이 그룹마다 하나로 결정되는가? |
| 집계 조건이 동작하지 않음 | `WHERE`가 아니라 `HAVING`이 필요한가? |
| `NOT EXISTS` 결과가 예상과 다름 | 안쪽 조건이 바깥 행과 올바르게 연결되었는가? |
| `%` 또는 `_` 검색 결과가 너무 많음 | 문자를 와일드카드로 해석하고 있지 않은가? |

### 실행 계획으로 확인하기

큰 데이터에서 `EXISTS`, JOIN, 집계의 성능을 비교할 때 문법 모양만으로 결론을 내리지 않는다. 인덱스, 데이터 분포, 데이터베이스 최적화기에 따라 실행 방식이 달라지므로 `EXPLAIN`으로 실행 계획을 확인한다.

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

- `GROUP BY` 뒤의 결과는 원본 행이 아니라 그룹별 행이다.
- 일반 열이 그룹마다 여러 값을 가지면 결과 한 칸을 결정할 수 없다.
- `SELECT 1`의 1은 사용되는 결과값이 아니라 존재 검사의 의도를 나타낸다.
- `ESCAPE`는 와일드카드 문자를 실제 문자로 검색할 수 있게 한다.

### 5.2 이전·다음 학습과의 연결

`GROUP BY`는 Django ORM의 `annotate()`와 집계, 데이터 분석의 그룹 연산으로 이어진다. `EXISTS`는 권한·중복·관련 데이터 유무 확인에 자주 사용하며, `LIKE` 검색은 검색 인덱스와 전문 검색 학습으로 확장된다.

### 5.3 더 확인할 주제

- `NOT IN`과 `NOT EXISTS`의 `NULL` 처리 차이
- 함수 종속성과 `GROUP BY` 예외
- JOIN과 EXISTS의 의미 및 실행 계획 비교
- 대규모 문자열 검색과 인덱스

## 6. 요약 정리

1. `GROUP BY`는 여러 원본 행을 그룹별 결과 행으로 바꾼다.
2. 집계되지 않은 일반 열은 그룹마다 값이 하나로 결정되어야 한다.
3. `WHERE`는 그룹화 전 행, `HAVING`은 그룹화 후 집계 결과를 거른다.
4. `EXISTS`는 서브쿼리의 열 값이 아니라 행 존재 여부를 본다.
5. `SELECT 1`은 값에 관심이 없다는 의도를 보여주는 관례다.
6. `NOT EXISTS`는 조건에 맞는 관련 행이 하나도 없음을 검사한다.
7. `LIKE`의 `%`는 여러 글자, `_`는 한 글자 와일드카드다.
8. `ESCAPE`로 지정한 문자를 사용하면 `%`와 `_` 자체를 검색할 수 있다.

🧠 기억할 것: SQL을 읽을 때는 문법보다 먼저 “최종 결과 한 행과 한 칸이 무엇을 대표하는가”를 그린다.

## 7. 미니 퀴즈 또는 체크리스트

1. 고객별 합계를 구하면서 주문 `id`를 그대로 선택하면 왜 모호한가?
2. 집계 결과가 일정 값 이상인 그룹을 찾을 때 `WHERE`와 `HAVING` 중 무엇을 사용하는가?
3. `EXISTS (SELECT 1 ...)`에서 숫자 1은 최종 결과로 반환되는가?
4. 실제 밑줄 문자가 포함된 값을 `LIKE`로 찾으려면 무엇이 필요한가?
5. `NOT EXISTS` 서브쿼리에서 바깥 테이블과의 연결 조건을 빼면 어떤 문제가 생길 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 한 고객 그룹에 여러 주문 ID가 있을 수 있어 결과 한 행의 ID를 하나로 결정할 수 없다.
2. 그룹화와 집계가 끝난 결과에 적용하므로 `HAVING`을 사용한다.
3. 반환되지 않는다. `EXISTS`는 행이 있는지만 확인한다.
4. `ESCAPE` 절로 탈출 문자를 지정하고 패턴에서 `_` 앞에 붙인다.
5. 각 사용자별 존재 여부가 아니라 주문 테이블 전체의 존재 여부만 검사하는 전혀 다른 조건이 될 수 있다.

</details>

## 참고 자료

- [PostgreSQL: Table Expressions와 GROUP BY](https://www.postgresql.org/docs/current/queries-table-expressions.html)
- [PostgreSQL: Subquery Expressions](https://www.postgresql.org/docs/current/functions-subquery.html)
- [PostgreSQL: Pattern Matching](https://www.postgresql.org/docs/current/functions-matching.html)
