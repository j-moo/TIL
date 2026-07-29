# React 학습 로드맵

React를 처음 배우는 사람이 **기초 개념 → 실행 환경 → JSX → 렌더링 → 컴포넌트와 Props → 조건부·목록 UI → 순수한 렌더링** 순서로 이어서 볼 수 있도록 정리했다.

폴더 이름은 `[학습 순서]_[날짜]_[주제]` 형식이다. 탐색기에서 이름순으로 정렬한 뒤 `01`부터 차례대로 읽으면 된다.

## 권장 학습 순서

| 순서 | 날짜 | 주제 | 학습 목표 | 노트 |
| ---: | --- | --- | --- | --- |
| 01 | 07/26 | React 핵심 개념 | React, 컴포넌트, props, state, 렌더링의 큰 관계 이해 | [React 입문](./01_07_26_React_Introduction/07_26_React_Introduction.md) |
| 02 | 07/26 | 프로젝트 실행 환경 | Vite와 `index.html → main.tsx → App` 흐름 이해 | [Vite로 React 프로젝트 시작하기](./02_07_26_React_Project_Setup_with_Vite/07_26_React_Project_Setup_with_Vite.md) |
| 03 | 07/26 | 생태계와 도구 | SPA, 라우터, 프레임워크, React Native 역할 구분 | [React 생태계와 도구 선택](./03_07_26_React_Ecosystem/07_26_React_Ecosystem.md) |
| 04 | 07/27 | JSX | JSX와 HTML의 차이, 중괄호, TSX 작성 규칙 이해 | [TypeScript로 배우는 JSX](./04_07_27_JSX/07_27_JSX.md) |
| 05 | 07/27 | 엘리먼트와 렌더링 | React 엘리먼트, Trigger·Render·Commit, state 재렌더링 이해 | [엘리먼트와 렌더링](./05_07_27_Rendering_Elements/07_27_Rendering_Elements.md) |
| 06 | 07/27 | 컴포넌트와 Props | 컴포넌트를 나누고 TypeScript로 Props를 안전하게 전달 | [컴포넌트와 Props](./06_07_27_Components_and_Props/07_27_Components_and_Props.md) |
| 07 | 07/29 | 조건부 렌더링 | 조건에 따라 다른 JSX를 반환하거나 일부 UI를 숨기는 방법 이해 | [조건부 렌더링](./07_07_29_Conditional_Rendering/07_29_Conditional_Rendering.md) |
| 08 | 07/29 | 리스트와 key | 배열을 반복 UI로 변환하고 안정적인 key를 선택하는 기준 이해 | [리스트 렌더링과 key](./08_07_29_Rendering_Lists_and_Keys/07_29_Rendering_Lists_and_Keys.md) |
| 09 | 07/29 | 순수 컴포넌트 | 렌더링을 예측 가능한 계산으로 유지하고 변경의 위치를 구분 | [순수 컴포넌트](./09_07_29_Keeping_Components_Pure/07_29_Keeping_Components_Pure.md) |

## 복습 기준

1. JSX가 HTML 문자열이 아니라 JavaScript 안에서 UI 구조를 표현하는 문법인 이유를 설명할 수 있는가?
2. `root.render(<App />)` 이후 React가 화면을 반영하는 순서를 설명할 수 있는가?
3. `onClick={handleClick}`과 `onClick={handleClick()}`의 차이를 설명할 수 있는가?
4. `useState`가 반환하는 두 값과 setter가 재렌더링을 일으키는 이유를 설명할 수 있는가?
5. Props의 타입을 정의하고 부모에서 자식으로 값을 전달할 수 있는가?
6. `if`, 삼항 연산자, `&&`를 상황에 맞게 선택할 수 있는가?
7. 배열의 index나 `Math.random()` 대신 안정적인 ID를 key로 사용해야 하는 이유를 설명할 수 있는가?
8. 렌더링 중 외부 값을 변경하면 왜 컴포넌트가 예측 불가능해지는지 설명할 수 있는가?

막히는 질문이 있으면 해당 노트의 `핵심 개념 정리`, `요약 정리`, `미니 퀴즈` 순서로 다시 확인한다.
