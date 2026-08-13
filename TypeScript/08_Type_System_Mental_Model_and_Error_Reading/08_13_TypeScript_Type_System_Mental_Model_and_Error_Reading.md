# TypeScript 타입 시스템 사고방식과 오류 읽기

- 🎯 글의 목표: TypeScript가 코드를 검사하는 기준을 이해하고, 긴 타입 오류를 원인부터 읽으며, 외부 데이터를 안전한 내부 타입으로 바꾸는 흐름을 익힌다.
- 🧩 핵심 키워드: 정적 검사, 타입 추론, 할당 가능성, 구조적 타이핑, 좁히기, `unknown`, `never`, `satisfies`, 신뢰 경계
- ⭐ 중요도: ★★★★★ — 문법을 알고도 타입 오류를 해결하지 못하는 이유는 대부분 타입 사이의 관계와 검사 방향을 읽지 못하기 때문이다.
- 📝 한눈에 보는 내용: TypeScript는 값의 미래를 완벽히 예측하지 않는다. 코드에 드러난 증거를 바탕으로 값이 어떤 연산을 안전하게 지원하는지 검사하고, 확신할 수 없는 경계에서는 개발자에게 검증을 요구한다.
- 🔗 관련 주제: 기초 타입, 유니언, 함수·객체 타입, 제네릭, `tsconfig.json`, React Props
- 🧱 선수 지식: JavaScript 변수·객체·함수, TypeScript 기본 타입과 유니언

---

## 1. 들어가며

TypeScript를 처음 배우면 `string`, `number`, `boolean`을 붙이는 문법부터 익힌다. 그러나 실제 프로젝트에서 만나는 어려움은 “어떤 타입 이름을 적을까?”보다 다음 질문에서 생긴다.

- 왜 속성이 더 많은 객체를 변수에 넣을 수 있는가?
- 같은 객체인데 직접 전달할 때와 변수에 담아 전달할 때 오류가 다른 이유는 무엇인가?
- 조건문을 지났는데 TypeScript가 왜 여전히 `undefined`일 수 있다고 말하는가?
- 오류 메시지의 여러 타입 중 어느 쪽이 내가 작성한 타입인가?
- API 응답에 인터페이스를 붙였는데 왜 런타임 오류가 발생하는가?

이 문서는 개별 문법을 하나 더 외우기보다 TypeScript가 코드를 바라보는 **사고 모델**을 만든다.

## 2. TypeScript가 하는 일과 하지 않는 일

TypeScript는 JavaScript 코드가 실행되기 전에 타입 관계를 검사한다. 검사에 성공하면 타입 문법은 JavaScript 결과물에서 사라진다.

```text
작성한 .ts / .tsx 코드
        ↓ TypeScript 검사
타입 오류 보고
        ↓ 검사 성공 및 변환
실행 가능한 JavaScript
        ↓ 브라우저 또는 Node.js
실제 런타임 동작
```

따라서 타입은 런타임 값을 자동으로 검사하거나 변환하지 않는다.

```ts
type User = {
  id: string
  name: string
}

const response = await fetch('/api/user')

// 타입 단언은 실제 응답을 검사하지 않는다.
// 서버가 { id: 1 }을 보내도 실행 중 User로 바뀌지 않는다.
const user = await response.json() as User
```

TypeScript가 강하게 보장할 수 있는 대상은 코드 안에서 타입 정보가 유지되는 값이다. 네트워크 응답, localStorage, URL, 폼 입력, 사용자가 업로드한 파일은 프로그램 바깥에서 들어오므로 런타임 검증이 필요하다.

📌 핵심: **타입 표시는 값에 붙는 런타임 스티커가 아니라, 컴파일러가 코드의 연산 가능성을 판단할 때 사용하는 정적 정보다.**

## 3. 타입은 값의 집합으로 생각한다

`string` 타입은 가능한 모든 문자열 값의 집합이다. 문자열 리터럴 타입 `'idle'`은 그중 `'idle'` 하나만 포함하는 더 작은 집합이다.

