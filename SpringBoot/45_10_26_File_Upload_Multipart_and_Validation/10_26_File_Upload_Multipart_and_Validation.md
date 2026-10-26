# 파일 업로드 API·multipart 요청과 입력 검증

- 🎯 글의 목표: 파일과 JSON을 함께 받는 요청을 이해하고, 크기·이름·내용 검증을 통과한 바이트만 비공개 저장 계층에 전달한다.
- 🧩 핵심 키워드: multipart/form-data, boundary, MultipartFile, RequestPart, Bean Validation, 크기 제한, UTF-8 검증, 격리 저장, CSRF
- ⭐ 중요도: 높음. 업로드는 외부 입력이 서버의 메모리·디스크·후속 처리기로 들어오는 경계이므로 바인딩 성공과 안전한 저장을 구분해야 한다.
- 📝 한눈에 보는 내용: multipart 구조 → 요청 계약 → 서버 제한 → DTO·파일 검증 → 저장 경계 → 오류 응답 → 클라이언트 전송 → 테스트
- 🔗 관련 주제: [HTTP Range·조건부 다운로드](../44_10_24_HTTP_Range_and_Conditional_Downloads/10_24_HTTP_Range_and_Conditional_Downloads.md), [Validation과 예외 처리](../05_09_01_Validation_and_Exception_Handling/09_01_Validation_and_Exception_Handling.md), [Spring Security](../11_09_07_Spring_Security_Fundamentals/09_07_Spring_Security_Fundamentals.md)
- 🧱 선수 지식: HTTP 헤더·본문, Java record·예외·try-with-resources, 생성자 주입, 인증과 인가, MockMvc의 역할

> 기준일: 2026-10-26. Java 21, Spring Boot 4.1.2 관리 조합의 Spring Framework 7.0.10·Spring Security 7.1.2를 기준으로 한다. 기존 Servlet MVC 프로젝트에 추가하는 교육용 파일이며 전체 실행 프로젝트가 아니다. 이번 예제는 최대 64KiB의 UTF-8 .txt 한 개만 받는다. 저장소 어댑터·DB·검사 작업자는 구현하지 않고 계약과 파일 쓰기 원리를 분리한다. 현재 PATH에서 Java·javac·Maven·Gradle을 찾지 못했고 빌드 프로젝트도 없어 Java 컴파일·JUnit·실제 HTTP 업로드는 실행하지 않았다. 실제 문서 검사와 미실행 테스트는 3.11에서 구분한다.

## 1. 들어가며

이전 다운로드 노트에서는 서버가 이미 검증한 파일의 어느 바이트를 누구에게 제공할지 다뤘다. 업로드에서는 반대로 사용자가 보낸 바이트가 서버 안으로 들어온다. 파일 이름이 `report.txt`이고 Content-Type이 `text/plain`이라고 해도, 그 정보는 사용자가 보낸 주장일 뿐 실제 내용 검증을 대신하지 못한다.

이번 핵심 질문은 **“받을 수 있는 요청인가, 허용한 내용인가, 지금 공개해도 되는가?”**다. 세 질문의 답이 서로 다르므로 Controller에서 파일 하나를 받았다고 곧바로 정적 파일 디렉터리에 넣지 않는다.

설명을 위해 작은 텍스트 문서 업로드로 범위를 제한한다. 64KiB·제목 100자·영문 파일명 정책은 이해하기 쉬운 예시 규칙이지 모든 서비스의 권장값이 아니다. 이미지·PDF·압축 파일의 전용 파서나 악성 코드 검사까지 구현한 예제라고 해석하지 않는다.

## 2. 핵심 개념 정리

```text
클라이언트: JSON metadata + 파일 file
  → 프록시·Servlet 컨테이너의 요청 제한
  → 인증·인가·CSRF 정책과 multipart 해석
  → @RequestPart 바인딩 + @Valid 메타데이터 검증
  → 파일 크기·이름·선언 타입·실제 UTF-8 내용 검증
  → 서버에서 정한 식별자로 비공개 저장 + 소유자 이력
  → QUARANTINED 응답
  → 별도 검사·업무 승인 후에만 READY로 전환
```

필터 배치에 따라 인증과 multipart 해석의 실제 선후 관계는 달라질 수 있다. 이 흐름도는 책임의 지도이며, 인증 전에 파일이 절대 임시 디스크에 쓰이지 않는다고 보장하는 그림은 아니다.

| 구분 | 확인할 질문 |
| --- | --- |
| 요청 형태 | 어떤 이름의 part에 어떤 Content-Type을 넣는가? |
| 자원 제한 | 파일 하나·요청 전체·part 수·동시 요청을 어디에서 제한하는가? |
| 입력 검증 | 표시 이름과 실제 내용이 업무 규칙을 만족하는가? |
| 저장 | 원본 이름을 경로로 쓰지 않으며, 실패한 찌꺼기를 어떻게 관리하는가? |
| 공개 | 업로드 접수와 다운로드 허용을 같은 상태로 취급하지 않는가? |

## 3. 본문 정리

### 3.1 multipart는 한 HTTP 본문을 여러 part로 나누는 형식이다

`multipart/form-data`는 한 요청 본문 안에 여러 데이터 조각을 넣는 형식이다. 각 조각을 **part**라고 부르며, **boundary**는 part 사이를 구분하는 문자열이다. 하나의 봉투 안에서 이름표가 붙은 칸을 나누는 것과 비슷하지만, 실제 구분은 정해진 헤더와 바이트 경계로 이루어진다.

다음은 구조를 읽기 위한 축약 예시다. 직접 소켓으로 전송하는 완전한 HTTP 메시지가 아니며, 실제 줄 구분·boundary 생성은 브라우저나 HTTP 클라이언트가 담당한다.

```http
POST /uploads HTTP/1.1
Content-Type: multipart/form-data; boundary=lesson-boundary

--lesson-boundary
Content-Disposition: form-data; name="metadata"
Content-Type: application/json

{"title":"학습 메모"}
--lesson-boundary
Content-Disposition: form-data; name="file"; filename="memo.txt"
Content-Type: text/plain; charset=UTF-8

오늘 배운 내용을 기록합니다.
--lesson-boundary--
```

