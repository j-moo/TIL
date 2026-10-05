# Spring Batch 오류 처리·retry·skip과 결과 검증

- 🎯 글의 목표: 다시 시도할 장애와 건너뛸 수 있는 항목을 구분하고, 제한된 retry·skip 정책과 처리 결과의 확인 기준을 설명한다.
- 🧩 핵심 키워드: retry, skip, filter, RetryPolicy, SkipPolicy, fault tolerance, SkipListener, BatchStatus, ExitStatus, 결과 대조
- ⭐ 중요도: 높음. 실패를 모두 무시하면 데이터가 빠지고, 모든 오류를 반복하면 작업 시간과 외부 부하가 늘어난다.
- 📝 한눈에 보는 내용: 오류 분류 → 재시도 횟수·대기 → skip 한도 → 정책 연결 → 누락 관찰 → 완료와 업무 성공 구분 → 경계 테스트 순서로 이해한다.
- 🔗 관련 주제: [Batch 재시작·체크포인트](../33_10_04_Spring_Batch_and_Restartability/10_04_Spring_Batch_and_Restartability.md), [트랜잭션](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md), [timeout·재시도](../27_09_28_Timeouts_Retries_and_Circuit_Breakers/09_28_Timeouts_Retries_and_Circuit_Breakers.md), [테스트 전략](../10_09_06_Testing_Strategy/09_06_Testing_Strategy.md)
- 🧱 선수 지식: Job·Step·chunk·Instance·Execution, Java 예외·제네릭·람다, commit·rollback을 이해한다.

> 자료 기준일: 2026-10-05. Spring Boot 4.1.1이 관리하는 Spring Batch 6.0.5·Spring Framework 7.0.9의 문서·API와 Batch 6.0.5 소스를 확인했다. Java 코드는 JDK 21의 기존 Boot 프로젝트에 추가하는 파일·교체 조각·JUnit 테스트다. 이전 노트의 JDBC 구성·Book record·Reader·Writer를 전제로 하며 독립 실행 프로젝트가 아니다. 명령 검색에서 Java 8만 확인됐고 javac·Maven·Gradle 및 저장소의 Boot 빌드 프로젝트가 없어 컴파일·JUnit·DB 통합 실행은 수행하지 않았다. 아래 테스트 결과와 DB 결과는 예상이며 문서 정적 검사와 구분한다.

## 1. 들어가며

이전 노트에서는 도서 목록을 작은 묶음으로 저장하고 실패한 작업을 마지막 확정 지점부터 다시 진행했다. 그런데 오류가 생겼다는 사실만으로 항상 작업 전체를 실패시켜야 할까? 조회 서비스가 잠깐 응답하지 않는 경우와 도서 수량이 음수인 경우는 원인과 대응이 다르다.

일시적인 조회 장애는 조금 기다린 뒤 성공할 가능성이 있다. 반면 `stock=-1`인 행을 똑같이 다시 읽는다고 수량이 정상값으로 바뀌지는 않는다. 도서 목록 가져오기에서 잘못된 일부 행을 별도로 검토하며 나머지를 적재하는 정책을 허용했다면, 그 항목을 제외하고 계속할 수 있다. 하지만 결제·정산처럼 한 건의 누락도 허용하지 않는 업무에서는 같은 정책을 적용해서는 안 된다.

이번 노트는 **현재 실행 안의 retry·skip**에 집중한다. 실패 종료 후 새 Execution으로 진행하는 restart와 연결하되 같은 기능으로 보지는 않는다. 최종적으로는 처리 완료 상태와 입력·저장·제외 결과를 함께 확인해, 데이터가 빠진 일을 정상 성공처럼 숨기지 않는 것이 목표다.

## 2. 핵심 개념 정리

```text
항목 처리 중 오류
  → 반복해도 안전하고 회복 가능성이 있는가?
      → 허용한 예외만 제한 횟수·대기로 retry
  → 그래도 실패했거나 retry 대상이 아닌가?
      → 항목 제외를 허용한 예외이며 skip 한도 안인가?
          → 제외 이유를 관찰하고 나머지 처리
          → 아니면 Step 실패
처리 종료 → 상태·카운터·실제 결과·제외 이력 대조 → 업무 승인 또는 검토
```

이 흐름의 retry는 오류가 자연히 없어질 가능성에, skip은 누락을 허용하는 업무 판단에 근거한다. 어느 정책에도 해당하지 않으면 실패를 드러낸다.

| 질문 | 관련 절 |
| --- | --- |
| retry·skip·filter·restart는 무엇이 다른가? | 3.1 |
| 몇 번, 어떤 예외를 다시 시도하는가? | 3.2~3.3 |
| 몇 건까지 제외하며 무엇을 제외하지 않는가? | 3.4 |
| 기존 도서 적재 코드에는 어떻게 연결하는가? | 3.5~3.6 |
| 제외를 기록하고 완료 결과를 확인하는가? | 3.7~3.8 |
| 정책과 실제 DB 동작을 어떻게 나누어 검사하는가? | 3.9 |

## 3. 본문 정리

### 3.1 오류를 같은 방식으로 처리하지 않는다

**retry는 실패한 동작을 제한적으로 다시 시도하는 것**이다. 같은 입력이어도 성공 여부가 시간·외부 상태에 따라 달라지는 일시 장애에 고려한다. 다만 회복 가능성과 반복의 안전성은 다른 질문이다. 읽기 요청은 다시 보낼 수 있어도, 처리 완료 여부가 불확실한 결제 요청은 멱등성이 없으면 위험하다. [공식 retry 설명](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/retry-logic.html)

**skip은 오류가 난 항목을 처리 결과에서 제외하고 진행하는 것**이다. 프레임워크가 대신 데이터의 가치를 판단하지는 않는다. 어떤 종류의 항목 오류를 몇 건까지 허용할지는 업무 담당자가 정한 정책이어야 한다. 이 예제는 도서 가져오기에서 명시적인 필드 검증 실패를 최대 2건까지 제외하되 검토 대상으로 남기는 학습 정책이다. [공식 skip 설명](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/configuring-skip.html)

