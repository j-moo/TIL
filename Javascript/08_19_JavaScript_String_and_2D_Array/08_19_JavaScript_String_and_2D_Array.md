# JavaScript 문자열 판별과 2차원 배열 다루기

- 🎯 글의 목표: 문자열의 각 문자를 판별하고, 2차원 배열에서 열을 추출하거나 같은 위치의 값을 계산하는 방법을 이해한다.
- 🧩 핵심 키워드: 문자열 순회, 정규 표현식, `test`, `Number.isNaN`, `map`, `filter`, 2차원 배열, 행렬
- ⭐ 중요도: ★★★★★ — 배열 메서드의 콜백이 반환하는 값의 의미를 혼동하면 실행은 되지만 전혀 다른 모양의 결과가 만들어진다.
- 📝 한눈에 보는 내용: 값을 남길 때는 `filter`, 값을 꺼내거나 바꿀 때는 `map`을 사용한다. 문자열의 숫자 문자는 정규 표현식으로 직접 판별할 수 있으며, 2차원 배열은 `행 → 열` 순서로 접근한다.
- 🔗 관련 주제: 배열 리팩터링, 중첩 반복문, 정규 표현식, TypeScript 배열 타입
- 🧱 선수 지식: 문자열, 배열, 함수, 조건문, `for...of`

---

## 1. 들어가며

문자열과 2차원 배열 문제는 겉모양이 달라도 같은 질문에서 시작한다.

> 입력의 각 요소를 **선택**해야 하는가, **변환**해야 하는가, 아니면 **누적**해야 하는가?

예를 들어 2차원 배열에서 특정 열을 꺼내려면 행을 버리는 것이 아니라 각 행에서 값 하나를 꺼내야 한다. 따라서 `filter()`가 아니라 `map()`이 알맞다. 두 행렬의 같은 위치를 더할 때도 각 행과 각 열을 같은 모양으로 변환하므로 중첩된 `map()`이나 중첩 반복문을 사용할 수 있다.

## 2. 먼저 결과의 모양을 정한다

코드를 작성하기 전에 입력과 출력의 모양을 적으면 메서드 선택이 쉬워진다.

```text
문자열에서 숫자 제거
문자열 → 문자열

특정 열 추출
2차원 배열 → 1차원 배열

두 행렬 계산
2차원 배열 2개 → 같은 크기의 2차원 배열
```

| 원하는 결과 | 적합한 도구 | 콜백 반환값의 의미 |
| --- | --- | --- |
| 조건에 맞는 기존 요소만 유지 | `filter()` | 참이면 현재 요소를 유지 |
| 각 요소에서 새 값을 계산 | `map()` | 반환값을 새 배열의 요소로 사용 |
| 여러 요소를 하나로 합침 | `reduce()` | 반환값을 다음 누적값으로 사용 |
| 반복 중 건너뛰거나 종료 | `for...of` | `continue`, `break`로 흐름 제어 |

## 3. 문자열에서 숫자 문자를 판별하기

### 3.1 `/\d/.test(character)`를 읽는 방법

정규 표현식 `/\d/`에서 `\d`는 일반적으로 ASCII 숫자 `0`부터 `9`까지의 한 문자를 뜻한다. `test()`는 주어진 문자열 안에 패턴과 일치하는 부분이 있는지 검사해 `true` 또는 `false`를 반환한다.

```js
console.log(/\d/.test('7')) // true: 숫자 문자가 있다.
console.log(/\d/.test('A')) // false: 숫자 문자가 없다.
console.log(/\d/.test('A7')) // true: 문자열 어딘가에 숫자가 있다.
```

한 문자씩 순회하는 상황이라면 다음처럼 읽을 수 있다.

