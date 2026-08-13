# State 끌어올리기와 단일 진실 공급원

- 🎯 글의 목표: 여러 컴포넌트가 같은 값을 공유할 때 state의 소유자를 정하고, controlled 컴포넌트로 협력하게 만든다.
- 🧩 핵심 키워드: state 끌어올리기, 공통 부모, 단일 진실 공급원, controlled 컴포넌트, 파생 값
- ⭐ 중요도: ★★★★★ — 중복 state와 서로 어긋나는 화면을 예방하는 핵심 설계 원칙이다.
- 📝 한눈에 보는 내용: 함께 바뀌어야 하는 값은 가장 가까운 공통 부모가 소유하고, 값은 Props로 내려가며 변경 의도는 콜백으로 올라간다.
- 🔗 관련 주제: Props, 이벤트, Context, 상태 구조
- 🧱 선수 지식: 부모·자식 컴포넌트, 함수 Props, `useState`

---

형제 컴포넌트가 같은 정보를 각각 state로 저장하면 한쪽만 바뀌는 순간 화면이 어긋난다. state 끌어올리기는 공유할 값을 공통 부모 한 곳에 두고 자식들이 같은 원본을 보게 만드는 방법이다.

## 1. 언제 끌어올리는가?

두 컴포넌트가 항상 함께 바뀌어야 하는데 각자 같은 의미의 state를 가지면 값이 어긋날 수 있다. 이때 가장 가까운 공통 부모로 state를 옮기고 값과 변경 함수를 props로 전달한다.

1. 자식의 중복 state를 제거한다.
2. 공통 부모에 state를 둔다.
3. 현재 값은 아래로, 사용자 의도는 콜백으로 위로 전달한다.

### state 소유자를 찾는 질문

state를 어디에 둘지 애매하면 컴포넌트 이름보다 **그 값을 읽고 바꾸는 범위**를 먼저 본다.

1. 어떤 컴포넌트들이 이 값을 화면에 표시하는가?
2. 어떤 사용자 행동이 이 값을 바꾸는가?
3. 그 컴포넌트들을 모두 포함하는 가장 가까운 공통 부모는 누구인가?
4. props나 다른 state로 계산할 수 있어 아예 저장하지 않아도 되는가?

```text
Accordion             ← activePanelId를 소유할 후보
├── Panel A            ← 값 읽기, 변경 요청
└── Panel B            ← 값 읽기, 변경 요청
```

