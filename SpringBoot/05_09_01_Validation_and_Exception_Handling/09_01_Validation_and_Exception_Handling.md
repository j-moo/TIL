# Spring Boot Validation과 예외 처리 이해하기

- 🎯 글의 목표: 요청 형식 오류, DTO 제약 위반, 비즈니스 규칙 위반, 자원 부재, 서버 오류를 구분하고 `@Valid`와 `@RestControllerAdvice`를 이용해 일관된 오류 응답으로 변환한다.
- 🧩 핵심 키워드: Bean Validation, Constraint, `@Valid`, `@Validated`, `BindingResult`, `MethodArgumentNotValidException`, `HandlerMethodValidationException`, `@ExceptionHandler`, `@RestControllerAdvice`, `ProblemDetail`, RFC 9457
- ⭐ 중요도: ★★★★★ — 정상 응답만 설계한 API는 절반만 완성된 API다. 실패 원인을 안정적인 상태 코드와 구조로 알려야 클라이언트가 복구할 수 있고 서버도 장애를 진단할 수 있다.
- 📝 한눈에 보는 내용: JSON 역직렬화가 끝난 DTO에는 선언적 제약을 검사하고, 상태나 데이터 조회가 필요한 규칙은 Service에서 검사한다. 발생한 예외는 중앙 Advice에서 HTTP 상태와 안전한 오류 본문으로 변환하며, 예상하지 못한 오류는 내부 정보를 숨긴 채 500으로 처리하고 서버 로그에 원인을 남긴다.
- 🔗 관련 주제: REST API·DTO, HTTP 상태 코드, Spring MVC 예외 해석, 메시지 국제화, 로깅, 테스트, Spring Security
- 🧱 선수 지식: `@RequestBody`, 요청·응답 DTO, `ResponseEntity`, HTTP 4xx·5xx, Java 예외와 record

---

## 1. 들어가며

이전 노트에서 다음 생성 API 계약을 만들었다.

```java
@PostMapping
public ResponseEntity<BookResponse> create(
        @RequestBody CreateBookRequest request) {
    BookResponse response = bookService.create(request);
    return ResponseEntity.created(URI.create("/api/books/" + response.id()))
            .body(response);
}
```

하지만 다음 요청이 들어오면 어떻게 해야 할까?

```json
{
  "title": "",
  "author": null,
  "price": -1000
}
```

또 다음 상황은 모두 같은 400일까?

- JSON 문법 자체가 잘못되었다.
- 필수 제목이 비어 있다.
- URL의 ID를 숫자로 바꿀 수 없다.
- 같은 ISBN의 책이 이미 존재한다.
- 요청한 책 ID가 존재하지 않는다.
- 데이터베이스 연결이 갑자기 끊겼다.

각 실패의 원인과 책임이 다르다. 이를 전부 `IllegalArgumentException`과 500으로 처리하면 클라이언트는 요청을 고쳐야 하는지, 다시 시도해야 하는지, 사용자에게 무엇을 보여 줘야 하는지 알 수 없다.

이번 노트의 전체 흐름은 다음과 같다.

```text
HTTP 요청
  → JSON 파싱·타입 변환
  → DTO 제약 검증
  → Controller
  → 비즈니스 규칙 검증
  → 정상 결과 또는 예외
  → ExceptionHandler
  → 상태 코드 + 안전하고 일관된 오류 본문
```

> 이 문서는 2026년 9월 1일의 Spring Boot 4.1·Spring Framework 7.0·Jakarta Validation 3.1 공식 문서를 확인해 작성했다. Spring MVC의 검증 예외 종류와 메서드 검증 동작은 버전에 따라 차이가 있으므로 프로젝트 버전 문서를 우선한다.

## 2. 검증과 예외 처리는 서로 다른 책임이다

두 개념은 함께 사용하지만 같은 것은 아니다.

| 구분 | 질문 | 대표 도구 |
| --- | --- | --- |
| 검증 | 입력이나 객체가 정해진 규칙을 만족하는가? | Bean Validation, Service 규칙 검사 |
| 예외 | 정상 흐름을 계속할 수 없는 상황을 어떻게 표현하는가? | 사용자 정의 Exception |
| 예외 처리 | 예외를 어떤 HTTP 응답으로 바꿀 것인가? | `@ExceptionHandler`, `@RestControllerAdvice` |

```text
@NotBlank 위반
  → 검증 실패
  → MethodArgumentNotValidException 발생 가능
  → Advice가 400 오류 응답으로 변환
```

검증 규칙을 잘 선언해도 오류 응답을 설계하지 않으면 기본 형식이 클라이언트 기대와 다를 수 있다. 반대로 모든 값을 `if`와 예외로만 검사하면 반복 코드가 늘고 필드 오류 정보를 체계적으로 모으기 어렵다.

## 3. 실패를 계층별로 분류하기

오류가 발생한 위치를 알면 상태 코드와 처리 전략을 정하기 쉽다.

```text
1. HTTP·JSON 형식 계층
   └─ JSON 문법, 타입 변환, 필수 Header

2. 요청 DTO 제약 계층
   └─ 빈 문자열, 길이, 숫자 범위, 형식

3. 비즈니스 규칙 계층
   └─ 중복 ISBN, 대여 불가능 상태, 허용 수량 초과

4. 자원 계층
   └─ 존재하지 않는 책 ID

5. 시스템 계층
   └─ DB 장애, 코드 버그, 외부 서비스 장애
```

| 실패 예 | 일반적으로 검토할 상태 | 클라이언트 행동 |
| --- | --- | --- |
| 깨진 JSON | 400 Bad Request | 요청 본문 수정 |
| DTO 제약 위반 | 400 Bad Request | 표시된 필드 수정 |
| 없는 자원 | 404 Not Found | ID·화면 상태 확인 |
| 현재 상태와 충돌 | 409 Conflict | 최신 상태 확인 후 재시도 |
| 인증 정보 없음 | 401 Unauthorized | 인증 수행 |
| 권한 부족 | 403 Forbidden | 권한 요청 또는 작업 중단 |
| 예상하지 못한 서버 실패 | 500 Internal Server Error | 잠시 후 재시도·문의 |

상태 코드는 비즈니스 문맥과 팀 규칙에 따라 최종 결정한다. 핵심은 같은 의미의 실패를 endpoint마다 다르게 표현하지 않는 것이다.

## 4. Bean Validation은 무엇인가

Jakarta Bean Validation은 Java 객체의 제약을 애너테이션과 메타데이터로 선언하고 런타임 Validator가 검사하는 표준 API다.

```java
public record CreateBookRequest(
        @NotBlank String title,
        @NotBlank String author,
        @PositiveOrZero int price
) {
}
```

각 애너테이션은 다음 계약을 선언한다.

```text
title  → null, 빈 문자열, 공백만 있는 문자열을 허용하지 않음
author → null, 빈 문자열, 공백만 있는 문자열을 허용하지 않음
price  → 0 이상
```

중요한 구분은 다음과 같다.

