# JavaScript 참조와 복사: 얕은 복사, 깊은 복사, 불변성

- 🎯 글의 목표: 객체와 배열을 대입하거나 복사했을 때 무엇이 공유되는지 이해하고, 중첩 데이터를 원본 변경 없이 안전하게 갱신한다.
- 🧩 핵심 키워드: 원시값, 객체 참조, 별칭, 얕은 복사, 깊은 복사, 전개 구문, `structuredClone`, 불변성
- ⭐ 중요도: ★★★★★ — 참조 공유를 놓치면 한 곳의 수정이 다른 데이터까지 바꾸고, React에서는 state 변경을 감지하기 어려운 오류로 이어질 수 있다.
- 📝 한눈에 보는 내용: 객체를 다른 변수에 대입하면 두 변수가 같은 객체를 가리킬 수 있다. 전개 구문은 바깥 객체만 새로 만드는 얕은 복사이므로, 중첩 값을 바꿀 때는 변경 경로의 객체를 각각 새로 만들어야 한다.
- 🔗 관련 주제: 배열 메서드, 순수 함수, React state, TypeScript `readonly`, 메모이제이션
- 🧱 선수 지식: 변수, 객체, 배열, 함수, 전개 구문

---

## 1. 들어가며

다음 코드는 `copiedProfile`만 수정한 것처럼 보이지만 원본도 바뀐다.

```js
const originalProfile = {
  nickname: '새싹',
  level: 1,
}

const copiedProfile = originalProfile
copiedProfile.level = 2

console.log(originalProfile.level) // 2
```

`const copiedProfile = originalProfile`은 객체를 복제한 코드가 아니다. 두 변수가 같은 객체를 가리키게 만든 코드다. 이 차이를 이해해야 함수의 부수 효과, 객체 비교, React state 갱신을 올바르게 다룰 수 있다.

```text
값과 참조의 차이
        ↓
대입으로 생기는 참조 공유
        ↓
얕은 복사의 범위와 한계
        ↓
변경 경로만 복사하는 불변 갱신
        ↓
깊은 복사가 필요한 경우와 structuredClone
```

## 2. 원시값과 객체를 구분한다

이 학습에서는 JavaScript 값을 원시값과 객체로 나누어 생각한다.

| 구분 | 대표 예 | 대입 후 관계 |
| --- | --- | --- |
| 원시값 | 문자열, 숫자, 불리언, `null`, `undefined`, `bigint`, `symbol` | 한 변수를 재대입해도 다른 변수는 그대로다. |
| 객체 | 일반 객체, 배열, 함수, `Date`, `Map`, `Set` | 여러 변수가 같은 객체를 가리킬 수 있다. |

### 2.1 원시값을 대입한 경우

```js
let firstScore = 70
let secondScore = firstScore

// secondScore에 새 숫자를 다시 대입한다.
secondScore = 90

console.log(firstScore) // 70
console.log(secondScore) // 90
```

숫자 `70` 자체를 수정한 것이 아니다. `secondScore`가 다른 숫자 값을 갖도록 재대입한 것이다.

### 2.2 객체를 대입한 경우

```js
const firstTask = {
  title: '배열 복습',
  completed: false,
}

const secondTask = firstTask

// secondTask를 통해 두 변수가 공유하는 객체를 수정한다.
secondTask.completed = true

console.log(firstTask.completed) // true
console.log(secondTask.completed) // true
console.log(firstTask === secondTask) // true
```

두 이름이 같은 객체를 가리키는 관계를 **별칭(aliasing)**이라고 한다.

```text
firstTask  ─┐
            ├─→ { title: '배열 복습', completed: true }
secondTask ─┘
```

## 3. `const`는 객체를 불변으로 만들지 않는다

`const`는 변수에 다른 값을 다시 대입하지 못하게 한다. 객체 내부의 프로퍼티 변경까지 막지는 않는다.

