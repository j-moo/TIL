# Python OOP 2: 상속과 예외 처리

- 🎯 글의 목표: 클래스 상속으로 공통 코드를 재사용하고, 오버라이딩·다중 상속·MRO·`super()`의 동작을 이해한 뒤, 오류를 분석하고 `try-except-else-finally`로 예외를 안전하게 처리한다.
- 🧩 핵심 키워드: 상속, 부모 클래스, 자식 클래스, 메서드 오버라이딩, 다중 상속, 다이아몬드 문제, MRO, `super()`, 디버깅, 문법 오류, 예외, 내장 예외, `try`, `except`, `else`, `finally`, EAFP, LBYL
- ⭐ 중요도: 매우 높음
- 📝 한눈에 보는 내용: 이번 강의는 교수와 학생처럼 공통점은 공유하지만 세부 특징은 다른 대상을 클래스 계층으로 표현하는 방법에서 시작한다. 이어서 다중 상속에서 메서드를 찾는 순서와 `super()`의 의미를 살펴보고, 프로그램의 예상 동작과 실제 동작이 어긋났을 때 원인을 찾는 디버깅과 예외 처리까지 연결한다.
- 🔗 관련 문제 / 주제: 클래스 설계, 코드 중복 제거, 생성자 재사용, 다중 상속 분석, 입력값 검증, 파일·네트워크 작업의 실패 처리

---

## 1. 들어가며

교수와 학생은 모두 이름과 나이가 있고, 자기소개를 할 수 있다. 그러나 교수에게는 소속 학과가 필요하고 학생에게는 학점이 필요하다. 두 대상을 전혀 별개의 클래스로 만들면 공통 속성과 메서드가 반복되고, 하나의 `Person` 클래스만 사용하면 각 대상의 고유한 특징을 충분히 표현하기 어렵다.

상속은 이 문제를 **공통 부분과 달라지는 부분으로 나누어 해결하는 방법**이다. 사람에게 공통인 코드는 부모 클래스에 한 번만 두고, 교수와 학생은 그 코드를 물려받은 뒤 자신에게 필요한 속성이나 동작만 추가한다. 이 구조를 사용하면 중복을 줄이면서도 기존 클래스를 수정하지 않고 기능을 확장할 수 있다.

프로그램의 구조를 잘 만드는 것만으로 모든 문제가 끝나지는 않는다. 올바르게 작성한 프로그램도 잘못된 사용자 입력, 없는 파일, 범위를 벗어난 인덱스처럼 실행 중에 예상하지 못한 상황을 만날 수 있다. 이때 오류의 원인을 찾는 과정이 디버깅이고, 발생 가능한 예외를 예상해 프로그램이 적절히 대응하도록 만드는 것이 예외 처리다.

이번 강의는 다음 흐름으로 이어진다.

1. 상속으로 클래스의 공통 코드와 고유 코드를 분리한다.
2. 오버라이딩으로 물려받은 동작을 자식 클래스에 맞게 바꾼다.
3. 다중 상속의 모호함을 MRO로 해결한다.
4. `super()`로 MRO의 다음 클래스에 구현을 위임한다.
5. 디버깅으로 오류가 생긴 위치와 원인을 좁힌다.
6. 내장 예외와 예외 처리 구문으로 실패 상황에 대응한다.

---

## 2. 핵심 개념 정리

이번 강의가 해결하려는 질문은 크게 두 가지다.

> 비슷한 객체들의 공통점은 재사용하면서 차이점은 어떻게 확장할까?

> 실행 중 문제가 생겨도 원인을 파악하고 프로그램의 흐름을 어떻게 안전하게 유지할까?

첫 번째 질문은 상속에서 출발한다. 단일 상속으로 부모의 속성과 메서드를 재사용하고, 오버라이딩으로 자식에게 필요한 동작을 다시 정의한다. 부모가 둘 이상인 다중 상속에서는 같은 이름의 메서드를 어느 클래스에서 찾을지가 중요해지므로 MRO를 확인해야 한다. `super()`도 단순히 “부모를 호출하는 문법”으로 외우지 않고, MRO에서 현재 클래스 다음에 있는 구현으로 작업을 넘기는 도구로 이해해야 한다.

두 번째 질문은 오류의 종류를 구분하는 데서 시작한다. 실행 전에 발견되는 문법 오류와 실행 중 발생하는 예외는 해결 방식이 다르다. 예외가 발생할 수 있는 코드를 `try`에 두고, 구체적인 예외부터 `except`로 처리한다. 성공했을 때만 할 작업은 `else`, 성공 여부와 관계없이 정리해야 할 작업은 `finally`에 둔다.

마지막으로 EAFP와 LBYL을 비교한다. 먼저 실행하고 실패를 예외로 처리할 수도 있고, 실행 전에 조건을 검사할 수도 있다. 어느 한 방식만 정답이라기보다, 실제 작업과 예외의 성격을 보고 더 명확하고 안전한 쪽을 선택하는 것이 핵심이다.

---

## 3. 본문 정리

### 3.1 상속: 공통 코드를 물려주는 클래스 관계

상속은 한 클래스의 속성과 메서드를 다른 클래스가 물려받는 기능이다. 물려주는 클래스를 **부모 클래스**, 물려받는 클래스를 **자식 클래스**라고 한다.

상속이 필요한 첫 번째 이유는 코드 재사용이다. 공통 기능을 부모에 한 번 작성하면 여러 자식이 그대로 사용할 수 있다. 두 번째 이유는 계층 구조다. `Animal`과 `Dog`처럼 일반적인 개념에서 구체적인 개념으로 관계를 표현할 수 있다. 세 번째 이유는 유지보수다. 공통 로직을 바꿀 때 부모 클래스 한 곳을 수정하면 그 기능을 물려받는 자식에도 반영된다.

게임 캐릭터를 예로 들면 모든 캐릭터는 돈과 레벨을 가지며 공격·방어·이동을 할 수 있다. 이 공통 부분은 `Character`에 두고, 전사에게는 힘을, 마법사에게는 마력을 추가할 수 있다. 상속은 단순히 코드를 복사하는 기능이 아니라, **공통 개념에서 구체적인 개념으로 확장하는 설계 도구**다.

가장 기본적인 문법은 자식 클래스 이름 뒤의 괄호에 부모 클래스 이름을 적는 것이다.

