# Spring Boot REST API와 DTO 설계 이해하기

- 🎯 글의 목표: HTTP 자원과 메서드의 의미를 바탕으로 REST API 경로를 설계하고, 요청·응답 DTO로 외부 JSON 계약과 내부 모델을 분리하며, 상황에 맞는 상태 코드를 반환한다.
- 🧩 핵심 키워드: REST, Resource, URI, HTTP Method, Safe, Idempotent, DTO, JSON Contract, `@RequestBody`, `@ResponseBody`, `ResponseEntity`, `Location`, CRUD
- ⭐ 중요도: ★★★★★ — API의 경로·입력·출력은 프론트엔드와 서버 사이의 계약이다. 이 경계를 제대로 설계해야 내부 구현을 바꾸어도 클라이언트를 보호할 수 있다.
- 📝 한눈에 보는 내용: URI는 자원을 표현하고 HTTP 메서드는 그 자원에 수행할 의미를 표현한다. Controller는 요청 DTO를 받아 애플리케이션 입력으로 전달하고, 내부 결과를 응답 DTO로 바꾼다. 상태 코드와 Header까지 함께 설계해야 완전한 HTTP 응답이 된다.
- 🔗 관련 주제: Spring MVC 요청 흐름, JSON 직렬화·역직렬화, Entity, Validation, 예외 처리, OpenAPI, API 버전 관리
- 🧱 선수 지식: HTTP 요청·응답, `@RestController`, `@RequestMapping`, `@RequestBody`, `HttpMessageConverter`, Java record·컬렉션

---

## 1. 들어가며

Controller가 JSON을 주고받는다고 해서 자동으로 좋은 REST API가 되는 것은 아니다.

```java
@PostMapping("/createBook")
public Book createBook(@RequestBody Book book) {
    return bookRepository.save(book);
}
```

이 코드는 동작할 수 있지만 다음 질문이 남는다.

- 경로에 동사를 넣는 것이 자원의 구조를 잘 표현하는가?
- 클라이언트가 데이터베이스 Entity의 모든 필드를 보내도 되는가?
- 생성 성공을 200으로 반환할지 201로 반환할지 정했는가?
- 생성된 자원의 위치를 어떻게 알려 줄 것인가?
- Entity에 필드를 추가하면 API 응답도 뜻하지 않게 바뀌지 않는가?
- 수정 API에서 누락된 값과 `null`을 어떻게 구분할 것인가?

이번 노트에서는 코드를 쓰기 전에 **HTTP 계약을 설계하는 사고방식**부터 정리한다.

```text
자원과 URI 결정
    ↓
HTTP 메서드와 동작 의미 결정
    ↓
요청 JSON 계약 → 요청 DTO
    ↓
비즈니스 로직과 내부 모델
    ↓
응답 DTO → 응답 JSON 계약
    ↓
상태 코드·Header·Body 반환
```

> 이 문서는 2026년 8월 29일의 Spring Framework 7.0 공식 문서와 HTTP Semantics 표준을 확인해 작성했다. 세부 API는 프로젝트가 사용하는 Spring Boot·Spring Framework 버전 문서를 우선한다.

## 2. REST를 처음 배울 때 잡아야 할 기준

REST는 특정 Java 애너테이션의 이름이 아니다. 웹의 자원과 표현, 통일된 인터페이스 등을 활용하는 아키텍처 스타일이다. 실무에서 “REST API”라는 말은 엄밀한 REST 제약을 모두 충족한다는 뜻보다 **HTTP의 자원·메서드·상태 코드 의미를 일관되게 활용하는 JSON API**를 가리킬 때도 많다.

따라서 처음에는 다음 세 질문부터 일관되게 답하는 것이 좋다.

1. 클라이언트가 다루는 **자원**은 무엇인가?
2. 그 자원을 식별하는 **URI**는 무엇인가?
3. 자원에 수행할 작업을 어떤 **HTTP 메서드**로 표현할 것인가?

책 기록 서비스를 예로 들면 자원은 `book`, 컬렉션은 `books`, 개별 자원은 ID로 식별할 수 있다.

```text
/api/books       → 책 컬렉션
/api/books/10    → ID가 10인 책 한 권
```

## 3. URI에는 자원, HTTP 메서드에는 행동

### 3.1 경로를 동사로만 만들 때의 문제

```text
POST /api/createBook
POST /api/getBooks
POST /api/updateBook
POST /api/deleteBook
```

경로 이름만 읽어야 작업을 알 수 있고 HTTP 메서드가 가진 의미를 활용하기 어렵다. 같은 자원에 대한 규칙도 흩어진다.

### 3.2 자원을 중심으로 표현하기

```text
POST   /api/books       → 책 생성
GET    /api/books       → 책 목록 조회
GET    /api/books/10    → 책 한 권 조회
PUT    /api/books/10    → 책 전체 교체
PATCH  /api/books/10    → 책 일부 수정
DELETE /api/books/10    → 책 삭제
```

URI는 “무엇”을, HTTP 메서드는 “어떻게 다룰지”를 표현한다.

### 3.3 실무적인 URI 작성 기준

- 컬렉션 이름은 프로젝트 안에서 일관되게 사용한다.
- 보통 URI 경로에는 소문자와 하이픈을 사용한다.
- 구현 클래스명이나 데이터베이스 테이블명을 그대로 노출하지 않는다.
- 계층 관계가 실제 자원 관계를 분명히 할 때만 중첩한다.
- 지나치게 깊은 중첩은 피한다.

