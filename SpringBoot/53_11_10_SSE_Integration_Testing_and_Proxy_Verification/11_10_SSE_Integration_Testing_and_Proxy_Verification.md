# Spring Boot SSE 통합 테스트·권한 철회와 프록시 검증

- 🎯 글의 목표: SSE 연결을 끊고 다시 열어 재생 위치를 검증하고, 권한 철회·응답 지연·연결 정리를 어느 계층에서 확인해야 하는지 설명한다.
- 🧩 핵심 키워드: SSE 프레임, 실제 HTTP 연결, Last-Event-ID, 권한 철회, 연결 정리, 프록시 버퍼링
- ⭐ 중요도: 높음. 연결 성공이나 서버의 전송 로그만으로 이벤트가 제때, 올바른 사용자에게 도착했다고 판단할 수 없다.
- 📝 한눈에 보는 내용: 시험 계층 선택 → 단절 주입과 재생 검증 → 전송 직전 권한 철회 → 원본과 중계 경로 비교
- 🔗 관련 주제: [SSE 연결 다중화·자원별 권한과 공유 커서](../52_11_09_SSE_Multiplexing_and_Scoped_Cursors/11_09_SSE_Multiplexing_and_Scoped_Cursors.md), [SSE 이벤트 이력·재생과 재동기화](../51_11_08_SSE_Event_Replay_and_Resynchronization/11_08_SSE_Event_Replay_and_Resynchronization.md)
- 🧱 선수 지식: HTTP 헤더와 본문, SSE 이벤트 ID, [Spring Boot 테스트의 범위](../10_09_06_Testing_Strategy/09_06_Testing_Strategy.md)

> 2026-11-10 기준. Node.js 24.18.0에서 실제 로컬 HTTP를 사용한 교육용 시험 6개를 실행했다. Java 21·Spring Boot 4.1.2(Spring Framework 7.0.10) 기준의 Spring 시험 코드는 적용 예시다. Spring 서버·PostgreSQL·실제 브라우저·Nginx에서 실행한 결과는 아니다.

## 1. 들어가며

업로드 두 건을 관찰하는 화면에 서버가 첫 상태를 전송했다. 개발 환경의 테스트는 통과했는데 실제 화면에서는 연결이 끝날 때 상태가 한꺼번에 도착한다. 또 접속을 끊었다 다시 열자 첫 번째 업로드는 보이지만 두 번째 업로드의 이력이 빠졌다.

이전 노트에서는 **SSE(Server-Sent Events)**, 즉 서버가 열린 HTTP 응답을 통해 브라우저에 이벤트를 보내는 방식에서 여러 자원의 위치를 함께 관리했다. 이번에는 그 설계를 바꾸지 않고 “헤더가 보였다”, “이벤트를 받았다”, “화면에 반영했다”, “서버가 연결을 정리했다”를 각각 다른 증거로 확인한다.

## 2. 핵심 개념 정리

```text
상태 확정 → 앱이 SSE 프레임 작성 → 중계 서버가 전달 → 클라이언트가 파싱·반영
  단절: 마지막 프레임 확인 → 재연결 헤더 확인 → 누락 없이 재생됐는지 확인
  철회: 이미 열린 응답의 추가 데이터 차단 → 작업 정리 → 새 요청도 거절
```

예를 들어 서버에서 연결을 끊었다면 “재연결됐다”는 서버 로그에 그치지 않고, 실제 두 번째 요청의 헤더와 클라이언트가 받은 이벤트를 함께 확인한다.

## 3. 본문 정리

### 3.1 시험 도구는 관찰하려는 계층에 맞춘다

**통합 테스트**는 여러 부품을 실제로 연결해 경계에서 약속한 동작이 맞는지 확인하는 시험이다. 화면의 커서 계산은 네트워크 없이 검증할 수 있지만, 끊긴 연결을 다시 열 때 어떤 헤더를 보내는지는 실제 이벤트 스트림을 읽는 클라이언트로 확인해야 한다.

| 시험 계층 | 확인하는 것 | 이 결과만으로는 알 수 없는 것 |
| --- | --- | --- |
| 순수 로직 시험 | 받은 위치와 본문이 일치하는지, 중복·건너뛰기를 걸러내는지 | 실제 HTTP 전송·재접속 |
| MockMvc 또는 유한 스트림 시험 | URL·상태 코드·인가 설정·완결되는 응답 | 끝나지 않는 스트림을 실제 클라이언트가 취소하는 과정 |
| 임시 포트의 실제 Spring 서버 | 서블릿 비동기 응답, 이벤트 수신과 취소, 서버 정리 | 실제 브라우저 쿠키와 배포 프록시의 전달 |
| 브라우저와 배포 경로 | 세션·자동 재연결·프록시 버퍼링·시간 제한·화면 반영 | DB 상태·이력의 원자성. 이는 DB 시험도 필요하다. |

