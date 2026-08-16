# React 개발자를 위한 브라우저 웹 보안 기초

- 🎯 글의 목표: 브라우저의 출처 기반 보안 모델을 이해하고, CORS·쿠키·XSS·CSRF·CSP가 각각 어떤 공격을 막는지 구분한다.
- 🧩 핵심 키워드: origin, Same-Origin Policy, CORS, 인증, 인가, cookie, XSS, CSRF, CSP, 신뢰 경계
- ⭐ 중요도: ★★★★★ — 화면에서 숨기거나 클라이언트에서 검사하는 것만으로는 데이터와 사용자 권한을 보호할 수 없다.
- 📝 한눈에 보는 내용: 브라우저는 출처 사이의 읽기를 제한하고, 서버는 허용할 출처와 사용자의 권한을 따로 판단한다. 외부 데이터는 코드가 되지 않게 출력하고, 쿠키 기반 요청은 위조 방지 장치를 두며, CSP와 보안 헤더를 추가 방어 계층으로 사용한다.
- 🔗 관련 주제: HTTP, React JSX, 폼, Firebase Authentication·Security Rules·App Check, GitHub Actions Secrets
- 🧱 선수 지식: URL, HTTP 요청과 응답, React 컴포넌트, 비동기 `fetch`

---

## 1. 들어가며

웹 애플리케이션 보안을 공부할 때 다음과 같은 오해가 자주 생긴다.

- CORS 오류가 없으면 API가 안전하다.
- 로그인 화면을 통과했으므로 데이터 권한도 안전하다.
- React가 문자열을 이스케이프하므로 XSS는 절대 발생하지 않는다.
- JWT는 암호화된 비밀 데이터다.
- `.env`에 넣은 값은 브라우저에서 보이지 않는다.
- 클라이언트 검증을 통과한 요청만 서버에 도착한다.

이 문장들은 모두 서로 다른 보안 계층을 하나로 섞은 결과다. 웹 보안은 특정 라이브러리 하나로 완성되지 않는다. 데이터가 어디에서 와서 어디로 이동하는지, 각 경계에서 누가 무엇을 검증하는지 나눠 봐야 한다.

## 2. 전체 지도: 브라우저와 서버의 책임

```text
사용자 또는 외부 데이터
        ↓ 입력 검증·변환
React 애플리케이션
        ↓ HTTPS 요청
브라우저 보안 정책(SOP·CORS·cookie 정책)
        ↓
서버 인증(Authentication)
        ↓ 누구인지 확인
서버 인가(Authorization)
        ↓ 이 자원에 이 동작이 허용되는지 확인
서버 입력 검증·비즈니스 규칙
        ↓
데이터베이스 또는 외부 서비스
```

브라우저의 보안 정책은 사용자의 브라우저를 보호한다. 서버의 인증·인가·검증은 서버 데이터와 기능을 보호한다. 공격자는 브라우저 UI를 거치지 않고 직접 HTTP 요청을 만들 수 있으므로 서버는 클라이언트를 신뢰하지 않는다.

### 2.1 위협·방어 수단을 먼저 구분한다

| 문제 | 핵심 질문 | 주요 방어 수단 |
| --- | --- | --- |
| CORS | 다른 origin의 JavaScript가 응답을 읽어도 되는가? | 서버의 CORS 응답 헤더 |
| XSS | 공격자 데이터가 페이지에서 코드로 실행되는가? | 안전한 출력, sanitization, CSP |
| CSRF | 로그인 사용자의 브라우저가 원치 않는 요청을 보내는가? | CSRF token, SameSite, origin 검증 |
| 인증 | 요청한 사용자가 누구인가? | 세션, 토큰, 재인증 |
| 인가 | 그 사용자가 해당 자원에 접근할 수 있는가? | 서버 권한 검사, Firebase Rules |
| 비밀 관리 | 민감한 키가 권한 없는 사람에게 노출되는가? | 서버 보관, secret manager, 최소 권한 |

같은 요청에 여러 방어가 동시에 필요할 수 있다. 예를 들어 쿠키 세션을 사용하는 API는 인증, 객체별 인가, CSRF 방어, 입력 검증을 모두 수행해야 한다.

## 3. Origin과 Same-Origin Policy

