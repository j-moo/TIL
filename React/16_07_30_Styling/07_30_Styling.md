# React 컴포넌트 스타일링

- 🎯 글의 목표: React와 CSS의 역할을 구분하고, 정적 클래스·조건부 클래스·인라인 스타일을 상황에 맞게 선택한다.
- 🧩 핵심 키워드: `className`, 조건부 클래스, inline style, CSS Modules, CSS-in-JS
- ⭐ 중요도: ★★★★☆ — 컴포넌트 상태를 시각적으로 표현하면서 구조·동작·스타일의 책임을 나눈다.
- 📝 한눈에 보는 내용: 고정된 표현은 CSS 클래스, JavaScript 값에 따라 달라지는 수치는 style 객체를 사용한다. 스타일 도구는 프로젝트 요구와 비용을 비교해 선택한다.
- 🔗 관련 주제: JSX, 접근성, 컴포넌트 상태, 디자인 토큰
- 🧱 선수 지식: CSS 선택자, JSX 속성, 문자열 템플릿

---

React는 어떤 CSS 도구를 써야 하는지 정하지 않는다. React의 역할은 현재 상태에 맞는 클래스나 스타일 값을 계산하는 것이고, 실제 배치와 표현 규칙은 CSS가 담당한다. 두 책임을 구분하면 컴포넌트 코드에 스타일 세부사항이 과도하게 섞이는 것을 줄일 수 있다.

## 1. React는 스타일 방식을 강제하지 않는다

React에서 DOM 요소의 CSS 클래스는 `className`으로 지정한다. CSS 파일을 전역으로 불러올지, CSS Modules나 CSS-in-JS를 사용할지는 빌드 도구와 프로젝트 요구에 따라 선택한다.

```tsx
import './StatusBadge.css'

type StatusBadgeProps = {
  status: 'ready' | 'running' | 'done'
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  // 공통 클래스와 상태별 modifier 클래스를 함께 적용한다.
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

### `className`도 렌더링 결과다

React가 CSS 파일의 규칙을 실행하는 것은 아니다. 컴포넌트는 현재 props와 state로 문자열 또는 style 객체를 계산해 DOM에 전달하고, 브라우저의 CSS 엔진이 최종 모양을 결정한다.

```text
props·state
   ↓ React 렌더링
className·style 계산
   ↓ DOM 반영
브라우저가 CSS cascade와 layout 계산
   ↓
화면에 픽셀 표시
```

따라서 스타일 문제를 디버깅할 때 React state와 실제 DOM class가 맞는지 먼저 보고, 그 다음 CSS 선택자·우선순위·상속을 확인한다.

## 2. 조건부 클래스

조건이 많아 문자열 결합이 복잡해지면 작은 함수나 `clsx` 같은 검증된 유틸리티를 사용할 수 있다. 라이브러리를 추가하기 전에는 단순한 배열 조합으로도 충분하다.

```tsx
function ActionButton({ active, disabled }: {
  active: boolean
  disabled: boolean
}) {
  // 조건이 참일 때만 해당 클래스 문자열이 배열에 남는다.
  const className = [
    'action-button',
    active && 'action-button--active',
    disabled && 'action-button--disabled',
  ]
    // false 값을 제거한 뒤 공백으로 연결해 최종 className을 만든다.
    .filter(Boolean)
    .join(' ')

  return <button className={className} disabled={disabled}>실행</button>
}
```

시각적으로만 disabled처럼 보여 주지 말고 실제 `disabled` 속성도 함께 지정해 동작과 접근성을 맞춘다.

## 3. 인라인 스타일은 동적 값에 사용

```tsx
type ProgressProps = { value: number }

