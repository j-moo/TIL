# Spring Boot를 시작하기 전에 알아야 할 필수 지식

- 학습 목표: Spring Boot 학습에 필요한 Java·웹·데이터베이스·빌드 도구·Spring 핵심 개념을 한 흐름으로 연결하고, 첫 프로젝트의 코드를 단순 암기가 아니라 원리로 읽는다.
- 핵심 키워드: Java, JVM, Maven, Gradle, HTTP, JSON, REST, SQL, JDBC, JPA, Spring Framework, IoC, DI, Bean, ApplicationContext, Component Scan, Auto-configuration, Starter, Embedded Server
- 중요도: 매우 높음. Spring Boot의 애너테이션과 자동 설정을 이해하려면 그 아래에서 해결되는 문제를 먼저 알아야 한다.
- 권장 대상: Java 기본 문법은 공부했지만 Spring과 Spring Boot는 처음인 학습자
- 관련 노트: [Java 학습 로드맵](../../Java/README.md), [브라우저 웹 보안 기초](../../Web/06_08_16_Browser_Web_Security_Fundamentals/08_16_Browser_Web_Security_Fundamentals.md), [DB 학습 폴더](../../DB)

---

## 1. 들어가며: Spring Boot부터 바로 시작해도 될까

Spring Initializr에서 프로젝트를 만들고 다음 코드를 실행하면 서버는 빠르게 열린다.

```java
@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

하지만 처음 보는 입장에서는 거의 모든 줄이 질문이다.

- `@SpringBootApplication`은 무엇인가?
- `SpringApplication.run()`은 무엇을 만드는가?
- 왜 객체를 직접 `new`하지 않아도 되는가?
- 왜 `localhost:8080`으로 접속하는가?
- Java 객체가 어떻게 JSON 응답이 되는가?
- `pom.xml`이나 `build.gradle`은 왜 필요한가?
- 데이터베이스 연결 정보는 어디에 적는가?

Spring Boot는 Java, 웹 서버, Spring Framework, 빌드 도구의 여러 설정을 편리하게 연결해 준다. 편리함을 제대로 이해하려면 그 아래에 있는 개념의 역할을 구분할 수 있어야 한다.

그렇다고 모든 기반 기술을 전문가 수준으로 끝내고 시작할 필요는 없다. 이 노트는 사전지식을 세 단계로 나눈다.

| 단계 | 의미 | 범위 |
| --- | --- | --- |
| 시작 전 필수 | 모르면 첫 코드를 읽기 어려움 | Java 객체지향, 패키지·애너테이션, 예외, HTTP, JSON, 빌드 도구 기초 |
| 학습하며 보강 | 첫 프로젝트와 함께 익혀도 됨 | SQL, 트랜잭션, 테스트, 환경 설정, 로깅 |
| 나중에 심화 | 입문을 늦출 필요 없음 | Servlet 내부 구현, AOP 상세, JVM 튜닝, 분산 시스템, 컨테이너 오케스트레이션 |

> 목표는 사전지식을 모두 외우는 것이 아니라, Spring Boot 코드에서 어떤 기반 지식이 사용되고 있는지 알아보는 것이다.

---

## 2. Spring Framework와 Spring Boot를 먼저 구분하기

### 2.1 Spring Framework

Spring Framework는 애플리케이션의 객체를 만들고 연결하는 IoC 컨테이너, 웹 요청을 처리하는 Spring MVC, 트랜잭션과 데이터 접근 등 여러 기반 기능을 제공한다.

핵심 질문은 다음과 같다.

```text
객체를 누가 만들 것인가?
객체 사이의 의존 관계를 누가 연결할 것인가?
HTTP 요청을 어떤 Java 메서드로 전달할 것인가?
```

### 2.2 Spring Boot

Spring Boot는 Spring 기반 애플리케이션을 빠르게 구성하고 실행하도록 다음 편의를 제공한다.

- 자주 함께 쓰는 의존성을 Starter로 묶는다.
- 클래스패스와 설정을 보고 합리적인 기본 구성을 자동 적용한다.
- Tomcat 같은 웹 서버를 애플리케이션 안에 포함할 수 있다.
- 실행 가능한 JAR로 패키징하고 `main()`에서 실행할 수 있다.
- 외부 설정, 상태 점검, 테스트 같은 운영·개발 기능을 일관된 방식으로 제공한다.

```text
Spring Framework
  └─ 객체 관리, DI, MVC, 트랜잭션 등 핵심 기능

Spring Boot
  └─ Spring을 쉽게 시작하고 설정하고 실행하게 하는 도구와 규칙
```

Spring Boot가 Spring을 대체하는 별도 웹 프레임워크는 아니다. Spring Framework를 바탕으로 설정과 실행 경험을 단순화한다.

### 2.3 자동 설정은 코드 생성이 아니다

Spring Boot 공식 가이드는 자동 설정이 소스 파일을 수정하거나 코드를 생성하는 방식이 아니라고 설명한다. 애플리케이션이 시작될 때 클래스패스, 기존 Bean, 설정 속성을 살펴보고 필요한 구성을 ApplicationContext에 등록한다.

예를 들어 웹 관련 Starter가 클래스패스에 있으면 Spring Boot는 웹 애플리케이션에 필요한 구성과 내장 서버를 준비한다. 사용자가 같은 종류의 구성을 직접 제공하면 자동 설정이 물러나는 경우도 있다.

---

## 3. 필수 사전지식 1: Java 실행 구조

### 3.1 JDK, 컴파일, JVM

Spring Boot 애플리케이션도 결국 Java 프로그램이다.

```text
Java 소스 코드
    ↓ 컴파일
