# 커서 기반 페이지네이션: 복합 정렬 키·다음 커서·변경되는 목록의 경계

- 🎯 학습 목표: 마지막으로 반환한 정렬 키를 기준으로 다음 구간을 조회하고, 커서 검증·응답 생성·삽입과 삭제의 영향을 설명한다.
- 🧩 핵심 키워드: cursor, keyset, 복합 정렬, 배타적 경계, size + 1, Base64url, Window, ScrollPosition
- ⭐ 중요도: ★★★★☆ — 깊은 목록 탐색에서 offset 비용을 줄이는 선택지이며, 데이터 변경에 대한 계약도 함께 이해해야 한다.
- 📝 한눈에 보는 내용: 생성 시각·ID 내림차순 도서 목록을 만들고, 커서가 가리키던 책이 삭제돼도 다음 구간을 읽는 예제를 작성한다.
- 🧱 선수 지식: 이전 노트의 PageRequest·정렬·Entity·DTO, Java record·Optional·예외, JPQL 기본 구조
- 🔗 이전 노트: [페이지네이션·정렬과 조회 API](../15_09_11_Pagination_and_Sorting/09_11_Pagination_and_Sorting.md)

> 정리 기준일: 2026-09-12. Spring Boot 4.1·Spring Data 4.1·Java 21 공식 문서를 참고했다. 이전 `pagingstudy` 실습 프로젝트에 추가하는 학습 코드다. TIL 저장소에서 Java 컴파일·Spring 테스트를 실행한 결과는 아니며, 테스트와 응답 설명은 예상이다. 이 저장소에 실행 서버를 구축하는 작업이 아니라 강의노트를 추가하는 작업이다.

## 1. “앞에서 1만 개를 건너뛰기” 대신 무엇을 기억할까?

offset 방식은 정렬한 결과에서 앞의 일정 개수를 건너뛴다. 하지만 앞쪽에 새 데이터가 들어오거나 사라지면 각 위치가 바뀐다. 깊은 페이지를 조회할수록 건너뛸 결과를 처리하는 DB 비용도 커질 수 있다.

커서 방식은 다음 조회를 이어갈 **위치 정보**를 반환한다. 이번에는 행 번호 대신 마지막 책의 정렬 값인 `(createdAt, id)`를 기억한다. 이를 조건에 넣는 keyset 방식으로 “이 책보다 정렬상 뒤에 있는 책”만 조회한다.

커서라는 이름의 문자열을 쓴다고 모두 keyset 방식인 것은 아니다. offset 숫자를 문자열로 포장한 커서도 만들 수 있다. 실제 조회 조건이 위치 개수인지 정렬 키인지 확인해야 한다.

## 2. 전체 흐름과 이번 API의 범위

```text
첫 요청: GET /books/cursor?size=2
  → 커서 없음 → 최신순으로 최대 3개 조회
  → 앞의 2개만 반환
  → 더 읽은 1개가 있으면 두 번째 책의 키를 nextCursor로 반환

다음 요청: GET /books/cursor?size=2&after=<받은 커서>
  → 길이·문자·버전·시각·ID 검증
  → 커서의 (시각, ID)보다 뒤인 결과를 최대 3개 조회
  → items, hasNext, nextCursor 반환
```

정렬은 `createdAt DESC, id DESC`로 고정하고 앞으로만 탐색한다. 페이지 번호, 전체 개수, 제목 정렬, 이전 페이지 이동, 커서 서명·만료, 검색 필터는 구현하지 않는다. 이전 `/books` API는 그대로 두고 **별도 `/books/cursor` 경로**로 비교한다.

| 입력·출력 | 이번 계약 |
| --- | --- |
| `size` | 기본 20, 1~100 허용 |
| `after` 생략 | 첫 구간부터 조회 |
| 빈 after·잘못된 커서 | 400, 첫 구간으로 조용히 되돌리지 않음 |
| `items` | 최대 size개의 공개 도서 DTO |
| `hasNext` | 이번 조회 시점에 다음 항목을 더 읽었는가? |
| `nextCursor` | 다음이 있으면 마지막 반환 항목의 키, 없으면 null |

사용자는 커서를 직접 조립하지 않고 응답받은 값을 다시 전달한다. 마지막 응답에서 null인 커서를 재전송하며 반복하지 않는다. 이 API의 null은 “처음부터 반복”이 아니라 **더 이어갈 커서를 주지 않는다**는 뜻이다.

## 3. 복합 정렬 조건을 한 행씩 따라간다

예를 들어 다음 순서로 책이 있다고 하자. ID 값은 개념 설명용이다.

| 정렬 위치 | createdAt | id |
| ---: | --- | ---: |
| 1 | 09-12 10:00 | 105 |
| 2 | 09-12 10:00 | 104 |
| 3 | 09-12 10:00 | 103 |
| 4 | 09-11 18:00 | 200 |

두 번째 책까지 반환했다면 커서는 `(09-12 10:00, 104)`다. 다음 조건은 아래 두 경우를 합친다.

```text
createdAt < 마지막 시각
OR
(createdAt = 마지막 시각 AND id < 마지막 ID)
```

ID 103은 시각이 같고 ID가 작아서 포함된다. ID 200은 ID가 더 크더라도 시각이 더 오래돼서 포함된다. **ID 하나만 비교하면 네 번째 책을 놓친다.** 시각만 비교하면 같은 시각의 ID 103을 놓친다.

`<=`로 바꾸면 경계 책 자체가 다시 포함될 수 있다. 그래서 마지막 항목을 제외하는 배타적 경계를 사용한다. 정렬을 오름차순으로 바꾸면 비교 방향도 함께 바뀌어야 하므로, 이번에는 내림차순 하나만 다룬다.

