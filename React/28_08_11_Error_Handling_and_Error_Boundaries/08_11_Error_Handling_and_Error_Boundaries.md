# TypeScript로 배우는 React 오류 처리와 Error Boundary

- 🎯 글의 목표: 렌더링 오류, 이벤트 오류, 비동기 요청 오류를 구분하고 사용자에게 복구 가능한 화면을 보여 준다.
- 🧩 핵심 키워드: Error Boundary, `getDerivedStateFromError`, `componentDidCatch`, `unknown`, `pending`, `retry`
- ⭐ 중요도: ★★★★★ — 예외가 발생했을 때 전체 화면이 하얗게 사라지지 않고, 사용자가 다음 행동을 이해할 수 있어야 한다.
- 📝 한눈에 보는 내용: Error Boundary는 자식의 렌더링 중 오류를 대체 화면으로 바꾼다. 클릭·폼 제출·`fetch`에서 발생한 오류는 Boundary에 자동으로 맡기지 말고 각 이벤트와 비동기 상태에서 처리한다.
- 🔗 관련 주제: React 데이터 패칭, React Actions, 컴포넌트 테스트, Firebase App Check
- 🧱 선수 지식: 함수 컴포넌트, Props·state, `async/await`, 판별 유니언, React 19 `createRoot`

---

## 1. 오류가 모두 같은 오류는 아니다

화면에서 “문제가 생겼다”는 결과는 같아 보여도 오류가 발생한 위치에 따라 처리 방법이 달라진다. 렌더링 중 예외를 버튼 클릭용 `try/catch`로 잡을 수 없고, 네트워크 실패를 Error Boundary에만 맡기면 사용자가 재시도할 방법이 없어진다.

```text
오류 발생 지점
├─ 렌더링·생명주기 중 자식 예외
│      → Error Boundary가 fallback UI 표시
├─ 클릭·폼 제출 이벤트
│      → 이벤트 핸들러에서 try/catch와 상태 처리
├─ fetch·Firebase 등 비동기 작업
│      → pending/success/error 상태와 재시도
└─ 앱 전체에서 처리하지 못한 오류
       → createRoot 로거와 최상위 fallback 검토
```

오류 처리는 개발자에게 stack trace를 남기는 일과 사용자에게 복구 경로를 제공하는 일을 함께 포함한다. 사용자 화면에 서버 내부 주소나 credential 같은 민감한 정보를 그대로 보여 주지 않는다.

## 2. Error Boundary가 해결하는 문제

Error Boundary는 하위 컴포넌트가 렌더링되는 중 오류를 던졌을 때 그 하위 트리를 fallback UI로 교체하는 특수한 컴포넌트다. Boundary를 여러 화면 영역에 배치하면 한 카드의 오류가 앱 전체 화면을 사라지게 하는 일을 줄일 수 있다.

```tsx
<AppShell>
  <ErrorBoundary>
    <StudyDashboard />
  </ErrorBoundary>
</AppShell>
```

React 공식 API에서는 `static getDerivedStateFromError`로 fallback 표시 상태를 만들고 `componentDidCatch`로 로깅한다. 함수 컴포넌트에 같은 역할을 하는 Hook은 아직 없으므로 Boundary 자체는 클래스 컴포넌트로 작성한다. 화면의 나머지 컴포넌트까지 클래스로 바꾸라는 뜻은 아니다.

### 2.1 Boundary가 잡는 오류와 잡지 못하는 오류

| 오류 위치 | Error Boundary가 처리하는가? | 권장 처리 |
| --- | --- | --- |
| 자식의 `render` 중 예외 | 예 | Boundary fallback |
| 자식의 생명주기 중 예외 | 예 | Boundary fallback·로깅 |
| 버튼 `onClick` 내부 예외 | 아니오 | 이벤트 핸들러 `try/catch` |
| `setTimeout`·Promise callback 예외 | 아니오 | 비동기 함수의 `try/catch` |
| Boundary 자신의 `render` 오류 | 해당 Boundary로는 아니오 | 더 바깥 Boundary |
| 서버 렌더링 중 오류 | 클라이언트 Boundary와 별도 | 프레임워크·서버 오류 처리 |
| 의도된 검증 실패 | 예외로 던지지 않음 | 폼 state로 안내 |

Boundary는 모든 오류를 잡는 전역 `window.onerror` 대체물이 아니다. 오류가 발생한 층에서 가장 적절한 복구 방법을 선택해야 한다.

## 3. TypeScript Error Boundary 만들기

### 3.1 Props와 state 설계

