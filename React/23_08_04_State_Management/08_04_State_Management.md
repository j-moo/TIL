# React 상태 관리 선택 기준: useReducer, Context, Redux Toolkit, Zustand

- 🎯 글의 목표: state의 범위와 변경 복잡도를 판단해 가장 작은 도구부터 선택하고, TypeScript로 예측 가능한 전역 상태를 구성한다.
- 🧩 핵심 키워드: local state, `useReducer`, Context, Redux Toolkit, Zustand, selector
- ⭐ 중요도: ★★★★★ — 전역 저장소를 너무 일찍 쓰거나 모든 값을 한곳에 모으면 변경 원인을 추적하기 어려워진다.
- 📝 한눈에 보는 내용: state는 사용하는 곳 가까이에 둔다. 변경 규칙이 복잡하면 `useReducer`, 전달 거리가 길면 Context를 검토하며, 여러 기능이 공유하고 개발 도구가 필요한 큰 상태에는 Redux Toolkit이나 Zustand를 선택할 수 있다.
- 🔗 관련 주제: state 끌어올리기, Context, 불변성, 서버 상태 캐시
- 🧱 선수 지식: `useState`, Props, 판별 유니언

---

## 1. 들어가며

“여러 컴포넌트에서 쓴다”는 이유만으로 모든 값을 전역 저장소에 넣을 필요는 없다. 폼 입력, 모달 열림 여부, 서버에서 받은 게시글 목록은 수명과 책임이 서로 다르다.

상태 관리의 핵심은 라이브러리 문법이 아니라 **누가 값을 소유하고 어떤 사건으로 바뀌는지** 정하는 것이다.

## 2. 선택 흐름

```text
한 컴포넌트만 사용하는가? ── 예 → useState
        │ 아니요
가까운 형제끼리 공유하는가? ── 예 → 공통 부모로 끌어올리기
        │ 아니요
변경 규칙이 여러 사건으로 복잡한가? ── 예 → useReducer
        │
깊은 트리로 전달해야 하는가? ── 예 → Context 조합 검토
        │
독립된 여러 화면이 공유하며 추적 도구가 필요한가? → 외부 저장소 검토
```

서버에서 가져온 데이터의 캐시·재시도·무효화는 Redux나 Zustand에 무조건 복사하기보다 TanStack Query, RTK Query 같은 서버 상태 도구와 비교한다.

## 3. `useReducer`: 변경 규칙을 한곳에 모으기

```tsx
import { useReducer } from 'react'

type Task = {
  id: string
  title: string
  done: boolean
}

// type 필드로 사건을 구분하면 switch에서 필요한 payload 타입이 좁혀진다.
type TaskAction =
  | { type: 'added'; task: Task }
  | { type: 'toggled'; id: string }
  | { type: 'removed'; id: string }

function tasksReducer(state: Task[], action: TaskAction): Task[] {
  switch (action.type) {
    case 'added':
      // 기존 배열을 바꾸지 않고 새 항목이 포함된 배열을 반환한다.
      return [...state, action.task]
    case 'toggled':
      // 대상 항목만 새 객체로 만들고 나머지는 기존 참조를 유지한다.
      return state.map(task =>
        task.id === action.id ? { ...task, done: !task.done } : task,
      )
    case 'removed':
      return state.filter(task => task.id !== action.id)
    default: {
      // 모든 action을 처리했는지 TypeScript가 검사하게 하는 안전장치다.
      const unreachable: never = action
      return unreachable
    }
  }
}

export function TaskBoard() {
  const [tasks, dispatch] = useReducer(tasksReducer, [])

  const addReviewTask = () => {
    dispatch({
      type: 'added',
      // 예제에서는 고유 id를 브라우저에서 생성한다.
      task: { id: crypto.randomUUID(), title: 'Props 복습', done: false },
    })
  }

  return (
    <section>
      <button type="button" onClick={addReviewTask}>복습 항목 추가</button>
      <ul>
        {tasks.map(task => (
          <li key={task.id}>
            <label>
              {/* UI는 사건만 전달하고 실제 변경 규칙은 reducer가 담당한다. */}
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => dispatch({ type: 'toggled', id: task.id })}
              />
              {task.title}
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

reducer는 현재 state와 action을 입력받아 다음 state를 반환하는 순수 함수다. 네트워크 요청이나 알림 같은 부수 효과는 reducer 안에서 실행하지 않고 이벤트 핸들러나 별도 비동기 계층에서 처리한다.

## 4. Context와 reducer 조합

Context는 값을 저장하는 창고가 아니라 하위 트리로 전달하는 통로다. `useReducer`가 상태 전이를 담당하고 Context가 `state`와 `dispatch`를 전달하도록 책임을 나눌 수 있다.

```tsx
import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'
type ThemeAction = { type: 'changed'; theme: Theme }

