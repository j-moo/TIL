# 업로드 통합 테스트·실패 주입과 정합성 검증

- 🎯 글의 목표: 업로드의 전송·완료·검사·삭제 경계를 나누어 시험하고, 응답 유실과 동시 요청 뒤에 남은 DB 상태·객체 버전·바이트를 근거로 결과를 판단한다.
- 🧩 핵심 키워드: 통합 테스트, 테스트 대역, fixture, 실패 주입, 응답 유실, 동시성, latch, 조건부 UPDATE, rollback, Testcontainers, 정합성
- ⭐ 중요도: 높음. 성공 응답 한 번이나 예외 발생만 확인해서는 저장은 되었는지, 취소된 파일이 승인되지는 않는지, 복구가 중복 효과를 만들지는 않는지 알 수 없기 때문이다.
- 📝 한눈에 보는 내용: 지켜야 할 조건 → 시험 범위 분리 → 효과 전·후 실패 → TypeScript 실패 주입 → PostgreSQL 조건부 갱신 실험 → S3·브라우저 계약 시험 → 복구 결과 대조
- 🔗 관련 주제: [S3 Multipart Upload·중단과 재개](../48_11_01_S3_Multipart_Upload_and_Resume/11_01_S3_Multipart_Upload_and_Resume.md), [직접 업로드·완료 검증](../47_10_31_Presigned_Direct_Upload_and_Completion_Verification/10_31_Presigned_Direct_Upload_and_Completion_Verification.md), [격리 검사·만료 정리](../46_10_28_Upload_Lifecycle_Quarantine_and_Cleanup/10_28_Upload_Lifecycle_Quarantine_and_Cleanup.md), [테스트 전략](../10_09_06_Testing_Strategy/09_06_Testing_Strategy.md), [Batch 실패 주입](../37_10_08_Batch_Integration_Testing_and_Restart_Verification/10_08_Batch_Integration_Testing_and_Restart_Verification.md)
- 🧱 선수 지식: File·Blob·Promise·fetch, Java JDBC·try-with-resources, SQL 트랜잭션, 업로드 상태·versionId·part receipt, JUnit assertion

> 기준일: 2026-11-02. 기존 업로드 흐름은 Java 21·Spring Boot 4.1.2·AWS SDK 2.31.54를 전제로 한다. 이번 DB 실험은 Spring을 띄우지 않는 별도 Java 21·JUnit 5.11.4·Testcontainers 2.0.5·pgJDBC 42.7.7·PostgreSQL 17 구성이다. 버전은 예제 재현용이며 최신 버전이라는 의미가 아니다. TypeScript 전송 코드는 이전 노트를 그대로 시험하고, 새 코드는 테스트 전용 실패 주입 도구다. 실제 실행한 범위와 미실행 범위는 3.10에 구분한다.

## 1. 들어가며

업로드 구현이 정상 파일 하나를 저장했다고 해서 장애 상황에서도 안전하다는 뜻은 아니다. S3에는 파일이 생겼는데 브라우저가 응답을 받지 못할 수 있고, 서버가 내용을 검사하는 사이 사용자가 삭제를 요청할 수도 있다. 재시도가 새 파일을 만들거나 늦은 검사 결과가 삭제 상태를 되돌리면 정상 경로만 보던 테스트는 통과해도 서비스의 규칙은 깨진다.

예를 들어 part 저장 직후 응답이 끊긴 상황과, 요청이 저장소에 도착하기 전에 끊긴 상황을 비교해 보자. 둘 다 화면에는 네트워크 오류처럼 보이지만 원격 저장 결과는 다르다. 이번 핵심 질문은 **“오류를 보았는가?”가 아니라 “어디까지 효과가 발생했고, 이후 어떤 상태와 바이트가 남았는가?”**다.

이전 노트의 업로드 프로토콜을 다시 구현하기보다 그 계약을 검증하는 방법을 다룬다. 실행 가능한 클라이언트 대역 시험, 실제 PostgreSQL에서 실행할 JDBC 실험, S3·브라우저에서 추가 확인할 계약 시험을 분리한다. 서로 다른 시험을 하나의 ‘통합 테스트 통과’ 문장으로 합치지 않는다.

## 2. 핵심 개념 정리

```text
지켜야 할 조건과 관찰값 결정
  → 자기 시험만의 ID·입력·저장 영역 준비
  → 정상 경로와 실패 위치를 분리
  → latch로 원하는 작업 순서 고정
  → 응답 + DB 상태 + 객체 버전·바이트 대조
  → 같은 ID로 복구하고 중복·되살아남 여부 확인
  → 진행 작업 종료와 자기 자원 정리까지 확인
```

| 핵심 질문 | 확인할 위치 |
| --- | --- |
| 성공·실패 뒤에도 무엇이 유지되어야 하는가? | 3.1 |
| 메모리 대역·실제 DB·실제 S3가 각각 무엇을 증명하는가? | 3.2 |
| 응답만 잃는 상황은 어떻게 만드는가? | 3.3~3.4 |
| 동시 완료·삭제·rollback을 DB에서 어떻게 구분하는가? | 3.5~3.7 |
| S3 프로토콜·브라우저·복구 시험은 무엇을 더 관찰하는가? | 3.8~3.10 |

## 3. 본문 정리

### 3.1 먼저 불변 조건과 관찰할 증거를 적는다

**불변 조건(invariant)**은 허용된 실행 순서가 달라져도 지켜야 하는 규칙이다. 여기서 ‘불변’은 DB 행이 바뀌지 않는다는 뜻이 아니라, 행이 바뀌더라도 약속이 깨지지 않는다는 뜻이다. 예를 들어 업로드 상태는 달라져도 다른 소유자에게 파일을 제공해서는 안 된다.

**정합성**은 관련된 기록과 실제 결과가 정한 규칙에 맞는 상태다. DB에 versionId가 적혀 있다는 것만으로 충분하지 않다. 해당 bucket·key의 그 버전이 검증한 바이트를 담고 있고, 현재 업무 상태가 사용을 허용하는지도 함께 맞아야 한다.

