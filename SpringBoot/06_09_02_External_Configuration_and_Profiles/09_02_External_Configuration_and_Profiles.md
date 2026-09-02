# Spring Boot 외부 설정과 Profile 이해하기

- 🎯 글의 목표: 같은 애플리케이션 코드를 유지하면서 개발·테스트·운영 환경의 설정을 안전하게 바꾸고, 최종 설정값이 어디에서 왔는지 추적한다.
- 🧩 핵심 키워드: 외부 설정, `Environment`, PropertySource, `application.properties`, YAML, 환경 변수, `@Value`, `@ConfigurationProperties`, relaxed binding, Profile, `@Profile`, Config Tree
- ⭐ 중요도: ★★★★★ — 포트·DB 주소·외부 API URL·제한값·비밀값을 코드에 고정하면 환경이 바뀔 때마다 다시 빌드해야 하며, 잘못된 설정은 실행 실패와 보안 사고로 이어질 수 있다.
- 📝 한눈에 보는 내용: Spring Boot는 파일, 환경 변수, 시스템 속성, 명령줄 인수 등 여러 설정 출처를 하나의 `Environment`로 모은다. 더 높은 우선순위의 값이 낮은 값을 덮어쓰며, 애플리케이션은 `@ConfigurationProperties`로 관련 값을 타입 안전한 객체에 묶고 시작 시점에 검증할 수 있다. Profile은 환경별 설정 문서나 Bean을 선택하지만 비밀값을 보호하는 기능은 아니다.
- 🔗 관련 주제: IoC·Bean, Bean Validation, 데이터베이스 연결, 테스트, Spring Security, 배포·Secret Manager, Actuator
- 🧱 선수 지식: Spring Bean과 생성자 주입, Java record, 환경 변수, YAML 들여쓰기, Bean Validation

---

## 1. 들어가며

로컬 컴퓨터와 운영 서버는 같은 코드를 실행해도 주변 환경이 다르다.

```text
로컬 개발 환경
  ├─ 서버 포트: 8080
  ├─ 테스트용 외부 API 주소
  ├─ 짧은 연결 제한 시간
  └─ 개발용 로그 수준

운영 환경
  ├─ 플랫폼이 지정한 포트
  ├─ 실제 외부 API 주소
  ├─ 운영 기준의 연결 제한 시간
  └─ 운영용 로그 수준
```

환경 차이를 Java 코드의 `if` 문과 문자열 상수로 처리하면 환경이 추가될수록 코드가 복잡해진다.

```java
// 환경마다 소스 코드를 수정해야 하는 좋지 않은 예다.
String providerUrl = "https://api.example.com";
String apiKey = "실제-비밀값";
int timeoutSeconds = 3;
```

이 방식에는 세 문제가 있다.

1. 설정을 바꿀 때 코드를 수정하고 다시 빌드해야 한다.
2. 저장소에 비밀번호나 API Key가 들어갈 수 있다.
3. 테스트가 운영 서비스에 연결되는 등 환경 혼동이 생길 수 있다.

Spring Boot의 외부 설정은 **바뀌기 쉬운 값과 애플리케이션 로직을 분리**한다.

```text
한 번 빌드한 애플리케이션
        +
실행 환경이 제공하는 설정
        ↓
환경에 맞게 동작하는 애플리케이션
```

> 이 문서는 2026년 9월 2일의 Spring Boot 4.1.1 공식 문서를 확인해 작성했다. 설정 출처와 바인딩 세부 규칙은 버전에 따라 달라질 수 있으므로 실제 프로젝트 버전의 공식 문서를 우선한다.

## 2. 전체 지도: 설정값이 코드에 도착하는 과정

Spring Boot는 서로 다른 출처의 값을 Spring `Environment`로 모은다. 여기서 Environment는 운영 환경이라는 일상적인 말만 뜻하지 않고, 애플리케이션이 사용할 속성과 활성 Profile을 제공하는 Spring의 추상화다.

```text
application.yaml
환경 변수
Java 시스템 속성
명령줄 인수
외부 설정 파일
테스트 설정
        ↓
각 출처를 PropertySource로 등록
        ↓
우선순위에 따라 같은 키의 최종값 결정
        ↓
Environment
        ↓
@Value 또는 @ConfigurationProperties
        ↓
애플리케이션 Bean이 설정 사용
```

용어를 먼저 구분한다.

| 용어 | 의미 | 예시 |
| --- | --- | --- |
| 설정 속성 | 이름과 값으로 표현한 설정 한 개 | `server.port=8081` |
| PropertySource | 여러 설정값을 제공하는 하나의 출처 | 환경 변수, 설정 파일 |
| Environment | PropertySource들을 모아 최종 속성과 Profile을 제공 | `Environment#getProperty()` |
| 바인딩 | 문자열 중심 외부 값을 Java 객체 필드·생성자 인수에 연결 | `3s` → `Duration` |
| Profile | 특정 설정 문서나 Bean을 활성화하는 논리적 이름 | `local`, `prod` |

📌 핵심: 설정 파일 하나가 곧 전체 설정은 아니다. **여러 출처가 합쳐진 뒤 우선순위로 결정된 값**이 실제 애플리케이션 설정이다.

## 3. 무엇을 외부 설정으로 분리할까

### 3.1 환경마다 달라질 수 있는 값

다음 값은 외부 설정 후보다.

- 서버 포트와 애플리케이션 이름
- 데이터베이스 URL·계정·연결 풀 크기
- 외부 API 주소와 timeout
- 기능 활성화 여부
- 페이지 기본 크기와 요청 제한값
- 로그 수준
- API Key·토큰·비밀번호

반대로 비즈니스 규칙 자체를 모두 설정으로 빼면 이해와 테스트가 더 어려워질 수 있다.

```java
// 변하지 않는 핵심 규칙까지 무조건 외부화할 필요는 없다.
private static final int ISBN_LENGTH = 13;
```

설정 여부를 판단할 때 다음 질문을 사용한다.

1. 배포 환경에 따라 달라지는가?
2. 코드를 다시 빌드하지 않고 바꿀 필요가 있는가?
3. 운영자가 조절해야 하는가?
4. 저장소에 포함하면 안 되는 민감값인가?

### 3.2 외부 설정은 입력 데이터다

설정도 사용자 입력처럼 잘못될 수 있다.

```text
timeout=-1s
limit=0
provider-url=잘못된 주소
api-key 누락
```

따라서 읽는 데서 끝내지 않고 타입 변환과 검증을 적용해야 한다. 잘못된 설정으로 요청을 받은 뒤 늦게 실패하는 것보다 애플리케이션 시작 시점에 명확하게 실패하는 편이 안전하다.

