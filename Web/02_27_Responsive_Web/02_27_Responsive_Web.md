# 반응형 웹: Bootstrap Grid와 UX/UI 설계

- 🎯 글의 목표: 화면 크기가 달라도 정보의 우선순위와 사용성이 유지되는 반응형 웹을 이해하고, Bootstrap 5.3의 Grid system과 breakpoint를 이용해 실제 레이아웃을 설계·검증한다.
- 🧩 핵심 키워드: Responsive Web Design, UX, UI, viewport, media query, mobile first, Bootstrap 5.3, container, row, column, 12-column grid, breakpoint, nesting, offset, gutter, row-cols, navbar, card, semantic HTML
- ⭐ 중요도: 높음
- 📝 한눈에 보는 내용: 반응형 웹은 데스크톱 화면을 단순히 축소하는 기술이 아니라, 기기와 화면 너비에 맞게 요소의 크기·배치·노출 방식을 바꾸어 일관된 사용자 경험을 제공하는 설계 방식이다. 이번 강의는 UX/UI의 목적을 먼저 확인한 뒤, Bootstrap의 12-column Grid system, 중첩·상쇄·gutter, 여섯 breakpoint와 mobile-first 동작을 익힌다. 마지막에는 Grid, Flexbox, position을 어떤 범위에 적용할지 구분하고, 카드·내비게이션·푸터 실습을 실제 viewport 변화 관점에서 분석한다.
- 🔗 관련 문제 / 주제: 여행 블로그 반응형 내비게이션과 카드 목록, 도서 구매 카드 Grid, breakpoint별 푸터 색상, 개발자 도구의 반응형 모드로 경계값 디버깅

---

## 1. 들어가며

같은 HTML 문서라도 32인치 모니터, 태블릿, 스마트폰에서 보이는 결과는 같지 않다. 넓은 쇼핑몰 화면에서는 상품 네 개를 한 줄에 놓을 수 있지만, 그 구성을 스마트폰에 그대로 유지하면 카드와 글자가 지나치게 작아진다. 반대로 모든 요소를 세로로만 쌓으면 큰 화면의 공간을 낭비한다. 화면 밖으로 잘린 문장, 누르기 어려운 작은 버튼, 한눈에 파악할 수 없는 메뉴는 사용자를 곧바로 이탈하게 만든다.

반응형 웹 디자인은 이 문제를 “기기별 페이지를 따로 만든다”가 아니라 **하나의 콘텐츠 구조가 사용 가능한 공간에 맞추어 유연하게 재배치되게 한다**는 방향으로 해결한다. 좁은 화면에서는 상품을 한 줄에 하나씩 보여 주고 내비게이션을 접으며, 넓은 화면에서는 여러 열을 사용하고 메뉴를 펼친다. 중요한 것은 모양이 완전히 같아야 한다는 뜻의 일관성이 아니라, 어떤 환경에서도 사용자가 같은 목적을 무리 없이 달성할 수 있어야 한다는 기능적 일관성이다.

이번 강의는 먼저 UX와 UI를 구분해 “왜 반응해야 하는가”를 설명한다. 그다음 Bootstrap Grid system의 `container → row → column` 구조와 12칸 규칙을 익히고, nesting, offset, gutter로 배치를 세밀하게 조정한다. 이어서 breakpoint가 단순한 기기 이름이 아니라 CSS 규칙이 바뀌는 **최소 너비 경계값**이라는 점을 확인한다. 마지막에는 실습의 내비게이션, 카드, 푸터를 실제 화면 너비별로 추적하며, 반응형 오류를 어떻게 찾을지 연결한다.

---

## 2. 핵심 개념 정리

이번 강의가 해결하려는 중심 질문은 다음과 같다.

> 화면이 달라져도 사용자가 정보의 의미를 잃지 않고 편하게 행동하도록, 구조와 스타일을 어떤 규칙으로 바꿀 것인가?

본문은 이 질문을 다섯 단계로 풀어간다.

1. **UX/UI와 반응형 웹의 목적을 연결한다.** 화면 배치는 장식이 아니라 사용자의 행동 흐름과 만족도를 결정한다.
2. **Bootstrap Grid의 공간 모델을 익힌다.** 컨테이너 안의 행을 12개의 논리적 칸으로 보고, 각 콘텐츠가 차지할 너비를 class로 선언한다.
3. **Grid를 조합한다.** nesting은 내부에 새 12칸 문맥을 만들고, offset은 앞쪽 빈칸을 만들며, gutter는 콘텐츠 사이의 호흡을 조절한다.
4. **breakpoint로 레이아웃 변화를 설계한다.** 작은 화면을 기본값으로 두고, 화면이 충분히 넓어질 때 `sm`, `md`, `lg`, `xl`, `xxl` 규칙을 누적 적용한다.
5. **적절한 레이아웃 도구와 HTML 구조를 선택한다.** 페이지의 큰 뼈대는 Grid, 한 구역 내부 정렬은 Flexbox, 의도적인 겹침은 position이 담당한다. 의미 있는 HTML 구조는 화면 배치가 바뀌어도 콘텐츠의 관계를 보존한다.

이 흐름을 따라가면 `col-md-6`을 단순한 암기 대상이 아니라 “viewport가 768px 이상일 때 이 요소가 현재 row의 절반을 차지한다”는 설계 문장으로 읽을 수 있다.

---

## 3. 본문 정리

### 3.1 반응형 웹 디자인: 같은 콘텐츠, 달라지는 배치

반응형 웹 디자인(Responsive Web Design)은 디바이스 종류나 화면 크기와 관계없이 사용할 수 있도록 요소의 크기와 위치를 유연하게 조정하는 디자인 기술이다. 여기서 레이아웃은 각 요소의 위치와 크기를 정하여 페이지의 구조를 만드는 것을 뜻한다.

반응형이라고 해서 모든 픽셀을 화면 너비에 비례해 줄이는 것은 아니다. 보통 다음과 같이 **배치 규칙 자체**가 바뀐다.

| 화면 조건 | 가능한 결정 | 사용성에 미치는 영향 |
|---|---|---|
| 좁은 화면 | 카드를 1열로 쌓고 메뉴를 접는다. | 글자와 터치 영역을 충분히 확보한다. |
| 중간 화면 | 카드를 2열 또는 3열로 배치한다. | 스크롤 길이와 카드 가독성의 균형을 잡는다. |
| 넓은 화면 | 여러 열과 제한된 최대 콘텐츠 너비를 사용한다. | 넓은 공간을 쓰되 문장이 과도하게 길어지는 것을 막는다. |