```text
unknown
├── string
│   ├── "idle"
│   ├── "loading"
│   └── 그 밖의 모든 문자열
├── number
├── boolean
└── 객체 등

never = 가능한 값이 하나도 없는 집합
```

```ts
let status: 'idle' | 'loading' = 'idle'

// 'loading'은 허용한 집합 안에 있다.
status = 'loading'

// 'success'는 허용한 집합 밖에 있으므로 오류다.
// status = 'success'
```

유니언 `A | B`는 A 또는 B에 속하는 값의 집합이다. 교차 `A & B`는 A와 B의 조건을 모두 만족하는 값의 집합이다.

```ts
type Identifiable = { id: string }
type Timestamped = { createdAt: Date }

// 두 객체 구조를 모두 만족해야 한다.
type RecordItem = Identifiable & Timestamped
```

이 관점은 할당 오류를 읽을 때 도움이 된다. 오른쪽 값이 가질 수 있는 경우가 왼쪽 변수가 허용하는 범위를 벗어나면 안전하게 할당할 수 없다.

## 4. 타입 추론: 적게 적어도 타입이 생기는 이유

TypeScript는 초기값, 함수 반환, 사용되는 문맥을 보고 타입을 추론한다.

```ts
const title = 'TypeScript 복습'
// const 변수이며 다시 대입할 수 없으므로 'TypeScript 복습'에 가까운 타입을 추론한다.

let category = 'study'
// 나중에 다른 문자열을 대입할 수 있으므로 보통 string으로 넓혀 추론한다.

const lengths = ['a', 'typescript'].map(word => word.length)
// word는 배열 문맥에서 string, 결과는 number[]로 추론된다.
```

### 4.1 타입을 명시할 때와 추론에 맡길 때

초기값만으로 의도가 명확한 지역 변수는 추론에 맡겨도 된다.

```ts
const retryCount = 3
const isVisible = true
```

함수의 공개 입력, 빈 배열, `null` 초기값, 여러 상태가 가능한 값에는 타입을 명시하면 계약이 선명해진다.

```ts
type Note = { id: string; title: string }

const notes: Note[] = []
let selectedNote: Note | null = null

function findNote(id: string): Note | undefined {
  return notes.find(note => note.id === id)
}
```

반환 타입은 항상 필수는 아니지만, 공개 함수에서는 구현이 실수로 계약을 바꾸는 것을 막아 준다.

### 4.2 문맥적 타이핑

함수가 사용되는 위치도 매개변수 타입의 증거가 된다.

```ts
const names = ['Ada', 'Linus']

// names가 string[]이므로 name은 string으로 추론된다.
const upperNames = names.map(name => name.toUpperCase())
```

React JSX의 인라인 이벤트도 `onChange`라는 문맥에서 이벤트 타입을 추론한다. 별도 함수로 꺼내 문맥이 사라지면 타입을 직접 적는 이유가 여기에 있다.

## 5. 할당 가능성: 타입 오류의 중심 질문

대부분의 타입 오류는 “오른쪽 값의 타입을 왼쪽이 요구하는 타입으로 사용할 수 있는가?”를 검사하다 발생한다.

```ts
type PreviewProps = {
  title: string
  count: number
}

const preview = {
  title: '오늘의 학습',
  count: 4,
  updatedAt: new Date(),
}

// PreviewProps가 요구하는 title과 count를 모두 갖고 있으므로 허용된다.
const props: PreviewProps = preview
```

TypeScript는 이름이 아니라 구조를 중심으로 비교한다. 이를 **구조적 타이핑**이라고 한다. `preview`가 `implements PreviewProps`라고 선언하지 않아도 필요한 구조를 만족하면 사용할 수 있다.

### 5.1 속성이 부족하면 왜 오류인가?

```ts
const incomplete = { title: '오늘의 학습' }

// count가 없으므로 PreviewProps를 사용하는 코드가 안전하지 않다.
// const props: PreviewProps = incomplete
```

