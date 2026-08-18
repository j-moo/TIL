# JavaScript 배열 코드를 올바르게 리팩터링하는 기준

- 🎯 글의 목표: 배열 코드를 짧게 만드는 것보다 반환값·원본 변경·조건의 의미를 정확히 파악하고, 읽기 쉽고 검증 가능한 코드로 개선한다.
- 🧩 핵심 키워드: `map`, `filter`, `reduce`, `forEach`, `splice`, truthy, 불변성, 반환값, 리팩터링
- ⭐ 중요도: ★★★★★ — 메서드의 목적과 반환값을 혼동하면 코드가 실행되어도 결과가 사라지거나 원본 데이터가 예상과 다르게 바뀔 수 있다.
- 📝 한눈에 보는 내용: 먼저 함수의 입력과 출력 계약을 정하고, 새 배열이 필요한지 원본을 바꿀지 판단한다. 이후 목적에 맞는 배열 메서드를 선택하고 작은 입력으로 결과를 검증한다.
- 🔗 관련 주제: 함수, 콜백, 화살표 함수, 참조 자료형, React state
- 🧱 선수 지식: 배열, 함수, 조건문, 화살표 함수

---

## 1. 들어가며

코드를 개선해 달라고 할 때 흔히 “더 짧은 코드”를 떠올린다. 그러나 줄 수가 적다고 항상 효율적인 코드는 아니다. 결과가 정확하고, 의도가 드러나며, 다음 사람이 실수 없이 수정할 수 있어야 좋은 코드다.

예를 들어 `map()`으로 새 배열을 만들고도 반환값을 저장하지 않으면 계산 결과가 사라진다. 빈 배열을 `if (items)`로 검사하면 배열이 비어 있어도 조건은 참이 된다. 두 코드 모두 문법 오류 없이 실행되므로 동작 원리를 알아야 문제를 찾을 수 있다.

이 문서에서는 실제 배열 코드를 고칠 때 반복해서 사용하는 판단 순서를 정리한다.

## 2. 핵심 개념 정리

```text
함수가 해야 할 일과 반환값 확인
              ↓
원본 배열을 바꿀지 새 배열을 만들지 결정
              ↓
순회 목적에 맞는 메서드 선택
              ↓
메서드 반환값을 저장하거나 반환
              ↓
빈 배열·경계값·원본 변경 여부 검증
```

배열 메서드는 모양이 비슷하지만 책임이 다르다.

| 원하는 작업 | 우선 검토할 도구 | 핵심 결과 |
| --- | --- | --- |
| 각 요소마다 출력·저장 같은 행동 수행 | `forEach` | 메서드 반환값은 `undefined` |
| 각 요소를 바꿔 같은 길이의 새 배열 생성 | `map` | 새 배열 |
| 조건에 맞는 요소만 선택 | `filter` | 새 배열 |
| 여러 요소를 하나의 값이나 객체로 집계 | `reduce` | 누적 결과 |
| 중간에 반복을 종료 | `for...of` | `break` 사용 가능 |
| 원본 배열 일부 삭제·교체 | `splice` | 삭제된 요소 배열, 원본 변경 |

## 3. 본문 정리

### 3.1 리팩터링은 동작을 보존하면서 구조를 개선하는 일이다

리팩터링(refactoring)은 외부에서 관찰되는 동작을 유지하면서 코드 내부 구조를 개선하는 작업이다. 따라서 코드를 바꾸기 전에 함수의 계약부터 적어야 한다.

```text
입력: 숫자 배열
처리: 홀수만 두 배로 바꿈
출력: 변환된 새 배열
원본: 변경하지 않음
```

이 계약이 있으면 `forEach`보다 `map`이 어울린다는 사실을 판단할 수 있다. 반대로 장바구니에서 항목을 직접 제거하는 함수라면 원본 변경을 허용할지 먼저 결정해야 한다.

좋은 리팩터링은 다음 순서로 확인한다.

1. 현재 코드의 정상 입력과 출력부터 기록한다.
2. 오류가 있다면 리팩터링과 오류 수정을 구분한다.
3. 이름과 제어 흐름을 단순화한다.
4. 같은 입력으로 변경 전후 결과를 비교한다.
5. 빈 배열, 요소 하나, 중복 요소 같은 경계값도 확인한다.

### 3.2 `map()`은 원본이 아니라 새 배열을 반환한다

`map()`은 각 요소에 콜백을 적용하고 콜백의 반환값을 모아 새 배열을 만든다. 원본 배열을 자동으로 바꾸지 않는다.