따라서 반응형 설계의 첫 질문은 “이 기기는 스마트폰인가?”보다 “현재 콘텐츠가 이 너비에서 읽히고 조작 가능한가?”여야 한다. 기기 종류는 계속 늘어나지만, 콘텐츠가 무너지는 지점은 실제 화면을 보며 판단할 수 있기 때문이다.

⚠️ 주의: 데스크톱 레이아웃을 만든 뒤 전체를 축소하면 버튼의 물리적 터치 면적과 글자의 가독성까지 함께 줄어든다. 반응형은 축소가 아니라 **재배치와 우선순위 조정**이다.

### 3.2 UX와 UI: 반응형 웹이 존재하는 이유

UX(User Experience)는 사용자가 제품이나 서비스를 이용하는 동안 느끼는 전체 경험과 만족도를 뜻한다. 시각적 인상만이 아니라 기능이 잘 작동하는지, 원하는 목표까지 흐름이 매끄러운지, 서비스가 기대에 맞게 반응하는지가 모두 포함된다.

강의의 예시는 UX가 여러 층위에 걸쳐 있음을 보여 준다.

- 러쉬 매장 근처의 향기나 정교한 포장은 브랜드를 기억하게 하는 **감각적 경험**이다.
- 검색어에 오타가 있어도 원하는 음악을 찾아 주는 검색은 **기능적 경험**이다.
- 줄을 서지 않고 모바일 주문 후 커피를 바로 받는 과정은 **편의와 흐름의 경험**이다.

UX 설계는 사용자의 숨은 요구와 행동 패턴을 조사하고, 제품의 구조와 이용 흐름을 논리적으로 구체화하는 과정이다. 인터뷰·설문·데이터 분석과 페르소나 설정으로 사용자를 이해하고, 정보 구조(IA), 사용자 시나리오, 여정 지도(Journey Map)로 흐름을 구조화한다. 와이어프레임과 프로토타입을 만든 뒤 사용성 테스트로 가정을 검증한다. 프로토타입은 제품을 완성하기 전에 실제 작동 방식을 미리 시험하는 초기 모델이다.

UI(User Interface)는 사용자와 서비스가 만나는 접점의 디자인 요소다. 리모컨처럼 버튼의 크기·위치·눌림 피드백을 다루는 물리적 UI, ATM처럼 화면과 카드 투입구·키패드가 결합된 복합 UI, 로그인 화면처럼 입력창·버튼·경고 문구를 구성하는 디지털 UI가 모두 이에 해당한다.

UI 설계의 목표는 단순히 보기 좋게 만드는 데 머물지 않는다. 정보의 위계를 만들어 무엇을 먼저 보아야 하는지 안내하고, 일관된 규칙으로 사용자의 학습 비용을 줄여야 한다.

| UI 설계 영역 | 해결하는 문제 |
|---|---|
| 레이아웃과 Grid | 정보가 어디에 놓이고 어떻게 정렬되는가 |
| 타이포그래피와 색 | 무엇이 잘 읽히고 더 중요한가 |
| interaction state | 버튼이 기본·hover·클릭 상태를 어떻게 피드백하는가 |
| 와이어프레임 | 화면의 뼈대와 정보 구조가 타당한가 |
| 디자인 시스템 | 버튼·폰트·색·컴포넌트를 일관되게 재사용할 수 있는가 |

UX와 UI는 분리해서 이해할 수 있지만 실제 제품에서는 함께 작동한다. UI가 화면과 조작 접점을 만든다면 UX는 그 접점들을 따라 사용자가 겪는 전체 흐름을 평가한다. 반응형 웹은 화면 크기에 맞춰 UI를 바꿈으로써 여러 환경에서 UX를 지키는 방법이다.

강의의 ‘희망 보행로(Desire Path)’ 사례는 이 관계를 선명하게 보여 준다. 설계자가 예쁜 보도를 만들어도 사람들이 더 빠른 잔디밭 길을 반복해서 선택한다면, 실제 행동은 설계자의 예상과 달랐다는 뜻이다. 사용자는 설계한 대로 움직인다고 가정할 수 없다. 클릭 데이터, 이탈 지점, 사용성 테스트를 통해 실제 경로를 관찰하고 설계를 수정해야 한다.

📌 핵심: 반응형 UI의 성공 여부는 breakpoint class를 많이 썼는지가 아니라, 화면이 달라져도 사용자가 목표를 더 쉽게 달성하는지로 판단한다.

### 3.3 viewport: CSS가 바라보는 화면의 기준

실습의 모든 HTML에는 다음 meta 요소가 들어 있다.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

viewport는 브라우저가 웹 페이지를 배치하는 가시 영역이다. `width=device-width`는 레이아웃 viewport의 너비를 기기의 실제 CSS pixel 너비에 맞추고, `initial-scale=1.0`은 첫 표시 배율을 1로 설정한다. 이 선언이 있어야 모바일 브라우저에서 Bootstrap의 breakpoint와 CSS pixel 기준이 의도대로 작동한다.

예를 들어 실제 모바일 화면이 약 390 CSS px일 때 meta viewport가 올바르게 설정되어야 `.col-md-6`의 `md` 기준인 768px 미만으로 판정된다. 그러면 `md` 규칙이 적용되지 않고 모바일 기본 배치가 유지된다.

⚠️ 주의: meta viewport를 빼면 일부 모바일 브라우저는 데스크톱 사이트를 축소해 보여 주기 위한 더 넓은 가상 viewport를 사용할 수 있다. 이때 작은 기기인데도 큰 breakpoint가 적용되거나, 페이지 전체가 축소되어 “Grid class가 틀렸다”고 오해할 수 있다. 반응형 오류를 볼 때 `<head>`의 viewport 선언부터 확인한다.

### 3.4 media query와 mobile-first 사고

Media Query는 viewport 너비나 장치 특성 같은 조건에 따라 다른 CSS를 적용하는 기술이다. 강의에서는 Bootstrap 내부의 반응형 Grid도 결국 media query로 구현되어 있음을 확인한다.