```js
const settings = {
  theme: 'light',
}

// 허용: 같은 객체 내부의 프로퍼티를 수정한다.
settings.theme = 'dark'

// 오류: settings가 다른 객체를 가리키도록 재대입한다.
// settings = { theme: 'system' }
```

```text
재대입: settings = 다른 객체       → const가 금지
객체 변경: settings.theme = 'dark' → const만으로 막지 못함
```

📌 핵심: `const`는 변수 바인딩을 고정할 뿐 객체의 깊은 불변성을 보장하지 않는다.

## 4. 객체 비교는 내용보다 참조를 본다

겉으로 같은 내용을 가진 두 객체도 서로 다른 객체라면 엄격한 동등 비교 결과는 `false`다.

```js
const taskA = { id: 1, title: '복습' }
const taskB = { id: 1, title: '복습' }
const taskC = taskA

console.log(taskA === taskB) // false: 내용은 같지만 다른 객체다.
console.log(taskA === taskC) // true: 같은 객체를 가리킨다.
```

새 객체를 만들어 갱신하면 이전 객체와 다음 객체를 참조 비교로 구분할 수 있다.

```js
const previousTask = { id: 1, completed: false }
const nextTask = { ...previousTask, completed: true }

console.log(previousTask === nextTask) // false
console.log(previousTask.completed) // false
console.log(nextTask.completed) // true
```

## 5. 얕은 복사는 바깥 한 겹만 새로 만든다

얕은 복사(shallow copy)는 최상위 객체나 배열은 새로 만들지만, 그 안에 들어 있는 중첩 객체까지 모두 복제하지 않는다.

다음 방법들은 모두 얕은 복사를 만든다.

- 객체·배열 전개 구문: `{ ...object }`, `[...array]`
- `Object.assign({}, object)`
- `array.slice()`, `Array.from(array)`, `array.concat()`

### 5.1 최상위 프로퍼티는 독립적이다

```js
const original = {
  title: 'JavaScript 복습',
  completed: false,
}

const copied = { ...original }

// 복사본의 최상위 프로퍼티를 바꾼다.
copied.completed = true

console.log(original.completed) // false
console.log(copied.completed) // true
console.log(original === copied) // false
```

### 5.2 중첩 객체는 여전히 공유될 수 있다

```js
const originalCourse = {
  title: 'JavaScript',
  progress: {
    completedLessons: 3,
    totalLessons: 10,
  },
}

const copiedCourse = { ...originalCourse }

console.log(originalCourse === copiedCourse) // false
console.log(originalCourse.progress === copiedCourse.progress) // true

// 두 바깥 객체가 공유하는 progress 객체를 수정한다.
copiedCourse.progress.completedLessons = 4

console.log(originalCourse.progress.completedLessons) // 4
```

```text
originalCourse ─→ { title, progress ─┐ }
                                      ├─→ { completedLessons: 4 }
copiedCourse   ─→ { title, progress ─┘ }
```

바깥 객체는 둘이지만 `progress`는 하나다. 전개 구문을 깊은 복사로 오해하면 원본이 예상치 않게 바뀐다.

## 6. 중첩 객체는 변경 경로를 따라 복사한다

중첩 값을 원본 변경 없이 갱신하려면 수정할 프로퍼티까지 이어지는 객체를 모두 새로 만든다.

```js
const course = {
  title: 'JavaScript',
  progress: {
    completedLessons: 3,
    totalLessons: 10,
  },
}

const updatedCourse = {
  // 1. 바깥 course 객체를 새로 만든다.
  ...course,

  progress: {
    // 2. 수정 경로에 있는 progress 객체도 새로 만든다.
    ...course.progress,

    // 3. 실제로 바꿀 값을 마지막에 덮어쓴다.
    completedLessons: 4,
  },
}

console.log(course.progress.completedLessons) // 3
console.log(updatedCourse.progress.completedLessons) // 4
console.log(course === updatedCourse) // false
console.log(course.progress === updatedCourse.progress) // false
```

전개 구문에서는 뒤에 작성된 같은 이름의 프로퍼티가 앞의 값을 덮어쓴다. 따라서 기존 값을 펼친 뒤 변경할 값을 마지막에 작성한다.

