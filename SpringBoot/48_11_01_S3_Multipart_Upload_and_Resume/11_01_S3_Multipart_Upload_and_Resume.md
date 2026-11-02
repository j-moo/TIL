# 대용량 파일·S3 Multipart Upload와 중단·재개

- 🎯 글의 목표: 큰 파일을 part로 나누어 전송하고, 조각의 재시도·완료·중단·재개를 서버의 버전 검증과 격리 상태에 연결한다.
- 🧩 핵심 키워드: S3 Multipart Upload, uploadId, partNumber, ETag, SHA-256, composite checksum, manifest, 완료 대조, Abort, Lifecycle
- ⭐ 중요도: 높음. 큰 파일의 실패를 처음부터 다시 보내지 않으려면 전송 단위와 최종 객체의 확정 단위를 구분해야 하며, 미완료 part도 자원과 비용을 차지한다.
- 📝 한눈에 보는 내용: 분할 규칙 → 접수·세션 식별 → part 체크섬·서명 → 브라우저 전송 → 영속 manifest 대조 → 조립·고정 버전 검증 → 재개·중단·정리
- 🔗 관련 주제: [사전 서명 직접 업로드](../47_10_31_Presigned_Direct_Upload_and_Completion_Verification/10_31_Presigned_Direct_Upload_and_Completion_Verification.md), [업로드 상태·격리와 정리](../46_10_28_Upload_Lifecycle_Quarantine_and_Cleanup/10_28_Upload_Lifecycle_Quarantine_and_Cleanup.md), [제한된 비동기 실행](../31_10_02_Async_and_Thread_Pools/10_02_Async_and_Thread_Pools.md)
- 🧱 선수 지식: Java record·예외·리스트, TypeScript의 File·Blob·Promise·fetch, 사전 서명 URL·CORS, S3 key·versionId, 조건부 DB 갱신

> 기준일: 2026-11-01. 서버는 Java 21·기존 Spring Boot 4.1.2 프로젝트, AWS SDK for Java 2.x 2.31.54를 기준으로 한다. SDK는 이전 노트와 같은 재현용 고정 버전이다. 버전 관리 활성화·비공개 일반 목적 S3 버킷·SSE-S3를 전제로 한다. 예제 정책은 1바이트~2GiB의 바이너리, part 크기 8MiB, SHA-256 COMPOSITE다. 기존 64KiB 텍스트 검증기를 크기만 바꿔 재사용하지 않는다. Java 파일은 기존 프로젝트에 추가하는 핵심 구현이며 인증·DB 어댑터·검사 엔진을 포함한 완성 서비스가 아니다. 실제 검사와 미실행 범위는 3.12에 기록한다.

## 1. 들어가며

큰 파일을 단일 PUT으로 보내다가 거의 끝에서 연결이 끊기면, 같은 파일을 처음부터 다시 전송해야 할 수 있다. 파일을 여러 조각으로 나누면 실패한 조각만 다시 보낼 수 있고, 제한된 수의 조각을 병렬 전송할 수도 있다.

하지만 조각별로 200 응답을 받았다고 최종 파일이 생긴 것은 아니다. 조립 요청의 결과를 확인해야 하며, 조립되었더라도 서버의 내용 검사와 사용 승인은 남는다. 이번 핵심 질문은 **“어떤 조각들이 어느 전송 시도에 속하며, 그 결과를 언제 최종 객체로 확정할 것인가?”**다.

이전 노트의 단일 PUT·완료 대조 원칙을 유지하면서 part 목록·중간 상태·미완료 정리를 추가한다. 예제는 전송 프로토콜과 무결성의 경계를 설명하며 바이너리 형식 자체의 안전성을 판정하는 파서를 제공하지 않는다.

## 2. 핵심 개념 정리

```text
앱 접수 ID·전송 시도 ID 생성 → DB 의도 commit
  → CreateMultipartUpload → S3 uploadId를 DB에 연결
  → part별 범위·고정 체크섬 승인 → UploadPart 서명
  → 브라우저가 part 전송 → partNumber·ETag·체크섬 기록
  → 서버가 완료 목록 동결 → ListParts와 대조
  → CompleteMultipartUpload → 최종 versionId 기록
  → 고정 버전 전체 검증 → QUARANTINED → 정책 검사 후 READY

전송 재개: 같은 전송 시도·같은 파일·같은 part 계획에서 이어감
영구 중단: 새 서명 차단 → 진행 요청 대조 → Abort·잔여 part 정리 확인
```

| 구분 | 의미 |
| --- | --- |
| 앱 접수 ID | 사용자에게 보여 주는 업무 식별자 |
| 전송 시도 ID | 재시작한 전송과 예전 전송을 구분하는 서버 식별자 |
| S3 uploadId | S3가 발급한 multipart 세션 식별자 |
| partNumber | 해당 세션 안의 조각 번호 |
| versionId | 조립된 최종 객체의 불변 버전 식별자 |

이 다섯 값을 섞으면 이전 시도의 응답을 새 파일에 붙이거나, part 목록을 최종 객체 버전처럼 취급하는 문제가 생긴다.

## 3. 본문 정리

### 3.1 같은 multipart라는 이름이어도 HTTP 폼과 다른 프로토콜이다

**S3 Multipart Upload**는 객체 하나를 여러 요청으로 나누어 저장한 뒤 조립하는 S3 프로토콜이다. 애플리케이션 서버에 `multipart/form-data` 본문 하나를 보내는 방식과 다르다. 파일 조각 하나의 PUT 본문에는 FormData 포장이 아니라 해당 범위의 원본 바이트를 보낸다.

Create는 세션을 만들고, UploadPart는 번호별 조각을 저장하며, Complete는 지정한 목록을 번호순으로 이어 붙인다. 최종 객체는 Complete가 성공한 뒤 생긴다. part 번호가 업로드 순서를 뜻하는 것은 아니므로 3번이 1번보다 먼저 도착해도 된다. [S3 multipart 흐름](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)

공식 문서의 한도와 이번 학습 정책은 구분한다.

| 항목 | 공식 한도 또는 동작 | 이번 예제 정책 |
| --- | --- | --- |
| part 번호·개수 | 번호 1~10,000, 최대 10,000개 | 1부터 빠짐없이 연속 사용 |
| part 크기 | 5MiB~5GiB, 마지막 part는 최소 크기 예외 | 기본 8MiB, 마지막만 남은 길이 |
| ListParts 한 응답 | 최대 1,000개 | SDK paginator로 끝까지 조회 |
| 최대 객체 크기 | 기준일 문서에는 48.8TiB | 애플리케이션 승인 상한 2GiB |

MiB는 `1024×1024`바이트이고 GiB는 `1024×1024×1024`바이트다. 이번 값은 공식 최댓값을 모두 지원하려는 설계가 아니며, 오래된 설명의 “최대 5TB”를 현재 한도로 그대로 옮기지 않았다. [S3 multipart 한도](https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html)

### 3.2 part 경계를 고정하면 재시도에서 같은 바이트를 다시 보낼 수 있다

분할 계획은 번호별로 시작 위치와 길이를 정한 규칙이다. 25MiB를 8MiB씩 나누면 `8 + 8 + 8 + 1`MiB의 네 part가 된다. 시작 위치는 0·8·16·24MiB이고, 마지막 조각만 최소 크기 예외에 해당한다.

다음 `MultipartLayout.java`는 `src/main/java/com/example/upload/`에 추가하는 **파일 전체**다. 전체 파일을 읽지 않고 계산만 한다.

