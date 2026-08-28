# Spring MVC 요청 처리 흐름 이해하기

- 🎯 글의 목표: 브라우저나 API 클라이언트가 보낸 HTTP 요청이 내장 서버와 Spring MVC를 거쳐 Controller에 도착하고, Java 반환값이 HTTP 응답으로 바뀌는 전 과정을 설명할 수 있다.
- 🧩 핵심 키워드: HTTP, Servlet Container, DispatcherServlet, Front Controller, HandlerMapping, HandlerAdapter, Controller, `@RequestMapping`, `@RestController`, `HttpMessageConverter`, Jackson, `ResponseEntity`
- ⭐ 중요도: ★★★★★ — 요청 흐름을 알아야 Controller 애너테이션을 외우는 데서 벗어나 404·405·400·415·406·500 오류가 어느 단계에서 발생했는지 추적할 수 있다.
- 📝 한눈에 보는 내용: 내장 서버가 HTTP 요청을 받아 Servlet 요청 객체로 만들면 `DispatcherServlet`이 적절한 Controller 메서드를 찾고 실행한다. 메서드의 매개변수는 요청에서 해석되고, 반환값은 메시지 변환기나 View 처리 과정을 거쳐 HTTP 응답이 된다.
- 🔗 관련 주제: HTTP 요청·응답, IoC·DI·Bean, Servlet, JSON, REST API, DTO, Validation, 예외 처리
- 🧱 선수 지식: Java 클래스·메서드·애너테이션, HTTP 메서드·상태 코드·Header·Body, Spring Bean과 생성자 주입

---

## 1. 들어가며

다음 Controller 코드는 짧다.

```java
@RestController
public class HelloController {

    @GetMapping("/api/hello")
    public String hello() {
        return "hello";
    }
}
```

하지만 클라이언트가 `GET /api/hello`를 보냈다고 해서 Java 메서드가 저절로 호출되는 것은 아니다. 네트워크 요청을 받고, URL과 HTTP 메서드를 비교하고, 매개변수를 만들고, 반환값을 HTTP 형식으로 바꾸는 여러 구성 요소가 협력한다.

```text
클라이언트
  → 내장 Servlet Container
  → DispatcherServlet
  → 요청과 일치하는 Controller 메서드 탐색
  → 메서드 매개변수 구성
  → Controller 실행
  → 반환값을 응답 본문으로 변환
  → HTTP 응답
```

이 흐름을 이해하면 `@GetMapping`이 단순한 마법이 아니라 **요청을 Java 메서드에 연결하기 위한 정보**라는 사실을 알 수 있다.

> 이 문서는 2026년 8월 28일의 Spring Boot 4.1·Spring Framework 7.0 공식 문서를 확인해 작성했다. 프로젝트 버전이 다르면 해당 버전의 공식 문서를 우선한다.

## 2. 먼저 구분할 세 가지: Boot, MVC, Servlet Container

처음에는 Spring Boot와 Spring MVC, Tomcat을 모두 같은 것으로 생각하기 쉽다. 세 대상의 책임은 다르다.

| 대상 | 맡는 일 | 쉬운 표현 |
| --- | --- | --- |
| Spring Boot | 의존성과 설정을 바탕으로 애플리케이션과 내장 서버를 구성하고 실행 | 실행과 설정을 편하게 만드는 기반 |
| Spring MVC | 요청을 Controller에 연결하고 입력과 반환값을 처리 | 웹 요청 처리 규칙 |
| Servlet Container | 네트워크 요청을 받고 Servlet을 실행하며 응답을 전송 | Java 웹 코드가 동작하는 서버 환경 |

Spring Boot의 Servlet 기반 웹 프로젝트는 보통 내장 Tomcat을 사용한다. 프로젝트 설정에 따라 Jetty 등 다른 서버를 사용할 수도 있다. 중요한 점은 Spring Boot가 서버의 존재를 없앤 것이 아니라 **애플리케이션 안에서 함께 실행하도록 구성했다**는 것이다.

```text
Spring Boot 애플리케이션 프로세스
├─ Spring ApplicationContext
│  ├─ Controller Bean
│  ├─ Service Bean
│  └─ Spring MVC 구성 요소
└─ 내장 Servlet Container
   └─ DispatcherServlet 등록
```

## 3. HTTP 요청에서 무엇을 읽어야 하는가