```text
course
  └─ progress
       └─ completedLessons ← 변경 대상

새로 만들 객체: course, progress
그대로 사용할 값: 변경되지 않은 프로퍼티
```

모든 데이터를 무조건 깊게 복제할 필요는 없다. 변경된 경로만 복사하면 다른 부분을 안전하게 공유하면서 변경 범위도 분명하게 표현할 수 있다.

## 7. 배열 안의 객체를 불변하게 갱신한다

배열 전개도 얕은 복사다. 배열 자체는 새로 만들어도 내부 객체는 공유된다.

```js
const tasks = [
  { id: 1, title: '개념 읽기', completed: false },
  { id: 2, title: '예제 실행', completed: false },
]

const copiedTasks = [...tasks]

console.log(tasks === copiedTasks) // false
console.log(tasks[0] === copiedTasks[0]) // true
```

특정 객체 하나를 수정하려면 `map()`으로 대상 객체만 새로 만든다.

```js
function completeTask(tasks, targetId) {
  return tasks.map((task) => {
    if (task.id !== targetId) {
      // 바뀌지 않은 항목은 기존 객체를 그대로 반환한다.
      return task
    }

    // 대상 항목만 새 객체로 만들고 completed를 덮어쓴다.
    return {
      ...task,
      completed: true,
    }
  })
}

const updatedTasks = completeTask(tasks, 2)

console.log(tasks[1].completed) // false
console.log(updatedTasks[1].completed) // true
console.log(tasks === updatedTasks) // false: 배열 변경
console.log(tasks[0] === updatedTasks[0]) // true: 항목 유지
console.log(tasks[1] === updatedTasks[1]) // false: 항목 변경
```

### 7.1 배열 불변 갱신 패턴

| 작업 | 원본을 바꾸는 방식 | 새 배열을 만드는 방식 |
| --- | --- | --- |
| 끝에 추가 | `push()` | `[...items, newItem]` |
| 삭제 | `splice()` | `filter()` |
| 항목 교체 | 인덱스로 직접 대입 | `map()` |
| 정렬 | `sort()` | `[...items].sort()` 또는 `toSorted()` |
| 뒤집기 | `reverse()` | `[...items].reverse()` 또는 `toReversed()` |

`sort()`와 `reverse()`는 원본을 변경한다. 복사본에 실행하거나, 실행 환경이 지원한다면 원본을 바꾸지 않는 새 메서드를 사용할 수 있다.

## 8. 불변성은 수정 금지가 아니라 갱신 규칙이다

불변성(immutability)을 지킨다는 것은 데이터를 영원히 바꾸지 않는다는 뜻이 아니다. 기존 값을 직접 수정하지 않고 **변경 내용을 반영한 새 값**을 만들어 갱신한다는 뜻이다.

```js
// 기존 객체를 직접 변경한다.
function renameTaskMutably(task, newTitle) {
  task.title = newTitle
  return task
}

// 기존 객체는 보존하고 새 객체를 반환한다.
function renameTaskImmutably(task, newTitle) {
  return {
    ...task,
    title: newTitle,
  }
}
```

불변 갱신의 장점은 다음과 같다.

1. 함수 호출 전 데이터가 보존되어 문제 원인을 추적하기 쉽다.
2. 이전 값과 다음 값을 비교하거나 되돌리기 쉽다.
3. 참조 비교로 변경된 범위를 빠르게 판단할 수 있다.
4. React 같은 UI 라이브러리의 상태 갱신 방식과 잘 맞는다.

다만 복사에는 비용이 든다. 모든 값을 항상 깊게 복사하는 것이 목표가 아니라, 공유 상태에서 예측하지 못한 변경을 막는 것이 목표다.

## 9. 깊은 복사가 필요한 경우

깊은 복사(deep copy)는 중첩된 객체까지 독립적인 새 객체 그래프로 만든다. 복사본의 중첩 값을 바꿔도 원본에 영향을 주지 않는다.