```text
좋은 출발점
/api/books/10/reviews

너무 깊어지기 쉬운 형태
/api/users/3/libraries/2/shelves/7/books/10/reviews/5
```

중첩 경로는 소유 관계와 범위를 드러내지만, 깊어질수록 이동·재사용·권한 규칙이 복잡해진다.

## 4. HTTP 메서드의 의미

HTTP 표준은 각 메서드에 의미를 부여한다. 서버 코드가 이 의미를 지키면 브라우저, Proxy, Cache, API 도구와 사람이 요청을 더 예측 가능하게 이해할 수 있다.

| 메서드 | 일반적인 의미 | 안전함 | 멱등성 |
| --- | --- | ---: | ---: |
| GET | 자원의 현재 표현 조회 | O | O |
| POST | 컬렉션에 생성 요청 또는 명령 제출 | X | 보장하지 않음 |
| PUT | 지정한 URI의 자원 전체 생성·교체 | X | O |
| PATCH | 자원의 일부 변경 | X | 명세·구현에 따라 다름 |
| DELETE | 자원 제거 요청 | X | O |

### 4.1 안전한 메서드

안전하다는 말은 호출이 서버의 요청된 상태 변경을 요구하지 않는다는 뜻이다. GET은 조회를 표현해야 한다.

```java
// 피해야 하는 설계: GET 요청이 데이터를 삭제한다.
@GetMapping("/{bookId}/delete")
public void delete(@PathVariable long bookId) {
    bookService.delete(bookId);
}
```

로그 기록이나 통계 수집 같은 부수 효과가 전혀 없어야 한다는 뜻은 아니지만, 사용자가 요청한 의미가 조회여야 한다.

### 4.2 멱등한 메서드

같은 요청을 한 번 보내거나 여러 번 보내도 **서버에 의도된 최종 효과가 같은 성질**이다.

```text
DELETE /api/books/10
한 번 호출  → 책 10이 없음
여러 번 호출 → 책 10이 없음
```

두 번째 DELETE의 응답 상태가 첫 번째와 같아야 한다는 뜻은 아니다. 첫 번째는 204, 다음은 404가 될 수 있어도 최종 자원 상태는 동일하다.

POST 생성은 같은 요청을 재전송할 때 새 ID가 계속 생길 수 있으므로 기본적으로 멱등성을 보장하지 않는다. 결제처럼 중복 실행이 위험한 API는 별도의 idempotency key 같은 정책을 설계하기도 한다.

## 5. API 계약은 무엇인가

API 계약은 Controller 메서드 시그니처만을 뜻하지 않는다. 클라이언트가 관찰하고 의존하는 모든 요소가 계약이 된다.

```text
요청 계약
├─ HTTP 메서드
├─ URI와 Path Variable
├─ Query Parameter
├─ Header
└─ Body의 JSON 구조와 필드 의미

응답 계약
├─ 상태 코드
├─ Header
└─ Body의 JSON 구조와 필드 의미
```

다음 변경은 서버 내부 리팩터링처럼 보여도 클라이언트를 깨뜨릴 수 있다.

- JSON 필드명 `title`을 `bookTitle`로 변경
- 숫자 ID를 문자열 UUID로 변경
- 없던 필수 요청 필드 추가
- `null`이던 필드를 응답에서 제거
- 배열을 `{ "items": [...] }` 객체로 변경
- 404 응답을 200과 빈 객체로 변경

DTO는 이 외부 계약을 코드에서 명시적으로 표현하는 도구다.

## 6. DTO란 무엇인가

DTO는 Data Transfer Object의 약자로, 계층이나 시스템 경계를 넘어 전달할 데이터를 담는 객체다. Spring MVC에서는 주로 HTTP 요청 본문을 받을 때와 응답 본문을 만들 때 사용한다.

```text
요청 JSON
  → CreateBookRequest
  → Controller
  → Service 입력

Service 결과
  → BookResponse
  → 응답 JSON
```

DTO의 핵심은 “getter와 setter만 있는 클래스”가 아니다. **특정 경계를 통과하는 데이터의 형태와 의미를 표현하는 것**이다.

## 7. 요청 DTO와 응답 DTO를 나누는 이유

### 7.1 들어오는 정보와 나가는 정보가 다르다

책 생성 시 클라이언트는 제목과 저자를 보내지만, 서버는 ID와 생성 시각을 만들어 응답할 수 있다.

```json
// 요청
{
  "title": "Spring Start",
  "author": "Kim"
}
```

```json
// 응답
{
  "id": 1,
  "title": "Spring Start",
  "author": "Kim",
  "createdAt": "2026-08-29T10:30:00Z"
}
```

하나의 DTO를 양방향으로 공유하면 요청에 필요 없는 `id`, `createdAt`까지 받을 수 있게 되고 각 필드의 필수 여부도 모호해진다.

### 7.2 작업마다 입력 의미가 다르다

```java
public record CreateBookRequest(
        String title,
        String author
) {
}

public record ReplaceBookRequest(
        String title,
        String author
) {
}

public record PatchBookRequest(
        String title,
        String author
) {
}

public record BookResponse(
        long id,
        String title,
        String author,
        Instant createdAt
) {
}
```

