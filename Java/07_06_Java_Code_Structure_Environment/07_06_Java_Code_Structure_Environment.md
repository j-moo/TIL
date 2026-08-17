# 07_06 Java 코드 구조와 실행 환경: .java가 프로그램이 되기까지

- 학습 목표: Java 코드의 기본 구조, `main` 메서드, JDK/JVM/컴파일 흐름, 파일 이름 규칙과 이름 짓는 관례를 이해한다.
- 핵심 키워드: JDK, JRE, JVM, `javac`, `java`, `.java`, `.class`, 클래스 블록, 메서드 블록, 명령문, `main`, `public`, `static`, `void`, `String[] args`, PascalCase, camelCase
- 중요도: 높음. Java 입문자는 문법보다 먼저 “왜 이렇게 길게 써야 하는지”에서 자주 막힌다.
- 참고 자료: 점프 투 자바 01장 자바란 무엇인가, 02-01 자바 코드의 구조, 02-03 이름 짓는 규칙

---

## 1. 들어가며

Java를 처음 보면 가장 당황스러운 코드가 이것이다.

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
```

Python처럼 `print("Hello")` 한 줄로 끝나는 언어를 본 적이 있다면, Java의 첫 코드는 너무 길어 보인다. 하지만 Java는 “모든 코드는 클래스 안에 들어간다”는 규칙을 가진 언어다. 그래서 아주 작은 프로그램도 클래스와 메서드 모양을 갖춘다.

이번 노트의 목표는 긴 문장을 무작정 외우는 것이 아니다. 코드를 다음처럼 층으로 나누어 보는 것이다.

```text
파일: Hello.java
└─ 클래스 블록: public class Hello { ... }
   └─ 메서드 블록: public static void main(String[] args) { ... }
      └─ 명령문: System.out.println("Hello, Java!");
```

이 구조를 알면 Java 코드가 덜 무섭다. 그리고 `.java` 파일이 어떻게 `.class` 파일이 되고, JVM에서 실행되는지도 자연스럽게 이어진다.

## 2. 핵심 개념 정리

Java 프로그램 실행 흐름은 다음과 같다.

```mermaid
flowchart LR
    A["Hello.java<br/>사람이 작성한 소스 코드"] --> B["javac<br/>컴파일러"]
    B --> C["Hello.class<br/>바이트코드"]
    C --> D["JVM<br/>Java Virtual Machine"]
    D --> E["운영체제에서 프로그램 실행"]
```

각 용어는 이렇게 구분하면 된다.

| 용어 | 쉬운 설명 | 역할 |
|---|---|---|
| JDK | Java 개발 도구 상자 | 컴파일러, 실행 도구 등을 포함 |
| JRE | Java 실행 환경 | Java 프로그램 실행에 필요한 환경 |
| JVM | Java 가상 머신 | `.class` 바이트코드를 실행 |
| `javac` | Java compiler | `.java`를 `.class`로 컴파일 |
| `java` | Java launcher | 컴파일된 클래스를 실행 |
| `.java` | 소스 파일 | 사람이 읽고 작성하는 코드 |
| `.class` | 바이트코드 파일 | JVM이 읽고 실행하는 코드 |

입문 단계에서는 JDK만 설치하면 된다고 생각해도 된다. JDK 안에 개발과 실행에 필요한 도구들이 들어 있다.

## 3. 본문 정리

### 3.1 Java 코드의 가장 바깥은 클래스다

Java 코드는 보통 클래스 블록에서 시작한다.

```java
public class Hello {
    // 클래스 블록 내부
}
```

`class`는 클래스를 만든다는 키워드다. `Hello`는 클래스 이름이다. `{}`는 이 클래스의 범위를 나타낸다.

파일 이름도 중요하다.

```text
public class Hello  -> 파일 이름은 Hello.java
public class Sample -> 파일 이름은 Sample.java
```

`public class`가 있는 경우 클래스 이름과 파일 이름이 같아야 한다. Java는 대소문자를 구분하므로 `Hello.java`와 `hello.java`는 다르다.

처음에는 클래스를 “Java 코드가 들어가는 가장 바깥 상자”로 이해하면 된다. 객체지향을 배우면 클래스가 설계도라는 의미까지 더 깊게 이해하게 된다.

### 3.2 클래스 안에는 메서드가 들어간다

클래스 안에는 메서드가 들어갈 수 있다. 메서드는 어떤 일을 수행하는 코드 묶음이다.

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
```

여기서 `main`이 메서드 이름이다. Java 프로그램을 실행하면 JVM은 약속된 모양의 `main` 메서드를 찾아 시작점으로 삼는다.