다음 상황에서는 깊은 복사를 검토할 수 있다.

- 편집을 취소하기 위한 독립된 작업용 초안이 필요할 때
- 외부 코드가 전달받은 데이터를 깊은 곳까지 변경할 수 있을 때
- 테스트마다 독립된 복합 입력을 만들어야 할 때
- 구조화 복제가 필요한 플랫폼 API를 사용할 때

중첩 프로퍼티 하나만 갱신하는 경우에는 변경 경로 복사가 더 명확하고 효율적인 경우가 많다.

## 10. `structuredClone()`으로 깊게 복사한다

`structuredClone()`은 구조화 복제 알고리즘이 지원하는 값을 깊게 복제한다. 순환 참조를 처리할 수 있고 `Date`, `Map`, `Set`, 배열처럼 JSON만으로 다루기 어려운 여러 값도 복제한다.

```js
const originalPlan = {
  startedAt: new Date('2026-08-22T09:00:00'),
  tags: new Set(['javascript', 'review']),
  progress: {
    completed: 3,
  },
}

const clonedPlan = structuredClone(originalPlan)

clonedPlan.progress.completed = 4
clonedPlan.tags.add('immutability')

console.log(originalPlan.progress.completed) // 3
console.log(clonedPlan.progress.completed) // 4
console.log(originalPlan.tags.has('immutability')) // false
console.log(clonedPlan.startedAt instanceof Date) // true
```

### 10.1 모든 값을 복제할 수 있는 것은 아니다

함수나 DOM 노드처럼 구조화 복제 알고리즘이 지원하지 않는 값은 복제할 수 없으며 `DataCloneError`가 발생할 수 있다.

```js
const valueWithFunction = {
  title: '학습 계획',
  print() {
    console.log(this.title)
  },
}

// DataCloneError가 발생하므로 실행하지 않는다.
// const cloned = structuredClone(valueWithFunction)
```

사용자 정의 클래스 인스턴스의 프로토타입과 메서드를 그대로 복사하는 일반적인 클래스 복제 도구로 생각해서도 안 된다. 값의 종류와 실행 환경 지원 여부를 먼저 확인한다.

## 11. JSON 왕복을 범용 깊은 복사로 사용하지 않는다

다음 코드는 JSON으로 표현 가능한 단순 데이터에서는 깊은 복사처럼 보인다.

```js
const copied = JSON.parse(JSON.stringify(original))
```

그러나 직렬화 과정에서 정보가 손실되거나 형태가 달라질 수 있다.

- `Date`는 문자열이 된다.
- `undefined`, 함수, `symbol` 프로퍼티는 사라질 수 있다.
- `Map`과 `Set`의 내용이 원하는 형태로 보존되지 않는다.
- 순환 참조가 있으면 `JSON.stringify()`가 실패한다.
- `BigInt`는 기본 JSON 직렬화에서 오류가 발생한다.

```js
const original = {
  createdAt: new Date('2026-08-22T09:00:00'),
  optionalValue: undefined,
}

const copiedWithJson = JSON.parse(JSON.stringify(original))

console.log(typeof copiedWithJson.createdAt) // string
console.log('optionalValue' in copiedWithJson) // false
```

JSON 직렬화는 JSON 형식으로 데이터를 전송하거나 저장하는 도구다. 값이 JSON 데이터로 제한된다는 계약이 분명할 때만 그 특성을 이해하고 사용한다.

## 12. `Object.freeze()`도 얕게 적용된다

`Object.freeze()`는 객체의 최상위 프로퍼티 추가·삭제·재대입을 막지만 중첩 객체까지 자동으로 동결하지 않는다.

```js
const frozenCourse = Object.freeze({
  title: 'JavaScript',
  progress: {
    completedLessons: 3,
  },
})

// 최상위 프로퍼티는 변경되지 않는다.
// frozenCourse.title = 'TypeScript'

// progress 객체 자체는 동결하지 않았으므로 변경된다.
frozenCourse.progress.completedLessons = 4

console.log(frozenCourse.progress.completedLessons) // 4
```

