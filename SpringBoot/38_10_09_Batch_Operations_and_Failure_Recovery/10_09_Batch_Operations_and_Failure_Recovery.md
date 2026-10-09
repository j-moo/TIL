# Spring Batch 운영·실행 제어와 장애 복구

- 🎯 글의 목표: Batch 실행 이력을 읽고, 중지·재시작·비정상 종료 복구를 각각 어떤 조건에서 수행하는지 설명한다.
- 🧩 핵심 키워드: JobRepository, JobRegistry, JobOperator, BatchStatus, stop, restart, recover, abandon, 운영 기록, 관찰 지표
- ⭐ 중요도: 높음. 작업 코드를 잘 작성해도 살아 있는 실행을 잘못 복구하거나 입력을 바꾸어 재시작하면 데이터가 중복되거나 누락될 수 있다.
- 📝 한눈에 보는 내용: 상태와 실제 실행 주체 구분 → 실행 조회 → 협력적 중지 → 같은 업무 재시작 → 비정상 종료 복구 → 관찰·검증·이력 보존
- 🔗 관련 주제: [통합 테스트·재시작 검증](../37_10_08_Batch_Integration_Testing_and_Restart_Verification/10_08_Batch_Integration_Testing_and_Restart_Verification.md), [입력 스냅샷](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md), [로깅·Actuator](../12_09_08_Operations_Logging_and_Actuator/09_08_Operations_Logging_and_Actuator.md)
- 🧱 선수 지식: JobInstance와 JobExecution의 차이, chunk의 commit·rollback, JDBC 메타데이터 저장소, 입력 버전과 멱등성

> 기준일: 2026-10-09. 예제 기준은 Java 17 이상·Spring Batch 6.0.5다. 서비스·테스트 파일은 기존 JDBC Batch 프로젝트에 추가하는 예제이며 독립 실행 프로그램이 아니다. 공식 API와 6.0.5 구현을 확인했다. 작성 환경은 Java 8만 있고 Java 빌드 프로젝트·컴파일러가 없어 예제 컴파일, JUnit, DB·프로세스 복구 시험은 실행하지 않았다.

## 1. 들어가며

도서 데이터를 적재하는 작업이 실행 중인데 배포 시간이 되었다고 생각해 보자. 작업을 중지하고 다음 서버에서 이어서 처리하고 싶다. 이때 중지 버튼을 누르는 것, 작업 스레드가 실제로 끝나는 것, DB 이력이 STOPPED로 남는 것은 같은 순간에 일어나지 않는다.

반대로 서버가 갑자기 종료되면 DB에는 STARTED가 남아 있을 수 있다. 이 상태를 보고 다시 실행하면 아직 살아 있는 다른 worker와 충돌할 수도 있고, 아무 조치도 하지 않으면 실패한 업무가 계속 미완료로 남을 수도 있다.

앞선 노트는 실패를 주입하고 같은 업무를 재시작하여 결과를 대조했다. 이번에는 그 동작을 운영에서 **언제, 누구의 판단으로, 어떤 증거를 남기며 수행할지** 연결한다. 새로운 Reader·Writer를 만드는 대신 실행 조회와 제어의 경계를 배우며, 여러 서버를 완전히 조정하는 운영 플랫폼 구현은 범위 밖에 둔다.

## 2. 핵심 개념 정리

| 질문 | 중심 개념 | 이번 노트에서 확인할 것 |
| --- | --- | --- |
| DB에는 어떤 실행 상태가 남았는가? | JobRepository | Execution·Step·진행 수의 재조회 |
| 이 Job을 실제로 실행할 코드는 어디에 있는가? | JobRegistry | 실행 이력과 Job 정의의 차이 |
| 작업을 멈추라는 요청과 실제 종료는 같은가? | stop | 요청 수락과 종료 확인 분리 |
| 같은 실패 업무를 어떻게 이어 가는가? | restart | 같은 Instance·입력, 새로운 Execution |
| 프로세스가 죽어 STARTED에 남았다면? | recover | 실행 주체 종료 확인 후 이력 복구 |
| 다시 수행하지 않기로 결정했다면? | abandon | 재시작 포기와 업무 보상 구분 |
| 화면의 성공 표시를 믿어도 되는가? | 관찰·검증 | 메타데이터·실제 결과·운영 기록 대조 |

```text
실행 조회 + 실제 프로세스/worker 확인 + 업무 결과 확인
  ├─ 살아 있음 → 필요하면 stop 요청 → 실제 종료 확인
  ├─ FAILED/STOPPED → 원인·입력·호환성 확인 → restart
  └─ 실행 주체가 종료됐지만 이력은 실행 중 → 격리 확인 → recover → 재조회 → restart
```

이 지도에서 중요한 것은 상태 하나로 모든 결정을 내리지 않는다는 점이다. 각 명령의 자세한 조건은 다음 본문에서 설명한다.

## 3. 본문 정리

### 3.1 저장된 상태, 살아 있는 프로세스, 업무 결과는 별개다

**BatchStatus는 프레임워크가 관리하는 실행 생명주기 상태**다. 쉽게 말해 실행 이력에 적힌 진행 단계다. ExitStatus는 실행의 종료 의미를 나타내는 코드이며, 사용자 정의 코드를 둘 수도 있다. 두 값은 자주 비슷해 보이지만 같은 속성이 아니다.

예를 들어 정상 처리 뒤 일부 허용 누락을 나타내는 사용자 정의 종료 코드를 붙일 수 있다. 이때 생명주기상 COMPLETED라고 해도 업무적으로 모든 입력을 결과에 반영했다는 뜻은 아니다. 상태와 결과 검증을 구분하는 이유다. [BatchStatus API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/BatchStatus.html), [ExitStatus API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/ExitStatus.html)

운영에서는 다음 세 질문을 함께 확인한다.

1. **메타데이터**: 어떤 Instance의 몇 번째 Execution이며 Job·Step 상태는 무엇인가?
2. **실행 주체**: 그 업무를 맡은 서버·프로세스·worker가 지금도 입력을 읽거나 결과를 쓰는가?
3. **업무 결과**: 어떤 결과가 commit됐고, 무엇이 아직 처리되지 않았는가?

