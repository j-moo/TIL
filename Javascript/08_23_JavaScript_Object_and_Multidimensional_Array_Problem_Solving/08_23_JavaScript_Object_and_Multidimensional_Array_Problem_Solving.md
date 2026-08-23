# JavaScript 객체와 다차원 배열 문제 해결: 키·인덱스·차원을 구분하는 법

- 학습 목표: 객체의 동적 키와 배열의 값·인덱스를 구분하고, 2차원·3차원 배열 문제를 입력 구조에 맞는 반복문과 배열 메서드로 해결한다.
- 핵심 키워드: `Object.keys`, `Object.values`, `Object.entries`, `Object.hasOwn`, `in`, `includes`, 점 표기법, 대괄호 표기법, `delete`, spread, rest, `for...in`, `for...of`, `map`, `reduce`, `flat`, 대각선, 경계 순회
- 중요도: 매우 높음. 객체와 중첩 배열 문제에서 발생하는 오류 대부분은 현재 변수가 값인지 키인지 인덱스인지 구분하지 못할 때 생긴다.
- 정리 범위: 2026-08-22~08-23 질문·답변 중 JavaScript 객체, 전개 구문, 반복문, 행렬과 다차원 배열 관련 내용
- 관련 노트: [문자열과 2차원 배열](../08_19_JavaScript_String_and_2D_Array/08_19_JavaScript_String_and_2D_Array.md), [참조·복사·불변성](../08_22_JavaScript_Reference_Copy_and_Immutability/08_22_JavaScript_Reference_Copy_and_Immutability.md)

---

## 1. 들어가며

오늘 살펴본 코드들은 서로 다른 문제처럼 보인다.

- 객체에서 원하는 키 삭제하기
- 책의 읽음 상태 뒤집기
- 쇼핑 카트의 수량 합계 구하기
- 행렬의 대각선과 테두리 구하기
- 여러 행렬을 세로로 합치기
- 3차원 배열 안의 문자열 개수 세기

하지만 오류의 공통 원인은 비슷하다.

```text
현재 변수에 들어 있는 것이 무엇인지 정확히 구분하지 못함
```

예를 들어 다음 세 값은 전부 다르다.

```javascript
const matrix = [
    [10, 20],
    [30, 40]
]

const rowIndex = 0       // 행의 위치: 숫자 0
const row = matrix[0]    // 실제 행: [10, 20]
const value = row[0]     // 실제 원소: 10
```

객체에서도 같은 구분이 필요하다.

```javascript
const user = {
    name: "Kim",
    age: 20
}

const key = "age"       // 속성 이름
const value = user[key]  // 그 속성에 저장된 값 20
```

이 노트에서는 문법을 따로 암기하지 않고 다음 질문을 반복한다.

1. 입력은 객체인가, 배열인가?
2. 현재 변수는 키인가, 인덱스인가, 실제 값인가?
3. 결과는 값 하나인가, 객체인가, 몇 차원 배열인가?
4. 원본을 바꿔야 하는가, 새 값을 반환해야 하는가?

---

## 2. 먼저 JSON과 JavaScript 객체를 구분한다

다음 값은 JavaScript 객체다.

```javascript
const cart = {
    apple: 2,
    banana: 3,
    milk: 1
}
```

다음은 JSON 형식의 문자열이다.

```javascript
const jsonText = '{"apple":2,"banana":3,"milk":1}'
```

둘은 겉모양이 비슷하지만 타입이 다르다.

```javascript
typeof cart      // "object"
typeof jsonText  // "string"
```

JSON 문자열을 객체처럼 순회하려면 먼저 파싱한다.

```javascript
const parsedCart = JSON.parse(jsonText)
```

객체를 JSON 문자열로 바꾸려면 직렬화한다.

```javascript
const text = JSON.stringify(cart)
```

문제에서 함수 인자로 다음과 같이 전달된다면 대부분 이미 JavaScript 객체다.

```javascript
analyzeShoppingCart({
    apple: 2,
    banana: 3
})
```

따라서 “JSON을 반복한다”기보다 “JavaScript 객체의 키와 값을 꺼내 반복한다”고 표현하는 것이 정확하다.

---

## 3. 객체에서 키와 값을 꺼내는 세 가지 메서드

```javascript
const cart = {
    apple: 2,
    banana: 3,
    milk: 1
}
```

### 3.1 `Object.keys()`

객체 자신의 열거 가능한 속성 이름을 배열로 반환한다.

```javascript
Object.keys(cart)
// ["apple", "banana", "milk"]
```

고유 상품 종류 수는 키의 개수다.

```javascript
const totalItems = Object.keys(cart).length
// 3
```

