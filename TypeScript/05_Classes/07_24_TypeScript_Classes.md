# TypeScript 클래스

- 🎯 글의 목표: JavaScript 클래스의 런타임 동작 위에 TypeScript가 추가하는 필드 타입, 접근 제어, 추상 클래스, 인터페이스 구현과 제네릭 클래스를 이해한다.
- 🧩 핵심 키워드: Class, Field, Constructor, `implements`, `extends`, `public`, `protected`, `private`, `readonly`, Static Member, Abstract Class, Generic Class, `this`
- ⭐ 중요도: ★★★★☆
- 📝 한눈에 보는 내용: TypeScript 클래스는 JavaScript 클래스의 실행 방식을 바꾸지 않으면서 인스턴스 구조와 사용 규칙을 검사한다. 클래스 선언은 런타임 생성자 값과 인스턴스 타입을 동시에 만들며, 접근 제한자는 주로 타입 검사 단계에서 경계를 표현한다.
- 🔗 관련 문제 / 주제: 서비스 객체, 도메인 모델, 상속, 의존성 주입, 생성자 타입, 객체지향 설계

---

## 1. 들어가며

클래스는 상태와 동작을 하나의 생성 규칙으로 묶는다.

```ts
class User {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  greet(): string {
    return `Hello, ${this.name}`;
  }
}
```

TypeScript는 `name`이 초기화되는지, 메서드가 올바른 타입을 반환하는지, 외부에서 어떤 멤버에 접근할 수 있는지 검사한다. 그러나 결과 JavaScript의 프로토타입과 생성자 동작은 JavaScript 규칙을 따른다.

---

## 2. 핵심 개념 정리

클래스 선언은 두 가지를 만든다.

1. `new User()`에 사용하는 런타임 생성자 값 `User`
2. 생성된 인스턴스의 구조를 나타내는 타입 `User`

```ts
const user: User = new User("Mina");
const Constructor: typeof User = User;
```

`User`는 타입 위치에서 인스턴스 타입, 값 위치에서 생성자다. 이 구분은 클래스를 함수에 전달할 때 중요하다.

상속은 구현과 상태를 재사용하고, `implements`는 클래스가 인터페이스 계약을 만족하는지만 검사한다. `implements`가 멤버를 자동 생성하거나 런타임 동작을 추가하지는 않는다.

---

## 3. 본문 정리

### 3.1 클래스 필드와 초기화

필드는 타입과 함께 선언할 수 있다.

```ts
class Product {
  name: string;
  price = 0;
}
```

`price`는 초깃값으로부터 `number`가 추론된다. `strictPropertyInitialization`이 켜져 있으면 필수 필드가 생성자에서 초기화되는지 검사한다.

```ts
class User {
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}
```

초기화가 프레임워크나 별도 메서드에서 확실히 일어나지만 TypeScript가 알 수 없을 때 확정 할당 단언 `!`를 쓸 수 있다.

```ts
class View {
  element!: HTMLElement;
}
```

`!`는 초기화를 수행하지 않으므로 실제 보장이 있을 때만 사용한다.

### 3.2 `readonly` 필드

`readonly` 필드는 선언 시점이나 생성자 안에서만 값을 정할 수 있다.

```ts
class Account {
  readonly id: number;

  constructor(id: number) {
    this.id = id;
  }
}
```

객체 타입의 `readonly`처럼 런타임 동결은 아니다. 타입 검사 경계를 나타낸다.

### 3.3 생성자와 매개변수 프로퍼티

생성자 매개변수에 접근 제한자나 `readonly`를 붙이면 필드 선언과 할당을 줄일 수 있다.

```ts
class User {
  constructor(
    public readonly id: number,
    public name: string,
  ) {}
}
```

이는 대략 `id`, `name` 필드를 선언하고 생성자에서 할당하는 것과 같다. 편리하지만 매개변수가 많아지면 객체 옵션이나 팩터리 함수가 더 읽기 좋을 수 있다.

클래스 생성자에는 타입 매개변수나 함수 오버로드와 같은 일부 규칙이 다르게 적용된다. 특히 파생 클래스에서는 `this`를 쓰기 전에 `super()`를 호출해야 한다.

