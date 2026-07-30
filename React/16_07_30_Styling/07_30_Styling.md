# React 컴포넌트 스타일링

> 학습 목표: React와 CSS의 역할을 구분하고, 정적 클래스·조건부 클래스·인라인 스타일을 상황에 맞게 선택한다.

## 1. React는 스타일 방식을 강제하지 않는다

React에서 DOM 요소의 CSS 클래스는 `className`으로 지정한다. CSS 파일을 전역으로 불러올지, CSS Modules나 CSS-in-JS를 사용할지는 빌드 도구와 프로젝트 요구에 따라 선택한다.

```tsx
import './StatusBadge.css'

type StatusBadgeProps = {
  status: 'ready' | 'running' | 'done'
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge badge--${status}`}>
      {status}
    </span>
  )
}
```

```css
.badge {
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
}

.badge--done {
  background: #dcfce7;
  color: #166534;
}
```

상태 이름을 제한된 유니언 타입으로 두면 존재하지 않는 modifier 클래스가 만들어지는 실수를 줄일 수 있다.

## 2. 조건부 클래스

조건이 많아 문자열 결합이 복잡해지면 작은 함수나 `clsx` 같은 검증된 유틸리티를 사용할 수 있다. 라이브러리를 추가하기 전에는 단순한 배열 조합으로도 충분하다.

```tsx
function ActionButton({ active, disabled }: {
  active: boolean
  disabled: boolean
}) {
  const className = [
    'action-button',
    active && 'action-button--active',
    disabled && 'action-button--disabled',
  ].filter(Boolean).join(' ')

  return <button className={className} disabled={disabled}>실행</button>
}
```

시각적으로만 disabled처럼 보여 주지 말고 실제 `disabled` 속성도 함께 지정해 동작과 접근성을 맞춘다.

## 3. 인라인 스타일은 동적 값에 사용

```tsx
type ProgressProps = { value: number }

function Progress({ value }: ProgressProps) {
  const safeValue = Math.min(100, Math.max(0, value))

  return (
    <div
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${safeValue}%` }} />
    </div>
  )
}
```

`style`은 문자열이 아니라 camelCase 속성을 가진 객체다. 숫자는 일부 속성에서 `px`로 처리되지만 단위가 필요한 값은 명시하는 편이 안전하다. hover, media query, pseudo-element처럼 CSS가 잘하는 일은 CSS에 둔다.

## 4. CSS Modules와 CSS-in-JS

- **일반 CSS**: 설정이 단순하며 전역 이름 충돌을 팀 규칙으로 관리한다.
- **CSS Modules**: 빌드 과정에서 클래스 이름을 지역화해 컴포넌트 단위 충돌을 줄인다.
- **CSS-in-JS**: props 기반 스타일과 테마에 유연하지만 런타임 비용, SSR, 번들 크기, 라이브러리 유지 상태를 확인한다.

강의에서 사용하는 `styled-components`는 가능한 선택지 중 하나이지 React의 기본 스타일 방식이 아니다. 처음에는 일반 CSS 또는 Vite가 지원하는 CSS Modules로 CSS 자체를 익힌 뒤 도입 이유가 분명할 때 선택한다.

## 5. 유지보수 기준

- 색상·간격·글꼴 같은 반복 값은 CSS custom properties로 모은다.
- 컴포넌트 상태 이름과 스타일 modifier 이름을 일치시킨다.
- DOM 구조를 CSS 선택자에 지나치게 강하게 결합하지 않는다.
- 색만으로 상태를 구분하지 않고 텍스트와 ARIA 상태를 함께 제공한다.
- 전역 reset, 레이아웃, 컴포넌트 스타일의 책임을 구분한다.

## 6. 요약과 복습

React는 스타일링 솔루션이 아니다. 정적인 표현은 CSS 클래스, JavaScript 값에 따라 수치가 바뀌는 경우는 `style`, 범위 격리가 필요하면 CSS Modules를 우선 검토한다.

1. JSX에서 `class` 대신 무엇을 사용하는가?
2. 인라인 스타일보다 CSS가 더 적합한 기능은 무엇인가?
3. CSS-in-JS 라이브러리 도입 전에 확인할 비용은 무엇인가?

## 참고 자료

- [React Quick Start: Adding styles](https://react.dev/learn#adding-styles)
- [React DOM Common Components: `className` and `style`](https://react.dev/reference/react-dom/components/common)
- [Vite CSS Modules](https://vite.dev/guide/features.html#css-modules)