```python
class Animal:
    def eat(self):
        # 모든 동물에게 공통인 행동이다.
        print('먹는 중')


class Dog(Animal):
    # 괄호 안에 Animal을 적어 부모 클래스로 지정한다.
    def bark(self):
        # 개에게만 필요한 행동을 추가한다.
        print('멍멍')


my_dog = Dog()

# Dog가 직접 정의한 메서드다.
my_dog.bark()

# Dog에 없지만 부모 Animal에서 물려받은 메서드다.
my_dog.eat()
```

실행 결과는 다음과 같다.

```text
멍멍
먹는 중
```

`my_dog.eat()`을 호출하면 파이썬은 먼저 `Dog`에서 `eat`을 찾는다. 찾지 못하면 부모인 `Animal`로 올라가 메서드를 찾고 실행한다.

⚠️ 주의: 자식 클래스를 정의할 때 `class Dog:`라고만 쓰면 `Animal`을 상속하지 않는다. 부모 기능을 물려받으려면 `class Dog(Animal):`처럼 부모 이름을 명시해야 한다.

---

### 3.2 상속이 없을 때 생기는 중복과 표현의 한계

학생과 교수를 하나의 `Person` 클래스로만 만들면 이름과 나이, 자기소개는 표현할 수 있다. 그러나 학생의 학점과 교수의 소속 학과처럼 서로 다른 정보를 자연스럽게 담기 어렵다.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def talk(self):
        print(f'반갑습니다. {self.name}입니다.')


student = Person('김학생', 23)
professor = Person('박교수', 59)

student.talk()
professor.talk()
```

실행 결과만 보면 문제가 없어 보인다.

```text
반갑습니다. 김학생입니다.
반갑습니다. 박교수입니다.
```

하지만 두 객체가 학생인지 교수인지, 각각 학점과 학과가 무엇인지는 알 수 없다. 반대로 `Student`와 `Professor`를 완전히 별도로 정의하면 `name`, `age`, `talk()`가 반복된다.

```python
class Professor:
    def __init__(self, name, age, department):
        self.name = name
        self.age = age
        self.department = department

    def talk(self):
        # Student에도 같은 코드가 필요해 중복된다.
        print(f'반갑습니다. {self.name}입니다.')


class Student:
    def __init__(self, name, age, gpa):
        self.name = name
        self.age = age
        self.gpa = gpa

    def talk(self):
        # Professor의 talk와 동작이 같다.
        print(f'반갑습니다. {self.name}입니다.')
```

공통 부분을 `Person`에 두고 두 클래스가 상속하게 만들면 중복과 표현력 문제를 함께 해결할 수 있다.

```python
class Person:
    def __init__(self, name, age):
        # 모든 사람에게 공통인 속성이다.
        self.name = name
        self.age = age

    def talk(self):
        # 모든 사람이 공유할 수 있는 메서드다.
        print(f'반갑습니다. {self.name}입니다.')


class Professor(Person):
    def __init__(self, name, age, department):
        # 현재 단계에서는 공통 속성도 직접 초기화한다.
        # 뒤에서 super()로 이 중복까지 제거한다.
        self.name = name
        self.age = age
        self.department = department


class Student(Person):
    def __init__(self, name, age, gpa):
        self.name = name
        self.age = age
        self.gpa = gpa


professor = Professor('박교수', 49, '컴퓨터공학과')
student = Student('김학생', 20, 3.5)

# 두 클래스 모두 Person의 talk를 재사용한다.
professor.talk()
student.talk()
```

```text
반갑습니다. 박교수입니다.
반갑습니다. 김학생입니다.
```

📌 핵심: 상속은 모든 코드를 부모로 몰아넣는 기능이 아니다. **여러 자식이 공유하는 부분은 부모에 두고, 각 자식만의 차이는 자식에 둔다.**

---

### 3.3 메서드 오버라이딩: 물려받은 동작을 자식에 맞게 바꾸기

메서드 오버라이딩은 부모 클래스에 있는 메서드를 자식 클래스에서 같은 이름으로 다시 정의하는 것이다. 자식 객체로 메서드를 호출하면 부모 버전 대신 자식 버전이 실행된다.

상속으로 공통 기능을 재사용하더라도 모든 자식이 완전히 같은 방식으로 행동하지는 않는다. 동물은 모두 먹지만 개가 먹는 모습을 더 구체적으로 표현하고 싶다면 `Dog`에서 `eat()`을 다시 정의할 수 있다.

```python
class Animal:
    def eat(self):
        print('Animal이 먹는 중')


class Dog(Animal):
    # 부모와 같은 메서드 이름으로 새 동작을 정의한다.
    def eat(self):
        print('Dog가 먹는 중')


my_dog = Dog()
my_dog.eat()
```

```text
Dog가 먹는 중
```

파이썬은 `Dog`에서 먼저 `eat`을 찾으므로 `Animal.eat()`까지 올라가지 않는다. 부모의 기능을 버리지 않고 앞뒤에 동작을 추가하고 싶다면 뒤에서 배우는 `super()`로 부모 구현을 호출할 수 있다.

⚠️ 주의: 오버라이딩할 때 이름을 다르게 쓰면 새 메서드를 추가한 것이지 재정의한 것이 아니다. 매개변수 구조도 호출 방식과 호환되게 유지해야 한다. 그렇지 않으면 부모 타입으로 기대하던 호출이 자식 객체에서 실패할 수 있다.

---

### 3.4 오버라이딩과 오버로딩의 차이

오버라이딩과 이름이 비슷한 개념으로 오버로딩이 있다. 오버로딩은 같은 이름을 가지되 매개변수 구성이 다른 메서드를 여러 개 정의하는 기능이다. 그러나 파이썬은 Java나 C++처럼 메서드 시그니처에 따른 오버로딩을 기본 지원하지 않는다.

파이썬 클래스 본문에서 같은 이름을 두 번 정의하면 나중 정의가 앞의 정의를 덮어쓴다.

```python
class Example:
    def do_something(self, x):
        print('첫 번째 메서드:', x)

    # 이름이 같으므로 위 정의를 대체한다.
    def do_something(self, x, y):
        print('두 번째 메서드:', x, y)


example = Example()