### 3.4 메서드와 접근자

메서드의 매개변수와 반환 타입은 일반 함수처럼 작성한다.

```ts
class Counter {
  private value = 0;

  increment(amount = 1): number {
    this.value += amount;
    return this.value;
  }
}
```

getter와 setter로 읽기와 쓰기 규칙을 분리할 수 있다.

```ts
class Temperature {
  private _celsius = 0;

  get celsius(): number {
    return this._celsius;
  }

  set celsius(value: number) {
    if (value < -273.15) {
      throw new RangeError("절대 영도보다 낮을 수 없습니다.");
    }
    this._celsius = value;
  }
}
```

런타임 유효성 검사는 setter 구현이 담당하고, TypeScript는 전달 타입을 검사한다.

### 3.5 `implements`

클래스가 인터페이스 구조를 만족하는지 검사한다.

```ts
interface Serializable {
  serialize(): string;
}

class User implements Serializable {
  constructor(public name: string) {}

  serialize(): string {
    return JSON.stringify({ name: this.name });
  }
}
```

`implements`는 클래스 본문의 타입을 바꾸지 않는다.

```ts
interface Checkable {
  check(value: string): boolean;
}

class NameChecker implements Checkable {
  check(value: string): boolean {
    return value.length > 0;
  }
}
```

매개변수 타입을 생략하면 인터페이스에서 자동으로 문맥적 타입이 붙을 것이라고 기대하지 말고 명시한다.

### 3.6 상속과 메서드 재정의

`extends`는 기반 클래스의 구현을 상속한다.

```ts
class Animal {
  move(): string {
    return "이동합니다.";
  }
}

class Dog extends Animal {
  override move(): string {
    return "네 발로 달립니다.";
  }
}
```

재정의 메서드는 기반 메서드를 대체할 수 있어야 한다. 더 좁은 매개변수만 받도록 바꾸면 기반 타입으로 사용할 때 안전하지 않다.

`noImplicitOverride`를 켜면 재정의 시 `override` 표시를 요구해 오타나 기반 클래스 변경을 찾기 쉽다.

### 3.7 멤버 가시성

기본 접근 수준은 `public`이다.

```ts
class User {
  public name: string;
  protected role: string;
  private passwordHash: string;

  constructor(name: string, role: string, passwordHash: string) {
    this.name = name;
    this.role = role;
    this.passwordHash = passwordHash;
  }
}
```

- `public`: 어디서나 접근
- `protected`: 클래스와 파생 클래스에서 접근
- `private`: 선언한 클래스 내부에서 접근

TypeScript의 `private`는 일반적으로 타입 검사 수준의 제한이다. JavaScript의 `#privateField`는 런타임에서도 비공개다.

```ts
class Secret {
  #value: string;

  constructor(value: string) {
    this.#value = value;
  }
}
```

런타임 프라이버시가 필요하면 `#` 필드를 고려한다.

### 3.8 정적 멤버

`static` 멤버는 인스턴스가 아니라 클래스 자체에 속한다.

```ts
class IdGenerator {
  private static nextId = 1;

  static create(): number {
    return this.nextId++;
  }
}

IdGenerator.create();
```

정적 멤버는 `String`, `Function`, `name` 등 생성자 함수가 이미 가진 이름과 충돌할 수 있다. 또한 제네릭 클래스의 인스턴스 타입 매개변수를 정적 멤버에서 사용할 수 없다.

### 3.9 추상 클래스

추상 클래스는 직접 생성하지 않고 파생 클래스가 구현해야 할 공통 계약과 구현을 제공한다.

```ts
abstract class Shape {
  abstract area(): number;

  describe(): string {
    return `넓이: ${this.area()}`;
  }
}

class Circle extends Shape {
  constructor(private radius: number) {
    super();
  }

  area(): number {
    return Math.PI * this.radius ** 2;
  }
}
```

인터페이스는 구조 계약만 제공하고, 추상 클래스는 구현과 상태도 제공할 수 있다. 다중 구현 계약이 필요하면 인터페이스, 공통 구현과 수명 주기가 필요하면 추상 클래스를 검토한다.

