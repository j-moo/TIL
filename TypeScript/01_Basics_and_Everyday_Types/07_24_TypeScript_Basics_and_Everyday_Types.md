# TypeScript 기초와 일상 타입

- 🎯 글의 목표: TypeScript가 JavaScript 코드에 무엇을 더하는지 이해하고, 자주 사용하는 타입과 타입 좁히기를 이용해 실행 전에 오류를 발견하는 코드를 작성한다.
- 🧩 핵심 키워드: Static Type Checking, Type Inference, Type Annotation, `tsc`, `strict`, Primitive Type, Array, `any`, `unknown`, Function Type, Object Type, Optional Property, Union Type, Narrowing, Type Alias, Interface, Structural Typing, Literal Type, Type Assertion, `as const`, `null`, `undefined`, `never`
- ⭐ 중요도: ★★★★★
  TypeScript의 모든 고급 기능은 결국 “어떤 값이 들어올 수 있는가”와 “현재 분기에서 그 값이 무엇이라고 확신할 수 있는가”를 표현하는 데서 출발한다. React·Vue·Node.js 프로젝트에서 컴포넌트 속성, API 응답, 이벤트, 상태를 안전하게 다루려면 반드시 익혀야 하는 기초다.
- 📝 한눈에 보는 내용:
  TypeScript는 JavaScript를 대신하는 별도의 런타임이 아니라 JavaScript 코드가 실행되기 전에 값의 사용 방식을 검사하는 정적 타입 검사기다. 이 글에서는 TypeScript를 설치하고 검사하는 흐름부터 시작해 원시 타입, 배열, 함수, 객체, 유니언을 차례대로 살펴본다. 이어서 `typeof`, `in`, `instanceof`와 판별 가능한 유니언으로 타입을 좁히는 원리를 익히고, 타입 별칭·인터페이스·리터럴 타입·타입 단언·엄격한 null 검사까지 연결한다.
- 🔗 관련 문제 / 주제: JavaScript 프로젝트의 TypeScript 전환, Vue·React 컴포넌트 타입, API 응답 검증, 폼 입력값 처리, 상태 모델링, 런타임 오류 예방

---

## 1. 들어가며

JavaScript는 값의 타입을 미리 선언하지 않아도 바로 실행할 수 있다. 작은 코드를 빠르게 작성할 때는 편리하지만, 프로그램이 커지면 “이 값에 지금 이 메서드를 호출해도 되는가?”라는 질문에 답하기 어려워진다.

다음 코드는 문법적으로 올바른 JavaScript다.

```js
const user = {
  name: "Mina",
  age: 20,
};

console.log(user.nmae.toUpperCase());
```

문제는 `name`을 `nmae`으로 잘못 썼다는 것이다. JavaScript는 객체에 없는 프로퍼티를 읽어도 코드를 실행하기 전에는 알려주지 않는다. 실행하면 `user.nmae`은 `undefined`가 되고, 그 값에서 `toUpperCase()`를 호출하는 순간 오류가 발생한다.

TypeScript는 이 문제를 코드가 실행되기 전에 발견한다.

```ts
const user = {
  name: "Mina",
  age: 20,
};

console.log(user.nmae.toUpperCase());
//            ~~~~
// Property 'nmae' does not exist on type '{ name: string; age: number; }'.
// Did you mean 'name'?
```

여기서 중요한 점은 TypeScript가 `user`의 실제 값을 실행해 본 것이 아니라는 사실이다. 객체의 구조를 분석해 `name`과 `age`가 있다는 정보를 만들고, 그 정보에 없는 `nmae` 접근을 오류로 판단한 것이다.

이번 글은 타입 문법을 외우는 방식으로 진행하지 않는다. 먼저 TypeScript가 어떤 문제를 해결하는지 살펴보고, 다음 질문에 차례로 답한다.

1. TypeScript와 JavaScript는 어떤 관계인가?
2. 타입을 항상 직접 적어야 하는가?
3. 하나의 값이 여러 타입일 수 있을 때는 어떻게 표현하는가?
4. 여러 타입 중 현재 값의 타입을 어떻게 알아내는가?
5. TypeScript의 검사를 언제 믿고, 언제 개발자가 추가로 확인해야 하는가?

이 흐름을 이해하면 `string`, `number` 같은 개별 문법이 서로 떨어진 지식이 아니라 하나의 타입 검사 과정으로 연결된다.

---

## 2. 핵심 개념 정리

이번 글의 큰 질문은 다음과 같다.

> JavaScript의 유연한 실행 방식은 유지하면서, 값의 잘못된 사용을 실행 전에 발견하려면 어떻게 해야 할까?

TypeScript는 JavaScript에 **정적 타입 검사**를 더해 이 질문에 답한다. 정적 검사는 프로그램을 실제로 실행하지 않고 코드를 분석하는 과정이다. 타입 검사기는 각 값이 어떤 동작을 할 수 있는지 추적하고, 그 범위를 벗어난 사용을 오류로 알려준다.

예를 들어 문자열에는 `toUpperCase()`가 있지만 숫자에는 없다.

```ts
const message = "hello";
message.toUpperCase(); // 가능

const count = 10;
count.toUpperCase();
//    ~~~~~~~~~~~
// Property 'toUpperCase' does not exist on type 'number'.
```

이 과정의 핵심 흐름은 다음과 같다.

1. TypeScript가 코드와 타입 표기를 읽는다.
2. 명시적인 타입이 없으면 값과 문맥으로부터 타입을 추론한다.
3. 각 연산이 현재 타입에서 가능한지 검사한다.
4. 타입 오류를 개발자에게 알린다.
5. JavaScript로 변환할 때 타입 표기를 제거한다.

따라서 TypeScript의 타입은 주로 개발 단계에서 존재한다.

```ts
// TypeScript
function add(a: number, b: number): number {
  return a + b;
}
```

```js
// 타입이 제거된 JavaScript
function add(a, b) {
  return a + b;
}
```

`number`라는 정보는 결과 JavaScript에 남지 않는다. 실행 시점에 외부에서 `"1"`과 `"2"`가 들어오는 것을 TypeScript 타입 자체가 막아 주는 것도 아니다. API 응답, 사용자 입력, 로컬 스토리지처럼 프로그램 외부에서 들어오는 값은 런타임 검사가 별도로 필요하다.

이제 이 관점을 바탕으로 다음 순서로 확장한다.

- 타입 추론으로 기본 타입을 얻는다.
- 타입 표기로 함수와 객체의 약속을 명확히 한다.
- 유니언 타입으로 가능한 값의 범위를 표현한다.
- 조건문으로 유니언 타입을 더 구체적인 타입으로 좁힌다.
- 타입 별칭과 인터페이스로 반복되는 구조에 이름을 붙인다.
- 리터럴 타입과 판별 가능한 유니언으로 상태를 정확히 모델링한다.
- `strict` 모드에서 `null`과 `undefined` 가능성까지 검사한다.

---