const ThemeStateContext = createContext<Theme | null>(null)
const ThemeDispatchContext = createContext<Dispatch<ThemeAction> | null>(null)

function themeReducer(_: Theme, action: ThemeAction): Theme {
  return action.theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, dispatch] = useReducer(themeReducer, 'light')

  // 읽기 값과 변경 함수를 나누면 필요한 Context만 구독할 수 있다.
  return (
    <ThemeStateContext.Provider value={theme}>
      <ThemeDispatchContext.Provider value={dispatch}>
        {children}
      </ThemeDispatchContext.Provider>
    </ThemeStateContext.Provider>
  )
}

export function useTheme(): Theme {
  const value = useContext(ThemeStateContext)
  if (value === null) throw new Error('ThemeProvider 안에서 사용해야 합니다.')
  return value
}
```

Context 값에 매 렌더링마다 새로 만든 큰 객체를 넣으면 소비자가 불필요하게 다시 렌더링될 수 있다. 먼저 Context를 책임별로 나누고 실제 병목을 측정한다.

## 5. Redux Toolkit: 큰 공유 상태와 추적 가능한 규칙

현대 Redux 코드는 Redux Toolkit 사용이 공식 권장 방식이다. 직접 action type 문자열과 불변 업데이트 보조 코드를 반복하기보다 `configureStore`와 `createSlice`를 사용한다.

```bash
npm install @reduxjs/toolkit react-redux
```

```tsx
// features/progress/progressSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type ProgressState = {
  completedTopics: string[]
}

const initialState: ProgressState = { completedTopics: [] }

const progressSlice = createSlice({
  name: 'progress',
  initialState,
  reducers: {
    topicCompleted(state, action: PayloadAction<string>) {
      // Redux Toolkit 내부의 Immer가 이 표현을 안전한 불변 업데이트로 변환한다.
      if (!state.completedTopics.includes(action.payload)) {
        state.completedTopics.push(action.payload)
      }
    },
  },
})

export const { topicCompleted } = progressSlice.actions
export default progressSlice.reducer
```

```tsx
// app/store.ts
import { configureStore } from '@reduxjs/toolkit'
import progressReducer from '../features/progress/progressSlice'

export const store = configureStore({
  // 기능별 slice reducer를 하나의 애플리케이션 state로 합친다.
  reducer: { progress: progressReducer },
})

// 타입을 직접 다시 쓰지 않고 실제 store 함수에서 추론한다.
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

컴포넌트는 전체 store를 구독하지 말고 필요한 최소 조각을 selector로 읽는다. 비동기 서버 데이터가 중심이면 RTK Query 포함 여부도 함께 판단한다.

## 6. Zustand: 작은 API의 외부 저장소

Zustand는 Provider 없이 Hook 형태의 store를 만들 수 있어 작은 전역 UI 상태에 간결하다. 간결하다는 이유로 서로 관계없는 모든 값을 store 하나에 모으지는 않는다.

```bash
npm install zustand
```