MockMvc는 실제 포트를 열지 않고 Spring MVC 요청 처리를 호출하는 테스트 도구다. Spring 공식 문서는 MockMvc에 붙인 `WebTestClient`로 유한한 스트림은 시험할 수 있지만, 클라이언트가 서버의 무한 스트림을 취소해야 하는 시험은 실행 중인 서버에 연결하도록 안내한다. [Spring Framework: 스트리밍 응답 테스트](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/vs-streaming-response.html)

### 3.2 마지막 이벤트 ID가 어디에서 만들어졌는지 확인한다

**프레임**은 클라이언트에 전달하는 이벤트 한 덩어리다. SSE 텍스트에서 `event:`는 종류, `id:`는 재접속 위치, `data:`는 내용이며 빈 줄이 한 프레임을 끝낸다. 지난 노트의 **벡터 커서**는 업로드마다 마지막으로 보낸 위치를 하나의 ID 문자열로 묶은 것이다.

| 시점 | 서버가 준 것 또는 받은 요청 | 기대 증거 |
| --- | --- | --- |
| 첫 연결 | URL의 `after`에 `[8, 3]` | 서버가 초기 위치로 읽고 A:9를 보낸다. |
| A:9 수신 | 프레임 ID는 `[9, 3]` | 클라이언트의 콜백이 A:9를 받는다. |
| B:4 도중 단절 | B:4의 ID와 본문 줄까지는 도착했으나 마지막 빈 줄이 없다. | 불완전한 B는 이벤트로 전달되지 않는다. |
| 같은 객체 재연결 | URL에는 `[8, 3]`이 남고, 헤더에 `[9, 3]`이 온다. | 헤더가 우선되어 A를 반복하지 않고 B:4를 한 번 받는다. |