**origin(출처)** 은 일반적으로 URL의 scheme, host, port 조합이다.

```text
https://app.example.com:443/notes
└─scheme─┘ └────host────┘ port
```

| URL | `https://app.example.com`과 같은 origin인가? | 이유 |
| --- | --- | --- |
| `https://app.example.com/profile` | 예 | scheme·host·port가 같음 |
| `http://app.example.com` | 아니요 | scheme이 다름 |
| `https://api.example.com` | 아니요 | host가 다름 |
| `https://app.example.com:8443` | 아니요 | port가 다름 |

Same-Origin Policy(SOP)는 한 origin에서 실행된 script가 다른 origin의 민감한 데이터를 마음대로 읽지 못하게 제한하는 브라우저 보안 장치다. 악성 사이트의 JavaScript가 사용자가 로그인한 메일이나 사내 시스템의 응답을 읽는 상황을 줄인다.

하지만 “다른 origin으로 어떤 요청도 보낼 수 없다”는 뜻은 아니다. 이미지, 링크, 폼처럼 웹은 오래전부터 교차 출처 자원을 사용할 수 있었다. 제한 대상과 방법은 자원·요청 종류에 따라 다르며, 대표적으로 JavaScript가 `fetch` 응답을 읽으려면 CORS 허가가 필요하다.

### 3.1 origin과 site는 같은 말이 아니다

쿠키의 `SameSite`에서 말하는 site와 CORS의 origin은 판단 단위가 다르다. `app.example.com`과 `api.example.com`은 서로 다른 origin이지만 같은 site로 판단될 수 있다. 따라서 “same-site니까 CORS도 필요 없다”라고 연결하면 안 된다.

## 4. CORS는 서버가 브라우저에 주는 읽기 허가다

CORS(Cross-Origin Resource Sharing)는 서버가 응답 헤더를 통해 어떤 origin의 브라우저 JavaScript에 응답 읽기를 허용할지 알리는 방식이다.

```text
https://app.example.com의 JavaScript
        ↓ fetch
https://api.example.com
        ↓ 응답 + Access-Control-Allow-Origin
브라우저가 허용 origin인지 검사
        ↓
허용되면 JavaScript에 응답 공개
```

```http
Access-Control-Allow-Origin: https://app.example.com
Vary: Origin
```

서버가 헤더를 보내야 한다. React 코드에 `Access-Control-Allow-Origin`을 요청 헤더로 넣어도 서버의 허가가 되지 않는다.

### 4.1 Preflight

브라우저는 일부 교차 origin 요청을 실제로 보내기 전에 `OPTIONS` 요청으로 서버가 method와 header를 허용하는지 확인한다. 이를 preflight라고 한다.

```text
OPTIONS /notes
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type, x-csrf-token

        ↓ 서버 허용 응답

POST /notes
```

모든 교차 origin 요청이 preflight를 발생시키는 것은 아니다. preflight가 없다는 이유로 요청이 같은 origin이거나 안전하다고 단정할 수 없다.

### 4.2 자격 증명이 포함된 요청

쿠키를 교차 origin `fetch`에 포함하려면 클라이언트와 서버 설정이 함께 맞아야 한다.

```ts
const response = await fetch('https://api.example.com/session', {
  // 브라우저가 이 요청에 허용되는 cookie를 포함하도록 요청한다.
  credentials: 'include',
})
```

서버는 구체적인 origin을 허용하고 자격 증명 허용도 응답해야 한다.

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

자격 증명을 허용하면서 `Access-Control-Allow-Origin: *`를 사용할 수 없다. 요청의 `Origin` 값을 검사 없이 그대로 반사하는 구현도 사실상 모든 출처를 허용할 수 있으므로 allowlist와 정확히 비교한다.

### 4.3 CORS가 보안 경계의 전부가 아닌 이유

- CORS는 브라우저가 응답을 JavaScript에 공개할지 결정한다.
- curl, 서버 프로그램, 공격자 스크립트는 브라우저 CORS 정책의 보호 대상이 아니다.
- CORS가 허용돼도 서버 인증과 인가는 별도로 필요하다.
- CORS로 응답을 읽지 못해도 일부 요청 자체는 전송될 수 있으므로 CSRF 문제는 별도로 다룬다.

