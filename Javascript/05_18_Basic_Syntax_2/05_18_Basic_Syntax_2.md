# JavaScript Basic Syntax 2

- 🎯 글의 목표: JavaScript의 객체와 배열을 단순한 자료형이 아니라, 실제 프론트엔드 개발에서 데이터를 다루는 기본 단위로 이해한다. 특히 `this`, JSON 변환, 콜백 함수, Array Helper Methods, 전개 구문, 클래스까지 연결해 Vue와 Axios 학습으로 넘어가기 위한 기초 체력을 만든다.
- 🧩 핵심 키워드: Object, Property, Method, `this`, Prototype, `hasOwnProperty`, JSON, `JSON.stringify`, `JSON.parse`, Shorthand Property, Computed Property, Destructuring Assignment, Spread Syntax, Optional Chaining, Array, Callback Function, `forEach`, `map`, `filter`, `reduce`, Declarative Programming, Class, Constructor, `new`
- ⭐ 중요도: ★★★★★  
  JavaScript의 객체와 배열은 이후 Vue 컴포넌트 상태, Pinia store, Axios 응답 데이터, DRF API 응답 처리에서 거의 매번 사용된다. 특히 콜백 함수와 배열 메서드는 Vue와 React 같은 프론트엔드 프레임워크의 코드 스타일을 이해하는 데 직접 연결된다.
- 📝 한눈에 보는 내용:  
  이번 강의는 “JavaScript에서 여러 데이터를 어떻게 묶고, 꺼내고, 가공할 것인가?”라는 질문에서 출발한다. 먼저 객체를 통해 key-value 형태의 데이터를 다루고, 메서드와 `this`를 통해 객체 내부 동작 방식을 이해한다. 이후 JSON 변환과 객체 문법을 확장하고, 배열과 콜백 함수로 넘어가 `forEach`, `map`, `filter`, `reduce` 같은 Array Helper Methods를 학습한다. 마지막에는 배열도 객체라는 관점과 class 문법을 통해 JavaScript의 객체 지향적 표현 방식까지 정리한다.
- 🔗 관련 문제 / 주제: JavaScript 객체 조작, API 응답 데이터 처리, 배열 데이터 가공, Vue 반복 렌더링, Axios 응답 처리, Todo CRUD, Pinia 상태 관리, DRF 응답 JSON 처리

---

## 1. 들어가며

JavaScript를 처음 배울 때는 변수, 조건문, 반복문, 함수처럼 문법 하나하나를 따로 익히게 된다. 하지만 실제 웹 개발에서는 값 하나만 다루는 경우보다 여러 데이터를 묶어서 다루는 경우가 훨씬 많다. 사용자 정보, 게시글 목록, 댓글 배열, 상품 목록, API 응답 데이터는 모두 객체와 배열을 중심으로 구성된다.

이번 강의의 핵심은 바로 이 지점에 있다. 단순히 객체는 `{}`로 만들고 배열은 `[]`로 만든다는 수준을 넘어서, 객체 안의 값을 어떻게 안전하게 꺼낼지, 객체 안의 함수가 자기 자신의 속성에 어떻게 접근할지, 서버와 주고받는 JSON 문자열을 어떻게 JavaScript 객체로 바꿀지, 배열에 들어 있는 데이터를 어떤 방식으로 순회하고 변환할지를 연결해서 이해해야 한다.

특히 이번 내용은 이후 Vue 수업과 직접 이어진다. Vue에서 서버로부터 받아온 게시글 목록을 화면에 렌더링할 때는 배열을 순회해야 하고, 로그인 사용자 정보나 게시글 상세 정보는 객체 형태로 다루게 된다. Axios 요청 결과도 JSON 기반이며, Pinia store에 저장되는 상태 역시 객체와 배열로 구성된다.

그래서 이번 노트는 문법을 외우는 방식보다, “실제 개발에서 이 문법이 왜 필요한가?”를 중심으로 정리한다. 객체에서 시작해 배열, 콜백, 배열 메서드, 클래스까지 흐름을 따라가면 JavaScript가 데이터를 다루는 방식이 훨씬 선명해진다.

---

## 2. 핵심 개념 정리

이번 강의의 큰 질문은 다음과 같다.

> JavaScript에서는 여러 데이터를 어떻게 묶고, 그 데이터를 어떻게 꺼내고, 바꾸고, 반복해서 처리할까?

이 질문에 답하기 위해 먼저 객체를 배운다. 객체는 key-value 형태로 데이터를 저장하는 자료형이다. 이름, 나이, 주소처럼 의미가 분명한 데이터를 하나의 묶음으로 관리할 수 있기 때문에 실제 웹 서비스의 사용자 정보나 게시글 정보와 잘 맞는다.

객체를 배울 때 함께 따라오는 개념이 메서드와 `this`다. 객체 안에 들어 있는 함수는 메서드라고 부르고, 메서드 안에서는 `this`를 사용해 자신이 속한 객체의 속성에 접근할 수 있다. 다만 JavaScript의 `this`는 선언된 위치가 아니라 호출 방식에 따라 결정되기 때문에, 일반 함수 호출과 메서드 호출을 반드시 구분해야 한다.

그다음에는 JSON을 다룬다. JSON은 JavaScript 객체와 비슷한 모양을 가진 데이터 표기법이지만, 실제로는 문자열이다. 서버와 클라이언트가 데이터를 주고받을 때 JSON을 자주 사용하므로, 객체를 JSON 문자열로 바꾸는 `JSON.stringify()`와 JSON 문자열을 객체로 바꾸는 `JSON.parse()`는 API 통신의 기본이 된다.

이후에는 배열로 넘어간다. 배열은 순서가 있는 데이터 묶음이다. 객체가 key를 기준으로 데이터를 설명한다면, 배열은 0번, 1번, 2번처럼 인덱스를 기준으로 데이터를 관리한다. 배열을 다룰 때는 단순 반복문보다 콜백 함수를 받는 Array Helper Methods가 중요하다.

`forEach`, `map`, `filter`, `reduce`는 모두 배열을 순회하면서 콜백 함수를 실행한다는 공통점을 가진다. 하지만 목적은 다르다. `forEach`는 단순 실행, `map`은 변형, `filter`는 선별, `reduce`는 누적과 집계에 사용된다. 이 차이를 정확히 구분하면 배열 데이터를 다루는 코드가 훨씬 깔끔해진다.

마지막으로 class를 통해 객체를 반복해서 생성하는 방식까지 살펴본다. class는 객체를 만들기 위한 템플릿이며, `new` 키워드와 `constructor()`를 통해 새로운 객체를 초기화한다. 이 내용은 JavaScript가 객체 기반 언어라는 점을 더 깊게 이해하는 데 도움이 된다.

---

## 3. 본문 정리

## 3.1 객체 Object

객체는 key로 구분된 데이터 집합을 저장하는 자료형이다. 배열이 순서 중심의 데이터 묶음이라면, 객체는 이름표가 붙은 데이터 묶음이라고 볼 수 있다.

예를 들어 사용자 정보를 저장한다고 해보자. 이름, 나이, 주소를 따로 변수로 관리할 수도 있지만, 하나의 사용자에 속한 정보라면 객체로 묶는 편이 자연스럽다.

```js
// user라는 하나의 객체 안에 여러 속성을 묶어 저장한다.
const user = {
  // key는 name, value는 'Alice'다.
  name: 'Alice',

  // value에는 문자열뿐 아니라 함수도 들어갈 수 있다.
  greeting: function () {
    return 'hello'
  },
}
```

객체는 중괄호 `{}`로 만들고, 내부에는 `key: value` 쌍으로 구성된 속성을 작성한다. key는 기본적으로 문자열처럼 동작하고, value에는 문자열, 숫자, 배열, 객체, 함수 등 거의 모든 자료형이 들어갈 수 있다.

---

### 3.1.1 객체 구조와 속성 접근

객체에 저장된 값은 점 표기법 또는 대괄호 표기법으로 접근한다. 일반적으로 key 이름이 단순한 경우에는 점 표기법을 많이 사용하고, key 이름에 공백이 있거나 변수에 담긴 key를 사용해야 하는 경우에는 대괄호 표기법을 사용한다.

![객체 속성 접근 예시](<../assets/images/05_18_Basic_Syntax_2/스크린샷 2026-05-18 113252.png>)

