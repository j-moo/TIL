# Flyway와 DB 스키마 마이그레이션: 데이터를 지키며 구조 변경하기

- 🎯 글의 목표: 테이블·컬럼·인덱스 변경을 버전으로 기록하고, 신규 DB와 기존 DB에 같은 변경을 적용하는 과정을 설명한다.
- 🧩 핵심 키워드: 스키마, DDL, Migration, Schema History, Checksum, migrate·validate·repair, Baseline, Backfill, Expand–Contract
- ⭐ 중요도: ★★★★★ — 애플리케이션 코드가 맞아도 DB 구조와 배포 순서가 맞지 않으면 서비스가 시작되지 않거나 기존 데이터를 잃을 수 있다.
- 📝 한눈에 보는 내용: 도서 테이블에 공개 상태와 조회 인덱스를 추가하며 파일 이름, 적용 이력, 데이터 보충, 검증과 실패 대응을 연결한다.
- 🧱 선수 지식: CREATE TABLE·ALTER TABLE·UPDATE, 기본키, 트랜잭션의 commit·rollback, Spring Boot 설정과 인덱스
- 🔗 이전 노트: [인덱스와 실행 계획](../20_09_17_Indexes_and_Execution_Plans/09_17_Indexes_and_Execution_Plans.md)

> 정리 기준일: 2026-09-19. Spring Boot 연결 예시는 공식 문서에 표시된 4.1.1 구성을, SQL은 PostgreSQL 17을 기준으로 한다. Flyway 세부 버전은 해당 Boot 프로젝트의 의존성 관리 결과로 확인한다. 아래는 독립된 학습 DB에서 따라 해 볼 설명용 파일 구성으로, 이 문서 작성 환경에서 Spring Boot나 PostgreSQL을 실행한 결과는 아니다.

## 1. 들어가며

도서 목록을 빠르게 조회하기 위해 복합 인덱스를 만들었다고 하자. 내 컴퓨터에서는 빨라졌지만 테스트 서버에는 그 인덱스가 없다면 같은 코드를 배포해도 성능이 달라진다. 공개 상태 컬럼까지 빠져 있다면 성능 문제가 아니라 SQL 오류가 발생한다.

Git은 SQL 파일의 변경을 기록할 수 있지만, 그 파일이 어떤 DB에서 실제로 실행되었는지는 알지 못한다. 개발자가 SQL을 하나씩 실행하고 기억하는 방식은 환경이 늘어날수록 누락과 중복이 생기기 쉽다.

**데이터베이스 마이그레이션**은 DB를 한 상태에서 다음 상태로 바꾸는 변경 작업이다. 여기서 스키마는 테이블·컬럼·제약조건·인덱스 등의 구조를 뜻한다. PostgreSQL에서 객체를 묶는 이름 공간인 `public` 같은 schema와 관련은 있지만, 이 글의 “스키마 변경”은 DB 구조 전반을 가리킨다.

Flyway는 변경 파일과 DB의 적용 이력을 비교하여 필요한 작업을 순서대로 실행한다. 올바른 SQL과 배포 계획까지 자동으로 설계해 주지는 않으므로, 변경이 기존 행과 실행 중인 코드에 미치는 영향을 함께 이해해야 한다.

## 2. 전체 흐름부터 보기

```text
Git에 기록한 마이그레이션 파일
  → Flyway가 파일의 버전과 내용을 확인
  → 대상 DB의 flyway_schema_history와 비교
  → 아직 적용하지 않은 변경을 버전 순서로 실행
  → 성공한 변경의 이력을 DB에 기록
  → 애플리케이션이 변경된 구조로 동작
```

같은 DB를 다시 시작할 때 V1부터 무조건 재실행하지 않는다. 이미 성공한 버전은 이력을 보고 건너뛴다. 처음 만드는 DB는 전체 이력을 순서대로 적용하고, V2까지 적용된 DB는 뒤에 추가된 버전부터 진행한다.

| 구분 | 무엇을 기록하거나 확인하는가? |
| --- | --- |
| Git | 변경 파일의 내용과 코드 변경 이력 |
| Flyway 이력 테이블 | 특정 DB에 적용된 마이그레이션의 버전과 결과 |
| DB의 실제 테이블 | 현재 저장 구조와 사용자 데이터 |
| 애플리케이션 테스트 | 새 구조에서 기능이 기대대로 동작하는지 |

이 네 가지는 서로 대체되지 않는다. 이력 테이블에 성공이라고 적혀 있어도, 누군가 나중에 수동으로 컬럼을 지웠다면 실제 구조는 달라져 있다.