예를 들어 다음 요청에는 서로 다른 정보가 들어 있다.

```http
POST /api/books?notify=true HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Accept: application/json
Authorization: Bearer example-token

{
  "title": "Spring Start",
  "author": "Kim"
}
```

| 위치 | 예시 | Spring MVC에서 주로 받는 방법 |
| --- | --- | --- |
| HTTP 메서드 | `POST` | `@PostMapping` |
| 경로 | `/api/books` | 클래스·메서드의 매핑 애너테이션 |
| Query Parameter | `notify=true` | `@RequestParam` |
| Header | `Authorization: ...` | `@RequestHeader` |
| Body | JSON 객체 | `@RequestBody` |
| 원하는 응답 형식 | `Accept: application/json` | 콘텐츠 협상 |

`Content-Type`과 `Accept`는 방향이 다르다.

- `Content-Type`: 클라이언트가 **보내는 본문**의 형식
- `Accept`: 클라이언트가 **받고 싶은 응답**의 형식

이 둘을 혼동하면 JSON 본문은 올바른데도 415 또는 406 응답을 만날 수 있다.

## 4. Servlet과 DispatcherServlet

### 4.1 Servlet은 무엇인가

Servlet은 Java 웹 환경에서 요청을 받아 응답을 만드는 구성 요소의 표준 계약이다. Servlet Container는 네트워크의 HTTP 요청을 Java 코드가 다룰 수 있는 요청·응답 객체로 바꾸고 알맞은 Servlet을 호출한다.

Spring MVC는 모든 URL마다 Servlet을 하나씩 만드는 대신 중앙의 `DispatcherServlet`을 사용한다.

### 4.2 Front Controller 패턴

Spring 공식 문서는 `DispatcherServlet`을 Front Controller 패턴의 중앙 Servlet으로 설명한다. 공통 진입점 하나가 요청을 받고 실제 처리를 여러 구성 요소에 위임한다.

```text
                    ┌─ Controller A
모든 MVC 요청 ─→ DispatcherServlet ─┼─ Controller B
                    └─ Controller C
```

중앙 진입점이 있기 때문에 다음 공통 절차를 일관되게 적용할 수 있다.

- 어떤 Controller가 요청을 처리할지 찾기
- 요청 값을 메서드 인자로 변환하기
- 예외 처리 전략 적용하기
- 반환값을 View 또는 응답 본문으로 처리하기
- Locale, multipart 같은 웹 기능 연결하기

### 4.3 Spring Boot에서는 누가 등록하는가

전통적인 Spring MVC 설정에서는 개발자가 Servlet 등록을 직접 작성할 수 있다. Spring Boot는 클래스패스와 설정을 확인해 내장 서버와 MVC 기반 구성을 자동 설정하고 `DispatcherServlet`을 등록한다.

따라서 입문 프로젝트에서 `new DispatcherServlet()`을 직접 쓰지 않아도 되는 이유는 기능이 사라졌기 때문이 아니라 **Boot가 반복 설정을 대신했기 때문**이다.

## 5. 요청 한 번의 전체 흐름

`GET /api/books/10` 요청이 다음 메서드에 도착하는 과정을 보자.

```java
@GetMapping("/api/books/{bookId}")
public BookResponse findBook(@PathVariable long bookId) {
    return bookService.findBook(bookId);
}
```

```text
1. 클라이언트가 HTTP 요청 전송
        ↓
2. 내장 서버가 연결을 받고 HTTP 정보를 해석
        ↓
3. Filter Chain을 통과
        ↓
4. DispatcherServlet이 요청을 받음
        ↓
5. HandlerMapping이 일치하는 Handler를 탐색
        ↓
6. HandlerAdapter가 Controller 메서드 호출 준비
        ↓
7. ArgumentResolver가 매개변수 값을 구성
        ↓
8. Controller → Service가 기능 실행
        ↓
9. ReturnValueHandler가 반환값 처리 방식 결정
        ↓
10. HttpMessageConverter가 객체를 JSON 등으로 변환
        ↓
11. 내장 서버가 HTTP 응답을 클라이언트에 전송
```

### 5.1 Handler는 꼭 메서드만 뜻하는가