**filter는 정상 입력 중 처리 대상이 아닌 항목을 제외하는 것**이다. Processor가 null을 반환하는 경우가 여기에 해당한다. 판매 중단 도서를 처음부터 적재 대상에서 제외하는 규칙과, 수량이 음수여서 오류로 제외하는 일은 보고 의미가 다르다. Reader의 null은 파일 끝이므로 이 둘과도 구분한다.

**restart는 실패·중지한 업무에 새 Execution을 만들어 진행을 복원하는 것**이다. 현재 호출을 다시 시도하는 retry와 달리, 저장된 실행 이력과 체크포인트를 이용한다. retry가 한도에 도달해 실행이 실패한 뒤 원인을 해결하고 restart할 수 있지만, 둘의 횟수와 상태를 같은 값으로 계산하지 않는다.

| 상황 | 예제의 판단 | 이유 |
| --- | --- | --- |
| 외부 도서 정보 조회의 일시 장애로 분류된 오류 | 제한된 retry, 소진되면 실패 | 반복으로 회복될 수 있지만 전체 누락은 허용하지 않음 |
| 구조를 읽을 수 있지만 수량이 음수인 항목 | 명시적 검증 예외로 skip | 해당 항목을 식별하고 제외 이유를 남길 수 있음 |
| CSV 숫자 필드가 `abc`라 파싱되지 않음 | 이번 예제에서는 실패 | 파싱 오류의 원인과 범위를 자동 승인하지 않음 |
| 입력 파일 없음·인증 실패·DB 제약 오류 | 실패 | 입력·환경·일관성 문제를 일부 항목 누락으로 감추지 않음 |
| 정상 항목이지만 적재 대상이 아님 | 필요하다면 filter | 오류가 아니라 업무상 대상 선택임 |

이 표는 모든 가져오기 업무의 보편 규칙이 아니라 이번 예제의 선택이다. 다른 업무에서 파싱 오류를 skip하려면 원본 행 번호·형식 오류·보존 정책까지 정한 뒤 별도로 허용한다.

⚠️ 주의: `Exception`이나 `RuntimeException` 전체를 retry·skip 대상으로 넣으면 코드 결함·DB 장애·권한 문제까지 반복하거나 누락시킬 수 있다. 검증 실패와 일시 장애를 구분하는 좁은 예외 타입을 먼저 만든다.

### 3.2 retry 횟수는 최초 호출과 구분한다

