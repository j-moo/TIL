# 낙관적 잠금: 동시에 수정한 데이터를 덮어쓰지 않기

- 🎯 글의 목표: JPA `@Version`이 잃어버린 갱신을 감지하는 원리를 이해하고, 오래된 수정 요청을 HTTP 충돌 응답으로 처리한다.
- 🧩 핵심 키워드: Lost Update, Optimistic Locking, `@Version`, flush, 트랜잭션 rollback, 409 Conflict, ETag·If-Match
- ⭐ 중요도: ★★★★★ — 트랜잭션을 사용해도 두 사용자의 수정이 조용히 덮어써질 수 있으므로 데이터 정합성을 지키는 별도 장치가 필요하다.
- 📝 한눈에 보는 내용: 도서 제목 수정 API에 버전 컬럼을 추가하고, 요청 버전의 사전 비교와 JPA의 원자적 버전 검사를 함께 적용한다. 충돌을 재현하는 통합 테스트와 재시도 판단 기준도 정리한다.
- 🧱 선수 지식: JPA Entity·변경 감지·flush, 트랜잭션 commit·rollback, REST 요청·응답 DTO, Flyway 마이그레이션
- 🔗 이전 노트: [Flyway와 DB 스키마 마이그레이션](../21_09_19_Flyway_Schema_Migrations/09_19_Flyway_Schema_Migrations.md)

> 정리 기준일: 2026-09-20. Java 21·Spring Boot 4.1 계열의 이전 JPA 학습 프로젝트를 확장하는 설명용 코드다. 동시성 규칙은 Jakarta Persistence 3.2 명세와 Hibernate ORM 7.1 문서를 참고했다. 실제 Hibernate 버전은 프로젝트의 Spring Boot 의존성 관리 결과로 확인한다. 이 TIL 저장소에는 실행 애플리케이션이 없으므로 Java 컴파일·Spring 테스트를 실행하지 않았으며, SQL과 테스트 결과는 예상임을 구분한다.

## 1. 들어가며: 마지막 저장이 항상 정답은 아니다

두 사용자가 같은 도서 정보를 열었다고 하자.

```text
DB의 현재 제목: "Java 입문", version = 3

사용자 A가 version 3을 읽음 ── 제목을 "Java 기초"로 수정 ── 먼저 저장
사용자 B가 version 3을 읽음 ── 제목을 "자바 첫걸음"으로 수정 ── 나중에 저장
```

버전을 검사하지 않으면 B의 저장이 A의 변경을 조용히 덮을 수 있다. A에게는 저장 성공으로 보였지만 결과에서 A의 변경이 사라진다. 이를 **잃어버린 갱신(lost update)**이라고 한다.

각 요청에 `@Transactional`을 붙여도 이 문제는 자동으로 해결되지 않는다. A와 B의 요청은 각각 올바르게 commit될 수 있기 때문이다. 트랜잭션은 한 요청 안의 작업을 묶지만, 서로 다른 요청이 읽은 데이터가 여전히 최신인지까지 항상 판단해 주지는 않는다.

낙관적 잠금은 “충돌이 자주 일어나지 않을 것”이라고 가정하고 읽을 때 긴 DB 잠금을 잡지 않는다. 대신 저장할 때 **내가 읽었던 버전이 아직 현재 버전인지** 검사한다. 이름에 잠금이 들어가지만 핵심은 장시간 가로막는 것보다 버전 기반의 충돌 감지다.

## 2. 전체 흐름부터 보기

```text
GET /books/1
  → title = "Java 입문", version = 3 응답
  → 사용자가 화면에서 제목 수정

PUT /books/1 { title: "Java 기초", version: 3 }
  → 서버가 현재 Entity와 요청 version 비교
  → JPA가 version을 조건에 넣어 UPDATE 시도
  → 성공: version 3 → 4, 새 응답 반환
  → 실패: 영향받은 행 0개, 충돌 예외와 rollback
  → API가 409 Conflict로 변환
```

이 흐름에는 서로 다른 두 안전망이 있다.

| 안전망 | 잡는 상황 | 필요한 이유 |
| --- | --- | --- |
| 요청 버전 사전 비교 | 사용자가 이미 오래된 화면을 제출함 | DB 쓰기 전에 이해하기 쉬운 업무 충돌로 처리 |
| JPA `@Version` 검사 | 사전 비교 뒤 다른 트랜잭션이 먼저 저장함 | 비교와 저장 사이의 경쟁 조건을 DB UPDATE에서 원자적으로 감지 |

사전 비교만으로는 충분하지 않다. `현재 버전 확인 → UPDATE` 사이에 다른 요청이 끼어들 수 있다. 반대로 `@Version`만 두고 API가 클라이언트의 버전을 받지 않으면, 서버가 매 요청마다 최신 Entity를 다시 읽어 사용자의 오래된 화면이라는 사실을 알아내지 못할 수 있다.

## 3. `@Version`은 어떻게 충돌을 감지하는가?

### 3.1 버전 컬럼을 Entity에 매핑한다

Jakarta Persistence의 `@Version`은 Entity의 개정을 나타내는 필드다. 영속성 제공자인 Hibernate가 값을 읽고 갱신하므로 애플리케이션 코드가 직접 `version++` 하지 않는다.

