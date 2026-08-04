# TypeScript로 React와 Firebase 연결하기

- 🎯 글의 목표: React의 화면 상태와 Firebase의 원격 데이터를 구분하고, Firestore 구독·작성 폼·인증 상태를 안전하게 연결한다.
- 🧩 핵심 키워드: service layer, `onSnapshot`, Effect cleanup, request state, mutation, Authentication Context
- ⭐ 중요도: ★★★★★ — React와 Firebase의 책임을 섞지 않아야 중복 데이터, 중복 listener, 권한 오류의 원인을 찾기 쉽다.
- 📝 한눈에 보는 내용: Firebase 초기화는 별도 모듈에서 한 번 수행한다. 읽기·쓰기는 서비스 함수로 분리하고, 컴포넌트는 커스텀 Hook을 통해 로딩·성공·오류 상태를 표현한다. 실시간 데이터는 별도 전역 store에 다시 복사하지 않는다.
- 🔗 관련 주제: Effect, 폼, Firestore, Firebase Authentication, Security Rules
- 🧱 선수 지식: React Hook, TypeScript 유니언, Firebase 웹 설정, Firestore 컬렉션·문서

---

## 1. 들어가며

React는 화면을 만들고 사용자 행동에 반응한다. Firebase는 데이터베이스, 인증, 파일 저장소 같은 외부 서비스를 제공한다. 두 기술을 연결할 때도 각 책임은 그대로 유지된다.

컴포넌트 안에서 Firebase 초기화, 데이터 변환, listener 등록, 폼 처리까지 모두 수행하면 파일이 길어지고 테스트가 어려워진다. 이 문서에서는 학습 메모 기능을 다음 네 계층으로 나눈다.

## 2. 전체 구조

```text
사용자 입력
   ↓
React 컴포넌트 ── pending·error·빈 화면 표시
   ↓
커스텀 Hook ───── 구독 시작·cleanup·요청 상태
   ↓
Firebase 서비스 ─ 컬렉션 경로·데이터 변환·쓰기
   ↓
Cloud Firestore ── 실제 원격 데이터와 Security Rules
```

권장 예제 구조는 다음과 같다.

```text
src/
├─ lib/
│  └─ firebase.ts            # Firebase App과 서비스 instance
├─ features/study-notes/
│  ├─ studyNote.types.ts     # 화면이 사용하는 데이터 계약
│  ├─ studyNote.service.ts   # Firestore 읽기·쓰기
│  ├─ useStudyNotes.ts       # React와 실시간 listener 연결
│  ├─ StudyNoteForm.tsx      # 사용자 입력과 mutation 상태
│  └─ StudyNoteList.tsx      # 목록 화면
├─ auth/
│  └─ AuthProvider.tsx       # 여러 화면이 공유할 로그인 상태
└─ App.tsx
```

## 3. Firebase 초기화는 재사용한다

Firebase 영역에서 만든 초기화 모듈을 React 기능에서 가져와 사용한다. 컴포넌트가 렌더링될 때마다 `initializeApp()`을 호출하지 않는다.

```ts
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 애플리케이션 전체가 공유하는 Firebase App을 모듈 로딩 시 한 번 만든다.
export const firebaseApp = initializeApp(firebaseConfig)

// 기능 모듈은 같은 Firestore와 Auth instance를 가져와 재사용한다.
export const firestore = getFirestore(firebaseApp)
export const auth = getAuth(firebaseApp)
```

환경 변수에 넣은 웹 설정값은 브라우저 번들에 포함될 수 있다. 데이터 접근 권한은 설정값을 숨겨서 지키는 것이 아니라 Authentication과 Security Rules로 제한한다.

## 4. 화면이 사용할 데이터 타입 정의하기

Firestore 문서의 timestamp와 React 화면이 다루기 쉬운 `Date`는 표현이 다르다. 변환 책임을 서비스 계층에 두면 컴포넌트가 Firebase 전용 타입에 덜 의존한다.

```ts
// src/features/study-notes/studyNote.types.ts
export type StudyNote = {
  id: string
  topic: string
  summary: string
  createdAt: Date | null
}

// id와 생성 시각은 서버가 정하므로 사용자의 작성 입력에서는 제외한다.
export type StudyNoteInput = Pick<StudyNote, 'topic' | 'summary'>
```

`createdAt`이 `null`일 수 있는 이유는 `serverTimestamp()`가 서버에 반영되기 전 local snapshot에서 아직 확정되지 않을 수 있기 때문이다.

## 5. Firestore 세부 사항을 서비스 함수로 분리하기

