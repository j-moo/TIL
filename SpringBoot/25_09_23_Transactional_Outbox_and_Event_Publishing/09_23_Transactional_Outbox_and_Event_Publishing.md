# Transactional Outbox: DB 변경과 이벤트 발행을 함께 안전하게 다루기

- 🎯 글의 목표: 주문 DB 저장과 메시지 브로커 발행 사이의 실패를 이해하고, outbox·relay·consumer 멱등 처리로 이벤트 전달을 복구 가능하게 만든다.
- 🧩 핵심 키워드: Transactional Outbox, Dual Write, Relay, Polling Publisher, CDC, Lease, At-least-once, Inbox, Idempotent Consumer, Event Ordering
- ⭐ 중요도: ★★★★★ — DB에는 주문이 저장됐는데 알림 이벤트가 사라지거나, DB 작업은 취소됐는데 이벤트가 먼저 전달되는 불일치를 막는 기본 패턴이다.
- 📝 한눈에 보는 내용: 업무 데이터와 outbox 행을 같은 DB 트랜잭션에 넣고, 별도 relay가 커밋된 행을 브로커로 보낸다. 발행 재시도로 생기는 중복은 이벤트 ID와 consumer inbox로 흡수한다.
- 🧱 선수 지식: Spring `@Transactional`, JPA 저장·flush, 메시지 큐의 비동기 전달, [멱등성 키와 중복 요청 방지](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md)
- 🔗 이전 노트: [멱등성 키와 중복 요청 방지](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md)

> 정리 기준일: 2026-09-23. Spring 트랜잭션 경계와 PostgreSQL 17을 중심으로 설명하는 교육용 예제다. 메시지 broker는 특정 제품에 종속되지 않도록 `EventPublisher` 인터페이스로 표현한다. 코드 조각은 저장소의 실행 애플리케이션에 연결된 통합 구현이 아니며, 이 노트에서는 Java·DB·broker 통합 테스트를 실행하지 않았다.

## 1. 주문은 저장됐는데 알림은 왜 사라질까?

주문을 만들고 결제 서비스에 `OrderCreated` 이벤트를 보내는 API를 생각해 보자.

```text
요청 → 주문 INSERT → DB commit → 브로커에 OrderCreated 발행 → 결제 서비스
```

DB와 메시지 브로커는 서로 다른 시스템이다. Spring의 일반적인 `@Transactional`은 애플리케이션이 연결한 DB 트랜잭션을 제어하지만, 브로커까지 같은 원자적 트랜잭션으로 묶어 주지는 않는다. 그래서 두 작업을 순서대로 호출하면 중간 장애가 남긴 빈틈이 생긴다.

| 실행 순서 | 장애 지점 | 남는 결과 |
| --- | --- | --- |
| DB commit → broker publish | commit 뒤 프로세스 종료 또는 broker 오류 | 주문은 있지만 이벤트가 없어 후속 서비스가 모른다 |
| broker publish → DB commit | 이벤트 전송 뒤 DB 오류·rollback | 후속 서비스는 존재하지 않는 주문을 처리할 수 있다 |
| DB commit → publish 성공 → 성공 응답 유실 | relay가 성공 여부를 저장하기 전에 종료 | 재시도 시 같은 이벤트를 다시 보낼 수 있다 |

두 시스템에 각각 쓰는 작업을 흔히 **dual write**라고 부른다. 두 호출을 한 메서드에 썼다는 사실은 두 자원이 원자적으로 commit된다는 뜻이 아니다.

## 2. Transactional Outbox가 보장하는 것

Transactional Outbox는 이벤트를 곧바로 브로커에 보내는 대신, 같은 서비스 DB의 `outbox_event` 테이블에 기록한다.

```text
요청 트랜잭션
  ├─ orders 테이블에 주문 저장
  └─ outbox_event 테이블에 OrderCreated 저장
       └─ 같은 DB transaction으로 commit 또는 rollback

별도 relay
  └─ commit된 outbox_event를 읽어 broker에 발행

consumer
  └─ event_id 중복을 확인하고 업무 처리를 한 번만 반영
```

주문 저장과 outbox 저장은 같은 DB 연결·트랜잭션에 참여하므로 둘 중 하나만 commit되는 상황을 막을 수 있다. 반면 broker 발행은 이후의 별도 작업이다. outbox는 **커밋된 이벤트의 발행 시도를 잃지 않도록 저장**하지만, broker나 consumer에서 중복이 절대 발생하지 않는다고 보장하지 않는다.

AWS Prescriptive Guidance도 outbox 행과 업무 데이터를 같은 transaction에 쓰는 흐름, duplicate message 가능성, consumer 멱등성 및 이벤트 순서를 핵심 고려사항으로 든다. 제품별 전달 의미는 사용하는 broker의 설정과 acknowledgement 정책으로 별도 확인해야 한다.

## 3. Spring의 `AFTER_COMMIT` listener만으로 충분할까?

Spring의 `@TransactionalEventListener`는 기본으로 `AFTER_COMMIT` 단계에 연결할 수 있다. rollback된 주문 이벤트를 보내지 않게 하는 데 유용하다.

```java
@Component // Spring이 이벤트 listener를 Bean으로 등록한다.
public class OrderEventListener {

    @TransactionalEventListener // 기본 단계인 AFTER_COMMIT에서 호출한다.
    public void on(OrderCreated event) { // commit된 주문 이벤트를 전달받는다.
        publisher.publish(event); // 이 시점에 broker 전송을 시도한다.
    }
}
```

그러나 DB commit이 끝난 직후 listener가 실행되기 전에 프로세스가 종료되면, 재시작 뒤 복구할 영속 이벤트가 없다. `AFTER_COMMIT`은 실행 시점을 transaction 결과에 맞춰 줄 뿐, listener 작업을 별도 DB에 저장하거나 재시작 후 이어 주는 durable queue는 아니다. **이 점은 Spring 문서의 listener 동작 시점과 outbox의 영속 저장 방식을 연결한 설계상 결론**이다.

`@TransactionalEventListener`는 outbox 행을 빠르게 relay에 알리는 보조 신호로 사용할 수 있다. 알림 신호가 사라져도 relay가 DB의 미발행 행을 주기적으로 찾도록 해야 영속 기록이 복구 기준으로 남는다.

## 4. 이벤트 계약부터 만든다

이벤트는 현재 Entity를 통째로 직렬화한 내부 객체가 아니다. 다른 서비스가 별도 배포 주기와 언어로 읽을 수 있는 **외부 데이터 계약**이다.

