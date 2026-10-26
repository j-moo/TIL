# HTTP Range·조건부 요청과 파일 이어받기

- 🎯 글의 목표: 다운로드할 바이트 범위와 파일의 동일성을 따로 검사하고, 권한 확인 뒤 전체·부분·본문 없는 응답을 올바르게 선택한다.
- 🧩 핵심 키워드: Range, Content-Range, 206·304·412·416, ETag, 강한·약한 검증자, If-Range, 조건부 GET, HEAD, 이어받기
- ⭐ 중요도: 높음. 파일 크기만 보고 이어 붙이면 서로 다른 버전의 바이트가 섞일 수 있고, 부분 응답의 길이를 잘못 계산하면 다운로드가 손상된다.
- 📝 한눈에 보는 내용: 바이트 위치 → 전체·부분 응답 계약 → 파일 식별자 → 조건 평가 순서 → 단일 범위 계산 → 고정 S3 버전의 부분 읽기 → 클라이언트 재개 판단 → 테스트
- 🔗 관련 주제: [파일 다운로드·스트리밍과 접근 제어](../43_10_23_File_Download_Streaming_and_Access_Control/10_23_File_Download_Streaming_and_Access_Control.md), [객체 스토리지·멱등 공개](../42_10_20_Batch_Object_Storage_and_Idempotent_Publication/10_20_Batch_Object_Storage_and_Idempotent_Publication.md), [Spring Security](../11_09_07_Spring_Security_Fundamentals/09_07_Spring_Security_Fundamentals.md)
- 🧱 선수 지식: HTTP 상태·헤더·본문, Java record·예외·바이트 스트림, 이전 노트의 READY 이력·소유자 검사·고정 versionId·close/abort

> 기준일: 2026-10-24. Java 21, Spring Boot 4.1.2 관리 조합의 Spring Framework 7.0.10, AWS SDK 2.31.54를 기준으로 한다. SDK는 이전 노트의 고정 버전이다. 일반 목적 S3 버킷의 변경되지 않는 검증 버전을 UTF-8 CSV 그대로 제공하며 압축·본문 변환은 적용하지 않는다. 기존 MVC 프로젝트에 추가·교체하는 파일이며 전체 실행 프로젝트가 아니다. 공식 문서와 고정 버전 소스를 대조했다. 현재 PATH에는 Java 8 런타임만 있고 javac·Maven·Gradle 및 해당 빌드 프로젝트가 없어 Java 컴파일·JUnit·실제 HTTP/S3 호출은 실행하지 않았다.

## 1. 들어가며

1,024바이트 파일을 내려받다가 앞의 600바이트만 저장하고 연결이 끊겼다고 하자. 다시 처음부터 받으면 이미 받은 데이터까지 재전송한다. `Range: bytes=600-`은 0부터 세었을 때 600번 위치부터 마지막까지 보내 달라는 요청이다.

하지만 다음 요청 전에 파일 내용이 바뀌었다면 어떨까? 예전 파일의 앞부분과 새로운 파일의 뒷부분을 붙여서는 안 된다. 그래서 이어받기에는 **어디부터 받을 것인가**뿐 아니라 **전에 받던 파일과 같은 바이트인가**를 판단할 정보가 필요하다.

이전 노트는 전체 GET과 자원 정리를 다뤘다. 이번에는 그 권한·고정 버전 경계를 유지하면서 단일 바이트 범위, ETag 조건, 본문을 보내지 않는 HEAD·304 응답을 연결한다. 여러 구간을 한 응답에 넣는 multipart/byteranges, 날짜 기반 검증자, 병렬 다운로드 클라이언트는 구현 범위에서 제외한다.

## 2. 핵심 개념 정리

```text
요청 인증 → 소유자·READY·제공 기간 확인 → 고정 버전·전체 길이·ETag 확보
  → If-Match 불일치: 412
  → If-None-Match 일치: 304
  → HEAD: 전체 GET의 메타데이터만 반환
  → GET의 If-Range·Range 판단
      → Range를 적용하지 않음: 200 + 전체 본문
      → 유효한 단일 구간: 206 + 선택한 본문
      → 만족할 수 없는 구간: 416 + 전체 길이 안내
```

| 질문 | 핵심 정보 |
| --- | --- |
| 파일을 어떻게 식별하는가? | 고정 versionId와 전체 표현의 ETag |
| 몇 바이트를 요청하는가? | Range의 시작·끝 또는 마지막 N바이트 |
| 실제 어느 구간을 받았는가? | 206의 Content-Range |
| 이번 응답 본문은 얼마나 긴가? | Content-Length |
| 기존 파일에 붙여도 되는가? | 응답 상태·ETag·구간·저장한 바이트의 일치 |

조건 검사는 권한 검사의 대체물이 아니다. 본문이 없는 304·416·HEAD도 해당 산출물을 조회할 권한을 먼저 확인한다.

## 3. 본문 정리

### 3.1 Range는 문자나 CSV 행이 아니라 바이트 위치다

**Range는 선택한 표현의 일부 구간을 요청하는 HTTP 헤더**다. 여기서 표현(representation)은 서버가 이번 응답으로 제공하는 구체적인 데이터다. 같은 CSV라도 원본 UTF-8 바이트와 gzip으로 압축한 바이트는 같은 위치 체계로 취급할 수 없다.

이 노트는 압축하지 않은 원본 CSV 한 가지 표현만 제공한다. 위치는 0부터 시작하고 마지막 위치도 포함한다. 전체 길이가 1,024라면 마지막 위치는 1,023이며, 시작 100부터 끝 199까지의 길이는 `199 - 100 + 1 = 100`이다. [HTTP 바이트 범위](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.1.2)

| 요청 | 1,024바이트 파일에서 선택할 위치 | 응답 바이트 수 |
| --- | --- | ---: |
| `bytes=100-199` | 100~199 | 100 |
| `bytes=900-` | 900~1023 | 124 |
| `bytes=-128` | 마지막 128바이트, 즉 896~1023 | 128 |
| `bytes=900-9999` | 존재하는 끝인 1023까지만 | 124 |
| `bytes=1024-` | 시작 위치부터 파일 밖 | 만족 불가 |

