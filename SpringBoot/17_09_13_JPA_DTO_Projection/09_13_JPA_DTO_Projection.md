# JPA DTO Projection과 조회 최적화: 필요한 컬럼만 읽고 커서 계약 유지하기

- 🎯 학습 목표: Entity를 조회한 뒤 DTO로 바꾸는 방식과 DB 조회 단계에서 DTO를 만드는 방식을 구분하고, 선택 컬럼과 기존 동작을 함께 검증한다.
- 🧩 핵심 키워드: projection, closed/open projection, record DTO, JPQL constructor expression, 커서 정렬 키, StatementInspector
- ⭐ 중요도: ★★★★☆ — 목록에 필요 없는 데이터를 읽지 않는 설계와 변경 기능의 Entity 조회를 구분하는 기준이다.
- 📝 한눈에 보는 내용: 도서의 긴 설명은 조회에서 제외하고, 커서에 필요한 생성 시각은 유지한다. 같은 API를 유지하면서 SQL과 반환값을 비교한다.
- 🧱 선수 지식: JPA Entity·영속성 컨텍스트, DTO·record, JPQL, 이전 노트의 복합 키 커서와 JPA 테스트
- 🔗 이전 노트: [커서 기반 페이지네이션](../16_09_12_Cursor_Pagination/09_12_Cursor_Pagination.md)

> 정리 기준일: 2026-09-13. Spring Boot 4.1·Spring Data JPA 4.1·Java 21 공식 문서를 참고했다. 이전 `com.example.pagingstudy` 실습 프로젝트에 적용할 학습 코드이며, TIL 저장소에 실행 애플리케이션을 구축한 것은 아니다. Java 컴파일·Spring 테스트를 실행하지 않았으므로 아래 결과는 예상이다. Hibernate 버전은 Boot의 의존성 관리를 따른다.

## 1. DTO를 반환하면 DB에서도 필요한 값만 읽었을까?

이전 커서 Service는 `List<Book>`을 조회한 다음 `BookSummary`로 바꿨다. 클라이언트에는 ID와 제목만 전달했지만, DB 조회 단계에서는 Book Entity를 만들기 위한 기본 필드를 읽었다.

책에 긴 설명·추가 메타데이터가 붙으면 이 차이가 커진다. 화면에 제목만 필요한데 상세 설명까지 DB에서 받아 놓고 버릴 수 있기 때문이다. **응답 DTO로 숨기는 것과 조회 컬럼을 줄이는 것은 다른 일**이다.

Projection은 조회 결과를 필요한 속성의 형태로 뽑아내는 방법이다. 이번에는 ID·제목·생성 시각만 담는 조회용 record를 사용한다. 생성 시각은 화면에 보이지 않지만 다음 커서를 만드는 데 필요하므로 남긴다.

이전 Book에는 ID·제목·생성 시각만 있었으므로 세 필드를 모두 담는 Projection으로 바꿔도 컬럼 수가 줄지 않았다. 이번에는 **차이를 관찰하기 위한 보충 예제**로 긴 description 필드를 추가한다. 최적화 효과를 보여 주려고 이전 모델에 없던 필드가 원래 있었다고 가정하지 않는다.

## 2. 전체 흐름: 조회용 DTO와 공개 DTO를 나눈다

```text
기존 흐름
DB: id, title, createdAt, description
  → Book Entity
  → BookSummary(id, title) + 다음 커서

이번 흐름
DB: id, title, createdAt만 선택
  → BookCursorRow(id, title, createdAt)
  → BookSummary(id, title) + 다음 커서
```

조회용 DTO인 `BookCursorRow`는 DB에서 읽어야 할 형태다. 공개 DTO인 `BookSummary`는 HTTP로 내보낼 형태다. 두 DTO의 필드가 같아야 할 이유는 없다. 여기서는 내부 정렬 키를 유지하되 별도 응답 필드로 추가하지 않는다.

URL은 이전과 같은 `/books/cursor`를 유지한다. size 범위, after 검증, `createdAt DESC, id DESC`, 배타적 경계, size + 1 조회, nextCursor 형식도 바꾸지 않는다. 이번 변경의 대상은 **조회 결과의 구성 방식**이다.

## 3. Projection 방식을 먼저 비교한다

| 방식 | 객체를 얻는 경로 | 판단 기준 |
| --- | --- | --- |
| Entity 조회 후 DTO 변환 | Entity를 읽고 Java에서 값을 복사 | 변경 감지·도메인 동작이 필요하거나 단순한 모델일 때 |
| Closed interface projection | 속성 getter를 선언하고 Spring이 프록시 제공 | 최상위 속성 일부를 읽는 간단한 조회 |
| Open interface projection | SpEL 등으로 결과를 계산 | 필요한 속성 추론과 조회 최적화가 제한될 수 있음 |
| Class/record DTO projection | 선택한 값으로 DTO 생성 | 명시적인 생성자·타입·조회 형태가 필요할 때 |

Closed projection은 getter가 대상 속성과 대응하는 형태다. Open projection의 SpEL은 다른 속성을 참조할 수 있어 같은 방식의 조회 최적화를 기대하기 어렵다. 이번에는 closed interface를 짧게 비교하고, 실제 커서 조회에는 record와 명시적 JPQL 생성자 식을 사용한다. [Spring Data JPA Projections 문서](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)를 참고한다.