# 현재 남아 있는 메서드는 인자 두 개를 요구한다.
example.do_something(1)
```

실행하면 다음과 같은 `TypeError`가 발생한다.

```text
TypeError: Example.do_something() missing 1 required positional argument: 'y'
```

인자 개수에 따라 다른 동작이 필요하다면 기본 인자, 가변 인자, 또는 함수 안의 조건 분기를 사용할 수 있다.

```python
class Example:
    def do_something(self, x, y=None):
        # y가 전달되었는지에 따라 한 메서드 안에서 분기한다.
        if y is None:
            print('인자 한 개:', x)
        else:
            print('인자 두 개:', x, y)
```

---

### 3.5 다중 상속: 둘 이상의 부모에게 물려받기

다중 상속은 하나의 자식 클래스가 둘 이상의 부모 클래스를 상속하는 구조다. 자식은 모든 부모가 제공하는 속성과 메서드를 사용할 수 있다.

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greeting(self):
        return f'안녕, {self.name}'


class Mom(Person):
    gene = 'XX'

    def swim(self):
        return '엄마가 수영'


class Dad(Person):
    gene = 'XY'

    def walk(self):
        return '아빠가 걷기'


class FirstChild(Dad, Mom):
    # 부모에게 받은 swim을 자식에 맞게 오버라이딩한다.
    def swim(self):
        return '첫째가 수영'

    def cry(self):
        return '첫째가 응애'


baby = FirstChild('아가')

print(baby.cry())
print(baby.swim())
print(baby.walk())
print(baby.gene)
```

```text
첫째가 응애
첫째가 수영
아빠가 걷기
XY
```

`cry()`와 오버라이딩한 `swim()`은 `FirstChild`에서 찾는다. `walk()`는 첫 번째 부모 `Dad`에서 찾는다. `gene`은 `Dad`와 `Mom`에 모두 있지만 부모 목록이 `(Dad, Mom)` 순서이므로 `Dad.gene`이 선택된다.

⚠️ 주의: “왼쪽 부모가 항상 모든 상황에서 이긴다”라고만 외우면 복잡한 계층에서 틀릴 수 있다. 실제 탐색은 파이썬이 계산한 MRO 전체 순서를 따른다.

---

### 3.6 다이아몬드 문제와 MRO

다중 상속에서는 두 부모가 같은 조상에서 파생되는 다이아몬드 구조가 만들어질 수 있다.

```text
    A
   / \
  B   C
   \ /
    D
```

`B`와 `C`가 모두 `A`를 상속하고, `D`가 `B`와 `C`를 상속한다고 하자. 같은 이름의 메서드가 여러 클래스에 있다면 `D`는 어느 버전을 사용해야 하는지 결정해야 한다. 이 모호함을 다이아몬드 문제라고 한다.

파이썬은 **MRO(Method Resolution Order, 메서드 결정 순서)**를 이용해 탐색 순서를 미리 정한다. C3 선형화 알고리즘으로 계산되며 초심자 관점에서는 다음 원칙을 잡으면 된다.

1. 부모보다 자식을 먼저 탐색한다.
2. 다중 상속 목록에서 왼쪽에 적힌 부모를 우선한다.
3. 공통 조상은 중복 방문하지 않고 적절한 마지막 위치에서 한 번만 탐색한다.

```python
class A:
    pass


class B(A):
    pass


class C(A):
    pass


class D(B, C):
    pass


# 리스트 형태로 MRO를 확인한다.
print(D.mro())

# 같은 내용을 튜플 형태의 클래스 속성으로 확인한다.
print(D.__mro__)
```

핵심 순서는 다음과 같다.

```text
D → B → C → A → object
```

`D`에서 시작해 첫 부모 `B`를 확인한 뒤, `B`의 부모 `A`로 곧장 가지 않고 형제 경로인 `C`를 먼저 확인한다. 공통 부모 `A`는 `B`와 `C` 뒤에 한 번만 나타난다. 모든 파이썬 클래스의 최종 조상인 `object`가 마지막에 온다.

📌 핵심: 복잡한 다중 상속의 순서를 머리로 추측하지 말고 `ClassName.mro()` 또는 `ClassName.__mro__`로 확인한다.

---

### 3.7 `super()`: MRO의 다음 구현으로 작업 넘기기

`super()`는 현재 클래스의 MRO에서 **다음 클래스**에 있는 메서드나 속성에 접근하도록 돕는 내장 함수다. 단일 상속에서는 보통 부모 메서드를 호출하는 모습으로 보이지만, 다중 상속에서는 단순한 “직계 부모 호출”보다 MRO를 따르는 협력 호출이라는 의미가 더 정확하다.

먼저 단일 상속에서 생성자의 중복을 줄여 보자.

```python
class Person:
    def __init__(self, name, age, number, email):
        # 모든 사람에게 공통인 초기화다.
        self.name = name
        self.age = age
        self.number = number
        self.email = email


class Student(Person):
    def __init__(self, name, age, number, email, student_id):
        # Person.__init__을 직접 적는 대신 MRO의 다음 구현을 호출한다.
        super().__init__(name, age, number, email)

        # 학생에게만 필요한 속성을 추가한다.
        self.student_id = student_id


student = Student(
    name='김학생',
    age=20,
    number='010-1234-5678',
    email='student@example.com',
    student_id='S001',
)

print(student.name)
print(student.student_id)
```

```text
김학생
S001
```

`Student`의 생성자는 공통 속성 초기화를 `Person`에 맡기고 `student_id`만 직접 처리한다. 부모 클래스 이름을 코드에 고정하지 않으므로 클래스 이름이나 상속 구조가 바뀔 때 수정 범위도 줄어든다.

⚠️ 주의: `super().__init__(...)`에 전달할 때는 `self`를 직접 넣지 않는다. `super()`가 반환한 바인딩된 메서드가 현재 객체를 자동으로 전달한다.

---

### 3.8 다중 상속에서 `super()`가 호출되는 방식

다중 상속에서 `super()`는 첫 번째 부모만 자동으로 모두 실행해 주는 마법이 아니다. 현재 MRO의 다음 클래스 메서드 하나를 호출한다. 여러 클래스의 초기화를 연쇄적으로 실행하려면 각 클래스가 협력적으로 `super()`를 호출해야 한다.

먼저 첫 부모만 `super()`를 호출하는 예시를 보자.