```java
package com.example.bookstudy.book; // 도서 기능의 패키지다.

import jakarta.persistence.Column; // 컬럼의 null 허용 여부와 이름을 지정한다.
import jakarta.persistence.Entity; // 이 클래스가 JPA Entity임을 표시한다.
import jakarta.persistence.GeneratedValue; // 기본키 생성 전략을 사용한다.
import jakarta.persistence.GenerationType; // IDENTITY 전략 상수를 사용한다.
import jakarta.persistence.Id; // 기본키 필드를 표시한다.
import jakarta.persistence.Table; // 연결할 테이블 이름을 지정한다.
import jakarta.persistence.Version; // 낙관적 잠금용 버전 필드를 표시한다.

@Entity // Hibernate가 생명주기와 변경을 관리하는 Entity다.
@Table(name = "books") // Flyway가 만든 books 테이블과 연결한다.
public class Book {

    @Id // 한 행을 식별하는 기본키다.
    @GeneratedValue(strategy = GenerationType.IDENTITY) // DB가 ID 값을 생성한다.
    private Long id;

    @Column(nullable = false, length = 200) // 제목은 null이 아니며 최대 길이는 200이다.
    private String title;

    @Version // UPDATE·DELETE 때 이전 버전을 조건으로 검사하도록 한다.
    @Column(nullable = false) // 영속화된 행은 항상 버전 값을 가져야 한다.
    private Long version;

    protected Book() { // JPA가 reflection으로 Entity를 만들 때 사용할 생성자다.
    }

    public Book(String title) { // 새 도서를 만들 때는 제목만 받는다.
        this.title = title; // version은 JPA가 영속화 과정에서 관리한다.
    }

    public void changeTitle(String title) { // 외부에서 필드를 직접 바꾸지 않게 의도를 드러낸다.
        this.title = title; // 관리 상태라면 변경 감지가 UPDATE를 준비한다.
    }

    public Long getId() { // 응답 DTO와 테스트가 식별자를 읽는다.
        return id; // 기본키를 반환한다.
    }

    public String getTitle() { // 응답 DTO가 현재 제목을 읽는다.
        return title; // 제목을 반환한다.
    }

    public Long getVersion() { // 클라이언트에게 현재 개정을 전달하기 위해 읽기만 허용한다.
        return version; // 애플리케이션이 직접 수정할 setter는 만들지 않는다.
    }
}
```

이 예제는 숫자형 `Long`을 사용한다. Jakarta Persistence 3.2는 이외에도 `int`·`Integer`·`short`·`Short`·`long`, 그리고 일부 시간 타입을 이식 가능한 버전 타입으로 정의한다. 한 Entity에는 버전 속성을 하나만 두고, 상속 계층이라면 루트 Entity 또는 mapped superclass에 둔다.

새 Entity의 version이 Java에서 처음에는 `null`이어도 영속화할 때 제공자가 초기값을 관리한다. 특정 초기 숫자에 업무 의미를 부여하지 않는다. 버전은 수정 횟수의 대략적인 표식이지 사용자에게 보여 줄 이력 번호나 감사 로그가 아니다.

### 3.2 실제 검사는 조건부 UPDATE에 가깝다

두 트랜잭션이 모두 version 3을 읽었다면 첫 번째 저장의 SQL은 개념적으로 다음과 같다.

```sql
UPDATE books -- 수정할 테이블이다.
SET title = ?, -- 새 제목을 저장한다.
    version = 4 -- 성공하면 다음 버전으로 올린다.
WHERE id = ? -- 같은 도서 행을 찾는다.
  AND version = 3; -- 읽을 때의 버전이 아직 현재인지 확인한다.
```

첫 번째 UPDATE가 성공하면 DB 버전은 4가 된다. 두 번째 트랜잭션이 같은 `version = 3` 조건으로 UPDATE하면 영향받은 행이 0개다. Hibernate는 이를 충돌로 판단해 `OptimisticLockException`을 발생시킨다.

위 SQL은 원리를 보여 주는 단순화된 형태다. 실제 SET 컬럼, 식별자 생성 방식, SQL 순서와 예외의 구체적 클래스는 매핑·제공자·DB에 따라 달라질 수 있으므로 로그에서 확인한다. Hibernate는 보통 UPDATE 또는 DELETE의 조건에 버전을 포함하고 영향 행 수가 0이면 충돌을 판단한다고 설명한다.

📌 `@Version`은 다른 사용자의 변경을 막아 기다리게 하는 장치가 아니라, 내 변경이 오래된 상태를 바탕으로 했음을 발견해 현재 작업을 실패시키는 장치다.

### 3.3 충돌 시점은 메서드 마지막 줄보다 늦을 수 있다

JPA는 SQL을 즉시 보내지 않고 flush 또는 commit까지 미룰 수 있다. Service 본문이 정상 종료된 것처럼 보여도 트랜잭션을 commit하는 과정에서 충돌 예외가 날 수 있다.

Jakarta Persistence 명세는 충돌 시 `OptimisticLockException`을 던지고 현재 트랜잭션을 rollback 전용 상태로 표시하도록 한다. Spring의 JPA 예외 변환을 거치면 `ObjectOptimisticLockingFailureException` 또는 그 상위 타입인 `OptimisticLockingFailureException`으로 관찰될 수 있다.

충돌을 Service 실행 중에 확정해야 하면 `flush()`를 호출할 수 있다. 하지만 flush는 commit이 아니며, 예외가 난 트랜잭션 안에서 예외를 잡고 다른 데이터를 저장해 정상 commit하려 해서는 안 된다. 실패한 트랜잭션은 끝내고, 필요한 후속 작업은 명확한 새 트랜잭션에서 설계한다.

## 4. 버전 컬럼을 마이그레이션으로 추가한다

