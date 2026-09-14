# N+1 문제와 fetch join·EntityGraph: 연관 데이터를 읽고 페이지 경계 지키기

- 🎯 학습 목표: 연관 객체에 접근할 때 추가 SQL이 발생하는 이유를 재현하고, 조회 전략을 바꾼 뒤 쿼리 수와 결과를 함께 확인한다.
- 🧩 핵심 키워드: N+1, LAZY·EAGER, 일반 join·fetch join, EntityGraph, to-one·to-many, 컬렉션 페이징, 2단계 조회
- ⭐ 중요도: ★★★★★ — 작은 테스트 데이터에서는 보이지 않던 목록 조회 비용을 찾고, 잘못된 최적화로 결과가 바뀌는 것을 막는다.
- 📝 한눈에 보는 내용: 글과 작성자로 N+1을 재현한 뒤 fetch join과 EntityGraph를 비교한다. 작성자 목록에 글 목록까지 붙일 때는 부모 ID 페이징과 컬렉션 조회를 분리한다.
- 🧱 선수 지식: Entity·영속성 컨텍스트, 기본키·외래키·JOIN, List·stream, Pageable, JPA 슬라이스 테스트
- 🔗 이전 노트: [JPA DTO Projection과 조회 최적화](../17_09_13_JPA_DTO_Projection/09_13_JPA_DTO_Projection.md)

> 정리 기준일: 2026-09-14. Java 21·Spring Boot 4.1 계열의 이전 실습 프로젝트를 확장하는 학습 코드다. 연관 로딩 설명에는 Jakarta Persistence 3.2와 Hibernate ORM 7.1 가이드를 참고했다. Boot가 반드시 Hibernate 7.1을 사용한다는 뜻은 아니며 실제 버전은 Boot 의존성 관리를 따른다. 이 저장소에는 실행 애플리케이션을 추가하지 않는다. Java 컴파일·Spring 테스트는 실행하지 않았고, 아래 SQL 수와 테스트 결과는 실습 전제에서의 예상이다.

## 1. 목록을 한 번 조회했는데 왜 SQL은 여러 번 나갈까?

글 세 개를 조회하고 각 글의 작성자 이름을 화면에 표시한다고 하자. Repository 호출은 한 번이어도 `article.getWriter().getName()`에서 작성자를 추가 조회할 수 있다. Java 메서드 호출 횟수와 SQL 실행 횟수는 같지 않다.

**N+1 문제**는 처음 목록을 읽는 쿼리 이후, 각 결과의 연관 데이터를 얻으려고 추가 쿼리가 반복되는 패턴이다. 모든 글의 작성자가 서로 다르고 캐시·묶음 조회가 없다면 글 조회 1번과 작성자 조회 3번, 총 4번을 예상한다.

```text
글 목록 SELECT 1회
  → 첫 글의 작성자 이름 접근 → 작성자 A SELECT
  → 둘째 글의 작성자 이름 접근 → 작성자 B SELECT
  → 셋째 글의 작성자 이름 접근 → 작성자 C SELECT

조회 전략 변경
  → 글과 작성자를 함께 SELECT
  → 이미 읽은 작성자 이름으로 응답 구성
```

N은 항상 글 개수와 정확히 같지는 않다. 같은 작성자를 공유하거나 영속성 컨텍스트·2차 캐시에 이미 값이 있거나 batch fetching을 사용하면 추가 쿼리 수가 달라진다. “무조건 N+1회”보다 **반복 접근이 반복 조회로 이어지는지**를 살핀다.

이전 Projection 노트는 불필요한 컬럼을 줄였다. 이번 노트는 연관 객체를 읽는 경로에서 쿼리가 늘어나는 문제를 다룬다. 컬럼 수, SQL 수, 결과 행 수는 서로 다른 관찰 대상이다.

## 2. LAZY·EAGER는 SQL 모양을 지정하는 말이 아니다

