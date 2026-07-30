# TypeScript로 배우는 컴포넌트와 Props

- 🎯 글의 목표: UI를 컴포넌트로 나누고 TypeScript로 Props의 형태를 정의해 부모와 자식 사이에 데이터를 안전하게 전달한다.
- 🧩 핵심 키워드: 함수 컴포넌트, Props, 구조 분해 할당, `children`, 이벤트 Props, 단방향 데이터 흐름
- ⭐ 중요도: 상 — React 애플리케이션을 재사용 가능한 단위로 설계하는 기본 방법이다.
- 📝 한눈에 보는 내용: 컴포넌트는 JSX를 반환하는 함수이고, Props는 부모가 자식에게 전달하는 읽기 전용 입력이다.
- 🔗 관련 주제: JSX, 렌더링, state, 이벤트 처리
- 🧱 선수 지식: 함수의 매개변수와 반환값, 객체 타입, 구조 분해 할당

---

## 1. 들어가며

같은 사용자 카드가 여러 개 필요할 때 매번 마크업을 복사하면 수정 지점이 늘어난다. React에서는 반복되는 UI 구조를 컴포넌트라는 함수로 만들고, 달라지는 값만 Props로 전달한다.

```text
공통 UI 구조
→ 컴포넌트

사용자마다 달라지는 이름·역할·이미지
→ Props
```

TypeScript를 사용하면 컴포넌트가 어떤 Props를 요구하는지 코드에 명시할 수 있고, 잘못된 값이나 빠진 값을 실행 전에 발견할 수 있다.

## 2. 핵심 개념 정리

```text
부모 컴포넌트
  <ProfileCard name="이서준" role="학습자" />
                    ↓ Props 전달
자식 컴포넌트
  ProfileCard({ name, role })
                    ↓ JSX 반환
React 렌더링
                    ↓
화면에 사용자 카드 표시
```

함수와 비교하면 이해하기 쉽다.

```ts
function add(a: number, b: number) {
  return a + b
}
```

```text
일반 함수
→ 매개변수를 입력받아 값을 반환

React 함수 컴포넌트
→ Props 객체를 입력받아 JSX를 반환
```

## 3. 본문 정리

### 3.1 컴포넌트는 UI를 반환하는 함수다

```tsx
function Welcome() {
  return <h1>React를 공부합니다.</h1>
}
```

컴포넌트 이름은 대문자로 시작해야 한다.

```tsx
// 사용자 컴포넌트
<Welcome />

// 브라우저의 내장 HTML 요소
<button />
```

React는 소문자로 시작하는 JSX 태그를 `div`, `button` 같은 내장 태그로 해석하고 대문자로 시작하는 태그를 사용자 컴포넌트로 해석한다.

### 3.2 컴포넌트 정의와 사용

```tsx
function Profile() {
  return (
    <article>
      <h2>이서준</h2>
      <p>React 학습 중</p>
    </article>
  )
}

function App() {
  return (
    <main>
      <Profile />
      <Profile />
    </main>
  )
}
```

`App`을 렌더링하는 과정에서 React는 `<Profile />`을 발견하고 `Profile()`을 호출한다. 같은 컴포넌트를 여러 번 사용할 수 있지만 현재 코드는 표시 내용도 모두 같다. 달라지는 값을 Props로 전달한다.

### 3.3 Props는 부모가 전달하는 입력값이다

```tsx
type ProfileProps = {
  name: string
  role: string
}

function Profile({ name, role }: ProfileProps) {
  return (
    <article>
      <h2>{name}</h2>
      <p>{role}</p>
    </article>
  )
}

function App() {
  return (
    <main>
      <Profile name="이서준" role="React 학습자" />
      <Profile name="홍길동" role="TypeScript 학습자" />
    </main>
  )
}
```

부모인 `App`이 JSX 속성 형태로 값을 전달한다.

```tsx
<Profile name="이서준" role="React 학습자" />
```

React는 전달된 값을 하나의 Props 객체로 자식 컴포넌트에 넘긴다.

```ts
{
  name: '이서준',
  role: 'React 학습자'
}
```

자식은 객체 구조 분해 할당으로 필요한 값을 꺼낸다.

```tsx
function Profile({ name, role }: ProfileProps) {
  // ...
}
```

### 3.4 TypeScript로 Props 타입 정의하기

Props는 `type` 또는 `interface`로 정의할 수 있다.

```tsx
interface AvatarProps {
  imageUrl: string
  alt: string
  size: number
}

function Avatar({ imageUrl, alt, size }: AvatarProps) {
  return (
    <img
      src={imageUrl}
      alt={alt}
      width={size}
      height={size}
    />
  )
}
```

다음 사용은 올바르다.

```tsx
<Avatar imageUrl="/profile.png" alt="이서준 프로필" size={120} />
```

다음 사용은 TypeScript 오류가 발생한다.

