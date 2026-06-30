# Bootstrap: 유틸리티, 컴포넌트, Grid System과 시맨틱 웹

- 🎯 글의 목표: Bootstrap의 도입과 동작 원리를 이해하고, 유틸리티 클래스·컴포넌트·12열 Grid System으로 일관된 반응형 화면을 구성한다. 이어서 시맨틱 HTML과 OOCSS가 유지보수 가능한 마크업과 스타일에 어떤 기준을 주는지 연결한다.
- 🧩 핵심 키워드: Bootstrap 5.3, Framework, CDN, Reset CSS, Reboot, Utility Class, Spacing, Color, Display, Position, Flex, Component, Modal, Grid System, Container, Row, Column, Gutter, Semantic HTML, OOCSS
- ⭐ 중요도: 매우 높음
- 📝 한눈에 보는 내용: Bootstrap은 미리 정의된 CSS 규칙과 JavaScript 컴포넌트를 조합해 빠르게 화면을 만드는 프론트엔드 프레임워크다. 클래스 하나는 실제 CSS 선언을 생성하며, 여러 클래스를 조합하면 간격·색·배치·반응형 동작을 HTML에서 명시할 수 있다. 복잡한 페이지는 `container → row → column` 구조와 12열 모델로 나누고, 의미 있는 HTML 요소와 역할별 CSS를 사용해 구조와 표현을 분리한다.
- 🔗 관련 문제 / 주제: Bootstrap Class 활용, 로그인 폼과 카드, Modal, 반응형 레이아웃, 시맨틱 태그와 OOCSS

---

## 1. 들어가며

CSS를 직접 작성하면 원하는 디자인을 세밀하게 만들 수 있지만, 프로젝트마다 버튼·여백·색상·그리드·반응형 규칙을 처음부터 다시 정하는 일은 비효율적이다. 사람마다 같은 버튼을 다르게 만들면 화면의 일관성도 빠르게 무너진다. Bootstrap은 이 반복되는 문제를 해결하기 위해 검증된 CSS와 JavaScript, 컴포넌트의 사용 규칙을 미리 제공한다.

Bootstrap을 배운다는 것은 클래스 이름을 많이 외우는 일이 아니다. `mt-5`가 위쪽 외부 여백을 만들고, `d-flex`가 자식의 배치 방식을 바꾸며, `col-6`이 행 너비의 절반을 차지하게 하는 것처럼 **클래스가 어떤 CSS를 만들고 그 결과 브라우저의 레이아웃 계산이 어떻게 달라지는지** 이해하는 일이다.

이 강의는 Bootstrap을 HTML에 연결하는 단계에서 시작한다. 그 뒤 브라우저 기본 스타일을 정돈하는 Reset CSS, 조합 가능한 유틸리티 클래스, 재사용 가능한 컴포넌트를 살펴본다. Grid System으로 페이지의 큰 구조를 세운 다음, 시맨틱 HTML과 OOCSS를 통해 “화면이 보이는가”를 넘어 “의미가 있고 유지보수할 수 있는가”까지 확장한다.

> 버전 기준: 강의 슬라이드의 설치 예시는 Bootstrap **5.3.3**을 사용한다. 실습 파일에는 5.3.1과 5.3.8 CDN도 섞여 있다. 한 문서에서는 CSS와 JS의 Bootstrap 버전을 반드시 맞추고, 실제 프로젝트에 사용할 CDN 코드는 해당 버전 공식 문서에서 함께 복사한다.

---

## 2. 핵심 개념 정리

이번 강의가 해결하려는 질문은 다음과 같다.

> 이미 만들어진 디자인 규칙을 이용하면서도 화면의 구조, 반응형 배치, 동작, 의미를 잃지 않으려면 어떻게 해야 할까?

본문은 다음 흐름으로 답을 찾아간다.

1. **Bootstrap 도입과 Reset CSS**: 프레임워크와 CDN의 역할을 이해하고, Bootstrap을 연결했을 때 기본 화면이 달라지는 이유를 확인한다.
2. **유틸리티 조합**: 간격, 글자, 색, 테두리, 표시 방식, 위치, Flex를 작은 단위의 클래스로 조합한다.
3. **컴포넌트 활용**: 카드·폼·Carousel·Modal처럼 구조와 동작이 약속된 UI를 가져와 내용과 스타일을 목적에 맞게 수정한다.
4. **Grid System**: 컨테이너 안에 행과 열을 만들고 12열 모델, 중첩, offset, gutter로 페이지 구조를 설계한다.
5. **Semantic Web과 OOCSS**: HTML에는 콘텐츠의 의미를, CSS에는 레이아웃과 디자인을 맡기고 재사용 가능한 스타일 구조를 만든다.

---

## 3. 본문 정리

### 3.1 Bootstrap과 프레임워크

프레임워크는 소프트웨어 개발에서 반복되는 기능과 정해진 구조를 미리 제공하는 “반제품” 개발 환경이다. Bootstrap은 HTML, CSS, JavaScript로 웹 화면을 만드는 **프론트엔드 프레임워크이자 툴킷**이다. 모바일·태블릿·데스크톱처럼 화면 크기가 달라져도 적절히 배치되는 반응형 웹을 지원한다.

Bootstrap이 제공하는 것은 크게 세 층으로 볼 수 있다.

| 층 | 제공 내용 | 사용하는 방식 |
|---|---|---|
| 기본 스타일 | 글꼴, 박스 모델, 요소 기본값 정돈 | CSS를 연결하면 문서 전체에 반영된다. |
| 유틸리티 | 간격, 색, display, flex 등 단일 목적 규칙 | 요소의 `class`에 필요한 규칙을 조합한다. |
| 컴포넌트 | 버튼, 카드, 폼, Navbar, Modal 등 | 정해진 HTML 구조와 클래스를 가져와 수정한다. |

따라서 Bootstrap은 완성된 웹사이트를 대신 만들어 주지 않는다. 공통 규칙을 제공해 개발 속도와 일관성을 높이고, 개발자는 콘텐츠와 정보 구조, 필요한 커스터마이징을 결정한다. 빠른 개발, 쉬운 반응형 구현, 주요 브라우저 지원, 반복 UI의 유지보수가 장점이다.