Spring MVC에서 Handler는 요청을 실제로 처리할 대상을 가리키는 일반 표현이다. 애너테이션 기반 MVC에서는 보통 `@Controller` 또는 `@RestController` Bean의 메서드가 Handler가 된다.

### 5.2 HandlerMapping의 질문

HandlerMapping은 다음 정보를 비교해 처리 대상을 찾는다.

- 요청 경로가 맞는가?
- HTTP 메서드가 맞는가?
- `consumes`, `produces` 같은 추가 조건이 맞는가?

경로 자체가 없으면 보통 404, 경로는 있지만 HTTP 메서드가 다르면 보통 405로 이어진다.

### 5.3 HandlerAdapter가 필요한 이유

`DispatcherServlet`이 모든 종류의 Handler 호출 방법을 직접 알면 결합이 커진다. HandlerAdapter는 선택된 Handler를 실제로 실행할 수 있도록 중간에서 호출 방식을 맞춘다.

애너테이션 기반 Controller에는 주로 `RequestMappingHandlerAdapter`가 사용된다. 이 과정에서 메서드 인자를 구성하고 반환값을 처리하는 전략들이 함께 동작한다.

## 6. Controller를 Bean으로 발견하는 과정

```java
@RestController
@RequestMapping("/api/books")
public class BookController {
}
```

`@RestController`가 붙은 클래스는 컴포넌트 스캔 대상이다. 애플리케이션 시작 시 다음 일이 일어난다.

```text
컴포넌트 스캔
  → BookController를 Bean으로 등록
  → 매핑 애너테이션 조사
  → "GET /api/books/{id}" 같은 매핑 정보 저장
  → 요청이 오면 저장된 정보로 Handler 탐색
```

Controller가 시작 클래스의 기본 스캔 범위 밖에 있으면 Bean으로 등록되지 않고 매핑도 만들어지지 않는다. 코드에 애너테이션이 있어도 404가 나는 대표적인 이유다.

권장 구조는 시작 클래스 아래에 웹 계층을 배치하는 것이다.

```text
com.example.reading
├─ ReadingApplication.java
├─ book
│  ├─ BookController.java
│  └─ BookService.java
└─ common
```

## 7. 요청을 메서드에 연결하는 매핑 애너테이션

### 7.1 클래스 경로와 메서드 경로를 합친다

```java
@RestController
@RequestMapping("/api/books")
public class BookController {

    @GetMapping("/{bookId}")
    public String find(@PathVariable long bookId) {
        return "book-" + bookId;
    }
}
```

최종 매핑은 다음과 같다.

```text
클래스 경로 /api/books
       +
메서드 경로 /{bookId}
       =
GET /api/books/{bookId}
```

### 7.2 HTTP 메서드별 축약 애너테이션

| 애너테이션 | 주로 표현하는 작업 | 예시 |
| --- | --- | --- |
| `@GetMapping` | 조회 | 책 한 권 조회 |
| `@PostMapping` | 생성·명령 | 새 책 등록 |
| `@PutMapping` | 전체 교체 | 책 정보 전체 수정 |
| `@PatchMapping` | 부분 수정 | 읽음 상태만 수정 |
| `@DeleteMapping` | 삭제 | 책 기록 삭제 |

이 구분은 절대적인 비즈니스 규칙이 아니라 HTTP 의미를 코드에 드러내는 관례다. 중요한 것은 같은 경로라도 HTTP 메서드에 따라 서로 다른 작업에 매핑될 수 있다는 점이다.

### 7.3 매핑 충돌은 시작할 때 발견될 수 있다

같은 조건의 매핑을 두 메서드가 동시에 선언하면 Spring이 어느 메서드를 선택해야 할지 결정할 수 없다. 이런 모호한 매핑은 애플리케이션 시작 단계에서 오류로 드러날 수 있다.

## 8. 요청 값을 Java 매개변수로 바꾸기

Controller 메서드의 매개변수는 개발자가 직접 `new`로 만들지 않는다. Spring MVC의 인자 해석기가 요청에서 필요한 값을 찾고 변환한다.

### 8.1 Path Variable

경로 자체가 자원을 식별할 때 사용한다.

```java
@GetMapping("/{bookId}")
public String find(@PathVariable long bookId) {
    return "book-" + bookId;
}
```

```text
GET /api/books/10
                   └─ "10"을 long 10으로 변환
```

