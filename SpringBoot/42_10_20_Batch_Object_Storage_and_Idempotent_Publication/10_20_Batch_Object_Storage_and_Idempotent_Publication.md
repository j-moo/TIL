# Spring Batch 객체 스토리지 업로드·멱등 공개와 정합성 복구

- 🎯 글의 목표: 검증한 CSV를 S3에 올리고, 응답 유실·중복 실행·DB 저장 실패 뒤에도 같은 산출물을 대조하여 안전하게 제공하는 과정을 설명한다.
- 🧩 핵심 키워드: 객체·버킷·키, 조건부 쓰기, 멱등성, SHA-256, 버전 ID, 공개 이력, 정합성 복구
- ⭐ 중요도: 높음. 파일 생성이 끝나도 원격 저장과 다운로드 허용이 함께 성공한 것은 아니므로, 단계 사이의 실패를 다루어야 한다.
- 📝 한눈에 보는 내용: 비공개 파일 검증 → 업무별 고정 키 → 조건부 업로드 → 크기·체크섬·소속 대조 → 버전을 고정한 공개 → 중단 구간 복구
- 🔗 관련 주제: [파일 출력·안전한 결과 공개](../41_10_15_Batch_File_Output_and_Safe_Publication/10_15_Batch_File_Output_and_Safe_Publication.md), [멱등성 키](../24_09_22_Idempotency_Key_and_Duplicate_Requests/09_22_Idempotency_Key_and_Duplicate_Requests.md), [다단계 Job](../39_10_11_Batch_Multi_Step_Flow_and_Result_Verification/10_11_Batch_Multi_Step_Flow_and_Result_Verification.md)
- 🧱 선수 지식: Java record·예외·바이트 배열, HTTP 상태 코드, DB commit·유일 제약, Batch Job·Step·재시작, 이전 노트의 입력 스냅샷·파일 검증

> 기준일: 2026-10-20. Java 17, AWS SDK for Java 2.x **2.31.54**를 고정한 S3 어댑터 예제다. Batch 개념은 이전 노트의 Spring Batch 6.0.5 흐름에 연결하며 새 Batch API를 추가하지 않는다. 일반 목적 S3 버킷의 버전 관리 활성화·비공개 접근·SSE-S3 암호화와 단일 PUT을 전제로 한다. 코드는 기존 Java 프로젝트에 추가하는 파일이며, 버킷·IAM·DB·Job 전체 구성은 포함하지 않는다. 공식 문서와 고정 SDK의 서비스 모델을 대조했지만, 이 저장소에는 해당 Java 빌드 프로젝트와 Java 17 컴파일 환경이 없어 컴파일·JUnit·실제 S3 호출은 실행하지 않았다.

## 1. 들어가며

이전 노트에서는 재고 스냅샷을 CSV로 작성하고, 닫힌 파일의 내용·건수·바이트·체크섬을 검증했다. 파일을 배치 서버에만 두면 다른 서버가 내려받게 하기 어렵고, 배치 서버의 디스크 수명에도 영향을 받는다. 다음 단계는 검증한 산출물을 원격 저장소에 보관하는 것이다.

여기서 새로운 문제가 생긴다. S3는 파일을 저장했지만 배치 서버가 성공 응답을 받기 전에 연결이 끊길 수 있다. 또는 업로드와 원격 검증까지 성공했는데 DB의 공개 이력 저장만 실패할 수 있다. 이때마다 새 파일 이름으로 업로드하면 같은 업무의 결과가 여러 개 생기고, 무조건 덮어쓰면 이미 공개한 결과가 바뀐다.

이번 노트의 핵심 질문은 **“다시 실행했을 때, 이것이 같은 업무의 같은 결과임을 무엇으로 확인할 것인가?”**다. 로컬 CSV 생성 코드를 반복하지 않고, 그 뒤에 붙는 원격 저장·대조·공개 경계를 학습한다. 작은 파일로 원리를 확인하며 대용량 멀티파트 업로드는 범위 밖에 둔다.

## 2. 핵심 개념 정리

```text
입력 snapshot + exportId + 형식 버전 + 검증한 바이트·SHA-256
  → DB에 업로드 의도 저장
  → 같은 키에 조건부 PUT
  → HEAD로 원격 크기·체크섬·소속·버전 확인
  → DB에 검증한 버전을 READY로 확정
  → 권한 있는 요청에만 그 버전 제공

도중 응답/프로세스 유실 → 기존 의도 조회 → 같은 키의 실제 상태 대조 → 이어서 확정
```

| 질문 | 연결할 개념 |
| --- | --- |
| 어디에 어떤 이름으로 저장하는가? | 버킷·객체 키와 업무 식별자 |
| 두 실행이 같은 이름으로 보내면? | 서버가 판단하는 조건부 쓰기 |
| 같은 이름의 내용까지 같은가? | 바이트 수·SHA-256·업무 소속 대조 |
| 무엇을 사용자에게 제공하는가? | READY 이력에 저장한 특정 버전 |
| 응답이나 이력이 사라지면? | DB 의도와 원격 상태를 다시 맞추는 복구 |

업로드·검증·공개는 서로 다른 판단이다. 이 세 가지를 한 개의 `success` 값으로 줄이지 않는 것이 전체 흐름을 읽는 기준이다.

## 3. 본문 정리

### 3.1 객체 스토리지는 파일 경로를 그대로 옮기는 디스크가 아니다

**객체 스토리지(object storage)는 바이트 데이터와 그 설명 정보를 하나의 객체로 저장하는 방식**이다. S3의 버킷(bucket)은 객체를 담는 저장 공간이고, 키(key)는 버킷 안에서 객체를 식별하는 문자열이다. 객체의 설명 정보인 메타데이터(metadata)에는 콘텐츠 유형이나 애플리케이션이 지정한 업무 소속 등을 담을 수 있다.

예를 들어 버킷이 `study-private-export`, 키가 `exports/stock-csv-v1/업무ID/stock.csv`라면 두 값을 함께 알아야 대상을 지정할 수 있다. 키의 `/`는 폴더처럼 보이게 하는 구분자일 뿐, 로컬 파일 시스템의 디렉터리 구조와 같은 것은 아니다. [S3 객체 키 공식 문서](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html)

