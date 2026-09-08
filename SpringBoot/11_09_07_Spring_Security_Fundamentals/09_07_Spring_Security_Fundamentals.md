# Spring Security 첫걸음: 인증·인가와 Controller 앞의 보안 필터

- 🎯 학습 목표: 요청이 Controller에 도착하기 전 거치는 보안 검사를 설명하고, 허용·거부되어야 할 요청을 테스트한다.
- 🧩 핵심 키워드: Authentication, Authorization, SecurityFilterChain, SecurityContext, UserDetailsService, PasswordEncoder, HTTP Basic, CSRF, 401·403
- ⭐ 중요도: ★★★★★ — 화면에서 버튼을 숨기는 것과 서버에서 접근을 거부하는 것은 다르다.
- 📝 한눈에 보는 내용: 사용자 확인과 권한 판단을 분리하고, 공개 조회·본인 정보·관리자 작업을 하나의 작은 예제로 연결한다. 보안 설정은 정상 요청뿐 아니라 거부 경로로도 검증한다.
- 🧱 선수 지식: HTTP 메서드·상태 코드, Bean·생성자 주입, Spring MVC, MockMvc와 통합 테스트
- 🔗 이전 노트: [단위·슬라이스·통합 테스트](../10_09_06_Testing_Strategy/09_06_Testing_Strategy.md)

> 정리 기준일: 2026-09-07. Spring Boot 4.1 계열·Spring Security 7.1 공식 문서를 기준으로 작성했다. 의존성 버전은 Boot가 관리하는 조합을 사용한다. 아래 코드는 별도 로컬 실습 프로젝트용이며, 이 TIL 저장소에서 Java 컴파일·Spring 테스트를 실행한 결과는 아니다. 표의 상태 코드와 실행 건수는 예상 결과다.

## 1. 로그인했는데 왜 접근할 수 없을까?

도서 서비스에서 일반 회원도 책을 검색할 수 있지만, 검색 색인을 다시 만드는 관리 기능은 관리자만 실행해야 한다고 하자. React에서 관리자 버튼을 숨겨도 사용자가 직접 HTTP 요청을 보내면 서버에 도착할 수 있다.

서버는 두 질문에 답해야 한다. 첫째는 “요청한 사람이 누구인가?”, 둘째는 “그 사람이 이 작업을 해도 되는가?”다. 로그인 성공만으로 모든 관리자 기능을 허용하면 두 번째 질문이 빠진다.

이 노트에서는 JWT 발급이나 소셜 로그인보다 먼저 **서버의 보안 판단이 어디에서 일어나는지**를 배운다. 인증 방식이 나중에 바뀌어도 이 구분은 계속 필요하다.

## 2. 인증과 인가를 분리해서 이해한다

### 2.1 인증은 신원 확인, 인가는 작업 허용 판단

인증(authentication)은 제출한 자격 증명으로 신원을 확인하는 과정이다. 아이디와 비밀번호를 확인하는 것이 한 예다. 인가(authorization)는 확인한 사용자와 권한, 대상 자원 등을 바탕으로 작업 허용 여부를 판단하는 과정이다.

| 요청 상황 | 인증 관점 | 인가 관점 |
| --- | --- | --- |
| 비로그인 사용자의 공개 안내 조회 | 신원 확인 없이 진행 가능 | 공개 조회 정책에 따라 허용 |
| 회원 reader의 본인 이름 조회 | reader임을 확인 | 인증된 사용자에게 허용 |
| 회원 reader의 관리자 작업 | reader임은 확인 | ADMIN 권한이 없어 거부 |
| 관리자 librarian의 관리자 작업 | librarian임을 확인 | ADMIN 권한이 있어 허용 |

권한(authority)은 서버가 사용자에게 부여한 허용 정보를 나타낸다. 역할(role)은 여러 업무 권한을 묶어 표현할 때 사용하는 분류다. 이 예제에서는 `USER`, `ADMIN` 역할을 사용하지만, 실제 서비스에서는 `book:write` 같은 세부 권한도 설계할 수 있다.

Spring Security의 기본 역할 규칙에서 `hasRole("ADMIN")`은 `ROLE_ADMIN` authority를 검사한다. 따라서 `roles("ADMIN")`과 `hasRole("ADMIN")`을 짝으로 읽는다. `hasAuthority("ADMIN")`은 문자열 `ADMIN` 자체를 검사하므로 같은 표현이 아니다. [HTTP 인가 공식 문서](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)를 참고한다.

### 2.2 401과 403은 원인까지 같이 읽는다

- **401 Unauthorized**: 이 예제의 HTTP Basic 흐름에서는 인증 정보가 없거나 틀려 인증이 필요하다는 응답이다. 이름과 달리 주로 인증 문제를 먼저 확인한다.
- **403 Forbidden**: 인증된 사용자의 권한이 부족할 수 있다. 하지만 CSRF 검증 실패처럼 별도의 보안 검사에서 거부되어도 403이 나올 수 있다.

모든 애플리케이션에서 “미인증이면 무조건 401”이라고 외우면 곤란하다. 폼 로그인은 로그인 화면으로 302 리다이렉트할 수 있고, 인증보다 앞선 CSRF 검사에서 먼저 거부될 수도 있다. **응답 코드 + 요청 메서드 + 실패한 필터**를 함께 확인한다.

이 노트는 폼 로그인 대신 HTTP Basic을 명시적으로 사용한다. 인증이 필요한 일반 GET 요청에는 `WWW-Authenticate` 헤더가 포함된 401을 기대한다. 브라우저용 요청 헤더나 사용자 정의 EntryPoint가 있으면 응답 방식이 달라질 수 있다. [HTTP Basic 공식 흐름](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/basic.html)을 참고한다.