`/api/books/abc`처럼 숫자로 바꿀 수 없는 값이 오면 Controller 본문이 실행되기 전에 400 응답이 발생할 수 있다.

### 8.2 Query Parameter

조회 조건, 정렬, 페이지처럼 선택적인 조건을 표현할 때 자주 쓴다.

```java
@GetMapping
public String findAll(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    return "page=" + page + ", size=" + size;
}
```

```text
GET /api/books?page=2&size=10
```

필수 Parameter가 누락되거나 타입 변환에 실패하면 메서드 실행 전 400이 될 수 있다.

### 8.3 Request Header

```java
@GetMapping("/language")
public String language(
        @RequestHeader(name = "Accept-Language", defaultValue = "ko") String language) {
    return language;
}
```

인증 토큰을 직접 파싱하는 예제를 자주 볼 수 있지만, 실제 인증은 이후 Spring Security의 Filter 흐름과 함께 학습하는 것이 좋다.

### 8.4 Request Body

```java
public record CreateBookRequest(
        String title,
        String author
) {
}

@PostMapping
public String create(@RequestBody CreateBookRequest request) {
    return request.title();
}
```

`@RequestBody`는 요청 본문을 Java 객체로 읽어 달라는 뜻이다. JSON 문자열을 Java 객체로 바꾸는 실제 작업에는 메시지 변환기와 JSON 라이브러리가 관여한다.

## 9. `@Controller`와 `@RestController`

### 9.1 `@Controller`: View 기반 응답에 자주 사용

```java
@Controller
public class PageController {

    @GetMapping("/books")
    public String booksPage(Model model) {
        model.addAttribute("title", "책 목록");
        return "books";
    }
}
```

이 `String`은 응답 본문 `books`가 아니라 기본적으로 View 이름으로 해석될 수 있다. ViewResolver와 템플릿 엔진이 실제 HTML을 만드는 흐름으로 이어진다.

### 9.2 `@RestController`: 응답 본문 기반 API에 사용

`@RestController`는 `@Controller`와 `@ResponseBody`의 의미를 합친 애너테이션이다.

```java
@RestController
public class BookApiController {

    @GetMapping("/api/books/1")
    public BookResponse find() {
        return new BookResponse(1L, "Spring Start");
    }
}
```

여기서 반환 객체는 View 이름이 아니라 HTTP 응답 본문으로 처리된다.

```json
{
  "id": 1,
  "title": "Spring Start"
}
```

## 10. HttpMessageConverter와 JSON 변환

### 10.1 변환이 필요한 이유

HTTP 본문은 네트워크로 전송할 수 있는 바이트 데이터다. 반면 Controller는 Java 객체를 사용한다.

```text
요청: JSON 바이트
  → HttpMessageConverter가 읽기
  → CreateBookRequest 객체

응답: BookResponse 객체
  → HttpMessageConverter가 쓰기
  → JSON 바이트
```

Spring Framework의 `HttpMessageConverter`는 HTTP 요청·응답 본문을 읽고 쓰는 계약이다. JSON, 문자열, byte 배열, form 데이터 등 형식에 따라 다른 구현이 선택된다.

### 10.2 JSON 변환과 Jackson

JSON 변환기가 사용 가능하면 Jackson 계열 매퍼가 Java 객체와 JSON 사이를 변환한다. 개발자가 Controller 안에서 매번 JSON 문자열을 이어 붙일 필요가 없다.

```java
public record BookResponse(
        long id,
        String title
) {
}
```

```java
return new BookResponse(1L, "Spring Start");
```

```json
{
  "id": 1,
  "title": "Spring Start"
}
```

객체를 직접 반환하면 필드 추가·이름 변경을 타입으로 관리할 수 있다. JSON을 직접 조립하는 것보다 오타와 escaping 오류도 줄어든다.

### 10.3 Content-Type이 맞아야 읽을 수 있다

JSON 본문을 보내면서 다음 Header를 빠뜨리면 적절한 변환기를 선택하지 못할 수 있다.

```http
Content-Type: application/json
```

Controller가 특정 입력 형식만 받도록 제한할 수도 있다.

```java
@PostMapping(consumes = "application/json")
public BookResponse create(@RequestBody CreateBookRequest request) {
    return new BookResponse(1L, request.title());
}
```

지원하지 않는 본문 형식이면 보통 415 Unsupported Media Type을 확인한다.

