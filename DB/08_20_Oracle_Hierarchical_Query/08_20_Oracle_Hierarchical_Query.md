# Oracle 계층형 쿼리: START WITH, CONNECT BY, PRIOR

- 🎯 글의 목표: 부모·자식 관계로 저장된 데이터를 트리 순서로 조회하는 Oracle 계층형 쿼리의 실행 원리를 이해한다.
- 🧩 핵심 키워드: 계층형 데이터, `START WITH`, `CONNECT BY`, `PRIOR`, `LEVEL`, `NOCYCLE`, `ORDER SIBLINGS BY`
- ⭐ 중요도: ★★★★★ — `PRIOR`가 어느 열에 붙는지에 따라 탐색 방향이 달라지므로 문장을 암기하기보다 부모 행과 자식 행의 관계를 읽어야 한다.
- 📝 한눈에 보는 내용: `START WITH`는 출발할 루트를 고르고, `CONNECT BY`는 다음 행을 찾는 연결 규칙을 정한다. `PRIOR`가 붙은 표현식은 부모 행의 값으로 평가된다.
- 🔗 관련 주제: 자기 참조 외래키, 트리, 재귀 CTE, 조직도·카테고리·댓글 구조
- 🧱 선수 지식: `SELECT`, `WHERE`, 기본키와 외래키

---

## 1. 계층형 데이터란 무엇인가

일반적인 테이블은 행이 나란히 저장되지만, 행 사이에 부모와 자식 관계가 있으면 트리 구조로 해석할 수 있다.

예를 들어 카테고리 테이블이 다음과 같다고 하자.

| category_id | category_name | parent_id |
| ---: | --- | ---: |
| 1 | 전체 상품 | `NULL` |
| 2 | 전자기기 | 1 |
| 3 | 생활용품 | 1 |
| 4 | 노트북 | 2 |
| 5 | 주변기기 | 2 |
| 6 | 키보드 | 5 |

`parent_id`에는 현재 행의 부모가 되는 `category_id`가 저장된다.

```text
전체 상품(1)
├─ 전자기기(2)
│  ├─ 노트북(4)
│  └─ 주변기기(5)
│     └─ 키보드(6)
└─ 생활용품(3)
```

같은 형태는 조직도, 대댓글, 메뉴, 폴더, 상품 분류에서 자주 나타난다.

## 2. 세 문장으로 전체 구조 읽기

```sql
SELECT
    category_id,
    category_name,
    parent_id
FROM category
START WITH parent_id IS NULL
CONNECT BY PRIOR category_id = parent_id;
```

이 쿼리는 다음 세 단계로 읽는다.

```text
FROM category
  → 모든 카테고리 행을 조회 대상으로 삼는다.

START WITH parent_id IS NULL
  → 부모가 없는 루트 행에서 시작한다.

CONNECT BY PRIOR category_id = parent_id
  → 부모의 category_id와 같은 parent_id를 가진 자식을 계속 찾는다.
```

`START WITH`는 **출발점**, `CONNECT BY`는 **연결 규칙**, `PRIOR`는 **부모 행의 값**이다.

## 3. `START WITH`: 어느 행에서 시작할지 고른다

```sql
START WITH parent_id IS NULL
```

`parent_id`가 `NULL`인 행은 부모가 없는 최상위 행이다. 예제에서는 `전체 상품`이 루트가 된다.

```text
전체 상품(category_id = 1, parent_id = NULL)
```

반드시 최상위 행에서 시작해야 하는 것은 아니다. 특정 카테고리의 하위 구조만 조회할 수도 있다.

```sql
START WITH category_id = 2
```

이 경우 `전자기기`가 이번 조회의 루트가 되고 그 아래의 `노트북`, `주변기기`, `키보드`를 탐색한다. 테이블 전체의 루트와 **현재 조회의 루트**는 다를 수 있다.

Oracle 문서에 따르면 `START WITH`를 생략하면 모든 행이 루트 후보가 된다. 같은 행이 여러 경로에서 반복되어 보일 수 있으므로 보통 원하는 출발 조건을 명시한다.

## 4. `CONNECT BY`: 부모에서 다음 자식을 찾는다

```sql
CONNECT BY PRIOR category_id = parent_id
```

`PRIOR category_id`는 부모 행의 `category_id`이고, 오른쪽 `parent_id`는 자식 후보 행의 값이다.

```text
부모의 category_id = 자식의 parent_id
```

첫 탐색을 손으로 따라가 보자.

```text
현재 부모: 전체 상품
부모 category_id = 1
              ↓
parent_id = 1인 행 찾기
              ↓
전자기기, 생활용품
```

다음에는 `전자기기`가 부모가 된다.