```css
/* 기본값: 768px 미만의 작은 화면 */
.site-footer {
  background-color: black;
}

/* viewport가 768px 이상이면 이 규칙이 기본값을 덮어쓴다. */
@media (min-width: 768px) {
  .site-footer {
    background-color: pink;
  }
}
```

이 방식은 작은 화면의 스타일을 조건 없이 먼저 선언하고, 공간이 넓어질 때 필요한 규칙을 `min-width`로 더하는 **mobile-first** 구성이다. Bootstrap의 `sm` 이상 Grid class도 같은 방향으로 동작한다.

실습 `web_ws_4_c`는 다음처럼 두 조건을 나누어 작성했다.

```css
/* md 이상 */
@media (min-width: 768px) {
  .bg-pink {
    background-color: pink;
  }
}

/* md 미만 */
@media (max-width: 767px) {
  .bg-blackblack {
    background-color: black;
  }
}
```

그리고 footer에 두 class를 함께 붙였다.

```html
<footer class="bg-blackblack bg-pink text-white text-center mt-5 p-3">
  <!-- footer 내용 -->
</footer>
```

너비가 767px이면 두 번째 조건만 참이므로 검정색이고, 768px이면 첫 번째 조건만 참이므로 분홍색이다. 이렇게 경계가 겹치거나 비지 않게 설계한 점이 중요하다. 다만 Bootstrap의 mobile-first 패턴과 맞추려면 앞의 `.site-footer` 예시처럼 작은 화면 값을 기본값으로 두고 `min-width` 하나만 사용하는 편이 더 단순하다.

⚠️ 주의: `@media (max-width: 768px)`와 `@media (min-width: 768px)`를 함께 쓰면 정확히 768px에서 두 조건이 모두 참이다. 선택자의 구체성이 같다면 뒤에 작성된 규칙이 이겨 의도하지 않은 결과가 생긴다. 767px/768px처럼 경계를 분리하거나 mobile-first 한 방향으로 작성한다.

### 3.5 Bootstrap Grid system의 큰 구조

Bootstrap Grid system은 웹 페이지를 **12개의 논리적 column**으로 나누어 레이아웃을 구성하는 시스템이다. 개발자는 각 요소가 현재 row에서 몇 칸을 차지할지 class로 선언한다. 12는 2, 3, 4, 6으로 나누기 쉬워 절반, 3등분, 4등분 같은 구성을 표현하기 좋다.

강의 자료는 Bootstrap 5.3 문서를 기준으로 하고, 제공된 실습 HTML은 `bootstrap@5.3.8` CDN의 CSS와 bundle JavaScript를 불러온다. 이 노트의 `g-*`, `row-cols-*`, `navbar-expand-*`, `data-bs-*` 예제도 Bootstrap 5.3 계열 문법을 따른다. 다른 major version의 문서나 코드를 섞으면 class 또는 JavaScript data attribute가 달라질 수 있으므로, 실습을 재현할 때는 CSS와 JavaScript를 같은 5.3.8 버전으로 맞춘다.

Grid의 기본 계층은 다음과 같다.

```text
container
└─ row
   ├─ column
   ├─ column
   └─ column
```

- `container`는 페이지 콘텐츠를 담고 좌우 여백과 breakpoint별 최대 너비를 관리한다.
- `row`는 column을 한 행으로 묶고 gutter를 계산하는 직접 부모다.
- `column`은 실제 콘텐츠가 들어가는 영역이다.
- `gutter`는 column 콘텐츠 사이의 가로·세로 간격이다.

가장 기본적인 3등분은 다음과 같다.

```html
<div class="container">
  <div class="row">
    <div class="col-4">
      <div class="box">첫 번째 영역</div>
    </div>
    <div class="col-4">
      <div class="box">두 번째 영역</div>
    </div>
    <div class="col-4">
      <div class="box">세 번째 영역</div>
    </div>
  </div>
</div>
```

각 `col-4`는 12칸 중 4칸, 즉 row 너비의 1/3을 차지한다. 강의 코드의 `.box`는 영역을 눈으로 확인하기 위한 사용자 정의 CSS일 뿐 Bootstrap Grid의 일부가 아니다.

```css
.box {
  border: 1px solid black;
  background-color: lightblue;
  text-align: center;
}
```

숫자를 생략한 `.col`은 같은 row 안에서 남은 공간을 형제들과 균등 분배한다. 따라서 `.col` 세 개도 4칸씩 나누어진다. 반면 `.col-2`, `.col-8`, `.col-2`는 2:8:2로 명시적인 비율을 만든다.

⚠️ 주의: column class는 가급적 `.row`의 직접 자식으로 둔다. `container` 바로 아래에 `col-*`을 놓거나 `row` 없이 column을 나열하면 Bootstrap이 전제한 gutter와 flex 배치가 깨진다. 개발자 도구에서 DOM 계층을 먼저 확인하면 숫자 계산보다 빠르게 원인을 찾을 수 있다.

### 3.6 12칸의 합, 줄바꿈, 자동 너비

한 row에서 명시한 column 수의 합이 12이면 한 줄을 정확히 채운다.

| class 조합 | 해석 |
|---|---|
| `.col-4 + .col-4 + .col-4` | 4 + 4 + 4 = 12, 3등분 |
| `.col-2 + .col-8 + .col-2` | 좁은 양옆과 넓은 중앙 |
| `.col-6 + .col-6` | 6 + 6 = 12, 2등분 |
| `.col + .col + .col` | 가용 공간을 자동으로 균등 분배 |

합이 12를 넘으면 뒤 column은 다음 줄로 감긴다. 이것은 오류라기보다 Grid의 wrapping 동작이지만, 의도하지 않았다면 현재 breakpoint에서 적용되는 class를 다시 계산해야 한다. 특히 여러 breakpoint class가 한 요소에 함께 있으면 현재 viewport에서 어떤 class가 유효한지 먼저 판단한다.

Bootstrap Grid의 12칸은 실제 DOM에 빈 column 12개를 만드는 방식이 아니다. `col-4`가 비율 너비를 갖도록 CSS가 계산하는 논리적 체계다. 브라우저 개발자 도구에서 `.row`와 `.col-*`의 box model을 보면 실제 너비와 padding을 확인할 수 있다.

### 3.7 Nesting: column 안에서 새 12칸 시작하기

Nesting은 하나의 column 안에 새로운 `.row`와 column들을 넣는 방식이다. 바깥 Grid에서 8칸을 차지한 영역이라도, 그 안의 row는 다시 자체적인 12칸 문맥을 갖는다.