바이트코드(.class)
    ↓ JVM 실행
Spring Boot 애플리케이션
```

다음 명령의 결과를 확인할 수 있어야 한다.

```bash
java -version
javac -version
```

두 명령이 서로 다른 JDK를 가리키면 IDE에서는 실행되지만 터미널 빌드가 실패하는 문제가 생길 수 있다.

### 3.2 Spring Boot와 Java 버전

2026년 8월 21일 기준 공식 Spring Boot 4.1.0 시스템 요구사항은 Java 17 이상이며 Java 26까지 호환된다고 안내한다. 그러나 프로젝트에서 사용할 Spring Boot 버전이 달라지면 지원 Java 범위도 달라질 수 있다.

따라서 다음 순서로 결정한다.

1. 강의나 팀이 지정한 Spring Boot 버전을 확인한다.
2. 해당 버전의 공식 System Requirements를 연다.
3. 지원되는 JDK를 설치한다.
4. IDE의 Project SDK와 터미널의 `java -version`을 맞춘다.

최신 버전이라는 이유만으로 JDK나 Spring Boot를 임의로 섞지 않는다.

### 3.3 클래스패스

클래스패스(classpath)는 JVM과 컴파일러가 클래스와 라이브러리를 찾는 경로다. Spring Boot 자동 설정은 클래스패스에 어떤 라이브러리가 있는지를 중요한 조건으로 사용한다.

```text
웹 Starter가 클래스패스에 있음
        ↓
웹 애플리케이션으로 판단할 단서가 생김
        ↓
관련 자동 설정 적용
```

의존성을 추가한다는 것은 단순히 파일을 다운로드하는 것뿐 아니라 애플리케이션의 클래스패스와 자동 설정 조건을 바꾸는 일이다.

---

## 4. 필수 사전지식 2: Java 객체지향

### 4.1 클래스와 객체

Spring이 관리하는 대상도 Java 객체다.

```java
public class OrderService {
    public void createOrder() {
        System.out.println("주문 생성");
    }
}
```

클래스는 설계이고 객체는 실제 인스턴스다.

```java
OrderService orderService = new OrderService();
orderService.createOrder();
```

Spring을 배우면 이 `new`의 일부를 개발자가 직접 수행하지 않고 컨테이너에 맡기게 된다. 그러므로 클래스, 객체, 생성자의 관계를 먼저 이해해야 한다.

### 4.2 인터페이스와 다형성

```java
public interface PaymentGateway {
    void pay(long amount);
}
```

```java
public class TestPaymentGateway implements PaymentGateway {
    @Override
    public void pay(long amount) {
        System.out.println("테스트 결제: " + amount);
    }
}
```

사용하는 쪽이 구체 클래스가 아니라 인터페이스에 의존하면 구현을 교체하기 쉽다.

```java
public class OrderService {
    private final PaymentGateway paymentGateway;

    public OrderService(PaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }
}
```

이 구조가 의존성 주입을 이해하는 출발점이다.

### 4.3 생성자와 `final`

객체가 동작하려면 반드시 필요한 협력 객체를 생성자로 받는다.

```java
public class OrderService {
    private final PaymentGateway paymentGateway;

    public OrderService(PaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }
}
```

- 필요한 의존성이 코드에 명확히 드러난다.
- 객체를 불완전한 상태로 만들기 어렵다.
- 테스트에서 가짜 구현을 전달하기 쉽다.
- 필드를 `final`로 유지할 수 있다.

Spring에서도 필수 의존성에는 생성자 주입을 우선적으로 이해한다.

### 4.4 패키지와 접근 제어자

Spring Boot는 패키지 구조를 이용해 컴포넌트를 탐색한다. 다음 개념이 필요하다.

- `package`는 클래스의 소속과 전체 이름을 정한다.
- `import`는 다른 패키지의 타입 이름을 짧게 사용하게 한다.
- `public`, `protected`, package-private, `private`는 접근 범위를 정한다.
- 하위 패키지는 같은 패키지가 아니다.

```java
package com.example.shop.order;

public class OrderService {
}
```

### 4.5 제네릭과 컬렉션

Spring API에는 제네릭이 많이 등장한다.

```java
List<Order> orders;
Optional<Member> member;
ResponseEntity<OrderResponse> response;
```

`List<Order>`에서 `Order`는 목록의 원소 타입이고, `ResponseEntity<OrderResponse>`는 HTTP 응답 본문의 타입을 나타낸다. `<T>`, `<?>`, `Optional<T>`를 읽을 수 있으면 충분히 시작할 수 있다.

### 4.6 예외 처리

웹 애플리케이션에서는 입력 오류, 데이터 없음, 데이터베이스 실패 등 여러 예외가 발생한다.

```java
public Member findMember(long id) {
    return repository.findById(id)
            .orElseThrow(() -> new MemberNotFoundException(id));
}
```

시작 전 다음을 구분한다.

- 예외는 정상 반환값과 다른 실패 흐름이다.
- `throw`는 예외를 발생시킨다.
- `throws`는 호출자에게 처리 가능성을 알린다.
- 예외를 빈 `catch`로 삼키면 원인을 잃는다.
- 검사 예외와 실행 예외는 컴파일러의 처리 요구가 다르다.

### 4.7 애너테이션

Spring 코드는 애너테이션을 통해 클래스와 메서드의 역할을 선언한다.

```java
@RestController
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "hello";
    }
}
```

애너테이션은 주석처럼 사람만 읽는 설명이 아니다. 컴파일러나 프레임워크가 읽을 수 있는 메타데이터다.

```text
@RestController → 이 클래스를 웹 요청 처리 컴포넌트로 등록할 단서
@GetMapping     → GET 요청 경로와 메서드를 연결하는 정보
```

애너테이션 자체가 모든 동작을 수행하는 것이 아니라, Spring이 애너테이션을 읽어 객체를 등록하고 요청 처리 규칙을 구성한다.

### 4.8 람다와 스트림은 어느 정도 필요한가

첫 Controller를 만드는 데 필수는 아니지만 Repository 결과 처리와 컬렉션 변환에서 자주 만난다.

```java
List<String> names = members.stream()
        .map(Member::getName)
        .toList();
