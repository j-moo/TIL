# 비관적 잠금과 조건부 UPDATE: 동시에 재고를 차감하는 두 방법

- 🎯 글의 목표: 재고 차감에서 비관적 잠금과 조건부 UPDATE가 동시 요청을 처리하는 방식을 비교하고, 대기·교착·재시도 정책까지 설명한다.
- 🧩 핵심 키워드: `PESSIMISTIC_WRITE`, `SELECT FOR UPDATE`, 행 잠금, 조건부 UPDATE, 영향 행 수, deadlock, lock timeout, idempotency
- ⭐ 중요도: ★★★★★ — 재고·좌석·한도처럼 0 아래로 내려가면 안 되는 값은 조회와 수정을 따로 생각할 때 동시 요청에서 업무 규칙이 깨질 수 있다.
- 📝 한눈에 보는 내용: 같은 상품 재고를 “잠근 뒤 읽고 수정하기”와 “조건을 포함한 UPDATE 한 번으로 수정하기”로 구현한다. 선택 기준, JPA 영속성 컨텍스트 주의점, PostgreSQL 두 세션 실습과 동시 실행 테스트를 함께 정리한다.
- 🧱 선수 지식: JPA Entity·Repository·변경 감지, `@Transactional`, `@Version`, SQL UPDATE·WHERE, Spring 통합 테스트
- 🔗 이전 노트: [낙관적 잠금과 동시 수정 충돌](../22_09_20_Optimistic_Locking/09_20_Optimistic_Locking.md)

> 정리 기준일: 2026-09-21. Java 21·Spring Boot 4.1·Spring Data JPA 4.1 계열과 Jakarta Persistence 3.2를 참고한 학습 코드다. DB별 잠금 동작을 섞지 않기 위해 SQL 설명은 PostgreSQL 17을 기준으로 한다. 실제 의존성 버전은 프로젝트의 Spring Boot 관리 결과로 확인한다. 이 TIL 저장소에는 실행 애플리케이션과 PostgreSQL 서버가 없으므로 Java 테스트와 두 세션 SQL은 실행하지 않았으며 결과는 예상으로 구분한다.

## 1. 들어가며: `stock > 0`을 확인했는데 왜 음수가 될까?

재고가 1개인 상품에 주문 요청 A와 B가 동시에 도착했다고 하자.

```text
요청 A: 재고 1 조회 → 1개 이상이므로 주문 가능
요청 B: 재고 1 조회 → 1개 이상이므로 주문 가능
요청 A: 재고를 0으로 저장
요청 B: 자신이 읽은 1에서 차감해 0으로 저장
```

최종 숫자는 0이라 자연스러워 보이지만 주문은 두 건 성공했다. 실제 보유 수량보다 더 많이 판매한 **초과 판매**다. `if (stock > 0)`이라는 Java 조건이 있어도 조회와 저장 사이에 다른 트랜잭션이 끼어들 수 있다.

이전 노트의 낙관적 잠금은 늦게 저장한 요청 하나를 충돌로 실패시킨다. 충돌이 드물 때 잘 맞지만 인기 상품처럼 같은 행에 수정이 몰리면 실패와 재작업이 많아질 수 있다. 이번에는 다음 두 대안을 비교한다.

1. **비관적 잠금**: 행을 먼저 잠근 요청이 판단과 수정을 끝낼 때까지 다른 수정 요청을 기다리게 한다.
2. **조건부 UPDATE**: `stock >= quantity`를 UPDATE의 WHERE에 넣어 한 문장의 영향 행 수로 성공을 판단한다.

두 방법 모두 만능은 아니다. “동시성 문제니까 무조건 잠근다”가 아니라 업무 규칙의 크기와 충돌 빈도, 대기 비용을 기준으로 선택해야 한다.

## 2. 전체 흐름부터 보기

### 2.1 비관적 잠금

```text
트랜잭션 A: 상품 행을 PESSIMISTIC_WRITE로 조회·잠금
  → 현재 재고와 주문 조건 검사
  → Entity 재고 감소
  → flush·commit
  → 잠금 해제

트랜잭션 B: 같은 행의 잠금을 요청
  → A가 끝날 때까지 대기
  → A가 반영한 최신 재고를 읽음
  → 부족하면 주문 거부
```

### 2.2 조건부 UPDATE

```text
UPDATE products
SET stock = stock - 요청수량
WHERE id = 상품ID AND stock >= 요청수량

영향 행 수 1 → 조건을 만족해 차감 성공
영향 행 수 0 → 상품이 없거나 재고 부족, 차감 실패
```

| 질문 | 비관적 잠금 | 조건부 UPDATE |
| --- | --- | --- |
| 판단 위치 | 잠근 Entity를 읽은 뒤 Java | UPDATE의 WHERE |
| SQL 왕복 | 보통 잠금 SELECT + UPDATE | 핵심 차감은 UPDATE 한 번 |
| 복잡한 업무 규칙 | 여러 값·연관 Entity를 검사하기 쉬움 | 한 SQL 조건으로 표현할 수 있을 때 유리 |
| 충돌 시 | 대기 후 실행하거나 timeout·교착 실패 | DB가 UPDATE를 직렬화하고 조건을 다시 판단 |
| JPA 주의점 | 트랜잭션 길이와 잠금 범위 | bulk UPDATE가 영속성 컨텍스트·`@Version`을 우회 |

