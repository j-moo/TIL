# TypeScript로 배우는 Firebase 사용자 계정 수명주기

- 🎯 글의 목표: 가입 이후 사용자의 이메일 인증, 프로필 관리, 민감한 작업 재인증, 계정 삭제와 로그인 제공자 연결 흐름을 이해한다.
- 🧩 핵심 키워드: `sendEmailVerification`, `reload`, `updatePassword`, `reauthenticateWithCredential`, `deleteUser`, `linkWithCredential`
- ⭐ 중요도: ★★★★★ — 로그인만 구현한 뒤에는 계정 보안, 개인정보 정리, 제공자 변경까지 고려해야 실제 서비스의 사용자 흐름이 완성된다.
- 📝 한눈에 보는 내용: Firebase Auth의 `User`는 인증 서비스가 관리하는 신원 정보이고, Firestore의 사용자 문서는 애플리케이션이 관리하는 프로필·설정 데이터다. 이메일 인증과 최근 로그인 상태를 확인한 뒤 민감한 작업을 실행하며, 계정 삭제 시 관련 데이터를 별도로 정리한다.
- 🔗 관련 주제: Firebase Authentication, Firestore Security Rules, React 보호 경로, 개인정보 삭제
- 🧱 선수 지식: 이메일·비밀번호 로그인, `onAuthStateChanged`, Firestore 문서 CRUD, TypeScript `Promise`

---

## 1. 로그인 성공 뒤에도 처리할 일이 남아 있다

회원가입과 로그인이 성공했다고 해서 계정 기능이 끝나는 것은 아니다. 사용자는 이메일 주소를 확인할 수 있고, 비밀번호를 바꾸거나 계정을 삭제할 수도 있으며, Google 같은 다른 로그인 방법을 같은 계정에 연결할 수도 있다.

이 기능들은 서로 다른 질문에 답한다.

```text
인증 계정(User)
├─ 이 사용자가 누구인가?          → uid, email, providerData
├─ 이메일을 확인했는가?           → emailVerified
├─ 최근에 다시 로그인했는가?      → 재인증 필요 여부
└─ 어떤 로그인 방법이 연결됐나?   → providerData

애플리케이션 데이터(Firestore)
├─ 화면에 보여 줄 이름·설정은 무엇인가?
├─ 사용자가 만든 학습 메모는 무엇인가?
└─ 계정을 삭제할 때 함께 지울 데이터는 무엇인가?
```

Firebase Auth가 관리하는 User 정보와 Firestore 문서의 프로필 정보는 자동으로 하나의 레코드가 되지 않는다. 따라서 두 영역의 책임과 동기화 시점을 명확히 나누어야 한다.

## 2. Firebase User와 Firestore 프로필 구분하기

### 2.1 Auth User는 인증에 필요한 정보다

`User`의 `uid`는 Firebase 프로젝트 안에서 사용자를 식별하는 고유한 값이다. Security Rules는 보통 이 값을 `request.auth.uid`와 비교해 문서 소유권을 확인한다.

`displayName`, `photoURL`처럼 Auth User에 넣을 수 있는 값은 간단한 표시 정보에 적합하다. 하지만 애플리케이션의 환경 설정, 약관 동의 시각, 알림 설정처럼 서비스가 직접 관리해야 하는 데이터는 Firestore 프로필 문서에 저장하는 편이 분명하다.

### 2.2 프로필 문서는 서비스 데이터다

```text
users/{uid}
├─ displayName: string
├─ timezone: string
├─ termsAcceptedAt: timestamp
└─ createdAt: timestamp
```

프로필 문서의 경로에 Auth의 `uid`를 사용하면 Rules를 단순하게 작성할 수 있다.

```text
// firestore.rules의 개념 예시
match /users/{userId} {
  // 자신의 프로필만 읽고 수정할 수 있도록 한다.
  allow read, update: if request.auth != null
    && request.auth.uid == userId;
}
```

프로필 생성 시점과 Auth 계정 생성 시점이 항상 하나의 원자적 작업으로 묶이는 것은 아니다. 계정 생성은 성공했지만 프로필 쓰기가 실패할 수 있으므로, 로그인 후 “프로필이 없으면 기본 프로필을 생성한다”는 복구 흐름을 설계할 수 있다.

## 3. 이메일 인증 상태 확인하기

### 3.1 인증 메일 보내기