```

처음에는 람다 문법, `map`, `filter`, `toList`의 역할 정도를 읽을 수 있으면 된다.

---

## 5. 필수 사전지식 3: 빌드 도구와 의존성

### 5.1 왜 Maven이나 Gradle이 필요한가

Spring Boot 애플리케이션은 Spring Framework, JSON 변환기, 로깅, 웹 서버 등 여러 라이브러리를 사용한다. 이를 수동으로 다운로드하고 버전을 맞추기는 어렵다.

빌드 도구는 다음을 담당한다.

- 필요한 라이브러리와 플러그인 다운로드
- 소스 코드 컴파일
- 테스트 실행
- 실행 가능한 JAR 생성
- 의존성 버전과 범위 관리

Spring Boot 공식 문서는 Maven 또는 Gradle 사용을 권장한다.

### 5.2 Maven과 Gradle

| 구분 | Maven | Gradle |
| --- | --- | --- |
| 대표 설정 파일 | `pom.xml` | `build.gradle` 또는 `build.gradle.kts` |
| 설정 형식 | XML | Groovy DSL 또는 Kotlin DSL |
| 공통 역할 | 의존성, 플러그인, 빌드 생명주기 관리 | 의존성, 플러그인, 빌드 태스크 관리 |

둘을 동시에 배울 필요는 없다. 강의나 팀에서 쓰는 하나를 먼저 고른다. 이 노트의 명령 예시는 Maven Wrapper를 기준으로 설명하되 Gradle 명령도 함께 적는다.

### 5.3 의존성 좌표 읽기

Maven 의존성은 보통 다음 좌표로 식별한다.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webmvc</artifactId>
</dependency>
```

- `groupId`: 만든 조직이나 프로젝트 그룹
- `artifactId`: 라이브러리 이름
- `version`: 버전

Spring Boot가 관리하는 의존성은 보통 각 라이브러리의 `version`을 따로 적지 않는다. Spring Boot가 검증한 호환 버전 집합을 제공하기 때문이다. 임의로 일부 버전만 덮어쓰면 호환 문제가 생길 수 있다.

> Starter 이름은 Spring Boot 세대에 따라 달라질 수 있다. 오래된 블로그의 의존성을 그대로 복사하기보다 현재 프로젝트 버전의 공식 문서와 Initializr 결과를 기준으로 한다.

### 5.4 Starter와 전이 의존성

Starter는 특정 목적에 필요한 의존성 묶음을 제공하는 편리한 설명자다.

```text
웹 Starter 추가
   ├─ Spring MVC
   ├─ JSON 변환 관련 라이브러리
   ├─ 검증·로깅 관련 기반
   └─ 내장 서버 관련 구성
```

Starter 하나만 선언해도 연결된 라이브러리가 함께 들어오는 것을 **전이 의존성**이라고 한다. 정확한 목록은 다음 명령으로 확인한다.

```bash
./mvnw dependency:tree
```

Windows PowerShell에서는 다음처럼 실행할 수 있다.

```powershell
.\mvnw.cmd dependency:tree
```

Gradle은 다음 명령을 사용한다.

```bash
./gradlew dependencies
```

### 5.5 Wrapper를 사용하는 이유

프로젝트에 포함된 `mvnw`, `mvnw.cmd`, `gradlew`, `gradlew.bat`은 팀이 정한 빌드 도구 버전으로 명령을 실행하게 돕는다.

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

전역에 설치된 `mvn`이나 `gradle` 버전 차이를 줄일 수 있으므로 프로젝트에 Wrapper가 있다면 우선 사용한다.

### 5.6 기본 프로젝트 디렉터리

```text
demo/
├─ pom.xml 또는 build.gradle
├─ mvnw, mvnw.cmd 또는 gradlew, gradlew.bat
└─ src/
   ├─ main/
   │  ├─ java/       # 실제 애플리케이션 코드
   │  └─ resources/  # 설정, 정적 파일, 템플릿
   └─ test/
      └─ java/       # 테스트 코드
```

`src/main/java`와 `src/test/java`의 책임을 구분하고, `application.properties` 또는 `application.yaml`은 보통 `src/main/resources`에 둔다.

---

## 6. 필수 사전지식 4: 웹과 HTTP

### 6.1 클라이언트와 서버

```text
브라우저·React·모바일 앱
          │ HTTP 요청
          ▼
    Spring Boot 서버
          │ 처리
          ▼
       HTTP 응답
```

- 클라이언트는 필요한 작업이나 데이터를 요청한다.
- 서버는 요청을 해석하고 로직을 실행한 뒤 응답한다.
- Spring Boot 애플리케이션은 흔히 HTTP 서버 역할을 한다.

### 6.2 URL의 구성

```text
http://localhost:8080/api/members/10?active=true
│      │         │    │               └─ query parameter
│      │         │    └───────────────── path
│      │         └────────────────────── port
│      └──────────────────────────────── host
└─────────────────────────────────────── scheme
```

