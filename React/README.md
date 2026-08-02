# React 학습 로드맵

React를 처음 배우는 사람이 **기초 개념 → 실행 환경 → JSX와 컴포넌트 → 상호작용 → 상태 공유 → 구조화와 프로젝트** 순서로 학습하고 복습할 수 있도록 정리했다.

폴더 이름은 `[학습 순서]_[날짜]_[주제]` 형식이다. 탐색기에서 이름순으로 정렬한 뒤 `01`부터 차례대로 읽으면 된다. 2026-07-30 강의 PDF의 0~16장과 React 18·19 부록은 기존 노트와 비교해 중복을 통합했고, 새 코드는 함수 컴포넌트와 TypeScript를 기준으로 다시 작성했다.

## 권장 학습 순서

| 순서 | 날짜 | 주제 | 학습 목표 | 노트 |
| ---: | --- | --- | --- | --- |
| 01 | 07/26 | React 핵심 개념 | React, 컴포넌트, props, state, 렌더링의 큰 관계 이해 | [React 입문](./01_07_26_React_Introduction/07_26_React_Introduction.md) |
| 02 | 07/26 | 프로젝트 실행 환경 | Vite와 `index.html → main.tsx → App` 흐름 이해 | [Vite로 시작하기](./02_07_26_React_Project_Setup_with_Vite/07_26_React_Project_Setup_with_Vite.md) |
| 03 | 07/26 | 생태계와 도구 | React, 라우터, 프레임워크와 상태 도구의 역할 구분 | [생태계와 도구](./03_07_26_React_Ecosystem/07_26_React_Ecosystem.md) |
| 04 | 07/27 | JSX | JSX와 HTML의 차이, 중괄호, TSX 작성 규칙 이해 | [TypeScript로 배우는 JSX](./04_07_27_JSX/07_27_JSX.md) |
| 05 | 07/27 | 엘리먼트와 렌더링 | React 엘리먼트와 Trigger·Render·Commit 이해 | [엘리먼트와 렌더링](./05_07_27_Rendering_Elements/07_27_Rendering_Elements.md) |
| 06 | 07/27 | 컴포넌트와 Props | 컴포넌트를 나누고 타입이 안전한 Props 전달 | [컴포넌트와 Props](./06_07_27_Components_and_Props/07_27_Components_and_Props.md) |
| 07 | 07/30 | State와 생명주기 | state 스냅샷과 Effect setup·cleanup 이해 | [State와 생명주기](./07_07_30_State_and_Lifecycle/07_30_State_and_Lifecycle.md) |
| 08 | 07/30 | Hook | 주요 Hook의 목적과 규칙, 커스텀 Hook 이해 | [React Hook](./08_07_30_Hooks/07_30_Hooks.md) |
| 09 | 07/30 | 이벤트 | 이벤트 함수 전달, 타입, 전파와 기본 동작 제어 | [이벤트 처리](./09_07_30_Event_Handling/07_30_Event_Handling.md) |
| 10 | 07/29 | 조건부 렌더링 | 조건에 따라 다른 JSX 반환 및 일부 UI 숨기기 | [조건부 렌더링](./10_07_29_Conditional_Rendering/07_29_Conditional_Rendering.md) |
| 11 | 07/29 | 리스트와 key | 배열을 UI로 변환하고 안정적인 key 선택 | [리스트와 key](./11_07_29_Rendering_Lists_and_Keys/07_29_Rendering_Lists_and_Keys.md) |
| 12 | 07/30 | 폼 | controlled·uncontrolled 입력과 폼 타입 처리 | [React 폼](./12_07_30_Forms/07_30_Forms.md) |
| 13 | 07/30 | State 끌어올리기 | 공유 state의 소유자와 단일 진실 공급원 이해 | [State 끌어올리기](./13_07_30_Lifting_State_Up/07_30_Lifting_State_Up.md) |
| 14 | 07/30 | 합성 | `children`과 슬롯 Props로 UI 조합 | [상속보다 합성](./14_07_30_Composition/07_30_Composition.md) |
| 15 | 07/30 | Context | 깊은 데이터 전달과 Context 사용 기준 이해 | [Context](./15_07_30_Context/07_30_Context.md) |
| 16 | 07/30 | 스타일링 | 일반 CSS, 조건부 클래스, 인라인 스타일 선택 | [컴포넌트 스타일링](./16_07_30_Styling/07_30_Styling.md) |
| 17 | 07/30 | 미니 프로젝트 | 배운 개념을 학습 기록 대시보드로 통합 | [학습 기록 대시보드](./17_07_30_Mini_Project/07_30_Mini_Project.md) |
| 18 | 07/29 | 순수 컴포넌트 | 렌더링을 예측 가능한 계산으로 유지 | [순수 컴포넌트](./18_07_29_Keeping_Components_Pure/07_29_Keeping_Components_Pure.md) |
| 19 | 07/30 | React 버전 | React 18·19 자료와 현재 API를 구분 | [React 18·19 읽기](./19_07_30_React_18_and_19/07_30_React_18_and_19.md) |
| 20 | 07/31 | 데이터 패칭 | TypeScript로 요청 상태·취소·경쟁 상태·캐시를 이해 | [데이터 패칭과 비동기 상태](./20_07_31_Data_Fetching/07_31_Data_Fetching.md) |
| 21 | 08/02 | 컴포넌트 테스트 | Vitest와 Testing Library로 사용자 행동과 UI 결과 검증 | [React 컴포넌트 테스트](./21_08_02_React_Testing/08_02_React_Testing.md) |

처음 배우는 경우에는 위 목록보다 먼저 [처음부터 따라가는 React 입문 안내서](./00_08_01_React_Beginner_Guide/08_01_React_Beginner_Guide.md)를 읽는다. 각 코드 블록은 실행 순서를 이해할 수 있도록 주석을 붙였고, 이후 챕터에서 같은 개념을 더 깊게 복습한다.


## 복습 기준

1. props, state, ref 중 어떤 값에 무엇을 사용해야 하는지 설명할 수 있는가?
2. Trigger, Render, Commit과 state 스냅샷을 연결해 설명할 수 있는가?
3. 이벤트 핸들러와 Effect의 실행 원인을 구분할 수 있는가?
4. controlled 입력에서 `value`·`checked`와 `onChange`를 연결할 수 있는가?
5. 형제 컴포넌트의 공유 state를 가장 가까운 공통 부모로 옮길 수 있는가?
6. `children`, Context, 커스텀 Hook이 각각 재사용하는 대상을 구분할 수 있는가?
7. 배열의 index나 렌더링 중 생성한 값을 key로 쓰면 안 되는 이유를 설명할 수 있는가?
8. 오래된 React 자료에서 `ReactDOM.render`, CRA, 클래스 생명주기 중심 예제를 판별할 수 있는가?

막히는 질문이 있으면 각 노트의 `핵심 개념`, `요약`, `복습 질문` 순서로 다시 확인한다.
