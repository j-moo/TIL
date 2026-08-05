# Firebase Auth로 React 보호 경로 만들기

- 🎯 글의 목표: 인증 상태가 확인된 뒤에만 보호 화면을 렌더링하고, 로그인 성공 후 원래 경로로 안전하게 돌아간다.
- 🧩 핵심 키워드: protected route, `Outlet`, `Navigate`, `useLocation`, `useNavigate`, auth loading
- ⭐ 중요도: ★★★★★ — 세션 초기화와 미로그인 상태를 구분하지 않으면 로그인 화면이 깜빡이거나 보호 화면이 잠시 노출될 수 있다.
- 📝 한눈에 보는 내용: AuthProvider가 인증 observer를 한 번 소유한다. 보호 Route는 loading·error·anonymous·authenticated를 나누고, 미로그인 사용자의 원래 경로를 location state에 보관한다. 화면 보호는 사용자 경험이며 실제 데이터 권한은 Firebase Rules가 담당한다.
- 🔗 관련 주제: React Router, Firebase Authentication, Context, Security Rules
- 🧱 선수 지식: 중첩 Route, `Outlet`, AuthProvider

---

## 1. 보호 경로가 해결하는 문제

대시보드 URL을 로그인한 사용자에게만 보여 주고 싶을 수 있다. 하지만 `auth.currentUser`를 렌더링 시점에 한 번 확인하면 세션 복원이 끝나기 전 `null`을 로그아웃으로 오해한다.

```text
보호 URL 접근
   ↓
Auth 상태 확인 중 → 로딩 화면
   ↓
로그인됨 → Outlet에 보호 화면
미로그인 → 로그인 경로로 이동
오류 → 인증 확인 실패 화면
```

## 2. AuthProvider 상태 계약

앞선 Authentication 문서의 Context가 다음 판별 유니언을 제공한다고 가정한다.

```ts
type AuthState =
  | { status: 'loading'; user: null; error: null }
  | { status: 'authenticated'; user: User; error: null }
  | { status: 'anonymous'; user: null; error: null }
  | { status: 'error'; user: null; error: Error }
```

단순한 `User | null`보다 상태를 나누면 “확인 전 null”과 “확인 결과 미로그인”을 TypeScript가 구분한다.

## 3. 보호 Route 컴포넌트

```tsx
// src/routes/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'

export function ProtectedRoute() {
  const authState = useAuth()
  const location = useLocation()

  if (authState.status === 'loading') {
    // 세션 복원이 끝나기 전에는 로그인 화면이나 보호 화면을 확정하지 않는다.
    return <p aria-live="polite">로그인 상태를 확인하는 중…</p>
  }

  if (authState.status === 'error') {
    return <p role="alert">로그인 상태를 확인하지 못했습니다.</p>
  }

  if (authState.status === 'anonymous') {
    // replace는 뒤로 가기에서 같은 보호 경로와 로그인 경로가 반복되는 일을 줄인다.
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  // 인증된 경우에만 중첩된 자식 Route 화면을 이 위치에 렌더링한다.
  return <Outlet />
}
```

보호 경로가 여러 개라면 각 페이지에서 같은 조건을 반복하지 않고 부모 Route 하나에 묶는다.

## 4. Route 구성

```tsx
// src/AppRoutes.tsx
import { Route, Routes } from 'react-router'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { MyNotesPage } from './pages/MyNotesPage'
import { NotFoundPage } from './pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* 로그인 화면은 인증 없이 접근할 수 있다. */}
      <Route path="login" element={<LoginPage />} />

      {/* 이 부모 아래의 모든 자식은 ProtectedRoute 검사를 통과해야 한다. */}
      <Route element={<ProtectedRoute />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="my-notes" element={<MyNotesPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
```

## 5. Provider와 Router 배치

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { AppRoutes } from './AppRoutes'

const container = document.getElementById('root')
if (!container) throw new Error('#root 요소를 찾을 수 없습니다.')

