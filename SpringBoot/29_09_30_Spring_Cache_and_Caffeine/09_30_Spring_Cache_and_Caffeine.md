# Spring Cache와 Caffeine: 반복 조회를 줄이고 최신성의 경계 정하기

- 🎯 글의 목표: 캐시 hit·miss와 키 설계를 설명하고, Spring Boot에 Caffeine을 연결해 조회·만료·무효화의 실행 흐름을 구분한다.
- 🧩 핵심 키워드: Spring Cache, CacheManager, Caffeine, Cache Key, Hit/Miss, TTL, Eviction, `@Cacheable`, `@CacheEvict`, `sync`
- ⭐ 중요도: ★★★★★ — 조회 비용을 줄이는 대신 오래된 값을 반환할 수 있으므로 성능과 정확성의 기준을 함께 정해야 한다.
- 📝 한눈에 보는 내용: 상품 이름을 반복 조회하는 상황에서 출발해 캐시 계층·키·설정을 익힌다. 주석을 붙인 상품 예제로 조회와 수정 후 삭제를 연결하고, 만료·동시 요청·트랜잭션·여러 서버·테스트 범위를 살펴본다.
- 🔗 관련 주제: [이전 노트 — Bulkhead·Rate Limiter](../28_09_29_Bulkhead_and_Rate_Limiting/09_29_Bulkhead_and_Rate_Limiting.md), [IoC·DI·Bean](../02_08_26_Spring_IoC_DI_and_Bean/08_26_Spring_IoC_DI_and_Bean.md), [트랜잭션과 rollback](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md), [테스트 전략](../10_09_06_Testing_Strategy/09_06_Testing_Strategy.md)
- 🧱 선수 지식: Java 메서드·record·예외·Map, Spring Bean과 생성자 주입, 프록시를 거치는 호출, commit·rollback

> 기준일: 2026-09-30. Java 21의 기존 Spring Boot 프로젝트에 추가하는 예제다. 조사한 Spring Boot 문서의 stable 목록은 4.1.1, Spring Framework 문서·API 표시는 7.0.9다. 두 문서 표시는 각각의 확인 범위이며 임의로 의존성 버전을 혼합하라는 뜻이 아니다. Caffeine은 해당 프로젝트의 Boot 의존성 관리 버전을 사용한다. 현재 PATH에서 Java·javac·Maven·Gradle을 찾지 못해 컴파일·Spring 실행·JUnit 검사는 수행하지 않았다. 본문의 결과는 예상 동작이며 문서 정적 검사와 구분한다.

## 1. 들어가며

같은 상품의 이름을 1초에 100번 조회한다고 생각해 보자. 매번 외부 API나 DB에서 읽는다면 결과가 같아도 조회 비용은 반복된다. 이전 노트의 Bulkhead와 Rate Limiter는 들어갈 작업 수를 제한했지만, 조회 자체를 생략하지는 않았다.

이번에는 **이미 얻은 조회 결과를 잠시 재사용하는 캐시**를 배운다. 상품 이름처럼 짧은 지연을 허용할 수 있는 표시 정보와, 재고 차감처럼 현재 상태를 기준으로 판단해야 하는 업무를 구분하는 것이 출발점이다. 이름이 잠시 예전 값인 문제와 품절 상품을 판매하는 문제는 허용할 수 있는 결과가 다르다.

범위는 한 애플리케이션 안의 로컬 캐시다. Redis 설치나 분산 무효화 구현은 다음 학습으로 남기고, 먼저 언제 원본 조회를 생략하며 저장된 값을 언제 버리는지 설명할 수 있도록 정리한다.

## 2. 핵심 개념 정리

```text
호출자 → Spring 캐시 프록시 → 캐시 이름 + 키로 조회
                            ├─ hit  → 저장된 결과 반환: 조회 메서드 본문 생략
                            └─ miss → 원본 조회 → 결과 저장 → 반환

원본 수정 성공 → 해당 키 무효화 → 다음 조회에서 다시 읽기
                           └─ DB라면 메서드 성공과 commit 시점도 구분
```

이 흐름에서 Spring Cache는 캐시 작업의 공통 규칙을, CacheManager는 사용할 캐시를 찾는 역할을 맡는다. Caffeine은 이번 예제에서 실제 값을 보관하는 로컬 구현이다.

| 판단할 질문 | 연결할 개념 | 본문 위치 |
| --- | --- | --- |
| 어떤 조회를 생략할 수 있는가? | 읽기 결과 재사용·hit/miss | 3.1 |
| 두 요청이 같은 결과를 원하는가? | 캐시 이름·키·사용자 경계 | 3.2 |
| 어떤 저장소와 한도를 사용하는가? | Boot 자동 구성·Caffeine 설정 | 3.3 |
| 애너테이션이 어디에서 실행되는가? | 조회·수정·프록시 | 3.4–3.5 |
| 얼마나 오래 재사용하고 변경을 어떻게 반영하는가? | 만료·무효화·commit·여러 서버 | 3.6–3.7 |
| 동시에 비거나 장애가 나면 어떻게 되는가? | 같은 키 로딩·원본 보호·관찰·검증 | 3.8–3.9 |

## 3. 본문 정리

### 3.1 캐시는 원본 대신 잠시 재사용하는 조회 결과다

**캐시(cache)**는 다시 구하는 비용을 줄이려고 저장해 둔 값이다. 캐시에 사용할 수 있는 값이 있으면 **hit(적중)**, 없거나 만료되었으면 **miss(미적중)**라고 한다. 상품 ID 1의 이름을 처음 읽으면 miss이고, 같은 결과가 유효할 때 다시 요청하면 hit이 될 수 있다.

