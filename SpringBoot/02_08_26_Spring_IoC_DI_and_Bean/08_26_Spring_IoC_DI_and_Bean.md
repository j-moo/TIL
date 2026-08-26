# Spring IoC·DI·Bean과 생성자 주입 이해하기

- 🎯 글의 목표: Spring이 객체를 만들고 연결하는 과정을 이해하고, 컴포넌트 스캔과 Java 설정으로 Bean을 등록한 뒤 생성자 주입을 적용한다.
- 🧩 핵심 키워드: 의존성, IoC, DI, Bean, ApplicationContext, 컴포넌트 스캔, `@Bean`, 생성자 주입, `@Primary`, `@Qualifier`, Bean Scope
- ⭐ 중요도: ★★★★★ — Controller·Service·Repository가 연결되는 원리를 알아야 Spring 코드를 애너테이션 암기가 아닌 객체 관계로 읽을 수 있다.
- 📝 한눈에 보는 내용: 애플리케이션 객체가 필요한 협력 객체를 직접 만들지 않고 생성자로 요구하면, Spring 컨테이너가 등록된 Bean 중 알맞은 객체를 찾아 주입한다. 이 구조는 객체 생성 책임을 분리하고 구현 교체와 단위 테스트를 쉽게 만든다.
- 🔗 관련 주제: Java 인터페이스·생성자, `@SpringBootApplication`, 컴포넌트 스캔, Spring MVC 계층, 테스트 더블
- 🧱 선수 지식: Java 클래스·인터페이스·`final` 필드·패키지, Spring Boot 프로젝트 실행 방법

---

## 1. 들어가며

웹 애플리케이션의 한 기능도 보통 여러 객체가 협력해 완성한다. 예를 들어 읽을 책을 등록하는 기능은 요청을 받는 Controller, 규칙을 처리하는 Service, 데이터를 보관하는 Repository로 나눌 수 있다.

```text
ReadingController
        ↓ 사용
ReadingService
        ↓ 사용
ReadingRepository
```

이때 `ReadingService` 안에서 Repository 구현을 직접 `new`로 만들면 당장은 간단해 보인다. 그러나 저장 방식을 메모리에서 데이터베이스로 바꾸거나 테스트용 저장소를 사용하려면 Service 코드까지 수정해야 한다.

Spring의 IoC 컨테이너는 이 **객체 생성과 연결 문제**를 맡는다. 이번 노트에서는 다음 순서로 원리를 확인한다.

```text
직접 객체를 만드는 코드의 문제 확인
        ↓
인터페이스와 생성자로 의존 관계 표현
        ↓
객체를 Spring Bean으로 등록
        ↓
컨테이너가 타입에 맞는 Bean을 주입
        ↓
구현 교체·단위 테스트·오류 진단
```

> 이 문서는 2026년 8월 26일의 Spring Framework 공식 문서를 기준으로 작성했다. 세부 API는 프로젝트가 사용하는 Spring Boot·Spring Framework 버전의 문서를 함께 확인한다.

## 2. 전체 지도: 네 용어를 하나의 흐름으로 연결하기

IoC, DI, Bean, ApplicationContext는 서로 다른 대상을 가리킨다.

| 용어 | 정확한 의미 | 쉬운 표현 |
| --- | --- | --- |
| 의존성 | 한 객체가 일을 하기 위해 다른 객체나 값을 필요로 하는 관계 | `A`가 동작하려면 `B`가 필요함 |
| DI | 필요한 의존성을 객체 내부에서 만들지 않고 외부에서 전달받는 방식 | 필요한 부품을 밖에서 넣어 줌 |
| IoC | 객체 생성·연결의 제어 책임이 애플리케이션 객체에서 컨테이너로 이동한 원칙 | 조립 책임이 뒤집힘 |
| Bean | Spring 컨테이너가 생성·설정·관리하는 객체 | Spring이 관리 목록에 올린 객체 |
| ApplicationContext | Bean을 생성하고 설정하고 조립하는 Spring IoC 컨테이너의 중심 인터페이스 | Bean 공장과 보관소 이상의 실행 환경 |

관계를 한 번에 보면 다음과 같다.

```text
개발자
  └─ 어떤 클래스를 Bean으로 만들지 정의
                 ↓
ApplicationContext
  ├─ Bean 정의 확인
  ├─ 객체 생성
  ├─ 필요한 의존성 탐색
  ├─ 생성자에 의존성 전달
  └─ 완성된 Bean 관리
                 ↓
애플리케이션은 조립된 객체를 사용
```

📌 핵심: **DI는 객체를 연결하는 방법이고, IoC는 그 연결의 제어권이 컨테이너에 있다는 더 넓은 원칙이다.**

## 3. 의존성은 무엇인가

### 3.1 메서드를 호출하면 의존 관계가 생긴다

다음 Service는 책 제목을 저장하기 위해 Repository를 사용한다.