### 10.4 Accept와 응답 형식

클라이언트가 서버가 만들 수 없는 형식만 요구하면 보통 406 Not Acceptable이 될 수 있다.

```http
Accept: application/json
```

`produces`로 응답 형식을 명시할 수도 있다.

```java
@GetMapping(value = "/{bookId}", produces = "application/json")
public BookResponse find(@PathVariable long bookId) {
    return new BookResponse(bookId, "Spring Start");
}
```

## 11. 응답을 세 부분으로 생각하기

HTTP 응답은 상태 코드, Header, Body로 나눌 수 있다.

```http
HTTP/1.1 201 Created
Location: /api/books/1
Content-Type: application/json

{
  "id": 1,
  "title": "Spring Start"
}
```

### 11.1 객체만 반환하기

```java
@GetMapping("/{bookId}")
public BookResponse find(@PathVariable long bookId) {
    return bookService.find(bookId);
}
```

간단한 200 응답에서는 읽기 쉽다.

### 11.2 `ResponseEntity`로 응답 전체 표현하기

```java
@PostMapping
public ResponseEntity<BookResponse> create(
        @RequestBody CreateBookRequest request) {
    BookResponse response = bookService.create(request);
    URI location = URI.create("/api/books/" + response.id());

    return ResponseEntity
            .created(location)
            .body(response);
}
```

`ResponseEntity`는 상태 코드·Header·Body를 명시적으로 구성할 때 유용하다. 모든 응답을 무조건 `ResponseEntity`로 감싸야 하는 것은 아니다. 표현할 HTTP 정보가 있는지를 기준으로 선택한다.

## 12. 작은 예제로 전체 흐름 연결하기

### 12.1 파일 구조

```text
com.example.reading
├─ ReadingApplication.java
└─ book
   ├─ BookController.java
   ├─ BookService.java
   ├─ CreateBookRequest.java
   └─ BookResponse.java
```

### 12.2 요청·응답 객체

```java
package com.example.reading.book;

public record CreateBookRequest(
        String title,
        String author
) {
}
```

```java
package com.example.reading.book;

public record BookResponse(
        long id,
        String title,
        String author
) {
}
```

여기서는 흐름에 집중하기 위해 Validation 애너테이션과 데이터베이스를 생략한다. 입력 검증과 DTO 설계는 다음 노트에서 더 자세히 다룬다.

### 12.3 Service

```java
package com.example.reading.book;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

@Service
public class BookService {
    private final Map<Long, BookResponse> books = new LinkedHashMap<>();
    private long sequence = 0L;

    public BookResponse create(CreateBookRequest request) {
        long id = ++sequence;
        BookResponse response = new BookResponse(
                id,
                request.title(),
                request.author()
        );
        books.put(id, response);
        return response;
    }

    public List<BookResponse> findAll() {
        return List.copyOf(books.values());
    }

    public BookResponse findById(long id) {
        BookResponse response = books.get(id);
        if (response == null) {
            throw new IllegalArgumentException("존재하지 않는 책입니다. id=" + id);
        }
        return response;
    }
}
```

이 메모리 저장 방식은 요청 흐름 학습용이다. singleton Bean의 변경 가능한 상태는 동시 요청에서 안전하지 않을 수 있으므로 실제 애플리케이션의 저장소로 사용하지 않는다.

### 12.4 Controller

```java
package com.example.reading.book;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/books")
public class BookController {
    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @PostMapping
    public ResponseEntity<BookResponse> create(
            @RequestBody CreateBookRequest request) {
        BookResponse response = bookService.create(request);
        URI location = URI.create("/api/books/" + response.id());
        return ResponseEntity.created(location).body(response);
    }

    @GetMapping
    public List<BookResponse> findAll() {
        return bookService.findAll();
    }

    @GetMapping("/{bookId}")
    public BookResponse findById(@PathVariable long bookId) {
        return bookService.findById(bookId);
    }
}
```

### 12.5 POST 요청 추적

```text
POST /api/books + JSON
  → DispatcherServlet
  → HandlerMapping이 create 메서드 선택
  → JSON을 CreateBookRequest로 역직렬화
  → BookController.create 실행
  → BookService.create 실행
  → BookResponse 반환
  → ResponseEntity에서 201·Location·Body 추출
  → BookResponse를 JSON으로 직렬화
  → 201 Created 응답
```