## 4. `application.properties`와 YAML

Spring Boot는 기본 설정 파일로 `application.properties`와 `application.yaml` 또는 `application.yml`을 읽을 수 있다.

### 4.1 Properties 형식

```properties
spring.application.name=reading-api
server.port=8080

reading.recommendation.limit=10
reading.recommendation.timeout=3s
reading.recommendation.provider-url=http://localhost:9090
```

Properties는 키의 전체 경로를 매 줄 작성한다. 구조가 평평하게 보이고 한 줄 단위 비교가 쉽다.

### 4.2 YAML 형식

```yaml
spring:
  application:
    name: reading-api

server:
  port: 8080

reading:
  recommendation:
    limit: 10
    timeout: 3s
    provider-url: http://localhost:9090
```

YAML은 들여쓰기로 계층을 표현한다. 같은 접두사의 속성이 많을 때 구조를 보기 쉽지만 공백이 잘못되면 다른 구조가 된다. Tab 대신 공백을 사용하고 IDE의 YAML 검사를 활용한다.

### 4.3 둘을 동시에 사용할까

한 프로젝트에서는 한 형식을 정해 일관되게 사용하는 편이 좋다. 같은 위치에 Properties와 YAML이 함께 있으면 어떤 값이 선택되는지 알아야 하며, 현재 공식 문서에서는 같은 위치의 `.properties`가 YAML보다 우선한다고 설명한다.

```text
application.properties
application.yaml
        ↓ 같은 키가 양쪽에 존재
.properties 값이 우선할 수 있음
```

두 파일에 값을 나누어 적어 우선순위에 기대기보다 하나의 기본 형식을 정한다.

### 4.4 설정 파일의 기본 위치

패키징 전 프로젝트에서는 보통 다음 위치를 사용한다.

```text
src/
└─ main/
   └─ resources/
      └─ application.yaml
```

빌드하면 이 파일은 애플리케이션 JAR의 클래스패스에 포함된다. Spring Boot는 실행 파일 바깥의 현재 디렉터리와 `config/` 같은 위치에서도 외부 설정 파일을 찾을 수 있다. 바깥 파일은 JAR을 다시 만들지 않고 값을 덮어쓸 때 유용하다.

## 5. Property placeholder로 다른 값 참조하기

`${...}` 문법으로 다른 속성이나 환경 값을 참조할 수 있다.

```yaml
reading:
  recommendation:
    provider-url: ${READING_PROVIDER_URL:http://localhost:9090}
```

해석은 다음과 같다.

```text
READING_PROVIDER_URL이 존재함
  → 그 값을 사용

존재하지 않음
  → 콜론 뒤 기본값 http://localhost:9090 사용
```

기본값이 없어 반드시 제공해야 하는 값은 다음처럼 쓸 수 있다.

```yaml
reading:
  recommendation:
    api-key: ${READING_PROVIDER_API_KEY}
```

이 값이 실제로 바인딩되는 과정에서 환경 변수가 없다면 시작 실패로 이어질 수 있다. 비밀값에 개발 편의를 위한 실제 기본 비밀번호를 넣지 않는다.

```yaml
# 좋지 않은 예: 환경 변수가 없을 때 저장소의 비밀값을 사용한다.
api-key: ${READING_PROVIDER_API_KEY:real-secret-value}
```

Placeholder 안의 속성 이름은 가능한 한 소문자 kebab-case의 canonical form을 사용한다.

## 6. 설정 우선순위 이해하기

### 6.1 나중의 높은 우선순위가 앞의 값을 덮어쓴다

Spring Boot는 PropertySource 순서를 정의한다. 공식 목록은 테스트 출처까지 길기 때문에 입문 단계에서 자주 만나는 일부를 낮은 우선순위에서 높은 우선순위 방향으로 단순화하면 다음과 같다.

```text
코드에서 지정한 기본 속성
        ↓
JAR 안의 application 파일
        ↓
JAR 안의 Profile 전용 파일
        ↓
JAR 밖의 application 파일
        ↓
JAR 밖의 Profile 전용 파일
        ↓
OS 환경 변수
        ↓
Java 시스템 속성
        ↓
SPRING_APPLICATION_JSON
        ↓
명령줄 인수
        ↓
테스트 전용 속성들
```

위 그림은 실무에서 자주 비교하는 출처를 이해하기 위한 축약본이다. 정확한 전체 순서는 사용하는 Spring Boot 버전의 Externalized Configuration 문서에서 확인한다.

### 6.2 같은 키의 최종값 추적하기

기본 파일에 다음 값이 있다고 가정한다.

```yaml
server:
  port: 8080
```

PowerShell에서 명령줄 인수로 실행한다.

```powershell
# 프로젝트 루트에서 Maven Wrapper로 실행한다.
# 명령줄 속성이 파일보다 우선하므로 9090 포트가 선택된다.
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.arguments=--server.port=9090'
```

패키징된 JAR이면 다음처럼 전달한다.

```powershell
java -jar .\target\reading-api.jar --server.port=9090
```

성공 시 시작 로그의 실제 포트를 확인한다. 명령을 적었다고 해서 실행 결과를 추측하지 말고 로그와 요청으로 검증한다.

### 6.3 우선순위가 필요한 이유

기본 설정은 안전한 공통값을 제공하고, 배포 환경은 필요한 값만 덮어쓸 수 있다.

```text
JAR 안 기본값
  recommendation.limit=10

운영 환경 변수
  READING_RECOMMENDATION_LIMIT=30

최종값
  30
```

하지만 출처가 너무 많으면 “어디에서 덮어썼는지” 찾기 어렵다. 팀에서 허용할 설정 출처와 운영 변경 절차를 정하고, 임시 명령줄 인수를 장기 설정처럼 사용하지 않는다.

## 7. 환경 변수 사용하기

### 7.1 환경 변수는 프로세스 밖에서 값을 제공한다

PowerShell 현재 세션에서 다음처럼 설정할 수 있다.

```powershell
# 이 PowerShell 프로세스와 여기서 시작하는 자식 프로세스에 적용된다.
$env:READING_RECOMMENDATION_LIMIT = "20"
$env:READING_PROVIDER_API_KEY = "local-example-only"

# 같은 PowerShell에서 애플리케이션을 시작해야 값을 전달받는다.
.\mvnw.cmd spring-boot:run
```

실습이 끝나면 현재 세션의 값을 제거할 수 있다.

```powershell
Remove-Item Env:READING_RECOMMENDATION_LIMIT
Remove-Item Env:READING_PROVIDER_API_KEY
```