```java
package com.example.upload;

public record MultipartLayout(long totalBytes) {
    public static final long PART_BYTES = 8L * 1024 * 1024; // 재시도·메모리 단위인 예제 크기다.
    public static final long MAX_BYTES = 2L * 1024 * 1024 * 1024; // 서비스 정책이며 S3 자체 상한이 아니다.

    public MultipartLayout {
        if (totalBytes < 1 || totalBytes > MAX_BYTES) {
            throw new IllegalArgumentException("invalid total size"); // 빈 파일·정책 초과를 접수하지 않는다.
        }
    }

    public int partCount() {
        return Math.toIntExact((totalBytes + PART_BYTES - 1) / PART_BYTES); // 나머지가 있으면 올림한다.
    }

    public Slice slice(int partNumber) {
        if (partNumber < 1 || partNumber > partCount()) {
            throw new IllegalArgumentException("invalid part number"); // 범위 밖 번호를 서명하지 않는다.
        }
        long offset = (partNumber - 1L) * PART_BYTES; // 첫 part는 파일의 0번 바이트에서 시작한다.
        long length = Math.min(PART_BYTES, totalBytes - offset); // 마지막 part는 남은 바이트만 쓴다.
        return new Slice(partNumber, offset, length);
    }

    public record Slice(int partNumber, long offset, long bytes) {} // 끝 위치가 아니라 길이를 담는다.
}
```

브라우저의 `file.slice(offset, offset + bytes)`는 끝 위치를 포함하지 않는다. 따라서 Java가 계산한 길이를 그대로 더해 범위를 만들 수 있다. 전체 길이가 8MiB의 정확한 배수일 때 0바이트짜리 part를 하나 더 만들지 않는 것도 중요하다.

⚠️ 주의: 재개할 때 part 크기를 임의로 바꾸면 같은 번호가 다른 파일 범위를 뜻한다. 서버 DB에 저장한 계획·총길이·전송 시도를 유지하며, 파일명·lastModified가 같다는 사실만으로 같은 내용이라고 판단하지 않는다.

### 3.3 세션과 part 기록은 메모리가 아니라 복구 가능한 이력으로 남긴다

API는 다음과 같이 나눌 수 있다. 이 표는 **설계 계약**이며 Controller·Repository 전체 구현을 제공하는 것은 아니다. 모든 앱 API는 기존 인증·CSRF·소유자·할당량 검사를 유지한다.

| 앱 API | 역할 |
| --- | --- |
| `POST /multipart-uploads` | 접수와 전송 시도를 생성하고 S3 세션을 연결 |
| `POST /multipart-uploads/{id}/parts/{n}/url` | 해당 part의 최초 체크섬을 고정하고 같은 값으로만 재발급 |
| `PUT /multipart-uploads/{id}/parts/{n}/receipt` | 전송 응답의 ETag·체크섬을 기록; 원격 성공의 무조건적 증명으로 신뢰하지 않음 |
| `POST /multipart-uploads/{id}/complete` | part 목록을 동결하고 서버가 조립·최종 검증을 진행 |
| `GET /multipart-uploads/{id}` | 소유자에게 상태·재개에 필요한 안전한 part 정보 제공 |
| `POST /multipart-uploads/{id}/abort` | 중단 의도를 기록하고 정리 작업을 요청 |

서버는 bucket·key·소유자·총길이·part 크기·기한·전송 시도 ID를 먼저 commit한다. `CreateMultipartUpload` 결과의 S3 uploadId까지 저장된 뒤에만 part URL을 발급한다. Create 응답이나 DB 연결을 잃으면 서버 key별 목록 대조와 정리 대상으로 남기며, 같은 요청을 재호출해도 S3 세션이 정확히 하나만 생긴다고 가정하지 않는다.

예제 저장 key는 `incoming/large/{접수ID}/{시도ID}/body.bin`이다. 새 전송 시도는 새 key를 사용하여 예전 서명 URL이 새 시도의 part를 덮어쓰지 못하게 한다. 사용자에게서 받은 경로나 S3 uploadId로 다른 사용자의 저장 대상을 선택하지 않는다.

part 이력에는 `(앱ID, 시도ID, partNumber)` 유일 제약과 계획 길이·고정 SHA-256·최신 접수 ETag를 둔다. 처음 승인한 체크섬과 다른 값으로 URL을 요청하면 409 등으로 거절한다. 다른 파일로 다시 시작하려면 새 전송 시도를 만들어야 한다.

전송 관리 상태는 `INITIATING → UPLOADING → COMPLETING → VERIFYING → STORED`처럼 별도 이력에 둘 수 있다. 취소는 `ABORTING → ABORTED`로 관리한다. 이것들은 S3 표준 상태가 아니라 예시 업무 상태이며, 기존 `upload_asset`의 `RECEIVING → QUARANTINED → SCANNING → READY`와 구분한다.

### 3.4 part 체크섬·ETag·전체 해시는 서로 다른 값이다

**manifest**는 조립할 part의 번호·ETag·체크섬을 순서대로 기록한 목록이다. 책의 페이지 순서와 실제 받은 페이지 식별자를 함께 적는 것과 비슷하지만, 서버에서는 정확한 바이트와 S3 응답을 대조할 수 있는 데이터여야 한다.

S3에서 같은 uploadId·partNumber로 다시 업로드하면 기존 part가 교체된다. 따라서 재시도는 같은 범위·같은 체크섬으로 보내고, 새 응답의 ETag를 기록한다. ETag는 조립 때 제출할 불투명 식별자이며 따옴표를 임의로 제거하거나 파일 전체 SHA-256이라고 해석하지 않는다. [UploadPart의 덮어쓰기·응답 계약](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html)

이번 예제는 Create에서 SHA-256·COMPOSITE를 정하고, 각 UploadPart에 **해시 바이트 32개의 Base64**를 넣는다. 조립 목록에도 각 part의 체크섬을 넣는다. SHA-256 multipart의 복합 체크섬과 파일 전체를 한 번 해시한 값은 다르다. [S3 체크섬 종류](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)

```text
part 1의 SHA-256        = H(part1 바이트)
part 2의 SHA-256        = H(part2 바이트)
전체 파일 SHA-256      = H(part1 바이트 || part2 바이트 || ...)
SHA-256 복합 체크섬    = part별 해시 바이트를 모아 계산한 복합 값
```

단일 PUT 노트의 `head.checksumSHA256() == 전체 파일 SHA-256` 비교를 그대로 복사하지 않는다. 최종 객체의 checksumType과 선택한 알고리즘에 맞춰 검증해야 한다. 전체 파일의 일반 SHA-256이 필요하면 고정 버전을 스트리밍으로 읽으며 별도로 계산한다.

사용자가 신고한 체크섬은 “이 바이트를 보낼 것”이라는 선언이다. S3의 대조는 전송 무결성을 확인하지만, 악성 내용이 없는지나 신고한 모든 part가 원래 선택한 한 파일에서 왔는지를 자동 증명하지 않는다. 최종 형식·내용 검사는 별도로 수행한다.


### 3.5 서버는 생성한 세션과 고정 체크섬으로만 part를 서명한다

의존성은 이전 노트의 `software.amazon.awssdk:bom:2.31.54`와 `software.amazon.awssdk:s3`를 그대로 사용한다. 다음 `MultipartStarter.java`는 **기존 프로젝트에 추가하는 파일 전체**다. 공유 S3Client·S3Presigner의 region·자격 증명·timeout·종료 처리는 기존 구성에서 제공한다.

생성·part 전송·완료에는 `s3:PutObject`, part 대조에는 `s3:ListMultipartUploadParts`, 중단에는 `s3:AbortMultipartUpload` 권한이 필요하다. 고아 세션을 목록으로 찾는 역할에는 `s3:ListBucketMultipartUploads`도 필요하다. 모든 브라우저나 모든 서버 역할에 버킷 전체 권한을 주는 대신 전용 영역과 작업별 역할로 나눈다. SSE-KMS로 바꾸면 KMS 권한도 다시 확인한다. [작업별 S3 multipart 권한](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)