## 3. 본문 정리

### 3.1 TypeScript는 정적 타입 검사기다

TypeScript를 처음 배울 때 가장 먼저 구분해야 하는 것은 **컴파일 시간**과 **런타임**이다.

| 구분 | 의미 | 대표적인 일 |
|---|---|---|
| 컴파일 시간 | 코드를 실행하기 전에 분석하는 시점 | 타입 검사, 문법 변환, 오류 표시 |
| 런타임 | 변환된 JavaScript가 실제로 실행되는 시점 | 함수 호출, 네트워크 요청, 화면 렌더링 |

TypeScript는 주로 컴파일 시간에 동작한다. 값의 타입을 추적하고 잘못된 연산을 발견하지만, JavaScript 엔진을 대신해 프로그램을 실행하지는 않는다.

```ts
const product = {
  price: 10_000,
};

product.price.toFixed(2); // number가 가진 메서드이므로 가능
product.price.trim();     // number에는 trim이 없으므로 타입 오류
```

이 코드에서 타입 검사기는 `price`의 초깃값이 숫자라는 사실로부터 `number`를 추론한다. 그래서 `number`가 가진 `toFixed()`는 허용하고, 문자열 메서드인 `trim()`은 거부한다.

#### 3.1.1 JavaScript의 상위 집합

TypeScript는 JavaScript의 **상위 집합(superset)** 이다. 일반적인 JavaScript 문법을 그대로 사용하면서 그 위에 타입을 표현하는 문법을 추가한다.

```js
// JavaScript이며 동시에 유효한 TypeScript
const title = "TypeScript";
console.log(title.toLowerCase());
```

```ts
// 타입 문법이 추가된 TypeScript
const title: string = "TypeScript";
```

이 관계 때문에 TypeScript를 배울 때 JavaScript 학습을 건너뛸 수는 없다. 배열을 정렬하고, 비동기 요청을 보내고, DOM을 조작하는 실제 런타임 동작은 여전히 JavaScript의 규칙을 따른다. TypeScript는 그런 코드를 더 안전하게 작성하도록 도와주는 층이다.

#### 3.1.2 런타임 동작은 JavaScript와 같다

TypeScript는 타입 때문에 JavaScript의 실행 결과를 임의로 바꾸지 않는다.

```ts
console.log(1 / 0); // Infinity
```

0으로 나눈 결과가 `Infinity`가 되는 것은 JavaScript의 규칙이다. TypeScript를 사용한다고 해서 예외로 바뀌지 않는다.

또한 타입 검사를 통과했다고 모든 런타임 오류가 사라지는 것도 아니다.

```ts
const parsed: { name: string } = JSON.parse('{"age": 20}');
console.log(parsed.name.toUpperCase());
```

`JSON.parse()`의 반환 타입이 안전하게 검증되지 않은 상태에서 개발자가 `{ name: string }`이라고 믿어 버리면, TypeScript는 그 믿음을 바탕으로 검사한다. 실제 JSON에는 `name`이 없으므로 실행 시 오류가 발생한다.

> 꼭 기억할 핵심: TypeScript 타입은 외부 데이터를 검증하는 런타임 장치가 아니다. 타입은 코드가 가진 정보를 바탕으로 개발 중 실수를 찾는 도구다.

#### 3.1.3 타입은 결과 코드에서 지워진다

타입 표기, 타입 별칭, 인터페이스는 일반적으로 JavaScript 출력에서 제거된다.

```ts
interface User {
  id: number;
  name: string;
}

function greet(user: User): string {
  return `안녕하세요, ${user.name}님`;
}
```

대략 다음과 같은 JavaScript가 된다.

```js
function greet(user) {
  return `안녕하세요, ${user.name}님`;
}
```

런타임 코드에서 `User`를 찾거나 `instanceof User`를 사용할 수 없는 이유도 여기에 있다. `interface User`는 실행 가능한 값이 아니라 타입 검사기만 사용하는 정보다.

```ts
interface User {
  id: number;
}

declare const value: unknown;

// value instanceof User
//                  ~~~~
// 'User' only refers to a type, but is being used as a value here.
```

클래스는 다르다. 클래스 선언은 타입 정보이면서 런타임에 존재하는 생성자 값이므로 `instanceof`에 사용할 수 있다.

---

### 3.2 설치, 검사, 컴파일 흐름

공식 문서는 프로젝트마다 TypeScript를 설치하는 방식을 권장한다. 프로젝트별 설치는 `package.json`과 잠금 파일을 통해 팀원이 같은 TypeScript 버전을 사용하게 해 준다.

```bash
npm install --save-dev typescript
```

설치 후 컴파일러는 `npx tsc`로 실행할 수 있다.

```bash
npx tsc --version
npx tsc
```

새 프로젝트에서는 다음 명령으로 기본 설정 파일을 만들 수 있다.

```bash
npx tsc --init
```

`tsconfig.json`은 현재 디렉터리가 TypeScript 프로젝트의 기준점임을 나타내고, 어떤 파일을 검사하며 어떤 방식으로 JavaScript를 출력할지 정한다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true,
    "noEmitOnError": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

각 설정의 역할은 다음과 같다.

| 옵션 | 역할 |
|---|---|
| `target` | 출력할 JavaScript 문법 수준을 정한다. |
| `module` | 모듈 코드를 어떤 형식으로 다룰지 정한다. |
| `strict` | 엄격한 타입 검사 옵션 묶음을 활성화한다. |
| `noEmitOnError` | 타입 오류가 있을 때 JavaScript 출력을 만들지 않는다. |
| `outDir` | 변환된 파일을 저장할 디렉터리를 정한다. |
| `include` | 프로젝트 검사 대상 파일 패턴을 정한다. |

`strict`는 하나의 검사만 켜는 옵션이 아니다. `noImplicitAny`, `strictNullChecks` 등 여러 엄격한 검사를 함께 활성화하는 상위 옵션이다. 입문 단계부터 `strict: true`로 연습하면 느슨한 타입에 의존하는 습관을 줄일 수 있다.

> ⚠️ 주의: Babel, SWC 같은 도구도 TypeScript 문법을 JavaScript로 변환할 수 있지만, 변환과 타입 검사는 같은 일이 아니다. 도구가 타입 문법을 제거해 준다고 해서 타입 오류까지 검사했다는 뜻은 아니다.

간단한 문법 실험은 공식 TypeScript Playground에서도 할 수 있다. 왼쪽에 TypeScript를 작성하면 오류와 추론 타입을 확인하고, 변환된 JavaScript도 함께 볼 수 있다.

---

### 3.3 원시 타입과 배열

일상적인 TypeScript 코드에서 가장 먼저 만나는 원시 타입은 `string`, `number`, `boolean`이다.

```ts
const courseName: string = "TypeScript";
const lessonCount: number = 12;
const isPublished: boolean = true;
```

JavaScript에는 정수와 실수를 구분하는 별도 숫자 타입이 없으므로 둘 다 `number`다.