fallback은 오류 객체 자체를 화면에 출력하지 않고 사용자용 문구를 받도록 한다. `resetKey`는 로그인 사용자나 URL이 바뀌었을 때 이전 오류 화면을 다시 시도하게 하는 기준값이다.

```tsx
import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
  // 오류 화면에서 사용자에게 보여 줄 안내 문구다.
  fallback?: ReactNode
  // 값이 바뀌면 오류 상태를 초기화하고 자식을 다시 렌더링한다.
  resetKey?: string | number
  // 오류를 외부 로깅 서비스로 보내기 위한 선택 callback이다.
  onError?: (error: unknown, info: ErrorInfo) => void
}

type ErrorBoundaryState = {
  hasError: boolean
}
```

오류는 JavaScript에서 `Error` 객체가 아닌 문자열이나 `null`도 `throw`될 수 있다. 따라서 외부 경계의 입력은 `Error`보다 넓은 `unknown`으로 받고, 필요할 때만 안전하게 문자열을 만든다.

### 3.2 Boundary 구현

```tsx
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    // 렌더링 중 오류가 발생하면 다음 렌더에서 fallback을 선택한다.
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // 부작용인 로깅은 componentDidCatch에서 수행한다.
    this.props.onError?.(error, info)
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps): void {
    const keyChanged = previousProps.resetKey !== this.props.resetKey

    if (keyChanged && this.state.hasError) {
      // 다른 사용자·경로의 화면으로 이동했으면 이전 화면의 오류를 초기화한다.
      this.setState({ hasError: false })
    }
  }

  handleRetry = (): void => {
    // 사용자가 다시 시도를 누르면 자식 트리를 다시 렌더링한다.
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <section role="alert">
            <h2>화면을 불러오지 못했습니다.</h2>
            <p>잠시 후 다시 시도해 주세요.</p>
            <button type="button" onClick={this.handleRetry}>
              다시 시도
            </button>
          </section>
        )
      )
    }

    return this.props.children
  }
}
```

`getDerivedStateFromError`는 상태만 계산하는 순수 메서드로 두고, 로그 전송 같은 부작용은 `componentDidCatch`에서 실행한다. 사용자가 다시 시도를 누르면 자식 트리를 다시 렌더링하지만, 같은 버그가 계속 발생하면 fallback이 다시 나타난다.

### 3.3 앱에 배치하기

```tsx
import { ErrorBoundary } from './ErrorBoundary'
import { StudyDashboard } from './StudyDashboard'

export function App({ userId }: { userId: string }) {
  return (
    <ErrorBoundary
      // userId가 바뀌면 이전 사용자의 오류 화면을 초기화한다.
      resetKey={userId}
      onError={(error, info) => {
        // 실제 서비스에서는 민감한 데이터가 포함되지 않도록 정제해 전송한다.
        console.error('StudyDashboard render error', error, info.componentStack)
      }}
    >
      <StudyDashboard userId={userId} />
    </ErrorBoundary>
  )
}
```

Boundary 범위는 너무 크게 잡으면 작은 오류 하나로 전체 앱이 fallback이 되고, 너무 작게 잡으면 같은 설정이 반복된다. 앱 shell, 라우트 화면, 독립적인 카드·위젯처럼 복구 단위에 맞춰 경계를 나눈다.

## 4. 사용자에게 보여 줄 오류와 로그용 오류 분리하기

개발자에게 유용한 오류 객체에는 파일 경로, 컴포넌트 stack, 요청 URL이 들어 있을 수 있다. 이 내용을 사용자에게 그대로 보여 주면 내부 구조와 개인정보가 노출될 수 있다.

```ts
export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // 알려진 오류만 사용자용 메시지로 바꾼다.
    if (error.message.includes('permission-denied')) {
      return '이 작업을 수행할 권한이 없습니다.'
    }
  }

  // 원인을 알 수 없는 오류에는 구체적인 내부 정보를 노출하지 않는다.
  return '잠시 후 다시 시도해 주세요.'
}
```

Firebase의 `permission-denied`, 네트워크 단절, 서버의 500 응답은 사용자가 해야 할 행동이 다를 수 있다. 그러나 모든 내부 오류 문자열을 그대로 출력하는 대신, 화면에는 짧은 안내를 보여 주고 상세 원인은 로그·모니터링 서비스에서 확인한다.

## 5. 이벤트 핸들러 오류는 직접 처리하기

Error Boundary는 버튼 클릭 함수에서 던진 오류를 자동으로 잡지 않는다. 사용자가 누른 버튼이 실패할 수 있다면 `pending`과 `error` 상태를 이벤트 함수 안에서 관리한다.