```js
function removeAsciiDigits(text) {
  const characters = []

  for (const character of text) {
    // 현재 문자가 0~9 중 하나라면 결과에 넣지 않고 다음 반복으로 이동한다.
    if (/\d/.test(character)) {
      continue
    }

    // 숫자가 아닌 문자만 결과 배열에 저장한다.
    characters.push(character)
  }

  // 문자 배열을 하나의 문자열로 다시 합친다.
  return characters.join('')
}

console.log(removeAsciiDigits('room8-floor2')) // room-floor
```

`test()`는 문자열을 검사하는 함수다. 반면 `isNaN()` 계열은 값이 숫자인지 판별하는 과정과 관련 있으므로 목적이 다르다.

### 3.2 `isNaN()`과 `Number.isNaN()`은 숫자 문자 검사가 아니다

전역 `isNaN()`은 먼저 값을 숫자로 변환하려고 한다. 이 자동 변환 때문에 결과가 직관적이지 않을 수 있다.

```js
console.log(isNaN('7')) // false: '7'을 숫자 7로 변환할 수 있다.
console.log(isNaN('')) // false: 빈 문자열이 숫자 0으로 변환된다.
console.log(isNaN('hello')) // true: 숫자로 변환할 수 없다.
```

`Number.isNaN()`은 자동 형 변환을 하지 않고, 전달받은 값이 실제 숫자 타입의 `NaN`인지 확인한다.

```js
console.log(Number.isNaN(NaN)) // true
console.log(Number.isNaN('7')) // false: 문자열이며 NaN이 아니다.
console.log(Number.isNaN('hello')) // false: 문자열이며 NaN이 아니다.
```

따라서 문자 하나가 `0`부터 `9`인지 확인하는 문제에서는 `/\d/.test(character)` 또는 범위 비교가 의도를 더 잘 드러낸다.

```js
function isAsciiDigit(character) {
  // 문자열 비교에서도 '0'부터 '9'까지의 한 글자인지 확인할 수 있다.
  return character >= '0' && character <= '9'
}
```

## 4. 문자열 변환은 여러 단계를 한 흐름으로 읽는다

두 문자열을 이어 붙이고, 숫자를 제외하고, 모음을 대문자로 바꾸는 작업을 생각해 보자.

```text
입력 결합 → 문자 순회 → 숫자 제외 → 모음 변환 → 문자열 반환
```

가독성과 불필요한 중간 배열 생성을 함께 고려하면 한 번의 반복으로 표현할 수 있다.

```js
function weaveText(firstText, secondText) {
  // includes()로 모음 여부를 확인하기 위한 기준 문자열이다.
  const vowels = 'aeiouAEIOU'
  const result = []

  // 두 문자열을 먼저 연결한 뒤 왼쪽부터 한 문자씩 확인한다.
  for (const character of firstText + secondText) {
    // 숫자 문자는 결과에서 제외한다.
    if (/\d/.test(character)) {
      continue
    }

    // 모음이면 대문자로 바꾸고, 그 밖의 문자는 원래 값을 유지한다.
    const convertedCharacter = vowels.includes(character)
      ? character.toUpperCase()
      : character

    result.push(convertedCharacter)
  }

  return result.join('')
}

console.log(weaveText('code2', 'array7')) // cOdEArrAy
```

시간 복잡도는 두 문자열의 전체 길이를 `n`이라고 할 때 `O(n)`이다. `filter()`와 `map()`을 연속으로 사용해도 둘 다 `O(n)`이지만 배열을 단계마다 새로 만든다. 입력이 작다면 선언적인 코드가 더 읽기 쉬울 수도 있으므로 반복 횟수만 보고 무조건 한 방식을 고르지는 않는다.

## 5. `filter()`와 `map()`의 차이를 결과로 확인하기

다음 2차원 배열을 사용한다.

```js
const scores = [
  [80, 90, 70],
  [60, 0, 85],
  [95, 75, 100],
]
```

### 5.1 `filter()`는 행을 남기거나 버린다

```js
const filteredRows = scores.filter((row) => row[1])
```