| 필드 | 예시 | 목적 |
| --- | --- | --- |
| `eventId` | UUID | 중복 전달 식별, consumer inbox 키 |
| `aggregateType` | `Order` | 이벤트가 속한 업무 종류 |
| `aggregateId` | `order-812` | 같은 aggregate의 이벤트를 묶고 partition key로 사용 |
| `aggregateVersion` | `1` | 같은 주문 변경의 논리 순서 감지 |
| `eventType` | `OrderCreated` | payload 해석과 handler 선택 |
| `schemaVersion` | `1` | payload 형식 진화 구분 |
| `occurredAt` | UTC timestamp | 업무 이벤트 발생 시각 |
| `payload` | 주문 ID·금액·통화 | 소비자가 필요한 안정된 데이터 |

예시 envelope는 다음과 같다.

```json
{
  "eventId": "f178b740-87dc-46c0-8ab0-c716629e1c55",
  "aggregateType": "Order",
  "aggregateId": "812",
  "aggregateVersion": 1,
  "eventType": "OrderCreated",
  "schemaVersion": 1,
  "occurredAt": "2026-09-23T03:15:30Z",
  "payload": {
    "orderId": 812,
    "customerId": 42,
    "totalAmount": 15800,
    "currency": "KRW"
  }
}
```

이벤트 payload에는 소비자가 처리할 때 필요한 당시의 값을 넣는다. relay가 발행할 때 현재 `orders` 행을 다시 조회해 내용을 조립하면, 주문이 변경된 뒤 과거 `OrderCreated`가 최신 값으로 바뀌어 전달될 수 있다. 이벤트 발생 순간의 사실을 담는 snapshot과 소비자가 다시 조회하도록 전달하는 notification 중 어떤 계약인지 분명히 정한다.

금액은 부동소수점보다 최소 화폐 단위의 정수와 통화 코드를 조합하는 식으로 표현할 수 있다. 개인정보와 결제 비밀값을 payload, broker header, 로그에 불필요하게 복제하지 않는다.

## 5. Outbox 테이블을 추가한다

아래 Flyway migration은 Polling Publisher 예제의 PostgreSQL 스키마다. 실제 서비스는 기존 Flyway 버전 번호와 충돌하지 않도록 다음 사용 가능한 버전으로 이름을 정한다.

```sql
CREATE TABLE outbox_event ( -- 업무 transaction과 함께 저장할 이벤트 행이다.
    id UUID PRIMARY KEY, -- 전역에서 구분하고 consumer 중복 제거에 쓸 event ID다.
    aggregate_type VARCHAR(80) NOT NULL, -- Order 같은 aggregate 이름이다.
    aggregate_id VARCHAR(120) NOT NULL, -- 주문 ID 등 aggregate의 식별자다.
    aggregate_version BIGINT NOT NULL, -- aggregate 안의 논리 순서다.
    event_type VARCHAR(120) NOT NULL, -- OrderCreated 같은 계약 이름이다.
    schema_version INTEGER NOT NULL, -- payload 구조 버전이다.
    payload_json TEXT NOT NULL, -- 생성 시점에 직렬화한 JSON 문서다.
    occurred_at TIMESTAMPTZ NOT NULL, -- 이벤트가 만들어진 UTC 시각이다.
    status VARCHAR(20) NOT NULL DEFAULT 'NEW', -- 발행 대기·lease·완료·수동 복구 상태다.
    attempt_count INTEGER NOT NULL DEFAULT 0, -- relay가 claim한 횟수다.
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 다음 발행 시도 시각이다.
    claim_token UUID, -- 현재 relay 실행자의 claim 소유권 표시다.
    lease_until TIMESTAMPTZ, -- worker가 비정상 종료된 뒤 재claim할 수 있는 시각이다.
    published_at TIMESTAMPTZ, -- broker 확인 뒤 발행 완료로 기록한 시각이다.
    last_error VARCHAR(1000), -- 재시도 진단용 제한된 오류 정보다.
    CONSTRAINT ck_outbox_status CHECK ( -- 허용한 상태만 저장한다.
        status IN ('NEW', 'IN_PROGRESS', 'PUBLISHED', 'FAILED') -- 상태 문자열을 제한한다.
    ), -- 상태 check 제약을 끝낸다.
    CONSTRAINT ck_outbox_attempt_count CHECK (attempt_count >= 0), -- 음수 재시도 수를 막는다.
    CONSTRAINT ck_outbox_lease CHECK ( -- claim 상태와 lease 상태를 맞춘다.
        (status = 'IN_PROGRESS' AND claim_token IS NOT NULL AND lease_until IS NOT NULL) -- 처리 중이면 소유권과 기한이 필요하다.
        OR (status <> 'IN_PROGRESS' AND claim_token IS NULL AND lease_until IS NULL) -- 나머지 상태는 claim을 비운다.
    ), -- lease check 제약을 끝낸다.
    CONSTRAINT ck_outbox_published CHECK ( -- 발행 완료 상태에 시각을 요구한다.
        (status = 'PUBLISHED' AND published_at IS NOT NULL) -- 완료 행은 published_at을 가진다.
        OR (status <> 'PUBLISHED' AND published_at IS NULL) -- 미완료 행은 published_at이 없다.
    ), -- published 시각 check 제약을 끝낸다.
    CONSTRAINT uq_outbox_aggregate_version UNIQUE ( -- 이 예제는 aggregate version당 이벤트 하나를 가정한다.
        aggregate_type, aggregate_id, aggregate_version -- 같은 논리 이벤트의 중복 생성을 방지한다.
    ) -- unique 제약을 끝낸다.
); -- outbox_event 테이블을 만든다.

CREATE INDEX ix_outbox_ready -- poller가 대기 행을 빠르게 찾도록 한다.
    ON outbox_event (next_attempt_at, occurred_at, id) -- 재시도 시각과 안정적인 tie-breaker를 사용한다.
    WHERE status = 'NEW'; -- 신규 대기 행만 인덱스에 둔다.

CREATE INDEX ix_outbox_expired_lease -- 장애 난 relay의 lease 만료 행을 찾는다.
    ON outbox_event (lease_until, occurred_at, id) -- 만료 시각 순으로 탐색한다.
    WHERE status = 'IN_PROGRESS'; -- 처리 중 행만 인덱스에 둔다.
```

이 예제의 unique 제약은 **aggregate version 하나에 이벤트 하나**라는 전제를 둔다. 한 주문 변경에서 여러 이벤트를 만들면 `aggregate_event_sequence`를 추가해 복합 unique 범위를 조정한다. 버전은 동시 update가 실제로 순서를 보장하는 방식으로 발급되어야 하며, 애플리케이션 wall clock 시간만으로 순서를 추측하지 않는다.

발행 완료 행은 감사·재처리·장애 분석에 필요한 보관 기간 뒤 정리한다. 재시도 중인 행을 만료 기준만으로 삭제하면 장애가 복구되어도 이벤트를 다시 찾을 수 없다.

