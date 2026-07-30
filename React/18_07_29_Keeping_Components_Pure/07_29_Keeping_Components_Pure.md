# 예측 가능한 React를 위한 순수 컴포넌트

- 🎯 글의 목표: 렌더링을 순수한 계산으로 유지하고 side effect를 이벤트와 Effect로 분리한다.
- 🧩 핵심 키워드: 순수 함수, 동일 입력·동일 출력, mutation, side effect, Strict Mode
- ⭐ 중요도: 상 — 재렌더링 순서가 달라도 안전하고 디버깅 가능한 컴포넌트를 만드는 기준이다.
- 📝 한눈에 보는 내용: 컴포넌트는 Props·state·context를 읽어 JSX를 계산하며 렌더링 중 기존 값을 변경하지 않는다.
- 🔗 관련 주제: 렌더링, Props, state, 이벤트, `useEffect`, 불변성
- 🧱 선수 지식: 함수, 객체와 배열, Props, 렌더링 흐름

---

## 1. 들어가며

React는 컴포넌트를 필요할 때 다시 호출한다. 개발 환경의 Strict Mode에서는 실수를 찾기 위해 컴포넌트를 추가로 호출할 수도 있다.

컴포넌트가 호출될 때마다 외부 변수를 바꾸거나 다른 컴포넌트의 데이터에 영향을 주면 실행 순서에 따라 결과가 달라진다. React는 이런 문제를 피하기 위해 컴포넌트를 순수 함수처럼 작성한다고 가정한다.

## 2. 핵심 개념 정리

순수 함수에는 두 가지 핵심 조건이 있다.

```text
1. 동일한 입력 → 동일한 출력
2. 함수 밖에 이미 존재하던 값이나 객체를 변경하지 않음
```

React 컴포넌트에 연결하면 다음과 같다.

```text
입력: Props + state + context
              ↓
       컴포넌트 렌더링
              ↓
출력: JSX

렌더링 중 외부 값 변경 없음
```

## 3. 본문 정리

### 3.1 같은 입력이면 같은 JSX를 반환한다

```tsx
type PriceProps = {
  price: number
  quantity: number
}

function TotalPrice({ price, quantity }: PriceProps) {
  return <p>총액: {(price * quantity).toLocaleString()}원</p>
}
```

`price`와 `quantity`가 같으면 언제 호출해도 같은 JSX를 반환한다.

```text
price=1000, quantity=3
→ 언제 렌더링해도 총액 3,000원
```

수학 공식처럼 입력으로 결과를 계산하기 때문에 호출 횟수나 순서에 의존하지 않는다.

### 3.2 렌더링 중 외부 변수를 변경하면 순수하지 않다

```tsx
let guestNumber = 0

function Cup() {
  guestNumber += 1

  return <p>{guestNumber}번 손님의 차</p>
}

function TeaSet() {
  return (
    <>
      <Cup />
      <Cup />
      <Cup />
    </>
  )
}
```

`Cup`은 함수 밖의 `guestNumber`를 변경한다. 호출 횟수와 순서에 따라 결과가 달라진다.

```text
Cup 첫 호출 → 1
Cup 두 번째 호출 → 2

다시 렌더링
→ 이전 값에서 계속 증가
```

Props로 필요한 값을 명시적으로 전달한다.

```tsx
type CupProps = {
  guestNumber: number
}

function Cup({ guestNumber }: CupProps) {
  return <p>{guestNumber}번 손님의 차</p>
}

function TeaSet() {
  return (
    <>
      <Cup guestNumber={1} />
      <Cup guestNumber={2} />
      <Cup guestNumber={3} />
    </>
  )
}
```

이제 각 `Cup`은 자신의 입력만으로 JSX를 계산한다.

### 3.3 Props를 직접 변경하지 않는다

```tsx
type User = {
  name: string
  score: number
}

function Score({ user }: { user: User }) {
  // 잘못된 예: 부모가 전달한 객체를 직접 변경
  user.score += 10

  return <p>{user.score}점</p>
}
```

객체 Props는 참조로 전달된다. 자식이 수정하면 부모와 다른 컴포넌트가 보는 값도 바뀔 수 있다.

표시용 값이 필요하면 새 값을 계산한다.

```tsx
function Score({ user }: { user: User }) {
  const bonusScore = user.score + 10

  return <p>{bonusScore}점</p>
}
```

