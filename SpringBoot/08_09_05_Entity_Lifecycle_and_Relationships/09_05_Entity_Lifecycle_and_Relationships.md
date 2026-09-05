# JPA Entity 생명주기와 연관관계: 객체의 변경이 SQL이 되기까지

- 🎯 학습 목표: 관리 상태·변경 감지·flush의 흐름을 설명하고, 책과 저자의 관계에서 외래키를 갱신하는 쪽을 구분한다.
- 🧩 핵심 키워드: Entity, EntityManager, 영속성 컨텍스트, persist, merge, dirty checking, flush, mappedBy, LAZY, N+1
- ⭐ 중요도: ★★★★★ — Repository 메서드 이름을 알아도 객체 상태와 관계의 저장 규칙을 모르면 수정 누락·의도하지 않은 삭제·추가 쿼리가 발생한다.
- 📝 핵심 요약: JPA는 모든 Java 객체를 감시하지 않는다. 영속성 컨텍스트가 관리하는 Entity의 변경을 DB와 동기화하며, 양방향 관계에서는 외래키 매핑을 가진 주인 쪽의 값을 기준으로 관계를 저장한다.
- 🧱 선수 지식: Java 클래스·생성자·참조·List, SQL 기본키·외래키·JOIN, Spring Bean·Repository
- 🔗 이전 노트: [JDBC·JPA·Spring Data JPA의 역할](../07_09_03_Data_Access_Fundamentals/09_03_Data_Access_Fundamentals.md)

> 정리 기준일: 2026-09-05. Jakarta Persistence 3.2의 계약과 Hibernate ORM 7.1 공식 가이드를 기준으로 설명한다. 특정 Spring Boot 버전이 반드시 Hibernate 7.1을 사용한다는 뜻은 아니다. 실제 의존성 버전은 프로젝트의 dependency report로 확인한다. Entity·Repository·Service 예제는 같은 패키지에 배치할 수 있는 학습용 구성 요소이며, 이 저장소에 실행용 Spring 프로젝트나 DB가 포함된 것은 아니다. 실행 관찰 항목은 예상 동작과 직접 확인할 절차를 구분했다.

## 1. 왜 `save()` 다음을 알아야 할까?

책 제목을 바꾸는 기능을 상상해 보자. SQL에서는 다음 의도가 분명하다.

```sql
UPDATE books SET title = '수정된 제목' WHERE id = 1;
```

그런데 JPA 예제에는 UPDATE도, `save()`도 없이 다음과 같은 Java 코드가 등장한다.

```java
// 활성 쓰기 트랜잭션 안에서 실행되는 메서드의 일부
Book book = entityManager.find(Book.class, bookId);
if (book == null) {
    throw new IllegalArgumentException("책을 찾을 수 없습니다.");
}
book.rename("수정된 제목");
```

이 코드를 이해하려면 “setter를 호출하면 DB가 바뀐다”가 아니라 다음 순서로 물어야 한다.

1. 이 `book`은 누가 조회했고 지금도 관리하고 있는가?
2. 변경 사항을 DB에 보내는 시점은 언제인가?
3. SQL을 보냈다는 사실과 트랜잭션 성공이 같은가?

같은 `rename()`이라도 `new Book(...)`으로 만든 객체나 관리 범위를 벗어난 객체에 호출하면 결과가 다르다. 이 차이가 이번 노트의 출발점이다.

## 2. 먼저 객체와 테이블의 모양을 맞춘다

이번 예제에서는 **책 한 권은 저자 한 명에 속하고, 저자 한 명은 여러 책을 쓸 수 있다**고 단순화한다. 공저·도서 판본·ISBN은 생명주기 학습 범위에서 제외한다. 실제 도서 서비스에 그대로 적용할 도메인 모델은 아니다.

```text
테이블                         Java 객체
authors                        Author
  id (PK)                        id
  name                           name
                                 books: List<Book>
books                          Book
  id (PK)                        id
  title                          title
  author_id (FK → authors.id)     author: Author
```

DB에서는 `books.author_id`에 숫자를 저장한다. Java에서는 `book.getAuthor()`로 저자 객체를 참조한다. `@JoinColumn`은 이 객체 참조를 어느 외래키 열과 연결할지 알려 준다.

