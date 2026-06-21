# Controlling Event: DOM 이벤트 흐름과 이벤트 위임

- 🎯 글의 목표: JavaScript에서 이벤트 핸들러를 등록하고, 이벤트 객체와 버블링을 이용해 동적인 웹 화면을 제어하는 방법을 이해한다.
- 🧩 핵심 키워드: addEventListener, event 객체, preventDefault, 이벤트 버블링, event.target, event.currentTarget, 이벤트 위임, DOM 조작
- ⭐ 중요도: 높음. DOM을 읽고 바꾸는 것에서 한 단계 더 나아가, 사용자 행동에 반응하는 웹 페이지를 만드는 기본기다.
- 📝 한눈에 보는 내용: 버튼 클릭, form 제출 같은 사용자 행동을 이벤트로 감지하고, 기본 동작을 막거나 DOM을 갱신하며, 여러 요소의 이벤트를 상위 요소에서 효율적으로 관리한다.
- 🔗 관련 문제 / 주제: 사용자 인터랙션, form 제어, 동적 UI, 이벤트 위임, Ajax 요청의 전 단계

---

## 1. 들어가며

DOM 조작을 배우면 JavaScript로 HTML 요소를 선택하고 내용을 바꿀 수 있다. 하지만 실제 웹 페이지는 단순히 처음부터 정해진 내용을 보여주는 데서 끝나지 않는다. 사용자가 버튼을 누르고, 입력창에 글을 쓰고, form을 제출하고, 메뉴를 여는 순간마다 화면은 반응해야 한다.

이때 필요한 개념이 이벤트다. 이벤트는 브라우저 안에서 발생하는 어떤 신호라고 볼 수 있다. 키보드를 누르는 것, 마우스로 클릭하는 것, form이 제출되는 것, 페이지가 로드되는 것 모두 이벤트가 될 수 있다.

이번 강의에서는 `addEventListener`로 이벤트 핸들러를 등록하는 방법부터 시작해, 이벤트 객체에서 정보를 읽는 방법, form의 기본 동작을 막는 방법, 그리고 이벤트 버블링을 활용해 여러 요소를 효율적으로 제어하는 방법까지 이어진다.

## 2. 핵심 개념 정리

이 강의의 큰 질문은 "사용자 행동이 발생했을 때 JavaScript가 어떻게 알 수 있고, 어떻게 반응할 수 있는가"이다.

먼저 이벤트 핸들러를 등록해야 한다. 특정 요소에 `addEventListener()`를 사용하면, 그 요소에서 지정한 이벤트가 발생했을 때 실행할 함수를 연결할 수 있다.

그다음 이벤트 객체를 이해해야 한다. 이벤트 핸들러의 첫 번째 인자로 전달되는 `event` 객체에는 어떤 이벤트가 발생했는지, 실제로 어느 요소에서 시작됐는지, 기본 동작을 막을 수 있는지 같은 정보가 담겨 있다.

마지막으로 이벤트 버블링과 위임을 이해해야 한다. 이벤트는 실제 발생한 요소에서 끝나지 않고 부모 요소 방향으로 전파된다. 이 특성을 이용하면 여러 자식 요소마다 이벤트 리스너를 붙이지 않고, 공통 부모 요소에 한 번만 리스너를 등록할 수 있다.

## 3. 본문 정리

### 3.1 이벤트는 사용자 행동을 브라우저가 알려주는 신호다

일상에서도 어떤 일이 발생하면 그에 맞춰 반응한다. 전화벨이 울리면 전화를 받고, 리모컨 버튼을 누르면 채널이 바뀐다. 웹 페이지에서도 마찬가지다. 사용자가 버튼을 클릭하면 브라우저는 "click 이벤트가 발생했다"고 알려주고, JavaScript는 그 신호에 맞춰 코드를 실행한다.

가장 기본적인 형태는 다음과 같다.

```html
<button id="btn">인사하기</button>
<p id="message"></p>
```

```javascript
const button = document.querySelector('#btn')
const message = document.querySelector('#message')

button.addEventListener('click', function () {
  // 버튼에서 click 이벤트가 발생하면 이 함수가 실행된다.
  message.textContent = '안녕하세요!'
})
```