```java
public class ReadingService {
    private final ReadingRepository repository;

    public ReadingService() {
        // Service가 사용할 구현 클래스와 생성 시점을 직접 결정한다.
        this.repository = new MemoryReadingRepository();
    }

    public void addBook(String title) {
        // addBook의 일을 끝내려면 repository의 save 기능이 필요하다.
        repository.save(title);
    }
}
```

`ReadingService`는 `ReadingRepository`에 의존한다. 여기서 의존성은 Maven 라이브러리 의존성과 문맥이 다르다.

```text
빌드 의존성
  └─ 프로젝트가 외부 라이브러리를 컴파일·실행에 필요로 함

객체 의존성
  └─ 한 객체가 다른 객체의 기능을 사용해야 동작함
```

### 3.2 직접 생성 방식이 커질 때 생기는 문제

Service가 구현 객체를 직접 만들면 세 책임이 섞인다.

1. 독서 기록 규칙 처리
2. 저장소 구현 선택
3. 저장소 객체 생성

데이터베이스 저장소로 변경하려면 다음처럼 Service 내부를 고쳐야 한다.

```java
// 구현을 바꾸기 위해 비즈니스 코드까지 수정해야 한다.
this.repository = new DatabaseReadingRepository();
```

테스트에서도 실제 데이터베이스 대신 가벼운 가짜 객체를 넣기 어렵다. 문제는 `new` 자체가 아니라 **어떤 계층이 생성과 선택을 책임지는가**이다. 값 객체나 메서드 내부의 짧은 임시 객체까지 모두 Spring에 맡길 필요는 없다.

## 4. 순수 Java로 먼저 의존성 주입하기

DI는 Spring 전용 문법이 아니다. Java 생성자만으로도 적용할 수 있는 설계 원칙이다.

### 4.1 의존할 기능을 인터페이스로 표현한다

```java
public interface ReadingRepository {

    // 저장 방식은 구현 클래스가 결정하고 Service는 기능 계약만 사용한다.
    void save(String title);
}
```

메모리에 저장하는 구현은 다음과 같이 만들 수 있다.

```java
import java.util.ArrayList;
import java.util.List;

public class MemoryReadingRepository implements ReadingRepository {
    // 예제의 핵심을 보기 위한 메모리 저장소다.
    // 실제 동시 요청을 처리하는 저장소 구현으로 사용하기에는 안전하지 않다.
    private final List<String> titles = new ArrayList<>();

    @Override
    public void save(String title) {
        titles.add(title);
    }

    public List<String> findAll() {
        // 내부 목록을 그대로 노출하지 않고 복사본을 반환한다.
        return List.copyOf(titles);
    }
}
```

### 4.2 생성자로 필요한 객체를 받는다

```java
import java.util.Objects;

public class ReadingService {
    private final ReadingRepository repository;

    public ReadingService(ReadingRepository repository) {
        // 생성 시점에 필수 협력 객체가 없으면 즉시 실패하게 한다.
        this.repository = Objects.requireNonNull(repository);
    }

    public void addBook(String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("책 제목은 비어 있을 수 없습니다.");
        }

        repository.save(title.trim());
    }
}
```

이제 `ReadingService`는 구체적인 저장 방식이나 객체 생성 방법을 모른다. 자신이 필요한 기능을 생성자 매개변수로 선언할 뿐이다.

### 4.3 외부에서 객체를 조립한다

```java
public class PlainJavaApplication {

    public static void main(String[] args) {
        // 1. 사용할 구현 객체를 외부에서 만든다.
        ReadingRepository repository = new MemoryReadingRepository();

        // 2. Service가 요구한 의존성을 생성자로 전달한다.
        ReadingService service = new ReadingService(repository);

        // 3. 조립이 끝난 객체로 기능을 실행한다.
        service.addBook("Spring 핵심 원리");
    }
}
```

이 코드에도 DI가 적용되어 있다. 다만 개발자가 `main`에서 객체를 직접 생성하고 조립한다. Spring을 사용하면 컨테이너가 이 조립 역할을 맡는다.

## 5. Bean과 ApplicationContext

### 5.1 모든 Java 객체가 Bean은 아니다

다음 두 객체가 같은 클래스의 인스턴스여도 관리 주체는 다를 수 있다.

```java
// 개발자 코드가 직접 만든 일반 Java 객체
ReadingService service = new ReadingService(repository);
```

```text
Spring 설정을 통해 등록된 ReadingService 인스턴스
  → Spring Bean
```

Bean 여부는 클래스 이름이나 특별한 자료형으로 결정되지 않는다. **해당 객체가 현재 ApplicationContext에 등록되어 관리되는가**가 기준이다.

### 5.2 Bean 정의와 Bean 인스턴스

Spring은 먼저 어떤 객체를 어떻게 만들지 설명하는 Bean 정의를 읽고, 그 정보를 이용해 실제 객체를 만든다.

```text
Bean 정의
  ├─ 만들 클래스 또는 팩터리 메서드
  ├─ Bean 이름
  ├─ 필요한 의존성
  ├─ Scope
  └─ 초기화 정보
        ↓ 객체 생성
Bean 인스턴스
  └─ 애플리케이션에서 실제로 사용하는 객체
```