```tsx
// size는 number여야 한다.
<Avatar imageUrl="/profile.png" alt="프로필" size="large" />
```

Props가 단순하면 인라인 타입도 가능하지만, 항목이 늘어나면 별도의 타입이 읽기 쉽다.

```tsx
function Label({ text }: { text: string }) {
  return <span>{text}</span>
}
```

### 3.5 선택적 Props와 기본값

물음표를 사용하면 선택적 Props가 된다.

```tsx
type ButtonProps = {
  label: string
  disabled?: boolean
}

function Button({ label, disabled = false }: ButtonProps) {
  return (
    <button type="button" disabled={disabled}>
      {label}
    </button>
  )
}
```

```tsx
<Button label="저장" />
<Button label="처리 중" disabled />
```

`disabled`가 전달되지 않으면 구조 분해 할당의 기본값 `false`를 사용한다.

선택적 Props는 컴포넌트가 실제로 값 없이도 올바르게 동작할 수 있을 때만 사용한다. 필요한 값을 습관적으로 선택 사항으로 만들면 `undefined` 처리가 늘어난다.

### 3.6 객체, 배열, 함수도 Props로 전달할 수 있다

Props는 문자열뿐 아니라 모든 JavaScript 값을 전달할 수 있다.

```tsx
type User = {
  id: number
  name: string
}

type UserListProps = {
  users: User[]
  onSelect: (user: User) => void
}

function UserList({ users, onSelect }: UserListProps) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          <button type="button" onClick={() => onSelect(user)}>
            {user.name}
          </button>
        </li>
      ))}
    </ul>
  )
}
```

함수 타입 `(user: User) => void`는 “User 하나를 받고 반환값은 사용하지 않는 함수”라는 뜻이다.

### 3.7 이벤트 처리 함수를 Props로 전달하기

오늘 질문의 `onClick={increase}`도 Props 전달의 한 형태다. 내장 `<button>`에 `onClick` Props로 함수를 넘긴다.

사용자 컴포넌트에도 이벤트 함수를 전달할 수 있다.

```tsx
type CounterButtonProps = {
  count: number
  onIncrease: () => void
}

function CounterButton({ count, onIncrease }: CounterButtonProps) {
  return (
    <button type="button" onClick={onIncrease}>
      현재 값: {count}
    </button>
  )
}
```

부모가 실제 동작을 정의한다.

```tsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState<number>(0)

  const handleIncrease = () => {
    setCount((previousCount) => previousCount + 1)
  }

  return (
    <CounterButton
      count={count}
      onIncrease={handleIncrease}
    />
  )
}
```

```text
부모 Counter
→ state와 변경 로직을 가짐
→ count와 handleIncrease를 Props로 전달

자식 CounterButton
→ 받은 값을 화면에 표시
→ 클릭 시 받은 함수를 실행
```

자식은 부모의 state를 직접 변경하지 않는다. 부모가 전달한 이벤트 함수를 호출해 변경을 요청한다.

### 3.8 `children`은 태그 사이의 내용이다

```tsx
import type { ReactNode } from 'react'

type CardProps = {
  title: string
  children: ReactNode
}

function Card({ title, children }: CardProps) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}
```

사용할 때 태그 사이에 넣은 JSX가 `children` Props로 전달된다.

```tsx
<Card title="오늘의 학습">
  <p>JSX와 Props를 복습합니다.</p>
</Card>
```

`ReactNode`는 JSX 안에서 렌더링할 수 있는 여러 값의 범위를 나타낸다.

### 3.9 Props는 읽기 전용 스냅샷이다

컴포넌트는 받은 Props를 직접 수정하지 않는다.

```tsx
type ScoreProps = {
  score: number
}

function Score({ score }: ScoreProps) {
  // score = score + 10처럼 Props를 변경하지 않는다.
  return <p>{score}점</p>
}
```

Props가 달라져야 한다면 부모가 새 값을 전달한다. React는 새 Props로 자식 컴포넌트를 다시 호출한다.

```text
부모의 값 변경
→ 새로운 Props 전달
→ 자식 컴포넌트 재렌더링
→ 새 JSX 계산
```

“Props가 바뀐다”는 말은 기존 Props 객체를 자식이 수정한다는 뜻이 아니라, 다음 렌더링에서 부모가 새로운 Props를 전달한다는 뜻이다.

### 3.10 Props와 state 구분하기

| 구분 | Props | state |
| --- | --- | --- |
| 값의 소유자 | 부모 컴포넌트 | 해당 컴포넌트 |
| 전달 방식 | 부모 → 자식 | Hook이 렌더링 사이에 보존 |
| 직접 수정 | 하지 않음 | setter로 변경 요청 |
| 변경 결과 | 새 Props로 재렌더링 | setter 호출 후 재렌더링 |

Props와 state 모두 렌더링 시점의 입력이다. 컴포넌트는 현재 Props와 state를 바탕으로 JSX를 계산한다.