바깥 Content-Type은 **요청 전체**가 multipart라고 말하고, 안쪽 Content-Type은 **각 part의 내용**을 설명한다. `name="file"`은 서버 매개변수와 연결할 필드 이름이고, `filename="memo.txt"`는 클라이언트가 보낸 원본 파일 이름이다. 둘은 같은 값일 필요가 없다. [RFC 7578: boundary와 part의 Content-Disposition](https://www.rfc-editor.org/rfc/rfc7578.html#section-4)

이 형식은 여러 파일 업로드에만 쓰는 것이 아니다. 파일 한 개와 설명 JSON을 함께 보낼 때도 유용하다. 또한 이전 다운로드의 `multipart/byteranges`나 S3의 대용량 multipart upload와는 별개의 개념이다.

### 3.2 RequestParam·RequestPart·RequestBody를 구분하기

`@RequestParam`은 일반 폼 값·요청 매개변수를 받는 데 쓰며 `MultipartFile`도 받을 수 있다. `@RequestPart`는 특정 part를 선택하고, DTO 같은 객체라면 그 part의 Content-Type에 맞는 메시지 변환기로 읽는다. `@RequestBody`는 요청 본문 전체를 읽으므로 이번처럼 파일과 JSON이 나뉜 계약을 JSON DTO 하나로 받는 용도로 쓰지 않는다.

| 보내는 데이터 | 이번 예제의 서버 선언 | 핵심 |
| --- | --- | --- |
| `metadata` JSON | `@Valid @RequestPart("metadata") UploadMetadata` | application/json으로 전송하고 DTO 검증을 적용한다. |
| `file` 바이트 | `@RequestPart("file") MultipartFile` | 파일 데이터와 메타정보를 파일 객체로 받는다. |
| 단순 제목 폼 값 | 다른 계약이라면 `@RequestParam("title") String` | JSON part 계약과 혼동하지 않는다. |

`@Valid`는 DTO 필드의 Bean Validation 제약을 실행한다. 여기서 Bean Validation은 애너테이션으로 표현한 객체 값의 제약을 검증하는 표준이다. 파일의 실제 내용·확장자·바이트 길이를 자동으로 검사하는 기능은 아니다. [Spring MVC multipart와 RequestPart 검증](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/multipart-forms.html)

⚠️ 주의: JSON처럼 생긴 문자열을 Content-Type 없이 part에 넣으면 DTO 변환기가 선택되지 않아 415가 날 수 있다. 바깥 요청이 multipart라는 사실과 안쪽 metadata가 JSON이라는 사실을 각각 알려야 한다.

### 3.3 예제 계약과 준비 조건을 명확히 하기

이번 계약은 `POST /uploads`에 metadata와 file을 보내는 것이다. 제목은 공백만으로 구성할 수 없고 최대 100자이며, 파일은 1~65,536바이트다. 이름은 영문·숫자로 시작하는 최대 64자의 본체와 `.txt` 확장자를 허용한다. 실제 내용은 정상 UTF-8이고, 공백뿐인 내용과 탭·줄바꿈 외의 ISO 제어 문자는 거절한다.

원본 파일명의 한글·공백까지 일반적으로 위험하다는 뜻은 아니다. 여기서는 경로·이중 확장자·운영체제별 파일명 처리를 설명하기 위해 좁은 허용 목록을 선택했다. 원본 이름은 저장 경로에 사용하지 않는다.

기존 프로젝트의 기본 패키지가 `com.example`이라면 아래 Java 파일들은 `src/main/java/com/example/upload/` 아래에 둔다. 테스트는 `src/test/java/com/example/upload/` 아래에 둔다. 애플리케이션 클래스와 Gradle Wrapper는 [첫 실행 노트](../01_08_25_Spring_Initializr_and_First_Run/08_25_Spring_Initializr_and_First_Run.md)의 구성을 전제로 한다.

다음은 기존 `build.gradle`의 dependencies에 합칠 **일부 코드**다. Boot 플러그인과 의존성 관리는 이미 4.1.2로 설정되어 있다고 가정한다. 중복된 starter를 다시 추가하지 않는다.

```groovy
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-webmvc' // Servlet MVC와 JSON 변환 기반이다.
    implementation 'org.springframework.boot:spring-boot-starter-validation' // @Valid와 객체 제약을 실행한다.
    implementation 'org.springframework.boot:spring-boot-starter-security' // 기존 인증·인가·CSRF 구성을 사용한다.
    testImplementation 'org.springframework.boot:spring-boot-starter-webmvc-test' // MVC·JUnit·Mockito 테스트 기반이다.
    testImplementation 'org.springframework.boot:spring-boot-starter-security-test' // 후속 필터 통합 테스트에 사용한다.
}
tasks.named('test') {
    useJUnitPlatform() // JUnit 테스트 엔진으로 테스트를 실행한다.
}
```

Boot가 관리하는 Framework·Security 버전과 starter 이름을 확인했다. 기존 Boot 3 프로젝트를 이 노트 때문에 무작정 4로 올리지 말고, 자신의 프로젝트 버전과 import·테스트 구성을 대조한다. [관리 의존성 목록](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)

실제 HTTP 실행에는 기존 SecurityFilterChain에서 `POST /uploads`의 인증·업로드 권한을 적용해야 한다. 이 노트는 인증 수단·사용자 DB·CSRF 토큰 발급을 다시 구현하지 않으며, 3.7의 `PrivateUploadStore` 구현 Bean도 별도로 필요하다. MockMvc 예제는 그 저장소를 대역으로 바꿔 웹 계약만 검사한다.

### 3.4 파일 하나와 요청 전체의 크기는 다른 제한이다

`spring.servlet.multipart.max-file-size`는 파일 하나의 한도이고, `max-request-size`는 multipart 요청 전체의 한도다. 요청에는 파일뿐 아니라 JSON·part 헤더·경계 문자열이 포함되므로 두 값을 같은 크기로 두면 한도에 딱 맞는 파일도 요청 전체 한도에서 거절될 수 있다.

아래는 `src/main/resources/application.yml`에 합칠 설정 조각이다. `64KB`는 여기서 65,536바이트이며 코드의 `64 * 1024`와 맞춘다. 80KB는 메타데이터와 부가 정보를 위한 예시 여유일 뿐 모든 요청의 성공을 보장하는 값이 아니다.

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 64KB # 개별 파일 제한: 이번 텍스트 문서 계약과 맞춘다.
      max-request-size: 80KB # 파일·JSON·각 part의 헤더와 경계까지 합한 제한이다.
      file-size-threshold: 0B # 메모리에서 디스크 임시 저장으로 넘어가는 문턱이다.
      location: ./var/multipart-tmp # 앱 실행 디렉터리 기준 임시 영역이며 영구 저장소가 아니다.
      resolve-lazily: false # 기본처럼 MVC의 multipart 해석을 늦추지 않는다.
server:
  tomcat:
    max-part-count: 2 # 이 예제는 metadata와 file 두 part만 사용한다. 다른 API와 함께 검토한다.
```

임시 디렉터리는 실행 전에 만들고 애플리케이션 계정에만 필요한 접근 권한을 부여한다. `file-size-threshold: 0B`는 업로드를 거절한다는 뜻도, 애플리케이션이 메모리를 전혀 쓰지 않는다는 뜻도 아니다. 위 값들은 애플리케이션 전체에 영향을 주며 `server.tomcat.*`은 내장 Tomcat을 사용할 때의 설정이다. [Boot multipart·Tomcat 속성](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)

프록시 제한이 50KB라면 애플리케이션의 64KB 설정까지 도착하지 못한다. 반대로 프록시가 큰 요청을 허용해도 Servlet 한도에서 거절될 수 있다. 파일 개수·part 헤더 크기·요청 속도·임시 디스크 총량도 별도 자원 제한이다.

⚠️ 주의: Controller 안의 `getSize()` 검사만으로 업로드 단계의 메모리·임시 디스크 사용을 막을 수 없다. 이미 컨테이너가 본문을 해석했을 수 있으므로 앞단 제한과 업무 검사를 함께 둔다. 세션 기반 클라이언트는 CSRF 토큰을 별도 part가 아니라 헤더에 보내야 이 예제의 part 2개 계약도 유지된다.

### 3.5 MultipartFile은 영구 파일이 아니라 요청에 속한 접근 창구다

`MultipartFile`은 multipart로 들어온 파일을 읽는 인터페이스다. 구현은 내용을 메모리나 임시 디스크에 보관할 수 있으며, 요청 종료 뒤 임시 저장은 정리된다. `getOriginalFilename()`은 클라이언트 이름, `getName()`은 `file` 같은 part 이름, `getSize()`는 바이트 크기를 나타낸다. [MultipartFile API](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/web/multipart/MultipartFile.html)

따라서 파일 객체를 그대로 `@Async` 작업에 넘긴 뒤 응답하면, 작업자가 읽을 때 임시 파일이 없어질 수 있다. 요청 안에서 필요한 데이터를 애플리케이션 소유의 비공개 저장소로 옮기고, 작업자에는 저장 식별자를 전달하는 방식으로 수명을 분리한다.

이번 작은 파일은 제한된 byte 배열로 한 번 읽어 검증한다. 큰 파일에서 무제한 `getBytes()`·`readAllBytes()`를 호출하는 방식으로 확장하지 않는다. `getInputStream()`을 열었다면 애플리케이션이 닫고, `transferTo`는 복사·이동 수단이지 내용 검사나 악성 파일 차단 기능이 아님을 구분한다.

### 3.6 제목과 파일의 실제 내용을 가까이서 검증하기

첫 파일은 `UploadMetadata.java`다. 제목만 받으며 소유자·저장 경로·공개 상태는 요청 DTO에 두지 않는다.

```java
package com.example.upload;

import jakarta.validation.constraints.NotBlank; // null·빈 문자열·공백뿐인 제목을 거절한다.
import jakarta.validation.constraints.Size; // 제목의 길이 상한을 표현한다.

public record UploadMetadata(
        @NotBlank @Size(max = 100) String title // @Valid가 적용될 때 이 제약을 검사한다.
) {}
```

여기서 문자열 길이는 Java 문자열의 길이 기준이므로 사람이 보는 글자 수와 항상 일치하지 않는다. 제목을 화면에 표시할 때 필요한 출력 이스케이프도 이 검증과 별개다.

다음 `TextUploadValidator.java`는 **작은 UTF-8 텍스트 문서 정책**만 구현한다. Content-Type 검사 후에도 실제 바이트를 엄격하게 디코딩하고, 검증한 그 바이트를 반환하여 저장 계층이 다른 입력을 다시 읽지 않게 한다.

```java
package com.example.upload;

import java.io.IOException; // 읽기 실패는 사용자 내용 오류와 구분한다.
import java.io.InputStream; // MultipartFile에서 바이트를 읽는다.
import java.nio.ByteBuffer; // 디코더에 검사할 바이트 배열을 전달한다.
import java.nio.charset.CharacterCodingException; // UTF-8로 해석하지 못한 경우를 잡는다.
import java.nio.charset.CodingErrorAction; // 잘못된 문자를 대체하지 않고 거절하도록 지정한다.
import java.nio.charset.StandardCharsets; // UTF-8 상수를 사용한다.
import java.util.regex.Pattern; // 원본 표시 이름의 허용 형식을 검사한다.
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Component // Controller에 주입할 검증기를 Bean으로 등록한다.
public class TextUploadValidator {
    static final int MAX_BYTES = 64 * 1024; // 바이트 상한이며 글자 수 상한이 아니다.
    private static final Pattern NAME =
            Pattern.compile("(?i)[a-z0-9][a-z0-9_-]{0,63}\\.txt"); // 경로·추가 점·공백을 허용하지 않는다.

    public byte[] validate(MultipartFile file) throws IOException {
        if (file.isEmpty()) { // part가 있지만 내용이 0바이트인 경우를 거절한다.
            throw reject(400, "빈 파일은 업로드할 수 없습니다.");
        }
        if (file.getSize() > MAX_BYTES) { // 이미 알려진 크기가 크면 읽기 전에 중단한다.
            throw reject(413, "파일은 64KiB 이하여야 합니다.");
        }
        String name = file.getOriginalFilename(); // 클라이언트 값이므로 신뢰하지 않는다.
        if (name == null || !NAME.matcher(name).matches()) { // 전체 이름이 허용 형식인지 검사한다.
            throw reject(400, "허용된 형식의 .txt 파일 이름이 필요합니다.");
        }

        MediaType type;
        try {
            String declared = file.getContentType(); // null 또는 잘못된 MIME 표기도 가능하다.
            type = MediaType.parseMediaType(declared == null ? "" : declared);
            if (!type.getType().equalsIgnoreCase("text")
                    || !type.getSubtype().equalsIgnoreCase("plain")
                    || (type.getCharset() != null
                        && !StandardCharsets.UTF_8.equals(type.getCharset()))) {
                throw reject(415, "text/plain과 UTF-8 파일만 허용합니다."); // 선언 형식 계약을 적용한다.
            }
        } catch (IllegalArgumentException ex) { // MIME·charset 파싱 실패를 안전한 메시지로 바꾼다.
            throw reject(415, "올바른 text/plain Content-Type이 필요합니다.");
        }

        byte[] bytes;
        try (InputStream input = file.getInputStream()) { // 정상·실패 모두 스트림을 닫는다.
            bytes = input.readNBytes(MAX_BYTES + 1); // 상한보다 한 바이트 더 읽어 초과 여부를 구분한다.
        }
        if (bytes.length > MAX_BYTES) { // 메타정보 외에 실제 읽은 길이도 검사한다.
            throw reject(413, "파일은 64KiB 이하여야 합니다.");
        }
        if (bytes.length == 0 || bytes.length != file.getSize()) { // 비어 있거나 길이가 모순되면 저장하지 않는다.
            throw reject(400, "파일 길이를 확인할 수 없습니다.");
        }

        String text;
        try {
            text = StandardCharsets.UTF_8.newDecoder() // 디코더는 호출마다 새로 만들어 공유하지 않는다.
                    .onMalformedInput(CodingErrorAction.REPORT) // 깨진 UTF-8을 대체 문자로 숨기지 않는다.
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes)).toString(); // 실제 전체 바이트를 해석한다.
        } catch (CharacterCodingException ex) {
            throw reject(400, "올바른 UTF-8 텍스트가 아닙니다.");
        }
        if (text.isBlank()) { // 내용이 공백뿐이면 업무상 빈 문서로 취급한다.
            throw reject(400, "문서 내용이 필요합니다.");
        }
        boolean forbiddenControl = text.codePoints().anyMatch(cp ->
                Character.isISOControl(cp) && cp != '\n' && cp != '\r' && cp != '\t');
        if (forbiddenControl) { // 줄바꿈·탭 외의 ISO 제어 문자를 예제 정책에서 거절한다.
            throw reject(400, "허용하지 않는 제어 문자가 포함되어 있습니다.");
        }
        return bytes; // 검사한 원본 바이트를 그대로 저장 계층에 넘긴다.
    }

    private static ResponseStatusException reject(int status, String reason) {
        return new ResponseStatusException(HttpStatusCode.valueOf(status), reason); // 상수 메시지만 외부에 제공한다.
    }
}
```

`readNBytes(MAX_BYTES + 1)`은 최대 그 수만큼 읽으며 스트림을 스스로 닫지 않는다. 여기서는 try-with-resources가 종료를 담당한다. 이 제한은 **검증기 안에서 읽는 양**을 제한할 뿐, 앞서 컨테이너가 받은 요청 전체를 되돌리거나 동시 요청의 총 메모리를 제한하지 않는다. [Java InputStream](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/io/InputStream.html#readNBytes(int))

UTF-8 디코더에 `REPORT`를 사용하면 잘못된 바이트를 조용히 대체하지 않고 검출한다. 디코더는 공유 가능한 무상태 도구로 가정하지 않고 호출마다 만든다. [Java CharsetDecoder](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/charset/CharsetDecoder.html)

⚠️ 주의: 정상 UTF-8이라는 사실은 악성 코드가 없다는 뜻이 아니다. HTML·스크립트 문자열도 UTF-8일 수 있다. 업로드 내용을 HTML로 렌더링하거나 실행하지 말고, 형식별 파서·업무 규칙·필요한 보안 검사를 추가해야 한다. PDF·이미지는 확장자나 몇 바이트의 시그니처만 확인하고 같은 검증기를 재사용하지 않는다. [OWASP 파일 업로드 보호 원칙](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

### 3.7 Controller는 검증한 바이트와 서버의 소유자 정보만 저장 계층에 전달한다

`PrivateUploadStore.java`는 이번 노트가 사용하는 **저장 계층 계약**이다. 구현 클래스가 아니므로 이것만 추가하면 애플리케이션이 완성되는 것은 아니다. 실제 어댑터는 비공개 바이트와 소유자·제목·상태 이력을 연결하고, 저장 완료가 확인된 경우에만 식별자를 돌려줘야 한다.

```java
package com.example.upload;