- `localhost`는 현재 컴퓨터 자신을 가리킨다.
- 포트는 같은 컴퓨터 안에서 어떤 프로그램과 통신할지 구분한다.
- Spring Boot 웹 애플리케이션의 흔한 기본 포트는 `8080`이다.

### 6.3 HTTP 요청의 구성

```http
POST /api/members HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "name": "민지",
  "email": "minji@example.com"
}
```

| 구성 | 역할 |
| --- | --- |
| Method | 요청 의도, 예: GET·POST |
| Path | 요청 대상 자원 |
| Header | 콘텐츠 형식, 인증 정보 등의 부가 정보 |
| Body | 생성·수정 등에 필요한 실제 데이터 |

### 6.4 주요 HTTP 메서드

| 메서드 | 일반적인 의미 | 예시 |
| --- | --- | --- |
| `GET` | 조회 | 회원 목록 조회 |
| `POST` | 생성 또는 처리 요청 | 새 회원 등록 |
| `PUT` | 자원의 전체 교체 | 회원 전체 정보 교체 |
| `PATCH` | 자원의 일부 변경 | 닉네임만 변경 |
| `DELETE` | 삭제 | 회원 삭제 |

메서드 이름만 맞춘다고 REST API가 자동으로 좋은 설계가 되는 것은 아니다. 자원, 상태 코드, 오류 응답을 함께 설계해야 한다.

### 6.5 주요 HTTP 상태 코드

| 상태 코드 | 의미 | 입문 예시 |
| ---: | --- | --- |
| `200 OK` | 요청 성공 | 조회 성공 |
| `201 Created` | 자원 생성 성공 | 회원 생성 |
| `204 No Content` | 본문 없는 성공 | 삭제 성공 |
| `400 Bad Request` | 잘못된 요청 | 필수 입력 누락 |
| `401 Unauthorized` | 인증 필요 또는 실패 | 로그인 토큰 없음 |
| `403 Forbidden` | 권한 부족 | 관리자 기능 접근 거부 |
| `404 Not Found` | 자원을 찾지 못함 | 없는 회원 조회 |
| `409 Conflict` | 현재 상태와 충돌 | 이메일 중복 |
| `500 Internal Server Error` | 서버 내부 실패 | 처리하지 못한 예외 |

`200`만 반환하고 본문에 성공·실패를 적는 방식보다 HTTP 의미에 맞는 상태 코드를 먼저 익힌다.

### 6.6 JSON

JSON은 웹 API에서 데이터를 주고받을 때 자주 사용하는 텍스트 형식이다.

```json
{
  "id": 1,
  "name": "민지",
  "active": true,
  "roles": ["USER", "EDITOR"]
}
```

Java 객체와 JSON은 같은 것이 아니다.

```text
HTTP 요청 JSON
    ↓ 역직렬화
Java 요청 객체
    ↓ 비즈니스 로직
Java 응답 객체
    ↓ 직렬화
HTTP 응답 JSON
```

Spring Boot 웹 구성에서는 Jackson 같은 JSON 라이브러리와 HTTP 메시지 변환기가 이 변환을 담당할 수 있다.

### 6.7 REST는 애너테이션 이름이 아니다

`@RestController`를 사용한다고 API 설계가 자동으로 REST 원칙을 만족하는 것은 아니다. 입문 단계에서는 다음 정도를 익힌다.

- URL은 동사보다 자원을 중심으로 표현한다.
- HTTP 메서드로 조회·생성·변경·삭제 의도를 구분한다.
- 적절한 상태 코드를 반환한다.
- 서버 내부 Entity 구조를 그대로 외부 계약으로 노출하지 않는다.

```text
권장:   GET /api/members/10
주의:   GET /api/getMember?id=10
```

### 6.8 브라우저 보안은 어디까지 알아야 하나

프론트엔드와 Spring Boot 서버를 다른 origin에서 실행하면 CORS를 만난다. 시작 전 다음 단어의 차이를 알아두면 좋다.

- origin은 scheme, host, port의 조합이다.
- CORS는 브라우저가 교차 출처 응답을 읽도록 서버가 허용하는 규칙이다.
- 인증은 사용자가 누구인지 확인하는 과정이다.
- 인가는 그 사용자가 특정 작업을 할 수 있는지 확인하는 과정이다.
- CORS 허용은 인증이나 인가를 대신하지 않는다.

---

## 7. 필수 사전지식 5: 데이터베이스

### 7.1 관계형 데이터베이스와 SQL

대부분의 입문 Spring Boot 프로젝트는 회원, 게시글, 주문 같은 데이터를 관계형 데이터베이스에 저장한다.

```sql
CREATE TABLE member (
    id BIGINT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);
```

시작 전 다음 SQL은 직접 읽고 작성할 수 있으면 좋다.

```sql
SELECT id, name, email
FROM member
WHERE id = 1;

INSERT INTO member (id, name, email)
VALUES (1, '민지', 'minji@example.com');

UPDATE member
SET name = '김민지'
WHERE id = 1;

DELETE FROM member
WHERE id = 1;
```

### 7.2 기본 키와 외래 키

- 기본 키(Primary Key)는 행을 고유하게 식별한다.
- 외래 키(Foreign Key)는 다른 테이블 행과의 관계를 표현한다.
- 일대일, 일대다, 다대다 관계를 구분한다.
- `NULL`, `NOT NULL`, `UNIQUE` 같은 제약 조건은 데이터 규칙을 지킨다.

