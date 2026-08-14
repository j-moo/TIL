# Java 학습 로드맵

Java를 처음 접하는 사람이 **실행 원리 → 기본 문법 → 데이터 묶기 → 객체지향 → 프로그램의 경계 → 심화 기능** 순서로 이해하도록 기존 강의노트를 재배열했다. 폴더 날짜는 작성 시점을 나타내며, 실제 학습은 아래의 권장 순서를 따른다.

처음 시작한다면 [Java 입문 학습 안내서](./00_08_14_Java_Beginner_Guide/08_14_Java_Beginner_Guide.md)를 가장 먼저 읽는다.

## 권장 학습 로드맵

### 1단계: 실행 환경과 기본 문법

| 순서 | 주제 | 먼저 답할 질문 | 노트 |
| ---: | --- | --- | --- |
| 01 | 코드 구조와 실행 환경 | `.java`는 어떻게 JVM에서 실행되는가? | [코드 구조와 실행 환경](./07_06_Java_Code_Structure_Environment/07_06_Java_Code_Structure_Environment.md) |
| 02 | Java 기초 | 변수, 타입, 연산자, 조건문, 반복문은 어떤 역할을 하는가? | [Hello Java](./07_07_Java_Basics_Hello_Java/07_07_Java_Basics_Hello_Java.md) |
| 03 | 제어문 복습 | 조건과 반복으로 실행 순서를 어떻게 바꾸는가? | [제어문](./07_22_Java_Control_Flow/07_22_Java_Control_Flow.md) |

### 2단계: 문자열과 여러 값 다루기

| 순서 | 주제 | 먼저 답할 질문 | 노트 |
| ---: | --- | --- | --- |
| 04 | 문자열 | 문자열 내용 비교와 변경은 어떻게 하는가? | [String과 StringBuffer](./07_08_Java_String_StringBuffer/07_08_Java_String_StringBuffer.md) |
| 05 | 배열 | 같은 타입의 여러 값을 인덱스로 어떻게 다루는가? | [배열](./07_09_Java_Array/07_09_Java_Array.md) |
| 06 | 컬렉션 | 크기와 목적에 따라 List·Set·Map을 어떻게 고르는가? | [컬렉션 기초](./07_10_Java_Collections_Basics/07_10_Java_Collections_Basics.md) |
| 07 | 제네릭 | 컬렉션과 재사용 코드의 타입 안전성을 어떻게 지키는가? | [제네릭과 타입 안전성](./08_14_Java_Generics_and_Type_Safety/08_14_Java_Generics_and_Type_Safety.md) |

### 3단계: 객체지향 설계

| 순서 | 주제 | 먼저 답할 질문 | 노트 |
| ---: | --- | --- | --- |
| 08 | 클래스와 객체 | 상태와 기능을 하나의 객체로 어떻게 묶는가? | [객체지향 첫걸음](./07_11_Java_OOP_Classes_Objects/07_11_Java_OOP_Classes_Objects.md) |
| 09 | 상속과 인터페이스 | 공통 기능과 역할을 어떻게 표현하고 다형성을 얻는가? | [객체지향 확장](./07_12_Java_OOP_Inheritance_Interface/07_12_Java_OOP_Inheritance_Interface.md) |
| 10 | 패키지와 접근 제어 | 클래스의 소속과 공개 범위를 어떻게 관리하는가? | [패키지와 접근 제어자](./07_14_Java_Package_Access_Modifier/07_14_Java_Package_Access_Modifier.md) |
| 11 | `static`과 싱글톤 | 객체별 상태와 클래스 공유 상태를 어떻게 구분하는가? | [공유 상태와 클래스 기능](./07_15_Java_Static_Singleton/07_15_Java_Static_Singleton.md) |

### 4단계: 프로그램 밖과 연결하기

| 순서 | 주제 | 먼저 답할 질문 | 노트 |
| ---: | --- | --- | --- |
| 12 | 입출력 | 콘솔과 파일에서 데이터를 어떻게 읽고 쓰는가? | [Java 입출력](./07_13_Java_IO_Console_File/07_13_Java_IO_Console_File.md) |
| 13 | 예외 처리 | 실패를 어디에서 처리하고 어디로 전달해야 하는가? | [예외 처리](./07_18_Java_Exception_Handling/07_18_Java_Exception_Handling.md) |

### 5단계: 문제 해결과 심화

| 순서 | 주제 | 먼저 답할 질문 | 노트 |
| ---: | --- | --- | --- |
| 14 | 조건·반복 문제 해결 | 문제를 조건과 반복의 작은 단계로 어떻게 바꾸는가? | [배수 합과 페이지 수](./07_20_Java_Condition_Loop_Problem_Solving/07_20_Java_Condition_Loop_Problem_Solving.md) |
| 15 | 숫자·문자열 순회 | 숫자 자릿수와 문자열 문자를 어떻게 한 칸씩 처리하는가? | [숫자와 문자열 순회](./07_21_Java_Number_and_String_Traversal/07_21_Java_Number_and_String_Traversal.md) |
| 16 | 스레드·람다·스트림 | 동시에 실행되는 작업과 함수형 데이터 처리를 어떻게 이해하는가? | [스레드와 함수형 프로그래밍](./07_19_Java_Thread_and_Functional_Programming/07_19_Java_Thread_and_Functional_Programming.md) |

## 처음 배우는 사람을 위한 읽는 방법

1. 제목 아래의 학습 목표와 핵심 키워드를 먼저 읽는다.
2. 예제를 실행하기 전에 결과를 한 줄로 예상한다.
3. 예제를 직접 입력하고 값 하나를 바꿔 다시 실행한다.
4. 오류가 나면 첫 오류의 파일·줄·원인을 찾는다.
5. 마지막 요약을 보지 않고 핵심 개념을 자신의 말로 설명한다.
6. 복습 문제를 풀지 못하면 다음 단계로 넘어가기 전에 해당 절을 다시 본다.

## 복습 기준

- JDK, 컴파일러, JVM의 역할을 설명할 수 있는가?
- 기본형과 참조형, `==`와 `equals()`의 차이를 설명할 수 있는가?
- 조건문과 반복문의 실행 순서를 손으로 추적할 수 있는가?
- 배열, `List`, `Set`, `Map`을 목적에 따라 선택할 수 있는가?
- 클래스, 객체, 필드, 메서드, 생성자의 관계를 설명할 수 있는가?
- 상속보다 인터페이스가 알맞은 상황을 예로 들 수 있는가?
- 검사 예외와 실행 예외, `throw`와 `throws`를 구분할 수 있는가?
- `List<String>`에서 `<String>`이 제공하는 타입 안전성을 설명할 수 있는가?
- 람다와 스트림의 중간 연산·최종 연산을 구분할 수 있는가?

## 다음에 보강할 주제

현재 노트 이후에는 다음 순서로 확장할 수 있다.

1. `equals()`, `hashCode()`, 불변 객체
2. `enum`, `record`, 봉인 클래스
3. 날짜와 시간 API
4. NIO.2와 경로·파일 처리
5. 동시성 도구와 가상 스레드
6. JUnit 기반 단위 테스트

새 주제는 문법 자체보다 “어떤 문제를 해결하고 기존 개념과 어떻게 연결되는가”를 중심으로 추가한다.