프로세스란 실행 중인 프로그램의 단위이며 스레드는 그 안에서 작업을 진행하는 실행 흐름이다. DB의 STARTED 행은 그 프로세스가 살아 있다는 실시간 증명이 아니다. 네트워크가 끊긴 서버가 작업을 계속하고 있을 수도 있고, 종료된 서버가 마지막 상태를 갱신하지 못했을 수도 있다.

| 저장된 상태 | 첫 해석 | 이 노트의 보수적인 운영 판단 |
| --- | --- | --- |
| STARTING | 실행 준비 단계 | 실제 실행 주체와 시작 지연 원인을 확인 |
| STARTED | 실행 중으로 기록됨 | 진행 상태와 실제 작업 주체를 함께 확인 |
| STOPPING | 중지 요청을 처리하는 단계 | 종료를 기다리고 재시작을 겹쳐 수행하지 않음 |
| STOPPED | 중지된 실행 | 입력·원인·최신 실행을 확인한 후 재시작 검토 |
| FAILED | 실패한 실행 | 실패 원인을 해결하고 재시작 조건 검토 |
| COMPLETED | 생명주기상 완료 | 업무 결과 대조, 같은 완료 업무의 재시작 금지 |
| ABANDONED | 재시작을 포기한 실행 | 재시작 대신 별도 업무 처리 방침 확인 |
| UNKNOWN | 상태를 신뢰하기 어려움 | 자동 복구 중단, DB 결과와 트랜잭션 이력 조사 |

표의 마지막 열은 프레임워크 API가 모든 상황을 자동 판단한다는 설명이 아니라 운영 절차의 설계 기준이다. 특히 UNKNOWN을 FAILED와 같은 말로 바꾸어 생각하지 않는다.

⚠️ 주의: 마지막 갱신 시간이 오래됐다는 이유만으로 프로세스가 죽었다고 판단하면 안 된다. 긴 SQL·외부 I/O·잠금 대기 때문에 상태 갱신이 늦어질 수 있다. 시간 초과는 조사 신호이지 실행 주체 종료의 증거가 아니다.

### 3.2 실행 이력과 실행할 Job 정의를 연결한다

