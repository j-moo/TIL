# React 19 Actions와 낙관적 UI

- 🎯 글의 목표: 폼 제출의 대기·성공·실패 상태를 `useActionState`, `useFormStatus`, `useOptimistic`으로 표현하고 실패 복구까지 설계한다.
- 🧩 핵심 키워드: Action, `useActionState`, `useFormStatus`, `useOptimistic`, pending, optimistic update
- ⭐ 중요도: ★★★★☆ — 비동기 변경 작업에서 중복 제출과 느린 피드백을 줄이면서 실제 서버 결과와 UI를 일치시킬 수 있다.
- 📝 한눈에 보는 내용: Action은 비동기 전이를 관리하는 함수다. `useActionState`는 결과 state와 pending을, `useFormStatus`는 부모 폼의 제출 상태를, `useOptimistic`은 서버 응답 전 임시 화면을 제공한다.
- 🔗 관련 주제: 폼, Transition, 서버 mutation, 오류 처리
- 🧱 선수 지식: React 19, `FormData`, `async/await`, controlled form

---

## 1. 들어가며

저장 버튼을 누른 뒤 응답까지 1초가 걸리면 사용자는 클릭이 처리됐는지 알기 어렵다. 버튼을 다시 눌러 중복 요청이 생기거나, 성공처럼 보였지만 실제 저장은 실패할 수도 있다.

React 19의 Actions 관련 Hook은 이런 **비동기 변경의 전이 상태**를 UI와 연결한다. 다만 입력 검증, 서버 오류, 실패 복구 자체를 없애 주는 것은 아니다.

## 2. 전체 흐름

```text
사용자가 form을 제출한다
        ↓
Action이 FormData를 읽고 검증한다
        ↓
pending UI를 표시한다
        ↓
서버 성공 → 확정 state 반영
서버 실패 → 오류 state 표시·낙관적 UI 복구
```

## 3. `useActionState`로 제출 결과 관리하기

예제는 학습 메모를 저장하는 클라이언트 컴포넌트다. `saveStudyNote`는 실제 프로젝트에서 API 모듈에 위치할 함수라고 가정한다.

```tsx
import { useActionState } from 'react'

type SaveState =
  | { status: 'idle'; message: '' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

const initialState: SaveState = { status: 'idle', message: '' }

async function saveStudyNote(content: string): Promise<void> {
  const response = await fetch('/api/study-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })

  // fetch는 4xx와 5xx에서도 reject되지 않으므로 직접 검사한다.
  if (!response.ok) throw new Error('메모 저장에 실패했습니다.')
}

async function submitNote(
  previousState: SaveState,
  formData: FormData,
): Promise<SaveState> {
  // FormData 값은 string 이외에 File 또는 null일 수 있다.
  const rawContent = formData.get('content')
  if (typeof rawContent !== 'string' || rawContent.trim().length < 3) {
    return { status: 'error', message: '메모를 3자 이상 입력하세요.' }
  }

  try {
    await saveStudyNote(rawContent.trim())
    return { status: 'success', message: '학습 메모를 저장했습니다.' }
  } catch (error) {
    // 사용자에게 내부 오류 객체 전체를 노출하지 않고 이해 가능한 상태를 반환한다.
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.',
    }
  }
}

export function StudyNoteForm() {
  // state는 Action의 마지막 반환값, formAction은 form에 전달할 함수다.
  const [state, formAction, isPending] = useActionState(submitNote, initialState)

  return (
    <form action={formAction}>
      <label htmlFor="content">복습 메모</label>
      <textarea id="content" name="content" minLength={3} required />

      {/* 제출 중에는 같은 요청이 중복으로 시작되지 않도록 버튼을 막는다. */}
      <button type="submit" disabled={isPending}>
        {isPending ? '저장 중…' : '저장'}
      </button>

      {/* 오류는 보조 기술도 즉시 인식하도록 alert 역할을 사용한다. */}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {state.status === 'success' && <p role="status">{state.message}</p>}
    </form>
  )
}
```

`previousState`는 마지막 Action 결과다. 이 예제에서는 사용하지 않지만 누적 값이나 이전 오류와 결합할 때 쓸 수 있다. Action 반환 타입과 초기 state 타입이 일치해야 TypeScript 추론이 안정적이다.

## 4. `useFormStatus`로 제출 버튼 분리하기

버튼을 별도 컴포넌트로 분리하면 해당 컴포넌트가 부모 폼의 제출 상태를 읽을 수 있다.

```tsx
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  // 가장 가까운 부모 form의 마지막 제출 상태를 구독한다.
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? '처리 중…' : '등록'}
    </button>
  )
}

function NoteForm({ action }: { action: (formData: FormData) => void }) {
  return (
    <form action={action}>
      <input name="topic" aria-label="학습 주제" required />
      {/* SubmitButton은 form의 자식이므로 useFormStatus가 이 폼을 찾을 수 있다. */}
      <SubmitButton />
    </form>
  )
}
```