### 3.2 CDN으로 Bootstrap 연결하기

CDN(Content Delivery Network)은 원본 파일을 세계 여러 지역의 **엣지 서버**에 복제해 두고 사용자와 가까운 서버에서 전달하는 방식이다. 한국 사용자가 멀리 있는 오리진 서버까지 매번 요청하지 않아도 되므로 이동 거리가 짧아지고, 트래픽이 분산되며, 일부 서버 장애에도 다른 경로를 사용할 수 있다.

Bootstrap CDN은 Bootstrap의 CSS와 JavaScript 파일을 직접 보관하지 않고 온라인 주소로 불러오는 방식이다. 강의의 5.3.3 기준 최소 문서는 다음과 같다.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <!-- 모바일 화면을 실제 기기 너비로 계산하게 한다. -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bootstrap 시작</title>

  <!-- 레이아웃, 유틸리티, 컴포넌트의 시각 스타일을 먼저 불러온다. -->
  <link
    href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
    rel="stylesheet"
  >
</head>
<body>
  <button class="btn btn-primary">확인</button>

  <!-- body 끝에서 JS를 불러오면 HTML을 읽은 뒤 동작을 준비한다. -->
  <!-- bundle에는 Dropdown, Tooltip 등에 필요한 Popper도 포함된다. -->
  <script
    src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
  ></script>
</body>
</html>
```

CSS가 빠지면 클래스는 적혀 있어도 화면 모양이 바뀌지 않는다. JS가 빠지면 버튼 색이나 간격 같은 CSS 기능은 보이지만 Modal, Carousel처럼 상태를 바꾸는 컴포넌트는 동작하지 않는다. `viewport`가 빠지면 모바일 브라우저가 넓은 가상 화면을 축소해 보여 반응형 분기점이 예상과 다르게 느껴질 수 있다.

실제 배포에서는 공식 문서가 제공하는 `integrity`와 `crossorigin` 속성까지 그대로 복사하는 편이 안전하다. SRI(Subresource Integrity)는 내려받은 외부 파일이 지정된 해시와 일치하는지 브라우저가 검사하도록 한다.

⚠️ 주의: 실습 자료처럼 CSS는 5.3.8, JS는 5.3.1을 연결하면 버전별 마크업이나 동작 차이로 디버깅이 어려워진다. 같은 페이지의 CSS와 JS는 같은 버전으로 맞춘다.

### 3.3 CDN 없이 로컬 파일로 사용하기

네트워크가 제한된 환경, 외부 CDN 정책을 허용하지 않는 서비스, 버전을 완전히 고정해야 하는 프로젝트에서는 컴파일된 파일을 내려받아 로컬에서 제공할 수 있다. 강의에서는 `bootstrap.css`와 `bootstrap.bundle.js`를 선택하고 다음처럼 배치한다.

```text
project/
├─ index.html
├─ css/
│  └─ bootstrap.css
└─ js/
   └─ bootstrap.bundle.js
```

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="css/bootstrap.css">
</head>
<body>
  <!-- 페이지 콘텐츠 -->
  <script src="js/bootstrap.bundle.js"></script>
</body>
```

상대 경로는 `index.html`의 위치를 기준으로 해석된다. 개발자 도구의 Network 탭에서 404가 발생한다면 폴더명과 파일명을 먼저 확인한다. `bootstrap.min.css`는 공백과 주석을 줄인 배포용 파일이고, 비압축 파일은 소스를 읽고 디버깅하기 편하다. 파일마다 포함 기능이 다르므로 필요한 조합은 해당 버전 공식 문서의 Contents 항목에서 확인해야 한다.

### 3.4 Reset CSS와 Bootstrap Reboot

HTML에 아무 CSS도 쓰지 않아도 `h1`은 크고 굵게, `ul`에는 불릿과 들여쓰기가 표시된다. 이는 브라우저가 가진 **user agent stylesheet** 때문이다. CSS 로딩에 실패해도 문서 구조와 최소한의 가독성을 전달하는 안전장치이지만, 브라우저마다 세부 기본값이 달라 동일한 디자인의 출발점으로는 불안정하다.

Reset CSS는 요소의 기본 스타일을 일관된 기준으로 다시 설정하는 규칙 모음이다. 모든 값을 무조건 0으로 지우는 방식도 있지만, Normalize CSS는 웹 표준과 유용한 기본값을 보존하면서 브라우저 차이를 교정한다. Bootstrap은 이를 바탕으로 자체 조정한 **Reboot**를 사용한다.

Bootstrap CSS를 연결한 직후 `body`의 기본 여백이 사라지거나 제목 글꼴과 줄 높이가 달라지는 것은 오류가 아니라 Reboot의 결과다. 즉 Bootstrap은 클래스가 붙은 요소만 바꾸는 것이 아니라 문서의 공통 출발점도 바꾼다.

⚠️ 주의: “클래스를 아직 안 썼는데 왜 모양이 달라졌지?”라는 의문이 들면 개발자 도구의 Styles 탭에서 `bootstrap-reboot.css` 계열 규칙과 user agent stylesheet를 비교한다. 브라우저 기본값에 기대어 만든 기존 페이지에 Bootstrap을 뒤늦게 연결하면 여백과 타이포그래피가 달라질 수 있다.

### 3.5 유틸리티 클래스: 작은 규칙을 조합해 결과 만들기

Bootstrap의 유틸리티는 한 가지 목적에 집중한 클래스다. `mt-3`은 위쪽 margin, `text-center`는 글자 정렬, `d-flex`는 `display: flex`를 담당한다. HTML에 여러 클래스를 조합하면 별도 CSS 선택자를 만들지 않고도 결과를 빠르게 구성할 수 있다.

```html
<section class="p-4 border rounded bg-light text-center">
  내용
</section>
```