## 3. 본문 정리

### 3.1 Hibernate 자동 변경과 Flyway의 책임 구분

JPA의 Entity는 Java 객체와 테이블을 연결하는 매핑이다. Hibernate의 `ddl-auto=update`는 매핑과 DB를 바탕으로 구조 변경을 시도하지만, 팀이 검토한 단계별 SQL 변경 이력을 제공하는 방식은 아니다.

예를 들어 `title`을 `display_title`로 바꿀 때는 단순 컬럼 추가인지, 이름 변경인지, 기존 값을 복사해야 하는지 의도가 필요하다. 데이터의 의미와 구버전 코드의 사용 여부는 매핑만으로 결정하기 어렵다.

이 노트에서는 Flyway가 구조를 변경하고, JPA를 사용하는 프로젝트라면 Hibernate는 `validate`로 매핑에 필요한 구조를 확인하도록 역할을 나눈다. Hibernate 검증도 모든 인덱스·업무 규칙을 검사하는 것은 아니다. 기본 SQL 초기화와 Flyway를 혼용하지 않는 구성은 [Spring Boot 초기화 문서](https://docs.spring.io/spring-boot/how-to/data-initialization.html)를 따른다.

### 3.2 버전 파일의 이름과 불변성

마이그레이션 파일 이름을 읽는 법부터 익힌다.

```text
V2__add_book_status.sql
│ │  └─ 사람이 읽을 변경 설명
│ └──── 버전 2
└────── Versioned Migration

버전과 설명 사이는 밑줄 두 개(__)다.
```

버전은 실행 순서를 정한다. 설명의 알파벳 순서로 실행하지 않는다. 같은 버전에 다른 변경 파일 두 개를 만들면 충돌하므로, 팀에서는 새 번호를 병합 전에 조정하거나 시간 기반 번호 등 일관된 규칙을 정한다.

적용한 버전 파일은 그대로 보존하고 후속 변경을 새 버전으로 추가한다. Flyway는 SQL의 체크섬도 저장한다. 체크섬은 파일 내용 변화 여부를 비교하는 값이며, 이전에 실행한 내용과 현재 파일이 다른지 알아내는 데 사용한다. [Versioned Migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html)

V1에 컬럼을 몰래 추가하면 이미 V1을 실행한 DB와 새로 만든 DB가 다른 구조를 갖게 된다. V2로 추가하면 두 DB 모두 같은 변경을 거칠 수 있다. 이미 공유 환경에 적용된 파일은 주석 보강이나 자동 포맷도 변경으로 감지될 수 있으므로 별도의 설명 문서를 수정하는 편이 낫다.

### 3.3 Spring Boot에 연결하기

다음은 Java·Gradle 기반 Spring Boot 4.1 프로젝트의 `dependencies`에 추가할 구성 조각이다. 기존 Boot 플러그인과 의존성 관리가 설정되어 있다고 가정한다. Starter를 추가해도 별도 Flyway CLI나 Gradle용 Flyway 플러그인이 설치되는 것은 아니다.

```groovy
dependencies {
    // 애플리케이션의 JDBC 데이터 접근을 위한 구성이다.
    implementation 'org.springframework.boot:spring-boot-starter-jdbc'

    // Boot 시작 과정에서 Flyway를 자동 설정하도록 연결한다.
    implementation 'org.springframework.boot:spring-boot-starter-flyway'

    // Flyway가 PostgreSQL 고유 동작을 처리하는 DB 지원 모듈이다.
    runtimeOnly 'org.flywaydb:flyway-database-postgresql'

    // Java에서 PostgreSQL 서버에 접속하기 위한 JDBC Driver다.
    runtimeOnly 'org.postgresql:postgresql'
}
```

JPA 프로젝트는 기존 `spring-boot-starter-data-jpa`를 사용하면 된다. 위 JDBC Starter가 반드시 추가로 필요한 것은 아니다. Boot 3 계열은 Flyway 의존성 구성이 다를 수 있으므로 프로젝트 버전에 맞는 문서를 확인한다.

`src/main/resources/application.yml`은 다음처럼 구성한다. DB는 미리 생성되어 있어야 하며 접속 계정에는 학습 테이블과 이력을 생성할 권한이 필요하다.

```yaml
spring:
  datasource:
    # 이 값은 별도의 로컬 학습 DB를 가리키는 JDBC URL로 제공한다.
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  flyway:
    enabled: true
    # 리소스 폴더의 db/migration 아래에서 변경 파일을 찾는다.
    locations: classpath:db/migration
    # 잘못된 이름의 파일을 조용히 놓치지 않도록 검사한다.
    validate-migration-naming: true
    # 적용 이력과 파일 불일치를 마이그레이션 전에 확인한다.
    validate-on-migrate: true
    # 학습 중에도 실수로 스키마 전체를 비우는 작업을 막는다.
    clean-disabled: true
    # 이미 객체가 있는 DB를 자동으로 기준점 처리하지 않는다.
    baseline-on-migrate: false
  sql:
    init:
      # schema.sql/data.sql과 Flyway가 동시에 구조를 관리하지 않게 한다.
      mode: never
  jpa:
    hibernate:
      # JPA를 함께 쓰는 경우의 설정이다. JDBC만 쓰면 이 부분은 필요 없다.
      ddl-auto: validate
```

Boot는 설정된 Flyway의 `migrate()`를 시작 과정에서 호출한다. 여기서 실패하면 새 애플리케이션 인스턴스가 정상 기동하지 못할 수 있다. 시작 로그에서 DB 접속 실패, SQL 실패, JPA 매핑 검증 실패 중 어느 단계인지 구분한다.

설정 키의 의미와 기본값은 [Spring Boot 공통 설정 속성](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)에서 확인할 수 있다. 이 예제의 JPA 검증은 프로젝트에 실제 매핑된 Entity가 있을 때 적용되며, 아직 추가하지 않은 status 필드를 Entity에서 미리 필수로 요구하면 V1 단계의 기동 검증과 맞지 않을 수 있다.

### 3.4 V1: 최소 구조 만들기

실습은 기존 노트의 임시 테이블이 아닌 영구 테이블 `migration_books`를 사용한다. 아래 SQL은 별도의 파일에 저장해야 한다. Markdown 파일 자체를 Flyway가 읽는 것은 아니다.

```text
src/main/resources/db/migration/
  V1__create_migration_books.sql
  V2__add_book_status.sql
  V3__backfill_book_status.sql
  V4__require_book_status.sql
  V5__add_book_list_index.sql
```

처음에는 V1만 넣고 실행한다. 업그레이드 과정을 관찰하려면 이후 버전을 단계적으로 추가해야 한다.

`V1__create_migration_books.sql`:

```sql
-- PostgreSQL이 ID를 생성한다. 이 값은 행을 구별하는 기본키다.
CREATE TABLE migration_books (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    -- 작성자별 조회 조건에 사용할 값이다.
    author_id BIGINT NOT NULL,
    -- 제목이 없는 도서는 저장하지 못하도록 DB에서도 제한한다.
    title VARCHAR(120) NOT NULL,
    -- 생성 시각과 ID를 함께 사용해 동점이 있는 목록도 정렬한다.
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

V1은 아직 공개 상태를 모르는 첫 버전이다. `IF NOT EXISTS`로 이미 존재하는 테이블을 무조건 건너뛰지 않는다. 같은 이름의 잘못된 구조가 있을 때 조용히 성공하는 것보다 문제를 발견하는 것이 이 실습의 목적이다.

Gradle Wrapper가 있는 프로젝트 루트에서 환경 변수를 제공한 뒤 `./gradlew.bat bootRun`으로 시작한다. 성공하면 DB 도구에서 테이블과 이력을 확인하고 애플리케이션을 종료한다. 다음 SQL은 마이그레이션 파일이 아니라 V1 DB에 넣는 **수동 학습 데이터**다.

```sql
-- 구버전에서 이미 저장했던 데이터 두 행을 흉내 낸다.
INSERT INTO migration_books (author_id, title, created_at)
VALUES
    (42, '트랜잭션 입문', TIMESTAMPTZ '2026-09-01 09:00:00+09'),
    (42, '조회 계획 읽기', TIMESTAMPTZ '2026-09-02 09:00:00+09');
```

이 데이터를 V1에 함께 넣지 않은 이유는 실습 데이터와 운영 구조 이력을 구분하기 위해서다. 마이그레이션에 필요한 공통 기준 데이터는 포함할 수 있지만 개인 테스트 도서를 모든 환경에 자동 삽입할 필요는 없다.

### 3.5 V2: 기존 행이 받을 값을 먼저 생각하기

새 기능에서 도서는 `DRAFT` 또는 `PUBLISHED` 상태를 갖는다. 기존 도서는 공개 여부를 기록하지 않았으므로, 이 예제에서는 모두 초안으로 간주한다. 이는 SQL 문법이 정해 주는 사실이 아니라 업무 규칙이다.

`V2__add_book_status.sql`:

```sql
-- 먼저 NULL을 허용해 기존 데이터가 있는 테이블에도 컬럼을 추가한다.
ALTER TABLE migration_books ADD COLUMN status VARCHAR(20);

-- 상태 컬럼을 모르는 구버전 코드가 INSERT할 때 초안을 기본값으로 넣는다.
-- 기본값은 이후 삽입에 적용되며 기존 NULL 행을 소급해서 채우지 않는다.
ALTER TABLE migration_books ALTER COLUMN status SET DEFAULT 'DRAFT';
```

V2 적용 직후 기존 두 행의 상태는 `NULL`이다. 이후 INSERT에서 status 컬럼을 생략하면 `DRAFT`가 들어간다. 반면 명시적으로 `status = NULL`을 전달하면 기본값이 대신 들어가지 않는다.

기본값은 누락된 입력을 처리하는 규칙이고, `NOT NULL`은 NULL 저장을 금지하는 제약이다. 둘은 같은 기능이 아니다. [PostgreSQL 테이블 변경](https://www.postgresql.org/docs/17/ddl-alter.html)

### 3.6 V3·V4: 기존 데이터 보충 후 제약 강화하기

Backfill은 새 구조에 맞게 기존 행의 값을 채우는 작업이다. 이 실습에서는 기존 도서의 NULL 상태를 초안으로 바꾼다.

`V3__backfill_book_status.sql`:

```sql
-- NULL인 행만 변경한다. 이미 명시된 공개 상태는 보존한다.
UPDATE migration_books
SET status = 'DRAFT'
WHERE status IS NULL;
```

`V4__require_book_status.sql`:

```sql
-- V3가 기존 행을 채운 뒤에 NULL을 금지한다.
-- 아직 NULL이 남아 있으면 이 단계는 실패하므로 원인을 확인할 수 있다.
ALTER TABLE migration_books ALTER COLUMN status SET NOT NULL;

-- 오타나 알 수 없는 상태값도 DB에 저장하지 못하게 한다.
ALTER TABLE migration_books
ADD CONSTRAINT ck_migration_books_status
CHECK (status IN ('DRAFT', 'PUBLISHED'));
```

처음부터 V4를 실행하면 NULL인 기존 행 때문에 실패한다. 애플리케이션이 값을 검증하더라도 배치·수동 SQL 등 다른 쓰기 경로가 있을 수 있어 DB 제약의 의미가 남는다.

작은 학습 DB에서는 V2~V4를 한 번에 적용해도 과정을 확인할 수 있다. 운영에서 파일을 세 개로 나누었다고 배포도 자동으로 세 단계가 되는 것은 아니다. 같은 릴리스에 들어간 대기 파일은 계속 적용되므로, 중간에 코드 배포나 장시간 데이터 보충이 필요하다면 릴리스 자체를 나누어야 한다.

대량 UPDATE는 행 잠금·트랜잭션 로그·복제 지연을 유발할 수 있다. 운영의 큰 테이블은 ID 범위별 보충, 진행 위치 저장, 재실행 조건을 별도 작업으로 설계한다. 그동안 새 NULL이 생기지 않는 쓰기 경로도 먼저 확보해야 한다.

### 3.7 V5: 검토한 인덱스를 변경 이력에 넣기

이전 노트에서 다룬 작성자·상태별 최신 목록에 맞춰 복합 인덱스를 추가한다.

`V5__add_book_list_index.sql`:

```sql
-- 동등 조건 author_id·status 뒤에 정렬 키를 둔다.
-- 작은 학습 DB에서 일반 CREATE INDEX 동작을 확인하는 예제다.
CREATE INDEX idx_migration_books_author_status_recent
ON migration_books (author_id, status, created_at DESC, id DESC);
```

이력이 남으면 다른 DB에도 같은 인덱스 정의를 적용할 수 있다. 하지만 성능 향상은 데이터 분포와 실행 계획으로 별도 확인해야 한다. 두 행뿐인 테이블에서 전체 스캔이 선택되어도 마이그레이션 실패를 뜻하지 않는다.

일반 인덱스 생성은 쓰기를 막을 수 있다. PostgreSQL의 `CREATE INDEX CONCURRENTLY`는 쓰기를 허용하며 생성하는 선택지지만 더 많은 작업과 대기가 필요하고 트랜잭션 블록 안에서 실행할 수 없다. 실패 후 유효하지 않은 인덱스가 남을 수도 있다. [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/17/sql-createindex.html)

이를 Flyway에서 사용할 때는 일반 SQL에 단어만 추가하지 말고 별도 마이그레이션과 비트랜잭션 실행 설정, PostgreSQL용 Flyway 잠금 설정을 사용하는 버전의 문서에서 함께 확인한다. 이미 적용한 V5를 수정하는 방식으로 전환하지 않는다.

### 3.8 실제 적용 이력과 데이터를 읽기

V2~V5를 추가하고 다시 시작한 뒤, 같은 학습 DB 연결에서 아래 조회를 실행한다. 예제는 기본 schema에 이력 테이블을 생성한 경우다.

```sql
-- 파일과 DB가 어떤 버전까지 연결되었는지 확인한다.
SELECT installed_rank, version, description, script, checksum, success
FROM flyway_schema_history
ORDER BY installed_rank;

-- 기존 도서가 없어지지 않았고 새 상태가 채워졌는지 확인한다.
SELECT id, title, status, created_at
FROM migration_books
ORDER BY id;
```

예상 결과는 V1~V5 성공 이력과 기존 도서 두 행의 `DRAFT` 상태다. `installed_rank`는 실제 설치 순서이고 `version`은 파일의 버전이다. 기준점이나 반복 마이그레이션도 있을 수 있어 항상 같은 숫자라고 가정하지 않는다.

한 번 더 시작했을 때 성공한 버전이 추가로 재실행되지 않는지도 확인한다. 이력 테이블은 실행 판단에 사용되므로 오류를 숨기려고 행을 직접 지우면 안 된다. [Flyway Schema History Table](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/flyway-schema-history-table)

### 3.9 validate는 무엇을 보장할까?

Flyway `validate`는 적용 이력과 현재 마이그레이션 파일의 일치 여부를 확인한다. 체크섬이 달라졌거나 필요한 파일이 없어졌다면 배포 산출물과 적용 이력을 조사할 근거가 된다. [Validate](https://documentation.red-gate.com/flyway/reference/commands/validate)

그러나 `validate`는 전체 테이블을 읽어 설계대로 만들어졌는지 비교하는 스키마 차이 분석기가 아니다. 수동 변경 탐지는 별도의 구조 비교가 필요하고, 데이터 보존이나 API 응답은 쿼리와 테스트로 확인해야 한다.

| 검증 | 확인하는 질문 |
| --- | --- |
| Flyway validate | 실행했던 파일과 현재 파일이 일치하는가? |
| Hibernate validate | Entity 매핑에 필요한 DB 구조가 맞는가? |
| 데이터 검증 SQL | 기존 값과 행이 의도대로 보존·변환되었는가? |
| 기능 테스트 | 목록·등록·수정 등 실제 기능이 동작하는가? |

### 3.10 실패와 repair를 구분하기

트랜잭션을 사용할 수 있는 마이그레이션은 기본적으로 파일 단위로 확정된다. V2가 성공하고 V3가 실패하면 V2까지 자동으로 취소되는 것은 아니다. DB와 SQL이 rollback을 지원하는지에 따라서 실패한 파일의 부분 변경이 남을 수도 있다. [Migration Transaction Handling](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/migration-transaction-handling)

따라서 장애 시에는 실패 버전, 원본 SQL, 로그, 이력, 실제 객체를 함께 확인한다. 연결 권한 오류와 데이터 제약 위반을 같은 방식으로 해결할 수 없다.

`repair`는 이력 테이블을 정리·조정하는 명령이다. 실패한 이력 정리나 체크섬 정렬 등을 수행하지만, 남은 테이블을 원래대로 복구하거나 빠진 컬럼을 만들어 주지 않는다. 잘못된 위치 설정으로 실행하면 누락된 파일을 삭제된 것으로 표시할 수도 있어 `migrate`와 같은 locations가 필요하다. [Repair](https://documentation.red-gate.com/flyway/reference/commands/repair)

예를 들어 이미 적용된 V2를 실수로 수정해 체크섬 오류가 났다면, 우선 Git에서 배포 당시 파일을 확인해 원래 내용으로 되돌리고 필요한 변경은 V6로 만든다. 변경된 파일을 그대로 승인하는 repair를 먼저 실행하면 서로 다른 구조를 가진 DB가 같은 이력처럼 보일 수 있다.

SQL 실행 중 실패한 경우에는 자동 rollback 여부를 확인하고 남은 객체를 처리한 다음 재실행 계획을 세운다. 이력 변경이 필요한 경우에만 repair를 별도로 검토한다. `clean`은 이력 정리가 아니라 관리 스키마의 객체를 제거하는 기능이므로 운영 장애 해결 절차로 사용하지 않는다.

### 3.11 기존 DB에 처음 도입할 때: baseline

기존 서비스의 DB에는 이미 테이블과 데이터가 있지만 Flyway 이력이 없을 수 있다. 이때 V1의 `CREATE TABLE`부터 실행하면 테이블 중복 오류가 난다.

`baseline`은 기존 DB를 특정 버전까지의 상태로 간주하도록 이력의 출발점을 정한다. 기준 버전 이하의 버전 마이그레이션은 제외된다. 테이블을 만들어 주거나 기존 구조가 그 버전과 같은지 증명하는 작업은 아니다. [Baseline](https://documentation.red-gate.com/flyway/reference/commands/baseline)

예를 들어 기존 구조가 V1과 동일함을 검토한 DB에 기준 버전 1을 정하면 이후 V2부터 적용할 수 있다. 빈 신규 DB는 V1부터 만들어야 한다. 그래서 신규 생성 경로와 기존 DB 도입 경로를 각각 검증해야 한다.

`baseline-on-migrate`를 오류 회피 목적으로 켜면 잘못 연결한 DB를 정상 출발점으로 받아들일 위험이 있다. 대상·구조·기준 버전을 확인한 뒤 도입한다. 이름이 비슷한 `B...` baseline migration 파일은 새로운 환경의 출발 구조를 만드는 별도 개념이므로 baseline 명령과 혼동하지 않는다.

### 3.12 반복 마이그레이션은 언제 사용할까?

Versioned Migration은 순차적인 변화에 적합하다. 반면 Repeatable Migration은 버전 없이 체크섬이 바뀔 때 다시 적용하는 파일이다. 한 migrate 실행 안에서는 대기 중인 버전 마이그레이션 이후에 적용한다. [Repeatable Migrations](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/repeatable-migrations)

대표적인 예는 매번 현재 정의로 교체할 수 있는 뷰다. 아래 선택 예제의 파일명은 `R__published_book_titles.sql`이다.

```sql
-- V2 이후에 존재하는 status를 사용해 공개 도서만 노출하는 뷰를 정의한다.
-- 같은 정의를 다시 적용해도 도서 데이터가 중복 INSERT되지 않는다.
CREATE OR REPLACE VIEW published_book_titles AS
SELECT id, title
FROM migration_books
WHERE status = 'PUBLISHED';
```

반복 실행되는 파일에 무조건 INSERT를 넣으면 데이터가 중복되거나 제약 위반이 발생할 수 있다. 반복 마이그레이션은 “매 시작마다 아무 작업이나 실행하는 파일”이 아니라 변경 시 다시 실행해도 의미가 유지되도록 작성해야 하는 정의다.

### 3.13 배포 중 구버전과 신버전이 함께 있다면

DB 변경이 성공했어도 구버전 코드가 삭제된 컬럼을 읽으면 오류가 난다. 여러 인스턴스를 순차 교체하는 배포에서는 구버전과 신버전이 잠시 같은 DB를 사용한다.

이를 고려한 패턴이 **Expand–Contract**다. 먼저 호환 가능한 구조를 확장하고, 코드와 데이터를 옮긴 뒤, 더 이상 쓰지 않는 구조를 제거한다.

```text
새 컬럼 추가, 기존 코드가 쓸 기본값 준비
  → 새 구조와 호환되는 코드 배포
  → 기존 데이터 보충과 결과 검증
  → 모든 쓰기 경로가 새 규칙을 지키는지 확인
  → 제약 강화 또는 오래된 구조 제거
```

새 status 컬럼을 모르는 코드가 컬럼 목록을 명시해 INSERT하면 기본값을 사용할 수 있다. 하지만 `INSERT INTO table VALUES (...)`처럼 모든 컬럼의 위치에 의존하는 구버전 코드는 컬럼 추가에도 깨질 수 있다. “컬럼 추가는 언제나 호환된다”가 아니라 실제 SQL과 직렬화·매핑을 확인해야 한다.

애플리케이션을 이전 버전으로 되돌려도 이미 commit한 마이그레이션은 자동 취소되지 않는다. 특히 컬럼 삭제로 잃은 데이터는 컬럼을 다시 만든다고 복원되지 않는다. 호환 가능한 후속 수정, 백업 복구, 서비스 중단 범위를 배포 전에 구분한다.

운영에서는 마이그레이션을 배포 전용 작업으로 실행하고 일반 애플리케이션 계정의 DDL 권한을 제한하는 방식도 사용할 수 있다. 이 경우 새 DB 변경이 끝났다는 조건과 코드 배포 순서를 배포 시스템에서 관리한다.

### 3.14 신규 생성·업그레이드·재시작을 각각 검증하기

빈 DB만 테스트하면 기존 행 변환 오류를 발견하기 어렵다. 반대로 기존 DB만 시험하면 V1부터 재구성하는 경로가 깨져 있어도 모를 수 있다.

| 경로 | 준비와 실행 | 기대 결과 |
| --- | --- | --- |
| 신규 생성 | 빈 학습 DB에 V1~V5 적용 | 전체 테이블·제약·인덱스 생성 |
| 업그레이드 | V1에 도서 두 행 저장 후 V2~V5 적용 | 제목·ID 보존, 상태 DRAFT |
| 재시작 | 같은 파일로 다시 시작 | 성공 버전 재실행 없음 |
| 입력 제약 | 별도 시험에서 NULL·알 수 없는 상태 삽입 | DB가 입력 거부 |
| 불일치 감지 | 폐기 가능한 실습 복사본에서 적용 파일 변경 | 체크섬 검증 실패 |

업그레이드 경로의 간단한 확인 SQL은 다음과 같다. 테스트 DB에서 데이터 두 행만 준비한 상태라는 전제다.

```sql
-- 기존 데이터가 두 행 모두 남고 NULL 상태가 없어야 한다.
SELECT COUNT(*) AS total_rows,
       COUNT(*) FILTER (WHERE status IS NULL) AS missing_status,
       COUNT(*) FILTER (WHERE status = 'DRAFT') AS draft_rows
FROM migration_books;

-- 인덱스 이름뿐 아니라 대상 컬럼과 순서도 확인한다.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'migration_books';
```

첫 조회의 예상값은 `2, 0, 2`다. 행 수가 맞아도 제목이 바뀌었을 수 있으므로 3.8절의 행별 결과와 변경 전 값을 함께 비교한다. 입력 거부 시험은 실패 후 트랜잭션이 중단될 수 있으니 각 시험을 분리해 실행한다.

자동화할 때는 운영과 같은 PostgreSQL 계열의 격리 DB에서 이 세 가지 정상 경로와 실패 경로를 실행한다. H2로만 검사하면 PostgreSQL 전용 문법·잠금·트랜잭션 제약을 재현하지 못할 수 있다. 이 문서의 예상 결과는 실제 검증 완료 로그와 구분한다.

## 4. 적용 관점에서 다시 보기

새 Entity 필드를 추가하거나 성능 개선용 인덱스를 만들 때는 코드 수정과 함께 마이그레이션이 필요한지 확인한다. 변경 대상뿐 아니라 기존 행이 받을 값과 실행 중인 코드의 호환성을 먼저 적으면 SQL 순서가 분명해진다.

실제 구현은 현재 DB 구조 확인, 새 버전 SQL 작성, 신규 생성·업그레이드 시험, SQL 검토, 배포 순서 확인으로 진행한다. 이미 적용된 파일을 고치는 대신 후속 버전을 추가하면 환경별 변경 경로를 설명하기 쉽다.

| 증상 | 먼저 확인할 것 |
| --- | --- |
| 파일을 추가했는데 실행되지 않음 | 패키징된 리소스, 파일 이름, locations, DB 이력 |
| checksum mismatch | 적용 당시 파일과 현재 파일의 차이 |
| 테이블이 이미 존재함 | 기존 DB 도입 여부, 잘못된 연결, 수동 생성 이력 |
| NOT NULL 추가 실패 | 기존 NULL과 새 NULL을 만드는 쓰기 경로 |
| 마이그레이션이 오래 대기함 | DB 잠금, 실행 중 트랜잭션, 작업량 |
| DB 변경 뒤 구버전만 오류 | 삭제·이름 변경·컬럼 순서에 의존하는 SQL |

성공 조건은 “애플리케이션이 시작했다”보다 넓다. 변경 이력이 맞고, 기존 데이터가 보존되고, 새 제약과 기능이 동작하며, 다음 재시작에서도 같은 상태를 유지해야 한다.

## 5. 배운 점과 확장 포인트

### 5.1 새로 이해한 것

DB 구조도 코드와 함께 진화하지만 이미 저장된 데이터와 실행 중인 코드가 있어 변경 비용이 다르다. 새 컬럼 하나에도 기본값·기존 값 보충·제약·호환성이라는 여러 결정이 따른다.

Flyway는 적용 순서와 이력을 관리한다. SQL의 업무적 정답, 실제 구조의 수동 변경, 실행 계획 개선 여부는 각각 따로 검증해야 한다.

### 5.2 이전·다음 학습과 연결

이전의 인덱스 노트가 “어떤 인덱스가 필요한가”를 다뤘다면 이번 노트는 “검토한 구조 변경을 각 환경에 어떻게 전달하는가”를 다룬다. 데이터 접근·트랜잭션·운영 설정이 배포 과정에서 만나는 지점이다.

다음은 **낙관적 잠금과 동시 수정 충돌**이다. 스키마를 일관되게 관리한 뒤에도 두 요청이 같은 행을 동시에 변경하면 한쪽 수정이 사라질 수 있다. 버전 컬럼과 트랜잭션 경계로 이러한 충돌을 감지하고 응답하는 방법으로 이어진다.

## 6. 요약 정리

1. 마이그레이션은 DB를 다음 상태로 옮기는 변경이며 Git 파일과 DB 적용 이력을 연결한다.
2. 이미 적용된 버전 파일은 보존하고 추가 변경은 새 버전으로 만든다.
3. 기존 데이터가 있는 컬럼 변경은 값 보충과 제약 적용 순서를 함께 설계한다.
4. Flyway 검증, Entity 매핑 검증, 데이터·기능 검증은 서로 다른 질문에 답한다.
5. 실패 시 rollback 범위는 파일 경계·DB·SQL에 따라 다르다.
6. repair는 이력을 조정하며 실제 데이터나 테이블을 자동 복구하지 않는다.
7. 코드 롤백과 DB 롤백은 다르므로 구버전과 신버전의 공존을 고려한다.
8. 빈 DB 생성·기존 DB 업그레이드·재시작을 모두 검사한다.

🧠 기억할 것: **구조 변경의 성공은 SQL 실행뿐 아니라 이력·데이터·코드 호환성이 함께 맞는 상태다.**

## 7. 미니 퀴즈

1. 이미 적용한 V2에 컬럼 추가 SQL을 덧붙이면 신규 DB와 기존 DB에 어떤 차이가 생기는가?
2. status 기본값을 DRAFT로 지정했는데 기존 행이 NULL인 이유는 무엇인가?
3. V2 성공 후 V3가 실패했다. 전체 DB가 V1으로 돌아갔다고 판단해도 되는가?
4. Flyway validate가 성공했는데 수동으로 삭제한 컬럼이 있다. 어떤 검증이 더 필요한가?
5. 구버전 코드가 실행 중일 때 컬럼 이름을 즉시 바꾸면 왜 문제가 되는가?
6. repair와 baseline은 각각 무엇을 바꾸며 무엇을 보장하지 않는가?

<details>
<summary>정답과 해설</summary>

1. 기존 DB에는 원래 V2가 이미 적용되어 새 SQL이 실행되지 않고 체크섬 불일치가 발생할 수 있다. 신규 DB에는 수정된 V2가 실행될 수 있어 같은 버전의 의미가 달라진다. 새 V3 등으로 변경을 추가한다.
2. 이후 입력에 대한 기본값을 지정했기 때문이다. 기존 행은 UPDATE로 보충하고, 명시적 NULL 입력을 금지하려면 별도로 NOT NULL이 필요하다.
3. 아니다. 기본 파일 단위 트랜잭션이라면 V2는 이미 확정되었다. V3 자체도 DB와 SQL의 rollback 지원 여부를 확인해야 한다.
4. 실제 구조 비교, 필요 시 Hibernate 매핑 검증, 해당 컬럼을 사용하는 기능 테스트가 필요하다. Flyway validate는 파일과 이력의 일치 검증이다.
5. 구버전은 이전 컬럼 이름으로 SQL을 실행하기 때문이다. 구조 확장, 코드 전환, 데이터 보충, 구구조 제거를 호환 가능한 순서로 나눈다.
6. repair는 이력 테이블을 조정하지만 실제 DB 변경을 복구하지 않는다. baseline은 기존 DB의 출발 버전을 기록하지만 구조가 그 버전과 같음을 증명하지 않는다.

</details>

## 참고 자료

- [Spring Boot Database Initialization](https://docs.spring.io/spring-boot/how-to/data-initialization.html)
- [Flyway Versioned Migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html)
- [Flyway Validate](https://documentation.red-gate.com/flyway/reference/commands/validate)
- [Flyway Repair](https://documentation.red-gate.com/flyway/reference/commands/repair)
- [Flyway Baseline](https://documentation.red-gate.com/flyway/reference/commands/baseline)
- [Flyway Transaction Handling](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/migration-transaction-handling)
- [Flyway Repeatable Migrations](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/repeatable-migrations)
- [PostgreSQL 17 ALTER TABLE](https://www.postgresql.org/docs/17/ddl-alter.html)
- [PostgreSQL 17 CREATE INDEX](https://www.postgresql.org/docs/17/sql-createindex.html)
