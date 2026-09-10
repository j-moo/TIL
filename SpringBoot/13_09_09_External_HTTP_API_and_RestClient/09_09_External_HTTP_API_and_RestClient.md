# 외부 HTTP API 연동: RestClient·timeout·오류 분류와 재시도 판단

- 🎯 학습 목표: 외부 API 호출을 별도 객체로 분리하고, 정상 응답·자원 부재·HTTP 오류·전송 실패·잘못된 응답을 구분한다.
- 🧩 핵심 키워드: RestClient, ClientHttpRequestFactory, connect/read timeout, DTO, RestClientException, MockRestServiceServer, 멱등성, backoff
- ⭐ 중요도: ★★★★★ — 외부 서버의 지연과 실패가 우리 서버의 스레드·응답 시간·데이터 처리에 영향을 준다.
- 📝 한눈에 보는 내용: 책 정보 조회를 예제로 요청 구성과 응답 변환을 익힌다. 연결·응답 대기 설정을 명시하고, 재시도는 실패 종류·중복 효과·시간 예산을 따져 결정한다.
- 🧱 선수 지식: Java record·Optional·예외, 생성자 주입, HTTP 상태 코드, 외부 설정과 테스트 범위
- 🔗 이전 노트: [로깅·Actuator·상태 점검](../12_09_08_Operations_Logging_and_Actuator/09_08_Operations_Logging_and_Actuator.md)

> 정리 기준일: 2026-09-09. Spring Boot 4.1·Spring Framework 7.0 계열의 공식 문서와 Java 21 API를 참고했다. 별도 학습 프로젝트용 코드이며 TIL 저장소에서 Java 컴파일·Spring 테스트를 실행한 결과는 아니다. 외부 URL은 설명용 도메인이고 실제 제공 서비스를 조회하지 않았다. 아래 테스트의 응답은 메모리에서 준비한다.

## 1. 내 서버가 다른 서버의 클라이언트가 되는 순간

도서 서비스가 외부 도서 목록 서버에서 책 제목을 가져온다고 하자. 브라우저 관점에서 우리 서버는 요청을 받는 서버지만, 외부 목록 서버를 호출할 때는 HTTP 클라이언트가 된다.

이때 외부 서버가 느리면 우리 요청 처리도 기다린다. 외부 서버가 반환한 404와 연결 실패를 모두 “책 없음”으로 처리하면 실제 장애를 정상 결과처럼 숨기게 된다. 반대로 모든 실패를 무조건 재시도하면 요청량과 대기 시간이 커진다.

이번 실습은 **외부 책 한 권을 조회하는 클라이언트 객체**까지만 만든다. 사용자용 Controller, DB 저장, 인증 토큰 발급, 자동 재시도·회로 차단기 구현은 포함하지 않는다. 먼저 실패를 정확히 구분하는 경계를 만든다.

## 2. 전체 흐름과 실패 지점을 그린다

```text
우리 Service
  → CatalogClient: 외부 조회 계약
  → RestClient: 메서드·URI·헤더·응답 변환
  → ClientHttpRequestFactory: 실제 HTTP 전송 구현 연결
  → JDK HttpClient: 연결과 요청 수행
  → 외부 도서 API
  → HTTP 상태 확인 → JSON 변환 → 값 검증
  → 책 정보 / 책 없음 / 분류된 실패
```

`RestClient`는 동기식 클라이언트다. 호출한 실행 흐름은 응답 처리 결과가 나올 때까지 기다린다. API가 체인 형태로 이어진다고 비동기 실행이 되는 것은 아니다. `WebClient`는 비차단·반응형 흐름을 위한 별도 선택지다.

Framework 7.0 문서에서는 기존 `RestTemplate`을 deprecated로 안내하고 `RestClient`를 대안으로 제시한다. 이것을 모든 과거 버전에 소급하거나 기존 코드가 즉시 실행 불가능하다는 뜻으로 해석하지 않는다. 이번에는 동기식 Service 흐름과 연결하기 쉬운 RestClient를 사용한다. [Spring REST Clients 문서](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)를 참고한다.

## 3. timeout은 어떤 기다림을 제한하는가?

| 개념 | 질문 | 주의점 |
| --- | --- | --- |
| 연결 timeout | 새 연결을 만드는 데 얼마나 기다릴 것인가? | 재사용 연결에는 같은 연결 수립 과정이 없을 수 있다. |
| 응답·읽기 timeout | 응답을 기다리는 시간을 어떻게 제한할 것인가? | 적용 구간은 실제 HTTP 구현에 따라 확인해야 한다. |
| 연결 풀 대기 제한 | 사용 가능한 연결을 얻기까지 얼마나 기다릴 것인가? | 풀을 쓰는 구현에서는 별도 설정일 수 있다. |
| 전체 시간 예산 | 이 업무 호출 전체에 얼마를 쓸 수 있는가? | 여러 시도·대기·변환·다른 작업을 함께 고려한다. |

이번 예제는 JDK HttpClient에 연결 timeout 2초, Spring의 JDK 요청 팩터리에 읽기 timeout 3초를 지정한다. 두 숫자를 더해서 “항상 정확히 5초 안에 끝난다”고 판단하면 안 된다. DNS·TLS·본문 수신·재사용 연결·취소 동작 등은 구현과 상황에 따라 검증해야 한다.

