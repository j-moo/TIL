# Spring Initializr로 첫 Spring Boot 프로젝트 만들고 실행하기

- 🎯 글의 목표: Spring Initializr의 선택 항목을 이해하고, 생성된 프로젝트 구조·빌드 Wrapper·시작 클래스·실행 로그를 읽으며 첫 HTTP 응답까지 확인한다.
- 🧩 핵심 키워드: Spring Initializr, Maven, Gradle, Wrapper, Starter, `@SpringBootApplication`, 컴포넌트 스캔, 내장 서버, 실행 가능한 JAR
- ⭐ 중요도: ★★★★★ — 프로젝트 생성 옵션과 실행 구조를 이해하면 이후 오류가 Java·빌드·Spring 설정·HTTP 중 어디에서 발생했는지 구분할 수 있다.
- 📝 한눈에 보는 내용: Initializr는 선택한 버전과 의존성에 맞는 프로젝트 뼈대를 만든다. Wrapper로 빌드와 테스트를 재현하고, `SpringApplication.run()`이 ApplicationContext와 내장 서버를 시작하면 Controller를 통해 첫 JSON 응답을 확인한다.
- 🔗 관련 주제: Java 패키지, Maven·Gradle, IoC·DI·Bean, Spring MVC, HTTP·JSON
- 🧱 선수 지식: Java 클래스·패키지·애너테이션, HTTP 요청·응답, 빌드 도구의 역할

---

## 1. 들어가며

Spring Boot 프로젝트는 IDE에서 실행 버튼을 누르면 서버가 켜지는 것처럼 보인다. 하지만 문제가 생겼을 때 해결하려면 그 사이에 어떤 단계가 있는지 알아야 한다.

```text
Initializr에서 프로젝트 조건 선택
        ↓
프로젝트 압축 파일 생성·해제
        ↓
Wrapper로 의존성 다운로드와 테스트
        ↓
main()에서 SpringApplication.run() 실행
        ↓
ApplicationContext와 Bean 구성
        ↓
내장 웹 서버 시작
        ↓
HTTP 요청을 Controller로 전달
        ↓
Java 객체를 JSON 응답으로 변환
```

이 문서의 목표는 기능을 많이 만드는 것이 아니다. **빈 프로젝트가 왜 실행되는지**, **성공 로그에서 무엇을 확인해야 하는지**, **첫 오류가 나면 어느 단계부터 볼지**를 익히는 것이다.

> 이 문서는 2026년 8월 25일의 Spring Boot 4.1 계열 공식 문서를 확인해 작성했다. 실제 프로젝트에서는 강의·팀이 지정한 버전과 해당 버전의 공식 문서를 우선한다.

## 2. 만들기 전에 환경부터 확인한다

### 2.1 JDK 확인

PowerShell에서 다음 명령을 실행한다.

```powershell
java -version
javac -version
```

- `java`는 컴파일된 애플리케이션을 실행한다.
- `javac`는 Java 소스 코드를 컴파일한다.
- 두 명령의 주요 버전이 다르면 IDE와 터미널이 서로 다른 JDK를 사용할 가능성을 확인한다.

