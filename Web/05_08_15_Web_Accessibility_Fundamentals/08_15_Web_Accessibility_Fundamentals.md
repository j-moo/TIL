# React와 TypeScript로 이해하는 웹 접근성 기초

- 🎯 글의 목표: 웹 접근성이 필요한 이유와 브라우저의 접근성 트리를 이해하고, 의미 있는 HTML·키보드·focus·폼·동적 알림을 React 컴포넌트에 적용한다.
- 🧩 핵심 키워드: 접근성, WCAG, 시맨틱 HTML, 접근 가능한 이름, 키보드, focus, ARIA, live region, 보조 기술
- ⭐ 중요도: ★★★★★ — 마우스와 화면을 사용하는 한 가지 방식만 가정하면 같은 기능을 필요로 하는 많은 사용자가 서비스를 이용하지 못한다.
- 📝 한눈에 보는 내용: 네이티브 HTML로 의미와 기본 동작을 만들고, CSS로 보이는 상태를 유지하며, JavaScript로 변경한 상태를 보조 기술에도 전달한다. ARIA는 HTML에 없는 의미를 보충할 때 사용한다.
- 🔗 관련 주제: HTML, CSS, React 이벤트, 폼, 조건부 렌더링, 컴포넌트 테스트
- 🧱 선수 지식: HTML 요소, CSS 선택자, React 함수 컴포넌트와 `useState`

---

## 1. 들어가며

웹 페이지를 마우스로 보고 클릭할 수 있으면 기능이 완성됐다고 생각하기 쉽다. 하지만 사용자는 서로 다른 방식으로 웹을 이용한다.

- 키보드만으로 이동하고 실행할 수 있다.
- 화면 확대나 고대비 설정을 사용할 수 있다.
- 스크린 리더가 읽어 주는 요소의 이름과 역할로 화면을 이해할 수 있다.
- 음성 명령으로 화면에 표시된 버튼 이름을 말해 조작할 수 있다.
- 움직임에 민감해 애니메이션 감소 설정을 사용할 수 있다.
- 일시적인 부상이나 소음이 큰 환경 때문에 평소와 다른 입력·출력 방식이 필요할 수 있다.

**웹 접근성(web accessibility)** 은 특정 도구를 사용하는 사람만을 위한 별도 화면을 만드는 일이 아니다. 다양한 사용자가 같은 정보와 기능을 인식하고, 조작하고, 이해할 수 있도록 기본 화면을 설계하는 일이다.

접근성은 마지막에 자동 검사 한 번으로 추가하는 기능도 아니다. 사용할 HTML 요소를 고르는 순간, focus 이동을 설계하는 순간, 오류 메시지를 표시하는 순간마다 결정된다.

## 2. 전체 지도: 화면에 보이는 DOM만 있는 것이 아니다

브라우저는 HTML과 CSS를 이용해 시각적 화면을 만든다. 동시에 요소의 의미를 정리한 **접근성 트리(accessibility tree)** 를 운영체제의 접근성 API에 제공한다. 스크린 리더 같은 보조 기술은 이 정보를 사용한다.

```text
HTML 요소와 속성
      ↓
브라우저가 DOM과 접근성 트리 생성
      ↓
이름(name) · 역할(role) · 상태(state) · 값(value)
      ↓
스크린 리더·음성 제어·기타 보조 기술
      ↓
사용자가 정보를 이해하고 기능을 조작
```

예를 들어 다음 HTML에는 이미 많은 정보가 들어 있다.

```html
<button type="button" disabled>저장</button>
```

브라우저는 대략 다음 의미를 보조 기술에 전달할 수 있다.

```text
이름: 저장
역할: 버튼
상태: 비활성화됨
```

반대로 클릭 이벤트만 붙인 `div`는 화면에서 버튼처럼 보여도 버튼의 역할, 키보드 동작, focus 가능 여부, 비활성 상태를 자동으로 제공하지 않는다.

```tsx
// 시각적으로만 버튼처럼 만든 잘못된 출발점이다.
<div className="button" onClick={handleSave}>저장</div>

// 의미, 키보드 동작, focus, disabled 기능을 가진 기본 버튼이다.
<button type="button" onClick={handleSave}>저장</button>
```

