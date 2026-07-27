# React 학습 로드맵

React를 처음 배우는 사람이 **기초 개념 → 실행 환경 → JSX → 렌더링 → 컴포넌트와 Props** 순서로 이어서 볼 수 있도록 정리했다.

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

## 복습 기준

1. JSX가 HTML 문자열이 아니라 JavaScript 안에서 UI 구조를 표현하는 문법인 이유를 설명할 수 있는가?
2. `root.render(<App />)` 이후 React가 화면을 반영하는 순서를 설명할 수 있는가?
3. `onClick={handleClick}`과 `onClick={handleClick()}`의 차이를 설명할 수 있는가?
4. `useState`가 반환하는 두 값과 setter가 재렌더링을 일으키는 이유를 설명할 수 있는가?
5. Props의 타입을 정의하고 부모에서 자식으로 값을 전달할 수 있는가?

막히는 질문이 있으면 해당 노트의 `핵심 개념 정리`, `요약 정리`, `미니 퀴즈` 순서로 다시 확인한다.
