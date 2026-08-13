# 상속보다 합성으로 컴포넌트 재사용하기

- 🎯 글의 목표: `children`과 명시적인 슬롯 Props로 컴포넌트를 조합하고, React UI 재사용에서 상속이 거의 필요하지 않은 이유를 이해한다.
- 🧩 핵심 키워드: 합성, `children`, ReactNode, 슬롯 Props, 특수화
- ⭐ 중요도: ★★★★☆ — 재사용 가능한 컴포넌트를 결합하면서 의존성을 명시적으로 유지한다.
- 📝 한눈에 보는 내용: 공통 레이아웃은 내용을 Props로 받아 배치하고, 변형은 데이터 Props와 작은 래퍼 컴포넌트로 표현한다.
- 🔗 관련 주제: Props, Context, 커스텀 Hook, 컴포넌트 설계
- 🧱 선수 지식: 컴포넌트와 Props, TypeScript 객체 타입

---

화면 구조가 비슷하지만 내부 내용이 다를 때 마크업을 복사하면 수정 지점이 늘어난다. 합성은 공통 틀과 달라지는 내용을 분리해 작은 컴포넌트들을 조립하는 방식이다.

## 1. 합성이란?

합성은 작은 컴포넌트를 JSX 안에 배치해 더 큰 UI를 만드는 방식이다. 부모가 자식의 내부 구현을 상속받는 대신 필요한 UI 조각을 props로 전달한다.

재사용하려는 대상에 따라 도구가 달라진다.

| 재사용 대상 | 주로 사용하는 방법 |
| --- | --- |
| 화면의 바깥 구조와 배치 | `children`, 이름 있는 JSX Props |
| 데이터 변환 규칙 | 일반 TypeScript 함수 |
| state와 Effect를 조합한 로직 | 커스텀 Hook |
| 먼 하위 트리에 공통 값 전달 | Context |

합성은 이 중 **화면 구조**를 재사용하는 방법이다. 같은 코드가 보인다는 이유만으로 모든 것을 하나의 거대한 범용 컴포넌트에 넣지 않는다.

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
      {/* title은 정해진 위치에 표시하는 일반 데이터 Props다. */}
      <h2>{title}</h2>
      {/* 태그 사이에서 받은 JSX를 패널의 본문 위치에 배치한다. */}
      <div>{children}</div>
    </section>
  )
}

function HelpPage() {
  // Panel은 공통 바깥 구조를 만들고 내부 내용은 호출하는 쪽에서 결정한다.
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
      {/* 이름 있는 Props를 사용해 각 JSX가 들어갈 위치를 명확히 한다. */}
      <header>{header}</header>
      <div>{body}</div>
      {/* footer가 전달된 경우에만 footer 요소를 렌더링한다. */}
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
  // tone 유니언 값으로 허용된 modifier 클래스만 만들 수 있다.
  return <div className={`alert alert--${tone}`}>{children}</div>
}

function NetworkWarning() {
  return <Alert tone="warning">네트워크 연결을 확인하세요.</Alert>
}
```

`WarningAlert extends Alert` 같은 컴포넌트 상속보다 조합과 props가 변형 지점을 분명하게 보여 준다. 데이터가 아닌 동작을 재사용할 때는 커스텀 Hook이나 일반 함수가 더 알맞을 수 있다.

## 5. Context보다 합성을 먼저 검토

중간 컴포넌트가 사용하지 않는 데이터를 단지 아래로 전달한다면, 필요한 컴포넌트 자체를 `children`으로 위에서 만들어 내려보낼 수 있다. 이 방식은 의존성을 명시적으로 유지하며 Context의 결합을 피한다.

```tsx
type PageLayoutProps = {
  navigation: ReactNode
  children: ReactNode
}

function PageLayout({ navigation, children }: PageLayoutProps) {
  return (
    <div className="page-layout">
      <aside>{navigation}</aside>
      <main>{children}</main>
    </div>
  )
}

