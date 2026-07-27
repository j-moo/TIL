# React 엘리먼트와 렌더링 흐름

- 🎯 글의 목표: React 엘리먼트가 실제 DOM과 어떻게 다른지 이해하고, 최초 렌더링과 state 변경 이후의 재렌더링을 실행 순서대로 설명한다.
- 🧩 핵심 키워드: React 엘리먼트, DOM, `createRoot`, Trigger, Render, Commit, state, Hook
- ⭐ 중요도: 상 — “함수가 언제 다시 실행되고 화면은 왜 바뀌는가?”를 이해하는 중심 개념이다.
- 📝 한눈에 보는 내용: 화면 갱신은 렌더링 요청 → 컴포넌트 호출 → DOM 반영 → 브라우저 표시 순서로 진행된다.
- 🔗 관련 주제: JSX, 컴포넌트, Props, 이벤트, `useState`, `useEffect`
- 🧱 선수 지식: 함수 호출, 콜백 함수, 배열 구조 분해 할당, DOM의 기본 개념

---

## 1. 들어가며

React 코드에서 “렌더링한다”는 말은 단순히 화면에 픽셀을 그린다는 뜻만 가리키지 않는다. React가 컴포넌트를 호출해 새로운 UI 결과를 계산하는 단계와 실제 DOM을 바꾸는 단계는 구분된다.

오늘 질문에서 가장 많이 헷갈린 부분도 이 구분이었다.

- `Counter` 함수 안의 `increase`는 어떻게 클릭 후에 실행되는가?
- `useState<number>(0)`에 초기값 하나를 넣었는데 왜 값과 함수 두 개를 받는가?
- `setCount()`를 호출하면 왜 `Counter`가 다시 실행되는가?
- `Clock` 함수가 끝났는데 어떻게 1초마다 시간이 바뀌는가?

이 질문들은 모두 렌더링의 실행 주체와 순서를 이해하면 하나로 연결된다.

## 2. 핵심 개념 정리

```text
[최초 렌더링 또는 state 변경]
              ↓ Trigger
[React가 컴포넌트 함수를 호출]
              ↓ Render
[새 JSX 결과를 이전 결과와 비교]
              ↓ Commit
[필요한 DOM만 생성하거나 변경]
              ↓ Paint
[브라우저가 화면에 표시]
```

각 단계의 주체를 구분한다.

| 단계 | 주체 | 하는 일 |
| --- | --- | --- |
| 이벤트 발생 | 사용자·브라우저 | 클릭이나 타이머 콜백 발생 |
| state 변경 요청 | React setter | 다음 state를 저장하고 렌더링을 예약 |
| Render | React | 컴포넌트 함수를 호출해 새 UI 결과 계산 |
| Commit | React DOM | 필요한 실제 DOM 변경 |
| Paint | 브라우저 | 변경된 화면을 픽셀로 표시 |

## 3. 본문 정리

### 3.1 React 엘리먼트와 DOM 엘리먼트

다음 JSX는 React 엘리먼트를 만든다.

```tsx
const element = <h1>안녕하세요</h1>
```

React 엘리먼트는 화면에 무엇을 보여줄지 설명하는 값이다. 반면 DOM 엘리먼트는 브라우저 문서 트리에 실제로 존재하고 JavaScript로 조작할 수 있는 노드다.

```text
React 엘리먼트
→ UI에 대한 가벼운 설명
→ 생성 후 직접 수정하지 않음

DOM 엘리먼트
→ 브라우저 문서 트리의 실제 노드
→ 화면 반영의 대상
```

“React 엘리먼트가 Virtual DOM 안에 있는 DOM 엘리먼트의 복사본”이라고만 외우면 두 개를 동일한 종류로 오해하기 쉽다. **React 엘리먼트는 UI 설명이고, React는 그 설명을 바탕으로 실제 DOM 작업을 결정한다**고 이해하는 편이 정확하다.

### 3.2 최초 렌더링 시작하기

Vite 기반 TypeScript 프로젝트의 `main.tsx`는 일반적으로 다음과 같은 흐름을 가진다.

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const container = document.getElementById('root')