이번 설계는 비공개 최종 키에 객체를 바로 저장한다. 업로드 뒤 “공개 폴더로 rename”하는 대신, DB 이력의 상태를 바꾸어 다운로드 허용 시점을 결정한다. 따라서 **공개는 인터넷 전체 공개가 아니라, 애플리케이션이 권한 있는 요청에 제공할 수 있다는 뜻**이다.

AWS의 IAM은 사용자·실행 역할에 어떤 작업을 허용할지 관리하는 권한 체계다. 예제는 실행 역할에 필요한 저장·조회 권한만 주고, 저장 시 S3가 관리하는 키로 암호화하는 SSE-S3를 전제로 한다. 버킷의 권한·암호화 설정을 구성하는 전체 안내서는 아니므로, 이미 준비된 전용 비공개 환경에서 적용할 코드로 읽는다.

버킷명·키·로컬 파일 경로는 서버가 선택한다. 요청자가 임의의 버킷이나 다른 사용자의 키를 입력해 조회하도록 하지 않는다. 키에 이름·이메일 같은 개인정보를 넣지 않는 것도 경로 노출을 줄이는 설계 판단이다.

### 3.2 업무별 고정 키가 있어야 재시도가 같은 결과로 모인다

**멱등성(idempotency)은 같은 업무를 반복 요청해도 이미 확정한 결과를 중복 생성하거나 바꾸지 않는 성질**이다. 여기서는 업로드 호출 횟수를 한 번으로 제한한다는 뜻이 아니다. 여러 호출이 같은 검증 결과와 같은 원격 객체를 가리키도록 만든다는 뜻이다.

업무를 구분하는 `exportId`는 CSV를 만들기 전에 한 번 정하고 DB에 보관한다. `JobExecution` ID나 현재 시각은 실행할 때마다 달라질 수 있으므로 객체 키의 업무 식별자로 쓰지 않는다. 새 입력이나 새 형식으로 다시 만드는 것은 기존 결과의 재시도가 아니라 **새 exportId를 가진 새 업무**다.

```text
같은 업무의 첫 실행: exports/stock-csv-v1/동일-exportId/stock.csv
같은 업무의 재시도: exports/stock-csv-v1/동일-exportId/stock.csv
다른 입력의 새 업무: exports/stock-csv-v1/새-exportId/stock.csv
```

고정 키만으로는 충분하지 않다. DB에 `exportId → snapshotId·형식·바이트 수·SHA-256·버킷·키`의 대응을 보관하고 재시작에서도 바꾸지 않는다. 같은 exportId에 다른 파일이 들어오면 덮어쓸 기회가 아니라 계약 위반으로 판단한다.

### 3.3 존재 확인 뒤 일반 PUT을 보내면 경쟁 상태가 남는다

**조건부 쓰기(conditional write)는 저장소가 쓰기 요청을 처리하는 순간 조건을 함께 검사하는 기능**이다. 여기서 PUT은 객체 데이터를 저장하는 요청이고, HEAD는 본문 없이 객체 설명 정보를 조회하는 요청이다. 먼저 HEAD로 “없다”를 확인하고 나중에 일반 PUT을 보내면 그 사이에 다른 실행이 같은 키를 만들 수 있다. 이처럼 확인과 실행 사이에 상태가 달라지는 문제가 경쟁 상태다.

S3 `PutObject`에 `If-None-Match: *`를 넣으면 같은 키의 현재 객체가 없을 때만 생성한다. 이미 있으면 `412 Precondition Failed`로 거절한다. 동시 조건부 생성에서는 먼저 완료한 쓰기가 성공하고 나머지가 거절된다. [조건부 쓰기 동작](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)

412를 받았다는 것은 **“내용도 같으니 성공”이 아니라 “비교할 기존 객체가 있다”**는 뜻이다. 다음 절의 증거를 대조한 후에만 기존 결과를 재사용한다. `409 Conflict`는 별도 충돌이며 412처럼 성공 후보로 취급하지 않는다. 단일 PUT의 409는 제한된 재시도 후보지만, 먼저 현재 상태를 대조하고 총 시도 횟수·대기 시간을 제한한다. [PutObject API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)

⚠️ 주의: 버전 관리가 켜져 있어도 조건부 검사는 현재 버전을 기준으로 한다. 현재 버전이 삭제 마커이면 새 생성이 가능하다. 이 프로토콜을 쓰는 모든 쓰기 주체에 조건부 쓰기를 강제하고, 제공 중인 객체의 덮어쓰기·버전 삭제·수명주기 삭제를 별도로 통제해야 한다. 버전 관리 활성화만으로 불변성이 보장되지는 않는다. [조건부 쓰기의 버전 조건](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)

### 3.4 파일 이름이 아닌 실제 바이트와 업무 소속을 대조한다

**체크섬(checksum)은 데이터 바이트에서 계산한 요약값**이다. SHA-256은 이를 계산하는 알고리즘 중 하나다. 크기가 같아도 내용이 다를 수 있으므로 바이트 수와 체크섬을 함께 비교한다. 다만 체크섬만으로 “이 파일이 올바른 재고 목록인가”를 알 수는 없다. 그 업무 검증은 이전 노트에서 입력 스냅샷과 CSV 전체를 대조할 때 끝내야 한다.

이번 예제에서는 검증한 로컬 파일에 대해 SHA-256을 계산하고, S3에도 그 값을 보내어 수신한 데이터와 맞는지 검사하게 한다. 단일 PUT의 체크섬은 전체 객체에 대한 값이다. 멀티파트의 조합 체크섬을 전체 파일 SHA-256과 그대로 비교하는 방식으로 확장하면 안 된다. ETag 역시 암호화·업로드 방식에 따라 파일 MD5와 다를 수 있으므로 여기서는 무결성 증거로 쓰지 않는다. [업로드 무결성·ETag 설명](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)

같은 SHA-256도 **16진수(hex)**와 **Base64**로 다르게 표시할 수 있다. 이전 노트의 DB 기록은 64자리 소문자 hex이고, `checksumSHA256` 요청·응답은 해시 바이트를 Base64로 표현한다. hex 문자열 자체를 Base64로 인코딩하지 않고, 먼저 hex를 32바이트 해시로 복원한 뒤 Base64로 바꾼다. [PutObject 체크섬 필드](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)

원격 대조에는 HEAD를 사용한다. HEAD는 객체 본문을 내려받지 않고 크기·메타데이터 등을 조회한다. `ChecksumMode.ENABLED`로 저장된 체크섬을 요청하며, 체크섬이 없으면 자동 통과시키지 않는다. SSE-KMS 암호화 환경에서는 체크섬 조회를 위한 추가 KMS 권한도 확인해야 한다. [HeadObject API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)

