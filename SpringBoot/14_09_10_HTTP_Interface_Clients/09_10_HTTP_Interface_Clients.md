# HTTP Interface 클라이언트: 선언·프록시·RestClient 연결과 계약 테스트

- 🎯 학습 목표: Java 인터페이스 호출이 HTTP 요청으로 바뀌는 과정을 설명하고, 요청 선언과 업무용 오류 처리를 분리한다.
- 🧩 핵심 키워드: HttpExchange, GetExchange, HttpServiceProxyFactory, RestClientAdapter, 프록시, ResponseEntity, 계약 테스트
- ⭐ 중요도: ★★★★☆ — 외부 API가 늘어날 때 요청 형식을 모아 관리하면서 기존 실패 처리 기준을 유지하는 방법이다.
- 📝 한눈에 보는 내용: 이전 도서 조회 예제를 선언형 클라이언트로 확장하고, 실제 프록시가 만든 경로·쿼리·헤더와 실패 결과를 테스트한다.
- 🧱 선수 지식: Java 인터페이스·제네릭·예외·Optional, Bean과 생성자 주입, RestClient와 HTTP 상태 코드
- 🔗 이전 노트: [외부 HTTP API와 RestClient](../13_09_09_External_HTTP_API_and_RestClient/09_09_External_HTTP_API_and_RestClient.md)

> 정리 기준일: 2026-09-10. Spring Boot 4.1·Spring Framework 7.0 계열의 공식 문서를 참고했다. Java 21을 사용하는 이전 실습 프로젝트에 추가할 코드다. TIL 저장소에서 Java 컴파일·Spring 테스트를 실행한 결과는 아니며, 테스트 결과 설명은 예상이다. 외부 URL은 설명용이고 테스트는 실제 인터넷을 호출하지 않는다.

## 1. 요청을 잘 만들었는데 왜 인터페이스가 필요할까?

이전 `CatalogClient`는 `get()`, `uri()`, `accept()`, `retrieve()`를 이어 붙여 요청을 만들었다. 한두 개의 API에는 충분히 읽기 쉽다. 그런데 조회·검색·등록 등 메서드가 늘어나면 “외부 API의 형식”과 “우리 서비스가 실패를 해석하는 방식”이 한 클래스에 뒤섞이기 쉽다.

HTTP Interface는 외부 API의 경로, HTTP 메서드, 매개변수와 반환 타입을 Java 인터페이스에 선언하는 방법이다. 개발자가 모든 구현 메서드를 작성하는 대신 Spring이 만든 **프록시 객체**가 호출을 받아 HTTP 클라이언트로 연결한다.