## 3. 실습 모델: 재고와 버전을 함께 가진 Product

낙관적 잠금과 함께 사용할 수 있도록 `@Version`을 유지한다. 비관적 잠금을 사용한다고 버전 필드를 반드시 제거해야 하는 것은 아니다.

이후 Java 코드 블록의 `public` 타입은 각각 타입 이름과 같은 별도 `.java` 파일에 둔다. 한 파일에 여러 public 타입을 붙여 넣는 예제가 아니다.

```java
package com.example.stockstudy.product; // 재고 기능의 패키지다.

import jakarta.persistence.Column; // 컬럼 제약을 매핑한다.
import jakarta.persistence.Entity; // JPA Entity임을 표시한다.
import jakarta.persistence.GeneratedValue; // 기본키 생성 전략을 사용한다.
import jakarta.persistence.GenerationType; // IDENTITY 전략 상수를 사용한다.
import jakarta.persistence.Id; // 기본키 필드를 표시한다.
import jakarta.persistence.Table; // 테이블 이름을 지정한다.
import jakarta.persistence.Version; // 낙관적 버전 검사와 다른 수정 경로의 일관성을 유지한다.

@Entity // Hibernate가 이 객체의 영속성 생명주기를 관리한다.
@Table(name = "products") // products 테이블과 연결한다.
public class Product {

    @Id // 한 상품을 식별하는 기본키다.
    @GeneratedValue(strategy = GenerationType.IDENTITY) // ID는 DB가 생성한다.
    private Long id;

    @Column(nullable = false, length = 100) // 이름은 필수이며 최대 100자다.
    private String name;

    @Column(nullable = false) // 재고가 null이면 수량 비교를 할 수 없으므로 금지한다.
    private int stock;

    @Version // Entity 변경과 조건부 bulk UPDATE가 같은 개정 번호를 사용하게 한다.
    @Column(nullable = false) // 저장된 행은 항상 버전을 가진다.
    private Long version;

    protected Product() { // JPA가 reflection으로 Entity를 만들 때 사용한다.
    }

    public Product(String name, int stock) { // 학습 데이터 생성에 사용할 생성자다.
        if (stock < 0) { // 시작부터 음수 재고가 되는 입력을 막는다.
            throw new IllegalArgumentException("stock must not be negative"); // 잘못된 프로그래머 입력이다.
        }
        this.name = name; // 상품 이름을 저장한다.
        this.stock = stock; // 초기 재고를 저장한다.
    }

    public void decrease(int quantity) { // 잠금으로 보호된 Entity의 재고를 감소시킨다.
        if (quantity <= 0) { // 0·음수 차감은 재고를 늘리거나 의미 없는 요청이 된다.
            throw new IllegalArgumentException("quantity must be positive"); // Service에서도 입력 계약을 지킨다.
        }
        if (stock < quantity) { // 잠근 뒤 읽은 현재 재고로 업무 조건을 확인한다.
            throw new StockUnavailableException(id, quantity); // 부족하면 Entity를 바꾸지 않는다.
        }
        stock -= quantity; // 조건을 통과한 경우에만 관리 Entity를 변경한다.
    }

    public Long getId() { // Repository와 응답이 ID를 읽는다.
        return id; // 상품 식별자를 반환한다.
    }

    public String getName() { // 응답에서 이름을 사용할 수 있게 한다.
        return name; // 상품 이름을 반환한다.
    }

    public int getStock() { // 테스트와 응답이 현재 재고를 읽는다.
        return stock; // 재고 수량을 반환한다.
    }

    public Long getVersion() { // 동시성 테스트가 개정 증가를 확인한다.
        return version; // 버전은 읽기만 제공하고 직접 수정하지 않는다.
    }
}
```

DB에도 `stock >= 0` CHECK 제약을 추가하면 애플리케이션 버그나 다른 SQL 경로에 대한 마지막 방어선이 된다. 다만 CHECK 제약만으로 “요청한 수량만큼 주문했는가”나 오류 메시지 같은 업무 흐름 전체를 대신하지는 않는다.

```sql
ALTER TABLE products -- 기존 상품 테이블에 DB 불변 조건을 추가한다.
    ADD CONSTRAINT products_stock_non_negative -- 운영에서 식별할 수 있는 제약 이름이다.
    CHECK (stock >= 0); -- 어떤 쓰기 경로에서도 음수 저장을 거부한다.
```

이 DDL은 새 Flyway migration으로 배포하고, 기존 음수 데이터가 없는지 먼저 검증한다. 이미 적용한 migration 파일을 수정하지 않는다.

## 4. 방법 A: `PESSIMISTIC_WRITE`로 행을 먼저 잠근다

### 4.1 Repository의 잠금 조회

Spring Data JPA는 `@Lock`으로 Repository 쿼리의 JPA 잠금 모드를 지정한다.