`-128`은 음수 위치가 아니라 뒤에서 128바이트라는 **suffix 범위**다. UTF-8 한글 글자나 CSV 한 행이 중간에서 나뉠 수도 있으므로 각 조각을 독립된 문자열·CSV로 읽는 방식은 적합하지 않다. 바이트 그대로 저장·결합하고 완성된 파일을 해석한다.

### 3.2 206의 길이는 전체 파일 길이와 다르다

**206 Partial Content는 요청한 일부 구간을 보낸다는 응답**이다. 다음은 전체 1,024바이트 중 100~199를 반환하는 설명용 HTTP 응답이며 실제 호출 결과가 아니다.

```http
HTTP/1.1 206 Partial Content
Content-Type: text/csv; charset=utf-8
Accept-Ranges: bytes
Content-Range: bytes 100-199/1024
Content-Length: 100
```

`Content-Range`의 `/1024`는 전체 길이이고, `Content-Length: 100`은 **이번 응답 본문**의 길이다. 전체 길이를 Content-Length에 넣으면 클라이언트는 오지 않는 나머지를 기다리거나 불완전 응답으로 판단할 수 있다. 전체 GET의 200에는 Content-Range를 붙이지 않는다.

요청한 시작점이 파일 밖이면 다음과 같은 416을 선택할 수 있다. `*`는 반환할 구간이 없음을, `/1024`는 알려진 전체 길이를 뜻한다. 이 예제는 오류 본문을 비워 두므로 길이를 0으로 설정한다. [Content-Range·416 계약](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.4)

```http
HTTP/1.1 416 Range Not Satisfiable
Content-Range: bytes */1024
Content-Length: 0
```

⚠️ 주의: 416은 파일이 삭제됐다는 뜻도, 이미 내려받은 파일이 완전하다는 증거도 아니다. 잘못된 재개 위치나 다른 버전의 길이일 수 있으므로 ETag·전체 길이·로컬 파일 상태를 다시 확인한다.

### 3.3 ETag는 전체 표현을 구별하는 검증자다

**ETag(entity tag)는 서버가 선택한 표현을 구분하기 위해 부여하는 식별 문자열**이다. 검증자(validator)란 이전에 받은 결과와 현재 결과를 비교할 근거를 말한다. ETag는 권한 토큰이나 반드시 MD5인 값이 아니며, 클라이언트는 내부 형식을 해석하지 않고 서버가 준 값을 보관한다.

강한 ETag는 동일한 바이트를 구분하는 데 사용하고, `W/`로 시작하는 약한 ETag는 바이트가 완전히 같지 않아도 의미상 동등한 표현을 비교할 때 사용한다. 이어 붙일 바이트의 동일성이 필요한 If-Range에는 약한 ETag를 사용하지 않는다. [ETag 검증 강도](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3)

이번 **애플리케이션 설계**는 이전 업로드 검증에서 DB에 보관한 전체 파일 SHA-256 hex로 `"sha256-64자리해시"`를 만든다. 같은 바이트를 그대로 제공하고 형식도 고정한다는 전제에서 사용한다. 부분 응답마다 조각의 해시를 새 ETag로 만들지 않는다. S3 응답의 ETag와 이 애플리케이션 ETag는 서로 다른 계약이므로 그대로 교환해 쓰지 않는다.

`src/main/java/com/example/export/ReadyRepresentation.java`는 기존 `ReadyExport`에 검증한 해시를 묶는 **추가 파일 전체**다. DB 조회에서는 이전 노트의 소유자·READY·제공 기간 조건을 유지하고 `sha256_hex`도 같은 행에서 읽는다.

```java
package com.example.export;

import java.util.Objects; // 기존 READY 결과가 빠지는 것을 막는다.

public record ReadyRepresentation(ReadyExport file, String sha256Hex) {
    public ReadyRepresentation {
        Objects.requireNonNull(file, "READY file is required");
        // 요청자 입력이 아닌 업로드 검증 단계의 소문자 SHA-256을 사용한다.
        if (sha256Hex == null || !sha256Hex.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("approved SHA-256 hex is required");
        }
    }

    public String etag() {
        // 큰따옴표는 실제 HTTP ETag 문법의 일부다. W/가 없으므로 강한 태그다.
        return "\"sha256-" + sha256Hex + "\"";
    }
}
```

`ReadyRepresentationLookup.java`는 다음과 같다. 프로젝트에서 구현할 DB 조회 경계이며 인터페이스만 등록한다고 DB 조회가 생기는 것은 아니다.

```java
package com.example.export;

import java.util.Optional; // 접근할 수 없는 결과는 빈 값으로 돌려준다.
import java.util.UUID;

@FunctionalInterface
public interface ReadyRepresentationLookup {
    // 인증된 subject·소유자·READY·제공 기간 검사 후 같은 행의 파일 정보와 해시를 반환한다.
    // DB 장애를 Optional.empty()로 숨기지 않고 실패로 전달한다.
    Optional<ReadyRepresentation> findDownloadable(UUID exportId, String subject);
}
```

### 3.4 If-None-Match와 If-Range는 질문이 다르다

**If-None-Match는 현재 표현이 이미 가진 것과 다를 때만 본문을 보내 달라는 조건**이다. GET·HEAD에서 일치하면 304 Not Modified로 본문을 생략한다. 반면 **If-Range는 같은 표현이면 요청한 조각을, 다르면 전체 표현을 보내 달라는 조건**이다. 불일치했다고 304나 412로 바꾸는 것이 아니라 Range를 무시한다. [조건부 요청](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1)

| 조건 | 예제의 판단 | 본문 |
| --- | --- | --- |
| `If-Match`가 현재 강한 ETag와 불일치 | 412 Precondition Failed | 없음 |
| `If-None-Match`가 현재 ETag와 일치 | 304 Not Modified | 없음 |
| `If-Range`가 현재 강한 ETag와 일치 + 유효한 Range | 206 | 요청 구간 |
| `If-Range`가 불일치·약한 태그·지원하지 않는 날짜 조건 | Range를 적용하지 않은 200 | 전체 |

