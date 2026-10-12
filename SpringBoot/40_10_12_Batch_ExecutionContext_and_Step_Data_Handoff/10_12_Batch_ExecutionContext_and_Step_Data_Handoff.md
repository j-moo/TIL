# Spring Batch ExecutionContext·단계 간 데이터 전달과 상태 관리

- 🎯 글의 목표: Step·Job ExecutionContext의 범위와 저장 시점을 구분하고, 단계 간 작은 요약 정보를 전달·검증하며 재시작에서 안전하게 재사용한다.
- 🧩 핵심 키워드: ExecutionContext, ItemStream, 체크포인트, promotion, StepScope, dirty flag, 직렬화, 상태 스키마 버전
- ⭐ 중요도: 높음. 메모리의 값과 영속된 상태를 혼동하면 서버 재시작 때 정보가 사라지거나 오래된 값을 새 결과로 오해할 수 있다.
- 📝 한눈에 보는 내용: 입력·진행 상태·결과 구분 → Step·Job 범위 → 저장 경계 → 요약 생산·승격·소비 → 재시작·타입·버전 검증 → 테스트
- 🔗 관련 주제: [다단계 Job·결과 검증](../39_10_11_Batch_Multi_Step_Flow_and_Result_Verification/10_11_Batch_Multi_Step_Flow_and_Result_Verification.md), [입력 스냅샷](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md), [통합 테스트·재시작 검증](../37_10_08_Batch_Integration_Testing_and_Restart_Verification/10_08_Batch_Integration_Testing_and_Restart_Verification.md)
- 🧱 선수 지식: Java Map·record·예외, JobInstance·JobExecution·StepExecution, JDBC 저장소, chunk의 commit·rollback, Step의 완료·재시작 정책

> 기준일: 2026-10-12. 예제 기준은 Java 17 이상·Spring Batch 6.0.5·기존 PostgreSQL 17 JDBC 프로젝트다. 기존 프로젝트에 추가하는 파일이며 독립 실행 프로젝트가 아니다. 공식 API와 6.0.5 소스를 확인했다. 현재 PATH는 Java 8이고 javac·Maven·Gradle과 Java 빌드 프로젝트가 없어 컴파일·JUnit·DB 재시작 시험은 실행하지 않았다. 아래 실행 관찰은 예상 결과다.

## 1. 들어가며

앞 Step에서 발행 입력의 건수를 읽고 다음 Step에서 그 건수를 보고서 준비에 사용한다고 생각해 보자. 앞 메서드의 지역 변수에만 값을 넣으면 다음 메서드는 그 변수를 직접 볼 수 없다. singleton Bean의 필드로 공유하면 다른 업무 실행과 섞이거나 서버 종료 때 사라질 수 있다.

이전 노트는 적재·검증·후속 처리를 나누고 종료 코드로 흐름을 선택했다. 이번에는 흐름을 고르는 짧은 코드와 별도로, **그 흐름에서 사용할 작은 데이터가 어디에 저장되고 어떻게 전달되는지** 다룬다.

예제는 발행 스냅샷의 명세에서 입력 ID·건수를 읽어 다음 Step에 전달하는 작은 Job이다. 앞선 결과 검증 Job을 다시 구현하지 않으며, 명세의 건수를 읽었다는 사실을 실제 적재 결과의 정확성 검증으로 표현하지 않는다. 데이터 전달·저장·재시작의 경계를 관찰하는 데 집중한다.

## 2. 핵심 개념 정리

| 정보 | 역할 | 이번 노트의 예 |
| --- | --- | --- |
| JobParameters | 실행 전에 정한 입력·업무 식별 | 어떤 snapshot ID를 사용할 것인가? |
| Step ExecutionContext | 해당 Step의 진행 상태·산출 정보 | 앞 Step이 읽은 명세 건수 |
| Job ExecutionContext | 같은 Job의 다음 단계가 사용할 정보 | 전달된 입력 요약의 ID·건수·형식 버전 |
| 업무 테이블 | 실제 입력·결과의 기준 데이터 | 발행 명세·입력 스냅샷·적재 결과 |

```text
JobParameters의 snapshotId
  → 생산 Step이 발행 명세 조회
  → 생산 Step context에 작은 요약 기록
  → Step 종료 코드가 허용되면 선택한 키를 Job context로 승격
  → 소비 Step이 Job context의 키·타입·버전·입력 ID 확인
  → 정상 요약만 사용
```

이 관계에서 값의 범위, 메모리 변경, DB 저장은 서로 다른 질문이다. 이어지는 본문에서 각각의 경계를 확인한다.

## 3. 본문 정리

### 3.1 ExecutionContext는 실행에 딸린 키·값 상태다

