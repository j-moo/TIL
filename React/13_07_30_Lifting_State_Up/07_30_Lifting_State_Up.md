# State 끌어올리기와 단일 진실 공급원

> 학습 목표: 여러 컴포넌트가 같은 값을 공유할 때 state의 소유자를 정하고, controlled 컴포넌트로 협력하게 만든다.

## 1. 언제 끌어올리는가?

두 컴포넌트가 항상 함께 바뀌어야 하는데 각자 같은 의미의 state를 가지면 값이 어긋날 수 있다. 이때 가장 가까운 공통 부모로 state를 옮기고 값과 변경 함수를 props로 전달한다.

1. 자식의 중복 state를 제거한다.
2. 공통 부모에 state를 둔다.
3. 현재 값은 아래로, 사용자 의도는 콜백으로 위로 전달한다.

## 2. 동기화된 입력 예제

```tsx
import { useState } from 'react'

type TextFieldProps = {
  label: string
  value: string
  onChange: (nextValue: string) => void
}

function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <label>
      {label}
      <input
        value={value}
        onChange={event => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

export default function SyncedFields() {
  const [text, setText] = useState<string>('')

  return (
    <section>
      <TextField label="제목" value={text} onChange={setText} />
      <TextField label="미리보기" value={text} onChange={setText} />
    </section>
  )
}
```

`TextField`는 중요한 값이 props로 결정되는 controlled 컴포넌트다. 부모는 두 입력의 일관성을 책임진다.

## 3. 단일 진실 공급원

단일 진실 공급원은 **모든 state를 최상위에 모으라**는 뜻이 아니다. 각 state 조각마다 그것을 소유하는 컴포넌트를 하나 정하라는 뜻이다.

- 한 컴포넌트만 사용하는 값은 가까운 곳에 둔다.
- 형제들이 공유하면 가장 가까운 공통 부모로 올린다.
- 멀리 떨어진 많은 컴포넌트가 필요하면 먼저 합성 구조를 검토한 뒤 Context를 고려한다.
- 서버에서 받은 원본과 필터링 결과를 모두 state로 복제하지 않는다.

## 4. state와 파생 값

```tsx
type Product = { id: string; name: string; category: string }

function ProductList({ products }: { products: Product[] }) {
  const [category, setCategory] = useState<string>('all')
  const visibleProducts =
    category === 'all'
      ? products
      : products.filter(product => product.category === category)

  // visibleProducts는 category와 products로 계산할 수 있으므로 state가 아니다.
  return <>{/* 필터 UI와 목록 */}</>
}
```

원본 state와 파생 state를 동시에 갱신하면 한쪽을 빠뜨리기 쉽다. 렌더링 중 계산 가능한 값은 계산한다.

## 5. 끌어올리기의 비용

state가 올라가면 부모와 관련 자식이 다시 렌더링될 범위가 커지고 props 연결도 늘어난다. 이것은 무조건 나쁜 것이 아니라 데이터 흐름을 명시적으로 만드는 대가다. 실제 성능 문제가 측정되기 전에는 Context나 전역 상태 도구로 성급히 숨기지 않는다.

## 6. 요약과 복습

공유 state는 가장 가까운 공통 부모가 소유한다. 자식은 값과 콜백을 받아 controlled 방식으로 동작하며, 계산 가능한 값은 중복 저장하지 않는다.

1. 형제 컴포넌트의 값을 동기화하는 세 단계는 무엇인가?
2. 단일 진실 공급원이 모든 state를 루트에 두라는 뜻이 아닌 이유는 무엇인가?
3. props와 state로부터 계산 가능한 값을 다시 state로 저장하면 어떤 문제가 생기는가?

## 참고 자료

- [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
- [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [Thinking in React](https://react.dev/learn/thinking-in-react)