새 터미널을 열면 현재 프로세스 범위 변수는 유지되지 않는다. IDE에서 실행한다면 IDE의 Run Configuration 환경 변수도 별도로 확인한다.

### 7.2 속성 이름을 환경 변수 이름으로 바꾸는 규칙

Spring Boot 공식 문서는 canonical 속성 이름을 환경 변수 이름으로 바꿀 때 다음 규칙을 안내한다.

1. 점 `.`을 밑줄 `_`로 바꾼다.
2. 하이픈 `-`을 제거한다.
3. 전체를 대문자로 바꾼다.

```text
reading.recommendation.limit
  → READING_RECOMMENDATION_LIMIT

reading.remote-base-url
  → READING_REMOTEBASEURL
```

하이픈을 무조건 밑줄로 바꾼다고 외우면 두 번째 이름을 틀릴 수 있다. 복잡한 목록과 Map 바인딩은 별도 규칙이 있으므로 공식 문서를 확인한다.

### 7.3 `.env` 파일에 대한 오해

Spring Boot 자체가 프로젝트 루트의 `.env` 파일을 자동으로 읽는다고 가정하면 안 된다.

```text
.env 파일 작성
     ≠
Spring Environment에 자동 등록
```

IDE, Docker Compose, 배포 플랫폼, 별도 라이브러리가 `.env`를 읽어 프로세스 환경 변수로 전달할 수는 있다. 이 경우 값을 읽는 주체는 Spring Boot가 아니라 해당 도구다. 실행 방법마다 실제 전달 여부를 확인한다.

## 8. `@Value`로 작은 설정 하나 사용하기

설정 한두 개를 간단히 사용할 때 `@Value`를 볼 수 있다.

```yaml
reading:
  banner-text: 오늘 읽을 책을 기록해 보세요
```

```java
package com.example.reading.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class BannerService {
    private final String bannerText;

    public BannerService(
            @Value("${reading.banner-text:독서 기록}") String bannerText
    ) {
        // 값이 없으면 콜론 뒤의 "독서 기록"을 기본값으로 사용한다.
        this.bannerText = bannerText;
    }

    public String getBannerText() {
        return bannerText;
    }
}
```

`@Value`는 작은 단일 값에 편리하지만 속성이 늘면 문제가 보인다.

```java
public RecommendationService(
        @Value("${reading.recommendation.limit}") int limit,
        @Value("${reading.recommendation.timeout}") Duration timeout,
        @Value("${reading.recommendation.provider-url}") URI providerUrl,
        @Value("${reading.recommendation.api-key}") String apiKey
) {
    // 관련 설정이 생성자에 흩어지고 재사용·검증·문서화가 어려워진다.
}
```

관련 속성이 여러 개이거나 계층 구조라면 `@ConfigurationProperties`가 더 잘 맞는다.

## 9. 타입 안전한 `@ConfigurationProperties`

### 9.1 관련 설정을 하나의 객체로 묶는다

다음 설정을 Java record에 바인딩한다.

```yaml
reading:
  recommendation:
    limit: 10
    timeout: 3s
    provider-url: http://localhost:9090
    api-key: ${READING_PROVIDER_API_KEY}
```

```java
package com.example.reading.config;

import java.net.URI;
import java.time.Duration;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "reading.recommendation")
public record RecommendationProperties(
        // 추천 개수는 1개 이상 100개 이하만 허용한다.
        @Min(1) @Max(100) int limit,

        // 3s, 500ms 같은 문자열을 Duration으로 변환한다.
        @NotNull Duration timeout,

        // 문자열 URL을 URI 타입으로 변환한다.
        @NotNull URI providerUrl,

        // 외부 추천 서비스 인증값은 비어 있으면 안 된다.
        @NotBlank String apiKey
) {
}
```

record의 구성 요소는 생성자 바인딩으로 채워질 수 있다. record에 생성자가 여러 개 있는 특수한 경우가 아니라면 별도의 `@ConstructorBinding`을 붙일 필요가 없다.

### 9.2 설정 클래스를 Bean으로 등록한다

설정 속성 스캔을 활성화하는 한 가지 방법은 시작 클래스에 `@ConfigurationPropertiesScan`을 추가하는 것이다.

```java
package com.example.reading;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@ConfigurationPropertiesScan
@SpringBootApplication
public class ReadingApplication {

    public static void main(String[] args) {
        SpringApplication.run(ReadingApplication.class, args);
    }
}
```

특정 설정 클래스만 명시적으로 등록하려면 `@EnableConfigurationProperties(RecommendationProperties.class)`를 사용할 수도 있다. 두 방식을 무의미하게 중복하지 않고 프로젝트 규모와 명시성 기준에 맞춰 하나를 선택한다.

### 9.3 일반 Bean처럼 생성자 주입한다

먼저 Java 표준 `HttpClient`를 Spring Bean으로 등록한다. Java가 제공하는 클래스라고 해서 자동으로 Spring Bean이 되는 것은 아니다.

```java
package com.example.reading.config;

import java.net.http.HttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class HttpClientConfig {

    @Bean
    public HttpClient httpClient() {
        // 애플리케이션에서 공유할 HTTP Client를 컨테이너에 등록한다.
        return HttpClient.newBuilder().build();
    }
}
```

이제 설정 객체와 HTTP Client를 Service 생성자로 함께 주입할 수 있다.

```java
package com.example.reading.service;

import com.example.reading.config.RecommendationProperties;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import org.springframework.stereotype.Service;

@Service
public class RecommendationService {
    private final RecommendationProperties properties;
    private final HttpClient httpClient;

    public RecommendationService(
            RecommendationProperties properties,
            HttpClient httpClient
    ) {
        // 설정 객체도 Spring Bean이므로 생성자로 주입받는다.
        this.properties = properties;
        this.httpClient = httpClient;
    }

    public HttpRequest createRequest() {
        // 설정을 개별 문자열로 다시 찾지 않고 타입이 정해진 객체로 사용한다.
        return HttpRequest.newBuilder(properties.providerUrl())
                .timeout(properties.timeout())
                .header("Authorization", "Bearer " + properties.apiKey())
                .GET()
                .build();
    }
}
```

이 코드는 요청 객체를 만드는 부분 예제다. 실제 호출에서는 응답 상태, timeout, 재시도, 민감 Header 로그 제외 정책을 추가해야 한다.

### 9.4 `@Value`와 비교하기