Firebase Console에서 이메일·비밀번호 제공자를 활성화한 뒤 가입 직후 인증 메일을 보낼 수 있다. `sendEmailVerification`은 현재 로그인한 User를 대상으로 동작한다.

```ts
import { sendEmailVerification, type User } from 'firebase/auth'

export async function sendVerificationEmail(user: User): Promise<void> {
  // Firebase Console에서 설정한 이메일 템플릿으로 인증 링크를 보낸다.
  await sendEmailVerification(user)
}
```

메일을 보냈다고 해서 즉시 `user.emailVerified`가 `true`로 바뀌는 것은 아니다. 사용자가 다른 탭이나 메일 앱에서 링크를 누른 뒤, 앱이 최신 사용자 정보를 다시 가져와야 한다.

### 3.2 `reload`로 최신 상태 가져오기

```ts
import { reload, type User } from 'firebase/auth'

export async function refreshEmailVerification(user: User): Promise<boolean> {
  // User 객체에 캐시된 값을 그대로 사용하지 않고 서버의 최신 상태를 요청한다.
  await reload(user)

  // reload 이후 전달받은 객체의 emailVerified 값을 확인한다.
  return user.emailVerified
}
```

인증이 필요한 기능을 열 때는 버튼을 숨기는 것만으로 충분하지 않다. 해당 작업을 수행하는 서버 규칙이나 백엔드에서도 인증 상태를 다시 확인해야 한다. 클라이언트의 안내 화면은 사용성을 위한 것이고, 실제 보호는 접근 계층에서 담당한다.

## 4. 민감한 작업과 최근 로그인

비밀번호 변경, 이메일 주소 변경, 계정 삭제처럼 피해가 큰 작업은 사용자가 오래전에 로그인한 세션만으로 실행하지 않도록 Firebase가 최근 로그인 여부를 검사한다. 오래된 세션이면 `auth/requires-recent-login` 오류가 발생할 수 있다.

이 상황에서 비밀번호를 저장해 두었다가 자동으로 재인증하면 안 된다. 사용자가 현재 화면에서 다시 입력한 자격 증명으로 일회성 재인증을 수행한다.

### 4.1 이메일·비밀번호 사용자를 재인증하기

```ts
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from 'firebase/auth'

export async function reauthenticateWithPassword(
  user: User,
  email: string,
  password: string,
): Promise<void> {
  // 입력받은 비밀번호를 파일, localStorage, 전역 state에 남기지 않는다.
  const credential = EmailAuthProvider.credential(email, password)

  // Firebase가 최근 로그인으로 인정할 수 있도록 새 자격 증명을 제출한다.
  await reauthenticateWithCredential(user, credential)
}
```

재인증 성공은 “앞으로 모든 요청이 영구적으로 안전하다”는 뜻이 아니다. 민감한 작업 직전에 요구되는 최근 로그인 조건을 만족했다는 뜻이므로, 비밀번호나 credential을 저장하지 않고 작업을 바로 수행한다.

### 4.2 비밀번호 변경

```ts
import { updatePassword, type User } from 'firebase/auth'

export async function changePassword(
  user: User,
  newPassword: string,
): Promise<void> {
  // 입력 컴포넌트에서 확인한 새 비밀번호만 전달한다.
  await updatePassword(user, newPassword)
}
```

비밀번호 변경이 `requires-recent-login`으로 실패하면 먼저 재인증 UI를 보여 주고, 재인증이 성공한 뒤 `updatePassword`를 다시 실행한다. 실패 메시지에 Firebase 내부 오류 문자열을 그대로 보여 주기보다 사용자가 다음에 해야 할 행동을 알려 준다.

## 5. 계정 삭제와 데이터 정리

### 5.1 Auth 계정 삭제는 Firestore 삭제와 다르다

`deleteUser(user)`는 Firebase Authentication의 계정을 삭제한다. 사용자가 만든 Firestore 문서나 Storage 파일까지 자동으로 모두 지워 주는 작업으로 이해하면 안 된다.

```text
계정 삭제 요청
    ↓
최근 로그인 상태 확인
    ↓
Auth 사용자 삭제
    ↓
Firestore 프로필·사용자 데이터 정리
    ↓
Storage 파일·외부 서비스 데이터 정리 여부 확인
```

데이터가 많은 서비스라면 브라우저에서 모든 문서를 직접 삭제하려 하지 않는다. 서버 함수나 별도 삭제 작업으로 소유자 데이터를 정리하고, 실패한 단계의 재시도·감사 로그·보존 정책을 함께 설계한다.

