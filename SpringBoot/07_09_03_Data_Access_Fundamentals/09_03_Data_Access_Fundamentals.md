# Spring Boot 데이터 접근 기초: JDBC·JPA·Spring Data JPA 이해하기

- 🎯 글의 목표: 데이터베이스 연결부터 SQL 실행과 객체 변환까지의 흐름을 이해하고, JDBC·Spring JDBC·JPA·Hibernate·Spring Data JPA가 각각 어느 문제를 해결하는지 구분한다.
- 🧩 핵심 키워드: JDBC Driver, Connection, DataSource, Connection Pool, JdbcClient, JdbcTemplate, RowMapper, ORM, JPA, Hibernate, EntityManager, Persistence Context, Spring Data JPA, Repository
- ⭐ 중요도: ★★★★★ — 데이터 접근 기술의 층위를 모르면 Repository 인터페이스가 어떻게 동작하는지, SQL은 언제 실행되는지, 연결과 트랜잭션은 누가 관리하는지 설명하기 어렵다.
- 📝 한눈에 보는 내용: 애플리케이션은 JDBC Driver와 DataSource를 통해 데이터베이스 연결을 얻는다. Spring JDBC는 반복적인 연결·예외 처리 코드를 줄이면서 SQL을 직접 사용한다. JPA는 객체와 관계형 테이블을 매핑하는 표준이고 Hibernate는 대표 구현체다. Spring Data JPA는 JPA 위에서 Repository 구현과 쿼리 생성의 반복을 줄인다.
- 🔗 관련 주제: SQL, 외부 설정, Repository 패턴, Entity, 영속성 컨텍스트, 연관관계, 트랜잭션, 데이터베이스 마이그레이션, 테스트
- 🧱 선수 지식: 테이블·행·열·기본키, SELECT·INSERT·UPDATE·DELETE, Java 인터페이스·예외·제네릭, Spring Bean과 생성자 주입

---

## 1. 들어가며

Spring Boot 예제에서는 다음과 같은 인터페이스만 작성해도 데이터가 저장된다.

```java
public interface BookRepository extends JpaRepository<Book, Long> {
}
```

개발자가 구현 클래스를 만들지 않았는데 `save`, `findById`, `findAll`을 호출할 수 있다. 이 모습을 처음 보면 다음 개념이 모두 하나의 기술처럼 느껴질 수 있다.

- JDBC
- DataSource
- Connection Pool
- JPA
- Hibernate
- Spring Data JPA
- Repository

하지만 서로 다른 층의 도구다. 실제 요청 한 번에는 다음과 같은 긴 흐름이 숨어 있다.

```text
Controller
  → Service
  → Repository
  → Spring Data JPA가 만든 Proxy 구현
  → JPA EntityManager
  → Hibernate
  → JDBC
  → DataSource와 Connection Pool
  → JDBC Driver
  → 데이터베이스
```

이번 노트에서는 코드를 외우기 전에 각 층이 무엇을 책임지는지 분리한다.

> 이 문서는 2026년 9월 3일의 Spring Boot 4.1, Spring Framework 7.0, Spring Data JPA, Jakarta Persistence 3.2 공식 문서를 확인해 작성했다. Starter 이름, 설정 기본값과 API는 프로젝트가 사용하는 버전 문서를 우선한다.

## 2. 가장 아래에서 시작하는 전체 지도

| 층 | 대표 대상 | 핵심 책임 |
| --- | --- | --- |
| 데이터베이스 | MySQL, PostgreSQL, Oracle, H2 | 데이터를 저장하고 SQL 실행 |
| JDBC Driver | DB별 Driver | 표준 JDBC 호출을 DB 통신으로 변환 |
| JDBC API | `Connection`, `PreparedStatement`, `ResultSet` | Java에서 관계형 DB를 다루는 표준 |
| 연결 관리 | `DataSource`, HikariCP | 연결 생성·대여·반납 |
| Spring JDBC | `JdbcClient`, `JdbcTemplate` | JDBC 반복 코드와 예외 처리 단순화 |
| JPA | Jakarta Persistence API | 객체-관계 매핑과 영속성 관리 표준 |
| JPA Provider | Hibernate | JPA 표준을 실제로 구현하고 SQL 생성 |
| Spring Data JPA | `Repository`, `JpaRepository` | Repository 구현·쿼리 작성 반복 감소 |
| 애플리케이션 | Service, Repository Adapter | 비즈니스 사용 사례와 저장 경계 표현 |

📌 핵심: **Spring Data JPA는 JDBC를 없애지 않는다. 높은 수준의 추상화 아래에서 결국 JDBC와 데이터베이스가 동작한다.**

## 3. 관계형 데이터베이스와 SQL 복습

책을 저장하는 테이블을 생각해 보자.

```sql
CREATE TABLE books (
    id BIGINT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    author VARCHAR(50) NOT NULL,
    price INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL
);
```

```text
books 테이블
┌────┬──────────────┬────────┬───────┬─────────────────────┐
│ id │ title        │ author │ price │ created_at          │
├────┼──────────────┼────────┼───────┼─────────────────────┤
│  1 │ Spring Start │ Kim    │ 24000 │ 2026-09-03 10:00:00 │
└────┴──────────────┴────────┴───────┴─────────────────────┘
```

### 3.1 CRUD와 SQL

```sql
-- Create
INSERT INTO books (title, author, price, created_at)
VALUES ('Spring Start', 'Kim', 24000, CURRENT_TIMESTAMP);

-- Read
SELECT id, title, author, price, created_at
FROM books
WHERE id = 1;

-- Update
UPDATE books
SET price = 22000
WHERE id = 1;

-- Delete
DELETE FROM books
WHERE id = 1;
```

JPA를 사용하더라도 데이터베이스가 이해하는 최종 작업은 SQL이다. ORM을 배우기 전에 테이블·키·JOIN·제약·인덱스와 SQL을 알아야 생성된 SQL을 검증할 수 있다.

## 4. JDBC는 무엇인가

JDBC는 Java 애플리케이션이 관계형 데이터베이스에 접근하는 표준 API다.

```text
Java 애플리케이션
  → JDBC 표준 인터페이스 호출
  → DB 제조사가 제공한 JDBC Driver
  → DB별 네트워크 프로토콜
  → 데이터베이스
```

JDBC가 없으면 MySQL, PostgreSQL 등 데이터베이스마다 서로 다른 통신 코드를 직접 작성해야 한다. JDBC는 다음 공통 계약을 제공한다.

- 연결 얻기
- SQL 준비하기
- Parameter 바인딩하기
- SQL 실행하기
- 결과 행 읽기
- commit·rollback하기
- 자원 닫기

### 4.1 JDBC Driver

Driver는 JDBC 인터페이스 호출을 특정 데이터베이스가 이해하는 통신으로 바꾸는 구현체다.

```groovy
dependencies {
    runtimeOnly 'com.mysql:mysql-connector-j'
}
```

```xml
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
</dependency>
```

