# 페이지네이션·정렬과 조회 API: 입력 검증부터 JPA 조회·응답 DTO까지

- 🎯 학습 목표: 목록 API의 페이지·크기·정렬 계약을 정하고, 필요한 범위만 DB에서 읽어 일관된 응답으로 반환한다.
- 🧩 핵심 키워드: pagination, offset, Pageable, PageRequest, Sort, Page, Slice, tie-breaker, 응답 DTO
- ⭐ 중요도: ★★★★★ — 목록 조회는 거의 모든 서비스에 있고, 입력 제한·정렬·조회 비용을 함께 설계해야 한다.
- 📝 한눈에 보는 내용: 도서 목록을 예제로 페이지 번호의 시작점, 정렬 허용 목록, 전체 개수와 다음 페이지 여부, HTTP·JPA 테스트를 연결한다.
- 🧱 선수 지식: Java record·List, Controller·Service·Repository, JPA Entity, 생성자 주입, HTTP 오류 처리
- 🔗 이전 노트: [HTTP Interface 클라이언트](../14_09_10_HTTP_Interface_Clients/09_10_HTTP_Interface_Clients.md)

> 정리 기준일: 2026-09-11. Spring Boot 4.1·Spring Data 4.1 계열 공식 문서를 참고한 Java 21 학습 예제다. 이전 외부 HTTP 클라이언트 프로젝트와 분리된 새 프로젝트를 사용한다. TIL 저장소에서 Java 컴파일·Spring 테스트를 실행한 결과가 아니며, 아래 응답과 테스트 결과는 예상이다.

## 1. 책이 열 권일 때의 목록 코드가 십만 권에서도 괜찮을까?

목록 API에서 `repository.findAll()`로 모든 책을 가져온 뒤 Java의 `subList()`로 20개만 남긴다고 하자. 브라우저에는 20개만 보이지만 서버와 DB는 이미 전체 데이터를 조회하고 전송했을 수 있다. 응답을 작게 만드는 것과 조회 비용을 줄이는 것은 다르다.

페이지네이션은 큰 결과를 작은 구간으로 나눠 가져오는 방법이다. 이번에는 “정렬한 결과에서 앞의 몇 개를 건너뛰고 최대 몇 개를 읽을 것인가”를 지정하는 **offset 기반 페이지네이션**을 배운다. offset은 앞에서 건너뛸 결과 수라는 뜻이다.

사용자가 보낸 페이지 크기를 그대로 믿어서도 안 된다. `size=1000000`을 허용하면 한 번의 요청으로 많은 데이터를 읽을 수 있다. 따라서 페이지네이션은 UI 버튼뿐 아니라 **입력 제한, DB 조회, 공개 응답의 약속**까지 포함한다.

## 2. 전체 흐름과 API 계약

```text
GET /books?page=0&size=20&sort=newest
  → Controller: 쿼리 문자열을 Java 값으로 변환
  → BookPageQuery: 범위·정렬 이름 검증
  → Service: 조회 단위와 DTO 변환
  → PageRequest: 페이지 번호·크기·정렬 전달
  → Repository → DB: 정렬 후 해당 구간 조회, 필요하면 전체 개수 조회
  → Page<Book> → BookPageResponse
  → JSON: items + 페이지 메타데이터
```

메타데이터는 실제 책 목록을 설명하는 추가 정보다. 페이지 번호·전체 개수·다음 페이지 존재 여부가 이에 해당한다.

이번 예제의 공개 계약은 다음과 같다. 아래 제한은 Spring의 고정 규칙이 아니라 **이 학습 API에서 선택한 정책**이다.

| 입력 | 기본값 | 허용 범위·의미 |
| --- | --- | --- |
| `page` | `0` | `0`부터 `1000`까지, 첫 페이지는 0 |
| `size` | `20` | `1`부터 `100`까지, 한 번에 요청하는 최대 항목 수 |
| `sort` | `newest` | `newest`, `oldest`, `title`만 허용 |

여기서 `sort=newest`는 우리가 정한 API 문법이다. Spring Data의 기본 웹 인수 해석기에서 흔히 쓰는 `sort=createdAt,desc` 형식을 그대로 받는 엔드포인트가 아니다.

범위를 벗어난 숫자나 지원하지 않는 정렬은 400으로 거부한다. 숫자로 바꿀 수 없는 `page=abc`도 MVC의 타입 변환 단계에서 400이 된다. 허용 범위 안이지만 마지막 페이지를 지난 조회는 **200과 빈 목록**을 반환한다. 페이지가 비었다고 단건 조회의 404 규칙을 그대로 가져오지 않는다.

생략하거나 빈 값으로 보낸 매개변수에는 이번 `@RequestParam(defaultValue=...)`의 기본값이 적용된다. “빈 문자열도 무조건 오류”인 계약을 원한다면 별도 처리가 필요하다. [RequestParam API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/bind/annotation/RequestParam.html)를 참고한다.

## 3. page, size, offset을 손으로 계산한다

페이지 크기가 3이면 offset은 `page × size`다.

| page | size | offset | 정렬된 결과에서 읽는 위치 |
| ---: | ---: | ---: | --- |
| 0 | 3 | 0 | 첫 번째부터 세 번째까지 |
| 1 | 3 | 3 | 네 번째부터 여섯 번째까지 |
| 2 | 3 | 6 | 일곱 번째부터 아홉 번째까지 |

총 7개라면 마지막 구간에는 1개만 있다. `size=3`은 항상 세 개를 돌려달라는 보장이 아니라 최대 세 개를 요청한다는 뜻이다. 화면에 “1페이지”라고 표시하더라도 API에 보내는 번호는 0일 수 있으므로 프론트엔드와 시작 번호를 맞춰야 한다.

`Pageable`은 조회 구간과 정렬을 표현하는 인터페이스이고, `PageRequest`는 페이지 번호·크기로 이를 만드는 구현이다. `PageRequest.of(0, 20, sort)`는 첫 20개를 요청한다. API 자체는 음수 페이지와 0 이하 크기를 허용하지 않지만, 우리 서비스의 크기 상한 100까지 대신 정해 주지는 않는다. [PageRequest API](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/domain/PageRequest.html)를 참고한다.

## 4. Page와 Slice는 어떤 질문에 답하는가?