```text
현재 부모: 전자기기
부모 category_id = 2
              ↓
parent_id = 2인 행 찾기
              ↓
노트북, 주변기기
```

이 과정을 더 이상 자식이 없을 때까지 반복한다.

## 5. `PRIOR`: 바로 부모 행에서 값을 읽는다

`PRIOR`는 시간상 직전에 출력된 행이라는 뜻이 아니다. 현재 자식 후보를 평가할 때 **계층 경로상 부모 행**의 값을 사용한다는 뜻이다.

```sql
CONNECT BY PRIOR category_id = parent_id
```

다음처럼 이름을 붙이면 덜 헷갈린다.

```text
PRIOR category_id → parent.category_id
parent_id         → child.parent_id
```

### 5.1 `PRIOR` 위치가 바뀌면 방향이 달라진다

위에서 아래로 자식을 찾는 관계는 다음과 같다.

```sql
CONNECT BY PRIOR category_id = parent_id
```

```text
부모 category_id → 자식 parent_id
```

반대로 특정 자식에서 조상 방향으로 올라가려면 부모·자식 관계를 반대로 연결한다.

```sql
SELECT
    LEVEL,
    category_name
FROM category
START WITH category_id = 6
CONNECT BY PRIOR parent_id = category_id;
```

현재 행의 `parent_id`를 다음 행의 `category_id`에서 찾으므로 다음 경로가 만들어진다.

```text
키보드 → 주변기기 → 전자기기 → 전체 상품
```

등호는 좌우를 바꿔도 같지만 `PRIOR`는 특정 표현식에 붙는다. 따라서 기호 위치가 아니라 다음 문장으로 읽는다.

> `PRIOR`가 붙은 값은 부모 행에서 읽고, 붙지 않은 값은 자식 후보 행에서 읽는다.

## 6. `LEVEL`: 현재 깊이를 표시한다

`LEVEL`은 Oracle 계층형 쿼리에서 제공하는 의사 열이다. 현재 조회의 루트는 항상 1, 그 자식은 2, 손자는 3이 된다.

```sql
SELECT
    LEVEL AS depth,
    category_name
FROM category
START WITH parent_id IS NULL
CONNECT BY PRIOR category_id = parent_id;
```

```text
depth 1 → 전체 상품
depth 2 → 전자기기
depth 3 → 주변기기
depth 4 → 키보드
```

들여쓰기를 추가하면 트리 모양을 눈으로 확인할 수 있다.

```sql
SELECT
    LEVEL AS depth,
    LPAD(' ', (LEVEL - 1) * 2) || category_name AS category_path
FROM category
START WITH parent_id IS NULL
CONNECT BY PRIOR category_id = parent_id;
```

`LPAD()`는 공백을 깊이에 맞게 앞에 붙이고, `||`는 Oracle의 문자열 연결 연산자다.

```text
전체 상품
  전자기기
    노트북
    주변기기
      키보드
  생활용품
```

## 7. 같은 부모의 자식만 정렬하기

일반 `ORDER BY`로 전체 결과를 정렬하면 트리 출력 순서가 흐트러질 수 있다. 계층 관계를 유지하면서 같은 부모를 가진 형제 행만 정렬하려면 `ORDER SIBLINGS BY`를 사용한다.

```sql
SELECT
    LEVEL,
    category_name
FROM category
START WITH parent_id IS NULL
CONNECT BY PRIOR category_id = parent_id
ORDER SIBLINGS BY category_name;
```

이 정렬은 전자기기의 자식끼리, 전체 상품의 자식끼리처럼 같은 부모 아래의 행을 정렬한다.

## 8. 잘못된 연결로 생기는 순환과 `NOCYCLE`

데이터가 잘못되어 A의 부모가 B이고 B의 부모가 다시 A라면 탐색 경로가 끝나지 않는 순환이 생긴다.

```text
A → B → A → B → ...
```

`NOCYCLE`은 순환이 있어도 쿼리가 오류로 끝나는 대신 탐색을 계속 반환할 수 있게 한다. 순환 여부를 확인할 때 `CONNECT_BY_ISCYCLE` 의사 열을 함께 사용한다.

```sql
SELECT
    category_id,
    category_name,
    CONNECT_BY_ISCYCLE AS has_cycle
FROM category
START WITH parent_id IS NULL
CONNECT BY NOCYCLE PRIOR category_id = parent_id;
```

`NOCYCLE`은 잘못된 데이터를 고치는 기능이 아니다. 조회가 중단되지 않게 하고 문제 경로를 찾는 도구다. 자기 참조 외래키만으로 모든 긴 순환을 막을 수 있는 것은 아니므로 데이터 입력 정책과 검증도 필요하다.

