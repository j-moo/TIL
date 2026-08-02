# TypeScript로 배우는 React Hook

- 🎯 글의 목표: 자주 쓰는 Hook의 역할을 구분하고, Hook 규칙과 의존성의 의미를 설명하며, 반복 로직을 커스텀 Hook으로 분리한다.
- 🧩 핵심 키워드: Hook, `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, 커스텀 Hook
- ⭐ 중요도: ★★★★★ — 함수 컴포넌트에서 상태와 외부 동기화를 다루는 기본 도구다.
- 📝 한눈에 보는 내용: Hook마다 해결하는 문제가 다르며, 렌더링마다 같은 순서로 호출되어야 한다. 메모이제이션 Hook은 정확성이 아니라 성능을 위한 선택이다.
- 🔗 관련 주제: state, Effect, Context, 성능 최적화
- 🧱 선수 지식: 함수 컴포넌트, state 스냅샷, 배열 구조 분해

---

컴포넌트가 UI를 계산하는 함수라면, Hook은 그 함수가 React의 state와 생명주기 기능에 연결되는 통로다. 이름이 모두 `use`로 시작해 비슷해 보이지만, 화면을 갱신할 값과 DOM 참조, 외부 동기화, 성능 캐시는 서로 다른 문제다. 먼저 문제를 구분한 뒤 맞는 Hook을 선택해야 한다.

## 1. Hook이란?

Hook은 함수 컴포넌트에서 state, context, ref, Effect 같은 React 기능을 사용하는 함수다. 이름은 `use`로 시작하며 다음 두 규칙을 지킨다.

1. 컴포넌트 또는 커스텀 Hook의 최상위에서 호출한다.
2. 일반 함수가 아니라 React 함수 컴포넌트나 커스텀 Hook 안에서 호출한다.

조건문·반복문·중첩 함수에서 호출하면 렌더링마다 Hook 호출 순서가 달라질 수 있다.

## 2. Hook별 역할

| Hook | 사용 목적 | 렌더링을 일으키는가? |
| --- | --- | --- |
| `useState` | 화면에 필요한 값을 기억 | setter 호출 시 |
| `useEffect` | 외부 시스템과 동기화 | 자체적으로는 아님 |
| `useRef` | DOM 또는 렌더링에 필요 없는 값을 보존 | `current` 변경만으로는 아님 |
| `useMemo` | 비용이 큰 계산 결과 캐시 | 아님 |
| `useCallback` | 함수 정의 캐시 | 아님 |
| `useContext` | 가장 가까운 Provider의 값 읽기 | 제공 값 변경 시 |

## 3. `useState`: 타입 추론과 명시

```tsx
import { useState } from 'react'

type LoadState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; reason: string }

function Notice() {
  // 여러 상태를 boolean 여러 개로 나누지 않고 하나의 판별 유니언으로 관리한다.
  const [state, setState] = useState<LoadState>({ status: 'idle' })

  // status를 검사하면 TypeScript가 해당 상태에 필요한 필드를 자동으로 좁힌다.
  if (state.status === 'success') return <p>{state.message}</p>
  if (state.status === 'error') return <p role="alert">{state.reason}</p>
  return <button onClick={() => setState({ status: 'success', message: '저장됨' })}>저장</button>
}
```

빈 배열이나 `null`로 시작하면 TypeScript가 지나치게 좁게 추론할 수 있으므로 `useState<Item[]>([])`, `useState<User | null>(null)`처럼 타입을 명시한다.

## 4. `useEffect`: 의존성은 선택 목록이 아니다

Effect 안에서 읽는 props, state, 컴포넌트 내부 함수 같은 반응형 값은 의존성에 포함한다. 의존성을 줄이고 싶다면 경고를 숨기지 말고 Effect의 책임을 다시 나눈다.

```tsx
useEffect(() => {
  // 이 Effect 실행에 대응하는 요청 취소 객체를 새로 만든다.
  const controller = new AbortController()

  // void는 Promise 결과를 여기서 기다리지 않음을 명시한다.
  void fetch(`/api/items?category=${category}`, { signal: controller.signal })

  // category가 바뀌거나 컴포넌트가 사라지면 이전 요청을 취소한다.
  return () => controller.abort()
}, [category])
```

## 5. `useRef`: 화면과 무관한 값을 보존

```tsx
import { useRef } from 'react'

function SearchBox() {
  // 아직 DOM이 연결되지 않았으므로 초기 current 값은 null이다.
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      {/* 렌더링이 커밋되면 React가 실제 input DOM을 current에 넣는다. */}
      <input ref={inputRef} />
      {/* optional chaining으로 DOM이 있을 때만 focus를 호출한다. */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
      >
        검색창으로 이동
      </button>
    </>
  )
}
```

`ref.current`를 렌더링 결과에 직접 사용하면 변경되어도 화면이 갱신되지 않는다. 화면에 보여야 하는 값은 state를 사용한다.

## 6. 메모이제이션은 정확성 도구가 아니다

```tsx
const visibleItems = useMemo(
  // items 또는 category가 바뀔 때만 필터 계산을 다시 수행한다.
  () => items.filter(item => item.category === category),
  [items, category],
)