Driver가 없으면 URL과 계정이 맞아도 데이터베이스에 연결할 수 없다. 데이터 접근 Starter와 실제 DB Driver는 역할이 다르다.

## 5. 순수 JDBC 흐름

다음 코드는 JDBC의 핵심 단계를 보여 주는 교육용 예제다.

```java
public Optional<Book> findById(DataSource dataSource, long bookId)
        throws SQLException {

    String sql = """
            SELECT id, title, author, price
            FROM books
            WHERE id = ?
            """;

    try (Connection connection = dataSource.getConnection();
         PreparedStatement statement = connection.prepareStatement(sql)) {

        statement.setLong(1, bookId);

        try (ResultSet resultSet = statement.executeQuery()) {
            if (!resultSet.next()) {
                return Optional.empty();
            }

            Book book = new Book(
                    resultSet.getLong("id"),
                    resultSet.getString("title"),
                    resultSet.getString("author"),
                    resultSet.getInt("price")
            );

            return Optional.of(book);
        }
    }
}
```

코드 한 번에 다음 일이 들어 있다.

```text
1. DataSource에서 Connection 대여
2. SQL 문자열 준비
3. PreparedStatement 생성
4. Parameter 바인딩
5. 쿼리 실행
6. ResultSet의 현재 행 이동
7. 각 Column을 Java 값으로 읽기
8. Book 객체 생성
9. ResultSet·Statement·Connection 닫기
```

SQL을 정확하게 통제할 수 있지만 매번 반복되는 코드가 많다. Spring JDBC는 이 반복을 줄인다.

## 6. `PreparedStatement`와 Parameter 바인딩

다음처럼 사용자 입력을 SQL 문자열에 이어 붙이면 안 된다.

```java
String sql = "SELECT * FROM books WHERE title = '" + title + "'";
```

입력에 SQL 문법이 섞이면 SQL Injection으로 이어질 수 있고 escaping도 어렵다.

```java
String sql = "SELECT * FROM books WHERE title = ?";
PreparedStatement statement = connection.prepareStatement(sql);
statement.setString(1, title);
```

SQL 구조와 값을 분리한다.

```text
SQL 구조  → SELECT ... WHERE title = ?
입력값    → title Parameter
```

Spring JDBC와 JPA에서도 Parameter 바인딩 기능을 사용한다. 직접 문자열을 조립하지 않는 원칙은 변하지 않는다.

## 7. Connection은 왜 관리해야 하는가

데이터베이스 연결은 단순 Java 객체보다 생성 비용이 크다.

```text
매 요청마다 새 연결 생성
  → 네트워크 연결
  → 인증
  → DB Session 준비
  → SQL 실행
  → 연결 종료
```

요청마다 연결을 새로 만들고 끊으면 지연과 DB 부하가 커진다. 그래서 일정 수의 연결을 미리 만들고 재사용하는 Connection Pool을 사용한다.

```text
Connection Pool
┌─────────────────────────────┐
│ Connection 1: 사용 중       │
│ Connection 2: 대기          │
│ Connection 3: 대기          │
└─────────────────────────────┘
          ↑ 대여       ↓ 반납
      애플리케이션 요청
```

### 7.1 연결을 닫는다는 의미

Pool 환경에서 `connection.close()`는 보통 실제 네트워크 연결을 끊기보다 Pool에 반납한다. 반납하지 않으면 사용 가능한 연결이 고갈된다.

```text
Connection Leak
  → 대여만 하고 반납하지 않음
  → Pool의 모든 연결 사용 중
  → 다음 요청이 연결을 기다림
  → timeout과 장애 확산
```

## 8. DataSource와 Connection Pool

`DataSource`는 Connection을 얻는 표준 인터페이스다. 애플리케이션 코드는 구체적인 Pool 구현보다 DataSource 계약에 의존할 수 있다.

```java
public class BookRepository {
    private final DataSource dataSource;

    public BookRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }
}
```

```java
import javax.sql.DataSource;
```

JPA 애너테이션은 `jakarta.persistence.*`를 사용하지만 JDBC의 `DataSource`는 Java SE에 포함된 `javax.sql.DataSource`다. `javax`라는 이름만 보고 오래된 import라고 판단해 바꾸면 안 된다. 두 타입은 서로 다른 표준에 속하므로 역할과 소속을 함께 확인한다.

Spring Boot 공식 문서는 `spring-boot-starter-jdbc`나 `spring-boot-starter-data-jpa`를 사용하면 일반적으로 HikariCP 의존성이 함께 제공되고, 사용 가능한 경우 HikariCP를 우선 선택한다고 설명한다.

```text
spring.datasource.* 설정
  → Spring Boot DataSource 자동 설정
  → HikariDataSource Bean
  → Connection Pool 준비
  → JdbcClient·JdbcTemplate·JPA가 공통으로 사용
```

### 8.1 기본 설정

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/reading
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
```

Driver class는 URL에서 추론할 수 있는 경우가 많다. 필요하지 않은 설정을 습관적으로 복사하지 않는다.

### 8.2 Secret은 설정 파일에 커밋하지 않는다

```yaml
# 피해야 할 예시
spring:
  datasource:
    username: root
    password: real-production-password
```

운영 비밀값은 환경 변수나 배포 플랫폼의 Secret 기능으로 제공한다. 이전 외부 설정 노트의 원칙을 그대로 적용한다.

### 8.3 Pool 크기는 크게만 잡으면 좋은가

아니다. 연결 수는 애플리케이션 인스턴스 수와 DB가 감당할 수 있는 연결 수를 함께 고려해야 한다.

```text
인스턴스 10개 × Pool 최대 30개
  → 이론상 DB 연결 최대 300개
```

너무 작으면 대기가 늘고, 너무 크면 DB가 과부하될 수 있다. 트래픽·쿼리 시간·트랜잭션 길이·DB 제한을 측정해 조정한다.

## 9. Spring Boot 자동 설정은 무엇을 해 주는가

필요한 클래스와 설정이 있으면 Spring Boot는 다음 기반을 자동 구성할 수 있다.

- DataSource
- Connection Pool
- JdbcTemplate
- NamedParameterJdbcTemplate
- JdbcClient
- JPA EntityManagerFactory
- Transaction Manager
- Spring Data Repository 탐색

자동 설정은 데이터베이스를 설계하거나 SQL 성능을 보장해 주지 않는다.

```text
Boot가 줄여 주는 것
  → 반복적인 Bean 생성과 기본 연결 구성

개발자가 결정할 것
  → Schema, Query, Index, Transaction 경계, Pool 크기, 오류 정책