### 3.2 `Object.values()`

속성 값만 배열로 반환한다.

```javascript
Object.values(cart)
// [2, 3, 1]
```

수량의 합은 값들을 누적하면 된다.

```javascript
const totalQuantity = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0
)
// 6
```

### 3.3 `Object.entries()`

키와 값을 `[key, value]` 쌍으로 반환한다.

```javascript
Object.entries(cart)
// [
//   ["apple", 2],
//   ["banana", 3],
//   ["milk", 1]
// ]
```

키와 값을 동시에 사용할 때 편하다.

```javascript
for (const [item, quantity] of Object.entries(cart)) {
    console.log(`${item}: ${quantity}개`)
}
```

### 3.4 선택 기준

| 필요한 것 | 사용할 도구 |
| --- | --- |
| 키만 필요 | `Object.keys(obj)` |
| 값만 필요 | `Object.values(obj)` |
| 키와 값 모두 필요 | `Object.entries(obj)` |

---

## 4. 쇼핑 카트 분석 문제

요구사항:

1. `totalItems`: 고유 항목의 개수
2. `totalQuantity`: 모든 수량의 합

### 4.1 반복문 풀이

```javascript
function analyzeShoppingCart(cart) {
    let totalQuantity = 0

    for (const item in cart) {
        totalQuantity += cart[item]
    }

    return {
        totalItems: Object.keys(cart).length,
        totalQuantity
    }
}
```

`for...in`은 객체의 키를 하나씩 꺼낸다.

```text
item = "apple"  → cart[item] = 2
item = "banana" → cart[item] = 3
item = "milk"   → cart[item] = 1
```

일반 객체의 상속 속성까지 고려해야 하는 코드라면 자신의 속성인지 확인한다.

```javascript
for (const item in cart) {
    if (Object.hasOwn(cart, item)) {
        totalQuantity += cart[item]
    }
}
```

### 4.2 `Object.values()`와 `reduce()` 풀이

```javascript
function analyzeShoppingCart(cart) {
    const quantities = Object.values(cart)

    return {
        totalItems: Object.keys(cart).length,
        totalQuantity: quantities.reduce(
            (sum, quantity) => sum + quantity,
            0
        )
    }
}
```

`reduce()`의 초기값 `0`을 적으면 빈 객체에서도 합계가 `0`이 된다.

```javascript
analyzeShoppingCart({})
// { totalItems: 0, totalQuantity: 0 }
```

### 4.3 입력 계약도 확인한다

수량이 숫자라는 조건이 없다면 문자열이 섞일 수 있다.

```javascript
2 + "3" // "23"
```

실무 코드에서는 입력을 검증한다.

```javascript
function analyzeShoppingCart(cart) {
    const quantities = Object.values(cart)

    if (!quantities.every(
        quantity => Number.isFinite(quantity) && quantity >= 0
    )) {
        throw new TypeError("수량은 0 이상의 유한한 숫자여야 합니다.")
    }

    return {
        totalItems: quantities.length,
        totalQuantity: quantities.reduce(
            (sum, quantity) => sum + quantity,
            0
        )
    }
}
```

---

## 5. `in`, `includes()`, `Object.hasOwn()`을 구분한다

다음 코드는 원하는 결과를 만들지 못했다.

```javascript
if (key in keysToRemove) {
}
```

`keysToRemove`가 배열이라면 `in`은 배열 안의 값을 찾지 않는다. 객체와 배열의 **속성 이름 또는 인덱스가 존재하는지** 검사한다.

```javascript
const keysToRemove = ["age", "city"]

0 in keysToRemove       // true: 인덱스 0이 있음
"age" in keysToRemove   // false: "age"라는 속성은 없음
```

배열 안에 특정 값이 있는지 찾으려면 `includes()`를 사용한다.

```javascript
keysToRemove.includes("age") // true
```

객체가 특정 속성을 자신이 직접 가지고 있는지 검사하려면 `Object.hasOwn()`을 사용할 수 있다.

```javascript
const book = {
    title: "JavaScript",
    isRead: false
}

Object.hasOwn(book, "isRead") // true
```

### 5.1 한눈에 비교하기

| 표현 | 검사 대상 | 예시 |
| --- | --- | --- |
| `value in object` | 객체 또는 프로토타입 체인의 속성 이름 | `"name" in user` |
| `array.includes(value)` | 배열 안의 값 | `keys.includes("age")` |
| `Object.hasOwn(obj, key)` | 객체 자신의 속성 | `Object.hasOwn(book, "isRead")` |
| `set.has(value)` | Set 안의 값 | `keySet.has("age")` |

