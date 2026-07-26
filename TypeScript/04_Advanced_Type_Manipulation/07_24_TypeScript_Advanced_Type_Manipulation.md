# TypeScript 고급 타입 조작

- 🎯 글의 목표: 조건부 타입, `infer`, 매핑된 타입, 키 재매핑, 템플릿 리터럴 타입으로 기존 타입을 규칙에 따라 변환한다.
- 🧩 핵심 키워드: Conditional Type, Distributive Conditional Type, `infer`, Mapped Type, Mapping Modifier, Key Remapping, Template Literal Type, Utility Type
- ⭐ 중요도: ★★★★☆
- 📝 한눈에 보는 내용: 고급 타입 조작은 타입을 손으로 반복 작성하는 대신 입력 타입과 규칙에서 결과 타입을 계산한다. 조건부 타입은 타입 수준의 분기, 매핑된 타입은 키 순회, 템플릿 리터럴 타입은 문자열 조합을 담당한다.
- 🔗 관련 문제 / 주제: API 모델 변환, 폼 상태, 이벤트 이름, DTO, 라이브러리 타입, 유틸리티 타입

---

## 1. 들어가며

원본 모델과 수정 요청 모델을 따로 작성하면 프로퍼티가 늘 때 두 타입을 함께 고쳐야 한다.

```ts
interface User {
  id: number;
  name: string;
  email: string;
}

interface UserPatch {
  id?: number;
  name?: string;
  email?: string;
}
```

`UserPatch`는 `User`의 모든 키를 순회하면서 선택적으로 만든 결과라고 설명할 수 있다.

```ts
type Optional<T> = {
  [K in keyof T]?: T[K];
};

type UserPatch = Optional<User>;
```

이처럼 타입 조작은 복잡해 보이는 기호를 쓰는 일이 아니라 반복되는 타입 작성 규칙을 코드로 옮기는 일이다.

---

## 2. 핵심 개념 정리

고급 타입은 세 가지 질문으로 나눌 수 있다.

1. 입력 타입이 조건을 만족하는가? → 조건부 타입
2. 객체의 각 키를 어떻게 바꿀 것인가? → 매핑된 타입
3. 문자열 리터럴을 어떤 규칙으로 조합할 것인가? → 템플릿 리터럴 타입

```ts
type ElementType<T> = T extends (infer Item)[] ? Item : T;

type ReadonlyModel<T> = {
  readonly [K in keyof T]: T[K];
};

type EventName<K extends string> = `on${Capitalize<K>}`;
```

이 기능들은 `keyof`, 인덱스 접근 타입, 제네릭 위에서 동작한다.

---

## 3. 본문 정리

### 3.1 조건부 타입

조건부 타입은 다음 형태다.

```ts
T extends U ? X : Y
```

`T`가 `U`에 할당 가능하면 `X`, 아니면 `Y`를 선택한다.

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<"hello">; // true
type B = IsString<number>;  // false
```

실제 활용에서는 입력과 출력의 관계를 표현한다.

```ts
type MessageOf<T> =
  T extends { message: unknown }
    ? T["message"]
    : never;

type Email = {
  message: string;
};

type EmailMessage = MessageOf<Email>; // string
```

제약을 타입 매개변수 선언에 둘 수도 있다.

```ts
type StrictMessageOf<T extends { message: unknown }> = T["message"];
```

두 방식의 차이는 허용 범위다. 첫 방식은 어떤 타입이든 받고 맞지 않으면 `never`, 두 번째는 조건을 만족하지 않는 타입 인수 자체를 거부한다.

### 3.2 `infer`로 타입 일부 추출하기

조건부 타입 안에서 `infer`는 매칭된 타입의 일부에 이름을 붙인다.

```ts
type ArrayElement<T> =
  T extends Array<infer Item>
    ? Item
    : T;

type A = ArrayElement<string[]>; // string
type B = ArrayElement<number>;   // number
```

함수 반환 타입도 추출할 수 있다.

```ts
type MyReturnType<T> =
  T extends (...args: never[]) => infer Result
    ? Result
    : never;

type Result = MyReturnType<() => { id: number }>;
```

`infer`는 런타임 값을 만드는 문법이 아니다. 조건부 타입이 특정 구조와 맞을 때 그 자리에 들어온 타입을 캡처한다.

오버로드 함수에서는 마지막 시그니처를 기준으로 추론되는 점을 주의한다. 호출별 반환 타입을 정확히 얻는 도구로 오버로드 전체를 분석해 주지는 않는다.

### 3.3 분배 조건부 타입

조건부 타입의 왼쪽이 순수 타입 매개변수이고 유니언이 들어오면 각 멤버에 조건을 적용한다.

```ts
type ToArray<T> = T extends unknown ? T[] : never;

