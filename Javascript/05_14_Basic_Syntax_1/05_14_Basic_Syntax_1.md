# JavaScript Basic Syntax 1

- 🎯 글의 목표: JavaScript의 기본 문법 중 데이터 타입, 연산자, 조건문, 반복문, 함수, 매개변수, 전개 구문, 화살표 함수의 흐름을 한 번에 정리한다.
- 🧩 핵심 키워드: Primitive Type, Reference Type, Number, String, Template Literal, null, undefined, Boolean, Type Conversion, Operator, `==`, `===`, Conditional Statement, Loop, `for...in`, `for...of`, Function Declaration, Function Expression, Hoisting, Default Parameter, Rest Parameter, Spread Syntax, Arrow Function, NaN
- ⭐ 중요도: ★★★★★  
  JavaScript와 Vue를 계속 학습하려면 가장 먼저 안정적으로 잡아야 하는 기본 문법이다. 특히 DOM 조작, 이벤트 처리, Axios 요청, Vue 컴포넌트 작성에서 변수·함수·반복문·배열·객체의 동작 방식이 계속 등장한다.
- 📝 한눈에 보는 내용:  
  이번 강의는 “JavaScript에서 값은 어떻게 저장되고, 조건과 반복은 어떻게 흐르며, 함수는 어떤 방식으로 정의하고 호출하는가?”라는 질문에서 출발한다. 먼저 원시 자료형과 참조 자료형의 차이를 이해하고, 숫자·문자열·null·undefined·Boolean 같은 기본 타입을 정리한다. 이후 연산자와 조건문, 반복문을 통해 코드 실행 흐름을 제어하는 방법을 익히고, 마지막에는 함수 선언식·표현식·화살표 함수·매개변수·전개 구문까지 연결해 JavaScript 문법의 뼈대를 세운다.
- 🔗 관련 문제 / 주제: JavaScript 기초 문법, DOM 조작, Vue Composition API, 배열/객체 순회, 이벤트 핸들러, 함수형 콜백, API 응답 데이터 처리

---

## 1. 들어가며

JavaScript를 처음 배울 때 가장 헷갈리는 지점은 문법 자체가 아니라, **값이 어떻게 저장되고 코드가 어떤 순서로 실행되는지**다. 예를 들어 숫자나 문자열을 변수에 넣는 것은 단순해 보이지만, 객체나 배열을 변수에 넣으면 이야기가 달라진다. 값 자체가 복사되는 것이 아니라 주소가 복사되기 때문에, 한쪽에서 수정한 내용이 다른 변수에도 영향을 줄 수 있다.

또 `==`와 `===`처럼 비슷해 보이는 연산자도 실제 동작 방식은 다르다. `==`는 타입을 자동으로 바꿔 비교하지만, `===`는 값과 타입을 모두 비교한다. 이 차이를 모르면 코드가 맞는 것처럼 보여도 예상하지 못한 결과가 나온다.

이번 강의는 JavaScript의 기본 문법을 한 줄씩 외우는 수업이 아니라, 앞으로 DOM과 Vue를 다룰 때 계속 사용할 기반을 만드는 과정이다. 데이터 타입을 이해하고, 조건문과 반복문으로 실행 흐름을 제어하며, 함수를 값처럼 다루는 JavaScript의 특징까지 연결해서 보면 이후 학습이 훨씬 편해진다.

---

## 2. 핵심 개념 정리

이번 강의의 큰 질문은 다음과 같다.

> JavaScript에서 값은 어떻게 저장되고, 코드는 어떤 기준으로 분기·반복·재사용되는가?

이 질문에 답하려면 먼저 데이터 타입을 이해해야 한다. JavaScript의 데이터는 크게 원시 자료형과 참조 자료형으로 나뉜다. 원시 자료형은 값 자체가 변수에 저장되는 방식이고, 참조 자료형은 객체가 저장된 메모리 주소를 변수에 저장하는 방식이다. 이 차이는 변수 복사, 객체 수정, 배열 순회, 함수 전달에서 계속 영향을 준다.

그다음에는 연산자와 조건문을 통해 값을 비교하고 흐름을 나누는 방법을 배운다. 특히 동등 연산자 `==`와 일치 연산자 `===`의 차이는 JavaScript에서 매우 중요하다. 자동 형변환이 들어가는 비교는 짧게는 편해 보이지만, 실제 프로젝트에서는 예측하기 어려운 결과를 만들 수 있기 때문이다.

반복문에서는 `while`, `for`, `for...in`, `for...of`를 비교한다. 단순히 반복문 종류를 외우는 것이 아니라, **무엇을 반복하는지**를 기준으로 구분해야 한다. 배열의 값을 순회할 때는 `for...of`, 객체의 key를 순회할 때는 `for...in`을 떠올리는 식이다.

마지막으로 함수는 JavaScript 문법의 중심에 있다. 함수 선언식과 함수 표현식은 비슷해 보이지만 호이스팅 동작이 다르고, 화살표 함수는 함수 표현식을 더 간결하게 쓰는 방식이다. 여기에 기본 매개변수, 나머지 매개변수, 전개 구문까지 연결되면 JavaScript에서 데이터를 함수에 전달하고 가공하는 흐름을 이해할 수 있다.

---

## 3. 본문 정리

## 3.1 데이터 타입을 먼저 이해해야 하는 이유

JavaScript에서 데이터 타입은 단순히 “숫자냐 문자열이냐”를 구분하는 정도로 끝나지 않는다. 어떤 값이 변수에 저장되는 방식, 복사될 때의 동작, 수정 가능 여부까지 함께 결정한다.

크게 보면 JavaScript의 데이터 타입은 두 가지로 나눌 수 있다.

| 구분 | 저장 방식 | 변경 가능성 | 대표 타입 |
|---|---|---|---|
| 원시 자료형 | 값 자체가 변수에 저장된다. | 불변이다. | Number, String, Boolean, null, undefined |
| 참조 자료형 | 데이터가 저장된 메모리 주소가 변수에 저장된다. | 가변이다. | Object, Array, Function |

여기서 중요한 점은 “변수에 무엇이 들어 있는가”다. 원시 자료형 변수에는 값이 직접 들어 있다고 생각하면 되고, 참조 자료형 변수에는 실제 데이터가 있는 위치를 가리키는 주소가 들어 있다고 생각하면 된다.

---

### 3.1.1 원시 자료형

원시 자료형은 값 자체가 변수에 저장되는 자료형이다. 변수 간에 값을 할당하면 값이 복사되므로, 이후 한쪽 값을 바꾸더라도 다른 변수에는 영향을 주지 않는다.