두 Panel이 서로 직접 값을 주고받는 것이 아니다. 공통 부모가 현재 값을 소유하고 두 자식의 요청을 조정한다.

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
      {/* 값은 부모가 내려 주고, 입력된 새 문자열은 callback으로 부모에게 전달한다. */}
      <input
        value={value}
        onChange={event => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

export default function SyncedFields() {
  // 두 입력이 공유할 원본 값을 공통 부모가 소유한다.
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

### controlled와 uncontrolled는 절대적인 분류가 아니다

컴포넌트가 중요한 값을 자신의 state로 관리하면 그 값에 대해서는 uncontrolled라고 설명할 수 있다. 부모가 props로 값을 결정하고 콜백으로 변경을 요청받으면 그 값에 대해서는 controlled다. 하나의 컴포넌트 안에서도 어떤 값은 controlled이고 다른 값은 내부 state일 수 있다.

```tsx
type PanelProps = {
  title: string
  isOpen: boolean
  onOpen: () => void
}

function Panel({ title, isOpen, onOpen }: PanelProps) {
  return (
    <section>
      <h2>{title}</h2>
      {isOpen ? (
        <p>현재 열린 패널의 내용입니다.</p>
      ) : (
        <button type="button" onClick={onOpen}>
          열기
        </button>
      )}
    </section>
  )
}

function Accordion() {
  // boolean 두 개 대신 어느 패널이 열렸는지를 하나의 값으로 표현한다.
  const [activeId, setActiveId] = useState<'guide' | 'practice'>('guide')

  return (
    <>
      <Panel
        title="개념 안내"
        isOpen={activeId === 'guide'}
        onOpen={() => setActiveId('guide')}
      />
      <Panel
        title="연습 문제"
        isOpen={activeId === 'practice'}
        onOpen={() => setActiveId('practice')}
      />
    </>
  )
}
```

`isGuideOpen`과 `isPracticeOpen`을 따로 저장하면 둘 다 열리거나 둘 다 닫히는 상태가 생길 수 있다. `activeId` 하나는 “항상 하나만 열린다”는 화면 규칙을 데이터 구조에 담는다.

## 4. state와 파생 값

```tsx
type Product = { id: string; name: string; category: string }

function ProductList({ products }: { products: Product[] }) {
  // 사용자가 선택하는 필터 조건만 state로 저장한다.
  const [category, setCategory] = useState<string>('all')
  // 표시 목록은 products와 category로 계산할 수 있으므로 state로 복제하지 않는다.
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

state는 공유할 필요가 있는 만큼만 올린다. 모달 안의 입력 초안처럼 모달만 사용하는 값까지 페이지 루트에 두면 수정 이유가 다른 state가 한곳에 모인다. 반대로 목록과 상세 패널이 같은 선택 항목을 사용한다면 선택 ID는 둘의 공통 부모가 소유하는 편이 자연스럽다.

| 값 | 알맞은 위치의 예 |
| --- | --- |
| 한 입력의 focus 여부 | 입력 컴포넌트 내부 |
| 형제 입력이 공유하는 검색어 | 두 입력의 공통 부모 |
| 현재 로그인 사용자 | 넓은 하위 트리의 Provider 또는 인증 계층 |
| 서버에서 가져온 게시물 캐시 | 서버 상태 관리 계층 |

## 6. 적용 관점에서 다시 보기

두 화면이 같은 의미의 값을 표시하는데 서로 다르게 바뀐다면 중복 state를 의심한다. 각 state를 제거하고 가장 가까운 공통 부모에 원본 값을 둔 뒤, 자식에게 현재 값과 변경 함수를 전달한다.

state를 너무 멀리 올리면 관련 없는 컴포넌트까지 Props가 늘어날 수 있다. 먼저 컴포넌트 합성과 책임 분리를 검토하고, 정말 멀리 떨어진 여러 소비자가 필요할 때 Context를 고려한다.

## 7. 배운 점 / 확장 포인트

### 7.1 새로 이해한 것

단일 진실 공급원은 모든 값을 전역에 저장하라는 규칙이 아니다. 각각의 state 조각마다 책임지는 소유자를 하나 정하라는 뜻이다.

### 7.2 이전·다음 학습과의 연결

함수 Props와 controlled 폼이 state 끌어올리기의 실제 형태다. 이 흐름이 길어질 때 합성과 Context를 비교하게 된다.

### 7.3 더 확인할 주제

- 중복·모순·불필요한 state 제거
- `useReducer`를 이용한 복잡한 전이
- Context와 전역 상태 도구의 차이

## 8. 요약 정리

공유 state는 가장 가까운 공통 부모가 소유한다. 자식은 값과 콜백을 받아 controlled 방식으로 동작하며, 계산 가능한 값은 중복 저장하지 않는다.

🧠 기억할 것: 공유 값은 가장 가까운 공통 부모 한 곳에 두고, 값은 아래로 전달하며 변경 의도는 위로 전달한다.

## 9. 미니 퀴즈

1. 형제 컴포넌트의 값을 동기화하는 세 단계는 무엇인가?
2. 단일 진실 공급원이 모든 state를 루트에 두라는 뜻이 아닌 이유는 무엇인가?
3. props와 state로부터 계산 가능한 값을 다시 state로 저장하면 어떤 문제가 생기는가?

<details>
<summary>정답과 해설</summary>

1. 자식의 중복 state를 제거하고, 공통 부모에 state를 만든 뒤, 값과 변경 콜백을 Props로 전달한다.
2. 각 값은 실제로 공유하는 컴포넌트들의 가장 가까운 공통 부모가 소유하면 된다. 관련 없는 값까지 루트로 올릴 필요는 없다.
3. 원본이 바뀔 때 파생 state 갱신을 빠뜨려 서로 다른 값을 표시할 수 있다.

</details>

## 참고 자료

- [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
- [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [Thinking in React](https://react.dev/learn/thinking-in-react)