현재 Spring Boot 4.1 공식 문서는 Java 17 이상을 기준으로 안내하지만, 버전별 요구사항은 달라질 수 있다. Initializr에서 선택할 Spring Boot 버전의 [System Requirements](https://docs.spring.io/spring-boot/system-requirements.html)를 다시 확인한다.

### 2.2 작업 폴더 경로

초기 학습에서는 다음 경로를 피하면 도구 문제를 줄이기 쉽다.

- 지나치게 긴 경로
- 압축 파일 안에서 바로 연 프로젝트
- 동기화 프로그램이 빌드 폴더를 계속 잠그는 경로
- 읽기·쓰기 권한이 없는 경로

압축을 해제한 뒤 `pom.xml` 또는 `build.gradle`이 보이는 폴더를 프로젝트 루트로 연다.

```text
잘못 연 경우
workspace/
└─ demo/          ← 실제 프로젝트 루트
   └─ pom.xml

올바르게 열 위치
demo/
├─ pom.xml
├─ mvnw.cmd
└─ src/
```

## 3. Spring Initializr는 무엇을 만들어 주는가

[Spring Initializr](https://start.spring.io/)는 선택한 조건을 바탕으로 Spring Boot 프로젝트의 기본 파일을 생성한다.

Initializr가 해 주는 일:

- Spring Boot와 Java 버전에 맞는 빌드 설정 생성
- Group·Artifact를 기반으로 패키지와 프로젝트 이름 구성
- 선택한 Starter 의존성 등록
- Maven 또는 Gradle Wrapper 포함
- 시작 클래스와 기본 테스트 생성
- `src/main`, `src/test`, `resources` 디렉터리 구성

Initializr는 애플리케이션의 비즈니스 기능을 완성해 주지 않는다. **일관된 출발점**을 만들어 주는 도구다.

## 4. Initializr 선택 항목 이해하기

입문용 웹 API 프로젝트의 예시 선택은 다음과 같다.

| 항목 | 예시 | 의미와 선택 기준 |
| --- | --- | --- |
| Project | Maven | 강의·팀에서 사용하는 빌드 도구를 우선한다. |
| Language | Java | 현재 학습 언어 |
| Spring Boot | 지정된 안정 버전 | `SNAPSHOT`, `M` 표시는 목적을 모르면 피한다. |
| Group | `com.example` | 조직·도메인을 나타내는 패키지 접두사 |
| Artifact | `study-api` | 빌드 결과물과 프로젝트 이름의 기준 |
| Name | `study-api` | 사람이 읽는 프로젝트 이름 |
| Description | 학습 API 설명 | 프로젝트 목적을 짧게 기록 |
| Package name | `com.example.studyapi` | Java 클래스가 속할 루트 패키지 |
| Packaging | Jar | 내장 서버와 함께 실행하기 쉬운 기본 선택 |
| Java | 설치 JDK와 호환되는 버전 | Boot 요구사항·팀 환경과 맞춘다. |
| Dependencies | Spring Web | 첫 MVC 기반 HTTP API에 필요한 구성 |

### 4.1 Maven과 Gradle 중 무엇을 고를까

둘 다 의존성 다운로드, 컴파일, 테스트, 패키징을 수행한다.

```text
Maven
  └─ pom.xml, 정해진 생명주기, XML 설정

Gradle
  └─ build.gradle(.kts), task 기반, Groovy·Kotlin DSL
```

입문 단계에서는 둘의 우열을 결정하기보다 팀과 강의가 사용하는 하나에 집중한다. 이 문서는 Windows PowerShell의 Maven Wrapper 명령을 주 예시로 사용하고 Gradle 명령을 함께 적는다.

### 4.2 안정 버전 표기 읽기

Initializr에는 안정 버전 외에 다음 표기가 보일 수 있다.

| 표기 | 일반적인 의미 | 입문 선택 |
| --- | --- | --- |
| 숫자만 있는 정식 버전 | 일반 사용을 위한 릴리스 | 강의 조건과 맞으면 선택 |
| `SNAPSHOT` | 개발 중인 다음 빌드 | 특별한 검증 목적이 아니면 피함 |
| `M1`, `M2` 등 | 마일스톤 사전 공개 | 새 기능 검증 목적이 아니면 피함 |
| `RC` | 정식 출시 전 후보 | 호환성 검증이 필요할 수 있음 |

최신 숫자가 항상 팀 프로젝트의 최선은 아니다. 기존 프로젝트와 라이브러리 호환성이 더 중요하다.

### 4.3 Group, Artifact, Package name

```text
Group:        com.example
Artifact:     study-api
Package name: com.example.studyapi
```

- Group은 보통 조직의 역도메인 형식을 사용한다.
- Artifact는 빌드 결과물의 식별자이자 프로젝트 이름에 사용된다.
- Java 패키지에는 하이픈을 사용할 수 없으므로 `study-api`가 `studyapi`처럼 바뀔 수 있다.
- 실제 조직 프로젝트에서는 `com.example` 대신 팀의 소유권을 나타내는 값을 정한다.

### 4.4 Jar와 War

입문 프로젝트는 보통 `Jar`를 선택한다.

```text
실행 가능한 Jar
  ├─ 애플리케이션 클래스
  ├─ 의존 라이브러리
  └─ 내장 서버 실행에 필요한 구성
```

`War`는 외부 Servlet 컨테이너에 전통적인 방식으로 배포해야 하는 요구사항이 있을 때 검토한다. Jar라고 해서 단순 라이브러리 파일만 뜻하는 것은 아니며, Spring Boot 플러그인이 실행 가능한 형태로 패키징할 수 있다.

### 4.5 Spring Web Starter

Initializr 화면에서는 사람이 이해하기 쉬운 **Spring Web**이라는 이름을 선택한다. 실제 생성되는 Starter 좌표는 선택한 Spring Boot 세대에 따라 달라질 수 있다.

예를 들어 현재 Spring Boot 4.1 공식 첫 애플리케이션 문서는 MVC 웹 애플리케이션에 다음 Starter를 안내한다.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webmvc</artifactId>
</dependency>
```

오래된 강의에서는 `spring-boot-starter-web`을 볼 수 있다. 이름을 임의로 바꾸기보다 **현재 Initializr가 생성한 파일과 선택 버전의 공식 문서**를 기준으로 한다.

## 5. 생성된 프로젝트 구조 읽기

Maven 프로젝트를 생성하면 대략 다음 구조를 볼 수 있다.

```text
study-api/
├─ .gitattributes
├─ .gitignore
├─ mvnw
├─ mvnw.cmd
├─ pom.xml
├─ .mvn/
│  └─ wrapper/
└─ src/
   ├─ main/
   │  ├─ java/
   │  │  └─ com/example/studyapi/
   │  │     └─ StudyApiApplication.java
   │  └─ resources/
   │     ├─ application.properties
   │     ├─ static/
   │     └─ templates/
   └─ test/
      └─ java/
         └─ com/example/studyapi/
            └─ StudyApiApplicationTests.java
```

### 5.1 파일별 책임

| 파일·폴더 | 역할 |
| --- | --- |
| `pom.xml` | Maven 의존성, 플러그인, 프로젝트 정보 |
| `mvnw`, `mvnw.cmd` | 프로젝트가 정한 Maven Wrapper 실행 파일 |
| `.mvn/wrapper` | Wrapper 버전과 다운로드 설정 |
| `src/main/java` | 실제 Java 애플리케이션 코드 |
| `src/main/resources` | 설정, 정적 자원, 템플릿 등 클래스패스 자원 |
| `src/test/java` | 테스트 코드 |
| `target` | Maven이 생성하는 컴파일·테스트·패키징 결과 |
| `.gitignore` | Git에 올리지 않을 생성 파일·로컬 파일 규칙 |

`target`은 빌드 결과이므로 직접 수정하지 않고 일반적으로 Git에 커밋하지 않는다. 소스 수정 후 빌드하면 다시 만들어진다.

Gradle에서는 `build.gradle` 또는 `build.gradle.kts`, `gradlew`, `gradlew.bat`, `gradle/wrapper`, `build/`가 비슷한 역할을 한다.

## 6. 빌드 파일을 처음 읽는 방법

전체 XML을 외우지 말고 다음 네 부분을 먼저 찾는다.

```xml
<!-- 1. Spring Boot가 관리할 기본 버전·Maven 설정 -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>프로젝트에서 선택한 버전</version>
</parent>

<!-- 2. 현재 프로젝트 식별 정보 -->
<groupId>com.example</groupId>
<artifactId>study-api</artifactId>
<version>0.0.1-SNAPSHOT</version>

<!-- 3. Java 버전 같은 속성 -->
<properties>
    <java.version>17</java.version>
</properties>

<!-- 4. 사용하는 기능과 테스트 의존성 -->
<dependencies>
    <!-- Initializr가 선택 버전에 맞춰 실제 내용을 생성한다. -->
</dependencies>
```

Spring Boot가 버전을 관리하는 의존성은 각 `<dependency>`에 버전을 반복해서 적지 않는 경우가 많다. 필요한 이유 없이 개별 라이브러리 버전을 덮어쓰면 검증된 조합이 깨질 수 있다.

### 6.1 Starter와 전이 의존성 확인

```powershell
.\mvnw.cmd dependency:tree
```

이 명령은 직접 선언한 Starter 아래에 어떤 라이브러리가 연결되었는지 보여 준다.

```text
웹 Starter
  ├─ Spring MVC 관련 모듈
  ├─ JSON 변환 관련 모듈
  ├─ 로깅 관련 모듈
  └─ 내장 Servlet 서버 관련 모듈
```

Starter는 코드가 아니라 목적별 의존성 묶음이다. 정확한 전이 의존성은 프로젝트 버전의 `dependency:tree` 결과로 확인한다.

## 7. Wrapper를 먼저 사용한다

Wrapper는 프로젝트가 정한 빌드 도구 버전을 사용하게 돕는다. 팀원이 전역 Maven을 따로 설치하지 않았거나 버전이 달라도 같은 프로젝트 명령을 재현하기 쉬워진다.

### 7.1 Windows PowerShell 명령

Maven:

```powershell
# 테스트를 포함해 프로젝트 상태를 확인한다.
.\mvnw.cmd test

# 개발 중 애플리케이션을 실행한다.
.\mvnw.cmd spring-boot:run

# 테스트 후 실행 가능한 JAR를 만든다.
.\mvnw.cmd package
```

Gradle:

```powershell
.\gradlew.bat test
.\gradlew.bat bootRun
.\gradlew.bat build
```

명령은 `pom.xml` 또는 `build.gradle`이 있는 프로젝트 루트에서 실행한다.

### 7.2 첫 실행에서 다운로드가 많은 이유

처음 Wrapper를 실행하면 다음 파일을 내려받을 수 있다.

- Wrapper가 사용할 Maven·Gradle 배포본
- Spring Boot와 Spring Framework 라이브러리
- 웹 서버, JSON, 로깅, 테스트 관련 전이 의존성
- 빌드 플러그인

두 번째 실행이 빨라지는 것은 로컬 캐시에 받은 파일을 재사용하기 때문이다. 첫 다운로드 실패를 Java 코드 오류로 오해하지 말고 네트워크, 프록시, 인증서, 저장소 접근을 구분한다.

## 8. 시작 클래스 읽기

```java
package com.example.studyapi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class StudyApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudyApiApplication.class, args);
    }
}
```

### 8.1 `main()`

JVM이 Java 애플리케이션을 시작할 때 호출하는 진입점이다. Spring Boot도 결국 `main()`에서 시작하는 Java 프로그램이다.

### 8.2 `SpringApplication.run()`

입문 단계에서는 다음 흐름으로 이해한다.

```text
애플리케이션 환경과 설정 준비
        ↓