## 3. Controller 앞에서 무슨 일이 일어나는가?

```text
HTTP 요청
  → 서블릿 컨테이너의 필터 진입
  → DelegatingFilterProxy: Spring이 관리하는 보안 필터에 연결
  → FilterChainProxy: 요청에 맞는 SecurityFilterChain 선택
      → 보안 컨텍스트 준비·공격 방어·인증 등 구성된 필터 실행
      → 인가 판단
  → DispatcherServlet
  → Controller → Service → 응답

중간 보안 검사에서 거부되면 Controller까지 진행하지 않을 수 있다.
```

필터(Filter)는 요청을 다음 처리기로 넘기기 전후에 개입하는 서블릿 구성 요소다. `SecurityFilterChain`은 특정 요청에 적용할 보안 필터들의 구성을 나타낸다. 위 그림은 역할을 이해하기 위한 개요이며, 모든 프로젝트에 동일한 필터 목록이 등록된다는 뜻은 아니다.

여러 보안 체인이 있으면 요청과 처음 일치하는 체인이 선택된다. 체인을 고르는 `securityMatcher`와, 선택된 체인 안에서 접근 규칙을 정하는 `requestMatchers`는 역할이 다르다. 이 예제는 체인 하나를 모든 요청에 적용해 보호 범위가 빠지는 문제를 줄인다.