Props와 state는 현재 렌더링의 읽기 전용 스냅샷으로 취급한다.

### 3.4 렌더링 안에서 만든 지역 값은 사용할 수 있다

순수 함수라고 해서 함수 안에서 변수를 만들거나 배열에 값을 넣을 수 없는 것은 아니다.

```tsx
type GuestListProps = {
  count: number
}

function GuestList({ count }: GuestListProps) {
  const guests: number[] = []

  for (let guest = 1; guest <= count; guest += 1) {
    guests.push(guest)
  }

  return (
    <ul>
      {guests.map((guest) => (
        <li key={guest}>{guest}번 손님</li>
      ))}
    </ul>
  )
}
```

`guests` 배열은 이번 함수 호출 안에서 새로 생성됐다. 다른 렌더링이나 외부 코드가 이 배열을 공유하지 않으므로 지역 변경은 안전하다.

```text
문제가 되는 변경
→ 렌더링 전에 이미 존재한 외부 값 변경

허용되는 지역 변경
→ 현재 렌더링 안에서 새로 만든 값 구성
```

### 3.5 렌더링마다 달라지는 값을 바로 읽을 때 주의한다

```tsx
function CurrentTime() {
  return <p>{new Date().toLocaleTimeString('ko-KR')}</p>
}
```

같은 입력이어도 호출 시각에 따라 결과가 달라지므로 엄밀히 같은 입력·같은 출력이 아니다. 또한 시간이 흘러도 React가 자동으로 재렌더링하지 않으므로 시계처럼 동작하지 않는다.

시간을 화면 상태로 관리하려면 이전 Clock 예제처럼 state와 Effect로 외부 타이머에 동기화한다.

```tsx
import { useEffect, useState } from 'react'

function Clock() {
  const [time, setTime] = useState<Date>(() => new Date())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  return <p>{time.toLocaleTimeString('ko-KR')}</p>
}
```

렌더링은 현재 state를 읽어 JSX를 계산하고, 시간 갱신은 렌더링 밖의 Effect와 브라우저 타이머가 담당한다.

### 3.6 side effect는 렌더링 밖에서 실행한다

Side effect는 함수의 반환값 계산 이외에 외부 세계를 변경하거나 상호작용하는 작업이다.

```text
서버 요청
타이머 등록
브라우저 저장소 변경
DOM API 직접 호출
로그 전송
state 변경
```

사용자 행동에 대한 작업은 이벤트 핸들러에 둔다.

```tsx
function SaveButton() {
  const handleClick = () => {
    console.log('저장을 요청했습니다.')
  }

  return (
    <button type="button" onClick={handleClick}>
      저장
    </button>
  )
}
```

이벤트 핸들러는 렌더링 중이 아니라 사용자가 클릭했을 때 실행되므로 side effect를 둘 수 있다.

외부 시스템과 화면을 동기화해야 하고 적절한 이벤트가 없다면 Effect를 고려한다. Effect는 편의를 위한 모든 작업을 넣는 장소가 아니라 렌더링 이후 동기화가 필요한 경우에 사용한다.

### 3.7 렌더링 중 setter를 호출하지 않는다

```tsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)

  // 잘못된 예: 렌더링할 때마다 다시 렌더링을 요청
  setCount(count + 1)

  return <p>{count}</p>
}
```

```text
Counter 렌더링
→ setCount 호출
→ 새 렌더링 예약
→ Counter 렌더링
→ setCount 호출
→ 반복
```

React는 너무 많은 재렌더링 오류를 발생시킨다. state 변경은 일반적으로 이벤트 핸들러나 필요한 Effect에서 실행한다.

### 3.8 Strict Mode가 두 번 호출하는 이유

개발 환경에서 Strict Mode는 컴포넌트 함수나 일부 초기화 로직을 추가로 호출해 순수하지 않은 코드를 찾도록 돕는다.

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

순수한 컴포넌트는 두 번 계산해도 외부 상태를 바꾸지 않으므로 결과가 달라지지 않는다.

📌 Strict Mode의 추가 호출은 개발 환경의 검사 동작이다. 프로덕션에서 사용자 화면을 두 번 만든다는 뜻이 아니다.

로그가 두 번 찍힌다는 이유로 Strict Mode를 바로 제거하기보다 렌더링 중 side effect가 있는지 확인한다.