```text
Bean Validation API
  → 제약 선언과 검증 방식의 표준

Validation Provider
  → 표준을 실제로 실행하는 구현체
  → Spring Boot에서는 일반적으로 Hibernate Validator 사용
```

## 5. 의존성 준비하기

Spring Boot 4.1 공식 문서는 Validation 구현을 보통 `spring-boot-starter-validation`으로 제공한다고 안내한다.

### 5.1 Gradle

```groovy
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-validation'
}
```

Kotlin DSL이면 다음과 같이 작성한다.

```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-validation")
}
```

### 5.2 Maven

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

Spring Boot의 dependency management를 사용한다면 임의로 하위 라이브러리 버전을 따로 고정하지 않는다. 프로젝트가 사용하는 Boot 버전과 Initializr가 생성한 구성을 기준으로 한다.

### 5.3 import는 `jakarta.validation`

현재 Spring Boot 3 이상 계열 예제는 Jakarta namespace를 사용한다.

```java
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
```

오래된 예제의 `javax.validation.*`을 그대로 복사하면 현재 프로젝트에서 import 오류가 날 수 있다.

## 6. 자주 쓰는 제약 애너테이션

| 애너테이션 | 검사 의미 | 주로 사용하는 타입 |
| --- | --- | --- |
| `@NotNull` | `null` 금지 | 모든 참조 타입 |
| `@NotEmpty` | `null` 또는 길이·크기 0 금지 | 문자열, 컬렉션, 배열, Map |
| `@NotBlank` | `null`, 빈 문자열, 공백 문자열 금지 | 문자열 |
| `@Size(min, max)` | 길이·크기 범위 | 문자열, 컬렉션, 배열, Map |
| `@Min`, `@Max` | 정수 최솟값·최댓값 | 숫자 타입 |
| `@Positive` | 0보다 큼 | 숫자 타입 |
| `@PositiveOrZero` | 0 이상 | 숫자 타입 |
| `@Negative`, `@NegativeOrZero` | 음수 범위 | 숫자 타입 |
| `@DecimalMin`, `@DecimalMax` | 소수 포함 숫자 범위 | 숫자·숫자 문자열 |
| `@Email` | 이메일 형식 | 문자열 |
| `@Pattern` | 정규식 일치 | 문자열 |
| `@Past`, `@PastOrPresent` | 과거 시각 범위 | 날짜·시간 타입 |
| `@Future`, `@FutureOrPresent` | 미래 시각 범위 | 날짜·시간 타입 |

### 6.1 `@NotNull`, `@NotEmpty`, `@NotBlank`

```text
값             @NotNull   @NotEmpty   @NotBlank
null              X           X           X
""                O           X           X
"   "             O           O           X
"Spring"          O           O           O
```

사용자 입력 문자열에는 `@NotBlank`가 의도와 맞는 경우가 많다.

### 6.2 제약 하나가 모든 것을 검사하지는 않는다

많은 제약은 `null`을 별도로 유효한 값으로 취급한다. 예를 들어 선택적 문자열이 값이 있을 때만 길이 제한을 받아야 한다면 `@Size(max = 200)`만 둘 수 있다. 반드시 값이 있어야 한다면 `@NotNull` 또는 `@NotBlank`를 함께 사용한다.

```java
public record UpdateBookDescriptionRequest(
        @Size(max = 200) String description
) {
}
```

제약의 `null` 처리 방식은 Jakarta Validation 명세와 해당 제약의 문서를 확인한다.

### 6.3 primitive와 null

```java
public record CreateBookRequest(int price) {
}
```

primitive `int`는 `null`을 담을 수 없다. JSON 필드 누락과 명시적인 0이 모두 0으로 보일 가능성을 검토해야 한다. “반드시 보내야 하는 숫자”를 표현하려면 wrapper와 `@NotNull`을 사용할 수 있다.

```java
public record CreateBookRequest(
        @NotNull
        @PositiveOrZero
        Integer price
) {
}
```

## 7. DTO에 제약 선언하기

```java
package com.example.reading.book.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record CreateBookRequest(
        @NotBlank(message = "제목은 비어 있을 수 없습니다.")
        @Size(max = 100, message = "제목은 100자 이하여야 합니다.")
        String title,

        @NotBlank(message = "저자는 비어 있을 수 없습니다.")
        @Size(max = 50, message = "저자는 50자 이하여야 합니다.")
        String author,

        @NotNull(message = "가격은 필수입니다.")
        @PositiveOrZero(message = "가격은 0 이상이어야 합니다.")
        Integer price
) {
}
```

### 7.1 메시지는 누구를 위한 것인가

제약 메시지가 곧바로 최종 사용자 문구라고 단정하지 않는다.

- 개발자와 API 소비자가 이해할 수 있는 오류 설명
- 다국어 MessageSource에서 해석할 메시지 코드
- 화면에서 별도 번역할 안정적인 오류 코드

프로젝트 규모와 클라이언트 구조에 맞는 정책을 정한다. 메시지만 계약으로 사용하면 문구 수정이나 번역이 API 호환성 문제로 이어질 수 있으므로 `code`를 별도로 제공하는 방식도 고려한다.

### 7.2 DTO는 형식 규칙에 집중한다

DTO 제약에 적합한 규칙은 보통 객체 하나만 보고 판단할 수 있다.

- 필수 여부
- 문자열 길이
- 숫자 범위
- 형식
- 날짜 범위

데이터베이스 조회나 현재 사용자·자원 상태가 필요한 규칙은 Service의 비즈니스 검사에 더 가깝다.

## 8. `@Valid`가 검증을 시작한다

DTO에 제약을 붙이는 것만으로 Controller 입력이 항상 자동 검증되는 것은 아니다. 검증을 적용할 매개변수에 `@Valid` 또는 필요한 경우 `@Validated`를 붙인다.

```java
import jakarta.validation.Valid;

@PostMapping
public ResponseEntity<BookResponse> create(
        @Valid @RequestBody CreateBookRequest request) {
    BookResponse response = bookService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
}
```

흐름은 다음과 같다.

```text
JSON 본문
  → CreateBookRequest 역직렬화
  → @Valid가 중첩된 제약 검사 지시
  → 성공: Controller 호출
  → 실패: Controller를 호출하지 않고 검증 예외 발생
```

Spring MVC 공식 문서에 따르면 개별 `@RequestBody` 객체 검증 실패에서는 보통 `MethodArgumentNotValidException`이 발생한다. 메서드 매개변수에 직접 제약이 선언된 경우에는 `HandlerMethodValidationException`이 발생할 수 있다.

## 9. `@Valid`와 `@Validated` 차이

### 9.1 `@Valid`

`@Valid`는 Jakarta Validation 표준 애너테이션이다. 그 자체가 `@NotBlank` 같은 제약 조건은 아니며, 대상 객체와 중첩 객체의 제약을 따라가 검증하도록 표시한다.

```java
@Valid @RequestBody CreateBookRequest request
```

### 9.2 `@Validated`

`@Validated`는 Spring 애너테이션이며 Validation Group 지정과 Spring의 메서드 검증 활성화에 사용될 수 있다.

