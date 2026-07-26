# TypeScript 제네릭과 타입 연산자

- 🎯 글의 목표: 제네릭으로 타입 사이의 관계를 보존하고, `keyof`·타입 위치의 `typeof`·인덱스 접근 타입으로 기존 값과 타입에서 안전하게 새 타입을 만든다.
- 🧩 핵심 키워드: Generic, Type Parameter, Type Argument, Constraint, `keyof`, `typeof`, Indexed Access Type, Generic Interface, Generic Class, `Record`
- ⭐ 중요도: ★★★★★
- 📝 한눈에 보는 내용: `any`는 어떤 값이든 받지만 입력과 출력의 관계를 잃는다. 제네릭은 타입을 나중에 결정하면서도 관계를 보존한다. 여기에 객체 키의 유니언을 만드는 `keyof`, 값에서 타입을 얻는 `typeof`, 프로퍼티 타입을 꺼내는 `T[K]`를 결합하면 반복 없이 안전한 타입을 만들 수 있다.
- 🔗 관련 문제 / 주제: 공통 API 응답, 컬렉션 유틸리티, 폼 필드, 객체 접근 함수, 재사용 컴포넌트, 상태 저장소

---

## 1. 들어가며

다음 함수는 배열의 첫 번째 원소를 반환한다.

```ts
function first(items: any[]): any {
  return items[0];
}
```

동작은 하지만 입력이 `string[]`이어도 반환값은 `any`다. TypeScript는 결과가 문자열이라는 정보를 잃고 잘못된 메서드 호출도 막지 못한다.

```ts
const value = first(["a", "b"]);
value.notExists();
```

배열 원소의 타입과 반환 타입이 같다는 관계를 표현하면 된다.

```ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}
```

`T`는 특정 타입 이름이 아니라 호출할 때 정해지는 타입 매개변수다.

```ts
const text = first(["a", "b"]); // string | undefined
const count = first([1, 2]);     // number | undefined
```

제네릭의 핵심은 “아무 타입이나”가 아니라 **여러 위치의 타입이 서로 어떻게 연결되는가**다.

---

## 2. 핵심 개념 정리

제네릭 함수는 타입을 매개변수처럼 받는다.

```ts
function identity<T>(value: T): T {
  return value;
}
```

호출할 때 `T`가 정해진다.

```ts
identity<string>("hello");
identity(100); // T는 number로 추론
```

타입 연산자는 이미 존재하는 정보에서 새 타입을 만든다.

```ts
const user = {
  id: 1,
  name: "Mina",
};

type User = typeof user;
type UserKey = keyof User;
type UserName = User["name"];
```

- `typeof user`: 값 `user`의 타입
- `keyof User`: `"id" | "name"`
- `User["name"]`: `string`

세 도구를 연결하면 실제 값과 타입 정의가 따로 흩어져 어긋나는 일을 줄일 수 있다.

---

## 3. 본문 정리

### 3.1 제네릭은 타입 관계를 보존한다

두 입력을 튜플로 묶는 함수를 보자.

```ts
function pair<A, B>(first: A, second: B): [A, B] {
  return [first, second];
}

const result = pair("age", 20);
// [string, number]
```

`A`는 첫 번째 인수와 첫 번째 튜플 원소를, `B`는 두 번째 인수와 두 번째 원소를 연결한다.

`any`로 작성하면 이 관계가 사라진다.

```ts
function unsafePair(first: any, second: any): [any, any] {
  return [first, second];
}
```

제네릭 타입 매개변수는 보통 타입이 두 번 이상 등장해 관계를 표현할 때 의미가 있다.

```ts
function logValue<T>(value: T): void {
  console.log(value);
}
```

이 함수에서는 `T`가 입력에 한 번만 나타나고 출력과 다른 값에 연결되지 않는다. 단순히 `unknown`을 쓰는 편이 의도가 선명할 수 있다.

```ts
function logValue(value: unknown): void {
  console.log(value);
}
```

### 3.2 타입 인수 추론

대부분의 호출에서는 타입 인수를 직접 쓰지 않아도 된다.