type Result = ToArray<string | number>;
// string[] | number[]
```

이는 `(string | number)[]`와 다르다.

분배를 막으려면 양쪽을 튜플로 감싼다.

```ts
type ToArrayNonDist<T> =
  [T] extends [unknown]
    ? T[]
    : never;

type Result = ToArrayNonDist<string | number>;
// (string | number)[]
```

유니언을 받는 조건부 타입을 작성할 때 분배가 의도인지 확인해야 한다.

### 3.4 매핑된 타입

매핑된 타입은 키 유니언을 순회해 프로퍼티를 만든다.

```ts
type Flags<T> = {
  [K in keyof T]: boolean;
};

interface Features {
  darkMode: () => void;
  notifications: () => void;
}

type FeatureFlags = Flags<Features>;
// { darkMode: boolean; notifications: boolean }
```

`K`는 각 키를, `T[K]`는 해당 키의 값 타입을 나타낸다.

### 3.5 매핑 변경자

`readonly`와 `?`를 추가하거나 제거할 수 있다.

```ts
type ReadonlyType<T> = {
  readonly [K in keyof T]: T[K];
};

type OptionalType<T> = {
  [K in keyof T]?: T[K];
};
```

`-`를 붙이면 제거한다.

```ts
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

type RequiredType<T> = {
  [K in keyof T]-?: T[K];
};
```

표준 유틸리티 타입 `Readonly<T>`, `Partial<T>`, `Required<T>`가 같은 목적을 제공한다. 원리를 학습한 뒤에는 표준 타입을 우선 사용한다.

### 3.6 키 재매핑

`as`를 사용하면 순회 중 새 키를 만들 수 있다.

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User {
  name: string;
  age: number;
}

type UserGetters = Getters<User>;
// getName(): string
// getAge(): number
```

`never`로 재매핑하면 키를 제거한다.

```ts
type RemoveId<T> = {
  [K in keyof T as K extends "id" ? never : K]: T[K];
};
```

표준 `Omit<T, K>`가 같은 일반 목적을 제공한다.

### 3.7 템플릿 리터럴 타입

문자열 리터럴 타입을 템플릿으로 조합한다.

```ts
type Field = "name" | "age";
type EventName = `${Field}Changed`;
// "nameChanged" | "ageChanged"
```

여러 유니언이 들어가면 가능한 조합의 곱이 만들어진다.

```ts
type Locale = "ko" | "en";
type Key = "title" | "description";
type MessageId = `${Locale}_${Key}`;
```

결과는 `"ko_title" | "ko_description" | "en_title" | "en_description"`이다.

큰 유니언은 타입 계산 비용과 가독성을 높일 수 있다. 매우 큰 문자열 집합은 빌드 단계에서 생성하거나 단순한 `string`과 런타임 검증을 선택할 수 있다.

### 3.8 내장 문자열 조작 타입

TypeScript는 문자열 리터럴을 바꾸는 타입을 제공한다.

```ts
type A = Uppercase<"hello">;    // "HELLO"
type B = Lowercase<"HELLO">;    // "hello"
type C = Capitalize<"user">;    // "User"
type D = Uncapitalize<"User">;  // "user"
```

이 기능은 타입 검사 중 컴파일러 내부에서 처리되며 JavaScript 함수를 실행하는 것이 아니다.

### 3.9 자주 쓰는 유틸리티 타입 연결하기

```ts
interface User {
  id: number;
  name: string;
  email: string;
}

type UserPatch = Partial<User>;
type PublicUser = Pick<User, "id" | "name">;
type UserWithoutEmail = Omit<User, "email">;
type UserMap = Record<string, User>;
```

- `Partial<T>`: 모든 프로퍼티 선택적
- `Required<T>`: 모든 프로퍼티 필수
- `Readonly<T>`: 모든 프로퍼티 읽기 전용
- `Pick<T, K>`: 선택한 키만 유지
- `Omit<T, K>`: 선택한 키 제거
- `Record<K, V>`: 키 집합과 값 타입으로 객체 생성
- `Exclude<U, M>`: 유니언에서 멤버 제거
- `Extract<U, M>`: 유니언에서 맞는 멤버 선택
- `NonNullable<T>`: `null | undefined` 제거
- `Parameters<F>`: 함수 매개변수 튜플
- `ReturnType<F>`: 함수 반환 타입