### 5.2 삭제할 키가 많을 때 `Set`

삭제할 키마다 배열 전체를 `includes()`로 탐색하면 키 목록이 커질수록 비교가 늘어난다. 큰 목록이라면 한 번 `Set`으로 바꿀 수 있다.

```javascript
function removeKeys(obj, keysToRemove) {
    const keySet = new Set(keysToRemove)
    const result = { ...obj }

    for (const key of Object.keys(result)) {
        if (keySet.has(key)) {
            delete result[key]
        }
    }

    return result
}
```

작은 과제에서는 `includes()`가 충분히 읽기 쉽다. 자료 크기와 복잡도를 확인한 뒤 도구를 선택한다.

---

## 6. 점 표기법과 대괄호 표기법

다음 두 표현은 다르다.

```javascript
result.key
result[key]
```

### 6.1 점 표기법

```javascript
result.key
```

문자 그대로 `"key"`라는 이름의 속성에 접근한다.

### 6.2 대괄호 표기법

```javascript
result[key]
```

변수 `key`의 값을 속성 이름으로 사용한다.

```javascript
const result = {
    name: "Kim",
    age: 20
}

const key = "age"

result.key  // undefined: "key" 속성을 찾음
result[key] // 20: "age" 속성을 찾음
```

동적으로 정해지는 속성 이름에는 대괄호 표기법이 필요하다.

```javascript
delete result[key]
```

다음 코드는 변수의 값이 아니라 항상 `"key"` 속성을 삭제하려 한다.

```javascript
delete result.key
```

### 6.3 대괄호가 필요한 다른 경우

속성 이름에 공백이나 하이픈이 있거나 계산된 값이라면 대괄호를 사용한다.

```javascript
const user = {
    "display name": "Kim",
    "favorite-color": "blue"
}

user["display name"]
user["favorite-color"]
```

---

## 7. 객체에서 키 삭제하기

### 7.1 얕은 복사 후 삭제

```javascript
function removeKeys(obj, keysToRemove) {
    const result = { ...obj }

    for (const key of keysToRemove) {
        delete result[key]
    }

    return result
}
```

입력 객체의 모든 키를 순회할 필요 없이 삭제할 키 목록을 직접 순회한다.

```javascript
const user = {
    name: "Kim",
    age: 20,
    city: "Seoul"
}

removeKeys(user, ["age", "city"])
// { name: "Kim" }
```

원본 `user`의 최상위 키는 그대로 유지된다. 다만 spread는 얕은 복사이므로 중첩 객체는 공유될 수 있다.

### 7.2 `Object.entries()`로 남길 키 선택하기

삭제보다 “남길 항목을 선택한다”고 생각할 수도 있다.

```javascript
function removeKeys(obj, keysToRemove) {
    const keySet = new Set(keysToRemove)

    return Object.fromEntries(
        Object.entries(obj).filter(
            ([key]) => !keySet.has(key)
        )
    )
}
```

흐름:

```text
객체
  ↓ Object.entries
[키, 값] 쌍 배열
  ↓ filter
삭제 대상이 아닌 쌍만 남김
  ↓ Object.fromEntries
새 객체
```

과제 단계에서는 복사 후 `delete` 방식이 더 직관적일 수 있다. 짧은 코드보다 현재 학습자가 실행 순서를 설명할 수 있는지가 중요하다.

---

## 8. boolean과 문자열을 구분한다

다음 두 값은 타입이 다르다.

```javascript
true    // boolean
"true"  // string
```

```javascript
true === "true" // false
```

읽음 여부, 활성화 여부, 성공 여부처럼 두 상태를 표현할 때는 일반적으로 boolean을 사용한다.

```javascript
const book = {
    title: "JavaScript",
    isRead: true
}
```

문자열을 사용하면 조건마다 변환이나 비교가 필요하고 오타도 놓치기 쉽다.

```javascript
book.isRead === "true"
book.isRead = "false"
```

boolean은 논리 부정 연산자 `!`로 뒤집을 수 있다.

```text
!true  → false
!false → true
```

---

## 9. 읽음 상태 토글 문제

요구사항:

1. `isRead`가 `true`면 `false`
2. `isRead`가 `false`면 `true`
3. 속성이 없으면 `true`로 추가

### 9.1 원본을 수정하는 풀이

```javascript
function toggleBookStatus(book) {
    if (Object.hasOwn(book, "isRead")) {
        book.isRead = !book.isRead
    } else {
        book.isRead = true
    }

    return book
}
```

이 함수는 인자로 받은 객체를 직접 변경한다.

### 9.2 새 객체를 반환하는 풀이

원본을 유지해야 한다면 새 객체를 만든다.

