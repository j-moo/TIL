# Spring 트랜잭션: 여러 DB 작업을 함께 확정하고 되돌리기

- 🎯 학습 목표: Service의 작업 경계를 기준으로 commit·rollback을 설명하고, 예외·프록시·전파 설정이 결과를 바꾸는 이유를 이해한다.
- 🧩 핵심 키워드: ACID, auto-commit, TransactionManager, `@Transactional`, rollbackFor, REQUIRED, REQUIRES_NEW, rollback-only, 격리 수준
- ⭐ 중요도: ★★★★★ — 재고 차감과 대여 기록 중 하나만 저장되는 문제는 개별 SQL이 맞더라도 발생할 수 있다.
- 📝 한눈에 보는 내용: 트랜잭션은 같은 자원의 여러 변경을 하나의 성공·실패 단위로 묶는다. Spring에서는 프록시와 트랜잭션 관리자가 경계를 적용하며, 예외가 경계를 넘어가는 방식과 rollback 규칙을 함께 확인해야 한다.
- 🧱 선수 지식: Java 예외·생성자 주입, SQL INSERT·UPDATE·기본키, Repository·Service의 역할
- 🔗 이전 노트: [Entity 생명주기와 연관관계](../08_09_05_Entity_Lifecycle_and_Relationships/09_05_Entity_Lifecycle_and_Relationships.md)

> 정리 기준일: 2026-09-06. Spring Framework 7.0 공식 문서와 Spring Data JPA 문서를 확인했다. 본문은 JDBC·JPA의 일반적인 동기식 호출과 기본 프록시 모드를 다루며, Reactive 트랜잭션은 별도 주제다. 전체 예제는 단일 DataSource·단일 트랜잭션 관리자를 사용하는 별도 학습 프로젝트를 전제로 한다. 문서의 Java·SQL 코드는 이번 저장소 작업에서 실제 Spring·DB로 실행하지 않았으며, 테스트 결과는 직접 확인할 예상 결과로 제시한다.

## 1. SQL 두 개가 각각 맞는데 왜 데이터가 틀릴까?

대여 가능한 책이 3권 있다고 하자. 한 권을 빌리려면 두 작업이 필요하다.

```text
1. 대여 가능 수량: 3 → 2
2. 누가 어떤 책을 빌렸는지 대여 기록 추가
```

첫 번째 작업 뒤에 두 번째 작업이 실패하면 어떻게 될까? 재고는 줄었는데 대여 기록은 없다. 각 SQL의 문법 문제가 아니라 **두 작업을 함께 성공시켜야 한다는 업무 규칙**을 지키지 못한 것이다.

트랜잭션(transaction)은 이런 변경들을 하나의 처리 단위로 묶는다. 성공하면 commit으로 확정하고, 실패하면 rollback으로 그 단위의 DB 변경을 취소한다.

```text
트랜잭션 시작
  → 재고 차감
  → 대여 기록 추가
      ├─ 성공 → commit → 두 변경 확정
      └─ 실패 → rollback → 이번 재고 차감도 취소
```

여기서 rollback은 Java 프로그램 전체의 시간을 되감는 기능이 아니다. 이미 출력한 로그, 보낸 이메일, 외부 결제 요청, 바꾼 일반 Java 변수까지 자동으로 복구하지 않는다. **어느 DB 연결·어느 자원이 같은 트랜잭션에 참여하는지**가 중요하다.

## 2. ACID를 업무 요구사항으로 읽기

ACID는 트랜잭션의 성질을 설명하는 네 단어의 첫 글자다.

| 성질 | 의미 | 대여 예제에서 묻는 질문 |
| --- | --- | --- |
| Atomicity — 원자성 | 작업 단위의 변경이 전부 반영되거나 취소됨 | 재고만 줄고 기록은 없는 상태를 막는가? |
| Consistency — 일관성 | 유효한 상태에서 규칙을 지키는 상태로 이동 | 재고가 음수가 되지 않도록 규칙·제약을 작성했는가? |
| Isolation — 격리성 | 동시에 실행되는 작업 사이의 관찰·간섭을 제어 | 마지막 한 권을 두 요청이 동시에 빌리면 어떻게 되는가? |
| Durability — 지속성 | 확정한 결과를 DB의 보장 범위에 따라 유지 | commit한 대여 기록을 이후에도 읽을 수 있는가? |

트랜잭션을 사용한다고 업무 규칙이 저절로 만들어지지는 않는다. 원자성은 재고·기록 변경을 묶어 주지만, “한 사람이 같은 책을 중복 대여할 수 없다”는 정책은 애플리케이션 로직과 DB 제약으로 따로 표현해야 한다.