`PreviewProps`를 받는 코드는 `count.toLocaleString()`을 호출할 권리가 있다. 속성이 없는 값을 허용하면 이 코드가 실행 중 실패하므로 컴파일러가 막는다.

### 5.2 초과 프로퍼티 검사는 실수 탐지 장치다

객체 리터럴을 직접 전달할 때는 오타 가능성을 찾기 위해 추가 검사가 적용된다.

```ts
type ButtonOptions = {
  disabled?: boolean
}

function createButton(options: ButtonOptions): void {
  console.log(options.disabled)
}

// disabeld는 disabled의 오타일 가능성이 높아 오류가 난다.
// createButton({ disabeld: true })
```

“구조적 타이핑이면 속성이 많아도 된다”와 “객체 리터럴의 알려지지 않은 속성을 검사한다”는 서로 모순이 아니다. 전자는 일반적인 호환 규칙이고, 후자는 새 객체를 작성하는 지점에서 흔한 오타를 잡는 추가 검사다.

## 6. `satisfies`: 검사하면서 구체적인 타입 보존하기

타입 주석은 변수가 보이는 타입을 지정한다. `satisfies`는 값이 계약을 만족하는지 검사하되 값 자체의 더 구체적인 추론을 가능한 한 보존한다.

```ts
type RouteName = 'home' | 'notes'
type RouteTable = Record<RouteName, `/${string}`>

const routes = {
  home: '/',
  notes: '/notes',
} satisfies RouteTable

// routes가 RouteTable 계약을 만족하는지 검사하면서
// routes.notes의 구체적인 값 정보도 유지할 수 있다.
```

`as RouteTable`은 “내 판단을 믿어 달라”는 단언에 가깝고, `satisfies RouteTable`은 실제 값이 계약을 만족하는지 검사한다. 객체 설정표나 route map처럼 오타를 잡으면서 구체적인 리터럴 정보를 유지할 때 유용하다.

## 7. 좁히기: 조건문은 타입의 증거다

유니언 값에는 모든 구성원이 공통으로 안전하게 지원하는 연산만 바로 사용할 수 있다.

```ts
function format(value: string | number): string {
  // value가 string일 때만 문자열 메서드를 사용할 수 있다.
  if (typeof value === 'string') {
    return value.trim()
  }

  // 앞 분기에서 string이 반환됐으므로 여기서는 number다.
  return value.toLocaleString()
}
```

TypeScript는 `typeof`, `instanceof`, `in`, 동등 비교, truthiness와 사용자 정의 타입 가드를 코드 흐름에 따라 해석한다.

### 7.1 truthiness가 정보를 너무 많이 합칠 수 있다

```ts
function printLength(text: string | null): void {
  if (text) {
    // null뿐 아니라 빈 문자열도 이 분기에서 제외된다.
    console.log(text.length)
  }
}
```

빈 문자열이 유효한 값이라면 `text !== null`처럼 확인하려는 경우를 정확히 적는다.

### 7.2 판별 유니언으로 불가능한 상태 제거하기

```ts
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

function getMessage(state: LoadState<string[]>): string {
  switch (state.status) {
    case 'idle':
      return '아직 요청하지 않았습니다.'
    case 'loading':
      return '불러오는 중입니다.'
    case 'success':
      return `${state.data.length}개를 불러왔습니다.`
    case 'error':
      return state.message
  }
}
```

`status`가 `success`인 객체에만 `data`가 존재한다. `isLoading`, `data`, `error`를 독립적으로 두는 것보다 가능한 상태가 타입에 정확히 드러난다.

## 8. `unknown`, `any`, `never`의 역할

### 8.1 `unknown`: 아직 확인하지 않은 값

`unknown`에는 어떤 값이든 들어올 수 있지만 검사 전에는 구체적인 연산을 할 수 없다.

```ts
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '알 수 없는 오류가 발생했습니다.'
}
```