📌 핵심: **HTML 요소 선택은 스타일 선택이 아니라 사용자와 브라우저 사이의 동작 계약을 선택하는 일이다.**

## 3. WCAG의 네 가지 원칙

WCAG(Web Content Accessibility Guidelines)는 웹 콘텐츠 접근성을 판단하는 국제 지침이다. 세부 성공 기준을 외우기 전에 네 가지 큰 원칙으로 문제를 분류하면 이해하기 쉽다.

| 원칙 | 쉬운 질문 | 예시 |
| --- | --- | --- |
| 인식 가능(Perceivable) | 정보를 한 가지 감각에만 의존하지 않는가? | 이미지 대체 텍스트, 자막, 명암 대비 |
| 운용 가능(Operable) | 마우스 없이도 기능을 조작할 수 있는가? | 키보드, focus 표시, 충분한 클릭 영역 |
| 이해 가능(Understandable) | 내용과 동작, 오류를 예측하고 이해할 수 있는가? | 명확한 label, 일관된 메뉴, 오류 해결 안내 |
| 견고함(Robust) | 브라우저와 보조 기술이 의미를 해석할 수 있는가? | 올바른 HTML, 이름·역할·상태 제공 |

영어 첫 글자를 따서 **POUR**라고 부른다. 자동 검사 도구가 통과했더라도 네 원칙에서 실제 사용이 막히면 접근 가능한 화면이라고 단정할 수 없다.

## 4. 시맨틱 HTML을 먼저 사용한다

시맨틱 HTML은 요소의 모양이 아니라 역할과 구조가 드러나는 HTML이다. `header`, `nav`, `main`, `article`, `button` 같은 요소는 브라우저와 개발자에게 의미를 제공한다.

### 4.1 페이지 구조

```tsx
export default function StudyPage() {
  return (
    <>
      <header>
        <h1>학습 기록</h1>
      </header>

      {/* nav에는 주요 탐색 링크를 둔다. */}
      <nav aria-label="주요 메뉴">
        <a href="/notes">노트</a>
        <a href="/review">복습</a>
      </nav>

      {/* 한 페이지의 핵심 콘텐츠 영역은 main으로 표현한다. */}
      <main id="main-content">
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading">최근 학습</h2>
          <StudyList />
        </section>
      </main>

      <footer>학습 기록 저장소</footer>
    </>
  )
}
```

랜드마크 요소는 사용자가 페이지의 큰 영역을 빠르게 탐색하게 돕는다. 같은 종류의 `nav`가 여러 개라면 `aria-label`이나 보이는 제목과 `aria-labelledby`로 목적을 구분한다.

### 4.2 제목 단계

제목은 글자 크기를 정하는 도구가 아니라 문서 구조를 나타낸다.

```text
h1 학습 기록
├── h2 최근 학습
│   ├── h3 React
│   └── h3 TypeScript
└── h2 이번 주 복습
```

큰 글자를 원해서 `h4`를 선택하거나 작은 글자를 원해서 `div`를 사용하지 않는다. 의미에 맞는 제목 단계를 고르고 크기는 CSS로 정한다. 컴포넌트를 재사용한다고 해서 각 컴포넌트가 무조건 `h1`부터 시작하는 것도 아니다. 최종 페이지 구조에서 제목 관계를 확인한다.

## 5. 접근 가능한 이름을 이해한다

사용자는 요소의 **접근 가능한 이름(accessible name)** 으로 기능을 구분한다. 버튼의 보이는 텍스트, input과 연결된 label, 이미지의 alt 등이 이름을 만드는 대표적인 정보다.

```tsx
// 보이는 텍스트가 버튼의 이름이 된다.
<button type="button">노트 삭제</button>

// 아이콘만 보이는 버튼에는 기능을 설명하는 이름이 필요하다.
<button type="button" aria-label="노트 삭제">
  <TrashIcon aria-hidden="true" />
</button>
```

아이콘의 모양을 설명하는 `aria-label="휴지통"`보다 실행 결과인 `노트 삭제`가 목적을 더 잘 전달한다. 장식 아이콘에 `aria-hidden="true"`를 주면 버튼 이름에 중복 정보가 포함되는 것을 피할 수 있다.

### 5.1 보이는 label을 우선한다