```js
const user = {
  name: 'Alice',
  age: 20,
  'favorite food': 'pizza',
}

// 점 표기법: key 이름이 단순할 때 사용하기 좋다.
console.log(user.name) // 'Alice'

// 대괄호 표기법: key 이름을 문자열로 지정한다.
console.log(user['age']) // 20

// key 이름에 공백이 있으면 점 표기법을 사용할 수 없다.
console.log(user['favorite food']) // 'pizza'

// 변수에 key 이름이 들어 있는 경우에도 대괄호 표기법을 사용한다.
const keyName = 'name'
console.log(user[keyName]) // 'Alice'
```

여기서 중요한 점은 점 표기법과 대괄호 표기법이 같은 역할을 하더라도, 사용할 수 있는 상황이 다르다는 것이다. 특히 API 응답 데이터를 다룰 때 key가 동적으로 결정되는 경우에는 대괄호 표기법이 필요하다.

⚠️ 주의: `user.keyName`이라고 쓰면 변수 `keyName`의 값이 아니라 실제로 `keyName`이라는 이름의 속성을 찾는다. 변수 안의 문자열을 key로 사용하려면 반드시 `user[keyName]` 형태로 접근해야 한다.

---

### 3.1.2 `in` 연산자와 `hasOwnProperty()`

객체에 특정 속성이 있는지 확인할 때 `in` 연산자를 사용할 수 있다.

```js
const user = {
  name: 'Alice',
  greeting: function () {
    return 'hello'
  },
}

console.log('greeting' in user) // true
console.log('country' in user) // false
```

다만 강의에서 중요한 주의점이 나왔다. `in` 연산자는 객체 자신이 가진 속성뿐 아니라, 프로토타입 체인을 따라 상속받은 속성까지 확인한다. 그래서 “이 객체가 직접 가진 속성인가?”를 확인하고 싶을 때는 `hasOwnProperty()`를 사용하는 편이 더 안전하다.

```js
const user = {
  name: 'Alice',
}

// 객체 자신이 직접 가진 속성인지 확인한다.
console.log(user.hasOwnProperty('name')) // true
console.log(user.hasOwnProperty('toString')) // false

// in 연산자는 프로토타입 체인의 속성까지 true가 될 수 있다.
console.log('toString' in user) // true
```

프로토타입은 객체들이 기능을 물려받는 원본, 즉 부모 역할을 하는 객체다. 프로토타입 체인은 자신에게 없는 속성이나 기능을 부모, 조상 순서로 찾아가는 구조다. 그래서 단순히 존재 여부만 확인할 때는 `in`도 사용할 수 있지만, 실제 객체 자신의 데이터인지 확인할 때는 `hasOwnProperty()`를 우선 고려하는 것이 좋다.

📌 핵심: 객체 자신의 속성인지 확인하려면 `in`보다 `hasOwnProperty()`가 더 명확하다.

---

## 3.2 메서드와 `this`

객체의 속성 값으로 함수가 들어가면 그 함수를 메서드라고 부른다. 메서드는 객체가 수행할 수 있는 행동을 표현한다.

예를 들어 사용자가 자기소개를 하는 기능을 객체 안에 넣는다면 다음처럼 작성할 수 있다.

```js
const person = {
  name: 'Alice',

  // 객체 속성에 함수가 들어가면 메서드라고 부른다.
  greeting: function () {
    return `Hello my name is ${this.name}`
  },
}

// person 객체가 greeting 메서드를 호출한다.
console.log(person.greeting()) // Hello my name is Alice
```

![메서드와 this 사용 예시](<../assets/images/05_18_Basic_Syntax_2/스크린샷 2026-05-18 114413.png>)

이 코드에서 `this.name`은 `person.name`을 의미한다. 메서드 안에서 `this`를 사용하면 객체 자기 자신의 속성에 접근할 수 있다.

---

### 3.2.1 `this`는 호출 방식에 따라 달라진다

JavaScript에서 `this`는 함수를 어디에 작성했는지가 아니라, 어떻게 호출했는지에 따라 결정된다. 이 점이 Python의 `self`나 Java의 `this`와 가장 크게 다른 부분이다.

| 호출 방법 | `this`가 가리키는 대상 |
|---|---|
| 일반 함수로 단순 호출 | 전역 객체 또는 `undefined` 환경 |
| 객체의 메서드로 호출 | 메서드를 호출한 객체 |

먼저 일반 함수로 호출하면 `this`는 메서드를 호출한 객체가 아니라 전역 객체를 가리킬 수 있다.

![일반 함수 호출에서의 this](<../assets/images/05_18_Basic_Syntax_2/스크린샷 2026-05-18 114640.png>)

```js
function myFunc() {
  return this
}

// 일반 함수 호출에서는 점 앞의 객체가 없다.
console.log(myFunc())
```

반면 객체의 메서드로 호출하면 `this`는 점 앞의 객체를 가리킨다.

![메서드 호출에서의 this](<../assets/images/05_18_Basic_Syntax_2/스크린샷 2026-05-18 114736.png>)

```js
const myObj = {
  data: 1,
  myFunc: function () {
    return this
  },
}

// 점 앞에 있는 myObj가 this가 된다.
console.log(myObj.myFunc()) // myObj
```

이렇게 보면 `this`가 헷갈릴 때 확인해야 할 기준이 분명해진다.

> 누가 점을 찍어 호출했는가?

점 앞의 객체가 있다면 그 객체가 `this`가 된다. 점 앞의 객체 없이 함수만 호출했다면 메서드 호출이 아니라 일반 함수 호출이다.

---

### 3.2.2 중첩 함수에서의 `this` 문제

`this`가 가장 헷갈리는 상황은 객체 메서드 안에서 다시 함수를 사용할 때다. 특히 `forEach`의 콜백 함수처럼 함수 안에 함수가 들어가는 구조에서 문제가 자주 발생한다.

```js
const myObj = {
  numbers: [1, 2, 3],

  myFunc: function () {
    // 여기의 this는 myObj를 가리킨다.
    this.numbers.forEach(function (number) {
      // 하지만 이 콜백 함수는 일반 함수로 호출된다.
      // 따라서 여기의 this는 myObj가 아닐 수 있다.
      console.log(this)
    })
  },
}

myObj.myFunc()
```

`myFunc` 안에서는 `this`가 `myObj`를 가리킨다. 하지만 `forEach` 안에 전달된 일반 함수는 객체의 메서드로 호출된 것이 아니라, 콜백 함수로 호출된다. 그래서 그 내부의 `this`는 바깥의 `this`와 달라질 수 있다.

이 문제를 해결하는 대표적인 방법이 화살표 함수다.

```js
const myObj = {
  numbers: [1, 2, 3],

  myFunc: function () {
    // myFunc의 this는 myObj다.
    this.numbers.forEach((number) => {
      // 화살표 함수는 자신만의 this를 만들지 않는다.
      // 따라서 바깥 함수 myFunc의 this를 그대로 사용한다.
      console.log(this)
    })
  },
}

myObj.myFunc()
```

화살표 함수는 자신만의 `this`를 가지지 않는다. 대신 자신이 선언된 상위 스코프의 `this`를 그대로 사용한다. 그래서 객체 메서드 안에서 배열을 순회하며 `this`를 사용해야 할 때 화살표 함수가 안전한 경우가 많다.

⚠️ 주의: 객체의 메서드 자체를 화살표 함수로 작성하는 것은 조심해야 한다. 메서드 안에서 객체 자신의 속성에 접근해야 한다면 일반 함수 문법을 사용하는 편이 더 안전하다. 화살표 함수는 “콜백 함수 내부에서 바깥 `this`를 유지할 때” 특히 유용하다.

📌 핵심: `this`가 헷갈리면 “함수를 누가 호출했는가?”를 먼저 보고, 중첩 콜백에서는 화살표 함수가 바깥 `this`를 유지한다는 점을 기억한다.

---

## 3.3 JSON

JSON은 JavaScript Object Notation의 약자로, key-value 형태로 데이터를 표현하는 표기법이다. 모양은 JavaScript 객체와 비슷하지만, JSON 자체는 일정한 형식을 가진 문자열이다.

