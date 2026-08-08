# Firebase Emulator Suite로 Security Rules 테스트하기

- 🎯 글의 목표: 운영 데이터에 접근하지 않고 Firestore·Authentication을 로컬에서 실행하며 Rules의 허용·거부 사례를 자동 검증한다.
- 🧩 핵심 키워드: Local Emulator Suite, demo project, `connectFirestoreEmulator`, Rules unit test
- ⭐ 중요도: ★★★★★ — 보안 규칙은 정상 요청만 확인해서는 부족하고 공격적인 요청이 실제로 거부되는지 반복 검증해야 한다.
- 📝 한눈에 보는 내용: CLI로 Emulator를 실행하고 개발 앱만 로컬 주소에 연결한다. 테스트에서는 사용자별 인증 context를 만들고 `assertSucceeds`와 `assertFails`로 양쪽 경계를 검사한다. 가능하면 실제 리소스가 없는 `demo-` 프로젝트 id를 사용한다.
- 🔗 관련 주제: Firestore Security Rules, Vitest, Firebase Auth
- 🧱 선수 지식: npm script, Firestore CRUD, 테스트의 Arrange·Act·Assert

---

## 1. Emulator를 사용하는 이유

Console에서 Rules를 직접 바꾸며 확인하면 실제 데이터나 권한에 영향을 줄 수 있다. Local Emulator Suite는 Firebase 서비스의 로컬 구현을 제공해 수동 실습과 자동 테스트를 운영 환경에서 분리한다.

```text
Vitest 또는 개발 앱
        ↓
로컬 Auth·Firestore Emulator
        ↓
로컬 firestore.rules 평가
        ↓
허용·거부 결과 확인

운영 Firebase 데이터에는 접근하지 않음
```

Emulator는 개발·테스트 도구이며 자체 운영 Firebase 서버로 배포하는 제품이 아니다.

## 2. 설치 전 확인

Firestore Emulator는 Java가 필요하다. 공식 문서는 향후 Cloud Firestore Emulator가 Java 21을 요구할 예정이라고 안내하므로, 새로 환경을 구성한다면 Java 21 이상을 준비하는 편이 안전하다.

```bash
# 프로젝트 폴더에서 Node.js와 Java 설치 상태를 확인한다.
node --version
java --version

# 프로젝트별 버전을 고정할 수 있도록 Firebase CLI를 개발 의존성으로 설치한다.
npm install --save-dev firebase-tools

# Rules 테스트 전용 패키지와 Vitest를 설치한다.
npm install --save-dev @firebase/rules-unit-testing vitest
```

전역 CLI가 있더라도 프로젝트에서는 `npx firebase`로 로컬 버전을 실행하면 팀과 CI가 같은 버전을 사용하기 쉽다.

## 3. Emulator 초기 설정

```bash
# Firebase 설정 파일을 만들고 Firestore와 Emulator 항목을 선택한다.
npx firebase init firestore emulators
```

설정 과정에서는 Firestore Emulator와 Authentication Emulator를 선택하고 기본 port를 사용할 수 있다. 생성된 설정은 다음과 비슷하다.

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true }
  }
}
```

`firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`은 테스트와 배포 설정이므로 저장소에서 함께 관리한다. 개인 자격 증명 파일은 커밋하지 않는다.

## 4. 개발 앱을 Emulator에만 연결하기

```ts
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const firestore = getFirestore(app)

const useEmulator = import.meta.env.DEV
  && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'

if (useEmulator) {
  // localhost 대신 명시적인 IPv4 주소를 사용해 환경별 해석 차이를 줄인다.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  })
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
}
```

```dotenv
# .env.development.local
VITE_USE_FIREBASE_EMULATOR=true
VITE_FIREBASE_PROJECT_ID=demo-til
```

`demo-` 접두사 프로젝트는 실제 Firebase 리소스가 없어 실행 중인 Emulator가 없는 서비스로 잘못 요청해도 운영 데이터에 닿지 않는다. 여러 Emulator가 서로 연동할 때 앱, CLI, 테스트의 project id를 같게 맞춘다.

## 5. 실행 명령

```json
{
  "scripts": {
    "emulators": "firebase emulators:start --only auth,firestore",
    "test:rules": "firebase emulators:exec --only firestore \"vitest run src/rules-tests\""
  }
}
```

```bash
# 수동 개발: Emulator를 계속 실행하고 별도 터미널에서 Vite를 시작한다.
npm run emulators