이전 Flyway 노트의 원칙대로 공유 DB의 기존 migration을 수정하지 않고 새 파일을 추가한다.

```sql
-- 파일: src/main/resources/db/migration/V4__add_book_version.sql
ALTER TABLE books -- 기존 도서 테이블에 새 컬럼을 추가한다.
    ADD COLUMN version BIGINT; -- 먼저 null 허용 상태로 확장한다.

UPDATE books -- 이미 저장된 모든 도서를 보충한다.
SET version = 0 -- 기존 행의 시작 버전을 0으로 정한다.
WHERE version IS NULL; -- 재실행 가능성을 높이고 대상 범위를 명시한다.

ALTER TABLE books -- 보충이 끝난 같은 테이블을 다시 변경한다.
    ALTER COLUMN version SET NOT NULL; -- 이후 버전 없는 행을 허용하지 않는다.
```

이 SQL은 PostgreSQL 기준 예시다. 테이블 크기가 크면 전체 UPDATE의 잠금·WAL·실행 시간을 운영 환경에서 따로 검토한다. 구버전 애플리케이션이 version 없이 INSERT하는 동안 바로 NOT NULL을 적용하면 실패할 수 있으므로 배포 호환성도 확인한다.

새 애플리케이션이 version을 쓰기 전 구버전과 동시에 운영되는 rolling deployment라면 “컬럼 추가 → 호환 코드 배포 → 데이터 보충·검증 → 제약 강화”처럼 단계를 나눌 수 있다. 정확한 순서는 현재 INSERT SQL과 Hibernate 동작, 배포 방식에 따라 정한다.

## 5. 오래된 요청과 저장 순간의 경쟁을 모두 처리한다

### 5.1 요청과 응답에 버전을 포함한다

```java
package com.example.bookstudy.book; // 도서 API의 DTO 패키지다.

import jakarta.validation.constraints.NotBlank; // 빈 제목을 막는다.
import jakarta.validation.constraints.NotNull; // 버전 누락을 막는다.
import jakarta.validation.constraints.PositiveOrZero; // 음수 버전을 막는다.
import jakarta.validation.constraints.Size; // 제목 길이를 제한한다.

public record UpdateBookRequest(
        @NotBlank // null·빈 문자열·공백만 있는 제목을 거부한다.
        @Size(max = 200) // DB 컬럼 길이와 입력 계약을 맞춘다.
        String title,

        @NotNull // 오래된 화면인지 판단하려면 클라이언트 버전이 필요하다.
        @PositiveOrZero // 이 예제의 숫자 버전은 음수가 될 수 없다.
        Long version
) {
}
```

```java
package com.example.bookstudy.book; // 도서 응답 DTO의 패키지다.

public record BookResponse(
        Long id, // 수정된 도서의 식별자다.
        String title, // commit될 예정인 현재 제목이다.
        Long version // 다음 수정 요청에서 다시 보낼 최신 버전이다.
) {
    public static BookResponse from(Book book) { // Entity를 API 응답 형태로 바꾼다.
        return new BookResponse( // Entity 자체를 JSON 계약으로 노출하지 않는다.
                book.getId(), // 현재 식별자를 복사한다.
                book.getTitle(), // 현재 제목을 복사한다.
                book.getVersion() // flush 뒤 증가한 버전을 복사한다.
        );
    }
}
```

응답에서 버전을 빼면 클라이언트가 다음 수정 때 어떤 상태를 기준으로 했는지 전달하기 어렵다. 버전은 사용자가 직접 고르는 값이 아니라 GET 또는 직전 수정 응답에서 받은 값을 되돌려 보내는 토큰에 가깝다.

### 5.2 Service에서 두 단계로 검사한다

이전 JPA 실습의 Repository를 다음처럼 유지한다. `JpaRepository`가 제공하는 `flush()`를 사용하므로 별도의 사용자 정의 SQL은 필요하지 않다.

```java
package com.example.bookstudy.book; // 도서 영속성 기능의 패키지다.

import org.springframework.data.jpa.repository.JpaRepository; // 기본 CRUD와 flush를 제공한다.

public interface BookRepository extends JpaRepository<Book, Long> { // Entity와 기본키 타입을 지정한다.
}
```

```java
package com.example.bookstudy.book; // 도서 업무 로직의 패키지다.

import java.util.Objects; // null에 안전한 값 비교를 사용한다.

import org.springframework.stereotype.Service; // Service Bean으로 등록한다.
import org.springframework.transaction.annotation.Transactional; // 읽기부터 flush까지 한 경계로 묶는다.

@Service // Controller와 Repository 사이의 업무 경계다.
public class BookService {

    private final BookRepository bookRepository; // DB 접근은 Repository에 위임한다.

    public BookService(BookRepository bookRepository) { // 생성자 주입으로 필수 의존성을 받는다.
        this.bookRepository = bookRepository; // 주입받은 Repository를 보관한다.
    }

    @Transactional // 조회·변경 감지·버전 UPDATE·flush를 한 트랜잭션으로 묶는다.
    public BookResponse update(Long bookId, UpdateBookRequest request) {
        Book book = bookRepository.findById(bookId) // 수정 시점의 최신 Entity를 읽는다.
                .orElseThrow(() -> new BookNotFoundException(bookId)); // 없으면 404 후보 예외다.

        if (!Objects.equals(book.getVersion(), request.version())) { // 화면의 버전과 DB 버전을 비교한다.
            throw new StaleBookVersionException( // 이미 오래된 요청이면 쓰기 전에 중단한다.
                    bookId, // 어떤 도서에서 충돌했는지 기록한다.
                    request.version(), // 클라이언트가 기준으로 삼은 버전이다.
                    book.getVersion() // 서버가 방금 읽은 현재 버전이다.
            );
        }

        book.changeTitle(request.title()); // 관리 Entity를 바꾸어 변경 감지 대상으로 만든다.
        bookRepository.flush(); // UPDATE를 보내 경쟁 충돌을 메서드 안에서 확정한다.

        return BookResponse.from(book); // 증가한 최신 버전을 응답 DTO에 담는다.
    }
}
```