```js
function doubleOddNumbers(numbers) {
  // map이 만든 새 배열을 함수의 결과로 바로 반환한다.
  return numbers.map((number) => {
    // 홀수면 두 배로 만들고, 짝수면 기존 값을 유지한다.
    return number % 2 !== 0 ? number * 2 : number
  })
}

const original = [1, 2, 3, 4]
const changed = doubleOddNumbers(original)

console.log(changed) // [2, 2, 6, 4]
console.log(original) // [1, 2, 3, 4]
```

다음 코드는 계산은 수행하지만 그 결과를 사용하지 않는다.

```js
function doubleOddNumbers(numbers) {
  numbers.map((number) => (number % 2 !== 0 ? number * 2 : number))

  // map은 numbers를 바꾸지 않았으므로 원본이 그대로 반환된다.
  return numbers
}
```

⚠️ 주의: `map()` 콜백에 중괄호를 사용하면 `return`을 직접 작성해야 한다.

```js
// 표현식 본문은 값을 자동 반환한다.
const doubledA = [1, 2].map((number) => number * 2)

// 블록 본문은 return이 없으므로 각 결과가 undefined가 된다.
const doubledB = [1, 2].map((number) => {
  number * 2
})

console.log(doubledA) // [2, 4]
console.log(doubledB) // [undefined, undefined]
```

### 3.3 `forEach()`의 인덱스는 0부터 시작한다

JavaScript 배열의 첫 요소 위치는 `0`이다. 따라서 `forEach()`가 전달하는 `index`도 0부터 시작한다. 저장 위치와 사용자에게 보여 주는 번호를 분리하면 된다.

```js
const groceries = ['우유', '빵', '달걀']

groceries.forEach((item, index) => {
  // index는 실제 배열 위치다: 0, 1, 2
  // 화면 번호만 index + 1로 바꾼다: 1, 2, 3
  console.log(`${index + 1}. ${item}`)
})
```

배열 인덱스 자체를 1부터 시작하게 바꾸는 것이 아니다. 인덱스를 바꾸면 `groceries[0]` 같은 JavaScript의 기본 규칙과 어긋난다. 필요한 순간에 표시 값만 변환한다.

### 3.4 빈 배열은 조건문에서 참으로 평가된다

JavaScript에서 배열은 객체다. 객체는 내용이 비어 있어도 truthy, 즉 조건문에서 참으로 평가된다.

```js
const groceries = []

if (groceries) {
  // 빈 배열도 truthy이므로 이 블록이 실행된다.
  console.log('목록이 있습니다.')
}
```

배열에 요소가 있는지 확인하려면 `length`를 비교한다.

```js
function printGroceryList(groceries) {
  if (groceries.length === 0) {
    console.log('장보기 목록이 비어 있습니다.')
    return
  }

  console.log('장보기 목록')

  groceries.forEach((item, index) => {
    console.log(`${index + 1}. ${item}`)
  })
}
```

여기에서는 빈 경우를 먼저 처리하고 `return`하는 조기 반환(early return)을 사용했다. 이후 코드는 “요소가 하나 이상 있다”는 전제만 생각하면 되므로 중첩이 줄어든다.

### 3.5 `splice(start, deleteCount)`의 두 숫자는 범위가 아니다

`splice()`의 두 번째 인자는 끝 위치가 아니라 삭제할 개수다.

```text
splice(시작 인덱스, 삭제할 요소 개수)
```

```js
const groceries = ['우유', '빵', '달걀', '사과']
const breadIndex = groceries.indexOf('빵') // 1

// 인덱스 1부터 요소 1개를 삭제한다.
const removed = groceries.splice(breadIndex, 1)

console.log(removed) // ['빵']
console.log(groceries) // ['우유', '달걀', '사과']
```

`splice(1, 2)`라면 인덱스 1과 2의 요소, 총 두 개를 삭제한다. Python 슬라이스처럼 `1부터 2 직전까지`라는 뜻이 아니다.

`indexOf()`는 요소를 찾지 못하면 `-1`을 반환한다. 확인 없이 `splice(-1, 1)`을 실행하면 마지막 요소가 삭제될 수 있다.

```js
function removeItem(groceries, itemToRemove) {
  const index = groceries.indexOf(itemToRemove)

  if (index === -1) {
    return false
  }

  // 찾은 위치부터 정확히 한 요소를 삭제한다.
  groceries.splice(index, 1)
  return true
}
```

이 함수는 원본 배열을 변경한다. React state처럼 원본 변경을 피해야 하는 환경에서는 `filter()`로 새 배열을 만든다.

