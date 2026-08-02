# TypeScript로 안전한 Context 만들기

- 🎯 글의 목표: prop drilling과 Context의 차이를 이해하고, Provider 누락을 감지하는 커스텀 Hook을 만든다.
- 🧩 핵심 키워드: Context, Provider, `createContext`, `useContext`, prop drilling, 기본값
- ⭐ 중요도: ★★★★☆ — 멀리 떨어진 컴포넌트가 공통 값을 사용할 때 데이터 전달 책임을 정한다.
- 📝 한눈에 보는 내용: Context는 트리 위에서 값을 제공하고 아래의 소비자가 가장 가까운 Provider 값을 읽게 한다. 편리하지만 데이터 흐름이 숨겨질 수 있어 사용 범위를 신중히 정한다.
- 🔗 관련 주제: Props, 합성, state 끌어올리기, `useReducer`
- 🧱 선수 지식: 컴포넌트 트리, Props, 커스텀 Hook

---

Props는 데이터가 어디에서 어디로 이동하는지 명확히 보여 준다. 하지만 중간 컴포넌트가 사용하지 않는 값을 여러 단계에 걸쳐 전달만 하면 코드가 장황해진다. Context는 특정 하위 트리에 공통 값을 제공해 이 문제를 해결한다.

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

// Provider가 없을 때 의미 있는 값이 없으므로 null을 기본값으로 둔다.
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 실제로 바뀌는 값은 Context가 아니라 Provider 컴포넌트의 state가 소유한다.
  const [theme, setTheme] = useState<Theme>('light')

  const toggleTheme = () => {
    // 현재 테마를 기준으로 다음 테마를 계산한다.
    setTheme(current => current === 'light' ? 'dark' : 'light')
  }

  // value에 담긴 값은 이 Provider 아래의 모든 소비자가 읽을 수 있다.
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  // 현재 컴포넌트보다 위에 있는 가장 가까운 Provider 값을 읽는다.
  const context = useContext(ThemeContext)
  if (context === null) {
    // Provider 누락을 조용히 숨기지 않고 원인을 바로 알 수 있게 한다.
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

## 5. 적용 관점에서 다시 보기

테마, 현재 계정, 언어처럼 서로 멀리 떨어진 여러 소비자가 같은 값을 필요로 할 때 Context를 떠올린다. 한두 단계 Props 전달이 번거롭다는 이유만으로 바로 Context를 만들기보다 합성과 컴포넌트 추출을 먼저 검토한다.

값이 갱신되지 않으면 소비자보다 Provider가 실제로 위에 있는지, 같은 Context 객체를 import했는지, Provider의 `value`가 새 값으로 바뀌는지 확인한다. 큰 객체 하나에 자주 바뀌는 값을 모두 넣었다면 책임별 Context 분리도 고려한다.

## 6. 배운 점 / 확장 포인트

### 6.1 새로 이해한 것

Context 자체가 state를 저장하는 것은 아니다. Provider가 받은 `value`를 전달하고, 소비자는 가장 가까운 Provider의 현재 값을 읽는다.

### 6.2 이전·다음 학습과의 연결

state 끌어올리기로 소유자를 정한 뒤 전달 거리가 너무 길어질 때 Context를 사용할 수 있다. 복잡한 변경 로직은 `useReducer`와 결합할 수 있다.

### 6.3 더 확인할 주제

- Context와 `useReducer` 조합
- Context 값의 불필요한 재생성
- 서버 상태 캐시와 Context의 차이

## 7. 요약 정리

Context는 멀리 떨어진 소비자에게 공통 값을 전달하지만, 데이터 흐름을 덜 명시적으로 만든다. props와 합성을 먼저 검토하고 사용 범위를 작게 유지한다.

🧠 기억할 것: Context는 값을 저장하는 장소가 아니라, 상위 컴포넌트가 소유한 값을 하위 트리에 전달하는 통로다.

## 8. 미니 퀴즈

1. `createContext`의 기본값은 언제 사용되는가?
2. 중첩 Provider가 있을 때 소비자는 어느 값을 읽는가?
3. Context와 state 저장소는 어떻게 다른가?

<details>
<summary>정답과 해설</summary>

1. 소비자 위에 해당 Context의 Provider가 하나도 없을 때만 사용된다.
2. 컴포넌트에서 위쪽으로 탐색했을 때 가장 가까운 Provider 값을 읽는다.
3. state는 값을 소유하고 setter로 갱신한다. Context는 다른 컴포넌트가 소유한 값을 트리 아래로 전달한다.

</details>

## 참고 자료

- [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
- [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context)
- [`createContext`](https://react.dev/reference/react/createContext)
- [`useContext`](https://react.dev/reference/react/useContext)