입문 단계에서는 내부 `BeanDefinition` API를 직접 조작하기보다, 애너테이션과 Java 설정이 Bean 정의로 해석된다는 흐름을 이해하면 충분하다.

### 5.3 ApplicationContext의 책임

ApplicationContext는 단순한 `Map<String, Object>`가 아니다. 대표적으로 다음 일을 한다.

- 설정 정보 읽기
- Bean 생성과 의존 관계 해결
- Bean 이름과 타입을 이용한 조회
- Scope와 생명주기 관리
- 이벤트, 메시지, 환경 설정 같은 Spring 기반 기능 제공

애플리케이션 코드가 매번 `applicationContext.getBean()`을 호출하는 방식은 권장되는 기본 구조가 아니다. 보통은 필요한 Bean을 생성자로 선언하고 컨테이너가 주입하게 한다.

## 6. Bean을 등록하는 두 가지 기본 방법

### 6.1 컴포넌트 스캔

Spring은 지정된 패키지를 탐색해 컴포넌트 후보를 Bean으로 등록할 수 있다.

```java
import org.springframework.stereotype.Repository;

@Repository
public class MemoryReadingRepository implements ReadingRepository {
    // 구현 코드는 앞의 예제와 같다.
}
```

```java
import org.springframework.stereotype.Service;

@Service
public class ReadingService {
    private final ReadingRepository repository;

    // 생성자가 하나뿐이면 Spring은 이 생성자를 주입 대상으로 사용한다.
    public ReadingService(ReadingRepository repository) {
        this.repository = repository;
    }
}
```

`@SpringBootApplication`에는 컴포넌트 스캔을 활성화하는 구성이 포함된다. 시작 클래스를 루트 패키지에 두고 대상 클래스를 그 하위 패키지에 배치하면 기본 탐색 범위에 들어간다.

```text
com.example.reading
├─ ReadingApplication.java       ← 시작 클래스
├─ controller/
│  └─ ReadingController.java     ← 탐색됨
├─ service/
│  └─ ReadingService.java        ← 탐색됨
└─ repository/
   └─ MemoryReadingRepository.java ← 탐색됨
```

반대로 `com.other.repository`처럼 기본 패키지 범위 밖에 두면 애너테이션이 있어도 자동으로 발견되지 않을 수 있다.

### 6.2 스테레오타입 애너테이션의 의미

| 애너테이션 | 주로 나타내는 역할 | 설명 |
| --- | --- | --- |
| `@Component` | 일반 컴포넌트 | 가장 일반적인 컴포넌트 표시 |
| `@Service` | 비즈니스 계층 | 업무 규칙을 처리하는 역할을 표현 |
| `@Repository` | 데이터 접근 계층 | 저장소 역할을 표현하며 예외 변환 같은 의미도 가질 수 있음 |
| `@Controller` | MVC 화면 Controller | 요청을 받아 View 흐름을 처리 |
| `@RestController` | REST Controller | 반환값을 HTTP 응답 본문으로 변환하는 Controller |

`@Service`, `@Repository`, `@Controller`는 `@Component`를 기반으로 한 특수화된 애너테이션이다. Bean 등록만 놓고 보면 비슷하지만, 코드의 역할을 명확히 전달하므로 계층에 맞는 표현을 사용한다.

### 6.3 `@Configuration`과 `@Bean`

외부 라이브러리 클래스처럼 소스 코드에 `@Component`를 붙일 수 없거나, 생성 방법을 명시적으로 제어할 때 Java 설정을 사용한다.

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ReadingConfig {

    @Bean
    public TitleFormatter titleFormatter() {
        // 메서드가 반환한 객체가 Spring Bean으로 등록된다.
        return new TitleFormatter("[읽을 책] ");
    }
}
```

- `@Configuration`은 이 클래스가 Bean 정의의 출처임을 알린다.
- `@Bean`은 해당 메서드가 반환한 객체를 컨테이너에 등록한다.
- 기본 Bean 이름은 메서드 이름인 `titleFormatter`이다.
- 기본 Bean 타입은 반환 객체와 선언된 반환 타입을 기준으로 탐색된다.

`@Bean` 메서드도 필요한 의존성을 매개변수로 받을 수 있다.

```java
@Configuration
public class ReadingConfig {