```java
package com.example.stockstudy.product; // 상품 영속성 기능의 패키지다.

import java.util.Optional; // 상품 부재를 명시적으로 표현한다.

import jakarta.persistence.LockModeType; // JPA 표준 잠금 모드를 사용한다.

import org.springframework.data.jpa.repository.JpaRepository; // CRUD·flush를 제공한다.
import org.springframework.data.jpa.repository.Lock; // 쿼리에 잠금 모드를 지정한다.
import org.springframework.data.jpa.repository.Modifying; // 뒤의 bulk UPDATE를 수정 쿼리로 표시한다.
import org.springframework.data.jpa.repository.Query; // JPQL을 직접 선언한다.
import org.springframework.data.repository.query.Param; // 이름 기반 매개변수를 연결한다.

public interface ProductRepository extends JpaRepository<Product, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE) // 수정할 행에 배타적인 쓰기 잠금을 요청한다.
    @Query("select p from Product p where p.id = :productId") // 잠글 상품 한 건을 조회한다.
    Optional<Product> findByIdForUpdate(@Param("productId") Long productId); // 부재 가능성을 Optional로 표현한다.

    @Modifying(flushAutomatically = true, clearAutomatically = true) // 앞의 변경을 flush하고 실행 뒤 1차 캐시를 비운다.
    @Query("""
            update Product p
               set p.stock = p.stock - :quantity,
                   p.version = p.version + 1
             where p.id = :productId
               and p.stock >= :quantity
            """) // 재고 조건 검사·차감·version 증가를 한 SQL로 요청한다.
    int decreaseStockIfEnough(
            @Param("productId") Long productId, // 차감할 상품 ID다.
            @Param("quantity") int quantity // 양수로 검증된 차감 수량이다.
    ); // 반환값은 실제로 변경된 행 수다.
}
```

PostgreSQL에서 실제 SQL은 보통 `SELECT ... FOR UPDATE` 계열로 번역되지만 JPA 명세는 DB별 구현 SQL 자체를 고정하지 않는다. 로그에서 사용하는 dialect와 생성 SQL을 확인한다.

`PESSIMISTIC_WRITE`는 같은 행을 수정하거나 호환되지 않는 잠금을 얻으려는 다른 트랜잭션을 직렬화한다. PostgreSQL의 행 잠금은 일반적인 잠금 없는 SELECT까지 막는 것이 아니라 같은 행의 writer와 locker를 주로 기다리게 한다. 잠금은 보통 트랜잭션 종료까지 유지된다.

### 4.2 Service의 트랜잭션이 잠금 수명이다

```java
package com.example.stockstudy.product; // 상품 업무 로직의 패키지다.

import org.springframework.stereotype.Service; // Service Bean으로 등록한다.
import org.springframework.transaction.annotation.Transactional; // 잠금 조회부터 commit까지 한 경계로 묶는다.

@Service // Controller가 동시성 구현 세부사항을 알지 않게 한다.
public class StockService {

    private final ProductRepository productRepository; // DB 접근을 Repository에 위임한다.

    public StockService(ProductRepository productRepository) { // 생성자 주입으로 필수 의존성을 받는다.
        this.productRepository = productRepository; // 주입받은 Repository를 보관한다.
    }

    @Transactional // 메서드가 끝날 때까지 행 잠금과 변경을 같은 트랜잭션에 둔다.
    public StockResult decreaseWithPessimisticLock(Long productId, int quantity) {
        validateQuantity(quantity); // DB에 접근하기 전에 기본 입력 오류를 거부한다.

        Product product = productRepository.findByIdForUpdate(productId) // 행 잠금을 얻으며 상품을 읽는다.
                .orElseThrow(() -> new ProductNotFoundException(productId)); // 없으면 재고 부족과 구분한다.

        product.decrease(quantity); // 잠근 최신 재고를 검사하고 관리 Entity를 변경한다.
        productRepository.flush(); // UPDATE와 version 증가를 지금 DB에 반영한다.

        return StockResult.from(product); // flush 뒤의 재고와 버전을 응답 값으로 복사한다.
    }

    @Transactional // 조건부 UPDATE도 쓰기 트랜잭션 안에서 실행한다.
    public StockResult decreaseAtomically(Long productId, int quantity) {
        validateQuantity(quantity); // 0·음수 요청이 WHERE 조건을 왜곡하지 않게 한다.

        int updatedRows = productRepository.decreaseStockIfEnough(productId, quantity); // 원자적 차감을 시도한다.
        if (updatedRows != 1) { // 기본키 조건이므로 성공은 정확히 한 행이어야 한다.
            throw new StockUnavailableException(productId, quantity); // 부재·부족을 하나의 실패 계약으로 처리한다.
        }

        Product current = productRepository.findById(productId) // clear 뒤 최신 값을 다시 읽는다.
                .orElseThrow(() -> new ProductNotFoundException(productId)); // 성공한 UPDATE 뒤 부재는 비정상 상황이다.
        return StockResult.from(current); // DB가 확정할 새 재고·버전을 반환한다.
    }

    private void validateQuantity(int quantity) { // 두 전략이 같은 입력 규칙을 공유한다.
        if (quantity <= 0) { // 재고 차감은 반드시 양수여야 한다.
            throw new IllegalArgumentException("quantity must be positive"); // 400 응답 후보인 입력 오류다.
        }
    }
}
```

잠금은 Repository 메서드가 반환될 때가 아니라 **그 메서드가 참여한 DB 트랜잭션이 끝날 때** 해제된다. 따라서 `@Transactional`이 없는 Controller에서 잠금 조회 후 나중에 수정하는 구조는 의도한 보호 구간이 아니다.