SSE-KMS는 AWS 키 관리 서비스인 KMS의 키를 이용하는 서버 측 암호화 방식으로, 이번 예제의 SSE-S3와 권한 조건이 다르다. **버전 ID는 같은 키에 저장된 특정 버전을 지정하는 값**이다. 원격 대조 결과에는 이 값까지 남기며, 제공 시 활용하는 이유는 3.9절에서 이어서 설명한다.

| 대조 대상 | 일치해야 하는 값 | 확인 이유 |
| --- | --- | --- |
| 저장 위치 | DB의 버킷·고정 키 | 다른 업무의 객체를 보지 않기 위해 |
| 데이터 | 바이트 수·저장된 SHA-256 | 검증한 CSV와 같은 바이트인지 확인하기 위해 |
| 소속 메타데이터 | exportId·snapshotId·형식 버전 | 다른 업무의 파일을 잘못 연결하지 않기 위해 |
| 버전 | 실제 버전 ID | 나중에도 검증한 버전을 정확히 지정하기 위해 |

메타데이터에 `sha256=...`이라는 사용자 문자열만 넣는 것은 S3가 계산·검증한 체크섬을 조회하는 것과 다르다. 메타데이터는 소속 대조에, 체크섬 응답은 데이터 대조에 사용한다. 둘 다 신뢰할 수 있는 작성 권한과 변경 통제를 전제로 한다.

### 3.5 작은 파일의 업로드 의도를 코드로 고정한다

다음은 **기존 Java 17 프로젝트에 추가하는 예제 파일**이다. 이전 노트의 닫힌 CSV·승인된 검증 결과가 입력이며, CSV 검증기나 전체 Batch Job을 새로 구현하지 않는다. 아래 Gradle Groovy 설정은 기존 `build.gradle`의 `dependencies` 안에 합치는 일부 코드다.

SDK(Software Development Kit)는 외부 서비스의 요청·응답·인증·통신 처리를 언어별 코드로 제공하는 개발 도구 모음이다. 여기서는 AWS의 Java SDK를 사용한다. BOM(Bill of Materials)은 여러 모듈의 의존성 버전을 한 묶음으로 관리하는 목록이며, 아래에서는 S3 모듈의 버전을 선택한다.

```groovy
// 의존성 버전을 묶는 BOM으로 AWS SDK 모듈의 버전을 일치시킨다.
implementation platform('software.amazon.awssdk:bom:2.31.54')
// 동기 S3Client·요청/응답 타입을 사용할 모듈이다.
implementation 'software.amazon.awssdk:s3'
```

2.31.54는 이 예제에서 선택한 고정 버전이지 최신 버전이라는 뜻이 아니다. 조건부 생성·체크섬·버전 조회 필드는 [해당 태그의 공식 서비스 모델](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/resources/codegen-resources/service-2.json)에서 확인했다. 기존 프로젝트의 테스트에는 JUnit Jupiter와 Mockito가 필요하며 Wrapper·테스트 설정은 그 프로젝트 구성을 사용한다.

파일 `src/main/java/com/example/export/UploadIntent.java`는 DB에 이미 확정한 업로드 의도를 전달한다. **의도(intent)는 어떤 업무의 어떤 바이트를 어느 규칙으로 저장할지 정한 기록**이다. 이 record는 형식만 검사하며, DB 저장·권한 확인·CSV 업무 검증을 대신하지 않는다. 호출자는 DB에 보관한 버킷·키가 어댑터 설정·이 record의 키와 같은지도 전송 전에 확인해야 한다.

```java
package com.example.export; // 아래 어댑터·테스트와 같은 패키지를 사용한다.

import java.util.Base64; // S3가 요구하는 체크섬 문자열을 만든다.
import java.util.HexFormat; // 이전 검증 결과의 hex를 해시 바이트로 복원한다.
import java.util.Map; // 원격 객체에 함께 넣을 소속 정보를 표현한다.
import java.util.Objects; // 필수 식별자의 null을 거절한다.
import java.util.UUID; // 업무 식별자를 일정한 형식으로 유지한다.

public record UploadIntent(UUID exportId, String snapshotId,
                           String sha256Hex, long bytes) {
    // 학습 예제의 메모리 사용 상한이다. S3의 업로드 한도가 아니다.
    public static final int MAX_BYTES = 65_536;
    public static final String FORMAT = "stock-csv-v1"; // 이전 CSV의 형식 계약이다.

    public UploadIntent {
        Objects.requireNonNull(exportId, "exportId is required");
        // 메타데이터에 넣을 예제 스냅샷 식별자는 짧은 ASCII로 제한한다.
        if (snapshotId == null || !snapshotId.matches("[A-Za-z0-9._-]{1,100}")) {
            throw new IllegalArgumentException("invalid snapshotId");
        }
        // 같은 해시의 대소문자 차이까지 없애 DB 비교 형식을 고정한다.
        if (sha256Hex == null || !sha256Hex.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("expected lowercase SHA-256 hex");
        }
        // 이 record는 소형 파일용이다. CSV 문법 검증은 앞 단계의 책임이다.
        if (bytes < 0 || bytes > MAX_BYTES) {
            throw new IllegalArgumentException("file exceeds example size limit");
        }
    }

    public String key() {
        // 실행 시각이나 Execution ID가 아닌 업무 ID로 항상 같은 키를 만든다.
        return "exports/" + FORMAT + "/" + exportId + "/stock.csv";
    }

    public String sha256Base64() {
        byte[] digest = HexFormat.of().parseHex(sha256Hex); // hex → 원래 해시 바이트
        return Base64.getEncoder().encodeToString(digest); // 해시 바이트 → Base64
    }

    public Map<String, String> metadata() {
        return Map.of(
                "export-id", exportId.toString(), // 현재 업무 소속을 확인한다.
                "snapshot-id", snapshotId, // 어떤 고정 입력에서 나온 결과인지 남긴다.
                "format", FORMAT); // 같은 업무라도 다른 CSV 규격을 혼동하지 않는다.
    }
}
```