`aria-label`은 보이는 설명을 화면에서 없애기 위한 편의 속성이 아니다. 폼 입력처럼 모든 사용자가 목적을 알아야 하는 요소에는 가능한 한 보이는 label을 제공한다.

```tsx
import { useId } from 'react'

function SearchField() {
  // 컴포넌트 인스턴스마다 label과 input을 연결할 안정적인 ID를 만든다.
  const inputId = useId()

  return (
    <div>
      <label htmlFor={inputId}>학습 노트 검색</label>
      <input id={inputId} name="query" type="search" />
    </div>
  )
}
```

React JSX에서는 HTML의 `for` 대신 `htmlFor`를 사용한다. label을 클릭해도 input에 focus가 이동하므로 작은 입력 영역을 더 쉽게 사용할 수 있다.

placeholder는 입력이 시작되면 사라지고 명암 대비가 낮을 수 있으므로 label을 대신하지 않는다. placeholder는 필요한 경우 입력 예시를 보충하는 용도로 사용한다.

## 6. 버튼과 링크의 역할을 구분한다

모양이 비슷해도 목적이 다르면 요소도 달라진다.

| 사용자 의도 | 요소 | 예시 |
| --- | --- | --- |
| 현재 화면에서 동작 실행 | `button` | 저장, 메뉴 열기, 항목 삭제 |
| 다른 주소로 이동 | `a` 또는 라우터의 Link | 상세 페이지, 설정 페이지 |
| 값을 입력하거나 선택 | `input`, `select`, `textarea` | 검색어, 공개 여부 |

```tsx
function NoteActions({ noteId }: { noteId: string }) {
  return (
    <div>
      {/* 주소가 있으므로 링크다. */}
      <a href={`/notes/${noteId}`}>상세 보기</a>

      {/* 현재 데이터에 동작을 수행하므로 버튼이다. */}
      <button type="button" onClick={() => deleteNote(noteId)}>
        삭제
      </button>
    </div>
  )
}
```

링크를 버튼처럼 보이게 하거나 버튼을 링크처럼 보이게 하는 것은 CSS로 가능하다. 하지만 스타일 때문에 요소의 의미를 바꾸면 안 된다.

## 7. 키보드와 focus

키보드 사용자는 보통 Tab과 Shift+Tab으로 상호작용 요소 사이를 이동하고, Enter나 Space로 동작을 실행한다. 어떤 요소가 현재 입력을 받을지 나타내는 상태가 **focus**다.

### 7.1 focus 표시를 제거하지 않는다

```css
/* 기본 outline을 무조건 제거하면 현재 위치를 잃는다. */
/* button:focus { outline: none; } */

/* 키보드 탐색에서 명확한 focus 표시를 제공한다. */
.button:focus-visible {
  outline: 3px solid #2457d6;
  outline-offset: 3px;
}
```

focus 스타일은 배경과 구분되어야 하고 sticky header나 열린 패널에 완전히 가려지지 않아야 한다. 색만 약간 바꾸는 방식은 현재 위치를 알아보기 어려울 수 있다.

### 7.2 DOM 순서가 기본 focus 순서다

CSS `order`로 시각적 위치만 크게 바꾸면 화면에서 보이는 순서와 키보드 이동 순서가 달라질 수 있다. 읽기와 조작 순서가 자연스럽도록 HTML 순서부터 설계한다.

양수 `tabIndex`로 순서를 억지로 조립하면 유지보수가 어렵다.

- `tabIndex={0}`: 원래 focus되지 않는 요소를 일반 Tab 순서에 포함한다.
- `tabIndex={-1}`: Tab 순서에는 넣지 않지만 코드로 focus할 수 있게 한다.
- `tabIndex={1}` 이상의 양수: 별도 순서를 만들어 예상하기 어려우므로 피한다.

네이티브 button과 input에는 기본 focus 동작이 있으므로 `tabIndex={0}`를 다시 붙일 필요가 없다.

### 7.3 Skip link

페이지마다 반복되는 긴 메뉴를 건너뛰고 핵심 콘텐츠로 이동할 수 있게 한다.

```tsx
function AppLayout() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <Header />
      <Navigation />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  )
}
```

