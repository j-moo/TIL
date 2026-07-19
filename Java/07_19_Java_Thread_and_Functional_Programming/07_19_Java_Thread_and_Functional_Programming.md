# Java 스레드와 함수형 프로그래밍

- 🎯 글의 목표: Java에서 여러 작업을 함께 진행하는 스레드의 기본 구조를 이해하고, 실행할 작업을 `Runnable`로 분리하는 이유를 익힌다. 이어서 함수형 인터페이스, 람다 표현식, 메서드 참조, 스트림을 학습하며 Java가 동작 자체를 전달하고 조합하는 방식을 연결해서 이해한다.
- 🧩 핵심 키워드: Process, Thread, `start()`, `run()`, `Thread.sleep()`, `join()`, `Runnable`, First-class Object, Functional Interface, Lambda, `@FunctionalInterface`, Method Reference, Stream, `filter`, `distinct`, `sorted`, `boxed`, `mapToInt`
- ⭐ 중요도: ★★★★★  
  스레드는 시간이 오래 걸리는 작업을 분리하거나 여러 작업을 함께 진행할 때 필요한 기초 개념이다. 람다와 스트림은 Java 컬렉션 처리, 비동기 작업, 이벤트 처리, Spring 기반 코드에서 반복적으로 등장한다. 특히 `Runnable`과 람다의 연결을 이해하면 객체 지향 문법과 함수형 문법이 서로 완전히 분리된 것이 아니라는 점을 알 수 있다.
- 📝 한눈에 보는 내용:  
  먼저 프로그램, 프로세스, 스레드의 관계를 살펴보고 `Thread`를 상속하여 새로운 실행 흐름을 만드는 방법을 배운다. `start()`와 `run()`의 차이, 여러 스레드의 실행 순서가 일정하지 않은 이유, `join()`으로 작업 종료를 기다리는 방법을 정리한다. 이후 상속의 제약을 줄이기 위해 `Runnable`로 할 일과 실행 장치를 분리한다. 이 구조는 함수형 프로그래밍의 람다 표현식과 자연스럽게 연결된다. 마지막에는 함수형 인터페이스와 메서드 참조를 익히고, 스트림으로 배열 데이터를 필터링·중복 제거·정렬·변환하는 파이프라인을 구성한다.
- 🔗 관련 문제 / 주제: 멀티스레드, 백그라운드 작업, 작업 완료 대기, 인터페이스, 람다식, 컬렉션 데이터 처리, 스트림 파이프라인, ExecutorService

---

## 1. 들어가며

일반적인 Java 프로그램은 `main()` 메서드의 첫 줄부터 마지막 줄까지 하나의 흐름으로 실행된다. 앞의 코드가 끝나야 다음 코드가 실행되므로 이해하기 쉽지만, 모든 일을 한 줄로 세워 처리하면 불편한 상황도 생긴다.

예를 들어 다음 두 작업을 생각해보자.

- 네트워크에서 큰 파일을 내려받는다.
- 다운로드가 진행되는 동안 화면에 진행률을 표시한다.

하나의 실행 흐름만 사용하면 파일 다운로드가 끝날 때까지 화면이 멈춘 것처럼 보일 수 있다. 이럴 때 작업을 여러 실행 흐름으로 나누면 다운로드와 화면 갱신을 함께 진행할 수 있다. Java에서 이러한 실행 흐름을 표현하는 기본 단위가 **스레드(Thread)**다.

하지만 스레드는 코드를 위에서 아래로 두 번 실행하는 기능 정도로만 이해하면 부족하다. 여러 스레드는 각자의 흐름으로 실행되기 때문에 시작과 종료 순서가 일정하지 않을 수 있고, main 스레드가 다른 작업보다 먼저 끝날 수도 있다. 따라서 필요할 때는 다른 스레드의 종료를 기다리는 제어가 필요하다.

스레드에서 한 단계 더 나아가면 “무엇을 실행할 것인가”를 객체로 전달하는 구조가 등장한다. `Runnable`은 실행할 작업을 `run()` 메서드로 표현한다. 그리고 `Runnable`은 추상 메서드가 하나인 함수형 인터페이스이므로 람다 표현식으로도 작성할 수 있다.

```java
Thread worker = new Thread(() -> {
    System.out.println("백그라운드 작업 실행");
});
```

이 짧은 코드 안에는 이번 글에서 배울 주요 개념이 함께 들어 있다.

- `Thread`: 별도의 실행 흐름을 관리한다.
- `Runnable`: 실행할 작업의 규칙을 나타낸다.
- `() -> { ... }`: 이름 없는 동작을 전달하는 람다 표현식이다.

