# Batch Fetching과 연관 조회 전략 비교: 지연 로딩을 묶어서 읽기

- 🎯 학습 목표: Batch Fetching이 묶는 대상을 설명하고, 쿼리 수·반환값·영속성 컨텍스트의 영향을 나누어 검증한다.
- 🧩 핵심 키워드: batch fetching, default_batch_fetch_size, @BatchSize, Session, 미초기화 프록시, 컬렉션 역할, JDBC batch
- ⭐ 중요도: ★★★★☆ — N+1을 줄이는 또 하나의 방법을 익히되, 설정 하나로 모든 조회가 최적화된다고 오해하지 않는다.
- 📝 한눈에 보는 내용: 이전 글·작성자 모델에서 묶음 조회를 켜고 끈다. 같은 데이터와 응답을 유지하면서 단건 연관·컬렉션·캐시·개별 접근을 비교한다.
- 🧱 선수 지식: LAZY, 영속성 컨텍스트, fetch join, Pageable, JPA 테스트, Java stream·record
- 🔗 이전 노트: [N+1 문제와 fetch join·EntityGraph](../18_09_14_N_Plus_One_and_Fetch_Strategies/09_14_N_Plus_One_and_Fetch_Strategies.md)

> 정리 기준일: 2026-09-16. Java 21·Spring Boot 4.1 계열의 기존 실습 프로젝트에 추가할 학습 코드다. Hibernate 공식 API와 7.1 사용자 가이드를 참고했으며 Hibernate 버전은 Boot의 의존성 관리를 따른다. Session의 배치 설정 API는 Hibernate 6.3 이상에 해당한다. 이 TIL 저장소에 실행 애플리케이션을 만든 것은 아니다. Java 컴파일·Spring 테스트를 실행하지 않았으므로 아래 쿼리 수와 실행 횟수는 예상이다.

## 1. fetch join 외에는 N+1을 줄일 방법이 없을까?

이전 노트에서는 글을 먼저 읽은 뒤 작성자 이름을 하나씩 읽으면 추가 SELECT가 발생했다. 서로 다른 작성자 다섯 명의 글을 읽는다면, 단순한 지연 조회는 글 목록 1번과 작성자 5번으로 총 6번을 예상한다.

Batch Fetching은 **아직 읽지 않은 연관 Entity나 컬렉션을 여러 개 묶어서 조회하는 Hibernate 기능**이다. 처음부터 모든 관계를 JOIN하는 대신, 지연 로딩이 필요한 순간 같은 영속성 컨텍스트의 다른 후보도 함께 읽는다. [Hibernate BatchSize API](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/annotations/BatchSize.html)를 참고한다.

```text
글 다섯 개 조회
  → A·B·C·D·E 작성자 참조를 같은 영속성 컨텍스트가 알게 됨
  → 첫 작성자의 이름 접근
  → 묶음 조회로 여러 작성자를 함께 읽음
  → 이미 읽은 나머지 작성자 이름 접근에는 추가 SELECT가 필요하지 않을 수 있음
```

예를 들어 후보가 다섯 명이고 배치 크기가 16이면, 이 단순 실습에서는 글 목록 1번과 작성자 묶음 조회 1번을 예상한다. 숫자 16은 **한 번에 최대 몇 대상을 묶을지**이지, 항상 16명을 읽으라는 뜻이 아니다.

DB 전체에서 다음 16명을 찾거나, 서로 다른 HTTP 요청을 모아서 처리하는 기능도 아니다. 현재 조회 문맥이 알고 있는 미초기화 후보가 있어야 한다. 아직 조회하지 않은 다음 페이지의 작성자를 자동으로 찾아오는 기능으로 이해하면 안 된다.

## 2. Entity 묶음과 컬렉션 묶음의 단위가 다르다

### 2.1 글 → 작성자: 작성자 Entity들을 묶는다

`Article.writer`를 따라가면 작성자 한 명을 만난다. 여러 글이 서로 다른 작성자를 가리키면, 미초기화 Writer 프록시들이 묶음 후보가 된다. 프록시는 실제 데이터가 필요할 때 로딩을 연결하는 대리 객체다.

아래는 의미를 설명하기 위한 SQL 모양이다. 실제 SQL의 별칭·매개변수 개수·IN 또는 배열 조건 표현은 Hibernate와 DB에 따라 달라질 수 있다.

```sql
-- 작성자마다 id = ? SELECT를 보내는 대신 여러 ID를 한 번에 조회하는 개념이다.
SELECT id, name
FROM fetch_writers
WHERE id IN (?, ?, ?, ?, ?);
```

글 다섯 개가 모두 같은 작성자를 참조한다면 서로 다른 작성자 후보는 한 명이다. 글 개수만으로 쿼리 수를 계산해서는 안 된다.

### 2.2 작성자 → 글 목록: 같은 역할의 컬렉션들을 묶는다

`Writer.articles`는 작성자 한 명의 글 목록이다. 컬렉션 역할이란 `Writer.articles`처럼 **어떤 Entity의 어떤 컬렉션 속성인지**를 뜻한다. 여러 작성자의 articles를 묶는 것이지, articles와 전혀 다른 컬렉션을 무작정 합치는 것이 아니다.