const handleSelect = useCallback((id: string) => {
  // 함수의 역할은 ID를 선택 state에 저장하는 것이다.
  setSelectedId(id)
}, [])
```

`useMemo`와 `useCallback`은 성능 최적화다. 코드가 이 Hook 없이 틀리게 동작한다면 먼저 상태 설계나 Effect 의존성을 고쳐야 한다. 계산이 가볍거나 자식이 메모화되지 않았다면 캐시 비용만 늘 수 있다.

## 7. 커스텀 Hook

커스텀 Hook은 JSX가 아니라 **상태가 있는 로직**을 공유한다.

```tsx
import { useEffect, useState } from 'react'

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    // 컴포넌트가 제목을 바꾸기 전의 값을 cleanup에서 복원하기 위해 기억한다.
    const previousTitle = document.title
    document.title = title
    return () => {
      // 이 Hook을 사용한 컴포넌트가 사라지면 원래 문서 제목으로 되돌린다.
      document.title = previousTitle
    }
  }, [title])
}
```

각 컴포넌트가 이 Hook을 호출하면 로직은 공유하지만 state와 Effect 인스턴스는 서로 독립적이다.

## 8. 적용 관점에서 다시 보기

값이 바뀔 때 화면도 바뀌어야 하면 `useState`, 화면과 무관한 값을 보존하거나 DOM을 가리키려면 `useRef`를 검토한다. 외부 시스템과 동기화해야 할 때만 `useEffect`를 사용한다. 계산이 느리다는 실제 근거가 있을 때 `useMemo`, 메모화된 자식에게 안정적인 함수 참조가 필요할 때 `useCallback`을 고려한다.

Hook 관련 오류가 발생하면 호출 위치를 먼저 확인한다. 조건문, 반복문, 조기 반환 아래에서 Hook을 호출하면 렌더링마다 순서가 달라질 수 있다. 의존성 lint 경고는 배열에서 값을 지우라는 뜻이 아니라 Effect가 너무 많은 책임을 갖는지 확인하라는 신호다.

## 9. 배운 점 / 확장 포인트

### 9.1 새로 이해한 것

Hook은 임의의 편의 함수가 아니라 React가 호출 순서를 기준으로 state를 연결하는 특별한 함수다. 커스텀 Hook은 로직을 공유하지만 각 호출의 state는 독립적으로 유지한다.

### 9.2 이전·다음 학습과의 연결

state와 생명주기를 이해한 뒤 Hook을 보면 각 API의 목적이 구분된다. 이후 Context, 데이터 패칭, 성능 측정에서 여러 Hook을 조합하게 된다.

### 9.3 더 확인할 주제

- `useReducer`로 복잡한 상태 전이 관리
- `useContext`와 Provider 갱신 범위
- React Compiler와 수동 메모이제이션
- Effect Event와 최신 이벤트 로직

## 10. 요약 정리

- Hook은 최상위에서 항상 같은 순서로 호출한다.
- Effect는 외부 시스템 동기화에만 사용한다.
- ref 변경은 재렌더링을 일으키지 않는다.
- 메모이제이션은 측정 후 적용하는 성능 최적화다.
- 커스텀 Hook은 반복되는 상태 로직에 이름을 붙인다.

🧠 기억할 것: Hook 이름을 외우기보다 화면 값, 외부 동기화, 참조, 성능 캐시 중 어떤 문제인지 먼저 구분한다.

## 11. 미니 퀴즈

1. `useRef`와 `useState` 중 화면에 표시되는 카운트에 적합한 것은 무엇인가?
2. `useMemo`와 `useCallback`이 각각 캐시하는 것은 무엇인가?
3. 커스텀 Hook이 컴포넌트끼리 같은 state를 공유하게 하는가?

<details>
<summary>정답과 해설</summary>

1. `useState`다. setter 호출이 다시 렌더링을 예약하므로 바뀐 값을 화면에 반영할 수 있다.
2. `useMemo`는 계산 결과 값을, `useCallback`은 함수 정의를 의존성이 바뀔 때까지 재사용한다.
3. 아니다. 로직의 구조만 재사용하며 각 컴포넌트에서 호출된 Hook의 state는 별도 인스턴스다.

</details>

## 참고 자료

- [Built-in React Hooks](https://react.dev/reference/react/hooks)
- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [useMemo](https://react.dev/reference/react/useMemo)
- [useCallback](https://react.dev/reference/react/useCallback)
- [useRef](https://react.dev/reference/react/useRef)