    @Bean
    public ReadingService readingService(ReadingRepository repository) {
        // Spring이 ReadingRepository 타입 Bean을 찾아 매개변수로 전달한다.
        return new ReadingService(repository);
    }
}
```

### 6.4 두 방법 중 무엇을 선택할까

| 상황 | 주로 사용할 방법 |
| --- | --- |
| 직접 작성한 Controller·Service·Repository | 역할에 맞는 컴포넌트 애너테이션 |
| 외부 라이브러리 객체 등록 | `@Configuration` + `@Bean` |
| 생성자에 설정 값을 전달하는 등 생성 과정 제어 | `@Configuration` + `@Bean` |
| 동일 타입 객체를 여러 설정으로 등록 | 이름을 구분한 여러 `@Bean` 메서드 |

한 클래스를 컴포넌트 스캔과 `@Bean` 양쪽에서 중복 등록하지 않도록 주의한다. 등록 방식은 프로젝트의 책임과 변경 지점을 잘 보여주는 쪽을 선택한다.

## 7. 생성자 주입의 동작 원리

### 7.1 컨테이너는 타입을 중심으로 후보를 찾는다

다음 코드를 실행할 때 개발자가 생성자를 직접 호출하지 않는다.

```java
@Service
public class ReadingService {
    private final ReadingRepository repository;

    public ReadingService(ReadingRepository repository) {
        this.repository = repository;
    }
}
```

컨테이너 내부 흐름을 단순화하면 다음과 같다.

```text
1. ReadingService Bean 정의 발견
2. 생성자 매개변수 ReadingRepository 확인
3. ApplicationContext에서 해당 타입의 Bean 후보 탐색
4. 후보가 하나면 그 객체를 생성자 인수로 전달
5. 완성된 ReadingService를 Bean으로 관리
```

주입은 필드 변수 이름만 보고 임의의 객체를 넣는 과정이 아니다. 기본적으로 타입에 맞는 후보를 찾고, 후보가 여러 개라면 추가 선택 기준을 적용한다.

### 7.2 생성자가 하나면 `@Autowired`를 생략할 수 있다

Bean 클래스에 생성자가 하나뿐이면 Spring은 그 생성자를 사용하므로 보통 `@Autowired`를 적지 않아도 된다.

```java
@Service
public class ReadingService {
    private final ReadingRepository repository;

    // 단일 생성자이므로 @Autowired가 없어도 주입 대상이다.
    public ReadingService(ReadingRepository repository) {
        this.repository = repository;
    }
}
```

생성자가 여러 개인 경우에는 어떤 생성자를 사용할지 규칙을 확인하고 필요하면 의도를 명시해야 한다. 입문 코드에서는 불필요하게 생성자를 여러 개 만들지 않는 편이 관계를 이해하기 쉽다.

### 7.3 생성자 주입을 우선하는 이유

필수 의존성에는 생성자 주입이 잘 맞는다.

- 객체 생성이 끝날 때 필요한 의존성이 모두 준비된다.
- 필드를 `final`로 선언해 생성 후 참조 변경을 막을 수 있다.
- Spring 없이도 생성자를 직접 호출해 단위 테스트할 수 있다.
- 필요한 의존성이 생성자 시그니처에 드러난다.
- 생성자 매개변수가 지나치게 많으면 클래스 책임이 너무 큰지 알아차리기 쉽다.

생성자 주입이 모든 설계 문제를 자동으로 해결하지는 않는다. 특히 두 Bean이 서로를 생성자로 요구하는 순환 의존성은 조립할 시작점이 없어 실패한다.

### 7.4 필드 주입과 비교하기

```java
@Service
public class ReadingService {

    @Autowired
    private ReadingRepository repository;
}
```

필드 주입은 코드가 짧지만 다음 특성이 있다.

- 클래스만 보고 필수 의존성을 포함한 생성 방법을 알기 어렵다.
- 필드를 `final`로 만들기 어렵다.
- Spring 없이 순수 Java 객체로 테스트할 때 주입이 번거롭다.
- 의존 관계가 늘어도 생성자 시그니처에 경고 신호가 드러나지 않는다.

따라서 새 애플리케이션 코드의 필수 협력 객체에는 생성자 주입을 먼저 고려한다. Setter 주입은 합리적인 기본값을 가질 수 있는 선택적 의존성이나 실행 중 재설정이 필요한 특별한 경우에 검토한다.

## 8. 인터페이스와 구현체를 함께 사용하는 이유

### 8.1 Service는 기능 계약에 의존한다

```java
public interface ReadingRepository {
    void save(String title);
}
```

```java
@Repository
public class MemoryReadingRepository implements ReadingRepository {

    @Override
    public void save(String title) {
        // 메모리 저장 처리
    }
}
```

```java
@Service
public class ReadingService {
    private final ReadingRepository repository;