```ts
const age: number = 20;
const rate: number = 0.15;
const infinity: number = Infinity;
const invalidNumber: number = NaN;
```

타입 이름은 소문자로 쓴다.

```ts
const message: string = "hello"; // 권장

// const another: String = "hello";
// 일반적인 코드에서는 래퍼 객체 타입인 String을 사용하지 않는다.
```

`String`, `Number`, `Boolean`은 JavaScript의 래퍼 객체와 관련된 특수한 타입이다. 보통 값의 타입을 표현할 때는 `string`, `number`, `boolean`을 사용한다.

#### 3.3.1 배열 타입

숫자 배열은 `number[]`, 문자열 배열은 `string[]`로 표현한다.

```ts
const scores: number[] = [90, 85, 100];
const tags: string[] = ["typescript", "javascript"];
```

제네릭 표기인 `Array<number>`도 같은 의미다.

```ts
const scores: Array<number> = [90, 85, 100];
```

다만 `[number]`는 `number[]`와 다르다.

```ts
const manyNumbers: number[] = [1, 2, 3];
const exactlyOneNumber: [number] = [1];
```

`[number]`는 원소가 정확히 하나이고 그 원소가 숫자인 **튜플 타입**이다. 대괄호 위치가 비슷해도 의미가 다르므로 주의한다.

#### 3.3.2 타입 추론

TypeScript에서는 모든 변수에 타입을 직접 적을 필요가 없다. 초깃값과 사용 문맥으로부터 타입을 알아낼 수 있기 때문이다.

```ts
const language = "TypeScript";
// language는 string으로 추론된다.

const versions = [5, 6];
// versions는 number[]로 추론된다.
```

다음 표기는 가능하지만 정보가 반복된다.

```ts
const language: string = "TypeScript";
```

변수 선언에서 초깃값이 타입을 충분히 보여 준다면 추론을 활용하는 편이 간결하다. 반면 함수의 매개변수, 공개 API의 반환 타입, 빈 배열처럼 문맥이 부족한 위치에서는 타입 표기가 의도를 분명히 하는 데 도움이 된다.

```ts
const names: string[] = [];

function findUser(id: number): User | undefined {
  // 구현이 바뀌더라도 외부에 약속한 반환 타입을 유지한다.
  return users.find((user) => user.id === id);
}
```

> 꼭 기억할 핵심: TypeScript를 잘 쓴다는 것은 모든 곳에 타입을 많이 적는다는 뜻이 아니다. 추론할 수 있는 곳은 맡기고, 경계와 약속이 되는 곳에 타입을 적는 것이 중요하다.

---

### 3.4 `any`와 `unknown`

#### 3.4.1 `any`는 타입 검사를 끈다

`any` 타입의 값에는 거의 모든 작업이 허용된다.

```ts
let value: any = { name: "Mina" };

value.notExists.deep.property;
value();
value = 100;

const count: number = value;
```

이 코드는 타입 검사 단계에서 대부분 오류가 나지 않는다. 하지만 안전하다는 뜻이 아니라 TypeScript가 검사를 포기했다는 뜻이다.

`any`는 주변으로 퍼지는 성질도 있다.

```ts
function getData(): any {
  return JSON.parse('{"name":"Mina"}');
}

const data = getData();
data.nmae.toUpperCase(); // 오타지만 검사되지 않는다.
```

`noImplicitAny`를 활성화하면 TypeScript가 타입을 추론하지 못해 암묵적으로 `any`가 되는 상황을 오류로 처리한다. `strict: true`를 사용하면 이 검사도 함께 활성화된다.

```ts
function greet(name) {
  // strict 모드에서는 name이 암묵적 any이므로 오류
  return `Hello, ${name}`;
}
```

#### 3.4.2 `unknown`은 확인하기 전까지 사용할 수 없다

값의 타입을 정말 모른다면 `any`보다 `unknown`이 안전하다.

```ts
let input: unknown = JSON.parse('{"name":"Mina"}');

// input.name
// 'input' is of type 'unknown'.
```

`unknown`에는 어떤 값이든 넣을 수 있지만, 값을 사용하려면 먼저 검사해야 한다.

```ts
function printLength(value: unknown): void {
  if (typeof value === "string") {
    console.log(value.length);
  }
}
```

조건문 안에서 `value`가 문자열임을 확인했으므로 그 분기에서만 문자열 메서드와 프로퍼티를 사용할 수 있다.

| 타입 | 어떤 값이든 할당 가능 | 검사 없이 사용 가능 | 안전성 |
|---|---:|---:|---|
| `any` | 가능 | 가능 | 낮음 |
| `unknown` | 가능 | 불가능 | 높음 |

API 응답, `JSON.parse()` 결과, `catch`에서 받은 오류처럼 출처를 완전히 신뢰할 수 없는 값은 `unknown`으로 받고 좁히는 습관이 좋다.

```ts
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
```

---

### 3.5 함수의 입력과 출력에 타입 붙이기

함수는 값이 들어오고 나가는 경계다. 따라서 함수의 매개변수 타입은 “이 함수가 어떤 입력을 허용하는가”를 나타내는 계약이 된다.

```ts
function greet(name: string) {
  return `Hello, ${name.toUpperCase()}!`;
}

greet("Mina"); // 가능
greet(42);     // number는 string 매개변수에 전달할 수 없다.
```

매개변수의 타입은 이름 뒤에 작성한다.

```text
매개변수이름: 타입
```

반환 타입은 매개변수 목록 뒤에 작성한다.

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

반환 타입도 TypeScript가 추론할 수 있다.

```ts
function add(a: number, b: number) {
  return a + b;
}
// 반환 타입은 number로 추론된다.
```

그럼 언제 반환 타입을 직접 적는 것이 좋을까?

- 외부에서 사용하는 공개 함수의 계약을 분명히 할 때
- 구현 변경으로 반환 타입이 뜻하지 않게 바뀌는 것을 막을 때
- 여러 분기가 모두 올바른 타입을 반환하는지 확인할 때
- 함수 자체가 문서 역할을 해야 할 때

```ts
type User = {
  id: number;
  name: string;
};

function createUser(id: number, name: string): User {
  return { id, name };
}
```

#### 3.5.1 반환하지 않는 함수와 `void`

의미 있는 값을 반환하지 않는 함수는 `void`로 표현할 수 있다.

```ts
function logMessage(message: string): void {
  console.log(message);
}
```

`void`는 함수가 반환한 값을 호출자가 사용하지 않는다는 의미로 이해하는 것이 좋다. 단순히 `undefined`와 언제나 완전히 같다고 외우면 함수 타입을 깊게 배울 때 혼란이 생길 수 있다.

#### 3.5.2 문맥적 타입 부여

익명 함수와 화살표 함수의 매개변수는 주변 문맥에서 타입을 얻기도 한다.

```ts
const names = ["Mina", "Joon", "Alex"];

names.forEach((name) => {
  console.log(name.toUpperCase());
});
```

