# TypeScript로 배우는 Firebase Authentication

- 🎯 글의 목표: 이메일·비밀번호 계정을 생성하고 로그인·로그아웃·세션 복원 상태를 React에서 안전하게 관리한다.
- 🧩 핵심 키워드: Authentication, `User`, `onAuthStateChanged`, sign up, sign in, sign out
- ⭐ 중요도: ★★★★★ — 사용자별 데이터 권한을 적용하려면 먼저 신뢰할 수 있는 사용자 식별자가 필요하다.
- 📝 한눈에 보는 내용: Firebase Auth가 계정과 세션을 관리하고 React는 현재 상태를 화면에 표현한다. 가입·로그인은 사용자 이벤트에서 실행하며, 현재 사용자는 observer로 구독한다. 로그인 여부는 신원 확인일 뿐 데이터 접근 권한 자체는 아니다.
- 🔗 관련 주제: Firestore Security Rules, React Context, 보호 경로
- 🧱 선수 지식: Firebase 초기화, React 폼, Promise

---

## 1. 인증과 권한은 다르다

**인증(Authentication)**은 “누구인가?”를 확인한다. **인가(Authorization)**는 “무엇을 할 수 있는가?”를 결정한다.

```text
이메일·비밀번호 제출
        ↓
Firebase Authentication이 계정 확인
        ↓
User와 uid 발급
        ↓
Security Rules가 uid를 이용해 데이터 접근 허용·거부
```

로그인 버튼을 숨겼다고 데이터가 보호되는 것은 아니다. 브라우저 UI를 우회한 직접 요청도 있으므로 실제 권한은 Security Rules가 검사해야 한다.

## 2. 사용 전 설정

Firebase Console의 Authentication에서 이메일·비밀번호 로그인 제공자를 활성화한다. 프로젝트에는 이미 `firebase` 패키지와 초기화 모듈이 있다고 가정한다.

```ts
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

// 같은 Auth instance를 폼과 Provider가 함께 사용한다.
export const auth = getAuth(firebaseApp)
```

## 3. 인증 서비스 함수 분리하기

```ts
// src/auth/auth.service.ts
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

export async function signUp(email: string, password: string): Promise<User> {
  // Firebase에 새 계정을 만들며, 성공하면 해당 사용자로 자동 로그인된다.
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signIn(email: string, password: string): Promise<User> {
  // 입력한 자격 증명이 맞으면 현재 세션의 User를 반환한다.
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export function signOutCurrentUser(): Promise<void> {
  // 성공 후 onAuthStateChanged observer에도 user=null이 전달된다.
  return signOut(auth)
}

export function requestPasswordReset(email: string): Promise<void> {
  // Firebase가 구성된 이메일 템플릿을 사용해 재설정 메일을 보낸다.
  return sendPasswordResetEmail(auth, email)
}
```

서비스 함수는 React state를 직접 바꾸지 않는다. 화면은 성공·실패를 받아 pending과 오류 메시지를 결정한다.

## 4. 가입 폼 구현하기

```tsx
import { useState, type FormEvent } from 'react'
import { signUp } from './auth.service'

export function SignUpForm() {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const form = event.currentTarget
    const data = new FormData(form)
    const email = data.get('email')
    const password = data.get('password')
    const passwordConfirm = data.get('passwordConfirm')

    // FormData에는 File이나 null도 들어올 수 있으므로 문자열인지 먼저 검사한다.
    if (
      typeof email !== 'string'
      || typeof password !== 'string'
      || typeof passwordConfirm !== 'string'
    ) {
      setMessage('입력값 형식을 확인하세요.')
      return
    }

    if (password !== passwordConfirm) {
      setMessage('비밀번호 확인 값이 일치하지 않습니다.')
      return
    }

    setPending(true)
    setMessage('')

    try {
      await signUp(email.trim(), password)
      // 가입 성공과 동시에 로그인되므로 별도 signIn 호출은 필요하지 않다.
      form.reset()
      setMessage('계정을 만들었습니다.')
    } catch {
      // 계정 존재 여부를 지나치게 자세히 노출하지 않는 공통 메시지를 사용한다.
      setMessage('계정을 만들지 못했습니다. 입력값을 확인하세요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        이메일
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label>
        비밀번호 확인
        <input
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      {/* 요청 중 버튼을 막아 같은 계정 생성 요청이 반복되지 않게 한다. */}
      <button type="submit" disabled={pending}>
        {pending ? '가입 중…' : '회원가입'}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  )
}
```

HTML `minLength`는 사용자 피드백을 돕지만 보안 정책이 아니다. Firebase Console의 비밀번호 정책과 서비스 요구 조건을 함께 구성한다.

## 5. AuthProvider로 초기화 상태까지 관리하기