    public ReadingService(ReadingRepository repository) {
        // 구현 클래스가 아니라 필요한 기능 계약을 요구한다.
        this.repository = repository;
    }
}
```

인터페이스가 있다고 자동으로 좋은 설계가 되는 것은 아니다. 구현 교체 가능성, 계층 경계, 테스트 대역의 필요가 있을 때 계약을 분리하는 가치가 커진다.

### 8.2 Spring 없는 단위 테스트

생성자 주입을 사용하면 Spring 컨테이너 없이 Service 규칙을 확인할 수 있다.

```java
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ReadingServiceTest {

    @Test
    void 제목의_앞뒤_공백을_제거해_저장한다() {
        // 테스트가 관찰할 수 있는 간단한 가짜 저장소를 준비한다.
        FakeReadingRepository repository = new FakeReadingRepository();

        // Spring 없이 생성자로 직접 의존성을 주입한다.
        ReadingService service = new ReadingService(repository);

        service.addBook("  HTTP 완벽 가이드  ");

        // Service가 저장소에 전달한 최종 값을 확인한다.
        assertEquals(List.of("HTTP 완벽 가이드"), repository.savedTitles);
    }

    private static class FakeReadingRepository implements ReadingRepository {
        private final List<String> savedTitles = new ArrayList<>();

        @Override
        public void save(String title) {
            savedTitles.add(title);
        }
    }
}
```

이 테스트는 Bean 탐색이나 Spring 설정을 검증하지 않는다. `ReadingService`의 순수한 Java 규칙만 빠르게 검증한다. 컨테이너 연결 자체는 별도의 통합 테스트에서 확인한다.

## 9. 같은 타입의 Bean이 여러 개라면

### 9.1 모호한 후보 오류

두 구현을 모두 Bean으로 등록해 보자.

```java
@Repository
public class MemoryReadingRepository implements ReadingRepository {
    // 메모리 구현
}
```

```java
@Repository
public class DatabaseReadingRepository implements ReadingRepository {
    // 데이터베이스 구현
}
```

`ReadingService`가 단순히 `ReadingRepository` 하나를 요구하면 타입 후보가 두 개다.

```text
ReadingRepository 후보
  ├─ memoryReadingRepository
  └─ databaseReadingRepository
             ↓
어느 객체를 넣을지 결정할 수 없음
```

이 경우 대표적으로 `NoUniqueBeanDefinitionException` 계열의 시작 오류를 볼 수 있다. 구현 클래스를 지우기 전에 **왜 두 Bean이 동시에 등록되었는지**와 실제 선택 정책을 먼저 결정한다.

### 9.2 기본 후보를 정하는 `@Primary`

```java
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

@Primary
@Repository
public class DatabaseReadingRepository implements ReadingRepository {
    // 별도 선택 조건이 없을 때 이 구현을 우선 후보로 사용한다.
}
```

`@Primary`는 같은 타입 후보가 여러 개일 때 기본 우선순위를 준다. 애플리케이션 전체에서 대부분 데이터베이스 구현을 사용하고 일부 위치만 다른 구현이 필요할 때 사용할 수 있다.

### 9.3 주입 위치에서 좁히는 `@Qualifier`

```java
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
public class PreviewReadingService {
    private final ReadingRepository repository;

    public PreviewReadingService(
            @Qualifier("memoryReadingRepository") ReadingRepository repository
    ) {
        // 이 주입 위치에서는 메모리 저장소 후보를 명시적으로 선택한다.
        this.repository = repository;
    }
}
```

`@Qualifier`는 타입 후보 집합을 의미 있는 조건으로 좁힌다. 문자열을 사용할 때는 Bean 이름 변경과 함께 수정해야 하므로 이름의 의미와 일관성을 유지한다. 규모가 커지면 사용자 정의 qualifier 애너테이션도 검토할 수 있다.

### 9.4 해결 순서

같은 타입 Bean이 여러 개일 때는 다음 순서로 생각한다.

1. 정말 두 구현을 동시에 Bean으로 등록해야 하는가?
2. 하나만 사용한다면 불필요한 등록을 제거할 수 있는가?
3. 공통 기본 구현이 있다면 `@Primary`가 의도를 표현하는가?
4. 주입 위치마다 선택이 다르다면 `@Qualifier`가 더 적절한가?
5. 여러 구현을 모두 실행해야 한다면 `List<ReadingRepository>` 주입이 요구사항에 맞는가?

오류를 없애기 위해 아무 구현에나 `@Primary`를 붙이면 정책이 코드에 잘못 기록될 수 있다.

## 10. Bean Scope와 상태 관리

### 10.1 Scope는 인스턴스가 유지되는 범위다

Spring Bean의 기본 Scope는 `singleton`이다. 여기서 Spring singleton은 GoF Singleton 패턴과 완전히 같은 뜻이 아니라 **컨테이너 하나와 Bean 정의 하나당 공유 인스턴스 하나**라는 의미다.

| Scope | 인스턴스 범위 | 입문 관점 |
| --- | --- | --- |
| `singleton` | 컨테이너·Bean 정의당 공유 인스턴스 하나 | 기본값, 일반적인 Service·Repository |
| `prototype` | 요청할 때마다 새 인스턴스 | 상태 있는 특수 객체에서 검토 |
| `request` | HTTP 요청 하나 | 웹 요청 동안만 유지 |
| `session` | HTTP 세션 하나 | 사용자 세션 동안 유지 |

Scope가 Java 변수의 접근 범위나 `static`과 같다는 뜻은 아니다. Spring 컨테이너가 Bean 인스턴스를 얼마나 오래, 어떤 단위로 제공할지 정하는 규칙이다.

### 10.2 singleton Bean에 요청별 값을 저장하면 위험하다

```java
@Service
public class UnsafeReadingService {
    // 여러 요청이 같은 Service Bean을 공유할 수 있으므로
    // 현재 사용자처럼 요청마다 달라지는 값을 필드에 저장하면 안 된다.
    private String currentUserEmail;
}
```

singleton Service는 여러 요청과 스레드가 함께 사용할 수 있다. 변경 가능한 요청별 상태를 인스턴스 필드에 저장하면 값이 섞이거나 경쟁 상태가 생길 수 있다.

```java
@Service
public class ReadingService {