```java
@Service
@Validated
public class BookQueryService {

    public BookResponse findByIsbn(
            @Size(min = 10, max = 13) String isbn) {
        // ...
    }
}
```

Spring Boot는 Validation 구현체가 클래스패스에 있으면 메서드 검증을 지원하며, 일반 Spring Bean의 메서드 제약을 검사하려면 대상 클래스에 `@Validated`가 필요하다.

### 9.3 Controller의 `@Validated`는 버전을 확인한다

Spring Framework 6.1 이후 Spring MVC에는 Handler Method Validation이 내장되었다. 현재 공식 문서는 이 내장 지원을 사용하려면 Controller 클래스 수준의 `@Validated`를 제거하라고 안내한다. 클래스 수준 `@Validated`가 있으면 AOP 기반 메서드 검증 경로가 적용될 수 있다.

검색한 예제를 무조건 섞지 말고 다음을 확인한다.

- 사용하는 Spring Framework 버전
- DTO 객체 검증인지 메서드 Parameter 직접 검증인지
- Controller인지 Service Bean인지
- 발생하는 예외 타입이 무엇인지

## 10. 중첩 객체와 컬렉션 검증

### 10.1 중첩 DTO에는 `@Valid`

```java
public record PublisherRequest(
        @NotBlank String name,
        @Email String contactEmail
) {
}

public record CreateBookRequest(
        @NotBlank String title,

        @NotNull
        @Valid
        PublisherRequest publisher
) {
}
```

바깥 DTO의 `publisher`에 `@Valid`가 없으면 내부 `name`, `contactEmail` 제약이 기대대로 검사되지 않을 수 있다.

### 10.2 컬렉션 자체와 원소를 구분한다

```java
public record CreateReadingListRequest(
        @NotEmpty(message = "책은 한 권 이상 필요합니다.")
        @Size(max = 20, message = "책은 최대 20권까지 등록할 수 있습니다.")
        List<@NotNull @Positive Long> bookIds
) {
}
```

```text
@NotEmpty, @Size
  → List 자체의 크기 검사

List<@NotNull @Positive Long>
  → 각 원소 검사
```

중첩 DTO 목록이면 원소에 `@Valid`를 적용한다.

```java
List<@Valid BookItemRequest> items
```

## 11. Path Variable과 Query Parameter 검증

DTO뿐 아니라 Controller 메서드 매개변수에도 제약을 선언할 수 있다.

```java
@GetMapping
public List<BookSummaryResponse> findAll(
        @Min(value = 0, message = "page는 0 이상이어야 합니다.")
        @RequestParam(defaultValue = "0") int page,

        @Min(value = 1, message = "size는 1 이상이어야 합니다.")
        @Max(value = 100, message = "size는 100 이하여야 합니다.")
        @RequestParam(defaultValue = "20") int size) {
    return bookService.findAll(page, size);
}
```

```java
@GetMapping("/{bookId}")
public BookResponse findById(
        @Positive(message = "bookId는 양수여야 합니다.")
        @PathVariable long bookId) {
    return bookService.findById(bookId);
}
```

현재 Spring MVC에서는 이러한 직접 제약이 메서드 검증을 유발하고 `HandlerMethodValidationException`으로 이어질 수 있다. DTO 검증 예외 하나만 처리하면 모든 입력 오류를 잡는다고 가정하지 않는다.

## 12. `BindingResult`로 Controller에서 직접 다루기

검증 대상 바로 다음에 `BindingResult`를 선언하면 Controller 안에서 오류를 확인할 수 있다.

```java
@PostMapping
public ResponseEntity<?> create(
        @Valid @RequestBody CreateBookRequest request,
        BindingResult bindingResult) {

    if (bindingResult.hasErrors()) {
        // 이 Controller가 직접 오류 응답을 구성한다.
        return ResponseEntity.badRequest().body(bindingResult.getAllErrors());
    }

    return ResponseEntity.ok(bookService.create(request));
}
```

### 12.1 장점

- 특정 endpoint만의 특별한 분기 처리가 가능하다.
- 같은 화면을 다시 렌더링하는 MVC Form 처리에서 유용할 수 있다.

### 12.2 REST API에서의 단점

- Controller마다 오류 변환 코드가 반복된다.
- endpoint별 응답 형식이 달라지기 쉽다.
- 정상 흐름과 오류 변환 책임이 섞인다.
- `ResponseEntity<?>`가 늘어 실제 반환 타입을 읽기 어려워질 수 있다.

일관된 REST 오류 계약이 목표라면 예외를 중앙 Advice에서 처리하는 방식이 관리하기 쉽다. `BindingResult`가 무조건 나쁜 것이 아니라 사용 목적이 다르다.

## 13. 형식 검증과 비즈니스 규칙 검증

### 13.1 형식·구조 규칙

객체 하나만 보고 판단할 수 있고 여러 endpoint에서 동일한 의미라면 Bean Validation에 잘 맞는다.

```java
@NotBlank
@Size(max = 100)
String title
```

### 13.2 비즈니스 규칙

현재 상태나 저장된 데이터가 필요한 규칙은 Service에서 검사한다.

```java
@Service
public class BookService {
    private final BookRepository bookRepository;

    public BookService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    public BookResponse create(CreateBookRequest request) {
        if (bookRepository.existsByIsbn(request.isbn())) {
            throw new DuplicateIsbnException(request.isbn());
        }

        // 생성과 저장
    }
}
```

```text
DTO Constraint
  → ISBN 문자열의 길이와 형식이 맞는가?

Service 규칙
  → 같은 ISBN이 이미 등록되어 있는가?
```

### 13.3 모든 비즈니스 규칙을 ConstraintValidator에 넣지 않는다

사용자 정의 Constraint가 Repository를 조회하도록 만들 수는 있지만 다음 비용을 고려해야 한다.

- 검증 시점에 DB I/O가 숨어 든다.
- 저장 직전 경쟁 상태를 완전히 막지 못한다.
- 동일 Constraint가 어떤 트랜잭션 문맥에서 실행되는지 불명확해질 수 있다.
- Controller 입력 검증과 도메인 규칙의 경계가 흐려진다.

중복값은 Service 검사와 데이터베이스 unique constraint를 함께 사용하고, 마지막 경쟁은 DB 제약으로 보장하는 방식이 필요할 수 있다.

## 14. 객체 여러 필드의 관계 검증

시작일과 종료일처럼 여러 필드를 함께 봐야 하는 규칙이 있다.

```java
public record BorrowBookRequest(
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate
) {
}
```

`endDate >= startDate`는 한 필드 애너테이션만으로 자연스럽게 표현하기 어렵다. 선택지는 다음과 같다.

1. DTO의 class-level 사용자 정의 Constraint
2. DTO 생성자나 정적 팩터리에서 구조 규칙 검사
3. Service에서 사용 사례 규칙 검사