여기서 프록시는 “같은 인터페이스로 호출할 수 있는 대리 객체”다. 인터페이스 자체가 통신하는 것이 아니며, 생성된 객체와 실제 전송 도구가 있어야 동작한다. [HTTP Service Clients 공식 설명](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html#rest-http-interface)을 참고한다.

이번 목표는 코드 줄 수만 줄이는 것이 아니다. **HTTP 계약은 인터페이스에, 외부 설정은 구성 클래스에, 책 없음·장애 판단은 업무용 경계 객체에** 놓는 연습이다.

## 2. 메서드 호출부터 네트워크까지의 연결

```text
우리 Service
  → CatalogGateway.find(1): 입력·응답 검증, 책 없음·실패 분류
  → CatalogHttpApi 프록시: 인터페이스 선언과 실제 인수를 해석
  → RestClientAdapter: 프록시의 요청을 RestClient 방식으로 연결
  → RestClient: 상태 처리·JSON 변환
  → 요청 팩터리와 JDK HttpClient: 실제 전송
  → 외부 도서 API
```

`CatalogHttpApi`는 설계도이고, `HttpServiceProxyFactory.createClient(...)`의 반환값은 호출 가능한 객체다. 생성 시점에 책을 조회하지 않는다. 뒤에서 `api.find(...)`를 실행할 때 요청을 보낸다.

`RestClientAdapter`를 사용한 이번 흐름은 **동기식**이다. 인터페이스 선언으로 바꿨다고 비동기·병렬 실행이 되지 않는다. 호출자가 기다리는 방식은 연결한 HTTP 클라이언트에 따라 달라진다. [RestClientAdapter API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/client/support/RestClientAdapter.html)를 참고한다.

### Controller와 이름이 비슷해서 헷갈린다면

- MVC의 Controller는 **들어오는 요청을 처리**한다.
- 이번 HTTP Interface 프록시는 **외부로 요청을 보낸다**.
- `@PathVariable` 같은 매개변수 애너테이션은 양쪽에서 보이지만, 이번에는 요청 경로를 만드는 데 사용한다.
- `@HttpExchange` 인터페이스만 작성하면 Controller나 클라이언트 Bean이 자동으로 생긴다고 생각하면 안 된다.

공식 API는 Controller가 HTTP 인터페이스를 구현하는 활용도 안내한다. 하지만 이 노트는 클라이언트 전용이다. 서버·클라이언트가 반드시 같은 Java 인터페이스를 공유해야 한다는 뜻도 아니다. [HttpExchange API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/service/annotation/HttpExchange.html)를 참고한다.

## 3. 이번 실습에서 유지하고 추가할 파일

[이전 노트](../13_09_09_External_HTTP_API_and_RestClient/09_09_External_HTTP_API_and_RestClient.md)의 Maven·Java 21 프로젝트를 먼저 준비한다. 기존 파일은 삭제하거나 덮어쓰지 않고, 아래 네 파일을 추가한다. 이후 코드 블록은 각각 **추가 파일 전체**다.

```text
src/main/java/com/example/catalogstudy/
  CatalogStudyApplication.java   # 유지: 시작 클래스
  CatalogClientConfig.java       # 유지: 기본 URL·JDK 전송·timeout
  ExternalBook.java              # 유지: Long id, String title인 record
  CatalogAccessException.java    # 유지: HTTP_STATUS·TRANSPORT·INVALID_RESPONSE
  CatalogClient.java             # 유지: 직접 RestClient를 호출하는 비교 대상
  CatalogHttpApi.java            # 추가: 외부 HTTP 계약
  CatalogHttpApiConfig.java      # 추가: 프록시 생성과 Bean 등록
  CatalogGateway.java            # 추가: 업무용 조회 경계
src/main/resources/
  application.yaml              # 유지: catalog.base-url
src/test/java/com/example/catalogstudy/
  CatalogClientTest.java         # 유지: 이전 테스트
  CatalogHttpApiTest.java        # 추가: 실제 프록시를 사용하는 테스트
```

의존성도 이전과 같다. `spring-boot-starter-restclient`, test scope의 `spring-boot-starter-test`·`spring-boot-starter-restclient-test`를 사용하며 Boot의 버전 관리를 따른다. 별도의 Feign 의존성이나 웹 서버·JPA·Security를 추가하지 않는다. HTTP Interface와 OpenFeign을 같은 라이브러리라고 부르지 않는다.

`CatalogClientConfig`의 `catalogRestClient` Bean은 기본 주소 `https://catalog.example.com`, 연결 timeout 2초, 읽기 timeout 3초, 자동 리다이렉트 금지를 유지한다. 이 도메인은 실제 제공 API가 아니다. 실서비스 연동에는 승인된 제공자 주소와 계약이 필요하다.

## 4. CatalogHttpApi.java: 요청 계약을 선언한다

```java
package com.example.catalogstudy; // 기존 DTO·설정과 같은 패키지다.

import java.util.List; // 검색 결과가 JSON 배열이라는 계약을 표현한다.
import org.springframework.http.ResponseEntity; // 상태·헤더·본문을 함께 받을 때 사용한다.
import org.springframework.web.bind.annotation.PathVariable; // 인수를 URL 경로 변수에 넣는다.
import org.springframework.web.bind.annotation.RequestHeader; // 인수를 요청 헤더에 넣는다.
import org.springframework.web.bind.annotation.RequestParam; // 이번 GET 요청의 쿼리 매개변수를 만든다.
import org.springframework.web.service.annotation.GetExchange; // GET 요청을 선언한다.
import org.springframework.web.service.annotation.HttpExchange; // 인터페이스 공통 HTTP 속성을 선언한다.

@HttpExchange(url = "/books", accept = "application/json") // 공통 경로와 받고 싶은 응답 형식을 정한다.
public interface CatalogHttpApi { // 구현은 뒤의 프록시 팩터리가 만든다.
    @GetExchange("/{id}") // 공통 경로 뒤에 붙여 GET /books/{id}를 구성한다.
    ResponseEntity<ExternalBook> find( // 성공 응답의 상태·헤더·책 본문을 받는다.
            @PathVariable("id") long id, // 이름을 명시해 경로의 {id}와 연결한다.
            @RequestHeader("X-Client-Name") String clientName // 호출 프로그램을 나타내는 예제 헤더다.
    ); // 메서드 본문을 작성하지 않는다.

    @GetExchange // 추가 경로 없이 GET /books를 요청한다.
    List<ExternalBook> search( // JSON 배열을 ExternalBook 목록으로 읽는다.
            @RequestParam("title") String title, // ?title=... 쿼리를 만든다.
            @RequestParam("page") int page // &page=... 쿼리를 만든다.
    ); // 검색은 요청 매핑과 제네릭 반환 타입을 배우는 저수준 예제다.
}
```

`find(1, "til-study")`를 호출하면 기준 주소와 경로가 합쳐지고, ID와 헤더 값이 들어간다. `X-Client-Name`은 **인증 수단이 아닌 설명용 헤더**다. API Key·Bearer 토큰을 소스 코드의 상수로 넣어 대체하지 않는다.

### 4.1 어떤 선언이 HTTP의 어디로 가는가?

| 선언 | 이번 요청에서의 역할 | 예 |
| --- | --- | --- |
| `@HttpExchange(url = "/books")` | 모든 메서드의 공통 경로 | `/books` |
| `@GetExchange("/{id}")` | HTTP 메서드와 개별 경로 | `GET /books/1` |
| `@PathVariable("id")` | 경로 템플릿의 값 | `1` |
| `@RequestParam("title")` | GET의 쿼리 값 | `?title=Spring` |
| `@RequestHeader("X-Client-Name")` | 요청 헤더 값 | `X-Client-Name: til-study` |
| `accept = "application/json"` | 원하는 응답 형식 | `Accept: application/json` |

이 예제의 GET 쿼리를 만들려고 문자열을 직접 이어 붙일 필요는 없다. 매개변수 이름을 명시하면 Java 인수 이름 보존 설정에 대한 의존도도 줄일 수 있다.

`@RequestBody`는 POST 등의 본문을 표현할 때 사용하고, `contentType`은 보내는 본문의 형식이다. `accept`와 목적이 다르다. 또한 `@RequestParam`은 **항상 쿼리만 뜻하지 않는다**. 폼 Content-Type에서는 폼 본문으로 처리될 수 있다. [HttpExchange의 지원 인수](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/service/annotation/HttpExchange.html)를 참고한다.

### 4.2 반환 타입이 보장하지 않는 것

`ResponseEntity<ExternalBook>`은 상태·헤더·본문을 담지만, “모든 HTTP 상태를 예외 없이 반환”한다는 뜻은 아니다. 기본 오류 처리에서 4xx·5xx는 반환 전에 예외가 된다. 204처럼 본문이 없는 응답에서는 `getBody()`가 null일 수 있으므로 뒤에서 검사한다.

`List<ExternalBook>`은 배열 응답에 맞춘 선언이다. 실제 제공자가 `{"items": [...], "total": 10}` 같은 객체를 보내면 그 구조에 맞는 별도 응답 DTO가 필요하다. 제네릭 타입을 선언했다고 응답 필드의 의미나 필수값까지 검증되는 것은 아니다.

이번 `search`에는 검색어·페이지 범위 검증이나 업무용 오류 변환을 넣지 않는다. 실서비스에서 사용하려면 별도 Gateway 메서드에서 그 계약도 정의해야 한다. 단건 조회의 404 규칙을 검색에 그대로 복사하지 않는다.

## 5. CatalogHttpApiConfig.java: 프록시를 Bean으로 만든다

여기서는 프록시 생성 과정을 눈으로 확인하려고 수동 등록한다. 이미 구성한 `catalogRestClient`를 받아 사용하므로 기본 주소와 전송 설정을 다시 적지 않는다.

```java
package com.example.catalogstudy; // 시작 클래스가 스캔하는 패키지다.

import org.springframework.beans.factory.annotation.Qualifier; // 사용할 RestClient Bean의 이름을 지정한다.
import org.springframework.context.annotation.Bean; // 프록시 객체를 Bean으로 등록한다.
import org.springframework.context.annotation.Configuration; // 설정 클래스임을 알린다.
import org.springframework.http.HttpStatusCode; // 3xx 응답을 분류한다.
import org.springframework.web.client.RestClient; // 이전 노트에서 구성한 클라이언트를 받는다.
import org.springframework.web.client.support.RestClientAdapter; // RestClient를 프록시 실행 기반에 연결한다.
import org.springframework.web.service.invoker.HttpServiceProxyFactory; // 인터페이스의 프록시를 생성한다.

@Configuration(proxyBeanMethods = false) // Bean 메서드를 직접 서로 호출하지 않는 설정이다.
public class CatalogHttpApiConfig { // HTTP 계약을 실행 가능한 객체로 연결한다.
    @Bean // 반환한 CatalogHttpApi 프록시가 주입 대상이 된다.
    CatalogHttpApi catalogHttpApi( // 테스트에서도 같은 패키지에서 직접 호출할 수 있다.
            @Qualifier("catalogRestClient") RestClient restClient // 기존 전송 설정을 가진 Bean을 선택한다.
    ) { // 별도의 RestClient Bean을 추가하는 메서드가 아니다.
        RestClient proxyClient = restClient.mutate() // 기존 설정을 바탕으로 새 빌더를 만든다.
                .defaultStatusHandler(HttpStatusCode::is3xxRedirection, (request, response) -> { // 프록시의 모든 요청에 3xx 정책을 적용한다.
                    throw new CatalogAccessException(CatalogAccessException.Reason.HTTP_STATUS, // 리다이렉트를 정상 책으로 보지 않는다.
                            response.getStatusCode().value(), null); // 확인한 상태만 기록한다.
                }) // 4xx·5xx는 기본 RestClient 오류 처리를 유지한다.
                .build(); // 원본 Bean을 바꾸지 않고 프록시에 사용할 클라이언트를 완성한다.
        RestClientAdapter adapter = RestClientAdapter.create(proxyClient); // 실제 HTTP 실행을 맡길 어댑터를 만든다.
        HttpServiceProxyFactory factory = HttpServiceProxyFactory.builderFor(adapter).build(); // 이 어댑터를 사용하는 팩터리다.
        return factory.createClient(CatalogHttpApi.class); // 인터페이스 타입으로 호출할 수 있는 프록시 객체를 반환한다.
    }
}
```

`mutate()`는 원본 RestClient의 설정을 이어받는 빌더를 제공한다. 기존 요청 팩터리와 timeout 구성을 유지하면서 프록시용 상태 정책을 더하는 것이다. [RestClient API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/client/RestClient.html)와 [프록시 팩터리 API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/service/invoker/HttpServiceProxyFactory.html)를 참고한다.

**놓치기 쉬운 변경점:** 이전 3xx 처리는 `CatalogClient.find()` 안의 요청별 `onStatus(...)`에 있었다. 그 메서드를 호출하지 않는 새 프록시에는 자동으로 전달되지 않는다. 그래서 여기서는 프록시가 쓰는 RestClient의 `defaultStatusHandler(...)`로 명시했다. 인터페이스 전환 시 기존 호출 코드의 정책이 어디에 있었는지 확인해야 한다.

전송 구현의 자동 리다이렉트 금지와 3xx 오류 분류도 서로 다른 일이다. 전자는 다른 주소를 따라갈지 결정하고, 후자는 도착한 3xx 응답을 어떻게 해석할지 결정한다. 상태 핸들러만 추가했다고 이미 따라간 요청을 되돌릴 수는 없다.

`@Qualifier`의 이름은 이전 `@Bean` 메서드 이름과 맞춘다. 실제 애플리케이션에서는 Spring이 인수를 주입하며, 뒤의 테스트에서는 이 메서드에 테스트용 RestClient를 직접 전달한다. 이 테스트만으로 Bean 탐색까지 검증한 것은 아니다.

## 6. CatalogGateway.java: 업무용 결과를 만드는 경계를 유지한다

외부 HTTP 인터페이스가 생겼어도 Service에 HTTP 예외를 모두 떠넘길 필요는 없다. Gateway는 외부 API와 내부 업무 사이에서 결과를 정리하는 객체라는 뜻으로 사용한다. Spring의 특별한 애너테이션 이름은 아니다.

가상 제공자의 단건 조회 계약은 이전과 같다. **404만 책 없음**, 다른 오류는 실패다. 실제 제공자가 경로 오류나 권한 은폐에도 404를 사용한다면 별도 오류 코드까지 검토해야 한다.

```java
package com.example.catalogstudy; // 프록시와 DTO가 있는 패키지다.

import java.util.Optional; // 책 부재를 장애와 구분해 반환한다.
import org.springframework.stereotype.Component; // Service에서 주입할 업무용 경계 객체다.
import org.springframework.web.client.ResourceAccessException; // 연결·I/O 실패를 구분한다.
import org.springframework.web.client.RestClientException; // 응답 변환 등 나머지 클라이언트 실패를 받는다.
import org.springframework.web.client.RestClientResponseException; // HTTP 오류 상태가 있는 예외를 받는다.

@Component // 생성자에 CatalogHttpApi 프록시를 주입받는다.
public class CatalogGateway { // HTTP 선언과 업무용 결과 변환을 분리한다.
    private final CatalogHttpApi api; // 실제로는 생성된 프록시 객체가 들어온다.

    public CatalogGateway(CatalogHttpApi api) { // 테스트에서도 같은 생성자를 사용한다.
        this.api = api; // 이후 호출에 재사용한다.
    }

    public Optional<ExternalBook> find(long id) { // Service가 사용할 단건 조회 메서드다.
        if (id <= 0) { // 불가능한 ID는 HTTP 요청 전에 거부한다.
            throw new IllegalArgumentException("책 ID는 양수여야 합니다."); // 입력 문제를 외부 장애로 바꾸지 않는다.
        }
        try { // 프록시 호출·응답 검증의 실패 경계다.
            ExternalBook book = api.find(id, "til-study").getBody(); // 선언형 요청을 실행하고 본문을 꺼낸다.
            if (book == null || book.id() == null || book.id().longValue() != id // 본문·ID 누락과 다른 책 응답을 거부한다.
                    || book.title() == null || book.title().isBlank()) { // 제목 누락·공백을 정상 데이터로 넘기지 않는다.
                throw new CatalogAccessException(CatalogAccessException.Reason.INVALID_RESPONSE, null, null); // HTTP 성공과 데이터 유효성을 구분한다.
            }
            return Optional.of(book); // 검증된 값만 업무 코드에 전달한다.
        } catch (RestClientResponseException ex) { // 4xx·5xx를 기본 상태 처리에서 받는다.
            if (ex.getStatusCode().value() == 404) { // 이 제공자의 단건 부재 규칙을 적용한다.
                return Optional.empty(); // 조회 성공 결과 중 하나인 책 부재다.
            }
            throw new CatalogAccessException(CatalogAccessException.Reason.HTTP_STATUS, // 인증 실패·제한·서버 장애를 보존한다.
                    ex.getStatusCode().value(), ex); // 외부 상태를 내부 API 응답에 그대로 공개하라는 뜻은 아니다.
        } catch (ResourceAccessException ex) { // HTTP 상태 없이 발생한 전송 실패를 받는다.
            throw new CatalogAccessException(CatalogAccessException.Reason.TRANSPORT, null, ex); // 책 없음과 명확히 구분한다.
        } catch (RestClientException ex) { // 이 예제에서 JSON 변환 등 나머지 실패를 분류한다.
            throw new CatalogAccessException(CatalogAccessException.Reason.INVALID_RESPONSE, null, ex); // 원인은 보존하되 외부에 그대로 노출하지 않는다.
        }
    }
}
```

요청 구성 체인은 `api.find(...)`로 바뀌었지만 입력·응답 검증과 예외 분류는 남았다. 이 코드가 길게 느껴져도 프록시가 대체한 책임과 우리가 계속 결정해야 하는 책임이 다르기 때문이다.

`CatalogAccessException`은 이전 노트의 사용자 정의 RuntimeException이므로 위의 `RestClientException` catch에 잡히지 않는다. 설정에서 던진 3xx 실패나 직접 발견한 잘못된 DTO는 그대로 전달된다.

또한 반환 타입을 `Optional`로 적는 것만으로 404 정책이 생기지 않는다. 여기서는 **Gateway가 예외를 해석한 후** `Optional.empty()`를 반환한다. 재시도도 새로 생기지 않는다. timeout·재시도 예산과 멱등성 판단은 [이전 노트](../13_09_09_External_HTTP_API_and_RestClient/09_09_External_HTTP_API_and_RestClient.md)의 기준을 유지한다.

## 7. 실제 프록시를 통과하는 클라이언트 테스트

`CatalogHttpApi`를 Mockito로 가짜 객체로 만들면 Gateway 로직은 검사할 수 있지만, 애너테이션의 오타·경로 결합·헤더·JSON 변환은 실행하지 않는다. 이번에는 실제 프록시와 RestClient를 사용하고 **전송 계층만 메모리 응답으로 대체**한다.

`MockRestServiceServer`를 빌더에 연결한 뒤 RestClient를 만들어야 한다. 이미 만든 클라이언트에 나중에 테스트 빌더를 연결해도 그 클라이언트가 바뀌는 것은 아니다. [MockRestServiceServer API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/MockRestServiceServer.html)를 참고한다.

### CatalogHttpApiTest.java 전체 코드

```java
package com.example.catalogstudy; // 설정 메서드를 직접 사용할 수 있도록 같은 패키지에 둔다.

import java.io.IOException; // 실제 네트워크 없이 I/O 실패를 재현한다.
import java.util.List; // 검색 결과 타입을 사용한다.
import org.junit.jupiter.api.AfterEach; // 매 테스트 뒤 기대 요청을 확인한다.
import org.junit.jupiter.api.BeforeEach; // 매 테스트마다 독립된 객체를 만든다.
import org.junit.jupiter.api.Test; // 일반 테스트를 선언한다.
import org.junit.jupiter.params.ParameterizedTest; // 여러 입력으로 동일한 검증을 반복한다.
import org.junit.jupiter.params.provider.ValueSource; // 반복할 상태·입력 값을 제공한다.
import org.springframework.http.HttpMethod; // 실제 요청이 GET인지 확인한다.
import org.springframework.http.HttpStatus; // 준비할 응답 상태를 표현한다.
import org.springframework.http.MediaType; // 준비할 JSON 응답의 형식을 지정한다.
import org.springframework.http.ResponseEntity; // 프록시의 전체 응답을 받는다.
import org.springframework.test.web.client.MockRestServiceServer; // RestClient의 전송을 메모리 응답으로 대체한다.
import org.springframework.test.web.client.ResponseActions; // 공통 요청 기대값 뒤에 응답을 붙인다.
import org.springframework.web.client.RestClient; // 테스트용 클라이언트를 만든다.
import org.springframework.web.client.RestClientResponseException; // 프록시 원래의 404 예외를 확인한다.
import static org.assertj.core.api.Assertions.assertThat; // 결과의 값을 검증한다.
import static org.junit.jupiter.api.Assertions.assertThrows; // 발생한 예외를 타입별로 받는다.
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*; // URL·메서드·헤더 기대값을 선언한다.
import static org.springframework.test.web.client.response.MockRestResponseCreators.*; // 성공·오류·I/O 응답을 준비한다.

class CatalogHttpApiTest { // Spring 컨텍스트를 시작하지 않는 클라이언트 테스트다.
    private MockRestServiceServer server; // 이 테스트 한 번에만 사용하는 모의 전송 서버다.
    private CatalogHttpApi api; // Mockito 대역이 아닌 실제 HTTP 프록시다.
    private CatalogGateway gateway; // 실제 결과 변환 로직이다.

    @BeforeEach // 각 일반 테스트와 매개변수 테스트 실행 전에 호출된다.
    void setUp() { // 이전 테스트의 요청 기대값이 남지 않게 한다.
        RestClient.Builder builder = RestClient.builder().baseUrl("https://catalog.example.com"); // 실제 접속하지 않을 기준 주소다.
        server = MockRestServiceServer.bindTo(builder).build(); // build 전에 메모리 전송 팩터리를 연결한다.
        api = new CatalogHttpApiConfig().catalogHttpApi(builder.build()); // 운영 코드와 같은 프록시·3xx 정책 구성을 사용한다.
        gateway = new CatalogGateway(api); // 생성자에 실제 프록시를 전달한다.
    }

    @AfterEach // 테스트 결과뿐 아니라 요청 기대값도 확인한다.
    void verifyRequests() { // 요청이 누락되면 테스트 실패로 드러난다.
        server.verify(); // expect로 선언한 요청이 수행됐는지 확인한다.
    }

    private ResponseActions expectFind() { // 단건 조회의 공통 요청 계약을 모은다.
        return server.expect(requestTo("https://catalog.example.com/books/1")) // 기준 주소·공통 경로·ID가 합쳐진 결과다.
                .andExpect(method(HttpMethod.GET)) // HTTP 메서드가 GET이어야 한다.
                .andExpect(header("Accept", "application/json")) // 인터페이스의 공통 Accept를 확인한다.
                .andExpect(header("X-Client-Name", "til-study")); // 메서드 인수가 헤더로 전달돼야 한다.
    }

    @Test // 응답 상태·본문과 단건 요청 매핑을 함께 확인한다.
    void proxyMapsFindRequest() { // 프록시의 선언 해석을 검증한다.
        expectFind().andRespond(withSuccess("{\"id\":1,\"title\":\"Spring\"}", MediaType.APPLICATION_JSON)); // 외부 응답을 준비한다.
        ResponseEntity<ExternalBook> response = api.find(1, "til-study"); // 실제 프록시를 통해 요청한다.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK); // ResponseEntity의 상태를 확인한다.
        assertThat(response.getBody()).isEqualTo(new ExternalBook(1L, "Spring")); // JSON이 record로 변환돼야 한다.
    }

    @Test // GET 쿼리와 제네릭 목록 변환을 확인한다.
    void proxyMapsSearchQueryAndList() { // 검색은 Gateway가 아닌 HTTP 계약 자체의 예제다.
        server.expect(requestTo("https://catalog.example.com/books?title=Spring&page=2")) // 선언 순서대로 구성한 쿼리를 확인한다.
                .andExpect(method(HttpMethod.GET)) // 검색도 GET 요청이다.
                .andExpect(header("Accept", "application/json")) // 공통 응답 형식이 유지돼야 한다.
                .andRespond(withSuccess("[{\"id\":1,\"title\":\"Spring\"}]", MediaType.APPLICATION_JSON)); // 최상위 배열 응답이다.
        List<ExternalBook> books = api.search("Spring", 2); // 반환 타입의 원소 정보까지 사용한다.
        assertThat(books).containsExactly(new ExternalBook(1L, "Spring")); // Map이 아닌 ExternalBook으로 읽어야 한다.
    }

    @Test // HTTP 프록시에는 업무용 404 변환이 없음을 확인한다.
    void rawProxyThrowsFor404() { // ResponseEntity 반환 타입도 오류 처리를 끄지 않는다.
        expectFind().andRespond(withStatus(HttpStatus.NOT_FOUND)); // 제공자의 404를 준비한다.
        RestClientResponseException error = assertThrows(RestClientResponseException.class, // 기본 상태 처리의 예외를 받는다.
                () -> api.find(1, "til-study")); // Gateway를 거치지 않고 호출한다.
        assertThat(error.getStatusCode().value()).isEqualTo(404); // 원래 HTTP 상태를 확인한다.
    }

    @Test // 정상 본문이 Gateway 검증을 통과하는지 확인한다.
    void gatewayReturnsValidatedBook() { // 성공 경로도 테스트한다.
        expectFind().andRespond(withSuccess("{\"id\":1,\"title\":\"Spring\"}", MediaType.APPLICATION_JSON)); // 유효한 책이다.
        assertThat(gateway.find(1)).contains(new ExternalBook(1L, "Spring")); // 검증 후 Optional에 담긴다.
    }

    @Test // 부재 해석은 Gateway 책임임을 확인한다.
    void gatewayMaps404ToEmpty() { // 바로 위 rawProxy 테스트와 같은 응답을 다르게 해석한다.
        expectFind().andRespond(withStatus(HttpStatus.NOT_FOUND)); // 단건 부재 응답이다.
        assertThat(gateway.find(1)).isEmpty(); // 예외가 아니라 빈 조회 결과를 반환한다.
    }

    @ParameterizedTest // 인증·호출 제한·외부 장애를 각각 확인한다.
    @ValueSource(ints = {401, 429, 503}) // 세 번 독립적으로 실행될 값이다.
    void gatewayPreservesOtherHttpFailures(int status) { // 404 외의 상태를 부재로 숨기지 않는다.
        expectFind().andRespond(withStatus(HttpStatus.valueOf(status))); // 지정한 HTTP 오류를 준비한다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> gateway.find(1)); // 분류된 실패를 받는다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.HTTP_STATUS); // 상태 기반 실패여야 한다.
        assertThat(error.httpStatus()).isEqualTo(status); // 상태별 후속 판단에 필요한 값을 보존한다.
    }

    @Test // 이전 onStatus 정책이 프록시에도 연결됐는지 확인한다.
    void gatewayRejectsRedirect() { // 메모리 응답의 302 분류만 확인하는 테스트다.
        expectFind().andRespond(withStatus(HttpStatus.FOUND)); // 기본 4xx·5xx 처리만으로는 부족한 사례다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> gateway.find(1)); // 새 기본 상태 핸들러가 실행된다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.HTTP_STATUS); // 리다이렉트가 성공으로 흐르지 않는다.
        assertThat(error.httpStatus()).isEqualTo(302); // 상태를 그대로 보존한다.
    }

    @Test // HTTP 성공 코드만으로 정상 책을 보장하지 못한다.
    void gatewayRejectsEmptyBody() { // 204는 본문이 없는 응답이다.
        expectFind().andRespond(withNoContent()); // getBody()가 null인 사례를 만든다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> gateway.find(1)); // Gateway가 본문 부재를 검출한다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.INVALID_RESPONSE); // 이 단건 계약에는 유효하지 않다.
    }

    @Test // JSON 구문 오류와 HTTP 오류를 구분한다.
    void gatewayRejectsMalformedJson() { // 상태는 200이지만 본문은 읽을 수 없다.
        expectFind().andRespond(withSuccess("{broken", MediaType.APPLICATION_JSON)); // 잘못된 JSON을 준비한다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> gateway.find(1)); // 변환 실패를 받는다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.INVALID_RESPONSE); // 책 없음이 아닌 응답 처리 실패다.
    }

    @ParameterizedTest // JSON을 읽을 수 있어도 내용이 잘못될 수 있다.
    @ValueSource(strings = {"{\"id\":2,\"title\":\"Spring\"}", "{\"id\":1,\"title\":\" \"}", "{\"title\":\"Spring\"}"}) // 다른 ID·빈 제목·ID 누락이다.
    void gatewayRejectsInvalidFields(String json) { // 세 종류의 값 오류를 검사한다.
        expectFind().andRespond(withSuccess(json, MediaType.APPLICATION_JSON)); // 문법은 올바른 JSON이다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> gateway.find(1)); // DTO 변환 뒤 검증해야 잡힌다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.INVALID_RESPONSE); // 잘못된 값을 정상 책으로 반환하지 않는다.
    }

    @Test // 실제로 기다리지 않고 전송 실패 분류를 확인한다.
    void gatewayPreservesTransportFailure() { // timeout 길이나 JDK 전송 자체의 테스트는 아니다.
        expectFind().andRespond(withException(new IOException("simulated I/O failure"))); // 전송 계층의 I/O 예외를 재현한다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> gateway.find(1)); // RestClient가 감싼 전송 예외를 받는다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.TRANSPORT); // HTTP 상태 실패와 구분한다.
        assertThat(error.httpStatus()).isNull(); // 존재하지 않는 상태 코드를 만들지 않는다.
    }

    @ParameterizedTest // 두 입력 모두 외부 요청 전에 거부해야 한다.
    @ValueSource(longs = {0L, -1L}) // 잘못된 ID를 각각 사용한다.
    void gatewayRejectsInvalidIdWithoutRequest(long id) { // expect를 등록하지 않아 요청이 생기면 실패한다.
        assertThrows(IllegalArgumentException.class, () -> gateway.find(id)); // 입력 오류 자체를 확인한다.
    }
}
```

### 실행 명령과 예상 결과

명령은 TIL 루트가 아니라 **별도 Java 실습 프로젝트의 `pom.xml`·Maven Wrapper가 있는 폴더**에서 실행한다.

```powershell
.\mvnw.cmd "-Dtest=CatalogHttpApiTest" test # 이번 파일만 실행해 프록시 요청 계약과 Gateway 정책을 확인한다.
.\mvnw.cmd test # 이전 CatalogClientTest를 포함한 프로젝트의 전체 테스트를 실행한다.
```

이번 클래스는 일반 테스트 9개와 매개변수별 3회·3회·2회를 합쳐 **17회 실행을 예상**한다. 이전 예제를 그대로 유지하면 기존 14회도 전체 테스트 대상에 포함된다. 생성 프로젝트에 다른 테스트가 있다면 총수는 달라진다. 이 노트에 실행 성공 로그를 제시하지는 않는다.

이 테스트가 확인하는 것은 “우리가 작성한 기대 계약에 맞는 HTTP 요청·결과 처리”다. 실제 제공자가 같은 계약을 지킨다는 증명이나 양쪽 시스템을 연동한 소비자 주도 계약 테스트 전체는 아니다.

확인하지 않는 항목은 Spring Bean 주입·실제 제공자 응답·TLS·DNS·JDK timeout·실제 리다이렉트 동작이다. 운영 팩터리를 사용해 제어 가능한 로컬 HTTP 서버와 통신하는 별도 통합 테스트가 필요하다. 공식 문서도 실제 네트워크 조건 검증에는 모의 웹 서버 활용을 안내한다. [클라이언트 애플리케이션 테스트 문서](https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html)를 참고한다.

## 8. Boot의 자동 등록 방식은 언제 살펴볼까?

이번에는 `HttpServiceProxyFactory`와 `@Bean`으로 직접 연결했다. Boot 4.1 공식 문서는 `@ImportHttpServices`로 인터페이스를 가져오고, 이름 있는 그룹에 기본 URL·timeout 등을 설정하는 방식도 안내한다. 애너테이션의 패키지는 `org.springframework.web.service.registry`다.

수동 방식은 연결 관계를 학습하거나 세부 구성을 직접 통제할 때 이해하기 쉽다. 여러 인터페이스가 같은 제공자 설정을 공유한다면 그룹 방식도 검토할 수 있다. 하지만 **이번 코드에 같은 인터페이스의 자동 등록까지 덧붙이지 않는다**. 중복 Bean과 서로 다른 설정 경로로 혼란을 만들 수 있다.

그룹 방식으로 전환하려면 기존 수동 프록시 Bean을 어떻게 대체할지, `catalog.base-url`과 직접 지정한 요청 팩터리·3xx 정책을 어디로 옮길지 함께 결정해야 한다. 설정 이름만 바꾸고 모든 동작이 동일하다고 가정하지 않는다. [Boot HTTP Service Interface Clients](https://docs.spring.io/spring-boot/reference/io/rest-client.html#io.rest-client.http-service-clients)를 참고한다.

## 9. 자주 하는 실수와 실무 판단 기준

| 증상·오해 | 원인 후보 | 확인할 내용 |
| --- | --- | --- |
| 인터페이스 주입 시 Bean을 못 찾음 | 선언만 있고 프록시 등록이 없음 | `@Bean` 또는 선택한 자동 등록 방식 |
| 경로가 잘못됨 | 공통 경로와 개별 경로의 중복 | 최종 URL을 요청 테스트로 확인 |
| 404를 받자 예외가 발생함 | 프록시의 기본 상태 처리가 실행됨 | 부재로 바꾸는 책임이 Gateway에 있는지 |
| timeout이 사라진 것 같음 | 설정된 Bean 대신 새 RestClient를 생성함 | 프록시가 어떤 클라이언트를 사용하는지 |
| 기존 3xx 정책이 누락됨 | 이전 요청별 `onStatus`를 새 경로가 거치지 않음 | 기본 상태 핸들러와 전송 리다이렉트 설정 |
| DTO가 만들어졌는데 값이 잘못됨 | 역직렬화와 의미 검증을 혼동함 | 필수 필드·요청 ID 일치·빈 값 검증 |
| 테스트는 통과하지만 실제 연결이 실패함 | 전송을 대체한 테스트만 수행함 | 실제 전송 설정을 사용하는 통합 테스트 |

인터페이스는 외부 API별로 목적이 분명하게 나눈다. URL·HTTP 메서드까지 호출자가 아무 값이나 넘기는 범용 메서드로 만들면 선언의 장점이 줄어든다. 사용자 입력으로 목적지 전체를 바꾸는 API는 SSRF 위험도 따로 다뤄야 한다.

다중 제공자에서는 서로 다른 기본 주소·인증 헤더·timeout의 클라이언트를 구분한다. 모든 제공자를 한 클라이언트에 섞거나 인증 헤더를 모든 요청에 무조건 붙이지 않는다. 조회 한 번에 재시도가 몇 번 일어나는지도 별도 정책으로 확인한다.

전환할 때는 이전 코드와 새 코드의 **성공 결과뿐 아니라 부재·오류 상태·빈 본문·잘못된 본문**도 비교한다. 이번에 기존 `CatalogClientTest`를 남겨 둔 이유다. 실제 서비스 코드는 전환한 Gateway를 명시적으로 주입해 사용하고, 같은 업무에서 두 경로를 모두 호출해 트래픽을 두 배로 만들지 않는다.

## 10. 핵심 정리

1. HTTP Interface는 외부 HTTP 계약을 Java 메서드로 선언하는 방법이다.
2. 실제 요청은 프록시·어댑터·HTTP 클라이언트·전송 구현을 거쳐 실행된다.
3. 인터페이스를 작성하는 것과 프록시를 Bean으로 등록하는 것은 별개다.
4. `RestClientAdapter`를 사용하는 이번 호출은 동기식이며 자동 재시도가 추가되지 않는다.
5. 요청별 `onStatus` 정책은 새 프록시에 자동 이전되지 않으므로 위치를 확인한다.
6. `ResponseEntity`·제네릭 반환 타입은 상태 오류나 잘못된 필드 값을 자동 해결하지 않는다.
7. Gateway는 외부의 부재·상태 오류·전송 실패·잘못된 응답을 업무용 결과로 구분한다.
8. 실제 프록시 테스트와 실제 네트워크 테스트는 검증 범위가 다르다.

다음 확장 주제는 **페이지네이션·정렬과 조회 API**다. 지금은 외부 검색 요청에 `page` 값을 전달했지만, 페이지 번호·크기·정렬을 서버가 어떻게 검증하고 DB 조회와 응답 DTO에 연결할지는 별도로 배워야 한다.

## 11. 복습 퀴즈

### Q1. `CatalogHttpApi`의 메서드에는 구현이 없는데 누가 요청을 보내는가?

<details>
<summary>정답 보기</summary>

팩터리가 생성한 프록시가 애너테이션과 인수를 해석하고, RestClientAdapter를 통해 RestClient에 실행을 맡긴다. 실제 전송은 연결된 요청 팩터리와 HTTP 구현이 수행한다.

</details>

### Q2. 반환 타입이 `ResponseEntity`이면 404도 정상 반환되는가?

<details>
<summary>정답 보기</summary>

아니다. 기본 4xx·5xx 상태 처리가 먼저 예외를 던진다. 이번에는 Gateway가 단건 404만 받아 빈 Optional로 바꾼다.

</details>

### Q3. 이전 `CatalogClient.find()`의 3xx 핸들러가 왜 새 프록시에 적용되지 않는가?

<details>
<summary>정답 보기</summary>

해당 핸들러는 이전 메서드가 만든 개별 요청에 붙어 있었다. 프록시는 그 메서드를 호출하지 않는다. 그래서 프록시가 사용하는 RestClient에 기본 상태 핸들러를 명시했다.

</details>

### Q4. 인터페이스를 Mockito로 대체한 테스트만으로 경로·헤더 선언을 검증할 수 있는가?

<details>
<summary>정답 보기</summary>

없다. 그 경우 HTTP 프록시가 선언을 해석하는 과정 자체를 건너뛴다. 실제 프록시를 호출하고 전송 계층에서 요청을 검사하는 테스트가 필요하다.

</details>

### Q5. 모의 I/O 예외 테스트가 통과하면 읽기 timeout 3초도 검증된 것인가?

<details>
<summary>정답 보기</summary>

아니다. 전송 실패의 분류만 확인했다. 실제 팩터리·전송 구현과 지연 응답을 제공하는 통제된 서버를 사용해야 timeout 동작을 확인할 수 있다.

</details>

### Q6. 수동 프록시 등록 코드에 같은 인터페이스의 자동 등록을 바로 추가해도 되는가?

<details>
<summary>정답 보기</summary>

중복 Bean이나 다른 설정 경로를 만들 수 있다. 한 가지 등록 방식을 선택하고 주소·전송·상태 처리 정책을 어떻게 이전할지 확인한 뒤 전환한다.

</details>

## 12. 공식 문서로 이어서 읽기

- [Spring Framework REST Clients](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html): HTTP Service 인터페이스, 인수·반환값과 오류 처리
- [HttpExchange API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/service/annotation/HttpExchange.html): 공통 경로·Accept·Content-Type과 매개변수 의미
- [RestClientAdapter API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/client/support/RestClientAdapter.html): RestClient와 프록시 실행 기반 연결
- [HttpServiceProxyFactory API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/service/invoker/HttpServiceProxyFactory.html): 팩터리 구성과 클라이언트 생성
- [Spring Boot REST 서비스 호출](https://docs.spring.io/spring-boot/reference/io/rest-client.html): Boot 구성과 HTTP 인터페이스 그룹
- [MockRestServiceServer API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/MockRestServiceServer.html): 빌더 연결·요청 기대값·검증
- [Spring 클라이언트 테스트](https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html): 모의 응답과 실제 전송 테스트의 범위
