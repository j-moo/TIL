# 처음부터 따라가는 React 입문 안내서

이 문서는 React를 처음 보는 사람이 `01`번부터 무작정 읽기 전에 전체 흐름을 잡는 안내서다. 한 번에 모든 API를 외우는 것이 목표가 아니다. **데이터가 바뀌면 React가 컴포넌트를 다시 계산하고, 그 결과를 화면에 반영한다**는 한 가지 흐름을 여러 작은 예제로 반복해서 확인한다.

## 1. React를 배우기 전에 알아야 할 것

React는 HTML, CSS, JavaScript를 없애는 기술이 아니다. 기존 기술로 화면을 만드는 방법을 컴포넌트 중심으로 정리해 주는 라이브러리다.

- HTML: 화면의 구조와 의미를 표현한다.
- CSS: 색, 간격, 배치, 반응형 표현을 담당한다.
- JavaScript/TypeScript: 데이터와 동작을 표현한다.
- React: 데이터에 따라 어떤 UI를 보여 줄지 컴포넌트로 계산한다.

JavaScript의 함수, 객체, 배열, `map`, 구조 분해, `async/await`를 모르면 React 코드가 어려워 보인다. 막히면 React 문서만 반복해서 읽기보다 `TypeScript`와 `Javascript` 폴더의 해당 문법을 먼저 복습한다.

## 2. 화면을 직접 고치는 방식과 React 방식

### 2.1 DOM을 직접 수정하는 방식

```html
<!-- 버튼과 숫자를 HTML에 직접 배치한다. -->
<button id="increase-button" type="button">증가</button>
<p id="count-text">0</p>

<script>
  // 화면에 표시할 실제 데이터를 변수로 보관한다.
  let count = 0

  // id로 DOM 요소를 찾아 직접 저장한다.
  const button = document.querySelector('#increase-button')
  const countText = document.querySelector('#count-text')

  // 사용자가 클릭하면 데이터와 DOM을 모두 직접 수정한다.
  button.addEventListener('click', () => {
    count += 1
    countText.textContent = String(count)
  })
</script>
```

화면이 하나일 때는 괜찮지만, 같은 `count`를 여러 곳에서 보여 주면 모든 DOM 위치를 빠짐없이 갱신해야 한다. React는 이 과정을 직접 명령하는 대신 현재 데이터에서 화면을 계산하도록 만든다.

### 2.2 React 방식

```tsx
import { useState } from 'react'

export default function Counter() {
  // count: 현재 렌더링에서 사용할 값
  // setCount: 다음 화면 계산을 요청하는 함수
  const [count, setCount] = useState<number>(0)

  // 아래 JSX는 "count가 이 값일 때 보여 줄 화면"을 설명한다.
  return (
    <section>
      <h1>간단한 카운터</h1>

      {/* 클릭 시에만 함수를 실행하도록 함수 자체를 전달한다. */}
      <button
        type="button"
        onClick={() => setCount(current => current + 1)}
      >
        증가
      </button>

      {/* state가 바뀌면 이 표현식도 새 값으로 다시 계산된다. */}
      <p>현재 값: {count}</p>
    </section>
  )
}
```

여기서 개발자가 `textContent`를 찾아 수정하지 않는다. setter를 호출하면 React가 컴포넌트를 다시 실행하고 새 JSX 결과를 계산한 뒤 필요한 DOM만 반영한다.

## 3. 프로젝트가 시작되는 순서

Vite React TypeScript 프로젝트에서는 보통 다음 흐름으로 파일을 읽는다.

```text
index.html
  ↓  id="root"인 DOM 컨테이너를 제공
src/main.tsx
  ↓  createRoot로 React의 시작점 생성
src/App.tsx
  ↓  최상위 컴포넌트 반환
하위 컴포넌트
  ↓  props와 state로 화면 계산
브라우저 DOM
```

`main.tsx`의 최소 예시는 다음과 같다.

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// index.html에 있는 <div id="root"></div>를 찾는다.
const container = document.getElementById('root')

// 컨테이너가 없으면 앱을 그릴 위치가 없으므로 즉시 오류를 낸다.
if (!container) {
  throw new Error('React를 연결할 #root 요소가 없습니다.')
}