```css
.skip-link {
  position: fixed;
  left: 1rem;
  top: 1rem;
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: translateY(0);
  z-index: 1000;
}
```

## 8. 이미지와 대체 텍스트

`alt`는 이미지 파일명을 적는 곳이 아니라 **이미지가 현재 문맥에서 전달하는 정보나 기능**을 텍스트로 제공하는 곳이다.

```tsx
// 콘텐츠 이미지: 이미지가 전달하는 핵심 정보를 설명한다.
<img
  src="/charts/weekly-study.png"
  alt="월요일 30분에서 금요일 90분으로 증가한 주간 학습 시간 막대그래프"
/>

// 장식 이미지: 주변 텍스트에 정보가 이미 있으므로 빈 alt를 사용한다.
<img src="/decorations/sparkle.svg" alt="" />
```

이미지가 링크나 버튼 안에서 유일한 콘텐츠라면 alt가 그 동작의 이름 역할을 할 수 있다. 그래프처럼 정보가 복잡하면 alt에 모든 수치를 몰아넣기보다 근처 본문이나 표로 자세한 정보를 제공한다.

## 9. 접근 가능한 폼 만들기

폼 접근성은 label 하나로 끝나지 않는다. 필수 여부, 입력 형식, 오류 원인과 해결 방법, 제출 결과까지 연결해야 한다.

### 9.1 설명과 오류 연결

```tsx
import { useId, useState, type FormEvent } from 'react'

export default function StudyGoalForm() {
  const minutesId = useId()
  const hintId = `${minutesId}-hint`
  const errorId = `${minutesId}-error`

  // number input도 편집 중 값은 문자열로 관리해 빈 값을 표현한다.
  const [minutesText, setMinutesText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const minutes = Number(minutesText)
  const error =
    minutesText === ''
      ? '학습 시간을 입력하세요.'
      : !Number.isInteger(minutes) || minutes < 1 || minutes > 600
        ? '1분부터 600분 사이의 정수를 입력하세요.'
        : null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)

    if (error !== null) return

    // 검증된 이후에만 number 값을 애플리케이션 로직으로 전달한다.
    console.log({ minutes })
  }

  const showError = submitted && error !== null

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor={minutesId}>하루 학습 목표 시간</label>
      <p id={hintId}>1분에서 600분 사이의 정수를 입력하세요.</p>

      <input
        id={minutesId}
        name="minutes"
        type="number"
        min={1}
        max={600}
        value={minutesText}
        onChange={event => setMinutesText(event.currentTarget.value)}
        aria-invalid={showError}
        aria-describedby={showError ? `${hintId} ${errorId}` : hintId}
      />

      {showError && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}

      <button type="submit">목표 저장</button>
    </form>
  )
}
```

코드의 연결 관계는 다음과 같다.

1. `label`의 `htmlFor`와 input의 `id`가 입력 이름을 연결한다.
2. `aria-describedby`가 도움말과 오류 메시지를 input의 추가 설명으로 연결한다.
3. `aria-invalid`가 제출 후 현재 값이 유효하지 않음을 전달한다.
4. `role="alert"`가 새로 나타난 오류를 보조 기술에 알린다.
5. TypeScript는 문자열과 숫자의 구분을 돕지만 값의 범위는 런타임 코드가 검사한다.

`noValidate`는 브라우저 기본 검증 UI 대신 직접 만든 검증 흐름을 예제로 보여 주기 위해 사용했다. 기본 HTML 검증이 요구사항에 맞으면 유지하는 편이 더 단순하다. 직접 검증한다면 기본 기능을 끈 만큼 오류 식별과 안내를 책임져야 한다.

### 9.2 오류는 색으로만 표현하지 않는다

빨간 테두리만 보여 주면 색을 구분하기 어렵거나 화면을 보지 않는 사용자는 문제를 알 수 없다. 오류가 발생한 필드, 잘못된 이유, 해결 방법을 텍스트로 제공한다.

여러 오류가 있는 긴 폼은 제출 후 상단 오류 요약을 제공하고 각 필드로 이동하는 링크를 둘 수 있다. 무조건 첫 필드로 focus를 빼앗기보다 사용자가 제출한 결과와 현재 위치를 이해할 수 있는 흐름을 설계한다.

## 10. 동적으로 변하는 React UI 알리기