**ExecutionContext는 프레임워크가 실행 이력과 함께 저장·복원하는 키·값 모음**이다. Map처럼 이름으로 값을 찾지만, 값 변경을 추적하는 기능과 저장소 연계가 있다. JDBC 메타데이터 저장소를 사용하면 정상적인 저장 경계를 거친 정보가 DB에 남아 새 프로세스의 재시작에도 활용될 수 있다. [Batch 실행 문맥](https://docs.spring.io/spring-batch/reference/domain.html)

하지만 `context.putLong("count", 7L)` 한 줄 자체가 DB INSERT·commit이라는 뜻은 아니다. 우선 현재 Java 객체의 값이 바뀌고, 이후 프레임워크의 저장 경계에서 영속 상태에 반영된다. 프로세스 종료 시점·저장소 오류·트랜잭션 구성에 따라 마지막 메모리 값과 DB 값은 다를 수 있다.

JobParameters는 시작 전에 정한 입력이다. ExecutionContext는 처리 중 만들어진 진행 정보나 전달 정보를 담는다. 업무 결과 테이블은 실제 도서·주문·정산 결과의 기준이다. 이 셋을 한 저장 공간처럼 사용하지 않는다.

예를 들어 snapshot ID는 JobParameters, Reader의 재개 위치는 Step context, 다음 단계가 사용할 요약 건수는 Job context, 도서별 수량은 업무 테이블에 둔다. context에 결과 전체를 넣었다고 결과 저장·중복 방지·조회 API가 완성되는 것은 아니다.

### 3.2 Step context와 Job context는 서로 다른 객체다

**Step context는 StepExecution에, Job context는 JobExecution에 연결된다.** 앞 Step의 `getExecutionContext()`에 쓴 키는 다음 Step의 같은 메서드로 자동 공유되지 않는다. 다음 Step은 자신의 StepExecution을 갖기 때문이다.

| 접근 위치 | 읽는 범위 | 사용 이유 |
| --- | --- | --- |
| `stepExecution.getExecutionContext()` | 현재 Step의 상태 | 진행 위치·이번 Step 산출 정보 |
| `stepExecution.getJobExecution().getExecutionContext()` | 현재 Job의 상태 | 다음 Step에 전달할 승인된 정보 |
| `jobParameters['snapshotId']` | 실행 입력 | 어떤 업무 데이터를 조회할지 결정 |

Step마다 같은 키를 사용해도 서로 다른 context라면 별도 값이다. 반대로 한 Job context를 여러 단계가 사용하면 같은 이름의 키를 덮어쓸 수 있다. `count`처럼 모호한 이름보다 `catalog.manifest.itemCount`처럼 기능과 의미가 드러나는 이름을 사용한다.

Step context는 Step이 끝나자마자 DB에서 삭제되는 임시 변수라는 뜻이 아니다. 범위가 해당 Step이라는 뜻이며, 저장된 이력은 조사·재시작에 쓰일 수 있다. 같은 Instance를 재시작할 때는 이전 실행 상태를 이어 사용하지만 새 Instance에는 그 상태를 자동 공유하지 않는다. [실행 범위와 재시작](https://docs.spring.io/spring-batch/reference/domain.html)

⚠️ 주의: singleton Bean 필드나 static Map으로 실행 데이터를 대신 공유하면 병렬 업무가 섞일 수 있다. Partitioning의 worker별 context도 하나의 전역 카운터가 아니므로 값을 합칠 기준·중복 집계 여부를 별도로 설계한다.

### 3.3 저장 시점과 ItemStream의 생명주기를 이해한다

**체크포인트는 재시작에 사용할 확정된 진행 정보**다. chunk 기반 Step에서는 진행 상태를 commit 경계에 맞춰 저장한다. Step context의 진행 상태와 Job context의 단계 간 전달 정보는 저장 흐름이 다르므로, chunk마다 Job context를 직접 수정한다고 동일한 내구성이 생기지 않는다. [단계 간 데이터 전달 패턴](https://docs.spring.io/spring-batch/reference/common-patterns.html)

**ItemStream은 Reader·Writer 같은 구성 요소가 상태를 열고 갱신하고 닫는 생명주기 계약**이다. `open(context)`은 저장 상태를 읽어 준비하고, `update(context)`는 저장할 진행 상태를 넘기며, `close()`는 자원을 정리한다. update 호출 자체가 최종 commit 완료 신호는 아니다. [ItemStream API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/ItemStream.html)

기존 스냅샷 Reader는 이 생명주기를 Step에 연결하고 `saveState(true)`를 사용했다. Reader가 관리하는 재개 상태의 내부 키를 운영 코드에서 임의로 덮어쓰지 않는다. Reader를 래퍼로 감쌌다면 내부 ItemStream도 실제 등록되어 호출되는지 확인해야 한다.

동일 DB·트랜잭션으로 업무 결과와 체크포인트를 관리하는 기존 단일 Step 실습에서는 다음 관계를 기대한다.

```text
첫 chunk 3건 처리 → 결과·체크포인트 commit
다음 chunk 처리 중 실패 → 그 묶음의 DB 변경 rollback
저장 상태 재조회 → 마지막 확정 경계 확인
같은 업무 재시작 → 보존 입력과 확정 경계로 재개
```

이는 입력이 변하지 않고 해당 Reader·Writer·트랜잭션 구성을 유지한다는 전제다. Java 객체의 모든 필드가 DB rollback과 함께 자동으로 과거 값이 된다는 뜻도 아니다. 메모리 카운터, 외부 파일·HTTP 효과, 다른 DB의 변경은 별도 경계로 시험한다.

Job context는 정상적인 Step 전환 과정에서 저장된다. 6.0.5의 SimpleStepHandler는 Step 실행 뒤 Job context를 저장하는 경로를 갖는다. 따라서 “Step에서 예외가 나면 Job context의 값은 항상 없어진다”처럼 모든 실패를 한 문장으로 단정하지 않는다. 갑작스러운 프로세스 종료와 정상적인 예외 정리도 다르다. [SimpleStepHandler 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/job/SimpleStepHandler.java)

### 3.4 전달할 키·타입·버전을 하나의 계약으로 정한다

**상태 계약은 생산 단계와 소비 단계가 키 이름·값 타입·의미를 합의한 규칙**이다. 숫자 7을 Integer로 쓸지 Long으로 쓸지도 계약의 일부다. 필수 건수를 읽을 때 누락을 기본값 0으로 바꾸면 정상 빈 입력과 전달 실패를 구분하기 어려워진다.

이번 요약은 세 필드를 사용한다. 형식 버전은 Integer 1, snapshot ID는 String, 입력 명세의 건수는 Long이다. 실제로 저장되는 것은 이 단순 값들이며 아래 record 객체 전체를 context에 저장하지 않는다.

아래는 `src/main/java/com/example/batch/ManifestSummary.java`에 추가하는 **기존 프로젝트용 값·검증 파일**이다. context에서 읽은 값은 DB 결과 대조를 대신하지 않으며, 같은 입력의 명세 요약이라는 의미만 갖는다.

```java
package com.example.batch; // 생산·소비 단계가 같은 계약 파일을 사용한다.

import org.springframework.batch.infrastructure.item.ExecutionContext; // Batch 6의 패키지다.

public record ManifestSummary(String snapshotId, long itemCount) {
    public static final String VERSION = "catalog.manifest.schemaVersion"; // 저장 형식의 버전 키다.
    public static final String SNAPSHOT = "catalog.manifest.snapshotId"; // 요약의 입력 소속을 표시한다.
    public static final String COUNT = "catalog.manifest.itemCount"; // SQL count·bigint에 맞춘 Long 값이다.

    public ManifestSummary {
        if (snapshotId == null || snapshotId.isBlank() || itemCount < 0) {
            throw new IllegalArgumentException("유효한 입력 ID와 0 이상의 명세 건수가 필요합니다.");
            // record 생성 시 값 자체의 범위를 확인한다. 건수 0은 허용한다.
        }
    }

    public void writeTo(ExecutionContext context) {
        context.putInt(VERSION, 1); // Integer로 저장하여 소비자의 버전 검사와 맞춘다.
        context.putString(SNAPSHOT, snapshotId); // 어떤 입력을 요약했는지 함께 저장한다.
        context.putLong(COUNT, itemCount); // Integer·문자열로 임의 변환하지 않는다.
    }

    public static ManifestSummary readFrom(ExecutionContext context, String expectedSnapshotId) {
        Object rawVersion = context.get(VERSION); // 누락은 null이므로 기본값으로 숨기지 않는다.
        Object rawSnapshot = context.get(SNAPSHOT); // 다른 입력에서 남은 값인지 확인한다.
        Object rawCount = context.get(COUNT); // 실제 저장 타입도 검사한다.
        if (!(rawVersion instanceof Integer version) || version != 1
                || !(rawSnapshot instanceof String snapshot) || !snapshot.equals(expectedSnapshotId)
                || !(rawCount instanceof Long count) || count < 0) {
            throw new IllegalStateException("요약의 필수 키·타입·형식 버전·입력 ID를 확인해야 합니다.");
            // 오래된 키 구조·부분 승격·다른 입력·잘못된 수치를 정상 요약으로 쓰지 않는다.
        }
        return new ManifestSummary(snapshot, count); // 확인한 값만 업무 코드에 전달한다.
    }
}
```

`writeTo`는 전달할 값의 표현을 한 곳에 모으고 `readFrom`은 소비자의 방어 조건을 모은다. `instanceof`로 검사한 뒤 사용하는 변수는 Java 17의 패턴 변수다. 버전·ID·건수가 모두 유효하면 record를 만들고, 필수 키가 하나라도 없으면 예외를 던진다.

이 버전 번호는 애플리케이션 배포 버전이나 snapshot의 업무 버전과 다르다. 상태 레이아웃의 의미를 바꾸었을 때 오래된 저장 값을 새 코드가 잘못 읽지 않도록 구분하는 값이다. 이것만으로 자동 마이그레이션이 수행되지는 않는다.

### 3.5 생산 Step은 먼저 자신의 context에 요약을 기록한다

**생산 Step은 뒤 단계가 사용할 정보를 계산하는 단계**다. 이번에는 기존 `catalog_snapshot_manifest`의 ready·item_count를 읽는다. 발행하지 않은 명세를 전달하지 않으며, 조회한 값을 Step context에 기록한다.

아래는 `src/main/java/com/example/batch/ProduceManifestSummaryTasklet.java`의 **기존 프로젝트용 파일**이다. [스냅샷 노트의 명세 테이블](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md), 같은 DB의 JdbcTemplate, 실행 파라미터 snapshotId가 필요하다.

```java
package com.example.batch; // 공통 요약 계약과 같은 패키지다.

import java.util.List; // 명세가 정확히 한 행인지 확인한다.
import org.springframework.batch.core.step.StepContribution; // 현재 StepExecution에 접근한다.
import org.springframework.batch.core.scope.context.ChunkContext; // Tasklet 호출의 문맥이다.
import org.springframework.batch.core.step.tasklet.Tasklet; // 생산 작업의 실행 계약이다.
import org.springframework.batch.infrastructure.repeat.RepeatStatus; // 정상 호출의 반복을 종료한다.
import org.springframework.jdbc.core.JdbcTemplate; // SQL과 파라미터 바인딩을 연결한다.

public class ProduceManifestSummaryTasklet implements Tasklet {
    private final JdbcTemplate jdbc; // Step 트랜잭션과 같은 DataSource를 사용한다.
    private final String snapshotId; // 이번 실행에서 정한 입력 ID다.

    public ProduceManifestSummaryTasklet(JdbcTemplate jdbc, String snapshotId) {
        if (snapshotId == null || snapshotId.isBlank()) {
            throw new IllegalArgumentException("snapshotId가 필요합니다."); // 잘못된 입력을 거절한다.
        }
        this.jdbc = jdbc; // 생성 시점에는 SQL을 실행하지 않는다.
        this.snapshotId = snapshotId; // 이후 조회·요약에 같은 ID를 사용한다.
    }

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        List<ManifestRow> rows = jdbc.query(
                "SELECT ready, item_count FROM catalog_snapshot_manifest WHERE snapshot_id = ?",
                (rs, row) -> new ManifestRow(rs.getBoolean("ready"), rs.getLong("item_count")),
                snapshotId); // 문자열을 SQL에 이어 붙이지 않고 값으로 바인딩한다.
        if (rows.size() != 1 || !rows.get(0).ready()) {
            throw new IllegalStateException("발행 완료한 입력 명세를 찾지 못했습니다.");
            // 누락·미발행을 정상적인 빈 입력으로 바꾸지 않는다.
        }
        var summary = new ManifestSummary(snapshotId, rows.get(0).itemCount()); // 건수 범위도 검사한다.
        summary.writeTo(contribution.getStepExecution().getExecutionContext());
        // Job context가 아니라 생산 Step 자신의 context에 세 키를 기록한다.
        return RepeatStatus.FINISHED; // 예외 없이 끝나면 이 Step의 기본 종료 코드는 COMPLETED다.
    }

    private record ManifestRow(boolean ready, long itemCount) {} // SQL 조회 결과를 잠시 표현한다.
}
```

정상 명세가 7건이면 Step context에 version=1·snapshot ID·itemCount=7이 들어간다. 아직 다음 Step의 context나 Job context에 자동으로 들어간 것은 아니다. 명세 건수는 발행 당시 입력 정보이며 현재 입력이 그대로 남았는지·실제 결과가 정확한지는 별도 검증이 필요하다.

### 3.6 promotion은 선택한 키를 Job context로 복사한다

**promotion(승격)은 앞 Step의 산출 정보를 같은 Job의 다음 단계가 볼 수 있는 범위로 옮기는 작업**이다. ExecutionContextPromotionListener는 Step 종료 후 허용된 ExitStatus에 맞을 때 지정한 키를 Step context에서 Job context로 복사한다. Step context의 원본 키를 삭제하거나 DB 데이터를 이동하는 동작은 아니다. [승격 listener API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/listener/ExecutionContextPromotionListener.html)

설정은 `keys`, `statuses`, `strict`를 중심으로 읽는다. keys는 전달할 이름의 허용 목록, statuses는 전달할 종료 코드의 패턴, strict는 해당 키가 없을 때 listener가 예외를 던질지 정한다. 기본 statuses는 COMPLETED이고 strict는 false다.

앞 검증 노트처럼 종료 코드가 VERIFIED 또는 EMPTY_INPUT이라면 기본 COMPLETED만으로는 승격되지 않는다. 그 Job에 승격을 연결할 때는 의도한 성공 코드를 명시하고, 종료 코드와 생산한 데이터의 의미를 같이 확인한다. `statuses={"*"}`로 실패 정보까지 정상 산출물처럼 전달하지 않는다.

⚠️ 주의: strict=true만으로 생산 Step의 실패가 보장되지는 않는다. afterStep의 예외는 Step 실행 경로에서 기록만 되고 상태를 자동 FAILED로 바꾸지 않는 계약이다. 또한 6.0.5 승격 구현은 키별로 복사하므로 뒤 키에서 예외가 나면 앞 키는 Job context에 이미 들어갈 수 있다. 생산 중 필요한 값을 검증하고 소비자도 필수 키·타입·버전을 확인해야 한다. [StepExecutionListener 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/listener/StepExecutionListener.html), [승격 구현 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/listener/ExecutionContextPromotionListener.java)

승격은 새 값이 없으면 Job context의 예전 값을 자동 삭제하는 기능도 아니다. 같은 키가 이미 남아 있는데 이번 생산이 실패하면 오래된 요약이 남을 수 있다. 아래 소비자는 입력 ID·형식까지 확인하며, 운영에서는 입력 불변성과 생산 Step의 실행 상태도 함께 판단한다.

### 3.7 소비 Step은 Job context를 읽고 계약을 확인한다

**소비 Step은 전달된 정보를 사용하는 단계**다. 앞 Step이 기록한 요약을 읽으려면 자신의 Step context가 아니라 Job context를 읽는다. 이 예제는 실행 중 직접 context를 읽어 정확한 저장 타입을 검사한다.

아래는 `src/main/java/com/example/batch/ConsumeManifestSummaryTasklet.java`의 **기존 프로젝트용 파일**이다. 입력 파라미터의 snapshotId는 요약이 이번 업무에 속하는지 검증하는 기준이며, 읽은 건수는 로그로 관찰한다. 실제 보고서 생성·외부 발행은 구현하지 않는다.

```java
package com.example.batch; // 생산 단계와 같은 상태 계약을 사용한다.

import org.slf4j.Logger; // 계약 검사를 통과한 요약 건수만 관찰한다.
import org.slf4j.LoggerFactory; // 클래스별 로그 객체를 만든다.
import org.springframework.batch.core.step.StepContribution; // 현재 JobExecution에 접근한다.
import org.springframework.batch.core.scope.context.ChunkContext; // Tasklet 실행 문맥이다.
import org.springframework.batch.core.step.tasklet.Tasklet; // 소비 단계의 실행 계약이다.
import org.springframework.batch.infrastructure.repeat.RepeatStatus; // 반복 종료 신호다.

public class ConsumeManifestSummaryTasklet implements Tasklet {
    private static final Logger log = LoggerFactory.getLogger(ConsumeManifestSummaryTasklet.class);
    private final String expectedSnapshotId; // 실행 파라미터로 정한 입력의 소속이다.

    public ConsumeManifestSummaryTasklet(String expectedSnapshotId) {
        if (expectedSnapshotId == null || expectedSnapshotId.isBlank()) {
            throw new IllegalArgumentException("비교할 snapshotId가 필요합니다."); // 잘못된 실행 입력을 거절한다.
        }
        this.expectedSnapshotId = expectedSnapshotId; // 요약 자체의 ID와 대조할 기준이다.
    }

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        var jobContext = contribution.getStepExecution().getJobExecution().getExecutionContext();
        // 현재 소비 Step의 context를 읽지 않고 같은 Job의 공유 범위를 읽는다.
        var summary = ManifestSummary.readFrom(jobContext, expectedSnapshotId);
        // 누락·부분 승격·지원하지 않는 형식·다른 입력이면 여기서 Step을 실패시킨다.
        log.info("발행 입력 명세의 요약 건수: {}", summary.itemCount());
        // 적재 성공 건수나 실제 결과 검증 완료를 뜻하는 메시지는 아니다.
        return RepeatStatus.FINISHED; // 정상 요약을 사용한 호출을 끝낸다.
    }
}
```

Job context가 비어 있거나 COUNT에 Integer 7이 들어 있으면 예외가 발생한다. 정상적인 Long 0은 빈 명세로 허용된다. 다른 snapshot의 정상 요약이 남아 있어도 이번 파라미터와 ID가 다르면 거절한다.

ID·버전 검사를 통과한다고 요약 내용의 모든 최신성이 증명되는 것은 아니다. 같은 입력을 수정하면서 같은 ID를 계속 쓰면 오래된 건수도 ID 검사를 통과할 수 있다. 발행 입력의 불변성·업무 결과 대조를 이 계약 검사와 별도로 유지한다.

### 3.8 StepScope와 listener를 연결한 Job을 구성한다

**late binding은 실행 문맥이 생긴 뒤 필요한 값을 연결하는 방식**이다. singleton 구성 생성 시점에는 해당 실행의 JobParameters나 이후 승격할 정보가 아직 준비되지 않았을 수 있다. StepScope는 해당 Step 실행의 생명주기에서 Tasklet의 입력을 연결한다. [늦은 값 연결](https://docs.spring.io/spring-batch/reference/step/late-binding.html)

`#{jobParameters['snapshotId']}`는 실행 입력, `#{jobExecutionContext['catalog.manifest.itemCount']}`는 Job context, `#{stepExecutionContext['catalog.manifest.itemCount']}`는 현재 Step context다. 범위를 잘못 선택하면 같은 키 이름이어도 다른 값을 읽거나 누락된다. 이번에는 입력 ID만 주입하고 context 값은 execute에서 직접 검사한다.

아래는 `src/main/java/com/example/batch/ManifestSummaryJobConfiguration.java`의 **기존 프로젝트용 구성 파일**이다. JDBC Batch 인프라·StepScope가 등록된 기존 컨텍스트, 같은 DataSource·JdbcTransactionManager·JobRepository, 발행된 명세 테이블이 필요하다. 기존 인프라를 중복 등록하지 않는다.

```java
package com.example.batch; // 앞의 세 파일과 같은 패키지에 둔다.

import javax.sql.DataSource; // JDBC 표준 타입이다. jakarta.sql로 바꾸지 않는다.
import org.springframework.batch.core.configuration.annotation.StepScope; // 실행 시점에 입력을 연결한다.
import org.springframework.batch.core.job.Job; // 새 Job 정의의 타입이다.
import org.springframework.batch.core.job.builder.JobBuilder; // 생산→소비 순서를 구성한다.
import org.springframework.batch.core.job.parameters.DefaultJobParametersValidator; // 필수 입력 키를 검사한다.
import org.springframework.batch.core.listener.ExecutionContextPromotionListener; // Step 종료 뒤 키를 승격한다.
import org.springframework.batch.core.repository.JobRepository; // 실행·상태를 저장하는 기존 인프라다.
import org.springframework.batch.core.step.Step; // 생산·소비 Step 타입이다.
import org.springframework.batch.core.step.builder.StepBuilder; // TaskletStep을 만든다.
import org.springframework.batch.core.step.tasklet.Tasklet; // 주입받을 생산·소비 작업의 계약이다.
import org.springframework.beans.factory.annotation.Qualifier; // 여러 Tasklet·Step을 이름으로 선택한다.
import org.springframework.beans.factory.annotation.Value; // Step 문맥에서 파라미터를 읽는다.
import org.springframework.context.annotation.Bean; // 객체를 Spring에 등록한다.
import org.springframework.context.annotation.Configuration; // Bean 구성을 담는다.
import org.springframework.jdbc.core.JdbcTemplate; // 명세 조회에 사용하는 JDBC 도구다.
import org.springframework.jdbc.support.JdbcTransactionManager; // 같은 DB의 Tasklet 트랜잭션을 관리한다.

@Configuration(proxyBeanMethods = false) // @Bean 메서드를 직접 호출하지 않고 인자로 주입받는다.
public class ManifestSummaryJobConfiguration {
    @Bean
    public ExecutionContextPromotionListener manifestSummaryPromotion() {
        var listener = new ExecutionContextPromotionListener(); // 이번 생산 Step에 연결할 listener다.
        listener.setKeys(new String[] {ManifestSummary.VERSION, ManifestSummary.SNAPSHOT, ManifestSummary.COUNT});
        // Reader 내부 상태가 아닌 업무 요약의 세 키만 전달한다.
        listener.setStatuses(new String[] {"COMPLETED"}); // 이번 생산 Tasklet의 정상 종료만 허용한다.
        listener.setStrict(true); // 키 누락을 기록하되 소비자 검사를 대신하지는 않는다.
        return listener; // Spring이 InitializingBean의 설정 검사를 실행한다.
    }

    @Bean
    @StepScope
    public Tasklet produceManifestSummaryTasklet(DataSource dataSource,
            @Value("#{jobParameters['snapshotId']}") String snapshotId) {
        return new ProduceManifestSummaryTasklet(new JdbcTemplate(dataSource), snapshotId);
        // 입력은 해당 Step 실행 시점에 연결되고 SQL은 execute에서 수행한다.
    }

    @Bean
    @StepScope
    public Tasklet consumeManifestSummaryTasklet(
            @Value("#{jobParameters['snapshotId']}") String expectedSnapshotId) {
        return new ConsumeManifestSummaryTasklet(expectedSnapshotId); // 같은 업무 ID를 검사의 기준으로 쓴다.
    }

    @Bean
    public Step produceManifestSummaryStep(JobRepository repository, JdbcTransactionManager transactionManager,
            @Qualifier("produceManifestSummaryTasklet") Tasklet tasklet,
            @Qualifier("manifestSummaryPromotion") ExecutionContextPromotionListener promotion) {
        return new StepBuilder("produceManifestSummaryStep", repository)
                .tasklet(tasklet, transactionManager) // 명세 조회·Step 상태를 기존 DB 경계에 연결한다.
                .listener(promotion) // 생성만 한 listener가 아니라 실제 생산 Step에 등록한다.
                .build(); // 완료한 불변 명세 요약은 기본 재시작 정책으로 생략할 수 있다.
    }

    @Bean
    public Step consumeManifestSummaryStep(JobRepository repository, JdbcTransactionManager transactionManager,
            @Qualifier("consumeManifestSummaryTasklet") Tasklet tasklet) {
        return new StepBuilder("consumeManifestSummaryStep", repository)
                .tasklet(tasklet, transactionManager) // context의 계약 검사는 execute 안에서 수행한다.
                .build(); // 예외 발생 시 소비 Step·순차 Job이 실패한다.
    }

    @Bean
    public Job manifestSummaryJob(JobRepository repository,
            @Qualifier("produceManifestSummaryStep") Step producer,
            @Qualifier("consumeManifestSummaryStep") Step consumer) {
        return new JobBuilder("manifestSummaryJob", repository) // 기존 검증 Job과 실패 이력을 섞지 않는다.
                .validator(new DefaultJobParametersValidator(new String[] {"snapshotId"}, new String[0]))
                .start(producer) // 정상 생산 종료 뒤 listener가 키를 승격한다.
                .next(consumer) // 앞 Step이 성공한 다음 소비한다. 실패를 정상 전이로 숨기지 않는다.
                .build(); // 실제 시작·중지·재시작은 기존 보호된 JobOperator 호출부에서 수행한다.
    }
}
```

StepScope는 Tasklet에 적용하고 Step Bean 자체를 StepScope로 만들지 않았다. singleton 필드에 현재 업무의 값을 보관하는 대신 실행별 Tasklet을 연결한다. JobScope 역시 언제 객체가 처음 생성되어 값이 주입되는지가 중요하며, “Job 범위니까 앞 단계의 나중 값을 계속 자동 갱신한다”는 뜻은 아니다. [StepScope와 JobScope](https://docs.spring.io/spring-batch/reference/step/late-binding.html)

시작 호출부에서는 `@Qualifier("manifestSummaryJob")`으로 이 Job을 선택하고 snapshotId를 식별 파라미터로 전달한다. 필수 키 validator가 값 내용·권한까지 검사하는 것은 아니므로 보호된 호출부의 입력 검사를 유지한다. 여러 Job을 등록한 프로젝트의 자동 시작 설정도 확인해 의도한 Job 하나를 선택한다.

⚠️ 주의: 이 구성은 SQL·대기 시간을 무제한 허용하라는 예제가 아니다. 실습 프로젝트의 JDBC query·연결·시험 실행에 유한 제한을 설정해야 한다. 단일 ThreadLocal 기반 실행 범위를 임의의 비동기 스레드에 그대로 전파할 수 있다고 가정하지 않는다.

### 3.9 dirty flag·직렬화·상태 버전을 점검한다

**dirty flag는 context의 값이 마지막 변경 감지 초기화 이후 바뀌었는지 나타내는 표시**다. DB 저장 완료나 작업의 성공을 의미하지 않는다. put으로 새 값·변경한 값·삭제를 반영하면 감지할 수 있지만, 저장해 둔 List 내부만 바꾸면 context가 그 내부 변경까지 자동 추적하지 않는다. [ExecutionContext API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/ExecutionContext.html)

예를 들어 context 안의 List를 꺼내 요소 하나를 추가한 뒤 같은 객체를 다시 put하면, 이전 값과 새 값이 같은 객체여서 변경으로 판단되지 않을 수도 있다. 큰 가변 객체를 넣는 설계를 피하고, 필요한 작은 값의 새 표현을 put하는 방식으로 관리한다. 구현의 dirty 조건과 실제 저장 후 재조회도 확인한다. [ExecutionContext 6.0.5 변경 감지](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-infrastructure/src/main/java/org/springframework/batch/infrastructure/item/ExecutionContext.java)

**직렬화는 메모리 값을 저장 가능한 표현으로 바꾸는 과정**이다. 저장 가능한 타입·복원 방식은 사용하는 serializer의 계약에 맞춰야 한다. 기본 Java 직렬화 기반 serializer는 저장할 값의 직렬화 가능성을 요구하며, 클래스 구조 변경은 오래된 값의 복원에 영향을 줄 수 있다. 이번 코드는 String·Integer·Long만 저장하여 사용자 record 전체의 직렬화 의존성을 줄였다. [기본 context serializer](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/repository/dao/DefaultExecutionContextSerializer.html)

수백만 행의 결과, JDBC Connection, Reader 객체, Entity 그래프, 비밀번호·토큰을 context에 넣지 않는다. 실제 결과는 업무 테이블·파일 저장소에 보관하고 context에는 작은 식별자·진행 정보만 남긴다. 메타데이터 DB도 민감 정보를 보호해야 하며 context 전체를 로그로 출력하지 않는다.

상태 스키마를 바꿀 때는 이전 키·타입·버전을 읽을 수 있는지 검토한다. 예를 들어 COUNT가 Long에서 문자열로 바뀌면 같은 이름이어도 현재 소비자는 거절한다. 지원하지 않는 버전을 무조건 1로 바꾸거나 DB context 문자열을 수동 편집해서 오류를 덮지 않는다.

### 3.10 재시작에서는 저장된 전달값과 단계 이력을 함께 본다

**재시작은 같은 Instance의 새 Execution에서 저장된 상태를 이어 사용하는 시도**다. 이번 순차 Job에서 생산 Step이 완료하고 소비 Step이 실패했다면, 재시작은 완료 생산을 기본 정책으로 생략하고 소비를 다시 실행할 수 있다. 이때 정상적으로 저장·복원된 Job context의 요약을 사용한다. [재시작 설정](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/restart.html)

재사용하려면 snapshot ID·발행 명세가 변하지 않고, Job·Step 이름과 상태 계약이 호환되며, 승격한 Job context가 실제로 저장되어 있어야 한다. 같은 JVM의 Bean 필드에 값이 남아 있다고 새 프로세스에서도 전달된다는 뜻은 아니다.

생산은 COMPLETED인데 요약이 누락·부분 승격된 비정상 이력이 있다면 소비자의 실패가 이를 드러낸다. 단순 restart로는 완료 생산이 생략되어 같은 실패가 반복될 수 있다. 원인을 해결하고 생산 재수행이 안전한지·재개 경로가 그 Step을 방문하는지·완료 Step 재실행 정책을 어떻게 조정할지 검토한다.

계산한 요약은 자동으로 새 계산 결과에 맞춰 만료되지 않는다. 입력 불변성이 보장되지 않는 작업이라면 요약 재계산이나 업무 버전별 저장·검증 정책이 필요하다. 앞선 검증 Step의 allowStartIfComplete(true)와 이번 불변 명세 요약의 기본 설정은 목적이 다르다.

### 3.11 메모리 전달 테스트와 DB 재시작 시험을 구분한다

아래는 `src/test/java/com/example/batch/ManifestSummaryContractTest.java`에 추가하는 **JUnit Jupiter·Mockito 단위 테스트 파일**이다. 기존 프로젝트에 두 테스트 의존성이 필요하다. 실제 context 객체와 listener를 사용하되 StepExecution·JobExecution은 대역이므로 Spring 실행 순서·DB 저장·직렬화는 검증하지 않는다.

```java
package com.example.batch; // 앞의 상태 계약과 같은 패키지다.

import org.junit.jupiter.api.Test; // JUnit 테스트 메서드다.
import org.springframework.batch.core.ExitStatus; // 승격할 종료 코드를 지정한다.
import org.springframework.batch.core.job.JobExecution; // Job context를 돌려주는 대역의 타입이다.
import org.springframework.batch.core.listener.ExecutionContextPromotionListener; // 실제 listener를 직접 호출한다.
import org.springframework.batch.core.step.StepExecution; // Step context·종료 코드를 돌려주는 대역이다.
import org.springframework.batch.infrastructure.item.ExecutionContext; // context 자체는 실제 객체다.
import static org.junit.jupiter.api.Assertions.*; // 값·키·예외의 기대를 검사한다.
import static org.mockito.Mockito.*; // 실행 객체의 응답만 지정하는 도구다.

class ManifestSummaryContractTest {
    @Test
    void stepValuesAreNotAutomaticallyJobValues() {
        var stepContext = new ExecutionContext(); // 생산 단계의 범위다.
        var jobContext = new ExecutionContext(); // 별도의 Job 범위다.
        new ManifestSummary("snapshot-v1", 7L).writeTo(stepContext); // 생산 값만 기록한다.
        assertEquals(7L, stepContext.getLong(ManifestSummary.COUNT)); // 생산 범위에는 값이 있다.
        assertTrue(jobContext.isEmpty()); // 공유 범위에는 자동 복사되지 않는다.
        assertThrows(IllegalStateException.class,
                () -> ManifestSummary.readFrom(jobContext, "snapshot-v1")); // 누락을 0으로 숨기지 않는다.
    }

    @Test
    void completedProducerPromotesTheContract() throws Exception {
        var stepContext = new ExecutionContext(); // 승격할 생산 상태다.
        var jobContext = new ExecutionContext(); // 아직 비어 있는 소비 범위다.
        var expected = new ManifestSummary("snapshot-v1", 7L); // 전달할 세 필드의 기대다.
        expected.writeTo(stepContext); // record가 아니라 단순 값으로 저장한다.
        listener().afterStep(execution(ExitStatus.COMPLETED, stepContext, jobContext));
        // 정상 종료 코드에서 실제 listener가 지정한 키를 복사한다.
        assertEquals(expected, ManifestSummary.readFrom(jobContext, "snapshot-v1"));
        assertTrue(stepContext.containsKey(ManifestSummary.COUNT)); // 원본 키가 삭제되는 것은 아니다.
    }

    @Test
    void failedProducerDoesNotReplaceAnOldSummary() throws Exception {
        var stepContext = new ExecutionContext(); // 이번에 실패한 생산의 값이다.
        var jobContext = new ExecutionContext(); // 다른 입력의 값이 이미 남은 상황을 가정한다.
        var oldSummary = new ManifestSummary("snapshot-v1", 7L);
        oldSummary.writeTo(jobContext); // 실제 운영 상태를 만드는 코드가 아닌 시험용 준비다.
        new ManifestSummary("snapshot-v2", 9L).writeTo(stepContext); // 실패한 새 생산 값이다.
        listener().afterStep(execution(ExitStatus.FAILED, stepContext, jobContext)); // 승격을 허용하지 않는다.
        assertEquals(oldSummary, ManifestSummary.readFrom(jobContext, "snapshot-v1"));
        // 실패했다고 예전 Job 값이 자동 삭제되지는 않는다.
        assertThrows(IllegalStateException.class,
                () -> ManifestSummary.readFrom(jobContext, "snapshot-v2")); // 이번 입력으로 쓰면 거절한다.
    }

    @Test
    void unsupportedVersionAndWrongTypeAreRejected() {
        var context = new ExecutionContext(); // 계약이 잘못된 상태를 직접 만든다.
        new ManifestSummary("snapshot-v1", 7L).writeTo(context); // 먼저 정상 값으로 준비한다.
        context.putInt(ManifestSummary.VERSION, 2); // 아직 지원하지 않는 버전이다.
        assertThrows(IllegalStateException.class,
                () -> ManifestSummary.readFrom(context, "snapshot-v1"));
        context.putInt(ManifestSummary.VERSION, 1); // 버전은 복구하고 타입 오류를 따로 만든다.
        context.putInt(ManifestSummary.COUNT, 7); // 계약은 Long인데 Integer를 저장했다.
        assertThrows(IllegalStateException.class,
                () -> ManifestSummary.readFrom(context, "snapshot-v1")); // 값 7이 같아도 거절한다.
    }

    @Test
    void directStrictCallCanLeavePartialCopies() throws Exception {
        var stepContext = new ExecutionContext(); // COUNT가 없는 불완전한 생산 상태다.
        var jobContext = new ExecutionContext(); // 복사 전 공유 범위다.
        stepContext.putInt(ManifestSummary.VERSION, 1); // 첫 번째 키는 존재한다.
        stepContext.putString(ManifestSummary.SNAPSHOT, "snapshot-v1"); // 두 번째 키도 존재한다.
        var promotion = listener(); // VERSION·SNAPSHOT·COUNT 순서와 strict=true를 사용한다.
        assertThrows(IllegalArgumentException.class,
                () -> promotion.afterStep(execution(ExitStatus.COMPLETED, stepContext, jobContext)));
        assertTrue(jobContext.containsKey(ManifestSummary.VERSION)); // 앞 키는 이미 복사됐다.
        assertFalse(jobContext.containsKey(ManifestSummary.COUNT)); // 누락된 뒤 키는 없다.
        assertThrows(IllegalStateException.class,
                () -> ManifestSummary.readFrom(jobContext, "snapshot-v1")); // 부분 요약을 소비하지 않는다.
    }

    private ExecutionContextPromotionListener listener() throws Exception {
        var promotion = new ExecutionContextPromotionListener(); // 테스트마다 새 listener를 만든다.
        promotion.setKeys(new String[] {ManifestSummary.VERSION, ManifestSummary.SNAPSHOT, ManifestSummary.COUNT});
        promotion.setStatuses(new String[] {"COMPLETED"}); // FAILED는 이 시험에서 승격하지 않는다.
        promotion.setStrict(true); // 누락 키에 대한 직접 호출의 예외를 관찰한다.
        promotion.afterPropertiesSet(); // Spring 밖이므로 설정 검사를 명시적으로 호출한다.
        return promotion;
    }

    private StepExecution execution(ExitStatus status, ExecutionContext stepContext, ExecutionContext jobContext) {
        JobExecution job = mock(JobExecution.class); // DB 이력 생성 대신 필요한 응답만 지정한다.
        when(job.getExecutionContext()).thenReturn(jobContext); // 같은 Job context 객체를 돌려준다.
        StepExecution step = mock(StepExecution.class); // listener가 읽을 Step 응답을 준비한다.
        when(step.getExecutionContext()).thenReturn(stepContext);
        when(step.getJobExecution()).thenReturn(job);
        when(step.getExitStatus()).thenReturn(status); // 종료 코드에 따른 승격 조건이다.
        return step;
    }
}
```

마지막 시험은 listener를 직접 호출하여 예외를 관찰한다. 실제 Step 경로의 afterStep 예외 처리와 같지 않으므로, 이 assertion이 생산 Step FAILED를 증명했다고 설명하지 않는다. partial copy 역시 메모리의 값만 확인한 것이며 실제 영속 여부는 별도 시험이 필요하다.

Java 프로젝트 루트에서 사용하는 Wrapper 하나를 선택한다. TIL 루트에는 해당 Java 빌드 프로젝트가 없다.

```powershell
# Gradle 프로젝트라면 상태 계약 테스트 클래스를 실행한다.
./gradlew.bat test --tests com.example.batch.ManifestSummaryContractTest

# Maven 프로젝트라면 같은 테스트 클래스를 실행한다.
./mvnw.cmd -Dtest=ManifestSummaryContractTest test
```

예상 결과는 다섯 테스트의 통과다. 실제 DB·새 프로세스의 검증은 다음 **별도 통합 시험 설계**로 확장한다. 각 시험은 자기 입력·메타데이터를 분리하고 대기 시간과 실행 시간을 제한한다.

| 시험 | 통제할 조건 | 확인할 증거 |
| --- | --- | --- |
| 정상 전달 | 발행 명세 7건·생산→소비 순차 실행 | 생산 Step와 Job context의 세 키·소비 완료 |
| 저장 후 재조회 | 호출 반환 객체 대신 JobRepository로 Execution·Step 재조회 | 키·타입·버전이 실제 JDBC 이력에서 읽힘 |
| 소비 실패·재시작 | 테스트 전용 소비 Tasklet의 일회성 실패 | 같은 Instance·새 Execution·완료 생산 생략·요약 재사용 |
| 새 프로세스 재개 | 입력·DB 이력 보존 후 첫 프로세스 종료·작업 주체 정리 | 두 번째 프로세스에서 복원한 요약·정상 소비 |
| listener 연결 누락 | 전용 테스트 구성에서 생산 listener를 제외 | 소비에서 필수 요약 누락으로 실패 |
| 부분 승격·strict | 시험용 생산에서 COUNT만 누락 | 실제 생산/소비 상태·로그·저장 값, 소비 Step의 계약 거절 |
| 저장 계약 변경 | 지원하지 않는 형식·타입의 시험 데이터 | 기본값으로 숨기지 않고 실패·조사 대상으로 남김 |

새 프로세스 시험은 같은 JVM의 메모리 객체가 남아 있는 시험과 다르다. JobRepository의 목록 조회에서 Step context가 충분히 로딩되지 않았으면 `getStepExecution(stepId)`로 해당 Step의 상태를 읽는다. 실제 실행 종료를 확인하기 전에 이력을 삭제하지 않는다. [저장소 조회 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/repository/JobRepository.html)

강제 종료 후 실행 이력이 STARTED에 남았다면 일반 FAILED 재시작과 다른 절차가 필요하다. 이전 실행 주체 종료·쓰기 차단 확인 뒤 recover와 restart를 분리하는 [운영·장애 복구 노트](../38_10_09_Batch_Operations_and_Failure_Recovery/10_09_Batch_Operations_and_Failure_Recovery.md)의 절차를 적용한다.

## 4. 적용 관점에서 다시 보기

먼저 실행 입력, Step 진행 상태, 단계 간 요약, 실제 업무 결과를 구분한다. 전달 정보에는 이름·타입·버전·입력 소속을 정하고 작은 값만 저장한다. 필수 누락을 정상적인 0으로 숨기지 않는다.

생산 중에는 자신의 Step context에 상태를 기록하고, 종료 조건에 맞는 키만 Job context로 승격한다. listener를 실제 Step에 등록하며 사용자 정의 종료 코드도 설정과 맞춘다. strict 설정과 별개로 소비 단계에서 계약을 검사한다.

재시작에서는 마지막 메모리 값이 아니라 저장·복원한 값과 Step 이력을 함께 확인한다. 완료 생산의 생략, 부분 승격, 오래된 값, 상태 레이아웃 변경을 각각 조사하고 입력 불변성·재수행 정책을 유지한다.

마지막으로 메모리 계약 시험, 실제 JDBC 재조회, 같은 업무 재시작, 새 프로세스 복원을 단계별로 검증한다. 입력·업무 결과·메타데이터를 함께 보존하고 실제 작업 종료 뒤 자기 시험 데이터만 정리한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

ExecutionContext는 실행 상태의 저장 위치이지만 put 한 번이 commit이나 성공을 뜻하지는 않는다. 단계 간 전달에는 범위·종료 조건·저장 경계·소비자 검증·재시작 호환성이 함께 필요하다.

### 5.2 이전·다음 학습과의 연결

[다단계 Job 노트](../39_10_11_Batch_Multi_Step_Flow_and_Result_Verification/10_11_Batch_Multi_Step_Flow_and_Result_Verification.md)의 흐름 선택과 별도로 작은 실행 데이터를 전달하는 방법을 연결했다. 다음에는 **Spring Batch 파일 출력·재시작과 안전한 결과 공개**를 학습해 DB 진행 상태와 파일 쓰기·검증·공개 시점의 경계를 다룬다.

### 5.3 더 파볼 만한 주제

상태 스키마 마이그레이션·serializer 교체의 호환성, Partitioning worker의 산출 정보를 합치는 기준, 영속 업무 보고서와 context 요약의 역할 분리로 확장할 수 있다. 외부 파일·메시지 효과는 DB rollback과 별도로 검증한다.

### 5.4 참고 자료

- [Batch 실행 문맥](https://docs.spring.io/spring-batch/reference/domain.html), [단계 간 전달 패턴](https://docs.spring.io/spring-batch/reference/common-patterns.html): Step·Job 범위·진행 저장·승격의 전체 관계.
- [ExecutionContext API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/ExecutionContext.html), [6.0.5 구현](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-infrastructure/src/main/java/org/springframework/batch/infrastructure/item/ExecutionContext.java): 타입·null·put·dirty 감지.
- [ItemStream](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/ItemStream.html): open·update·close와 상태 관리 생명주기.
- [승격 listener API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/listener/ExecutionContextPromotionListener.html), [6.0.5 구현](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/listener/ExecutionContextPromotionListener.java): 키별 복사·종료 조건·strict의 실제 범위.
- [StepExecutionListener](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/listener/StepExecutionListener.html): afterStep 예외와 종료 코드 계약.
- [SimpleStepHandler 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/job/SimpleStepHandler.java): Step 실행 뒤 Job context 저장·완료 Step 판단.
- [늦은 값 연결](https://docs.spring.io/spring-batch/reference/step/late-binding.html), [StepScope](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/configuration/annotation/StepScope.html): 실행 범위와 파라미터·context 주입 시점.
- [기본 serializer](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/repository/dao/DefaultExecutionContextSerializer.html), [JobRepository](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/repository/JobRepository.html), [Step 재시작 설정](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/restart.html): 저장 표현·재조회·완료 단계의 재수행.

## 6. 요약 정리

1. JobParameters·Step context·Job context·업무 결과는 서로 다른 역할을 갖는다.
2. 앞 Step의 키는 다음 Step 자신의 context에 자동으로 공유되지 않는다.
3. put은 메모리 변경이며 실제 저장·commit 경계와 구분한다.
4. ItemStream의 open·update·close를 연결하고 Reader 내부 상태 키를 임의로 수정하지 않는다.
5. 승격은 허용된 종료 코드에서 선택한 키를 Job context로 복사한다.
6. strict만으로 Step 실패·모든 키의 원자적 전달이 보장되지 않아 소비자도 계약을 검사한다.
7. 필수 키·정확한 타입·상태 버전·입력 ID를 확인하고 누락을 0으로 숨기지 않는다.
8. 큰 가변 객체·비밀값을 피하고 dirty 감지·직렬화·저장 계약의 호환성을 확인한다.
9. 재시작의 전달값은 JDBC 재조회·단계 이력·새 프로세스 시험으로 검증한다.

🧠 기억할 것: 다음 단계가 읽는 값은 어느 실행 범위에서 만들어져 언제 저장됐으며, 이번 입력에 맞는 계약을 갖추었는지 확인한다.

## 7. 미니 퀴즈 또는 체크리스트

1. 앞 Step context에 COUNT=7을 넣었다. 다음 Step의 getExecutionContext에서 자동으로 7을 읽을 수 있는가?
2. Job context에 값을 put한 직후 서버가 종료됐다. DB에 같은 값이 반드시 남는가?
3. 생산 종료 코드가 VERIFIED인데 승격 listener의 statuses는 기본 설정이다. 무엇을 확인해야 하는가?
4. strict=true의 afterStep 직접 호출 시험에서 예외가 발생했다. 실제 생산 Step FAILED와 모든 키 복사 취소까지 증명했는가?
5. COUNT가 없을 때 getLong(COUNT, 0L)을 사용하면 정상 빈 명세와 어떤 상황을 구분하기 어려워지는가?

<details>
<summary>정답과 해설</summary>

1. 아니다. 그 메서드는 다음 Step 자신의 context다. 필요한 키를 Job context로 승격한 뒤 Job 범위를 읽거나 명시적인 업무 저장소를 사용한다.
2. 아니다. put은 현재 메모리 객체 변경이다. 프레임워크의 저장 경계·commit·종료 시점과 실제 저장 상태를 확인해야 한다.
3. 기본 허용 코드는 COMPLETED다. VERIFIED에서 전달할 필요가 있는지 판단해 statuses를 맞추고 소비자가 필요한 데이터를 검사하게 한다.
4. 아니다. afterStep 예외는 실제 Step 경로에서 기록만 될 수 있고 키별 복사는 일부 값이 남을 수 있다. 상태·영속 값·소비자 거절을 통합 시험으로 확인한다.
5. 전달되지 않은 필수 건수·listener 누락·부분 승격을 정상적인 건수 0으로 오해할 수 있다. 필수 키의 존재와 타입을 검사한 뒤 실제 Long 0만 허용한다.

</details>