### 3.11 컴포넌트를 나누는 기준

모든 태그를 작은 컴포넌트로 만들 필요는 없다. 다음 신호가 있을 때 분리를 고려한다.

- 같은 UI 구조가 반복된다.
- 한 부분이 독립적인 역할과 이름을 가진다.
- 부모 코드가 너무 길어 흐름을 파악하기 어렵다.
- 별도로 테스트하거나 재사용할 필요가 있다.
- 서로 다른 데이터로 같은 모양을 보여줘야 한다.

컴포넌트 정의를 다른 컴포넌트 내부에 중첩하지 않는다.

```tsx
// 권장하지 않음
function App() {
  function Profile() {
    return <p>프로필</p>
  }

  return <Profile />
}
```

```tsx
// 권장
function Profile() {
  return <p>프로필</p>
}

function App() {
  return <Profile />
}
```

## 4. 적용 관점에서 다시 보기

새 컴포넌트를 만들 때 다음 순서로 시작한다.

1. 반복되거나 독립적인 UI 영역을 찾는다.
2. 컴포넌트 이름을 대문자로 정한다.
3. 어떤 값이 고정이고 어떤 값이 달라지는지 구분한다.
4. 달라지는 값을 Props 타입으로 정의한다.
5. 부모에서 값을 전달하고 자식에서 구조 분해 할당으로 받는다.
6. 자식이 부모의 동작을 요청해야 하면 함수 Props를 전달한다.

Props 타입 오류가 나면 호출 위치와 선언 위치를 함께 확인한다.

```text
호출 위치
→ 어떤 이름과 타입으로 값을 전달했는가?

Props 타입
→ 필수·선택 여부와 타입이 무엇인가?

컴포넌트 매개변수
→ 같은 이름으로 구조 분해했는가?
```

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

- 컴포넌트는 특별한 클래스가 아니라 JSX를 반환하는 JavaScript 함수가 될 수 있다.
- Props는 함수의 매개변수처럼 컴포넌트의 동작과 표시 내용을 바꾼다.
- TypeScript는 Props 계약을 코드로 남기고 잘못된 사용을 미리 찾는다.

### 5.2 이전·다음 학습과의 연결

JSX는 컴포넌트가 반환하는 UI이고 렌더링은 React가 컴포넌트를 호출하는 과정이다. Props는 그 호출에 사용되는 외부 입력이다. 이후에는 state를 이용해 컴포넌트 내부에서 변하는 값을 관리한다.

### 5.3 더 확인할 주제

- Props drilling과 컴포넌트 합성
- 이벤트 객체의 TypeScript 타입
- `key`를 이용한 목록 렌더링
- state 끌어올리기

## 6. 요약 정리

1. React 함수 컴포넌트는 Props를 입력받아 JSX를 반환한다.
2. 사용자 컴포넌트의 이름은 대문자로 시작한다.
3. Props는 부모가 자식에게 전달하는 읽기 전용 입력이다.
4. TypeScript의 `type` 또는 `interface`로 Props의 형태를 정의한다.
5. 선택적 Props에는 `?`를 붙이고 필요하면 기본값을 지정한다.
6. 객체, 배열, 함수, JSX도 Props로 전달할 수 있다.
7. 태그 사이의 내용은 `children` Props로 전달된다.
8. 자식이 부모의 동작을 요청할 때는 이벤트 함수를 Props로 전달한다.

🧠 기억할 것: 컴포넌트는 공통 UI 구조이고 Props는 그 구조를 사용할 때 부모가 넣어 주는 타입이 정해진 입력값이다.

## 7. 미니 퀴즈

1. `<profile />`과 `<Profile />`은 React에서 어떻게 다르게 해석되는가?
2. Props가 일반 함수의 매개변수와 비슷한 이유는 무엇인가?
3. `disabled?: boolean`에서 `?`는 무엇을 의미하는가?
4. 자식 컴포넌트가 부모의 state를 변경해야 할 때 어떤 방식을 사용하는가?
5. `children: ReactNode`에는 어떤 값이 들어오는가?

<details>
<summary>정답과 해설</summary>

1. 소문자는 내장 HTML 태그, 대문자는 사용자 컴포넌트로 해석된다.
2. 컴포넌트의 표시 결과를 결정하는 외부 입력으로 전달되기 때문이다.
3. 해당 Props가 선택 사항이며 전달되지 않으면 `undefined`일 수 있다는 뜻이다.
4. 부모가 setter를 사용하는 이벤트 함수를 Props로 전달하고 자식이 그 함수를 호출한다.
5. 컴포넌트 태그의 시작 태그와 종료 태그 사이에 작성한 렌더링 가능한 내용이 들어온다.

</details>

## 참고 자료

- [React 공식 문서: Your First Component](https://react.dev/learn/your-first-component)
- [React 공식 문서: Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
- [React 공식 문서: Using TypeScript](https://react.dev/learn/typescript)