Projection 인터페이스를 Book Entity가 직접 구현하도록 만들지 않는다. Entity의 상위 타입으로 반환하는 것과 별도의 Projection 타입을 반환하는 것은 다르다. 또한 상속한 `findAll`의 반환 타입만 임의로 바꾸기보다 목적이 분명한 별도 조회 메서드를 만든다.

## 4. 실습 파일의 유지·수정·추가 범위

이전 [페이지 조회 노트](../15_09_11_Pagination_and_Sorting/09_11_Pagination_and_Sorting.md)와 [커서 조회 노트](../16_09_12_Cursor_Pagination/09_12_Cursor_Pagination.md)의 실습 프로젝트를 먼저 준비한다. Maven Wrapper, H2, webmvc·data-jpa와 테스트 Starter는 그대로 사용한다. 추가 라이브러리를 설치하거나 Hibernate 버전을 직접 바꾸지 않는다.

```text
src/main/java/com/example/pagingstudy/
  Book.java                     # 부분 수정: description과 추가 생성자
  BookRepository.java           # 유지: 기존 CRUD·offset 조회
  BookCursorRepository.java     # 유지: Entity 조회 비교 대상
  BookCursor.java               # 유지: v1 커서 인코딩·검증
  BookCursorQuery.java          # 유지: size·after 조건
  BookSummary.java              # 유지: 공개 ID·제목
  BookCursorResponse.java       # 유지: items·hasNext·nextCursor
  BookCursorController.java     # 유지: 같은 Service 타입·경로 사용
  BookCursorService.java        # 전체 교체: Projection Repository 사용
  BookTitleView.java            # 추가: closed interface 예제
  BookCursorRow.java            # 추가: 커서용 조회 DTO
  BookProjectionRepository.java # 추가: Projection 조회
src/test/java/com/example/pagingstudy/
  SqlCapture.java               # 추가: 테스트 전용 SQL 관찰 도구
  BookProjectionJpaTest.java    # 추가: 선택 컬럼과 결과 검증
  기존 테스트들                # 유지: 이전 HTTP·커서·offset 계약 재확인
```

기존 시작 클래스·오류 처리기·application.yaml도 유지한다. 아래에는 **부분 수정**과 **전체 파일**을 구분해 표시했다. 실제 운영 DB에 `create-drop`을 적용하거나 기존 테이블을 삭제하라는 지시가 아니다. 이전 예제의 비영구 로컬 H2 실습에만 적용한다.

## 5. Book.java 부분 수정: 목록에 불필요한 필드를 만든다

기존 Book 클래스의 필드 영역에 아래 필드를 추가한다. `Column` import는 이전 파일에 이미 있다. 일반적인 문자열 컬럼으로 두며 LOB나 지연 로딩 설정은 추가하지 않는다.

```java
@Column(nullable = false, length = 10000) // 로컬 실습에서 긴 설명을 저장할 문자열 컬럼이다.
private String description; // 커서 목록의 결과나 다음 커서에는 필요하지 않은 값이다.
```

기존 두 인수 생성자를 아래 두 생성자로 **교체**한다. 이전 테스트는 계속 두 인수 생성자를 사용할 수 있다. 기본 생성자와 ID·제목·생성 시각 getter는 그대로 둔다.

```java
public Book(String title, Instant createdAt) { // 기존 호출 코드를 유지하는 생성자다.
    this(title, createdAt, ""); // 이전 테스트에는 빈 설명을 기본값으로 넣는다.
}

public Book(String title, Instant createdAt, String description) { // 새 테스트에서 긴 설명도 준비한다.
    this.title = title; // 제목을 저장한다.
    this.createdAt = createdAt; // 정렬·커서에 필요한 시각을 저장한다.
    this.description = description; // 목록에서는 제외할 설명을 저장한다.
}
```

이번 생성자는 설명의 업무 규칙을 완성한 등록 API가 아니다. null·길이·내용 검증과 등록 요청은 별도 책임이다. 테스트에서는 5,000자 문자열을 전달해 실제 데이터가 있어도 Projection SQL에서 해당 컬럼을 빼는지 확인한다.

## 6. 두 가지 조회 타입

### 6.1 BookTitleView.java 전체 코드

```java
package com.example.pagingstudy; // Entity와 별개인 Projection 인터페이스다.

public interface BookTitleView { // Spring Data가 결과를 읽을 프록시를 제공한다.
    Long getId(); // Book의 id 속성과 대응한다.
    String getTitle(); // Book의 title 속성과 대응한다.
}
```

이 타입에는 `@Entity`나 구현 클래스를 직접 작성하지 않는다. 뒤의 파생 조회 메서드가 이 반환 타입을 보고 결과를 구성한다. 생성 시각이 없으므로 이번 인터페이스는 **제목 조회 비교용**이지 커서 서비스에 사용할 타입이 아니다.

### 6.2 BookCursorRow.java 전체 코드

```java
package com.example.pagingstudy; // JPQL에서 이 타입의 전체 패키지 이름을 사용한다.

import java.time.Instant; // 커서의 첫 번째 정렬 키 타입이다.

public record BookCursorRow( // 조회 결과를 담는 값 객체이며 Entity가 아니다.
        Long id, // 동점을 해소할 고유 키이자 공개할 ID다.
        String title, // 목록에 공개할 제목이다.
        Instant createdAt // 화면 필드는 아니지만 다음 커서에 필요한 정렬 키다.
) { // record의 canonical constructor가 세 값을 순서대로 받는다.
}
```