필드가 우연히 같더라도 생성과 수정은 서로 다른 사용 사례다. 나중에 생성에만 필요한 값 또는 수정에만 필요한 값이 생겼을 때 독립적으로 바꿀 수 있다.

### 7.3 이름에 역할을 드러낸다

`BookDto` 하나만 쓰면 어디에서 어떤 방향으로 쓰는지 알기 어렵다.

```text
CreateBookRequest  → 책 생성 요청
ReplaceBookRequest → 책 전체 교체 요청
PatchBookRequest   → 책 일부 수정 요청
BookResponse       → 책 단건 응답
BookSummaryResponse → 목록용 요약 응답
```

DTO 이름은 프레임워크 기술보다 사용 사례와 방향을 설명하는 편이 읽기 쉽다.

## 8. Entity를 API에 직접 노출하면 생기는 문제

아직 JPA를 배우기 전이라도 Entity와 API 모델을 분리해야 하는 이유를 먼저 이해할 수 있다.

```java
// 피하고 싶은 출발점
@PostMapping
public BookEntity create(@RequestBody BookEntity book) {
    return bookRepository.save(book);
}
```

### 8.1 과도한 입력 허용

Entity에 `id`, `role`, `createdAt`, 내부 상태 필드가 있으면 클라이언트가 원래 수정하면 안 되는 값까지 보낼 가능성이 생긴다. 역직렬화 여부와 실제 저장 로직을 세밀하게 제어하지 않으면 mass assignment와 비슷한 위험으로 이어질 수 있다.

### 8.2 내부 변경이 외부 계약을 바꿈

데이터베이스 최적화를 위해 Entity 필드를 바꾸었는데 JSON 응답도 바뀔 수 있다. 저장 모델과 API 모델의 변경 이유가 서로 다른데 같은 클래스를 공유한 결과다.

### 8.3 연관관계 직렬화 문제

양방향 연관관계가 그대로 JSON 변환되면 순환 참조, 지나치게 큰 응답, 예상하지 못한 추가 조회가 발생할 수 있다.

### 8.4 민감한 정보 노출

비밀번호 hash, 내부 메모, 권한 정보 같은 필드가 자동 직렬화 대상이 될 수 있다. “현재 JSON에 안 보인다”보다 응답 DTO에 **보낼 필드만 명시한다**는 정책이 안전하다.

### 8.5 책임 분리

```text
Entity·Domain Model
  → 저장과 비즈니스 규칙에 맞춰 변화

Request·Response DTO
  → 외부 API 계약과 사용 사례에 맞춰 변화
```

분리는 클래스 수를 늘리지만 변경의 영향을 줄이고 보안 검토 지점을 분명하게 한다.

## 9. Java record로 DTO 표현하기

DTO가 값을 전달하고 생성 후 바뀔 필요가 없다면 Java record가 간결한 선택이 될 수 있다.

```java
public record CreateBookRequest(
        String title,
        String author
) {
}
```

record는 컴포넌트에 대응하는 접근자, 생성자, `equals`, `hashCode`, `toString` 등을 제공한다.

```java
CreateBookRequest request = new CreateBookRequest("Spring Start", "Kim");

String title = request.title();
String author = request.author();
```

### 9.1 record를 사용한다고 자동으로 안전해지는 것은 아니다

- 입력 검증은 별도로 필요하다.
- 컴포넌트에 변경 가능한 `List`나 객체가 있으면 내부 값까지 불변인 것은 아니다.
- JSON 필드명과 타입은 여전히 API 계약이다.
- 프로젝트 Java·Jackson·Spring 버전의 지원 범위를 확인한다.

record가 프로젝트 기준에 맞지 않으면 일반 class와 생성자를 사용해도 DTO 역할은 동일하다.

## 10. `@RequestBody`와 요청 DTO

Spring MVC 공식 문서에 따르면 `@RequestBody`는 `HttpMessageConverter`를 통해 요청 본문을 객체로 역직렬화한다.

```java
@PostMapping
public BookResponse create(
        @RequestBody CreateBookRequest request) {
    return bookService.create(request);
}
```

```text
Content-Type: application/json

JSON 본문
  → JSON 메시지 변환기
  → CreateBookRequest 생성
  → Controller 메서드 호출
```

### 10.1 JSON 필드와 Java 컴포넌트

```json
{
  "title": "Spring Start",
  "author": "Kim"
}
```

```java
public record CreateBookRequest(String title, String author) {
}
```

기본 설정에서는 이름과 타입이 대응되어야 자연스럽게 변환된다. 잘못된 JSON 문법이나 맞지 않는 타입은 Controller 실행 전 400 응답으로 이어질 수 있다.

### 10.2 역직렬화 성공과 유효한 요청은 다르다

다음 JSON은 문자열 타입으로 변환할 수 있지만 비즈니스 입력으로는 잘못되었을 수 있다.

```json
{
  "title": "   ",
  "author": ""
}
```

```text
역직렬화
  → JSON을 Java 객체로 만들 수 있는가?

검증
  → 값이 애플리케이션 규칙에 맞는가?
```

`@Valid`, Bean Validation, 일관된 오류 응답은 다음 노트에서 자세히 다룬다.

## 11. 응답 DTO와 `@ResponseBody`

`@RestController`에서는 메서드 반환값이 기본적으로 응답 본문으로 처리된다. Spring MVC는 메시지 변환기를 사용해 응답 DTO를 JSON으로 직렬화한다.