또한 모든 격리 수준이 모든 동시성 문제를 없애는 것은 아니다. 일단 이번 예제에서는 재고 확인과 차감을 SQL 한 문장으로 묶고, 후반부에서 격리 수준과 잠금을 구분한다. 트랜잭션을 이용해 여러 JDBC 작업을 묶는 출발점은 [Spring 공식 입문 가이드](https://spring.io/guides/gs/managing-transactions/)에서도 확인할 수 있다.

## 3. JDBC 연결과 auto-commit에서 시작하기

JDBC에서 auto-commit이 켜진 연결은 각 SQL 문장의 작업 완료에 맞춰 자동으로 commit한다. 이 상태로 재고 UPDATE와 기록 INSERT를 별도로 실행하면 두 문장이 하나의 업무 단위가 되지 않는다. [JDBC Connection의 auto-commit 계약](https://docs.oracle.com/en/java/javase/21/docs/api/java.sql/java/sql/Connection.html)을 참고한다.

수동 JDBC에서는 연결의 auto-commit을 끄고, 같은 연결로 SQL을 실행하고, 성공·실패에 따라 commit·rollback을 호출한다. 연결 상태 복원과 반납까지 직접 관리해야 하므로 반복 코드가 생긴다.

Spring의 `PlatformTransactionManager`는 이런 시작·참여·확정·취소를 공통 계약으로 다룬다. JDBC에는 JDBC용 관리자가, JPA에는 `JpaTransactionManager` 같은 구현이 사용된다. Spring Boot는 의존성·DataSource·기존 Bean 등의 조건에 따라 관련 구성을 자동 설정한다.

```text
Controller 또는 다른 Bean
  → Service 프록시
      → 트랜잭션 관리자: 트랜잭션 시작 또는 기존 것에 참여
      → 실제 Service 메서드
          → Repository A
          → Repository B
      → 규칙에 따라 commit 또는 rollback
  → 호출자에게 결과 또는 예외 전달
```

프록시(proxy)는 실제 객체 앞에서 호출을 받아 부가 처리를 수행하는 객체다. 애너테이션 자체가 DB에 명령을 보내는 것이 아니라, 프록시와 관리자가 그 메타데이터를 읽고 경계를 적용한다. [Spring 선언적 트랜잭션의 구현 설명](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-decl-explained.html)을 참고한다.

`JdbcTemplate`은 Spring이 관리하는 연결 획득 경로를 사용하므로 같은 DataSource의 트랜잭션에 참여할 수 있다. 반면 `DriverManager.getConnection()`으로 별도 연결을 열면 현재 트랜잭션에 저절로 합쳐지지 않는다. [Spring JDBC의 연결·트랜잭션 연동](https://docs.spring.io/spring-framework/reference/data-access/jdbc/connections.html)을 함께 확인한다.

## 4. 예제 준비: 재고와 대여 기록을 분리한다

### 4.1 실습 프로젝트 범위

새 Spring Boot 학습 프로젝트에서 다음 의존성을 준비한다.

- `spring-boot-starter-jdbc`: JdbcTemplate과 JDBC 기반 데이터 접근 구성
- `com.h2database:h2`: 테스트용 메모리 DB Driver
- `spring-boot-starter-test`: JUnit·AssertJ·Spring 테스트 지원

버전은 선택한 Spring Boot의 의존성 관리에 맡기고 [Spring Boot SQL 데이터 접근 문서](https://docs.spring.io/spring-boot/reference/data/sql.html)에서 JDBC 구성 조건을 확인한다. 이 예제에는 JPA가 필요하지 않다. **SQL 실행과 rollback의 관계를 직접 보기 위해 JDBC를 사용**하며, 배운 경계 개념은 이후 JPA Service에도 적용한다.

5~7절의 Java 파일은 모두 `src/main/java/com/example/txstudy/`에 둔다. 같은 패키지 또는 상위 패키지에 Spring Boot 시작 클래스가 있어야 컴포넌트 스캔 대상이 된다. 기존 애플리케이션·운영 DB에 붙이지 않고 별도 실습 프로젝트에서 진행한다.

### 4.2 테스트 전용 스키마

다음은 `src/test/resources/tx-schema.sql`의 전체 내용이다. 각 SQL 줄의 주석은 실제 SQL 주석 문법인 `--`를 사용한다.

```sql
-- 한 종류의 책에 대해 대여 가능한 수량을 저장하는 테스트 테이블이다.
CREATE TABLE tx_book_stock (
    book_id BIGINT PRIMARY KEY, -- 책 종류의 식별자이며 중복될 수 없다.
    available_count INTEGER NOT NULL, -- 현재 남은 대여 가능 수량이다.
    CHECK (available_count >= 0) -- 잘못된 쓰기로 음수 재고가 저장되는 것을 막는다.
);

-- 대여 요청 하나가 성공했다는 사실을 저장하는 테스트 테이블이다.
CREATE TABLE tx_loans (
    request_id VARCHAR(36) PRIMARY KEY, -- 같은 요청 ID를 두 번 저장할 수 없다.
    book_id BIGINT NOT NULL, -- 빌린 책의 종류를 기록한다.
    member_id BIGINT NOT NULL, -- 회원 ID를 기록한다. 회원 테이블은 예제에서 생략한다.
    FOREIGN KEY (book_id) REFERENCES tx_book_stock(book_id) -- 없는 책을 참조하지 못하게 한다.
);
```

`request_id`는 뒤에서 중복 기본키 오류를 재현하는 데도 사용한다. 중복 INSERT를 거부하는 제약만으로 완성된 멱등성(idempotency)이 구현되는 것은 아니다. 같은 요청에 기존 성공 결과를 돌려주는 정책, 요청 내용의 동일성 검사 등은 별도 설계가 필요하다.

## 5. 첫 번째 Repository: 재고가 있을 때만 차감하기

아래는 `BookStockRepository.java`의 전체 내용이다. 먼저 조회한 뒤 Java에서 1을 빼서 저장하는 대신, 조건 검사와 감소를 UPDATE 한 문장에 넣는다.

```java
package com.example.txstudy; // 관련 클래스들을 같은 패키지로 묶는다.

import org.springframework.jdbc.core.JdbcTemplate; // SQL 실행과 JDBC 반복 처리를 도와준다.
import org.springframework.stereotype.Repository; // 이 클래스를 데이터 접근 Bean으로 등록한다.

@Repository // 컴포넌트 스캔이 이 클래스의 객체를 만들도록 표시한다.
public class BookStockRepository { // 재고 테이블 접근을 담당한다.
    private final JdbcTemplate jdbcTemplate; // 생성자로 받은 도구를 저장하며 다시 대입하지 않는다.

    public BookStockRepository(JdbcTemplate jdbcTemplate) { // Spring이 JdbcTemplate Bean을 전달한다.
        this.jdbcTemplate = jdbcTemplate; // 전달받은 객체를 인스턴스 필드에 보관한다.
    }

    public int decreaseIfAvailable(long bookId) { // 차감된 행 수를 반환한다.
        return jdbcTemplate.update( // UPDATE의 영향받은 행 수를 int로 받는다.
                "UPDATE tx_book_stock " // 수정할 테이블을 지정한다.
                + "SET available_count = available_count - 1 " // 현재 DB 값에서 한 권을 뺀다.
                + "WHERE book_id = ? AND available_count > 0", // 대상 책에 재고가 있을 때만 수정한다.
                bookId // ? 자리에 값을 바인딩하며 SQL 문자열에 직접 이어 붙이지 않는다.
        ); // 실행 결과를 Service에 돌려준다.
    }
}
```

결과가 `1`이면 재고가 있는 책 한 행을 수정했다. `0`이면 책이 없거나 재고가 없어서 수정하지 않았다. 이 입문 예제는 두 상황을 같은 실패로 다루지만, 실제 API에서는 필요에 따라 존재하지 않는 책과 재고 부족을 구분한다.

조건부 UPDATE는 DB가 수량 변경을 처리하도록 하므로 별도의 SELECT 후 오래된 값을 덮어쓰는 패턴을 피할 수 있다. 다만 DB 격리 수준·잠금 대기·직렬화 실패 등의 동작까지 없어지는 것은 아니다. 다중 요청 검증은 운영에 사용할 DB 엔진에서도 수행해야 한다.

## 6. 두 번째 Repository: 대여 사실 저장하기

다음은 `LoanRepository.java`의 전체 내용이다. Repository는 SQL을 담당하고, 두 Repository를 하나의 업무 단위로 묶는 책임은 Service가 맡는다.

```java
package com.example.txstudy; // 재고 Repository 및 Service와 같은 패키지다.

import org.springframework.jdbc.core.JdbcTemplate; // Parameter를 바인딩해 INSERT를 실행한다.
import org.springframework.stereotype.Repository; // 데이터 접근용 Spring Bean을 표시한다.

@Repository // 애플리케이션 시작 시 이 클래스를 Bean으로 등록한다.
public class LoanRepository { // 대여 기록을 저장하는 클래스다.
    private final JdbcTemplate jdbcTemplate; // 같은 DataSource를 사용하는 JdbcTemplate을 보관한다.

    public LoanRepository(JdbcTemplate jdbcTemplate) { // 생성자 주입으로 도구를 받는다.
        this.jdbcTemplate = jdbcTemplate; // 메서드에서 쓸 수 있도록 필드에 저장한다.
    }

    public void insert(String requestId, long bookId, long memberId) { // 대여 한 건의 값을 받는다.
        jdbcTemplate.update( // INSERT도 update 메서드로 실행한다.
                "INSERT INTO tx_loans (request_id, book_id, member_id) " // 저장할 열 순서를 정한다.
                + "VALUES (?, ?, ?)", // 외부 입력은 세 개의 Parameter로 분리한다.
                requestId, bookId, memberId // 위의 ? 순서와 동일하게 값을 전달한다.
        ); // 중복 기본키 등 DB 오류가 나면 예외가 호출자에게 전달된다.
    }
}
```

같은 `requestId`를 다시 INSERT하면 기본키 제약을 위반한다. `JdbcTemplate`은 JDBC 예외를 Spring의 `DataAccessException` 계열로 변환한다. 뒤의 H2 테스트는 중복 키 상황에서 `DuplicateKeyException`을 기대한다.

중요한 것은 “DB 오류는 로그만 찍고 계속한다”가 아니라, **저장 실패를 전체 대여 실패로 볼지 결정할 계층에 전달한다**는 점이다.

## 7. Service에서 성공·실패 단위를 선언한다

다음은 `LoanService.java` 전체 코드다. 이 메서드는 다른 Bean 또는 테스트가 **Spring에서 주입받은 Service 프록시를 통해 호출**해야 한다.

```java
package com.example.txstudy; // 앞의 두 Repository와 동일한 패키지를 사용한다.

import org.springframework.stereotype.Service; // 업무 처리용 Spring Bean을 표시한다.
import org.springframework.transaction.annotation.Transactional; // Spring의 트랜잭션 애너테이션이다.

@Service // 직접 new로 만들지 않고 Spring이 객체의 생성·주입을 관리한다.
public class LoanService { // 여러 데이터 접근을 하나의 대여 작업으로 묶는다.
    private final BookStockRepository stockRepository; // 재고 SQL을 실행할 의존성이다.
    private final LoanRepository loanRepository; // 대여 기록 SQL을 실행할 의존성이다.

    public LoanService(BookStockRepository stockRepository, LoanRepository loanRepository) { // 필요한 두 Bean을 받는다.
        this.stockRepository = stockRepository; // 재고 접근 객체를 보관한다.
        this.loanRepository = loanRepository; // 기록 접근 객체를 보관한다.
    }

    @Transactional // 기본 REQUIRED 전파로 트랜잭션을 시작하거나 기존 트랜잭션에 참여한다.
    public void borrow(long bookId, long memberId, String requestId) { // 대여 요청의 입력을 받는다.
        if (bookId <= 0 || memberId <= 0) { // 예제에서 ID는 양수라는 최소 계약을 확인한다.
            throw new IllegalArgumentException("책과 회원 ID는 양수여야 합니다."); // DB 수정 전에 실패한다.
        }
        if (requestId == null || requestId.isBlank() || requestId.length() > 36) { // DB 열에 맞는 입력인지 확인한다.
            throw new IllegalArgumentException("요청 ID는 1~36자여야 합니다."); // 잘못된 요청은 즉시 거부한다.
        }

        int changed = stockRepository.decreaseIfAvailable(bookId); // 첫 번째 DB 작업: 재고를 한 권 줄인다.
        if (changed != 1) { // 없는 책 또는 재고 부족이면 대여 기록을 만들지 않는다.
            throw new IllegalStateException("대여 가능한 책이 없습니다."); // 실행 예외를 프록시 밖으로 전달한다.
        }

        loanRepository.insert(requestId, bookId, memberId); // 두 번째 DB 작업: 실패하면 앞의 차감도 취소 대상이다.
    } // 새 트랜잭션을 시작했다면 프록시가 commit한다. 기존 것에 참여했다면 최종 확정은 바깥 경계에서 한다.
}
```

성공 경로에서는 두 SQL이 같은 트랜잭션에 참여하고 함께 commit된다. 두 번째 INSERT에서 실행 예외가 발생해 프록시로 전달되면 기본 rollback 규칙에 따라 첫 UPDATE도 취소한다.

Repository 두 개에 각각 별도 트랜잭션을 시작하고 끝내는 것과, Service 바깥에 하나의 경계를 두는 것은 다르다. JPA의 `save()` 같은 Repository 메서드에 트랜잭션 기본값이 있더라도 여러 호출의 업무적 원자성은 상위 Service 경계로 설계한다. [Spring Data JPA의 Service 경계 설명](https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html)을 참고한다.

예외를 HTTP 400·404·409 등으로 바꾸는 처리는 앞의 [Validation·예외 처리 노트](../05_09_01_Validation_and_Exception_Handling/09_01_Validation_and_Exception_Handling.md)와 연결한다. 위의 일반 Java 예외는 입문용이며 최종 REST 오류 계약을 완성한 것은 아니다.

## 8. 어떤 예외에서 rollback할까?

별도 기본 정책 변경이나 개별 규칙이 없다면 다음과 같이 이해한다.

| 메서드 경계를 벗어나는 결과 | 기본 처리 |
| --- | --- |
| 정상 반환 | commit 시도 |
| `RuntimeException` 또는 `Error` | rollback |
| checked exception — 예: `IOException` | 기본적으로 rollback 대상이 아님 |

“예외가 났다”는 말만으로는 부족하다. 예외 종류와 적용된 rollback 규칙을 확인해야 한다. checked exception은 메서드의 `throws` 등으로 처리 책임을 명시하는 검사 예외이고, RuntimeException은 비검사 예외다.

특정 검사 예외에서도 취소해야 한다면 메서드의 애너테이션에 타입 기반 규칙을 추가할 수 있다.

```java
// 아래는 전체 클래스가 아니라 메서드에 붙일 애너테이션과 import 예시다.
import java.io.IOException; // 입출력 실패를 나타내는 검사 예외 타입이다.
import org.springframework.transaction.annotation.Transactional; // Spring 트랜잭션 설정을 사용한다.

@Transactional(rollbackFor = IOException.class) // 이 예외와 하위 타입도 rollback 대상으로 지정한다.
// 실제 업무 메서드 선언을 바로 아래에 둔다. 기존 RuntimeException 기본 규칙도 유지된다.
```

`noRollbackFor`는 특정 예외를 rollback 규칙에서 제외할 때 사용한다. 문자열 패턴은 의도하지 않은 예외 이름까지 매칭할 수 있으므로 가능한 한 예외 Class로 규칙을 표현한다.

Spring Framework 6.2 이후에는 전역 기본 정책을 `ALL_EXCEPTIONS`로 변경할 수도 있다. 그래서 다른 프로젝트의 코드에서 검사 예외가 rollback된다고 기본 계약이 항상 그런 것으로 일반화하면 안 된다. [Spring 공식 rollback 규칙](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)과 [애너테이션 설정](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)을 함께 확인한다.

## 9. 예외를 catch하면 무엇이 달라질까?

7절의 마지막 INSERT를 다음처럼 바꾸는 것은 주의가 필요하다. 아래는 **문제를 설명하기 위한 교체 조각**이지 권장 완성 코드가 아니다.

```java
// 이미 재고 차감이 성공한 뒤의 상황이라고 가정한다.
try { // 대여 기록 저장 오류를 이 메서드 내부에서 처리하려 한다.
    loanRepository.insert(requestId, bookId, memberId); // 중복 요청이면 예외가 발생한다.
} catch (org.springframework.dao.DuplicateKeyException exception) { // 중복 키 오류를 잡는다.
    return; // 실패를 다시 던지지 않아 프록시는 정상 반환으로 관찰할 수 있다.
}
```

메서드 안에서 예외를 잡으면 프록시가 그 예외를 직접 관찰하지 못한다. 이 경우 DB·관리자의 상태에 따라 재고 차감만 commit되는 등 원하지 않는 결과가 생길 수 있다.

다만 “catch하면 무조건 commit”도 틀리다. 내부 트랜잭션 경계에서 이미 rollback-only로 표시했거나 DB 자체가 해당 트랜잭션을 실패 상태로 만들었다면 commit할 수 없다. DB 오류 후 계속 실행해도 되는지 역시 DB 제품과 오류 종류에 따라 달라진다.

전체 작업을 취소해야 하는 실패라면 예외를 전파하거나 적절한 실행 예외로 변환해 경계를 넘기는 설계를 우선한다. 실패를 정상 결과로 반환해야 할 때는 `TransactionTemplate` 등으로 취소 여부를 명시하는 대안도 있다.

## 10. 같은 클래스 안에서 부르면 왜 애너테이션이 적용되지 않을까?

다음 메서드를 `LoanService` 안에 추가한다고 생각해 보자. 이 메서드 자체에는 트랜잭션이 없고, 호출자에게도 기존 트랜잭션이 없다고 가정한다.

```java
// LoanService 내부에 추가하는 반례용 메서드 조각이다.
public void borrowViaThis(long bookId, long memberId, String requestId) { // 외부 호출이 이 메서드로 들어온다.
    this.borrow(bookId, memberId, requestId); // 대상 객체 내부 호출이므로 프록시를 다시 지나지 않는다.
}
```

기본 프록시 모드의 트랜잭션 처리는 프록시를 통과하는 호출에 적용된다. `this.borrow()`는 실제 객체 내부에서 직접 호출하므로 `borrow`의 애너테이션이 새로 개입하지 않는다.

다음 두 상황도 구분한다.

- 바깥 메서드에 트랜잭션이 없으면 내부 애너테이션만으로 새 트랜잭션이 생기지 않는다.
- 바깥 메서드가 이미 트랜잭션을 시작했다면 내부 DB 작업은 그 경계에 참여할 수 있지만, 내부 메서드의 `REQUIRES_NEW` 같은 설정은 새로 적용되지 않는다.

초기에는 **외부에서 호출되는 public Service 메서드에 업무 경계를 두고**, 다른 트랜잭션 정책이 필요한 역할은 별도 Bean으로 분리하는 방식부터 사용한다. 단순히 메서드를 public으로 바꿔도 내부 호출 문제는 해결되지 않는다. `private`, 클래스 기반 프록시의 `final` 메서드도 프록시가 가로챌 수 없는 제약을 확인해야 한다. [Spring AOP 프록시 규칙](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)을 참고한다.

## 11. 전파: 기존 트랜잭션이 있을 때 어떻게 할까?

전파(propagation)는 트랜잭션 메서드가 호출되었을 때 기존 트랜잭션과 어떤 관계를 맺을지 정하는 정책이다. 전파는 HTTP 요청을 다음 서버로 전달한다는 뜻이 아니다.

| 전파 | 기존 트랜잭션이 있을 때 | 주의할 점 |
| --- | --- | --- |
| REQUIRED — 기본값 | 기존 트랜잭션에 참여 | 내부 실패가 전체 rollback으로 이어질 수 있음 |
| REQUIRES_NEW | 기존 것을 중단해 두고 독립 트랜잭션 시작 | 별도 commit이며 추가 연결·잠금 경합을 고려 |
| NESTED | 지원되는 경우 savepoint를 이용 | 별도 물리 트랜잭션이 아니며 관리자·Driver 지원 필요 |

### 11.1 REQUIRED와 rollback-only

외부 Bean A와 내부 Bean B가 모두 REQUIRED이고 프록시를 통해 호출되면, 단일 DB 기준으로 같은 물리 트랜잭션을 공유하는 것이 일반적이다. 각 메서드의 논리적 경계는 있어도 commit 단위가 두 개라는 뜻은 아니다.

```text
A의 REQUIRED 경계 시작
  → B의 REQUIRED 경계에 진입: 같은 트랜잭션 참여
  → B에서 rollback 대상 예외 발생
  → 공유 트랜잭션이 rollback-only 상태가 됨
  → A가 예외를 catch하고 정상 반환하려 함
  → 최종 경계에서 commit할 수 없어 UnexpectedRollbackException 가능
```

rollback-only는 “이 트랜잭션은 성공으로 확정하면 안 된다”는 표시다. 외부 코드가 예외를 잡았다는 사실만으로 지워지지 않는다.

### 11.2 REQUIRES_NEW는 독립 성공을 허용한다

바깥 작업의 실패와 무관하게 별도 기록을 남기려는 경우 검토할 수 있다. 하지만 안쪽 기록이 commit된 뒤 바깥이 rollback되어도 **안쪽 결과는 남는다**. 재고와 대여처럼 함께 성공해야 하는 작업을 이 정책으로 나누면 원래 요구사항을 깨뜨릴 수 있다.

기존 트랜잭션이 연결을 보유한 채 내부 트랜잭션이 추가 연결을 요구하면 연결 풀이 고갈될 수 있다. 같은 행을 건드리면 잠금 대기도 생길 수 있으므로 만능 오류 해결책처럼 사용하지 않는다.

NESTED는 savepoint라는 중간 복구 지점을 사용하는 방식이다. 특히 JPA의 관리 객체 상태까지 savepoint rollback으로 자연스럽게 복원된다고 가정하지 않는다. [Spring 전파 공식 문서](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)를 기준으로 지원 범위를 확인한다.

## 12. 격리 수준·readOnly·timeout은 각각 다른 설정이다

### 12.1 격리 수준과 동시성

격리 수준(isolation level)은 다른 트랜잭션의 변경을 어떤 범위에서 관찰할지에 관한 정책이다. `Isolation.DEFAULT`는 모든 DB에서 동일한 격리를 강제한다는 뜻이 아니라 DB의 기본값을 사용한다는 뜻이다.

- Dirty read: 다른 트랜잭션이 아직 commit하지 않은 값을 읽음
- Non-repeatable read: 같은 행을 다시 읽었는데 값이 달라짐
- Phantom read: 같은 조건을 다시 조회했는데 결과에 속하는 행 집합이 달라짐

`READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE` 같은 이름이 있어도 DB별 MVCC·잠금 구현을 확인해야 한다. 예를 들어 PostgreSQL은 READ UNCOMMITTED를 READ COMMITTED처럼 처리하고, 기본 격리는 READ COMMITTED다. [PostgreSQL 격리 수준 문서](https://www.postgresql.org/docs/current/transaction-iso.html)를 참고한다.

이 노트의 조건부 재고 UPDATE는 작은 해결 패턴이다. 복잡한 동시 수정에서는 `@Version`을 이용한 낙관적 잠금, 비관적 잠금, 직렬화 실패 후 전체 작업 재시도 등을 별도 검토한다. **트랜잭션을 붙였다 = 동시성 문제 해결**로 결론 내리지 않는다.

### 12.2 readOnly와 timeout

다음은 조회용 메서드에 붙이는 설정 조각이다.

```java
// org.springframework.transaction.annotation.Transactional을 import한 위치에서 사용한다.
@Transactional(readOnly = true, timeout = 3) // 읽기 전용 힌트와 초 단위 제한을 설정한다.
// 조회 메서드를 이어서 선언한다. 이것만으로 쓰기를 무조건 차단하지는 않는다.
```

`readOnly`는 관리자·Driver·Provider가 최적화나 검사에 이용할 수 있는 힌트다. DB 사용자 권한이나 읽기 전용 서버를 대체하지 않는다. JPA/Hibernate에서 변경 감지·flush 동작에 영향을 줄 수도 있으므로 읽기 경계에서 쓰기를 하지 않는다.

`timeout`은 지원하는 트랜잭션 인프라에 전달하는 제한이며, 메서드 전체를 정확히 3초 후 강제 종료하거나 외부 HTTP 호출을 자동 취소하는 장치가 아니다. SQL·잠금·HTTP 클라이언트의 timeout도 구분해야 한다. 기존 REQUIRED 트랜잭션에 참여할 때 내부 메서드의 격리 수준·timeout을 새 경계처럼 덮어쓴다고 가정하지 않는다. [Transactional 공식 API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html)를 참고한다.

## 13. JPA의 flush와 트랜잭션의 끝 연결하기

이전 노트에서 flush는 관리 Entity 변경을 DB에 동기화하는 과정이라고 배웠다. 다음을 구분한다.

```text
Entity 필드 변경 → flush → UPDATE 실행 → commit 성공 → 최종 확정
                                 └→ 뒤 작업 실패 → rollback 가능
```

`saveAndFlush()`를 호출했다고 전체 업무가 성공한 것은 아니다. flush 후에도 취소할 수 있고, commit 시점의 제약·동시성 문제로 실패할 수도 있다.

따라서 Service 대상 메서드 안의 마지막 줄에 도달한 것과, 호출자가 트랜잭션 프록시에서 정상 결과를 받은 것도 다르다. 프록시가 메서드 반환 후 commit하는 과정에서 오류를 전달할 수 있다.

rollback 뒤에 남아 있는 Entity나 Java 변수의 값을 DB 확정값처럼 재사용하지 않는다. 실패한 관리 범위를 끝내고 새 트랜잭션에서 필요한 상태를 다시 읽는 흐름으로 복구한다. [Entity 상태·flush 복습](../08_09_05_Entity_Lifecycle_and_Relationships/09_05_Entity_Lifecycle_and_Relationships.md)과 연결해 생각한다.

## 14. 외부 API와 비동기 작업까지 함께 취소되지는 않는다

대여를 저장하면서 외부 알림 API도 호출한다고 해 보자. 알림 발송이 성공하고 DB commit이 실패하면 사용자는 성공 알림을 받았는데 대여 기록은 없을 수 있다. 반대로 DB commit 뒤 알림이 실패하면 DB는 이미 확정된 상태다.

네트워크 대기까지 긴 DB 트랜잭션 안에 넣으면 연결과 잠금을 오래 보유한다. 다음을 구분해 설계한다.

- DB 안에서 함께 확정해야 하는 변경
- commit 후에 수행해도 되는 부가 작업
- 실패 후 재시도·보상·중복 방지가 필요한 외부 효과

`@TransactionalEventListener`의 기본 AFTER_COMMIT 단계는 성공한 트랜잭션 이후에 이벤트를 처리하는 데 활용할 수 있다. 그러나 이것만으로 이벤트가 영구 저장되거나 서버 종료 후에도 반드시 재전달되는 것은 아니다. 보장이 필요하면 같은 DB 트랜잭션에 발송할 사건을 기록하는 Outbox 같은 후속 설계를 검토한다. [트랜잭션 연계 이벤트 공식 문서](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html)를 참고한다.

일반적인 동기식 Spring 트랜잭션은 실행 스레드에 연결된 문맥을 사용한다. `@Async`, 직접 만든 스레드, 비동기 콜백으로 일을 넘겼다고 기존 트랜잭션이 자동 전파되지 않는다. 비동기 작업 자체의 Bean·트랜잭션 경계를 별도로 확인한다.

## 15. TransactionTemplate로 경계를 코드에 드러내기

애너테이션 대신 코드 블록으로 경계를 표현할 수도 있다. 아래는 별도 대안 `ProgrammaticLoanService.java`이며 7절 Service의 내부에 추가하는 코드가 아니다.

```java
package com.example.txstudy; // Repository들과 동일한 패키지다.

import org.springframework.stereotype.Service; // Spring이 생성자 의존성을 주입할 Bean이다.
import org.springframework.transaction.PlatformTransactionManager; // 트랜잭션 제어의 공통 계약이다.
import org.springframework.transaction.support.TransactionTemplate; // 콜백 단위의 트랜잭션 도구다.

@Service // 생성자 주입을 받을 객체로 등록한다.
public class ProgrammaticLoanService { // 프로그램 방식의 대안을 보여 주는 별도 클래스다.
    private final TransactionTemplate transactions; // 사용할 경계 설정을 담는다.
    private final BookStockRepository stockRepository; // 재고 접근 객체다.
    private final LoanRepository loanRepository; // 대여 기록 접근 객체다.

    public ProgrammaticLoanService(PlatformTransactionManager manager, // 사용할 DB 트랜잭션 관리자를 받는다.
            BookStockRepository stockRepository, LoanRepository loanRepository) { // 같은 DB의 관리자·Repository를 받는다.
        this.transactions = new TransactionTemplate(manager); // 기본 REQUIRED 설정의 도구를 만든다.
        this.stockRepository = stockRepository; // 재고 접근을 위해 보관한다.
        this.loanRepository = loanRepository; // 대여 기록을 위해 보관한다.
    }

    public void borrowValidated(long bookId, long memberId, String requestId) { // 입력은 7절과 같은 검증을 통과했다고 전제한다.
        transactions.executeWithoutResult(status -> { // 이 콜백 안에서 트랜잭션을 시작하거나 기존 것에 참여한다.
            int changed = stockRepository.decreaseIfAvailable(bookId); // 재고 변경을 실행한다.
            if (changed != 1) { // 차감하지 못했으면 후속 INSERT를 진행하지 않는다.
                throw new IllegalStateException("대여 가능한 책이 없습니다."); // 실행 예외가 콜백 경계를 벗어나 취소된다.
            }
            loanRepository.insert(requestId, bookId, memberId); // 같은 트랜잭션으로 기록을 추가한다.
        }); // 콜백 결과에 따라 경계를 마무리한다. 기존 트랜잭션 참여 시 최종 commit은 바깥에서 한다.
    }
}
```

`status.setRollbackOnly()`를 호출해 취소 의도를 명시할 수도 있다. 다만 호출자가 실패 여부를 알 수 있도록 반환 계약도 설계해야 한다. TransactionTemplate은 프록시 내부 호출 함정을 피하는 대안이지만 Spring API 의존성이 코드에 직접 나타난다는 차이가 있다. [프로그램 방식 트랜잭션 문서](https://docs.spring.io/spring-framework/reference/data-access/transaction/programmatic.html)를 참고한다.

## 16. 실제 Service 경계를 검사하는 통합 테스트

### 16.1 테스트가 트랜잭션 누락을 가리지 않게 한다

테스트 자체에 `@Transactional`을 붙이면 Service에서 애너테이션을 빠뜨려도 테스트가 만든 트랜잭션 안에서 실행되어 결함이 가려질 수 있다. 이번 테스트는 **테스트 클래스·메서드에 `@Transactional`을 붙이지 않는다.** 주입된 Service의 실제 프록시가 작업을 확정·취소하는지 확인한다.

다음은 `src/test/java/com/example/txstudy/LoanServiceTest.java` 전체 코드다. 4절의 스키마 파일과 5~7절 클래스, 별도 Spring Boot 시작 클래스가 필요하다. 테스트 설정은 H2 메모리 DB를 명시하며 테스트 사이의 데이터 정리는 그 DB의 `tx_` 테이블만 대상으로 한다.

```java
package com.example.txstudy; // 테스트할 Service와 같은 패키지다.

import static org.assertj.core.api.Assertions.assertThat; // 결과값의 일치를 읽기 쉽게 검증한다.
import static org.assertj.core.api.Assertions.assertThatThrownBy; // 특정 호출이 예외를 던지는지 검사한다.

import org.junit.jupiter.api.BeforeEach; // 각 테스트 시작 전 데이터 준비 메서드를 표시한다.
import org.junit.jupiter.api.Test; // JUnit 테스트 메서드를 표시한다.
import org.springframework.beans.factory.annotation.Autowired; // 테스트 객체에 Bean을 주입한다.
import org.springframework.boot.test.context.SpringBootTest; // Boot 애플리케이션 문맥을 불러온다.
import org.springframework.dao.DuplicateKeyException; // 중복 기본키 오류에서 기대할 예외다.
import org.springframework.jdbc.core.JdbcTemplate; // 테스트가 DB의 최종 상태를 직접 읽는 데 사용한다.

@SpringBootTest(properties = { // 테스트 전용 설정으로 실제 Service Bean과 DB를 연결한다.
        "spring.datasource.url=jdbc:h2:mem:tx-study;DB_CLOSE_DELAY=-1", // 외부 DB가 아닌 메모리 DB를 사용한다.
        "spring.datasource.username=sa", // 테스트 H2의 로컬 기본 사용자다.
        "spring.datasource.password=", // 테스트 전용 빈 비밀번호이며 운영 설정으로 사용하지 않는다.
        "spring.sql.init.mode=always", // 테스트 스키마 초기화를 활성화한다.
        "spring.sql.init.schema-locations=classpath:tx-schema.sql", // 4절에서 작성한 DDL 파일을 읽는다.
        "spring.sql.init.data-locations=optional:classpath:tx-data.sql" // 기존 data.sql과 섞지 않는다. 데이터는 아래에서 준비한다.
}) // 단일 DataSource·JDBC 전용 실습 프로젝트에서 실행한다.
class LoanServiceTest { // 테스트 자체에는 트랜잭션을 선언하지 않는다.
    @Autowired // new LoanService가 아니라 프록시를 포함한 Spring Bean을 받는다.
    private LoanService loanService; // 7절에서 만든 업무 Service다.

    @Autowired // Service와 같은 테스트 DataSource의 JdbcTemplate을 받는다.
    private JdbcTemplate jdbcTemplate; // 서비스 호출 뒤 DB 결과를 확인한다.

    @BeforeEach // 테스트마다 동일한 초기 상태로 맞춘다.
    void prepare() { // 아래 삭제는 지정한 H2 테스트 DB에서만 실행한다.
        jdbcTemplate.update("DELETE FROM tx_loans"); // 외래키를 가진 자식 데이터를 먼저 지운다.
        jdbcTemplate.update("DELETE FROM tx_book_stock"); // 그다음 부모인 재고 데이터를 지운다.
        jdbcTemplate.update("INSERT INTO tx_book_stock VALUES (?, ?)", 1L, 3); // 1번 책의 초기 재고는 3권이다.
    }

    @Test // 정상 처리의 commit 결과를 확인한다.
    void 성공하면_재고와_기록이_함께_저장된다() { // 정상 처리 뒤 두 테이블의 값을 검사한다.
        loanService.borrow(1L, 7L, "request-one"); // 책 1번을 회원 7번이 한 권 빌린다.
        assertThat(stock()).isEqualTo(2); // Service가 끝난 뒤 재고 3 → 2를 확인한다.
        assertThat(loanCount()).isEqualTo(1); // 대여 기록도 한 건 저장되어야 한다.
    }

    @Test // 두 번째 SQL 실패 시 첫 번째 SQL도 취소되는지 확인한다.
    void 기록_저장에_실패하면_이번_재고_차감도_취소된다() { // 일부 SQL만 남는 원자성 위반을 찾아낸다.
        loanService.borrow(1L, 7L, "request-one"); // 먼저 정상 대여를 commit해 재고 2·기록 1을 만든다.
        assertThatThrownBy(() -> loanService.borrow(1L, 7L, "request-one")) // 같은 요청 ID로 다시 대여를 시도한다.
                .isInstanceOf(DuplicateKeyException.class); // UPDATE 뒤 INSERT가 기본키 중복으로 실패해야 한다.
        assertThat(stock()).isEqualTo(2); // 두 번째 시도의 차감은 취소되어 재고가 1이 되면 안 된다.
        assertThat(loanCount()).isEqualTo(1); // 첫 성공 기록만 남아야 한다.
    }

    @Test // 재고 부족은 기록 생성으로 이어지지 않아야 한다.
    void 재고가_없으면_대여_기록을_추가하지_않는다() { // 품절 상황의 실패 경로를 검사한다.
        jdbcTemplate.update("UPDATE tx_book_stock SET available_count = 0 WHERE book_id = ?", 1L); // 품절 상황을 준비한다.
        assertThatThrownBy(() -> loanService.borrow(1L, 7L, "request-zero")) // 재고 없는 책을 요청한다.
                .isInstanceOf(IllegalStateException.class); // Service의 재고 부족 분기를 확인한다.
        assertThat(stock()).isZero(); // 재고는 음수가 되지 않는다.
        assertThat(loanCount()).isZero(); // 대여 기록도 생기지 않는다.
    }

    private int stock() { // 메모리 객체가 아닌 DB의 재고를 읽는 보조 메서드다.
        return jdbcTemplate.queryForObject( // 한 행·한 열의 값을 Integer로 변환한다.
                "SELECT available_count FROM tx_book_stock WHERE book_id = ?", // 확인할 열과 행을 제한한다.
                Integer.class, 1L // 결과 타입과 책 ID를 지정한다.
        ); // 준비한 1번 책은 존재하므로 int로 반환할 수 있다.
    }

    private int loanCount() { // 저장된 대여 기록 수를 확인한다.
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM tx_loans", Integer.class); // COUNT 결과는 한 행이다.
    }
}
```

### 16.2 실행과 결과 해석

Maven Wrapper가 있는 **별도 실습 프로젝트 루트**의 Windows PowerShell에서 실행한다. TIL 저장소 루트에는 이 Wrapper가 없다.

```powershell
# LoanServiceTest만 실행한다. 이 명령은 위의 파일과 테스트 의존성이 갖춰진 실습 프로젝트용이다.
./mvnw.cmd '-Dtest=LoanServiceTest' test
```

정상 구성이면 세 테스트가 통과하고 빌드 성공을 확인하는 것이 목표다. 이번 문서 작성에서 얻은 실행 로그는 아니다.

가장 중요한 테스트는 두 번째다. Service의 `@Transactional`을 일부러 제거한 비교 실험에서 두 번째 재고 차감만 남아 `stock() == 2` 검증이 실패하는지 확인하면, 이 테스트가 경계 누락을 실제로 잡는지 알 수 있다. 실험 후에는 애너테이션을 복원한다.

H2 테스트는 원자성의 기본 흐름을 확인하는 용도다. 운영 DB의 잠금·격리 수준·Driver·예외 변환·동시 요청을 모두 검증한 것은 아니다. 테스트 트랜잭션과 애플리케이션 트랜잭션의 차이는 [Spring 테스트 트랜잭션 문서](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)에서 더 확인한다.

## 17. 문제가 생겼을 때 확인 순서

| 증상 | 먼저 확인할 것 |
| --- | --- |
| 일부 SQL만 저장됨 | 같은 DataSource·관리자인가? Service 경계가 있는가? |
| 애너테이션이 있는데 적용 안 됨 | 주입된 Bean 프록시인가? new·this 호출인가? |
| 예외 후 데이터가 남음 | 검사 예외인가? rollback 규칙은 무엇인가? 내부에서 catch했는가? |
| 정상 반환하려다 UnexpectedRollbackException | 내부 REQUIRED 경계에서 rollback-only로 표시했는가? |
| REQUIRES_NEW에서 멈춤 | 추가 연결 부족 또는 바깥 트랜잭션의 잠금 대기인가? |
| 테스트는 통과하지만 Service가 비트랜잭션 | 테스트 자체의 트랜잭션이 누락을 가리고 있는가? |
| 알림은 갔는데 DB는 취소됨 | 외부 효과를 DB rollback으로 복구한다고 가정했는가? |

처음에는 설정을 많이 바꾸기보다 “누가 누구를 호출했는가 → 어떤 트랜잭션에 참여했는가 → 어떤 예외가 어느 경계를 넘었는가 → 최종 DB 상태는 무엇인가” 순서로 추적한다.

## 18. 요약 정리

1. 트랜잭션의 경계는 SQL 개수보다 함께 성공해야 하는 업무 단위에서 정한다.
2. Spring의 선언적 트랜잭션은 프록시와 트랜잭션 관리자가 적용한다.
3. 같은 자원에 참여한 DB 변경만 함께 commit·rollback되며 외부 효과는 자동 복원되지 않는다.
4. 기본 rollback 규칙은 RuntimeException·Error이며 검사 예외와 프로젝트별 정책을 확인한다.
5. 예외를 catch해 정상 반환하는 것과 트랜잭션을 성공시켜도 되는 것은 다른 문제다.
6. 내부 this 호출은 기본 프록시 모드에서 새로운 트랜잭션 설정을 적용하지 않는다.
7. REQUIRED·REQUIRES_NEW·NESTED는 공유 경계·독립 경계·savepoint라는 차이가 있다.
8. readOnly·timeout·격리 수준은 각자 다른 목적이며 모든 실패·동시성 문제를 해결하지 않는다.
9. flush와 SQL 로그는 commit 성공을 의미하지 않는다.
10. Service 경계 테스트는 정상 결과뿐 아니라 뒤쪽 실패에 따른 앞쪽 변경의 취소까지 검증한다.

🧠 기억할 것: **트랜잭션은 애너테이션의 위치만 보는 것이 아니라 호출 경로·자원·예외·최종 DB 상태까지 연결해서 이해한다.**

## 19. 미니 퀴즈

1. 재고 Repository와 대여 Repository에 각각 트랜잭션을 붙이면 두 호출은 자동으로 한 작업이 되는가?
2. `IOException`이 메서드 밖으로 나갔다. 기본 설정에서 무조건 rollback되는가?
3. 내부 REQUIRED 메서드의 실행 예외를 바깥에서 잡았는데 왜 commit이 실패할 수 있는가?
4. `this.borrow()`를 `public` 메서드에서 호출하면 내부의 REQUIRES_NEW 설정이 새로 적용되는가?
5. readOnly가 붙었으니 DB 권한 설정 없이도 쓰기를 확실히 막았다고 할 수 있는가?
6. 중복 요청으로 INSERT가 실패한 테스트에서 재고 2와 기록 1을 함께 확인하는 이유는 무엇인가?
7. DB rollback이 이미 보낸 알림을 되돌리지 못한다면 어느 경계를 나누어 생각해야 하는가?

<details>
<summary>정답과 해설</summary>

1. 아니다. 공통 상위 경계 없이 각각 시작·종료하면 서로 다른 트랜잭션일 수 있다. Service에서 업무 전체를 묶어야 한다.
2. 아니다. 검사 예외이므로 기본적으로 rollback 대상이 아니다. rollbackFor 또는 전역 정책 변경 여부를 확인한다.
3. 내부 프록시 경계에서 공유 트랜잭션이 rollback-only로 표시되었을 수 있다. catch는 이 상태를 없애지 않는다.
4. 아니다. 기본 프록시 모드의 this 호출은 프록시를 다시 통과하지 않는다. public 여부만으로 해결되지 않는다.
5. 아니다. readOnly는 인프라가 해석하는 힌트이고 DB 권한을 대체하지 않는다.
6. 첫 정상 대여는 유지하면서 두 번째 실패 시도의 재고 차감만 취소되었는지 확인하기 위해서다. 예외 발생 여부만으로는 원자성을 증명할 수 없다.
7. DB 내부 원자적 변경과 외부 효과를 구분하고, commit 후 처리·재시도·중복 방지·Outbox·보상 전략을 요구사항에 맞게 설계한다.

</details>

## 20. 다음 학습 연결

다음에는 **단위 테스트·웹/데이터 슬라이스 테스트·통합 테스트**를 구분한다. 이번의 Service 트랜잭션 테스트를 출발점으로, 어떤 실패는 mock으로 확인할 수 있고 어떤 실패는 실제 Spring 프록시·DB가 있어야 확인할 수 있는지 정리한다.