`name`에 `: string`을 적지 않았지만, TypeScript는 `names`가 `string[]`이고 `forEach()` 콜백이 배열 원소를 받는다는 사실을 알고 있다. 그래서 `name`을 `string`으로 추론한다.

```ts
names.forEach((name) => {
  console.log(name.toFixed(2));
  //               ~~~~~~~
  // string에는 toFixed가 없다.
});
```

이처럼 값이 사용되는 위치로부터 타입이 정해지는 것을 **문맥적 타입 부여(contextual typing)** 라고 한다.

---

### 3.6 객체 타입과 옵셔널 프로퍼티

객체 타입은 객체가 가져야 할 프로퍼티와 각 프로퍼티의 타입을 표현한다.

```ts
function printUser(user: { id: number; name: string }): void {
  console.log(`${user.id}: ${user.name}`);
}

printUser({ id: 1, name: "Mina" });
```

이 타입은 `id`와 `name`을 모두 요구한다.

```ts
printUser({ id: 1 });
// name 프로퍼티가 없으므로 오류
```

TypeScript는 객체가 특정 이름의 클래스로 만들어졌는지보다 필요한 구조를 가졌는지에 관심을 둔다.

```ts
const member = {
  id: 1,
  name: "Mina",
  role: "admin",
};

printUser(member); // id와 name이 있으므로 가능
```

`printUser()`가 요구한 `id`, `name` 구조를 `member`가 만족하므로 전달할 수 있다. 이를 **구조적 타이핑(structural typing)** 이라고 한다.

#### 3.6.1 옵셔널 프로퍼티

항상 존재하지 않아도 되는 프로퍼티에는 이름 뒤에 `?`를 붙인다.

```ts
type Profile = {
  nickname: string;
  bio?: string;
};

const first: Profile = {
  nickname: "typescript-lover",
};

const second: Profile = {
  nickname: "web-developer",
  bio: "프론트엔드를 공부합니다.",
};
```

`bio?`는 프로퍼티가 없을 수 있다는 뜻이다. 따라서 읽은 값은 `string | undefined`로 취급된다.

```ts
function printBio(profile: Profile): void {
  // profile.bio.toUpperCase();
  // 'profile.bio' is possibly 'undefined'.

  if (profile.bio !== undefined) {
    console.log(profile.bio.toUpperCase());
  }
}
```

옵셔널 체이닝을 사용할 수도 있다.

```ts
function printBio(profile: Profile): void {
  console.log(profile.bio?.toUpperCase());
}
```

`bio`가 없으면 전체 표현식의 결과는 `undefined`가 된다. `?.`가 기본값까지 제공하지는 않는다는 점에 주의한다.

```ts
const bio = profile.bio?.toUpperCase() ?? "소개 없음";
```

`??`를 함께 사용하면 결과가 `null` 또는 `undefined`일 때 기본값을 지정할 수 있다.

---

### 3.7 유니언 타입: 여러 가능성을 하나의 타입으로 표현하기

값이 문자열 또는 숫자일 수 있다면 `|`로 타입을 연결한다.

```ts
type Id = string | number;

function printId(id: Id): void {
  console.log(`ID: ${id}`);
}

printId(101);
printId("user-101");
```

`string | number`는 문자열 값의 집합과 숫자 값의 집합을 합친 타입이다. 따라서 둘 중 어느 값이든 전달할 수 있다.

하지만 유니언 타입의 값을 사용할 때는 모든 멤버에서 안전한 작업만 바로 할 수 있다.

```ts
function normalizeId(id: string | number): string {
  // return id.toUpperCase();
  // number에는 toUpperCase가 없다.

  return id.toString();
  // string과 number 모두 toString을 사용할 수 있다.
}
```

문자열에서만 가능한 작업을 하려면 먼저 현재 값이 문자열인지 확인해야 한다. 이 과정을 **타입 좁히기(narrowing)** 라고 한다.

```ts
function normalizeId(id: string | number): string {
  if (typeof id === "string") {
    return id.toUpperCase();
  }

  return id.toString();
}
```

`if` 분기 안에서 `id`는 `string`, 그 이후에는 `number`로 좁혀진다. TypeScript는 조건문과 반환 흐름을 분석해 각 위치에서 가능한 타입을 계산한다.

---

### 3.8 타입 좁히기

타입 좁히기는 TypeScript의 핵심 사고방식이다. 타입을 처음부터 하나로 강제하는 것이 아니라, 가능한 타입을 유니언으로 표현한 뒤 실행 흐름 속 증거를 이용해 더 구체적인 타입으로 좁힌다.

#### 3.8.1 `typeof` 좁히기

JavaScript의 `typeof` 결과를 조건으로 사용하면 TypeScript도 그 정보를 이해한다.

```ts
function format(value: string | number): string {
  if (typeof value === "string") {
    return value.trim();
  }

  return value.toFixed(2);
}
```

자주 사용하는 `typeof` 결과는 다음과 같다.

| 값 | `typeof` 결과 |
|---|---|
| 문자열 | `"string"` |
| 숫자 | `"number"` |
| 불리언 | `"boolean"` |
| `bigint` | `"bigint"` |
| `symbol` | `"symbol"` |
| 함수 | `"function"` |
| 일반 객체 | `"object"` |
| `undefined` | `"undefined"` |

JavaScript에서 `typeof null`은 역사적인 이유로 `"object"`다.

```ts
function printAll(values: string[] | null): void {
  if (typeof values === "object") {
    // 이 분기만으로는 values가 null일 가능성이 남는다.
  }
}
```

따라서 객체 여부를 확인할 때 `null` 검사를 함께 고려해야 한다.

```ts
function printAll(values: string[] | null): void {
  if (values !== null && typeof values === "object") {
    values.forEach(console.log);
  }
}
```

#### 3.8.2 배열 확인과 `Array.isArray()`

배열도 `typeof` 결과가 `"object"`이므로 `Array.isArray()`를 사용한다.

```ts
function welcome(target: string | string[]): string {
  if (Array.isArray(target)) {
    return `Hello, ${target.join(", ")}`;
  }

  return `Hello, ${target}`;
}
```

첫 번째 분기에서 `target`은 `string[]`, 두 번째 분기에서는 `string`이다.

#### 3.8.3 진실성 검사

JavaScript 조건문은 값을 불리언으로 변환해 판단한다. TypeScript도 이 흐름을 좁히기에 활용한다.

```ts
function printName(name: string | null): void {
  if (name) {
    console.log(name.toUpperCase());
  }
}
```

다만 진실성 검사는 `null`과 `undefined`뿐 아니라 `""`, `0`, `false`, `NaN`도 거짓으로 취급한다.

```ts
function printLength(text: string | null): void {
  if (text) {
    console.log(text.length);
  }
}
```

빈 문자열 `""`도 유효한 입력이라면 위 코드는 빈 문자열 분기를 건너뛴다. 의도가 `null`만 제외하는 것이라면 명시적으로 검사한다.