`any`는 검사를 건너뛰고 잘못된 연산도 주변으로 퍼뜨린다. 외부 입력처럼 모르는 값에는 `unknown`이 “검사해야 한다”는 사실을 보존한다.

### 8.2 `never`: 남아 있는 경우가 없음

판별 유니언을 모두 처리했는지 검사할 때 `never`를 활용할 수 있다.

```ts
function assertNever(value: never): never {
  throw new Error(`처리하지 않은 상태: ${JSON.stringify(value)}`)
}

type SaveStatus = 'idle' | 'saving' | 'saved'

function statusLabel(status: SaveStatus): string {
  switch (status) {
    case 'idle':
      return '대기'
    case 'saving':
      return '저장 중'
    case 'saved':
      return '저장 완료'
    default:
      return assertNever(status)
  }
}
```

나중에 `SaveStatus`에 `'failed'`를 추가하고 switch를 수정하지 않으면 `status`가 `never`가 되지 않으므로 컴파일 오류로 빠진 경우를 찾을 수 있다.

## 9. 외부 데이터를 안전한 내부 타입으로 바꾸기

API 응답을 바로 `User`라고 단언하는 대신 경계에서 `unknown`으로 받고 검사한다.

```ts
type User = {
  id: string
  name: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseUser(value: unknown): User {
  if (!isRecord(value)) {
    throw new Error('사용자 응답이 객체가 아닙니다.')
  }

  if (typeof value.id !== 'string') {
    throw new Error('사용자 id가 문자열이 아닙니다.')
  }

  if (typeof value.name !== 'string') {
    throw new Error('사용자 name이 문자열이 아닙니다.')
  }

  return {
    id: value.id,
    name: value.name,
  }
}

async function fetchUser(): Promise<User> {
  const response = await fetch('/api/user')

  if (!response.ok) {
    throw new Error(`사용자 요청 실패: ${response.status}`)
  }

  // JSON 결과는 신뢰하지 않고 unknown 경계로 둔다.
  const raw: unknown = await response.json()
  return parseUser(raw)
}
```

검증이 끝난 뒤부터 내부 코드는 `User` 계약을 신뢰할 수 있다. 규모가 큰 프로젝트에서는 스키마 검증 라이브러리를 사용할 수 있지만, 원리는 “경계에서 확인하고 내부에는 검증된 값만 전달한다”로 같다.

## 10. React Props에서 보는 구조적 타입과 경계

```tsx
type UserCardProps = {
  user: {
    id: string
    name: string
  }
  onSelect: (id: string) => void
}

function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <button type="button" onClick={() => onSelect(user.id)}>
      {user.name}
    </button>
  )
}
```

Props 타입은 컴포넌트가 사용하기 위해 필요한 최소 계약이다. 서버의 `UserResponse` 전체 구조를 그대로 Props로 재사용하면 컴포넌트가 API 모양에 강하게 결합된다.

```ts
type UserResponse = {
  id: string
  display_name: string
  created_at: string
}

type UserViewModel = {
  id: string
  name: string
}

function toUserViewModel(response: UserResponse): UserViewModel {
  return {
    id: response.id,
    name: response.display_name,
  }
}
```

API 경계에서 화면에 필요한 구조로 변환하면 서버 필드명 변경의 영향이 컴포넌트 전체로 퍼지는 것을 줄일 수 있다.

## 11. TypeScript 오류 메시지를 읽는 순서

긴 오류를 위에서 아래로 모두 해석하려고 하면 핵심을 놓치기 쉽다. 다음 순서로 범위를 줄인다.

### 11.1 오류가 발생한 연산을 찾는다

대입, 함수 인수 전달, 반환, JSX Props 중 무엇을 검사하다 실패했는지 본다.

```ts
type Note = { id: string; title: string }

function printNote(note: Note): void {
  console.log(note.title)
}

const draft = { id: 1, title: '초안' }
// printNote(draft)
```