따라서 이번 글은 스레드와 함수형 프로그래밍을 별개의 문법으로 외우기보다, **실행 흐름과 실행할 동작을 분리하는 과정**으로 연결해서 이해하는 것을 목표로 한다.

---

## 2. 핵심 개념 정리

이번 글의 큰 질문은 두 가지다.

> 하나의 Java 프로그램 안에서 여러 작업을 어떻게 나누어 실행할 수 있을까?

> 반복되는 클래스 구현 없이, 실행할 동작 자체를 어떻게 간결하게 전달할 수 있을까?

첫 번째 질문은 스레드가 해결한다. Java 프로그램을 실행하면 하나의 프로세스 안에서 기본적으로 main 스레드가 동작한다. 추가 스레드를 만들면 같은 프로세스 안에 여러 실행 흐름을 둘 수 있다.

스레드 학습의 흐름은 다음과 같다.

1. `Thread`를 상속하고 `run()`에 작업 내용을 작성한다.
2. `run()`을 직접 호출하지 않고 `start()`로 새로운 스레드를 시작한다.
3. 여러 스레드는 실행 순서가 일정하지 않을 수 있음을 확인한다.
4. 다른 스레드의 작업 완료가 필요하면 `join()`으로 기다린다.
5. 상속 제약을 줄이기 위해 실행할 작업을 `Runnable`로 분리한다.

두 번째 질문은 함수형 인터페이스와 람다가 해결한다. Java에서는 메서드 자체를 완전히 독립적인 타입으로 다루기보다, 추상 메서드가 하나인 인터페이스의 구현 객체로 동작을 표현한다. 람다는 이 구현 객체를 별도의 클래스 없이 간결하게 만드는 문법이다.

두 흐름의 연결점은 `Runnable`이다. `Runnable`은 `run()`이라는 하나의 추상 메서드를 가지므로 람다로 구현할 수 있다. 즉, 스레드에서 실행할 일을 함수형 표현으로 전달할 수 있다.

---

## 3. 본문 정리

## 3.1 프로그램, 프로세스, 스레드

프로그램은 저장 장치에 존재하는 실행 가능한 코드다. 프로그램을 실행하면 운영체제가 메모리와 자원을 할당하고, 실제로 동작하는 **프로세스(Process)**가 된다.

프로세스 내부에는 코드를 실제로 수행하는 실행 흐름이 필요하다. 이 실행 흐름이 **스레드(Thread)**다.

```text
프로그램
  └─ 실행
      └─ 프로세스
          ├─ main 스레드
          ├─ 작업 스레드 1
          └─ 작업 스레드 2
```

Java 애플리케이션을 실행하면 JVM은 `main()` 메서드를 수행하는 main 스레드를 만든다. 우리가 별도의 스레드를 생성하지 않아도 지금까지 작성한 코드는 이미 main 스레드 위에서 동작한 것이다.

여러 스레드를 사용하면 같은 프로세스의 자원을 공유하면서 각자 다른 실행 흐름을 가질 수 있다. 다만 어떤 스레드가 정확히 먼저 실행될지는 일반적으로 보장할 수 없다.

💡 포인트: 스레드는 단순히 코드를 빠르게 만드는 기능이 아니다. 독립적으로 진행할 수 있는 작업을 여러 실행 흐름으로 나누는 도구다.

---

## 3.2 `Thread`를 상속하여 스레드 만들기

가장 직접적인 방법은 `Thread` 클래스를 상속하고 `run()` 메서드를 재정의하는 것이다. `run()`에는 새로운 스레드가 수행할 작업을 작성한다.

```java
public class MessageThread extends Thread {

    @Override
    public void run() {
        // 새로 만들어진 작업 스레드가 수행할 내용이다.
        System.out.println("작업 스레드가 실행되었습니다.");
    }

    public static void main(String[] args) {
        // 아직은 일반 Java 객체를 생성한 상태다.
        MessageThread worker = new MessageThread();

        // 새로운 실행 흐름을 시작한다.
        // 내부적으로 새 스레드가 준비된 뒤 run()이 호출된다.
        worker.start();

        // 이 코드는 main 스레드에서 수행된다.
        System.out.println("main 스레드의 작업입니다.");
    }
}
```

이 코드에는 두 실행 흐름이 있다.

- main 스레드는 `main()` 메서드를 수행한다.
- `worker.start()`로 생성된 작업 스레드는 `run()` 메서드를 수행한다.

실행 결과는 항상 같은 순서로 나온다고 보장할 수 없다. 운영체제와 JVM의 스케줄링에 따라 어느 스레드가 먼저 CPU 실행 기회를 얻을지 달라질 수 있기 때문이다.

---

## 3.3 `start()`와 `run()`은 무엇이 다른가

