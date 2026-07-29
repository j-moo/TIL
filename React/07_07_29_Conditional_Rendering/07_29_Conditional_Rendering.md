# TypeScript로 배우는 조건부 렌더링

- 🎯 글의 목표: Props와 state의 조건에 따라 다른 JSX를 표시하거나 일부 UI를 숨길 수 있다.
- 🧩 핵심 키워드: `if`, 조기 반환, 삼항 연산자, `&&`, `null`, 판별 유니언
- ⭐ 중요도: 상 — 로그인 상태, 로딩, 오류, 권한처럼 실제 화면의 분기를 표현하는 기본 기술이다.
- 📝 한눈에 보는 내용: React 전용 조건문이 있는 것이 아니라 JavaScript 조건문으로 반환할 JSX를 결정한다.
- 🔗 관련 주제: JSX, Props, state, 컴포넌트 분리
- 🧱 선수 지식: `if`, 삼항 연산자, 논리 연산자, TypeScript 유니언 타입

---

## 1. 들어가며

같은 컴포넌트도 상황에 따라 다른 화면을 보여줘야 한다.

```text
로그인 전 → 로그인 버튼
로그인 후 → 사용자 이름과 로그아웃 버튼

데이터 요청 중 → 로딩 문구
요청 성공 → 데이터 목록
요청 실패 → 오류 안내
```

React에서는 별도의 템플릿 조건 문법을 배우지 않는다. 컴포넌트 함수 안에서 JavaScript와 TypeScript의 조건식을 사용해 어떤 JSX를 반환할지 결정한다.

## 2. 핵심 개념 정리

```text
현재 Props 또는 state
          ↓
       조건 확인
          ↓
┌─────────┴─────────┐
조건이 참         조건이 거짓
   ↓                  ↓
JSX A 계산          JSX B 계산
└─────────┬─────────┘
          ↓
 React가 선택된 결과를 렌더링
```

조건부 렌더링에는 주로 네 가지 방법이 있다.

| 방법 | 적합한 상황 |
| --- | --- |
| `if`와 조기 반환 | 화면 전체 구조가 크게 다를 때 |
| 삼항 연산자 | 두 결과 중 하나를 짧게 선택할 때 |
| `&&` | 조건이 참일 때만 작은 UI를 추가할 때 |
| `null` 반환 | 컴포넌트 자체를 표시하지 않을 때 |

## 3. 본문 정리

### 3.1 `if`로 서로 다른 JSX 반환하기

```tsx
type LoginMessageProps = {
  isLoggedIn: boolean
  userName: string
}

function LoginMessage({ isLoggedIn, userName }: LoginMessageProps) {
  if (isLoggedIn) {
    return <p>{userName}님, 환영합니다.</p>
  }

  return <p>로그인이 필요합니다.</p>
}
```

실행 흐름은 일반 함수와 같다.

```text
LoginMessage 호출
→ isLoggedIn 확인
→ true면 첫 번째 JSX 반환 후 함수 종료
→ false면 마지막 JSX 반환
```

두 화면의 구조와 동작이 크게 다르면 `if`를 사용한 조기 반환이 가장 읽기 쉽다.

### 3.2 공통 구조가 많다면 삼항 연산자 사용하기

```tsx
type StatusBadgeProps = {
  isOnline: boolean
}

function StatusBadge({ isOnline }: StatusBadgeProps) {
  return (
    <span className={isOnline ? 'badge online' : 'badge offline'}>
      {isOnline ? '접속 중' : '오프라인'}
    </span>
  )
}
```

삼항 연산자는 값을 하나 만든다.

```text
조건 ? 참일 때 값 : 거짓일 때 값
```

JSX 중괄호 안에는 값을 만드는 표현식이 들어갈 수 있으므로 삼항 연산자를 사용할 수 있다.

⚠️ 삼항 연산자를 여러 번 중첩하면 흐름을 읽기 어렵다.

```tsx
// 상태가 늘어나면 읽기 어렵다.
const label = isLoading
  ? '로딩 중'
  : hasError
    ? '오류'
    : isEmpty
      ? '결과 없음'
      : '완료'
```