import java.io.IOException;
import java.util.UUID;

public interface PrivateUploadStore {
    UUID save(String ownerSubject, String title, byte[] validatedBytes) throws IOException;
    // 계약: 서버가 만든 ID로 비공개 저장하고 ownerSubject·title·길이·QUARANTINED 이력을 연결한다.
    // 반환 전 실패가 나면 성공으로 응답하지 않으며, 불확실한 저장 결과는 어댑터의 복구 절차로 다룬다.
}
```

다음 `UploadReceipt.java`는 외부 응답이다. 내부 디렉터리·원본 경로·스토리지 자격 증명은 노출하지 않는다.

```java
package com.example.upload;

import java.util.UUID;

public record UploadReceipt(
        UUID id, // 서버가 정한 업로드 식별자다. 이 값을 안다고 다운로드 권한이 생기지는 않는다.
        String state, // 접수 상태이며 공개·검사 완료를 의미하지 않는다.
        long bytes // 실제 검증한 파일 길이이며 요청 전체 길이는 아니다.
) {}
```

`UploadController.java`에서 JSON DTO 검증은 메서드 실행 전 수행되고, 파일 내용 검증은 메서드 안에서 명시적으로 실행된다.

```java
package com.example.upload;

import java.io.IOException;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class UploadController {
    private final TextUploadValidator validator; // 파일의 업무 규칙을 검사한다.
    private final PrivateUploadStore store; // 실제 저장·소유자 이력 구현은 어댑터에 맡긴다.

    public UploadController(TextUploadValidator validator, PrivateUploadStore store) {
        this.validator = validator; // 생성자 주입으로 의존 관계를 드러낸다.
        this.store = store;
    }

    @PostMapping(value = "/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadReceipt> upload(
            @Valid @RequestPart("metadata") UploadMetadata metadata, // JSON part를 객체로 읽고 검증한다.
            @RequestPart("file") MultipartFile file, // 필수 파일 part를 선택한다.
            Authentication authentication) throws IOException {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "인증이 필요합니다.");
        }
        String owner = authentication.getName(); // 요청 JSON의 userId 대신 서버 인증 결과를 사용한다.
        byte[] bytes = validator.validate(file); // 실패하면 아래 저장 코드는 실행되지 않는다.
        UUID id = store.save(owner, metadata.title(), bytes); // 검증했던 바이트와 소유자를 함께 넘긴다.
        UploadReceipt body = new UploadReceipt(id, "QUARANTINED", bytes.length);
        return ResponseEntity.status(HttpStatus.CREATED) // 비공개 접수 자원을 만들었다는 뜻이다.
                .cacheControl(CacheControl.noStore()) // 사용자별 접수 응답을 캐시하지 않도록 요청한다.
                .body(body); // 다운로드 URL이나 READY 상태는 아직 반환하지 않는다.
    }
}
```

`QUARANTINED`는 이 예제에서 정한 “비공개 격리 상태”다. 업로드를 받은 사실과 안전한 공개 승인은 다르므로 201을 곧바로 공개 성공으로 읽지 않는다. 아직 조회 API를 구현하지 않았으므로 존재하지 않는 Location·다운로드 URL을 꾸며 넣지 않았다.

인증 이름이 실제 서비스에서 안정적이고 유일한 사용자 키인지 확인해야 하며, 여러 인증 발급자가 있으면 발급자와 subject를 함께 식별해야 한다. Controller의 방어적 인증 확인만으로 업로드 권한·요청당 한도·사용자별 저장 할당량이 구현되지는 않는다. 이런 정책은 기존 보안·서비스 계층과 통합한다.

### 3.8 비공개 저장에서 원본 이름·덮어쓰기·실패 정리를 분리하기

원본 이름을 `root.resolve(file.getOriginalFilename())`에 직접 넣지 않는다. 경로 이동은 파일 이름에 `../` 같은 경로 조각을 넣어 의도한 저장 영역을 벗어나는 문제다. 이름을 검증하더라도 저장 이름은 별도로 생성하면 표시 정보와 저장 위치가 분리된다.

아래 `PrivateFileWriter.java`는 저장 어댑터 내부에서 사용할 수 있는 **파일 쓰기 도우미**다. `PrivateUploadStore`의 구현이 아니며 DB 이력·소유자·상태 전환은 수행하지 않는다. `trustedRoot`와 그 부모 디렉터리는 배포 담당자가 준비한 비공개 영역이고, 비신뢰 사용자가 교체·쓰기·심볼릭 링크 변경을 할 수 없다는 전제가 필요하다.

```java
package com.example.upload;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;