`If-Match`는 표현이 바뀌었다면 작업하지 말라는 조건이다. 이 노트에서는 GET·HEAD에서도 그 조건을 먼저 확인한다. If-Match는 강한 비교, If-None-Match는 약한 비교를 사용하며, `*` 조건은 이미 권한 있는 현재 표현을 조회한 뒤 평가한다. Spring의 [ETag API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/ETag.html)는 목록 해석과 강한·약한 비교를 제공한다.

파일 앞부분만 가진 클라이언트가 `If-None-Match`에 이전 ETag를 넣으면 본문 없는 304가 와도 뒷부분을 얻지 못한다. 이어받기에는 `Range + If-Range`를 사용하고, 완전한 기존 표현의 재검증과 혼동하지 않는다.

날짜 기반 `Last-Modified`는 이번 READY 모델에 포함하지 않는다. 따라서 `If-Modified-Since`·`If-Unmodified-Since`는 평가하지 않으며 날짜형 If-Range는 일치를 증명하지 못해 전체 응답으로 간다. 날짜를 지원하는 구현으로 확장할 때는 초 단위 정밀도·평가 우선순위까지 함께 설계해야 한다.

### 3.5 권한·일반 조건·Range 순서를 지킨다

권한이 없는 사람에게 ETag나 전체 길이부터 알려주지 않는다. 먼저 이전 노트처럼 신원·산출물 소유자·READY·제공 기간을 확인한다. 그다음 일반 조건이 304·412를 결정하면 Range 계산과 S3 본문 조회를 하지 않는다.

예를 들어 If-None-Match가 일치하면서 `Range: bytes=999999-`를 보냈다면, 이번 흐름은 416이 아니라 304에서 끝난다. 반대로 If-Range가 불일치하면 그 Range 자체를 무시하므로 범위 초과 검사보다 전체 200 선택이 먼저다. [조건 평가 우선순위](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.2)

이번 예제는 단일 범위만 지원한다. 여러 구간, 모르는 단위, 잘못된 범위 문법, 구현 한도를 넘는 숫자·길이는 Range를 적용하지 않고 전체 200으로 처리한다. 이는 **예제 정책**이지 “지원하지 않으면 항상 416”이라는 규칙이 아니다. 빈 파일도 Range를 무시하고 길이 0의 200을 사용한다. 클라이언트는 서버가 Range를 적용하지 않을 수 있음을 고려해야 한다.