```tsx
import { useState } from 'react'

type SaveButtonProps = {
  onSave: () => Promise<void>
}

export function SaveButton({ onSave }: SaveButtonProps) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')

  async function handleClick(): Promise<void> {
    // 진행 중인 요청이 있으면 중복 제출을 막는다.
    if (status === 'pending') return

    setStatus('pending')

    try {
      await onSave()
      // 성공은 사용자가 확인할 수 있는 상태로 저장한다.
      setStatus('success')
    } catch {
      // 이 오류는 Boundary가 아니라 버튼 옆의 재시도 가능한 UI로 처리한다.
      setStatus('error')
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={status === 'pending'}>
        {status === 'pending' ? '저장 중…' : '저장'}
      </button>

      {status === 'success' && <p role="status">저장했습니다.</p>}
      {status === 'error' && (
        <p role="alert">저장하지 못했습니다. 다시 시도해 주세요.</p>
      )}
    </div>
  )
}
```

검증 실패처럼 사용자가 수정할 수 있는 문제는 예외를 던지기보다 입력 옆에 표시한다. 반대로 코드의 불변식이 깨져 화면을 계속 그릴 수 없는 오류는 Boundary로 보내는 편이 적절하다.

## 6. 비동기 요청 오류는 상태 모델로 표현하기

`fetch`나 Firebase listener의 오류는 Promise callback에서 발생하므로 Error Boundary가 자동으로 대신 처리하지 않는다. 요청의 상태를 판별 유니언으로 만들면 로딩·성공·실패·빈 결과를 분리할 수 있다.

```tsx
import { useState } from 'react'

type Note = {
  id: string
  topic: string
}

type LoadState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'pending'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: T | null; error: Error }

type NoteListProps = {
  loadNotes: () => Promise<Note[]>
}

export function NoteList({ loadNotes }: NoteListProps) {
  const [state, setState] = useState<LoadState<Note[]>>({
    status: 'idle',
    data: null,
    error: null,
  })

  async function handleLoad(): Promise<void> {
    setState({ status: 'pending', data: state.data, error: null })

    try {
      const notes = await loadNotes()
      setState({ status: 'success', data: notes, error: null })
    } catch (caught) {
      setState({
        status: 'error',
        // 외부에서 throw한 값이 Error가 아닐 수 있으므로 변환한다.
        error: caught instanceof Error ? caught : new Error('메모 조회 실패'),
        data: state.data,
      })
    }
  }

  if (state.status === 'idle') {
    return <button onClick={handleLoad}>메모 불러오기</button>
  }

  return (
    <section>
      {state.status === 'pending' && <p role="status">불러오는 중…</p>}

      {state.status === 'error' && (
        <div role="alert">
          <p>메모를 불러오지 못했습니다.</p>
          <button type="button" onClick={handleLoad}>다시 시도</button>
        </div>
      )}

      {state.status === 'success' && state.data.length === 0 && (
        <p>아직 저장된 메모가 없습니다.</p>
      )}

      {state.data && (
        <ul>
          {state.data.map(note => <li key={note.id}>{note.topic}</li>)}
        </ul>
      )}
    </section>
  )
}
```

오류 상태에서도 이전 데이터를 유지할지 비울지는 제품 요구에 따라 선택한다. “새로고침 중에도 이전 목록을 보여 주기”가 필요하면 `pending`과 `error`에 이전 `data`를 보존하고, 데이터가 민감하거나 오래된 값이 위험하면 비운다.

## 7. React 19 Actions와 오류의 경계

React 19의 `useActionState`에서 알려진 검증 오류는 state로 반환해 입력 화면에 표시할 수 있다. 예측하지 못한 예외를 다시 던지면 가장 가까운 Error Boundary가 fallback을 보여 줄 수 있다.

```tsx
import { useActionState } from 'react'

type FormState = {
  message: string
}

async function saveProfile(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const nickname = formData.get('nickname')

  if (typeof nickname !== 'string' || nickname.trim().length < 2) {
    // 사용자가 고칠 수 있는 문제는 state로 반환한다.
    return { message: '닉네임은 두 글자 이상이어야 합니다.' }
  }

  // 서버 오류처럼 화면에서 예측할 수 없는 문제라면 throw해 Boundary로 보낼 수 있다.
  await saveNicknameToServer(nickname.trim())
  return { message: '저장했습니다.' }
}

export function ProfileForm() {
  const [state, formAction, isPending] = useActionState(saveProfile, { message: '' })

  return (
    <form action={formAction}>
      <label>
        닉네임
        <input name="nickname" />
      </label>
      <button type="submit" disabled={isPending}>
        {isPending ? '저장 중…' : '저장'}
      </button>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  )
}
```