```java
public record BookResponse(
        long id,
        String title,
        String author
) {
}
```

```java
@GetMapping("/{bookId}")
public BookResponse findById(@PathVariable long bookId) {
    return bookService.findById(bookId);
}
```

```text
BookResponse 객체
  → HttpMessageConverter
  → application/json 본문
```

### 11.1 응답에 필요한 값만 포함한다

응답 DTO는 화면 하나와 1:1로 무조건 맞추기보다 API 사용 사례에 필요한 정보를 안정적으로 표현한다.

```java
public record BookSummaryResponse(
        long id,
        String title
) {
}

public record BookDetailResponse(
        long id,
        String title,
        String author,
        String description
) {
}
```

목록에서 설명 전체가 필요 없다면 가벼운 요약 응답을 별도로 둘 수 있다. 반대로 너무 잘게 나눠 중복 관리 비용이 커지지 않도록 실제 변경 이유를 기준으로 판단한다.

## 12. DTO 변환 책임은 어디에 둘까

### 12.1 Controller에서 직접 변환

작은 예제에서는 명확하다.

```java
@GetMapping("/{bookId}")
public BookResponse findById(@PathVariable long bookId) {
    Book book = bookService.findById(bookId);

    return new BookResponse(
            book.getId(),
            book.getTitle(),
            book.getAuthor()
    );
}
```

### 12.2 DTO에 정적 팩터리 메서드

변환이 단순하고 응답 표현이 내부 모델을 읽는 정도라면 응답 DTO가 변환을 제공할 수 있다.

```java
public record BookResponse(
        long id,
        String title,
        String author
) {
    public static BookResponse from(Book book) {
        return new BookResponse(
                book.getId(),
                book.getTitle(),
                book.getAuthor()
        );
    }
}
```

```java
return BookResponse.from(bookService.findById(bookId));
```

### 12.3 별도 Mapper

변환 규칙이 크거나 여러 모델을 조합하면 Mapper를 분리할 수 있다.

```java
@Component
public class BookDtoMapper {

    public BookResponse toResponse(Book book) {
        return new BookResponse(
                book.getId(),
                book.getTitle(),
                book.getAuthor()
        );
    }
}
```

무조건 Mapper 클래스를 만드는 것도, 모든 변환을 Controller에 두는 것도 정답은 아니다. 다음 기준으로 선택한다.

- 변환 로직의 크기와 중복
- 여러 내부 모델을 조합하는지
- 변환 자체를 독립적으로 테스트할 가치가 있는지
- 의존 방향이 자연스러운지

## 13. 상태 코드는 결과의 의미다

상태 코드는 성공·실패 여부를 넘어 클라이언트가 다음 행동을 결정하는 정보다.

### 13.1 자주 사용하는 성공 상태

| 상태 | 의미 | 흔한 사용 예 |
| --- | --- | --- |
| 200 OK | 요청 성공, 응답 표현 있음 | 단건·목록 조회, 결과를 돌려주는 수정 |
| 201 Created | 새 자원이 생성됨 | POST 생성 |
| 202 Accepted | 요청을 접수했지만 처리가 완료되지 않음 | 비동기 작업 접수 |
| 204 No Content | 성공했으며 응답 본문 없음 | 삭제, 본문 없는 수정 |

### 13.2 자주 사용하는 클라이언트 오류 상태

| 상태 | 의미 | 흔한 사용 예 |
| --- | --- | --- |
| 400 Bad Request | 요청 문법·타입·내용을 처리할 수 없음 | JSON 변환 실패, 입력 검증 실패 |
| 401 Unauthorized | 유효한 인증 정보가 필요함 | 로그인·토큰 필요 |
| 403 Forbidden | 요청자의 접근이 허용되지 않음 | 권한 부족 |
| 404 Not Found | 대상 자원을 찾을 수 없음 | 존재하지 않는 ID |
| 409 Conflict | 현재 자원 상태와 요청이 충돌 | 중복 생성, 상태 충돌 |

`401`은 이름 때문에 “권한 없음”으로 오해하기 쉽지만 인증 자격 증명과 관련되고, 인증은 되었으나 권한이 부족한 경우는 보통 `403`을 검토한다.

### 13.3 200과 201의 차이

새 자원을 만들었다면 201은 생성이라는 결과를 명확히 표현한다. 가능하면 `Location` Header로 생성된 자원의 URI를 알려 준다.

```http
HTTP/1.1 201 Created
Location: /api/books/10
Content-Type: application/json

{
  "id": 10,
  "title": "Spring Start",
  "author": "Kim"
}
```

### 13.4 204에는 본문을 넣지 않는다

204는 응답 본문이 없다는 의미다.

```java
@DeleteMapping("/{bookId}")
public ResponseEntity<Void> delete(@PathVariable long bookId) {
    bookService.delete(bookId);
    return ResponseEntity.noContent().build();
}
```

삭제 결과 정보를 Body로 보내야 한다면 200과 응답 DTO가 더 자연스러울 수 있다.

## 14. `ResponseEntity`로 HTTP 응답 구성하기

`ResponseEntity`는 상태 코드, Header, Body를 함께 표현한다.

### 14.1 생성 응답

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

### 14.2 조회 응답