**JobRepository는 실행 이력과 진행 상태를 저장·조회하는 인프라**다. JDBC 저장소라면 서버를 다시 실행해도 DB에 이력이 남는다. 반면 **JobRegistry는 이름으로 Job 정의를 찾는 등록부**다. 이력이 남았다는 사실만으로 현재 애플리케이션에 그 Job의 실행 코드가 등록된 것은 아니다. [JobRepository API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/repository/JobRepository.html), [JobRegistry 설명](https://docs.spring.io/spring-batch/reference/job/advanced-meta-data.html)

어제의 `snapshotImportJob` 실행 이력이 DB에 남아 있는데 오늘 코드에서 이름을 바꾸거나 Job을 등록하지 않았다고 생각해 보자. 이력 조회는 가능해도 이름으로 실행할 Job을 찾는 재시작 과정은 실패할 수 있다. Job 이름은 단순한 화면 표시 문자열이 아니라 실행 이력과 코드를 연결하는 이름이다.

**JobOperator는 시작·중지·재시작 등의 명령을 수행하는 인프라**다. Batch 6 예제에서는 `JobExecution`을 넘기는 `stop`, `restart`, `recover`, `abandon`을 사용한다. 이전 버전의 `restart(long)` 등과 패키지 경로를 섞지 않는다. [JobOperator API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html)

다음 예제에는 기존 프로젝트의 JDBC JobRepository·JobOperator Bean과 `snapshotImportJob` 정의가 필요하다. [입력 스냅샷 노트의 구성](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md)을 사용하고, 해당 Job이 JobRegistry에 등록되어 있는지 확인한다. 이미 자동·수동 구성이 있다면 같은 인프라 Bean을 다시 만드는 설정을 덧붙이지 않는다.

### 3.3 조회·중지·재시작에 최소한의 방어 조건을 둔다

아래는 `src/main/java/com/example/batch/CatalogBatchOperations.java`에 추가하는 **기존 프로젝트용 서비스 파일**이다. 입력은 특정 실행의 Execution ID이고, 조회 결과는 화면에 필요한 일부 상태만 담는다. 실제 운영에서는 이 서비스 호출 전에 관리 권한, 업무 입력 검증, 명령 간 배타적 조정이 필요하다. 이 파일만으로 그 기능이 완성되지는 않는다.

DTO는 외부에 전달할 값만 담는 객체다. Java의 record는 이런 값 묶음을 짧게 선언하는 문법이다. 저장 객체 전체를 반환하지 않아 파라미터·예외 설명·ExecutionContext에 들어 있을 수 있는 민감 정보를 일반 조회 화면에 섞지 않는다.

```java
package com.example.batch; // 기존 Batch 프로젝트의 패키지 아래에 둔다.

import java.util.Comparator; // Step 목록을 일관된 표시 순서로 정렬한다.
import java.util.List; // 화면에 전달할 Step 목록의 타입이다.
import org.springframework.batch.core.BatchStatus; // 생명주기 상태를 비교한다.
import org.springframework.batch.core.job.JobExecution; // 특정 실행 시도의 상태를 표현한다.
import org.springframework.batch.core.launch.JobExecutionNotRunningException; // 중지 경쟁 상태를 호출자에 전달한다.
import org.springframework.batch.core.launch.JobOperator; // 실제 제어 명령을 수행하는 인프라다.
import org.springframework.batch.core.launch.JobRestartException; // 재시작 실패를 호출자에 전달한다.
import org.springframework.batch.core.repository.JobRepository; // 영속 실행 이력을 다시 읽는다.
import org.springframework.stereotype.Service; // 컴포넌트 스캔에서 서비스 Bean으로 등록한다.

@Service
public class CatalogBatchOperations {
    private static final String JOB_NAME = "snapshotImportJob"; // 기존 스냅샷 Job의 이름으로 제어 범위를 제한한다.
    private final JobRepository repository; // 호출마다 저장된 상태를 읽는 데 사용한다.
    private final JobOperator operator; // 검사를 통과한 명령만 이 객체에 위임한다.

    public CatalogBatchOperations(JobRepository repository, JobOperator operator) {
        this.repository = repository; // Spring이 구성한 JDBC 저장소를 생성자로 받는다.
        this.operator = operator; // 직접 new로 만들어 기반 구성을 빠뜨리지 않는다.
    }

    public ExecutionView view(long executionId) {
        JobExecution execution = requireTarget(executionId); // 존재 여부와 Job 소속을 확인한다.
        List<StepView> steps = execution.getStepExecutions().stream() // 이 시도의 Step 상태를 읽는다.
                .sorted(Comparator.comparing(step -> step.getStepName())) // 로그 도착 순서에 의존하지 않는다.
                .map(step -> new StepView(
                        step.getId(), step.getStepName(), step.getStatus(), // Step 식별·현재 상태다.
                        step.getReadCount(), step.getWriteCount())) // 해당 시도에서 기록한 처리 수다.
                .toList(); // 원본 저장 객체가 아닌 표시용 목록을 만든다.
        return new ExecutionView(execution.getId(), execution.getJobInstance().getId(),
                execution.getStatus(), execution.getExitStatus().getExitCode(), steps);
        // Instance ID와 Execution ID를 모두 보여 같은 업무의 다른 시도를 구분한다.
    }

    public boolean requestStop(long executionId) throws JobExecutionNotRunningException {
        JobExecution execution = requireLatest(executionId); // 오래된 실패 이력의 제어를 막는다.
        BatchStatus status = execution.getStatus(); // 이번에 재조회한 상태로 판단한다.
        if (status == BatchStatus.STOPPING) {
            return false; // 이미 중지 요청 중이다. 새 요청은 보내지 않았다는 뜻이다.
        }
        if (status != BatchStatus.STARTING && status != BatchStatus.STARTED) {
            throw new IllegalStateException("시작 준비 또는 실행 중인 작업만 중지를 요청합니다.");
            // 완료·실패·중지 이력에 같은 명령을 반복하지 않는다.
        }
        return operator.stop(execution); // true는 중지 신호 전달이지 실제 종료 확인이 아니다.
    }

    public JobExecution restart(long executionId) throws JobRestartException {
        JobExecution execution = requireLatest(executionId); // 같은 Instance의 최신 시도인지 검사한다.
        BatchStatus status = execution.getStatus(); // 이미 성공하거나 다시 실행 중인지 확인한다.
        if (status != BatchStatus.FAILED && status != BatchStatus.STOPPED) {
            throw new IllegalStateException("실패 또는 중지된 최신 실행만 재시작합니다.");
            // STOPPING·UNKNOWN·ABANDONED를 재시작 가능한 실패로 취급하지 않는다.
        }
        return operator.restart(execution); // 기존 업무의 파라미터로 새 실행 시도를 만든다.
    }

    private JobExecution requireTarget(long executionId) {
        if (executionId <= 0) {
            throw new IllegalArgumentException("Execution ID는 양수여야 합니다."); // 잘못된 입력을 거절한다.
        }
        JobExecution execution = repository.getJobExecution(executionId); // 메모리 캐시 대신 이력을 조회한다.
        if (execution == null) {
            throw new IllegalArgumentException("해당 실행 이력이 없습니다."); // 없는 ID를 처리하지 않는다.
        }
        if (!JOB_NAME.equals(execution.getJobInstance().getJobName())) {
            throw new IllegalArgumentException("이 서비스의 제어 대상 Job이 아닙니다.");
            // 다른 Job의 ID를 전달해도 그 작업을 제어하지 못하게 한다.
        }
        return execution; // 검증한 JobExecution만 다음 단계에 전달한다.
    }

    private JobExecution requireLatest(long executionId) {
        JobExecution execution = requireTarget(executionId); // 먼저 ID와 소속을 검사한다.
        JobExecution latest = repository.getLastJobExecution(execution.getJobInstance());
        // 같은 날짜라는 추측 대신 같은 Instance의 마지막 시도를 조회한다.
        if (latest == null || latest.getId() != execution.getId()) {
            throw new IllegalStateException("최신 실행을 다시 조회한 뒤 명령을 수행해야 합니다.");
            // 옛 FAILED 이력을 보고 현재 성공·실행 중인 업무를 다시 건드리지 않는다.
        }
        return execution; // 조회와 명령 사이의 경쟁은 별도 운영 조정으로 다뤄야 한다.
    }

    public record StepView(long id, String name, BatchStatus status, long readCount, long writeCount) {}
    // Step별 값 묶음이다. 모든 시도의 합계나 최종 업무 행 수는 아니다.

    public record ExecutionView(long executionId, long instanceId, BatchStatus status,
                                String exitCode, List<StepView> steps) {}
    // 파라미터·종료 설명·context 전체는 이 표시용 객체에서 제외한다.
}
```

조회는 `requireTarget`을 거쳐 해당 Job의 이력을 보여 준다. 오래된 시도도 조사할 수 있으므로 조회에는 최신 실행 제한을 걸지 않았다. 반면 제어 명령은 `requireLatest`로 넘어가 같은 Instance의 최신 시도인지 추가로 검사한다.

예를 들어 Instance 40에 Execution 101(FAILED), 102(COMPLETED)가 있다면 101의 조회는 허용되지만 재시작은 거절된다. `getLastJobExecution`은 Job 전체의 마지막 실행이 아니라 **지정한 Instance의 마지막 실행**이다. Step 표시 순서는 이름순이며 실행 시간순이나 의존 관계 순서를 뜻하지 않는다. [저장소 조회 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/repository/JobRepository.html)

⚠️ 주의: 위 코드는 조회와 제어를 하나의 원자적 작업으로 만들지 않는다. 검사 직후 다른 관리자가 명령을 보낼 수 있다. 단일 JVM의 synchronized나 서비스의 `@Transactional`만으로 여러 서버의 실행·재시작을 완전히 직렬화한다고 설명해서는 안 된다. 공통 제어 경로·업무별 배타적 조정과 프레임워크의 동시 실행 거절을 함께 사용하고 경쟁 예외를 무시하지 않는다.

### 3.4 stop은 협력적 중지 요청이다

**협력적 중지는 작업이 중지 신호를 확인하고 안전한 경계에서 멈추는 방식**이다. 전원을 끊는 것처럼 현재 SQL과 스레드를 무조건 즉시 끊는 명령이 아니다. chunk 작업은 중지 신호를 확인하는 경계까지 진행할 수 있으므로 요청 뒤에도 일부 결과가 확정될 수 있다. 긴 Tasklet은 자신의 중지 대응을 별도로 고려해야 한다. [JobOperator stop 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html), [6.0.5 중지 구현](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/launch/support/SimpleJobOperator.java)

위 서비스에서 true는 중지 명령을 보냈다는 의미다. false는 이미 STOPPING이어서 새 요청을 보내지 않았다는 서비스의 의미다. 둘 중 어느 값도 “모든 worker 종료·rollback 완료”를 의미하지 않는다. 정상 완료나 다른 오류와 경쟁할 수 있으므로 최종 상태는 다시 읽어야 한다.

중지 요청 뒤의 확인 순서는 다음과 같다.

1. Execution ID와 중지 요청 시각을 기록한다.
2. 제한된 간격으로 `view`를 호출하여 Job·Step 상태를 다시 읽는다.
3. 해당 실행을 담당한 작업 스레드·프로세스·worker의 종료도 확인한다.
4. 확정된 결과를 조회하고 이어서 처리할 입력이 유지되는지 확인한다.
5. 제한 시간 안에 종료를 확인하지 못하면 조사 상태로 남긴다. 곧바로 recover·restart하지 않는다.

여기서 **제한 시간은 운영자가 얼마나 기다릴지를 정한 값**이지 자동으로 안전한 복구를 보장하는 값이 아니다. 10초나 1분 같은 숫자는 Job의 SQL·chunk 처리 시간·종료 요구사항을 보고 정한다. 기다림을 끝낸다는 것과 작업을 끝낸다는 것은 다르다.

운영 화면에는 “중지 요청됨”과 “중지 확인됨”을 분리해 표시한다. 실행 종료 전에 fixture나 이력을 지우는 버튼도 허용하지 않는다. 긴 작업을 HTTP로 시작한다면 실행기 설정에 따라 호출 자체가 오래 기다릴 수 있으므로 요청 수락과 상태 조회를 분리하는 구조를 선택한다. [JobOperator와 TaskExecutor 구성](https://docs.spring.io/spring-batch/reference/job/configuring-operator.html)

### 3.5 restart는 실패 원인을 해결한 같은 업무의 새 시도다

**재시작은 기존 업무의 입력과 진행 상태를 이어 사용하는 새 실행 시도**다. Instance는 업무의 정체성이고 Execution은 한 번의 시도이므로 정상적인 재시작에서는 Instance가 같고 Execution ID가 달라진다. Reader의 저장 상태와 Step 설정에 따라 재개 방식이 달라지며, DB나 외부 효과의 정확히 한 번 반영까지 자동 보장하지는 않는다.

이전 입력 스냅샷 예제에서는 식별 파라미터로 업무 날짜와 snapshot ID를 사용했다. 실패 뒤 snapshot ID를 새로 생성하거나 시간값을 식별 파라미터에 추가하면 다른 업무가 될 수 있다. 같은 업무를 복구하려는데 새로운 Instance를 만들어 처음부터 실행하는 것은 다른 선택이다.

운영자가 `restart`를 호출하기 전에 다음을 확인한다.

- 실패 원인이 잘못된 입력인지, DB 연결·권한·잠금 등 환경 문제인지 구분한다.
- 발행한 snapshot·업무 파라미터와 이미 확정한 결과를 보존한다.
- 해당 Instance의 최신 실행이 FAILED 또는 STOPPED이며 다른 실행 주체가 결과를 쓰지 않는지 확인한다.
- 현재 배포의 Job 이름·Step 이름·Reader 상태 해석·업무 결과 스키마가 이전 실행과 호환되는지 확인한다.
- 중복 INSERT·외부 호출이 생기는 경우의 멱등성 정책과 결과 대조 기준을 확인한다.

예를 들어 연결 권한 문제로 실패했다면 권한을 복구하고 동일 입력으로 재시작할 수 있다. 업무 데이터 자체가 잘못됐다면 이미 발행한 snapshot의 일부 값을 몰래 바꾸지 않는다. 기존 입력을 보존하고 정정 버전·결과 보상·새 업무가 필요한지 업무 규칙에 따라 결정한다.

`JobOperator.restart(JobExecution)`는 JobRegistry에서 같은 이름의 Job을 찾고 기존 실행의 파라미터로 다시 실행한다. 반환 시점이 완료인지 제출 직후인지는 연결된 TaskExecutor에 달려 있다. 이력 재조회와 결과 대조까지 수행해야 성공을 확정할 수 있다. [재시작 구현](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/launch/support/SimpleJobOperator.java), [실행기 구성](https://docs.spring.io/spring-batch/reference/job/configuring-operator.html)

⚠️ 주의: 서버 배포가 끝났다는 이유로 모든 FAILED 업무를 자동 재시작하지 않는다. 코드 수정이 저장된 context의 의미를 바꾸었거나 잘못된 입력을 그대로 읽는다면 같은 실패·중복 처리·복구 불가능성이 반복될 수 있다.

### 3.6 recover는 비정상 종료의 이력을 정리하는 작업이다

**recover는 갑작스러운 종료로 실행 중 상태에 남은 이력을 재시작 가능한 FAILED로 바꾸는 작업**이다. 실행 프로세스를 찾아 죽이는 기능이나 결과 데이터를 원상복구하는 기능이 아니다. Batch 6의 API이며 이후의 restart와 구분된다. [JobOperator recover 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html)

운영에서 먼저 해결할 문제는 “오래된 실행이 정말 다시 쓰지 못하는가?”다. 서버에 접속할 수 없다는 사실은 종료 증거가 아니다. 병렬 작업이면 manager 서버뿐 아니라 원격 worker도 확인해야 한다.

**fencing은 이전 실행 주체가 늦게 돌아와도 더 이상 결과를 쓰지 못하게 막는 통제**다. 예를 들어 작업 소유권의 세대 번호를 쓰기 조건에서 검사해 오래된 소유자의 UPDATE를 거절하는 방식이 있다. 번호만 발급하고 Writer·대상 시스템이 검사하지 않는다면 fencing이 아니다. 이 노트의 서비스에는 이런 분산 통제가 구현되어 있지 않다.

비정상 종료 복구에는 다음 절차를 적용한다.

1. 새 실행을 제출하는 스케줄러·관리 경로를 일시적으로 통제한다.
2. 해당 Execution의 manager·모든 worker·외부 작업 주체를 추적한다.
3. 실행 주체 종료 또는 이전 소유자의 쓰기를 차단하는 통제를 확인한다. 진행 중이던 DB 트랜잭션이 어떻게 정리됐는지도 조사한다.
4. 입력·결과·메타데이터를 보존하고 Execution ID, 배포 버전, 확인 근거를 남긴다.
5. 최신 실행이 여전히 실행 중 상태에 남아 있는지 재조회한다. UNKNOWN 등 불명확한 상태는 자동 복구 대상에서 제외한다.
6. recover를 수행하고 영속 상태를 다시 확인한다.
7. 입력·배포 호환성·결과 대조 계획을 확인한 뒤 별도 단계로 restart한다.

다음은 **위 1~5단계를 별도 운영 절차에서 완료한 뒤의 일부 코드**다. 앞 서비스의 메서드 내부에 두는 호출 흐름이며 자동 실행 작업이나 공개 HTTP 엔드포인트가 아니다. `requireLatest`, `repository`, `operator`는 앞 파일의 멤버이고 `executionId`는 검증한 대상 ID다.

```java
JobExecution stale = requireLatest(executionId); // 격리한 업무의 최신 이력을 다시 읽는다.
if (!stale.getStatus().isRunning()) { // STARTING·STARTED·STOPPING 외에는 이 복구 흐름을 사용하지 않는다.
    throw new IllegalStateException("실행 중 상태에 남은 이력만 이 절차로 복구합니다.");
}
operator.recover(stale); // 실제 주체를 중단시키는 것이 아니라 이력의 복구 처리를 요청한다.
JobExecution recovered = requireLatest(executionId); // 반환 객체 대신 저장소 상태를 다시 확인한다.
if (recovered.getStatus() != BatchStatus.FAILED) {
    throw new IllegalStateException("복구된 실패 상태를 확인하지 못했습니다.");
    // 요청했다고 성공으로 가정하지 않고 조사 상태로 남긴다.
}
// 여기서 자동으로 restart하지 않는다. 입력·배포 호환성·결과 검증 준비를 다시 확인한다.
```

6.0.5 구현은 실행 중인 Step 이력과 Job 이력에 복구 처리를 수행한다. COMPLETED·ABANDONED·UNKNOWN은 복구하지 않는 경로가 있으므로 메서드 반환만 보고 성공을 판정하지 않는다. 내부 context 키나 상태 컬럼을 SQL로 직접 바꾸어 이 API의 처리를 흉내 내지 않는다. [6.0.5 recover 구현](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/launch/support/SimpleJobOperator.java)

⚠️ 주의: recover가 실패하거나 중간 상태가 예상과 다르면 연속 호출로 덮어쓰지 않는다. 관련 Step·Job 이력과 결과를 함께 조사한다. 메타데이터에 실패를 적는 행위가 이미 commit한 결과나 외부 알림을 취소하지는 않는다.

### 3.7 abandon은 재시작 포기이지 rollback이 아니다

**abandon은 실행 이력을 ABANDONED로 표시하여 프레임워크 재시작을 포기하는 명령**이다. 임시 중지 후 이어 갈 의도라면 STOPPED와 restart를 검토한다. 다시 수행하지 않기로 승인한 업무라면 abandon과 별도 업무 정리 절차를 검토한다. [JobOperator abandon 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html)

예를 들어 잘못된 파일 버전의 적재에서 일부 결과가 확정됐다면 이력을 abandon해도 그 결과는 남는다. 이미 확정한 결과를 삭제·정정할지, 별도 보상 업무를 실행할지 판단해야 한다. “실행을 더 이어 가지 않는다”와 “업무 효과를 없앤다”는 서로 다른 결정이다.

실행 주체의 종료를 확인하고 최신 FAILED·STOPPED 등의 이력에 대해 운영 승인을 받은 다음 API를 사용한다. 살아 있는 작업을 멈추는 대용 명령으로 쓰지 않는다. 이 노트의 일반 제어 서비스에는 포기 명령을 노출하지 않아 조회·중지·재시작과 동일한 권한으로 처리하지 않도록 했다.

### 3.8 관찰은 실행 상태와 업무 완료를 함께 보여 준다

**관찰 지표는 실행 시간·처리량·실패 같은 값을 측정해 흐름을 파악하는 정보**다. 메트릭은 여러 실행의 경향을 보기 좋고, 실행 이력은 특정 업무의 복구 위치를 찾기 좋다. 둘 중 하나가 다른 하나를 대체하지 않는다.

Batch 6 문서의 Micrometer 메트릭 수집은 기본 비활성 상태이며, 측정 정보를 연결할 ObservationRegistry와 적절한 handler 구성이 필요하다. 과거 버전의 “설정 없이 global registry에 등록된다”는 설명을 그대로 적용하지 않는다. 기존 Boot 설정이 구성한 registry가 있다면 그것부터 확인한다. [Batch 6 Micrometer 지원](https://docs.spring.io/spring-batch/reference/spring-batch-observability/micrometer.html)

`spring.batch.job`은 실행 시간, `spring.batch.job.active`는 활성 실행, `spring.batch.step`은 Step 실행 시간을 관찰하는 데 사용한다. Job·Step의 status 태그는 ExitStatus에 기반하므로 BatchStatus 컬럼과 항상 동일하다고 가정하지 않는다. 실제 수집·노출 여부는 테스트 환경에서 확인해야 한다.

**태그의 cardinality는 태그값 조합의 개수**다. 고정 Job 이름은 종류가 적지만 Execution ID·snapshot ID는 실행마다 늘어난다. 고유 ID를 모든 메트릭의 태그에 넣으면 시계열이 계속 증가할 수 있다. 특정 실행을 찾는 ID는 접근 통제된 로그·이력에 남기고, 집계 지표의 태그는 제한된 값으로 설계한다.

| 관찰 항목 | 알아낼 수 있는 것 | 이것만으로 알 수 없는 것 |
| --- | --- | --- |
| 실행 시간 증가 | 평소보다 처리 시간이 길어짐 | 프로세스가 죽었는지 여부 |
| Step read·write 수 변화 | 해당 시도의 처리 진행 | 전체 업무의 최종 결과 정확성 |
| FAILED·ExitStatus | 저장된 실패·종료 의미 | SQL·외부 호출의 모든 효과 |
| 업무별 결과 대조 | 입력 ID·값과 실제 결과의 차이 | worker의 현재 생존 여부 |
| 예정 업무의 완료 여부 | 스케줄 누락·업무 미완료 | 웹 서버 health만으로는 확인 불가 |

예를 들어 “오늘 적재가 02시까지 끝나야 한다”는 업무 기준이 있다면 완료 Execution이 있는지만 보지 않는다. 오늘의 발행 입력과 결과 ID·값을 대조하고 허용 누락이 있다면 사유도 확인한다. readCount·writeCount는 실행별 값이고 Partitioning의 manager·worker를 무작정 합치면 중복 집계가 될 수 있다.

**운영 감사 기록은 누가 어떤 근거로 제어 명령을 수행했는지 남기는 기록**이다. 명령 ID, 수행 주체, 대상 Instance·Execution, 명령 종류, 사유, 관찰한 이전·이후 상태, 새 Execution ID, 오류 결과를 연결한다. 인증 정보·원본 파라미터 전체·예외 설명 전체를 공개 화면에 그대로 싣지 않는다.

명령 호출 도중 네트워크가 끊겼다면 재시작을 반복 호출하기 전에 새 Execution이 만들어졌는지 확인한다. 응답을 받지 못한 것과 명령이 수행되지 않은 것은 다르다. 업무별 제어 기록을 통해 응답 유실도 추적한다.

### 3.9 방어 조건의 단위 테스트와 실제 복구 시험을 구분한다

아래는 `src/test/java/com/example/batch/CatalogBatchOperationsTest.java`에 추가하는 **JUnit Jupiter·Mockito 단위 테스트 파일**이다. 기존 프로젝트에 JUnit·Mockito 테스트 의존성이 있어야 한다. Spring 컨텍스트나 DB를 띄우지 않고 제어 명령을 잘못 전달하지 않는 조건만 검사한다.

**mock은 실제 인프라 대신 미리 정한 값을 돌려주는 테스트 대역**이다. 따라서 이 테스트가 통과해도 실제 SQL rollback·stop 처리·재시작이 검증된 것은 아니다. 기대하는 것은 네 개의 방어 조건 테스트가 통과하는 것이며, 여기서는 실행하지 않았다.

```java
package com.example.batch; // 테스트할 서비스와 같은 패키지다.

import org.junit.jupiter.api.BeforeEach; // 각 테스트 전에 독립된 대역을 준비한다.
import org.junit.jupiter.api.Test; // JUnit이 실행할 메서드임을 표시한다.
import org.springframework.batch.core.BatchStatus; // 테스트할 상태를 지정한다.
import org.springframework.batch.core.job.JobExecution; // 실행 이력 대역의 타입이다.
import org.springframework.batch.core.job.JobInstance; // 같은 업무의 소속을 설정한다.
import org.springframework.batch.core.launch.JobOperator; // 잘못된 명령이 도달하지 않는지 검사한다.
import org.springframework.batch.core.repository.JobRepository; // 조회 결과를 미리 지정한다.
import static org.junit.jupiter.api.Assertions.assertFalse; // 중지 요청을 새로 보내지 않았는지 검사한다.
import static org.junit.jupiter.api.Assertions.assertThrows; // 거절 예외가 발생하는지 검사한다.
import static org.mockito.Mockito.*; // mock·when·verify 등의 테스트 도구를 사용한다.

class CatalogBatchOperationsTest {
    private JobRepository repository; // 실제 DB가 아닌 조회 대역이다.
    private JobOperator operator; // 실제 작업을 시작하지 않는 명령 대역이다.
    private CatalogBatchOperations operations; // 테스트 대상은 실제 서비스 객체다.
    private JobExecution execution; // 조회할 최신 실행 이력의 대역이다.
    private JobInstance instance; // 해당 실행이 속한 업무의 대역이다.

    @BeforeEach
    void prepare() {
        repository = mock(JobRepository.class); // 테스트마다 새 조회 대역을 만든다.
        operator = mock(JobOperator.class); // 이전 테스트의 호출 기록을 공유하지 않는다.
        instance = mock(JobInstance.class); // Job 이름을 돌려줄 업무 대역을 만든다.
        execution = mock(JobExecution.class); // 상태·ID를 돌려줄 실행 대역을 만든다.
        when(instance.getJobName()).thenReturn("snapshotImportJob"); // 허용한 Job을 사용한다.
        when(execution.getId()).thenReturn(101L); // 조회 ID와 실행 ID를 맞춘다.
        when(execution.getJobInstance()).thenReturn(instance); // 실행을 업무에 연결한다.
        when(repository.getJobExecution(101L)).thenReturn(execution); // 이력 조회 응답을 정한다.
        when(repository.getLastJobExecution(instance)).thenReturn(execution); // 기본은 최신 실행이다.
        operations = new CatalogBatchOperations(repository, operator); // 대역을 생성자로 전달한다.
    }

    @Test
    void stoppingDoesNotSendAnotherStop() throws Exception {
        when(execution.getStatus()).thenReturn(BatchStatus.STOPPING); // 이미 요청된 상황이다.
        assertFalse(operations.requestStop(101L)); // 새 중지 요청을 보내지 않아야 한다.
        verifyNoInteractions(operator); // 대역의 stop 자체를 호출하지 않았는지 검사한다.
    }

    @Test
    void completedExecutionCannotRestart() {
        when(execution.getStatus()).thenReturn(BatchStatus.COMPLETED); // 완료 업무를 준비한다.
        assertThrows(IllegalStateException.class, () -> operations.restart(101L));
        // 예외가 발생해야 완료 업무의 중복 수행을 시도하지 않는다.
        verifyNoInteractions(operator); // 재시작 명령이 전달되지 않았음을 확인한다.
    }

    @Test
    void oldFailedExecutionCannotRestart() {
        when(execution.getStatus()).thenReturn(BatchStatus.FAILED); // 화면에 남은 옛 실패 상태다.
        JobExecution newer = mock(JobExecution.class); // 이후 실행의 존재를 표현한다.
        when(newer.getId()).thenReturn(102L); // 조회 대상으로 받은 ID와 다르다.
        when(repository.getLastJobExecution(instance)).thenReturn(newer); // 최신 시도를 바꾼다.
        assertThrows(IllegalStateException.class, () -> operations.restart(101L));
        // 실패 상태여도 최신 시도가 아니라면 먼저 다시 조회해야 한다.
        verifyNoInteractions(operator); // 옛 이력을 통한 재시작을 차단한다.
    }

    @Test
    void anotherJobCannotBeControlled() {
        when(instance.getJobName()).thenReturn("anotherJob"); // 다른 Job의 ID가 전달된 상황이다.
        assertThrows(IllegalArgumentException.class, () -> operations.restart(101L));
        // 같은 DB에 이력이 있어도 이 서비스의 제어 범위를 벗어나면 거절한다.
        verifyNoInteractions(operator); // 다른 Job에 명령이 전달되지 않는다.
    }
}
```

Java 프로젝트 루트에서 현재 사용하는 Wrapper 하나를 선택한다. TIL 저장소에는 이 Java 프로젝트가 없으므로 아래 명령을 TIL 루트에서 실행하지 않는다.

```powershell
# Gradle 프로젝트라면 방어 조건 테스트 파일을 실행한다.
./gradlew.bat test --tests com.example.batch.CatalogBatchOperationsTest

# Maven 프로젝트라면 같은 테스트 파일을 실행한다.
./mvnw.cmd -Dtest=CatalogBatchOperationsTest test
```

실제 중지·복구는 다음 **별도 통합 시험 설계**로 확인한다. 각 시험은 자기 입력·결과·메타데이터를 분리한 전용 DB를 사용하며, 모든 대기에는 유한 제한을 둔다.

| 시험 | 통제할 조건 | 확인할 증거 |
| --- | --- | --- |
| 정상 중지 | Writer의 특정 진입 지점을 테스트 신호로 통제하고 별도 제어 스레드에서 stop | 요청과 종료의 구분·최종 Job/Step 상태·확정 결과 |
| 중지 후 재시작 | 모든 작업 종료 뒤 동일 입력으로 restart | 같은 Instance·새 Execution·입력 보존·최종 ID와 값 |
| 중지·완료 경쟁 | 마지막 처리와 명령 제출의 순서를 별도로 통제 | 실제 최종 상태·예외·불필요한 재시작 없음 |
| 두 관리자 경쟁 | 같은 업무에 제어 명령을 겹쳐 제출 | 활성 실행 중복 거절·감사 기록·중복 결과 없음 |
| 강제 종료 복구 | 별도 프로세스 종료, worker·DB 작업 정리 확인, 이력 보존 | recover 후 영속 상태·새 프로세스 재개·최종 값 대조 |
| 조회와 메트릭 | 선택한 registry·관찰 구성에서 작업 실행 | 지표 수집·표시 상태·실제 업무 완료의 구분 |

Writer가 멈춘 지점에서는 중지 신호 전달 뒤 테스트 제어 스레드가 대기를 해제하고 Job·worker가 끝나는지 확인한다. 대기를 해제하지 않은 채 STOPPED만 기다리는 시험은 교착처럼 보일 수 있다. 현재 chunk가 확정됐는지는 실제 결과를 읽어 확인하고 중지 명령 시각만으로 rollback 여부를 추측하지 않는다.

프로세스를 종료하는 시험은 실제 예외를 던지는 시험과 다르다. 입력과 메타데이터를 유지하고 새 프로세스에서 이력을 읽어야 한다. 중간에 메타데이터를 비우면 재시작이 아니라 새 작업을 시험하게 된다. [앞선 실패·재시작 테스트](../37_10_08_Batch_Integration_Testing_and_Restart_Verification/10_08_Batch_Integration_Testing_and_Restart_Verification.md)와 연결하여 최종 결과를 건수뿐 아니라 ID·값으로 대조한다.

### 3.10 복구에 필요한 이력과 입력은 함께 보존한다

**보존 정책은 조사·재시작·감사에 필요한 자료를 언제까지 유지할지 정하는 규칙**이다. 메타데이터는 남아 있는데 입력 파일을 삭제했거나, 입력은 남아 있는데 ExecutionContext를 지웠다면 안전한 재개가 어려울 수 있다.

Job 이름·식별 파라미터·입력 버전·결과 식별 키·배포 버전·제어 기록을 연결한다. 실행 중이거나 복구 결정이 끝나지 않은 업무를 일반적인 오래된 데이터 정리 작업에 포함하지 않는다. 이력만 보존한다고 모든 외부 효과가 복구 가능한 것도 아니므로 메시지·알림은 별도 중복·보상 정책과 연결한다.

보존 기간이 끝난 업무를 정리할 때는 실제 실행 종료, 복구 불필요 여부, 감사 요구사항, 관련 데이터 의존 관계를 먼저 확인한다. 업무 결과 삭제와 메타데이터 삭제를 하나의 의미로 취급하지 않는다. 전체 Batch 테이블을 비우는 방식은 업무 식별과 조사 증거를 함께 없앨 수 있다.

## 4. 적용 관점에서 다시 보기

운영 화면을 만든다면 먼저 Instance와 Execution을 함께 표시하고 조회·제어 권한을 구분한다. 일반 조회에는 제한된 DTO를 사용하고, 제어는 Job 소속과 최신 실행 여부를 다시 검사한다. 검사와 실행 사이의 경쟁은 공통 제어 경로·업무별 조정·경쟁 예외 기록으로 다룬다.

배포 전 중지는 요청 수락을 기록한 뒤 Job·Step 이력과 실제 실행 주체의 종료를 확인하는 순서로 적용한다. 기다림의 제한 시간이 끝났다고 재시작을 겹쳐 수행하지 않는다.

일반 FAILED·STOPPED는 원인과 입력·배포 호환성을 확인한 뒤 restart한다. 갑작스러운 종료로 실행 중 이력이 남았다면 이전 주체의 종료·쓰기 차단을 확인한 뒤 recover와 restart를 분리해 수행한다. 재시작 포기는 이미 확정한 업무 효과의 보상과 구별한다.

마지막에는 저장 상태·운영 기록·지표·업무 결과를 대조한다. 단위 테스트로 방어 조건을 확인한 뒤 실제 DB·중지 경쟁·별도 프로세스 복구 시험으로 범위를 넓히고, 조사와 재개에 필요한 입력·이력을 함께 보존한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

실행 이력은 실제 작업 주체의 생존 증명이 아니며 중지 요청도 종료 증명이 아니다. 안전한 복구에는 최신 실행 확인, 이전 주체의 종료·격리, 입력 보존, 결과 대조가 함께 필요하다.

### 5.2 이전·다음 학습과의 연결

[통합 테스트 노트](../37_10_08_Batch_Integration_Testing_and_Restart_Verification/10_08_Batch_Integration_Testing_and_Restart_Verification.md)의 실패·재시작 증거를 운영 판단과 이력 보존으로 연결했다. 다음에는 **Spring Batch 다단계 Job·조건부 흐름과 결과 검증 Step**을 학습해 처리·검증·후속 작업의 책임을 나누고 실패한 단계부터 재개하는 흐름을 다룬다.

### 5.3 더 파볼 만한 주제

여러 서버의 제어 명령을 직렬화하는 운영 서비스, 이전 소유자의 쓰기를 차단하는 fencing, 배포 버전별 context 호환성을 확장할 수 있다. 외부 효과가 있는 작업은 Outbox·멱등성·보상 절차를 포함한 프로세스 종료 시험으로 넓힌다.

### 5.4 참고 자료

- [BatchStatus](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/BatchStatus.html), [ExitStatus](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/ExitStatus.html): 생명주기 상태와 종료 의미의 구분.
- [JobRepository](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/repository/JobRepository.html): 실행 ID 조회·Instance별 최신 시도·Step 상태 조회.
- [JobRegistry](https://docs.spring.io/spring-batch/reference/job/advanced-meta-data.html): 저장된 이력과 실행할 Job 정의를 연결하는 등록부.
- [JobOperator](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html): stop·restart·recover·abandon 계약과 Batch 6 API.
- [JobOperator 구성](https://docs.spring.io/spring-batch/reference/job/configuring-operator.html): 실행기 선택에 따른 동기·비동기 호출 경계.
- [SimpleJobOperator 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/launch/support/SimpleJobOperator.java), [TaskExecutorJobOperator 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/launch/support/TaskExecutorJobOperator.java): 제어 명령의 실제 구현. 새 구성에 deprecated SimpleJobOperator를 직접 등록하라는 의미는 아니다.
- [Batch 6 Micrometer 지원](https://docs.spring.io/spring-batch/reference/spring-batch-observability/micrometer.html): ObservationRegistry·handler와 기본 수집 조건·status 태그.

## 6. 요약 정리

1. 저장된 상태, 실제 프로세스·worker, 확정된 업무 결과를 각각 확인한다.
2. JobRepository는 이력, JobRegistry는 실행할 Job 정의, JobOperator는 제어 명령을 담당한다.
3. 제어 대상 Job과 같은 Instance의 최신 실행을 확인하고 조회·명령 사이의 경쟁을 다룬다.
4. stop은 협력적 중지 요청이며 요청 수락 뒤 실제 종료를 확인해야 한다.
5. restart는 입력·파라미터를 유지한 같은 Instance의 새로운 Execution이다.
6. recover 전에 이전 실행 주체의 종료·쓰기 차단을 확인하고, 복구 후 영속 상태를 다시 읽는다.
7. abandon은 재시작 포기이며 이미 확정된 데이터의 rollback이나 보상이 아니다.
8. 지표·로그·운영 기록·업무 결과를 연결하고 고유 ID의 메트릭 태그 남용을 피한다.
9. 방어 조건의 단위 테스트와 실제 DB·프로세스 복구 시험을 구분하고 입력·이력을 함께 보존한다.

🧠 기억할 것: 다시 실행하기 전에, 이전 실행이 더 이상 쓰지 못하며 같은 입력으로 결과를 대조할 수 있는지 확인한다.

## 7. 미니 퀴즈 또는 체크리스트

1. stop이 true를 반환했다. 지금 즉시 restart해도 되는가?
2. STARTED 실행의 마지막 갱신 시간이 30분 전이다. recover의 충분한 근거인가?
3. Instance 40의 Execution 101은 FAILED이고 102는 COMPLETED다. 101을 재시작하면 안 되는 이유는 무엇인가?
4. 일부 결과가 확정된 실행을 abandon했다. 확정 결과는 자동으로 없어지는가?
5. mock 테스트 네 개가 통과했다. 실제 DB·프로세스 종료 복구까지 검증됐다고 할 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 아니다. true는 중지 신호 전달이다. Job·Step 상태와 실제 작업 종료를 확인하고 최신 실행·입력·호환성을 검토한 뒤 재시작한다.
2. 아니다. 긴 SQL·잠금·네트워크 문제일 수 있다. manager·worker의 종료 또는 이전 소유자의 쓰기 차단, DB 트랜잭션 정리를 확인해야 한다.
3. 이미 같은 업무의 더 최신 시도가 완료됐다. 옛 실패 이력만 보고 명령을 내리면 현재 업무 상태를 무시하게 된다. 조회는 허용하되 제어는 최신 시도로 제한한다.
4. 아니다. 실행을 이어 가지 않는다는 결정일 뿐이다. 결과의 정정·삭제·보상이 필요하면 별도 업무 규칙과 절차를 적용한다.
5. 아니다. 명령을 잘못 전달하지 않는 방어 조건만 확인했다. JDBC 이력·실제 결과·작업 종료·새 프로세스 재개를 시험해야 한다.

</details>
