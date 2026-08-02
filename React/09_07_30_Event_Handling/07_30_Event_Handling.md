# TypeScript로 배우는 이벤트 처리

- 🎯 글의 목표: 이벤트 핸들러를 실행하지 않고 전달하는 이유, 이벤트 타입, 전파와 기본 동작 제어를 이해한다.
- 🧩 핵심 키워드: 이벤트 핸들러, 함수 참조, `currentTarget`, 이벤트 전파, `preventDefault`, `stopPropagation`
- ⭐ 중요도: ★★★★★ — 사용자의 행동을 state 변경과 연결하는 출발점이다.
- 📝 한눈에 보는 내용: JSX에는 나중에 실행할 함수를 전달한다. TypeScript 이벤트 타입은 이벤트 종류와 연결된 DOM 요소를 함께 표현한다.
- 🔗 관련 주제: state, 폼, Props, Effect
- 🧱 선수 지식: 함수, 콜백, DOM 이벤트의 기본 개념

---

버튼 클릭, 입력, 폼 제출은 사용자가 UI에 의도를 전달하는 방법이다. React는 이벤트 이름을 Props처럼 JSX에 전달받고, 실제 상호작용이 발생한 시점에 함수를 호출한다. 렌더링과 이벤트의 실행 시점을 구분해야 무한 렌더링이나 예상치 못한 제출을 피할 수 있다.

## 1. 함수는 호출하지 않고 전달한다

```tsx
function SaveButton() {
  // 렌더링 중에는 선언만 하고 실행하지 않는다.
  const handleClick = () => {
    console.log('저장 요청')
  }

  // 함수 호출 결과가 아니라 함수 참조를 전달한다.
  return <button onClick={handleClick}>저장</button>
}
```

`onClick={handleClick}`는 사용자가 클릭할 때 React가 호출할 함수를 전달한다. `onClick={handleClick()}`는 렌더링 중 즉시 실행한 반환값을 전달하므로 잘못된 형태다.

## 2. TypeScript 이벤트 타입

```tsx
import type { ChangeEvent, FormEvent, MouseEvent } from 'react'

function SearchForm() {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    // currentTarget은 onChange를 등록한 input이므로 value를 안전하게 읽는다.
    console.log(event.currentTarget.value)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // 브라우저의 기본 페이지 이동·새로고침 제출을 막는다.
    event.preventDefault()
    // event.currentTarget은 제출 이벤트가 연결된 form이다.
    const data = new FormData(event.currentTarget)
    console.log(data.get('query'))
  }

  const handleButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    // 버튼의 name 속성은 currentTarget에서 읽는다.
    console.log(event.currentTarget.name)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="query" onChange={handleChange} />
      <button name="search" onClick={handleButtonClick}>검색</button>
    </form>
  )
}
```

`currentTarget`은 핸들러가 연결된 요소로 타입이 안정적이다. `target`은 실제 이벤트가 시작된 하위 요소일 수 있다.

## 3. 인자를 함께 전달하기

```tsx
type Item = { id: string; title: string }

function ItemButton({ item, onSelect }: {
  item: Item
  onSelect: (id: string) => void
}) {
  // 클릭 시점에 현재 항목의 ID를 부모 callback으로 전달한다.
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
    >
      {item.title}
    </button>
  )
}
```

화살표 함수는 클릭 전에는 실행되지 않으며, 클릭 시 필요한 인자를 전달한다. 애플리케이션 컴포넌트의 이벤트 Props는 `onSelect`, `onSave`처럼 의미 중심으로 이름 붙일 수 있다.

## 4. 전파와 기본 동작

이벤트는 일반적으로 발생한 요소에서 부모 방향으로 전파된다. 중첩된 클릭 영역에서 부모 핸들러까지 실행되면 안 될 때 `stopPropagation()`을 사용한다. 링크 이동이나 폼 제출 같은 브라우저 기본 동작을 막을 때는 `preventDefault()`를 사용한다. 두 메서드는 서로 다른 문제를 해결한다.

```tsx
function Toolbar() {
  // 자식 이벤트가 전파되면 이 부모 핸들러도 실행된다.
  return (
    <div onClick={() => console.log('도구 모음 클릭')}>
      <button
        type="button"
        onClick={event => {
          // 이 버튼 클릭이 부모 div까지 올라가지 않게 막는다.
          event.stopPropagation()
          console.log('새 문서')
        }}
      >
        새 문서
      </button>
    </div>
  )
}
```