위 코드의 `saveNicknameToServer`는 실제 API 함수가 있다고 가정한 예시다. 사용자가 수정할 수 있는 validation과 예측할 수 없는 시스템 오류를 같은 `message` 문자열로 처리하지 않는 것이 핵심이다.

## 8. 앱 최상위 오류 로깅

React 19의 `createRoot`는 Error Boundary가 잡은 오류, 잡히지 않은 오류, React가 복구한 오류를 기록할 수 있는 선택 callback을 제공한다. 이 callback은 fallback UI를 만드는 기능이 아니라, 앱 전역 관찰 지점을 추가하는 기능이다.

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('root 요소를 찾을 수 없습니다.')

const root = createRoot(container, {
  // Boundary가 잡은 오류를 외부 로깅 서비스에 전달할 수 있다.
  onCaughtError(error, errorInfo) {
    console.error('Caught React error', error, errorInfo.componentStack)
  },
  // Boundary가 없어서 앱 바깥으로 나온 오류를 기록한다.
  onUncaughtError(error, errorInfo) {
    console.error('Uncaught React error', error, errorInfo.componentStack)
  },
  // React가 자동으로 복구한 문제를 별도로 관찰할 수 있다.
  onRecoverableError(error, errorInfo) {
    console.warn('Recoverable React error', error, errorInfo.componentStack)
  },
})

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

운영 로그에는 이메일, access token, 전체 요청 본문 같은 개인정보를 보내지 않는다. 오류 원인, 컴포넌트 stack, 앱 버전, 사용자에게 노출할 수 있는 request id 정도만 정제해 전송한다.

## 9. 오류 경계를 배치하는 기준

하나의 Boundary로 앱 전체를 감싸면 설정은 쉽지만, 작은 위젯의 오류에도 네비게이션과 다른 화면이 함께 사라진다. 반대로 모든 버튼마다 Boundary를 넣으면 fallback과 로깅 정책이 중복된다.

```text
앱 전체 Boundary
   ├─ 전역 fallback: 앱을 계속 사용할 수 없는 치명적 오류
   ├─ 라우트 Boundary: 특정 화면만 다시 열기
   └─ 위젯 Boundary: 대시보드 카드 하나만 숨기고 나머지 유지
```

오류가 발생한 기능의 복구 단위가 Boundary 범위가 된다. 로그인 사용자가 바뀌거나 URL이 바뀌면 `resetKey`를 전달해 이전 오류 상태를 새 화면에 전파하지 않는다.

## 10. 자주 발생하는 문제와 확인 순서

### 10.1 Boundary가 버튼 오류를 잡지 못한다

정상적인 동작이다. `onClick`·`onSubmit` 함수에 `try/catch`와 pending·error state를 추가한다. 버튼 동작 실패는 사용자가 바로 재시도할 수 있는 작은 상태로 보여 주는 편이 좋다.

### 10.2 비동기 오류가 콘솔에만 표시된다

Promise callback에서 발생한 오류를 state로 전환하지 않았을 가능성이 크다. API 함수는 reject하고, 호출한 컴포넌트가 `catch`에서 사용자용 메시지와 재시도 버튼을 만든다.

### 10.3 다시 시도해도 같은 fallback이 나타난다

코드 오류가 그대로 남아 있거나 자식 컴포넌트의 입력이 변하지 않았을 수 있다. 네트워크 재시도가 필요한 경우에는 `resetErrorBoundary`와 함께 query cache·입력값·`resetKey`를 초기화한다.

### 10.4 오류 메시지에 내부 정보가 노출된다

`error.message`를 곧바로 JSX에 출력하지 않는다. 오류 코드를 사용자 행동 문장으로 매핑하고, 상세 stack은 정제된 로깅 채널로만 보낸다.

### 10.5 개발 환경에서 같은 로그가 두 번 보인다

Strict Mode와 개발용 React error reporting은 부작용을 발견하기 위해 호출을 다르게 보이게 할 수 있다. 운영 로그 중복으로 단정하기 전에 개발·운영 빌드와 로거의 deduplication 정책을 구분한다.

## 11. 적용 관점에서 다시 보기

새 화면을 만들 때 먼저 오류를 다음 세 문장으로 분류한다.

1. 화면을 그릴 수 없게 만드는 예외인가?
2. 사용자가 수정하거나 다시 시도할 수 있는 요청 실패인가?
3. 입력값이 잘못되어 사용자가 즉시 고칠 수 있는 검증 오류인가?

첫 번째는 Boundary, 두 번째는 비동기 상태와 retry, 세 번째는 폼 field error로 연결한다. 이 기준을 먼저 정하면 모든 오류를 `alert(error.message)` 하나로 처리하는 일을 피할 수 있다.