```text
JavaScript Object: 실제 JavaScript에서 사용하는 객체 자료형
JSON: 객체처럼 생긴 문자열 데이터 형식
```

서버와 클라이언트가 데이터를 주고받을 때는 특정 언어에 종속되지 않는 형식이 필요하다. JSON은 이 역할을 하기 때문에 API 통신에서 매우 자주 사용된다.

---

### 3.3.1 Object에서 JSON 문자열로 변환하기

JavaScript 객체를 JSON 문자열로 바꾸려면 `JSON.stringify()`를 사용한다.

![JSON.stringify 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 153117.png>)

```js
const jsObject = {
  coffee: 'Americano',
  iceCream: 'Cookie and cream',
}

// 객체를 JSON 문자열로 변환한다.
const objToJson = JSON.stringify(jsObject)

console.log(objToJson)
console.log(typeof objToJson) // string
```

이 변환은 서버에 데이터를 보낼 때 자주 사용된다. JavaScript 객체 그대로 전송하는 것이 아니라, 문자열 기반의 JSON 형식으로 변환해 요청 본문에 담는 경우가 많다.

---

### 3.3.2 JSON 문자열에서 Object로 변환하기

반대로 JSON 문자열을 JavaScript 객체로 바꾸려면 `JSON.parse()`를 사용한다.

![JSON.parse 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 153203.png>)

```js
const jsonData = '{"coffee":"Americano","iceCream":"Cookie and cream"}'

// JSON 문자열을 JavaScript 객체로 변환한다.
const jsonToObj = JSON.parse(jsonData)

console.log(jsonToObj)
console.log(typeof jsonToObj) // object
```

API 응답을 받아 사용할 때는 JSON 문자열을 JavaScript 객체로 바꾸어야 속성 접근이 가능하다. 실제 Axios나 Fetch를 사용하면 이 변환을 자동으로 처리해주는 경우도 있지만, JSON이 문자열이라는 사실은 꼭 알고 있어야 한다.

⚠️ 주의: JSON 문자열은 반드시 올바른 JSON 형식을 따라야 한다. key는 큰따옴표로 감싸야 하고, 형식이 깨진 문자열을 `JSON.parse()`하면 에러가 발생한다.

---

## 3.4 추가 객체 문법

객체를 실제 개발에서 자주 사용하다 보면 반복되는 코드를 줄이거나, 동적으로 key를 만들거나, 객체에서 필요한 값만 뽑아 쓰는 문법이 필요해진다. 이번 강의에서는 객체를 더 편하게 다루는 여러 문법을 함께 살펴봤다.

---

### 3.4.1 단축 속성

객체를 만들 때 key 이름과 값으로 사용할 변수 이름이 같다면 단축 속성을 사용할 수 있다.

![단축 속성 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 153403.png>)

```js
const name = 'Alice'
const age = 30

// 기존 방식
const user1 = {
  name: name,
  age: age,
}

// 단축 속성 사용
const user2 = {
  name,
  age,
}
```

단축 속성은 단순히 타이핑을 줄이는 문법처럼 보이지만, 실제 프로젝트에서 객체를 자주 만들다 보면 코드 가독성을 크게 높여준다.

---

### 3.4.2 단축 메서드

객체 안에 메서드를 작성할 때 `function` 키워드를 생략할 수 있다.

![단축 메서드 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 153432.png>)

```js
const obj = {
  // 기존 방식
  greeting: function () {
    return 'hello'
  },

  // 단축 메서드 방식
  sayHello() {
    return 'hello'
  },
}
```

객체 안에서 행동을 표현하는 메서드가 많아질수록 단축 메서드 문법이 더 깔끔하게 느껴진다. Vue의 옵션 객체나 JavaScript 설정 객체에서도 이런 형태를 자주 보게 된다.

---

### 3.4.3 계산된 속성 이름

계산된 속성 이름은 대괄호 `[]` 안의 표현식을 평가해서 객체의 key로 사용하는 문법이다. 고정된 문자열이 아니라 변수 값으로 key를 만들고 싶을 때 사용한다.

![계산된 속성 이름 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 153521.png>)

```js
const product = prompt('상품 이름을 입력하세요')
const prefix = 'my'
const suffix = 'Property'

const bag = {
  [product]: 5,
  [prefix + suffix]: 'value',
}

console.log(bag)
```

이 문법을 사용하면 사용자 입력값이나 변수 값을 기반으로 객체의 key를 만들 수 있다.

⚠️ 주의: 계산된 속성 이름은 편리하지만, 대괄호 안의 표현식이 너무 복잡해지면 어떤 key가 만들어지는지 파악하기 어렵다. 또한 같은 이름의 key가 동적으로 만들어지면 기존 값이 덮어써질 수 있다.

---

### 3.4.4 구조 분해 할당

구조 분해 할당은 배열이나 객체를 분해해서 필요한 값을 변수에 쉽게 할당하는 문법이다. 객체에서 여러 속성을 꺼내야 할 때 반복적으로 `person.name`, `person.age`처럼 쓰지 않아도 된다.

![구조 분해 할당 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 153657.png>)

```js
const person = {
  name: 'Alice',
  age: 30,
  city: 'London',
}

// 객체의 속성을 같은 이름의 변수로 꺼낸다.
const { name, age, city } = person

console.log(name) // Alice
console.log(age) // 30
console.log(city) // London
```

함수의 매개변수에서도 객체 구조 분해 할당을 사용할 수 있다.

![함수 매개변수 구조 분해 할당](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 153732.png>)

```js
const person = {
  name: 'Alice',
  age: 30,
  city: 'London',
}

// 객체 전체를 받은 뒤 함수 내부에서 꺼내는 대신,
// 매개변수 자리에서 바로 구조 분해 할당을 한다.
function printInfo({ name, age, city }) {
  console.log(`이름: ${name}, 나이: ${age}, 도시: ${city}`)
}

printInfo(person)
```

이 문법은 Vue 컴포넌트의 props, API 응답 객체, 설정 객체를 다룰 때 특히 자주 사용된다.

---

### 3.4.5 객체와 전개 구문

전개 구문 `...`은 객체의 속성을 펼쳐서 새로운 객체를 만들 때 사용할 수 있다.

![객체 전개 구문 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 153820.png>)

```js
const obj = { b: 2, c: 3, d: 4 }

// obj의 속성을 펼쳐서 새 객체 안에 넣는다.
const newObj = { a: 1, ...obj, e: 5 }

console.log(newObj) // { a: 1, b: 2, c: 3, d: 4, e: 5 }
```

객체 전개 구문은 원본 객체를 직접 수정하지 않고 새로운 객체를 만들 때 자주 사용된다. 다만 이것은 얕은 복사라는 점을 기억해야 한다. 최상위 속성은 새로 복사되지만, 중첩 객체나 배열은 내부 참조를 공유할 수 있다.

⚠️ 주의: 전개 구문으로 복사한 객체 안에 중첩 객체가 있으면, 그 중첩 객체는 원본과 복사본이 같은 대상을 바라볼 수 있다. 깊은 복사가 필요한 상황에서는 별도의 방법을 사용해야 한다.

---

### 3.4.6 유용한 객체 메서드

객체의 key, value, key-value 쌍을 배열 형태로 얻고 싶을 때는 `Object.keys()`, `Object.values()`, `Object.entries()`를 사용할 수 있다.

![Object.keys, values, entries 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 154621.png>)

```js
const profile = {
  name: 'Alice',
  age: 30,
}

console.log(Object.keys(profile))
// ['name', 'age']

console.log(Object.values(profile))
// ['Alice', 30]

console.log(Object.entries(profile))
// [['name', 'Alice'], ['age', 30]]
```

이 메서드들은 객체를 배열처럼 순회하고 싶을 때 유용하다. 예를 들어 객체의 모든 key를 출력하거나, 객체의 모든 값을 검증하거나, key-value 쌍을 화면에 렌더링해야 할 때 사용할 수 있다.

---

### 3.4.7 Optional chaining `?.`

Optional chaining은 중첩 객체의 속성에 안전하게 접근하는 문법이다. 참조 대상이 `null` 또는 `undefined`라면 에러를 발생시키는 대신 평가를 멈추고 `undefined`를 반환한다.

![Optional chaining 기본 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 154734.png>)