`findById()` 직후의 사전 비교는 사용자 B가 오래된 화면을 한참 열어 둔 경우를 빠르게 설명한다. 그러나 비교를 통과한 직후 사용자 A가 commit할 수 있으므로 이것만으로는 원자적이지 않다. 마지막 안전망은 `@Version`이 포함된 UPDATE다.

`flush()`가 성공해도 그 뒤 commit이 실패할 가능성을 일반적으로 완전히 없애지는 않는다. 이 예제에서는 version 증가 값을 응답에 담고 충돌을 가능한 한 Service 호출 안에서 드러내기 위해 사용한다. 예외를 이 메서드 안에서 성공 결과로 바꾸지 않고 트랜잭션 밖까지 전파한다.

Controller는 검증된 요청을 Service에 전달한다. Entity를 요청 body로 직접 받지 않기 때문에 클라이언트가 ID나 다른 내부 상태를 임의로 덮는 범위도 줄어든다.

```java
package com.example.bookstudy.book; // 도서 HTTP API의 패키지다.

import jakarta.validation.Valid; // record의 Bean Validation을 실행한다.

import org.springframework.web.bind.annotation.PathVariable; // URL의 도서 ID를 받는다.
import org.springframework.web.bind.annotation.PutMapping; // 전체 수정 요청 경로를 선언한다.
import org.springframework.web.bind.annotation.RequestBody; // JSON body를 DTO로 변환한다.
import org.springframework.web.bind.annotation.RequestMapping; // 공통 URL 경로를 지정한다.
import org.springframework.web.bind.annotation.RestController; // 반환값을 JSON 응답으로 만든다.

@RestController // Spring MVC가 이 클래스를 REST Controller로 등록한다.
@RequestMapping("/books") // 모든 메서드의 공통 경로다.
public class BookController {

    private final BookService bookService; // 수정 업무는 Service에 위임한다.

    public BookController(BookService bookService) { // 생성자 주입으로 필수 의존성을 받는다.
        this.bookService = bookService; // 주입받은 Service를 보관한다.
    }

    @PutMapping("/{bookId}") // PUT /books/{bookId} 요청을 처리한다.
    public BookResponse update(
            @PathVariable Long bookId, // URL에서 수정 대상 ID를 읽는다.
            @Valid @RequestBody UpdateBookRequest request // JSON 형식과 필드 제약을 검증한다.
    ) {
        return bookService.update(bookId, request); // 최신 version을 포함한 결과를 반환한다.
    }
}
```

### 5.3 업무 충돌 예외는 원인을 읽을 수 있게 만든다

조회 실패 예외는 이전 REST 예외 처리에서 사용한 404 계약을 유지한다. 아래 두 예외는 각각 “자원이 없음”과 “자원은 있지만 요청의 기준이 오래됨”을 구분한다.

```java
package com.example.bookstudy.book; // 도서 예외의 패키지다.

public class BookNotFoundException extends RuntimeException {

    private final Long bookId; // 찾지 못한 도서의 식별자다.

    public BookNotFoundException(Long bookId) { // 조회 실패 시 ID를 받아 예외를 만든다.
        super("Book not found: " + bookId); // 서버 로그에서 원인을 구분할 메시지다.
        this.bookId = bookId; // HTTP 오류 응답에서 사용할 수 있도록 보관한다.
    }

    public Long getBookId() { // 예외 처리기가 ID를 읽는다.
        return bookId; // 찾지 못한 도서 ID를 반환한다.
    }
}
```

```java
package com.example.bookstudy.book; // 도서 예외의 패키지다.

public class StaleBookVersionException extends RuntimeException {

    private final Long bookId; // 충돌한 도서의 식별자다.
    private final Long requestedVersion; // 클라이언트가 보낸 오래된 버전이다.
    private final Long currentVersion; // 서버가 확인한 최신 버전이다.

    public StaleBookVersionException(Long bookId, Long requestedVersion, Long currentVersion) {
        super("Book was modified by another request"); // 내부 원인을 짧고 고정된 문장으로 남긴다.
        this.bookId = bookId; // 오류 응답 구성에 사용할 식별자를 보관한다.
        this.requestedVersion = requestedVersion; // 요청 버전을 보관한다.
        this.currentVersion = currentVersion; // 현재 버전을 보관한다.
    }

    public Long getBookId() { // 예외 처리기가 식별자를 읽는다.
        return bookId; // 충돌한 도서 ID를 반환한다.
    }

    public Long getRequestedVersion() { // 예외 처리기가 요청 버전을 읽는다.
        return requestedVersion; // 오래된 버전을 반환한다.
    }

    public Long getCurrentVersion() { // 예외 처리기가 현재 버전을 읽는다.
        return currentVersion; // 최신 버전을 반환한다.
    }
}
```

실제 응답에 현재 version을 그대로 제공할지는 제품 정책에 따라 정한다. 제공한다면 클라이언트가 최신 내용을 다시 GET하지 않고 숫자만 바꿔 재전송하게 만들지 않는다. 바뀐 필드 내용을 확인하고 사용자가 병합 또는 재작성을 결정해야 한다.

