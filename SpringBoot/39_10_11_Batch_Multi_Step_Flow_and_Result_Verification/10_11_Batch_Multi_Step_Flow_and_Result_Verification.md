# Spring Batch 다단계 Job·조건부 흐름과 결과 검증 Step

- 🎯 글의 목표: 적재·결과 검증·후속 처리를 Step으로 나누고, 종료 코드에 따른 분기와 재시작 시 실행 범위를 설명한다.
- 🧩 핵심 키워드: TaskletStep, StepContribution, ExitStatus, 조건부 전이, end·fail·stopAndRestart, allowStartIfComplete, 결과 대조
- ⭐ 중요도: 높음. 적재 코드의 정상 종료와 업무 결과의 정확성을 구분하고, 검증 실패가 후속 작업으로 전파되지 않게 해야 한다.
- 📝 한눈에 보는 내용: 단계별 책임 → 검증 기준 → SQL·Tasklet → 조건부 Job 구성 → 재시작 정책 → 실패 경로 테스트
- 🔗 관련 주제: [운영·실행 제어와 장애 복구](../38_10_09_Batch_Operations_and_Failure_Recovery/10_09_Batch_Operations_and_Failure_Recovery.md), [입력 스냅샷](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md), [통합 테스트](../37_10_08_Batch_Integration_Testing_and_Restart_Verification/10_08_Batch_Integration_Testing_and_Restart_Verification.md)
- 🧱 선수 지식: JobInstance·JobExecution, chunk의 commit·rollback, JDBC·SQL JOIN, 발행한 입력 보존, 생성자 주입

> 기준일: 2026-10-11. 예제 기준은 Java 17 이상·Spring Batch 6.0.5·PostgreSQL 17이다. 기존 JDBC Batch 프로젝트에 추가하는 파일이며 독립 실행 프로젝트가 아니다. 공식 문서·API를 확인했다. 현재 PATH의 Java는 8이고 javac·Maven·Gradle 및 Java 빌드 프로젝트가 없어 컴파일·JUnit·PostgreSQL 통합 시험은 실행하지 않았다. 아래 실행 결과는 예상 결과다.

## 1. 들어가며

일곱 도서의 스냅샷을 읽어 적재하는 작업이 COMPLETED로 끝났다고 생각해 보자. 다음 작업은 이 결과를 이용해 보고서를 만든다. 그런데 실제 결과에는 도서 하나가 빠지고 다른 도서가 잘못 들어가도 전체 건수는 일곱일 수 있다.

Reader·Writer가 예외 없이 끝났다는 사실만으로 모든 업무 검증이 끝난 것은 아니다. 처리 후 **이번 입력과 결과의 식별자·변환 값이 일치하는지** 확인하고, 확인한 경우에만 후속 단계로 넘어갈 필요가 있다.

이전 노트는 운영자가 실행 상태를 읽고 안전하게 중지·복구하는 판단을 다뤘다. 이번에는 그 판단의 일부를 Job 안의 별도 검증 Step으로 연결한다. 기존 입력과 적재 Step을 재사용하되 새 Job 이름을 사용하여, 과거의 단일 Step 실패 이력에 새로운 흐름을 끼워 넣지 않는다.

## 2. 핵심 개념 정리

| 단계 또는 결정 | 역할 | 확인할 질문 |
| --- | --- | --- |
| 적재 Step | 입력을 읽고 결과를 묶음 단위로 저장 | 어느 chunk까지 확정했는가? |
| 검증 Step | 발행 입력과 실제 결과 대조 | 누락·추가·값 오류가 있는가? |
| 조건부 전이 | 종료 코드에 맞는 경로 선택 | 정상·빈 입력·실패를 어디로 보낼 것인가? |
| 후속 Step | 검증 뒤의 작업 수행 | 검증되지 않은 결과로 진행하지 않는가? |
| 재시작 정책 | 각 단계의 재실행 범위 결정 | 완료한 적재와 완료한 검증을 똑같이 다룰 것인가? |

```text
snapshotImportStep
  ├─ COMPLETED → catalogResultCheckStep
  │                 ├─ VERIFIED → catalogFollowUpStep → Job 완료
  │                 ├─ EMPTY_INPUT → 후속 단계 생략 → Job 완료(NO_DATA)
  │                 └─ FAILED → Job 실패
  └─ FAILED → Job 실패, 검증·후속 단계 미실행
```

그림은 기본 업무 흐름이다. 중지 경로도 코드에서 별도로 정의하며, 중지된 실행을 자동 재시작하는 의미는 아니다.

## 3. 본문 정리

### 3.1 Step은 책임과 복구 지점을 나누는 단위다

**Step은 Job 안에서 실행 이력·상태를 가지는 처리 단계**다. 하나의 큰 메서드에 적재·검증·후속 작업을 모두 넣으면 어느 책임에서 실패했는지와 무엇을 다시 실행할지 구분하기 어렵다. 단계를 나누면 적재 성공 뒤 검증 실패라는 사실을 별도 Step 이력으로 남길 수 있다.

이번 흐름에서 적재는 기존 `snapshotImportStep`, 검증은 `catalogResultCheckStep`, 후속 처리는 `catalogFollowUpStep`이 담당한다. 후속 예제는 경로 도달을 보여 주는 로그만 남기며 실제 보고서·이메일·외부 발행을 구현하지 않는다.