## 13. 직접 요청하고 응답 확인하기

PowerShell에서는 실제 curl 실행 파일을 명확히 쓰기 위해 `curl.exe`를 사용할 수 있다.

### 13.1 책 등록

```powershell
curl.exe -i -X POST "http://localhost:8080/api/books" `
  -H "Content-Type: application/json" `
  -H "Accept: application/json" `
  -d '{"title":"Spring Start","author":"Kim"}'
```

확인할 내용은 Body만이 아니다.

- 상태 코드가 `201 Created`인가?
- `Location` Header가 생성된 자원 경로인가?
- `Content-Type`이 JSON인가?
- Body의 필드와 값이 예상과 같은가?

### 13.2 전체 조회

```powershell
curl.exe -i "http://localhost:8080/api/books"
```

### 13.3 경로 변수 조회

```powershell
curl.exe -i "http://localhost:8080/api/books/1"
```

## 14. 상태 코드로 실패 지점 추정하기

상태 코드는 원인을 확정하지는 않지만 조사할 단계를 좁혀 준다.

| 상태 | 먼저 의심할 지점 | 확인할 내용 |
| --- | --- | --- |
| 404 Not Found | Handler 탐색 | 경로 오타, context path, 컴포넌트 스캔, 매핑 등록 여부 |
| 405 Method Not Allowed | HTTP 메서드 조건 | GET 대신 POST를 보냈는지, 매핑 애너테이션 |
| 400 Bad Request | 인자 해석·본문 읽기 | 숫자 변환, 필수 Parameter, JSON 문법·필드 타입 |
| 415 Unsupported Media Type | 요청 본문 변환 | `Content-Type`, `consumes`, 변환기 의존성 |
| 406 Not Acceptable | 응답 형식 선택 | `Accept`, `produces`, 작성 가능한 변환기 |
| 500 Internal Server Error | Handler 실행 이후 | Service 예외, null, 외부 시스템, 예외 로그의 최초 원인 |

### 14.1 404: Controller 코드에 진입하지 않음

체크 순서는 다음과 같다.

1. 애플리케이션이 실제로 실행 중인가?
2. 포트가 맞는가?
3. 클래스·메서드 경로를 합친 최종 URL이 맞는가?
4. Controller가 컴포넌트 스캔 범위 안에 있는가?
5. 시작 로그에 매핑 관련 오류가 없었는가?

### 14.2 405: 경로는 있지만 메서드가 다름

`@GetMapping("/api/books")`만 있는데 POST를 보내면 같은 경로 문자열이 존재해도 요청 조건은 일치하지 않는다.

### 14.3 400: 메서드 실행 전에도 발생함

다음 요청은 `long` 변환에 실패한다.

```text
GET /api/books/not-a-number
```

Controller 첫 줄에 중단점을 두었는데 멈추지 않는다면 인자 해석 단계부터 확인한다.

### 14.4 415와 406: 본문의 방향을 구분함

```text
415 → 서버가 클라이언트가 보낸 본문 형식을 읽을 수 없음
406 → 서버가 클라이언트가 원하는 응답 형식을 만들 수 없음
```

## 15. 예외는 어디로 가는가

Controller나 Service 실행 중 예외가 발생하면 정상 반환값 처리 대신 예외 해석 과정으로 이동한다.

```text
Controller 또는 Service에서 예외
  → HandlerExceptionResolver 계열이 처리 방법 탐색
  → @ExceptionHandler 등 적용 가능 여부 확인
  → 처리되면 오류 응답 생성
  → 처리되지 않으면 Servlet Container로 전파
  → Spring Boot의 오류 처리 흐름으로 이어질 수 있음
```

메서드 내부의 간단한 예외 처리는 `@ExceptionHandler`로 작성할 수 있다.

```java
@ExceptionHandler(IllegalArgumentException.class)
public ResponseEntity<String> handleIllegalArgument(
        IllegalArgumentException exception) {
    return ResponseEntity
            .badRequest()
            .body(exception.getMessage());
}
```

여러 Controller에 공통 적용할 때는 `@ControllerAdvice` 또는 `@RestControllerAdvice`를 사용할 수 있다. 다만 일관된 오류 DTO와 예외 분류는 Validation·예외 처리 노트에서 별도로 학습한다.

## 16. Filter와 Interceptor는 어느 위치인가

둘 다 공통 처리를 넣을 수 있지만 동작하는 경계가 다르다.

```text
클라이언트
  → Filter
  → DispatcherServlet
  → HandlerInterceptor preHandle
  → Controller
  → HandlerInterceptor 후처리
  → Filter
  → 클라이언트