📌 핵심: **CORS는 API 사용자의 권한을 부여하는 기능이 아니라, 브라우저의 교차 origin 응답 읽기 정책이다.**

## 5. 인증과 인가를 분리한다

**인증(Authentication)** 은 요청자가 누구인지 확인한다. **인가(Authorization)** 는 확인된 사용자가 특정 자원에 특정 동작을 할 수 있는지 판단한다.

```text
유효한 로그인 세션인가?             ← 인증
        ↓ 예
요청한 note의 ownerId와 uid가 같은가? ← 인가
        ↓ 예
수정 허용
```

로그인한 사용자라고 해서 다른 사용자의 노트를 읽거나 수정할 권한이 생기지는 않는다.

```ts
// 서버에서 실행되는 개념 예시다.
async function updateNote(request: Request, noteId: string) {
  const user = await requireAuthenticatedUser(request)
  const note = await noteRepository.findById(noteId)

  if (note === null) {
    throw new HttpError(404, '노트를 찾을 수 없습니다.')
  }

  // 클라이언트가 보낸 ownerId가 아니라 서버가 읽은 기존 소유자를 검사한다.
  if (note.ownerId !== user.id) {
    throw new HttpError(403, '수정 권한이 없습니다.')
  }

  // 인가가 끝난 뒤 검증된 변경만 적용한다.
  return noteRepository.update(noteId, request.body)
}
```

React 보호 경로는 로그인하지 않은 사용자에게 화면을 감추고 이동시키는 UX 기능이다. 개발자 도구나 직접 만든 요청으로 우회할 수 있으므로 실제 데이터 접근은 서버 또는 Firebase Security Rules가 거부해야 한다.

## 6. Cookie 기반 세션의 속성

세션 cookie는 브라우저가 요청에 자동으로 포함할 수 있다. 서버는 cookie 안의 추측하기 어려운 session ID를 이용해 서버 측 세션을 찾는다.

```http
Set-Cookie: __Host-session=random-session-id; Path=/; HttpOnly; Secure; SameSite=Lax
```

| 속성 | 역할 | 해결하지 않는 것 |
| --- | --- | --- |
| `HttpOnly` | JavaScript의 `document.cookie`에서 cookie 읽기를 제한 | XSS 코드 실행 자체 |
| `Secure` | HTTPS 요청에서만 cookie 전송 | 서버 인가와 CSRF 전체 |
| `SameSite` | cross-site 요청에 cookie를 보낼 조건 제한 | 모든 CSRF 시나리오 |
| `Path` | cookie가 전송될 URL 경로 범위 제한 | 권한 경계 |
| `Domain` | cookie가 전송될 domain 범위 결정 | 하위 domain을 신뢰하게 만드는 보안 보장 |

`SameSite=None`은 cross-site cookie가 필요한 경우 사용하며 `Secure`가 함께 필요하다. `Strict`, `Lax`, `None` 선택은 로그인 이동, 외부 결제 복귀, 여러 도메인 구성 같은 실제 흐름을 함께 검토한다.

### 6.1 JWT는 저장 장소가 아니다

JWT(JSON Web Token)는 token의 한 형식이다. 일반적인 서명 JWT의 payload는 Base64URL로 표현될 뿐 암호화돼 숨겨지는 것이 아니다. 비밀번호나 노출되면 안 되는 정보를 payload에 넣지 않는다.

“JWT니까 localStorage”처럼 token 형식이 저장 위치를 자동으로 결정하지도 않는다. 브라우저 세션 구조, XSS와 CSRF 위협, 갱신·폐기 방식, backend-for-frontend 여부를 함께 설계한다.

### 6.2 localStorage에 인증 정보를 직접 저장할 때의 위험

`localStorage`와 `sessionStorage`는 같은 origin에서 실행되는 JavaScript가 읽을 수 있다. XSS가 발생하면 저장된 session ID, access token, refresh token이 탈취될 수 있다. OWASP는 session 식별자와 인증 token을 Web Storage에 보관하지 말 것을 권고한다.

서버를 제어할 수 있는 일반적인 웹 앱에서는 `HttpOnly; Secure; SameSite` cookie와 서버 세션 또는 BFF 구조를 우선 검토한다. HttpOnly cookie를 사용하면 frontend JavaScript가 token을 직접 읽지는 못하지만, 요청에 cookie가 자동 포함되므로 CSRF 방어가 필요하다.