`MAX_BYTES`는 64 KiB다. 작은 파일을 메모리에서 고정하여 “검증한 바이트와 업로드한 바이트가 달라지는 문제”를 드러내기 위한 예제 선택이다. 대용량 파일을 이 방식으로 읽으면 메모리가 고갈될 수 있으므로 한도만 크게 올리지 않는다. 큰 파일의 스트리밍·멀티파트·중단된 업로드 정리는 별도 설계 대상이다.

### 3.6 조건부 업로드와 원격 대조를 한 어댑터에 묶는다

**어댑터(adapter)는 업무 코드가 외부 서비스의 API를 직접 다루지 않도록 경계를 모은 객체**다. 아래 `S3ExportUploader`는 전송과 대조만 책임지고 DB의 READY 변경은 하지 않는다. 입력 파일은 배치 전용 디렉터리의 닫힌 파일이어야 하며, 외부 요청자가 고른 경로를 받지 않는다.

파일 `src/main/java/com/example/export/S3ExportUploader.java`다. 호출자가 region·인증·유한한 timeout·재시도 정책을 구성한 `S3Client`를 주입한다. 소스에 접근 키를 넣지 않고 실행 환경의 자격 증명 공급 방식을 사용한다. [자격 증명 공급 체인](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/credentials-chain.html), [SDK timeout 구성](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/timeouts.html)

```java
package com.example.export;

import java.io.IOException; // 로컬 파일을 읽지 못한 상황을 호출자에게 전달한다.
import java.io.InputStream; // 한도를 넘는 전체 파일을 읽지 않도록 제한해서 읽는다.
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest; // 실제 업로드할 바이트의 SHA-256을 다시 계산한다.
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;
import software.amazon.awssdk.core.sync.RequestBody; // 고정한 바이트를 요청 본문으로 만든다.
import software.amazon.awssdk.services.s3.S3Client; // 호출자가 수명주기를 관리하는 공유 클라이언트다.
import software.amazon.awssdk.services.s3.model.ChecksumAlgorithm;
import software.amazon.awssdk.services.s3.model.ChecksumMode;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

public final class S3ExportUploader {
    private final S3Client s3; // 실제 통신은 이 인터페이스 뒤에서 일어난다.
    private final String bucket; // 클라이언트 요청값이 아닌 서버의 고정 설정이다.

    public S3ExportUploader(S3Client s3, String bucket) {
        this.s3 = Objects.requireNonNull(s3, "s3 is required");
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalArgumentException("bucket is required");
        }
        this.bucket = bucket;
    }

    public RemoteReceipt uploadOrConfirm(UploadIntent intent, Path sealedLocal)
            throws IOException, NoSuchAlgorithmException {
        byte[] frozen; // 이후 해시 계산과 전송에 같은 바이트 배열을 사용한다.
        try (InputStream input = Files.newInputStream(sealedLocal)) {
            // 한도 + 1까지만 읽어 초과 여부를 알아낸다. 스트림은 여기서 닫힌다.
            frozen = input.readNBytes(UploadIntent.MAX_BYTES + 1);
        }
        if (frozen.length > UploadIntent.MAX_BYTES || frozen.length != intent.bytes()) {
            throw new IllegalArgumentException("local byte count differs from intent");
        }
        String actualHex = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(frozen));
        if (!actualHex.equals(intent.sha256Hex())) {
            // 검증 이후 파일이 달라졌다면 전송 전에 중단한다.
            throw new IllegalArgumentException("local SHA-256 differs from intent");
        }

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket) // DB 의도와 함께 고정한 대상 버킷이다.
                .key(intent.key()) // 재시도에도 같은 업무 키를 사용한다.
                .contentType("text/csv; charset=utf-8") // 저장할 데이터의 형식이다.
                .ifNoneMatch("*") // 기존 현재 객체를 덮어쓰지 않도록 S3가 검사한다.
                .checksumAlgorithm(ChecksumAlgorithm.SHA256) // 알고리즘을 명시한다.
                .checksumSHA256(intent.sha256Base64()) // S3가 수신 바이트와 대조한다.
                .metadata(intent.metadata()) // 업무·입력·형식의 소속 정보를 남긴다.
                .build();

        PutObjectResponse uploaded;
        try {
            // 파일 경로를 다시 열지 않고 방금 검증한 바이트를 전송한다.
            uploaded = s3.putObject(request, RequestBody.fromBytes(frozen));
        } catch (S3Exception failure) {
            if (failure.statusCode() != 412) {
                // 409·권한·서버 오류를 기존 객체 일치로 오인하지 않는다.
                throw failure;
            }
            // 412는 기존 객체가 있다는 뜻이다. 내용까지 맞는지 별도로 확인한다.
            return confirmExisting(intent);
        }
        // 성공 응답의 버전을 지정해 바로 그 객체를 대조한다.
        return verifyRemote(intent, requireVersion(uploaded.versionId()));
    }

    public RemoteReceipt confirmExisting(UploadIntent intent) {
        // 응답 유실 뒤에는 로컬 파일을 다시 보내기 전에 현재 객체부터 대조한다.
        return verifyRemote(intent, null);
    }

    private RemoteReceipt verifyRemote(UploadIntent intent, String versionId) {
        var request = HeadObjectRequest.builder()
                .bucket(bucket).key(intent.key()) // DB에서 복원한 동일 위치를 조회한다.
                .checksumMode(ChecksumMode.ENABLED); // 저장된 체크섬도 요청한다.
        if (versionId != null) {
            request.versionId(versionId); // PUT 성공 시 반환받은 정확한 버전을 지정한다.
        }
        // 403·404 등을 잡아서 '없음'으로 바꾸지 않고 호출자에게 전달한다.
        HeadObjectResponse head = s3.headObject(request.build());
        String verifiedVersion = requireVersion(head.versionId());
        if (versionId != null && !versionId.equals(verifiedVersion)) {
            throw new IllegalStateException("returned version differs from requested version");
        }

        boolean sameSize = head.contentLength() != null
                && head.contentLength().longValue() == intent.bytes();
        boolean sameChecksum = intent.sha256Base64().equals(head.checksumSHA256());
        Map<String, String> actualMetadata = head.metadata();
        // 필요한 소속 필드를 전부 비교한다. 하나라도 없거나 다르면 false다.
        boolean sameOwner = intent.metadata().entrySet().stream()
                .allMatch(entry -> entry.getValue().equals(actualMetadata.get(entry.getKey())));
        if (!sameSize || !sameChecksum || !sameOwner) {
            // 충돌한 객체를 삭제/덮어쓰기하지 않는다. 이 예외로 공개 진행을 막는다.
            throw new IllegalStateException("remote object differs from approved intent");
        }
        return new RemoteReceipt(bucket, intent.key(), verifiedVersion,
                intent.bytes(), intent.sha256Base64()); // DB 확정 단계가 쓸 검증 결과다.
    }

    private static String requireVersion(String versionId) {
        // 'null 버전'은 구체적인 불변 버전 ID로 사용하지 않는 예제 계약이다.
        if (versionId == null || versionId.isBlank() || "null".equals(versionId)) {
            throw new IllegalStateException("versioning-enabled bucket is required");
        }
        return versionId; // 문자열은 해석·가공하지 않고 그대로 저장한다.
    }

    public record RemoteReceipt(String bucket, String key, String versionId,
                                long bytes, String sha256Base64) { }
}
```

