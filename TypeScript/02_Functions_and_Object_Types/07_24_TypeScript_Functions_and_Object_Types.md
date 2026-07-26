# TypeScript 함수와 객체 타입

- 🎯 글의 목표: 함수의 호출 규칙과 객체의 구조를 타입으로 정확히 표현하고, 오버로드·나머지 매개변수·`readonly`·인덱스 시그니처·튜플을 실제 코드에 적용한다.
- 🧩 핵심 키워드: Function Type Expression, Call Signature, Construct Signature, Optional Parameter, Rest Parameter, Overload, `this`, Object Type, `readonly`, Index Signature, Excess Property Check, Intersection, Tuple
- ⭐ 중요도: ★★★★★
- 📝 한눈에 보는 내용: 함수 타입은 단순히 매개변수 각각의 타입을 붙이는 데서 끝나지 않는다. 함수 자체를 값으로 전달하는 규칙, 호출 방식이 여러 개인 API, 콜백과 `this`까지 표현해야 한다. 객체 타입에서는 선택적·읽기 전용 프로퍼티, 동적인 키, 객체 리터럴 검사, 확장과 교차, 튜플의 위치별 타입을 다룬다.
- 🔗 관련 문제 / 주제: 콜백 API, 이벤트 처리, 옵션 객체, DTO, 함수 오버로드, React·Vue Props, 읽기 전용 상태

---

## 1. 들어가며

JavaScript에서 함수와 객체는 프로그램의 경계를 만든다. 함수는 값을 받아 결과를 내보내고, 객체는 여러 값을 하나의 의미 있는 구조로 묶는다. TypeScript에서는 이 경계를 얼마나 정확히 표현하느냐가 코드의 안전성을 좌우한다.

```ts
function runTask(task) {
  return task.execute();
}
```

이 함수만 보면 `task`가 무엇인지, `execute()`가 어떤 값을 반환해야 하는지 알기 어렵다. 단순히 `task: object`라고 적어도 해결되지 않는다. 필요한 것은 “호출 가능한 `execute` 프로퍼티가 있고 그 결과는 문자열이다”라는 구체적인 구조다.

```ts
type Task = {
  execute: () => string;
};

function runTask(task: Task): string {
  return task.execute();
}
```

이번 글은 함수와 객체를 각각 외우기보다 두 가지 질문을 중심으로 살펴본다.

1. 이 함수는 **어떻게 호출할 수 있는가?**
2. 이 객체는 **어떤 구조와 변경 규칙을 가져야 하는가?**

---

## 2. 핵심 개념 정리

함수 타입은 호출 계약이다.

```ts
type Formatter = (value: number) => string;
```

이 타입은 숫자 하나를 받고 문자열을 돌려주는 모든 함수를 나타낸다. 구현의 이름이나 내부 코드가 아니라 호출 가능한 모양을 설명한다.

객체 타입은 프로퍼티 계약이다.

```ts
interface Product {
  readonly id: number;
  name: string;
  description?: string;
}
```

`id`는 읽을 수 있지만 다시 대입할 수 없고, `name`은 반드시 있으며, `description`은 생략할 수 있다.

함수도 JavaScript에서는 객체다. 호출할 수 있으면서 프로퍼티도 가진 값은 호출 시그니처가 있는 객체 타입으로 표현한다. 반대로 생성자처럼 `new`로 호출되는 값은 구성 시그니처로 표현한다.

객체의 구조를 조합할 때는 `interface extends`와 교차 타입 `&`를 사용한다. 위치와 개수가 중요한 배열은 튜플로 모델링한다.

---

## 3. 본문 정리

### 3.1 함수 타입 표현식

함수를 매개변수로 받으려면 함수 자체의 타입을 적는다.

```ts
function apply(
  value: number,
  operation: (input: number) => number,
): number {
  return operation(value);
}

const doubled = apply(10, (input) => input * 2);
```

`(input: number) => number`는 숫자를 받아 숫자를 반환하는 함수라는 뜻이다. 화살표 함수 구현과 모양이 비슷하지만 타입 위치에서는 함수의 호출 규칙을 나타낸다.

반복된다면 타입 별칭을 사용한다.

```ts
type NumberOperation = (input: number) => number;

function apply(value: number, operation: NumberOperation): number {
  return operation(value);
}
```

함수 타입에도 매개변수 이름이 필요하다.

```ts
type Handler = (event: string) => void;
```

여기서 `event`는 문서 역할을 하는 이름이다. 함수 구현의 실제 매개변수 이름과 같을 필요는 없다.