```text
Object.freeze() → 기존 객체의 최상위 변경을 제한
structuredClone() → 독립적으로 수정할 새 데이터를 생성
```

두 기능은 목적이 다르며, 깊은 동결이 필요하다면 중첩 객체마다 별도 처리가 필요하다.

## 13. React state와 연결하기

React에서는 객체와 배열 state를 읽기 전용처럼 다루고, 직접 변경하는 대신 새 값을 state 설정 함수에 전달한다.

```tsx
type Profile = {
  nickname: string
  progress: {
    completedLessons: number
  }
}

function increaseProgress(profile: Profile): Profile {
  return {
    ...profile,
    progress: {
      ...profile.progress,
      completedLessons: profile.progress.completedLessons + 1,
    },
  }
}
```

다음처럼 기존 state 내부를 직접 수정하면 참조가 그대로여서 변경 추적과 이전 상태 보존이 어려워진다.

```tsx
// 피해야 하는 형태
profile.progress.completedLessons += 1
setProfile(profile)
```

불변 갱신은 React만의 문법이 아니다. JavaScript의 참조와 얕은 복사 원리를 UI 상태 관리에 적용한 것이다.

## 14. TypeScript `readonly`와의 차이

TypeScript의 `readonly`는 타입 검사 과정에서 재대입을 막지만 JavaScript 런타임에서 객체를 자동으로 동결하지 않는다.

```ts
type Task = {
  readonly id: number
  title: string
}

const task: Task = {
  id: 1,
  title: '참조 복습',
}

// TypeScript 오류: readonly 프로퍼티에 다시 대입할 수 없다.
// task.id = 2

task.title = '얕은 복사 복습' // 허용
```

| 도구·규칙 | 적용 시점 | 역할 |
| --- | --- | --- |
| 불변 갱신 패턴 | 코드 설계 | 원본 대신 새 값을 만들어 갱신 |
| TypeScript `readonly` | 타입 검사 | 허용하지 않은 재대입을 개발 중 발견 |
| `Object.freeze()` | 실행 중 | 객체의 최상위 변경을 제한 |

## 15. 디버깅할 때 확인할 것

원본이 예상치 않게 바뀌었다면 다음 순서로 검사한다.

1. 복사하려고 단순 대입만 하지 않았는가?
2. 전개 구문 뒤에도 중첩 객체의 참조를 공유하는가?
3. `push`, `splice`, `sort`, `reverse`처럼 원본 변경 메서드를 사용했는가?
4. 함수가 인자로 받은 객체를 직접 수정하는가?
5. 변경 경로의 중첩 객체를 빠짐없이 새로 만들었는가?

참조 관계는 엄격한 동등 비교로 확인한다.

```js
console.log({
  sameRoot: originalCourse === copiedCourse,
  sameProgress: originalCourse.progress === copiedCourse.progress,
})
```

## 16. 적용 관점에서 다시 보기

데이터를 수정하기 전에 다음 질문에 답한다.

1. 이 값은 원시값인가, 객체인가?
2. 다른 변수나 컴포넌트가 같은 객체를 공유하는가?
3. 원본 변경이 함수의 명시적인 계약인가?
4. 바꿀 값은 몇 단계 안쪽에 있는가?
5. 변경 경로 복사로 충분한가, 완전한 깊은 복사가 필요한가?
6. 복제할 값에 함수, DOM 노드, 클래스 인스턴스가 포함되는가?
7. 이전 값과 다음 값을 참조 비교할 필요가 있는가?

## 17. 배운 점과 확장 포인트

### 17.1 새로 이해한 것

- 객체 대입은 복사가 아니라 같은 객체를 공유하게 할 수 있다.
- `const`는 객체 내부 변경까지 막지 않는다.
- 전개 구문으로 만든 복사본도 중첩 객체를 원본과 공유할 수 있다.
- 불변 갱신은 변경 대상까지 이어지는 경로를 새로 만드는 방식이다.
- 깊은 복사가 언제나 더 좋은 것은 아니며 데이터 종류와 목적을 먼저 확인해야 한다.