## 6. HTTP에서는 충돌을 성공으로 숨기지 않는다

### 6.1 본문의 version 계약은 409 Conflict로 표현한다

RFC 9110의 409는 현재 대상 자원의 상태와 요청이 충돌하여 작업을 완료할 수 없고, 사용자가 원인을 해결한 뒤 다시 제출할 수 있는 경우에 사용할 수 있다. 요청 body에 업무용 version을 담는 이번 계약은 409 응답으로 설명한다.

```java
package com.example.bookstudy.book; // 도서 API 예외 처리기의 패키지다.

import java.net.URI; // ProblemDetail의 오류 유형 URI를 만든다.

import org.springframework.dao.OptimisticLockingFailureException; // 저장 순간의 JPA 충돌 상위 예외다.
import org.springframework.http.HttpStatus; // 409 상태 코드를 사용한다.
import org.springframework.http.ProblemDetail; // RFC 9457 형태의 오류 본문을 만든다.
import org.springframework.web.bind.annotation.ExceptionHandler; // 예외별 처리 메서드를 연결한다.
import org.springframework.web.bind.annotation.RestControllerAdvice; // 모든 REST Controller에 적용한다.

@RestControllerAdvice // Controller 바깥으로 전파된 충돌을 HTTP 응답으로 바꾼다.
public class BookExceptionHandler {

    @ExceptionHandler(BookNotFoundException.class) // 존재하지 않는 도서 조회를 처리한다.
    public ProblemDetail handleNotFound(BookNotFoundException exception) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND); // HTTP 404를 정한다.
        problem.setType(URI.create("https://example.com/problems/book-not-found")); // 오류 종류를 식별한다.
        problem.setTitle("도서를 찾을 수 없음"); // 짧고 안정적인 제목이다.
        problem.setDetail("요청한 도서가 존재하지 않습니다."); // 내부 SQL 없이 결과를 설명한다.
        problem.setProperty("bookId", exception.getBookId()); // 찾지 못한 식별자를 제공한다.
        return problem; // Spring MVC가 상태와 JSON 본문으로 변환한다.
    }

    @ExceptionHandler(StaleBookVersionException.class) // 사전 버전 비교 실패를 처리한다.
    public ProblemDetail handleStaleRequest(StaleBookVersionException exception) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT); // HTTP 409를 정한다.
        problem.setType(URI.create("https://example.com/problems/book-version-conflict")); // 안정적인 오류 종류다.
        problem.setTitle("도서 수정 충돌"); // 사용자가 이해할 짧은 제목이다.
        problem.setDetail("다른 요청이 먼저 도서를 수정했습니다. 최신 내용을 다시 확인해 주세요."); // 해결 행동을 안내한다.
        problem.setProperty("bookId", exception.getBookId()); // 충돌한 자원만 식별한다.
        problem.setProperty("requestedVersion", exception.getRequestedVersion()); // 진단용 요청 버전이다.
        problem.setProperty("currentVersion", exception.getCurrentVersion()); // 진단용 현재 버전이다.
        return problem; // Spring MVC가 상태와 JSON 본문으로 변환한다.
    }

    @ExceptionHandler(OptimisticLockingFailureException.class) // 비교 뒤 발생한 실제 UPDATE 경쟁을 처리한다.
    public ProblemDetail handleWriteRace(OptimisticLockingFailureException exception) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT); // 같은 409 계약을 유지한다.
        problem.setType(URI.create("https://example.com/problems/book-version-conflict")); // 클라이언트 분기 키를 맞춘다.
        problem.setTitle("도서 수정 충돌"); // 내부 예외 클래스명은 노출하지 않는다.
        problem.setDetail("저장하는 동안 다른 요청이 먼저 수정했습니다. 최신 내용을 다시 조회해 주세요."); // 재조회가 필요함을 알린다.
        return problem; // DB SQL·스택 추적·내부 ID는 응답에 넣지 않는다.
    }
}
```

예상 응답은 다음과 같다. 실제 `instance` 등 필드는 Spring MVC 구성과 요청 경로에 따라 달라질 수 있다.

```json
{
  "type": "https://example.com/problems/book-version-conflict",
  "title": "도서 수정 충돌",
  "status": 409,
  "detail": "다른 요청이 먼저 도서를 수정했습니다. 최신 내용을 다시 확인해 주세요.",
  "bookId": 1,
  "requestedVersion": 3,
  "currentVersion": 4
}
```

### 6.2 ETag와 If-Match를 쓰면 412를 구분한다

HTTP 자체의 조건부 요청을 적용할 수도 있다. GET 응답의 현재 표현에 강한 ETag를 제공하고, 수정 요청이 `If-Match`로 그 값을 보내면 서버는 일치하지 않을 때 메서드를 수행하지 않는다.

```http
GET /books/1
ETag: "book-1-v4"

PUT /books/1
If-Match: "book-1-v3"
```

RFC 9110은 `If-Match` 조건이 거짓이면 일반적으로 **412 Precondition Failed**를 사용하도록 정의한다. 따라서 “version body를 사용한 업무 충돌은 409”, “표준 If-Match 전제조건 실패는 412”처럼 API 계약을 명시한다. 숫자 version을 ETag로 매핑하려면 해당 ETag가 어떤 표현의 변경을 뜻하는지, 강한 비교가 가능한지 함께 설계해야 한다.

