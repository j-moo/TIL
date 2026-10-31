# 사전 서명 URL 기반 직접 업로드·완료 검증

- 🎯 글의 목표: 브라우저가 S3로 파일을 직접 보내더라도 서버가 소유자·저장 버전·실제 내용을 검증한 뒤 검사 대기로 전환하는 과정을 설명한다.
- 🧩 핵심 키워드: 사전 서명 URL, SigV4, PUT, 서명 헤더, SHA-256, CORS, versionId, 완료 검증, 조건부 UPDATE, 멱등 복구
- ⭐ 중요도: 높음. 파일 전송을 저장소에 맡기더라도 입력 검증·접근 제어·실패 복구까지 함께 맡긴 것은 아니기 때문이다.
- 📝 한눈에 보는 내용: 접수 의도 기록 → 제한된 PUT 서명 → TypeScript 직접 전송 → 서버의 고정 버전 대조 → QUARANTINED 확정 → 중복·유실·만료 복구
- 🔗 관련 주제: [업로드 상태·격리 검사와 정리](../46_10_28_Upload_Lifecycle_Quarantine_and_Cleanup/10_28_Upload_Lifecycle_Quarantine_and_Cleanup.md), [multipart 입력 검증](../45_10_26_File_Upload_Multipart_and_Validation/10_26_File_Upload_Multipart_and_Validation.md), [객체 스토리지의 조건부 쓰기](../42_10_20_Batch_Object_Storage_and_Idempotent_Publication/10_20_Batch_Object_Storage_and_Idempotent_Publication.md), [멱등성 키](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md)
- 🧱 선수 지식: HTTP 메서드·헤더·상태 코드, TypeScript의 타입·Promise·fetch, Java record·try-with-resources, DB 상태 전환, S3 key·versionId

> 기준일: 2026-10-31. 서버는 Java 21·기존 Spring Boot 4.1.2 프로젝트, AWS SDK for Java 2.x **2.31.54**, DB 예시는 PostgreSQL 17을 기준으로 한다. 프런트엔드는 TypeScript의 DOM API를 사용한다. 버전 관리 활성화·비공개 일반 목적 S3 버킷·SSE-S3 기본 암호화·작은 UTF-8 텍스트 한 개의 단일 PUT을 전제로 한다. 전체 실행 서비스가 아니라 기존 프로젝트에 추가하는 핵심 파일과 연결 계약이다. 실제 검증과 미실행 범위는 3.12에 구분한다.

## 1. 들어가며

이전 업로드에서는 브라우저가 애플리케이션 서버에 파일을 보내고, 서버가 바이트를 검사한 뒤 비공개 저장소에 기록했다. 직접 업로드에서는 파일 본문을 브라우저에서 S3로 바로 보낸다. 애플리케이션 서버는 전송 경로에서 빠지지만, 누가 어떤 파일을 저장하고 사용할 수 있는지 결정하는 책임은 그대로 남는다.

예를 들어 브라우저가 “업로드 성공”을 보고해도 실제 객체가 없을 수 있고, 다른 사용자의 파일 ID를 완료 요청에 넣을 수도 있다. S3에 저장되었더라도 잘못된 UTF-8이거나 내용 규칙을 위반할 수 있다. 따라서 이번 핵심 질문은 **“직접 전송했다는 주장을 어떤 서버 측 증거로 접수 완료로 바꿀 것인가?”**다.

이번 예제는 최대 64KiB의 텍스트로 전체 흐름을 작게 만든다. 작은 파일을 완료 단계에서 다시 읽어 검증하므로 검사 트래픽까지 없어지는 구조는 아니다. 큰 파일에서는 완료 접수와 실제 검증을 비동기 작업으로 나누어야 하며, 단순히 메모리 한도를 올려 확장하지 않는다.

## 2. 핵심 개념 정리

```text
브라우저                         애플리케이션 서버                   비공개 S3
  ├─ 제목·신고 크기·해시 ───────→ 인증·할당량·형식 검사
  │                              RECEIVING 이력 commit
  │←─ ID·PUT URL·필수 헤더 ───── 제한된 요청 서명
  ├─ 파일 원본 바이트 + 헤더 ─────────────────────────────────────→ PUT
  │←──────────────────────────────────────────────────────────── 저장 versionId
  ├─ ID·versionId 완료 요청 ────→ 소유자·상태·기한 재검사
  │                              ├─ 해당 버전 HEAD/GET ─────────→
  │                              ├─ 길이·해시·실제 내용 대조
  │                              └─ 조건부 QUARANTINED 확정
  │←─ 검사 대기 상태 ─────────── 이후 SCANNING → READY는 이전 노트
```

URL 발급은 **전송 권한**, S3의 PUT 성공은 **저장 결과**, 완료 API 성공은 **검사 대기 접수**다. 셋 모두 최종 사용 승인을 뜻하지 않는다. 다운로드는 이전 노트처럼 READY·소유자·기한을 다시 확인한다.

## 3. 본문 정리

### 3.1 사전 서명 URL은 특정 요청을 실행할 수 있는 임시 권한이다

**사전 서명 URL(presigned URL)**은 서버의 AWS 자격 증명으로 특정 HTTP 요청에 서명한 URL이다. S3는 요청의 서명을 검증하여 허용 여부를 판단하므로 브라우저에 AWS secret access key를 전달하지 않아도 된다. 다만 URL 자체를 가진 사람이 사용할 수 있으므로, 로그인한 사용자에게만 자동으로 묶이는 권한은 아니다.

**SigV4(Signature Version 4)**는 여기서 사용하는 AWS 요청 서명 방식이다. HTTP 메서드·대상 경로·쿼리·서명 대상 헤더 등의 값이 서명에 연결된다. 예를 들어 PUT용 URL을 GET으로 사용하거나 서명한 Content-Type을 바꾸면 같은 요청이 아니므로 실패할 수 있다. [S3 쿼리 매개변수 인증](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-query-string-auth.html)