public final class PrivateFileWriter {
    private PrivateFileWriter() {} // 정적 도우미이므로 직접 인스턴스를 만들지 않는다.

    public static UUID write(Path trustedRoot, byte[] validatedBytes) throws IOException {
        UUID id = UUID.randomUUID(); // 사용자 이름과 관계없는 서버 식별자를 만든다.
        Path target = trustedRoot.resolve(id + ".txt"); // 고정 확장자·서버 ID만 경로에 사용한다.
        boolean created = false; // 이번 호출에서 실제로 새 파일을 만든 경우만 정리한다.
        try (OutputStream output = Files.newOutputStream(
                target, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            created = true; // open이 성공한 뒤 표시하므로 기존 파일 충돌을 오인하지 않는다.
            output.write(validatedBytes); // 검증한 작은 바이트 배열을 비공개 파일에 기록한다.
        } catch (IOException failure) { // 쓰기뿐 아니라 close 실패도 성공으로 처리하지 않는다.
            if (created) { // 새 파일 생성 후 실패했을 때만 부분 파일 정리를 시도한다.
                try {
                    Files.deleteIfExists(target); // 신뢰한 디렉터리 안의 이번 파일 하나만 대상이다.
                } catch (IOException cleanupFailure) {
                    failure.addSuppressed(cleanupFailure); // 원래 실패와 정리 실패를 함께 남긴다.
                }
            }
            throw failure; // 호출자가 201을 반환하지 않도록 원래 실패를 전파한다.
        }
        return id; // close까지 완료한 경우에만 저장 식별자를 반환한다.
    }
}
```

`CREATE_NEW`는 이미 파일이 있으면 실패하므로 기존 파일을 덮어쓰지 않는다. UUID 충돌 때 이 코드가 자동 재시도하는 것은 아니며, 생성하지 못한 기존 파일을 정리 대상으로 지우지도 않는다. [Java CREATE_NEW](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/StandardOpenOption.html#CREATE_NEW)

이 코드는 파일 내용 전체의 원자적 공개나 전원 장애 시 내구성을 보장하지 않는다. 쓰는 도중 파일이 존재할 수 있으므로 저장 디렉터리를 외부에 매핑하거나 검사 작업자가 모든 파일을 무조건 읽게 해서는 안 된다. 파일 생성만 끝났다고 DB 이력도 저장된 것은 아니며, `@Transactional`이 로컬 파일을 자동 rollback하지 않는다.

실제 어댑터에는 저장 의도·소유자·길이·상태 이력, 실패한 파일과 DB의 대조·재시도, 오래된 미완료 업로드 정리가 필요하다. 이전 [파일 공개와 복구](../41_10_15_Batch_File_Output_and_Safe_Publication/10_15_Batch_File_Output_and_Safe_Publication.md) 및 [객체 스토리지 정합성](../42_10_20_Batch_Object_Storage_and_Idempotent_Publication/10_20_Batch_Object_Storage_and_Idempotent_Publication.md)에서 다룬 별도 자원 간 실패 경계와 연결된다. 이번에는 이러한 어댑터가 이미 구현되었다고 가정하지 않는다.

⚠️ 주의: `src/main/resources/static`·`public`이나 프록시가 그대로 공개하는 디렉터리에 업로드를 저장하지 않는다. 비공개는 디렉터리 이름이 아니라 실제 접근 권한·서빙 설정·조회 권한으로 정해진다. 애플리케이션 밖에서 디렉터리를 바꿀 수 있다면 문자열 경로 검사만으로 파일 시스템 경쟁을 막을 수 없다.

### 3.9 실패를 400·401/403·413·415·500으로 구분하기

입력 문제와 서버 저장 장애를 모두 400으로 바꾸면 클라이언트가 무엇을 고쳐야 할지 알 수 없다. 다음은 이 예제의 응답 정책이다. 표의 상태는 이 정책을 적용하는 애플리케이션에서의 계약이며 프록시가 먼저 반환하는 오류 본문까지 같다고 보장하지 않는다.

| 상황 | 상태 | 확인할 위치 |
| --- | ---: | --- |
| metadata 누락·JSON 문법 오류·제목 제약 위반 | 400 | part 이름·JSON·DTO |
| 빈 파일·이름 규칙 위반·깨진 UTF-8 | 400 | 파일 정책 |
| 인증 없음 / 업로드 권한 또는 CSRF 실패 | 401 / 403 | 인증 진입점·보안 필터 |
| 파일 또는 전체 요청 크기 초과 | 413 | 프록시·컨테이너·검증기 |
| 바깥 multipart 또는 안쪽 JSON·파일 타입 불일치 | 415 | 각 Content-Type |
| 읽기·저장 I/O 장애 | 500 | 서버 로그·저장소·클라이언트 연결 상태 |

다음 `UploadErrorHandler.java`는 이 예제에 필요한 일부 실패를 ProblemDetail로 맞춘다. 기존 전역 예외 처리기가 있다면 핸들러를 중복 등록하지 말고 기존 정책에 합친다.

```java
package com.example.upload;

import java.io.IOException;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice // 전역 적용 예제다. 실제 프로젝트의 기존 Advice와 통합한다.
public class UploadErrorHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ProblemDetail> rejected(ResponseStatusException ex) {
        String detail = ex.getReason() == null ? "요청을 처리할 수 없습니다." : ex.getReason();
        return problem(ex.getStatusCode(), detail); // 이 예제에서 만든 상수 메시지를 반환한다.
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ProblemDetail> tooLarge(MaxUploadSizeExceededException ex) {
        return problem(HttpStatusCode.valueOf(413), "업로드 크기 제한을 초과했습니다.");
    }