처음 스레드를 배울 때 가장 많이 헷갈리는 부분은 `start()`와 `run()`이다.

```java
worker.start();
```

`start()`는 JVM에 새로운 스레드 실행을 요청한다. 새로운 호출 스택이 준비되고, 그 스레드에서 `run()`이 실행된다.

반면 다음 코드는 새로운 스레드를 만들지 않는다.

```java
worker.run();
```

`run()`을 직접 호출하면 일반 메서드를 호출한 것과 같다. 현재 실행 중인 main 스레드가 `run()`의 코드를 그대로 수행한다.

```java
public class StartAndRunExample extends Thread {

    @Override
    public void run() {
        System.out.println(
            "run() 실행 스레드: " + Thread.currentThread().getName()
        );
    }

    public static void main(String[] args) {
        StartAndRunExample first = new StartAndRunExample();
        StartAndRunExample second = new StartAndRunExample();

        // 새로운 스레드에서 run()이 수행된다.
        first.start();

        // 현재 main 스레드가 run()을 일반 메서드처럼 호출한다.
        second.run();

        System.out.println(
            "main() 실행 스레드: " + Thread.currentThread().getName()
        );
    }
}
```

출력 예시는 다음과 비슷하다.

```text
run() 실행 스레드: Thread-0
run() 실행 스레드: main
main() 실행 스레드: main
```

⚠️ 주의: 스레드를 시작하려는 목적이라면 `run()`이 아니라 `start()`를 호출해야 한다. `run()`을 직접 호출해도 코드가 실행되기 때문에 실수를 알아차리기 어렵다.

📌 핵심: `run()`은 작업 내용이고, `start()`는 그 작업을 새로운 스레드에서 시작하도록 요청하는 메서드다.

---

## 3.4 여러 스레드의 실행 순서

여러 스레드를 만들면 `0`, `1`, `2` 순으로 `start()`를 호출하더라도 실제 시작과 종료 순서가 그대로 유지된다는 보장은 없다.

```java
public class NumberedThread extends Thread {

    private final int number;

    public NumberedThread(int number) {
        this.number = number;
    }

    @Override
    public void run() {
        System.out.println(number + "번 스레드 시작");

        try {
            // 현재 스레드를 약 1초 동안 일시 정지한다.
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            // 중단 요청을 잃지 않도록 인터럽트 상태를 복원한다.
            Thread.currentThread().interrupt();
            System.out.println(number + "번 스레드가 중단되었습니다.");
            return;
        }

        System.out.println(number + "번 스레드 종료");
    }

    public static void main(String[] args) {
        for (int i = 0; i < 5; i++) {
            Thread worker = new NumberedThread(i);
            worker.start();
        }

        System.out.println("main 메서드의 마지막 줄");
    }
}
```

여기서 두 가지를 확인해야 한다.

첫째, 스레드는 생성 순서와 동일하게 실행된다고 보장할 수 없다. 둘째, main 스레드는 작업 스레드의 종료를 자동으로 기다리지 않는다. main 스레드는 작업 스레드를 시작한 뒤 자신의 다음 코드로 계속 진행한다.

⚠️ 주의: 출력 순서를 기준으로 스레드 로직의 정확성을 판단하면 안 된다. 여러 스레드가 공유 데이터를 변경한다면 출력 순서 문제를 넘어 데이터 경쟁 상태까지 발생할 수 있다.

---

## 3.5 `Thread.sleep()`과 `InterruptedException`

`Thread.sleep(milliseconds)`는 현재 실행 중인 스레드를 지정한 시간 동안 일시 정지한다.

```java
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
}
```

`sleep()`을 호출한 객체가 아니라 **현재 이 코드를 수행 중인 스레드**가 멈춘다는 점이 중요하다.

`sleep()`은 `InterruptedException`을 발생시킬 수 있으므로 예외 처리가 필요하다. 다른 스레드가 `interrupt()`를 호출하여 대기 중인 스레드에 중단 요청을 전달할 수 있기 때문이다.

초보 예제에서는 예외를 비워두는 코드를 볼 수 있지만, 실제 코드에서 예외를 무시하면 중단 요청을 잃어버릴 수 있다. 최소한 인터럽트 상태를 복원하는 방식이 일반적이다.

⚠️ 주의: `sleep(1000)`은 정확히 1초 뒤에 반드시 실행을 재개한다는 의미가 아니다. 적어도 해당 시간 동안 실행 대상에서 제외되고, 시간이 지난 뒤 다시 스케줄링될 때 실행된다.

---

## 3.6 다른 스레드의 종료를 기다리는 `join()`