## 6. 업무 데이터와 이벤트를 한 transaction에 넣는다

간단한 주문 생성 코드에서는 주문과 outbox를 같은 Spring transaction 안에서 저장한다. 여기서는 DB transaction 중 broker에 접속하지 않는다.

```java
package com.example.orderstudy.order; // 주문 애플리케이션 서비스의 패키지다.

import java.time.Clock; // 테스트에서 시계를 바꿀 수 있도록 주입한다.
import java.time.Instant; // UTC 기반 발생 시각을 저장한다.
import java.util.UUID; // 이벤트마다 안정된 고유 식별자를 만든다.

import org.springframework.stereotype.Service; // 서비스 클래스를 Spring Bean으로 등록한다.
import org.springframework.transaction.annotation.Transactional; // 주문과 outbox 저장을 한 DB transaction으로 묶는다.

@Service // Controller가 호출할 주문 서비스다.
public class OrderApplicationService {

    private final OrderRepository orderRepository; // 업무 주문을 저장한다.
    private final OutboxEventRepository outboxRepository; // 이벤트를 같은 DB에 저장한다.
    private final EventJsonCodec eventJsonCodec; // payload를 JSON으로 직렬화한다.
    private final Clock clock; // 현재 시각 공급자를 보관한다.

    public OrderApplicationService( // 필요한 의존성을 생성자에서 받는다.
            OrderRepository orderRepository, // 주문 저장소다.
            OutboxEventRepository outboxRepository, // outbox 저장소다.
            EventJsonCodec eventJsonCodec, // 직렬화기다.
            Clock clock // 주입된 시계다.
    ) { // 생성자 선언을 시작한다.
        this.orderRepository = orderRepository; // 주문 저장소를 필드에 둔다.
        this.outboxRepository = outboxRepository; // outbox 저장소를 필드에 둔다.
        this.eventJsonCodec = eventJsonCodec; // JSON codec을 필드에 둔다.
        this.clock = clock; // 시계를 필드에 둔다.
    } // 생성자를 끝낸다.

    @Transactional // 아래 DB 작업은 함께 commit되거나 모두 rollback된다.
    public CreateOrderResponse create(CreateOrderRequest request) { // 주문 생성 유스케이스를 실행한다.
        Instant occurredAt = clock.instant(); // 이벤트 발생 시각을 한 번 읽는다.
        Order order = orderRepository.save( // 주문 행을 영속화한다.
                Order.create(request.customerId(), request.totalAmount()) // 검증된 요청 값으로 주문을 만든다.
        ); // 주문 저장을 끝낸다.
        orderRepository.flush(); // DB가 생성한 식별자를 outbox payload에 쓸 수 있게 한다.

        UUID eventId = UUID.randomUUID(); // relay·consumer가 공유할 event ID를 만든다.
        OrderCreatedPayload payload = new OrderCreatedPayload( // 당시 주문의 외부 payload를 만든다.
                order.getId(), // 생성된 주문 식별자다.
                order.getCustomerId(), // 후속 서비스에서 필요한 고객 식별자다.
                order.getTotalAmount(), // 최소 화폐 단위로 저장한 주문 금액이다.
                "KRW" // 금액의 통화 코드다.
        ); // payload 생성이 끝난다.
        String payloadJson = eventJsonCodec.write(payload); // 현재 Entity가 아니라 event DTO를 직렬화한다.

        OutboxEvent event = OutboxEvent.newEvent( // NEW 상태인 outbox 행을 만든다.
                eventId, // 중복 제거에 사용할 이벤트 ID다.
        "Order", // aggregate 종류다.
        order.getId().toString(), // aggregate 식별자다.
        1L, // 새 주문에서 첫 이벤트의 aggregate version이다.
                "OrderCreated", // 소비자와 합의한 event type이다.
                1, // payload schema version이다.
                payloadJson, // 생성 시점의 JSON snapshot이다.
                occurredAt // 이벤트 발생 시각이다.
        ); // outbox 행 생성이 끝난다.
        outboxRepository.save(event); // 주문과 같은 transaction에 이벤트를 추가한다.

        return new CreateOrderResponse(order.getId(), "ACCEPTED"); // commit 후 API 응답으로 전달된다.
    } // 주문 유스케이스를 끝낸다.
} // 서비스 클래스를 끝낸다.
```

Spring의 proxy 기반 트랜잭션에서 실제 commit은 대상 메서드 본문이 반환된 뒤 proxy 경계에서 일어난다. 위 코드에서 주문 저장이 성공하고 outbox 직렬화·저장 중 예외가 발생하면 RuntimeException rollback 정책에 따라 주문도 rollback된다. Checked exception이나 사용자 지정 rollback 규칙을 쓰는 프로젝트는 앞선 트랜잭션 노트의 예외 정책을 함께 확인한다.

`flush()`는 SQL을 DB로 보낼 뿐 commit하지 않는다. 주문 INSERT와 outbox INSERT가 같은 transaction에 남아 있으므로 둘 중 하나가 실패하면 최종 commit도 함께 실패한다.

`OrderCreatedPayload`는 예를 들어 다음처럼 공개할 필드만 가진 record다.

```java
public record OrderCreatedPayload( // broker로 보낼 안정된 event payload다.
        Long orderId, // 주문을 다시 찾을 업무 식별자다.
        Long customerId, // 이 이벤트가 속한 고객 식별자다.
        long totalAmount, // 소수점 오차를 피하도록 최소 단위 정수로 표현한다.
        String currency // 금액 의미를 고정하는 통화 코드다.
) { // record 본문을 연다.
} // payload record를 끝낸다.
```

`OutboxEvent`는 주문 Entity와 같은 persistence unit·DataSource를 사용해야 같은 DB transaction에 참여한다. relay가 상태를 갱신하는 부분은 JDBC로 처리하므로 아래 Entity는 신규 이벤트 생성에 필요한 필드를 중심으로 둔다.