브라우저에서는 대략 “안쪽 여백 추가 → 테두리 표시 → 모서리 둥글게 → 밝은 배경 → 인라인 콘텐츠 가운데 정렬”이라는 선언들이 동시에 적용된다. 클래스 순서가 실행 순서를 뜻하는 것은 아니다. 최종 결과는 Bootstrap 스타일시트의 선언 순서, 선택자 우선순위, `!important` 여부에 의해 결정된다.

강의에서는 이러한 조합 중심 사용법을 강조한다. 다만 Bootstrap 전체를 Tailwind CSS 같은 순수 utility-first 프레임워크로만 보기는 어렵다. Bootstrap은 유틸리티와 함께 구조가 정해진 컴포넌트, Grid System도 제공하는 혼합형 툴킷이다.

#### 간격: `{property}{sides}-{size}`

Spacing 클래스는 margin 또는 padding의 방향과 크기를 압축해 표현한다.

| 구간 | 값 | 생성되는 의미 |
|---|---|---|
| property | `m`, `p` | margin, padding |
| sides | `t`, `b`, `s`, `e`, `x`, `y`, 생략 | top, bottom, start, end, 좌우, 상하, 네 방향 |
| size | `0`~`5`, `auto` | 0부터 Bootstrap spacing scale까지, 또는 자동 margin |

Bootstrap 5는 물리 방향인 left/right보다 논리 방향인 start/end를 사용한다. LTR 문서에서 `s`는 왼쪽, `e`는 오른쪽이고 RTL 문서에서는 반대로 작동한다.

| size | 상대값 | 기본 16px 기준 결과 |
|---|---:|---:|
| `0` | `0` | 0px |
| `1` | `0.25rem` | 4px |
| `2` | `0.5rem` | 8px |
| `3` | `1rem` | 16px |
| `4` | `1.5rem` | 24px |
| `5` | `3rem` | 48px |

`rem`은 루트 요소의 글자 크기를 기준으로 하는 상대 단위다. 사용자가 기본 글자 크기를 조절하면 간격도 함께 비례할 수 있다.

```html
<!-- 위쪽 바깥 여백 3rem: 앞 요소와 48px가량 떨어진다. -->
<p class="mt-5">Hello, world!</p>

<!-- 상하 안쪽 여백 0.5rem, 좌우 안쪽 여백 1.5rem -->
<button class="py-2 px-4">저장</button>

<!-- 블록 너비가 남을 때 좌우 auto margin이 공간을 나누어 가운데 정렬한다. -->
<div class="w-50 mx-auto">가운데 상자</div>
```

margin은 요소 border 바깥의 다른 요소와의 간격이고, padding은 border와 콘텐츠 사이의 안쪽 여백이다. `mx-auto`는 요소 자체의 너비가 부모보다 작아 남는 가로 공간이 있어야 눈에 보이는 가운데 정렬 효과가 생긴다.

⚠️ 주의: `auto`는 margin에만 제공된다. `p-auto`는 없다. 또한 `m-3`과 `mt-5`처럼 같은 면을 동시에 지정하면 단순히 class 속성에서 뒤에 쓴 것이 이긴다고 가정하지 말고, 개발자 도구의 computed style로 최종값을 확인한다.

#### Typography

Bootstrap의 타이포그래피는 제목, 본문, 인라인 의미 요소, 목록을 일관되게 보이게 한다. `display-1`부터 `display-6`까지는 일반 heading보다 더 크고 강한 시각적 제목을 만들 때 사용한다.

```html
<h1 class="display-3">서비스 소개</h1>

<p>검색어는 <mark>Bootstrap</mark>입니다.</p>
<p><del>삭제된 정책</del></p>
<p><ins>추가된 정책</ins></p>
<p><small>부가 설명</small></p>
<p><strong>강한 중요성</strong>, <em>강조</em></p>

<ul class="list-unstyled">
  <li>바깥 목록의 불릿과 왼쪽 padding이 제거된다.</li>
  <li>
    중첩 목록
    <ul><li>중첩 목록은 자체 기본 모양을 유지한다.</li></ul>
  </li>
</ul>
```

`display-*`는 모양을 정하는 클래스일 뿐 문서의 제목 단계가 아니다. 페이지 최상위 제목이라면 의미상 적절한 `h1`을 사용하고 그 위에 `display-*`를 더한다. `p`를 크게 꾸며 제목처럼 보이게 하는 것은 시각적 결과만 만들 뿐 문서 구조를 전달하지 못한다.

#### 색상과 테두리

Bootstrap은 `blue`, `red` 같은 실제 색 이름보다 `primary`, `success`, `danger`, `warning`, `info`, `light`, `dark`처럼 **역할을 나타내는 키워드**를 제공한다. 디자인 테마가 바뀌어 primary의 실제 색이 달라져도 “주요 행동”이라는 의미는 유지된다.

```html
<p class="text-primary">주요 안내</p>
<p class="text-danger-emphasis">강조된 오류 안내</p>

<div class="p-3 bg-success text-white">처리 성공</div>
<div class="p-3 bg-danger-subtle text-danger-emphasis">확인이 필요한 오류</div>

<div class="border border-2 border-dark rounded p-3">테두리 상자</div>
```

`*-subtle` 배경과 `*-emphasis` 텍스트는 같은 테마 계열 안에서 부드러운 배경과 읽기 쉬운 전경색을 짝지을 때 유용하다. 단, 의미 색상을 썼다는 사실만으로 접근성이 완성되지는 않는다. 성공/실패를 색만으로 전달하지 말고 텍스트나 아이콘을 함께 제공하고 대비를 확인한다.

강의의 “Bootstrap만으로 박스 그리기” 예시는 Bootstrap이 제공하지 않는 고정 너비와 높이만 사용자 CSS로 두고, 나머지를 유틸리티로 조합한다.

```html
<style>
  /* 프로젝트 요구에만 있는 크기는 사용자 CSS로 보완한다. */
  .box {
    width: 200px;
    height: 200px;
  }
</style>

<!-- 테두리 2px, 어두운 테두리색, info 배경, 흰 글자, 네 방향 margin -->
<div class="box border border-2 border-dark bg-info text-white m-3">
  Box
</div>
```