JDK의 연결 timeout은 새 연결이 필요한 경우에 의미가 있다. `JdkClientHttpRequestFactory.setReadTimeout`은 해당 팩터리의 API이며 다른 팩터리의 동일 이름 옵션과 범위가 같다고 가정하지 않는다. [JDK HttpClient.Builder](https://docs.oracle.com/en/java/javase/21/docs/api/java.net.http/java/net/http/HttpClient.Builder.html), [JdkClientHttpRequestFactory API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/client/JdkClientHttpRequestFactory.html)를 참고한다.

timeout은 상대 서버에 “작업을 취소했다”는 확정 신호가 아니다. 특히 변경 요청은 클라이언트가 기다리기를 중단한 뒤에도 상대 서버에서 완료될 수 있다. 이 차이가 뒤의 재시도 판단과 연결된다.

## 4. 별도 실습 프로젝트와 파일 구조

이전 보안·운영 프로젝트와 분리해 새 Maven·Java 21·Boot 4.1 계열 실습 프로젝트를 준비한다. 외부 호출 경계에 집중하기 위해 웹 서버·JPA·Security는 추가하지 않는다.

| 의존성 | 용도 |
| --- | --- |
| `spring-boot-starter-restclient` | RestClient와 메시지 변환·Boot 구성 지원 |
| `spring-boot-starter-test` | JUnit·AssertJ 등 테스트 도구, test scope |
| `spring-boot-starter-restclient-test` | HTTP 클라이언트 테스트 지원, test scope |

버전은 Boot의 의존성 관리를 사용한다. Maven 빌드 파일·Wrapper는 Initializr 등으로 준비하고, 기본 생성 프로젝트에 필요한 Starter가 들어 있는지 확인한다. [Boot Starter 목록](https://docs.spring.io/spring-boot/reference/using/build-systems.html)을 참고한다.

```text
src/main/java/com/example/catalogstudy/
  CatalogStudyApplication.java
  CatalogClientConfig.java
  ExternalBook.java
  CatalogAccessException.java
  CatalogClient.java
src/main/resources/
  application.yaml
src/test/java/com/example/catalogstudy/
  CatalogClientTest.java
```

각 public 타입은 이름에 맞는 개별 파일로 저장한다. 아래는 이 구조에 필요한 Java 구성 요소다. 시작 클래스는 Bean 구성을 확인하는 용도이고, 시작하자마자 실제 외부 요청을 보내는 코드는 넣지 않는다.

```java
package com.example.catalogstudy; // 실습의 공통 기준 패키지다.

import org.springframework.boot.SpringApplication; // 애플리케이션 시작 도구다.
import org.springframework.boot.autoconfigure.SpringBootApplication; // 자동 설정과 컴포넌트 스캔을 활성화한다.

@SpringBootApplication // 같은 패키지와 하위의 설정·컴포넌트를 찾는다.
public class CatalogStudyApplication { // 파일명은 CatalogStudyApplication.java다.
    public static void main(String[] args) { // 직접 실행할 때의 진입점이다.
        SpringApplication.run(CatalogStudyApplication.class, args); // Bean을 준비한다. 책 조회를 자동 실행하지는 않는다.
    }
}
```

`application.yaml`에는 설명용 주소를 둔다. `catalog.example.com`은 실습 설명용이며 실제 도서 제공 API가 아니다. 테스트에서는 이 주소도 메모리 응답으로 가로채므로 인터넷을 호출하지 않는다.

```yaml
catalog: # 외부 도서 조회 설정을 묶는다.
  base-url: https://catalog.example.com # 실제 연동 시 운영자가 승인한 제공자 주소로 변경한다.
```

## 5. HTTP 클라이언트 구성은 호출 코드와 분리한다

`CatalogClientConfig.java`는 실제 전송 방식과 기본 주소를 지정한다. Boot가 준비한 `RestClient.Builder`를 주입받고, 이 클라이언트에 한해 JDK 팩터리를 명시한다.

```java
package com.example.catalogstudy; // 시작 클래스의 스캔 범위다.

import java.net.URI; // 외부 서버 주소를 구조적으로 확인한다.
import java.net.http.HttpClient; // 이번 예제에서 사용할 JDK 전송 구현이다.
import java.time.Duration; // timeout을 단위가 있는 값으로 표현한다.
import org.springframework.beans.factory.annotation.Value; // 외부 설정의 주소를 받는다.
import org.springframework.context.annotation.Bean; // 완성한 클라이언트를 Bean으로 등록한다.
import org.springframework.context.annotation.Configuration; // 설정 클래스임을 표시한다.
import org.springframework.http.client.JdkClientHttpRequestFactory; // JDK HttpClient를 RestClient에 연결한다.
import org.springframework.web.client.RestClient; // 외부 HTTP 요청을 구성하는 API다.

@Configuration(proxyBeanMethods = false) // Bean 사이의 직접 메서드 호출이 없는 설정이다.
public class CatalogClientConfig { // HTTP 전송 설정을 한곳에 모은다.
    @Bean // CatalogClient에 주입할 RestClient를 만든다.
    RestClient catalogRestClient( // 이 실습에는 RestClient Bean이 하나뿐이다.
            RestClient.Builder builder, // Boot가 메시지 변환 등을 준비한 빌더를 받는다.
            @Value("${catalog.base-url}") URI baseUrl // 코드와 분리한 제공자 주소를 받는다.
    ) { // 사용자 요청으로 전달받은 임의 URL을 사용하지 않는다.
        if (!"https".equalsIgnoreCase(baseUrl.getScheme()) || baseUrl.getHost() == null) { // 최소한의 주소 형식을 확인한다.
            throw new IllegalArgumentException("catalog.base-url은 HTTPS 서버 주소여야 합니다."); // 잘못된 설정으로 시작하지 않는다.
        }
        HttpClient transport = HttpClient.newBuilder() // 실제 전송 클라이언트를 구성한다.
                .connectTimeout(Duration.ofSeconds(2)) // 새 연결 수립 대기에 제한을 둔다.
                .followRedirects(HttpClient.Redirect.NEVER) // 다른 주소로 자동 이동하지 않게 한다.
                .build(); // 재사용할 전송 객체를 완성한다.
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(transport); // Spring 요청 팩터리로 감싼다.
        factory.setReadTimeout(Duration.ofSeconds(3)); // 이 팩터리가 제공하는 읽기 timeout을 설정한다.
        return builder.baseUrl(baseUrl.toString()) // 상대 경로 요청에 사용할 기준 주소를 설정한다.
                .requestFactory(factory) // 이 클라이언트는 위에서 선택한 전송 설정을 사용한다.
                .build(); // 호출마다 새로 만들지 않고 완성된 RestClient를 재사용한다.
    }
}
```

여기서는 전송 팩터리를 직접 지정했으므로 Boot가 자동 선택하는 팩터리나 전역 HTTP 설정이 모두 그대로 적용된다고 가정하지 않는다. 라이브러리 추가로 전송 구현이 바뀌는 것을 피하려고 선택을 명시했다. Boot는 미리 구성한 빌더를 제공하며, 직접 `RestClient.create()`만 호출하는 방식과 구성 경로가 다르다. [Boot REST 서비스 호출 문서](https://docs.spring.io/spring-boot/reference/io/rest-client.html)를 참고한다.

주소의 HTTPS 형식 확인은 완성된 SSRF 방어가 아니다. SSRF는 서버가 공격자가 고른 주소로 요청하게 되는 문제다. 실제로는 승인된 목적지·포트, DNS·리다이렉트, 내부망 접근과 송신 정책도 관리한다. 이번 호출 메서드는 URL이 아닌 숫자 ID만 받고, 기본 주소는 신뢰하는 운영 설정에서만 정한다.

## 6. 외부 응답과 실패의 계약을 먼저 정의한다

### 6.1 ExternalBook.java: 외부 JSON 전용 DTO

```java
package com.example.catalogstudy; // 클라이언트와 테스트에서 공유한다.

public record ExternalBook(Long id, String title) { // 외부 JSON의 id·title을 받는다. 누락 가능성을 검사하려고 Long을 쓴다.
}
```

이 DTO는 DB Entity가 아니다. 외부 업체의 응답 형식과 내부 저장 모델을 분리하면 업체 필드가 바뀔 때 영향을 제한하기 쉽다. HTTP가 200이어도 필수 필드가 빠질 수 있으므로 JSON을 읽은 뒤 값도 검증한다.

### 6.2 CatalogAccessException.java: 실패 종류를 보존한다

이 예제는 외부 응답 실패를 아래 세 종류로 나눈다. `httpStatus`는 HTTP 응답 상태를 확인했을 때만 저장하고, 전송 실패에는 임의의 500을 넣지 않는다.

```java
package com.example.catalogstudy; // 외부 조회 실패를 표현하는 공통 타입이다.

public class CatalogAccessException extends RuntimeException { // Service가 외부 실패를 구분해 받을 수 있는 예외다.
    public enum Reason { HTTP_STATUS, TRANSPORT, INVALID_RESPONSE } // 상태 오류·전송 오류·응답 해석 실패를 나눈다.

    private final Reason reason; // 실패 범주를 보관한다.
    private final Integer httpStatus; // HTTP 응답이 없거나 확인하지 못했다면 null이다.

    public CatalogAccessException(Reason reason, Integer httpStatus, Throwable cause) { // 필요한 진단 정보만 받는다.
        super("외부 도서 조회를 완료하지 못했습니다.", cause); // 공개 가능한 고정 메시지를 사용한다.
        this.reason = reason; // 실패 종류를 저장한다.
        this.httpStatus = httpStatus; // 확인한 HTTP 상태만 저장한다.
    }

    public Reason reason() { // 호출자가 실패 종류를 읽는 메서드다.
        return reason; // 메시지 문자열 파싱 대신 명시적인 값으로 판단하게 한다.
    }

    public Integer httpStatus() { // 확인한 외부 HTTP 상태를 읽는다.
        return httpStatus; // null은 성공이 아니라 HTTP 상태를 보관하지 않았다는 뜻이다.
    }
}
```

원인 예외를 보존해도 응답 본문이나 stack trace를 사용자에게 그대로 반환하면 안 된다. 원인에는 주소·응답 내용·내부 정보가 들어 있을 수 있다. 로그와 공개 오류 응답은 별도의 정책으로 처리한다.

## 7. CatalogClient에서 요청·변환·실패를 연결한다

이 가상 제공자의 계약은 `GET /books/{id}`에 대해 200이면 책 한 권, 404이면 해당 책 없음이다. 실제 제공자가 경로 오류·권한 은폐에도 404를 쓴다면 이 가정을 그대로 적용할 수 없으며 오류 코드까지 검토해야 한다.

```java
package com.example.catalogstudy; // 설정·DTO와 같은 패키지다.

import java.util.Optional; // 책 없음과 조회 실패를 다른 결과로 표현한다.
import org.springframework.http.HttpStatusCode; // 리다이렉트 상태를 검사한다.
import org.springframework.http.MediaType; // JSON 응답을 요청할 때 사용한다.
import org.springframework.stereotype.Component; // 실제 애플리케이션에서 클라이언트를 Bean으로 등록한다.
import org.springframework.web.client.ResourceAccessException; // 연결·I/O 계열 실패를 구분한다.
import org.springframework.web.client.RestClient; // 요청과 응답 변환을 수행한다.
import org.springframework.web.client.RestClientException; // 나머지 클라이언트 처리 실패를 받는다.
import org.springframework.web.client.RestClientResponseException; // HTTP 오류 상태가 있는 실패를 받는다.

@Component // Service가 생성자 주입으로 사용할 외부 조회 객체다.
public class CatalogClient { // 외부 서버의 세부 호출 방식을 이 경계 안에 둔다.
    private final RestClient restClient; // 설정된 클라이언트를 보관한다.

    public CatalogClient(RestClient restClient) { // 테스트에서는 전송을 대체한 RestClient를 받을 수 있다.
        this.restClient = restClient; // 호출마다 새 클라이언트를 만들지 않는다.
    }

    public Optional<ExternalBook> find(long id) { // ID 하나에 대한 외부 조회 계약이다.
        if (id <= 0) { // 잘못된 입력으로 외부 트래픽을 만들지 않는다.
            throw new IllegalArgumentException("책 ID는 양수여야 합니다."); // 호출자 입력 오류로 즉시 거부한다.
        }
        try { // 외부 호출에서 발생하는 실패를 분류한다.
            ExternalBook book = restClient.get() // 조회 목적이므로 GET을 사용한다.
                    .uri("/books/{id}", id) // 숫자 ID를 URI 템플릿 변수로 전달한다.
                    .accept(MediaType.APPLICATION_JSON) // 받을 수 있는 응답 형식을 JSON으로 알린다.
                    .retrieve() // 응답 처리 명세를 만든다. 이 호출 하나만으로 요청을 완료하지 않는다.
                    .onStatus(HttpStatusCode::is3xxRedirection, (request, response) -> { // 이 계약에서는 리다이렉트를 성공으로 보지 않는다.
                        throw new CatalogAccessException(CatalogAccessException.Reason.HTTP_STATUS, // 명시적인 HTTP 상태 실패다.
                                response.getStatusCode().value(), null); // 리다이렉트 상태만 기록하고 따라가지 않는다.
                    }) // 4xx·5xx는 RestClient의 기본 오류 처리에 맡긴다.
                    .body(ExternalBook.class); // 요청을 수행하고 JSON을 DTO로 변환하는 종결 연산이다.
            if (book == null || book.id() == null || book.id().longValue() != id // 본문·ID가 없거나 요청한 책과 다르면 계약 위반이다.
                    || book.title() == null || book.title().isBlank()) { // 제목 누락·공백도 정상 책으로 취급하지 않는다.
                throw new CatalogAccessException(CatalogAccessException.Reason.INVALID_RESPONSE, null, null); // 잘못된 응답 값으로 분류한다.
            }
            return Optional.of(book); // 검증된 책 결과만 반환한다.
        } catch (RestClientResponseException ex) { // 기본 4xx·5xx 응답 오류를 먼저 잡는다.
            if (ex.getStatusCode().value() == 404) { // 이 제공자 계약에서 책 없음으로 정의한 상태다.
                return Optional.empty(); // 장애가 아니라 조회 결과의 부재를 반환한다.
            }
            throw new CatalogAccessException(CatalogAccessException.Reason.HTTP_STATUS, // 다른 상태를 책 없음으로 숨기지 않는다.
                    ex.getStatusCode().value(), ex); // 401·429·503 등의 실제 상태를 보존한다.
        } catch (ResourceAccessException ex) { // HTTP 상태 없이 발생한 전송 계열 실패를 분리한다.
            throw new CatalogAccessException(CatalogAccessException.Reason.TRANSPORT, null, ex); // 무조건 timeout이라고 단정하지 않는다.
        } catch (RestClientException ex) { // JSON 변환·지원하지 않는 응답 형식 등 나머지 처리 실패다.
            throw new CatalogAccessException(CatalogAccessException.Reason.INVALID_RESPONSE, null, ex); // 정상 빈 결과와 구분한다.
        }
    }
}
```

`retrieve()`만 호출하고 끝내면 종결 연산이 빠진다. 이 예제에서는 `body()`가 응답을 받아 변환하는 단계다. 응답 본문이 필요 없다면 `toBodilessEntity()` 같은 목적에 맞는 종결 연산을 사용한다. `onStatus`는 선택한 HTTP 상태 처리를 바꾸지만 모든 네트워크 실패를 처리하는 콜백은 아니다. [RestClient 응답 처리 설명](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html#rest-restclient)을 참고한다.

여기서 `TRANSPORT`에는 연결 거부·DNS·TLS·timeout 등 원인이 들어갈 수 있다. `ResourceAccessException`이라는 타입만 보고 전부 “3초 timeout”으로 표시하면 진단이 틀릴 수 있다. 나머지 `RestClientException`은 이 작은 예제에서 응답 처리 실패로 묶었지만, 실제 연동에서는 원인과 제공자 계약에 맞춰 더 세분화할 수 있다. [ResourceAccessException API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/client/ResourceAccessException.html)를 참고한다.

또한 외부 서버의 401을 그대로 우리 API 사용자의 401로 반환하면 잘못된 로그인 안내를 하게 될 수 있다. 이는 우리 서버가 외부 서버에 제출한 자격 증명의 문제일 수 있다. 사용자용 API의 상태 코드·오류 메시지는 Service·예외 처리 계층에서 별도로 설계한다.

## 8. 실제 외부 서버 없이 실패 계약부터 테스트한다

### 8.1 MockMvc와 MockRestServiceServer는 방향이 다르다

MockMvc는 **우리 서버로 들어오는 요청**을 검사한다. MockRestServiceServer는 **우리 코드가 내보내는 요청**의 전송을 대체해 응답을 준비한다. 이름에 Server가 있어도 실제 네트워크 포트를 여는 외부 서버가 아니다.

테스트는 RestClient 빌더에 mock 서버를 연결한 뒤 그 빌더로 클라이언트를 만든다. 따라서 앞 절의 JDK 팩터리·timeout 설정은 이 테스트에서 실행되지 않는다. 이 분리가 어떤 검증을 얻고 잃는지 분명히 한다. [Spring 클라이언트 테스트 문서](https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html)를 참고한다.

### 8.2 CatalogClientTest.java

아래는 일반 JUnit 테스트다. Spring 컨텍스트를 불러오지 않으며 각 테스트마다 새 클라이언트와 새 기대 요청을 준비한다. 매개변수 테스트까지 합쳐 **14회 실행**을 예상한다.

```java
package com.example.catalogstudy; // 검사할 클라이언트·DTO와 같은 패키지다.

import static org.assertj.core.api.Assertions.assertThat; // 반환값과 실패 정보를 비교한다.
import static org.junit.jupiter.api.Assertions.assertThrows; // 기대한 예외 객체를 받아 검증한다.
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header; // 외부 요청의 헤더를 확인한다.
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method; // 외부 요청의 메서드를 확인한다.
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo; // 외부 요청의 URL을 확인한다.
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException; // I/O 실패를 준비한다.
import static org.springframework.test.web.client.response.MockRestResponseCreators.withNoContent; // 본문 없는 204를 준비한다.
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus; // 원하는 HTTP 상태를 준비한다.
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess; // JSON 성공 응답을 준비한다.

import java.io.IOException; // 실제 네트워크 대기 없이 전송 실패를 모사한다.
import java.util.Optional; // 조회 결과를 확인한다.
import org.junit.jupiter.api.AfterEach; // 기대한 요청이 수행됐는지 확인한다.
import org.junit.jupiter.api.BeforeEach; // 각 테스트를 독립적으로 준비한다.
import org.junit.jupiter.api.Test; // 일반 테스트 메서드를 선언한다.
import org.junit.jupiter.params.ParameterizedTest; // 여러 값에 동일한 검증을 적용한다.
import org.junit.jupiter.params.provider.ValueSource; // 반복할 입력 목록을 제공한다.
import org.springframework.http.HttpHeaders; // Accept 헤더 이름을 사용한다.
import org.springframework.http.HttpMethod; // GET 요청인지 확인한다.
import org.springframework.http.HttpStatus; // 응답 상태 상수를 사용한다.
import org.springframework.http.HttpStatusCode; // 매개변수의 숫자를 상태 코드로 바꾼다.
import org.springframework.http.MediaType; // JSON 응답 형식을 지정한다.
import org.springframework.test.web.client.MockRestServiceServer; // 실제 전송 대신 요청·응답을 연결한다.
import org.springframework.web.client.RestClient; // 실제 요청 구성·응답 변환 코드를 실행한다.

class CatalogClientTest { // 테스트 자체에는 SpringBootTest가 필요하지 않다.
    private MockRestServiceServer server; // 테스트마다 새로 만드는 전송 대체 도구다.
    private CatalogClient client; // 검증할 실제 외부 조회 객체다.

    @BeforeEach // 매개변수별 실행 전에도 준비한다.
    void setUp() { // 이전 테스트의 요청 기록과 기대값을 공유하지 않는다.
        RestClient.Builder builder = RestClient.builder().baseUrl("https://catalog.example.com"); // 설명용 주소로 빌더를 만든다.
        server = MockRestServiceServer.bindTo(builder).build(); // build 전에 전송을 mock 서버로 연결한다.
        client = new CatalogClient(builder.build()); // 실제 클라이언트 로직에 대체된 전송을 주입한다.
    }

    @AfterEach // 테스트 뒤 준비한 요청이 빠지지 않았는지 확인한다.
    void verifyRequests() { // 기대하지 않은 추가 요청도 테스트 도중 실패하게 된다.
        server.verify(); // 등록한 기대 요청들이 충족됐는지 확인한다.
    }

    @Test // 정상 요청과 JSON 변환을 확인한다.
    void 책을_조회한다() { // ID 7번 책을 한 번 조회한다.
        server.expect(requestTo("https://catalog.example.com/books/7")) // 주소와 경로 변수 확장을 검사한다.
                .andExpect(method(HttpMethod.GET)) // 조회 메서드가 GET인지 확인한다.
                .andExpect(header(HttpHeaders.ACCEPT, "application/json")) // 요청한 응답 형식을 확인한다.
                .andRespond(withSuccess("{\"id\":7,\"title\":\"HTTP 첫걸음\"}", MediaType.APPLICATION_JSON)); // 정상 JSON을 준비한다.
        Optional<ExternalBook> result = client.find(7L); // 실제 호출·변환 코드를 실행한다.
        assertThat(result).contains(new ExternalBook(7L, "HTTP 첫걸음")); // DTO 값과 결과 존재를 검증한다.
    }

    @Test // 제공자 계약의 책 없음을 검사한다.
    void 책이_없으면_빈결과다() { // 404만 정상 부재로 바꾸는지 확인한다.
        server.expect(requestTo("https://catalog.example.com/books/7")) // 같은 조회 경로를 사용한다.
                .andRespond(withStatus(HttpStatus.NOT_FOUND)); // 외부 서버의 404를 준비한다.
        assertThat(client.find(7L)).isEmpty(); // 예외가 아닌 명시적 부재 결과다.
    }

    @ParameterizedTest // 여러 HTTP 실패를 같은 규칙으로 확인한다.
    @ValueSource(ints = {401, 403, 429, 500, 503}) // 인증·권한·제한·서버 실패를 각각 검사한다.
    void 다른_HTTP_오류는_빈결과가_아니다(int statusCode) { // 각 상태별로 테스트가 한 번씩 실행된다.
        server.expect(requestTo("https://catalog.example.com/books/7")) // 외부 조회를 한 번 기대한다.
                .andRespond(withStatus(HttpStatusCode.valueOf(statusCode))); // 이번 상태의 오류 응답을 준비한다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> client.find(7L)); // 실패를 숨기지 않아야 한다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.HTTP_STATUS); // HTTP 상태가 있는 오류로 분류한다.
        assertThat(error.httpStatus()).isEqualTo(statusCode); // 실제 상태를 보존한다.
    }

    @Test // 성공 계열 상태여도 필요한 본문이 없으면 실패다.
    void 본문없는_응답은_계약위반이다() { // 이 조회는 책 DTO를 요구한다.
        server.expect(requestTo("https://catalog.example.com/books/7")) // 책 조회를 기대한다.
                .andRespond(withNoContent()); // HTTP 204로 본문이 없음을 재현한다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> client.find(7L)); // 빈 정상 결과로 바꾸지 않는다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.INVALID_RESPONSE); // 응답 계약 위반이다.
    }

    @Test // JSON 파싱 실패도 외부 응답 실패로 전달한다.
    void 잘못된_JSON은_실패다() { // 상태 코드만 확인하면 놓치는 사례다.
        server.expect(requestTo("https://catalog.example.com/books/7")) // 외부 조회를 기대한다.
                .andRespond(withSuccess("not-json", MediaType.APPLICATION_JSON)); // JSON이라 선언했지만 문법이 잘못됐다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> client.find(7L)); // 변환 실패를 관찰한다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.INVALID_RESPONSE); // 읽을 수 없는 응답이다.
    }

    @Test // 파싱이 되더라도 필수 필드가 있어야 한다.
    void 제목없는_DTO는_실패다() { // DTO 값 검증을 확인한다.
        server.expect(requestTo("https://catalog.example.com/books/7")) // 같은 책 조회를 기대한다.
                .andRespond(withSuccess("{\"id\":7}", MediaType.APPLICATION_JSON)); // title이 없는 JSON이다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> client.find(7L)); // 잘못된 값은 반환하지 않는다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.INVALID_RESPONSE); // 값 수준의 계약 위반이다.
    }

    @Test // HTTP 상태를 받지 못한 전송 실패를 확인한다.
    void 전송_실패에는_HTTP_상태를_만들지_않는다() { // timeout을 실제로 기다리는 테스트가 아니다.
        server.expect(requestTo("https://catalog.example.com/books/7")) // 외부 요청 경로를 기대한다.
                .andRespond(withException(new IOException("simulated transport failure"))); // I/O 예외를 즉시 발생시킨다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> client.find(7L)); // 전송 오류 분류를 확인한다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.TRANSPORT); // HTTP 오류와 구별한다.
        assertThat(error.httpStatus()).isNull(); // 받지 못한 상태를 500으로 꾸미지 않는다.
    }

    @Test // 명시적으로 허용하지 않은 리다이렉트 응답을 확인한다.
    void 리다이렉트는_정상_책이_아니다() { // 목적지 자동 이동 대신 실패로 처리한다.
        server.expect(requestTo("https://catalog.example.com/books/7")) // 첫 요청만 기대한다.
                .andRespond(withStatus(HttpStatus.FOUND)); // 302 응답을 준비한다.
        CatalogAccessException error = assertThrows(CatalogAccessException.class, () -> client.find(7L)); // onStatus의 분기를 확인한다.
        assertThat(error.reason()).isEqualTo(CatalogAccessException.Reason.HTTP_STATUS); // 리다이렉트 상태를 오류로 보존한다.
        assertThat(error.httpStatus()).isEqualTo(302); // 받은 상태를 확인한다.
    }

    @ParameterizedTest // 잘못된 ID의 두 경계값을 검사한다.
    @ValueSource(longs = {0L, -1L}) // 0과 음수는 외부 조회 대상이 아니다.
    void 잘못된_ID는_외부호출하지_않는다(long id) { // 기대 요청을 등록하지 않는다.
        assertThrows(IllegalArgumentException.class, () -> client.find(id)); // 네트워크 요청 구성 전 입력을 거부해야 한다.
    }
}
```

`withException`은 I/O 예외를 즉시 공급한다. 실제 연결 지연이나 3초 뒤 timeout 발생을 검증하지 않는다. `withStatus(503)` 역시 외부 제공자의 실제 부하·복구를 재현하지 않는다. [MockRestResponseCreators API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/response/MockRestResponseCreators.html)를 참고한다.

일반 테스트 7개, HTTP 상태 입력 5개, 잘못된 ID 입력 2개로 총 14회 실행을 예상한다. 별도 Maven 실습 프로젝트 루트의 PowerShell에서 실행한다.

```powershell
# 외부 HTTP 요청과 응답 분류에 대한 테스트를 실행한다.
./mvnw.cmd '-Dtest=CatalogClientTest' test
```

### 8.3 실제 timeout 검증은 별도 실험이다

다음 단계에서는 로컬 mock 웹 서버를 실제 포트에 열고 **실제 JDK 팩터리**를 사용해 지연·연결 종료·리다이렉트·본문 수신 중단을 검사한다. 테스트 서버 시작·종료와 요청 수를 통제하고 임의의 공용 사이트로 장애를 만들지 않는다.

허용 시간 범위는 실행 환경의 스케줄링 오차를 고려하고, 예외 종류·경과 시간·남은 요청을 함께 확인한다. 이번 메모리 테스트는 전송 구현·TLS·DNS·실제 timeout·Boot Bean 주입 구성을 검증하지 않았다는 한계를 남긴다.

## 9. 어떤 실패를 재시도해야 할까?

### 9.1 “다시 보내도 되는가”가 먼저다

멱등성(idempotency)은 동일 요청을 여러 번 적용해도 서버에 의도한 효과가 한 번 적용한 것과 같다는 성질이다. 응답 문자열이 매번 완전히 같다는 뜻은 아니다. GET 조회와 결제 생성 POST의 재시도 위험이 다른 이유다.

외부 결제가 성공한 직후 응답이 끊기면 우리 쪽에는 전송 실패만 보일 수 있다. 같은 생성 요청을 다시 보내면 중복 결제가 생길 수 있으므로, 멱등성 키·작업 상태 조회·제공자 계약 등 근거 없이 재전송하지 않는다. [RFC 9110의 멱등성과 재시도](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)를 참고한다.

| 실패 상황 | 우선 판단 |
| --- | --- |
| 400 또는 잘못된 요청 값 | 입력·계약을 고치기 전 같은 요청을 반복하지 않는다. |
| 401·403 | 외부 자격 증명·권한·설정을 확인한다. 무작정 반복하지 않는다. |
| 계약상 책 없음인 404 | 정상 부재 결과를 처리한다. |
| 429 | 제공자의 제한 정책과 Retry-After, 남은 시간 예산을 확인한다. |
| 502·503·504 등 일시적 실패 가능성 | 작업의 멱등성·제공자 계약·호출 제한을 확인한 뒤 제한적으로 검토한다. |
| 전송 실패·timeout | 상대가 작업을 실행했는지 모를 수 있다. HTTP 메서드만이 아니라 실제 작업 효과도 본다. |
| 잘못된 JSON·필수 필드 누락 | 계약·배포 호환성 문제인지 먼저 확인한다. 반복한다고 고쳐진다고 가정하지 않는다. |

이번 `CatalogClient`에는 애플리케이션 수준의 자동 재시도를 구현하지 않았다. HTTP 전송 구현·프록시 등 하위 계층의 재시도 여부는 별도 확인 대상이며, “내 코드에 반복문이 없다”가 물리적 요청 1회만 발생한다는 보장은 아니다.

### 9.2 횟수만 제한하면 충분하지 않다

재시도를 적용한다면 다음 조건을 함께 정한다.

1. 최초 요청을 포함한 최대 시도 횟수와 재시도 가능한 실패 범주
2. 업무 전체의 deadline과 각 시도의 timeout
3. 시도 사이의 대기인 backoff와 동시 재시도를 분산하는 jitter
4. 제공자의 Retry-After와 호출량 제한
5. 여러 계층에서 재시도가 겹쳐 요청이 증폭되지 않게 하는 책임 위치
6. 취소·중단·성공 후 종료 조건, 최종 실패와 시도 횟수의 관찰

가령 각 시도가 최대 3초라고 **별도로 보장되는 상황**에서 총 3회 시도하고 0.1초·0.2초를 기다리면 시도와 대기만 9.3초가 될 수 있다. 이는 시간 예산을 설명하는 계산이며, 앞의 read timeout만으로 각 시도의 전체 상한이 3초라고 보장한다는 뜻은 아니다.

장애가 난 서비스에 많은 클라이언트가 동시에 재요청하면 회복이 더 어려워질 수 있다. 제한된 backoff·jitter와 재시도 예산을 설계하는 이유다. `Thread.sleep()`을 넣은 무한 반복으로 해결하지 않는다. 구현 사례로 [AWS SDK의 재시도·jitter 설명](https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html)을 참고할 수 있지만, 그 SDK의 설정값과 기본 동작이 RestClient에도 적용되는 것은 아니다.

## 10. DB 트랜잭션과 외부 호출을 함께 볼 때

DB 트랜잭션 안에서 느린 HTTP 응답을 기다리면 연결·잠금 유지 시간이 늘어날 수 있다. 또한 DB rollback이 이미 성공한 외부 HTTP 작업까지 취소하지 않는다.

외부 조회가 꼭 트랜잭션 안에서 필요한지, 조회 후 DB 상태가 바뀔 수 있는지, 외부 변경과 DB 저장의 불일치를 어떻게 복구할지 각각 판단한다. 결제·알림 같은 외부 효과는 멱등성·상태 기록·Outbox·보상 등을 별도 설계하는 후속 주제다. [이전 트랜잭션 노트](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md)와 연결해 복습한다.

## 11. 로그와 메트릭에는 무엇을 남길까?

이전 [운영 기초 노트](../12_09_08_Operations_Logging_and_Actuator/09_08_Operations_Logging_and_Actuator.md)에서 관찰한 개념을 외부 호출에 적용한다. 제공자 별칭, 작업 종류, 실패 범주, HTTP 상태가 있으면 그 상태, 경과 시간·시도 횟수처럼 제한된 정보를 기록한다.

전체 URI의 query, Authorization 헤더, 응답 본문, 예외 객체에는 비밀값·개인정보가 들어갈 수 있다. 그대로 로그에 남기지 않는다. 메트릭 tag에는 사용자 ID·요청 ID·전체 URL처럼 종류가 계속 늘어나는 값을 넣지 않는다.

장애를 감추려고 외부 오류를 무조건 빈 목록이나 200으로 바꾸지도 않는다. 캐시된 값을 대신 보여 주는 fallback을 설계한다면 데이터의 오래됨과 제한을 사용자·호출자에게 알리고, 정상 응답과 구별해 관찰한다.

## 12. 자주 막히는 지점과 다음 학습

| 증상 | 먼저 확인할 것 |
| --- | --- |
| 호출 코드가 있는데 요청이 안 나감 | retrieve 이후 body·toEntity 등 종결 연산이 있는가? |
| 404가 모두 책 없음으로 처리됨 | 실제 제공자의 경로 오류·권한 은폐와 구별되는 계약인가? |
| 200인데 DTO 처리 실패 | Content-Type, JSON 문법, 필수 필드·타입·ID가 맞는가? |
| timeout 설정이 예상과 다름 | 실제 사용한 요청 팩터리와 적용 구간·전역 설정 관계는 무엇인가? |
| 테스트는 통과하지만 연결 실패 | 메모리 테스트에서 DNS·TLS·프록시·실제 전송을 제외했는가? |
| 재시도 뒤 중복 작업 발생 | 멱등성·제공자의 처리 상태·중복 방지 계약을 확인했는가? |
| 장애 시 스레드·DB 연결이 오래 점유됨 | 동기 호출의 시간 예산과 트랜잭션 범위가 적절한가? |

다음 확장 주제는 [HTTP Interface 클라이언트](../14_09_10_HTTP_Interface_Clients/09_10_HTTP_Interface_Clients.md)다. 이번에는 직접 작성한 요청 구성·응답 변환을 이해했고, 다음에는 인터페이스 선언과 생성된 프록시가 어떤 일을 대신하는지 비교한다. 선언이 짧아져도 timeout·오류·재시도 판단 책임이 사라지는 것은 아니다.

## 13. 요약 정리

1. 외부 호출 시 우리 서버도 HTTP 클라이언트가 되며 상대의 지연·실패를 함께 다뤄야 한다.
2. RestClient는 동기식이며 종결 연산까지 연결해야 요청과 응답 처리가 진행된다.
3. 전송 구현을 확인하고 연결·응답 대기·전체 시간 예산을 구분한다.
4. 외부 JSON DTO는 내부 Entity와 분리하고 상태 코드 이후 필수 값도 검증한다.
5. 자원 부재·HTTP 오류·전송 실패·응답 해석 실패를 같은 빈 결과로 숨기지 않는다.
6. MockRestServiceServer는 외부 요청 계약을 검사하지만 실제 timeout과 네트워크를 검증하지 않는다.
7. timeout이어도 상대의 변경 작업은 완료됐을 수 있으므로 재시도 전 멱등성을 확인한다.
8. 재시도에는 제한 횟수뿐 아니라 deadline·backoff·jitter·제공자 정책과 계층별 책임이 필요하다.
9. DB rollback은 외부 HTTP 작업을 취소하지 않으며 기다리는 동안 자원을 점유할 수 있다.
10. 실패를 관찰하되 자격 증명·본문·고유값의 무분별한 기록을 피한다.

## 14. 미니 퀴즈

1. retrieve()만 호출하고 끝내면 왜 의도한 요청이 수행되지 않을 수 있는가?
2. 외부 404와 IOException을 모두 Optional.empty로 반환하면 어떤 문제가 생기는가?
3. HTTP 200이면 DTO 값 검증을 생략해도 되는가?
4. withException으로 I/O 예외를 공급한 테스트가 통과하면 실제 timeout도 검증된 것인가?
5. 결제 POST에서 응답을 받지 못했다면 같은 요청을 바로 재전송해도 되는가?
6. read timeout 3초와 3회 시도만 설정하면 업무 전체가 3초 안에 끝나는가?
7. DB 트랜잭션 rollback이 외부 알림 전송까지 되돌릴 수 있는가?

<details>
<summary>정답과 해설</summary>

1. retrieve는 응답 처리 명세를 만든다. body·toEntity 등 필요한 종결 연산까지 호출해야 한다.
2. 실제 장애를 정상적인 책 없음으로 숨겨 잘못된 화면·업무 판단을 만들 수 있다.
3. 아니다. JSON 변환 뒤에도 필수 필드·ID 일치·값 범위를 확인해야 한다.
4. 아니다. 즉시 주입한 예외의 분류만 확인했다. 실제 전송 구현과 지연 서버를 사용한 검증은 별도다.
5. 아니다. 상대의 작업이 완료됐을 수 있다. 멱등성 키·상태 조회·제공자 계약 등의 근거가 필요하다.
6. 아니다. 적용 구간을 확인하고 여러 시도와 대기를 포함한 전체 예산을 설계해야 한다.
7. 아니다. DB 내부 변경과 외부 효과는 별개이며 중복 방지·재처리·보상 전략이 필요하다.

</details>