```

## 10. Spring JDBC

Spring JDBC는 SQL을 직접 작성하되 JDBC의 반복적인 자원 관리와 예외 변환을 줄인다.

대표 선택지는 다음과 같다.

| 도구 | 특징 |
| --- | --- |
| `JdbcTemplate` | 오래 검증된 Callback 기반 JDBC 도구 |
| `NamedParameterJdbcTemplate` | `:name` 형태의 이름 Parameter 사용 |
| `JdbcClient` | Spring Framework 6.1부터 제공되는 fluent JDBC API |

Spring Boot 4.1 공식 문서는 JdbcTemplate과 JdbcClient를 자동 설정하여 Bean으로 주입할 수 있다고 설명한다.

### 10.1 의존성

```groovy
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-jdbc'
    runtimeOnly 'com.mysql:mysql-connector-j'
}
```

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>

<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
</dependency>
```

## 11. JdbcClient로 SQL 실행하기

### 11.1 단건 조회

```java
@Repository
public class JdbcBookRepository {
    private final JdbcClient jdbcClient;

    public JdbcBookRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<Book> findById(long bookId) {
        String sql = """
                SELECT id, title, author, price, created_at
                FROM books
                WHERE id = :bookId
                """;

        return jdbcClient.sql(sql)
                .param("bookId", bookId)
                .query(this::mapBook)
                .optional();
    }

    private Book mapBook(ResultSet resultSet, int rowNumber)
            throws SQLException {
        return new Book(
                resultSet.getLong("id"),
                resultSet.getString("title"),
                resultSet.getString("author"),
                resultSet.getInt("price"),
                resultSet.getTimestamp("created_at").toInstant()
        );
    }
}
```

### 11.2 목록 조회

```java
public List<Book> findAll() {
    String sql = """
            SELECT id, title, author, price, created_at
            FROM books
            ORDER BY id DESC
            """;

    return jdbcClient.sql(sql)
            .query(this::mapBook)
            .list();
}
```

### 11.3 INSERT

```java
public int save(Book book) {
    String sql = """
            INSERT INTO books (title, author, price, created_at)
            VALUES (:title, :author, :price, :createdAt)
            """;

    return jdbcClient.sql(sql)
            .param("title", book.getTitle())
            .param("author", book.getAuthor())
            .param("price", book.getPrice())
            .param("createdAt", Timestamp.from(book.getCreatedAt()))
            .update();
}
```

반환값은 영향을 받은 행 수다. 생성된 ID가 필요하면 사용하는 Spring 버전의 generated key API를 확인해 명시적으로 처리한다.

## 12. JdbcTemplate과 RowMapper

같은 조회를 JdbcTemplate으로 표현할 수 있다.

```java
private static final RowMapper<Book> BOOK_ROW_MAPPER =
        (resultSet, rowNumber) -> new Book(
                resultSet.getLong("id"),
                resultSet.getString("title"),
                resultSet.getString("author"),
                resultSet.getInt("price"),
                resultSet.getTimestamp("created_at").toInstant()
        );

public Optional<Book> findById(long bookId) {
    String sql = """
            SELECT id, title, author, price, created_at
            FROM books
            WHERE id = ?
            """;

    List<Book> books = jdbcTemplate.query(
            sql,
            BOOK_ROW_MAPPER,
            bookId
    );

    return books.stream().findFirst();
}
```

`RowMapper`는 ResultSet의 한 행을 Java 객체 하나로 바꾼다.

```text
ResultSet 한 행
  id=1, title=Spring, author=Kim
          ↓ RowMapper
Book 객체 하나
```

SQL Column 이름과 Java 필드가 다르거나 타입 변환이 필요하면 Mapper에서 경계를 명확히 처리한다.

## 13. Spring JDBC가 줄여 주는 것과 남겨 두는 것

### 줄여 주는 것

- Connection·Statement·ResultSet 자원 정리
- 반복적인 JDBC Callback
- SQLException을 Spring의 일관된 DataAccessException 계층으로 변환
- Parameter 바인딩 API
- 결과 매핑 편의

### 개발자가 계속 책임지는 것

- SQL 작성
- JOIN과 집계
- Index를 활용하는 Query 설계
- Column과 객체 매핑
- 반환 행 수 의미
- Transaction 경계
- Schema 변경

Spring JDBC는 SQL을 숨기지 않는다. SQL 통제와 단순한 실행 흐름이 중요한 경우 장점이 된다.

## 14. 예외 변환

JDBC는 DB별 SQLException과 SQLState, vendor code를 제공한다. 애플리케이션이 DB별 예외에 직접 결합되면 DB 교체와 공통 처리가 어렵다.

Spring은 이를 `DataAccessException` 계층으로 변환한다.

```text
MySQL SQLException
PostgreSQL SQLException
Oracle SQLException
        ↓ Spring 예외 변환
DataIntegrityViolationException 등
```

그러나 `DataIntegrityViolationException` 하나만으로 어떤 비즈니스 제약이 위반되었는지 항상 안전하게 알 수 있는 것은 아니다. 제약 이름과 DB 설정을 관리하고, 내부 SQL 원문을 API 응답에 노출하지 않는다.

## 15. ORM이 해결하려는 문제

객체와 관계형 데이터는 구조와 생명주기가 다르다.

```text
Java 객체
├─ 참조로 관계 표현
├─ 상속과 캡슐화
└─ 객체 그래프 탐색

관계형 DB
├─ 외래키로 관계 표현
├─ 행과 열
└─ JOIN으로 데이터 결합
```

이 차이를 흔히 Object-Relational Impedance Mismatch라고 부른다. JDBC에서는 개발자가 SQL과 RowMapper로 직접 차이를 연결한다. ORM은 매핑 메타데이터를 바탕으로 이 작업의 많은 부분을 자동화한다.

```java
Book book = entityManager.find(Book.class, 1L);
```

이 짧은 호출 뒤에서 ORM은 Entity metadata를 읽고 SQL을 생성하며 결과 행을 객체로 만든다.

## 16. JPA와 Hibernate는 다르다

### 16.1 JPA

JPA는 Jakarta Persistence 표준이다. 다음과 같은 계약과 애너테이션을 정의한다.

- `@Entity`, `@Id`, `@Column`
- `EntityManager`
- Persistence Context
- JPQL
- Entity 생명주기
- 연관관계 매핑
- Transaction과의 결합 방식

JPA 자체는 인터페이스와 동작 규약이며 혼자 SQL을 실행하는 제품이 아니다.

### 16.2 Hibernate

Hibernate ORM은 JPA의 대표적인 구현체다.

```text
애플리케이션 코드
  → JPA 표준 API
  → Hibernate 구현
  → 생성된 SQL
  → JDBC
  → 데이터베이스
```

### 16.3 비유

```text
JPA       → 운전면허 시험의 공통 규칙
Hibernate → 그 규칙을 구현한 실제 차량
```

정확히 같은 대상은 아니지만 “표준과 구현체”의 차이를 기억하는 데 도움이 된다.

## 17. Spring Data JPA는 무엇인가

Spring Data JPA는 JPA 위에서 Repository 구현의 반복을 줄이는 Spring Data 모듈이다.

```java
public interface BookJpaRepository
        extends JpaRepository<BookEntity, Long> {

    Optional<BookEntity> findByIsbn(String isbn);
}
```