## 7. 충돌을 실제 영속성 계층에서 재현한다

동시성 테스트는 단순히 메서드를 두 번 호출하는 것보다 **서로 다른 영속성 컨텍스트가 같은 버전을 읽는 상황**을 만들어야 한다. 아래 테스트는 두 사본을 별도 트랜잭션에서 읽어 detached 상태로 만든 뒤 순서대로 저장한다. 진짜 병렬 스레드 테스트는 아니지만 오래된 버전 충돌을 결정적으로 재현한다.

```java
package com.example.bookstudy.book; // 운영 코드와 같은 패키지 구조를 사용하는 테스트다.

import static org.assertj.core.api.Assertions.assertThat; // 최종 DB 상태를 검증한다.
import static org.assertj.core.api.Assertions.assertThatThrownBy; // 충돌 예외를 검증한다.

import org.junit.jupiter.api.Test; // JUnit 테스트 메서드를 표시한다.
import org.springframework.beans.factory.annotation.Autowired; // 테스트 의존성을 주입한다.
import org.springframework.boot.test.context.SpringBootTest; // JPA·Repository·트랜잭션 구성을 함께 올린다.
import org.springframework.dao.OptimisticLockingFailureException; // 제공자별 세부 예외 대신 Spring 상위 타입을 확인한다.
import org.springframework.transaction.PlatformTransactionManager; // 명시적인 독립 트랜잭션을 만든다.
import org.springframework.transaction.support.TransactionTemplate; // 트랜잭션 경계를 코드로 실행한다.

@SpringBootTest // 전체 애플리케이션 구성에서 실제 Repository를 사용한다.
class BookOptimisticLockIntegrationTest {

    private final BookRepository bookRepository; // 실제 JPA Repository다.
    private final TransactionTemplate transactions; // 각 읽기·쓰기를 별도 commit한다.

    @Autowired // 테스트 생성자에 Spring Bean을 주입한다.
    BookOptimisticLockIntegrationTest(
            BookRepository bookRepository,
            PlatformTransactionManager transactionManager
    ) {
        this.bookRepository = bookRepository; // Repository를 보관한다.
        this.transactions = new TransactionTemplate(transactionManager); // 같은 관리자로 템플릿을 만든다.
    }

    @Test // 오래된 두 번째 사본이 첫 번째 변경을 덮지 못하는지 확인한다.
    void staleCopyCannotOverwriteCommittedChange() {
        Long bookId = transactions.execute(status -> { // 준비 데이터를 별도 트랜잭션에서 commit한다.
            Book saved = bookRepository.saveAndFlush(new Book("Java 입문")); // 초기 행과 version을 만든다.
            return saved.getId(); // commit 뒤 다시 찾을 ID를 반환한다.
        });

        Book firstCopy = transactions.execute(status -> // 첫 번째 사용자의 사본을 읽는다.
                bookRepository.findById(bookId).orElseThrow() // 이 트랜잭션 종료 뒤 detached가 된다.
        );
        Book secondCopy = transactions.execute(status -> // 두 번째 사용자도 같은 DB 버전을 읽는다.
                bookRepository.findById(bookId).orElseThrow() // 서로 다른 영속성 컨텍스트의 사본이다.
        );

        assertThat(firstCopy.getVersion()).isEqualTo(secondCopy.getVersion()); // 출발 버전이 같음을 확인한다.
        Long initialVersion = firstCopy.getVersion(); // 제공자가 부여한 실제 초기값을 보관한다.

        firstCopy.changeTitle("Java 기초"); // 첫 번째 사본을 수정한다.
        transactions.executeWithoutResult(status -> { // 첫 번째 저장을 독립 트랜잭션에서 실행한다.
            bookRepository.save(firstCopy); // detached 사본을 merge 대상으로 전달한다.
            bookRepository.flush(); // version 조건 UPDATE를 지금 실행한다.
        }); // 트랜잭션이 commit되어 DB version이 증가한다.

        secondCopy.changeTitle("자바 첫걸음"); // 아직 이전 version인 두 번째 사본을 수정한다.
        assertThatThrownBy(() -> transactions.executeWithoutResult(status -> { // 실패할 별도 트랜잭션이다.
            bookRepository.save(secondCopy); // 오래된 version을 가진 사본을 merge한다.
            bookRepository.flush(); // 영향 행 0개를 충돌 예외로 확인한다.
        })).isInstanceOf(OptimisticLockingFailureException.class); // Spring의 낙관적 잠금 계층을 검증한다.

        Book current = transactions.execute(status -> // 실패 rollback 뒤 새 트랜잭션에서 확인한다.
                bookRepository.findById(bookId).orElseThrow() // DB의 현재 행을 다시 읽는다.
        );
        assertThat(current.getTitle()).isEqualTo("Java 기초"); // 첫 번째 변경이 보존되어야 한다.
        assertThat(current.getVersion()).isGreaterThan(initialVersion); // 초기 버전보다 증가했음을 확인한다.
    }
}
```

마지막 version 단언을 특정 숫자 1로 고정하지 않은 이유는 제공자의 초기 버전 규칙에 테스트 의도를 묶지 않기 위해서다. 더 명확하게 하려면 저장 전 초기 version을 지역 변수에 보관하고, 최종 version이 그 값보다 큰지 비교한다.

이 코드는 학습용 설계이며 현재 저장소에서 실행하지 않았다. 실제 프로젝트에서는 테스트 DB 초기화, 테스트 간 데이터 격리, Repository 선언과 Boot 버전의 테스트 Starter를 확인한다. H2에서 통과해도 운영 DB의 격리 수준·실제 SQL·병렬 요청 특성까지 같다는 뜻은 아니므로 PostgreSQL Testcontainers나 전용 통합 환경으로 보강한다.