```ts
function map<Input, Output>(
  items: Input[],
  transform: (item: Input) => Output,
): Output[] {
  return items.map(transform);
}

const lengths = map(["a", "hello"], (item) => item.length);
// Input: string, Output: number
```

TypeScript는 첫 번째 인수에서 `Input`, 콜백 반환값에서 `Output`을 추론한다.

추론이 의도와 다르거나 서로 다른 입력을 하나의 유니언으로 묶고 싶을 때 타입 인수를 명시할 수 있다.

```ts
function combine<T>(left: T[], right: T[]): T[] {
  return [...left, ...right];
}

const mixed = combine<string | number>([1, 2], ["a"]);
```

명시는 필요한 경우에만 한다. 추론 가능한 타입 인수를 반복하면 호출부가 장황해진다.

### 3.3 제네릭 제약 조건

모든 타입이 아니라 특정 능력을 가진 타입만 허용하려면 `extends`로 제약한다.

```ts
type HasLength = {
  length: number;
};

function longest<T extends HasLength>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

longest("Mina", "TypeScript");
longest([1], [1, 2, 3]);
// longest(10, 20); // number에는 length가 없다.
```

제약은 `T`를 `HasLength` 자체로 바꾸지 않는다. `T`는 제약을 만족하는 더 구체적인 타입이다.

```ts
function invalid<T extends HasLength>(value: T): T {
  // return { length: value.length };
  // 제약은 만족하지만 원래 T의 다른 프로퍼티를 잃을 수 있다.
  return value;
}
```

`T`를 반환한다고 약속했다면 단순히 제약 조건만 만족하는 새 객체가 아니라 실제 `T`를 반환해야 한다.

### 3.4 객체 키에 제약 걸기

객체와 키의 관계는 `keyof`를 사용한다.

```ts
function getProperty<ObjectType, Key extends keyof ObjectType>(
  object: ObjectType,
  key: Key,
): ObjectType[Key] {
  return object[key];
}

const user = {
  id: 1,
  name: "Mina",
  active: true,
};

const name = getProperty(user, "name");   // string
const active = getProperty(user, "active"); // boolean
// getProperty(user, "email"); // 존재하지 않는 키
```

여기에는 세 가지 관계가 있다.

1. `ObjectType`은 전달된 객체 타입이다.
2. `Key`는 그 객체의 키 중 하나여야 한다.
3. 반환 타입은 선택한 키의 실제 값 타입이다.

단순히 `key: string`과 `unknown` 반환을 쓰는 것보다 훨씬 정확하다.

### 3.5 좋은 제네릭 설계 원칙

#### 타입 매개변수는 관계를 나타내야 한다

```ts
function greet<T extends string>(name: T): void {
  console.log(name);
}
```

`T`가 한 번만 사용되므로 보통은 다음이 낫다.

```ts
function greet(name: string): void {
  console.log(name);
}
```

#### 불필요한 타입 매개변수를 줄인다

```ts
function filter<T>(
  items: T[],
  predicate: (item: T) => boolean,
): T[] {
  return items.filter(predicate);
}
```

콜백 타입을 다시 별도 타입 매개변수로 만들 이유가 없다면 단순하게 유지한다.

#### 제약 타입보다 타입 매개변수 자체를 사용한다

```ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}
```

`T extends any[]`처럼 배열 전체를 타입 매개변수로 잡고 제약을 통해 원소에 접근하면 추론이 `any`로 약해질 수 있다.

### 3.6 제네릭 타입과 인터페이스

함수뿐 아니라 객체 타입도 제네릭으로 만들 수 있다.

```ts
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

interface User {
  id: number;
  name: string;
}

const response: ApiResponse<User[]> = {
  data: [{ id: 1, name: "Mina" }],
  status: 200,
  message: "OK",
};
```

컨테이너의 구조는 같고 내부 데이터만 달라질 때 유용하다.

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

`E = Error`는 기본 타입 인수다. 두 번째 타입을 생략하면 `Error`를 사용한다.

```ts
type UserResult = Result<User>;
type ValidationResult = Result<User, string[]>;
```