    @ExceptionHandler({MethodArgumentNotValidException.class,
            MissingServletRequestPartException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ProblemDetail> malformed(Exception ex) {
        return problem(HttpStatusCode.valueOf(400), "필수 part와 JSON 입력을 확인하세요.");
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ProblemDetail> unsupported(HttpMediaTypeNotSupportedException ex) {
        return problem(HttpStatusCode.valueOf(415), "요청과 각 part의 Content-Type을 확인하세요.");
    }

    @ExceptionHandler(IOException.class)
    public ResponseEntity<ProblemDetail> ioFailure(IOException ex) {
        return problem(HttpStatusCode.valueOf(500), "파일 처리 중 서버 오류가 발생했습니다.");
        // 내부 경로·원본 파일명·본문을 응답에 노출하지 않는다. 운영 로그 정책은 별도로 연결한다.
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatusCode status, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail); // 오류 데이터 구조를 만든다.
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON) // 오류 본문의 형식을 명시한다.
                .body(body);
    }
}
```

크기 초과가 Spring의 `MaxUploadSizeExceededException`으로 전달되면 이를 처리할 수 있다. 하지만 프록시·컨테이너 단계에서 연결을 닫거나 별도 오류를 반환하면 이 Advice까지 도달하지 않을 수 있다. 또한 모든 `MultipartException`이 크기 초과는 아니므로 예외 이름이 비슷하다는 이유로 전부 413으로 바꾸지 않는다. [크기 초과 예외 API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/multipart/MaxUploadSizeExceededException.html)

Security 필터의 401·403은 보통 ControllerAdvice의 담당이 아니다. API용 인증 진입점·접근 거부 처리기에서 맞추고, 연결이 끊어진 경우에는 서버가 오류 응답을 작성해도 클라이언트가 받지 못할 수 있음을 구분한다.

### 3.10 브라우저에서는 boundary를 직접 만들지 않는다

아래는 기존 브라우저 화면에 추가할 **전송 함수**다. file은 파일 입력에서 얻은 `File`, title은 제목 문자열, csrf는 기존 서버가 발급한 `{headerName, token}` 객체다. 같은 출처의 세션 인증을 전제로 하며 로그인·토큰 발급·버튼 이벤트 연결은 포함하지 않는다.

```javascript
async function uploadText(file, title, csrf) {
  if (!file) throw new Error("파일을 선택하세요."); // 사용자 경험용 검사이며 서버 검증을 대신하지 않는다.
  const form = new FormData(); // 브라우저가 multipart 경계와 본문을 구성하게 한다.
  const metadata = new Blob([JSON.stringify({ title })], {
    type: "application/json", // 문자열 part가 아니라 JSON 변환 대상임을 알려 준다.
  });
  form.append("metadata", metadata); // 서버 @RequestPart("metadata") 이름과 일치시킨다.
  form.append("file", file); // 파일명·파일 타입은 클라이언트 값이므로 서버에서 다시 검사한다.
  const response = await fetch("/uploads", {
    method: "POST", // 비공개 업로드 접수 자원을 만든다.
    credentials: "same-origin", // 같은 출처의 기존 세션 쿠키를 보낸다.
    headers: {
      Accept: "application/json, application/problem+json", // 정상·오류 응답 형식을 요청한다.
      [csrf.headerName]: csrf.token, // 실제 구성에서 받은 CSRF 헤더 이름과 토큰을 사용한다.
    },
    body: form, // Content-Type 헤더는 직접 설정하지 않아 boundary가 함께 생성되도록 한다.
  });
  if (!response.ok) {
    throw new Error("업로드 실패: HTTP " + response.status); // 프록시 HTML 오류도 JSON으로 단정하지 않는다.
  }
  return response.json(); // 성공 시 id·state·bytes를 받는다. 다운로드 승인으로 간주하지 않는다.
}
```

FormData를 보내면서 `Content-Type: multipart/form-data`만 직접 넣으면 브라우저가 붙여야 할 boundary 정보가 빠질 수 있다. JSON part의 타입은 Blob에 지정하되, 요청 전체 Content-Type은 브라우저에 맡긴다. [MDN FormData 주의 사항](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects)

Spring Security는 JavaScript를 사용할 수 있는 multipart 요청에서 CSRF 토큰을 헤더로 보내는 방식을 설명한다. 요청 본문에서 토큰을 찾으려면 파일 해석과 필터 순서가 얽히기 때문이다. 업로드가 403이라고 CSRF를 일괄 끄지 않는다. [Spring Security multipart·CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html#csrf-considerations-multipart)

브라우저가 파일의 Content-Type을 `application/octet-stream`이나 빈 값으로 보낼 수도 있다. 이 예제의 엄격한 정책에서는 거절될 수 있으며, 실제 제품은 허용할 클라이언트와 형식 판정 정책을 함께 정해야 한다. 클라이언트에서 `text/plain`이라고 붙이는 것만으로 검증을 통과한 안전한 내용이 되는 것은 아니다.


### 3.11 MockMvc로 확인할 것과 실제 서버에서 확인할 것을 나누기

다음 `UploadControllerTest.java`는 앞의 Controller·검증기·Advice를 직접 조립하는 **독립 실행형 MockMvc 테스트 파일**이다. 애플리케이션 전체나 저장소 Bean을 띄우지 않고 `PrivateUploadStore`를 Mockito 대역으로 둔다. Validation 구현은 실제로 연결하므로 제목 오류도 검사한다.

```java
package com.example.upload;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class UploadControllerTest {
    private PrivateUploadStore store; // 외부 저장·DB는 이 테스트 범위에서 대역으로 둔다.
    private LocalValidatorFactoryBean beanValidator;
    private MockMvc mvc;
    private final Authentication user =
            new UsernamePasswordAuthenticationToken("user-1", "unused", List.of()); // 인증된 테스트 주체다.

    @BeforeEach
    void setUp() throws Exception {
        store = mock(PrivateUploadStore.class); // 실제 디스크나 DB에 저장하지 않는다.
        when(store.save(anyString(), anyString(), any(byte[].class)))
                .thenReturn(UUID.fromString("00000000-0000-0000-0000-000000000045"));
        beanValidator = new LocalValidatorFactoryBean(); // @Valid에 사용할 실제 검증기를 준비한다.
        beanValidator.afterPropertiesSet();
        mvc = standaloneSetup(new UploadController(new TextUploadValidator(), store))
                .setValidator(beanValidator) // DTO 제약이 실행되도록 연결한다.
                .setControllerAdvice(new UploadErrorHandler()) // 본문의 오류 계약도 포함한다.
                .build(); // SecurityFilterChain·실제 Servlet multipart 파서는 포함하지 않는다.
    }

    @AfterEach
    void closeValidator() {
        beanValidator.close(); // 테스트에서 직접 만든 검증 팩터리의 자원을 정리한다.
    }

    @Test
    void acceptsValidTextAndUsesAuthenticatedOwner() throws Exception {
        mvc.perform(multipart("/uploads").file(metadata("memo"))
                        .file(file("memo.txt", "text/plain", utf8("hello\n"))).principal(user))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.state").value("QUARANTINED"))
                .andExpect(jsonPath("$.bytes").value(6)); // 줄바꿈 1바이트까지 포함한다.
        verify(store).save(eq("user-1"), eq("memo"), aryEq(utf8("hello\n")));
        // 클라이언트 userId가 아니라 인증 주체와 검증했던 바이트를 전달했는지 확인한다.
    }

    @Test
    void rejectsBlankTitleBeforeStorage() throws Exception {
        mvc.perform(multipart("/uploads").file(metadata(" "))
                        .file(file("memo.txt", "text/plain", utf8("hello"))).principal(user))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(store); // DTO 오류가 나면 저장을 시작하지 않아야 한다.
    }

    @Test
    void rejectsMissingPartAndWrongMetadataType() throws Exception {
        mvc.perform(multipart("/uploads").file(metadata("memo")).principal(user))
                .andExpect(status().isBadRequest()); // file part 누락이다.
        MockMultipartFile wrong = new MockMultipartFile(
                "metadata", "", "text/plain", utf8("{\"title\":\"memo\"}"));
        mvc.perform(multipart("/uploads").file(wrong)
                        .file(file("memo.txt", "text/plain", utf8("hello"))).principal(user))
                .andExpect(status().isUnsupportedMediaType()); // 문자열처럼 보여도 JSON 타입이 아니다.
        verifyNoInteractions(store);
    }

    @Test
    void rejectsEmptyNameAndContentViolations() throws Exception {
        List<MockMultipartFile> invalid = List.of(
                file("memo.txt", "text/plain", new byte[0]), // 빈 파일이다.
                file("../memo.txt", "text/plain", utf8("hello")), // 경로 형태의 이름이다.
                file("memo.txt", "text/plain", new byte[]{(byte) 0xC3, 0x28}), // 깨진 UTF-8이다.
                file("memo.txt", "text/plain", utf8(" \n\t")), // 내용이 공백뿐이다.
                file("memo.txt", "text/plain", new byte[]{65, 0})); // NUL 제어 문자가 들어 있다.
        for (MockMultipartFile bad : invalid) {
            mvc.perform(multipart("/uploads").file(metadata("memo")).file(bad).principal(user))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(store); // 어떤 입력 위반도 저장 계층에 전달하지 않는다.
    }

    @Test
    void rejectsFileTypeAndBusinessSizeLimit() throws Exception {
        mvc.perform(multipart("/uploads").file(metadata("memo"))
                        .file(file("memo.txt", "image/png", utf8("hello"))).principal(user))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(multipart("/uploads").file(metadata("memo"))
                        .file(file("memo.txt", "text/plain",
                                new byte[TextUploadValidator.MAX_BYTES + 1])).principal(user))
                .andExpect(status().is(413)); // 검증기의 한도이며 컨테이너 한도 시험은 아니다.
        verifyNoInteractions(store);
    }

    @Test
    void boundsActualReadEvenWhenSizeMetadataDisagrees() {
        MockMultipartFile inconsistent = new MockMultipartFile(
                "file", "memo.txt", "text/plain", new byte[TextUploadValidator.MAX_BYTES + 1]) {
            @Override
            public long getSize() {
                return 1; // 검증기를 재사용할 때도 실제 읽은 길이를 검사하는지 확인하는 대역이다.
            }
        };
        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> new TextUploadValidator().validate(inconsistent));
        assertEquals(413, failure.getStatusCode().value()); // 메타 크기 1이더라도 초과 데이터를 거절한다.
    }

    @Test
    void hidesStorageErrorDetails() throws Exception {
        when(store.save(anyString(), anyString(), any(byte[].class)))
                .thenThrow(new IOException("internal-path-not-for-client")); // 저장 실패를 주입한다.
        mvc.perform(multipart("/uploads").file(metadata("memo"))
                        .file(file("memo.txt", "text/plain", utf8("hello"))).principal(user))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("파일 처리 중 서버 오류가 발생했습니다."));
    }