| 지켜야 할 조건 | 시험 후 읽을 증거 |
| --- | --- |
| 다른 소유자의 완료·조회·서명을 허용하지 않음 | HTTP 거절 + 저장소 어댑터 호출 없음 + DB 변경 없음 |
| 같은 접수를 두 번 완료해도 확정 버전을 교체하지 않음 | 영향 행 수·확정 versionId·현재 상태 |
| 접수 완료는 QUARANTINED이며 바로 READY가 아님 | 상태·검사 예약·다운로드 거절 |
| 취소·만료 뒤 늦은 결과가 파일을 되살리지 않음 | 마지막 UPDATE 0행 + 삭제/만료 상태 유지 |
| 버전 없는 최신 객체로 검사 대상을 바꾸지 않음 | HEAD/GET 요청의 같은 versionId + 실제 바이트 대조 |
| 통신 오류만으로 원격 성공·실패를 확정하지 않음 | 기존 ID의 대조 결과 + 중복 생성 여부 |
| 정리 완료와 접근 차단을 혼동하지 않음 | 접근은 거절됨 + 남은 part·객체 버전의 별도 정리 기록 |

예외가 발생했는지만 검사하면 “DB를 잘못 바꾼 뒤 예외를 던지는 구현”도 통과할 수 있다. 반대로 `verify(저장함수, 1회)` 같은 호출 수 검사는 실제 commit·바이트·승인 상태를 증명하지 않는다. 호출 검사는 권한 경계나 불필요한 작업을 확인할 때 사용하고, 최종 상태 검사를 대신하게 하지 않는다.

### 3.2 실제로 연결한 구성 요소에 따라 시험의 이름과 한계를 정한다

**테스트 대역(test double)**은 실제 외부 구성 요소 대신 테스트가 조종할 수 있는 구현이다. 저장 결과를 메모리에 보관하는 fake, 정해진 응답을 주는 stub, 호출을 기록하는 mock 등이 있다. 대역이 ‘성공’을 돌려준 것은 대역의 계약을 통과했다는 뜻이지 S3가 같은 요청을 받아들였다는 증거가 아니다.

| 시험 | 실제 실행하는 부분 | 이 시험만으로 증명하지 못하는 부분 |
| --- | --- | --- |
| 기존 part 계산·해시 시험 | 분할·해시·입력 규칙 | DB commit·SigV4·S3 저장 |
| 이번 TypeScript 실패 주입 | 기존 전송 함수 + 메모리 transport | 실제 네트워크 취소·CORS·S3 원자성 |
| 이번 JDBC 실험 | 실제 PostgreSQL·별도 연결·조건부 SQL | 앱 인증·실제 Repository 배선·S3 검증 |
| 앱 서비스 통합 시험 | 실제 서비스·실제 스키마·DB + 조종 가능한 S3 대역 | 실제 S3의 서명·오류 본문·IAM |
| S3 어댑터 계약 시험 | 실제 SDK·격리된 S3 저장 영역 | 브라우저 출처 규칙·화면 상태 |
| 브라우저 E2E 시험 | 화면·앱 API·실제 브라우저·S3 | 모든 경쟁 순서·프로세스 장애 조합 |

**E2E(end-to-end)**는 사용자 입력부터 여러 구성 요소를 거쳐 결과까지 이어지는 시험이다. 모든 시험을 E2E로 만들면 느리고 장애 원인을 찾기 어렵다. 작은 규칙은 빠르게 반복하고 DB·서명·브라우저에서만 확인할 수 있는 사실을 각 경계의 시험으로 보충한다.

LocalStack·MinIO 같은 로컬 저장소를 사용한다면 제품명·버전·활성 기능을 기록한다. S3 호환이라는 이유만으로 조건부 Complete·체크섬·IAM·버전 관리 동작이 모두 같다고 가정하지 않는다. 중요한 어댑터 계약은 실제 대상 서비스에서도 확인해야 한다.

### 3.3 실패를 ‘효과 전’, ‘효과 후 응답 전’, ‘commit 후 응답 전’으로 나눈다

**실패 주입(fault injection)**은 특정 위치에서 오류·지연·응답 유실을 의도적으로 만들어 복구 동작을 확인하는 방법이다. 아래 세 상황은 같은 예외 이름으로 묶지 않는다.

```text
A. 저장 호출 전에 오류
   요청 → 오류                         # 원격 효과가 없는 상황을 모델링

B. 원격 저장 뒤 응답을 버림
   요청 → 저장 완료 → 응답 유실         # 파일은 있고 호출자는 결과를 모름

C. DB 확정 뒤 앱 응답을 버림
   검증 → DB commit → 응답 유실         # 같은 ID·버전 재요청으로 현재 결과 조회
```

B를 시험하려고 저장 대역에 `throw`만 넣으면 A를 시험한 셈이다. 먼저 대역의 저장 효과를 수행하고 그 다음 응답을 버려야 한다. C도 서비스가 commit하기 전에 던진 오류라면 rollback 시험이지 commit 뒤 응답 유실 시험이 아니다.

실제 S3 Multipart Complete는 HTTP 200 헤더를 먼저 보낸 뒤 본문에 오류를 담을 수 있다. SDK는 이 오류를 처리하므로 정상 SDK 반환과 예외를 구분한다. 이것은 ‘조립은 성공했지만 정상 응답을 관찰하지 못한 상황’과도 별개다. [CompleteMultipartUpload의 응답 처리](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html)

⚠️ 주의: SDK 재시도가 켜져 있으면 첫 오류가 내부 재시도로 가려질 수 있다. 시험의 재시도 횟수·실패 주입 횟수·최종 관찰을 기록한다. 대역의 메서드 호출 횟수와 실제 HTTP 요청 수를 같은 값으로 취급하지 않는다.

### 3.4 TypeScript 실패 주입기는 저장 효과를 보존하고 응답만 잃게 한다

다음 `upload-test-faults.ts`는 **테스트 프로젝트에 추가하는 도구 파일 전체**다. 운영 코드나 전역 fetch를 바꾸지 않고, 이전 전송 함수가 받는 `transport` 매개변수에 주입한다. `inner`는 테스트가 만든 메모리 transport이며 실제 AWS 호출을 넣지 않는다.

`loseOneSuccessfulResponse`는 처음 관찰한 정상 HTTP 응답 하나만 버린다. 4xx·5xx 응답과 원래 예외는 보존한다. `oneShotGate`는 진행 지점에 도착했다는 신호와 계속 진행하라는 신호를 분리한다. 이런 신호를 **latch**라고 부르며, 임의 시간만큼 기다리는 대신 작업 순서를 정하는 데 쓴다.