사용자 정의 Constraint는 애너테이션과 Validator 두 부분으로 구성된다.

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidBorrowPeriodValidator.class)
public @interface ValidBorrowPeriod {
    String message() default "종료일은 시작일보다 빠를 수 없습니다.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
```

```java
public class ValidBorrowPeriodValidator
        implements ConstraintValidator<ValidBorrowPeriod, BorrowBookRequest> {

    @Override
    public boolean isValid(
            BorrowBookRequest value,
            ConstraintValidatorContext context) {
        if (value == null
                || value.startDate() == null
                || value.endDate() == null) {
            // null 자체는 각 필드의 @NotNull이 담당한다.
            return true;
        }

        return !value.endDate().isBefore(value.startDate());
    }
}
```

```java
@ValidBorrowPeriod
public record BorrowBookRequest(
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate
) {
}
```

제약 하나가 하나의 의미를 표현하도록 만들고, null 책임을 중복시키지 않는 것이 오류 메시지를 이해하기 쉽다.

## 15. 예외를 의미별 타입으로 만들기

다음 코드는 모든 문제를 하나의 타입으로 표현한다.

```java
throw new IllegalArgumentException("책이 없습니다.");
```

이 타입만 보고는 잘못된 인자인지, 없는 자원인지, 상태 충돌인지 알기 어렵다.

### 15.1 자원 없음

```java
public class BookNotFoundException extends RuntimeException {
    private final long bookId;

    public BookNotFoundException(long bookId) {
        super("책을 찾을 수 없습니다. id=" + bookId);
        this.bookId = bookId;
    }

    public long getBookId() {
        return bookId;
    }
}
```

### 15.2 상태 충돌

```java
public class DuplicateIsbnException extends RuntimeException {
    private final String isbn;

    public DuplicateIsbnException(String isbn) {
        super("이미 등록된 ISBN입니다.");
        this.isbn = isbn;
    }

    public String getIsbn() {
        return isbn;
    }
}
```

예외 이름만 읽어도 실패의 의미를 이해할 수 있다. HTTP 상태를 예외 클래스에 직접 결합할지 Advice에서 매핑할지는 프로젝트 계층 원칙에 따라 결정한다.

## 16. `@ExceptionHandler`

`@ExceptionHandler`는 특정 예외를 처리하는 메서드를 선언한다.

```java
@ExceptionHandler(BookNotFoundException.class)
public ResponseEntity<String> handleBookNotFound(
        BookNotFoundException exception) {
    return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(exception.getMessage());
}
```

Controller 안에 두면 해당 Controller 범위에서 사용할 수 있다. 여러 Controller에 공통 적용하려면 Advice로 분리한다.

```text
Controller 내부 @ExceptionHandler
  → 해당 Controller의 지역 정책

@ControllerAdvice / @RestControllerAdvice
  → 여러 Controller의 공통 정책
```

## 17. `@RestControllerAdvice`로 중앙화하기

`@RestControllerAdvice`는 여러 REST Controller에 적용되는 예외 처리 메서드를 한곳에 모을 수 있다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BookNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleBookNotFound(
            BookNotFoundException exception) {
        // ...
    }
}
```

중앙화의 목적은 단순히 파일 하나로 모으는 것이 아니다.

- 같은 실패에 같은 상태 코드를 적용한다.
- 오류 Body 구조를 일관되게 유지한다.
- 내부 예외 메시지 노출을 통제한다.
- 로깅 정책을 한곳에서 적용한다.
- 클라이언트가 오류 처리를 재사용할 수 있게 한다.

### 17.1 Advice가 비즈니스 결정을 대신하지 않는다

Service는 “책이 없다”는 의미의 예외를 발생시킨다. Advice는 그 예외를 404 HTTP 응답으로 번역한다.

```text
Service
  → 애플리케이션 의미: BookNotFoundException

Advice
  → HTTP 의미: 404 + BOOK_NOT_FOUND 오류 응답
```

## 18. 오류 응답 DTO 직접 설계하기

프로젝트 전용 오류 형식을 만들 수 있다.

```java
public record ApiErrorResponse(
        String code,
        String message,
        int status,
        String path,
        Instant timestamp,
        List<FieldErrorResponse> errors
) {
}

public record FieldErrorResponse(
        String field,
        String code,
        String message,
        Object rejectedValue
) {
}
```

```json
{
  "code": "VALIDATION_FAILED",
  "message": "요청 값이 올바르지 않습니다.",
  "status": 400,
  "path": "/api/books",
  "timestamp": "2026-09-01T10:00:00Z",
  "errors": [
    {
      "field": "title",
      "code": "NotBlank",
      "message": "제목은 비어 있을 수 없습니다.",
      "rejectedValue": ""
    }
  ]
}
```

### 18.1 rejectedValue 노출 주의

비밀번호, 토큰, 개인정보, 긴 본문은 오류 응답과 로그에 그대로 넣지 않는다.

```text
password, accessToken, refreshToken
  → rejectedValue 제외 또는 마스킹
```

필드 오류 응답에 rejected value가 꼭 필요한지 먼저 검토한다. 없어도 클라이언트는 자신이 보낸 값을 이미 알고 있다.

## 19. `ProblemDetail`과 RFC 9457

Spring Framework는 HTTP API 오류 세부 정보 표준인 RFC 9457을 위한 `ProblemDetail`을 지원한다.

표준 필드는 다음과 같다.

| 필드 | 의미 |
| --- | --- |
| `type` | 오류 유형을 식별하는 URI |
| `title` | 오류 유형의 짧고 안정적인 제목 |
| `status` | HTTP 상태 코드 |
| `detail` | 이 발생 건에 대한 설명 |
| `instance` | 오류가 발생한 요청 또는 인스턴스 URI |

```json
{
  "type": "https://example.com/problems/book-not-found",
  "title": "Book Not Found",
  "status": 404,
  "detail": "요청한 책을 찾을 수 없습니다.",
  "instance": "/api/books/99",
  "code": "BOOK_NOT_FOUND"
}
```

Spring의 `ProblemDetail`에는 비표준 속성을 추가할 수 있다.

```java
ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.NOT_FOUND,
        "요청한 책을 찾을 수 없습니다."
);
problem.setTitle("Book Not Found");
problem.setType(URI.create("https://example.com/problems/book-not-found"));
problem.setProperty("code", "BOOK_NOT_FOUND");
```

Spring MVC는 `ProblemDetail`을 반환할 때 상태 정보를 사용하고 JSON 변환 과정에서 `application/problem+json`을 선호하도록 지원한다.

### 19.1 type URI는 실제 정책으로 정한다

예제의 `example.com`을 그대로 복사하지 않는다. 문서 페이지를 실제 운영할지, `about:blank`를 사용할지, 서비스별 안정적인 URI 체계를 만들지 결정한다.

### 19.2 표준 형식과 프로젝트 DTO 중 선택

| 선택 | 장점 | 고려할 점 |
| --- | --- | --- |
| `ProblemDetail` | 표준 필드와 Spring 지원 활용 | 확장 필드 규칙을 정해야 함 |
| 전용 `ApiErrorResponse` | 프로젝트 요구에 정확히 맞춤 | 표준과 프레임워크 지원을 직접 연결해야 함 |

두 방식을 endpoint마다 섞지 말고 팀의 오류 계약을 정한다.

## 20. 검증 오류를 `ProblemDetail`로 변환하기

### 20.1 필드 오류 표현

```java
public record InvalidField(
        String field,
        String code,
        String message
) {
    public static InvalidField from(FieldError error) {
        return new InvalidField(
                error.getField(),
                error.getCode(),
                error.getDefaultMessage()
        );
    }
}
```

### 20.2 DTO 검증 예외 처리

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception) {

        List<InvalidField> errors = exception
                .getBindingResult()
                .getFieldErrors()
                .stream()
                .map(InvalidField::from)
                .toList();

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "요청 필드의 값을 확인해 주세요."
        );
        problem.setTitle("Validation Failed");
        problem.setType(URI.create(
                "https://example.com/problems/validation-failed"
        ));
        problem.setProperty("code", "VALIDATION_FAILED");
        problem.setProperty("errors", errors);

        return problem;
    }
}
```

`FieldError#getCode()`는 `NotBlank`, `Size` 같은 제약 식별에 활용할 수 있지만 클라이언트용 장기 계약으로 그대로 사용할지는 별도 결정한다. 더 안정적인 프로젝트 오류 코드를 매핑할 수도 있다.