```javascript
function toggleBookStatus(book) {
    return {
        ...book,
        isRead: Object.hasOwn(book, "isRead")
            ? !book.isRead
            : true
    }
}
```

```javascript
const original = {
    title: "JavaScript",
    isRead: false
}

const toggled = toggleBookStatus(original)

original.isRead // false
toggled.isRead  // true
```

과제에서 “수정된 객체를 반환”한다고 했을 때 원본 변경까지 요구하는지 확인해야 한다. React state처럼 불변 갱신이 필요한 환경에서는 새 객체를 반환하는 방식이 적절하다.

### 9.3 오타는 새 속성을 만든다

```javascript
book.isRaad = false
```

JavaScript는 `isRaad`를 오타로 판단하지 않고 새로운 속성 이름으로 취급한다.

```javascript
{
    isRead: true,
    isRaad: false
}
```

오류가 발생하지 않고 잘못된 상태가 남을 수 있으므로 속성 이름을 주의한다. TypeScript를 사용하면 미리 선언한 객체 타입에서 이런 오타를 컴파일 단계에 발견할 수 있다.

---

## 10. 전개 구문 `...`를 이해한다

`...`는 위치에 따라 펼치기(spread)와 모으기(rest)로 동작한다.

### 10.1 배열 펼치기

```javascript
const numbers = [2, 3, 4]
const result = [1, ...numbers, 5]

// [1, 2, 3, 4, 5]
```

개념적으로 배열 안의 값이 현재 위치에 펼쳐진다.

```text
[1, ...[2, 3, 4], 5]
        ↓
[1, 2, 3, 4, 5]
```

### 10.2 문자열 펼치기

```javascript
const characters = [..."hello"]
// ["h", "e", "l", "l", "o"]
```

문자열의 각 문자가 배열 원소로 들어간다.

### 10.3 객체 펼치기

```javascript
const user = {
    name: "Kim",
    age: 20
}

const updated = {
    ...user,
    age: 21
}
```

뒤에 작성한 같은 이름의 속성이 앞의 값을 덮어쓴다.

```javascript
updated
// { name: "Kim", age: 21 }
```

### 10.4 나머지 매개변수

함수 매개변수 자리의 `...`는 여러 인수를 배열로 모은다.

```javascript
function sum(...numbers) {
    return numbers.reduce(
        (total, number) => total + number,
        0
    )
}

sum(1, 2, 3) // 6
```

| 위치 | 이름 | 동작 |
| --- | --- | --- |
| 배열·객체·함수 호출 안 | spread | 값을 펼친다. |
| 함수 매개변수·구조 분해 안 | rest | 남은 값을 모은다. |

### 10.5 spread 복사는 한 겹만 복사한다

```javascript
const original = {
    profile: {
        name: "Kim"
    }
}

const copy = { ...original }

copy.profile.name = "Lee"
original.profile.name // "Lee"
```

바깥 객체는 새로 만들어졌지만 `profile` 객체 참조는 공유된다. 자세한 내용은 [참조·복사·불변성 노트](../08_22_JavaScript_Reference_Copy_and_Immutability/08_22_JavaScript_Reference_Copy_and_Immutability.md)에서 이어서 확인한다.

---

## 11. 반복문에서 값과 인덱스를 구분한다

### 11.1 `for...of`는 값을 꺼낸다

```javascript
const row = [10, 20, 30]

for (const value of row) {
    console.log(value)
}
```

`value`에는 `10`, `20`, `30`이 차례로 들어간다. 인덱스가 아니다.

### 11.2 일반 `for`문은 인덱스를 만들기 쉽다

```javascript
for (let index = 0; index < row.length; index++) {
    console.log(index, row[index])
}
```

위치 계산이 필요한 행렬 문제에는 인덱스 반복이 자연스럽다.

### 11.3 `for...in`은 객체의 키를 꺼낸다

```javascript
const user = {
    name: "Kim",
    age: 20
}

for (const key in user) {
    console.log(key, user[key])
}
```

배열에서는 `for...in`보다 `for...of` 또는 일반 `for`문을 사용한다. 배열의 값 순회와 객체 키 순회를 구분한다.

### 11.4 증가하는 반복 변수에는 `let`

```javascript
for (let row = 0; row < matrix.length; row++) {
}
```

`row++`로 값이 바뀌므로 `const`를 사용할 수 없다.

반면 `for...of`에서 매 반복마다 새로 바인딩되는 변수는 다시 대입하지 않으므로 `const`를 사용할 수 있다.

```javascript
for (const row of matrix) {
}
```

---

## 12. `map()` 콜백의 값과 인덱스