record는 `id()` 같은 접근자를 제공한다. 인터페이스의 `getId()`와 호출 이름이 다르므로 Service를 바꿀 때 함께 확인한다. 이 DTO의 scalar 값으로 새 객체를 만들었다고 Entity 변경 감지가 발생하지 않는다.

다만 “DTO에 담겼으니 그 안의 모든 객체도 비영속이다”라고 일반화하면 안 된다. 생성자 식에 Entity 자체를 인수로 넘기는 형태는 다르다. 이번 생성자에는 ID·문자열·시각 값만 전달한다. [Jakarta Persistence 생성자 식 규칙](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2#constructor-expressions-in-the-select-clause)을 참고한다.

## 7. BookProjectionRepository.java: 선택 컬럼을 명시한다

`select new 전체패키지.DTO(...)`는 조회한 각 행의 값으로 DTO 생성자를 호출하라는 JPQL 문법이다. `new` 뒤에는 테이블명이 아니라 Java 타입의 전체 이름이 들어간다. 생성자의 인수 순서와 타입이 조회 값의 순서·타입에 맞아야 한다.

```java
package com.example.pagingstudy; // 기존 Book Entity를 조회하는 별도 Repository다.

import java.time.Instant; // 후속 조회의 경계 시각이다.
import java.util.List; // 제한된 목록을 받으며 전체 개수는 조회하지 않는다.
import org.springframework.data.domain.Pageable; // size + 1개를 제한하는 데 사용한다.
import org.springframework.data.jpa.repository.Query; // 명시적인 JPQL을 지정한다.
import org.springframework.data.repository.Repository; // 필요한 메서드만 공개한다.
import org.springframework.data.repository.query.Param; // 이름 있는 조건 값을 바인딩한다.

public interface BookProjectionRepository extends Repository<Book, Long> { // 반환 타입은 Entity에 한정되지 않는다.
    @Query("select new com.example.pagingstudy.BookCursorRow(b.id, b.title, b.createdAt) " // description은 선택하지 않는다.
            + "from Book b order by b.createdAt desc, b.id desc") // 첫 구간의 정렬은 이전과 같다.
    List<BookCursorRow> firstWindow(Pageable pageable); // 반환되는 각 원소는 record DTO다.

    @Query("select new com.example.pagingstudy.BookCursorRow(b.id, b.title, b.createdAt) " // 후속 조회도 같은 필드 구성을 사용한다.
            + "from Book b where b.createdAt < :time or (b.createdAt = :time and b.id < :id) " // 배타적인 복합 키 경계를 유지한다.
            + "order by b.createdAt desc, b.id desc") // 조건과 정렬의 방향을 맞춘다.
    List<BookCursorRow> afterWindow( // 경계 행의 존재를 다시 확인하지 않는다.
            @Param("time") Instant time, // 마지막으로 반환했던 생성 시각이다.
            @Param("id") long id, // 같은 시각에서의 마지막 ID다.
            Pageable pageable // 페이지 번호 0과 조회 크기만 사용한다.
    );

    List<BookTitleView> findByTitleOrderByIdAsc(String title, Pageable pageable); // 파생 쿼리와 closed projection을 비교한다.
}
```

`from Book b`는 Entity 모델을 기준으로 조건을 해석한다는 뜻이다. `select new ...`를 썼으므로 결과가 `Book` Entity 목록이 되는 것은 아니다. 설명 컬럼을 제외했어도 `createdAt`은 SELECT와 정렬·경계 조건에 모두 남아 있다.

생성자 식 안에 `b.title as title` 같은 별칭을 넣지 않는다. 인터페이스 Projection의 명시적 쿼리에서 별칭을 쓰는 상황과 구분해야 한다. Spring Data의 DTO 쿼리 재작성 기능도 있지만, 이번에는 선택한 값과 생성자 연결을 눈으로 확인하려고 직접 `select new`를 쓴다. [Spring Data JPA Projection의 JPQL 규칙](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)을 참고한다.

## 8. BookCursorService.java 전체 교체

같은 클래스 이름을 유지하되 생성자의 의존 대상을 새 Repository로 바꾼다. **새 이름의 Service를 추가하는 것이 아니라 기존 파일을 교체**한다. Controller와 기존 테스트가 사용하는 `list(BookCursorQuery)` 계약은 유지한다.

```java
package com.example.pagingstudy; // 기존 Service와 같은 패키지·클래스 이름을 유지한다.

import java.util.List; // 조회 결과와 공개 목록을 담는다.
import org.springframework.data.domain.PageRequest; // 항상 0번 구간에서 최대 size + 1개를 읽는다.
import org.springframework.data.domain.Pageable; // 첫 조회·후속 조회에 같은 제한을 전달한다.
import org.springframework.stereotype.Service; // 기존 Controller의 주입 대상을 유지한다.
import org.springframework.transaction.annotation.Transactional; // 조회와 응답 조립의 트랜잭션 경계다.

@Service // 기존 Bean을 이 구현으로 교체한다.
public class BookCursorService { // 공개 메서드는 그대로 두고 조회 구현을 바꾼다.
    private final BookProjectionRepository repository; // Entity용 Repository에서 Projection용으로 바뀐 지점이다.

    public BookCursorService(BookProjectionRepository repository) { // Spring이 새 Repository Bean을 주입한다.
        this.repository = repository; // 테스트에서도 실제 Projection 조회를 사용한다.
    }

    @Transactional(readOnly = true) // 읽기 의도를 나타내며 HTTP 요청 사이의 스냅샷은 보장하지 않는다.
    public BookCursorResponse list(BookCursorQuery query) { // 이전과 동일한 검증된 조건을 받는다.
        Pageable limit = PageRequest.of(0, query.size() + 1); // 커서 이후에 offset을 또 증가시키지 않는다.
        List<BookCursorRow> rows = query.after() // 결과 원소 타입이 Book에서 조회 DTO로 바뀌었다.
                .map(cursor -> repository.afterWindow(cursor.createdAt(), cursor.id(), limit)) // 이전 경계 조건으로 조회한다.
                .orElseGet(() -> repository.firstWindow(limit)); // 커서 생략 시에만 첫 조회를 실행한다.
        boolean hasNext = rows.size() > query.size(); // 여분 항목으로 다음 존재 여부를 판단한다.
        List<BookCursorRow> visible = rows.subList(0, Math.min(query.size(), rows.size())); // 실제 공개할 최대 size개만 선택한다.
        List<BookSummary> items = visible.stream() // 조회 DTO를 공개 DTO로 바꾼다.
                .map(row -> new BookSummary(row.id(), row.title())).toList(); // 생성 시각·설명은 공개 항목 필드에 추가하지 않는다.
        String nextCursor = null; // 마지막 구간에는 다음 커서를 제공하지 않는다.
        if (hasNext) { // 유효한 size가 1 이상이므로 이 경우 마지막 항목이 존재한다.
            BookCursorRow last = visible.get(visible.size() - 1); // 여분 항목이 아니라 마지막 반환 항목이다.
            nextCursor = new BookCursor(last.createdAt(), last.id()).encode(); // 조회 DTO에 남겨 둔 정렬 키로 v1 커서를 만든다.
        }
        return new BookCursorResponse(items, hasNext, nextCursor); // 기존 HTTP 응답 계약을 유지한다.
    }
}
```

생성 시각을 “화면에 안 보이는 불필요한 필드”로 판단해 제거하면 다음 커서를 만들 수 없다. 나중에 ID로 시각을 재조회하면 추가 쿼리가 생기며 삭제·수정 시점의 문제까지 새로 생긴다. 조회에 필요한 데이터는 **화면 필드와 탐색·업무 처리 필드의 합**으로 판단한다.

이번에는 Spring의 Scroll API가 아닌 수동 keyset 쿼리지만, 공식 Scroll API도 Projection에서 정렬 키를 추출하려면 필요한 필드가 결과에 포함돼야 한다고 설명한다. [Spring Data Scrolling](https://docs.spring.io/spring-data/commons/reference/repositories/scrolling.html)을 참고한다.

## 9. SQL을 보지 않고 “최적화됐다”고 말하지 않는다

다음 두 검증은 서로 다르다.

- 결과 검증: 제목·ID·순서·다음 커서가 이전과 같은가?
- 조회 형태 검증: 실제 준비되는 SQL에서 description이 빠지고 필요한 정렬 키가 남는가?

응답 JSON에 description이 없다는 테스트만으로는 DB에서 설명을 읽지 않았다고 결론 낼 수 없다. 그래서 테스트 전용 `StatementInspector`를 사용한다. 이는 Hibernate가 JDBC statement를 준비하기 **전에 SQL을 관찰**하는 지점이며, 실행 시간이나 DB 내부 페이지 읽기를 측정하는 도구는 아니다. [Hibernate StatementInspector API](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/resource/jdbc/spi/StatementInspector.html)를 참고한다.

### 9.1 SqlCapture.java 전체 코드 — src/test/java에만 둔다

```java
package com.example.pagingstudy; // 테스트 설정에서 이 타입의 전체 이름을 지정한다.

import java.util.ArrayList; // 관찰한 SQL을 순서대로 모은다.
import java.util.List; // 외부에 읽기용 결과를 돌려준다.
import java.util.Locale; // SQL 대소문자 정규화의 로케일을 고정한다.
import org.hibernate.resource.jdbc.spi.StatementInspector; // Hibernate의 SQL 관찰 지점을 구현한다.

public class SqlCapture implements StatementInspector { // Hibernate가 기본 생성자로 만들 수 있는 public 타입이다.
    private static final ThreadLocal<List<String>> SQL = ThreadLocal.withInitial(ArrayList::new); // 현재 테스트 스레드의 기록만 저장한다.

    @Override // 실행 전 SQL을 전달받는 콜백이다.
    public String inspect(String sql) { // 바인딩 값이 들어간 최종 SQL 로그를 만드는 기능은 아니다.
        SQL.get().add(sql); // 관찰한 원래 SQL을 보관한다.
        return sql; // 내용을 수정하지 않고 그대로 실행 경로에 돌려준다.
    }

    public static List<String> selects() { // 현재 구간의 SELECT 문만 반환한다.
        return SQL.get().stream() // 현재 스레드의 기록을 읽는다.
                .map(String::stripLeading) // 앞쪽 공백이 있어도 분류한다.
                .map(sql -> sql.toLowerCase(Locale.ROOT)) // 비교할 때 대소문자를 고정한다.
                .filter(sql -> sql.startsWith("select ")) // 이 단순 실습 쿼리의 SELECT만 대상으로 한다.
                .toList(); // 호출자가 기록 목록 자체를 수정하지 않게 한다.
    }

    public static void clear() { // 테스트 전환과 종료 시 호출한다.
        SQL.remove(); // 스레드에 남아 있는 이전 기록을 제거한다.
    }
}
```

이 도구는 이번의 동기식·단순 SELECT 테스트에 한정된다. 다른 스레드에서 실행한 쿼리, SQL 주석이나 CTE로 시작하는 쿼리까지 포괄하는 범용 분석기가 아니다. Hibernate 설정으로 공유되는 관찰 객체가 여러 스레드의 목록을 하나에 섞지 않도록 ThreadLocal로 분리했다. 운영 코드나 운영 SQL 수집기로 옮기지 않는다.

### 9.2 BookProjectionJpaTest.java 전체 코드

`spring.jpa.properties` 아래의 Hibernate 설정으로 관찰기를 등록하고 SQL 주석은 끈다. 기본 Boot 물리 이름 매핑에서 createdAt은 `created_at`, description은 `description`이라는 컬럼이 된다는 실습 전제다. 이름 전략을 바꿨다면 SQL 검사도 맞춰야 한다.

```java
package com.example.pagingstudy; // 기존 Entity·Service·Repository를 재사용한다.

import java.time.Instant; // 고정된 시각을 사용한다.
import java.util.List; // 조회 결과를 받는다.
import jakarta.persistence.EntityManager; // 저장 후 영속성 컨텍스트를 비운다.
import org.junit.jupiter.api.AfterEach; // 테스트가 끝나면 SQL 기록을 제거한다.
import org.junit.jupiter.api.Test; // 네 가지 검증 시나리오를 선언한다.
import org.springframework.beans.factory.annotation.Autowired; // 실제 JPA Bean을 주입받는다.
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest; // Boot 4의 JPA 슬라이스다.
import org.springframework.context.annotation.Import; // 교체한 Service를 테스트에 포함한다.
import org.springframework.data.domain.PageRequest; // 조회 개수를 제한한다.
import static org.assertj.core.api.Assertions.assertThat; // 값과 SQL을 확인한다.

@DataJpaTest(properties = { // 이 테스트 문맥에만 SQL 관찰 설정을 추가한다.
        "spring.jpa.properties.hibernate.session_factory.statement_inspector=com.example.pagingstudy.SqlCapture", // 테스트 전용 관찰기다.
        "spring.jpa.properties.hibernate.use_sql_comments=false" // 단순 SELECT 분류를 위해 Hibernate SQL 주석을 끈다.
}) // H2·테스트 트랜잭션과 기본 rollback을 사용한다.
@Import(BookCursorService.class) // 실제 Projection 기반 Service를 실행한다.
class BookProjectionJpaTest { // 초기 데이터 스크립트 없는 이전 실습 프로젝트 기준이다.
    @Autowired // 데이터 준비용 기존 CRUD Repository다.
    private BookRepository books; // 긴 설명을 포함한 Book을 저장한다.
    @Autowired // 변경 전 Entity 조회를 비교하기 위해 유지한다.
    private BookCursorRepository entityQueries; // 반환 타입이 List<Book>이다.
    @Autowired // 새 Projection 쿼리를 직접 검증한다.
    private BookProjectionRepository projections; // record와 interface 결과를 받는다.
    @Autowired // 실제 API 내부 조회 흐름을 실행한다.
    private BookCursorService service; // 이번에 교체한 구현이다.
    @Autowired // 저장·조회 경계를 명확히 한다.
    private EntityManager em; // 1차 캐시에 남은 데이터에 기대지 않게 한다.

    @AfterEach // 성공·실패 여부와 관계없이 실행된다.
    void cleanUp() { // 다음 테스트에 기록이 섞이지 않게 한다.
        SqlCapture.clear(); // 현재 테스트 스레드의 기록을 제거한다.
    }

    private Book save(String title, String time) { // 모든 데이터에 긴 설명을 넣는다.
        return books.saveAndFlush(new Book(title, Instant.parse(time), "x".repeat(5000))); // DB에 INSERT한 뒤 실제 ID를 받는다.
    }

    private void startObservation() { // 데이터 준비 SQL을 조회 검증에서 제외한다.
        em.flush(); // 아직 반영되지 않은 변경이 있다면 먼저 반영한다.
        em.clear(); // 조회가 관리 중인 Entity 상태에 의존하지 않게 한다.
        SqlCapture.clear(); // 그 뒤부터 발생하는 SELECT만 검사한다.
    }

    private String onlySelect() { // 이 단순 List 조회의 SQL 개수를 확인한다.
        List<String> statements = SqlCapture.selects(); // 이번 관찰 구간의 SELECT 문이다.
        assertThat(statements).hasSize(1); // 추가 count나 재조회가 생기면 실패한다.
        return statements.get(0); // 전체 SQL 문자열의 정확한 모양까지 고정하지는 않는다.
    }

    private BookCursorResponse read(int size, String token) { // 첫 구간과 후속 구간을 공통으로 검증한다.
        startObservation(); // 쿼리 하나의 관찰 범위를 새로 시작한다.
        BookCursorResponse result = service.list(new BookCursorQuery(size, BookCursor.decode(token))); // 실제 조건·Projection·커서를 연결한다.
        assertThat(onlySelect()).contains("title", "created_at").doesNotContain("description"); // 두 조회 경로 모두 필요한 키만 선택해야 한다.
        return result; // 응답 값도 각 테스트에서 별도로 검증한다.
    }

    @Test // 같은 데이터를 두 방식으로 조회한다.
    void entityReadsDescriptionButDtoDoesNot() { // JSON만 검사해서는 구분할 수 없는 차이다.
        Book saved = save("Spring", "2026-09-13T00:00:00Z"); // 긴 설명을 실제로 저장한다.
        startObservation(); // INSERT를 관찰 대상에서 제외한다.
        List<Book> entities = entityQueries.firstWindow(PageRequest.of(0, 2)); // 이전 Entity 쿼리를 실행한다.
        assertThat(entities).hasSize(1); // 한 권이 조회되어야 한다.
        assertThat(em.contains(entities.get(0))).isTrue(); // 이 경로의 결과는 관리되는 Entity다.
        assertThat(onlySelect()).contains("description"); // 공개 DTO로 나중에 바꿔도 이미 설명을 선택한 상태다.
        startObservation(); // 이전 조회 기록과 Entity를 비운다.
        List<BookCursorRow> rows = projections.firstWindow(PageRequest.of(0, 2)); // 세 값만 담는 DTO를 조회한다.
        assertThat(rows).containsExactly(new BookCursorRow(saved.getId(), "Spring", Instant.parse("2026-09-13T00:00:00Z"))); // 생성자 순서·타입 매핑을 확인한다.
        assertThat(onlySelect()).contains("title", "created_at").doesNotContain("description"); // 읽을 컬럼이 줄었는지 확인한다.
    }

    @Test // closed interface projection의 getter 매핑을 확인한다.
    void closedInterfaceReadsOnlyTitleView() { // 커서 서비스와 별개인 짧은 비교 예제다.
        Book saved = save("Same", "2026-09-13T00:00:00Z"); // 제목이 같은 결과를 찾는다.
        save("Other", "2026-09-13T00:00:00Z"); // 조건에서 제외되어야 하는 데이터다.
        startObservation(); // 저장 과정의 SQL은 제외한다.
        List<BookTitleView> views = projections.findByTitleOrderByIdAsc("Same", PageRequest.of(0, 10)); // 타입의 getter에 맞춘 조회다.
        assertThat(views).hasSize(1); // 제목 조건이 적용되어야 한다.
        assertThat(views.get(0).getId()).isEqualTo(saved.getId()); // ID 속성을 읽는다.
        assertThat(views.get(0).getTitle()).isEqualTo("Same"); // 제목 속성을 읽는다.
        assertThat(onlySelect()).contains("title").doesNotContain("description", "created_at"); // 이 조회에는 커서 시각도 필요하지 않다.
    }

    @Test // Projection으로 바꿔도 복합 키 탐색이 유지되어야 한다.
    void cursorKeepsTieBreakerAndLastVisibleKey() { // 생성 시각 동점과 ID만 비교하는 오류를 함께 확인한다.
        Book same1 = save("Same1", "2026-09-13T00:00:00Z"); // 같은 시각 중 작은 ID다.
        Book same2 = save("Same2", "2026-09-13T00:00:00Z"); // 같은 시각 중 큰 ID다.
        Book older = save("Older", "2026-09-12T00:00:00Z"); // ID는 더 크지만 시각은 오래됐다.
        BookCursorResponse first = read(1, null); // 첫 구간의 SELECT도 검사한다.
        assertThat(first.items()).containsExactly(new BookSummary(same2.getId(), "Same2")); // 공개 DTO 형태는 이전과 같다.
        assertThat(first.hasNext()).isTrue(); // 여분 항목이 있다.
        assertThat(BookCursor.decode(first.nextCursor()).orElseThrow()) // 공개 항목에 없는 시각이 커서에는 남아야 한다.
                .isEqualTo(new BookCursor(Instant.parse("2026-09-13T00:00:00Z"), same2.getId())); // 마지막 반환 항목의 두 키다.
        BookCursorResponse second = read(1, first.nextCursor()); // 후속 구간의 SELECT도 검사한다.
        assertThat(second.items()).containsExactly(new BookSummary(same1.getId(), "Same1")); // 같은 시각의 다음 ID를 누락하지 않는다.
        BookCursorResponse third = read(1, second.nextCursor()); // 오래된 시각의 구간으로 이동한다.
        assertThat(third.items()).containsExactly(new BookSummary(older.getId(), "Older")); // ID가 커도 시각 조건으로 포함된다.
        assertThat(third.hasNext()).isFalse(); // 마지막 구간이다.
        assertThat(third.nextCursor()).isNull(); // 더 이어갈 커서를 만들지 않는다.
    }

    @Test // 항목이 없거나 size와 정확히 같은 경우를 확인한다.
    void emptyAndExactSizeHaveNoNextCursor() { // 여분 항목이 없으면 종료한다.
        BookCursorResponse empty = read(2, null); // 빈 DB에도 조회는 한 번 수행된다.
        assertThat(empty.items()).isEmpty(); // 빈 배열을 반환한다.
        assertThat(empty.hasNext()).isFalse(); // 다음 결과는 없다.
        assertThat(empty.nextCursor()).isNull(); // 빈 목록의 마지막 항목에 접근하지 않는다.
        save("One", "2026-09-12T00:00:00Z"); // 두 항목을 준비한다.
        save("Two", "2026-09-13T00:00:00Z"); // 정렬할 두 번째 항목이다.
        BookCursorResponse exact = read(2, null); // 최대 세 개를 읽지만 두 개만 존재한다.
        assertThat(exact.items()).hasSize(2); // 두 개를 모두 반환한다.
        assertThat(exact.hasNext()).isFalse(); // size만큼 왔다고 다음이 있다고 추측하지 않는다.
        assertThat(exact.nextCursor()).isNull(); // 계약대로 마지막 커서는 null이다.
    }
}
```

이번 테스트는 **4회 실행을 예상**한다. SQL 검사로 컬럼 선택과 추가 SELECT 발생 여부를 확인하고, 값 검사로 결과 계약을 확인한다. 정확한 SQL 문자열·별칭·limit 문법을 통째로 고정하지는 않는다. 이 문자열 검사는 단순 쿼리용 회귀 검사이지 범용 SQL 파서가 아니다.

실제 전송 바이트·DB 내부 읽기·응답 시간·메모리 절감률까지 측정한 것은 아니다. 캐시·데이터 크기·DB 엔진에 따라 효과가 달라진다. JPA 슬라이스의 트랜잭션과 기본 rollback 범위도 이해하고 사용한다. [DataJpaTest API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html)를 참고한다.

## 10. 기존 테스트까지 함께 실행해야 하는 이유

이번 새 테스트만 통과해도 기존 입력 오류·경계 행 삭제·앞쪽 삽입·HTTP 응답 검증이 모두 끝난 것은 아니다. 기존 `BookCursorJpaTest`는 같은 Service 타입을 실제로 주입하므로, 교체 뒤에는 새 Projection Repository를 사용하는 흐름을 검사하게 된다. `BookCursorControllerTest`의 Service 대역은 여전히 HTTP 계층만 검증한다.

아래 명령은 TIL 루트가 아니라 **15·16번 노트를 준비한 Maven 실습 프로젝트 루트**에서 실행한다.

```powershell
.\mvnw.cmd "-Dtest=BookProjectionJpaTest" test # 새 SQL·Projection 테스트 네 개를 실행한다.
.\mvnw.cmd "-Dtest=BookCursorTest,BookCursorJpaTest,BookCursorControllerTest,BookProjectionJpaTest" test # 이전 커서 20회와 새 4회를 함께 검사한다.
.\mvnw.cmd test # 기존 offset 테스트까지 포함해 프로젝트 전체를 확인한다.
```

두 번째 명령은 이전 예제를 그대로 유지했다면 총 **24회 실행을 예상**한다. 이 노트에서 실행 성공 로그를 제시하지는 않는다. JPQL의 타입명·생성자·속성 오류는 부팅이나 조회 시 드러날 수 있으므로 문서만 읽고 완료로 판단하지 않는다.

이번 변경은 공개 응답에 description이나 createdAt 필드를 추가하지 않는다. 실제 데이터가 같은 상태에서 목록·정렬·커서 형식이 같아야 하며, 이전의 커서 위변조·만료·동시 변경 한계도 그대로다.

## 11. 조회 최적화의 적용 기준

### 11.1 읽기 화면이라고 무조건 Projection으로 바꾸지는 않는다

Entity를 수정하고 저장해야 하는 업무는 관리되는 Entity와 변경 감지가 유용하다. 목록·통계처럼 값만 필요한 읽기에는 DTO 조회를 검토할 수 있다. “DTO를 조회했으니 나중에 값을 바꾸면 DB도 업데이트된다”는 기대는 잘못이다.

필드가 몇 개 없고 모두 필요한 경우에는 컬럼 절감이 거의 없을 수도 있다. 이번 예제처럼 불필요한 큰 필드가 있는지, 실제 병목이 네트워크·Entity 구성·DB 탐색 중 어디인지 확인한다.

### 11.2 컬럼 수·행 수·쿼리 수는 다른 축이다

- Projection은 주로 **어떤 값과 객체를 가져오는가**를 바꾼다.
- 페이지네이션은 **몇 행을 가져오는가**를 제한한다.
- 인덱스·실행 계획은 **DB가 그 행을 어떻게 찾는가**와 관련된다.
- 연관관계 로딩은 **추가 쿼리가 얼마나 발생하는가**에도 영향을 준다.

따라서 Projection 하나로 깊은 offset·잘못된 필터·비효율적인 정렬·N+1까지 모두 해결됐다고 말할 수 없다. 이번에는 연관관계 없는 Book만 조회했다.

### 11.3 중첩 Projection과 조인은 별도로 확인한다

연관 객체의 속성을 Projection에 넣으면 조인이 발생할 수 있고, 중첩 형태라고 필요한 컬럼만 최소로 가져오는 것이 항상 보장되지는 않는다. DTO라는 반환 타입 이름만 보고 SQL 형태를 추측하지 않는다. 특히 일대다 조인은 결과 행이 늘어 페이지 경계와 count의 의미에 영향을 줄 수 있다.

이번 테스트처럼 실제 SQL·조회 건수·응답 결과를 나눠 확인한 뒤 조인 전략을 결정한다. 연관관계의 기본 개념은 [Entity 생명주기와 연관관계](../08_09_05_Entity_Lifecycle_and_Relationships/09_05_Entity_Lifecycle_and_Relationships.md)에서 다시 확인한다.

## 12. 자주 틀리는 부분

| 증상·오해 | 원인 후보 | 확인할 내용 |
| --- | --- | --- |
| DTO를 반환하는데 큰 컬럼도 조회됨 | Entity 조회 후 Java에서 변환 | SELECT 목록과 반환 타입을 함께 확인 |
| JPQL에서 DTO 타입을 못 찾음 | 패키지·클래스 이름 불일치 | `select new`의 전체 타입 이름 |
| 생성자 매핑 오류 | 인수 순서·타입·개수 불일치 | record 선언과 SELECT 순서 비교 |
| 인터페이스 값이 비거나 매핑 실패 | getter와 속성·별칭 불일치 | closed projection의 속성 대응 |
| 다음 커서를 만들 수 없음 | 조회 DTO에서 createdAt 제거 | 공개 필드와 내부 탐색 필드 구분 |
| SQL 검사가 의도와 다르게 실패 | 다른 이름 전략·주석·데이터 준비 쿼리 | 관찰 범위와 실습 전제 확인 |
| 최적화 뒤 기존 동작 회귀 | 새 SQL 테스트만 실행 | 기존 입력·삽입·삭제·HTTP 테스트도 실행 |

## 13. 핵심 정리와 다음 학습

1. DTO 응답과 DTO Projection은 적용되는 단계가 다르다.
2. 필요한 컬럼을 줄이려면 DB의 SELECT 목록을 확인해야 한다.
3. Closed interface는 속성 getter, record DTO는 생성자와 타입 연결을 이해한다.
4. JPQL 생성자 식은 전체 클래스 이름과 인수 순서·타입을 맞춰야 한다.
5. 커서 조회 DTO에는 공개 필드뿐 아니라 모든 필요한 정렬 키도 남긴다.
6. scalar 값으로 만든 DTO는 Entity 변경 감지용 객체가 아니다.
7. SQL 관찰은 실행 시간·DB 내부 비용 측정과 같지 않다.
8. 조회 구현을 바꿔도 기존 HTTP·입력 검증·커서 회귀 테스트를 유지한다.

다음 확장 주제는 [N+1 문제와 fetch join·EntityGraph](../18_09_14_N_Plus_One_and_Fetch_Strategies/09_14_N_Plus_One_and_Fetch_Strategies.md)다. 연관 데이터가 필요한 목록에서 쿼리가 늘어나는 원인을 재현하고, 조회 전략을 바꿨을 때 페이지 범위와 결과가 유지되는지 검증한다.

## 14. 복습 퀴즈

1. Controller가 작은 DTO를 반환한다는 사실만으로 DB 조회 컬럼이 적다고 결론 낼 수 있는가?
2. 이번 BookCursorRow에는 왜 공개 응답에 없는 createdAt이 있는가?
3. `select new` 생성자 식의 클래스 이름과 인수에서 무엇을 맞춰야 하는가?
4. 설명 컬럼을 제외했어도 N+1이나 깊은 offset 문제가 남을 수 있는 이유는 무엇인가?
5. StatementInspector에서 SELECT 한 개를 관찰했다면 응답 시간이 개선됐다고 말할 수 있는가?
6. Service의 Repository 의존성만 바꿨는데 왜 기존 커서 테스트를 다시 실행해야 하는가?

<details>
<summary>정답과 해설</summary>

1. 없다. Entity를 모두 읽은 뒤 응답 단계에서 값만 복사했을 수 있다. SQL을 확인해야 한다.
2. 다음 커서의 복합 정렬 키이기 때문이다. 화면 필드와 조회 처리에 필요한 필드는 다르다.
3. 전체 패키지 이름, 생성자 인수의 개수·순서·타입을 맞춘다. 생성자 인수 안에 임의 별칭을 붙이지 않는다.
4. 컬럼 선택, 결과 행 수, DB 탐색 비용, 연관 로딩 쿼리 수는 서로 다른 문제이기 때문이다.
5. 없다. SQL 준비를 관찰했을 뿐 실행 시간·캐시·전송량·DB 내부 비용을 측정하지 않았다.
6. 반환 타입 변경 과정에서 정렬 키·경계·여분 항목·다음 커서 생성이 달라질 수 있기 때문이다.

</details>

## 15. 공식 문서로 이어서 읽기

- [Spring Data JPA Projections](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html): 인터페이스·record DTO·JPQL·중첩 Projection의 주의점
- [Jakarta Persistence 사양](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2): 4.9.2 생성자 식과 결과 객체의 의미
- [Spring Data Scrolling](https://docs.spring.io/spring-data/commons/reference/repositories/scrolling.html): Projection에 필요한 정렬 키
- [Hibernate StatementInspector](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/resource/jdbc/spi/StatementInspector.html): SQL 준비 전 관찰과 공유 인스턴스의 주의점
- [Spring Boot DataJpaTest](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html): JPA 슬라이스·트랜잭션·테스트 DB 범위