```java
package com.example.orderstudy.outbox; // outbox 영속 모델 패키지다.

import java.time.Instant; // 시각 컬럼을 UTC instant로 다룬다.
import java.util.UUID; // 이벤트 ID와 claim token 타입이다.

import jakarta.persistence.Column; // 컬럼 이름과 제약을 명시한다.
import jakarta.persistence.Entity; // JPA Entity임을 표시한다.
import jakarta.persistence.Id; // 앱에서 만든 UUID를 기본키로 사용한다.
import jakarta.persistence.Table; // 테이블 이름을 고정한다.

@Entity // 주문 transaction 안에서 INSERT할 outbox 행이다.
@Table(name = "outbox_event") // Flyway migration 테이블과 연결한다.
public class OutboxEvent {

    @Id // DB에 저장할 event ID다.
    private UUID id; // 생성 시점에 앱이 ID를 만들므로 DB 자동 생성이 없다.

    @Column(name = "aggregate_type", nullable = false, length = 80) // aggregate 종류다.
    private String aggregateType; // 예: Order다.

    @Column(name = "aggregate_id", nullable = false, length = 120) // aggregate 식별자다.
    private String aggregateId; // 예: 주문 ID의 문자열 표현이다.

    @Column(name = "aggregate_version", nullable = false) // aggregate 내부의 논리 순서다.
    private Long aggregateVersion; // 새 주문 생성 이벤트는 첫 version을 사용한다.

    @Column(name = "event_type", nullable = false, length = 120) // event 계약 이름이다.
    private String eventType; // 예: OrderCreated다.

    @Column(name = "schema_version", nullable = false) // payload 구조 버전이다.
    private Integer schemaVersion; // 소비자와 합의한 버전이다.

    @Column(name = "payload_json", nullable = false, columnDefinition = "text") // JSON 문서 문자열이다.
    private String payloadJson; // 앱 codec이 생성한 외부 계약 payload다.

    @Column(name = "occurred_at", nullable = false) // 이벤트 발생 시각 컬럼이다.
    private Instant occurredAt; // DB에는 PostgreSQL timestamptz로 저장한다.

    @Column(name = "status", nullable = false, length = 20) // relay 진행 상태다.
    private String status; // 신규 행은 NEW로 시작한다.

    @Column(name = "attempt_count", nullable = false) // relay claim 횟수다.
    private Integer attemptCount; // 신규 행은 0이다.

    @Column(name = "next_attempt_at", nullable = false) // 첫 시도는 즉시 가능하다.
    private Instant nextAttemptAt; // 기본값을 Java에서도 넣어 DB 제약과 맞춘다.

    @Column(name = "claim_token") // 미발행 신규 행은 아직 owner가 없다.
    private UUID claimToken; // relay가 claim할 때 JDBC로 기록한다.

    @Column(name = "lease_until") // 미발행 신규 행은 lease가 없다.
    private Instant leaseUntil; // claim 때 JDBC로 기록한다.

    @Column(name = "published_at") // 신규 행은 아직 broker 발행 전이다.
    private Instant publishedAt; // 발행 확인 때 JDBC로 기록한다.

    @Column(name = "last_error", length = 1000) // 운영 진단용 요약이다.
    private String lastError; // 신규 행은 오류가 없다.

    protected OutboxEvent() { // JPA가 DB 행을 읽어 객체를 만들 때 사용한다.
    } // 기본 생성자를 끝낸다.

    private OutboxEvent( // 신규 outbox 행의 모든 업무 필드를 받는다.
            UUID id, // event ID다.
            String aggregateType, // aggregate 종류다.
            String aggregateId, // aggregate 식별자다.
            Long aggregateVersion, // aggregate version이다.
            String eventType, // 이벤트 종류다.
            Integer schemaVersion, // payload schema version이다.
            String payloadJson, // 직렬화된 JSON이다.
            Instant occurredAt // 이벤트 발생 시각이다.
    ) { // 생성자 본문을 연다.
        this.id = id; // 고유 event ID를 저장한다.
        this.aggregateType = aggregateType; // aggregate 종류를 저장한다.
        this.aggregateId = aggregateId; // aggregate 식별자를 저장한다.
        this.aggregateVersion = aggregateVersion; // aggregate version을 저장한다.
        this.eventType = eventType; // event type을 저장한다.
        this.schemaVersion = schemaVersion; // schema version을 저장한다.
        this.payloadJson = payloadJson; // snapshot payload를 저장한다.
        this.occurredAt = occurredAt; // 생성 시각을 저장한다.
        this.status = "NEW"; // relay가 찾을 수 있도록 신규 상태로 시작한다.
        this.attemptCount = 0; // 아직 claim하지 않았음을 나타낸다.
        this.nextAttemptAt = occurredAt; // 첫 poll에서 즉시 선택될 수 있다.
    } // 생성자를 끝낸다.

    public static OutboxEvent newEvent( // 유효한 신규 row를 만들 factory method다.
            UUID id, // 이벤트 고유 ID다.
            String aggregateType, // aggregate 종류다.
            String aggregateId, // aggregate ID다.
            Long aggregateVersion, // aggregate 순서다.
            String eventType, // 이벤트 계약 이름이다.
            Integer schemaVersion, // payload schema 버전이다.
            String payloadJson, // 직렬화된 payload다.
            Instant occurredAt // 발생 시각이다.
    ) { // factory 본문을 연다.
        return new OutboxEvent( // 상태 초기화까지 수행한 객체를 반환한다.
                id, aggregateType, aggregateId, aggregateVersion, // aggregate 식별 정보다.
                eventType, schemaVersion, payloadJson, occurredAt // 외부 계약·payload·시각이다.
        ); // 객체 생성을 끝낸다.
    } // factory method를 끝낸다.
} // Entity를 끝낸다.
```

신규 이벤트 저장소는 일반적인 Spring Data JPA 저장소다.

```java
package com.example.orderstudy.outbox; // Repository의 패키지다.

import java.util.UUID; // 기본키 타입이다.

import org.springframework.data.jpa.repository.JpaRepository; // save·flush 등 기본 저장 동작을 제공한다.

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> { // outbox Entity 저장소다.
} // Repository 인터페이스를 끝낸다.
```

실제 `EventJsonCodec`은 애플리케이션의 `ObjectMapper`에 `writeValueAsString()`을 호출하고 직렬화 실패를 RuntimeException으로 감싸면 된다. JSON 계약의 필드명·nullable 여부·시간대·금액 단위를 소비자와 함께 버전 관리한다.

## 7. Polling Publisher는 행을 claim한 뒤 broker에 보낸다

### 7.1 오래 잡는 DB transaction을 피한다

가장 단순한 poller는 다음처럼 동작한다.

```text
BEGIN
  SELECT 미발행 행 FOR UPDATE SKIP LOCKED
  broker 전송
  published 표시
COMMIT
```

broker 응답을 기다리는 동안 DB transaction과 row lock을 오래 유지한다. broker 지연이 커지면 DB connection과 잠금이 쌓일 수 있다. 아래 학습 예제는 짧은 transaction으로 행을 **claim**하고 commit한 뒤 broker로 보낸다. claim에는 소유자를 나타내는 token과 lease 만료 시각을 저장한다.

### 7.2 여러 relay가 겹치지 않도록 batch를 claim한다

