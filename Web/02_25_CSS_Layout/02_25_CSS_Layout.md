# CSS Layout: 박스 모델, Position, Flexbox로 화면 구성하기

- 🎯 글의 목표: 모든 HTML 요소가 어떤 크기의 박스로 계산되고, 기본 문서 흐름과 `position`, Flexbox 안에서 어떤 기준으로 배치되는지 이해한다. 단순히 속성 이름을 외우는 데서 그치지 않고, 축·기준점·남는 공간을 계산하여 실제 레이아웃을 설계하고 디버깅할 수 있도록 한다.
- 🧩 핵심 키워드: Box Model, `box-sizing`, `display`, block, inline, inline-block, none, Normal Flow, Margin Collapsing, `position`, containing block, `z-index`, Flex Container, Flex Item, main axis, cross axis, `flex-direction`, `flex-wrap`, `justify-content`, `align-content`, `align-items`, `align-self`, `flex-grow`, `flex-shrink`, `flex-basis`, responsive layout
- ⭐ 중요도: 매우 높음
- 📝 한눈에 보는 내용: CSS 레이아웃은 먼저 각 요소의 크기와 여백을 계산하고, 그 박스가 기본 흐름에서 어떤 방식으로 자리를 차지하는지 이해하는 데서 출발한다. 이후 특정 요소를 기준점에 겹치거나 화면에 고정하는 Position을 배우고, 마지막으로 여러 요소를 하나의 축을 따라 배치·정렬·공간 분배하는 Flexbox를 익힌다.
- 🔗 관련 문제 / 주제: 프로필 카드, 도서 관리 서비스의 박스 모델·Position·Flexbox, Flexbox 기본 구성, 고정 TOP 버튼, 이미지 위 배지, 반응형 카드, 헤더·사이드바·본문·푸터 레이아웃

---

## 1. 들어가며

HTML만 작성한 페이지에서도 요소들은 완전히 무질서하게 놓이지 않는다. 제목과 문단은 위에서 아래로 쌓이고, 링크와 강조 문구는 한 문장 안에서 옆으로 이어진다. 브라우저가 각 요소를 **사각형 박스**로 만들고, 박스의 종류에 맞는 기본 규칙으로 배치하기 때문이다.

레이아웃을 만든다는 것은 이 기본 규칙을 없애는 일이 아니다. 먼저 기본 규칙을 이해한 다음, 목적에 맞게 일부를 바꾸는 일이다. 요소의 실제 너비가 예상보다 커졌다면 박스 모델을 확인해야 하고, `top`을 주었는데 움직이지 않는다면 `position`을 확인해야 한다. 가운데 정렬이 되지 않는다면 “무엇을, 어느 축에서, 누가 정렬하는가”부터 구분해야 한다.

이번 강의는 방에 가구를 배치하는 흐름과 비슷하다. 먼저 각 가구의 본체와 완충 공간을 포함한 크기를 정하고(Box Model), 큰 가구와 문장 속 소품이 기본적으로 놓이는 방식을 확인한다(`display`, Normal Flow). 그다음 특정 소품을 모서리나 화면 위에 고정하고(Position), 마지막으로 여러 가구를 한 줄 또는 여러 줄에 규칙적으로 정렬한다(Flexbox).

---

## 2. 핵심 개념 정리

이번 강의가 해결하려는 중심 질문은 다음과 같다.

> 브라우저는 여러 HTML 요소의 크기와 자리를 어떻게 계산하며, 개발자는 그 계산 기준을 어떻게 바꿀 수 있을까?

본문은 이 질문을 네 단계로 풀어간다.

1. **박스의 크기부터 계산한다.** 콘텐츠, 패딩, 테두리, 마진의 관계와 `box-sizing`에 따라 선언한 `width`가 무엇을 뜻하는지 확인한다.
2. **기본 배치 흐름을 읽는다.** block과 inline의 차이, inline-block과 none의 역할, Normal Flow와 마진 상쇄를 통해 별도 레이아웃 속성이 없을 때의 위치를 이해한다.
3. **기본 흐름을 기준으로 일부 요소를 이동한다.** `static`, `relative`, `absolute`, `fixed`, `sticky`의 기준점과 자리 보존 여부를 비교하고, 겹친 요소의 순서를 `z-index`로 제어한다.
4. **컨테이너 안의 여러 요소를 함께 구성한다.** Flexbox의 주 축과 교차 축을 먼저 정한 뒤, 줄바꿈·정렬·공간 분배·아이템 크기 조절을 조합하여 반응형 카드와 페이지 구조를 만든다.

이 순서를 지키면 CSS 속성을 따로 외우지 않아도 된다. 화면이 어긋났을 때 **크기 → 기본 자리 → 위치 기준 → 축과 남는 공간** 순서로 원인을 좁힐 수 있기 때문이다.

---

## 3. 본문 정리

### 3.1 Box Model: 요소 하나의 실제 크기를 계산하는 규칙

브라우저는 모든 HTML 요소를 사각형 박스로 다룬다. 이 박스는 안쪽부터 `content`, `padding`, `border`, `margin` 네 영역으로 이루어진다.

```text
┌──────────────────── margin ────────────────────┐
│  ┌──────────────── border ──────────────────┐  │
│  │  ┌───────────── padding ──────────────┐  │  │
│  │  │             content               │  │  │
│  │  └───────────────────────────────────┘  │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

- `content`: 텍스트, 이미지처럼 실제 내용이 들어가는 영역이다.
- `padding`: 콘텐츠와 테두리 사이의 안쪽 여백이다. 요소의 배경색은 기본적으로 패딩 영역까지 칠해진다.
- `border`: 박스의 경계선이다.
- `margin`: 다른 요소와 거리를 만드는 바깥 여백이다. 요소의 배경은 마진 영역에 칠해지지 않는다.

다음 실습은 같은 `width: 100px`을 선언해도 `box-sizing`에 따라 실제 크기가 달라진다는 사실을 보여준다.

```html
<style>
  .box {
    width: 100px;          /* box-sizing에 따라 이 100px의 범위가 달라진다. */
    padding: 10px;
    border: 2px solid black;
    margin: 20px;          /* 요소 바깥의 간격이며 width에는 포함되지 않는다. */
    background-color: yellow;
  }

  .content-box {
    box-sizing: content-box; /* 기본값: width는 content만 뜻한다. */
  }

  .border-box {
    box-sizing: border-box;  /* width 안에 padding과 border를 포함한다. */
  }
</style>