### 7.3 트랜잭션

주문 생성과 재고 감소처럼 여러 변경이 하나의 작업이라면 전부 성공하거나 전부 실패해야 할 수 있다.

```text
주문 저장 성공
재고 감소 실패
        ↓
주문 저장도 되돌릴 것인가?
```

트랜잭션은 관련 작업을 하나의 논리적 단위로 묶는다. 입문 전에는 commit과 rollback의 의미, ACID가 해결하려는 문제 정도를 이해하면 된다.

### 7.4 JDBC, JPA, Spring Data JPA 구분하기

```text
애플리케이션 코드
   ├─ JDBC: SQL 실행과 결과 처리를 직접 다룸
   ├─ JPA: Java 객체와 관계형 데이터 모델을 연결하는 표준
   └─ Spring Data JPA: JPA 기반 Repository 작성을 편리하게 지원
```

세 가지를 같은 기술 이름으로 섞어 부르지 않는다. Spring Data JPA를 사용해도 데이터베이스와 SQL, JPA의 영속성 문맥·Entity 생명주기·연관관계 개념은 사라지지 않는다.

### 7.5 Entity와 DTO를 처음부터 구분하기

- Entity는 영속성 모델과 생명주기를 표현한다.
- 요청 DTO는 클라이언트 입력 계약을 표현한다.
- 응답 DTO는 외부로 제공할 데이터 계약을 표현한다.

Entity를 API 요청과 응답에 그대로 사용하면 데이터베이스 변경이 API에 번지거나, 의도하지 않은 필드가 노출될 수 있다. 처음에는 코드가 조금 늘더라도 역할을 분리하는 이유를 이해한다.

---

## 8. 필수 사전지식 6: IoC, DI, Bean

### 8.1 의존성이란 무엇인가

`OrderService`가 결제 기능을 사용한다면 `PaymentGateway`에 의존한다.

```java
public class OrderService {
    private final PaymentGateway paymentGateway;

    public OrderService() {
        this.paymentGateway = new RealPaymentGateway();
    }
}
```

이 코드는 `OrderService`가 사용할 구현을 직접 만들고 결정한다. 테스트용 구현으로 바꾸기 어렵고 객체 생성 책임이 섞인다.

### 8.2 의존성 주입

의존 객체를 외부에서 전달받도록 바꾼다.

```java
public class OrderService {
    private final PaymentGateway paymentGateway;

    public OrderService(PaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }
}
```

```java
PaymentGateway gateway = new RealPaymentGateway();
OrderService service = new OrderService(gateway);
```

`OrderService`는 결제 구현을 직접 생성하지 않고 필요한 타입만 선언한다. 이처럼 객체가 필요한 의존성을 생성자, 팩터리 메서드 인수, 속성 등을 통해 외부에서 받는 방식을 의존성 주입(DI)이라고 한다.

### 8.3 제어의 역전

일반 코드에서는 개발자가 객체를 만들고 연결한다.

```text
개발자 코드 → 객체 생성 → 의존성 연결 → 메서드 호출
```

Spring에서는 컨테이너가 설정 정보를 바탕으로 객체를 만들고 연결한다.

```text
설정·애너테이션 제공
        ↓
Spring 컨테이너가 객체 생성·조립
        ↓
완성된 객체를 애플리케이션에 제공
```

객체 생성과 조립의 제어권이 애플리케이션 객체에서 컨테이너로 옮겨갔기 때문에 제어의 역전(IoC)이라고 부른다.

### 8.4 Bean과 ApplicationContext

- Bean은 Spring IoC 컨테이너가 생성·조립·관리하는 객체다.
- ApplicationContext는 Bean을 만들고 설정하고 연결하는 Spring 컨테이너의 중심 인터페이스다.

모든 Java 객체가 자동으로 Bean인 것은 아니다. Spring 컨테이너에 등록되어 관리되는 객체를 Bean이라고 부른다.

### 8.5 Bean 등록 방식

컴포넌트 스캔 방식:

```java
@Service
public class OrderService {
}
```

Java 설정 방식:

```java
@Configuration
public class AppConfig {

    @Bean
    PaymentGateway paymentGateway() {
        return new RealPaymentGateway();
    }
}
```

`@Component`, `@Service`, `@Repository`, `@Controller` 등은 컴포넌트 스캔의 대상이 될 수 있다. `@Bean`은 메서드가 반환한 객체를 명시적으로 등록한다.

### 8.6 생성자 주입 예제

```java
@Service
public class OrderService {
    private final PaymentGateway paymentGateway;

    public OrderService(PaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }
}
```

생성자가 하나라면 일반적으로 `@Autowired`를 생략할 수 있다. 중요한 것은 애너테이션 생략 자체가 아니라 Spring이 생성자 매개변수 타입에 맞는 Bean을 찾아 전달한다는 원리다.

같은 타입의 Bean이 여러 개이거나 Bean이 하나도 없으면 연결 기준이 모호하거나 충족되지 않아 애플리케이션 시작이 실패할 수 있다.

---

## 9. Spring Boot 첫 프로젝트를 읽는 법

### 9.1 `@SpringBootApplication`

대표 애플리케이션 클래스는 보통 다음 형태다.

```java
package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

입문 단계에서는 `@SpringBootApplication`이 다음 역할을 묶는 핵심 애너테이션이라고 이해한다.

- 구성 클래스임을 나타낸다.
- 자동 설정을 활성화한다.
- 현재 패키지를 기준으로 하위 패키지의 컴포넌트를 탐색한다.

대표 클래스는 보통 애플리케이션의 루트 패키지에 둔다.

```text
com.example.demo
├─ DemoApplication.java
├─ member/
│  ├─ MemberController.java
│  └─ MemberService.java
└─ order/
   └─ OrderService.java
