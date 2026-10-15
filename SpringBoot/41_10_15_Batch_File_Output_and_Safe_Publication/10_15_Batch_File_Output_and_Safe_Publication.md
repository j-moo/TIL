# Spring Batch 파일 출력·재시작과 안전한 결과 공개

- 🎯 글의 목표: 파일 Writer의 상태 저장·재시작을 이해하고, 작성·닫힘·검증·공개를 나눠 미완성 파일과 중복 결과의 노출을 막는다.
- 🧩 핵심 키워드: FlatFileItemWriter, LineAggregator, 임시 파일, byte offset, transactional, forceSync, 체크섬, ATOMIC_MOVE, 공개 이력
- ⭐ 중요도: 높음. DB에서 실패했다고 이미 기록한 파일이 모두 취소되는 것은 아니며, 작성 중인 파일을 외부가 읽으면 불완전한 결과가 전달될 수 있다.
- 📝 한눈에 보는 내용: DB·파일 경계 → 안정적인 출력 ID·경로 → CSV 형식·Writer → 재시작 → 닫힌 파일 검증 → 안전한 공개·장애 대조
- 🔗 관련 주제: [ExecutionContext·상태 관리](../40_10_12_Batch_ExecutionContext_and_Step_Data_Handoff/10_12_Batch_ExecutionContext_and_Step_Data_Handoff.md), [입력 스냅샷](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md), [다단계 Job·결과 검증](../39_10_11_Batch_Multi_Step_Flow_and_Result_Verification/10_11_Batch_Multi_Step_Flow_and_Result_Verification.md)
- 🧱 선수 지식: Java 파일·예외·record, JDBC Reader, chunk commit·rollback, Step의 ItemStream 생명주기, 같은 Instance의 재시작

> 기준일: 2026-10-15. 예제 기준은 Java 17 이상·Spring Batch 6.0.5·기존 PostgreSQL 17 JDBC 프로젝트다. Writer·검증 도구는 기존 프로젝트에 추가하는 파일이며 전체 공개 시스템 구현은 아니다. 공식 문서·API와 6.0.5 소스를 확인했다. 현재 PATH는 Java 8이고 javac·Maven·Gradle·Java 빌드 프로젝트가 없어 컴파일·JUnit·파일/DB 통합 시험은 실행하지 않았다. 아래 관찰 결과는 예상 결과다.

## 1. 들어가며

도서 재고 일곱 건을 CSV로 내보내는데 세 건을 쓴 뒤 작업이 실패했다고 생각해 보자. 다운로드 사용자가 그 파일을 읽었다면 세 건짜리 결과를 완성본으로 오해할 수 있다. 다시 실행하면서 파일 끝에 일곱 건을 무조건 추가하면 앞의 세 건은 중복된다.

또 다른 문제도 있다. 파일 이름을 바꾸어 공개한 직후 DB 이력 저장 전에 서버가 종료되면 파일은 존재하지만 실행 이력은 실패로 남을 수 있다. 성공 상태 하나만 확인하거나 파일 존재 여부 하나만 확인해서는 안전한 복구 판단을 하기 어렵다.

앞 노트는 진행 상태와 단계 간 작은 정보를 ExecutionContext에 저장하는 방법을 다뤘다. 이번에는 파일 Writer의 진행 상태와 실제 파일을 함께 유지하고, 닫힌 결과를 검증한 뒤 공개하는 경계를 연결한다. 실습은 고정된 스냅샷의 소규모 재고 CSV이며 대용량 검증·객체 스토리지 공개는 확장 범위로 둔다.

## 2. 핵심 개념 정리

| 구간 | 책임 | 성공으로 판단할 근거 |
| --- | --- | --- |
| 입력 고정 | 같은 대상·값·순서 유지 | 발행 snapshot·고유 정렬 키 |
| 파일 작성 | chunk 결과를 비공개 파일에 기록 | Writer 상태와 실제 파일 |
| 자원 닫힘 | 버퍼·파일 핸들 정리 | 쓰기 Step 종료·자원 정리 확인 |
| 파일 검증 | 기대한 ID·수량·순서·바이트와 대조 | 검증 결과·건수·크기·체크섬 |
| 결과 공개 | 검증된 산출물만 조회 허용 | 공개 이력과 실제 파일의 일치 |

```text
보존 입력 → write Step → 비공개 .csv.part
                         ↓ Writer 닫힘 확인
                    검증 Step → 정확한 내용·크기·SHA-256
                         ↓
                    공개 Step → 검증한 파일 이동·공개 이력 확정
                         ↓
                    다운로드는 READY 이력으로만 접근
```

확장자가 `.part`라는 사실 자체가 접근을 막지는 않는다. 비공개 저장 위치와 공개 여부를 판단하는 조회 경로가 함께 필요하다.

## 3. 본문 정리

### 3.1 파일은 DB 트랜잭션과 같은 자원이 아니다

**파일 출력은 데이터를 운영체제의 파일 시스템에 기록하는 작업**이다. JDBC 트랜잭션은 DB 변경을 관리한다. 파일을 DB와 같은 트랜잭션으로 다룬다고 명시적으로 설계하지 않았다면 DB rollback만으로 파일 이름·내용·외부 다운로드까지 자동 취소되지 않는다.

FlatFileItemWriter의 `transactional(true)`는 활성 트랜잭션에서 버퍼 flush를 지연하는 기능이다. 메타데이터 DB와 파일을 하나의 원자적 commit으로 묶는 분산 트랜잭션 기능은 아니다. 일반 예외·메타데이터 저장 실패·프로세스 종료·운영체제 장애는 서로 다른 실패 지점을 만든다. [Writer 버퍼·트랜잭션 API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/file/builder/FlatFileItemWriterBuilder.html)

**flush는 버퍼의 데이터를 아래 계층으로 보내는 것**, forceSync는 파일 변경을 디스크에 동기화하도록 요청하는 설정이다. `forceSync(true)`는 내구성을 보강하지만 비용이 있고, DB·파일·디렉터리 이름 변경을 한꺼번에 확정하지 않는다. 저장장치·파일 시스템의 전원 장애까지 모두 검증했다는 뜻도 아니다. [파일 Writer 동기화 계약](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/support/AbstractFileItemWriter.html)