React는 state 변경에 따라 화면 일부를 다시 렌더링한다. 시각 사용자는 새 문장을 볼 수 있지만, focus가 그대로라면 스크린 리더는 변경을 자동으로 읽지 않을 수 있다.

### 10.1 상태 메시지

```tsx
type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'success' }
  | { status: 'error'; message: string }

function SaveStatus({ state }: { state: SaveState }) {
  if (state.status === 'idle') return null

  if (state.status === 'saving') {
    // role=status는 작업 진행 같은 중요하지만 급하지 않은 변경에 적합하다.
    return <p role="status">저장 중입니다.</p>
  }

  if (state.status === 'success') {
    return <p role="status">저장했습니다.</p>
  }

  // 즉시 알려야 하는 오류에는 alert를 제한적으로 사용한다.
  return <p role="alert">저장 실패: {state.message}</p>
}
```

`role="status"`나 `aria-live`를 페이지 전체에 많이 사용하면 잦은 알림이 작업을 방해한다. 사용자 행동의 결과나 중요한 비동기 상태처럼 실제로 알아야 하는 변경에만 사용한다.

### 10.2 펼치기 버튼

```tsx
import { useId, useState } from 'react'

function DetailsDisclosure() {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()

  return (
    <section>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(open => !open)}
      >
        학습 세부 정보
      </button>

      <div id={panelId} hidden={!isOpen}>
        오늘은 React 접근성을 복습했습니다.
      </div>
    </section>
  )
}
```

버튼이라는 역할은 네이티브 `button`이 제공한다. `aria-expanded`는 연결된 영역의 열림 상태를 보충하며 React state와 같은 boolean을 사용해 시각 상태와 접근성 상태가 어긋나지 않게 한다.

## 11. ARIA를 사용하는 기준

ARIA(Accessible Rich Internet Applications)는 HTML만으로 표현하기 어려운 동적 위젯의 역할, 상태, 관계를 보조 기술에 전달한다.

ARIA를 사용할 때 다음 순서를 지킨다.

1. 같은 의미와 동작을 제공하는 네이티브 HTML 요소가 있는지 찾는다.
2. 네이티브 요소로 부족한 상태와 관계만 ARIA로 보충한다.
3. ARIA로 역할을 추가했다면 해당 역할의 키보드 동작도 구현한다.
4. 실제 브라우저와 보조 기술 조합에서 동작을 확인한다.

```tsx
// 잘못된 접근: role만 추가해도 div에 버튼 키보드 동작은 생기지 않는다.
<div role="button" onClick={handleOpen}>열기</div>

// 좋은 출발점: button이 필요한 의미와 동작을 기본 제공한다.
<button type="button" onClick={handleOpen}>열기</button>
```

`aria-hidden="true"`를 focus 가능한 요소나 사용자가 알아야 하는 콘텐츠에 사용하면 접근성 트리에서 필요한 정보가 사라질 수 있다. ARIA는 잘못 사용하면 없는 것보다 혼란스러울 수 있으므로 속성 이름만 보고 추측하지 않고 WAI-ARIA APG의 패턴과 요구 동작을 확인한다.

## 12. Dialog 같은 복합 위젯은 신중하게 만든다

모달 Dialog는 단지 화면 중앙에 `div`를 띄우는 기능이 아니다.

- Dialog에 접근 가능한 이름이 있어야 한다.
- 열릴 때 적절한 내부 요소로 focus가 이동해야 한다.
- 열린 동안 배경 콘텐츠가 조작되지 않아야 한다.
- Tab 이동이 Dialog의 의도된 범위에서 동작해야 한다.
- Escape나 닫기 버튼으로 닫을 수 있어야 한다.
- 닫은 뒤 focus가 Dialog를 연 요소 등 논리적인 위치로 돌아가야 한다.

직접 구현하면 focus 관리와 중첩 상황에서 실수하기 쉽다. HTML `<dialog>` 또는 접근성을 검증한 headless component library를 검토하고, 사용한 도구가 모든 요구사항을 자동 해결한다고 가정하지 말고 키보드와 스크린 리더로 확인한다.

## 13. 색상, 확대, 반응형과 움직임

### 13.1 색 하나에만 의존하지 않는다

