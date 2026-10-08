# Spring Batch Partitioning·작업 분할과 병렬 처리

- 🎯 글의 목표: 고정된 입력을 겹치지 않는 범위로 나누고, 실행별 Reader·트랜잭션·체크포인트와 제한된 실행기를 연결한다.
- 🧩 핵심 키워드: Partitioning, Partitioner, manager, worker, StepExecution, ExecutionContext, StepScope, gridSize, TaskExecutorPartitionHandler
- ⭐ 중요도: 높음. 병렬화는 처리 시간을 줄일 수 있지만, 범위가 겹치거나 상태를 공유하면 중복·누락·재시작 오류가 생긴다.
- 📝 한눈에 보는 내용: 병렬화의 단위 → 범위와 이름 → 분할 알고리즘 → 실행별 Reader → worker·manager → 자원 예산 → 부분 실패·재시작 → 경계 테스트 순서로 이해한다.
- 🔗 관련 주제: [DB Reader·입력 스냅샷](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md), [재시작·체크포인트](../33_10_04_Spring_Batch_and_Restartability/10_04_Spring_Batch_and_Restartability.md), [스레드 풀](../31_10_02_Async_and_Thread_Pools/10_02_Async_and_Thread_Pools.md), [Bulkhead](../28_09_29_Bulkhead_and_Rate_Limiting/09_29_Bulkhead_and_Rate_Limiting.md)
- 🧱 선수 지식: Job·Step·chunk, commit·rollback, ExecutionContext, StepScope, JDBC 페이징·고유 정렬 키를 이해한다.

> 기준일: 2026-10-07. Spring Boot 4.1.1이 관리하는 Batch 6.0.5·Framework 7.0.9의 공식 문서·API와 관련 소스를 확인했다. Java 21·PostgreSQL 17의 기존 Batch 프로젝트에 추가하는 예제이며, 이전의 불변 스냅샷·Book·CatalogProcessor·catalogWriter·단일 JDBC 트랜잭션 구성을 전제로 한다. 현재 java·javac·Maven·Gradle·psql 명령과 저장소의 Boot 빌드 프로젝트가 없어 Java 테스트·DB·병렬 실행은 수행하지 않았다. 아래 실행 결과는 예상이며 문서 검사와 구분한다. [Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)

## 1. 들어가며

이전 노트에서는 원본 값을 스냅샷으로 보존하고 고유 키로 순서대로 읽었다. 입력이 커져 처리 시간이 길어진다면 그 안정적인 입력을 여러 구간으로 나눌 수 있다. 다만 스레드를 늘리기 전에 SQL 비용·외부 대기·저장 병목을 측정하고, 단일 실행이 요구 시간을 충족하는지 먼저 확인한다.

도서 ID 1~7을 두 작업에 맡긴다고 생각해 보자. 한 작업은 1~4를, 다른 작업은 5~7을 읽으면 각자 독립적으로 진행할 수 있다. 두 작업이 하나의 Reader 위치를 공유하거나 양쪽이 4를 모두 읽는다면, 빠른 처리보다 상태 오류가 먼저 생긴다.

이번 노트는 **같은 입력 버전을 분할하되 실행 상태는 분리하는 방법**을 배운다. 범위 분할이 적절한 도서 가져오기 예제를 같은 JVM, 즉 하나의 Java 프로세스 안에서 병렬 실행한다. 메시지 브로커·여러 서버의 원격 worker는 구현하지 않는다.

## 2. 핵심 개념 정리

```text
같은 불변 스냅샷
  → Partitioner: 범위와 안정적인 이름 생성
  → manager: worker StepExecution 준비·실행 위임
      → range-0: [1, 4] → 전용 Reader → chunk commit·체크포인트
      → range-1: [5, 7] → 전용 Reader → chunk commit·체크포인트
  → worker 결과 취합 → 업무 결과 대조
실패 시 → 같은 업무·입력·분할 의미 유지 → 필요한 worker 재개
```

| 질문 | 본문 연결 |
| --- | --- |
| Partitioning은 무엇을 병렬화하는가? | 3.1 |
| 이름·범위·gridSize는 어떤 의미인가? | 3.2~3.3 |
| Reader와 상태는 어디에 분리하는가? | 3.4~3.5 |
| 실행기·DB 자원을 얼마나 허용하는가? | 3.6 |
| 한 worker가 실패하면 무엇이 남는가? | 3.7 |
| 계산과 실제 재시작은 어떻게 검증하는가? | 3.8 |

## 3. 본문 정리

### 3.1 Partitioning은 Step의 입력을 나누는 방식이다