`useFormStatus`를 호출하는 컴포넌트가 폼 자체를 렌더링하면 그 폼의 상태를 읽지 못한다. Hook을 사용하는 컴포넌트가 반드시 대상 `<form>` 아래에서 렌더링되어야 한다.

## 5. `useOptimistic`으로 즉시 반응하기

낙관적 업데이트는 서버가 성공할 것이라고 가정하고 결과를 먼저 보여 주는 방식이다. 좋아요, 댓글 추가처럼 성공 가능성이 높고 되돌릴 수 있는 작업에 적합하다.

```tsx
import { startTransition, useOptimistic, useState } from 'react'

type Comment = {
  id: string
  message: string
  pending?: boolean
}

async function createComment(message: string): Promise<Comment> {
  const response = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!response.ok) throw new Error('댓글 등록 실패')
  return (await response.json()) as Comment
}

export function CommentList() {
  const [comments, setComments] = useState<Comment[]>([])
  const [error, setError] = useState('')

  const [optimisticComments, addOptimisticComment] = useOptimistic(
    comments,
    // 현재 확정 목록과 임시 댓글을 받아 화면에 보일 다음 목록을 계산한다.
    (current, pendingComment: Comment) => [...current, pendingComment],
  )

  const submitComment = (formData: FormData) => {
    const value = formData.get('message')
    if (typeof value !== 'string' || !value.trim()) return

    const message = value.trim()
    const temporaryId = `pending-${crypto.randomUUID()}`
    setError('')

    // optimistic setter는 Action 안에서 호출해야 임시 상태가 요청 동안 유지된다.
    startTransition(async () => {
      addOptimisticComment({ id: temporaryId, message, pending: true })

      try {
        const saved = await createComment(message)
        // 성공하면 서버가 발급한 실제 id가 있는 확정 목록으로 바꾼다.
        setComments(current => [...current, saved])
      } catch {
        // 확정 state가 바뀌지 않았으므로 임시 댓글은 사라지고 오류만 표시된다.
        setError('댓글을 저장하지 못했습니다. 다시 시도하세요.')
      }
    })
  }

  return (
    <section>
      <form action={submitComment}>
        <input name="message" aria-label="댓글" required />
        <button type="submit">댓글 추가</button>
      </form>

      {error && <p role="alert">{error}</p>}
      <ul>
        {optimisticComments.map(comment => (
          <li key={comment.id} aria-busy={comment.pending}>
            {comment.message}{comment.pending && ' (전송 중)'}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

결제 완료, 권한 변경처럼 실패 비용이 큰 작업은 성공을 미리 확정한 것처럼 보여 주면 안 된다. 낙관적 UI를 사용할 때는 임시 항목 식별자, 중복 제출 방지, 실패 메시지, 재시도 또는 되돌리기를 함께 설계한다.

## 6. 적용 관점에서 다시 보기

폼 Action을 만들 때 입력 타입 검증, pending UI, 중복 제출, 서버 오류, 성공 후 화면 변화를 먼저 적는다. 낙관적 업데이트는 실패해도 안전하게 원래 state로 돌아갈 수 있는 작업에만 사용한다.

`pending`이 변하지 않으면 Action이 `<form action={...}>`으로 실행됐는지 확인한다. `useFormStatus`라면 Hook 컴포넌트가 대상 폼의 자식인지 확인하고, `useOptimistic` setter 경고가 나면 Action 또는 Transition 안에서 호출했는지 본다.

## 7. 요약 정리

- Action은 비동기 변경과 UI 전이를 연결한다.
- `useActionState`는 마지막 결과 state와 pending 상태를 제공한다.
- `FormData` 값은 `string | File | null`이므로 검증해야 한다.
- `useFormStatus`는 가장 가까운 부모 폼의 상태를 읽는다.
- `useOptimistic`은 서버 응답 전 임시 결과를 보여 준다.
- 낙관적 업데이트에는 실패 복구와 임시 식별자가 필요하다.
- 고위험 작업에는 성공을 미리 확정한 듯한 UI를 피한다.

🧠 기억할 것: 빠른 화면보다 중요한 것은 대기·성공·실패 상태가 실제 서버 결과와 끝내 일치하는 것이다.

## 8. 미니 퀴즈

1. `useActionState`의 Action 함수가 받는 첫 번째 인수는 무엇인가?
2. `useFormStatus`가 폼 상태를 찾으려면 컴포넌트가 어디에 있어야 하는가?
3. 낙관적 UI가 적합하지 않은 작업의 예는 무엇인가?
4. 임시 댓글에 별도 id가 필요한 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 직전 Action이 반환한 state다.
2. 상태를 읽을 대상 `<form>`의 자식으로 렌더링되어야 한다.
3. 결제 완료나 권한 변경처럼 실패 비용이 크고 되돌리기 어려운 작업이다.
4. React key와 확정 데이터의 id를 구분하고 임시 항목을 안정적으로 식별하기 위해서다.

</details>

## 참고 자료

- [`useActionState`](https://react.dev/reference/react/useActionState)
- [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [`useOptimistic`](https://react.dev/reference/react/useOptimistic)