**RetryPolicy는 다시 시도할 예외와 최대 횟수·대기 등의 규칙이다.** Batch 6의 새 chunk 구현은 Spring Framework의 `org.springframework.core.retry.RetryPolicy`를 사용한다. Batch 5의 Spring Retry 패키지를 그대로 가져오는 예제가 아니다. 의존성은 기존 Boot의 버전 관리를 유지한다. [Batch 6 변경점](https://docs.spring.io/spring-batch/reference/whatsnew.html), [Boot 의존성 표](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)

Framework의 `maxRetries(2)`는 최초 시도를 제외하고 최대 두 번 더 시도한다는 뜻이다. 따라서 이 정책이 감싼 동작의 한 retry 실행은 최대 3회 호출된다. 이 횟수가 Job 전체에서 호출될 수 있는 횟수의 상한은 아니다. 항목이 여러 개이거나 작업을 재시작하면 다른 retry 실행이 생긴다. [RetryPolicy.Builder API](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/core/retry/RetryPolicy.Builder.html)

```text
최초 호출 실패 → 200ms 대기 → retry 1 실패 → 200ms 대기 → retry 2
retry 2 성공  → 다음 처리
retry 2 실패  → 정책 소진 → skip 여부 판단 또는 Step 실패
```

200ms와 두 번은 순서를 관찰하기 위한 학습 값이다. 전체 실행 시간에는 호출마다 소비한 시간과 retry 사이의 대기가 모두 들어간다. 횟수만 제한하고 실제 I/O timeout을 두지 않으면 한 번의 호출에서 오래 멈출 수 있다. 실제 외부 연동에는 이전 timeout 노트처럼 호출 제한·전체 기한·반복 안전성도 함께 적용한다.

### 3.3 retry가 새 트랜잭션을 자동으로 만드는 것은 아니다

**트랜잭션 경계는 retry 정책과 별도로 확인해야 한다.** Batch 6.0.5의 `ChunkOrientedStep` 소스에서는 chunk 트랜잭션 안에서 읽기·처리·쓰기를 진행하며, fault-tolerant 동작을 RetryTemplate으로 감싼다. Writer의 retry를 설정했다고 매 시도마다 새로운 DB 트랜잭션을 만드는 것으로 가정하면 안 된다. [Batch 6.0.5 chunk 구현](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/step/item/ChunkOrientedStep.java)

예를 들어 PostgreSQL은 SQL 오류로 트랜잭션이 aborted 상태가 되면 정상 진행하려면 전체 rollback 또는 적절한 savepoint 복구가 필요하다. 같은 트랜잭션에서 오류 난 SQL을 반복하는 것만으로 이 상태가 없어지지는 않는다. [PostgreSQL 트랜잭션 설명](https://www.postgresql.org/docs/17/tutorial-transactions.html)

따라서 이번 학습 정책은 DB 오류 전체를 retry하거나 skip하지 않는다. Processor의 일시적인 조회 실패를 나타내는 전용 예외만 retry하고, DB Writer의 제약 오류는 실패로 드러낸다. 실제 deadlock·DB 연결 장애 복구는 현재 버전의 실행 구현, JDBC 드라이버, 트랜잭션 매니저, rollback 뒤 재실행 위치를 별도로 검증해야 한다.

또한 Writer가 외부 알림을 보낸 다음 예외를 던지면 retry로 같은 알림이 반복될 수 있다. 예외가 있었다는 사실은 앞에서 아무 효과도 발생하지 않았다는 증거가 아니다. 반복 가능한 변환·조회와 외부 쓰기 효과를 분리한다.

⚠️ 주의: retry 중 오래 기다리면 이미 잡은 DB 연결·잠금의 유지 시간도 길어질 수 있다. chunk 안의 느린 외부 조회는 구조·timeout·chunk 크기를 함께 검토한다. 이 노트의 장애 주입 코드는 메모리에서 실패를 만드는 테스트 대역이지 실제 외부 서비스의 성능 검증이 아니다.

### 3.4 SkipPolicy는 항목 제외의 조건과 한도를 정한다

**SkipPolicy는 받은 예외와 현재 skip 수로 계속 진행할 수 있는지 판단하는 규칙이다.** `LimitCheckingExceptionHierarchySkipPolicy`는 허용한 예외 타입과 그 원인 예외를 확인하고 한도를 검사한다. 정책이 아닌 입력 오류는 false, 한도를 넘긴 허용 오류는 `SkipLimitExceededException`으로 구분된다. [정책 API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/skip/LimitCheckingExceptionHierarchySkipPolicy.html)

한도 2는 첫 번째와 두 번째 제외를 허용한다. 이미 두 건을 제외했는데 세 번째 허용 오류가 발견되면 실패한다. chunk마다 한도를 새로 적용하는 것이 아니라, 해당 StepExecution의 read·process·write skip을 합쳐 판단한다. read·process·write 각각 두 건씩 허용한다는 의미도 아니다. [StepContribution의 합계 구현](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/step/StepContribution.java)

| 지금까지 제외 수 | 이번 예외 | 결과 |
| ---: | --- | --- |
| 0 | 허용한 필드 검증 예외 | 첫 번째 skip 허용 |
| 1 | 허용한 필드 검증 예외 | 두 번째 skip 허용 |
| 2 | 허용한 필드 검증 예외 | 한도 초과로 실패 |
| 0 | 일시 조회 장애·DB 오류 등 허용하지 않은 예외 | skip 거부 |

API는 음수 skipCount를 받아 예외가 허용되는 타입인지 시험할 수도 있다. 이때는 실제 제외를 한 건 소비하는 호출로 보지 않는다. 직접 정책을 구현한다면 음수 입력을 처리해야 하지만 이번 예제에서는 제공된 정책을 사용한다. [SkipPolicy 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/skip/SkipPolicy.html)

재시작하면 새 StepExecution이 만들어지고 이전 context를 이어받는 것과 각 실행의 카운터는 다른 문제다. 이번 기본 skip 한도를 JobInstance 전체의 누적 누락 제한으로 보지 않는다. 여러 실행을 통틀어 최대 두 항목만 제외해야 한다면 확정된 제외 이력을 업무 키로 저장·집계하는 별도 설계가 필요하다. [재시작 Step 생성 소스](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/job/SimpleStepHandler.java)

### 3.5 구분된 예외와 정책을 코드로 만든다

다음은 `src/main/java/com/example/batch/CatalogFaultRules.java`에 추가하는 파일이다. 원본 행 검증 오류는 skip 후보, 조회의 일시 장애는 retry 후보로 분리한다. 예외 메시지에는 원본 행·비밀값을 넣지 않고 이유 코드만 담는다.

```java
package com.example.batch;

import java.time.Duration; // retry 사이의 대기 시간을 명시한다.
import java.util.Set; // 허용하는 예외 타입의 집합을 만든다.
import org.springframework.batch.core.step.skip.LimitCheckingExceptionHierarchySkipPolicy;
import org.springframework.batch.core.step.skip.SkipPolicy;
import org.springframework.core.retry.RetryPolicy; // Framework 7의 정책 타입이다.

public final class CatalogFaultRules {
    private CatalogFaultRules() {} // 정책 팩터리만 사용하므로 인스턴스는 필요 없다.

    public enum RowIssue {
        EMPTY_ID, ID_TOO_LONG, EMPTY_TITLE, TITLE_TOO_LONG, NEGATIVE_STOCK
    } // 오류 항목을 재검토할 때 사용할 제한된 이유 코드다.

    public static final class InvalidCatalogRowException extends RuntimeException {
        private final RowIssue issue; // 자유로운 원본 문자열 대신 분류된 이유를 보관한다.

        public InvalidCatalogRowException(RowIssue issue) {
            super(issue.name()); // 진단 메시지에도 도서 제목 등 원본 내용을 넣지 않는다.
            this.issue = issue; // listener나 테스트가 같은 이유 코드를 사용할 수 있다.
        }

        public RowIssue issue() {
            return issue; // 누락 원인의 분류 값을 제공한다.
        }
    }

    public static final class LookupUnavailableException extends RuntimeException {
        public LookupUnavailableException() {
            super("CATALOG_LOOKUP_TEMPORARILY_UNAVAILABLE"); // 일시 장애만 나타낸다.
        }
    }

    public static RetryPolicy retryPolicy(Duration delay) {
        return RetryPolicy.builder()
                .maxRetries(2) // 최초 호출 1회 + retry 최대 2회다.
                .delay(delay) // 실제 Step에는 200ms, 정책 테스트에는 0을 전달한다.
                .includes(Set.of(LookupUnavailableException.class)) // 이 타입만 반복한다.
                .build(); // 조회 장애가 소진돼도 skip 대상이 되지는 않는다.
    }

    public static SkipPolicy skipPolicy() {
        Set<Class<? extends Throwable>> allowed = Set.of(InvalidCatalogRowException.class);
        return new LimitCheckingExceptionHierarchySkipPolicy(allowed, 2);
        // 필드 검증 오류를 두 건까지 허용한다. 파싱·DB·일시 조회 오류는 포함하지 않는다.
    }
}
```

여기서 `includes`와 skip용 `allowed`가 서로 다르다는 점을 읽어야 한다. 조회 장애가 세 번 실패하면 도서 한 건을 조용히 버리는 대신 Step을 실패시킨다. 허용한 필드 오류는 같은 값으로 반복할 의미가 없으므로 retry하지 않고 skip 여부를 판단한다.

실제 외부 조회 코드를 추가한다면 모든 HTTP·전송 예외를 위 일시 장애로 바꾸지 않는다. 해당 오류가 정말 재시도 가능한지 분류하고 원인 보존·timeout·취소 정책을 함께 구현해야 한다. 현재 예제에는 실제 HTTP 클라이언트를 넣지 않는다.

다음은 `src/main/java/com/example/batch/CatalogProcessor.java`에 추가하는 파일이다. 이전 `Book` record를 그대로 입력·출력에 사용하지만, 포괄적인 IllegalArgumentException 대신 검증 실패를 좁은 예외로 나타낸다.

```java
package com.example.batch;

import com.example.batch.CatalogBatchConfiguration.Book; // 이전 노트의 입력 객체다.
import com.example.batch.CatalogFaultRules.InvalidCatalogRowException;
import com.example.batch.CatalogFaultRules.RowIssue;
import org.springframework.batch.infrastructure.item.ItemProcessor;

public final class CatalogProcessor implements ItemProcessor<Book, Book> {
    @Override
    public Book process(Book book) {
        String id = book.bookId() == null ? "" : book.bookId().strip(); // ID를 정리한다.
        String title = book.title() == null ? "" : book.title().strip(); // 제목을 정리한다.
        if (id.isEmpty()) {
            throw new InvalidCatalogRowException(RowIssue.EMPTY_ID); // 식별값 부재를 알린다.
        }
        if (id.length() > 30) {
            throw new InvalidCatalogRowException(RowIssue.ID_TOO_LONG); // DB 범위를 지킨다.
        }
        if (title.isEmpty()) {
            throw new InvalidCatalogRowException(RowIssue.EMPTY_TITLE); // 빈 제목을 거부한다.
        }
        if (title.length() > 200) {
            throw new InvalidCatalogRowException(RowIssue.TITLE_TOO_LONG); // 저장 길이를 검사한다.
        }
        if (book.stock() < 0) {
            throw new InvalidCatalogRowException(RowIssue.NEGATIVE_STOCK); // 음수를 거부한다.
        }
        return new Book(id, title, book.stock()); // 정상 항목만 변환한 새 값으로 반환한다.
    }
}
```

Processor가 null을 반환하지 않으므로 이번 구현의 정상적인 filter 수는 0이다. 검증 예외가 발생하면 정책이 그 항목을 제외할지 판단하며, 예외 메시지와 정책 종류를 같은 것으로 혼동하지 않는다. 예외 이름을 바꾸기만 하고 Step에 정책을 연결하지 않으면 기존처럼 실패한다.

### 3.6 기존 Step에 fault-tolerant 정책을 연결한다

**fault tolerance는 정한 실패를 견디며 처리하는 능력**이다. 여기서는 “모든 오류에도 완료”가 아니라 허용한 retry·skip만 적용한다는 의미다. `.faultTolerant()`를 켜고 정책들을 연결한다. [ChunkOrientedStepBuilder API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/ChunkOrientedStepBuilder.html)

아래는 이전 `CatalogBatchConfiguration.java`에서 **기존 catalogProcessor·catalogImportStep 메서드를 교체하는 일부 코드**다. 기존 메서드를 남겨 동일 이름의 Bean을 중복 등록하지 않는다. 표시한 import를 파일 위에 추가하고, 메서드 두 개는 기존 클래스 안에 넣는다. Reader·Writer·트랜잭션 매니저·Job 정의는 이전 구성을 유지한다. 다음 절의 `CatalogReviewListener` 파일도 함께 필요하다.

```java
// CatalogBatchConfiguration.java의 기존 import 목록에 추가한다.
import java.time.Duration; // 재시도 대기를 코드에서 드러낸다.

// 아래 두 메서드는 기존 CatalogBatchConfiguration 클래스 안에서 교체한다.
@Bean
public ItemProcessor<Book, Book> catalogProcessor() {
    return new CatalogProcessor(); // 좁은 검증 예외를 발생시키는 변환기를 사용한다.
}

@Bean
public Step catalogImportStep(
        JobRepository jobRepository,
        JdbcTransactionManager transactionManager,
        FlatFileItemReader<Book> catalogReader,
        ItemProcessor<Book, Book> catalogProcessor,
        JdbcBatchItemWriter<Book> catalogWriter) {
    CatalogReviewListener review = new CatalogReviewListener(); // 실행 간 가변 상태가 없다.
    return new ChunkOrientedStepBuilder<Book, Book>("catalogImportStep", jobRepository, 3)
            .transactionManager(transactionManager) // 이전과 같은 DB 확정 경계를 유지한다.
            .reader(catalogReader) // 파일·읽기 위치 관리는 이전 Reader를 사용한다.
            .processor(catalogProcessor) // 검증 예외가 skip 정책에 전달된다.
            .writer(catalogWriter) // 유일 제약 위반 등 DB 오류는 이번 정책에서 실패한다.
            .faultTolerant() // retry·skip 처리 경로를 활성화한다.
            .retryPolicy(CatalogFaultRules.retryPolicy(Duration.ofMillis(200)))
            .skipPolicy(CatalogFaultRules.skipPolicy()) // 허용한 검증 오류만 최대 두 건 제외한다.
            .skipListener(review) // 항목 제외가 결정됐을 때 진단 정보를 기록한다.
            .listener(review) // Step 종료 시 이 실행의 수와 검토용 종료 코드를 기록한다.
            .build(); // 구성 완료이며 이 메서드가 Job을 시작하는 것은 아니다.
}
```

이 구성에서 검증 오류는 retry 대상이 아니므로 추가 시도 없이 skip 판단으로 넘어간다. 조회 일시 장애는 제한된 retry를 적용하고 소진되면 skip을 거부한다. Batch 6.0.5 소스는 retry 실패의 원인 예외를 skip 정책에 전달하므로, 일반적인 retry wrapper 전체를 skip 목록에 넣는 방식이 필요하지 않다.

이번 예제는 writer skip을 허용하지 않는다. Writer는 묶음을 받으므로 한 항목의 문제를 찾는 과정에서 묶음 rollback과 개별 항목 재검사가 필요할 수 있다. 이러한 호출 순서를 항목당 Writer 한 번으로 가정하지 않고, 사용 버전의 구현과 실제 DB를 따로 검사해야 한다.

⚠️ 주의: 실패한 Instance가 남아 있는데 같은 Step 이름으로 정책·변환 규칙을 변경해서 재시작하면 앞 묶음은 이전 규칙, 뒤 묶음은 새 규칙으로 처리될 수 있다. 실습은 새 날짜·원본 버전의 업무로 분리하고, 운영 변경에는 남은 실행의 호환성과 복구 계획을 먼저 검토한다.

### 3.7 SkipListener는 진단이고, 확정된 누락 이력은 별도다

**SkipListener는 읽기·처리·쓰기에서 skip한 항목을 관찰하는 콜백이다.** 콜백은 프레임워크가 생명주기에 맞춰 호출하므로 오류가 발생한 즉시 또는 DB commit이 확정된 뒤라고 가정하지 않는다. 같은 항목이 재처리되거나 트랜잭션이 취소될 가능성도 고려한다. [SkipListener 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/listener/SkipListener.html)

다음은 `src/main/java/com/example/batch/CatalogReviewListener.java`에 추가하는 파일이다. SLF4J는 Boot의 기본 로깅에서 사용하는 로그 인터페이스다. 원본 CSV·제목·예외 stack trace를 무조건 출력하는 대신 이번 예제의 비개인정보 도서 ID와 분류만 기록한다. 개인정보 식별자가 있는 업무라면 마스킹·접근 권한·보존 기간도 필요하다.

```java
package com.example.batch;

import com.example.batch.CatalogBatchConfiguration.Book;
import com.example.batch.CatalogFaultRules.InvalidCatalogRowException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.listener.SkipListener;
import org.springframework.batch.core.listener.StepExecutionListener;
import org.springframework.batch.core.step.StepExecution;

public final class CatalogReviewListener
        implements SkipListener<Book, Book>, StepExecutionListener {
    private static final Logger log = LoggerFactory.getLogger(CatalogReviewListener.class);

    @Override
    public void onSkipInProcess(Book book, Throwable error) {
        String reason = error instanceof InvalidCatalogRowException invalid
                ? invalid.issue().name() : "UNCLASSIFIED"; // 허용한 검증 실패의 이유를 구분한다.
        log.warn("catalog process skip: bookId={}, reason={}, errorType={}",
                book.bookId(), reason, error.getClass().getSimpleName());
        // 로그는 원인을 찾는 자료이며 commit 완료나 영속적인 제외 원장을 보장하지 않는다.
    }

    @Override
    public ExitStatus afterStep(StepExecution execution) {
        log.info("catalog step: executionId={}, status={}, read={}, write={}, filter={}, skip={}",
                execution.getId(), execution.getStatus(), execution.getReadCount(),
                execution.getWriteCount(), execution.getFilterCount(), execution.getSkipCount());
        // 실패·중지 상태를 완료처럼 덮어쓰지 않고 완료된 실행에만 검토 표식을 붙인다.
        if (execution.getStatus() == BatchStatus.COMPLETED && execution.getSkipCount() > 0) {
            return new ExitStatus("COMPLETED_WITH_REJECTS"); // 예제에서 정한 Step 종료 코드다.
        }
        return null; // 이 listener가 기존 종료 코드에 새 값을 추가하지 않는다는 뜻이다.
    }
}
```

처리 단계에서 제외한 항목은 `NEGATIVE_STOCK`·`EMPTY_TITLE` 같은 이유 코드와 함께 기록된다. listener는 상태를 필드에 보관하지 않으므로 다른 실행의 카운터가 섞이지 않는다. `afterStep` 반환값은 기존 ExitStatus와 결합된다. 반면 여기에서 예외를 던지면 처리 실패로 적용되는 것이 아니라 로그만 남을 수 있으므로, 결과 검증 실패를 강제하는 용도로 쓰지 않는다. [StepExecutionListener API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/listener/StepExecutionListener.html)

로그만으로 장기간 누락 원장을 관리하는 구현은 아니다. 운영에서 제외 항목을 재처리해야 한다면 **날짜·원본 버전·원본 행 위치 또는 안정적인 항목 키·이유 코드·확정 상태**를 영속적으로 보존하는 구조가 필요하다. 빈 ID도 제외될 수 있으므로 원장 키를 bookId 하나에만 의존해서는 안 된다.

같은 DB에서 제외 이력을 저장한다면 업무 결과·체크포인트와 어떤 트랜잭션으로 확정되는지 정한다. 콜백의 중복 호출에 대비한 유일 키도 필요하다. 이 예제에는 원본 행 위치 추적과 영속 제외 원장을 구현하지 않았으므로, logger 출력만으로 누락 복구까지 완료한 것으로 표현하지 않는다.

### 3.8 BatchStatus·ExitStatus·업무 성공을 따로 읽는다

**BatchStatus는 실행의 생명주기 상태**다. COMPLETED·FAILED·STOPPED 등이 여기에 속한다. **ExitStatus는 단계나 Job이 종료하면서 내보내는 코드와 설명**이며, 조건부 흐름에서 사용할 수 있다. 둘은 기본적으로 비슷한 이름을 쓰지만 항상 같아야 하는 것은 아니다. [종료 코드와 Step 흐름](https://docs.spring.io/spring-batch/reference/step/controlling-flow.html)

위 listener는 완료한 Step에 skip이 있으면 `COMPLETED_WITH_REJECTS`를 붙인다. 이것은 프레임워크의 새로운 BatchStatus가 아니라 예제에서 정한 문자열이다. Step의 표식이 Job 최종 ExitStatus나 운영 도구의 결과에 자동으로 같은 문자열로 전파된다고 보지 않는다. Job 구성에 따라 종료가 결정되므로 Step 결과와 Job 결과를 각각 확인한다.

예제 입력 7건을 처음부터 한 번 실행했으며 두 항목의 Processor 검증 오류만 skip한 경우를 계산해 보자. 정상적으로 완료했다면 예상 readCount는 7, writeCount는 5, processSkipCount는 2, filterCount는 0이다. 이 경우 저장 결과 5건은 처리 정책에 따른 결과이지 모든 원본이 정상 반영됐다는 뜻은 아니다. [StepExecution 카운터 API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/StepExecution.html)

```text
이번 정상 종료 예제의 대조
  입력 7 = 저장 5 + 처리 오류 제외 2 + 정상 필터 0
  Step 상태: COMPLETED
  Step 종료 코드: COMPLETED_WITH_REJECTS
  업무 판단: 제외 항목을 검토한 뒤 승인 여부 결정
```

이 식은 read skip·write skip이 없고 항목당 결과가 한 건인 이번 예제의 확인식이다. 읽기에서 파싱 실패로 skip한 행은 성공한 readCount에 포함되지 않을 수 있으며, Writer의 upsert·여러 출력·재처리가 있으면 단순 카운터만으로 DB 행 수를 계산할 수 없다. 모든 Job에 같은 식을 적용하지 않는다.

재시작 뒤 마지막 StepExecution의 writeCount가 4여도 이전 실행에서 이미 3행을 확정했다면 업무 결과는 7행일 수 있다. 이 때문에 **한 Execution의 처리 수**와 **해당 업무의 최종 DB 결과**를 구분한다. 마지막 실행의 skip 수가 0이라고 이전 실행에서 확정된 제외까지 없었다고 결론내리지 않는다.

다음은 Job 종료 후 별도 PostgreSQL 학습 DB 세션에서 실제 저장 결과를 확인하는 SQL이다. 예제 입력을 `data/catalog-review-v1.csv`라는 별도 파일로 준비하고, 날짜 `2026-10-05`·버전 `catalog-review-v1`로 실행했다고 가정한다. 해당 파일은 이전 7건 중 B003·B006의 수량만 음수로 바꾼 **새 원본**이며, 실패한 기존 원본을 수정하는 절차가 아니다.

```sql
-- 날짜·원본 버전으로 업무 결과를 한정해 실행 카운터와 별도로 확인한다.
SELECT count(*) AS stored_count
FROM catalog_import
WHERE business_date = DATE '2026-10-05' -- 시작 시 전달한 업무 날짜다.
  AND source_revision = 'catalog-review-v1'; -- 불변 입력 버전과 연결한다.

-- 예상 건수만 맞추지 말고 어떤 도서가 반영됐는지도 확인한다.
SELECT book_id, stock
FROM catalog_import
WHERE business_date = DATE '2026-10-05'
  AND source_revision = 'catalog-review-v1'
ORDER BY book_id; -- 예상 ID는 B001·B002·B004·B005·B007이다.
```

검토 결과는 원본 총수·정상 반영 ID·제외 원인·허용 누락 기준을 함께 대조한다. 실제 서비스에 결과 검증 단계를 추가한다면 적재 완료 뒤 별도의 Step에서 영속 결과를 검사하는 방법을 고려할 수 있다. 뒤 검증이 실패해도 앞에서 commit한 적재 행이 자동 취소되는 것은 아니라는 이전 트랜잭션 경계를 유지한다.

⚠️ 주의: skip 한도 이내라는 것은 처리를 계속할 수 있다는 뜻이지 누락 항목을 업무적으로 승인했다는 뜻이 아니다. COMPLETED만 보고 알림을 보내거나 다음 서비스에 완전한 결과라고 전달하지 않는다.

### 3.9 정책 단위 테스트와 DB 통합 테스트를 나눈다

**정책 단위 테스트는 어떤 예외를 몇 번·몇 건까지 허용하는지 확인한다.** 실제 파일·트랜잭션·체크포인트까지 검사하는 것이 아니다. 다음은 `src/test/java/com/example/batch/CatalogFaultRulesTest.java`에 추가할 JUnit Jupiter 파일이다. 기존 테스트 환경이 없다면 Boot가 관리하는 `spring-boot-starter-test`를 testImplementation에 추가한다.

입력은 예외·현재 skip 수·실패하는 람다이며, 결과는 허용 여부와 실제 호출 횟수다. 대기 0은 테스트 시간을 줄이기 위한 값으로 실제 Step의 200ms와 구분한다. RetryTemplate의 `execute`는 소진 시 마지막 원인을 담은 RetryException을 반환 경로 대신 던진다. [RetryTemplate API](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/core/retry/RetryTemplate.html)

```java
package com.example.batch;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger; // 실제로 람다를 몇 번 호출했는지 센다.
import com.example.batch.CatalogFaultRules.InvalidCatalogRowException;
import com.example.batch.CatalogFaultRules.LookupUnavailableException;
import com.example.batch.CatalogFaultRules.RowIssue;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.step.skip.SkipLimitExceededException;
import org.springframework.core.retry.RetryException;
import org.springframework.core.retry.RetryTemplate;
import static org.junit.jupiter.api.Assertions.*;

class CatalogFaultRulesTest {
    @Test
    void permitsTwoInvalidRowsButNotTheThird() {
        var policy = CatalogFaultRules.skipPolicy(); // 실제 Step과 같은 제외 정책이다.
        var invalid = new InvalidCatalogRowException(RowIssue.NEGATIVE_STOCK);
        assertTrue(policy.shouldSkip(invalid, 0)); // 첫 항목을 제외할 수 있다.
        assertTrue(policy.shouldSkip(invalid, 1)); // 두 번째 항목까지 허용한다.
        assertThrows(SkipLimitExceededException.class,
                () -> policy.shouldSkip(invalid, 2)); // 세 번째 오류는 한도를 초과한다.
        assertFalse(policy.shouldSkip(new LookupUnavailableException(), 0));
        // 조회 장애는 현재 skip 수가 적더라도 항목 누락으로 처리하지 않는다.
    }

    @Test
    void succeedsOnTheThirdCallWithinTwoRetries() {
        var template = new RetryTemplate(CatalogFaultRules.retryPolicy(Duration.ZERO));
        var calls = new AtomicInteger(); // 최초 호출도 호출 수에 포함한다.
        String result = template.execute(() -> {
            if (calls.incrementAndGet() <= 2) {
                throw new LookupUnavailableException(); // 처음 두 번만 일시 실패한다.
            }
            return "LOOKUP_OK"; // 세 번째는 값을 반환해 retry를 끝낸다.
        });
        assertEquals("LOOKUP_OK", result); // 성공 값이 상위 호출부로 돌아온다.
        assertEquals(3, calls.get()); // 최초 1 + retry 2라는 의미를 확인한다.
    }

    @Test
    void doesNotRetryAValidationFailure() {
        var template = new RetryTemplate(CatalogFaultRules.retryPolicy(Duration.ZERO));
        var calls = new AtomicInteger();
        RetryException error = assertThrows(RetryException.class, () -> template.execute(() -> {
            calls.incrementAndGet(); // 검증 오류의 추가 호출이 없는지 확인한다.
            throw new InvalidCatalogRowException(RowIssue.EMPTY_TITLE);
        }));
        assertEquals(1, calls.get()); // retry 허용 타입이 아니므로 최초 시도만 있다.
        assertInstanceOf(InvalidCatalogRowException.class, error.getCause());
        // wrapper만 검사하지 않고 실제 마지막 실패 원인도 구분한다.
    }

    @Test
    void exhaustsPersistentLookupFailuresAfterThreeCalls() {
        var template = new RetryTemplate(CatalogFaultRules.retryPolicy(Duration.ZERO));
        var calls = new AtomicInteger();
        RetryException error = assertThrows(RetryException.class, () -> template.execute(() -> {
            calls.incrementAndGet(); // 영구적으로 일시 장애 예외를 던지는 대역이다.
            throw new LookupUnavailableException();
        }));
        assertEquals(3, calls.get()); // 무한 반복하지 않고 정한 횟수에서 끝난다.
        assertInstanceOf(LookupUnavailableException.class, error.getCause());
    }
}
```

기존 프로젝트 루트에서 `./gradlew.bat test --tests com.example.batch.CatalogFaultRulesTest` 또는 `./mvnw.cmd -Dtest=CatalogFaultRulesTest test`로 실행한다. 예상 결과는 네 테스트 통과다. 정책 호출 횟수·분류 검사이며 Batch 안의 retry·DB commit이 함께 동작했다는 증거는 아니다.

통합 테스트에서 일시 장애를 만들려면 테스트 구성의 Processor를 대역으로 감쌀 수 있다. 다음은 테스트 클래스 안에 두는 **일부 메서드**다. `Book`, `ItemProcessor`, `AtomicInteger`, `LookupUnavailableException` import가 필요하며 운영 Processor를 이 메서드가 반환한 값으로 테스트 Step에 명시적으로 주입한다.

```java
static ItemProcessor<Book, Book> failLookupTwice(ItemProcessor<Book, Book> delegate) {
    AtomicInteger remaining = new AtomicInteger(2); // 테스트 대역 하나에서 두 번만 실패한다.
    return book -> {
        if (book.bookId().equals("B004") && remaining.getAndUpdate(n -> Math.max(0, n - 1)) > 0) {
            throw new LookupUnavailableException(); // DB에 쓰기 전 처리 단계에서 실패한다.
        }
        return delegate.process(book); // 한도를 소비한 뒤 실제 검증·변환을 수행한다.
    }; // 메모리 대역이며 프로세스 재시작 시 실패 수가 초기화된다는 제약이 있다.
}
```

다음 표의 시험은 각각 격리된 새 업무 키·새 입력·새 대역 상태로 진행한다. 실제 Batch·DB 테스트는 `@SpringBatchTest`·`JobOperatorTestUtils`를 활용할 수 있으며, 완료를 기다린 후 별도 연결로 업무 결과를 확인한다. [공식 Batch 테스트](https://docs.spring.io/spring-batch/reference/testing.html)

| 입력·장애 | 기대하는 관찰 | 검사 범위 |
| --- | --- | --- |
| 정상 7건 | 저장 7, skip 0 | 정상 경로 |
| B004 조회 대역이 두 번 실패 | 이후 성공, 저장 7, skip 0 | Step에 retry 정책이 실제 연결됨 |
| B004 조회 대역이 계속 실패 | 한 retry 실행 최대 3회 후 Step FAILED, skip 아님 | 소진·누락 방지 |
| 두 건의 음수 수량 | 저장 5, process skip 2, Step 검토 코드 | 허용한 제외·결과 대조 |
| 세 건의 음수 수량 | skip 한도 초과로 FAILED | 경계와 실패 묶음 rollback |
| stock가 `abc`·파일 없음·DB 중복 ID | 이번 정책에서 FAILED | 허용하지 않은 오류 |
| 실패 후 같은 Instance 재시작 | 앞의 확정 결과 유지, 새 실행의 수와 최종 결과 구분 | 체크포인트·영속 결과 |

실패 테스트에서는 Job FAILED만 검사하지 않고 실패 원인의 chain과 이미 commit한 행도 확인한다. 예외가 wrapper로 감싸졌다고 최상위 타입만 보고 전혀 다른 원인으로 분류하지 않는다. 특히 실패한 묶음의 전부·일부가 DB에 남지 않았는지는 실제 저장소에서 확인해야 한다.

## 4. 적용 관점에서 다시 보기

적용 순서는 업무의 누락 허용 기준을 먼저 정하고, 오류를 일시 장애·항목 검증·입력 형식·환경·DB 일관성으로 나누는 것이다. 그다음 좁은 예외 목록과 유한 retry·skip 정책을 연결한다. 횟수와 대기만 보고 안전성을 판단하지 않고 실제 호출의 timeout과 트랜잭션 경계도 확인한다.

도서 가져오기에서는 구조가 읽히는 항목의 명시적 검증 오류만 제외하고, 조회 일시 장애는 재시도 소진 시 실패하도록 했다. 실제 정책을 바꿀 때도 이처럼 각 오류가 왜 retry·skip·fail 중 하나인지 설명할 수 있어야 한다.

완료 결과는 Job 상태, Step 상태·종료 코드, 실행별 카운터, 날짜·원본 버전별 실제 DB 결과와 제외 이력으로 나누어 본다. 이번 listener의 로그와 검토 코드는 진단에 유용하지만 영속 누락 원장이나 최종 업무 승인을 대신하지 않는다. 재시작이 있었다면 마지막 실행만이 아니라 업무 전체의 확정 결과를 대조한다.

정책 단위 테스트를 먼저 만든 뒤 실제 파일·DB·실행 이력에서 같은 경계를 검사한다. 정상·retry 성공·retry 소진·skip 허용·한도 초과·허용하지 않은 예외·재시작을 서로 구분하면 실패 원인을 찾을 범위가 명확해진다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

retry는 회복 가능성이 있는 동작을 반복하고, skip은 업무가 허용한 항목 누락을 드러내며 진행한다. 제한을 지켜 COMPLETED가 되었어도 입력과 실제 반영·제외 결과를 확인해야 업무 성공을 판단할 수 있다.

### 5.2 이전·다음 학습과의 연결

[재시작·체크포인트 노트](../33_10_04_Spring_Batch_and_Restartability/10_04_Spring_Batch_and_Restartability.md)의 실행 경계에 오류 분류와 허용 누락의 관찰을 연결했다. 다음에는 **Spring Batch DB Reader·안정적인 페이징과 입력 스냅샷**을 학습해, 파일이 아니라 바뀔 수 있는 DB 데이터를 읽을 때 처리 대상과 재개 위치를 어떻게 유지하는지 살펴본다.

### 5.3 더 파볼 만한 주제

확정된 제외 원장과 별도의 결과 검증 Step, retry 지표·경고 임계값을 확장할 수 있다. 실제 DB 장애의 재실행에는 드라이버·트랜잭션 상태와 rollback 이후의 복구 경로를 따로 실험해야 한다.

### 5.4 참고 자료

- [Batch retry 설명](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/retry-logic.html), [skip 설명](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/configuring-skip.html): 일시 장애와 누락 허용의 차이.
- [Batch 6 변경점](https://docs.spring.io/spring-batch/reference/whatsnew.html), [Boot 의존성 표](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html): Framework 기반 retry와 기준 버전.
- [RetryPolicy.Builder](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/core/retry/RetryPolicy.Builder.html), [RetryTemplate](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/core/retry/RetryTemplate.html): 추가 시도 수·대기·소진 예외와 단위 검사.
- [SkipPolicy](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/skip/SkipPolicy.html), [한도 검사 정책](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/skip/LimitCheckingExceptionHierarchySkipPolicy.html): 허용 예외·skip 한도·음수 probe 계약.
- [ChunkOrientedStepBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/ChunkOrientedStepBuilder.html), [6.0.5 chunk 구현](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/step/item/ChunkOrientedStep.java): 정책 연결과 실행·트랜잭션 위치.
- [SkipListener](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/listener/SkipListener.html), [StepExecutionListener](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/listener/StepExecutionListener.html): 제외 콜백·afterStep의 역할과 제약.
- [StepExecution](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/StepExecution.html), [Step 흐름](https://docs.spring.io/spring-batch/reference/step/controlling-flow.html), [Batch 테스트](https://docs.spring.io/spring-batch/reference/testing.html): 카운터·상태·종료 코드와 검사 범위.
- [PostgreSQL 트랜잭션](https://www.postgresql.org/docs/17/tutorial-transactions.html): 오류 뒤 transaction 복구가 단순 반복과 다른 이유.

## 6. 요약 정리

1. retry·skip·filter·restart는 각각 반복·오류 항목 제외·정상 대상 선택·새 시도의 진행 복원이다.
2. 일시 장애인지와 반복해도 안전한지는 별도로 확인한다.
3. Framework의 maxRetries 2는 최초 호출을 포함해 한 retry 실행에서 최대 3회다.
4. skip 한도는 chunk별·단계별 오류 유형별 한도가 아니라 해당 StepExecution의 제외 합계를 기준으로 한다.
5. 허용한 예외 목록은 좁게 두고, 조회 장애 소진을 항목 누락으로 숨기지 않는다.
6. retry 자체가 새로운 DB 트랜잭션이나 외부 효과의 취소를 보장하지 않는다.
7. SkipListener 로그·Step 종료 코드는 진단 자료이며 확정 누락 원장·업무 승인이 아니다.
8. 실행별 카운터와 재시작을 포함한 최종 DB 결과를 구분해 대조한다.
9. 정책 검사와 실제 Batch·DB·rollback·재시작 검증을 각각 수행한다.

🧠 기억할 것: “다시 하면 성공할까, 빠져도 되는가, 실제로 무엇이 반영됐는가”를 각각 확인한다.

## 7. 미니 퀴즈 또는 체크리스트

1. maxRetries 2로 감싼 동작이 계속 실패한다면 최초 시도를 포함해 몇 번 호출되는가? Job 전체의 상한도 같은가?
2. skip 한도 2에서 두 항목을 제외한 뒤 세 번째 허용 오류가 발생하면 어떻게 되는가?
3. 음수 수량을 만났을 때 Processor의 null 반환과 검증 예외를 통한 skip은 보고 의미가 어떻게 다른가?
4. Step이 COMPLETED이고 skip 2·write 5다. 입력 7건이 모두 정상 반영됐다고 설명할 수 있는가?
5. 재시작 후 마지막 실행의 writeCount는 4인데 업무 테이블에는 7행이 있다. 가능한 이유와 확인할 자료는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 한 retry 실행에서는 최초 1회와 추가 2회로 최대 3회다. 항목 수·재시작·다른 실행이 있으므로 Job 전체 호출 상한과 같지 않다. retry 대상이 아닌 예외라면 추가 시도하지 않는다.
2. 한도를 넘겨 Step이 실패한다. 한 묶음마다 두 건을 허용하는 의미가 아니며, 현재 StepExecution의 누적 제외 수와 이번 오류를 함께 판단한다.
3. null은 오류가 아닌 filter로 계산된다. 명시적 검증 예외는 잘못된 입력을 나타내며 정책이 허용한 경우 skip으로 계산한다. 오류를 정상 대상 제외처럼 보고해서는 안 된다.
4. 아니다. 처리 흐름이 정한 정책으로 완료했고 두 건이 제외된 결과다. 실제 저장 ID·제외 원인·허용 누락 기준을 대조해 업무 승인 여부를 결정한다.
5. 이전 실행에서 이미 3행을 commit하고 새 실행이 나머지 4행을 저장했을 수 있다. 실행 이력·원본 버전·최종 DB 결과를 함께 확인하고 마지막 실행 카운터를 전체 결과로 사용하지 않는다.

</details>