**Partitioning은 같은 작업 정의에 서로 다른 입력 구간을 배정하고 별도의 StepExecution으로 실행하는 구조**다. manager는 나눌 작업을 준비하고 결과를 모으며, worker는 배정된 입력을 처리한다. worker는 다른 프로세스에 있을 수도 있지만 이번에는 로컬 스레드에서 실행한다. [공식 확장·병렬 처리 설명](https://docs.spring.io/spring-batch/reference/scalability.html)

**Step은 작업의 정의, StepExecution은 실제 실행 한 번의 이력**이다. 도서 적재라는 정의가 같아도 1~4를 처리한 시도와 5~7을 처리한 시도는 읽은 수·상태·체크포인트가 다르다. 이 이력을 나누어야 한 구간의 실패를 다른 구간의 상태와 혼동하지 않는다.

병렬화 단위도 구분한다. 항목의 Processor를 여러 스레드에서 실행하는 방법, 서로 다른 Step을 병렬로 진행하는 방법, chunk를 넘기는 방법, 입력 범위를 나눈 StepExecution을 진행하는 방법은 실행·트랜잭션 경계가 다르다. 이번 worker의 chunk 내부는 순차 실행하며, **worker 간 병렬성만** 추가한다.

`TaskExecutorPartitionHandler`는 지정한 worker Step을 TaskExecutor로 로컬 실행하는 구성 요소다. 실행기를 지정하지 않은 기본 경로는 동기 실행이므로 분할했다고 반드시 동시에 실행되는 것은 아니다. [Handler API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/partition/support/TaskExecutorPartitionHandler.html)

### 3.2 서로 겹치지 않는 범위와 반복 가능한 이름을 만든다

**Partitioner는 이름을 키로, 입력 ExecutionContext를 값으로 가진 Map을 만드는 전략**이다. ExecutionContext는 각 작업에 전달할 작은 키·값 공간이며, 이번에는 `minId`·`maxId`만 담는다. 공통 snapshotId는 Job 파라미터로 전달한다. [Partitioner API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/partition/Partitioner.html)

예제의 양 끝을 포함하는 범위는 다음과 같다.

| 분할 이름 | 조건 | 배정 항목 |
| --- | --- | --- |
| range-0 | `1 <= item_id AND item_id <= 4` | B001~B004 |
| range-1 | `5 <= item_id AND item_id <= 7` | B005~B007 |

범위 사이에 4가 겹치지 않고 5가 빠지지 않는지 읽어야 한다. `BETWEEN`은 양 끝을 포함하므로 `[1,4]`와 `[4,7]`로 구성하면 4가 중복이다. 반열린 구간처럼 다른 규칙을 쓸 수 있지만, 분할 계산과 Reader SQL이 같은 규칙을 따라야 한다.

이름도 재시작 의미에 포함된다. 기본 splitter는 worker 이름과 분할 이름을 결합해 이전 실행을 찾는다. 따라서 `partition-0`이 처음에는 1~4인데 재시작 때 5~7로 바뀌면, 같은 이름 아래 다른 입력을 연결하는 문제가 생긴다. 이번에는 불변 입력의 최소·최대 키와 같은 분할 규칙을 유지한다. [Splitter API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/partition/support/SimpleStepExecutionSplitter.html)

**gridSize는 원하는 분할 규모를 전달하는 값**이며, 스레드 풀 크기를 직접 설정하는 속성이 아니다. builder에서는 splitter에 전달하는 힌트로 설명한다. 아래 알고리즘은 키 개수보다 큰 요청이면 실제 범위 수를 줄인다. 숫자 10을 전달했다고 항상 10개 스레드를 만드는 것은 아니다. [PartitionStepBuilder API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/PartitionStepBuilder.html)

### 3.3 키 공간을 나누는 Partitioner를 구현한다

다음은 `src/main/java/com/example/batch/SnapshotRangePartitioner.java`에 추가하는 **파일 전체**다. 입력은 양수 최소·최대 ID와 gridSize이고, 출력은 서로 겹치지 않는 닫힌 범위다. Batch 6의 Partitioner 패키지는 `core.partition`이며 과거 예제의 `core.partition.support.Partitioner`를 가져오지 않는다.

```java
package com.example.batch; // 기존 Batch 프로젝트의 패키지다.

import java.util.LinkedHashMap; // 계산한 순서로 결과를 확인할 수 있게 한다.
import java.util.Map; // 이름과 실행별 입력 상태를 묶는다.
import org.springframework.batch.core.partition.Partitioner; // Batch 6의 분할 전략 타입이다.
import org.springframework.batch.infrastructure.item.ExecutionContext; // 각 worker의 입력을 담는다.

public class SnapshotRangePartitioner implements Partitioner { // StepScope 프록시가 가능하도록 final로 만들지 않는다.
    private final long minId; // 같은 입력에서는 바뀌지 않는 최소 키다.
    private final long maxId; // 같은 입력에서는 바뀌지 않는 최대 키다.

    public SnapshotRangePartitioner(long minId, long maxId) {
        if (minId < 1 || maxId < minId) { // 빈 입력·역전 범위·비양수 키를 이번 정책에서 거부한다.
            throw new IllegalArgumentException("양수의 유효한 ID 범위가 필요합니다.");
        }
        this.minId = minId; // 범위 계산에 필요한 작은 값만 보관한다.
        this.maxId = maxId;
    }

    @Override
    public Map<String, ExecutionContext> partition(int gridSize) {
        if (gridSize < 1) { // 나눌 수는 적어도 하나여야 한다.
            throw new IllegalArgumentException("gridSize는 양수여야 합니다.");
        }
        long span = Math.addExact(Math.subtractExact(maxId, minId), 1); // 양 끝을 포함한 키 공간 크기다.
        int count = (int) Math.min(span, (long) gridSize); // 키 공간보다 많은 빈 범위를 만들지 않는다.
        long baseWidth = span / count; // 모든 범위에 먼저 배정할 기본 폭이다.
        long remainder = span % count; // 남은 폭은 앞쪽 범위에 하나씩 더한다.
        long start = minId; // 첫 범위의 시작은 전체 최소 키다.
        var partitions = new LinkedHashMap<String, ExecutionContext>();
        for (int index = 0; index < count; index++) {
            long width = baseWidth + (index < remainder ? 1 : 0); // 나머지도 누락 없이 배정한다.
            long end = Math.addExact(start, width - 1); // 닫힌 범위이므로 폭에서 1을 뺀다.
            var context = new ExecutionContext(); // 같은 가변 context를 다른 worker와 공유하지 않는다.
            context.putLong("minId", start); // Reader의 최소 조건에 전달한다.
            context.putLong("maxId", end); // Reader의 최대 조건에 전달한다.
            partitions.put("range-" + index, context); // 같은 입력·분할 수면 이름과 의미가 같다.
            if (index + 1 < count) {
                start = Math.addExact(end, 1); // 다음 시작은 직전 끝 다음이며 마지막에는 더하지 않는다.
            }
        }
        return partitions; // 이 순서는 계산 순서이며 실제 실행·완료 순서를 보장하지 않는다.
    }
}
```

1~7을 두 개로 나누면 기본 폭 3·나머지 1이어서 첫 폭 4, 다음 폭 3이 된다. 마지막에 maxId+1을 계산하지 않아 최대 long 값에서 불필요한 overflow를 피한다. 양수 키라는 입력 정책 때문에 전체 폭도 long 범위 안에서 계산할 수 있다.

이 알고리즘은 **행 수가 아니라 키 공간 폭**을 균등하게 나눈다. 키가 1·2·1000000처럼 드문드문 있거나 특정 범위의 처리가 오래 걸리면 worker별 작업량이 불균형할 수 있다. 행 수·예상 비용을 기준으로 미리 분할 계획을 만들고 그 계획을 보존하는 확장은 별도 설계다.

⚠️ 주의: 겹침·누락이 없다는 것은 범위 계산의 조건이다. 실제 입력에 범위 밖의 행이 없는지, 입력 자체가 바뀌지 않는지, Reader SQL이 계산과 같은 양 끝 포함 규칙인지도 확인한다.

### 3.4 실행별 Reader가 자기 범위와 상태를 갖게 한다

`@StepScope`는 StepExecution마다 실제 대상 객체를 준비하는 scope다. Spring에 주입되는 프록시를 공유하더라도 실행별 Reader 대상과 상태는 분리한다. 따라서 각 worker는 같은 스냅샷에서 자신의 minId·maxId만 읽고 자신의 context에 진행을 저장한다. [Step scope·late binding](https://docs.spring.io/spring-batch/reference/step/late-binding.html)

다음은 `src/main/java/com/example/batch/PartitionedSnapshotConfiguration.java`에 추가하는 파일의 앞부분이다. 3.5의 나머지를 같은 클래스에 이어 붙여 완성한다. 이전 설정은 유지하되 새 Job을 명시적으로 선택하고, 이전 CSV·단일 스냅샷 Job의 실패 실행을 이 새 Job으로 바꾸어 재시작하지 않는다.

```java
package com.example.batch;

import java.util.Map; // 파라미터와 입력 요약을 이름으로 조회한다.
import java.util.Objects; // 입력 버전 일치와 provider 객체를 검사한다.
import java.util.concurrent.ThreadPoolExecutor; // 포화 시 사용할 명시적인 거절 정책이다.
import javax.sql.DataSource; // 이전 노트와 같은 JDBC DB를 사용한다.
import com.example.batch.CatalogBatchConfiguration.Book; // 기존 도서 입력 record다.
import org.springframework.batch.core.configuration.annotation.StepScope; // 실행별 구성 요소를 분리한다.
import org.springframework.batch.core.job.Job; // 전체 업무 정의의 반환 타입이다.
import org.springframework.batch.core.job.builder.JobBuilder; // manager를 Job에 연결한다.
import org.springframework.batch.core.job.parameters.DefaultJobParametersValidator; // 필수 키를 검사한다.
import org.springframework.batch.core.repository.JobRepository; // 실행·재시작 이력을 관리한다.
import org.springframework.batch.core.step.Step; // worker·manager의 공통 타입이다.
import org.springframework.batch.core.step.builder.ChunkOrientedStepBuilder; // worker의 묶음 처리를 만든다.
import org.springframework.batch.core.step.builder.StepBuilder; // manager의 분할 단계를 만든다.
import org.springframework.batch.infrastructure.item.database.JdbcBatchItemWriter; // 이전 Writer Bean을 주입받는다.
import org.springframework.batch.infrastructure.item.database.JdbcPagingItemReader; // 상태 저장 가능한 Reader 타입이다.
import org.springframework.batch.infrastructure.item.database.Order; // 고유 키의 오름차순을 명시한다.
import org.springframework.batch.infrastructure.item.database.builder.JdbcPagingItemReaderBuilder; // Reader 설정을 연결한다.
import org.springframework.batch.infrastructure.item.database.support.SqlPagingQueryProviderFactoryBean; // DB별 SQL 생성기다.
import org.springframework.beans.factory.annotation.Qualifier; // 여러 Bean 중 원하는 것을 고른다.
import org.springframework.beans.factory.annotation.Value; // Job·Step 입력을 실행 시점에 연결한다.
import org.springframework.context.annotation.Bean; // 구성 메서드의 객체를 Spring에 등록한다.
import org.springframework.context.annotation.Configuration; // 설정 클래스를 컴포넌트 스캔으로 찾는다.
import org.springframework.jdbc.core.JdbcTemplate; // 발행 상태와 입력 범위를 조회한다.
import org.springframework.jdbc.support.JdbcTransactionManager; // 기존 단일 DB의 chunk 트랜잭션을 사용한다.
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor; // 제한된 worker 풀을 구성한다.

@Configuration(proxyBeanMethods = false)
public class PartitionedSnapshotConfiguration {
    @Bean
    @StepScope // manager의 실행 문맥에서 공통 입력을 검사한다.
    public SnapshotRangePartitioner snapshotRangePartitioner(DataSource dataSource,
            @Value("#{jobParameters['snapshotId']}") String snapshotId,
            @Value("#{jobParameters['sourceRevision']}") String sourceRevision) {
        if (snapshotId == null || snapshotId.isBlank() || snapshotId.length() > 100
                || !Objects.equals(snapshotId, sourceRevision)) {
            throw new IllegalArgumentException("입력·결과 버전이 일치하는 스냅샷이 필요합니다.");
        }
        Map<String, Object> summary = new JdbcTemplate(dataSource).queryForMap("""
                SELECT m.ready, m.item_count, count(s.item_id) AS actual_count,
                       min(s.item_id) AS min_id, max(s.item_id) AS max_id
                FROM catalog_snapshot_manifest m
                LEFT JOIN catalog_input_snapshot s ON s.snapshot_id = m.snapshot_id
                WHERE m.snapshot_id = ?
                GROUP BY m.ready, m.item_count
                """, snapshotId); // SQL 값 바인딩으로 지정된 입력 하나만 조사한다.
        long actual = ((Number) summary.get("actual_count")).longValue(); // 보존된 행 수다.
        long expected = ((Number) summary.get("item_count")).longValue(); // 발행할 때 기록한 행 수다.
        if (!Boolean.TRUE.equals(summary.get("ready")) || actual == 0 || actual != expected) {
            throw new IllegalStateException("발행된 비어 있지 않은 입력의 건수가 일치해야 합니다.");
        }
        long minId = ((Number) summary.get("min_id")).longValue(); // 빈 입력은 위에서 이미 거부했다.
        long maxId = ((Number) summary.get("max_id")).longValue();
        return new SnapshotRangePartitioner(minId, maxId); // 불변 입력에서 얻은 범위를 나눈다.
    }

    @Bean
    @StepScope // worker StepExecution마다 서로 다른 Reader 대상이 만들어진다.
    public JdbcPagingItemReader<Book> partitionCatalogReader(DataSource dataSource,
            @Value("#{jobParameters['snapshotId']}") String snapshotId,
            @Value("#{stepExecutionContext['minId']}") Long minId,
            @Value("#{stepExecutionContext['maxId']}") Long maxId) throws Exception {
        if (minId == null || maxId == null || minId < 1 || maxId < minId) {
            throw new IllegalArgumentException("worker의 ID 범위를 확인해야 합니다.");
        }
        var factory = new SqlPagingQueryProviderFactoryBean(); // DB별 페이징 SQL을 만든다.
        factory.setDataSource(dataSource);
        factory.setSelectClause("SELECT item_id, book_id, title, stock"); // 정렬 키도 SELECT에 포함한다.
        factory.setFromClause("FROM catalog_input_snapshot"); // 변경 가능한 원본은 읽지 않는다.
        factory.setWhereClause("WHERE snapshot_id = :snapshotId AND item_id BETWEEN :minId AND :maxId");
        factory.setSortKeys(Map.of("item_id", Order.ASCENDING)); // 범위 안의 고유 순서를 유지한다.
        return new JdbcPagingItemReaderBuilder<Book>()
                .name("partitionCatalogReader") // 같은 이름도 실행별 context 안에서는 구분된다.
                .dataSource(dataSource)
                .queryProvider(Objects.requireNonNull(factory.getObject()))
                .parameterValues(Map.of("snapshotId", snapshotId, "minId", minId, "maxId", maxId))
                .pageSize(3) // 학습용 조회 크기이며 병렬 작업 수와 다르다.
                .saveState(true) // 각 worker의 확정된 읽기 위치를 보존한다.
                .rowMapper((rs, rowNumber) -> new Book(
                        rs.getString("book_id"), rs.getString("title"), rs.getInt("stock")))
                .build(); // Spring 초기화와 Step의 ItemStream 생명주기를 사용한다.
    }
    // 3.5의 나머지 메서드를 이어 넣는다.
```

manager의 요약 검사는 준비 완료·건수·양수 키 범위를 확인하기 위한 예제 정책이다. 같은 건수로 값을 바꾸는 오류까지 탐지하는 내용 해시 검사는 아니며, ready 이후 수정 금지·권한·입력 보존은 앞선 스냅샷 규칙을 따른다. 이 예제는 빈 입력을 실패시키므로 이전 단일 Reader 예제의 빈 입력 허용과 정책이 다르다.

Reader는 snapshotId와 범위를 값으로 바인딩한다. DB별 provider가 첫 페이지와 이후 페이지 SQL을 생성하고, 고유 itemId로 재개한다. 한 Reader를 여러 스레드가 직접 공유하면서 saveState만 켜는 방식과 다르다. [Provider 팩터리](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/support/SqlPagingQueryProviderFactoryBean.html), [페이징 Reader API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/JdbcPagingItemReader.html)

### 3.5 worker·manager·Job을 연결한다

다음은 같은 `PartitionedSnapshotConfiguration` 클래스의 나머지 부분이다. 이전 `catalogWriter`는 이미 StepScope이며 각 worker에서 다른 실제 Writer 대상을 사용한다. DataSource·트랜잭션 매니저는 공통 자원이지만 DB 트랜잭션은 worker의 실행 스레드에서 각각 진행된다.

```java
    @Bean(name = "partitionExecutor", defaultCandidate = false)
    public ThreadPoolTaskExecutor partitionExecutor() {
        var executor = new ThreadPoolTaskExecutor(); // 이 Job의 worker 전용 실행기다.
        executor.setCorePoolSize(2); // 동시에 실행할 기본 worker 수다.
        executor.setMaxPoolSize(2); // 이번 예제에서는 추가 확장을 허용하지 않는다.
        executor.setQueueCapacity(2); // 초과 작업이 기다릴 공간도 제한한다.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy()); // 포화 시 조용히 버리지 않고 거절한다.
        executor.setThreadNamePrefix("catalog-partition-"); // 로그에서 실행 위치를 식별한다.
        executor.setWaitForTasksToCompleteOnShutdown(true); // 정상 종료 시 제출된 작업 완료를 시도한다.
        executor.setAwaitTerminationSeconds(15); // 종료 대기도 유한하게 둔다.
        return executor; // Spring Bean 초기화가 실행기를 준비한다.
    }

    @Bean
    public Step partitionCatalogWorker(JobRepository repository,
            JdbcTransactionManager transactionManager,
            @Qualifier("partitionCatalogReader") JdbcPagingItemReader<Book> reader,
            @Qualifier("catalogWriter") JdbcBatchItemWriter<Book> writer) {
        return new ChunkOrientedStepBuilder<Book, Book>("partitionCatalogWorker", repository, 3)
                .transactionManager(transactionManager) // worker의 chunk마다 commit·rollback한다.
                .reader(reader) // 프록시가 현재 worker의 Reader 상태를 선택한다.
                .processor(new CatalogProcessor()) // 기존 검증기는 실행별 가변 필드를 보관하지 않는다.
                .writer(writer) // 날짜·입력 버전별 기존 결과 테이블에 쓴다.
                .build(); // worker 내부에 추가 TaskExecutor·retry·skip을 설정하지 않는다.
    }

    @Bean
    public Step partitionCatalogManager(JobRepository repository,
            SnapshotRangePartitioner snapshotRangePartitioner,
            @Qualifier("partitionCatalogWorker") Step worker,
            @Qualifier("partitionExecutor") ThreadPoolTaskExecutor executor) {
        return new StepBuilder("partitionCatalogManager", repository)
                .partitioner("partitionCatalogWorker", snapshotRangePartitioner) // 실행 이름의 기준을 맞춘다.
                .step(worker) // 각 범위를 같은 worker 정의에 맡긴다.
                .gridSize(2) // 이번 분할 알고리즘에 원하는 범위 수를 전달한다.
                .taskExecutor(executor) // 로컬 worker 실행에만 이 실행기를 사용한다.
                .build(); // 기본 splitter·로컬 partition handler를 구성한다.
    }

    @Bean
    public Job partitionedCatalogJob(JobRepository repository,
            @Qualifier("partitionCatalogManager") Step manager) {
        String[] required = {"businessDate", "sourceRevision", "snapshotId"}; // 기존 Writer 입력도 필요하다.
        return new JobBuilder("partitionedCatalogJob", repository)
                .validator(new DefaultJobParametersValidator(required, new String[0])) // 필수 키를 확인한다.
                .start(manager) // worker가 아닌 manager에서 시작한다.
                .build(); // 완료 worker의 재실행 허용을 별도로 켜지 않는다.
    }
} // 설정 파일의 끝이다.
```

이 설정은 handler가 실행할 worker 정의를 지정하고, 각 실행에서 범위와 Reader·Writer 상태를 분리하는 구성이다. 임의의 사용자 Step이나 상태 있는 Processor·listener를 같은 방식으로 공유해도 안전하다고 일반화하지 않는다. Batch 6.0.5의 chunk 구현은 실행 스레드의 chunk 추적 상태를 ThreadLocal로 관리한다. 사용자 구성 요소의 가변 상태 안전성은 여전히 별도 책임이다. [ChunkOrientedStep 6.0.5 소스](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/step/item/ChunkOrientedStep.java)

준비는 이전 프로젝트의 JDBC Batch starter·PostgreSQL 드라이버·테스트 starter와 스냅샷 스키마를 그대로 사용한다. 자동 Job 실행을 끈 기존 설정도 유지한다. `defaultCandidate = false`는 전용 실행기를 기본 후보에서 제외하는 Framework 6.2 이상 API이며 Boot 자동 실행기와의 관계는 [스레드 풀 노트](../31_10_02_Async_and_Thread_Pools/10_02_Async_and_Thread_Pools.md)를 참고한다.

실행 호출은 **보호된 운영 호출부 또는 통합 테스트 안의 일부 코드**다. `operator`는 주입받은 JobOperator이고 `job`은 `@Qualifier("partitionedCatalogJob")`로 고른 Job이다. JobParametersBuilder는 `org.springframework.batch.core.job.parameters`에서 import한다. 사용자 권한·HTTP API·완료 대기는 이 조각에서 구현하지 않는다.

```java
var parameters = new JobParametersBuilder()
        .addString("businessDate", "2026-10-07", true) // 이전 실습과 다른 업무 날짜로 결과를 분리한다.
        .addString("sourceRevision", "catalog-db-v1", true) // 기존 Writer의 원본 버전이다.
        .addString("snapshotId", "catalog-db-v1", true) // 이전에 발행한 불변 입력을 선택한다.
        .toJobParameters(); // 실행 시각을 추가해 재시작 업무를 새 업무로 바꾸지 않는다.
var execution = operator.start(job, parameters); // JobExecution 반환 자체는 성공 완료가 아니다.
```

기존 스냅샷의 ID가 1~7이라면 range-0은 1~4, range-1은 5~7이다. 정상 경로에서 첫 worker는 3건·1건, 두 번째는 3건의 chunk로 확정한다. 시작·완료 순서와 로그가 ID 순서대로 나오는 것은 보장하지 않는다. 결과 조회의 ORDER BY와 실행 순서를 혼동하지 않는다.

### 3.6 분할 수·실행 수·DB 자원 수를 따로 제한한다

이 예제에서 gridSize 2는 입력 분할 수에 사용되고, 풀 크기 2는 동시에 실행할 worker 수의 상한이다. chunk 3은 한 worker의 확정 묶음 수이며 pageSize 3은 Reader의 조회 크기다. 모두 2 또는 3이라고 해도 역할이 다르다.

범위를 20개 만들고 풀 크기를 2로 두면 나머지는 대기하거나 제출 거절될 수 있다. gridSize는 실행기 대기열을 무한히 늘려 주는 기능이 아니다. `ThreadPoolTaskExecutor`는 core·queue·max 설정으로 실행·대기를 관리하고 포화 시 거절을 드러낸다. [실행기 API](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/scheduling/concurrent/ThreadPoolTaskExecutor.html)

Batch 6.0.5의 로컬 handler는 제출 거절된 worker를 FAILED로 표시하고, 제출한 Future들의 결과를 기다리는 흐름을 갖는다. 따라서 작은 queue에 아주 많은 범위를 한꺼번에 넣어도 모두 자동 실행될 것이라 기대하지 않는다. 실행기 용량·제출 방식·복구 정책을 함께 검증한다. [Handler 6.0.5 소스](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/partition/support/TaskExecutorPartitionHandler.java)

DB 연결 풀에도 예산이 필요하다. worker 두 개의 트랜잭션 외에 manager 메타데이터 조회·다른 Job·웹 요청이 연결을 사용할 수 있으므로 “worker 2니까 DB 연결 2면 충분하다”로 단정하지 않는다. 외부 API 허용량과 메모리도 함께 고려한다. 페이지 객체와 처리 중 chunk는 각 worker에 있으므로 worker 증가가 메모리 증가로 이어질 수 있다.

키 공간이 같은 폭이어도 행 수·연관 조회·외부 호출 시간은 다르다. 전체 시간은 가장 늦은 worker에 좌우될 수 있으므로 실행별 입력·읽기 수·쓰기 수·소요 시간·실패·연결 대기를 관찰한다. 서버가 여러 대면 로컬 풀의 상한은 서버 수만큼 합산될 수 있다.

⚠️ 주의: manager 자체를 worker 전용의 작은 풀에 제출한 뒤 같은 풀의 worker 완료를 기다리는 구조는 자리를 소모하거나 교착 위험을 만들 수 있다. 이번 전용 풀은 worker 처리에만 연결하며 중첩된 같은 풀의 제출·대기를 추가하지 않는다.

### 3.7 부분 실패는 전체 결과의 자동 rollback이 아니다

두 worker는 각각 chunk를 확정한다. range-0이 B001~B004를 모두 commit한 뒤 range-1의 첫 chunk가 실패하면, Job 실패 상태가 되어도 range-0의 네 행은 남을 수 있다. “하나의 Job”은 “전체를 감싸는 하나의 DB 트랜잭션”이 아니다.

```text
첫 실행의 예시 조건
  range-0: B001~B003 commit → B004 commit → COMPLETED
  range-1: B005~B007 쓰기 실패 → 해당 chunk rollback → FAILED
  manager·Job: 실패를 관찰
  실제 결과: B001~B004는 확정되어 남음

같은 실패 업무 재시작의 기대
  완료 range-0: 기본 설정에서 다시 실행하지 않음
  실패 range-1: 자신의 저장된 context로 재개 → B005~B007 확정
  실제 결과: 최종 B001~B007 대조
```

이것은 range-0의 완료와 range-1의 실패를 통제한 경우의 예상 흐름이다. 실제 병렬 실행에서는 다른 worker가 이미 진행·확정한 위치가 다양할 수 있다. 한 worker 오류가 다른 worker의 즉시 취소나 완료한 결과의 보상을 보장하지는 않는다.

기본 splitter는 같은 worker·분할 이름의 이전 실행을 찾고, 재개할 worker에는 이전 ExecutionContext를 연결한다. 완료 worker는 기본 설정에서 다른 JobExecution의 재시작 대상으로 선택하지 않는다. `allowStartIfComplete`를 켜면 이 판단이 달라지므로, 중복 INSERT를 수행하는 예제에는 무심코 추가하지 않는다. [Splitter 6.0.5 소스](https://github.com/spring-projects/spring-batch/blob/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/partition/support/SimpleStepExecutionSplitter.java)

재시작에서는 snapshotId·입력 내용·Job/worker/Reader 이름·분할 이름과 의미를 유지한다. 새로운 코드·분할 계획으로 남은 실패 업무를 재시작하기 전에는 기존 context와의 호환성을 검토한다. 메타데이터의 실행 관리가 외부 결제·알림의 업무 효과를 정확히 한 번 보장하는 것도 아니다. 외부 쓰기는 앞선 멱등성·Outbox 경계로 별도 처리한다.

manager의 요약만 보고 승인하지 않고 worker별 상태·예외·실행별 카운터와 최종 결과를 대조한다. 같은 날짜·버전의 저장 도서 ID는 7개여야 하며, 이전 스냅샷 노트의 입력·결과 대조 SQL에서 업무 날짜를 `2026-10-07`로 맞춰 값도 확인한다. [StepExecution API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/StepExecution.html)

### 3.8 범위 계산 검사와 실제 병렬 재시작 검사를 나눈다

다음은 `src/test/java/com/example/batch/SnapshotRangePartitionerTest.java`에 추가하는 **JUnit Jupiter 파일 전체**다. 기존 `spring-boot-starter-test` 환경을 사용하며 DB는 필요 없다. 범위 계산·작은 입력·최대 long·잘못된 입력을 확인하지만 실제 worker의 독립 Reader·동시 실행·commit을 검증하는 테스트는 아니다.

```java
package com.example.batch;

import java.util.List; // 예상 분할 이름 순서를 표현한다.
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SnapshotRangePartitionerTest {
    @Test
    void coversSevenIdsWithTwoDistinctContexts() {
        var partitioner = new SnapshotRangePartitioner(1, 7); // 예제 입력의 키 범위다.
        var result = partitioner.partition(2); // 두 범위를 요청한다.
        assertEquals(List.of("range-0", "range-1"), List.copyOf(result.keySet()));
        assertEquals(1L, result.get("range-0").getLong("minId"));
        assertEquals(4L, result.get("range-0").getLong("maxId")); // 나머지 폭 하나를 앞에 배정한다.
        assertEquals(5L, result.get("range-1").getLong("minId")); // 첫 범위 다음에서 시작한다.
        assertEquals(7L, result.get("range-1").getLong("maxId"));
        assertNotSame(result.get("range-0"), result.get("range-1")); // context 객체를 공유하지 않는다.
        var again = partitioner.partition(2); // 같은 입력·규칙으로 다시 계산한다.
        assertEquals(result.keySet(), again.keySet()); // 이름이 반복 가능하다.
        for (String name : result.keySet()) {
            assertEquals(result.get(name).getLong("minId"), again.get(name).getLong("minId"));
            assertEquals(result.get(name).getLong("maxId"), again.get(name).getLong("maxId"));
        }
    }

    @Test
    void producesNoOverlapsOrGapsAcrossSmallRanges() {
        for (long max = 1; max <= 30; max++) { // 나머지·한 항목 등의 경계를 다양하게 검사한다.
            for (int grid = 1; grid <= 35; grid++) {
                var result = new SnapshotRangePartitioner(1, max).partition(grid);
                assertEquals((int) Math.min(max, grid), result.size()); // 빈 범위 수를 늘리지 않는다.
                long next = 1;
                for (var context : result.values()) {
                    long start = context.getLong("minId");
                    long end = context.getLong("maxId");
                    assertEquals(next, start); // 직전 끝 다음에서 시작해 누락·겹침을 검사한다.
                    assertTrue(end >= start); // 각 범위는 비어 있지 않다.
                    next = end + 1; // 여기서는 작은 값만 검사하므로 overflow가 없다.
                }
                assertEquals(max + 1, next); // 전체 최대 키까지 정확히 덮는다.
            }
        }
    }

    @Test
    void handlesTheLargestLongWithoutAdvancingPastTheLastRange() {
        var result = new SnapshotRangePartitioner(Long.MAX_VALUE - 1, Long.MAX_VALUE).partition(3);
        assertEquals(2, result.size()); // 두 키뿐이므로 빈 세 번째 범위를 만들지 않는다.
        assertEquals(Long.MAX_VALUE - 1, result.get("range-0").getLong("maxId"));
        assertEquals(Long.MAX_VALUE, result.get("range-1").getLong("maxId")); // 마지막 다음 키를 계산하지 않는다.
    }

    @Test
    void rejectsInvalidBoundsAndGridSizes() {
        assertThrows(IllegalArgumentException.class, () -> new SnapshotRangePartitioner(0, 7));
        assertThrows(IllegalArgumentException.class, () -> new SnapshotRangePartitioner(7, 1));
        assertThrows(IllegalArgumentException.class, () -> new SnapshotRangePartitioner(1, 7).partition(0));
        // 잘못된 입력을 빈 결과 성공처럼 숨기지 않는다.
    }
}
```

기존 Java 프로젝트 루트의 PowerShell에서 `./gradlew.bat test --tests com.example.batch.SnapshotRangePartitionerTest`를 실행한다. 예상 결과는 네 테스트 통과이며 이번 작성 환경에서는 실행하지 않았다. 아래 DB·Batch 통합 시험은 추가로 구성해야 한다.

| 통합 시험 | 확인할 관찰 |
| --- | --- |
| 정상 7건·gridSize 2 | 범위 1~4·5~7, 결과 ID 7개·값 일치, worker별 이력 |
| worker별 로그·입력 context 기록 | 각 worker가 자기 범위만 읽고 Reader 상태가 섞이지 않음 |
| 두 worker의 진입을 latch로 맞추기 | 동시에 실행 가능함; 완료 시간이 짧다는 추측으로 대체하지 않음 |
| range-0 완료 후 range-1 Writer 실패 | range-0의 4행 유지·실패 chunk 결과 없음 |
| 실패 주입을 해제하고 같은 실행 restart | 완료 worker를 다시 쓰지 않고 실패 worker 재개·최종 7개 |
| 키가 드문드문 있는 입력 | 빈 행 범위도 종료·전체 입력 ID 누락 없음·작업량 불균형 관찰 |
| 좁은 실행기·다수 범위 | 제출 거절·worker 상태·최종 실패가 숨겨지지 않음 |
| DB 연결 풀 대기·프로세스 종료 | 자원 시간 제한·확정 결과·재시작 입력과 메타데이터 보존 |

실패 시험마다 새 업무 키와 격리된 스냅샷을 사용하고, 같은 실패 업무를 재시작할 때만 그 키를 유지한다. 외부 대기용 latch에는 제한 시간과 finally 해제를 두어 테스트가 영원히 기다리지 않도록 한다. 테스트 코드에서 고정 sleep만으로 특정 worker의 commit 순서를 가정하지 않는다.

## 4. 적용 관점에서 다시 보기

먼저 단일 작업의 병목을 측정한 뒤 독립 처리 가능한 범위가 있는지 판단한다. 입력을 고정하고 분할 이름·범위·정렬을 일치시킨 다음, 실행별 Reader·Writer 상태를 분리한다.

worker 내부는 순차 chunk로 두고 manager의 전용 실행기에서 worker 간 병렬성을 제한한다. gridSize·풀·queue·pageSize·chunk·DB 연결은 각자 다른 한도이며 외부 자원 예산까지 함께 검토한다.

실패 대응은 전체 rollback을 기대하는 것이 아니라 확정된 결과·완료 worker·실패 worker의 체크포인트를 확인하는 과정이다. 같은 입력 의미로 재시작하고, 최종 도서 ID·값을 대조한 뒤 업무 성공을 판단한다.

검증은 범위 계산부터 상태 분리·동시 진입·실제 commit·부분 실패·같은 업무 재시작으로 확장한다. 실행 시간이 줄었다는 관찰만으로 누락이나 중복이 없다고 결론내리지 않는다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

Partitioning은 단순히 스레드를 늘리는 것이 아니라 입력과 실행 상태를 나누는 구조다. 범위의 완전성·실행별 상태·부분 확정·재시작 의미를 함께 지켜야 병렬 결과를 신뢰할 수 있다.

### 5.2 이전·다음 학습과의 연결

[DB Reader·스냅샷 노트](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md)의 고정 입력을 독립 실행 구간으로 확장했다. 다음에는 [Spring Batch 통합 테스트·실패 주입과 재시작 검증](../37_10_08_Batch_Integration_Testing_and_Restart_Verification/10_08_Batch_Integration_Testing_and_Restart_Verification.md)을 학습해, 지금까지의 상태·rollback·재개 가정을 실제 Job·DB 테스트로 확인하는 흐름을 정리한다.

### 5.3 더 파볼 만한 주제

행 수·비용을 기준으로 한 영속 분할 계획, 원격 partitioning과 통신 장애, 실행별 관측과 자원 조절을 확장할 수 있다. 전역 순서가 필요한 출력이나 외부 쓰기 효과는 독립 범위 처리와 다른 일관성 요구를 검토해야 한다.

### 5.4 참고 자료

- [Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html): 기준 Boot·Batch·Framework 버전.
- [Scaling and Parallel Processing](https://docs.spring.io/spring-batch/reference/scalability.html): 병렬화 단위와 로컬·원격 partitioning 구조.
- [Partitioner](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/partition/Partitioner.html): 이름과 ExecutionContext를 만드는 계약.
- [StepBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/StepBuilder.html), [PartitionStepBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/PartitionStepBuilder.html): worker·gridSize·실행기 연결.
- [TaskExecutorPartitionHandler](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/partition/support/TaskExecutorPartitionHandler.html), [6.0.5 Handler 소스](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/partition/support/TaskExecutorPartitionHandler.java): 로컬 실행·제출 거절·결과 대기.
- [SimpleStepExecutionSplitter](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/partition/support/SimpleStepExecutionSplitter.html), [6.0.5 Splitter 소스](https://github.com/spring-projects/spring-batch/blob/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/partition/support/SimpleStepExecutionSplitter.java): 이름·완료 여부·이전 context와 재시작.
- [Step scope·late binding](https://docs.spring.io/spring-batch/reference/step/late-binding.html), [페이징 Reader](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/JdbcPagingItemReader.html): 실행별 입력·Reader 상태.
- [Provider 팩터리](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/support/SqlPagingQueryProviderFactoryBean.html): 범위 조건과 DB별 SQL 생성.
- [ChunkOrientedStep 소스](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/step/item/ChunkOrientedStep.java), [StepExecution API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/StepExecution.html): 실행 추적 상태·트랜잭션·실행별 결과.
- [ThreadPoolTaskExecutor](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/scheduling/concurrent/ThreadPoolTaskExecutor.html): 실행·대기·종료 한도.

## 6. 요약 정리

1. Partitioning은 서로 다른 입력으로 같은 worker 정의의 StepExecution을 나누는 구조다.
2. 범위는 겹치지 않고 전체 입력을 덮어야 하며 이름과 입력 의미가 재시작에도 유지되어야 한다.
3. 균등한 키 폭은 균등한 행 수·처리 시간이 아니다.
4. StepScope Reader·Writer와 실행별 context로 진행 상태를 분리한다.
5. gridSize·풀 크기·queue·pageSize·chunk·DB 연결 예산을 구분한다.
6. 실행기 포화·DB 대기·외부 허용량을 병렬 자원 한도에 포함한다.
7. 하나의 worker 실패가 다른 worker의 확정 결과를 자동 rollback하지는 않는다.
8. 같은 실패 업무를 재시작하고 완료·실패 worker 이력과 최종 입력·결과를 함께 대조한다.
9. 범위 단위 테스트와 실제 병렬·rollback·재시작 통합 검증은 별개다.

🧠 기억할 것: 일을 나눌 때 입력 범위뿐 아니라 상태·자원·실패 복구의 경계도 함께 나눈다.

## 7. 미니 퀴즈 또는 체크리스트

1. 양 끝 포함 범위를 [1,4]와 [4,7]로 나누면 무엇이 잘못되는가?
2. gridSize를 10으로 설정하면 반드시 10개 스레드가 실행되는가?
3. 모든 worker가 같은 이름의 Reader를 사용하면 context도 같은 하나를 공유하는가? 이번 구성의 전제는 무엇인가?
4. range-0이 네 행을 확정하고 range-1이 실패했다. Job이 실패했으므로 네 행도 취소되는가?
5. 같은 입력의 키가 1·2·1000000이다. 키 폭을 두 개로 나누면 행 수·시간도 균등할까?

<details>
<summary>정답과 해설</summary>

1. ID 4가 양쪽 범위에 포함된다. 이번 규칙에서는 [1,4]와 [5,7]처럼 연결해야 하며 Reader SQL도 동일한 경계 규칙을 따라야 한다.
2. 아니다. gridSize는 분할 규모를 전달하고 풀 설정은 동시 실행을 제한한다. 실제 범위 수는 Partitioner 전략과 입력에 따라 다를 수 있으며 대기·거절도 가능하다.
3. 이번에는 아니다. StepScope가 실행별 실제 Reader를 준비하고 각 worker의 ExecutionContext가 상태를 구분한다. singleton Reader 하나를 여러 스레드가 직접 공유하는 구조에는 같은 결론을 적용할 수 없다.
4. 아니다. 다른 worker가 이미 commit한 결과는 남을 수 있다. 실패 실행 이력·확정 결과·각 worker의 체크포인트를 확인하고 같은 업무로 재시작한다.
5. 아니다. 키 폭이 같은 범위라도 행 수와 처리 비용은 다를 수 있다. 행 수·소요 시간을 관찰하고 필요한 경우 보존 가능한 비용 기반 분할 계획을 설계한다.

</details>