```ts
function printLength(text: string | null): void {
  if (text !== null) {
    console.log(text.length); // 빈 문자열도 길이 0으로 출력
  }
}
```

#### 3.8.4 동등성 검사

두 값이 같다는 조건도 타입 정보를 제공한다.

```ts
function compare(x: string | number, y: string | boolean): void {
  if (x === y) {
    // 두 유니언에 공통으로 들어 있는 타입은 string뿐이다.
    console.log(x.toUpperCase());
    console.log(y.toLowerCase());
  }
}
```

`x === y`가 참이면서 두 값의 타입이 모두 될 수 있는 공통 가능성은 `string`이다. 따라서 해당 분기에서 둘 다 문자열로 좁혀진다.

#### 3.8.5 `in` 연산자 좁히기

객체에 특정 프로퍼티가 있는지 검사할 때 `in`을 사용할 수 있다.

```ts
type Admin = {
  name: string;
  permissions: string[];
};

type Member = {
  name: string;
  points: number;
};

function printAccount(account: Admin | Member): void {
  if ("permissions" in account) {
    console.log(account.permissions.join(", "));
  } else {
    console.log(account.points);
  }
}
```

`permissions`가 있는 분기에서는 `Admin`, 그렇지 않은 분기에서는 `Member`로 좁혀진다.

옵셔널 프로퍼티가 양쪽 타입에 존재할 수 있다면 분리가 완전하지 않을 수 있다. 단순히 프로퍼티 존재 여부만으로 모델을 구분하기보다 뒤에서 살펴볼 판별 프로퍼티를 두는 방식이 더 명확한 경우가 많다.

#### 3.8.6 `instanceof` 좁히기

클래스 인스턴스나 `Date`, `Error`처럼 런타임 생성자가 존재하는 값은 `instanceof`로 좁힐 수 있다.

```ts
function formatDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}
```

`interface`와 `type`은 런타임에 사라지므로 `instanceof`의 오른쪽에 사용할 수 없다. `instanceof`는 실제 생성자 함수와 프로토타입 관계를 검사한다.

#### 3.8.7 사용자 정의 타입 가드

반복되는 검사 로직은 타입 가드 함수로 만들 수 있다. 반환 타입의 `value is Fish` 부분을 **타입 서술어(type predicate)** 라고 한다.

```ts
type Fish = {
  swim: () => void;
};

type Bird = {
  fly: () => void;
};

function isFish(value: Fish | Bird): value is Fish {
  return "swim" in value;
}

function move(animal: Fish | Bird): void {
  if (isFish(animal)) {
    animal.swim();
  } else {
    animal.fly();
  }
}
```

타입 서술어는 검사 결과와 TypeScript의 타입 분석을 연결한다. 하지만 함수 구현이 틀려도 TypeScript가 진실을 확인해 주지는 못한다.

```ts
function isFish(value: Fish | Bird): value is Fish {
  return "fly" in value; // 논리가 잘못되었지만 타입 서술어를 믿을 수 있다.
}
```

따라서 타입 가드는 작은 단위로 작성하고 테스트해야 한다.

#### 3.8.8 판별 가능한 유니언

여러 상태를 모델링할 때 모든 타입에 공통 리터럴 프로퍼티를 두면 안전하게 구분할 수 있다.

```ts
type LoadingState = {
  status: "loading";
};

type SuccessState = {
  status: "success";
  data: string[];
};

type ErrorState = {
  status: "error";
  message: string;
};

type RequestState = LoadingState | SuccessState | ErrorState;
```

`status`는 각 타입을 구분하는 판별자다.

```ts
function renderState(state: RequestState): string {
  switch (state.status) {
    case "loading":
      return "불러오는 중...";
    case "success":
      return `${state.data.length}개의 데이터를 불러왔습니다.`;
    case "error":
      return `오류: ${state.message}`;
  }
}
```

`state.status === "success"`인 분기에서 TypeScript는 `state` 전체를 `SuccessState`로 좁힌다. 그래서 그 상태에만 있는 `data`를 안전하게 사용할 수 있다.

판별 가능한 유니언은 서로 동시에 성립하면 안 되는 상태를 막는 데 특히 유용하다.

```ts
// 좋지 않은 모델
type WeakState = {
  isLoading: boolean;
  data?: string[];
  error?: string;
};
```

이 모델은 `isLoading: true`이면서 `data`와 `error`가 모두 있는 모순된 객체도 허용한다. 판별 가능한 유니언은 허용되는 상태 조합 자체를 타입으로 표현한다.

#### 3.8.9 `never`와 완전성 검사

모든 유니언 멤버를 처리한 뒤에는 남은 타입이 `never`가 된다. `never`는 발생할 수 없는 값의 타입이다.

```ts
function assertNever(value: never): never {
  throw new Error(`처리하지 않은 상태: ${JSON.stringify(value)}`);
}

function renderState(state: RequestState): string {
  switch (state.status) {
    case "loading":
      return "불러오는 중...";
    case "success":
      return `${state.data.length}개`;
    case "error":
      return state.message;
    default:
      return assertNever(state);
  }
}
```

나중에 새로운 상태를 추가하고 `switch`에 분기를 추가하지 않으면 `state`가 `never`로 좁혀지지 않는다.

```ts
type EmptyState = {
  status: "empty";
};

type RequestState =
  | LoadingState
  | SuccessState
  | ErrorState
  | EmptyState;
```

이제 `assertNever(state)`에서 타입 오류가 발생하므로 빠진 분기를 찾을 수 있다. 상태가 늘어나는 애플리케이션에서 유용한 완전성 검사다.

---

### 3.9 타입 별칭과 인터페이스

같은 타입 구조를 반복해서 적으면 코드가 길어지고 의미가 흐려진다. 타입 별칭과 인터페이스를 이용하면 구조에 이름을 붙일 수 있다.

#### 3.9.1 타입 별칭

`type`은 모든 종류의 타입에 새 이름을 붙일 수 있다.

```ts
type Id = string | number;

type User = {
  id: Id;
  name: string;
  email?: string;
};
```

```ts
function findUser(id: Id): User | undefined {
  return users.find((user) => user.id === id);
}
```

타입 별칭은 새로운 런타임 값을 만드는 문법이 아니다. 기존 타입 표현에 읽기 좋은 이름을 붙인다.

```ts
type SanitizedString = string;

let value: SanitizedString = "safe";
value = "another string"; // 가능
```

`SanitizedString`이라고 이름을 붙였다고 일반 `string`과 완전히 다른 종류가 되는 것은 아니다.

#### 3.9.2 인터페이스

`interface`는 객체의 구조를 선언하는 데 사용한다.

```ts
interface User {
  id: string;
  name: string;
}

function greet(user: User): string {
  return `Hello, ${user.name}`;
}
```

TypeScript는 이름보다 구조를 비교한다.

```ts
const student = {
  id: "s-1",
  name: "Mina",
  grade: 3,
};

greet(student); // id와 name 구조를 만족하므로 가능
```