Firebase Authentication처럼 SDK가 인증 상태와 persistence를 관리하는 서비스에서는 SDK의 공식 방식을 따르고 token을 별도로 localStorage에 복사하지 않는다. SDK 사용이 모든 XSS·인가 문제를 해결한다는 뜻은 아니다.

## 7. XSS: 데이터가 코드로 실행되는 문제

XSS(Cross-Site Scripting)는 공격자가 영향을 준 데이터가 페이지에서 실행 가능한 script나 markup으로 해석되는 취약점이다. 실행된 코드는 피해 사용자의 origin 권한 안에서 동작할 수 있다.

대표적인 흐름은 다음과 같다.

```text
URL·폼·API·데이터베이스의 공격자 입력
        ↓ 검증되지 않은 채 출력
innerHTML 같은 실행 가능한 문맥에 삽입
        ↓
브라우저가 데이터가 아닌 코드로 해석
        ↓
사용자 행동 위조·데이터 접근·외부 전송
```

### 7.1 React JSX가 기본적으로 보호하는 범위

React는 JSX 중괄호로 렌더링한 문자열을 일반적으로 text로 처리한다.

```tsx
type CommentProps = { content: string }

function Comment({ content }: CommentProps) {
  // content 안의 HTML 모양 문자열은 보통 markup이 아니라 text로 표시된다.
  return <p>{content}</p>
}
```

이 기본 동작은 중요한 XSS 방어다. 문자열을 직접 HTML로 조립하거나 DOM의 위험한 API로 보내면 이 보호를 벗어날 수 있다.

### 7.2 `dangerouslySetInnerHTML`

```tsx
// 외부 HTML을 검증 없이 넣는 위험한 예시다.
function Article({ html }: { html: string }) {
  return <article dangerouslySetInnerHTML={{ __html: html }} />
}
```

마크다운 변환 결과나 rich text처럼 HTML 렌더링이 꼭 필요하면 신뢰할 수 있는 sanitization 라이브러리를 사용해 허용할 태그와 속성만 남긴다. 정규식으로 위험한 `<script>` 문자열 몇 개만 지우는 방식은 다양한 HTML 파싱 문맥과 우회 형태를 다루기 어렵다.

```tsx
type SafeHtmlProps = { untrustedHtml: string }

function SafeHtml({ untrustedHtml }: SafeHtmlProps) {
  // sanitizeHtml은 검증된 sanitizer 설정을 감싼 프로젝트 함수라고 가정한다.
  const sanitizedHtml = sanitizeHtml(untrustedHtml)

  return (
    <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
  )
}
```

sanitize 설정도 코드와 의존성이므로 업데이트하고 테스트한다. 가능하다면 HTML 자체를 받지 않고 구조화된 데이터에서 React element를 만드는 편이 더 단순하다.

### 7.3 URL도 외부 입력이다

사용자 입력 URL을 link나 resource 주소로 사용할 때 허용할 scheme과 목적지를 검증한다.

```ts
function toSafeHttpUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl)

    // 일반 웹 링크로 허용할 scheme만 명시한다.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null
    }

    return url
  } catch {
    return null
  }
}
```

외부 새 창 링크에 `target="_blank"`를 사용할 때 최신 브라우저의 보호 동작에만 의존하지 않고 프로젝트 지원 범위를 고려해 `rel="noopener noreferrer"`도 검토한다.

### 7.4 XSS 방어를 한 층에 맡기지 않는다

1. framework의 기본 안전한 출력 방식을 유지한다.
2. HTML이 필요한 경우 문맥에 맞는 sanitization을 사용한다.
3. URL, 속성, CSS, script처럼 삽입 문맥이 다르면 같은 encoding을 무조건 재사용하지 않는다.
4. CSP를 추가 방어 계층으로 적용한다.
5. dependency를 점검하고 불필요한 third-party script를 줄인다.

## 8. CSRF: 사용자의 인증된 브라우저를 이용한 요청 위조

CSRF(Cross-Site Request Forgery)는 공격 사이트가 로그인된 사용자의 브라우저를 이용해 대상 사이트에 원치 않는 상태 변경 요청을 보내게 하는 공격이다. cookie가 대상 요청에 자동으로 포함될 수 있기 때문에 발생한다.