### 5.2 계정 삭제 서비스 함수

```ts
import { deleteUser, type User } from 'firebase/auth'

export async function deleteAuthAccount(user: User): Promise<void> {
  // 최근 로그인 조건을 만족하지 않으면 requires-recent-login 오류가 발생할 수 있다.
  await deleteUser(user)
}
```

Auth 계정을 먼저 삭제할지 사용자 데이터를 먼저 삭제할지는 복구 정책에 따라 달라진다. 한쪽만 성공하고 다른 쪽이 실패할 수 있으므로, 실제 서비스에서는 삭제 요청 상태를 기록하고 재시도 가능한 서버 작업으로 만드는 방법을 검토한다.

## 6. React에서 민감한 작업 흐름 표현하기

다음 컴포넌트는 “계정 삭제” 버튼을 누른 뒤 비밀번호를 다시 입력받고 재인증한 다음 계정을 삭제하는 학습용 흐름이다. 실제 서비스에서는 확인 문구, 에러 코드별 안내, 데이터 정리 결과를 더 세밀하게 구성해야 한다.

```tsx
import { useState, type FormEvent } from 'react'
import { auth } from '../lib/firebase'
import {
  deleteAuthAccount,
  reauthenticateWithPassword,
} from './account.service'

export function DeleteAccountForm() {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const user = auth.currentUser
    if (!user || !user.email) {
      setError('로그인한 이메일 계정을 확인할 수 없습니다.')
      return
    }

    setPending(true)
    setError('')

    try {
      // 계정 삭제처럼 위험한 작업 직전에 다시 인증한다.
      await reauthenticateWithPassword(user, user.email, password)
      await deleteAuthAccount(user)
      // 성공하면 Auth observer가 user=null 상태를 전달한다.
      setPassword('')
    } catch (caught) {
      // 비밀번호나 계정 상태를 구체적으로 노출하지 않는 메시지를 사용한다.
      setError(caught instanceof Error ? '재인증 또는 계정 삭제에 실패했습니다.' : '요청을 처리하지 못했습니다.')
    } finally {
      // password state도 요청 직후 비우면 메모리에 오래 남지 않는다.
      setPassword('')
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        현재 비밀번호
        <input
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? '처리 중…' : '계정 삭제'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

위 예제에서 비밀번호를 state에 잠시 담는 것은 제출을 위해 필요하지만, 로그·URL·localStorage에는 기록하지 않는다. 소셜 로그인 사용자처럼 비밀번호가 없는 계정은 이메일 재인증 대신 해당 제공자의 재인증 흐름을 사용해야 한다.

## 7. 로그인 제공자 연결

### 7.1 왜 계정을 연결하는가?

이메일·비밀번호로 만든 계정에 Google 로그인 방법을 연결하면 사용자는 같은 Firebase `uid`로 두 방법을 사용할 수 있다. 새 Google 로그인 계정을 별도로 만들면 기존 Firestore 데이터가 다른 uid에 묶일 수 있으므로, 계정 연결은 데이터 소유권과 직접 관련된다.

### 7.2 Google 제공자 연결 예시

```ts
import {
  GoogleAuthProvider,
  linkWithPopup,
  type User,
} from 'firebase/auth'

export async function linkGoogleProvider(user: User): Promise<User> {
  const provider = new GoogleAuthProvider()

  // 현재 로그인한 User에 Google credential을 연결한다.
  const result = await linkWithPopup(user, provider)
  return result.user
}
```

모바일 환경이나 팝업이 차단된 브라우저에서는 redirect 방식이 더 적절할 수 있다. redirect 방식은 페이지가 다시 로드된 뒤 `getRedirectResult`로 결과를 확인해야 하므로, 로딩 중인 상태와 실패 상태를 별도로 표현한다.

### 7.3 이미 다른 계정에 연결된 credential

Google credential이 이미 다른 Firebase 계정에 연결되어 있으면 `linkWithPopup`은 실패한다. 이때 무조건 두 계정을 합치면 안 된다. 먼저 두 계정의 Firestore 문서와 충돌 가능성을 확인하고, 사용자에게 어떤 계정을 유지할지 안내한 뒤 명시적인 병합 정책을 적용한다.

```text
link 실패
    ↓
이미 연결된 계정인지 확인
    ↓
현재 계정과 기존 계정의 데이터 충돌 검토
    ↓