```typescript
export class OutcomeUnknown extends Error {
  constructor() {
    super("테스트에서 정상 응답을 버렸습니다."); // URL·파일 원문을 오류에 남기지 않는다.
    this.name = "OutcomeUnknown";
  }
}

export function loseOneSuccessfulResponse(inner: typeof fetch): typeof fetch {
  let armed = true; // 이 도구 인스턴스마다 정상 응답 하나만 잃는다.
  return async (input, init) => {
    const response = await inner(input, init); // 먼저 저장 대역의 효과까지 끝낸다.
    if (armed && response.ok) {
      armed = false; // 예외 전에 소모하여 다음 정상 응답은 그대로 돌려준다.
      throw new OutcomeUnknown(); // 저장 결과를 취소하지 않고 호출자의 관찰만 끊는다.
    }
    return response; // HTTP 오류 응답도 원형대로 전달한다.
  };
}

function latch(): { promise: Promise<void>; release: () => void } {
  let release!: () => void; // 아래 Promise 생성자가 즉시 실행되어 함수를 채운다.
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release }; // release를 다시 호출해도 이미 완료한 Promise는 바뀌지 않는다.
}

export function oneShotGate() {
  const arrival = latch(); // 작업이 지정 지점에 왔는지 관찰한다.
  const permission = latch(); // 테스트가 허용할 때까지 그 지점에서 멈춘다.
  return {
    entered: arrival.promise,
    async wait(): Promise<void> {
      arrival.release();
      await permission.promise; // 바쁜 반복이나 고정 sleep 대신 신호를 기다린다.
    },
    release: permission.release,
  };
}
```

직접 PUT을 시험할 때는 메모리 transport가 File의 바이트와 가짜 버전 ID를 기록한 뒤 200 응답을 만든다. 위 도구로 감싸면 이전 `putDirect`는 `ReconcileRequired`로 끝나지만 메모리 저장 결과는 남는다. 이때 저장 바이트·해시·호출 수 1회를 함께 확인해야 “응답만 잃은 상황”을 만들었다고 할 수 있다.

part 전송도 같은 방법으로 시험한다. 저장 대역은 `(시도 ID, part 번호)`를 key로 사용하고 따옴표를 포함한 ETag·체크섬을 반환한다. 첫 응답을 잃으면 앱 receipt는 아직 없고 원격 대역의 part는 있다. 같은 범위·체크섬으로 재전송하여 받은 최신 receipt를 대조하되, 그 결과를 최종 객체 생성이나 READY로 해석하지 않는다.

진행 중 요청을 `gate.wait()`에서 멈추면 테스트는 `entered`를 기다렸다가 취소 의도를 기록하고 `release()`로 늦은 효과를 진행시킬 수 있다. 대역이 AbortSignal을 무시하게 만드는 것은 일부러 고른 원격 작업 모델이다. 실제 브라우저 fetch가 취소 뒤 정상 응답을 반환한다고 주장하는 시험이 아니다.

### 3.5 DB 실험은 앱의 전체 통합 테스트와 분리하여 준비한다

**fixture**는 시험에 사용할 입력과 준비 상태다. 이번 DB fixture는 새 UUID의 접수 행과 테스트 전용 PostgreSQL 컨테이너다. 기존 계정의 운영 DB URL이나 실제 버킷에 연결하지 않는다.

아래는 조건부 완료 SQL의 동작을 관찰하는 **독립 JDBC 실험 프로젝트**다. Spring Context·Controller·Repository를 실행하지 않으므로 앱 서비스 통합 시험을 대체하지 않는다. 작은 실험으로 DB 동작을 확인한 뒤 실제 프로젝트의 Flyway 스키마와 Repository를 같은 시나리오에 연결한다.