```html
<div class="container">
  <div class="row">
    <div class="col-4 box">바깥 4칸</div>

    <div class="col-8 box">
      <!-- 바깥의 8칸 안에서 새로운 12칸 Grid가 시작된다. -->
      <div class="row">
        <div class="col-6">
          <div class="box">내부 절반</div>
        </div>
        <div class="col-6">
          <div class="box">내부 절반</div>
        </div>
        <div class="col-6">
          <div class="box">내부 절반</div>
        </div>
        <div class="col-6">
          <div class="box">내부 절반</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

내부의 `.col-6`은 전체 container의 6/12가 아니라 **부모 `.col-8` 내부 row의 절반**이다. 따라서 페이지 전체를 기준으로 보면 각각 바깥 너비의 `8/12 × 6/12`, 즉 약 1/3을 차지한다. 앞의 두 내부 column이 첫 줄, 다음 두 개가 둘째 줄에 놓인다.

⚠️ 주의: column 안에 또 다른 `col-*`을 바로 넣지 말고 새 `.row`를 거쳐야 한다. 새 row가 내부 gutter의 기준과 12-column 문맥을 만든다.

### 3.8 Offset: 앞쪽의 논리적 빈칸 만들기

Offset은 column 앞에 지정한 수만큼의 빈 Grid 공간을 둔다. 빈 표시용 요소를 추가하지 않고 정렬할 수 있다는 장점이 있다.

```html
<div class="container">
  <div class="row">
    <div class="col-4">
      <div class="box">col-4</div>
    </div>
    <div class="col-4 offset-4">
      <div class="box">col-4 offset-4</div>
    </div>
  </div>

  <div class="row">
    <div class="col-3 offset-3"><div class="box">A</div></div>
    <div class="col-3 offset-3"><div class="box">B</div></div>
  </div>

  <div class="row">
    <div class="col-6 offset-3"><div class="box">가운데 6칸</div></div>
  </div>
</div>
```

첫 행은 `4 + offset 4 + 4 = 12`가 된다. 마지막 행의 `col-6 offset-3`은 앞에 3칸, 콘텐츠 6칸, 뒤에 남은 3칸이 되어 가운데에 놓인다.

Offset도 breakpoint infix를 가질 수 있다. 강의 예제의 마지막 카드는 작은 화면에서 중앙 위치를 만들었다가 `md`부터 offset을 제거한다.

```html
<div class="row g-4">
  <div class="col-12 col-sm-4 col-md-6">...</div>
  <div class="col-12 col-sm-4 col-md-6">...</div>
  <div class="col-12 col-sm-4 col-md-6">...</div>
  <div class="col-12 col-sm-4 col-md-6 offset-sm-4 offset-md-0">...</div>
</div>
```

- xs에서는 각 요소가 12칸이므로 한 줄에 하나다.
- `sm` 이상에서는 각 요소가 4칸이다. 마지막 요소에 `offset-sm-4`를 더해 가운데 4칸에 둔다.
- `md` 이상에서는 각 요소가 6칸이 되어 한 줄에 둘씩 놓인다. `offset-md-0`이 이전 offset을 명시적으로 제거한다.

⚠️ 주의: mobile-first class는 큰 화면에서도 계속 유효하다. `offset-sm-4`를 쓴 뒤 큰 화면에서 더는 offset이 필요하지 않다면 `offset-md-0`처럼 해제해야 한다. “새 breakpoint가 시작되면 이전 class가 자동 초기화된다”는 가정이 흔한 오류다.

### 3.9 Gutters: column 사이의 간격

Gutter는 Grid에서 column과 column 사이의 여백이다. Bootstrap 5의 가로 gutter는 각 column의 좌우 padding과 row의 보정 방식으로 만들어진다. 세로 gutter는 row의 margin과 column 쪽 간격 계산으로 행 사이를 띄운다. 중요한 결과는 column의 논리적 6칸 너비 자체를 줄이는 것이 아니라, **column 내부 콘텐츠가 사용할 수 있는 영역 사이에 간격이 생긴다**는 점이다.

| class | 효과 |
|---|---|
| `gx-0` | 가로 gutter 제거 |
| `gy-5` | 세로 gutter를 spacing 단계 5로 증가 |
| `g-5` | 가로와 세로 gutter를 모두 단계 5로 설정 |
| `g-4` | 카드 목록에서 흔히 쓰는 양방향 간격 |

```html
<div class="container">
  <div class="row g-4">
    <div class="col-6"><div class="box">1</div></div>
    <div class="col-6"><div class="box">2</div></div>
    <div class="col-6"><div class="box">3</div></div>
    <div class="col-6"><div class="box">4</div></div>
  </div>
</div>
```

`g-4`는 네 column 사이의 가로 간격뿐 아니라 첫 행과 둘째 행 사이의 세로 간격도 만든다. 실습의 여행지·도서 카드가 서로 달라붙지 않는 이유가 이 class다.

⚠️ 주의: 카드 자체에 임의의 좌우 margin을 반복해서 주면 한 줄의 총너비가 12칸을 넘어 예상치 못한 wrapping이나 가로 스크롤이 생길 수 있다. Grid 항목 사이의 규칙적인 간격은 우선 row의 `g-*`, `gx-*`, `gy-*`로 제어한다.

### 3.10 Bootstrap breakpoints: 최소 너비에서 시작되는 여섯 구간

Breakpoint는 화면 너비에 따라 레이아웃 규칙이 바뀌는 분기점이다. 강의의 Bootstrap 5.3 Grid는 12개 column과 여섯 breakpoint 구간을 사용한다.

| 구간 | viewport 최소 너비 | class infix | `.container` 최대 너비 |
|---|---:|---|---:|
| xs | 0px | 없음: `.col-6` | 없음(auto) |
| sm | 576px | `.col-sm-6` | 540px |
| md | 768px | `.col-md-6` | 720px |
| lg | 992px | `.col-lg-6` | 960px |
| xl | 1200px | `.col-xl-6` | 1140px |
| xxl | 1400px | `.col-xxl-6` | 1320px |

여기서 `md = 768px짜리 화면만`이 아니다. `.col-md-6`은 **768px 이상에서** 적용되고, 더 큰 breakpoint에서 다른 column 너비를 선언하지 않는 한 계속 유지된다. xs에는 별도 infix가 없어서 `.col-xs-12`가 아니라 `.col-12`라고 쓴다.

강의가 보여 준 실제 Bootstrap media query의 방향도 모두 `min-width`다.

```css
@media (min-width: 576px) { /* sm 이상 */ }
@media (min-width: 768px) { /* md 이상 */ }
@media (min-width: 992px) { /* lg 이상 */ }
@media (min-width: 1200px) { /* xl 이상 */ }
@media (min-width: 1400px) { /* xxl 이상 */ }
```

`sm`, `md`라는 이름은 편의를 위한 명칭이지 특정 기기를 정확히 판별하는 장치가 아니다. 브라우저 창의 CSS pixel 너비가 조건을 만족하는지가 실제 판단 기준이다.

### 3.11 여러 responsive column class 읽기

한 요소에 여러 breakpoint class를 붙이면 작은 화면에서 큰 화면으로 규칙이 단계적으로 바뀐다. 강의의 네 column 예제는 다음과 같다.

```html
<div class="container">
  <div class="row">
    <div class="col-12 col-sm-6 col-md-2 col-lg-3 col-xl-4">A</div>
    <div class="col-12 col-sm-6 col-md-8 col-lg-3 col-xl-4">B</div>
    <div class="col-12 col-sm-6 col-md-2 col-lg-3 col-xl-4">C</div>
    <div class="col-12 col-sm-6 col-md-12 col-lg-3 col-xl-12">D</div>
  </div>