```python
class ParentA:
    def __init__(self):
        self.value_a = 'ParentA'

    def show_value(self):
        print(f'Value from ParentA: {self.value_a}')


class ParentB:
    def __init__(self):
        self.value_b = 'ParentB'

    def show_value(self):
        print(f'Value from ParentB: {self.value_b}')


class Child(ParentA, ParentB):
    def __init__(self):
        # Child 다음인 ParentA.__init__만 호출된다.
        super().__init__()
        self.value_c = 'Child'

    def show_value(self):
        # Child 다음 순서에서 처음 발견되는 ParentA.show_value를 호출한다.
        super().show_value()
        print(f'Value from Child: {self.value_c}')


child = Child()
child.show_value()

print(child.value_c)
print(child.value_a)
```

```text
Value from ParentA: ParentA
Value from Child: Child
Child
ParentA
```

이 코드에서는 `ParentA.__init__()` 안에 다음 `super()` 호출이 없으므로 `ParentB.__init__()`은 실행되지 않는다. 따라서 `child.value_b`에 접근하면 `AttributeError`가 발생한다.

모든 클래스가 협력적으로 호출하면 MRO를 따라 초기화가 이어진다.

```python
class A:
    def __init__(self):
        # A 다음인 object.__init__까지 호출한다.
        super().__init__()
        print('A Constructor')


class B(A):
    def __init__(self):
        # D의 MRO에서 B 다음은 C다.
        super().__init__()
        print('B Constructor')


class C(A):
    def __init__(self):
        # D의 MRO에서 C 다음은 A다.
        super().__init__()
        print('C Constructor')


class D(B, C):
    def __init__(self):
        # D 다음인 B부터 연쇄 호출이 시작된다.
        super().__init__()
        print('D Constructor')


print(D.mro())
D()
```

MRO는 `D → B → C → A → object`이고, 생성자 출력은 가장 깊이 호출된 곳에서 돌아오며 나타난다.

```text
A Constructor
C Constructor
B Constructor
D Constructor
```

⚠️ 주의: 다중 상속에서 클래스 이름을 직접 적어 부모 생성자를 각각 호출하면 공통 조상이 중복 초기화될 수 있다. 협력적 다중 상속을 설계할 때는 각 클래스가 호환되는 매개변수 구조로 `super()`를 일관되게 사용해야 한다.

---

### 3.9 버그와 디버깅

버그는 소프트웨어의 예상 동작과 실제 동작 사이에 생긴 불일치다. 디버깅은 버그가 생긴 정확한 위치와 원인을 찾고 수정하는 과정이다.

‘버그’라는 용어는 컴퓨터 이전부터 결함을 가리키는 말로 쓰였다. 컴퓨터 역사에서 널리 알려진 사례는 1947년 Harvard Mark II의 릴레이에 나방이 끼어 오작동한 기록이다. 이 사건은 컴퓨터 시스템의 오류를 버그라고 부르는 표현을 유명하게 만들었다.

디버깅에서 중요한 것은 코드를 한꺼번에 바라보며 추측하는 것이 아니라, 실행 흐름을 작은 구간으로 나누어 상태를 확인하는 것이다.

```python
numbers = [10, 20, 30]
total = 0

for index, number in enumerate(numbers):
    # 반복마다 어떤 값을 더하는지 관찰한다.
    print(f'[debug] index={index}, number={number}, before={total}')

    total += number

    # 변경 후 누적값도 확인한다.
    print(f'[debug] after={total}')

print('합계:', total)
```

디버깅 방법은 다음처럼 단계적으로 선택할 수 있다.

1. `print()`로 함수의 입력·출력, 조건 결과, 반복 상태를 확인한다.
2. 문제 구간을 절반씩 좁혀 어느 영역에서 결과가 달라지는지 확인한다.
3. IDE의 중단점과 단계 실행, 변수 조회 기능을 사용한다.
4. 짧고 단순한 코드는 Python Tutor로 실행 상태를 시각화한다.
5. 코드가 문법적으로 실행되는지, 변수 값과 제어 흐름이 의도와 같은지 차례로 검사한다.

⚠️ 주의: 디버깅용 출력은 값만 찍기보다 변수 이름과 실행 위치를 함께 남겨야 한다. `print(total)`만 반복하면 어느 시점의 값인지 구분하기 어렵다.

---

### 3.10 문법 오류와 예외 구분하기

파이썬의 오류는 크게 문법 오류와 예외로 나누어 볼 수 있다.

| 구분 | 발생 시점 | 의미 | 대표 예시 |
|---|---|---|---|
| 문법 오류 `SyntaxError` | 코드 실행 전 구문을 해석할 때 | 파이썬 문법에 맞지 않아 실행을 시작할 수 없음 | 콜론·괄호·따옴표 누락 |
| 예외 `Exception` | 올바른 문법의 코드를 실행하는 중 | 특정 연산을 현재 값이나 상태로 수행할 수 없음 | 0으로 나누기, 없는 키 조회 |

다음 코드는 `while` 뒤에 조건과 콜론이 없으므로 문법 오류다.

```python
# 실행할 수 없는 코드다.
while
```

리터럴 값에 대입하려 해도 문법 오류가 발생한다.

```python
# 값 5는 변수 이름이 아니므로 대입할 수 없다.
5 = number
```

문자열의 닫는 따옴표를 빠뜨리는 실수도 자주 발생한다.

```python
# SyntaxError: unterminated string literal
print('hello)
```

반면 아래 코드는 문법상 올바르지만 실행 중 0으로 나누려 하므로 예외가 발생한다.

```python
result = 10 / 0
```

```text
ZeroDivisionError: division by zero
```

⚠️ 주의: 문법 오류는 코드가 실행되기 전에 발견되므로 일반적인 `try-except`로 둘러싸 해결하는 대상이 아니다. 에디터의 밑줄과 구문 강조를 활용하고, 괄호·따옴표·콜론·들여쓰기를 먼저 확인한다.

---

### 3.11 자주 만나는 내장 예외

내장 예외는 파이썬이 미리 정의한 예외 클래스다. 예외의 이름은 단순한 메시지가 아니라 어떤 종류의 실패가 발생했는지 나타낸다. 종류를 알면 원인과 처리 방법을 더 빠르게 결정할 수 있다.

#### `ZeroDivisionError`

나눗셈이나 나머지 연산의 두 번째 피연산자가 0일 때 발생한다.

