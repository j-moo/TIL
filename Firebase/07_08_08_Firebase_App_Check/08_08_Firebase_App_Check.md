# TypeScript로 배우는 Firebase App Check

- 🎯 글의 목표: Firebase App Check가 확인하는 대상과 Authentication·Security Rules의 차이를 이해하고, 웹 앱에 안전하게 초기화·개발·운영 적용한다.
- 🧩 핵심 키워드: App Check, reCAPTCHA Enterprise, attestation, debug token, enforcement, token auto refresh
- ⭐ 중요도: ★★★★★ — 로그인한 사용자라도 비공식 클라이언트에서 요청을 보낼 수 있으므로, 앱 출처 확인과 데이터 권한을 별도로 설계해야 한다.
- 📝 한눈에 보는 내용: Authentication은 사용자의 신원을 확인하고 Rules는 데이터 접근 조건을 검사한다. App Check는 요청이 등록된 앱 인스턴스에서 왔는지 보완한다. 개발용 debug provider와 운영용 attestation provider를 분리하고, 지표를 확인한 뒤 제품별 enforcement를 단계적으로 적용한다.
- 🔗 관련 주제: Firebase Authentication, Firestore Security Rules, Emulator 테스트, GitHub Actions
- 🧱 선수 지식: Firebase 초기화, 환경 변수, 브라우저 개발자 도구, Promise

---

## 1. 로그인만으로 앱 요청을 신뢰할 수 없는 이유

Authentication을 사용하면 Firebase는 요청을 보낸 사용자가 누구인지 식별할 수 있다. 하지만 사용자는 공식 화면을 거치지 않고 Firebase SDK나 직접 만든 스크립트로 요청을 보낼 수도 있다. 로그인한 계정의 credential이 탈취되었거나, 앱 로직을 복사한 비공식 클라이언트가 사용되는 상황도 생각해야 한다.

App Check는 “이 요청이 등록된 앱에서 발생했는가?”를 확인하는 보완 계층이다. 이것이 사용자의 권한이나 데이터 규칙을 대신하는 것은 아니다.

```text
요청
 ├─ Authentication → 누구인가?
 ├─ App Check      → 등록된 앱에서 온 요청인가?
 └─ Security Rules → 이 사용자가 이 데이터에 접근할 수 있는가?
```

세 검사는 서로 다른 질문에 답한다. 예를 들어 App Check를 통과해도 다른 사용자의 Firestore 문서를 읽을 권한이 생기는 것은 아니며, 로그인하지 않은 요청을 App Check가 자동으로 사용자로 만들어 주지도 않는다.

## 2. App Check가 동작하는 전체 흐름

웹에서는 앱에 attestation provider를 연결한다. provider는 브라우저와 앱 환경에 대한 증명을 만들고 Firebase SDK는 App Check token을 Firebase 서비스 요청에 포함한다. Firebase 제품은 token을 검증한 뒤 enforcement 설정에 따라 허용하거나 거부한다.

```text
웹 앱 시작
    ↓
App Check provider 초기화
    ↓
앱 환경에 대한 attestation 수행
    ↓
App Check token 발급·자동 갱신
    ↓
Firestore·Storage·Auth 등 요청에 token 포함
    ↓
Firebase가 token 검증
    ├─ enforcement 미적용 → 지표만 기록하거나 요청 허용
    └─ enforcement 적용   → 검증되지 않은 요청 거부
```

App Check token은 비밀번호나 API secret이 아니다. 공격자가 절대로 우회할 수 없다는 보장이 아니라, 비공식·자동화 요청을 줄이기 위한 추가 방어 계층으로 이해한다.

## 3. 웹 provider 선택하기

Firebase Web App Check에서는 프로젝트와 브라우저 환경에 맞는 provider를 선택한다. 현재 문서에서는 운영용 예제로 reCAPTCHA Enterprise provider를 사용한다.

| 상황 | 사용할 provider | 핵심 주의점 |
| --- | --- | --- |
| 운영 웹 앱 | `ReCaptchaEnterpriseProvider` | reCAPTCHA Enterprise site key와 도메인 설정 필요 |
| localhost·CI 테스트 | `ReCaptchaEnterpriseProvider` 대신 debug provider | debug token을 저장소에 커밋하지 않음 |
| 자체 백엔드 | App Check token을 직접 발급·검증하는 별도 흐름 | 클라이언트 token만 믿지 말고 서버에서 검증 |