| 기준 | `@Value` | `@ConfigurationProperties` |
| --- | --- | --- |
| 적합한 크기 | 독립적인 소수 값 | 같은 접두사의 관련 값 묶음 |
| 타입 안전성 | 개별 변환 | 구조화된 객체 바인딩 |
| relaxed binding | 제한적 | 지원 |
| 설정 메타데이터 | 기본적으로 없음 | 생성 가능 |
| Bean Validation | 객체 단위 적용이 자연스러움 | `@Validated`로 적용 |
| SpEL | 지원 | 지원하지 않음 |

애플리케이션 전용 설정 묶음은 `@ConfigurationProperties`를 기본 선택으로 고려하고, 정말 작은 독립값은 `@Value`로 사용할 수 있다.

## 10. Relaxed binding 이해하기

외부 설정은 출처마다 이름 표기 제약이 다르다. Spring Boot는 여러 표기를 Java 속성 이름에 연결하는 relaxed binding을 제공한다.

```text
설정 객체 속성
  providerUrl

Properties·YAML 권장 키
  provider-url

전체 속성
  reading.recommendation.provider-url
```

canonical 형식은 소문자 kebab-case를 권장한다.

```yaml
# 권장
reading:
  recommendation:
    provider-url: http://localhost:9090
```

```yaml
# 동작할 수 있어도 표기를 섞으면 검색과 문서화가 어려워진다.
reading:
  recommendation:
    providerUrl: http://localhost:9090
```

`@ConfigurationProperties`의 prefix도 `reading.recommendation`처럼 소문자와 kebab-case 규칙에 맞춘다.

## 11. 설정값의 타입 변환

외부 설정은 텍스트로 입력되는 경우가 많지만 애플리케이션에서는 적절한 타입으로 사용해야 한다.

### 11.1 Duration

```yaml
reading:
  recommendation:
    timeout: 1500ms
```

```java
Duration timeout
```

단위를 값에 명시하면 숫자만 썼을 때 기본 단위를 잘못 이해하는 문제를 줄일 수 있다.

```text
1500ms → 1.5초
3s     → 3초
2m     → 2분
```

### 11.2 DataSize

업로드 크기나 버퍼 크기는 Spring의 `DataSize`로 바인딩할 수 있다.

```yaml
reading:
  export:
    max-file-size: 10MB
```

```java
DataSize maxFileSize
```

### 11.3 enum

정해진 선택지만 허용한다면 문자열보다 enum이 안전하다.

```java
public enum RecommendationMode {
    SIMPLE,
    PERSONALIZED
}
```

```yaml
reading:
  recommendation:
    mode: personalized
```

바인딩할 수 없는 값은 시작 오류가 된다. 오류를 숨기기 위해 모두 `String`으로 받기보다 의미 있는 타입과 명확한 허용 범위를 사용한다.

## 12. 설정 검증과 빠른 실패

### 12.1 `@Validated`와 제약 애너테이션

앞의 `RecommendationProperties`에는 다음 검증이 있다.

```java
@Validated
@ConfigurationProperties("reading.recommendation")
public record RecommendationProperties(
        @Min(1) @Max(100) int limit,
        @NotNull Duration timeout,
        @NotNull URI providerUrl,
        @NotBlank String apiKey
) {
}
```

잘못된 예시는 다음과 같다.

```yaml
reading:
  recommendation:
    limit: 0
    timeout: -1s
    provider-url: not-a-uri
    api-key: ""
```

애플리케이션은 설정 바인딩·검증 단계에서 시작에 실패할 수 있다. 이는 장애가 아니라 잘못된 배포 설정을 요청 처리 전에 발견하는 **빠른 실패**다.

### 12.2 오류를 읽는 순서

설정 바인딩 오류가 발생하면 다음을 확인한다.

```text
1. 어떤 prefix의 설정 객체가 실패했는가?
2. 어떤 property 이름을 바인딩하지 못했는가?
3. 입력된 문자열 값은 무엇인가?
4. 목표 Java 타입은 무엇인가?
5. 변환 실패인가, Validation 위반인가, 값 누락인가?
6. 그 값의 실제 PropertySource는 어디인가?
```

비밀값은 오류 로그에도 그대로 나타나지 않도록 주의한다. 설정 객체 전체를 `toString()`으로 로그에 남기면 record가 `apiKey`까지 출력할 수 있다.

### 12.3 기본값을 어디에 둘까

공통이며 안전한 기본값은 기본 설정 파일에 둘 수 있다.

```yaml
reading:
  recommendation:
    limit: 10
    timeout: 3s
```

반드시 배포 환경이 결정해야 하는 값에는 무심코 기본값을 넣지 않는다.

```yaml
reading:
  recommendation:
    api-key: ${READING_PROVIDER_API_KEY}
```

기본값은 편리함과 누락 탐지 사이의 정책이다. 누락되어도 안전한 값인지 먼저 판단한다.

## 13. Profile은 무엇인가

Profile은 특정 설정 문서나 Bean을 조건부로 활성화하는 논리적 이름이다.

```text
활성 Profile: local
  ├─ 공통 application 설정
  ├─ local 전용 설정
  └─ @Profile("local") Bean
```

Profile은 운영체제 사용자 계정도 아니고 비밀 저장소도 아니다. `prod` Profile을 활성화한다고 설정이 자동으로 암호화되거나 보안이 강화되지는 않는다.

### 13.1 Profile 이름

일반적으로 다음과 같은 이름을 볼 수 있다.

- `local`: 개발자 PC
- `test`: 자동 테스트
- `staging`: 운영 전 검증 환경
- `prod`: 운영 환경

환경 이름만 사용할 필요는 없다. `metrics`, `proddb`처럼 기능이나 인프라 조각을 표현할 수도 있다. 다만 조합이 많아지면 활성 상태를 추적하기 어려우므로 팀 규칙을 정한다.

### 13.2 기본 Profile

활성 Profile을 지정하지 않으면 `default` Profile이 활성화된다. 기본 Profile 이름은 바꿀 수 있지만, 입문 단계에서는 활성 Profile이 없는 상태와 `local` 상태를 혼동하지 않는 것이 먼저다.

## 14. Profile 전용 설정 파일

### 14.1 기본 파일에는 공통값

`application.yaml`에는 모든 환경에 공통인 안전한 값을 둔다.

```yaml
spring:
  application:
    name: reading-api

reading:
  recommendation:
    limit: 10
    timeout: 3s
    api-key: ${READING_PROVIDER_API_KEY}
```

### 14.2 local 설정

`application-local.yaml`은 로컬에서 달라지는 값만 덮어쓴다.

```yaml
server:
  port: 8080

reading:
  recommendation:
    provider-url: http://localhost:9090
```

### 14.3 prod 설정

`application-prod.yaml`에는 운영의 비민감 설정을 둔다.