```js
const user = {
  name: 'Alice',
  greeting() {
    return 'hello'
  },
}

// address가 없으므로 일반 접근은 에러가 날 수 있다.
// console.log(user.address.street)

// Optional chaining을 사용하면 안전하게 undefined를 반환한다.
console.log(user.address?.street) // undefined
```

Optional chaining을 사용하지 않으면 `&&` 연산자를 여러 번 연결해야 했다.

![Optional chaining을 사용하지 않는 경우](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 155002.png>)

```js
const result = user.address && user.address.street
```

Optional chaining은 이를 훨씬 짧고 읽기 쉽게 만든다.

```js
const result = user.address?.street
```

하지만 모든 접근에 Optional chaining을 남용하면 오히려 문제가 숨겨질 수 있다.

![Optional chaining 남용 주의](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 155825.png>)

```js
const user = null

// user가 없을 수 있는 상황이라면 괜찮다.
console.log(user?.name) // undefined
```

Optional chaining 앞의 변수는 반드시 선언되어 있어야 한다.

![Optional chaining 변수 선언 주의](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 155859.png>)

```js
// 선언되지 않은 변수에는 optional chaining을 사용할 수 없다.
// console.log(myObj?.address) // ReferenceError
```

정리하면 다음과 같다.

| 문법 | 의미 |
|---|---|
| `obj?.prop` | `obj`가 존재하면 `obj.prop`, 없으면 `undefined` |
| `obj?.[prop]` | `obj`가 존재하면 `obj[prop]`, 없으면 `undefined` |
| `obj?.method()` | `obj.method`가 존재하면 호출, 없으면 `undefined` |

⚠️ 주의: Optional chaining은 “없어도 괜찮은 값”에만 사용해야 한다. 반드시 있어야 하는 값인데도 `?.`로 넘겨버리면 오류를 발견하기 어려워질 수 있다.

---

## 3.5 배열 Array

배열은 순서가 있는 데이터 집합을 저장하는 자료 구조다. 객체가 key로 데이터를 관리한다면, 배열은 인덱스로 데이터를 관리한다.

```js
const names = ['Alice', 'Bella', 'Cathy']

console.log(names[0]) // Alice
console.log(names[1]) // Bella
console.log(names.length) // 3
```

![배열 구조와 length](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 161006.png>)

배열은 대괄호 `[]`로 만들고, 내부 요소의 자료형에는 제한이 없다. 문자열만 들어갈 수도 있고, 객체 배열처럼 객체가 여러 개 들어갈 수도 있다.

```js
const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bella' },
]
```

실제 웹 개발에서는 단순 문자열 배열보다 객체 배열을 훨씬 많이 다룬다. 게시글 목록, 댓글 목록, 상품 목록은 대부분 객체들이 들어 있는 배열 형태로 표현된다.

---

### 3.5.1 배열 기본 조작 메서드

배열에는 요소를 추가하거나 제거하는 기본 메서드가 있다.

| 메서드 | 동작 | 반환값 | 원본 배열 변경 여부 |
|---|---|---|---|
| `push()` | 배열 끝에 요소 추가 | 추가 후 배열 길이 | 변경함 |
| `pop()` | 배열 끝 요소 제거 | 제거한 요소 | 변경함 |
| `unshift()` | 배열 앞에 요소 추가 | 추가 후 배열 길이 | 변경함 |
| `shift()` | 배열 앞 요소 제거 | 제거한 요소 | 변경함 |

먼저 `push()`는 배열 끝에 요소를 추가한다.

![push 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 161111.png>)

```js
const names = ['Alice', 'Bella', 'Cathy']

// 배열 끝에 Dan을 추가한다.
const result = names.push('Dan')

console.log(names) // ['Alice', 'Bella', 'Cathy', 'Dan']
console.log(result) // 4
```

`pop()`은 배열 끝 요소를 제거하고, 제거한 요소를 반환한다.

![pop 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 161146.png>)

```js
const names = ['Alice', 'Bella', 'Cathy']

const removed = names.pop()

console.log(removed) // Cathy
console.log(names) // ['Alice', 'Bella']
```

`unshift()`는 배열 앞에 요소를 추가한다.

![unshift 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 161240.png>)

```js
const names = ['Alice', 'Bella', 'Cathy']

names.unshift('Eric')

console.log(names) // ['Eric', 'Alice', 'Bella', 'Cathy']
```

`shift()`는 배열 앞 요소를 제거한다.

![shift 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 161335.png>)

```js
const names = ['Eric', 'Alice', 'Bella', 'Cathy']

const removed = names.shift()

console.log(removed) // Eric
console.log(names) // ['Alice', 'Bella', 'Cathy']
```

⚠️ 주의: `push`, `pop`, `unshift`, `shift`는 모두 원본 배열을 직접 수정한다. 특히 `unshift`와 `shift`는 배열의 모든 요소를 한 칸씩 밀거나 당겨야 하므로 배열이 커질수록 성능 부담이 커질 수 있다.

---

## 3.6 콜백 함수

콜백 함수는 다른 함수의 인자로 전달되어, 특정 시점에 호출되는 함수다.

```text
콜백 함수 = 나중에 실행할 일을 함수 형태로 미리 넘겨두는 것
```

강의에서는 콜백 함수를 진동벨에 비유했다.

1. 카페에서 커피를 주문한다.
2. 직원이 진동벨을 준다.
3. 우리는 자리에 앉아 다른 일을 한다.
4. 커피가 완성되면 직원이 진동벨을 울린다.

이때 진동벨이 콜백 함수에 해당한다. 우리가 직접 계속 확인하지 않아도, 특정 시점이 되면 미리 전달한 동작이 실행된다.

---

### 3.6.1 콜백 함수의 기본 동작 원리

콜백 함수는 배열에서만 사용하는 것이 아니다. 일반 함수에서도 사용할 수 있다.

![콜백 함수 기본 구조](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 161712.png>)

```js
// 1. 인자로 받을 함수를 먼저 정의한다.
const greeting = function (name) {
  console.log(`Hello, ${name}`)
}

// 2. 콜백 함수를 인자로 받는 함수를 정의한다.
const processUserInput = function (callback) {
  const name = 'Alice'

  // 3. 전달받은 함수를 필요한 시점에 실행한다.
  callback(name)
}

processUserInput(greeting) // Hello, Alice
```

여기서 중요한 것은 함수의 실행 권한을 다른 함수에게 넘긴다는 점이다. `greeting`을 바로 실행하는 것이 아니라, `processUserInput`에게 넘겨서 그 함수 안에서 필요한 시점에 실행하게 한다.

---

### 3.6.2 콜백을 사용하는 이유 1: 기능의 유연성

콜백 함수를 사용하면 전체 구조는 그대로 두고, 세부 동작만 바꿔 끼울 수 있다.

![계산기 콜백 함수 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 161812.png>)

```js
// 계산의 뼈대는 calculator가 담당한다.
const calculator = function (a, b, action) {
  return action(a, b)
}

// 실제 계산 로직은 콜백 함수로 분리한다.
const add = function (a, b) {
  return a + b
}

const sub = function (a, b) {
  return a - b
}

console.log(calculator(10, 20, add)) // 30
console.log(calculator(10, 20, sub)) // -10
```

계산기 함수 안에 더하기, 빼기, 곱하기, 나누기를 모두 넣으면 함수가 복잡해진다. 대신 계산하는 로직만 콜백으로 바꾸면, 뼈대는 유지하면서 동작을 유연하게 바꿀 수 있다.

---

### 3.6.3 콜백을 사용하는 이유 2: 시점 제어

콜백 함수는 시간이 걸리는 작업이 끝난 뒤 실행할 동작을 등록할 때도 사용된다. 대표적인 예시가 `setTimeout()`이다.

![setTimeout 콜백 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-11 161941.png>)

```js
console.log('시작')

// 1000ms 뒤에 콜백 함수를 실행한다.
setTimeout(function () {
  console.log('1초 뒤 실행')
}, 1000)

console.log('끝')
```

이 코드는 “기다린 다음 실행할 함수”를 `setTimeout`에게 전달하는 구조다. 이런 방식은 이후 비동기 처리, 이벤트 처리, Axios 요청 처리와도 연결된다.

📌 핵심: 콜백 함수는 함수를 값처럼 전달하고, 받은 쪽에서 필요한 시점에 실행하는 구조다.