```ts
const handler: Handler = (message) => {
  console.log(message);
};
```

### 3.2 호출 시그니처와 구성 시그니처

함수가 호출 가능하면서 프로퍼티도 가진다면 객체 타입 안에 호출 시그니처를 쓴다.

```ts
type Counter = {
  description: string;
  (start: number): number;
};

function useCounter(counter: Counter): void {
  console.log(counter.description);
  console.log(counter(10));
}
```

호출 시그니처에서는 화살표 `=>`가 아니라 반환 타입 앞에 `:`를 사용한다.

생성자 타입은 `new`를 붙인다.

```ts
interface User {
  name: string;
}

type UserConstructor = {
  new (name: string): User;
};

function createUser(Constructor: UserConstructor, name: string): User {
  return new Constructor(name);
}
```

클래스 자체를 함수에 전달할 때는 인스턴스 타입이 아니라 생성자 타입이 필요하다는 점이 핵심이다.

### 3.3 선택적 매개변수와 기본값

매개변수 이름 뒤에 `?`를 붙이면 생략할 수 있다.

```ts
function formatPrice(price: number, currency?: string): string {
  if (currency === undefined) {
    return price.toLocaleString();
  }

  return `${price.toLocaleString()} ${currency}`;
}
```

함수 안에서 `currency`는 `string | undefined`다. 기본값을 제공하면 본문에서는 `undefined`를 제거할 수 있다.

```ts
function formatPrice(price: number, currency = "KRW"): string {
  return `${price.toLocaleString()} ${currency}`;
}
```

콜백 타입의 선택적 매개변수는 특히 주의한다.

```ts
function forEach<T>(
  items: T[],
  callback: (item: T, index: number) => void,
): void {
  items.forEach(callback);
}
```

호출자가 인덱스를 사용하지 않는 것은 괜찮다.

```ts
forEach(["a", "b"], (item) => console.log(item));
```

콜백의 `index`를 `index?: number`로 적으면 “구현이 인덱스 없이 콜백을 호출할 수도 있다”는 다른 약속이 된다. 실제로 항상 전달한다면 선택적으로 적지 않는다.

### 3.4 나머지 매개변수와 나머지 인수

인수 개수가 가변적이면 나머지 매개변수를 사용한다.

```ts
function sum(...values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

sum(1, 2, 3);
```

나머지 매개변수는 배열 타입이어야 한다. 튜플을 사용하면 위치별 타입도 표현할 수 있다.

```ts
function logUser(...args: [id: number, name: string]): void {
  const [id, name] = args;
  console.log(id, name);
}
```

배열을 인수로 펼칠 때 일반 배열은 길이가 고정되지 않았다고 추론될 수 있다.

```ts
const args = [8, 5] as const;
Math.atan2(...args);
```

`as const`로 읽기 전용 튜플을 만들면 정확히 두 숫자가 있다는 정보를 유지한다.

### 3.5 함수 오버로드

호출 형태에 따라 반환 타입이 달라지는 함수는 오버로드 시그니처로 표현할 수 있다.

```ts
function getLength(value: string): number;
function getLength(value: unknown[]): number;
function getLength(value: string | unknown[]): number {
  return value.length;
}
```

앞의 두 줄은 호출자가 볼 수 있는 오버로드 시그니처이고, 마지막 함수는 구현 시그니처다. 구현 시그니처는 모든 오버로드를 수용할 수 있어야 한다.

```ts
getLength("hello");
getLength([1, 2, 3]);
```

유니언 하나로 충분하다면 오버로드보다 유니언을 선호한다.

```ts
function getLength(value: string | unknown[]): number {
  return value.length;
}
```

유니언 방식은 유니언 타입 변수도 바로 전달할 수 있고 구현도 단순하다. 오버로드는 인수 조합과 반환 타입의 관계가 실제로 달라질 때 사용한다.

```ts
function parse(value: string): object;
function parse(value: string, raw: true): string;
function parse(value: string, raw?: boolean): object | string {
  return raw ? value : JSON.parse(value);
}
```

### 3.6 함수 안의 `this`

JavaScript의 `this`는 호출 방식에 따라 정해진다. TypeScript에서는 함수 선언의 첫 번째 가짜 매개변수로 `this` 타입을 표현한다.

```ts
interface User {
  name: string;
}

function printName(this: User): void {
  console.log(this.name);
}

const user = {
  name: "Mina",
  printName,
};

user.printName();
```

`this` 매개변수는 결과 JavaScript에 나오지 않는다. 화살표 함수는 자신의 `this`를 만들지 않으므로 동적 `this`가 필요한 메서드 콜백과 구분해야 한다.

