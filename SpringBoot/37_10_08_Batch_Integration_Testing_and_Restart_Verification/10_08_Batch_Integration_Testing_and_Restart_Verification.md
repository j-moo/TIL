# Spring Batch 통합 테스트·실패 주입과 재시작 검증

- 🎯 글의 목표: 실제 Job·JDBC 메타데이터·PostgreSQL을 함께 실행하는 테스트를 구성하고, 부분 확정·rollback·같은 업무의 재시작을 서로 다른 증거로 확인한다.
- 🧩 핵심 키워드: 통합 테스트, fixture, SpringBatchTest, JobOperatorTestUtils, JDBC JobRepository, 실패 주입, checkpoint, JobInstance, 결과 대조
- ⭐ 중요도: 높음. 정상 종료 테스트만으로는 실패한 묶음의 데이터가 남지 않는지, 재시작이 이미 확정한 결과를 중복 처리하지 않는지 알 수 없다.
- 📝 한눈에 보는 내용: 검증 범위 → 격리 DB·입력 발행 → 실패 위치 → 테스트 전용 구성 → 첫 실패·재시작 → 결과 대조 → 병렬·프로세스 장애의 별도 시험 순서로 학습한다.
- 🔗 관련 주제: [DB Reader·입력 스냅샷](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md), [Partitioning](../36_10_07_Batch_Partitioning_and_Parallel_Processing/10_07_Batch_Partitioning_and_Parallel_Processing.md), [재시작·체크포인트](../33_10_04_Spring_Batch_and_Restartability/10_04_Spring_Batch_and_Restartability.md), [테스트 전략](../10_09_06_Testing_Strategy/09_06_Testing_Strategy.md)
- 🧱 선수 지식: Job·Step·Instance·Execution, JDBC·트랜잭션, StepScope, 입력 스냅샷·페이징 Reader, JUnit의 assertion을 이해한다.

> 기준일: 2026-10-08. Java 21·Spring Boot 4.1.1이 관리하는 Batch 6.0.5·Framework 7.0.9, PostgreSQL 17을 기준으로 한다. 기존 Batch 프로젝트에 추가하는 테스트 파일이며 독립 실행 프로젝트가 아니다. 명령 검색에서 Java 8 실행 경로와 Python만 확인됐고 javac·Maven·Gradle·psql·Docker 및 저장소의 Boot 빌드 프로젝트가 없어 Java 컴파일·JUnit·DB 실행은 수행하지 않았다. 아래 결과는 예상이며 문서 정적 검사와 구분한다. [Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)

## 1. 들어가며

앞선 노트에서는 Reader 상태를 저장하고, 고정 입력을 나누어 worker마다 처리했다. 하지만 “실패하면 마지막 commit부터 다시 시작한다”는 설명을 코드에 연결했다고 해서 실제 저장소에서 그 경계가 지켜진다는 증거가 생기지는 않는다. Writer가 SQL을 실행한 뒤 실패하는 상황을 만들어 실제 남은 행과 재시작 결과를 확인해야 한다.

입력 7건을 chunk 3으로 처리한다고 생각해 보자. 첫 묶음 3건을 확정한 뒤 두 번째 묶음 3건을 DB에 쓰고 예외를 발생시킨다. 첫 실행의 결과는 6건도 0건도 아니라 앞의 3건이어야 한다. 재시작은 나머지 4건을 처리해 최종 7건을 완성해야 한다.

이번 노트는 이 경계를 **단일 Step의 실제 JDBC 통합 테스트**로 먼저 검증한다. 한 가지 실패 위치를 통제해 원인을 좁힌 뒤, 이전 Partitioning 구성의 병렬·부분 실패 시험으로 확장한다. JVM 강제 종료와 네트워크 단절은 별도 시험이며, Java 예외 하나를 던진 테스트로 그 장애까지 검증했다고 표현하지 않는다.

## 2. 핵심 개념 정리

```text
테스트 전용 DB와 JDBC 메타데이터 준비
  → UUID 입력 7건을 준비 완료로 commit
  → 같은 입력을 실제 Job으로 읽기
  → 첫 chunk commit / 두 번째 chunk SQL 후 실패·rollback
  → 저장소에서 FAILED와 확정 결과 3건 확인
  → 같은 실패 Execution을 restart
  → 새 Execution·같은 Instance·나머지 4건 확인
  → 입력 보존 + 최종 ID·제목·수량 7건 대조
  → 모든 실행 종료를 확인한 뒤 자기 fixture만 정리
```

| 확인할 질문 | 본문 연결 |
| --- | --- |
| 정책 단위 테스트와 실제 Job 테스트의 차이는? | 3.1 |
| 어디에서 실행하고 무엇을 미리 준비하는가? | 3.2 |
| 어떻게 일정한 위치에서 실패시키는가? | 3.3~3.4 |
| 같은 업무의 재시작을 어떻게 assertion으로 표현하는가? | 3.5~3.6 |
| worker 간 순서와 프로세스 종료는 어떻게 따로 검증하는가? | 3.7~3.8 |

## 3. 본문 정리

### 3.1 테스트 범위가 넓어질수록 실제로 연결하는 구성도 늘어난다

**통합 테스트는 여러 실제 구성 요소를 연결해 그 사이의 동작을 확인하는 테스트**다. 순수 정책의 계산이 맞는지와, 그 정책·Reader·Writer가 실제 트랜잭션과 연결되어 있는지는 다른 질문이다. 테스트 이름보다 실제로 실행한 구성 요소를 보고 범위를 판단한다.

| 테스트 | 실제 확인할 수 있는 것 | 확인하지 못하는 것 |
| --- | --- | --- |
| Partitioner 단위 테스트 | 입력 범위의 겹침·누락·이름 | 실제 worker 실행·DB commit |
| Reader 생명주기 테스트 | open·read·update·재개 값 | JobRepository의 진행 상태 확정 |
| 이번 단일 Step 통합 테스트 | 실제 JDBC 이력·chunk rollback·같은 업무 restart·최종 값 | worker 병렬성·프로세스 강제 종료 |
| 별도의 병렬·프로세스 시험 | 통제한 동시 실행·부분 실패·새 프로세스 복구 | 모든 장애 조합이나 외부 효과의 정확히 한 번 실행 |