### 3.7 제네릭 클래스

클래스도 타입 매개변수를 가질 수 있다.

```ts
class Box<T> {
  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
  }
}

const numberBox = new Box(10);
numberBox.set(20);
```

제네릭 클래스의 타입 매개변수는 인스턴스 측에만 적용된다. `static` 멤버는 클래스 전체에 하나이므로 인스턴스별 `T`를 사용할 수 없다.

### 3.8 `keyof` 타입 연산자

`keyof`는 객체 타입의 키를 문자열 또는 숫자 리터럴 유니언으로 만든다.

```ts
type User = {
  id: number;
  name: string;
  active: boolean;
};

type UserKey = keyof User;
// "id" | "name" | "active"
```

인덱스 시그니처가 있으면 결과가 넓어진다.

```ts
type NumberMap = {
  [key: string]: number;
};

type MapKey = keyof NumberMap;
// string | number
```

JavaScript 객체 키에서 숫자 `0`과 문자열 `"0"`이 같은 프로퍼티를 가리킬 수 있기 때문이다.

### 3.9 값 공간과 타입 공간의 `typeof`

JavaScript 표현식에서 `typeof`는 실행 시점 문자열을 반환한다.

```ts
console.log(typeof "hello"); // "string"
```

타입 위치의 `typeof`는 변수나 프로퍼티의 정적 타입을 얻는다.

```ts
const defaultOptions = {
  retry: 3,
  cache: true,
};

type Options = typeof defaultOptions;
// { retry: number; cache: boolean }
```

함수의 타입도 얻을 수 있다.

```ts
function createUser() {
  return {
    id: 1,
    name: "Mina",
  };
}

type CreateUser = typeof createUser;
type User = ReturnType<typeof createUser>;
```

`createUser`는 값이므로 타입 인수로 직접 쓸 수 없고 `typeof createUser`로 그 값의 타입을 얻어야 한다.

### 3.10 인덱스 접근 타입

객체 타입의 특정 프로퍼티 타입은 대괄호로 꺼낸다.

```ts
type User = {
  id: number;
  name: string;
  active: boolean;
};

type UserName = User["name"]; // string
```

키 유니언을 넣으면 값 타입도 유니언이 된다.

```ts
type Identity = User["id" | "name"];
// number | string

type UserValue = User[keyof User];
// number | string | boolean
```

배열 타입을 `number`로 인덱싱하면 원소 타입을 얻는다.

```ts
const users = [
  { id: 1, name: "Mina" },
  { id: 2, name: "Joon" },
];

type User = typeof users[number];
type UserId = typeof users[number]["id"];
```

이 패턴은 상수 데이터에서 타입을 파생할 때 자주 사용한다.

### 3.11 값에서 유니언 타입 만들기

리터럴 배열과 `as const`를 결합한다.

```ts
const roles = ["admin", "member", "guest"] as const;

type Role = typeof roles[number];
// "admin" | "member" | "guest"
```

값 목록과 타입 목록을 따로 관리하지 않으므로 새로운 역할을 배열에 추가하면 타입도 함께 바뀐다.

객체 키에서도 만들 수 있다.

```ts
const permissions = {
  admin: ["read", "write", "delete"],
  member: ["read", "write"],
  guest: ["read"],
} as const;

type Role = keyof typeof permissions;
```

### 3.12 실전 예제: 타입 안전한 폼 필드 갱신

```ts
interface SignupForm {
  email: string;
  age: number;
  agreed: boolean;
}

function updateField<K extends keyof SignupForm>(
  form: SignupForm,
  key: K,
  value: SignupForm[K],
): SignupForm {
  return {
    ...form,
    [key]: value,
  };
}
```

호출 결과를 살펴보자.

```ts
const form: SignupForm = {
  email: "mina@example.com",
  age: 20,
  agreed: false,
};

updateField(form, "email", "new@example.com");
updateField(form, "age", 21);
// updateField(form, "age", "21"); // 오류
```

키 `K`가 `"age"`로 추론되면 `SignupForm[K]`는 `number`가 된다. 키와 값의 관계를 하나의 제네릭 매개변수로 묶은 것이다.

