# 파일 다운로드 API·스트리밍과 접근 제어

- 🎯 글의 목표: READY 산출물의 권한과 고정 버전을 확인하고, HTTP 헤더·스트림 수명·전송 실패를 구분하여 다운로드를 제공한다.
- 🧩 핵심 키워드: 인증·객체별 인가, READY, versionId, StreamingResponseBody, Content-Disposition, Content-Length, abort, 사전 서명 URL
- ⭐ 중요도: 높음. 업로드가 성공했어도 다른 사용자의 파일을 제공하거나 전송 도중 연결을 방치하면 안전한 다운로드가 아니다.
- 📝 한눈에 보는 내용: 요청자와 산출물 조회 → 고정 버전 선택 → 응답 계약 → 콜백에서 스트림 열기·전송·정리 → 전송 실패 → 실행기 제한 → 사전 서명 URL 비교 → 검증
- 🔗 관련 주제: [객체 스토리지·멱등 공개](../42_10_20_Batch_Object_Storage_and_Idempotent_Publication/10_20_Batch_Object_Storage_and_Idempotent_Publication.md), [Spring Security](../11_09_07_Spring_Security_Fundamentals/09_07_Spring_Security_Fundamentals.md), [비동기·스레드 풀](../31_10_02_Async_and_Thread_Pools/10_02_Async_and_Thread_Pools.md), [외부 HTTP 실패](../13_09_09_External_HTTP_API_and_RestClient/09_09_External_HTTP_API_and_RestClient.md)
- 🧱 선수 지식: HTTP 상태·헤더·본문, Java 예외·try-with-resources, Spring MVC·Bean·인증 정보, 이전 노트의 비공개 S3 버킷·READY 공개 이력·검증한 버전을 이해한다.

> 기준일: 2026-10-23. Spring Boot 4.1.2 관리 의존성의 Framework 7.0.10·Security 7.1.2 공식 문서를 확인했다. Java 21과 AWS SDK 2.31.54를 사용하는 기존 MVC 프로젝트에 추가하는 예제다. SDK는 이전 업로드 노트의 고정 버전을 유지하며 최신 버전이라는 뜻이 아니다. DB 조회 어댑터·인증 시스템·S3 클라이언트 Bean은 프로젝트에서 제공해야 하며 전체 실행 프로젝트는 아니다. 현재 Java·javac·Maven·Gradle 명령과 해당 빌드 프로젝트가 없어 컴파일·JUnit·실제 HTTP/S3 전송은 실행하지 않았다. 아래 결과는 예상과 검증 계획으로 구분한다. [Boot 의존성 표](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)

## 1. 들어가며

이전 노트에서는 CSV의 크기·체크섬·업무 소속을 대조하고 검증한 원격 버전을 READY로 확정했다. 이제 사용자가 그 파일을 요청한다. 서버는 단순히 버킷의 키를 찾아 바이트를 보내는 것이 아니라 **이 사용자가 이 산출물을 받을 수 있는지, 무엇을 보내는지, 언제 자원을 닫는지**를 결정해야 한다.

예를 들어 READY의 versionId는 A인데 다운로드가 현재 버전 B를 읽으면 검증한 결과와 다른 파일을 제공한다. 또 큰 파일을 `readAllBytes()`로 읽으면 동시 요청마다 파일 크기만큼 메모리를 사용할 수 있다. 모든 바이트를 먼저 읽지 않더라도 사용자가 연결을 끊었는데 원격 입력을 계속 읽으면 연결·스레드를 낭비한다.

이번 범위는 UTF-8 CSV의 **전체 파일 GET 다운로드**다. 서버가 S3에서 읽어 HTTP 응답으로 중계하는 방식부터 구현하고, 사전 서명 URL과 비교한다. Range 이어받기·조건부 GET·HEAD 전용 경로·CDN·완전한 인증 시스템은 구현하지 않으며 다음 학습으로 연결한다. MVC의 GET 매핑에는 HEAD 자동 처리가 연결될 수 있으므로, 본문을 읽지 않는 저비용 HEAD와 그 자원 사용도 별도로 설계·검사해야 한다.

## 2. 핵심 개념 정리

```text
GET /exports/{exportId}/download
  → 인증된 사용자 식별
  → 사용자 소유 + READY + 제공 기간에 맞는 DB 이력 조회
  → 고정 bucket·key·versionId·bytes와 응답 헤더 준비
  → MVC 실행기가 스트리밍 콜백 실행
      → 그때 S3 GET 열기 → 버전·길이 확인 → 작은 버퍼로 전송
      → 정상: 입력 close / 예외: 입력 abort 후 close
  → 전송 관측 기록 (클라이언트 저장 완료와는 별개)
```

| 질문 | 본문 연결 |
| --- | --- |
| 로그인만 했으면 모든 exportId를 받아도 되는가? | 3.1 |
| 어느 버전을 어떤 HTTP 응답으로 보내는가? | 3.2~3.3 |
| 스트림은 언제 열고 누가 닫는가? | 3.4~3.5 |
| 시간 초과·클라이언트 종료는 어떻게 해석하는가? | 3.6~3.7 |
| 사전 서명 URL은 무엇을 위임하는가? | 3.8 |
| 어떤 동작을 단위·통합 테스트로 확인하는가? | 3.9 |

## 3. 본문 정리

### 3.1 인증과 산출물별 권한을 따로 확인한다

**인증은 요청자가 누구인지 확인하는 것**, **인가는 그 요청자가 해당 작업을 해도 되는지 판단하는 것**이다. 로그인한 사용자 A가 B의 exportId를 입력했다고 B의 파일을 제공해서는 안 된다. UUID가 추측하기 어렵더라도 접근 권한을 대신하지 않는다.