따라서 작성 중 파일은 비공개로 유지하고, 재시작에 필요한 메타데이터와 파일을 함께 보존한다. 검증 실패를 감추기 위해 파일만 지우거나 메타데이터만 초기화하면 복구에 필요한 두 상태의 연결이 끊어진다.

### 3.2 출력 ID·입력 버전·경로는 재시작에도 유지한다

**출력 ID(exportId)는 하나의 산출물을 식별하는 값**이다. 같은 실패 업무를 이어 쓸 때는 같은 exportId·snapshotId·파일 형식을 유지한다. 재시작마다 Execution ID나 현재 시각으로 파일 이름을 새로 만들면 Reader는 중간부터 읽는데 Writer는 새 파일을 만드는 식으로 경계가 어긋날 수 있다.

이번 형식은 `stock-csv-v1`이며 Job 이름도 이를 구분하는 `stockFileExportV1Job`으로 설계한다. 식별 파라미터는 snapshotId·exportId다. 새로운 출력에는 새 exportId를 할당하고, 이 ID가 어떤 입력·형식에 속하는지 서버의 출력 이력으로 연결한다.

아래는 `src/main/java/com/example/batch/ExportFiles.java`에 추가하는 **기존 프로젝트용 경로 파일**이다. 외부에서 파일 경로를 받지 않고 서버가 정한 비공개 디렉터리와 정규 UUID만 사용한다. 루트는 사전에 생성되어 있고 애플리케이션 외의 주체가 파일·심볼릭 링크를 바꾸지 못하도록 관리한다.

```java
package com.example.batch; // 내보내기 구성과 같은 패키지다.

import java.nio.file.Files; // 서버가 준비한 디렉터리인지 확인한다.
import java.nio.file.Path; // 운영체제별 경로 구분자를 직접 이어 붙이지 않는다.
import java.util.UUID; // 외부 경로 대신 제한된 산출물 식별자를 받는다.

public record ExportFiles(Path staging, Path sealed) {
    public static ExportFiles under(Path privateRoot, String exportId) {
        if (exportId == null || !UUID.fromString(exportId).toString().equals(exportId)) {
            throw new IllegalArgumentException("정규 소문자 UUID 형식의 exportId가 필요합니다.");
            // ../ 같은 경로 문자열·축약 UUID·다른 표기를 파일명으로 쓰지 않는다.
        }
        Path root = privateRoot.toAbsolutePath().normalize(); // 기준 디렉터리를 명확하게 한다.
        if (!Files.isDirectory(root) || Files.isSymbolicLink(root)) {
            throw new IllegalArgumentException("관리되는 비공개 출력 디렉터리가 필요합니다.");
        }
        return new ExportFiles(root.resolve(exportId + ".csv.part"), root.resolve(exportId + ".csv"));
        // 작성 파일과 닫힌 결과 파일 모두 같은 비공개 루트에 둔다.
    }
}
```

이 코드는 UUID·이름 구성의 방어 조건이지 완전한 파일 시스템 권한 관리 구현은 아니다. 디렉터리의 소유권·상위 경로·접근 권한과 검사 이후의 파일 교체 경쟁은 배포 환경에서 별도로 관리해야 한다.

⚠️ 주의: `.csv`로 이름을 바꾼다고 자동 공개되는 구조로 만들지 않는다. 비공개 루트 전체를 정적 파일 경로로 노출하면 `.part`도 읽힐 수 있다. 다운로드는 권한과 READY 이력을 확인한 산출물만 제공한다.

### 3.3 먼저 출력 형식을 작게 고정한다