```python
print(10 / 0)
```

```text
ZeroDivisionError: division by zero
```

#### `NameError`

현재 지역 또는 전역 범위에서 이름을 찾을 수 없을 때 발생한다.

```python
# name을 선언한 적이 없다.
print(name)
```

```text
NameError: name 'name' is not defined
```

#### `TypeError`

연산 대상의 타입이 맞지 않거나 함수 인자의 개수·형태가 맞지 않을 때 발생한다.

```python
# 문자열과 정수는 +로 바로 연결할 수 없다.
print('age: ' + 20)
```

```text
TypeError: can only concatenate str (not "int") to str
```

```python
# sum은 최소한 반복 가능한 객체 하나가 필요하다.
sum()
```

```text
TypeError: sum() takes at least 1 positional argument (0 given)
```

#### `ValueError`

타입은 맞지만 값이 연산이나 함수가 허용하는 범위를 벗어날 때 발생한다.

```python
# int는 소수점이 포함된 문자열을 정수로 직접 바꿀 수 없다.
int('1.5')
```

```text
ValueError: invalid literal for int() with base 10: '1.5'
```

```python
# range(3)에는 6이 없다.
range(3).index(6)
```

```text
ValueError: 6 is not in range
```

`TypeError`와 `ValueError`는 다음처럼 구분하면 좋다. 함수가 기대한 종류의 객체가 아니면 `TypeError`, 종류는 맞지만 내용이 허용되지 않으면 `ValueError`다.

#### `IndexError`와 `KeyError`

`IndexError`는 시퀀스의 인덱스가 범위를 벗어났을 때 발생한다.

```python
empty_list = []
print(empty_list[2])
```

```text
IndexError: list index out of range
```

`KeyError`는 딕셔너리에 존재하지 않는 키를 대괄호로 조회할 때 발생한다.

```python
person = {'name': 'Alice'}
print(person['age'])
```

```text
KeyError: 'age'
```

#### `ModuleNotFoundError`와 `ImportError`

모듈 자체를 찾지 못하면 `ModuleNotFoundError`가 발생한다.

```python
import hahaha
```

```text
ModuleNotFoundError: No module named 'hahaha'
```

모듈은 있지만 그 안에서 요청한 이름을 가져올 수 없으면 `ImportError`가 발생한다.

```python
from random import hahaha
```

```text
ImportError: cannot import name 'hahaha' from 'random'
```

#### `KeyboardInterrupt`와 `IndentationError`

실행 중 사용자가 `Ctrl+C`로 프로그램을 중단하면 보통 `KeyboardInterrupt`가 발생한다. 무한 반복을 멈출 때 자주 보게 된다.

```python
while True:
    continue
```

`IndentationError`는 들여쓰기가 파이썬 문법에 맞지 않을 때 발생하며 `SyntaxError`의 하위 유형이다.

```python
for i in range(10):
print(i)
```

```text
IndentationError: expected an indented block after 'for' statement
```

⚠️ 주의: 예외 이름만 보고 코드를 고치지 말고 traceback의 마지막 줄과 문제가 표시된 줄을 함께 읽는다. 같은 `TypeError`라도 타입 불일치, 인자 누락, 호출 불가능한 객체 등 원인이 다를 수 있다.

---

### 3.12 `try-except`: 예상한 실패를 처리하기

예외 처리는 예외가 발생했을 때 프로그램이 무조건 비정상 종료되지 않고, 상황에 맞는 메시지나 대체 동작을 수행하게 만드는 방법이다.

기본 구조는 다음과 같다.

```python
try:
    # 예외가 발생할 가능성이 있는 코드
    risky_operation()
except SomeError:
    # SomeError가 발생했을 때 실행할 코드
    handle_error()
```

예외가 발생하지 않으면 `try`의 코드를 끝까지 실행하고 `except`는 건너뛴다. 예외가 발생하면 그 아래의 `try` 코드는 더 실행하지 않고, 일치하는 `except` 블록으로 이동한다.

0으로 나누는 상황을 처리해 보자.

```python
try:
    # 이 연산에서 ZeroDivisionError가 발생한다.
    result = 10 / 0
    print(result)
except ZeroDivisionError:
    # 프로그램이 종료되는 대신 안내 문장을 출력한다.
    print('0으로 나눌 수 없습니다.')
```

```text
0으로 나눌 수 없습니다.
```

사용자 입력을 정수로 변환할 때는 `ValueError`를 처리할 수 있다.

```python
try:
    # 'a'처럼 정수로 바꿀 수 없는 입력이면 ValueError가 발생한다.
    number = int(input('숫자 입력: '))
    print('입력한 숫자:', number)
except ValueError:
    print('숫자가 아닙니다.')
```

입력이 `a`라면 다음과 같이 동작한다.

```text
숫자 입력: a
숫자가 아닙니다.
```

⚠️ 주의: `try` 블록에 관련 없는 코드를 너무 많이 넣으면 어느 줄에서 예외가 발생했는지 알기 어렵고, 의도하지 않은 예외까지 같은 처리로 가릴 수 있다. 실패 가능 작업과 그 결과를 바로 사용하는 최소 범위만 `try`에 둔다.

---

### 3.13 복수 예외 처리

하나의 작업에서도 여러 종류의 예외가 발생할 수 있다. 사용자가 입력한 값으로 100을 나누는 코드를 생각해 보자.

```python
number = int(input('100으로 나눌 값을 입력하세요: '))
print(100 / number)
```

문자를 입력하면 `int()` 변환에서 `ValueError`가 발생하고, 숫자 `0`을 입력하면 나눗셈에서 `ZeroDivisionError`가 발생한다.

두 예외를 같은 방식으로 처리한다면 튜플로 묶을 수 있다.

```python
try:
    number = int(input('100으로 나눌 값을 입력하세요: '))
    print(100 / number)
except (ValueError, ZeroDivisionError):
    # 두 예외 중 하나가 발생하면 같은 문장을 출력한다.
    print('제대로 입력해 주세요.')
```

원인별로 다른 안내가 필요하면 `except`를 분리한다.