잠근 상태에서 외부 결제 API 호출, 사용자 입력 대기, 긴 파일 처리 등을 하면 다른 요청의 대기 시간이 함께 늘어난다. 트랜잭션 안에는 현재 DB 상태를 판단하고 필요한 DB 변경을 기록하는 짧은 작업만 둔다.

### 4.3 결과 DTO와 예외

```java
package com.example.stockstudy.product; // 상품 결과 DTO의 패키지다.

public record StockResult(
        Long productId, // 변경된 상품의 식별자다.
        int stock, // 차감 뒤 남은 재고다.
        Long version // 다른 수정 경로와 공유하는 최신 개정이다.
) {
    public static StockResult from(Product product) { // Entity를 외부 응답 형태로 바꾼다.
        return new StockResult( // 필요한 값만 복사해 Entity 노출을 막는다.
                product.getId(), // 상품 ID를 복사한다.
                product.getStock(), // 현재 재고를 복사한다.
                product.getVersion() // 현재 version을 복사한다.
        );
    }
}
```

```java
package com.example.stockstudy.product; // 재고 업무 예외의 패키지다.

public class ProductNotFoundException extends RuntimeException {

    private final Long productId; // 찾지 못한 상품의 식별자다.

    public ProductNotFoundException(Long productId) { // 조회 실패 시 상품 ID를 받는다.
        super("Product not found: " + productId); // 서버 로그에서 구분할 메시지다.
        this.productId = productId; // 404 응답 구성에 사용할 값을 보관한다.
    }

    public Long getProductId() { // 예외 처리기가 상품 ID를 읽는다.
        return productId; // 찾지 못한 식별자를 반환한다.
    }
}
```

```java
package com.example.stockstudy.product; // 재고 업무 예외의 패키지다.

public class StockUnavailableException extends RuntimeException {

    private final Long productId; // 차감하지 못한 상품 ID다.
    private final int requestedQuantity; // 요청한 수량이다.

    public StockUnavailableException(Long productId, int requestedQuantity) {
        super("Stock is not available"); // 내부 로그에서 분류할 안정적인 메시지다.
        this.productId = productId; // 오류 응답에 사용할 ID를 보관한다.
        this.requestedQuantity = requestedQuantity; // 오류 응답에 사용할 수량을 보관한다.
    }

    public Long getProductId() { // 예외 처리기가 상품 ID를 읽는다.
        return productId; // 상품 식별자를 반환한다.
    }

    public int getRequestedQuantity() { // 예외 처리기가 요청 수량을 읽는다.
        return requestedQuantity; // 차감하려던 수량을 반환한다.
    }
}
```

`ProductNotFoundException`은 이전 REST 예외 처리와 같은 404 응답으로 변환한다. 조건부 UPDATE는 영향 행 수 0만으로 “상품 없음”과 “재고 부족”을 원자적으로 구분하지 못한다. 둘을 억지로 구분하려고 UPDATE 전 SELECT를 추가하면 그 읽기와 UPDATE 사이에 다시 경쟁 구간이 생긴다.

API 요구사항이 두 실패를 반드시 구분한다면 PostgreSQL의 `UPDATE ... RETURNING`, 저장 함수, 또는 별도의 일관된 조회·잠금 설계를 검토한다. DB 종속성과 반환 계약을 테스트하지 않고 단순 JPQL 예제에 끼워 넣지 않는다.

## 5. 방법 B: 조건부 UPDATE 한 문장으로 차감한다

핵심은 애플리케이션에서 다음처럼 “읽고 계산한 값”을 저장하지 않는 것이다.

```text
위험한 분리
SELECT stock → Java에서 stock - quantity → UPDATE stock = 계산값

조건부 원자 갱신
UPDATE ... SET stock = stock - quantity
WHERE stock >= quantity
```

DB는 UPDATE 과정에서 필요한 행 잠금을 사용하고, 동시에 같은 행을 바꾸는 트랜잭션이 있으면 완료 후 조건을 현재 행에 맞게 다시 판단한다. 두 요청이 재고 1에서 각각 1을 차감하더라도 한 요청만 조건을 만족해 영향 행 수 1을 얻고, 다른 요청은 0을 얻는다.

### 5.1 bulk UPDATE와 영속성 컨텍스트의 간격

JPQL bulk UPDATE는 Entity를 하나씩 불러 변경 감지하는 방식이 아니다. 이미 1차 캐시에 `stock = 10`인 Product가 있어도 DB는 바로 9가 될 수 있고, 메모리 Entity는 10인 채로 남을 수 있다.

예제의 `flushAutomatically = true`는 bulk 쿼리 전에 아직 DB로 보내지 않은 변경을 먼저 flush한다. `clearAutomatically = true`는 실행 뒤 영속성 컨텍스트를 비워 다음 조회가 DB에서 최신 값을 읽게 한다. clear는 관리 중인 모든 Entity를 detach할 수 있으므로, flush 없이 사용하면 다른 미반영 변경을 잃을 수 있다.

또한 Jakarta Persistence 명세의 bulk UPDATE는 자동 낙관적 잠금 검사를 우회한다. 그래서 예제 쿼리는 `version = version + 1`을 명시해 다른 `@Version` 기반 수정 경로가 오래된 상태를 성공시키지 않게 한다. 그렇더라도 이 bulk 쿼리 자체는 “요청이 읽었던 version”을 비교하지 않으므로, 사용자 편집 API와 같은 계약은 아니다.