```text
사용자가 bank.example에 로그인됨
        ↓ session cookie 보유
공격 사이트의 위조 요청
        ↓ 브라우저가 조건에 따라 cookie 자동 포함
bank.example 서버
        ↓ 요청 의도를 검증하지 않으면
원치 않는 상태 변경
```

CSRF 공격자는 응답을 읽지 못해도 송금·이메일 변경 같은 동작을 발생시키는 것만으로 목적을 달성할 수 있다. 따라서 “CORS로 응답을 막았다”는 CSRF 방어가 아니다.

### 8.1 방어 수단

- framework가 제공하는 CSRF 보호를 우선 사용한다.
- 상태 변경 요청에 서버가 발급하고 검증하는 CSRF token을 포함한다.
- cookie의 `SameSite`를 요구사항에 맞게 설정한다.
- 서버에서 `Origin` 또는 `Referer`를 보조 신호로 검증한다.
- GET 요청으로 상태를 변경하지 않는다.
- 비밀번호·결제·계정 변경 같은 민감 동작에는 재인증이나 사용자 확인을 추가한다.

```ts
type UpdateProfileInput = {
  displayName: string
}

async function updateProfile(input: UpdateProfileInput): Promise<void> {
  // CSRF token은 서버가 신뢰 가능한 방식으로 발급한 값을 읽는다고 가정한다.
  const csrfToken = readCsrfToken()

  const response = await fetch('/api/profile', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      // 서버는 session과 별도로 이 token의 유효성을 검사한다.
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`프로필 수정 실패: ${response.status}`)
  }
}
```

token 이름과 전달 방식은 server framework의 공식 보호 기능을 따른다. frontend에서 임의의 고정 문자열을 만들고 서버가 존재 여부만 확인하면 공격자도 같은 값을 보낼 수 있어 방어가 되지 않는다.

### 8.2 XSS와 CSRF의 차이

| 구분 | XSS | CSRF |
| --- | --- | --- |
| 핵심 | 공격자 입력이 신뢰 사이트 안에서 코드로 실행 | 피해자의 인증된 브라우저가 원치 않는 요청 전송 |
| 주된 전제 | 안전하지 않은 출력 또는 실행 sink | 자동 전송되는 cookie 등 사용자 인증 문맥 |
| 대표 방어 | 안전한 출력, sanitization, CSP | CSRF token, SameSite, origin 검증 |
| 관계 | 실행된 XSS는 사용자 권한으로 요청 가능 | CSRF 방어가 있어도 XSS를 별도로 막아야 함 |

## 9. CSP는 추가 실행 제한 계층이다

CSP(Content Security Policy)는 서버가 응답 헤더로 페이지에서 허용할 script, style, image, frame 등의 출처와 실행 조건을 브라우저에 알리는 정책이다.

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

위 정책은 개념을 보여 주는 간단한 예시이며 모든 React 배포 환경에 그대로 적용할 완성 설정이 아니다. analytics, CDN, font, image, 개발 server, nonce·hash 사용 여부를 조사해야 한다.

### 9.1 주요 directive의 의미

| directive | 제한 대상 |
| --- | --- |
| `default-src` | 별도 directive가 없을 때 기본 resource 출처 |
| `script-src` | 실행할 JavaScript 출처와 방식 |
| `style-src` | stylesheet 출처와 inline style 정책 |
| `img-src` | image 출처 |
| `connect-src` | fetch, WebSocket 등의 연결 목적지 |
| `object-src` | plugin resource |
| `base-uri` | `<base>`로 URL 기준이 바뀌는 것 제한 |
| `frame-ancestors` | 어떤 페이지가 현재 페이지를 frame에 넣을 수 있는지 제한 |

CSP는 XSS 취약점을 고치는 대신 사용하는 장치가 아니다. 안전한 출력과 sanitization이 먼저이고, CSP는 실수가 실행으로 이어질 가능성과 피해를 줄이는 defense in depth다.

처음 적용할 때는 `Content-Security-Policy-Report-Only`로 위반 보고를 관찰한 뒤 필요한 resource를 조사한다. 오류를 없애기 위해 넓은 wildcard나 `'unsafe-inline'`을 무작정 추가하면 정책 효과가 약해질 수 있다.