main 스레드가 작업 스레드를 시작한 뒤 즉시 다음 단계로 넘어가면 문제가 되는 상황이 있다. 예를 들어 여러 파일을 동시에 처리한 뒤 결과를 합산해야 한다면, 합산은 모든 분석이 끝난 뒤에 실행되어야 한다. 이때 사용하는 메서드가 `join()`이다.

```java
import java.util.ArrayList;
import java.util.List;

public class JoinExample extends Thread {

    private final int number;

    public JoinExample(int number) {
        this.number = number;
    }

    @Override
    public void run() {
        System.out.println(number + "번 작업 시작");

        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }

        System.out.println(number + "번 작업 종료");
    }

    public static void main(String[] args) {
        List<Thread> workers = new ArrayList<>();

        for (int i = 0; i < 5; i++) {
            Thread worker = new JoinExample(i);
            worker.start();
            workers.add(worker);
        }

        for (Thread worker : workers) {
            try {
                // main 스레드는 해당 worker가 끝날 때까지 기다린다.
                worker.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }

        System.out.println("모든 작업이 끝난 뒤 main 작업을 수행합니다.");
    }
}
```

`worker.join()`을 호출하는 주체는 main 스레드다. 의미를 풀어쓰면 다음과 같다.

```text
main 스레드:
“worker 스레드가 끝날 때까지 나는 여기서 기다리겠다.”
```

`join()`을 호출했다고 작업 스레드들이 시작 순서대로 끝나는 것은 아니다. 작업 스레드의 실행 순서는 여전히 일정하지 않다. 다만 main 스레드의 마지막 작업이 모든 작업 스레드 종료 이후로 밀린다.

⚠️ 주의: `join()`은 스레드끼리 합치는 기능이 아니라, 호출한 스레드가 대상 스레드의 종료를 기다리는 기능이다.

---

## 3.7 `Thread` 상속보다 `Runnable`을 사용하는 이유

`Thread`를 상속하면 구현이 간단하지만 Java 클래스는 한 개의 클래스만 상속할 수 있다는 제약이 있다.

실제로 표현하고 싶은 것은 대부분 “이 객체가 스레드다”가 아니라 “이 객체가 수행할 작업을 가지고 있다”에 가깝다.

`Runnable`을 사용하면 두 역할을 나눌 수 있다.

- `Runnable`: 어떤 작업을 수행할지 정의한다.
- `Thread`: 그 작업을 별도 실행 흐름에서 실행한다.

```java
public class DownloadTask implements Runnable {

    private final String fileName;

    public DownloadTask(String fileName) {
        this.fileName = fileName;
    }

    @Override
    public void run() {
        System.out.println(fileName + " 다운로드 시작");

        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }

        System.out.println(fileName + " 다운로드 완료");
    }

    public static void main(String[] args) {
        Runnable task = new DownloadTask("lecture.pdf");
        Thread worker = new Thread(task);
        worker.start();
    }
}
```

이 구조는 작업과 실행 수단을 분리하므로 더 유연하다.

📌 핵심: `Thread`는 실행 흐름을 담당하고, `Runnable`은 실행할 일을 담당한다.

---

## 3.8 `Runnable`에서 람다로 이어지는 연결

`Runnable` 인터페이스의 핵심 형태는 다음과 같다.

```java
@FunctionalInterface
public interface Runnable {
    void run();
}
```

추상 메서드가 `run()` 하나뿐이므로 Java는 어떤 람다 표현식이 `run()`의 구현인지 판단할 수 있다.

```java
Runnable task = () -> {
    System.out.println("작업 실행");
};
```

스레드 생성과 함께 전달할 수도 있다.

```java
public class RunnableLambdaExample {

    public static void main(String[] args) {
        Thread worker = new Thread(() -> {
            System.out.println(
                "현재 스레드: " + Thread.currentThread().getName()
            );
            System.out.println("람다로 전달한 작업을 수행합니다.");
        });

        worker.start();
    }
}
```

이 코드에서 람다는 혼자 존재하는 함수처럼 보이지만, 실제로는 `Thread` 생성자가 요구하는 `Runnable` 타입의 구현으로 해석된다.

```text
() -> { 작업 내용 }
       ↓
Runnable의 void run() 구현
```

---

## 3.9 함수형 프로그래밍과 일급 객체

함수형 프로그래밍은 동작을 조합하고 전달하며 데이터를 변환하는 방식에 초점을 둔다. 핵심 아이디어 중 하나는 함수를 값처럼 다루는 것이다.

Java는 메서드 자체를 변수에 직접 담는 문법보다 **함수형 인터페이스 객체**를 통해 동작을 값처럼 다룬다.

```java
@FunctionalInterface
interface Operation {
    int apply(int a, int b);
}
```