</div>
```

이를 viewport별로 번역하면 다음과 같다.

| viewport | A / B / C / D | 실제 배치 |
|---|---|---|
| 0~575px | 12 / 12 / 12 / 12 | 모두 한 줄에 하나 |
| 576~767px | 6 / 6 / 6 / 6 | 한 줄에 둘씩 |
| 768~991px | 2 / 8 / 2 / 12 | 첫 세 요소가 12칸, D는 다음 줄 전체 |
| 992~1199px | 3 / 3 / 3 / 3 | 네 요소가 한 줄 |
| 1200px 이상 | 4 / 4 / 4 / 12 | A~C 한 줄, D는 다음 줄 전체 |

이처럼 class 문자열을 볼 때는 왼쪽부터 외우지 말고, **현재 viewport에서 가장 가까운 이하의 breakpoint 선언**을 찾는다. 예를 들어 850px에서는 `md` 선언이 적용되고, `lg`와 `xl`은 아직 적용되지 않는다.

⚠️ 주의: 개발자 도구에서 화면 너비를 768px로 맞췄는데 결과가 예상과 다르면 브라우저 zoom, scrollbar, iframe 또는 DevTools가 표시하는 viewport 수치를 확인한다. breakpoint는 모니터의 물리 pixel이 아니라 CSS viewport width를 기준으로 한다.

### 3.12 `container`와 `container-fluid`: 폭을 제한할 것인가

`.container`는 breakpoint마다 최대 너비가 정해져 있어 큰 화면에서도 콘텐츠가 끝없이 늘어나지 않는다. 좌우에 자동 여백이 생기므로 본문과 카드 목록을 안정적인 읽기 폭 안에 두기 좋다. 실습의 카드 영역은 `.container mt-5`를 사용한다.

반면 `.container-fluid`는 모든 viewport에서 사용 가능한 너비를 거의 모두 쓴다. 실습 내비게이션은 브랜드와 메뉴를 화면 양끝에 가깝게 배치하기 위해 navbar 내부에 `.container-fluid`를 사용한다.

```html
<nav class="navbar navbar-expand-md bg-primary" data-bs-theme="dark">
  <div class="container-fluid">
    <a class="navbar-brand" href="#">여행 블로그</a>
    <!-- 토글 버튼과 메뉴 -->
  </div>
</nav>
```

무조건 넓게 쓰는 것이 반응형은 아니다. 긴 본문 텍스트는 너무 넓으면 다음 줄을 찾기 어려워지고, 카드 이미지도 과도하게 커질 수 있다. 콘텐츠의 성격에 따라 최대 너비가 있는 container와 전체 폭 container를 선택한다.

### 3.13 Grid cards와 `row-cols-*`

각 column의 너비보다 “한 행에 몇 개를 보여 줄 것인가”가 더 중요한 카드 목록에서는 `row-cols-*`가 간결하다. 이 class는 row의 자식 column 수를 breakpoint별로 제어한다.

```html
<div class="container">
  <div class="row row-cols-1 row-cols-sm-3 row-cols-md-2 g-4">
    <div class="col">
      <article class="card h-100">
        <div class="card-body">
          <h2 class="h5 card-title">Card title</h2>
          <p class="card-text">카드 설명</p>
        </div>
      </article>
    </div>
    <!-- 같은 구조의 column 반복 -->
  </div>
</div>
```

- xs에서는 `row-cols-1`: 한 행에 1개
- sm 이상에서는 `row-cols-sm-3`: 한 행에 3개
- md 이상에서는 `row-cols-md-2`: 한 행에 2개
- `g-4`: 카드의 가로·세로 간격

`row-cols-sm-3` 뒤에 `row-cols-md-2`가 있으므로 더 넓은 화면에서 열 수가 오히려 줄어든다. 문법상 완전히 가능하며 강의 예제도 이를 보여 준다. 다만 일반적인 상품 목록에서는 화면이 넓어질수록 열 수가 늘어나는 경우가 많으므로, 이것이 콘텐츠 의도와 맞는지 확인해야 한다.

실습 `web_ws_4_b`와 `web_ws_4_c`는 `row row-cols-1 row-cols-md-3 g-4`를 사용한다. 767px까지는 카드가 한 줄에 하나이고, 768px부터는 한 줄에 세 개다. 네 번째 카드는 다음 줄 첫 번째 자리에 놓인다.

실습 `web_hw_4_2`는 같은 결과를 각 column에 직접 선언한다.

```html
<div class="row g-4">
  <div class="col-12 col-md-6 col-lg-4">
    <div class="card">
      <img src="book1.jpg" class="card-img-top" alt="도서 표지">
      <div class="card-body">
        <h2 class="h5 card-title">책 제목</h2>
        <p class="card-text">책 설명이 여기에 들어갑니다.</p>
        <button class="btn btn-primary">구매하기</button>
      </div>
    </div>
  </div>