## 10. 그 밖의 중요한 HTTP 보안 헤더

```http
Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- `X-Content-Type-Options: nosniff`는 브라우저가 선언된 MIME type을 임의로 실행 가능한 형식처럼 추측하는 위험을 줄인다.
- `Referrer-Policy`는 다른 요청에 어느 수준의 referrer 정보를 보낼지 제한한다.
- `Permissions-Policy`는 camera, microphone, geolocation 같은 브라우저 기능 사용 범위를 제한한다.
- HTTPS를 충분히 검증한 운영 환경에서는 HSTS로 이후 HTTP 접속을 HTTPS로 강제할 수 있다. 잘못된 장기 설정은 복구가 어려울 수 있어 domain과 subdomain 영향을 이해한 뒤 적용한다.

보안 헤더는 frontend component 안에서 설정하는 값이 아니다. hosting, reverse proxy, CDN 또는 server response 설정에서 실제 HTTP header로 제공한다.

## 11. 클라이언트 검증은 사용자 경험, 서버 검증은 신뢰 경계

React 폼의 `required`, `minLength`, TypeScript type은 빠른 피드백과 개발 안정성을 돕는다. 공격자는 이 코드를 수정하거나 건너뛰고 요청을 보낼 수 있다.

```tsx
// 사용자에게 즉시 입력 조건을 알려 주는 UI 검증이다.
<input name="title" required minLength={2} maxLength={100} />
```

서버는 별도로 다음을 검사한다.

- 필수 field와 type
- 길이, 범위, 허용 값
- 현재 사용자 권한
- 바꿀 수 없는 field의 변경 시도
- 중복, 상태 전이, 재고 같은 business rule
- 업로드 file의 실제 type, 크기, 저장 위치

클라이언트가 보낸 `ownerId`, `role`, `price`, `isAdmin`을 그대로 신뢰하지 않는다. 신뢰할 값은 인증된 사용자와 서버가 소유한 데이터에서 계산한다.

## 12. Frontend 환경 변수와 비밀 값

Vite에서 `VITE_` 접두사가 붙은 환경 변수는 frontend bundle에서 사용할 수 있도록 치환된다. 사용자의 브라우저에 전달되는 JavaScript와 network 요청은 사용자가 볼 수 있다고 가정한다.

```ts
// 공개 API endpoint처럼 노출돼도 되는 설정에 사용한다.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
```

다음 값은 frontend bundle에 넣지 않는다.

- database 비밀번호
- service account private key
- 결제 provider secret key
- 관리자 API token
- GitHub personal access token
- 외부 서비스의 서버 전용 secret

브라우저가 secret이 필요한 외부 API를 직접 호출하게 만들지 않고, 서버가 secret을 보관한 채 필요한 권한으로 대신 호출한다. 저장소에서 secret을 삭제해도 Git history와 이미 배포된 bundle에 남을 수 있으므로 노출된 key는 즉시 폐기·회전한다.

### 12.1 Firebase 웹 설정 객체

Firebase 웹 설정의 `apiKey`, `projectId` 등은 앱이 Firebase project를 찾기 위한 공개 설정이다. 이것을 숨기는 것으로 데이터를 보호하지 않는다.

| 계층 | 확인하는 것 |
| --- | --- |
| Firebase Authentication | 현재 사용자가 누구인지 |
| Security Rules | 그 사용자가 이 문서·파일·경로에 요청할 수 있는지 |
| App Check | 요청이 등록된 앱 환경에서 왔다는 신호가 있는지 |
| 서버·Cloud Functions | 관리자 작업, secret 사용, 추가 비즈니스 규칙 |

App Check가 통과해도 사용자 인가를 대신하지 않는다. React 보호 경로가 있어도 Rules를 대신하지 않는다. Admin SDK는 Security Rules를 우회할 수 있으므로 server code가 직접 인증·인가해야 한다.

## 13. Third-party script와 의존성

페이지에서 실행되는 third-party script는 사용자 화면과 DOM에 강한 접근 권한을 가질 수 있다. analytics, 광고, 채팅 widget을 추가할 때 기능뿐 아니라 다음을 확인한다.

- 실제로 필요한가?
- 어느 사용자 데이터에 접근하는가?
- script가 손상되거나 공급망 공격을 받으면 영향 범위는 무엇인가?
- CSP에서 허용해야 할 domain이 얼마나 늘어나는가?
- 개인정보 동의와 보존 정책이 필요한가?
- 제거하거나 장애 시 비활성화할 수 있는가?

package dependency도 같은 원칙으로 수와 권한을 줄이고 lockfile, 자동 취약점 알림, update 검토, CI test를 함께 운영한다. 취약점 숫자만 보고 무조건 major version을 올리기보다 실제 사용 경로와 공식 advisory를 확인한다.

## 14. 오류를 진단하는 순서

### 14.1 브라우저에 CORS 오류가 보일 때

1. frontend와 API의 정확한 origin을 적는다.
2. Network 탭에서 실제 요청과 `OPTIONS` preflight를 구분한다.
3. 서버 응답의 `Access-Control-Allow-Origin`을 확인한다.
4. method와 custom header가 허용됐는지 확인한다.
5. cookie가 필요하면 client credentials와 server allow-credentials를 함께 확인한다.
6. API 자체가 500 오류를 냈는데 CORS header가 빠져 CORS처럼 보이는지 server log도 본다.

브라우저 확장으로 CORS를 끄는 것은 원인 확인용 개인 실험일 수는 있어도 제품의 server 설정을 해결하지 않는다.

### 14.2 로그인했는데 401 또는 403일 때

- `401 Unauthorized`: 일반적으로 유효한 인증 정보가 없거나 만료됨을 뜻한다.
- `403 Forbidden`: 사용자는 식별됐지만 해당 동작 권한이 없음을 뜻하는 경우가 많다.

실제 API 계약이 이 관례를 어떻게 사용하는지 확인한다. cookie 전송 조건, token 만료, 서버 session, 사용자 role, 객체 소유권 순서로 좁힌다.

### 14.3 XSS 가능성을 점검할 때

외부 데이터가 들어오는 source와 HTML·script·URL로 해석될 수 있는 sink를 찾는다.

```text
source: URL, API, 폼, localStorage, postMessage
        ↓ 데이터 흐름 추적