### 5.2 단순한 불변 조건일수록 잘 맞는다

조건부 UPDATE가 잘 맞는 예는 다음과 같다.

- 재고가 요청 수량 이상일 때 차감한다.
- 사용 횟수가 한도보다 작을 때 1 증가시킨다.
- 상태가 `READY`일 때만 `RUNNING`으로 바꾼다.

여러 Entity의 복잡한 규칙, 외부 시스템 결과, 긴 계산을 한 WHERE에 억지로 넣으면 읽기와 유지보수가 어려워진다. 이때는 잠금 순서를 정한 짧은 비관적 트랜잭션이나 더 큰 업무 모델을 검토한다.

## 6. 잠금 대기·timeout·교착을 운영 관점에서 본다

### 6.1 대기는 실패가 아니지만 무한 대기도 성공 전략이 아니다

잠금 A가 끝나면 B가 진행할 수 있으므로 짧은 대기는 정상 동작일 수 있다. 하지만 PostgreSQL은 별도 제한이 없으면 충돌 잠금을 오래 기다릴 수 있다. HTTP 요청 timeout보다 DB 대기가 길면 클라이언트 연결은 끊겼는데 서버 작업은 계속되는 불일치가 생길 수 있다.

JPA의 `jakarta.persistence.lock.timeout` hint가 있지만 명세도 DB와 제공자에 따라 관찰되지 않을 수 있다고 경고한다. Spring 트랜잭션 timeout은 전체 트랜잭션 범위이고 DB의 lock timeout과 완전히 같은 기능이 아니다. PostgreSQL `lock_timeout`도 세션·트랜잭션 설정 범위를 이해하고 적용한다.

timeout 숫자는 복사해 정하지 않는다. 평소 트랜잭션 시간, HTTP timeout, 커넥션 풀 점유, 재시도 상한과 함께 정하고 잠금 대기 지표를 관찰한다.

### 6.2 교착은 DB가 한 트랜잭션을 중단해 푼다

```text
트랜잭션 A: 상품 1 잠금 → 상품 2 잠금 대기
트랜잭션 B: 상품 2 잠금 → 상품 1 잠금 대기
```

둘 다 상대 잠금을 기다리면 deadlock이다. PostgreSQL은 교착을 감지하면 참여 트랜잭션 중 하나를 중단하지만 어떤 트랜잭션이 희생될지 애플리케이션이 기대해서는 안 된다.

여러 상품을 잠글 때 모든 코드 경로가 상품 ID 오름차순처럼 **같은 순서**로 잠그면 교착 가능성을 줄일 수 있다. 트랜잭션을 짧게 하고 처음부터 필요한 잠금 강도를 얻는 것도 중요하다. 교착 실패를 재시도한다면 전체 업무 트랜잭션을 새로 시작하고 중복 부작용이 없음을 보장해야 한다.

### 6.3 `NOWAIT`와 `SKIP LOCKED`는 서로 다른 의도다

PostgreSQL `NOWAIT`는 행을 바로 잠글 수 없으면 대기하지 않고 오류를 낸다. `SKIP LOCKED`는 잠긴 행을 결과에서 건너뛴다.

`SKIP LOCKED`는 여러 worker가 대기열 항목을 나눠 가져가는 데 유용하지만 일관되지 않은 목록을 보여 줄 수 있다. 재고 상품 조회에 쓰면 “상품이 존재하지만 다른 요청이 잠갔음”을 “상품이 없음”으로 오해할 수 있으므로 일반 조회 해결책으로 사용하지 않는다.

## 7. PostgreSQL 두 세션에서 잠금 대기를 관찰한다

아래는 로컬 학습 DB의 `products` 테이블에 ID 1이 있다는 전제다. 운영 DB에서 실행하지 않는다. psql 창 두 개를 열고 세션 A의 commit 전후로 세션 B가 어떻게 달라지는지 관찰한다.

### 7.1 세션 A: 잠금을 보유한다

```sql
BEGIN; -- 잠금 수명을 확인하기 위해 명시적 트랜잭션을 시작한다.

SELECT id, stock -- 현재 재고를 함께 확인한다.
FROM products -- 학습용 상품 테이블을 읽는다.
WHERE id = 1 -- 한 상품 행만 대상으로 한다.
FOR UPDATE; -- 트랜잭션 종료까지 충돌하는 writer·locker를 기다리게 한다.

UPDATE products -- 잠근 행의 재고를 변경한다.
SET stock = stock - 1 -- DB의 현재 값에서 1을 차감한다.
WHERE id = 1 -- 방금 잠근 같은 상품이다.
  AND stock >= 1; -- 음수 방지 조건도 유지한다.

-- 세션 B가 잠금 조회를 실행할 때까지 commit하지 않는다.
```

### 7.2 세션 B: 제한된 시간만 기다린다