성공은 초록색, 실패는 빨간색만 보여 주지 않는다. 텍스트, 아이콘, 패턴처럼 추가 단서를 제공한다. 텍스트와 배경, focus indicator, 입력 테두리 같은 UI 구성 요소의 명암 대비도 확인한다.

### 13.2 확대와 reflow

고정 높이, 작은 픽셀 글꼴, 가로 스크롤을 강제하는 레이아웃은 확대 사용을 방해할 수 있다.

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  gap: 1rem;
}

.card-title {
  /* 내용이 늘어나도 잘리지 않도록 고정 높이를 두지 않는다. */
  overflow-wrap: anywhere;
}
```

### 13.3 움직임 감소 설정

```css
.panel {
  transition: transform 200ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    transition: none;
  }
}
```

애니메이션을 장식이 아니라 상태 이해에 사용했다면 단순히 제거했을 때도 상태가 텍스트나 위치로 이해되는지 확인한다.

## 14. 접근성 테스트 순서

자동 도구는 빠르게 반복할 수 있지만 모든 문제를 발견하지 못한다. 다음 층을 함께 사용한다.

```text
코드 작성 중
  → 시맨틱 HTML과 컴포넌트 API 검토

자동 검사
  → lint, axe, Testing Library 역할 기반 테스트

키보드 수동 검사
  → Tab 순서, focus 표시, Enter·Space·Escape, keyboard trap

브라우저 검사
  → 접근성 트리, 이름·역할·상태, 확대와 반응형

보조 기술 검사
  → 실제 스크린 리더와 브라우저 조합

사용자 평가
  → 실제 사용자의 과업 수행과 피드백
```

### 14.1 Testing Library에서 역할로 찾기

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

test('저장 버튼을 키보드로 실행하면 성공 상태를 알린다', async () => {
  const user = userEvent.setup()
  render(<NoteForm />)

  // 실제 사용자가 인식하는 role과 accessible name으로 입력을 찾는다.
  await user.type(screen.getByRole('textbox', { name: '노트 제목' }), '접근성 복습')

  // Tab 이동으로 버튼에 도달하는 키보드 흐름을 사용한다.
  await user.tab()
  expect(screen.getByRole('button', { name: '저장' })).toHaveFocus()

  await user.keyboard('{Enter}')
  expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다.')
})
```

`getByRole`로 요소를 찾지 못한다면 테스트 선택자만 바꾸기 전에 실제 화면에 올바른 역할과 이름이 있는지 확인한다. 테스트가 통과해도 focus가 시각적으로 보이는지, 알림 순서가 자연스러운지는 수동 확인이 필요하다.

## 15. 자주 하는 실수와 확인 방법

| 실수 | 발생하는 문제 | 확인·수정 기준 |
| --- | --- | --- |
| `div`에 click만 추가 | 키보드 실행과 역할이 없음 | 네이티브 button 사용 |
| outline 제거 | 키보드 사용자가 현재 위치를 잃음 | 구분되는 `:focus-visible` 제공 |
| placeholder만 사용 | 입력 후 이름이 사라짐 | 연결된 보이는 label 제공 |
| 아이콘만 있는 버튼 | 기능 이름을 알 수 없음 | 동작을 설명하는 accessible name 제공 |
| 색으로만 오류 표시 | 색을 보지 못하면 오류를 알 수 없음 | 오류 텍스트와 필드 연결 |
| 모든 변경에 `role=alert` | 알림이 작업을 방해함 | 중요도에 따라 status·alert 제한 사용 |
| ARIA role만 추가 | 필요한 키보드 동작이 없음 | 네이티브 HTML 또는 APG 패턴 구현 |
| DOM과 시각 순서 불일치 | 읽기·focus 순서가 혼란스러움 | 의미 있는 DOM 순서부터 설계 |
| 자동 검사만 통과 | 실제 조작 문제를 놓침 | 키보드·확대·보조 기술 수동 검사 |

## 16. 적용 관점에서 다시 보기

새 컴포넌트를 만들 때 다음 순서로 질문한다.

