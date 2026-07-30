# 상속보다 합성으로 컴포넌트 재사용하기

> 학습 목표: `children`과 명시적인 슬롯 Props로 컴포넌트를 조합하고, React UI 재사용에서 상속이 거의 필요하지 않은 이유를 이해한다.

## 1. 합성이란?

합성은 작은 컴포넌트를 JSX 안에 배치해 더 큰 UI를 만드는 방식이다. 부모가 자식의 내부 구현을 상속받는 대신 필요한 UI 조각을 props로 전달한다.

## 2. `children`으로 내용 감싸기

```tsx
import type { ReactNode } from 'react'

type PanelProps = {
  title: string
  children: ReactNode
}

function Panel({ title, children }: PanelProps) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function HelpPage() {
  return (
    <Panel title="도움말">
      <p>단축키와 자주 묻는 질문을 확인하세요.</p>
      <button type="button">문의하기</button>
    </Panel>
  )
}
```

`Panel`은 내부 내용이 무엇인지 알 필요가 없다. 전달받은 JSX를 배치하는 책임만 가진다.

## 3. 여러 위치가 필요하면 명시적인 슬롯

```tsx
type DialogProps = {
  header: ReactNode
  body: ReactNode
  footer?: ReactNode
}

function Dialog({ header, body, footer }: DialogProps) {
  return (
    <section role="dialog" aria-modal="true">
      <header>{header}</header>
      <div>{body}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  )
}
```

`children` 하나로 위치가 불분명해지면 `header`, `body`, `footer`처럼 역할을 드러내는 Props가 읽기 쉽다.

## 4. 특수화도 props로 표현한다

```tsx
type AlertProps = {
  tone: 'info' | 'warning'
  children: ReactNode
}

function Alert({ tone, children }: AlertProps) {
  return <div className={`alert alert--${tone}`}>{children}</div>
}

function NetworkWarning() {
  return <Alert tone="warning">네트워크 연결을 확인하세요.</Alert>
}
```

`WarningAlert extends Alert` 같은 컴포넌트 상속보다 조합과 props가 변형 지점을 분명하게 보여 준다. 데이터가 아닌 동작을 재사용할 때는 커스텀 Hook이나 일반 함수가 더 알맞을 수 있다.

## 5. Context보다 합성을 먼저 검토

중간 컴포넌트가 사용하지 않는 데이터를 단지 아래로 전달한다면, 필요한 컴포넌트 자체를 `children`으로 위에서 만들어 내려보낼 수 있다. 이 방식은 의존성을 명시적으로 유지하며 Context의 결합을 피한다.

## 6. 요약과 복습

- 포함 관계는 `children`으로 표현한다.
- 여러 배치 위치는 이름 있는 ReactNode Props로 표현한다.
- 모양의 변형은 유니언 Props와 래퍼 컴포넌트로 만든다.
- 상태 로직 재사용은 커스텀 Hook을 검토한다.

1. `children`의 TypeScript 타입으로 무엇을 사용할 수 있는가?
2. 이름 있는 슬롯 Props가 유리한 경우는 언제인가?
3. UI 상속 대신 합성을 사용하면 어떤 관계가 더 명시적으로 보이는가?

## 참고 자료

- [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
- [Passing Data Deeply with Context: Before You Use Context](https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context)
- [Legacy: Composition vs Inheritance](https://legacy.reactjs.org/docs/composition-vs-inheritance.html)