```python
try:
    number = int(input('100으로 나눌 값을 입력하세요: '))
    print(100 / number)
except ValueError:
    # 정수로 변환하지 못한 경우다.
    print('숫자를 넣어 주세요.')
except ZeroDivisionError:
    # 변환은 성공했지만 값이 0인 경우다.
    print('0으로 나눌 수 없습니다.')
except Exception:
    # 앞에서 예상하지 못한 일반적인 예외를 마지막에 처리한다.
    print('예상하지 못한 오류가 발생했습니다.')
```

⚠️ 주의: 예외 종류를 생략한 `except:`는 `KeyboardInterrupt`처럼 보통 사용자가 중단하려는 상황까지 잡을 수 있다. 일반적인 애플리케이션 오류의 마지막 방어선이 필요하다면 대개 `except Exception:`이 의도를 더 분명히 드러낸다.

---

### 3.14 `else`와 `finally`: 성공 경로와 정리 작업 분리하기

`try-except`에는 `else`와 `finally`를 이어 붙일 수 있다.

- `else`: `try`에서 예외가 발생하지 않았을 때만 실행한다.
- `finally`: 예외 발생 여부와 관계없이 항상 실행한다.

```python
try:
    # 입력 변환과 나눗셈 중 예외가 발생할 수 있다.
    x = int(input('숫자를 입력하세요: '))
    y = 10 / x
except ZeroDivisionError:
    print('0으로 나눌 수 없습니다.')
except ValueError:
    print('유효한 숫자가 아닙니다.')
else:
    # 앞의 두 작업이 모두 성공했을 때만 결과를 사용한다.
    print(f'결과: {y}')
finally:
    # 성공·실패와 관계없이 마지막에 한 번 실행한다.
    print('프로그램이 종료되었습니다.')
```

입력에 `2`를 넣으면 다음과 같다.

```text
숫자를 입력하세요: 2
결과: 5.0
프로그램이 종료되었습니다.
```

입력에 `0`을 넣으면 `else`는 실행되지 않지만 `finally`는 실행된다.

```text
숫자를 입력하세요: 0
0으로 나눌 수 없습니다.
프로그램이 종료되었습니다.
```

`else`를 사용하면 “실패 가능 작업”과 “성공한 결과를 사용하는 작업”을 구분할 수 있다. `finally`는 파일 닫기, 연결 해제, 임시 상태 정리처럼 반드시 마쳐야 하는 작업에 적합하다.

⚠️ 주의: `finally`는 항상 실행되므로 그 안에 `return`을 두면 앞에서 발생한 예외나 반환값을 가릴 수 있다. 정리 작업에 집중하고 흐름을 바꾸는 코드는 피하는 것이 좋다.

---

### 3.15 예외 클래스의 상속 계층과 `except` 순서

내장 예외도 클래스이며 상속 계층을 가진다. `ZeroDivisionError`, `ValueError`, `IndexError` 같은 많은 일반 예외는 결국 `Exception`의 하위 클래스다. 따라서 `except Exception`을 먼저 쓰면 그 아래의 구체적인 처리에 도달할 수 없다.

다음은 잘못된 순서다.

```python
try:
    number = int(input('100으로 나눌 값을 입력하세요: '))
    print(100 / number)
except Exception:
    # ZeroDivisionError도 Exception의 하위 클래스이므로 여기서 먼저 잡힌다.
    print('오류가 발생했습니다.')
except ZeroDivisionError:
    # 이 블록은 실행될 수 없다.
    print('0으로 나눌 수 없습니다.')
```

구체적인 예외를 먼저, 넓은 범위의 예외를 마지막에 배치해야 한다.

```python
try:
    number = int(input('100으로 나눌 값을 입력하세요: '))
    print(100 / number)
except ZeroDivisionError:
    # 가장 구체적인 원인별 처리를 먼저 둔다.
    print('0으로 나눌 수 없습니다.')
except ValueError:
    print('숫자를 넣어 주세요.')
except Exception:
    # 예상하지 못한 일반 예외는 마지막에 둔다.
    print('오류가 발생했습니다.')
```

📌 핵심: `except`는 위에서 아래로 검사한다. **자식 예외처럼 구체적인 범위부터 쓰고, 부모 예외처럼 넓은 범위를 마지막에 둔다.**

---

### 3.16 예외 객체로 상세 정보 확인하기

예외가 발생하면 파이썬은 예외 종류뿐 아니라 구체적인 메시지를 담은 예외 객체도 만든다. `except 예외종류 as 변수` 문법으로 이 객체를 받을 수 있다.

```python
my_list = []

try:
    # 빈 리스트의 1번 인덱스를 조회하므로 IndexError가 발생한다.
    number = my_list[1]
except IndexError as error:
    # error에는 파이썬이 만든 상세 메시지가 들어 있다.
    print(f'{error}가 발생했습니다.')
```

```text
list index out of range가 발생했습니다.
```

예외 객체는 사용자에게 그대로 보여주기보다 로그나 디버깅 정보로 활용하는 경우가 많다. 사용자 메시지는 이해하기 쉽게 따로 작성하고, 개발자용 기록에는 예외 종류와 상세 메시지를 남기면 좋다.

```python
try:
    value = int('1.5')
except ValueError as error:
    print('정수를 입력해 주세요.')
    print(f'[debug] {type(error).__name__}: {error}')
```

```text
정수를 입력해 주세요.
[debug] ValueError: invalid literal for int() with base 10: '1.5'
```

---

### 3.17 `try-except`와 `if-else` 함께 사용하기

예외 처리는 타입 변환이나 외부 작업처럼 실행해 보기 전에는 성공 여부를 확정하기 어려운 문제를 다룬다. 조건문은 변환에 성공한 뒤 값 자체가 업무 규칙을 만족하는지 검사할 때 적합하다.

```python
try:
    # 먼저 입력이 정수로 변환 가능한지 확인한다.
    x = int(input('숫자를 입력하세요: '))
except ValueError:
    # 정수가 아니면 예외 처리 경로로 이동한다.
    print('오류 발생: 정수를 입력해야 합니다.')
else:
    # 정수 변환이 성공한 뒤 값의 범위를 조건문으로 검사한다.
    if x < 0:
        print('음수는 허용되지 않습니다.')
    else:
        print('입력한 숫자:', x)
```

이 구조에서는 두 질문을 분리한다.

1. 입력을 정수로 해석할 수 있는가? → `try-except`
2. 해석된 정수가 허용 범위에 있는가? → `if-else`