    @Test
    void rejectsMissingAuthentication() throws Exception {
        mvc.perform(multipart("/uploads").file(metadata("memo"))
                        .file(file("memo.txt", "text/plain", utf8("hello"))))
                .andExpect(status().isUnauthorized()); // Controller의 방어 로직만 검사한다.
        verifyNoInteractions(store);
    }

    @Test
    void writesOnlyServerNamedPrivateFile(@TempDir Path root) throws Exception {
        byte[] bytes = utf8("hello"); // 파일 쓰기 도우미에 검증 완료 바이트가 전달된 상황이다.
        UUID id = PrivateFileWriter.write(root, bytes); // 테스트 전용 임시 폴더 안에 쓴다.
        assertArrayEquals(bytes, Files.readAllBytes(root.resolve(id + ".txt")));
        try (var entries = Files.list(root)) { // 디렉터리 스트림도 닫는다.
            assertEquals(1L, entries.count()); // 기대한 서버 이름 파일 한 개만 생겼다.
        }
    }

    private static MockMultipartFile metadata(String title) {
        return new MockMultipartFile("metadata", "", MediaType.APPLICATION_JSON_VALUE,
                utf8("{\"title\":\"" + title + "\"}")); // 이 테스트의 고정 안전 문자열만 조합한다.
    }