여기서 실패한 연산은 함수 호출이며, 실제 인수 `draft`를 매개변수 `Note`에 할당할 수 있는지 비교한다.

### 11.2 실제 타입과 기대 타입을 구분한다

- 실제 타입(source): 지금 전달하거나 대입한 값의 타입
- 기대 타입(target): 함수, 변수, Props가 요구한 타입

위 예제에서는 실제 `id`가 `number`, 기대 `id`가 `string`이다. 객체 전체를 고치려 하지 말고 처음 어긋난 속성까지 내려간다.

### 11.3 가장 안쪽 원인부터 고친다

React와 제네릭 라이브러리 오류는 여러 겹으로 길어질 수 있다. 보통 마지막 부분에 “`number`는 `string`에 할당할 수 없다”처럼 가장 구체적인 원인이 나온다.

### 11.4 단언 전에 모델을 확인한다

오류를 없애려고 `as Note`를 붙이기 전에 다음을 묻는다.

1. 실제 데이터가 잘못됐는가?
2. 기대 타입이 현실보다 지나치게 좁은가?
3. `null`이나 로딩 상태를 타입에서 빠뜨렸는가?
4. 외부 값을 아직 검증하지 않았는가?
5. 라이브러리의 주 버전과 타입 패키지가 맞는가?

단언은 컴파일러보다 더 많은 근거가 있을 때만 사용한다. 근거가 코드에 표현될 수 있다면 조건 검사나 변환 함수가 더 안전하다.

## 12. 자주 하는 문제 해결 패턴

| 오류 또는 증상 | 원인 후보 | 먼저 할 일 |
| --- | --- | --- |
| `possibly null` | 값이 실제로 없을 수 있음 | 조건문, optional chaining, 초기 상태 검토 |
| `Property ... does not exist on union` | 아직 타입을 충분히 좁히지 않음 | 판별 속성 또는 타입 가드 추가 |
| `Type X is not assignable to Y` | 실제 타입이 기대 계약을 만족하지 않음 | 양쪽 타입의 첫 차이를 찾기 |
| 빈 배열에서 이상한 추론 | 초기값만으로 요소 타입을 알 수 없음 | `Item[]` 타입 명시 |
| 객체 리터럴의 알 수 없는 속성 | 오타 또는 계약에 없는 필드 | 속성명과 타입 책임 확인 |
| 라이브러리에 타입이 없음 | 선언 미제공 또는 해석 실패 | 내장 타입, `@types`, 로컬 선언 순서로 확인 |
| 타입은 통과하지만 런타임 실패 | 단언, `any`, 외부 입력 미검증 | 신뢰 경계에서 `unknown` 검증 |

## 13. 엄격한 설정이 학습에 도움이 되는 이유

`strict`는 여러 엄격한 검사 옵션을 묶어 활성화한다. 처음에는 오류가 늘어난 것처럼 보이지만, 값이 없을 수 있는 경우와 암묵적인 `any`를 코드에 드러내 학습할 근거를 준다.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

- `strict`: 엄격한 타입 검사 묶음을 활성화한다.
- `noUncheckedIndexedAccess`: 배열·인덱스 접근 결과에 `undefined` 가능성을 반영한다.
- `noImplicitOverride`: 상위 클래스 메서드를 재정의할 때 `override` 의도를 요구한다.

프로젝트 환경에 따라 옵션을 선택하되, 오류가 많다는 이유로 `strict`를 끄기보다 반복되는 오류가 어떤 불확실성을 보여 주는지 이해한다.

## 14. 적용 관점에서 다시 보기

새 기능에 타입을 붙일 때 다음 순서로 생각한다.

1. 값은 프로그램 내부에서 만들었는가, 외부에서 들어왔는가?
2. 외부 값이면 어느 지점에서 `unknown`을 검증할 것인가?
3. 가능한 상태를 유니언으로 표현할 수 있는가?
4. 타입 추론만으로 의도가 충분한가, 공개 계약을 명시해야 하는가?
5. 오류가 나면 어떤 할당 관계를 검사 중인가?
6. 단언 없이 조건과 변환으로 근거를 만들 수 있는가?