</div>
```

이 코드는 xs에서 12칸이므로 1열, md에서 6칸이므로 2열, lg에서 4칸이므로 3열이다. `row-cols-*`는 자식들이 같은 열 수를 공유할 때 간결하고, 개별 column마다 다른 비율이나 offset이 필요하면 `col-*-*` 방식이 더 명시적이다.

⚠️ 주의: 실습 이미지의 `alt="..."`는 학습용 placeholder일 뿐 실제 서비스에 적합하지 않다. 이미지가 정보를 전달한다면 “도서명 표지”, “여행지 전경”처럼 목적을 설명하고, 순수 장식 이미지라면 빈 `alt=""`를 사용한다.

### 3.14 responsive navbar: 공간이 부족할 때 메뉴 접기

여행 블로그 실습의 내비게이션은 `navbar-expand-md`를 사용한다.

```html
<nav class="navbar navbar-expand-md bg-primary" data-bs-theme="dark">
  <div class="container-fluid">
    <a class="navbar-brand" href="#">여행 블로그</a>

    <button
      class="navbar-toggler"
      type="button"
      data-bs-toggle="collapse"
      data-bs-target="#navbarNav"
      aria-controls="navbarNav"
      aria-expanded="false"
      aria-label="메뉴 열기"
    >
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="navbarNav">
      <ul class="navbar-nav">
        <li class="nav-item"><a class="nav-link active" aria-current="page" href="#">홈</a></li>
        <li class="nav-item"><a class="nav-link" href="#">목적지</a></li>
        <li class="nav-item"><a class="nav-link" href="#">여행 팁</a></li>
      </ul>
    </div>
  </div>
</nav>
```

`navbar-expand-md`는 md 미만에서는 메뉴를 collapse 상태로 두고 토글 버튼을 보이며, 768px 이상에서는 메뉴를 펼친다. 접힌 메뉴가 클릭으로 열리려면 CSS만으로는 충분하지 않고, 실습처럼 Bootstrap bundle JavaScript가 로드되어야 한다. bundle에는 collapse 동작에 필요한 코드가 포함된다.

실습은 `style="flex-grow: 0;"`으로 collapse 영역이 남은 공간을 모두 차지하지 않게 했다. 동작은 하지만 표현과 구조를 분리하려면 사용자 정의 class나 Bootstrap utility로 옮기는 편이 유지보수에 유리하다.

⚠️ 주의: 토글 버튼이 보이는데 눌러도 메뉴가 열리지 않으면 다음 순서로 확인한다.

1. Bootstrap bundle script가 `</body>` 앞에서 실제로 로드되는가?
2. `data-bs-target="#navbarNav"`와 대상의 `id="navbarNav"`가 정확히 같은가?
3. 같은 `id`가 문서에 중복되지 않았는가?
4. CSS와 JavaScript의 Bootstrap major version이 일치하는가?

### 3.15 responsive images와 component 높이

Bootstrap의 `.card-img-top`은 카드 상단 이미지 스타일을 제공하며 카드 폭에 맞게 표시된다. 일반 콘텐츠 이미지에는 `.img-fluid`를 사용하면 `max-width: 100%`와 `height: auto`가 적용되어 부모보다 넓어지는 것을 막을 수 있다.

```html
<img
  src="destination.webp"
  class="img-fluid"
  alt="바다와 산이 보이는 추천 여행지"
>
```

반응형 이미지에서 확인할 것은 단순히 폭뿐만이 아니다.

- 원본 종횡비가 서로 다르면 카드 높이가 들쭉날쭉해질 수 있다.
- 고정 높이와 `object-fit: cover`를 쓰면 정돈되지만 이미지 일부가 잘릴 수 있다.
- 작은 화면에서도 지나치게 큰 원본만 내려받으면 데이터와 렌더링 비용이 낭비된다. 이후에는 `srcset`, `sizes`, `<picture>`로 해상도와 crop을 다르게 제공할 수 있다.
- 이미지 아래 설명 길이가 다르면 버튼 위치가 달라질 수 있다. 필요하면 card에 `h-100`, body에 flex utility를 조합해 같은 행의 정렬을 맞춘다.

이미지는 레이아웃을 채우는 장식이 아니라 콘텐츠다. crop 때문에 핵심 피사체가 사라지는지, 대체 텍스트가 맥락을 전달하는지, 작은 화면에서 다운로드 비용이 과하지 않은지까지 UX 관점에서 점검한다.

### 3.16 semantic HTML: 배치가 바뀌어도 의미는 유지한다

실습 A와 B는 내비게이션 다음 콘텐츠를 일반 `div`로 감싸지만, 실습 C는 카드 목록을 `<main>`, 하단 정보를 `<footer>`로 구분한다. `<nav>`, `<main>`, `<footer>` 같은 semantic element는 화면 모양이 아니라 문서에서 맡는 역할을 표현한다.

```html
<body>
  <nav aria-label="주요 메뉴">...</nav>

  <main class="container mt-5">
    <h1 class="text-center">추천 여행지</h1>
    <section aria-labelledby="destinations-heading">
      <!-- 카드 Grid -->
    </section>
  </main>

  <footer>...</footer>
</body>
```

반응형 디자인에서는 시각적 순서가 바뀔 수 있으므로 의미 있는 source order가 특히 중요하다. 기본 DOM 순서는 키보드 탐색과 screen reader가 읽는 흐름의 기준이 된다. Bootstrap에는 flex/order utility도 있지만, 시각적으로만 순서를 바꾸면 보이는 순서와 읽는 순서가 달라질 수 있다. 이번 강의의 핵심 예제는 order 변경을 사용하지 않으며, 실제로 필요할 때도 먼저 HTML 순서를 논리적으로 설계해야 한다.

제목 계층도 의미를 가진다. 카드 제목을 모두 `h5`로 보이게 하고 싶다고 해서 문서 구조까지 무조건 `<h5>`로 시작할 필요는 없다. `<h2 class="h5">`처럼 의미상 2단계 제목이면서 Bootstrap의 `h5` 시각 스타일을 적용할 수 있다.

⚠️ 주의: 의미 구조를 CSS 배치에 맞춰 뒤집지 않는다. “모바일에서 먼저 보이게 하려고 DOM 끝의 중요한 콘텐츠에 order만 준다”는 방식은 키보드 focus 순서와 시각적 순서를 어긋나게 할 수 있다.

### 3.17 CSS 레이아웃 도구를 함께 쓰는 전략

강의는 실제 숙박 서비스 화면을 보며 한 페이지에도 여러 레이아웃 기술이 동시에 쓰인다는 점을 정리한다.

- **Bootstrap Grid system**은 카드 목록의 열 수와 페이지의 큰 구역을 만든다.
- **Flexbox**는 내비게이션의 로고와 메뉴, 카드 내부의 라벨과 버튼처럼 한 구역 안 요소를 정렬한다.
- **position**은 고정 header, 이미지 위의 찜 버튼·배지처럼 정상 흐름에서 벗어나 겹쳐야 하는 요소에 사용한다.

강의의 비유로 보면 position은 벽에 붙이는 스티커, Flexbox는 방 안의 가구, Bootstrap Grid는 건물의 뼈대다. 페이지 전체 구조를 position 좌표로 맞추거나, 작은 버튼 정렬을 12-column Grid로 해결하려 하면 도구의 범위를 잘못 선택한 것이다.

```text
페이지 전체(container / row / columns)  → Bootstrap Grid
└─ 카드 한 개 내부(제목 / 가격 / 버튼) → Flexbox
   └─ 이미지 위 찜 아이콘             → position