```tsx
import { create } from 'zustand'

type TimerStore = {
  minutes: number
  running: boolean
  start: () => void
  stop: () => void
  addMinute: () => void
}

export const useTimerStore = create<TimerStore>(set => ({
  minutes: 25,
  running: false,
  // set은 이전 store를 받아 변경할 필드만 반환할 수 있다.
  start: () => set({ running: true }),
  stop: () => set({ running: false }),
  addMinute: () => set(state => ({ minutes: state.minutes + 1 })),
}))

export function StudyTimer() {
  // selector로 필요한 값만 구독하면 관련 없는 store 변경의 영향을 줄인다.
  const minutes = useTimerStore(state => state.minutes)
  const addMinute = useTimerStore(state => state.addMinute)

  return (
    <button type="button" onClick={addMinute}>
      학습 시간: {minutes}분
    </button>
  )
}
```

## 7. 도구 비교

| 도구 | 잘 맞는 상황 | 먼저 확인할 문제 |
| --- | --- | --- |
| `useState` | 지역적이고 단순한 값 | 정말 공유가 필요한가? |
| `useReducer` | 사건 종류와 전이 규칙이 많음 | reducer를 순수하게 유지했는가? |
| Context | 깊은 트리에 비교적 안정적인 값 전달 | 값 변경이 너무 잦지 않은가? |
| Redux Toolkit | 여러 기능이 공유하고 추적·미들웨어가 중요 | 서버 캐시까지 무작정 넣지 않았는가? |
| Zustand | 간결한 외부 store와 선택 구독이 필요 | store가 잡동사니가 되지 않았는가? |

Redux Toolkit과 Zustand 중 절대적인 승자는 없다. 팀 경험, DevTools 요구, 비동기 처리 방식, 상태 규모, 테스트 전략을 기준으로 선택한다.

## 8. 적용 관점에서 다시 보기

state를 추가하기 전에 값의 소유자, 수명, 변경 사건, 서버에서 다시 얻을 수 있는지부터 적는다. 그 다음 가장 작은 도구로 시작하고 실제 전달 문제나 복잡성이 생겼을 때 범위를 넓힌다.

업데이트가 예상과 다르면 action, 이전 state, 다음 state를 확인한다. 외부 store에서는 selector가 너무 큰 객체를 반환하는지, 컴포넌트가 필요 이상으로 많은 상태를 구독하는지도 확인한다.

## 9. 요약 정리

- state는 사용하는 곳 가까이에 둔다.
- `useReducer`는 복잡한 상태 전이를 순수 함수에 모은다.
- Context는 저장소가 아니라 전달 통로다.
- Redux를 새로 사용한다면 Redux Toolkit이 권장 방식이다.
- Zustand는 간결하지만 store 책임을 나누는 설계가 여전히 필요하다.
- selector는 컴포넌트가 필요한 최소 상태만 읽게 한다.
- 서버 상태와 클라이언트 UI 상태를 구분한다.

🧠 기억할 것: 상태 관리 도구를 고르기 전에 상태의 소유자와 변경 사건을 먼저 설계한다.

## 10. 미니 퀴즈

1. Context와 `useReducer`는 각각 어떤 책임을 맡는가?
2. 새 Redux 코드에서 Redux Toolkit을 우선하는 이유는 무엇인가?
3. Zustand selector가 필요한 이유는 무엇인가?
4. API 응답을 전역 store에 복사하기 전에 무엇을 비교해야 하는가?

<details>
<summary>정답과 해설</summary>

1. reducer는 상태 전이를, Context는 값을 하위 트리로 전달하는 책임을 맡는다.
2. store 설정과 불변 업데이트의 반복을 줄이고 공식 권장 기본값과 실수 방지 기능을 제공하기 때문이다.
3. 필요한 조각만 구독해 변경의 영향을 좁히기 위해서다.
4. 서버 상태 캐시 도구가 제공하는 중복 제거, 재검증, 무효화가 필요한지 비교한다.

</details>

## 참고 자료

- [Redux Toolkit 개요](https://redux.js.org/redux-toolkit/overview/)
- [Redux Toolkit TypeScript 빠른 시작](https://redux.js.org/tutorials/typescript-quick-start)
- [Zustand 문서](https://zustand.docs.pmnd.rs/)