`auth.currentUser`는 Firebase Auth 초기화가 끝나기 전에도 `null`일 수 있다. observer를 사용하면 “아직 확인 중”과 “확인 결과 로그아웃”을 구분할 수 있다.

```tsx
// src/auth/AuthProvider.tsx
import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { auth } from '../lib/firebase'

type AuthState =
  | { status: 'loading'; user: null; error: null }
  | { status: 'authenticated'; user: User; error: null }
  | { status: 'anonymous'; user: null; error: null }
  | { status: 'error'; user: null; error: Error }

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    error: null,
  })

  useEffect(() => {
    // 초기 세션 확인과 이후 로그인·로그아웃 변화를 한 observer가 전달한다.
    const unsubscribe = onAuthStateChanged(
      auth,
      user => {
        setState(user
          ? { status: 'authenticated', user, error: null }
          : { status: 'anonymous', user: null, error: null })
      },
      error => setState({ status: 'error', user: null, error }),
    )

    // Provider가 사라지면 observer를 해제해 callback이 남지 않게 한다.
    return unsubscribe
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext)
  if (state === null) {
    throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.')
  }
  return state
}
```

## 6. 로그아웃 버튼

```tsx
import { useState } from 'react'
import { signOutCurrentUser } from './auth.service'

export function SignOutButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    if (pending) return
    setPending(true)
    setError('')

    try {
      await signOutCurrentUser()
      // 별도 user state를 직접 null로 만들지 않아도 observer가 변경을 전달한다.
    } catch {
      setError('로그아웃하지 못했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button type="button" onClick={handleClick} disabled={pending}>
        {pending ? '로그아웃 중…' : '로그아웃'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
```

## 7. 보안과 사용자 경험 점검

- 로그인 오류에 “해당 이메일이 존재하지 않는다”처럼 계정 존재 여부를 그대로 노출하지 않는다.
- 비밀번호를 state, localStorage, 로그, URL query string에 저장하지 않는다.
- 사용자 `displayName` 같은 값도 신뢰하지 말고 React의 기본 escaping을 유지한다.
- 중요한 작업은 이메일 인증, 최근 로그인, 다중 인증 같은 추가 요구를 검토한다.
- 클라이언트가 가진 uid만 믿지 않고 Rules의 `request.auth.uid`로 다시 확인한다.

## 8. 적용 관점에서 다시 보기

먼저 사용할 로그인 제공자를 Console에서 활성화한다. 인증 서비스 함수와 AuthProvider를 분리하고, 화면은 pending·오류·성공 상태를 표현한다. 데이터 권한은 이어지는 Security Rules에서 설정한다.

로그인 상태가 예상과 다르면 Firebase project, 제공자 활성화 여부, Auth 초기화, observer 상태, 브라우저 콘솔의 오류 코드를 순서대로 확인한다.

## 9. 요약 정리

- 인증은 사용자 신원을 확인하고, 인가는 작업 권한을 결정한다.
- 이메일 가입 성공 후 해당 계정으로 자동 로그인된다.
- 현재 사용자는 `onAuthStateChanged` observer로 확인한다.
- `loading`과 `anonymous`를 같은 `user=null`로 처리하지 않는다.
- 가입·로그인·로그아웃은 사용자 이벤트에서 실행한다.
- 비밀번호를 직접 저장하거나 로그에 출력하지 않는다.
- Auth Context는 상태 전달 도구이며 Security Rules를 대신하지 않는다.

🧠 기억할 것: 로그인 성공은 사용자를 식별했다는 뜻이며, 그 사용자가 어떤 데이터를 다룰 수 있는지는 별도의 Rules가 결정한다.

## 10. 미니 퀴즈

1. 인증과 인가의 차이는 무엇인가?
2. `auth.currentUser === null`만으로 로그아웃 상태를 확정하면 안 되는 이유는 무엇인가?
3. 가입 성공 직후 다시 로그인 함수를 호출할 필요가 없는 이유는 무엇인가?
4. AuthProvider의 cleanup은 무엇을 수행하는가?

<details>
<summary>정답과 해설</summary>

1. 인증은 사용자의 신원, 인가는 허용할 작업을 확인한다.
2. Auth 초기화가 아직 끝나지 않은 중간 상태에서도 null일 수 있기 때문이다.
3. `createUserWithEmailAndPassword`가 계정을 만들고 그 사용자로 로그인하기 때문이다.
4. `onAuthStateChanged` observer를 해제한다.

</details>

## 참고 자료

- [Firebase 이메일·비밀번호 인증](https://firebase.google.com/docs/auth/web/password-auth)
- [Firebase 사용자 관리](https://firebase.google.com/docs/auth/web/manage-users)
