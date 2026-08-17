# Web 학습 순서

웹의 기본 구조와 표현을 이해한 뒤 레이아웃, 반응형 화면, 접근성, 브라우저 보안, UX/UI 설계 순서로 학습한다. 접근성과 보안은 마지막 장식 단계가 아니라 앞에서 배운 HTML·CSS·HTTP를 다양한 이용 방식과 신뢰 경계까지 확장하는 과정이다. 마지막에는 사용자 흐름과 디자인 시스템을 실제 화면 구현 책임으로 연결한다.

| 순서 | 주제 | 학습 목표 | 노트 |
| ---: | --- | --- | --- |
| 1 | HTML·CSS 기초 | 문서 구조와 스타일 규칙의 기본 관계를 이해한다. | [HTML·CSS](./02_24_HTML_CSS/02_24_HTML_CSS.md) |
| 2 | CSS Layout | 요소 배치와 레이아웃 모델을 이해한다. | [CSS Layout](./02_25_CSS_Layout/02_25_CSS_Layout.md) |
| 3 | Bootstrap | 미리 정의된 컴포넌트와 grid를 활용한다. | [Bootstrap](./02_26_Bootstrap/02_26_Bootstrap.md) |
| 4 | 반응형 웹 | 화면 크기에 유연하게 대응하는 레이아웃을 만든다. | [Responsive Web](./02_27_Responsive_Web/02_27_Responsive_Web.md) |
| 5 | 웹 접근성 | 시맨틱 HTML, 키보드, focus, 폼과 동적 상태를 다양한 사용자가 이용할 수 있게 설계한다. | [웹 접근성 기초](./05_08_15_Web_Accessibility_Fundamentals/08_15_Web_Accessibility_Fundamentals.md) |
| 6 | 브라우저 웹 보안 | SOP·CORS·cookie·XSS·CSRF·CSP의 책임을 구분하고 React·Firebase의 신뢰 경계를 설계한다. | [브라우저 웹 보안 기초](./06_08_16_Browser_Web_Security_Fundamentals/08_16_Browser_Web_Security_Fundamentals.md) |
| 7 | UX/UI 설계 | 사용자 역할·흐름·라우팅·화면 상태·컨셉보드·디자인 시스템을 구현 전에 구체화한다. | [UX/UI 기획과 디자인 시스템](./07_08_17_UX_UI_Planning_and_Design_System/08_17_UX_UI_Planning_and_Design_System.md) |

## 복습 기준

1. HTML 요소를 모양이 아니라 의미와 기본 동작으로 선택할 수 있는가?
2. flex와 grid를 사용할 상황을 구분할 수 있는가?
3. 좁은 화면과 확대 환경에서 내용이 잘리지 않도록 구성할 수 있는가?
4. 마우스 없이 주요 기능을 순서대로 사용하고 focus 위치를 확인할 수 있는가?
5. 폼의 label, 설명, 오류와 동적 상태를 보조 기술에도 전달할 수 있는가?
6. CORS·XSS·CSRF가 서로 해결하는 문제와 인증·인가의 차이를 설명할 수 있는가?
7. frontend에 둘 수 없는 secret과 서버에서 반드시 다시 검사할 값을 구분할 수 있는가?
8. 사용자 역할과 핵심 과업에서 화면 목록·라우팅·상태·디자인 규칙을 도출할 수 있는가?