이 인터페이스 객체에는 정수 두 개를 받아 정수 하나를 반환하는 동작을 담을 수 있다.

```java
Operation add = (a, b) -> a + b;
Operation multiply = (a, b) -> a * b;
```

동작을 메서드의 인자로 전달하는 것도 가능하다.

```java
public class FirstClassStyleExample {

    @FunctionalInterface
    interface Operation {
        int apply(int a, int b);
    }

    static int calculate(int first, int second, Operation operation) {
        return operation.apply(first, second);
    }

    public static void main(String[] args) {
        int sum = calculate(3, 4, (a, b) -> a + b);
        int product = calculate(3, 4, (a, b) -> a * b);

        System.out.println(sum);      // 7
        System.out.println(product);  // 12
    }
}
```

`calculate()`는 더하기나 곱하기를 직접 알지 못한다. 어떤 동작을 할지는 `Operation` 객체를 통해 외부에서 전달된다.

💡 포인트: Java의 함수형 스타일은 객체 지향을 버리는 방식이 아니다. 인터페이스라는 객체 지향 구조 위에 람다 문법을 결합한 방식이다.

---

## 3.10 람다 표현식

람다는 이름 없는 함수 형태의 표현식이다. Java에서는 함수형 인터페이스의 추상 메서드를 구현할 때 사용한다.

기본 형태는 다음과 같다.

```java
(매개변수) -> 표현식
```

또는 여러 줄의 작업이 필요하다면 블록을 사용한다.

```java
(매개변수) -> {
    실행문;
    return 반환값;
}
```

```java
@FunctionalInterface
interface Calculator {
    int calculate(int a, int b);
}

public class LambdaExample {

    public static void main(String[] args) {
        Calculator calculator = (a, b) -> a + b;
        System.out.println(calculator.calculate(3, 4));
    }
}
```

별도의 구현 클래스가 사라졌지만 인터페이스가 사라진 것은 아니다. 컴파일러는 변수 타입인 `Calculator`를 보고 람다의 매개변수와 반환 형태를 판단한다.

⚠️ 주의: 람다는 아무 변수에나 저장할 수 있는 독립적인 문법이 아니다. 컴파일러가 어떤 함수형 인터페이스로 해석해야 하는지 알 수 있는 대상 타입이 필요하다.

---

## 3.11 함수형 인터페이스와 `@FunctionalInterface`

람다의 대상이 되는 인터페이스는 추상 메서드가 하나여야 한다. 이러한 인터페이스를 **함수형 인터페이스**라고 한다.

```java
@FunctionalInterface
interface Calculator {
    int calculate(int a, int b);
}
```

`@FunctionalInterface`는 필수는 아니지만, 붙이면 컴파일러가 함수형 인터페이스 규칙을 검사해준다.

```java
@FunctionalInterface
interface InvalidCalculator {
    int add(int a, int b);

    // 두 번째 추상 메서드가 추가되어 컴파일 오류가 발생한다.
    int multiply(int a, int b);
}
```

추상 메서드가 두 개이면 람다가 어느 메서드를 구현하는지 판단할 수 없다.

⚠️ 주의: 함수형 인터페이스의 핵심은 메서드가 하나가 아니라 **추상 메서드가 하나**라는 점이다. `default`, `static` 메서드는 추가할 수 있다.

---

## 3.12 람다 표현식 축약 규칙

컴파일러가 함수형 인터페이스를 통해 타입을 추론할 수 있으므로 람다는 여러 부분을 생략할 수 있다.

```java
Calculator first = (int a, int b) -> a + b;
Calculator second = (a, b) -> a + b;
```

매개변수가 하나라면 괄호를 생략할 수 있다.

```java
@FunctionalInterface
interface Formatter {
    String format(String value);
}

Formatter upper = value -> value.toUpperCase();
```

실행문이 하나이고 그 결과를 반환한다면 중괄호와 `return`을 생략할 수 있다.

```java
Calculator first = (a, b) -> {
    return a + b;
};

Calculator second = (a, b) -> a + b;
```

여러 문장이 필요하면 중괄호를 사용하고 반환값이 있다면 `return`도 작성해야 한다.

---

## 3.13 메서드 참조

람다 내부에서 이미 존재하는 메서드 하나만 그대로 호출한다면 메서드 참조로 더 간결하게 표현할 수 있다.

```java
Calculator calculator = (a, b) -> Integer.sum(a, b);
```

위 람다는 다음처럼 바꿀 수 있다.

```java
Calculator calculator = Integer::sum;
```

간단한 예제를 살펴보자.

```java
import java.util.function.Function;

public class MethodReferenceExample {

    public static void main(String[] args) {
        Function<String, Integer> first =
            value -> Integer.parseInt(value);

        Function<String, Integer> second =
            Integer::parseInt;

        System.out.println(first.apply("100"));
        System.out.println(second.apply("200"));
    }
}
```