호출 순서는 다음과 같다. 먼저 전송할 바이트를 한도 안에서 고정하고 승인된 크기·해시와 대조한다. 조건부 PUT이 성공하면 응답의 버전을 HEAD로 확인하고, 412이면 기존 현재 객체를 HEAD로 확인한다. 두 경우 모두 같은 대조를 통과해야 `RemoteReceipt`가 반환된다. 영수증에 해당하는 이 값은 **원격 검증 결과이지 DB 공개 완료 증거가 아니다**.

`SdkClientException`과 같은 통신 예외는 위 코드에서 잡지 않는다. 서버에 도달했는지 알 수 없는 실패를 `false`나 성공으로 줄이지 않고 상위 복구 절차에 넘기기 위해서다. 또한 이 클래스는 무한 재시도하지 않으며 공유 `S3Client`를 업로드마다 닫지 않는다. 클라이언트를 만든 애플리케이션이 종료 시 자원을 정리한다.

⚠️ 주의: 객체가 없을 때도 `s3:ListBucket` 권한 유무에 따라 HEAD는 404 또는 403을 반환할 수 있다. 따라서 403을 “없으니 새로 만들자”로 처리하면 안 된다. 이 예제의 복구 주체는 대상 범위의 부재를 구별할 권한을 갖추고, 403이면 권한·설정을 점검하며 공개를 중단한다. [HEAD의 오류·권한 조건](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)

### 3.7 공개 이력은 짧은 DB 트랜잭션으로 확정한다

**정합성은 서로 연결된 기록이 같은 업무 결과를 가리키는 상태**다. S3와 DB는 다른 시스템이므로, 로컬 DB의 `@Transactional`로 두 시스템의 성공·취소를 하나로 묶을 수 없다. 객체가 올라간 뒤 DB가 rollback되어도 S3 객체가 저절로 취소되는 것은 아니다.

여기서는 업로드 전에 DB에 의도를 기록하고, 원격 검증 뒤 같은 의도의 공개 상태만 확정하는 **설계 예시**를 사용한다. 아래 상태는 Spring Batch의 `BatchStatus`가 아니라 애플리케이션의 업무 상태다.

| 업무 상태 | DB가 기억하는 사실 | 제공 가능 여부 |
| --- | --- | --- |
| LOCAL_VERIFIED | 입력·CSV 검증과 고정된 위치·크기·해시가 확정됨 | 불가 |
| UPLOAD_PENDING | 이 의도의 업로드·대조가 아직 확정되지 않음 | 불가 |
| REMOTE_VERIFIED | 일치하는 원격 버전과 검증 결과를 저장함 | 불가 |
| READY | 검증한 버전의 제공을 확정함 | 권한 검사 후 가능 |
| CONFLICT | 원격 내용·소속 등이 의도와 다름 | 불가·원인 조사 |

`REMOTE_VERIFIED`와 `READY`는 운영상 분리할 필요가 없다면 하나의 짧은 DB 트랜잭션으로 확정해도 된다. 중요한 것은 상태 이름의 개수가 아니라 **검증하지 않은 객체를 READY로 만들지 않는 조건**이다.

DB 테이블에는 exportId 유일 제약, snapshotId, 형식 버전, 버킷·키, 바이트 수·hex 해시, 업무 상태, 검증한 versionId, 상태 변경용 revision 등을 둔다. 작업자가 받은 receipt를 저장할 때 DB 의도와 다시 대조하고, 상태·revision을 조건으로 갱신한다. 조건부 갱신은 읽은 뒤 다른 작업자가 바꾼 기록을 덮어쓰지 않도록 하는 방식이며 [동시 수정 제어 노트](../22_09_20_Optimistic_Locking/09_20_Optimistic_Locking.md)와 연결된다.

갱신 결과가 0행이면 즉시 실패·성공으로 단정하지 않고 다시 조회한다. 이미 READY이며 위치·버전·검증 근거가 모두 같은 경우는 재처리 성공으로 반환할 수 있다. 반대로 다른 버전이나 의도로 확정되어 있으면 덮어쓰지 않는다. 여러 작업자를 운영하면 lease·소유 토큰 등 실행 권한 확인도 같은 조건부 전이에 포함해야 한다.

원격 호출을 기다리는 동안 DB 행 잠금·트랜잭션을 계속 붙잡지 않는다. **짧은 DB 의도 확정 → 외부 호출·검증 → 짧은 DB 공개 확정**으로 나눈다. 이것은 중간 실패를 없애는 방식이 아니라, 남은 중간 상태를 찾아 복구할 수 있게 하는 방식이다.

### 3.8 응답 유실은 실패 확정이 아니라 상태 대조의 시작이다

**정합성 복구(reconciliation)는 DB의 의도와 외부 시스템의 실제 상태를 읽어 어긋난 부분을 맞추는 절차**다. 예를 들어 S3 PUT은 성공했는데 응답이 유실되면 DB에는 UPLOAD_PENDING만 남을 수 있다. 같은 exportId의 의도를 조회하고 `confirmExisting`으로 대조하면 업로드를 반복하지 않고 공개 확정을 이어갈 수 있다.