요청 수준에서는 `/exports/**`에 인증을 요구한다. 서비스·DB 조회 수준에서는 exportId와 신뢰할 수 있는 사용자 식별자, READY 상태, 제공 기간을 함께 검사한다. 이 노트는 **소유자만 다운로드할 수 있는 정책**을 선택한다. 조직 공유·관리자 대리 접근이 필요하면 별도의 권한 규칙과 감사 근거를 추가한다. [Spring Security 요청 인가](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)

예제의 조회 SQL은 다음 의미다. 이는 기존 공개 이력 스키마에 맞춰 구현할 **설명용 SQL**이며, 아래 이름의 테이블을 새로 생성하는 마이그레이션이 아니다. 사용자 값은 세션·검증된 토큰에서 얻고 요청 파라미터의 userId를 신뢰하지 않는다.

```sql
-- 실제 테이블·컬럼 이름과 공유 정책은 프로젝트 스키마에 맞춘다.
SELECT export_id, bucket, object_key, version_id, bytes
FROM export_publication
WHERE export_id = :exportId       -- 사용자가 요청한 업무 ID다.
  AND owner_subject = :subject    -- 서버의 인증 정보에서 얻은 안정적인 사용자 식별자다.
  AND state = 'READY'             -- 업로드만 끝난 미공개 결과는 제외한다.
  AND expires_at > CURRENT_TIMESTAMP; -- 예제 정책의 제공 기간도 확인한다.
```

조회 결과가 없으면 존재하지 않음·다른 소유자·미공개·만료를 이 예제에서는 모두 404로 응답한다. 존재 여부를 구분해 노출하지 않으려는 **애플리케이션 정책**이며 모든 API의 필수 규칙은 아니다. DB 장애까지 빈 결과로 바꾸면 안 된다. 인증 실패의 401, 인가 실패의 403 또는 위 정책의 404, 저장소 통신 실패를 분리한다.

⚠️ 주의: `@PreAuthorize`를 사용한다면 method security를 활성화해야 한다. Security starter가 있다는 사실만으로 메서드 인가가 자동 활성화되지는 않는다. 이번 코드는 조회 계약에서 소유자·READY를 제한하며, 어노테이션을 붙인 것처럼 가정하지 않는다. [공식 method security 설명](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)

### 3.2 READY에 기록된 특정 버전을 제공한다

**versionId는 버전 관리 버킷에서 특정 객체 버전을 지정하는 값**이다. 다운로드 요청의 버킷·키·버전은 READY 이력에서 가져온다. 클라이언트에게 임의의 bucket·key·URL을 입력받아 서버가 대신 조회하게 하지 않는다. [S3 GetObject API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html)

키만 지정하면 현재 버전이 선택될 수 있다. 검증한 버전이 삭제됐거나 읽을 권한이 없다면 다른 버전으로 대신 제공하지 않고 실패를 관찰한다. 특정 버전 조회에는 `s3:GetObjectVersion` 권한을 확인하고, S3의 403을 사용자 접근 권한 403과 같은 원인으로 단정하지 않는다.

다음은 `src/main/java/com/example/export/ReadyExport.java`의 **추가 파일 전체**다. READY 이력에서 검증된 제공 정보를 전달하는 값이지, 이 record를 생성하면 권한 검사가 완료되는 것은 아니다. 버킷·키·크기·버전의 DB 신뢰성과 이전 단계의 체크섬 검증은 조회 어댑터의 전제다.

```java
package com.example.export; // 이전 업로드 어댑터와 같은 패키지다.

import java.util.Objects; // 필수 값을 검사한다.
import java.util.UUID; // 외부 요청의 산출물 식별자다.

public record ReadyExport(UUID exportId, String bucket, String key, String versionId, long bytes) {
    public ReadyExport {
        Objects.requireNonNull(exportId, "exportId is required"); // 파일명 생성에도 사용한다.
        if (bucket == null || bucket.isBlank() || key == null || key.isBlank()) {
            throw new IllegalArgumentException("trusted bucket and key are required");
        }
        if (versionId == null || versionId.isBlank() || versionId.equals("null") || bytes < 0) {
            throw new IllegalArgumentException("a pinned version and nonnegative size are required");
        } // 이전 예제의 버전 관리 버킷·구체적인 검증 버전만 허용한다.
    }

    public String filename() {
        return "stock-" + exportId + ".csv"; // 서버가 통제하는 ASCII 파일명이며 원격 키를 노출하지 않는다.
    }
}
```

다음은 `ReadyExportLookup.java`의 **추가 인터페이스 전체**다. 프로젝트는 이를 구현한 Bean을 제공해야 한다. 실제 조회 어댑터는 앞의 SQL 의미를 구현하며, 인증 시스템의 `Authentication.getName()`이 애플리케이션 안에서 안정적·유일한 subject를 반환하도록 연결한다. 다중 발급자 환경이라면 issuer·subject 대응도 계정 모델에서 구분해야 한다.

```java
package com.example.export;

import java.util.Optional; // 제공할 수 없는 산출물은 빈 결과로 표현한다.
import java.util.UUID; // 요청한 업무 ID다.

@FunctionalInterface // 테스트에서는 같은 계약을 람다로 대체할 수 있다.
public interface ReadyExportLookup {
    Optional<ReadyExport> findDownloadable(UUID exportId, String subject);
    // 소유자·READY·제공 기간을 모두 확인한 DB 스냅샷만 반환한다.
    // 입력 버킷·키를 받지 않으며 DB 장애를 Optional.empty()로 숨기지 않는다.
}
```