콜백이 반환하는 `row[1]`은 결과 배열에 넣을 새 값이 아니다. 참 또는 거짓으로 평가되어 **현재 행 전체를 유지할지** 결정한다.

```text
[80, 90, 70]  → row[1]은 90 → truthy → 행 전체 유지
[60, 0, 85]   → row[1]은 0  → falsy  → 행 전체 제거
[95, 75, 100] → row[1]은 75 → truthy → 행 전체 유지
```

결과는 열 값 배열이 아니라 일부 행으로 이루어진 2차원 배열이다.

```js
console.log(filteredRows)
// [[80, 90, 70], [95, 75, 100]]
```

특히 `0`도 정상 데이터일 수 있는데 falsy라서 행이 사라진다는 문제가 있다.

### 5.2 `map()`은 각 행에서 열 값을 꺼낸다

```js
function getColumn(matrix, columnIndex) {
  return matrix.map((row) => {
    // 각 행에서 같은 열 위치의 값을 반환한다.
    // 이 반환값들이 모여 새로운 1차원 배열이 된다.
    return row[columnIndex]
  })
}

console.log(getColumn(scores, 1)) // [90, 0, 75]
```

`numberOfRows` 같은 별도 인자는 `matrix.length`로 알 수 있으므로 단순 열 추출에는 필요하지 않다. 다만 열 번호가 유효한지 검증하고 싶다면 다음처럼 명시할 수 있다.

```js
function getColumnSafely(matrix, columnIndex) {
  if (!Number.isInteger(columnIndex) || columnIndex < 0) {
    throw new RangeError('열 인덱스는 0 이상의 정수여야 합니다.')
  }

  return matrix.map((row, rowIndex) => {
    if (columnIndex >= row.length) {
      throw new RangeError(`${rowIndex}번 행에 요청한 열이 없습니다.`)
    }

    return row[columnIndex]
  })
}
```

## 6. 두 행렬의 같은 위치를 계산하기

행렬 계산에서는 위치를 두 개 사용한다.

```text
matrix[rowIndex][columnIndex]
       행 위치     열 위치
```

다음 함수는 같은 크기의 두 행렬을 더하거나 뺀다.

```js
function combineMatrices(matrixA, matrixB, operator) {
  // 바깥 map은 각 행을 새 행으로 바꾼다.
  return matrixA.map((row, rowIndex) => {
    // 안쪽 map은 현재 행의 각 셀을 계산된 값으로 바꾼다.
    return row.map((valueA, columnIndex) => {
      // 같은 행·열 위치에 있는 matrixB의 값을 찾는다.
      const valueB = matrixB[rowIndex][columnIndex]

      // 연산자가 '+'이면 덧셈하고, 그 밖의 허용된 값 '-'이면 뺀다.
      return operator === '+' ? valueA + valueB : valueA - valueB
    })
  })
}

const matrixA = [
  [1, 2],
  [3, 4],
]

const matrixB = [
  [10, 20],
  [30, 40],
]

console.log(combineMatrices(matrixA, matrixB, '+'))
// [[11, 22], [33, 44]]
```

실행 흐름을 첫 번째 행만 펼치면 다음과 같다.

```text
rowIndex = 0
  columnIndex = 0 → 1 + 10 = 11
  columnIndex = 1 → 2 + 20 = 22
  새 행 [11, 22]
```

### 6.1 입력 계약을 검증하는 버전

학습 문제에서 두 행렬의 크기와 연산자가 항상 올바르다고 보장한다면 위 코드로 충분하다. 실제 함수라면 잘못된 입력을 조용히 뺄셈으로 처리하지 않도록 검증한다.