`addEventListener()`의 첫 번째 인자는 감지할 이벤트 이름이고, 두 번째 인자는 이벤트가 발생했을 때 실행할 함수다. 이 함수가 이벤트 핸들러다.

📌 핵심: DOM 조작이 "요소를 바꾸는 방법"이라면, 이벤트는 "언제 바꿀지 결정하는 방법"이다.

### 3.2 event 객체에는 발생한 이벤트의 정보가 들어 있다

이벤트 핸들러는 이벤트 객체를 받을 수 있다. 보통 인자 이름을 `event` 또는 `e`로 쓴다. 이 객체를 사용하면 어떤 요소에서 이벤트가 시작됐는지, 어떤 키가 눌렸는지, 기본 동작을 막을지 등을 판단할 수 있다.

```html
<button id="btn">클릭</button>
```

```javascript
const button = document.querySelector('#btn')

button.addEventListener('click', function (event) {
  // event.type은 발생한 이벤트 이름을 알려준다.
  console.log(event.type) // click

  // event.target은 실제 이벤트가 시작된 요소를 가리킨다.
  console.log(event.target)

  // event.currentTarget은 이벤트 리스너가 등록된 요소를 가리킨다.
  console.log(event.currentTarget)
})
```

단일 버튼처럼 이벤트가 발생한 요소와 리스너가 붙은 요소가 같을 때는 `target`과 `currentTarget`이 같아 보인다. 하지만 이벤트 위임을 배우면 이 둘의 차이가 매우 중요해진다.

⚠️ 주의: 처음에는 `event.target`만 써도 대부분 동작하는 것처럼 보인다. 하지만 상위 요소에 이벤트를 위임하는 순간, 실제 클릭된 요소와 이벤트를 처리하는 기준 요소가 달라질 수 있다.

### 3.3 preventDefault로 브라우저의 기본 동작을 막기

브라우저의 일부 요소는 기본 동작을 가지고 있다. 링크를 클릭하면 이동하고, form을 제출하면 페이지가 새로고침되며 요청이 전송된다. 그런데 JavaScript가 직접 처리해야 하는 상황에서는 이 기본 동작을 막아야 한다.

대표적인 예가 form 제출이다.

```html
<form id="login-form">
  <input name="username" type="text">
  <button type="submit">제출</button>
</form>
<p id="result"></p>
```

```javascript
const form = document.querySelector('#login-form')
const result = document.querySelector('#result')

form.addEventListener('submit', function (event) {
  // form의 기본 제출 동작을 막는다.
  // 이 줄이 없으면 브라우저가 페이지를 새로고침할 수 있다.
  event.preventDefault()

  const username = event.currentTarget.username.value
  result.textContent = `${username}님, 입력을 확인했습니다.`
})
```

여기서 `event.currentTarget`은 이벤트 리스너가 붙은 form이다. form 내부의 input은 `name` 속성을 기준으로 접근할 수 있다. 이처럼 form 제출을 JavaScript가 직접 다루면, 입력값 검증이나 Ajax 요청처럼 페이지 이동 없이 처리해야 하는 기능으로 자연스럽게 이어진다.

⚠️ 주의: `preventDefault()`는 이벤트 발생 자체를 막는 것이 아니다. 이벤트는 이미 발생했고, 이 메서드는 브라우저가 원래 하려던 기본 행동만 막는다.

### 3.4 이벤트 버블링은 이벤트가 부모로 전파되는 흐름이다

HTML 요소는 서로 중첩되어 있다. 버튼이 div 안에 있고, div는 body 안에 있다. 버튼을 클릭하면 이벤트는 버튼에서만 끝나지 않고 부모 요소 방향으로 올라간다. 이 흐름을 이벤트 버블링이라고 한다.

```html
<div id="outer">
  <button id="inner">버튼</button>
</div>
```

