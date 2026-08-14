# Java 제네릭과 타입 안전성: `<T>`를 처음부터 이해하기

- 학습 목표: 제네릭이 필요한 이유를 이해하고, 제네릭 클래스·메서드·제한된 타입·와일드카드를 사용해 타입 관계가 안전한 코드를 작성한다.
- 핵심 키워드: Generic, Type Parameter, Type Argument, Diamond Operator, Raw Type, Generic Method, Bounded Type Parameter, Wildcard, PECS, Type Erasure
- 중요도: 매우 높음. `List`, `Map`, `Set`, `Optional`, Stream API 등 Java의 주요 API를 정확히 사용하려면 제네릭을 이해해야 한다.
- 선수 학습: 변수와 타입, 클래스와 객체, 상속과 인터페이스, 컬렉션 기초
- 관련 노트: [컬렉션 기초](../07_10_Java_Collections_Basics/07_10_Java_Collections_Basics.md), [객체지향 확장](../07_12_Java_OOP_Inheritance_Interface/07_12_Java_OOP_Inheritance_Interface.md)

---

## 1. 들어가며: `<String>`은 왜 붙일까

컬렉션을 사용하면 다음과 같은 코드를 자주 본다.

```java
List<String> names = new ArrayList<>();
Map<String, Integer> scores = new HashMap<>();
```

처음에는 `<String>`과 `<String, Integer>`가 낯선 장식처럼 보인다. 하지만 이 부분은 컬렉션이 다룰 값의 타입을 정하는 **계약**이다.

```java
List<String> names = new ArrayList<>();

names.add("민지");
// names.add(100); // 컴파일 오류

String firstName = names.get(0);
```

`List<String>`은 다음 두 가지를 보장한다.

1. 목록에는 `String`과 호환되는 값만 넣을 수 있다.
2. 목록에서 꺼낸 값은 별도의 강제 형 변환 없이 `String`으로 사용할 수 있다.

제네릭(generics)은 하나의 클래스나 메서드를 여러 타입에 재사용하면서도, 어떤 타입을 사용하는지 컴파일러가 추적하게 만드는 기능이다.

> 제네릭의 핵심은 코드를 짧게 만드는 것이 아니라, 서로 관련된 타입의 관계를 잃지 않는 것이다.

## 2. 제네릭이 없을 때 생기는 문제

### 2.1 `Object` 상자 만들기

모든 참조 타입은 `Object`로 다룰 수 있으므로 어떤 값이든 담는 상자를 만들 수 있다.

```java
class ObjectBox {
    private Object value;

    public void set(Object value) {
        this.value = value;
    }

    public Object get() {
        return value;
    }
}
```

사용할 때는 값을 꺼낼 때마다 형 변환해야 한다.

```java
ObjectBox box = new ObjectBox();
box.set("안녕하세요");

String message = (String) box.get();
```

문제는 상자에 다른 값이 들어가도 컴파일러가 막지 못한다는 것이다.

```java
ObjectBox box = new ObjectBox();
box.set(100);

String message = (String) box.get(); // 실행 중 ClassCastException
```

값을 잘못 넣은 곳과 오류가 발생한 곳이 멀리 떨어질 수 있다. 제네릭은 이 런타임 오류를 더 이른 컴파일 시점의 오류로 바꾼다.

### 2.2 제네릭 상자로 바꾸기

```java
class Box<T> {
    private T value;

    public void set(T value) {
        this.value = value;
    }

    public T get() {
        return value;
    }
}
```

`T`는 아직 정해지지 않은 타입을 나타내는 **타입 매개변수(type parameter)** 다.

```java
Box<String> messageBox = new Box<>();
messageBox.set("안녕하세요");
String message = messageBox.get();

Box<Integer> numberBox = new Box<>();
numberBox.set(100);
int number = numberBox.get();
```

`Box<String>`의 `String`과 `Box<Integer>`의 `Integer`는 실제로 전달한 **타입 인수(type argument)** 다.

```text
class Box<T>       → T: 타입 매개변수, 설계할 때의 빈칸
Box<String>        → String: 타입 인수, 사용할 때 채운 실제 타입
```