분기가 많으면 `if` 조기 반환이나 별도 컴포넌트로 나눈다.

### 3.3 참일 때만 표시하려면 `&&`

```tsx
type NotificationProps = {
  unreadCount: number
}

function Notification({ unreadCount }: NotificationProps) {
  return (
    <button type="button">
      알림
      {unreadCount > 0 && <strong>{unreadCount}</strong>}
    </button>
  )
}
```

```text
unreadCount > 0이 true
→ 오른쪽 JSX 반환

unreadCount > 0이 false
→ false가 되어 아무것도 표시하지 않음
```

#### 숫자를 조건으로 바로 사용하지 않는다

```tsx
// unreadCount가 0이면 화면에 숫자 0이 나타날 수 있다.
{unreadCount && <strong>{unreadCount}</strong>}
```

React는 `false`, `null`, `undefined`는 표시하지 않지만 숫자 `0`은 화면에 표시한다. 따라서 명시적인 boolean 식을 만든다.

```tsx
{unreadCount > 0 && <strong>{unreadCount}</strong>}
```

### 3.4 아무것도 표시하지 않으려면 `null`

```tsx
type AdminMenuProps = {
  isAdmin: boolean
}

function AdminMenu({ isAdmin }: AdminMenuProps) {
  if (!isAdmin) {
    return null
  }

  return <button type="button">관리자 설정</button>
}
```

`null`을 반환하면 해당 컴포넌트가 그 위치에 DOM을 만들지 않는다.

다만 부모가 표시 여부를 판단하는 편이 흐름상 더 분명할 때도 있다.

```tsx
function Header({ isAdmin }: AdminMenuProps) {
  return (
    <header>
      <h1>서비스</h1>
      {isAdmin && <AdminMenu isAdmin={isAdmin} />}
    </header>
  )
}
```

표시 여부를 부모와 자식 중 어디에서 판단할지는 책임이 더 자연스러운 위치를 선택한다.

### 3.5 JSX를 변수에 저장하기

조건에 따라 일부 내용만 달라지지만 삼항 연산자가 길어지는 경우 JSX를 변수에 저장할 수 있다.

```tsx
type PaymentStatus = 'pending' | 'completed' | 'failed'

type PaymentMessageProps = {
  status: PaymentStatus
}

function PaymentMessage({ status }: PaymentMessageProps) {
  let message: string

  if (status === 'pending') {
    message = '결제를 처리하고 있습니다.'
  } else if (status === 'completed') {
    message = '결제가 완료되었습니다.'
  } else {
    message = '결제에 실패했습니다.'
  }

  return <p>{message}</p>
}
```

TypeScript 유니언 타입은 허용된 상태를 제한해 오타와 처리 누락을 줄인다.

### 3.6 판별 유니언으로 상태와 필요한 데이터 연결하기

boolean 여러 개를 따로 두면 동시에 성립할 수 없는 조합이 생길 수 있다.

```ts
// isLoading과 hasError가 동시에 true일 수 있어 의미가 모호하다.
type BadState = {
  isLoading: boolean
  hasError: boolean
  data?: string[]
}
```

상태별로 필요한 데이터를 묶은 판별 유니언을 사용할 수 있다.

```tsx
type UserListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; users: string[] }

type UserListProps = {
  state: UserListState
}

function UserList({ state }: UserListProps) {
  if (state.status === 'loading') {
    return <p>사용자 정보를 불러오는 중입니다.</p>
  }

  if (state.status === 'error') {
    return <p role="alert">{state.message}</p>
  }

  if (state.users.length === 0) {
    return <p>등록된 사용자가 없습니다.</p>
  }

  return (
    <ul>
      {state.users.map((user) => (
        <li key={user}>{user}</li>
      ))}
    </ul>
  )
}
```

`status`를 확인하면 TypeScript가 해당 분기에서 사용할 수 있는 속성을 좁혀 준다.

### 3.7 조건을 계산하는 코드와 JSX를 분리하기