**Spring Cache 추상화**는 저장 기술마다 다른 API를 조회·저장·삭제의 공통 계약으로 감싼다. 추상화 자체가 데이터를 보관하는 것은 아니다. **CacheManager**는 `productViews` 같은 이름으로 캐시를 제공하고, **Caffeine**은 JVM 메모리에 키와 값을 보관한다. JVM은 Java 프로그램이 실행되는 환경이며, 서버 프로세스마다 별도 메모리를 갖는다. [공식 캐시 개요](https://docs.spring.io/spring-framework/reference/integration/cache.html), [Boot의 저장소 구성](https://docs.spring.io/spring-boot/reference/io/caching.html)

쉽게 말하면 애너테이션은 “이 결과를 재사용하자”라는 규칙이고, CacheManager는 보관함을 찾으며, Caffeine은 실제 보관함이다. 이름이 같은 로컬 보관함을 서버 A·B에 만들더라도 하나의 공유 보관함이 되지는 않는다. 프로세스가 재시작되면 로컬에 보관하던 값도 사라진다.

이 노트에서는 **cache-aside 형태의 읽기 흐름**을 사용한다. 캐시를 먼저 보고 없을 때 원본을 읽어 채운다는 뜻이다. 원본은 DB·외부 API일 수 있고, 캐시는 버리고 다시 만들 수 있는 복사본으로 취급한다. 이는 예제의 설계 선택이지 모든 데이터에 캐시를 적용하라는 권장이 아니다.

⚠️ 주의: 상품 화면의 캐시 값으로 재고 차감·결제 승인 여부를 확정하지 않는다. 캐시가 원본보다 뒤처질 수 있기 때문이다. 최종 업무 판단은 앞서 배운 트랜잭션·잠금·조건부 UPDATE 등 원본의 정확성 장치에서 수행한다.

### 3.2 키는 “같은 결과를 재사용해도 되는 요청”을 구분한다

**캐시 키(cache key)**는 저장된 결과를 찾는 식별자다. 이 노트에서 조회 위치는 `productViews`라는 캐시 이름과 상품 ID의 조합이다. 같은 캐시 이름·같은 키는 같은 값을 가리키므로, 단순히 입력의 일부를 줄이는 문제가 아니라 결과가 같아야 하는 경계를 정하는 문제다.

Spring의 기본 키 생성은 인자가 없으면 빈 복합 키를, 일반적인 단일 인자면 그 인자를, 여러 인자면 인자들을 묶은 `SimpleKey`를 사용한다. 기본 키에 메서드 이름이 자동으로 들어가는 것은 아니다. 같은 캐시에서 `findName(1)`과 `findDescription(1)`을 별도로 저장하려면 캐시 이름이나 키를 구분해야 한다. [기본 키 규칙](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html#cache-annotations-cacheable-default-key), [SimpleKeyGenerator API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/interceptor/SimpleKeyGenerator.html)

| 조회 조건 | 상품 ID만 키로 쓰면 생기는 문제 | 설계 방향 |
| --- | --- | --- |
| 모든 사용자에게 같은 상품 이름 | 이 예제의 범위에서는 구분 가능 | 상품 ID |
| 언어별 상품 설명 | 한국어 요청이 영어 결과를 받을 수 있음 | 상품 ID + 언어 |
| 회사별로 다른 카탈로그 | 다른 회사의 값이 섞일 수 있음 | 회사 식별자 + 상품 ID |
| 사용자별 할인·권한 포함 응답 | 개인화 정보가 재사용될 수 있음 | 공유 데이터만 분리하거나 필요한 사용자 경계 포함 |

표는 작성한 설계 예시다. 키에 사용자를 넣었다고 권한 검사가 완료되는 것도 아니다. 인증·인가는 별도로 수행해야 하며, hit일 때 생략되는 메서드 본문 안에만 권한 검사를 두면 안 된다.

예제의 `key = "#p0"`는 첫 번째 인자를 뜻한다. **SpEL**은 Spring Expression Language로, 애너테이션 문자열에서 인자나 결과를 참조하는 표현식이다. `#p0`는 컴파일 시 인자 이름 정보가 남아 있는지에 의존하지 않는다. [캐시 표현식의 인자 참조](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/Cacheable.html)

### 3.3 Boot 자동 구성에 Caffeine을 연결한다

다음은 [첫 프로젝트 실행 노트](../01_08_25_Spring_Initializr_and_First_Run/08_25_Spring_Initializr_and_First_Run.md)처럼 Boot 플러그인과 의존성 관리가 이미 설정된 **Gradle Groovy 프로젝트에 추가하는 일부 설정**이다. `build.gradle`의 기존 `dependencies` 블록에 두 의존성을 넣는다. 테스트 예제까지 사용하려면 테스트 starter도 필요하다.

```groovy
dependencies { // 기존 블록에 합치며 동일 의존성을 중복 등록하지 않는다.
    implementation 'org.springframework.boot:spring-boot-starter-cache' // Spring 캐시 통합에 필요한 지원 라이브러리를 가져온다.
    implementation 'com.github.ben-manes.caffeine:caffeine' // 값을 저장하고 크기·만료를 관리할 구현을 가져온다.
    testImplementation 'org.springframework.boot:spring-boot-starter-test' // 3.9의 JUnit 테스트에 필요한 테스트 의존성이다.
}
```

버전 문자열을 생략한 이유는 Boot의 의존성 관리와 맞추기 위해서다. Caffeine 의존성만 있다고 캐시 애너테이션 처리가 활성화되는 것은 아니므로 다음 설정도 추가한다. CacheManager를 직접 등록하지 않아 Boot가 자동 구성하게 하는 방식이다. [Boot 캐시 의존성·Caffeine 구성](https://docs.spring.io/spring-boot/reference/io/caching.html#io.caching.provider.caffeine)

**추가 파일:** `src/main/java/com/example/cache/CacheConfiguration.java`. 기존 `@SpringBootApplication`이 `com.example` 또는 그 상위 패키지에서 이 패키지를 스캔한다고 전제한다.

```java
package com.example.cache; // 아래 예제 파일들을 같은 패키지에 둔다.

import org.springframework.cache.annotation.EnableCaching; // 캐시 애너테이션을 처리하는 기능이다.
import org.springframework.context.annotation.Configuration; // Spring이 읽을 설정 클래스로 표시한다.

@Configuration(proxyBeanMethods = false) // 이 클래스에는 서로 호출할 @Bean 메서드가 없다.
@EnableCaching // 캐시 애너테이션이 붙은 Bean 호출을 가로채 처리하도록 활성화한다.
public class CacheConfiguration { // CacheManager 자체는 Boot 자동 구성에 맡긴다.
}
```

**추가 설정:** `src/main/resources/application.yml`. 기존 `spring:`이 있으면 그 아래에 합쳐 중복 최상위 키를 만들지 않는다.

```yaml
spring: # Spring Boot 설정 영역이다.
  cache: # 캐시 자동 구성에 전달할 설정이다.
    type: caffeine # 여러 라이브러리가 있어도 이번 실습은 Caffeine을 선택한다.
    cache-names: productViews # 애너테이션에서 사용할 캐시 이름을 미리 등록한다.
    caffeine: # Caffeine 보관 정책을 지정한다.
      spec: maximumSize=1000,expireAfterWrite=30s,recordStats # 개수 제한·쓰기 후 만료·통계 수집을 함께 설정한다.
```

`1000`과 `30s`는 학습용 값이다. 개수 제한은 바이트 단위 메모리 한도가 아니며, 값 하나의 크기가 커지면 같은 개수라도 메모리 사용량이 달라진다. 시간 설정의 의미는 3.6에서 비교한다.

⚠️ 주의: 별도의 `CacheManager` Bean을 등록하면 이 노트가 전제한 Boot 자동 구성 경로가 달라진다. 설정 파일을 바꿨는데 반영되지 않으면 실제 관리자 타입과 직접 등록한 Bean부터 확인한다. `spring.cache.caffeine.spec`와 별도의 Caffeine builder를 함께 쓸 때도 우선순위를 확인해야 한다. [자동 구성 조건·설정 우선순위](https://docs.spring.io/spring-boot/reference/io/caching.html)

### 3.4 조회와 수정 예제로 캐시의 실행 순서를 읽는다

이 예제는 **기존 프로젝트에 추가하는 네 개의 Java 파일**이다. 외부 HTTP나 DB 없이 캐시 흐름을 관찰하도록 메모리 Map을 원본 대역으로 사용한다. 이는 영구 저장소나 운영용 상품 기능이 아니며, HTTP Controller·오류 응답 변환은 포함하지 않는다.

먼저 보관할 응답을 정한다. **DTO**는 계층 사이에서 전달할 데이터 모양이며, 여기서는 ID와 이름만 담는다. **record**는 구성 값과 접근 메서드를 간결하게 선언하는 Java 타입이다. 이 DTO의 구성 값은 불변인 `long`·`String`이므로 캐시 hit 후 내부 값을 직접 수정하는 일을 피할 수 있다.

**파일:** `src/main/java/com/example/cache/ProductView.java`

```java
package com.example.cache; // 조회 Service와 원본 대역이 공유할 데이터 타입이다.

public record ProductView( // JPA Entity 대신 화면에 필요한 조회 결과만 보관한다.
        long id, // 어떤 상품의 결과인지 식별한다.
        String name // 이 예제에서 재사용할 공개 표시 정보다.
) { // record가 id()·name() 등의 접근 메서드를 제공한다.
}
```

JPA Entity를 그대로 캐시하면 변경 가능한 객체 참조나 지연 로딩 상태까지 섞일 수 있다. 여기서 필요한 것은 조회 결과의 복사본이므로 Entity 생명주기와 분리한다. 단, record 안에 변경 가능한 List 등을 넣으면 그 내부까지 자동으로 불변이 되는 것은 아니다.

**파일:** `src/main/java/com/example/cache/ProductGateway.java`

```java
package com.example.cache; // 캐시 규칙과 원본 읽기·쓰기 구현을 분리한다.

public interface ProductGateway { // 실제 원본을 읽고 수정하는 경계를 정의한다.
    ProductView find(long productId); // 존재하면 DTO, 없으면 예외를 내는 계약이다.
    void rename(long productId, String newName); // 이 대역에서는 반환 전에 Map 수정이 완료된다.
}
```

**파일:** `src/main/java/com/example/cache/InMemoryProductGateway.java`

```java
package com.example.cache; // 실습용 원본 대역을 같은 스캔 범위에 둔다.

import java.util.Map; // 초기 상품 목록을 구성한다.
import java.util.NoSuchElementException; // 없는 상품을 정상 값으로 반환하지 않는다.
import java.util.concurrent.ConcurrentHashMap; // 여러 호출이 접근할 Map 구현이다.
import java.util.concurrent.atomic.AtomicInteger; // 원본 조회 횟수를 관찰할 카운터다.
import org.springframework.stereotype.Repository; // 이 구현을 Spring Bean으로 등록한다.

@Repository // ProductGateway의 실습용 구현 하나를 주입할 수 있게 한다.
public class InMemoryProductGateway implements ProductGateway {
    private final Map<Long, ProductView> products = new ConcurrentHashMap<>( // 원본 역할을 하며 캐시와 별도 객체다.
            Map.of(1L, new ProductView(1L, "기본 키보드"))); // 조회할 상품 하나로 시작한다.
    private final AtomicInteger reads = new AtomicInteger(); // hit일 때 증가하지 않는지 확인한다.

    @Override // 인터페이스의 원본 조회 계약을 구현한다.
    public ProductView find(long productId) {
        reads.incrementAndGet(); // 성공·부재를 포함해 원본에 진입한 횟수를 센다.
        ProductView product = products.get(productId); // 캐시가 아니라 원본 Map에서 찾는다.
        if (product == null) { // 없는 값을 정상 조회 결과와 구분한다.
            throw new NoSuchElementException("상품 없음: " + productId); // 캐시에 넣을 DTO 없이 실패한다.
        }
        return product; // 정상 조회 결과를 Service에 전달한다.
    }

    @Override // 인터페이스의 이름 변경 계약을 구현한다.
    public void rename(long productId, String newName) {
        ProductView updated = products.computeIfPresent(productId, // 같은 상품의 원본 변경을 Map 연산으로 수행한다.
                (id, oldValue) -> new ProductView(id, newName)); // 기존 DTO를 수정하지 않고 새 DTO로 교체한다.
        if (updated == null) { // ID가 없으면 수정이 수행되지 않았다.
            throw new NoSuchElementException("상품 없음: " + productId); // 성공한 수정처럼 처리하지 않는다.
        }
    }

    public int readCount() { // 예제의 원본 진입 횟수를 테스트·디버거에서 확인한다.
        return reads.get(); // 동시 접근 가능한 카운터의 현재 값을 반환한다.
    }
}
```

`ConcurrentHashMap`은 Map 접근을 안전하게 해 주지만 캐시와 원본의 두 작업을 하나의 트랜잭션으로 묶지는 않는다. `reads`도 성능 지표용 운영 코드가 아니라 hit·miss를 눈으로 확인하는 대역의 관찰 장치다.

**파일:** `src/main/java/com/example/cache/ProductCatalog.java`

```java
package com.example.cache; // 캐시 적용 경계를 원본 대역과 분리한다.

import org.springframework.cache.annotation.Cacheable; // hit이면 메서드 본문을 생략하는 규칙이다.
import org.springframework.cache.annotation.CacheEvict; // 수정 성공 후 기존 조회 결과를 지우는 규칙이다.
import org.springframework.stereotype.Service; // 호출자가 주입받을 Service Bean으로 등록한다.

@Service // 외부 Bean이 이 Bean의 프록시를 통해 호출해야 캐시 규칙이 적용된다.
public class ProductCatalog { // 클래스 기반 프록시가 확장할 수 있도록 final로 만들지 않는다.
    private final ProductGateway gateway; // 원본 접근 책임을 가진 객체를 보관한다.

    public ProductCatalog(ProductGateway gateway) { // Spring이 등록된 구현을 생성자로 주입한다.
        this.gateway = gateway; // 이후 조회·수정에서 같은 원본 경계를 사용한다.
    }

    @Cacheable(cacheNames = "productViews", key = "#p0", sync = true) // 같은 키의 miss 로딩을 합치는 방식이다.
    public ProductView find(long productId) { // 첫 인자를 상품 키로 쓰는 공개 조회 메서드다.
        return gateway.find(productId); // miss 때만 원본을 읽으며 실패는 정상 DTO로 바꾸지 않는다.
    }

    @CacheEvict(cacheNames = "productViews", key = "#p0") // 기본 설정은 메서드가 성공한 뒤 이 상품 키를 삭제한다.
    public void rename(long productId, String newName) { // 호출자가 주입받은 Bean으로 실행할 수정 경계다.
        if (newName == null || newName.isBlank()) { // 실패할 입력을 원본 변경 전에 검사한다.
            throw new IllegalArgumentException("상품 이름은 비어 있을 수 없습니다."); // 예외로 끝나면 기본 evict는 실행되지 않는다.
        }
        gateway.rename(productId, newName); // 이 실습의 원본 Map을 변경한 뒤 정상 반환한다.
    }
}
```

처음 `find(1L)`을 호출하면 캐시에 값이 없으므로 원본 조회가 실행된다. 얻은 DTO가 보관되고, 유효한 동안 두 번째 호출은 본문을 생략한다. `rename(1L, "새 키보드")`는 원본을 바꾸고 이전 캐시 항목을 지운다. 그 다음 `find(1L)`은 새 이름을 원본에서 읽는다. [조회 애너테이션 API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/Cacheable.html), [삭제 애너테이션 API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/CacheEvict.html)

아래는 **새 컨텍스트·빈 캐시에서, 만료·용량 삭제·다른 호출이 끼어들지 않는 순차 실행의 예상 결과**다. Spring에서 주입받은 `ProductCatalog`와 대역의 카운터로 확인한다.

| 실행 순서 | 반환·상태 | 원본 조회 횟수 |
| --- | --- | ---: |
| `find(1L)` | `기본 키보드`, miss 후 저장 | 1 |
| 다시 `find(1L)` | `기본 키보드`, hit | 1 |
| `rename(1L, "새 키보드")` | 원본 변경·해당 키 삭제 | 1 |
| 다시 `find(1L)` | `새 키보드`, miss 후 저장 | 2 |
| `rename(1L, " ")` | 입력 예외·기존 캐시 유지 | 2 |
| `find(99L)` 두 번 | 각각 부재 예외·성공 값 저장 없음 | 4 |

**`@CachePut`**은 hit여도 본문을 실행하고 반환 결과를 저장한다. 조회 생략 목적의 `@Cacheable`과 다르다. 변경 메서드가 완전한 최신 DTO를 반환한다면 고려할 수 있지만, 위 예제의 수정 메서드는 `void`이므로 새 결과를 넣는 대신 삭제 후 재조회한다. 두 애너테이션을 같은 메서드에 무심코 함께 붙이지 않는다. [공식 `@CachePut` 설명](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html#cache-annotations-put)

### 3.5 프록시를 지나야 메서드 앞의 규칙이 실행된다

**프록시(proxy)**는 실제 객체 앞에서 호출을 받아 부가 작업을 수행하는 대리 객체다. 기본 캐시 처리에서는 다른 Bean이 주입받은 `ProductCatalog`를 호출할 때 캐시 확인이 끼어든다. 메서드 안에서 `this.find(1L)`로 자기 메서드를 호출하면 이 경계를 다시 지나지 않는다. [Spring 프록시 호출 원리](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)

디버깅할 때는 `new ProductCatalog(gateway)`로 직접 만든 객체인지, 캐시 설정이 스캔되었는지, 다른 Bean에서 공개 메서드를 호출했는지부터 본다. 클래스 기반 프록시에서는 `final` 클래스·메서드나 `private` 메서드에도 제약이 있다. 이 예제가 일반 클래스의 공개 메서드를 사용하는 이유다.

⚠️ 주의: 테스트에서 `new ProductCatalog(...)`를 호출하고 같은 조회가 두 번 원본에 도달했다고 캐시가 고장 났다고 판단하지 않는다. 그것은 프록시 없는 일반 Java 객체의 동작이다. 단위 테스트와 Spring 캐시 통합 테스트가 확인하는 범위는 다르다.

### 3.6 만료는 시간 기준이고 무효화는 변경 기준이다

**TTL(Time To Live)**은 값을 유효하게 재사용할 시간이다. **만료(expiration)**는 시간 정책에 따라 사용할 수 없게 되는 것이고, **무효화(invalidation)**는 변경 등을 이유로 명시적으로 버리는 것이다. 넓은 의미의 **eviction**은 용량·시간 정책에 따른 제거도 포함한다.

| 정책 | 기준 시점 | 예: 30초 설정 후 20초에 조회 |
| --- | --- | --- |
| `expireAfterWrite` | 생성 또는 값 교체 | 조회만으로 연장되지 않음 |
| `expireAfterAccess` | 마지막 읽기 또는 쓰기 | 읽었으므로 유효 시간이 다시 이어짐 |
| `maximumSize` | 항목 개수 제한 | 시간 전이라도 용량 정책으로 제거될 수 있음 |

인기 상품을 계속 조회할 때 `expireAfterAccess`만 설정하면 오래된 값의 수명이 계속 이어질 수 있다. 그래서 이 예제는 표시 정보가 일정 시간 뒤 다시 읽히도록 `expireAfterWrite`를 선택했다. 실제 시간과 용량은 변경 빈도·허용 지연·원본 처리 능력·값 크기로 조정한다. [Caffeine 만료·용량 정책](https://github.com/ben-manes/caffeine/wiki/Eviction)

만료는 “30초마다 DB를 미리 조회한다”는 뜻이 아니다. 다음 요청이 miss로 원본을 읽는 흐름이며, 만료 항목의 물리적 정리는 유지보수 작업 시점과도 관련된다. 따라서 내부 항목 수가 특정 순간에 줄었는지와 오래된 값이 조회 가능한지를 같은 검사로 다루지 않는다.

**Refresh(새로 고침)**은 기존 값을 유지하면서 새 값을 다시 가져오는 별도 흐름이다. Caffeine의 `refreshAfterWrite`는 로더가 연결된 LoadingCache의 기능이며, 시간이 지났다는 이유만으로 모든 키를 주기적으로 조회하는 설정은 아니다. 조회가 발생할 때 갱신이 시작되는 방식과 갱신 중 기존 값을 반환하는 점도 만료와 다르다. 이 예제는 LoadingCache나 CacheLoader를 구성하지 않았으므로 `spec`에 refresh 옵션만 추가해 해결하려 하지 않는다. [Caffeine Refresh](https://github.com/ben-manes/caffeine/wiki/Refresh)

⚠️ 주의: TTL 30초를 “DB 변경 후 정확히 30초 이내에 모든 서버가 최신 값을 반환한다”는 보장으로 읽지 않는다. 캐시에 기록한 시점부터의 정책일 뿐이며, 원본 조회 시간·동시 변경·서버별 보관 시점이 더해질 수 있다.

### 3.7 삭제 시점·DB commit·여러 서버를 별도로 확인한다

예제의 `@CacheEvict`는 `beforeInvocation = false`가 기본이어서 메서드가 예외 없이 완료된 뒤 해당 키를 삭제한다. `beforeInvocation = true`는 본문 실행 전에 삭제하므로 나중에 실패해도 이미 지워진다. `allEntries = true`는 그 캐시의 모든 항목을 대상으로 하며 개별 키 삭제와 구분한다. [CacheEvict API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/CacheEvict.html)

**DB 적용 관점의 보충:** 메서드가 정상 반환한 것과 전체 DB 트랜잭션이 commit된 것은 같지 않을 수 있다. 바깥 트랜잭션이 이후 실패하거나 캐시·트랜잭션 프록시 순서가 달라지면, 삭제 뒤 재조회가 변경 전 값을 채울 수 있다. 위 Map 대역에는 DB 트랜잭션이 없으므로 이 문제가 검증된 것으로 볼 수 없다.

Spring에는 성공한 트랜잭션의 after-commit 단계에 `put`·`evict`·`clear`를 맞추는 `TransactionAwareCacheDecorator`가 있다. 다만 즉시 수행해야 하는 `putIfAbsent`·`evictIfPresent` 등까지 모두 같은 방식으로 지연되는 것은 아니다. 이 노트는 해당 decorator를 구성하지 않았고, 애너테이션만 붙이면 commit 연동이 자동 해결된다고 가정하지 않는다. [트랜잭션 연동 API와 제한](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/transaction/TransactionAwareCacheDecorator.html)

**동시 변경에 관한 설계 예시:** 일반적인 분리된 cache-aside 읽기에서 다음 순서도 생각해야 한다.

1. 읽기 R이 cache miss 후 변경 전 원본 값을 얻지만 아직 캐시에 기록하지 않는다.
2. 쓰기 W가 원본 변경을 commit하고 기존 캐시를 삭제한다.
3. R이 뒤늦게 변경 전 값을 캐시에 넣는다.

이 순서는 “commit 후 삭제”만으로 모든 오래된 재삽입이 사라진다고 단정할 수 없는 이유다. 정확한 재현 여부·차단 방식은 원본의 읽기 시점과 캐시 구현의 로딩·삭제 동기화에 달려 있다. 위 Caffeine `sync=true` 예제에서 반드시 이 순서가 발생한다는 실행 결과가 아니라, 분리된 읽기·쓰기 설계를 검토하는 시나리오다.

로컬 캐시를 서버 A·B가 각각 가진 경우도 다르다. A에서 이름을 수정하고 A의 캐시를 비워도 B의 값은 직접 삭제되지 않는다. B는 자체 만료·삭제 정책을 따라간다. 캐시가 여러 서버에 복사되어 있다는 사실과 DB의 commit 성공은 서로 다른 범위다.

⚠️ 주의: 목록·검색 결과도 캐시한다면 상품 한 개의 키만 삭제해도 그 목록이 갱신되는지 확인해야 한다. 변경이 영향을 주는 모든 조회 결과를 정의하고, 즉시 최신성 요구가 강하면 캐시하지 않을 범위도 정한다. 공유 캐시를 도입하더라도 원본과 캐시가 자동으로 한 트랜잭션이 되지는 않는다.

### 3.8 같은 키의 동시 miss를 합쳐도 원본 보호는 필요하다

**Cache stampede**는 값이 없거나 한꺼번에 만료될 때 많은 요청이 동시에 원본으로 몰리는 현상이다. 같은 상품을 여러 thread가 동시에 처음 조회하면 단순 조회·저장만으로는 동일 계산을 반복할 수 있다.

`sync = true`는 같은 키를 동시에 로딩하는 작업을 캐시 구현에 맡겨 합치는 옵션이다. 이때 한 캐시만 지정할 수 있고 `unless`나 다른 캐시 작업을 같은 메서드에 결합할 수 없다. **`condition`**은 인자 기준으로 캐시 적용 여부를 판단하고, **`unless`**는 반환 결과를 보고 저장을 거부하는 표현식이다. 결과를 나중에 골라 버리고 싶다면 이 동기화 옵션과의 제약부터 확인한다. [Cacheable sync 제약](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/Cacheable.html), [조건부 캐싱](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html#cache-annotations-cacheable-condition)

Caffeine의 원자적 `get(key, 계산 함수)`는 값이 없을 때 계산·등록을 묶는다. Spring의 Caffeine 어댑터는 로딩 콜백을 받는 캐시 조회를 지원한다. 이 예제에서 합치는 범위는 **같은 로컬 캐시 인스턴스의 같은 키에 대한 동시 로딩**이지, 서버 전체의 모든 조회가 한 번만 실행된다는 뜻이 아니다. 실패 후 다시 로딩하는 것도 별도 상황이다. [Caffeine Population](https://github.com/ben-manes/caffeine/wiki/Population), [Spring CaffeineCache API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/caffeine/CaffeineCache.html)

서로 다른 상품 ID 1000개가 동시에 miss면 같은 키 로딩 합치기만으로는 원본 진입량을 제한할 수 없다. 외부 API를 원본으로 바꿀 때는 앞서 배운 보호 장치를 **miss 후 실제 원본 호출 경계**에 배치하는 설계를 고려한다.

```text
캐시 조회
├─ hit  → 반환: 외부 호출 자리·허가를 소비하지 않는 설계
└─ miss → 원본 조회 경계 → timeout·재시도·Bulkhead·Rate Limiter 정책 → 외부 API
```

이것은 적용 위치를 보여 주는 설계 예시다. 여러 애너테이션의 기본 순서가 자동으로 이 도식을 만들 것이라고 가정하지 않는다. 별도 Bean의 호출 경계와 실제 실행 횟수로 확인한다.

⚠️ 주의: 원본 장애를 잡아 “상품 없음” DTO나 빈 목록으로 바꾸면 캐시 입장에서는 정상 반환값이 될 수 있다. 실패와 정상 부재를 구분하고, fallback을 보관할지·얼마나 보관할지 명시해야 한다. 예제는 부재를 예외로 전달하고 성공 DTO만 보관하는 계약을 택했다.

### 3.9 적중률과 최신성을 함께 관찰하고 테스트한다

**Hit rate(적중률)**는 캐시 조회 중 값이 재사용된 비율이다. `recordStats`를 켜면 Caffeine은 적중률·제거 횟수·로딩 비용 등의 통계를 제공한다. 높은 적중률은 원본 호출을 줄였다는 신호이지만, 오래된 결과를 오래 보관해도 높아질 수 있다. 통계 수집 옵션만 켰다고 외부 모니터링 화면이 자동으로 완성되는 것도 아니다. [Caffeine Statistics](https://github.com/ben-manes/caffeine/wiki/Statistics)

원본 조회 횟수·응답 지연·로딩 실패·메모리·삭제 후 새 값 반환 여부를 같이 본다. 테스트에서는 앞의 예상 결과 표를 검증하되, 각 테스트 전에 캐시와 원본 대역의 상태를 새로 만들거나 초기화해 이전 결과가 남지 않게 한다.

만료 검사에서 실제로 30초씩 기다릴 필요는 없다. **Ticker**는 캐시가 경과 시간을 읽는 인터페이스다. 테스트에서는 시간 읽기를 교체해 만료 경계를 재현할 수 있다. 아래는 **별도로 추가하는 완전한 JUnit 테스트 클래스**이며, Caffeine 자체의 만료 정책만 검사한다. Spring 프록시·Boot 자동 구성·DB commit 검사는 아니다. [시간 기반 제거의 테스트 방법](https://github.com/ben-manes/caffeine/wiki/Eviction)

**파일:** `src/test/java/com/example/cache/CaffeineExpiryTest.java`

```java
package com.example.cache; // 앞의 예제와 같은 패키지에 테스트를 배치한다.

import com.github.benmanes.caffeine.cache.Cache; // Spring Cache가 아니라 Caffeine의 원래 Cache 타입이다.
import com.github.benmanes.caffeine.cache.Caffeine; // 정책과 테스트용 시간원을 구성한다.
import java.time.Duration; // 만료 기간을 초 단위로 명확히 표현한다.
import java.util.concurrent.atomic.AtomicLong; // 테스트가 제어할 경과 시간 값을 보관한다.
import org.junit.jupiter.api.Test; // JUnit이 실행할 테스트를 표시한다.
import static org.junit.jupiter.api.Assertions.assertEquals; // 만료 전 값이 같은지 확인한다.
import static org.junit.jupiter.api.Assertions.assertNull; // 만료 후 사용할 값이 없는지 확인한다.

class CaffeineExpiryTest { // 실제 운영 캐시와 독립된 작은 테스트다.
    @Test // 테스트 실행기가 이 메서드를 실행하도록 한다.
    void writeExpiryDoesNotExtendOnRead() {
        AtomicLong nanos = new AtomicLong(); // 시작 시간을 0 나노초로 둔다.
        Cache<Long, String> cache = Caffeine.newBuilder() // 테스트 안에서만 쓸 캐시를 만든다.
                .expireAfterWrite(Duration.ofSeconds(30)) // 기록 후 30초가 지나면 유효하지 않다.
                .ticker(nanos::get) // 실제 시계 대신 이 숫자를 경과 시간으로 읽는다.
                .build(); // 원본 로더 없는 수동 캐시를 완성한다.
        cache.put(1L, "기본 키보드"); // 0초에 값을 기록한다.
        nanos.set(Duration.ofSeconds(20).toNanos()); // 기다리지 않고 시간을 20초로 이동한다.
        assertEquals("기본 키보드", cache.getIfPresent(1L)); // 아직 유효하지만 읽기로 쓰기 시점은 바뀌지 않는다.
        nanos.set(Duration.ofSeconds(31).toNanos()); // 경계 바깥인 31초로 이동한다.
        assertNull(cache.getIfPresent(1L)); // 만료 값은 재사용할 수 없음을 검사한다.
    }
}
```

프로젝트 루트에 Gradle Wrapper가 있는 실습 프로젝트라면 아래 명령으로 이 테스트만 실행한다. **이 TIL 저장소에서 실행하는 명령은 아니며 이번 작성에서는 실행하지 않았다.**

```powershell
.\gradlew.bat test --tests com.example.cache.CaffeineExpiryTest # 성공 시 해당 테스트 통과와 BUILD SUCCESSFUL을 확인한다.
```

만료 테스트가 통과하더라도 캐시 기능 전체가 검증된 것은 아니다. 실제 프로젝트에서는 다음 범위를 따로 검사한다.

| 검사 범위 | 확인할 내용 | 실패 시 먼저 볼 지점 |
| --- | --- | --- |
| Boot 구성 | 실제 관리자·캐시 이름·설정값 | 직접 등록한 관리자, 스캔 범위, 설정 중복 |
| Spring 프록시 | 반복 호출의 원본 진입 횟수 | 직접 생성·자기 호출·애너테이션 활성화 |
| 수정·실패 | 성공 후 재조회, 입력 예외 후 기존 값 | 조회·삭제 키 일치, 예외 경로 |
| 같은 키 동시 miss | 로딩을 겹치게 만든 뒤 원본 횟수 | 요청 시작만 동시인지, 실제 로딩도 겹쳤는지 |
| DB·여러 서버 | rollback 후 상태, 다른 인스턴스의 값 | commit 경계, 로컬 무효화 범위 |

동시성 테스트는 thread를 생성한 것만으로 충분하지 않다. 로딩 중인 상태를 대역과 동기화 장치로 붙잡아 실제 겹침을 만든 뒤 비교해야 한다. 이 표는 검증 계획이며 동시성·다중 서버 테스트를 수행한 기록이 아니다.

## 4. 적용 관점에서 다시 보기

상품 조회에 적용한다면 본문에서 설명한 기준을 다음 순서로 묶는다.

1. **업무 허용 범위를 정한다.** 이름 표시와 재고·결제 판단을 분리하고 어떤 응답이 잠시 오래되어도 되는지 합의한다.
2. **같은 결과의 경계를 정한다.** 상품 ID뿐 아니라 언어·회사·개인화 조건과 권한 검사 위치를 확인한다.
3. **저장할 DTO와 정책을 정한다.** 변경 가능한 Entity를 피하고, 용량·쓰기 후 만료·통계 옵션을 실제 값 크기와 조회 패턴에 맞춘다.
4. **호출 경계를 확인한다.** Boot 구성과 프록시를 검사하고, 원본 보호 장치는 miss의 실제 호출 경계에서 검토한다.
5. **변경 반영 범위를 정한다.** 단일 키·목록의 영향, commit 시점, 다른 서버의 값, 동시 로딩과 변경의 순서를 함께 본다.
6. **기능과 효과를 나눠 검증한다.** 원본 횟수·만료·수정 후 값·실패 경로를 검사한 뒤 지연·적중률·메모리로 효과를 관찰한다.

캐시가 적용되지 않으면 프록시와 설정부터 보고, 수정 뒤 값이 오래 남으면 키·삭제 시점·서버 범위를 본다. 적중률이 낮다는 이유만으로 TTL을 늘리기 전에 그 변경이 허용되는 최신성 기준인지 확인한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

캐시는 조회를 빠르게 만드는 저장소이면서 원본과 응답 사이에 시간 차이를 만드는 계층이다. 키·보관 시간·삭제 범위·원본 호출 경계를 함께 정해야 성능 개선이 업무 정확성을 해치지 않는다.

### 5.2 이전·다음 학습과의 연결

[Bulkhead·Rate Limiter](../28_09_29_Bulkhead_and_Rate_Limiting/09_29_Bulkhead_and_Rate_Limiting.md)는 실제 호출의 양을 제한했고, 이번 캐시는 재사용 가능한 호출을 생략했다. 다음에는 [Redis와 분산 캐시·캐시 일관성](../30_10_01_Redis_and_Distributed_Cache/10_01_Redis_and_Distributed_Cache.md)을 학습해 여러 서버가 값을 공유할 때 직렬화·만료·무효화·장애 정책을 어떻게 정하는지 연결한다.

### 5.3 더 파볼 만한 주제

같은 키의 로딩을 합치는 동안 호출자 deadline이 끝나면 어떤 요청이 계속 원본을 읽어야 할까? 데이터 버전을 포함한 키, 여러 캐시 계층, 변경 이벤트와 목록 무효화를 결합할 때 어떤 정확성 요구를 만족할 수 있는지도 확장할 수 있다.

### 5.4 참고 자료

- [Spring Cache 개요](https://docs.spring.io/spring-framework/reference/integration/cache.html): 저장 구현과 공통 추상화의 구분
- [Spring 캐시 애너테이션](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html): 키·조건·조회·저장·활성화 규칙
- [Spring Boot Caching](https://docs.spring.io/spring-boot/reference/io/caching.html): starter·provider 선택·Caffeine 자동 구성 조건과 설정 우선순위
- [Cacheable API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/Cacheable.html): 인자 표현식과 `sync` 제약
- [CacheEvict API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/CacheEvict.html): 성공 후 삭제·실행 전 삭제·전체 항목 삭제
- [SimpleKeyGenerator API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/interceptor/SimpleKeyGenerator.html): 기본 키 생성
- [Spring 프록시 원리](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html): 자기 호출과 클래스 기반 프록시 제약
- [CaffeineCache API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/caffeine/CaffeineCache.html): Spring에서 Caffeine 로딩 콜백을 연결하는 계약
- [TransactionAwareCacheDecorator API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/transaction/TransactionAwareCacheDecorator.html): commit 후 캐시 작업과 즉시 연산의 제한
- [Caffeine Population](https://github.com/ben-manes/caffeine/wiki/Population): 수동 캐시·로딩 캐시·원자적 조회/계산
- [Caffeine Eviction](https://github.com/ben-manes/caffeine/wiki/Eviction): 용량·시간 정책과 Ticker 기반 테스트
- [Caffeine Refresh](https://github.com/ben-manes/caffeine/wiki/Refresh): 만료와 새로 고침의 차이
- [Caffeine Statistics](https://github.com/ben-manes/caffeine/wiki/Statistics): 적중률·제거 횟수·로딩 비용

## 6. 요약 정리

1. Spring Cache는 공통 계약이고 Caffeine은 JVM 안에 값을 보관하는 구현이다. 캐시는 원본의 정확성 장치를 대신하지 않는다.
2. Hit이면 조회 본문을 생략하고 miss이면 원본을 읽어 저장한다. hit에서 생략하면 안 되는 권한 검사도 구분한다.
3. 캐시 이름과 키는 결과를 재사용할 수 있는 경계다. 언어·회사·사용자별 결과를 섞지 않는다.
4. 캐시 활성화·의존성·설정과 프록시 호출이 연결되어야 하며 직접 생성이나 자기 호출은 별도 경로다.
5. 쓰기 후 만료는 읽기로 연장되지 않고, 접근 후 만료는 연장될 수 있다. 만료와 refresh는 다른 동작이다.
6. `@CacheEvict`의 기본 성공 시점은 DB commit·여러 서버의 삭제와 같지 않다. 동시 읽기·쓰기와 목록 영향도 확인한다.
7. `sync=true`는 같은 로컬 키의 로딩을 합치지만 모든 키·모든 서버의 원본 부하를 제한하지 않는다.
8. 적중률뿐 아니라 새 값 반환·원본 횟수·실패·메모리를 관찰하고, 문서 검사와 코드 실행 검증을 구분한다.

🧠 기억할 것: **캐시는 같은 결과를 잠시 빌려 쓰는 계층이다. 누구의 어떤 값을 얼마나 재사용하고, 변경 뒤 어느 범위에서 다시 읽을지까지 정해야 한다.**

## 7. 미니 퀴즈 또는 체크리스트

1. 빈 캐시에서 `find(1L)`을 두 번 호출하고 `rename(1L, "새 이름")` 뒤 다시 조회했다. 만료나 다른 호출이 없다면 원본 조회 횟수는 얼마인가?
2. 한국어·영어 설명이 다른데 상품 ID만 키로 사용했다. 어떤 잘못된 응답이 생길 수 있으며 키와 권한 검사는 어떻게 구분해야 하는가?
3. 30초 만료 캐시의 값을 20초마다 계속 읽는다. `expireAfterWrite`와 `expireAfterAccess`에서 유효 시간은 어떻게 달라지는가?
4. `this.find(1L)`와 다른 Bean에서 주입받은 Service 호출은 왜 다른가? `sync=true`가 서로 다른 키 1000개의 원본 호출까지 제한하는가?
5. 서버 A에서 DB commit 후 A의 캐시를 삭제했다. B도 즉시 최신 값을 반환한다고 보장할 수 있는가? TTL과 commit 후 삭제만으로 모든 오래된 재삽입이 없어지는가?

<details>
<summary>정답과 해설</summary>

1. 총 2번이다. 첫 조회가 원본을 읽고 두 번째는 hit이다. 수정은 조회 카운터를 늘리지 않고 키를 삭제하며, 마지막 조회가 다시 원본을 읽는다.
2. 먼저 캐시된 언어가 다른 언어 요청에 반환될 수 있다. 결과를 바꾸는 언어 조건을 키에 포함하거나 캐시를 분리한다. 키 구분은 결과 식별이고 권한 검사는 접근 허용 여부이므로 서로 대체하지 않는다.
3. 쓰기 후 만료는 조회만으로 기록 시점이 바뀌지 않아 원래 쓰기 기준 30초가 지나면 재조회가 필요하다. 접근 후 만료는 계속 읽는 동안 마지막 접근 기준 시간이 이어질 수 있다.
4. 자기 호출은 기본 프록시 경계를 다시 지나지 않는다. 주입받은 Bean의 외부 호출은 캐시 처리를 거친다. `sync=true`는 같은 로컬 키의 동시 로딩 범위이므로 여러 키의 원본 부하는 별도 보호가 필요하다.
5. B의 로컬 항목은 A의 삭제 대상이 아니므로 보장하지 않는다. TTL은 기록 시점 기준이며, 분리된 cache-aside의 동시 읽기·쓰기에서는 오래된 값의 뒤늦은 등록도 검토해야 한다. 실제 구현·원본 읽기·삭제 동기화와 요구 최신성을 함께 확인한다.

</details>