    public void addBook(String userEmail, String title) {
        // 요청별 값은 메서드 인수와 지역 변수로 전달한다.
        String normalizedTitle = title.trim();
        // 저장 처리
    }
}
```

📌 핵심: singleton Bean이라고 해서 모든 메서드가 자동으로 스레드 안전해지는 것은 아니다. 공유되는 변경 가능 상태를 피하는 설계가 중요하다.

## 11. 순환 의존성은 구조 신호다

다음 관계는 서로가 먼저 만들어져야 하는 모순을 만든다.

```java
@Service
public class ReadingService {
    public ReadingService(NotificationService notificationService) {
    }
}
```

```java
@Service
public class NotificationService {
    public NotificationService(ReadingService readingService) {
    }
}
```

```text
ReadingService를 만들려면 NotificationService 필요
                         ↓
NotificationService를 만들려면 ReadingService 필요
                         ↓
완성된 첫 객체가 없어 생성자 조립 불가
```

순환 의존성이 보이면 Setter 주입이나 지연 로딩으로 증상만 우회하기 전에 책임을 다시 살핀다.

- 두 Service가 너무 많은 책임을 나누어 갖고 있지 않은가?
- 공통 규칙을 제3의 객체로 분리할 수 있는가?
- 한 방향 호출 대신 이벤트로 결과만 알릴 수 있는가?
- 계층 방향이 Controller → Service → Repository처럼 일정한가?

생성자 주입이 순환 관계를 일찍 드러내는 것은 불편함이 아니라 설계 피드백이다.

## 12. 작은 Spring Boot 예제로 전체 흐름 연결하기

### 12.1 파일 구조

```text
src/main/java/com/example/reading/
├─ ReadingApplication.java
├─ controller/
│  └─ ReadingController.java
├─ service/
│  └─ ReadingService.java
└─ repository/
   ├─ ReadingRepository.java
   └─ MemoryReadingRepository.java
```

### 12.2 Repository 계약과 구현

```java
package com.example.reading.repository;

import java.util.List;

public interface ReadingRepository {
    void save(String title);
    List<String> findAll();
}
```

```java
package com.example.reading.repository;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Repository;

@Repository
public class MemoryReadingRepository implements ReadingRepository {
    // singleton Bean이 여러 요청에서 공유될 수 있으므로
    // 예제에서는 동시 접근을 고려한 컬렉션을 사용한다.
    private final List<String> titles = new CopyOnWriteArrayList<>();

    @Override
    public void save(String title) {
        titles.add(title);
    }

    @Override
    public List<String> findAll() {
        // 호출자가 내부 저장 목록을 직접 수정하지 못하도록 복사한다.
        return List.copyOf(titles);
    }
}
```

### 12.3 Service에서 규칙 처리

```java
package com.example.reading.service;

import com.example.reading.repository.ReadingRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ReadingService {
    private final ReadingRepository repository;

    public ReadingService(ReadingRepository repository) {
        // Spring이 ReadingRepository 구현 Bean을 찾아 전달한다.
        this.repository = repository;
    }

    public void addBook(String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("책 제목은 비어 있을 수 없습니다.");
        }

        // 입력 정규화는 Service의 업무 규칙으로 처리한다.
        repository.save(title.trim());
    }

    public List<String> getBooks() {
        return repository.findAll();
    }
}
```

### 12.4 Controller도 생성자로 Service를 받는다

```java
package com.example.reading.controller;

import com.example.reading.service.ReadingService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/books")
public class ReadingController {
    private final ReadingService readingService;

    public ReadingController(ReadingService readingService) {
        // Controller 역시 필요한 Service를 직접 만들지 않는다.
        this.readingService = readingService;
    }

    @PostMapping
    public void addBook(@RequestBody AddBookRequest request) {
        readingService.addBook(request.title());
    }

    @GetMapping
    public List<String> getBooks() {
        return readingService.getBooks();
    }

    // 요청 JSON의 title 필드를 받는 작은 요청 DTO다.
    public record AddBookRequest(String title) {
    }
}
```

이 코드를 실행할 때 객체 연결 흐름은 다음과 같다.

```text
컴포넌트 스캔
  ├─ MemoryReadingRepository Bean 등록
  ├─ ReadingService Bean 등록
  └─ ReadingController Bean 등록
        ↓
MemoryReadingRepository 생성
        ↓ 생성자로 주입
ReadingService 생성
        ↓ 생성자로 주입
ReadingController 생성
        ↓