---

## 4. 적용 관점에서 다시 보기

제네릭을 사용하기 전에 먼저 관계를 문장으로 적어 본다.

- 입력 배열의 원소 타입과 반환 타입이 같다.
- 객체의 키와 반환되는 프로퍼티 타입이 연결된다.
- API 컨테이너 구조는 같고 `data` 타입만 바뀐다.
- 성공 결과의 값 타입과 호출자에게 전달되는 타입이 같다.

이런 관계가 없다면 제네릭이 필요하지 않을 수 있다.

타입을 새로 복사하기 전에 기존 정보에서 파생할 수 있는지 확인한다.

```ts
type Config = typeof config;
type ConfigKey = keyof Config;
type ConfigValue = Config[ConfigKey];
```

값이 진실의 원천이라면 `typeof`, 타입이 진실의 원천이라면 `keyof`와 인덱스 접근을 활용한다. 단, 외부 API 응답처럼 런타임 검증이 필요한 데이터에 `typeof`만 적용한다고 검증되는 것은 아니다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 점

제네릭은 `any`의 안전한 표기가 아니다. `any`는 관계를 지우고, 제네릭은 호출마다 구체적인 타입을 선택해 관계를 유지한다. 타입 매개변수가 한 번만 등장한다면 실제로 아무 관계도 표현하지 않을 수 있다.

### 5.2 앞으로 이어지는 연결점

`T[K]`와 `keyof T`를 반복 순회하면 매핑된 타입이 된다. 타입 조건에 따라 결과를 고르면 조건부 타입이 된다. 함수나 배열 구조 안에서 타입을 추출하려면 `infer`가 필요하다.

### 5.3 더 파볼 만한 주제

- `const` 타입 매개변수
- 제네릭 기본값
- 타입 매개변수의 분산과 변성
- `satisfies`로 값 검증과 리터럴 추론 유지하기
- 재귀 제네릭 타입

---

## 6. 요약 정리

- 제네릭은 여러 값과 반환값 사이의 타입 관계를 보존한다.
- 타입 인수는 대부분 호출 인수와 콜백 문맥에서 추론된다.
- `extends` 제약은 허용 가능한 타입의 능력을 제한한다.
- 제약을 만족하는 타입과 구체적인 `T` 자체는 다르다.
- 타입 매개변수는 관계를 표현할 때 사용하고 가능한 한 적게 둔다.
- `keyof T`는 객체 키의 유니언을 만든다.
- 타입 위치의 `typeof`는 값의 정적 타입을 얻는다.
- `T[K]`는 객체 타입에서 특정 키의 값 타입을 얻는다.
- `typeof array[number]`는 배열 원소 타입을 추출한다.
- 값 목록과 `as const`를 이용하면 리터럴 유니언을 중복 없이 만들 수 있다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. `any` 함수와 제네릭 함수의 차이를 설명할 수 있는가?
2. 타입 매개변수가 한 번만 등장하면 제네릭이 불필요할 수 있는 이유는 무엇인가?
3. 제약 조건을 만족하는 객체가 항상 `T` 자체는 아닌 이유는 무엇인가?
4. `K extends keyof T`가 보장하는 것은 무엇인가?
5. 값 공간의 `typeof`와 타입 공간의 `typeof`는 어떻게 다른가?
6. `User[keyof User]`의 결과는 무엇인가?
7. `typeof items[number]` 패턴을 설명할 수 있는가?
8. `as const` 배열에서 리터럴 유니언을 만들 수 있는가?

---

## 참고한 공식 문서

- [Generics](https://www.typescriptlang.org/ko/docs/handbook/2/generics.html)
- [Keyof Type Operator](https://www.typescriptlang.org/ko/docs/handbook/2/keyof-types.html)
- [Typeof Type Operator](https://www.typescriptlang.org/ko/docs/handbook/2/typeof-types.html)
- [Indexed Access Types](https://www.typescriptlang.org/ko/docs/handbook/2/indexed-access-types.html)

> 문서 작성 기준일: 2026-07-24