```js
// 문자열은 원시 자료형이다.
// a에는 'bar'라는 값 자체가 들어 있다고 볼 수 있다.
const a = 'bar'
console.log(a) // bar

// toUpperCase()는 대문자로 바꾼 새 문자열을 반환하지만,
// 원래 문자열 a 자체를 직접 바꾸지는 않는다.
a.toUpperCase()
console.log(a) // bar
```

문자열이 불변이라는 말은 문자열을 절대 다시 할당할 수 없다는 뜻이 아니다. `let str = 'ssafy'`처럼 선언한 뒤 `str = 'SSAFY'`처럼 변수에 새 값을 다시 넣을 수는 있다. 다만 기존 문자열 값의 일부만 직접 수정하는 것은 불가능하다.

```js
let str = 'ssafy'

// 문자열의 0번째 글자만 직접 바꾸는 방식은 동작하지 않는다.
str[0] = 'S'

console.log(str) // ssafy
```

숫자도 같은 방식으로 이해할 수 있다.

```js
// a의 값 10이 b에 복사된다.
let a = 10
let b = a

// b를 20으로 바꿔도 a에는 영향을 주지 않는다.
b = 20

console.log(a) // 10
console.log(b) // 20
```

📌 핵심: 원시 자료형은 변수에 값 자체가 저장되고, 다른 변수에 할당하면 값이 복사된다.

---

### 3.1.2 참조 자료형

참조 자료형은 객체가 저장된 메모리 주소를 변수에 저장한다. 그래서 변수 간에 객체를 할당하면 객체 자체가 새로 복사되는 것이 아니라, 같은 객체를 가리키는 주소가 복사된다.

```js
// obj1은 객체 자체가 아니라 객체가 있는 주소를 참조한다.
const obj1 = { name: 'Alice', age: 30 }

// obj2에는 obj1이 가리키던 객체의 주소가 복사된다.
const obj2 = obj1

// obj2를 통해 객체의 age 값을 바꾸면,
// obj1도 같은 객체를 바라보고 있기 때문에 변경 결과가 함께 보인다.
obj2.age = 40

console.log(obj1.age) // 40
console.log(obj2.age) // 40
```

이 부분은 배열과 객체를 다룰 때 특히 중요하다. Vue에서 상태를 관리하거나 API 응답 데이터를 가공할 때도 배열과 객체는 참조 자료형이기 때문에, 복사한 줄 알았는데 원본이 같이 바뀌는 문제가 발생할 수 있다.

⚠️ 주의: 참조 자료형은 주소를 복사한다. 따라서 복사본처럼 보이는 변수에서 객체 내부 값을 수정하면 원본도 함께 바뀔 수 있다.

---

## 3.2 원시 자료형 종류

원시 자료형은 값 자체를 표현하는 기본 타입이다. 강의에서는 Number, String, null, undefined, Boolean을 중심으로 정리했다.

---

### 3.2.1 Number

Number는 정수와 실수를 모두 표현하는 숫자 자료형이다. JavaScript에서는 정수와 실수를 별도 타입으로 나누지 않고, 대부분의 숫자를 하나의 Number 타입으로 처리한다.

```js
// 정수
const a = 13

// 음수
const b = -5

// 실수
const c = 3.14

// 지수 표기법: 2.998 * 10^8
const d = 2.998e8

// 양의 무한대
const e = Infinity

// 음의 무한대
const f = -Infinity

// 숫자가 아님을 나타내는 값
const g = NaN
```

Number 타입에서는 사칙연산과 나머지 연산이 가능하다. 다만 문자열과 `+` 연산을 하면 숫자가 문자열로 변환되어 문자열 연결이 일어날 수 있다.

```js
console.log(10 + 5)     // 15
console.log(10 - 5)     // 5
console.log(10 * 5)     // 50
console.log(10 / 5)     // 2
console.log(10 % 3)     // 1

// 문자열과 + 연산을 하면 문자열 연결이 된다.
console.log('10' + 5)   // '105'
```

⚠️ 주의: `NaN`은 “Not a Number”라는 뜻이지만, `typeof NaN`의 결과는 `'number'`다. 이름만 보고 숫자 타입이 아니라고 생각하면 헷갈릴 수 있다.

---

### 3.2.2 String과 Template Literal

String은 텍스트 데이터를 표현하는 자료형이다. 문자열끼리는 `+` 연산자로 연결할 수 있다.

```js
const firstName = 'Tony'
const lastName = 'Stark'

// 두 문자열을 그대로 이어 붙인다.
const fullName = firstName + lastName

console.log(fullName) // TonyStark
```

문자열은 덧셈을 통한 결합은 가능하지만, 뺄셈·곱셈·나눗셈처럼 숫자 연산을 자연스럽게 처리하는 자료형은 아니다. 그래서 문자열과 숫자를 함께 다룰 때는 자동 형변환을 조심해야 한다.