호출 계층은 인증·소유자·전송 상태·기한을 확인하고, part 체크섬의 최초 고정·동일 값 재발급을 DB에서 확정해야 한다. 아래 클래스 자체는 인증 필터나 DB Repository가 아니며, 생성 응답을 저장하지 않은 채 URL 발급에 사용해서는 안 된다.

```java
package com.example.upload;

import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ChecksumAlgorithm;
import software.amazon.awssdk.services.s3.model.ChecksumType;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.UploadPartRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.UploadPartPresignRequest;

public final class MultipartStarter {
    private final S3Client s3; // 생성 API를 실행하는 서버 측 클라이언트다.
    private final S3Presigner presigner; // part PUT 요청에만 권한을 위임한다.
    private static final Set<String> ALLOWED_HEADERS = Set.of(
            "x-amz-checksum-sha256", "x-amz-sdk-checksum-algorithm");

    public MultipartStarter(S3Client s3, S3Presigner presigner) {
        this.s3 = s3; // 요청마다 새 클라이언트를 만들거나 여기서 close하지 않는다.
        this.presigner = presigner;
    }

    public record Session(UUID id, UUID attemptId, String bucket, String key,
                          String s3UploadId, MultipartLayout layout) {}
    // 서버 DB에서 복원하는 내부 타입이다. 외부 JSON으로 bucket·key·uploadId를 직접 받지 않는다.

    public record PartGrant(int partNumber, String url, Map<String, String> requiredHeaders) {}

    public Session start(UUID id, UUID attemptId, String bucket, MultipartLayout layout) {
        String key = "incoming/large/" + id + "/" + attemptId + "/body.bin"; // 시도별 저장 위치다.
        var response = s3.createMultipartUpload(CreateMultipartUploadRequest.builder()
                .bucket(bucket).key(key) // 접수 이력에 미리 확정한 값과 일치해야 한다.
                .contentType("application/octet-stream") // 최종 객체의 타입은 생성 시 지정한다.
                .metadata(Map.of("app-upload-id", id.toString(), "attempt-id", attemptId.toString()))
                .checksumAlgorithm(ChecksumAlgorithm.SHA256) // 각 part에서 사용할 알고리즘이다.
                .checksumType(ChecksumType.COMPOSITE) // 전체 파일의 일반 SHA-256과 구분한다.
                .build());
        if (response.uploadId() == null || response.uploadId().isBlank()) {
            throw new IllegalStateException("missing S3 upload ID"); // 불확실한 세션을 성공으로 다루지 않는다.
        }
        return new Session(id, attemptId, bucket, key, response.uploadId(), layout);
        // 호출자는 이 결과를 DB에 연결·commit한 뒤에만 signPart를 호출한다.
    }

    public PartGrant signPart(Session session, int number, String frozenSha256, Duration ttl) {
        session.layout().slice(number); // 계획에 없는 번호는 서명하지 않는다.
        requireSha256(frozenSha256); // 32바이트 해시의 정규 Base64 표현인지 검사한다.
        if (ttl.isNegative() || ttl.isZero() || ttl.compareTo(Duration.ofMinutes(2)) > 0) {
            throw new IllegalArgumentException("invalid signature duration"); // 예제의 서명 상한이다.
        }
        var request = UploadPartRequest.builder()
                .bucket(session.bucket()).key(session.key()).uploadId(session.s3UploadId())
                .partNumber(number) // 서명이 특정 세션의 특정 조각 번호에 연결된다.
                .checksumAlgorithm(ChecksumAlgorithm.SHA256)
                .checksumSHA256(frozenSha256) // 이미 DB에 고정한 체크섬과 같은 값만 사용한다.
                .build();
        var signed = presigner.presignUploadPart(UploadPartPresignRequest.builder()
                .signatureDuration(ttl).uploadPartRequest(request).build());
        Map<String, String> headers = new LinkedHashMap<>();
        signed.signedHeaders().forEach((name, values) -> {
            String lower = name.toLowerCase(Locale.ROOT); // 응답 헤더 이름을 한 형태로 맞춘다.
            if (lower.equals("host")) return; // 브라우저가 설정하는 Host는 전달하지 않는다.
            if (!ALLOWED_HEADERS.contains(lower) || values.size() != 1) {
                throw new IllegalStateException("unexpected signed header"); // 예상 밖 계약은 거절한다.
            }
            headers.put(lower, values.get(0)); // 서명에 참여한 값을 바꾸지 않는다.
        });
        if (!frozenSha256.equals(headers.get("x-amz-checksum-sha256"))) {
            throw new IllegalStateException("checksum header missing"); // 무결성 계약이 빠진 서명을 쓰지 않는다.
        }
        return new PartGrant(number, signed.url().toString(), Map.copyOf(headers));
        // URL 전체는 권한이므로 로그·오류 추적 이벤트에 출력하지 않는다.
    }

    static void requireSha256(String encoded) {
        try {
            byte[] digest = Base64.getDecoder().decode(encoded); // hex 문자열이 아닌 해시 바이트를 확인한다.
            if (digest.length != 32 || !Base64.getEncoder().encodeToString(digest).equals(encoded)) {
                throw new IllegalArgumentException("invalid SHA-256");
            }
        } catch (IllegalArgumentException | NullPointerException invalid) {
            throw new IllegalArgumentException("invalid SHA-256"); // 외부 값을 메시지에 반영하지 않는다.
        }
    }
}
```

`ttl`은 호출 계층에서 `min(최대 2분, 접수 기한까지 남은 시간 - 여유)`로 정한다. 만료가 임박했거나 취소·완료 단계로 넘어갔으면 새 서명을 발급하지 않는다. DB 상태 변경이 이미 발급한 URL까지 즉시 취소하지는 않는다.

이 예제는 브라우저가 임의 설정할 수 없는 Content-Length를 서명 헤더에 넣지 않는다. 따라서 8MiB 계획은 승인·조립 검증 규칙이지 유입 바이트의 완전한 강제 상한은 아니다. 실제 part 크기를 ListParts에서 다시 확인하며, 유출된 URL·과도한 세션·큰 part에 대비한 권한·예약 할당량·관찰·기한 정리도 별도 필요하다.

고정 SDK의 서비스 모델에서 Create의 checksumType, UploadPart의 checksumSHA256, Complete의 ifNoneMatch·mpuObjectSize와 part 체크섬 필드를 확인했다. presignUploadPart 메서드도 고정 버전 소스에서 확인했다. 최신 서비스 한도와 오래된 SDK의 API 지원은 같은 사실이 아니다. [2.31.54 서비스 모델](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/resources/codegen-resources/service-2.json), [고정 S3Presigner 소스](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/java/software/amazon/awssdk/services/s3/presigner/S3Presigner.java)

### 3.6 브라우저에서는 파일 전체 대신 조각 하나씩 해시하고 보낸다

이전의 `file.arrayBuffer()`를 2GiB 전체에 적용하면 큰 메모리를 요구한다. 이번에는 8MiB 이하의 Blob 하나만 읽어 SHA-256을 계산한다. `crypto.subtle.digest` 자체가 전체 파일을 스트리밍 해시해 주는 API라고 가정하지 않는다.

다음 `multipart-client.ts`는 **브라우저 프로젝트에 추가하는 전송 도우미 전체**다. 로그인·API JSON 런타임 파싱·URL 발급/receipt 저장·재개 UI는 호출 계층의 책임이다. `Slice`와 `PartGrant`는 인증된 앱 API 응답을 이전 노트처럼 `unknown`에서 검증한 뒤 전달한다. 저장소 출처는 응답의 임의 호스트가 아니라 배포 설정의 `allowedOrigin`을 사용한다.