### 3.7 알아둘 특별한 반환 타입

`void`는 호출자가 반환값을 사용하지 않는 함수 계약에 주로 쓰인다.

```ts
type Logger = (message: string) => void;
```

`never`는 정상적으로 끝까지 도달하지 않는 함수의 반환 타입이다.

```ts
function fail(message: string): never {
  throw new Error(message);
}
```

`unknown`은 어떤 값이든 반환될 수 있지만 확인하기 전에는 사용할 수 없음을 나타낸다.

```ts
function parseJson(text: string): unknown {
  return JSON.parse(text);
}
```

`Function` 타입은 호출 결과가 `any`가 되어 안전하지 않다. 구체적인 호출 시그니처를 작성할 수 없다면 `() => void`처럼 최소 계약을 적는다.

### 3.8 객체 프로퍼티 변경자

선택적 프로퍼티는 `?`로 표시한다.

```ts
interface RequestOptions {
  method?: "GET" | "POST";
  timeout?: number;
}
```

기본값과 구조 분해를 함께 사용할 수 있다.

```ts
function request({
  method = "GET",
  timeout = 3000,
}: RequestOptions): void {
  console.log(method, timeout);
}
```

`readonly`는 타입 검사 중 재대입을 막는다.

```ts
interface User {
  readonly id: number;
  name: string;
}

const user: User = { id: 1, name: "Mina" };
user.name = "Joon";
// user.id = 2; // 오류
```

`readonly`는 깊은 불변성을 보장하지 않는다.

```ts
interface Team {
  readonly leader: {
    name: string;
  };
}

const team: Team = { leader: { name: "Mina" } };
team.leader.name = "Joon"; // 내부 객체는 변경 가능
```

또한 런타임에서 객체를 동결하지 않는다. 깊은 불변성이 필요하면 별도 타입 설계와 런타임 정책이 필요하다.

### 3.9 인덱스 시그니처

프로퍼티 이름을 미리 알 수 없지만 값 타입은 알 때 사용한다.

```ts
interface ScoreMap {
  [studentId: string]: number;
}

const scores: ScoreMap = {
  "student-1": 95,
  "student-2": 88,
};
```

문자열 인덱스 시그니처가 있으면 명시된 모든 프로퍼티도 그 값 타입을 만족해야 한다.

```ts
interface Dictionary {
  [key: string]: string | number;
  length: number;
  name: string;
}
```

키의 집합을 알고 있다면 넓은 인덱스 시그니처보다 `Record`나 매핑된 타입이 더 정확하다.

```ts
type Role = "admin" | "member" | "guest";
type Permissions = Record<Role, string[]>;
```

### 3.10 초과 프로퍼티 검사

객체 리터럴을 타입이 정해진 위치에 바로 전달하면 알려지지 않은 프로퍼티를 더 엄격하게 검사한다.

```ts
interface Options {
  color?: string;
  width?: number;
}

function draw(options: Options): void {}

draw({ colour: "red", width: 100 });
//     ~~~~~~ color 오타를 찾는다.
```

검사를 피하려고 무조건 단언하기보다 타입 정의나 오타를 먼저 확인한다.

```ts
draw({ colour: "red", width: 100 } as Options); // 경고를 숨길 수 있음
```

추가 키를 실제로 허용해야 한다면 그 의도를 타입에 표현한다.

```ts
interface FlexibleOptions {
  color?: string;
  width?: number;
  [key: string]: unknown;
}
```

### 3.11 객체 타입 확장과 교차 타입

인터페이스는 `extends`로 확장한다.

```ts
interface BaseUser {
  id: number;
  name: string;
}

interface AdminUser extends BaseUser {
  permissions: string[];
}
```

타입 별칭은 `&`로 결합할 수 있다.

```ts
type Timestamped = {
  createdAt: Date;
};

type Article = {
  title: string;
} & Timestamped;
```

교차 타입에서 같은 프로퍼티가 호환되지 않으면 사용할 수 없는 타입이 만들어질 수 있다.

```ts
type A = { id: string };
type B = { id: number };
type Impossible = A & B;
// id는 string & number, 즉 never가 된다.
```

### 3.12 튜플 타입

튜플은 원소의 위치와 타입을 함께 표현한다.

```ts
type Coordinate = [number, number];

const point: Coordinate = [127.0, 37.5];
```

라벨을 붙이면 의미가 잘 드러난다.

```ts
type HttpResult = [
  status: number,
  body: string,
];
```

선택적 원소와 나머지 원소도 가능하다.