HTTP 요청 처리 준비 완료
```

이 예제의 HTTP 설계와 예외 응답은 아직 최소 형태다. 다음 MVC·REST 학습에서 요청 매핑, 상태 코드, DTO, 검증과 오류 응답을 더 정확히 다룬다.

## 13. 오류 메시지를 의존 관계로 읽기

### 13.1 Bean 후보가 하나도 없음

대표적인 의미:

```text
ReadingService 생성 필요
  → ReadingRepository 타입 Bean 필요
  → 후보를 찾지 못함
```

확인 순서:

1. 구현 클래스에 `@Repository`·`@Component` 또는 `@Bean` 등록이 있는가?
2. 구현 클래스가 시작 클래스의 기본 스캔 범위 안에 있는가?
3. 주입받는 타입과 구현한 인터페이스가 일치하는가?
4. 특정 Profile이나 조건 때문에 Bean 등록이 비활성화되지 않았는가?
5. 예외의 가장 아래 원인부터 읽었는가?

### 13.2 Bean 후보가 여러 개임

확인 순서:

1. 같은 인터페이스 구현 Bean 목록을 찾는다.
2. 중복 등록인지 의도한 다중 구현인지 판단한다.
3. 기본 후보면 `@Primary`, 위치별 선택이면 `@Qualifier`를 검토한다.
4. 매개변수 이름에 우연히 의존해 선택되도록 두지 않는다.

### 13.3 순환 의존성

오류 메시지에 Bean 관계가 화살표나 순서로 나타나면 서로 요구하는 경로를 종이에 그려 본다.

```text
A → B → C → A
```

가장 먼저 할 일은 애너테이션을 추가하는 것이 아니라 이 관계 중 어느 방향이 잘못되었는지 확인하는 것이다.

### 13.4 생성자 내부 예외

Bean 주입 오류처럼 보여도 실제로는 생성자나 초기화 코드가 예외를 던졌을 수 있다.

- 생성자에서 파일·네트워크·DB에 즉시 접근하지 않았는가?
- 필수 설정 값이 비어 있지 않은가?
- `Caused by`의 가장 안쪽 예외는 무엇인가?
- 같은 오류가 `test` 실행에서도 재현되는가?

## 14. 적용 관점에서 다시 보기

### 14.1 구현 순서

새 기능의 객체 관계는 다음 순서로 작성하면 확인하기 쉽다.

1. Service가 수행할 업무를 한 문장으로 정한다.
2. Service가 필요로 하는 협력 기능을 찾는다.
3. 협력 기능의 계약을 인터페이스나 타입으로 표현한다.
4. 생성자에서 필수 의존성을 요구한다.
5. 구현 객체를 컴포넌트 스캔 또는 `@Bean`으로 등록한다.
6. 순수 Java 단위 테스트로 Service 규칙을 먼저 확인한다.
7. ApplicationContext 테스트로 실제 Bean 연결을 확인한다.

### 14.2 애너테이션을 읽는 질문

```text
@Service를 발견함
  → 어느 패키지 스캔이 이 클래스를 발견하는가?
  → 생성자는 어떤 타입의 Bean을 요구하는가?
  → 그 타입의 후보는 몇 개인가?
  → 이 Bean은 변경 가능한 상태를 갖는가?