```yaml
server:
  port: 8080

reading:
  recommendation:
    provider-url: https://recommendation.example.com
    timeout: 2s
```

운영 API Key를 `application-prod.yaml`에 직접 적지 않는다. Profile 전용 파일도 Git에 커밋되는 일반 파일일 수 있기 때문이다.

### 14.4 최종 병합

`local` Profile을 활성화하면 공통 파일과 local 파일이 함께 적용된다.

```text
application.yaml
  limit=10
  timeout=3s
  api-key=${READING_PROVIDER_API_KEY}
        +
application-local.yaml
  provider-url=http://localhost:9090
        ↓
최종 RecommendationProperties
  limit=10
  timeout=3s
  providerUrl=http://localhost:9090
  apiKey=환경 변수 값
```

Profile 파일은 전체 설정을 복사한 별도 문서가 아니라 환경마다 달라지는 값만 기록하는 덮어쓰기 계층으로 사용하면 중복을 줄일 수 있다.

## 15. Profile 활성화하기

### 15.1 PowerShell 환경 변수

```powershell
$env:SPRING_PROFILES_ACTIVE = "local"
.\mvnw.cmd spring-boot:run
```

실행 로그에서 활성 Profile을 확인한다. 로그에 예상한 Profile이 없다면 설정 파일 내용부터 수정하지 말고 활성화 값이 실제 프로세스에 전달되었는지 확인한다.

### 15.2 명령줄 인수

```powershell
java -jar .\target\reading-api.jar --spring.profiles.active=prod
```

명령줄 인수는 임시 확인에 유용하지만 실행 기록이나 프로세스 정보에 남을 수 있다. 비밀값 전달 수단으로 사용하지 않는다.

### 15.3 기본 설정 파일

```yaml
spring:
  profiles:
    active: local
```

공유되는 기본 파일에 `local`을 고정하면 운영 배포에서 실수로 함께 사용될 위험이 있다. 배포 환경이 활성 Profile을 명시하도록 하는 편이 경계를 분명하게 만든다.

### 15.4 금지되는 위치 이해하기

`spring.profiles.active`, `spring.profiles.default`, `spring.profiles.include`, Profile group 설정은 Profile 전용 문서 내부에서 자유롭게 재귀 활성화하는 용도로 쓰는 값이 아니다. 공식 문서가 허용하는 비 Profile 전용 문서에 둔다.

```yaml
# application-prod.yaml 안에서 다시 active를 바꾸려는 구조는 피한다.
spring:
  profiles:
    active: another-profile
```

활성화 출발점을 명확하게 유지해야 최종 상태를 추적할 수 있다.

## 16. `@Profile`로 Bean 구현 선택하기

설정값뿐 아니라 Bean 자체를 Profile에 따라 등록할 수 있다.

### 16.1 공통 계약

```java
package com.example.reading.notification;

public interface NotificationSender {
    void send(String message);
}
```

### 16.2 로컬 구현

```java
package com.example.reading.notification;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Profile("local")
@Component
public class LoggingNotificationSender implements NotificationSender {

    @Override
    public void send(String message) {
        // 로컬에서는 외부 서비스 대신 동작 확인용 로그를 남긴다.
        // 실제 코드에서는 표준 로거를 사용하고 민감한 내용을 제외한다.
        System.out.println("[LOCAL NOTIFICATION] " + message);
    }
}
```

### 16.3 운영 구현

```java
package com.example.reading.notification;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Profile("prod")
@Component
public class HttpNotificationSender implements NotificationSender {

    @Override
    public void send(String message) {
        // 운영 알림 서비스 호출 코드는 별도로 구현한다.
    }
}
```

`local` 또는 `prod` 중 하나가 활성화되면 `NotificationSender` 후보가 하나 생긴다. 아무 Profile도 활성화되지 않으면 이 타입의 Bean이 없어 다른 Bean 생성이 실패할 수 있다. 두 Profile이 동시에 활성화되면 후보가 두 개가 될 수 있다.

```text
No profile
  → 후보 0개 가능

local + prod 동시 활성
  → 후보 2개 가능
```

Profile 조합을 허용한다면 상호 배타 조건, `@Primary`, 별도 qualifier 등 명시적인 선택 정책을 설계한다.

### 16.4 값만 다르면 Bean을 나누지 않는다

외부 API URL 하나만 다르다면 동일한 Service 구현과 Profile 전용 설정값을 사용하는 편이 자연스럽다.

```text
구현 자체가 다름
  → @Profile Bean 검토

URL·timeout·limit만 다름
  → Profile 설정 파일 + ConfigurationProperties
```

환경마다 거의 같은 클래스를 복제하면 버그 수정이 한쪽에만 반영될 수 있다.

## 17. Profile group과 include

세부 Profile이 많으면 하나의 논리적 그룹으로 묶을 수 있다.

```yaml
spring:
  profiles:
    group:
      production:
        - proddb
        - metrics
        - external-notification
```

`production`을 활성화하면 그룹에 속한 Profile도 함께 활성화된다.

```powershell
$env:SPRING_PROFILES_ACTIVE = "production"
```

Profile group은 여러 활성 값을 줄이는 도구이지 복잡한 배포 정책을 숨기는 도구는 아니다. 어떤 그룹이 어떤 Profile을 활성화하는지 문서화한다.

`spring.profiles.include`는 기존 활성 Profile에 추가 Profile을 더할 때 사용할 수 있다. `active`의 대체와 `include`의 추가를 구분한다.

## 18. 비밀값 관리

### 18.1 비밀값은 무엇인가

- 데이터베이스 비밀번호
- 외부 API Key
- 서명용 Secret
- OAuth Client Secret
- 개인 접근 토큰
- 암호화 키

서버 포트나 공개 API URL은 설정이지만 보통 비밀은 아니다. 설정과 Secret은 겹칠 수 있지만 보안 요구사항이 다르다.

### 18.2 저장소에 커밋하지 않는다

다음 파일은 안전하지 않다.

```yaml
spring:
  datasource:
    password: actual-production-password
```

나중에 줄을 지워도 Git 과거 커밋에 남을 수 있다. 이미 커밋했다면 파일만 삭제하지 말고 다음 절차를 따른다.

1. 노출된 자격 증명을 즉시 폐기·교체한다.
2. 사용 로그와 접근 범위를 확인한다.
3. 필요하면 저장소 기록 정리 절차를 수행한다.
4. 새 값은 Secret 관리 경로로 제공한다.

비밀 교체가 Git 기록 삭제보다 먼저다. 기록에서 문자열이 사라져도 이미 복사된 비밀은 되돌릴 수 없다.

