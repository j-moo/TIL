# Spring Boot 운영 첫걸음: 로깅·Actuator·상태 점검과 안전한 종료

- 🎯 학습 목표: 실행 중인 서버의 상태를 관찰하고, 관리 엔드포인트의 노출·권한과 liveness·readiness를 구분한다.
- 🧩 핵심 키워드: SLF4J, 로그 레벨, Actuator, endpoint access·exposure, health, metrics, liveness, readiness, graceful shutdown
- ⭐ 중요도: ★★★★★ — 서버 프로세스가 떠 있다는 사실만으로 사용자의 요청을 정상 처리한다고 볼 수 없다.
- 📝 한눈에 보는 내용: 로그로 사건을 읽고, 상태 점검으로 트래픽 수신 여부를 판단하며, 메트릭으로 변화 추세를 관찰한다. 운영 정보는 필요한 범위만 노출하고 거부 경로도 테스트한다.
- 🧱 선수 지식: 외부 설정·Profile, Spring Security의 필터·인증·인가, MockMvc 통합 테스트
- 🔗 이전 노트: [Spring Security 인증·인가](../11_09_07_Spring_Security_Fundamentals/09_07_Spring_Security_Fundamentals.md)

> 정리 기준일: 2026-09-08. Spring Boot 4.1 계열과 Spring Security 7.1 공식 문서를 기준으로 작성했다. 아래 실습은 이전 보안 노트의 별도 로컬 프로젝트를 확장한다. 이 TIL 저장소에서 Java 컴파일이나 Spring 테스트를 실행하지 않았으며, 상태 코드·JSON·테스트 건수는 예상 결과다. 실제 배포·모니터링 서버 구축은 범위에 포함하지 않는다.

## 1. 서버가 켜져 있는데 사용자는 왜 실패할까?

도서 서비스를 배포한 뒤 Java 프로세스가 실행 중인 것을 확인했다고 하자. 하지만 DB 연결이 모두 사용 중이거나, 초기 데이터 준비가 끝나지 않았거나, 일부 요청만 예외로 실패할 수 있다. “프로세스가 있다”와 “새 요청을 처리할 준비가 됐다”는 서로 다른 상태다.

문제를 찾으려면 어떤 사건이 일어났는지, 현재 어떤 상태인지, 시간이 지나며 얼마나 나빠지는지를 구분해 관찰해야 한다. 로그만 계속 출력하거나 모든 관리 API를 열어 두는 것으로 해결되지 않는다.

이번 노트는 이전 보안 프로젝트에 최소한의 운영 관찰 기능을 추가한다. 관리 정보를 공개하는 기능에도 인증·인가가 필요하다는 점을 함께 확인한다.

## 2. 로그·상태 점검·메트릭의 역할 지도

| 관찰 수단 | 답하려는 질문 | 예 |
| --- | --- | --- |
| 로그(log) | 특정 시점에 무슨 사건이 있었는가? | 외부 조회 실패, 작업 시작·완료 |
| 상태 점검(health) | 정의한 기준에서 지금 어떤 상태인가? | UP, DOWN, OUT_OF_SERVICE |
| 메트릭(metric) | 수치가 시간에 따라 어떻게 변하는가? | 요청 수, 응답 시간, 메모리 사용량 |
| 추적(trace) | 한 요청이 여러 구성 요소를 어떻게 통과했는가? | 서버 → 외부 API → DB 호출의 구간 |

```text
사용자 요청 → 보안 필터 → Controller·Service → 결과
                      ├─ 로그: 사건과 필요한 맥락
                      └─ 메트릭·추적: 횟수·시간·호출 구간

운영 도구 → 상태 점검 URL → 정의된 health 그룹의 상태
         → 권한 있는 metrics 조회 또는 별도 수집 시스템
```

