# Spring Boot 테스트: 단위·슬라이스·통합 테스트의 검증 범위 구분하기

- 🎯 학습 목표: 검증하려는 실패를 먼저 정하고, 순수 Java·MockMvc·JPA·전체 애플리케이션 중 필요한 실행 범위를 선택한다.
- 🧩 핵심 키워드: JUnit Jupiter, AssertJ, Mockito, given-when-then, `@MockitoBean`, `@WebMvcTest`, `@DataJpaTest`, `@SpringBootTest`, 테스트 격리
- ⭐ 중요도: ★★★★★ — 테스트가 통과해도 실제로 실행하지 않은 DB·인증·트랜잭션의 정확성까지 보장되지는 않는다.
- 📝 한눈에 보는 내용: 작은 규칙은 빠른 단위 테스트로, HTTP 계약은 MVC 슬라이스로, 매핑·SQL은 데이터 슬라이스로, 여러 구성 요소의 연결은 통합 테스트로 확인한다. 각 테스트에서 실제 객체와 대역을 구분하는 것이 출발점이다.
- 🧱 선수 지식: Java 클래스·예외·Optional, 생성자 주입, Controller·Service·Repository, HTTP 상태 코드
- 🔗 이전 노트: [트랜잭션과 rollback](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md)

> 정리 기준일: 2026-09-06. Spring Boot 4.1·Spring Framework 7.0 공식 문서의 패키지와 동작을 기준으로 작성했다. JUnit은 Jupiter API를 사용하며, JUnit 6에서도 `org.junit.jupiter` 패키지를 사용한다. Boot 3 예제를 복사할 때는 테스트 애너테이션 import와 의존성을 다시 확인한다. 이 저장소에는 실행 프로젝트가 없으며, 아래 Spring 예제를 실제로 실행한 결과를 주장하지 않는다. 코드와 예상 결과를 읽은 뒤 별도 실습 프로젝트에서 검증하는 강의노트다.

## 1. “테스트가 통과했다” 다음에 물어야 할 질문

책 조회 Service 테스트가 통과했다고 하자. 그런데 브라우저에서는 500이 발생한다. 이런 상황이 꼭 테스트 도구의 오류는 아니다.

Service를 직접 호출한 테스트는 HTTP 경로가 맞는지, 문자열 ID가 숫자로 변환되는지, JSON 직렬화가 가능한지까지 실행하지 않았을 수 있다. Repository를 mock으로 바꿨다면 SQL 문법이나 DB 연결 오류도 관찰할 수 없다.

따라서 통과 여부 다음에는 이렇게 묻는다.

> 이번 테스트에서 실제로 실행한 구성 요소는 무엇이고, 대신 준비한 가짜 결과는 무엇인가?

이 노트는 책 한 권을 조회하는 동일한 기능을 범위별로 검사한다. 마지막에는 앞에서 배운 JPA 매핑과 대여 트랜잭션 테스트를 어디에 배치할지 연결한다.

## 2. 테스트 종류보다 검증할 경계를 먼저 그린다

```text
GET /books/1
  → Spring MVC: 경로·타입 변환·검증
  → BookController: 입력 전달과 응답
  → BookService: 조회 규칙·실패 판단
  → BookLookup: 데이터 조회 계약
      → 메모리 구현 또는 DB 구현
  → 응답 DTO → JSON
```

| 테스트 범위 | 실제로 실행하는 부분 | 대체하거나 제외하는 부분 | 주요 질문 |
| --- | --- | --- | --- |
| 단위 테스트 | 대상 Java 객체와 필요한 작은 협력 객체 | Spring·DB 등은 보통 제외 | 값·분기·예외가 규칙과 맞는가? |
| MVC 슬라이스 | Controller·MVC·JSON·선택한 Advice | 일반 Service·DB는 보통 대체 | HTTP 입력과 응답 계약이 맞는가? |
| JPA 슬라이스 | Entity·Repository·JPA·테스트 DB | 웹·일반 Service는 보통 제외 | 매핑·쿼리·DB 제약이 맞는가? |
| 전체 구성 통합 테스트 | 애플리케이션의 여러 Bean과 설정 | 선택한 외부 의존성은 대체 가능 | 실제 연결된 경로가 함께 동작하는가? |

슬라이스(slice)는 필요한 계층을 선택해서 불러오는 방식이다. Controller를 직접 `new`로 호출하는 단위 테스트와 달리, MVC 슬라이스는 Spring MVC 인프라까지 실행하므로 계층 내부의 통합 테스트로 볼 수도 있다. 명칭의 절대적인 분류보다 **실행한 경계**를 설명하는 것이 중요하다.

`@SpringBootTest`도 모든 외부 시스템이 실제라는 뜻은 아니다. mock Bean이 있으면 그 부분은 여전히 대역이고, 기본 설정은 실제 네트워크 포트를 열지 않는다. [Spring Boot 테스트 환경 구분](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)을 참고한다.

## 3. 테스트 도구가 담당하는 역할

- **JUnit Jupiter**: 어떤 메서드를 테스트로 실행하고, 테스트 전후 준비를 언제 수행할지 정한다.
- **AssertJ**: 실제 결과가 기대값과 일치하는지 읽기 쉬운 문장 형태로 검증한다.
- **Mockito**: 의존 객체의 특정 호출에 준비한 값을 반환하게 하거나 호출 여부를 확인한다.
- **Spring Test·Spring Boot Test**: Bean과 웹·DB 테스트 구성을 불러온다.
- **MockMvc**: 실제 HTTP 서버 없이 Spring MVC 처리 흐름을 통해 요청·응답을 검사한다.

테스트 대역(test double)은 실제 의존성을 대신하는 객체를 통틀어 부르는 말이다. 준비된 값을 반환하는 stub, 간단한 동작을 구현한 fake, 호출 검증에 사용하는 mock을 구분할 수 있다. Mockito로 만든 객체 하나가 stubbing과 호출 검증에 함께 사용되기도 한다.