예외 처리를 모든 조건 검사의 대체물로 사용하거나, 반대로 모든 예외 가능성을 복잡한 조건문으로 미리 검사할 필요는 없다.

---

### 3.18 EAFP와 LBYL

파이썬에서 실패 가능 작업을 다루는 대표적인 두 접근은 EAFP와 LBYL이다.

| 접근 | 원문 | 중심 도구 | 생각하는 방식 |
|---|---|---|---|
| EAFP | Easier to Ask Forgiveness than Permission | `try-except` | 일단 실행하고, 실패하면 해당 예외를 처리한다. |
| LBYL | Look Before You Leap | `if-else` | 실행하기 전에 조건을 검사해 실패를 피한다. |

딕셔너리에서 키를 조회하는 EAFP 방식은 다음과 같다.

```python
my_dict = {'name': 'Alice'}

try:
    # 키가 있다고 가정하고 바로 접근한다.
    result = my_dict['key']
    print(result)
except KeyError:
    # 가정이 틀렸을 때 발생한 예외를 처리한다.
    print('Key가 존재하지 않습니다.')
```

LBYL 방식은 먼저 키의 존재를 검사한다.

```python
my_dict = {'name': 'Alice'}

if 'key' in my_dict:
    # 존재를 확인한 경우에만 조회한다.
    result = my_dict['key']
    print(result)
else:
    print('Key가 존재하지 않습니다.')
```

EAFP는 예외 상황을 모두 사전에 열거하기 어렵거나, 검사와 실제 실행 사이에 상태가 바뀔 수 있을 때 유용하다. LBYL은 조건 검사가 간단하고 실패를 사전에 막는 편이 의도를 더 분명하게 보여줄 때 적합하다.

⚠️ 주의: EAFP는 넓은 `except`로 모든 버그를 숨기라는 뜻이 아니다. 예상한 예외만 좁게 잡아야 하며, 프로그래밍 실수까지 정상 흐름처럼 삼켜서는 안 된다.

---

### 3.19 클래스의 의미와 실제 활용

변수와 함수만으로도 짧은 알고리즘 문제는 충분히 해결할 수 있다. 입력을 받고 계산한 뒤 결과를 출력하는 작은 프로그램에서 억지로 클래스를 사용하면 오히려 구조가 복잡해질 수 있다.

그러나 프로그램 규모가 커지면 서로 관련된 데이터와 기능을 따로 관리하기 어려워진다. 클래스는 관련된 상태와 행동을 하나의 개념으로 묶어 구조를 명확하게 만든다.

도서 관리 프로그램이라면 책의 제목, 저자, 가격과 책 정보를 출력하는 기능을 `Book` 클래스에 함께 둘 수 있다.

```python
class Book:
    def __init__(self, title, author, price):
        # 책 한 권에 속하는 데이터를 한 객체에 묶는다.
        self.title = title
        self.author = author
        self.price = price

    def print_info(self):
        # 책 정보와 관련된 동작도 같은 클래스에 둔다.
        print(f'{self.title} / {self.author} / {self.price}원')


books = [
    Book('파이썬 기초', '김개발', 20_000),
    Book('객체 지향 입문', '이코딩', 25_000),
]

for book in books:
    book.print_info()
```

```text
파이썬 기초 / 김개발 / 20000원
객체 지향 입문 / 이코딩 / 25000원
```

상속은 이런 클래스들이 공통 규칙을 공유할 때 의미가 생긴다. 다만 “비슷한 코드가 조금 있다”는 이유만으로 상속부터 선택하지 말고, 실제로 부모와 자식의 개념 관계가 자연스러운지 확인해야 한다.

📌 핵심: 알고리즘 문제에서 클래스가 당장 자주 보이지 않더라도, 여러 사람이 함께 만드는 서비스나 데이터와 기능이 복잡하게 얽힌 프로그램에서는 객체 지향 설계가 큰 구조를 관리하는 기반이 된다.

---

## 4. 적용 관점에서 다시 보기

상속을 적용할 신호는 여러 클래스에 같은 속성과 동작이 반복되고, 그 대상들이 자연스러운 상위 개념으로 묶일 때다. 구현 전에 공통 부분과 자식별 차이를 표로 나누면 부모에 둘 책임과 자식에 둘 책임이 선명해진다.

| 구현 상황 | 떠올릴 개념 | 확인할 질문 |
|---|---|---|
| 여러 클래스에 같은 코드가 반복됨 | 상속 | 실제로 공통 상위 개념과 `is-a` 관계가 있는가? |
| 부모 동작을 자식에 맞게 바꿔야 함 | 오버라이딩 | 메서드 이름과 호출 규약을 유지했는가? |
| 부모가 둘 이상이고 같은 이름이 겹침 | MRO | `ClassName.mro()`의 실제 순서는 무엇인가? |
| 공통 생성자나 기존 로직을 재사용함 | `super()` | MRO의 다음 메서드가 어떤 인자를 기대하는가? |
| 예상 결과와 실제 결과가 다름 | 디버깅 | 입력, 분기, 반복, 상태 변경 중 어디서 처음 달라지는가? |
| 실행 중 특정 실패가 예상됨 | 예외 처리 | 발생 가능한 구체적인 예외 종류는 무엇인가? |
| 성공한 뒤에만 결과를 사용함 | `else` | `try`의 성공 경로를 분리할 수 있는가? |
| 성공 여부와 무관하게 정리해야 함 | `finally` | 파일·연결·임시 상태를 반드시 정리해야 하는가? |

상속 구조를 구현할 때는 다음 순서가 안정적이다.

1. 여러 대상이 공유하는 속성과 메서드를 찾는다.
2. 공통 부분을 부모 클래스에 정의한다.
3. 자식 클래스 선언부에 부모를 명시한다.
4. 자식 고유 속성과 메서드를 추가한다.
5. 바뀌어야 하는 부모 동작만 오버라이딩한다.
6. 부모 구현도 필요하면 `super()`로 재사용한다.
7. 다중 상속이라면 코드를 실행하기 전에 MRO를 확인한다.

예외 처리는 다음 순서로 설계하면 좋다.