## 8. 자주 하는 실수와 확인 방법

### 8.1 `@Transactional`만 붙이면 동시 수정도 안전하다고 생각한다

서로 다른 두 트랜잭션이 모두 성공하면서 마지막 UPDATE가 앞선 값을 덮을 수 있다. version 조건 또는 업무에 맞는 원자적 UPDATE가 있는지 SQL과 테스트로 확인한다.

### 8.2 Controller 요청에서 version을 받지 않는다

서버가 수정 직전에 최신 Entity를 읽으면 사용자가 오래된 화면에서 작성했다는 사실이 사라진다. GET 응답과 수정 요청 사이의 연결 토큰을 body version 또는 ETag로 전달한다.

### 8.3 version 값을 애플리케이션이 직접 증가시킨다

`book.setVersion(book.getVersion() + 1)`처럼 조작하면 JPA가 관리하는 잠금 계약을 깨뜨릴 수 있다. 명세는 영속화된 Entity의 버전을 사용자 코드가 직접 수정하지 않도록 요구한다.

### 8.4 충돌 예외를 같은 트랜잭션 안에서 잡고 성공으로 반환한다

낙관적 잠금 실패가 발생한 현재 트랜잭션은 rollback 대상이다. 예외를 밖으로 전파해 트랜잭션을 끝내고, Controller advice 같은 트랜잭션 바깥 경계에서 409 응답으로 변환한다.

### 8.5 모든 충돌을 자동 재시도한다

사용자 A와 B가 같은 제목을 의도하지 않았다면 B의 요청을 최신 version으로 자동 재실행하는 순간 A의 변경을 다시 덮어쓸 수 있다. 사람의 편집 충돌은 최신 내용을 보여 주고 병합 여부를 묻는 편이 안전하다.

재고 1 감소처럼 명령의 의미가 명확하고 중복 실행을 막을 수 있는 작업은 제한된 재시도를 검토할 수 있다. 그래도 전체 트랜잭션을 새로 시작하고 최신 상태에서 업무 조건을 다시 검사해야 하며, 무한 재시도·부분 재시도는 피한다.

### 8.6 JPQL bulk UPDATE도 자동으로 version을 검사한다고 생각한다

```java
@Modifying // 조회가 아니라 벌크 수정 쿼리임을 알린다.
@Query("update Book b set b.title = :title where b.id = :id") // Entity를 거치지 않고 DB를 직접 수정한다.
int renameWithoutVersion(Long id, String title); // 이 형태에는 version 조건과 증가가 없다.
```

Jakarta Persistence의 bulk UPDATE·DELETE는 영속성 컨텍스트를 우회하며 자동 낙관적 잠금 검사를 제공하지 않는다. 필요하면 version 조건·증가와 영향 행 수 검사를 직접 설계하고, 이미 로드한 Entity와 DB 상태가 어긋나지 않도록 영속성 컨텍스트를 정리한다.

## 9. 낙관적·비관적 잠금과 조건부 UPDATE를 구분한다

| 방법 | 핵심 동작 | 잘 맞는 상황 | 주요 비용·주의점 |
| --- | --- | --- | --- |
| 낙관적 잠금 | 저장 시 버전 불일치를 감지 | 충돌이 드물고 읽기가 많은 일반 수정 | 충돌이 늦게 발견되며 사용자 해결 흐름 필요 |
| 비관적 잠금 | 읽을 때 DB 잠금을 확보 | 충돌이 잦고 대기 순서가 중요한 짧은 작업 | 대기·교착·timeout, 긴 트랜잭션 위험 |
| 조건부 UPDATE | 업무 조건을 WHERE에 넣고 영향 행 수 확인 | `stock > 0` 같은 단순 원자 연산 | 복잡한 Entity 규칙·영속성 컨텍스트 동기화 주의 |

낙관적 잠금이 항상 더 빠르거나 비관적 잠금이 항상 더 안전한 것은 아니다. 충돌 빈도, 트랜잭션 길이, 실패 후 재작업 비용, DB 부하를 보고 선택한다.

Spring Data JPA의 `@Lock`으로 쿼리 잠금 모드를 지정하는 기능과 Entity의 `@Version`은 역할이 다르다. 일반적인 버전 기반 변경 감지는 `@Version`만으로 동작하며, 모든 조회 메서드에 `@Lock`을 붙여야 활성화되는 기능이 아니다.

## 10. 적용 체크리스트

- [ ] 동시에 수정될 수 있는 Entity에 하나의 `@Version` 필드가 있는가?
- [ ] version 컬럼을 기존 DB에 추가하는 migration과 기존 행 보충 계획이 있는가?
- [ ] GET 응답이 현재 version을 전달하는가?
- [ ] PUT·PATCH 요청이 사용자가 본 version을 다시 전달하는가?
- [ ] 사전 비교 뒤의 경쟁도 JPA version UPDATE가 막는가?
- [ ] flush·commit 시점의 예외가 트랜잭션 밖으로 전파되는가?
- [ ] 409 body version과 412 If-Match 중 선택한 HTTP 계약이 문서화되었는가?
- [ ] 충돌 응답이 최신 내용을 다시 확인하라는 행동을 안내하는가?
- [ ] 자동 재시도가 사용자의 변경을 덮지 않는다고 증명할 수 있는가?
- [ ] bulk UPDATE·native SQL이 version 계약을 우회하지 않는가?
- [ ] 운영 DB와 가까운 환경에서 오래된 사본의 저장 실패를 검증했는가?