### 20.3 객체 수준 오류도 고려한다

class-level Constraint는 특정 필드가 아닌 ObjectError가 될 수 있다. `getFieldErrors()`만 처리하면 객체 수준 오류가 사라진다.

```java
exception.getBindingResult().getGlobalErrors()
```

기간 관계 검증 같은 오류를 어느 필드 또는 전역 오류로 보여 줄지 오류 계약에서 정한다.

## 21. 메서드 검증 오류 처리

Spring MVC의 메서드 검증 실패는 `HandlerMethodValidationException`으로 표현될 수 있다.

```java
@ExceptionHandler(HandlerMethodValidationException.class)
public ProblemDetail handleMethodValidation(
        HandlerMethodValidationException exception) {

    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST,
            "요청 매개변수의 값을 확인해 주세요."
    );
    problem.setTitle("Method Validation Failed");
    problem.setProperty("code", "METHOD_VALIDATION_FAILED");

    // 실제 프로젝트에서는 exception.getParameterValidationResults() 또는
    // visitResults를 이용해 Path·Query·Header별 세부 오류를 안전한 DTO로 변환한다.
    return problem;
}
```

공식 문서는 `HandlerMethodValidationException`이 Parameter별 결과를 제공하며 Visitor API로 `@RequestParam`, `@RequestHeader`, Model Attribute 등을 구분할 수 있다고 설명한다.

버전에 따라 예외 타입과 API가 다를 수 있으므로 다음 두 경우를 실제 테스트로 확인한다.

1. `@Valid @RequestBody` DTO 제약 실패
2. `@Min @RequestParam` 또는 `@Positive @PathVariable` 실패

## 22. 잘못된 JSON과 검증 실패는 다르다

다음 요청은 DTO가 만들어지기 전에 실패한다.

```json
{
  "title": "Spring",
  "price": "not-a-number"
}
```

```text
JSON → Integer 변환 실패
  → CreateBookRequest 생성 실패
  → Bean Validation까지 도달하지 못함
  → HttpMessageNotReadableException 가능
```

```java
@ExceptionHandler(HttpMessageNotReadableException.class)
public ProblemDetail handleUnreadableMessage(
        HttpMessageNotReadableException exception) {

    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST,
            "JSON 문법과 필드 타입을 확인해 주세요."
    );
    problem.setTitle("Malformed Request Body");
    problem.setProperty("code", "MALFORMED_JSON");
    return problem;
}
```

Jackson의 내부 예외 메시지에는 클래스명과 구현 정보가 포함될 수 있으므로 원문을 그대로 클라이언트에 노출하지 않는다. 상세 원인은 서버 로그에서 추적한다.

## 23. 비즈니스 예외를 HTTP로 매핑하기

### 23.1 자원 없음 → 404

```java
@ExceptionHandler(BookNotFoundException.class)
public ProblemDetail handleBookNotFound(
        BookNotFoundException exception) {

    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND,
            "요청한 책을 찾을 수 없습니다."
    );
    problem.setTitle("Book Not Found");
    problem.setProperty("code", "BOOK_NOT_FOUND");
    problem.setProperty("bookId", exception.getBookId());
    return problem;
}
```

### 23.2 중복·상태 충돌 → 409

```java
@ExceptionHandler(DuplicateIsbnException.class)
public ProblemDetail handleDuplicateIsbn(
        DuplicateIsbnException exception) {

    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            "이미 등록된 ISBN입니다."
    );
    problem.setTitle("Resource Conflict");
    problem.setProperty("code", "DUPLICATE_ISBN");
    return problem;
}
```

민감하거나 내부 식별에 쓰이는 값은 ProblemDetail 확장 속성에 무조건 추가하지 않는다.

### 23.3 `@ResponseStatus`와 `ResponseStatusException`

예외 클래스에 `@ResponseStatus`를 붙이거나 `ResponseStatusException`을 던질 수도 있다.

```java
throw new ResponseStatusException(
        HttpStatus.NOT_FOUND,
        "책을 찾을 수 없습니다."
);
```

작은 기능에서는 간단하지만 도메인·Service가 Spring HTTP 타입에 직접 결합할 수 있다. 중앙 오류 형식과 로깅을 통제하려면 의미 있는 애플리케이션 예외와 Advice 매핑이 더 분명할 수 있다.

## 24. 예상하지 못한 예외 처리

마지막 안전망으로 일반 예외를 처리할 수 있다.

```java
private static final Logger log = LoggerFactory.getLogger(
        GlobalExceptionHandler.class
);

@ExceptionHandler(Exception.class)
public ProblemDetail handleUnexpected(
        Exception exception,
        HttpServletRequest request) {

    log.error(
            "예상하지 못한 서버 오류: method={}, uri={}",
            request.getMethod(),
            request.getRequestURI(),
            exception
    );

    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "요청을 처리하는 중 오류가 발생했습니다."
    );
    problem.setTitle("Internal Server Error");
    problem.setProperty("code", "INTERNAL_SERVER_ERROR");
    return problem;
}
```

### 24.1 클라이언트에 Stack Trace를 보내지 않는다

다음 정보는 보안과 내부 구조 노출 문제가 될 수 있다.

- Stack Trace
- SQL과 테이블명
- 서버 파일 경로
- 라이브러리·클래스 내부 이름
- API Key, 토큰, 비밀번호
- 외부 서비스의 민감한 원문 응답

클라이언트에는 안전한 메시지와 추적용 ID를 제공하고, 상세 원인은 접근 통제된 서버 로그에서 확인한다.

### 24.2 모든 예외를 500으로 덮으면 안 된다

구체적인 Handler가 먼저 매칭될 수 있도록 예외 타입과 Advice 우선순위를 설계한다. 400·404·409까지 모두 일반 Handler가 잡아 500으로 바꾸면 의미가 사라진다.

## 25. 오류 코드와 메시지를 분리하기

```json
{
  "status": 404,
  "code": "BOOK_NOT_FOUND",
  "title": "Book Not Found",
  "detail": "요청한 책을 찾을 수 없습니다."
}
```