<div class="box content-box">content-box</div>
<div class="box border-box">border-box</div>
```

`content-box`의 테두리 바깥쪽 너비는 다음과 같이 계산된다.

```text
100(content) + 10×2(padding) + 2×2(border) = 124px
```

좌우 마진까지 포함하여 다른 요소와 차지하는 가로 범위를 계산하면 `124 + 20×2 = 164px`이다. 반면 `border-box`는 선언한 100px 안에 패딩과 테두리를 포함하므로 콘텐츠 너비가 `100 - 20 - 4 = 76px`이 되고, 테두리 바깥쪽 너비는 정확히 100px이 된다. 마진은 어느 방식에서도 `width`에 포함되지 않는다.

실무에서는 다음과 같이 모든 요소에 `border-box`를 적용하는 경우가 많다. “300px짜리 카드”라고 선언했을 때 패딩을 추가해도 카드 외곽이 300px을 유지하므로 레이아웃 계산이 단순해진다.

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

⚠️ 주의: 박스가 부모보다 넘칠 때 무조건 `width`만 줄이면 원인을 놓칠 수 있다. 개발자 도구의 Box Model 패널에서 content, padding, border, margin을 각각 확인하고, 먼저 `box-sizing`이 무엇인지 살펴봐야 한다.

### 3.2 `display`: 박스가 바깥 흐름과 안쪽 자식을 다루는 방식

`display`는 요소가 페이지 흐름에서 어떤 종류의 박스로 동작할지 정한다. 강의 초반의 block과 inline은 박스 **자체가 주변 요소와 어떻게 배치되는지**를 설명하는 바깥 표시 방식이다. 뒤에서 배울 `display: flex`는 동시에 그 요소의 1차 자식을 어떻게 배치할지도 정하는 안쪽 표시 방식이다.

#### 3.2.1 block: 독립된 문단처럼 한 줄을 차지하는 박스

block 박스는 새 줄에서 시작한다. `width`를 지정하지 않은 일반적인 block 요소의 `auto` 너비는 부모의 사용 가능한 가로 공간을 채운다. `width`, `height`와 상하좌우의 패딩·테두리·마진을 모두 적용할 수 있다.

대표 요소는 `<h1>`~`<h6>`, `<p>`, `<div>`, `<ul>`, `<li>`이다. 특히 `<div>`는 시각적 의미를 스스로 만들지 않으면서 여러 요소를 묶어 헤더, 본문, 사이드바 같은 구역을 구성할 때 사용한다.

```html
<div class="container">
  <h1>제목</h1>
  <p>단락 내용입니다.</p>
</div>

<div class="content">다음 block은 새 줄에서 시작한다.</div>
```

“block은 너비 100%”라는 표현은 입문 단계에서 흐름을 이해하기 위한 설명이다. 엄밀히 말하면 기본 `width`는 `auto`이고, 마진·부모의 제약·box sizing을 고려해 사용 가능한 공간을 채운다. 따라서 `width: 100%`를 직접 주고 좌우 패딩까지 더하면 `content-box`에서는 오히려 부모를 넘을 수 있다.

#### 3.2.2 inline: 문장 속 단어처럼 이어지는 박스

inline 박스는 새 줄을 만들지 않고 콘텐츠가 필요한 만큼만 자리를 차지한다. `<a>`, `<span>`, `<strong>`이 대표적이다. `<span>`은 문장 일부에만 색상이나 강조를 적용할 때 유용하다.

```html
<p>
  이 문장에서 <span class="highlight">파란색 단어</span>만 다르게 표시한다.
</p>

<style>
  .highlight {
    color: blue;
    padding: 4px 8px;
    border: 1px solid blue;
  }
</style>
```

일반적인 non-replaced inline 요소에는 `width`와 `height`가 박스 크기 제어 수단으로 적용되지 않는다. 좌우 마진·패딩·테두리는 주변 inline 콘텐츠를 밀어내지만, 상하 마진은 줄 간격을 밀어내지 않는다. 상하 패딩과 테두리는 그려질 수 있으나 인접한 줄의 배치를 확보하지 않아서 겹쳐 보일 수 있다.

`<img>`는 기본적으로 inline 계열이지만 외부 자원 자체의 크기를 갖는 **replaced element**이므로 `width`와 `height`로 크기를 조절할 수 있다. “inline에는 크기를 줄 수 없다”는 규칙의 예외처럼 보이는 이유가 여기에 있다.

⚠️ 주의: 실습의 `span { margin: 30px; }`에서 좌우 간격은 눈에 띄지만 상하 마진은 앞뒤 줄을 밀지 못한다. 세로 크기와 네 방향 여백을 안정적으로 제어해야 한다면 `inline-block` 또는 다른 레이아웃 방식을 선택해야 한다.

#### 3.2.3 inline-block: 한 줄에 놓이지만 크기를 갖는 박스

`inline-block`은 바깥으로는 글자처럼 한 줄에 나란히 놓이고, 내부 크기 계산은 block 박스처럼 한다. 줄바꿈 없이 배치하면서 `width`, `height`, 네 방향의 패딩·테두리·마진을 모두 제어해야 하는 버튼, 내비게이션 항목, 작은 카드에 알맞다.

```html
<style>
  .menu > li {
    display: inline-block; /* li를 가로로 나열하면서 패딩을 온전히 적용한다. */
    padding: 10px 20px;
    background: crimson;
  }

  .gallery {
    text-align: center;    /* inline-block 자식은 글자처럼 정렬된다. */
  }

  .gallery .box {
    display: inline-block;
    width: 100px;
    height: 100px;
    margin: 10px;
    background: #4caf50;
  }
</style>

<ul class="menu">
  <li><a href="#">Home</a></li>
  <li><a href="#">About</a></li>
</ul>

<div class="gallery">
  <div class="box"></div>
  <div class="box"></div>
</div>
```

⚠️ 주의: inline-block 요소 사이의 HTML 줄바꿈과 공백은 실제 텍스트 공백처럼 렌더링될 수 있다. 항목 사이에 원인을 알 수 없는 작은 틈이 생길 수 있으므로, 정교한 간격은 Flexbox의 `gap`으로 관리하는 편이 예측하기 쉽다.

#### 3.2.4 `display: none`: 박스와 자리 모두 제거하기

`display: none`인 요소는 렌더링 박스를 만들지 않으므로 화면에 보이지 않고 레이아웃 자리도 남기지 않는다.

```html
<style>
  .box {
    width: 100px;
    height: 100px;
    background: red;
    border: 2px solid black;
  }

  .none {
    display: none; /* 두 번째 박스의 자리까지 사라진다. */
  }
</style>