reCAPTCHA site key는 브라우저에 전달되는 식별자이므로 일반적인 API secret처럼 숨기는 값은 아니다. 그래도 허용 도메인, Firebase 프로젝트, 배포 환경을 정확히 맞춰야 한다.

## 4. TypeScript로 App Check 초기화하기

### 4.1 운영용 초기화 모듈

Firebase App Check는 Firebase 서비스에 접근하기 전에 초기화해야 한다. 같은 Firebase App에 `initializeAppCheck`를 여러 번 호출하지 않도록 초기화 모듈을 하나로 제한한다.

```ts
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

// site key는 환경별 Firebase 프로젝트 설정과 맞아야 한다.
const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY

if (!appCheckSiteKey) {
  throw new Error('reCAPTCHA Enterprise site key가 설정되지 않았습니다.')
}

// 운영 provider를 앱마다 한 번만 등록한다.
export const appCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
  // true로 설정하면 SDK가 만료 전에 token을 갱신한다.
  isTokenAutoRefreshEnabled: true,
})

// App Check 초기화 뒤 Firebase 서비스 instance를 사용한다.
export const auth = getAuth(firebaseApp)
export const firestore = getFirestore(firebaseApp)
```

이 예제는 운영 환경을 위한 기본 구조다. 실제 프로젝트에서는 개발용 debug provider를 운영 번들에 포함하지 않도록 빌드 환경에 따라 provider를 분기한다. 초기화 전 Firestore 요청이 실행되면 요청에 App Check token이 붙지 않을 수 있으므로 Firebase 모듈을 먼저 import하는 구조를 유지한다.

### 4.2 token 자동 갱신의 의미

SDK는 token 자동 갱신을 명시적으로 활성화할 수 있다. 자동 갱신을 켜지 않으면 페이지를 오래 열어 둔 사용자의 token이 만료된 뒤 요청이 실패하거나 새 token을 기다리는 상황이 생길 수 있다.

자동 갱신은 앱이 token을 직접 저장하거나 갱신 주기를 계산한다는 뜻이 아니다. SDK가 현재 App Check instance를 기준으로 필요한 시점에 갱신한다.

## 5. localhost에서 debug provider 사용하기

운영용 attestation provider는 localhost나 CI 실행 환경을 실제 사용자의 유효한 앱 환경으로 판단하지 않을 수 있다. 개발 중에는 Firebase Console에 등록한 debug token을 사용하는 별도 build를 만든다.

### 5.1 debug mode 활성화

아래 코드는 **개발용 코드에서만** 실행한다. `initializeAppCheck`보다 먼저 debug token 설정이 평가되어야 한다.

```ts
// src/lib/firebase.debug.ts
import { initializeApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check'

// 이 파일은 개발용 entry에서만 import한다고 가정한다.
declare global {
  // Firebase SDK가 읽는 전역 debug token의 TypeScript 타입을 선언한다.
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined
}

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

// true를 사용하면 브라우저가 새 debug token을 출력한다.
// 실제 token 문자열을 코드에 하드코딩하거나 commit하지 않는다.
globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true

const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
if (!siteKey) throw new Error('개발용 site key가 없습니다.')

export const appCheck = initializeAppCheck(firebaseApp, {
  // 개발 환경에서는 운영 attestation 대신 debug provider 동작을 사용한다.
  provider: new ReCaptchaEnterpriseProvider(siteKey),
  isTokenAutoRefreshEnabled: true,
})
```

위 예제에서 `ReCaptchaEnterpriseProvider`를 그대로 사용하고 `FIREBASE_APPCHECK_DEBUG_TOKEN`을 설정하는 방식은 Firebase Web SDK가 debug mode를 감지하는 흐름을 보여 주기 위한 것이다. 프로젝트의 SDK 버전과 공식 debug provider 설정 방식이 다르면 해당 버전 문서를 확인한다. 중요한 규칙은 **debug token은 개발·CI에서만 사용하고 운영 배포에 포함하지 않는 것**이다.

### 5.2 token 등록 순서

