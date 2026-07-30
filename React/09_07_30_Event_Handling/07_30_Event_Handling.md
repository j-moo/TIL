# TypeScript로 배우는 이벤트 처리

> 학습 목표: 이벤트 핸들러를 실행하지 않고 전달하는 이유, 이벤트 타입, 전파와 기본 동작 제어를 이해한다.

## 1. 함수는 호출하지 않고 전달한다

```tsx
function SaveButton() {
  const handleClick = () => {
    console.log('저장 요청')
  }

  return <button onClick={handleClick}>저장</button>
}
```

`onClick={handleClick}`는 사용자가 클릭할 때 React가 호출할 함수를 전달한다. `onClick={handleClick()}`는 렌더링 중 즉시 실행한 반환값을 전달하므로 잘못된 형태다.

## 2. TypeScript 이벤트 타입

```tsx
import type { ChangeEvent, FormEvent, MouseEvent } from 'react'

function SearchForm() {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    console.log(event.currentTarget.value)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    console.log(data.get('query'))
  }

  const handleButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
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
  return (
    <button type="button" onClick={() => onSelect(item.id)}>
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
  return (
    <div onClick={() => console.log('도구 모음 클릭')}>
      <button
        type="button"
        onClick={event => {
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

## 7. 요약과 복습

이벤트 핸들러는 JSX에 함수로 전달한다. TypeScript에서는 이벤트 종류와 연결 요소를 함께 지정하며, `currentTarget`을 활용하면 안전하게 값을 읽을 수 있다.

1. `onClick={handleClick}`과 `onClick={handleClick()}`의 차이는 무엇인가?
2. 폼 제출을 막는 메서드와 이벤트 전파를 막는 메서드는 각각 무엇인가?
3. 버튼이 폼을 제출하지 않아야 할 때 어떤 속성을 지정하는가?

## 참고 자료

- [Responding to Events](https://react.dev/learn/responding-to-events)
- [Reacting to Input with State](https://react.dev/learn/reacting-to-input-with-state)
- [React DOM Events](https://react.dev/reference/react-dom/components/common#react-event-object)