## 3. 제네릭 클래스 읽는 방법

### 3.1 `T`를 실제 타입으로 바꿔 읽기

다음 클래스를 `Box<String>`으로 사용한다면 클래스 안의 `T`를 모두 `String`으로 바꿔 읽는다.

```java
class Box<T> {
    private T value;

    public T get() {
        return value;
    }
}
```

개념상 다음 계약처럼 보인다.

```java
class StringBox {
    private String value;

    public String get() {
        return value;
    }
}
```

컴파일러가 실제로 별도의 `StringBox` 소스 코드를 만드는 것은 아니지만, 입문 단계에서는 타입 관계를 이렇게 치환해 읽으면 이해하기 쉽다.

### 3.2 타입 매개변수 이름 관례

한 글자를 사용해야 하는 문법 규칙은 아니지만 Java API에서는 다음 관례를 자주 따른다.

| 이름 | 의미 | 사용 예 |
| --- | --- | --- |
| `T` | Type | 일반적인 값 타입 |
| `E` | Element | 컬렉션의 원소 타입 |
| `K` | Key | Map의 키 타입 |
| `V` | Value | Map의 값 타입 |
| `R` | Result | 함수의 결과 타입 |
| `N` | Number | 숫자 타입 |

```java
class Pair<K, V> {
    private final K key;
    private final V value;

    public Pair(K key, V value) {
        this.key = key;
        this.value = value;
    }

    public K getKey() {
        return key;
    }

    public V getValue() {
        return value;
    }
}
```

```java
Pair<String, Integer> score = new Pair<>("민지", 95);

String name = score.getKey();
int value = score.getValue();
```

### 3.3 다이아몬드 연산자 `<>`

변수 왼쪽에 타입 정보가 있으면 생성자 오른쪽에서 같은 타입을 반복하지 않아도 컴파일러가 추론한다.

```java
List<String> names = new ArrayList<String>();
List<String> names = new ArrayList<>();
```

두 번째 형태의 빈 꺾쇠괄호 `<>`를 다이아몬드 연산자라고 부른다.

```java
List<String> names = new ArrayList();
```

마지막 코드는 `<>`가 빠져 raw type을 사용하므로 경고가 발생할 수 있다. “컴파일러가 알아서 알겠지”라는 뜻이 아니다.

## 4. Raw Type을 피해야 하는 이유

타입 인수를 생략한 `List`, `Box` 같은 형태를 raw type이라고 한다.

```java
List values = new ArrayList();
values.add("문자열");
values.add(100);

String first = (String) values.get(1); // 실행 중 오류
```

raw type은 제네릭이 도입되기 전 코드와의 호환을 위해 남아 있다. 새 코드에서는 타입 검사를 약하게 만들므로 사용하지 않는다.

```java
List<String> values = new ArrayList<>();
```

정말 원소 타입을 알 수 없다면 raw type보다 `List<?>`를 사용한다. `?`는 “타입이 없거나 아무 타입이나 섞여 있다”가 아니라 **정확한 타입이 무엇인지는 모르지만 하나의 어떤 타입으로 정해진 목록**이라는 뜻이다.

## 5. 제네릭 메서드

클래스 전체가 아니라 특정 메서드만 타입 매개변수를 사용할 수 있다.

```java
public static <T> T first(List<T> values) {
    if (values.isEmpty()) {
        throw new IllegalArgumentException("목록이 비어 있습니다.");
    }

    return values.get(0);
}
```

`<T>`가 반환 타입 `T`보다 앞에 있다는 점을 주의한다.

```text
public static <T> T first(...)
              │  └─ 반환 타입
              └──── 이 메서드가 T를 선언함
```

호출할 때 컴파일러가 인수로부터 `T`를 추론한다.

```java
String name = first(List.of("민지", "준")); // T는 String
Integer number = first(List.of(10, 20));     // T는 Integer
```

### 5.1 `Object` 메서드와 무엇이 다른가

```java
public static Object firstObject(List<Object> values) {
    return values.get(0);
}
```

이 메서드는 `List<String>`을 받을 수도 없고, 반환 타입과 원소 타입의 관계도 잃는다.

```java
public static <T> T first(List<T> values)
```