⚠️ 주의: 메서드 참조는 무조건 람다보다 좋은 것이 아니다. 추가 계산이나 조건 처리가 필요하다면 람다가 더 읽기 쉽다.

---

## 3.14 스트림이 필요한 이유

배열이나 리스트의 데이터를 처리할 때 반복문을 사용하면 각 단계를 직접 관리해야 한다.

다음 요구사항을 생각해보자.

1. 정수 배열에서 짝수만 남긴다.
2. 중복을 제거한다.
3. 큰 수부터 정렬한다.
4. 다시 `int[]` 배열로 만든다.

반복문과 컬렉션으로도 구현할 수 있지만 데이터 처리 단계가 많아질수록 임시 변수와 반복문이 늘어난다.

스트림은 데이터의 흐름에 변환 단계를 연결한다.

```text
원본 배열
→ 짝수 필터링
→ 중복 제거
→ 역순 정렬
→ int 배열 변환
```

스트림을 사용하면 어떻게 반복할 것인가보다 어떤 처리를 할 것인가가 코드에 더 직접적으로 드러난다.

---

## 3.15 스트림 파이프라인

스트림 코드는 보통 세 부분으로 나눠 이해하면 쉽다.

1. 스트림 생성
2. 중간 연산
3. 최종 연산

```java
import java.util.Arrays;
import java.util.Comparator;

public class StreamExample {

    public static void main(String[] args) {
        int[] data = {5, 6, 4, 2, 3, 1, 1, 2, 2, 4, 8};

        int[] result = Arrays.stream(data)
            // int 전용 IntStream을 Stream<Integer>로 바꾼다.
            .boxed()

            // 조건이 true인 데이터만 다음 단계로 전달한다.
            .filter(number -> number % 2 == 0)

            // 같은 값이 여러 번 등장하면 하나만 남긴다.
            .distinct()

            // Integer 값을 큰 수부터 정렬한다.
            .sorted(Comparator.reverseOrder())

            // Stream<Integer>를 다시 IntStream으로 변환한다.
            .mapToInt(Integer::intValue)

            // 처리된 값을 int[] 배열로 만든다.
            .toArray();

        System.out.println(Arrays.toString(result));
        // [8, 6, 4, 2]
    }
}
```

### 스트림 생성

```java
Arrays.stream(data)
```

`data`가 `int[]`이므로 결과는 `IntStream`이다.

### 중간 연산

```java
.boxed()
.filter(...)
.distinct()
.sorted(...)
.mapToInt(...)
```

중간 연산은 새로운 스트림을 반환하므로 점으로 계속 연결할 수 있다.

### 최종 연산

```java
.toArray()
```

`toArray()`는 스트림의 처리를 실제로 수행하고 결과 배열을 만든다.

📌 핵심: 스트림은 데이터 자체를 저장하는 자료구조가 아니라, 데이터가 어떤 단계를 거쳐 처리될지 표현하는 파이프라인이다.

---

## 3.16 `boxed()`와 `mapToInt()`가 필요한 이유

Java에는 기본형을 위한 특화 스트림이 있다.

| 데이터 | 스트림 |
|---|---|
| `int` | `IntStream` |
| `long` | `LongStream` |
| `double` | `DoubleStream` |
| 객체 | `Stream<T>` |

`Arrays.stream(int[])`는 `IntStream`을 만든다. 하지만 `Comparator.reverseOrder()`는 객체용 `Comparator<Integer>`를 사용한다. 따라서 기본형 `int`를 래퍼 객체 `Integer`로 감싼 `Stream<Integer>`로 변경해야 한다.

```java
.boxed()
```

파이프라인 마지막에는 `int[]`가 필요하므로 다시 `IntStream`으로 돌아간다.

```java
.mapToInt(Integer::intValue)
```

흐름은 다음과 같다.

```text
int[]
→ IntStream
→ Stream<Integer>
→ 데이터 처리
→ IntStream
→ int[]
```

⚠️ 주의: 단순 오름차순 정렬만 필요하다면 `IntStream.sorted()`를 바로 사용할 수 있어 `boxed()`가 필요하지 않을 수 있다. 이번 예제에서는 객체용 역순 Comparator 때문에 변환이 추가되었다.

---

## 3.17 `filter()`와 람다의 연결

`filter()`는 조건을 만족하는 요소만 남기는 중간 연산이다.

```java
.filter(number -> number % 2 == 0)
```

`filter()`가 받는 것은 단순한 `boolean` 값이 아니라, 요소를 하나 받아 조건 결과를 반환하는 동작이다.