    private static MockMultipartFile file(String name, String type, byte[] content) {
        return new MockMultipartFile("file", name, type, content); // 필드 이름과 원본 이름을 구분한다.
    }

    private static byte[] utf8(String text) {
        return text.getBytes(StandardCharsets.UTF_8); // 테스트 입력의 인코딩을 명시한다.
    }
}
```

위 파일들과 의존성이 준비된 **실제 Java 예제 프로젝트 루트**에서 다음을 실행한다. TIL 저장소에는 Gradle Wrapper가 없으므로 TIL 루트에서 실행하는 명령이 아니다.

```powershell
# 예상: 9개 테스트 메서드가 통과하고 invalid 입력에서는 저장 대역 호출이 발생하지 않는다.
.\gradlew.bat test --tests com.example.upload.UploadControllerTest
```

MockMvc의 `multipart(...)`는 실제 wire 형식의 본문을 파싱하지 않고 모의 multipart 요청을 구성한다. 따라서 위의 413 테스트는 파일 검증기 동작을 확인할 뿐 `spring.servlet.multipart.max-file-size`나 프록시 제한이 적용되었다는 증거가 아니다. [Spring MockMvc multipart 요청의 검증 범위](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/requests.html)

실제 애플리케이션과 저장 어댑터를 연결한 뒤에는 다음을 추가로 확인한다.

| 검사 | 기대하는 확인점 |
| --- | --- |
| 실제 HTTP로 65,536바이트와 65,537바이트 전송 | 개별 파일 경계, 실제 파서가 반환하는 상태·본문·연결 동작 |
| 작은 파일 + 큰 JSON 또는 추가 part 전송 | 전체 요청 한도·part 개수 제한이 파일 한도와 독립적으로 적용됨 |
| 깨진 boundary·누락된 metadata 타입 | 실제 파싱·변환 실패가 서버 설정에 맞게 처리됨 |
| 인증 없음·권한 없음·CSRF 없음/정상 | 실제 SecurityFilterChain·토큰·인증 진입점의 거부/허용 |
| 저장 디스크 부족·권한 오류·응답 유실 | 성공으로 오인하지 않고 미완료 파일·DB 이력을 복구할 수 있음 |
| 동시 요청·클라이언트 중도 취소 | 임시 디스크·메모리·연결 자원 한도와 정리 동작 |
| QUARANTINED 파일 조회 | ID를 알아도 공개 다운로드가 불가능하고 소유자·상태를 확인함 |

첫 번째 경계 테스트의 정상 파일은 공백이 아닌 유효한 UTF-8 데이터로 만들어야 다른 검증 규칙에 먼저 걸리지 않는다. 요청 전체가 80KB 이하여야 파일 경계만 분리해서 관찰할 수 있다.

실제 수행한 검사는 공식 문서/API 대조, 코드 흐름 검토, 저장소의 `python scripts/check_notes.py`·`git diff --check`와 문서 점검 도구의 회귀 테스트다. Java 테스트 코드는 작성했지만 실행하지 않았다. 소스의 컴파일 가능성, Bean 연결, 실제 업로드·디스크 오류·보안 필터·프록시 동작은 미실행 범위로 남는다.

## 4. 적용 관점에서 다시 보기

업로드를 설계할 때 먼저 받을 형식·파일 개수·크기·제목 규칙을 계약으로 정한다. 그다음 요청 전체 제한과 파일 자체 검증을 서로 다른 단계에 배치하고, 검증한 바이트와 인증 주체만 비공개 저장 계층으로 넘긴다.

오류가 나면 요청 전체 Content-Type과 boundary, 각 part의 이름·타입, DTO 제약, 파일 규칙, 저장 상태 순서로 좁혀 간다. 403이면 본문 검증보다 보안 필터를 확인하고, 413이면 어느 계층에서 거절했는지 먼저 확인한다.

마지막으로 접수 상태와 공개 상태를 분리한다. 파일 쓰기가 성공했더라도 소유자·DB 이력·내용 검사·복구 정책이 준비되지 않았다면 다운로드 경로에 연결하지 않는다. MockMvc·실제 HTTP·저장 장애 시험을 나누면 무엇을 검증했고 무엇이 남았는지 설명할 수 있다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

multipart 바인딩, 입력 규칙 검증, 비공개 저장, 공개 승인은 서로 다른 책임이다. 파일의 확장자·Content-Type·원본 이름을 신뢰하지 않고 실제 바이트와 서버가 관리하는 식별자·소유자 이력을 연결해야 한다.

### 5.2 이전·다음 학습과의 연결

[조건부 다운로드](../44_10_24_HTTP_Range_and_Conditional_Downloads/10_24_HTTP_Range_and_Conditional_Downloads.md)의 검증된 파일 제공 경로 앞에 사용자 입력의 수신·검증 경계를 추가했다. 다음에는 **파일 업로드 상태 관리·격리 검사와 만료 정리**를 학습해 이번 저장 계약을 DB 이력·검사 작업자·실패 복구와 연결한다.

### 5.3 더 파볼 만한 주제

대용량 파일을 서버를 거치지 않고 객체 스토리지로 직접 올릴 때에도 업로드 완료와 실제 검증을 어떻게 구분할 수 있을까? 이미지 재인코딩·압축 해제 한도·재개 업로드·중복 접수의 멱등성은 각각 별도 검증 모델이 필요한 확장 주제다.

### 5.4 참고 자료

- [RFC 7578 multipart/form-data](https://www.rfc-editor.org/rfc/rfc7578.html) — boundary·part 이름·파일 이름의 역할.
- [Spring MVC multipart](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/multipart-forms.html) — RequestParam·RequestPart·DTO 검증.
- [MultipartFile API](https://docs.spring.io/spring-framework/docs/7.0.x/javadoc-api/org/springframework/web/multipart/MultipartFile.html) — 요청 임시 저장 수명과 읽기 API. 조회된 7.0.x API 페이지는 7.0.9 표기였으며 본문 기준은 Boot 관리 조합 7.0.10이다.
- [Boot 관리 의존성](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html), [설정 속성](https://docs.spring.io/spring-boot/appendix/application-properties/index.html) — 기준 버전·starter·파일/요청/part 제한.
- [Java InputStream](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/io/InputStream.html), [CharsetDecoder](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/charset/CharsetDecoder.html), [CREATE_NEW](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/StandardOpenOption.html#CREATE_NEW) — 제한 읽기·잘못된 UTF-8 거절·새 파일 생성.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — 허용 형식·파일 이름·비공개 위치·크기와 권한의 다층 방어.
- [MDN FormData](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects), [Spring Security CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html#csrf-considerations-multipart) — boundary 생성과 헤더 기반 CSRF 전달.
- [MockMvc 요청](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/requests.html) — 실제 multipart 파싱을 수행하지 않는 모의 요청의 한계.

## 6. 요약 정리

- multipart는 요청 전체와 각 part의 Content-Type을 구분하며 boundary로 내용을 나눈다.
- JSON metadata는 `@RequestPart`·`@Valid`로 받고 파일 내용은 별도 검증한다.
- 파일 하나·요청 전체·part 수·임시 저장 총량은 서로 다른 제한이다.
- MultipartFile의 요청 수명을 넘어 사용하려면 먼저 애플리케이션 소유 저장소로 옮겨야 한다.
- 파일 이름·선언 타입만 확인하지 말고 업무 형식에 맞는 실제 내용 검증을 수행한다.
- 작은 파일의 제한 읽기는 전체 동시성·디스크 한도를 대신하지 않는다.
- 서버 생성 이름·비공개 경로·소유자 이력으로 저장하고 쓰기 실패·DB 실패를 구분한다.
- QUARANTINED 접수와 READY 공개는 별개이며 201은 안전한 공개 승인이라는 뜻이 아니다.
- MockMvc 테스트와 실제 HTTP·컨테이너·보안·저장 장애 테스트를 나누어 검증한다.

🧠 기억할 것: **파일을 받았다는 사실보다, 어떤 바이트를 어떤 소유자의 어떤 상태로 보관하는지가 중요하다.**

## 7. 미니 퀴즈 또는 체크리스트

1. 요청 전체가 multipart인데 metadata part에도 application/json을 지정해야 하는 이유는?
2. 파일은 64KiB 이하인데 요청 전체 제한으로 거절될 수 있는 이유는?
3. `@Valid`를 파일 매개변수에 붙이면 UTF-8·크기·확장자가 자동 검증되는가?
4. 서버 생성 ID와 CREATE_NEW를 사용해도 파일·DB 저장이 하나의 트랜잭션이 되지 않는 이유는?
5. MockMvc multipart 테스트의 413 통과만으로 실제 서버의 업로드 크기 제한을 검증했다고 말할 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 바깥 타입은 본문을 나누는 형식이고, 안쪽 타입은 해당 part를 DTO로 바꿀 메시지 변환기를 선택하는 정보다.
2. 요청 전체에는 파일 외에도 JSON·헤더·boundary가 들어간다. 프록시·컨테이너의 각 제한도 독립적으로 적용된다.
3. 아니다. 정의된 Bean Validation 제약을 적용하는 기능이며 파일의 실제 바이트 정책은 별도 검증 로직이 필요하다.
4. CREATE_NEW는 기존 파일 덮어쓰기를 막는 생성 옵션일 뿐 DB commit·실패 복구·파일 내용 전체의 원자적 공개를 결합하지 않는다.
5. 말할 수 없다. 모의 multipart 요청에는 실제 본문 파싱이 없으므로 검증기 동작과 컨테이너 설정 검증을 분리해야 한다.

</details>