제네릭 버전은 입력 목록의 원소 타입 `T`와 반환 타입 `T`가 같다는 관계를 표현한다.

### 5.2 두 값의 타입 관계 유지하기

```java
public static <T> void copyFirst(List<T> source, List<T> target) {
    if (!source.isEmpty()) {
        target.add(source.get(0));
    }
}
```

두 매개변수에 같은 `T`가 등장하므로 소스에서 꺼낸 값을 타깃에 안전하게 넣을 수 있다.

## 6. 제한된 타입 매개변수

아무 타입이나 받는 대신 특정 상위 타입의 기능을 가진 타입만 받게 할 수 있다.

```java
public static <T extends Number> double doubleValue(T value) {
    return value.doubleValue();
}
```

`T extends Number`는 `T`가 `Number` 또는 그 하위 타입이어야 한다는 뜻이다.

```java
doubleValue(10);      // Integer
doubleValue(3.14);    // Double
// doubleValue("10"); // String은 Number가 아님
```

`extends`는 클래스 상속뿐 아니라 인터페이스 구현 제한에도 사용한다.

```java
public static <T extends Comparable<T>> T max(T first, T second) {
    return first.compareTo(second) >= 0 ? first : second;
}
```

```java
String later = max("apple", "banana");
Integer bigger = max(10, 20);
```

여러 제한을 함께 사용할 때는 클래스를 먼저 쓰고 인터페이스를 `&`로 연결한다.

```java
<T extends Number & Comparable<T>>
```

Java 클래스는 하나만 상속할 수 있으므로 클래스 제한도 하나만 올 수 있다.

## 7. 제네릭과 상속에서 가장 헷갈리는 점

`Integer`는 `Number`의 하위 타입이다.

```java
Number number = Integer.valueOf(10);
```

하지만 `List<Integer>`는 `List<Number>`의 하위 타입이 아니다.

```java
List<Integer> integers = List.of(1, 2, 3);
// List<Number> numbers = integers; // 컴파일 오류
```

만약 위 대입을 허용한다면 다음 문제가 생길 수 있다.

```java
List<Integer> integers = new ArrayList<>();
List<Number> numbers = integers; // 허용된다고 가정
numbers.add(3.14);               // Double 추가
Integer value = integers.get(0); // Integer 목록 계약이 깨짐
```

따라서 Java는 타입 안전성을 위해 두 제네릭 타입을 서로 다른 타입으로 본다. 여러 하위 타입의 목록을 유연하게 받으려면 와일드카드를 사용한다.

## 8. 와일드카드 `?`

와일드카드는 정확한 타입 이름이 중요하지 않을 때 제네릭 타입을 유연하게 받는 방법이다.

### 8.1 제한 없는 와일드카드 `<?>`

목록의 원소를 `Object`로 읽기만 한다면 정확한 원소 타입을 몰라도 된다.

```java
public static void printAll(List<?> values) {
    for (Object value : values) {
        System.out.println(value);
    }
}
```

```java
printAll(List.of("A", "B"));
printAll(List.of(1, 2, 3));
```

`List<?>`에는 `null` 외의 값을 안전하게 추가할 수 없다.

```java
public static void addUnknown(List<?> values) {
    // values.add("문자열"); // 실제 원소 타입을 모르므로 오류
}
```

호출자가 `List<Integer>`를 넘겼을 수도 있기 때문이다.

### 8.2 상한 와일드카드 `<? extends T>`

`Number` 또는 그 하위 타입의 목록에서 숫자를 읽으려면 다음처럼 작성한다.

```java
public static double sum(List<? extends Number> numbers) {
    double total = 0;

    for (Number number : numbers) {
        total += number.doubleValue();
    }

    return total;
}
```

```java
sum(List.of(1, 2, 3));       // List<Integer>
sum(List.of(1.5, 2.5, 3.5)); // List<Double>
```

이 목록에서는 값을 `Number`로 안전하게 읽을 수 있지만 구체적인 원소 타입을 모르므로 새 숫자를 추가할 수 없다.

```java
public static void addNumber(List<? extends Number> numbers) {
    // numbers.add(1);   // List<Double>일 수 있음
    // numbers.add(1.5); // List<Integer>일 수 있음
}
```

