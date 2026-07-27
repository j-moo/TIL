# React 입문: 컴포넌트와 상태로 UI 이해하기

- 🎯 글의 목표: React가 해결하려는 문제를 이해하고, 컴포넌트·props·state·렌더링·JSX가 어떻게 연결되는지 설명할 수 있다.
- 🧩 핵심 키워드: React, UI, Component, Props, State, Render, Commit, DOM, JSX
- ⭐ 중요도: ★★★★★ — 이후 이벤트 처리, Hooks, 라우팅, API 연동을 이해하는 기초가 된다.
- 📝 한눈에 보는 내용: React는 현재 데이터에서 어떤 UI가 나와야 하는지를 컴포넌트로 표현하게 한다. props와 state를 바탕으로 UI 결과를 계산하고, 달라진 부분을 실제 DOM에 반영한다.
- 🧱 선수 지식: HTML 요소, JavaScript 함수·객체·배열 구조 분해
- 🔗 다음 학습:
  - [Vite로 React 프로젝트 시작하기](../02_07_26_React_Project_Setup_with_Vite/07_26_React_Project_Setup_with_Vite.md)
  - [React 생태계와 도구 선택](../03_07_26_React_Ecosystem/07_26_React_Ecosystem.md)

---

## 1. 들어가며

HTML, CSS, JavaScript만으로도 웹페이지를 만들 수 있다. 작은 화면이라면 JavaScript로 원하는 DOM 요소를 찾고 직접 수정해도 충분하다.

```html
<button id="increase-button">증가</button>
<p id="count-text">0</p>

<script>
  let count = 0

  const button = document.querySelector('#increase-button')
  const countText = document.querySelector('#count-text')

  button.addEventListener('click', () => {
    count += 1
    countText.textContent = count
  })
</script>
```

여기서는 `count`가 바뀔 때마다 개발자가 `countText`도 직접 찾아 수정한다. 기능이 하나일 때는 단순하지만, 로그인 상태·장바구니 수량·알림처럼 같은 데이터가 여러 화면에 영향을 주면 데이터 변경과 DOM 변경을 계속 맞추기 어려워진다.

React는 이 문제를 다음 질문으로 바꾼다.

> 현재 데이터가 이 값이라면 화면은 어떤 모습이어야 하는가?

개발자는 DOM 수정 순서를 나열하기보다 데이터에 해당하는 UI 결과를 컴포넌트로 작성한다. React는 데이터가 바뀌면 컴포넌트를 다시 호출하고, 새 결과에 필요한 DOM 변경을 반영한다.

```jsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)

  return (
    <section>
      <button onClick={() => setCount(count + 1)}>
        증가
      </button>
      <p>{count}</p>
    </section>
  )
}
```

중요한 것은 코드가 짧아졌다는 사실보다 **화면이 현재 상태를 표현하도록 작성 방식이 바뀌었다는 점**이다.

---

## 2. 핵심 개념 정리

이 글의 핵심 질문은 다음과 같다.

> React는 데이터가 변했을 때 화면을 어떻게 다시 맞추는가?

전체 흐름을 먼저 보면 각 용어의 관계가 선명해진다.

```text
부모가 전달한 props + 컴포넌트가 기억하는 state
                       ↓
                 컴포넌트 실행
                       ↓
                  JSX 결과 계산
                       ↓
                이전 결과와 비교
                       ↓
            필요한 변경을 실제 DOM에 반영
```

- **컴포넌트**: UI를 역할 단위로 나눈 JavaScript 함수
- **props**: 부모가 자식 컴포넌트에 전달하는 입력값
- **state**: 컴포넌트가 렌더링 사이에 기억하는 데이터
- **렌더링**: React가 컴포넌트를 호출해 UI 결과를 계산하는 과정
- **커밋**: 계산된 변경을 실제 DOM에 반영하는 과정
- **JSX**: JavaScript 안에서 UI 구조를 표현하는 문법 확장

---

## 3. 본문 정리

### 3.1 React는 UI 라이브러리다