```javascript
const outer = document.querySelector('#outer')
const inner = document.querySelector('#inner')

outer.addEventListener('click', function () {
  console.log('outer에서 이벤트 처리')
})

inner.addEventListener('click', function () {
  console.log('inner에서 이벤트 처리')
})
```

버튼을 클릭하면 `inner`의 핸들러가 실행된 뒤, 이벤트가 부모인 `outer`로 올라가면서 `outer`의 핸들러도 실행된다. 이 특성은 처음에는 의도치 않은 중복 실행처럼 보일 수 있지만, 여러 요소를 한 번에 관리하는 데 매우 유용하다.

### 3.5 target과 currentTarget은 이벤트 위임의 기준이 된다

이벤트 버블링을 이해하려면 `event.target`과 `event.currentTarget`을 구분해야 한다.

```html
<ul id="menu">
  <li>Python</li>
  <li>Django</li>
  <li>JavaScript</li>
</ul>
```

```javascript
const menu = document.querySelector('#menu')

menu.addEventListener('click', function (event) {
  // 실제로 클릭된 요소는 li일 가능성이 높다.
  console.log(event.target)

  // 이벤트 리스너가 붙은 요소는 ul이다.
  console.log(event.currentTarget)

  if (event.target.tagName === 'LI') {
    event.target.classList.toggle('selected')
  }
})
```

`event.currentTarget`은 항상 `menu`다. 왜냐하면 이벤트 리스너를 `menu`에 붙였기 때문이다. 반면 `event.target`은 사용자가 실제로 클릭한 `li`다. 여러 항목 중 어떤 항목이 클릭됐는지 알아야 할 때는 `target`을 사용해야 한다.

📌 핵심: 이벤트 위임에서는 `currentTarget`으로 처리 영역을 잡고, `target`으로 실제 출발점을 찾는다.

### 3.6 이벤트 위임으로 반복되는 요소를 효율적으로 관리하기

여러 버튼에 같은 동작을 적용해야 할 때 모든 버튼에 이벤트 리스너를 붙일 수도 있다. 하지만 버튼이 많거나 나중에 동적으로 추가될 수 있다면 관리가 번거로워진다. 이때 상위 요소 하나에 이벤트 리스너를 붙이고, 실제 클릭된 자식 요소를 검사하는 방식을 사용할 수 있다.

```html
<section id="todo-list">
  <button class="done-button">완료</button>
  <button class="done-button">완료</button>
  <button class="done-button">완료</button>
</section>
```

```javascript
const todoList = document.querySelector('#todo-list')

todoList.addEventListener('click', function (event) {
  // 클릭된 요소가 완료 버튼이 아니라면 아무 일도 하지 않는다.
  if (!event.target.matches('.done-button')) {
    return
  }

  // 실제 클릭된 버튼만 비활성화한다.
  event.target.textContent = '완료됨'
  event.target.disabled = true
})
```

이 방식에서는 버튼이 몇 개든 이벤트 리스너는 하나만 필요하다. 이벤트가 자식 버튼에서 발생한 뒤 부모인 `todoList`로 올라오기 때문에 가능한 구조다.

⚠️ 주의: 상위 요소에 이벤트를 붙이면 그 안에서 발생하는 다양한 클릭 이벤트가 모두 들어올 수 있다. 그래서 `matches()` 같은 조건으로 내가 처리하려는 요소인지 먼저 확인하는 습관이 필요하다.

### 3.7 이벤트와 DOM 조작은 함께 쓰일 때 화면을 바꾼다

이벤트는 사용자 행동을 감지하고, DOM 조작은 화면을 바꾼다. 둘을 결합하면 사용자의 행동에 따라 페이지가 즉시 반응한다.

```html
<button id="count-button">0</button>
```

```javascript
const countButton = document.querySelector('#count-button')

countButton.addEventListener('click', function (event) {
  // 버튼의 현재 숫자를 읽어 정수로 바꾼다.
  const currentCount = Number(event.currentTarget.textContent)

  // 계산한 값을 다시 버튼의 텍스트로 넣는다.
  event.currentTarget.textContent = currentCount + 1
})
```