개발자가 구현 클래스를 쓰지 않아도 Spring Data가 시작 시점에 Repository Proxy를 만든다.

```text
BookJpaRepository 인터페이스 탐색
  → Generic 타입에서 Entity와 ID 타입 확인
  → 기본 CRUD 구현 조합
  → 메서드 이름에서 Query 해석
  → Proxy Bean 등록
  → Service 생성자에 주입
```

📌 핵심: **Spring Data JPA는 JPA를 대체하지 않고 JPA를 사용하기 쉽게 만든다. JPA는 Hibernate를 대체하지 않고 구현체가 따라야 할 표준을 정의한다.**

## 18. 의존성으로 보는 차이

### 18.1 Spring JDBC

```groovy
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-jdbc'
    runtimeOnly 'com.mysql:mysql-connector-j'
}
```

### 18.2 Spring Data JPA

```groovy
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    runtimeOnly 'com.mysql:mysql-connector-j'
}
```

Spring Boot 공식 문서에 따르면 JPA Starter는 주요하게 다음을 포함한다.

- Hibernate
- Spring Data JPA
- Spring Framework의 ORM 지원

Starter 하나가 “JPA 그 자체”는 아니다. 관련 라이브러리와 자동 설정을 편리하게 모은 의존성 묶음이다.

## 19. 최소 Entity 미리 보기

Entity와 영속성 컨텍스트는 다음 노트에서 깊게 다루므로 여기서는 데이터 접근 층위를 이해할 최소 형태만 본다.

```java
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "books")
public class BookEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 50)
    private String author;

    protected BookEntity() {
        // JPA가 객체를 생성할 때 사용할 수 있는 기본 생성자다.
    }

    public BookEntity(String title, String author) {
        this.title = title;
        this.author = author;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }
}
```

### 19.1 Entity는 DTO가 아니다

Entity는 Persistence Context에서 식별성과 생명주기를 관리하는 영속 객체다. API 요청·응답 계약은 DTO로 분리한다.

```text
CreateBookRequest
  → 외부 입력 계약

BookEntity
  → DB 매핑과 영속성 생명주기

BookResponse
  → 외부 출력 계약
```

## 20. EntityManager 미리 보기

JPA의 중심 인터페이스는 `EntityManager`다.

```java
@Repository
public class JpaBookRepository {
    private final EntityManager entityManager;

    public JpaBookRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public void save(BookEntity book) {
        entityManager.persist(book);
    }

    public Optional<BookEntity> findById(long bookId) {
        return Optional.ofNullable(
                entityManager.find(BookEntity.class, bookId)
        );
    }
}
```

`persist`와 `find`는 SQL 한 줄을 단순히 감싼 메서드가 아니다. EntityManager는 Persistence Context를 통해 Entity 상태와 동일성을 관리한다.

```text
EntityManager.find
  → Persistence Context에 이미 있는지 확인
  → 필요하면 SELECT
  → 결과를 Entity로 구성
  → 관리 상태로 등록
```

SQL 실행 시점과 변경 감지, flush는 다음 Entity·영속성 컨텍스트 노트에서 자세히 다룬다.

## 21. Spring Data Repository 인터페이스

Spring Data의 Repository 추상화에는 목적에 따라 여러 기반 인터페이스가 있다.

| 인터페이스 | 대략적인 역할 |
| --- | --- |
| `Repository<T, ID>` | Repository marker와 선택적 메서드 노출 |
| `CrudRepository<T, ID>` | 기본 CRUD |
| `ListCrudRepository<T, ID>` | 여러 결과를 List로 반환하는 CRUD |
| `PagingAndSortingRepository<T, ID>` | 페이지·정렬 기능 |
| `JpaRepository<T, ID>` | JPA 관련 기능과 List 기반 CRUD 등 |

사용하는 Spring Data 버전에서 상속 관계와 제공 메서드를 확인한다. 필요한 기능을 기준으로 인터페이스를 선택하고, 편하다는 이유만으로 모든 메서드를 외부에 그대로 노출하지 않는다.

```java
public interface BookRepository
        extends JpaRepository<BookEntity, Long> {
}
```

Generic 타입 두 개의 의미는 다음과 같다.

```text
JpaRepository<BookEntity, Long>
              └ Entity 타입  └ ID 타입
```

## 22. 메서드 이름으로 Query 만들기

Spring Data JPA는 정해진 규칙의 메서드 이름을 해석해 Query를 만들 수 있다.

```java
public interface BookRepository
        extends JpaRepository<BookEntity, Long> {

    Optional<BookEntity> findByIsbn(String isbn);

    List<BookEntity> findAllByAuthorOrderByTitleAsc(String author);

    boolean existsByIsbn(String isbn);
}
```

```text
findAllByAuthorOrderByTitleAsc
├─ findAll: 여러 결과 조회
├─ ByAuthor: author 조건
└─ OrderByTitleAsc: title 오름차순
```

### 22.1 이름이 너무 길어지는 신호

```java
findAllByAuthorAndPriceLessThanEqualAndPublishedAtAfterOrderByTitleAsc(...)
```

조건이 복잡하면 메서드 이름이 읽기 어려워진다. 다음 선택지를 검토한다.

- `@Query`와 JPQL
- Projection
- Specification
- Querydsl
- Custom Repository 구현
- 요구에 따라 Spring JDBC나 jOOQ

도구 선택보다 Query의 목적과 예상 SQL을 먼저 설명할 수 있어야 한다.

## 23. Repository Proxy는 누가 만드는가

Repository 인터페이스에는 `@Repository`가 없어도 Spring Data가 설정 범위에서 발견해 Proxy Bean을 만들 수 있다.

```text
애플리케이션 시작
  → Repository interface scan
  → 구현 전략과 Query metadata 생성
  → Proxy 객체 생성
  → Spring Bean 등록
```

Service에 실제로 주입되는 것은 개발자가 작성한 인터페이스를 구현하는 Proxy다.

```java
@Service
public class BookService {
    private final BookRepository bookRepository;

    public BookService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }
}
```

컴포넌트 스캔과 Repository 스캔은 관련 있지만 완전히 같은 탐색 규칙이라고 단정하지 않는다. Spring Boot 기본 auto-configuration package 아래에 두면 보통 자동 탐색되며, 별도 위치는 `@EnableJpaRepositories` 등 명시적 설정이 필요할 수 있다.

## 24. JPA Repository 호출의 실제 흐름

```java
BookEntity book = bookRepository.findById(bookId)
        .orElseThrow(() -> new BookNotFoundException(bookId));
```

이를 단계별로 펼치면 다음과 같다.

```text
1. Service가 Repository interface 메서드 호출
2. Spring Data Proxy가 호출 가로챔
3. 기본 CRUD 구현 또는 Query 전략 선택
4. EntityManager에 JPA 작업 요청
5. Hibernate가 Entity mapping 분석
6. 필요 시 SQL 생성
7. JDBC가 DataSource에서 Connection 사용
8. Driver가 DB와 통신
9. ResultSet이 Hibernate로 반환
10. Hibernate가 Entity 생성·관리
11. Repository가 Optional<BookEntity> 반환
```