```

이 도구들은 경쟁 관계가 아니라 상호 보완적이다. “숲은 Grid로 빠르게 짓고, 나무는 Flexbox로 세밀하게 다듬는다”는 문장이 선택 기준을 잘 요약한다.

### 3.18 Grid는 CSS framework 이전의 디자인 원리다

Grid system은 Bootstrap이 처음 만든 개념이 아니다. 편집 디자인에서 행과 열을 맞추고 정보 구조에 질서를 부여하기 위해 사용해 온 시각 체계가 웹으로 이어진 것이다. 일정한 축, 반복되는 간격, 정렬된 경계는 서로 다른 콘텐츠가 같은 시스템에 속한다는 느낌을 준다.

따라서 `col-4`를 적용했다고 자동으로 좋은 디자인이 되지는 않는다. 제목, 이미지, 설명, 행동 버튼의 위계와 여백이 일관되어야 하며, 콘텐츠 밀도에 맞는 열 수를 골라야 한다. 넓은 화면에서 열 수를 무조건 늘리면 카드가 너무 좁아져 읽기 어려울 수 있고, 작은 화면에서 정보를 모두 유지하면 핵심 행동이 묻힐 수 있다.

삼성 One UI, Apple 디자인 가이드, Google Material Design 같은 UI guideline과 디자인 시스템은 이러한 일관성을 조직 전체에서 유지하기 위한 규칙을 제공한다. 버튼 상태, 간격, 타이포그래피, color contrast, component 동작을 표준화하면 사용자의 학습 비용과 개발자의 반복 작업이 함께 줄어든다. 강의가 소개한 `Can't Unsee` 같은 비교 훈련은 정렬, 간격, 대비의 작은 차이가 실제 사용 인상에 어떤 영향을 주는지 관찰하게 한다.

---

## 4. 적용 관점에서 다시 보기

### 4.1 레이아웃을 구현하는 순서

반응형 페이지를 만들 때는 class부터 붙이기보다 다음 순서로 결정하면 오류가 줄어든다.

1. **콘텐츠와 행동의 우선순위를 정한다.** 작은 화면에서 반드시 보여야 할 제목, 메뉴, 행동 버튼이 무엇인지 고른다.
2. **semantic HTML을 먼저 작성한다.** `nav`, `main`, `section`, `article`, `footer`와 논리적인 제목·focus 순서를 만든다.
3. **작은 화면 기본 배치를 만든다.** 대부분 한 열로 시작하고 이미지와 버튼이 부모 폭을 넘지 않는지 확인한다.
4. **콘텐츠가 답답하거나 공간이 남는 지점을 찾는다.** 관습적인 기기 이름이 아니라 실제 콘텐츠가 무너지는 너비를 관찰한다.
5. **가장 가까운 Bootstrap breakpoint로 확장 규칙을 선언한다.** 카드가 md부터 2열, lg부터 3열이어야 한다면 `col-12 col-md-6 col-lg-4`로 표현한다.
6. **Grid 안쪽은 Flexbox와 component utility로 다듬는다.** button 정렬이나 card body 배치까지 Grid column을 남발하지 않는다.
7. **경계값의 앞·정확한 값·뒤를 검증한다.** md라면 767px, 768px, 769px를 모두 본다.

### 4.2 세 실습을 viewport별로 예측하기

실습 결과는 브라우저를 열기 전에 class에서 먼저 예측할 수 있어야 한다.

| viewport 예 | 내비게이션 `navbar-expand-md` | 여행 카드 `row-cols-1 row-cols-md-3` | 도서 카드 `col-12 col-md-6 col-lg-4` | 실습 C footer |
|---:|---|---|---|---|
| 390px | 접힘, 토글 표시 | 1열 | 1열 | 검정 |
| 767px | 접힘 | 1열 | 1열 | 검정 |
| 768px | 펼침 | 3열 | 2열 | 분홍 |
| 991px | 펼침 | 3열 | 2열 | 분홍 |
| 992px | 펼침 | 3열 | 3열 | 분홍 |

이 표에서 768px은 여러 변화가 동시에 일어나는 중요한 지점이다. 메뉴가 펼쳐지고, 여행 카드는 갑자기 1열에서 3열로 바뀌며, 도서 카드는 2열이 되고, footer 색도 바뀐다. 각각 문법상 맞더라도 실제 콘텐츠가 768px에서 세 장의 긴 설명을 감당할 수 있는지는 별도의 UX 판단이다. 카드가 지나치게 좁다면 `row-cols-lg-3`로 늦추는 편이 나을 수 있다.

### 4.3 반응형 디버깅 체크 순서

레이아웃이 예상과 다르면 무작정 class를 추가하지 말고 다음 순서로 범위를 좁힌다.

1. `<meta name="viewport">`가 있는지 확인한다.
2. Bootstrap CSS가 로드되었고 CDN URL·integrity 오류가 없는지 Network/Console에서 본다.
3. DOM이 `container → row → col` 구조인지 검사한다.
4. DevTools에서 현재 viewport의 CSS pixel width를 읽는다.
5. 해당 너비에서 유효해야 할 가장 큰 breakpoint class를 한 요소씩 계산한다.
6. Computed style에서 width, padding, margin과 적용된 media query를 확인한다.
7. offset이나 이전 breakpoint class가 큰 화면까지 상속되고 있지 않은지 본다.
8. 가로 overflow가 있다면 고정 `width`, 이미지 원본 폭, 임의 margin, 긴 unbreakable text를 찾는다.
9. navbar처럼 동작이 필요한 component는 bundle JavaScript와 `data-bs-target`/`id` 연결을 확인한다.