Actuator는 운영 관찰·관리 기능을 제공하는 Spring Boot 구성이다. 모든 로그를 보관하는 서비스나 완성된 대시보드 자체는 아니다. 관측 가능성(observability)은 외부에서 얻은 신호로 내부 상태를 이해하는 관점이며, 실제 수집·저장·조회 도구까지 연결해야 운영에 활용할 수 있다. [Boot Observability 문서](https://docs.spring.io/spring-boot/reference/actuator/observability.html)를 참고한다.

## 3. 로깅: println 대신 사건을 구분해서 남긴다

### 3.1 로그 레벨은 중요도와 조사 목적을 나눈다

| 레벨 | 이 노트에서의 사용 기준 |
| --- | --- |
| ERROR | 요청·작업 실패처럼 원인 조사와 대응이 필요한 사건 |
| WARN | 당장 전체 실패는 아니어도 주의가 필요한 상태 |
| INFO | 운영 흐름을 이해하는 주요 사건 |
| DEBUG | 특정 문제를 조사할 때 필요한 상세 정보 |
| TRACE | 더욱 세밀한 흐름 추적 |

모든 요청을 ERROR로 기록하면 실제 장애 신호가 묻힌다. 반대로 예상치 못한 실패를 INFO로만 남기면 경보 기준에서 놓칠 수 있다. 중요한 것은 “예외가 있으면 무조건 ERROR”가 아니라 그 사건이 사용자와 운영에 미치는 영향이다.

Spring Boot의 일반적인 Starter 구성에서는 SLF4J API와 Logback 구현을 사용한다. SLF4J는 로그를 남기는 코드의 공통 창구이고, 실제 출력·형식·저장 처리는 로깅 구현과 설정이 맡는다. 기본 콘솔 출력에 파일 저장이 자동으로 포함된다고 가정하지 않는다. [Boot 로깅 공식 문서](https://docs.spring.io/spring-boot/reference/features/logging.html)를 참고한다.

### 3.2 기존 공개 안내 메서드에 작은 로그를 추가한다

아래는 **기존 `StudyController.java`를 수정하는 조각**이다. 클래스 전체를 새로 만드는 코드가 아니다. 기존 import에 `Logger`, `LoggerFactory`를 추가하고, 클래스 안에 필드를 추가한 뒤 기존 `info()` 메서드를 교체한다. 기존 `Map`, `GetMapping` import와 다른 메서드는 유지한다.

```java
import org.slf4j.Logger; // 로그를 기록하는 공통 API다.
import org.slf4j.LoggerFactory; // 클래스 이름을 기준으로 Logger를 만든다.
```

```java
private static final Logger log = LoggerFactory.getLogger(StudyController.class); // 같은 클래스의 로그를 구분할 이름을 사용한다.

@GetMapping("/public/info") // 이전과 같은 공개 조회 경로다.
public Map<String, String> info() { // 학습용으로 이 요청의 처리 시간을 관찰한다.
    long startedAt = System.nanoTime(); // 벽시계 시각이 아니라 경과 시간 측정의 시작점을 잡는다.
    Map<String, String> response = Map.of("message", "도서 서비스 안내"); // 기존 응답 계약을 유지한다.
    long elapsedNanos = System.nanoTime() - startedAt; // 응답 데이터를 만드는 데 걸린 시간을 구한다.
    log.info("event=public_info_returned elapsedNanos={}", elapsedNanos); // 고정 사건명과 숫자만 기록한다.
    return response; // MVC가 JSON으로 변환하도록 반환한다.
}
```

이 시간에는 네트워크 왕복, 보안 필터, 이후 JSON 직렬화가 모두 포함되지 않는다. 따라서 전체 HTTP 응답 시간이라고 해석하면 안 된다. 운영에서 매 요청 INFO 로그가 필요한지도 별도로 판단하고, 빈도·샘플링·저장 비용을 고려한다.

`{}` 자리표시자는 문자열 연결 대신 값을 전달하는 방법이다. 로그 레벨이 꺼져 있을 때 불필요한 문자열 조합을 줄일 수 있지만, 인자로 넘긴 비싼 메서드 호출 자체를 자동으로 생략하지는 않는다. 또 자리표시자는 비밀값을 마스킹하거나 외부 입력의 줄바꿈을 정제하는 기능이 아니다. [SLF4J 사용 설명](https://www.slf4j.org/manual.html)을 참고한다.

### 3.3 남기면 안 되는 정보도 정한다

- 비밀번호, Authorization 헤더, 세션 쿠키, 접근·갱신 토큰을 남기지 않는다.
- 요청·응답 객체 전체의 `toString()`을 무심코 기록하지 않는다.
- 사용자 입력을 남겨야 하면 길이 제한·민감값 제거·줄바꿈 처리 등 정책을 정한다.
- 같은 예외를 모든 계층에서 반복 기록하지 말고 책임 있는 경계에서 필요한 맥락을 남긴다.
- 예외 메시지와 stack trace에도 SQL·경로·입력값이 포함될 수 있으므로 공개 범위를 제한한다.

이번 예제는 자유 입력이나 인증 주체 대신 고정 사건명과 숫자만 남긴다. 실제 서비스의 감사 로그는 일반 디버깅 로그와 목적·보관 기간·접근 권한을 별도로 정해야 한다.

## 4. 관리 엔드포인트는 세 단계로 판단한다

`/actuator/metrics`에 접근할 수 있는지 보려면 세 질문을 분리한다.

| 단계 | 질문 | 주요 설정·도구 |
| --- | --- | --- |
| 기능 접근 수준 | 이 엔드포인트의 기능을 사용할 수 있게 둘 것인가? | `management.endpoint.<id>.access` |
| 전송 방식별 노출 | 그 기능을 HTTP 등으로 제공할 것인가? | `management.endpoints.web.exposure.include` |
| 요청자 권한 | 이 요청자가 호출해도 되는가? | `SecurityFilterChain` |

`read-only`는 엔드포인트 작업의 접근 수준이지 “읽기 전용 관리자 계정”이라는 뜻이 아니다. `include`에 넣는 것도 인증을 추가하는 설정이 아니다. 반대로 Security에서 허용해도 제공하지 않는 엔드포인트가 새로 생기지는 않는다.

Boot 4.1의 access 설정은 `none`, `read-only`, `unrestricted` 등을 사용한다. 이전 버전의 `enabled` 예제와 섞지 말고 사용하는 버전의 문서를 확인한다. [Actuator access·exposure·보안 문서](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)를 참고한다.

## 5. 이전 실습 프로젝트를 확장한다

### 5.1 유지할 파일과 수정할 파일

이전 [Security 노트](../11_09_07_Spring_Security_Fundamentals/09_07_Spring_Security_Fundamentals.md)의 `com.example.securitystudy` 프로젝트를 사용한다. JPA·DB 의존성은 추가하지 않는다.

| 대상 | 작업 |
| --- | --- |
| 빌드 파일 | `spring-boot-starter-actuator` 추가 |
| `SecurityStudyApplication.java` | 그대로 유지 |
| `application.yaml` | 아래 전체 설정으로 교체 |
| `SecurityConfig.java` | import 하나 추가, 보안 체인 메서드 교체; 인코더·계정 Bean 유지 |
| `StudyController.java` | 앞 절의 로그 import·필드·메서드 반영 |
| `OperationsBoundaryTest.java` | 테스트 소스 패키지에 새 파일 추가 |
| 이전 `SecurityBoundaryTest.java` | 그대로 유지하여 기존 계약도 함께 확인 |

Maven의 기존 `dependencies` 안에 다음 항목을 추가한다. 기존 웹·보안·테스트 Starter는 유지하고 버전은 Boot가 관리하도록 둔다.

```xml
<!-- 실행 중인 서버의 상태와 지표를 제공하는 Actuator를 추가한다. -->
<dependency>
    <!-- Spring Boot가 제공하는 의존성이다. -->
    <groupId>org.springframework.boot</groupId>
    <!-- 버전은 기존 Boot 의존성 관리에서 가져온다. -->
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

### 5.2 application.yaml 전체 교체본

기존 환경 변수 기반 비밀번호 설정과 로컬 바인딩을 유지한다. 관리 포트는 따로 열지 않으며, 아래 예제는 기본 `/actuator` 경로를 전제로 한다.

```yaml
server: # 로컬 실습 서버 설정이다.
  address: 127.0.0.1 # 외부 네트워크 인터페이스에 실습 서버를 공개하지 않는다.
  shutdown: graceful # 종료 시 진행 중인 요청에 완료 기회를 주는 정책을 명시한다.
spring: # Spring 애플리케이션 공통 설정이다.
  application: # 로그 등에서 사용할 애플리케이션 이름을 묶는다.
    name: security-operations-study # 실습 서비스를 구분하는 이름이다.
  lifecycle: # 종료 수명주기 설정이다.
    timeout-per-shutdown-phase: 20s # 종료 단계별 대기 제한이며 전체 종료 시간의 절대 상한은 아니다.
demo: # 이전 보안 예제의 사용자 정의 설정이다.
  security: # 메모리 실습 계정을 만드는 입력값이다.
    reader-password: ${DEMO_READER_PASSWORD} # 직접 실행 시 환경에서 전달한다.
    admin-password: ${DEMO_ADMIN_PASSWORD} # 실제 운영 비밀번호를 재사용하지 않는다.
logging: # 로그를 출력할 범위를 설정한다.
  level: # 패키지별 최소 출력 레벨을 지정한다.
    root: INFO # 모든 라이브러리를 DEBUG로 출력하지 않는다.
    com.example.securitystudy: INFO # 실습의 사건 로그를 볼 수 있게 한다.
management: # Actuator 설정의 시작점이다.
  endpoints: # 여러 관리 엔드포인트에 적용할 기본 정책이다.
    access: # 기능 접근 수준을 제어한다.
      default: none # 명시하지 않은 엔드포인트는 사용할 수 없게 한다.
    web: # HTTP 노출 설정이다.
      exposure: # HTTP로 제공할 엔드포인트 목록이다.
        include: health,metrics # 전체 공개 와일드카드 대신 필요한 두 기능만 선택한다.
  endpoint: # 개별 엔드포인트 설정이다.
    health: # 상태 점검 기능이다.
      access: read-only # 상태 조회만 사용할 수 있게 한다.
      show-details: never # 내부 검사 결과의 상세값은 응답에 공개하지 않는다.
      show-components: never # 구성 요소 목록도 응답에 공개하지 않는다.
      probes: # liveness·readiness 그룹 사용 여부를 명시한다.
        enabled: true # 실습 환경에서도 두 상태 점검 경로를 사용한다.
    metrics: # 메트릭 조회 기능이다.
      access: read-only # 지표 조회를 사용할 수 있게 한다. 요청 권한은 별도로 설정한다.
```

처음에는 health와 metrics만 선택한다. `env`, `configprops`, `heapdump`, `loggers`, `shutdown` 같은 관리 기능을 단지 편리하다는 이유로 추가하지 않는다. 이 설정의 목적은 진단에 필요한 최소 기능을 선택하는 것이다.

## 6. Actuator 접근도 기존 보안 체인에서 보호한다

이미 사용자 정의 `SecurityFilterChain`이 있으면 Actuator 보안을 자동 설정이 전부 대신해 준다고 가정하면 안 된다. 기존 체인에 관리 경로의 정책을 명시한다. [Actuator 보안 설정 설명](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)을 참고한다.

`SecurityConfig.java`의 기존 import에 다음 하나를 추가한다. Boot 4의 패키지 이름이다.

```java
import org.springframework.boot.security.autoconfigure.actuate.web.servlet.EndpointRequest; // Actuator의 실제 엔드포인트 위치를 매칭한다.
```

다음은 **기존 `securityFilterChain` 메서드 전체 교체본**이다. 같은 이름의 Bean을 추가로 만들지 않는다. 기존 import, `PasswordEncoder`, `UserDetailsService` Bean과 두 계정은 유지한다.

```java
@Bean // 모든 요청에 적용하는 기존 보안 체인 하나를 유지한다.
SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception { // 기존 HttpSecurity 설정 도구를 받는다.
    http.authorizeHttpRequests(authorize -> authorize // 구체적인 공개 규칙부터 차례로 확인한다.
            .requestMatchers(HttpMethod.GET, // 상태 점검의 조회 요청만 허용한다.
                    "/actuator/health", // 전체 상태의 요약 경로다.
                    "/actuator/health/liveness", // 프로세스의 liveness 상태를 확인한다.
                    "/actuator/health/readiness").permitAll() // 요청 수신 준비 상태를 인증 없이 점검한다.
            .requestMatchers(EndpointRequest.toAnyEndpoint()).hasRole("ADMIN") // 나머지 Actuator와 링크 조회에는 관리자 역할이 필요하다.
            .requestMatchers(HttpMethod.GET, "/public/info").permitAll() // 이전 공개 API 정책을 유지한다.
            .requestMatchers(HttpMethod.GET, "/api/me").authenticated() // 이전 본인 조회의 인증 조건을 유지한다.
            .requestMatchers(HttpMethod.POST, "/admin/reindex").hasRole("ADMIN") // 기존 관리자 모의 작업도 유지한다.
            .anyRequest().denyAll() // 그 밖의 경로는 기본 거부한다.
    ); // HTTP 인가 규칙을 마친다.
    http.httpBasic(Customizer.withDefaults()); // 이전 로컬 실습의 Basic 인증 방식을 유지한다.
    http.csrf(Customizer.withDefaults()); // 관찰 기능을 추가한다고 기존 CSRF 보호를 제거하지 않는다.
    return http.build(); // 실제 보안 필터 체인을 만든다.
}
```

공개 health 규칙을 관리자 규칙보다 앞에 둔 이유는 처음 일치하는 인가 규칙을 사용하기 때문이다. health 전체의 모든 하위 경로를 공개하지 않고 필요한 세 GET 경로만 명시했다. 기본 경로나 context path, 추가 probe 경로를 바꾸면 이 규칙과 테스트도 다시 맞춘다.

`EndpointRequest`는 Actuator 경로를 위한 도구지만 앞에서 직접 적은 공개 경로까지 자동으로 변경해 주지는 않는다. 관리 포트를 분리하는 경우에도 네트워크·인증 정책이 자동 완성되는 것은 아니다. [EndpointRequest API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/security/autoconfigure/actuate/web/servlet/EndpointRequest.html)를 참고한다.

이 실습은 localhost에 한정된 Basic 인증을 이어 쓴다. 실제 운영에서는 HTTPS, 관리망 접근 제한, 운영자 권한과 감사 정책을 함께 설계한다. 프로세스 상태만 담은 health도 서비스 가용성을 외부에 알려 주므로 실제 공개 여부는 인프라 요구에 맞춰 판단한다.

## 7. health의 UP은 무엇을 보장할까?

정상 시작했고 등록된 상태 검사들이 정상이면 `GET /actuator/health`에서 다음과 같은 요약을 기대한다. health 그룹 이름 등의 부가 필드는 구성에 따라 포함될 수 있다.

```json
{
  "status": "UP"
}
```

이 결과는 정의된 검사 범위의 요약이다. 모든 REST API의 업무 결과, DB 데이터의 정확성, 외부 결제 흐름까지 검증했다는 뜻은 아니다. 현재 프로젝트에는 DB가 없으므로 이 결과로 JPA·DB 연결을 검증했다고 말할 수도 없다.

health 상태와 HTTP 상태 코드도 구분한다. 기본 매핑에서 `DOWN`, `OUT_OF_SERVICE`는 503으로 연결된다. 상세값을 숨긴다고 장애 상태까지 항상 200으로 바뀌는 것은 아니다. 운영 중 매핑을 사용자 정의했다면 실제 코드도 함께 확인한다. [Health API의 응답 구조](https://docs.spring.io/spring-boot/api/rest/actuator/health.html)를 참고한다.

### 7.1 liveness와 readiness를 분리한다

| 상태 점검 | 핵심 질문 | 실패 시 인프라가 취하는 대표 행동 |
| --- | --- | --- |
| liveness | 이 인스턴스가 살아서 회복 가능한 상태인가? | 설정된 실패 기준에 따라 컨테이너 재시작 |
| readiness | 지금 새 요청을 받아도 되는가? | Service 트래픽 전달 대상에서 제외 |
| startup | 초기 시작이 끝났는가? | 시작 동안 다른 probe의 조기 개입을 늦춤 |

이 행동은 Kubernetes 같은 인프라에 probe를 연결했을 때의 동작이다. URL이 503을 반환한다고 Spring Boot가 스스로 프로세스를 재시작하거나 모든 일반 API 요청을 차단하는 것은 아니다. 실제 라우팅 중단까지 보려면 인프라 설정과 관찰이 필요하다. [Kubernetes probe 개념](https://kubernetes.io/docs/concepts/workloads/pods/probes/)을 참고한다.

Boot의 기본 liveness·readiness 그룹에는 다른 외부 의존성 검사가 자동으로 모두 들어가지 않는다. DB 장애를 liveness와 직접 연결하면 인스턴스를 재시작해도 외부 DB는 복구되지 않는데 재시작이 반복될 수 있다. readiness에 외부 의존성을 넣을 때도 전체 인스턴스가 동시에 제외되는 영향을 검토한다. [Boot probe 구성](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html#actuator.endpoints.kubernetes-probes)을 참고한다.

### 7.2 별도 관리 포트가 항상 더 정확한 상태 점검은 아니다

관리 포트는 업무 포트와 별도의 웹 인프라를 사용할 수 있다. 따라서 관리 포트만 정상이어도 실제 사용자 요청 포트는 고장일 수 있다. 이번 실습은 같은 포트를 사용한다.

포트를 분리해야 한다면 `management.server.port`, 관리 주소·방화벽과 실제 사용자 포트의 probe를 함께 설계한다. 단순히 다른 포트로 옮겼다고 인터넷에서 접근할 수 없게 되는 것은 아니다. [HTTP 관리 포트 설정](https://docs.spring.io/spring-boot/reference/actuator/monitoring.html)을 참고한다.

## 8. 상태·권한·노출을 서로 다른 검증으로 확인한다

### 8.1 테스트 구성과 격리

새 파일 `src/test/java/com/example/securitystudy/OperationsBoundaryTest.java`를 추가한다. 이전 계정을 만드는 가짜 비밀번호를 테스트 Property로 전달한다. 이 값은 실제 계정 비밀번호가 아니다.

테스트에서 readiness 상태를 바꾸므로 전후에 정상 상태를 복원한다. 기본 순차 실행을 전제로 하며, 같은 Spring 문맥의 가용성 상태를 변경하는 테스트를 병렬 실행하지 않는다. 디스크 여유 공간에 따라 결과가 흔들리지 않도록 **테스트에서만** diskspace 검사를 제외한다. 운영 디스크 검사를 제거하라는 뜻이 아니다.

```java
package com.example.securitystudy; // 기존 애플리케이션 시작 구성을 찾는 패키지다.

import static org.assertj.core.api.Assertions.assertThat; // 노출된 엔드포인트 목록을 비교한다.
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get; // GET 요청을 만든다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath; // 응답 JSON의 값을 확인한다.
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status; // HTTP 상태 코드를 확인한다.

import java.util.List; // 엔드포인트 ID 목록을 보관한다.
import org.junit.jupiter.api.AfterEach; // 테스트 뒤 상태를 복원한다.
import org.junit.jupiter.api.BeforeEach; // 테스트 전 초기 상태를 맞춘다.
import org.junit.jupiter.api.Test; // 테스트 메서드를 선언한다.
import org.springframework.beans.factory.annotation.Autowired; // 테스트 문맥의 Bean을 받는다.
import org.springframework.boot.actuate.endpoint.web.WebEndpointsSupplier; // HTTP 노출 대상 엔드포인트를 조회한다.
import org.springframework.boot.availability.AvailabilityChangeEvent; // 가용성 상태 변경을 알리는 이벤트다.
import org.springframework.boot.availability.ReadinessState; // 요청 수신 준비 상태를 표현한다.
import org.springframework.boot.test.context.SpringBootTest; // 전체 애플리케이션 구성을 사용한다.
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc; // Boot 4의 MVC 테스트 지원을 활성화한다.
import org.springframework.context.ApplicationContext; // 가용성 이벤트를 발행할 문맥이다.
import org.springframework.security.test.context.support.WithMockUser; // 비밀번호 인증 대신 테스트 권한을 준비한다.
import org.springframework.test.web.servlet.MockMvc; // 보안 필터와 MVC로 요청을 실행한다.

@SpringBootTest(properties = { // 실제 환경 변수 없이 테스트 전용 설정을 전달한다.
        "demo.security.reader-password=reader-test-only", // 이전 실습 계정의 테스트 입력이다.
        "demo.security.admin-password=admin-test-only", // 실제 운영 자격 증명이 아니다.
        "management.health.diskspace.enabled=false" // 환경 의존적인 디스크 검사만 테스트에서 제외한다.
}) // 실제 서버 포트를 열지 않는 기본 MOCK 환경이다.
@AutoConfigureMockMvc // 보안 필터를 제거하지 않고 요청을 검사한다.
class OperationsBoundaryTest { // 운영 관찰 기능의 계약을 확인한다.
    @Autowired // 구성된 요청 실행 도구를 받는다.
    private MockMvc mvc; // HTTP 관점의 검증을 수행한다.

    @Autowired // 실제 엔드포인트 공급자를 받는다.
    private WebEndpointsSupplier endpoints; // HTTP 노출 목록을 별도로 검사한다.

    @Autowired // 상태 변경을 반영할 애플리케이션 문맥을 받는다.
    private ApplicationContext context; // readiness 이벤트의 발행 대상이다.

    @BeforeEach // 앞 테스트의 상태를 기대하지 않는다.
    @AfterEach // 실패한 테스트 뒤에도 상태를 복원한다.
    void resetReadiness() { // 시작과 종료에 같은 준비 상태를 설정한다.
        AvailabilityChangeEvent.publish(context, ReadinessState.ACCEPTING_TRAFFIC); // 요청을 받을 준비가 되었다고 알린다.
    }

    @Test // 익명 사용자의 상태 요약 조회를 검사한다.
    void health는_요약만_공개한다() throws Exception { // 상태를 공개하되 내부 정보를 숨기는 계약이다.
        mvc.perform(get("/actuator/health")) // 인증 없이 상태 요약을 요청한다.
                .andExpect(status().isOk()) // 이 실습의 정상 상태에서는 200이다.
                .andExpect(jsonPath("$.status").value("UP")) // 등록된 검사의 요약 상태를 확인한다.
                .andExpect(jsonPath("$.components").doesNotExist()) // 내부 구성 요소를 공개하지 않는다.
                .andExpect(jsonPath("$.details").doesNotExist()); // 상세 검사값을 공개하지 않는다.
    }

    @Test // 정상 준비 상태의 probe를 검사한다.
    void 정상_readiness는_200이다() throws Exception { // BeforeEach에서 준비 상태를 정상으로 만들었다.
        mvc.perform(get("/actuator/health/readiness")) // 새 요청 수신 준비 상태를 조회한다.
                .andExpect(status().isOk()) // HTTP 상태가 200이어야 한다.
                .andExpect(jsonPath("$.status").value("UP")); // 준비 상태가 정상으로 해석되어야 한다.
    }

    @Test // 준비 상태 실패와 프로세스 생존 상태를 분리한다.
    void 준비되지_않아도_liveness는_정상일_수_있다() throws Exception { // 프로세스를 종료하지 않고 상태만 변경한다.
        AvailabilityChangeEvent.publish(context, ReadinessState.REFUSING_TRAFFIC); // 새 요청을 받지 않을 상태라고 알린다.
        mvc.perform(get("/actuator/health/readiness")) // readiness 그룹을 확인한다.
                .andExpect(status().isServiceUnavailable()) // 준비되지 않았으므로 503을 기대한다.
                .andExpect(jsonPath("$.status").value("OUT_OF_SERVICE")); // 상태 코드와 health 상태를 함께 검사한다.
        mvc.perform(get("/actuator/health/liveness")) // 같은 인스턴스의 생존 상태는 별도로 확인한다.
                .andExpect(status().isOk()) // liveness를 변경하지 않았으므로 정상이어야 한다.
                .andExpect(jsonPath("$.status").value("UP")); // 살아 있음과 요청 준비를 구별한다.
    }

    @Test // 노출된 메트릭도 인증을 요구하는지 검사한다.
    void 익명_metrics는_401이다() throws Exception { // HTTP 노출과 익명 허용은 다르다.
        mvc.perform(get("/actuator/metrics")) // 자격 증명 없이 지표 목록을 요청한다.
                .andExpect(status().isUnauthorized()); // Basic 인증 필요 응답을 기대한다.
    }

    @Test // 인증만으로 관리자 정보가 공개되지 않게 한다.
    @WithMockUser(roles = "USER") // 일반 회원의 인증 상태만 준비한다.
    void 회원_metrics는_403이다() throws Exception { // ADMIN이 없는 사용자의 접근이다.
        mvc.perform(get("/actuator/metrics")) // 지표 목록을 요청한다.
                .andExpect(status().isForbidden()); // 역할 부족으로 거부해야 한다.
    }

    @Test // 관리자의 지표 조회를 확인한다.
    @WithMockUser(roles = "ADMIN") // 실제 비밀번호 검증이 아닌 권한 경계 테스트다.
    void 관리자_metrics는_허용한다() throws Exception { // 조회할 수 있는 지표의 이름 목록을 확인한다.
        mvc.perform(get("/actuator/metrics")) // 등록된 metrics 엔드포인트를 요청한다.
                .andExpect(status().isOk()) // 관리자에게 200을 반환해야 한다.
                .andExpect(jsonPath("$.names").isArray()); // 특정 머신의 수치 대신 응답 구조를 검사한다.
    }

    @Test // 설정 정보 경로에 대한 기본 거부를 확인한다.
    @WithMockUser(roles = "ADMIN") // 관리자라도 노출하지 않은 기능을 자동으로 사용할 수 없다.
    void env_경로는_기본_거부한다() throws Exception { // 라우팅 부재보다 먼저 보안 규칙에 걸릴 수 있다.
        mvc.perform(get("/actuator/env")) // 이 예제에서 제공하지 않는 관리 경로다.
                .andExpect(status().isForbidden()); // anyRequest().denyAll()의 거부를 확인한다.
    }

    @Test // 403 응답과 별개로 실제 HTTP 노출 목록을 확인한다.
    void HTTP_노출은_health와_metrics뿐이다() { // 권한 때문에 가려진 것인지 구분할 근거를 만든다.
        List<String> ids = endpoints.getEndpoints().stream() // HTTP로 노출되는 엔드포인트들을 읽는다.
                .map(endpoint -> endpoint.getEndpointId().toString()) // 각 엔드포인트의 ID를 문자열로 바꾼다.
                .toList(); // 비교 가능한 목록으로 모은다.
        assertThat(ids).containsExactlyInAnyOrder("health", "metrics"); // 실수로 다른 관리 기능이 추가되지 않았는지 확인한다.
    }
}
```

403 하나만 확인하면 엔드포인트가 제거된 것인지, 존재하지만 권한 때문에 가려진 것인지 알 수 없다. 마지막 테스트는 HTTP 노출 목록을 별도로 확인한다. Actuator의 `/actuator` 링크 페이지 자체는 이 목록에서 개별 기능 ID로 세지 않는다. [WebEndpointsSupplier API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/actuate/endpoint/web/WebEndpointsSupplier.html)를 참고한다.

readiness 테스트는 가용성 이벤트를 발행해 상태 표현을 검사한다. 프로세스 재시작, 실제 로드밸런서의 트래픽 제외나 배포 성공을 검증한 것은 아니다. [AvailabilityChangeEvent API](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/availability/AvailabilityChangeEvent.html)와 [애플리케이션 가용성 설명](https://docs.spring.io/spring-boot/reference/features/spring-application.html#features.spring-application.application-availability)을 참고한다.

### 8.2 실습 프로젝트에서 실행하기

별도 Maven 실습 프로젝트 루트의 PowerShell에서 실행한다. TIL 저장소에는 이 Wrapper가 없다.

```powershell
# 이번에 추가한 운영 경계 테스트 8개를 실행한다.
./mvnw.cmd '-Dtest=OperationsBoundaryTest' test

# 이전 보안 테스트까지 실행해 기존 API 정책이 유지되는지 확인한다.
./mvnw.cmd test
```

첫 명령에서 테스트 8개가 통과하는 것이 목표다. 이전 노트의 테스트를 모두 유지했다면 두 명시적 테스트 클래스의 합계는 18개이고, Initializr가 생성한 테스트 등은 별도로 더해질 수 있다. 이 수치는 예상 구성이지 이번에 얻은 실행 로그가 아니다.

직접 서버를 실행할 때는 이전과 같이 실습 환경 변수를 준비한다. 서버가 시작된 뒤 별도 터미널에서 다음 조회를 실행할 수 있다.

```powershell
# 공개 health의 HTTP 헤더와 JSON을 함께 확인한다.
curl.exe -i http://127.0.0.1:8080/actuator/health

# 인증 없는 metrics 요청이 401인지 확인한다.
curl.exe -i http://127.0.0.1:8080/actuator/metrics

# 비밀번호를 명령문에 쓰지 않고 프롬프트에서 입력한다. 로컬 실습에만 사용한다.
curl.exe -i --user librarian http://127.0.0.1:8080/actuator/metrics
```

마지막 요청은 앞에서 준비한 실습 관리자 비밀번호로 인증한다. 명령 기록이나 화면 공유에 비밀번호·인증 헤더를 남기지 않는다. 이 수동 조회는 실제 포트를 확인하지만, MockMvc 테스트는 실제 포트를 열지 않는다는 차이도 기억한다.

## 9. 메트릭은 한 번의 숫자보다 변화와 분포를 본다

`/actuator/metrics`는 등록된 지표 이름을 확인하는 진단용 출발점이다. 지표마다 추가 경로로 측정값과 사용 가능한 tag를 조회할 수 있다. 등록되는 이름은 의존성·실행된 기능에 따라 달라지므로 외운 이름만 가정하지 말고 목록부터 확인한다.

요청 응답 시간은 평균만 보면 일부 사용자의 긴 대기를 놓칠 수 있다. 요청량·실패 비율·지연 분포·자원 포화도를 시간 흐름에서 함께 확인한다. 사용자 ID·이메일·요청 ID처럼 값의 종류가 계속 늘어나는 데이터를 metric tag로 넣으면 시계열 수가 폭증할 수 있다.

Boot는 Micrometer를 통해 다양한 지표를 다루지만 Actuator를 추가했다고 시계열 저장소와 경보가 자동 구축되지는 않는다. Prometheus 연동도 별도 registry 의존성과 노출·수집·보안 설정이 필요하다. 이번 실습에서는 지표 조회 권한까지만 확인한다. [Boot Metrics 공식 문서](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)를 참고한다.

## 10. 종료도 요청 처리 흐름의 일부다

배포할 때 프로세스를 갑자기 종료하면 진행 중인 요청이 끊길 수 있다. Graceful shutdown은 정상적인 애플리케이션 종료 과정에서 새 요청 수락을 중단하고 진행 중 요청에 완료 시간을 주는 방식이다. Boot 4.1에서는 기본 활성화이며 예제 설정은 이를 명시한다.

`timeout-per-shutdown-phase: 20s`는 종료 단계별 제한이다. 애플리케이션 전체 종료가 항상 정확히 20초 이내라고 보장하지 않는다. 인프라의 종료 유예 시간, 트래픽 전달 중단, 진행 중 업무와 외부 호출의 timeout을 함께 설계해야 한다.

```text
정상 종료 신호·컨텍스트 종료
  → 요청 수신 준비 상태 변화와 트래픽 제외 확인
  → 새 요청 수락 중단
  → 진행 중 요청에 완료 기회 제공
  → 자원 정리와 프로세스 종료
```

이 흐름의 실제 타이밍은 서버·배포 플랫폼 설정에 따라 달라진다. 강제 종료나 전원 장애에는 같은 보장을 기대할 수 없다. IDE의 정지 버튼도 정상 종료 신호와 동일하게 동작하는지 확인해야 한다. 안전한 종료를 쓰려고 HTTP `shutdown` 엔드포인트를 공개할 필요는 없다. [Graceful Shutdown 공식 문서](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)를 참고한다.

## 11. 설정을 운영에 가져가기 전 확인할 것

### 11.1 로그 보관과 형식

콘솔 로그를 누가 수집하고 얼마나 보관하는지 정한다. 파일 로그를 사용할 때도 회전·최대 보관량·디스크 사용량을 함께 관리한다. JSON 구조화 로그는 검색·집계에 도움이 되지만 JSON으로 바꿨다고 민감 정보가 자동 제거되지는 않는다.

Boot의 `logging.structured.format.console` 같은 옵션은 사용하는 수집 형식과 버전에 맞춰 선택한다. 지금은 사람이 읽는 기본 로그로 사건과 범위를 익힌 뒤 적용한다. [구조화 로깅 설정](https://docs.spring.io/spring-boot/reference/features/logging.html#features.logging.structured)을 참고한다.

### 11.2 장애 진단 순서

| 증상 | 먼저 확인할 것 |
| --- | --- |
| health는 UP인데 업무 요청 실패 | health 검사 범위, 실제 API 오류·의존성·데이터 조건 |
| readiness 503, liveness 200 | 준비 상태 변경 원인과 인프라의 트래픽 제외 여부 |
| metrics가 401 또는 403 | 인증 정보와 ADMIN 역할; 노출 여부와 분리해서 확인 |
| 관리 URL이 404 | 의존성·access·exposure·기본 경로·관리 포트 |
| 미노출 경로가 403 | 보안 기본 거부가 MVC의 404보다 먼저 동작하는지 확인 |
| DB 장애 뒤 재시작 반복 | 외부 DB 장애를 liveness에 연결했는지 확인 |
| DEBUG를 켠 뒤 로그 폭증 | root 대신 조사 대상 패키지에 제한했는지 확인 |
| 종료 때 요청이 끊김 | 정상 종료 신호, 단계별 timeout, 인프라 유예 시간과 전달 중단 |

로그·지표·상태 응답을 서로 보완해서 해석한다. 예를 들어 readiness가 내려간 시각과 외부 호출 실패 로그가 같은 시점인지 살펴보되, 시간상 함께 발생했다는 것만으로 원인을 확정하지 않는다.

## 12. 이전·다음 학습 연결

이전에는 요청자의 권한을 검증했다. 이번에는 그 원칙을 운영 엔드포인트에 적용하고, 서버의 생존·준비 상태와 요청 처리 기록을 분리했다. 입문 로드맵의 실행·웹·데이터·테스트·보안·운영 기초가 연결되었다.

다음 확장 주제로는 [외부 HTTP API 호출의 timeout·오류 처리·재시도 기준](../13_09_09_External_HTTP_API_and_RestClient/09_09_External_HTTP_API_and_RestClient.md)을 학습한다. 로그와 메트릭에서 느린 외부 의존성을 발견해도 호출 코드가 무한히 기다리거나 변경 요청을 무조건 재시도하면 장애가 커질 수 있으므로, 관찰에서 실패 제어로 이어가는 순서다.

## 13. 요약 정리

1. 프로세스 실행, 요청 처리 준비, 실제 업무 성공은 다른 상태다.
2. 로그는 사건, health는 정의된 상태, metrics는 수치 변화, trace는 호출 구간을 설명한다.
3. 로그 레벨과 기록 범위를 정하고 자격 증명·개인정보를 남기지 않는다.
4. Actuator 기능 접근 수준, HTTP 노출, 요청자 권한은 각각 설정한다.
5. 사용자 정의 보안 체인이 있다면 관리 경로의 보호도 직접 확인한다.
6. health의 UP은 등록된 검사 범위의 결과이지 모든 기능의 성공 증명이 아니다.
7. liveness와 readiness를 나누고 외부 장애로 불필요한 재시작을 유발하지 않도록 설계한다.
8. 거부 응답과 실제 노출 목록을 따로 검증하고 상태 변경 테스트 뒤에는 복원한다.
9. 지표 조회만으로 모니터링 저장소·대시보드·경보가 구축되는 것은 아니다.
10. 안전한 종료는 정상 종료 신호와 서버·인프라의 유예 정책을 함께 맞춰야 한다.

## 14. 미니 퀴즈

1. health가 UP인데도 대여 API가 실패할 수 있는 이유는 무엇인가?
2. metrics를 exposure 목록에 넣으면 일반 회원도 조회할 수 있는가?
3. `/actuator/env`의 403만으로 env 엔드포인트가 제거됐다고 증명할 수 있는가?
4. DB가 잠시 멈췄다는 이유로 liveness를 실패시키면 어떤 부작용이 생길 수 있는가?
5. readiness 상태를 REFUSING_TRAFFIC으로 바꾸면 Boot가 모든 일반 API를 즉시 차단하는가?
6. 로그 자리표시자 `{}`를 쓰면 토큰이나 비밀번호가 자동으로 숨겨지는가?
7. 종료 단계별 제한을 20초로 정하면 전체 종료가 반드시 20초 안에 끝나는가?

<details>
<summary>정답과 해설</summary>

1. health가 검사하지 않은 업무 규칙·데이터·외부 호출 등이 실패할 수 있다. 실제 API 관찰과 테스트가 필요하다.
2. 아니다. 노출과 권한은 다르다. 이 예제는 ADMIN 역할을 추가로 요구한다.
3. 아니다. 보안 규칙이 먼저 거부했을 수 있다. access·exposure와 실제 HTTP 노출 목록을 별도로 확인한다.
4. 재시작해도 외부 DB는 고쳐지지 않으며 여러 인스턴스의 재시작이 겹쳐 장애를 키울 수 있다.
5. 아니다. 상태 신호를 제공하는 것이며 실제 트래픽 제외는 연결한 인프라의 정책과 동작을 확인해야 한다.
6. 아니다. 값의 삽입 방식일 뿐 비밀값 제거 기능이 아니다. 기록할 데이터 자체를 제한한다.
7. 아니다. 단계별 제한과 전체 종료 시간은 다르며 인프라 유예 시간 등도 함께 고려한다.

</details>