### 3.3 응답 헤더는 파일의 계약이다

**Content-Type은 본문의 형식**, **Content-Disposition은 브라우저가 파일을 어떻게 취급할지와 제안 파일명**, **Content-Length는 전송할 본문의 바이트 수**를 나타낸다. 이번에는 UTF-8 CSV 전체를 attachment로 제공한다. Content-Length는 문자 개수나 `InputStream.available()`이 아니라 READY에 검증한 바이트 수다. [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266.html), [RFC 9110의 Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6)

Content-Disposition 문자열에 요청자의 파일명을 직접 이어 붙이지 않는다. 서버가 생성한 파일명과 Spring의 builder를 사용한다. 한글 파일명을 허용할 때는 charset을 지정하는 builder 등 인코딩 규칙을 적용하고 경로·줄바꿈·제어문자를 받지 않는 정책을 둔다. [ContentDisposition API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/ContentDisposition.html)

이번 응답은 `Cache-Control: no-store`로 저장 캐시를 제한하고 전체 파일만 반환한다. `Accept-Ranges: none`으로 이어받기 미지원임을 알리며 Range가 와도 부분 응답을 구현한 척하지 않고 전체 200 응답을 사용한다. 이는 서버가 Range를 무시할 수 있다는 HTTP 규칙에 맞춘 최소 범위다. [RFC 9110 Range·Accept-Ranges](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2)

압축 필터·프록시가 본문을 변환한다면 길이 헤더와 실제 전송 표현의 관계도 검사해야 한다. 이 예제는 본문을 변환하지 않는 경로를 전제로 한다. no-store가 사용자의 파일 저장 자체를 금지하거나 이미 내려받은 데이터를 회수하는 기능도 아니다.

### 3.4 스트리밍은 전체 파일을 메모리에 올리지 않고 이어 보내는 방식이다

**스트리밍은 입력의 일부를 읽어 출력에 쓰는 과정을 반복하는 것**이다. `StreamingResponseBody`는 Spring MVC가 별도 실행기에서 응답 OutputStream에 쓰게 하는 콜백이다. Servlet 요청 스레드를 계속 점유하지 않는 대신 전송 작업 스레드는 필요하며, blocking I/O가 자동으로 non-blocking I/O로 바뀌지는 않는다. [Spring MVC 비동기 응답](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html), [StreamingResponseBody API](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/StreamingResponseBody.html)

다음은 `ExportDownloadController.java`의 **추가 파일 전체**다. 기존 Boot MVC·Security·AWS S3 의존성과 `ReadyExportLookup`·유한 timeout을 설정한 `S3Client` Bean이 필요하다. SecurityFilterChain의 인증 경로, API용 401 진입점, ASYNC 재디스패치 정책은 기존 보안 구성에 통합해야 한다. 이 클래스만으로 인증 시스템·DB 조회 어댑터가 완성되는 것은 아니다.

```java
package com.example.export;

import java.io.EOFException; // 예상보다 일찍 끝난 원격 입력을 구분한다.
import java.io.IOException; // 읽기·쓰기 실패를 숨기지 않는다.
import java.io.InputStream; // 작은 버퍼로 읽는 입력 타입이다.
import java.io.OutputStream; // Servlet이 소유한 출력 타입이다.
import java.nio.charset.StandardCharsets; // CSV의 인코딩을 명시한다.
import java.util.Objects; // 응답 메타데이터를 비교한다.
import java.util.UUID; // 요청 ID의 형식을 MVC에서 검사한다.
import org.springframework.http.CacheControl; // 민감한 결과의 캐시 정책이다.
import org.springframework.http.ContentDisposition; // 직접 문자열을 합치지 않고 헤더를 만든다.
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken; // 익명 인증 객체도 제외한다.
import org.springframework.security.core.Authentication; // 서버가 확인한 사용자 정보다.
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import software.amazon.awssdk.core.ResponseInputStream; // 원격 응답과 본문 스트림을 함께 제공한다.
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

@RestController // 기존 컴포넌트 스캔 범위에 포함한다.
public class ExportDownloadController {
    private final ReadyExportLookup lookup; // 권한·READY·제공 기간을 확인할 조회 경계다.
    private final S3Client s3; // 공유 클라이언트이며 요청마다 닫지 않는다.

    public ExportDownloadController(ReadyExportLookup lookup, S3Client s3) {
        this.lookup = lookup; // 실제 DB 어댑터를 생성자 주입받는다.
        this.s3 = s3; // 인증·region·연결·timeout이 설정된 클라이언트를 받는다.
    }

    @GetMapping("/exports/{exportId}/download")
    public ResponseEntity<StreamingResponseBody> download(
            @PathVariable("exportId") UUID exportId, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED); // 직접 호출에도 익명 접근을 거절한다.
        }
        ReadyExport file = lookup.findDownloadable(exportId, authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // 여기까지는 원격 스트림을 열지 않았으며 거절한 요청은 S3에 접근하지 않는다.
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(file.bucket()).key(file.key()).versionId(file.versionId())
                .build(); // 현재 버전이 아닌 DB에서 고정한 버전을 선택한다.
        StreamingResponseBody body = output -> {
            try (ResponseInputStream<GetObjectResponse> input = s3.getObject(request)) {
                // 실제 전송 콜백이 시작됐을 때만 원격 스트림을 연다.
                try {
                    GetObjectResponse remote = input.response(); // GET 응답의 버전·크기를 확인한다.
                    if (!Objects.equals(remote.versionId(), file.versionId())
                            || !Objects.equals(remote.contentLength(), Long.valueOf(file.bytes()))) {
                        throw new IOException("remote version or length does not match READY");
                    }
                    copyExactly(input, output, file.bytes()); // 전체 배열 대신 고정 크기 버퍼를 쓴다.
                } catch (IOException | RuntimeException failure) {
                    input.abort(); // 중단된 다운로드 때문에 남은 원격 본문을 계속 읽지 않는다.
                    throw failure; // 실패를 성공 본문이나 빈 파일로 바꾸지 않는다.
                }
            } // 정상·예외 경로에서 입력을 닫는다. 출력은 Servlet이 소유하므로 직접 닫지 않는다.
        };
        String disposition = ContentDisposition.attachment().filename(file.filename()).build().toString();
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .contentLength(file.bytes()) // 전체 파일의 검증된 바이트 수다.
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition) // 서버가 통제한 파일명이다.
                .header(HttpHeaders.ACCEPT_RANGES, "none") // 이번 경로는 전체 전송만 지원한다.
                .cacheControl(CacheControl.noStore()) // 저장 캐시를 제한한다.
                .body(body); // 이 반환 시점은 클라이언트 저장 완료 시점이 아니다.
    }

    private static void copyExactly(InputStream input, OutputStream output, long expected) throws IOException {
        byte[] buffer = new byte[8192]; // 파일 크기와 무관하게 8 KiB 버퍼 하나를 사용한다.
        long remaining = expected; // 아직 전송해야 할 바이트 수다.
        while (remaining > 0) {
            int count = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (count < 0) {
                throw new EOFException("remote body ended early"); // 조기 종료를 정상 파일로 숨기지 않는다.
            }
            output.write(buffer, 0, count); // 실제 읽은 길이만 보낸다. 끊긴 연결이면 실패할 수 있다.
            remaining -= count; // 문자 수가 아닌 바이트 수로 진행한다.
        }
        if (input.read() != -1) {
            throw new IOException("remote body is longer than expected"); // 예상 밖 추가 데이터는 보내지 않는다.
        }
    }
}
```