#### 3.9.3 `type`과 `interface`의 공통점과 차이

객체 구조를 표현하는 기본 상황에서는 둘 다 사용할 수 있다.

```ts
type UserByType = {
  id: string;
  name: string;
};

interface UserByInterface {
  id: string;
  name: string;
}
```

주요 차이는 다음과 같다.

| 구분 | `type` | `interface` |
|---|---|---|
| 객체 구조 표현 | 가능 | 가능 |
| 유니언 타입 이름 붙이기 | 가능 | 불가능 |
| 튜플·원시 타입 별칭 | 가능 | 불가능 |
| 확장 | 교차 타입 `&` 사용 | `extends` 사용 |
| 같은 이름의 선언 병합 | 불가능 | 가능 |

```ts
type WithId = {
  id: string;
};

type Admin = WithId & {
  permissions: string[];
};
```

```ts
interface WithName {
  name: string;
}

interface Member extends WithName {
  points: number;
}
```

인터페이스는 같은 이름으로 다시 선언하면 병합될 수 있다.

```ts
interface Settings {
  theme: "light" | "dark";
}

interface Settings {
  language: string;
}

const settings: Settings = {
  theme: "dark",
  language: "ko",
};
```

이 개방성은 라이브러리 타입을 확장할 때 유용하지만, 애플리케이션 내부에서 뜻하지 않은 병합을 만들 수도 있다. 팀의 규칙과 모델의 성격에 따라 선택한다.

실용적인 기준은 다음과 같다.

- 객체의 공개 계약을 표현하고 확장 가능성이 크면 `interface`
- 유니언, 교차, 튜플 등 다양한 타입 조합이면 `type`
- 특별한 이유가 없다면 프로젝트에서 정한 일관된 규칙을 따른다.

둘 중 하나가 언제나 더 우수한 것은 아니다. 타입의 의미가 잘 드러나는지가 더 중요하다.

---

### 3.10 리터럴 타입과 `as const`

`string`은 모든 문자열을 허용하지만, 리터럴 타입은 특정 문자열 하나만 허용한다.

```ts
let direction: "left" = "left";
direction = "right";
// Type '"right"' is not assignable to type '"left"'.
```

하나의 값만 허용하는 타입은 단독으로는 활용 범위가 좁지만, 유니언과 결합하면 선택 가능한 값을 정확히 표현할 수 있다.

```ts
type Direction = "left" | "right" | "up" | "down";

function move(direction: Direction): void {
  console.log(direction);
}

move("left");
move("center"); // 허용된 리터럴이 아니므로 오류
```

문자열뿐 아니라 숫자와 불리언도 리터럴 타입을 만들 수 있다.

```ts
type CompareResult = -1 | 0 | 1;
type Enabled = true;
```

#### 3.10.1 `let`과 `const`의 리터럴 추론

`let` 변수는 나중에 다른 값이 들어올 수 있으므로 넓은 타입으로 추론된다.

```ts
let method = "GET";
// method: string

method = "POST";
```

`const` 변수 자체는 다시 대입할 수 없으므로 더 구체적인 리터럴 타입으로 추론된다.

```ts
const method = "GET";
// method: "GET"
```

하지만 `const` 객체의 프로퍼티는 바꿀 수 있다.

```ts
const request = {
  url: "/users",
  method: "GET",
};

request.method = "POST"; // 가능
```

그래서 `request.method`는 `"GET"`이 아니라 `string`으로 추론된다. 함수가 `"GET" | "POST"`만 받는다면 문제가 생길 수 있다.

```ts
function send(method: "GET" | "POST"): void {
  console.log(method);
}

// send(request.method);
// string은 "GET" | "POST"보다 범위가 넓다.
```

#### 3.10.2 `as const`

객체 전체의 값을 리터럴로 유지하고 읽기 전용으로 추론하고 싶다면 `as const`를 사용할 수 있다.

```ts
const request = {
  url: "/users",
  method: "GET",
} as const;

send(request.method); // request.method는 "GET"
```

배열에도 적용할 수 있다.

```ts
const roles = ["admin", "member", "guest"] as const;
// readonly ["admin", "member", "guest"]
```

`as const`는 단순히 타입 이름을 바꾸는 것이 아니라 다음 효과를 함께 만든다.

- 문자열·숫자 값을 넓은 원시 타입이 아닌 리터럴 타입으로 유지한다.
- 객체 프로퍼티를 `readonly`로 추론한다.
- 배열을 읽기 전용 튜플로 추론한다.

> ⚠️ 주의: `as const`는 런타임에서 객체를 동결하는 `Object.freeze()`와 같지 않다. 타입 수준에서 수정을 막지만 JavaScript 실행 시 객체를 자동으로 얼리지는 않는다.

---

### 3.11 타입 단언

TypeScript보다 개발자가 값의 구체적인 타입을 더 잘 아는 경우 `as`로 타입을 단언할 수 있다.

```ts
const canvas = document.getElementById("main-canvas") as HTMLCanvasElement;
```

TypeScript는 ID만 보고 실제 HTML 요소 종류를 알 수 없다. 개발자는 문서 구조를 알고 있으므로 `HTMLCanvasElement`라고 단언한다.

그러나 타입 단언은 변환이나 검증이 아니다.

```ts
const value = "123" as unknown as number;
console.log(value + 1); // 런타임 결과는 "1231"
```

타입 단언으로 문자열이 숫자로 바뀌지 않는다. 결과 JavaScript에서 단언은 제거되고 원래 문자열이 그대로 남는다.

가능하면 검사나 안전한 변환을 먼저 사용한다.

```ts
const value = Number("123");

if (!Number.isNaN(value)) {
  console.log(value + 1); // 124
}
```

DOM에서도 요소가 정말 존재하는지 검사하는 편이 안전하다.

```ts
const element = document.getElementById("main-canvas");

if (element instanceof HTMLCanvasElement) {
  const context = element.getContext("2d");
  console.log(context);
}
```

타입 단언은 “검사기는 모르지만 개발자는 알고 있다”는 선언이다. 이 선언이 틀렸을 때 책임도 개발자에게 온다.

---

### 3.12 `null`, `undefined`, 엄격한 null 검사

JavaScript에서 값이 없음을 나타내는 대표적인 값은 `null`과 `undefined`다.

```ts
let notAssigned: undefined = undefined;
let intentionallyEmpty: null = null;
```

`strictNullChecks`가 활성화되면 두 값은 다른 타입에 자동으로 포함되지 않는다.

```ts
let name: string = "Mina";
// name = undefined;
// Type 'undefined' is not assignable to type 'string'.
```

값이 없을 수 있다면 타입에 직접 표현해야 한다.

```ts
let selectedName: string | null = null;
```

사용하기 전에 좁힌다.

```ts
function printSelectedName(name: string | null): void {
  if (name === null) {
    console.log("선택된 이름이 없습니다.");
    return;
  }

  console.log(name.toUpperCase());
}
```

