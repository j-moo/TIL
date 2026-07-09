# 07_08 Java 문자열과 StringBuffer: 글자를 다루는 가장 기본 도구

- 학습 목표: `String`의 특징을 이해하고, 문자열 비교와 자주 쓰는 메서드, 문자열을 많이 수정할 때 사용하는 `StringBuffer`와 `StringBuilder`를 구분한다.
- 핵심 키워드: `String`, 리터럴, `new String`, `equals`, `==`, `indexOf`, `contains`, `charAt`, `substring`, `split`, 포매팅, immutable, mutable, `StringBuffer`, `StringBuilder`
- 중요도: 높음. 입력 처리, 출력 포맷, 알고리즘 문제 풀이, 백엔드 개발에서 문자열은 거의 매일 사용한다.
- 참고 자료: 점프 투 자바 03-04 문자열, 03-05 StringBuffer

---

## 1. 들어가며

프로그램은 숫자만 다루지 않는다. 사람 이름, 문장, 비밀번호, 파일 이름, URL, 게시글 내용처럼 글자로 된 데이터도 아주 많이 다룬다. Java에서 이런 글자 묶음을 다루는 대표 자료형이 `String`이다.

```java
String name = "minsu";
String message = "Hello Java";
String numberText = "123";
```

여기서 `"123"`은 보기에는 숫자처럼 생겼지만 큰따옴표 안에 있으므로 문자열이다. 숫자 `123`과 문자열 `"123"`은 다르다.

```java
int number = 123;      // 계산할 수 있는 정수
String text = "123";   // 글자 1, 2, 3으로 이루어진 문자열
```

처음에는 `String`을 “글자를 담는 상자” 정도로 생각하면 된다. 그런데 Java의 `String`에는 꼭 알아야 할 특징이 있다.

1. 문자열은 큰따옴표로 만든다.
2. 문자열의 내용 비교에는 `equals`를 사용한다.
3. 문자열은 한 번 만들어지면 내용이 직접 바뀌지 않는다.
4. 문자열을 많이 이어 붙이거나 수정할 때는 `StringBuilder`나 `StringBuffer`가 더 적합할 수 있다.

이번 노트는 이 네 가지를 중심으로 정리한다.

## 2. 핵심 개념 정리

`String`은 문자의 모음이다. 문자 하나는 `char`, 문자 여러 개는 `String`이라고 생각하면 쉽다.

```java
char grade = 'A';        // 문자 하나
String word = "Apple";   // 문자 여러 개
```

Java에서 문자열을 만드는 방법은 크게 두 가지가 있다.

```java
String a = "Hello";
String b = new String("Hello");
```

둘 다 값은 `"Hello"`이지만 내부적으로는 다르게 동작한다. 첫 번째는 **문자열 리터럴** 방식이고, 두 번째는 `new`로 새 문자열 객체를 만드는 방식이다. 입문 단계에서는 보통 첫 번째 방식을 사용하면 된다.

문자열을 다룰 때 가장 중요한 차이는 다음 표로 잡아두자.

| 구분 | 의미 |
|---|---|
| `equals` | 문자열의 내용이 같은지 비교한다. |
| `==` | 두 변수가 같은 객체를 가리키는지 비교한다. |
| `String` | 한 번 만들어진 문자열 내용이 바뀌지 않는다. |
| `StringBuilder` | 문자열을 자주 수정할 때 사용한다. |
| `StringBuffer` | `StringBuilder`와 비슷하지만 멀티 스레드 환경에서 더 안전하다. |

문자열은 배열처럼 인덱스를 가진다. `"Hello"`라는 문자열은 다음처럼 볼 수 있다.

```text
문자열: H e l l o
인덱스: 0 1 2 3 4
```

배열과 마찬가지로 첫 번째 글자의 인덱스는 0이다.

## 3. 본문 정리

### 3.1 문자열 만들기

가장 자주 쓰는 방식은 큰따옴표를 사용하는 것이다.

```java
public class StringExample {
    public static void main(String[] args) {
        String greeting = "Hello Java";
        String name = "Minsu";

        System.out.println(greeting);
        System.out.println(name);
    }
}
```

문자열은 반드시 큰따옴표로 감싼다.

```java
String a = "A"; // 문자열
char b = 'A';   // 문자 하나
```

작은따옴표는 `char`에 사용한다. `char`는 글자 하나만 담을 수 있다.

```java
char one = 'A';
// char wrong = 'AB'; // 불가능
```

`String`은 `new`로도 만들 수 있다.

```java
String a = "Hello";
String b = new String("Hello");
```