문제가 생기면 개발자 도구에서 오류 발생 위치, 네트워크 응답, 컴포넌트 stack, 마지막 사용자 행동을 순서대로 확인한다. 오류를 잡았다는 사실보다 사용자가 정상 화면으로 돌아갈 수 있는지가 더 중요한 검증 기준이다.

## 12. 배운 점과 확장 방향

### 12.1 새로 이해한 것

Error Boundary는 오류를 없애는 기능이 아니라 렌더링 실패를 격리하고 대체 화면으로 바꾸는 안전망이다. 이벤트와 비동기 작업은 각자 성공·실패 상태를 가지고 있어야 한다.

### 12.2 이전·다음 학습과의 연결

데이터 패칭에서 배운 판별 유니언은 비동기 오류 화면을 만드는 기반이 된다. React Actions는 알려진 검증 오류를 state로 반환하고 예상하지 못한 오류를 Boundary로 보낼 수 있으며, 컴포넌트 테스트에서는 각 오류 상태와 다시 시도 동작을 검증한다.

### 12.3 더 확인할 주제

- `react-error-boundary` 라이브러리의 reset API
- React Router `errorElement`와 route-level 오류 경계
- TanStack Query의 error reset boundary
- Sentry 등 오류 모니터링 서비스의 개인정보 필터

## 13. 요약 정리

- 렌더링 예외와 이벤트·비동기 오류는 처리 위치가 다르다.
- Error Boundary는 자식의 렌더링·생명주기 오류를 fallback으로 바꾼다.
- `getDerivedStateFromError`는 fallback 상태, `componentDidCatch`는 로깅에 사용한다.
- React에는 함수 컴포넌트 전용 Error Boundary Hook이 아직 없다.
- 클릭·폼 제출 오류는 이벤트 핸들러에서 `try/catch`한다.
- fetch·Firebase 오류는 pending·success·error 상태로 표현한다.
- 사용자가 고칠 수 있는 검증 오류는 예외보다 field error나 반환 state가 적절하다.
- 오류 객체와 내부 stack을 사용자 화면에 그대로 출력하지 않는다.
- `resetKey`와 retry 버튼으로 다른 화면이나 재시도 흐름을 만들 수 있다.
- React 19 `createRoot` callback은 전역 오류 관찰 지점이며 fallback 자체를 대신하지 않는다.

🧠 기억할 것: **오류가 발생한 위치에 따라 Boundary, 이벤트 상태, 비동기 상태, 입력 검증 중 알맞은 복구 계층을 선택한다.**

## 14. 미니 퀴즈

1. Error Boundary가 `onClick`에서 던진 오류를 자동으로 잡지 않는 이유는 무엇인가?
2. `getDerivedStateFromError`와 `componentDidCatch`의 역할을 비교해 보자.
3. 네트워크 실패를 Error Boundary만으로 처리하면 사용자 경험이 부족한 이유는 무엇인가?
4. `unknown` 오류를 화면에 표시하기 전에 변환해야 하는 이유는 무엇인가?
5. `resetKey`가 필요한 상황을 하나 설명해 보자.
6. React 19 `onCaughtError`와 Boundary fallback은 어떤 점이 다른가?

<details>
<summary>정답과 해설</summary>

1. Boundary는 렌더링·생명주기 중 자식 오류를 위한 기능이고 이벤트 함수는 별도의 사용자 상호작용 흐름이기 때문이다.
2. 전자는 다음 렌더에서 fallback을 선택할 state를 계산하고, 후자는 오류 로깅 같은 부작용을 처리한다.
3. 네트워크 오류는 재시도·이전 데이터 유지·입력 수정 같은 화면별 복구가 필요하기 때문이다.
4. JavaScript는 Error가 아닌 문자열·null도 throw할 수 있고, 내부 메시지 노출을 막아야 하기 때문이다.
5. 다른 사용자나 URL로 이동했을 때 이전 화면의 오류 상태를 새 화면에 물려주지 않기 위해 사용한다.
6. `onCaughtError`는 전역 관찰·로깅 callback이고, Boundary fallback은 특정 하위 트리를 대체해 사용자가 볼 화면을 만드는 기능이다.

</details>

## 참고 자료

- [React Component: Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [React `createRoot` 오류 로깅](https://react.dev/reference/react-dom/client/createRoot#error-logging-in-production)
- [React `useActionState` 오류 처리](https://react.dev/reference/react/useActionState#handling-errors)
- [React 이벤트와 Effect 구분](https://react.dev/learn/separating-events-from-effects)