```ts
// src/features/study-notes/studyNote.service.ts
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import type { StudyNote, StudyNoteInput } from './studyNote.types'

const notesCollection = collection(firestore, 'studyNotes')

function toStudyNote(id: string, data: Record<string, unknown>): StudyNote {
  // TypeScript 타입만으로 원격 문서의 실제 필드 형식을 보장할 수 없다.
  if (typeof data.topic !== 'string' || typeof data.summary !== 'string') {
    throw new Error(`학습 메모 ${id}의 데이터 형식이 올바르지 않습니다.`)
  }

  return {
    id,
    topic: data.topic,
    summary: data.summary,
    // Firestore Timestamp일 때만 브라우저 Date로 변환한다.
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : null,
  }
}

export function subscribeStudyNotes(
  onNext: (notes: StudyNote[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const notesQuery = query(notesCollection, orderBy('createdAt', 'desc'))

  // 첫 snapshot과 이후 모든 변경을 호출자에게 전달한다.
  return onSnapshot(
    notesQuery,
    snapshot => {
      try {
        const notes = snapshot.docs.map(document =>
          toStudyNote(document.id, document.data()),
        )
        onNext(notes)
      } catch (error) {
        onError(error instanceof Error ? error : new Error('데이터 변환 실패'))
      }
    },
    error => onError(error),
  )
}

export async function createStudyNote(input: StudyNoteInput): Promise<string> {
  const reference = await addDoc(notesCollection, {
    topic: input.topic,
    summary: input.summary,
    // 여러 사용자의 브라우저 시간이 아니라 Firebase 서버 시간을 기준으로 한다.
    createdAt: serverTimestamp(),
  })

  // Firestore가 자동 생성한 문서 id를 필요한 후속 작업에 사용할 수 있다.
  return reference.id
}
```

서비스 함수는 React의 `useState`나 JSX를 알지 못한다. 따라서 별도 단위 테스트에서 Firebase 호출을 대체하기 쉽고, 다른 UI에서도 같은 데이터 함수를 재사용할 수 있다.

## 6. 커스텀 Hook에서 실시간 listener 관리하기

실시간 구독은 React 외부 시스템과 연결하는 작업이므로 Effect에 둔다. Effect가 다시 실행되거나 컴포넌트가 사라질 때 이전 구독을 해제해야 한다.

```tsx
// src/features/study-notes/useStudyNotes.ts
import { useEffect, useState } from 'react'
import { subscribeStudyNotes } from './studyNote.service'
import type { StudyNote } from './studyNote.types'

type NotesState =
  | { status: 'loading'; notes: StudyNote[]; error: null }
  | { status: 'success'; notes: StudyNote[]; error: null }
  | { status: 'error'; notes: StudyNote[]; error: Error }

const initialState: NotesState = {
  status: 'loading',
  notes: [],
  error: null,
}

export function useStudyNotes(): NotesState {
  const [state, setState] = useState<NotesState>(initialState)

  useEffect(() => {
    // subscribeStudyNotes가 반환하는 함수는 현재 listener만 해제한다.
    const unsubscribe = subscribeStudyNotes(
      notes => {
        setState({ status: 'success', notes, error: null })
      },
      error => {
        setState(current => ({
          status: 'error',
          // 일시적 오류가 나도 이미 보이던 목록은 유지한다.
          notes: current.notes,
          error,
        }))
      },
    )

    // unmount 또는 개발 Strict Mode 재마운트 전에 이전 구독을 정리한다.
    return unsubscribe
  }, [])

  return state
}
```

개발 Strict Mode에서는 `구독 → 해제 → 다시 구독` 순서가 보일 수 있다. 이를 막으려고 ref로 Effect 실행을 숨기지 말고 cleanup이 정확히 반대 작업을 수행하는지 확인한다.

## 7. 작성은 이벤트에서 실행한다

사용자의 폼 제출로 발생하는 문서 작성은 Effect가 아니라 제출 이벤트에서 실행한다.

```tsx
// src/features/study-notes/StudyNoteForm.tsx
import { useState, type FormEvent } from 'react'
import { createStudyNote } from './studyNote.service'

export function StudyNoteForm() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    // await 이후에도 사용할 수 있도록 현재 form 요소를 지역 변수에 보관한다.
    const form = event.currentTarget
    const formData = new FormData(form)
    const topic = formData.get('topic')
    const summary = formData.get('summary')

    // FormData 값은 string, File, null 중 하나일 수 있어 형식을 좁힌다.
    if (typeof topic !== 'string' || typeof summary !== 'string') {
      setError('입력값 형식을 확인하세요.')
      return
    }

    const trimmedTopic = topic.trim()
    const trimmedSummary = summary.trim()
    if (trimmedTopic.length < 2 || trimmedSummary.length < 5) {
      setError('주제는 2자, 요약은 5자 이상 입력하세요.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await createStudyNote({
        topic: trimmedTopic,
        summary: trimmedSummary,
      })

      // 저장 성공 뒤 입력만 비운다. 목록은 Firestore listener가 새 snapshot으로 갱신한다.
      form.reset()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        학습 주제
        <input name="topic" minLength={2} required />
      </label>
      <label>
        핵심 요약
        <textarea name="summary" minLength={5} required />
      </label>

      {/* 저장 중 중복 제출을 막고 현재 진행 상태를 버튼 문구로 알린다. */}
      <button type="submit" disabled={submitting}>
        {submitting ? '저장 중…' : '메모 저장'}
      </button>

      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

저장 직후 `setNotes(current => [...current, created])`도 실행하면 listener가 같은 문서를 다시 전달해 중복 항목이 생길 수 있다. 실시간 listener를 목록의 단일 진실 공급원으로 선택했다면 목록 갱신도 listener에 맡긴다.

## 8. 목록에서 로딩·빈 결과·오류 구분하기

```tsx
// src/features/study-notes/StudyNoteList.tsx
import { useStudyNotes } from './useStudyNotes'