URL은 유효 기간 동안 재사용될 수 있다. 로그아웃·DB의 상태 변경만으로 이미 발급한 URL이 취소되는 것은 아니며, 서명자의 자격 증명이 먼저 만료되면 URL도 예정 시간보다 빨리 실패할 수 있다. 서버는 올바른 버킷 region과 실행 환경의 자격 증명을 사용하고, 발급 응답은 소유자에게만 `Cache-Control: no-store`로 보낸다. [S3 사전 서명 URL의 권한·유효 기간](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

여기서 **IAM(Identity and Access Management)**은 AWS의 주체와 권한을 관리하는 체계이고, 역할(role)은 서버 같은 실행 주체가 맡는 권한 집합이다. 예를 들어 업로드 서명 역할이 특정 저장 영역에 PUT할 권한을 가져야 그 작업을 위임할 수 있다. **ACL(Access Control List)**은 자원의 접근 허용 목록이며, 이 예제는 공개 ACL을 붙이지 않고 비공개 저장을 유지한다.

⚠️ 주의: URL 전체를 로그·분석 이벤트·오류 메시지·공유 채팅에 남기지 않는다. 전송을 HTTPS로 제한하더라도 URL을 받은 사람의 재사용까지 막아 주지는 않는다. 발급 역할의 권한은 전용 저장 영역의 필요한 작업으로 제한하고 공개 버킷·공개 ACL로 문제를 우회하지 않는다.

### 3.2 직접 PUT·사전 서명 POST·multipart는 다른 계약이다

| 방식 | 브라우저가 보내는 것 | 주요 특징 |
| --- | --- | --- |
| 애플리케이션 multipart | metadata·file을 담은 FormData | 서버의 요청 크기·내용 검증을 통과한 뒤 저장 |
| 사전 서명 PUT | 파일 원본 바이트를 HTTP 본문으로 전송 | 특정 key·서명 헤더로 직접 저장 |
| 사전 서명 POST | 서명된 정책의 필드와 파일을 담은 폼 | 정책의 조건으로 허용 key·크기 범위 등을 제한 |
| S3 Multipart Upload | uploadId·part별 전송·최종 조립 요청 | 대용량 분할·재개용 별도 S3 프로토콜 |

이번에는 단일 PUT을 구현한다. 이전 `multipart/form-data`의 boundary나 JSON part를 붙이지 않으므로 `body: file`을 사용한다. `FormData`를 PUT 본문으로 보내면 파일 바이트 대신 multipart 포장까지 저장될 수 있고 체크섬도 맞지 않는다.

또한 애플리케이션의 `spring.servlet.multipart.max-file-size`는 브라우저→S3 요청을 통제하지 못한다. 완료 단계에서 크기를 거절하는 것과, 저장소에 큰 파일이 들어오는 것 자체를 막는 것은 서로 다른 기능이다.

이번 PUT 예제는 Content-Length를 서명하거나 브라우저에서 직접 설정하지 않는다. **따라서 신고 크기를 64KiB로 제한해도 S3 유입 크기에 대한 강제 상한은 아니다.** 크기 범위를 저장소에서 제한해야 한다면 `content-length-range`를 가진 사전 서명 POST 등을 별도로 설계한다. POST로 바꿀 때 PUT의 조건부 헤더 계약을 그대로 옮길 수 있다고 가정하지 않는다. [S3 POST 정책의 크기 조건](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-HTTPPOSTConstructPolicy.html)

브라우저가 임의 설정하지 못하는 요청 헤더에는 `Host`·`Content-Length` 등이 있다. 이를 TypeScript 코드로 억지로 붙이는 대신 브라우저가 생성하게 하고, 예제의 승인 기준은 서버가 실제 저장 길이로 다시 확인한다. [브라우저의 제한된 요청 헤더](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header)

### 3.3 먼저 접수 이력을 확정하고 서버가 저장 대상을 정한다

아래는 이번 예제의 **API 계약**이며 Controller·Repository 전체 구현을 제공하는 표가 아니다. 애플리케이션 API는 기존 세션 인증·CSRF 정책을 사용한다. S3 요청에는 애플리케이션 쿠키·Bearer 인증·CSRF 헤더를 넘기지 않는다.

| 요청 | 입력 | 서버의 책임 | 정상 응답 |
| --- | --- | --- | --- |
| `POST /direct-uploads` | title·bytes·sha256Hex | 인증·권한·할당량·형식 검사, RECEIVING commit, URL 발급 | 201 + id·url·method·requiredHeaders·expiresAt |
| `POST /direct-uploads/{id}/complete` | versionId | 소유자·기한·실제 저장 버전 검증, 조건부 확정 | 200 + id·현재 상태 |
| `GET /direct-uploads/{id}` | 서버 ID | 소유자 확인, 진행 상태 조회 | 200 + id·상태·안전한 사유 코드 |
| `POST /direct-uploads/{id}/reconcile` | 별도 파일 경로 없음 | 소유자 확인 후 불확실한 PUT 결과를 서버가 대조 | 처리 결과 또는 202 대조 접수 |

마지막 대조 API는 3.11의 복구 계약이며 이 노트에서 HTTP 구현까지 만들지는 않는다. 사용자가 전달하는 bucket·key·owner·READY 플래그를 받지 않고, 인증 주체와 DB에 저장한 경로만 사용한다. 제목은 이전과 같이 공백 불가·최대 100자, 신고 크기는 1~65,536바이트, 해시는 소문자 64자리 hex로 제한한다.

이전 46번 노트의 `upload_asset` 테이블을 사용하되 **RECEIVING 상태의 byte_size·sha256_hex는 이번 직접 업로드 경로에서는 미검증 신고값**이다. 서버가 입력 바이트를 먼저 읽었던 중계 업로드와 다른 점이다. 완료 검증에서 서버가 실제 길이·해시를 계산하여 신고값과 일치함을 확인한 뒤에만 QUARANTINED로 전환한다. 그 전에는 해당 값을 검증된 파일 증거로 사용하지 않는다.

서버는 새 UUID와 `incoming/text/{id}/body.txt` 같은 저장 key를 만들고, 인증 소유자·제목·신고값·검사 정책·접수 기한을 짧은 DB 트랜잭션으로 확정한다. 그 후 DB 트랜잭션 밖에서 서명한다. 서명 실패나 응답 유실은 만료 정리할 이력으로 남으며, 존재하지 않는 DB 행에 먼저 업로드 권한을 주지 않는다.

이 예제의 정책은 URL 최대 2분, 접수 기한 5분, 파일 제공 기한 접수 후 24시간이다. 숫자는 설명용이며, URL 발급 시각이 늦어졌다고 접수 기한을 자동 연장하지 않는다. 발급 요청 자체의 중복은 이전 멱등성 키의 소유자·요청 fingerprint 비교를 적용할 수 있으며, 이 노트의 완료 멱등성과는 별도다.

### 3.4 같은 바이트와 같은 저장 key를 서명에 묶는다

**체크섬**은 바이트로 계산한 값으로, 전송한 내용이 기대한 내용과 같은지 대조하는 데 사용한다. 클라이언트가 SHA-256을 계산해 보냈더라도 내용이 안전하다는 뜻은 아니다. 악성 내용을 올리는 사람도 그 내용의 올바른 해시를 계산할 수 있다.

서버는 신고된 SHA-256을 서명한 PUT 요청의 `checksumSHA256`에 넣는다. 그러면 그 URL로 다른 체크섬의 바이트를 저장하려는 요청을 제한할 수 있다. S3용 값은 **32바이트 해시 자체의 Base64**이며, 64자리 hex 문자열을 UTF-8로 인코딩한 것의 Base64가 아니다. [S3 업로드 체크섬](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)

SHA-256의 결과는 256비트, 즉 32바이트다. **hex**는 바이트 하나를 두 자리 16진수로 표시하므로 64글자가 되고, **Base64**는 같은 바이트를 다른 문자 규칙으로 표현하는 인코딩이다. 둘 다 암호화가 아니며, 아래 `parseHex`는 hex를 원래 바이트로 되돌리는 단계다.

같은 key에 대한 재사용은 `If-None-Match: *`를 서명에 포함해 제한한다. 현재 객체가 이미 있으면 412, 충돌하는 작업이 있으면 409가 발생할 수 있다. 412는 이전 시도가 성공했을 가능성도 있으므로 “무조건 새 key로 다시 올리기”보다 서버 대조로 이어 간다. 이 조건은 영구적인 일회용 토큰이 아니며 현재 버전이 삭제된 뒤에는 다시 쓰기가 가능할 수 있다. [S3 조건부 쓰기](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html), [PutObject 응답](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)

아래 파일들은 기존 Java 21 프로젝트의 `src/main/java/com/example/upload/`에 추가하는 **핵심 구현 파일**이다. AWS SDK 의존성은 다음처럼 기존 `build.gradle`의 dependencies에 합친다. 이 버전은 재현을 위한 고정값이지 최신 버전이라는 뜻이 아니다.

```groovy
implementation platform('software.amazon.awssdk:bom:2.31.54') // S3 관련 모듈의 버전을 맞춘다.
implementation 'software.amazon.awssdk:s3' // S3Client·S3Presigner·요청/응답 타입을 제공한다.
```

`DirectUploadIntent.java`는 서버가 DB에서 읽은 저장 의도를 나타낸다. 클라이언트 JSON을 이 record에 곧바로 바인딩하지 않는다. 여기서 형식 검사를 통과해도 인증·DB 접수·실제 내용 검증이 끝난 것은 아니다.

```java
package com.example.upload;

import java.time.Instant; // DB에 확정한 접수 기한을 전달한다.
import java.util.Base64; // S3 체크섬 헤더용 문자열로 변환한다.
import java.util.HexFormat; // 64자리 hex를 원래 32바이트로 복원한다.
import java.util.Objects;
import java.util.UUID;

public record DirectUploadIntent(
        UUID id, String bucket, long expectedBytes, String expectedSha256Hex,
        Instant receiveUntil
) {
    public static final int MAX_BYTES = 65_536; // S3 자체 한도가 아니라 예제의 승인 한도다.
    public static final String CONTENT_TYPE = "text/plain"; // 본문은 별도로 UTF-8 검증한다.

    public DirectUploadIntent {
        Objects.requireNonNull(id);
        Objects.requireNonNull(receiveUntil);
        if (bucket == null || bucket.isBlank()) throw new IllegalArgumentException("bucket required");
        if (expectedBytes < 1 || expectedBytes > MAX_BYTES) {
            throw new IllegalArgumentException("invalid declared size"); // 신고값의 형식만 확인한다.
        }
        if (expectedSha256Hex == null || !expectedSha256Hex.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("invalid SHA-256 hex"); // 대소문자 표현도 통일한다.
        }
    }

    public String key() {
        return "incoming/text/" + id + "/body.txt"; // 원본 파일 이름·사용자 경로를 섞지 않는다.
    }

    public String checksumBase64() {
        return Base64.getEncoder().encodeToString(HexFormat.of().parseHex(expectedSha256Hex));
        // hex 텍스트가 아니라 그 텍스트가 표현하는 해시 바이트를 Base64로 바꾼다.
    }
}
```

호출 계층은 DB의 bucket·object_key가 서버 설정과 이 key 생성 규칙에 일치하는지 확인한다. key 규칙을 바꾸는 배포에서는 기존 접수의 경로를 조용히 다시 계산하지 말고, 이미 저장한 경로와 버전을 계속 사용할 어댑터를 유지해야 한다.

### 3.5 URL뿐 아니라 필수 헤더와 기한을 함께 반환한다

다음 `DirectUploadUrlIssuer.java`는 commit된 RECEIVING 의도를 받아 서명한다. 생성자로 받는 `S3Presigner`는 올바른 region과 서버 자격 증명 공급자를 설정한 공유 객체이고, `Clock`은 테스트 가능한 시계를 제공한다. 둘의 Bean 등록·종료 시 presigner.close()·인증·할당량 검사는 외부 구성의 책임이다.

```java
package com.example.upload;

import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

public final class DirectUploadUrlIssuer {
    private final S3Presigner presigner; // 실제 S3 업로드가 아니라 요청 서명을 담당한다.
    private final Clock clock;
    private static final Set<String> ALLOWED = Set.of(
            "content-type", "if-none-match", "x-amz-checksum-sha256", "x-amz-sdk-checksum-algorithm");

    public DirectUploadUrlIssuer(S3Presigner presigner, Clock clock) {
        this.presigner = presigner;
        this.clock = clock;
    }

    public record Grant(UUID id, String url, String method,
                        Map<String, String> requiredHeaders, String expiresAt) {}

    public Grant issue(DirectUploadIntent intent) {
        Duration remaining = Duration.between(clock.instant(), intent.receiveUntil()).minusSeconds(5);
        // 서명 계산·시간 차이를 위한 예시 여유다. 서버 시계 동기화를 대신하지 않는다.
        Duration ttl = remaining.compareTo(Duration.ofMinutes(2)) < 0
                ? remaining : Duration.ofMinutes(2); // 접수 기한 안에서 최대 2분만 허용한다.
        if (ttl.compareTo(Duration.ofSeconds(1)) < 0) {
            throw new IllegalStateException("upload window closed"); // 임박한 접수에는 새 권한을 주지 않는다.
        }
        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(intent.bucket()).key(intent.key()) // 서버 DB에서 확인한 대상만 서명한다.
                .contentType(DirectUploadIntent.CONTENT_TYPE)
                .checksumSHA256(intent.checksumBase64()) // 알고리즘 이름뿐 아니라 실제 기대값을 지정한다.
                .ifNoneMatch("*") // 기존 현재 객체를 덮어쓰지 않는 조건도 서명한다.
                .build(); // Content-Length·ACL·Content-Encoding은 이 예제에서 지정하지 않는다.
        var signed = presigner.presignPutObject(PutObjectPresignRequest.builder()
                .putObjectRequest(put).signatureDuration(ttl).build());
        if (!"https".equalsIgnoreCase(signed.url().getProtocol())
                || signed.expiration().isAfter(intent.receiveUntil())) {
            throw new IllegalStateException("invalid signing configuration"); // 잘못된 설정은 발급 중단이다.
        }
        Map<String, String> headers = new LinkedHashMap<>();
        signed.signedHeaders().forEach((name, values) -> {
            String lower = name.toLowerCase(Locale.ROOT); // 브라우저 계약의 헤더 이름을 통일한다.
            if (lower.equals("host")) return; // Host는 URL에서 브라우저가 생성한다.
            if (!ALLOWED.contains(lower) || values.size() != 1) {
                throw new IllegalStateException("unsupported signed header"); // 새 헤더를 임의로 버리지 않는다.
            }
            headers.put(lower, values.get(0)); // SDK가 요구한 값을 수정 없이 전달한다.
        });
        if (!"*".equals(headers.get("if-none-match"))
                || !DirectUploadIntent.CONTENT_TYPE.equals(headers.get("content-type"))) {
            throw new IllegalStateException("required constraints not signed");
        }
        return new Grant(intent.id(), signed.url().toString(), "PUT", Map.copyOf(headers),
                signed.expiration().toString()); // JSON 날짜 표현을 ISO-8601 문자열로 고정한다.
    }
}
```

SDK가 반환한 서명 헤더를 전달하므로 프런트엔드에서 Content-Type을 파일의 `file.type`으로 다시 바꾸지 않는다. SDK가 일부 필드를 쿼리에 배치하는 경우에도 URL은 그대로 사용한다. 새 버전에서 추가 헤더가 생겨 발급이 실패하면 조건을 지우기보다 서명·CORS 계약을 함께 검토한다. 고정 버전의 요청 필드는 [2.31.54 서비스 모델](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/resources/codegen-resources/service-2.json), 서명 헤더 구성은 [DefaultS3Presigner 소스](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/java/software/amazon/awssdk/services/s3/internal/signing/DefaultS3Presigner.java)에서 확인했다.

SDK의 `isBrowserExecutable()`은 이 버전에서 추가 헤더·본문 없이 브라우저로 여는 GET 형태를 중심으로 판단한다. PUT 결과의 false를 “fetch로 업로드할 수 없다”는 뜻으로 해석하지 않는다. PUT은 브라우저 코드가 파일 본문과 헤더를 보내고, S3의 CORS 정책도 허용해야 한다. [S3Presigner의 브라우저 호환성 설명](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/java/software/amazon/awssdk/services/s3/presigner/S3Presigner.java)

URL 생성 성공은 IAM 권한·버킷 존재·실제 업로드 성공을 시험한 결과가 아니다. 비밀값을 소스에 넣지 않고 실행 환경의 자격 증명 공급 체계를 사용하며, 업로드 서명 역할과 검증용 읽기 역할의 최소 권한은 배포 환경에서 따로 확인한다. [Java SDK 사전 서명 사용법](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/examples-s3-presign.html)

### 3.6 CORS는 브라우저의 교차 출처 규칙이지 업로드 권한이 아니다

**출처(origin)**는 스킴·호스트·포트의 조합이다. 화면의 `https://study.example.com`과 S3의 HTTPS 호스트는 다른 출처이므로 브라우저가 **CORS(Cross-Origin Resource Sharing)** 규칙을 적용한다. PUT과 사용자 지정 헤더를 보내기 전에는 OPTIONS 사전 요청으로 허용 메서드·헤더를 확인할 수 있다.

아래는 S3 콘솔에 설정할 **CORS JSON 예시**다. 실제 적용하지 않은 설정이며 화면 출처와 헤더 계약에 맞춰 조정한다. 기존 버킷 설정을 무조건 이 내용으로 덮어쓰지 않는다.

```json
[
  {
    "AllowedOrigins": ["https://study.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "if-none-match", "x-amz-*"],
    "ExposeHeaders": ["x-amz-version-id", "x-amz-request-id"],
    "MaxAgeSeconds": 300
  }
]
```

`AllowedOrigins`는 브라우저 화면의 출처, `AllowedMethods`는 실제 요청의 PUT, `AllowedHeaders`는 보내려는 요청 헤더다. `ExposeHeaders`는 성공 응답에서 JavaScript가 읽을 헤더이며, `x-amz-version-id`를 빠뜨리면 저장에 성공해도 코드에서 그 값을 읽지 못할 수 있다. `MaxAgeSeconds`는 사전 요청 결과의 캐시 시간이지 서명 URL 만료 시간이 아니다. [S3 CORS 설정 요소](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html)

`OPTIONS`를 AllowedMethods에 추가하는 방식으로 해결하지 않는다. S3의 이 목록에는 PUT 같은 실제 작업 메서드를 적는다. `x-amz-*`도 IAM 권한을 부여하는 표현이 아니라 브라우저의 헤더 허용 범위이며, 더 좁게 운영하려면 실제 signedHeaders를 기준으로 필요한 이름만 열 수 있다.

⚠️ 주의: CORS는 curl이나 다른 서버의 요청을 인증하지 않는다. `AllowedOrigins`를 좁혀도 유출된 URL의 재사용을 근본적으로 막는 장치가 되지 않는다. 반대로 CORS 오류라고 무조건 PUT이 실패했다고 단정하지 말고, 실제 저장 결과와 응답 헤더 접근 실패를 분리해 확인한다.

### 3.7 TypeScript에서는 원본 File과 서명 헤더를 그대로 보낸다

다음 `direct-upload.ts`는 **브라우저 프로젝트에 추가하는 전송 모듈 전체**다. 파일 선택 UI·세션 로그인·발급/완료 API의 HTTP 래퍼는 포함하지 않는다. `parseGrant`에는 인증된 발급 API의 JSON을 `unknown`으로 넘기고, `allowedOrigin`에는 배포 설정으로 정한 실제 S3 출처를 전달한다. 서버 응답 타입을 `as Grant`로 단언하는 것만으로 런타임 검증이 되는 것은 아니다.

`sha256Hex`는 HTTPS 등 보안 컨텍스트에서 사용할 수 있는 Web Crypto API로 작은 파일의 해시를 계산한다. `digest`는 전체 입력을 받으므로 대용량 스트리밍 해시 함수라고 해석하지 않는다. [SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)

```typescript
export type Grant = {
  id: string; // 서버가 만든 접수 ID다. 전송 전에 화면 상태에 보관한다.
  url: string; // 로그·분석 도구에 남기지 않을 임시 권한이다.
  method: "PUT";
  requiredHeaders: Record<string, string>; // 서버가 돌려준 서명 헤더 값이다.
  expiresAt: string; // 예정 만료 시각이며 실제 자격 증명 수명을 보장하지는 않는다.
};

const MAX_BYTES = 65_536; // 사용자 경험용 한도다. 실제 서버 검증은 별도로 필요하다.
const HEADER_NAMES = new Set([
  "content-type", "if-none-match", "x-amz-checksum-sha256", "x-amz-sdk-checksum-algorithm",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
  // JSON 객체인지 좁힌 뒤 각 필드의 값도 검사한다.
}

export function parseGrant(raw: unknown, allowedOrigin: string, nowMs = Date.now()): Grant {
  if (!isRecord(raw) || typeof raw.id !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw.id)
      || raw.method !== "PUT" || typeof raw.url !== "string"
      || typeof raw.expiresAt !== "string" || !isRecord(raw.requiredHeaders)) {
    throw new Error("업로드 발급 응답 형식이 올바르지 않습니다.");
  }
  const target = new URL(raw.url); // URL을 읽어 검사하되 경로·쿼리를 다시 만들어 서명값을 바꾸지 않는다.
  if (target.protocol !== "https:" || target.origin !== allowedOrigin
      || target.username || target.password || target.hash) {
    throw new Error("허용하지 않은 업로드 대상입니다."); // 임의 외부 주소로 파일을 보내지 않는다.
  }
  const expiration = Date.parse(raw.expiresAt);
  if (!Number.isFinite(expiration) || expiration <= nowMs) {
    throw new Error("업로드 URL의 유효 기간을 확인하세요.");
  }
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw.requiredHeaders)) {
    if (!HEADER_NAMES.has(name) || typeof value !== "string" || /[\r\n]/.test(value)) {
      throw new Error("지원하지 않는 업로드 헤더입니다."); // 앱 인증 헤더 등을 섞지 않는다.
    }
    headers[name] = value; // 파일의 file.type이나 임의 문자열로 대체하지 않는다.
  }
  if (headers["content-type"] !== "text/plain" || headers["if-none-match"] !== "*") {
    throw new Error("필수 업로드 조건이 없습니다.");
  }
  return { id: raw.id, url: raw.url, method: "PUT", requiredHeaders: headers, expiresAt: raw.expiresAt };
  // 검증 후에도 원래 URL 문자열을 반환한다. URL 전체를 디버그 출력하지 않는다.
}

export async function sha256Hex(file: File): Promise<string> {
  if (file.size < 1 || file.size > MAX_BYTES) throw new Error("1~64KiB 파일이 필요합니다.");
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  // 해시의 각 바이트를 두 자리 소문자 hex로 만들어 발급 API에 신고한다.
}

export class ReconcileRequired extends Error {
  readonly uploadId: string;
  constructor(uploadId: string, message: string) {
    super(message);
    this.name = "ReconcileRequired";
    this.uploadId = uploadId; // URL 없이도 서버에 저장 상태 대조를 요청할 수 있다.
  }
}

export async function putDirect(
  file: File, grant: Grant, signal?: AbortSignal, transport: typeof fetch = fetch,
): Promise<string> {
  if (file.size < 1 || file.size > MAX_BYTES) throw new Error("1~64KiB 파일이 필요합니다.");
  try {
    const response = await transport(grant.url, {
      method: grant.method,
      headers: grant.requiredHeaders,
      body: file, // FormData로 포장하지 않는다. 해시를 계산한 그 File을 보낸다.
      mode: "cors", // no-cors로 응답을 숨겨 해결하려 하지 않는다.
      credentials: "omit", // 애플리케이션 쿠키를 S3로 보내지 않는다.
      redirect: "error", // 다른 주소로 자동 전송하지 않고 region·발급 주소를 점검한다.
      referrerPolicy: "no-referrer",
      signal, // 취소는 브라우저 대기를 중단하지만 원격 저장 취소를 보증하지 않는다.
    });
    if (!response.ok) {
      throw new ReconcileRequired(grant.id, `저장 상태 확인이 필요합니다. HTTP ${response.status}`);
      // 412는 이전 성공 가능성이 있다. 원문 XML·서명 URL은 오류 메시지에 넣지 않는다.
    }
    const versionId = response.headers.get("x-amz-version-id");
    if (!versionId || versionId === "null") {
      throw new ReconcileRequired(grant.id, "저장 버전을 확인할 수 없습니다.");
      // CORS의 ExposeHeaders 누락·버전 관리 설정·응답 유실을 서버에서 대조한다.
    }
    return versionId; // 불투명한 식별자이므로 임의로 자르거나 다른 형식으로 변환하지 않는다.
  } catch (error) {
    if (error instanceof ReconcileRequired) throw error;
    throw new ReconcileRequired(grant.id, "전송 결과가 불확실합니다. 서버에서 상태를 확인하세요.");
    // 네트워크·CORS·취소 오류를 원격 저장 실패 확정으로 바꾸지 않는다.
  }
}
```

애플리케이션 연결은 다음 **의사 코드** 순서다. 이 모듈은 자동 재시도를 숨겨 수행하지 않으며, 완료 응답을 잃은 경우 새 파일을 올리는 대신 같은 ID·versionId로 완료 요청부터 재시도한다.

```text
1. 선택한 File을 고정하고 sha256Hex(file)을 계산한다.
2. 인증·CSRF를 붙인 앱 API에 title·file.size·해시를 JSON으로 보낸다.
3. 응답 JSON을 parseGrant로 확인하고 grant.id를 화면 상태에 먼저 보관한다.
4. putDirect(file, grant)를 호출한다. 앱 API용 인증 래퍼를 S3 호출에 재사용하지 않는다.
5. 받은 versionId와 grant.id로 인증·CSRF를 붙여 complete API를 호출한다.
6. 응답의 현재 상태를 표시한다. QUARANTINED를 READY로 추정하지 않는다.
7. ReconcileRequired이면 해당 ID로 대조 API를 요청하고 상태를 조회한다.
```

S3는 버전 관리된 PUT 응답의 `x-amz-version-id`에 저장 버전을 돌려준다. 하지만 브라우저가 완료 API에 그 값을 보낼 때는 다시 비신뢰 입력이 된다. 서버는 DB의 bucket·key에 대해 그 버전이 실제로 있는지 확인해야 한다. [버전 관리 버킷의 저장 응답](https://docs.aws.amazon.com/AmazonS3/latest/userguide/AddingObjectstoVersioningEnabledBuckets.html)

### 3.8 HEAD는 저장 정보, GET은 실제 내용 검증에 사용한다

**HEAD**는 본문 없이 객체의 길이·타입·체크섬·버전 같은 메타정보를 읽는 요청이다. 미리 큰 파일을 거절하는 데 유용하지만 UTF-8 문법·공백뿐인 내용·제어 문자·악성 내용을 검사하지는 않는다. 이 예제는 HEAD에서 후보를 좁히고 같은 versionId의 GET으로 실제 바이트를 제한해서 읽는다.

HEAD와 GET 모두 버전을 고정한다. HEAD로 최신 key를 확인한 뒤 버전 없는 GET을 보내면 사이에 다른 버전이 만들어졌을 때 검사 대상이 달라질 수 있다. `ChecksumMode.ENABLED`로 서비스 체크섬을 조회하며, 이것을 사용자가 붙인 임의 메타데이터와 혼동하지 않는다. SSE-KMS로 변경하면 체크섬 조회의 KMS 권한도 별도 확인해야 한다. [S3 HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)

다음 `DirectUploadVerifier.java`는 **핵심 검증 파일 전체**다. 호출 전 인증·소유자·상태·기한과 candidateVersion의 요청 길이 상한을 검사한다. `S3Client`는 공유 객체이며 올바른 자격 증명·region·연결/소켓 읽기 제한·유한한 재시도 정책을 설정해서 주입한다. SDK 호출 시간 제한과 반환된 스트림 읽기 제한의 적용 범위를 같다고 가정하지 않는다. [SDK timeout 계층](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/timeouts.html)

```java
package com.example.upload;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ChecksumMode;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;

public final class DirectUploadVerifier {
    private final S3Client s3;

    public DirectUploadVerifier(S3Client s3) { this.s3 = s3; }

    public record VerifiedUpload(UUID id, String versionId, long bytes, String sha256Hex) {}

    public static final class ContentRejected extends RuntimeException {
        public ContentRejected(String reason) { super(reason); } // 내용 불일치와 통신 장애를 구별한다.
    }

    public VerifiedUpload verify(DirectUploadIntent intent, String candidateVersion) throws IOException {
        if (candidateVersion == null || candidateVersion.isBlank() || candidateVersion.equals("null")) {
            throw new IllegalArgumentException("specific version required"); // 최신 버전으로 자동 대체하지 않는다.
        }
        var head = s3.headObject(HeadObjectRequest.builder()
                .bucket(intent.bucket()).key(intent.key()).versionId(candidateVersion)
                .checksumMode(ChecksumMode.ENABLED).build()); // DB의 경로에 대해 서버 권한으로 조회한다.
        require(head.sdkHttpResponse().statusCode() == 200, "unexpected HEAD status");
        require(candidateVersion.equals(head.versionId()), "version mismatch");
        require(Long.valueOf(intent.expectedBytes()).equals(head.contentLength()), "size mismatch");
        require(DirectUploadIntent.CONTENT_TYPE.equals(head.contentType()), "type mismatch");
        require(head.contentEncoding() == null, "encoded content not supported");
        require(intent.checksumBase64().equals(head.checksumSHA256()), "checksum metadata mismatch");
        // 이 시점에도 실제 UTF-8·업무 내용이 확인된 것은 아니다.

        GetObjectRequest get = GetObjectRequest.builder()
                .bucket(intent.bucket()).key(intent.key()).versionId(candidateVersion).build();
        try (ResponseInputStream<GetObjectResponse> input = s3.getObject(get)) {
            try {
                var metadata = input.response(); // GET 응답도 요청한 고정 버전인지 확인한다.
                require(metadata.sdkHttpResponse().statusCode() == 200, "unexpected GET status");
                require(candidateVersion.equals(metadata.versionId()), "GET version mismatch");
                require(Long.valueOf(intent.expectedBytes()).equals(metadata.contentLength()), "GET size mismatch");
                require(DirectUploadIntent.CONTENT_TYPE.equals(metadata.contentType()), "GET type mismatch");
                require(metadata.contentEncoding() == null, "GET encoding mismatch");
                byte[] bytes = input.readNBytes(DirectUploadIntent.MAX_BYTES + 1);
                // EOF 또는 상한+1까지만 읽는다. 메타 크기와 실제 바이트 수를 따로 비교한다.
                require(bytes.length == intent.expectedBytes(), "actual size mismatch");
                String actualHash = sha256(bytes); // 클라이언트 신고가 아닌 실제 바이트에서 다시 계산한다.
                require(actualHash.equals(intent.expectedSha256Hex()), "actual checksum mismatch");
                validateText(bytes); // 이 작은 예제의 형식 규칙이며 최종 악성 코드 검사는 아니다.
                return new VerifiedUpload(intent.id(), candidateVersion, bytes.length, actualHash);
            } catch (IOException | RuntimeException failure) {
                try { input.abort(); } // 중간 실패에서 남은 본문을 계속 읽어 버리지 않도록 중단한다.
                catch (RuntimeException abortFailure) { failure.addSuppressed(abortFailure); }
                throw failure; // 저장 승인이나 성공 응답으로 바꾸지 않는다.
            }
        } // 성공·실패 모두 스트림을 닫는다. 공유 S3Client는 여기서 닫지 않는다.
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible); // 런타임 설정 문제다.
        }
    }

    private static void validateText(byte[] bytes) {
        String text;
        try {
            text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT) // 깨진 문자를 대체하지 않고 거절한다.
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException failure) {
            throw new ContentRejected("invalid UTF-8");
        }
        require(!text.isBlank(), "blank content");
        boolean forbidden = text.codePoints().anyMatch(cp ->
                Character.isISOControl(cp) && cp != '\n' && cp != '\r' && cp != '\t');
        require(!forbidden, "control character"); // 이전 텍스트 규칙과 동일하게 줄바꿈·탭만 예외다.
    }

    private static void require(boolean condition, String reason) {
        if (!condition) throw new ContentRejected(reason); // 외부 응답에서는 내부 세부값을 숨긴다.
    }
}
```

입력은 DB에서 확인한 의도와 후보 versionId이고, 반환값은 **서버가 검증한 실제 길이·해시·버전**이다. Content-Type과 SHA-256 대조가 통과해도 내용 검사가 실패하면 반환하지 않는다. 반대로 이 텍스트 규칙까지 통과해도 여기서는 QUARANTINED로만 진행하며 최종 정책 검사는 이전 SCANNING 단계가 맡는다.

본문 크기를 상한+1까지만 읽는 이유는 메타정보가 틀려도 무제한 메모리를 쓰지 않기 위해서다. 사용자별 동시 완료 요청·검사 호출 수·저장 공간 제한까지 해결하는 코드는 아니므로 별도 한도가 필요하다. 단일 PUT의 전체 SHA-256을 전제로 하며 S3 Multipart Upload의 복합 체크섬에 그대로 적용하지 않는다.

### 3.9 완료 API는 외부 검증과 짧은 DB 확정을 나눈다

검증 중 DB 트랜잭션과 행 잠금을 계속 보유하면 S3가 느려질 때 DB 연결도 오래 점유한다. 서비스는 먼저 소유자·상태·기한을 읽고, 트랜잭션 밖에서 S3를 검증한 뒤, 마지막 UPDATE에서 조건을 다시 확인한다.

다음은 **서비스 조립 의사 코드**다. 실제 인증·ControllerAdvice·Repository Bean은 기존 프로젝트에 맞춰 구현해야 한다. `verify` 호출 전에는 반드시 소유자 검사부터 수행한다.

```text
1. 인증 사용자와 id로 DB 행을 조회한다. 다른 소유자라면 S3를 호출하지 않는다.
2. 이미 저장 완료한 행이면 요청 versionId와 확정 versionId를 비교한다.
   # 같은 버전은 저장한 상태를 반환하고, 다른 버전은 충돌로 거절한다.
   # DELETE_PENDING·DELETED나 사용 불가 상태를 READY로 되돌리지 않는다.
3. 아직 RECEIVING이면 접수 기한·파일 기한·기록된 대상 경로를 확인한다.
4. DB 트랜잭션 밖에서 verifier.verify(intent, versionId)를 호출한다.
5. 짧은 트랜잭션에서 검증 결과를 조건부로 QUARANTINED에 반영한다.
6. 영향 행이 0이면 현재 행을 다시 읽어 중복 성공·만료·다른 버전 충돌을 구분한다.
7. 실제 commit까지 확인한 결과만 반환한다. 검사 작업자는 DB의 대기 행을 읽는다.
```

아래는 46번 노트 테이블에 적용할 **저장 계층 SQL 조각**이다. `:...`는 Spring의 이름 기반 매개변수 바인딩 표기다. `:verified_*`는 방금 `VerifiedUpload`가 반환한 서버 검증 결과이며 HTTP 요청의 값으로 직접 채우지 않는다.

```sql
UPDATE upload_asset
SET object_version = :verified_version,
    state = 'QUARANTINED',                      -- 접수 완료이지 최종 공개 승인이 아니다.
    next_scan_at = clock_timestamp()            -- 검사 worker가 다시 발견할 수 있는 상태로 만든다.
WHERE id = :id
  AND owner_subject = :authenticated_owner     -- 요청 소유자 값이 아닌 인증 결과다.
  AND bucket_name = :expected_bucket
  AND object_key = :expected_key                -- 검증한 경로와 현재 이력을 맞춘다.
  AND state = 'RECEIVING'
  AND object_version IS NULL                   -- 이미 확정한 버전은 교체하지 않는다.
  AND byte_size = :verified_bytes
  AND sha256_hex = :verified_sha256             -- 실제 계산값이 최초 신고와 일치해야 한다.
  AND receive_until > clock_timestamp()
  AND expires_at > clock_timestamp()
RETURNING id, state, object_version;
```

두 완료 요청이 동시에 검증을 마쳐도 조건부 UPDATE로 한 버전만 처음 확정한다. 뒤늦은 요청이 0행을 받았을 때 같은 확정 버전이라면 이미 성공한 접수의 결과를 반환한다. 다른 버전이면 충돌이며, ID만으로 UPDATE를 다시 보내지 않는다. 이 정책을 **완료 요청의 멱등성**이라고 부른다. 같은 요청의 반복이 상태를 계속 새로 바꾸지 않는다는 뜻이다.

첫 번째 완료 후 worker가 이미 SCANNING이나 READY까지 진행했다면 완료 재전송 응답도 해당 상태를 보여 줄 수 있다. 다시 QUARANTINED로 내리거나 검사 횟수를 초기화하지 않는다. 사용 기한이 지났거나 삭제 중이면 그 사실을 반환하고, 이전 완료 성공을 근거로 새 접근 권한을 부여하지 않는다.

내용 검증 뒤 기한이 지나는 경쟁도 같은 WHERE 조건으로 처리한다. UPDATE가 0행인데 “검증은 성공했으니 괜찮다”고 공개하면 만료 정책이 무너진다. PostgreSQL의 Read Committed에서 갱신 충돌 뒤 조건을 재평가하는 동작은 실제 동시 연결 테스트로 확인한다. [PostgreSQL Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

### 3.10 실패는 서명·전송·검증·DB 경계로 나누어 읽는다

| 관찰한 상황 | 가능한 의미 | 다음 행동 |
| --- | --- | --- |
| 발급 API 401·403 | 로그인·업로드 권한·CSRF 문제 | 애플리케이션 인증 경로 확인 |
| S3 403 | 서명 만료·자격 증명·region·서명 헤더·IAM 문제 | 응답 코드와 안전한 요청 ID로 분류 |
| S3 BadDigest | 실제 바이트와 체크섬 불일치 | 같은 File인지·Base64 변환·본문 포장 확인 |
| S3 412 | 조건부 PUT 대상이 이미 존재 | 기존 ID의 저장 결과 대조 |
| S3 409 | 조건부 쓰기의 경쟁 | 한도 내 재시도 정책과 결과 대조; 무한 반복 금지 |
| PUT 성공인데 versionId가 없음 | CORS 응답 헤더 노출·버전 관리 설정 문제 가능 | 서버 대조, 임의의 null 버전으로 완료 금지 |
| fetch 오류·사용자 취소 | 브라우저가 결과를 관찰하지 못했음 | 실패 확정 대신 기존 ID로 대조 |
| 완료 중 HEAD/GET 403·timeout | 서버 읽기 권한·통신 문제 또는 확인 불가 | READY로 만들지 않고 서버 오류·재시도 구분 |
| 검증 길이·해시·텍스트 불일치 | 신고 내용 또는 형식과 실제 파일 불일치 | 승인 거절·정리 예약, 정상 응답으로 위장하지 않음 |
| DB 확정 뒤 완료 응답 유실 | 서버는 이미 접수 완료했을 수 있음 | 같은 ID·버전으로 완료 요청 재전송 |

표의 S3 오류와 애플리케이션의 HTTP 오류 계약은 별개다. 예를 들어 이 서비스는 입력 형식 오류 400, 다른 소유자·없는 ID 404, 상태·버전 충돌 409, 내용 검증 거절 422, 저장소 확인 장애 503 같은 계약을 정할 수 있다. 모든 `S3Exception`을 400으로 바꾸지 않고, 내부 bucket·key·서명 URL·엔진 메시지는 응답에서 숨긴다.

확실한 내용 위반과 저장소 장애를 구별해야 재시도도 맞게 선택할 수 있다. 전자는 같은 바이트를 반복 전송해도 해결되지 않을 수 있고, 후자는 내용을 바꿀 문제가 아니다. HEAD의 403은 “객체가 없다”는 확정 증거가 아니며 IAM 정책에 따라 부재 여부 자체를 확인하지 못하는 경우도 있다. [S3 HEAD의 오류와 권한](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)

### 3.11 유실된 전송 결과와 남아 있는 URL 권한을 함께 복구한다

PUT 응답을 잃으면 브라우저는 versionId를 알지 못한다. 이때 복구자는 인증 소유자와 DB의 key로 저장 결과를 찾는다. 최신 HEAD는 **후보 versionId를 발견하기 위한 용도**이며, 발견한 버전을 고정한 뒤 3.8의 동일 검증 과정을 다시 수행한다. 파일이 없거나 확인할 권한이 없다면 완료로 확정하지 않는다.

복구 흐름은 아래처럼 구성한다. 메시지를 받았다는 사실이나 파일의 이름만으로 READY를 만드는 분기는 없다.

```text
소유자 확인 + DB 상태 확인
  ├─ 이미 같은 버전으로 접수 완료 → 현재 상태 반환
  ├─ RECEIVING이고 기한 전
  │    → DB key의 저장 결과에서 versionId 후보 발견
  │    → 고정 버전의 길이·체크섬·내용 검증
  │    → 조건부 QUARANTINED 확정
  └─ 기한 만료·삭제 단계
       → 신규 완료·URL 재발급 금지
       → 지연 도착한 객체까지 정리 이력에 포함
```

S3는 서명 요청을 받아들일 때 유효 기간을 확인한다. URL 시각이 지났다는 사실만으로 이미 시작된 전송까지 강제 취소되었다고 단정하지 않는다. 또한 현재 객체를 너무 일찍 삭제하면 아직 유효한 `If-None-Match: *` PUT이 다시 성공할 여지가 생긴다. 따라서 URL 만료 예정 시각을 이력에 남기고, 재발급은 같은 접수의 상태·기한·대상을 다시 확인한 경우에만 제한적으로 허용한다. [S3 사전 서명 URL 만료 동작](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

이 예제에서는 URL 재발급 HTTP 구현을 생략하고, 만료한 접수는 새 업로드 ID로 시작하도록 한다. 그 경우에도 이전 ID의 정리 이력을 없애지는 않는다. `upload_asset`에 URL별 만료 기록이나 별도 발급 이력을 추가하는 설계가 필요하며, 앞 SQL 조각만으로 지연 PUT 정리가 완성되는 것은 아니다.

사용자는 삭제 요청 뒤 파일을 다시 사용할 수 없어야 하지만, 저장소에는 아직 전송 중인 요청이나 미정리 버전이 있을 수 있다. 이전 노트의 DELETE_PENDING을 유지하며 모든 해당 버전을 대조하고, 고정 유예 시간만으로 “완전히 없어졌다”고 표시하지 않는다. 저장 공간 상한·정리 지연 경고·최종 상태 대조를 함께 운영한다.

### 3.12 실행한 검사와 실제 저장소 검증을 구분한다

이 저장소에는 본문 TypeScript 코드 블록을 추출해 검사하는 [직접 업로드 예제 테스트](../../scripts/test_direct_upload_example.mjs)를 함께 둔다. 코드를 따로 복제하지 않고 노트 안의 코드를 읽으므로 설명과 테스트 대상이 어긋나는 일을 줄인다. 테스트의 fetch 대역은 메모리 응답만 반환하며 네트워크 요청·실제 파일 업로드를 하지 않는다.

TIL 저장소 루트에서 다음을 실행한다. Node.js 24.16.0으로 검사했으며 `stripTypeScriptTypes`로 타입 표기를 제거한 뒤 런타임 동작을 시험한다. **이 검사는 TypeScript 컴파일러의 정적 타입 검사나 브라우저 CORS 시험이 아니다.**

```powershell
# 본문의 TypeScript 모듈을 대상으로 SHA-256·응답 검증·전송·실패 경로를 검사한다.
node --test scripts/test_direct_upload_example.mjs
# 저장소 Markdown 링크·코드 펜스·학습 노트 집계와 문서 도구를 검사한다.
python scripts/check_notes.py
python -B -m unittest discover -s scripts -p 'test_*.py' -v
git diff --check
```

실행한 예제 런타임 테스트 9개는 모두 통과했다. 해시의 hex 표현, 허용 출처·메서드·헤더·기한, 원본 File 전송과 인증 정보 미전달, 버전 ID 누락, 412, 통신 오류·취소, 크기 경계를 확인한다. 실제 애플리케이션에서는 DOM 라이브러리를 포함한 tsconfig로 `tsc --noEmit`도 실행하고, UI·발급 API·완료 API의 응답 계약을 통합 시험해야 한다.

| 추가로 필요한 시험 | 확인할 결과 |
| --- | --- |
| 실제 presigner 결과의 헤더·쿼리 확인 | Content-Type·조건부 쓰기·체크섬이 요청 계약에 연결됨; 값 제거·변조 거절 |
| 브라우저 preflight·PUT·ExposeHeaders | 허용 화면에서 전송되고 versionId를 읽을 수 있음 |
| 잘못된 SHA-256·FormData PUT | S3가 다른 바이트를 정상 파일로 받아들이지 않음 |
| 작은 크기로 신고한 큰 파일 | 서버가 HEAD에서 승인 거절; PUT의 저장소 유입 상한과 혼동하지 않음 |
| UTF-8·공백·제어 문자 위반 | 해시가 맞더라도 내용 검증에서 거절 |
| 다른 소유자 ID·다른 key의 versionId | 소유자 확인 또는 해당 경로의 버전 조회에서 거절 |
| HEAD 후 새 버전 생성 | GET·DB 확정은 검증한 versionId를 유지 |
| 두 complete 동시 호출·응답 유실 | 한 번 확정하고 같은 버전 재전송은 저장한 결과 반환 |
| 완료 검증 도중 만료·삭제 전환 | 마지막 UPDATE가 0행이고 상태를 되살리지 않음 |
| PUT 성공 응답 유실·412 재시도 | 기존 ID의 후보 버전을 대조하여 복구 |
| URL 만료 전 시작한 지연 PUT·이른 객체 삭제 | 늦은 객체를 놓치지 않고 다시 공개하지 않음 |

실제 수행 범위는 위 Node 기반 대역 테스트, 문서 검사, 공식 SDK 소스·API 대조다. PATH에서 Java 8만 확인되었고 Java 21 컴파일러·Maven·Gradle·TypeScript 컴파일러는 확인하지 못했다. Java 컴파일·DB 경쟁·IAM·CORS·실제 S3 업로드/삭제·검사 엔진 동작은 수행하지 않았다. 표는 후속 통합 시험의 기대 결과이지 실행 결과가 아니다.

## 4. 적용 관점에서 다시 보기

직접 업로드 도입 시 먼저 무엇을 저장소에 맡길지 정한다. 본문 전송은 넘길 수 있지만 접수 권한·할당량·검사·공개 승인은 애플리케이션에 남는다. 저장소 유입 크기를 강제로 제한해야 하는 요구가 있다면 PUT 뒤 검증만으로 충족한다고 말하지 않고 POST 정책 등 별도 전송 계약을 선택한다.

구현 순서는 서버 생성 ID와 commit된 이력을 만든 뒤 제한된 요청을 서명하고, 브라우저가 원본 바이트와 필수 헤더를 전달하게 하는 것이다. 완료 시에는 인증 소유자와 DB 경로를 기준으로 고정 버전을 검증하고, 조건부 갱신으로 검사 대기에 넣는다.

장애를 볼 때는 발급·CORS·서명·전송 결과·내용 검증·DB 확정을 차례로 분리한다. 결과가 불확실하면 새 파일을 무작정 만들지 않고 기존 ID로 대조하며, 이미 발급한 URL과 지연된 PUT이 남을 수 있다는 사실을 정리 흐름에 반영한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

사전 서명 URL은 검사 완료증이 아니라 특정 저장 요청의 임시 권한이다. 실제 사용 가능한 파일은 서버의 소유자 확인·고정 버전 대조·내용 검사·상태 전환을 거쳐 결정되며, 전송 결과가 불확실할 때는 반복 생성보다 기록된 접수를 대조하는 것이 중요하다.

### 5.2 이전·다음 학습과의 연결

[업로드 수명주기 노트](../46_10_28_Upload_Lifecycle_Quarantine_and_Cleanup/10_28_Upload_Lifecycle_Quarantine_and_Cleanup.md)의 RECEIVING 앞뒤에 브라우저 직접 전송과 완료 검증을 연결했다. 다음에는 **대용량 파일·S3 Multipart Upload와 중단·재개**를 학습해 여러 part의 전송 결과·조립·복합 체크섬·미완료 정리를 다룬다.

### 5.3 더 파볼 만한 주제

직접 업로드 접수의 저장 공간 예약을 여러 요청에서 어떻게 원자적으로 관리할지, 비동기 검증 결과를 사용자 화면에 어떻게 전달할지 확장할 수 있다. S3 이벤트 통지·정기 대조·검사 정책 변경도 중복·순서·버전 식별을 함께 고려해야 한다.

### 5.4 참고 자료

- [S3 사전 서명 URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), [SigV4 쿼리 인증](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-query-string-auth.html) — 권한 위임·유효 기간·서명 입력.
- [Java SDK 사전 서명](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/examples-s3-presign.html), [고정 SDK 서비스 모델](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/resources/codegen-resources/service-2.json), [고정 presigner 구현](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/java/software/amazon/awssdk/services/s3/internal/signing/DefaultS3Presigner.java) — 생성 API·체크섬/버전 필드·서명 헤더.
- [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html), [조건부 쓰기](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html) — 단일 PUT·412/409·현재 버전 조건.
- [POST 정책](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-HTTPPOSTConstructPolicy.html) — content-length-range와 PUT 계약의 차이.
- [S3 체크섬](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html), [HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html) — 무결성·서비스 체크섬·권한과 메타데이터 조회.
- [S3 CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html), [버전 관리 응답](https://docs.aws.amazon.com/AmazonS3/latest/userguide/AddingObjectstoVersioningEnabledBuckets.html) — 요청 허용 헤더·응답 노출·versionId.
- [Web Crypto digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest), [제한된 요청 헤더](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header) — 브라우저 해시 계산과 헤더 제한.
- [SDK timeout](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/timeouts.html), [PostgreSQL Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html) — 외부 대기 제한과 마지막 상태 확정의 경계.

## 6. 요약 정리

- 직접 업로드는 파일 본문의 전송 경로를 바꾸지만 서버의 권한·검증 책임을 없애지 않는다.
- 서버가 소유자·ID·key·기한을 정하고 DB 이력을 확정한 뒤 서명 URL을 발급한다.
- URL과 서명 헤더는 임시 권한이므로 그대로 사용하고 로그·다른 사용자에게 노출하지 않는다.
- 단일 PUT은 원본 File을 보내며 FormData·S3 Multipart Upload와 구분한다.
- 체크섬은 같은 바이트인지 확인하는 값이고 정상·안전한 내용의 증명은 아니다.
- CORS는 브라우저 규칙이며 IAM·서명 검증·소유자 인가를 대신하지 않는다.
- 서버는 고정 versionId의 HEAD·제한된 GET으로 실제 내용을 검증한다.
- 완료 확정은 조건부 QUARANTINED 전환이며 중복 요청은 현재 상태를 되돌리지 않는다.
- 응답 유실·만료·지연 PUT은 기존 ID와 저장 이력을 대조하고 실제 정리까지 추적한다.

🧠 기억할 것: **직접 전송의 성공은 저장소의 응답이고, 사용 승인은 서버가 검증한 버전과 상태의 결정이다.**

## 7. 미니 퀴즈 또는 체크리스트

1. 브라우저에서 AWS secret key 없이 PUT할 수 있는데도 사전 서명 URL을 비밀처럼 다뤄야 하는 이유는?
2. 파일 바이트 대신 FormData를 사전 서명 PUT으로 보내면 왜 체크섬이 달라질 수 있는가?
3. 신고 크기를 64KiB로 제한하고 완료 단계에서 검사했다면 S3에 큰 파일이 들어오는 것 자체도 막았다고 말할 수 있는가?
4. S3 PUT이 성공했지만 브라우저에서 versionId를 읽지 못했다. 어떤 설정과 복구 경로를 확인하는가?
5. 완료 API 응답을 잃은 뒤 같은 ID·versionId로 다시 요청했더니 이미 SCANNING 상태다. QUARANTINED로 되돌려야 하는가?

<details>
<summary>정답과 해설</summary>

1. URL 자체가 특정 작업을 수행할 수 있는 임시 권한이기 때문이다. URL을 가진 다른 사람도 유효한 조건 안에서 사용할 수 있고, 로그아웃이 자동 회수를 뜻하지 않는다.
2. FormData는 boundary·part 헤더 등을 포함한 포장 본문이다. File의 원래 바이트로 계산한 SHA-256과 다르므로 단일 PUT에는 원본 File을 보낸다.
3. 아니다. 이 예제는 저장 후 승인 여부를 검증하며 PUT의 유입 상한을 강제하지 않는다. 저장소에서 크기 범위를 거절해야 한다면 POST 정책의 content-length-range 등 별도 계약이 필요하다.
4. S3 버전 관리와 CORS ExposeHeaders의 x-amz-version-id를 확인한다. 저장 실패로 단정하거나 null 버전으로 완료하지 않고, 인증된 서버가 기존 ID·DB key의 결과에서 후보 버전을 찾아 고정 검증한다.
5. 되돌리지 않는다. 소유자와 확정 버전이 일치하면 현재 처리 상태를 반환한다. 완료 재전송이 검사 단계를 초기화하거나 다른 버전으로 교체하는 효과를 만들면 멱등성이 깨진다.

</details>
