# Spring Boot 학습 로드맵

Spring Boot를 처음 배우는 사람이 **사전지식 → 실행 구조 → Spring 핵심 → 웹 API → 검증·설정 → 데이터 접근 → 테스트·보안 → 운영** 순서로 학습하도록 구성한다.

현재는 데이터 접근 기술의 층을 넘어 Entity 생명주기·영속성 컨텍스트·변경 감지와 연관관계 매핑까지 확인했다. 다음에는 여러 DB 작업을 묶는 트랜잭션 경계와 commit·rollback, 예외 규칙을 학습한다.

## 현재 작성된 노트

| 순서 | 주제 | 핵심 질문 | 노트 |
| ---: | --- | --- | --- |
| 00 | 필수 사전지식 | Spring Boot 코드를 읽기 전에 Java·웹·DB·Spring에서 무엇을 알아야 하는가? | [Spring Boot 필수 사전지식](./00_08_21_Spring_Boot_Prerequisites/08_21_Spring_Boot_Prerequisites.md) |
| 01 | Initializr와 첫 실행 | 생성 옵션·프로젝트 구조·Wrapper·시작 로그를 어떻게 읽는가? | [Initializr와 첫 실행](./01_08_25_Spring_Initializr_and_First_Run/08_25_Spring_Initializr_and_First_Run.md) |
| 02 | IoC·DI·Bean | 컨테이너는 객체를 어떻게 등록·생성·연결하며 주입 오류는 어떻게 진단하는가? | [IoC·DI·Bean과 생성자 주입](./02_08_26_Spring_IoC_DI_and_Bean/08_26_Spring_IoC_DI_and_Bean.md) |
| 03 | Spring MVC 요청 흐름 | HTTP 요청은 어떤 구성 요소를 거쳐 Controller에 도착하고 JSON 응답으로 바뀌는가? | [Spring MVC 요청 처리 흐름](./03_08_28_Spring_MVC_Request_Flow/08_28_Spring_MVC_Request_Flow.md) |
| 04 | REST API와 DTO | 자원·메서드·상태 코드를 어떻게 설계하고 외부 JSON 계약을 내부 모델과 분리하는가? | [REST API와 DTO 설계](./04_08_29_REST_API_and_DTO/08_29_REST_API_and_DTO.md) |
| 05 | Validation과 예외 처리 | 입력 오류와 비즈니스 실패를 어떻게 구분하고 일관된 HTTP 오류 응답으로 만드는가? | [Validation과 예외 처리](./05_09_01_Validation_and_Exception_Handling/09_01_Validation_and_Exception_Handling.md) |
| 06 | 설정과 Profile | 여러 설정 출처의 최종값을 어떻게 결정하고 환경별 설정과 비밀값을 안전하게 분리하는가? | [외부 설정과 Profile](./06_09_02_External_Configuration_and_Profiles/09_02_External_Configuration_and_Profiles.md) |
| 07 | 데이터 접근 기초 | JDBC부터 JPA·Hibernate·Spring Data JPA까지 각 계층은 무엇을 책임지는가? | [JDBC·JPA·Spring Data JPA](./07_09_03_Data_Access_Fundamentals/09_03_Data_Access_Fundamentals.md) |
| 08 | Entity와 연관관계 | 객체 변경은 언제 SQL이 되고 어느 쪽을 바꿔야 외래키가 저장되는가? | [Entity 생명주기와 연관관계](./08_09_05_Entity_Lifecycle_and_Relationships/09_05_Entity_Lifecycle_and_Relationships.md) |

## 권장 학습 순서

아래 순서대로 후속 강의노트를 확장한다.

| 순서 | 학습 주제 | 도달 목표 | 상태 |
| ---: | --- | --- | --- |
| 00 | 필수 사전지식 | Java·HTTP·빌드·DB·IoC/DI의 연결 이해 | 작성 완료 |
| 01 | Initializr와 첫 실행 | 프로젝트 구조, Wrapper, `@SpringBootApplication`, 실행 로그 이해 | 작성 완료 |
| 02 | IoC·DI·Bean | 컨테이너, Bean 등록, 컴포넌트 스캔, 생성자 주입 이해 | 작성 완료 |
| 03 | Spring MVC 요청 흐름 | 내장 서버, DispatcherServlet, Controller 매핑 이해 | 작성 완료 |
| 04 | REST API와 DTO | 요청·응답 DTO, JSON 변환, 상태 코드 설계 | 작성 완료 |
| 05 | Validation과 예외 처리 | 입력 검증과 일관된 오류 응답 작성 | 작성 완료 |
| 06 | 설정과 Profile | 환경별 설정, 환경 변수, 비밀값 관리 | 작성 완료 |
| 07 | 데이터 접근 기초 | JDBC·JPA·Spring Data JPA 역할 구분 | 작성 완료 |
| 08 | Entity와 연관관계 | 영속성 컨텍스트, Entity 생명주기와 관계 매핑 이해 | 작성 완료 |
| 09 | 트랜잭션 | 작업 경계, commit·rollback과 예외 관계 이해 | 예정 |
| 10 | 테스트 | 단위·슬라이스·통합 테스트의 범위 구분 | 예정 |
| 11 | Spring Security | 인증·인가와 보안 필터 흐름 이해 | 예정 |
| 12 | 운영 기초 | 로깅, Actuator, 상태 점검과 배포 설정 이해 | 예정 |