---

## 3.7 Array Helper Methods

Array Helper Methods는 배열을 순회하며 특정 로직을 수행하는 고차 함수 모음이다. 여기서 고차 함수란 함수를 인자로 받거나 함수를 반환하는 함수를 말한다.

과거에는 배열을 순회하려면 `for` 반복문으로 인덱스를 직접 제어해야 했다.

```js
const names = ['Alice', 'Bella', 'Cathy']

for (let i = 0; i < names.length; i++) {
  console.log(names[i])
}
```

하지만 Array Helper Methods를 사용하면 “어떻게 인덱스를 증가시킬지”보다 “각 요소에 무엇을 할지”에 집중할 수 있다.

```js
names.forEach((name) => {
  console.log(name)
})
```

이번 강의에서 중심적으로 다룬 메서드는 다음과 같다.

| 목적 | 메서드 | 핵심 역할 |
|---|---|---|
| 순회 | `forEach` | 각 요소에 대해 콜백을 실행한다. |
| 변형 | `map` | 각 요소를 변형해 새 배열을 만든다. |
| 선별 | `filter` | 조건을 만족하는 요소만 모아 새 배열을 만든다. |
| 집계 | `reduce` | 배열을 하나의 결과값으로 줄인다. |

---

## 3.8 `forEach`

`forEach`는 배열의 모든 요소를 하나씩 훑으면서, 전달한 콜백 함수를 실행하는 메서드다.

```text
forEach = 배열의 모든 요소에 대해 “이 동작을 실행해줘”
```

반환값은 없다. 즉, `forEach`는 새로운 배열을 만드는 용도가 아니라 단순 실행용이다.

---

### 3.8.1 `forEach` 구조

![forEach 구조](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-15 010313.png>)

```js
array.forEach(function (item, index, array) {
  // item: 현재 처리 중인 요소
  // index: 현재 요소의 인덱스
  // array: forEach를 호출한 원본 배열
})
```

매개변수는 세 개까지 받을 수 있지만, 실제로는 `item`만 사용하는 경우가 가장 많다.

---

### 3.8.2 화살표 함수와 함께 사용하기

콜백 함수는 보통 간단한 로직인 경우가 많기 때문에 화살표 함수와 함께 사용하면 코드가 더 짧아진다.

![forEach와 화살표 함수](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-15 010532.png>)

```js
const names = ['Alice', 'Bella', 'Cathy']

// 각 이름을 하나씩 출력한다.
names.forEach((name) => {
  console.log(name)
})
```

매개변수를 활용하면 현재 요소, 인덱스, 원본 배열을 함께 확인할 수 있다.

![forEach 매개변수 활용](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-15 013323.png>)

```js
const names = ['Alice', 'Bella', 'Cathy']

names.forEach((name, index, array) => {
  console.log(`${index}번째 이름: ${name}`)
  console.log(array)
})
```

---

### 3.8.3 `forEach` 주의사항

`forEach`는 반환값이 없다. 따라서 결과를 변수에 담으면 `undefined`가 나온다.

```js
const numbers = [1, 2, 3]

const result = numbers.forEach((number) => {
  return number * 2
})

console.log(result) // undefined
```

또한 `forEach`는 중간에 `break`나 `continue`로 멈추기 어렵다. 중간에 멈춰야 하는 순회라면 `for...of` 반복문을 사용하는 편이 더 적절하다.

⚠️ 주의: 새로운 배열을 만들고 싶다면 `forEach`가 아니라 `map`을 사용해야 한다. `forEach`는 “반복 실행”이 목적이고, `map`은 “변환 결과 배열 생성”이 목적이다.

---

## 3.9 `map`

`map`은 배열의 모든 요소를 하나씩 꺼내어 가공한 뒤, 그 결과를 모아 새로운 배열을 반환하는 메서드다.

```text
map = 원본 배열의 각 요소를 1:1로 변형해 새 배열 만들기
```

원본 배열의 요소 개수와 결과 배열의 요소 개수는 항상 같다.

---

### 3.9.1 `map` 구조와 핵심

![map 구조](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-15 013833.png>)

`map`의 구조는 `forEach`와 거의 같다. 차이는 콜백 함수의 반환값을 모아 새 배열을 만든다는 점이다.

![map에서 return 필요](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-15 013923.png>)

```js
const numbers = [1, 2, 3]

// 각 숫자를 2배로 만든 새 배열을 반환한다.
const doubled = numbers.map((number) => {
  return number * 2
})

console.log(doubled) // [2, 4, 6]
console.log(numbers) // [1, 2, 3]
```

여기서 `map`은 원본 배열을 수정하지 않는다. 대신 완전히 새로운 배열을 반환한다.

---

### 3.9.2 `map`을 사용하는 이유

`map`은 “배열에서 특정 값만 뽑아 새 배열을 만들고 싶을 때” 특히 유용하다.

![for of와 map 비교](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-15 014057.png>)

```js
const persons = [
  { name: 'Alice', age: 20 },
  { name: 'Bella', age: 25 },
]

// persons 배열에서 name만 뽑아 새 배열을 만든다.
const names = persons.map((person) => {
  return person.name
})

console.log(names) // ['Alice', 'Bella']
```

`for...of`로도 같은 결과를 만들 수 있지만, 빈 배열을 만들고 `push`하는 과정이 필요하다. 반면 `map`은 “이 배열을 가공해서 새 배열을 만들겠다”는 목적이 코드 자체에 드러난다.

---

### 3.9.3 실전 활용: 화살표 함수와 체이닝

콜백 함수의 본문이 한 줄이면 중괄호와 `return`을 생략할 수 있다.

![map 한 줄 표현 예시 1](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 103116.png>)

![map 한 줄 표현 예시 2](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 103308.png>)

```js
const numbers = [1, 2, 3]

// 한 줄 화살표 함수에서는 return을 생략할 수 있다.
const doubled = numbers.map((number) => number * 2)

console.log(doubled) // [2, 4, 6]
```

`map`은 배열을 반환하므로 다른 배열 메서드와 이어서 사용할 수 있다. 이를 메서드 체이닝이라고 한다.

```js
const numbers = [1, 2, 3, 4, 5]

const result = numbers
  .filter((number) => number % 2 === 1)
  .map((number) => number * 2)

console.log(result) // [2, 6, 10]
```

---

### 3.9.4 커스텀 콜백 함수 사용

콜백 함수를 따로 정의해두면 여러 곳에서 재사용할 수 있다.

![커스텀 콜백 함수 사용](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 103345.png>)

```js
const numbers = [1, 2, 3]

const doubleNumber = function (number) {
  return number * 2
}

const result = numbers.map(doubleNumber)

console.log(result) // [2, 4, 6]
```

콜백 함수가 복잡해지거나 여러 곳에서 사용된다면, 이렇게 따로 이름을 붙여두는 편이 가독성에 좋다.

---

### 3.9.5 Python `map`과 JavaScript `map`

Python에도 `map`이 있다. 개념적으로는 비슷하지만 문법에는 차이가 있다.

![Python map과 JavaScript map 비교](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 103451.png>)

```python
# Python
numbers = [1, 2, 3]
result = list(map(lambda number: number * 2, numbers))
```

```js
// JavaScript
const numbers = [1, 2, 3]
const result = numbers.map((number) => number * 2)
```

Python은 `map(함수, 리스트)` 형태이고, 결과를 리스트로 보려면 `list()` 형변환이 필요하다. JavaScript는 `배열.map(함수)` 형태이며, 바로 새 배열을 반환한다.

📌 핵심: `map`은 원본 배열을 바꾸지 않고, 각 요소를 변형한 새 배열을 만든다.

---

## 3.10 `filter`

`filter`는 배열에서 조건을 만족하는 요소만 걸러내어 새로운 배열을 만드는 메서드다.

```text
filter = 조건을 통과한 요소만 남기기
```

콜백 함수가 `true`를 반환하면 해당 요소는 결과 배열에 포함되고, `false`를 반환하면 제외된다.

---

### 3.10.1 `filter` 구조와 동작 원리

![filter 구조](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 103625.png>)

![filter 동작 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 103731.png>)

```js
const numbers = [1, 2, 3, 4, 5]

// 짝수만 남긴 새 배열을 만든다.
const evens = numbers.filter((number) => {
  return number % 2 === 0
})

console.log(evens) // [2, 4]
```