```

대표 클래스보다 바깥 패키지에 컴포넌트를 두면 기본 컴포넌트 스캔에서 발견하지 못할 수 있다.

### 9.2 `SpringApplication.run()`

이 호출은 단순히 `main` 다음 줄을 실행하는 정도가 아니다. 애플리케이션 환경을 준비하고 ApplicationContext를 만들며 자동 설정과 Bean 등록을 진행하고, 웹 애플리케이션이면 내장 서버를 시작한다.

```text
main 실행
  ↓
SpringApplication.run
  ↓
환경 설정 읽기
  ↓
ApplicationContext 생성
  ↓
Bean 탐색·등록·의존성 주입
  ↓
자동 설정 적용
  ↓
내장 웹 서버 시작
```

### 9.3 내장 서버

전통적인 배포에서는 외부 웹 서버나 애플리케이션 서버에 WAR 파일을 배포하기도 했다. Spring Boot는 Tomcat 같은 서버를 의존성으로 포함하고 실행 가능한 JAR 안에서 함께 시작할 수 있다.

```powershell
.\mvnw.cmd spring-boot:run
```

또는 패키징 후 실행한다.

```powershell
.\mvnw.cmd package
java -jar target\demo-0.0.1-SNAPSHOT.jar
```

### 9.4 간단한 Controller

```java
package com.example.demo.hello;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @GetMapping("/hello")
    public Greeting hello() {
        return new Greeting("안녕하세요");
    }
}
```

```java
package com.example.demo.hello;

public record Greeting(String message) {
}
```

요청과 응답 흐름:

```text
GET /hello
   ↓
내장 서버가 요청 수신
   ↓
Spring MVC가 HelloController.hello() 선택
   ↓
Greeting 객체 반환
   ↓
HTTP 메시지 변환기가 JSON으로 직렬화
   ↓
{"message":"안녕하세요"}
```

### 9.5 Controller, Service, Repository

처음에는 세 역할을 다음처럼 구분한다.

| 계층 | 주된 책임 | 하지 말아야 할 혼합 |
| --- | --- | --- |
| Controller | HTTP 요청·응답 변환 | 복잡한 업무 규칙 직접 처리 |
| Service | 비즈니스 규칙과 작업 흐름 | HTTP 세부사항에 강하게 의존 |
| Repository | 데이터 저장·조회 | 화면·응답 형식 결정 |

이 구분은 폴더를 세 개 만드는 규칙보다 책임을 나누는 사고방식이다.

---

## 10. 설정 파일과 환경 분리

### 10.1 외부 설정이 필요한 이유

개발과 운영은 포트, 데이터베이스 주소, 로그 수준 등이 다를 수 있다. 코드를 환경마다 다시 컴파일하기보다 설정을 외부화한다.

```properties
spring.application.name=demo
server.port=8080
```

또는 YAML을 사용할 수 있다.

```yaml
spring:
  application:
    name: demo

server:
  port: 8080
```

한 프로젝트에서는 특별한 이유가 없다면 properties와 YAML 중 하나를 일관되게 사용한다.

### 10.2 환경 변수

비밀번호와 API 키를 Git에 커밋하지 않는다.

```properties
spring.datasource.password=${DB_PASSWORD}
```

실제 값은 로컬 환경 변수나 배포 환경의 Secret 관리 기능으로 제공한다. `.gitignore`만 믿기보다 이미 추적 중인지도 확인한다.

### 10.3 Profile

Profile은 환경에 따라 다른 설정이나 Bean을 활성화할 수 있게 한다.

```text
application.properties
application-local.properties
application-test.properties
application-prod.properties
```

Profile은 편리하지만 설정 우선순위가 복잡해질 수 있다. 어떤 Profile이 활성화되었고 최종 값이 어디서 왔는지 확인하는 습관이 필요하다.

---

## 11. 테스트와 디버깅 사전지식

### 11.1 단위 테스트의 기본 구조

```java
class PriceCalculatorTest {