문자열 안에 변수를 넣어야 할 때는 Template Literal을 사용하면 훨씬 편하다. Template Literal은 백틱(`` ` ``)으로 문자열을 감싸고, `${}` 안에 표현식을 넣는 방식이다.

```js
const age = 100

// 백틱 안에서 ${}를 사용하면 변수나 표현식을 문자열에 바로 넣을 수 있다.
const message = `홍길동은 ${age}세 입니다.`

console.log(message) // 홍길동은 100세 입니다.
```

Template Literal은 여러 줄 문자열도 자연스럽게 작성할 수 있기 때문에, HTML 문자열을 만들거나 메시지를 조합할 때 자주 사용된다.

```js
const name = 'Alice'
const score = 95

const result = `
학생 이름: ${name}
점수: ${score}
`

console.log(result)
```

---

### 3.2.3 null과 undefined

`null`과 `undefined`는 둘 다 “값이 없음”과 관련된 값이지만, 의미가 다르다.

`null`은 프로그래머가 의도적으로 값이 없음을 나타낼 때 사용한다.

```js
let selectedUser = null
console.log(selectedUser) // null
```

반면 `undefined`는 값이 아직 할당되지 않았을 때 JavaScript 엔진이 기본적으로 부여하는 값이다.

```js
let userName
console.log(userName) // undefined
```

함수에서 `return`이 없거나, 매개변수에 인자를 전달하지 않은 경우에도 `undefined`가 나타날 수 있다.

```js
function sayHello(name) {
  console.log(`Hello, ${name}`)
}

// return 값이 없으므로 result에는 undefined가 들어간다.
const result = sayHello('Kim')
console.log(result) // undefined
```

`typeof null`과 `typeof undefined`를 비교하면 JavaScript의 오래된 역사적 특징을 볼 수 있다.

![null과 undefined의 typeof 결과](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 162528.png>)

위 예시에서 `typeof undefined`는 `'undefined'`로 나오지만, `typeof null`은 `'object'`로 나온다. 실제로 null은 ECMAScript 명세에서 원시 자료형으로 정의되지만, `typeof null === 'object'`라는 결과는 과거 구현상의 이유와 하위 호환성 때문에 그대로 유지되고 있다.

![null과 undefined의 비교 결과](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 162757.png>)

`null == undefined`는 true가 나오지만, `null === undefined`는 false가 나온다. `==`는 타입 변환을 허용하고, `===`는 타입까지 비교하기 때문이다.

⚠️ 주의: `null`의 타입을 검사하면 `'object'`가 나오지만, null을 객체라고 이해하면 안 된다. 이것은 JavaScript의 역사적 이유로 남아 있는 특수한 결과다.

---

### 3.2.4 Boolean과 자동 형변환

Boolean은 참과 거짓을 표현하는 자료형이다. 조건문이나 반복문에서 조건을 판단할 때 자주 사용된다.

```js
const isLogin = true
const isAdmin = false

if (isLogin) {
  console.log('로그인 상태입니다.')
}
```

조건문에서는 Boolean 값만 사용할 수 있는 것이 아니다. JavaScript는 조건식에 들어온 값을 자동으로 true 또는 false로 변환한다. 이를 자동 형변환이라고 한다.

![자동 형변환에서 false와 true로 평가되는 값](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 144701.png>)

대표적으로 `undefined`, `null`, `0`, 빈 문자열은 false로 평가된다. 반면 비어 있지 않은 문자열, 대부분의 숫자, 객체, 배열은 true로 평가된다.

```js
if ('hello') {
  console.log('문자열은 true로 평가된다.')
}

if (0) {
  console.log('이 코드는 실행되지 않는다.')
}

if ([]) {
  console.log('빈 배열도 객체이므로 true로 평가된다.')
}
```

⚠️ 주의: 빈 배열 `[]`과 빈 객체 `{}`는 내용이 없어 보여도 참조 자료형 객체이므로 true로 평가된다. Python에서 빈 리스트가 false로 평가되는 것과 다르기 때문에 헷갈리기 쉽다.

---

## 3.3 연산자

연산자는 값을 계산하거나 비교하고, 변수에 값을 할당하거나, 논리적인 조건을 조합할 때 사용한다. 이번 강의에서는 할당 연산자, 증가·감소 연산자, 비교 연산자, 동등 연산자, 일치 연산자, 논리 연산자를 정리했다.

---

### 3.3.1 할당 연산자

할당 연산자는 오른쪽에 있는 표현식의 결과를 왼쪽 변수에 저장한다. 기본 할당은 `=`이고, 기존 값에 연산을 적용한 뒤 다시 저장하는 단축 연산자도 사용할 수 있다.

```js
let a = 0

// a = a + 10과 같다.
a += 10
console.log(a) // 10

// a = a - 3과 같다.
a -= 3
console.log(a) // 7

// a = a * 10과 같다.
a *= 10
console.log(a) // 70

// a = a % 7과 같다.
a %= 7
console.log(a) // 0
```

단축 연산자는 반복문에서 누적값을 만들거나, 카운트를 증가시킬 때 자주 사용된다.

---

### 3.3.2 증가 & 감소 연산자

증가 연산자 `++`는 피연산자에 1을 더하고, 감소 연산자 `--`는 피연산자에서 1을 뺀다. 다만 연산자의 위치에 따라 반환되는 값이 달라진다.

```js
let x = 3

// 후위 증가: y에는 증가 전 값이 먼저 들어간 뒤, x가 증가한다.
const y = x++
console.log(x, y) // 4 3

let a = 3

// 전위 증가: a가 먼저 증가한 뒤, 그 값이 b에 들어간다.
const b = ++a
console.log(a, b) // 4 4
```

코드가 짧아지는 장점은 있지만, 전위와 후위의 차이가 헷갈리기 쉽다. 그래서 가독성을 위해 `a += 1`, `a -= 1`처럼 명시적으로 작성하는 방식도 많이 권장된다.

⚠️ 주의: `x++`와 `++x`는 모두 x를 1 증가시키지만, 표현식이 반환하는 값은 다르다. 다른 변수에 대입하면서 사용할 때 결과가 달라질 수 있다.

---

### 3.3.3 비교 연산자

비교 연산자는 두 값을 비교하고 결과를 Boolean으로 반환한다.

```js
console.log(3 > 2) // true
console.log(3 < 2) // false
```

문자열도 비교할 수 있다. 문자열 비교는 문자 코드 순서를 기준으로 이루어진다.

```js
console.log('A' < 'B') // true
console.log('Z' < 'a') // true
console.log('가' < '나') // true
```

문자열 비교는 알파벳 순서처럼 보일 때도 있지만, 정확히는 내부 문자 코드 기준이기 때문에 모든 언어와 모든 상황에서 사람이 기대하는 정렬과 완전히 같다고 생각하면 안 된다.

---

### 3.3.4 동등 연산자와 일치 연산자

동등 연산자 `==`는 두 피연산자가 같은 값으로 평가되는지 비교한다. 이때 타입이 다르면 JavaScript가 암묵적으로 타입을 변환한 뒤 비교한다.

```js
console.log(1 == 1)           // true
console.log('hello' == 'hello') // true

// 문자열 '1'이 숫자 1로 변환되어 비교된다.
console.log('1' == 1)         // true

// false가 숫자 0으로 변환되어 비교된다.
console.log(0 == false)       // true
```

반면 일치 연산자 `===`는 값과 타입이 모두 같을 때만 true를 반환한다.

```js
console.log(1 === 1)             // true
console.log('hello' === 'hello') // true

// 값은 비슷해 보여도 타입이 다르므로 false다.
console.log('1' === 1)           // false
console.log(0 === false)         // false
```

JavaScript에서는 특별한 이유가 없다면 `===` 사용을 권장한다. 타입 변환이 자동으로 들어가면 짧은 예제에서는 편해 보이지만, 실제 프로젝트에서는 예상하기 어려운 버그를 만들 수 있다.

```js
console.log('' == 0)       // true
console.log('' === 0)      // false

console.log([] == '')      // true
console.log([] === '')     // false
```

⚠️ 주의: 배열이나 객체는 내용이 같아 보여도 서로 다른 객체라면 같지 않다.

```js
console.log([1] == [1])  // false
console.log([1] === [1]) // false
```

위 예시는 두 배열의 값이 모두 `[1]`처럼 보이지만, 서로 다른 메모리 주소에 있는 별개의 배열이기 때문에 false가 나온다.

📌 핵심: 예측 가능한 비교가 필요하면 `==`보다 `===`를 기본으로 사용한다.

---

### 3.3.5 논리 연산자와 단축 평가

논리 연산자는 여러 조건을 조합할 때 사용한다.

| 연산자 | 의미 |
|---|---|
| `&&` | AND. 양쪽이 모두 참이면 참 |
| `||` | OR. 둘 중 하나라도 참이면 참 |
| `!` | NOT. 참과 거짓을 반대로 바꿈 |

```js
console.log(true && false) // false
console.log(true && true)  // true

console.log(false || true) // true
console.log(false || false) // false

console.log(!true) // false
```

JavaScript의 논리 연산자는 단순히 true 또는 false만 반환하지 않는다. 단축 평가에 의해 실제 피연산자 값을 반환할 수 있다.

```js
console.log(1 && 0) // 0
console.log(0 && 1) // 0
console.log(4 && 7) // 7

console.log(1 || 0) // 1
console.log(0 || 1) // 1
console.log(4 || 7) // 4
```

`&&`는 왼쪽 값이 false로 평가되면 그 값을 바로 반환하고, 왼쪽이 true라면 오른쪽 값을 확인한다. `||`는 왼쪽 값이 true로 평가되면 그 값을 바로 반환하고, 왼쪽이 false라면 오른쪽 값을 확인한다.

이 특성은 기본값 처리에 자주 사용된다.

```js
const inputName = ''
const displayName = inputName || '익명'

console.log(displayName) // 익명
```

⚠️ 주의: `||`로 기본값을 처리하면 `0`, `''`, `false`도 모두 기본값으로 대체된다. 실제 값으로 0이나 빈 문자열을 허용해야 하는 경우에는 `??` 연산자를 고려해야 한다.

---

## 3.4 조건문

조건문은 조건에 따라 서로 다른 코드를 실행하기 위한 문법이다. JavaScript에서는 대표적으로 `if`문과 삼항 연산자를 사용한다.

---

### 3.4.1 if 문

`if` 문은 조건 표현식의 결과를 Boolean으로 변환한 뒤, 참이면 해당 블록의 코드를 실행한다.

![if 문 구조와 조건 분기 예시](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 151303.png>)

위 예시는 `name` 값에 따라 서로 다른 메시지를 출력하는 구조다. 조건을 위에서부터 차례대로 확인하고, 처음으로 참이 되는 블록을 실행한다.

```js
const name = 'customer'

if (name === 'admin') {
  console.log('관리자님 환영해요')
} else if (name === 'customer') {
  console.log('고객님 환영해요')
} else {
  console.log(`반갑습니다. ${name}님`)
}
```

이 코드에서 중요한 점은 조건문의 순서다. `if`에서 먼저 확인하고, 맞지 않으면 `else if`로 넘어가며, 모든 조건에 맞지 않으면 `else`가 실행된다.

---

### 3.4.2 삼항 연산자

삼항 연산자는 간단한 조건부 로직을 한 줄로 표현할 때 사용한다.

```text
condition ? expression1 : expression2
```

- `condition`: true 또는 false로 평가될 조건
- `expression1`: 조건이 true일 때 반환할 값
- `expression2`: 조건이 false일 때 반환할 값

![삼항 연산자 예시](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 152745.png>)

```js
const age = 20

// age가 18 이상이면 '성인', 아니면 '미성년자'를 message에 저장한다.
const message = age >= 18 ? '성인' : '미성년자'

console.log(message) // 성인
```

삼항 연산자는 값을 선택하는 상황에서 깔끔하다. 하지만 조건이 복잡해지거나 실행해야 할 코드가 많아지면 `if` 문이 더 읽기 쉽다.

⚠️ 주의: 삼항 연산자를 여러 번 중첩하면 짧아 보이지만 오히려 해석이 어려워진다. 간단한 값 선택에만 사용하는 편이 좋다.

---

## 3.5 반복문

반복문은 같은 구조의 코드를 여러 번 실행할 때 사용한다. 이번 강의에서는 `while`, `for`, `for...in`, `for...of`를 비교했다. 반복문을 고를 때는 “몇 번 반복할 것인가”보다 **무엇을 기준으로 반복할 것인가**를 먼저 생각하면 이해하기 쉽다.

---

### 3.5.1 while 반복문

`while`문은 조건이 참인 동안 계속 반복한다.

![while 문의 기본 구조](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 152903.png>)

```js
let i = 0

// i가 6보다 작은 동안 반복한다.
while (i < 6) {
  console.log(i)

  // i를 증가시키지 않으면 조건이 계속 true라서 무한 반복이 된다.
  i += 1
}
```

`while`문은 반복 횟수가 명확하지 않고, 특정 조건이 만족될 때까지 반복해야 하는 경우에 어울린다. 다만 조건을 바꾸는 코드가 누락되면 무한 반복이 발생하기 쉽다.

⚠️ 주의: `while`문에서는 반복문 내부에서 조건을 변화시키는 코드가 있는지 반드시 확인해야 한다.

---

### 3.5.2 for 반복문

`for`문은 초기문, 조건문, 증감문을 한 줄에 모아서 작성하는 반복문이다.

![for 문의 기본 구조](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 152933.png>)

```js
// 초기문: let i = 0
// 조건문: i < 6
// 증감문: i++
for (let i = 0; i < 6; i++) {
  console.log(i)
}
```

`for`문은 반복 횟수가 정해져 있거나, 배열의 인덱스를 기준으로 순회할 때 자주 사용한다.

![for 문의 동작 순서](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 153018.png>)

동작 순서는 다음과 같다.

1. 초기문을 한 번 실행한다.
2. 조건문을 확인한다.
3. 조건이 true이면 반복문 본문을 실행한다.
4. 증감문을 실행한다.
5. 다시 조건문을 확인한다.
6. 조건이 false가 될 때 반복을 종료한다.

```js
const numbers = [10, 20, 30]

for (let i = 0; i < numbers.length; i++) {
  console.log(numbers[i])
}
```

---

### 3.5.3 for...in

`for...in`은 객체의 열거 가능한 속성 key를 반복할 때 사용한다.

![for...in 기본 구조](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 153121.png>)

```js
const fruits = {
  a: 'apple',
  b: 'banana',
}

// property에는 객체의 key가 들어온다.
for (const property in fruits) {
  console.log(property)          // a, b
  console.log(fruits[property])  // apple, banana
}
```

객체는 인덱스보다 key로 값을 꺼내는 구조다. 그래서 객체를 순회할 때는 `for...in`이 자연스럽다.

---

### 3.5.4 for...of

`for...of`는 반복 가능한 객체의 값을 반복할 때 사용한다. 배열이나 문자열처럼 순서대로 값을 꺼낼 수 있는 자료형에 적합하다.

![for...of 기본 구조](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 153219.png>)

```js
const numbers = [0, 1, 2, 3]

// number에는 배열의 인덱스가 아니라 값이 들어온다.
for (const number of numbers) {
  console.log(number) // 0, 1, 2, 3
}
```

문자열도 반복 가능한 객체이므로 `for...of`로 순회할 수 있다.

```js
const word = 'JavaScript'

for (const char of word) {
  console.log(char)
}
```

---

### 3.5.5 for...in과 for...of 비교

`for...in`과 `for...of`는 이름이 비슷하지만 반복 대상이 다르다.

![for...in으로 배열과 객체 순회하기](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 153254.png>)

`for...in`은 객체의 key를 순회한다. 배열에 사용하면 배열의 값이 아니라 인덱스가 나온다.

```js
const arr = ['a', 'b', 'c']

for (const index in arr) {
  console.log(index) // 0, 1, 2
}
```

객체에는 잘 맞는다.

```js
const capitals = {
  korea: '서울',
  japan: '도쿄',
  china: '베이징',
}

for (const country in capitals) {
  console.log(country)           // korea, japan, china
  console.log(capitals[country]) // 서울, 도쿄, 베이징
}
```

![for...of로 배열과 객체 순회하기](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 153323.png>)

반대로 `for...of`는 값 자체를 순회한다. 배열에는 잘 맞지만, 일반 객체는 기본적으로 iterable이 아니기 때문에 바로 사용할 수 없다.

```js
const arr = ['a', 'b', 'c']

for (const elem of arr) {
  console.log(elem) // a, b, c
}

const capitals = {
  korea: '서울',
  japan: '도쿄',
  china: '베이징',
}

// 일반 객체는 iterable이 아니므로 TypeError가 발생한다.
// for (const capital of capitals) {
//   console.log(capital)
// }
```

배열에서 `for...in`을 쓰면 인덱스가 문자열로 반환된다. 또한 배열의 프로토타입에 추가된 속성까지 순회할 수 있어 예기치 않은 버그가 생길 수 있다.

![배열에서 for...in과 for...of 비교](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 153531.png>)

```js
const arr = ['a', 'b', 'c']

for (const i in arr) {
  console.log(i) // 0, 1, 2
}

for (const item of arr) {
  console.log(item) // a, b, c
}
```

강의에서 반복문을 종합하면 다음처럼 정리할 수 있다.

![반복문 종합 표](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 153758.png>)

| 반복문 | 주로 사용하는 대상 | 반복되는 값 |
|---|---|---|
| `while` | 조건이 중요할 때 | 조건이 true인 동안 실행 |
| `for` | 반복 횟수나 인덱스가 중요할 때 | 초기문·조건문·증감문 기준 |
| `for...in` | 객체 | key |
| `for...of` | 배열, 문자열 등 iterable | value |

⚠️ 주의: 배열의 값을 순회하고 싶다면 `for...in`보다 `for`, `for...of`를 사용한다. `for...in`은 배열의 값이 아니라 인덱스를 반환한다.

---

### 3.5.6 반복문에서 const를 사용할 수 있는 경우

일반 `for`문에서는 보통 `let`을 사용한다.

```js
// i는 반복마다 재할당되므로 const를 사용할 수 없다.
for (let i = 0; i < 5; i++) {
  console.log(i)
}
```

반면 `for...in`, `for...of`에서는 `const`를 사용할 수 있다. 매 반복마다 새로운 블록 스코프의 변수가 만들어진다고 이해하면 된다.

```js
const arr = ['a', 'b', 'c']

for (const item of arr) {
  console.log(item)
}
```

단, 블록 내부에서 `item` 자체를 다시 할당할 수는 없다.

```js
for (const item of arr) {
  // item = 'x' // TypeError
  console.log(item)
}
```

---

## 3.6 함수

함수는 특정 작업을 수행하는 코드 묶음이다. JavaScript에서 함수는 단순한 문법 구조가 아니라 **값처럼 다룰 수 있는 객체**다. 그래서 변수에 할당하거나, 다른 함수의 인자로 넘기거나, 함수의 반환값으로 사용할 수 있다.

강의에서는 함수를 참조 자료형에 속하는 Function object로 설명했다. 즉, 함수도 객체처럼 메모리에 저장되고, 변수는 그 함수 객체를 참조한다.

---

### 3.6.1 함수 구조

함수는 일반적으로 `function` 키워드, 함수 이름, 매개변수, 함수 본문으로 구성된다.

![함수의 기본 구조](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 154141.png>)

```js
// function: 함수를 정의하는 키워드
// add: 함수 이름
// num1, num2: 외부에서 값을 받을 매개변수
function add(num1, num2) {
  // 함수 본문에서는 필요한 계산을 수행한다.
  const result = num1 + num2

  // return은 함수의 결과값을 호출한 곳으로 돌려준다.
  return result
}

console.log(add(1, 2)) // 3
```

`return` 문이 없거나 `return` 뒤에 값이 없으면 함수는 `undefined`를 반환한다.

```js
function sayHello() {
  console.log('hello')
}

const result = sayHello()
console.log(result) // undefined
```

---

## 3.7 함수 정의 방법

JavaScript에서 함수를 정의하는 대표적인 방법은 함수 선언식과 함수 표현식이다.

---

### 3.7.1 함수 선언식

함수 선언식은 `function` 키워드 뒤에 함수 이름을 붙여 정의하는 방식이다.

![함수 선언식 기본 형태](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 154255.png>)

```js
function funcName() {
  statements
}
```

실제 예시는 다음과 같다.

![함수 선언식 예시](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 154344.png>)

```js
function add(num1, num2) {
  return num1 + num2
}

console.log(add(1, 2)) // 3
```

함수 선언식의 중요한 특징은 호이스팅이다. 함수 선언식은 코드 실행 전에 함수 선언이 먼저 처리되므로, 함수 정의보다 앞에서 호출해도 동작할 수 있다.

![함수 선언식의 호이스팅](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 154520.png>)

```js
// 함수 선언보다 먼저 호출했지만 실행된다.
console.log(add(1, 2)) // 3

function add(num1, num2) {
  return num1 + num2
}
```

호이스팅은 JavaScript 엔진이 코드 실행 전 변수와 함수 선언을 스코프의 위쪽으로 끌어올린 것처럼 처리하는 동작이다. 함수 선언식은 이 특징 때문에 작성 순서에 비교적 자유롭다.

---

### 3.7.2 함수 표현식

함수 표현식은 함수를 값처럼 만들어 변수에 할당하는 방식이다.

![함수 표현식 기본 형태](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 154319.png>)

```js
const funcName = function () {
  statements
}
```

실제 예시는 다음과 같다.

![함수 표현식 예시](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 154359.png>)

```js
const sub = function (num1, num2) {
  return num1 - num2
}

console.log(sub(2, 1)) // 1
```

함수 표현식은 익명 함수를 사용할 수 있다. 익명 함수는 이름 없이 필요할 때 만들어서 변수에 담거나 콜백으로 전달하는 함수다.

```js
const greeting = function (name = 'Anonymous') {
  return `Hi ${name}`
}

console.log(greeting()) // Hi Anonymous
```

![함수 표현식과 익명 함수](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161130.png>)

함수 표현식은 함수 선언식처럼 함수 할당까지 호이스팅되지 않는다. 변수 선언은 호이스팅되지만, 실제 함수 값이 할당되는 것은 코드 실행 시점이다.

![함수 표현식의 호이스팅 차이](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 160820.png>)

```js
// const로 선언된 함수 표현식은 초기화 전에 접근할 수 없다.
// console.log(sub(2, 1)) // ReferenceError

const sub = function (num1, num2) {
  return num1 - num2
}
```

함수 표현식은 호이스팅의 영향을 덜 받기 때문에 실행 흐름을 예측하기 쉽다. 또한 함수를 변수에 할당하므로, 함수를 값처럼 다루는 JavaScript 스타일과 잘 맞는다.

⚠️ 주의: 함수 선언식은 선언 전에 호출할 수 있지만, 함수 표현식은 보통 선언 이후에 호출해야 한다. 특히 `const`와 함께 사용하면 초기화 전 접근 시 ReferenceError가 발생한다.

---

## 3.8 매개변수와 인자

매개변수는 함수가 외부로부터 값을 전달받기 위해 만들어 놓은 변수다. 함수 호출 시 실제로 전달하는 값은 인자라고 부른다.

```js
// name은 매개변수다.
function greeting(name) {
  return `Hello, ${name}`
}

// 'Kim'은 인자다.
greeting('Kim')
```

---

### 3.8.1 기본 함수 매개변수

기본 함수 매개변수는 함수 호출 시 인자를 전달하지 않거나 `undefined`를 전달했을 때 사용할 기본값을 지정하는 문법이다.

```js
function greeting(name = 'Anonymous') {
  return `Hi ${name}`
}

console.log(greeting())       // Hi Anonymous
console.log(greeting('Kim'))  // Hi Kim
```

기본값을 지정하면 인자가 빠졌을 때도 `undefined`가 그대로 출력되는 것을 막을 수 있다.

---

### 3.8.2 나머지 매개변수

나머지 매개변수는 정해지지 않은 개수의 인자를 배열로 모아서 받는 방법이다. 매개변수 이름 앞에 `...`을 붙인다.

![나머지 매개변수 예시](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161235.png>)

```js
function myFunc(param1, param2, ...restParams) {
  return [param1, param2, restParams]
}

console.log(myFunc(1, 2, 3, 4, 5)) // [1, 2, [3, 4, 5]]
console.log(myFunc(1, 2))          // [1, 2, []]
```

나머지 매개변수는 함수 정의에서 하나만 사용할 수 있고, 반드시 마지막에 위치해야 한다.

```js
// 올바른 사용
function good(a, b, ...rest) {}

// 잘못된 사용
// function bad(...rest, a) {}
```

⚠️ 주의: 나머지 매개변수는 남은 인자를 “모으는” 역할이다. 함수 호출 시 배열을 “펼치는” 전개 구문과 모양은 같지만 방향이 다르다.

---

### 3.8.3 매개변수와 인자 개수가 다를 때

JavaScript 함수는 매개변수와 인자의 개수가 딱 맞지 않아도 호출된다.

매개변수 개수가 인자 개수보다 많으면, 전달되지 않은 매개변수에는 `undefined`가 들어간다.

![매개변수가 더 많을 때](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161309.png>)

```js
const threeArgs = function (param1, param2, param3) {
  return [param1, param2, param3]
}

console.log(threeArgs())          // [undefined, undefined, undefined]
console.log(threeArgs(1))         // [1, undefined, undefined]
console.log(threeArgs(1, 2))      // [1, 2, undefined]
```

반대로 인자 개수가 매개변수보다 많으면, 초과된 인자는 기본적으로 사용되지 않는다.

![인자가 더 많을 때](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161338.png>)

```js
const noArgs = function () {
  return 0
}

console.log(noArgs(1, 2, 3)) // 0

const twoArgs = function (param1, param2) {
  return [param1, param2]
}

console.log(twoArgs(1, 2, 3)) // [1, 2]
```

---

## 3.9 전개 구문

전개 구문은 배열이나 문자열처럼 반복 가능한 항목을 개별 요소로 펼치는 문법이다. 나머지 매개변수와 같은 `...` 모양을 사용하지만, 사용 위치에 따라 의미가 달라진다.

전개 구문은 크게 세 가지 상황에서 자주 사용된다.

1. 함수 호출 시 인자 확장
2. 배열 복사 또는 결합
3. 객체 복사 또는 병합

이번 강의에서는 함수와의 사용을 중심으로 정리했다.

---

### 3.9.1 함수 호출 시 인자 확장

배열에 들어 있는 값을 함수의 개별 인자로 전달하고 싶을 때 전개 구문을 사용할 수 있다.

![함수 호출에서 전개 구문 사용](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161543.png>)

```js
function myFunc(x, y, z) {
  return x + y + z
}

let numbers = [1, 2, 3]

// numbers 배열을 1, 2, 3이라는 개별 인자로 펼쳐 전달한다.
console.log(myFunc(...numbers)) // 6
```

만약 `...`을 사용하지 않으면 배열 자체가 첫 번째 인자로 들어간다.

```js
console.log(myFunc(numbers))
// x = [1, 2, 3], y = undefined, z = undefined가 되어 의도한 계산이 아니다.
```

---

### 3.9.2 나머지 매개변수와 전개 구문의 관계

같은 `...` 문법이라도 함수 정의부에서는 나머지 매개변수로 동작하고, 함수 호출부에서는 전개 구문으로 동작한다.

![나머지 매개변수로 인자 압축](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161614.png>)

```js
// 함수 정의부: 여러 인자를 restArgs 배열로 모은다.
function myFunc2(x, y, ...restArgs) {
  return [x, y, restArgs]
}

console.log(myFunc2(1, 2, 3, 4, 5)) // [1, 2, [3, 4, 5]]
console.log(myFunc2(1, 2))          // [1, 2, []]
```

정리하면 다음과 같다.

| 위치 | 이름 | 역할 |
|---|---|---|
| 함수 호출부 | 전개 구문 | 배열을 개별 인자로 펼친다. |
| 함수 정의부 | 나머지 매개변수 | 남은 인자를 배열로 모은다. |

📌 핵심: `...`은 위치에 따라 “펼치기”가 되기도 하고, “모으기”가 되기도 한다.

---

## 3.10 화살표 함수 표현식

화살표 함수 표현식은 함수 표현식을 간결하게 작성하는 문법이다. 콜백 함수나 짧은 로직을 작성할 때 자주 사용한다.

![화살표 함수 표현식 기본 개념](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161719.png>)

기본 함수 표현식은 다음과 같다.

```js
const arrow1 = function (name) {
  return `hello, ${name}`
}
```

이를 화살표 함수로 바꾸면 다음처럼 작성할 수 있다.

```js
const arrow1 = (name) => {
  return `hello, ${name}`
}
```

---

### 3.10.1 화살표 함수 작성 과정

첫 번째 단계는 `function` 키워드를 제거하고, 매개변수와 함수 본문 사이에 `=>`를 넣는 것이다.

![function 키워드를 제거하고 화살표 작성](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161801.png>)

```js
const arrow1 = (name) => {
  return `hello, ${name}`
}
```

두 번째 단계로, 매개변수가 하나뿐이라면 매개변수의 괄호를 생략할 수 있다. 다만 처음 학습할 때는 괄호를 유지하는 편이 더 안정적이다.

![매개변수가 하나일 때 괄호 생략](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161840.png>)

```js
// 괄호 유지
const arrow1 = (name) => {
  return `hello, ${name}`
}

// 괄호 생략 가능
const arrow2 = name => {
  return `hello, ${name}`
}
```

세 번째 단계로, 함수 본문이 한 줄의 표현식이라면 `{}`와 `return`을 생략할 수 있다.

![본문이 한 줄일 때 return 생략](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 161933.png>)

```js
const arrow1 = function (name) {
  return `hello, ${name}`
}

// function 제거
const arrow2 = (name) => {
  return `hello, ${name}`
}

// 매개변수가 하나면 괄호 생략 가능
const arrow3 = name => {
  return `hello, ${name}`
}

// 본문이 한 줄이면 중괄호와 return 생략 가능
const arrow4 = name => `hello, ${name}`
```

화살표 함수는 배열 메서드와 함께 자주 사용된다.

```js
const numbers = [1, 2, 3]

// 각 숫자를 두 배로 만든 새 배열을 반환한다.
const doubled = numbers.map((number) => number * 2)

console.log(doubled) // [2, 4, 6]
```

---

### 3.10.2 객체를 바로 반환할 때의 주의점

화살표 함수에서 객체를 바로 반환할 때는 객체 리터럴을 괄호로 감싸야 한다. 그렇지 않으면 `{}`가 함수 본문 블록으로 해석될 수 있다.

![화살표 함수에서 객체 반환하기](<../assets/images/05_14_Basic_Syntax_1/화면 캡처 2026-06-10 162829.png>)

```js
// 객체를 명시적으로 return하는 방식
const returnObject1 = () => {
  return { key: 'value' }
}

// 객체를 바로 반환하려면 괄호로 감싸야 한다.
const returnObject2 = () => ({ key: 'value' })
```

⚠️ 주의: `() => { key: 'value' }`처럼 작성하면 객체 반환이 아니라 함수 본문 블록으로 해석될 수 있다. 객체를 암시적으로 반환할 때는 `({ ... })` 형태를 사용한다.

---

## 3.11 NaN

`NaN`은 계산 결과가 숫자로 표현될 수 없을 때 나오는 값이다. 이름은 Not a Number지만, JavaScript 타입 시스템에서는 Number 타입에 속한다.

NaN이 나오는 대표적인 경우는 다음과 같다.

1. 숫자로 읽을 수 없는 값을 Number로 변환하려 할 때
2. 결과가 허수인 수학 계산을 할 때
3. 피연산자 중 하나가 NaN일 때
4. 정의할 수 없는 계산을 할 때
5. 문자열을 포함하면서 덧셈이 아닌 계산을 할 때

```js
console.log(Number(undefined)) // NaN
console.log(Math.sqrt(-1))     // NaN
console.log(7 ** NaN)          // NaN
console.log(0 * Infinity)      // NaN
console.log('가' / 3)          // NaN
```

NaN의 가장 특이한 점은 자기 자신과 비교해도 false라는 것이다.

```js
console.log(NaN === NaN) // false
```

그래서 어떤 값이 NaN인지 확인하려면 `Number.isNaN()`을 사용하는 편이 안전하다.

```js
const result = Number(undefined)

console.log(Number.isNaN(result)) // true
```

⚠️ 주의: `NaN === NaN`은 false다. 값이 NaN인지 비교할 때는 직접 비교하지 말고 `Number.isNaN()`을 사용한다.

---

## 4. 적용 관점에서 다시 보기

이번 강의는 JavaScript 문법의 개별 요소를 배운 것처럼 보이지만, 실제로는 앞으로의 Vue 학습과 프로젝트 구현을 위한 기반이다.

먼저 데이터 타입은 상태 관리와 연결된다. Vue에서 배열이나 객체 상태를 수정할 때 원시 자료형처럼 값이 복사된다고 생각하면 문제가 생길 수 있다. 참조 자료형은 주소를 공유할 수 있으므로, 원본 데이터를 보존해야 하는 상황에서는 얕은 복사와 깊은 복사를 구분해서 생각해야 한다.

조건문과 연산자는 화면 분기와 연결된다. 로그인 여부에 따라 버튼을 다르게 보여주거나, 값이 비어 있을 때 기본 문구를 출력하거나, API 응답 상태에 따라 다른 처리를 하는 모든 코드가 조건문과 논리 연산자를 바탕으로 작성된다.

반복문은 배열과 객체 데이터를 화면에 그리는 과정과 연결된다. 일반 JavaScript에서는 `for...of`로 배열을 순회하고, Vue에서는 `v-for`를 통해 배열 데이터를 렌더링한다. 이때 배열의 값이 필요한지, 객체의 key가 필요한지에 따라 반복 방법을 구분할 수 있어야 한다.

함수는 이벤트 처리와 API 로직의 기본 단위가 된다. 버튼 클릭 시 실행할 함수, form 제출 시 실행할 함수, Axios 요청 후 응답 데이터를 처리하는 함수 모두 JavaScript 함수다. 함수 선언식과 표현식, 화살표 함수를 자연스럽게 읽을 수 있어야 Vue의 `<script setup>` 코드도 편하게 이해할 수 있다.

전개 구문과 나머지 매개변수는 데이터를 다룰 때 자주 사용된다. 배열을 복사하거나, 객체를 병합하거나, 함수에 여러 값을 전달하는 상황에서 `...` 문법이 계속 등장한다. 이때 `...`이 펼치는 역할인지, 모으는 역할인지 위치를 기준으로 판단하면 헷갈림을 줄일 수 있다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

원시 자료형과 참조 자료형의 차이는 단순한 타입 분류가 아니라, 값이 복사되는 방식과 수정 결과에 직접 영향을 주는 핵심 개념이다. 특히 배열과 객체는 주소가 복사되므로, 복사본을 수정했는데 원본도 바뀌는 상황을 항상 경계해야 한다.

또 `==`와 `===`의 차이는 JavaScript에서 매우 중요하다. 자동 형변환이 들어가는 `==`는 간단해 보이지만 예측하기 어려운 결과를 만들 수 있으므로, 기본 비교는 `===`로 하는 습관이 필요하다.

### 5.2 앞으로 이어지는 연결점

이번 강의 내용은 DOM 조작, Vue 컴포넌트 작성, Pinia 상태 관리, Axios 요청 처리로 바로 이어진다. 예를 들어 DOM 요소를 선택한 뒤 이벤트 핸들러 함수를 등록하거나, API로 받아온 배열 데이터를 반복해서 화면에 표시하는 과정은 이번에 배운 함수와 반복문을 기반으로 한다.

화살표 함수와 전개 구문은 Vue 프로젝트에서 특히 자주 등장한다. 배열 메서드인 `map`, `filter`, `find`를 사용할 때 화살표 함수가 자연스럽게 쓰이고, 상태를 복사하거나 객체를 합칠 때 전개 구문을 사용하게 된다.

### 5.3 더 파볼 만한 주제

이번 강의 이후에는 배열 메서드와 객체 조작을 더 깊게 학습할 필요가 있다. `map`, `filter`, `reduce`, `find`, `some`, `every` 같은 메서드는 반복문보다 실무 코드에서 더 자주 보인다.

또한 참조 자료형을 제대로 이해하려면 얕은 복사와 깊은 복사, 구조 분해 할당, optional chaining, nullish coalescing까지 함께 정리해보면 좋다. 이 개념들은 Vue 상태 관리와 API 응답 처리에서 자주 연결된다.

---

## 6. 요약 정리

📌 핵심

- 원시 자료형은 값 자체가 변수에 저장되고, 변수 간 할당 시 값이 복사된다.
- 참조 자료형은 객체가 저장된 주소를 변수에 저장하고, 변수 간 할당 시 주소가 복사된다.
- Number는 정수와 실수를 모두 표현하며, `NaN`, `Infinity` 같은 특수한 값도 포함한다.
- String은 텍스트 데이터를 표현하며, Template Literal을 사용하면 문자열 안에 변수를 쉽게 넣을 수 있다.
- `null`은 의도적으로 값이 없음을 나타내고, `undefined`는 값이 아직 할당되지 않았음을 나타낸다.
- Boolean이 아닌 값도 조건문에서는 자동으로 true 또는 false로 변환된다.
- `==`는 암묵적 타입 변환을 허용하고, `===`는 값과 타입을 모두 비교한다.
- 배열의 값을 순회할 때는 `for...of`, 객체의 key를 순회할 때는 `for...in`을 사용한다.
- 함수 선언식은 호이스팅되지만, 함수 표현식은 함수 값 할당 전에는 사용할 수 없다.
- 나머지 매개변수는 여러 인자를 배열로 모으고, 전개 구문은 배열을 개별 값으로 펼친다.
- 화살표 함수는 함수 표현식을 간결하게 작성하는 문법이다.
- NaN은 자기 자신과 비교해도 false이므로, NaN 확인에는 `Number.isNaN()`을 사용하는 것이 안전하다.

🧠 기억할 것

> 비교는 기본적으로 `===`를 사용한다.  
> 배열의 값은 `for...of`, 객체의 key는 `for...in`으로 순회한다.  
> `...`은 함수 호출부에서는 펼치기, 함수 정의부에서는 모으기 역할을 한다.  
> 함수 표현식과 화살표 함수는 Vue 코드에서 매우 자주 등장하므로 자연스럽게 읽을 수 있어야 한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 원시 자료형과 참조 자료형은 변수에 저장되는 방식이 어떻게 다른가?
2. 객체를 다른 변수에 할당한 뒤 복사본을 수정하면 원본도 바뀔 수 있는 이유는 무엇인가?
3. `null`과 `undefined`는 각각 어떤 상황에서 사용되는가?
4. `typeof null`의 결과가 `'object'`로 나오는 이유를 한 문장으로 설명해보자.
5. `==`와 `===`의 차이는 무엇이며, 일반적으로 어떤 연산자를 권장하는가?
6. `for...in`과 `for...of`는 각각 무엇을 순회하는가?
7. 배열의 값을 순서대로 출력하고 싶을 때 `for...in`보다 `for...of`가 적절한 이유는 무엇인가?
8. 함수 선언식과 함수 표현식은 호이스팅 관점에서 어떤 차이가 있는가?
9. 나머지 매개변수와 전개 구문은 같은 `...`을 쓰지만, 각각 어떤 역할을 하는가?
10. 화살표 함수에서 객체를 바로 반환하려면 왜 괄호로 감싸야 하는가?
11. `NaN === NaN`의 결과는 무엇이며, NaN 여부는 어떤 방법으로 확인하는 것이 안전한가?
12. 이번 강의 내용 중 Vue의 이벤트 핸들러나 상태 관리와 직접 연결될 수 있는 개념을 세 가지 이상 말해보자.