`main` 메서드는 처음에는 아래 문장을 하나의 주문처럼 외워도 괜찮다.

```java
public static void main(String[] args)
```

하지만 단어별 의미를 가볍게 알고 있으면 덜 답답하다.

| 단어 | 입문 단계 설명 |
|---|---|
| `public` | 어디서든 접근할 수 있게 열어 둔다. |
| `static` | 객체를 만들지 않아도 실행할 수 있는 메서드다. |
| `void` | 실행 후 돌려주는 값이 없다. |
| `main` | 프로그램 시작점으로 약속된 이름이다. |
| `String[] args` | 실행할 때 전달받을 수 있는 문자열 배열이다. |

정확한 의미는 객체지향, 접근 제어자, static을 배울 때 다시 정리하면 된다. 지금은 “JVM이 프로그램을 시작하려고 찾는 정해진 입구”라고 생각하면 충분하다.

### 3.3 명령문은 세미콜론으로 끝난다

메서드 안에는 명령문이 들어간다.

```java
System.out.println("Hello, Java!");
```

명령문은 컴퓨터에게 시키는 한 문장이다. Java의 많은 명령문은 세미콜론 `;`으로 끝난다.

```java
int age = 12;
System.out.println(age);
age = age + 1;
```

세미콜론을 빼면 컴파일 오류가 난다.

```java
int age = 12 // 오류
```

세미콜론은 사람 글쓰기의 마침표와 비슷하다. Java 컴파일러에게 “이 명령은 여기서 끝입니다”라고 알려준다.

### 3.4 중괄호는 코드의 범위를 만든다

Java에서 `{}`는 코드 블록을 만든다.

```java
public class Hello {
    public static void main(String[] args) {
        if (true) {
            System.out.println("실행됩니다.");
        }
    }
}
```

중괄호는 상자처럼 겹칠 수 있다.

```text
class Hello {
    main() {
        if (...) {
            명령문;
        }
    }
}
```

처음 Java 코드를 읽을 때는 중괄호 짝을 먼저 보는 습관이 좋다. 코드가 길어져도 “나는 지금 클래스 안, 메서드 안, if문 안에 있구나”를 파악할 수 있다.

### 3.5 `.java` 파일은 사람이 읽는 코드다

우리가 작성하는 파일은 `.java` 파일이다.

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
```

이 파일은 사람이 읽을 수 있다. 하지만 컴퓨터가 바로 실행하는 최종 형태는 아니다. Java는 먼저 컴파일이라는 과정을 거친다.

명령 프롬프트나 터미널에서 다음 명령을 사용할 수 있다.

```bash
javac Hello.java
```

컴파일이 성공하면 `Hello.class` 파일이 생긴다. `.class` 파일은 사람이 읽기 위한 파일이 아니라 JVM이 읽기 위한 바이트코드 파일이다.

### 3.6 `.class` 파일은 JVM이 실행한다

컴파일 후에는 다음 명령으로 실행한다.

```bash
java Hello
```

주의할 점은 실행할 때 확장자 `.class`를 붙이지 않는다는 것이다.

```bash
java Hello        # 맞음
java Hello.class  # 보통 이렇게 쓰지 않음
```

흐름을 다시 정리하면 다음과 같다.

```text
1. Hello.java 작성
2. javac Hello.java 실행
3. Hello.class 생성
4. java Hello 실행
5. JVM이 Hello.class를 읽고 프로그램 실행
```

Java가 `.exe` 대신 `.class`를 만드는 이유는 JVM이라는 중간 실행 환경을 사용하기 때문이다. 같은 `.class` 파일이라도 Windows용 JVM, macOS용 JVM, Linux용 JVM에서 실행할 수 있다. 이것이 Java의 플랫폼 독립성과 연결된다.

#### 소스 코드, 바이트코드, 기계어를 구분하기

세 종류의 코드를 한 단계로 생각하면 컴파일러와 JVM의 역할이 헷갈린다.

| 형태 | 주로 읽는 대상 | 예시 |
| --- | --- | --- |
| 소스 코드 | 사람과 `javac` | `Hello.java` |
| Java 바이트코드 | JVM | `Hello.class` |
| 기계어 | 실제 CPU | 운영체제와 CPU에 맞는 명령 |

`javac`는 소스 코드를 특정 CPU의 기계어로 바로 만드는 것이 아니라 JVM이 이해하는 바이트코드로 변환한다. 실행 시 JVM은 바이트코드를 해석하거나, 자주 실행되는 부분을 JIT(Just-In-Time) 컴파일러로 현재 컴퓨터의 기계어로 바꾸어 실행할 수 있다.

```text
Hello.java
   │  javac: 문법·타입 검사 후 컴파일
   ▼