짧은 메서드 호출 뒤에 여러 계층이 있다는 사실을 알면 로그의 SQL, JDBC 예외, JPA 예외, Spring Data Proxy Stack Trace를 구분할 수 있다.

## 25. Repository 계층의 책임

Repository는 애플리케이션이 저장 기술의 세부사항보다 필요한 저장·조회 의미에 집중하도록 경계를 만든다.

```java
public interface BookStore {
    Book save(Book book);

    Optional<Book> findById(long bookId);

    boolean existsByIsbn(String isbn);
}
```

### 25.1 기술 Repository를 직접 사용할 수도 있다

간단한 CRUD 애플리케이션에서는 Service가 Spring Data Repository를 직접 주입받는 선택도 실용적이다.

```java
private final BookJpaRepository bookRepository;
```

### 25.2 애플리케이션 Port로 한 번 더 분리할 수도 있다

도메인과 JPA Entity를 분리하거나 저장 기술 교체 가능성, 테스트 경계를 중요하게 보면 애플리케이션 인터페이스와 Adapter를 둘 수 있다.

```text
Service
  → BookStore interface
  → JpaBookStoreAdapter
  → Spring Data JpaRepository
```

계층을 늘리는 것 자체가 목표는 아니다. 다음을 기준으로 선택한다.

- 도메인 모델과 Entity가 다른가?
- 여러 저장 기술을 함께 쓰는가?
- Query가 복잡한가?
- 팀이 유지할 수 있는 구조인가?
- 추상화가 실제 변경 경계를 만드는가?

## 26. JDBC와 JPA 중 무엇을 선택할까

| 기준 | Spring JDBC | JPA·Spring Data JPA |
| --- | --- | --- |
| SQL 통제 | 직접 작성해 분명함 | Provider가 생성, 필요 시 JPQL·native query |
| 객체 매핑 | RowMapper 등을 직접 작성 | Entity mapping으로 자동화 |
| 객체 생명주기 | 개발자가 직접 관리 | Persistence Context가 관리 |
| 복잡한 조회 | SQL로 직접 표현 | JPQL·Projection·native query 등 선택 |
| 반복 CRUD | 코드가 더 필요함 | Repository로 빠르게 구현 |
| 학습 포인트 | SQL·JDBC 흐름 | ORM·Entity 상태·fetch·flush |

### JDBC가 자연스러운 경우

- SQL을 정확히 통제해야 한다.
- 복잡한 조회와 집계가 중심이다.
- 객체 그래프보다 명시적인 Query 결과가 중요하다.
- 팀이 SQL 중심으로 작업한다.

### JPA가 자연스러운 경우

- Entity 중심의 생성·변경이 많다.
- 반복 CRUD가 많다.
- 객체 관계와 생명주기를 활용하고 싶다.
- ORM의 동작과 성능을 학습·관리할 수 있다.

한 프로젝트에서 둘을 함께 사용할 수도 있다. 변경은 JPA, 복잡한 보고서 조회는 JDBC처럼 사용 사례에 맞게 선택할 수 있다. 다만 Transaction과 연결 사용 경계를 이해해야 한다.

## 27. H2와 실제 운영 DB

H2 같은 embedded database는 빠른 학습과 테스트에 편리하다.

```groovy
dependencies {
    runtimeOnly 'com.h2database:h2'
}
```

하지만 H2에서 성공했다고 MySQL·PostgreSQL에서도 완전히 같다고 보장되지 않는다.

- SQL dialect 차이
- 예약어 차이
- 대소문자와 collation
- 날짜·시간 타입
- JSON·배열 타입
- 자동 증가 전략
- Transaction과 lock 동작
- Index와 Query Plan

운영 DB와 동일한 엔진을 Testcontainers 등으로 검증할 필요가 있다. H2 Console은 개발용이며 운영에서 활성화하지 않는다.

## 28. Schema는 누가 만드는가

애플리케이션 데이터 모델과 데이터베이스 Schema는 함께 진화해야 한다.

### 28.1 Hibernate DDL 설정

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

대표적인 모드는 보통 다음 의미로 이해한다.

| 값 | 목적 | 주의 |
| --- | --- | --- |
| `none` | 자동 DDL 작업 안 함 | Schema 별도 관리 필요 |
| `validate` | Entity와 Schema 호환 확인 | 변경하지 않음 |
| `update` | 차이를 반영하려 시도 | 운영 변경 이력·안전성 관리에 부적합할 수 있음 |
| `create` | 시작 시 새 Schema 생성 | 기존 데이터 손실 위험 |
| `create-drop` | 시작 생성·종료 삭제 | 학습·격리 테스트용 |

운영에서는 Flyway나 Liquibase 같은 migration 도구로 버전별 변경 SQL을 검토하고 적용하는 방식이 일반적이다.

```text
V1__create_books.sql
V2__add_isbn_to_books.sql
V3__create_index_on_books_isbn.sql
```

### 28.2 `ddl-auto=update`를 운영 기본값으로 두지 않는다

자동 update는 편리하지만 다음을 명확히 통제하기 어렵다.

- 실제 실행될 DDL
- Column 삭제·변환
- 배포 중 lock 시간
- rollback 계획
- 여러 인스턴스 동시 시작
- 변경 검토와 감사 이력

## 29. SQL 초기화와 Migration 도구를 섞을 때

Spring Boot는 `schema.sql`, `data.sql` 같은 초기화 기능도 제공한다. Hibernate DDL과 Flyway·Liquibase, SQL script 초기화를 무계획으로 함께 사용하면 실행 순서와 중복 생성 문제가 생길 수 있다.

```text
Schema 소유자 하나를 결정
  → Flyway?
  → Liquibase?
  → 테스트용 schema.sql?
  → 학습용 Hibernate create-drop?
```

환경별로 누가 Schema를 만들고 데이터를 넣는지 문서화한다.

## 30. Open EntityManager in View 미리 보기

Spring Boot 공식 문서는 웹 애플리케이션에서 기본적으로 Open EntityManager in View 패턴을 등록할 수 있다고 설명한다. 이 설정은 웹 요청 범위까지 EntityManager를 열어 지연 로딩이 가능하게 할 수 있다.

```yaml
spring:
  jpa:
    open-in-view: false
```

OSIV를 끄면 Service Transaction 밖에서 지연 로딩을 시도할 때 오류가 드러날 수 있다. 켜면 Controller·직렬화 단계에서 예상하지 못한 Query가 실행될 수 있다.

```text
OSIV 활성
  → View·JSON 변환 중 Lazy Loading 가능
  → Query 발생 위치가 웹 계층으로 퍼질 위험

OSIV 비활성
  → Transaction 안에서 필요한 데이터 준비 필요
  → 데이터 접근 경계가 더 분명해짐
```