### 18.3 `.gitignore`만 믿지 않는다

`.gitignore`는 아직 추적되지 않은 파일이 새로 추가되는 것을 막는다. 이미 Git이 추적하는 파일에는 적용되지 않는다.

```powershell
# 특정 파일이 Git 추적 대상인지 확인한다.
git ls-files -- application-local.yaml
```

개인 로컬 설정 파일을 사용한다면 예시 템플릿과 실제 파일을 구분할 수 있다.

```text
application-local.example.yaml  ← 키 이름과 가짜 예시, 커밋 가능
application-local.secret.yaml   ← 실제 로컬 비밀, 커밋 금지
```

다만 개인 파일을 Spring이 어떻게 불러올지 명시적으로 설계해야 하며, 파일 이름만 만들면 자동 로드되는 것은 아니다.

### 18.4 환경 변수의 한계

환경 변수는 저장소에서 비밀을 분리하지만 완전한 Secret Manager는 아니다.

- 프로세스 진단 도구에서 보일 수 있다.
- CI 로그에 실수로 출력될 수 있다.
- 사용 기한·회전·감사 기능이 부족할 수 있다.
- 개발자 PC의 셸 기록이나 IDE 설정에 남을 수 있다.

운영에서는 배포 플랫폼의 Secret 기능이나 전용 Secret Manager를 우선 검토한다.

### 18.5 Config Tree

컨테이너 플랫폼은 Secret을 환경 변수 대신 파일로 마운트할 수 있다.

```text
/run/secrets/
├─ reading.api-key
└─ database.password
```

Spring Boot는 `configtree:` import로 파일 이름을 속성 키, 파일 내용을 값으로 읽을 수 있다.

```yaml
spring:
  config:
    import: optional:configtree:/run/secrets/
```

위 구조에서는 `reading.api-key`, `database.password` 같은 속성을 사용할 수 있다. `optional:`을 붙이면 경로가 없어도 계속 시작하므로, 반드시 필요한 운영 Secret에 무조건 사용하는 것이 맞는지 검토한다. 설정 객체 Validation으로 누락을 다시 확인할 수 있다.

### 18.6 로그와 응답에 출력하지 않는다

```java
// 좋지 않은 예: record의 모든 필드와 apiKey가 출력될 수 있다.
log.info("recommendation properties={}", properties);
```

필요한 비민감 항목만 선택해 기록한다.

```java
log.info(
        "recommendation provider={}, timeout={}",
        properties.providerUrl(),
        properties.timeout()
);
```

오류 응답에도 설정 원문, 연결 문자열, API Key, 내부 파일 경로를 포함하지 않는다.

## 19. 외부 설정 파일과 `spring.config.import`

기본 파일에서 다른 설정을 가져올 수 있다.

```yaml
spring:
  config:
    import: optional:file:./config/reading-extra.yaml
```

- `file:`은 파일 시스템 위치를 가리킨다.
- `classpath:`는 애플리케이션 클래스패스를 가리킨다.
- `optional:`이 없는데 파일이 없으면 시작 실패로 이어질 수 있다.

`spring.config.location`은 기본 검색 위치를 대체할 수 있고, `spring.config.additional-location`은 기본 위치에 추가할 수 있다. 이름이 비슷하지만 동작 차이가 크므로 배포 명령을 복사할 때 구분한다.

이 설정들은 어떤 파일을 읽을지 정하는 초기 단계에 필요하므로 환경 변수, 시스템 속성, 명령줄 인수처럼 이른 출처에서 제공해야 한다.

## 20. 목록과 Map 덮어쓰기 주의

단순 값은 높은 우선순위 값이 덮어쓴다고 이해하기 쉽다. 컬렉션은 병합 규칙을 별도로 확인해야 한다.

```yaml
# application.yaml
reading:
  allowed-genres:
    - novel
    - essay
```

```yaml
# application-prod.yaml
reading:
  allowed-genres:
    - technology
```

Profile 설정이 활성화되었을 때 목록이 `[novel, essay, technology]`로 자동 합쳐진다고 가정하지 않는다. Spring Boot 설정 바인딩에서 목록은 높은 우선순위의 전체 목록으로 대체되는 경우가 핵심이다. Map은 키 단위로 결합되는 동작을 보일 수 있어 자료구조에 따라 결과가 다르다.

설정 객체 테스트나 시작 로그의 안전한 요약으로 최종 구조를 확인한다.

## 21. 설정을 테스트하는 방법

### 21.1 설정 바인딩 통합 테스트

다음 테스트는 지정한 속성이 `RecommendationProperties`에 바인딩되는지 확인하는 예시다.

```java
package com.example.reading.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "reading.recommendation.limit=25",
        "reading.recommendation.timeout=1500ms",
        "reading.recommendation.provider-url=http://localhost:9191",
        "reading.recommendation.api-key=test-only-key"
})
class RecommendationPropertiesTest {

    @Autowired
    private RecommendationProperties properties;

    @Test
    void 외부_설정을_타입에_맞게_바인딩한다() {
        assertThat(properties.limit()).isEqualTo(25);
        assertThat(properties.timeout()).isEqualTo(Duration.ofMillis(1500));
        assertThat(properties.providerUrl())
                .isEqualTo(URI.create("http://localhost:9191"));

        // 비밀값은 존재 여부만 확인하고 실패 메시지에 원문을 출력하지 않는다.
        assertThat(properties.apiKey()).isNotBlank();
    }
}
```

이 테스트는 전체 ApplicationContext를 시작하므로 설정 등록과 바인딩을 함께 확인하지만 실행 범위가 크다. 뒤의 테스트 학습에서는 `ApplicationContextRunner` 같은 더 작은 설정 테스트 도구도 다룰 수 있다.

### 21.2 Profile 활성 테스트

```java
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@ActiveProfiles("local")
@SpringBootTest(properties = "reading.recommendation.api-key=test-only-key")
class LocalProfileTest {

    @Autowired
    private Environment environment;

    @Test
    void local_Profile이_활성화된다() {
        assertThat(environment.matchesProfiles("local")).isTrue();
    }
}
```

테스트에서 운영 Secret이나 운영 외부 서비스 주소를 사용하지 않는다. 테스트가 필요한 속성만 명시적으로 제공한다.

## 22. 예상과 다른 설정값 진단하기

설정이 예상과 다르면 값을 계속 덮어쓰기 전에 출처를 추적한다.

### 22.1 확인 순서