ApplicationContext 생성
        ↓
Bean 탐색·등록과 의존성 연결
        ↓
자동 설정 적용
        ↓
웹 애플리케이션이면 내장 서버 시작
        ↓
시작 완료 로그 출력
```

반환값은 `ConfigurableApplicationContext`이므로 필요하면 컨테이너를 확인할 수 있지만, 첫 프로젝트에서는 실행 흐름을 이해하는 데 집중한다.

### 8.3 `@SpringBootApplication`

이 애너테이션은 다음 세 역할을 묶은 편의 애너테이션이다.

```text
@SpringBootConfiguration
  → Spring 설정 클래스임을 표시

@EnableAutoConfiguration
  → 클래스패스·설정·기존 Bean 조건에 맞는 자동 설정 활성화

@ComponentScan
  → 시작 클래스 패키지부터 하위 패키지의 컴포넌트 탐색
```

애너테이션이 서버를 직접 실행하는 것은 아니다. Spring이 이 메타데이터를 읽어 컨테이너 구성을 결정한다.

## 9. 시작 클래스는 루트 패키지에 둔다

Spring Boot 공식 문서는 기본 패키지 사용을 피하고, 시작 클래스를 다른 클래스보다 위쪽의 루트 패키지에 둘 것을 권장한다.

```text
com.example.studyapi
├─ StudyApiApplication.java  ← 루트 패키지
├─ hello/
│  └─ HelloController.java   ← 스캔 대상
├─ member/
│  ├─ MemberController.java
│  └─ MemberService.java
└─ order/
   └─ OrderService.java