어느 값이 무조건 정답이라기보다 Query 실행 위치와 Transaction 경계를 팀이 통제할 수 있어야 한다. 다음 Entity·연관관계 노트에서 다시 다룬다.

## 31. SQL 로그를 읽는 습관

JPA를 사용할수록 생성된 SQL을 확인해야 한다.

학습 환경에서 SQL 로그를 볼 수 있지만 운영에서 무분별한 상세 로그는 성능·비밀정보 노출 문제가 될 수 있다.

```yaml
spring:
  jpa:
    show-sql: true
```

실제 프로젝트에서는 logging level과 SQL formatter, Parameter 로깅 도구를 버전에 맞게 설정한다.

확인할 내용:

- Query가 몇 번 실행되는가?
- WHERE 조건이 의도와 같은가?
- JOIN이 필요한 방식으로 생성되는가?
- SELECT Column이 과도하지 않은가?
- Pagination이 DB에서 수행되는가?
- Index를 활용할 조건인가?
- 민감한 값이 로그에 노출되지 않는가?

## 32. N+1 문제 미리 보기

책 목록 한 번을 조회했는데 저자 조회가 책 수만큼 추가로 실행될 수 있다.

```text
SELECT books ...       → 1회
SELECT author WHERE id=1
SELECT author WHERE id=2
SELECT author WHERE id=3
...                    → N회
```

총 `1 + N`개의 Query가 발생해 N+1 문제라고 부른다. 원인은 단순히 JPA가 느려서가 아니라 연관관계 fetch 방식과 객체 접근 시점, Query 설계의 조합이다.

해결법을 외우기 전에 SQL 횟수와 필요한 데이터 범위를 측정한다. Fetch Join, EntityGraph, Projection, Batch Fetch 등은 다음 연관관계 노트에서 다룬다.

## 33. Pagination에서 확인할 것

Spring Data는 `Pageable`을 받을 수 있다.

```java
Page<BookEntity> findAllByAuthor(
        String author,
        Pageable pageable
);
```

```text
Page
  → 현재 데이터 + 전체 개수를 위한 count query 가능

Slice
  → 다음 페이지 존재 여부 중심, 전체 count가 필요하지 않을 수 있음
```

데이터가 많을 때 offset pagination은 뒤 페이지로 갈수록 비용이 커질 수 있다. Cursor·keyset pagination은 정렬 기준과 중복 없는 순서를 설계해야 한다.

API가 Page 객체를 그대로 반환하면 Spring Data의 내부 표현이 외부 계약이 될 수 있다. 응답 DTO로 변환해 공개 구조를 통제한다.

## 34. Transaction이 필요한 이유 미리 보기

책 대여는 두 작업이 함께 성공해야 할 수 있다.

```text
1. 책 상태를 대여 중으로 변경
2. 대여 기록 생성
```

첫 번째만 성공하고 두 번째가 실패하면 데이터가 불일치한다. Transaction은 여러 DB 작업을 하나의 논리적 작업 단위로 묶는다.

```text
모두 성공 → commit
하나라도 실패 → rollback
```

Connection의 auto-commit, Spring Transaction Manager, `@Transactional`, 예외와 rollback 규칙은 후속 트랜잭션 노트에서 깊게 다룬다.

## 35. 작은 JDBC 예제로 전체 흐름 연결하기

### 35.1 Schema

```sql
CREATE TABLE books (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    author VARCHAR(50) NOT NULL,
    isbn VARCHAR(13) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL
);
```

### 35.2 저장 모델

```java
public record BookRow(
        Long id,
        String title,
        String author,
        String isbn,
        Instant createdAt
) {
}
```

### 35.3 Repository

```java
@Repository
public class JdbcBookRepository {
    private final JdbcClient jdbcClient;

    public JdbcBookRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<BookRow> findById(long bookId) {
        return jdbcClient.sql("""
                        SELECT id, title, author, isbn, created_at
                        FROM books
                        WHERE id = :bookId
                        """)
                .param("bookId", bookId)
                .query((resultSet, rowNumber) -> new BookRow(
                        resultSet.getLong("id"),
                        resultSet.getString("title"),
                        resultSet.getString("author"),
                        resultSet.getString("isbn"),
                        resultSet.getTimestamp("created_at").toInstant()
                ))
                .optional();
    }

    public boolean existsByIsbn(String isbn) {
        return jdbcClient.sql("""
                        SELECT COUNT(*)
                        FROM books
                        WHERE isbn = :isbn
                        """)
                .param("isbn", isbn)
                .query(Integer.class)
                .single() > 0;
    }
}
```

### 35.4 Service

```java
@Service
public class BookQueryService {
    private final JdbcBookRepository bookRepository;

    public BookQueryService(JdbcBookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    public BookResponse findById(long bookId) {
        BookRow row = bookRepository.findById(bookId)
                .orElseThrow(() -> new BookNotFoundException(bookId));

        return new BookResponse(
                row.id(),
                row.title(),
                row.author(),
                row.isbn(),
                row.createdAt()
        );
    }
}
```

```text
HTTP GET
  → Controller
  → Service
  → JdbcBookRepository
  → JdbcClient
  → JdbcTemplate
  → DataSource
  → Pool Connection
  → Driver
  → SELECT 실행
  → ResultSet
  → BookRow
  → BookResponse
  → JSON
```

## 36. 같은 기능을 Spring Data JPA로 보기

### 36.1 Entity

```java
@Entity
@Table(
        name = "books",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_books_isbn",
                columnNames = "isbn"
        )
)
public class BookEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 50)
    private String author;

    @Column(nullable = false, length = 13)
    private String isbn;

    protected BookEntity() {
    }

    public BookEntity(String title, String author, String isbn) {
        this.title = title;
        this.author = author;
        this.isbn = isbn;
    }

    // getter 생략
}
```

### 36.2 Repository

```java
public interface BookJpaRepository
        extends JpaRepository<BookEntity, Long> {

    boolean existsByIsbn(String isbn);
}
```

### 36.3 Service

```java
@Service
public class BookQueryService {
    private final BookJpaRepository bookRepository;

    public BookQueryService(BookJpaRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    public BookResponse findById(long bookId) {
        BookEntity entity = bookRepository.findById(bookId)
                .orElseThrow(() -> new BookNotFoundException(bookId));

        return BookResponse.from(entity);
    }
}
```

코드는 짧아졌지만 SQL과 연결이 사라진 것은 아니다. Repository Proxy, EntityManager, Hibernate를 거쳐 JDBC가 실행한다.

### 36.4 Repository만 작게 검증하기

데이터 접근 코드는 메서드 이름이 자연스러워 보여도 실제 Query 생성과 매핑이 올바른지 확인해야 한다. `@DataJpaTest`는 전체 웹 애플리케이션 대신 JPA 관련 구성 요소를 중심으로 불러오는 slice test다. 기본적으로 각 테스트를 Transaction 안에서 실행하고 끝난 뒤 rollback하므로 테스트 데이터가 다음 테스트에 남지 않는다.