| 중단 구간 | 다음 실행이 확인할 것 | 진행 방향 |
| --- | --- | --- |
| PUT 전에 종료 | 의도 존재·원격 객체 부재·검증한 로컬 파일 | 같은 키에 조건부 PUT |
| PUT 응답 유실 | 같은 키의 크기·체크섬·소속·버전 | 일치하면 receipt 복원 후 DB 확정 |
| 412 수신 | 기존 객체가 같은 의도인지 | 일치하면 재사용, 다르면 CONFLICT |
| 원격 검증 뒤 DB 실패 | 의도·원격 객체를 다시 대조 | 동일 결과로 DB 전이 재시도 |
| READY 뒤 중복 실행 | 확정 이력과 고정 버전 | 새 업로드 없이 기존 결과 반환 |
| HEAD 403·일시 통신 오류 | 권한·인증·연결·재시도 예산 | READY로 진행하지 않고 보류·관찰 |
| 원격 404 + 로컬 파일 없음 | 같은 snapshot으로 같은 바이트 복원 가능 여부 | 불가하면 자동 공개를 멈추고 복구 판단 |

S3는 성공한 쓰기 뒤 객체 읽기·HEAD에 강한 일관성을 제공한다. **강한 일관성(strong consistency)**은 완료된 쓰기를 후속 조회에서 반영한다는 뜻이지, DB와의 원자적 commit이나 이후 삭제 방지를 뜻하지 않는다. 다른 서버의 목록 캐시나 DB 조회 지연과도 구분한다. [S3 일관성 모델](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel)

복구 작업의 입력은 “모든 객체 목록”보다 DB의 미확정 업무 목록으로 시작하는 것이 의도·책임을 추적하기 좋다. UPLOAD_PENDING 등의 상태를 제한된 수만큼 조회하고, 같은 의도를 대조하여 전이한다. 재시도 간격·최대 횟수·최대 경과 시간과 최종 수동 점검 상태를 두며, 이전 [timeout·재시도 노트](../27_09_28_Timeouts_Retries_and_Circuit_Breakers/09_28_Timeouts_Retries_and_Circuit_Breakers.md)의 예산 구분을 적용한다.

Batch에서는 파일 작성·검증 뒤 업로드 Tasklet, 공개 확정 Tasklet로 책임을 나눌 수 있다. 완료 Step이 재시작에서 생략될 수 있으므로 ExecutionContext의 “검증했음” 플래그만으로 현재 원격 상태를 신뢰하지 않는다. 공개 단계나 별도 복구 작업이 DB 의도와 정확한 원격 버전을 대조하게 한다. Step 성공과 업무 READY는 서로 다른 기록이다.

### 3.9 검증한 버전을 제공하고 보존 정책까지 맞춘다

**버전 ID(versionId)는 버전 관리 버킷에서 특정 객체 버전을 지정하는 값**이다. READY에 버전 ID를 저장했다면 다운로드도 그 값을 지정해야 한다. 키만 지정하면 이후 변경된 현재 버전을 읽을 수 있어 “검증한 대상”과 “제공한 대상”이 달라진다. [PutObject 버전 응답](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html), [HEAD 버전 지정](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)

제공 경로는 다음 세 가지를 순서대로 검사한다. 요청자의 해당 exportId 접근 권한, DB의 READY 상태, 고정된 버킷·키·versionId다. 서버가 직접 내려주거나 만료되는 사전 서명 URL을 발급하더라도 이 검사를 먼저 거친다. URL을 발급할 때도 검증한 버전을 지정하며, 비공개 객체를 public ACL로 바꿀 필요는 없다. URL 발급·스트리밍 구현은 다음 노트의 범위다.

보존 기간도 이력과 연결해야 한다. 객체의 특정 버전이 삭제되면 READY 이력만 남아도 내려받을 수 없다. 제공 기간에는 해당 버전을 유지하고, 만료 뒤 제공을 중단하는 상태 전이와 삭제를 조정한다. 미확정 객체를 지우는 정리 작업 역시 진행 중인 업로드·복구 작업과 경쟁하지 않도록 대상·유예 기간·실행 권한을 확인한다.

⚠️ 주의: “DB 확정이 실패했으니 방금 올린 객체를 즉시 삭제”하는 보상은 위험하다. 다른 작업자가 같은 객체를 검증해 READY로 확정했을 수 있다. 정상 복구는 우선 일치하는 객체를 재사용하는 방향이며, 삭제는 소유 관계·공개 상태·보존 정책을 확인하는 별도 절차로 다룬다.

### 3.10 단위 테스트로 어댑터의 판단을 확인한다

아래 파일은 `src/test/java/com/example/export/S3ExportUploaderTest.java`다. JUnit Jupiter의 `@TempDir`로 전용 임시 파일을 만들고, Mockito로 S3Client를 대체한다. **실제 AWS가 아니라 작성한 어댑터의 요청·분기만 검사하는 테스트**다. 앞의 두 파일과 JUnit Jupiter·Mockito 테스트 의존성이 필요하다.