```ts
type Range = [start: number, end?: number];
type StringNumberBooleans = [string, number, ...boolean[]];
```

튜플은 길이와 위치가 의미를 가질 때 유용하다. 필드가 많거나 이름으로 읽는 편이 자연스럽다면 객체를 사용한다.

---

## 4. 적용 관점에서 다시 보기

함수 타입을 설계할 때는 구현보다 호출자의 관점에서 시작한다.

1. 필수 인수와 생략 가능한 인수를 구분한다.
2. 입력과 출력의 관계가 달라지면 제네릭이나 오버로드를 검토한다.
3. 유니언 하나로 표현할 수 있으면 오버로드를 늘리지 않는다.
4. 콜백 매개변수는 실제 호출자가 생략할 가능성이 있을 때만 선택적으로 만든다.
5. `any`나 `Function` 대신 최소한의 호출 시그니처를 쓴다.

객체 타입은 데이터의 수명과 변경 규칙을 함께 나타낸다.

- 식별자는 `readonly`를 검토한다.
- 없을 수 있는 값은 `?`와 사용 시점의 `undefined` 처리를 함께 설계한다.
- 동적 키가 정말 필요한지 확인한다.
- 서로 다른 상태는 선택적 프로퍼티 모음보다 판별 가능한 유니언을 사용한다.
- 짧고 위치가 중요한 자료만 튜플로 표현한다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 점

선택적 콜백 매개변수는 “호출자가 안 써도 된다”가 아니라 “함수 구현이 그 인수 없이 콜백을 호출할 수 있다”는 약속이다. 함수 타입은 구현 편의를 위한 주석이 아니라 호출 가능성을 표현하는 계약이다.

`readonly`도 완전한 불변성이나 런타임 동결이 아니다. 특정 프로퍼티를 그 타입을 통해 다시 대입할 수 없다는 뜻이다.

### 5.2 앞으로 이어지는 연결점

함수 입력과 출력의 타입 관계는 제네릭으로 이어진다. 객체 키를 타입 수준에서 다루려면 `keyof`, 인덱스 접근 타입, 매핑된 타입이 필요하다. 클래스의 생성자 타입과 인스턴스 타입을 구분하는 데도 호출·구성 시그니처가 기반이 된다.

### 5.3 더 파볼 만한 주제

- 함수 타입의 매개변수 변성
- `strictFunctionTypes`
- `satisfies`와 초과 프로퍼티 검사
- `Readonly<T>`와 깊은 불변 타입
- 명목적 타입을 흉내 내는 브랜딩

---

## 6. 요약 정리

- 함수 타입 표현식은 함수가 어떻게 호출되는지 나타낸다.
- 프로퍼티가 있는 함수는 호출 시그니처, `new`로 호출되는 값은 구성 시그니처로 표현한다.
- 선택적 매개변수는 본문에서 `undefined`일 수 있다.
- 콜백 인수를 항상 전달한다면 콜백 타입에서 선택적으로 표시하지 않는다.
- 호출 형태별 반환 타입이 달라질 때 오버로드를 사용하고, 가능하면 유니언을 우선한다.
- `readonly`는 타입 수준의 재대입 방지이지 깊은 불변성이나 런타임 동결이 아니다.
- 인덱스 시그니처는 알 수 없는 키의 값 타입을 설명한다.
- 객체 리터럴은 초과 프로퍼티 검사를 통해 오타를 더 엄격하게 찾는다.
- `extends`와 `&`로 객체 타입을 조합할 수 있다.
- 튜플은 위치와 길이가 의미를 가질 때 사용한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. `(value: string) => number`를 말로 설명할 수 있는가?
2. 호출 시그니처와 구성 시그니처의 차이는 무엇인가?
3. 콜백의 두 번째 인수를 무조건 `?`로 만들면 안 되는 이유는 무엇인가?
4. 오버로드보다 유니언이 나은 상황을 설명할 수 있는가?
5. `readonly` 객체 안의 중첩 객체가 변경될 수 있는 이유는 무엇인가?
6. 문자열 인덱스 시그니처가 명시적 프로퍼티에도 영향을 주는 이유는 무엇인가?
7. 객체 리터럴에서 오타를 발견하는 검사는 무엇인가?
8. `A & B`에서 같은 프로퍼티 타입이 충돌하면 어떻게 되는가?
9. 배열 대신 튜플을 선택해야 하는 기준은 무엇인가?

---

## 참고한 공식 문서

- [More on Functions](https://www.typescriptlang.org/ko/docs/handbook/2/functions.html)
- [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html)

> 문서 작성 기준일: 2026-07-24