입문 단계에서는 대부분 `String a = "Hello";` 방식으로 쓰면 된다. 코드가 짧고 읽기 쉽다.

### 3.2 `equals`와 `==`의 차이

문자열에서 가장 자주 하는 실수는 `==`로 내용을 비교하는 것이다.

```java
public class StringCompareExample {
    public static void main(String[] args) {
        String a = "hello";
        String b = new String("hello");

        System.out.println(a.equals(b)); // true
        System.out.println(a == b);      // false
    }
}
```

`a.equals(b)`는 두 문자열의 내용이 같은지 본다. 둘 다 `"hello"`이므로 `true`다.

반면 `a == b`는 두 변수가 같은 객체를 가리키는지 본다. `b`는 `new String("hello")`로 새 객체를 만들었기 때문에 `a`와 같은 객체가 아니다. 그래서 `false`다.

머릿속 그림은 이렇게 잡으면 된다.

```text
a ---> "hello"

b ---> new String("hello")
```

둘 다 적힌 글자는 `"hello"`지만, 두 이름표가 붙은 대상은 서로 다를 수 있다.

문자열 내용 비교는 거의 항상 `equals`를 사용한다.

```java
String input = "yes";

if (input.equals("yes")) {
    System.out.println("동의했습니다.");
}
```

`input`이 `null`일 가능성이 있으면 아래처럼 비교 문자열을 앞에 두는 방법도 있다.

```java
String input = null;

if ("yes".equals(input)) {
    System.out.println("동의했습니다.");
}
```

이렇게 하면 `input`이 `null`이어도 `NullPointerException`이 나지 않는다.

### 3.3 자주 쓰는 문자열 메서드

문자열 메서드는 문자열에게 “너 안에서 이 일을 해 줘”라고 부탁하는 도구다.

```java
String text = "Hello Java";
```

이 문자열에 대해 자주 쓰는 메서드를 정리하면 다음과 같다.

| 메서드 | 결과 | 의미 |
|---|---|---|
| `text.equals("Hello Java")` | `true` | 내용이 같은지 비교 |
| `text.indexOf("Java")` | `6` | 특정 문자열이 시작되는 인덱스 |
| `text.contains("Java")` | `true` | 특정 문자열을 포함하는지 확인 |
| `text.charAt(6)` | `'J'` | 특정 인덱스의 문자 하나 |
| `text.replaceAll("Java", "World")` | `"Hello World"` | 문자열 치환 |
| `text.substring(0, 5)` | `"Hello"` | 일부 문자열 추출 |
| `text.toUpperCase()` | `"HELLO JAVA"` | 대문자로 변환 |
| `text.split(" ")` | `{"Hello", "Java"}` | 구분자로 나누어 배열 반환 |

`indexOf`는 찾는 문자열이 없으면 `-1`을 반환한다.

```java
public class IndexOfExample {
    public static void main(String[] args) {
        String text = "Hello Java";

        System.out.println(text.indexOf("Java"));   // 6
        System.out.println(text.indexOf("Python")); // -1
    }
}
```

`contains`는 포함 여부만 필요할 때 좋다.

```java
String email = "student@example.com";

if (email.contains("@")) {
    System.out.println("이메일처럼 보입니다.");
}
```

`charAt`은 특정 위치의 문자 하나를 꺼낸다.

```java
String text = "Hello";

System.out.println(text.charAt(0)); // H
System.out.println(text.charAt(4)); // o
```

주의할 점은 배열처럼 문자열 인덱스도 0부터 시작한다는 것이다. 길이가 5인 문자열의 마지막 인덱스는 4다.

### 3.4 `substring`은 끝 인덱스를 포함하지 않는다

`substring`은 문자열의 일부를 자른다.

```java
String text = "Hello Java";
String part = text.substring(0, 5);

System.out.println(part); // Hello
```

`substring(0, 5)`는 0번부터 5번 전까지 가져온다.

```text
문자열: H e l l o   J a v a
인덱스: 0 1 2 3 4 5 6 7 8 9

substring(0, 5) -> 0, 1, 2, 3, 4만 포함
```

끝 인덱스가 포함되지 않는다는 점은 배열의 `copyOfRange`, Python 슬라이싱, Java 컬렉션의 범위 처리에서도 자주 나오는 규칙이다.

### 3.5 `split`은 문자열을 배열로 바꾼다

`split`은 문자열을 특정 기준으로 나누어 `String[]` 배열로 만든다.

```java
import java.util.Arrays;

public class SplitExample {
    public static void main(String[] args) {
        String text = "red:green:blue";
        String[] colors = text.split(":");

        System.out.println(Arrays.toString(colors));
    }
}
```