```

다음 구조에서는 기본 컴포넌트 스캔이 `com.example.common`까지 올라가서 찾지 않는다.

```text
com.example
├─ app/
│  └─ StudyApiApplication.java
└─ common/
   └─ ClockService.java  ← app의 하위 패키지가 아님
```

처음에는 스캔 범위를 복잡하게 직접 지정하기보다 시작 클래스를 공통 루트 패키지에 둔다.

## 10. 첫 Controller와 JSON 응답 만들기

시작 클래스와 분리해 `hello` 패키지에 Controller를 만든다.

```java
package com.example.studyapi.hello;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @GetMapping("/api/hello")
    public HelloResponse hello() {
        // 반환한 Java 객체는 웹 설정의 메시지 변환기를 통해 JSON이 된다.
        return new HelloResponse("Spring Boot 첫 실행", "RUNNING");
    }
}
```

응답 전용 record를 같은 패키지에 만든다.

```java
package com.example.studyapi.hello;

// record는 이 예제의 변경되지 않는 응답 데이터를 간결하게 표현한다.
public record HelloResponse(
        String message,
        String status
) {
}
```

요청 흐름은 다음과 같다.

```text
GET /api/hello
        ↓
내장 서버가 HTTP 요청 수신
        ↓
Spring MVC가 경로와 메서드 조건 확인
        ↓