배치 크기가 16이면 최대 16명 작성자의 글 컬렉션을 함께 초기화할 수 있다. 각 작성자가 글 100개를 갖고 있다면 자식 행은 최대 16개가 아니라 훨씬 많을 수 있다. [Hibernate Batch Fetching 가이드](https://docs.hibernate.org/orm/7.1/userguide/html_single/#fetching-batch)를 참고한다.

```sql
-- writer_id는 부모 키다. 이 조건은 각 부모의 글을 최대 16개로 자르지 않는다.
SELECT id, title, writer_id
FROM fetch_articles
WHERE writer_id IN (?, ?, ?, ?, ?);
```

부모 페이지 크기와 컬렉션 배치 크기, 부모 한 명의 자식 개수는 각각 다른 값이다. 글이 없는 작성자는 조회 결과에 해당 자식 행이 없어도 빈 컬렉션으로 초기화된다.

## 3. 이름이 비슷한 세 설정을 구분한다

| 설정·기능 | 주로 다루는 것 | 이번 N+1과의 관계 |
| --- | --- | --- |
| `hibernate.default_batch_fetch_size` | 연관 Entity·컬렉션의 읽기 묶음 기본값 | 이번 실습 대상 |
| `@BatchSize(size = ...)` | 특정 Entity 타입·컬렉션의 읽기 묶음 | 매핑별 대안 |
| `hibernate.jdbc.batch_size` | JDBC의 여러 쓰기 statement 묶음 | 연관 SELECT를 묶는 설정이 아님 |

이름에 batch가 있다고 모두 같은 기능이 아니다. `jdbc.batch_size`를 올린 뒤 작성자 SELECT가 줄어들기를 기대하면 관찰 대상부터 어긋난다. [Hibernate FetchSettings](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/cfg/FetchSettings.html#DEFAULT_BATCH_FETCH_SIZE), [BatchSettings](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/cfg/BatchSettings.html#STATEMENT_BATCH_SIZE)를 비교한다.

### 3.1 전역 기본값의 설정 모양

다음은 기존 `application.yaml`의 `spring.jpa.properties` 아래에 병합할 수 있는 **선택적 설정 조각**이다. 같은 `spring:` 키를 중복해서 만들지 않는다. 숫자 16은 관찰하기 위한 값이지 운영 권장 정답이 아니다.

```yaml
spring: # 기존 spring 설정과 합친다.
  jpa: # JPA 설정 아래에 둔다.
    properties: # Hibernate에 그대로 전달할 속성이다.
      hibernate.default_batch_fetch_size: 16 # 연관 읽기 묶음의 기본 크기다.
```

이번 주 실습은 전역 파일을 바꾸지 않고 **새 테스트의 속성으로만 16을 지정**한다. 이전 노트의 N+1 비교 테스트는 배치 크기를 0으로 둔 자체 설정을 그대로 유지한다. 서로 다른 실험의 전제를 바꾸지 않기 위해서다.

### 3.2 @BatchSize를 붙이는 위치

Writer Entity를 여러 개 묶어서 읽고 싶다면 `Article.writer` 필드에 무작정 붙이는 것이 아니라 **대상 Entity인 Writer 타입**의 매핑을 검토한다. 컬렉션을 묶으려면 `Writer.articles`에 붙인다. 다음 두 코드는 위치 설명용 조각이며 이번 테스트에는 적용하지 않는다.

```java
// Writer.java의 import 영역에 추가하는 경우다.
import org.hibernate.annotations.BatchSize; // Hibernate 전용 매핑이며 JPA 표준 애너테이션은 아니다.

// 기존 Writer 선언 위에 붙이는 위치 예시다. 본문은 기존 클래스 그대로 둔다.
@BatchSize(size = 16) // 미초기화 Writer Entity들을 최대 16개씩 읽는 설정이다.
```

```java
// Writer.java에서 기존 articles 필드에 붙이는 대안이다. 필드를 새로 하나 더 만들지 않는다.
@OneToMany(mappedBy = "writer") // 기존 관계 매핑을 유지한다.
@BatchSize(size = 16) // 글 16개가 아니라 Writer.articles 컬렉션 최대 16개를 묶는다.
private List<Article> articles = new ArrayList<>(); // 기존 필드 선언을 이 위치에서 보여 준 것이다.
```

개별 매핑과 전역 기본값을 동시에 섞으면 어느 설정의 효과를 관찰하는지 불분명해진다. 이번에는 Entity에 `@BatchSize`를 추가하지 않고, 기본 설정과 테스트 세션 설정만 사용한다. `@BatchSize.size`는 양수여야 한다. [BatchSize의 대상과 크기 계약](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/annotations/BatchSize.html)을 확인한다.

### 3.3 테스트에서 세션 단위로 켜고 끄기

JPA의 EntityManager를 Hibernate `Session`으로 꺼내는 `unwrap()`을 사용한다. 아래는 테스트 트랜잭션 안에서 실행하는 조각이다.

```java
Session session = em.unwrap(Session.class); // JPA 표준 인터페이스 뒤의 Hibernate 세션을 얻는다.
session.setFetchBatchSize(1); // 이 API에서 0 또는 1은 묶음 조회 비활성화다.
session.setFetchBatchSize(16); // 1보다 크면 이 세션의 묶음 크기를 지정한다.
session.setFetchBatchSize(-1); // 음수는 SessionFactory의 기본 설정을 상속한다.
```

세 줄은 값의 의미를 비교하는 예시다. 실제 한 시나리오에서는 조회 **전에 하나의 값만 선택**한다. 세션별 설정은 전역 설정 파일을 수정하지 않는다. 일반 Service에 실험용 설정 변경을 섞지 않고 아래 테스트에서만 사용한다. [Session.setFetchBatchSize API](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/Session.html#setFetchBatchSize(int))를 참고한다.

## 4. 이전 실습에서 무엇을 유지하고 추가하는가?

[15번 페이지네이션 노트](../15_09_11_Pagination_and_Sorting/09_11_Pagination_and_Sorting.md)의 Java 21·Maven·H2 프로젝트를 사용한다. [18번 노트](../18_09_14_N_Plus_One_and_Fetch_Strategies/09_14_N_Plus_One_and_Fetch_Strategies.md)의 Writer·Article·WriterArticles·ArticleQueryRepository와 [17번 노트](../17_09_13_JPA_DTO_Projection/09_13_JPA_DTO_Projection.md)의 테스트 전용 SqlCapture를 수정 없이 재사용한다.

```text
src/main/java/com/example/pagingstudy/fetchstudy/
  Writer.java                  # 유지: @BatchSize를 추가하지 않음
  Article.java                 # 유지: LAZY to-one
  WriterArticles.java          # 유지: id·name·titles DTO
  ArticleQueryRepository.java  # 유지: plain·fetched 비교
  WriterQueryRepository.java   # 유지: 이전 2단계 조회
  WriterQueryService.java      # 유지: 이전 기능은 교체하지 않음
  WriterBatchRepository.java   # 추가: 부모 Entity만 페이지 조회
  WriterBatchService.java      # 추가: LAZY 컬렉션을 DTO로 변환
src/test/java/com/example/pagingstudy/
  SqlCapture.java              # 유지: SQL 준비 시점 관찰
src/test/java/com/example/pagingstudy/fetchstudy/
  FetchStrategyJpaTest.java    # 유지: 이전 배치 비활성화 실험
  BatchFetchingJpaTest.java    # 추가: 이번 묶음 조회 비교
```

기존 data-jpa·H2·test·data-jpa-test 의존성을 유지한다. 이번에는 Controller나 새 시작 클래스를 만들지 않으며 운영 DB에 설정·스키마 변경을 적용하는 작업도 아니다. 아래 세 파일은 전체 코드다.

## 5. 부모 페이지를 읽고 컬렉션을 DTO로 바꾼다

### 5.1 WriterBatchRepository.java

```java
package com.example.pagingstudy.fetchstudy; // 기존 Writer 모델을 재사용한다.

import java.util.List; // 전체 개수 없이 목록만 반환한다.
import org.springframework.data.domain.Pageable; // 부모 페이지의 크기·위치를 제한한다.
import org.springframework.data.jpa.repository.Query; // 컬렉션 join 없는 조회를 지정한다.
import org.springframework.data.repository.Repository; // 읽기에 필요한 메서드만 공개한다.

public interface WriterBatchRepository extends Repository<Writer, Long> { // 기존 Repository와 별도 비교용이다.
    @Query("select w from Writer w order by w.id") // 부모 행을 고유 ID 순으로 정렬한다.
    List<Writer> page(Pageable pageable); // 컬렉션을 fetch join하지 않고 부모만 제한한다.
}
```

이 쿼리에는 `articles` join이 없으므로 부모를 고르기 전에 자식 수만큼 행이 늘어나는 문제가 없다. 반환 타입도 `Page`가 아니라 `List`여서 전체 개수 count를 요청하지 않는다. 다음 단계의 컬렉션 접근 비용은 별도로 관찰해야 한다.

### 5.2 WriterBatchService.java

```java
package com.example.pagingstudy.fetchstudy; // 비교용 Service를 기존 Service와 분리한다.

import java.util.Comparator; // 각 부모의 글 순서를 명확히 한다.
import java.util.List; // 공개 DTO 목록의 타입이다.
import org.springframework.data.domain.PageRequest; // 부모 페이징에 사용한다.
import org.springframework.stereotype.Service; // 실제 테스트에서 주입한다.
import org.springframework.transaction.annotation.Transactional; // 조회·컬렉션 접근·DTO 변환을 같은 경계에 둔다.

@Service // 기존 WriterQueryService를 교체하지 않는다.
public class WriterBatchService { // ID 재조회 없이 부모 Entity를 먼저 읽는 비교 방식이다.
    private final WriterBatchRepository repository; // 새 부모 조회 Repository다.

    public WriterBatchService(WriterBatchRepository repository) { // 생성자 주입으로 연결한다.
        this.repository = repository; // 조회 메서드에서 사용한다.
    }

    @Transactional(readOnly = true) // 지연 로딩이 가능한 범위 안에서 값으로 변환한다.
    public List<WriterArticles> list(int page, int size) { // 기존 비교 예제와 같은 입력 범위다.
        if (page < 0 || page > 1000 || size < 1 || size > 100) { // 무제한 페이지 요청을 받지 않는다.
            throw new IllegalArgumentException("page는 0~1000, size는 1~100이어야 합니다."); // 조회 전에 거부한다.
        }
        List<Writer> writers = repository.page(PageRequest.of(page, size)); // 부모들을 한꺼번에 관리 상태로 읽는다.
        return writers.stream().map(writer -> new WriterArticles( // 각 부모를 공개 값으로 바꾼다.
                writer.getId(), // 페이지의 식별자와 순서를 유지한다.
                writer.getName(), // 부모 쿼리에서 읽은 이름이다.
                writer.getArticles().stream() // 이 접근에서 컬렉션 묶음 조회가 시작될 수 있다.
                        .sorted(Comparator.comparing(Article::getId)) // 자식 순서는 부모 정렬과 별도로 정한다.
                        .map(Article::getTitle).toList() // 관리 Entity 대신 제목 문자열만 반환한다.
        )).toList(); // 빈 부모 목록이면 컬렉션 접근도 일어나지 않는다.
    }
}
```

코드에 “배치 조회 메서드”를 직접 호출하지 않았다는 점이 중요하다. 같은 컬렉션 접근도 설정·후보 상태에 따라 개별 SELECT 또는 묶음 SELECT로 처리된다. 따라서 메서드 이름만 보고 비용을 알 수 없고 테스트에서 결과와 쿼리를 함께 봐야 한다.

이전 2단계 방식은 부모 ID를 읽은 뒤 명시적인 IN 조건으로 부모와 컬렉션을 fetch했다. 이번 방식은 부모 Entity를 읽고, 이후 필요한 컬렉션 조회를 Hibernate가 묶도록 한다. 둘 다 SQL 두 번처럼 보여도 조회 컬럼·후보 범위·자식 수가 같다는 뜻은 아니다.

## 6. 같은 조건에서 묶음 크기만 바꾸어 검증한다

### 6.1 왜 Session·캐시·관찰 범위를 통제하는가?

테스트의 전역 기본값은 16이다. 비교 테스트에서는 세션 크기를 1과 16으로 바꾸되, 데이터·정렬·응답은 동일하게 유지한다. 크기 1은 이 API에서 묶음 비활성화다.

2차 캐시·쿼리 캐시·subselect fetching은 끈다. Subselect fetching은 부모 조회 조건을 이용해 컬렉션을 가져오는 별도 방식이며 이번 batch 실험과 섞지 않는다. 새 데이터를 저장한 뒤 flush·clear를 수행해 저장 과정의 1차 캐시도 비운다.

이후 SELECT 기록만 초기화하고, **연관 값 접근과 DTO 변환이 끝날 때까지** 측정한다. 테스트는 JPA 트랜잭션에서 실행되고 기본적으로 rollback된다. [DataJpaTest API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html)를 참고한다.

### 6.2 BatchFetchingJpaTest.java

```java
package com.example.pagingstudy.fetchstudy; // 기존 모델과 같은 패키지의 새 테스트다.

import com.example.pagingstudy.SqlCapture; // 17번 노트의 테스트 도구를 가져온다.
import java.util.ArrayList; // 개별 접근 실험에 사용할 ID·이름 목록을 만든다.
import java.util.List; // 결과를 검증한다.
import jakarta.persistence.EntityManager; // 데이터 준비와 영속성 컨텍스트 제어에 사용한다.
import org.hibernate.Hibernate; // 연관 프록시가 초기화됐는지 조회 없이 확인한다.
import org.hibernate.Session; // 이 테스트에서만 세션별 배치 크기를 바꾼다.
import org.junit.jupiter.api.AfterEach; // 관찰 기록을 정리한다.
import org.junit.jupiter.api.Test; // 일반 테스트 네 개를 선언한다.
import org.junit.jupiter.params.ParameterizedTest; // 설정별로 같은 검증을 반복한다.
import org.junit.jupiter.params.provider.CsvSource; // 배치 크기와 예상 SELECT 수를 전달한다.
import org.springframework.beans.factory.annotation.Autowired; // 실제 JPA 구성 요소를 주입한다.
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest; // Boot 4 계열 JPA 슬라이스다.
import org.springframework.context.annotation.Import; // 실제 Service를 포함한다.
import static org.assertj.core.api.Assertions.assertThat; // 값·개수·초기화 상태를 검증한다.
import static org.assertj.core.api.Assertions.assertThatThrownBy; // 잘못된 입력의 거부를 검증한다.

@DataJpaTest(properties = { // 다른 테스트 클래스의 배치 설정은 변경하지 않는다.
        "spring.jpa.properties.hibernate.default_batch_fetch_size=16", // 이번 테스트의 기본 묶음 크기다.
        "spring.jpa.properties.hibernate.use_subselect_fetch=false", // 다른 컬렉션 묶음 방식을 배제한다.
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false", // 이전 세션 캐시의 영향을 배제한다.
        "spring.jpa.properties.hibernate.cache.use_query_cache=false", // 쿼리 결과 캐시도 끈다.
        "spring.jpa.properties.hibernate.use_sql_comments=false", // 단순 SELECT 분류를 유지한다.
        "spring.jpa.properties.hibernate.session_factory.statement_inspector=com.example.pagingstudy.SqlCapture" // 이전 관찰기를 사용한다.
})
@Import(WriterBatchService.class) // DTO 변환 과정의 실제 컬렉션 접근을 검사한다.
class BatchFetchingJpaTest { // 초기 데이터 스크립트·추가 fetch 매핑이 없는 H2 실습이다.
    @Autowired // 테스트 트랜잭션에 연결된 EntityManager다.
    private EntityManager em; // flush·clear와 단건 조회를 실행한다.
    @Autowired // 이전 노트의 일반 조회·fetch join을 재사용한다.
    private ArticleQueryRepository articles; // Mockito 대역으로 교체하지 않는다.
    @Autowired // 부모 페이지와 컬렉션 DTO를 실제로 만든다.
    private WriterBatchService service; // 새 비교 Service다.

    @AfterEach // 테스트 실패 시에도 SQL 기록을 제거한다.
    void cleanUp() { SqlCapture.clear(); } // ThreadLocal 기록이 다음 실험에 섞이지 않게 한다.

    private Writer saveWriter(String name, int count) { // 작성자와 지정한 수의 글을 만든다.
        Writer writer = new Writer(name); // Writer는 이전 모델 그대로다.
        em.persist(writer); // 부모를 먼저 저장한다.
        for (int i = 1; i <= count; i++) { // cascade가 없으므로 자식도 직접 저장한다.
            em.persist(writer.addArticle(name + "-" + i)); // 양방향 참조를 맞추고 저장한다.
        }
        return writer; // ID를 응답 검증에 사용한다.
    }

    private List<Long> fiveWritersWithOneArticle() { // 각 글이 다른 작성자를 가리키게 만든다.
        List<Long> ids = new ArrayList<>(); // 개별 조회 실험용 글 ID다.
        for (String name : List.of("A", "B", "C", "D", "E")) { // 정해진 순서의 다섯 작성자다.
            Writer writer = saveWriter(name, 1); // 글도 한 개씩 준비한다.
            ids.add(writer.getArticles().get(0).getId()); // 저장 직후 ID를 기록한다. 아직 관찰 전이다.
        }
        return ids; // 생성된 실제 ID를 사용하고 1부터 시작한다고 가정하지 않는다.
    }

    private void observe(int batchSize) { // 후보를 읽기 전에 실험 조건을 정한다.
        em.flush(); // 준비 데이터를 DB에 반영한다.
        em.clear(); // 준비 중에 관리하던 Entity·컬렉션을 분리한다.
        em.unwrap(Session.class).setFetchBatchSize(batchSize); // 1은 끄기, 16은 켜기, -1은 기본값 상속이다.
        SqlCapture.clear(); // 그 뒤의 SELECT만 센다.
    }

    private List<String> names(List<Article> rows) { // Repository 반환 이후의 지연 로딩까지 포함한다.
        return rows.stream().map(row -> row.getWriter().getName()).toList(); // 작성자 상태가 없으면 여기서 읽는다.
    }

    @ParameterizedTest // 같은 데이터·접근 순서를 두 설정으로 실행한다.
    @CsvSource({"1, 6", "16, 2"}) // 글 1회 + 작성자 5회, 또는 글 1회 + 묶음 1회다.
    void toOneBatchKeepsNames(int batchSize, int expectedSelects) {
        fiveWritersWithOneArticle(); // 서로 다른 미조회 작성자 다섯 명을 만든다.
        observe(batchSize); // 설정을 바꾸고 캐시를 비운 뒤 측정한다.
        List<Article> rows = articles.plain(); // 글 목록을 먼저 전부 읽어 후보 참조를 알게 한다.
        assertThat(SqlCapture.selects()).hasSize(1); // 아직 작성자 이름에는 접근하지 않았다.
        assertThat(names(rows)).containsExactly("A", "B", "C", "D", "E"); // 설정이 달라도 값·순서는 같아야 한다.
        assertThat(SqlCapture.selects()).hasSize(expectedSelects); // 이번 통제된 조건의 예상 비용을 확인한다.
    }

    @ParameterizedTest // 컬렉션 묶음도 같은 결과를 유지하는지 비교한다.
    @CsvSource({"1, 6", "16, 2"}) // 부모 1회 + 컬렉션 5회, 또는 부모 1회 + 묶음 1회다.
    void collectionBatchKeepsAllChildren(int batchSize, int expectedSelects) {
        Writer a = saveWriter("A", 2); // 글 두 개를 가진 작성자다.
        Writer b = saveWriter("B", 0); // 빈 컬렉션도 후보이며 결과에서 사라지면 안 된다.
        Writer c = saveWriter("C", 1); // 글 한 개다.
        Writer d = saveWriter("D", 3); // 부모 수보다 많은 자식이 나올 수 있다.
        Writer e = saveWriter("E", 1); // 첫 페이지의 총 자식은 일곱 개다.
        Writer f = saveWriter("F", 1); // 첫 페이지 밖의 부모도 두어 실제 경계를 검증한다.
        observe(batchSize); // 저장 캐시를 제거한다.
        assertThat(service.list(0, 5)).containsExactly( // 부모 다섯 명의 페이지를 조회한다.
                new WriterArticles(a.getId(), "A", List.of("A-1", "A-2")), // 전체 자식과 자식 순서를 확인한다.
                new WriterArticles(b.getId(), "B", List.of()), // 글이 없으면 빈 목록이다.
                new WriterArticles(c.getId(), "C", List.of("C-1")), // 부모 순서도 유지한다.
                new WriterArticles(d.getId(), "D", List.of("D-1", "D-2", "D-3")), // 자식이 잘리지 않아야 한다.
                new WriterArticles(e.getId(), "E", List.of("E-1")) // 마지막 부모다.
        );
        assertThat(SqlCapture.selects()).hasSize(expectedSelects); // DTO 변환이 끝난 뒤에 센다.
        observe(batchSize); // 다음 페이지도 이전 후보·캐시 없이 확인한다.
        assertThat(service.list(1, 5)).containsExactly(new WriterArticles(f.getId(), "F", List.of("F-1"))); // 다음 부모가 누락되거나 중복되면 안 된다.
        assertThat(SqlCapture.selects()).hasSize(2); // 부모 한 명이면 두 설정 모두 부모 1회·컬렉션 1회다.
    }

    @Test // 처음 한 명을 읽을 때 다른 후보도 읽을 수 있고 재접근은 캐시를 사용한다.
    void batchCanInitializeOtherCandidatesAndReuseThem() {
        fiveWritersWithOneArticle(); // 같은 영속성 컨텍스트에 후보 다섯 명을 둘 준비다.
        observe(-1); // 테스트 속성의 기본값 16을 상속한다.
        List<Article> rows = articles.plain(); // 모든 작성자 참조를 먼저 확보한다.
        assertThat(rows).allSatisfy(row -> assertThat(Hibernate.isInitialized(row.getWriter())).isFalse()); // 아직 작성자 상태는 읽지 않았다.
        assertThat(rows.get(0).getWriter().getName()).isEqualTo("A"); // 첫 번째 이름만 직접 요청한다.
        assertThat(SqlCapture.selects()).hasSize(2); // 글 SELECT와 작성자 묶음 SELECT다.
        assertThat(rows).allSatisfy(row -> assertThat(Hibernate.isInitialized(row.getWriter())).isTrue()); // 이 조건에서는 나머지 후보도 초기화된다.
        assertThat(names(rows)).containsExactly("A", "B", "C", "D", "E"); // 같은 객체들의 값을 다시 읽는다.
        assertThat(SqlCapture.selects()).hasSize(2); // 이미 초기화된 참조를 읽는 것은 SQL을 추가하지 않는다.
    }

    @Test // 배치 크기가 커도 후보를 함께 확보하지 못하면 효과가 사라진다.
    void isolatedReadsCannotShareBatchCandidates() {
        List<Long> ids = fiveWritersWithOneArticle(); // ID 목록은 관찰 전에 준비한다.
        observe(16); // 묶음 조회가 켜져 있는 상태다.
        List<String> actual = new ArrayList<>(); // 순서대로 얻은 이름만 저장한다.
        for (Long id : ids) { // 하나의 글만 조회·접근하고 캐시를 비우는 대조 실험이다.
            Article article = em.find(Article.class, id); // 글 SELECT가 매번 한 번 발생한다.
            actual.add(article.getWriter().getName()); // 현재 알려진 작성자 후보도 한 명뿐이다.
            em.clear(); // 다음 반복에서 이전 후보·캐시를 공유하지 못하게 한다.
        }
        assertThat(actual).containsExactly("A", "B", "C", "D", "E"); // 값은 같아도 조회 비용은 다를 수 있다.
        assertThat(SqlCapture.selects()).hasSize(10); // 글 5회 + 작성자 5회다.
    }

    @Test // fetch join과 batch를 SQL 수만으로 같은 기능이라 부르지 않는다.
    void explicitFetchJoinStillLoadsInOneSelect() {
        fiveWritersWithOneArticle(); // 동일한 다섯 글을 사용한다.
        observe(16); // batch가 켜져 있어도 fetch join은 이미 작성자를 읽는다.
        assertThat(names(articles.fetched())).containsExactly("A", "B", "C", "D", "E"); // 값 접근까지 수행한다.
        assertThat(SqlCapture.selects()).hasSize(1); // 이 to-one 예제에서는 연관 재조회가 없다.
    }

    @Test // 빈 페이지와 입력 거부에서 불필요한 컬렉션 조회가 없어야 한다.
    void emptyPageAndInvalidSizeDoNotLoadCollections() {
        saveWriter("A", 1); // DB는 비어 있지 않지만 요청 페이지는 비게 만든다.
        observe(-1); // 기본 크기 16으로 조회한다.
        assertThat(service.list(1, 5)).isEmpty(); // 한 명만 있으므로 두 번째 페이지는 비어 있다.
        assertThat(SqlCapture.selects()).hasSize(1); // 부모 조회만 하고 컬렉션은 읽지 않는다.
        SqlCapture.clear(); // 입력 거부 경로의 SQL만 별도로 관찰한다.
        assertThatThrownBy(() -> service.list(0, 101)).isInstanceOf(IllegalArgumentException.class); // 상한을 넘긴 요청이다.
        assertThat(SqlCapture.selects()).isEmpty(); // 잘못된 크기는 DB 전에 거부한다.
    }
}
```

`Hibernate.isInitialized()`는 초기화 여부를 확인하는 도구다. 이름 getter를 먼저 호출하고 초기화 여부를 검사하면 관찰하려던 상태를 스스로 바꾸게 된다. 위 테스트는 상태 확인과 값 접근을 구분한다. [Hibernate 초기화 확인 API](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/Hibernate.html#isInitialized(java.lang.Object))를 참고한다.

개별 접근 실험의 `clear()`는 일부러 후보 공유를 막기 위한 대조 조건이다. 운영 코드를 무조건 이렇게 작성하거나, 대량 처리에서 필요한 clear를 모두 제거하라는 뜻이 아니다. flush 전에 clear하면 변경을 잃을 수도 있으므로 읽기 성능 실험의 조건과 쓰기 작업을 섞지 않는다.

### 6.3 실행 위치와 예상 결과

아래 명령은 TIL 루트가 아니라 **15~18번 예제를 구성한 Maven 실습 프로젝트 루트**에서 실행한다.

```powershell
.\mvnw.cmd dependency:tree "-Dincludes=org.hibernate.orm:hibernate-core" # Boot가 관리하는 실제 Hibernate 버전을 확인한다.
.\mvnw.cmd "-Dtest=BatchFetchingJpaTest" test # 매개변수 반복을 포함해 총 8회 실행을 예상한다.
.\mvnw.cmd "-Dtest=FetchStrategyJpaTest,BatchFetchingJpaTest" test # 이전 7회와 이번 8회를 합쳐 15회 실행을 예상한다.
.\mvnw.cmd test # 기존 Book·커서·Projection까지 함께 회귀 검사한다.
```

이번 클래스는 매개변수 테스트 두 개가 각각 두 번 실행되고, 일반 테스트 네 개가 한 번씩 실행된다. 따라서 메서드는 여섯 개지만 실행은 **8회**다.

| 관찰 조건 | 예상 SELECT 수 | 함께 검증할 내용 |
| --- | ---: | --- |
| 서로 다른 작성자 5명, 배치 비활성화 | 6 | 이름·순서 동일 |
| 같은 후보 5명, 배치 크기 16 | 2 | 묶음 조회 뒤 이름 재접근에 추가 SQL 없음 |
| 작성자 5명과 컬렉션, 배치 비활성화 | 6 | 빈 컬렉션 포함·자식 총 7개 |
| 같은 컬렉션 후보 5개, 배치 크기 16 | 2 | 부모와 자식 순서·전체 자식 유지 |
| 글 한 개씩 조회하고 매번 clear | 10 | 큰 배치 크기만으로 후보를 만들 수 없음 |
| 같은 데이터의 to-one fetch join | 1 | batch와 다른 조회 형태 |
| 비어 있는 부모 페이지 | 1 | 컬렉션 조회 없음 |

이 표는 H2·캐시 비활성화·추가 매핑 없음·같은 순서로 모든 후보 접근이라는 전제의 예상이다. 실패하면 먼저 실제 SQL, 적용된 크기, 명시적 `@BatchSize` 유무, fetch 계획, 후보가 등록되는 시점을 확인한다. 숫자를 맞추려고 캐시나 다른 로딩 방식을 임의로 켜지 않는다.

## 7. 배치 크기만 보고 쿼리 수를 계산하면 안 되는 이유

다섯 후보를 모두 읽고 크기 2로 묶는 단순 모델에서는 `1 + ceil(5 / 2) = 4`회를 떠올릴 수 있다. ceil은 나눗셈 결과를 올림하는 연산이다. 목록 1회와 묶음 3회라는 예상이다.

하지만 이 식은 후보가 함께 있고, 같은 타입·역할이며, 필요한 대상을 모두 읽고, 다른 캐시·조회 전략이 개입하지 않는 단순화다. 실제 요청의 고정 공식이 아니다. 후보 중 일부만 사용하면 불필요한 대상도 미리 읽을 수 있고, 중간에 세션이 끊기면 묶일 대상이 줄어든다.

명시적인 잠금도 별도 검토 대상이다. Hibernate 가이드는 잠금 모드가 연관 프록시의 batch 초기화에 영향을 줄 수 있다고 설명한다. 이번 예제에는 잠금 API를 사용하지 않았다. 잠금이 있는 조회에 결과를 그대로 일반화하지 않는다. [Batch Fetching과 잠금 주의점](https://docs.hibernate.org/orm/7.1/userguide/html_single/#fetching-batch)을 확인한다.

또한 SQL의 `?` 개수만 세어 실제 로딩 대상 수라고 판단하지 않는다. DB별 배열 바인딩이나 쿼리 형태 차이가 있으므로 SQL과 초기화 상태·반환 결과를 함께 확인한다. SqlCapture는 SQL 준비를 관찰할 뿐 전송 바이트·실제 DB 실행 시간·메모리 사용량을 측정하지 않는다.

## 8. fetch join·DTO·명시적 2단계 조회와 어떻게 고를까?

| 상황 | 우선 검토할 방식 | 확인할 한계 |
| --- | --- | --- |
| 글 제목·작성자 이름 값만 필요 | 명시적 DTO Projection | 필요한 컬럼과 정렬 키 유지 |
| 글 Entity와 작성자 상태가 함께 필요 | to-one fetch join·EntityGraph | 실제 SQL과 응답 대상 유지 |
| 부모 페이지의 여러 LAZY 컬렉션 접근 | Batch Fetching | 같은 역할의 후보·접근 범위·자식 총량 |
| 선택한 부모 ID 집합의 컬렉션을 명시적으로 읽음 | 부모 ID 페이지 → fetch 조회 | 순서 복원·동시 변경·자식 총량 |

앞 노트의 [DTO Projection](../17_09_13_JPA_DTO_Projection/09_13_JPA_DTO_Projection.md)은 읽을 값의 모양을 정한다. 이번 기능은 연관 로딩을 묶는 방법이다. 둘은 같은 응답을 만들 수 있어도 관리 Entity를 만드는지, 어떤 컬럼을 가져오는지, 언제 조회하는지가 다르다.

전역 크기를 크게 잡으면 더 많은 데이터를 먼저 읽어 메모리를 쓸 수 있다. 실제 화면에서 필요한 범위, DB의 매개변수 제약, 자식 개수 분포를 보고 비교한다. **SQL 2회가 SQL 3회보다 언제나 빠르다**고 결론 내릴 수는 없다.

Batch Fetching도 작성자 한 명의 글 수를 제한하지 않는다. 수만 개 글을 가진 작성자가 있다면 자식 목록을 별도 페이지로 나누거나 개수·미리보기만 반환하는 API가 필요할 수 있다. 여러 SELECT 사이의 데이터 일관성도 `readOnly = true`만으로 동일한 스냅샷이 보장되는 것은 아니다.

## 9. 자주 틀리는 부분

| 증상·오해 | 원인 후보 | 먼저 확인할 것 |
| --- | --- | --- |
| jdbc.batch_size를 바꿨는데 SELECT가 그대로다 | 쓰기 배치와 읽기 배치를 혼동 | 정확한 속성 이름 |
| 크기 16이면 글이 최대 16개라 생각한다 | Entity·컬렉션 후보 수와 자식 행 수 혼동 | 부모별 실제 자식 개수 |
| 설정했는데 여전히 개별 조회가 많다 | 후보가 함께 있지 않음·설정 덮어쓰기 | 세션 경계·개별 조회 루프·매핑 |
| 한 명만 읽었는데 다른 작성자도 초기화됐다 | 묶음 후보를 함께 읽음 | 실제로 필요한 접근 범위 |
| 저장 직후 테스트에서 SQL이 너무 적다 | 준비 데이터가 1차 캐시에 남음 | flush 후 clear·관찰 시작점 |
| Repository까지만 세니 항상 SQL 한 번이다 | DTO 변환의 LAZY 접근을 놓침 | 값 접근이 끝난 시점의 기록 |

## 10. 핵심 정리와 다음 학습

1. Batch Fetching은 같은 영속성 컨텍스트의 미조회 연관 대상을 묶어 읽는다.
2. Entity 배치와 컬렉션 배치는 묶는 단위가 다르다.
3. 컬렉션 배치 크기는 자식 행 수나 응답 크기의 상한이 아니다.
4. 읽기 batch 설정과 JDBC 쓰기 batch 설정을 구분한다.
5. 큰 크기만 지정해도 후보가 분리되어 있으면 효과가 작을 수 있다.
6. 일부 대상만 필요해도 다른 후보를 함께 초기화할 수 있다.
7. 결과·순서·빈 컬렉션을 유지하는지 확인한 뒤 쿼리 수를 비교한다.
8. 최종 선택에는 전송량·메모리·실행 계획·실제 응답 시간이 필요하다.

다음 확장 주제는 [인덱스와 실행 계획으로 조회 병목 확인하기](../20_09_17_Indexes_and_Execution_Plans/09_17_Indexes_and_Execution_Plans.md)다. 쿼리 수를 줄인 뒤에도 느린 이유를 DB가 행을 찾고 정렬하는 과정에서 살펴본다.

## 11. 복습 퀴즈

1. 배치 크기가 16인데 현재 세션에 작성자 후보가 한 명뿐이라면 무엇이 묶이는가?
2. `Writer.articles`에 크기 16을 지정하면 글이 최대 16개만 조회되는가?
3. Writer 프록시를 묶는 애너테이션은 대상 Entity와 컬렉션 중 어디에 붙이는가?
4. 같은 값 접근 두 번째에 SELECT가 없다는 사실이 SQL 쿼리 결과 캐시를 켰다는 뜻인가?
5. 글을 하나씩 조회·접근·clear하는 실험이 큰 배치 크기에서도 10회를 예상하는 이유는 무엇인가?
6. fetch join 1회와 batch 조회 2회 중 어느 쪽이 항상 더 좋은가?

<details>
<summary>정답과 해설</summary>

1. 함께 묶을 다른 후보가 없다. 크기는 후보를 생성하거나 DB 전체를 검색하는 설정이 아니다.
2. 아니다. 최대 16개 부모의 해당 컬렉션을 묶는 것이며 각 컬렉션의 자식 행은 훨씬 많을 수 있다.
3. Writer Entity 타입이다. Writer.articles 컬렉션에 붙이는 경우는 여러 글 컬렉션을 묶는 별도 목적이다.
4. 아니다. 같은 영속성 컨텍스트에서 이미 초기화된 Entity를 다시 읽었을 수 있다. 예제는 쿼리 캐시를 끈다.
5. 매 반복에서 글 조회 한 번과 작성자 조회 한 번이 발생하고, 다른 미조회 후보를 함께 확보하지 못하기 때문이다.
6. 항상 더 좋은 쪽은 없다. 필요한 결과, 조인 행 증가, 컬럼·전송량·메모리와 실제 실행 비용을 비교한다.

</details>

## 12. 공식 문서로 이어서 읽기

- [Hibernate BatchSize API](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/annotations/BatchSize.html): 대상 Entity·컬렉션과 최대 묶음 크기
- [Hibernate FetchSettings](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/cfg/FetchSettings.html): 기본 batch·subselect 설정
- [Hibernate Session](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/Session.html#setFetchBatchSize(int)): 세션별 설정과 비활성화·상속 규칙
- [Hibernate ORM Batch Fetching](https://docs.hibernate.org/orm/7.1/userguide/html_single/#fetching-batch): 컬렉션 묶음 조회와 잠금 주의점
- [Hibernate JDBC BatchSettings](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/cfg/BatchSettings.html): 쓰기 statement 배치와의 구분
- [Hibernate 초기화 상태 API](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/Hibernate.html#isInitialized(java.lang.Object)): 관찰을 위한 초기화 확인
- [Spring Boot DataJpaTest](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html): JPA 슬라이스·기본 rollback