다음 PostgreSQL query는 만료되지 않은 미발행 행을 여러 relay가 나눠 갖도록 한다. `SKIP LOCKED`는 이미 다른 transaction이 잠근 후보 행을 기다리지 않고 건너뛰는 queue 소비 패턴에 적합하다. PostgreSQL 문서가 설명하듯 잠긴 행을 건너뛰는 결과는 일반 조회의 일관된 snapshot 용도와 다르며, queue-like table의 worker 분산에 맞춘 선택이다.

```sql
WITH candidates AS ( -- 이번 relay가 가져갈 후보 ID를 잠근다.
    SELECT id -- 실제 행 전체 대신 키만 고른다.
    FROM outbox_event -- 이벤트 대기 테이블이다.
    WHERE (status = 'NEW' AND next_attempt_at <= CURRENT_TIMESTAMP) -- 첫 시도 또는 재시도 시간이 된 행이다.
       OR (status = 'IN_PROGRESS' AND lease_until < CURRENT_TIMESTAMP) -- 이전 relay의 lease가 끝난 행이다.
    ORDER BY occurred_at, id -- batch 안에서 안정적인 우선 순서를 정한다.
    FOR UPDATE SKIP LOCKED -- 다른 worker의 lock은 기다리지 않고 넘긴다.
    LIMIT :batch_size -- 한 번에 처리할 최대 건수다.
) -- 후보 query를 끝낸다.
UPDATE outbox_event AS event -- 고른 행을 현재 worker 소유로 갱신한다.
SET status = 'IN_PROGRESS', -- 발행 중 상태로 바꾼다.
    claim_token = :claim_token, -- 이번 batch 소유자의 UUID를 기록한다.
    lease_until = CURRENT_TIMESTAMP + (:lease_seconds * INTERVAL '1 second'), -- worker가 죽었을 때 재claim될 시각이다.
    attempt_count = event.attempt_count + 1 -- claim 시도 횟수를 증가시킨다.
FROM candidates -- 잠근 후보에 대해서만 update한다.
WHERE event.id = candidates.id -- candidate와 실제 행을 연결한다.
RETURNING event.id, event.aggregate_type, event.aggregate_id, -- relay가 보낼 event 식별 정보를 반환한다.
          event.aggregate_version, event.event_type, event.schema_version, -- 계약과 순서 정보다.
          event.payload_json, event.occurred_at, event.claim_token; -- broker 메시지 구성에 필요한 값이다.
```

claim SQL만 실행하는 짧은 `@Transactional` 메서드가 반환된 뒤 transaction이 commit되게 한다. relay는 commit된 결과만 받아 broker 통신을 시작한다. claim query와 행을 읽어 오는 방식은 JdbcTemplate 또는 Spring Data JDBC로 구현하면 PostgreSQL의 `UPDATE ... RETURNING` 결과를 다루기 쉽다.

### 7.3 broker 발행은 transaction 밖에서 실행한다

아래는 relay의 경계를 보여 주는 코드 모양이다. 타입 정의와 broker별 구현은 생략했다. `OutboxClaimService`와 `OutboxStateService`는 각각 독립 transaction으로 claim·완료·재시도 상태를 바꾸고, `EventPublisher` 구현은 사용하는 broker client의 실제 ack 계약을 적용한다.

```java
package com.example.orderstudy.outbox; // relay adapter의 패키지다.

import java.time.Clock; // 테스트 가능한 현재 시각 공급자다.
import java.time.Duration; // lease와 backoff 기간 타입이다.
import java.util.List; // claim한 event batch 타입이다.
import java.util.UUID; // batch 소유권 token 타입이다.

import org.springframework.scheduling.annotation.Scheduled; // 주기 poll 메서드를 등록한다.
import org.springframework.stereotype.Component; // Spring Bean으로 등록한다.

@Component // 주기 실행을 담당하는 Spring Bean이다.
public class OutboxRelay {

    private final OutboxClaimService claimService; // 별도 transaction으로 batch를 소유한다.
    private final OutboxStateService stateService; // 발행 결과를 짧은 transaction으로 저장한다.
    private final EventPublisher publisher; // broker별 adapter를 감싼다.
    private final RetryDelay retryDelay; // 지수 backoff와 jitter를 계산한다.
    private final Clock clock; // 테스트 가능한 현재 시각 공급자다.

    public OutboxRelay( // 실행에 필요한 의존성을 받는다.
            OutboxClaimService claimService, // claim transaction 서비스다.
            OutboxStateService stateService, // 완료·재시도 transaction 서비스다.
            EventPublisher publisher, // 비동기 메시지 adapter다.
            RetryDelay retryDelay, // 재시도 정책이다.
            Clock clock // 시계다.
    ) { // 생성자를 시작한다.
        this.claimService = claimService; // claim service를 저장한다.
        this.stateService = stateService; // 상태 service를 저장한다.
        this.publisher = publisher; // publisher를 저장한다.
        this.retryDelay = retryDelay; // backoff 계산기를 저장한다.
        this.clock = clock; // 시계를 저장한다.
    } // 생성자를 끝낸다.

    @Scheduled(fixedDelayString = "${outbox.poll-delay-ms:500}") // 이전 회차가 끝난 뒤 설정된 간격으로 실행한다.
    public void publishBatch() { // 미발행 이벤트 batch를 전달한다.
        UUID claimToken = UUID.randomUUID(); // 이 batch 소유자를 구별한다.
        List<ClaimedOutboxEvent> batch = claimService.claim( // 짧은 DB transaction에서 행을 claim한다.
                claimToken, // 모든 행에 같은 worker token을 기록한다.
                50, // batch 크기는 부하와 지연을 보고 설정한다.
                Duration.ofSeconds(30) // broker 정상 응답 시간보다 충분한 lease를 준다.
        ); // claim transaction은 이 호출 반환 전에 종료된다.

        for (ClaimedOutboxEvent event : batch) { // 각 행을 개별 전송한다.
            publishOne(event, claimToken); // 한 건의 성공·실패를 분리 처리한다.
        } // batch 반복을 끝낸다.
    } // 주기 작업을 끝낸다.

    private void publishOne(ClaimedOutboxEvent event, UUID claimToken) { // 이벤트 한 건의 전달을 담당한다.
        try { // 전송과 ack 확인을 시도한다.
            publisher.publishAndAwaitAck(event); // broker가 설정한 확인 의미까지 기다린다.
            stateService.markPublished(event.id(), claimToken, clock.instant()); // token 소유권이 유효할 때만 완료 처리한다.
        } catch (RuntimeException failure) { // 전송 실패 또는 ack 확인 실패를 받는다.
            Duration delay = retryDelay.forAttempt(event.attemptCount()); // 시도 횟수에 맞춰 다음 간격을 계산한다.
            stateService.scheduleRetry( // 다음 시각을 저장하고 현재 lease를 해제한다.
                    event.id(), // 실패한 event row ID다.
                    claimToken, // 오래된 worker가 다른 worker 상태를 덮지 않게 한다.
                    clock.instant().plus(delay), // 다음 재시도 허용 시각이다.
                    safeErrorCode(failure) // 민감한 broker 응답 본문 대신 제한된 오류 코드를 저장한다.
            ); // 재시도 상태 저장을 끝낸다.
        } // 예외 처리를 끝낸다.
    } // 한 이벤트 전송을 끝낸다.

    private String safeErrorCode(RuntimeException failure) { // 저장·로그에 쓸 오류를 제한한다.
        return "PUBLISH_FAILED"; // 예제에서는 예외 본문 대신 일반 분류 코드만 남긴다.
    } // 오류 코드 변환을 끝낸다.
} // relay component를 끝낸다.
```