```

이 질문을 반복하면 애너테이션을 역할 표시와 컨테이너 설정으로 읽을 수 있다.

### 14.3 컨테이너가 필요한 테스트와 필요 없는 테스트

| 확인 대상 | Spring 컨테이너 | 예시 |
| --- | --- | --- |
| Service의 계산·검증 규칙 | 대체로 불필요 | 생성자로 fake 주입 후 JUnit 실행 |
| 컴포넌트 스캔과 Bean 연결 | 필요 | ApplicationContext 로딩 테스트 |
| Controller의 HTTP 매핑 | 웹 테스트 환경 필요 | MVC 슬라이스 테스트 |
| 전체 요청·DB 흐름 | 전체 통합 환경 필요 | 통합 테스트 |

모든 테스트에 전체 Spring Boot를 시작하면 느려지고 실패 원인이 넓어진다. 검증하려는 책임에 맞는 가장 작은 범위를 선택한다.

## 15. 배운 점과 다음 학습 연결

### 15.1 새로 이해한 것

- 객체 의존성은 한 객체가 다른 객체의 기능을 필요로 하는 관계다.
- DI는 Spring 없이도 적용할 수 있는 설계 방식이다.
- Spring은 ApplicationContext를 통해 Bean 정의를 읽고 객체를 조립한다.
- 컴포넌트 스캔과 `@Bean`은 서로 다른 Bean 등록 방법이다.
- 생성자 주입은 필수 의존성과 테스트 가능성을 코드에 드러낸다.
- 후보 없음·후보 여러 개·순환 관계는 서로 다른 원인의 오류다.
- singleton Bean에는 요청마다 달라지는 변경 가능 상태를 저장하지 않는다.

### 15.2 이전 학습과 연결

이전 노트에서 `SpringApplication.run()`이 ApplicationContext를 시작하고 Bean을 구성한다고 배웠다. 이번에는 그 안에서 어떤 객체가 발견되고 어떻게 생성자에 연결되는지 구체적으로 살펴봤다.

### 15.3 다음 학습

다음 주제는 **Spring MVC 요청 흐름**이다. 내장 서버가 받은 HTTP 요청이 `DispatcherServlet`을 지나 Controller 메서드로 전달되고, 반환값이 HTTP 응답으로 바뀌는 과정을 추적한다.

## 16. 요약 정리

1. 의존성은 한 객체가 자신의 일을 위해 다른 객체나 값을 필요로 하는 관계다.
2. DI는 필요한 객체를 내부에서 직접 만들지 않고 생성자·팩터리 메서드·Setter 등을 통해 외부에서 받는 방식이다.
3. IoC는 객체 생성과 조립의 제어 책임이 컨테이너로 이동한 원칙이다.
4. Bean은 Spring 컨테이너에 등록되어 생성·설정·관리되는 객체다.
5. 컴포넌트 스캔은 역할 애너테이션이 붙은 클래스를 찾고, `@Bean`은 메서드 반환 객체를 명시적으로 등록한다.
6. 필수 의존성에는 완전한 초기화, `final` 필드, 단위 테스트에 유리한 생성자 주입을 우선한다.
7. 같은 타입 후보가 여러 개면 등록 의도를 확인한 뒤 `@Primary`나 `@Qualifier`로 정책을 표현한다.
8. 기본 singleton Bean은 여러 요청이 공유하므로 요청별 변경 상태를 필드에 보관하지 않는다.
9. 순환 의존성은 주입 방식으로 숨기기보다 객체 책임과 의존 방향을 다시 설계할 신호다.
10. Bean 오류는 생성 대상 → 필요한 타입 → 후보 목록 → 가장 안쪽 원인 순으로 읽는다.

🧠 기억할 것: **객체는 필요한 기능만 생성자로 요구하고, Spring 컨테이너는 등록된 Bean을 찾아 조립한다.**

## 17. 미니 퀴즈

1. DI와 IoC는 어떻게 다른가?
2. 같은 클래스의 객체라도 어떤 것은 Bean이고 어떤 것은 일반 객체일 수 있는 이유는 무엇인가?
3. 직접 작성하지 않은 외부 라이브러리 객체를 Bean으로 등록할 때 어떤 방식을 사용할 수 있는가?
4. 생성자가 하나인 Spring Bean에서 `@Autowired`를 생략해도 되는 이유는 무엇인가?
5. `ReadingRepository` 구현 Bean이 두 개일 때 무엇부터 확인해야 하는가?
6. singleton Service의 필드에 현재 사용자 이메일을 저장하면 왜 위험한가?
7. `A → B → A` 생성자 의존성이 발견되면 우선 무엇을 검토해야 하는가?

<details>
<summary>정답과 해설</summary>

1. DI는 의존 객체를 외부에서 전달하는 방법이고, IoC는 객체 생성과 조립의 제어권이 컨테이너로 이동한 더 넓은 원칙이다.
2. Bean은 클래스 종류가 아니라 해당 객체가 ApplicationContext에 등록되어 관리되는지로 구분하기 때문이다.
3. `@Configuration` 클래스의 `@Bean` 메서드에서 객체를 생성해 반환할 수 있다.
4. Spring이 단일 생성자를 주입 대상으로 선택하고 매개변수 타입에 맞는 Bean을 찾기 때문이다.
5. 두 구현이 모두 필요한지, 실수로 중복 등록된 것은 아닌지 먼저 확인한 뒤 선택 정책을 정한다.
6. 여러 요청과 스레드가 같은 Bean 인스턴스를 공유하면서 사용자 값이 서로 덮어쓰이거나 노출될 수 있기 때문이다.
7. 두 객체의 책임이 잘못 나뉘었거나 의존 방향이 뒤집힌 것은 아닌지 검토하고 공통 책임 분리나 이벤트 방식 등을 고려한다.

</details>

## 참고 자료

- [Spring Framework — The IoC Container](https://docs.spring.io/spring-framework/reference/core/beans.html)
- [Spring Framework — Container Overview](https://docs.spring.io/spring-framework/reference/core/beans/basics.html)
- [Spring Framework — Dependency Injection](https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html)
- [Spring Framework — Classpath Scanning and Managed Components](https://docs.spring.io/spring-framework/reference/core/beans/classpath-scanning.html)
- [Spring Framework — Using the @Bean Annotation](https://docs.spring.io/spring-framework/reference/core/beans/java/bean-annotation.html)
- [Spring Framework — Autowiring with Qualifiers](https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-qualifiers.html)
- [Spring Framework — Bean Scopes](https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html)

> 정리 기준일: 2026-08-26. 애너테이션 해석과 후보 선택 세부 규칙은 프로젝트가 사용하는 Spring Framework 버전의 공식 문서를 우선한다.