```js
function withoutItem(groceries, itemToRemove) {
  // 제거 대상이 아닌 요소만 남겨 새 배열을 반환한다.
  return groceries.filter((item) => item !== itemToRemove)
}
```

중복 항목이 있다면 `splice()` 예시는 첫 번째 일치 항목 하나만 지우지만, `filter()` 예시는 같은 값을 모두 제외한다. 원하는 정책을 먼저 정해야 한다.

### 3.6 `reduce()`는 누적 상태를 다음 반복에 전달한다

`reduce()`는 배열을 한 번 순회하며 누적값(accumulator)을 갱신하고 마지막 누적값 하나를 반환한다.

```js
const sum = [10, 20, 30].reduce((accumulator, number) => {
  return accumulator + number
}, 0)

console.log(sum) // 60
```

실행 과정을 표로 펼치면 다음과 같다.

| 반복 | 이전 누적값 | 현재 요소 | 콜백 반환값 |
| ---: | ---: | ---: | ---: |
| 시작 | `0` | - | `0` |
| 1 | `0` | `10` | `10` |
| 2 | `10` | `20` | `30` |
| 3 | `30` | `30` | `60` |

초기값 `0`은 단순 장식이 아니다. 첫 누적값의 타입과 의미를 정한다. 객체를 만들고 싶다면 초기값도 필요한 객체 모양으로 시작한다.

```js
function summarizeAffordableItems(prices, items, budget) {
  const initialResult = {
    affordableItems: [],
    totalCost: 0,
    overBudgetCount: 0,
  }

  return prices.reduce((result, price, index) => {
    const item = items[index]

    if (price <= budget) {
      // 조건에 맞는 항목 이름과 가격 합계를 함께 누적한다.
      result.affordableItems.push(item)
      result.totalCost += price
    } else {
      // 조건을 통과하지 못한 항목 수를 누적한다.
      result.overBudgetCount += 1
    }

    // 다음 반복에서 사용할 누적 객체를 반드시 반환한다.
    return result
  }, initialResult)
}
```

이 예시는 학습을 위해 하나의 순회에서 여러 결과를 만든다. 그러나 누적 객체를 직접 변경하므로 불변성이 중요한 코드에서는 새 객체를 반환하거나, 가독성을 위해 명시적인 `for...of` 반복문을 선택할 수도 있다. `reduce()`를 사용했다는 이유만으로 항상 더 효율적이거나 더 좋은 것은 아니다.

### 3.7 짧은 코드와 효율적인 코드는 같은 말이 아니다

문자열의 짝수 위치는 대문자, 홀수 위치는 소문자로 바꾸는 예를 보자.

```js
function formatAlternatingCase(text) {
  return Array.from(text, (character, index) => {
    return index % 2 === 0
      ? character.toUpperCase()
      : character.toLowerCase()
  }).join('')
}
```

`Array.from()`은 문자열을 문자 배열로 만들면서 변환 콜백을 적용한다. `join('')`은 변환한 문자들을 다시 문자열로 합친다. 의도가 선언적으로 드러나는 장점이 있다.

반면 아주 긴 문자열과 성능이 중요한 경로라면 단순 반복문도 좋은 선택이다.

```js
function formatAlternatingCaseWithLoop(text) {
  const characters = []

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    characters.push(
      index % 2 === 0
        ? character.toUpperCase()
        : character.toLowerCase(),
    )
  }

  return characters.join('')
}
```

두 코드 모두 시간 복잡도는 입력 길이를 `n`이라고 할 때 `O(n)`이다. 실제 성능 차이는 엔진과 입력 크기에 따라 달라질 수 있으므로 측정 없이 짧은 쪽이 빠르다고 단정하지 않는다.

### 3.8 출력과 반환은 책임이 다르다

`console.log()`는 개발자에게 값을 보여 주지만 호출한 코드에 결과를 전달하지 않는다. 함수에 `return`이 없으면 반환값은 `undefined`다.

```js
function sumPrices(prices) {
  const total = prices.reduce((sum, price) => sum + price, 0)
  console.log(total)
}

const result = sumPrices([1000, 2000])
console.log(result) // undefined
```

계산 함수는 값을 반환하고, 출력은 바깥에서 담당하게 나누면 재사용과 테스트가 쉬워진다.

```js
function sumPrices(prices) {
  return prices.reduce((sum, price) => sum + price, 0)
}

const total = sumPrices([1000, 2000])
console.log(total) // 3000
```