람다를 풀어 읽으면 다음과 같다.

```text
number를 하나 받는다.
→ number가 짝수인지 검사한다.
→ 짝수이면 true, 아니면 false를 반환한다.
```

스트림은 각 요소를 이 람다에 전달하고 결과가 `true`인 요소만 다음 단계로 흘려보낸다.

---

## 3.18 스레드와 함수형 프로그래밍을 함께 사용하기

스레드와 람다는 실전 코드에서 자주 함께 등장한다. `Runnable`이 함수형 인터페이스이기 때문이다.

```java
import java.util.ArrayList;
import java.util.List;

public class ThreadLambdaJoinExample {

    public static void main(String[] args) {
        List<Thread> workers = new ArrayList<>();

        for (int i = 1; i <= 3; i++) {
            int taskNumber = i;

            Thread worker = new Thread(() -> {
                System.out.println(
                    taskNumber + "번 작업 시작: "
                        + Thread.currentThread().getName()
                );

                try {
                    Thread.sleep(500);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }

                System.out.println(taskNumber + "번 작업 완료");
            });

            worker.start();
            workers.add(worker);
        }

        for (Thread worker : workers) {
            try {
                worker.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }

        System.out.println("모든 람다 작업이 완료되었습니다.");
    }
}
```

이 코드의 구조는 다음처럼 나눌 수 있다.

```text
람다
→ 실행할 작업을 표현한다.

Runnable
→ 람다가 구현하는 함수형 인터페이스다.

Thread
→ Runnable 작업을 별도 실행 흐름에서 수행한다.

join()
→ 모든 실행 흐름이 끝날 때까지 main 스레드가 기다린다.
```

---

## 4. 적용 관점에서 다시 보기

스레드를 적용해야 하는 신호는 작업들이 서로 독립적으로 진행될 수 있는지, 대기 시간이 긴지, 결과를 어떤 시점에 합쳐야 하는지를 함께 판단하는 것이다.

파일 다운로드, 네트워크 요청, 긴 계산, 여러 파일 처리처럼 main 흐름을 오래 막는 작업은 별도의 작업 스레드 후보가 될 수 있다. 다만 스레드를 직접 많이 생성하면 자원 관리가 어려워질 수 있으므로 실제 프로젝트에서는 `ExecutorService` 같은 스레드 풀을 더 자주 사용한다. 이번 글의 `Thread`와 `Runnable`은 그 구조를 이해하기 위한 기초다.

람다를 적용해야 하는 신호는 추상 메서드 하나를 가진 인터페이스의 짧은 구현이 필요한가이다. `Runnable`, `Comparator`, `Predicate`, `Function`, `Consumer`처럼 동작 하나를 전달하는 인터페이스에서 람다가 자주 사용된다.

스트림은 컬렉션이나 배열 데이터를 여러 단계로 가공할 때 유용하다.

```text
조건에 맞는 데이터만 선택한다.
→ 다른 형태로 변환한다.
→ 정렬하거나 중복을 제거한다.
→ 목록, 배열, 합계 같은 결과를 만든다.
```

다만 스트림을 무조건 사용하는 것이 좋은 것은 아니다. 복잡한 상태 변경, 여러 갈래의 제어 흐름, 중간 디버깅이 중요한 로직에서는 반복문이 더 읽기 쉬울 수 있다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

스레드의 `run()`은 새로운 실행 흐름을 시작하는 메서드가 아니라, 스레드가 수행할 작업 내용을 담는 일반 메서드다. 실제 새 스레드를 시작하는 동작은 `start()`가 담당한다.

또한 `Runnable`은 단순히 `Thread` 상속을 대신하는 문법이 아니다. 실행할 작업과 실행 흐름을 분리하는 인터페이스이며, 추상 메서드가 하나이기 때문에 람다로 표현할 수 있다.

### 5.2 앞으로 이어지는 연결점

스레드 기초는 `ExecutorService`, 스레드 풀, `Callable`, `Future`, `CompletableFuture`로 확장된다. 실제 서버 애플리케이션에서는 매 작업마다 `new Thread()`를 호출하기보다 제한된 수의 스레드를 재사용하고 작업 큐를 관리하는 구조가 중요하다.

람다와 스트림은 Java 컬렉션 처리뿐 아니라 Spring의 각종 콜백, 정렬 기준, 데이터 변환 코드에서도 반복해서 등장한다.

### 5.3 더 파볼 만한 주제

- 스레드 안전성과 경쟁 상태
- `synchronized`, `Lock`, 원자적 연산
- 데몬 스레드와 일반 스레드
- `ExecutorService`와 스레드 풀
- `Callable<V>`와 `Future<V>`
- `CompletableFuture`
- 표준 함수형 인터페이스
- 스트림의 지연 연산
- `map`, `flatMap`, `reduce`, `collect`
- 병렬 스트림의 장단점