    @Test
    void 할인율을_적용한다() {
        PriceCalculator calculator = new PriceCalculator();

        long result = calculator.discount(10_000, 10);

        assertEquals(9_000, result);
    }
}
```

테스트는 준비, 실행, 검증 흐름으로 읽는다.

```text
Arrange: 테스트 대상과 입력 준비
Act:     기능 실행
Assert:  결과 검증
```

Spring 컨테이너 없이 가능한 테스트와 전체 ApplicationContext가 필요한 테스트를 구분하면 테스트가 빠르고 원인이 명확해진다.

### 11.2 로그를 읽는 순서

애플리케이션이 시작되지 않으면 긴 스택 트레이스 전체를 무작정 위에서 아래로 읽지 않는다.

1. 첫 번째 의미 있는 `Caused by`를 찾는다.
2. 어떤 Bean이나 설정 값이 문제인지 찾는다.
3. 자신의 패키지와 파일명이 보이는 프레임을 찾는다.
4. 포트 충돌, 환경 변수 누락, DB 연결 실패 여부를 확인한다.
5. 오류를 숨기기 위해 예외를 무조건 잡지 않는다.

### 11.3 자주 만나는 시작 실패

| 증상 | 먼저 확인할 것 |
| --- | --- |
| Port already in use | `8080`을 사용하는 다른 프로세스 |
| Bean을 찾을 수 없음 | 등록 애너테이션, 패키지 위치, 타입 |
| Bean 후보가 여러 개 | 같은 인터페이스 구현 Bean 수와 선택 기준 |
| DB 연결 실패 | URL, 계정, 비밀번호, DB 실행 상태 |
| 클래스·메서드 없음 | 의존성 버전 충돌, 오래된 예제, 잘못된 import |
| 404 | 요청 경로, HTTP 메서드, 컴포넌트 스캔 |

---

## 12. 버전이 다른 강의와 블로그 읽기

Spring 생태계는 버전 변화가 있다. 검색 결과를 볼 때 다음을 먼저 확인한다.

1. 글이 사용하는 Spring Boot 버전은 무엇인가?
2. 프로젝트의 `pom.xml` 또는 Gradle 파일 버전과 같은가?
3. import가 `javax.*`인가 `jakarta.*`인가?
4. 현재 버전의 공식 문서에 같은 API가 있는가?
5. Deprecated 경고나 마이그레이션 안내가 있는가?

Spring Boot 3 이상 자료에서는 Jakarta EE 전환으로 `jakarta.*` 패키지를 보게 된다. 오래된 Boot 2 예제의 `javax.persistence.*`, `javax.validation.*`를 현재 프로젝트에 그대로 붙이면 import 오류가 날 수 있다.

```java
// 현재 세대 자료에서 자주 보는 형태
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotBlank;
```

버전이 다른 예제의 코드를 억지로 맞추기보다 해당 버전의 공식 가이드로 같은 기능을 다시 찾는다.

---

## 13. 아직 몰라도 시작할 수 있는 것

다음 주제는 중요하지만 첫 REST API 전에 모두 끝낼 필요는 없다.

- Servlet 명세 전체와 DispatcherServlet 내부 구현
- AOP 프록시 생성 세부 과정
- Bean 생명주기 확장 포인트 전체
- JPA 영속성 컨텍스트의 모든 최적화
- Spring Security 필터 체인 전체
- JVM 가비지 컬렉터 튜닝
- Docker, Kubernetes, 메시지 큐, 마이크로서비스
- WebFlux와 리액티브 스트림

입문에서는 MVC 기반의 작은 애플리케이션을 완성한 뒤 필요에 따라 확장한다. 용어를 많이 아는 것보다 요청 한 번이 Controller, Service, Repository, 데이터베이스를 거쳐 응답으로 돌아오는 흐름을 설명하는 것이 먼저다.

---

## 14. 권장 사전 학습 순서

### 1단계: 반드시 복습

1. Java 클래스, 객체, 생성자
2. 인터페이스와 다형성
3. 패키지, 접근 제어자, 애너테이션
4. 컬렉션, 제네릭, 예외
5. HTTP 요청·응답, 메서드, 상태 코드
6. JSON 객체·배열 구조

### 2단계: 첫 프로젝트와 함께 학습

1. Maven 또는 Gradle
2. IoC, DI, Bean, ApplicationContext
3. 컴포넌트 스캔과 생성자 주입
4. Spring MVC Controller
5. 외부 설정과 Profile
6. SQL과 트랜잭션
7. 단위 테스트와 통합 테스트

### 3단계: CRUD 이후 확장

1. JPA Entity 생명주기와 연관관계
2. Validation과 공통 예외 응답
3. Spring Security 인증·인가
4. 로깅, Actuator, 관측성
5. 캐시, 메시징, 배치
6. 배포와 운영 환경

---

## 15. 첫 프로젝트 생성 전 체크리스트

### 15.1 환경

- [ ] `java -version`과 `javac -version`을 확인했다.
- [ ] 선택한 Spring Boot 버전의 공식 Java 요구사항을 확인했다.
- [ ] IDE Project SDK와 터미널 JDK가 일치한다.
- [ ] Git 저장소에 비밀값을 커밋하지 않는 방법을 안다.

### 15.2 Java

- [ ] 클래스와 객체, 생성자의 관계를 설명할 수 있다.
- [ ] 인터페이스 타입 변수에 구현 객체를 담을 수 있다.
- [ ] 생성자 매개변수로 의존 객체를 전달할 수 있다.
- [ ] 패키지와 import, 접근 제어자를 구분한다.
- [ ] 애너테이션이 프레임워크가 읽는 메타데이터가 될 수 있음을 안다.
- [ ] `List<T>`, `Optional<T>`, 예외 흐름을 읽을 수 있다.

### 15.3 웹

- [ ] URL에서 scheme, host, port, path, query를 구분한다.
- [ ] GET, POST, PUT, PATCH, DELETE의 일반적 의미를 안다.
- [ ] 2xx, 4xx, 5xx 상태 코드의 큰 차이를 설명할 수 있다.
- [ ] Header와 Body의 역할을 구분한다.
- [ ] JSON과 Java 객체가 변환 과정을 거친다는 것을 안다.
- [ ] 인증, 인가, CORS가 서로 다른 문제임을 안다.

### 15.4 빌드와 데이터

- [ ] Maven 또는 Gradle 중 프로젝트가 쓰는 도구를 안다.
- [ ] Wrapper로 빌드·테스트 명령을 실행할 수 있다.
- [ ] 의존성과 전이 의존성의 뜻을 설명할 수 있다.
- [ ] 기본 CRUD SQL을 읽을 수 있다.
- [ ] 기본 키와 외래 키, commit과 rollback을 설명할 수 있다.

모든 항목이 완벽하지 않아도 괜찮다. 체크되지 않은 항목이 오류나 코드에서 등장하면 이 노트의 해당 절로 돌아온다.

---

## 16. Spring Initializr에서 첫 프로젝트 준비하기

[Spring Initializr](https://start.spring.io/)에서 다음과 같이 시작할 수 있다.

| 항목 | 입문 선택 | 이유 |
| --- | --- | --- |
| Project | Maven 또는 강의 지정 도구 | 하나의 빌드 도구에 집중 |
| Language | Java | 기존 Java 학습과 연결 |
| Spring Boot | 강의 지정 버전 또는 현재 안정 버전 | 문서·의존성 호환 유지 |
| Group | `com.example` | 패키지 그룹 |
| Artifact | `demo` | 프로젝트 이름 |
| Packaging | Jar | 내장 서버와 함께 실행하기 쉬움 |
| Java | 선택한 Boot가 지원하는 설치 JDK | 컴파일·실행 버전 일치 |
| Dependency | Spring Web | 첫 HTTP API 작성 |

프로젝트를 받은 뒤 바로 코드를 늘리기 전에 다음을 확인한다.

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

Gradle 프로젝트라면 다음을 사용한다.

```powershell
.\gradlew.bat test
.\gradlew.bat bootRun
```

실행 로그에서 애플리케이션 이름, 활성 Profile, 서버 포트, 시작 성공 여부를 읽는다.

---

## 17. 핵심 요약

| 질문 | 핵심 답변 |
| --- | --- |
| Spring과 Spring Boot는 같은가? | Boot는 Spring 기반 애플리케이션의 설정·의존성·실행을 단순화한다. |
| Java는 어디까지 알아야 하는가? | 객체지향, 인터페이스, 생성자, 패키지, 애너테이션, 제네릭, 예외를 읽을 수 있어야 한다. |
| 빌드 도구는 왜 필요한가? | 의존성, 컴파일, 테스트, 패키징과 버전 관리를 반복 가능하게 수행한다. |
| HTTP에서 무엇을 알아야 하는가? | URL, 메서드, 상태 코드, Header, Body와 JSON 변환 흐름을 알아야 한다. |
| DI는 무엇인가? | 객체가 필요한 의존성을 직접 만들지 않고 외부에서 전달받는 방식이다. |
| Bean은 무엇인가? | Spring IoC 컨테이너가 생성·조립·관리하는 객체다. |
| 자동 설정은 무엇인가? | 클래스패스, Bean, 설정을 조건으로 Spring Boot가 합리적인 기본 구성을 등록하는 기능이다. |
| DB는 어디까지 알아야 하는가? | CRUD SQL, 키와 관계, 트랜잭션, JDBC·JPA·Spring Data JPA의 차이를 알아두면 좋다. |
| 오래된 강의는 어떻게 읽는가? | Boot·Java 버전과 `javax`/`jakarta` 차이를 먼저 확인하고 현재 공식 문서와 비교한다. |

---

## 18. 복습 문제

1. Spring Framework와 Spring Boot의 관계를 자신의 말로 설명해 보자.
2. `OrderService`가 `PaymentGateway`를 생성자로 받으면 어떤 장점이 있는가?
3. Bean과 일반 Java 객체는 무엇이 다른가?
4. 클래스패스에 웹 Starter를 추가하면 자동 설정 관점에서 무엇이 달라지는가?
5. `GET /members/1` 요청이 Controller 메서드에 도달하고 JSON 응답이 되기까지의 흐름을 적어 보자.
6. `@RestController`는 평범한 주석과 무엇이 다른가?
7. Maven·Gradle Wrapper를 사용하는 이유는 무엇인가?
8. Spring Boot가 관리하는 의존성 버전을 무작정 따로 덮어쓰면 왜 위험한가?
9. Entity와 요청·응답 DTO를 분리하는 이유를 두 가지 말해 보자.
10. CORS 허용이 인증과 인가를 대신하지 못하는 이유는 무엇인가?
11. Profile과 환경 변수를 사용하는 이유는 무엇인가?
12. 오래된 Boot 2 예제에서 `javax.persistence`를 발견하면 무엇을 확인해야 하는가?

---

## 참고 자료

### Spring Boot 공식 문서

- [Spring Boot System Requirements](https://docs.spring.io/spring-boot/system-requirements.html)
- [Spring Boot - Developing Your First Application](https://docs.spring.io/spring-boot/tutorial/first-application/)
- [Spring Boot - Build Systems](https://docs.spring.io/spring-boot/reference/using/build-systems.html)
- [Spring Boot - Externalized Configuration](https://docs.spring.io/spring-boot/reference/features/external-config.html)
- [Spring Boot - Profiles](https://docs.spring.io/spring-boot/reference/features/profiles.html)
- [Spring Guide - Building an Application with Spring Boot](https://spring.io/guides/gs/spring-boot)
- [Spring Guide - Building a RESTful Web Service](https://spring.io/guides/gs/rest-service/)

### Spring Framework·데이터 공식 문서

- [Spring Framework - The IoC Container](https://docs.spring.io/spring-framework/reference/core/beans.html)
- [Spring Framework - Container Overview](https://docs.spring.io/spring-framework/reference/core/beans/basics.html)
- [Spring Framework - Spring Web MVC](https://docs.spring.io/spring-framework/reference/web/webmvc.html)
- [Spring Framework - Mapping Requests](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html)
- [Spring Guide - Accessing Data with JPA](https://spring.io/guides/gs/accessing-data-jpa/)

> 정리 기준일: 2026-08-21. 버전과 시스템 요구사항은 바뀔 수 있으므로 실제 프로젝트를 시작할 때 해당 버전의 공식 문서를 다시 확인한다.