```java
package com.example.export;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

class S3ExportUploaderTest {
    @TempDir Path temporary; // 테스트마다 격리된 디렉터리만 사용한다.
    private Path sealed;
    private UploadIntent intent;
    private S3Client s3;
    private S3ExportUploader uploader;

    @BeforeEach
    void prepare() throws Exception {
        // 이전 노트의 CSV 규격인 UTF-8·LF·고정 헤더를 작은 fixture로 만든다.
        byte[] csv = "book_id,stock\nB001,12\n".getBytes(StandardCharsets.UTF_8);
        sealed = temporary.resolve("stock.csv");
        Files.write(sealed, csv); // 실제 운영 경로가 아닌 임시 파일만 쓴다.
        String hex = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(csv));
        intent = new UploadIntent(
                UUID.fromString("123e4567-e89b-42d3-a456-426614174000"),
                "catalog-db-v1", hex, csv.length); // fixture와 일치하는 승인 의도다.
        s3 = mock(S3Client.class); // 네트워크 통신은 발생하지 않는다.
        uploader = new S3ExportUploader(s3, "study-private-export");
    }

    private HeadObjectResponse matchingHead() {
        return HeadObjectResponse.builder()
                .versionId("test-version-1") // SDK 동작을 대신하는 가짜 버전이다.
                .contentLength(intent.bytes())
                .checksumSHA256(intent.sha256Base64())
                .metadata(intent.metadata()).build(); // 필수 증거가 모두 맞는 응답이다.
    }

    @Test
    void successfulPutUsesConditionAndVerifiesItsVersion() throws Exception {
        when(s3.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().versionId("test-version-1").build());
        when(s3.headObject(any(HeadObjectRequest.class))).thenReturn(matchingHead());

        var receipt = uploader.uploadOrConfirm(intent, sealed); // 정상 업로드 흐름을 호출한다.

        var put = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(put.capture(), any(RequestBody.class)); // 보낸 요청을 꺼낸다.
        assertEquals("*", put.getValue().ifNoneMatch()); // 무조건 덮어쓰기가 아니다.
        assertEquals(intent.key(), put.getValue().key()); // 고정된 업무 키다.
        assertEquals(intent.sha256Base64(), put.getValue().checksumSHA256());
        var head = ArgumentCaptor.forClass(HeadObjectRequest.class);
        verify(s3).headObject(head.capture());
        assertEquals("test-version-1", head.getValue().versionId()); // 성공한 버전을 조회했다.
        assertEquals("test-version-1", receipt.versionId());
    }

    @Test
    void preconditionFailureReusesOnlyMatchingObject() throws Exception {
        when(s3.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(S3Exception.builder().statusCode(412).message("exists").build());
        when(s3.headObject(any(HeadObjectRequest.class))).thenReturn(matchingHead());

        var receipt = uploader.uploadOrConfirm(intent, sealed);

        assertEquals("test-version-1", receipt.versionId()); // 일치한 기존 버전을 재사용한다.
        verify(s3).putObject(any(PutObjectRequest.class), any(RequestBody.class)); // 추가 PUT은 없다.
    }

    @Test
    void missingChecksumBlocksReceiptAfter412() {
        when(s3.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(S3Exception.builder().statusCode(412).build());
        when(s3.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().versionId("test-version-1")
                        .contentLength(intent.bytes()).metadata(intent.metadata()).build());

        // 이름·크기·소속이 같아도 체크섬 증거가 없으면 공개 근거를 만들지 않는다.
        assertThrows(IllegalStateException.class, () -> uploader.uploadOrConfirm(intent, sealed));
    }

    @Test
    void forbiddenHeadIsNotTreatedAsAbsence() {
        when(s3.headObject(any(HeadObjectRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(403).build());

        S3Exception failure = assertThrows(S3Exception.class, () -> uploader.confirmExisting(intent));

        assertEquals(403, failure.statusCode()); // 권한 오류를 유지한다.
        verify(s3, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    void changedLocalBytesAreRejectedBeforeNetworkCall() throws Exception {
        // 숫자 하나만 바꾸어 크기가 같은 변조도 체크섬으로 걸러지는지 확인한다.
        Files.writeString(sealed, "book_id,stock\nB001,13\n", StandardCharsets.UTF_8);

        assertThrows(IllegalArgumentException.class, () -> uploader.uploadOrConfirm(intent, sealed));

        verifyNoInteractions(s3); // 잘못된 바이트는 S3 호출 전에 차단한다.
    }
}
```

기대되는 결과는 다섯 테스트의 통과다. 첫 테스트는 조건과 고정 버전을, 둘째는 412 뒤 재사용을, 셋째는 검증 증거 누락을, 넷째는 권한 오류 분류를, 다섯째는 로컬 변경 차단을 확인한다. **이 노트에서는 실행하지 않았으므로 통과를 확인한 결과는 아니다.**

프로젝트 루트에서 사용하는 Wrapper 하나로 실행한다. Gradle이면 `./gradlew` 대신 Windows PowerShell의 `gradlew.bat`를 사용한다.

```powershell
# 세 Java 파일·의존성을 추가한 Java 프로젝트 루트에서 실행한다.
.\gradlew.bat test --tests "com.example.export.S3ExportUploaderTest"
# Maven 프로젝트라면 위 명령 대신 테스트 범위를 지정한다.
.\mvnw.cmd -Dtest=S3ExportUploaderTest test
```

### 3.11 실제 저장소·DB를 함께 쓰는 시험은 별도로 필요하다

단위 테스트의 mock은 설정한 응답을 돌려줄 뿐, S3가 정말 조건부 쓰기를 보장하는지는 검사하지 않는다. 실제 통합 시험에서는 전용 비공개 테스트 버킷·제한된 권한·고유 exportId를 사용하고, 시험 데이터의 정리 범위와 비용도 미리 정한다. S3 호환 에뮬레이터를 쓴다면 조건부 PUT·체크섬·버전·권한 오류가 AWS와 같은지 따로 확인한다.

| 추가 시험 | 주입할 실패·경계 | 확인할 결과 |
| --- | --- | --- |
| 같은 키의 동시 생성 | 같은 의도의 두 작업자를 동시에 진행 | 조건부 생성 뒤 같은 검증 버전으로 수렴 |
| 다른 바이트의 같은 키 | 다른 해시·소속의 객체를 미리 준비 | CONFLICT·READY 미전이·기존 객체 보존 |
| 응답 유실 | PUT을 저장한 뒤 호출자 쪽 응답 전달만 끊기 | DB 의도와 HEAD 대조로 복구·새 키 미생성 |
| DB 확정 실패 | 원격 검증 뒤 DB commit 실패 | 객체를 지우지 않고 재대조 후 한 번의 READY 확정 |
| 조회 권한 부족 | HEAD 권한·필요한 체크섬 권한 제거 | 부재로 오인하지 않음·제공 차단 |
| 버전 삭제·보존 만료 | 제공 대상 버전을 사용할 수 없게 만듦 | 다른 현재 버전을 대신 제공하지 않음 |
| 실제 프로세스 재시작 | 업로드 후 종료하고 새 프로세스 실행 | 메모리 없이 DB 의도·원격 증거로 복원 |

응답 유실 시험은 PUT 호출 전 예외를 던지는 mock과 다르다. **서버에 결과가 남았는데 호출자는 모르는 상황**을 만들어야 복구 경계를 검증할 수 있다. 통합 시험 결과에는 DB 행·객체 키·버전·체크섬·실행 이력을 함께 남기되 자격 증명과 서명 URL은 로그에서 제외한다.

## 4. 적용 관점에서 다시 보기

구현 순서는 앞에서 설명한 증거가 만들어지는 순서와 같다. 먼저 입력 스냅샷과 닫힌 CSV를 검증하고 DB 의도를 고정한다. 다음으로 조건부 PUT과 HEAD 대조를 수행하며, 마지막으로 같은 의도의 버전을 READY로 확정하고 권한 있는 요청에 제공한다.