```text
1. 현재 실행 명령과 작업 디렉터리 확인
2. 활성 Profile 확인
3. 속성의 canonical key 확인
4. application 및 Profile 파일 검색
5. 외부 config/ 파일 존재 확인
6. 현재 프로세스의 환경 변수 확인
7. Java 시스템 속성·명령줄 인수 확인
8. 최종 타입 변환·Validation 오류 확인
```

PowerShell에서는 특정 환경 변수만 안전하게 확인한다.

```powershell
# 비밀값 자체를 출력하지 않고 존재 여부만 확인한다.
Test-Path Env:READING_PROVIDER_API_KEY

# 비민감 설정은 값을 확인할 수 있다.
$env:READING_RECOMMENDATION_LIMIT
$env:SPRING_PROFILES_ACTIVE
```

전체 환경 변수를 로그나 화면에 한꺼번에 출력하면 토큰과 비밀번호가 노출될 수 있다.

### 22.2 시작 로그 확인

다음 항목을 본다.

- 활성 Profile 이름
- 읽은 설정 파일 관련 오류
- 바인딩 실패 property와 목표 타입
- Validation 실패 이유
- 실제 서버 포트
- 외부 서비스·DB 초기화 실패의 가장 안쪽 `Caused by`

로그의 마지막 한 줄만 보지 말고 최초 원인과 가장 안쪽 예외를 연결한다.

### 22.3 Actuator 진단 기능 주의

Actuator의 `env`, `configprops` endpoint는 예상과 다른 설정값을 진단하는 데 도움을 줄 수 있다. 그러나 운영에서 무심코 외부에 노출하면 내부 구성 정보가 드러날 수 있다.

- 필요한 endpoint만 노출한다.
- 인증·인가와 네트워크 접근을 제한한다.
- 민감값 마스킹 정책을 확인한다.
- 응답을 공유하기 전에 Secret이 포함되지 않았는지 확인한다.

Actuator의 구체적인 노출 정책은 운영 기초 학습에서 다시 다룬다.

## 23. 자주 하는 실수

### 23.1 Profile이 비밀을 보호한다고 생각함

`application-prod.yaml`도 저장소에 커밋되면 누구나 값을 볼 수 있다. Profile은 선택 기능이고 암호화 기능이 아니다.

### 23.2 `.env`가 자동 적용된다고 생각함

누가 `.env`를 읽어 프로세스 환경 변수로 전달하는지 확인한다. Spring Boot 기본 동작만으로 자동 로드된다고 가정하지 않는다.

### 23.3 설정 파일 형식을 섞음

Properties와 YAML에 같은 키가 중복되면 실제 출처를 찾기 어렵다. 프로젝트 형식을 하나로 정한다.

### 23.4 모든 값에 기본값을 넣음

필수 API Key와 DB 주소까지 로컬 기본값을 두면 운영 설정 누락을 숨길 수 있다. 누락 시 실패해야 하는 값은 명시적으로 검증한다.

### 23.5 환경 변수 이름을 잘못 변환함

점은 밑줄로 바꾸고 하이픈은 제거하는 규칙을 구분한다. 가능하면 단순하고 일관된 키 구조를 사용한다.

### 23.6 설정 객체 전체를 로그로 남김

record의 자동 `toString()`에는 모든 구성 요소가 포함된다. Secret 필드가 있는 설정 객체를 통째로 로깅하지 않는다.

### 23.7 Profile마다 같은 Bean 코드를 복제함

값만 다르다면 하나의 구현에 Profile 설정값을 주입한다. 구현 책임이 실제로 다를 때만 `@Profile` Bean을 검토한다.

### 23.8 명령줄로 비밀을 전달함

명령줄 인수는 프로세스 목록, 셸 기록, 배포 로그에 남을 수 있다. 비밀 전달에는 플랫폼 Secret 기능을 사용한다.

### 23.9 설정 오류를 코드 오류로 착각함

같은 JAR이 한 환경에서만 실패한다면 코드 diff뿐 아니라 환경 변수, Profile, 외부 파일, 네트워크 주소를 함께 비교한다.

## 24. 적용 관점에서 다시 보기

### 24.1 새 설정을 추가하는 순서

```text
1. 환경마다 달라질 값인지 판단
2. 의미 있는 prefix와 canonical key 설계
3. ConfigurationProperties 타입에 필드 추가
4. 단위와 Java 타입 결정
5. 필수값·범위 Validation 추가
6. 안전한 공통 기본값만 application 파일에 기록
7. 환경별 비민감값은 Profile 파일로 분리
8. Secret은 환경·배포 플랫폼에서 제공
9. 바인딩 테스트와 시작 실패 테스트 확인
10. 운영에서 최종값 출처를 진단할 방법 준비
```

### 24.2 설정과 코드 책임 구분

| 질문 | 설정 책임 | 코드 책임 |
| --- | --- | --- |
| 외부 API 주소는 어디인가? | 설정 | 주소를 이용해 요청 생성 |
| timeout은 몇 초인가? | 설정 | timeout 발생 시 처리 |
| 추천 개수 상한은 얼마인가? | 설정 가능 | 범위 검증과 적용 |
| 빈 제목을 허용하는가? | 핵심 도메인 규칙 | Service·Validation |
| API Key를 Header에 어떻게 넣는가? | 값은 설정 | Header 구성은 코드 |

설정은 정책값을 제공하지만 동작 자체를 대신 구현하지 않는다.

### 24.3 배포 전 체크리스트

- [ ] 활성 Profile을 명시했는가?
- [ ] 필수 환경 변수와 Secret이 제공되는가?
- [ ] Secret이 Git과 로그에 없는가?
- [ ] 운영 외부 URL과 DB 주소가 맞는가?
- [ ] timeout·연결 수·요청 제한의 단위가 맞는가?
- [ ] 설정 객체 Validation이 통과하는가?
- [ ] 명령줄이나 외부 파일이 예상치 못하게 값을 덮어쓰지 않는가?
- [ ] 설정 진단 endpoint의 접근이 제한되는가?

## 25. 배운 점과 다음 학습 연결

### 25.1 새로 이해한 것

- 외부 설정은 같은 코드가 여러 환경에서 동작하게 만든다.
- Environment는 여러 PropertySource의 값을 우선순위에 따라 제공한다.
- 설정 파일은 전체 출처 중 하나이며 더 높은 출처가 값을 덮어쓸 수 있다.
- 관련 설정은 `@ConfigurationProperties`로 묶고 타입과 제약을 검증한다.
- Profile은 설정 문서와 Bean 선택 도구이지 Secret 보호 기능이 아니다.
- 환경 변수도 노출 위험이 있으므로 운영 Secret Manager와 접근 정책이 필요하다.
- 최종 설정 문제는 key·Profile·PropertySource·변환·검증 순서로 진단한다.

