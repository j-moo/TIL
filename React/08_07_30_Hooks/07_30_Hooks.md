# TypeScript로 배우는 React Hook

> 학습 목표: 자주 쓰는 Hook의 역할을 구분하고, Hook 규칙과 의존성의 의미를 설명하며, 반복 로직을 커스텀 Hook으로 분리한다.

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
  const [state, setState] = useState<LoadState>({ status: 'idle' })

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
  const controller = new AbortController()

  void fetch(`/api/items?category=${category}`, { signal: controller.signal })

  return () => controller.abort()
}, [category])
```

## 5. `useRef`: 화면과 무관한 값을 보존

```tsx
import { useRef } from 'react'

function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input ref={inputRef} />
      <button type="button" onClick={() => inputRef.current?.focus()}>
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
  () => items.filter(item => item.category === category),
  [items, category],
)

const handleSelect = useCallback((id: string) => {
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
    const previousTitle = document.title
    document.title = title
    return () => {
      document.title = previousTitle
    }
  }, [title])
}
```

각 컴포넌트가 이 Hook을 호출하면 로직은 공유하지만 state와 Effect 인스턴스는 서로 독립적이다.

## 8. 요약과 복습

- Hook은 최상위에서 항상 같은 순서로 호출한다.
- Effect는 외부 시스템 동기화에만 사용한다.
- ref 변경은 재렌더링을 일으키지 않는다.
- 메모이제이션은 측정 후 적용하는 성능 최적화다.
- 커스텀 Hook은 반복되는 상태 로직에 이름을 붙인다.

1. `useRef`와 `useState` 중 화면에 표시되는 카운트에 적합한 것은 무엇인가?
2. `useMemo`와 `useCallback`이 각각 캐시하는 것은 무엇인가?
3. 커스텀 Hook이 컴포넌트끼리 같은 state를 공유하게 하는가?

## 참고 자료

- [Built-in React Hooks](https://react.dev/reference/react/hooks)
- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [useMemo](https://react.dev/reference/react/useMemo)
- [useCallback](https://react.dev/reference/react/useCallback)
- [useRef](https://react.dev/reference/react/useRef)