```java
@GetMapping("/{bookId}")
public ResponseEntity<BookResponse> findById(
        @PathVariable long bookId) {
    return ResponseEntity.ok(bookService.findById(bookId));
}
```

반드시 모든 메서드를 `ResponseEntity`로 감쌀 필요는 없다.

```java
@GetMapping
public List<BookSummaryResponse> findAll() {
    return bookService.findAll();
}
```

기본 200 응답이면 객체를 직접 반환해도 의도가 충분히 분명하다. 동적인 상태·Header가 필요할 때 `ResponseEntity`가 특히 유용하다.

### 14.3 URI를 문자열로 이어 붙일 때 주의

애플리케이션의 context path, Proxy, 인코딩을 고려해야 하는 환경에서는 Spring의 URI 구성 도구를 사용할 수 있다.

```java
URI location = ServletUriComponentsBuilder
        .fromCurrentRequest()
        .path("/{id}")
        .buildAndExpand(response.id())
        .toUri();
```

환경과 신뢰할 수 있는 Forwarded Header 설정까지 고려해야 하므로 팀의 배포 구조에 맞춰 선택한다.

## 15. CRUD API를 하나의 표로 설계하기

코드를 쓰기 전에 표로 계약을 정하면 누락과 불일치를 발견하기 쉽다.

| 작업 | 메서드·URI | 요청 Body | 성공 상태 | 응답 Body |
| --- | --- | --- | --- | --- |
| 책 생성 | `POST /api/books` | `CreateBookRequest` | 201 | `BookResponse` |
| 목록 조회 | `GET /api/books` | 없음 | 200 | `List<BookSummaryResponse>` |
| 단건 조회 | `GET /api/books/{id}` | 없음 | 200 | `BookResponse` |
| 전체 수정 | `PUT /api/books/{id}` | `ReplaceBookRequest` | 200 또는 204 | 정책에 따라 결정 |
| 일부 수정 | `PATCH /api/books/{id}` | `PatchBookRequest` | 200 또는 204 | 정책에 따라 결정 |
| 삭제 | `DELETE /api/books/{id}` | 없음 | 204 | 없음 |

상태 코드가 하나의 절대 정답으로 고정되는 경우만 있는 것은 아니다. 팀 API 규칙을 정하고 같은 상황에 일관되게 적용한다.

## 16. 전체 예제: 책 API 계약 구현하기

### 16.1 패키지 구조

```text
com.example.reading.book
├─ BookController.java
├─ BookService.java
├─ Book.java
└─ dto
   ├─ CreateBookRequest.java
   ├─ ReplaceBookRequest.java
   ├─ BookResponse.java
   └─ BookSummaryResponse.java
```

프로젝트 규모가 커지면 계층형 패키지보다 기능 단위 패키지가 관련 코드를 함께 찾기 쉬운 경우가 많다. 팀 규칙과 모듈 경계를 우선한다.

### 16.2 내부 모델

```java
package com.example.reading.book;

import java.time.Instant;

public class Book {
    private final long id;
    private String title;
    private String author;
    private final Instant createdAt;

    public Book(long id, String title, String author, Instant createdAt) {
        this.id = id;
        this.title = title;
        this.author = author;
        this.createdAt = createdAt;
    }

    public void update(String title, String author) {
        this.title = title;
        this.author = author;
    }

    public long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
```

이 모델은 HTTP 애너테이션을 모른다. 핵심 상태와 행위에 집중한다.

### 16.3 DTO

```java
package com.example.reading.book.dto;

public record CreateBookRequest(
        String title,
        String author
) {
}
```

```java
package com.example.reading.book.dto;

public record ReplaceBookRequest(
        String title,
        String author
) {
}
```

```java
package com.example.reading.book.dto;

public record BookSummaryResponse(
        long id,
        String title
) {
}
```

```java
package com.example.reading.book.dto;

import java.time.Instant;

import com.example.reading.book.Book;

public record BookResponse(
        long id,
        String title,
        String author,
        Instant createdAt
) {
    public static BookResponse from(Book book) {
        return new BookResponse(
                book.getId(),
                book.getTitle(),
                book.getAuthor(),
                book.getCreatedAt()
        );
    }
}
```

### 16.4 Service

```java
package com.example.reading.book;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.example.reading.book.dto.BookResponse;
import com.example.reading.book.dto.BookSummaryResponse;
import com.example.reading.book.dto.CreateBookRequest;
import com.example.reading.book.dto.ReplaceBookRequest;

@Service
public class BookService {
    private final Map<Long, Book> books = new LinkedHashMap<>();
    private long sequence = 0L;

    public BookResponse create(CreateBookRequest request) {
        long id = ++sequence;
        Book book = new Book(
                id,
                request.title(),
                request.author(),
                Instant.now()
        );
        books.put(id, book);
        return BookResponse.from(book);
    }

    public List<BookSummaryResponse> findAll() {
        return books.values().stream()
                .map(book -> new BookSummaryResponse(
                        book.getId(),
                        book.getTitle()
                ))
                .toList();
    }

    public BookResponse findById(long id) {
        return BookResponse.from(getBook(id));
    }

    public BookResponse replace(long id, ReplaceBookRequest request) {
        Book book = getBook(id);
        book.update(request.title(), request.author());
        return BookResponse.from(book);
    }

    public void delete(long id) {
        if (books.remove(id) == null) {
            throw new IllegalArgumentException("존재하지 않는 책입니다. id=" + id);
        }
    }

    private Book getBook(long id) {
        Book book = books.get(id);
        if (book == null) {
            throw new IllegalArgumentException("존재하지 않는 책입니다. id=" + id);
        }
        return book;
    }
}
```