입력의 `read(...)`는 실제 읽은 길이를 반환하며 EOF에서는 -1을 반환한다. `available()`은 전체 길이가 아니고 `readAllBytes()`는 남은 데이터를 배열로 읽으므로 이 전송에는 사용하지 않는다. [Java InputStream API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/io/InputStream.html)

예상 정상 결과는 고정 버전의 CSV와 길이·파일명 헤더다. 버전·크기 대조는 이전 단계의 SHA-256 검증을 새로 수행한 것이 아니다. 이미 보낸 바이트를 나중에 되돌릴 수 없으므로, 끝에서 길이 오류를 발견했다고 사용자에게 보낸 앞부분까지 취소되는 것도 아니다. 다운로드 자체의 종단 간 내용 검증이 필요하면 사용자에게 전달할 체크섬 계약도 별도로 설계한다.

### 3.5 스트림의 소유자와 여는 시점을 맞춘다

Controller에서 입력을 먼저 열고 `try`를 끝낸 뒤 콜백에 넘기면, 콜백이 실행될 때 이미 닫힌 입력이 될 수 있다. 반대로 열어 둔 입력을 콜백에만 넘기면 실행기 거절·타임아웃 등으로 콜백이 실행되지 않을 때 정리 경로가 없어진다. 그래서 위 코드는 **콜백 안에서 열고 같은 범위에서 닫는다**.