Spring Data의 keyset 설명도 안정적인 정렬, 모든 정렬 키, 식별자와 경계 조건을 함께 다룬다. 다만 아래 코드는 이해를 위해 JPQL 조건을 직접 적으며, Spring의 Scroll API가 조건을 자동 생성하는 구현은 아니다. [Spring Data Scrolling 문서](https://docs.spring.io/spring-data/commons/reference/repositories/scrolling.html)를 참고한다.

## 4. size + 1과 다음 커서의 기준

size가 2일 때 3개를 읽으면 세 번째 항목은 다음 구간이 있다는 증거다. 응답에는 앞의 두 개만 넣는다. 다음 커서는 **추가로 읽은 세 번째가 아니라 실제 반환한 두 번째**에서 만든다.

세 번째 항목으로 커서를 만들면 다음 요청에서 그 항목보다 뒤를 조회하므로, 사용자는 세 번째 항목을 한 번도 받지 못한다. 정확히 두 개만 존재하면 `hasNext=false`이고, 빈 결과에서도 false다.

이번 Repository는 `List<Book>`을 반환하고 전체 개수를 조회하지 않는다. `PageRequest`는 항상 0번 페이지에 `size + 1` 크기를 전달하는 도구로만 쓴다. **매번 page를 증가시키지 않는다.** 전진 위치는 WHERE 조건의 정렬 키가 맡는다. List와 Pageable의 조합에는 Page용 전체 개수 메타데이터가 필요하지 않다. [Spring Data 조회 반환 타입](https://docs.spring.io/spring-data/commons/reference/repositories/query-methods-details.html), [PageRequest API](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/domain/PageRequest.html)를 참고한다.

## 5. 기존 프로젝트에 어떤 파일을 추가할까?

[이전 실습](../15_09_11_Pagination_and_Sorting/09_11_Pagination_and_Sorting.md)의 Java 21·Maven·Boot 4.1 프로젝트를 사용한다. 의존성은 webmvc·data-jpa Starter, H2 runtime, 기본·webmvc·data-jpa test Starter를 유지한다. 별도 라이브러리는 추가하지 않는다.

```text
src/main/java/com/example/pagingstudy/
  Book.java                       # 기존 파일에 getter 하나 추가
  BookRepository.java             # 유지: 테스트 데이터 저장과 기존 페이지 조회
  BookSummary.java                 # 유지: Long id, String title
  InvalidBookQueryException.java   # 유지: 입력 오류 예외
  BookQueryErrorHandler.java       # 유지: 위 예외를 400 ProblemDetail로 변환
  BookCursor.java                  # 추가: 커서의 값과 인코딩·검증
  BookCursorQuery.java             # 추가: 요청 크기와 커서 조건
  BookCursorRepository.java        # 추가: 첫 구간·이후 구간 JPQL
  BookCursorResponse.java          # 추가: 커서 전용 공개 응답
  BookCursorService.java           # 추가: 조회·잘라내기·다음 커서 생성
  BookCursorController.java        # 추가: 별도 HTTP 엔드포인트
src/test/java/com/example/pagingstudy/
  BookCursorTest.java              # 추가: 커서의 직렬화·잘못된 입력
  BookCursorJpaTest.java           # 추가: 실제 JPA 조회와 데이터 변경
  BookCursorControllerTest.java    # 추가: HTTP 입력과 400 경계
```

시작 클래스·application.yaml·기존 페이지 API와 테스트는 그대로 둔다. 아래 getter만 **기존 Book 클래스 안에 추가**한다. 나머지 Java 블록은 각 제목에 적힌 추가 파일의 전체 코드다.

```java
public Instant getCreatedAt() { // 기존 Book.java 클래스 내부에 추가한다. Instant import는 이미 있다.
    return createdAt; // DB에서 읽은 정렬 시각을 다음 커서에 넣는다.
}
```

createdAt과 ID는 null이 아니며 탐색 중 변경하지 않는 키라고 가정한다. 커서는 Java에서 새로 만든 현재 시간이 아니라 **조회된 행의 실제 정렬 값**으로 만든다. DB가 저장 시각의 소수 정밀도를 줄였다면 원래 입력값과 DB에서 읽은 값이 다를 수 있다. 밀리초로 임의 변환해 정렬 정보를 잃지 않도록 한다. [Instant API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/Instant.html)를 참고한다.

## 6. BookCursor.java: 전달 형식과 검증

커서 원문은 `v1|시각|ID`이고 URL-safe Base64로 감싼다. `v1`은 이번 고정 정렬의 커서 형식 버전이다. URL-safe 방식은 쿼리에 쓰기 편한 문자 집합을 사용한다. [Java Base64 API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Base64.html)를 참고한다.

**Base64는 암호화나 서명이 아니다.** 누구나 내용을 읽고 바꿀 수 있다. 이번 전체 공개 도서 목록에서 커서는 위치를 나타낼 뿐, 조회 권한이나 데이터 무결성을 증명하지 않는다. 민감 정보를 넣지 않는다.

```java
package com.example.pagingstudy; // 기존 오류 타입을 재사용하는 패키지다.

import java.nio.charset.StandardCharsets; // 커서 원문의 문자 인코딩을 고정한다.
import java.time.Instant; // 시각 정렬 키를 보관한다.
import java.time.format.DateTimeParseException; // 잘못된 시각 문자열을 입력 오류로 바꾼다.
import java.util.Base64; // URL-safe 인코더·디코더를 사용한다.
import java.util.Optional; // 커서 생략과 잘못된 커서를 구분한다.

public record BookCursor(Instant createdAt, long id) { // 경계 행의 두 정렬 키다.
    private static final Instant MIN_TIME = Instant.EPOCH; // 이 학습 데이터는 1970년 이후로 제한한다.
    private static final Instant MAX_TIME = Instant.parse("2100-01-01T00:00:00Z"); // 2100년 미만이라는 예제 정책이다.

    public BookCursor { // 직접 생성하는 Java 호출에도 같은 규칙을 적용한다.
        if (createdAt == null || createdAt.isBefore(MIN_TIME) || !createdAt.isBefore(MAX_TIME) || id <= 0) { // DB에 보낼 키의 범위를 제한한다.
            throw new InvalidBookQueryException("커서의 시각 또는 ID가 허용 범위를 벗어났습니다."); // 내부 원문을 오류에 노출하지 않는다.
        }
    }

    public String encode() { // 현재 값을 외부 전달용 문자열로 바꾼다.
        String payload = "v1|" + createdAt + "|" + id; // 시각의 소수 정밀도도 유지한다.
        return Base64.getUrlEncoder().withoutPadding() // URL-safe 문자와 패딩 없는 형식을 선택한다.
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8)); // 바이트를 커서 문자열로 변환한다.
    }

    public static Optional<BookCursor> decode(String token) { // HTTP에서 받은 커서를 검사한다.
        if (token == null) { // after 자체를 생략한 경우만 첫 조회로 처리한다.
            return Optional.empty(); // 잘못된 커서를 이 결과로 바꾸지 않는다.
        }
        if (token.length() > 256 || !token.matches("[A-Za-z0-9_-]+")) { // 디코딩 전 길이·문자·빈 값을 제한한다.
            throw new InvalidBookQueryException("커서 형식이 올바르지 않습니다."); // 긴 입력을 그대로 처리하지 않는다.
        }
        try { // 디코딩과 숫자·시각 변환의 실패를 묶는다.
            byte[] bytes = Base64.getUrlDecoder().decode(token); // 잘못된 Base64 길이 등은 예외가 된다.
            String canonical = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); // 같은 바이트의 표준 표현을 만든다.
            if (!canonical.equals(token)) { // 패딩 비트 등이 다른 비표준 표현은 거부한다.
                throw new IllegalArgumentException("Non-canonical cursor"); // 아래에서 고정된 공개 오류로 바꾼다.
            }
            String[] parts = new String(bytes, StandardCharsets.UTF_8).split("\\|", -1); // 빈 필드도 유지하며 정확히 나눈다.
            if (parts.length != 3 || !"v1".equals(parts[0])) { // 알려진 버전과 세 필드만 허용한다.
                throw new IllegalArgumentException("Unsupported cursor"); // 다른 형식을 추측해 처리하지 않는다.
            }
            Instant time = Instant.parse(parts[1]); // ISO-8601 시각을 읽는다.
            long id = Long.parseLong(parts[2]); // 숫자 형식과 long 범위를 확인한다.
            return Optional.of(new BookCursor(time, id)); // 마지막으로 의미상의 범위를 검사한다.
        } catch (IllegalArgumentException | DateTimeParseException ex) { // Base64·ID·시각 구문 오류를 처리한다.
            throw new InvalidBookQueryException("커서 형식이 올바르지 않습니다."); // 원문·내부 예외 메시지를 반사하지 않는다.
        }
    }
}
```

1970년 이상·2100년 미만은 보편적인 커서 규칙이 아니라 이 예제의 데이터 범위다. 저장할 책의 시각도 이 범위에 있어야 한다. 실제 서비스에서는 데이터 정책과 DB가 지원하는 시각 범위를 맞춰야 한다.

존재하는 ID인지 확인하는 DB 조회는 하지 않는다. 커서가 가리킨 행이 삭제돼도 두 키의 값 자체가 다음 구간의 경계로 충분하기 때문이다. 그 대신 위 코드는 위조한 유효 범위 커서도 위치 조건으로 받아들인다. 위변조 방지가 필요한 제품에서는 검증된 서명 방식·만료·키 관리 등을 별도로 설계한다.

## 7. 요청 조건과 Repository

### 7.1 BookCursorQuery.java

```java
package com.example.pagingstudy; // Controller와 Service가 공유한다.

import java.util.Optional; // 첫 조회인지 후속 조회인지 표현한다.

public record BookCursorQuery(int size, Optional<BookCursor> after) { // 변경할 수 없는 요청 조건이다.
    public BookCursorQuery { // 생성 전에 불변 조건을 확인한다.
        if (size < 1 || size > 100) { // size + 1을 조회해도 최대 101개로 제한된다.
            throw new InvalidBookQueryException("size는 1 이상 100 이하여야 합니다."); // 범위 위반은 400으로 연결한다.
        }
        if (after == null) { // Optional 객체 자체가 null이면 호출 계약 위반이다.
            throw new InvalidBookQueryException("커서 조건이 올바르지 않습니다."); // 첫 조회에는 Optional.empty를 사용한다.
        }
    }
}
```

### 7.2 BookCursorRepository.java

JPQL은 테이블·컬럼이 아니라 Entity 이름과 속성을 사용한다. 아래 조건은 문자열로 사용자 값을 붙이지 않고 `@Param`으로 바인딩한다. [JPA Query Methods 문서](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)를 참고한다.

```java
package com.example.pagingstudy; // 기존 Book Entity를 대상으로 조회한다.

import java.time.Instant; // 경계 시각의 타입이다.
import java.util.List; // count 메타데이터 없이 제한된 결과만 받는다.
import org.springframework.data.domain.Pageable; // 이번에는 offset 0과 조회 개수만 전달한다.
import org.springframework.data.jpa.repository.Query; // 직접 작성한 JPQL을 지정한다.
import org.springframework.data.repository.Repository; // 필요한 조회 메서드만 공개한다.
import org.springframework.data.repository.query.Param; // 이름 있는 JPQL 매개변수와 연결한다.

public interface BookCursorRepository extends Repository<Book, Long> { // 기존 CRUD Repository와 다른 타입의 Bean이다.
    @Query("select b from Book b order by b.createdAt desc, b.id desc") // 첫 구간에는 경계 조건이 없다.
    List<Book> firstWindow(Pageable pageable); // Service가 size + 1의 최대 개수를 전달한다.

    @Query("select b from Book b " // 조회 대상은 Book Entity다.
            + "where b.createdAt < :time or (b.createdAt = :time and b.id < :id) " // 두 키를 사전식 순서로 비교한다.
            + "order by b.createdAt desc, b.id desc") // 경계 비교와 같은 방향의 정렬을 유지한다.
    List<Book> afterWindow( // 커서 행을 먼저 findById로 찾지 않는다.
            @Param("time") Instant time, // 마지막 반환 항목의 생성 시각이다.
            @Param("id") long id, // 같은 시각 안에서의 마지막 ID다.
            Pageable pageable // 첫 페이지 번호와 최대 개수를 받는다.
    );
}
```

두 Repository는 같은 Entity를 다루지만 타입이 다르므로 각각 필요한 곳에 주입한다. API에 필터를 추가할 때에는 첫 구간과 이후 구간 **모두**에 같은 조건을 적용해야 한다. `권한조건 AND (시각조건 OR 동점조건)`의 괄호를 잃으면 조회 범위가 달라질 수 있다.

## 8. 응답과 Service: 마지막으로 보여 준 책을 기억한다

### 8.1 BookCursorResponse.java

```java
package com.example.pagingstudy; // 공개 HTTP 응답 타입이다.

import java.util.List; // 현재 구간의 목록을 담는다.

public record BookCursorResponse( // PageResponse와 별개인 커서 계약이다.
        List<BookSummary> items, // 실제로 사용자에게 반환한 항목이다.
        boolean hasNext, // 추가 항목을 하나 더 읽었는지 표시한다.
        String nextCursor // 다음 구간이 없으면 null이다.
) { // 전체 개수와 페이지 번호를 제공하지 않는다.
}
```

### 8.2 BookCursorService.java

```java
package com.example.pagingstudy; // 조회와 응답 조립을 담당한다.

import java.util.List; // 조회 결과와 반환할 항목을 담는다.
import org.springframework.data.domain.PageRequest; // 최대 size + 1개를 요청한다.
import org.springframework.data.domain.Pageable; // 두 조회 메서드가 같은 제한을 사용한다.
import org.springframework.stereotype.Service; // Controller가 주입받을 Bean이다.
import org.springframework.transaction.annotation.Transactional; // 조회와 DTO 변환의 범위를 정한다.

@Service // Spring이 생성자 의존성을 연결한다.
public class BookCursorService { // 네트워크 DTO와 JPA 조회 사이의 경계다.
    private final BookCursorRepository repository; // 커서용 조회만 사용하는 Repository다.

    public BookCursorService(BookCursorRepository repository) { // 생성자 주입을 사용한다.
        this.repository = repository; // 실제 구현은 Spring Data가 제공한다.
    }

    @Transactional(readOnly = true) // 읽기용 트랜잭션이며 여러 HTTP 요청을 하나의 스냅샷으로 묶지는 않는다.
    public BookCursorResponse list(BookCursorQuery query) { // 이미 검증된 조건을 받는다.
        Pageable limit = PageRequest.of(0, query.size() + 1); // 페이지 번호는 항상 0이며 정렬은 JPQL에 고정되어 있다.
        List<Book> rows = query.after() // 첫 구간인지 후속 구간인지 구분한다.
                .map(cursor -> repository.afterWindow(cursor.createdAt(), cursor.id(), limit)) // 키보다 뒤인 결과를 제한해서 읽는다.
                .orElseGet(() -> repository.firstWindow(limit)); // 커서가 없을 때만 첫 조회를 실행한다.
        boolean hasNext = rows.size() > query.size(); // 여분의 항목을 읽었다면 다음 구간이 있다.
        List<Book> visible = rows.subList(0, Math.min(query.size(), rows.size())); // 이미 제한해서 읽은 결과에서 여분 한 개만 제외한다.
        List<BookSummary> items = visible.stream() // 공개할 항목만 DTO로 바꾼다.
                .map(book -> new BookSummary(book.getId(), book.getTitle())).toList(); // Entity를 직접 직렬화하지 않는다.
        String nextCursor = null; // 마지막 구간의 기본값이다.
        if (hasNext) { // size는 1 이상이므로 이 경우 visible은 비어 있지 않다.
            Book last = visible.get(visible.size() - 1); // 여분 항목이 아닌 마지막 반환 항목을 선택한다.
            nextCursor = new BookCursor(last.getCreatedAt(), last.getId()).encode(); // DB에서 조회한 두 키로 다음 경계를 만든다.
        }
        return new BookCursorResponse(items, hasNext, nextCursor); // 클라이언트가 그대로 이어갈 정보를 반환한다.
    }
}
```

여기의 `subList`는 이전 노트에서 피하라고 한 “전체 조회 뒤 자르기”와 다르다. DB에서 **최대 size + 1개만 조회한 후** 탐색용 한 항목을 제외한다. `orElseGet`은 커서가 없을 때만 첫 조회를 실행하도록 지연 평가한다.

## 9. BookCursorController.java: 별도 엔드포인트 연결

```java
package com.example.pagingstudy; // 기존 시작 클래스의 스캔 범위다.

import org.springframework.web.bind.annotation.GetMapping; // 커서 목록의 GET 경로를 등록한다.
import org.springframework.web.bind.annotation.RequestParam; // size와 after를 쿼리에서 받는다.
import org.springframework.web.bind.annotation.RestController; // 응답을 JSON으로 직렬화한다.

@RestController // 기존 BookController와 함께 등록할 수 있다.
public class BookCursorController { // 새 경로만 처리한다.
    private final BookCursorService service; // 실제 조회를 수행할 Bean이다.

    public BookCursorController(BookCursorService service) { // 생성자 주입을 사용한다.
        this.service = service; // 주입받은 Service를 저장한다.
    }

    @GetMapping("/books/cursor") // 기존 /books의 page 계약을 바꾸지 않는다.
    public BookCursorResponse list( // 커서 전용 DTO를 반환한다.
            @RequestParam(name = "size", defaultValue = "20") int size, // 숫자 변환 오류는 MVC가 400으로 처리한다.
            @RequestParam(name = "after", required = false) String after // 생략은 null, 빈 문자열은 잘못된 커서로 다룬다.
    ) { // Controller 내부에서 검증된 요청 조건을 만든다.
        BookCursorQuery query = new BookCursorQuery(size, BookCursor.decode(after)); // 커서나 크기가 잘못되면 여기서 중단한다.
        return service.list(query); // 검증을 통과한 요청만 조회로 전달한다.
    }
}
```

기존 `BookQueryErrorHandler`가 `InvalidBookQueryException`을 400으로 변환한다. 숫자 변환 오류와 사용자 정의 오류의 JSON 모양까지 통일한 예제는 아니라는 이전 노트의 주의점도 유지한다. `page`나 `sort`를 전달해도 이 메서드는 사용하지 않는다. 계약에 없는 매개변수까지 엄격히 거부하려면 별도 검증이 필요하다.

## 10. 커서·DB·HTTP를 나누어 검증한다

### 10.1 BookCursorTest.java

DB 없이 커서의 왕복 변환과 잘못된 입력을 확인한다. Base64 형식이 맞는 것과 내부 값이 유효한 것은 별도로 검증해야 한다.

```java
package com.example.pagingstudy; // 커서와 예외 타입에 접근한다.

import java.nio.charset.StandardCharsets; // 테스트 원문을 동일한 인코딩으로 변환한다.
import java.time.Instant; // 고정된 시각으로 정밀도 보존을 확인한다.
import java.util.Base64; // 의도적으로 잘못된 내부 값을 인코딩한다.
import org.junit.jupiter.api.Test; // 일반 테스트를 선언한다.
import org.junit.jupiter.params.ParameterizedTest; // 입력별 테스트를 반복한다.
import org.junit.jupiter.params.provider.ValueSource; // 잘못된 입력 목록을 제공한다.
import static org.assertj.core.api.Assertions.assertThat; // 변환 결과를 비교한다.
import static org.junit.jupiter.api.Assertions.assertThrows; // 입력 오류 발생을 확인한다.

class BookCursorTest { // Spring 컨텍스트나 DB를 띄우지 않는다.
    @Test // 형식과 키 값이 왕복 후 같아야 한다.
    void roundTripPreservesKeys() { // 밀리초 아래 자리도 임의로 버리지 않는다.
        BookCursor cursor = new BookCursor(Instant.parse("2026-09-12T10:00:00.123456Z"), 42L); // 테스트용 경계다.
        assertThat(BookCursor.decode(cursor.encode())).contains(cursor); // 두 키가 모두 보존돼야 한다.
    }

    @Test // 첫 요청은 커서가 없는 정상 요청이다.
    void missingCursorMeansFirstWindow() { // 잘못된 입력과 구분한다.
        assertThat(BookCursor.decode(null)).isEmpty(); // 생략만 첫 조회로 해석한다.
    }

    @ParameterizedTest // 빈 값·금지 문자·불완전한 Base64를 각각 확인한다.
    @ValueSource(strings = {"", "***", "a"}) // 총 세 번 실행한다.
    void rejectsMalformedToken(String token) { // 디코딩 앞과 디코딩 중의 실패다.
        assertThrows(InvalidBookQueryException.class, () -> BookCursor.decode(token)); // 첫 페이지로 대체하지 않는다.
    }

    @ParameterizedTest // Base64를 읽을 수 있어도 내부 계약이 틀릴 수 있다.
    @ValueSource(strings = {"v2|2026-09-12T00:00:00Z|1", "v1|not-a-time|1", "v1|2026-09-12T00:00:00Z|0"}) // 버전·시각·ID 오류다.
    void rejectsInvalidPayload(String payload) { // 세 종류를 독립적으로 실행한다.
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8)); // 형식상 정상 Base64다.
        assertThrows(InvalidBookQueryException.class, () -> BookCursor.decode(token)); // 내부 값 검증도 필요하다.
    }

    @Test // 큰 입력은 변환 전에 제한해야 한다.
    void rejectsOversizedToken() { // 허용 길이 바로 다음 값을 사용한다.
        assertThrows(InvalidBookQueryException.class, () -> BookCursor.decode("a".repeat(257))); // 256자 상한을 확인한다.
    }
}
```

### 10.2 BookCursorJpaTest.java

다음 테스트는 실제 H2·Repository·Service를 연결한다. 첫 조회와 후속 조회 사이에 삽입·삭제를 **같은 테스트 트랜잭션 안에서 순차 실행**해 결과를 검증한다. 여러 DB 연결의 동시 commit이나 격리 수준을 검증하는 테스트는 아니다.

```java
package com.example.pagingstudy; // 기존 Entity·CRUD Repository도 사용한다.

import java.time.Instant; // 재현 가능한 정렬 키를 만든다.
import jakarta.persistence.EntityManager; // DB 반영 뒤 다시 읽도록 영속성 컨텍스트를 비운다.
import org.junit.jupiter.api.Test; // 다섯 가지 조회 시나리오다.
import org.springframework.beans.factory.annotation.Autowired; // 실제 Bean을 받는다.
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest; // Boot 4의 JPA 슬라이스다.
import org.springframework.context.annotation.Import; // 실제 Service를 추가한다.
import static org.assertj.core.api.Assertions.assertThat; // 순서·커서·다음 여부를 검사한다.

@DataJpaTest // 기본 테스트 트랜잭션은 각 테스트 종료 후 rollback한다.
@Import(BookCursorService.class) // 일반 Service는 명시적으로 불러온다.
class BookCursorJpaTest { // 초기 데이터 스크립트 없는 이전 실습 DB를 전제로 한다.
    @Autowired // 저장·삭제용 실제 Repository를 받는다.
    private BookRepository books; // 커서 조회와는 다른 책임의 Repository다.
    @Autowired // 실제 커서 Service를 받는다.
    private BookCursorService service; // 테스트 대역을 사용하지 않는다.
    @Autowired // flush·clear를 수행할 객체다.
    private EntityManager em; // 저장한 객체만 보지 않고 DB 결과를 다시 읽는다.

    private Book save(String title, String time) { // 데이터 준비 도우미다.
        return books.saveAndFlush(new Book(title, Instant.parse(time))); // 실제 ID를 사용하고 1부터 시작한다고 가정하지 않는다.
    }

    private BookCursorResponse read(int size, String token) { // 첫 조회와 후속 조회를 같은 경로로 실행한다.
        em.clear(); // 저장된 시각을 DB에서 다시 읽도록 한다.
        return service.list(new BookCursorQuery(size, BookCursor.decode(token))); // 실제 JPQL과 응답 조립을 수행한다.
    }

    @Test // 복합 키와 여분 항목 제외를 함께 확인한다.
    void tiesAndLookAheadDoNotSkipBooks() { // H2 IDENTITY는 이 테스트에서 저장 순서대로 증가한다.
        Book same1 = save("Same1", "2026-09-12T00:00:00Z"); // 같은 시각 중 작은 ID다.
        Book same2 = save("Same2", "2026-09-12T00:00:00Z"); // 같은 시각 중 큰 ID다.
        Book older = save("Older", "2026-09-11T00:00:00Z"); // 나중에 저장해 ID는 더 크지만 시각은 오래된 항목이다.
        BookCursorResponse first = read(1, null); // 한 개를 보여 주고 한 개를 더 읽는다.
        assertThat(first.items()).extracting(BookSummary::id).containsExactly(same2.getId()); // ID 동점 기준이 적용된다.
        assertThat(first.hasNext()).isTrue(); // 더 읽은 항목이 있다.
        assertThat(BookCursor.decode(first.nextCursor()).orElseThrow().id()).isEqualTo(same2.getId()); // 추가 조회 항목의 ID로 커서를 만들면 안 된다.
        BookCursorResponse second = read(1, first.nextCursor()); // 같은 시각의 다음 ID가 나와야 한다.
        assertThat(second.items()).extracting(BookSummary::id).containsExactly(same1.getId()); // 시각만 비교해서 누락하면 실패한다.
        BookCursorResponse third = read(1, second.nextCursor()); // 오래된 시각의 항목으로 이동한다.
        assertThat(third.items()).extracting(BookSummary::id).containsExactly(older.getId()); // 모든 책을 순서대로 읽는다.
        assertThat(third.hasNext()).isFalse(); // 마지막 구간이다.
        assertThat(third.nextCursor()).isNull(); // 계속 반복할 커서를 주지 않는다.
    }

    @Test // 첫 구간 앞쪽 삽입으로 이미 읽은 항목을 다시 읽지 않는 사례다.
    void insertionBeforeCursorDoesNotShiftNextWindow() { // 여러 연결의 동시성 검증이 아니라 변경 순서에 따른 결과 검증이다.
        Book old = save("Old", "2026-09-10T00:00:00Z"); // 나중에 읽을 항목이다.
        save("Anchor", "2026-09-11T00:00:00Z"); // 첫 응답의 경계다.
        BookCursorResponse first = read(1, null); // Anchor를 읽는다.
        save("New", "2026-09-12T00:00:00Z"); // 경계 앞에 새로운 항목을 삽입한다.
        BookCursorResponse next = read(1, first.nextCursor()); // 개수가 아니라 키 조건으로 이어간다.
        assertThat(next.items()).extracting(BookSummary::id).containsExactly(old.getId()); // Anchor가 반복되거나 New가 중간에 끼지 않는다.
    }

    @Test // 경계 행 자체가 없어져도 키 값은 남는다.
    void deletingAnchorStillAllowsContinuation() { // 커서를 ID 재조회에 의존시키면 실패하기 쉬운 사례다.
        Book old = save("Old", "2026-09-10T00:00:00Z"); // 남아 있는 다음 항목이다.
        Book anchor = save("Anchor", "2026-09-11T00:00:00Z"); // 첫 응답의 경계 항목이다.
        BookCursorResponse first = read(1, null); // 삭제 전에 커서를 받는다.
        books.deleteById(anchor.getId()); // 경계 행을 삭제한다.
        books.flush(); // 삭제를 DB에 반영한다.
        BookCursorResponse next = read(1, first.nextCursor()); // 저장해 둔 시각·ID만으로 조회한다.
        assertThat(next.items()).extracting(BookSummary::id).containsExactly(old.getId()); // 경계 행이 없어도 이어 읽는다.
    }

    @Test // 빈 DB에서 getLast와 같은 접근이 발생하면 안 된다.
    void emptyWindowHasNoCursor() { // 다른 테스트의 데이터는 rollback되어 남지 않는다.
        BookCursorResponse result = read(2, null); // 첫 조회에 항목이 없다.
        assertThat(result.items()).isEmpty(); // 빈 배열을 반환한다.
        assertThat(result.hasNext()).isFalse(); // 다음 항목도 없다.
        assertThat(result.nextCursor()).isNull(); // 경계 항목을 읽으려 하지 않는다.
    }

    @Test // 항목 수가 size와 정확히 같은 경우다.
    void exactSizeIsLastWindow() { // size만큼 왔다고 다음이 있다고 추측하지 않는다.
        save("One", "2026-09-11T00:00:00Z"); // 첫 번째 데이터다.
        save("Two", "2026-09-12T00:00:00Z"); // 두 번째 데이터다.
        BookCursorResponse result = read(2, null); // 세 개까지 요청하지만 두 개만 존재한다.
        assertThat(result.items()).hasSize(2); // 실제 두 개를 모두 반환한다.
        assertThat(result.hasNext()).isFalse(); // 여분 항목이 없으므로 종료한다.
        assertThat(result.nextCursor()).isNull(); // 마지막 응답에는 다음 커서를 넣지 않는다.
    }
}
```

### 10.3 BookCursorControllerTest.java

```java
package com.example.pagingstudy; // 기존 시작 클래스의 설정을 찾는다.

import java.util.List; // 대역 응답의 목록을 만든다.
import java.util.Optional; // 기본 요청 조건의 빈 커서를 표현한다.
import org.junit.jupiter.api.Test; // 정상 HTTP 계약을 검사한다.
import org.junit.jupiter.params.ParameterizedTest; // 여러 입력 오류를 반복한다.
import org.junit.jupiter.params.provider.CsvSource; // 쿼리 이름과 잘못된 값을 제공한다.
import org.springframework.beans.factory.annotation.Autowired; // MVC 테스트 도구를 받는다.
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest; // Boot 4의 MVC 슬라이스다.
import org.springframework.context.annotation.Import; // 기존 400 오류 처리기를 포함한다.
import org.springframework.test.context.bean.override.mockito.MockitoBean; // Service만 대역으로 바꾼다.
import org.springframework.test.web.servlet.MockMvc; // 실제 포트 없이 요청을 처리한다.
import static org.mockito.Mockito.*; // 응답 준비와 호출 여부 검증을 사용한다.
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get; // GET 요청을 만든다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*; // 상태와 JSON을 확인한다.

@WebMvcTest(BookCursorController.class) // Controller·요청 조건 검증은 실제로 실행한다.
@Import(BookQueryErrorHandler.class) // 커서 오류도 기존 예외 타입으로 400에 연결한다.
class BookCursorControllerTest { // DB 조회는 이 테스트에 포함하지 않는다.
    @Autowired // MVC 도구를 주입받는다.
    private MockMvc mvc; // HTTP 처리와 JSON 검증의 진입점이다.
    @MockitoBean // Controller가 필요로 하는 Service 대역이다.
    private BookCursorService service; // 오류 입력에서는 호출되지 않아야 한다.

    @Test // 커서와 크기를 생략한 첫 요청이다.
    void defaultRequestReturnsCursorResponse() throws Exception { // MockMvc의 검사 예외를 전달한다.
        BookCursorQuery query = new BookCursorQuery(20, Optional.empty()); // 기본 요청 조건이다.
        when(service.list(query)).thenReturn(new BookCursorResponse(List.of(new BookSummary(1L, "Spring")), false, null)); // 마지막 구간 응답을 준비한다.
        mvc.perform(get("/books/cursor")) // 첫 요청의 경로를 실행한다.
                .andExpect(status().isOk()) // 정상 목록 응답은 200이다.
                .andExpect(jsonPath("$.items[0].title").value("Spring")) // 공개 DTO가 JSON으로 변환된다.
                .andExpect(jsonPath("$.hasNext").value(false)); // 종료 여부를 전달한다.
        verify(service).list(query); // 올바른 기본값을 전달했는지 확인한다.
    }

    @ParameterizedTest // 크기 범위·숫자 변환·커서 형식 실패를 검사한다.
    @CsvSource({"size,0", "size,101", "size,abc", "after,***", "after,a"}) // 총 다섯 번 실행된다.
    void badInputNeverReachesService(String name, String value) throws Exception { // 쿼리 하나만 바꿔 검사한다.
        mvc.perform(get("/books/cursor").param(name, value)) // 잘못된 입력을 전달한다.
                .andExpect(status().isBadRequest()); // 커서 오류를 첫 조회로 바꾸지 않는다.
        verifyNoInteractions(service); // DB 조회 비용이 발생하기 전에 종료한다.
    }
}
```

이번 세 클래스는 커서 9회·JPA 5회·MVC 6회로 **총 20회 실행을 예상**한다. H2 조회가 통과해도 운영 DB의 시각 정밀도·실행 계획·트랜잭션 격리·실제 동시 요청은 별도 검증 대상이다. [DataJpaTest API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html), [WebMvcTest API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTest.html)를 참고한다.

## 11. 직접 실행할 때의 순서

TIL 폴더가 아니라 이전 예제를 준비한 **별도 Maven 실습 프로젝트 루트**에서 실행한다.

```powershell
.\mvnw.cmd "-Dtest=BookCursorTest,BookCursorJpaTest,BookCursorControllerTest" test # 이번 세 테스트 클래스만 실행한다.
.\mvnw.cmd test # 이전 offset 테스트까지 함께 확인한다.
.\mvnw.cmd spring-boot:run # 빈 메모리 DB로 로컬 서버를 실행한다.
```

서버 실행 후 다른 터미널에서 다음 요청을 보낼 수 있다. 등록 API나 초기 데이터가 없으므로 첫 실행은 빈 응답을 예상한다.

```powershell
curl.exe "http://localhost:8080/books/cursor?size=2" # 첫 요청은 after를 생략한다.
```

```json
{
  "items": [],
  "hasNext": false,
  "nextCursor": null
}
```

데이터가 있는 환경에서는 `hasNext=true`인 응답의 nextCursor를 다음 요청의 after 값으로 그대로 전달한다. 예제 토큰을 임의로 만들어 넣는 것보다 응답의 실제 값을 사용해야 경계를 정확히 이어갈 수 있다.

## 12. 커서가 해결하는 것과 해결하지 않는 것

### 12.1 삽입·삭제가 있어도 항상 같은 목록을 보는 것은 아니다

커서 앞에 새 책이 들어와도 기존 경계의 위치 개수를 다시 계산하지 않는다. 그래서 앞쪽 삽입 때문에 이전 항목이 반복되는 offset 방식의 사례를 피할 수 있다. 다만 새 책은 현재 탐색에 나타나지 않을 수 있으므로 사용자가 최신 목록을 보려면 첫 조회를 새로 시작한다.

커서 뒤에 과거 시각을 가진 책이 새로 추가되면 이후 조회에 등장할 수 있다. 아직 보지 않은 책이 삭제되면 이후 응답에서 사라진다. 이미 본 책의 정렬 키가 경계 뒤로 변경되면 다시 보일 수도 있다. **커서는 스냅샷이 아니며, 정렬 키의 불변성이 중요하다.**

`hasNext=true`도 조회 당시의 정보다. 그 뒤 남은 항목이 삭제되면 다음 요청이 비어 있을 수 있다. 처음의 전체 결과를 고정해서 끝까지 순회해야 하는 내보내기 작업은 별도 스냅샷·조회 기준 설계가 필요하다.

### 12.2 인덱스와 실행 계획은 여전히 필요하다

keyset이라고 언제나 상수 시간으로 조회하는 것은 아니다. 필터·정렬에 맞는 인덱스와 실제 DB 실행 계획을 확인한다. 이번 고정 정렬에서는 생성 시각·ID를 함께 다루는 인덱스가 검토 대상이지만, 데이터 분포와 권한·검색 조건에 따라 적합한 구성이 달라진다.

여러 컬럼 인덱스는 컬럼 순서와 조건 형태가 활용 범위에 영향을 준다. 예를 들어 PostgreSQL의 B-tree 문서를 읽을 때에도 앞선 컬럼의 조건과 뒤 컬럼의 조건을 구분해서 본다. [PostgreSQL 복합 인덱스 문서](https://www.postgresql.org/docs/current/indexes-multicolumn.html)를 참고한다. 이 노트는 운영 DB용 인덱스를 실제 생성하거나 성능을 측정한 결과가 아니다.

### 12.3 필터·권한·커서 보호는 서로 다른 책임이다

실제 서비스에서 커서가 유효해도 매 요청의 인증·인가 검사는 필요하다. 서명된 커서라고 해당 사용자가 데이터에 접근할 권한이 생기지 않는다. Base64나 서명만으로 데이터 기밀성이 보장되는 것도 아니다.

검색어나 정렬을 바꾼 경우에는 기존 커서를 그대로 이어 쓰지 않도록 계약을 정한다. 보통 커서 버전·정렬·필터 조건의 일치 여부를 검증하고, 사용자·테넌트 범위는 서버가 인증 정보에서 결정한다. 이번 코드는 필터 없는 공개 목록과 고정 정렬 하나만 다루므로 이 기능들은 추가 설계 대상이다.

## 13. Spring의 Window·ScrollPosition과는 어떤 관계인가?

Spring Data는 `Window<T>`와 `ScrollPosition`으로 이어 읽기를 표현하는 API도 제공한다. keyset 위치를 사용하는 조회에서는 정렬 키 추출과 이후 조건 구성을 프레임워크가 도와준다. nullable 정렬 키, DTO에 필요한 정렬 필드가 빠진 경우 등은 확인해야 한다.

이번에는 내부 원리를 이해하려고 `@Query`·List·PageRequest로 직접 구현했다. 이것을 Spring Scroll API를 사용한 예제라고 부르지 않는다. JPA 공식 문서는 문자열 기반 쿼리에서 Scroll API 사용에 제한이 있다고 안내하므로, 기존 `@Query`에 ScrollPosition 인수만 붙여 같은 방식으로 동작한다고 가정하지 않는다. [Spring Data JPA 쿼리 문서](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)를 확인한다.

프레임워크 API로 바꾸더라도 외부 커서 형식·검증·권한·만료·고정 정렬 계약까지 자동으로 완성되는 것은 아니다. 먼저 수동 예제의 책임을 이해한 뒤 어떤 부분을 프레임워크가 대체하는지 비교한다.

## 14. 자주 틀리는 부분과 요약

| 실수 | 결과 | 확인할 점 |
| --- | --- | --- |
| 커서에 ID만 저장 | 생성 시각 우선 정렬과 조건 불일치 | 모든 정렬 키를 포함 |
| 조건에 `<=` 사용 | 경계 항목 반복 가능 | 배타적 비교 사용 |
| 여분 항목으로 nextCursor 생성 | 보여 주지 않은 항목을 건너뜀 | 마지막 반환 항목에서 생성 |
| 다음 요청에서 page 증가 | 경계 조건 이후 또 건너뜀 | page는 항상 0 |
| 잘못된 커서를 첫 요청으로 처리 | 중복 표시·오류 은폐 | 생략과 형식 오류 분리 |
| 커서 ID의 존재를 필수로 검사 | 경계 행 삭제 후 탐색 중단 | 값으로 이어가는 경계 사용 |
| Base64를 위변조 방지로 판단 | 임의 위치 변경을 막지 못함 | 서명·인증·권한을 별도로 설계 |

1. 커서는 다음 탐색의 위치 정보이며 반드시 keyset 방식인 것은 아니다.
2. 복합 정렬에서는 모든 정렬 키와 고유 식별자를 경계 조건에 반영한다.
3. size + 1개를 읽고, 반환한 마지막 항목으로 다음 커서를 만든다.
4. 키 조건으로 전진하므로 이 예제의 PageRequest 번호는 계속 0이다.
5. 커서 생략은 첫 조회이고 잘못된 커서는 입력 오류다.
6. 커서 앞쪽 삽입의 위치 이동 문제를 줄여도 스냅샷까지 보장하지는 않는다.
7. 커서의 값 검증·서명·인증·인가는 각각 다른 책임이다.
8. H2 결과 검증과 운영 DB의 성능·정밀도·동시성 검증을 구분한다.

다음 확장 주제는 **JPA DTO Projection과 조회 최적화**다. 이번에는 Entity를 조회한 뒤 DTO로 바꿨지만, 필요한 컬럼만 처음부터 읽는 방법과 그때 커서 정렬 키를 빠뜨리지 않는 기준을 이어서 학습한다.

## 15. 복습 퀴즈

1. 생성 시각·ID 내림차순에서 왜 `id < 마지막 ID`만으로는 부족한가?
2. size가 2이고 세 항목을 읽었다면 어느 항목으로 다음 커서를 만들어야 하는가?
3. 커서가 가리키던 행이 삭제되면 이번 코드는 왜 계속 조회할 수 있는가?
4. `hasNext=true`였는데 다음 요청이 비어 있어도 가능한 상황은 무엇인가?
5. Base64 인코딩된 커서가 정상적으로 해석되면 위변조되지 않았다고 볼 수 있는가?
6. 같은 트랜잭션 안에서 조회·삽입·재조회를 수행한 테스트가 실제 동시 commit까지 검증하는가?

<details>
<summary>정답과 해설</summary>

1. 먼저 시각으로 정렬하기 때문이다. 더 오래된 시각의 책은 ID가 커도 다음 결과에 포함되어야 한다.
2. 실제 반환한 두 번째 항목이다. 여분의 세 번째 항목으로 만들면 그 책을 건너뛴다.
3. 행의 존재가 아니라 커서에 저장한 시각·ID의 값으로 조건을 만들기 때문이다.
4. 조회 후 남은 항목이 삭제된 경우 등이다. hasNext는 이전 조회 시점의 관찰이다.
5. 아니다. Base64는 표현 방식이며 서명·무결성 검증이 아니다.
6. 아니다. 변경 순서에 따른 결과를 모델링했을 뿐이다. 다중 연결·트랜잭션·운영 DB 검증은 별도다.

</details>

## 16. 공식 문서로 이어서 읽기

- [Spring Data Scrolling](https://docs.spring.io/spring-data/commons/reference/repositories/scrolling.html): 안정적인 정렬·keyset·Window·배타적 위치
- [Spring Data Query Methods](https://docs.spring.io/spring-data/commons/reference/repositories/query-methods-details.html): List·Pageable과 제한된 조회
- [Spring Data JPA Query Methods](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html): JPQL·인수 바인딩·Scroll API 제한
- [Java Base64 API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Base64.html): URL-safe 인코딩·디코딩
- [Java Instant API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/Instant.html): 시각 표현과 파싱
- [PostgreSQL Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html): 복합 인덱스와 조건의 관계