| 값 | 성격 | 변경 가능성 |
| --- | --- | --- |
| HTTP status | 프로토콜 의미 | 의미를 유지해야 함 |
| `code` | 애플리케이션이 식별하는 안정적 값 | 계약으로 관리 |
| `title` | 오류 유형의 짧은 이름 | 비교적 안정적 |
| `detail` | 사용자·개발자를 위한 설명 | 문구·언어가 바뀔 수 있음 |

클라이언트가 `message` 문자열을 비교해 로직을 분기하지 않게 한다.

```javascript
// 피하고 싶은 방식
if (error.message === '책을 찾을 수 없습니다.') {
  // ...
}

// 안정적인 코드로 분기
if (error.code === 'BOOK_NOT_FOUND') {
  // ...
}
```

## 26. 메시지 국제화

Bean Validation과 Spring의 MessageSource를 이용해 Locale별 메시지를 관리할 수 있다.

```properties
# messages_ko.properties
NotBlank.createBookRequest.title=제목은 비어 있을 수 없습니다.
Size.createBookRequest.title=제목은 {2}자 이상 {1}자 이하여야 합니다.
```

```properties
# messages_en.properties
NotBlank.createBookRequest.title=Title must not be blank.
Size.createBookRequest.title=Title must be between {2} and {1} characters.
```

그러나 서버가 번역된 문구를 제공할지, 클라이언트가 `code`를 번역할지는 제품 구조에 따라 선택한다.

- 여러 종류의 클라이언트가 같은 API를 쓰는가?
- 사용자의 Locale은 어디에서 결정되는가?
- 운영 로그는 어느 언어로 남길 것인가?
- 필드명도 번역할 것인가?

오류 코드와 메시지를 분리하면 선택지가 넓어진다.

## 27. Validation Group은 신중하게 사용한다

같은 DTO에 생성·수정 규칙을 다르게 적용하기 위해 Group을 사용할 수 있다.

```java
public interface CreateGroup {
}

public interface UpdateGroup {
}
```

```java
public record BookRequest(
        @NotNull(groups = UpdateGroup.class)
        Long id,

        @NotBlank(groups = {CreateGroup.class, UpdateGroup.class})
        String title
) {
}
```

```java
public BookResponse create(
        @Validated(CreateGroup.class) @RequestBody BookRequest request) {
    // ...
}
```

Group은 강력하지만 하나의 DTO가 여러 사용 사례의 서로 다른 계약을 떠안게 만들 수 있다. 생성·수정 DTO를 분리하면 이름과 타입만으로 계약이 더 분명한 경우가 많다. 중복 필드 몇 개를 줄이기 위해 API 의미를 숨기지 않는다.

## 28. 검증 시점과 데이터베이스 제약

애플리케이션 검증만으로 데이터 무결성이 완전히 보장되지는 않는다.

```text
요청 A: ISBN 중복 없음 확인
요청 B: ISBN 중복 없음 확인
요청 A: INSERT 성공
요청 B: INSERT 시도
```

두 요청이 동시에 진행되면 둘 다 사전 검사를 통과할 수 있다. 중복을 절대로 허용하지 않아야 한다면 DB unique constraint가 최종 보장을 맡아야 한다.

```text
Bean Validation
  → 빠른 입력 피드백

Service 규칙
  → 사용 사례 의미 검사

DB Constraint
  → 동시성 상황에서도 데이터 무결성 최종 보장
```

DB 제약 위반 예외를 안정적인 애플리케이션 예외로 변환할 때는 실제 원인이 어떤 제약인지 구분하고, SQL 원문을 클라이언트에 노출하지 않는다.

## 29. 전체 예제 연결하기

### 29.1 요청 DTO

```java
package com.example.reading.book.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateBookRequest(
        @NotBlank(message = "제목은 비어 있을 수 없습니다.")
        @Size(max = 100, message = "제목은 100자 이하여야 합니다.")
        String title,

        @NotBlank(message = "저자는 비어 있을 수 없습니다.")
        @Size(max = 50, message = "저자는 50자 이하여야 합니다.")
        String author,

        @NotBlank(message = "ISBN은 필수입니다.")
        @Pattern(
                regexp = "^[0-9]{10}([0-9]{3})?$",
                message = "ISBN은 숫자 10자리 또는 13자리여야 합니다."
        )
        String isbn
) {
}
```

실제 ISBN은 check digit 등 더 정교한 규칙이 있다. 이 정규식은 검증 계층을 설명하기 위한 단순 예제이며 제품 검증 규칙으로 그대로 확정하지 않는다.

### 29.2 Controller

```java
package com.example.reading.book;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.reading.book.dto.BookResponse;
import com.example.reading.book.dto.CreateBookRequest;

@RestController
@RequestMapping("/api/books")
public class BookController {
    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @PostMapping
    public ResponseEntity<BookResponse> create(
            @Valid @RequestBody CreateBookRequest request) {
        BookResponse response = bookService.create(request);
        URI location = URI.create("/api/books/" + response.id());
        return ResponseEntity.created(location).body(response);
    }

    @GetMapping("/{bookId}")
    public BookResponse findById(
            @Positive(message = "bookId는 양수여야 합니다.")
            @PathVariable long bookId) {
        return bookService.findById(bookId);
    }
}
```

### 29.3 Service

```java
package com.example.reading.book;

import org.springframework.stereotype.Service;

import com.example.reading.book.dto.BookResponse;
import com.example.reading.book.dto.CreateBookRequest;

@Service
public class BookService {
    private final BookRepository bookRepository;

    public BookService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    public BookResponse create(CreateBookRequest request) {
        if (bookRepository.existsByIsbn(request.isbn())) {
            throw new DuplicateIsbnException(request.isbn());
        }

        Book book = new Book(
                request.title(),
                request.author(),
                request.isbn()
        );

        return BookResponse.from(bookRepository.save(book));
    }

    public BookResponse findById(long bookId) {
        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new BookNotFoundException(bookId));

        return BookResponse.from(book);
    }
}
```

### 29.4 Advice 핵심 구조

```java
package com.example.reading.common.error;

import java.net.URI;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.example.reading.book.BookNotFoundException;
import com.example.reading.book.DuplicateIsbnException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(
            MethodArgumentNotValidException exception) {
        List<InvalidField> errors = exception
                .getBindingResult()
                .getFieldErrors()
                .stream()
                .map(InvalidField::from)
                .toList();

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "요청 필드의 값을 확인해 주세요."
        );
        problem.setType(URI.create(
                "https://example.com/problems/validation-failed"
        ));
        problem.setTitle("Validation Failed");
        problem.setProperty("code", "VALIDATION_FAILED");
        problem.setProperty("errors", errors);
        return problem;
    }

    @ExceptionHandler(BookNotFoundException.class)
    public ProblemDetail handleBookNotFound(
            BookNotFoundException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND,
                "요청한 책을 찾을 수 없습니다."
        );
        problem.setTitle("Book Not Found");
        problem.setProperty("code", "BOOK_NOT_FOUND");
        return problem;
    }

    @ExceptionHandler(DuplicateIsbnException.class)
    public ProblemDetail handleDuplicateIsbn(
            DuplicateIsbnException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                "이미 등록된 ISBN입니다."
        );
        problem.setTitle("Resource Conflict");
        problem.setProperty("code", "DUPLICATE_ISBN");
        return problem;
    }
}
```