<div class="box"></div>
<div class="box none"></div>
<div class="box"></div>
```

이는 `visibility: hidden`과 다르다. `visibility: hidden`은 보이지 않더라도 원래 공간을 유지한다. 또한 `display: none`인 콘텐츠는 일반적으로 접근성 트리에서도 제외되므로, 단지 시각적으로만 숨길 목적이라면 접근성 요구까지 함께 검토해야 한다.

### 3.3 Normal Flow: 별도 조작이 없을 때의 기본 배치

Normal Flow는 레이아웃을 바꾸는 특별한 속성을 적용하지 않았을 때 브라우저가 요소를 배치하는 기본 방식이다. 워드 문서에서 엔터를 눌러 문단을 나누는 것이 block의 흐름이고, 엔터 없이 단어를 계속 입력하는 것이 inline의 흐름이라고 생각하면 쉽다.

```html
<style>
  h1, p, div { border: 1px solid blue; }
  a, span, img { border: 3px solid red; }
</style>

<h1>Normal Flow</h1>
<p>block 요소는 새 줄에서 부모의 사용 가능한 너비를 차지한다.</p>
<p>
  inline 요소는 <span>이것처럼</span> 문장 흐름 안에 놓이고,
  <a href="#">다음 inline 요소</a>와 줄을 공유한다.
</p>
```

Normal Flow를 먼저 이해해야 `position`의 결과도 읽을 수 있다. `relative`는 기본 흐름에서 자기 자리를 얻은 뒤 시각적으로 이동하고, `absolute`와 `fixed`는 기본 흐름에서 빠진다. 즉, 위치 속성의 차이는 결국 “원래 자리를 계산에 남기는가”와 “무엇을 기준으로 이동하는가”의 차이다.

### 3.4 마진 상쇄와 박스 타입별 수평 정렬

#### 3.4.1 Margin Collapsing: 인접한 세로 마진이 하나로 합쳐지는 현상

Normal Flow 안의 block 요소 사이에서는 위·아래 마진이 단순히 더해지지 않을 수 있다. 인접한 두 block의 `margin-bottom`과 `margin-top`이 만나면 하나의 마진으로 상쇄되고, 둘 다 양수라면 큰 값이 최종 간격이 된다.

```html
<style>
  .box {
    width: 200px;
    height: 100px;
    background: crimson;
  }

  .first { margin-bottom: 50px; }
  .second { margin-top: 30px; }
</style>

<div class="box first">Box 1</div>
<div class="box second">Box 2</div>
```

두 박스 사이는 `50px + 30px = 80px`이 아니라 `max(50px, 30px) = 50px`이 된다. 강의의 20px과 20px 예시도 40px이 아니라 20px이다. 이 규칙은 주로 Normal Flow의 block 박스가 만나는 **세로 방향**에 관한 것이며 좌우 마진에는 적용되지 않는다. Flexbox와 Grid 아이템 사이의 마진도 이 방식으로 상쇄되지 않는다.

마진 상쇄는 문단들이 각자 위아래 마진을 가져도 간격이 중복되지 않게 해 일관성을 높인다. 하지만 카드 간격을 정확히 더해야 하는 상황에서는 뜻밖의 결과처럼 보일 수 있다. 이때 부모에 `display: flow-root`를 적용해 새로운 block formatting context를 만들거나, Flexbox/Grid의 `gap`을 사용하는 방법을 고려할 수 있다.

⚠️ 주의: 개발자 도구에서 두 요소 모두 마진이 표시되는데 실제 거리가 합보다 작다면 CSS가 무시된 것이 아니라 상쇄되었을 가능성이 크다.

#### 3.4.2 무엇을 가운데 놓는지에 따라 방법이 달라진다

block 요소 자체와 inline 콘텐츠는 같은 방식으로 중앙 정렬하지 않는다.

| 정렬 대상 | 적용 위치와 방법 | 필요한 조건 |
|---|---|---|
| block 박스 자체 | 대상에 `margin-inline: auto` | 남는 가로 공간이 생기도록 너비가 제한되어야 함 |
| inline 콘텐츠 | 부모에 `text-align: center` | 자식이 inline 계열이어야 함 |
| inline-block 박스 | 부모에 `text-align: center` | 대상이 `display: inline-block` |

```css
.block-card {
  width: 300px;
  margin-inline: auto; /* 남는 좌우 공간을 auto 마진이 반씩 갖는다. */
}

.text-or-inline-box-wrapper {
  text-align: center;  /* 부모의 inline content를 정렬한다. */
}
```

`text-align`은 block 자식 박스 자체를 옮기는 속성이 아니다. 반대로 너비가 부모를 이미 가득 채우는 block에 `margin: 0 auto`를 주면 나눌 남는 공간이 없어서 시각적 변화가 없다.

### 3.5 CSS Position: 기준점을 정해 요소를 이동하거나 겹치기

`position`은 단순히 좌표를 주는 속성이 아니다. 요소가 Normal Flow에 남는지, `top`, `right`, `bottom`, `left`가 어느 박스를 기준으로 계산되는지를 결정한다.

| 값 | Normal Flow의 자리 | 이동 기준 | 대표 용도 |
|---|---|---|---|
| `static` | 유지 | 방향 속성 적용 안 됨 | 기본 문서 배치 |
| `relative` | 유지 | 자신의 원래 위치 | 미세 이동, absolute 자식의 기준점 만들기 |
| `absolute` | 제거 | 가장 가까운 positioned 조상 | 카드 위 배지, 이미지 위 버튼 |
| `fixed` | 제거 | 보통 viewport | TOP 버튼, 떠 있는 도구 |
| `sticky` | 유지 | 평소에는 원래 자리, 임계점 이후 스크롤 컨테이너 | 고정되는 섹션 제목·내비게이션 |

여기서 **positioned 조상**은 보통 `position` 값이 `static`이 아닌 조상을 뜻한다. 좌표를 디버깅할 때는 숫자보다 먼저 이 기준점을 찾아야 한다.

#### 3.5.1 `static`과 `relative`: 자리를 유지하는 위치 지정

`static`은 기본값이다. Normal Flow에 따라 배치되며 `top`, `left` 같은 방향 속성이 적용되지 않는다.

`relative`도 먼저 Normal Flow에서 자리를 차지하지만, 그 자리에서 자기 자신을 기준으로 시각적으로 이동할 수 있다. 이동 전 공간은 그대로 남으므로 뒤 요소가 빈자리를 메우지 않는다.

```css
.relative-box {
  position: relative;
  top: 20px;  /* 원래 자리보다 아래로 20px 이동 */
  left: 20px; /* 원래 자리보다 오른쪽으로 20px 이동 */
}
```

방향을 해석할 때 `top: 20px`은 “위쪽 경계를 기준에서 20px 떨어뜨린다”는 뜻이므로 결과적으로 아래로 이동한다. `left: 20px`은 오른쪽으로 이동한다.

⚠️ 주의: 실습의 Relative 박스가 이동한 뒤 다른 박스와 겹쳐도 뒤 요소가 재배치되지 않는다. `relative` 이동은 레이아웃을 다시 계산하는 이동이 아니라 원래 자리를 보존한 시각적 오프셋이기 때문이다.

#### 3.5.2 `absolute`: 흐름에서 빠져 가장 가까운 기준 조상에 붙기

`absolute` 요소는 Normal Flow에서 제거된다. 다른 요소는 absolute 요소가 원래 차지했을 공간이 없는 것처럼 배치된다. 좌표는 가장 가까운 positioned 조상의 padding box를 기준으로 계산되며, 그런 조상이 없다면 초기 containing block을 기준으로 삼는다.

카드 오른쪽 위에 배지를 겹치려면 부모 카드에 기준점을 만들고 자식을 이동한다.

```html
<style>
  .card {
    position: relative; /* badge가 이 카드를 기준으로 삼게 한다. */
    width: 300px;
    min-height: 200px;
    border: 1px solid black;
  }

  .card-content { padding: 16px; }

  .badge {
    position: absolute; /* 문서 흐름에서 빠져 카드 위에 겹친다. */
    top: 0;
    right: 0;
    padding: 5px 10px;
    color: white;
    background: red;
  }