예를 들어 `writer.write()` 호출을 Mockito로 확인해도 실제 INSERT가 commit되었는지는 알 수 없다. 이번에는 실제 JDBC Writer와 PostgreSQL을 사용하고, Job 호출이 끝난 뒤 별도 JDBC 조회로 결과를 읽는다. 외부 결제·알림 서비스는 이 테스트에 연결하지 않는다.

**assertion은 예상 조건과 실제 관찰을 비교해 다르면 테스트를 실패시키는 검사**다. `assertEquals(7, 실제 건수)`는 건수만 검사한다. 누락 한 건과 엉뚱한 한 건이 서로 상쇄될 수 있으므로 최종 ID와 값도 비교해야 한다.

Batch 6에서는 `@SpringBatchTest`가 테스트 도구와 scope 지원을 연결한다. `@SpringJUnitConfig`는 지정한 Spring 구성을 불러온다. 여기서는 웹 서버나 전체 애플리케이션을 시작하지 않고 테스트 Job 하나와 JDBC 기반 구성만 읽는다. [공식 Batch 테스트 안내](https://docs.spring.io/spring-batch/reference/testing.html)

### 3.2 fixture를 준비하고 실제 chunk의 트랜잭션을 가리지 않는다

**fixture는 테스트가 반복해서 사용할 입력·설정·저장소의 준비 상태**다. 이번 fixture는 UUID로 구분한 스냅샷 7건과 빈 업무 결과다. 매번 다른 시험에는 새 UUID를 쓰지만, 한 시험 안의 실패·재시작에는 같은 UUID를 유지한다.

기존 Java 프로젝트에서 다음 준비가 필요하다.

1. Java 21과 기존 Boot 버전 관리를 유지한다. PostgreSQL JDBC 드라이버·Spring JDBC·Batch 런타임·JUnit Jupiter가 있어야 한다.
2. **별도 테스트 PostgreSQL DB**에 이전 노트의 `catalog_import`, `catalog_snapshot_manifest`, `catalog_input_snapshot` 스키마를 준비한다. 테이블 정의는 [재시작 노트의 업무 스키마](../33_10_04_Spring_Batch_and_Restartability/10_04_Spring_Batch_and_Restartability.md)와 [스냅샷 노트의 추가 스키마](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md)를 사용한다.
3. 같은 DB에 **Batch 6.0.5의 PostgreSQL 메타데이터 스키마**를 한 번 준비한다. 해당 버전의 `spring-batch-core` JAR에 있는 `org/springframework/batch/core/schema-postgresql.sql`을 사용한다. 실행 이력용 테이블과 sequence까지 필요하다. 이미 있는 DB에 초기화 스크립트를 반복 적용하거나 다른 버전의 스키마를 섞지 않는다. [메타데이터 스키마 설명](https://docs.spring.io/spring-batch/reference/schema-appendix.html), [6.0.5 PostgreSQL 스크립트](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/resources/org/springframework/batch/core/schema-postgresql.sql)
4. 환경 변수 `BATCH_TEST_DB_URL`, `BATCH_TEST_DB_USER`, `BATCH_TEST_DB_PASSWORD`를 로컬에 설정한다. 실제 비밀번호는 문서·Git에 넣지 않는다.
5. 기존 `Book`, `CatalogProcessor`, `SnapshotBatchConfiguration.createReader(...)` 구현이 프로젝트에 있어야 한다. 테스트 컨텍스트에는 그 운영 Configuration들을 import하지 않고 타입·Reader 팩터리만 재사용한다.

Gradle의 기존 `dependencies` 안에 Batch 테스트 도구가 없다면 다음 **추가 조각**을 넣는다. Boot의 관리 버전을 사용하므로 임의 버전을 따로 쓰지 않는다.

```groovy
testImplementation 'org.springframework.batch:spring-batch-test' // Batch 6 테스트 도구다.
testImplementation 'org.springframework.boot:spring-boot-starter-test' // JUnit·Spring Test를 제공한다.
// 기존 PostgreSQL 드라이버 의존성과 test { useJUnitPlatform() } 설정은 유지한다.
```

이 예제는 `@SpringBootTest` 자동 설정을 사용하지 않는다. 따라서 `spring.batch.jdbc.initialize-schema` 설정만 적으면 이 컨텍스트의 DB가 자동 준비된다고 가정하지 않는다. 명시적인 JDBC 인프라와 사전 스키마를 사용한다.

테스트 클래스에는 **`@Transactional`을 붙이지 않는다**. fixture 발행만 TransactionTemplate으로 commit하고, Job의 실제 chunk 경계를 그대로 둔다. 테스트 전체의 자동 rollback으로 정리를 대신하면 실행 트랜잭션의 참여·메타데이터 생성과 별도 worker 스레드의 동작을 혼동하기 쉽다. Spring의 테스트 트랜잭션은 현재 스레드에 연결되므로 다른 스레드의 commit을 자동 취소하지도 않는다. [Spring 테스트 트랜잭션](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)

⚠️ 주의: DB URL이 운영 환경을 가리키면 UUID를 쓴다고 안전한 테스트가 되는 것은 아니다. 연결 대상·전용 계정·스키마를 먼저 확인한다. 이 노트의 코드는 fixture 삭제도 수행하므로 개발 데이터와 공유하지 않는 테스트 DB에서만 실행한다.

### 3.3 실패 위치를 정해야 무엇을 증명하는지도 정할 수 있다

**실패 주입은 검증하려는 위치에서 의도적으로 오류를 만들어 복구 경로를 관찰하는 방법**이다. SQL 실행 전에 실패시키면 해당 SQL을 호출하지 않았다는 사실은 볼 수 있지만, 실행한 SQL의 rollback은 확인하지 못한다. 따라서 이번에는 실제 Writer에 묶음을 전달한 **직후**, commit 전에 예외를 던진다.

```text
chunk 1: T001·T002·T003 → JDBC INSERT → commit
chunk 2: T004·T005·T006 → JDBC INSERT → 의도한 예외 → rollback
T007: 아직 처리 결과가 확정되지 않음
```

검증 데이터에는 T001~T007이라는 식별자를 사용한다. T004가 들어 있는 묶음에서 한 번만 실패하도록 AtomicBoolean을 쓴다. 이는 여러 호출 사이에서 값을 안전하게 바꾸는 Java 객체다. DB rollback이 Java 객체의 boolean까지 과거 값으로 되돌리는 것은 아니므로 첫 실패 뒤 false가 유지되고 재시작에는 실패를 다시 만들지 않는다.

이 대역은 DB 잠금·연결 단절을 흉내 내는 구현이 아니라 **SQL 뒤 Java 예외가 chunk 전체를 취소하는지** 확인한다. 이번 Step에는 retry·skip을 켜지 않으며 SQL은 upsert가 아닌 INSERT다. 잘못된 체크포인트로 확정한 항목을 다시 쓰면 기본키 중복으로 실패하도록 둔다.

테스트의 Job 시작 실행기는 `SyncTaskExecutor`로 지정한다. 이 실행기는 호출한 스레드에서 작업을 실행하므로 이 구성의 start·restart 호출이 끝난 뒤 종료 상태를 검사할 수 있다. 이것은 일반적인 비동기 JobOperator의 반환을 완료로 간주해도 된다는 뜻이 아니다. [SyncTaskExecutor API](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/core/task/SyncTaskExecutor.html)

### 3.4 테스트 전용 JDBC 구성과 실패 Writer를 만든다

다음은 기존 프로젝트의 `src/test/java/com/example/batch/RestartProbeConfiguration.java`에 추가하는 **파일 전체**다. 테스트 소스에만 두며 컴포넌트 스캔으로 전체 운영 Job을 같이 읽지 않는다. 같은 DataSource·JdbcTransactionManager를 업무 Writer와 JobRepository에 연결한다.

Batch 6의 `@EnableBatchProcessing` 기본 구성만으로는 이번 영속 재시작 검증에 충분하지 않다. `@EnableJdbcJobRepository`를 함께 사용해 JDBC 이력을 명시한다. 이 수동 구성은 기존 Boot 자동 설정과 중복 등록하려는 것이 아니라 독립적인 테스트 컨텍스트의 구성이다. [EnableBatchProcessing](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/configuration/annotation/EnableBatchProcessing.html), [EnableJdbcJobRepository](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/configuration/annotation/EnableJdbcJobRepository.html)

```java
package com.example.batch;

import java.sql.Date; // 업무 날짜를 JDBC 값으로 전달한다.
import java.time.LocalDate; // 실행 파라미터의 날짜를 해석한다.
import java.util.Objects; // 환경 변수·입력 연결을 검사한다.
import java.util.concurrent.atomic.AtomicBoolean; // 이번 컨텍스트의 실패를 한 번만 소비한다.
import javax.sql.DataSource;
import com.example.batch.CatalogBatchConfiguration.Book; // 기존 입력 record를 재사용한다.
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.batch.core.configuration.annotation.EnableJdbcJobRepository;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.job.parameters.DefaultJobParametersValidator;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.step.builder.ChunkOrientedStepBuilder;
import org.springframework.batch.infrastructure.item.ItemWriter;
import org.springframework.batch.infrastructure.item.database.JdbcPagingItemReader;
import org.springframework.batch.infrastructure.item.database.builder.JdbcBatchItemWriterBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.support.JdbcTransactionManager;

@Configuration(proxyBeanMethods = false)
@EnableBatchProcessing(taskExecutorRef = "probeJobExecutor") // Job 호출의 완료 순서를 단순하게 한다.
@EnableJdbcJobRepository // 기본 이름 dataSource·transactionManager로 JDBC 이력을 구성한다.
public class RestartProbeConfiguration {
    @Bean
    public DataSource dataSource() {
        var source = new DriverManagerDataSource(); // 테스트용 단순 연결이며 운영 풀의 성능 시험은 아니다.
        source.setUrl(requiredEnv("BATCH_TEST_DB_URL")); // 전용 PostgreSQL DB를 가리켜야 한다.
        source.setUsername(requiredEnv("BATCH_TEST_DB_USER"));
        source.setPassword(requiredEnv("BATCH_TEST_DB_PASSWORD")); // 저장소에 비밀값을 쓰지 않는다.
        return source;
    }

    @Bean
    public JdbcTransactionManager transactionManager(DataSource dataSource) {
        return new JdbcTransactionManager(dataSource); // 업무 INSERT와 진행 상태의 DB 경계를 맞춘다.
    }

    @Bean
    public SyncTaskExecutor probeJobExecutor() {
        return new SyncTaskExecutor(); // 이 시험에서는 Job을 별도 스레드에 던지지 않는다.
    }

    @Bean
    public AtomicBoolean writeFailureArmed() {
        return new AtomicBoolean(false); // 테스트가 실행 직전에 의도적으로 true로 바꾼다.
    }

    @Bean
    @StepScope
    public JdbcPagingItemReader<Book> probeReader(DataSource dataSource,
            @Value("#{jobParameters['snapshotId']}") String snapshotId,
            @Value("#{jobParameters['sourceRevision']}") String revision) throws Exception {
        if (!Objects.equals(snapshotId, revision)) {
            throw new IllegalArgumentException("입력과 결과 버전이 같아야 합니다.");
        }
        return SnapshotBatchConfiguration.createReader(dataSource, snapshotId);
        // 이전의 준비 완료 검사·고유 정렬·pageSize 3·saveState를 그대로 사용한다.
    }

    @Bean
    @StepScope
    public ItemWriter<Book> probeWriter(DataSource dataSource,
            @Qualifier("writeFailureArmed") AtomicBoolean armed,
            @Value("#{jobParameters['businessDate']}") String date,
            @Value("#{jobParameters['sourceRevision']}") String revision) throws Exception {
        LocalDate businessDate = LocalDate.parse(date); // 저장 결과의 업무 범위를 고정한다.
        var delegate = new JdbcBatchItemWriterBuilder<Book>()
                .dataSource(dataSource) // chunk와 같은 DB 연결 자원을 사용한다.
                .sql("""
                     INSERT INTO catalog_import
                       (business_date, source_revision, book_id, title, stock)
                     VALUES (?, ?, ?, ?, ?)
                     """) // 확정한 결과를 중복 INSERT하면 기본키 오류를 드러낸다.
                .itemPreparedStatementSetter((book, statement) -> {
                    statement.setDate(1, Date.valueOf(businessDate)); // 업무 날짜다.
                    statement.setString(2, revision); // UUID 입력 버전이다.
                    statement.setString(3, book.bookId()); // 변환한 도서 ID다.
                    statement.setString(4, book.title()); // 변환한 제목이다.
                    statement.setInt(5, book.stock()); // 검증한 수량이다.
                })
                .build();
        delegate.afterPropertiesSet(); // 내부 Writer는 별도 Spring Bean이 아니므로 직접 초기화한다.
        return items -> {
            delegate.write(items); // 먼저 실제 SQL을 실행하되 아직 commit되지는 않았다.
            boolean target = items.getItems().stream()
                    .anyMatch(book -> book.bookId().equals("T004")); // 두 번째 묶음을 식별한다.
            if (target && armed.compareAndSet(true, false)) {
                throw new InjectedWriteFailure(); // SQL 뒤 실패를 한 번만 만들어 rollback을 시험한다.
            }
        }; // JDBC Writer는 ItemStream이 아니며 내부에 Reader를 숨기는 래퍼도 아니다.
    }

    @Bean
    public Step restartProbeStep(JobRepository repository, JdbcTransactionManager transactionManager,
            @Qualifier("probeReader") JdbcPagingItemReader<Book> reader,
            @Qualifier("probeWriter") ItemWriter<Book> writer) {
        return new ChunkOrientedStepBuilder<Book, Book>("restartProbeStep", repository, 3)
                .transactionManager(transactionManager) // 세 항목씩 결과·진행 상태를 확정한다.
                .reader(reader) // Reader 생명주기를 직접 등록해 재개 상태를 저장한다.
                .processor(new CatalogProcessor()) // 기존 검증·공백 정리를 실제로 실행한다.
                .writer(writer) // 실패 대역 안의 실제 JDBC Writer로 저장한다.
                .build(); // retry·skip·worker 병렬성은 이번 경계 시험에 추가하지 않는다.
    }

    @Bean
    public Job restartProbeJob(JobRepository repository,
            @Qualifier("restartProbeStep") Step step) {
        String[] required = {"businessDate", "sourceRevision", "snapshotId"};
        return new JobBuilder("restartProbeJob", repository)
                .validator(new DefaultJobParametersValidator(required, new String[0]))
                .start(step) // 테스트용 Step 하나의 Job이다.
                .build(); // incrementer를 넣지 않아 임의로 다음 업무를 만들지 않는다.
    }

    public static final class InjectedWriteFailure extends RuntimeException {
        public InjectedWriteFailure() {
            super("TEST_FAILURE_AFTER_JDBC_WRITE"); // 실제 장애와 구분할 이유 코드다.
        }
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " 환경 변수가 필요합니다."); // 자동 통과하지 않는다.
        }
        return value; // 비밀번호 자체는 예외 메시지에 넣지 않는다.
    }
}
```

Reader는 실제 Step 실행 때 만들어지고, Writer는 그 실행의 날짜·버전을 받아 결과를 저장한다. Writer의 대역만 테스트 전용이며 Processor·JDBC 저장·Reader 재개는 실제 동작이다. 래퍼 내부에서 직접 만든 Writer를 초기화하는 이유도 Spring이 그 내부 객체의 생명주기까지 대신 관리하지 않기 때문이다. [JDBC Writer builder API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/builder/JdbcBatchItemWriterBuilder.html)

이 구성은 실제 운영의 `snapshotImportJob` 전체를 그대로 검증하는 것이 아니다. 같은 Reader 팩터리와 Processor를 사용하는 **재시작 경계 전용 Job**이다. 운영 Job의 Bean 연결·listener·흐름이 달라질 수 있으므로 마지막에는 운영 구성 자체를 별도 통합 테스트에 불러와 확인해야 한다.

### 3.5 첫 실패와 같은 Instance의 재시작을 한 테스트에서 확인한다

다음은 `src/test/java/com/example/batch/RestartProbeTest.java`에 추가하는 **파일 전체**다. 앞 구성 파일과 사전 스키마가 필요하다. 테스트 메서드 중간의 실패는 예상한 Job 실패이며, JUnit 테스트 자체는 그 실패와 복구가 예상대로였을 때 통과한다.

`JobOperatorTestUtils.startJob(parameters)`에 명시적인 파라미터를 전달한다. 인자 없는 startJob은 고유한 임의 파라미터를 생성하므로 이 재시작 시험에서 두 번 호출하는 방식으로 사용하지 않는다. 재시작은 `JobOperator.restart(저장소에서 읽은 실패 Execution)`으로 수행한다. [JobOperatorTestUtils API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/test/JobOperatorTestUtils.html), [JobOperator API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html)

```java
package com.example.batch;

import java.sql.Date; // JDBC 결과 조건에 업무 날짜를 전달한다.
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID; // 시험 간 입력·결과를 고유하게 구분한다.
import java.util.concurrent.atomic.AtomicBoolean;
import javax.sql.DataSource;
import com.example.batch.CatalogBatchConfiguration.Book;
import com.example.batch.RestartProbeConfiguration.InjectedWriteFailure;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.test.JobOperatorTestUtils;
import org.springframework.batch.test.context.SpringBatchTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;

@SpringBatchTest // Batch 테스트 도구와 scope 지원을 연결한다.
@SpringJUnitConfig(RestartProbeConfiguration.class) // 운영 컴포넌트 스캔 없이 이 구성만 읽는다.
class RestartProbeTest {
    private static final LocalDate DATE = LocalDate.of(2026, 10, 8); // 업무 날짜이며 실행 시각이 아니다.

    @Autowired DataSource dataSource;
    @Autowired JdbcTransactionManager transactionManager;
    @Autowired JobOperatorTestUtils jobs;
    @Autowired JobOperator operator;
    @Autowired JobRepository repository;
    @Autowired @Qualifier("restartProbeJob") Job job;
    @Autowired @Qualifier("writeFailureArmed") AtomicBoolean armed;

    @Test
    void rollsBackSecondChunkAndRestartsTheSameBusinessInstance() throws Exception {
        String snapshotId = "probe-" + UUID.randomUUID(); // 다른 시험의 결과를 건드리지 않는다.
        JobParameters parameters = new JobParametersBuilder()
                .addString("businessDate", DATE.toString(), true)
                .addString("sourceRevision", snapshotId, true) // 같은 값으로 실패·재시작한다.
                .addString("snapshotId", snapshotId, true)
                .toJobParameters(); // run.id나 현재 시각으로 새 업무를 만들지 않는다.
        var jdbc = new JdbcTemplate(dataSource); // 테스트에 트랜잭션이 없어 조회는 별도 연결을 얻는다.
        jobs.setJob(job); // 어떤 Job을 시험할지 명시한다.
        try {
            publishFixture(jdbc, snapshotId); // 입력과 ready를 commit한 뒤 Job을 시작한다.
            List<Book> originalInput = inputBooks(jdbc, snapshotId); // 입력 보존을 비교할 기준이다.
            assertEquals(7, originalInput.size()); // 준비가 잘못된 시험을 시작하지 않는다.
            armed.set(true); // 두 번째 chunk의 SQL 뒤에 한 번 실패하도록 설정한다.

            JobExecution returnedFirst = jobs.startJob(parameters); // 동기 실행의 반환 객체를 받는다.
            assertTrue(returnedFirst.getAllFailureExceptions().stream().anyMatch(RestartProbeTest::isInjected));
            // 메모리에 남은 원인 타입으로 연결 오류 등 다른 실패를 구별한다.
            JobExecution first = load(returnedFirst); // 상태·context는 JDBC 저장소에서 다시 읽는다.
            assertEquals(BatchStatus.FAILED, first.getStatus()); // 영속된 Job 실패를 관찰한다.
            assertEquals(List.of(expectedBook(1), expectedBook(2), expectedBook(3)),
                    storedBooks(jdbc, snapshotId)); // 두 번째 묶음의 INSERT는 남으면 안 된다.
            assertEquals(originalInput, inputBooks(jdbc, snapshotId)); // 실패가 입력을 바꾸지 않는다.

            JobExecution second = load(operator.restart(first)); // 실패 이력을 그대로 재시작한다.
            assertEquals(BatchStatus.COMPLETED, second.getStatus()); // 나머지 작업이 완료된다.
            assertNotEquals(first.getId(), second.getId()); // 새 실행 시도가 생성된다.
            assertEquals(first.getJobInstance().getId(), second.getJobInstance().getId());
            // 같은 업무 Instance이며 단순히 새 UUID로 성공한 시험이 아니다.
            assertEquals(first.getJobParameters(), second.getJobParameters()); // 입력 의미를 유지한다.
            assertEquals(1, second.getStepExecutions().size()); // 이번 구성에는 Step 하나뿐이다.
            var resumedStep = second.getStepExecutions().iterator().next();
            assertEquals(BatchStatus.COMPLETED, resumedStep.getStatus());
            assertEquals(4L, resumedStep.getWriteCount()); // 이번 실행은 미확정 네 항목만 쓴다.

            var expected = new ArrayList<Book>();
            for (int id = 1; id <= 7; id++) {
                expected.add(expectedBook(id)); // ID뿐 아니라 정리한 제목·수량도 비교한다.
            }
            assertEquals(expected, storedBooks(jdbc, snapshotId)); // 최종 전체 업무 결과는 일곱 건이다.
            assertEquals(originalInput, inputBooks(jdbc, snapshotId)); // 재시작 뒤에도 입력은 같다.
            assertEquals(2, repository.getJobExecutions(second.getJobInstance()).size());
            // 실패·완료 두 시도가 같은 Instance의 영속 이력에 남았는지 확인한다.
        } finally {
            armed.set(false); // 실패 주입 상태를 다음 시험에 남기지 않는다.
            cleanupOwnFixture(jdbc, snapshotId, parameters); // 종료한 자기 업무만 정리한다.
        }
    }

    private void publishFixture(JdbcTemplate jdbc, String snapshotId) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            jdbc.update("INSERT INTO catalog_snapshot_manifest (snapshot_id, ready, item_count) "
                    + "VALUES (?, false, 0)", snapshotId); // 아직 읽을 수 없는 입력 버전이다.
            for (int id = 1; id <= 7; id++) {
                jdbc.update("INSERT INTO catalog_input_snapshot "
                        + "(snapshot_id, item_id, book_id, title, stock) VALUES (?, ?, ?, ?, ?)",
                        snapshotId, id, "T%03d".formatted(id), " 도서 " + id + " ", id * 10);
                // 앞뒤 일반 공백은 실제 Processor가 정리하는지도 확인할 입력이다.
            }
            jdbc.update("UPDATE catalog_snapshot_manifest SET ready = true, item_count = 7 "
                    + "WHERE snapshot_id = ?", snapshotId); // 발행 표식과 일곱 행을 함께 확정한다.
        }); // 메서드 반환 시 입력 준비 트랜잭션이 끝난다.
    }

    private JobExecution load(JobExecution execution) {
        JobExecution stored = repository.getJobExecution(execution.getId()); // 메모리 반환값만 믿지 않는다.
        assertNotNull(stored); // 이력이 DB에 존재해야 한다.
        return stored; // StepExecution·context도 포함한 저장소 조회 결과다.
    }

    private List<Book> inputBooks(JdbcTemplate jdbc, String snapshotId) {
        return jdbc.query("SELECT book_id, title, stock FROM catalog_input_snapshot "
                + "WHERE snapshot_id = ? ORDER BY item_id",
                (rs, row) -> new Book(rs.getString("book_id"), rs.getString("title"), rs.getInt("stock")),
                snapshotId); // 원본 스냅샷의 값을 정리하지 않고 그대로 읽는다.
    }

    private List<Book> storedBooks(JdbcTemplate jdbc, String revision) {
        return jdbc.query("SELECT book_id, title, stock FROM catalog_import "
                + "WHERE business_date = ? AND source_revision = ? ORDER BY book_id",
                (rs, row) -> new Book(rs.getString("book_id"), rs.getString("title"), rs.getInt("stock")),
                Date.valueOf(DATE), revision); // 다른 날짜·버전의 결과는 비교에 섞지 않는다.
    }

    private static Book expectedBook(int id) {
        return new Book("T%03d".formatted(id), "도서 " + id, id * 10);
        // 공백을 정리한 정상 결과를 Reader·Writer와 독립적으로 계산한다.
    }

    private static boolean isInjected(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof InjectedWriteFailure) {
                return true; // wrapper 안쪽이어도 의도한 실패인지 확인한다.
            }
        }
        return false; // SQL·권한·연결 등 다른 오류는 이 시험의 예상 실패가 아니다.
    }

    private void cleanupOwnFixture(JdbcTemplate jdbc, String snapshotId, JobParameters parameters) {
        var instance = repository.getJobInstance("restartProbeJob", parameters); // 자기 UUID 업무만 찾는다.
        if (instance != null) {
            boolean running = repository.getJobExecutions(instance).stream()
                    .anyMatch(execution -> execution.getStatus().isRunning());
            if (running) {
                throw new IllegalStateException("실행 중인 fixture는 삭제하지 않습니다.");
            }
            repository.deleteJobInstance(instance); // 이 Instance의 관련 실행·context 그래프만 삭제한다.
        }
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            jdbc.update("DELETE FROM catalog_import WHERE business_date = ? AND source_revision = ?",
                    Date.valueOf(DATE), snapshotId); // 자기 결과만 제거한다.
            jdbc.update("DELETE FROM catalog_input_snapshot WHERE snapshot_id = ?", snapshotId);
            jdbc.update("DELETE FROM catalog_snapshot_manifest WHERE snapshot_id = ?", snapshotId);
            // 외래키 순서로 자기 입력을 정리하며 전체 테이블을 비우지 않는다.
        });
    }
}
```

준비 데이터는 먼저 확정하고, 첫 실행의 저장 결과를 확인한 다음 재시작한다. 중간에서 입력·결과·메타데이터를 삭제하지 않는다. `getJobExecution`은 해당 실행과 관련 상태를 다시 읽고, `deleteJobInstance`는 선택한 Instance의 실행 그래프를 삭제하는 API다. 테스트 DB의 전체 메타데이터를 지우는 도구 호출로 대체하지 않는다. [JobRepository 조회·삭제 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/repository/JobRepository.html)

실패 예외의 Java 객체와 DB에 저장된 종료 설명도 구분한다. 원인 타입 검사는 동기 실행이 반환한 메모리 객체에서 수행한다. JDBC 저장소는 상태·종료 코드·설명 등을 읽는 것이지 `getAllFailureExceptions()`의 Throwable 객체 목록을 그대로 복원하는 저장소가 아니다. DB에서 다시 읽은 객체의 예외 목록으로 위 타입 검사를 대체하지 않는다. [JdbcJobExecutionDao 6.0.5 매핑](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/repository/dao/jdbc/JdbcJobExecutionDao.java)

정리 코드는 assertion 실패 뒤에도 실행된다. 실패 원인을 DB에 남겨 조사하려면 전용 DB에서 정리 실행을 잠시 보류하고, 기록한 UUID·Execution ID로 조사한 뒤 같은 범위만 정리한다. 실행 중인 업무는 지우지 않으며 정리 자체의 DB 오류도 무시하지 않는다. 이 테스트가 업무 입력을 자동으로 영구 보존하는 운영 기능을 제공하는 것은 아니다.

### 3.6 assertion을 결과 증거로 읽고 테스트를 실행한다

이번 예제의 예상 관찰은 다음과 같다. 내부 context 키의 이름·직렬화 문자열을 직접 assertion으로 고정하지 않고 재개 후 처리 결과를 검사한다. 구현 내부 키를 바꾸어 원하는 상태를 만드는 테스트는 실제 복구 흐름의 증거가 되지 않는다.

| 관찰 시점 | 검사하는 것 | 의미 |
| --- | --- | --- |
| 첫 실행 종료 | 영속된 FAILED·반환 객체의 실패 원인 타입 | 의도한 SQL 뒤 실패이며 다른 설정 오류가 아님 |
| 첫 결과 조회 | T001~T003의 정확한 값만 존재 | 첫 chunk는 확정, 두 번째 chunk는 rollback |
| 재시작 종료 | 새 Execution ID·같은 Instance·같은 파라미터 | 같은 실패 업무를 복구함 |
| 재개 Step | writeCount 4 | 이번 시도는 미확정 나머지를 처리함 |
| 최종 결과 조회 | T001~T007의 ID·제목·수량 일치 | 누락·엉뚱한 행·값 오류를 함께 대조함 |
| 입력 재조회 | 발행 후의 입력 값과 동일 | 실패·재시작이 입력을 변경하지 않음 |

이 기대는 pageSize 3·chunk 3, 단일 Step, skip·filter 없음, 입력당 결과 한 행이라는 이번 구성에 한정한다. 실패 Execution의 카운터를 SQL 호출 수로 해석하거나 모든 Job의 최종 결과가 마지막 writeCount와 같다고 일반화하지 않는다. [ChunkOrientedStep 6.0.5 구현](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/step/item/ChunkOrientedStep.java)

Java 프로젝트 루트의 PowerShell에서 다음 명령을 실행한다. **TIL 저장소 루트에서 실행하는 명령은 아니다.** Gradle과 Maven 중 현재 프로젝트의 Wrapper만 선택한다.

```powershell
# Gradle 프로젝트라면 이 테스트 클래스 한 개를 실행한다.
./gradlew.bat test --tests com.example.batch.RestartProbeTest

# Maven 프로젝트라면 같은 테스트 클래스를 Surefire로 실행한다.
./mvnw.cmd -Dtest=RestartProbeTest test
```

예상 결과는 JUnit 테스트 한 개의 통과다. 테스트 중간의 Job FAILED 로그는 의도한 관찰이지만, 로그에 FAILED가 보였다는 사실만으로 테스트 통과를 판단하지 않는다. 테스트 리포트와 assertion을 확인한다. 이번 작성 환경에서는 위 Java 명령과 DB 테스트를 실행하지 않았다.

정상 입력만 처리하는 시험, 첫 chunk에서 실패하는 시험, 마지막 작은 chunk에서 실패하는 시험도 각각 새 UUID fixture로 추가할 수 있다. 완료한 업무를 다시 시작하는 시험과 실패 업무를 재시작하는 시험은 기대가 다르므로 분리한다. 같은 테스트 컨텍스트의 실패 스위치를 공유하는 시험을 병렬로 실행하지 않는다.

⚠️ 주의: 동기 Job 호출도 잘못된 DB 연결이나 잠금에서 오래 기다릴 수 있다. 테스트용 JDBC 연결·SQL·CI 실행에 유한 시간 제한을 두고, 시간 초과 시 실행 종료를 확인하기 전에 fixture를 삭제하지 않는다. 테스트를 다른 스레드에서 강제 중단하는 timeout이 DB 작업의 취소·rollback까지 보장하는 것도 아니다.

### 3.7 병렬 worker 시험은 실행 순서를 추측하지 않고 통제한다

**동기화 지점은 특정 실행이 어느 단계에 도착했는지 서로 확인하는 장치**다. CountDownLatch는 다른 스레드가 신호를 줄 때까지 기다리는 Java 도구다. 고정 sleep으로 “아마 첫 worker가 끝났을 것”이라고 가정하는 것과 다르다.

이전 Partitioning Job의 range-0은 1~4, range-1은 5~7을 처리했다. “range-0의 네 행은 남고 range-1의 세 행은 없다”를 정확히 검사하려면 다음 **별도 테스트 설계**가 필요하다. 아래 절차는 이번 단일 Step 테스트에 구현되어 있지 않다.

1. range-1의 테스트 Writer는 SQL 실행 전에 진입 신호를 보내고 제한 시간 동안 해제 신호를 기다린다. range-0은 정상 처리한다.
2. 테스트 제어 스레드가 계속 관찰할 수 있도록 전체 Job 호출은 별도의 제어용 실행기에 제출한다. manager·worker의 전용 풀과 이 실행기를 구분한다.
3. 제어 스레드는 range-1 진입을 확인하고, 저장소에서 range-0의 COMPLETED와 실제 결과 네 행을 제한 시간 안에 확인한다. 한 chunk 완료와 worker 전체 완료를 혼동하지 않는다.
4. range-1을 해제한다. 그 Writer는 실제 세 행을 쓴 다음 테스트 예외를 던져 rollback한다. Job Future의 종료를 기다린 뒤 네 행만 남는지 확인한다.
5. 실패 주입을 해제하고 같은 업무를 restart한다. 완료 worker가 중복 INSERT하지 않으며 최종 일곱 행의 값이 일치하는지 확인한다. worker별 새 실행 이력도 함께 본다.
6. finally에서 대기 신호를 해제하고, Job·worker 종료와 실행기 정리를 확인한 뒤 자기 fixture를 정리한다. latch·Future 대기는 모두 유한하게 둔다.

여기서 두 worker의 진입을 맞추는 시험은 **동시 실행 가능성**, 완료 worker 뒤 다른 worker를 실패시키는 시험은 **부분 확정·재시작**을 검증한다. 한 시험의 완료 시간이 짧았다는 이유로 둘을 모두 검증했다고 하지 않는다. 별도 스레드가 있는 시험은 테스트 메서드가 종료되어도 DB 작업이 남을 수 있으므로 종료 확인이 특히 중요하다.

정상 병렬 실행의 로그 순서를 T001부터 T007까지로 assertion하지 않는다. 병렬 실행의 시작·완료 순서와 최종 결과를 ORDER BY로 조회한 순서는 다르다. 재시작 시험에는 입력·worker 이름·분할 이름·범위 의미를 유지한다. [Partitioning과 재시작 설명](https://docs.spring.io/spring-batch/reference/scalability.html)

### 3.8 예외 실패와 프로세스 강제 종료는 다른 시험이다

이번 예외는 프레임워크가 오류를 받아 rollback·실패 이력을 정리할 기회를 준다. 반면 프로세스를 강제로 종료하면 종료 콜백이 실행되지 않거나 실행 이력이 STARTED에 남을 수 있다. 따라서 “같은 JVM에서 한 번 실패하고 다시 성공”은 새 프로세스의 복구 시험을 대신하지 못한다.

프로세스 종료 시험에서는 **입력·업무 결과·JDBC 메타데이터를 그대로 남긴 전용 DB**를 사용한다. 첫 프로세스에서 특정 chunk가 commit된 증거를 확인한 뒤 종료하고, 두 번째 프로세스가 같은 Job 정의·입력 버전·DB를 사용하게 한다. 새 프로세스에는 메모리 AtomicBoolean의 이전 값이 없으므로 장애 주입을 비활성화하는 방법도 별도로 정한다.

중단된 프로세스 때문에 이력이 STARTED에 남았다면 일반 FAILED 재시작과 조건이 다르다. Batch 6의 `recover(JobExecution)`는 이러한 실행을 복구 가능하게 표시하는 API지만, 실제 실행 주체가 더 이상 작업하지 않는다는 확인 없이 적용하면 살아 있는 작업과 새 작업이 경쟁할 수 있다. 이 노트의 테스트에서는 recover를 호출하거나 메타데이터 상태를 SQL로 바꾸지 않는다. [JobOperator recover 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html)

새 프로세스 복구에서 확인할 것은 업무 식별 유지, 입력 보존, 이미 확정한 결과 유지, 미확정 입력의 재개, 최종 ID·값 일치다. 외부 알림이나 메시지 발행이 있다면 DB rollback으로 그 효과가 취소된다고 가정하지 않고 별도 멱등성·Outbox 검증을 연결한다.

## 4. 적용 관점에서 다시 보기

먼저 검증할 질문을 하나로 좁히고 실제 DB·메타데이터를 연결한다. fixture 발행을 commit한 뒤 Job 자체의 chunk 트랜잭션을 실행하고, 의도한 실패 타입과 실패 위치를 관찰한다.

첫 실패는 저장소의 상태와 확정 행으로 확인한다. 재시작은 입력을 새로 만들지 않고 같은 실패 이력으로 수행하며, 새 Execution·같은 Instance·실행별 처리 수·최종 결과를 각각 비교한다. 입력과 결과의 건수만 맞추지 않고 ID·변환한 값도 대조한다.

단일 Step 경계를 확인한 뒤 병렬 worker의 순서·부분 확정·재실행을 통제한 별도 시험으로 넓힌다. 프로세스 종료 시험은 종료 정리의 유무가 다르므로 영속 상태를 유지한 새 프로세스에서 수행한다.

정리는 모든 작업 종료를 확인한 뒤 선택한 업무의 메타데이터·결과·입력만 대상으로 한다. fixture 삭제나 자동 rollback을 검증의 중간에 넣어 복구에 필요한 증거를 지우지 않는다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

재시작의 증거는 성공 상태 하나가 아니라 부분 확정·실패 묶음 취소·같은 업무의 새 시도·최종 값 일치의 조합이다. 테스트가 실제로 연결한 구성과 통제한 장애까지만 검증 범위로 설명해야 한다.

### 5.2 이전·다음 학습과의 연결

[Partitioning 노트](../36_10_07_Batch_Partitioning_and_Parallel_Processing/10_07_Batch_Partitioning_and_Parallel_Processing.md)의 복구 가정을 단일 JDBC 경계의 assertion과 병렬 시험 절차로 연결했다. 다음에는 [Spring Batch 운영·실행 제어와 장애 복구](../38_10_09_Batch_Operations_and_Failure_Recovery/10_09_Batch_Operations_and_Failure_Recovery.md)를 학습해, 실행 상태·중지·중단된 프로세스의 확인·복구·관찰을 안전한 운영 절차로 묶는다.

### 5.3 더 파볼 만한 주제

운영 Job 구성을 그대로 불러오는 회귀 테스트, 컨테이너 기반 일회성 DB, CI의 장애 시험과 테스트 데이터 보존을 확장할 수 있다. 외부 메시지·알림이 있는 작업은 DB 결과와 별도로 중복 효과와 재전달의 증거를 확인해야 한다.

### 5.4 참고 자료

- [Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html): Batch·Framework와 테스트 의존성의 기준 버전.
- [Batch 테스트 안내](https://docs.spring.io/spring-batch/reference/testing.html), [JobOperatorTestUtils](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/test/JobOperatorTestUtils.html): 테스트 컨텍스트·scope와 명시적 파라미터의 Job 실행.
- [EnableBatchProcessing](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/configuration/annotation/EnableBatchProcessing.html), [EnableJdbcJobRepository](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/configuration/annotation/EnableJdbcJobRepository.html): 기본 인프라와 JDBC 저장소의 구분.
- [메타데이터 스키마](https://docs.spring.io/spring-batch/reference/schema-appendix.html): 실행·진행 상태의 테이블과 DB별 준비 스크립트.
- [JobOperator](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html), [JobRepository](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/repository/JobRepository.html): 실패 이력 재시작·recover·영속 상태 조회·선택한 Instance 삭제.
- [JdbcJobExecutionDao 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/repository/dao/jdbc/JdbcJobExecutionDao.java): 영속 종료 정보와 메모리의 예외 객체 목록을 구분하는 근거.
- [SyncTaskExecutor](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/core/task/SyncTaskExecutor.html): 호출 스레드에서 실행하는 테스트 구성의 의미.
- [Spring 테스트 트랜잭션](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html): 테스트 rollback·스레드·강제 timeout의 경계.
- [JDBC Writer builder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/builder/JdbcBatchItemWriterBuilder.html), [ChunkOrientedStep 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/step/item/ChunkOrientedStep.java): 실제 SQL 저장과 chunk 실패·확정 경로.
- [확장·병렬 처리](https://docs.spring.io/spring-batch/reference/scalability.html): worker별 실행 상태·부분 실패·재시작 검증으로의 연결.

## 6. 요약 정리

1. 계산·Reader·실제 Job·병렬·프로세스 종료 테스트는 검증 범위가 다르다.
2. 입력 fixture는 준비 완료로 commit하고 Job의 실제 chunk 트랜잭션을 시험한다.
3. SQL 뒤 commit 전 실패를 만들어야 이미 실행한 업무 SQL의 rollback을 확인할 수 있다.
4. 같은 시험의 실패·재시작에는 입력 버전과 업무 파라미터를 유지한다.
5. 새 Execution과 같은 Instance를 검사해 새 업무 실행으로 복구를 우회하지 않는다.
6. 실행별 writeCount와 최종 업무 결과를 구분하며 ID·제목·수량도 대조한다.
7. 병렬 시험은 latch·저장소 상태로 순서를 통제하고 고정 sleep에 의존하지 않는다.
8. 예외 실패는 새 프로세스 복구·외부 효과의 정확히 한 번 실행을 증명하지 않는다.
9. 실행 종료 확인 뒤 자기 fixture만 정리하며 중간에 체크포인트를 삭제하지 않는다.

🧠 기억할 것: 실패 상태, 남은 데이터, 같은 업무의 재개, 최종 값이 모두 맞아야 복구의 경계를 확인한 것이다.

## 7. 미니 퀴즈 또는 체크리스트

1. 두 번째 묶음의 Writer를 SQL 실행 전에 실패시키는 것과 실행 직후 실패시키는 것은 어떤 검증 차이가 있는가?
2. 첫 실패 뒤 새 UUID로 다시 실행해서 성공했다. 같은 업무의 재시작이 검증된 것인가?
3. 재개 실행의 writeCount는 4이고 업무 테이블에는 7건이 있다. 이번 테스트에서 정상인가?
4. 병렬 테스트에서 1초 sleep 뒤 결과를 확인하는 것보다 latch와 worker 종료 상태를 확인하는 이유는 무엇인가?
5. 같은 JVM의 예외 실패·재시작 테스트가 통과했다. 프로세스를 강제 종료한 뒤 복구하는 동작까지 검증했다고 할 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 실행 전 실패는 SQL을 호출하지 않은 경로다. 실행 직후 실패는 DB에 전달한 INSERT가 commit 전에 rollback되는지 확인한다. 둘 다 실패지만 증명하는 경계가 다르다.
2. 아니다. 새로운 Instance의 정상 처리일 수 있다. 같은 실패 이력으로 restart하고 새 Execution·같은 Instance·같은 입력과 파라미터를 확인해야 한다.
3. 정상이다. 첫 실행에서 확정한 세 행과 재개 실행에서 쓴 네 행을 합친 최종 결과다. 건수뿐 아니라 전체 ID·변환한 값을 비교한다.
4. 장비·부하에 따라 1초 안에 완료하지 않을 수 있고 우연한 통과도 생긴다. 진입 신호·영속 종료 상태·실제 결과를 제한 시간 안에 확인해 의도한 실행 순서를 통제한다.
5. 아니다. 정상적인 예외 정리와 갑작스러운 프로세스 종료는 다르다. 입력·메타데이터·결과를 유지하고 별도 프로세스로 복구하는 시험이 필요하다.

</details>