### 17.2 이전·다음 학습과의 연결

이 내용은 배열의 `map`, `filter`, `splice` 차이를 객체 내부까지 확장한 것이다. 다음에는 순수 함수와 부수 효과, React의 렌더링 최적화, Immer를 이용한 중첩 state 갱신으로 이어갈 수 있다.

### 17.3 더 확인할 주제

- `structuredClone()`의 transferable object 이동
- Immer의 draft와 구조적 공유
- 메모이제이션에서 참조 동일성이 갖는 의미
- 순수 함수와 부수 효과

## 18. 요약 정리

1. 객체와 배열은 여러 변수가 같은 대상을 참조할 수 있다.
2. 객체를 단순 대입하면 복사본이 아니라 별칭이 만들어질 수 있다.
3. `const`는 재대입을 막지만 객체 프로퍼티 변경은 막지 않는다.
4. 객체의 `===` 비교는 내용이 아니라 같은 객체인지 확인한다.
5. 전개 구문과 `slice()` 등 일반적인 복사 방법은 얕은 복사다.
6. 중첩 값을 불변하게 갱신하려면 변경 경로의 객체를 각각 새로 만든다.
7. 배열 안의 객체는 `map()`으로 대상 객체만 새로 만들 수 있다.
8. 완전히 독립된 복합 데이터가 필요할 때 `structuredClone()`을 검토한다.
9. JSON 왕복은 값 손실 가능성이 있어 범용 깊은 복사 도구가 아니다.
10. 불변성은 React state와 TypeScript 타입 설계의 기초가 된다.

🧠 기억할 것: **전개 구문은 한 겹만 복사하므로, 중첩 값을 바꿀 때는 바뀌는 값까지 내려가는 경로를 모두 새로 만든다.**

## 19. 미니 퀴즈

1. `const b = a` 이후 `a === b`가 `true`라면 무엇을 의미하는가?
2. `const`로 선언한 객체의 프로퍼티를 변경할 수 있는 이유는 무엇인가?
3. `{ ...original }`로 복사한 뒤 중첩 객체를 수정하면 원본도 바뀔 수 있는 이유는 무엇인가?
4. 배열 안의 특정 객체 하나만 원본 변경 없이 수정할 때 어떤 배열 메서드가 알맞은가?
5. `structuredClone()`과 JSON 왕복 복사의 중요한 차이는 무엇인가?
6. `Object.freeze()`가 중첩 객체까지 자동으로 동결하는가?
7. 불변 갱신에서 전체 데이터를 매번 깊은 복사하지 않아도 되는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 두 변수가 같은 객체를 가리킨다는 뜻이다.
2. `const`는 변수에 다른 값을 재대입하는 것을 막을 뿐 객체 내부를 동결하지 않기 때문이다.
3. 전개 구문은 바깥 객체만 새로 만들며 중첩 객체의 참조는 공유될 수 있기 때문이다.
4. `map()`으로 대상 객체만 새 객체로 교체한다.
5. `structuredClone()`은 순환 참조와 여러 구조화 가능한 타입을 처리하지만 JSON 왕복은 JSON으로 표현할 수 없는 정보를 잃거나 오류가 발생할 수 있다.
6. 아니다. `Object.freeze()`는 기본적으로 최상위 객체에만 적용된다.
7. 변경 경로의 객체만 새로 만들고 변경되지 않은 부분은 안전하게 공유할 수 있기 때문이다.

</details>

## 참고 자료

- [MDN — Shallow copy](https://developer.mozilla.org/en-US/docs/Glossary/Shallow_copy)
- [MDN — Deep copy](https://developer.mozilla.org/en-US/docs/Glossary/Deep_copy)
- [MDN — Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)
- [MDN — structuredClone()](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)
- [React — Updating Objects in State](https://react.dev/learn/updating-objects-in-state)
- [React — Updating Arrays in State](https://react.dev/learn/updating-arrays-in-state)