사용자 동의와 병합 정책 결정
    ↓
필요한 데이터 이전 후 provider 연결 또는 취소
```

### 7.4 providerData로 연결 상태 표시하기

```tsx
import type { User } from 'firebase/auth'

export function LinkedProviders({ user }: { user: User }) {
  return (
    <ul>
      {user.providerData.map(provider => (
        <li key={provider.providerId}>
          {provider.providerId}
        </li>
      ))}
    </ul>
  )
}
```

연결을 해제할 때는 사용자가 로그인할 수 있는 다른 방법이 최소 하나 남는지 확인한다. 마지막 로그인 방법까지 해제하면 계정에 다시 들어갈 방법을 잃을 수 있다.

## 8. 계정 기능별 책임 나누기

| 기능 | Auth User | Firestore / 서버 | 추가 확인 |
| --- | --- | --- | --- |
| 이메일 인증 | `emailVerified`와 인증 메일 | 이메일 인증을 요구하는 Rules·백엔드 정책 | `reload`로 최신 상태 확인 |
| 표시 이름 | `displayName` 또는 프로필 문서 | 서비스 전용 설정·약관 동의 | 입력값 길이·형식 검증 |
| 비밀번호 변경 | `updatePassword` | 비밀번호 자체를 저장하지 않음 | 최근 로그인·재인증 |
| 계정 삭제 | `deleteUser` | 프로필·메모·파일 정리 | 실패 재시도·보존 정책 |
| Google 연결 | `linkWithPopup` 등 | 같은 uid의 데이터 유지 | 계정 충돌·병합 정책 |

Auth는 로그인 제공자와 신원을 관리하고, 애플리케이션 서버나 Firestore는 서비스 데이터를 관리한다. 한 계층의 성공을 다른 계층의 삭제·정리까지 완료했다는 뜻으로 해석하지 않는다.

## 9. 자주 발생하는 문제와 확인 순서

### 9.1 이메일을 클릭했는데도 미인증으로 보인다

인증 링크를 누른 뒤 현재 User 객체가 오래된 상태일 수 있다. `reload(user)`를 실행한 다음 `emailVerified`를 읽고, React에서는 탭이 다시 활성화될 때 갱신하는 흐름을 검토한다.

### 9. 비밀번호 변경이나 삭제가 실패한다

오류 코드가 `auth/requires-recent-login`인지 확인한다. 비밀번호를 저장해 자동 재시도하지 말고, 현재 화면에서 다시 입력받은 credential로 재인증한 뒤 한 번만 작업을 다시 실행한다.

### 9. 계정 삭제 후 메모가 남아 있다

Auth 사용자 삭제와 Firestore·Storage 데이터 삭제는 별도 작업이다. 사용자 uid를 기준으로 정리 대상 경로를 설계하고, 서버 작업의 성공·실패와 재시도 상태를 기록한다.

### 9. Google 연결 후 데이터가 사라진 것처럼 보인다

새 계정을 만든 것이 아닌지 uid를 비교한다. `linkWithPopup`은 기존 User에 provider를 연결하지만, 단순히 `signInWithPopup`을 실행하면 다른 계정으로 로그인할 수 있다.

### 9. provider를 해제한 뒤 다시 연결되지 않는다

해제한 provider로 다시 로그인하면 원래 계정에 자동 복귀하지 않고 새 계정이 만들어질 수 있다. 해제 전 남은 로그인 방법과 복구 방법을 사용자에게 안내한다.

## 10. 적용 관점에서 다시 보기

계정 설정 화면을 만들기 전에 Auth User에 저장할 값과 Firestore 프로필에 저장할 값을 표로 나눈다. 이메일 인증이 필요한 기능, 최근 로그인이 필요한 기능, 계정 삭제 때 함께 지워야 하는 데이터를 각각 표시한다.

구현 순서는 다음처럼 잡을 수 있다.

1. 로그인 제공자와 현재 User를 확인한다.
2. 이메일 인증 또는 최근 로그인 조건을 검사한다.
3. 민감한 작업이면 재인증 UI를 보여 준다.
4. Auth 작업과 Firestore·Storage 정리 작업의 책임을 나눈다.
5. 성공·실패·재시도 상태를 사용자에게 표현한다.
6. Emulator와 테스트 계정으로 정상·실패·중복 계정 사례를 검증한다.

## 11. 배운 점과 확장 방향

### 11.1 새로 이해한 것

로그인은 단일 이벤트가 아니라 계정의 전체 생명주기 중 한 단계다. 이메일 인증, credential 재확인, provider 연결, 계정 삭제는 모두 “현재 사용자가 무엇을 증명했고 어떤 데이터가 영향을 받는가”를 기준으로 설계한다.

### 11.2 이전·다음 학습과의 연결

앞서 작성한 보호 경로는 로그인 상태를 화면에 반영하는 데 초점을 둔다. 이 문서는 그 안에서 계정 설정과 삭제처럼 더 높은 위험을 가진 행동을 어떻게 보호할지 다룬다. 다음에는 App Check와 GitHub Actions를 연결해 앱 출처 확인과 자동 Rules 테스트를 확장할 수 있다.

### 11.3 더 확인할 주제

- 다중 인증(MFA)과 복구 코드
- 이메일 action code의 커스텀 처리
- 사용자 삭제 요청의 서버 작업·보존 정책
- Admin SDK와 클라이언트 SDK의 권한 차이

## 12. 요약 정리

- Firebase Auth의 `User`와 Firestore 프로필 문서는 서로 다른 저장 영역이다.
- 이메일 인증 메일을 보낸 뒤에는 `reload`로 최신 `emailVerified` 값을 확인한다.
- 비밀번호 변경·이메일 변경·계정 삭제는 최근 로그인 상태가 필요할 수 있다.
- 재인증 credential은 사용자가 다시 입력한 순간에만 사용하고 저장하지 않는다.
- Auth 계정을 삭제해도 Firestore 문서와 Storage 파일이 자동으로 정리된다고 가정하지 않는다.
- 계정 삭제는 부분 성공과 재시도를 고려한 데이터 정리 흐름으로 설계한다.
- provider 연결은 기존 uid와 데이터를 유지하기 위한 기능이며 단순 로그인과 다르다.
- 이미 다른 계정에 연결된 credential은 데이터 병합 정책을 결정한 뒤 처리한다.
- provider를 해제할 때 최소 하나의 로그인 방법이 남는지 확인한다.
- 클라이언트 안내는 사용성을 위한 것이고, 데이터 접근 권한은 Rules와 서버에서 다시 검사한다.

🧠 기억할 것: **인증 계정을 바꾸는 작업과 서비스 데이터를 정리하는 작업은 별개이므로, 두 흐름의 성공·실패를 각각 관리해야 한다.**

## 13. 미니 퀴즈

1. `emailVerified`가 즉시 갱신되지 않을 수 있는 이유와 확인 방법은 무엇인가?
2. `auth/requires-recent-login` 오류가 의미하는 것은 무엇인가?
3. Auth 계정을 삭제하면 Firestore의 사용자 메모도 자동 삭제되는가?
4. `linkWithPopup`과 `signInWithPopup`은 어떤 점이 다른가?
5. 이미 다른 계정에 연결된 Google credential을 발견했을 때 바로 계정을 합치면 안 되는 이유는 무엇인가?
6. Firestore 프로필 문서 경로에 Auth `uid`를 사용하는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 인증 링크를 누른 뒤 User 객체가 이전 상태일 수 있기 때문이다. `reload(user)` 후 `emailVerified`를 다시 읽는다.
2. 민감한 작업을 허용하기에 마지막 로그인 시점이 오래되어 새 credential로 재인증해야 한다는 뜻이다.
3. 아니다. Auth, Firestore, Storage 데이터는 별도의 삭제 정책과 작업으로 정리해야 한다.
4. `signInWithPopup`은 로그인할 계정을 바꾸고, `linkWithPopup`은 현재 로그인한 User에 새 provider를 연결한다.
5. 두 계정의 메모와 파일이 서로 다른 uid에 묶여 있을 수 있어 데이터 손실과 소유권 충돌이 발생할 수 있기 때문이다.
6. `request.auth.uid == userId` 형태로 Rules의 소유자 검사를 단순하고 일관되게 작성할 수 있기 때문이다.

</details>

## 참고 자료

- [Firebase 웹 사용자 관리](https://firebase.google.com/docs/auth/web/manage-users)
- [여러 Auth 제공자 계정 연결](https://firebase.google.com/docs/auth/web/account-linking)
- [Firebase 웹 Auth JavaScript API reference](https://firebase.google.com/docs/reference/js/auth)
- [Firebase Authentication 이메일·비밀번호](https://firebase.google.com/docs/auth/web/password-auth)