`map()`은 콜백에 현재 값과 현재 인덱스를 전달한다.

```javascript
array.map((value, index) => {
    return value
})
```

```javascript
const letters = ["a", "b", "c"]

letters.map((value, index) => {
    console.log(value, index)
    return value.toUpperCase()
})
```

```text
a 0
b 1
c 2
```

### 12.1 두 행렬의 같은 위치 계산

```javascript
function addMatrices(matrixA, matrixB) {
    return matrixA.map((row, r) =>
        row.map((value, c) =>
            value + matrixB[r][c]
        )
    )
}
```

변수의 의미:

```text
row   → matrixA의 현재 행
r     → 현재 행 인덱스
value → 현재 셀 값
c     → 현재 열 인덱스
```

`r`과 `c`로 `matrixB`의 같은 위치에 접근한다.

```javascript
matrixB[r][c]
```

### 12.2 `map()`을 선택하는 기준

`map()`은 각 입력 원소를 변환해 같은 개수의 결과 원소를 만들 때 적절하다.

```text
입력 행 하나 → 결과 행 하나
입력 셀 하나 → 결과 셀 하나
```

단순 출력이나 누적만 필요하면 `map()`보다 반복문, `forEach()`, `reduce()`가 목적에 더 맞을 수 있다.

---

## 13. 2차원 배열의 대각선과 테두리

다음 정사각 행렬을 사용한다.

```javascript
const matrix = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
]
```

### 13.1 메인 대각선

행 인덱스와 열 인덱스가 같다.

```text
[0][0] → 1
[1][1] → 5
[2][2] → 9
```

```javascript
const mainDiagonal = []

for (let r = 0; r < matrix.length; r++) {
    mainDiagonal.push(matrix[r][r])
}
```

### 13.2 반대 대각선

크기가 `n`인 정사각 행렬에서 열 인덱스는 `n - 1 - r`이다.

```text
r = 0 → c = 2 → [0][2] → 3
r = 1 → c = 1 → [1][1] → 5
r = 2 → c = 0 → [2][0] → 7
```

```javascript
const antiDiagonal = []

for (let r = 0; r < matrix.length; r++) {
    antiDiagonal.push(
        matrix[r][matrix.length - 1 - r]
    )
}
```

대각선 위치를 이미 계산할 수 있으므로 모든 셀을 도는 이중 반복문이 필요 없다.

### 13.3 위·아래 테두리

```javascript
const topBorder = [...matrix[0]]
const bottomBorder = [...matrix[matrix.length - 1]]
```

spread를 사용하면 행 배열 자체를 그대로 공유하지 않고 새 배열로 복사한다.

### 13.4 왼쪽·오른쪽 테두리

```javascript
const leftBorder = []
const rightBorder = []

for (let r = 0; r < matrix.length; r++) {
    leftBorder.push(matrix[r][0])
    rightBorder.push(
        matrix[r][matrix[r].length - 1]
    )
}
```

오른쪽 끝은 행마다 길이가 다를 수 있으므로 `matrix[r].length`를 사용했다.

### 13.5 전체 함수

```javascript
function getMatrixPatterns(matrix) {
    if (matrix.length === 0) {
        return {
            mainDiagonal: [],
            antiDiagonal: [],
            topBorder: [],
            bottomBorder: [],
            leftBorder: [],
            rightBorder: []
        }
    }

    const size = matrix.length
    const isSquare = matrix.every(
        row => row.length === size
    )

    if (!isSquare) {
        throw new TypeError(
            "대각선을 구하려면 정사각 행렬이어야 합니다."
        )
    }

    const mainDiagonal = []
    const antiDiagonal = []
    const leftBorder = []
    const rightBorder = []

    for (let r = 0; r < size; r++) {
        mainDiagonal.push(matrix[r][r])
        antiDiagonal.push(matrix[r][size - 1 - r])
        leftBorder.push(matrix[r][0])
        rightBorder.push(matrix[r][size - 1])
    }

    return {
        mainDiagonal,
        antiDiagonal,
        topBorder: [...matrix[0]],
        bottomBorder: [...matrix[size - 1]],
        leftBorder,
        rightBorder
    }
}
```

출력과 계산을 분리하면 반환값을 테스트하고 다른 코드에서 재사용하기 쉽다.

---

## 14. 행렬 코드에서 발생했던 오류 정리

### 14.1 값과 인덱스 비교

잘못된 코드:

```javascript
for (const row of matrix) {
    for (const col of row) {
        if (row === col) {
        }
    }
}
```

여기서 `row`는 배열이고 `col`은 원소 값이다.

```text
[1, 2, 3] === 1
```