`filter`의 콜백 함수는 반드시 조건식을 반환해야 한다. 반환값이 `true`처럼 평가되면 유지하고, `false`처럼 평가되면 버린다.

---

### 3.10.2 `map`과 `filter`의 차이

`map`과 `filter`는 모두 새 배열을 반환하지만 목적이 다르다.

![map과 filter 비교](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 103803.png>)

| 메서드 | 목적 | 결과 배열 길이 |
|---|---|---|
| `map` | 모든 요소를 변형한다. | 원본과 같음 |
| `filter` | 조건에 맞는 요소만 남긴다. | 원본보다 작거나 같음 |

```js
const numbers = [1, 2, 3]

const doubled = numbers.map((number) => number * 2)
console.log(doubled) // [2, 4, 6]

const odds = numbers.filter((number) => number % 2 === 1)
console.log(odds) // [1, 3]
```

조건을 만족하는 요소가 하나도 없다면 `null`이 아니라 빈 배열 `[]`을 반환한다.

---

### 3.10.3 실전 활용: 삭제 처리

프론트엔드에서 배열 데이터를 삭제할 때는 실제로 원본 배열에서 직접 제거하기보다, 삭제할 항목을 제외한 새 배열을 만드는 방식을 많이 사용한다.

![filter를 활용한 삭제 처리](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 103920.png>)

```js
const cart = [
  { id: 1, name: 'computer' },
  { id: 2, name: 'keyboard' },
  { id: 3, name: 'mouse' },
]

const deleteId = 2

// id가 2인 상품을 제외한 새 배열을 만든다.
const newCart = cart.filter((item) => {
  return item.id !== deleteId
})

console.log(newCart)
```

이 패턴은 Vue나 React에서 상태를 업데이트할 때 자주 등장한다. 원본 배열을 직접 바꾸기보다 새 배열로 교체하면 변경 흐름이 더 명확해진다.

---

### 3.10.4 기타 유용한 배열 메서드

강의에서는 MDN 문서를 참고해 다른 배열 메서드도 살펴볼 수 있다고 정리했다.

![기타 Array Helper Methods](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 103953.png>)

대표적으로 `find`, `some`, `every`, `includes` 같은 메서드가 있다. 이들은 모두 배열을 순회하지만 목적이 다르므로, 실제 구현에서는 “새 배열이 필요한가?”, “하나만 찾으면 되는가?”, “조건 만족 여부만 알면 되는가?”를 기준으로 선택하면 된다.

---

## 3.11 배열과 전개 구문

배열에서도 전개 구문 `...`을 사용할 수 있다. 배열의 괄호를 벗기고 안의 요소들을 펼치는 문법이라고 이해하면 쉽다.

![배열 전개 구문](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 104111.png>)

```js
const arr1 = [1, 2]
const arr2 = [3, 4]

// 두 배열을 합쳐 새 배열을 만든다.
const combined = [...arr1, ...arr2]

console.log(combined) // [1, 2, 3, 4]
```

전개 구문은 배열을 합치거나 중간에 요소를 삽입할 때 유용하다.

```js
const numbers = [1, 2, 5]

const newNumbers = [0, ...numbers, 6]

console.log(newNumbers) // [0, 1, 2, 5, 6]
```

전개 구문 역시 새로운 배열을 만든다. 원본 배열은 변경되지 않는다. 다만 배열 안에 객체가 들어 있는 경우에는 객체 자체가 복사되는 것이 아니라 주소 값이 복사된다. 그래서 복사본의 객체를 수정하면 원본 내부 객체도 영향을 받을 수 있다.

⚠️ 주의: 배열 전개 구문도 얕은 복사다. 배열 안에 객체가 들어 있다면 내부 객체까지 완전히 독립적으로 복사되는 것은 아니다.

---

## 3.12 배열 순회 종합

배열을 순회하는 방식은 여러 가지가 있다. 중요한 것은 특정 방식 하나만 무조건 사용하는 것이 아니라, 상황에 맞는 도구를 고르는 것이다.

![배열 순회 정리](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 104134.png>)

![Array Helper Methods 정리](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 104214.png>)

정리하면 다음과 같다.

| 원하는 작업 | 적절한 도구 |
|---|---|
| 단순히 각 요소마다 실행만 하고 싶다. | `forEach` |
| 모든 요소를 변형해 새 배열을 만들고 싶다. | `map` |
| 조건에 맞는 요소만 남기고 싶다. | `filter` |
| 배열 전체를 하나의 값으로 누적하고 싶다. | `reduce` |
| 중간에 멈춰야 한다. | `for...of` 또는 일반 반복문 |

`forEach`, `map`, `filter`는 구조가 비슷하기 때문에 처음에는 헷갈릴 수 있다. 이때 반환값의 의미를 기준으로 구분하면 좋다.

- `forEach`: 반환값을 사용하지 않는다.
- `map`: 콜백의 반환값을 모아 새 배열을 만든다.
- `filter`: 콜백의 true/false 결과로 요소를 남길지 결정한다.

---

## 3.13 `reduce`

`reduce`는 배열의 요소를 하나씩 처리하면서 결국 하나의 결과값으로 합치는 메서드다.

```text
reduce = 배열을 하나의 값으로 줄이기
```

강의에서는 `reduce`를 눈덩이 굴리기에 비유했다. 처음에는 작은 눈덩이, 즉 초기값이 있고, 배열의 요소를 하나씩 처리하면서 눈덩이가 점점 커져 최종 결과가 된다.

---

### 3.13.1 `reduce` 구조

![reduce 구조](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 104401.png>)

```js
arr.reduce((acc, cur, index, array) => {
  // acc: 이전 단계까지 누적된 값
  // cur: 현재 처리 중인 요소
  // index: 현재 인덱스
  // array: 원본 배열
  return 다음_acc_값
}, initialValue)
```

필수적으로 이해해야 하는 값은 세 가지다.

| 요소 | 의미 |
|---|---|
| `acc` | 누적값. 이전 단계에서 return한 값이 다음 단계의 acc가 된다. |
| `cur` | 현재 처리 중인 배열 요소다. |
| `initialValue` | 누적을 시작할 초기값이다. 생략 가능하지만 명시하는 것이 안전하다. |

---

### 3.13.2 숫자 합계 구하기

가장 기본적인 예시는 숫자 배열의 합계를 구하는 것이다.

![reduce 숫자 합계 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 104600.png>)

```js
const numbers = [1, 2, 3, 4]

const total = numbers.reduce((acc, cur) => {
  // 이전 누적값 acc에 현재 값 cur을 더해서 다음 acc로 넘긴다.
  return acc + cur
}, 0)

console.log(total) // 10
```

처음 `acc`는 초기값인 `0`이다. 첫 번째 요소 `1`을 더해 `1`이 되고, 다음 단계에서는 그 `1`이 다시 `acc`가 된다. 이 흐름이 배열 끝까지 반복된다.

---

### 3.13.3 등장 횟수 세기

`reduce`는 숫자뿐 아니라 객체를 누적값으로 사용할 수도 있다. 예를 들어 이름 배열을 `{ 이름: 횟수 }` 형태의 객체로 바꿀 수 있다.

![reduce로 등장 횟수 세기](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 104645.png>)

```js
const names = ['Alice', 'Bob', 'Alice', 'Charlie', 'Bob']

const counts = names.reduce((acc, name) => {
  // acc[name]이 이미 있으면 1을 더하고, 없으면 1로 시작한다.
  acc[name] = (acc[name] || 0) + 1

  // 다음 단계의 acc로 같은 객체를 넘긴다.
  return acc
}, {})

console.log(counts)
// { Alice: 2, Bob: 2, Charlie: 1 }
```

이 패턴은 데이터를 그룹핑하거나 통계를 낼 때 유용하다.

---

### 3.13.4 `reduce`로 `map`과 `filter` 구현하기

`reduce`는 강력한 메서드라서 `map`과 `filter`의 기능을 함께 구현할 수도 있다.

![reduce로 filter와 map 동시에 처리](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 104821.png>)