1. 정상 입력과 정상 출력의 흐름을 먼저 작성한다.
2. 각 연산에서 발생 가능한 예외를 구체적으로 예상한다.
3. 실패 가능성이 있는 최소 코드만 `try`에 둔다.
4. 구체적인 예외부터 `except`로 처리한다.
5. 성공해야만 실행할 작업은 `else`로 옮긴다.
6. 항상 실행해야 하는 정리 작업은 `finally`에 둔다.
7. 예외 객체와 로그를 이용해 실패 원인을 남긴다.

실전에서는 예외 메시지를 출력하는 것으로 끝내지 않고 다음 행동까지 정해야 한다. 다시 입력받을지, 기본값을 사용할지, 현재 작업만 취소할지, 상위 호출자에게 예외를 다시 전달할지를 프로그램 요구사항에 맞춰 결정해야 한다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

상속은 단순한 코드 복사 기능이 아니라 공통 개념과 구체적인 개념의 관계를 표현하는 설계 방법이라는 점을 이해할 수 있었다. 또한 `super()`는 부모 클래스 이름의 별칭이 아니라, 현재 클래스의 MRO에서 다음 구현을 호출하는 도구이므로 다중 상속에서는 각 클래스의 협력적 호출이 필요하다.

### 5.2 앞으로 이어지는 연결점

상속과 오버라이딩은 추상 클래스, 다형성, 프레임워크의 확장 지점으로 이어진다. 예외 처리는 파일 입출력, 데이터베이스 연결, API 요청처럼 외부 환경 때문에 실패할 수 있는 거의 모든 실제 프로그램에서 사용되며, 이후에는 `raise`로 예외를 직접 발생시키고 사용자 정의 예외를 만드는 흐름으로 확장된다.

### 5.3 더 파볼 만한 주제

상속 대신 객체를 조합하는 컴포지션, 추상 기본 클래스, `super()`와 협력적 다중 상속의 인자 설계, 예외 체이닝, 사용자 정의 예외, `with` 문을 이용한 자원 정리를 더 살펴볼 수 있다.

---

## 6. 요약 정리

📌 핵심 정리

- 상속은 부모 클래스의 속성과 메서드를 자식 클래스가 물려받는 기능이다.
- 공통 코드는 부모에, 자식만의 속성과 동작은 자식에 두면 중복과 수정 범위를 줄일 수 있다.
- 메서드 오버라이딩은 부모 메서드를 자식에서 같은 이름으로 다시 정의하는 것이다.
- 파이썬은 메서드 시그니처에 따른 전통적인 오버로딩을 지원하지 않으며, 같은 이름의 마지막 정의만 남는다.
- 다중 상속에서 메서드와 속성을 찾는 순서는 MRO가 결정한다.
- 다이아몬드 구조의 MRO는 자식 우선, 왼쪽 부모 우선, 공통 조상 중복 방지 원칙을 따른다.
- `super()`는 MRO에서 현재 클래스 다음 구현을 호출한다.
- 디버깅은 예상 동작과 실제 동작이 처음 달라지는 지점을 단계적으로 좁히는 과정이다.
- 문법 오류는 실행 전에, 예외는 문법상 올바른 코드를 실행하는 중에 발생한다.
- `try`에는 실패 가능 코드, `except`에는 예외 처리, `else`에는 성공 후 작업, `finally`에는 항상 필요한 정리 작업을 둔다.
- 여러 `except`를 쓸 때는 구체적인 하위 예외를 먼저, 범용적인 `Exception`을 마지막에 둔다.
- `except SomeError as error`로 예외 객체의 상세 메시지를 활용할 수 있다.
- EAFP는 먼저 실행한 뒤 예외를 처리하고, LBYL은 실행 전에 조건을 검사한다.

🧠 기억할 것

상속 구조가 헷갈리면 추측하지 말고 `mro()`를 확인한다. 예외 처리가 필요하면 먼저 “어떤 줄에서 어떤 예외가 왜 발생하는가?”를 구체적으로 적는다. 구조와 실패 원인을 이름으로 명확히 표현하는 습관이 유지보수 가능한 코드를 만든다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. `Professor`와 `Student`의 공통 속성을 `Person`에 두면 어떤 중복을 줄일 수 있으며, 각 자식에는 무엇을 남겨야 하는가?
2. 메서드 오버라이딩과 파이썬에서 지원하지 않는 전통적 오버로딩은 어떻게 다른가?
3. `D(B, C)`, `B(A)`, `C(A)` 구조에서 `D.mro()`의 순서는 어떻게 되며, 왜 `A`보다 `C`를 먼저 탐색하는가?
4. 다중 상속에서 `super()`가 “직계 부모 하나를 호출한다”라는 설명만으로 부족한 이유는 무엇인가?
5. 문법 오류와 실행 중 예외는 발생 시점과 해결 방식에서 어떻게 다른가?
6. `ValueError`와 `TypeError`를 각각 어떤 기준으로 구분할 수 있는가?
7. `except Exception`을 `except ZeroDivisionError`보다 먼저 쓰면 왜 구체적인 처리에 도달하지 못하는가?
8. `else`와 `finally`는 각각 언제 실행되며 어떤 작업을 배치하는 것이 적절한가?
9. 딕셔너리 키 조회를 EAFP와 LBYL 방식으로 각각 설명할 수 있는가?
10. 예외를 잡은 뒤 메시지만 출력하는 것 외에 프로그램이 결정해야 할 후속 행동에는 무엇이 있는가?

### 이해 점검 체크리스트

- [ ] 부모 클래스와 자식 클래스를 선언하고 물려받은 메서드를 호출할 수 있다.
- [ ] 자식 클래스에서 메서드를 오버라이딩하고 실행 결과를 설명할 수 있다.
- [ ] 다중 상속 구조의 MRO를 `mro()`로 확인할 수 있다.
- [ ] `super()`를 사용해 부모 생성자의 공통 초기화를 재사용할 수 있다.
- [ ] traceback과 디버깅 출력을 이용해 오류 위치를 좁힐 수 있다.
- [ ] 대표적인 내장 예외가 발생하는 원인을 구분할 수 있다.
- [ ] 복수 예외를 튜플 또는 여러 `except` 블록으로 처리할 수 있다.
- [ ] `try-except-else-finally`의 각 블록을 목적에 맞게 배치할 수 있다.
- [ ] 구체적인 예외부터 범용적인 예외 순으로 처리할 수 있다.
- [ ] 상황에 따라 EAFP와 LBYL 중 더 명확한 접근을 선택할 수 있다.