</style>

<article class="card">
  <div class="card-content">
    <h3>Card Title</h3>
    <p>Card content</p>
    <span class="badge">New</span>
  </div>
</article>
```

⚠️ 주의: 연습 파일 `03_absolute.html`에서는 핵심 선언인 부모의 `position: relative`와 배지의 `position: absolute; top: 0; right: 0`이 주석 처리되어 있다. 자식 선언만 켜고 부모의 기준점을 만들지 않으면 배지가 카드가 아니라 페이지 쪽에 붙는다. 두 부분을 함께 활성화해야 의도한 카드 배지가 된다.

이미지 정중앙에 원형 링크를 겹치는 연습은 기준점과 요소 크기 보정을 함께 보여준다.

```css
.image-wrapper {
  position: relative;
  width: 1000px;
}

.center-link {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}
```

`left: 50%; top: 50%`는 링크의 **왼쪽 위 모서리**를 부모 중앙에 둔다. 따라서 링크 자체 너비와 높이의 절반만큼 되돌리는 `translate(-50%, -50%)`가 있어야 링크 중심이 정확히 일치한다.

#### 3.5.3 `fixed`: viewport의 같은 자리에 유지하기

`fixed` 요소도 Normal Flow에서 빠진다. 일반적으로 현재 화면 영역인 viewport를 기준으로 좌표를 계산하므로 페이지를 스크롤해도 같은 자리에 보인다.

```css
.top-button {
  position: fixed;
  right: 10px;
  bottom: 10px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
```

이는 우측 하단의 TOP 버튼이나 떠 있는 도움말 버튼에 적합하다. 다만 본문 위를 덮을 수 있으므로 충분한 여백, 키보드 접근성, 모바일 안전 영역을 함께 고려해야 한다.

⚠️ 주의: `web_ws_2_a` 연습에는 문서 위쪽에 `id="top"`이 있지만 버튼 링크는 `href=""`이다. 빈 URL은 현재 문서를 다시 요청하는 동작이 될 수 있다. 문서 내부 이동 의도라면 `<a href="#top">TOP</a>`처럼 대상 fragment를 명시해야 한다. 또한 interactive 요소인 `<button>` 안에 `<a>`를 중첩하기보다는 링크 하나를 버튼처럼 스타일링하는 편이 올바른 구조다.

#### 3.5.4 `sticky`: 흐름에 있다가 임계점에서 고정되기

`sticky`는 평소에는 Normal Flow 안에서 `relative`처럼 자리를 차지한다. 스크롤하여 지정한 임계점에 닿으면 해당 스크롤 컨테이너 안에서 고정된 것처럼 동작한다.

```css
.section-title {
  position: sticky;
  top: 0; /* 이 임계점이 있어야 위쪽 고정 동작을 관찰할 수 있다. */
  padding: 20px;
  background: lightblue;
  border: 2px solid black;
}
```

여러 sticky 제목이 같은 `top: 0`을 사용하면 다음 제목이 올라오며 이전 제목과 같은 위치를 차지하고 밀어내거나 덮는 것처럼 보인다. 긴 목록의 섹션 제목, 스크롤 후 상단에 남는 카테고리 내비게이션이 대표적인 용도다.

⚠️ 주의: `position: sticky`만 쓰고 `top`, `bottom` 같은 임계값을 지정하지 않으면 일반 요소처럼 보여서 실패로 오해하기 쉽다. 조상에 `overflow: hidden`, `auto`, `scroll`이 있으면 viewport가 아니라 그 조상이 스크롤 기준이 될 수 있으며, 조상의 높이가 충분하지 않아도 붙어 있을 구간이 생기지 않는다.

`web_ws_2_c`는 네 위치 방식을 한 페이지에서 비교한다. 여기서 `.container`에는 `position`이 없으므로 `.absolute-example`은 컨테이너가 아닌 초기 containing block 쪽을 기준으로 움직인다. 컨테이너 안 좌표를 원한다면 `.container { position: relative; }`를 추가해야 한다. 이 한 줄이 absolute 디버깅의 핵심이다.

### 3.6 `z-index`: 겹친 요소의 앞뒤 순서와 stacking context

Position으로 요소를 겹치면 Z축의 순서를 결정해야 한다. 같은 쌓임 맥락 안에서는 `z-index`가 큰 요소가 앞에 보이고, 값이 같으면 대체로 문서에서 뒤에 작성된 요소가 앞에 그려진다.

```css
.container { position: relative; }

.box {
  position: absolute;
  width: 100px;
  height: 100px;
}

.red   { top: 50px;  left: 50px;  z-index: 3; background: red; }
.green { top: 100px; left: 100px; z-index: 2; background: green; }
.blue  { top: 150px; left: 150px; z-index: 1; background: blue; }
```

강의에서는 입문 규칙으로 “`static`이 아닌 positioned 요소에 적용한다”고 설명한다. 일반적인 position 예제에는 맞는 기준이다. 다만 현재 CSS에서는 flex item과 grid item은 `position: static`이어도 `z-index`가 적용될 수 있다.

더 중요한 제약은 **stacking context**이다. 특정 `position`과 `z-index`, `transform`, `opacity` 등의 조합은 독립된 쌓임 맥락을 만든다. 자식의 `z-index: 9999`는 자기 부모의 stacking context 안에서만 강할 뿐, 부모 전체가 다른 형제의 뒤에 있으면 그 형제를 넘어설 수 없다.

⚠️ 주의: `z-index`를 계속 크게 올려도 해결되지 않는다면 숫자 싸움이 아니다. 두 요소가 같은 stacking context에서 비교되는지, 조상 중 누가 새 stacking context를 만들었는지 개발자 도구에서 확인해야 한다.

### 3.7 Flexbox의 큰 그림: 한 축을 중심으로 배치하는 1차원 레이아웃

Flexbox는 요소를 행 또는 열 형태로 배치하는 1차원 레이아웃 방식이다. “1차원”은 한 번에 주 축 하나를 중심으로 아이템의 크기와 순서를 계산한다는 뜻이다. 줄바꿈으로 여러 줄을 만들 수는 있지만, 행과 열을 동시에 엄격한 격자로 제어하는 Grid와는 목적이 다르다.

부모에 `display: flex`를 선언하면 부모가 **Flex Container**, 그 부모의 1차 자식들이 **Flex Item**이 된다.

```html
<style>
  .container {
    display: flex;
    height: 300px;
    border: 1px solid black;
  }
</style>

<div class="container">
  <article>Item 1</article>
  <article>Item 2</article>
  <article>Item 3</article>
</div>
```

`display: flex`는 컨테이너 자체는 block처럼 바깥 흐름에 놓이게 하고 내부 자식을 flex 방식으로 배치한다. `display: inline-flex`는 내부는 같지만 컨테이너 자체가 바깥에서 inline-level 박스처럼 놓인다.

기본 설정에서 일어나는 일은 다음과 같다.

- `flex-direction: row`이므로 아이템이 가로 주 축을 따라 나열된다.
- 아이템은 `main-start`에서 시작한다.
- `flex-wrap: nowrap`이므로 한 줄을 유지하려 한다.
- `align-items: stretch`이므로 교차 크기가 `auto`인 아이템은 교차 축 방향으로 늘어난다.
- 아이템은 필요하면 `flex-shrink: 1`에 의해 줄어들 수 있다.

### 3.8 주 축과 교차 축: 모든 Flexbox 정렬의 기준

Flexbox 속성을 외우기 전에 두 축을 정해야 한다.

- **main axis(주 축)**: flex item이 기본적으로 나열되는 축이다.
- **cross axis(교차 축)**: 주 축에 수직인 축이다.

`flex-direction: row`이면 일반적인 좌→우 쓰기 환경에서 주 축은 가로, 교차 축은 세로다. `column`으로 바꾸면 주 축은 세로, 교차 축은 가로가 된다. 따라서 `justify-content`를 “가로 정렬”, `align-items`를 “세로 정렬”로 외우면 `column`에서 바로 틀린다.

```text
flex-direction: row
main axis  : main-start ───────────────▶ main-end
cross axis : cross-start
                  │
                  ▼
             cross-end

flex-direction: column
main axis  : 위에서 아래로
cross axis : 가로 방향
```

📌 핵심: `justify-*`는 주 축, `align-*`는 교차 축을 먼저 떠올린다. 그 축의 실제 가로·세로 방향은 `flex-direction`이 정한다.

### 3.9 Flex Container의 배치 속성: 방향과 줄바꿈

#### 3.9.1 `flex-direction`: 주 축의 방향 정하기

```css
.row            { flex-direction: row; }
.row-reverse    { flex-direction: row-reverse; }
.column         { flex-direction: column; }
.column-reverse { flex-direction: column-reverse; }
```

| 값 | 일반적인 배치 방향 |
|---|---|
| `row` | 가로, 시작점에서 끝점으로. 기본값 |
| `row-reverse` | 가로 주 축의 시작과 끝을 반전 |
| `column` | 세로, 위에서 아래로 |
| `column-reverse` | 세로 주 축의 시작과 끝을 반전 |

`reverse`는 시각적 배치만 뒤집고 HTML의 소스 순서를 바꾸지 않는다. 따라서 키보드 포커스와 스크린 리더의 읽기 순서가 화면과 달라질 수 있다. 단순 장식을 넘어 의미 있는 순서라면 HTML 자체를 올바르게 작성해야 한다.

#### 3.9.2 `flex-wrap`: 한 줄을 지킬지 다음 줄로 넘길지 정하기

```css
.container {
  display: flex;
  flex-wrap: wrap;
}
```

- `nowrap`: 기본값. 줄을 바꾸지 않고 한 줄 안에서 아이템을 축소하거나 넘치게 할 수 있다.
- `wrap`: 공간이 부족하면 새 flex line을 만들어 일반 교차 축 방향으로 쌓는다.
- `wrap-reverse`: 여러 줄을 만들되 줄이 쌓이는 교차 축 방향을 반대로 한다.

⚠️ 주의: `02flex-wrap.html`의 nowrap 컨테이너에는 너비 200px인 아이템 세 개와 마진이 들어가지만 컨테이너 너비는 500px뿐이다. 그런데 기본 `flex-shrink: 1` 때문에 아이템이 먼저 줄어들 수 있다. “nowrap이면 반드시 가로 스크롤이 생긴다”가 아니다. 축소를 막아 넘침을 관찰하려면 아이템에 `flex-shrink: 0`을 추가해야 한다.

`flex-direction`과 `flex-wrap`은 다음 단축 속성으로 함께 쓸 수 있다.

```css
.container {
  flex-flow: row wrap; /* flex-direction | flex-wrap */
}
```

### 3.10 Flex Container의 공간 분배와 정렬

Flexbox 정렬 속성은 “아이템”, “한 줄”, “여러 줄” 중 무엇을 움직이는지 구분해야 한다.

| 속성 | 대상 | 축 | 동작 조건 |
|---|---|---|---|
| `justify-content` | 한 줄 안의 아이템 묶음/간격 | 주 축 | 주 축에 남는 공간이 있어야 함 |
| `align-items` | 각 flex line 안의 아이템 | 교차 축 | 모든 아이템에 공통 적용 |
| `align-content` | 여러 flex line 묶음/간격 | 교차 축 | 두 줄 이상이고 교차 축에 남는 공간이 있어야 함 |
| `align-self` | 아이템 하나 | 교차 축 | 해당 아이템만 재정의 |

#### 3.10.1 `justify-content`: 주 축의 남는 공간 분배

```css
.container {
  display: flex;
  justify-content: space-between;
}
```

- `flex-start`: 주 축 시작점에 모은다. 기본값이다.
- `flex-end`: 주 축 끝점에 모은다.
- `center`: 주 축 중앙에 모은다.
- `space-between`: 첫 아이템은 시작점, 마지막 아이템은 끝점에 두고 **사이** 간격을 같게 한다.
- `space-around`: 각 아이템의 양쪽에 같은 몫을 주므로 양 끝의 바깥 간격은 아이템 사이 간격의 절반이다.
- `space-evenly`: 양 끝과 모든 아이템 사이 간격을 똑같게 한다.

`justify-content`는 아이템 크기를 정한 뒤 남은 공간을 분배한다. 아이템이 주 축을 이미 가득 채웠거나 `flex-grow`가 남는 공간을 모두 가져갔다면 눈에 띄는 공간이 남지 않아 정렬 효과가 보이지 않는다.

개별 item을 주 축 끝으로 보내는 `justify-self`는 Flexbox에 없다. 한 아이템의 주 축 앞 마진을 `auto`로 두면 남는 공간을 그 마진이 흡수한다.

```css
.login-button {
  margin-inline-start: auto; /* 앞의 남는 공간을 모두 가져가 오른쪽으로 밀린다. */
}
```

#### 3.10.2 `align-items`: 한 줄 안 아이템의 교차 축 정렬

```css
.container {
  display: flex;
  align-items: center;
}
```

- `stretch`: 교차 크기가 `auto`인 아이템을 line 크기에 맞게 늘린다. 기본값이다.
- `flex-start`: 교차 축 시작점에 맞춘다.
- `flex-end`: 교차 축 끝점에 맞춘다.
- `center`: 교차 축 중앙에 맞춘다.

`stretch`는 아이템에 명시적 `height` 또는 현재 교차 축에 해당하는 크기가 이미 있으면 그 값을 무시하고 강제로 늘리는 속성이 아니다. 실습에서 `.item1`에 높이를 주지 않았기 때문에 기본 stretch 차이가 뚜렷하게 보인다.

#### 3.10.3 `align-content`: 여러 줄 전체를 교차 축에서 분배

`align-content`는 아이템 하나가 아니라 **flex line 여러 개**를 움직인다. 따라서 `flex-wrap: wrap`으로 실제 두 줄 이상이 생기고, 컨테이너 교차 축에 남는 공간도 있어야 한다.

사용 값은 `stretch`, `flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`이며 공간 분배 원리는 `justify-content`와 같고 대상 축만 교차 축이다.

⚠️ 주의: `web_ws_2_b`의 컨테이너는 아이템 네 개가 한 줄에 들어간다. 이 상황에서 세로 중앙 정렬은 `align-content: center`가 아니라 `align-items: center`가 맞다. “줄이 하나밖에 없어서 content를 적용할 수 없다”는 실습 주석이 두 속성의 차이를 정확히 짚는다.

#### 3.10.4 `align-self`: 한 아이템만 교차 축 정렬 덮어쓰기

```css
.container { align-items: center; }

.special-item {
  align-self: flex-end; /* 이 아이템만 교차 축 끝으로 이동한다. */
}
```

값은 `auto`, `stretch`, `flex-start`, `flex-end`, `center` 등을 사용한다. `auto`는 부모의 `align-items`에 따른다. 강의에서는 이를 “부모 값을 상속한다”고 설명하지만, 엄밀히는 상속 속성이라기보다 `auto`의 사용값이 컨테이너의 정렬 값을 참조하는 동작이다.

`06align-self.html`은 `align-items`, `align-content`, `align-self`를 함께 비교한다. `align-content: center`는 line 묶음을 중앙으로 옮기고, 각 line 안에서 개별 아이템이 어디에 놓일지는 다시 `align-items`와 `align-self`가 결정한다. 두 속성은 서로 대체 관계가 아니다.

### 3.11 Flex Item의 크기: `grow`, `shrink`, `basis`

Flexbox는 아이템의 기본 크기를 구한 다음 컨테이너의 남거나 부족한 공간을 분배한다. 이 계산에 참여하는 세 속성이 `flex-basis`, `flex-grow`, `flex-shrink`이다.

#### 3.11.1 `flex-basis`: 공간 분배 전의 주 축 기본 크기

`flex-basis`는 flex item의 초기 주 축 크기를 정한다. 주 축이 가로면 기본 너비, 세로면 기본 높이 역할을 한다. `auto`가 아닌 `flex-basis`와 `width`가 함께 주 축 크기를 지정하면 일반적으로 `flex-basis`가 우선한다.

```css
.item-1 { flex-basis: 300px; }
.item-2 { flex-basis: 600px; }
.item-3 { flex-basis: 300px; }
```

⚠️ 주의: 이 세 값의 합은 1200px이다. 컨테이너가 그보다 좁고 줄바꿈이 없다면 최종 너비가 반드시 300/600/300px로 유지되는 것이 아니다. 기본 `flex-shrink: 1`이 부족한 공간을 줄이므로, `flex-basis`는 보장된 고정 너비가 아니라 **flex 계산의 출발 크기**이다.

#### 3.11.2 `flex-grow`: 남는 양의 공간을 비율로 받기

`flex-grow`는 주 축에 남는 공간이 있을 때 아이템이 그 공간을 가져가는 비율이다. 최종 전체 너비의 비율을 직접 정하는 속성이 아니라, **기본 크기를 제외한 남은 공간의 배분 비율**이다.

강의의 계산 예시에서 컨테이너는 600px, 네 아이템의 기본 크기는 각 100px이다. 남는 공간은 200px이고 grow 값은 `1 : 1 : 0 : 2`이다.

```text
grow 합계 = 1 + 1 + 0 + 2 = 4
한 몫      = 200px / 4 = 50px

1번 = 100 + 50×1 = 150px
2번 = 100 + 50×1 = 150px
3번 = 100 + 50×0 = 100px
4번 = 100 + 50×2 = 200px
```

따라서 grow가 2인 네 번째 아이템은 첫 번째의 “최종 너비 두 배”가 아니라 남는 공간을 두 몫 받는다.

#### 3.11.3 `flex-shrink`: 공간이 부족할 때 줄어드는 정도

`flex-shrink`는 grow의 반대 상황에서 작동한다. 아이템 기본 크기의 합이 컨테이너보다 클 때 얼마나 축소될지 정한다. 기본값은 1이므로 별도 선언이 없어도 flex item은 줄어들 수 있다.

실제 shrink 계산은 shrink 값만 단순 비율로 나누는 것이 아니라 각 아이템의 flex base size도 함께 고려한다. 이미지나 고정 폭 버튼처럼 줄어들면 안 되는 요소에는 `flex-shrink: 0`을 사용할 수 있지만, 작은 화면에서 넘침을 만들 수 있으므로 의도적으로 선택해야 한다.

#### 3.11.4 `flex` 단축 속성

`flex`는 grow, shrink, basis를 한 번에 지정한다.

```css
.item-a { flex: 2; }         /* 2 1 0% */
.item-b { flex: 10rem; }     /* 1 1 10rem */
.item-c { flex: 30%; }       /* 1 1 30% */
.item-d { flex: 1 30px; }    /* grow 1, shrink 1, basis 30px */
.item-e { flex: 2 2; }       /* grow 2, shrink 2, basis 0% */
.item-f { flex: 2 2 10%; }   /* grow 2, shrink 2, basis 10% */
```

숫자 하나인 `flex: 1`을 `flex-grow: 1` 하나와 완전히 같다고 보면 안 된다. 단축 속성이 `flex-basis: 0%`까지 설정하므로, 아이템 콘텐츠나 `width`에서 출발하는 `flex: 1 1 auto`와 결과가 달라질 수 있다. 팀 코드에서는 의도를 드러내기 위해 `flex: 1 1 350px`처럼 세 값을 명확히 쓰는 방식도 좋다.

#### 3.11.5 `order`: 시각적 순서 조정

`order`는 flex item의 시각적 배치 순서를 바꾼다. 기본값은 0이며 작은 값이 먼저 놓인다. 다만 `row-reverse`와 마찬가지로 DOM 순서와 접근성 읽기 순서를 바꾸지 않으므로, 의미 있는 콘텐츠 순서를 고치는 수단으로 사용해서는 안 된다.

### 3.12 `flex-wrap`과 item 크기를 조합한 반응형 카드

반응형 레이아웃은 특정 화면 폭마다 좌표를 다시 작성하는 것만을 뜻하지 않는다. 아이템이 선호하는 기본 크기와 줄바꿈 규칙을 정하면, Flexbox가 가용 공간을 보고 자연스럽게 구성을 바꿀 수 있다.

강의의 카드는 이미지와 본문을 나란히 두되, 공간이 부족하면 두 요소를 다음 줄로 넘긴다.

```html
<style>
  .card {
    display: flex;       /* 1. 이미지와 내용을 flex item으로 만든다. */
    flex-wrap: wrap;     /* 2. 공간이 부족하면 여러 줄을 허용한다. */
    width: 80%;
    border: 1px solid black;
  }

  .thumbnail {
    width: 100%;         /* 이미지가 배정받은 박스 안을 채운다. */
    flex: 1 1 700px;     /* 3. 선호 기본 폭 700px, 여백이 있으면 성장한다. */
  }

  .content {
    flex: 1 1 350px;     /* 4. 선호 기본 폭 350px, 여백을 같은 grow 비율로 받는다. */
  }
</style>

<article class="card">
  <img class="thumbnail" src="images/sample.jpg" alt="샘플 이미지">
  <div class="content">
    <h2>Heading</h2>
    <p>Card content</p>
  </div>
</article>
```

충분히 넓은 컨테이너에서는 700px과 350px을 출발점으로 한 줄에 놓이고, 남는 공간은 grow 값이 둘 다 1이므로 같은 몫으로 추가된다. 한 줄에 두 기본 크기를 담기 어려워지면 wrap에 의해 위아래 구성으로 바뀐다. 별도의 미디어 쿼리 없이도 콘텐츠가 감당할 수 있는 크기를 기준으로 반응한다.

⚠️ 주의: 반응형 테스트는 브라우저 너비만 한 번 줄여 보는 것으로 끝내지 않는다. 긴 단어, 큰 이미지의 고유 크기, flex item의 기본 `min-width: auto` 때문에 예상보다 줄지 않을 수 있다. 텍스트 영역이 넘치면 상황에 따라 `min-width: 0`, 이미지에는 `display: block; max-width: 100%`가 필요한지 확인한다.

### 3.13 Flexbox를 중첩해 전체 페이지 구성하기

Flexbox는 한 컨테이너가 페이지 전체를 모두 해결하는 방식보다, 역할별 컨테이너를 중첩할 때 강력하다. 실습의 전체 레이아웃은 다음과 같이 구성된다.

```text
body (column flex, 최소 높이 100vh)
├─ header (row flex: 제목 ↔ navigation)
├─ main (row flex)
│  ├─ aside.sidebar (column flex)
│  └─ section.content (남는 공간 성장, 중앙 정렬)
└─ footer (row flex, 중앙 정렬)
```

```css
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  margin: 0;
}