JSX 안에 복잡한 계산을 모두 넣으면 화면 구조를 읽기 어렵다.

```tsx
type PriceProps = {
  price: number
  discountRate: number
}

function Price({ price, discountRate }: PriceProps) {
  const hasDiscount = discountRate > 0
  const discountedPrice = price * (1 - discountRate)

  return (
    <p>
      {hasDiscount ? discountedPrice.toLocaleString() : price.toLocaleString()}원
      {hasDiscount && <span> 할인 적용</span>}
    </p>
  )
}
```

조건의 의미가 드러나는 변수 이름을 만들면 JSX는 “무엇을 표시하는가”에 집중할 수 있다.

## 4. 적용 관점에서 다시 보기

조건부 UI를 작성할 때 다음 순서로 결정한다.

1. 가능한 화면 상태를 먼저 나열한다.
2. TypeScript 유니언이나 boolean 중 상태를 가장 정확히 표현하는 타입을 선택한다.
3. 화면 전체가 다르면 `if` 조기 반환을 사용한다.
4. 두 값 중 하나만 짧게 고르면 삼항 연산자를 사용한다.
5. 참일 때만 작은 부분을 추가하면 명시적인 boolean 조건과 `&&`를 사용한다.
6. 조건식이 중첩되면 의미 있는 변수나 별도 컴포넌트로 분리한다.

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

- React 조건부 렌더링은 JavaScript 제어 흐름을 그대로 사용한다.
- `&&`의 왼쪽 값이 숫자라면 `0`이 표시될 수 있다.
- TypeScript 판별 유니언은 불가능한 화면 상태를 줄여 준다.

### 5.2 이전·다음 학습과의 연결

Props와 state는 컴포넌트의 입력이고 조건부 렌더링은 그 입력을 서로 다른 JSX로 변환한다. 다음 문서에서는 배열 입력을 여러 JSX 항목으로 변환한다.

### 5.3 더 확인할 주제

- 상태를 선언적으로 설계하기
- Suspense와 오류 경계
- 권한별 라우트 처리

## 6. 요약 정리

1. React에는 전용 조건문이 없으며 JavaScript 조건식을 사용한다.
2. 구조가 크게 다르면 `if` 조기 반환이 읽기 쉽다.
3. 두 JSX 중 하나를 고를 때는 삼항 연산자를 사용할 수 있다.
4. 참일 때만 표시할 때는 `&&`를 사용한다.
5. 숫자를 `&&` 왼쪽에 바로 두면 `0`이 표시될 수 있다.
6. 아무것도 렌더링하지 않을 때는 `null`을 반환할 수 있다.
7. 복잡한 상태는 TypeScript 판별 유니언으로 안전하게 표현할 수 있다.

🧠 기억할 것: 조건부 렌더링은 “React 문법”을 외우는 것이 아니라 현재 상태를 가장 읽기 쉬운 JavaScript 분기로 바꾸는 일이다.

## 7. 미니 퀴즈

1. `if` 조기 반환과 삼항 연산자는 각각 어떤 상황에 적합한가?
2. `{count && <Badge />}`에서 `count`가 0이면 무엇이 표시될 수 있는가?
3. 컴포넌트가 `null`을 반환하면 DOM에는 무엇이 생기는가?
4. 여러 boolean 대신 판별 유니언을 사용하면 어떤 장점이 있는가?

<details>
<summary>정답과 해설</summary>

1. 화면 구조가 크게 다르면 조기 반환, 두 결과를 짧게 고르면 삼항 연산자가 적합하다.
2. React는 숫자 0을 렌더링하므로 `0`이 표시될 수 있다.
3. 해당 컴포넌트 위치에 DOM 노드가 만들어지지 않는다.
4. 동시에 성립할 수 없는 상태를 타입으로 막고 분기별 데이터 타입을 좁힐 수 있다.

</details>

## 참고 자료

- [React 공식 문서: Conditional Rendering](https://react.dev/learn/conditional-rendering)
- [React 공식 문서: Describing the UI](https://react.dev/learn/describing-the-ui)