function Progress({ value }: ProgressProps) {
  // 외부에서 범위를 벗어난 값이 와도 0~100 사이로 제한한다.
  const safeValue = Math.min(100, Math.max(0, value))

  return (
    <div
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* 진행률처럼 런타임에 계산되는 수치는 style 객체로 전달한다. */}
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

`styled-components`는 가능한 선택지 중 하나이지 React의 기본 스타일 방식이 아니다. 처음에는 일반 CSS 또는 Vite가 지원하는 CSS Modules로 CSS 자체를 익힌 뒤 도입 이유가 분명할 때 선택한다.

### CSS Modules의 기본 흐름

```css
/* SaveButton.module.css */
.button {
  border: 0;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
}

.pending {
  cursor: wait;
  opacity: 0.65;
}
```

```tsx
import styles from './SaveButton.module.css'

type SaveButtonProps = { pending: boolean }

function SaveButton({ pending }: SaveButtonProps) {
  const className = [styles.button, pending && styles.pending]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? '저장 중…' : '저장'}
    </button>
  )
}
```

빌드 도구는 `styles.button`을 충돌 가능성이 낮은 실제 클래스 이름으로 바꾼다. CSS Modules는 CSS 문법을 대체하지 않으며 cascade, 상속, flex, grid 같은 CSS 개념은 그대로 적용된다.

## 5. 상태와 디자인 토큰을 분리한다

컴포넌트는 “현재 상태가 warning이다”를 결정하고, CSS는 warning의 색과 간격을 결정하도록 책임을 나눈다. 색상 값을 TSX 여러 곳에 직접 반복하면 테마 변경과 명암 대비 수정이 어렵다.

```css
:root {
  --color-surface: #ffffff;
  --color-text: #172033;
  --color-warning-surface: #fff7d6;
  --color-warning-text: #6b4f00;
  --space-2: 0.5rem;
  --radius-medium: 0.5rem;
}

.alert--warning {
  background: var(--color-warning-surface);
  color: var(--color-warning-text);
  padding: var(--space-2);
  border-radius: var(--radius-medium);
}
```

CSS custom property는 브라우저가 이해하는 값이므로 중첩된 요소에서 재정의해 테마 범위를 만들 수도 있다. TypeScript의 유니언 타입은 허용된 상태 이름을 제한하고, CSS 변수는 상태가 실제로 어떻게 보이는지 담당한다.

## 6. 반응형 UI는 화면 너비만 의미하지 않는다

반응형 스타일은 media query, container query, 유연한 grid와 flex layout을 CSS에 두는 편이 자연스럽다. 렌더링 중 `window.innerWidth`를 직접 읽어 모바일 JSX를 고르면 resize 구독, 서버 렌더링 차이, 테스트 복잡도가 생긴다.

```css
.note-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: 1rem;
}

@media (prefers-reduced-motion: reduce) {
  .animated-panel {
    transition: none;
  }
}
```

DOM 구조나 동작 자체가 달라져야 할 때만 JavaScript 상태를 검토한다. 단순 배치와 표현 변화는 CSS가 더 잘 해결한다.

## 7. 접근 가능한 상태 스타일

- hover만 만들지 말고 키보드 사용자를 위한 `:focus-visible`을 함께 설계한다.
- 색 하나만으로 성공·실패를 구분하지 않고 텍스트나 아이콘의 의미를 제공한다.
- 시각적으로 숨길 때 `display: none`이 보조 기술에서도 제거한다는 점을 이해한다.
- 비활성처럼 보이게 하는 클래스와 실제 `disabled`·`aria-disabled`의 의미를 구분한다.
- 애니메이션은 `prefers-reduced-motion` 환경을 고려한다.

## 8. 유지보수 기준

- 색상·간격·글꼴 같은 반복 값은 CSS custom properties로 모은다.
- 컴포넌트 상태 이름과 스타일 modifier 이름을 일치시킨다.
- DOM 구조를 CSS 선택자에 지나치게 강하게 결합하지 않는다.
- 색만으로 상태를 구분하지 않고 텍스트와 ARIA 상태를 함께 제공한다.
- 전역 reset, 레이아웃, 컴포넌트 스타일의 책임을 구분한다.

### Bootstrap과 Tailwind CSS는 해결 방식이 다르다

둘 다 React 전용 기능은 아니며 CSS 작성을 돕는 도구다.

| 기준 | Bootstrap | Tailwind CSS |
| --- | --- | --- |
| 기본 접근 | 완성된 버튼·폼·레이아웃 모양을 빠르게 사용 | 작은 utility class를 조합해 직접 모양 구성 |
| 장점 | 익숙한 UI를 빠르게 만들기 좋음 | 디자인을 세밀하게 맞추고 일관된 토큰을 쓰기 좋음 |
| 주의점 | 기본 인상이 강해 맞춤 디자인에는 덮어쓰기가 늘 수 있음 | className이 길어질 수 있어 반복 패턴을 컴포넌트로 묶어야 함 |
| 적합한 상황 | 관리자 화면, 빠른 프로토타입 | 커스텀 디자인 시스템, 세밀한 반응형 UI |

둘을 동시에 설치한다고 장점이 자동으로 합쳐지는 것은 아니다. reset, 우선순위, 번들 크기와 팀 규칙이 복잡해질 수 있으므로 프로젝트의 목표를 기준으로 주 도구 하나를 먼저 선택한다. 작은 프로젝트라면 일반 CSS나 CSS Modules만으로도 충분하다.

### 3D 효과와 애니메이션을 사용할 때

CSS의 `transform`, `perspective`, `transition`, `animation`으로 입체적인 카드나 회전을 만들 수 있다. 그러나 시각 효과는 정보 구조와 조작 가능성을 보조해야 하며, 과도하면 읽기와 성능을 해친다.

```css
.study-card-scene {
  /* 자식 요소의 3D 이동에서 원근감을 만든다. */
  perspective: 800px;
}

.study-card {
  /* transform이 변할 때 0.25초 동안 부드럽게 이어 준다. */
  transition: transform 0.25s ease;
}

.study-card:hover,
.study-card:focus-visible {
  /* 마우스뿐 아니라 키보드 포커스에서도 같은 강조를 제공한다. */
  transform: rotateX(4deg) rotateY(-6deg) translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .study-card {
    /* 움직임 감소를 요청한 사용자의 환경에서는 전환을 제거한다. */
    transition: none;
  }

  .study-card:hover,
  .study-card:focus-visible {
    transform: none;
  }
}
```

`will-change: transform`을 모든 요소에 상시 적용하면 메모리를 더 사용할 수 있다. 실제 성능 문제가 측정되었고 곧 변할 요소에 제한적으로 사용한다.

#### `translate3d()`가 의미하는 것

`translate3d(x, y, z)`는 요소를 3차원 좌표에서 이동시키는 CSS transform 함수다.

```text
x: 가로 이동 — 양수는 오른쪽
y: 세로 이동 — 양수는 아래쪽
z: 화면과 사용자를 잇는 깊이 축 이동
```

```css
.floating-card {
  /* 오른쪽 24px, 위쪽 12px, 사용자 방향 30px만큼 이동한다. */
  transform: translate3d(24px, -12px, 30px);
}
```

`translate3d()`만 사용했다고 항상 입체감이 눈에 보이는 것은 아니다. 부모 또는 관찰 공간에 `perspective`가 있어야 z축 거리 차이가 원근감으로 표현된다.

```html
<div class="scene">
  <article class="floating-panel">분석 결과</article>
</div>
```

```css
.scene {
  /* 관찰자와 z=0 평면 사이의 거리를 설정한다. */
  perspective: 700px;
}

.floating-panel {
  animation: float-panel 2.4s ease-in-out infinite alternate;
}

@keyframes float-panel {
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    /* 위로 이동하면서 사용자 쪽으로 조금 가까워진다. */
    transform: translate3d(0, -10px, 24px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-panel {
    animation: none;
  }
}
```

브라우저 개발자 도구에서 움직이는 요소를 조사할 때는 `transform` 한 줄만 보지 않는다. 다음 항목이 함께 효과를 만든다.

1. `animation-name` 또는 `transition`이 있는가?
2. 연결된 `@keyframes`에서 transform이 어떻게 변하는가?
3. 부모에 `perspective`가 있는가?
4. `transform-origin`이 회전 중심을 바꾸는가?
5. 가상 요소와 여러 레이어가 동시에 움직이는가?

`translate3d()`가 GPU 가속을 항상 보장한다고 생각해서 `translateZ(0)`을 습관적으로 추가하면 안 된다. 브라우저의 합성 계층 결정은 구현과 상황에 따라 달라지며, 계층이 많아지면 메모리 비용도 증가할 수 있다. 먼저 개발자 도구의 Performance와 Layers에서 실제 병목을 측정한다.

## 9. 적용 관점에서 다시 보기

먼저 의미 있는 HTML 구조와 상태를 만든 뒤 클래스를 연결한다. hover, focus, media query처럼 CSS가 직접 표현할 수 있는 것은 CSS에 두고, 진행률처럼 JavaScript 값에서 계산되는 수치만 inline style을 검토한다.

스타일이 적용되지 않으면 `class`가 아니라 `className`을 사용했는지, CSS 파일을 import했는지, 선택자 이름이 실제 DOM과 일치하는지 확인한다. 시각적 disabled 상태와 실제 `disabled` 속성도 함께 맞춰야 한다.

## 10. 배운 점 / 확장 포인트

### 10.1 새로 이해한 것

조건부 스타일링은 DOM을 직접 수정하는 작업이 아니라 현재 Props와 state에서 className을 계산하는 렌더링 로직이다.

### 10.2 이전·다음 학습과의 연결

조건부 렌더링과 같은 방식으로 상태에 맞는 클래스를 선택한다. 이후 접근성, 반응형 디자인, 디자인 토큰과 컴포넌트 라이브러리로 확장한다.

### 10.3 더 확인할 주제

- CSS custom properties와 테마
- CSS Modules의 클래스 타입
- focus-visible과 키보드 접근성

## 11. 요약 정리

React는 스타일링 솔루션이 아니다. 정적인 표현은 CSS 클래스, JavaScript 값에 따라 수치가 바뀌는 경우는 `style`, 범위 격리가 필요하면 CSS Modules를 우선 검토한다.

🧠 기억할 것: React는 상태에서 클래스와 동적 값을 계산하고, CSS는 실제 표현 규칙을 담당한다.

## 12. 미니 퀴즈

1. JSX에서 `class` 대신 무엇을 사용하는가?
2. 인라인 스타일보다 CSS가 더 적합한 기능은 무엇인가?
3. CSS-in-JS 라이브러리 도입 전에 확인할 비용은 무엇인가?

<details>
<summary>정답과 해설</summary>

1. `className`을 사용한다.
2. hover, focus, media query, pseudo-element와 같은 CSS 기능은 스타일시트가 적합하다.
3. 런타임 비용, 번들 크기, 서버 렌더링 방식, 유지보수 상태와 팀의 학습 비용을 확인한다.

</details>

## 참고 자료

- [React Quick Start: Adding styles](https://react.dev/learn#adding-styles)
- [React DOM Common Components: `className` and `style`](https://react.dev/reference/react-dom/components/common)
- [Vite CSS Modules](https://vite.dev/guide/features.html#css-modules)