1. debug build를 localhost에서 실행한다.
2. 브라우저 개발자 도구 콘솔에 출력된 App Check debug token을 확인한다.
3. Firebase Console의 App Check 앱 설정에서 Manage debug tokens로 이동한다.
4. token을 등록한 뒤 같은 브라우저에서 요청을 다시 실행한다.
5. 등록된 token이 더 이상 필요하지 않거나 노출되었다면 Console에서 즉시 삭제한다.

debug token은 유효한 기기 증명 없이 Firebase backend에 접근할 수 있게 해 주므로 비밀번호처럼 취급한다. public repository, 화면 캡처, 이슈, 로그에 token을 남기지 않는다.

### 5.3 CI 환경

CI에서 Rules나 UI 테스트가 App Check enforcement가 적용된 Firebase 프로젝트에 접근해야 한다면 CI 전용 debug token을 암호화된 secret으로 보관한다.

```ts
// CI build에서만 secret을 주입받는 개념 예시다.
declare global {
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined
}

const ciDebugToken = import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN

if (ciDebugToken) {
  // 실제 값은 CI secret에서 주입되고 저장소에는 들어오지 않는다.
  globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = ciDebugToken
}
```

Vite 환경 변수는 빌드 결과에 포함될 수 있으므로 이 값을 운영 client bundle에 넣으면 안 된다. CI 전용 build profile과 운영 build profile을 분리하고, token이 비어 있는 운영 build에서 debug provider가 선택되지 않는지 확인한다.

## 6. Enforcement는 관찰 후 단계적으로 적용하기

SDK를 배포했다고 Firebase 서비스가 즉시 검증되지 않은 요청을 차단하는 것은 아니다. Firebase Console의 App Check 지표에서 verified·unverified 요청을 먼저 관찰하고, 정상 사용자에게 미칠 영향을 확인한 뒤 제품별 enforcement를 적용한다.

```text
SDK 배포
   ↓
요청 지표 관찰
   ↓
localhost·CI·오래된 앱의 정상 요청 확인
   ↓
제품별 enforcement 적용
   ↓
permission·App Check 오류 모니터링
```

enforcement를 적용하면 검증되지 않은 요청이 해당 제품에서 거부된다. 적용 시점과 설정 변경이 실제 요청에 반영되기까지 시간이 걸릴 수 있으므로, 배포 직후 즉시 실패했다고 단정하지 말고 Console 지표와 클라이언트 로그를 함께 확인한다.

### 6.1 제품별 enforcement

Cloud Firestore, Cloud Storage, Realtime Database, Authentication 등 지원되는 Firebase 제품은 각각 App Check enforcement를 설정한다. 앱에서 사용하는 모든 제품을 한 번에 켜기보다 개발·스테이징 프로젝트에서 제품별로 확인한다.

Authentication의 App Check enforcement가 활성화된 프로젝트에서도 기존 로그인 흐름과 provider 지원 상태를 확인해야 한다. App Check가 사용자의 이메일 인증이나 Rules 소유권 검사를 대신하는 것은 아니다.

### 6.2 오래된 앱과 debug build 고려

운영 enforcement 뒤에 App Check SDK가 포함되지 않은 이전 버전 앱은 요청이 거부될 수 있다. 웹 앱이라도 캐시된 bundle이나 여러 도메인의 배포본이 남을 수 있으므로, 적용 전에 실제 사용 경로와 배포 버전을 점검한다.

## 7. App Check·Auth·Rules 비교

| 계층 | 확인하는 질문 | 실패하면 생기는 일 | 대신할 수 없는 것 |
| --- | --- | --- | --- |
| Authentication | 사용자는 누구인가? | 로그인·사용자 식별 실패 | 앱 출처 확인, 문서별 권한 |
| App Check | 등록된 앱 환경에서 온 요청인가? | enforcement 대상 요청 거부 | 사용자 로그인, owner 검증 |
| Security Rules | 이 사용자가 이 문서에 접근할 수 있는가? | `permission-denied` | 앱 설치·브라우저 진위 확인 |
| 서버 IAM | 서버 자격 증명에 어떤 권한이 있는가? | 서버 요청 거부 | 브라우저 요청의 사용자 흐름 |

Firestore 보안을 예로 들면 App Check를 켠 뒤에도 Rules를 다음처럼 유지해야 한다.