```sql
BEGIN; -- SET LOCAL과 조회를 같은 트랜잭션에 둔다.

SET LOCAL lock_timeout = '2s'; -- 이 트랜잭션의 잠금 획득 대기를 2초로 제한한다.

SELECT id, stock -- 세션 A와 같은 행을 읽으려 한다.
FROM products -- 같은 학습용 테이블이다.
WHERE id = 1 -- 같은 상품이므로 A의 잠금과 충돌한다.
FOR UPDATE; -- A가 끝나지 않으면 기다리다가 timeout 오류가 예상된다.

ROLLBACK; -- 오류가 난 트랜잭션을 종료한다.
```

세션 B의 timeout 뒤 세션 A에서 `COMMIT;`하면 A의 변경과 잠금 해제가 함께 일어난다. 그 다음 B에서 새 트랜잭션을 시작하면 갱신된 재고를 읽을 수 있다. 관찰이 끝나면 두 세션 모두 열린 트랜잭션이 없는지 확인한다.

`lock_timeout`은 잠금 획득 대기만 제한한다. 모든 SQL 실행 시간 제한인 `statement_timeout`이나 유휴 트랜잭션 제한과 같은 값으로 취급하지 않는다. 전역 설정을 무작정 바꾸지 않고 실습처럼 범위를 제한한다.

## 8. 여러 스레드의 조건부 차감을 검증한다

다음 통합 테스트는 초기 재고 5에 10개 요청을 동시에 시작한다. 성공은 정확히 5개, 최종 재고는 0이어야 한다. Service 프록시를 각 worker가 호출하므로 호출마다 독립된 트랜잭션과 DB 커넥션이 필요하다.

```java
package com.example.stockstudy.product; // 운영 코드와 같은 패키지 구조의 테스트다.

import static org.assertj.core.api.Assertions.assertThat; // 성공 수와 최종 재고를 검증한다.

import java.util.ArrayList; // Future 목록을 순서대로 모은다.
import java.util.List; // 작업 결과 목록 타입이다.
import java.util.concurrent.CountDownLatch; // worker 시작 시점을 맞춘다.
import java.util.concurrent.ExecutorService; // 여러 스레드에서 Service를 호출한다.
import java.util.concurrent.Executors; // 고정 크기 thread pool을 만든다.
import java.util.concurrent.Future; // 비동기 성공 여부를 회수한다.

import org.junit.jupiter.api.Test; // JUnit 테스트 메서드를 표시한다.
import org.springframework.beans.factory.annotation.Autowired; // 테스트 생성자에 Bean을 주입한다.
import org.springframework.boot.test.context.SpringBootTest; // 실제 Repository와 트랜잭션 프록시를 구성한다.

@SpringBootTest // 단위 대역이 아닌 JPA 통합 경로를 사용한다.
class AtomicStockDecreaseIntegrationTest {

    private final ProductRepository productRepository; // 준비·최종 확인에 사용할 Repository다.
    private final StockService stockService; // worker가 호출할 트랜잭션 Service 프록시다.

    @Autowired // Spring이 생성자 매개변수를 주입한다.
    AtomicStockDecreaseIntegrationTest(
            ProductRepository productRepository,
            StockService stockService
    ) {
        this.productRepository = productRepository; // Repository를 보관한다.
        this.stockService = stockService; // Service 프록시를 보관한다.
    }

    @Test // 재고보다 많은 동시 요청에서도 성공 수와 재고 불변 조건을 확인한다.
    void onlyAvailableQuantityCanSucceed() throws Exception {
        Product saved = productRepository.saveAndFlush(new Product("한정판", 5)); // 초기 재고 5를 commit 가능한 상태로 만든다.
        Long productId = saved.getId(); // 모든 worker가 같은 상품을 사용한다.
        Long initialVersion = saved.getVersion(); // 조건부 UPDATE의 version 증가도 확인한다.

        int attempts = 10; // 재고보다 많은 차감 요청 수다.
        CountDownLatch ready = new CountDownLatch(attempts); // 모든 worker가 준비될 때까지 센다.
        CountDownLatch start = new CountDownLatch(1); // 한 번에 출발시키는 문이다.
        ExecutorService executor = Executors.newFixedThreadPool(attempts); // 대기 worker 없이 10개를 준비한다.
        List<Future<Boolean>> results = new ArrayList<>(); // 각 요청의 업무 성공 여부를 모은다.

        try { // thread pool을 반드시 종료하기 위한 범위다.
            for (int index = 0; index < attempts; index++) { // 10개의 같은 차감 요청을 등록한다.
                results.add(executor.submit(() -> { // 각 작업은 별도 worker thread에서 실행된다.
                    ready.countDown(); // 이 worker가 시작 대기 지점에 도착했음을 알린다.
                    start.await(); // 모든 worker가 준비될 때까지 차감 호출을 미룬다.
                    try { // 재고 부족은 예상 가능한 업무 실패다.
                        stockService.decreaseAtomically(productId, 1); // 독립 트랜잭션으로 한 개 차감한다.
                        return true; // UPDATE 영향 행 수가 1이면 성공이다.
                    } catch (StockUnavailableException exception) { // 재고가 소진된 뒤의 요청이다.
                        return false; // 테스트에서는 예상 실패로 집계한다.
                    }
                }));
            }

            ready.await(); // 모든 worker가 start 문 앞에 도착할 때까지 기다린다.
            start.countDown(); // worker 10개를 가능한 한 비슷한 시점에 출발시킨다.

            long successCount = 0; // 실제 성공한 주문 수를 센다.
            for (Future<Boolean> result : results) { // 모든 비동기 작업의 결과를 회수한다.
                if (result.get()) { // 예상하지 못한 예외는 get에서 테스트 실패로 드러난다.
                    successCount++; // 성공 결과만 증가시킨다.
                }
            }

            Product current = productRepository.findById(productId).orElseThrow(); // worker commit 뒤 DB 값을 다시 읽는다.
            assertThat(successCount).isEqualTo(5); // 가진 재고만큼만 성공해야 한다.
            assertThat(current.getStock()).isZero(); // 최종 재고는 음수가 아니라 정확히 0이다.
            assertThat(current.getVersion()).isEqualTo(initialVersion + 5); // 성공한 UPDATE마다 version이 한 번 증가한다.
        } finally {
            executor.shutdownNow(); // 성공·실패와 관계없이 worker thread를 정리한다.
        }
    }
}
```