S3 `ResponseInputStream`은 읽은 뒤 닫아야 한다. 고정 SDK 2.31.54의 설명에 따르면 Apache HTTP 클라이언트에서 일부만 읽고 close하면 연결 재사용을 위해 남은 본문을 읽을 수 있다. 중도 실패에서는 abort로 원격 연결을 중단하는 선택을 사용한다. HTTP 클라이언트 구현별 동작 차이가 있으므로 실제 연결 풀 반환도 통합 검증한다. [2.31.54 ResponseInputStream 소스](https://raw.githubusercontent.com/aws/aws-sdk-java-v2/2.31.54/core/sdk-core/src/main/java/software/amazon/awssdk/core/ResponseInputStream.java)

입력 스트림은 이 콜백이 소유하지만 응답 OutputStream은 Servlet 컨테이너가 소유한다. 공유 S3Client도 애플리케이션 수명에 속하므로 다운로드 한 번마다 닫지 않는다. 파일 전송 동안 DB 트랜잭션을 열어 두지 않고, 권한 조회에서 얻은 작은 불변 값만 전달한다.

⚠️ 주의: 권한 조회 뒤 다운로드가 끝나기 전 권한·만료 상태가 달라질 수 있다. 이번 예제는 요청 시작 시점에 승인한 전송을 계속하는 정책이며, 즉시 회수·전송 중 취소가 필요한 업무는 별도의 상태 확인·취소 경로가 필요하다.

### 3.6 응답 commit 전후의 오류 처리는 같지 않다

**응답 commit은 상태·헤더가 실제 응답으로 확정되어 이후 자유롭게 바꿀 수 없는 시점**이다. DB 조회에서 접근을 거절하면 본문을 시작하기 전에 404를 선택할 수 있다. 하지만 일부 CSV를 보낸 뒤 JSON 오류 본문을 덧붙이거나 상태를 다른 것으로 바꾸려 해서는 안 된다.

| 실패 위치 | 이 노트에서의 판단 |
| --- | --- |
| 인증·조회 단계 | 인증 정책에 맞는 401 또는 공개 정책의 404; S3 호출 없음 |
| 콜백에서 S3 GET 열기·메타데이터 확인 | 전송 실패로 전파; HTTP 오류 매핑 가능 여부는 commit 상태에 달림 |
| 본문 일부 전송 후 읽기·쓰기 오류 | upstream abort·close, 전송 실패 관측; JSON을 이어 쓰지 않음 |
| 서버 출력 완료 뒤 클라이언트 저장 실패 | 서버 로그만으로 저장 성공을 증명할 수 없음 |

이번 코드는 원격 오류를 “원하는 JSON 오류로 언제나 변환하는 Controller”가 아니다. 예측 가능한 원격 부재를 미리 분류하려면 같은 버전의 HEAD 사전 확인을 추가할 수 있지만, HEAD 성공 뒤 GET 전 삭제·권한 변화까지 막지는 않는다. 실제 전송 오류 경로는 여전히 필요하다.

클라이언트 연결 종료는 보통 쓰기 실패를 통해 발견되며, 종료 통지가 항상 즉시 도착한다고 가정하지 않는다. 파일 전송에 임의의 heartbeat 바이트를 넣으면 CSV가 변하므로 사용하지 않는다. [Spring MVC 연결 종료 설명](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html#page-title)

전송 감사에는 subject의 비식별 내부 키·exportId·고정 버전·시도 시각·서버가 관찰한 결과를 남긴다. 이를 클라이언트의 파일 저장 완료로 이름 붙이지 않는다. 자격 증명·사전 서명 URL·파일 본문은 로그에 넣지 않는다.

### 3.7 MVC 비동기 실행기와 외부 I/O 시간을 따로 제한한다

StreamingResponseBody를 사용할 때 MVC의 AsyncTaskExecutor를 명시적으로 구성하는 것이 권장된다. 아래는 `ExportMvcConfiguration.java`의 **추가 파일 전체**이며, 기존 WebMvcConfigurer가 있다면 중복된 async 설정을 만들지 않고 통합한다. [AsyncSupportConfigurer API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/config/annotation/AsyncSupportConfigurer.html)

```java
package com.example.export;

import java.util.concurrent.ThreadPoolExecutor; // 포화를 조용히 버리지 않는 정책이다.
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration(proxyBeanMethods = false)
public class ExportMvcConfiguration {
    @Bean(name = "downloadMvcExecutor", defaultCandidate = false)
    public ThreadPoolTaskExecutor downloadMvcExecutor() {
        var executor = new ThreadPoolTaskExecutor(); // MVC 비동기 처리의 실행 자원이다.
        executor.setCorePoolSize(4); // 학습용 동시 실행 수다.
        executor.setMaxPoolSize(4); // 스레드 확장도 제한한다.
        executor.setQueueCapacity(8); // 대기 요청을 무제한 보관하지 않는다.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy()); // 포화를 예외로 알린다.
        executor.setThreadNamePrefix("download-mvc-"); // 실행 위치를 관찰한다.
        return executor; // 초기화·종료는 Spring Bean 생명주기로 관리한다.
    }

    @Bean
    public WebMvcConfigurer exportAsyncConfigurer(
            @Qualifier("downloadMvcExecutor") ThreadPoolTaskExecutor executor) {
        return new WebMvcConfigurer() {
            @Override
            public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
                configurer.setTaskExecutor(executor); // 단순 @Async 실행기 등록과 구분한다.
                configurer.setDefaultTimeout(30_000); // 비동기 요청 제한의 학습 값은 30초다.
            }
        };
    }
}
```

이 설정은 이름과 달리 `/exports` 전용 라우트 풀을 만드는 것이 아니라 **MVC 비동기 처리의 기본 실행기**를 바꾼다. 다른 비동기 응답도 영향을 받는다. 4·8·30초는 보편 권장값이 아니며 대역폭·파일 크기·원격 연결 풀·다른 API 부하를 측정해 정한다.

MVC timeout과 S3 연결·읽기 timeout은 다른 제한이다. 요청이 시간 초과되었다고 blocking 외부 호출이 반드시 즉시 중단되는 것은 아니다. 포화 거절을 운영에서 어떻게 응답·관측할지도 검증해야 하며, 이 코드가 자동으로 모든 포화를 503으로 변환하는 것은 아니다. 동시 다운로드 허가·호출 빈도·사용자별 제한은 앞선 Bulkhead·Rate Limiter 지식과 연결한다.

### 3.8 사전 서명 URL은 다운로드 권한을 URL 보유자에게 위임한다

**사전 서명 URL은 서버의 자격 증명으로 특정 요청을 일정 시간 사용할 수 있게 서명한 URL**이다. 서버가 파일 본문을 중계하지 않아 대역폭·worker 부담을 줄일 수 있지만, URL을 가진 사람이 사용할 수 있는 bearer 권한이 된다. 로그인 세션과 같은 의미의 권한이 아니다. [S3 사전 서명 URL 안내](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

아래는 이미 권한·READY·제공 기간을 확인한 `ReadyExport file`과 공유 `S3Presigner presigner`가 있는 서비스 안의 **일부 코드**다. 파일 상단에 `java.time.Duration`, `software.amazon.awssdk.services.s3.model.GetObjectRequest`, `software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest`를 import한다. Presigner의 Bean·자격 증명·region·종료 구성은 별도 책임이며 URL을 로그로 출력하지 않는다.

```java
GetObjectRequest request = GetObjectRequest.builder()
        .bucket(file.bucket()).key(file.key()).versionId(file.versionId()) // 검증한 버전만 지정한다.
        .responseContentDisposition("attachment; filename=\"" + file.filename() + "\"")
        .build(); // filename은 서버가 만든 ASCII UUID 이름만 사용한다.
GetObjectPresignRequest signRequest = GetObjectPresignRequest.builder()
        .getObjectRequest(request) // 권한 확인 없이 임의 키를 서명하지 않는다.
        .signatureDuration(Duration.ofMinutes(2)) // 학습용 짧은 사용 시간이다.
        .build();
String signedUrl = presigner.presignGetObject(signRequest).url().toString(); // 보호된 응답으로만 전달한다.
```

SDK의 생성 흐름에 고정 versionId를 추가한 예시다. 서명 URL이 있다고 대상 객체의 존재나 다운로드 성공이 보장되는 것은 아니다. 서명에 사용한 자격 증명이 먼저 만료되면 설정 시간보다 빨리 사용할 수 없게 될 수도 있다. URL 만료는 요청 시작의 허용 시간과 관련되며 이미 시작된 전송의 즉시 중단 스위치가 아니다. [Java SDK 사전 서명 예제](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/examples-s3-presign.html), [S3 만료·권한 제한](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

사용자 로그아웃이 이미 발급한 URL을 자동 무효화하거나 URL을 한 번만 쓰게 하는 것도 아니다. 이 예시에서는 서명 기간보다 READY 제공 잔여 시간이 충분한지 발급 전에 확인해야 한다. 보유 기간·객체 버전 삭제·회수 요구를 맞추고, URL이 브라우저 기록·분석 로그·공유 메시지로 유출되지 않도록 다룬다.

| 선택 | 주된 장점 | 남는 책임 |
| --- | --- | --- |
| 서버 중계 | 요청 시 애플리케이션 권한·전송 관측을 적용 | 스레드·연결·대역폭·중도 실패 |
| 사전 서명 URL | 본문 전송을 S3에 맡김 | 발급 권한·버전·유효 기간·URL 유출·회수 정책 |

### 3.9 단위 테스트와 실제 비동기 전송 검증을 구분한다

다음은 `src/test/java/com/example/export/ExportDownloadControllerTest.java`에 추가하는 **파일 전체**다. JUnit Jupiter·Mockito와 위 클래스들을 전제로 한다. 직접 Controller와 콜백을 호출하므로 Spring MVC·보안 필터·실행기·실제 S3가 동작했다는 증거는 아니다.

```java
package com.example.export;

import java.io.ByteArrayInputStream; // 원격 본문을 대신하는 메모리 입력이다.
import java.io.ByteArrayOutputStream; // 전송한 바이트를 모아 비교한다.
import java.io.IOException;
import java.io.OutputStream; // 끊긴 클라이언트 출력을 모사한다.
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean; // close·abort 여부를 관찰한다.
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ExportDownloadControllerTest {
    private static final byte[] DATA = "hello".getBytes(StandardCharsets.UTF_8); // 실제 CSV 문법 검사는 범위 밖이다.
    private static final ReadyExport FILE = new ReadyExport(
            UUID.fromString("00000000-0000-0000-0000-000000000001"), "test-private", "exports/test.csv", "v1", 5);

    @Test
    void opensOnlyInCallbackAndPinsVersionThenCloses() throws Exception {
        S3Client s3 = mock(S3Client.class); // 실제 저장소는 호출하지 않는다.
        Remote remote = remote("v1"); // 정상 버전·크기의 응답 대역이다.
        when(s3.getObject(any(GetObjectRequest.class))).thenReturn(remote.stream());
        ReadyExportLookup lookup = (id, subject) -> Optional.of(FILE); // 이 시험은 승인된 조회만 모사한다.
        var controller = new ExportDownloadController(lookup, s3);
        var response = controller.download(FILE.exportId(), user()); // 콜백만 준비한다.
        verifyNoInteractions(s3); // 아직 원격 연결을 열지 않았다.
        assertEquals(5L, response.getHeaders().getContentLength());
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertEquals(FILE.filename(), response.getHeaders().getContentDisposition().getFilename());
        var output = new ByteArrayOutputStream();
        response.getBody().writeTo(output); // 단위 테스트가 동기적으로 콜백을 실행한다.
        assertArrayEquals(DATA, output.toByteArray());
        verify(s3).getObject(argThat((GetObjectRequest request) -> request.versionId().equals("v1")));
        assertTrue(remote.closed().get()); // 정상 경로도 자원을 닫는다.
        assertFalse(remote.aborted().get()); // 정상 전송에는 중단 요청이 필요 없다.
    }

    @Test
    void hidesUnavailableExportWithoutCallingStorage() {
        S3Client s3 = mock(S3Client.class);
        var controller = new ExportDownloadController((id, subject) -> Optional.empty(), s3);
        var error = assertThrows(ResponseStatusException.class, () -> controller.download(FILE.exportId(), user()));
        assertEquals(404, error.getStatusCode().value()); // 소유자·READY 조회 결과 없음의 정책이다.
        verifyNoInteractions(s3); // 권한 거절 뒤 원격 조회를 하지 않는다.
    }

    @Test
    void rejectsMissingAuthenticationBeforeLookup() {
        S3Client s3 = mock(S3Client.class);
        ReadyExportLookup lookup = mock(ReadyExportLookup.class);
        var controller = new ExportDownloadController(lookup, s3);
        var error = assertThrows(ResponseStatusException.class, () -> controller.download(FILE.exportId(), null));
        assertEquals(401, error.getStatusCode().value());
        verifyNoInteractions(lookup, s3); // 인증 부재는 두 외부 경계에 도달하기 전에 거절한다.
    }

    @Test
    void abortsMismatchedVersionWithoutWritingBody() throws Exception {
        S3Client s3 = mock(S3Client.class);
        Remote remote = remote("wrong-version"); // READY와 다른 응답을 강제로 만든다.
        when(s3.getObject(any(GetObjectRequest.class))).thenReturn(remote.stream());
        var controller = new ExportDownloadController((id, subject) -> Optional.of(FILE), s3);
        var output = new ByteArrayOutputStream();
        assertThrows(IOException.class, () -> controller.download(FILE.exportId(), user()).getBody().writeTo(output));
        assertEquals(0, output.size()); // 메타데이터 대조 전에 본문을 보내지 않는다.
        assertTrue(remote.aborted().get());
        assertTrue(remote.closed().get());
    }

    @Test
    void abortsUpstreamWhenClientWriteFails() throws Exception {
        S3Client s3 = mock(S3Client.class);
        Remote remote = remote("v1");
        when(s3.getObject(any(GetObjectRequest.class))).thenReturn(remote.stream());
        var controller = new ExportDownloadController((id, subject) -> Optional.of(FILE), s3);
        OutputStream disconnected = new OutputStream() {
            @Override
            public void write(int value) throws IOException {
                throw new IOException("simulated client disconnect"); // 테스트가 만든 쓰기 실패다.
            }
        };
        assertThrows(IOException.class,
                () -> controller.download(FILE.exportId(), user()).getBody().writeTo(disconnected));
        assertTrue(remote.aborted().get()); // 실패를 전파하면서 남은 원격 입력은 중단한다.
        assertTrue(remote.closed().get());
    }

    private static UsernamePasswordAuthenticationToken user() {
        return new UsernamePasswordAuthenticationToken("user-1", "unused", List.of()); // 인증 결과 대역이다.
    }

    private static Remote remote(String version) {
        var closed = new AtomicBoolean();
        var aborted = new AtomicBoolean();
        var bytes = new ByteArrayInputStream(DATA) {
            @Override
            public void close() { closed.set(true); } // 실제 연결 대신 close 호출을 관찰한다.
        };
        var response = GetObjectResponse.builder().versionId(version).contentLength(5L).build();
        var stream = new ResponseInputStream<>(response, AbortableInputStream.create(bytes, () -> aborted.set(true)));
        return new Remote(stream, closed, aborted); // 2.31.54의 SDK 생성자를 사용한 테스트 대역이다.
    }

    private record Remote(ResponseInputStream<GetObjectResponse> stream,
                          AtomicBoolean closed, AtomicBoolean aborted) { }
}
```

기존 Java 프로젝트 루트에서 `./gradlew.bat test --tests com.example.export.ExportDownloadControllerTest`를 실행한다. 예상 결과는 다섯 테스트 통과다. 이 노트에서는 실행하지 않았다. 사용한 SDK 스트림 생성·abort 계약은 [2.31.54 AbortableInputStream 소스](https://raw.githubusercontent.com/aws/aws-sdk-java-v2/2.31.54/http-client-spi/src/main/java/software/amazon/awssdk/http/AbortableInputStream.java)와 대조했다.

| 추가 시험 | 확인할 증거 |
| --- | --- |
| 실제 DB에 서로 다른 두 소유자·동일한 형식의 산출물 | 타인 ID·미공개·만료는 제공 불가, 저장소 호출 없음 |
| MockMvc + 실제 보안 구성 | 인증·UUID 입력·헤더·asyncStarted·asyncDispatch 결과 |
| 검증한 버전 뒤 새 현재 버전 생성 | READY의 원래 버전만 반환 |
| 서버 실행기 포화·callback 미시작 | 원격 입력을 열지 않음, 거절·실패 관측 |
| 실제 HTTP 클라이언트 중도 종료·느린 읽기 | upstream 연결 정리·스레드와 풀 반환·유한 대기 |
| 조기 EOF·원격 예외·본문 전송 중 오류 | 성공 로그로 숨기지 않음, 이미 보낸 본문에 JSON 추가 없음 |
| 사전 서명 URL 공유·만료·자격 증명 만료 | 보유자 접근·기간 제한·버전 지정의 실제 동작 |

MockMvc의 비동기 요청은 시작 결과를 받은 뒤 완료를 기다리고 asyncDispatch를 수행하는 절차가 필요하다. 단순 200 상태만 보거나 Controller 직접 호출로 실제 비동기 전송을 검증했다고 하지 않는다. 네트워크 종료·프록시 버퍼링·대역폭은 실제 서버 통합 시험으로 확인한다. [공식 MockMvc 비동기 테스트](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/async-requests.html)

## 4. 적용 관점에서 다시 보기

구현 순서는 권한 있는 READY 이력을 먼저 찾고 그 불변 버전·바이트 수로 응답 계약을 만드는 것이다. 파일 경로·버킷·사용자 식별자를 요청자 입력 그대로 신뢰하지 않으며, 다운로드가 이어지는 동안 긴 DB 트랜잭션을 유지하지 않는다.

중계 방식에서는 콜백의 시작과 원격 스트림의 수명을 맞추고 정상·예외 경로에서 정리한다. 응답 commit 이후에는 상태 변경이나 JSON 덧붙이기로 오류를 복구하려 하지 않고, 전송 실패와 서버 관측의 한계를 남긴다.

실행기·queue·외부 I/O·다운로드 허용량을 함께 제한한다. 사전 서명 URL을 택하더라도 권한 확인·고정 버전·만료·보존은 유지하며 URL 보유자에게 권한이 위임되는 점을 반영한다.

검증은 코드 단위의 버전·close·abort부터 실제 DB 권한·MVC 비동기·네트워크 중도 종료까지 넓힌다. 서버가 본문을 썼다는 결과와 사용자가 파일을 정상 저장했다는 결과를 구분한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

다운로드는 READY 여부뿐 아니라 요청자·객체 버전·HTTP 표현·자원 수명을 연결하는 작업이다. 스트리밍은 메모리 사용 방식을 바꾸지만 권한 검사·실행 자원·중도 실패·보존 정책을 대신 해결하지 않는다.

### 5.2 이전·다음 학습과의 연결

[객체 스토리지 노트](../42_10_20_Batch_Object_Storage_and_Idempotent_Publication/10_20_Batch_Object_Storage_and_Idempotent_Publication.md)의 검증 버전을 실제 HTTP 제공 경로에 연결했다. 다음에는 **HTTP Range·조건부 요청과 파일 이어받기**를 학습해 부분 응답·표현 식별자·변경된 파일의 재개 조건을 구분한다.

### 5.3 더 파볼 만한 주제

사용자별 다운로드 허가와 전송량 제한, 접근 회수·객체 보존의 경쟁, CDN을 통한 보호된 전달을 확장할 수 있다. CSV를 스프레드시트로 여는 환경의 수식 해석 위험은 다운로드 헤더만이 아니라 파일 생성 규칙에서도 검토해야 한다.

### 5.4 참고 자료

- [Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html): 확인한 Boot·Framework·Security 버전.
- [Security 요청 인가](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html), [method security](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html): 요청·서비스 인가와 활성화 조건.
- [MVC 비동기 요청](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html), [StreamingResponseBody](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/StreamingResponseBody.html): 원시 응답 스트리밍·실행 흐름.
- [ContentDisposition](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/ContentDisposition.html), [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266.html): attachment·파일명과 인코딩 계약.
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): Content-Length·Range·Accept-Ranges의 의미.
- [GetObject API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html): 고정 versionId·권한·응답 정보.
- [Java InputStream](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/io/InputStream.html): 부분 읽기·EOF·available·배열 읽기.
- [SDK 2.31.54 ResponseInputStream](https://raw.githubusercontent.com/aws/aws-sdk-java-v2/2.31.54/core/sdk-core/src/main/java/software/amazon/awssdk/core/ResponseInputStream.java), [AbortableInputStream](https://raw.githubusercontent.com/aws/aws-sdk-java-v2/2.31.54/http-client-spi/src/main/java/software/amazon/awssdk/http/AbortableInputStream.java): close·abort·테스트용 생성 계약.
- [MVC AsyncSupportConfigurer](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/config/annotation/AsyncSupportConfigurer.html), [MockMvc 비동기 검사](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/async-requests.html): 실행기·요청 시간과 비동기 테스트.
- [S3 사전 서명 URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), [Java SDK 예제](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/examples-s3-presign.html): 위임 권한·유효 기간·서명 생성.

## 6. 요약 정리

1. 인증과 산출물별 소유자·READY·제공 기간 검사는 다른 책임이다.
2. 버킷·키·versionId·바이트 수는 검증한 DB 이력에서 가져온다.
3. Content-Type·파일명·Content-Length·캐시·Range 정책을 실제 본문과 맞춘다.
4. 콜백이 실행될 때 원격 입력을 열고 그 안에서 정리한다.
5. 중도 실패에서는 upstream abort를 고려하고 Servlet 출력·공유 클라이언트는 임의로 닫지 않는다.
6. 응답 commit 뒤에는 오류 JSON을 덧붙이거나 전송을 없던 일로 만들 수 없다.
7. MVC async timeout·외부 I/O timeout·동시 다운로드 용량을 따로 관리한다.
8. 사전 서명 URL은 권한을 보유자에게 위임하며 자동 일회용·즉시 회수 기능이 아니다.
9. 단위 검사와 실제 보안·비동기·네트워크·저장소 검증을 나누고 저장 완료를 과장하지 않는다.

🧠 기억할 것: “누가 어떤 검증 버전을 받으며, 실패하면 누가 연결을 정리하는가”를 한 흐름으로 설명한다.

## 7. 미니 퀴즈 또는 체크리스트

1. READY에 versionId를 저장했는데 GET에는 키만 넣었다. 어떤 문제가 생길 수 있는가?
2. Controller의 try-with-resources에서 입력을 열고 그 입력을 나중에 실행할 콜백으로 반환하면 왜 위험한가?
3. Content-Length를 `available()`이나 문자열 길이로 정해도 되는가?
4. CSV 일부를 보낸 뒤 오류가 났다. 오류 JSON을 같은 응답에 덧붙이면 되는가?
5. 2분짜리 사전 서명 URL은 로그인한 발급 요청자만 한 번 사용할 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 현재 버전이 선택되어 검증·공개한 버전과 다른 바이트를 제공할 수 있다. READY의 구체적인 versionId를 지정하고 그 버전의 권한·보존을 확인한다.
2. Controller가 반환할 때 입력이 닫혀 콜백에서 읽지 못할 수 있다. 반대로 열린 입력을 콜백에만 맡기면 미실행 경로에서 누수가 생길 수 있어 콜백 안에서 열고 닫는다.
3. 안 된다. available은 비차단으로 읽을 수 있는 양의 추정이고 문자 수는 인코딩 뒤 바이트 수와 다르다. 이번 예제는 검증한 바이트 수와 원격 응답 길이를 대조한다.
4. 안 된다. CSV와 JSON이 섞이고 commit 후 상태도 자유롭게 바꿀 수 없다. 실패를 전파하고 원격 입력을 정리하며 전송 실패를 관측한다.
5. 아니다. 보유자가 사용할 수 있는 위임 권한이고 만료 전 재사용할 수 있다. 유출 방지·버전 지정·실제 자격 증명 수명·회수 정책이 필요하다.

</details>