### 8.3 하한 와일드카드 `<? super T>`

`Integer` 값을 넣을 목적이라면 `Integer` 또는 그 상위 타입의 목록을 받을 수 있다.

```java
public static void addDefaults(List<? super Integer> target) {
    target.add(0);
    target.add(1);
}
```

```java
List<Integer> integers = new ArrayList<>();
List<Number> numbers = new ArrayList<>();
List<Object> objects = new ArrayList<>();

addDefaults(integers);
addDefaults(numbers);
addDefaults(objects);
```

꺼낼 때는 정확한 상위 타입을 알 수 없으므로 `Object`로만 안전하게 받을 수 있다.

```java
Object value = objects.get(0);
```

## 9. PECS: 읽는 곳과 쓰는 곳 구분하기

와일드카드 선택은 **PECS**라는 규칙으로 기억할 수 있다.

```text
Producer Extends, Consumer Super
값을 제공하는 쪽은 extends
값을 받아 소비하는 쪽은 super
```

```java
public static <T> void copy(
        List<? extends T> source,
        List<? super T> target
) {
    for (T value : source) {
        target.add(value);
    }
}
```

- `source`는 `T` 값을 꺼내 제공하므로 `? extends T`다.
- `target`은 `T` 값을 받아 저장하므로 `? super T`다.

```java
List<Integer> source = List.of(1, 2, 3);
List<Number> target = new ArrayList<>();

copy(source, target);
```

PECS는 무조건 외우는 주문이 아니다. “이 컬렉션에서 값을 꺼내는가, 넣는가?”를 묻는 사고 도구다. 같은 컬렉션에서 정확한 타입으로 읽고 쓰려면 와일드카드 없이 `List<T>`가 더 적절할 수 있다.

## 10. 기본형을 타입 인수로 쓸 수 없는 이유

제네릭 타입 인수에는 참조 타입을 사용한다.

```java
// List<int> numbers = new ArrayList<>(); // 오류
List<Integer> numbers = new ArrayList<>();
```

기본형에는 대응하는 래퍼 클래스가 있다.

| 기본형 | 래퍼 클래스 |
| --- | --- |
| `int` | `Integer` |
| `long` | `Long` |
| `double` | `Double` |
| `boolean` | `Boolean` |
| `char` | `Character` |

자동 박싱과 언박싱 덕분에 대부분 자연스럽게 사용할 수 있다.

```java
List<Integer> numbers = new ArrayList<>();
numbers.add(10);          // int → Integer 자동 박싱
int first = numbers.get(0); // Integer → int 자동 언박싱
```

다만 `Integer`가 `null`이면 `int`로 자동 언박싱할 때 `NullPointerException`이 발생할 수 있다.

## 11. 타입 소거

Java 제네릭은 주로 컴파일 시점의 타입 검사를 제공한다. 컴파일 과정에서 타입 매개변수 정보의 상당 부분이 지워지는 방식을 **타입 소거(type erasure)** 라고 한다.

```java
List<String> strings = new ArrayList<>();
List<Integer> integers = new ArrayList<>();

System.out.println(strings.getClass() == integers.getClass()); // true
```

두 객체 모두 런타임에는 `ArrayList` 클래스 객체를 사용한다.

타입 소거 때문에 다음과 같은 제한이 있다.

### 11.1 `T`로 직접 객체를 만들 수 없다

```java
class Factory<T> {
    // T create() {
    //     return new T(); // 오류
    // }
}
```

생성 방법을 외부에서 받는 방식으로 해결할 수 있다.

```java
import java.util.function.Supplier;

class Factory<T> {
    private final Supplier<T> creator;

    Factory(Supplier<T> creator) {
        this.creator = creator;
    }

    T create() {
        return creator.get();
    }
}
```

```java
Factory<StringBuilder> factory = new Factory<>(StringBuilder::new);
StringBuilder builder = factory.create();
```

### 11.2 제네릭 타입의 배열을 직접 만들기 어렵다

```java
// T[] values = new T[10];
// List<String>[] groups = new List<String>[10];
```