메인 대각선 조건인 행 인덱스와 열 인덱스 비교가 아니다.

### 14.2 숫자에 `.length` 사용

```javascript
for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < r.length; c++) {
    }
}
```

`r`은 숫자이므로 배열 길이가 없다.

```javascript
c < matrix[r].length
```

처럼 현재 행의 길이를 확인해야 한다.

### 14.3 선언하지 않은 변수

```javascript
for (elem of matrix[0]) {
}
```

```javascript
for (const elem of matrix[0]) {
}
```

반복 변수도 `const` 또는 `let`으로 선언한다.

### 14.4 오타

```javascript
matirx.length
bottomBorderk.push(elem)
```

JavaScript는 존재하지 않는 변수 이름에서 실행 오류를 발생시킨다. 이름이 비슷한 변수는 편집기의 자동 완성과 린터 도움을 받고, 오류 메시지의 변수명을 원본 코드와 한 글자씩 비교한다.

---

## 15. 여러 2차원 배열을 수직으로 결합하기

입력은 2차원 배열 여러 개를 담은 3차원 배열이다.

```javascript
const matrixList = [
    [
        [1, 2],
        [3, 4]
    ],
    [
        [5, 6],
        [7, 8]
    ]
]
```

원하는 결과는 각 행을 순서대로 이어 붙인 2차원 배열이다.

```javascript
[
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8]
]
```

### 15.1 중첩 반복문

```javascript
function stackMatrices(matrixList) {
    const result = []

    for (const matrix of matrixList) {
        for (const row of matrix) {
            result.push(row)
        }
    }

    return result
}
```

현재 차원을 한 겹씩 내려간다.

```text
matrixList → matrix → row
   3차원       2차원    1차원
```

### 15.2 `flat(1)`

```javascript
function stackMatrices(matrixList) {
    return matrixList.flat(1)
}
```

`flat()`의 기본 깊이는 `1`이므로 바깥 배열 한 겹만 제거한다.

```text
3차원 → flat(1) → 2차원
```

### 15.3 행 배열은 여전히 공유될 수 있다

`flat()`은 행 내부까지 깊게 복사하지 않는다.

```javascript
const stacked = stackMatrices(matrixList)

stacked[0][0] = 999
matrixList[0][0][0] // 999
```

행까지 독립적으로 복사해야 한다면 다음처럼 작성한다.

```javascript
function stackMatrices(matrixList) {
    return matrixList.flat(1).map(row => [...row])
}
```

문제에서 단지 읽고 결과를 반환하기만 한다면 불필요한 깊은 복사를 추가할 필요는 없다. 이후 결과를 변경하는지에 따라 결정한다.

---

## 16. 들쭉날쭉한 2차원 배열 합계

행마다 길이가 달라도 각 행을 따로 순회하면 된다.

```javascript
const jaggedArray = [
    [1, 2],
    [3, 4, 5],
    [6]
]
```

### 16.1 읽기 쉬운 반복문

```javascript
function sumJagged(jaggedArray) {
    let sum = 0

    for (const row of jaggedArray) {
        for (const value of row) {
            sum += value
        }
    }

    return sum
}
```

모든 값을 한 번씩 확인하므로 이미 필요한 만큼 순회하는 코드다.

### 16.2 중첩 `reduce()`

```javascript
function sumJagged(jaggedArray) {
    return jaggedArray.reduce(
        (total, row) =>
            total + row.reduce(
                (rowSum, value) => rowSum + value,
                0
            ),
        0
    )
}
```

```text
각 행의 합
[1, 2]    → 3
[3, 4, 5] → 12
[6]       → 6

전체 합
3 + 12 + 6 → 21
```

`reduce()`가 반복문보다 자동으로 빠른 것은 아니다. 지금 단계에서는 실행 흐름을 더 명확히 설명할 수 있는 이중 `for...of`가 좋은 선택이다.

---

## 17. 3차원 배열에서 문자열 개수 세기

```javascript
const arr3D = [
    [
        ["a", 1],
        ["b", "c"]
    ],
    [
        [2, "d"]
    ]
]
```

문자열은 `"a"`, `"b"`, `"c"`, `"d"`로 총 4개다.

### 17.1 배열을 함수처럼 호출한 오류

잘못된 코드:

```javascript
arr((sum, elem) => sum + elem, 0)
```

`arr`은 배열인데 함수처럼 `arr(...)`로 호출했다. 배열 메서드를 사용하려면 점과 메서드 이름이 필요하다.

```javascript
arr.reduce(...)
```

또한 문자열 개수를 세는 문제에서 원소 자체를 더하면 안 된다. 각 원소가 문자열이면 `1`, 아니면 `0`을 더해야 한다.