아래 `DownloadRequestPlanner.java`는 HTTP 응답을 결정하는 **추가 파일 전체**다. 기존 Boot MVC 프로젝트의 `spring-web` 타입을 사용하며, 그 관리 버전을 임의로 섞지 않는다. `HttpRange`와 `ETag`의 동작은 [7.0.10 HttpRange 소스](https://github.com/spring-projects/spring-framework/blob/v7.0.10/spring-web/src/main/java/org/springframework/http/HttpRange.java), [7.0.10 ETag 소스](https://github.com/spring-projects/spring-framework/blob/v7.0.10/spring-web/src/main/java/org/springframework/http/ETag.java)로 확인했다.

```java
package com.example.export;

import java.util.List; // 같은 이름으로 여러 번 온 헤더도 확인한다.
import org.springframework.http.ETag; // 태그 목록과 강한·약한 비교를 맡긴다.
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange; // 범위 문법 해석·suffix·끝 위치 보정을 사용한다.

public final class DownloadRequestPlanner {
    private DownloadRequestPlanner() { } // 상태 없는 판단 함수를 제공한다.

    public static Plan select(String method, HttpHeaders headers, long total, String etag) {
        if ((!"GET".equals(method) && !"HEAD".equals(method)) || total < 0
                || etag == null || !etag.matches("\"sha256-[0-9a-f]{64}\"")) {
            throw new IllegalArgumentException("GET/HEAD and trusted representation required");
        }
        ETag current = ETag.create(etag); // 서버가 생성한 강한 태그다.
        List<String> ifMatch = values(headers, HttpHeaders.IF_MATCH);
        if (!ifMatch.isEmpty() && !matches(ifMatch, current, true)) {
            return new Plan(412, 0, -1, total); // 변경되지 않았다는 전제가 틀렸다.
        }
        List<String> ifNoneMatch = values(headers, HttpHeaders.IF_NONE_MATCH);
        if (!ifNoneMatch.isEmpty() && matches(ifNoneMatch, current, false)) {
            return new Plan(304, 0, -1, total); // 본문이 필요 없으므로 Range보다 먼저 끝낸다.
        }

        Plan full = new Plan(200, 0, total - 1, total); // 빈 파일이면 끝 위치는 -1이다.
        if ("HEAD".equals(method) || total == 0) {
            return full; // HEAD와 빈 표현에는 이번 정책상 Range를 적용하지 않는다.
        }
        List<String> ranges = values(headers, HttpHeaders.RANGE);
        if (ranges.size() != 1) {
            return full; // Range 없음·중복 필드는 첫 번째만 임의 채택하지 않는다.
        }
        List<String> ifRange = values(headers, HttpHeaders.IF_RANGE);
        if (!ifRange.isEmpty()
                && (ifRange.size() != 1 || !etag.equals(ifRange.get(0).trim()))) {
            return full; // 강한 태그의 정확한 일치만 인정한다. 날짜·W/·*도 불일치다.
        }

        String raw = ranges.get(0).trim();
        if (raw.length() > 256 || raw.contains(",") || !raw.startsWith("bytes=")) {
            return full; // 학습용 파싱 상한·단일 구간·지원 단위를 먼저 제한한다.
        }
        String spec = raw.substring("bytes=".length()).trim();
        if (!spec.matches("(?:[0-9]+-[0-9]*|-[0-9]+)")) {
            return full; // + 부호 등 숫자 파서가 받아들일 수 있는 비표준 문법도 제외한다.
        }
        List<HttpRange> parsed;
        try {
            parsed = HttpRange.parseRanges("bytes=" + spec); // 너무 큰 long 값도 예외로 빠진다.
        } catch (IllegalArgumentException invalidOrTooLarge) {
            return full; // 파싱 실패를 음수 위치·500 응답으로 바꾸지 않는다.
        }
        if (parsed.size() != 1) {
            return full; // 빈 범위 목록도 전체 전송 정책으로 처리한다.
        }
        HttpRange range = parsed.get(0);
        long start = range.getRangeStart(total); // suffix도 실제 시작 위치로 환산한다.
        long end = range.getRangeEnd(total); // 요청 끝이 크면 total - 1까지 줄인다.
        if (start >= total || end < start) {
            return new Plan(416, 0, -1, total); // 파일 밖의 시작·0길이 suffix 등이다.
        }
        return new Plan(206, start, end, total); // 마지막 바이트를 포함한 유효 구간이다.
    }

    private static List<String> values(HttpHeaders headers, String name) {
        List<String> found = headers.get(name);
        return found == null ? List.of() : found; // 없는 헤더는 빈 목록으로 통일한다.
    }

    private static boolean matches(List<String> fields, ETag current, boolean strong) {
        return fields.stream().flatMap(field -> ETag.parse(field).stream())
                .anyMatch(candidate -> candidate.isWildcard() || candidate.compare(current, strong));
        // 쉼표로 단순 split하지 않는다. 태그 목록의 해석은 Spring API가 맡는다.
    }

    public record Plan(int status, long start, long end, long total) {
        public long contentLength() {
            if (status == 200) return total; // HEAD에도 전체 GET의 길이 헤더를 사용할 수 있다.
            if (status == 206) return end - start + 1; // 끝을 포함하므로 +1이다.
            return 0; // 304에는 이 0을 Content-Length로 붙이지 않는다.
        }

        public String contentRange() {
            if (status == 206) return "bytes " + start + "-" + end + "/" + total;
            if (status == 416) return "bytes */" + total;
            return null; // 전체·조건부 무본문 응답에는 범위 헤더가 없다.
        }

        public String storageRange() {
            if (status != 206) throw new IllegalStateException("not a partial response");
            return "bytes=" + start + "-" + end; // S3에도 정규화한 같은 범위를 요청한다.
        }
    }
}
```

이 코드는 저장소나 DB를 호출하지 않는다. 동일한 입력 메타데이터와 헤더에는 동일한 전송 계획을 반환하므로 경계값 테스트를 하기 좋다. 파싱 상한 256은 학습용 선택이며 웹 서버 전체 헤더 크기 제한·호출 빈도 제한을 대신하지 않는다. Range를 무시하면 오히려 전체 전송량이 커질 수 있으므로 별도의 다운로드 자원 한도도 유지한다.

일반적인 로컬 `Resource` 반환에는 Spring MVC의 자동 Range 처리를 활용할 수 있다. 다만 `InputStreamResource`는 그 지원 대상이 아니고 `ResponseEntity<Resource>`의 상태 조건도 있다. 이전 노트처럼 **StreamingResponseBody를 반환한다고 자동 부분 전송이 생기는 것은 아니다**. 여기서는 S3의 특정 버전을 직접 부분 조회하기 위해 판단과 전송을 명시적으로 연결한다. [Spring MVC Range 지원 범위](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-range.html)

### 3.6 고정 버전에서 선택한 구간만 읽는다

S3 GET에도 `Range`를 지정하면 필요한 구간만 요청할 수 있다. 전체 객체를 받아 앞부분을 버리는 `skip` 방식과는 원격 전송량이 다르다. 단일 S3 GET은 여러 범위를 한 번에 반환하는 방식은 지원하지 않으므로 이번 단일 구간 정책과 잘 맞는다. [S3 GetObject Range](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html), [S3 바이트 범위 조회](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance-guidelines.html)

다음 `RangeExportDownloadController.java`는 **이전 노트의 ExportDownloadController를 교체하는 파일 전체**다. 같은 URL을 가진 두 Controller를 동시에 등록하지 않는다. `ReadyExport`는 이전 파일을 유지하고, 앞의 세 파일과 `ReadyRepresentationLookup`의 실제 DB 구현을 추가한다. 기존 MVC·Security 설정, 인증된 subject, 제한된 실행기·외부 I/O timeout, SDK 2.31.54의 S3Client Bean도 그대로 필요하다.

```java
package com.example.export;

import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest; // 실제 GET·HEAD를 구분한다.
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

@RestController
public class RangeExportDownloadController {
    private final ReadyRepresentationLookup lookup; // 권한·공개·해시를 한 번에 읽는 경계다.
    private final S3Client s3; // 애플리케이션이 수명을 관리하는 공유 클라이언트다.

    public RangeExportDownloadController(ReadyRepresentationLookup lookup, S3Client s3) {
        this.lookup = lookup;
        this.s3 = s3;
    }

    @RequestMapping(path = "/exports/{exportId}/download",
            method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<StreamingResponseBody> download(
            @PathVariable("exportId") UUID exportId,
            @RequestHeader HttpHeaders requestHeaders,
            HttpServletRequest request, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        ReadyRepresentation representation = lookup.findDownloadable(exportId, authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // 권한 없는 사람에게 ETag·길이·존재 여부를 먼저 알려주지 않는다.
        ReadyExport file = representation.file();
        String etag = representation.etag();
        var plan = DownloadRequestPlanner.select(request.getMethod(), requestHeaders, file.bytes(), etag);
        var response = ResponseEntity.status(plan.status())
                .eTag(etag) // 조각의 해시가 아닌 전체 표현의 동일한 ETag다.
                .cacheControl(CacheControl.noStore()) // 이전 비공개 다운로드 정책을 유지한다.
                .header(HttpHeaders.ACCEPT_RANGES, "bytes");

        if (plan.contentRange() != null) {
            response.header(HttpHeaders.CONTENT_RANGE, plan.contentRange()); // 206 또는 416의 구간 정보다.
        }
        if (plan.status() == 304) {
            return response.build(); // 본문도 없고 Content-Length: 0도 임의로 붙이지 않는다.
        }
        response.contentLength(plan.contentLength()); // 206이면 구간 길이, 200이면 전체 길이다.
        if (plan.status() == 412 || plan.status() == 416) {
            return response.build(); // 예제의 오류 본문은 비어 있고 S3를 호출하지 않는다.
        }
        response.contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.filename()).build().toString());
        if ("HEAD".equals(request.getMethod()) || plan.contentLength() == 0) {
            return response.build(); // HEAD는 원격 본문을 읽었다 버리는 방식으로 만들지 않는다.
        }
        return response.body(stream(file, plan)); // 여기서는 콜백만 만들고 스트림은 열지 않는다.
    }

    private StreamingResponseBody stream(ReadyExport file, DownloadRequestPlanner.Plan plan) {
        var builder = GetObjectRequest.builder()
                .bucket(file.bucket()).key(file.key()).versionId(file.versionId()); // 항상 고정 버전이다.
        if (plan.status() == 206) {
            builder.range(plan.storageRange()); // HTTP로 보낼 구간과 S3 요청 구간을 일치시킨다.
        }
        GetObjectRequest storageRequest = builder.build();
        return output -> {
            try (ResponseInputStream<GetObjectResponse> input = s3.getObject(storageRequest)) {
                try {
                    GetObjectResponse remote = input.response();
                    boolean sameVersion = Objects.equals(file.versionId(), remote.versionId());
                    boolean sameLength = Objects.equals(Long.valueOf(plan.contentLength()), remote.contentLength());
                    boolean sameRange = Objects.equals(plan.contentRange(), remote.contentRange());
                    if (remote.sdkHttpResponse().statusCode() != plan.status()
                            || !sameVersion || !sameLength || !sameRange) {
                        throw new IOException("storage response differs from selected representation range");
                    } // upstream이 전체 200을 보냈는데 일부만 온 것처럼 취급하지 않는다.
                    copyExactly(input, output, plan.contentLength()); // 선택한 구간 길이만큼 전송한다.
                } catch (IOException | RuntimeException failure) {
                    try {
                        input.abort(); // 중도 쓰기 실패·원격 계약 불일치에서 남은 입력을 중단한다.
                    } catch (RuntimeException abortFailure) {
                        failure.addSuppressed(abortFailure); // 정리 실패가 최초 원인을 가리지 않게 한다.
                    }
                    throw failure; // 본문 뒤에 JSON 오류를 이어 쓰지 않는다.
                }
            } // 입력은 정상·예외 경로에서 close한다. Servlet 출력·공유 S3Client는 닫지 않는다.
        };
    }

    private static void copyExactly(InputStream input, OutputStream output, long expected) throws IOException {
        byte[] buffer = new byte[8192]; // 범위가 커도 고정된 크기의 버퍼를 재사용한다.
        long remaining = expected;
        while (remaining > 0) {
            int read = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (read < 0) throw new EOFException("storage body ended before selected range completed");
            output.write(buffer, 0, read); // 실제 읽은 바이트만 출력한다.
            remaining -= read;
        }
        if (input.read() != -1) {
            throw new IOException("storage body exceeds selected range"); // 초과 바이트는 전달하지 않는다.
        }
    }
}
```

정상 부분 요청에서는 S3 응답도 206이고, 그 Content-Length는 전체 크기가 아니라 부분 크기여야 한다. 응답 Content-Range·버전까지 대조한 뒤 본문을 보낸다. 이 필드들은 [SDK 2.31.54 S3 모델](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/resources/codegen-resources/service-2.json)에서 확인했다.

헤더 준비가 끝나도 전송 성공이 확정된 것은 아니다. 콜백에서 저장소가 실패하거나 본문 중간에 연결이 끊기면 이전 노트의 commit 전후 오류·abort·close 원칙을 적용한다. S3의 403을 최종 사용자 권한 실패로 오인하거나 원격 416을 그대로 정상적인 클라이언트 범위 오류로 넘기지 않는다. DB 길이로 유효성을 확인했는데 고정 버전의 원격 조회가 거절됐다면 이력·보존·권한의 불일치를 조사한다.

### 3.7 HEAD는 본문 없는 조회이지 권한 없는 조회가 아니다

**HEAD는 대응하는 GET의 응답 정보를 본문 없이 확인하는 메서드**다. 이 예제는 HEAD를 명시적으로 매핑해 READY 길이·ETag·제안 파일명을 반환하고, Range는 무시한다. If-None-Match가 일치하면 HEAD도 304가 될 수 있다. [HEAD 의미](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.2)

예를 들어 파일이 1,024바이트라면 HEAD 200의 Content-Length는 1,024일 수 있지만 실제 본문은 없다. 반면 304에 Content-Length를 넣는다면 대응하는 200의 길이 규칙을 지켜야 하므로, 이번 코드는 혼동을 피하려고 그 헤더를 생략한다. “본문이 없으니 모든 상태에 길이 0을 붙인다”는 구현은 적절하지 않다.

이번 HEAD는 DB의 공개 메타데이터를 확인하며 원격 객체의 현재 접근 가능성까지 실시간 검사하지 않는다. 저장소 점검이 필요한 서비스는 고정 버전의 HEAD를 별도로 추가할 수 있지만, 그 성공이 이후 GET 중 삭제·권한 변경·전송 실패를 막지는 않는다.

### 3.8 클라이언트도 상태를 보고 이어 붙일지 결정한다

**재개 위치(offset)는 로컬에 연속해서 확정 저장한 바이트 다음 위치**다. 0~599를 올바르게 저장했다면 다음 요청은 `bytes=600-`이다. 네트워크에서 잠시 읽었지만 디스크에 저장하지 못한 바이트나, 빈 공간이 섞인 임시 파일의 겉보기 길이를 재개 위치로 사용하지 않는다.

클라이언트는 임시 파일과 함께 exportId, 전체 ETag, 전체 길이, 확정 저장 위치를 보관한다. 다음은 처음 600바이트가 확정되어 있고, 예시 ETag가 `"revision-a"`일 때의 **설명용 요청**이다. 실제 애플리케이션은 서버가 준 전체 ETag 문자열을 그대로 사용한다.

```http
GET /exports/00000000-0000-0000-0000-000000000001/download HTTP/1.1
Range: bytes=600-
If-Range: "revision-a"
```

| 받은 응답 | 클라이언트의 처리 방향 |
| --- | --- |
| 206 + 시작 600 + 같은 ETag·전체 길이 | Content-Range·Content-Length·수신 바이트 수를 확인하며 해당 위치에 저장 |
| 200 | 부분 파일에 붙이지 않고 새 임시 파일로 전체 수신을 시작 |
| 304 | 뒷부분이 온 것이 아니다. 완전한 사본이 있는 재검증 상황인지 확인 |
| 412 | 요구한 버전 조건이 틀림. 자동 이어 붙이기 중단 |
| 416 | 서버 전체 길이와 로컬 위치·ETag를 재확인; 완료라고 단정하지 않음 |
| 401·404 또는 전송 실패 | 권한·공개 상태·확정 저장 위치를 확인하고 같은 조건으로 재개 가능성 판단 |

206이라고 해도 시작 위치가 요청과 다르면 결합하지 않는다. 최종 파일은 전체 길이와 제공받은 검증 계약을 확인한 뒤 완료 파일로 전환한다. SHA-256 기반 ETag를 썼더라도 일반 HTTP ETag는 임의 문자열이므로, 파일 검증용 해시를 클라이언트가 직접 계산·대조하려면 별도의 명시적인 체크섬 계약이 필요하다.

⚠️ 주의: `200` 응답의 전체 본문을 기존 부분 파일 뒤에 덧붙이면 앞부분이 중복된다. Range 요청을 보냈다는 사실보다 **실제 응답 상태와 구간**을 기준으로 저장 방식을 선택한다.

### 3.9 캐시·압축·다운로드 제한을 별도로 유지한다

**HTTP 캐시는 이전 응답을 보관해 재사용하는 기능**이다. 304는 완전한 기존 응답의 재검증에 사용되지만, 이번 개인 산출물 API는 이전 노트의 `Cache-Control: no-store` 정책을 유지한다. 자동 캐시에 민감한 파일을 저장하도록 권장하는 예제가 아니다. 직접 조건을 보내는 클라이언트에 대한 응답 규칙과 자동 캐시 보관 정책은 구분한다. [HTTP 캐시의 no-store](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5)

no-store가 사용자가 명시적으로 저장한 파일을 회수하는 기능은 아니다. 로컬 임시 파일·로그의 보존 정책은 클라이언트가 따로 정한다. 다른 출처의 웹 화면에서 응답 헤더를 읽게 하는 경우에도 CORS 허용·헤더 노출은 객체별 인가를 대신하지 않으며, 이번 서버 예제에는 프런트엔드의 저장·이어받기 구현을 포함하지 않는다.

압축이나 프록시 변환을 켜면 ETag·길이·범위의 기준 바이트가 유지되는지 다시 확인해야 한다. 본문을 변환하면서 원본 파일의 강한 ETag와 Content-Range를 그대로 붙이지 않는다. 따라서 이 실습 경로에서는 응답 압축·CSV 재인코딩·중간 프록시의 본문 변환을 하지 않는 구성을 전제로 한다.

또한 한 사용자가 작은 범위를 수천 번 요청하면 전체 파일 하나보다 요청·인증·연결 비용이 커질 수 있다. 단일 구간 정책은 일부 복잡성을 줄일 뿐, 사용자별 호출 빈도·동시 전송 수·총 전송량 한도와 유한 대기를 대신하지 않는다. 이 제한은 [Bulkhead·Rate Limiter 노트](../28_09_29_Bulkhead_and_Rate_Limiting/09_29_Bulkhead_and_Rate_Limiting.md)의 자원 구분과 연결된다.

### 3.10 정상 구간보다 경계·조건 순서를 먼저 테스트한다

아래는 `src/test/java/com/example/export/DownloadRequestPlannerTest.java`의 **추가 파일 전체**다. 기존 프로젝트의 JUnit Jupiter와 Spring Web 의존성, 앞의 `DownloadRequestPlanner`가 필요하다. Spring 서버·S3를 실행하지 않는 판단 함수 테스트이며, 이 노트에서도 실행하지 않았다.

```java
package com.example.export;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import static org.junit.jupiter.api.Assertions.*;

class DownloadRequestPlannerTest {
    // 실제 파일에서 계산한 값이 아니라 조건 비교용으로 고정한 형식상 유효한 태그다.
    private static final String TAG = "\"sha256-" + "a".repeat(64) + "\"";

    @Test
    void calculatesInclusiveOpenSuffixAndClampedRanges() {
        assertPartial("bytes=100-199", 100, 199); // 닫힌 구간: 끝도 포함한다.
        assertPartial("bytes=900-", 900, 1023); // 끝 생략: 마지막 위치까지다.
        assertPartial("bytes=-128", 896, 1023); // 뒤에서 128바이트다.
        assertPartial("bytes=900-9999", 900, 1023); // 존재하는 끝 위치까지만 보낸다.
    }

    @Test
    void noRangeMeansFullResponseEvenWithIfRange() {
        var plan = get(headers(null, "\"old-version\""));
        assertEquals(200, plan.status()); // If-Range만으로 부분 응답을 만들지 않는다.
        assertEquals(1024, plan.contentLength());
        assertNull(plan.contentRange());
    }

    @Test
    void rejectsOutOfBoundsAndZeroSuffix() {
        for (String value : List.of("bytes=1024-", "bytes=-0")) {
            var plan = get(headers(value, null));
            assertEquals(416, plan.status());
            assertEquals("bytes */1024", plan.contentRange()); // 클라이언트가 전체 길이를 재확인한다.
            assertEquals(0, plan.contentLength()); // 예제의 416 본문은 비어 있다.
        }
    }

    @Test
    void unsupportedOrInvalidRangesFallBackToFullResponse() {
        for (String value : List.of("items=0-1", "bytes=0-1,5-6", "bytes=10-2",
                "bytes=999999999999999999999999-", "bytes=", "bytes=+1-2")) {
            assertEquals(200, get(headers(value, null)).status()); // 이 예제의 무시 정책을 고정한다.
        }
    }

    @Test
    void changedWeakOrDateIfRangeIgnoresRangeBeforeBoundsCheck() {
        for (String value : List.of("\"old-version\"", "W/" + TAG,
                "Sat, 24 Oct 2026 00:00:00 GMT")) {
            assertEquals(200, get(headers("bytes=9999-", value)).status());
            // 범위가 파일 밖이어도 If-Range가 불일치하면 Range 자체를 무시한다.
        }
        assertEquals(206, get(headers("bytes=600-", TAG)).status()); // 같은 강한 태그만 부분 전송한다.
    }

    @Test
    void notModifiedTakesPrecedenceOverRange() {
        var request = headers("bytes=9999-", null);
        request.add(HttpHeaders.IF_NONE_MATCH, "\"other\", W/" + TAG);
        assertEquals(304, get(request).status()); // If-None-Match에는 약한 비교를 사용한다.
        request.set(HttpHeaders.IF_NONE_MATCH, "*");
        assertEquals(304, get(request).status()); // 승인된 현재 표현이 있으므로 wildcard도 일치한다.
    }

    @Test
    void failedIfMatchPrecedesIfNoneMatch() {
        var request = headers("bytes=0-9", null);
        request.add(HttpHeaders.IF_MATCH, "W/" + TAG); // 바이트 동일성을 요구하는 강한 비교에는 불일치다.
        request.add(HttpHeaders.IF_NONE_MATCH, TAG); // 뒤의 조건이 일치해도 앞선 실패가 우선한다.
        assertEquals(412, get(request).status());
    }

    @Test
    void headIgnoresRangeButKeepsConditionalEvaluation() {
        var request = headers("bytes=10-19", TAG);
        var plan = DownloadRequestPlanner.select("HEAD", request, 1024, TAG);
        assertEquals(200, plan.status());
        assertEquals(1024, plan.contentLength()); // 실제 HEAD 본문을 보낸다는 뜻은 아니다.
        request.add(HttpHeaders.IF_NONE_MATCH, TAG);
        assertEquals(304, DownloadRequestPlanner.select("HEAD", request, 1024, TAG).status());
    }

    @Test
    void emptyRepresentationIgnoresRange() {
        var plan = DownloadRequestPlanner.select("GET", headers("bytes=-1", null), 0, TAG);
        assertEquals(200, plan.status()); // 빈 파일에서는 Range를 무시하기로 한 정책이다.
        assertEquals(0, plan.contentLength());
        assertNull(plan.contentRange());
    }

    @Test
    void repeatedRangeFieldsAreNotSilentlyReducedToFirst() {
        var request = headers("bytes=0-1", null);
        request.add(HttpHeaders.RANGE, "bytes=5-6"); // 같은 이름의 두 번째 필드다.
        assertEquals(200, get(request).status()); // 한 필드만 골라 다른 의미로 처리하지 않는다.
    }

    private static HttpHeaders headers(String range, String ifRange) {
        var result = new HttpHeaders();
        if (range != null) result.add(HttpHeaders.RANGE, range);
        if (ifRange != null) result.add(HttpHeaders.IF_RANGE, ifRange);
        return result;
    }

    private static DownloadRequestPlanner.Plan get(HttpHeaders headers) {
        return DownloadRequestPlanner.select("GET", headers, 1024, TAG); // 공통 fixture 길이다.
    }

    private static void assertPartial(String range, long start, long end) {
        var plan = get(headers(range, TAG));
        assertAll(
                () -> assertEquals(206, plan.status()),
                () -> assertEquals(start, plan.start()),
                () -> assertEquals(end, plan.end()),
                () -> assertEquals(end - start + 1, plan.contentLength()),
                () -> assertEquals("bytes " + start + "-" + end + "/1024", plan.contentRange()),
                () -> assertEquals("bytes=" + start + "-" + end, plan.storageRange()));
    }
}
```

선택한 Java 프로젝트 루트에서 다음 명령으로 테스트할 수 있다. **예상 결과는 10개 테스트 통과**이며 현재 환경에서 얻은 실행 결과는 아니다.

```powershell
# 기존 Gradle 프로젝트에 클래스와 JUnit 의존성이 준비된 상태에서 실행한다.
.\gradlew.bat test --tests "com.example.export.DownloadRequestPlannerTest"
```

계산 테스트가 통과해도 Controller의 헤더·자원 정리·인증 필터가 검증된 것은 아니다. [이전 노트의 전송 테스트](../43_10_23_File_Download_Streaming_and_Access_Control/10_23_File_Download_Streaming_and_Access_Control.md)에 다음 경계를 추가한다.

| 실제 적용에서 추가할 검사 | 확인할 증거 |
| --- | --- |
| 타인 exportId에 Range·If-None-Match·HEAD 요청 | 기존 거절 정책 유지, ETag·길이·S3 호출 미노출 |
| 206 경로의 SDK 요청·응답 대역 | 고정 versionId·정규화한 Range, 정확한 부분 바이트 |
| 304·412·416·HEAD·빈 파일 | 원격 본문 스트림을 열지 않음, 상태별 올바른 헤더·무본문 |
| 원격이 Range를 무시하거나 다른 버전·길이·구간을 반환 | 본문 전송 전 거절·abort·close |
| 실제 MVC 보안·비동기 전송 | GET·HEAD 매핑과 재디스패치, 전송 중 실패의 관측 |
| 600바이트 저장 후 연결 중단·재요청 | 206의 구간 확인 뒤 완성한 파일이 원본과 바이트 단위 일치 |
| 재개 중 ETag가 달라짐 | 200을 기존 부분 파일에 덧붙이지 않음 |
| 프록시·압축 설정·느린 수신·반복 작은 범위 | 표현 불변·유한 대기·연결 반환·자원 제한 유지 |

테스트에서 일부 요청만 성공한 것으로 끝내지 않고, 임시 파일을 완성했을 때 원본 바이트와 대조한다. 실제 이어받기 시험에서는 로컬 확정 저장 위치와 네트워크 수신 위치를 구분하며, 실패한 조각을 성공한 조각으로 기록하지 않는다.

## 4. 적용 관점에서 다시 보기

권한 있는 READY 이력에서 고정 버전·전체 길이·해시를 함께 읽는 것이 시작점이다. 이후 일반 조건을 먼저 평가하고, 전체 전송이 가능한 경우에만 If-Range와 단일 범위를 적용한다. 304·416·HEAD라는 이유로 객체별 인가를 건너뛰지 않는다.

전송 단계에서는 HTTP 구간과 저장소 구간을 같은 계획에서 만들고 원격 응답이 그 계획과 일치하는지 확인한다. 부분 길이와 전체 길이, 파일 ETag와 S3 ETag, 서버가 보낸 양과 클라이언트가 저장한 양을 각각 구분한다.

클라이언트는 요청한 Range가 아니라 받은 상태·구간을 보고 저장 방법을 선택한다. 206을 검증해 이어 붙이고, 200이면 새 전체 수신으로 전환한다. 운영에서는 단위 계산뿐 아니라 실제 재개 결과·권한·프록시 변환·자원 제한까지 확인한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

이어받기는 남은 바이트의 전송만이 아니라, 같은 표현의 올바른 위치를 이어 붙이는 계약이다. Range는 위치를, ETag와 If-Range는 동일성을, 권한 검사는 제공 가능 여부를 담당한다.

### 5.2 이전·다음 학습과의 연결

[파일 다운로드 노트](../43_10_23_File_Download_Streaming_and_Access_Control/10_23_File_Download_Streaming_and_Access_Control.md)의 전체 스트리밍에 부분 응답·조건 평가·본문 없는 조회를 추가했다. 다음 [파일 업로드 API·multipart 요청과 입력 검증](../45_10_26_File_Upload_Multipart_and_Validation/10_26_File_Upload_Multipart_and_Validation.md)에서는 사용자가 보내는 파일의 크기·이름·내용을 검증하고 비공개 저장으로 연결한다.

### 5.3 더 파볼 만한 주제

여러 범위를 병렬로 받을 때는 조각의 겹침·빈 구간·확정 저장 위치를 어떻게 관리할 수 있을까? 날짜 기반 검증자나 압축 표현을 추가할 때 ETag·범위의 기준을 유지하는 방법도 후속 심화 주제다.

### 5.4 참고 자료

- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): HEAD, 검증자, 조건 평가 순서와 Range·부분 응답의 표준 의미.
- [RFC 9111 no-store](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5): 자동 캐시 저장 제한과 애플리케이션 파일 보관의 구분.
- [Spring MVC Range](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-range.html): Resource 기반 자동 지원의 조건.
- [Spring ETag API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/ETag.html), [7.0.10 구현](https://github.com/spring-projects/spring-framework/blob/v7.0.10/spring-web/src/main/java/org/springframework/http/ETag.java): 목록 해석·wildcard·강한/약한 비교.
- [Spring HttpRange API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/HttpRange.html), [7.0.10 구현](https://github.com/spring-projects/spring-framework/blob/v7.0.10/spring-web/src/main/java/org/springframework/http/HttpRange.java): suffix·끝 위치 보정·숫자 파싱 경계.
- [S3 GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html), [범위 조회 지침](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance-guidelines.html): 고정 버전·단일 범위 요청과 응답 메타데이터.
- [AWS SDK 2.31.54 모델](https://github.com/aws/aws-sdk-java-v2/blob/2.31.54/services/s3/src/main/resources/codegen-resources/service-2.json): Range·VersionId·ContentRange·ContentLength 필드.
- [Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html): 예제에 사용한 Boot·Spring 관리 조합.

## 6. 요약 정리

- Range의 위치는 0부터 세는 바이트이며 마지막 위치를 포함한다.
- 206의 Content-Length는 부분 길이, Content-Range의 `/N`은 전체 길이다.
- ETag는 전체 표현의 식별자이며, 이어받기의 동일성 검증에는 강한 태그가 필요하다.
- 객체별 인가 뒤 일반 조건을 먼저 평가하고, 그다음 If-Range·Range를 판단한다.
- If-None-Match 일치는 304, If-Range 불일치는 Range를 적용하지 않은 전체 200으로 연결된다.
- 416은 완료 증거가 아니다. 로컬 위치·전체 길이·ETag를 재확인한다.
- 고정 S3 버전에서 같은 구간을 읽고, 원격 상태·길이·범위를 대조한 뒤 보낸다.
- HEAD·304는 본문 없이 처리하며 상태에 맞지 않는 길이 헤더를 임의로 붙이지 않는다.
- 클라이언트는 206을 검증해 결합하고 200이면 새로 받는다. 권한·자원·캐시 정책은 별도 유지한다.

🧠 기억할 것: **이어받기는 “같은 파일의 정확한 다음 바이트”라는 사실을 서버와 클라이언트가 함께 확인하는 과정이다.**

## 7. 미니 퀴즈 또는 체크리스트

1. 전체 길이가 1,024이고 요청이 `bytes=900-9999`라면 Content-Range와 Content-Length는 각각 무엇인가?
2. `If-None-Match`가 일치하지만 Range가 파일 밖이다. 어떤 판단이 먼저이며, 왜 그런가?
3. 앞의 600바이트를 저장한 클라이언트가 이어받기를 요청했는데 200을 받았다. 기존 파일에 붙여도 되는가?
4. 1,024바이트 파일에 `bytes=1024-`를 요청해 416을 받으면 이미 저장한 파일이 완전하다고 판단해도 되는가?
5. HEAD에서는 본문을 보내지 않는다. 소유자 검사와 원격 파일 전체 읽기를 각각 생략해도 되는가?

<details>
<summary>정답과 해설</summary>

1. `Content-Range: bytes 900-1023/1024`, `Content-Length: 124`다. 요청 끝이 커도 실제 마지막 위치까지만 선택하고 끝을 포함해 센다.
2. 일반 조건이 먼저이므로 GET·HEAD에서는 304다. Range는 조건 평가 뒤 전체 200으로 진행할 수 있는 경우에만 고려한다.
3. 안 된다. Range가 무시됐거나 If-Range가 불일치하여 전체 표현이 왔을 수 있다. 새 임시 파일로 전체 수신하고 기존 부분 파일과 섞지 않는다.
4. 안 된다. 서버의 길이·ETag와 로컬 확정 저장 위치가 맞는지 확인해야 한다. 길이가 같아도 내용이 잘못되거나 다른 버전일 수 있다.
5. 소유자·READY·제공 기간 검사는 유지한다. 원격 본문 전체 읽기는 필요 없으며 이번 HEAD는 DB 메타데이터로 응답한다. 저장소 접근 가능성을 실시간 점검하는 것과는 별개다.

</details>