Hello.class
   │  JVM: 클래스 로딩·검증·실행
   │  JIT: 자주 실행되는 코드를 기계어로 최적화 가능
   ▼
현재 운영체제와 CPU에서 실행
```

따라서 “Java는 컴파일 언어인가, 인터프리터 언어인가?”라는 질문에는 한 단어로만 답하기 어렵다. 개발 단계에서는 `javac`로 바이트코드에 컴파일하고, 실행 단계에서는 JVM이 바이트코드를 실행하면서 필요에 따라 해석과 JIT 컴파일을 사용한다.

#### JDK, JVM, 컴파일러의 포함 관계

```text
JDK(Java Development Kit)
├─ javac 등 개발 도구
└─ Java 프로그램을 실행할 런타임 구성요소
   └─ JVM: 바이트코드를 실제로 실행하는 가상 머신
```

- 코드를 작성하고 컴파일하려면 JDK가 필요하다.
- `javac`는 JDK에 들어 있는 컴파일러 명령이다.
- JVM은 `.class` 바이트코드를 실행한다.
- IDE는 이 도구들을 대신 호출해 줄 뿐, 컴파일과 실행 단계를 없애지 않는다.

객체는 이 실행 흐름과 다른 층위의 개념이다. 클래스가 객체의 구조와 동작을 정의하면, `new`로 생성한 객체는 프로그램 실행 중 JVM이 관리하는 메모리에 존재한다. `.class` 파일 자체가 객체인 것은 아니다.

### 3.7 PATH는 명령어를 찾기 위한 길이다

터미널에서 `javac`를 입력했는데 다음과 비슷한 메시지가 나오면 Java 컴파일러를 찾지 못한 것이다.

```text
'javac'은(는) 내부 또는 외부 명령, 실행할 수 있는 프로그램이 아닙니다.
```

이 말은 “컴퓨터가 `javac.exe`가 어디 있는지 모른다”는 뜻이다. JDK의 `bin` 폴더가 PATH에 등록되어 있어야 터미널 어디에서든 `javac` 명령을 사용할 수 있다.

```text
JDK 설치 폴더
└─ bin
   ├─ javac.exe
   └─ java.exe