```javascript
typeof elem === "string" ? 1 : 0
```

### 17.2 중첩 반복문

```javascript
function countAllStrings(arr3D) {
    let count = 0

    for (const arr2D of arr3D) {
        for (const row of arr2D) {
            for (const elem of row) {
                if (typeof elem === "string") {
                    count++
                }
            }
        }
    }

    return count
}
```

변수 이름으로 차원을 표시하면 현재 위치를 이해하기 쉽다.

```text
arr3D → arr2D → row → elem
```

### 17.3 중첩 `reduce()`

```javascript
function countAllStrings(arr3D) {
    return arr3D.reduce((total, arr2D) => {
        return total + arr2D.reduce((subTotal, row) => {
            return subTotal + row.reduce((rowTotal, elem) => {
                return rowTotal + (
                    typeof elem === "string" ? 1 : 0
                )
            }, 0)
        }, 0)
    }, 0)
}
```

문법상 가능하지만 누적 변수가 세 단계라 처음에는 읽기 어렵다.

### 17.4 `flat()`과 `filter()`

정확히 3차원 구조라면 두 겹을 펼쳐 실제 원소 배열로 만들 수 있다.

```javascript
function countAllStrings(arr3D) {
    return arr3D
        .flat(2)
        .filter(elem => typeof elem === "string")
        .length
}
```

```text
3차원
  ↓ flat(2)
1차원 원소 배열
  ↓ filter
문자열만 남김
  ↓ length
개수
```

이 방식은 중간 배열을 만들므로 입력이 매우 크다면 직접 순회가 메모리 사용 면에서 유리할 수 있다. 일반 학습 문제에서는 요구사항을 가장 잘 드러내는 방식을 선택한다.

---

## 18. 짧은 코드와 효율적인 코드를 구분한다

다음 세 코드는 같은 종류의 결과를 만들 수 있다.

```javascript
// 반복문
for (const row of matrix) {
}

// 배열 메서드
matrix.map(row => {
})

// 평탄화
matrix.flat()
```

하지만 줄 수가 적다고 항상 더 효율적이거나 좋은 코드는 아니다.

### 18.1 선택 기준

| 목적 | 우선 고려할 도구 |
| --- | --- |
| 값을 하나씩 읽으며 누적 | `for...of`, `reduce()` |
| 각 원소를 새 원소로 변환 | `map()` |
| 조건에 맞는 원소만 남김 | `filter()` |
| 중첩 배열 한 겹 제거 | `flat(1)` |
| 위치를 계산해 접근 | 인덱스 기반 `for` |
| 객체 키 순회 | `Object.keys/entries`, `for...in` |

### 18.2 시간 복잡도

모든 원소를 한 번씩 확인해야 하는 합계·개수 문제는 일반적으로 원소 수에 비례한 시간이 필요하다.

```text
전체 원소 수가 N개라면 O(N)
```

반복문을 `reduce()`로 바꿔도 확인할 원소 수는 줄지 않는다. 대각선처럼 위치를 계산할 수 있는 문제는 모든 셀을 검사하는 `O(N²)` 대신 대각선 원소만 읽는 `O(N)` 풀이가 가능하다.

---

## 19. 문제를 풀기 전에 적을 네 줄

코드를 바로 작성하기 전에 다음을 적는다.

### 19.1 입력 모양

```text
객체인가?
1차원, 2차원, 3차원 배열인가?
행 길이는 같은가?
빈 입력이 가능한가?
```

### 19.2 출력 모양

```text
숫자 하나인가?
객체인가?
몇 차원 배열인가?
출력하는가, 반환하는가?
```

### 19.3 현재 변수의 역할

```text
key      → 객체 속성 이름
value    → 객체 속성 값 또는 배열 원소
r, c     → 행·열 인덱스
row      → 실제 행 배열
matrix   → 2차원 배열
```

### 19.4 원본 변경 여부

```text
입력 객체를 직접 바꾸는가?
얕은 복사면 충분한가?
중첩 배열이나 객체까지 독립적이어야 하는가?
```

이 네 줄만 먼저 정리해도 점 표기법과 대괄호, `for...of`와 인덱스 반복, `flat()` 깊이를 잘못 선택하는 실수가 줄어든다.

---

## 20. 디버깅 순서

### 20.1 변수의 실제 값을 출력한다

```javascript
console.log({ row, col })
```

`row`가 인덱스라고 생각했는데 실제 배열이 출력된다면 반복 방식부터 고친다.

### 20.2 타입을 확인한다

```javascript
console.log(typeof book.isRead)
```

`boolean`을 기대했는데 `string`이 나오면 `"true"`와 `true`를 혼동한 것이다.