반면 MockMvc의 이름에 Mock이 있다고 해서 Controller가 Mockito mock이 되는 것은 아니다. 뒤의 MVC 테스트에서는 Controller를 실제로 실행하고 그 아래 Service만 교체한다. [MockMvc 공식 설명](https://docs.spring.io/spring-framework/reference/testing/mockmvc.html), [JUnit 사용자 가이드](https://docs.junit.org/current/user-guide/), [Mockito 공식 API](https://javadoc.io/doc/org.mockito/mockito-core/latest/org.mockito/org/mockito/Mockito.html)를 참고한다.

## 4. 실습 구조와 버전 확인

### 4.1 이번 웹 예제의 범위

4~9절은 **별도의 작은 웹 실습 프로젝트**에서 사용한다. 데이터 저장은 의도적으로 메모리 구현을 사용하고, DB 매핑은 10절에서 이전 JPA 프로젝트로 분리한다. 웹·단위 테스트를 배우려고 DB 설정 문제까지 한 번에 해결하지 않도록 범위를 나눈 것이다.

Spring Boot 4.1 의존성 관리 아래 다음 구성을 준비한다.

| 구분 | 의존성 | 목적 |
| --- | --- | --- |
| 애플리케이션 | `spring-boot-starter-webmvc` | MVC와 JSON 응답 |
| 애플리케이션 | `spring-boot-starter-validation` | 요청 ID의 양수 제약 |
| 테스트 | `spring-boot-starter-test` | JUnit·AssertJ·Mockito 기본 도구 |
| 테스트 | `spring-boot-starter-webmvc-test` | MVC 테스트 지원 |

테스트 의존성은 Maven의 test scope 또는 Gradle의 `testImplementation`으로 둔다. 이 절에는 JPA·H2·Security 의존성을 넣지 않는다. Boot 4의 테스트 Starter 이름은 [공식 Starter 목록](https://docs.spring.io/spring-boot/reference/using/build-systems.html)에서, 각 테스트 모듈의 역할은 [Test Modules 문서](https://docs.spring.io/spring-boot/reference/testing/test-modules.html)에서 확인한다.

### 4.2 파일 배치

각 코드 블록의 public 타입은 표시한 이름의 개별 파일로 저장한다. 여러 public 클래스를 파일 하나에 붙여 넣지 않는다.

```text
src/main/java/com/example/teststudy/
  TestStudyApplication.java
  BookResponse.java
  BookLookup.java
  BookNotFoundException.java
  BookService.java
  InMemoryBookLookup.java
  BookController.java
  BookErrorHandler.java

src/test/java/com/example/teststudy/
  BookServiceTest.java
  BookControllerTest.java
  BookApplicationTest.java
```

`TestStudyApplication.java`는 Initializr에서 생성한 시작 클래스를 이 패키지에 두거나 다음 형태로 작성한다.

```java
package com.example.teststudy; // 하위 구성 요소를 스캔할 기준 패키지다.

import org.springframework.boot.SpringApplication; // Boot 애플리케이션의 시작 도구다.
import org.springframework.boot.autoconfigure.SpringBootApplication; // 자동 설정과 컴포넌트 스캔을 활성화한다.

@SpringBootApplication // 같은 패키지와 하위 패키지의 Controller·Service 등을 찾는다.
public class TestStudyApplication { // 테스트도 이 시작 구성을 찾아 문맥을 만든다.
    public static void main(String[] args) { // 직접 애플리케이션을 실행할 때 진입하는 메서드다.
        SpringApplication.run(TestStudyApplication.class, args); // 설정을 읽고 Bean과 서버를 시작한다.
    }
}
```

테스트 패키지를 시작 클래스와 같거나 하위에 두면 기본 구성 탐색이 쉬워진다. `Unable to find a @SpringBootConfiguration` 오류가 나면 먼저 이 위치 관계와 테스트 클래스패스를 확인한다.

## 5. 먼저 테스트할 업무 코드를 준비한다

### 5.1 응답 DTO와 조회 계약

`BookResponse.java`는 외부로 보여 줄 책 정보를 담는다.

```java
package com.example.teststudy; // 예제의 공통 패키지다.

public record BookResponse(Long id, String title) { // ID와 제목을 담고 값 비교·접근 메서드를 자동 제공한다.
}
```

`BookLookup.java`는 Service가 어떤 저장 기술에 의존하는지 숨기는 조회 계약이다. `Optional.empty()`는 조회할 책이 없다는 뜻으로 사용한다.

```java
package com.example.teststudy; // Service와 같은 패키지에 둔다.

import java.util.Optional; // 조회 결과가 없을 수 있음을 타입으로 표현한다.

public interface BookLookup { // 데이터 조회의 역할을 정의한다.
    Optional<BookResponse> findById(long id); // ID로 책 한 권을 찾거나 빈 결과를 반환한다.
}
```

`BookNotFoundException.java`는 없는 책을 조회했다는 업무 실패를 표현한다.

```java
package com.example.teststudy; // Service와 오류 Handler가 공유하는 타입이다.

public class BookNotFoundException extends RuntimeException { // 조회 실패를 나타내는 실행 예외다.
    public BookNotFoundException() { // 내부 DB 정보나 사용자 입력을 메시지에 그대로 넣지 않는다.
        super("책을 찾을 수 없습니다."); // 공개 가능한 고정 안내 메시지를 저장한다.
    }
}
```

### 5.2 Service의 두 가지 판단

`BookService.java`는 유효하지 않은 ID를 거부하고, 조회 결과가 없으면 업무 예외를 던진다.

```java
package com.example.teststudy; // 나머지 예제와 같은 패키지다.

import org.springframework.stereotype.Service; // 애플리케이션에서 사용할 업무 Bean을 표시한다.

@Service // 실제 실행에서는 Spring이 생성하고, 단위 테스트에서는 직접 new로 만들 수 있다.
public class BookService { // 저장소의 구체 기술 대신 조회 계약을 사용한다.
    private final BookLookup bookLookup; // 생성자로 받은 조회 객체를 보관한다.

    public BookService(BookLookup bookLookup) { // 필요한 역할을 외부에서 전달받는다.
        this.bookLookup = bookLookup; // 테스트에서는 이 자리에 mock도 전달할 수 있다.
    }

    public BookResponse find(long id) { // 책 ID를 받아 응답용 값을 반환한다.
        if (id <= 0) { // 예제에서 유효한 ID는 양수라는 규칙을 검사한다.
            throw new IllegalArgumentException("ID는 양수여야 합니다."); // 잘못된 입력으로 조회하지 않는다.
        }
        return bookLookup.findById(id) // 의존 객체에 실제 조회를 요청한다.
                .orElseThrow(BookNotFoundException::new); // 결과가 없을 때만 업무 예외를 생성해 던진다.
    }
}
```

생성자 주입의 장점은 여기에서 드러난다. Service 코드는 Spring을 시작하지 않아도 `new BookService(mockLookup)`으로 만들 수 있다. 그러나 이렇게 만든 객체에는 Spring 트랜잭션 프록시 등이 붙지 않는다는 점도 기억한다.

## 6. 단위 테스트: Spring 없이 분기와 결과 검증하기

### 6.1 given·when·then

테스트를 세 단계로 나누면 무엇을 검증하는지 읽기 쉬워진다.

1. given: 입력과 의존성의 동작을 준비한다.
2. when: 확인하려는 동작 하나를 실행한다.
3. then: 결과·예외·중요한 외부 상호작용을 확인한다.

`BookServiceTest.java`는 실제 BookService와 Mockito 조회 대역을 사용한다. `@SpringBootTest`도 Spring 컨텍스트도 필요하지 않다.

```java
package com.example.teststudy; // 대상 Service에 접근하는 테스트 패키지다.

import static org.assertj.core.api.Assertions.assertThat; // 반환값 비교에 사용한다.
import static org.assertj.core.api.Assertions.assertThatThrownBy; // 예상 예외 발생을 검증한다.
import static org.mockito.Mockito.mock; // 직접 Mockito 대역 객체를 만든다.
import static org.mockito.Mockito.verify; // 중요한 호출이 수행되었는지 확인한다.
import static org.mockito.Mockito.verifyNoInteractions; // 입력 거부 뒤 조회가 없었는지 확인한다.
import static org.mockito.Mockito.when; // 대역의 특정 호출 결과를 준비한다.

import java.util.Optional; // 책 존재·부재 결과를 준비할 때 사용한다.
import org.junit.jupiter.api.BeforeEach; // 각 테스트 전 새 준비를 수행한다.
import org.junit.jupiter.api.Test; // 일반 테스트 메서드를 선언한다.
import org.junit.jupiter.params.ParameterizedTest; // 여러 입력으로 같은 검증을 반복한다.
import org.junit.jupiter.params.provider.ValueSource; // 반복할 원시 값 목록을 제공한다.

class BookServiceTest { // 단위 테스트이므로 Spring 테스트 애너테이션을 붙이지 않는다.
    private BookLookup lookup; // 테스트마다 새로 만드는 조회 대역이다.
    private BookService service; // 검증할 실제 업무 객체다.

    @BeforeEach // 모든 테스트 및 매개변수별 실행 전에 준비한다.
    void setUp() { // 이전 테스트의 stubbing·호출 기록을 공유하지 않는다.
        lookup = mock(BookLookup.class); // 인터페이스의 대역을 생성한다.
        service = new BookService(lookup); // 실제 Service에 대역을 생성자 주입한다.
    }

    @Test // 책이 있을 때의 정상 분기를 검사한다.
    void 존재하는_책을_반환한다() { // 준비·실행·검증이 한 흐름으로 이어진다.
        BookResponse expected = new BookResponse(1L, "테스트 첫걸음"); // given: 기대하는 값을 준비한다.
        when(lookup.findById(1L)).thenReturn(Optional.of(expected)); // 1번 조회에 이 값을 반환하도록 설정한다.
        BookResponse actual = service.find(1L); // when: 실제 Service 코드를 실행한다.
        assertThat(actual).isEqualTo(expected); // then: ID와 제목이 기대값과 같은지 검증한다.
        verify(lookup).findById(1L); // 올바른 ID로 한 번 조회했는지 확인한다.
    }

    @Test // 결과가 없는 경우의 업무 예외를 검사한다.
    void 없는_책은_업무_예외로_알린다() { // 실패 상황도 명시적으로 준비한다.
        when(lookup.findById(99L)).thenReturn(Optional.empty()); // given: 99번 책은 없다고 준비한다.
        assertThatThrownBy(() -> service.find(99L)) // when: 람다 안의 호출을 실행하며 예외를 관찰한다.
                .isInstanceOf(BookNotFoundException.class); // then: 기대한 업무 예외인지 확인한다.
    }

    @ParameterizedTest // 동일한 잘못된 입력 규칙을 여러 값으로 확인한다.
    @ValueSource(longs = {0L, -1L}) // 경계값 0과 음수를 각각 전달한다.
    void 양수가_아니면_조회하지_않는다(long id) { // 입력마다 새 준비 상태로 실행된다.
        assertThatThrownBy(() -> service.find(id)) // when: 유효하지 않은 ID를 Service에 전달한다.
                .isInstanceOf(IllegalArgumentException.class); // then: 입력 오류로 거부해야 한다.
        verifyNoInteractions(lookup); // 거부한 입력으로 조회하지 않는다는 규칙도 검사한다.
    }
}
```

여기서 `when(...).thenReturn(...)`은 테스트 준비다. 대역에 준비한 값이 들어 있다고 실제 DB에 그 책이 존재한다는 뜻은 아니다. 또한 `verify`는 결과 검증을 대신하지 않는다. 메서드만 호출하고 틀린 값을 반환하는 결함은 반환값 검증이 있어야 발견한다.

반대로 모든 내부 호출 순서를 고정하면 기능은 같은데 리팩터링만 해도 테스트가 깨질 수 있다. 이 예제의 `verifyNoInteractions`는 “잘못된 입력으로 조회하지 않는다”는 의미 있는 경계를 검증하는 용도다. [JUnit 매개변수 테스트](https://docs.junit.org/current/writing-tests/parameterized-classes-and-tests.html)도 함께 참고한다.

## 7. HTTP 계층을 추가한다

### 7.1 메모리 조회 구현

`InMemoryBookLookup.java`는 웹 예제의 실행 가능한 조회 구현이다. 단위 테스트에서는 사용하지 않고, 전체 구성 테스트에서는 실제 Bean으로 사용한다.

```java
package com.example.teststudy; // 공통 예제 패키지다.

import java.util.Map; // ID별 책 데이터를 보관한다.
import java.util.Optional; // 조회 결과의 부재를 표현한다.
import org.springframework.stereotype.Repository; // 조회 역할의 Bean으로 등록한다.

@Repository // 실제 애플리케이션에서 BookLookup의 구현 후보가 된다.
public class InMemoryBookLookup implements BookLookup { // DB 대신 불변 샘플 데이터로 조회한다.
    private final Map<Long, BookResponse> books = Map.of( // 수정 기능이 없는 예제이므로 불변 Map을 사용한다.
            1L, new BookResponse(1L, "테스트 첫걸음") // 1번 책 한 권을 준비한다.
    ); // 이 데이터는 메모리에만 있고 DB에 저장되지는 않는다.

    @Override // 인터페이스에서 약속한 조회 기능을 구현한다.
    public Optional<BookResponse> findById(long id) { // 전달된 ID로 데이터를 찾는다.
        return Optional.ofNullable(books.get(id)); // 없으면 null 대신 Optional.empty를 반환한다.
    }
}
```

이 구현을 통과한 테스트가 JDBC·JPA의 매핑을 검증했다고 말하면 안 된다. 구현 이름과 저장 위치를 명확히 남겨 두는 이유다.

### 7.2 Controller와 오류 응답

`BookController.java`는 `/books/{id}`를 처리한다. `@PathVariable("id")`에 이름을 명시해 컴파일러의 매개변수 이름 보존 설정에 기대지 않는다.

```java
package com.example.teststudy; // 시작 클래스의 스캔 범위 안에 둔다.

import jakarta.validation.constraints.Positive; // HTTP 입력 ID가 양수인지 검증한다.
import org.springframework.web.bind.annotation.GetMapping; // GET 요청 매핑을 선언한다.
import org.springframework.web.bind.annotation.PathVariable; // URL 경로 변수를 받는다.
import org.springframework.web.bind.annotation.RestController; // 반환값을 HTTP 응답 본문으로 변환한다.

@RestController // MVC가 이 Bean의 요청 처리 메서드를 탐색한다.
public class BookController { // HTTP 입력을 Service로 전달하는 책임을 갖는다.
    private final BookService service; // 책 조회 업무를 수행할 객체다.

    public BookController(BookService service) { // 필요한 Service를 생성자로 받는다.
        this.service = service; // 요청 처리 메서드에서 사용할 수 있도록 보관한다.
    }

    @GetMapping("/books/{id}") // 예: GET /books/1 요청을 처리한다.
    public BookResponse find(@PathVariable("id") @Positive long id) { // 경로 값을 long으로 바꾸고 양수 제약을 확인한다.
        return service.find(id); // 실제 업무 결과가 JSON 응답으로 변환된다.
    }
}
```

현재 MVC의 내장 메서드 검증을 사용할 때 Controller 클래스에 `@Validated`를 덧붙이지 않는다. `/books/0`은 입력 검증, `/books/abc`는 타입 변환 문제다. 둘 다 400이어도 실패 단계가 다르다. [MVC 검증 문서](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html)를 참고한다.

`BookErrorHandler.java`는 없는 책에 대한 404 계약을 정한다. 나머지 MVC 오류를 일반 Exception Handler로 가로채지 않는다.

```java
package com.example.teststudy; // Controller와 같은 스캔 범위에 둔다.

import org.springframework.http.HttpStatus; // HTTP 상태 코드를 이름으로 사용한다.
import org.springframework.http.ProblemDetail; // 오류 설명의 표준 표현을 사용한다.
import org.springframework.web.bind.annotation.ExceptionHandler; // 특정 예외의 처리 메서드를 지정한다.
import org.springframework.web.bind.annotation.RestControllerAdvice; // Controller 예외를 공통 처리한다.

@RestControllerAdvice // MVC 예외 처리 과정에 참여하는 Bean이다.
public class BookErrorHandler { // 이 예제에서는 책 없음 오류만 담당한다.
    @ExceptionHandler(BookNotFoundException.class) // 이 업무 예외가 발생했을 때 호출한다.
    public ProblemDetail notFound() { // 내부 예외 메시지를 그대로 공개하지 않는다.
        ProblemDetail problem = ProblemDetail.forStatusAndDetail( // 상태와 사용자용 설명을 만든다.
                HttpStatus.NOT_FOUND, "책을 찾을 수 없습니다." // 404와 고정 안내 문구를 지정한다.
        ); // ProblemDetail의 status도 404가 된다.
        problem.setProperty("code", "BOOK_NOT_FOUND"); // 클라이언트가 분기할 안정적인 코드를 추가한다.
        return problem; // MVC가 오류 응답으로 직렬화한다.
    }
}
```

## 8. MVC 슬라이스: 실제 Controller와 가짜 Service

`BookControllerTest.java`는 Controller·Advice·MVC를 실제로 실행한다. 일반 Service는 슬라이스 범위 밖이므로 `@MockitoBean`으로 제공한다.

```java
package com.example.teststudy; // 웹 예제의 테스트 패키지다.

import static org.mockito.Mockito.verifyNoInteractions; // 잘못된 HTTP 입력이 Service까지 도달하지 않는지 확인한다.
import static org.mockito.Mockito.when; // Service 대역의 응답을 준비한다.
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get; // GET 요청을 만든다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath; // JSON의 특정 필드를 검사한다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status; // HTTP 상태 코드를 검사한다.

import org.junit.jupiter.api.Test; // 테스트 메서드를 선언한다.
import org.springframework.beans.factory.annotation.Autowired; // MVC 테스트 도구를 주입받는다.
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest; // Boot 4의 MVC 슬라이스 애너테이션이다.
import org.springframework.context.annotation.Import; // 필요한 Advice를 명시적으로 포함한다.
import org.springframework.test.context.bean.override.mockito.MockitoBean; // Spring 문맥에 Mockito 대역 Bean을 제공한다.
import org.springframework.test.web.servlet.MockMvc; // 실제 포트 없이 MVC 요청 처리를 실행한다.

@WebMvcTest(BookController.class) // 테스트할 Controller를 지정하고 MVC 관련 구성만 불러온다.
@Import(BookErrorHandler.class) // 404 응답을 만드는 실제 Advice를 테스트 범위에 포함한다.
class BookControllerTest { // 일반 Service와 DB는 실제 실행 범위가 아니다.
    @Autowired // 슬라이스가 구성한 도구를 주입받는다.
    private MockMvc mvc; // 요청을 수행하고 응답을 검증할 객체다.

    @MockitoBean // Controller가 필요로 하는 Service를 대역 Bean으로 제공한다.
    private BookService service; // 이 필드는 실제 Service의 find 구현을 실행하지 않는다.

    @Test // HTTP 성공 계약을 검증한다.
    void 책을_JSON으로_반환한다() throws Exception { // MockMvc 호출의 검사 예외를 테스트 실행기에 전달한다.
        when(service.find(1L)).thenReturn(new BookResponse(1L, "테스트 첫걸음")); // given: Service의 응답을 준비한다.
        mvc.perform(get("/books/{id}", 1L)) // when: GET /books/1을 MVC로 전달한다.
                .andExpect(status().isOk()) // then: HTTP 상태가 200인지 확인한다.
                .andExpect(jsonPath("$.id").value(1)) // JSON의 id 필드가 숫자 1인지 확인한다.
                .andExpect(jsonPath("$.title").value("테스트 첫걸음")); // 공개 제목이 기대값인지 확인한다.
    }

    @Test // 업무 예외가 HTTP 오류로 변환되는지 검사한다.
    void 없는_책은_404와_오류코드를_반환한다() throws Exception { // 실제 Advice의 동작을 관찰한다.
        when(service.find(99L)).thenThrow(new BookNotFoundException()); // given: 없는 책이라는 업무 실패를 준비한다.
        mvc.perform(get("/books/{id}", 99L)) // when: 99번 책을 요청한다.
                .andExpect(status().isNotFound()) // then: 500이 아니라 404여야 한다.
                .andExpect(jsonPath("$.code").value("BOOK_NOT_FOUND")); // 클라이언트용 오류 코드도 확인한다.
    }

    @Test // 양수가 아닌 경로 입력은 웹 계층에서 거부해야 한다.
    void 양수가_아닌_ID는_400이다() throws Exception { // 이 경우 Service의 응답을 준비하지 않는다.
        mvc.perform(get("/books/{id}", 0L)) // when: @Positive에 어긋나는 값을 전달한다.
                .andExpect(status().isBadRequest()); // then: HTTP 입력 오류로 거부해야 한다.
        verifyNoInteractions(service); // 잘못된 요청으로 업무 계층을 호출하지 않아야 한다.
    }

    @Test // 숫자로 바꿀 수 없는 문자열도 입력 오류로 처리한다.
    void 숫자가_아닌_ID는_400이다() throws Exception { // 제약 검증보다 앞선 타입 변환 단계를 확인한다.
        mvc.perform(get("/books/abc")) // when: long으로 바꿀 수 없는 경로를 전달한다.
                .andExpect(status().isBadRequest()); // then: 타입 변환 실패의 400을 기대한다.
        verifyNoInteractions(service); // 타입 변환 실패 시 Service는 실행되지 않는다.
    }
}
```

성공 응답의 값은 Service mock이 공급하지만, 경로 매핑·Controller 호출·응답 직렬화는 실제로 수행한다. 404 테스트는 “DB에 책이 없다”를 증명하는 것이 아니라 “책 없음 예외를 MVC가 약속한 HTTP 응답으로 바꾼다”를 검증한다.

`@MockitoBean`은 Spring 문맥의 Bean을 교체하거나 기본적으로 없으면 생성한다. 반드시 기존 Bean만 교체해야 하는 테스트에서는 `enforceOverride = true`를 검토할 수 있지만, 일반 Service를 제외하는 이 슬라이스 예제에 무조건 붙이면 Bean을 찾지 못할 수 있다. 반면 단위 테스트의 `mock()`·`@Mock`은 그 자체로 Spring Bean 등록을 하지 않는다. [MockitoBean 공식 문서](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html)를 참고한다.

`@WebMvcTest`의 대상에는 Controller 외에 MVC 관련 Advice·Filter 등이 포함될 수 있다. 프로젝트에 Security가 있으면 인증·인가가 요청에 영향을 준다. 이유 없이 401·403이 나온다고 필터를 전부 끄지 말고 보안 계약과 테스트 사용자 설정을 확인한다. 이 예제는 Security 의존성이 없는 별도 프로젝트를 전제로 한다. [WebMvcTest 공식 API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTest.html)를 참고한다.

## 9. 전체 구성 테스트: 실제 Service까지 연결하기

`BookApplicationTest.java`는 같은 웹 프로젝트 전체 구성을 불러온다. 이번에는 Service를 mock으로 교체하지 않으므로 **Controller → 실제 Service → 실제 InMemoryBookLookup**을 거친다.

```java
package com.example.teststudy; // 시작 구성의 탐색 범위에 둔다.

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get; // MVC GET 요청을 만든다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath; // 응답 필드 값을 확인한다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status; // 상태 코드를 확인한다.

import org.junit.jupiter.api.Test; // JUnit 테스트를 선언한다.
import org.springframework.beans.factory.annotation.Autowired; // Boot가 구성한 Bean을 주입한다.
import org.springframework.boot.test.context.SpringBootTest; // 전체 애플리케이션 구성을 불러온다.
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc; // Boot 4의 MockMvc 자동 구성을 추가한다.
import org.springframework.test.web.servlet.MockMvc; // 포트를 열지 않고 요청을 실행한다.

@SpringBootTest // 기본 MOCK 환경이며 실제 HTTP 서버 포트는 열지 않는다.
@AutoConfigureMockMvc // 전체 문맥을 대상으로 MockMvc를 사용할 수 있게 한다.
class BookApplicationTest { // MockitoBean이 없으므로 Service·조회 구현도 실제 Bean이다.
    @Autowired // 전체 구성에 연결된 MVC 도구를 주입한다.
    private MockMvc mvc; // 실제 Bean 연결을 요청부터 끝까지 따라간다.

    @Test // 여러 구성 요소의 실제 연결이 작동하는지 확인한다.
    void 실제_Service와_메모리조회로_책을_반환한다() throws Exception { // stubbing 없이 실행한다.
        mvc.perform(get("/books/1")) // 메모리 구현에 준비된 1번 책을 요청한다.
                .andExpect(status().isOk()) // Controller부터 조회까지 성공해야 한다.
                .andExpect(jsonPath("$.title").value("테스트 첫걸음")); // 실제 조회한 제목을 확인한다.
    }

    @Test // 실제 Service의 부재 판단과 실제 Advice를 함께 확인한다.
    void 실제_없는_책은_404가_된다() throws Exception { // 99번 책은 메모리 데이터에 없다.
        mvc.perform(get("/books/99")) // 실제 조회 결과는 Optional.empty다.
                .andExpect(status().isNotFound()) // Service가 던진 업무 예외가 404로 변환되어야 한다.
                .andExpect(jsonPath("$.code").value("BOOK_NOT_FOUND")); // 오류 계약까지 유지되는지 확인한다.
    }
}
```

슬라이스와 일부 검증이 겹쳐도 목적은 다르다. 슬라이스는 웹 계약을 빠르게 분리해 확인하고, 전체 구성 테스트는 Bean 연결과 여러 계층의 협업을 확인한다. 그렇다고 모든 입력 조합을 무거운 전체 구성 테스트로 반복할 필요는 없다.

이 테스트에도 실제 DB·실제 네트워크 서버는 없다. 실제 포트가 필요하면 `@SpringBootTest(webEnvironment = RANDOM_PORT)`와 HTTP 클라이언트를 사용한다. 서버 요청은 별도 스레드·트랜잭션에서 처리될 수 있으므로 테스트 메서드의 rollback이 서버가 저장한 데이터까지 되돌린다고 가정하지 않는다. [Boot 테스트 환경 설명](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)과 [MockMvc 자동 구성 API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/webmvc/test/autoconfigure/AutoConfigureMockMvc.html)를 참고한다.

## 10. JPA 슬라이스는 무엇을 검증할까?

이 절은 위의 메모리 웹 프로젝트와 **별도 실습**이다. [Entity 노트](../08_09_05_Entity_Lifecycle_and_Relationships/09_05_Entity_Lifecycle_and_Relationships.md)의 `com.example.library.Author`, `Book`, `BookRepository`를 그대로 사용한다. `BookRepository.findAllWithAuthor()`는 책과 저자를 fetch join으로 읽는 JPQL 메서드다.

JPA 실습 프로젝트에는 JPA Starter, H2 테스트 Driver, 기본 테스트 도구와 Boot 4의 `spring-boot-starter-data-jpa-test`가 필요하다. 아래 `BookRepositorySliceTest.java`는 **기존 초기 데이터가 없는 테스트 DB**를 기준으로 한다.

```java
package com.example.library; // 이전 Entity·Repository 예제와 같은 패키지다.

import static org.assertj.core.api.Assertions.assertThat; // 조회 결과와 필드를 확인한다.

import jakarta.persistence.EntityManager; // 실제 JPA 영속성 컨텍스트를 제어한다.
import jakarta.persistence.PersistenceContext; // 테스트의 EntityManager를 주입한다.
import java.util.List; // 조회한 책 목록의 타입이다.
import org.junit.jupiter.api.Test; // 테스트 메서드를 선언한다.
import org.springframework.beans.factory.annotation.Autowired; // 실제 Repository Proxy를 주입한다.
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest; // Boot 4의 JPA 슬라이스를 사용한다.

@DataJpaTest // JPA·Repository·테스트 DB 중심 구성을 불러오고 기본적으로 테스트 종료 후 rollback한다.
class BookRepositorySliceTest { // 일반 웹 Controller와 Service 전체는 불러오지 않는다.
    @PersistenceContext // 실제 JPA 관리 객체를 준비할 도구를 받는다.
    private EntityManager entityManager; // flush·clear로 DB 조회 여부를 구분한다.

    @Autowired // Spring Data가 생성한 실제 Repository Bean을 받는다.
    private BookRepository repository; // Mockito 대역이 아니므로 실제 JPQL을 실행한다.

    @Test // 매핑과 JPQL 결과를 함께 확인한다.
    void 책과_저자를_함께_조회한다() { // 독립된 테스트 데이터만 존재한다고 전제한다.
        Author author = new Author("가람"); // given: 새 저자를 만든다.
        entityManager.persist(author); // cascade를 설정하지 않았으므로 저자를 먼저 저장 대상으로 등록한다.
        entityManager.persist(new Book("매핑 테스트", author)); // 저자에 속한 책을 저장 대상으로 등록한다.
        entityManager.flush(); // INSERT와 DB 제약 확인을 지금 수행한다. commit은 아니다.
        entityManager.clear(); // 기존 관리 객체를 이용해 검증하지 않도록 컨텍스트를 비운다.

        List<Book> books = repository.findAllWithAuthor(); // when: 실제 Repository의 JPQL을 실행한다.
        assertThat(books).hasSize(1); // then: 테스트가 준비한 책 한 권이 조회되어야 한다.
        assertThat(books.get(0).getTitle()).isEqualTo("매핑 테스트"); // 책 필드 매핑을 확인한다.
        assertThat(books.get(0).getAuthor().getName()).isEqualTo("가람"); // 연관 저자의 매핑 결과도 확인한다.
    }
}
```

이 테스트는 조회 결과·매핑을 확인하지만 **SQL이 반드시 한 번만 실행되었다고 검증하지는 않는다.** N+1을 막았는지 확인하려면 통계·SQL 수집 등으로 해당 조회 구간의 쿼리 횟수를 별도로 측정해야 한다. Entity의 메서드를 호출해 값이 나온다는 사실만으로 fetch 전략의 성능을 증명하지 않는다.

H2 테스트 통과도 운영 DB 호환성을 보장하지 않는다. DB 고유 문법·타입·제약·잠금이 중요하면 운영과 같은 엔진의 컨테이너 DB를 사용하는 통합 테스트를 추가한다. DB 교체 여부와 초기화 전략은 프로젝트 버전의 설정을 확인하고 운영 DB에 테스트를 연결하지 않는다. [DataJpaTest API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html), [Boot의 Testcontainers 연동](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)을 참고한다.

## 11. 트랜잭션은 mock으로 증명할 수 없다

Repository mock이 예외를 던지도록 설정한 단위 테스트는 Service가 그 예외를 전달하는지 확인할 수 있다. 그러나 이미 실행한 SQL이 rollback되었는지는 확인할 수 없다. mock 환경에서는 실제 연결·SQL·commit이 없기 때문이다.

[트랜잭션 노트의 LoanServiceTest](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md)는 다음 실패 경로를 실제 Spring과 테스트 DB로 확인하도록 설계했다.

```text
정상 대여: 재고 3 → 2, 기록 1건 commit
  → 같은 요청 ID로 재시도
  → 재고 UPDATE 실행
  → 중복 키로 기록 INSERT 실패
  → 이번 UPDATE rollback
  → 재고 2, 기존 기록 1건 유지 확인
```

테스트 자체에 `@Transactional`을 붙이면 Service의 애너테이션 누락이 가려질 수 있다. JPA 슬라이스의 기본 테스트 트랜잭션은 데이터 격리에 유용하지만, 실제 Service 경계를 확인하는 테스트와는 목적이 다르다. flush도 commit 성공을 뜻하지 않는다. [Spring 테스트 트랜잭션 문서](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)를 참고한다.

## 12. 신뢰할 수 있는 테스트 데이터와 실패 진단

### 12.1 순서·시간·공유 상태를 통제한다

- 테스트 A가 저장한 값을 테스트 B가 사용하게 만들지 않는다.
- `@BeforeEach`의 준비를 작게 유지하고 테스트 이름에서 기대 동작을 드러낸다.
- 현재 시각에 의존하는 업무는 `Clock` 같은 시간 의존성을 주입해 고정 시각으로 검증한다.
- 무작위 입력을 쓰면 재현 가능한 seed 또는 실패한 입력을 남긴다.
- `Thread.sleep()`으로 비동기 완료를 추측하기보다 완료 신호와 제한 시간을 명시한다.
- DB의 기본 반환 순서에 기대지 않고 순서가 계약이면 정렬을 명시한다.

메모리 Map 예제는 불변 데이터만 조회하므로 테스트마다 상태가 달라지지 않는다. 저장·수정 기능을 추가하면 초기화와 공유 객체의 수명주기도 함께 설계해야 한다.

### 12.2 컨텍스트 캐시는 테스트 데이터 초기화가 아니다

Spring은 같은 구성의 테스트에서 ApplicationContext를 재사용해 시작 비용을 줄일 수 있다. 따라서 테스트 메서드가 바뀐다고 모든 singleton Bean이 매번 새로 만들어진다고 가정하지 않는다.

`@DirtiesContext`는 문맥을 폐기하는 도구이며, 단순 DB 데이터 정리용으로 남발하면 테스트가 느려진다. mock Bean 구성·Profile·Property 등의 차이가 문맥 재사용에 영향을 줄 수 있으므로 공통 구성을 의도적으로 맞춘다. [컨텍스트 캐시 공식 문서](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html)를 참고한다.

### 12.3 실패 위치를 먼저 구분한다

| 실패 형태 | 먼저 확인할 것 |
| --- | --- |
| 테스트가 발견되지 않음 | 테스트 의존성·엔진, 파일명, 빌드 도구 설정 |
| ApplicationContext 시작 실패 | 가장 안쪽 원인, 누락 Bean, 패키지·Profile·DB 연결 |
| MVC 테스트에서 Service Bean 누락 | 슬라이스에서 제외한 의존성에 MockitoBean 또는 Import가 필요한가? |
| 기대 200인데 401·403 | Security 필터, 테스트 사용자, 권한·CSRF 조건 |
| 기대 JSON 필드가 없음 | 직렬화 계약과 Controller 반환 타입, 실제 응답 본문 |
| mock 호출 결과가 다름 | 입력값과 stubbing 조건의 일치, 실제 대상이 mock인지 여부 |
| 단독 통과·전체 실행 실패 | 공유 DB·singleton 상태, 실행 순서·병렬 실행 의존성 |

실패 로그를 확인할 때 요청·응답 전체를 무조건 출력하면 개인정보나 토큰이 남을 수 있다. 로컬 테스트의 가짜 데이터로 재현하고 공개 로그에는 필요한 정보만 남긴다.

## 13. 실행 순서와 확인할 결과

Maven Wrapper를 사용하는 별도 웹 실습 프로젝트 루트의 PowerShell에서 다음을 실행한다. TIL 저장소 자체에는 이 Wrapper가 없다.

```powershell
# 순수 Java·Mockito 단위 테스트를 먼저 실행한다.
./mvnw.cmd '-Dtest=BookServiceTest' test

# Controller와 HTTP 계약에 집중한 슬라이스 테스트를 실행한다.
./mvnw.cmd '-Dtest=BookControllerTest' test

# 실제 Service·메모리 조회 구현까지 연결한 전체 구성 테스트를 실행한다.
./mvnw.cmd '-Dtest=BookApplicationTest' test
```

웹 예제를 그대로 구성했다면 단위 테스트는 일반 테스트 2개와 매개변수 입력 2개, MVC 테스트는 4개, 전체 구성 테스트는 2개 실행을 확인하는 것이 목표다. 이는 **예상 실행 구성**이며 이번에 얻은 실제 실행 로그가 아니다. JPA 슬라이스와 이전 대여 테스트는 각각의 실습 프로젝트에서 따로 실행한다.

첫 실행이 통과하면 조건을 한 가지씩 일부러 깨뜨려 보자. 예를 들어 Service의 양수 검사나 Controller의 `@Positive`를 제거했을 때 그 계약을 담당하는 테스트가 실패하는지 확인한다. 확인 후 원래 코드를 복원한다. 테스트가 녹색이라는 사실뿐 아니라 결함을 발견할 수 있는지도 확인하는 연습이다.

## 14. 적용 기준과 다음 학습

새 기능을 만들 때는 “어떤 애너테이션을 붙일까?”보다 다음 순서로 생각한다.

1. 성공·부재·잘못된 입력 등 관찰 가능한 계약을 적는다.
2. Java 분기만으로 확인할 부분을 단위 테스트로 분리한다.
3. HTTP 입력·응답 변환이 필요한 부분을 MVC 슬라이스로 검사한다.
4. SQL·매핑·제약이 관련되면 실제 DB가 있는 테스트를 추가한다.
5. Bean 연결·트랜잭션·외부 경계는 필요한 통합 테스트로 보완한다.

다음 로드맵은 **Spring Security의 인증·인가와 필터 체인**이다. 웹 테스트에서 마주친 401·403을 출발점으로 “요청이 Controller에 오기 전에 무엇이 검사되는가”를 배우면, 정상 요청뿐 아니라 거부되어야 하는 요청도 테스트할 수 있다.

## 15. 요약 정리

1. 테스트 통과의 의미는 실제 실행한 경계 안에서 해석한다.
2. JUnit은 실행, AssertJ는 결과 검증, Mockito는 대역, Spring Test는 구성 지원을 맡는다.
3. 단위 테스트는 Spring 없이 생성자 주입으로 업무 객체를 만들 수 있다.
4. stubbing은 준비된 답을 설정하는 것이며 실제 저장소를 검증한 결과가 아니다.
5. MVC 슬라이스는 실제 Controller·MVC를 실행하고 일반 Service 등을 필요한 대역으로 제공한다.
6. MockitoBean은 Spring 문맥에 영향을 주지만 일반 mock·Mock은 그 자체로 Bean을 등록하지 않는다.
7. SpringBootTest의 기본 환경은 실제 서버 포트를 열지 않으며, 전체 구성이 곧 실제 DB를 뜻하지 않는다.
8. JPA 슬라이스는 매핑·쿼리를 검증하지만 결과 확인만으로 쿼리 횟수나 commit을 증명하지 않는다.
9. rollback은 실제 Spring 경계와 DB에서 검증하고 테스트 자체의 트랜잭션이 누락을 가리지 않게 한다.
10. 테스트 데이터·시간·문맥 재사용을 통제하고 성공과 실패 경로를 함께 확인한다.

## 16. 미니 퀴즈

1. Repository mock에서 책을 반환하도록 준비하고 테스트가 통과했다. 실제 DB의 SQL도 올바르다고 할 수 있는가?
2. `@WebMvcTest`에서 Controller가 필요로 하는 Service Bean을 찾지 못하는 이유와 해결 방향은 무엇인가?
3. `@Mock`만 붙인 필드가 Spring Controller에 자동 주입된다고 생각하면 왜 문제가 되는가?
4. `@SpringBootTest`에 실제 DB와 네트워크 서버가 항상 포함되는가?
5. 테스트 메서드에 트랜잭션을 붙이면 실제 서버의 HTTP 요청이 저장한 데이터도 항상 취소되는가?
6. JPA 조회 결과가 맞는데 N+1은 그대로일 수 있는 이유는 무엇인가?
7. 전체 테스트에서만 실패할 때 어떤 공유 상태를 의심해야 하는가?

<details>
<summary>정답과 해설</summary>

1. 아니다. mock이 준비한 값을 사용했으므로 실제 SQL·Driver·DB 제약은 실행하지 않았다.
2. 슬라이스는 MVC 중심으로 구성되어 일반 Service가 제외될 수 있다. 검증 범위에 따라 MockitoBean 대역을 제공하거나 필요한 실제 Bean을 Import한다.
3. 일반 Mockito 대역 생성과 Spring Bean 등록은 다르다. 단위 테스트에서는 직접 생성자 주입하고, Spring 문맥을 바꿀 때는 MockitoBean 등의 지원을 사용한다.
4. 아니다. 기본 MOCK 환경은 포트를 열지 않는다. 이 노트의 전체 구성 테스트도 실제 메모리 조회 Bean을 쓰지만 DB는 없다.
5. 아니다. 실제 HTTP 서버는 별도 스레드·트랜잭션에서 처리할 수 있어 테스트의 rollback 범위 밖이다. 데이터 정리 전략이 필요하다.
6. 필요한 값을 추가 SELECT로 읽어도 결과는 같을 수 있다. SQL 횟수·실행 구간을 별도로 관찰해야 한다.
7. 이전 테스트가 남긴 DB 데이터, mutable singleton, static 상태, 시각·무작위·병렬 실행·순서 의존성을 확인한다.

</details>