```

| 구분 | 기반 | 주로 볼 수 있는 대상 | 대표 용도 |
| --- | --- | --- | --- |
| Filter | Servlet 표준 | DispatcherServlet 전후의 요청·응답 | 인코딩, 요청 래핑, 보안 필터 체인 |
| HandlerInterceptor | Spring MVC | 선택된 Handler와 MVC 실행 흐름 | Controller 전후 로깅, MVC 단위 공통 검사 |

Controller마다 복사한 공통 코드를 무조건 Filter나 Interceptor로 옮기는 것이 정답은 아니다. 인증은 Spring Security, 오류 응답은 Advice처럼 목적에 맞는 전용 기능을 먼저 검토한다.

## 17. 정적 자원과 Controller 요청

모든 HTTP 요청이 직접 Controller 메서드로 가는 것은 아니다. Spring Boot는 설정에 따라 정적 자원 경로도 처리한다.

```text
GET /css/app.css
  → 정적 자원 Handler가 처리할 수 있음

GET /api/books
  → 애너테이션 기반 Controller Handler가 처리
```

요청 경로 충돌을 줄이기 위해 API에는 `/api` 같은 일관된 접두사를 사용하는 경우가 많다.

## 18. 디버깅할 때 흐름을 거꾸로 확인하기

### 18.1 시작 실패와 요청 실패를 먼저 구분한다

```text
애플리케이션이 시작하지 못함
  → Bean 생성, 포트 충돌, 설정, 매핑 충돌 확인

애플리케이션은 시작했지만 요청이 실패함
  → URL·메서드·Header·Body·Controller 실행·반환 변환 확인