```java
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

// Controller나 일반 Service 전체가 아니라 JPA 관련 구성에 집중한다.
@DataJpaTest
class BookJpaRepositoryTest {

    // Spring Data가 만든 Repository Proxy를 테스트 객체에 주입한다.
    @Autowired
    private BookJpaRepository bookRepository;

    @Test
    void isbn으로_책의_존재를_확인한다() {
        // given: 중복되지 않는 ISBN을 가진 Entity를 준비한다.
        BookEntity book = new BookEntity(
                "처음 읽는 데이터 접근",
                "샘플 저자",
                "9781234567890"
        );

        // saveAndFlush는 저장 내용을 DB에 반영해 SQL·제약조건 오류를
        // 테스트의 이 지점에서 확인하기 쉽게 만든다.
        bookRepository.saveAndFlush(book);

        // when: 메서드 이름에서 만들어진 exists Query를 실행한다.
        boolean exists = bookRepository.existsByIsbn("9781234567890");

        // then: Repository가 기대한 결과를 돌려주는지 검증한다.
        assertThat(exists).isTrue();
    }
}
```

위 import 경로는 Spring Boot 4.1 기준이다. Spring Boot 3 계열에서는 `DataJpaTest`의 패키지가 다르므로 예제를 무작정 복사하지 말고 프로젝트 버전의 API 문서를 확인한다. 또한 embedded database 테스트만 통과했다고 운영 DB 호환성이 보장되는 것은 아니다. DB 고유 타입·Dialect·제약조건까지 중요하다면 실제 운영 DB와 같은 제품을 사용하는 통합 테스트도 별도로 둔다.

## 37. 오류를 층위별로 읽기

### 37.1 연결 실패

```text
Communications link failure
Connection refused
Connection timeout
```

확인 순서:

1. DB 프로세스가 실행 중인가?
2. host·port·database 이름이 맞는가?
3. 활성 Profile과 최종 datasource URL이 맞는가?
4. 방화벽·네트워크 접근이 가능한가?
5. Driver가 클래스패스에 있는가?

### 37.2 인증 실패

```text
Access denied
password authentication failed
```

계정·비밀번호·DB 권한·Secret 주입을 확인한다. 비밀번호를 로그에 출력하지 않는다.

### 37.3 Schema 불일치

```text
table not found
column not found
Schema-validation failed
```

Migration 적용 여부, Schema, 활성 DB, Entity Column 이름을 확인한다.

### 37.4 제약 위반

```text
unique constraint
not-null constraint
foreign key constraint
```

입력 검증만 추가하고 끝내지 않는다. 동시성에서도 필요한 제약인지 확인하고 애플리케이션 오류로 안전하게 변환한다.

### 37.5 Pool timeout

```text
Connection is not available, request timed out
```

Pool 크기만 늘리기 전에 다음을 확인한다.

- Connection leak
- 너무 긴 Transaction
- 느린 Query
- DB lock 대기
- DB 자체 포화
- 인스턴스 수 대비 총 연결 수

## 38. 자주 하는 오해

### 오해 1. JPA는 데이터베이스다

JPA는 객체와 관계형 DB를 연결하는 표준 API다. 실제 데이터는 MySQL 같은 DB에 저장된다.

### 오해 2. Hibernate와 Spring Data JPA는 같다

Hibernate는 JPA 구현체이고 Spring Data JPA는 JPA 기반 Repository 추상화다.

### 오해 3. Repository 인터페이스가 SQL을 직접 실행한다

Spring Data가 Proxy 구현을 만들고 EntityManager와 Provider를 거쳐 JDBC가 SQL을 실행한다.

### 오해 4. JPA를 쓰면 SQL을 몰라도 된다

생성된 Query, JOIN, Index, lock과 Transaction은 데이터베이스 성능과 정확성에 직접 영향을 준다.

### 오해 5. Connection Pool은 클수록 좋다

애플리케이션 인스턴스 전체와 DB 처리 용량을 함께 봐야 한다.

### 오해 6. H2 테스트가 통과하면 운영 DB도 같다

Dialect, 타입, lock, Query Plan이 다를 수 있다.

### 오해 7. `ddl-auto=update`면 Migration이 필요 없다

운영 Schema 변경의 검토·이력·순서·rollback을 안정적으로 관리하기 어렵다.

### 오해 8. Entity를 그대로 API에 반환해도 된다

영속성 모델과 외부 JSON 계약이 결합되고 지연 로딩·순환 참조·민감 필드 노출이 생길 수 있다.

### 오해 9. `save` 호출 즉시 항상 INSERT가 실행된다

JPA는 Entity 상태, ID 전략, flush 시점, Transaction에 따라 SQL 실행 시점과 종류가 달라질 수 있다.

### 오해 10. Repository가 있으면 Service가 필요 없다

Repository는 저장 경계이고 Service는 여러 작업과 비즈니스 규칙, Transaction 경계를 조정한다.

## 39. 선택 체크리스트

### 공통 기반

- [ ] 사용하는 DB와 JDBC Driver가 맞는가?
- [ ] DataSource URL·계정·Secret이 외부 설정으로 제공되는가?
- [ ] Connection Pool 최대 크기를 전체 인스턴스 관점에서 계산했는가?
- [ ] Schema 변경 주체와 Migration 절차가 정해졌는가?
- [ ] 운영 DB와 호환되는 테스트가 있는가?

### Spring JDBC

- [ ] SQL Parameter를 바인딩하고 문자열로 이어 붙이지 않는가?
- [ ] RowMapper가 Column과 Java 타입을 명확히 변환하는가?
- [ ] 단건·목록·영향받은 행 수의 의미를 확인하는가?
- [ ] 복잡한 SQL의 실행 계획과 Index를 확인하는가?

### JPA·Spring Data JPA

- [ ] JPA와 Hibernate, Spring Data JPA의 역할을 구분하는가?
- [ ] Entity와 요청·응답 DTO를 분리했는가?
- [ ] Repository Generic의 Entity·ID 타입이 맞는가?
- [ ] 메서드 이름 Query가 실제 의도를 읽기 쉽게 표현하는가?
- [ ] 생성된 SQL과 Query 횟수를 확인하는가?
- [ ] OSIV와 Lazy Loading 정책을 팀이 이해하는가?
- [ ] Page 같은 기술 타입을 API 계약으로 그대로 노출하지 않는가?

### 운영 안정성

- [ ] SQL과 오류 로그에 비밀번호·개인정보가 노출되지 않는가?
- [ ] Pool timeout을 크기 증가만으로 해결하려 하지 않는가?
- [ ] 제약 위반을 안전한 비즈니스 오류로 변환하는가?
- [ ] 운영에서 H2 Console과 파괴적인 DDL 설정이 비활성화되어 있는가?

## 40. 배운 점과 다음 학습 연결

### 40.1 이번 노트에서 이해한 것