HelloController.hello() 호출
        ↓
HelloResponse 객체 반환
        ↓
HTTP 메시지 변환기가 JSON으로 직렬화
        ↓
200 OK + JSON 본문
```

예상 응답:

```json
{
  "message": "Spring Boot 첫 실행",
  "status": "RUNNING"
}
```

`@RestController`는 반환값을 View 이름으로 해석하기보다 HTTP 응답 본문으로 쓰는 Controller 역할을 나타낸다. `@GetMapping`은 GET 메서드와 경로를 Java 메서드에 연결한다.

## 11. 실행하고 응답 확인하기

### 11.1 애플리케이션 실행

프로젝트 루트의 PowerShell에서 실행한다.

```powershell
.\mvnw.cmd spring-boot:run
```

Gradle이라면:

```powershell
.\gradlew.bat bootRun
```

서버가 실행 중인 터미널은 요청을 받을 수 있도록 계속 실행 상태로 둔다. 종료할 때는 해당 터미널에서 `Ctrl+C`를 누른다.

### 11.2 PowerShell에서 요청 확인

다른 PowerShell 창에서 실행한다.

```powershell
Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/api/hello'
```

`curl.exe`를 명시해 확인할 수도 있다.

```powershell
curl.exe -i http://localhost:8080/api/hello
```

`-i`는 상태 줄과 Header까지 함께 보여 준다.

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Spring Boot 첫 실행","status":"RUNNING"}
```

브라우저 주소창도 GET 요청 확인에는 사용할 수 있지만, 상태 코드·Header와 POST 요청까지 학습하려면 HTTP 클라이언트를 함께 사용한다.

## 12. 시작 로그를 읽는 순서

실제 문구는 버전과 설정에 따라 달라질 수 있다. 문장을 암기하기보다 다음 정보를 찾는다.

```text
1. 어떤 Java·Spring Boot 버전으로 시작했는가?
2. 어떤 Profile이 활성화되었는가?
3. 웹 서버가 어느 포트에서 시작했는가?
4. ApplicationContext 시작 중 예외가 있었는가?
5. 최종 Started 로그가 출력되었는가?
```

개념적인 성공 로그 흐름:

```text
Starting StudyApiApplication
No active profile set ...
Tomcat initialized with port 8080
Tomcat started on port 8080
Started StudyApiApplication in ... seconds
```

`Started ...`가 보이기 전에 예외로 종료되었다면 서버는 요청을 받을 준비가 되지 않은 것이다. 긴 로그에서는 마지막 줄만 보지 말고 첫 번째 의미 있는 `Caused by`와 자신이 작성한 클래스 이름을 찾는다.

## 13. 기본 테스트의 의미

Initializr는 보통 다음과 비슷한 테스트를 만든다.

```java
package com.example.studyapi;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class StudyApiApplicationTests {

    @Test
    void contextLoads() {
        // 테스트 본문이 비어 있어도 ApplicationContext 시작 성공을 검증한다.
    }
}
```

실행:

```powershell
.\mvnw.cmd test
```

이 테스트는 HTTP 응답 내용 전체를 검증하지 않는다. Spring 설정을 읽고 ApplicationContext를 만들 수 있는지를 확인하는 기본 통합 테스트에 가깝다.

`contextLoads()`가 실패하면 테스트를 바로 삭제하기보다 다음을 확인한다.

- 등록할 수 없는 Bean이 있는가?
- 필수 설정 값이 누락되었는가?
- 데이터베이스 같은 외부 연결이 시작을 막는가?
- 시작 클래스와 테스트의 패키지 위치가 올바른가?