#### Display와 반응형 표시

Display 유틸리티는 요소의 `display` 값을 바꾼다. `d-none`은 레이아웃에서 요소를 제거하고, `d-block`, `d-inline`, `d-inline-block`, `d-flex`, `d-grid`는 각각 해당 display 방식을 만든다.

```html
<!-- lg(992px) 미만에서는 display:none, lg 이상에서는 block -->
<h1 class="d-none d-lg-block">큰 화면에서만 보이는 제목</h1>
```

Bootstrap의 반응형 유틸리티는 대체로 **mobile first**다. 접두사 없는 `d-none`이 모든 너비에 먼저 적용되고, `d-lg-block`이 `lg` 이상에서 그 값을 덮어쓴다. 따라서 위 요소는 작은 화면에서 숨고 큰 화면에서 나타난다. 숨김은 단순히 투명하게 만드는 것이 아니라 레이아웃 공간도 차지하지 않게 한다.

#### Position

Position 유틸리티는 `position-static`, `position-relative`, `position-absolute`, `position-fixed`, `position-sticky`를 제공하며, `top-0`, `start-0`, `end-0`, `bottom-0`으로 기준 변에서의 위치를 정한다. transform 유틸리티를 더하면 요소 자신의 크기를 기준으로 보정할 수 있다.

```html
<div class="position-relative border" style="height: 160px;">
  <!-- 가장 가까운 positioned 조상인 바깥 div를 기준으로 우상단에 배치된다. -->
  <span class="position-absolute top-0 end-0 badge text-bg-danger">
    NEW
  </span>

  <!-- 부모의 50% 지점에서 자신의 절반만큼 되돌아가 정확히 중앙에 놓인다. -->
  <button class="position-absolute top-50 start-50 translate-middle btn btn-primary">
    중앙
  </button>
</div>
```

`position-absolute`의 기준은 보통 가장 가까운 `position` 지정 조상이다. 부모에 `position-relative`가 없으면 예상과 달리 더 바깥 조상이나 초기 containing block을 기준으로 움직일 수 있다. `fixed`는 viewport를 기준으로 고정되며, `sticky`는 지정한 임계 위치에 도달한 뒤 스크롤 컨테이너 안에서 붙는다.

#### Flex

`d-flex`를 적용하면 요소가 flex container가 되고 **직접 자식**이 flex item이 된다. 이후 정렬 유틸리티는 주축과 교차축에 작용한다.

```html
<nav class="d-flex justify-content-between align-items-center gap-3 p-3">
  <strong>Brand</strong>
  <div class="d-flex gap-2">
    <a href="#">로그인</a>
    <a href="#">회원가입</a>
  </div>
</nav>
```

기본 `flex-row`에서는 주축이 가로이므로 `justify-content-between`은 첫 항목과 마지막 항목을 양끝에 두고 남는 공간을 사이에 배분한다. 교차축은 세로이므로 `align-items-center`가 자식들을 세로 중앙에 맞춘다. `gap-3`은 항목 사이에만 일정한 간격을 만들기 때문에 각 자식에 margin을 반복하는 것보다 구조가 명확하다.

주요 동작은 다음처럼 결과를 중심으로 이해하면 된다.

- `flex-column`: 주축을 세로로 바꾼다. 이때 justify는 세로, align은 가로에 작용한다.
- `flex-wrap`: 한 줄에 공간이 부족하면 자식을 다음 줄로 보낸다.
- `flex-grow-1`: 같은 줄의 남는 주축 공간을 해당 항목이 확장해 차지한다.
- `ms-auto`: 가로 flex에서 start 쪽 자동 margin이 남는 공간을 흡수해 항목을 끝쪽으로 민다.
- `order-*`: 보이는 순서를 바꾸지만 DOM과 읽기 순서는 그대로다.

⚠️ 주의: `align-items-center`가 동작하지 않는다고 느껴지면 교차축에 실제 남는 공간이 있는지 확인한다. 높이가 콘텐츠만큼뿐인 컨테이너에서는 세로 중앙 이동이 눈에 보이지 않는다. 또한 시각적 `order`로 논리 순서를 뒤섞으면 키보드 탐색과 스크린 리더 순서가 화면과 달라질 수 있다.

### 3.6 컴포넌트: 구조와 동작이 묶인 재사용 단위

컴포넌트는 더 큰 화면을 조립하기 위한 재사용 가능한 독립 UI 단위다. 웹에서는 특정 부분에 필요한 HTML, CSS, 때로는 JavaScript가 함께 약속된다. Alert, Badge, Card, Navbar, Carousel, Modal이 대표적이다.

유틸리티는 대체로 한 가지 CSS 결과를 만들지만, 컴포넌트 클래스는 정해진 내부 구조를 전제로 한다. 예를 들어 Card는 `card` 안에 `card-header`, `card-body` 같은 하위 요소가 있고, Modal은 여러 겹의 wrapper가 크기·정렬·배경·애니메이션을 나누어 담당한다. 공식 예제를 가져온 뒤 텍스트, 의미 요소, 색상 variant와 필요한 유틸리티를 수정하는 것이 안전하다.

#### 폼에서 카드까지: 실습 흐름

첫 실습은 Bootstrap 폼 클래스가 label과 input의 너비, 글꼴, 테두리, focus 상태를 일관되게 만드는 모습을 보여준다.

```html
<div class="container py-5">
  <form>
    <div class="mb-3">
      <label for="email" class="form-label">Email address</label>
      <input
        type="email"
        class="form-control"
        id="email"
        placeholder="name@example.com"
      >
    </div>

    <div class="mb-3">
      <label for="password" class="form-label">Password</label>
      <input
        type="password"
        class="form-control"
        id="password"
        aria-describedby="passwordHelp"
      >
      <div id="passwordHelp" class="form-text">
        8자 이상이며 영문, 숫자, 특수문자를 사용하세요.
      </div>
    </div>
  </form>
</div>
```