예제는 스케줄러가 겹쳐 실행되지 않는 구조를 가정하지 않는다. 여러 인스턴스가 동시에 동작해도 DB claim token과 lease로 같은 순간의 소유자를 구분한다. `markPublished`와 `scheduleRetry`의 SQL은 반드시 `WHERE id = :id AND status = 'IN_PROGRESS' AND claim_token = :claimToken` 조건을 포함하고, 갱신 행 수가 1인지 확인해야 오래된 worker가 새 소유자의 상태를 바꾸지 않는다.

claim token과 lease는 중복 발행을 완전히 막는 장치가 아니다. 첫 worker가 broker에 보낸 뒤 ack를 기다리다 lease가 만료될 수 있고, 두 번째 worker가 같은 이벤트를 다시 claim할 수 있다. 전송 timeout도 “broker가 받지 못했다”는 확정 증거가 아니다. broker가 받았지만 ack만 유실된 경우 재시도는 같은 event ID를 가진 중복 메시지를 만든다.

## 8. 실패 뒤 재시도와 운영 정책

### 8.1 지수 backoff와 jitter

broker가 오래 장애인 상태에서 모든 row를 수십 ms 간격으로 반복 시도하면 DB와 broker에 부하를 더한다. 예를 들면 다음처럼 대기 상한을 둔 지수 backoff에 무작위 jitter를 더한다.

```text
base = min(maxDelay, initialDelay × 2^(attemptCount - 1))
nextDelay = base × random(0.8, 1.2)
```

`attempt_count`가 너무 큰 행을 영구 삭제하면 조용히 이벤트가 유실된다. 정책상 자동 재시도를 중단하더라도 `FAILED`로 격리하고 알림·수동 재처리·원인 추적을 제공한다. 실패 원문에 토큰·개인정보가 들어갈 수 있으므로 로그와 `last_error`에는 코드와 제한된 요약만 남긴다.

### 8.2 어떤 결과를 성공으로 표시할까?

`PUBLISHED`는 사용하는 broker adapter가 정의한 publish acknowledgement를 받은 뒤 기록한다. 단순히 `send()` 메서드를 호출했거나 future를 받았다는 것만으로 broker가 메시지를 durable하게 보관했다고 단정하지 않는다. broker의 producer 설정, ack 단계, 복제·보존 정책을 확인한다.

DB에서 `PUBLISHED` 상태 update가 실패해도 broker 발행 자체는 이미 성공했을 수 있다. row가 계속 미완료로 보이면 relay는 재전송할 수 있다. 이 설계는 유실보다 중복 재전송을 허용하고 consumer 멱등성으로 업무 효과를 보호하는 방향이다.

### 8.3 처리량과 backlog 관찰

운영에서는 poll 주기만 보는 대신 다음을 측정한다.

- 가장 오래된 `NEW` 행의 나이와 전체 미발행 행 수
- `IN_PROGRESS` lease 만료 수와 claim 시도 횟수 분포
- broker ack까지 걸린 시간과 재시도 비율
- `FAILED` 행 수, 마지막 오류 코드, 수동 복구 대기 시간
- DB connection·poll query·outbox 인덱스 크기와 보관 삭제량

미발행 이벤트가 계속 쌓이면 consumer가 느린지, broker가 장애인지, relay가 멈췄는지 구별할 수 있어야 한다. 발행 완료 행은 재처리·감사 요구에 맞춘 retention 이후 batch 삭제 또는 archive한다.

## 9. Consumer는 inbox로 업무 중복을 막는다

relay가 같은 event ID를 두 번 보낼 수 있으므로 consumer도 중복 메시지를 안전하게 받아야 한다. consumer DB에 `consumer_name + event_id`의 unique key를 저장하고, inbox 기록과 consumer의 업무 변경을 같은 DB transaction에 넣는다.

```sql
CREATE TABLE consumer_inbox ( -- 각 consumer가 반영한 event ID를 저장한다.
    consumer_name VARCHAR(120) NOT NULL, -- 서로 다른 handler의 처리 기록을 분리한다.
    event_id UUID NOT NULL, -- producer가 부여한 전역 이벤트 ID다.
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 성공 반영 시각이다.
    PRIMARY KEY (consumer_name, event_id) -- 같은 consumer가 같은 이벤트를 두 번 반영하지 못하게 한다.
); -- inbox table을 만든다.
```

consumer 흐름은 다음과 같다.

```java
@Transactional // inbox 기록과 업무 update를 같은 consumer DB transaction으로 묶는다.
public void handle(OrderCreated event) { // broker에서 전달받은 주문 이벤트를 처리한다.
    int inserted = inboxRepository.claim("billing-projection", event.eventId()); // unique key로 최초 처리권을 얻는다.
    if (inserted == 0) { // 이미 commit된 inbox 기록이 있다.
        return; // 업무 update를 반복하지 않는다.
    } // 중복 분기를 끝낸다.

    billingProjectionRepository.addOrder( // 소비자 DB의 projection 또는 업무 데이터를 갱신한다.
            event.orderId(), // 주문 키를 전달한다.
            event.totalAmount(), // 확정 금액을 전달한다.
            event.currency() // 금액 통화를 전달한다.
    ); // consumer의 업무 update를 끝낸다.
} // broker handler를 끝낸다.
```

`inboxRepository.claim()`은 `INSERT ... ON CONFLICT DO NOTHING`의 영향 행 수를 돌려주는 방식으로 만들 수 있다. inbox insert 후 handler 업무 update가 실패하면 transaction이 rollback되어 inbox도 사라져야 broker 재전달에서 다시 처리할 수 있다. inbox만 먼저 commit하고 업무 처리는 나중에 하면 장애 때 메시지를 처리 완료로 오인할 수 있다.

PostgreSQL claim query는 다음처럼 쓸 수 있다.