Java 21을 실행할 수 있는 Gradle Wrapper(8.5 이상)와 Docker 호환 컨테이너 실행 환경을 먼저 준비한다. Testcontainers는 시험 중 임시 PostgreSQL 컨테이너를 생성하고 종료한다. 아래 설정은 기존 Boot 프로젝트의 BOM을 강제로 바꾸라는 뜻이 아니라 별도 실험용 `build.gradle` **전체**다. [Gradle Java 호환성](https://docs.gradle.org/current/userguide/compatibility.html), [Testcontainers PostgreSQL 모듈](https://java.testcontainers.org/modules/databases/postgres/)

```groovy
plugins { id 'java' } // Spring Boot 없이 JDBC·JUnit으로 범위를 좁힌다.
repositories { mavenCentral() }
java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }

dependencies {
    testImplementation platform('org.junit:junit-bom:5.11.4') // Jupiter·Platform 버전을 맞춘다.
    testImplementation 'org.junit.jupiter:junit-jupiter'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher' // Gradle의 테스트 실행에 사용한다.
    testImplementation 'org.testcontainers:testcontainers-postgresql:2.0.5'
    testRuntimeOnly 'org.postgresql:postgresql:42.7.7' // DriverManager가 읽을 JDBC 드라이버다.
}
test { useJUnitPlatform() } // JUnit Jupiter 테스트를 발견하고 실행한다.
```

JUnit 구성은 [5.11.4 안내](https://docs.junit.org/5.11.4/user-guide/#running-tests-build-gradle), pgJDBC 고정 버전은 [42.7.7 릴리스 소스](https://github.com/pgjdbc/pgjdbc/tree/REL42.7.7)와 맞춘다. Testcontainers 2.x 예제는 `org.testcontainers.postgresql.PostgreSQLContainer`를 사용한다. 1.x의 패키지·artifact 이름을 무조건 섞지 않는다. [2.0.5 클래스 원문](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/postgresql/src/main/java/org/testcontainers/postgresql/PostgreSQLContainer.java)

컨테이너 이미지는 `postgres:17`을 사용하여 DB 주 버전을 맞춘다. 이 태그는 패치 버전까지 고정하지 않으므로 CI에서는 실제 이미지 digest·DB 버전을 시험 기록에 남기고 승인한 이미지로 고정한다. 실행 환경을 준비하지 않은 상태에서 ‘컨테이너라서 실행 결과가 보장된다’고 생각하지 않는다.

### 3.6 실제 PostgreSQL에서 완료 경쟁·취소·rollback을 확인한다

다음 `src/test/java/com/example/upload/UploadCompletionJdbcTest.java`는 **테스트 파일 전체**다. 교육용 `completion_probe` 테이블은 47번 완료 SQL에 필요한 컬럼만 담는다. 46번의 전체 제약·검사 claim·대용량 이력·인가 서비스가 생략된 좁은 실험이며 운영 테이블에 적용하는 DDL이 아니다.

`complete`의 version·길이·해시는 **검증자가 이미 확인한 결과를 대신한 fixture 값**이다. 이 테스트에서 S3 HEAD/GET 검증을 수행하지 않는다. SQL이 바인딩 값을 올바르게 대조하는지를 시험하며, 검증하지 않은 HTTP 입력을 완료 SQL에 넣어도 된다는 뜻이 아니다.

```java
package com.example.upload;

import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.junit.jupiter.api.Assertions.*;

@Execution(ExecutionMode.SAME_THREAD) // 테스트 메서드끼리는 직렬, 필요한 작업 둘만 직접 병렬 실행한다.
class UploadCompletionJdbcTest {
    private static final PostgreSQLContainer PG = new PostgreSQLContainer("postgres:17")
            .withDatabaseName("upload_probe").withUsername("probe").withPassword("test-only")
            .withUrlParam("connectTimeout", "5").withUrlParam("socketTimeout", "5");
    // 위 값은 임시 로컬 컨테이너용이다. 운영 DB 자격 증명을 받는 경로를 만들지 않는다.
    private static final String OWNER = "learner-1";
    private static final String BUCKET = "upload-probe-bucket"; // 실제 S3 버킷을 생성하지 않는다.
    private static final String HASH =
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"; // abc의 SHA-256

    @BeforeAll
    static void startDatabase() throws SQLException {
        PG.start(); // 컨테이너 실행 환경이 없으면 실패한다. 조용히 통과로 건너뛰지 않는다.
        try (var c = open(); var sql = c.createStatement()) {
            sql.execute("""
                CREATE TABLE completion_probe (
                    id uuid PRIMARY KEY, owner_subject text NOT NULL,
                    bucket_name text NOT NULL, object_key text NOT NULL,
                    state text NOT NULL CHECK (state IN ('RECEIVING','QUARANTINED','DELETE_PENDING')),
                    object_version text, byte_size bigint NOT NULL, sha256_hex text NOT NULL,
                    receive_until timestamptz NOT NULL, expires_at timestamptz NOT NULL,
                    next_scan_at timestamptz,
                    CHECK (state <> 'QUARANTINED'
                           OR (object_version IS NOT NULL AND next_scan_at IS NOT NULL))
                )
                """); // 축약 실험 스키마이며 실제 서비스의 마이그레이션을 대신하지 않는다.
        }
    }

    @AfterAll
    static void stopDatabase() { PG.stop(); } // 이 클래스가 만든 컨테이너만 종료한다.

    private static Connection open() throws SQLException {
        var c = DriverManager.getConnection(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword());
        try {
            c.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
            try (var sql = c.createStatement()) {
                sql.execute("SET statement_timeout = '3s'"); // 쿼리가 끝없이 대기하지 않게 한다.
                sql.execute("SET lock_timeout = '2s'"); // 행 잠금 대기도 별도로 제한한다.
            }
            return c; // 기본 autoCommit=true. 호출자가 명시적으로 끈 경우에만 수동 확정한다.
        } catch (SQLException failure) {
            try { c.close(); }
            catch (SQLException closeFailure) { failure.addSuppressed(closeFailure); }
            throw failure;
        }
    }

    private static String key(UUID id) { return "incoming/probe/" + id + "/body.txt"; }

    private static UUID fixture(int receiveSeconds) throws SQLException {
        UUID id = UUID.randomUUID(); // 다른 테스트의 행을 재사용·TRUNCATE하지 않는다.
        try (var c = open(); var sql = c.prepareStatement("""
                INSERT INTO completion_probe
                    (id, owner_subject, bucket_name, object_key, state, byte_size, sha256_hex,
                     receive_until, expires_at)
                VALUES (?, ?, ?, ?, 'RECEIVING', 3, ?,
                        clock_timestamp() + (? * interval '1 second'),
                        clock_timestamp() + interval '2 hours')
                """)) {
            sql.setObject(1, id); sql.setString(2, OWNER); sql.setString(3, BUCKET);
            sql.setString(4, key(id)); sql.setString(5, HASH); sql.setInt(6, receiveSeconds);
            assertEquals(1, sql.executeUpdate()); // autoCommit으로 worker 연결에도 보이는 fixture를 만든다.
        }
        return id;
    }

    private static int complete(Connection c, UUID id, String owner, String version,
                                long verifiedBytes, String verifiedHash) throws SQLException {
        try (var sql = c.prepareStatement("""
                UPDATE completion_probe
                SET object_version = ?, state = 'QUARANTINED', next_scan_at = clock_timestamp()
                WHERE id = ? AND owner_subject = ? AND bucket_name = ? AND object_key = ?
                  AND state = 'RECEIVING' AND object_version IS NULL
                  AND byte_size = ? AND sha256_hex = ?
                  AND receive_until > clock_timestamp() AND expires_at > clock_timestamp()
                """)) {
            sql.setString(1, version); sql.setObject(2, id); sql.setString(3, owner);
            sql.setString(4, BUCKET); sql.setString(5, key(id));
            sql.setLong(6, verifiedBytes); sql.setString(7, verifiedHash);
            return sql.executeUpdate(); // 0행을 무시하거나 ID만으로 다시 UPDATE하지 않는다.
        }
    }

    private record Snapshot(String state, String version, boolean scanScheduled) {}

    private static Snapshot read(UUID id) throws SQLException {
        try (var c = open(); var sql = c.prepareStatement(
                "SELECT state, object_version, next_scan_at FROM completion_probe WHERE id = ?")) {
            sql.setObject(1, id);
            try (var rows = sql.executeQuery()) {
                assertTrue(rows.next()); // 다른 연결에서 commit된 결과를 다시 읽는다.
                return new Snapshot(rows.getString(1), rows.getString(2), rows.getObject(3) != null);
            }
        }
    }

    private static int finishTogether(UUID id, String version, CountDownLatch ready,
                                      CountDownLatch go) throws Exception {
        try (var c = open()) { // 두 작업이 같은 JDBC 연결을 공유하지 않는다.
            ready.countDown();
            if (!go.await(5, TimeUnit.SECONDS)) throw new AssertionError("start gate timed out");
            return complete(c, id, OWNER, version, 3, HASH);
        }
    }

    private record Workers(ExecutorService pool, CountDownLatch go) implements AutoCloseable {
        @Override
        public void close() throws InterruptedException {
            go.countDown(); // assertion 실패 때도 대기 작업을 풀고 종료를 요청한다.
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS));
        } // try-with-resources가 본문 실패와 정리 실패를 suppressed 예외로 함께 보존한다.
    }

    @Test
    void onlyOneConcurrentCompletionWins() throws Exception {
        UUID id = fixture(3600);
        var ready = new CountDownLatch(2);
        var go = new CountDownLatch(1);
        try (var workers = new Workers(Executors.newFixedThreadPool(2), go)) {
            var a = workers.pool().submit(() -> finishTogether(id, "version-a", ready, go));
            var b = workers.pool().submit(() -> finishTogether(id, "version-b", ready, go));
            assertTrue(ready.await(5, TimeUnit.SECONDS)); // 두 연결이 준비된 뒤 함께 출발시킨다.
            go.countDown();
            int changedA = a.get(5, TimeUnit.SECONDS);
            int changedB = b.get(5, TimeUnit.SECONDS);
            assertTrue((changedA == 1 && changedB == 0) || (changedA == 0 && changedB == 1));
            assertEquals(new Snapshot("QUARANTINED", changedA == 1 ? "version-a" : "version-b", true),
                    read(id)); // 승자는 비결정적이어도 한 번만 확정한다는 결과는 결정적이다.
        }
    }

    @Test
    void duplicateDoesNotReplaceVersion() throws Exception {
        UUID id = fixture(3600);
        try (var c = open()) {
            assertEquals(1, complete(c, id, OWNER, "version-a", 3, HASH));
            assertEquals(0, complete(c, id, OWNER, "version-a", 3, HASH));
            assertEquals(0, complete(c, id, OWNER, "version-b", 3, HASH));
        }
        assertEquals(new Snapshot("QUARANTINED", "version-a", true), read(id));
        // 앱 서비스는 같은 버전의 0행을 재조회해 멱등 성공으로, 다른 버전은 충돌로 구분해야 한다.
    }

    @Test
    void ownerSizeAndHashMismatchDoNotChangeRow() throws Exception {
        UUID id = fixture(3600);
        try (var c = open()) {
            assertEquals(0, complete(c, id, "another-owner", "version-a", 3, HASH));
            assertEquals(0, complete(c, id, OWNER, "version-a", 4, HASH));
            assertEquals(0, complete(c, id, OWNER, "version-a", 3, "0".repeat(64)));
        }
        assertEquals(new Snapshot("RECEIVING", null, false), read(id));
    }

    @Test
    void expiredReceptionDoesNotBecomeQuarantined() throws Exception {
        UUID id = fixture(-60); // 실제로 1분을 기다리는 대신 이미 지난 DB 기한을 준비한다.
        try (var c = open()) {
            assertEquals(0, complete(c, id, OWNER, "version-a", 3, HASH));
        }
        assertEquals(new Snapshot("RECEIVING", null, false), read(id));
        // 만료 정리 작업이 상태를 바꾸는지는 별도 시험이다. 여기서는 신규 완료 차단만 확인한다.
    }

    @Test
    void cancellationWinsBeforeLateCompletionUpdate() throws Exception {
        UUID id = fixture(3600);
        var checked = new CountDownLatch(1);
        var go = new CountDownLatch(1);
        try (var workers = new Workers(Executors.newSingleThreadExecutor(), go)) {
            var late = workers.pool().submit(() -> {
                checked.countDown(); // 실제 S3 검증 대신 그 직후의 진행 지점을 모델링한다.
                if (!go.await(5, TimeUnit.SECONDS)) throw new AssertionError("late gate timed out");
                try (var c = open()) { return complete(c, id, OWNER, "version-a", 3, HASH); }
            });
            assertTrue(checked.await(5, TimeUnit.SECONDS));
            try (var c = open(); var sql = c.prepareStatement(
                    "UPDATE completion_probe SET state = 'DELETE_PENDING' WHERE id = ?")) {
                sql.setObject(1, id);
                assertEquals(1, sql.executeUpdate()); // 삭제 의도를 별도 연결에서 먼저 commit한다.
            }
            go.countDown(); // 그 뒤에 오래된 검증 결과의 UPDATE를 도착시킨다.
            assertEquals(0, late.get(5, TimeUnit.SECONDS).intValue());
            assertEquals(new Snapshot("DELETE_PENDING", null, false), read(id));
        }
    }

    @Test
    void failureAfterSqlBeforeCommitRollsBack() throws Exception {
        UUID id = fixture(3600);
        assertThrows(IOException.class, () -> {
            try (var c = open()) {
                c.setAutoCommit(false); // UPDATE 성공과 commit 성공을 분리한다.
                try {
                    assertEquals(1, complete(c, id, OWNER, "version-a", 3, HASH));
                    throw new IOException("injected before commit");
                } catch (IOException failure) {
                    c.rollback(); // S3의 효과를 지우는 것이 아니라 이번 DB 변경만 취소한다.
                    throw failure;
                }
            }
        });
        assertEquals(new Snapshot("RECEIVING", null, false), read(id));
    }
}
```

첫 테스트는 두 연결이 출발하도록 한 뒤 서로 다른 버전의 완료를 경쟁시킨다. 어느 요청이 이기는지는 고정하지 않고, `1행 + 0행`과 승자 버전·검사 예약을 검사한다. 시작 신호를 맞췄다고 두 SQL이 정확히 같은 CPU 시각에 실행되었다는 뜻은 아니며, 특정 잠금 대기 자체를 증명하려면 DB의 대기 상태 관찰도 추가해야 한다.

PostgreSQL Read Committed의 UPDATE는 경쟁 중인 갱신을 기다린 뒤 새 행에 WHERE 조건을 다시 평가한다. 그래서 먼저 확정한 요청이 state를 바꾸면 뒤 요청은 RECEIVING 조건을 잃는다. 단순한 메모리 Map을 통과한 결과를 이 DB 동작의 증거로 대신하지 않는다. [PostgreSQL 17 Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

취소 테스트는 순서를 더 엄격하게 고정한다. 검증 직후 지점 → 삭제 의도 commit → 늦은 완료 UPDATE 순서이므로, 정상 기한이 충분히 남아 있어도 state 조건 때문에 0행이어야 한다. 마지막 테스트는 SQL이 1행을 바꾸었어도 commit 전 오류와 rollback 뒤에는 다른 연결에서 그 결과를 볼 수 없어야 한다.

독립 Java 실험 프로젝트 루트에서 아래를 실행한다. 이번 작업에서는 실행하지 않았으며, **예상 결과는 테스트 6개 통과**다. TIL 저장소에는 이 실험의 Gradle Wrapper가 없으므로 저장소 루트에서 실행하는 명령이 아니다.

```powershell
.\gradlew.bat test --tests com.example.upload.UploadCompletionJdbcTest
```

### 3.7 실제 서비스 시험에서는 이력·트랜잭션·시간을 더 연결한다

위 실험이 통과해도 실제 Repository가 같은 WHERE 조건을 사용하는지, 검증 결과가 올바르게 바인딩되는지, 인증 결과를 owner로 넣는지는 아직 모른다. 실제 서비스 시험에서는 운영과 같은 Flyway 스키마를 테스트 DB에 적용하고 서비스·Repository를 실제로 연결한다. S3 어댑터만 gate·실패 위치를 조종할 수 있는 대역으로 바꾸면 DB 정합성과 복구 순서를 집중해서 시험할 수 있다.

Spring 테스트 전체를 `@Transactional`로 감싸면 fixture commit·별도 worker 연결·실제 서비스 commit을 관찰하려는 목적과 어긋날 수 있다. Spring의 테스트 트랜잭션은 현재 스레드에 연결되며 다른 스레드의 작업을 자동 rollback하지 않는다. 특히 선점형 timeout으로 테스트를 다른 스레드에서 실행하는 방식도 주의한다. [Spring 테스트 트랜잭션과 스레드](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)

fixture는 worker 시작 전에 확정하고, 결과는 서비스 호출이 끝난 뒤 새로운 연결에서 읽는다. 외부 작업을 기다리는 동안 DB 행 잠금을 잡아 두지 않는다. latch·Future의 대기에는 상한을 두고 `finally` 또는 try-with-resources에서 gate 해제·작업 종료·연결 반환을 확인한다. timeout 실패를 잡아서 정상 경로처럼 계속 진행하면 순서를 통제했다는 증거가 사라진다.

검사 worker의 오래된 결과는 별도 시나리오로 확장한다. token A로 claim한 작업을 멈추고 lease 만료·복구·token B의 새 claim을 확정한 뒤 A의 결과를 도착시킨다. `대상 버전·해시·정책·token·유효 lease·파일 기한` 조건을 만족하지 못한 A의 갱신은 0행이어야 하며, B의 현재 권한·상태가 보존되어야 한다.

시간 시험에는 시계도 둘이다. Java 정책에 주입한 Clock을 이동해도 SQL의 `clock_timestamp()`가 함께 이동하지는 않는다. DB 기한 시험은 이미 지난 fixture를 사용하고, `now == leaseUntil` 같은 정확한 경계 비교는 고정 Clock으로 순수 정책을 따로 시험한다. 실제 스키마의 `created_at < receive_until` 제약이 있다면 생성 시각도 과거로 맞추어 정상적인 만료 fixture를 만든다. 임의 sleep 한 번으로 두 시간 체계의 경계를 모두 검증했다고 말하지 않는다.

### 3.8 S3 계약과 브라우저 계약은 서로 다른 환경에서 확인한다

**계약 시험(contract test)**은 어댑터가 외부 API의 요청·응답·오류 규칙을 올바르게 처리하는지 확인하는 시험이다. 실제 S3를 사용하는 시험은 전용 계정/버킷 또는 명시적으로 격리한 테스트 영역·최소 권한·비용 한도·정리 이력을 준비한 뒤 수행한다. 운영 버킷의 CORS·Lifecycle을 실패 시험 때문에 덮어쓰지 않는다.

아래는 이전 업로드 어댑터에 적용할 **후속 시험 절차**이며 이번 작업에서 실제 S3 호출을 수행한 결과가 아니다.

| 시험 | 자극 | 독립적으로 확인할 결과 |
| --- | --- | --- |
| 서명한 직접 PUT | 원본 File·서명 헤더 전송, 별도 case에서 서명 헤더 변조 | 정상 case의 고정 버전·바이트; 변조 case의 거절 |
| part 계획·페이지 | 17MiB를 8·8·1MiB로 전송, ListParts의 maxParts를 2로 제한 | 두 페이지 전체와 영속 receipt가 일치; 누락 페이지로 조립하지 않음 |
| 무결성 위반 | 한 part의 다른 바이트·체크섬, 잘못된 ETag 제출 | S3 오류와 앱 거절을 구분; 최종 파일을 승인하지 않음 |
| Complete 정상 반환 | 정상 manifest로 SDK 호출 | versionId·총길이·접수/시도 메타데이터·고정 GET 바이트 대조 |
| Complete 응답 유실 | 테스트 어댑터에서 실제 SDK 정상 반환 뒤 결과를 버림 | 원격 객체는 있음; 기존 시도의 후보 버전을 검증하여 복구 |
| HTTP 200 내부 오류 | 로컬 HTTP stub에서 200 + Error XML 반환, SDK 최대 시도 수 1(재시도 0)로 제한 | SDK가 정상 결과로 반환하지 않음; versionId를 확정하지 않음 |
| HEAD 이후 새 버전 | 검증 지점 사이 같은 key에 다른 버전 생성 | GET·DB가 처음 고정한 버전을 유지; ‘최신’으로 바뀌지 않음 |
| Complete·Abort 경쟁 | 두 호출의 출발 지점을 제어하고 결과 수집 | 취소된 접수는 승인되지 않음; 미완료 part와 완성 객체를 따로 대조 |

페이지 시험에서는 응답의 `IsTruncated`와 다음 marker를 끝까지 따라갔는지 확인한다. 테스트용으로 페이지 크기를 줄이면 1,000개가 넘는 part를 만들지 않고도 같은 순회 경로를 시험할 수 있다. [ListParts의 페이지 크기·marker](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html)

200 내부 오류 시험의 stub 응답은 예를 들어 아래 **설명용 XML 본문**이다. 테스트 서버가 HTTP 200으로 돌려주는 것이며, S3에서 이 오류를 실제로 유발했다는 뜻이 아니다.

```xml
<Error>
  <Code>InternalError</Code>
  <Message>Injected completion failure</Message>
  <RequestId>test-request-49</RequestId>
</Error>
```

SDK의 endpoint·재시도 설정은 이 stub 시험에서만 바꾸고 실제 서명·권한 시험과 분리한다. 이 stub은 SDK의 오류 본문 처리 경로를 검증한다. S3가 언제 그 오류를 발생시키는지까지 증명하지는 않는다. [Complete의 200 내부 오류·SDK 처리](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html)

Abort와 진행 중 part의 결과도 단정하지 않는다. S3는 이미 진행 중인 part가 Abort 뒤 성공하거나 실패할 수 있다고 설명한다. 시험에서 특정 결과 하나만 강요하기보다, 관찰된 part·완성 객체를 기록하고 어느 경우에도 취소된 접수를 READY로 만들지 않는지 확인한다. [Abort와 잔여 part 대조](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html)

브라우저 시험은 실제 화면 출처에서 수행한다. 올바른 CORS 설정에서는 PUT과 응답의 versionId/ETag·체크섬을 읽을 수 있어야 한다. 별도 테스트 환경에서 ExposeHeaders를 빠뜨리면 원격 저장이 끝나도 화면이 해당 헤더를 읽지 못하는 경우를 관찰하고 기존 ID 대조 흐름을 확인한다. `AllowedOrigins`·요청 헤더 허용·응답 헤더 노출을 다른 규칙으로 검사한다. [S3 CORS 요소](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html)

Node fetch에 Response 객체를 반환하는 대역은 CORS를 구현하지 않는다. curl 성공이나 메모리 응답의 헤더 접근 성공을 브라우저 시험 결과로 대신하지 않는다. 서명 URL·개인 파일·인증 헤더가 브라우저 추적 파일이나 테스트 보고서에 남지 않도록 수집 범위도 확인한다.

### 3.9 복구는 응답이 아니라 최종 기록과 잔여 자원을 대조하여 판정한다

완료 응답을 잃은 뒤 같은 ID로 조회했을 때 SCANNING이라면 “접수가 없었다”고 판단하여 새 업로드를 만들지 않는다. 이미 확정한 버전과 현재 상태를 돌려주고, 검사를 초기화하지 않아야 한다. 같은 버전의 재요청과 다른 버전의 충돌을 각각 시험한다.

프로세스가 정말 중단된 상황은 메서드의 예외와 다르다. 별도 프로세스 시험에서는 저장/commit 직후의 신호를 관찰하고 프로세스를 종료한 뒤, **같은 DB·같은 저장 영역**을 사용하는 새 프로세스에서 대조를 시작한다. `finally`가 실행될 것을 전제로 복구가 성공했다면 강제 종료 복구까지 증명한 것이 아니다.

시험 기록은 최소한 아래 세 묶음을 연결한다.

- 입력: 시험 ID·접수 ID·시도 ID·part 계획·예상 길이/해시·고른 실패 위치.
- 실행: 어느 작업이 먼저 확정되었는지, 실패/재시도 횟수, DB 영향 행 수, 안전한 S3 요청 ID.
- 결과: 현재 상태·확정 버전·고정 GET의 실제 길이/해시·남은 MPU/객체 버전·정리 이력.

해시·식별자도 필요 이상으로 공개하지 않고 접근 제한된 시험 기록에 둔다. 파일 원문·서명 URL·쿠키·토큰은 증거 목록에 포함하지 않는다. “파일 건수 1개”만 맞추면 잘못된 버전 1개로도 통과할 수 있으므로 실제 바이트와 업무 상태까지 대조한다.

정리 역시 시험의 일부다. 실행 전에 `runId/caseId`별로 자신이 만들 대상과 세션을 기록하고, 진행 작업을 종료/대조한 후 자신이 만든 MPU·정확한 객체 버전만 정리한다. 전용 버킷이라도 전체 삭제 명령을 기본 cleanup으로 사용하지 않는다. 지연된 PUT·응답을 잃은 Create·이미 완성된 객체처럼 불확실성이 남으면 정리 대기로 기록하고 추가 대조한다.

⚠️ 주의: assertion 실패 뒤 teardown 오류가 원래 실패를 가릴 수 있다. 최초 실패와 cleanup 실패를 함께 보존한다. 정리 오류를 무시해서 초록색 테스트로 만들지 않고, 남은 자원의 식별자·안전한 재처리 경로를 남긴다.

### 3.10 이번에 실행한 범위와 앞으로 실행할 범위를 구분한다

이 저장소의 [실패 주입 회귀 검사](../../scripts/test_upload_failure_injection.mjs)는 본문 TypeScript 도구와 47·48번 전송 함수를 Markdown에서 읽어 실행한다. 전송 코드를 테스트용으로 다시 복사하지 않으며, 메모리 transport만 사용한다. Node.js 24.16.0의 타입 제거 기능으로 런타임을 시험하므로 `tsc --noEmit` 정적 타입 검사와는 다르다.

저장소 루트에서 아래 명령을 실행한다. 이번에는 **실패 주입 테스트 9개가 통과**했다. 효과 전 오류·효과 뒤 응답 유실·한 번만 실패시키기·part 재전송·다른 파일 거절·gate 순서를 확인했다. 이 결과는 이전 전송 함수와 메모리 대역의 동작에 대한 것이며 실제 DB·S3 결과가 아니다.

기존 직접 PUT 9개와 multipart 도우미 9개도 통과하여 메모리 기반 클라이언트 검사 총 27개를 확인했다. 문서 도구의 Python 테스트 10개와 문서 정적 검사도 통과했다. Node 타입 제거 API는 실험적 경고를 출력했으며 이 경고와 테스트 성공 여부를 구분했다.

```powershell
# 실제 AWS 요청 없이 본문과 기존 노트의 TypeScript 코드를 검사한다.
node --test scripts/test_upload_failure_injection.mjs
# 기존 전송 도우미의 회귀 검사도 함께 실행한다.
node --test scripts/test_direct_upload_example.mjs
node SpringBoot/48_11_01_S3_Multipart_Upload_and_Resume/check_client.mjs
# Markdown 링크·펜스·집계와 문서 도구를 검사한다.
python scripts/check_notes.py
python -B -m unittest discover -s scripts -p 'test_*.py' -v
git diff --check
```

Java 21 컴파일러·Gradle·Docker·psql은 PATH에서 확인되지 않아 위 JDBC/JUnit 6개 시험은 실행하지 않았다. 실제 서비스의 인증·Repository 배선, 실제 S3 저장/삭제·IAM·SDK HTTP stub·브라우저 CORS·프로세스 강제 종료 시험도 수행하지 않았다. 3.8의 표는 후속 시험 계획이며 실행 성과가 아니다.

문서 검사 통과는 링크·펜스·집계·공백 문제가 발견되지 않았다는 뜻이다. Java 컴파일·PostgreSQL 잠금 동작·실제 S3 계약·전체 시스템의 장애 복구를 보장하지 않는다. 시험 결과를 남길 때도 무엇이 실제이고 무엇이 대역이었는지를 같은 문장에 적는다.

## 4. 적용 관점에서 다시 보기

업로드 테스트를 시작할 때는 성공 응답보다 지켜야 할 조건과 관찰할 저장 결과부터 정한다. 계산·전송 도우미는 작은 시험으로, DB의 경쟁과 rollback은 실제 DB로, 서명·체크섬·200 내부 오류는 어댑터 계약으로, CORS와 사용자 복구는 브라우저로 나누어 확인한다.

불확실한 결과를 검증하려면 실패 위치를 고정한다. 효과 전에 끊긴 요청과 저장 뒤 응답만 잃은 요청을 각각 만들고, 같은 ID의 재조회·재요청이 버전 교체나 새 업로드 생성으로 이어지지 않는지 확인한다. 경쟁은 latch로 순서를 통제하고 마지막 UPDATE의 영향 행 수와 새 연결의 상태를 대조한다.

시험이 끝났다는 판단에는 결과와 정리도 포함한다. 검증한 버전·실제 바이트·현재 접근 상태가 맞는지 확인하고, 남은 part·객체·진행 작업을 시험 이력과 연결한다. 대역·DB·S3·브라우저 중 실행하지 않은 경계를 결과 보고에서 명확히 분리한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

관찰한 오류와 실제 효과는 다른 사실이다. 실패 위치와 작업 순서를 통제하고 DB·객체 버전·바이트·현재 상태를 함께 읽어야, 재시도와 복구가 업무 규칙을 지킨다는 증거를 만들 수 있다.

### 5.2 이전·다음 학습과의 연결

[직접 업로드](../47_10_31_Presigned_Direct_Upload_and_Completion_Verification/10_31_Presigned_Direct_Upload_and_Completion_Verification.md)와 [Multipart Upload](../48_11_01_S3_Multipart_Upload_and_Resume/11_01_S3_Multipart_Upload_and_Resume.md)의 미실행 시나리오를 시험 범위·실패 위치·관찰 증거로 나누었다. 다음 [비동기 작업 상태 조회·폴링과 SSE](../50_11_03_Async_Status_Polling_and_SSE/11_03_Async_Status_Polling_and_SSE.md)에서는 검사 대기·진행·완료·실패를 사용자 화면에 전달하는 흐름으로 연결한다.

### 5.3 더 파볼 만한 주제

무작위 실행 순서와 입력을 생성하는 속성 기반 시험, 실제 네트워크 경로의 단절·지연, 새 프로세스에서의 복구 시험으로 확장할 수 있다. 다만 반복 횟수를 늘리는 것과 어떤 불변 조건·실패 경계를 검증했는지 설명하는 것은 별개의 일이다.

### 5.4 참고 자료

- [S3 CompleteMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html), [ListParts](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html) — 정상 조립·200 내부 오류·SDK 오류 처리·NoSuchUpload·페이지 순회.
- [S3 AbortMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html), [S3 CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html) — 진행 중 part와 잔여 정리, 실제 브라우저의 요청·응답 헤더 규칙.
- [PostgreSQL 17 트랜잭션 격리](https://www.postgresql.org/docs/17/transaction-iso.html) — Read Committed의 경쟁 갱신·조건 재평가.
- [Spring 테스트 트랜잭션](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html) — 테스트 관리 트랜잭션·스레드·선점형 timeout 주의.
- [Testcontainers PostgreSQL](https://java.testcontainers.org/modules/databases/postgres/), [수동 생명주기](https://java.testcontainers.org/test_framework_integration/manual_lifecycle_control/), [2.0.5 PostgreSQLContainer](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/postgresql/src/main/java/org/testcontainers/postgresql/PostgreSQLContainer.java) — 모듈 좌표·패키지·시작과 종료.
- [JUnit 5.11.4](https://docs.junit.org/5.11.4/user-guide/), [pgJDBC 42.7.7](https://github.com/pgjdbc/pgjdbc/tree/REL42.7.7), [Gradle Java 호환성](https://docs.gradle.org/current/userguide/compatibility.html) — 예제의 테스트 구성·고정 의존성·실행 조건.
- [Node TypeScript 실행](https://nodejs.org/api/typescript.html) — 타입 제거는 타입 검사가 아니라는 구분.
- [실패 주입 회귀 검사](../../scripts/test_upload_failure_injection.mjs) — 실제 노트의 전송 함수를 사용하는 메모리 시험; 실제 DB·S3 시험과 별개.

## 6. 요약 정리

- 불변 조건과 관찰할 DB·버전·바이트를 먼저 정하고 테스트를 작성한다.
- 대역·실제 DB·S3 어댑터·브라우저는 서로 다른 계약을 확인한다.
- 요청 전 실패·저장 후 응답 유실·DB commit 후 응답 유실을 구분한다.
- 응답 유실 시험은 먼저 효과를 만들고 응답만 버려야 한다.
- latch로 실행 순서를 고정하고 대기·쿼리·작업 종료에 상한을 둔다.
- 완료 경쟁은 영향 행 수뿐 아니라 확정 버전·현재 상태를 새 연결에서 대조한다.
- 0행 결과는 중복 성공·만료·취소·다른 버전 충돌을 재조회하여 구분한다.
- 실제 S3의 오류·버전·체크섬과 브라우저 CORS는 각 환경에서 따로 확인한다.
- 정리 이력과 미실행 범위까지 남겨야 결과를 과장하지 않고 복습할 수 있다.

🧠 기억할 것: **오류 메시지는 관찰이고, 복구의 증거는 같은 접수에 남은 상태·버전·바이트다.**

## 7. 미니 퀴즈 또는 체크리스트

1. S3 저장 대역에서 호출하자마자 예외를 던지는 시험만으로 ‘저장 후 응답 유실’을 검증할 수 있는가?
2. 완료 SQL이 두 요청에서 각각 1행·0행을 반환했다. 0행 요청은 항상 HTTP 409여야 하는가?
3. 검증 직후 삭제 의도를 commit하고 늦은 완료 결과를 도착시켰다. 무엇을 검사해야 하는가?
4. Java Clock을 10분 뒤로 옮기면 PostgreSQL의 clock_timestamp()도 함께 이동하는가?
5. Node에서 만든 Response의 ETag를 읽는 테스트가 통과했다. 실제 브라우저의 CORS도 통과했다고 말할 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 아니다. 그것은 효과 전 실패다. 저장 결과를 먼저 기록한 뒤 정상 응답을 버리고, 호출자는 오류를 보지만 저장 결과는 남아 있는지 확인해야 한다.
2. 아니다. 같은 소유자·같은 확정 버전의 중복이면 현재 상태를 돌려줄 수 있다. 다른 버전·취소·만료 등은 현재 행을 다시 읽어 구분하고, 0행이라고 조건 없는 UPDATE를 해서는 안 된다.
3. 마지막 조건부 완료가 0행이며 DELETE_PENDING 상태를 유지하는지 검사한다. 비공개 객체가 남을 수 있으므로 접근 차단과 실제 버전 정리도 별도로 확인한다.
4. 아니다. Java 시계와 DB 시계는 별개다. 정책의 정확한 경계는 고정 Clock으로, DB 기한은 이미 지난 fixture 등으로 따로 시험한다.
5. 아니다. 메모리 Response는 브라우저 출처 규칙을 구현하지 않는다. 실제 화면 출처에서 preflight·PUT·ExposeHeaders를 확인하고, 응답 헤더를 읽지 못하는 경우의 대조 흐름도 시험한다.

</details>