# 자동 테스트: Emulator 실행 → 테스트 → Emulator 종료를 한 명령으로 수행한다.
npm run test:rules
```

`emulators:exec`를 사용하면 테스트 종료 뒤 프로세스가 정리되어 CI에서도 사용하기 좋다.

## 6. Rules 테스트 환경 구성

다음 코드는 `firestore.rules`가 사용자 본인의 `studyNotes`만 허용한다고 가정한다.

```ts
// src/rules-tests/firestore.rules.test.ts
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'

let testEnv: RulesTestEnvironment

const validNote = {
  ownerId: 'user-a',
  topic: 'Security Rules',
  summary: '허용 요청과 거부 요청을 함께 검사한다.',
  createdAt: Timestamp.now(),
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    // 실제 리소스가 없는 demo project id를 테스트 전체에서 공유한다.
    projectId: 'demo-til',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})

beforeEach(async () => {
  // 각 테스트가 이전 테스트의 문서에 영향을 받지 않도록 초기화한다.
  await testEnv.clearFirestore()
})

afterAll(async () => {
  // 테스트 SDK의 연결을 닫아 Vitest 프로세스가 정상 종료되게 한다.
  await testEnv.cleanup()
})

describe('studyNotes Rules', () => {
  it('로그인 사용자는 자신의 ownerId로 문서를 만들 수 있다', async () => {
    // 이 context에서 Rules의 request.auth.uid는 user-a가 된다.
    const db = testEnv.authenticatedContext('user-a').firestore()

    await assertSucceeds(
      setDoc(doc(db, 'studyNotes', 'note-1'), validNote),
    )
  })

  it('로그인하지 않은 사용자의 생성 요청은 거부한다', async () => {
    const db = testEnv.unauthenticatedContext().firestore()

    await assertFails(
      setDoc(doc(db, 'studyNotes', 'note-1'), validNote),
    )
  })

  it('다른 사용자의 uid를 ownerId로 가장할 수 없다', async () => {
    const db = testEnv.authenticatedContext('user-b').firestore()

    // user-b가 ownerId=user-a인 문서를 만들려 하므로 실패해야 한다.
    await assertFails(
      setDoc(doc(db, 'studyNotes', 'note-1'), validNote),
    )
  })

  it('소유자는 자신의 문서를 읽을 수 있고 타인은 읽을 수 없다', async () => {
    // 준비 데이터는 Rules를 잠시 끈 관리자 context에서 넣는다.
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(
        doc(context.firestore(), 'studyNotes', 'note-1'),
        validNote,
      )
    })

    const ownerDb = testEnv.authenticatedContext('user-a').firestore()
    const strangerDb = testEnv.authenticatedContext('user-b').firestore()

    await assertSucceeds(getDoc(doc(ownerDb, 'studyNotes', 'note-1')))
    await assertFails(getDoc(doc(strangerDb, 'studyNotes', 'note-1')))
  })

  it('소유자라도 ownerId 변경은 거부한다', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(
        doc(context.firestore(), 'studyNotes', 'note-1'),
        validNote,
      )
    })

    const db = testEnv.authenticatedContext('user-a').firestore()

    await assertFails(
      setDoc(
        doc(db, 'studyNotes', 'note-1'),
        { ownerId: 'user-b' },
        { merge: true },
      ),
    )
  })
})
```

보안 테스트에서는 성공 사례보다 실패 사례가 더 중요할 수 있다. 미로그인, 다른 사용자, 누락 필드, 초과 길이, 금지 필드 수정, 허용되지 않은 query를 각각 검증한다.

## 7. Arrange·Act·Assert로 읽기

위 테스트의 구조는 다음과 같다.

1. Arrange: 관리자 context로 필요한 문서를 준비한다.
2. Act: 특정 uid를 가진 context에서 실제 SDK 요청을 만든다.
3. Assert: `assertSucceeds` 또는 `assertFails`로 Rules 결과를 확인한다.

관리자 context는 테스트 데이터 준비에만 사용한다. 실제 검증 요청까지 `withSecurityRulesDisabled` 안에서 실행하면 Rules를 전혀 테스트하지 않게 된다.

## 8. 자주 발생하는 문제

### Emulator 대신 운영 서비스에 연결된다

- `import.meta.env.DEV`와 emulator 환경 변수 값을 확인한다.
- 연결 함수가 Firebase 서비스 사용보다 먼저 호출되는지 본다.
- 가능하면 실제 리소스가 없는 `demo-` project id를 사용한다.

### 테스트가 연결 오류로 실패한다

- `emulators:exec` 또는 `emulators:start`로 Firestore Emulator가 실행 중인지 확인한다.
- 기본 port 8080이 다른 프로세스와 충돌하지 않는지 본다.
- Firebase CLI와 테스트의 project id가 같은지 확인한다.

### 모든 요청이 허용된다

- `firebase.json`의 `firestore.rules` 경로가 실제 파일을 가리키는지 확인한다.
- 테스트 초기화에 Rules 내용을 전달했는지 확인한다.
- 검증 요청을 Rules-disabled context로 실행하지 않았는지 본다.

## 9. 적용 관점에서 다시 보기

Rules를 작성할 때마다 최소 한 개의 허용 사례와 여러 거부 사례를 함께 만든다. 테스트는 독립적으로 초기화하고 실제 사용자 context로 요청한다. 수동 확인 후 자동 테스트를 CI에서 반복한다.

Emulator 통과는 운영 배포 자체를 의미하지 않는다. 배포할 Rules 파일과 테스트한 파일이 같은지 확인하고 배포 후에도 Firebase Console의 Rules 버전을 점검한다.

## 10. 요약 정리

- Emulator Suite는 Firebase 서비스를 로컬에서 모방하는 개발·테스트 도구다.
- 가능하면 실제 리소스가 없는 `demo-` project id를 사용한다.
- 개발 환경에서만 SDK를 Emulator 주소에 연결한다.
- `@firebase/rules-unit-testing`은 인증 사용자를 모의할 수 있다.
- 각 테스트 전에 데이터를 비워 독립성을 유지한다.
- `assertSucceeds`와 `assertFails`로 권한 경계 양쪽을 검증한다.
- Rules-disabled context는 준비 데이터 생성에만 사용한다.
- 미로그인·타인·금지 필드 같은 실패 사례를 반드시 포함한다.

🧠 기억할 것: 안전한 Rules는 정상 기능이 작동하는 규칙이 아니라, 허용할 요청만 성공하고 나머지는 확실히 실패하는 규칙이다.

## 11. 미니 퀴즈

1. `demo-` project id가 더 안전한 이유는 무엇인가?
2. `withSecurityRulesDisabled`는 어떤 용도로만 사용해야 하는가?
3. 각 테스트 전에 `clearFirestore()`를 호출하는 이유는 무엇인가?
4. Rules 테스트에 실패 사례가 필요한 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 실제 Firebase 리소스가 없어 잘못 연결해도 운영 데이터와 비용에 영향을 주지 않기 때문이다.
2. 테스트에 필요한 준비 데이터를 Rules와 무관하게 넣는 용도로 사용한다.
3. 이전 테스트 데이터가 다음 결과에 영향을 주지 않도록 독립성을 확보하기 위해서다.
4. 보안 규칙의 핵심은 공격적이거나 권한 없는 요청을 거부하는 것이기 때문이다.

</details>

## 참고 자료

- [Firebase Emulator Suite 소개](https://firebase.google.com/docs/emulator-suite)
- [Emulator 설치와 구성](https://firebase.google.com/docs/emulator-suite/install_and_configure)
- [Firestore Emulator 연결](https://firebase.google.com/docs/emulator-suite/connect_firestore)
- [Security Rules 단위 테스트](https://firebase.google.com/docs/rules/unit-tests)