| 타입 | 알 수 있는 내용 | 선택할 상황 |
| --- | --- | --- |
| `List<T>` | 반환된 항목 | 페이지 메타데이터가 필요 없을 때 |
| `Slice<T>` | 현재 항목과 다음 구간의 존재 여부 등 | “더 보기” 중심이고 전체 개수는 필요 없을 때 |
| `Page<T>` | Slice 정보에 전체 항목 수·전체 페이지 수 추가 | “총 123개, 7페이지”를 표시해야 할 때 |

`Page`는 전체 개수를 알기 위해 count 쿼리가 추가로 필요할 수 있다. 다만 결과 크기로 마지막 구간 등을 판단하는 최적화가 가능하므로 **언제나 정확히 SQL 두 번**이라고 외우지는 않는다. `Slice`는 일반적인 JPA 조회에서 요청 크기보다 하나 더 읽어 다음 구간이 있는지 판단할 수 있다. [Spring Data의 페이징과 반환 타입](https://docs.spring.io/spring-data/commons/reference/repositories/query-methods-details.html)을 참고한다.

`Page`를 먼저 조회한 뒤 변수 타입만 `Slice`로 바꿔도 이미 수행한 count 비용은 사라지지 않는다. 반대로 `findAll(Pageable)`을 임의로 `Slice` 반환 타입으로 재정의할 수 있는 것도 아니다. 필요하다면 `Slice<Book> findByTitleContaining(String title, Pageable pageable)`처럼 별도 조회 메서드의 계약을 설계한다. 이번 전체 코드는 전체 개수를 보여 주기 위해 `Page`를 사용한다.

메타데이터 중 `size`는 요청 크기, 실제 항목 수는 `items.size()`다. 마지막 페이지에서는 두 값이 달라도 정상이다. [Page API](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/domain/Page.html), [Slice API](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/domain/Slice.html)를 함께 확인한다.

## 5. 정렬은 페이지를 나누기 전에 확정한다

생성 시각이 같은 책이 여러 권 있다면 `createdAt DESC`만으로는 그 책들끼리의 순서를 결정하지 못한다. 마지막에 고유한 ID를 더하는 **동점 해소 기준(tie-breaker)**이 필요하다.

이번 `newest` 정렬은 `createdAt DESC, id DESC`다. 시각이 같으면 ID가 큰 책을 먼저 둔다. ID가 언제나 업무상 실제 생성 순서를 뜻한다는 주장이 아니라, 동점에서 결과 순서를 완성하는 규칙이다. `title` 정렬은 `title ASC, id ASC`로 정한다.

중요한 한계도 있다. 순서를 완전히 정해도 **여러 HTTP 요청 사이의 데이터 변경까지 고정되지는 않는다**. 첫 페이지를 읽은 뒤 맨 앞에 새 책이 들어오면 다음 offset 페이지에 이전 책이 다시 나타날 수 있다. 삭제로 인해 일부 책을 건너뛰는 경우도 있다.

외부에서 받은 문자열을 그대로 `Sort.by(userInput)`에 넣는 대신, `newest` 같은 공개 이름을 내부 속성에 대응시킨다. 허용 목록은 잘못된 속성, 원치 않는 정렬 비용, 내부 구조 노출을 줄이는 정책이다. Spring의 Sort를 쓰면 모든 입력이 곧바로 SQL 주입으로 이어진다는 뜻은 아니지만, 원시 SQL 조각을 연결하거나 사용자 입력을 `JpaSort.unsafe`에 넘기는 방식은 피한다. 정렬 속성은 DB 컬럼명보다 **Entity 속성명**을 기준으로 생각한다. [JPA 정렬 문서](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)를 참고한다.

## 6. 별도 실습 프로젝트 준비

Java 21·Maven·Boot 4.1 계열 프로젝트를 만들고 기본 패키지를 `com.example.pagingstudy`로 둔다. 이전 Security·외부 HTTP 프로젝트의 파일과 섞지 않는다. 예제에는 인증·검색 필터·등록 API를 넣지 않으며, 테스트가 필요한 데이터를 직접 준비한다.

| 의존성 | scope | 목적 |
| --- | --- | --- |
| `spring-boot-starter-webmvc` | 기본 | MVC와 JSON 응답 |
| `spring-boot-starter-data-jpa` | 기본 | Entity·Repository·트랜잭션 |
| `com.h2database:h2` | runtime | 로컬 실습용 메모리 DB, 테스트에서도 사용 가능 |
| `spring-boot-starter-test` | test | JUnit·AssertJ·Mockito |
| `spring-boot-starter-webmvc-test` | test | Boot 4 MVC 테스트 지원 |
| `spring-boot-starter-data-jpa-test` | test | Boot 4 JPA 테스트 지원 |

Starter의 groupId는 `org.springframework.boot`다. 버전은 생성 프로젝트의 Boot 의존성 관리를 사용한다. Maven Wrapper와 빌드 파일은 Initializr 등으로 준비하고 위 의존성을 확인한다. [Boot Starter 목록](https://docs.spring.io/spring-boot/reference/using/build-systems.html)을 참고한다.

```text
src/main/java/com/example/pagingstudy/
  PagingStudyApplication.java
  Book.java
  BookRepository.java
  BookPageQuery.java
  InvalidBookQueryException.java
  BookSummary.java
  BookPageResponse.java
  BookQueryService.java
  BookController.java
  BookQueryErrorHandler.java
src/main/resources/
  application.yaml
src/test/java/com/example/pagingstudy/
  BookControllerTest.java
  BookPagingJpaTest.java
```

아래 Java 블록은 제목에 적힌 **각 파일의 전체 코드**다. public 타입을 한 파일에 합치지 않는다. 생성한 시작 클래스를 다음 내용으로 맞춘다.

### 6.1 PagingStudyApplication.java

```java
package com.example.pagingstudy; // 모든 실습 타입의 기준 패키지다.

import org.springframework.boot.SpringApplication; // Boot 실행 도구다.
import org.springframework.boot.autoconfigure.SpringBootApplication; // 자동 설정과 하위 패키지 스캔을 활성화한다.

@SpringBootApplication // Controller·Service·Entity·Repository 탐색의 기준이다.
public class PagingStudyApplication { // 파일명과 일치하는 시작 클래스다.
    public static void main(String[] args) { // 직접 실행할 때의 진입점이다.
        SpringApplication.run(PagingStudyApplication.class, args); // 웹 서버와 애플리케이션 구성을 시작한다.
    }
}
```

### 6.2 application.yaml

```yaml
spring: # Spring Boot의 외부 설정이다.
  datasource: # 이 실습에서만 사용하는 임시 DB다.
    url: jdbc:h2:mem:paging-study # 디스크나 운영 DB가 아닌 메모리 DB에 연결한다.
    username: sa # H2 로컬 학습 계정이다.
    password: "" # 외부 DB의 자격 증명을 이 예제에 넣지 않는다.
  jpa: # JPA와 Hibernate 설정을 묶는다.
    open-in-view: false # 웹 응답 직렬화까지 영속성 컨텍스트에 의존하지 않는다.
    hibernate: # 로컬 스키마 생성 정책이다.
      ddl-auto: create-drop # 시작·종료 시 스키마를 만들고 지운다. 운영 DB에는 사용하지 않는다.
    show-sql: true # 학습 중 실제 조회와 count SQL을 관찰한다.
```

처음 실행한 DB는 비어 있다. 등록 API나 초기 데이터 스크립트가 없으므로 직접 `/books`를 조회하면 빈 목록을 예상한다. 테스트의 데이터는 테스트 트랜잭션 안에서만 만들며 서버에 영구 저장되지 않는다.

## 7. Entity와 Repository: DB가 범위를 제한하게 한다

### 7.1 Book.java

```java
package com.example.pagingstudy; // JPA 스캔 범위 안의 패키지다.

import java.time.Instant; // 생성 시각을 시간대 독립적인 시점으로 표현한다.
import jakarta.persistence.Column; // 컬럼의 null 허용 여부를 지정한다.
import jakarta.persistence.Entity; // JPA가 관리할 타입임을 알린다.
import jakarta.persistence.GeneratedValue; // ID 생성 전략을 지정한다.
import jakarta.persistence.GenerationType; // IDENTITY 전략을 사용한다.
import jakarta.persistence.Id; // 식별자 필드를 표시한다.
import jakarta.persistence.Table; // 실습 테이블 이름을 지정한다.

@Entity // 이 객체는 DB의 책 한 행과 연결된다.
@Table(name = "study_books") // 일반적인 예약어와 구분되는 테이블 이름이다.
public class Book { // 연관관계 없는 단순 Entity로 페이징에 집중한다.
    @Id // ID는 각 책을 고유하게 식별한다.
    @GeneratedValue(strategy = GenerationType.IDENTITY) // DB가 식별자를 생성한다.
    private Long id; // 생성 전에는 null일 수 있다.

    @Column(nullable = false) // 제목이 없는 행을 허용하지 않는다.
    private String title; // title 정렬이 참조할 Java 속성이다.

    @Column(nullable = false) // null 시각의 정렬 문제를 이번 예제에서 제외한다.
    private Instant createdAt; // newest·oldest 정렬의 첫 기준이다.

    protected Book() { // JPA가 객체를 생성할 때 사용하는 기본 생성자다.
    }

    public Book(String title, Instant createdAt) { // 테스트가 고정된 제목·시각으로 책을 만든다.
        this.title = title; // 입력된 제목을 저장한다.
        this.createdAt = createdAt; // 입력된 시각을 저장한다.
    }

    public Long getId() { // DTO 변환과 테스트가 ID를 읽는다.
        return id; // 실제로 발급된 ID를 반환한다.
    }

    public String getTitle() { // 공개할 책 제목을 읽는다.
        return title; // Entity 자체 대신 DTO에 담을 값이다.
    }
}
```

JPA는 `@Id`가 필드에 있으므로 필드 접근을 사용한다. `createdAt` getter가 없어도 정렬 속성으로 접근할 수 있다. 생성자의 업무용 값 검증은 이번 목록 예제의 초점이 아니며, 등록 기능을 붙일 때 별도 입력 검증을 설계한다.

### 7.2 BookRepository.java

```java
package com.example.pagingstudy; // Entity와 같은 기준 패키지다.

import org.springframework.data.jpa.repository.JpaRepository; // 기본 CRUD와 페이지 조회 기능을 제공한다.

public interface BookRepository extends JpaRepository<Book, Long> { // Entity 타입과 ID 타입을 전달한다.
    // 상속한 findAll(Pageable)이 Page<Book>을 반환하므로 같은 메서드를 다시 선언하지 않는다.
}
```

`findAll(pageable)`과 인수 없는 `findAll()`은 다르다. 전자는 DB 조회에 페이지 정보를 전달한다. 응답 DTO를 만들 때 다시 전체 목록을 가져오거나 Java에서 페이지별 정렬을 하면 이 목적이 사라진다.

## 8. BookPageQuery: 유효한 요청 조건만 만든다

### 8.1 InvalidBookQueryException.java

```java
package com.example.pagingstudy; // 입력 계약과 오류 처리기가 공유한다.

public class InvalidBookQueryException extends RuntimeException { // 목록 입력 정책 위반만 표현한다.
    public InvalidBookQueryException(String message) { // 공개 가능한 고정 안내문을 받는다.
        super(message); // 오류 처리기가 detail로 사용할 설명이다.
    }
}
```

### 8.2 BookPageQuery.java

```java
package com.example.pagingstudy; // Controller와 Service가 공유하는 요청 조건이다.

import java.util.Set; // 허용한 정렬 이름을 보관한다.
import org.springframework.data.domain.PageRequest; // 검증한 페이지·크기로 Pageable을 만든다.
import org.springframework.data.domain.Pageable; // Repository에 전달할 조회 명세다.
import org.springframework.data.domain.Sort; // 실제 Entity 속성의 정렬 순서를 구성한다.

public record BookPageQuery(int page, int size, String sort) { // 생성이 끝나면 값이 바뀌지 않는 조건이다.
    private static final Set<String> ALLOWED_SORTS = Set.of("newest", "oldest", "title"); // 외부에 공개한 이름만 허용한다.

    public BookPageQuery { // record의 compact constructor로 필드 대입 전에 검증한다.
        if (page < 0 || page > 1000) { // 음수와 지나치게 깊은 페이지를 제한한다.
            throw new InvalidBookQueryException("page는 0 이상 1000 이하여야 합니다."); // 이 API의 정책을 안내한다.
        }
        if (size < 1 || size > 100) { // 한 번의 조회 크기를 제한한다.
            throw new InvalidBookQueryException("size는 1 이상 100 이하여야 합니다."); // 잘못된 값을 조용히 보정하지 않는다.
        }
        if (sort == null || !ALLOWED_SORTS.contains(sort)) { // null과 알 수 없는 정렬을 먼저 거부한다.
            throw new InvalidBookQueryException("sort는 newest, oldest, title 중 하나여야 합니다."); // 사용자 값을 그대로 반사하지 않는다.
        }
    }

    public Pageable toPageable() { // 공개 이름을 내부 정렬로 변환한다.
        Sort order = switch (sort) { // 이미 허용 목록 검증을 거친 값이다.
            case "newest" -> Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")); // 최신 시각부터, 동점이면 큰 ID부터다.
            case "oldest" -> Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id")); // 오래된 시각부터, 동점이면 작은 ID부터다.
            case "title" -> Sort.by(Sort.Order.asc("title"), Sort.Order.asc("id")); // 같은 제목도 ID로 순서를 완성한다.
            default -> throw new IllegalStateException("검증되지 않은 정렬입니다."); // 허용 목록과 매핑을 바꿀 때 누락을 드러낸다.
        };
        return PageRequest.of(page, size, order); // 0부터 시작하는 번호·크기·정렬을 함께 전달한다.
    }
}
```

compact constructor는 record의 필드에 값이 저장되기 전에 실행되는 생성자 형태다. 여기서 예외가 발생하면 유효하지 않은 `BookPageQuery` 객체가 만들어지지 않는다. 따라서 HTTP가 아닌 Java 코드에서 이 조건을 생성해도 같은 범위 검사를 거친다.

이 예제는 기본 Pageable 인수 해석기에 바로 맡기지 않고 직접 조건을 만든다. `@PageableDefault`는 기본값을 정하는 도구이지 우리 정렬 허용 목록 전체를 검증하는 장치는 아니다. 또한 기본 인수 해석기의 크기 상한·잘못된 값 보정 정책은 이번의 명시적인 400 정책과 같다고 가정하지 않는다. 두 방식을 같은 엔드포인트에 섞지 않는다. [Spring Data 웹 지원](https://docs.spring.io/spring-data/commons/reference/repositories/core-extensions.html)을 참고한다.

## 9. Service와 DTO: 내부 Page를 공개 JSON과 분리한다

### 9.1 BookSummary.java

```java
package com.example.pagingstudy; // 목록 응답에서 사용할 타입이다.

public record BookSummary(Long id, String title) { // 목록에 필요한 두 값만 공개한다.
}
```

### 9.2 BookPageResponse.java

```java
package com.example.pagingstudy; // Controller의 응답 계약이다.

import java.util.List; // 현재 구간의 책 목록을 담는다.

public record BookPageResponse( // 프레임워크 내부 Page 구조를 그대로 노출하지 않는다.
        List<BookSummary> items, // 현재 페이지의 항목이며 비어 있을 수 있다.
        int page, // 응답한 0 기반 페이지 번호다.
        int size, // 요청한 페이지 크기이며 실제 항목 수와 다를 수 있다.
        long totalElements, // 전체 결과 수는 int보다 넓은 long으로 둔다.
        int totalPages, // 전체 결과 수와 페이지 크기에 따른 페이지 수다.
        boolean hasNext // 다음 페이지로 이동할 수 있는지 나타낸다.
) { // record가 접근자와 값 비교를 제공한다.
}
```

Spring Data 문서는 `PageImpl`의 직접 JSON 직렬화를 안정적인 공개 계약으로 삼는 것을 권장하지 않는다. 라이브러리 내부 변경이 JSON 형태를 바꿀 수 있기 때문이다. 공식 `PagedModel` 같은 선택지도 있지만, 이번에는 직접 DTO를 정의해 프론트엔드가 받는 필드 이름을 명확히 한다. [페이지 응답 표현 문서](https://docs.spring.io/spring-data/commons/reference/repositories/core-extensions.html)를 참고한다.

### 9.3 BookQueryService.java

```java
package com.example.pagingstudy; // Repository·DTO와 같은 실습 패키지다.

import org.springframework.data.domain.Page; // 조회 결과와 전체 개수 정보를 받는다.
import org.springframework.stereotype.Service; // 업무 조회 객체를 Bean으로 등록한다.
import org.springframework.transaction.annotation.Transactional; // 조회와 DTO 변환의 트랜잭션 범위를 정한다.

@Service // Controller가 생성자로 주입받는 대상이다.
public class BookQueryService { // 웹 입력 방식과 DB 접근 방식을 분리한다.
    private final BookRepository repository; // 실제 JPA 조회를 위임할 대상이다.

    public BookQueryService(BookRepository repository) { // 생성자 주입을 사용한다.
        this.repository = repository; // 여러 요청에서 주입된 Repository를 재사용한다.
    }

    @Transactional(readOnly = true) // 조회용 트랜잭션 힌트다. 모든 DB에서 동일한 스냅샷을 보장한다는 뜻은 아니다.
    public BookPageResponse list(BookPageQuery query) { // 생성 시 검증된 조회 조건을 받는다.
        Page<BookSummary> page = repository.findAll(query.toPageable()) // 전체가 아니라 정렬한 해당 범위를 조회한다.
                .map(book -> new BookSummary(book.getId(), book.getTitle())); // 페이지 메타데이터를 유지하며 항목을 DTO로 변환한다.
        return new BookPageResponse(page.getContent(), page.getNumber(), page.getSize(), // 현재 항목·번호·요청 크기를 담는다.
                page.getTotalElements(), page.getTotalPages(), page.hasNext()); // 전체 개수·페이지 수·다음 여부를 담는다.
    }
}
```

`Page.map(...)`은 조회한 페이지의 항목을 바꾸는 연산이지 새로운 전체 조회가 아니다. 이 예제에서는 Entity를 읽은 뒤 DTO로 변환한다. SQL에서 처음부터 필요한 컬럼만 조회하는 DTO projection과는 다른 방식이다.

또한 `readOnly=true`는 읽기 의도를 전달하는 설정이다. 동시 변경이 있을 때 목록 쿼리와 count 쿼리가 같은 시점의 상태를 보는지는 DB와 트랜잭션 격리 수준에 따라 달라진다. 전체 개수가 항상 고정된 스냅샷이라고 사용자에게 약속하지 않는다.

## 10. Controller와 오류 처리

### 10.1 BookController.java

```java
package com.example.pagingstudy; // 웹 요청을 받는 타입이다.

import org.springframework.web.bind.annotation.GetMapping; // GET 경로를 등록한다.
import org.springframework.web.bind.annotation.RequestParam; // 쿼리 문자열을 매개변수로 받는다.
import org.springframework.web.bind.annotation.RestController; // 반환 DTO를 응답 본문으로 직렬화한다.

@RestController // View 템플릿이 아닌 JSON API를 만든다.
public class BookController { // HTTP 입력을 검증된 조건으로 변환한다.
    private final BookQueryService service; // DB 조회와 응답 조립을 위임한다.

    public BookController(BookQueryService service) { // 생성자 주입으로 연결한다.
        this.service = service; // 주입받은 Service를 보관한다.
    }

    @GetMapping("/books") // 도서 목록을 조회하는 엔드포인트다.
    public BookPageResponse list( // 반환 타입은 공개 API용 DTO다.
            @RequestParam(name = "page", defaultValue = "0") int page, // 첫 페이지의 기본 번호는 0이다.
            @RequestParam(name = "size", defaultValue = "20") int size, // 기본 요청 크기는 20이다.
            @RequestParam(name = "sort", defaultValue = "newest") String sort // 공개 정렬 이름을 받는다.
    ) { // 타입 변환에 성공해야 메서드 본문으로 들어온다.
        return service.list(new BookPageQuery(page, size, sort)); // 조건 검증에 실패하면 Service를 호출하지 않는다.
    }
}
```

### 10.2 BookQueryErrorHandler.java

```java
package com.example.pagingstudy; // Controller와 같은 스캔 범위다.

import org.springframework.http.HttpStatus; // 입력 오류의 상태를 지정한다.
import org.springframework.http.ProblemDetail; // 표준 형태의 문제 설명을 만든다.
import org.springframework.web.bind.annotation.ExceptionHandler; // 지정한 예외를 처리한다.
import org.springframework.web.bind.annotation.RestControllerAdvice; // Controller 공통 오류 응답을 제공한다.

@RestControllerAdvice // 이번 프로젝트의 MVC 예외 처리에 참여한다.
public class BookQueryErrorHandler { // 목록 정책 위반만 명시적으로 처리한다.
    @ExceptionHandler(InvalidBookQueryException.class) // 다른 종류의 장애를 무조건 400으로 숨기지 않는다.
    public ProblemDetail invalidQuery(InvalidBookQueryException error) { // 공개 가능한 고정 안내문이 들어온다.
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, error.getMessage()); // 400 상태와 상세 이유다.
        problem.setTitle("잘못된 목록 조회 조건"); // 오류 종류를 나타내는 제목이다.
        return problem; // MVC가 상태와 문제 응답 본문으로 처리한다.
    }
}
```

`ProblemDetail`을 반환하면 그 안의 status가 HTTP 응답 상태로 사용된다. [Spring MVC 오류 응답 문서](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)를 참고한다.

숫자 형식 오류는 이 사용자 정의 예외가 아니라 MVC가 처리한다. 따라서 이번 예제는 **두 경로 모두 400이지만 오류 JSON 전체 모양까지 같다는 계약은 없다**. 이를 통일하려면 [Validation·예외 처리 노트](../05_09_01_Validation_and_Exception_Handling/09_01_Validation_and_Exception_Handling.md)를 바탕으로 MVC 기본 예외도 함께 처리한다.

## 11. 테스트를 HTTP 계약과 DB 결과로 나눈다

### 11.1 BookControllerTest.java: 입력·상태·JSON 검증

Service는 대역으로 바꾸지만 Controller와 요청 조건 검증은 실제로 실행한다. 잘못된 요청에서 Service가 호출되지 않았는지도 확인한다.

```java
package com.example.pagingstudy; // 시작 클래스와 같은 패키지로 구성 탐색을 돕는다.

import java.util.List; // 준비할 응답 항목을 만든다.
import org.junit.jupiter.api.Test; // 일반 테스트를 선언한다.
import org.junit.jupiter.params.ParameterizedTest; // 여러 잘못된 입력을 반복 검증한다.
import org.junit.jupiter.params.provider.CsvSource; // 쿼리 이름과 값을 한 쌍으로 전달한다.
import org.springframework.beans.factory.annotation.Autowired; // MockMvc를 주입받는다.
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest; // Boot 4의 MVC 슬라이스다.
import org.springframework.context.annotation.Import; // 실제 오류 처리기를 포함한다.
import org.springframework.test.context.bean.override.mockito.MockitoBean; // Service 대역 Bean을 등록한다.
import org.springframework.test.web.servlet.MockMvc; // 실제 포트 없이 MVC 요청을 실행한다.
import static org.mockito.Mockito.*; // 응답 준비와 호출 검증을 사용한다.
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get; // GET 요청을 만든다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*; // 상태와 JSON 필드를 검사한다.

@WebMvcTest(BookController.class) // 이 테스트에서는 DB 조회를 실행하지 않는다.
@Import(BookQueryErrorHandler.class) // 정책 위반의 400 응답을 실제로 만든다.
class BookControllerTest { // HTTP 경계 테스트 클래스다.
    @Autowired // MVC 테스트 도구를 받는다.
    private MockMvc mvc; // 준비한 요청을 Controller로 전달한다.

    @MockitoBean // 실제 Service 대신 메서드 응답을 지정할 대역을 둔다.
    private BookQueryService service; // 검증된 조건이 전달되는지도 검사한다.

    @Test // 매개변수를 생략했을 때의 계약이다.
    void defaultsAndResponseShape() throws Exception { // MockMvc의 검사 예외를 테스트 실행기에 전달한다.
        BookPageQuery query = new BookPageQuery(0, 20, "newest"); // Controller가 만들 것으로 기대하는 값이다.
        when(service.list(query)).thenReturn(new BookPageResponse( // record의 값 비교로 조건을 맞춘다.
                List.of(new BookSummary(7L, "Spring")), 0, 20, 1L, 1, false)); // 상태 확인용 응답을 준비한다.
        mvc.perform(get("/books")) // 기본값을 사용하도록 쿼리를 생략한다.
                .andExpect(status().isOk()) // 목록 성공은 200이다.
                .andExpect(jsonPath("$.items[0].id").value(7)) // Entity가 아닌 공개 DTO의 필드다.
                .andExpect(jsonPath("$.items[0].title").value("Spring")) // 목록 제목을 확인한다.
                .andExpect(jsonPath("$.page").value(0)) // 0 기반 번호를 유지한다.
                .andExpect(jsonPath("$.size").value(20)) // 실제 항목 한 개여도 요청 크기는 20이다.
                .andExpect(jsonPath("$.totalElements").value(1)) // 전체 항목 수를 전달한다.
                .andExpect(jsonPath("$.totalPages").value(1)) // 전체 페이지 수를 전달한다.
                .andExpect(jsonPath("$.hasNext").value(false)); // 마지막 페이지임을 전달한다.
        verify(service).list(query); // 기본값으로 구성된 조건을 한 번 전달했는지 확인한다.
    }

    @Test // 명시적으로 전달한 조건이 유지되는지 확인한다.
    void forwardsExplicitQuery() throws Exception { // 기본값으로 덮어쓰지 않아야 한다.
        BookPageQuery query = new BookPageQuery(2, 5, "oldest"); // 세 번째 페이지를 의미한다.
        when(service.list(query)).thenReturn(new BookPageResponse(List.of(), 2, 5, 0L, 0, false)); // 빈 결과를 준비한다.
        mvc.perform(get("/books").param("page", "2").param("size", "5").param("sort", "oldest")) // 문자열 쿼리가 Java 값으로 변환된다.
                .andExpect(status().isOk()) // 허용 범위의 빈 페이지도 성공이다.
                .andExpect(jsonPath("$.items").isEmpty()) // 빈 배열을 반환한다.
                .andExpect(jsonPath("$.page").value(2)); // 요청 번호를 유지한다.
        verify(service).list(query); // 올바른 값으로 Service를 호출해야 한다.
    }

    @ParameterizedTest // 정책 위반과 숫자 변환 실패를 함께 확인한다.
    @CsvSource({"page,-1", "page,1001", "size,0", "size,101", "sort,price", "page,abc", "size,1.5"}) // 독립된 7회 실행이다.
    void rejectsInvalidInputBeforeService(String name, String value) throws Exception { // 쿼리 하나만 바꾸고 나머지는 기본값을 쓴다.
        mvc.perform(get("/books").param(name, value)) // 잘못된 입력을 MVC에 전달한다.
                .andExpect(status().isBadRequest()); // 본문 형태가 아닌 공통 400 계약을 확인한다.
        verifyNoInteractions(service); // 조회 비용이 발생하기 전에 거부해야 한다.
    }
}
```

MVC 테스트의 JSON이 올바르다고 실제 DB 정렬까지 검증된 것은 아니다. 대역으로 지정한 응답만 확인한 범위를 구분한다. [WebMvcTest API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTest.html)를 참고한다.

### 11.2 BookPagingJpaTest.java: 실제 조회·동점·빈 페이지 검증

JPA 슬라이스에 실제 Service를 추가해 DB에서 DTO까지 확인한다. 별도 학습 프로젝트에 초기 데이터·`data.sql`이 없다는 전제이며, 기본 테스트 트랜잭션의 rollback으로 테스트끼리 데이터를 분리한다.

```java
package com.example.pagingstudy; // Entity·Repository·Service를 탐색할 기준 패키지다.

import java.time.Instant; // 정렬 테스트에 고정 시각을 사용한다.
import jakarta.persistence.EntityManager; // flush와 영속성 컨텍스트 초기화를 수행한다.
import org.junit.jupiter.api.Test; // 네 가지 DB 시나리오를 정의한다.
import org.springframework.beans.factory.annotation.Autowired; // 실제 Bean을 주입받는다.
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest; // Boot 4의 JPA 슬라이스다.
import org.springframework.context.annotation.Import; // 일반 Service를 테스트 범위에 명시적으로 넣는다.
import static org.assertj.core.api.Assertions.assertThat; // 항목 순서와 메타데이터를 검증한다.

@DataJpaTest // H2와 JPA를 사용하며 테스트 종료 시 기본적으로 rollback한다.
@Import(BookQueryService.class) // Repository뿐 아니라 실제 DTO 변환도 실행한다.
class BookPagingJpaTest { // HTTP 요청은 이 테스트 범위에 없다.
    @Autowired // 실제 JPA Repository를 받는다.
    private BookRepository repository; // 테스트 데이터를 저장한다.
    @Autowired // 실제 조회 Service를 받는다.
    private BookQueryService service; // PageRequest·DTO 변환을 함께 실행한다.
    @Autowired // 테스트 트랜잭션의 EntityManager를 받는다.
    private EntityManager em; // 저장된 행을 다시 조회하도록 준비한다.

    private Book save(String title, String instant) { // 읽기 쉬운 테스트 데이터 생성 도우미다.
        return repository.saveAndFlush(new Book(title, Instant.parse(instant))); // 실제 INSERT 후 발급된 ID를 받는다.
    }

    @Test // 시각이 같은 책과 다른 책을 두 페이지로 나눈다.
    void newestUsesIdTieBreakerAndOldestReversesOrder() { // 데이터가 변하지 않는 동안의 결정적 순서를 확인한다.
        Book first = save("First", "2026-09-10T00:00:00Z"); // 이전 시각의 책이다.
        Book second = save("Second", "2026-09-11T00:00:00Z"); // 아래 책과 시각이 같다.
        Book third = save("Third", "2026-09-11T00:00:00Z"); // H2 IDENTITY에서 두 번째 책 다음 ID를 받는다.
        em.clear(); // 저장한 영속 객체의 재사용에 기대지 않도록 분리한다.
        BookPageResponse page0 = service.list(new BookPageQuery(0, 2, "newest")); // 최신 두 권을 요청한다.
        BookPageResponse page1 = service.list(new BookPageQuery(1, 2, "newest")); // 남은 구간을 요청한다.
        assertThat(page0.items()).extracting(BookSummary::id).containsExactly(third.getId(), second.getId()); // 동점에서는 ID 내림차순이다.
        assertThat(page1.items()).extracting(BookSummary::id).containsExactly(first.getId()); // 앞의 두 항목이 반복되지 않는다.
        assertThat(page0.totalElements()).isEqualTo(3L); // 페이지의 두 항목과 전체 세 항목을 구분한다.
        assertThat(page0.totalPages()).isEqualTo(2); // 세 항목을 두 개씩 나누면 두 페이지다.
        assertThat(page0.hasNext()).isTrue(); // 첫 페이지에는 다음이 있다.
        assertThat(page1.hasNext()).isFalse(); // 마지막 페이지에는 다음이 없다.
        assertThat(page1.size()).isEqualTo(2); // 마지막 페이지의 요청 크기는 여전히 2다.
        BookPageResponse oldest = service.list(new BookPageQuery(0, 3, "oldest")); // 반대 방향 정렬도 확인한다.
        assertThat(oldest.items()).extracting(BookSummary::id).containsExactly(first.getId(), second.getId(), third.getId()); // 오래된 시각·작은 ID 순서다.
    }

    @Test // 같은 제목이 여러 개여도 순서를 완성한다.
    void titleUsesIdTieBreaker() { // 제목 오름차순과 ID 오름차순을 함께 확인한다.
        Book beta = save("Beta", "2026-09-11T00:00:00Z"); // 먼저 저장했어도 제목 때문에 뒤로 간다.
        Book alpha1 = save("Alpha", "2026-09-11T00:00:00Z"); // 같은 제목 중 작은 ID다.
        Book alpha2 = save("Alpha", "2026-09-11T00:00:00Z"); // 같은 제목 중 큰 ID다.
        em.clear(); // DB에서 정렬된 결과를 다시 읽는다.
        BookPageResponse result = service.list(new BookPageQuery(0, 10, "title")); // 세 권을 모두 포함하는 구간이다.
        assertThat(result.items()).extracting(BookSummary::id).containsExactly(alpha1.getId(), alpha2.getId(), beta.getId()); // 삽입 순서와 정렬 순서는 다르다.
    }

    @Test // DB 자체가 비어 있는 경우다.
    void emptyDatabaseReturnsZeroTotals() { // 다른 테스트 데이터는 rollback되어 남지 않아야 한다.
        BookPageResponse result = service.list(new BookPageQuery(0, 2, "newest")); // 빈 DB의 첫 구간을 조회한다.
        assertThat(result.items()).isEmpty(); // 본문 목록은 빈 배열이 된다.
        assertThat(result.totalElements()).isZero(); // 전체 항목도 없다.
        assertThat(result.totalPages()).isZero(); // 이번 Page 메타데이터의 전체 페이지 수는 0이다.
        assertThat(result.hasNext()).isFalse(); // 다음 페이지도 없다.
    }

    @Test // 책은 있지만 요청 구간에 항목이 없는 경우다.
    void pageBeyondLastKeepsTotalCount() { // 입력 상한을 넘지 않은 초과 페이지다.
        save("Only", "2026-09-11T00:00:00Z"); // 전체 항목은 한 개다.
        em.clear(); // DB에서 새로 읽도록 준비한다.
        BookPageResponse result = service.list(new BookPageQuery(5, 2, "newest")); // 존재하는 결과 범위를 지난 구간이다.
        assertThat(result.items()).isEmpty(); // 현재 구간에만 항목이 없다.
        assertThat(result.page()).isEqualTo(5); // 마지막 페이지로 몰래 보정하지 않는다.
        assertThat(result.totalElements()).isEqualTo(1L); // 빈 목록이라고 전체 개수를 0으로 바꾸지 않는다.
        assertThat(result.totalPages()).isEqualTo(1); // 전체 결과의 페이지 수는 유지한다.
        assertThat(result.hasNext()).isFalse(); // 이후 구간도 없다.
    }
}
```

ID가 항상 1부터 시작한다고 가정하지 않고 실제 저장 결과의 ID를 사용했다. 동점 정렬 검증의 IDENTITY 증가 순서는 이 H2 실습 조건이다. 제목 정렬의 대소문자·한글·악센트 순서는 DB의 문자 비교 규칙(collation)에 따라 달라질 수 있으므로 운영 DB로 따로 확인한다.

이 테스트는 H2의 실제 조회를 실행하는 예제지만, 운영 DB의 성능·실행 계획·동시 수정 상황이나 여러 요청 사이의 스냅샷은 검증하지 않는다. Service는 JPA 테스트의 기존 트랜잭션에 참여하므로 Service 단독 호출의 트랜잭션 설정을 증명하는 테스트도 아니다. [DataJpaTest API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html)를 참고한다.

### 11.3 실행 위치와 예상 결과

아래 명령은 TIL 루트가 아닌 **별도 실습 프로젝트의 `pom.xml`·Maven Wrapper가 있는 폴더**에서 실행한다.

```powershell
.\mvnw.cmd "-Dtest=BookControllerTest,BookPagingJpaTest" test # 이 노트의 MVC·JPA 테스트만 실행한다.
.\mvnw.cmd spring-boot:run # 비어 있는 메모리 DB와 로컬 웹 서버를 실행한다.
```

첫 명령은 MVC 일반 2개·잘못된 입력 7회·JPA 4개를 합쳐 **13회 실행을 예상**한다. 테스트 통과 여부는 직접 실행해서 확인해야 한다. 두 번째 명령으로 서버가 시작되면 별도 터미널에서 요청한다.

```powershell
curl.exe "http://localhost:8080/books?page=0&size=2&sort=newest" # URL의 &가 셸에 해석되지 않도록 따옴표로 감싼다.
```

초기 데이터 없는 실행에서 예상하는 응답은 다음과 같다. JSON 필드 순서는 계약으로 가정하지 않는다.

```json
{
  "items": [],
  "page": 0,
  "size": 2,
  "totalElements": 0,
  "totalPages": 0,
  "hasNext": false
}
```

## 12. 성능과 일관성에서 놓치지 말아야 할 것

### 12.1 size 제한만으로 모든 느린 조회가 해결되지는 않는다

offset이 커지면 최종적으로 반환할 항목이 적어도 DB가 건너뛸 많은 결과를 처리해야 할 수 있다. 정렬·필터에 맞는 인덱스, 실제 실행 계획, count 비용을 함께 관찰한다. page 상한 1000도 보편적으로 안전한 숫자가 아니라 이번 학습 정책이다.

`Slice`로 바꾸면 전체 개수 조회를 줄일 수 있지만 offset 기반이라는 성질까지 사라지는 것은 아니다. 깊은 목록 탐색에는 마지막으로 본 정렬 키 이후를 조회하는 **커서·keyset 기반 방식**을 검토할 수 있다. 이는 다음 노트에서 구현하며, 이번 API에 두 방식을 섞지 않는다. [Spring Data JPA의 대량 결과 탐색](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)을 참고한다.

### 12.2 페이지를 조회한 뒤 필터링하면 무엇이 틀어질까?

DB에서 먼저 20개를 읽은 뒤 Java에서 권한 없는 항목을 빼면 3개만 남을 수 있다. 더구나 전체 개수는 권한 없는 항목까지 포함했을 수 있다. 실제 서비스에서는 사용자 권한·테넌트·검색 조건을 **목록 쿼리와 count의 대상에 일관되게 적용**해야 한다. 이번 `findAll`은 모든 책을 공개하는 학습용 계약이지 권한 필터가 필요한 서비스의 완성본이 아니다.

### 12.3 현재 페이지 안에서 다시 정렬하면 안 되는 이유

DB가 ID 순서로 20개를 고른 뒤 Java에서 제목순으로 정렬하면 “전체 목록의 제목순 첫 20개”가 되지 않는다. 전체 결과에 대한 정렬 기준을 먼저 DB에 전달한 뒤 구간을 나눠야 한다.

목록에 연관관계를 추가할 때에는 이전 [Entity·연관관계 노트](../08_09_05_Entity_Lifecycle_and_Relationships/09_05_Entity_Lifecycle_and_Relationships.md)의 지연 로딩·N+1 문제도 다시 확인한다. 지금은 연관관계 없는 Book만 사용했으므로 복잡한 조인 페이징까지 검증된 것으로 확대해석하지 않는다.

## 13. 자주 하는 실수와 확인 순서

| 증상 | 원인 후보 | 먼저 확인할 것 |
| --- | --- | --- |
| 첫 페이지가 비거나 일부 책을 건너뜀 | UI 1 기반 번호를 API에 그대로 전달 | page 시작점과 offset 계산 |
| size가 작아도 메모리를 많이 사용 | 전체 조회 후 Java에서 잘라냄 | 인수 없는 findAll 호출 여부 |
| 같은 시각의 책이 페이지 사이에서 섞임 | 정렬이 동점을 해결하지 못함 | 고유 ID를 마지막 정렬 기준에 추가 |
| 정렬 필드 오류로 서버 예외 | 임의 속성을 허용 | 공개 정렬 이름과 내부 속성 매핑 |
| 전체 개수와 빈 목록을 혼동 | 현재 구간과 전체 결과를 같은 것으로 처리 | items와 totalElements 분리 |
| 같은 페이지를 다시 읽으면 내용이 달라짐 | 요청 사이에 데이터가 변경됨 | 정렬 문제와 동시 변경 문제 구분 |
| 테스트 통과 후 운영에서 느림 | H2·작은 데이터만 검사 | 운영 엔진·인덱스·실행 계획·count 비용 |

## 14. 핵심 정리와 다음 학습

1. 페이지네이션은 응답 크기뿐 아니라 DB가 읽을 범위를 제한하는 설계다.
2. 0 기반 페이지에서 offset은 `page × size`이고 실제 항목 수는 size보다 작을 수 있다.
3. PageRequest의 기본 유효성 검사와 업무별 크기·깊이 제한은 다른 책임이다.
4. Page는 전체 개수, Slice는 다음 구간 여부 중심으로 선택한다.
5. 허용한 정렬 이름을 Entity 속성으로 변환하고 고유 키로 동점을 해소한다.
6. 완전한 정렬은 여러 HTTP 요청 사이의 데이터 스냅샷을 보장하지 않는다.
7. Entity·PageImpl 대신 명시적인 응답 DTO로 공개 JSON 계약을 관리한다.
8. HTTP 입력 검증과 실제 DB 정렬·빈 페이지 검증을 서로 다른 테스트로 확인한다.

다음 확장 주제는 **커서 기반 페이지네이션**이다. offset의 한계를 바탕으로 마지막 정렬 키, 다음 커서, 동시 삽입·삭제 시 동작을 구체적인 조회와 테스트로 연결한다.

## 15. 복습 퀴즈

1. `page=2&size=10`이면 몇 개를 건너뛰고 최대 몇 개를 조회하는가?
2. 전체 개수는 필요 없고 “더 보기” 버튼만 필요하다면 어떤 반환 타입을 먼저 검토할까?
3. `createdAt DESC`만 사용했을 때 동점 항목은 어떤 문제를 만들 수 있는가?
4. `size=20`인데 현재 항목이 3개라면 반드시 오류인가?
5. MVC 테스트에서 Service를 대역으로 바꾸었다면 DB 정렬도 검증한 것인가?
6. 고유 ID 정렬을 추가하면 페이지 요청 사이의 신규 삽입에 따른 중복도 없어지는가?

<details>
<summary>정답과 해설</summary>

1. 20개를 건너뛰고 최대 10개를 조회한다. API의 첫 페이지 번호는 0이다.
2. Slice를 검토한다. Page 조회 후 타입만 바꾸는 것이 아니라 Repository 조회 계약부터 정해야 한다.
3. 동점 사이의 순서가 완성되지 않아 페이지 경계의 항목이 불안정할 수 있다. 고유 키를 추가한다.
4. 아니다. 마지막 구간에는 size보다 적은 항목이 있을 수 있다. 요청 크기와 실제 결과 수를 구분한다.
5. 아니다. HTTP 계약과 조건 전달을 확인했다. 실제 Repository·DB 테스트가 별도로 필요하다.
6. 아니다. 전체 순서의 동점은 해결하지만 요청 사이의 결과 집합 변경은 고정하지 않는다.

</details>

## 16. 공식 문서로 복습하기

- [Spring Data 페이징·정렬·반환 타입](https://docs.spring.io/spring-data/commons/reference/repositories/query-methods-details.html): Pageable·Page·Slice와 조회 비용
- [PageRequest API](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/domain/PageRequest.html): 페이지 번호·크기의 전제
- [Page API](https://docs.spring.io/spring-data/commons/docs/current/api/org/springframework/data/domain/Page.html): 전체 개수·전체 페이지·항목 변환
- [Spring Data 웹 지원](https://docs.spring.io/spring-data/commons/reference/repositories/core-extensions.html): 기본 인수 해석과 안정적인 페이지 응답 표현
- [Spring Data JPA 쿼리 문서](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html): 정렬 속성과 대량 결과 탐색
- [Boot MVC 테스트 API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTest.html): 웹 테스트 범위
- [Boot JPA 테스트 API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html): DB 테스트와 트랜잭션 범위