## 학습 원칙

### 1. 애너테이션보다 동작을 먼저 설명한다

`@Service`, `@RestController`, `@Transactional`을 외우기 전에 다음을 묻는다.

- 이 애너테이션을 누가 읽는가?
- 어떤 객체가 Bean으로 등록되는가?
- 요청이나 트랜잭션의 경계가 어디에서 시작하고 끝나는가?
- 애너테이션을 제거하면 무엇이 달라지는가?

### 2. 요청 한 번의 흐름을 끝까지 추적한다

```text
클라이언트
  → HTTP 요청
  → Controller
  → Service
  → Repository
  → 데이터베이스
  → 응답 DTO
  → JSON 응답
```

각 계층의 코드를 따로 암기하지 않고 데이터와 제어가 이동하는 순서로 이해한다.

### 3. 자동 설정을 마법으로 부르지 않는다

Starter, 클래스패스, 설정 속성, 기존 Bean을 조건으로 Spring Boot가 무엇을 등록했는지 확인한다. 자동 설정은 개발자가 작성해야 할 반복 구성을 줄여 주지만 기반 기술의 존재를 없애지는 않는다.

### 4. 버전을 먼저 확인한다

검색한 예제와 현재 프로젝트에서 다음을 비교한다.

- Spring Boot와 Java 버전
- Maven·Gradle 설정
- `javax.*`와 `jakarta.*` import
- 현재 공식 문서의 API와 Starter 이름

### 5. 작은 기능마다 테스트한다

Controller, Service, Repository를 모두 만든 뒤 한꺼번에 확인하지 않는다. 순수 Java 단위 테스트, 웹 계층 테스트, 데이터 계층 테스트, 전체 통합 테스트가 각각 무엇을 검증하는지 구분한다.

## 시작 전 최소 체크리스트

- [ ] Java 클래스·인터페이스·생성자·예외·제네릭을 읽을 수 있다.
- [ ] HTTP 메서드·상태 코드·Header·Body를 구분할 수 있다.
- [ ] JSON과 Java 객체 사이에 직렬화·역직렬화가 필요함을 안다.
- [ ] Maven 또는 Gradle Wrapper로 테스트 명령을 실행할 수 있다.
- [ ] 기본 CRUD SQL과 트랜잭션의 목적을 설명할 수 있다.
- [ ] IoC, DI, Bean을 한 문장씩 설명할 수 있다.
- [ ] 선택한 Spring Boot 버전의 Java 요구사항을 확인할 수 있다.

체크되지 않은 항목이 있어도 학습을 중단할 필요는 없다. [필수 사전지식 노트](./00_08_21_Spring_Boot_Prerequisites/08_21_Spring_Boot_Prerequisites.md)의 해당 절을 복습하면서 첫 프로젝트를 함께 진행한다.

## 공식 문서 읽는 순서

1. [Spring Boot System Requirements](https://docs.spring.io/spring-boot/system-requirements.html)에서 버전 호환성을 확인한다.
2. [Developing Your First Spring Boot Application](https://docs.spring.io/spring-boot/tutorial/first-application/)으로 프로젝트 실행 흐름을 익힌다.
3. [Spring Boot Reference](https://docs.spring.io/spring-boot/reference/)에서 현재 학습 주제만 찾아 읽는다.
4. IoC·DI는 [Spring Framework Core](https://docs.spring.io/spring-framework/reference/core/beans.html)에서 원리를 확인한다.
5. 웹 요청은 [Spring Web MVC](https://docs.spring.io/spring-framework/reference/web/webmvc.html)에서 확인한다.
6. 기능별 작은 예제는 [Spring Getting Started Guides](https://spring.io/guides)로 실습한다.

> 정리 기준일: 2026-09-05