TypeScript의 목표는 타입 오류를 0개로 만드는 데만 있지 않다. **값이 어디에서 오고, 어느 상태가 가능하며, 어떤 함수가 무엇을 약속하는지 코드로 설명하는 것**이 더 중요한 목적이다.

## 15. 요약 정리

1. TypeScript 타입은 런타임에 값을 검사하거나 변환하지 않는다.
2. 타입을 값의 집합으로 보면 유니언, 좁히기, 할당 가능성을 연결하기 쉽다.
3. TypeScript는 초기값과 사용 문맥에서 많은 타입을 추론한다.
4. 구조적 타이핑은 타입 이름보다 필요한 멤버가 있는지를 본다.
5. `satisfies`는 계약을 검사하면서 값의 구체적인 추론을 보존할 때 유용하다.
6. 조건문은 유니언을 안전하게 좁히는 타입의 증거다.
7. 외부 값은 `unknown`으로 받아 경계에서 검증한다.
8. `never`는 가능한 경우를 모두 처리했는지 검사하는 데 활용할 수 있다.
9. 타입 오류는 실패한 연산, 실제 타입, 기대 타입, 가장 안쪽 차이 순서로 읽는다.
10. 단언으로 오류를 숨기기 전에 데이터와 타입 모델이 현실을 정확히 표현하는지 확인한다.

🧠 기억할 것: **TypeScript 오류는 방해 문구가 아니라, 코드가 약속한 타입과 실제로 증명된 값 사이의 빈틈을 보여 주는 설명이다.**

## 16. 미니 퀴즈

1. TypeScript 인터페이스가 API 응답을 런타임에 검증하지 못하는 이유는 무엇인가?
2. 구조적 타이핑에서는 두 타입의 호환성을 무엇으로 판단하는가?
3. 타입 주석과 `satisfies`의 차이는 무엇인가?
4. `string | null`을 truthiness로 검사할 때 빈 문자열은 어떻게 처리되는가?
5. `unknown`이 `any`보다 외부 입력에 알맞은 이유는 무엇인가?
6. 긴 `Type X is not assignable to Y` 오류를 읽는 순서를 설명해 보자.
7. 판별 유니언과 `never`를 함께 사용하면 어떤 실수를 찾을 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 타입 정보는 검사 후 JavaScript 결과에서 사라지며, 네트워크 값 자체를 읽어 검사하는 런타임 코드가 아니기 때문이다.
2. 타입 이름이나 명시적 상속보다 대상이 요구하는 프로퍼티와 메서드를 실제로 갖는지 비교한다.
3. 타입 주석은 변수가 보이는 타입을 지정한다. `satisfies`는 값이 계약을 만족하는지 검사하면서 더 구체적인 추론을 보존할 수 있다.
4. 빈 문자열도 falsy이므로 `null`과 함께 조건문 밖으로 제외된다. 빈 문자열이 유효하면 `value !== null`처럼 정확히 검사한다.
5. `unknown`은 검사 전 구체적인 연산을 막아 런타임 검증을 요구하지만, `any`는 검사를 건너뛰고 위험을 주변 코드로 전파한다.
6. 실패한 대입·인수·반환·Props 연산을 찾고, 실제 타입과 기대 타입을 구분한 뒤, 가장 안쪽에서 처음 어긋난 프로퍼티를 찾는다.
7. 유니언에 새 상태를 추가하고 switch에서 처리하지 않은 경우를 컴파일 단계에서 찾을 수 있다.

</details>

## 참고 자료

- [TypeScript Handbook - The Basics](https://www.typescriptlang.org/docs/handbook/2/basic-types.html)
- [TypeScript Handbook - Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript Handbook - Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript Handbook - Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)
- [TypeScript `satisfies` Operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig/)