---

## 6. 요약 정리

📌 핵심

- 프로세스는 실행 중인 프로그램이고, 스레드는 프로세스 안의 실행 흐름이다.
- Java 프로그램은 기본적으로 main 스레드에서 시작한다.
- `Thread`를 상속하고 `run()`을 구현하면 작업 내용을 정의할 수 있다.
- 새로운 스레드를 만들려면 `run()`을 직접 호출하지 말고 `start()`를 호출해야 한다.
- 여러 스레드의 시작과 종료 순서는 일정하지 않을 수 있다.
- `Thread.sleep()`은 현재 실행 중인 스레드를 일시 정지한다.
- `join()`은 호출한 스레드가 대상 스레드의 종료를 기다리게 한다.
- `Runnable`은 실행할 작업과 스레드 실행 장치를 분리한다.
- `Runnable`은 함수형 인터페이스이므로 람다 표현식으로 구현할 수 있다.
- 람다는 함수형 인터페이스의 추상 메서드 구현을 간결하게 표현한다.
- `@FunctionalInterface`는 추상 메서드가 하나인지 컴파일러가 검사하게 한다.
- 메서드 참조는 이미 존재하는 메서드를 람다 대신 연결하는 표현이다.
- 스트림은 데이터 생성 → 중간 연산 → 최종 연산의 파이프라인으로 읽는다.
- `filter()`는 람다 조건이 `true`인 요소만 다음 단계로 전달한다.
- `boxed()`는 기본형 특화 스트림을 객체 스트림으로 바꾸고, `mapToInt()`는 다시 `IntStream`으로 바꾼다.

🧠 기억할 것

> `run()`은 할 일이고, `start()`는 그 일을 새 스레드에서 시작하는 요청이다.

> `Runnable`은 작업이고, `Thread`는 그 작업을 실행하는 흐름이다.

> 람다는 독립적으로 떠 있는 함수가 아니라, 함수형 인터페이스의 구현으로 해석된다.

> 스트림은 데이터를 저장하는 그릇이 아니라, 데이터가 거칠 처리 단계를 표현하는 파이프라인이다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 프로그램, 프로세스, 스레드의 차이를 각각 설명해보자.
2. Java 애플리케이션을 실행했을 때 `main()` 메서드는 어떤 스레드에서 실행되는가?
3. `Thread` 객체의 `run()`을 직접 호출했을 때 새로운 스레드가 만들어지지 않는 이유는 무엇인가?
4. 여러 스레드를 순서대로 시작해도 출력 순서가 달라질 수 있는 이유는 무엇인가?
5. `Thread.sleep()`은 어떤 스레드를 정지시키는가?
6. `InterruptedException`을 빈 `catch` 블록으로 무시하는 것이 좋지 않은 이유는 무엇인가?
7. `join()`을 호출하는 스레드와 기다림의 대상이 되는 스레드를 구분해서 설명해보자.
8. `Thread` 상속보다 `Runnable` 구현이 더 유연한 이유는 무엇인가?
9. `Runnable`을 람다로 표현할 수 있는 이유는 무엇인가?
10. 함수형 인터페이스에 추상 메서드가 두 개 있으면 람다를 사용할 수 없는 이유는 무엇인가?
11. `@FunctionalInterface`를 붙이지 않아도 람다를 사용할 수 있는 경우가 있는가?
12. `(a, b) -> Integer.sum(a, b)`를 메서드 참조로 바꾸면 어떻게 되는가?
13. 스트림의 생성, 중간 연산, 최종 연산을 예제 코드에서 각각 찾아보자.
14. `filter(number -> number % 2 == 0)`에서 람다가 반환해야 하는 값은 무엇인가?
15. 역순 정렬 예제에서 `boxed()`가 필요한 이유를 설명해보자.
16. `Stream<Integer>`를 최종적으로 `int[]`로 만들기 위해 어떤 변환이 필요한가?
17. 단순 반복문이 스트림보다 더 읽기 좋은 상황에는 어떤 것이 있을까?
18. 스레드 세 개의 종료 후 결과를 합산해야 한다면 어떤 메서드를 고려해야 하는가?

---

## 8. 참고 자료

- WikiDocs, 『점프 투 자바』 07-05 스레드
- WikiDocs, 『점프 투 자바』 07-06 함수형 프로그래밍

이 문서는 위 두 학습 자료의 핵심 흐름을 바탕으로 설명, 코드 주석, 개념 연결, 적용 관점을 보강하여 재구성한 학습 노트다.