```text
요청 허용 조건
    = 유효한 App Check
    AND 로그인 사용자
    AND request.auth.uid == 문서 ownerId
    AND 필드·query 조건 통과
```

하나의 보안 계층이 통과했다고 나머지 조건까지 충족한 것으로 해석하지 않는다.

## 8. App Check token을 직접 다루는 경우

일반적인 Firestore·Storage SDK 요청은 Firebase SDK가 App Check token을 요청에 포함한다. 별도로 운영하는 backend endpoint를 보호하려면 client에서 token을 얻어 요청에 넣고, 서버에서 Firebase Admin SDK 등 검증 기능으로 확인해야 한다.

```ts
import { getToken } from 'firebase/app-check'
import { appCheck } from '../lib/firebase'

export async function requestMyBackend(path: string): Promise<Response> {
  // Firebase 서비스가 아닌 자체 API에 보낼 현재 App Check token을 요청한다.
  const tokenResult = await getToken(appCheck)

  return fetch(`/api/${path}`, {
    headers: {
      // 서버는 이 token을 검증해야 하며, 존재한다는 사실만 믿으면 안 된다.
      'X-Firebase-AppCheck': tokenResult.token,
    },
  })
}
```

클라이언트가 보낸 header는 누구나 흉내 낼 수 있다. 자체 backend는 token의 서명·project·app 정보를 서버에서 검증하고, 실패한 요청을 거부해야 한다. 한 번 사용만 허용하는 limited-use token과 replay protection은 모든 Firebase SDK 요청에 기본 적용되는 기능으로 가정하지 말고, 해당 제품의 지원 범위를 확인한다.

## 9. 자주 발생하는 문제와 확인 순서

### 9.1 localhost 요청이 거부된다

운영 provider가 localhost를 유효한 환경으로 보지 않을 수 있다. 개발용 debug mode를 활성화하고 콘솔에 나온 token을 Firebase Console에 등록했는지 확인한다. localhost를 reCAPTCHA 허용 도메인에 임의로 추가하는 방식으로 해결하지 않는다.

### 9.2 운영에서 debug token이 발견된다

즉시 해당 token을 Firebase Console에서 폐기하고, debug provider·debug token·개발용 환경 변수·로그가 운영 bundle에 들어간 경로를 조사한다. 노출된 token은 앱 코드에서 삭제하는 것만으로 무효화되지 않을 수 있다.

### 9.3 App Check는 통과했는데 Firestore가 거부된다

App Check 성공은 Rules 권한 성공을 의미하지 않는다. `request.auth`, owner uid, query 조건, 필드 검증을 별도로 확인하고 Emulator에서 인증 사용자와 Rules 사례를 재현한다.

### 9.4 enforcement 뒤 CI 테스트가 실패한다

CI 환경은 실제 브라우저 attestation을 만들 수 없을 수 있다. CI 전용 debug token을 secret으로 주입하되, 로그에 출력하지 않고 운영 secret과 분리한다. App Check를 끈 별도 테스트 project를 사용하는 선택지도 비용과 보안 수준을 함께 비교한다.

### 9.5 token 자동 갱신이 작동하지 않는다

`isTokenAutoRefreshEnabled: true` 설정 여부와 App Check instance 중복 초기화 여부를 확인한다. 브라우저 저장소 차단, third-party cookie 정책, provider 설정 오류도 함께 개발자 도구에서 확인한다.

## 10. 적용 관점에서 다시 보기

App Check를 도입할 때 먼저 보호할 Firebase 제품과 정상 요청 경로를 목록으로 적는다. 다음으로 운영 provider, localhost debug provider, CI debug token의 환경을 분리한다. 마지막으로 지표를 관찰한 뒤 enforcement를 제품별로 적용한다.

문제가 생기면 다음 순서로 확인한다.

1. `initializeAppCheck`가 Firebase service 접근보다 먼저 실행되는가?
2. 현재 build가 운영 provider인지 debug provider인지 확인했는가?
3. debug token이 Console에 등록되어 있고 노출되지 않았는가?
4. `isTokenAutoRefreshEnabled`가 활성화되어 있는가?
5. App Check 지표에서 요청이 verified로 보이는가?
6. enforcement 대상 제품이 정확한가?
7. Auth와 Security Rules 조건도 별도로 통과하는가?