```js
const numbers = [1, 2, 3, 4, 5]

const result = numbers.reduce((acc, number) => {
  // 짝수만 골라서
  if (number % 2 === 0) {
    // 2배로 만든 뒤 누적 배열에 추가한다.
    acc.push(number * 2)
  }

  return acc
}, [])

console.log(result) // [4, 8]
```

한 번의 순회로 필터링과 변형을 동시에 할 수 있다는 장점이 있지만, 코드가 복잡해질 수 있다. 가독성이 중요하다면 `filter().map()` 체이닝이 더 좋을 수 있다.

⚠️ 주의: `reduce`는 강력하지만 초반에는 `acc`와 `cur`의 흐름을 놓치기 쉽다. 단순 변형은 `map`, 단순 선별은 `filter`를 먼저 고려하고, 누적·집계가 필요할 때 `reduce`를 사용하는 방식으로 접근하면 좋다.

---

## 3.14 `forEach`가 중요한 이유

기능적으로는 `for...of` 반복문만 있어도 배열을 순회할 수 있다. 그럼에도 `forEach`와 같은 배열 메서드 방식이 중요한 이유는, 모던 웹 개발에서 이런 코드 스타일을 매우 자주 사용하기 때문이다.

Vue, React, Axios, 이벤트 처리, 비동기 처리에서는 “메서드에 콜백 함수를 전달하는 구조”가 반복해서 등장한다. `forEach`는 단순 배열 순회 문법이 아니라, 이 구조에 익숙해지는 기초 체력에 가깝다.

---

### 3.14.1 선언형 프로그래밍

`for...of`는 어떻게 순회할지를 직접 제어하는 명령형 방식에 가깝다.

```js
for (const name of names) {
  console.log(name)
}
```

반면 `forEach`는 각 요소에 무엇을 할지만 콜백으로 전달한다.

```js
names.forEach((name) => {
  console.log(name)
})
```

이런 방식을 선언형 프로그래밍이라고 볼 수 있다. “어떻게 반복할지”보다 “무엇을 할지”가 코드에서 더 잘 드러난다. Vue와 React는 이런 선언형 스타일을 지향하기 때문에, 배열 메서드에 익숙해지는 것이 중요하다.

---

### 3.14.2 Vue와 Axios 미리보기

강의에서는 앞으로 배우게 될 Vue와 Axios에서도 비슷한 구조가 등장한다고 정리했다.

![Vue와 Axios 미리보기](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 105306.png>)

예를 들어 Axios 요청도 `.then()`에 콜백 함수를 전달하는 구조로 볼 수 있다.

```js
axios.get('/articles/')
  .then((response) => {
    // 요청이 성공했을 때 실행할 콜백
    console.log(response.data)
  })
  .catch((error) => {
    // 요청이 실패했을 때 실행할 콜백
    console.log(error)
  })
```

이 구조는 배열 메서드에서 배운 “메서드 + 콜백 함수” 패턴과 매우 비슷하다. 그래서 `forEach`, `map`, `filter`를 잘 이해해두면 Vue와 Axios 코드를 읽을 때 훨씬 덜 낯설다.

---

## 3.15 배열은 객체다

JavaScript에서 배열은 사실 특수한 객체다. 배열의 요소를 대괄호로 접근하는 것도 객체의 대괄호 접근과 같은 원리로 이해할 수 있다.

![배열은 객체다](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 105433.png>)

```js
const names = ['Alice', 'Bella', 'Cathy']

console.log(names[0]) // Alice
console.log(names.length) // 3
```

배열은 숫자형 인덱스를 key처럼 사용하고, `length` 속성을 가진다. 여기에 순서가 있는 컬렉션을 다루기 위한 특별한 메서드들이 제공된다.

객체와 배열을 완전히 다른 것으로만 보면 헷갈릴 수 있다. 배열도 객체의 한 종류라는 관점을 잡으면, 왜 배열에 속성처럼 `length`가 있고, 메서드처럼 `map`, `filter`를 호출할 수 있는지 이해하기 쉽다.

---

## 3.16 클래스 Class

class는 객체를 생성하기 위한 템플릿이다. 객체의 속성과 메서드를 미리 정의해두는 설계도라고 볼 수 있다.

강의에서는 클래스를 붕어빵 틀에 비유했다. 붕어빵을 하나 만들 때마다 손으로 직접 모양을 빚으면 비효율적이다. 대신 붕어빵 틀이 있으면 같은 구조의 붕어빵을 여러 개 만들 수 있다. class도 이와 비슷하게 같은 구조의 객체를 반복해서 만들 수 있게 해준다.

![class 기본 구조](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 105856.png>)

```js
class Member {
  // constructor는 new로 객체를 만들 때 자동으로 호출된다.
  constructor(name, age) {
    this.name = name
    this.age = age
  }

  // class 안에 메서드를 정의할 수 있다.
  introduce() {
    return `제 이름은 ${this.name}이고, 나이는 ${this.age}살입니다.`
  }
}
```

---

### 3.16.1 클래스 기본 문법

클래스를 구성하는 핵심 요소는 다음과 같다.

| 요소 | 의미 |
|---|---|
| `class` 키워드 | 객체의 설계도인 클래스를 정의한다. |
| 클래스 이름 | 일반적으로 PascalCase로 작성한다. |
| `constructor()` | `new`로 객체를 생성할 때 자동으로 호출되어 초기 속성을 설정한다. |
| 메서드 | 생성된 객체가 사용할 동작을 정의한다. |

class도 호이스팅과 관련이 있다. 선언 자체는 끌어올려지는 것처럼 처리되지만, 선언 전에 접근하면 TDZ 때문에 에러가 발생한다.

```js
// const, let처럼 class도 선언 전에 사용하면 에러가 발생한다.
// const member = new Member('Alice', 20)

class Member {
  constructor(name, age) {
    this.name = name
    this.age = age
  }
}
```

TDZ는 Temporal Dead Zone의 약자로, 선언 전에 변수나 클래스에 접근할 수 없는 일시적 사각지대를 의미한다.

---

### 3.16.2 클래스의 특징

class 문법은 ES6에서 도입되었다. 기존에도 생성자 함수를 사용해 객체를 만들 수 있었지만, class는 이 방식을 더 명확하고 객체 지향적으로 표현하기 위해 도입된 문법이다.

![class 특징](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 105945.png>)

내부적으로는 생성자 함수 기반으로 동작하지만, 코드 작성자는 class 문법을 통해 “객체를 만들기 위한 설계도”라는 의도를 더 분명하게 표현할 수 있다.

---

### 3.16.3 클래스 활용과 `new` 연산자

객체를 만들 때는 `new` 키워드를 사용한다. `new`는 새 객체를 만들고, class 안의 `constructor()`를 자동으로 호출한다.

![class 활용 예시](<../assets/images/05_18_Basic_Syntax_2/화면 캡처 2026-06-17 110034.png>)

```js
class Member {
  constructor(name, age) {
    this.name = name
    this.age = age
  }

  introduce() {
    return `제 이름은 ${this.name}입니다.`
  }
}

// new를 사용해 Member 클래스로부터 객체를 생성한다.
const member1 = new Member('Alice', 20)
const member2 = new Member('Bella', 25)

console.log(member1.name) // Alice
console.log(member2.introduce()) // 제 이름은 Bella입니다.
```

`new` 없이 class를 호출하면 TypeError가 발생한다.

```js
// const member = Member('Alice', 20) // TypeError
```

class의 메서드 안에서 사용하는 `this`는 해당 메서드를 호출한 인스턴스를 가리킨다. 예를 들어 `member2.introduce()`를 호출하면, 그 안의 `this`는 `member2`가 된다.

📌 핵심: class는 객체를 만들기 위한 설계도이고, `new`는 그 설계도를 바탕으로 실제 객체를 생성하는 연산자다.

---

## 4. 적용 관점에서 다시 보기

이번 강의 내용은 JavaScript 문법 자체로 끝나지 않고, 이후 프론트엔드 개발의 거의 모든 데이터 처리 흐름에 연결된다.

먼저 객체는 사용자 정보, 게시글 상세 정보, 로그인 응답, 설정 값처럼 의미 있는 데이터 묶음을 표현할 때 사용한다. 객체를 볼 때는 key를 기준으로 데이터의 의미를 파악하고, 점 표기법과 대괄호 표기법 중 어떤 접근이 적절한지 판단해야 한다. key가 고정되어 있으면 점 표기법, 변수로 key를 다뤄야 하면 대괄호 표기법을 떠올리면 된다.