LAZY는 연관 값의 로딩을 늦출 수 있다는 설정이고, EAGER는 연관 값을 즉시 사용할 수 있도록 가져오라는 요구다. **언제 필요한가**에 관한 설정을 **반드시 JOIN 한 번으로 가져온다**는 뜻으로 해석하면 안 된다. EAGER여도 별도 SELECT가 생길 수 있다. [Hibernate Fetching 가이드](https://docs.hibernate.org/orm/7.1/userguide/html_single/#fetching)를 참고한다.

이번에는 `@ManyToOne(fetch = FetchType.LAZY)`로 기본 로딩을 늦추고, 작성자 이름이 필요한 조회에서만 로딩 계획을 지정한다. 지연 로딩 자체가 문제라기보다는, 목록에서 필요한 연관 값을 어떤 방식으로 가져올지 정하지 않은 것이 문제다.

프록시는 실제 연관 객체 대신 먼저 전달되는 대리 객체다. 필요한 상태가 없으면 Hibernate가 조회로 채울 수 있다. 그래서 SQL을 셀 때는 Repository가 반환되는 순간뿐 아니라 **작성자 이름을 읽어 DTO로 만드는 순간까지** 포함해야 한다.

영속성 컨텍스트가 닫힌 뒤 아직 읽지 않은 연관 값에 접근하면 `LazyInitializationException`이 생길 수 있다. 이를 피하려고 모든 연관관계를 EAGER로 바꾸거나 웹 응답 직렬화에 조회를 맡기지 않는다. 필요한 값을 Service 트랜잭션 안에서 읽어 DTO로 정리하는 경계를 잡는다.

## 3. 실습 범위: 이전 Book 코드를 바꾸지 않는다

[15번 페이지 조회 노트](../15_09_11_Pagination_and_Sorting/09_11_Pagination_and_Sorting.md)의 Maven·H2 프로젝트와 [17번 노트](../17_09_13_JPA_DTO_Projection/09_13_JPA_DTO_Projection.md)의 테스트 전용 `SqlCapture`를 먼저 준비한다. 시작 클래스는 `com.example.pagingstudy`에 있고, 아래 패키지는 그 하위라 기본 스캔 범위에 들어간다.

기존 Book·커서 API의 모델을 몰래 변경하지 않도록 별도의 글·작성자 예제를 추가한다. 글 한 개는 작성자 한 명에 속하고, 작성자 한 명은 글이 없거나 여러 개 있을 수 있다. 인증·글 등록 HTTP API·수정·삭제는 이번 범위가 아니다.

```text
src/main/java/com/example/pagingstudy/fetchstudy/
  Writer.java                  # 작성자와 글 컬렉션
  Article.java                 # 글과 작성자 참조
  ArticleQueryRepository.java   # 일반 조회·join·fetch join·EntityGraph 비교
  WriterQueryRepository.java    # 컬렉션 페이징의 버전별 동작과 2단계 대안
  WriterArticles.java           # 공개할 값만 담은 결과 DTO
  WriterQueryService.java       # 부모 ID 페이징 → 컬렉션 조회 → DTO 변환
src/test/java/com/example/pagingstudy/
  SqlCapture.java               # 17번 노트의 파일을 수정 없이 재사용
src/test/java/com/example/pagingstudy/fetchstudy/
  FetchStrategyJpaTest.java     # 이번에 추가하는 테스트 7개
```

의존성은 기존 data-jpa·H2·data-jpa-test·test Starter를 유지한다. 각 코드 블록은 제목에 적힌 **전체 파일**이다. 새 `@SpringBootApplication`이나 별도 데이터 초기화 스크립트는 추가하지 않는다. 데이터는 테스트 트랜잭션에서 준비하며 운영 DB의 스키마를 변경하는 실습이 아니다.

## 4. 양방향 관계를 먼저 읽는다

### 4.1 Writer.java

```java
package com.example.pagingstudy.fetchstudy; // 기존 Book 예제와 이름·구조를 분리한다.

import java.util.ArrayList; // 새 작성자의 빈 글 목록을 만든다.
import java.util.List; // 작성자 한 명이 여러 글을 가진다.
import jakarta.persistence.Column; // 이름 컬럼의 제약을 표시한다.
import jakarta.persistence.Entity; // JPA 관리 모델로 등록한다.
import jakarta.persistence.GeneratedValue; // DB가 ID를 생성한다.
import jakarta.persistence.GenerationType; // 로컬 H2에서 IDENTITY 전략을 사용한다.
import jakarta.persistence.Id; // 기본키를 지정한다.
import jakarta.persistence.OneToMany; // 작성자에서 글 목록으로 가는 관계다.
import jakarta.persistence.Table; // 실습 전용 테이블명을 지정한다.

@Entity // 기본 Entity 이름은 Writer다.
@Table(name = "fetch_writers") // JPQL의 Writer와 DB 테이블명은 다르다.
public class Writer { // 프록시 사용을 막지 않도록 final 클래스로 만들지 않는다.
    @Id // 작성자의 고유 식별자다.
    @GeneratedValue(strategy = GenerationType.IDENTITY) // INSERT 시 ID를 받는다.
    private Long id; // 저장 전에는 null일 수 있다.

    @Column(nullable = false) // 이 실습에서는 이름 없는 작성자를 저장하지 않는다.
    private String name; // 글 목록 화면에서 필요할 값이다.

    @OneToMany(mappedBy = "writer") // Article.writer가 외래키를 관리한다. 기본 로딩은 LAZY다.
    private List<Article> articles = new ArrayList<>(); // 작성자 쪽에서는 여러 글을 탐색한다.

    protected Writer() { } // JPA가 객체를 만들 때 사용하는 기본 생성자다.

    public Writer(String name) { // 테스트에서 새 작성자를 준비한다.
        this.name = name; // 이름을 저장한다.
    }

    public Article addArticle(String title) { // 두 객체 사이의 참조를 함께 맞춘다.
        Article article = new Article(title, this); // 외래키의 주인인 Article.writer도 지정한다.
        articles.add(article); // 메모리의 반대편 목록에도 같은 글을 넣는다.
        return article; // cascade를 설정하지 않았으므로 호출자가 명시적으로 저장한다.
    }

    public Long getId() { return id; } // 페이지 정렬과 DTO 식별자로 사용한다.
    public String getName() { return name; } // 프록시가 미초기화 상태라면 조회를 유발할 수 있다.
    public List<Article> getArticles() { return articles; } // 컬렉션 원소를 읽는 시점에도 로딩을 관찰한다.
}
```

### 4.2 Article.java

```java
package com.example.pagingstudy.fetchstudy; // Writer와 같은 실습 패키지다.

import jakarta.persistence.Column; // 제목 컬럼의 제약이다.
import jakarta.persistence.Entity; // JPA Entity로 등록한다.
import jakarta.persistence.FetchType; // LAZY 로딩을 명시한다.
import jakarta.persistence.GeneratedValue; // ID 자동 생성을 사용한다.
import jakarta.persistence.GenerationType; // IDENTITY 전략을 선택한다.
import jakarta.persistence.Id; // 기본키를 지정한다.
import jakarta.persistence.JoinColumn; // 작성자 외래키 컬럼을 지정한다.
import jakarta.persistence.ManyToOne; // 여러 글이 같은 작성자를 참조할 수 있다.
import jakarta.persistence.Table; // 기존 Book 테이블과 분리한다.

@Entity // JPQL에서 Article이라는 이름으로 조회한다.
@Table(name = "fetch_articles") // 실습용 DB 테이블이다.
public class Article { // 글에서 작성자를 탐색하는 쪽이다.
    @Id // 글의 고유 식별자다.
    @GeneratedValue(strategy = GenerationType.IDENTITY) // 저장할 때 ID가 부여된다.
    private Long id; // 정렬의 동점이 생기지 않는 고유 기준이다.

    @Column(nullable = false) // 실습에서 제목은 필수다.
    private String title; // 글 목록에 표시할 제목이다.

    @ManyToOne(fetch = FetchType.LAZY, optional = false) // 기본 EAGER에 기대지 않고 지연 로딩을 명시한다.
    @JoinColumn(name = "writer_id", nullable = false) // 이 필드가 실제 외래키를 관리한다.
    private Writer writer; // 글 한 개에는 작성자 참조가 최대 한 개다.

    protected Article() { } // JPA가 사용하는 기본 생성자다.

    Article(String title, Writer writer) { // Writer.addArticle을 통해 두 방향을 함께 설정한다.
        this.title = title; // 제목을 저장한다.
        this.writer = writer; // 저장될 외래키의 대상이다.
    }

    public Long getId() { return id; } // 글 순서를 검증할 때 쓴다.
    public String getTitle() { return title; } // DTO에 복사할 값이다.
    public Writer getWriter() { return writer; } // 참조를 얻는 것과 이름을 초기화하는 것은 구분한다.
}
```

`mappedBy`는 DB 컬럼명 `writer_id`가 아니라 Java 필드명 `writer`다. `addArticle()`은 객체 참조를 맞추지만 DB 저장을 대신하지는 않는다. 테스트에서 작성자와 글을 각각 persist하는 이유다. 관계의 주인은 [Entity 생명주기와 연관관계](../08_09_05_Entity_Lifecycle_and_Relationships/09_05_Entity_Lifecycle_and_Relationships.md)에서 복습할 수 있다.

## 5. 일반 join과 fetch join을 같은 데이터로 비교한다

### 5.1 ArticleQueryRepository.java

```java
package com.example.pagingstudy.fetchstudy; // 글 중심 조회를 모은다.

import java.util.List; // count 없이 결과 목록만 받는다.
import org.springframework.data.domain.Pageable; // 단건 연관을 포함한 페이지 크기를 제한한다.
import org.springframework.data.jpa.repository.EntityGraph; // 조회별 연관 로딩 계획이다.
import org.springframework.data.jpa.repository.Query; // 비교할 JPQL을 직접 지정한다.
import org.springframework.data.repository.Repository; // 필요한 읽기 메서드만 선언한다.

public interface ArticleQueryRepository extends Repository<Article, Long> { // Entity 등록과 Repository 등록은 별개다.
    @Query("select a from Article a order by a.id") // 작성자를 함께 로딩하라는 지시는 없다.
    List<Article> plain(); // 이 실습에서는 글 SELECT 한 번 이후 이름 접근을 관찰한다.

    @Query("select a from Article a join a.writer w where w.name <> '' order by a.id") // 작성자 이름으로 글을 거르기 위한 join이다.
    List<Article> joined(); // select a와 일반 join만으로 a.writer 초기화를 요구하지 않는다.

    @Query("select a from Article a join fetch a.writer order by a.id") // 글과 작성자를 함께 Entity로 읽는다.
    List<Article> fetched(); // 작은 고정 데이터 비교용이며 무제한 운영 목록 API가 아니다.

    @EntityGraph(attributePaths = "writer", type = EntityGraph.EntityGraphType.FETCH) // 이번 조회에는 작성자가 필요하다.
    @Query("select a from Article a order by a.id") // 조건·정렬과 로딩 계획을 분리한다.
    List<Article> graphed(Pageable pageable); // 컬렉션이 아닌 to-one 관계만 가져온다.
}
```

일반 join은 관련 테이블을 이용해 조건·정렬·선택 값을 만들 수 있게 한다. 반면 fetch join은 조회하는 Entity의 연관 상태도 함께 가져오도록 지시한다. **SQL에 join이 보인다**는 사실만으로 Java 연관 객체까지 초기화됐다고 결론 내리지 않는다. 테스트에서는 이름 접근 전후의 SQL 수를 나누어 검사한다.

위 fetch join은 inner join이다. 이번 모델은 작성자가 필수라 세 글이 모두 남는다. 선택적 연관관계에서 작성자가 없는 글도 유지하려면 `left join fetch`의 의미를 검토해야 한다. 조회 비용을 줄이는 과정에서 결과 대상을 바꾸면 안 된다. [Hibernate HQL의 association fetching](https://docs.hibernate.org/orm/7.1/querylanguage/html_single/#association-fetching)을 참고한다.

### 5.2 EntityGraph는 무엇을 다르게 표현하는가?

EntityGraph는 이번 조회에서 함께 읽을 속성들의 계획이다. `attributePaths = "writer"`는 DB 컬럼명이 아닌 Entity 속성 경로다. 복잡한 계획은 이름을 붙여 재사용할 수도 있지만 이번에는 메서드에 직접 지정한다. [Spring Data의 EntityGraph 설정](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html#jpa.entity-graph), [EntityGraph API](https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/EntityGraph.html)를 참고한다.

| 타입 | 지정한 속성 | 지정하지 않은 속성 |
| --- | --- | --- |
| FETCH | EAGER로 취급 | LAZY로 취급 |
| LOAD | EAGER로 취급 | 기존 매핑의 로딩 설정을 따름 |

이는 로딩 계약이지 “SELECT 컬럼을 이 목록으로만 제한하라”는 Projection 계약이 아니다. JPA 구현체는 계획보다 추가 상태를 가져올 수도 있고, EntityGraph가 항상 SQL JOIN 한 번을 보장하는 것도 아니다. 아래의 SQL 1회 검사는 **이번 Hibernate·단순 to-one 매핑에서 기대하는 구현 동작**을 확인한다. [Jakarta Persistence Entity Graph 의미](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2#use-of-entity-graphs-in-find-and-query-operations)를 참고한다.

## 6. 컬렉션 fetch join에 페이지 제한을 붙이면 왜 위험할까?

지금까지는 글 한 개에서 작성자 한 명을 읽었다. 이런 to-one 관계는 이 모델에서 글 한 개가 여러 SQL 행으로 늘어나지 않는다. 그런데 작성자에서 글 목록을 읽는 to-many 관계는 다르다.

작성자 A에게 글이 세 개, B에게 한 개 있다고 하자. 조인 결과는 아래와 같다.

| SQL 결과 행 | 작성자 | 글 |
| ---: | --- | --- |
| 1 | A | A-1 |
| 2 | A | A-2 |
| 3 | A | A-3 |
| 4 | B | B-1 |

“작성자 두 명”을 요청했다고 조인 결과를 두 행에서 잘라 버리면 작성자 B가 빠지고 A의 글도 하나 빠진다. **부모 개수와 조인 결과 행 수가 다르기 때문**이다. Hibernate의 컬렉션 fetch join에 일반적인 페이지 제한을 결합하면 DB 제한 대신 메모리에서 부모 결과를 자르는 상황이 생길 수 있다.

이 동작을 테스트에서 놓치지 않도록 `hibernate.query.fail_on_pagination_over_collection_fetch=true`를 사용한다. 메모리 페이징이 필요한 쿼리를 예외로 중단시키는 보호 설정이지, 쿼리를 자동 최적화하는 설정은 아니다.

**버전에 따른 차이도 있다.** Hibernate 7.1 문서는 컬렉션 fetch와 페이지 제한의 메모리 처리 위험을 설명한다. 현재 QuerySettings 문서는 DB가 서브쿼리 안의 LIMIT을 지원하지 않는 경우라는 조건을 명시한다. 따라서 새로운 Hibernate·DB 조합에서 DB 제한으로 처리될 수 있는 쿼리까지 “항상 예외가 난다”고 단정하지 않는다. 아래 테스트는 보호 설정을 켜고, 메모리 처리 거부 또는 올바른 결과와 DB 제한 SQL을 확인한다. [7.1 QuerySettings](https://docs.hibernate.org/orm/7.1/javadocs/org/hibernate/cfg/QuerySettings.html#FAIL_ON_PAGINATION_OVER_COLLECTION_FETCH), [현재 QuerySettings](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/cfg/QuerySettings.html#FAIL_ON_PAGINATION_OVER_COLLECTION_FETCH)를 비교한다.

`distinct`로 Java 결과의 부모 중복을 제거해도 DB에서 전송한 자식 행이 사라지지는 않는다. EntityGraph로 컬렉션 로딩을 지정해도 같은 행 증가 문제를 우회하지 못한다. 또한 여러 컬렉션을 한꺼번에 fetch하면 자식 조합만큼 행이 늘어날 수 있다. [Hibernate HQL의 fetch join·중복 제거 설명](https://docs.hibernate.org/orm/7.1/querylanguage/html_single/)을 참고한다.

## 7. 대안: 부모 ID 페이지를 먼저 확정한다

이번 보충 예제는 단순한 offset 목록이다. 기존 `/books/cursor`를 바꾸거나 모든 페이지네이션에 적용할 완성형 API를 만드는 것은 아니다.

```text
1. Writer ID만 id ASC로 정렬해 DB에서 page·size 제한
2. ID가 없으면 빈 목록 반환
3. 선택한 ID의 Writer와 articles를 fetch join — 이 쿼리에는 Pageable 없음
4. 동일한 id ASC 순서로 DTO 변환 — 글 없는 작성자는 빈 글 목록
```

### 7.1 WriterQueryRepository.java

```java
package com.example.pagingstudy.fetchstudy; // 작성자 중심 조회를 모은다.

import java.util.List; // 부모 ID와 Entity 목록의 반환 타입이다.
import org.springframework.data.domain.Pageable; // 1단계의 부모 개수를 제한한다.
import org.springframework.data.jpa.repository.Query; // 명시적인 두 단계 쿼리다.
import org.springframework.data.repository.Repository; // 조회 메서드만 공개한다.
import org.springframework.data.repository.query.Param; // IN 조건에 ID 목록을 바인딩한다.

public interface WriterQueryRepository extends Repository<Writer, Long> { // Writer를 기준으로 페이지를 나눈다.
    @Query("select w from Writer w left join fetch w.articles order by w.id") // 컬렉션 fetch와 제한의 결합을 관찰한다.
    List<Writer> collectionPage(Pageable pageable); // 보호 설정과 SQL 확인 없이 운영에 적용하지 않는다.

    @Query("select w.id from Writer w order by w.id") // 컬렉션 join 없이 부모 ID만 정렬한다.
    List<Long> pageIds(Pageable pageable); // List이므로 전체 개수 count는 요청하지 않는다.

    @Query("select w from Writer w left join fetch w.articles where w.id in :ids order by w.id") // 글 없는 작성자도 유지한다.
    List<Writer> fetchByIds(@Param("ids") List<Long> ids); // 여기에 Pageable을 다시 전달하지 않는다.
}
```

`IN (:ids)` 자체는 입력 목록 순서를 보장하지 않는다. 여기서는 1·2단계가 모두 고유한 `id ASC`라 동일한 부모 순서를 만든다. 다른 정렬을 사용한다면 두 번째 조회에서도 그 순서를 복원해야 한다. Hibernate 6 이후 fetch join의 Entity 중복은 메모리에서 자동 제거되므로 이 예제에는 중복 제거용 `distinct`를 추가하지 않는다. 다른 JPA 구현체에서는 결과 중복 정책을 별도로 확인한다.

### 7.2 WriterArticles.java

```java
package com.example.pagingstudy.fetchstudy; // Entity를 외부로 직접 내보내지 않는다.

import java.util.List; // 글 제목 값만 담는다.

public record WriterArticles( // 작성자 한 명의 목록용 응답 값이다.
        Long id, // 어느 작성자인지 식별한다.
        String name, // 작성자 이름이다.
        List<String> titles // 지연 로딩 컬렉션 대신 이미 읽은 제목 목록이다.
) { }
```

### 7.3 WriterQueryService.java

```java
package com.example.pagingstudy.fetchstudy; // 조회와 DTO 변환의 경계를 모은다.

import java.util.Comparator; // 각 작성자의 글 순서를 ID 기준으로 확정한다.
import java.util.List; // DTO 목록을 반환한다.
import org.springframework.data.domain.PageRequest; // 부모 페이지를 요청한다.
import org.springframework.stereotype.Service; // 테스트에서 실제 Service를 가져온다.
import org.springframework.transaction.annotation.Transactional; // 두 조회와 변환을 하나의 트랜잭션 범위에 둔다.

@Service // Controller는 만들지 않고 조회 동작만 실습한다.
public class WriterQueryService { // 기존 Book Service를 변경하지 않는다.
    private final WriterQueryRepository repository; // 생성자로 의존성을 전달받는다.

    public WriterQueryService(WriterQueryRepository repository) { // Spring이 실제 Repository를 주입한다.
        this.repository = repository; // 이후 두 단계에 재사용한다.
    }

    @Transactional(readOnly = true) // 이 설정만으로 두 SQL의 동일한 스냅샷을 보장하지는 않는다.
    public List<WriterArticles> list(int page, int size) { // 학습용 목록이며 Page 메타데이터는 제공하지 않는다.
        if (page < 0 || page > 1000 || size < 1 || size > 100) { // 기존 목록과 같은 수준의 입력 상한을 둔다.
            throw new IllegalArgumentException("page는 0~1000, size는 1~100이어야 합니다."); // DB 조회 전에 거부한다.
        }
        List<Long> ids = repository.pageIds(PageRequest.of(page, size)); // 부모 ID에서만 offset·limit을 적용한다.
        if (ids.isEmpty()) { // 마지막 페이지 이후 또는 빈 DB를 처리한다.
            return List.of(); // 빈 IN 조건을 만들지 않고 두 번째 SQL도 생략한다.
        }
        List<Writer> writers = repository.fetchByIds(ids); // 선택한 부모의 전체 글 컬렉션을 읽는다.
        return writers.stream().map(writer -> new WriterArticles( // 영속성 컨텍스트 안에서 값으로 변환한다.
                writer.getId(), // 부모 ID를 공개한다.
                writer.getName(), // 이미 조회한 작성자 이름이다.
                writer.getArticles().stream() // fetch된 컬렉션이므로 추가 SELECT 없이 순회해야 한다.
                        .sorted(Comparator.comparing(Article::getId)) // DB 컬렉션의 우연한 순서에 기대지 않는다.
                        .map(Article::getTitle).toList() // Entity 대신 제목 문자열만 남긴다.
        )).toList(); // 부모 순서는 fetchByIds의 order by w.id와 같다.
    }
}
```

첫 번째 쿼리는 부모 수를 제한하지만, 선택된 작성자의 글이 수만 개라면 두 번째 쿼리와 DTO도 여전히 커진다. “부모 20명”은 “자식도 20개 이하”가 아니다. 글 목록을 별도 API로 페이지화하거나 개수·미리보기만 제공하는 설계가 필요할 수 있다.

또한 DB 격리 수준과 동시 변경에 따라 두 조회 사이에 부모 삭제나 자식 추가가 보일 수 있다. 이 코드는 두 번째 조회에 남은 부모만 반환하며 사라진 행을 재시도로 채우지 않는다. 같은 스냅샷이 필수라면 별도의 일관성 정책이 필요하다. 검색·권한 조건을 넣는 실제 API라면 두 단계에 동일한 접근 범위를 적용해야 한다.

## 8. 쿼리 수와 반환값을 함께 확인하는 테스트

### 8.1 테스트 전제

17번의 `SqlCapture`는 Hibernate가 JDBC statement를 준비하기 전 SQL을 기록한다. 이 실습의 동기식 단순 SELECT만 세며, 실행 시간·네트워크 전송량을 측정하지 않는다. 기록 시점을 DTO 변환 뒤까지 유지하는 것이 핵심이다.

여기서는 batch fetching·2차 캐시·쿼리 캐시를 꺼서 N+1을 가리는 변수를 줄인다. Entity에 `@BatchSize` 같은 별도 설정을 추가하지 않는다. 데이터를 넣은 뒤 `flush()`로 DB에 반영하고 `clear()`로 1차 캐시를 비운 다음 기록을 시작한다. 준비한 작성자가 캐시에 남아 있으면 비교가 달라지기 때문이다.

`@DataJpaTest`는 테스트 트랜잭션과 기본 rollback을 제공한다. 각 테스트의 데이터는 다른 테스트에 남지 않는다. 다만 이 테스트는 HTTP 요청이나 트랜잭션 종료 후 직렬화를 검증하지 않는다. [Spring Boot DataJpaTest API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html)를 참고한다.

### 8.2 FetchStrategyJpaTest.java

```java
package com.example.pagingstudy.fetchstudy; // 새 Entity·Repository와 같은 패키지다.

import com.example.pagingstudy.SqlCapture; // 17번 노트의 public 테스트 도구를 재사용한다.
import java.util.List; // 결과를 값 목록으로 확인한다.
import jakarta.persistence.EntityManager; // 데이터 준비와 영속성 컨텍스트 초기화를 담당한다.
import org.junit.jupiter.api.AfterEach; // 성공·실패에 관계없이 SQL 기록을 정리한다.
import org.junit.jupiter.api.Test; // 일곱 테스트를 선언한다.
import org.springframework.beans.factory.annotation.Autowired; // 실제 JPA Bean을 주입한다.
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest; // Boot 4 계열 JPA 슬라이스다.
import org.springframework.context.annotation.Import; // 실제 Service를 테스트 문맥에 넣는다.
import org.springframework.data.domain.PageRequest; // 작은 페이지를 요청한다.
import static org.assertj.core.api.Assertions.assertThat; // 결과·쿼리 수를 검증한다.
import static org.assertj.core.api.Assertions.assertThatThrownBy; // 위험한 조회와 입력의 거부를 확인한다.

@DataJpaTest(properties = { // 아래 설정은 이 테스트 문맥에만 적용한다.
        "spring.jpa.properties.hibernate.session_factory.statement_inspector=com.example.pagingstudy.SqlCapture", // SELECT 관찰기를 등록한다.
        "spring.jpa.properties.hibernate.use_sql_comments=false", // 이전 도구의 단순 SELECT 분류에 맞춘다.
        "spring.jpa.properties.hibernate.default_batch_fetch_size=0", // 연관 조회를 묶지 않고 N+1을 재현한다.
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false", // 다른 세션의 캐시 영향을 배제한다.
        "spring.jpa.properties.hibernate.cache.use_query_cache=false", // 쿼리 결과 캐시도 사용하지 않는다.
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true" // 메모리 컬렉션 페이징은 실패시킨다.
})
@Import(WriterQueryService.class) // 2단계 조회와 DTO 변환을 실제로 실행한다.
class FetchStrategyJpaTest { // 별도 초기 데이터 스크립트가 없는 로컬 H2 실습 기준이다.
    @Autowired // 저장한 뒤 캐시를 비우기 위해 사용한다.
    private EntityManager em; // 테스트 트랜잭션에 연결된 EntityManager다.
    @Autowired // 글 중심의 네 가지 조회 방식이다.
    private ArticleQueryRepository articles; // Mockito 대역이 아닌 실제 Repository다.
    @Autowired // 컬렉션 페이징의 버전별 동작을 직접 확인한다.
    private WriterQueryRepository writers; // 2단계 조회에도 같은 구현을 사용한다.
    @Autowired // 두 쿼리와 결과 변환까지 측정한다.
    private WriterQueryService service; // 테스트용 대역으로 교체하지 않는다.

    @AfterEach // 테스트의 검증이 실패해도 호출된다.
    void cleanUp() { SqlCapture.clear(); } // ThreadLocal 기록을 다음 테스트로 넘기지 않는다.

    private Writer saveWriter(String name, int articleCount) { // 이름과 글 개수를 받아 데이터를 준비한다.
        Writer writer = new Writer(name); // 아직 비영속 상태다.
        em.persist(writer); // 작성자를 먼저 저장한다.
        for (int i = 1; i <= articleCount; i++) { // 요청한 수만큼 서로 다른 글을 만든다.
            em.persist(writer.addArticle(name + "-" + i)); // 양쪽 참조를 맞춘 뒤 글도 명시적으로 저장한다.
        }
        return writer; // 실제 ID를 이용해 결과 순서를 검증한다.
    }

    private void threeDifferentWriters() { // 글 수와 미조회 작성자 수를 모두 3으로 맞춘다.
        saveWriter("A", 1); // A-1이라는 글 하나다.
        saveWriter("B", 1); // B-1은 다른 작성자를 참조한다.
        saveWriter("C", 1); // C-1도 새로운 작성자를 참조한다.
        observe(); // 저장·캐시의 영향을 제거한 뒤 측정한다.
    }

    private void observe() { // 한 조회 시나리오의 관찰 시작점이다.
        em.flush(); // 준비 데이터를 DB에 반영한다.
        em.clear(); // 저장하면서 알게 된 작성자·글을 1차 캐시에서 분리한다.
        SqlCapture.clear(); // INSERT 등 준비 SQL은 비교에서 제외한다.
    }

    private List<String> names(List<Article> rows) { // Repository 반환 뒤의 연관 접근을 포함한다.
        return rows.stream().map(row -> row.getWriter().getName()).toList(); // 이 줄에서 지연 SELECT가 생길 수 있다.
    }

    @Test // LAZY로 선언했어도 이름을 모두 읽으면 추가 조회가 발생한다.
    void lazyAccessShowsNPlusOne() {
        threeDifferentWriters(); // 서로 다른 작성자가 있어야 1+3이 드러난다.
        List<Article> rows = articles.plain(); // 먼저 글 목록만 읽는다.
        assertThat(SqlCapture.selects()).hasSize(1); // 아직 이름에는 접근하지 않았다.
        assertThat(names(rows)).containsExactly("A", "B", "C"); // 세 작성자 이름을 실제로 읽는다.
        assertThat(SqlCapture.selects()).hasSize(4); // 글 1회와 작성자 3회를 예상한다.
    }

    @Test // SQL의 join과 연관 객체 초기화가 같은 뜻은 아니다.
    void ordinaryJoinStillLoadsWritersSeparately() {
        threeDifferentWriters(); // 캐시 없는 같은 조건이다.
        List<Article> rows = articles.joined(); // 작성자 이름 조건 때문에 join을 사용한다.
        assertThat(SqlCapture.selects()).hasSize(1); // 조건 평가 SQL 한 번이다.
        assertThat(names(rows)).containsExactly("A", "B", "C"); // 반환된 글의 작성자 상태를 읽는다.
        assertThat(SqlCapture.selects()).hasSize(4); // 일반 join만으로 fetch가 되지 않았는지 확인한다.
    }

    @Test // 같은 결과를 연관 fetch join으로 읽는다.
    void fetchJoinLoadsNamesInOneSelect() {
        threeDifferentWriters(); // 앞 테스트와 독립적인 데이터다.
        assertThat(names(articles.fetched())).containsExactly("A", "B", "C"); // 이름 접근까지 포함한다.
        assertThat(SqlCapture.selects()).hasSize(1); // 이번 매핑은 SQL 한 번으로 초기화되어야 한다.
    }

    @Test // 단일 to-one fetch 계획에는 글 행의 개수 증가가 없다.
    void entityGraphKeepsToOnePageBoundary() {
        threeDifferentWriters(); // 총 세 개 중 첫 두 개만 요청한다.
        List<Article> first = articles.graphed(PageRequest.of(0, 2)); // 첫 페이지의 작성자도 가져온다.
        assertThat(names(first)).containsExactly("A", "B"); // 요청한 두 글만 반환해야 한다.
        assertThat(SqlCapture.selects()).hasSize(1); // List이므로 count는 없고 연관 재조회도 없어야 한다.
        observe(); // 다음 페이지를 새 캐시 상태에서 읽는다.
        assertThat(names(articles.graphed(PageRequest.of(1, 2)))).containsExactly("C"); // 두 글을 건너뛴 결과다.
        assertThat(SqlCapture.selects()).hasSize(1); // 후속 페이지도 같은 계획을 사용한다.
    }

    @Test // 메모리 제한은 거부하고 DB에서 처리된다면 결과와 제한 SQL을 확인한다.
    void collectionPageRejectsMemoryLimitOrUsesDatabaseLimit() {
        saveWriter("A", 3); // 부모 한 명이 조인 결과 세 행을 만든다.
        saveWriter("B", 1); // 부모 두 번째도 존재한다.
        saveWriter("C", 1); // 세 번째 부모가 있어 실제로 두 명 제한을 확인할 수 있다.
        observe(); // 준비 SQL을 제거한다.
        List<Writer> result; // 지원 여부에 따라 결과를 받거나 보호 설정에 의해 거부된다.
        try { // 이 호출의 예외만 버전별 보호 동작으로 검사한다.
            result = writers.collectionPage(PageRequest.of(0, 2)); // 첫 부모 두 명을 요청한다.
        } catch (RuntimeException error) { // 쿼리 문법 오류 등 아무 예외나 통과시키지 않는다.
            assertThat(error).hasStackTraceContaining("collection fetch"); // 컬렉션 페이징 거부 원인인지 확인한다.
            return; // 메모리 페이징을 거부하는 구현의 정상 검증 경로다.
        }
        assertThat(result).extracting(Writer::getName).containsExactly("A", "B"); // DB 처리 지원 시 부모 경계가 맞아야 한다.
        assertThat(result.get(0).getArticles()).hasSize(3); // 부모를 제한하되 A의 자식은 자르지 않는다.
        assertThat(result.get(1).getArticles()).hasSize(1); // B의 전체 컬렉션도 확인한다.
        assertThat(SqlCapture.selects()).hasSize(1); // 컬렉션 접근까지 추가 조회가 없어야 한다.
        assertThat(SqlCapture.selects().get(0)).containsPattern("(?s)\\b(fetch\\s+first|limit)\\b"); // H2에서 DB 제한 구문의 존재를 확인한다.
    }

    @Test // 부모 두 명을 제한하되 각 부모의 글을 누락하지 않는다.
    void twoStepsKeepParentsAndCompleteCollections() {
        Writer a = saveWriter("A", 3); // 첫 부모는 글이 세 개다.
        Writer b = saveWriter("B", 1); // 두 번째 부모는 글이 한 개다.
        Writer c = saveWriter("C", 0); // 글이 없는 부모도 목록에 남아야 한다.
        observe(); // DB에 저장된 상태로 검증한다.
        assertThat(service.list(0, 2)).containsExactly( // 부모 ID 두 개를 먼저 선택한다.
                new WriterArticles(a.getId(), "A", List.of("A-1", "A-2", "A-3")), // 컬렉션이 잘리지 않는다.
                new WriterArticles(b.getId(), "B", List.of("B-1")) // 부모 순서도 유지한다.
        );
        assertThat(SqlCapture.selects()).hasSize(2); // ID 조회와 컬렉션 fetch 조회다.
        observe(); // 다음 부모 페이지를 독립적으로 관찰한다.
        assertThat(service.list(1, 2)).containsExactly(new WriterArticles(c.getId(), "C", List.of())); // left join의 빈 컬렉션 경로다.
        assertThat(SqlCapture.selects()).hasSize(2); // 이름·제목 변환에서 추가 SQL이 없어야 한다.
    }

    @Test // 빈 결과와 잘못된 입력의 불필요한 쿼리를 막는다.
    void emptyPageAndInvalidInputShortCircuit() {
        observe(); // 빈 DB로 시작한다.
        assertThat(service.list(0, 2)).isEmpty(); // 빈 ID 목록이면 즉시 종료한다.
        assertThat(SqlCapture.selects()).hasSize(1); // 빈 IN 쿼리를 보내지 않는다.
        saveWriter("A", 1); // 전체 DB는 비어 있지 않은 상태도 준비한다.
        observe(); // 준비 SQL을 제거한다.
        assertThat(service.list(1, 2)).isEmpty(); // 존재하지 않는 다음 페이지도 같은 계약이다.
        assertThat(SqlCapture.selects()).hasSize(1); // 부모 ID 조회만 실행한다.
        SqlCapture.clear(); // 입력 거부 경로는 DB 조회 전인지 별도로 센다.
        assertThatThrownBy(() -> service.list(-1, 2)).isInstanceOf(IllegalArgumentException.class); // 음수 페이지를 거부한다.
        assertThat(SqlCapture.selects()).isEmpty(); // 거부된 요청으로 SELECT를 실행하지 않는다.
    }
}
```

보호 설정 테스트의 문자열 검사는 Hibernate 예외 메시지와 H2 제한 문법에 의존한다. 버전 변경으로 실패 문구가 바뀌면 원인 예외와 해당 버전 문서를 확인해 고친다. 성공 경로의 정규식은 제한 구문 존재만 검사하며 서브쿼리 구조·실행 계획까지 해석하지 않는다. 보호 설정을 켠 상태에서 전체 SQL도 직접 확인한다. 아무 예외나 통과시키거나 보호 설정을 끄는 방식으로 테스트를 맞추지 않는다.

### 8.3 어디에서 실행하고 무엇을 확인하는가?

다음 명령은 TIL 루트가 아니라 **15~17번 예제를 준비한 Maven 실습 프로젝트 루트**에서 실행한다.

```powershell
.\mvnw.cmd dependency:tree "-Dincludes=org.hibernate.orm:hibernate-core" # 실제 Hibernate 버전을 먼저 확인한다.
.\mvnw.cmd "-Dtest=FetchStrategyJpaTest" test # 이번 테스트 7개의 실행을 예상한다.
.\mvnw.cmd test # 기존 Book·페이지·커서·Projection 테스트도 함께 확인한다.
```

예상 관찰 결과는 다음과 같다. 실행 성공 로그를 제시하는 표가 아니다.

| 시나리오 | 이름·DTO 변환까지의 SELECT 수 | 함께 확인할 결과 |
| --- | ---: | --- |
| LAZY 목록 + 서로 다른 작성자 3명 | 4 | A·B·C 이름 |
| 일반 join + 같은 연관 접근 | 4 | 필터 결과와 이름 |
| to-one fetch join | 1 | 같은 세 이름 |
| to-one EntityGraph + List 페이지 | 페이지당 1 | 첫 페이지 A·B, 다음 C |
| 컬렉션 fetch + Pageable + 보호 설정 | 버전·DB별 거부 또는 1 | 거부 원인, 또는 부모 두 명·전체 자식·DB 제한 SQL |
| 부모 ID → 컬렉션 fetch | 비어 있지 않은 페이지당 2 | 부모 순서·전체 글·글 없는 부모 |
| 빈 부모 ID 페이지 | 1 | 빈 목록, 2단계 생략 |

쿼리 수가 같아도 전송 행 수·컬럼 크기·실행 계획·응답 시간은 다를 수 있다. 정확한 SQL 제한 구문과 실행 계획은 대상 DB에서 별도로 확인한다. 이 테스트는 부하 테스트나 동시 변경 테스트가 아니다.

## 9. 실제 적용할 때의 선택 기준

| 필요한 결과 | 먼저 검토할 방식 | 주의할 점 |
| --- | --- | --- |
| 글 제목·작성자 이름 값만 필요 | 명시적 DTO Projection | Entity를 구성하지 않아도 되는지 판단 |
| 글 Entity와 작성자 상태가 필요 | to-one fetch join·EntityGraph | 조회 대상·페이지 결과와 실제 SQL 확인 |
| 작성자 한 명의 전체 글이 필요 | 범위를 제한한 컬렉션 fetch | 자식 개수가 너무 크지 않은지 확인 |
| 여러 작성자의 전체 글 + 부모 페이징 | 부모 ID 제한 후 별도 fetch | 부모 순서·빈 목록·동시 변경·자식 총량 |

batch fetching은 여러 연관 ID를 묶어서 조회하는 또 다른 선택지다. 그러나 쿼리를 항상 한 번으로 만드는 기능은 아니며 캐시·접근 순서·batch 크기에 영향을 받는다. 이번 실습에서는 꺼 두었고, 다음 노트에서 `@BatchSize`와 기본 batch 설정을 따로 비교한다.

실수는 보통 다음 지점에서 드러난다.

- 테스트 데이터가 같은 작성자만 참조한다면 N+1이 예상보다 작게 보일 수 있다.
- 저장 직후 clear 없이 조회하면 영속성 컨텍스트가 추가 SELECT를 가릴 수 있다.
- Entity를 JSON으로 직접 내보내면 직렬화 과정에서 예상 밖의 연관 접근이 발생할 수 있다.
- 컬렉션 fetch 결과를 자식 조건으로 일부만 제한하면 전체 컬렉션이라고 오해할 위험이 있다. 목록 필터와 읽어 올 컬렉션 범위를 분리한다.
- 부모 수를 줄였다는 사실만으로 자식 총량이나 운영 조회 시간이 안전하다고 결론 내리지 않는다.

## 10. 핵심 정리와 다음 학습

1. Repository 호출 한 번이 SQL 한 번이라는 뜻은 아니다.
2. LAZY·EAGER와 SQL JOIN·추가 SELECT는 서로 다른 관점이다.
3. 일반 join과 연관 상태를 함께 가져오는 fetch join을 구분한다.
4. EntityGraph는 로딩 계획이며 DTO Projection이나 SQL 한 번의 보장이 아니다.
5. to-one과 to-many는 조인 결과 행이 늘어나는 방식이 다르다.
6. 컬렉션 fetch join의 메모리 페이징은 보호 설정으로 조기에 발견한다.
7. 2단계 조회도 순서·빈 페이지·자식 총량·동시 변경의 한계를 확인해야 한다.
8. 준비 캐시를 비우고 실제 값 접근까지 포함해 결과와 SELECT 수를 함께 검증한다.

다음 확장 주제는 **Batch Fetching과 연관 조회 전략 비교**다. 이번에 끈 묶음 조회를 활성화했을 때 무엇이 달라지는지, fetch join·DTO 조회와 어떻게 선택할지 이어서 학습한다.

## 11. 복습 퀴즈

1. 글이 100개인데 작성자가 한 명이라면 추가 SELECT가 반드시 100번 생기는가?
2. EAGER로 바꾸면 N+1이 항상 사라지는가?
3. 일반 join으로 이름 조건을 검사한 뒤 작성자 이름 접근에서 다시 SQL이 나갈 수 있는 이유는 무엇인가?
4. 작성자 두 명을 요청하면서 컬렉션 조인 결과를 두 행으로 자르면 무엇이 잘못되는가?
5. 2단계 조회의 두 번째 쿼리에서 Pageable을 제거하고도 주의해야 할 점은 무엇인가?
6. 테스트에서 flush·clear·SQL 기록 초기화를 이 순서로 하는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 아니다. 같은 영속성 컨텍스트에서 이미 읽은 작성자를 재사용할 수 있다. 캐시와 조회 계획도 영향을 준다.
2. 아니다. 즉시 로딩 요구를 별도 SELECT로 충족할 수 있다.
3. 조건을 평가하기 위한 join이 연관 객체 초기화까지 요구하지는 않기 때문이다.
4. 부모 개수와 조인 행 개수가 달라 부모가 빠지거나 자식 컬렉션이 잘릴 수 있다.
5. 부모 순서 복원, 빈 ID 처리, 자식 총량, 권한·검색 범위, 두 조회 사이의 데이터 변경이다.
6. 준비 데이터를 DB에 반영하고, 캐시가 조회를 가리지 않게 한 뒤, 준비 SQL을 제외하기 위해서다.

</details>

## 12. 공식 문서로 이어서 읽기

- [Hibernate ORM Fetching](https://docs.hibernate.org/orm/7.1/userguide/html_single/#fetching): 로딩 시점과 방식, N+1·batch 조회
- [Hibernate Query Language](https://docs.hibernate.org/orm/7.1/querylanguage/html_single/): fetch join, 중복·컬렉션 조인·페이지 제한
- [Spring Data JPA 조회 계획](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html#jpa.entity-graph): Repository의 EntityGraph 적용
- [Spring Data EntityGraph API](https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/EntityGraph.html): attributePaths와 FETCH·LOAD
- [Jakarta Persistence 3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2): EntityGraph와 로딩 계약
- [Hibernate QuerySettings](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/cfg/QuerySettings.html#FAIL_ON_PAGINATION_OVER_COLLECTION_FETCH): 컬렉션 메모리 페이징 차단 설정
- [Spring Boot DataJpaTest](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html): JPA 슬라이스와 테스트 트랜잭션