반대로 `Author.books`는 별도의 `book_ids` 열이 아니다. “이 저자를 참조하는 책들을 Java에서 반대 방향으로 탐색한다”는 의미다. DB 관계는 외래키 하나지만 Java 탐색 경로는 두 개가 될 수 있다.

## 3. Entity 두 개를 먼저 읽어 보기

아래 두 파일을 같은 패키지 `com.example.library`에 둔다. 첫 독해에서는 애너테이션을 모두 외우지 말고 `Book.author`와 `Author.books`가 같은 관계를 가리킨다는 것만 확인한다.

### 3.1 `Author.java`: 저자에서 책 목록으로 이동하기

```java
package com.example.library;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

@Entity
@Table(name = "authors")
public class Author {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @OneToMany(mappedBy = "author")
    private List<Book> books = new ArrayList<>();

    protected Author() {
        // JPA가 Entity를 만들 때 사용하는 기본 생성자
    }

    public Author(String name) {
        this.name = Objects.requireNonNull(name);
    }

    // 관계 갱신은 Book.changeAuthor를 통해서만 수행한다.
    void attach(Book book) {
        if (!books.contains(book)) {
            books.add(book);
        }
    }

    void detach(Book book) {
        books.remove(book);
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public List<Book> getBooks() {
        return Collections.unmodifiableList(books);
    }
}
```

`getBooks()`는 외부 코드가 목록에 마음대로 `add()`해서 객체의 한쪽만 바꾸는 것을 막는다. 이것은 DB 잠금이나 깊은 불변성을 제공하는 기능은 아니다. 목록 안의 Book은 여전히 변경 가능한 객체다.

### 3.2 `Book.java`: 외래키를 저장하는 쪽

```java
package com.example.library;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.Objects;

@Entity
@Table(name = "books")
public class Book {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private Author author;

    protected Book() {
    }

    public Book(String title, Author author) {
        rename(title);
        changeAuthor(author);
    }

    public void rename(String title) {
        if (title == null || title.isBlank() || title.length() > 100) {
            throw new IllegalArgumentException("제목은 1~100자여야 합니다.");
        }
        this.title = title;
    }

    public void changeAuthor(Author nextAuthor) {
        Objects.requireNonNull(nextAuthor, "저자는 필수입니다.");
        if (this.author == nextAuthor) {
            return;
        }
        if (this.author != null) {
            this.author.detach(this);
        }
        this.author = nextAuthor;   // 외래키를 결정하는 주인 쪽 변경
        nextAuthor.attach(this);   // 반대편 Java 목록도 일치시킨다.
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public Author getAuthor() { return author; }
}
```

