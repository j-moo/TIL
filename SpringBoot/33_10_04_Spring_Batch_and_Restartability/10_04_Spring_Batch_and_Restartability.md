# Spring Batch와 대량 작업의 재시작·체크포인트

- 🎯 글의 목표: 대량 처리를 Job·Step·chunk로 나누고, 실패한 작업이 마지막으로 확정한 지점부터 다시 진행하는 조건을 설명한다.
- 🧩 핵심 키워드: Job, Step, JobInstance, JobExecution, JobParameters, JobRepository, chunk, ExecutionContext, ItemStream, 재시작
- ⭐ 중요도: 높음. 주기적으로 실행하는 가져오기·정산 작업은 정상 처리뿐 아니라 부분 성공과 실패 후 복구까지 설계해야 한다.
- 📝 한눈에 보는 내용: 작업 구조 → 업무 식별 → 묶음 트랜잭션 → 진행 상태 저장 → CSV 가져오기 → 재시작과 실패 검증 순서로 이해한다.
- 🔗 관련 주제: [스케줄링과 중복 실행 제어](../32_10_03_Scheduling_and_Duplicate_Execution/10_03_Scheduling_and_Duplicate_Execution.md), [트랜잭션과 rollback](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md), [멱등성 키](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md), [Flyway](../21_09_19_Flyway_Schema_Migrations/09_19_Flyway_Schema_Migrations.md)
- 🧱 선수 지식: Java 클래스·record·람다·예외, Bean과 생성자 주입, JDBC·DataSource, commit·rollback을 읽을 수 있다.

> 자료 기준일: 2026-10-04. Spring Boot 4.1.1과 그 의존성 표의 Spring Batch 6.0.5를 기준으로 공식 문서·API·자동 설정 소스를 확인했다. Java 예제는 JDK 21을 사용하는 기존 Boot 프로젝트에 추가하는 파일과 테스트용 일부 코드이며, 독립 실행 프로젝트는 아니다. SQL은 PostgreSQL 학습 DB를 전제로 한다. 현재 환경에서는 Java 8 실행 명령만 확인됐고 javac·Maven·Gradle 명령과 저장소 내 Boot 빌드 프로젝트를 찾지 못해 컴파일·DB 실행·재시작 테스트를 수행하지 않았다. 아래 결과는 예상 결과이며 문서 정적 검사와 구분한다.

## 1. 들어가며

매일 들어오는 도서 목록 10만 건을 DB에 저장한다고 생각해 보자. 예약 시각에 메서드를 호출하는 것은 이전 스케줄링 노트에서 다뤘다. 하지만 6만 건을 저장한 뒤 서버가 멈췄다면, 다음 실행은 어디에서 시작해야 할까?

전체를 하나의 트랜잭션으로 처리하면 실패할 때 모두 취소할 수 있지만 오래 유지되는 연결·잠금과 큰 처리 부담이 생긴다. 반대로 행마다 따로 저장하면 부분 성공이 남고, 어느 행까지 확정했는지 별도로 관리해야 한다. 단순한 반복문에 이러한 복구 책임을 계속 붙이면 실행 이력과 업무 코드가 뒤섞이기 쉽다.

**Spring Batch는 정해진 범위의 데이터를 처리하는 작업과 그 실행 상태를 관리하는 프레임워크다.** 이 노트에서는 단일 스레드로 CSV를 읽어 DB에 저장하면서, 작업 식별과 묶음 단위 확정이 재시작에 어떻게 연결되는지 살펴본다. 병렬 처리와 복잡한 retry·skip 정책은 다음 학습으로 남긴다.

또한 JPA의 [Batch Fetching](../19_09_16_Batch_Fetching/09_16_Batch_Fetching.md)과는 다른 기술이다. Batch Fetching은 연관 데이터를 묶어 조회하는 전략이고, Spring Batch는 작업 단계·실행 이력·실패 후 진행을 관리한다. 이름에 batch가 있다는 이유만으로 같은 기능으로 이해하지 않는다.

## 2. 핵심 개념 정리

```text
스케줄러 또는 운영 요청: 언제 시작할까?
  → JobParameters: 어느 업무를 처리할까?
  → JobOperator: 작업 시작·중지·재시작
  → Job: 전체 처리 흐름
      → Step: 하나의 처리 단계
          → Reader → Processor → Writer → chunk commit
                                  ↘ 진행 상태를 JobRepository에 저장
실패 후 같은 업무 재시작 → 저장된 체크포인트를 복원 → 남은 처리
```

이 흐름에서 시작 시각, 업무의 정체성, 한 번의 시도, 확정한 진행 지점은 서로 다른 정보다. 구분해서 보면 재시작이 단순히 같은 메서드를 다시 호출하는 것이 아님을 이해할 수 있다.

| 핵심 질문 | 연결할 개념 |
| --- | --- |
| 전체 업무와 단계는 무엇인가? | Job·Step, 3.1 |
| 같은 업무의 재시도인가, 새로운 업무인가? | Instance·Execution·Parameters, 3.2 |
| 실패할 때 어디까지 취소되는가? | chunk·트랜잭션, 3.3 |
| 다음 실행에서 무엇을 복원하는가? | ExecutionContext·ItemStream, 3.4 |
| 서버가 꺼져도 이력이 남는가? | JDBC JobRepository·설정, 3.5 |
| 코드와 복구 절차는 어떻게 연결되는가? | 예제·운영·테스트, 3.6~3.10 |

## 3. 본문 정리

### 3.1 Job은 전체 업무, Step은 하나의 처리 단계다