실제 구현에서는 잘못된 JSON, Handler Method Validation, 예상하지 못한 예외 Handler도 프로젝트 오류 계약에 맞춰 추가한다.

## 30. 요청별 실행 흐름 비교

### 30.1 정상 생성

```text
올바른 JSON
  → DTO 생성
  → Bean Validation 통과
  → Controller
  → 중복 ISBN 없음
  → 저장
  → 201 Created
```

### 30.2 빈 제목

```text
JSON 파싱 성공
  → DTO 생성
  → @NotBlank 실패
  → MethodArgumentNotValidException
  → Advice
  → 400 + VALIDATION_FAILED + fields
```

### 30.3 가격 타입 오류

```text
JSON에서 Integer 변환 실패
  → DTO 생성 실패
  → HttpMessageNotReadableException
  → Advice
  → 400 + MALFORMED_JSON
```

### 30.4 중복 ISBN

```text
형식 검증 통과
  → Controller
  → Service가 저장 상태 조회
  → DuplicateIsbnException
  → Advice
  → 409 + DUPLICATE_ISBN
```

### 30.5 없는 책 조회

```text
Path Variable 양수 검증 통과
  → Service 조회 결과 없음
  → BookNotFoundException
  → Advice
  → 404 + BOOK_NOT_FOUND
```

## 31. 직접 오류 응답 확인하기

### 31.1 빈 필드

```powershell
curl.exe -i -X POST "http://localhost:8080/api/books" `
  -H "Content-Type: application/json" `
  -d '{"title":" ","author":"","isbn":"123"}'
```

확인할 내용:

- 상태 코드가 400인가?
- `Content-Type`이 오류 계약과 맞는가?
- `code`가 안정적인가?
- title, author, isbn 오류를 모두 제공하는가?
- 내부 클래스나 Stack Trace가 노출되지 않는가?

### 31.2 깨진 JSON

```powershell
curl.exe -i -X POST "http://localhost:8080/api/books" `
  -H "Content-Type: application/json" `
  -d '{"title":"Spring"'
```

### 31.3 없는 자원

```powershell
curl.exe -i "http://localhost:8080/api/books/999999"
```

### 31.4 Path Variable 제약

```powershell
curl.exe -i "http://localhost:8080/api/books/0"
```

정상 입력만 확인하지 않고 오류 분류별로 최소 한 번씩 실제 응답 전체를 확인한다.

## 32. 테스트에서 검증할 계약

테스트 구현은 후속 테스트 노트에서 자세히 다루지만, 오류 계약을 설계할 때부터 검증 항목을 정한다.

```text
DTO 검증 실패
  ✓ HTTP 400
  ✓ code = VALIDATION_FAILED
  ✓ errors에 title 포함
  ✓ Service가 호출되지 않음

없는 자원
  ✓ HTTP 404
  ✓ code = BOOK_NOT_FOUND
  ✓ 내부 예외 클래스명 미노출

중복 ISBN
  ✓ HTTP 409
  ✓ code = DUPLICATE_ISBN

예상하지 못한 오류
  ✓ HTTP 500
  ✓ 안전한 일반 메시지
  ✓ Stack Trace 미노출
  ✓ 서버 로그에는 원인 기록
```

MockMvc를 사용하면 다음과 같은 형태로 웹 계약을 확인할 수 있다.

```java
mockMvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "title": "",
                          "author": "Kim",
                          "isbn": "1234567890123"
                        }
                        """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.errors[*].field").value(hasItem("title")));
```

예외 Handler 메서드가 존재한다는 사실보다 실제 JSON 계약을 검증하는 것이 중요하다.

## 33. 로깅 기준

모든 4xx를 Error Stack Trace로 기록하면 정상적인 사용자 입력 실수로 로그가 가득 찰 수 있다. 반대로 500을 기록하지 않으면 원인을 찾기 어렵다.

| 상황 | 일반적인 로그 수준 검토 | 이유 |
| --- | --- | --- |
| DTO 검증 실패 | INFO 또는 DEBUG | 흔한 클라이언트 입력 오류 |
| 없는 자원 | INFO 또는 DEBUG | 정상적인 조회 실패일 수 있음 |
| 상태 충돌 | INFO 또는 WARN | 업무 흐름에 따라 관찰 필요 |
| 예상하지 못한 500 | ERROR + Stack Trace | 서버 결함·장애 조사 필요 |
| 외부 서비스 일시 실패 | WARN 또는 ERROR | 재시도·영향도에 따라 결정 |

로그 수준은 트래픽과 운영 정책에 맞춰 정한다. 다음 정보도 안전성 검토 후 구조화해 남긴다.

- request ID 또는 trace ID
- HTTP method와 URI template
- 오류 code
- 사용자 ID의 안전한 내부 식별자
- 처리 시간

요청 Body 전체와 인증 Header를 무조건 로그에 남기지 않는다.

## 34. 자주 하는 실수

### 34.1 DTO에 제약만 붙이고 `@Valid` 누락

제약 애너테이션이 있어도 검증 진입점이 없어 Controller가 실행될 수 있다. Controller 매개변수의 `@Valid` 여부와 테스트를 확인한다.

### 34.2 `@Size`가 null도 막는다고 오해

필수 값이면 `@NotNull` 또는 문자열의 `@NotBlank`를 함께 고려한다.

### 34.3 모든 규칙을 정규식으로 해결

정규식은 문자열 형식에 적합하지만 중복, 현재 상태, 권한, 여러 데이터 간 관계까지 자연스럽게 표현하지 못한다.

### 34.4 `IllegalArgumentException` 하나로 모든 실패 표현

Advice가 HTTP 상태를 결정할 의미가 부족하다. 애플리케이션 의미별 예외 타입이나 오류 코드를 사용한다.

### 34.5 예외 메시지를 그대로 응답

내부 구현·SQL·개인정보가 노출될 수 있고 문구가 안정적인 API 계약이 되기 어렵다.

### 34.6 `Exception.class`만 처리

모든 오류가 500이 되어 클라이언트 오류와 서버 오류의 경계가 사라진다. 구체적인 예외부터 매핑하고 일반 Handler는 마지막 안전망으로 둔다.

### 34.7 DTO 검증 예외 하나만 처리

현재 Spring MVC에서는 객체 검증과 메서드 검증이 서로 다른 예외가 될 수 있다. 잘못된 JSON도 별도 예외다.

### 34.8 비밀번호의 rejected value를 응답

필드 오류 DTO와 로그에 민감한 입력을 담지 않는다.

### 34.9 404 대신 200과 null 반환

클라이언트는 성공인지 실패인지 별도 Body 해석이 필요하다. 자원 부재라는 의미를 상태 코드와 오류 코드로 일관되게 표현한다.

### 34.10 검증으로 DB 무결성까지 보장했다고 생각