유틸리티 타입을 중첩할 때는 결과가 원래 도메인의 의미를 잘 드러내는지 확인한다.

### 3.10 실전 예제: 타입 안전한 이벤트 감시 객체

```ts
type Watched<T extends object> = T & {
  on<K extends string & keyof T>(
    eventName: `${K}Changed`,
    callback: (newValue: T[K]) => void,
  ): void;
};

declare function makeWatched<T extends object>(object: T): Watched<T>;

const user = makeWatched({
  name: "Mina",
  age: 20,
});

user.on("nameChanged", (newName) => {
  newName.toUpperCase();
});

user.on("ageChanged", (newAge) => {
  newAge.toFixed();
});
```

`eventName`에서 `K`를 추론하고, 콜백 값은 `T[K]`가 된다. 문자열 규칙과 실제 프로퍼티 타입이 하나의 계약으로 연결된다.

---

## 4. 적용 관점에서 다시 보기

고급 타입은 다음 순서로 설계하면 읽기 쉽다.

1. 입력 타입을 정한다.
2. 키를 순회할지, 조건을 나눌지 결정한다.
3. 추출해야 하는 타입 위치가 있으면 `infer`를 사용한다.
4. 유니언 분배가 의도인지 확인한다.
5. 이미 표준 유틸리티 타입이 있는지 찾는다.
6. 타입 이름으로 도메인 의미를 남긴다.

한 줄의 매우 영리한 타입보다 중간 타입 별칭으로 단계를 나눈 타입이 유지보수하기 쉽다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 점

매핑된 타입은 객체를 런타임에서 순회하지 않는다. `keyof`가 만든 키 유니언을 타입 공간에서 순회한다. 조건부 타입의 분배도 JavaScript 반복이 아니라 유니언 멤버별 타입 계산이다.

### 5.2 앞으로 이어지는 연결점

라이브러리 선언 파일과 프레임워크의 공개 타입은 이런 기능을 조합해 사용자 코드에서 정확한 자동 완성과 오류를 제공한다. 실제 애플리케이션에서는 복잡한 타입을 직접 많이 만드는 것보다 읽고 디버깅하는 능력이 먼저 필요하다.

### 5.3 더 파볼 만한 주제

- 재귀 조건부 타입
- 유니언을 교차 타입으로 변환하기
- 타입 계산 성능과 instantiation depth
- `Awaited<T>`
- `satisfies`와 타입 추론

---

## 6. 요약 정리

- 조건부 타입은 할당 가능성에 따라 타입을 선택한다.
- `infer`는 조건부 타입에서 구조 일부의 타입을 추출한다.
- 조건부 타입은 유니언에 분배될 수 있으며 튜플로 감싸 분배를 막는다.
- 매핑된 타입은 `keyof`가 만든 키를 순회한다.
- `+`와 `-` 변경자로 `readonly`와 선택성을 추가·제거한다.
- 키 재매핑에서 `never`를 만들면 해당 키가 제거된다.
- 템플릿 리터럴 타입은 문자열 리터럴 유니언을 조합한다.
- 일반적인 변환은 표준 유틸리티 타입을 우선 사용한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. `T extends U ? X : Y`를 설명할 수 있는가?
2. `infer`가 런타임 변수와 다른 이유는 무엇인가?
3. 분배 조건부 타입을 막는 방법은 무엇인가?
4. `[K in keyof T]`에서 `K`와 `T[K]`는 무엇인가?
5. 선택성을 제거하는 매핑 변경자를 쓸 수 있는가?
6. 키 재매핑에서 `never`의 역할은 무엇인가?
7. `Partial`, `Pick`, `Omit`의 차이를 설명할 수 있는가?

---

## 참고한 공식 문서

- [Conditional Types](https://www.typescriptlang.org/ko/docs/handbook/2/conditional-types.html)
- [Mapped Types](https://www.typescriptlang.org/ko/docs/handbook/2/mapped-types.html)
- [Template Literal Types](https://www.typescriptlang.org/ko/docs/handbook/2/template-literal-types.html)
- [Utility Types](https://www.typescriptlang.org/ko/docs/handbook/utility-types.html)

> 문서 작성 기준일: 2026-07-24