`label[for]`와 input의 `id`가 연결되어 label을 클릭해도 입력 칸에 focus된다. `aria-describedby`는 입력과 도움말의 `id`를 연결해 보조 기술이 설명을 함께 전달하도록 한다. 클래스는 시각적 스타일을, HTML 속성은 의미와 관계를 담당한다.

다음 실습은 같은 폼을 Card에 넣는다. `w-50`은 부모 너비의 50%를 만들고 `mx-auto`는 남은 좌우 공간을 나눠 Card를 가운데 둔다. `text-center`는 상자 자체가 아니라 상자 내부의 인라인 콘텐츠와 텍스트 정렬을 가운데로 바꾼다.

```html
<div class="container py-5">
  <section class="card text-center w-50 mx-auto">
    <div class="card-header">로그인</div>
    <div class="card-body">
      <h2 class="card-title">로그인</h2>
      <!-- 이 자리에 위 폼의 입력 구조가 들어간다. -->
    </div>
  </section>
</div>
```

⚠️ 주의: 실습 중간 파일의 Card에는 `w-50`만 있어 왼쪽에 붙는다. 가운데 배치하려면 `mx-auto` 같은 별도 정렬 규칙이 필요하다. 또한 모바일에서도 항상 50%이면 입력 칸이 지나치게 좁을 수 있다. `col-12 col-md-6` 또는 `w-100`과 반응형 Grid를 사용하면 작은 화면은 넓게, 큰 화면은 절반으로 만들 수 있다.

#### Carousel과 Modal의 JavaScript 연결

Carousel은 이미지나 텍스트를 순환해 보여주는 slideshow 컴포넌트다. `.carousel-item.active`가 최초 표시 항목이고, 이전/다음 버튼의 `data-bs-target`은 제어할 Carousel의 `id`를 가리킨다. 버튼을 누르면 Bootstrap JS가 현재 항목의 상태 클래스를 바꾸고 전환 효과를 실행한다.

Modal은 현재 화면 위에 대화 상자를 띄우고 배경과의 상호작용을 일시적으로 제한해 즉각적인 확인이나 입력을 요구한다.

```html
<!-- data 속성이 JS에게 어떤 Modal을 열지 알려 준다. -->
<button
  type="button"
  class="btn btn-primary"
  data-bs-toggle="modal"
  data-bs-target="#loginModal"
>
  로그인
</button>

<div
  class="modal fade"
  id="loginModal"
  tabindex="-1"
  aria-labelledby="loginModalLabel"
  aria-hidden="true"
>
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title fs-5" id="loginModalLabel">로그인</h2>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="modal"
          aria-label="닫기"
        ></button>
      </div>
      <div class="modal-body">
        <!-- 로그인 form을 배치한다. -->
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
        <button type="submit" class="btn btn-primary">로그인</button>
      </div>
    </div>
  </div>
</div>
```

브라우저가 `data-bs-toggle="modal"`을 보고 스스로 동작하는 것은 아니다. Bootstrap JS가 click을 감지하고, `data-bs-target="#loginModal"`과 일치하는 요소를 찾아 표시 상태, backdrop, focus, ARIA 상태를 관리한다. `fade`는 필수 동작이 아니라 전환 효과를 추가한다.

⚠️ 주의: 컴포넌트가 보이지만 열리지 않으면 다음 순서로 확인한다.

1. `bootstrap.bundle.js`가 실제로 로드되었는지 Network와 Console에서 확인한다.
2. 속성명이 Bootstrap 5 형식인 `data-bs-*`인지 확인한다.
3. 버튼의 `data-bs-target="#loginModal"`과 Modal의 `id="loginModal"`이 `#`을 제외하고 정확히 같은지 확인한다.
4. 같은 `id`가 문서에 중복되지 않았는지 확인한다.
5. 폼 제출 버튼 때문에 페이지가 즉시 새로고침되는 것은 아닌지 확인한다.

컴포넌트의 장점은 재사용성, 독립성, 유지보수성이다. 로그인 UI를 한 단위로 관리하면 여러 페이지에서 같은 규칙을 재사용하고, 수정 범위를 해당 컴포넌트로 좁힐 수 있다. 다만 복사한 마크업을 여러 파일에 그대로 중복하면 진정한 재사용은 아니다. 이후 템플릿 엔진이나 Vue 같은 컴포넌트 시스템으로 연결될 때 이 개념이 실제 코드 재사용으로 확장된다.

#### 컴포넌트 커스터마이징

커스터마이징은 공식 구조를 무작정 해체하는 것이 아니라 안정적인 기본 구조 위에 의도를 추가하는 작업이다.

```html
<article class="card shadow-sm border-0 custom-login-card">
  <div class="card-body p-4">...</div>
</article>
```

```css
/* Bootstrap 뒤에 로드해 프로젝트 고유 요구만 좁게 보완한다. */
.custom-login-card {
  max-width: 32rem;
}
```

먼저 variant와 spacing, sizing, shadow 같은 Bootstrap 유틸리티로 해결하고, 표현할 수 없는 프로젝트 고유 값만 별도 클래스에 둔다. Sass 빌드 환경에서는 변수와 maps를 수정해 색상·간격·컴포넌트 기본값을 체계적으로 바꿀 수 있지만, CDN 사용 단계에서는 사용자 CSS를 Bootstrap 뒤에 연결하는 방식이 가장 직접적이다.

### 3.7 Grid System: 페이지의 큰 구조 만들기

Grid System은 화면의 가로 공간을 행과 열로 나눠 반응형 레이아웃을 만드는 규칙이다. 기본 구조는 반드시 다음 순서를 따른다.

```text
container
└─ row
   ├─ column
   ├─ column
   └─ column
```

```html
<div class="container">
  <div class="row">
    <main class="col-8">본문</main>
    <aside class="col-4">사이드바</aside>
  </div>
</div>
```

- **container**는 콘텐츠의 전체 가로 범위와 좌우 padding을 관리한다.
- **row**는 열을 한 줄로 묶는 flex container이며 gutter 계산을 위한 음수 margin을 가진다.
- **column**은 실제 콘텐츠 영역이다. row의 직접 자식으로 놓이고 gutter의 절반만큼 좌우 padding을 받아 열 사이 간격을 만든다.