동시 요청의 경쟁을 막으려면 데이터베이스 제약과 트랜잭션을 함께 고려해야 한다.

## 35. 구현 체크리스트

### 의존성과 DTO

- [ ] 프로젝트 버전에 맞는 Validation Starter가 있는가?
- [ ] import가 `jakarta.validation.*`인가?
- [ ] 요청 DTO에 사용 사례에 맞는 제약이 있는가?
- [ ] 필수 문자열에 `@NotBlank`를 검토했는가?
- [ ] nullable 숫자와 primitive의 차이를 고려했는가?
- [ ] 중첩 객체·컬렉션 원소에 필요한 `@Valid`가 있는가?

### Controller

- [ ] `@RequestBody` 검증 대상에 `@Valid`가 있는가?
- [ ] Path·Query Parameter 직접 제약을 테스트했는가?
- [ ] 현재 Spring 버전에서 발생하는 검증 예외 타입을 확인했는가?
- [ ] Controller마다 `BindingResult` 오류 변환을 반복하지 않는가?

### 비즈니스 규칙

- [ ] DTO 형식 규칙과 상태 기반 규칙을 구분했는가?
- [ ] 의미 있는 사용자 정의 예외를 사용했는가?
- [ ] 동시성에서 중요한 규칙은 DB 제약으로도 보장하는가?

### 오류 응답

- [ ] 400·404·409·500의 의미를 구분했는가?
- [ ] 안정적인 애플리케이션 오류 코드가 있는가?
- [ ] 필드 오류와 객체 수준 오류를 모두 고려했는가?
- [ ] 잘못된 JSON을 DTO 검증 실패와 구분했는가?
- [ ] Stack Trace와 내부 예외 메시지를 숨겼는가?
- [ ] 민감한 rejected value를 제외했는가?

### 운영과 테스트

- [ ] 예상하지 못한 500을 Stack Trace와 함께 서버에 기록하는가?
- [ ] 4xx를 과도한 Error 로그로 남기지 않는가?
- [ ] 오류 종류별 상태·code·Body 계약 테스트가 있는가?
- [ ] 요청 ID·trace ID로 클라이언트 문의와 로그를 연결할 수 있는가?

## 36. 배운 점과 다음 학습 연결

### 36.1 이번 노트에서 이해한 것

- Bean Validation은 Java 객체의 제약을 선언하고 검사하는 표준이다.
- `@Valid`는 중첩 객체 제약 검증을 시작하게 하는 표시이며 제약 자체는 아니다.
- DTO 제약과 Service 비즈니스 규칙은 필요한 정보와 책임이 다르다.
- Spring MVC에서는 객체 검증과 메서드 검증의 예외가 다를 수 있다.
- Advice는 애플리케이션 예외를 HTTP 상태와 안전한 오류 계약으로 번역한다.
- `ProblemDetail`은 RFC 9457 기반 오류 표현을 지원한다.
- 오류 코드와 메시지를 분리하면 클라이언트 로직과 번역이 안정적이다.

### 36.2 이전 노트와의 연결

이전 노트에서 요청·응답 DTO로 정상 API 계약을 만들었다. 이번에는 요청 DTO가 만족해야 할 제약과 실패 API 계약을 추가했다.

```text
정상 계약
  → Resource URI + Method + Request DTO + Response DTO + Success Status

실패 계약
  → Constraint + Exception + Error Code + Error Body + Failure Status
```

### 36.3 다음 학습

다음에는 설정과 Profile을 학습한다.

- `application.properties`와 YAML 구조
- type-safe Configuration Properties
- 개발·테스트·운영 Profile 분리
- 환경 변수와 외부 설정 우선순위
- 비밀값을 저장소에 커밋하지 않는 방법
- 환경별 로그·DB·외부 API 설정 관리

## 37. 요약 정리

1. 검증은 규칙 만족 여부를 확인하고, 예외 처리는 실패를 HTTP 응답으로 번역한다.
2. JSON 파싱, DTO 제약, 비즈니스 규칙, 자원 부재, 시스템 오류는 서로 다른 실패 계층이다.
3. Bean Validation의 API와 실제 Provider 역할을 구분한다.
4. 요청 DTO의 제약은 `@Valid`와 함께 적용한다.
5. `@NotNull`, `@NotEmpty`, `@NotBlank`는 빈 값을 판단하는 범위가 다르다.
6. 중첩 객체와 컬렉션 원소 검증에는 적절한 `@Valid`와 type-use 제약이 필요하다.
7. 저장 상태가 필요한 규칙은 Service와 DB 제약에서 다룬다.
8. 의미별 사용자 정의 예외는 HTTP 상태 매핑을 분명하게 만든다.
9. `@RestControllerAdvice`는 오류 상태·Body·로깅 정책을 중앙화한다.
10. `ProblemDetail`은 RFC 9457 기반 표준 오류 필드와 확장 속성을 제공한다.
11. 안정적인 오류 코드와 변경 가능한 메시지를 분리한다.
12. 내부 예외·Stack Trace·민감한 입력을 클라이언트에 노출하지 않는다.

## 38. 미니 퀴즈

1. JSON 역직렬화 실패와 Bean Validation 실패는 처리 흐름의 어느 지점이 다른가?
2. `@NotNull`, `@NotEmpty`, `@NotBlank`가 공백 문자열을 처리하는 방식은 어떻게 다른가?
3. `@Valid` 자체가 Constraint가 아니라는 말은 무슨 뜻인가?
4. 중첩 DTO 필드에 `@Valid`가 필요한 이유는 무엇인가?
5. `List`의 크기 검증과 각 원소 검증은 어떻게 선언하는가?
6. ISBN 형식과 ISBN 중복을 각각 어느 계층에서 검사하는 것이 자연스러운가?
7. `MethodArgumentNotValidException`만 처리하면 놓칠 수 있는 입력 오류는 무엇인가?
8. `BindingResult`를 모든 REST Controller에서 직접 처리할 때 어떤 문제가 생기는가?
9. `ProblemDetail`의 `type`, `title`, `status`, `detail`, `instance`는 각각 무엇인가?
10. 오류 메시지 대신 안정적인 `code`로 클라이언트가 분기해야 하는 이유는 무엇인가?
11. 애플리케이션 사전 중복 검사와 DB unique constraint가 모두 필요한 이유는 무엇인가?
12. 예상하지 못한 500 응답에서 클라이언트와 서버 로그에 각각 무엇을 남겨야 하는가?

## 참고 자료

- [Spring Boot Reference - Validation](https://docs.spring.io/spring-boot/reference/io/validation.html)
- [Spring Framework Reference - Java Bean Validation](https://docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html)
- [Spring Framework Reference - Spring MVC Validation](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html)
- [Spring Framework Reference - Exceptions](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-exceptionhandler.html)
- [Spring Framework Reference - Error Responses](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)
- [Jakarta Validation 3.1 Specification](https://jakarta.ee/specifications/bean-validation/3.1/jakarta-validation-spec-3.1.html)
- [RFC 9457 - Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)

> 정리 기준일: 2026-09-01
