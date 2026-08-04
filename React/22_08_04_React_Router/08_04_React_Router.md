# TypeScript로 배우는 React Router

- 🎯 글의 목표: URL과 화면을 연결하고, 중첩 레이아웃·동적 경로·없는 페이지를 타입 안전하게 구성한다.
- 🧩 핵심 키워드: `BrowserRouter`, `Routes`, `Route`, `Outlet`, `Link`, `useParams`
- ⭐ 중요도: ★★★★★ — 화면이 여러 개인 SPA에서는 URL이 현재 화면 상태를 설명해야 새로고침과 뒤로 가기가 자연스럽게 동작한다.
- 📝 한눈에 보는 내용: 라우터는 현재 URL을 읽어 일치하는 컴포넌트를 선택한다. 부모 경로의 공통 UI는 `Outlet`으로 자식 화면을 받을 수 있고, `:id` 같은 동적 값은 항상 검증한 뒤 사용한다.
- 🔗 관련 주제: SPA, History API, 데이터 패칭, 중첩 레이아웃
- 🧱 선수 지식: 컴포넌트, Props, 조건부 렌더링

---

## 1. 들어가며

조건문만으로 목록 화면과 상세 화면을 바꾸면 주소창은 그대로다. 사용자는 특정 상세 화면을 북마크할 수 없고, 새로고침하거나 뒤로 가기를 눌렀을 때 기대한 화면으로 돌아가기 어렵다.

라우팅은 **URL을 애플리케이션 상태의 일부로 사용**하는 방법이다. React Router는 브라우저 URL과 React 컴포넌트를 연결하지만, 데이터나 전역 state까지 자동으로 관리하지는 않는다.

## 2. 핵심 흐름

```text
사용자가 링크를 선택한다
        ↓
브라우저의 URL이 바뀐다
        ↓
라우터가 Route 중 일치하는 경로를 찾는다
        ↓
부모 레이아웃의 Outlet에 자식 화면을 렌더링한다
```

## 3. 기본 라우팅

### 3.1 설치와 진입점

```bash
# Vite 프로젝트의 package.json이 있는 폴더에서 실행한다.
npm install react-router
```

```tsx
// main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'

const container = document.getElementById('root')

// index.html에 #root가 없으면 이후 렌더링이 불가능하므로 즉시 원인을 알린다.
if (!container) {
  throw new Error('#root 요소를 찾을 수 없습니다.')
}

createRoot(container).render(
  <StrictMode>
    {/* BrowserRouter는 주소 변경을 감지하고 하위 Route가 현재 URL을 읽게 한다. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

`BrowserRouter`는 브라우저 History API를 사용하는 선언형 라우터다. 앱 전체에서 한 번만 감싸는 것이 기본이며, 테스트에서는 메모리 기반 라우터를 별도로 사용할 수 있다.

### 3.2 중첩 경로와 공통 레이아웃

```tsx
// App.tsx
import { Link, Outlet, Route, Routes } from 'react-router'

function AppLayout() {
  return (
    <>
      <header>
        <h1>학습 일정</h1>
        <nav aria-label="주요 메뉴">
          {/* a 태그 대신 Link를 쓰면 전체 문서를 다시 받지 않고 SPA 안에서 이동한다. */}
          <Link to="/">홈</Link>{' '}
          <Link to="/sessions">학습 목록</Link>
        </nav>
      </header>

      <main>
        {/* 현재 URL과 일치한 자식 Route의 element가 이 위치에 들어온다. */}
        <Outlet />
      </main>
    </>
  )
}

function HomePage() {
  return <p>오늘 학습할 내용을 선택하세요.</p>
}

function SessionListPage() {
  return <p>학습 목록 화면</p>
}

function NotFoundPage() {
  return <h2>요청한 페이지를 찾을 수 없습니다.</h2>
}

export default function App() {
  return (
    <Routes>
      {/* path가 없는 부모 Route는 여러 화면이 공유할 레이아웃을 제공한다. */}
      <Route element={<AppLayout />}>
        {/* index Route는 부모 경로인 /에서 기본으로 보이는 자식이다. */}
        <Route index element={<HomePage />} />
        <Route path="sessions" element={<SessionListPage />} />
        {/* 별표는 앞의 경로에 하나도 일치하지 않은 모든 URL을 받는다. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
```

중첩 Route의 자식 경로에는 보통 `/`를 앞에 붙이지 않는다. `sessions`는 부모 경로를 기준으로 이어지고, `/sessions`처럼 절대 경로를 사용하면 부모와의 결합 방식이 달라진다.

## 4. 동적 경로와 매개변수 검증

목록의 각 항목은 `/sessions/abc-123`처럼 서로 다른 URL을 가져야 한다. 경로의 `:sessionId` 부분을 **동적 세그먼트**라고 한다.

```tsx
import { Link, Route, Routes, useParams } from 'react-router'

type StudySession = {
  id: string
  topic: string
}

const sessions: StudySession[] = [
  { id: 'react-state', topic: 'React state 복습' },
  { id: 'ts-union', topic: 'TypeScript 유니언' },
]

function SessionListPage() {
  return (
    <ul>
      {sessions.map(session => (
        <li key={session.id}>
          {/* 실제 데이터의 안정적인 id를 URL에 넣어 상세 화면을 식별한다. */}
          <Link to={`/sessions/${session.id}`}>{session.topic}</Link>
        </li>
      ))}
    </ul>
  )
}