공식 문서는 특별한 이유가 없다면 `strictNullChecks`를 활성화할 것을 권장한다. null 검사가 꺼져 있으면 값이 실제로 없을 가능성을 타입이 감추기 때문에 런타임 오류의 원인이 된다.

#### 3.12.1 null 아님 단언 연산자 `!`

표현식 뒤의 `!`는 값이 `null`이나 `undefined`가 아니라고 단언한다.

```ts
function printLength(value?: string): void {
  console.log(value!.length);
}
```

하지만 `!`도 런타임 검사를 추가하지 않는다.

```ts
printLength(); // 실행 시 오류가 발생할 수 있다.
```

가능하면 조건문, 옵셔널 체이닝, 기본값으로 처리한다.

```ts
function printLength(value?: string): void {
  console.log(value?.length ?? 0);
}
```

`!`는 프레임워크 생명주기나 이미 수행된 외부 검사 때문에 값의 존재가 확실하지만 TypeScript가 그 흐름을 알 수 없을 때 제한적으로 사용한다.

---

### 3.13 실전 예제: 외부 데이터를 안전한 상태로 바꾸기

지금까지 배운 개념을 API 응답 처리 흐름에 연결해 보자. 외부 데이터는 타입 표기만으로 안전해지지 않으므로 `unknown`에서 시작한다.

먼저 애플리케이션 내부에서 사용할 타입을 정의한다.

```ts
type User = {
  id: number;
  name: string;
  email?: string;
};
```

그다음 값이 객체인지 확인하는 작은 가드를 만든다.

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

`User` 구조를 검사한다.

```ts
function isUser(value: unknown): value is User {
  if (!isRecord(value)) {
    return false;
  }

  const hasRequiredFields =
    typeof value.id === "number" &&
    typeof value.name === "string";

  const hasValidEmail =
    value.email === undefined ||
    typeof value.email === "string";

  return hasRequiredFields && hasValidEmail;
}
```

검사 결과를 판별 가능한 유니언으로 반환한다.

```ts
type ParseResult =
  | {
      ok: true;
      data: User;
    }
  | {
      ok: false;
      message: string;
    };

function parseUser(value: unknown): ParseResult {
  if (isUser(value)) {
    return {
      ok: true,
      data: value,
    };
  }

  return {
    ok: false,
    message: "올바른 사용자 데이터가 아닙니다.",
  };
}
```

호출하는 쪽에서는 `ok`를 기준으로 결과를 좁힌다.

```ts
const rawData: unknown = JSON.parse(
  '{"id":1,"name":"Mina","email":"mina@example.com"}',
);

const result = parseUser(rawData);

if (result.ok) {
  console.log(result.data.name.toUpperCase());
} else {
  console.error(result.message);
}
```

전체 흐름을 정리하면 다음과 같다.

1. 외부 값은 신뢰하지 않고 `unknown`으로 받는다.
2. 런타임 검사로 객체와 각 프로퍼티의 타입을 확인한다.
3. 타입 가드로 검사 결과를 TypeScript에 전달한다.
4. 성공과 실패를 판별 가능한 유니언으로 표현한다.
5. 호출부는 판별 프로퍼티로 타입을 좁혀 안전하게 사용한다.

이 예제는 TypeScript가 잘하는 일과 하지 않는 일을 정확히 나눈다. 런타임 검사는 실제 데이터의 모양을 확인하고, TypeScript는 검사가 끝난 뒤 내부 코드에서 타입 약속이 유지되는지 추적한다.

---

## 4. 적용 관점에서 다시 보기

개별 문법보다 중요한 것은 실제 코드에서 어떤 순서로 타입을 설계하는가이다.

### 4.1 먼저 값의 출처를 구분한다

값이 프로그램 내부에서 만들어졌는지 외부에서 들어왔는지 확인한다.

- 코드 내부의 리터럴과 함수 반환값: TypeScript의 추론을 적극 활용한다.
- 함수의 매개변수와 공개 반환값: 타입으로 계약을 명확히 한다.
- API, 사용자 입력, 로컬 스토리지, JSON: `unknown`에서 시작해 런타임 검사를 한다.
- 임시 마이그레이션 코드: 불가피한 `any`의 범위를 최대한 좁힌다.

### 4.2 가능한 상태를 타입에 그대로 적는다

값이 없을 수 있다면 `string | null`, 요청이 성공하거나 실패할 수 있다면 판별 가능한 유니언으로 표현한다.

```ts
type LoginState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; user: User }
  | { status: "error"; message: string };
```

선택적인 값 여러 개로 상태를 흐리게 표현하지 말고, 실제로 허용할 조합을 각각의 유니언 멤버로 만든다.

### 4.3 조건문을 타입의 증거로 사용한다

유니언 타입에서 특정 멤버의 기능을 사용하려면 먼저 증거를 만든다.

- 원시 타입은 `typeof`
- 배열은 `Array.isArray()`
- 클래스 인스턴스는 `instanceof`
- 객체 프로퍼티 존재 여부는 `in`
- 상태 모델은 공통 리터럴 프로퍼티
- 복잡한 반복 검사는 사용자 정의 타입 가드

### 4.4 단언보다 모델과 검사를 고친다

타입 오류를 만났을 때 바로 `as`나 `!`를 붙이면 타입 검사기의 경고만 사라질 수 있다.

먼저 다음을 확인한다.

1. 값이 정말 그 타입인지 런타임에서 보장되는가?
2. 타입 정의가 실제 가능한 상태를 빠뜨렸는가?
3. 조건문으로 좁혀야 하는 값인가?
4. 함수의 반환 타입을 더 정확히 표현해야 하는가?
5. 외부 데이터 검증이 빠졌는가?

단언은 마지막 수단으로 사용하고, 사용한 위치에는 개발자가 가진 추가 정보가 무엇인지 설명할 수 있어야 한다.

### 4.5 프로젝트는 엄격한 설정으로 시작한다