- JDBC는 Java와 관계형 DB 사이의 표준 API다.
- Driver는 JDBC 호출을 DB별 통신으로 구현한다.
- DataSource와 Pool은 Connection 대여·반납을 관리한다.
- Spring JDBC는 SQL을 유지하면서 JDBC 반복 코드를 줄인다.
- JPA는 ORM 표준이고 Hibernate는 대표 구현체다.
- Spring Data JPA는 JPA 기반 Repository 구현과 Query 생성을 지원한다.
- 짧은 Repository 호출 아래에서도 JDBC와 SQL이 실제로 동작한다.
- Schema와 Migration, Pool, Query 성능은 자동 설정이 대신 결정하지 않는다.

### 40.2 이전 노트와의 연결

외부 설정 노트에서 배운 PropertySource와 Profile이 DataSource URL·계정·Pool 설정을 환경별로 공급한다. Validation·예외 처리 노트의 원칙은 DB 제약 위반을 API 오류로 변환할 때 이어진다.

```text
외부 설정
  → DataSource 구성
  → Repository 데이터 접근
  → Service 비즈니스 규칙
  → 예외 변환
  → REST 오류 응답
```

### 40.3 다음 학습

다음에는 Entity와 연관관계를 깊게 학습한다.

- Entity 생명주기와 Persistence Context
- 비영속·관리·분리·삭제 상태
- 1차 Cache와 동일성
- 변경 감지와 flush
- `@ManyToOne`, `@OneToMany` 연관관계
- 연관관계의 주인과 외래키
- Lazy Loading, N+1과 Fetch 전략

## 41. 요약 정리

1. 데이터 접근 기술은 DB → Driver → JDBC → DataSource → Spring JDBC 또는 JPA → Spring Data 순으로 층을 구분한다.
2. DataSource는 Connection 획득의 표준 계약이고 Pool은 비싼 연결을 재사용한다.
3. Spring JDBC는 SQL을 직접 제어하면서 자원 관리와 예외 변환의 반복을 줄인다.
4. Parameter는 문자열로 조립하지 않고 안전하게 바인딩한다.
5. JPA는 Jakarta Persistence 표준이며 Hibernate는 실제 구현체다.
6. Spring Data JPA는 Repository Proxy와 Query 생성으로 JPA 반복 코드를 줄인다.
7. JPA가 SQL과 JDBC를 없애는 것은 아니므로 생성 SQL을 확인해야 한다.
8. Entity는 Persistence 모델이고 API DTO와 책임이 다르다.
9. H2와 운영 DB의 차이를 인식하고 실제 엔진 호환성을 검증한다.
10. 운영 Schema는 검토 가능한 Migration 이력으로 관리한다.
11. Connection Pool 문제는 Query·Transaction·leak·DB 용량을 함께 진단한다.
12. JDBC와 JPA는 장단점이 다르며 한 프로젝트에서도 사용 사례별로 조합할 수 있다.

## 42. 미니 퀴즈

1. JDBC API와 JDBC Driver의 역할은 어떻게 다른가?
2. `DataSource`와 HikariCP는 어떤 관계인가?
3. Pool 환경에서 `Connection.close()`가 보통 의미하는 것은 무엇인가?
4. Spring JDBC가 줄여 주는 코드와 개발자가 계속 책임질 부분은 무엇인가?
5. SQL 문자열에 사용자 입력을 직접 이어 붙이면 안 되는 이유는 무엇인가?
6. JPA, Hibernate, Spring Data JPA를 각각 한 문장으로 설명할 수 있는가?
7. Repository 인터페이스의 구현 객체는 누가 언제 만드는가?
8. `JpaRepository<BookEntity, Long>`의 두 Generic 타입은 무엇을 뜻하는가?
9. JPA Repository의 `findById`가 실제 DB까지 가는 흐름을 설명할 수 있는가?
10. H2 테스트만으로 운영 DB 동작을 보장할 수 없는 이유는 무엇인가?
11. `ddl-auto=update`를 운영 Migration 전략으로 사용하기 어려운 이유는 무엇인가?
12. OSIV가 Query 실행 위치에 어떤 영향을 줄 수 있는가?
13. Page 객체를 그대로 API 응답으로 반환할 때 어떤 결합이 생기는가?
14. JDBC와 JPA 중 하나를 선택할 때 어떤 기준을 사용할 수 있는가?

<details>
<summary>정답과 해설</summary>

1. JDBC는 Java의 표준 DB 접근 계약이고 Driver는 그 계약을 특정 DB 통신으로 구현한다.
2. DataSource는 표준 인터페이스이며 HikariCP의 HikariDataSource는 연결 풀 기능을 제공하는 구현 중 하나다.
3. 물리 연결 종료보다 Pool에 연결을 반납한다는 의미인 경우가 일반적이다.
4. 자원 정리·Callback·예외 변환을 줄이고, SQL·매핑·성능·Transaction·Schema 책임은 남는다.
5. SQL Injection과 escaping 오류를 막고 SQL 구조와 값을 분리하기 위해 Parameter binding을 사용한다.
6. JPA는 ORM 표준, Hibernate는 대표 JPA 구현체, Spring Data JPA는 JPA Repository 반복 구현을 줄이는 모듈이다.
7. Spring Data가 애플리케이션 시작 과정에서 인터페이스를 탐색하고 Proxy Bean을 만든다.
8. `BookEntity`는 관리할 Entity 타입, `Long`은 기본키 타입이다.
9. Proxy → EntityManager → Hibernate → JDBC → DataSource → Driver → DB 순서로 이어진다.
10. SQL dialect, 타입, 예약어, lock과 Query Plan 등이 실제 DB와 다를 수 있다.
11. 변경 SQL·순서·lock·rollback·감사 이력을 명시적으로 통제하기 어렵기 때문이다.
12. 활성 상태에서는 웹 계층까지 EntityManager가 열려 직렬화 중 Lazy Query가 발생할 수 있다.
13. Spring Data의 표현 구조가 외부 JSON 계약이 되어 내부 버전 변경이 API에 전파될 수 있다.
14. SQL 통제, 객체 생명주기, Query 복잡도, CRUD 비중, 팀 역량과 성능 요구를 함께 본다.

</details>

## 참고 자료

- [Spring Boot Reference - SQL Databases](https://docs.spring.io/spring-boot/reference/data/sql.html)
- [Spring Framework Reference - JDBC Core](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)
- [Spring Data JPA Reference - Getting Started](https://docs.spring.io/spring-data/jpa/reference/jpa/getting-started.html)
- [Spring Data Commons - Defining Repository Interfaces](https://docs.spring.io/spring-data/commons/reference/repositories/definition.html)
- [Jakarta Persistence 3.2 Specification](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)
- [Spring Boot API - DataJpaTest](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html)

> 정리 기준일: 2026-09-04. Starter 구성, 자동 설정 조건, Repository API와 JPA 동작은 프로젝트가 사용하는 Spring Boot·Spring Data·JPA Provider 버전의 공식 문서를 우선한다.