```typescript
export type Slice = { partNumber: number; offset: number; bytes: number };
export type PreparedPart = { partNumber: number; body: Blob; checksumSHA256: string };
export type PartGrant = {
  partNumber: number; url: string; requiredHeaders: Record<string, string>;
};
export type PartReceipt = { partNumber: number; eTag: string; checksumSHA256: string };

const PART_BYTES = 8 * 1024 * 1024; // 서버의 분할 계획과 같은 고정값이다.
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 이번 앱 정책이며 S3 자체 한도가 아니다.

export async function preparePart(file: File, slice: Slice): Promise<PreparedPart> {
  if (file.size < 1 || file.size > MAX_BYTES) throw new Error("파일 크기를 확인하세요.");
  const count = Math.ceil(file.size / PART_BYTES); // 파일을 다시 선택했을 때의 계획도 대조한다.
  const offset = (slice.partNumber - 1) * PART_BYTES;
  const bytes = Math.min(PART_BYTES, file.size - offset);
  if (!Number.isInteger(slice.partNumber) || slice.partNumber < 1 || slice.partNumber > count
      || slice.offset !== offset || slice.bytes !== bytes) {
    throw new Error("서버의 part 계획과 파일이 일치하지 않습니다.");
  }
  const body = file.slice(slice.offset, slice.offset + slice.bytes); // 끝 위치는 포함하지 않는다.
  const hash = await crypto.subtle.digest("SHA-256", await body.arrayBuffer()); // 이 조각만 읽는다.
  const encoded = btoa(Array.from(new Uint8Array(hash), n => String.fromCharCode(n)).join(""));
  return { partNumber: slice.partNumber, body, checksumSHA256: encoded }; // 이 Blob으로만 PUT한다.
}

export async function putPreparedPart(
  part: PreparedPart, grant: PartGrant, allowedOrigin: string,
  signal?: AbortSignal, transport: typeof fetch = fetch,
): Promise<PartReceipt> {
  const url = new URL(grant.url);
  if (url.protocol !== "https:" || url.origin !== allowedOrigin
      || url.username || url.password || url.hash || grant.partNumber !== part.partNumber) {
    throw new Error("허용하지 않는 part 전송 대상입니다."); // 서명 URL 원문을 오류에 넣지 않는다.
  }
  const names = Object.keys(grant.requiredHeaders);
  if (names.some(name => !["x-amz-checksum-sha256", "x-amz-sdk-checksum-algorithm"].includes(name))
      || grant.requiredHeaders["x-amz-checksum-sha256"] !== part.checksumSHA256
      || (grant.requiredHeaders["x-amz-sdk-checksum-algorithm"] !== undefined
          && grant.requiredHeaders["x-amz-sdk-checksum-algorithm"] !== "SHA256")) {
    throw new Error("서명 체크섬 계약이 일치하지 않습니다.");
  }
  const response = await transport(grant.url, {
    method: "PUT", headers: grant.requiredHeaders, body: part.body, // FormData로 포장하지 않는다.
    credentials: "omit", mode: "cors", redirect: "error", referrerPolicy: "no-referrer",
    signal, // 로컬 중단이며 원격 part의 부재를 보장하지 않는다.
  });
  if (!response.ok) throw new Error("part 결과 대조 필요: HTTP " + response.status);
  const eTag = response.headers.get("ETag"); // 따옴표를 포함한 응답 값을 그대로 기록한다.
  const checksum = response.headers.get("x-amz-checksum-sha256");
  if (!eTag || checksum !== part.checksumSHA256) {
    throw new Error("part 응답 헤더 확인이 필요합니다."); // CORS 노출 누락과 원격 실패를 혼동하지 않는다.
  }
  return { partNumber: part.partNumber, eTag, checksumSHA256: checksum };
}
```

호출 순서는 `preparePart → 앱 API에서 고정 체크섬 승인·서명 → putPreparedPart → receipt를 앱 API에 저장`이다. 네트워크 예외나 receipt 저장 실패가 나면 S3에 저장되지 않았다고 단정하지 않는다. 실패 결과를 숨겨 새 전송 시도를 자동 생성하는 기능도 이 도우미에 넣지 않았다.

S3 CORS에는 실제 앱 출처와 PUT·서명 체크섬 헤더를 허용하고, `ETag`·`x-amz-checksum-sha256`를 ExposeHeaders로 노출해야 한다. part 응답에는 최종 객체 versionId를 기대하지 않는다. CORS는 브라우저의 접근 규칙일 뿐 IAM·앱 소유자 검사·서명 검증의 대체물이 아니다. [S3 CORS 설정 요소](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html)

병렬 전송은 예를 들어 3개 작업만 동시에 실행하도록 제한할 수 있다. 이 값은 예시다. 모든 part를 `Promise.all`로 한꺼번에 해시·전송하면 파일 크기에 비례해 메모리·연결이 늘 수 있으므로 해시 작업과 전송 작업 모두 같은 동시성 한도 안에서 관리한다.

### 3.7 재개는 새 URL을 받는 것이 아니라 같은 전송 이력을 복원하는 것이다

앱 ID·시도 ID·분할 계획·part별 체크섬과 receipt를 보존해야 재개할 수 있다. 새로고침 뒤에도 File 객체가 자동 복구된다고 가정하지 않는다. 사용자가 파일을 다시 선택하게 하고, 적어도 이미 고정된 part들의 체크섬을 재계산해 서버 이력과 대조한다.

파일명·크기·수정 시각만 같아도 중간 내용은 다를 수 있다. 체크섬이 맞지 않으면 해당 시도의 part를 조용히 교체하지 않고 새 업로드로 시작한다. 아직 고정하지 않은 part까지 포함한 원본 전체 동일성이 필요하면 별도의 전체 파일 fingerprint 정책이 필요하다.