새 프로젝트라면 `strict: true`를 기본으로 두는 것이 좋다. 초기에 엄격한 규칙을 적용하면 코드가 커진 뒤 수많은 암묵적 `any`와 null 가능성을 한꺼번에 정리하는 비용을 줄일 수 있다.

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmitOnError": true
  }
}
```

기존 JavaScript 프로젝트를 점진적으로 전환한다면 한 번에 모든 오류를 해결하기 어려울 수 있다. 이때도 `any`를 전체에 퍼뜨리기보다 파일이나 함수 경계부터 타입을 추가하고, `unknown`과 가드로 불확실한 부분을 격리한다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 글 이전에 몰랐던 것 또는 새로 이해된 것

TypeScript를 단순히 “JavaScript에 타입을 적는 문법”으로만 보면 타입 표기의 개수에 집중하기 쉽다. 하지만 더 중요한 것은 TypeScript가 코드의 **제어 흐름**을 따라 타입을 계속 계산한다는 점이다.

`string | number`라는 타입은 애매한 타입이 아니라 실제로 가능한 두 경우를 정확히 표현한 타입이다. 조건문에서 `typeof value === "string"`이라는 증거를 제공하면 TypeScript가 문자열 분기와 숫자 분기를 나누어 이해한다. 즉, 유니언과 좁히기는 서로 떨어진 기능이 아니라 하나의 문제 해결 과정이다.

또한 타입 표기와 런타임 검증은 역할이 다르다. `JSON.parse()` 결과에 `as User`를 붙이는 것은 데이터를 검사한 일이 아니다. 외부 데이터는 실제 값의 구조를 확인하고, 확인이 끝난 뒤 타입 시스템의 도움을 받아야 한다.

### 5.2 앞으로 이어지는 연결점

이번 글의 객체 타입과 함수 타입은 다음 학습의 기반이 된다.

- 함수 오버로드, 콜백 타입, 제네릭 함수
- `readonly`, 인덱스 시그니처, 객체 타입 확장
- 제네릭으로 입력과 출력 타입의 관계 표현
- `keyof`, `typeof`, 인덱스 접근 타입
- 조건부 타입과 매핑된 타입
- 클래스와 접근 제어자
- 모듈과 타입 전용 import/export
- Vue의 `defineProps`, React의 Props와 이벤트 타입

특히 제네릭은 단순히 “아무 타입이나 받는다”는 기능이 아니다. 여러 값의 타입 관계를 잃지 않고 표현한다. 이번 글에서 `any`가 타입 정보를 지워 버린다는 점을 이해했다면 제네릭이 왜 필요한지도 자연스럽게 연결된다.

### 5.3 더 파볼 만한 주제

- `void`, `never`, `unknown`의 정확한 차이
- 옵셔널 프로퍼티와 `undefined` 프로퍼티의 차이
- `satisfies` 연산자와 타입 단언의 차이
- `readonly`와 불변성의 차이
- 초과 프로퍼티 검사와 구조적 타이핑
- 런타임 스키마 검증 도구와 TypeScript 타입의 연결
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` 같은 추가 엄격 옵션
- 타입 가드 함수가 잘못 구현되었을 때 생기는 위험

---

## 6. 요약 정리

- 🧠 TypeScript는 JavaScript의 런타임 동작을 유지하면서 실행 전에 값의 잘못된 사용을 찾는 정적 타입 검사기다.
- 타입 표기, 타입 별칭, 인터페이스는 일반적으로 JavaScript 출력에서 제거된다.
- 초깃값과 문맥이 충분한 곳에서는 TypeScript가 타입을 추론하므로 모든 변수에 타입을 반복해서 적을 필요는 없다.
- `any`는 타입 검사를 끄고, `unknown`은 확인하기 전까지 값의 사용을 막는다.
- 함수의 매개변수 타입은 허용하는 입력의 계약이고, 반환 타입은 호출자에게 제공하는 결과의 계약이다.
- 객체 타입은 필요한 프로퍼티의 구조를 표현하며, `?`가 붙은 프로퍼티는 `undefined` 가능성을 확인해야 한다.
- 유니언 타입은 값의 여러 가능성을 표현하고, 멤버 전체에서 공통으로 안전한 작업만 바로 허용한다.
- `typeof`, `Array.isArray()`, `in`, `instanceof`, 타입 가드와 판별 프로퍼티로 타입을 좁힐 수 있다.
- 판별 가능한 유니언은 가능한 상태 조합을 정확히 모델링하고, `never`를 이용하면 빠진 분기를 검사할 수 있다.
- `type`은 모든 타입 표현에 이름을 붙일 수 있고, `interface`는 확장 가능한 객체 구조를 선언하는 데 적합하다.
- 리터럴 타입은 허용할 값을 구체적으로 제한하고, `as const`는 리터럴 정보와 읽기 전용 구조를 유지한다.
- `as`와 `!`는 런타임 검사를 추가하지 않는다. 단언보다 조건 검사와 정확한 타입 모델을 우선한다.
- API 응답과 사용자 입력 같은 외부 값은 `unknown`에서 시작해 런타임 검사를 거쳐야 한다.
- 새 프로젝트는 가능한 한 `strict: true`로 시작한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. TypeScript의 타입 정보가 결과 JavaScript에서도 자동으로 값을 검증하는가?
2. `const age = 20`에서 `: number`를 생략해도 되는 이유를 설명할 수 있는가?
3. `any`와 `unknown`의 가장 중요한 차이를 코드로 보여 줄 수 있는가?
4. `number[]`와 `[number]`의 차이를 설명할 수 있는가?
5. 옵셔널 프로퍼티를 읽기 전에 `undefined` 가능성을 확인해야 하는 이유를 설명할 수 있는가?
6. `string | number` 값에서 바로 `toUpperCase()`를 호출할 수 없는 이유를 설명할 수 있는가?
7. `typeof`, `in`, `instanceof`를 각각 어떤 상황에서 사용하는지 구분할 수 있는가?
8. 빈 문자열도 유효한 값일 때 진실성 검사가 적합하지 않을 수 있는 이유를 설명할 수 있는가?
9. 판별 가능한 유니언이 여러 개의 선택적 프로퍼티보다 상태를 안전하게 표현하는 이유를 설명할 수 있는가?
10. `type`만 표현할 수 있고 `interface`로는 직접 표현할 수 없는 타입의 예를 들 수 있는가?
11. `as const`가 런타임의 `Object.freeze()`와 같지 않은 이유를 설명할 수 있는가?
12. `as User`가 API 응답을 실제로 검증하지 않는 이유를 설명할 수 있는가?
13. `strictNullChecks`를 켰을 때 `string | null`을 어떻게 안전하게 사용하는지 작성할 수 있는가?
14. `never`를 이용해 `switch`문의 빠진 상태를 찾는 코드를 작성할 수 있는가?
15. 외부 JSON을 `unknown`으로 받은 뒤 안전한 내부 타입으로 바꾸는 순서를 설명할 수 있는가?

---

## 참고한 공식 문서

- [TypeScript Documentation](https://www.typescriptlang.org/ko/docs/)
- [TypeScript for the New Programmer](https://www.typescriptlang.org/ko/docs/handbook/typescript-from-scratch.html)
- [The Basics](https://www.typescriptlang.org/ko/docs/handbook/2/basic-types.html)
- [Everyday Types](https://www.typescriptlang.org/ko/docs/handbook/2/everyday-types.html)
- [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Download TypeScript](https://www.typescriptlang.org/ko/download/)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig/)
- [TypeScript Playground](https://www.typescriptlang.org/ko/play/)

> 문서 작성 기준일: 2026-07-24
> 범위 선정: TypeScript 공식 문서 전체 중 입문자가 다음 장의 함수·객체·제네릭을 학습하기 전에 먼저 이해해야 할 시작 가이드, The Basics, Everyday Types, Narrowing의 핵심 내용을 하나의 기초 학습 단위로 구성했다.
