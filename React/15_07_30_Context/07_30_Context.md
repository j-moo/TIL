# TypeScript로 안전한 Context 만들기

> 학습 목표: prop drilling과 Context의 차이를 이해하고, Provider 누락을 감지하는 커스텀 Hook을 만든다.

## 1. Context가 해결하는 문제

Context는 부모가 트리 아래의 여러 컴포넌트에 값을 제공하고, 중간 컴포넌트가 props를 전달하지 않아도 가장 가까운 Provider의 값을 읽게 한다. 테마, 현재 계정, 지역 설정처럼 멀리 떨어진 여러 곳에서 필요한 값에 적합하다.

Context를 쓰기 전에 다음을 검토한다.

1. 평범한 props 전달이 오히려 데이터 흐름을 선명하게 하지 않는가?
2. 컴포넌트를 추출하거나 JSX를 `children`으로 전달할 수 없는가?
3. 정말 서로 멀리 떨어진 여러 소비자가 같은 값을 필요로 하는가?

## 2. 타입이 안전한 Context

```tsx
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  const toggleTheme = () => {
    setTheme(current => current === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme은 ThemeProvider 내부에서 사용해야 합니다.')
  }
  return context
}
```

`null`을 의미 없는 기본값으로 두고 전용 Hook에서 검사하면 Provider 누락을 조용히 숨기지 않는다.

> React 19에서는 `<ThemeContext value={...}>`처럼 Context 자체를 Provider로 렌더링할 수 있다. React 18까지 함께 지원해야 한다면 위 예제처럼 `<ThemeContext.Provider>`를 사용한다.

## 3. 값의 범위와 갱신

- 소비자는 자신보다 위에 있는 가장 가까운 Provider 값을 읽는다.
- Provider 바깥에서는 `createContext`의 정적 기본값을 읽는다.
- Provider의 `value`가 바뀌면 그 Context를 읽는 소비자가 다시 렌더링된다.
- 서로 다른 Context는 독립적이며 중첩 Provider로 일부 트리의 값을 덮어쓸 수 있다.

## 4. Context에 모든 것을 넣지 않는다

Context는 state 저장소가 아니라 전달 통로다. 너무 자주 바뀌는 큰 객체 하나를 제공하면 관련 없는 소비자까지 갱신될 수 있다. 책임이 다르면 Context를 나누고, 복잡한 업데이트는 `useReducer`와 조합하는 것을 검토한다.

## 5. 요약과 복습

Context는 멀리 떨어진 소비자에게 공통 값을 전달하지만, 데이터 흐름을 덜 명시적으로 만든다. props와 합성을 먼저 검토하고 사용 범위를 작게 유지한다.

1. `createContext`의 기본값은 언제 사용되는가?
2. 중첩 Provider가 있을 때 소비자는 어느 값을 읽는가?
3. Context와 state 저장소는 어떻게 다른가?

## 참고 자료

- [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
- [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context)
- [`createContext`](https://react.dev/reference/react/createContext)
- [`useContext`](https://react.dev/reference/react/useContext)