**LineAggregator는 항목 하나를 출력할 한 줄의 문자열로 바꾸는 구성 요소**다. CSV는 쉼표로 필드를 나누지만, 임의의 문자열에 쉼표·큰따옴표·줄바꿈이 있으면 quoting·escaping 규칙도 필요하다. 단순 문자열 연결이 모든 CSV 값을 안전하게 표현하지는 않는다. [파일 Writer와 LineAggregator](https://docs.spring.io/spring-batch/reference/readers-and-writers/flat-files/file-item-writer.html)

이번에는 도서 ID와 0 이상의 정수 재고만 출력한다. ID는 영문 대문자 하나와 숫자 세 자리로 제한하고 제목은 출력하지 않는다. 이 제한에서만 쉼표·개행 없는 고정 두 필드를 직접 연결한다. 실제 제목·사용자 입력까지 출력하려면 검증된 CSV 라이브러리와 별도의 스프레드시트 해석 위험 검토가 필요하다.

아래는 `src/main/java/com/example/batch/StockLine.java`에 추가하는 **기존 프로젝트용 형식 파일**이다. 헤더·인코딩·줄바꿈도 형식의 일부로 관리한다. 이번 파일은 UTF-8, BOM 없음, LF(`\n`), 고정 헤더, 입력 item_id 순서다.

```java
package com.example.batch; // Writer·검증기가 같은 표현 규칙을 사용한다.

public record StockLine(String bookId, int stock) {
    public static final String HEADER = "book_id,stock"; // 헤더 순서도 계약의 일부다.

    public StockLine {
        if (bookId == null || !bookId.matches("[A-Z][0-9]{3}") || stock < 0) {
            throw new IllegalArgumentException("도서 ID 형식과 0 이상의 재고가 필요합니다.");
            // 쉼표·따옴표·개행·수식 시작 문자를 허용하지 않는 좁은 실습 형식이다.
        }
    }

    public String csvLine() {
        return bookId + "," + stock; // 줄바꿈은 Writer가 한 번만 붙인다.
    }
}
```

예상 출력은 `book_id,stock` 헤더 다음에 `B001,12` 같은 행이 오는 형태다. 정렬은 ID 문자열의 알파벳 순이 아니라 Reader가 보존한 item_id 순서다. 빈 입력은 헤더와 LF만 있는 정상 파일로 허용한다.

### 3.4 FlatFileItemWriter를 쓰기 Step에 직접 연결한다

아래는 `src/main/java/com/example/batch/StockFileWriteConfiguration.java`의 **기존 프로젝트용 구성 파일**이다. [스냅샷 노트의 createReader](../35_10_06_Batch_DB_Readers_and_Input_Snapshots/10_06_Batch_DB_Readers_and_Input_Snapshots.md)와 `CatalogBatchConfiguration.Book`, 기존 JDBC Batch 인프라를 재사용한다. 입력 manifest는 ready이며 스냅샷과 출력 파일을 실행 중 다른 주체가 수정하지 않는 조건이다.

이 파일은 **쓰기 Step만 제공한다**. 검증 Tasklet·공개 Tasklet·출력 이력 저장소·전체 Job 조립은 아래의 설계 절차를 구현해야 하며, 이 구성만으로 다운로드 서비스까지 완성되지는 않는다. 서버 설정 `study.export.private-root`는 기존 비공개 디렉터리의 절대 경로로 지정한다.

```java
package com.example.batch; // 기존 JDBC Batch 프로젝트 아래에 둔다.

import java.nio.file.Path; // 설정된 서버 경로를 표현한다.
import javax.sql.DataSource; // 스냅샷 조회와 메타데이터에 사용하는 기존 DB 연결이다.
import com.example.batch.CatalogBatchConfiguration.Book; // 기존 입력 record를 재사용한다.
import org.springframework.batch.core.configuration.annotation.StepScope; // 실행별 입력·경로를 연결한다.
import org.springframework.batch.core.repository.JobRepository; // Reader·Writer 진행 상태를 보존한다.
import org.springframework.batch.core.step.Step; // 구성할 쓰기 단계의 타입이다.
import org.springframework.batch.core.step.builder.ChunkOrientedStepBuilder; // Batch 6의 chunk 구성이다.
import org.springframework.batch.infrastructure.item.database.JdbcPagingItemReader; // 상태를 저장하는 입력 Reader다.
import org.springframework.batch.infrastructure.item.file.FlatFileItemWriter; // 상태를 저장하는 파일 Writer다.
import org.springframework.batch.infrastructure.item.file.builder.FlatFileItemWriterBuilder;
import org.springframework.beans.factory.annotation.Qualifier; // 같은 타입의 다른 Bean과 구분한다.
import org.springframework.beans.factory.annotation.Value; // 설정·Job 파라미터를 연결한다.
import org.springframework.context.annotation.Bean; // 구성 요소를 등록한다.
import org.springframework.context.annotation.Configuration; // Step 구성을 담는다.
import org.springframework.core.io.FileSystemResource; // 서버의 실제 로컬 파일 자원이다.
import org.springframework.jdbc.support.JdbcTransactionManager; // 기존 DB 트랜잭션 경계다.

@Configuration(proxyBeanMethods = false) // Bean 메서드 직접 호출 대신 주입을 사용한다.
public class StockFileWriteConfiguration {
    @Bean
    @StepScope
    public JdbcPagingItemReader<Book> stockExportReader(DataSource dataSource,
            @Value("#{jobParameters['snapshotId']}") String snapshotId) throws Exception {
        return SnapshotBatchConfiguration.createReader(dataSource, snapshotId);
        // 기존의 발행 확인·item_id 고유 정렬·상태 저장을 유지한다.
    }

    @Bean
    @StepScope
    public FlatFileItemWriter<StockLine> stockCsvWriter(
            @Value("${study.export.private-root}") String privateRoot,
            @Value("#{jobParameters['exportId']}") String exportId) {
        ExportFiles paths = ExportFiles.under(Path.of(privateRoot), exportId); // 재시작에도 같은 경로다.
        return new FlatFileItemWriterBuilder<StockLine>()
                .name("stockCsvWriterV1") // ExecutionContext 키를 계산하는 안정적인 Writer 이름이다.
                .resource(new FileSystemResource(paths.staging())) // 작성 중에는 .part만 쓴다.
                .encoding("UTF-8") // 운영체제 기본 문자셋에 의존하지 않는다.
                .lineSeparator("\n") // Windows에서도 동일한 출력 바이트를 만든다.
                .headerCallback(writer -> writer.write(StockLine.HEADER)) // 개행은 Writer가 추가한다.
                .lineAggregator(StockLine::csvLine) // 검증한 두 필드만 한 줄로 만든다.
                .saveState(true) // 재개 위치를 Step context에 저장한다.
                .append(false) // 새 실행의 무조건 끝에 붙이기와 재시작 복원을 구분한다.
                .shouldDeleteIfExists(false) // 새 실행이 기존 파일을 조용히 덮어쓰지 못하게 한다.
                .shouldDeleteIfEmpty(false) // 빈 입력의 헤더 파일도 유지한다.
                .transactional(true) // 활성 트랜잭션에서 버퍼 반영을 조정한다. DB와의 원자성은 아니다.
                .forceSync(true) // flush 시 디스크 동기화를 요청하는 실습 선택이다. 비용을 측정해야 한다.
                .build(); // open·update·close는 Step이 호출한다.
    }

    @Bean
    public Step writeStockFileV1Step(JobRepository repository, JdbcTransactionManager transactionManager,
            @Qualifier("stockExportReader") JdbcPagingItemReader<Book> reader,
            @Qualifier("stockCsvWriter") FlatFileItemWriter<StockLine> writer) {
        return new ChunkOrientedStepBuilder<Book, StockLine>("writeStockFileV1Step", repository, 3)
                .transactionManager(transactionManager) // chunk와 DB 진행 상태를 기존 경계에 연결한다.
                .reader(reader) // Reader의 ItemStream 생명주기를 직접 연결한다.
                .processor(book -> new StockLine(book.bookId().strip(), book.stock()))
                // 제목은 제외하고 ID 공백 정리·형식·재고 검사를 수행한다.
                .writer(writer) // Writer의 ItemStream도 직접 연결한다. 한 파일을 여러 worker가 공유하지 않는다.
                .build(); // 3건은 설명용 chunk 크기이며 운영 권장값을 뜻하지 않는다.
    }
}
```

같은 Step의 Reader·Writer가 각자의 상태 키를 관리한다. 반환 타입을 실제 Reader·Writer로 유지하고 직접 연결해 ItemStream 등록을 드러냈다. 파일 Writer는 thread-safe하지 않으므로 병렬 worker가 같은 인스턴스·같은 파일을 공유하지 않는다. [Writer API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/file/FlatFileItemWriter.html), [ItemStream](https://docs.spring.io/spring-batch/reference/readers-and-writers/item-stream.html)

### 3.5 재시작은 파일 끝에 무조건 추가하는 작업이 아니다

**byte offset은 파일 시작부터 센 바이트 위치**다. UTF-8에서 문자 하나가 반드시 1바이트인 것은 아니므로 글자 수와 파일 위치를 혼동하지 않는다. 이번 Writer는 진행 상태에 저장한 위치를 사용해 같은 파일에서 재개한다.

6.0.5 구현은 재시작 상태를 읽고, 실제 파일이 저장된 위치보다 작으면 오류를 내며, 재개 과정에서 마지막 확정 위치 이후의 꼬리를 잘라낼 수 있다. 운영자가 직접 파일 끝을 추정해 자르거나 내부 context 키를 수정할 필요가 없다. [AbstractFileItemWriter 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-infrastructure/src/main/java/org/springframework/batch/infrastructure/item/support/AbstractFileItemWriter.java)

`append(true)`는 기존 파일에 덧붙이는 정책이고, 같은 실패 실행의 저장 위치를 복원하는 정책과 다르다. 재시작 중 `.part`를 삭제하거나 이름을 바꾸면 재개할 대상이 사라진다. saveState를 끄고 Reader만 중간부터 재개하면 앞부분이 없는 파일을 만들 위험도 있다.

이번 `shouldDeleteIfExists(false)`는 새로운 실행에서 기존 파일이 있으면 보수적으로 실패하도록 선택한 값이다. 정상적인 재시작은 저장 상태를 통해 복원된다. 첫 chunk의 체크포인트가 생기기 전에 파일만 생성되고 실패했다면, 상태 없는 기존 파일 충돌로 멈출 수 있다. 이 경우도 실패 증거와 쓰기 주체 종료를 확인하고 승인된 재생성 절차를 판단한다. 자동 삭제로 덮지 않는다.

⚠️ 주의: 이미 완료한 쓰기 Step을 allowStartIfComplete(true)로 무조건 다시 실행하지 않는다. 검증 단계 실패 뒤 완료 쓰기를 생략하는 것과, 입력부터 파일 전체를 새로 만드는 것은 다른 복구 정책이다. 파일·Reader 상태·Writer 상태를 한 세트로 확인한다.

### 3.6 파일이 닫힌 뒤 별도 단계에서 검증한다

**파일 닫힘은 Writer의 버퍼·파일 핸들 생명주기를 끝내는 과정**이다. 데이터를 쓰는 중에 검사하거나 이동하면 버퍼에 남은 내용이 빠지거나 핸들 충돌이 생길 수 있다. 작업 스레드·Writer가 더 쓰지 않는다는 조건부터 확인한다.

6.0.5의 Step 실행 경로에서는 afterStep callback이 자원 close보다 먼저 호출된다. 따라서 afterStep에서 바로 파일을 이동하는 예제를 “완전히 닫힌 결과의 공개”라고 설명하지 않는다. 쓰기 Step이 반환한 뒤 별도 검증 Step으로 진행하고, close 오류·로그·실제 파일 상태도 확인한다. COMPLETED 표시 하나가 모든 파일 정리 성공의 증거는 아니다. [AbstractStep 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/step/AbstractStep.java)

검증할 것은 발행 명세와 보존 입력의 건수, 출력 순서·ID·수량, 헤더·인코딩·개행, 전체 바이트 수다. 이번 소규모 실습은 보존 입력에서 기대한 CSV 바이트를 만들어 실제 파일과 정확히 비교한다. 그다음 실제 파일 바이트의 SHA-256도 기록한다.

**체크섬은 파일 바이트를 요약한 값**이다. SHA-256은 바이트 변경을 대조하는 근거가 되지만, 임의 파일의 체크섬만 계산한다고 내용이 올바르거나 권한 있는 주체가 만든 파일이라는 증거가 되지는 않는다. 기대 입력과 내용 검증을 먼저 연결해야 한다. [MessageDigest API](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/security/MessageDigest.html)

다음은 `src/main/java/com/example/batch/StockFileVerifier.java`의 **기존 프로젝트용 검증 파일**이다. 최대 1,000건의 작은 실습 결과만 지원한다. 기대 데이터가 같은 Writer 버그를 그대로 복제하지 않는지도 별도 fixture·시험으로 확인한다.

```java
package com.example.batch; // 같은 StockLine 형식을 사용한다.

import java.io.IOException; // 파일 접근·내용 불일치를 실패로 전달한다.
import java.io.InputStream; // 실제 파일을 작은 버퍼로 순차 조회한다.
import java.nio.charset.StandardCharsets; // 기대 바이트를 UTF-8로 생성한다.
import java.nio.file.Files; // 파일 존재·입력 스트림을 연결한다.
import java.nio.file.LinkOption; // 검증 파일 자체가 심볼릭 링크인 경우를 제외한다.
import java.nio.file.Path; // 서버가 선택한 닫힌 파일의 경로다.
import java.security.MessageDigest; // 실제 바이트의 SHA-256을 계산한다.
import java.security.NoSuchAlgorithmException; // 알고리즘 준비 실패를 호출자에 전달한다.
import java.util.HexFormat; // Java 17에서 해시 바이트를 16진수로 표현한다.
import java.util.List; // 보존 입력으로 계산한 기대 행이다.

public final class StockFileVerifier {
    private StockFileVerifier() {} // 상태 없는 도구이므로 인스턴스를 생성하지 않는다.

    public static Verification verify(Path file, List<StockLine> expected)
            throws IOException, NoSuchAlgorithmException {
        if (expected.size() > 1_000) {
            throw new IllegalArgumentException("이 검증기는 최대 1,000건의 실습 입력만 지원합니다.");
            // 기대 결과 전체를 메모리에 만드는 예제를 대용량 검증으로 일반화하지 않는다.
        }
        if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("검증할 일반 파일이 없습니다."); // 누락·링크를 정상 빈 파일로 취급하지 않는다.
        }
        var text = new StringBuilder(StockLine.HEADER).append('\n'); // 빈 입력도 헤더를 포함한다.
        for (StockLine row : expected) {
            text.append(row.csvLine()).append('\n'); // Reader와 같은 순서의 기대 행을 구성한다.
        }
        byte[] canonical = text.toString().getBytes(StandardCharsets.UTF_8); // BOM 없는 UTF-8·LF다.
        MessageDigest digest = MessageDigest.getInstance("SHA-256"); // 실제 파일 바이트를 요약한다.
        int position = 0; // 지금까지 확인한 기대 바이트의 위치다.
        try (InputStream input = Files.newInputStream(file)) { // 정상·예외 모두 스트림을 닫는다.
            byte[] buffer = new byte[8_192]; // 실제 파일을 한꺼번에 메모리에 올리지 않는다.
            int read;
            while ((read = input.read(buffer)) != -1) { // EOF까지 읽어 불필요한 꼬리도 확인한다.
                if (position + read > canonical.length) {
                    throw new IOException("기대보다 긴 파일입니다."); // 중복 행·추가 바이트를 거절한다.
                }
                for (int i = 0; i < read; i++) {
                    if (buffer[i] != canonical[position + i]) {
                        throw new IOException("기대 입력과 출력 바이트가 다릅니다."); // 값·순서·형식 차이다.
                    }
                }
                digest.update(buffer, 0, read); // 실제로 읽은 유효 구간만 해시에 반영한다.
                position += read; // 버퍼 크기가 아니라 실제 읽은 수만큼 이동한다.
            }
        }
        if (position != canonical.length) {
            throw new IOException("기대보다 짧은 파일입니다."); // 누락·중간 잘림·끝 개행 누락을 확인한다.
        }
        return new Verification(expected.size(), position, HexFormat.of().formatHex(digest.digest()));
        // 내용 대조를 통과한 실제 파일의 행 수·바이트 수·체크섬이다.
    }

    public record Verification(long rows, long bytes, String sha256) {} // 외부 공개 여부를 뜻하지는 않는다.
}
```

검증은 줄 단위만이 아니라 기대한 바이트와 비교하므로 CRLF·BOM·헤더 변경도 거절한다. 동일 건수에서 수량 하나만 바뀌거나 행 순서가 달라져도 실패한다. 디렉터리 접근 권한과 검사 중 파일 불변성은 여전히 외부 전제다.

검증 Tasklet에서는 발행 명세·보존 입력 건수가 같고 1,000건 이하인지 먼저 검사한다. 보존 입력을 item_id 순서로 조회해 StockLine 목록을 만들고 이 함수에 전달한다. 조회 시에도 상한 초과를 감지할 수 있게 제한하며, 건수가 많으면 이번 검증기로 일부만 비교하고 통과시키지 않는다. 대용량은 스트리밍 병합 대조·분할 검증 등 별도 전략으로 바꾼다.

### 3.7 원자적 파일 이동과 결과 공개는 다르다

**원자적 이동은 관찰자에게 파일 시스템의 이름 변경을 하나의 동작으로 보이게 하는 기능**이다. Java에서는 `Files.move(source, target, ATOMIC_MOVE)`로 요청한다. 같은 저장소에서도 제공자·환경이 지원해야 하며, 다른 FileStore 등에서는 AtomicMoveNotSupportedException이 발생할 수 있다. [Files.move 계약](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/nio/file/Files.html)

아래는 **배타적 공개 제어와 검증을 끝낸 호출부 안의 일부 코드**다. `paths`는 앞의 ExportFiles, Files·StandardCopyOption·FileAlreadyExistsException은 `java.nio.file`의 타입이다. 이 코드가 출력 이력·동시성·권한 정책을 구현하지는 않는다.

```java
// 모든 쓰기 주체 종료·동일 exportId의 배타적 공개 제어·검증 완료를 먼저 확인한다.
if (Files.exists(paths.sealed())) {
    throw new FileAlreadyExistsException(paths.sealed().toString()); // 기존 결과는 덮지 않고 대조한다.
}
Files.move(paths.staging(), paths.sealed(), StandardCopyOption.ATOMIC_MOVE);
// 지원하지 않는 환경이면 실패를 전달한다. 일반 복사·이동으로 몰래 대체하지 않는다.
```

⚠️ 주의: ATOMIC_MOVE는 대상이 이미 있으면 덮어쓸지 실패할지가 구현에 따라 다르며, 다른 옵션도 무시된다. 위 exists 검사는 경쟁을 막는 잠금이 아니다. 배타적 제어 없이 “REPLACE_EXISTING을 안 썼으니 절대 덮어쓰지 않는다”고 가정하면 안 된다. 파일 수정자 전체를 통제하고 저장소의 조건부 생성·이동 계약을 확인한다. [이동 옵션의 한계](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/nio/file/Files.html)

원자적 이동이 지원되지 않으면 비원자적 복사로 완성본을 바로 노출하지 않는다. 대상 저장소의 비공개 임시 객체·검증·공개 표식처럼 별도 프로토콜을 설계한다. 파일 동기화·디렉터리 메타데이터의 내구성과 전원 장애 복구도 대상 환경에서 시험해야 한다.

무엇보다 rename과 DB 공개 이력 commit은 별개의 동작이다. 둘의 실패 사이를 없앨 수 있다고 주장하는 대신 같은 산출물의 상태를 대조해 복구 가능하게 만든다.

### 3.8 공개 이력으로 중복 수행과 중간 장애를 대조한다

**공개 이력은 산출물의 입력 소속·형식·검증 근거·제공 가능 상태를 보관하는 업무 데이터**다. Batch 메타데이터와 역할이 다르다. exportId, snapshotId, 형식 버전, 선택한 서버 경로, 건수·크기·SHA-256, 실행 식별과 공개 상태를 연결한다.

예를 들어 WRITING은 작성 중, VERIFIED는 닫힌 파일의 검증 완료, READY는 실제 파일과 공개 이력이 맞아 다운로드를 허용한 상태로 정한다. 이는 이번 노트의 **설계 예시**이며 Spring Batch가 자동 제공하는 상태 이름이 아니다. 단순 파일 존재 여부를 READY로 대체하지 않는다.

공개 절차는 다음처럼 구현·시험한다. 이 이력 저장소·검증/공개 Tasklet은 위 쓰기 구성 파일에 구현되어 있지 않다.

1. exportId와 입력·형식의 매핑을 확정하고 같은 산출물의 명령을 배타적으로 조정한다. 다른 서버·관리 경로도 같은 규칙을 지켜야 한다.
2. 쓰기 Step을 실행하고 모든 파일 쓰기·자원 정리가 끝났는지 확인한다. close 오류가 있으면 공개를 중단하는 오류 처리도 필요하다.
3. 별도 검증 Step에서 보존 입력과 파일을 대조하고 VERIFIED 이력에 검증 근거를 저장한다.
4. 공개 Step에서 해당 산출물을 다시 조회하고, 파일이 검증 후 변경되지 않았는지 확인한 뒤 지원되는 이동을 수행한다.
5. 실제 최종 파일의 소속·내용과 검증 근거가 맞으면 READY를 확정한다. 다운로드는 권한 검사와 READY 조회를 통과해야 한다.

| 장애 후 관찰 | 먼저 확인할 것 | 복구 방향 |
| --- | --- | --- |
| 쓰기 실패·.part 존재 | 쓰기 주체 종료·저장된 Reader/Writer 상태 | 같은 파일·같은 업무로 재시작 검토 |
| 쓰기 완료·검증 실패 | 기대 입력·파일 내용·형식·닫힘 오류 | 공개 중단·원인 조사, 임의 append 금지 |
| 이동 완료·READY 미확정 | 최종 파일의 ID·입력 매핑·검증 근거 | 동일 파일임을 대조한 뒤 이력 확정, 다시 쓰지 않음 |
| .part 없음·최종 파일 존재 | 이미 이동했는지·검증한 파일인지 | 존재만으로 성공 처리하지 않고 내용 대조 |
| 두 경로 모두 존재 또는 내용 불일치 | 경쟁 실행·수동 복사·다른 산출물 여부 | 자동 덮어쓰기 중단·조사 |
| READY인데 파일 없음 | 저장소 장애·보존 정책·잘못된 삭제 | 제공 중단·원인 조사, 이전 READY를 그대로 신뢰하지 않음 |

같은 공개 명령을 재시도해도 새 파일을 무조건 생성하거나 기존 완성본을 교체하지 않는 것이 핵심이다. DB의 유일 제약·조건부 상태 변경은 공개 이력 경쟁에 도움이 되지만, 임의 파일 수정자를 차단하는 기능까지 자동 제공하지 않는다.

### 3.9 작은 파일 검증과 실제 Batch 재시작 시험을 구분한다

아래는 `src/test/java/com/example/batch/StockFileVerifierTest.java`의 **JUnit Jupiter 파일 테스트**다. Java 프로젝트의 테스트 의존성과 앞의 형식·경로·검증 파일이 필요하다. @TempDir의 전용 임시 디렉터리에서만 fixture를 만들며 Writer·DB·전체 Job은 실행하지 않는다. 여기서는 실행하지 않았다.

```java
package com.example.batch; // 검증 대상과 같은 패키지다.

import java.io.IOException; // 내용 검증이 거절하는 예외다.
import java.nio.charset.StandardCharsets; // fixture의 인코딩을 명시한다.
import java.nio.file.Files; // 테스트 소유의 파일만 만든다.
import java.nio.file.Path; // JUnit이 준비한 임시 디렉터리를 받는다.
import java.util.List; // 독립적인 기대 입력을 전달한다.
import org.junit.jupiter.api.Test; // JUnit 테스트 메서드다.
import org.junit.jupiter.api.io.TempDir; // 각 테스트의 임시 파일을 격리한다.
import static org.junit.jupiter.api.Assertions.*; // 결과·예외를 검사한다.

class StockFileVerifierTest {
    @TempDir Path directory; // 실제 운영 출력 디렉터리를 사용하지 않는다.

    @Test
    void exactBytesAndEmptyInputAreAccepted() throws Exception {
        Path file = directory.resolve("normal.csv.part"); // 테스트가 소유한 fixture다.
        Files.writeString(file, "book_id,stock\nB001,12\nB002,7\n", StandardCharsets.UTF_8);
        var proof = StockFileVerifier.verify(file, List.of(new StockLine("B001", 12), new StockLine("B002", 7)));
        assertEquals(2L, proof.rows()); // 헤더는 데이터 행 수에 포함하지 않는다.
        assertEquals(Files.size(file), proof.bytes()); // 검증한 실제 바이트 수를 확인한다.
        assertEquals(64, proof.sha256().length()); // SHA-256의 16진수 표현 길이다.
        Path empty = directory.resolve("empty.csv.part"); // 빈 입력도 파일 계약은 유지한다.
        Files.writeString(empty, "book_id,stock\n", StandardCharsets.UTF_8);
        assertEquals(0L, StockFileVerifier.verify(empty, List.of()).rows()); // 정상 헤더 파일을 허용한다.
    }

    @Test
    void sameRowCountDoesNotHideWrongStock() throws Exception {
        Path file = directory.resolve("wrong.csv.part"); // 행 수·문자 수는 맞지만 값이 다르다.
        Files.writeString(file, "book_id,stock\nB001,13\n", StandardCharsets.UTF_8);
        assertThrows(IOException.class,
                () -> StockFileVerifier.verify(file, List.of(new StockLine("B001", 12))));
        // 체크섬만 생성하고 통과시키지 않고 기대 값과 직접 비교한다.
    }

    @Test
    void truncatedAndExtraBytesAreRejected() throws Exception {
        Path shortFile = directory.resolve("short.csv.part"); // 데이터 행이 사라진 파일이다.
        Files.writeString(shortFile, "book_id,stock\n", StandardCharsets.UTF_8);
        var expected = List.of(new StockLine("B001", 12)); // 같은 기대 입력을 두 경계에 사용한다.
        assertThrows(IOException.class, () -> StockFileVerifier.verify(shortFile, expected));
        Path longFile = directory.resolve("long.csv.part"); // 같은 행을 두 번 기록했다.
        Files.writeString(longFile, "book_id,stock\nB001,12\nB001,12\n", StandardCharsets.UTF_8);
        assertThrows(IOException.class, () -> StockFileVerifier.verify(longFile, expected));
    }

    @Test
    void unsupportedFieldsAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> new StockLine("B,01", 12)); // 쉼표 필드는 허용하지 않는다.
        assertThrows(IllegalArgumentException.class, () -> new StockLine("=A01", 12)); // 제한된 ID 형식을 지킨다.
        assertThrows(IllegalArgumentException.class, () -> new StockLine("B001", -1)); // 음수 재고도 거절한다.
    }

    @Test
    void stableExportIdProducesTheSamePaths() {
        String id = "de09acdc-ec42-4ee8-b72f-47c0d8fab309"; // 이번 테스트 전용 산출물 ID다.
        var first = ExportFiles.under(directory, id); // 최초 시도의 경로 계산이다.
        assertEquals(first, ExportFiles.under(directory, id)); // 재시작도 같은 경로여야 한다.
        assertNotEquals(first.staging(), first.sealed()); // 작성·최종 파일 이름을 구분한다.
        assertThrows(IllegalArgumentException.class, () -> ExportFiles.under(directory, "../other"));
        // 경로 입력을 UUID 산출물 식별자로 위장하지 못하게 한다.
    }
}
```

Java 프로젝트 루트에서 사용 중인 Wrapper 하나를 선택한다. TIL 루트에는 해당 빌드 프로젝트가 없다.

```powershell
# Gradle 프로젝트라면 파일 검증·경로 테스트를 실행한다.
./gradlew.bat test --tests com.example.batch.StockFileVerifierTest

# Maven 프로젝트라면 같은 클래스를 실행한다.
./mvnw.cmd -Dtest=StockFileVerifierTest test
```

예상 결과는 다섯 테스트의 통과다. 이 시험은 FlatFileItemWriter의 트랜잭션·재시작이나 실제 저장소의 원자적 이동을 증명하지 않는다. 다음은 별도 통합 시험 설계다.

| 시험 | 실패·경계 통제 | 확인할 증거 |
| --- | --- | --- |
| 정상 7건·빈 입력 | 같은 형식·정렬로 쓰기 Step 실행 | 헤더·바이트·행 수·입력 ID·수량 일치 |
| 두 번째 chunk 실패 | 시험 Writer의 delegate.write 뒤 일회성 예외 | 최초 확정 파일·상태, 같은 Instance 재시작 뒤 중복 없는 최종 파일 |
| Writer 재개 | 마지막 확정 뒤 추가 꼬리·잘린 파일을 전용 fixture로 준비 | 꼬리 복구 또는 짧은 파일 오류, 임의 상태 조작 없음 |
| 저장·종료 실패 | metadata 저장·flush·close의 각 실패를 분리 주입 | Job/Step 상태·실패 로그·파일 내용, 공개되지 않음 |
| 프로세스 종료 | 입력·.part·JDBC 상태 유지·이전 쓰기 주체 종료 확인 | 새 프로세스가 같은 파일을 재개하고 전체 결과 검증 |
| 공개 직후 응답 유실 | 이동 뒤 READY 확정·응답 사이에서 실패 | 새 파일 생성·덮어쓰기 없이 이력과 파일 대조 |
| 대상 충돌·이동 미지원 | 최종 파일 존재·실제 FileStore의 지원 조건 | 기존 파일 보존·안전한 실패·조사 근거 |

고정 sleep으로 파일 쓰기가 끝났다고 추측하지 않는다. 테스트 신호·Step 이력·실제 작업 종료를 제한 시간 안에 확인한다. 검사 도중 전체 Batch 테이블을 비우거나 .part를 삭제하면 원래의 복구 경계를 검증할 수 없다.

### 3.10 배포·보존 정책도 재시작 계약의 일부다

**출력 형식 버전은 저장한 파일 바이트를 해석하는 계약**이다. 재시작 도중 헤더·인코딩·개행·필드 순서를 바꾸면 같은 Writer 위치와 Reader 상태를 유지해도 파일 의미가 깨질 수 있다. 이전 실행은 호환되는 코드로 복구하고 새로운 형식은 새 업무·산출물로 분리하는 정책을 정한다.

입력 snapshot, 출력 이력, .part 또는 최종 파일, Batch 메타데이터를 복구에 필요한 기간 동안 함께 유지한다. READY 파일은 재시작 대상이 아니라 공개한 산출물이므로 별도의 보존·폐기 정책을 적용한다. 파일만 지우고 READY를 남기지 않도록 정리 절차와 조회 동작도 함께 검증한다.

다중 worker에서는 worker별 비공개 파일과 개별 상태를 두고, 완료 뒤 합치는 단계의 순서·중복·검증·공개를 별도 설계한다. 이번 단일 Writer 예제를 여러 스레드가 공유하는 것으로 확장하지 않는다.

## 4. 적용 관점에서 다시 보기

먼저 입력·산출물 ID·형식·정렬을 고정하고 서버가 관리하는 비공개 경로를 선택한다. 같은 실패 업무는 같은 Reader·Writer 상태와 .part 파일을 유지하고, 새 산출물은 새 출력 ID와 이력으로 관리한다.

쓰기 Step에 Reader·Writer의 ItemStream을 직접 연결한다. transactional·forceSync가 DB·파일 전체의 원자성을 뜻하지 않는다는 전제에서 실패와 재시작을 시험한다. 완료 쓰기를 무조건 반복하거나 파일 끝에 임의 append하지 않는다.

쓰기 주체 종료와 파일 닫힘을 확인한 뒤 별도 단계에서 보존 입력과 파일의 바이트·건수·크기를 대조한다. 검증 근거를 기록하고, 배타적 공개 제어 아래 실제 저장소가 지원하는 이동·공개 방식을 사용한다.

최종 파일과 READY 이력 사이의 실패는 같은 산출물의 매핑·검증 근거로 대조한다. 존재만 보고 성공 처리하거나 자동 덮어쓰기하지 않으며, 공개 경로·다운로드 권한·보존 정책까지 함께 확인한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

파일 쓰기·DB 진행 상태·파일 이름 변경·공개 이력은 각각 다른 실패 경계를 갖는다. 안전한 내보내기는 재개할 파일을 보존하고, 닫힌 결과를 검증하며, 실제 파일과 공개 이력을 대조하는 절차다.

### 5.2 이전·다음 학습과의 연결

[ExecutionContext 노트](../40_10_12_Batch_ExecutionContext_and_Step_Data_Handoff/10_12_Batch_ExecutionContext_and_Step_Data_Handoff.md)의 상태 저장을 실제 파일 위치·입력·검증 결과와 연결했다. 다음에는 **Spring Batch 객체 스토리지 업로드·멱등 공개와 정합성 복구**를 학습해 로컬 rename으로 해결할 수 없는 원격 저장소 경계를 다룬다.

### 5.3 더 파볼 만한 주제

대용량 스트리밍 대조, worker별 분할 파일의 결정적 병합, 저장소별 전원 장애·내구성 시험으로 확장할 수 있다. 외부 공개 알림은 Outbox·수신자 중복 처리와 연결한다.

### 5.4 참고 자료

- [FlatFileItemWriter 설명](https://docs.spring.io/spring-batch/reference/readers-and-writers/flat-files/file-item-writer.html), [API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/file/FlatFileItemWriter.html): 항목을 한 줄로 만드는 과정·형식·생명주기.
- [Writer builder](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/file/builder/FlatFileItemWriterBuilder.html), [기반 Writer API](https://docs.spring.io/spring-batch/reference/api/org/springframework/batch/infrastructure/item/support/AbstractFileItemWriter.html): 상태 저장·append·파일 충돌·transactional·forceSync.
- [기반 Writer 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-infrastructure/src/main/java/org/springframework/batch/infrastructure/item/support/AbstractFileItemWriter.java): byte 위치 복원·파일 크기 검사·재개 시 truncate.
- [ItemStream](https://docs.spring.io/spring-batch/reference/readers-and-writers/item-stream.html), [Step 재시작](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing/restart.html), [AbstractStep 6.0.5](https://raw.githubusercontent.com/spring-projects/spring-batch/v6.0.5/spring-batch-core/src/main/java/org/springframework/batch/core/step/AbstractStep.java): 자원 상태·완료 Step 생략·afterStep과 close의 순서.
- [Java Files](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/nio/file/Files.html), [이동 옵션](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/nio/file/StandardCopyOption.html): 원자적 이동 지원 조건·대상 충돌·이름 변경의 한계.
- [MessageDigest](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/security/MessageDigest.html): 실제 파일 바이트의 SHA-256 계산.

## 6. 요약 정리

1. 파일 기록·DB commit·이름 변경·공개 상태 확정은 같은 원자적 동작이 아니다.
2. 같은 재시작에는 입력·출력 ID·형식·Writer 이름·임시 경로를 유지한다.
3. 문자셋·BOM·개행·헤더·정렬·CSV 표현 규칙도 출력 계약에 포함한다.
4. Writer의 저장 위치 복원과 무조건 append를 구분하고 파일·상태를 함께 보존한다.
5. transactional은 버퍼 조정, forceSync는 동기화 요청이며 전체 시스템 원자성 보장이 아니다.
6. afterStep만 믿고 공개하지 않고 쓰기 종료·닫힘·내용 검증을 별도로 확인한다.
7. 입력과 결과 바이트를 먼저 대조하고 크기·건수·체크섬을 검증 근거로 남긴다.
8. ATOMIC_MOVE의 지원·대상 교체 정책을 확인하고 배타적 제어·공개 이력을 결합한다.
9. 공개 중간 실패는 같은 산출물의 파일·이력을 대조하며 자동 덮어쓰기로 해결하지 않는다.

🧠 기억할 것: 작성 중인 파일과 제공 가능한 결과를 구분하고, 재시작할 때는 파일·진행 상태·입력·공개 이력을 함께 본다.

## 7. 미니 퀴즈 또는 체크리스트

1. transactional(true)이면 DB rollback 때 파일과 이름 변경도 모두 원상복구되는가?
2. 재시작할 때 Execution ID로 새 파일을 만들고 Reader는 저장 위치부터 읽으면 어떤 문제가 생길 수 있는가?
3. 결과가 일곱 행이고 SHA-256도 계산했다. 내용 검증을 마쳤다고 할 수 있는가?
4. ATOMIC_MOVE에서 REPLACE_EXISTING을 쓰지 않았다. 동시에 존재한 대상 파일을 절대 교체하지 않는가?
5. 최종 파일 이동은 끝났는데 READY 저장 전 서버가 종료됐다. 파일을 새로 쓰기 전에 무엇을 확인해야 하는가?

<details>
<summary>정답과 해설</summary>

1. 아니다. 활성 트랜잭션의 버퍼 flush를 조정하는 기능이다. DB·파일·rename·외부 제공은 별도 실패 경계를 갖는다.
2. Reader는 앞부분을 생략하고 Writer는 새 파일을 만들 수 있어 누락된 결과가 생긴다. 같은 업무의 파일과 Reader·Writer 상태를 함께 유지해야 한다.
3. 아니다. 같은 건수에서도 잘못된 ID·수량·순서가 있을 수 있다. 보존 입력의 기대 변환 결과와 실제 내용을 대조한 뒤 체크섬을 기록한다.
4. 아니다. ATOMIC_MOVE는 다른 옵션을 무시하며 대상이 있으면 교체·실패 여부가 구현에 달려 있다. exists 검사만으로 경쟁이 차단되지 않아 배타적 제어와 저장소 계약이 필요하다.
5. 같은 exportId의 입력·형식·검증 이력과 최종 파일의 크기·내용·체크섬을 대조한다. 동일한 검증 산출물이라면 공개 이력을 마무리하고, 불일치하면 조사하며 자동 교체하지 않는다.

</details>