```sql
INSERT INTO consumer_inbox (consumer_name, event_id) -- 이 consumer의 처리 표시를 추가한다.
VALUES (:consumer_name, :event_id) -- 메시지 envelope에서 받은 식별자를 사용한다.
ON CONFLICT (consumer_name, event_id) DO NOTHING; -- 이미 처리했으면 업무 처리를 시작하지 않는다.
```

영향 행 수 1은 이번 transaction이 처리 후보를 얻었다는 뜻이고, 0은 이미 commit된 중복 키가 있었다는 뜻이다. 뒤따르는 업무 update와 이 INSERT가 같은 consumer DB transaction에 속해야 한다.

이 inbox는 consumer의 로컬 DB 작업까지만 묶는다. handler가 외부 결제 API를 호출한다면 그 원격 호출은 consumer DB transaction에 포함되지 않는다. 외부 호출의 idempotency key, consumer 측 outbox, 또는 여러 단계 보상 흐름인 Saga를 추가로 설계한다.

## 10. 이벤트 순서가 필요하면 따로 설계한다

서로 다른 주문의 이벤트는 대체로 병렬 처리할 수 있지만, 같은 주문의 `OrderCreated → OrderPaid → OrderCancelled`는 순서가 업무 의미를 바꿀 수 있다.

- 이벤트에 `aggregateId`와 `aggregateVersion`을 넣어 순서 기대를 표현한다.
- Kafka라면 aggregate ID를 message key로 사용해 같은 aggregate가 같은 partition으로 가게 하는 구성이 일반적이다. broker별 partition·key 의미를 확인한다.
- polling worker가 `SKIP LOCKED`로 여러 행을 나눠 가지면 먼저 생긴 event가 잠겨 있는 동안 다음 version을 다른 worker가 먼저 claim할 수 있다.
- 따라서 timestamp 정렬만으로 aggregate 내부 순서를 보장한다고 가정하지 않는다. aggregate별 순차 claim, partitioning, version gap 감지, consumer의 기대 version 확인 중 필요한 정책을 선택한다.
- 순서가 어긋난 이벤트를 무조건 폐기하지 말고, 이전 이벤트 재전달을 기다릴지 재조회·재처리할지 정한다.

Debezium Outbox Event Router 문서는 aggregate ID를 Kafka message key로 사용할 수 있고, 같은 key가 partition order에 중요하다고 설명한다. 이것도 전체 business order를 자동으로 보장하는 옵션은 아니며 outbox 생산 순서와 consumer 처리 방식을 함께 맞춰야 한다.

## 11. Polling과 CDC 중 어떻게 고를까?

| 방법 | 흐름 | 장점 | 운영 부담·주의점 |
| --- | --- | --- | --- |
| Polling Publisher | 애플리케이션 worker가 outbox 테이블을 주기적으로 claim하고 broker에 발행 | 별도 CDC connector 없이 단순하게 시작할 수 있고 상태·재시도 제어를 직접 구현 | poll query·lease·backoff·정리 작업을 운영하고 DB 부하와 순서를 관리 |
| CDC + Debezium | DB 변경 로그를 connector가 읽고 Outbox Event Router가 이벤트로 변환 | 변경 로그 기반으로 낮은 지연의 전달 파이프라인 구성 가능 | connector·offset·replication slot·schema·장애 복구 운영 필요 |

Debezium은 outbox 테이블 변경을 캡처하고 Outbox Event Router 변환을 적용하는 구성을 문서화한다. 기본 예제는 `id`, `aggregatetype`, `aggregateid`, `type`, `payload` 컬럼과 insert 중심의 구조를 사용한다. **위 polling migration은 컬럼 이름이 다르고 relay가 `status`를 update하므로 그대로 기본 Event Router에 연결할 수 없다.** CDC를 선택할 때는 Debezium 설정에 맞춘 outbox schema를 쓰거나 컬럼 매핑을 구성하고, connector가 필요한 insert log를 읽기 전에 cleanup하지 않도록 설계한다. CDC를 선택해도 consumer 중복 제거, schema 진화, 순서, retention과 장애 대응이 없어지는 것은 아니다.

처음 학습하거나 트래픽이 작아도 운영 가능한 단일 서비스라면 polling 흐름을 이해하기 쉽다. 이미 Kafka Connect·Debezium을 안정적으로 운영하고 있거나 polling 부하·지연 목표가 맞지 않으면 CDC를 검토한다. 기술을 도입하기 전에 전달량·허용 지연·재처리 요구와 담당 운영 역량을 비교한다.

## 12. 테스트 시나리오

실제 PostgreSQL과 선택한 broker adapter를 연결하는 환경에서는 다음을 확인한다.

| 시나리오 | 확인할 결과 |
| --- | --- |
| order insert 성공, outbox insert 성공 | 두 행 모두 commit된다 |
| outbox 직렬화·insert 실패 | order도 rollback된다 |
| 주문 validation 실패 | order와 outbox가 모두 없다 |
| broker에 보내기 전에 relay 종료 | lease 만료 후 같은 event ID가 다시 claim된다 |
| broker ack 뒤 `PUBLISHED` update 전 relay 종료 | 같은 event ID가 재발행될 수 있고 consumer 업무 효과는 한 번이다 |
| 두 poller가 동시에 batch claim | 동시에 소유한 행은 겹치지 않는다 |
| broker timeout으로 성공 여부 불명확 | 재시도 가능한 상태가 되고 중복 전달을 consumer가 흡수한다 |
| consumer 업무 처리 실패 | inbox claim과 업무 update가 rollback된다 |
| 같은 event ID 재전달 | inbox unique 제약으로 업무 update를 다시 하지 않는다 |
| 같은 aggregate의 version 2가 먼저 도착 | consumer가 gap을 감지해 대기·재처리 정책을 따른다 |

특히 두 번째 worker가 같은 event를 claim하지 않는지만 확인하는 테스트로는 ack 유실 뒤 재전송과 consumer idempotency를 검증하지 못한다. relay·broker·consumer의 장애 구간을 각각 분리해 재현한다.

## 13. 자주 하는 오해

### “Outbox를 쓰면 정확히 한 번 전달된다”

그렇지 않다. DB 행은 내구성 있는 발행 의도를 보관하지만, broker 성공 직후 `PUBLISHED` 기록이 실패하면 같은 메시지를 재전송한다. outbox는 업무 이벤트를 commit과 함께 잃지 않게 만들고, 전송 경로를 재시도 가능하게 만든다. 소비자는 중복 가능한 전달을 받아들여야 한다.

### “broker 호출을 `@Transactional` 메서드 안에 넣었으니 원자적이다”

DB transaction manager가 broker의 트랜잭션까지 함께 조정하지 않는 한 두 시스템은 따로 확정된다. 분산 transaction/XA는 broker와 DB 모두의 지원, 성능 및 운영 대가가 있어 outbox와는 다른 선택이다.