function StudyPage({ user }: { user: User }) {
  // Layout이 user를 받아 Menu로 전달할 필요 없이,
  // user를 아는 StudyPage가 완성된 navigation JSX를 전달한다.
  return (
    <PageLayout navigation={<UserMenu user={user} />}>
      <StudyList />
    </PageLayout>
  )
}
```

이 방식으로 모든 prop drilling이 사라지는 것은 아니다. 같은 값이 여러 먼 위치에서 필요하거나 하위 컴포넌트가 직접 갱신해야 한다면 Context가 더 알맞을 수 있다.

## 6. 좋은 합성 API를 만드는 기준

- 컴포넌트 이름이 레이아웃의 책임을 드러내는가?
- `isHeader`, `hasFooter`, `compact`, `wide` 같은 boolean 조합이 서로 충돌하지 않는가?
- 호출하는 쪽에서 JSX를 읽었을 때 최종 구조를 예상할 수 있는가?
- DOM 요소를 과도하게 고정해 접근성 속성을 넣기 어렵게 만들지 않았는가?
- 데이터와 동작을 정말 이 공통 컴포넌트가 알아야 하는가?

boolean Props가 많아지면 가능한 상태 조합이 빠르게 늘어난다. 역할이 다른 변형은 `variant` 유니언이나 별도 래퍼 컴포넌트로 표현한다.

```tsx
type ButtonProps = {
  variant: 'primary' | 'secondary' | 'danger'
  children: ReactNode
  onClick: () => void
}

function Button({ variant, children, onClick }: ButtonProps) {
  return (
    <button className={`button button--${variant}`} onClick={onClick}>
      {children}
    </button>
  )
}
```

## 7. 적용 관점에서 다시 보기

카드, 패널, 모달처럼 바깥 구조는 같고 내부만 달라지면 `children`을 사용한다. 헤더와 푸터처럼 들어갈 위치가 여러 곳이면 이름 있는 ReactNode Props가 의도를 더 잘 보여 준다. 로직을 공유하려는 문제라면 합성보다 커스텀 Hook이나 일반 함수를 검토한다.

Props가 지나치게 많아지면 하나의 컴포넌트가 너무 많은 변형을 책임지는지 확인한다. boolean Props 여러 개가 서로 충돌한다면 역할별 작은 컴포넌트로 나누는 편이 명확할 수 있다.

## 8. 배운 점 / 확장 포인트

### 8.1 새로 이해한 것

합성은 상위 컴포넌트가 하위 구현을 물려받는 구조가 아니라, 필요한 JSX를 입력으로 받아 원하는 위치에 배치하는 구조다.

### 8.2 이전·다음 학습과의 연결

`children`도 Props의 하나다. 합성을 먼저 검토하면 중간 컴포넌트가 데이터를 전달만 하는 prop drilling을 줄이고 Context 사용 범위도 작게 유지할 수 있다.

### 8.3 더 확인할 주제

- compound components 패턴
- render props와 커스텀 Hook 비교
- 접근 가능한 Dialog 구성

## 9. 요약 정리

- 포함 관계는 `children`으로 표현한다.
- 여러 배치 위치는 이름 있는 ReactNode Props로 표현한다.
- 모양의 변형은 유니언 Props와 래퍼 컴포넌트로 만든다.
- 상태 로직 재사용은 커스텀 Hook을 검토한다.

🧠 기억할 것: 공통 컴포넌트는 무엇을 상속할지보다 어떤 JSX와 데이터를 입력받아 어디에 배치할지 정의한다.

## 10. 미니 퀴즈

1. `children`의 TypeScript 타입으로 무엇을 사용할 수 있는가?
2. 이름 있는 슬롯 Props가 유리한 경우는 언제인가?
3. UI 상속 대신 합성을 사용하면 어떤 관계가 더 명시적으로 보이는가?

<details>
<summary>정답과 해설</summary>

1. 일반적으로 `ReactNode`를 사용한다. 문자열, 숫자, JSX, 배열, `null` 등 React가 렌더링할 수 있는 값을 포함한다.
2. 헤더·본문·푸터처럼 여러 콘텐츠가 서로 다른 위치에 들어가야 할 때 유리하다.
3. 부모가 어떤 JSX와 데이터를 자식에게 제공하고, 자식이 어디에 배치하는지가 Props로 드러난다.

</details>

## 참고 자료

- [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
- [Passing Data Deeply with Context: Before You Use Context](https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context)
- [Legacy: Composition vs Inheritance](https://legacy.reactjs.org/docs/composition-vs-inheritance.html)