`col`을 container 바로 아래에 두거나, 콘텐츠를 row 바로 아래에 column 없이 두면 gutter와 너비 계산의 전제가 깨진다.

#### Container의 종류

`container`는 breakpoint마다 최대 너비가 단계적으로 정해지고 화면 가운데에 놓인다. 큰 모니터에서 콘텐츠가 끝없이 늘어나는 것을 막아 읽기 편한 폭을 유지한다. `container-fluid`는 모든 화면에서 거의 전체 너비를 사용한다. `container-md` 같은 반응형 container는 지정 breakpoint 전까지는 유동 폭이고 그 이상에서 max-width가 적용된다.

#### 12열 모델과 자동 열

한 row의 가로 폭을 개념적으로 12칸으로 나눈다. `col-6`은 6/12, 즉 50%이고 `col-4`는 4/12, 약 33.33%다.

```html
<div class="container">
  <div class="row">
    <div class="col-4">4/12</div>
    <div class="col-8">8/12</div>
  </div>

  <div class="row mt-3">
    <!-- 숫자가 없는 col은 남는 폭을 같은 비율로 나눈다. -->
    <div class="col">1/3</div>
    <div class="col">1/3</div>
    <div class="col">1/3</div>
  </div>
</div>
```

열 합이 12보다 작으면 오른쪽에 공간이 남는다. 한 줄에서 합이 12를 넘으면 flex wrapping에 의해 다음 열이 다음 줄로 내려간다. 숫자 없는 `.col`은 같은 행의 자동 열끼리 남는 공간을 균등 분배한다.

#### Breakpoint와 mobile-first 열

접두사 없는 `.col-12`는 모든 화면의 기본값이다. `.col-md-6`은 `md` 이상에서만 6칸으로 덮어쓴다.

```html
<div class="row">
  <div class="col-12 col-md-6 col-lg-4">카드 1</div>
  <div class="col-12 col-md-6 col-lg-4">카드 2</div>
  <div class="col-12 col-md-6 col-lg-4">카드 3</div>
</div>
```

이 코드는 작은 화면에서 카드 하나가 한 줄 전체를 차지한다. `md` 이상에서는 각 카드가 절반이므로 한 줄에 두 개가 놓이고 세 번째는 다음 줄로 간다. `lg` 이상에서는 각 카드가 4/12가 되어 세 개가 한 줄에 놓인다. 반응형 클래스는 “기기 이름”보다 **해당 최소 너비부터 어떤 규칙으로 바뀌는가**로 이해하는 편이 정확하다.

Bootstrap 5.3의 기본 breakpoint는 `sm 576px`, `md 768px`, `lg 992px`, `xl 1200px`, `xxl 1400px`부터 시작하며, 접두사 없는 규칙은 그보다 작은 영역을 포함한 전체 기본값이다.

#### Nesting

열 내부를 다시 Grid로 나누려면 기존 column 안에 새로운 `row`를 만들고 그 안에 column을 둔다.

```html
<div class="row">
  <div class="col-md-8">
    바깥 열 8칸

    <div class="row mt-3">
      <div class="col-6">안쪽 행의 6/12</div>
      <div class="col-6">안쪽 행의 6/12</div>
    </div>
  </div>
  <div class="col-md-4">바깥 열 4칸</div>
</div>
```

안쪽 `col-6`의 기준은 페이지 전체 12칸이 아니라 **부모 `col-md-8` 안에 새로 만들어진 row의 12칸**이다. 따라서 각각 부모 열 너비의 절반을 차지한다.

#### Offset

Offset은 열 앞에 빈 칸을 확보해 열을 오른쪽으로 민다.

```html
<div class="row">
  <!-- md 이상에서 앞 3칸을 비우고 6칸을 사용하므로 가운데에 놓인다. -->
  <div class="col-12 col-md-6 offset-md-3">로그인 폼</div>
</div>
```

작은 화면에서는 `col-12`가 전체 폭을 쓰고 offset이 없다. `md` 이상에서 왼쪽 3/12 + 콘텐츠 6/12 + 오른쪽 3/12가 되어 가운데 배치된다. 특정 breakpoint 이후 offset을 제거하려면 `offset-lg-0`처럼 다음 규칙을 명시한다.

#### Gutters

Gutter는 열 콘텐츠 사이의 간격이다. Bootstrap은 row의 음수 margin과 각 column의 좌우 padding을 함께 사용해 바깥 정렬은 유지하면서 열 사이 공간을 만든다.

```html
<div class="row gx-4 gy-3">
  <div class="col-12 col-md-6"><div class="p-3 border">A</div></div>
  <div class="col-12 col-md-6"><div class="p-3 border">B</div></div>
</div>
```

`gx-4`는 가로 gutter, `gy-3`은 줄 사이 세로 gutter를 조절한다. `g-0`은 둘 다 제거한다. 배경이나 border를 column 자체에 칠하면 padding까지 같은 색이 되어 간격이 사라진 것처럼 보일 수 있으므로, 위 예시처럼 column 안쪽 요소에 시각 스타일을 주면 gutter 구조가 잘 드러난다.

⚠️ 주의: Grid가 어긋날 때는 숫자 합만 보지 말고 DOM 계층을 먼저 확인한다. `container > row > col`인지, 중첩 시 column 안에 새 row가 있는지, 고정 `width`가 column의 계산 너비와 충돌하지 않는지, 이미지에 `img-fluid`가 없어 열 밖으로 넘치지 않는지 순서대로 검사한다.

### 3.8 Semantic Web: 보이는 모양보다 목적과 역할

Semantic Web은 웹 데이터를 의미적으로 구조화된 형태로 표현하는 관점이다. HTML에서 시맨틱하다는 것은 요소의 외형이 아니라 콘텐츠의 목적과 역할에 맞는 요소를 선택하는 것이다.

```html
<!-- 큰 글자처럼 보이지만 제목이라는 의미는 없다. -->
<p style="font-size: 30px;">Heading</p>

<!-- 페이지의 최상위 제목이라는 구조적 의미를 전달한다. -->
<h1>Heading</h1>
```