Controller 예외를 처리하던 `@RestControllerAdvice`만으로 필터 단계의 오류까지 모두 잡을 수는 없다. 인증 시작 응답은 `AuthenticationEntryPoint`, 접근 거부 응답은 `AccessDeniedHandler` 같은 보안 구성 요소가 담당한다. API 오류 형식을 통일할 때도 MVC 오류와 보안 오류를 각각 설계해야 한다. [서블릿 보안 구조](https://docs.spring.io/spring-security/reference/servlet/architecture.html)를 참고한다.

## 4. 인증 정보를 담는 객체와 인증하는 객체

인증 관련 이름이 비슷해도 모두 같은 일을 하지 않는다.

| 구성 요소 | 역할 | 이 예제에서의 의미 |
| --- | --- | --- |
| Authentication | 인증 시도 또는 인증 결과를 표현 | 사용자 이름·권한 등 |
| SecurityContext | 현재 인증 정보를 보관 | 현재 요청의 Authentication을 담음 |
| SecurityContextHolder | 보안 컨텍스트에 접근하는 통로 | 기본적으로 현재 실행 스레드와 연결 |
| AuthenticationManager | 인증 요청을 처리하는 계약 | 적절한 인증 처리기로 연결 |
| AuthenticationProvider | 특정 방식의 실제 인증 처리 | 사용자 조회와 비밀번호 검증에 참여 |
| UserDetailsService | 이름으로 사용자 정보를 조회 | 메모리에서 reader·librarian을 찾음 |
| PasswordEncoder | 비밀번호 해시 생성·일치 검증 | 원문을 그대로 저장하지 않고 비교 |

`UserDetailsService`는 사용자 조회 역할이지, 그 자체가 비밀번호 검증 전체를 책임지는 것은 아니다. 비밀번호 방식의 인증 처리기가 조회한 사용자 정보와 `PasswordEncoder`를 이용해 일치 여부 등을 판단한다.

`Authentication` 객체가 존재한다는 사실만으로 “실제 회원 로그인이 완료됐다”고 단정하지 않는다. 익명 사용자도 보안 객체로 표현될 수 있으므로 임의의 null 검사 대신 보안 규칙과 적절한 API를 사용한다. 비동기 작업에서는 스레드가 바뀌어 컨텍스트 전달도 별도 문제가 된다. [인증 아키텍처](https://docs.spring.io/spring-security/reference/servlet/authentication/architecture.html)를 참고한다.

## 5. 실습 범위와 준비물

### 5.1 이번에 만들 것과 만들지 않을 것

이번 예제는 **새 로컬 웹 프로젝트**에 작성한다. 이전 JPA·대여 예제에 그대로 합치지 않는다. 계정 두 개를 메모리에 두고, 공개 안내·현재 사용자·관리자 모의 작업만 제공한다. 회원가입, DB 사용자 저장, 비밀번호 재설정, 세션 로그인 화면, JWT 발급, 운영용 관리 기능은 구현하지 않는다.

HTTP Basic은 요청에서 아이디·비밀번호 자격 증명을 전달하는 방식이다. Base64 표현은 암호화가 아니므로 외부 네트워크에서는 HTTPS가 필요하다. 여기서는 필터의 인증 흐름을 보기 위한 로컬 실습으로만 사용하며, 브라우저 서비스의 완성된 로그인 설계로 복사하지 않는다.

### 5.2 의존성과 파일 구조

Initializr에서 Maven·Java·Spring Boot 4.1 계열 프로젝트를 만들고 다음 의존성을 확인한다. Java는 선택한 Boot 버전이 지원하는 JDK를 사용한다. 테스트 의존성은 Maven의 `test` scope로 둔다.

| 용도 | 의존성 |
| --- | --- |
| 웹 API | `spring-boot-starter-webmvc` |
| 보안 필터·인증·인가 | `spring-boot-starter-security` |
| 기본 테스트 도구 | `spring-boot-starter-test` |
| MVC 테스트 지원 | `spring-boot-starter-webmvc-test` |
| 보안 테스트 지원 | `spring-boot-starter-security-test` |

버전을 각각 임의로 지정하지 말고 Boot의 의존성 관리를 사용한다. Boot 3의 테스트 import를 그대로 복사하지 않는다. [공식 Starter 목록](https://docs.spring.io/spring-boot/reference/using/build-systems.html)에서 이름을 확인한다.

```text
src/main/java/com/example/securitystudy/
  SecurityStudyApplication.java
  SecurityConfig.java
  StudyController.java
src/main/resources/
  application.yaml
src/test/java/com/example/securitystudy/
  SecurityBoundaryTest.java
```

각 public 클래스는 표시한 이름의 개별 파일로 저장한다. 아래 코드는 이 파일 구조에 맞춘 구성 요소 전체이며, 빌드 파일과 Wrapper는 Initializr에서 준비한다.

`SecurityStudyApplication.java`는 같은 패키지의 설정과 Controller를 찾는 시작점이다.

```java
package com.example.securitystudy; // 실습 구성 요소를 모으는 기준 패키지다.

import org.springframework.boot.SpringApplication; // Boot 애플리케이션 실행 도구다.
import org.springframework.boot.autoconfigure.SpringBootApplication; // 자동 설정과 컴포넌트 스캔을 활성화한다.

@SpringBootApplication // 이 패키지와 하위 패키지에서 Bean을 찾는다.
public class SecurityStudyApplication { // 실습 애플리케이션의 시작 클래스다.
    public static void main(String[] args) { // 직접 실행할 때 진입하는 메서드다.
        SpringApplication.run(SecurityStudyApplication.class, args); // 설정을 읽고 서버와 Bean을 준비한다.
    }
}
```

`application.yaml`은 로컬 접속만 받도록 하고 실습용 비밀번호를 외부에서 전달받는다.

```yaml
server: # 내장 웹 서버 설정이다.
  address: 127.0.0.1 # 학습용 서버가 외부 인터페이스에서 접속을 받지 않게 한다.
demo: # 이 예제에서만 사용하는 사용자 정의 설정 묶음이다.
  security: # 메모리 실습 계정의 입력값을 모은다.
    reader-password: ${DEMO_READER_PASSWORD} # 환경에서 전달받으며 기본 비밀번호는 두지 않는다.
    admin-password: ${DEMO_ADMIN_PASSWORD} # 관리자 실습 비밀번호도 소스에 저장하지 않는다.
```

직접 서버를 실행하려면 IDE 실행 환경 등에 두 환경 변수를 설정한다. 다른 서비스에서 사용하는 실제 비밀번호를 재사용하지 않고, 실행 설정 파일을 Git에 올리지 않는다. 테스트에서는 뒤의 테스트 전용 Property가 이 값을 대신하므로 환경 변수가 필요 없다. 설정 누락으로 시작이 실패하면 `{noop}`이나 하드코딩으로 우회하지 말고 설정 출처를 확인한다.

## 6. 보안 정책을 코드로 옮긴다

### 6.1 허용할 요청부터 적는다

| HTTP 요청 | 정책 | Controller 도달 시 예상 응답 |
| --- | --- | --- |
| `GET /public/info` | 누구나 허용 | 200 안내 JSON |
| `GET /api/me` | 인증된 사용자 | 200 현재 이름 JSON |
| `POST /admin/reindex` | ADMIN 역할 + 유효한 CSRF 토큰 | 204, 본문 없음 |
| 그 외 | 기본 거부 | 보안 단계에서 차단 |

관리자 예제는 색인을 실제로 변경하지 않는 **모의 작업**이다. 보안 허용 여부와 업무 구현의 성공을 혼동하지 않도록 의도적으로 저장 작업을 넣지 않는다.

### 6.2 SecurityConfig.java

아래 설정은 접근 규칙, HTTP Basic, CSRF 보호와 실습 계정을 준비한다. 람다 기반 설정을 사용하고, 예전 `WebSecurityConfigurerAdapter` 상속 형태는 사용하지 않는다.

```java
package com.example.securitystudy; // 시작 클래스가 찾을 수 있는 패키지다.

import org.springframework.beans.factory.annotation.Value; // 외부 설정 값을 Bean 메서드의 인자로 받는다.
import org.springframework.context.annotation.Bean; // 반환 객체를 Spring Bean으로 등록한다.
import org.springframework.context.annotation.Configuration; // Bean 등록 설정 클래스임을 표시한다.
import org.springframework.http.HttpMethod; // 접근 규칙에서 HTTP 메서드를 구분한다.
import org.springframework.security.config.Customizer; // 특정 보안 기능의 기본 설정을 적용한다.
import org.springframework.security.config.annotation.web.builders.HttpSecurity; // 서블릿 보안 체인을 구성한다.
import org.springframework.security.core.userdetails.User; // 실습 사용자 정보를 만드는 빌더를 제공한다.
import org.springframework.security.core.userdetails.UserDetails; // 인증에 필요한 사용자 정보의 계약이다.
import org.springframework.security.core.userdetails.UserDetailsService; // 이름으로 사용자 정보를 조회하는 계약이다.
import org.springframework.security.crypto.factory.PasswordEncoderFactories; // 기본 위임형 비밀번호 인코더를 만든다.
import org.springframework.security.crypto.password.PasswordEncoder; // 비밀번호 해시 생성·비교 역할이다.
import org.springframework.security.provisioning.InMemoryUserDetailsManager; // 사용자 정보를 메모리에서 조회한다.
import org.springframework.security.web.SecurityFilterChain; // 완성한 보안 필터 구성을 나타낸다.

@Configuration(proxyBeanMethods = false) // Bean 메서드끼리 직접 호출하지 않고 필요한 Bean을 인자로 받는다.
public class SecurityConfig { // 이 작은 실습 프로젝트에만 적용할 보안 설정이다.
    @Bean // 모든 요청을 대상으로 하는 체인 하나를 등록한다.
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception { // Boot가 준비한 설정 도구를 받는다.
        http.authorizeHttpRequests(authorize -> authorize // 요청별 접근 허용 규칙을 순서대로 선언한다.
                .requestMatchers(HttpMethod.GET, "/public/info").permitAll() // 공개 안내의 GET만 누구나 허용한다.
                .requestMatchers(HttpMethod.GET, "/api/me").authenticated() // 현재 사용자 조회는 인증이 필요하다.
                .requestMatchers(HttpMethod.POST, "/admin/reindex").hasRole("ADMIN") // 관리자 모의 작업에는 ROLE_ADMIN이 필요하다.
                .anyRequest().denyAll() // 명시하지 않은 요청을 실수로 공개하지 않는다.
        ); // 인가 규칙 설정을 끝낸다.
        http.httpBasic(Customizer.withDefaults()); // Basic 인증 필터와 인증 필요 응답을 구성한다.
        http.csrf(Customizer.withDefaults()); // 기본 CSRF 보호를 유지하며 변경 요청의 토큰을 검사한다.
        return http.build(); // 위 설정으로 필터 체인을 만들어 반환한다.
    }

    @Bean // 사용자 등록과 인증 비교에서 사용할 인코더를 등록한다.
    PasswordEncoder passwordEncoder() { // 원문 비밀번호를 그대로 저장하는 인코더를 쓰지 않는다.
        return PasswordEncoderFactories.createDelegatingPasswordEncoder(); // 알고리즘 식별자를 포함하는 해시 형식을 사용한다.
    }

    @Bean // 이 예제의 사용자 정보 조회기를 등록한다.
    UserDetailsService userDetailsService( // 인증 처리기가 사용자 이름으로 이 조회기를 사용한다.
            PasswordEncoder encoder, // 위에서 등록한 인코더를 주입받는다.
            @Value("${demo.security.reader-password}") String readerPassword, // 실습 회원의 비밀번호를 외부 설정에서 받는다.
            @Value("${demo.security.admin-password}") String adminPassword // 실습 관리자의 비밀번호를 외부 설정에서 받는다.
    ) { // 메모리 계정을 준비한다. 운영 회원 관리 구현이 아니다.
        UserDetails reader = User.withUsername("reader") // 일반 회원 계정을 구성한다.
                .password(encoder.encode(readerPassword)) // 비밀번호를 해시한 결과를 사용자 정보에 저장한다.
                .roles("USER") // ROLE_USER authority를 부여한다.
                .build(); // 사용자 정보 객체를 완성한다.
        UserDetails librarian = User.withUsername("librarian") // 관리자 실습 계정을 구성한다.
                .password(encoder.encode(adminPassword)) // 관리자 비밀번호도 같은 형식으로 해시한다.
                .roles("USER", "ADMIN") // 필요한 두 역할을 명시적으로 부여한다.
                .build(); // 관리자 사용자 정보를 완성한다.
        return new InMemoryUserDetailsManager(reader, librarian); // 두 사용자를 조회할 메모리 구현을 반환한다.
    }
}
```

규칙은 위에서부터 처음 일치한 항목을 사용한다. 따라서 광범위한 공개 규칙을 앞에 두면 뒤의 관리자 규칙에 도달하지 않을 수 있다. `permitAll()`은 해당 요청의 인가를 허용하는 것이지, CSRF 등 모든 보안 필터를 건너뛰는 설정이 아니다.

관리자 역할이 일반 회원 역할을 자동 상속한다고도 가정하지 않는다. 위에서는 두 역할을 직접 부여했다. 실제 계층 관계가 필요하면 별도로 설계한다.

`InMemoryUserDetailsManager`는 애플리케이션 재시작 뒤에도 유지되는 회원 DB가 아니다. 여기서는 인증 흐름만 분리해 배우기 위한 도구다. 비밀번호를 해시해도 원문이 소스나 로그에 있으면 보호할 수 없으므로 입력과 저장 양쪽을 관리한다. [메모리 사용자 공식 문서](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/in-memory.html)를 참고한다.

### 6.3 비밀번호는 다시 암호화해서 문자열로 비교하지 않는다

비밀번호 해시는 원문 복원을 목적으로 하는 암호화와 다르다. BCrypt 등은 salt 때문에 같은 원문을 처리해도 서로 다른 해시가 나올 수 있다. 따라서 로그인 때 `encode(입력).equals(저장값)`으로 비교하지 않고 `matches(입력, 저장값)` 역할을 이용한다. 이 예제에서는 인증 처리기가 인코더를 사용하므로 Controller가 직접 비교하지 않는다.

위임형 인코더의 `{bcrypt}` 같은 접두사는 비교에 사용할 알고리즘을 식별하는 정보이지 비밀 키가 아니다. 이미 해시한 값을 다시 등록 단계에서 해시하면 사용자의 원래 입력과 맞지 않을 수 있다. 운영에서는 회원가입·비밀번호 변경 시의 해시 저장, 작업 비용, 유출 대응까지 별도 설계한다. [Password Storage 공식 문서](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)를 참고한다.

## 7. Controller는 허용된 요청의 업무를 처리한다

`StudyController.java`는 보안 필터를 통과한 요청에 응답한다. `/api/me`에서는 클라이언트가 임의로 보낸 이름 대신 서버가 인증한 `Principal`을 사용한다.

```java
package com.example.securitystudy; // 보안 설정과 같은 스캔 범위에 둔다.

import java.security.Principal; // 인증된 주체의 이름을 읽는 표준 인터페이스다.
import java.util.Map; // 간단한 응답 JSON의 필드를 구성한다.
import org.springframework.http.ResponseEntity; // 상태와 본문을 명시하는 응답 타입이다.
import org.springframework.web.bind.annotation.GetMapping; // GET 경로를 선언한다.
import org.springframework.web.bind.annotation.PostMapping; // POST 경로를 선언한다.
import org.springframework.web.bind.annotation.RestController; // 반환값을 HTTP 본문으로 변환한다.

@RestController // MVC 요청을 처리하는 Bean으로 등록한다.
public class StudyController { // 업무 저장 없이 보안 경계만 확인하는 실습 Controller다.
    @GetMapping("/public/info") // 공개 GET 요청을 처리한다.
    public Map<String, String> info() { // 이 경로에는 인증된 사용자 정보가 필요 없다.
        return Map.of("message", "도서 서비스 안내"); // 민감 정보가 없는 고정 안내를 반환한다.
    }

    @GetMapping("/api/me") // 보안 설정에서 인증을 요구하는 경로다.
    public Map<String, String> me(Principal principal) { // MVC가 현재 인증 주체를 전달한다.
        return Map.of("username", principal.getName()); // 비밀번호나 인증 객체 전체를 직렬화하지 않는다.
    }

    @PostMapping("/admin/reindex") // ADMIN과 CSRF 조건을 통과한 요청만 이 메서드에 도달한다.
    public ResponseEntity<Void> reindex() { // 실제 색인·DB 작업을 수행하지 않는 모의 기능이다.
        return ResponseEntity.noContent().build(); // 본문 없는 204 응답으로 도달 여부를 확인한다.
    }
}
```

`GET /api/me`의 입력은 이름 문자열이 아니라 인증된 요청이다. 필터가 인증 결과를 연결하고, MVC가 그 주체를 메서드 인자로 전달한다. 허용 정책을 지우고 비로그인 접근까지 열면 `principal`이 없을 수 있으므로 Controller와 보안 계약을 함께 변경·검증해야 한다.

관리자 조건을 통과했다는 사실도 모든 책에 대한 소유권을 증명하지는 않는다. `/loans/{id}` 같은 기능에서는 현재 사용자가 그 대여 기록의 소유자인지도 Service·조회 조건 등에서 검사해야 한다. URL의 ID나 요청 본문의 `userId`를 신뢰해 권한을 결정하지 않는다.

## 8. POST가 403이면 CSRF를 먼저 끄면 될까?

### 8.1 로그인 상태와 요청 의도는 다른 문제다

CSRF(Cross-Site Request Forgery)는 브라우저가 인증 정보를 자동으로 보내는 성질 등을 이용해 사용자가 원하지 않은 요청을 보내게 하는 공격이다. 서버가 사용자를 알아봤다는 사실과 사용자가 해당 변경을 의도했다는 사실은 다르다.

CSRF 토큰은 서버 측 기대값과 요청이 전달한 값을 확인하는 방어 수단이다. 로그인 비밀번호나 API 접근 토큰과는 용도가 다르다. 이 예제는 기본 보호를 유지하므로 관리자라도 토큰 없는 POST는 403을 기대한다. GET은 조회로만 사용하고 상태를 바꾸지 않는다.

“REST API다”, “세션을 사용하지 않는다”는 말만으로 CSRF가 사라지는 것은 아니다. 브라우저가 실제로 어떤 자격 증명을 자동 전송하는지 확인해야 한다. Basic 인증도 브라우저 사용 방식에 따라 이 문제를 검토해야 한다. JWT를 쿠키에 넣는 경우 역시 토큰 형식만 보고 CSRF를 끄면 안 된다. [CSRF 공식 문서](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)를 참고한다.

### 8.2 이번 예제에서 확인할 세 가지

1. USER + 유효한 CSRF 토큰: CSRF를 통과해도 ADMIN이 없으므로 관리자 작업 거부.
2. ADMIN + 토큰 없음 또는 잘못된 토큰: 역할이 있어도 CSRF 검증에서 거부.
3. ADMIN + 유효한 CSRF 토큰: 두 조건을 모두 만족하면 Controller가 204 반환.

이 구분을 하지 않고 성공시키려고 필터를 끄면 검증하고 싶었던 보안 기능 자체가 테스트에서 사라진다. 아래 `csrf()`는 MockMvc 테스트 도우미다. 실제 브라우저가 토큰을 발급받고 전달하는 화면·SPA 흐름을 구현한 것은 아니다.

## 9. 성공뿐 아니라 거부되어야 할 요청을 테스트한다

### 9.1 인증된 사용자를 준비하는 테스트와 인증 자체의 테스트

`@WithMockUser`는 테스트 보안 컨텍스트에 사용자를 준비한다. 실제 계정 조회나 비밀번호 검증을 수행해 로그인한 결과는 아니다. 따라서 접근 규칙을 분리해서 확인할 때 적합하다. [MockMvc 사용자 준비](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/authentication.html)를 참고한다.

반면 `httpBasic()`은 요청의 Basic 인증 헤더를 준비한다. 뒤의 두 테스트는 실제 필터·사용자 조회기·인코더가 올바른 비밀번호와 잘못된 비밀번호를 구분하는지 확인하도록 작성한다. 이 경우에는 `@WithMockUser`를 붙이지 않는다. [HTTP Basic 테스트](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/http-basic.html)를 참고한다.

### 9.2 SecurityBoundaryTest.java

전체 구성을 불러오되 실제 서버 포트는 열지 않는 MockMvc 테스트다. 필터를 제거하는 `addFilters = false`는 사용하지 않는다. 테스트 Property의 문자열은 이 테스트에서만 사용하는 가짜 값이며 실제 계정 자격 증명이 아니다.

```java
package com.example.securitystudy; // 시작 설정을 찾을 수 있는 테스트 패키지다.

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf; // 테스트 요청에 CSRF 토큰을 준비한다.
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic; // Basic 인증 헤더를 준비한다.
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get; // GET 요청을 만든다.
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post; // POST 요청을 만든다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header; // 응답 헤더를 검증한다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath; // JSON 필드를 검증한다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status; // HTTP 상태를 검증한다.

import org.junit.jupiter.api.Test; // JUnit 테스트 메서드를 선언한다.
import org.springframework.beans.factory.annotation.Autowired; // 테스트 문맥의 MockMvc를 받는다.
import org.springframework.boot.test.context.SpringBootTest; // 애플리케이션 전체 설정을 불러온다.
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc; // Boot 4의 MVC 테스트 구성을 추가한다.
import org.springframework.security.test.context.support.WithMockUser; // 인가 검사에 사용할 테스트 사용자를 준비한다.
import org.springframework.test.web.servlet.MockMvc; // 보안 필터와 MVC를 통해 요청을 실행한다.

@SpringBootTest(properties = { // 실제 환경 변수 대신 테스트 전용 값으로 메모리 계정을 만든다.
        "demo.security.reader-password=reader-test-only", // 실제 서비스에서 사용하지 않는 테스트 입력이다.
        "demo.security.admin-password=admin-test-only" // 관리자 실습 계정 생성에만 쓰는 테스트 입력이다.
}) // 기본 MOCK 환경이므로 실제 네트워크 포트를 열지 않는다.
@AutoConfigureMockMvc // 등록된 보안 필터를 포함한 MVC 테스트 도구를 구성한다.
class SecurityBoundaryTest { // 인가·CSRF·실제 Basic 인증을 구분해 검사한다.
    @Autowired // 테스트 문맥이 만든 도구를 주입받는다.
    private MockMvc mvc; // 모든 테스트가 요청을 수행할 도구다.

    @Test // 공개 계약을 확인한다.
    void 공개_조회는_인증없이_허용한다() throws Exception { // 인증 헤더나 mock 사용자를 준비하지 않는다.
        mvc.perform(get("/public/info")) // 공개 경로로 GET 요청을 보낸다.
                .andExpect(status().isOk()) // 200으로 허용되어야 한다.
                .andExpect(jsonPath("$.message").value("도서 서비스 안내")); // 공개 응답을 확인한다.
    }

    @Test // 인증이 필요한 경로의 미인증 요청을 검사한다.
    void 미인증_본인조회는_401이다() throws Exception { // 일반 요청으로 Basic 인증 필요 응답을 확인한다.
        mvc.perform(get("/api/me")) // 자격 증명 없이 보호된 조회를 요청한다.
                .andExpect(status().isUnauthorized()) // 401이 반환되어야 한다.
                .andExpect(header().exists("WWW-Authenticate")); // 클라이언트에 인증 방식을 알리는 헤더를 확인한다.
    }

    @Test // 인증 상태가 준비된 사용자에게 조회를 허용하는지 검사한다.
    @WithMockUser(username = "reader", roles = "USER") // 비밀번호 인증 없이 테스트 주체를 준비한다.
    void 회원은_자기_이름을_조회한다() throws Exception { // 실제 Controller의 Principal 연결까지 검사한다.
        mvc.perform(get("/api/me")) // 준비한 사용자로 조회한다.
                .andExpect(status().isOk()) // 인증 사용자이므로 허용한다.
                .andExpect(jsonPath("$.username").value("reader")); // 요청 입력이 아닌 현재 주체의 이름이어야 한다.
    }

    @Test // CSRF와 별개인 역할 부족을 검사한다.
    @WithMockUser(roles = "USER") // 일반 회원 권한만 준비한다.
    void 회원은_토큰이_있어도_관리작업을_못한다() throws Exception { // 유효 토큰으로 CSRF 실패 원인을 제거한다.
        mvc.perform(post("/admin/reindex").with(csrf())) // 토큰은 맞지만 ADMIN이 없는 요청이다.
                .andExpect(status().isForbidden()); // 인가 조건 부족으로 403을 기대한다.
    }

    @Test // 관리자도 CSRF 보호 대상인지 검사한다.
    @WithMockUser(roles = "ADMIN") // 이번에는 관리자 권한을 준비한다.
    void 관리자는_토큰이_없으면_거부된다() throws Exception { // 토큰을 일부러 추가하지 않는다.
        mvc.perform(post("/admin/reindex")) // CSRF 토큰 없는 변경 요청이다.
                .andExpect(status().isForbidden()); // ADMIN이어도 403으로 거부해야 한다.
    }

    @Test // 토큰의 존재뿐 아니라 유효성도 검사하는지 확인한다.
    @WithMockUser(roles = "ADMIN") // 역할 부족이 아닌 토큰 오류를 만든다.
    void 잘못된_CSRF_토큰도_거부한다() throws Exception { // 도우미로 불일치하는 토큰을 준비한다.
        mvc.perform(post("/admin/reindex").with(csrf().useInvalidToken())) // 잘못된 토큰을 전송한다.
                .andExpect(status().isForbidden()); // 토큰이 있다는 이유만으로 허용하면 안 된다.
    }

    @Test // 인가와 CSRF를 모두 만족하는 요청을 확인한다.
    @WithMockUser(roles = "ADMIN") // 관리자 역할을 준비한다.
    void 관리자는_유효토큰으로_모의작업을_실행한다() throws Exception { // 두 보안 조건이 모두 맞다.
        mvc.perform(post("/admin/reindex").with(csrf())) // 유효 CSRF 토큰을 추가한다.
                .andExpect(status().isNoContent()); // Controller가 모의 작업의 204를 반환해야 한다.
    }

    @Test // 명시하지 않은 경로의 기본 거부를 검사한다.
    @WithMockUser(roles = "ADMIN") // 관리자도 명시하지 않은 경로를 자동 허용받지 않는다.
    void 미등록_경로는_기본_거부한다() throws Exception { // 단순 404보다 앞선 보안 정책을 검사한다.
        mvc.perform(get("/unlisted")) // 어떤 허용 matcher에도 해당하지 않는다.
                .andExpect(status().isForbidden()); // anyRequest().denyAll()에 따라 차단된다.
    }

    @Test // 실제 Basic 인증 성공 경로를 검사한다.
    void 올바른_비밀번호로_실제_인증한다() throws Exception { // WithMockUser 없이 인증 필터를 거친다.
        mvc.perform(get("/api/me").with(httpBasic("reader", "reader-test-only"))) // 테스트 계정의 올바른 자격 증명이다.
                .andExpect(status().isOk()) // 사용자 조회와 비밀번호 검증이 성공해야 한다.
                .andExpect(jsonPath("$.username").value("reader")); // 인증된 주체가 reader인지 확인한다.
    }

    @Test // 실제 비밀번호 불일치를 검사한다.
    void 틀린_비밀번호는_401이다() throws Exception { // 인증된 사용자를 미리 주입하지 않는다.
        mvc.perform(get("/api/me").with(httpBasic("reader", "wrong-test-only"))) // 저장한 테스트 비밀번호와 다르다.
                .andExpect(status().isUnauthorized()); // Controller로 진행하지 않고 인증을 거부해야 한다.
    }
}
```

CSRF 테스트 도우미는 유효 토큰과 잘못된 토큰을 따로 준비할 수 있다. 위 테스트가 통과하더라도 실제 브라우저의 토큰 전달, TLS, DB 사용자 저장, 로그인 시도 제한까지 확인했다고 말하면 안 된다. [CSRF 테스트 공식 문서](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/csrf.html)를 참고한다.

### 9.3 실습 실행과 예상 결과

별도 Maven 실습 프로젝트 루트의 PowerShell에서 실행한다. 이 TIL 저장소에는 Maven Wrapper가 없다.

```powershell
# 보안 경계 테스트 클래스의 테스트 10개를 실행한다.
./mvnw.cmd '-Dtest=SecurityBoundaryTest' test

# 해당 실습 프로젝트의 다른 테스트까지 함께 확인한다.
./mvnw.cmd test
```

첫 명령에서 위 클래스의 테스트 10개가 통과하는 것이 목표다. 이것은 예상 구성이지 이번 문서 작성 중 얻은 실행 로그가 아니다. IDE에서 보안 필터와 Controller에 중단점을 두면, 거부된 POST가 Controller에 도달하지 않는 이유를 추가로 관찰할 수 있다.

필터를 끄거나 관리자 규칙을 `permitAll()`로 바꿨을 때 거부 테스트가 실패하는지도 실습 프로젝트에서 확인한다. 확인 뒤 원래 정책으로 복원한다. 성공 테스트만 있는 구성보다 정책 완화를 발견하기 쉽다.

## 10. CORS·세션·JWT를 한 문제로 섞지 않는다

CORS는 브라우저의 교차 출처 요청·응답 접근 정책이다. 인증은 요청자의 신원, 인가는 허용된 작업, CSRF 방어는 자동으로 실린 자격 증명을 악용하는 요청에 대한 방어를 다룬다. CORS 허용을 추가했다고 비로그인 사용자가 인증되는 것은 아니다.

프런트엔드와 서버의 출처가 다르면 preflight 요청이 인증 처리보다 먼저 적절히 처리되도록 CORS와 Security를 연결해야 한다. 허용 origin·메서드·헤더를 실제 필요에 맞춰 지정하고, 문제를 숨기려고 모든 요청을 공개하지 않는다. 이번 실습은 교차 출처 브라우저 연동을 포함하지 않는다. [Spring Security CORS 연동](https://docs.spring.io/spring-security/reference/servlet/integrations/cors.html)을 참고한다.

세션은 서버 측 상태를 연결하는 방식이고 JWT는 토큰 형식이다. 어느 쪽을 선택하든 서버의 검증과 인가 규칙은 필요하다. JWT 문자열의 내용을 단순 디코딩한 것과 서명·발급자·대상·만료 등을 검증한 것은 다르다. 다음에 토큰 인증을 확장할 때도 검증된 보안 지원을 사용하고, 이번 Basic 예제에 임의의 JWT 필터를 붙여 완성된 인증 시스템이라고 간주하지 않는다.

## 11. URL 접근 통제 다음에는 업무 자원 권한을 확인한다

`GET /api/me`처럼 현재 사용자 자신만 표현하는 예제는 단순하다. 그러나 대여 ID를 받는 기능이라면 USER 역할이 있어도 다른 회원의 대여 내역은 읽으면 안 된다. URL 규칙은 업무 자원의 소유권·조직 경계까지 자동으로 추론하지 못한다.

메서드 보안은 Service 등의 메서드 호출에 권한 검사를 추가하는 기능이다. `@EnableMethodSecurity`로 활성화하고 `@PreAuthorize` 등을 사용하는 방식이 있다. 다만 프록시를 거치지 않는 내부 호출 등의 한계를 함께 이해해야 하며, 이번 예제에는 메서드 보안을 활성화하지 않았다. [메서드 보안 공식 문서](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)를 참고한다.

실제 업무로 확장할 때는 다음을 요구사항과 함께 정한다.

- 대상 데이터의 소유자·조직을 서버에서 확인하는 위치
- 다른 사용자의 ID로 요청했을 때의 거부 테스트
- 관리자 권한 부여·회수와 감사 기록
- 인증 실패 횟수 제한과 비밀번호 재설정
- HTTPS·쿠키 속성·세션 또는 토큰 수명주기

이는 이번 입문 실습의 완성 범위를 넘어서는 후속 과제다.

## 12. 문제가 생기면 무엇부터 볼까?

| 증상 | 확인할 질문 |
| --- | --- |
| 이전에는 200인데 Security 추가 뒤 401 | 이 경로는 공개인가, 인증 정보는 전달했는가? |
| 로그인 화면으로 302 이동 | 폼 로그인 설정과 EntryPoint, 요청의 응답 선호 조건은 무엇인가? |
| 관리자인데 POST만 403 | 역할 문자열뿐 아니라 CSRF 토큰도 유효한가? |
| `hasRole`이 예상과 다름 | `ROLE_` 접두사와 실제 authority를 혼동했는가? |
| 모든 요청이 공개됨 | 광범위한 permitAll 규칙이 앞에 있거나 보호 체인에서 빠졌는가? |
| WithMockUser 테스트만 성공 | 실제 사용자 조회·해시 형식·비밀번호 인증 테스트가 있는가? |
| 오류 JSON 형식이 MVC와 다름 | 필터 단계의 EntryPoint·AccessDeniedHandler를 별도로 설계했는가? |
| 브라우저만 실패 | preflight·origin·쿠키 전송 조건과 서버 보안 응답을 구별했는가? |

로그에 Authentication 객체 전체, Authorization 헤더, 쿠키, 비밀번호를 출력하지 않는다. 로컬 가짜 데이터로 요청 메서드·경로·상태와 어느 검사에서 거부됐는지 필요한 정보만 관찰한다.

## 13. 이전·다음 학습 연결

이전 [테스트 전략](../10_09_06_Testing_Strategy/09_06_Testing_Strategy.md)에서는 MVC와 업무 계층의 검증 범위를 나눴다. 이번에는 그 앞에 보안 필터가 추가되었다. 같은 MockMvc 도구를 사용해도 필터를 포함하는지, 인증 결과를 주입하는지, 실제 비밀번호 인증을 거치는지에 따라 검증 범위가 달라진다.

다음 로드맵은 [운영 기초: 로깅·Actuator·상태 점검](../12_09_08_Operations_Logging_and_Actuator/09_08_Operations_Logging_and_Actuator.md)이다. 서버가 살아 있는지 확인하는 기능도 공개 범위와 민감 정보 노출을 함께 설계해야 하므로 이번의 기본 거부·권한 검사 원칙을 이어서 적용한다.

## 14. 요약 정리

1. 인증은 신원을 확인하고, 인가는 요청한 작업의 허용 여부를 판단한다.
2. 보안 필터에서 거부되면 요청은 Controller까지 도달하지 않을 수 있다.
3. SecurityContext는 인증 정보를 담고 UserDetailsService는 사용자 조회를 담당한다.
4. hasRole의 기본 ROLE_ 접두사와 authority 문자열 비교를 구별한다.
5. 공개할 메서드·경로를 명시하고 나머지는 기본 거부하는 정책을 테스트한다.
6. 비밀번호 해시 비교는 새 해시 문자열의 equals가 아니라 matches 역할을 이용한다.
7. 403은 권한 부족뿐 아니라 CSRF 실패일 수 있으므로 실패 위치를 함께 본다.
8. WithMockUser는 인증 결과 준비이고 httpBasic 테스트는 실제 인증 경로를 확인한다.
9. CORS·인증·인가·CSRF는 서로 다른 문제이며 한 설정으로 대신하지 않는다.
10. URL 권한 외에도 업무 데이터의 소유권과 운영상의 보호 조치를 별도로 설계한다.

## 15. 미니 퀴즈

1. 관리 버튼을 숨겼는데 왜 서버에서도 인가 검사가 필요한가?
2. `hasRole("ADMIN")`과 `hasAuthority("ADMIN")`이 기본 설정에서 다른 이유는 무엇인가?
3. 관리자 POST의 403을 보고 권한만 추가하면 해결된다고 할 수 있는가?
4. `@WithMockUser` 테스트가 통과하면 실제 비밀번호 인증도 통과했다고 할 수 있는가?
5. 공개 경로의 `permitAll()`이 CSRF 필터까지 제거하는가?
6. 같은 비밀번호를 두 번 encode한 문자열이 달라졌다면 비밀번호 검증은 어떻게 해야 하는가?
7. USER 역할을 가진 사용자가 다른 회원의 대여 ID로 조회할 때 추가로 무엇을 검사해야 하는가?

<details>
<summary>정답과 해설</summary>

1. 클라이언트 화면과 무관하게 HTTP 요청을 직접 보낼 수 있기 때문이다. 신뢰 경계인 서버가 허용 여부를 판단해야 한다.
2. 전자는 기본적으로 ROLE_ADMIN을 검사하고 후자는 ADMIN 문자열을 그대로 검사한다.
3. 아니다. CSRF 토큰 누락·불일치 같은 다른 거부 원인도 있다. 메서드·토큰·역할·필터 위치를 함께 확인한다.
4. 아니다. 인증 상태를 테스트에서 준비한 것이다. 사용자 조회와 비밀번호 검증을 거치는 테스트를 따로 둔다.
5. 아니다. 인가 규칙에서 접근을 허용하는 것이지 다른 보안 필터를 우회하는 것이 아니다.
6. salt 등으로 새 해시가 달라질 수 있다. 입력 원문과 저장된 해시를 PasswordEncoder의 matches 역할로 비교한다.
7. 인증된 사용자가 해당 자원의 소유자인지, 해당 조직·업무 범위에 접근할 수 있는지 서버에서 검사하고 거부 경로도 테스트한다.

</details>