### 25.2 이전 학습과 연결

이전 노트에서는 클라이언트 요청 DTO를 Bean Validation으로 검증했다. 이번에는 애플리케이션을 시작시키는 외부 설정 객체도 신뢰하지 않고 바인딩과 Validation으로 검증했다.

```text
HTTP 요청 DTO 검증
  → 잘못된 사용자 입력을 4xx로 표현

ConfigurationProperties 검증
  → 잘못된 배포 설정이면 시작 단계에서 실패
```

### 25.3 다음 학습

다음에는 **데이터 접근 기초**를 학습한다.

- JDBC가 데이터베이스와 통신하는 과정
- JPA와 ORM의 목적
- Spring Data JPA가 줄여 주는 반복 코드
- DataSource와 연결 풀
- Repository 계층의 책임
- Entity와 DTO를 분리하는 이유

## 26. 요약 정리

1. 환경마다 달라지는 값과 Secret은 Java 코드에서 분리한다.
2. Spring Boot는 파일·환경 변수·시스템 속성·명령줄 등 여러 PropertySource를 Environment로 통합한다.
3. 같은 키는 더 높은 우선순위의 출처가 덮어쓰므로 최종값과 출처를 함께 확인한다.
4. Properties와 YAML 중 한 형식을 정하고 같은 위치의 중복 키를 만들지 않는다.
5. 환경 변수 이름은 점을 밑줄로 바꾸고 하이픈을 제거한 뒤 대문자로 만든다.
6. `.env`는 Spring Boot가 기본으로 자동 로드하는 파일이 아니다.
7. 관련된 애플리케이션 설정은 `@ConfigurationProperties`로 묶어 타입 변환과 Validation을 적용한다.
8. 필수 Secret에는 실제 기본값을 두지 않고 시작 시 누락을 발견한다.
9. Profile 파일은 공통 설정을 복제하지 않고 환경별 차이만 덮어쓴다.
10. `@Profile`은 구현 자체가 달라질 때 사용하고 값만 다르면 같은 Bean에 설정을 주입한다.
11. Profile은 Secret 암호화가 아니며 운영 비밀은 플랫폼 Secret 기능이나 전용 저장소로 관리한다.
12. 설정 오류는 활성 Profile, key, 출처, 우선순위, 타입 변환, Validation 순서로 진단한다.

🧠 기억할 것: **코드는 동작을 정의하고, 외부 설정은 환경별 값을 제공하며, 최종값은 PropertySource 우선순위와 Profile을 거쳐 타입 안전한 객체로 검증한다.**

## 27. 미니 퀴즈

1. 같은 JAR을 개발과 운영에서 사용할 수 있게 하는 외부 설정의 핵심 목적은 무엇인가?
2. `application.yaml`의 값과 환경 변수의 같은 키가 다르면 일반적으로 어느 값이 우선하는가?
3. `reading.remote-base-url`을 환경 변수 이름으로 바꾸면 어떻게 되는가?
4. 관련 설정이 네 개 이상일 때 `@Value`보다 `@ConfigurationProperties`가 유리한 이유는 무엇인가?
5. `@ConfigurationProperties` record를 Bean으로 등록하는 두 가지 방법은 무엇인가?
6. Profile 전용 파일에 운영 비밀번호를 적으면 안 되는 이유는 무엇인가?
7. `.env` 파일을 만들었는데 값이 적용되지 않을 때 무엇부터 확인해야 하는가?
8. 구현은 같고 외부 API URL만 환경마다 다르다면 `@Profile` Bean과 Profile 설정 중 무엇이 더 자연스러운가?
9. 필수 API Key에 기본값을 두지 않는 이유는 무엇인가?
10. 설정 객체 전체를 로그로 출력하면 어떤 보안 문제가 생길 수 있는가?
11. `local`과 `prod` Bean이 동시에 활성화되어 같은 인터페이스 후보가 두 개라면 어떤 문제가 생기는가?
12. 예상과 다른 설정값이 사용될 때 확인할 순서를 설명해 보자.

<details>
<summary>정답과 해설</summary>

1. 환경별 값을 코드와 분리해 같은 빌드 결과물을 다시 빌드하지 않고 여러 환경에서 실행하는 것이다.
2. 공식 우선순위에서 OS 환경 변수가 Config Data보다 뒤에 있어 일반적으로 환경 변수 값이 덮어쓴다.
3. 점을 밑줄로 바꾸고 하이픈을 제거해 `READING_REMOTEBASEURL`이 된다.
4. 관련 값을 하나의 타입으로 묶고 relaxed binding, 타입 변환, Validation, 메타데이터 지원을 활용할 수 있기 때문이다.
5. `@ConfigurationPropertiesScan`으로 탐색하거나 `@EnableConfigurationProperties`로 대상을 명시할 수 있다.
6. Profile 파일도 Git에 커밋되는 일반 설정 파일일 수 있고 Profile은 값을 암호화하지 않기 때문이다.
7. IDE·Docker Compose·별도 도구 중 누가 `.env`를 읽어 실제 프로세스 환경 변수로 전달해야 하는지 확인한다.
8. 하나의 Bean 구현에 Profile별 설정값을 주입하는 방식이 중복을 줄인다.
9. 운영에서 값이 누락되어도 가짜 기본값으로 시작하는 문제를 막고 시작 단계에서 실패시키기 위해서다.
10. record의 `toString()` 등을 통해 API Key·비밀번호가 로그 저장소와 모니터링 화면에 노출될 수 있다.
11. 타입 기준 주입이 모호해져 Bean 후보 선택 오류가 발생할 수 있으므로 활성 조건이나 선택 정책을 명시해야 한다.
12. 실행 위치와 명령, 활성 Profile, canonical key, 내부·외부 설정 파일, 환경 변수, 시스템 속성·명령줄, 변환·검증 오류 순으로 추적한다.

</details>

## 참고 자료

- [Spring Boot — Externalized Configuration](https://docs.spring.io/spring-boot/reference/features/external-config.html)
- [Spring Boot — Profiles](https://docs.spring.io/spring-boot/reference/features/profiles.html)
- [Spring Boot — Properties and Configuration](https://docs.spring.io/spring-boot/how-to/properties-and-configuration.html)
- [Spring Framework — Environment Abstraction](https://docs.spring.io/spring-framework/reference/core/beans/environment.html)
- [Spring Boot — Actuator Endpoints](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)

> 정리 기준일: 2026-09-02. 설정 우선순위, Profile 활성 규칙과 바인딩 방식은 프로젝트가 사용하는 Spring Boot 버전의 공식 문서를 우선한다.