메모리 `Map`과 sequence는 흐름 설명용이다. singleton Bean의 변경 가능한 상태는 동시 요청에서 안전하지 않으므로 실제 저장소로 사용하지 않는다.

### 16.5 Controller

```java
package com.example.reading.book;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.reading.book.dto.BookResponse;
import com.example.reading.book.dto.BookSummaryResponse;
import com.example.reading.book.dto.CreateBookRequest;
import com.example.reading.book.dto.ReplaceBookRequest;

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
    public List<BookSummaryResponse> findAll() {
        return bookService.findAll();
    }

    @GetMapping("/{bookId}")
    public BookResponse findById(@PathVariable long bookId) {
        return bookService.findById(bookId);
    }

    @PutMapping("/{bookId}")
    public BookResponse replace(
            @PathVariable long bookId,
            @RequestBody ReplaceBookRequest request) {
        return bookService.replace(bookId, request);
    }

    @DeleteMapping("/{bookId}")
    public ResponseEntity<Void> delete(@PathVariable long bookId) {
        bookService.delete(bookId);
        return ResponseEntity.noContent().build();
    }
}
```

예외를 지금 그대로 두면 존재하지 않는 책이 500으로 표현될 수 있다. 다음 노트에서 도메인 예외를 정의하고 404 오류 DTO로 변환한다.

## 17. PUT과 PATCH를 구분하기

### 17.1 PUT: 전체 표현 교체 관점

```json
{
  "title": "New Title",
  "author": "New Author"
}
```

PUT을 전체 교체로 설계했다면 필요한 필드를 모두 보내도록 계약한다. 빠진 필드는 기존 값을 유지하는 것이 아니라 기본값이나 누락으로 처리될 수 있다는 정책이 명확해야 한다.

### 17.2 PATCH: 일부 변경 관점

```json
{
  "title": "Only New Title"
}
```

PATCH DTO는 다음 문제를 반드시 결정해야 한다.

```text
필드가 JSON에 없음
  → 변경하지 않음?

필드가 JSON에 있고 값이 null
  → 값을 null로 변경?
  → 잘못된 입력?
```

단순한 nullable Java 필드만으로는 “누락”과 “명시적 null”을 구분하기 어려울 수 있다. JSON Merge Patch, JSON Patch, 별도 명령 DTO 등 API 요구에 맞는 정책을 선택해야 한다.

`Optional`을 DTO 필드에 넣으면 이 문제가 자동으로 해결된다고 단정하지 않는다. JSON 역직렬화 설정과 팀 규칙을 함께 검토한다.

## 18. 목록 응답과 페이지네이션 계약

작은 데이터에서는 배열만 반환할 수 있다.

```json
[
  { "id": 1, "title": "Spring Start" },
  { "id": 2, "title": "HTTP Guide" }
]
```

페이지 정보가 필요해지면 응답 객체를 설계할 수 있다.

```java
public record BookPageResponse(
        List<BookSummaryResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
```

```json
{
  "items": [
    { "id": 1, "title": "Spring Start" }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

처음 배열로 공개한 API를 나중에 객체로 바꾸면 계약 변경이다. 페이지네이션 가능성이 명확하다면 초기 응답 형태를 신중히 정한다.

## 19. JSON 계약에서 자주 놓치는 타입

### 19.1 날짜와 시간

날짜 문자열에는 시간대 의미가 필요하다.

```json
{
  "createdAt": "2026-08-29T10:30:00Z"
}
```

`Instant`는 UTC 시점 표현에 적합하다. 사용자의 지역 날짜, 예약 시간처럼 도메인 의미가 다르면 `LocalDate`, `OffsetDateTime`, Zone ID 등을 목적에 맞게 선택한다.

### 19.2 큰 숫자와 ID

JavaScript 클라이언트는 안전하게 표현할 수 있는 정수 범위가 제한된다. 매우 큰 `long` ID를 외부로 노출한다면 문자열 ID 또는 UUID 사용 여부를 API 전체 관점에서 검토한다.

### 19.3 금액

부동소수점 오차가 문제인 금액에는 `double`보다 `BigDecimal`과 통화 단위를 고려한다.

```json
{
  "amount": "12000.50",
  "currency": "KRW"
}
```

숫자와 문자열 중 어떤 JSON 타입을 사용할지는 클라이언트 계약과 직렬화 정책을 명시한다.

### 19.4 Enum

```json
{
  "status": "READING"
}
```

Enum 이름은 외부 계약이 되기 쉽다. Java 상수 이름을 바꾸는 리팩터링이 클라이언트를 깨뜨릴 수 있으므로 공개 값과 내부 이름의 결합을 의식한다.

### 19.5 null과 필드 누락

```json
{ "description": null }
```

```json
{}
```

둘이 같은 의미인지 다른 의미인지 API별로 정한다. 특히 PATCH, 검색 조건, 부분 응답에서 중요하다.

## 20. Controller의 책임 경계

Controller는 HTTP와 애플리케이션 사이의 어댑터다.

```text
Controller가 주로 맡는 것
├─ Path·Query·Header·Body 입력 받기
├─ 요청 DTO를 애플리케이션 입력으로 전달
├─ 결과를 응답 DTO로 표현
└─ 상태 코드·Header 결정