```

IDE를 사용하면 이런 설정을 대신 잡아주는 경우가 많다. 그래도 `javac`, `java`, PATH의 의미를 알고 있으면 환경 오류를 만났을 때 덜 흔들린다.

### 3.8 이름 짓는 규칙

Java는 이름을 아무렇게나 지어도 컴파일되는 경우가 많지만, 개발자들이 함께 읽기 쉽게 하기 위해 관례를 따른다.

| 대상 | 관례 | 예 |
|---|---|---|
| 클래스 | PascalCase, 명사 | `Student`, `HelloWorld`, `BankAccount` |
| 메서드 | camelCase, 동사로 시작 | `run`, `printName`, `getScore` |
| 변수 | camelCase, 의미 있게 | `studentName`, `totalScore` |
| 상수 | 대문자와 `_` | `MAX_SIZE`, `DEFAULT_NAME` |

PascalCase는 각 단어의 첫 글자를 대문자로 쓰는 방식이다.

```java
class ChocoCookie {
}
```

camelCase는 첫 단어는 소문자로 시작하고, 다음 단어부터 첫 글자를 대문자로 쓰는 방식이다.

```java
int totalScore = 100;
String studentName = "민수";
```

변수 이름은 짧기만 한 것보다 의미가 드러나는 것이 좋다.

```java
int a = 90;             // 의미를 알기 어려움
int mathScore = 90;     // 수학 점수라는 뜻이 보임
```

반복문의 인덱스처럼 잠깐 쓰는 변수는 `i`, `j`를 자주 사용한다.

```java
for (int i = 0; i < 5; i++) {
    System.out.println(i);
}
```

### 3.9 Java의 특징을 입문자 관점에서 보기

Java의 특징은 여러 가지가 있지만, 지금 단계에서 중요한 것은 다음 정도다.

| 특징 | 입문자용 설명 |
|---|---|
| 객체 지향 | 대부분의 코드를 클래스와 객체 중심으로 구성한다. |
| 플랫폼 독립 | JVM이 있으면 여러 운영체제에서 실행할 수 있다. |
| 강한 타입 검사 | 자료형이 맞지 않으면 컴파일 단계에서 많이 잡아준다. |
| 가비지 컬렉션 | 사용하지 않는 메모리를 자동으로 정리해 준다. |
| 풍부한 생태계 | 웹, 서버, Android, 대규모 시스템에서 많이 사용된다. |

Java가 처음에 어렵게 느껴지는 이유는 시작부터 클래스와 메서드가 등장하기 때문이다. 하지만 이 구조는 큰 프로그램을 안정적으로 만들 때 장점이 된다.

## 4. 적용 관점

Java 코드를 새로 만들 때는 다음 순서로 생각하면 된다.

1. 파일 이름을 정한다.
2. 같은 이름의 클래스를 만든다.
3. 실행할 프로그램이면 `main` 메서드를 만든다.
4. `main` 안에 명령문을 작성한다.
5. `javac`로 컴파일한다.
6. `java`로 실행한다.

예를 들어 `Greeting.java`를 만든다면 다음처럼 작성한다.

```java
public class Greeting {
    public static void main(String[] args) {
        String name = "민수";
        System.out.println("안녕하세요, " + name + "님!");
    }
}
```

실행 흐름은 다음과 같다.

```bash
javac Greeting.java
java Greeting
```

IDE에서는 버튼 하나로 실행할 수 있지만, 내부에서는 비슷한 컴파일과 실행 과정이 일어난다. IDE는 마법 상자가 아니라, 개발자가 해야 할 일을 편하게 도와주는 작업실이다.

## 5. 헷갈리기 쉬운 부분

### 5.1 파일 이름과 public class 이름은 같아야 한다

```java
public class Hello {
}
```

이 코드는 `Hello.java`에 저장해야 한다.

### 5.2 Java는 대소문자를 구분한다

`Hello`, `hello`, `HELLO`는 모두 다른 이름이다.

```java
int score = 100;
// System.out.println(Score); // 다른 이름이므로 오류
```

### 5.3 `main`은 프로그램 시작점이다

입문 단계에서는 아래 모양을 정확히 써야 한다.

```java
public static void main(String[] args) {
}
```

`Main`처럼 대문자로 쓰면 약속된 시작점이 아니다.

### 5.4 컴파일과 실행은 다르다

```bash
javac Hello.java
java Hello
```

`javac`는 `.class` 파일을 만드는 명령이고, `java`는 그 클래스를 실행하는 명령이다.

### 5.5 `.class` 파일은 사람이 읽는 파일이 아니다

`.class` 파일을 열면 이상한 문자처럼 보일 수 있다. 그것은 정상이다. 사람이 읽는 코드는 `.java`, JVM이 읽는 코드는 `.class`다.

### 5.6 IDE에서 실행되어도 원리는 같다

IntelliJ나 Eclipse에서 실행 버튼을 누르면 내부적으로 컴파일과 실행이 이루어진다. 터미널 명령을 몰라도 코딩은 할 수 있지만, 원리를 알면 오류를 이해하기 쉽다.

## 6. 요약

Java 코드는 클래스 블록 안에 작성된다. 실행 가능한 프로그램은 보통 `public static void main(String[] args)`라는 시작 메서드를 가진다. 메서드 안에는 명령문이 들어가며, 많은 명령문은 세미콜론으로 끝난다. 중괄호는 클래스, 메서드, 조건문, 반복문 등의 범위를 만든다.

사람이 작성하는 Java 파일은 `.java` 소스 파일이다. `javac` 컴파일러는 `.java` 파일을 JVM이 실행할 수 있는 `.class` 바이트코드로 바꾼다. 이후 `java 클래스명` 명령으로 JVM이 `.class` 파일을 실행한다.

JDK는 Java 개발 도구 상자이고, JVM은 `.class` 바이트코드를 실행하는 가상 머신이다. Java는 JVM 덕분에 운영체제와 독립적으로 실행될 수 있다는 장점이 있다.

이름을 지을 때 클래스는 `PascalCase`, 메서드와 변수는 `camelCase`를 사용하는 관례가 있다. 좋은 이름은 코드의 설명서 역할을 한다.

## 7. 복습 문제

1. `Hello.java` 파일 안의 `public class` 이름은 무엇이어야 하는가?
2. `javac Hello.java`를 실행하면 어떤 파일이 만들어지는가?
3. `java Hello` 명령에서 왜 `.class`를 붙이지 않는가?
4. `public static void main(String[] args)`는 어떤 역할을 하는가?
5. 세미콜론은 Java에서 어떤 의미를 가지는가?
6. 클래스 이름과 변수 이름의 관례는 어떻게 다른가?
7. JDK와 JVM의 역할 차이는 무엇인가?