## 11. 배운 점과 확장 방향

### 11.1 새로 이해한 것

App Check는 로그인보다 더 강한 로그인 방식이 아니라, 앱 출처를 보완하는 요청 검증 계층이다. 운영에 바로 강제하는 것보다 정상 요청과 오래된 build를 관찰한 뒤 단계적으로 적용해야 사용자 중단을 줄일 수 있다.

### 11.2 이전·다음 학습과의 연결

Authentication 문서에서 배운 사용자 식별, Rules 문서에서 배운 데이터 권한, Emulator 문서에서 배운 허용·거부 테스트가 App Check와 함께 하나의 요청 보호 흐름을 만든다. 다음에는 React 오류 처리와 GitHub Actions에서 App Check·Rules 테스트 실패를 안전하게 보여 주는 방법으로 확장할 수 있다.

### 11.3 더 확인할 주제

- App Check와 reCAPTCHA Enterprise의 도메인·quota 설정
- Cloud Functions에서 App Check token 검증
- 자체 backend의 Admin SDK token 검증
- 제한된 사용 token과 replay protection 적용 범위
- 운영 enforcement 전환·롤백 절차

## 12. 요약 정리

- Authentication은 사용자를 식별하고 App Check는 앱 출처를 보완한다.
- Security Rules는 문서와 작업에 대한 권한을 별도로 검사한다.
- App Check를 추가해도 Auth와 Rules를 제거하면 안 된다.
- 운영 웹 앱은 attestation provider, localhost·CI는 별도 debug provider를 사용한다.
- debug token은 backend에 접근할 수 있으므로 secret처럼 관리한다.
- App Check는 Firebase 서비스에 접근하기 전에 초기화한다.
- token 자동 갱신을 활성화하면 오래 열린 앱의 token 만료 문제를 줄일 수 있다.
- SDK 배포와 enforcement 적용은 서로 다른 단계다.
- enforcement 전에는 App Check 지표로 정상·오래된·CI 요청을 확인한다.
- 자체 backend를 보호할 때는 서버에서 App Check token을 검증한다.

🧠 기억할 것: **App Check는 “누구인가”가 아니라 “어떤 앱에서 온 요청인가”를 보완하므로, Auth·Rules와 함께 사용해야 한다.**

## 13. 미니 퀴즈

1. Authentication과 App Check가 각각 답하는 질문은 무엇인가?
2. App Check가 통과했는데도 Firestore Rules에서 요청이 거부될 수 있는 이유는 무엇인가?
3. localhost에서 운영 enforcement를 테스트할 때 debug token이 필요한 이유는 무엇인가?
4. debug token을 public repository에 커밋하면 안 되는 이유는 무엇인가?
5. SDK를 배포한 직후 곧바로 enforcement를 켜지 않고 지표를 관찰하는 이유는 무엇인가?
6. 자체 backend가 `X-Firebase-AppCheck` header의 존재만 검사하면 안 되는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. Authentication은 사용자 신원, App Check는 등록된 앱 환경에서 온 요청인지 확인한다.
2. App Check는 앱 출처를 확인할 뿐 owner uid·필드·query 권한을 결정하지 않기 때문이다.
3. localhost나 CI는 운영 attestation provider가 유효한 앱 환경으로 판단하지 않을 수 있기 때문이다.
4. 등록된 debug token은 검증되지 않은 환경에서도 Firebase backend에 접근할 수 있게 하므로 악용될 수 있다.
5. 정상 사용자·오래된 build·CI 요청까지 차단되는지 먼저 확인해야 서비스 중단을 줄일 수 있기 때문이다.
6. header는 누구나 복사해 보낼 수 있으므로 서버에서 token의 서명과 Firebase 프로젝트 정보를 검증해야 한다.

</details>

## 참고 자료

- [Firebase App Check Web reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Web debug provider](https://firebase.google.com/docs/app-check/web/debug-provider)
- [App Check enforcement](https://firebase.google.com/docs/app-check/enable-enforcement)
- [App Check request metrics](https://firebase.google.com/docs/app-check/monitor-metrics)
- [Firebase App Check JavaScript API](https://firebase.google.com/docs/reference/js/app-check)
- [Firestore 보안 개요](https://firebase.google.com/docs/firestore/security/overview)