React는 웹과 네이티브 사용자 인터페이스를 만들기 위한 JavaScript 라이브러리다. React 자체가 프로그래밍 언어, 데이터베이스, 서버 또는 라우터는 아니다.

React가 주로 담당하는 것은 다음 영역이다.

```text
데이터를 받는다.
→ 컴포넌트로 UI 구조를 표현한다.
→ 화면에 렌더링한다.
→ 데이터 변화에 맞춰 UI를 갱신한다.
```

실제 서비스에서는 필요에 따라 라우팅, 데이터 요청, 인증, 빌드 도구를 결합한다. 이 주변 도구는 [React 생태계와 도구 선택](../03_07_26_React_Ecosystem/07_26_React_Ecosystem.md)에서 따로 다룬다.

📌 핵심: React의 중심 역할은 **현재 데이터에서 어떤 UI가 나와야 하는지 표현하고 렌더링하는 것**이다.

---

### 3.2 UI와 애플리케이션 로직을 구분한다

UI는 `User Interface`의 약자로, 사용자가 정보를 확인하고 프로그램을 조작하는 접점을 뜻한다.

- 버튼과 입력창
- 메뉴와 탭
- 목록과 표
- 모달과 알림 메시지

버튼 자체와 버튼에 표시되는 문구는 UI다. 버튼을 눌렀을 때 서버에 주문을 저장하는 일은 애플리케이션 또는 서버 로직에 가깝다.

```jsx
function LoginButton() {
  const handleLogin = () => {
    // 실제 프로젝트에서는 이곳에서 로그인 요청을 보낼 수 있다.
    console.log('로그인 요청')
  }

  return (
    <button onClick={handleLogin}>
      로그인
    </button>
  )
}
```

React 컴포넌트는 UI 구조와 그 UI에 필요한 상호작용 로직을 가까이 배치한다.

---

### 3.3 컴포넌트는 UI를 나누는 단위다

컴포넌트는 재사용하고 조합할 수 있는 UI 단위다. React의 함수 컴포넌트는 이름이 대문자로 시작하고 JSX를 반환한다.

```jsx
function Header() {
  return <header>서비스 로고와 메뉴</header>
}

function MainContent() {
  return <main>페이지의 핵심 내용</main>
}

function Footer() {
  return <footer>회사 정보</footer>
}

function App() {
  return (
    <>
      <Header />
      <MainContent />
      <Footer />
    </>
  )
}
```

`App`은 더 작은 컴포넌트를 조합해 하나의 화면을 만든다. 이렇게 역할을 나누면 각 부분을 독립적으로 읽고 수정하기 쉬워진다.

컴포넌트를 무조건 작게 나누는 것이 목표는 아니다. 다음 기준이 있으면 분리할 가치가 있다.

- 여러 위치에서 반복되는가?
- 하나의 분명한 역할을 갖는가?
- 입력값에 따라 비슷한 UI를 만들 수 있는가?
- 독립적으로 수정하거나 테스트할 가치가 있는가?

---

### 3.4 props는 부모가 전달하는 입력값이다

`props`는 부모 컴포넌트가 자식 컴포넌트에 전달하는 값이다. 같은 컴포넌트에 서로 다른 props를 전달하면 구조는 재사용하면서 내용과 동작을 바꿀 수 있다.

```jsx
function ProfileCard({ name, role }) {
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
      <ProfileCard
        name="김개발"
        role="Frontend Developer"
      />
      <ProfileCard
        name="이디자인"
        role="Product Designer"
      />
    </main>
  )
}
```

`{ name, role }`은 props 객체에서 두 속성을 꺼내는 객체 구조 분해 문법이다.

```text
App
 ├─ name과 role 전달
 ↓
ProfileCard
 └─ 전달받은 값으로 JSX 계산
```

⚠️ 주의: props는 자식이 임의로 변경하는 값이 아니다. 다른 값이 필요하면 부모가 새 props를 전달하거나, 컴포넌트가 state를 사용해야 한다.

---

### 3.5 state는 컴포넌트의 기억이다