메서드와 `this`는 객체 내부 동작을 이해하는 기준이다. 특히 `this`는 선언 위치가 아니라 호출 방식으로 결정된다는 점이 중요하다. 일반 함수 호출인지, 객체 메서드 호출인지, 콜백 함수 내부인지에 따라 `this`가 달라질 수 있다. 콜백 안에서 바깥 객체의 `this`를 유지해야 한다면 화살표 함수를 고려한다.

JSON은 API 통신과 직접 연결된다. 서버에서 받은 데이터가 JSON 형태라면 JavaScript에서 객체로 다뤄야 하고, JavaScript 객체를 서버에 보낼 때는 JSON 문자열로 직렬화해야 하는 경우가 있다. `JSON.stringify()`와 `JSON.parse()`는 이 변환의 기준이 된다.

배열은 목록 데이터를 처리할 때 사용한다. 게시글 목록, 댓글 목록, 상품 목록, Todo 목록은 대부분 배열이다. 목록을 화면에 출력하거나, 특정 항목만 남기거나, 필요한 값만 뽑아내려면 Array Helper Methods를 선택해야 한다.

실전에서는 다음 기준으로 메서드를 고르면 된다.

- 각 요소마다 실행만 한다면 `forEach`
- 새 배열로 변형한다면 `map`
- 조건에 맞는 요소만 남긴다면 `filter`
- 합계, 통계, 그룹핑처럼 하나의 결과로 모은다면 `reduce`
- 중간에 멈춰야 한다면 `for...of`

전개 구문은 원본 데이터를 직접 수정하지 않고 새로운 배열이나 객체를 만들 때 자주 사용한다. Vue나 React처럼 상태 변경을 감지해야 하는 환경에서는 원본을 직접 바꾸는 것보다 새 배열, 새 객체로 교체하는 패턴이 중요해진다.

마지막으로 class는 같은 구조의 객체를 여러 개 생성할 때 사용한다. 모든 상황에서 class가 필요한 것은 아니지만, 객체의 속성과 메서드를 하나의 설계도로 묶어야 하는 상황에서는 class 문법이 유용하다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

객체와 배열은 단순히 값을 묶는 문법이 아니라, 실제 웹 서비스 데이터를 표현하는 기본 구조라는 점이 중요하다. 특히 객체에서는 key를 기준으로 의미 있는 데이터를 관리하고, 배열에서는 순서가 있는 목록 데이터를 관리한다는 차이를 분명히 잡을 수 있다.

`this`는 JavaScript에서 가장 헷갈리기 쉬운 개념 중 하나지만, “누가 점을 찍어 호출했는가?”라는 기준으로 보면 훨씬 이해하기 쉬워진다. 또한 콜백 함수 안에서는 일반 함수와 화살표 함수의 `this` 동작이 달라질 수 있다는 점을 새롭게 연결해서 이해할 수 있다.

### 5.2 앞으로 이어지는 연결점

이번 내용은 Vue의 상태 관리, Axios API 통신, Pinia store, DRF 응답 처리와 바로 이어진다. 서버에서 받은 게시글 목록은 배열로 처리하고, 각 게시글은 객체로 표현하며, 목록을 가공할 때는 `map`, `filter`, `forEach`가 반복적으로 사용된다.

또한 콜백 함수 구조는 이벤트 리스너, Promise의 `.then()`, Axios 요청, Vue의 반응형 로직을 이해하는 기반이 된다. 배열 메서드에 익숙해지는 것은 단순 문법 학습이 아니라, 모던 프론트엔드 코드 스타일에 적응하는 과정이다.

### 5.3 더 파볼 만한 주제

이번 강의에서 다룬 전개 구문과 얕은 복사는 이후 깊은 복사, 참조 타입, 불변성 개념으로 확장할 수 있다. 특히 Vue나 React에서 상태를 직접 수정하지 않고 새 객체나 새 배열을 만들어 교체하는 패턴을 이해하려면 이 부분을 더 깊게 살펴볼 필요가 있다.

또한 `reduce`는 강력하지만 복잡해지기 쉬우므로, 데이터 그룹핑, 합계 계산, 객체 변환 같은 실전 예제를 통해 acc의 흐름을 반복해서 연습하면 좋다. class는 생성자 함수, prototype, 상속 개념과 함께 보면 JavaScript 객체 시스템을 더 깊게 이해할 수 있다.

---

## 6. 요약 정리

📌 핵심

- 객체는 key-value 형태로 데이터를 저장하는 자료형이다.
- 객체 속성은 점 표기법 또는 대괄호 표기법으로 접근한다.
- 객체 자신의 속성 여부를 확인할 때는 `hasOwnProperty()`가 더 명확하다.
- 메서드는 객체 속성에 정의된 함수이며, `this`를 통해 객체 자신의 속성에 접근할 수 있다.
- JavaScript의 `this`는 선언 위치가 아니라 호출 방식에 따라 결정된다.
- 중첩 콜백에서 바깥 `this`를 유지하려면 화살표 함수를 사용할 수 있다.
- JSON은 객체처럼 생긴 문자열 데이터 형식이며, API 통신에서 자주 사용된다.
- `JSON.stringify()`는 객체를 JSON 문자열로, `JSON.parse()`는 JSON 문자열을 객체로 변환한다.
- 구조 분해 할당은 객체나 배열에서 필요한 값만 쉽게 꺼내는 문법이다.
- 전개 구문은 원본을 직접 수정하지 않고 새 객체나 새 배열을 만들 때 유용하다.
- Optional chaining은 중첩 객체에 안전하게 접근하는 문법이다.
- 배열은 순서가 있는 데이터 집합이며, JavaScript에서는 특수한 객체다.
- `forEach`는 단순 순회, `map`은 변형, `filter`는 선별, `reduce`는 누적과 집계에 사용한다.
- 콜백 함수는 함수를 인자로 전달하고, 받은 함수가 필요한 시점에 실행하는 구조다.
- class는 객체를 생성하기 위한 템플릿이며, `new`로 인스턴스를 만든다.

🧠 기억할 것

> `forEach`는 결과 배열을 만들지 않는다. 새 배열이 필요하면 `map` 또는 `filter`를 먼저 떠올린다.  
> `map`은 개수를 유지하며 변형하고, `filter`는 조건에 맞는 요소만 남긴다.  
> `this`가 헷갈리면 “누가 점을 찍어 호출했는가?”를 먼저 확인한다.  
> API 응답 데이터는 대부분 객체와 배열의 조합으로 들어오므로, 객체 접근과 배열 메서드는 Vue 학습의 기반이 된다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 객체에서 점 표기법과 대괄호 표기법은 각각 어떤 상황에서 사용하는가?
2. `'name' in user`와 `user.hasOwnProperty('name')`의 차이는 무엇인가?
3. JavaScript의 `this`가 Python의 `self`와 다르게 헷갈리는 이유는 무엇인가?
4. 객체 메서드 안의 `forEach` 콜백에서 일반 함수 대신 화살표 함수를 사용하면 어떤 점이 달라지는가?
5. `JSON.stringify()`와 `JSON.parse()`는 각각 언제 사용하는가?
6. 구조 분해 할당을 사용하면 어떤 반복 코드를 줄일 수 있는가?
7. Optional chaining을 남용하면 어떤 문제가 생길 수 있는가?
8. `push`, `pop`, `unshift`, `shift` 중 원본 배열을 수정하지 않는 메서드가 있는가?
9. `forEach`의 반환값은 무엇이며, 새 배열을 만들고 싶을 때 왜 적절하지 않은가?
10. `map`과 `filter`의 결과 배열 길이는 각각 원본 배열과 어떤 관계를 가지는가?
11. 장바구니에서 특정 상품을 삭제하는 기능을 만들 때 `filter`를 어떻게 활용할 수 있는가?
12. `reduce`에서 `acc`, `cur`, `initialValue`는 각각 어떤 역할을 하는가?
13. `forEach`와 같은 배열 메서드 방식이 Vue, Axios 학습과 연결되는 이유는 무엇인가?
14. 배열이 객체라는 말은 어떤 의미인가?
15. class에서 `constructor()`와 `new`는 각각 어떤 역할을 하는가?
