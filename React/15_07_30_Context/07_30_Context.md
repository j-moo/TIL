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

### 기본값은 자동 복구 값이 아니다

`createContext(defaultValue)`의 기본값은 Provider의 `value`가 `undefined`일 때 대신 사용되는 값이 아니다. 컴포넌트 위에 Provider가 **전혀 없을 때** 읽는 정적인 대체 값이다. Provider가 `undefined`를 제공하면 소비자도 `undefined`를 받는다.

기본값이 의미 있는 테스트용 값인지, Provider 누락을 오류로 취급할지 먼저 결정한다. 앱에서 Provider가 필수라면 `null`과 전용 Hook 검사가 실수를 빨리 드러낸다.

### Provider를 기준으로 범위를 생각한다

Context 값은 전역 변수처럼 애플리케이션 전체에 하나만 존재하지 않는다. Provider마다 별도의 범위를 만들 수 있다.

```tsx
function App() {
  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {} }}>
      <Header />

      {/* 이 하위 트리는 더 가까운 dark 값을 읽는다. */}
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: () => {} }}>
        <PreviewPanel />
      </ThemeContext.Provider>
    </ThemeContext.Provider>
  )
}
```

`Header`는 바깥 Provider의 light를, `PreviewPanel`은 가까운 안쪽 Provider의 dark를 읽는다. 이 성질은 미리보기, 계정 전환 영역, 서로 다른 테마의 위젯을 독립적으로 구성할 때 유용하다.

## 4. Context에 모든 것을 넣지 않는다

Context는 state 저장소가 아니라 전달 통로다. 너무 자주 바뀌는 큰 객체 하나를 제공하면 관련 없는 소비자까지 갱신될 수 있다. 책임이 다르면 Context를 나누고, 복잡한 업데이트는 `useReducer`와 조합하는 것을 검토한다.

Provider가 다시 렌더링될 때 객체 리터럴과 함수도 새 참조가 된다. Context를 읽는 화면에서 실제 성능 문제가 확인됐다면 값과 동작 Context를 나누거나 안정적인 값을 제공하는 방식을 검토할 수 있다. 하지만 `useMemo`를 무조건 붙이는 것으로 시작하지 않는다. 먼저 Provider의 범위와 state 책임이 지나치게 넓지 않은지 확인한다.

```tsx
import { useCallback, useMemo, useState, type ReactNode } from 'react'

type ThemeValue = { theme: Theme; toggleTheme: () => void }

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  const toggleTheme = useCallback(() => {
    setTheme(current => current === 'light' ? 'dark' : 'light')
  }, [])

  // theme이나 toggleTheme이 바뀔 때만 새 value 객체를 만든다.
  const value = useMemo<ThemeValue>(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
```

이 최적화는 Context의 의미를 바꾸지 않는다. 소비자가 실제로 자주 렌더링되고 비용이 있다는 근거가 있을 때 적용한다.

## 5. Context와 전역 상태·서버 상태의 차이

Context는 값을 전달하지만, 선택 구독, 캐시 만료, 요청 중복 제거, 낙관적 업데이트 같은 기능을 자동으로 제공하지 않는다.

| 문제 | 먼저 검토할 도구 |
| --- | --- |
| 테마·언어·현재 사용자 정보를 하위 트리에 전달 | Context |
| 한 컴포넌트의 입력·열림 상태 | 지역 state |
| 복잡하지만 한 트리 안에서 공유하는 상태 전이 | reducer + Context |
| API 데이터 캐시·재검증·요청 상태 | 서버 상태 라이브러리 또는 프레임워크 기능 |
| 매우 잦은 변경과 선택적 구독이 필요한 클라이언트 상태 | 외부 store 검토 |

도구 이름보다 데이터의 출처와 수명을 먼저 본다. 서버가 원본인 데이터를 Context 객체에 복사해 두면 새로고침, 캐시 무효화, 오류 복구를 직접 설계해야 한다.

## 6. 적용 관점에서 다시 보기

테마, 현재 계정, 언어처럼 서로 멀리 떨어진 여러 소비자가 같은 값을 필요로 할 때 Context를 떠올린다. 한두 단계 Props 전달이 번거롭다는 이유만으로 바로 Context를 만들기보다 합성과 컴포넌트 추출을 먼저 검토한다.

값이 갱신되지 않으면 소비자보다 Provider가 실제로 위에 있는지, 같은 Context 객체를 import했는지, Provider의 `value`가 새 값으로 바뀌는지 확인한다. 큰 객체 하나에 자주 바뀌는 값을 모두 넣었다면 책임별 Context 분리도 고려한다.

## 7. 배운 점 / 확장 포인트

### 7.1 새로 이해한 것

Context 자체가 state를 저장하는 것은 아니다. Provider가 받은 `value`를 전달하고, 소비자는 가장 가까운 Provider의 현재 값을 읽는다.

### 7.2 이전·다음 학습과의 연결

state 끌어올리기로 소유자를 정한 뒤 전달 거리가 너무 길어질 때 Context를 사용할 수 있다. 복잡한 변경 로직은 `useReducer`와 결합할 수 있다.

### 7.3 더 확인할 주제

- Context와 `useReducer` 조합
- Context 값의 불필요한 재생성
- 서버 상태 캐시와 Context의 차이

## 8. 요약 정리

Context는 멀리 떨어진 소비자에게 공통 값을 전달하지만, 데이터 흐름을 덜 명시적으로 만든다. props와 합성을 먼저 검토하고 사용 범위를 작게 유지한다.

🧠 기억할 것: Context는 값을 저장하는 장소가 아니라, 상위 컴포넌트가 소유한 값을 하위 트리에 전달하는 통로다.

## 9. 미니 퀴즈

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