이 시험은 HTTP 응답을 **정상적으로 끝내되 SSE 본문만 불완전하게** 만든다. 강제 소켓 종료나 프록시 장애는 별도 시나리오다. 네트워크에서 읽는 바이트 덩어리의 경계도 SSE 프레임 경계와 같지 않으므로, 한 번에 받은 바이트 수만으로 이벤트 수를 세지 않는다. [로컬 실습 코드](./check_sse_transport.mjs)의 `partial` 분기는 마지막 줄바꿈 하나만 제거해 이 차이를 만든다. [WHATWG 이벤트 스트림 형식과 Last-Event-ID](https://html.spec.whatwg.org/dev/server-sent-events.html)

⚠️ 주의: 테스트 클라이언트가 직접 `Last-Event-ID`를 넣으면 서버가 헤더를 처리하는지는 확인할 수 있지만, 같은 `EventSource` 객체가 자동으로 그 값을 만드는지는 확인하지 못한다. 또한 브라우저가 기억한 ID는 화면이 성공적으로 적용했다는 확인 응답이 아니다. 실제 화면 시험에서는 마지막 적용 모델도 비교한다.

### 3.3 연결을 연 뒤에 권한을 철회한다

**권한 철회**는 이미 허용한 자원을 이후부터 볼 수 없도록 바꾸는 일이다. 접속할 때만 검사하면, 권한을 잃은 사람도 기존 연결에서 새 상태를 받을 수 있다. 최초 요청을 404로 거절하는 것과 이미 열린 응답에서 추가 전송을 막는 것은 서로 다른 시험이다.

재현할 때는 임의로 몇 초를 기다리지 않고 **전송을 준비했다는 신호**와 **전송을 다시 진행해도 된다는 신호**를 나눈다. Java의 `CountDownLatch`는 다른 실행 흐름이 특정 지점에 도달할 때까지 기다리는 신호 장치다. Node 실습에서는 `Promise.withResolvers()`로 비슷하게 순서를 조절한다.

```text
연결 열기 → A 전송 → B를 보내기 전 대기
                         ↓ 테스트가 B 접근 권한 철회 후 진행 신호
                    현재 권한 재확인 → B를 쓰지 않고 연결 종료
                    → 구독 정리 확인 → 같은 커서의 새 요청도 거절
```

열린 응답에서 이미 보낸 200을 404로 바꾸는 것이 합격 기준은 아니다. **B의 본문과 B를 포함한 새 커서가 둘 다 전송되지 않았는지** 확인한다. 새 HTTP 요청에는 이전 노트의 정책대로 404를 기대한다. 이미 클라이언트에 도착한 정보는 되돌릴 수 없으므로, 운영에서는 철회 뒤 다음 검사까지 허용할 지연도 정한다.

### 3.4 취소를 보냈다는 사실과 서버 정리를 구분한다

브라우저의 `EventSource.close()`는 현재 연결과 자동 재연결을 끝낸다. 그러나 클라이언트의 요청 취소가 곧바로 서버 애플리케이션의 구독 제거를 의미하지는 않는다. Spring MVC 문서에 따르면 서블릿 API에는 원격 클라이언트가 사라졌음을 알려 주는 직접 통지가 없으므로, 연결이 끊겼을 때 쓰기 오류를 발견할 수 있도록 **하트비트**를 주기적으로 보낼 수 있다. 하트비트는 연결 상태를 확인하는 신호이며 SSE 주석이면 이벤트 ID를 진행시키지 않는다. [Spring MVC 비동기 요청: Disconnects](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html#disconnects)

아래는 이전 watch API를 구현한 프로젝트의 `src/test/java/com/example/upload/UploadWatchHttpTest.java`에 넣는 **테스트 클래스 일부**다. Boot 4.1.2의 MVC 테스트 의존성 외에 실제 서버에 접속하는 `WebTestClient`용 `spring-boot-starter-webclient`와 스트림 검증용 `reactor-test`를 테스트 범위에 둔다. 같은 패키지의 `UploadStatus` DTO는 [50번 노트](../50_11_03_Async_Status_Polling_and_SSE/11_03_Async_Status_Polling_and_SSE.md)의 응답 형식을 사용한다. [Spring Boot 실제 서버 테스트](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html), [WebTestClient 스트리밍 검사](https://docs.spring.io/spring-framework/reference/testing/webtestclient.html)

호출하는 테스트는 커밋된 업로드·watch와 로그인 세션을 먼저 준비한다. SSE 데이터는 JSON을 `UploadStatus`로 변환할 수 있는 클라이언트 코덱을 전제로 한다. `cleaned`에는 서버가 이 구독의 타이머·작업·등록 정보를 모두 제거한 **뒤에만** 테스트 어댑터가 신호를 보낸다. 로그인·DB 준비와 정리 관찰 어댑터는 아래에 포함되지 않는다. [Spring의 SSE 메시지 리더](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/codec/ServerSentEventHttpMessageReader.html)

```java
package com.example.upload;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.test.StepVerifier;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class UploadWatchHttpTest {
    @LocalServerPort int port; // 모의 MVC가 아니라 실행 중인 테스트 서버 포트다.

    void verifyFirstFrameAndCleanup(UUID watchId, String startCursor, String testSessionId,
                                    UUID firstUpload, UploadStatus.State firstState,
                                    String firstRevision, String firstCursor,
                                    CountDownLatch cleaned) throws InterruptedException {
        var client = WebTestClient.bindToServer()
                .baseUrl("http://127.0.0.1:" + port) // 테스트 인스턴스에만 접속한다.
                .responseTimeout(Duration.ofSeconds(5)) // 헤더 대기를 무한히 하지 않는다.
                .build();

        var response = client.get()
                .uri(builder -> builder.path("/upload-watches/{id}/events")
                        .queryParam("after", startCursor).build(watchId)) // 초기 위치에서 재생을 시작한다.
                .cookie("JSESSIONID", testSessionId) // 예제의 테스트 세션 쿠키 이름에 맞춘다.
                .accept(MediaType.TEXT_EVENT_STREAM) // SSE를 요청하고 응답 형식도 검사한다.
                .exchange()
                .expectStatus().isOk()
                .expectHeader().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM)
                .returnResult(new ParameterizedTypeReference<ServerSentEvent<UploadStatus>>() {});

        var events = response.getResponseBody().filter(event ->
                event.comment() == null || event.id() != null || event.event() != null || event.data() != null);
        // 순수 주석 하트비트만 제외한다. 이름·ID·데이터가 있는 잘못된 프레임은 검증에 남긴다.
        StepVerifier.create(events)
                .assertNext(event -> { // 상태 코드만이 아니라 첫 번째 상태 이벤트를 확인한다.
                    assertEquals("transition", event.event());
                    assertEquals(firstCursor, event.id());
                    var snapshot = event.data();
                    assertNotNull(snapshot);
                    assertEquals(firstUpload, snapshot.id());
                    assertEquals(firstState, snapshot.state());
                    assertEquals(firstRevision, snapshot.revision());
                })
                .thenCancel() // 응답 전체가 끝나기를 기다리지 않고 실제 구독을 취소한다.
                .verify(Duration.ofSeconds(5)); // 첫 이벤트를 받지 못하면 정해진 시간에 실패한다.

        assertTrue(cleaned.await(5, TimeUnit.SECONDS), "서버에서 구독·작업을 정리해야 한다");
    }
}
```

`StepVerifier`는 계속 들어오는 데이터의 순서와 종료를 확인하는 도구다. 이 예제는 첫 상태 이벤트를 확인한 뒤 취소하고, 취소가 서버의 정리로 이어졌는지는 별도 신호로 검사한다. 5초는 각 대기의 예시 상한이다. 테스트용 하트비트는 그 안에 정리를 확인할 수 있게 구성하되, 서블릿 timeout이 먼저 와서 우연히 통과하지 않도록 종료 사유도 비교한다. [Reactor: StepVerifier 테스트](https://projectreactor.io/docs/core/release/reference/testing.html)

⚠️ 주의: 실제 포트로 호출하면 테스트 스레드와 서버 요청의 트랜잭션이 다르다. 테스트 메서드의 `@Transactional`만으로 서버에서 일어난 변경이 자동 rollback되지 않으며, 커밋하지 않은 테스트 데이터가 서버에 보이지 않을 수도 있다. 격리된 테스트 DB에서 데이터를 먼저 확정하고, 실패한 경우도 구독과 데이터를 정리한다. [Spring Boot 실제 서버와 트랜잭션 경계](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)

### 3.5 프록시가 이벤트를 모아 보내는지 비교한다

**역방향 프록시**는 클라이언트 앞에서 요청을 받아 뒤의 애플리케이션 서버(원본)로 전달하는 중계 서버다. **응답 버퍼링**은 원본에서 받은 바이트를 바로 전달하지 않고 중간에 모아 두는 동작이다. 버퍼링이 있더라도 최종 본문은 정상일 수 있으므로 응답이 끝난 뒤 내용만 비교해서는 SSE 지연을 찾을 수 없다.

로컬 실습에서는 원본이 첫 프레임을 쓴 뒤 종료 신호를 기다리게 한다. 즉시 전달하는 중계에서는 **원본이 아직 열린 동안** 첫 이벤트를 받는다. 원본이 끝날 때까지 모두 보류하는 중계에서는 첫 바이트를 읽고도 응답을 보내지 않으며, 원본 종료 신호 뒤에야 이벤트가 도착한다. 이는 Nginx 내부를 재현한 것이 아니라 지연을 관찰하는 기준을 보여 주는 비교다.

다음은 Nginx `server` 블록에 넣는 **실습용 location 일부**다. 별도 테스트 인스턴스에서 같은 호스트의 Spring 서버가 8080에 떠 있다고 가정한다.

```nginx
location ^~ /upload-watches/ {
    proxy_pass http://127.0.0.1:8080; # 요청 경로를 유지해 Spring 테스트 서버에 연결한다.
    proxy_http_version 1.1;           # 이 실습의 원본 쪽 HTTP 버전을 명시한다.
    proxy_set_header Connection "";   # 원본 요청에 기본 Connection 헤더를 전달하지 않는다.
    proxy_buffering off;             # 응답을 모아 두지 않고 수신한 데이터를 전달한다.
    proxy_cache off;                 # 사용자별 스트림을 프록시 캐시에 저장하지 않는다.
    proxy_read_timeout 45s;          # 원본에서 읽는 두 작업 사이의 제한이며 전체 연결 수명이 아니다.
}
```

Nginx에서 `proxy_buffering`은 **응답** 버퍼링 설정이다. `proxy_request_buffering`은 요청 본문을 읽는 동작이라 SSE 응답 지연의 대체 설정이 아니다. 원본의 `X-Accel-Buffering`도 영향을 줄 수 있으므로 설정이 충돌하지 않는지 확인한다. 45초는 예시다. 하트비트 간격은 배포 경로에서 확인한 유휴 제한보다 여유 있게 짧게 두고, 서블릿 비동기 timeout과 로드밸런서의 연결 제한도 따로 확인한다. [Nginx proxy 모듈](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering)

아래는 **수동 점검 명령 예시**다. 실행 전에 테스트 환경에서 로그인·watch 생성을 마치고 `$sseUrl`에 유효한 `after`를 포함한 주소를, `$sseCookieFile`에 이 테스트 세션의 curl 쿠키 파일 경로를 준비한다. 쿠키 파일은 저장소에 넣지 않는다.

```powershell
# 같은 조건에서 원본 주소와 프록시 주소를 번갈아 검사한다.
curl.exe --include --no-buffer --max-time 20 --cookie "$sseCookieFile" --header "Accept: text/event-stream" "$sseUrl"
```

원본 응답을 끝내기 전에 완성된 프레임이 한 건씩 보이는지 확인한다. 20초가 되어 curl이 종료되면 관찰 시간 제한에 도달한 것이므로 그 종료 코드만으로 서버 오류라고 판단하지 않는다. `--no-buffer`는 curl의 **출력** 버퍼만 끄며 프록시 설정을 바꾸지 않는다. 첫 응답 헤더가 빠른 것과 첫 이벤트 본문이 빠른 것도 다르다. [curl --no-buffer](https://curl.se/docs/manpage.html#-N)

### 3.6 실행한 로컬 시험과 배포 시험의 경계를 남긴다

[check_sse_transport.mjs](./check_sse_transport.mjs)는 별도 패키지 없이 실행하는 **완성된 로컬 실습**이다. 테스트마다 `127.0.0.1`의 임시 포트에 작은 서버를 열고, 실제 `EventSource` 또는 `fetch`로 연결한다. 구독·서버·대기 신호는 시험이 실패한 경우에도 정리한다. 네트워크 접근이 제한된 환경에서는 이 PC 내부 연결도 허용돼야 한다.

```powershell
# 저장소 루트에서 실행한다. Node.js 24의 실험적 EventSource 기능을 활성화한다.
node --experimental-eventsource --test SpringBoot/53_11_10_SSE_Integration_Testing_and_Proxy_Verification/check_sse_transport.mjs
```

Node.js 24.18.0에서 **6개 시험 통과**를 확인했다. 실제 HTTP 재연결 헤더와 초기 쿼리 우선순위, 마지막 빈 줄 없는 이벤트, 전송 직전 권한 철회 대역과 재접속 거절, 클라이언트 취소 후 활성 연결 정리, 즉시·보류 중계의 도착 순서를 관찰했다. Node의 `EventSource` 실험적 기능 경고는 이 환경에서 예상되는 출력이다. [Node.js 24.18.0 EventSource](https://nodejs.org/download/release/v24.18.0/docs/api/globals.html#class-eventsource)

이 실습에는 Spring Security 세션·PostgreSQL 이력·Nginx·실제 브라우저가 없다. 배포 전에는 타인 watch 접근과 세션 만료, 다른 인스턴스에서의 재생, 자원 하나만 보존 범위를 벗어난 reset, 느린 소비자의 종료와 구독·작업 정리를 별도로 확인한다. 이 항목은 실행 결과가 아니라 다음 환경에서 검증할 목록이다.

## 4. 적용 관점에서 다시 보기

재생 오류는 첫 연결 URL, 재연결 헤더, 실제로 받은 프레임, 화면의 마지막 적용 위치를 비교한다. 권한 오류는 열린 연결에서 새 데이터가 차단됐는지와 새 요청이 거절됐는지를 나눈다. 어느 경우든 열린 연결 수만 줄었는지 보지 말고 작업·타이머도 정리됐는지 확인한다.

실시간성이 문제라면 원본에 직접 접속한 결과와 프록시를 지난 결과를 비교한다. 같은 이벤트를 기준으로 원본이 쓴 시점과 클라이언트가 완성 프레임을 받은 시점을 구분한다. 완료된 본문만 같다면 전달 지연은 아직 검증하지 않은 것이다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

SSE의 정상 동작은 연결이 열린 것 하나로 판정할 수 없다. 재생·권한·도착 순서·서버 정리마다 어떤 증거가 있어야 합격인지 정하면, 테스트가 놓친 계층을 구별할 수 있다.

### 5.2 이전·다음 학습과의 연결

[SSE 연결 다중화](../52_11_09_SSE_Multiplexing_and_Scoped_Cursors/11_09_SSE_Multiplexing_and_Scoped_Cursors.md)에서 설계한 공유 커서를 실제 로컬 HTTP 시험에 연결했다. 다음에는 **SSE 운영 관측성·메트릭과 장애 진단**을 다뤄, 재연결 증가나 첫 이벤트 지연을 배포 환경에서 어떻게 추적할지 살펴본다.

### 5.3 더 파볼 만한 주제

정상적인 응답 종료 외에도 소켓 강제 종료, 여러 서버 중 하나의 재시작, 중계 서버의 무응답을 각각 주입할 수 있다. 테스트용 짧은 지연 설정이 배포 환경의 유휴 제한이나 하트비트 설정을 대신하지 않는다는 점도 확인한다.

### 5.4 참고 자료

- [WHATWG Server-sent events](https://html.spec.whatwg.org/dev/server-sent-events.html) — 이벤트 이름, 마지막 빈 줄, `Last-Event-ID`와 연결 생명주기.
- [Spring 스트리밍 응답 테스트](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/vs-streaming-response.html), [WebTestClient](https://docs.spring.io/spring-framework/reference/testing/webtestclient.html) — 실제 서버가 필요한 취소 시험과 스트림 검사.
- [Spring Boot 실제 서버 테스트](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html), [Spring MVC 연결 단절](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html#disconnects) — 임시 포트, 트랜잭션 경계와 하트비트.
- [Nginx proxy 모듈](https://nginx.org/en/docs/http/ngx_http_proxy_module.html), [curl --no-buffer](https://curl.se/docs/manpage.html#-N) — 프록시와 진단 도구의 버퍼링 설정.
- [Node.js 24.18.0 EventSource](https://nodejs.org/download/release/v24.18.0/docs/api/globals.html#class-eventsource) — 로컬 실습의 실행 조건과 기능 상태.

## 6. 요약 정리

- 순수 로직, 실제 HTTP, 브라우저·프록시 시험의 범위는 다르다.
- 자동 재연결 시험은 클라이언트가 실제로 만든 헤더와 이후 수신 이벤트를 함께 본다.
- 마지막 빈 줄 없이 끝난 프레임을 완료된 이벤트로 취급하지 않는다.
- 이미 열린 연결에서의 권한 철회는 다음 쓰기 차단과 정리, 새 요청의 거절로 확인한다.
- 클라이언트가 취소한 뒤 서버 구독·타이머·작업이 사라졌는지 따로 확인한다.
- 프록시 버퍼링 여부는 전체 본문이 아니라 연결이 열린 동안 첫 프레임이 도착했는지로 판단한다.

🧠 기억할 것: SSE 시험의 성공 증거는 200 하나가 아니라, 받은 프레임·재개 위치·정리 상태다.

## 7. 미니 퀴즈 또는 체크리스트

1. 첫 URL이 `[8, 3]`이고 재연결 헤더가 `[9, 3]`이면 서버는 무엇을 우선해야 하는가?
2. B:4의 데이터 줄을 읽었지만 마지막 빈 줄 전에 응답이 끝났다. 무엇을 확인해야 하는가?
3. B에 대한 권한을 열린 연결에서 철회했다. 이미 받은 200 대신 어떤 증거를 확인해야 하는가?
4. 원본과 프록시의 최종 본문은 같지만 프록시에서만 연결 종료 직전에 이벤트가 몰려 온다. 무엇을 비교하면 되는가?
5. 클라이언트가 구독을 취소했다는 사실만으로 서버 정리 시험을 끝낼 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 헤더의 `[9, 3]`을 우선한다. 같은 EventSource 객체가 재연결할 때 URL의 초기 위치는 바뀌지 않지만 헤더는 마지막 이벤트 위치를 담는다.
2. B가 완성된 이벤트로 전달되지 않았는지, 재연결 헤더가 B 이전 위치를 유지하는지, 재생에서 B가 한 번 완성되는지를 확인한다.
3. B 본문과 B를 포함하는 새 커서가 전송되지 않고, 서버 구독·작업이 정리되며 이후 같은 범위로 다시 요청해도 거절되는지 확인한다.
4. 첫 완성 프레임이 원본 응답 종료 전후 중 언제 도착했는지 비교한다. curl 자체의 출력 버퍼와 프록시 응답 버퍼를 구분한다.
5. 아니다. 서버가 취소를 감지한 뒤 해당 구독과 연결에 딸린 작업·타이머를 제거했다는 증거를 별도로 확인한다.

</details>