두 클래스는 `@Id`를 필드에 붙였으므로 필드 접근 방식을 사용한다. JPA가 저장 필드를 읽고 쓰는 데 모든 public setter가 필요한 것은 아니다. public/protected 기본 생성자, 식별자, Entity 클래스 요건은 [Jakarta Persistence Entity 규칙](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html#entities)을 함께 확인한다.

`Long id`는 생성 전 `null`을 표현한다. `IDENTITY`는 DB identity/자동 증가 기능을 사용하는 전략이지 “모든 DB에 똑같은 CREATE TABLE 문법을 쓴다”는 뜻이 아니다. 운영 스키마는 선택한 DB의 migration으로 관리한다.

`nullable = false`는 DB 매핑 정보이며 HTTP 입력 검증을 대신하지 않는다. 이름·제목 등의 사용자 친화적인 오류는 DTO 검증에서, 도메인의 유효성은 생성자·메서드에서, 데이터 무결성은 실제 DB 제약에서 각각 다룬다.

## 4. 영속성 컨텍스트는 무엇을 관리할까?

영속성 컨텍스트(Persistence Context)는 Entity의 식별자와 관리 인스턴스를 연결해 놓은 관리 범위다. `EntityManager`는 이 범위를 통해 조회·저장·삭제 등을 요청하는 API다.

```text
EntityManager
  → 영속성 컨텍스트
      (Book, id=1) → 관리 중인 Book 객체
      (Author, id=7) → 관리 중인 Author 객체
  → 필요할 때 SQL로 DB와 동기화
```

여기서 “관리”는 객체가 살아 있는 동안 서버 전체에서 영원히 감시한다는 뜻이 아니다. 일반적인 Spring의 트랜잭션 범위 JPA 사용에서는 현재 트랜잭션과 연결된 컨텍스트를 이용한다. 웹 설정인 OSIV로 EntityManager의 사용 범위가 더 길어질 수도 있으므로 객체의 실제 관리 범위를 확인해야 한다.

같은 컨텍스트에서 같은 Entity 타입과 ID를 `find()`하면 동일한 관리 객체를 얻는다.

```java
// 같은 영속성 컨텍스트 안, 중간 clear/detach 없이 실행하는 조각
Book first = entityManager.find(Book.class, bookId);
Book second = entityManager.find(Book.class, bookId);
System.out.println(first == second); // 해당 책이 존재한다면 true
```

흔히 이를 1차 캐시와 동일성 보장으로 설명한다. 그러나 임의의 JPQL 검색 결과를 전부 기억해 SQL을 생략하는 범용 쿼리 캐시는 아니다. 다른 트랜잭션·다른 컨텍스트에서 조회한 객체까지 `==`가 같다고 기대하지 않는다. [EntityManager 공식 API](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/entitymanager)를 참고한다.

## 5. 네 가지 상태로 코드 읽기

| 상태 | 뜻 | 대표 진입 상황 | 필드만 바꾸면 자동 반영되는가? |
| --- | --- | --- | --- |
| 비영속(new) | 아직 관리되지 않는 새 객체 | `new Book(...)` | 아니오 |
| 관리(managed) | 현재 컨텍스트가 관리하는 객체 | `persist`, `find`, `merge`의 반환값 | 쓰기 트랜잭션과 동기화 조건에서 가능 |
| 분리(detached) | 영속 식별자는 있지만 현재 관리되지 않음 | `detach`, `clear`, 관리 범위 종료 | 아니오 |
| 삭제(removed) | 관리 범위에서 삭제 대상으로 표시됨 | `remove` | DELETE 동기화 대상 |

```java
// 활성 쓰기 트랜잭션 안에서 실행하는 순서 예제
Author author = new Author("가람"); // 비영속
entityManager.persist(author);    // 관리 상태

Book book = new Book("첫 JPA", author); // 아직 비영속
entityManager.persist(book);            // 관리 상태
entityManager.flush();                  // DB와 동기화, commit은 아님

entityManager.detach(book);             // 분리 상태
book.rename("분리 후 제목");           // 이것만으로 UPDATE하지 않는다.
```

이 예제는 cascade를 설정하지 않았으므로 저자를 먼저 명시적으로 영속화한다. ID가 생겼는지와 현재 관리 중인지는 다른 질문이다. 분리 객체에도 ID가 남는다. 관리 여부를 확인하려면 `entityManager.contains(book)`을 사용할 수 있다.

`remove()` 뒤에도 Java 참조 변수 자체가 없어지는 것은 아니다. 삭제 예정인 객체를 더 이상 정상 도메인 객체처럼 재사용하지 않는 것이 좋다.

## 6. 변경 감지: `save()` 없는 수정의 조건

변경 감지(dirty checking)는 관리 Entity의 바뀐 상태를 확인해 DB에 필요한 변경을 반영하는 과정이다. Hibernate는 스냅샷 비교나 바이트코드 향상 등의 방식으로 변경을 추적할 수 있으므로 “언제나 모든 setter가 SQL을 직접 호출한다”로 이해하면 안 된다.

다음은 Spring이 관리하는 Service 클래스다. Controller 등 **다른 Bean이 주입받은 Service 프록시를 호출**한다는 전제다.

```java
package com.example.library;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookCommandService {
    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void rename(long bookId, String title) {
        Book book = entityManager.find(Book.class, bookId);
        if (book == null) {
            throw new IllegalArgumentException("책을 찾을 수 없습니다.");
        }
        book.rename(title);
    }
}
```

흐름은 “트랜잭션 시작 → 조회한 Book 관리 → 제목 변경 → 동기화 → commit”이다. 여기서는 `save(book)`을 반복 호출하는 것이 수정의 필수 조건이 아니다. 다만 입력 제목이 기존 값과 같으면 실제 UPDATE가 필요하지 않을 수 있다.

메서드의 `IllegalArgumentException`은 학습용이다. REST API로 연결할 때는 앞 노트에서 배운 의미 있는 비즈니스 예외와 404·400 매핑을 적용한다.

기본 프록시 모드에서 같은 클래스 내부의 `this.rename(...)` 호출은 프록시를 거치지 않으므로 애너테이션만 보고 새 트랜잭션이 적용된다고 가정하지 않는다. `readOnly = true`도 쓰기를 시도하면 반드시 예외가 나는 방화벽이 아니다. 쓰기 기능에는 올바른 쓰기 경계를 둔다. [Spring의 트랜잭션 애너테이션 설명](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)에서 이 전제를 확인한다.

## 7. flush와 commit은 왜 다를까?

flush는 컨텍스트의 변경을 SQL로 DB에 동기화하는 과정이고, commit은 트랜잭션을 성공으로 확정하는 과정이다.

```text
제목 변경
  → flush: UPDATE가 DB에 전달됨
  → 뒤의 작업에서 오류
  → rollback: 트랜잭션 DB 변경 취소
```

따라서 SQL 로그에서 UPDATE를 봤다고 최종 저장 성공을 확신하면 안 된다. flush 중에도 제약 위반이 나고, commit 시점에도 실패할 수 있다. 다른 연결이 변경을 볼 수 있는지는 격리 수준과 DB 동작까지 관련된다.

자동 flush는 commit 전이나 쿼리 결과에 영향을 주는 변경을 동기화해야 할 때 발생할 수 있다. 모든 SELECT 직전에 무조건 flush한다고 외우지 않는다. `IDENTITY`처럼 ID 획득을 위해 INSERT가 일찍 필요한 경우도 있어 “SQL은 항상 메서드 종료 때만 실행된다”도 틀리다.

또한 flush는 `clear()`가 아니다. flush 후에도 Entity는 관리 상태일 수 있다. 반대로 동기화하지 않고 `clear()`하면 아직 반영하지 않은 변경을 잃을 수 있다. 관련 동작은 [EntityManager API의 flush·clear 계약](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/entitymanager)과 [Hibernate의 flush 설명](https://docs.hibernate.org/orm/7.1/userguide/html_single/#flushing)을 참고한다.

## 8. `persist`, `merge`, Repository `save` 구분하기

`persist(newEntity)`는 새 객체를 관리 대상으로 만든다. `merge(detachedEntity)`는 전달된 객체의 상태를 관리 객체에 복사하고, 그 **관리 객체를 반환**한다. 분리된 원본이 그대로 다시 관리된다고 가정하면 안 된다.

```java
// detachedBook은 앞선 작업에서 분리된 Book이라고 가정한다.
Book managedBook = entityManager.merge(detachedBook);
managedBook.rename("관리 객체에 반영할 제목");
```

원본과 반환값이 같은 인스턴스인지에 기대지 말고 반환값의 관리 상태를 기준으로 생각한다. API 요청 DTO의 일부 값만 채운 객체를 `merge()`하면 나머지 필드의 null 등이 원하지 않는 갱신으로 이어질 수 있다. 수정 API는 관리 Entity를 조회한 뒤 허용된 필드만 명시적으로 변경하는 방식부터 연습한다.

Spring Data JPA의 `save()`는 기본적으로 새 Entity라고 판단하면 `persist`, 그렇지 않으면 `merge`를 사용한다. 기본 판별에는 nullable Version 속성과 ID 등이 관여하고 `Persistable`로 판별을 바꿀 수도 있다. 그러므로 `save()`를 단순히 INSERT와 같은 말로 쓰지 않는다. [Spring Data JPA 저장 규칙](https://docs.spring.io/spring-data/jpa/reference/jpa/entity-persistence.html)을 확인한다.

## 9. 연관관계의 주인은 업무상 주인과 다르다

“저자가 책을 썼으니 Author가 주인이다”는 업무상 표현이다. JPA의 연관관계 주인은 **관계의 DB 변경을 어느 매핑 쪽에서 결정하는가**에 관한 기술 용어다.

이 예제에서는 외래키가 `books.author_id`에 있고 Book의 `@ManyToOne`이 이를 매핑한다. 따라서 Book이 관계의 주인이다.

```java
// Book 안: 외래키 열 이름
@JoinColumn(name = "author_id")
private Author author;

// Author 안: 반대편 Java 속성 이름
@OneToMany(mappedBy = "author")
private List<Book> books;
```

위는 이름 비교용 조각이다. 실제 선언은 3절의 완전한 필드 선언을 사용한다. `mappedBy = "author_id"`로 쓰면 SQL Column명과 Java 속성명을 혼동한 것이다.

`Author.books`만 바꾸면 메모리에서 목록은 달라져도 외래키가 기대대로 갱신되지 않는다. 이 때문에 `changeAuthor()`는 기존 저자의 목록에서 제거하고, `Book.author`를 바꾸고, 새 저자 목록에 추가한다. 객체 양쪽을 일치시키는 책임과 DB 외래키를 갱신하는 책임은 구분해야 한다. [ManyToOne](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/manytoone), [OneToMany의 mappedBy](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/onetomany)를 참고한다.

실제 기능에 저자→책 탐색이 필요 없다면 `Author.books`를 없애고 단방향 `Book.author`로 시작해도 된다. 양방향은 관계를 더 강하게 저장하는 옵션이 아니라 탐색 경로와 관리 책임을 늘리는 선택이다.

이 예제의 편의 메서드는 저자의 컬렉션을 읽고 변경하므로 지연 로딩된 목록을 초기화할 수도 있다. 객체 일관성을 지키는 코드가 항상 추가 조회 없이 동작한다고 가정하지 말고, 책이 많은 저자를 다룰 때는 단방향 모델이나 별도 조회 중심 설계도 비교한다.

## 10. LAZY는 조회 시점, cascade는 작업 전파

이 둘은 이름이 함께 등장하지만 다른 질문에 답한다.

| 설정 | 질문 | 예 |
| --- | --- | --- |
| fetch | 연관 데이터를 언제 가져올까? | LAZY, EAGER |
| cascade | 이 Entity의 작업을 연관 Entity에도 전파할까? | PERSIST, MERGE, REMOVE |
| orphanRemoval | 관계에서 떨어진 자식 Entity를 삭제할까? | 소유 관계의 자식 삭제 |

`@ManyToOne`의 기본 fetch는 EAGER이며 예제는 LAZY를 명시했다. `@OneToMany`의 기본 fetch는 LAZY다. LAZY는 표준상 지연 로딩 힌트이므로 모든 환경에서 정확히 같은 SQL 시점을 보장하지 않는다. EAGER 역시 반드시 JOIN 한 번으로 가져온다는 뜻은 아니다.

```java
Book book = entityManager.find(Book.class, bookId);
String authorName = book.getAuthor().getName();
```

저자 정보가 아직 로딩되지 않았다면 두 번째 줄에서 추가 조회가 필요할 수 있다. 이런 프록시·컬렉션을 초기화할 관리 범위가 이미 끝났다면 Hibernate에서 `LazyInitializationException`이 발생할 수 있다. 해결책을 전부 EAGER로 바꾸기 전에 필요한 조회 범위와 DTO 변환 위치를 먼저 정한다.

책 여러 권이 저자 한 명을 공유하는 모델에서 `Book.author`에 `CascadeType.REMOVE`를 붙이면 책 삭제가 공유 저자 삭제로 번질 수 있다. 예제는 cascade를 사용하지 않으며, 저자 저장은 직접 수행한다.

`orphanRemoval = true`는 주문과 주문 항목처럼 자식이 부모에 전적으로 속하는 수명주기를 설계했을 때 검토한다. 단순히 “목록에서 빼고 싶다”는 이유만으로 켜지 않는다. 관계를 다른 부모로 옮겨 재사용할 자식에는 특히 신중해야 한다. JPA cascade는 DB의 `ON DELETE CASCADE`와도 다른 계층이다. [OneToMany의 cascade·orphanRemoval 계약](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/onetomany)을 확인한다.

## 11. N+1을 조회 요구사항으로 풀기

책 목록을 한 번 조회하고, 반복문에서 각 책의 저자 이름을 읽는다고 하자.

```text
책 목록 SELECT 1번
  → 아직 없는 저자 A SELECT
  → 아직 없는 저자 B SELECT
  → 아직 없는 저자 C SELECT
```

연관 데이터를 건별로 추가 조회하는 패턴을 흔히 N+1이라고 부른다. 실제 쿼리 수는 중복 저자·컨텍스트·캐시·fetch 설정에 따라 달라지므로 언제나 정확히 책 수+1인 것은 아니다. EAGER도 추가 SELECT를 사용하면 이 문제를 만들 수 있다.

이번 목록 화면은 모든 책의 저자 이름이 필요하므로 해당 쿼리에서 함께 가져오도록 요청할 수 있다.

```java
package com.example.library;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BookRepository extends JpaRepository<Book, Long> {
    @Query("select b from Book b join fetch b.author order by b.id")
    List<Book> findAllWithAuthor();
}
```

이 쿼리는 SQL이 아니라 JPQL이다. `books`가 아닌 Entity 이름 `Book`, `author_id`가 아닌 속성 경로 `b.author`를 쓴다. 일반 JOIN과 달리 fetch join은 관계를 함께 로딩하려는 의도를 나타낸다. 같은 목적에 `@EntityGraph(attributePaths = "author")`도 검토할 수 있다. [Spring Data JPA 쿼리와 EntityGraph](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)를 참고한다.

이 예제는 책→저자라는 to-one 관계이고 학습용 전체 목록이다. 운영 목록은 데이터 크기를 제한해야 한다. **저자→책 목록 같은 to-many 컬렉션 fetch join에 pagination을 그대로 결합하지 않는다.** JOIN으로 부모 행이 여러 행으로 늘어 페이지 경계가 깨지거나 메모리에서 제한을 적용할 수 있다. 부모 ID를 먼저 페이지 조회한 후 관계를 조회하는 등 별도 전략을 검토한다. [Hibernate fetch join 주의점](https://docs.hibernate.org/orm/7.1/userguide/html_single/#hql-explicit-fetch-joins)을 참고한다.

## 12. 관리 범위 안에서 DTO로 바꾼다

Entity를 Controller에서 그대로 반환하면 JSON 변환 중 연관 데이터를 읽거나 양방향 참조를 반복할 수 있다. 외부 응답은 필요한 값만 담은 DTO로 바꾼다.

```java
package com.example.library;

public record BookSummary(Long id, String title, String authorName) {
}
```

```java
package com.example.library;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookQueryService {
    private final BookRepository bookRepository;

    public BookQueryService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    @Transactional(readOnly = true)
    public List<BookSummary> findAll() {
        return bookRepository.findAllWithAuthor().stream()
                .map(book -> new BookSummary(
                        book.getId(), book.getTitle(), book.getAuthor().getName()))
                .toList();
    }
}
```

반환된 DTO에는 Author 프록시나 관리 컬렉션이 없다. Service 밖으로 넘어간 뒤 JSON 변환에서 DB를 다시 조회할 이유를 줄인다.

웹 프로젝트에서 다음 설정을 사용해 관리 범위 밖의 지연 로딩을 드러내는 연습도 할 수 있다.

```properties
spring.jpa.open-in-view=false
```

OSIV를 끄는 것 자체가 N+1 해결은 아니다. 필요한 데이터를 조회하고 관리 범위 안에서 변환하는 설계가 함께 있어야 한다. [이전 노트의 OSIV 설명](../07_09_03_Data_Access_Fundamentals/09_03_Data_Access_Fundamentals.md)과 연결해서 읽는다.

## 13. flush·clear·재조회로 실제 저장 결과 확인하기

객체의 필드만 확인하면 “내 Java 객체가 바뀌었다”까지만 검증할 수 있다. DB 저장을 확인하려면 flush하고 컨텍스트를 비운 뒤 다시 조회해 본다.

아래는 Spring Boot 4 계열의 `DataJpaTest` 패키지를 사용하는 테스트 예제다. JPA Starter, 해당 Boot 버전의 JPA 테스트 모듈, 테스트 DB Driver, JUnit·AssertJ 및 테스트가 찾을 `@SpringBootApplication` 구성이 필요하다. Boot 3 계열은 `org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest` 경로를 사용한다. 프로젝트 버전의 테스트 의존성을 먼저 확인한다.

```java
package com.example.library;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

@DataJpaTest
class BookPersistenceTest {
    @PersistenceContext
    private EntityManager entityManager;

    @Test
    void 제목과_저자_변경이_DB에_반영된다() {
        Author first = new Author("가람");
        Author second = new Author("나래");
        entityManager.persist(first);
        entityManager.persist(second);

        Book book = new Book("변경 전", first);
        entityManager.persist(book);
        entityManager.flush();
        Long bookId = book.getId();
        Long nextAuthorId = second.getId();

        book.rename("변경 후");
        book.changeAuthor(second);
        assertThat(first.getBooks()).doesNotContain(book);
        assertThat(second.getBooks()).contains(book);

        entityManager.flush(); // 변경 SQL 및 제약 위반 확인
        entityManager.clear(); // 기존 관리 객체로 검증하지 않도록 분리

        Book reloaded = entityManager.find(Book.class, bookId);
        assertThat(reloaded.getTitle()).isEqualTo("변경 후");
        assertThat(reloaded.getAuthor().getId()).isEqualTo(nextAuthorId);
    }

    @Test
    void 분리된_객체의_변경은_자동_저장되지_않는다() {
        Author author = new Author("다온");
        entityManager.persist(author);
        Book book = new Book("저장된 제목", author);
        entityManager.persist(book);
        entityManager.flush();
        Long bookId = book.getId();
        entityManager.clear();

        book.rename("메모리에서만 바뀐 제목");
        assertThat(entityManager.contains(book)).isFalse();
        entityManager.flush();

        Book reloaded = entityManager.find(Book.class, bookId);
        assertThat(reloaded.getTitle()).isEqualTo("저장된 제목");
    }
}
```

첫 테스트는 객체 양쪽의 목록과 재조회한 외래키 관계를 모두 확인한다. 두 번째는 같은 `rename()`이라도 관리 상태가 아니면 DB에 반영되지 않음을 비교한다.

`@DataJpaTest`는 기본적으로 테스트를 트랜잭션으로 감싸고 종료 후 rollback한다. 위 테스트의 flush는 commit 성공·실제 서비스 프록시 경계까지 증명하지 않는다. Service의 트랜잭션 유무를 검증할 때는 테스트 자체의 트랜잭션이 누락을 가리지 않도록 별도 통합 테스트를 설계한다. H2 테스트만으로 운영 DB의 SQL·제약·잠금까지 보장하지도 않는다. [DataJpaTest 공식 API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html)를 확인한다.

## 14. 자주 만나는 증상에서 원인으로 돌아가기

| 증상 | 먼저 확인할 질문 | 이번 예제의 점검 지점 |
| --- | --- | --- |
| 제목 변경이 저장되지 않음 | 객체가 관리 상태인가? 쓰기 트랜잭션이 있는가? | `contains`, Service 프록시 호출 |
| 저자를 바꿨는데 외래키가 그대로임 | 반대편 목록만 바꿨는가? | `Book.author` 변경 여부 |
| 새 책 저장 중 transient 관련 오류 | 참조하는 새 저자를 저장했는가? | `persist(author)` 선행 여부 |
| 화면 직렬화 중 lazy 오류 | 관리 범위 밖에서 관계를 읽는가? | Service 안 DTO 변환 |
| 목록 조회가 느림 | 저자 SELECT가 반복되는가? | SQL 횟수와 fetch 계획 |
| 책 삭제가 다른 데이터에 영향 | 삭제 cascade의 대상이 공유 객체인가? | REMOVE·orphanRemoval 범위 |

SQL 로그는 테스트·로컬에서 관찰하되 바인딩 값 로그에 개인정보가 남지 않도록 한다. 쿼리 수를 셀 때는 테스트 데이터 준비 쿼리를 제외하고, 컨텍스트와 캐시를 정리한 뒤 측정할 기능만 실행한다.

또한 Entity에 자동 생성된 `toString()`, `equals()`, `hashCode()`가 모든 연관관계를 포함하면 순환 호출이나 의도하지 않은 로딩을 유발할 수 있다. 이번 예제는 이를 자동 생성하지 않았다. 서로 다른 컨텍스트의 Entity를 Set·Map에서 비교해야 한다면 ID 생성 시점과 안정적인 동등성 전략을 별도 학습한다.

## 15. 요약 정리

1. Entity의 ID 보유 여부와 현재 관리 상태는 같은 개념이 아니다.
2. 같은 영속성 컨텍스트는 같은 Entity 식별자에 대해 관리 객체의 동일성을 유지한다.
3. 변경 감지는 관리 상태와 올바른 쓰기 트랜잭션을 전제로 이해한다.
4. flush는 SQL 동기화이고 commit은 트랜잭션 확정이다.
5. `merge()`는 전달된 상태를 관리 객체로 복사하며 반환값을 사용해야 한다.
6. 관계의 주인은 업무상 소유자가 아니라 외래키 변경을 결정하는 매핑 쪽이다.
7. 양방향 관계의 두 Java 경로를 함께 맞추되 `mappedBy`에는 Java 속성명을 쓴다.
8. fetch·cascade·orphanRemoval은 조회·작업 전파·자식 삭제라는 서로 다른 정책이다.
9. N+1은 실제 SQL로 확인하고 사용 사례별 fetch 계획과 DTO 변환으로 다룬다.
10. DB 반영 검증은 객체 확인에서 끝내지 않고 flush·clear·재조회로 이어 간다.

## 16. 미니 퀴즈

1. `book.getId()`가 null이 아니면 `book.rename()`이 자동으로 DB에 저장되는가?
2. UPDATE 로그를 본 뒤 뒤쪽 작업에서 예외가 났다. 최종 저장 성공을 확신할 수 있는가?
3. `mappedBy = "author_id"`가 이번 모델에서 잘못된 이유는 무엇인가?
4. 책→저자 관계에 `CascadeType.REMOVE`를 붙일 때 어떤 문제가 생길 수 있는가?
5. LAZY를 EAGER로 바꾸면 N+1이 반드시 사라지는가?
6. 테스트에서 flush 뒤 clear를 하는 이유와, 이 테스트가 commit을 보장하지 않는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 아니다. ID가 있는 분리 객체일 수 있다. 현재 관리 여부와 트랜잭션 경계를 확인해야 한다.
2. 아니다. flush 후에도 rollback할 수 있고 commit 자체가 실패할 수 있다.
3. `mappedBy`는 반대편 Entity의 Java 속성명이다. 이 모델은 `author`를 써야 하며 `author_id`는 DB 열 이름이다.
4. 여러 책이 공유하는 저자까지 삭제 대상으로 전파할 수 있다. 외래키 제약으로 실패하거나 다른 기능의 데이터를 훼손할 수 있으므로 수명주기를 먼저 설계한다.
5. 아니다. EAGER도 추가 SELECT로 연관 데이터를 가져올 수 있다. 실제 조회 쿼리와 연관 데이터 접근을 관찰해야 한다.
6. 메모리의 기존 관리 객체가 아니라 DB에서 다시 읽은 결과를 검증하려는 것이다. 테스트는 기본적으로 끝날 때 rollback하므로 commit 성공 및 실제 Service 경계를 별도로 확인해야 한다.

</details>

## 17. 다음 학습 연결

이제 “객체 변경이 DB에 전달되는 과정”을 배웠다. 다음은 여러 Repository 작업을 묶는 **트랜잭션 경계, commit·rollback, 예외 규칙과 프록시 호출**이다. 그 뒤 테스트 범위를 확장하면, 메모리에서 맞아 보이는 코드와 실제 DB에서 올바르게 동작하는 코드를 구분하기 쉬워진다.