### 20.3 구조를 확인한다

```javascript
console.log(Array.isArray(value))
console.table(matrix)
```

### 20.4 오타를 확인한다

```text
matrix ↔ matirx
isRead ↔ isRaad
bottomBorder ↔ bottomBorderk
```

### 20.5 한 단계 작은 입력으로 실행한다

```javascript
const matrix = [
    [1, 2],
    [3, 4]
]
```

작은 입력에서는 손으로 예상 결과를 만들고 실제 결과와 비교하기 쉽다.

---

## 21. 핵심 요약

| 질문 | 핵심 답변 |
| --- | --- |
| JavaScript 객체와 JSON은 같은가? | 아니다. JSON은 문자열 데이터 형식이고 객체는 JavaScript 값이다. |
| 객체의 키·값은 어떻게 꺼내는가? | `Object.keys`, `Object.values`, `Object.entries`를 목적에 맞게 사용한다. |
| 배열에 값이 있는지 어떻게 찾는가? | `includes()`를 사용한다. `in`은 속성 이름이나 인덱스를 검사한다. |
| 동적 속성 이름에는 무엇을 쓰는가? | `obj[key]` 대괄호 표기법을 사용한다. |
| 상태를 뒤집을 때 문자열을 써야 하는가? | `true`·`false` boolean과 `!`를 사용하는 것이 일반적이다. |
| `for...of`의 변수에는 무엇이 들어오는가? | 인덱스가 아니라 실제 값이 들어온다. |
| `map((value, index) => ...)`의 두 인수는? | 현재 값과 현재 인덱스다. |
| 메인 대각선 위치는? | 정사각 행렬에서 `matrix[r][r]`이다. |
| 반대 대각선 위치는? | `matrix[r][size - 1 - r]`이다. |
| 3차원 행렬 목록을 2차원으로 합치려면? | 행을 중첩 순회하거나 `flat(1)`을 사용한다. |
| `reduce()`가 항상 더 효율적인가? | 아니다. 반복 횟수는 같을 수 있으며 읽기 쉬운 코드가 우선이다. |

---

## 22. 미니 퀴즈와 체크리스트

### 22.1 미니 퀴즈

1. `"age" in ["age", "city"]`가 `false`인 이유는 무엇인가?
2. `result.key`와 `result[key]`는 각각 어떤 속성을 찾는가?
3. `Object.keys(cart).length`와 `Object.values(cart)`는 각각 무엇을 구할 때 사용하는가?
4. `true`와 `"true"`는 왜 일치 비교에서 다르다고 나오는가?
5. `for (const row of matrix)`에서 `row`는 인덱스인가, 실제 행인가?
6. 일반 `for`문의 증가 변수에 `const`를 사용할 수 없는 이유는 무엇인가?
7. `map((row, r) => ...)`에서 `r`은 어디에 사용할 수 있는가?
8. 대각선을 구할 때 이중 반복문이 필요하지 않은 이유는 무엇인가?
9. `matrixList.flat(1)`이 3차원 배열을 2차원으로 만드는 이유는 무엇인가?
10. spread로 객체를 복사해도 중첩 객체가 공유될 수 있는 이유는 무엇인가?

### 22.2 실습 체크리스트

- [ ] `Object.keys`, `values`, `entries`의 결과를 직접 출력했다.
- [ ] `in`, `includes`, `Object.hasOwn`의 차이를 예제로 확인했다.
- [ ] 변수에 담긴 키로 `obj[key]` 속성을 읽고 삭제했다.
- [ ] 원본 수정 방식과 새 객체 반환 방식으로 toggle 함수를 각각 작성했다.
- [ ] spread와 rest를 같은 `...` 문법에서 구분했다.
- [ ] `for...of` 값 순회와 인덱스 기반 순회를 각각 사용했다.
- [ ] 메인·반대 대각선을 한 번의 반복으로 구했다.
- [ ] 중첩 반복문과 `flat(1)` 두 방식으로 행렬을 합쳤다.
- [ ] 3차원 배열의 문자열 개수를 반복문으로 계산했다.
- [ ] `reduce()`로 바꾼 코드가 정말 더 읽기 쉬운지 비교했다.

---

## 참고 자료

- [MDN - `in` operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in)
- [MDN - `Array.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes)
- [MDN - Property accessors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors)
- [MDN - Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)
- [MDN - `Object.keys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys)
- [MDN - `Object.values()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values)
- [MDN - `Array.prototype.map()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
- [MDN - `Array.prototype.reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce)
- [MDN - `Array.prototype.flat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat)

> 정리 기준일: 2026-08-23
