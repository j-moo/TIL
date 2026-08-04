# TypeScript 웹 앱에 Firebase 연결하기

- 🎯 글의 목표: Firebase 프로젝트와 웹 앱을 등록하고 모듈형 SDK를 초기화하며, 설정과 보안의 경계를 이해한다.
- 🧩 핵심 키워드: Firebase project, web app, modular SDK, `initializeApp`, environment variable, Security Rules
- ⭐ 중요도: ★★★★★ — 초기화 위치와 보안 경계를 잘못 이해하면 서비스가 중복 생성되거나 데이터가 공개될 수 있다.
- 📝 한눈에 보는 내용: 콘솔에서 프로젝트와 웹 앱을 만든 뒤 `firebase` 패키지를 설치한다. 앱은 한곳에서 초기화하고 필요한 서비스만 하위 패키지에서 가져온다. 클라이언트 설정 객체가 보이더라도 실제 권한은 Security Rules와 인증으로 제한한다.
- 🔗 관련 주제: Vite 환경 변수, Firestore, Authentication, Emulator Suite
- 🧱 선수 지식: npm, ES module, TypeScript

---

## 1. 전체 구조

```text
Firebase 프로젝트
├─ 등록된 웹 앱 ── firebaseConfig
├─ Cloud Firestore
├─ Realtime Database
├─ Cloud Storage
└─ Authentication·Security Rules
```

Firebase 프로젝트는 여러 서비스를 묶는 최상위 단위다. 웹 앱 등록은 SDK가 어느 프로젝트에 연결할지 알려 주며, 데이터 접근 권한을 부여하는 과정은 아니다.

## 2. 설치와 환경 변수

```bash
# Vite 프로젝트의 package.json이 있는 폴더에서 실행한다.
npm install firebase
```

```dotenv
# .env.local: 실제 값은 Firebase 콘솔의 웹 앱 설정에서 확인한다.
VITE_FIREBASE_API_KEY=replace-with-project-value
VITE_FIREBASE_AUTH_DOMAIN=replace-with-project-value
VITE_FIREBASE_PROJECT_ID=replace-with-project-value
VITE_FIREBASE_STORAGE_BUCKET=replace-with-project-value
VITE_FIREBASE_MESSAGING_SENDER_ID=replace-with-project-value
VITE_FIREBASE_APP_ID=replace-with-project-value
```

Vite에서 브라우저 코드로 노출할 변수는 `VITE_` 접두사가 필요하다. 이 값들은 클라이언트 번들에서 볼 수 있으므로 관리자 비밀키나 서비스 계정 JSON을 넣어서는 안 된다.

## 3. 서비스 초기화 모듈

```ts
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  // import.meta.env 값은 런타임에 없을 수도 있으므로 배포 환경 설정도 확인한다.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 애플리케이션 전체에서 공유할 Firebase App을 한 번 만든다.
export const firebaseApp = initializeApp(firebaseConfig)

// 필요한 서비스 instance를 App에서 만들고 다른 모듈이 재사용하게 내보낸다.
export const firestore = getFirestore(firebaseApp)
export const realtimeDatabase = getDatabase(firebaseApp)
export const storage = getStorage(firebaseApp)
```

기존의 `firebase.firestore()` 같은 namespaced 문법과 `getFirestore()` 모듈형 문법을 섞지 않는다. npm과 번들러를 사용하는 새 웹 앱에는 tree-shaking이 가능한 모듈형 API가 권장된다.

## 4. 설정 객체와 보안을 구분한다

웹의 `firebaseConfig`는 앱이 프로젝트를 찾기 위한 식별 정보다. 이 값을 숨기는 것만으로 데이터가 보호되지 않는다. 실제 접근 통제는 Authentication, Firestore·Realtime Database·Storage의 Security Rules, 필요하면 App Check로 구성한다.

특히 다음 값은 클라이언트 저장소에 두면 안 된다.

- 서비스 계정 private key
- Firebase Admin SDK 자격 증명
- 외부 결제·메일 서비스의 비밀키
- 서버만 사용해야 하는 토큰

## 5. 개발 환경과 운영 환경 분리

개발 데이터와 실제 사용자 데이터를 같은 프로젝트에서 다루면 테스트 삭제나 공개 규칙이 운영에 영향을 줄 수 있다. 최소한 환경 변수 파일을 나누고, 가능하면 개발·운영 Firebase 프로젝트도 분리한다.

로컬에서는 Emulator Suite로 데이터 모델과 Rules를 시험할 수 있다. 에뮬레이터 연결 코드가 운영 빌드에서 실행되지 않도록 개발 모드 조건을 명확히 둔다.

## 6. 문제 해결 순서

- `No Firebase App` 오류: 서비스보다 `initializeApp`이 먼저 실행되는지 확인한다.
- `permission-denied`: 설정값보다 해당 서비스의 Rules와 로그인 상태를 먼저 본다.
- 잘못된 프로젝트 데이터가 보임: 환경 변수의 `projectId`와 빌드 환경을 확인한다.
- Vite 값이 `undefined`: 변수 이름의 `VITE_` 접두사와 개발 서버 재시작을 확인한다.

## 7. 요약 정리

- Firebase 프로젝트는 여러 백엔드 서비스를 묶는다.
- 웹 앱 등록으로 SDK 연결용 설정 객체를 얻는다.
- 새 웹 앱은 npm 기반 모듈형 SDK를 사용한다.
- 초기화는 한 모듈에서 수행하고 서비스 instance를 공유한다.
- 웹 설정 객체는 비밀번호가 아니며 보안 규칙을 대신하지 않는다.
- 관리자 자격 증명은 브라우저 코드에 넣지 않는다.
- 개발·운영 프로젝트와 Rules를 분리해 실수를 줄인다.

🧠 기억할 것: Firebase 보안은 설정 객체를 감추는 일이 아니라 인증과 서버에서 평가되는 Security Rules로 권한을 제한하는 일이다.

## 8. 미니 퀴즈

1. Firebase project와 web app은 어떤 관계인가?
2. `VITE_FIREBASE_API_KEY`를 숨기는 것만으로 데이터가 보호되지 않는 이유는 무엇인가?
3. Admin SDK private key를 브라우저 코드에 넣으면 안 되는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 프로젝트가 여러 서비스를 소유하고, 등록된 웹 앱은 SDK가 그 프로젝트에 연결할 설정을 가진다.
2. 실제 데이터 접근 허용 여부는 Authentication과 Security Rules가 결정하기 때문이다.
3. 관리자 키는 높은 권한을 가진 비밀 자격 증명이며 번들에 포함되면 누구나 추출할 수 있기 때문이다.

</details>

## 참고 자료

- [Firebase를 JavaScript 프로젝트에 추가하기](https://firebase.google.com/docs/web/setup)
- [Local Emulator Suite](https://firebase.google.com/docs/emulator-suite)