```

### 18.2 중단점을 둘 위치

1. Controller 메서드 첫 줄
2. Service 메서드 첫 줄
3. 예외가 실제로 발생하는 줄

Controller에 도달하지 않으면 서버 주소, Filter, 매핑, 인자 변환 단계를 확인한다. Controller에는 도달하지만 Service에 도달하지 않으면 Controller 내부 분기와 전달 인자를 확인한다.

### 18.3 로그에서 첫 원인을 찾는다

긴 Stack Trace의 마지막 줄만 읽지 않는다.

- 요청 메서드와 URI
- 응답 상태
- 예외 타입과 메시지
- `Caused by` 중 애플리케이션 코드에 가까운 최초 원인
- 내 코드의 파일명과 줄 번호

## 19. 자주 하는 오해

### 오해 1. `@GetMapping`이 메서드를 직접 실행한다

애너테이션은 매핑 정보를 제공한다. 실제 탐색과 호출은 `DispatcherServlet`, HandlerMapping, HandlerAdapter 등이 협력해 수행한다.

### 오해 2. `@RestController`가 JSON 변환기다

`@RestController`는 반환값을 응답 본문으로 처리하도록 의미를 부여한다. 실제 형식 변환은 선택된 `HttpMessageConverter`가 담당한다.

### 오해 3. Spring Boot에는 Tomcat 같은 서버가 없다

기본 구성에서는 내장 서버가 애플리케이션과 함께 실행된다. 별도 서버 설치가 필요 없다는 말과 서버가 없다는 말은 다르다.

### 오해 4. 500이면 Controller 매핑 문제다

매핑을 찾아 Handler 실행까지 갔다가 애플리케이션 예외가 발생했을 가능성이 크다. 404·405와 조사 위치가 다르다.

### 오해 5. Controller가 모든 규칙을 처리해야 한다

Controller는 HTTP 입력을 애플리케이션이 사용할 형태로 전달하고 결과를 HTTP 응답으로 표현하는 경계다. 핵심 비즈니스 규칙은 Service 등 적절한 계층에 둔다.

## 20. 구현 순서 체크리스트

작은 API 하나를 만들 때 다음 순서를 사용한다.

1. 요청의 HTTP 메서드와 최종 경로를 정한다.
2. Path, Query, Header, Body 중 입력 위치를 구분한다.
3. 응답 상태·Header·Body를 정한다.
4. Controller 매핑과 메서드 시그니처를 작성한다.
5. Service를 생성자로 주입한다.
6. 객체 반환과 `ResponseEntity` 중 필요한 표현을 선택한다.
7. 정상 요청을 실제로 보낸다.
8. 잘못된 경로·메서드·JSON·Content-Type도 보내 본다.
9. 각 실패가 어느 처리 단계에서 발생하는지 설명한다.

## 21. 배운 점과 다음 학습 연결

### 21.1 이번 노트에서 연결한 것

- Spring Boot가 내장 Servlet Container와 Spring MVC 구성을 준비한다.
- `DispatcherServlet`은 MVC 요청의 공통 진입점이다.
- HandlerMapping은 요청 조건에 맞는 처리 대상을 찾는다.
- HandlerAdapter는 Controller 메서드의 인자 구성과 호출을 지원한다.
- `HttpMessageConverter`는 HTTP 본문과 Java 객체 사이를 변환한다.
- 상태 코드로 실패 지점을 좁힐 수 있다.

### 21.2 이전 노트와의 연결

Controller와 Service가 먼저 Bean으로 등록되고 생성자 주입으로 연결되어 있어야 요청 시점에 조립된 객체를 사용할 수 있다. 즉, 이전의 IoC·DI 학습은 이번 요청 흐름의 실행 기반이다.

### 21.3 다음 학습

다음에는 REST API와 DTO를 중심으로 다음 내용을 확장한다.

- Entity와 요청·응답 DTO를 분리하는 이유
- HTTP 메서드와 상태 코드 선택
- JSON 필드와 Java 타입의 계약
- API 응답 구조와 변경 가능성
- 입력 검증과 오류 응답으로 이어지는 경계

## 22. 요약 정리

1. 내장 서버는 HTTP 요청을 받아 Servlet 환경의 요청·응답으로 연결한다.
2. `DispatcherServlet`은 Front Controller로서 Spring MVC 요청 처리의 중심 진입점이다.
3. HandlerMapping이 경로·HTTP 메서드 등의 조건으로 Controller 메서드를 찾는다.
4. HandlerAdapter와 인자 해석기가 요청 값을 Java 매개변수로 구성한다.
5. `@Controller`의 반환값은 View로, `@RestController`의 반환값은 응답 본문으로 처리되는 것이 기본 방향이다.
6. `HttpMessageConverter`가 JSON 같은 본문 형식과 Java 객체 사이를 변환한다.
7. `ResponseEntity`는 상태 코드·Header·Body를 함께 명시할 때 사용한다.
8. 404·405·400·415·406·500은 요청 흐름의 서로 다른 지점을 조사하게 해 준다.

## 23. 미니 퀴즈

1. Spring Boot, Spring MVC, Servlet Container의 책임을 각각 한 문장으로 설명할 수 있는가?
2. `DispatcherServlet`을 Front Controller라고 부르는 이유는 무엇인가?
3. HandlerMapping과 HandlerAdapter의 역할은 어떻게 다른가?
4. `/api/books/abc`를 `long bookId`로 받으면 Controller 본문 전에 실패할 수 있는 이유는 무엇인가?
5. `Content-Type`과 `Accept`는 각각 어느 방향의 형식을 나타내는가?
6. `@Controller`가 반환한 `String`과 `@RestController`가 반환한 `String`은 어떻게 해석될 수 있는가?
7. Java 객체가 JSON 응답으로 바뀔 때 실제 변환을 담당하는 것은 무엇인가?
8. 404와 500일 때 Controller 중단점의 결과가 어떻게 다를 수 있는가?
9. Filter와 HandlerInterceptor는 흐름의 어느 위치에서 동작하는가?
10. Controller를 시작 클래스의 스캔 범위 밖에 만들었을 때 404가 날 수 있는 이유는 무엇인가?

## 참고 자료

- [Spring Framework Reference - DispatcherServlet](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet.html)
- [Spring Framework Reference - Annotated Controllers](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller.html)
- [Spring Framework Reference - HTTP Message Conversion](https://docs.spring.io/spring-framework/reference/web/webmvc/message-converters.html)
- [Spring Boot Reference - Servlet Web Applications](https://docs.spring.io/spring-boot/reference/web/servlet.html)

> 정리 기준일: 2026-08-28