## 9. `WHERE` 조건과 계층 관계 조건을 구분한다

계층형 쿼리에서 조건을 어디에 두는지에 따라 의미가 달라질 수 있다.

- `START WITH`: 루트 후보를 고른다.
- `CONNECT BY`: 부모와 자식의 연결 가능 여부를 결정한다.
- `WHERE`: 만들어진 계층의 개별 결과 행을 거른다.

예를 들어 비활성 카테고리를 연결 경로 자체에서 제외하려면 연결 조건에 의도를 명시할 수 있다.

```sql
CONNECT BY PRIOR category_id = parent_id
           AND is_active = 'Y'
```

반면 `WHERE is_active = 'Y'`는 계층을 만든 뒤 결과 행을 거르는 의미가 된다. 필요한 동작이 “그 행만 숨기기”인지 “그 행을 경로에서 끊기”인지 먼저 결정해야 한다.

## 10. Oracle 전용 문법과 재귀 CTE

`CONNECT BY` 계열은 Oracle의 대표적인 계층형 조회 문법이다. 다른 데이터베이스로 옮겨야 한다면 표준 SQL 계열의 재귀 CTE(`WITH RECURSIVE`)를 사용하는 경우가 많다.

```text
Oracle
  START WITH       → 재귀의 시작 행
  CONNECT BY       → 부모·자식 연결 규칙
  LEVEL            → 재귀 깊이

재귀 CTE
  anchor query     → 시작 행
  recursive query  → 다음 행 연결
  직접 만든 depth → 재귀 깊이
```

두 방식의 문법은 다르지만 “출발점과 다음 행을 찾는 규칙을 분리한다”는 사고방식은 같다.

## 11. 적용 관점에서 다시 보기

계층형 쿼리를 작성할 때 다음 질문을 순서대로 답한다.

1. 각 행을 유일하게 식별하는 기본키는 무엇인가?
2. 부모를 가리키는 열은 무엇인가?
3. 이번 조회의 시작 행은 무엇인가?
4. 부모의 어떤 값과 자식의 어떤 값이 같아야 하는가?
5. 위에서 아래로 내려가는가, 아래에서 위로 올라가는가?
6. 순환 데이터가 생길 가능성이 있는가?
7. 정렬이 필요하다면 형제끼리 정렬해야 하는가?

## 12. 요약 정리

1. 계층형 데이터는 같은 테이블의 다른 행을 부모로 참조한다.
2. `START WITH`는 조회할 트리의 루트 행을 선택한다.
3. `CONNECT BY`는 부모에서 다음 자식을 찾는 관계 조건이다.
4. `PRIOR`가 붙은 표현식은 부모 행의 값으로 평가된다.
5. `PRIOR`의 위치를 바꾸면 탐색 방향을 바꿀 수 있다.
6. `LEVEL`은 현재 조회의 루트부터 계산한 깊이다.
7. `ORDER SIBLINGS BY`는 트리 구조를 유지하면서 형제 행을 정렬한다.
8. `NOCYCLE`과 `CONNECT_BY_ISCYCLE`은 순환 경로를 진단할 때 사용한다.

🧠 기억할 것: **`START WITH`는 출발점, `CONNECT BY`는 길 찾기 규칙, `PRIOR`는 부모 쪽 값이다.**

## 13. 미니 퀴즈

1. `START WITH parent_id IS NULL`은 어떤 행을 루트로 선택하는가?
2. `CONNECT BY PRIOR category_id = parent_id`에서 `PRIOR category_id`는 어느 행의 값인가?
3. 특정 하위 카테고리에서 조상 방향으로 올라가려면 연결 관계를 어떻게 생각해야 하는가?
4. `LEVEL = 1`은 테이블 전체에서 언제나 최상위인 행이라는 뜻인가?
5. 계층 구조를 유지한 채 같은 부모의 자식 이름을 정렬하려면 무엇을 사용하는가?

<details>
<summary>정답과 해설</summary>

1. 부모가 없는 행을 현재 조회의 루트로 선택한다.
2. 계층 경로상 부모 행의 `category_id`다.
3. 현재 행의 부모 ID와 다음 행의 기본키를 연결해 자식에서 부모로 이동한다.
4. 아니다. `START WITH`로 선택한 현재 조회의 시작 행이 1이다.
5. `ORDER SIBLINGS BY`를 사용한다.

</details>

## 참고 자료

- [Oracle Database SQL Language Reference — SELECT와 계층형 쿼리](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/SELECT.html)
- [Oracle Database SQL Language Reference — 계층형 쿼리 연산자](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/About-SQL-Operators.html)