Service가 주로 맡는 것
├─ 사용 사례 순서 조정
├─ 비즈니스 규칙 적용
├─ 트랜잭션 경계
└─ Repository 등 협력 객체 사용
```

### 20.1 두꺼운 Controller의 신호

```java
@PostMapping
public BookResponse create(@RequestBody CreateBookRequest request) {
    if (/* 복잡한 규칙 A */) {
        // ...
    }
    if (/* 복잡한 규칙 B */) {
        // ...
    }
    // 저장소 직접 접근과 여러 도메인 처리
}
```

HTTP와 무관한 규칙이 Controller에 쌓이면 다른 진입점이나 테스트에서 재사용하기 어렵다. Controller는 얇게 유지하되 단순 DTO 변환까지 기계적으로 모두 별도 계층에 옮길 필요는 없다.

## 21. API 버전과 호환성

공개된 API는 클라이언트가 사용하기 시작하면 마음대로 바꾸기 어렵다.

### 21.1 비교적 호환적인 변경

- 선택적 응답 필드 추가: 클라이언트가 알 수 없는 필드를 무시한다는 전제가 필요
- 새로운 별도 endpoint 추가
- 기존 의미를 유지하는 성능 개선

### 21.2 깨질 가능성이 큰 변경

- 필드 삭제·이름 변경·타입 변경
- 필수 요청 필드 추가
- 상태 코드 의미 변경
- 배열과 객체 구조 변경
- Enum 공개 값 변경

### 21.3 버전 전략

```text
URI 버전       /api/v1/books
Header 버전    API-Version: 1
Media Type     application/vnd.example.v1+json
```

Spring Framework의 최신 MVC에는 설정된 버전 전략과 `@RequestMapping`의 `version` 속성을 활용하는 기능도 있다. 그러나 표준화된 유일한 버전 위치는 없으며, 버전 추가보다 먼저 호환 가능한 진화를 설계하는 것이 중요하다. 프로젝트가 사용하는 Spring 버전의 지원 여부도 확인한다.

## 22. API 요청을 직접 검증하기

### 22.1 생성

```powershell
curl.exe -i -X POST "http://localhost:8080/api/books" `
  -H "Content-Type: application/json" `
  -H "Accept: application/json" `
  -d '{"title":"Spring Start","author":"Kim"}'
```

확인할 계약은 다음과 같다.

- 상태가 201인가?
- `Location`이 생성된 자원을 가리키는가?
- JSON 필드명과 타입이 문서와 같은가?
- 내부 필드가 뜻하지 않게 노출되지 않았는가?

### 22.2 조회

```powershell
curl.exe -i "http://localhost:8080/api/books/1" `
  -H "Accept: application/json"
```

### 22.3 수정

```powershell
curl.exe -i -X PUT "http://localhost:8080/api/books/1" `
  -H "Content-Type: application/json" `
  -d '{"title":"Updated Spring","author":"Lee"}'