// createRoot는 이 DOM 영역을 React가 관리하도록 만든다.
createRoot(container).render(
  // 개발 중 잘못된 Effect와 비순수 렌더링을 찾는 검사 도구다.
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`StrictMode`는 사용자에게 보이는 기능이 아니라 개발 검사용 래퍼다. 개발 중 Effect가 다시 실행되는 것은 cleanup이 제대로 되어 있는지 확인하기 위한 동작일 수 있다.

## 4. JSX와 컴포넌트

JSX는 HTML 문자열이 아니다. TypeScript 파일 안에서 UI 구조를 작성할 수 있게 해 주는 문법 확장이다. JSX가 포함된 파일의 확장자는 `.tsx`다.

```tsx
type GreetingProps = {
  // 부모가 전달할 이름의 타입을 선언한다.
  name: string
}

function Greeting({ name }: GreetingProps) {
  // 컴포넌트는 JSX를 반환하는 함수다.
  return <h1>반갑습니다, {name}님</h1>
}

export default function App() {
  return (
    <main>
      {/* 컴포넌트 이름은 대문자로 시작한다. */}
      <Greeting name="학습자" />
    </main>
  )
}
```

`name="학습자"`는 문자열 Props이고, `name={userName}`은 JavaScript 표현식의 값을 전달한다. 컴포넌트는 보통 자신이 받은 Props를 직접 수정하지 않고 읽기만 한다.

## 5. Props와 children

Props는 부모가 자식에게 내려 주는 입력값이다. 함수의 매개변수와 비슷하게 생각하면 쉽다.

```tsx
import type { ReactNode } from 'react'

type PanelProps = {
  title: string
  // ReactNode는 문자열, JSX, 여러 요소 등을 받을 수 있다.
  children: ReactNode
}

function Panel({ title, children }: PanelProps) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {/* 태그 사이에 작성한 내용이 children으로 들어온다. */}
      {children}
    </section>
  )
}

export default function HelpPage() {
  return (
    <Panel title="도움말">
      <p>이 영역은 Panel이 전달받아 표시한다.</p>
      <button type="button">확인</button>
    </Panel>
  )
}
```

`Panel`은 내부에 어떤 내용이 들어오는지 몰라도 된다. 이런 합성 구조를 사용하면 컴포넌트를 상속하지 않고 재사용할 수 있다.

## 6. 이벤트와 state

이벤트는 사용자의 행동 때문에 실행되는 함수다. 렌더링 중 실행하면 안 되므로 JSX에는 호출 결과가 아니라 함수를 전달한다.

```tsx
import { useState, type ChangeEvent } from 'react'

export default function NameEditor() {
  // 입력값은 화면에 보여야 하고 다음 렌더링에도 기억해야 하므로 state다.
  const [name, setName] = useState<string>('')

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    // currentTarget은 이 핸들러가 연결된 input이다.
    setName(event.currentTarget.value)
  }

  return (
    <label>
      이름
      {/* value와 state를 연결했으므로 controlled input이다. */}
      <input value={name} onChange={handleChange} />
      <span>입력한 값: {name || '아직 없음'}</span>
    </label>
  )
}
```

`useState`는 현재 값과 setter를 한 쌍으로 반환한다. setter를 호출한 직후 같은 이벤트 함수 안의 `name` 변수가 즉시 바뀌는 것은 아니다. 현재 함수는 현재 렌더링의 스냅샷을 보고 있기 때문이다.

## 7. 조건과 목록

### 7.1 조건부 렌더링

```tsx
function SaveMessage({ saved }: { saved: boolean }) {
  // 조건이 복잡하지 않으면 삼항 연산자로 두 화면 중 하나를 선택한다.
  return <p>{saved ? '저장되었습니다.' : '아직 저장하지 않았습니다.'}</p>
}
```

### 7.2 목록 렌더링

```tsx
type Task = { id: string; title: string }

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <ul>
      {tasks.map(task => (
        // key는 화면에 보이지 않으며 React가 같은 항목을 식별하는 ID다.
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  )
}
```

`key`에는 배열의 index보다 데이터 자체의 안정적인 ID를 사용한다. 항목을 삽입하거나 삭제했을 때 React가 잘못된 입력 상태를 재사용하는 문제를 예방할 수 있다.

## 8. 부모와 자식이 함께 상태를 사용할 때

두 형제가 같은 값을 사용하면 state를 가장 가까운 공통 부모로 끌어올린다.

```tsx
import { useState } from 'react'

type FieldProps = {
  value: string
  onChange: (value: string) => void
}

function Field({ value, onChange }: FieldProps) {
  return (
    <input
      value={value}
      // 자식은 값을 직접 바꾸지 않고 부모에게 변경 의도만 알린다.
      onChange={event => onChange(event.currentTarget.value)}
    />
  )
}

export default function SharedText() {
  // 두 Field가 함께 사용하므로 부모가 단일 진실 공급원이 된다.
  const [text, setText] = useState<string>('')

  return (
    <>
      <Field value={text} onChange={setText} />
      <p>미리보기: {text}</p>
    </>
  )
}
```

state를 모두 최상위에 모으라는 뜻은 아니다. 한 곳에서만 필요한 state는 그 컴포넌트 가까이에 둔다.

## 9. 서버 데이터는 화면 상태와 다르다

API 요청은 `fetch` 한 줄로 끝나지 않는다. 진행 중인지, 실패했는지, 오래된 응답인지 화면이 알아야 한다.

```tsx
type Article = { id: string; title: string }

type LoadState =
  | { status: 'pending' }
  | { status: 'success'; data: Article[] }
  | { status: 'error'; message: string }
```

초보 단계에서는 먼저 `20_07_31_Data_Fetching`의 수동 `fetch` 예제로 요청 상태와 cleanup을 익힌다. 이후 요청 캐시, 재검증, 중복 요청 제거가 필요해지면 TanStack Query나 프레임워크의 loader를 검토한다.

## 10. 렌더링에서 하지 말아야 할 일

렌더링 함수는 같은 입력에 같은 JSX를 계산하는 순수 함수처럼 작성한다.

- 배열이나 Props 객체를 직접 수정하지 않는다.
- 렌더링 중 setter를 호출하지 않는다.
- 구매 요청·삭제 요청 같은 side effect를 JSX 계산 안에 넣지 않는다.
- `useEffect`는 외부 시스템 동기화에만 사용한다.
- 화면에 보여야 하는 값은 ref가 아니라 state로 둔다.

## 11. 추천 학습 순서와 읽는 방법

1. 이 문서의 2~4절로 React가 화면을 계산하는 흐름을 이해한다.
2. `01`~`06`에서 JSX, 렌더링, 컴포넌트, Props를 자세히 읽는다.
3. `07`~`11`에서 state, Hook, 이벤트, 조건, 목록을 작은 예제로 따라 한다.
4. `12`~`16`에서 폼, 상태 공유, 합성, Context, 스타일을 학습한다.
5. `17`과 `20`에서 작은 프로젝트와 API 연동을 구현한다.
6. `18`과 `19`는 기본 개념을 익힌 뒤 복습과 버전 확인에 사용한다.

각 코드 블록을 읽을 때는 다음 세 질문을 적어 본다.

1. 이 값은 어디에서 만들어지는가?
2. 이 값이 바뀌면 어떤 컴포넌트가 다시 계산되는가?
3. 사용자의 행동 또는 네트워크 응답은 어느 함수에서 state를 바꾸는가?

## 12. 첫 복습 문제

1. Props와 state를 함수의 매개변수와 지역 기억에 각각 비유할 수 있는가?
2. `onClick={handleClick}`과 `onClick={handleClick()}`의 차이를 설명할 수 있는가?
3. 배열을 화면에 표시할 때 `key`가 필요한 이유를 설명할 수 있는가?
4. 두 컴포넌트가 같은 값을 사용해야 할 때 state를 어디에 둘 것인가?
5. 계산 가능한 값을 Effect로 다시 state에 저장하면 왜 문제가 되는가?

답을 바로 찾기보다 각 질문에 자신의 말로 먼저 답하고 해당 챕터로 이동한다.

## 연결된 문서

- [React 입문](../01_07_26_React_Introduction/07_26_React_Introduction.md)
- [TypeScript로 배우는 JSX](../04_07_27_JSX/07_27_JSX.md)
- [State와 생명주기](../07_07_30_State_and_Lifecycle/07_30_State_and_Lifecycle.md)
- [React 데이터 패칭과 비동기 상태](../20_07_31_Data_Fetching/07_31_Data_Fetching.md)