if (!container) {
  throw new Error('#root 요소를 찾을 수 없습니다.')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

실행 순서는 다음과 같다.

```text
1. document.getElementById('root')
   → index.html의 실제 DOM 요소를 찾음

2. createRoot(container)
   → React가 관리할 루트를 만듦

3. root.render(<App />)
   → App을 처음 렌더링하도록 요청

4. React가 App 함수를 호출
   → 반환된 JSX를 바탕으로 DOM 생성
```

`createRoot()`만 호출해서는 화면이 생기지 않는다. `root.render()`가 최초 렌더링을 요청한다.

### 3.3 렌더링은 컴포넌트 함수를 호출하는 과정이다

```tsx
function Greeting() {
  return <h1>안녕하세요</h1>
}
```

React가 `<Greeting />`을 렌더링하면 개념적으로 다음 순서가 일어난다.

```text
React가 <Greeting /> 발견
→ Greeting() 호출
→ 반환된 JSX 확인
→ 하위 컴포넌트도 재귀적으로 호출
→ UI 결과 계산 완료
```

컴포넌트 함수는 화면이 유지되는 동안 계속 실행 중인 함수가 아니다.

```text
Greeting 실행
→ JSX 반환
→ 함수 실행 종료
```

나중에 Props나 state가 바뀌어 렌더링이 필요하면 React가 함수를 다시 호출한다.

### 3.4 Render와 Commit은 다르다

React가 컴포넌트를 다시 호출했다고 해서 실제 DOM이 모두 교체되는 것은 아니다.

```tsx
type ClockTextProps = {
  time: string
}

function ClockText({ time }: ClockTextProps) {
  return (
    <>
      <h1>{time}</h1>
      <input />
    </>
  )
}
```

`time`이 달라져 다시 렌더링되더라도 React는 새 결과와 이전 결과를 비교한다. `<input>`이 같은 위치에 그대로 있다면 필요한 `<h1>` 텍스트만 바꿀 수 있다.

```text
Render
→ 새 UI 결과 계산

Commit
→ 결과가 달라진 DOM 부분만 반영
```

📌 핵심: **재렌더링된 컴포넌트의 모든 DOM이 반드시 새로 만들어지는 것은 아니다.**

### 3.5 Counter로 이해하는 이벤트와 재렌더링

오늘 질문에서 사용한 코드를 TypeScript 기준으로 다시 보자.

```tsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState<number>(0)

  const increase = () => {
    setCount((previousCount) => previousCount + 1)
  }

  return (
    <button type="button" onClick={increase}>
      {count}
    </button>
  )
}
```

#### `increase`는 변수이면서 함수 값이다

```tsx
const increase = () => {
  setCount((previousCount) => previousCount + 1)
}
```

`increase`라는 지역 변수에 함수가 저장된다. 이 줄에서 함수 내부가 바로 실행되는 것은 아니다.

```tsx
onClick={increase}
```

React는 이 함수 참조를 이벤트 핸들러로 기억하고 사용자가 버튼을 클릭했을 때 호출한다.

```text
Counter 실행
→ increase 함수 생성
→ JSX의 onClick에 함수 전달
→ Counter 실행 종료
→ 사용자가 클릭
→ React가 increase 호출
```

다음 두 코드는 의미가 다르다.

```tsx
// 올바름: 함수를 전달
<button onClick={increase}>증가</button>

// 잘못됨: 렌더링 중 함수를 즉시 호출
<button onClick={increase()}>증가</button>
```

#### 지역 함수가 나중에도 값을 사용할 수 있는 이유

`increase`는 자신이 만들어질 때 접근할 수 있던 `setCount` 같은 값을 기억한다. 이런 JavaScript 성질을 클로저라고 한다.

React는 JSX를 통해 전달받은 함수 참조를 보관했다가 이벤트가 발생하면 실행한다. 따라서 `Counter()` 호출이 끝난 뒤에도 클릭 처리를 할 수 있다.

### 3.6 `useState`는 초기값이 아니라 두 값의 튜플을 반환한다

```tsx
const [count, setCount] = useState<number>(0)
```

여기서 `0`은 `useState`가 반환하는 값이 아니라 **최초 state의 초기값으로 전달하는 인수**다.

`useState`의 반환값은 정확히 두 항목을 가진 배열 형태다.

```text
[
  현재 state,
  state 변경을 요청하는 setter 함수
]
```

개념적으로 다음과 같다.

```tsx
const stateResult = useState<number>(0)

const count = stateResult[0]
const setCount = stateResult[1]
```

배열 구조 분해 할당으로 짧게 쓴 것이 다음 코드다.

```tsx
const [count, setCount] = useState<number>(0)
```

`setCount`는 사용자가 만든 이름이지만 함수 자체는 React가 제공한다. 이름은 바꿀 수 있으나 관례상 `[value, setValue]` 형태를 사용한다.

### 3.7 setter를 호출하면 다음 렌더링이 예약된다

```tsx
setCount((previousCount) => previousCount + 1)
```

이 코드는 일반 변수 `count`에 직접 값을 대입하는 것이 아니다.

```text
setCount 호출
→ React가 다음 state 계산을 큐에 넣음
→ Counter 재렌더링 예약
→ React가 Counter() 다시 호출
→ useState가 새 count 반환
→ 새 JSX 계산
→ 바뀐 버튼 텍스트를 DOM에 반영
```

현재 값으로 다음 값을 계산할 때는 updater 함수 형태가 안전하다.

```tsx
setCount((previousCount) => previousCount + 1)
```

여러 업데이트가 연속으로 예약되어도 React가 이전 값을 기준으로 차례대로 계산할 수 있기 때문이다.

### 3.8 Hook이란 무엇인가

Hook은 React 컴포넌트가 state나 Effect 같은 React 기능을 사용하도록 연결하는 함수다. 이름이 보통 `use`로 시작한다.

```text
useState
→ 렌더링 사이에 값을 기억

useEffect
→ 렌더링 결과가 화면에 반영된 뒤 외부 시스템과 동기화
```

Hook은 컴포넌트 최상위에서 호출해야 한다.

```tsx
function Counter() {
  const [count, setCount] = useState(0) // 올바름

  // 조건문, 반복문, 중첩 함수 안에서 Hook을 호출하지 않는다.
}
```

React가 여러 번의 렌더링에서 Hook 호출 순서를 기준으로 state를 연결하기 때문이다.

### 3.9 Clock으로 이해하는 렌더링 주체

다음 예제는 오늘 질문한 `Clock`의 핵심을 보여 준다.

```tsx
import { useEffect, useState } from 'react'

function Clock() {
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <h2>
      현재 시간: {currentTime.toLocaleTimeString('ko-KR')}
    </h2>
  )
}
```

함수마다 실행 주체가 다르다.

| 함수 | 실행 주체 | 실행 시점 |
| --- | --- | --- |
| `Clock` | React | 최초 렌더링과 state 변경 후 |
| Effect 함수 | React | Commit 후 Effect 설정 시 |
| interval 콜백 | 브라우저 | 약 1초마다 |
| cleanup 함수 | React | Effect 재설정 전 또는 컴포넌트 제거 시 |

전체 순서는 다음과 같다.

```text
[첫 렌더링]
React가 Clock 호출
→ useState가 최초 Date 저장
→ JSX 계산
→ DOM 반영
→ React가 Effect 실행
→ 브라우저에 interval 등록

[1초 후]
브라우저가 interval 콜백 호출
→ new Date() 생성
→ setCurrentTime 호출
→ React가 Clock 재렌더링 예약
→ React가 Clock 다시 호출
→ 새 시간으로 JSX 계산
→ 달라진 텍스트 DOM 반영
```

Clock이 1초 동안 기다리며 계속 실행되는 것이 아니다. 브라우저 타이머가 `setCurrentTime`을 호출하고, 그 state 변경 때문에 React가 Clock을 다시 실행한다.

#### 빈 의존성 배열의 정확한 의미

```tsx
useEffect(() => {
  // 타이머 설정
}, [])
```

빈 배열은 타이머 콜백을 한 번만 실행한다는 뜻이 아니다. **이 Effect의 설정을 렌더링마다 반복하지 않도록 지정**한 것이다.

```text
Effect 설정
→ 컴포넌트가 화면에 연결될 때 한 번

등록된 interval 콜백
→ 브라우저가 1초마다 계속 호출
```

개발 환경의 Strict Mode에서는 잘못된 정리 로직을 찾기 위해 Effect의 설정과 정리를 추가로 실행할 수 있다. 따라서 `clearInterval` 같은 cleanup이 중요하다.

## 4. 적용 관점에서 다시 보기

화면이 예상대로 바뀌지 않으면 다음을 확인한다.

1. 이벤트 핸들러를 호출하지 않고 함수로 전달했는가?
2. 일반 변수를 바꾼 것이 아니라 React setter를 호출했는가?
3. 렌더링 중에 state를 변경해 무한 반복을 만들지 않았는가?
4. 컴포넌트의 반환 JSX가 현재 Props와 state만으로 계산되는가?
5. Effect로 만든 타이머나 구독을 cleanup에서 제거했는가?

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

- 렌더링은 React가 컴포넌트 함수를 호출하는 과정이다.
- Commit은 실제 DOM에 필요한 변경을 반영하는 별도 단계다.
- 이벤트 함수는 JSX에 전달된 뒤 React가 나중에 실행할 수 있다.
- setter는 값을 직접 바꾸는 함수가 아니라 다음 렌더링을 요청하는 React 함수다.

### 5.2 이전·다음 학습과의 연결

JSX는 UI 결과를 표현하고, 컴포넌트는 그 JSX를 반환한다. 다음 문서에서는 컴포넌트가 Props를 통해 입력을 받고 같은 구조를 여러 데이터로 재사용하는 방법을 학습한다.

### 5.3 더 확인할 주제

- state를 스냅샷으로 이해하기
- 여러 state 업데이트의 큐 처리
- Effect가 필요한 경우와 필요하지 않은 경우

## 6. 요약 정리

1. React 엘리먼트는 UI 설명이고 DOM 엘리먼트는 브라우저의 실제 노드다.
2. 화면 갱신은 Trigger → Render → Commit → Paint로 구분할 수 있다.
3. 렌더링은 React가 컴포넌트 함수를 호출해 새 UI를 계산하는 과정이다.
4. 재렌더링이 일어나도 실제 DOM 전체가 반드시 교체되는 것은 아니다.
5. `onClick={increase}`는 함수를 전달하며 React가 클릭할 때 호출한다.
6. `useState`는 현재 state와 setter 함수 두 개를 반환한다.
7. setter 호출은 다음 state를 저장하고 컴포넌트 재렌더링을 예약한다.
8. Clock은 스스로 반복 실행되지 않고 브라우저 타이머와 state 변경으로 다시 렌더링된다.

🧠 기억할 것: React 컴포넌트는 화면을 계속 붙잡고 있는 함수가 아니라, React가 필요할 때 호출해 현재 UI를 한 번 계산하는 함수다.

## 7. 미니 퀴즈

1. Render와 Commit은 어떻게 다른가?
2. `onClick={increase}`가 클릭 전에 `increase`를 실행하지 않는 이유는 무엇인가?
3. `useState<number>(0)`의 인수와 반환값을 각각 설명해 보자.
4. `setCount(count + 1)`이 일반 변수 대입과 다른 점은 무엇인가?
5. Clock 함수, interval 콜백, cleanup 함수는 각각 누가 실행하는가?

<details>
<summary>정답과 해설</summary>

1. Render는 컴포넌트를 호출해 UI 결과를 계산하는 단계이고 Commit은 필요한 실제 DOM 변경을 반영하는 단계다.
2. `increase`의 결과가 아니라 함수 참조를 전달했기 때문에 React가 클릭 시점에 호출한다.
3. `0`은 최초 state의 초기값이고 반환값은 현재 state와 setter를 가진 두 항목의 배열이다.
4. setter는 다음 state를 React에 전달하고 재렌더링을 예약한다.
5. Clock과 cleanup은 React, interval 콜백은 브라우저가 실행한다.

</details>

## 참고 자료

- [React 공식 문서: Render and Commit](https://react.dev/learn/render-and-commit)
- [React 공식 문서: Responding to Events](https://react.dev/learn/responding-to-events)
- [React 공식 문서: useState](https://react.dev/reference/react/useState)
- [React 공식 문서: createRoot](https://react.dev/reference/react-dom/client/createRoot)