출력은 다음과 같다.

```text
[red, green, blue]
```

입력 처리에서 `split`은 특히 많이 쓴다.

```java
String line = "10 20 30";
String[] parts = line.split(" ");

int a = Integer.parseInt(parts[0]);
int b = Integer.parseInt(parts[1]);
int c = Integer.parseInt(parts[2]);

System.out.println(a + b + c); // 60
```

`split`의 결과는 문자열 배열이므로 숫자로 계산하려면 `Integer.parseInt` 같은 변환이 필요하다.

### 3.6 문자열 포매팅

문자열 안에 값을 끼워 넣고 싶을 때 문자열 포매팅을 사용할 수 있다.

```java
String result = String.format("이름: %s, 나이: %d", "민수", 12);
System.out.println(result);
```

출력은 다음과 같다.

```text
이름: 민수, 나이: 12
```

자주 쓰는 포맷 코드는 다음과 같다.

| 코드 | 의미 | 예 |
|---|---|---|
| `%s` | 문자열 | `"민수"` |
| `%d` | 정수 | `12` |
| `%f` | 실수 | `3.14` |
| `%c` | 문자 | `'A'` |
| `%n` | 줄바꿈 | 운영체제에 맞는 줄바꿈 |

`printf`도 같은 포맷 문법을 사용한다.

```java
double score = 93.456;
System.out.printf("점수: %.2f%n", score);
```

`%.2f`는 소수 둘째 자리까지 출력하라는 뜻이다.

### 3.7 `String`은 immutable이다

`String`은 한 번 만들어진 뒤 내용이 직접 바뀌지 않는다. 이를 immutable, 즉 변경 불가능하다고 말한다.

```java
String text = "hello";
text = text.toUpperCase();

System.out.println(text); // HELLO
```

겉으로는 `"hello"`가 `"HELLO"`로 바뀐 것처럼 보인다. 하지만 실제로는 기존 문자열을 바꾼 것이 아니라, `"HELLO"`라는 새 문자열을 만들고 `text`가 그 새 문자열을 가리키게 된 것이다.

```text
처음:
text ---> "hello"

toUpperCase 이후:
text ---> "HELLO"
         "hello"는 더 이상 text가 가리키지 않음
```

그래서 반복문 안에서 문자열을 계속 `+`로 이어 붙이면 새 문자열 객체가 많이 만들어질 수 있다.

```java
String result = "";

for (int i = 1; i <= 5; i++) {
    result += i;
}

System.out.println(result); // 12345
```

작은 코드에서는 괜찮지만, 수천 번 이상 반복되는 문자열 조립에서는 더 효율적인 도구를 쓰는 것이 좋다.

### 3.8 `StringBuilder`와 `StringBuffer`

문자열을 자주 추가하거나 수정할 때는 `StringBuilder` 또는 `StringBuffer`를 사용할 수 있다.

```java
public class StringBuilderExample {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();

        sb.append("hello");
        sb.append(" ");
        sb.append("java");

        String result = sb.toString();
        System.out.println(result);
    }
}
```

출력은 다음과 같다.

```text
hello java
```

`StringBuilder`는 글자를 담는 수정 가능한 메모장처럼 생각하면 된다. `append`로 뒤에 붙이고, `insert`로 중간에 넣고, `delete`로 일부를 지울 수 있다.

```java
public class StringBuilderMethods {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();

        sb.append("jump to java");
        sb.insert(0, "hello ");
        sb.delete(6, 11);

        System.out.println(sb.toString()); // hello to java
    }
}
```

`delete(6, 11)`도 끝 인덱스 11은 포함하지 않는다. 즉 6번부터 10번까지 지운다.

`StringBuilder`와 `StringBuffer`는 사용법이 거의 같다. 차이는 동기화 여부다.

| 구분 | 특징 | 보통 언제 쓰나 |
|---|---|---|
| `StringBuilder` | 빠르다. 동기화를 지원하지 않는다. | 대부분의 단일 흐름 문자열 조립 |
| `StringBuffer` | 동기화를 지원한다. 상대적으로 무겁다. | 여러 스레드가 동시에 접근할 수 있는 상황 |

처음 Java를 배우는 단계에서는 대부분 `StringBuilder`를 먼저 익히면 충분하다. `StringBuffer`는 “멀티 스레드 환경에서 안전성을 더 고려한 비슷한 도구” 정도로 잡아두자.

## 4. 적용 관점

문자열은 알고리즘 문제와 실무 코드에서 모두 자주 등장한다.