배열은 런타임에 원소 타입을 검사하지만 제네릭의 구체 타입 정보는 소거되기 때문에 안전하게 결합하기 어렵다. 보통 제네릭 컬렉션을 사용한다.

```java
List<List<String>> groups = new ArrayList<>();
```

### 11.3 `instanceof`로 구체 타입 인수를 검사할 수 없다

```java
if (value instanceof List<?>) {
    System.out.println("어떤 타입의 List입니다.");
}

// value instanceof List<String> // 검사할 수 없음
```

## 12. 실전 예제: 타입 안전한 저장소 만들기

학생 정보를 저장하는 간단한 저장소를 제네릭으로 만들어 보자.

```java
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

interface Identifiable {
    long getId();
}

class Student implements Identifiable {
    private final long id;
    private final String name;

    Student(long id, String name) {
        this.id = id;
        this.name = name;
    }

    @Override
    public long getId() {
        return id;
    }

    public String getName() {
        return name;
    }
}

class Repository<T extends Identifiable> {
    private final List<T> values = new ArrayList<>();

    public void save(T value) {
        values.add(value);
    }

    public Optional<T> findById(long id) {
        for (T value : values) {
            if (value.getId() == id) {
                return Optional.of(value);
            }
        }

        return Optional.empty();
    }

    public List<T> findAll() {
        return List.copyOf(values);
    }
}
```

```java
public class GenericRepositoryExample {
    public static void main(String[] args) {
        Repository<Student> students = new Repository<>();

        students.save(new Student(1L, "민지"));
        students.save(new Student(2L, "준"));

        students.findById(1L)
                .map(Student::getName)
                .ifPresent(System.out::println);
    }
}
```

이 코드에서 제네릭이 보존하는 관계는 다음과 같다.

```text
Repository<Student>
       │
       ├─ save는 Student만 받음
       ├─ findById는 Optional<Student> 반환
       └─ findAll은 List<Student> 반환
```

`T extends Identifiable` 제한 덕분에 저장소 내부에서 `getId()`를 안전하게 호출할 수 있다.

## 13. 자주 하는 실수

### 13.1 모든 곳을 `Object`로 바꾼다

`Object`는 어떤 값이든 받을 수 있지만 입력과 출력의 타입 관계를 잃는다. 타입이 서로 연결되어야 한다면 제네릭을 사용한다.

### 13.2 raw type 경고를 무시한다

```java
List names = new ArrayList();
```

동작할 수 있어도 컴파일러의 타입 검사를 포기한다. 새 코드에서는 구체 타입 또는 `<?>`를 사용한다.

### 13.3 `List<Number>`에 `List<Integer>`를 대입하려 한다

원소 타입의 상속 관계가 제네릭 타입의 상속 관계로 그대로 이어지지 않는다. 읽기 목적이면 `List<? extends Number>`를 검토한다.

### 13.4 `? extends` 목록에 값을 추가하려 한다

구체적인 하위 타입을 모르므로 안전하게 추가할 수 없다. 값을 넣는 목적이면 `? super T` 또는 정확한 `List<T>`를 고려한다.

### 13.5 제네릭을 런타임 검증으로 생각한다

제네릭은 주로 컴파일 시점의 계약이다. 외부 JSON, 파일, 사용자 입력이 실제로 원하는 구조인지는 별도로 검증해야 한다.

### 13.6 와일드카드를 무조건 복잡하게 쓴다

공개 API의 유연성이 필요할 때 와일드카드를 사용한다. 내부 지역 변수까지 무조건 `? extends`와 `? super`로 만들면 오히려 읽기 어려워질 수 있다.

## 14. 적용 관점에서 다시 보기

### 14.1 타입 매개변수는 관계를 표현한다

```java
static <T> T first(List<T> values)
```

이 선언에서 중요한 것은 `T`라는 글자가 아니다. “목록 원소 타입과 반환 타입이 같다”는 관계다.

### 14.2 API의 사용 방향을 먼저 생각한다

컬렉션 매개변수를 설계할 때 질문한다.