1. 이 요소는 제목, 링크, 버튼, 입력 중 어떤 의미인가?
2. 화면을 보지 않아도 이름과 역할을 알 수 있는가?
3. 마우스 없이 focus하고 실행하고 빠져나올 수 있는가?
4. 현재 선택·열림·오류·로딩 상태가 보조 기술에도 전달되는가?
5. 색, 위치, 소리 하나에만 정보를 의존하지 않는가?
6. 200% 이상 확대하거나 좁은 화면에서도 내용과 기능을 사용할 수 있는가?
7. 자동 검사 뒤에 키보드와 실제 보조 기술로 확인했는가?

접근성 오류를 발견했을 때 ARIA 속성부터 추가하지 않는다. 먼저 HTML 요소와 문서 구조가 맞는지 보고, 네이티브 의미로 해결되지 않는 상태와 관계만 ARIA로 보충한다.

## 17. 요약 정리

1. 웹 접근성은 다양한 사용자가 같은 정보와 기능을 이용할 수 있게 설계하는 일이다.
2. 브라우저는 DOM과 함께 보조 기술이 사용하는 접근성 트리를 만든다.
3. 네이티브 HTML은 이름·역할·상태와 키보드 동작의 좋은 출발점이다.
4. 제목과 landmark는 페이지의 정보 구조를 전달한다.
5. 모든 입력에는 목적을 알 수 있는 label과 필요한 안내가 있어야 한다.
6. 버튼은 동작, 링크는 이동이라는 의미를 구분한다.
7. 키보드 focus 순서는 의미 있는 DOM 순서를 따르고 focus 표시는 보여야 한다.
8. React의 동적 상태 변경은 필요한 경우 status나 alert로 보조 기술에 알린다.
9. ARIA는 네이티브 HTML을 대신하는 것이 아니라 부족한 의미와 상태를 보충한다.
10. 자동 검사, 키보드, 확대, 접근성 트리, 보조 기술 검사를 함께 수행한다.

🧠 기억할 것: **먼저 올바른 HTML로 의미와 기본 동작을 만들고, 보이는 상태와 접근성 상태가 같은 React state를 반영하도록 연결한다.**

## 18. 미니 퀴즈

1. 접근성 트리에는 어떤 종류의 정보가 전달되는가?
2. 클릭 가능한 `div`보다 `button`이 좋은 출발점인 이유는 무엇인가?
3. placeholder가 label을 대신할 수 없는 이유는 무엇인가?
4. `aria-describedby`와 `aria-invalid`는 폼에서 각각 무엇을 전달하는가?
5. `role="status"`와 `role="alert"`는 어떤 기준으로 구분해야 하는가?
6. `aria-expanded`만 추가하면 펼치기 UI의 모든 접근성이 완성되는가?
7. 자동 접근성 검사 뒤에도 수동 키보드 검사가 필요한 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 요소의 이름, 역할, 상태, 값과 요소 사이의 관계 같은 정보를 전달한다.
2. button은 역할, focus, Enter·Space 키 실행, disabled 같은 기본 동작을 브라우저가 제공한다.
3. 입력을 시작하면 사라지며 항상 보이는 입력 목적과 안내를 제공하지 못하기 때문이다.
4. `aria-describedby`는 도움말이나 오류 설명 요소를 연결하고, `aria-invalid`는 현재 입력값이 유효하지 않은 상태임을 전달한다.
5. 진행·성공처럼 급하지 않은 정보는 status, 즉시 알려야 하는 중요한 오류는 alert를 제한적으로 사용한다.
6. 아니다. 실제 콘텐츠 표시, 버튼 동작, focus 흐름, 키보드 조작과 시각적 상태도 함께 구현하고 검사해야 한다.
7. 자동 도구는 논리적인 focus 순서, 실제 키보드 조작성, 알림의 이해 가능성 같은 모든 사용자 경험을 판단하지 못하기 때문이다.

</details>

## 참고 자료

- [W3C - Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C WAI - WCAG 2.2 이해 문서](https://www.w3.org/WAI/WCAG22/Understanding/)
- [W3C WAI - 접근성 쉬운 초기 점검](https://www.w3.org/WAI/test-evaluate/preliminary/)
- [WAI-ARIA Overview](https://www.w3.org/WAI/standards-guidelines/aria/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN - Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [React DOM Common Components](https://react.dev/reference/react-dom/components/common)
- [Testing Library - About Queries](https://testing-library.com/docs/queries/about/)