```

### 22.4 삭제

```powershell
curl.exe -i -X DELETE "http://localhost:8080/api/books/1"
```

Body만 보지 말고 상태·Header·Body 전체가 계약과 맞는지 확인한다.

## 23. 자주 하는 실수와 진단 기준

### 23.1 Entity를 요청과 응답에 모두 사용

증상은 내부 필드 노출, 클라이언트의 임의 필드 입력, 연관관계 직렬화, 내부 변경의 API 전파다. 사용 사례별 DTO로 경계를 분리한다.

### 23.2 모든 성공을 200으로 반환

코드는 작동하지만 생성·본문 없음·비동기 접수의 의미가 사라진다. 201, 204, 202 등 실제 결과 의미를 검토한다.

### 23.3 모든 실패를 500으로 반환

잘못된 입력, 없는 자원, 상태 충돌은 서버 프로그램 자체의 알 수 없는 실패와 다르다. 예외를 분류하고 일관된 오류 응답으로 바꾸는 단계가 필요하다.

### 23.4 모든 Controller에 `ResponseEntity<?>` 사용

와일드카드는 실제 Body 타입을 읽기 어렵게 한다. 가능한 구체적인 타입을 사용한다.

```java
ResponseEntity<BookResponse>
ResponseEntity<Void>
```

### 23.5 DTO마다 무조건 setter 추가

역직렬화 방식과 프레임워크 버전을 확인하지 않고 setter를 자동으로 추가하지 않는다. 생성 시 완성되는 DTO는 record나 생성자 기반 불변 객체로 표현할 수 있다.

### 23.6 `null`의 의미를 정하지 않음

생성, 전체 수정, 부분 수정에서 `null`과 누락의 의미가 다를 수 있다. DTO 타입만 만들지 말고 JSON 계약을 함께 문서화한다.

### 23.7 API 경로에 내부 구현 노출

```text
/api/selectBookTable
/api/bookEntity/save
```

URI는 SQL이나 클래스 이름보다 클라이언트가 이해하는 자원을 표현한다.

## 24. 설계 체크리스트

### 자원과 URI

- [ ] URI가 동작보다 자원을 표현하는가?
- [ ] 컬렉션과 단건 URI 규칙이 일관적인가?
- [ ] 과도한 중첩을 피했는가?
- [ ] 데이터베이스·클래스 구현명을 노출하지 않았는가?

### 요청

- [ ] HTTP 메서드의 의미가 작업과 맞는가?
- [ ] Path·Query·Header·Body의 역할을 구분했는가?
- [ ] 사용 사례별 요청 DTO가 있는가?
- [ ] 클라이언트가 수정하면 안 되는 필드를 입력에서 제외했는가?
- [ ] 누락과 `null`의 의미를 정했는가?

### 응답

- [ ] Entity가 아닌 응답 DTO로 필요한 필드만 보냈는가?
- [ ] 결과에 맞는 상태 코드를 정했는가?
- [ ] 201이면 생성 자원의 위치를 알릴지 검토했는가?
- [ ] 204 응답에 Body를 넣지 않았는가?
- [ ] 날짜·금액·ID·Enum의 외부 표현을 정했는가?

### 변경 가능성

- [ ] 내부 모델 변경이 API 계약에 바로 전파되지 않는가?
- [ ] 목록에 페이지네이션이 필요할 가능성을 검토했는가?
- [ ] 깨지는 변경과 호환 가능한 변경을 구분했는가?
- [ ] 팀 전체 endpoint의 상태 코드 규칙이 일관적인가?

## 25. 배운 점과 다음 학습 연결

### 25.1 이번 노트에서 이해한 것

- URI는 자원을, HTTP 메서드는 작업의 의미를 표현한다.
- 안전성과 멱등성은 재시도와 동작 예측에 중요한 HTTP 속성이다.
- DTO는 외부 JSON 계약을 내부 모델과 분리한다.
- 요청 DTO와 응답 DTO는 방향과 변경 이유가 다르다.
- 상태 코드·Header·Body를 함께 설계해야 완전한 응답 계약이 된다.
- PUT과 PATCH는 수정 범위와 누락·`null` 정책이 다르다.

### 25.2 이전 노트와의 연결

이전 노트는 요청이 Spring MVC 구성 요소를 거쳐 Controller에 도착하고 객체가 JSON으로 변환되는 **실행 흐름**을 다뤘다. 이번 노트는 그 흐름 위에 어떤 경로·DTO·상태 코드를 올릴지 결정하는 **외부 계약 설계**를 다뤘다.

### 25.3 다음 학습

다음에는 Validation과 예외 처리를 학습한다.

- `@Valid`와 Bean Validation의 역할
- 형식 검증과 비즈니스 규칙 검증의 경계
- 필드 오류를 클라이언트가 사용할 수 있는 구조로 변환하기
- 도메인 예외와 HTTP 상태 코드 연결하기
- `@RestControllerAdvice`로 일관된 오류 응답 만들기

## 26. 요약 정리

1. API는 메서드·URI·Header·Body·상태 코드로 이루어진 외부 계약이다.
2. URI는 자원을 중심으로, 작업은 HTTP 메서드로 표현한다.
3. GET은 안전하고, PUT과 DELETE는 멱등한 의미를 가진다.
4. 요청 DTO는 클라이언트가 보낼 수 있는 값을 제한하고 사용 사례를 표현한다.
5. 응답 DTO는 클라이언트에 공개할 값만 선택해 내부 모델을 보호한다.
6. Entity를 직접 노출하면 보안·직렬화·변경 결합 문제가 생길 수 있다.
7. `@RequestBody`와 응답 본문은 메시지 변환기를 통해 JSON과 Java 객체 사이에서 변환된다.
8. 생성은 201과 `Location`, 본문 없는 성공은 204 등 결과에 맞는 상태를 검토한다.
9. PUT과 PATCH는 전체 교체와 일부 변경의 계약을 분명히 구분한다.
10. DTO 분리의 목적은 클래스 수 증가가 아니라 변경 영향과 공개 범위를 통제하는 것이다.

## 27. 미니 퀴즈

1. `/api/createBook`보다 `POST /api/books`가 HTTP 의미를 더 잘 활용하는 이유는 무엇인가?
2. 안전한 메서드와 멱등한 메서드는 어떻게 다른가?
3. DELETE의 첫 응답과 두 번째 응답 상태가 달라도 멱등할 수 있는 이유는 무엇인가?
4. 요청 DTO와 응답 DTO를 하나로 합쳤을 때 어떤 문제가 생길 수 있는가?
5. Entity를 응답으로 직접 반환하면 내부 변경이 왜 API 변경이 되는가?
6. 201과 함께 `Location` Header를 보내는 목적은 무엇인가?
7. 204 응답에 JSON Body를 넣지 않아야 하는 이유는 무엇인가?
8. PATCH에서 누락된 필드와 명시적인 `null`은 왜 구분해야 하는가?
9. DTO 변환을 Controller, DTO 정적 메서드, 별도 Mapper 중 어디에 둘지 어떤 기준으로 결정하는가?
10. 역직렬화에 성공한 요청이 비즈니스 규칙상 유효하지 않을 수 있는 예를 설명할 수 있는가?

## 참고 자료

- [Spring Framework Reference - Mapping Requests](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html)
- [Spring Framework Reference - @RequestBody](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/requestbody.html)
- [Spring Framework Reference - @ResponseBody](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/responsebody.html)
- [Spring Framework Reference - Controller Method Return Values](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/return-types.html)
- [RFC 9110 - HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)

> 정리 기준일: 2026-08-29