1. 값을 읽기만 하는가? `? extends T`를 검토한다.
2. 값을 넣기만 하는가? `? super T`를 검토한다.
3. 같은 정확한 타입으로 읽고 쓰는가? `T`를 사용한다.
4. 원소 타입과 무관하게 출력만 하는가? `?`를 사용할 수 있다.

### 14.3 컴파일 오류는 계약이 작동한 결과다

```java
List<String> names = new ArrayList<>();
// names.add(10);
```

이 오류는 Java가 불편하게 막는 것이 아니라, 문자열 목록에 숫자가 섞여 나중에 발생할 오류를 미리 막는 것이다.

## 15. 요약 정리

| 질문 | 핵심 답변 |
| --- | --- |
| 제네릭은 왜 사용하는가? | 재사용성과 타입 안전성을 함께 얻고 런타임 형 변환 오류를 줄이기 위해 사용한다. |
| `T`는 무엇인가? | 클래스나 메서드가 사용할 타입의 빈칸인 타입 매개변수다. |
| `<String>`은 무엇인가? | 빈칸에 전달한 실제 타입 인수다. |
| raw type은 왜 피하는가? | 제네릭의 컴파일 시점 타입 검사를 약하게 만들기 때문이다. |
| `List<Integer>`는 `List<Number>`인가? | 아니다. 서로 다른 매개변수화 타입이다. |
| `? extends T`는 언제 쓰는가? | 주로 `T` 계열 값을 읽어 제공하는 생산자에 사용한다. |
| `? super T`는 언제 쓰는가? | 주로 `T` 값을 받아 저장하는 소비자에 사용한다. |
| 타입 소거란 무엇인가? | 컴파일 과정에서 제네릭 타입 매개변수 정보의 상당 부분이 제거되는 방식이다. |

## 16. 미니 퀴즈와 체크리스트

### 16.1 미니 퀴즈

1. `Box<T>`의 `T`와 `Box<String>`의 `String`은 각각 무엇이라고 부르는가?
2. `List names = new ArrayList();`가 새 코드에서 권장되지 않는 이유는 무엇인가?
3. `static <T> T first(List<T> values)`에서 세 곳의 `T`는 어떤 관계를 나타내는가?
4. `List<Integer>`를 `List<Number>` 변수에 대입할 수 없는 이유를 값 추가 관점에서 설명해 보자.
5. `List<? extends Number>`에서 안전하게 읽을 수 있는 타입과 추가할 수 없는 이유는 무엇인가?
6. `List<? super Integer>`에 `Integer`를 추가할 수 있는 이유는 무엇인가?
7. PECS의 각 단어가 뜻하는 바를 설명해 보자.
8. `new T()`와 `new List<String>[10]`이 허용되지 않는 이유는 무엇인가?

### 16.2 실습 체크리스트

- [ ] `Box<T>`를 직접 작성하고 `String`, `Integer`로 각각 사용했다.
- [ ] `Pair<K, V>`를 만들어 두 타입 사이의 관계를 표현했다.
- [ ] raw type 코드에서 발생하는 컴파일러 경고를 확인했다.
- [ ] 제네릭 메서드 `first`를 작성하고 타입 추론 결과를 확인했다.
- [ ] `T extends Comparable<T>`를 사용한 `max`를 구현했다.
- [ ] `List<? extends Number>`로 `Integer`와 `Double` 목록의 합을 구했다.
- [ ] `List<? super Integer>`에 정수 값을 추가했다.
- [ ] PECS를 사용해 소스 목록에서 타깃 목록으로 값을 복사했다.
- [ ] 타입 소거 때문에 생기는 제약을 두 가지 이상 설명할 수 있다.

---

## 참고 자료

- [Dev.java - Generics](https://dev.java/learn/generics/)
- [Dev.java - Type Erasure](https://dev.java/learn/generics/type-erasure/)
- [Oracle Java Tutorials - Generics](https://docs.oracle.com/javase/tutorial/java/generics/)
- [Oracle Java Tutorials - Generic Methods](https://docs.oracle.com/javase/tutorial/java/generics/methods.html)
- [Oracle Java Tutorials - Wildcards](https://docs.oracle.com/javase/tutorial/java/generics/wildcards.html)

> 정리 기준일: 2026-08-14