export function StudyNoteList() {
  const state = useStudyNotes()

  if (state.status === 'loading') {
    return <p aria-live="polite">학습 메모를 불러오는 중…</p>
  }

  if (state.status === 'error' && state.notes.length === 0) {
    return <p role="alert">{state.error.message}</p>
  }

  if (state.notes.length === 0) {
    return <p>아직 저장한 학습 메모가 없습니다.</p>
  }

  return (
    <section>
      {/* 기존 목록이 있으면 일시적 listener 오류를 목록과 함께 보여 준다. */}
      {state.status === 'error' && (
        <p role="alert">최신 상태를 확인하지 못했습니다.</p>
      )}

      <ul>
        {state.notes.map(note => (
          <li key={note.id}>
            <article>
              <h2>{note.topic}</h2>
              <p>{note.summary}</p>
              <small>
                {note.createdAt
                  ? note.createdAt.toLocaleString('ko-KR')
                  : '저장 시간 확인 중'}
              </small>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

빈 배열과 로딩 중은 다르다. 첫 snapshot이 도착하기 전에는 loading을, 성공했지만 문서가 없을 때는 빈 결과 안내를 보여 준다.

## 9. 여러 화면이 로그인 상태를 쓸 때 Context로 전달하기

Firebase Auth 역시 외부 구독이다. 여러 화면에서 현재 사용자를 사용한다면 Provider 하나가 구독을 소유하고 Context로 결과를 전달할 수 있다.

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

type AuthState = {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    // 로그인·로그아웃·세션 복원 때마다 현재 사용자를 새로 전달받는다.
    const unsubscribe = onAuthStateChanged(auth, user => {
      setState({ user, loading: false })
    })

    // Provider가 사라질 때 인증 listener도 해제한다.
    return unsubscribe
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.')
  }
  return value
}
```

Context의 사용자 정보는 화면 표시와 경로 분기에 도움을 주지만 권한 검사 자체는 아니다. 악의적인 사용자는 React 화면을 거치지 않고 Firebase에 직접 요청할 수 있으므로 Firestore Rules가 `request.auth.uid`를 다시 확인해야 한다.

## 10. 앱에서 조합하기

```tsx
// src/App.tsx
import { AuthProvider } from './auth/AuthProvider'
import { StudyNoteForm } from './features/study-notes/StudyNoteForm'
import { StudyNoteList } from './features/study-notes/StudyNoteList'

export default function App() {
  // 하위 화면이 인증 상태를 공유해야 할 때 최상위 가까이에 Provider를 둔다.
  return (
    <AuthProvider>
      <main>
        <h1>학습 메모</h1>
        <StudyNoteForm />
        <StudyNoteList />
      </main>
    </AuthProvider>
  )
}
```

실제 앱에서는 로그인한 사용자만 작성 폼을 볼 수 있게 할 수 있다. 화면에서 숨기는 것과 별개로 Rules에서도 작성자 uid를 검증한다.

## 11. Firebase 데이터를 Zustand나 Redux에 복사해야 할까?

실시간 listener가 이미 최신 문서 목록을 제공한다면 같은 배열을 외부 store에 그대로 복사할 필요는 적다. 원격 데이터와 store 복사본 중 어느 것이 최신인지 불분명해지고 동기화 코드가 늘어난다.

외부 store가 잘 맞는 값은 다음과 같다.

- 선택된 메모 id
- 정렬 패널의 열림 여부
- 아직 서버에 저장하지 않은 여러 단계 입력
- 여러 화면이 공유하는 지역 UI 설정

Firestore 문서 목록, 서버 오류, listener 연결 상태는 해당 query를 소유한 Hook이나 서버 상태 계층에 두는 편이 책임이 명확하다.

## 12. 자주 발생하는 문제와 확인 순서

### 목록이 두 번 보인다

- 저장 성공 뒤 지역 배열에 추가하고 listener 결과도 추가했는지 확인한다.
- 같은 컴포넌트가 listener를 두 번 등록하면서 cleanup을 반환하지 않았는지 본다.
- 문서 `id`가 아닌 배열 index를 key로 사용하지 않았는지 확인한다.

### 개발 중 읽기가 반복된다

- Strict Mode의 setup·cleanup·setup 과정인지 확인한다.
- cleanup이 실제 `unsubscribe` 함수를 반환하는지 본다.
- query 객체를 렌더링마다 만들고 Effect 의존성에 넣어 재구독하지 않는지 확인한다.

### `permission-denied`가 발생한다

- Firebase Console의 Rules와 현재 로그인 사용자를 확인한다.
- 작성 문서에 Rules가 요구하는 `ownerId` 같은 필드가 있는지 본다.
- query 조건이 Rules가 허용하는 데이터 범위와 일치하는지 확인한다.

### 화면이 계속 loading이다

- `onSnapshot`의 성공 callback과 오류 callback을 모두 등록했는지 확인한다.
- 브라우저 콘솔과 Network 탭에서 초기화·권한 오류를 본다.
- 잘못된 Firebase project 환경 변수를 사용하고 있지 않은지 확인한다.

## 13. 적용 관점에서 다시 보기

Firebase 기능을 연결할 때 먼저 화면이 필요한 데이터와 mutation을 적는다. 초기화 모듈을 재사용하고, 서비스 함수에서 경로와 데이터 변환을 처리한 뒤, Hook에서 구독 수명과 요청 상태를 관리한다.

컴포넌트는 사용자 행동과 화면 표현에 집중한다. 오류가 발생하면 React state를 무작정 수정하기 전에 Firebase 프로젝트, Rules, 로그인 사용자, query, listener cleanup 순서로 확인한다.

## 14. 요약 정리

- React는 화면과 상호작용, Firebase는 원격 서비스의 책임을 가진다.
- Firebase App과 서비스 instance는 별도 모듈에서 한 번 초기화한다.
- 서비스 함수는 Firestore 경로와 원격 데이터 변환을 담당한다.
- 실시간 listener는 Effect에서 연결하고 cleanup에서 해제한다.
- 폼 mutation은 사용자의 제출 이벤트에서 실행한다.
- 목록을 listener가 관리한다면 저장 성공 뒤 같은 데이터를 직접 추가하지 않는다.
- loading, 빈 결과, 오류를 서로 다른 상태로 표현한다.
- Auth Context는 사용자 상태 전달 도구이며 Security Rules를 대신하지 않는다.
- Firebase 원격 데이터를 외부 store에 무조건 복사하지 않는다.

🧠 기억할 것: React와 Firebase를 잘 연결한다는 것은 데이터를 가져오는 한 줄을 쓰는 일이 아니라, 원격 데이터의 소유자·구독 수명·화면 상태·보안 경계를 분명하게 나누는 일이다.

## 15. 미니 퀴즈

1. Firestore listener를 Effect cleanup에서 해제해야 하는 이유는 무엇인가?
2. 저장 성공 뒤 목록 state에 문서를 직접 추가하지 않은 이유는 무엇인가?
3. 로딩 중과 빈 목록을 구분해야 하는 이유는 무엇인가?
4. Auth Context가 Security Rules를 대신할 수 없는 이유는 무엇인가?
5. Firestore 목록을 Zustand나 Redux에 그대로 복사할 때 생길 수 있는 문제는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 화면이 사라지거나 Effect가 다시 실행된 뒤에도 이전 listener가 남아 중복 callback과 불필요한 읽기를 만들 수 있기 때문이다.
2. 실시간 listener가 새 문서를 포함한 snapshot을 다시 전달하므로 지역 배열에도 추가하면 중복될 수 있기 때문이다.
3. 아직 응답을 받지 못한 상태와 정상 응답 결과가 0개인 상태는 사용자에게 전혀 다른 의미이기 때문이다.
4. 사용자는 React UI를 우회해 Firebase에 직접 요청할 수 있으므로 권한은 서버에서 평가되는 Rules가 다시 검사해야 한다.
5. 원격 데이터와 복사본 중 최신 값이 무엇인지 불분명해지고 두 상태를 맞추는 코드가 늘어난다.

</details>

## 참고 자료

- [React: Effect로 동기화하기](https://react.dev/learn/synchronizing-with-effects)
- [Firebase: Firestore 실시간 업데이트](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firebase: Firestore 데이터 추가](https://firebase.google.com/docs/firestore/manage-data/add-data)
- [Firebase Authentication 웹 시작하기](https://firebase.google.com/docs/auth/web/start)
- [Firestore Security Rules 시작하기](https://firebase.google.com/docs/firestore/security/get-started)