문제 진단에서는 “업로드 실패”라는 한 문장보다 **어디까지 증거가 남았는가**를 묻는다. PUT 응답이 없다면 원격 상태를 조회하고, 412면 기존 객체의 일치 여부를 확인한다. READY인데 다운로드할 수 없다면 업로드를 새로 하기 전에 기록된 버전·권한·보존 상태를 확인한다.

작은 학습 예제에는 메모리에 고정한 단일 PUT이 적합하다. 큰 파일이나 여러 업로드 방식이 섞인 환경에는 이 예제의 상한을 풀기보다 파일 수명주기·체크섬 의미·중단 복구를 다시 설계해야 한다. 어떤 경우에도 키만 같다는 이유로 공개하거나, 실패했다는 이유만으로 기존 결과를 지우지 않는 기준은 유지한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

조건부 쓰기는 덮어쓰기를 막는 저장소의 판단이고, 멱등 공개는 업무 의도·원격 증거·DB 전이를 함께 설계한 결과다. 응답 유실을 완전히 피하는 대신, 같은 결과임을 다시 증명하여 다음 단계로 진행할 수 있어야 한다.

### 5.2 이전·다음 학습과의 연결

[이전 파일 출력 노트](../41_10_15_Batch_File_Output_and_Safe_Publication/10_15_Batch_File_Output_and_Safe_Publication.md)의 로컬 검증 근거를 원격 체크섬·버전·공개 이력으로 이어 붙였다. 다음에는 **파일 다운로드 API·스트리밍과 접근 제어**를 학습해 READY 산출물을 실제 HTTP 응답으로 제공할 때의 권한·자원 정리·실패 경계를 연결한다.

### 5.3 더 파볼 만한 주제

대용량 멀티파트 업로드에서 전체·조합 체크섬을 어떻게 구별하고 중단된 uploadId를 정리할 수 있을까? 제공 중인 버전의 보존·만료 전이를 여러 작업자가 실행할 때 삭제 권한과 복구 작업의 경쟁을 어떻게 제한할지도 후속 심화 주제다.

### 5.4 참고 자료

- [S3 객체 키](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html): 객체 식별과 prefix의 의미.
- [S3 조건부 쓰기](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html): 조건부 생성·현재 버전·삭제 마커·충돌의 동작.
- [PutObject API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html): 요청 체크섬·조건·오류·응답 버전 ID.
- [HeadObject API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html): 체크섬 조회·버전 지정·403/404와 암호화 권한.
- [업로드 무결성](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html): 단일·멀티파트 체크섬과 ETag를 구분하는 기준.
- [S3 일관성 모델](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel): 성공한 쓰기 이후의 조회 보장과 단일 키 원자성.
- [AWS SDK 2.31.54 S3 모델](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/resources/codegen-resources/service-2.json): 예제에서 사용하는 요청·응답 필드의 버전 근거.
- [SDK 자격 증명](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/credentials-chain.html), [SDK timeout](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/timeouts.html): 인증 정보 주입과 대기 시간 구성.

## 6. 요약 정리

- 객체 키는 업무별로 고정하고, 재시도마다 시각·Execution ID로 바꾸지 않는다.
- DB 의도에 입력·형식·위치·바이트·SHA-256을 고정해야 같은 결과인지 판단할 수 있다.
- `If-None-Match: *`는 생성 순간의 조건을 S3가 검사하게 한다. HEAD 후 일반 PUT과 다르다.
- 412는 기존 객체를 대조할 계기다. 일치 증거 없이 성공으로 바꾸지 않는다.
- SHA-256 hex와 Base64는 표현이 다르며, ETag·사용자 메타데이터는 저장된 체크섬의 대체물이 아니다.
- 통신 예외는 원격 실패 확정이 아닐 수 있다. 기존 의도·키를 조회하여 복구한다.
- S3 업로드와 DB 공개 확정은 별개다. 짧은 DB 전이와 재대조 절차로 중간 실패를 다룬다.
- READY에 검증한 버전을 보관하고 권한·보존 정책을 확인한 뒤 바로 그 버전을 제공한다.

🧠 기억할 것: **“올렸는가”보다 “어떤 업무의 어떤 바이트·버전을 검증하고 제공하는가”를 기록해야 다시 실행할 수 있다.**

## 7. 미니 퀴즈 또는 체크리스트

1. PUT 응답이 timeout되었다. 현재 시각으로 새 키를 만들면 무엇이 잘못될 수 있으며 먼저 무엇을 조회해야 하는가?
2. 조건부 PUT이 412를 반환했다. 어떤 증거를 대조해야 기존 객체를 재사용할 수 있는가?
3. 로컬 SHA-256의 64자리 hex 문자열과 HEAD의 `checksumSHA256` 문자열이 다르다. 어떤 표현 변환을 확인해야 하는가?
4. 원격 검증 뒤 DB commit이 실패했다. 즉시 객체를 지우는 것이 위험한 이유는 무엇인가?
5. READY에 버전 ID를 저장했지만 다운로드는 키만 지정한다. 이 구현에 어떤 문제가 있는가?

<details>
<summary>정답과 해설</summary>

1. S3에 첫 결과가 이미 남아 있을 수 있어 같은 업무의 중복 산출물을 만든다. DB의 고정 의도를 복원한 뒤 동일 키의 원격 크기·체크섬·소속·버전을 대조한다. 부재가 확인되고 로컬 결과도 유효할 때만 같은 키로 조건부 재전송한다.
2. 버킷·키, 바이트 수, 저장된 SHA-256, exportId·snapshotId·형식, 구체적인 버전 ID다. 이름과 크기만 같거나 체크섬이 누락된 경우에는 공개 근거가 부족하다.
3. 로컬 hex를 원래 해시 바이트로 복원하고 그 바이트를 Base64로 인코딩했는지 확인한다. hex 텍스트 자체의 Base64는 다른 값이다. 표현이 맞는데도 다르면 다른 데이터·체크섬 방식 여부를 조사한다.
4. 다른 작업자가 동일 결과를 READY로 확정했을 수 있어 제공 중인 객체를 지울 위험이 있다. 동일 의도의 원격 증거를 다시 대조하고 조건부 DB 전이로 확정하는 것이 먼저다.
5. 키만 지정한 조회는 현재 버전을 읽을 수 있어 검증·확정한 버전과 달라질 수 있다. 저장된 versionId를 지정하고 접근 권한과 해당 버전의 보존 여부도 확인해야 한다.

</details>