테스트 메서드에 `@Transactional`을 붙이지 않는다. 부모 테스트 트랜잭션의 미commit 데이터는 worker 커넥션에서 보이지 않을 수 있고, worker의 독립 트랜잭션과 격리되지도 않는다. 초기 데이터가 실제로 commit되는지는 테스트 구성에 따라 `TransactionTemplate`이나 별도 준비 Service로 명확히 만들 필요가 있다.

위 코드는 동시 시작 가능성을 높이지만 운영 부하 시험은 아니다. thread 수만큼 DB 커넥션이 필요하므로 테스트 풀 크기도 확인한다. H2의 잠금 구현만으로 PostgreSQL 동작을 보장하지 말고, PostgreSQL Testcontainers 또는 전용 통합 환경에서 같은 성공 수·최종 재고·예외 유형을 다시 검증한다.

## 9. 실패를 HTTP와 재시도 정책으로 연결한다

| 실패 | 의미 | 응답·처리 후보 |
| --- | --- | --- |
| 수량이 0 이하 | 요청 형식·값 오류 | 400 Bad Request |
| 영향 행 수 0 또는 잠근 뒤 재고 부족 | 현재 상태로 주문 불가 | 409 Conflict |
| 상품 없음 | 대상 자원 없음 | 404 Not Found, 단 원자 UPDATE만으로는 부족과 구분 안 됨 |
| 잠금 timeout·교착 희생 | 일시적 동시성 실패 가능 | 제한된 전체 트랜잭션 재시도 또는 503 등 명시적 정책 |

교착·잠금 timeout을 잡아 같은 트랜잭션 안에서 일부 SQL만 다시 실행하지 않는다. 이미 rollback 대상으로 표시되었을 수 있고 앞에서 읽은 상태도 오래되었다. 새 트랜잭션에서 업무 조건을 처음부터 다시 검사한다.

재시도 전에 **멱등성**도 필요하다. 클라이언트가 응답을 받지 못해 주문 요청 전체를 다시 보내면 재고 차감은 한 번 더 성공할 수 있다. DB 동시성 제어는 같은 요청의 중복 전달을 자동으로 식별하지 않는다.

자동 재시도는 횟수·시간에 상한을 두고 backoff와 jitter를 적용하며, 교착·직렬화 실패처럼 재실행 가능한 원인만 분류한다. 재고 부족이라는 확정된 업무 실패를 재시도해 DB 부하를 늘리지 않는다.

## 10. 선택 기준과 운영 체크리스트

### 10.1 어떤 방법부터 검토할까?

- 한 행의 숫자·상태를 단순 조건으로 바꾸면 조건부 UPDATE를 먼저 검토한다.
- 여러 컬럼·Entity를 읽어 복잡한 규칙을 판단해야 하고 충돌이 잦다면 짧은 비관적 잠금을 검토한다.
- 충돌이 드물고 사용자가 내용을 편집한다면 이전 노트의 낙관적 잠금이 자연스럽다.
- 어떤 방법이든 DB 제약, 영향 행 수, timeout, 실패 응답과 중복 요청 정책까지 함께 설계한다.

### 10.2 배포 전 확인

- [ ] 차감 수량이 양수인지 API와 Service 경계에서 검증하는가?
- [ ] DB에 `stock >= 0` 같은 마지막 불변 조건이 있는가?
- [ ] 비관적 잠금 조회와 변경이 같은 짧은 트랜잭션에 있는가?
- [ ] 잠금을 보유한 채 외부 API나 사용자 입력을 기다리지 않는가?
- [ ] 여러 행을 잠글 때 모든 경로가 같은 순서를 사용하는가?
- [ ] 잠금 대기와 전체 요청 timeout의 관계를 정했는가?
- [ ] 조건부 UPDATE의 반환 행 수를 반드시 확인하는가?
- [ ] bulk UPDATE 전후의 flush·clear 범위를 이해하는가?
- [ ] `@Version`을 사용하는 다른 수정 경로와 version 증가 규칙이 맞는가?
- [ ] 재시도는 새 트랜잭션 전체를 대상으로 하며 상한이 있는가?
- [ ] 중복 HTTP 요청을 식별하는 멱등성 정책이 별도로 있는가?
- [ ] 운영 DB 엔진에서 동시 요청과 실패 경로를 검증했는가?

## 11. 핵심 정리와 다음 학습