전파를 무조건 막기보다 부모가 자식에게 명시적 콜백을 전달하는 구조가 흐름을 더 읽기 쉽게 만드는지도 먼저 검토한다.

## 5. 이벤트와 Effect 구분

- 특정 클릭·입력·제출 때문에 실행된다면 이벤트 핸들러에 둔다.
- 컴포넌트가 화면에 나타났기 때문에 외부 시스템과 맞춰야 한다면 Effect를 검토한다.
- 렌더링 코드는 결과 계산만 하며 side effect를 일으키지 않는다.

## 6. 자주 하는 실수

- `onClick={setOpen(true)}`처럼 렌더링 중 setter를 호출한다.
- `<button>`의 기본 `type="submit"`을 모르고 폼이 예상치 않게 제출된다.
- `target`을 항상 버튼이나 입력 요소라고 단정한다.
- `preventDefault()`와 `stopPropagation()`을 같은 기능으로 생각한다.
- 이벤트 핸들러에서 props나 state 객체를 직접 변경한다.

## 7. 적용 관점에서 다시 보기

이벤트 코드를 작성할 때는 먼저 “어떤 요소에서 어떤 행동이 일어나는가?”를 정한다. DOM 요소의 이벤트 타입을 지정하고, 화면 상태를 바꾼다면 setter를 호출한다. 자식 컴포넌트가 부모의 동작을 요청해야 한다면 `onSave`, `onSelect`처럼 의미가 드러나는 함수 Props를 전달한다.

예상하지 않은 동작이 생기면 버튼의 `type`, 이벤트 함수 전달 형태, 전파 경로를 차례로 확인한다. `preventDefault`는 브라우저 기본 동작을 막고, `stopPropagation`은 부모로 이벤트가 올라가는 것을 막으므로 서로 바꿔 쓸 수 없다.

## 8. 배운 점 / 확장 포인트

### 8.1 새로 이해한 것

이벤트 핸들러는 렌더링 중 계산되는 코드와 달리 상호작용 시점에 실행되므로 state 변경이나 네트워크 요청 같은 side effect를 둘 수 있다. `currentTarget`은 핸들러가 연결된 요소를 가리켜 TypeScript에서 안전하게 값을 읽는 데 유리하다.

### 8.2 이전·다음 학습과의 연결

Props로 함수를 전달하는 구조는 state 끌어올리기와 controlled 컴포넌트로 이어진다. 폼에서는 입력 이벤트와 제출 이벤트를 구분해 사용한다.

### 8.3 더 확인할 주제

- capture 단계 이벤트
- 키보드 접근성과 `onKeyDown`
- focus와 blur 이벤트
- debounce가 필요한 검색 입력

## 9. 요약 정리

이벤트 핸들러는 JSX에 함수로 전달한다. TypeScript에서는 이벤트 종류와 연결 요소를 함께 지정하며, `currentTarget`을 활용하면 안전하게 값을 읽을 수 있다.

🧠 기억할 것: JSX에는 함수를 호출해서 넣는 것이 아니라, 사용자가 행동할 때 React가 호출할 함수 참조를 전달한다.

## 10. 미니 퀴즈

1. `onClick={handleClick}`과 `onClick={handleClick()}`의 차이는 무엇인가?
2. 폼 제출을 막는 메서드와 이벤트 전파를 막는 메서드는 각각 무엇인가?
3. 버튼이 폼을 제출하지 않아야 할 때 어떤 속성을 지정하는가?

<details>
<summary>정답과 해설</summary>

1. 첫 번째는 함수 참조를 전달해 클릭 시 실행한다. 두 번째는 렌더링 중 함수를 즉시 호출하고 그 반환값을 `onClick`에 전달한다.
2. 기본 제출은 `preventDefault()`, 부모로의 전파는 `stopPropagation()`으로 막는다.
3. `type="button"`을 지정한다. 폼 안에서 기본 `button` 타입은 submit이기 때문이다.

</details>

## 참고 자료

- [Responding to Events](https://react.dev/learn/responding-to-events)
- [Reacting to Input with State](https://react.dev/learn/reacting-to-input-with-state)
- [React DOM Events](https://react.dev/reference/react-dom/components/common#react-event-object)