둘은 CSS로 같은 모양을 만들 수 있지만 브라우저, 검색 엔진, 스크린 리더, 개발자가 이해하는 문서 구조는 다르다. 시맨틱 요소도 기본 렌더링만 보면 `div`와 비슷한 block일 수 있다. 차이는 외형이 아니라 이름에 담긴 의미다.

```html
<header>
  <h1>개발 노트</h1>
</header>

<nav aria-label="주요 메뉴">
  <ul>
    <li><a href="/">홈</a></li>
  </ul>
</nav>

<main>
  <article>
    <h2>Bootstrap Grid 이해하기</h2>
    <p>독립적으로 읽고 배포할 수 있는 글입니다.</p>
  </article>

  <aside>
    <h2>관련 글</h2>
    <a href="#">Flex 복습</a>
  </aside>
</main>

<footer>
  <p>&copy; All rights reserved.</p>
</footer>
```

| 요소 | 의미와 사용 기준 |
|---|---|
| `header` | 페이지나 구획의 소개, 제목, 탐색 보조 콘텐츠 |
| `nav` | 현재 페이지 또는 다른 페이지로 가는 주요 링크 구획 |
| `main` | 문서의 핵심 콘텐츠. 일반적으로 페이지에 하나의 주된 `main`을 둔다. |
| `article` | 글·게시물처럼 독립적으로 구분하고 배포할 수 있는 콘텐츠 |
| `section` | 주제별 독립 구획. 더 구체적인 요소가 없을 때 사용하며 보통 제목을 가진다. |
| `aside` | 본문과 간접적으로 관련된 보조 콘텐츠 |
| `footer` | 가장 가까운 구획의 작성자, 저작권, 관련 문서 정보 |

의미론적 마크업은 검색 엔진이 콘텐츠 구조를 분석하는 SEO에 도움을 주며, 스크린 리더 사용자가 landmark와 제목 구조로 페이지를 탐색할 수 있게 해 접근성을 높인다. 다만 시맨틱 태그 하나가 검색 순위나 접근성을 자동 보장하는 것은 아니다. 올바른 제목 단계, label, 키보드 조작, 대체 텍스트, 색 대비 등이 함께 필요하다.

📌 핵심: HTML은 콘텐츠의 **구조와 의미**, CSS는 **레이아웃과 디자인**을 담당한다. Bootstrap class를 많이 붙여도 기본 HTML 요소의 의미를 먼저 올바르게 선택해야 한다.

### 3.9 Semantic in CSS와 OOCSS

CSS 방법론은 CSS를 효율적이고 유지보수하기 쉽게 작성하기 위한 가이드다. OOCSS(Object-Oriented CSS)는 반복 가능한 시각 패턴을 객체처럼 분리하는 접근이며, 강의에서는 두 원칙을 다룬다.

#### 구조와 스킨 분리

버튼의 크기·padding·border 같은 공통 구조와 배경색 같은 스킨을 분리한다.

```css
/* 공통 구조: 모든 버튼이 공유한다. */
.btn-base {
  display: inline-block;
  border: 0;
  border-radius: 4px;
  padding: 10px 20px;
  font-size: 1rem;
  cursor: pointer;
}

/* 스킨: 달라지는 시각 속성만 둔다. */
.btn-blue {
  background-color: #007bff;
  color: #fff;
}

.btn-red {
  background-color: #cb2323;
  color: #fff;
}
```

```html
<button class="btn-base btn-blue">저장</button>
<button class="btn-base btn-red">삭제</button>
```

새 색상의 버튼을 추가할 때 padding과 font-size를 반복하지 않고 스킨만 추가한다. Bootstrap의 `btn btn-primary`도 이와 비슷하게 기본 구조와 variant를 조합한다.

#### 컨테이너와 콘텐츠 분리

콘텐츠의 고유 모양을 “어디에 놓였는가”에 지나치게 의존시키지 않는다. 다음 변경 전 코드는 header와 footer의 제목 크기를 각각 중복한다.

```css
/* 변경 전: 위치와 콘텐츠 스타일이 섞이고 크기가 중복된다. */
.header h2 { font-size: 24px; color: white; }
.footer h2 { font-size: 24px; color: black; }
```

역할을 나누면 제목 크기는 콘텐츠 클래스가, 색상은 주변 컨테이너가 담당한다.

```css
/* 콘텐츠 자체의 스타일 */
.title { font-size: 24px; }

/* 배치된 문맥이 제공하는 스킨 */
.header { color: white; }
.footer { color: black; }
```

이렇게 하면 제목을 다른 컨테이너로 옮겨도 기본 글자 크기는 유지되고, 글자색은 현재 컨테이너에서 상속받는다. Bootstrap의 Flex media object 역시 컨테이너가 배치를, 내부 콘텐츠가 자신의 의미와 모양을 담당하는 예다.

강의의 Card 예시도 같은 원리로 구성된다.

```html
<article class="card-box">
  <h2 class="card-title">Card Title</h2>
  <p class="card-description">This is a card description.</p>
  <button class="btn-base btn-blue">Learn More</button>
  <button class="btn-base btn-red">Learn More</button>
</article>
```

```css
.card-box {
  width: 50%;
  padding: 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.card-title {
  margin-bottom: 8px;
  font-size: 20px;
  font-weight: bold;
}

.card-description {
  margin-bottom: 16px;
  font-size: 16px;
}
```

Bootstrap을 사용하는 이유도 이 원리와 연결된다. 이미 반복 구조와 스킨, 유틸리티의 역할이 분리되어 있어 `.btn + .btn-primary`, `.card + spacing utility`처럼 작은 단위를 조합할 수 있다. 단, Bootstrap 클래스 이름을 무작정 HTML에 쌓기보다 반복되는 프로젝트 고유 패턴은 의미 있는 사용자 클래스로 추출해야 유지보수가 쉬워진다.

---

## 4. 적용 관점에서 다시 보기

Bootstrap 화면은 “작은 스타일 → 동작 단위 → 큰 레이아웃 → 의미” 순서로 점검하면 안정적으로 만들 수 있다.