sink: innerHTML, dangerouslySetInnerHTML, document.write, 동적 script URL
```

단순히 `<script>` 문자열만 검색하지 말고 어떤 값이 어떤 문맥에서 해석되는지 확인한다.

## 15. 구현 전·리뷰·배포 체크리스트

### 데이터와 권한

- [ ] 모든 외부 입력을 서버에서 다시 검증하는가?
- [ ] 인증과 객체별 인가를 별도로 검사하는가?
- [ ] client가 보낸 `userId`, `role`, `price`를 권한 판단에 그대로 쓰지 않는가?
- [ ] 오류 응답에 stack trace나 secret을 노출하지 않는가?

### 브라우저와 세션

- [ ] HTTPS를 사용하는가?
- [ ] session cookie에 요구사항에 맞는 HttpOnly·Secure·SameSite가 있는가?
- [ ] 상태 변경 요청에 CSRF 방어가 있는가?
- [ ] CORS 허용 origin이 필요한 범위로 제한되는가?
- [ ] 인증 token을 임의로 Web Storage에 복사하지 않는가?

### React 출력

- [ ] 외부 문자열을 JSX text로 출력하는 기본 방식을 유지하는가?
- [ ] `dangerouslySetInnerHTML` 사용 지점과 sanitization 근거를 검토했는가?
- [ ] 사용자 제공 URL의 scheme과 목적을 검증하는가?
- [ ] third-party script가 꼭 필요한가?

### 설정과 배포

- [ ] frontend 환경 변수에 server secret이 없는가?
- [ ] CSP를 비롯한 보안 헤더를 실제 response에서 확인했는가?
- [ ] dependency와 lockfile을 검사하고 update를 test했는가?
- [ ] 노출된 credential을 삭제만 하지 않고 폐기·회전했는가?

## 16. 배운 점과 다음 연결

웹 보안 용어들은 서로 대체 관계가 아니다. CORS는 브라우저의 응답 읽기, CSRF는 인증 문맥을 이용한 요청 위조, XSS는 데이터의 코드 실행, 인증과 인가는 사용자와 권한 확인을 다룬다.

다음 학습에서는 실제 server framework 하나를 선택해 cookie session, CSRF middleware, validation schema, 보안 header를 구성하고 테스트할 수 있다. Firebase를 사용한다면 같은 공격적 요청을 Emulator에서 Security Rules가 거부하는지도 검증한다.

## 17. 요약 정리

1. origin은 scheme, host, port 조합이며 Same-Origin Policy는 교차 origin 데이터 읽기를 제한한다.
2. CORS는 서버가 브라우저에 교차 origin 응답 읽기를 허가하는 정책이지 사용자 인가가 아니다.
3. 인증은 사용자 식별, 인가는 자원별 동작 허용 여부를 판단한다.
4. React 보호 경로와 클라이언트 검증은 서버 권한 검사를 대신하지 않는다.
5. HttpOnly·Secure·SameSite cookie 속성은 서로 다른 위험을 줄이며 단독으로 모든 공격을 막지 않는다.
6. React JSX의 문자열 출력은 XSS 위험을 줄이지만 HTML 삽입과 위험한 DOM API는 별도 검토가 필요하다.
7. 쿠키 기반 인증은 CSRF token, SameSite, origin 검증 같은 CSRF 방어가 필요하다.
8. CSP와 보안 header는 취약점을 고치는 대신이 아니라 추가 방어 계층이다.
9. frontend bundle과 `VITE_` 환경 변수는 사용자에게 공개된다고 가정한다.
10. Firebase 설정 객체가 아니라 Authentication, Security Rules, App Check와 server 인가의 조합이 접근을 통제한다.

🧠 기억할 것: **브라우저 화면은 신뢰 경계가 아니다. 외부 데이터는 코드가 되지 않게 처리하고, 모든 권한과 중요 입력은 데이터를 실제로 보호하는 서버 계층에서 다시 검증한다.**

## 18. 미니 퀴즈

1. origin을 구성하는 세 요소는 무엇인가?
2. CORS가 허용된 요청에도 서버 인가가 필요한 이유는 무엇인가?
3. `HttpOnly` cookie가 XSS를 완전히 막지 못하는 이유는 무엇인가?
4. React에서 외부 문자열을 JSX 중괄호로 출력하는 것과 `dangerouslySetInnerHTML`의 차이는 무엇인가?
5. CORS로 응답을 읽을 수 없는데도 CSRF가 성공할 수 있는 이유는 무엇인가?
6. JWT payload에 비밀 정보를 넣으면 안 되는 이유는 무엇인가?
7. Firebase 웹 설정 객체를 공개해도 되는 것과 Firestore 데이터를 공개해도 되는 것이 왜 다른가?

<details>
<summary>정답과 해설</summary>

1. scheme, host, port다.
2. CORS는 어느 origin의 브라우저 JavaScript가 응답을 읽을지 결정할 뿐, 로그인 사용자에게 특정 자원 권한이 있는지 판단하지 않기 때문이다.
3. HttpOnly는 JavaScript의 cookie 값 읽기를 제한하지만 페이지 안에서 악성 script가 실행되는 사실과 사용자 권한으로 동작을 수행하는 것까지 막지는 않는다.
4. JSX 문자열은 보통 text로 escape되지만 `dangerouslySetInnerHTML`은 문자열을 HTML markup으로 해석하게 하므로 신뢰할 수 있는 sanitization이 필요하다.
5. CSRF는 응답 내용을 읽는 것이 아니라 인증 cookie가 포함된 상태 변경 요청을 발생시키는 것만으로 목적을 달성할 수 있기 때문이다.
6. 일반적인 서명 JWT payload는 암호화된 비밀이 아니라 누구나 decode할 수 있는 형태이기 때문이다.
7. 설정 객체는 Firebase project를 식별하는 공개 정보이고, 실제 데이터 접근 허용 여부는 Authentication과 Security Rules 등이 요청마다 판단하기 때문이다.

</details>

## 참고 자료

- [MDN - Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)
- [MDN - Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [MDN - Cross-site scripting](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS)
- [OWASP - Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP - Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP - Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP - Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [OWASP - HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [OWASP - HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [Firebase - Understand Firebase projects](https://firebase.google.com/docs/projects/learn-more)
- [Firebase - Security Rules](https://firebase.google.com/docs/rules)