일반 지역 변수는 렌더링 사이에 유지되지 않으며, 값을 바꿔도 React에 다시 렌더링해야 한다는 사실을 알려주지 않는다.

state는 다음 두 역할을 함께 제공한다.

1. 렌더링 사이에 값을 유지한다.
2. setter를 호출하면 새로운 렌더링을 요청한다.

```jsx
import { useState } from 'react'

function ToggleMessage() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section>
      <button onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '닫기' : '열기'}
      </button>

      {isOpen && <p>추가 설명이 열렸습니다.</p>}
    </section>
  )
}
```

실행 흐름은 다음과 같다.

1. 최초 렌더링에서 `isOpen`은 `false`다.
2. 버튼에는 `열기`가 표시되고 메시지는 보이지 않는다.
3. 버튼을 클릭하면 `setIsOpen(true)`에 해당하는 업데이트가 요청된다.
4. React가 컴포넌트를 다시 렌더링한다.
5. 새 렌더링에서 `isOpen`은 `true`이므로 버튼과 메시지가 달라진다.

⚠️ 주의: state는 “바뀐 DOM 부분”이 아니다. state는 UI를 계산하는 데 사용하는 데이터다.

---

### 3.6 Trigger, Render, Commit

React의 화면 업데이트는 세 단계로 이해할 수 있다.

```text
Trigger
→ 렌더링이 필요하다는 요청이 생긴다.

Render
→ React가 컴포넌트를 호출해 새 UI 결과를 계산한다.

Commit
→ 필요한 변경을 실제 DOM에 반영한다.
```

```jsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)

  return (
    <section>
      <h1>카운터</h1>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>
        증가
      </button>
    </section>
  )
}
```

버튼을 누르면 다음 순서로 이어진다.

```text
setCount() 호출
→ state 업데이트가 렌더링을 예약
→ Counter 컴포넌트 실행
→ 새로운 JSX 결과 계산
→ 이전 결과와 비교
→ 필요한 DOM 변경 커밋
```

`Counter` 함수가 다시 실행되어도 `<section>` 전체가 매번 제거되고 다시 만들어지는 것은 아니다. 위 예시에서는 주로 `<p>`의 텍스트가 바뀐다.

📌 핵심: **컴포넌트 재렌더링과 실제 DOM 전체 재생성은 같은 말이 아니다.**

---

### 3.7 Virtual DOM은 결과 비교를 위한 설명 모델이다

Virtual DOM은 보통 다음처럼 설명한다.

```text
새로운 UI 결과를 계산한다.
→ 이전 결과와 비교한다.
→ 실제 DOM에 필요한 변경을 반영한다.
```

이 설명은 흐름을 이해하는 데 도움이 되지만, 별도의 가짜 웹페이지가 화면 앞에 존재한다고 생각하면 부정확하다. 입문 단계에서는 `Trigger → Render → Commit` 흐름에 집중하는 편이 좋다.

React를 사용한다고 애플리케이션이 자동으로 빨라지는 것도 아니다.

- 매우 큰 목록을 한꺼번에 렌더링하는 경우
- 렌더링할 때마다 무거운 계산을 반복하는 경우
- 상위 state 변화로 많은 하위 컴포넌트가 반복 렌더링되는 경우
- 이미지와 네트워크 요청을 비효율적으로 처리하는 경우

성능은 컴포넌트 구조, state 위치, 데이터 요청, 번들 크기와 브라우저 렌더링을 함께 측정해야 판단할 수 있다.

---

### 3.8 JSX는 UI 구조를 표현하는 문법 확장이다

JSX는 JavaScript 파일 안에서 HTML과 비슷한 마크업을 작성하게 해주는 문법 확장이다.

```jsx
function Profile({ name }) {
  return (
    <section className="profile">
      <h1>{name}</h1>
      <img
        src="/profile.png"
        alt={`${name}의 프로필`}
      />
    </section>
  )
}
```

JSX는 HTML 그 자체가 아니다.