S3의 ListParts는 저장된 번호·ETag·크기·체크섬을 **대조하는 자료**로 사용한다. AWS는 완료 목록을 ListParts 결과만으로 새로 만드는 대신, 전송 때 기록한 번호·ETag 목록을 유지하라고 설명한다. receipt를 양쪽 모두 잃었다면 이번 정책은 원래 고정 체크섬의 part만 다시 전송하여 새 receipt를 기록한다. [multipart 목록과 완료 목록의 역할](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html#multipart-upload-listings)

동일 part를 재전송하는 동안 같은 번호의 다른 전송을 동시에 시작하지 않는다. 오래된 요청이 뒤늦게 끝나면 최신 receipt와 원격 ETag가 어긋날 수 있기 때문이다. 오류별 처리는 다음처럼 구분한다.

| 상황 | 다음 행동 |
| --- | --- |
| part URL 만료·403 | 소유자·전송 상태·접수 기한 확인 후 같은 체크섬으로 재발급; 모든 403을 만료로 단정하지 않음 |
| part 전송 응답 유실 | 원격 대조 또는 같은 part·같은 바이트를 제한적으로 재전송 |
| receipt 저장 응답 유실 | 같은 receipt 재등록·상태 조회; 다른 시도로 옮기지 않음 |
| 브라우저 일시 중지 | 새 작업 예약 중지·진행 요청 결과 수집; 완료/Abort를 자동 실행하지 않음 |
| 파일 불일치·전송 기한 종료 | 기존 시도 중단·정리 후 새 접수/시도 정책 적용 |

사전 서명 URL의 만료, 앱 접수 기한, S3 multipart 세션의 수명은 서로 다르다. S3 세션은 URL이 만료되었다고 저절로 끝나지 않으므로 별도 중단·Lifecycle 정리가 필요하다.

### 3.8 서버는 영속 목록과 원격 part를 대조한 뒤 조립한다

완료 요청을 받으면 DB에서 현재 시도를 `UPLOADING → COMPLETING`으로 조건부 전환하고, 전송 때 기록한 part 목록을 동결한다. 이후 새 URL·receipt 변경을 막고, 다른 완료/중단 작업이 같은 시도를 맡지 못하게 작업 token·lease를 사용한다. S3 대기는 DB 트랜잭션 밖에서 수행한다.

다음 `MultipartFinisher.java`는 **파일 전체**다. `PartAck`는 DB에 동결한 receipt이며 요청 JSON을 그대로 신뢰한 목록이 아니다. 여기서는 S3 목록을 완료 목록으로 대체하지 않고, 계획·receipt와 다르면 조립하지 않는다.

```java
package com.example.upload;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import com.example.upload.MultipartStarter.Session;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.AbortMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.ChecksumType;
import software.amazon.awssdk.services.s3.model.CompleteMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompletedMultipartUpload;
import software.amazon.awssdk.services.s3.model.CompletedPart;
import software.amazon.awssdk.services.s3.model.ListPartsRequest;
import software.amazon.awssdk.services.s3.model.Part;

public final class MultipartFinisher {
    private final S3Client s3;

    public MultipartFinisher(S3Client s3) { this.s3 = s3; }

    public record PartAck(int partNumber, String eTag, String checksumSHA256) {}
    public record StoredObject(String versionId, String eTag) {} // 객체 생성 결과이며 사용 승인이 아니다.

    public StoredObject complete(Session session, List<PartAck> frozenAcks) {
        List<Part> remote = new ArrayList<>();
        var request = ListPartsRequest.builder().bucket(session.bucket())
                .key(session.key()).uploadId(session.s3UploadId()).build();
        for (var page : s3.listPartsPaginator(request)) { // 첫 1,000개만 조회하고 끝내지 않는다.
            remote.addAll(page.parts());
            require(remote.size() <= session.layout().partCount(), "unexpected extra parts");
        }
        List<CompletedPart> parts = checkedManifest(session.layout(), frozenAcks, remote);
        var response = s3.completeMultipartUpload(CompleteMultipartUploadRequest.builder()
                .bucket(session.bucket()).key(session.key()).uploadId(session.s3UploadId())
                .multipartUpload(CompletedMultipartUpload.builder().parts(parts).build())
                .checksumType(ChecksumType.COMPOSITE) // Create의 설정과 같은 계약이다.
                .mpuObjectSize(session.layout().totalBytes()) // 조립할 총길이도 S3에 전달한다.
                .ifNoneMatch("*") // 현재 객체가 생겼다면 무조건 덮어쓰지 않는다.
                .build());
        require(response.versionId() != null && !response.versionId().isBlank()
                && !response.versionId().equals("null"), "specific version required");
        return new StoredObject(response.versionId(), response.eTag());
        // 호출자는 이 버전을 조건부 저장하고 VERIFYING으로 넘긴다. 여기서 READY로 만들지 않는다.
    }

    public void abortOnce(Session session) {
        s3.abortMultipartUpload(AbortMultipartUploadRequest.builder()
                .bucket(session.bucket()).key(session.key()).uploadId(session.s3UploadId()).build());
        // 호출 성공 하나만으로 잔여 part·이미 완성된 객체까지 모두 정리되었다고 확정하지 않는다.
    }

    public static List<CompletedPart> checkedManifest(
            MultipartLayout layout, List<PartAck> frozenAcks, List<Part> remote) {
        int count = layout.partCount();
        require(frozenAcks.size() == count && remote.size() == count, "incomplete manifest");
        Map<Integer, PartAck> acks = new HashMap<>();
        for (PartAck ack : frozenAcks) {
            layout.slice(ack.partNumber()); // 접수 계획 밖 번호를 거절한다.
            MultipartStarter.requireSha256(ack.checksumSHA256()); // 고정 체크섬 형식을 검사한다.
            require(ack.eTag() != null && !ack.eTag().isBlank(), "missing ETag");
            require(acks.put(ack.partNumber(), ack) == null, "duplicate receipt");
        }
        Map<Integer, Part> stored = new HashMap<>();
        for (Part part : remote) {
            Integer number = part.partNumber();
            require(number != null && number >= 1 && number <= count, "unexpected part number");
            require(stored.put(number, part) == null, "duplicate remote part");
        }
        List<CompletedPart> ordered = new ArrayList<>();
        for (int number = 1; number <= count; number++) { // 완료 목록은 도착순이 아니라 번호순이다.
            PartAck ack = acks.get(number);
            Part part = stored.get(number);
            require(ack != null && part != null, "missing part");
            require(Objects.equals(part.size(), layout.slice(number).bytes()), "part size mismatch");
            require(ack.eTag().equals(part.eTag()), "ETag mismatch"); // 최신 원격 part와 같은 응답인가?
            require(ack.checksumSHA256().equals(part.checksumSHA256()), "checksum mismatch");
            ordered.add(CompletedPart.builder().partNumber(number).eTag(ack.eTag())
                    .checksumSHA256(ack.checksumSHA256()).build()); // 동결한 receipt로 조립 목록을 만든다.
        }
        return List.copyOf(ordered);
    }

    private static void require(boolean condition, String reason) {
        if (!condition) throw new IllegalStateException(reason); // 원격 원문·서명 URL은 메시지에 넣지 않는다.
    }
}
```

ListParts에는 아직 완료되지 않은 전송이 포함되지 않을 수 있다. 따라서 클라이언트의 진행 요청을 정리하고 receipt를 모은 뒤 완료를 요청해야 한다. 이미 발급한 URL은 상태 전환만으로 취소되지 않지만, 이 예제에서는 같은 번호의 체크섬을 고정하고 Complete에 ETag·체크섬을 제출하여 임의의 다른 part로 조용히 조립되지 않게 한다. [ListParts API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html)

`mpuObjectSize`는 조립할 객체의 기대 총길이다. S3가 실제 크기와 불일치하면 오류를 반환하지만, 개별 UploadPart 유입 크기의 사전 상한을 대신하지는 않는다. `If-None-Match: *`도 현재 객체를 기준으로 검사하며 진행 중인 다른 MPU를 모두 차단하는 전역 잠금이 아니다. [CompleteMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html), [조건부 쓰기](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)

⚠️ 주의: Complete는 처리 중 먼저 HTTP 200 헤더를 보내고 본문에 오류를 담을 수 있다. 원시 HTTP 상태만 보고 성공 처리하면 안 된다. AWS SDK는 이 오류를 처리하므로 SDK의 정상 반환·예외를 확인하되, 네트워크 응답 유실 뒤 원격 생성 여부가 불확실한 상황은 여전히 대조해야 한다.


### 3.9 조립 결과를 고정 버전의 검증으로 연결하기

Complete 응답의 versionId는 후속 검증의 출발점이다. 서버는 그 값을 DB의 현재 시도·완료 token과 함께 조건부 저장한 뒤 `VERIFYING`으로 넘긴다. 이후 HEAD/GET은 같은 bucket·key·versionId를 사용하며 최신 key로 바꾸지 않는다.

검증자는 총길이·형식 메타데이터·접수 ID/시도 ID를 대조하고, 실제 바이트를 스트리밍으로 읽어 동결한 part 체크섬 및 전체 길이와 비교한다. 일반 파일 SHA-256도 실제 바이트에서 새로 계산한다. 검사 시간·읽기 한도·저장소 timeout을 두고, 실패한 버전을 사용 승인하지 않는다.

⚠️ 주의: 이전 46번의 교육용 DDL에는 `byte_size <= 65536`과 필수 전체 해시가 있고 텍스트 정책을 전제로 한다. 이번 2GiB 바이너리에 그 테이블·검증기를 그대로 적용할 수 없다. 별도 대용량 접수/세션/part 이력과 형식별 정책을 만들거나, Flyway로 길이 제약·신고값/검증값·검사 한도를 명시적으로 확장해야 한다. 이 노트는 그 DB 마이그레이션·저장 어댑터·바이너리 검사 엔진을 구현하지 않는다.

다음 `MultipartBodyVerifier.java`는 **제공받은 스트림의 무결성을 확인하는 파일 전체**다. 검증 대상은 서버가 동결한 manifest이며 안전한 파일 형식인지까지 판정하지 않는다. InputStream을 연 S3 어댑터가 성공 시 close, 중도 실패 시 abort·close를 책임진다.

```java
package com.example.upload;

import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import com.example.upload.MultipartFinisher.PartAck;

public final class MultipartBodyVerifier {
    private MultipartBodyVerifier() {}

    public static String sha256(InputStream input, MultipartLayout layout,
                                List<PartAck> frozenAcks) throws IOException {
        Map<Integer, String> expected = new HashMap<>();
        for (PartAck ack : frozenAcks) {
            layout.slice(ack.partNumber()); // 계획 범위 밖 번호를 거절한다.
            MultipartStarter.requireSha256(ack.checksumSHA256());
            if (expected.put(ack.partNumber(), ack.checksumSHA256()) != null) {
                throw new IllegalArgumentException("duplicate part checksum");
            }
        }
        if (expected.size() != layout.partCount()) {
            throw new IllegalArgumentException("incomplete checksum manifest");
        }
        MessageDigest full = digest(); // 전체 파일의 일반 SHA-256을 계산한다.
        byte[] buffer = new byte[64 * 1024]; // 전체 파일 크기와 무관한 읽기 버퍼다.
        for (int number = 1; number <= layout.partCount(); number++) {
            MessageDigest part = digest(); // part 경계마다 해시 계산기를 새로 시작한다.
            long remaining = layout.slice(number).bytes(); // 이번 part에서 정확히 읽어야 할 양이다.
            while (remaining > 0) {
                int count = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                if (count < 0) throw new EOFException("object shorter than planned");
                if (count == 0) continue; // 아무 바이트도 읽지 않았다면 해시·길이를 갱신하지 않는다.
                part.update(buffer, 0, count); // 실제 읽은 범위만 이 part의 해시에 반영한다.
                full.update(buffer, 0, count); // 같은 바이트를 전체 파일 해시에도 반영한다.
                remaining -= count;
            }
            String actual = Base64.getEncoder().encodeToString(part.digest());
            if (!actual.equals(expected.get(number))) {
                throw new IOException("part checksum mismatch"); // 서로 다른 파일 조각의 혼합도 거절한다.
            }
        }
        if (input.read() != -1) throw new IOException("object longer than planned");
        return HexFormat.of().formatHex(full.digest()); // 일반 전체 해시이며 S3 복합 값과 다를 수 있다.
    }

    private static MessageDigest digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }
}
```

버퍼가 64KiB라고 전체 검증 비용까지 작아지는 것은 아니다. 2GiB 객체는 여전히 2GiB를 읽는다. 따라서 HTTP 완료 요청에서 작업이 끝날 때까지 장시간 대기시키기보다 버전 기록 후 202 등으로 비동기 검증 접수를 알리고, 상태 조회·작업 재시작을 연결할 수 있다.

무결성 검증과 형식 검증이 완료되면 실제 버전·길이·전체 해시·검사 정책을 조건부로 기록해 `QUARANTINED`로 연결한다. 최종 READY는 이전 격리 검사 흐름이 맡는다. 전용 바이너리 검사 정책이 없거나 검증을 완료하지 못했다면 다운로드를 열지 않는다. [HEAD와 고정 버전 메타데이터](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)

### 3.10 완료 응답 유실과 영구 중단은 같은 복구가 아니다

Complete가 timeout되었다고 part가 남아 있다고도, 객체가 없다고도 확정할 수 없다. 성공했지만 응답만 유실되었다면 같은 uploadId의 ListParts/Complete가 `NoSuchUpload`를 돌려줄 수 있다.

복구자는 앱 ID·시도 ID·DB key를 기준으로 후보 버전을 발견하고, 메타데이터·길이·동결한 part 내용까지 검증한 뒤 그 버전을 고정한다. 저장 위치에 다른 쓰기 주체가 있거나 후보가 여러 개면 검증 없이 “최신이 정답”이라고 고르지 않는다. 완료 작업의 lease가 끝났다고 이전 S3 호출이 취소된 것도 아니므로, 늦은 결과는 DB의 현재 작업 token·상태와 다시 대조한다.

| 완료 단계의 결과 | 해석과 대응 |
| --- | --- |
| SDK 정상 반환 + versionId | 해당 버전을 저장하고 VERIFYING 진행 |
| timeout·연결 끊김 | 결과 불확실; 기존 시도의 원격 객체와 DB 대조 |
| 412 | 이미 객체가 있을 수 있음; 기존 성공·충돌을 대조 |
| 조건부 Complete의 409 | 같은 요청만 반복하지 않음; 대조 후 재시작이 필요하면 새 MPU·새 시도로 전송 |
| NoSuchUpload | 미존재·이미 완료·이미 중단 가능성을 구분 |
| DB 완료 기록 실패 | 원격 객체를 즉시 삭제하지 말고 같은 시도의 확정 결과를 복구 |

조건부 Complete의 409에는 새 multipart 업로드 시작과 part 재전송이 필요할 수 있다. 다만 업무 상태를 대조하지 않은 채 새 세션을 무한히 만드는 재시도는 하지 않는다. [조건부 Complete 충돌 동작](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html#conditional-write-behavior)

영구 중단은 다음 **의사 코드** 흐름으로 별도 처리한다.

```text
1. 소유자 확인 후 현재 시도를 조건부 ABORTING으로 전환한다.
2. 새 part 서명·receipt 변경·새 Complete 시작을 차단한다.
3. 브라우저의 새 작업을 멈추고 진행 중 요청·서버의 완료 작업 결과를 대조한다.
4. 서버가 DB의 bucket·key·uploadId로 AbortMultipartUpload를 실행한다.
5. 진행 중 part가 뒤늦게 끝났을 수 있으므로 잔여 part를 확인하고 필요하면 다시 Abort한다.
6. Complete가 앞서 성공했다면 별도의 최종 객체 버전 삭제 흐름으로 연결한다.
7. 미완료 part·완성 객체의 불확실성이 남으면 정리 대기 상태로 추적한다.
```

Abort 응답 하나만으로 모든 공간을 바로 반환했다고 보장하지 않는다. S3는 진행 중 part 요청이 Abort 뒤에도 성공하거나 실패할 수 있으며, 잔여 part 대조와 반복 중단이 필요할 수 있다고 설명한다. 이미 완성된 객체의 버전은 MPU Abort가 삭제해 주지 않는다. [AbortMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html)

브라우저 `AbortController`는 로컬 대기와 요청 전송을 중단하는 수단이지 원격 part·최종 객체 삭제 API가 아니다. 완료와 취소가 경쟁하면 DB token만으로 원격 부수 효과까지 사라졌다고 가정하지 말고, 취소된 시도에 남은 비공개 객체도 정리 대상으로 대조한다.

### 3.11 미완료 part의 수명과 Lifecycle을 별도로 관리하기

미완료 MPU는 URL 만료나 브라우저 종료만으로 자동 정리되지 않는다. 서버의 취소/만료 작업이 기본 경로이고, 버킷 Lifecycle은 누락·고아 세션을 위한 추가 안전망으로 둔다. 아래는 버킷 설정에 **검토 후 합칠 JSON 예시**이며 이번 작업에서 실제 AWS 설정을 변경한 것은 아니다.

```json
{
  "Rules": [
    {
      "ID": "abort-stale-large-upload-parts",
      "Status": "Enabled",
      "Filter": { "Prefix": "incoming/large/" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}
```

`Prefix`는 전용 저장 영역으로 범위를 좁힌다. 7일은 예시이며 MPU 시작 시각을 기준으로 오래된 미완료 업로드가 중단 대상이 되도록 한다. 이 설정은 앱의 접수 기한·공개 기한이나 검사 상태를 이해하지 않는다.

Lifecycle은 이미 조립된 객체·DB 행·감사 이력을 정리하는 정책이 아니다. MPU 목록 대조도 페이지가 나뉠 수 있으므로 첫 응답만 보고 전체가 정리되었다고 판단하지 않는다. 기존 버킷 규칙을 통째로 덮어쓰는 배포 명령을 그대로 실행하지 말고 정책 충돌·보존 요구·권한을 먼저 검토한다. [미완료 MPU Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html)

운영에서는 오래된 UPLOADING/COMPLETING, 미완료 part의 저장량, 반복 재발급·재전송, 완료 대조 지연, ABORTING 잔여 작업을 관찰한다. 원격 정리가 끝나지 않았는데 DB 예약 공간을 먼저 모두 반환하면 할당량과 실제 비용이 어긋날 수 있다. 관찰 로그에는 앱 ID·시도·part 번호·결과 코드만 남기고 서명 URL·파일 원문은 제외한다.

### 3.12 실행 가능한 도우미 검사와 Java·S3 미실행 범위를 구분하기

[check_client.mjs](./check_client.mjs)는 이 노트의 TypeScript 블록을 읽어 Node.js의 타입 제거 기능으로 실행하는 회귀 검사다. Node.js 24 이상에서 저장소 루트의 다음 명령으로 실행할 수 있다.

```powershell
# 실제 전송 없이 File·Blob·해시·모의 fetch 응답을 검사한다.
node SpringBoot/48_11_01_S3_Multipart_Upload_and_Resume/check_client.mjs
```

이번에는 Node.js 24.18.0에서 **9개 검사 통과**를 확인했다. 5바이트 해시, 8MiB 경계 뒤 마지막 1바이트, 잘못된 계획, 정상 PUT 계약과 따옴표 ETag 보존, 다른 호스트·다른 체크섬·다른 part 번호의 전송 전 거절, ETag 누락, HTTP 실패를 확인했다.

이 검사는 TypeScript의 정적 타입 검사 `tsc --noEmit`이 아니다. 타입을 제거하고 도우미 동작을 실행한 것이며, 실제 브라우저 메모리·CORS·SigV4·S3 저장을 검증하지 않는다. 사용한 Node 타입 제거 API는 실험적 경고를 출력할 수 있다. 가짜 transport만 사용하므로 AWS 네트워크 요청은 수행하지 않았다.

Java 파일을 검증할 때는 기존 Java 21 프로젝트의 `src/test/java/com/example/upload/MultipartRulesTest.java`에 아래 **테스트 파일 전체**를 추가할 수 있다. JUnit과 S3 SDK 의존성이 필요하며, 실제 S3 호출은 없는 규칙 검사다.

```java
package com.example.upload;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import org.junit.jupiter.api.Test;
import com.example.upload.MultipartFinisher.PartAck;
import software.amazon.awssdk.services.s3.model.Part;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MultipartRulesTest {
    private static final long MIB = 1024L * 1024;
    private static final String HASH = Base64.getEncoder().encodeToString(new byte[32]);
    // 목록 구조 테스트의 고정 체크섬이다. 실제 8MiB 데이터의 해시라고 주장하지 않는다.

    @Test
    void splits25MiBIntoFourParts() {
        MultipartLayout layout = new MultipartLayout(25 * MIB);
        assertEquals(4, layout.partCount());
        assertEquals(24 * MIB, layout.slice(4).offset());
        assertEquals(MIB, layout.slice(4).bytes()); // 마지막만 1MiB이며 허용되는 예외다.
    }

    @Test
    void exactMultipleAndSmallFileHaveNoEmptyPart() {
        assertEquals(2, new MultipartLayout(16 * MIB).partCount());
        assertEquals(1, new MultipartLayout(1).partCount());
        assertEquals(1L, new MultipartLayout(1).slice(1).bytes());
    }

    @Test
    void rejectsInvalidSizeAndNumber() {
        assertThrows(IllegalArgumentException.class, () -> new MultipartLayout(0));
        assertThrows(IllegalArgumentException.class,
                () -> new MultipartLayout(MultipartLayout.MAX_BYTES + 1));
        assertThrows(IllegalArgumentException.class, () -> new MultipartLayout(1).slice(0));
    }

    @Test
    void sortsFrozenReceiptsByPartNumber() {
        var layout = new MultipartLayout(9 * MIB);
        var result = MultipartFinisher.checkedManifest(layout,
                List.of(ack(2, "\"two\""), ack(1, "\"one\"")),
                List.of(remote(1, 8 * MIB, "\"one\"", HASH), remote(2, MIB, "\"two\"", HASH)));
        assertEquals(1, result.get(0).partNumber().intValue());
        assertEquals(2, result.get(1).partNumber().intValue());
    }

    @Test
    void rejectsMissingOrDuplicateReceipts() {
        var layout = new MultipartLayout(9 * MIB);
        var remote = List.of(remote(1, 8 * MIB, "\"one\"", HASH), remote(2, MIB, "\"two\"", HASH));
        assertThrows(IllegalStateException.class,
                () -> MultipartFinisher.checkedManifest(layout, List.of(ack(1, "\"one\"")), remote));
        assertThrows(IllegalStateException.class,
                () -> MultipartFinisher.checkedManifest(layout,
                        List.of(ack(1, "\"one\""), ack(1, "\"one\"")), remote));
    }

    @Test
    void rejectsChangedSizeETagOrChecksum() {
        var layout = new MultipartLayout(5);
        var acks = List.of(ack(1, "\"one\""));
        for (Part changed : List.of(
                remote(1, 6, "\"one\"", HASH), // 길이가 계획과 다르다.
                remote(1, 5, "\"other\"", HASH), // part가 재전송되어 ETag가 바뀌었다.
                remote(1, 5, "\"one\"", "wrong"))) { // 고정 체크섬과 다르다.
            assertThrows(IllegalStateException.class,
                    () -> MultipartFinisher.checkedManifest(layout, acks, List.of(changed)));
        }
    }

    @Test
    void verifiesActualBytesAndRejectsShortOrExtraBody() throws Exception {
        byte[] body = "hello".getBytes(StandardCharsets.UTF_8);
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(body);
        var layout = new MultipartLayout(body.length);
        var acks = List.of(new PartAck(1, "\"one\"", Base64.getEncoder().encodeToString(digest)));
        assertEquals(HexFormat.of().formatHex(digest),
                MultipartBodyVerifier.sha256(new ByteArrayInputStream(body), layout, acks));
        assertThrows(IOException.class, () -> MultipartBodyVerifier.sha256(
                new ByteArrayInputStream("hell".getBytes(StandardCharsets.UTF_8)), layout, acks));
        assertThrows(IOException.class, () -> MultipartBodyVerifier.sha256(
                new ByteArrayInputStream("hello!".getBytes(StandardCharsets.UTF_8)), layout, acks));
    }

    private static PartAck ack(int number, String eTag) {
        return new PartAck(number, eTag, HASH); // 목록 대조용 테스트 receipt다.
    }

    private static Part remote(int number, long size, String eTag, String hash) {
        return Part.builder().partNumber(number).size(size).eTag(eTag).checksumSHA256(hash).build();
    }
}
```

위 테스트를 추가한 **Java 예제 프로젝트 루트**에서 다음 명령을 실행한다. TIL 저장소 자체에는 Gradle Wrapper가 없으므로 실행 위치를 혼동하지 않는다.

```powershell
# 예상: 7개 테스트 메서드가 통과한다. 이번 작업에서는 실행하지 않았다.
.\gradlew.bat test --tests com.example.upload.MultipartRulesTest
```

실제 통합 시험에는 다음 범위를 추가해야 한다.

| 시험 | 기대하는 확인점 |
| --- | --- |
| 25MiB 파일·번호 역순/제한된 병렬 전송 | 4개 part와 최종 바이트가 계획과 일치 |
| part 응답·receipt 저장 응답 유실 | 같은 시도·같은 part로 복구하며 다른 파일이 섞이지 않음 |
| 새로고침·다른 파일 재선택 | 서버 체크섬/계획 불일치 시 재개를 거절 |
| 작은 maxParts를 지정한 요청 또는 모의 원격 페이지 | paginator가 다음 페이지까지 대조; 현재 기본 계획은 최대 256개 part임을 구분 |
| Complete 200 본문의 오류·응답 유실 | 실패/불확실 결과를 구분하고 versionId 대조 수행 |
| Complete·Abort 경쟁·늦은 part 완료 | 취소된 업로드가 READY가 되지 않으며 잔여 part/객체를 정리 |
| 다른 소유자의 ID·만료·할당량 초과 | 새 서명·완료·재개를 권한 경계에서 거절 |
| 복합 체크섬·일반 전체 SHA-256 | 서로 다른 값을 혼동하지 않고 실제 바이트로 검증 |
| 검증 중 프로세스 종료 | 고정 버전·작업 token으로 복구하고 승인 누락을 방지 |

이번 작업에서 공식 서비스/API·고정 SDK 모델을 대조하고, Node 도우미 9개 검사 및 저장소 문서 검사·점검 도구 회귀 테스트를 실행했다. PATH에서 Java·javac·Maven·Gradle·psql을 찾지 못해 Java 컴파일·JUnit·DB 경쟁 시험은 실행하지 않았다. 실제 AWS 생성·업로드·삭제·Lifecycle 변경·브라우저 CORS 시험도 하지 않았다.

## 4. 적용 관점에서 다시 보기

큰 파일 업로드는 “단일 PUT의 크기 제한만 올리기”로 확장하지 않는다. 먼저 분할 계획과 전송 시도를 고정하고, part별 체크섬·receipt를 영속 기록한 뒤 조립 목록을 동결한다. 전송과 해시는 유한한 동시성으로 실행한다.

재개 문제는 파일과 계획의 일치부터, 완료 문제는 영속 manifest와 원격 part의 일치부터 확인한다. 조립 응답이 불확실하면 기존 시도의 versionId를 대조하고, 영구 중단이면 새 권한을 막은 뒤 미완료 part와 이미 생긴 객체를 나누어 정리한다.

마지막 경계는 여전히 고정 버전 검증·격리 검사·소유자별 제공이다. part 전송 성공·조립 성공·검사 대기·READY를 같은 화면 문구 하나로 합치지 않으면 장애 위치와 남은 작업을 구분하기 쉽다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

분할 전송은 실패를 작은 단위로 복구하게 하지만 세션·part 목록·조립·중단이라는 새 경계를 만든다. 재개 가능성은 브라우저의 기억이 아니라 서버의 전송 이력과 고정 체크섬·버전 대조에서 나온다.

### 5.2 이전·다음 학습과의 연결

[단일 PUT 직접 업로드](../47_10_31_Presigned_Direct_Upload_and_Completion_Verification/10_31_Presigned_Direct_Upload_and_Completion_Verification.md)의 서명·완료 검증을 part 단위로 확장하고 [격리·정리](../46_10_28_Upload_Lifecycle_Quarantine_and_Cleanup/10_28_Upload_Lifecycle_Quarantine_and_Cleanup.md)로 연결했다. 다음에는 [업로드 통합 테스트·실패 주입과 정합성 검증](../49_11_02_Upload_Integration_Testing_and_Consistency/11_02_Upload_Integration_Testing_and_Consistency.md)을 학습해 DB·S3·브라우저 경계의 미실행 시나리오를 실제 증거로 나누는 방법을 정리한다.

### 5.3 더 파볼 만한 주제

전체 파일의 증분 해시를 별도 Web Worker에서 계산하거나, 동시성·part 크기를 네트워크 조건에 맞게 선택하는 방법을 확장할 수 있다. S3 이벤트 통지와 대조 작업을 추가할 때도 중복·순서·시도 ID·고정 버전을 유지해야 한다.

### 5.4 참고 자료

- [S3 multipart 흐름](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html), [한도](https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html) — 세션·조립·목록 역할과 현재 크기·개수 제한.
- [UploadPart](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html), [ListParts](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html) — 번호 재사용·ETag·크기·체크섬·페이지 대조.
- [CompleteMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html), [조건부 쓰기](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html) — 총길이·목록·200 내부 오류·412/409의 복구 경계.
- [S3 체크섬](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html), [HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html) — COMPOSITE/FULL_OBJECT 구분과 고정 버전 검증.
- [AbortMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html), [미완료 MPU Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html) — 진행 중 part·반복 정리·완성 객체와의 차이.
- [SDK 2.31.54 서비스 모델](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/resources/codegen-resources/service-2.json), [S3Presigner](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/java/software/amazon/awssdk/services/s3/presigner/S3Presigner.java) — 예제에서 사용한 고정 버전 필드·서명 메서드. 읽기 전용 원문 조회로 확인했다.
- [S3 CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html), [Web Crypto digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) — 응답 헤더 노출과 조각 단위 해시.
- [실행한 도우미 검사](./check_client.mjs) — 문서 코드의 Node 회귀 검사; Java·실제 S3 검증과는 별개다.

## 6. 요약 정리

- S3 Multipart Upload는 FormData 요청이 아니라 생성·part 전송·조립의 프로토콜이다.
- 앱 접수 ID·시도 ID·S3 uploadId·partNumber·versionId를 구분한다.
- part 범위와 체크섬을 고정하고 같은 번호의 재전송은 같은 바이트로 제한한다.
- ETag는 완료 목록의 식별자이며 전체 파일 해시라고 가정하지 않는다.
- SHA-256 COMPOSITE와 일반 전체 파일 SHA-256은 다르다.
- 영속 receipt와 원격 part를 대조한 뒤 번호순 manifest로 조립한다.
- Complete 응답 유실은 원격 실패 확정이 아니므로 고정 버전 대조가 필요하다.
- 일시 중지·로컬 취소·MPU Abort·완성 객체 삭제는 서로 다른 동작이다.
- 미완료 part와 최종 객체를 나누어 정리하고 검증·격리·승인 상태를 유지한다.

🧠 기억할 것: **조각은 다시 보낼 수 있어도, 최종 승인은 같은 시도의 검증된 버전 하나에만 연결한다.**

## 7. 미니 퀴즈 또는 체크리스트

1. 25MiB를 8MiB씩 나누면 각 part의 크기와 마지막 part의 시작 위치는 무엇인가?
2. 같은 uploadId·partNumber로 다른 바이트를 다시 보내면 어떤 위험이 생기는가?
3. multipart 객체의 checksumSHA256과 일반 전체 파일 SHA-256을 바로 비교하면 안 되는 이유는?
4. Complete 호출에서 timeout 뒤 NoSuchUpload가 나왔다. 왜 새 파일을 즉시 올리거나 “취소 완료”로 처리하면 안 되는가?
5. AbortMultipartUpload와 미완료 MPU Lifecycle이 이미 완성된 객체도 삭제하는가?

<details>
<summary>정답과 해설</summary>

1. 8·8·8·1MiB이고 마지막 시작은 24MiB다. 마지막 part에만 최소 크기 예외가 적용된다.
2. 기존 part가 덮어써져 receipt·다른 part와 일치하지 않는 파일이 조립될 수 있다. 같은 계획·고정 체크섬과 최신 응답을 유지해야 한다.
3. 이번 SHA-256 MPU는 part별 해시를 이용한 복합 체크섬이다. 모든 파일 바이트를 순서대로 한 번 해시한 값과 계산 대상이 다르다.
4. 조립이 성공하고 응답만 유실되어 세션이 사라졌을 수 있다. 기존 시도의 객체·versionId·내용을 대조하고 DB 상태와 연결해야 한다.
5. 아니다. 미완료 세션의 part를 정리하는 동작이며, 완성 객체 버전은 별도의 삭제·보존 정책으로 처리한다.

</details>