header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

nav ul {
  display: flex; /* header의 flex는 손자 li까지 자동 정렬하지 않으므로 별도 컨테이너가 필요하다. */
  margin: 0;
  padding: 0;
  list-style: none;
}

main {
  flex-grow: 1; /* header와 footer를 제외한 세로 여유 공간을 차지한다. */
  display: flex;
}

.sidebar {
  width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.content {
  flex-grow: 1; /* sidebar를 제외한 main의 가로 여유 공간을 차지한다. */
  display: flex;
  justify-content: center;
  align-items: center;
}

footer {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
```

같은 `flex-grow: 1`도 어느 컨테이너의 주 축에 참여하느냐에 따라 의미가 달라진다. `body`의 자식인 `main`은 세로 주 축의 남는 높이를 받고, `main`의 자식인 `.content`는 가로 주 축의 남는 너비를 받는다. 이처럼 각 단계에서 “현재 컨테이너와 주 축이 무엇인가”를 다시 확인해야 한다.

`min-height: 100vh`를 사용하면 콘텐츠가 적을 때도 푸터가 화면 아래쪽에 있고, 콘텐츠가 많아지면 body가 100vh보다 더 커질 수 있다. 고정 `height: 100vh`보다 내용 넘침에 안전한 이유다.

---

## 4. 적용 관점에서 다시 보기

레이아웃 문제는 보이는 결과만 따라 속성을 추가하면 수정이 서로 충돌하기 쉽다. 다음 순서로 구현하고 점검하면 원인을 훨씬 빠르게 찾을 수 있다.

### 4.1 구현 순서

1. **HTML 구조와 Normal Flow부터 확인한다.** CSS를 최소화한 상태에서 block이 위아래로, inline이 문장 안에서 놓이는 기본 구조가 의미상 올바른지 본다.
2. **박스 외곽 크기를 정한다.** `box-sizing`, width/height, padding, border를 확인한다. 여백은 가능하면 한 방향 또는 부모의 `gap`으로 일관되게 관리한다.
3. **여러 형제를 함께 배치해야 하면 부모를 찾는다.** 그 부모를 Flex Container로 만들고 주 축 방향과 wrap 여부부터 정한다.
4. **정렬 전에 크기를 해결한다.** item의 basis, shrink, grow를 정한 뒤 남는 공간이 실제 존재하는지 확인한다.
5. **겹침이나 화면 고정만 Position으로 처리한다.** absolute 자식의 기준 부모에 relative를 주고, fixed·sticky는 스크롤 기준까지 확인한다.
6. **마지막에 쌓임 순서를 조정한다.** 요소가 실제로 겹치는지, 같은 stacking context인지 확인한 뒤 최소한의 `z-index`를 준다.

### 4.2 증상으로 원인 찾기

| 화면의 증상 | 먼저 확인할 것 |
|---|---|
| 선언한 너비보다 박스가 큼 | `box-sizing`, 좌우 padding과 border |
| block 중앙 정렬이 안 됨 | 너비가 제한되어 남는 공간이 있는지, 대상에 auto margin을 주었는지 |
| 상하 마진을 더했는데 간격이 작음 | Normal Flow block 사이의 margin collapsing |
| `top`이 동작하지 않음 | `position: static`인지 |
| absolute 배지가 카드 밖으로 감 | 카드가 positioned 조상인지 |
| sticky가 붙지 않음 | 임계값 `top`, 스크롤 조상, 조상 높이와 overflow |
| `z-index: 9999`도 뒤에 있음 | 조상이 만든 stacking context |
| `justify-content`가 안 보임 | 주 축 남는 공간을 grow나 item 크기가 이미 차지했는지 |
| `align-content`가 안 보임 | 실제 flex line이 두 줄 이상인지, 교차 축 남는 공간이 있는지 |
| nowrap인데 item 폭이 줄어듦 | 기본 `flex-shrink: 1` |
| `flex-basis`와 실제 너비가 다름 | grow/shrink, min-size, 컨테이너 가용 공간 |

### 4.3 개발자 도구로 검증할 항목

브라우저 개발자 도구에서 요소를 선택한 뒤 다음을 순서대로 보면 좋다.

- Computed/Box Model에서 최종 content·padding·border·margin 크기를 확인한다.
- Styles에서 선언이 취소선인지, 더 높은 우선순위 규칙에 덮였는지 확인한다.
- Flex overlay를 켜서 main axis, line, gap과 item 크기를 시각화한다.
- position 요소는 containing block이 될 조상을 따라 올라가며 `position` 값을 확인한다.
- 반응형 카드는 viewport를 천천히 줄이며 “어느 폭에서 왜 줄이 바뀌는지”를 basis 합과 실제 카드 너비로 설명해 본다.

---

## 5. 배운 점 / 확장 포인트

1. **이번 강의 이전에 몰랐던 것 또는 새로 이해된 것**: CSS 배치는 속성 하나의 효과가 아니라 박스 크기, Normal Flow의 자리, 위치 기준점, Flexbox의 축과 남는 공간 계산이 연속해서 만든 결과다. 특히 `flex-grow`가 최종 크기 비율이 아니라 남은 공간의 비율이라는 점, `align-content`가 item이 아니라 여러 line을 정렬한다는 점을 구분할 수 있게 된다.

2. **앞으로 이어지는 연결점**: 이 기반은 Bootstrap의 Flex utility와 Grid system, 미디어 쿼리를 이용한 반응형 웹, 컴포넌트 단위 UI 설계로 이어진다. 프레임워크의 `d-flex`, `justify-content-*`, `align-items-*`도 결국 이번에 배운 같은 축과 공간 분배 규칙을 짧은 클래스로 표현한 것이다.

3. **더 파볼 만한 주제**: 논리 속성(`margin-inline`, `inset-inline-start`), CSS Grid의 2차원 배치, stacking context 생성 조건, `aspect-ratio`, container query, `gap`, 접근성을 고려한 시각 순서와 DOM 순서 차이를 확장해서 살펴볼 수 있다.

---

## 6. 요약 정리

- 모든 요소는 content, padding, border, margin으로 이루어진 박스이며, `border-box`는 선언한 크기 안에 padding과 border를 포함한다.
- block은 새 줄과 사용 가능한 가로 공간을 기준으로 놓이고, inline은 문장 흐름을 따른다. inline-block은 한 줄 배치와 크기 제어를 결합하며, `display: none`은 박스와 자리 모두 없앤다.
- Normal Flow는 레이아웃 판단의 출발점이다. 인접 block의 세로 마진은 상쇄될 수 있다.
- Position은 **흐름에 자리를 남기는가**와 **어느 기준점을 사용하는가**로 구분한다. `relative`는 자기 원래 자리, `absolute`는 가까운 positioned 조상, `fixed`는 보통 viewport, `sticky`는 스크롤 임계점을 기준으로 한다.
- `z-index`는 같은 stacking context 안의 쌓임 순서를 정한다. 큰 숫자보다 stacking context 관계가 먼저다.
- Flexbox에서는 `flex-direction`이 주 축을 결정한다. `justify-*`는 주 축, `align-*`는 교차 축을 다룬다.
- `align-items`는 line 안의 item, `align-content`는 여러 line, `align-self`는 item 하나를 정렬한다.
- `flex-basis`는 계산의 출발 크기, `flex-grow`는 남는 공간의 배분 비율, `flex-shrink`는 부족한 공간에서 줄어드는 정도다.
- `flex-wrap`과 basis/grow를 결합하면 콘텐츠가 감당할 수 있는 크기를 기준으로 자연스럽게 줄이 바뀌는 반응형 구성을 만들 수 있다.

🧠 기억할 것: 레이아웃이 예상과 다르면 속성을 더 넣기 전에 **현재 박스의 실제 크기, Normal Flow의 자리, 위치 기준점, Flex Container의 주 축과 남는 공간**을 차례로 확인한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. `width: 200px; padding: 20px; border: 5px solid`인 요소의 테두리 바깥 너비는 `content-box`와 `border-box`에서 각각 얼마인지 계산해 보자.
2. `position: relative`와 `position: absolute`는 모두 `top: 20px`을 사용할 수 있다. 두 요소의 원래 자리가 문서 배치에 남는지와 좌표 기준이 무엇인지 비교해서 설명해 보자.
3. 한 줄뿐인 Flex Container에서 `align-content: center`가 효과를 보이지 않는 이유와, 대신 어떤 속성을 사용해야 하는지 설명해 보자.
4. 기본 너비가 각각 100px인 세 item이 있고 200px의 남는 공간을 `flex-grow: 1 2 1`로 나눌 때 각 최종 너비를 계산해 보자.
5. 다음 디버깅 체크를 스스로 수행할 수 있는가?
   - absolute 요소의 containing block을 찾을 수 있다.
   - sticky의 임계값과 스크롤 조상을 확인할 수 있다.
   - `flex-basis`와 실제 크기가 다른 이유를 grow/shrink로 설명할 수 있다.
   - `z-index`가 듣지 않을 때 조상 stacking context를 확인할 수 있다.