| HTML | JSX |
|---|---|
| `class` | `className` |
| `<img>` | `<img />`처럼 닫음 |
| 문자열 중심 속성 | `{}`로 JavaScript 표현식 사용 |
| 여러 최상위 요소 작성 가능 | 반환할 때 하나의 부모 또는 Fragment 필요 |

JSX에서 `{name}`은 JavaScript 표현식을 삽입한다. `${name}`은 백틱으로 만든 템플릿 리터럴 안에서 사용한다.

```jsx
// JSX 안의 JavaScript 표현식
<p>Hello, {name}</p>
```

```javascript
// JavaScript 템플릿 리터럴
const message = `Hello, ${name}`
```

---

### 3.9 JSX는 JavaScript 코드로 변환된다

브라우저는 JSX를 그대로 실행하지 못한다. 개발 도구는 JSX를 JavaScript가 처리할 수 있는 React 요소 생성 코드로 변환한다.

```jsx
const element = <div>Hello, {name}</div>
```

전통적인 설명에서는 위 코드를 다음과 연결한다.

```javascript
const element = React.createElement(
  'div',
  null,
  'Hello, ',
  name,
)
```

현대 프로젝트의 자동 JSX 런타임에서는 실제 변환 결과가 `React.createElement()`를 직접 호출하는 모양과 다를 수 있다. 핵심은 함수 이름을 외우는 것이 아니라 **JSX가 빌드 과정에서 일반 JavaScript 코드로 변환된다는 점**이다.

---

### 3.10 JSX 기본 규칙

#### 하나의 부모 또는 Fragment로 묶는다

```jsx
function Page() {
  return (
    <>
      <h1>React 입문</h1>
      <p>JSX를 공부합니다.</p>
    </>
  )
}
```

`<>...</>`는 Fragment다. 실제 DOM에 불필요한 요소를 추가하지 않고 여러 요소를 묶는다.

#### 모든 태그를 닫는다

```jsx
<img src="/logo.png" alt="서비스 로고" />
<input type="text" />
```

#### 많은 속성을 camelCase로 작성한다

```jsx
<div className="container">
  <label htmlFor="email">이메일</label>
  <input id="email" />
</div>
```

#### 중괄호에는 표현식을 넣는다

```jsx
function Status({ isOnline }) {
  return (
    <p>
      {isOnline ? '온라인' : '오프라인'}
    </p>
  )
}
```

일반적인 `if` 문은 값으로 평가되는 표현식이 아니므로 JSX 중괄호 안에 직접 넣을 수 없다. 필요하면 JSX를 반환하기 전에 조건을 처리하거나 삼항 연산자와 논리 연산자를 사용한다.

---

## 4. 적용 관점에서 다시 보기

React 화면을 구현할 때는 DOM 수정 명령보다 데이터부터 정리한다.

모달을 예로 들면 다음 질문을 순서대로 할 수 있다.

```text
1. 화면이 기억해야 할 값은 무엇인가?
→ 모달이 열려 있는가?

2. 어떤 state로 표현할 수 있는가?
→ isOpen: boolean

3. true와 false일 때 UI는 어떻게 달라지는가?
→ 모달을 렌더링하거나 숨긴다.

4. 어떤 이벤트가 값을 바꾸는가?
→ 열기 버튼과 닫기 버튼
```

```jsx
import { useState } from 'react'

function ModalExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <main>
      <button onClick={() => setIsOpen(true)}>
        모달 열기
      </button>

      {isOpen && (
        <section role="dialog" aria-modal="true">
          <h2>확인</h2>
          <p>모달이 열렸습니다.</p>
          <button onClick={() => setIsOpen(false)}>
            닫기
          </button>
        </section>
      )}
    </main>
  )
}
```

화면이 예상대로 바뀌지 않으면 다음 순서로 확인한다.

1. 이벤트 함수가 실행되는가?
2. state setter가 호출되는가?
3. 다음 state 값이 예상과 같은가?
4. JSX가 그 state를 사용하고 있는가?
5. 조건부 렌더링 조건이 반대로 작성되지 않았는가?
6. 브라우저 콘솔에 오류가 있는가?

---

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