경계값 검사는 특히 중요하다. “태블릿에서 이상하다”처럼 기기 이름으로만 기록하지 말고 “767px에서는 1열, 768px에서 3열이 되며 제목이 두 줄을 넘어 버튼이 밀린다”처럼 재현 조건을 남기면 수정 방향이 명확해진다.

### 4.4 UX 관점의 완료 조건

화면이 깨지지 않는 것만으로 반응형 구현이 끝나지는 않는다. 다음 질문에 답할 수 있어야 한다.

- 확대하지 않아도 본문과 버튼 label을 읽을 수 있는가?
- touch 환경에서 인접한 링크를 잘못 누르지 않을 만큼 간격이 있는가?
- 메뉴가 접혀도 현재 위치와 핵심 기능을 찾을 수 있는가?
- 카드 열 수가 늘어날 때 정보 위계와 이미지 핵심 영역이 유지되는가?
- keyboard focus 순서가 보이는 순서와 자연스럽게 일치하는가?
- hover 없이도 상태와 행동 가능 여부를 이해할 수 있는가?
- 가로 스크롤 없이 320px 안팎의 좁은 viewport에서도 핵심 과업을 수행할 수 있는가?

희망 보행로 사례처럼 사용자가 실제로 택하는 경로를 관찰해야 한다. 분석 지표, 사용자 인터뷰, 사용성 테스트에서 메뉴를 찾지 못하거나 특정 breakpoint에서 이탈이 늘어난다면, Grid가 기술적으로 맞더라도 설계를 다시 검토해야 한다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

반응형 웹은 화면 크기에 맞춰 비율을 줄이는 작업이 아니라, 정보의 우선순위와 행동 흐름을 지키도록 배치를 다시 결정하는 UX 작업이다. 또한 Bootstrap class는 마법 같은 별도 문법이 아니라 12-column 비율, Flexbox, `min-width` media query를 조합한 약속임을 이해할 수 있다.

### 5.2 앞으로 이어지는 연결점

Grid와 semantic HTML을 함께 이해하면 이후 template/component 기반 프론트엔드에서도 같은 카드와 내비게이션을 재사용 가능한 단위로 설계할 수 있다. 디자인 시스템의 spacing·color·typography token과 Bootstrap utility를 연결하면 화면마다 임의 값을 반복하는 문제도 줄일 수 있다.

### 5.3 더 파볼 만한 주제

CSS Container Queries를 이용하면 viewport가 아니라 component가 놓인 부모 폭에 반응할 수 있다. 이미지의 `srcset`·`sizes`·`picture`, fluid typography의 `clamp()`, 접근성 contrast와 touch target, 실제 기기 성능을 포함한 responsive testing도 자연스럽게 이어지는 주제다.

---

## 6. 요약 정리

- 반응형 웹은 하나의 콘텐츠 구조를 여러 화면에서 사용할 수 있도록 크기, 배치, 노출 방식을 조정해 일관된 UX를 제공한다.
- UX는 사용자가 겪는 전체 경험이고, UI는 사용자와 서비스가 만나는 구체적인 접점이다. 반응형 UI는 여러 환경에서 UX를 지키기 위한 수단이다.
- meta viewport가 모바일의 CSS viewport를 올바르게 설정해야 media query와 Bootstrap breakpoint가 의도대로 동작한다.
- Bootstrap Grid는 `container → row → column` 구조와 12칸 규칙을 사용한다.
- nesting은 부모 column 내부에 새 12칸 문맥을 만들고, offset은 앞쪽 빈칸을 만들며, gutter는 column 콘텐츠 사이 간격을 만든다.
- Bootstrap 5.3의 breakpoint는 xs, sm(576), md(768), lg(992), xl(1200), xxl(1400)이며 `min-width` 기반 mobile-first로 누적 적용된다.
- `row-cols-*`는 행당 카드 수가 동일한 목록에, 개별 `col-*-*`는 항목별 비율을 세밀하게 다룰 때 적합하다.
- 페이지의 큰 뼈대는 Grid, 내부 정렬은 Flexbox, 의도적인 겹침은 position으로 해결한다.
- semantic source order를 먼저 세우고 시각적 순서를 보조해야 keyboard와 screen reader의 흐름이 깨지지 않는다.
- 반응형 디버깅은 breakpoint 바로 앞·정확한 값·바로 뒤에서 viewport, 적용 class, Computed style을 확인하는 방식으로 진행한다.

🧠 기억할 것: `col-md-6`은 “태블릿에서 6칸”이 아니라 **viewport가 768px 이상일 때 현재 row의 12칸 중 6칸을 차지하고, 더 큰 구간에서 덮어쓰지 않으면 계속 유지한다**는 뜻이다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. `col-12 col-md-6 col-lg-4`인 카드 네 개는 767px, 768px, 992px에서 각각 몇 열로 보이는가? 각 답을 12칸 계산으로 설명해 보자.
2. `offset-sm-4`를 적용한 요소가 `md`부터 왼쪽으로 돌아와야 한다면 어떤 class를 추가해야 하며, 왜 자동으로 초기화되지 않는가?
3. 내비게이션 토글 버튼은 보이지만 클릭해도 열리지 않는다. CSS 너비 문제와 JavaScript 연결 문제를 구분하기 위해 어떤 항목을 순서대로 확인할 것인가?
4. 카드 목록 전체에는 Grid를, 카드 내부 버튼 정렬에는 Flexbox를, 이미지 위 찜 아이콘에는 position을 쓰는 이유를 각 도구의 역할로 설명해 보자.
5. 다음 항목을 실제 DevTools에서 확인할 수 있는가?
   - 767px과 768px에서 내비게이션·카드·footer가 어떻게 바뀌는지 비교한다.
   - `.row`의 gutter와 `.col-*`의 padding을 box model에서 찾는다.
   - 이미지가 부모보다 넓어져 가로 스크롤을 만드는지 검사한다.
   - 보이는 순서와 keyboard focus 순서가 일치하는지 Tab 키로 확인한다.