| 상황 | 자주 쓰는 도구 |
|---|---|
| 입력 한 줄을 공백으로 나누기 | `split(" ")` |
| 특정 단어가 들어 있는지 확인 | `contains` |
| 파일 확장자 확인 | `endsWith` |
| 앞뒤 공백 제거 | `trim` 또는 `strip` |
| 문자열 내용 비교 | `equals` |
| 대소문자 통일 | `toLowerCase`, `toUpperCase` |
| 반복문에서 결과 문자열 조립 | `StringBuilder` |
| 숫자 문자열을 정수로 변환 | `Integer.parseInt` |

예를 들어 로그 문자열에서 에러만 찾고 싶다면 `contains`를 사용할 수 있다.

```java
String log = "[ERROR] file not found";

if (log.contains("ERROR")) {
    System.out.println("에러 로그입니다.");
}
```

공백으로 나뉜 숫자 입력을 합산하려면 `split`과 반복문을 함께 쓴다.

```java
String input = "10 20 30 40";
String[] tokens = input.split(" ");

int sum = 0;

for (String token : tokens) {
    sum += Integer.parseInt(token);
}

System.out.println(sum); // 100
```

문자열은 배열, 반복문, 조건문과 거의 항상 같이 움직인다. 그래서 문자열 메서드는 “외울 목록”이라기보다, 문제를 풀면서 자주 꺼내 쓰는 도구 상자라고 보면 된다.

## 5. 헷갈리기 쉬운 부분

### 5.1 문자열 비교에는 `equals`

```java
String a = new String("java");
String b = new String("java");

System.out.println(a == b);      // false
System.out.println(a.equals(b)); // true
```

내용 비교는 `equals`다. `==`는 같은 객체인지 비교한다.

### 5.2 `String`은 원시 자료형이 아니다

`int`, `long`, `double`, `boolean`, `char`는 원시 자료형이다. `String`은 자주 쓰여서 특별 대우를 받지만 원시 자료형은 아니다.

```java
int age = 12;
String name = "Minsu";
```

`String`은 객체를 다루는 참조형이다.

### 5.3 인덱스는 0부터 시작한다

```java
String text = "Java";

System.out.println(text.charAt(0)); // J
System.out.println(text.charAt(3)); // a
```

`text.charAt(4)`는 오류다. 길이가 4인 문자열의 마지막 인덱스는 3이다.

### 5.4 `substring`의 끝 인덱스는 포함하지 않는다

```java
String text = "abcdef";
System.out.println(text.substring(1, 4)); // bcd
```

1번, 2번, 3번 인덱스만 포함한다.

### 5.5 `split`의 결과는 문자열 배열이다

```java
String[] parts = "1 2 3".split(" ");
```

`parts[0]`은 숫자 1이 아니라 문자열 `"1"`이다. 계산하려면 변환해야 한다.

```java
int number = Integer.parseInt(parts[0]);
```

## 6. 요약

Java에서 문자열은 `String`으로 다룬다. 문자열은 큰따옴표로 만들고, 문자 하나는 작은따옴표로 만드는 `char`를 사용한다. `String`은 참조형이며, 내용 비교에는 `equals`를 사용해야 한다. `==`는 문자열의 내용이 아니라 같은 객체를 가리키는지 확인한다.

문자열은 인덱스를 가지고 있으며 첫 번째 문자의 인덱스는 0이다. `indexOf`, `contains`, `charAt`, `replaceAll`, `substring`, `split` 같은 메서드를 사용하면 문자열을 검색하고, 바꾸고, 자르고, 나눌 수 있다.

`String`은 immutable이라서 한 번 만들어진 문자열 자체는 직접 바뀌지 않는다. 문자열을 조금만 다룰 때는 `String`으로 충분하지만, 반복문 안에서 많은 문자열을 이어 붙일 때는 `StringBuilder`를 사용하는 것이 좋다. `StringBuffer`는 `StringBuilder`와 비슷하지만 멀티 스레드 상황에서 더 안전하게 동작하도록 설계된 도구다.

## 7. 복습 문제

1. 문자열 `"hello"`와 문자 `'h'`의 차이는 무엇인가?
2. 문자열 내용 비교에 `==` 대신 `equals`를 써야 하는 이유는 무엇인가?
3. `"Hello Java".indexOf("Java")`의 결과는 무엇인가?
4. `"abcdef".substring(2, 5)`의 결과는 무엇인가?
5. `"10 20 30".split(" ")`의 결과 자료형은 무엇인가?
6. `String`이 immutable하다는 말은 무슨 뜻인가?
7. 반복문에서 문자열을 계속 이어 붙일 때 `StringBuilder`가 유리한 이유는 무엇인가?