### 3.10 제네릭 클래스

```ts
class Repository<T extends { id: number }> {
  private items = new Map<number, T>();

  save(item: T): void {
    this.items.set(item.id, item);
  }

  find(id: number): T | undefined {
    return this.items.get(id);
  }
}
```

제네릭은 저장소의 공통 동작을 유지하면서 실제 엔티티 타입을 보존한다.

### 3.11 클래스 타입 관계와 구조적 타이핑

TypeScript는 클래스도 주로 구조로 비교한다.

```ts
class Point {
  x = 0;
  y = 0;
}

const point: Point = { x: 10, y: 20 };
```

하지만 `private`이나 `protected` 멤버가 있으면 같은 선언에서 유래했는지도 호환성에 영향을 준다. 이 특성은 클래스 계층의 경계를 더 강하게 만든다.

### 3.12 클래스 표현식과 생성자 타입

클래스도 값이므로 표현식으로 만들고 전달할 수 있다.

```ts
type Named = { name: string };
type NamedConstructor = new (name: string) => Named;

function make(
  Constructor: NamedConstructor,
  name: string,
): Named {
  return new Constructor(name);
}
```

인스턴스 타입 `Named`와 생성자 타입 `new (...) => Named`를 구분해야 한다.

---

## 4. 적용 관점에서 다시 보기

클래스를 선택하기 전에 객체 리터럴과 함수 조합으로 충분한지 확인한다. 클래스는 다음 상황에서 강점이 있다.

- 동일한 초기화 규칙으로 여러 인스턴스를 만든다.
- 상태와 그 상태를 다루는 메서드가 강하게 결합된다.
- 런타임 `instanceof` 구분이 필요하다.
- 상속하거나 추상 기반 구현을 공유한다.

단순 API 응답이나 설정 객체는 인터페이스와 함수가 더 가벼운 경우가 많다. `private`를 붙였다는 이유만으로 런타임 보안 경계가 생기는 것도 아니다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 점

클래스 이름은 값과 타입 두 공간에 동시에 존재한다. `new User()`의 `User`는 값이고 `const user: User`의 `User`는 인스턴스 타입이다. 클래스를 인수로 받을 때 생성자 시그니처가 필요한 이유가 여기 있다.

### 5.2 앞으로 이어지는 연결점

클래스를 다른 파일로 나누면 모듈과 타입 전용 import가 필요하다. 라이브러리의 클래스 타입을 기술할 때 선언 파일, 생성자 시그니처, 접근 제어 규칙이 연결된다.

### 5.3 더 파볼 만한 주제

- 믹스인
- 데코레이터
- `abstract new` 생성자 타입
- `useDefineForClassFields`
- 상속보다 합성을 선택하는 기준

---

## 6. 요약 정리

- 클래스 선언은 런타임 생성자 값과 인스턴스 타입을 함께 만든다.
- 엄격한 필드 초기화는 생성 시 필수 상태가 준비되는지 검사한다.
- `implements`는 구조를 검사하지만 구현을 추가하지 않는다.
- `override`는 기반 메서드 재정의 의도를 나타낸다.
- `private`와 `protected`는 주로 타입 수준 경계이며 `#field`는 런타임 비공개다.
- 정적 멤버는 클래스 자체에 속한다.
- 추상 클래스는 공통 구현과 미완성 계약을 함께 제공한다.
- 클래스도 구조적으로 비교되지만 비공개 멤버는 호환성에 영향을 준다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 클래스 이름이 값과 타입으로 각각 무엇을 의미하는가?
2. 확정 할당 단언 `!`가 실제 초기화를 수행하는가?
3. `implements`가 메서드 타입을 자동 추론해 주는가?
4. `private`와 `#private`의 차이는 무엇인가?
5. 정적 멤버에서 클래스 타입 매개변수를 사용할 수 없는 이유는 무엇인가?
6. 인터페이스와 추상 클래스의 선택 기준은 무엇인가?
7. 인스턴스 타입과 생성자 타입을 구분할 수 있는가?

---

## 참고한 공식 문서

- [Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)

> 문서 작성 기준일: 2026-07-24