1. Java의 조회 후 조건 검사는 그 자체로 다른 트랜잭션의 개입을 막지 못한다.
2. 비관적 쓰기 잠금은 행을 먼저 잠그고 최신 상태에서 복잡한 규칙을 판단하게 한다.
3. 잠금 수명은 Service의 DB 트랜잭션 수명과 연결되므로 트랜잭션을 짧게 유지한다.
4. 조건부 UPDATE는 업무 조건·계산을 한 SQL에 넣고 영향 행 수로 성공을 판단한다.
5. JPQL bulk UPDATE는 영속성 컨텍스트와 자동 `@Version` 처리를 우회하므로 flush·clear·version 증가를 검토한다.
6. 행 잠금은 일반 SELECT를 모두 멈추는 테이블 전체 잠금과 같지 않다.
7. 여러 행은 일관된 순서로 잠그고 timeout·교착 실패는 새 트랜잭션 전체의 제한된 재시도로 다룬다.
8. DB 잠금과 원자 UPDATE는 중복 HTTP 요청을 식별하지 않으므로 멱등성은 별도 문제다.

🧠 기억할 것: **잠금은 읽고 판단하는 구간을 보호하고, 조건부 UPDATE는 판단을 쓰기 한 문장에 넣는다. 업무 규칙이 어디에 있어야 가장 작고 원자적인지부터 선택한다.**

다음 확장 주제는 **멱등성 키와 중복 요청 방지**다. timeout 뒤 같은 주문 요청이 다시 도착해도 결제·재고 차감·주문 생성이 한 번만 반영되도록 요청 식별자, 저장 상태와 응답 재사용을 설계한다.

## 12. 복습 퀴즈

1. `@Transactional` 안에서 stock을 읽고 감소시키기만 하면 초과 판매가 항상 방지되는가?
2. PostgreSQL의 `SELECT ... FOR UPDATE`가 같은 행의 일반 SELECT도 모두 막는가?
3. 잠금 Repository 메서드가 반환되면 행 잠금도 바로 풀리는가?
4. 조건부 UPDATE의 영향 행 수가 0일 때 무엇을 확실히 알 수 있고 무엇은 구분하기 어려운가?
5. JPQL bulk UPDATE 뒤 이미 로드한 Product Entity가 오래된 값을 가질 수 있는 이유는 무엇인가?
6. 여러 상품을 잠글 때 ID 순서를 통일하는 이유는 무엇인가?
7. DB 차감이 동시 요청에 안전해도 같은 HTTP 요청의 재전송으로 두 번 차감될 수 있는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 아니다. 별도 잠금·version 검사·조건부 UPDATE가 없다면 두 트랜잭션이 같은 재고를 읽고 각각 성공할 수 있다.
2. 아니다. 행 수준 `FOR UPDATE`는 같은 행의 writer와 호환되지 않는 locker를 주로 막으며 일반적인 잠금 없는 SELECT는 계속 가능하다.
3. 아니다. 같은 DB 트랜잭션이 commit 또는 rollback될 때까지 유지되는 것이 기본이다.
4. 차감 조건을 만족한 행이 없다는 것은 알 수 있다. 상품 부재와 재고 부족은 추가 계약 없이 한 UPDATE의 0만으로 구분하기 어렵다.
5. bulk UPDATE는 관리 Entity를 하나씩 변경하지 않고 DB를 직접 수정하므로 1차 캐시가 자동으로 최신 값이 되지 않기 때문이다.
6. A가 1→2, B가 2→1 순서로 잡으면 서로 기다리는 교착이 생길 수 있다. 모든 경로가 같은 순서를 쓰면 순환 대기를 줄인다.
7. DB는 두 호출이 같은 사용자 요청의 재전송인지 모른다. 요청 식별자와 결과 저장 같은 멱등성 계약이 별도로 필요하다.

</details>

## 13. 공식 문서로 이어서 읽기

- [Jakarta Persistence 3.2 — Locking and Concurrency](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2): 비관적 잠금 모드·예외·timeout hint
- [Spring Data JPA — Locking](https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html): Repository `@Lock` 선언
- [Spring Data JPA — Modifying Queries](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html#jpa.modifying-queries): bulk 수정과 영속성 컨텍스트 clear
- [Spring Data JPA — Modifying API](https://docs.spring.io/spring-data/data-jpa/reference/api/java/org/springframework/data/jpa/repository/Modifying.html): flushAutomatically·clearAutomatically
- [PostgreSQL 17 — Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html): 행 잠금 충돌·해제·교착
- [PostgreSQL 17 — SELECT Locking Clause](https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE): NOWAIT·SKIP LOCKED
- [PostgreSQL 17 — UPDATE](https://www.postgresql.org/docs/17/sql-update.html): 조건부 수정·RETURNING과 batch update
- [PostgreSQL 17 — Client Connection Defaults](https://www.postgresql.org/docs/17/runtime-config-client.html): lock_timeout·statement_timeout 범위
- [Spring Framework — CannotAcquireLockException](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/dao/CannotAcquireLockException.html): Spring 잠금 획득 실패 예외
- [Spring Framework — Transaction Propagation](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html): 물리·논리 트랜잭션과 rollback 경계

다음 학습: [멱등성 키와 중복 요청 방지](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md)에서 timeout 뒤 재전송된 주문을 한 번만 처리하는 요청 계약으로 이어 간다.