**Job은 배치 작업의 정의이고, Step은 그 작업 안의 독립적인 처리 단계다.** 예를 들어 도서 목록 반영 업무를 입력 확인, 데이터 적재, 결과 검증으로 나눌 수 있다. 단계가 나뉘면 실패한 위치를 전체 업무 이름보다 구체적으로 알 수 있다. [공식 Step 개념](https://docs.spring.io/spring-batch/reference/step.html)

작업 정의는 실행 이력과 다르다. Java의 `Job` Bean은 어떤 단계를 어떤 순서로 실행할지 설명하는 설계도이며, 실제 실행할 때마다 별도의 이력이 생긴다. 한 Job 안의 Step도 이름을 갖는다. 재시작 이력이 단계 이름을 참조하므로, 실패한 작업이 남아 있는 상태에서 이름이나 처리 의미를 바꾸는 일은 신중해야 한다.

Step 구현의 대표적인 선택은 **Tasklet**과 **chunk 처리**다. Tasklet은 개발자가 정의한 작은 작업 단위를 수행하는 방식으로, 파일 존재 검사나 정리 작업처럼 행 단위 읽기·변환·쓰기 모델이 꼭 필요하지 않을 때 고려한다. chunk는 입력을 하나씩 읽되 여러 결과를 묶어 저장하는 방식이다. 이번 예제는 반복적인 CSV 적재이므로 chunk를 선택한다.

여러 Step으로 나눴다고 해서 Job 전체가 하나의 트랜잭션이 되는 것은 아니다. 앞 단계에서 확정한 결과는 뒤 단계 실패만으로 자동 취소되지 않는다. 따라서 단계 분리는 실패 위치를 드러내는 도구이지, 모든 업무 효과를 자동으로 한 번에 되돌리는 도구는 아니다.

### 3.2 JobInstance와 JobExecution을 구분해야 재시작이 보인다

**JobInstance는 논리적으로 같은 업무 한 건이고, JobExecution은 그 업무를 실행한 한 번의 시도다.** 날짜별 가져오기라면 10월 4일 업무가 Instance이며, 오전 실패와 오후 재시작은 서로 다른 Execution이다. Instance 식별에는 Job 이름과 식별용 JobParameters가 사용된다. [공식 도메인 모델](https://docs.spring.io/spring-batch/reference/domain.html)

**JobParameters는 실행에 전달하는 이름·값·타입의 모음이다.** 이 중 `identifying=true`인 값이 Instance 구분에 참여한다. `false`인 값은 실행에 필요하더라도 업무의 정체성에는 참여하지 않는다. 기본값은 true이며, 예제에서는 의도를 보이기 위해 직접 적는다. [JobParametersBuilder API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/job/parameters/JobParametersBuilder.html)

| 입력 | 의미 | Instance 관계 |
| --- | --- | --- |
| `businessDate=2026-10-04`, `sourceRevision=catalog-v1` | 해당 날짜의 확정된 원본을 반영 | 첫 시도 |
| 같은 날짜·같은 revision으로 실패 후 실행 | 같은 원본의 남은 처리 | 같은 Instance, 새 Execution |
| `businessDate=2026-10-05`, 같은 revision | 다음 날짜의 반영 | 다른 Instance |
| 같은 날짜, `sourceRevision=catalog-v2` | 변경된 원본을 별도 반영 | 다른 Instance |

이 표에서 revision은 **원본 내용과 연결된 불변 식별자**라는 예제의 설계 판단이다. 실제로는 파일의 내용 해시나 수정 불가능한 저장소 객체 버전을 사용할 수 있다. 이름만 v1이라고 붙였는데 내용은 계속 바뀌면 같은 원본이라는 전제가 무너진다.

경로 `inputPath`는 비식별 값으로 취급한다. 서버를 옮겨 경로가 달라져도 내용이 같으면 같은 업무로 볼 수 있기 때문이다. 다만 경로만 바꾸고 다른 내용의 파일을 전달하지 않도록, 실행 전에 원본 버전과 내용의 일치를 검증해야 한다.

⚠️ 주의: 실행 때마다 현재 시각을 식별 파라미터에 넣으면 실패한 업무가 아니라 새로운 Instance가 만들어진다. 실행 오류를 피하려고 timestamp를 추가하는 방식은 기존 체크포인트를 이어 쓰는 해결책이 아니다. 새로운 실행이 필요한 업무와 실패한 업무의 재시작을 먼저 구분한다.

### 3.3 chunk는 함께 확정하는 묶음이다

**chunk는 여러 항목을 한 번의 쓰기·트랜잭션 경계로 묶는 처리 단위다.** Reader는 항목을 하나씩 반환하고, Processor는 항목을 변환하며, Writer는 모인 결과 묶음을 받는다. chunk 크기는 전체 행 수가 아니라 한 묶음의 입력 항목 수를 정한다. [chunk 처리 모델](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing.html)

각 역할을 도서 가져오기에 대응해 보면 Reader는 CSV 한 행을 객체로 읽고, Processor는 제목의 앞뒤 공백을 제거하고 값의 유효성을 검사한다. Writer는 변환된 도서 객체들을 DB에 저장한다. Processor는 생략할 수도 있지만 변환 규칙이 있다면 읽기·저장 코드와 분리하는 편이 흐름을 이해하기 좋다.

Reader의 `null`은 입력 끝을 뜻한다. Processor의 `null`은 해당 항목을 출력에서 제외한다는 뜻이다. 잘못된 데이터를 발견했다고 무조건 null을 반환하면 오류가 아니라 필터링으로 처리되므로, 문제를 알려야 하는 경우에는 예외를 발생시켜야 한다. [Reader·Writer·Processor 역할](https://docs.spring.io/spring-batch/reference/readersAndWriters.html)

도서 7건, chunk 크기 3, 두 번째 묶음의 Writer가 실패한다고 가정하자. 업무 데이터와 체크포인트가 같은 DB 트랜잭션에 참여하고, 첫 묶음은 이미 확정했다는 조건이다.

```text
첫 실행
  B001·B002·B003 읽기/변환/쓰기 → commit → 체크포인트: 3건
  B004·B005·B006 읽기/변환/쓰기 → 예외  → 이 묶음 rollback
  B007은 아직 확정되지 않음 → 실행 FAILED

같은 Instance 재시작
  마지막 확정 위치 복원 → B004부터 읽기
  B004·B005·B006 쓰기 → commit
  B007 쓰기          → 마지막 작은 묶음 commit → COMPLETED
```

중요한 위치는 “마지막으로 읽은 항목”이 아니라 “안전하게 확정한 진행 지점”이다. 예외 전 B006까지 읽었더라도 B004~B006의 저장이 취소됐다면 B007부터 시작해서는 안 된다. 또한 재시작 시 이미 확정한 B001~B003을 다시 INSERT하면 유일 제약 오류가 나거나 데이터가 중복될 수 있다.

chunk 크기 3은 동작을 관찰하기 위한 학습 값이다. 크기를 키우면 commit 횟수를 줄일 수 있지만 묶음에 보관하는 객체·잠금 유지 시간·실패 때 다시 처리할 범위가 커질 수 있다. 실제 선택은 행 크기, SQL 비용, DB 부하와 실패 복구 시간을 측정해서 조정한다. chunk 크기가 DB 조회 페이지 크기나 JDBC 드라이버의 전송 묶음 크기와 항상 같은 것도 아니다.

### 3.4 ExecutionContext와 ItemStream이 진행 위치를 연결한다

**체크포인트는 재시작에 사용할 확정된 진행 정보다. ExecutionContext는 그 정보를 저장하는 키·값 공간이다.** 파일 Reader는 처리 위치를, 다른 사용자 정의 Reader는 마지막으로 확정한 키를 저장할 수 있다. Java 객체의 필드에만 위치를 보관하면 프로세스 종료와 함께 잃으므로 외부의 지속 가능한 저장소가 필요하다.

**ItemStream은 열기·상태 갱신·닫기의 생명주기를 제공하는 인터페이스다.** `open(context)`에서 이전 상태와 자원을 준비하고, `update(context)`에서 commit 전에 현재 상태를 반영하며, `close()`에서 자원을 정리한다. `update`를 호출했다는 사실 자체가 성공 확정을 뜻하지는 않는다. 저장 트랜잭션이 commit되어야 해당 진행 정보가 다음 실행에 유효하다. [ItemStream 계약](https://docs.spring.io/spring-batch/reference/readers-and-writers/item-stream.html)

Step의 ExecutionContext와 Job의 ExecutionContext는 서로 다른 범위다. Step은 자기 진행 상태를, Job은 단계 사이에서 공유할 정보를 담는다. 이번 예제의 읽기 위치는 Step 범위의 정보로 이해하면 된다. 파일 전체나 수십만 개의 객체를 context에 담는 대신 재개에 필요한 작고 안정적인 값만 남긴다.

`FlatFileItemReader`는 이 생명주기를 이미 구현하므로 이번 예제에서 위치 저장 코드를 직접 만들지 않는다. `name`은 상태 키를 구분하는 데 사용하고 `saveState(true)`는 재시작 상태 저장을 켠다. 재시작을 위해 안정적인 Reader 이름과 같은 입력이 필요하다. [FlatFileItemReaderBuilder API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/file/builder/FlatFileItemReaderBuilder.html)

⚠️ 주의: 확정 위치가 3인데 파일 앞에 행을 삽입하거나 정렬을 바꾸면 “3건 이후”의 의미가 달라진다. 실패한 입력은 수정하지 않고 보관한다. 수정된 데이터는 새 버전으로 처리하고 기존 업무 결과와의 교체·보충 정책을 별도로 정한다. DB Reader를 사용하는 경우에도 안정적인 정렬과 처리 대상 범위가 필요하다.

Reader·Writer를 다른 객체로 감싸는 경우에도 주의한다. 직접 등록된 객체가 ItemStream이면 builder가 생명주기를 연결하지만, 내부 delegate에만 ItemStream이 숨어 있으면 자동 인식되지 않을 수 있다. 이런 구조는 delegate를 `.stream(...)`으로 등록하는지 확인해야 한다. 아래 예제는 Reader를 직접 연결한다. [Step builder의 stream 등록 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/ChunkOrientedStepBuilder.html)

### 3.5 JobRepository와 Boot 자동 설정을 준비한다

**JobRepository는 작업 식별·시도·단계·진행 상태 등의 메타데이터를 다루는 저장소다.** 메타데이터는 도서 제목 같은 업무 데이터가 아니라 “어떤 작업이 어디까지 진행했는가”를 설명하는 관리 정보다. 재시작에는 업무 테이블만이 아니라 이 정보도 보존되어야 한다. [JobRepository 설정](https://docs.spring.io/spring-batch/reference/job/configuring-repository.html)

Spring Batch 6의 기본 resourceless 구성은 재시작 메타데이터를 지속적으로 보존하는 용도가 아니다. JDBC 저장소를 쓰더라도 H2 메모리 DB처럼 프로세스 종료 시 사라지는 DB는 프로세스 재시작 실습에 적합하지 않다. 여기서는 PostgreSQL의 업무 테이블과 Batch 메타데이터를 같은 DataSource·JDBC 트랜잭션으로 관리한다.

#### 3.5.1 기준 버전과 의존성

Spring Boot 4.1.1은 공식 의존성 표에서 Spring Batch 6.0.5를 관리한다. 기존 Boot 4.1.1 프로젝트에서 버전을 따로 덮어쓰지 않고 JDBC Batch starter를 추가한다. Boot 3·Batch 5 프로젝트에 아래 import를 그대로 붙이는 예제가 아니다. [Boot 관리 의존성 표](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)

다음은 기존 `build.gradle`의 `dependencies` 안에 추가하는 **일부 코드**다. 기본 Boot 플러그인·의존성 관리·JDK 설정은 [첫 프로젝트 노트](../01_08_25_Spring_Initializr_and_First_Run/08_25_Spring_Initializr_and_First_Run.md)를 참고한다.

```groovy
dependencies {
    // JDBC에 작업 이력과 체크포인트를 보존하는 Batch 자동 설정을 사용한다.
    implementation 'org.springframework.boot:spring-boot-starter-batch-jdbc'
    // 실행 시 PostgreSQL에 연결할 드라이버이며 버전은 Boot가 관리한다.
    runtimeOnly 'org.postgresql:postgresql'
}
```

Spring Batch 6에서는 `Job`·`Step`·`JobParameters`의 패키지가 분리되었고 item 관련 타입은 `org.springframework.batch.infrastructure` 아래로 이동했다. chunk 예제는 `ChunkOrientedStepBuilder`를 사용한다. 이전 버전의 import나 오래된 builder 예제를 함께 섞으면 컴파일 오류의 원인이 된다. [Batch 6 마이그레이션 안내](https://github.com/spring-projects/spring-batch/wiki/Spring-Batch-6.0-Migration-Guide)

#### 3.5.2 자동 실행과 스키마 초기화를 구분한다

아래는 `src/main/resources/application.properties`에 추가하는 학습용 설정이다. DB 환경 변수는 실제 별도 학습 DB를 가리켜야 하며 기본값으로 운영 DB를 연결하지 않는다.

```properties
# DB 위치와 인증값은 소스에 실제 값을 쓰지 않고 실행 환경에서 제공한다.
spring.datasource.url=${BATCH_DB_URL}
spring.datasource.username=${BATCH_DB_USER}
spring.datasource.password=${BATCH_DB_PASSWORD}

# 애플리케이션 시작 때 자동으로 Job을 실행하지 않고 명시적으로 시작한다.
spring.batch.job.enabled=false
# 새 학습 DB의 Batch 메타데이터 테이블을 초기화할 때 사용하는 설정이다.
spring.batch.jdbc.initialize-schema=always
```

`job.enabled=false`는 시작 시 실행을 막는 설정이지 Batch Bean 전체를 제거하는 설정이 아니다. Boot는 한 Job Bean이 있으면 기본적으로 시작 시 실행할 수 있으므로, 업무 파라미터를 확인해 직접 시작할 실습에서는 자동 실행을 끈다. 이번 예제는 Boot 자동 설정을 사용하며 `@EnableBatchProcessing`을 추가하지 않는다. 이를 추가하면 Boot의 Batch 자동 설정과 스키마 초기화가 물러난다. [Boot Batch 자동 설정](https://docs.spring.io/spring-boot/reference/io/spring-batch.html)

`initialize-schema=always`는 새 학습 환경의 준비를 보여 주기 위한 값이다. 운영에서는 DB 권한·배포 순서에 맞춰 검증된 마이그레이션으로 Batch 스키마를 관리하고 `never`로 자동 초기화를 끄는 구성을 고려한다. 업무 테이블은 이 Batch 설정이 만들어 주지 않는다. [DB 초기화 안내](https://docs.spring.io/spring-boot/how-to/data-initialization.html)

⚠️ 주의: 실패 이력을 없애려고 Batch 테이블을 삭제하면 기존 Instance·Execution·체크포인트의 연결도 사라진다. 이미 업무 DB에 저장한 결과는 남을 수 있으므로 삭제 후 전체 재실행은 중복 처리 위험이 있다. 버전 변경 시에는 현재 Batch 버전에 맞는 스키마 마이그레이션과 남아 있는 실패 작업의 호환성도 확인한다.

### 3.6 예제 입력과 결과 테이블을 먼저 정한다

이 예제는 특정 날짜·원본 버전의 도서 목록을 보존하는 **가져오기 이력 테이블**을 만든다. 실제 서비스의 현재 도서 목록을 교체하는 정책까지 구현하는 예제는 아니다. 한 입력 안에서는 bookId가 유일하다고 가정하며, 중복 ID는 오류로 처리한다.

프로젝트 루트의 `data/catalog-v1.csv`에 넣을 입력이다. CSV는 쉼표로 필드를 나누는 텍스트 형식이며, 첫 행은 컬럼 이름이다. CSV 블록에는 주석을 넣지 않고 필드 의미를 바로 아래에서 설명한다.

```csv
bookId,title,stock
B001,Java 입문,12
B002,웹의 동작 원리,7
B003,SQL 첫걸음,5
B004,트랜잭션 이해,9
B005,자료구조 연습,4
B006,테스트 설계,8
B007,네트워크 기초,6
```

`bookId`는 원본 안의 도서 식별자이고, `title`은 도서 제목이며, `stock`은 0 이상의 수량이다. Reader는 첫 행을 건너뛰고 각 데이터 행을 `Book` 객체로 바꾼다. 전체 7건이므로 크기 3의 묶음은 3건·3건·1건으로 나뉜다.

다음 SQL은 **별도 PostgreSQL 학습 DB에서 한 번 준비하는 예제**다. 운영에서는 기존 Flyway 학습처럼 버전 있는 마이그레이션에 넣는다.

```sql
-- 날짜·원본 버전별로 반영 결과를 남기는 업무 테이블이다.
CREATE TABLE catalog_import (
    business_date date NOT NULL,              -- 처리 대상 날짜이며 실행 시각과 다르다.
    source_revision varchar(100) NOT NULL,     -- 수정 불가능한 원본의 버전 식별자다.
    book_id varchar(30) NOT NULL,              -- 한 원본 안의 항목을 구분한다.
    title varchar(200) NOT NULL,               -- 변환 후 제목을 저장한다.
    stock integer NOT NULL CHECK (stock >= 0), -- DB에서도 음수 수량을 거부한다.
    PRIMARY KEY (business_date, source_revision, book_id) -- 같은 결과의 중복 삽입을 막는다.
);
```

기본키는 같은 결과를 두 번 저장하지 못하게 한다. 그러나 제약이 있다고 해서 중복 INSERT가 정상 성공으로 바뀌지는 않는다. 이번 Writer는 중복이면 실패한다. 재시작 시 이미 확정한 항목을 다시 쓰지 않는지 관찰하기 위한 선택이다. 재수집·수정 반영을 허용하려면 그 업무에 맞는 upsert·버전 교체 정책이 필요하다.

### 3.7 Reader·Processor·Writer를 Step과 Job으로 연결한다

다음은 기존 프로젝트의 `src/main/java/com/example/batch/CatalogBatchConfiguration.java`에 추가할 파일이다. 애플리케이션의 컴포넌트 스캔이 `com.example`을 포함하고, DataSource가 하나이며 JPA·별도 Batch DataSource를 섞지 않는다는 조건이다.

입력은 실행 파라미터의 파일 경로이고 결과는 위 업무 테이블의 행들이다. `@StepScope`는 Reader·Writer의 실제 객체를 Step 실행에 맞춰 준비해, 시작 시 전달한 파라미터를 사용할 수 있게 한다. 이를 **late binding**, 즉 실행 시점의 값 연결이라고 부른다. Step 자체가 아니라 값을 사용하는 구성 요소에 scope를 둔다. [Step scope와 late binding](https://docs.spring.io/spring-batch/reference/step/late-binding.html)

```java
package com.example.batch;

import java.sql.Date; // LocalDate를 JDBC의 SQL 날짜 값으로 변환한다.
import java.time.LocalDate; // 업무 날짜를 시각 정보 없이 표현한다.
import javax.sql.DataSource; // Writer와 트랜잭션이 같은 DB 자원을 사용한다.
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.job.parameters.DefaultJobParametersValidator;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.step.builder.ChunkOrientedStepBuilder;
import org.springframework.batch.infrastructure.item.ItemProcessor;
import org.springframework.batch.infrastructure.item.database.JdbcBatchItemWriter;
import org.springframework.batch.infrastructure.item.database.builder.JdbcBatchItemWriterBuilder;
import org.springframework.batch.infrastructure.item.file.FlatFileItemReader;
import org.springframework.batch.infrastructure.item.file.builder.FlatFileItemReaderBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.support.JdbcTransactionManager;

@Configuration(proxyBeanMethods = false) // Bean 메서드 직접 호출 대신 매개변수 주입을 사용한다.
public class CatalogBatchConfiguration {

    // Reader에서 Writer까지 전달할 불변 데이터이며 DB Entity는 아니다.
    public record Book(String bookId, String title, int stock) {}

    @Bean
    public JdbcTransactionManager transactionManager(DataSource dataSource) {
        // 이 구성에는 DataSource와 트랜잭션 매니저가 각각 하나만 있다.
        // Boot의 JDBC JobRepository와 아래 Step이 같은 매니저를 사용한다.
        return new JdbcTransactionManager(dataSource);
    }

    @Bean
    @StepScope // 애플리케이션 시작 시가 아니라 Step 실행의 파라미터를 읽는다.
    public FlatFileItemReader<Book> catalogReader(
            @Value("#{jobParameters['inputPath']}") String inputPath) {
        return new FlatFileItemReaderBuilder<Book>()
                .name("catalogReader") // 저장된 상태 키가 재시작 때도 동일해야 한다.
                .resource(new FileSystemResource(inputPath)) // 검증된 로컬 파일을 읽는다.
                .encoding("UTF-8") // 한글 제목을 입력 파일과 같은 인코딩으로 해석한다.
                .linesToSkip(1) // 컬럼 이름인 첫 줄을 데이터로 만들지 않는다.
                .strict(true) // 입력 파일이 없으면 조용히 0건 성공하지 않고 실패한다.
                .saveState(true) // 확정한 읽기 위치를 context에 남겨 재시작에 사용한다.
                .delimited() // 쉼표로 분리한 필드를 해석한다.
                .names("bookId", "title", "stock") // 필드 접근에 사용할 이름과 순서다.
                .fieldSetMapper(fields -> new Book(
                        fields.readString("bookId"), // 원본 식별자를 문자열로 읽는다.
                        fields.readString("title"), // 제목은 Processor에서 정리한다.
                        fields.readInt("stock"))) // 숫자가 아니면 파싱 오류로 실패한다.
                .build(); // ItemStream을 구현한 Reader가 Step 생명주기에 참여한다.
    }

    @Bean
    public ItemProcessor<Book, Book> catalogProcessor() {
        return book -> {
            String id = book.bookId().strip(); // 앞뒤 공백을 제거한 식별자를 사용한다.
            String title = book.title().strip(); // 화면·DB에 불필요한 공백을 남기지 않는다.
            if (id.isEmpty() || id.length() > 30
                    || title.isEmpty() || title.length() > 200 || book.stock() < 0) {
                // 잘못된 항목을 필터링한 척하지 않고 해당 묶음을 실패시킨다.
                throw new IllegalArgumentException("도서 필드 범위를 확인해야 합니다.");
            }
            // 원본 객체를 수정하지 않고 검증·정리가 끝난 새 값을 Writer에 전달한다.
            return new Book(id, title, book.stock());
        };
    }

    @Bean
    @StepScope // 날짜·버전 값은 이 Step이 속한 실행에서 가져온다.
    public JdbcBatchItemWriter<Book> catalogWriter(
            DataSource dataSource,
            @Value("#{jobParameters['businessDate']}") String businessDate,
            @Value("#{jobParameters['sourceRevision']}") String sourceRevision) {
        LocalDate date = LocalDate.parse(businessDate); // SQL에 넣기 전에 날짜로 해석한다.
        return new JdbcBatchItemWriterBuilder<Book>()
                .dataSource(dataSource) // Reader 위치를 저장하는 저장소와 같은 DB를 쓴다.
                .sql("""
                     INSERT INTO catalog_import
                         (business_date, source_revision, book_id, title, stock)
                     VALUES (?, ?, ?, ?, ?)
                     """) // 문자열 연결 대신 값 바인딩으로 SQL과 입력을 분리한다.
                .itemPreparedStatementSetter((book, statement) -> {
                    statement.setDate(1, Date.valueOf(date)); // 첫 물음표: 업무 날짜다.
                    statement.setString(2, sourceRevision); // 두 번째: 확정된 원본 버전이다.
                    statement.setString(3, book.bookId()); // 세 번째: 변환된 항목 ID다.
                    statement.setString(4, book.title()); // 네 번째: 정리한 제목이다.
                    statement.setInt(5, book.stock()); // 다섯 번째: 검증된 수량이다.
                })
                .build(); // 묶음의 SQL을 실행하지만 최종 commit은 Step이 관리한다.
    }

    @Bean
    public Step catalogImportStep(
            JobRepository jobRepository,
            JdbcTransactionManager transactionManager,
            FlatFileItemReader<Book> catalogReader,
            ItemProcessor<Book, Book> catalogProcessor,
            JdbcBatchItemWriter<Book> catalogWriter) {
        return new ChunkOrientedStepBuilder<Book, Book>(
                "catalogImportStep", jobRepository, 3) // 3은 관찰하기 위한 학습용 크기다.
                .transactionManager(transactionManager) // 실제 DB commit·rollback을 사용한다.
                .reader(catalogReader) // 한 항목씩 읽고 Reader 상태도 저장한다.
                .processor(catalogProcessor) // 검증과 정리를 저장 앞에 배치한다.
                .writer(catalogWriter) // 모인 결과를 같은 트랜잭션에서 저장한다.
                .build(); // retry·skip·병렬 실행은 이번 구성에 넣지 않는다.
    }

    @Bean
    public Job catalogImportJob(JobRepository jobRepository, Step catalogImportStep) {
        String[] required = {"businessDate", "sourceRevision", "inputPath"};
        return new JobBuilder("catalogImportJob", jobRepository) // 안정적인 작업 이름이다.
                .validator(new DefaultJobParametersValidator(required, new String[0]))
                // 위 validator는 키의 존재를 확인한다. 값의 의미 검증은 3.8에서 다룬다.
                .start(catalogImportStep) // 이번 Job은 하나의 적재 Step으로 구성한다.
                .build(); // preventRestart나 파라미터 incrementer를 추가하지 않는다.
    }
}
```

스캔된 설정은 Bean들을 연결할 뿐, 이 설정 파일 자체가 Job을 시작하지는 않는다. 실제 시작 시 Reader·Writer의 scoped 객체가 준비되고, 읽기 → 검증 → 묶음 쓰기 → 상태 갱신 → commit이 반복된다. 마지막 1건도 하나의 작은 묶음으로 저장한다.

Writer의 `build()`는 객체를 만드는 작업이고, Writer가 SQL을 실행하는 순간과 commit 순간도 다르다. 예외가 발생하면 해당 Step 트랜잭션이 취소해야 하므로 수동 commit이나 항목별 `REQUIRES_NEW` 처리를 추가하지 않는다. 위의 단일 매니저가 Boot JDBC 구성에도 연결되는 것은 자동 설정 소스에서 확인할 수 있다. [Boot JDBC Batch 구성 소스](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-batch-jdbc/src/main/java/org/springframework/boot/batch/jdbc/autoconfigure/BatchJdbcAutoConfiguration.java), [JDBC Writer API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/builder/JdbcBatchItemWriterBuilder.html)

⚠️ 주의: 업무 DB와 메타데이터 DB를 서로 다른 로컬 트랜잭션으로 나누면 위의 함께 확정되는 전제를 그대로 적용할 수 없다. 데이터는 확정했는데 체크포인트는 실패하는 구간이 생길 수 있다. 여러 저장소 구성은 멱등성·재조정 방법까지 검토하고, 단일 DB 실습 결과를 그대로 일반화하지 않는다.

### 3.8 JobOperator로 시작과 재시작을 구분한다

**JobOperator는 배치 작업을 시작·중지·재시작하는 운영 인터페이스다.** Batch 6 예제에서는 `start(Job, JobParameters)`와 `restart(JobExecution)`을 사용한다. 같은 식별 값으로 성공한 Instance는 보통 다시 실행할 수 없으며, 실행 중인 동일 Instance를 중복 시작하는 것도 거부한다. [JobOperator API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html)

아래는 `src/main/java/com/example/batch/CatalogImportService.java`에 추가할 파일이다. 파일 경로와 revision은 아무 HTTP 요청에서나 신뢰해서 받는 값이 아니라, 접근이 제한된 운영 경로에서 확인된 값이라고 가정한다. 서비스에는 전체 Job을 감싸는 `@Transactional`을 붙이지 않고 chunk의 트랜잭션을 유지한다.

```java
package com.example.batch;

import java.nio.file.Files; // 읽기 가능한 입력인지 확인한다.
import java.nio.file.Path; // 문자열 경로를 파일 경로 값으로 다룬다.
import java.time.LocalDate; // 호출자가 유효한 날짜 값을 전달하게 한다.
import java.util.Objects; // null 입력을 시작 전에 거부한다.
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.JobExecutionException;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service // 운영 호출부나 테스트가 주입받아 사용하는 Bean이다.
public class CatalogImportService {
    private final JobOperator operator; // 실행과 재시작의 관리 기능을 제공한다.
    private final Job job; // 실행할 설계도이며 실행 이력 자체는 아니다.

    public CatalogImportService(
            JobOperator operator, @Qualifier("catalogImportJob") Job job) {
        this.operator = operator; // 자동 설정된 운영 객체를 보관한다.
        this.job = job; // Job이 추가돼도 도서 가져오기 작업을 명시적으로 선택한다.
    }

    public JobExecution start(LocalDate businessDate, String sourceRevision, Path input)
            throws JobExecutionException {
        Objects.requireNonNull(businessDate, "업무 날짜가 필요합니다.");
        Objects.requireNonNull(input, "입력 경로가 필요합니다.");
        if (sourceRevision == null || sourceRevision.isBlank() || sourceRevision.length() > 100) {
            throw new IllegalArgumentException("유효한 원본 버전이 필요합니다.");
        }
        Path path = input.toAbsolutePath().normalize(); // 실행 기준 디렉터리 차이를 줄인다.
        if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new IllegalArgumentException("읽기 가능한 입력 파일이 필요합니다.");
        }
        // 전제: 운영 호출부가 승인된 경로와 불변 원본 버전의 내용 일치를 검증했다.
        // 위 존재 검사는 내용 해시 검증이나 임의 경로 접근 방어를 대신하지 않는다.
        JobParameters parameters = new JobParametersBuilder()
                .addString("businessDate", businessDate.toString(), true) // 업무 날짜로 식별한다.
                .addString("sourceRevision", sourceRevision, true) // 원본 버전으로 식별한다.
                .addString("inputPath", path.toString(), false) // 위치는 업무 정체성과 분리한다.
                .toJobParameters(); // 만들어진 값들을 한 실행의 입력으로 묶는다.
        return operator.start(job, parameters); // 이력 객체를 반환하며 성공을 보장하지 않는다.
    }

    public JobExecution restart(JobExecution previous) throws JobExecutionException {
        Objects.requireNonNull(previous, "재시작할 실행 이력이 필요합니다.");
        // 실제 운영에서는 저장소에서 조회한 이력과 권한·작업 이름을 확인한 뒤 호출한다.
        // 실패/중지 상태와 restart 가능 여부는 operator가 검사한다.
        return operator.restart(previous); // 같은 업무에 새 시도가 생성된다.
    }
}
```

위 두 파일은 Job을 정의하고 호출할 방법을 제공한다. 자동 실행을 껐으므로 단순 Boot 기동만으로 적재가 시작되지는 않는다. 테스트나 보호된 운영 호출부에서 `start(LocalDate.of(2026, 10, 4), "catalog-v1", Path.of("data/catalog-v1.csv"))`를 호출해야 한다. 운영용 Controller·인증·스케줄러 연결은 이 예제에서 구현하지 않았다.

반환된 JobExecution이 있다는 이유만으로 완료 성공으로 기록하지 않는다. 실행기를 비동기로 구성했으면 반환 시점에도 작업이 진행 중일 수 있다. 동기 구성을 쓰더라도 작업 내부 실패가 이력의 FAILED로 기록되는지 확인해야 하므로, 최종 상태·Step 실패 예외·업무 결과를 함께 확인한다.

같은 업무가 실패했다면 기존 실행 이력에 대한 restart나 같은 식별 파라미터의 재실행을 사용한다. Job을 재시작 불가로 설정했거나 입력·Reader가 복원을 지원하지 않으면 “같은 값”만으로 안전한 재시작이 만들어지지는 않는다. [Job 재시작 가능성](https://docs.spring.io/spring-batch/reference/job/configuring-job.html)

### 3.9 재시작 가능한 상태와 업무 결과의 안전성은 별개다

**FAILED**는 실패로 종료된 시도이고, **STOPPED**는 중지된 시도다. 정상 완료인 **COMPLETED**와 구분해야 한다. 여러 Step의 Job은 기본적으로 완료한 Step을 재시작에서 건너뛰지만, 다시 실행하도록 구성한 단계는 다르게 동작할 수 있다. 따라서 기존 단계의 결과 보존과 반복 가능성을 함께 확인한다. [Step 재시작 설정](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/restart.html)

프로세스가 갑자기 종료되면 저장소에 STARTED가 남을 수도 있다. Batch 6의 `recover(JobExecution)`는 비정상 종료 때문에 남은 실행을 재시작 가능한 FAILED로 복구하는 기능이다. 데이터를 처음부터 다시 계산하거나 외부 결과를 취소하는 기능은 아니다. 해당 프로세스가 실제로 종료되었는지 확인한 뒤 사용해야 하며, 실행이 느리다는 이유만으로 살아 있는 작업을 recover하면 중복 처리를 유발할 수 있다. [recover API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html#recover(org.springframework.batch.core.job.JobExecution))

체크포인트는 외부 효과의 “정확히 한 번”을 자동 보장하지 않는다. 예를 들어 Writer가 알림 HTTP 요청을 보낸 뒤 DB commit 전에 실패하면, 재시작이 같은 알림을 다시 보낼 수 있다. DB rollback으로 이미 전달된 HTTP 요청을 취소할 수는 없기 때문이다. 이런 효과는 기존 [Outbox](../25_09_23_Transactional_Outbox_and_Event_Publishing/09_23_Transactional_Outbox_and_Event_Publishing.md)와 멱등성 학습에 연결한다.

다른 Instance끼리 같은 업무 데이터에 접근하는 것도 별도 문제다. 날짜·원본 버전이 다른 두 실행의 동시 시작을 Batch가 같은 Instance 중복으로 막아 주지는 않는다. 출력 유일 제약, 업무별 중복 보호, 원본 버전 간 충돌 정책은 여전히 필요하다.

⚠️ 주의: Job이 COMPLETED라는 것은 구성된 처리 흐름의 완료 상태다. 입력 7건 중 예상대로 몇 건을 저장했는지, 필터·skip으로 빠진 항목이 허용된 것인지까지 자동으로 판단한 업무 검증 결과는 아니다. 읽기·쓰기·필터·skip 수와 기대 결과를 별도로 대조한다.

### 3.10 실패를 일부러 만들어 재시작을 검증한다

정상 실행의 예상 결과는 `catalog_import`에 해당 날짜·버전의 7행이 들어가는 것이다. 재시작을 검증할 때는 첫 묶음 성공 후 두 번째 묶음 실패를 만들고, 같은 Instance로 다시 실행해서 확정 결과와 새 Execution을 비교한다. 단순히 애플리케이션을 두 번 켠 것으로 재시작 동작을 검증했다고 보지는 않는다.

아래는 **테스트 소스에만 사용하는 일부 코드**다. `src/test/java/com/example/batch/FailureFixture.java`에 두고 테스트 구성에서 Writer를 감싸 Step에 연결할 수 있다. 실제 테스트 구성은 위 Step 메서드의 Writer 매개변수를 `ItemWriter<Book>`으로 바꾸고 이 wrapper Bean을 명시적으로 주입해야 한다. 운영 구성에는 자동 적용되지 않는다.

```java
package com.example.batch;

import java.util.concurrent.atomic.AtomicBoolean; // 같은 테스트에서 한 번만 실패시킨다.
import com.example.batch.CatalogBatchConfiguration.Book; // 예제의 데이터 타입을 재사용한다.
import org.springframework.batch.infrastructure.item.ItemWriter;
import org.springframework.batch.infrastructure.item.database.JdbcBatchItemWriter;

public final class FailureFixture {
    private FailureFixture() {} // 상태를 공유하는 인스턴스 대신 팩터리 메서드를 사용한다.

    public static ItemWriter<Book> failOnce(JdbcBatchItemWriter<Book> delegate) {
        AtomicBoolean shouldFail = new AtomicBoolean(true); // 최초 장애 발생 여부를 보관한다.
        return chunk -> {
            delegate.write(chunk); // 먼저 같은 트랜잭션에서 SQL을 실행해 rollback을 관찰한다.
            boolean hasTarget = chunk.getItems().stream()
                    .anyMatch(book -> book.bookId().equals("B004")); // 두 번째 묶음을 선택한다.
            if (hasTarget && shouldFail.compareAndSet(true, false)) {
                // SQL 실행 이후의 실패도 이 묶음의 저장을 취소하는지 확인한다.
                throw new IllegalStateException("재시작 검증용 일시 장애");
            }
        }; // 두 번째 실행에서는 같은 wrapper의 flag가 false여서 정상 진행한다.
    }
}
```

이 flag는 테스트에서 장애를 한 번 주기 위한 메모리 상태이지 체크포인트 구현이 아니다. 같은 ApplicationContext에서 wrapper 하나를 유지하며 재시작하는 실험에만 사용한다. JVM을 새로 시작하면 flag가 다시 true가 되므로, 프로세스 재시작 실험에는 장애 주입을 해제한 별도 구성이 필요하다.

| 검사 순서 | 기대하는 관찰 | 확인하려는 의미 |
| --- | --- | --- |
| 첫 실행에 wrapper 적용 | Job·Step FAILED, 업무 테이블에 B001~B003만 존재 | 두 번째 묶음 SQL이 취소됨 |
| 같은 이력으로 restart | 같은 Instance ID, 다른 Execution ID | 새 업무가 아니라 재시작임 |
| 재시작 완료 후 DB 조회 | B001~B007이 각각 한 번 존재 | 확정한 앞 묶음을 중복 삽입하지 않음 |
| 완료한 동일 Instance 시작 | 완료된 Instance 재실행이 거부됨 | 업무 식별 계약이 유지됨 |
| 새 revision으로 시작 | 다른 Instance, 새 revision 아래에 결과 저장 | 의도적으로 새 원본을 처리함 |

결과 조회는 학습 DB에서 다음 SQL로 한다. 실행 이력은 운영 호출부가 받은 JobExecution과 JobRepository 조회 기능으로 별도로 비교한다. 조회는 Job이 종료된 후 수행하며 쓰기 트랜잭션 안에서 같은 연결로 본 결과만으로 판단하지 않는다.

```sql
-- 특정 업무의 확정 결과만 조회해 다른 날짜·버전의 데이터와 섞이지 않게 한다.
SELECT book_id, title, stock
FROM catalog_import
WHERE business_date = DATE '2026-10-04' -- 실행 시각이 아니라 업무 날짜를 사용한다.
  AND source_revision = 'catalog-v1'   -- 같은 원본 버전의 결과로 한정한다.
ORDER BY book_id;                       -- 비교할 때 결과 순서를 고정한다.
```

누락 파일·빈 입력·숫자 파싱 오류·음수 수량·중복 bookId도 확인할 경계다. 빈 입력은 기본 처리만으로는 0건 완료가 될 수 있으므로, 업무가 최소 1건을 요구한다면 별도의 결과 검증이 필요하다. 잘못된 항목은 현재 구성에서 실패를 일으키며 retry·skip으로 무시하지 않는다.

지속성 검사는 정상적으로 FAILED가 저장된 뒤 프로세스를 종료하고, 같은 DB·동일 원본을 유지해 다시 시작하는 절차로 나눈다. 강제 종료 후 STARTED가 남은 상황은 3.9의 복구 절차를 따로 검증한다. 또한 두 서버가 동일 DB에서 같은 Instance를 동시에 시작하는 시험은 서로 다른 Instance가 동일 업무 결과를 쓰는 시험과 구분한다.

테스트를 추가한 프로젝트 루트에서는 Gradle Wrapper의 `./gradlew.bat test` 또는 Maven Wrapper의 `./mvnw.cmd test`로 실행한다. 명령이 성공해도 정상 경로만 검사했다면 위의 rollback·재시작·지속성까지 검증한 것은 아니다. Batch 6 테스트 지원은 `@SpringBatchTest`와 `JobOperatorTestUtils`를 제공한다. [공식 Batch 테스트 안내](https://docs.spring.io/spring-batch/reference/testing.html)

## 4. 적용 관점에서 다시 보기

도서 가져오기를 실제로 적용할 때는 처리 속도부터 조정하기보다 업무의 정체성과 복구 전제를 먼저 고정한다. 어느 날짜의 어느 원본을 반영하는지 정한 뒤 입력을 불변으로 보관하고, Job·Step·Reader 이름을 안정적으로 유지한다. 이 선택이 있어야 저장된 읽기 위치의 의미가 다음 실행에도 유지된다.

다음으로 지속 가능한 JobRepository, 업무 테이블, 같은 트랜잭션 매니저의 연결을 확인한다. chunk 크기를 작게 시작해 commit·rollback을 관찰하고, 첫 묶음 성공 뒤 다음 묶음 실패를 만드는 실습으로 앞의 확정 결과와 뒤의 미확정 결과를 구분한다. 성능 조정은 이 동작을 확인한 뒤 수행한다.

장애가 났다면 날짜·revision·Instance·Execution·Step과 실패 원인을 함께 찾는다. 원본을 수정했는지, context와 업무 결과가 함께 보존됐는지 확인한 후 실패한 시도를 재시작할지 새 원본 업무를 만들지 결정한다. 외부 효과가 있다면 Batch 상태만으로 안전성을 결론내리지 않고 기존 멱등성·Outbox 기준도 함께 적용한다.

마지막으로 완료 상태와 업무 결과를 분리해서 검증한다. 이번 예제의 성공 기준은 단순 COMPLETED가 아니라 해당 날짜·버전의 도서 7건이 각각 한 번 저장되고, 재시작 뒤에도 같은 결과가 유지되는 것이다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

재시작의 중심은 반복 호출이 아니라 같은 업무 식별과 마지막 확정 위치의 복원이다. chunk 트랜잭션·지속 가능한 메타데이터·불변 입력·출력 중복 정책이 맞물려야 실패 후 진행을 설명할 수 있다.

### 5.2 이전·다음 학습과의 연결

[스케줄링 노트](../32_10_03_Scheduling_and_Duplicate_Execution/10_03_Scheduling_and_Duplicate_Execution.md)의 시작 시점·중복 실행 문제를 작업 내부의 부분 성공과 복구로 확장했다. 다음에는 [Spring Batch의 오류 처리·retry·skip과 결과 검증](../34_10_05_Batch_Retry_Skip_and_Result_Validation/10_05_Batch_Retry_Skip_and_Result_Validation.md)을 학습해, 일시 장애와 잘못된 항목을 구분하고 허용된 누락까지 관찰하는 방법을 연결한다.

### 5.3 더 파볼 만한 주제

파일 내용 해시 검증, 안정적인 DB 페이징 Reader, 여러 Step 사이의 상태 전달을 더 살펴볼 수 있다. 병렬 처리와 partitioning은 단일 실행의 재시작을 검증한 뒤, 처리 순서·공유 상태·잠금에 미치는 영향을 별도로 학습한다.

### 5.4 참고 자료

- [Spring Batch 도메인 모델](https://docs.spring.io/spring-batch/reference/domain.html): Instance·Execution·Parameters와 실행 상태의 관계.
- [chunk 처리](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing.html): 항목 읽기와 묶음 쓰기·트랜잭션 경계.
- [ItemStream](https://docs.spring.io/spring-batch/reference/readers-and-writers/item-stream.html): open·update·close와 상태 저장 계약.
- [Job 설정](https://docs.spring.io/spring-batch/reference/job/configuring-job.html), [Step 재시작 설정](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/restart.html), [JobRepository 설정](https://docs.spring.io/spring-batch/reference/job/configuring-repository.html): 재시작 가능성·완료 단계의 재실행 여부·저장소 선택.
- [Boot Batch 지원](https://docs.spring.io/spring-boot/reference/io/spring-batch.html), [관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html), [DB 초기화](https://docs.spring.io/spring-boot/how-to/data-initialization.html): 자동 설정·버전·메타데이터 준비.
- [Batch 6 변경점](https://docs.spring.io/spring-batch/reference/whatsnew.html), [마이그레이션 안내](https://github.com/spring-projects/spring-batch/wiki/Spring-Batch-6.0-Migration-Guide): 새로운 builder와 패키지·운영 API 차이.
- [FlatFileItemReaderBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/file/builder/FlatFileItemReaderBuilder.html), [JdbcBatchItemWriterBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/database/builder/JdbcBatchItemWriterBuilder.html), [ChunkOrientedStepBuilder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/step/builder/ChunkOrientedStepBuilder.html): 예제의 상태 저장·바인딩·트랜잭션 연결.
- [JobOperator](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/core/launch/JobOperator.html), [Batch 테스트](https://docs.spring.io/spring-batch/reference/testing.html): 시작·재시작·recover와 테스트 지원.

## 6. 요약 정리

1. 스케줄러는 시작 시점을, Spring Batch는 작업 단계와 실행·복구 상태를 관리한다.
2. Job·Step 정의와 Instance·Execution 이력은 서로 다른 역할이다.
3. 같은 Job 이름과 식별 파라미터가 같은 업무를 구분하며 timestamp 추가는 새 업무를 만들 수 있다.
4. chunk는 함께 확정할 범위이며 실패한 묶음은 다시 처리할 수 있어야 한다.
5. Reader의 null은 입력 끝, Processor의 null은 출력 필터링이다.
6. ExecutionContext·ItemStream은 확정된 진행 상태를 다음 실행으로 연결한다.
7. 프로세스 재시작에는 지속 가능한 저장소와 변경되지 않은 입력이 필요하다.
8. 업무 저장과 메타데이터의 트랜잭션 경계, 외부 효과의 중복 가능성을 별도로 확인한다.
9. FAILED·STOPPED·비정상 종료와 COMPLETED를 구분하고 이력·DB 결과를 함께 검증한다.

🧠 기억할 것: “같은 업무인가, 어디까지 확정했는가, 다시 처리해도 결과가 안전한가”를 함께 물어야 재시작을 설계할 수 있다.

## 7. 미니 퀴즈 또는 체크리스트

1. 7건·chunk 3에서 두 번째 묶음의 SQL 실행 후 예외가 났다. 같은 DB 트랜잭션을 전제로 어떤 행이 남고, 어디서 재시작해야 하는가?
2. 실패한 가져오기에 현재 시각 파라미터를 새로 추가해서 시작하면 왜 기존 체크포인트를 이어 쓰지 못할 수 있는가?
3. 입력이 잘못됐을 때 Processor에서 null을 반환하는 것과 예외를 던지는 것은 어떻게 다른가?
4. JDBC 저장소를 쓰는 H2 메모리 DB와 불변 파일만 있으면 프로세스 재시작 후에도 이력을 복원할 수 있는가?
5. Writer의 HTTP 알림 성공 뒤 DB가 rollback됐다. Batch 재시작만으로 알림 중복이 해결되는가?

<details>
<summary>정답과 해설</summary>

1. B001~B003만 확정 결과로 남는다. B004~B006은 SQL이 실행됐더라도 commit 전에 실패했으므로 취소되며, 마지막 확정 체크포인트 다음인 B004부터 진행한다. 이전 묶음의 commit은 뒤 묶음의 rollback으로 취소되지 않는다.
2. 시각 값이 identifying이면 Instance 정체성이 달라진다. 새 Instance는 기존 업무의 재시작과 다르므로, 실패 회피를 위해 임의의 시각을 붙이기보다 같은 업무 식별을 유지해야 한다.
3. null은 해당 결과를 쓰지 않는 필터링이며 오류를 알리는 동작이 아니다. 예외는 현재 구성에서 묶음·실행을 실패시키므로 잘못된 입력을 성공처럼 숨기지 않는다. 허용된 필터링이라면 그 수와 이유도 결과 검증에 포함한다.
4. 아니다. 프로세스 종료로 메모리 DB의 메타데이터가 사라지면 파일이 같아도 진행 이력을 복원할 수 없다. 체크포인트를 보존하는 지속 가능한 DB가 필요하다.
5. 아니다. DB rollback은 이미 전달한 HTTP 알림을 취소하지 못한다. 재실행이 다시 알림을 보낼 수 있으므로 별도의 멱등 처리·Outbox 같은 업무 설계가 필요하다.

</details>