createRoot(container).render(
  <StrictMode>
    {/* Route 컴포넌트가 URL과 location state를 읽을 수 있게 Router를 제공한다. */}
    <BrowserRouter>
      {/* 보호 경로 전체가 같은 Firebase Auth observer 상태를 공유한다. */}
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

AuthProvider를 페이지마다 만들면 observer와 초기화 상태가 중복된다. Router 하위이면서 보호할 Route보다 위인 공통 위치에 한 번 둔다.

## 6. 로그인 성공 후 원래 경로로 돌아가기

```tsx
// src/pages/LoginPage.tsx
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { signIn } from '../auth/auth.service'

type LoginLocationState = {
  from?: unknown
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const routeState = location.state as LoginLocationState | null
  const requestedPath = routeState?.from

  // location state도 외부에서 조작될 수 있으므로 내부 절대 경로만 허용한다.
  const destination = typeof requestedPath === 'string'
    && requestedPath.startsWith('/')
    && !requestedPath.startsWith('//')
      ? requestedPath
      : '/dashboard'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const data = new FormData(event.currentTarget)
    const email = data.get('email')
    const password = data.get('password')

    if (typeof email !== 'string' || typeof password !== 'string') {
      setError('입력값 형식을 확인하세요.')
      return
    }

    setPending(true)
    setError('')

    try {
      await signIn(email.trim(), password)
      // 로그인 경로를 history에 남기지 않고 원래 보호 경로로 교체한다.
      navigate(destination, { replace: true })
    } catch {
      setError('로그인하지 못했습니다. 입력값을 확인하세요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main>
      <h1>로그인</h1>
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
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? '로그인 중…' : '로그인'}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  )
}
```

원래 `/my-notes?page=2`를 열었다면 로그인 성공 후 같은 경로로 돌아간다. `from` 값은 내부 경로인지 검증해 외부 사이트로 보내는 open redirect 문제를 피한다.

## 7. 로그아웃 후 이동

로그아웃은 사용자 클릭으로 발생하므로 이벤트에서 실행하고 성공 뒤 공개 경로로 이동한다.

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { signOutCurrentUser } from '../auth/auth.service'

export function SignOutButton() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    if (pending) return
    setPending(true)

    try {
      await signOutCurrentUser()
      // 로그아웃 뒤 보호 페이지가 history에 남지 않도록 공개 첫 화면으로 교체한다.
      navigate('/', { replace: true })
    } finally {
      setPending(false)
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending}>
      {pending ? '로그아웃 중…' : '로그아웃'}
    </button>
  )
}
```

## 8. 보호 경로가 보안 경계는 아니다

ProtectedRoute는 화면 이동을 제어해 사용자 경험을 개선한다. 하지만 사용자는 React 앱을 거치지 않고 Firestore에 직접 요청할 수 있다.

```text
ProtectedRoute → 어떤 화면을 보여 줄지 결정
Security Rules → 실제 데이터 요청을 허용할지 결정
```

관리자 전용 화면도 role을 숨기는 것만으로 보호할 수 없다. Firebase custom claim이나 서버에서 관리하는 역할 정보와 Rules를 함께 설계한다.

## 9. 흔한 실수

### 새로고침 때 로그인 화면이 잠깐 보인다

Auth 초기화의 `loading`을 `anonymous`와 합쳤기 때문이다. observer의 첫 결과 전에는 전용 로딩 화면을 보여 준다.

### 로그인 뒤에도 다시 로그인 화면으로 온다

- AuthProvider가 Route보다 위에 있는지 확인한다.
- `onAuthStateChanged` observer가 새 User를 전달하는지 본다.
- 로그인 성공 전 `navigate`가 실행되지 않았는지 확인한다.

### 뒤로 가기에서 로그인과 보호 화면이 반복된다

`Navigate`와 로그인 성공 이동에 `{ replace: true }`를 사용했는지 확인한다.

### 화면은 막혔지만 데이터가 읽힌다

ProtectedRoute만 만들고 Firestore Security Rules를 제한하지 않은 상태다. Emulator에서 미로그인 직접 읽기 요청이 실패하는지 테스트한다.

## 10. 적용 관점에서 다시 보기

먼저 공개 경로와 보호 경로를 분류한다. AuthProvider가 초기화 상태를 한 번 소유하게 하고, 보호 부모 Route에서 loading·error·anonymous·authenticated를 모두 처리한다. 마지막으로 데이터 Rules를 별도로 검증한다.

문제가 생기면 현재 URL, Auth 상태, Provider 위치, `Outlet`, location state, Rules 순서로 확인한다.

## 11. 요약 정리

- 보호 경로는 인증된 사용자에게만 특정 React 화면을 보여 준다.
- Auth 초기화 중과 미로그인 상태를 구분한다.
- 여러 보호 페이지는 `ProtectedRoute` 부모 아래에 중첩한다.
- 인증 성공 시 자식 화면은 `Outlet`에 렌더링된다.
- 미로그인 사용자의 원래 내부 경로를 location state에 보관할 수 있다.
- 로그인·로그아웃 후 `replace` 이동으로 history 반복을 줄인다.
- location state의 이동 경로도 검증한다.
- ProtectedRoute는 Security Rules를 대신하지 않는다.

🧠 기억할 것: 보호 경로는 화면의 문이고 Security Rules는 데이터의 자물쇠이므로 둘 다 필요하다.

## 12. 미니 퀴즈

1. Auth 상태에서 loading과 anonymous를 나눠야 하는 이유는 무엇인가?
2. 보호 Route의 자식 화면은 어디에 렌더링되는가?
3. 로그인 성공 뒤 `replace` 이동을 사용하는 이유는 무엇인가?
4. ProtectedRoute만으로 Firestore 데이터가 보호되지 않는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 세션 확인 전 null을 로그아웃으로 오해해 화면이 깜빡이거나 잘못 이동하는 것을 막기 위해서다.
2. `ProtectedRoute`가 반환하는 `<Outlet />` 위치에 렌더링된다.
3. 로그인 화면을 history에서 교체해 뒤로 가기 반복을 줄이기 위해서다.
4. 사용자가 React UI를 우회해 Firebase에 직접 요청할 수 있기 때문이다.

</details>

## 참고 자료

- [React Router Navigate](https://reactrouter.com/api/components/Navigate)
- [React Router 선언형 이동](https://reactrouter.com/start/declarative/navigating)
- [Firebase 사용자 상태 observer](https://firebase.google.com/docs/auth/web/manage-users)