Controller 응답을 구체적으로 검증하는 방법은 이후 테스트 노트에서 다룬다.

## 14. 패키징하고 JAR로 실행하기

개발 플러그인 명령 없이도 실행할 수 있는 결과물을 만든다.

```powershell
.\mvnw.cmd package
```

테스트가 성공하면 `target` 아래에 JAR가 생성된다. 실제 파일명은 Artifact와 버전에 따라 달라진다.

```powershell
Get-ChildItem -LiteralPath '.\target' -Filter '*.jar'
java -jar .\target\study-api-0.0.1-SNAPSHOT.jar
```

Gradle:

```powershell
.\gradlew.bat build
Get-ChildItem -LiteralPath '.\build\libs' -Filter '*.jar'
java -jar .\build\libs\study-api-0.0.1-SNAPSHOT.jar
```

```text
spring-boot:run·bootRun
  → 개발 중 빌드 도구 플러그인으로 실행

java -jar
  → 만들어진 실행 결과물을 JVM으로 실행
```

두 방식 모두 같은 애플리케이션을 실행하지만 출발점과 사용 목적이 다르다.

## 15. 설정 파일로 포트 바꾸기

`src/main/resources/application.properties`에 다음을 작성할 수 있다.

```properties
spring.application.name=study-api
server.port=8081
```

재시작 후 요청 주소도 바뀐다.

```powershell
Invoke-RestMethod -Uri 'http://localhost:8081/api/hello'
```

설정을 바꿨는데 적용되지 않는다면 다음을 확인한다.

1. 파일이 `src/main/resources`에 있는가?
2. 키 이름의 오타가 없는가?
3. 다른 Profile·환경 변수·명령줄 인자가 값을 덮어쓰는가?
4. 애플리케이션을 재시작했는가?

포트는 환경마다 달라질 수 있는 값이므로 Java 소스에 직접 작성하지 않고 외부 설정으로 관리한다.

## 16. 첫 실행에서 자주 만나는 문제

### 16.1 Wrapper 명령을 찾지 못한다

```text
증상: .\mvnw.cmd를 찾을 수 없음
```

확인 순서:

1. 현재 위치에 `mvnw.cmd`가 있는가?
2. 압축 파일을 실제 폴더에 해제했는가?
3. IDE가 프로젝트의 상위 폴더를 열고 있지 않은가?
4. 프로젝트 생성물에서 Wrapper 파일이 누락되지 않았는가?

### 16.2 Java 버전이 맞지 않는다

```text
증상: class file version, release version not supported 등
```

다음 네 곳의 버전을 비교한다.

- `java -version`
- `javac -version`
- IDE Project SDK
- `pom.xml` 또는 Gradle toolchain의 Java 버전

### 16.3 포트가 이미 사용 중이다

```text
Web server failed to start. Port 8080 was already in use.
```

해결 방향은 두 가지다.

- 기존 서버를 정상 종료한다.
- 학습 목적상 필요하면 `server.port`를 다른 값으로 바꾼다.

서버 프로세스를 확인하지 않고 계속 포트만 바꾸면 어떤 애플리케이션이 실행 중인지 더 혼란스러워질 수 있다.

### 16.4 `/api/hello`가 404다

확인 순서:

1. 서버 시작이 성공했는가?
2. 요청 포트가 로그의 실제 포트와 같은가?
3. 요청 경로와 `@GetMapping` 문자열이 같은가?
4. GET 요청을 보냈는가?
5. `HelloController`가 시작 클래스의 하위 패키지에 있는가?
6. `@RestController`가 붙어 있는가?

### 16.5 브라우저가 빈 페이지나 문자열만 보여 준다

문자열을 직접 반환하면 단순 텍스트 응답이 되는 것이 정상일 수 있다. 객체나 record를 반환하면 JSON 변환을 확인하기 좋다.

```java
@GetMapping("/api/text")
public String text() {
    return "hello";
}
```

```text
hello
```

이 결과는 HTML 화면을 렌더링하는 기능과 REST 응답 본문을 만드는 기능이 다르다는 점을 보여 준다.

### 16.6 의존성 다운로드가 실패한다

```text
Could not resolve artifact ...
```

확인할 것:

- 인터넷 연결과 Maven Central 접근
- 회사·교육기관 프록시 설정
- 인증서 오류
- 저장소 서비스 장애
- 잘못 입력한 의존성 좌표·버전

소스 코드 컴파일 오류와 의존성 저장소 접근 오류를 구분한다.

## 17. 자동 설정을 확인하는 기본 태도

웹 Starter를 추가하고 애플리케이션을 실행하면 내장 서버와 Spring MVC 관련 Bean이 준비된다. 이를 마법으로 외우지 않고 조건의 결과로 본다.

```text
웹 MVC 관련 클래스가 클래스패스에 있음
        +
사용자가 별도 구성을 제공하지 않음
        +
웹 애플리케이션 환경
        ↓
조건에 맞는 자동 설정 적용
        ↓
내장 서버와 MVC 기반 구성 준비
```

자동 설정 세부 보고서는 디버그 옵션으로 더 자세히 볼 수 있다.

```powershell
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.arguments=--debug'
```

디버그 로그는 매우 길다. 처음부터 모두 읽기보다 어떤 자동 설정이 조건에 맞았는지 확인해야 할 때 사용한다.

## 18. 실습 완료 기준

첫 프로젝트는 다음 항목을 직접 확인하면 완료다.

- [ ] `java -version`, `javac -version`이 프로젝트 조건과 맞는다.
- [ ] Initializr의 각 선택 항목을 한 문장으로 설명할 수 있다.
- [ ] Wrapper로 테스트를 실행했다.
- [ ] `pom.xml` 또는 Gradle 파일에서 Boot·Java·의존성을 찾을 수 있다.
- [ ] 시작 클래스가 루트 패키지에 있는 이유를 설명할 수 있다.
- [ ] `@SpringBootApplication`의 세 역할을 구분할 수 있다.
- [ ] 실행 로그에서 포트와 시작 성공을 찾을 수 있다.
- [ ] 별도 Controller에서 Java 객체를 반환했다.
- [ ] HTTP 클라이언트로 상태 코드와 JSON을 확인했다.
- [ ] JAR를 만들고 `java -jar`로 실행할 수 있다.

## 19. 적용 관점에서 다시 보기

### 프로젝트가 실행되지 않을 때

```text
1. JDK·경로 확인
2. Wrapper 자체 실행 확인
3. 의존성 다운로드 확인
4. 컴파일 오류 확인
5. 테스트·ApplicationContext 오류 확인
6. 내장 서버 포트 확인
7. HTTP 매핑과 응답 확인
```

문제가 어느 단계인지 먼저 찾으면 Controller 코드를 고쳐야 할지, JDK를 맞춰야 할지, 네트워크를 확인해야 할지가 달라진다.

### 비슷한 개념 구분

| 개념 | 질문 |
| --- | --- |
| Initializr | 어떤 프로젝트 뼈대를 생성할까? |
| Starter | 어떤 목적의 의존성을 함께 사용할까? |
| Wrapper | 어떤 빌드 도구 버전으로 반복 실행할까? |
| `@SpringBootApplication` | 어떤 설정·자동 설정·스캔을 활성화할까? |
| `SpringApplication.run()` | 애플리케이션 컨테이너를 어떻게 시작할까? |
| 내장 서버 | HTTP 요청을 어느 프로세스가 받을까? |
| Controller | 요청을 어느 Java 메서드가 처리할까? |

## 20. 배운 점과 다음 학습

### 20.1 새로 이해한 것

- Initializr는 조건에 맞는 출발 파일을 생성하며 애플리케이션 기능 자체를 완성하지 않는다.
- Wrapper는 팀의 빌드 실행 환경 차이를 줄인다.
- Starter를 추가하면 클래스패스와 자동 설정 조건이 달라진다.
- 시작 클래스의 패키지 위치가 기본 컴포넌트 탐색 범위를 결정한다.
- 시작 성공, 서버 포트, HTTP 매핑 성공은 서로 다른 확인 단계다.

### 20.2 다음 학습과 연결

첫 프로젝트에서 Spring이 Controller 객체를 어떻게 발견하고 생성했는지는 다음 주제인 **IoC·DI·Bean**으로 이어진다. 다음 노트에서는 Bean 등록 방식, 컴포넌트 스캔, 생성자 주입, 같은 타입의 Bean이 여러 개일 때의 문제를 다룬다.