1. **기본 문서를 먼저 검증한다.** `viewport`, 같은 버전의 CSS/JS, 올바른 로드 경로를 확인하고 Console과 Network 오류를 없앤다.
2. **HTML 의미 구조를 세운다.** `header`, `nav`, `main`, `article`, form의 label처럼 콘텐츠 역할을 먼저 작성한다.
3. **Grid로 큰 배치를 만든다.** `container > row > col`을 지키고 가장 작은 화면의 `col-12`부터 큰 breakpoint 규칙을 더한다.
4. **컴포넌트를 배치한다.** 공식 구조를 기준으로 Card, Form, Modal을 넣고 `id`, `for`, `aria-*`, `data-bs-*` 연결을 맞춘다.
5. **유틸리티로 세부 표현을 조정한다.** spacing, color, display, flex, border를 조합하고 프로젝트 고유 값만 CSS로 보완한다.
6. **여러 viewport와 키보드로 검증한다.** 열 wrapping, overflow, 숨김 상태, focus 이동, Modal 닫기를 확인한다.

문제가 생겼을 때 보이는 현상은 원인을 좁히는 신호가 된다.

| 현상 | 우선 확인할 것 |
|---|---|
| Bootstrap 모양이 전혀 없다 | CSS URL, 404, `<link rel="stylesheet">` |
| Modal/Carousel만 동작하지 않는다 | bundle JS, `data-bs-*`, target과 `id` 일치 |
| 가운데 오지 않는다 | 요소 너비, 남는 공간, `mx-auto`, flex/grid 정렬 기준 |
| 열이 예상치 않게 내려간다 | 같은 row의 열 합, breakpoint, 고정 width, gutter |
| absolute 요소가 화면 구석으로 간다 | 기준 부모의 `position-relative` |
| 작은 화면에서 너무 좁거나 넘친다 | 고정 px 너비, `col-12`, `img-fluid`, responsive class |
| class를 바꿔도 결과가 그대로다 | cascade, specificity, `!important`, computed style |

실습의 로그인 화면을 완성한다면 작은 화면에서는 전체 폭을 쓰고, `md` 이상에서 6칸과 offset 3칸을 사용한 Card 안에 Form을 넣은 뒤 버튼으로 Modal을 여는 흐름이 자연스럽다. 여기서 Grid는 페이지 폭을, Card와 Form은 UI 구조를, spacing/Flex 유틸리티는 세부 배치를, `data-bs-*`와 JS는 상호작용을 담당한다.

---

## 5. 배운 점 / 확장 포인트

### 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

Bootstrap 클래스는 장식 이름이 아니라 실제 CSS 선언과 레이아웃 계산을 압축한 규칙이다. 또한 CSS를 연결하기만 해도 Reboot가 브라우저 기본 스타일을 정돈하며, JavaScript 컴포넌트는 `data-bs-*`와 대상 `id`의 연결로 상태를 바꾼다는 점을 함께 이해할 수 있다.

### 앞으로 이어지는 연결점

Grid의 mobile-first breakpoint와 display 유틸리티는 반응형 웹 학습으로 이어진다. 컴포넌트의 독립성과 OOCSS의 재사용 원칙은 이후 Vue 같은 컴포넌트 기반 프레임워크에서 파일과 상태 단위의 재사용으로 확장된다.

### 더 파볼 만한 주제

Bootstrap Sass 변수와 Utility API를 이용한 디자인 시스템 커스터마이징, CSS custom properties와 dark mode, WCAG 색 대비와 focus 관리, Bootstrap JavaScript의 programmatic API를 살펴볼 수 있다.

---

## 6. 요약 정리

- Bootstrap은 기본 스타일, 유틸리티, Grid, JavaScript 컴포넌트를 제공하는 프론트엔드 프레임워크다.
- CDN은 가까운 엣지 서버에서 파일을 전달한다. CSS와 JS 버전을 맞추고 `viewport`를 포함해야 한다.
- Reboot는 브라우저마다 다른 user agent stylesheet의 차이를 정돈해 일관된 출발점을 만든다.
- 유틸리티는 생성되는 CSS 결과로 이해한다. spacing은 property·side·size, Flex는 주축·교차축, position은 기준 containing block이 핵심이다.
- 컴포넌트는 정해진 HTML 구조와 클래스를 유지하면서 내용과 variant를 수정한다. 동작형 컴포넌트에는 bundle JS와 정확한 `data-bs-*` 연결이 필요하다.
- Grid는 `container > row > col` 구조와 12열 모델을 사용한다. breakpoint, nesting, offset, gutter는 각자의 기준 너비와 계산 방식을 가진다.
- 시맨틱 HTML은 콘텐츠의 역할을, CSS는 표현을 담당한다. OOCSS는 구조와 스킨, 컨테이너와 콘텐츠를 분리해 반복과 위치 의존성을 줄인다.

🧠 기억할 것: Bootstrap을 제대로 쓰는 기준은 “클래스가 많이 붙었는가”가 아니라, **각 클래스가 만든 동작을 설명할 수 있고 HTML의 의미와 반응형 구조가 유지되는가**이다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. `d-none d-lg-block`이 작은 화면과 `lg` 이상에서 각각 어떤 `display` 값을 만들며, 왜 mobile-first 규칙이라고 할 수 있는가?
2. `col-12 col-md-6 offset-md-3`인 로그인 폼의 너비와 위치가 `md` 전후로 어떻게 달라지는지 12열 모델로 설명할 수 있는가?
3. Modal 버튼을 눌러도 열리지 않을 때 CSS, JS, `data-bs-target`, `id`를 어떤 순서로 점검할 것인가?
4. `mx-auto`를 붙여도 요소가 가운데로 움직이지 않는 경우, 남는 공간과 요소 너비의 관계를 설명할 수 있는가?
5. 큰 글씨의 `p`보다 `h1`이 의미론적으로 나은 이유와, 구조/스킨 분리가 새 버튼 variant를 추가할 때 중복을 줄이는 이유를 설명할 수 있는가?