## 11. 핵심 정리와 다음 학습

1. 트랜잭션은 한 요청의 원자성을 제공하지만 서로 다른 요청의 잃어버린 갱신을 자동으로 막지는 않는다.
2. 낙관적 잠금은 읽을 때의 version과 저장할 때의 version을 비교해 오래된 수정을 감지한다.
3. `@Version` 값은 JPA 제공자가 관리하므로 애플리케이션이 직접 증가시키지 않는다.
4. 요청 version 사전 비교는 오래된 화면을 설명하고, JPA 조건부 UPDATE는 비교 뒤의 경쟁을 막는다.
5. 충돌은 flush 또는 commit에서 발생할 수 있으며 트랜잭션은 rollback된다.
6. body version 기반 업무 충돌은 409, `If-Match` 전제조건 실패는 412 계약을 고려한다.
7. 사용자의 편집 충돌을 무조건 재시도하면 앞선 변경을 다시 덮을 수 있다.
8. bulk UPDATE와 native SQL은 version 검사·증가를 직접 검토해야 한다.

🧠 기억할 것: **낙관적 잠금의 목적은 충돌을 없애는 것이 아니라, 오래된 저장을 성공으로 착각하지 않게 만드는 것이다.**

다음 확장 주제는 **비관적 잠금·조건부 UPDATE와 재고 차감**이다. 충돌이 잦거나 한정 수량처럼 업무 조건을 한 번에 검사해야 할 때 대기, 원자적 갱신, 재시도 정책을 어떻게 선택하는지 비교한다.

## 12. 복습 퀴즈

1. 두 수정 요청에 모두 `@Transactional`이 있어도 lost update가 발생할 수 있는 이유는 무엇인가?
2. 요청 version을 미리 비교한 뒤에도 JPA의 `@Version` 검사가 필요한 이유는 무엇인가?
3. 낙관적 잠금 예외가 Service 본문의 마지막 줄 뒤에 발생할 수 있는 이유는 무엇인가?
4. 충돌 예외를 같은 트랜잭션에서 잡고 다른 저장을 계속하면 안 되는 이유는 무엇인가?
5. 본문 version과 HTTP `If-Match`가 실패할 때 고려할 상태 코드는 각각 무엇인가?
6. 사용자의 오래된 편집 요청을 자동 재시도하면 어떤 문제가 생길 수 있는가?
7. JPQL bulk UPDATE를 사용할 때 version과 영속성 컨텍스트에서 무엇을 직접 확인해야 하는가?

<details>
<summary>정답과 해설</summary>

1. 각 요청은 자기 작업만 원자적으로 commit하고, 상대가 먼저 바꾼 상태를 검사하지 않으면 마지막 UPDATE가 앞선 값을 덮을 수 있다.
2. 사전 비교와 실제 UPDATE 사이에 다른 트랜잭션이 commit할 수 있다. DB의 version 조건 UPDATE가 이 경쟁 구간을 원자적으로 막는다.
3. JPA가 SQL을 flush 또는 commit까지 미룰 수 있기 때문이다. 트랜잭션 interceptor가 commit하면서 예외를 전파할 수도 있다.
4. 낙관적 잠금 실패는 현재 트랜잭션을 rollback 대상으로 만든다. 새 작업은 실패한 경계를 끝낸 뒤 별도 트랜잭션으로 설계한다.
5. body version의 현재 자원 상태 충돌은 409를 사용할 수 있고, 표준 `If-Match` 조건 실패는 일반적으로 412다.
6. 최신 version으로 그대로 재실행하면 다른 사용자가 먼저 저장한 변경을 다시 덮어써 충돌 감지의 목적을 무너뜨릴 수 있다.
7. version 조건과 증가, 영향 행 수를 직접 설계하고, bulk 작업 전후 이미 로드된 Entity가 DB와 어긋나지 않게 clear 등 동기화 전략을 검토한다.

</details>

## 13. 공식 문서로 이어서 읽기

- [Jakarta Persistence 3.2 명세](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2): Entity version, 낙관적 잠금, 예외·bulk update 규칙
- [Jakarta EE Tutorial — Entity Data Locking](https://jakarta.ee/learn/docs/jakartaee-tutorial/current/persist/persistence-locking/persistence-locking.html): 낙관적·비관적 잠금 개요
- [Hibernate ORM 7.1 User Guide](https://docs.hibernate.org/orm/7.1/userguide/html_single/): Hibernate의 version 기반 잠금과 SQL 동작
- [Hibernate OptimisticLocking API](https://docs.hibernate.org/orm/7.1/javadocs/org/hibernate/annotations/OptimisticLocking.html): 영향 행 수와 충돌 판단 설명
- [Spring Framework OptimisticLockingFailureException](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/dao/OptimisticLockingFailureException.html): Spring 데이터 접근 예외 계층
- [Spring Data JPA Locking](https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html): Repository 쿼리의 잠금 모드 지정
- [RFC 9110 — If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match): lost update 방지를 위한 HTTP 전제조건
- [RFC 9110 — 409 Conflict](https://www.rfc-editor.org/rfc/rfc9110.html#name-409-conflict): 현재 자원 상태와의 충돌 응답
- [RFC 9110 — 412 Precondition Failed](https://www.rfc-editor.org/rfc/rfc9110.html#name-412-precondition-failed): 조건부 요청 실패 응답