## 4. 적용 관점에서 다시 보기

배열 코드를 고칠 때 다음 질문을 순서대로 사용한다.

1. 함수가 값을 반환해야 하는가, 화면에 출력만 해야 하는가?
2. 원본 배열을 바꿔도 되는가?
3. 결과가 새 배열인가, 일부 요소인가, 하나의 집계값인가?
4. 빈 배열과 요소를 찾지 못한 경우는 어떻게 처리하는가?
5. 콜백의 반환값을 다음 단계가 실제로 사용하고 있는가?
6. 더 짧아진 코드가 오히려 의도를 숨기지 않는가?

디버깅할 때는 중간값을 무작정 많이 출력하기보다 메서드 직전의 입력, 메서드 반환값, 원본 배열의 변경 여부를 각각 확인한다.

```js
console.log({ before: numbers })
const result = numbers.map((number) => number * 2)
console.log({ result, after: numbers })
```

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

- `map()`은 원본을 바꾸지 않으므로 반환값을 사용해야 한다.
- 배열 인덱스는 0부터 시작하지만 표시 번호는 `index + 1`로 바꿀 수 있다.
- 빈 배열은 truthy이므로 비어 있는지는 `length`로 확인한다.
- `splice()`의 두 번째 인자는 끝 위치가 아니라 삭제 개수다.
- `reduce()`의 콜백은 다음 반복에 전달할 누적값을 반드시 반환해야 한다.

### 5.2 이전·다음 학습과의 연결

원본을 바꾸는 메서드와 새 배열을 만드는 메서드의 차이는 React state를 안전하게 갱신할 때 그대로 연결된다. 이후에는 얕은 복사, 순수 함수, 불변성, 시간·공간 복잡도를 함께 학습한다.

### 5.3 더 확인할 주제

- `toSpliced()`처럼 원본을 바꾸지 않는 배열 메서드
- Unicode 문자를 순회할 때 `text[index]`와 `Array.from(text)`의 차이
- 큰 데이터에서 반복문과 배열 메서드의 실제 성능 측정

## 6. 요약 정리

- 리팩터링은 동작을 보존하면서 구조를 개선하는 작업이다.
- 배열 메서드는 줄 수가 아니라 원하는 결과의 형태로 선택한다.
- `map()`은 새 배열을 반환하며 원본을 자동으로 바꾸지 않는다.
- `forEach()`는 실행용이며 자체 반환값은 `undefined`다.
- 배열의 실제 인덱스는 0부터 시작하고 표시 번호만 바꾼다.
- 빈 배열은 참으로 평가되므로 `length === 0`으로 검사한다.
- `splice(start, deleteCount)`는 원본을 변경한다.
- `reduce()`는 콜백이 반환한 누적값을 다음 반복으로 전달한다.
- 계산 결과는 `console.log()`보다 `return`으로 전달해야 재사용하기 쉽다.

🧠 기억할 것: **효율적인 코드는 가장 짧은 코드가 아니라, 입력·출력·변경 범위가 분명하고 틀렸을 때 원인을 찾기 쉬운 코드다.**

## 7. 미니 퀴즈 또는 체크리스트

1. `map()`을 호출했는데 원본 배열이 그대로인 이유는 무엇인가?
2. `if ([])`의 조건은 참일까, 거짓일까?
3. `splice(2, 1)`에서 `1`은 어떤 뜻인가?
4. `forEach()`의 인덱스를 화면에서 1부터 표시하려면 어떻게 해야 하는가?
5. `reduce()` 콜백에서 누적값을 반환하지 않으면 다음 반복에 어떤 값이 전달되는가?
6. 계산 함수 안에서 출력만 하는 것보다 값을 반환하는 편이 좋은 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. `map()`은 변환 결과를 새 배열로 반환하며 원본을 자동으로 수정하지 않기 때문이다.
2. 참이다. 빈 배열도 객체이므로 truthy다.
3. 인덱스 2부터 삭제할 요소의 개수가 1개라는 뜻이다.
4. 배열 인덱스는 유지하고 출력할 때 `index + 1`을 사용한다.
5. 첫 반복 뒤 누적값이 `undefined`가 되어 이후 계산이 깨질 수 있다.
6. 반환값은 다른 함수에서 재사용하고 테스트할 수 있지만 출력은 화면에 표시하는 부수 효과로 끝나기 때문이다.

</details>

## 참고 자료

- [MDN — Array.prototype.map()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
- [MDN — Array.prototype.splice()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice)
- [MDN — Array.prototype.reduce()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce)