### “`AFTER_COMMIT`에서 보내면 outbox가 필요 없다”

`AFTER_COMMIT`은 rollback된 transaction의 이벤트를 보내지 않도록 돕지만, DB commit과 listener 수행 사이의 프로세스 crash에서 복구 가능한 발행 기록을 제공하지 않는다. 유실을 복구할 영속 기록이 필요하면 outbox를 둔다.

### “consumer가 event ID를 기억하면 모든 부수 효과도 한 번이다”

inbox transaction과 같은 DB에서 이뤄지는 작업만 함께 보호할 수 있다. 이메일 발송·결제 API 같은 외부 효과는 해당 시스템의 idempotency 지원이나 별도 전달 패턴으로 보호한다.

## 14. 운영 체크리스트

- [ ] 주문과 outbox 행이 같은 DB·같은 transaction manager에 연결되어 있는가?
- [ ] broker 전송을 주문 생성 transaction 안에서 기다리지 않는가?
- [ ] relay claim의 batch 크기·lease·poll 주기·broker timeout이 서로 맞는가?
- [ ] lease 만료, broker ack 불명확, 완료 update 실패에서 중복이 발생할 수 있음을 수용했는가?
- [ ] publish 성공의 정의가 broker의 실제 ack와 durability 설정에 맞는가?
- [ ] 재시도에 지수 backoff·jitter·오류 격리·운영 알림이 있는가?
- [ ] relay 상태 update가 id와 claim token을 함께 확인하는가?
- [ ] consumer inbox 기록과 로컬 업무 효과가 같은 transaction인가?
- [ ] aggregate 순서가 중요하다면 version과 partition/claim 정책이 맞는가?
- [ ] outbox retention·cleanup이 미발행 이벤트나 CDC 진행 중인 이벤트를 지우지 않는가?
- [ ] backlog 나이·미발행 수·lease 만료·재시도·FAILED 건수를 관찰하는가?
- [ ] 이벤트 payload에 불필요한 개인정보·credential을 복제하지 않는가?

## 15. 핵심 정리와 다음 학습

1. DB와 broker를 각각 호출하는 dual write는 한쪽 성공 뒤 다른 쪽 실패가 가능하다.
2. 업무 데이터와 outbox 행을 같은 DB transaction에 넣어 commit/rollback을 함께 맞춘다.
3. relay는 커밋된 행을 broker로 전달하고, 장애 후 이어갈 수 있도록 lease와 재시도 상태를 기록한다.
4. broker 성공 직후 DB 완료 표시 전 crash가 나면 같은 event ID가 다시 발행될 수 있다.
5. consumer inbox unique key와 업무 update를 같은 로컬 transaction에 넣어 duplicate delivery를 업무 효과 중복으로 만들지 않는다.
6. outbox는 end-to-end exactly-once 처리를 약속하지 않는다. 전달 시도·중복 수용·소비자 멱등성이 함께 필요하다.
7. 순서, schema evolution, 보관·정리, 관찰과 재처리는 데이터 계약과 운영 설계에 포함한다.

🧠 기억할 것: **DB commit과 이벤트 발행의 틈에는 영속 outbox를 두고, 발행 뒤의 중복은 event ID와 consumer inbox로 다룬다.**

다음 학습인 [Saga와 보상 트랜잭션](../26_09_26_Saga_and_Compensating_Transactions/09_26_Saga_and_Compensating_Transactions.md)에서는 여러 서비스에 걸친 장기 업무 흐름, timeout, 재시도와 보상 상태를 연결한다.

## 16. 복습 퀴즈

1. 주문을 먼저 commit하고 broker를 호출하는 코드에서 프로세스가 commit 직후 종료되면 어떤 데이터가 남는가?
2. outbox row를 broker로 보낸 다음 `PUBLISHED` update가 실패하면 어떤 일이 가능하며 왜 event ID가 필요한가?
3. polling relay가 `SKIP LOCKED`를 사용해도 aggregate version 순서를 자동 보장하지 않는 이유는 무엇인가?
4. consumer inbox insert를 업무 update와 다른 transaction으로 분리하면 어떤 장애 구간이 생기는가?
5. `@TransactionalEventListener(AFTER_COMMIT)`와 outbox의 복구 능력 차이는 무엇인가?
6. broker가 포함되지 않은 `@Transactional` 경계가 DB와 broker commit을 원자적으로 만들지 않는 이유는 무엇인가?
7. consumer handler가 외부 결제 API까지 호출한다면 inbox transaction만으로 부족한 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 주문 행은 DB에 있지만 broker에는 이벤트가 없을 수 있다. 일반 코드에는 나중에 재발행할 durable event row가 없다.
2. broker는 이미 메시지를 받았지만 DB는 미발행처럼 남아 재시도가 중복 전송할 수 있다. event ID로 consumer가 같은 논리 이벤트임을 식별한다.
3. worker가 잠긴 이전 행을 건너뛰고 다음 행을 claim할 수 있고, broker도 aggregate 단위 순서를 자동 보장하는 설정이 아닐 수 있기 때문이다.
4. 업무 update는 commit됐는데 inbox가 없거나, inbox만 commit되고 업무 update가 실패해 재전달을 막는 상태가 될 수 있다.
5. Spring listener는 commit 이후 callback 시점을 제공한다. Outbox는 callback 전 crash 뒤에도 재시작 후 읽을 이벤트 의도를 DB에 저장한다.
6. 일반 DB transaction manager가 별도 broker 시스템의 commit을 자동으로 같은 원자적 자원으로 묶지 않기 때문이다.
7. 원격 결제 호출은 consumer DB transaction에 참여하지 않는다. 원격 성공 뒤 local rollback·timeout이면 재호출될 수 있으므로 별도 멱등 키나 전달 패턴이 필요하다.

</details>

## 17. 공식 문서로 이어서 읽기

- [AWS Prescriptive Guidance — Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html): dual write, 같은 transaction 저장, duplicate delivery·순서·CDC 고려사항
- [Spring Framework — Transaction-bound Events](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html): `@TransactionalEventListener`와 `AFTER_COMMIT` 단계
- [PostgreSQL 17 — SELECT](https://www.postgresql.org/docs/17/sql-select.html): `FOR UPDATE`, `SKIP LOCKED`의 locking clause
- [PostgreSQL 17 — Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html): row lock의 범위와 transaction 종료 시 해제
- [Debezium — Outbox Event Router](https://debezium.io/documentation/reference/transformations/outbox-event-router.html): CDC connector와 outbox 필드·event key·payload 라우팅
- [Spring Framework — Transaction Propagation](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html): 서비스 내부 DB transaction 경계 복습