이 작은 예제는 이후 Ajax와도 연결된다. Ajax에서는 클릭 이벤트가 발생하면 서버에 요청을 보내고, 서버 응답을 받은 뒤 DOM을 갱신한다. 즉, 이벤트 제어는 비동기 웹 기능으로 넘어가기 전 반드시 잡고 가야 하는 기반이다.

## 4. 적용 관점에서 다시 보기

이벤트를 구현할 때는 먼저 "어떤 사용자 행동을 감지할 것인가"를 정해야 한다. 클릭이면 `click`, form 제출이면 `submit`, 입력 변화면 `input` 또는 `change`를 생각할 수 있다.

그다음 "기본 동작을 유지할 것인가"를 판단한다. 링크 이동이나 form 제출처럼 브라우저 기본 동작이 있는 경우, JavaScript가 직접 처리해야 한다면 `preventDefault()`가 필요하다.

마지막으로 "리스너를 어디에 붙일 것인가"를 결정한다. 요소가 하나라면 해당 요소에 직접 붙이면 된다. 같은 종류의 요소가 여러 개 반복된다면 상위 요소에 붙이고 `event.target`으로 실제 요소를 구분하는 이벤트 위임을 고려한다.

실전에서 자주 쓰는 판단 기준은 다음과 같다.

- 버튼 하나만 제어한다면 해당 버튼에 직접 `addEventListener`를 붙인다.
- form 제출을 Ajax로 바꿀 예정이라면 `submit` 이벤트와 `preventDefault()`를 먼저 떠올린다.
- 목록 안의 여러 버튼을 제어한다면 상위 컨테이너에 이벤트를 위임한다.
- 이벤트 위임을 쓴다면 `target`과 `currentTarget`을 반드시 구분한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

이벤트는 단순히 클릭을 감지하는 기능이 아니라, 사용자 행동과 DOM 조작을 연결하는 기준점이다. 특히 `event` 객체를 통해 실제 이벤트가 어디서 시작됐는지 알 수 있다는 점이 중요하다.

### 5.2 앞으로 이어지는 연결점

이번 내용은 Ajax 학습으로 바로 이어진다. Ajax 요청도 결국 버튼 클릭이나 form 제출 이벤트에서 시작하고, `preventDefault()`로 기본 제출을 막은 뒤 JavaScript가 직접 요청을 보내는 방식으로 구현된다.

### 5.3 더 파볼 만한 주제

이벤트 전파에는 버블링뿐 아니라 캡처링 단계도 있다. 또한 복잡한 UI에서는 이벤트 전파를 멈추는 `stopPropagation()`이 필요할 때도 있으므로, 버블링의 기본 흐름을 이해한 뒤 함께 살펴볼 만하다.

## 6. 요약 정리

이벤트는 브라우저에서 발생하는 사용자 행동의 신호다. `addEventListener()`로 이벤트 핸들러를 등록하면 특정 행동이 발생했을 때 JavaScript 코드를 실행할 수 있다.

🧠 기억할 것:

- `event` 객체에는 이벤트에 대한 정보가 담겨 있다.
- `preventDefault()`는 브라우저의 기본 동작을 막는다.
- 이벤트 버블링은 이벤트가 자식 요소에서 부모 요소로 전파되는 흐름이다.
- `event.target`은 실제 이벤트가 발생한 요소다.
- `event.currentTarget`은 이벤트 리스너가 등록된 요소다.
- 이벤트 위임은 반복되는 요소를 상위 요소 하나의 리스너로 관리하는 방식이다.

## 7. 미니 퀴즈 또는 체크리스트

- [ ] `addEventListener()`의 두 인자가 각각 무엇을 의미하는지 설명할 수 있는가?
- [ ] form 제출 이벤트에서 `preventDefault()`를 사용하는 이유를 설명할 수 있는가?
- [ ] `event.target`과 `event.currentTarget`의 차이를 예시로 설명할 수 있는가?
- [ ] 이벤트 버블링이 무엇인지 설명할 수 있는가?
- [ ] 여러 개의 버튼에 같은 동작을 적용할 때 이벤트 위임을 떠올릴 수 있는가?