## 21. 요약 정리

1. Spring Initializr는 버전·빌드 도구·패키지·의존성에 맞는 프로젝트 뼈대를 만든다.
2. Spring Boot와 Java 버전은 공식 요구사항과 팀 조건에 맞춘다.
3. Initializr가 만든 Wrapper를 프로젝트 루트에서 우선 사용한다.
4. `src/main/java`는 애플리케이션 코드, `resources`는 설정과 자원, `src/test/java`는 테스트 코드 영역이다.
5. `@SpringBootApplication`은 설정, 자동 설정, 컴포넌트 스캔의 핵심 역할을 묶는다.
6. 시작 클래스는 기본 스캔 범위를 고려해 루트 패키지에 둔다.
7. `SpringApplication.run()`은 ApplicationContext와 웹 애플리케이션 실행 환경을 준비한다.
8. 첫 성공은 Started 로그뿐 아니라 실제 HTTP 상태와 JSON 응답까지 확인한다.
9. `fetch`나 브라우저 화면보다 먼저 서버 포트와 Controller 매핑을 확인한다.
10. 개발 실행과 패키징된 JAR 실행의 차이를 이해한다.

🧠 기억할 것: **Initializr는 출발점을 만들고, Wrapper는 빌드를 재현하며, `SpringApplication.run()`은 Spring 컨테이너와 내장 서버를 시작한다.**

## 22. 미니 퀴즈

1. Initializr에서 `SNAPSHOT` 버전을 입문 프로젝트의 기본값으로 선택하지 않는 이유는 무엇인가?
2. Maven이 전역에 설치되어 있어도 `mvnw.cmd`를 우선 사용할 수 있는 이유는 무엇인가?
3. `src/main/resources`와 `src/test/java`의 책임은 어떻게 다른가?
4. `@SpringBootApplication`이 묶고 있는 세 가지 핵심 역할은 무엇인가?
5. 시작 클래스를 루트 패키지에 두는 이유는 무엇인가?
6. 로그에 `Started`가 없고 예외로 종료되었다면 HTTP 요청이 실패하는 이유는 무엇인가?
7. `curl.exe -i`로 첫 API를 확인하면 브라우저 주소창보다 무엇을 더 볼 수 있는가?
8. `Promise`나 프론트엔드 코드 수정 전에 Spring 서버의 어느 항목을 먼저 확인해야 하는가?

<details>
<summary>정답과 해설</summary>

1. 개발 중인 빌드라 변경 가능성이 있고 라이브러리·문서 호환성이 안정 버전보다 불확실하기 때문이다.
2. 프로젝트에 기록된 빌드 도구 버전을 사용해 팀과 CI의 실행 차이를 줄일 수 있기 때문이다.
3. `resources`는 실행 설정과 클래스패스 자원을, `src/test/java`는 기능을 검증하는 테스트 코드를 둔다.
4. Spring 설정 클래스, 자동 설정 활성화, 컴포넌트 스캔이다.
5. 시작 클래스의 패키지를 기준으로 하위 패키지의 컴포넌트를 기본 탐색하기 때문이다.
6. 내장 서버와 ApplicationContext가 정상 시작되지 않아 요청을 받을 프로세스가 준비되지 않았기 때문이다.
7. HTTP 상태 줄과 Header, 응답 본문을 함께 확인할 수 있다.
8. 시작 성공 여부, 실제 포트, 요청 경로와 HTTP 메서드, Controller 스캔 여부를 먼저 확인한다.

</details>

## 참고 자료

- [Spring Initializr](https://start.spring.io/)
- [Spring Boot — Developing Your First Application](https://docs.spring.io/spring-boot/tutorial/first-application/)
- [Spring Boot — Structuring Your Code](https://docs.spring.io/spring-boot/reference/using/structuring-your-code.html)
- [Spring Boot — Build Systems](https://docs.spring.io/spring-boot/reference/using/build-systems.html)
- [Spring Boot — Running Your Application](https://docs.spring.io/spring-boot/reference/using/running-your-application.html)
- [Spring Guide — Building an Application with Spring Boot](https://spring.io/guides/gs/spring-boot/)

> 정리 기준일: 2026-08-25. Starter 이름, 지원 Java 버전과 실행 옵션은 선택한 Spring Boot 버전의 공식 문서를 다시 확인한다.