### 3.9 배열과 객체 state도 직접 수정하지 않는다

```tsx
type Task = {
  id: number
  title: string
}

// 직접 수정하는 방식
tasks.push(newTask)

// 새 배열을 만드는 방식
setTasks((previousTasks) => [...previousTasks, newTask])
```

React는 state setter를 통해 새 값을 전달받아 렌더링을 예약한다. 기존 배열을 직접 수정하면 변경을 추적하기 어렵고 이전 렌더링의 스냅샷까지 영향을 받을 수 있다.

객체도 복사해 새 값을 만든다.

```tsx
setUser((previousUser) => ({
  ...previousUser,
  name: '이서준',
}))
```

## 4. 적용 관점에서 다시 보기

컴포넌트를 작성한 뒤 다음 질문으로 확인한다.

1. 같은 Props와 state로 호출하면 같은 JSX가 나오는가?
2. 렌더링 중 함수 밖 변수나 전달받은 객체를 변경하는가?
3. Props와 state를 읽기 전용으로 다루는가?
4. 사용자 행동에 따른 변경이 이벤트 핸들러에 있는가?
5. 외부 시스템 동기화만 Effect에 있는가?
6. Strict Mode에서 추가 호출되어도 결과가 안전한가?

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

- 순수 컴포넌트는 호출 횟수와 순서에 의존하지 않는다.
- 렌더링 안에서 새로 만든 지역 객체의 변경은 외부에 영향을 주지 않으므로 가능하다.
- side effect는 이벤트 핸들러나 필요한 Effect로 렌더링과 분리한다.

### 5.2 이전·다음 학습과의 연결

조건부 렌더링과 리스트 렌더링은 모두 Props와 state를 JSX로 바꾸는 계산이다. 이 계산을 순수하게 유지해야 React가 렌더링을 다시 시작하거나 반복해도 안전하다. 다음 단계에서는 이벤트와 state를 더 깊게 학습한다.

### 5.3 더 확인할 주제

- state를 스냅샷으로 이해하기
- 객체와 배열 state 업데이트
- Effect가 필요하지 않은 경우

## 6. 요약 정리

1. React는 컴포넌트를 순수 함수처럼 작성한다고 가정한다.
2. 같은 Props·state·context에는 같은 JSX를 반환해야 한다.
3. 렌더링 중 기존 외부 변수, Props, state를 직접 변경하지 않는다.
4. 현재 렌더링 안에서 새로 만든 지역 값은 구성할 수 있다.
5. 사용자 행동에 따른 side effect는 이벤트 핸들러에 둔다.
6. 외부 시스템 동기화가 필요할 때 Effect를 사용한다.
7. Strict Mode는 개발 중 순수하지 않은 렌더링을 발견하도록 추가 호출할 수 있다.
8. 배열과 객체 state는 직접 수정하지 않고 새 값으로 만들어 setter에 전달한다.

🧠 기억할 것: 컴포넌트의 렌더링은 외부를 바꾸는 작업이 아니라 현재 입력으로 JSX를 계산하는 과정이다.

## 7. 미니 퀴즈

1. 순수 함수의 두 가지 조건은 무엇인가?
2. 함수 안에서 새로 만든 배열에 `push()`하는 것이 가능한 이유는 무엇인가?
3. 서버 요청이나 타이머 등록을 렌더링 중 실행하면 안 되는 이유는 무엇인가?
4. Strict Mode에서 로그가 두 번 보일 때 먼저 무엇을 확인해야 하는가?

<details>
<summary>정답과 해설</summary>

1. 같은 입력에 같은 출력을 내고 호출 전에 존재하던 외부 값을 변경하지 않는 것이다.
2. 현재 렌더링에서만 사용하는 지역 값이라 다른 코드나 렌더링에 영향을 주지 않기 때문이다.
3. 렌더링은 여러 번 또는 중단 후 다시 실행될 수 있어 side effect가 중복되거나 예측 불가능해질 수 있기 때문이다.
4. 컴포넌트 렌더링 중 외부 값 변경이나 side effect가 있는지 확인한다.

</details>

## 참고 자료

- [React 공식 문서: Keeping Components Pure](https://react.dev/learn/keeping-components-pure)
- [React 공식 규칙: Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