React는 웹 개발 전체를 대신하는 도구가 아니다. 현재 데이터에서 어떤 UI가 나와야 하는지를 컴포넌트로 표현하고 렌더링하는 데 집중하는 라이브러리다.

state 변경, 컴포넌트 렌더링, 실제 DOM 변경은 연결되어 있지만 서로 같은 개념은 아니다.

### 5.2 다음 학습과의 연결

```text
컴포넌트와 JSX
→ props
→ 이벤트 처리
→ state
→ 조건부 렌더링
→ 리스트 렌더링과 key
→ state 공유
→ 여러 Hooks
```

### 5.3 더 확인할 주제

- state를 직접 수정하면 안 되는 이유
- state를 스냅샷으로 이해하는 방법
- 여러 state 업데이트의 처리 방식
- 부모와 자식 사이의 단방향 데이터 흐름
- 리스트에서 `key`가 필요한 이유
- 컴포넌트가 순수해야 하는 이유

---

## 6. 요약 정리

- React는 UI를 컴포넌트로 구성하고 렌더링하는 JavaScript 라이브러리다.
- 컴포넌트는 역할이 있는 UI 단위이며 다른 컴포넌트와 조합할 수 있다.
- props는 부모가 자식에게 전달하는 입력값이다.
- state는 컴포넌트가 렌더링 사이에 기억하는 데이터다.
- state setter는 다음 렌더링을 요청한다.
- 화면 업데이트는 `Trigger → Render → Commit` 흐름으로 이해할 수 있다.
- 재렌더링은 실제 DOM 전체를 다시 만든다는 뜻이 아니다.
- JSX는 JavaScript 안에서 UI 구조를 표현하는 문법 확장이다.
- JSX는 빌드 과정에서 JavaScript 코드로 변환된다.

🧠 기억할 것: React에서는 DOM을 어떻게 고칠지보다 **현재 데이터에서 어떤 UI가 나와야 하는지**를 먼저 작성한다.

---

## 7. 미니 퀴즈

1. React가 해결하려는 문제를 직접 DOM 조작과 비교해 설명할 수 있는가?
2. 컴포넌트, props, state를 각각 한 문장으로 설명할 수 있는가?
3. 일반 지역 변수와 state는 어떤 점이 다른가?
4. `Trigger → Render → Commit`을 카운터 예제로 설명할 수 있는가?
5. 컴포넌트 재렌더링과 DOM 전체 재생성이 다른 이유는 무엇인가?
6. JSX의 `{name}`과 템플릿 리터럴의 `${name}`은 어디에서 사용하는가?

<details>
<summary>정답과 해설</summary>

1. 직접 DOM 조작은 데이터가 바뀔 때 수정할 요소와 명령을 개발자가 연결한다. React는 현재 데이터에서 나올 UI를 선언하고 실제 DOM 반영을 관리한다.
2. 컴포넌트는 UI 단위, props는 부모가 주는 입력, state는 렌더링 사이에 컴포넌트가 기억하는 데이터다.
3. 일반 지역 변수는 렌더링 사이에 유지되지 않고 변경해도 렌더링을 요청하지 않는다. state는 값을 유지하며 setter가 렌더링을 요청한다.
4. 버튼 클릭이 업데이트를 일으키고, React가 컴포넌트를 호출해 새 JSX를 계산한 뒤 필요한 DOM 변경을 커밋한다.
5. 렌더링은 UI 결과를 다시 계산하는 과정이다. React는 결과가 달라진 DOM 부분만 수정할 수 있다.
6. JSX에서는 `{name}`, JavaScript 템플릿 리터럴에서는 `` `${name}` ``을 사용한다.

</details>

---

## 8. 참고 자료

- [React 공식 학습 문서](https://react.dev/learn)
- [첫 번째 컴포넌트](https://react.dev/learn/your-first-component)
- [State: 컴포넌트의 기억](https://react.dev/learn/state-a-components-memory)
- [Render and Commit](https://react.dev/learn/render-and-commit)
- [JSX로 마크업 작성하기](https://react.dev/learn/writing-markup-with-jsx)