**Job 전체가 하나의 거대한 트랜잭션인 것은 아니다.** 적재 Step의 앞선 chunk가 commit된 뒤 검증 Step에서 예외가 나도 이미 확정한 적재 결과가 전부 rollback되지는 않는다. 검증 실패는 다음 단계 진입을 막고 조사 근거를 남기는 역할이다. [TaskletStep의 트랜잭션 경계](https://docs.spring.io/spring-batch/reference/step/tasklet.html)

순차 흐름은 성공한 단계 뒤 다음 단계를 연결한다. 조건부 흐름은 종료 의미에 따라 경로를 나눈다. 여기서는 “검증에 성공한 비어 있지 않은 입력”과 “정상적인 빈 입력”을 구분해야 하므로 조건부 흐름을 사용한다. [Step 흐름 제어](https://docs.spring.io/spring-batch/reference/step/controlling-flow.html)

### 3.2 처리 건수가 아니라 같은 업무의 결과를 대조한다

**결과 대조는 기대한 입력의 변환 결과와 실제 저장 결과를 비교하는 검증**이다. 이번 예제는 입력 한 행이 결과 한 행이 되는 구성이고 retry·skip·filter·병렬 실행은 켜지 않는다. 이 조건에서 필요한 기준은 다음과 같다.

1. 스냅샷 명세가 존재하고 ready가 true다.
2. 발행 당시 명세의 건수와 현재 보존된 입력 건수가 같다.
3. 해당 업무 날짜·결과 버전의 결과 건수가 입력 건수와 같다.
4. 양쪽 도서 ID 집합이 같고 변환한 제목·수량이 같다.

입력 ID가 A·B인데 결과 ID가 A·C라면 건수는 2로 같아도 B의 누락과 C의 추가가 있다. ID가 모두 같아도 B의 수량이 4가 아니라 40이면 값 오류다. 이 두 경우를 잡으려면 count만으로는 부족하다.

기존 테이블 구조는 [입력 스냅샷 노트 3.5](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md)와 [적재 결과 테이블](../33_10_04_Spring_Batch_and_Restartability/10_04_Spring_Batch_and_Restartability.md)을 사용한다. 결과의 기본키는 `(business_date, source_revision, book_id)`다. 따라서 다른 날짜나 다른 버전의 정상 결과를 이번 입력에 섞지 않는다.

이번 검증 SQL은 실습 입력의 ID·제목 앞뒤 공백을 일반 공백 `U+0020`으로 제한하고 PostgreSQL `btrim`으로 정리한다. 기존 Java Processor의 `strip()`은 더 넓은 공백 규칙을 사용하므로 모든 Unicode 공백에서 두 함수가 같다는 뜻이 아니다. 탭·Unicode 공백 등을 허용하는 프로젝트에서는 동일한 업무 변환 규칙으로 기대값을 만드는 검증을 별도로 구현·시험한다. [PostgreSQL 문자열 함수](https://www.postgresql.org/docs/17/functions-string.html)

⚠️ 주의: 건수·ID·값이 지금 같다고 해서 스냅샷 전체의 영구 불변성이 증명된 것은 아니다. 입력 발행 후 수정·삭제를 막는 운영 규칙과 접근 통제는 유지해야 한다. 검증 전후에 다른 작업이 같은 결과 범위를 수정하지 않는 것도 이번 예제의 전제다.

### 3.3 FULL OUTER JOIN으로 누락·추가·값 오류를 함께 찾는다

**FULL OUTER JOIN은 두 집합을 연결하면서 어느 한쪽에만 있는 행도 남기는 조인**이다. 왼쪽 입력만 남기는 조인으로는 결과에만 들어간 불필요한 행을 놓칠 수 있어 양쪽을 모두 보존한다. 연결할 도서 ID가 없으면 해당 쪽의 컬럼이 NULL로 나타난다. [PostgreSQL 조인](https://www.postgresql.org/docs/17/queries-table-expressions.html)

아래 SQL은 다음 Tasklet 파일의 `CHECK_SQL` 상수에 한 번만 제시한다. `expected`는 정리한 입력, `actual`은 이번 업무의 결과, `differences`는 두 집합에서 맞지 않는 행이다. 이런 이름 붙인 임시 조회 집합을 **CTE(Common Table Expression)**라고 하며 `WITH`로 선언한다. 새로운 영구 테이블을 생성하는 문법이 아니다.

`IS DISTINCT FROM`은 NULL까지 고려해 두 값이 다른지 판정한다. 일반 `<>`는 NULL과 비교하면 true가 아니라 알 수 없는 값이 될 수 있어 차이를 놓칠 수 있다. 이번 SQL은 누락·추가를 ID의 NULL 여부로 확인하고 값 차이는 이 비교식으로 확인한다. [PostgreSQL 비교 연산](https://www.postgresql.org/docs/17/functions-comparison.html)

네 개의 `?`에는 순서대로 snapshot ID, 업무 날짜, 결과 버전, 명세 조회의 snapshot ID를 바인딩한다. 바인딩은 SQL 문자열에 값을 이어 붙이지 않고 JDBC에 별도로 전달하는 방식이다. 이로써 조회 범위가 명확해지고 입력값이 SQL 문법으로 해석되는 것을 막는다.

하나의 SELECT 안에서 입력·결과·명세를 비교한다. PostgreSQL 기본 Read Committed의 한 문장이 보는 확정 상태를 기준으로 하며, 이후 다른 트랜잭션이 바꾸는 값까지 잠그지는 않는다. 대량 데이터의 JOIN·집계 비용도 발생하므로 실제 크기에서 실행 계획·시간 제한을 확인해야 한다. [트랜잭션 격리](https://www.postgresql.org/docs/17/transaction-iso.html)

### 3.4 Tasklet으로 검증 결과를 종료 코드에 연결한다

**Tasklet은 Step 안에서 특정 작업을 수행하는 계약**이다. 항목마다 Reader·Processor·Writer를 연결하는 대신 한 번의 결과 대조처럼 명확한 작업에 사용할 수 있다. `execute`의 호출은 트랜잭션 경계 안에서 수행되며, 정상 종료는 RepeatStatus, 실패는 예외로 알린다. [Tasklet API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/tasklet/Tasklet.html)

**RepeatStatus.FINISHED는 Tasklet 호출 반복을 끝낸다는 값**이지 업무 분기 코드가 아니다. 업무 의미는 StepContribution의 ExitStatus에 넣는다. StepContribution은 이번 호출이 Step 실행에 반영할 상태·처리 수 등을 담는 객체다. 아래에서는 처리 수를 임의로 증가시키지 않고 검증 종료 코드만 설정한다. [RepeatStatus](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/repeat/RepeatStatus.html), [StepContribution](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/StepContribution.html)

아래는 `src/main/java/com/example/batch/CatalogResultCheckTasklet.java`에 추가하는 **기존 프로젝트용 파일**이다. 필요한 테이블을 준비한 JDBC 프로젝트에서 사용한다. 입력은 JDBC 연결 도구, snapshot ID, 업무 날짜, 결과 버전이며 조회한 집계값을 VerificationReport에 담아 판단한다.

```java
package com.example.batch; // 기존 Batch 프로젝트의 패키지다.

import java.sql.Date; // PostgreSQL date 컬럼에 JDBC 날짜를 전달한다.
import java.time.LocalDate; // 업무 날짜 문자열을 날짜로 파싱한다.
import java.util.List; // 명세 조회 결과가 정확히 한 행인지 확인한다.
import org.springframework.batch.core.ExitStatus; // 조건부 흐름에서 사용할 종료 코드를 담는다.
import org.springframework.batch.core.step.StepContribution; // 이번 Tasklet의 종료 의미를 Step에 전달한다.
import org.springframework.batch.core.scope.context.ChunkContext; // Tasklet 호출에 전달되는 실행 문맥이다.
import org.springframework.batch.core.step.tasklet.Tasklet; // 검증 작업의 실행 계약이다.
import org.springframework.batch.infrastructure.repeat.RepeatStatus; // 반복 종료 신호다.
import org.springframework.jdbc.core.JdbcTemplate; // 바인딩·ResultSet 처리를 연결한다.

public class CatalogResultCheckTasklet implements Tasklet {
    private static final String CHECK_SQL = """
            WITH expected AS (
                SELECT btrim(book_id) AS book_id, btrim(title) AS title, stock
                FROM catalog_input_snapshot
                WHERE snapshot_id = ? -- 첫 번째 값: 보존한 입력 버전을 제한한다.
            ), actual AS (
                SELECT book_id, title, stock
                FROM catalog_import
                WHERE business_date = ? AND source_revision = ? -- 두 번째·세 번째: 결과 범위다.
            ), differences AS (
                SELECT e.book_id AS expected_id, a.book_id AS actual_id
                FROM expected e FULL OUTER JOIN actual a ON a.book_id = e.book_id
                WHERE e.book_id IS NULL OR a.book_id IS NULL -- 추가 또는 누락된 ID다.
                   OR e.title IS DISTINCT FROM a.title -- 같은 ID의 제목 차이를 확인한다.
                   OR e.stock IS DISTINCT FROM a.stock -- 같은 ID의 수량 차이를 확인한다.
            )
            SELECT m.ready, m.item_count,
                   (SELECT count(*) FROM expected) AS input_count,
                   (SELECT count(*) FROM actual) AS output_count,
                   (SELECT count(*) FROM differences) AS difference_count
            FROM catalog_snapshot_manifest m
            WHERE m.snapshot_id = ? -- 네 번째 값: 같은 입력의 발행 명세다.
            """;
    // Java text block 안의 주석은 SQL 주석이다. 입력과 결과는 이 한 문장으로 비교한다.

    private final JdbcTemplate jdbc; // Step 트랜잭션에 참여하는 같은 DataSource를 사용한다.
    private final String snapshotId; // Reader와 동일한 발행 입력의 식별자다.
    private final Date businessDate; // Writer가 결과를 저장한 업무 날짜다.
    private final String sourceRevision; // Writer가 사용한 결과 버전이다.

    public CatalogResultCheckTasklet(JdbcTemplate jdbc, String snapshotId,
                                    String businessDate, String sourceRevision) {
        this.jdbc = jdbc; // 구성 클래스에서 연결한 JDBC 도구를 보관한다.
        this.snapshotId = snapshotId; // 실행 시의 입력 버전을 유지한다.
        this.businessDate = Date.valueOf(LocalDate.parse(businessDate)); // 잘못된 날짜 형식은 거절한다.
        this.sourceRevision = sourceRevision; // 다른 결과 버전을 비교에 섞지 않는다.
    }

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        List<VerificationReport> reports = jdbc.query(CHECK_SQL,
                (rs, row) -> new VerificationReport(
                        rs.getBoolean("ready"), rs.getLong("item_count"), // 발행 상태·기대 건수다.
                        rs.getLong("input_count"), rs.getLong("output_count"), // 실제 두 집합의 크기다.
                        rs.getLong("difference_count")), // ID·값이 다른 연결 행의 수다.
                snapshotId, businessDate, sourceRevision, snapshotId); // SQL의 ? 순서를 맞춘다.
        if (reports.size() != 1) {
            throw new IllegalStateException("검증할 입력 명세를 한 개 찾지 못했습니다.");
            // 없는 입력을 건수 0인 정상 업무로 처리하지 않는다.
        }
        String exitCode = reports.get(0).exitCode(); // 불일치라면 여기서 예외가 발생한다.
        contribution.setExitStatus(new ExitStatus(exitCode)); // VERIFIED 또는 EMPTY_INPUT을 전달한다.
        return RepeatStatus.FINISHED; // 검증 호출을 더 반복하지 않는다.
    }

    public record VerificationReport(boolean ready, long declaredCount, long inputCount,
                                     long outputCount, long differenceCount) {
        public String exitCode() {
            if (!ready || declaredCount < 0 || inputCount < 0 || outputCount < 0
                    || differenceCount < 0 || declaredCount != inputCount
                    || inputCount != outputCount || differenceCount != 0) {
                throw new IllegalStateException("발행 입력과 적재 결과가 검증 기준에 맞지 않습니다.");
                // 예외를 던져 Step이 실패하고 후속 작업에 진입하지 못하게 한다.
            }
            return inputCount == 0 ? "EMPTY_INPUT" : "VERIFIED";
            // 발행된 빈 입력은 정상 별도 경로, 데이터가 있으면 검증 성공 경로다.
        }
    }
}
```

명세가 없으면 SELECT 결과는 0행이고 execute에서 실패한다. 명세는 있지만 아직 ready가 false이면 VerificationReport의 판단이 실패한다. ready=true·명세 7·입력 7·결과 7·차이 0이면 VERIFIED, 네 건수가 모두 정상적인 0이면 EMPTY_INPUT을 설정한다.

여기서 differenceCount는 “틀린 필드 개수”가 아니라 조인 결과에서 차이가 있는 행 수다. 같은 도서에서 제목·수량이 모두 틀려도 한 행으로 센다. 이번 입력·결과의 고유 ID 조건을 유지해야 이 비교의 의미가 안정적이다.

예외를 삼키고 FINISHED만 반환하면 검증 실패를 정상 처리로 바꾸는 셈이 된다. DB 연결·SQL 오류도 정상적인 빈 입력으로 변환하지 않는다. 구체적인 차이 조사에는 같은 업무 범위의 제한된 조회를 사용하고 원본 데이터를 공개 로그에 모두 남기지 않는다.

### 3.5 종료 코드로 안전한 분기를 구성한다

**BatchStatus는 실행 생명주기 상태, ExitStatus는 종료 의미를 담는 값**이다. 정상적인 검증 Step의 BatchStatus는 COMPLETED일 수 있고 ExitStatus는 VERIFIED일 수 있다. `on("VERIFIED")`는 BatchStatus가 아니라 ExitStatus의 코드를 비교한다. [조건부 전이의 비교 대상](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/job/builder/FlowBuilder.html)

아래는 `src/main/java/com/example/batch/VerifiedCatalogJobConfiguration.java`에 추가하는 **기존 프로젝트용 구성 파일**이다. 기존 `snapshotImportStep` Bean과 같은 JDBC JobRepository·DataSource·JdbcTransactionManager를 사용한다. Spring 컨텍스트의 기존 인프라 구성은 다시 등록하지 않는다.

StepScope는 Step 실행 시점의 문맥을 사용하는 범위다. 여기서는 singleton 구성 생성 시점이 아니라 실행할 때 Job 파라미터를 읽어 Tasklet을 만든다. 재시작에도 같은 파라미터로 검증하며, 관련 Bean 메서드를 직접 호출하지 않고 인자로 주입받아 동일한 Step 객체를 흐름에 연결한다. [StepScope API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/configuration/annotation/StepScope.html)

```java
package com.example.batch; // Tasklet과 같은 패키지에 둔다.

import javax.sql.DataSource; // JDBC 표준 타입이며 jakarta.sql로 바꾸지 않는다.
import org.slf4j.Logger; // 후속 경로 도달을 관찰하는 로그 인터페이스다.
import org.slf4j.LoggerFactory; // 클래스별 로그 객체를 만든다.
import org.springframework.batch.core.configuration.annotation.StepScope; // 실행 파라미터를 늦게 연결한다.
import org.springframework.batch.core.job.Job; // 조건부 Job의 반환 타입이다.
import org.springframework.batch.core.job.builder.JobBuilder; // Job의 단계와 전이를 구성한다.
import org.springframework.batch.core.job.parameters.DefaultJobParametersValidator; // 필요한 키를 검사한다.
import org.springframework.batch.core.repository.JobRepository; // 실행·Step 이력을 보존한다.
import org.springframework.batch.core.step.Step; // 주입받을 Step 타입이다.
import org.springframework.batch.core.step.builder.StepBuilder; // TaskletStep을 구성한다.
import org.springframework.batch.core.step.tasklet.Tasklet; // 검증 Bean과 후속 람다의 계약이다.
import org.springframework.batch.infrastructure.repeat.RepeatStatus; // 후속 호출의 반복을 끝낸다.
import org.springframework.beans.factory.annotation.Qualifier; // 같은 타입의 여러 Step을 이름으로 구분한다.
import org.springframework.beans.factory.annotation.Value; // Job 파라미터를 실행 문맥에서 읽는다.
import org.springframework.context.annotation.Bean; // 구성 객체를 Spring에 등록한다.
import org.springframework.context.annotation.Configuration; // Bean 정의를 담는 구성 클래스다.
import org.springframework.jdbc.core.JdbcTemplate; // 검증 SQL에 사용할 JDBC 도구다.
import org.springframework.jdbc.support.JdbcTransactionManager; // 동일 DB의 Tasklet 트랜잭션을 연결한다.

@Configuration(proxyBeanMethods = false) // 다른 @Bean 메서드를 직접 호출하지 않고 주입을 사용한다.
public class VerifiedCatalogJobConfiguration {
    private static final Logger log = LoggerFactory.getLogger(VerifiedCatalogJobConfiguration.class);
    // 로그는 경로 도달 확인용이며 외부 전송 성공이나 보고서 저장을 뜻하지 않는다.

    @Bean
    @StepScope
    public Tasklet catalogResultCheckTasklet(DataSource dataSource,
            @Value("#{jobParameters['snapshotId']}") String snapshotId,
            @Value("#{jobParameters['businessDate']}") String businessDate,
            @Value("#{jobParameters['sourceRevision']}") String sourceRevision) {
        return new CatalogResultCheckTasklet(new JdbcTemplate(dataSource),
                snapshotId, businessDate, sourceRevision); // Reader·Writer와 같은 업무 범위를 전달한다.
    }

    @Bean
    public Step catalogResultCheckStep(JobRepository repository, JdbcTransactionManager transactionManager,
            @Qualifier("catalogResultCheckTasklet") Tasklet tasklet) {
        return new StepBuilder("catalogResultCheckStep", repository)
                .tasklet(tasklet, transactionManager) // 검증 호출을 DB 트랜잭션에 연결한다.
                .allowStartIfComplete(true) // Job 재시작 경로가 이 Step을 방문하면 완료 검증도 다시 실행한다.
                .build(); // 검증 Step 정의를 만들며 여기서 SQL을 실행하지 않는다.
    }

    @Bean
    public Step catalogFollowUpStep(JobRepository repository, JdbcTransactionManager transactionManager) {
        return new StepBuilder("catalogFollowUpStep", repository)
                .tasklet((contribution, context) -> {
                    log.info("검증한 적재 결과의 후속 경로에 도달했습니다."); // 학습용 관찰만 수행한다.
                    return RepeatStatus.FINISHED; // 반복 실행을 요청하지 않는다.
                }, transactionManager)
                .build(); // 실제 이메일·파일·외부 요청은 이 예제에 없다.
    }

    @Bean
    public Job verifiedCatalogJob(JobRepository repository,
            @Qualifier("snapshotImportStep") Step importStep,
            @Qualifier("catalogResultCheckStep") Step checkStep,
            @Qualifier("catalogFollowUpStep") Step followUpStep) {
        String[] required = {"businessDate", "sourceRevision", "snapshotId"}; // 기존 적재의 필수 키다.
        return new JobBuilder("verifiedCatalogJob", repository) // 기존 단일 Step Job과 이력을 분리한다.
                .validator(new DefaultJobParametersValidator(required, new String[0])) // 키 존재를 검사한다.
                .start(importStep).on("COMPLETED").to(checkStep) // 정상 적재 뒤에만 검증한다.
                .from(importStep).on("STOPPED").stopAndRestart(importStep) // 중지 후 재개 위치를 지정한다.
                .from(importStep).on("*").fail() // 나머지 적재 종료는 성공으로 넘기지 않는다.
                .from(checkStep).on("VERIFIED").to(followUpStep) // 검증한 비어 있지 않은 결과다.
                .from(checkStep).on("EMPTY_INPUT").end("NO_DATA") // 빈 입력은 후속 처리 없이 완료한다.
                .from(checkStep).on("STOPPED").stopAndRestart(checkStep) // 다음 재시작의 진입점이다.
                .from(checkStep).on("*").fail() // 실패·예상 밖 코드는 Job 실패로 끝낸다.
                .from(followUpStep).on("COMPLETED").end() // 후속 단계까지 정상 종료한 업무다.
                .from(followUpStep).on("STOPPED").stopAndRestart(followUpStep) // 중지 시 재개 위치다.
                .from(followUpStep).on("*").fail() // 후속 실패를 숨기지 않는다.
                .end() // 전이 정의를 닫고 Job builder로 돌아간다. 위의 전이 end와 역할이 다르다.
                .build(); // 구성한 Job을 반환한다. 실제 시작은 JobOperator가 수행한다.
    }
}
```

`from(checkStep)`는 실행을 지금 되돌리는 명령이 아니라 같은 출발점의 다른 전이를 선언하는 문법이다. `on("*")`는 알 수 없는 코드를 모두 정상으로 보내는 용도가 아니라 안전하게 실패시키는 최종 경로다. `STOPPED`·`VERIFIED`처럼 구체적인 패턴이 wildcard보다 우선되며, 정의하지 않은 종료 코드는 흐름 오류가 될 수 있다. [FlowBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/job/builder/FlowBuilder.html)

기존 적재에 사용자 정의 성공 코드를 추가했다면 `COMPLETED`와 다른 코드가 되어 실패 경로에 들어갈 수 있다. 그때는 의미를 검토해 허용할 성공 코드를 명시적으로 추가한다. 예상 밖 코드를 모두 후속 처리로 보내며 문제를 감추지 않는다.

파라미터 validator는 키 존재를 검사하는 것이지 문자열 내용·업무 권한·날짜 범위까지 검증하는 장치가 아니다. 보호된 호출부에서 값·입력 발행 상태·중복 업무를 검사하고, Job을 선택할 때 `@Qualifier("verifiedCatalogJob")`을 사용한다. 이전 운영 서비스가 `snapshotImportJob`만 제어하도록 제한되어 있으므로 새 Job에 그대로 적용하지 않는다. [파라미터 validator API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/job/parameters/DefaultJobParametersValidator.html)

⚠️ 주의: 새 Job 이름은 Batch 이력의 식별을 나누지만 결과 테이블의 기본키를 바꾸지는 않는다. 과거 단일 Step Job이 이미 같은 날짜·버전으로 저장한 결과가 있는데 새 Job을 시작하면 중복 INSERT가 발생할 수 있다. 실습에는 독립된 입력 버전·결과 범위를 준비하고, 기존 실패 업무를 새 Job 이름으로 우회하지 않는다. 여러 Job Bean이 등록된 프로젝트에서는 기존 시작 설정·호출부에서도 실행할 Job을 명시적으로 선택한다.

### 3.6 end·fail·stopAndRestart는 재시작 가능성을 바꾼다

**전이의 종료 동작은 Job을 어떤 상태로 끝낼지 정하는 정책**이다. Step이 실패해도 전이에서 정상 종료를 지정하면 Job은 완료될 수 있다. 따라서 실패를 관찰하는 운영 화면에서는 Job 상태와 개별 Step 상태를 함께 읽어야 한다.

| 전이 정의 | Job의 의미 | 이후 처리 |
| --- | --- | --- |
| `on(code).end()` | COMPLETED로 종료 | 같은 완료 Instance를 재시작하지 않음 |
| `on(code).end("NO_DATA")` | BatchStatus COMPLETED·Job ExitStatus NO_DATA | 빈 입력을 정상 종료한 이력으로 남김 |
| `on(code).fail()` | FAILED로 종료 | 원인 해결 뒤 같은 업무 재시작 검토 |
| `on(code).stopAndRestart(step)` | STOPPED로 종료·재개 위치 지정 | 별도 restart 요청 때 지정한 경로에서 진행 |

`stopAndRestart`가 다른 실행을 즉시 시작하는 것은 아니다. 계획된 흐름의 중지·재개 위치를 선언하는 API이고, 앞 노트의 JobOperator.stop은 실행 중인 작업에 중지를 요청하는 운영 API다. 이름에 stop이 있어도 같은 호출이 아니다. [전이 종료 API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/job/builder/FlowBuilder.TransitionBuilder.html)

⚠️ 주의: 검증 실패를 `on("FAILED").end()`로 처리하면 Job을 완료시켜 같은 Instance의 정상적인 재시작을 막을 수 있다. 이번 검증 불일치는 조사·복구 대상이므로 fail 경로로 남긴다. 새 Instance를 만들어 실패를 우회하면 입력과 결과가 겹칠 수 있다.

### 3.7 재시작에서 적재와 검증을 다르게 취급한다

**allowStartIfComplete는 재시작 경로에서 방문한 완료 Step을 다시 실행할지 정하는 옵션**이다. 기본적으로 완료 Step은 재수행하지 않는다. 여기서는 적재를 다시 INSERT하면 중복 위험이 있으므로 기존 설정을 유지하고, 읽기 전용 검증은 완료됐어도 다시 확인하도록 true를 사용한다. [Step 재시작 설정](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/restart.html)

| 첫 실패 위치 | 이미 남은 것 | 같은 JobInstance를 재시작할 때의 기대 |
| --- | --- | --- |
| 적재 중간 | 확정한 chunk·실패 Step 이력 | 기존 Reader 상태로 적재 재개 후 검증 |
| 검증 단계 | 전체 적재 결과·검증 FAILED | 완료 적재를 반복하지 않고 검증 재수행 |
| 후속 단계 | 적재 완료·검증 완료·후속 FAILED | 검증을 다시 확인한 뒤 후속 단계 재수행 |

실패 후에는 Job 정의·Step 이름·입력·파라미터를 유지한다. 새 Execution ID는 생기지만 같은 Instance여야 한다. 검증 실패 원인이 잘못된 업무 데이터라면 실패했다고 무조건 같은 작업을 반복하지 않고 입력·결과 정정 또는 보상을 승인된 절차로 판단한다.

allowStartIfComplete는 그래프에 들어오지 않는 Step까지 강제로 호출하지 않는다. 위 Job에서 후속 단계의 STOPPED 전이는 후속 Step을 재개 위치로 직접 지정한다. 이 중지 경로에서는 앞 검증 Step을 다시 방문하지 않을 수 있다. 따라서 “모든 restart에서 항상 검증한다”는 보장이 아니며, 검증 후 결과 불변성을 유지하거나 재개 위치를 검증부터 시작하도록 정책을 바꿔 시험해야 한다.

같은 이유로 완료 Job을 다시 실행하게 만드는 옵션도 아니다. 빈 입력이 정상 완료된 뒤 새로운 데이터를 같은 snapshot에 붙이지 않는다. 새 발행 입력이라면 새 업무 버전과 새 Instance로 관리한다.

외부 이메일·메시지를 후속 단계에 추가하면 Step의 DB rollback이 이미 전달한 외부 효과를 취소하지 않는다. 완료 Step을 재실행하는 설정을 쓰기 단계에 일괄 적용하지 않고 [멱등성](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md)·[Outbox](../25_09_23_Transactional_Outbox_and_Event_Publishing/09_23_Transactional_Outbox_and_Event_Publishing.md)와 연결한다.

### 3.8 판단 로직과 실제 흐름을 나눠 시험한다

아래는 `src/test/java/com/example/batch/VerificationReportTest.java`에 추가하는 **JUnit Jupiter 단위 테스트 파일**이다. 앞 파일의 집계 판단만 직접 호출하며 SQL·Flow·재시작은 실행하지 않는다. 기존 프로젝트의 JUnit 의존성이 필요하고, 여기서는 실행하지 않았다.

```java
package com.example.batch; // 검증 파일과 같은 프로젝트에 둔다.

import org.junit.jupiter.api.Test; // JUnit 테스트 메서드를 표시한다.
import com.example.batch.CatalogResultCheckTasklet.VerificationReport; // DB 결과를 표현하는 값 객체다.
import static org.junit.jupiter.api.Assertions.assertEquals; // 반환 종료 코드가 기대와 같은지 확인한다.
import static org.junit.jupiter.api.Assertions.assertThrows; // 불일치가 예외로 거절되는지 확인한다.

class VerificationReportTest {
    @Test
    void equalNonEmptyDataIsVerified() {
        var report = new VerificationReport(true, 7, 7, 7, 0); // 발행·입력·결과·차이가 모두 정상이다.
        assertEquals("VERIFIED", report.exitCode()); // 후속 단계로 갈 수 있는 코드다.
    }

    @Test
    void publishedEmptyInputHasItsOwnCode() {
        var report = new VerificationReport(true, 0, 0, 0, 0); // 없는 명세가 아닌 정상적인 빈 입력이다.
        assertEquals("EMPTY_INPUT", report.exitCode()); // 후속 단계를 생략할 코드다.
    }

    @Test
    void equalCountsDoNotHideWrongIdsOrValues() {
        var report = new VerificationReport(true, 7, 7, 7, 2); // 전체 수는 같아도 차이 행이 있다.
        assertThrows(IllegalStateException.class, report::exitCode); // 건수만 보고 통과시키지 않는다.
    }

    @Test
    void unpublishedInputIsRejected() {
        var report = new VerificationReport(false, 7, 7, 7, 0); // 발행되지 않은 입력이다.
        assertThrows(IllegalStateException.class, report::exitCode); // 값이 같아도 실행 기준을 어긴다.
    }

    @Test
    void changedInputCountIsRejected() {
        var report = new VerificationReport(true, 7, 6, 6, 0); // 발행 후 입력 한 행이 사라진 상황이다.
        assertThrows(IllegalStateException.class, report::exitCode); // 두 집합 수가 같아도 명세와 다르다.
    }
}
```

Java 프로젝트 루트에서 사용하는 Wrapper 하나를 선택한다. TIL 루트에는 이 빌드 프로젝트가 없다.

```powershell
# Gradle 프로젝트라면 판단 로직의 테스트 클래스를 지정한다.
./gradlew.bat test --tests com.example.batch.VerificationReportTest

# Maven 프로젝트라면 같은 클래스를 테스트한다.
./mvnw.cmd -Dtest=VerificationReportTest test
```

예상 결과는 다섯 테스트의 통과이며 Java 문법·타입 검사와 함께 테스트 리포트를 확인한다. SQL과 재시작은 아래의 별도 시험으로 확인해야 한다.

실제 PostgreSQL과 JDBC 메타데이터를 연결한 별도 통합 시험에서는 다음을 확인한다. 모든 대기·DB 접근에는 프로젝트 기준의 유한 제한을 둔다.

| 시험 입력·실패 | 확인할 Step·Job 상태 | 업무 결과·재시작 증거 |
| --- | --- | --- |
| 정상 7건 | 검증 VERIFIED·후속 COMPLETED·Job COMPLETED | ID·제목·수량 전체 일치 |
| ready=true인 빈 입력 | 검증 EMPTY_INPUT·Job COMPLETED/NO_DATA | 후속 Step 실행 이력 없음 |
| 명세 없음 또는 ready=false | 검증 실패 또는 이전 적재에서 실패 | 오류 위치 확인·후속 미실행 |
| 같은 건수·다른 ID 또는 값 | 실제 검증 Step FAILED·Job FAILED | count가 같아도 불일치 감지 |
| 검증 SQL의 일시 연결 실패 | 적재 COMPLETED·검증 FAILED | 장애 해소 후 적재 재실행 없음·같은 Instance·새 Execution |
| 테스트 전용 후속 실패 | 검증 COMPLETED·후속 FAILED | 재시작의 검증 재수행·후속 재수행·중복 적재 없음 |
| 후속 STOPPED 경로 | 지정 재개 위치와 최종 상태 | 검증 재방문 여부를 추측하지 않고 실행 이력 확인 |

검증 오류를 만드는 시험은 전용 테스트 구성에서 적재와 검증 사이의 동기화 지점을 둔다. 예를 들어 완료한 적재 결과의 한 행을 테스트 트랜잭션으로 변경·commit한 뒤 검증을 진행한다. 이런 데이터 변경은 검증기를 시험하기 위한 fixture 조작이지 운영 복구 지침이 아니다. Job 종료를 확인한 뒤 자기 업무의 fixture만 정리한다.

후속 실패를 시험할 때는 테스트 전용 후속 Tasklet에 일회성 예외를 주입한다. 실제 구성의 로그만 남기는 Tasklet은 업무 실패를 재현하지 않는다. 첫 실행·재시작의 모든 Step 이력과 최종 결과를 비교해 “완료한 적재를 다시 수행하지 않았다”와 “검증을 다시 수행했다”를 각각 증명한다.

### 3.9 분기와 단계 간 데이터 전달을 구분한다

ExitStatus는 흐름을 고를 짧은 코드이지 결과 전체를 전달하는 데이터 보관소가 아니다. 위 구성은 같은 Job 파라미터로 DB 결과를 다시 조회하므로 앞 Step의 메모리 객체를 뒤 Step에 넘기지 않는다. 검증 보고서 전체를 종료 설명에 직렬화해 전달하는 방식도 사용하지 않는다.

업무 결과·파일 경로·검증 통계 등을 다음 단계가 사용할 필요가 있다면 영속 업무 테이블 또는 ExecutionContext의 범위·저장 시점을 설계해야 한다. Step 실행 문맥과 Job 실행 문맥은 같은 저장 영역이 아니며, 서버 재시작 시 이전 JVM의 지역 변수는 사라진다. 이 데이터 전달은 다음 학습에서 별도로 다룬다.

## 4. 적용 관점에서 다시 보기

먼저 입력당 결과 수와 변환 규칙·허용 누락을 정한다. 이번 1:1·누락 불허 구성에서는 발행 명세, 입력 보존, 결과 ID·값을 한 업무 범위로 대조한다. SQL 비교의 공백 규칙과 실제 Processor 규칙이 맞는지도 확인한다.

적재·검증·후속 작업을 별도 Step으로 두고, 정상·빈 입력·실패·중지 전이를 명시한다. 예상 밖 종료 코드는 후속 처리로 넘기지 않는다. 완료 적재는 반복하지 않고 검증은 재시작 경로의 방문 여부와 재수행 옵션을 함께 판단한다.

검증의 실패가 앞선 chunk를 취소하지 않는다는 경계를 운영 절차에 반영한다. 입력·결과·이력을 보존하고 원인 해결·정정·보상을 구분한다. 완료 Job과 Step, 계획된 중지와 실패, 새 업무와 재시작도 각각 구별한다.

순수 판단 테스트 뒤 실제 SQL·Step 전이·같은 Instance의 재시작을 통합 시험한다. 저장 결과와 실행 이력에서 후속 미실행·완료 적재 생략·검증 재방문을 각각 확인한 뒤 적용 범위를 넓힌다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

적재가 끝났다는 실행 상태와 입력·결과가 일치한다는 검증은 별개다. Step을 나눌 때는 성공 경로뿐 아니라 실패·중지·완료 단계의 재실행 정책까지 함께 설계해야 한다.

### 5.2 이전·다음 학습과의 연결

[운영·장애 복구 노트](../38_10_09_Batch_Operations_and_Failure_Recovery/10_09_Batch_Operations_and_Failure_Recovery.md)의 상태 확인을 Job 내부의 검증 경계로 연결했다. 다음에는 **Spring Batch ExecutionContext·단계 간 데이터 전달과 상태 관리**를 학습해 검증 통계·재개 정보를 어느 범위에 언제 저장할지 다룬다.

### 5.3 더 파볼 만한 주제

복잡한 분기에서 JobExecutionDecider를 사용하는 기준, 검증이 끝난 버전을 외부 조회에 공개하는 정책, 대량 결과 대조의 분할·집계 최적화로 확장할 수 있다. 후속 외부 발행은 Outbox와 중복 효과의 검증으로 연결한다.

### 5.4 참고 자료

- [Step 흐름 제어](https://docs.spring.io/spring-batch/reference/step/controlling-flow.html): 순차·조건부 흐름, ExitStatus, Job 종료 의미.
- [FlowBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/job/builder/FlowBuilder.html), [TransitionBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/job/builder/FlowBuilder.TransitionBuilder.html): from·on·to와 end·fail·stopAndRestart.
- [TaskletStep](https://docs.spring.io/spring-batch/reference/step/tasklet.html), [Tasklet](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/tasklet/Tasklet.html), [StepBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/StepBuilder.html): 단일 작업·트랜잭션·Step 구성.
- [StepContribution](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/StepContribution.html), [RepeatStatus](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/repeat/RepeatStatus.html): 종료 코드와 반복 종료 신호의 구분.
- [Step 재시작 설정](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/restart.html): 완료 Step 생략·allowStartIfComplete의 의미.
- [StepScope](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/configuration/annotation/StepScope.html), [파라미터 validator](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/job/parameters/DefaultJobParametersValidator.html): 실행 문맥의 늦은 값 연결과 필수 키 검증 범위.
- [PostgreSQL 조인](https://www.postgresql.org/docs/17/queries-table-expressions.html), [비교 연산](https://www.postgresql.org/docs/17/functions-comparison.html), [문자열 함수](https://www.postgresql.org/docs/17/functions-string.html), [격리 수준](https://www.postgresql.org/docs/17/transaction-iso.html): 양쪽 집합 대조·NULL·공백 규칙·한 문장의 관찰 경계.

## 6. 요약 정리

1. Step 분리는 책임·실행 이력·재시작 단위를 구분하는 설계다.
2. 뒤 Step의 실패가 앞서 commit한 모든 chunk를 자동 rollback하지는 않는다.
3. 결과 검증은 같은 업무의 명세·입력·결과 ID·변환 값을 대조한다.
4. FULL OUTER JOIN으로 양쪽 누락·추가를 보고 NULL을 고려해 값을 비교한다.
5. FINISHED는 반복 종료, ExitStatus는 업무 분기 코드다.
6. on은 ExitStatus를 비교하며 예상 밖 코드를 성공 경로로 넘기지 않는다.
7. 전이의 end는 완료, fail은 실패, stopAndRestart는 중지와 재개 위치를 선언한다.
8. 완료 적재와 완료 검증의 재실행 정책을 구분하며 재개 그래프의 방문 여부도 확인한다.
9. 판단 단위 테스트가 실제 SQL·흐름·재시작을 증명하지는 않는다.

🧠 기억할 것: 다음 단계로 넘어가기 전에 결과를 검증하고, 다시 시작할 때는 무엇을 생략하고 무엇을 다시 확인할지 정한다.

## 7. 미니 퀴즈 또는 체크리스트

1. 입력 ID가 A·B이고 결과 ID가 A·C이며 둘 다 2건이다. 검증을 통과시켜도 되는가?
2. 검증 Tasklet이 FINISHED를 반환하고 VERIFIED를 설정했다. 두 값의 역할은 무엇인가?
3. 검증 Step이 FAILED인데 전이를 on("FAILED").end()로 작성하면 어떤 문제가 생길 수 있는가?
4. 적재 완료 후 검증 SQL 연결 오류로 Job이 실패했다. 장애를 해결한 뒤 무엇을 재실행해야 하는가?
5. 검증에 allowStartIfComplete(true)를 설정했다. 후속 Step을 재개 위치로 직접 지정해도 검증이 반드시 다시 실행되는가?

<details>
<summary>정답과 해설</summary>

1. 안 된다. B는 누락, C는 추가다. 건수뿐 아니라 ID 집합과 변환 값을 대조해야 한다.
2. FINISHED는 execute 호출의 반복을 종료한다. VERIFIED는 검증 Step의 종료 의미이며 조건부 흐름이 후속 경로를 선택하는 코드다.
3. Job을 COMPLETED로 끝내면 실패한 Step이 있어도 같은 완료 Instance의 재시작이 막힐 수 있다. 이번 업무의 검증 실패는 fail 전이로 남긴다.
4. 같은 입력·Instance를 유지해 restart한다. 완료 적재는 다시 INSERT하지 않고 검증을 재수행한 뒤 후속 단계로 간다. 실행 이력과 실제 결과로 이를 확인한다.
5. 아니다. 옵션은 재시작 경로가 해당 Step을 방문할 때 적용된다. 직접 후속 Step부터 재개하면 검증을 방문하지 않을 수 있어 재개 위치와 결과 불변성 정책을 함께 확인해야 한다.

</details>