function SessionDetailPage() {
  // URL은 외부 입력이므로 sessionId는 string | undefined로 다룬다.
  const { sessionId } = useParams<{ sessionId: string }>()

  // 값이 없거나 목록에 없는 경우를 먼저 처리해야 아래에서 안전하게 사용한다.
  const session = sessions.find(item => item.id === sessionId)
  if (!session) {
    return <p role="alert">해당 학습 기록이 없습니다.</p>
  }

  return (
    <article>
      <h2>{session.topic}</h2>
      <p>기록 식별자: {session.id}</p>
    </article>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="sessions" element={<SessionListPage />} />
      {/* 콜론 뒤 이름과 useParams에서 읽는 이름이 같아야 한다. */}
      <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
    </Routes>
  )
}
```

`useParams`의 제네릭은 값이 반드시 존재한다고 보장하지 않는다. 사용자가 주소를 직접 수정할 수 있으므로 숫자 변환, 허용 범위, 데이터 존재 여부를 확인해야 한다.

## 5. 이동 수단을 구분한다

| 도구 | 사용하는 상황 |
| --- | --- |
| `Link` | 사용자가 클릭하는 일반 화면 이동 |
| `NavLink` | 현재 경로에 따른 활성 메뉴 스타일이 필요할 때 |
| `useNavigate` | 저장 성공 뒤 이동처럼 코드가 이동을 결정할 때 |
| `<Navigate>` | 렌더링 결과로 다른 경로를 보여 줘야 할 때 |

사용자가 누를 수 있는 이동은 우선 링크로 표현한다. 클릭 핸들러 안에서 모든 이동을 `navigate()`로 처리하면 새 탭 열기, 링크 주소 복사 같은 브라우저 기본 기능을 잃기 쉽다.

## 6. 새로고침에서 404가 발생하는 이유

개발 서버에서는 `/sessions/react-state`가 잘 열리지만 정적 호스팅에 배포한 뒤 새로고침하면 서버 404가 날 수 있다. 브라우저가 그 경로의 실제 파일을 서버에 요청했기 때문이다.

배포 서버가 알 수 없는 경로를 `index.html`로 되돌리도록 SPA fallback을 설정해야 한다. 이는 React 코드 오류가 아니라 호스팅 서버의 경로 처리 문제다.

## 7. 적용 관점에서 다시 보기

먼저 화면 목록과 URL 표를 적고, 공통 레이아웃을 찾는다. 그다음 정적 경로, 동적 경로, 없는 페이지 순서로 구성한다. URL 값은 API 입력과 마찬가지로 검증한다.

화면이 보이지 않으면 현재 주소, Route의 부모·자식 관계, `Outlet` 존재 여부, 경로 앞의 `/`, 동적 매개변수 이름을 차례로 확인한다.

## 8. 요약 정리

- 라우터는 URL과 렌더링할 컴포넌트를 연결한다.
- `BrowserRouter`는 브라우저 History API를 사용한다.
- 중첩 Route의 자식은 부모의 `Outlet`에 렌더링된다.
- `index` Route는 부모 URL의 기본 화면이다.
- 동적 경로 값은 외부 입력이므로 존재와 형식을 검사한다.
- 일반 이동에는 `Link`, 코드가 결정하는 이동에는 `useNavigate`를 고려한다.
- 배포 새로고침 404는 서버의 SPA fallback 설정을 확인한다.

🧠 기억할 것: 화면을 먼저 만들고 URL을 덧붙이는 것이 아니라, 사용자가 다시 찾아올 수 있는 URL 구조와 화면 책임을 함께 설계한다.

## 9. 미니 퀴즈

1. 부모 Route의 자식 화면이 나타날 위치를 지정하는 컴포넌트는 무엇인가?
2. `useParams()`의 값을 바로 신뢰하면 안 되는 이유는 무엇인가?
3. 사용자가 클릭하는 메뉴 이동에 `Link`가 적합한 이유는 무엇인가?
4. 배포 후 상세 URL 새로고침에서 404가 나면 무엇을 확인해야 하는가?

<details>
<summary>정답과 해설</summary>

1. `<Outlet />`이다.
2. URL은 사용자가 직접 바꿀 수 있고 매개변수가 없을 수도 있는 외부 입력이기 때문이다.
3. 링크의 의미와 새 탭 열기 같은 브라우저 기본 동작을 유지하면서 클라이언트 이동을 수행하기 때문이다.
4. 호스팅 서버가 알 수 없는 경로를 `index.html`로 보내는 SPA fallback 설정을 확인한다.

</details>

## 참고 자료

- [React Router 선언형 라우팅](https://reactrouter.com/start/declarative/routing)
- [BrowserRouter API](https://reactrouter.com/api/declarative-routers/BrowserRouter)