```js
function combineMatricesSafely(matrixA, matrixB, operator) {
  if (operator !== '+' && operator !== '-') {
    throw new TypeError("연산자는 '+' 또는 '-'여야 합니다.")
  }

  if (matrixA.length !== matrixB.length) {
    throw new RangeError('두 행렬의 행 개수가 다릅니다.')
  }

  return matrixA.map((rowA, rowIndex) => {
    const rowB = matrixB[rowIndex]

    if (rowA.length !== rowB.length) {
      throw new RangeError(`${rowIndex}번 행의 열 개수가 다릅니다.`)
    }

    return rowA.map((valueA, columnIndex) => {
      const valueB = rowB[columnIndex]
      return operator === '+' ? valueA + valueB : valueA - valueB
    })
  })
}
```

두 행렬의 전체 셀 개수를 `n`이라고 하면 모든 셀을 한 번씩 계산하므로 시간 복잡도는 `O(n)`이다. 새 결과 행렬을 만들기 때문에 결과 저장 공간도 `O(n)`이 필요하다.

## 7. 적용 관점에서 다시 보기

문제를 받으면 다음 순서로 손으로 그려 본다.

1. 입력과 출력이 문자열, 1차원 배열, 2차원 배열 중 무엇인지 적는다.
2. 기존 요소를 선택하는지, 각 요소에서 새 값을 만드는지 구분한다.
3. 2차원 배열이라면 행 위치와 열 위치를 따로 이름 붙인다.
4. `0`, 빈 문자열처럼 falsy지만 정상일 수 있는 데이터를 확인한다.
5. 배열의 크기가 다르거나 인덱스가 범위를 벗어난 경우의 정책을 정한다.
6. 반환된 결과뿐 아니라 원본 배열이 바뀌지 않았는지도 확인한다.

## 8. 요약 정리

1. `/\d/.test(character)`는 문자열에 숫자 패턴이 있는지 불리언으로 알려 준다.
2. `Number.isNaN()`은 숫자 문자 검사가 아니라 값이 실제 `NaN`인지 확인한다.
3. `filter()` 콜백의 반환값은 현재 요소를 유지할지 결정한다.
4. `map()` 콜백의 반환값은 새 배열에 들어갈 값이 된다.
5. 특정 열을 추출할 때는 각 행을 열 값으로 변환하므로 `map()`이 맞다.
6. 행렬 연산에서는 `matrix[rowIndex][columnIndex]`로 같은 위치를 찾는다.
7. 실제 코드에서는 연산자, 인덱스, 두 행렬의 크기를 검증해야 한다.

🧠 기억할 것: **조건에 맞는 원본 요소를 남기면 `filter`, 각 요소에서 필요한 값을 꺼내거나 바꾸면 `map`이다.**

## 9. 미니 퀴즈

1. `['A', '7'].filter((value) => /\d/.test(value))`의 결과는 무엇인가?
2. `Number.isNaN('hello')`가 `false`인 이유는 무엇인가?
3. `matrix.filter((row) => row[2])`가 세 번째 열 배열을 만들지 못하는 이유는 무엇인가?
4. `matrix.map((row) => row[2])`에서 콜백의 반환값은 어디에 사용되는가?
5. 두 행렬의 크기가 다를 때 어떤 문제가 발생할 수 있는가?

<details>
<summary>정답과 해설</summary>

1. `['7']`이다. 숫자 패턴을 포함한 기존 요소만 유지한다.
2. 문자열은 숫자 타입의 `NaN`이 아니며 `Number.isNaN()`은 자동 형 변환을 하지 않기 때문이다.
3. `filter()`는 `row[2]`의 참·거짓으로 행 전체를 남기거나 제거하기 때문이다.
4. 각 반환값이 새 1차원 배열의 요소가 된다.
5. 존재하지 않는 행이나 열에 접근해 `undefined`를 사용하거나 오류가 발생할 수 있다.

</details>

## 참고 자료

- [MDN — Array.prototype.filter()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter)
- [MDN — Array.prototype.map()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
- [MDN — Number.isNaN()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN)
- [MDN — RegExp.prototype.test()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test)
