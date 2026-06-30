# String - 코드 체계, 문자열 연산, 패턴 매칭, 암호화와 압축

- 🎯 글의 목표: 문자가 숫자와 바이트로 표현되는 원리부터 Python 문자열 처리, 패턴 매칭, 간단한 암호화와 압축까지 하나의 흐름으로 이해하고 직접 구현한다.
- 🧩 핵심 키워드: ASCII, Unicode, UTF-8, UTF-16, endian, `str`, `bytes`, 인코딩, 불변성, 회문, 브루트 포스, KMP, LPS, Boyer-Moore, Caesar cipher, 치환 암호, run-length encoding
- ⭐ 중요도: ★★★★★  문자열은 입력 처리와 탐색 문제의 기본 자료형이며, 인덱스·경계·전처리 개념은 이후 배열과 탐색 알고리즘에도 그대로 이어진다.
- 📝 한눈에 보는 내용: 문자를 코드 포인트로 정하는 코드 체계와 실제 바이트로 바꾸는 인코딩을 구분한 뒤, Python 문자열의 저장 방식과 시퀀스 연산을 익힌다. 이어서 뒤집기·회문·비교·수 변환을 구현하고, 단순 검색에서 KMP와 Boyer-Moore로 발전하는 이유를 살핀다. 마지막에는 문자열 변환의 응용인 시저 암호, 단일 치환 암호, 전사 공격, 실행 길이 압축을 다룬다.
- 🔗 관련 문제 / 주제: SWEA 4865 글자수, 4864 문자열 비교, 3143 가장 빠른 문자열 타이핑, 1989 초심자의 회문 검사, 4861 회문, 5356 의석이의 세로로 말해요, 5432 쇠막대기 자르기
---

## 1. 들어가며

컴퓨터 메모리에는 문자 모양이 그대로 들어가지 않는다.
결국 저장되는 것은 비트이고, 프로그램은 그 비트를 어떤 문자로 해석할지 약속해야 한다.
그래서 문자열을 제대로 이해하려면 먼저 세 층을 구분해야 한다.
1. 어떤 문자에 어떤 번호를 줄 것인가
2. 그 번호를 어떤 바이트열로 바꿀 것인가
3. 여러 문자를 어떤 자료구조와 연산으로 다룰 것인가
첫 번째 질문이 ASCII와 Unicode 같은 **코드 체계**이고, 두 번째 질문이 UTF-8·UTF-16 같은 **인코딩**이다.
세 번째 질문에 답하는 것이 Python의 `str`, 인덱싱, 슬라이싱, 비교, 탐색 알고리즘이다.
이 구분이 없으면 “Unicode와 UTF-8은 같은가?”, “문자열 길이와 바이트 수는 왜 다른가?”, “파일을 열었더니 왜 글자가 깨지는가?” 같은 질문에 답하기 어렵다.
문자열 알고리즘의 핵심도 같은 흐름 위에 있다.
문자에 순서와 번호가 있으므로 비교할 수 있고, 문자열이 시퀀스이므로 인덱스로 접근할 수 있으며, 이미 비교한 정보를 기억하면 같은 문자를 다시 확인하지 않을 수 있다.
이번 노트는 강의 순서를 따라 코드 체계에서 출발해 문자열, 연산, 패턴 매칭, 암호화, 압축으로 이어진다.
강의 슬라이드와 실습 코드에는 학습 과정에서 의도적으로 비어 있거나 오해하기 쉬운 부분이 있다.
특히 `글자수.py`의 실제 계수 로직과 `회문.py`의 세로 탐색이 빠져 있으므로, 본문에서는 문제의 불변식과 경계를 설명한 뒤 완성된 코드 하나로 교정한다.
---

## 2. 핵심 개념 정리

이번 강의는 “문자열을 컴퓨터가 어떻게 표현하고, 원하는 문자열을 어떻게 효율적으로 찾고 바꾸는가?”라는 질문을 단계적으로 해결한다.
먼저 코드 체계의 필요성을 살핀다.
지역마다 다른 숫자를 문자에 부여하면 정보를 교환할 때 같은 바이트를 다르게 읽을 수 있다.
ASCII는 영문 중심의 공통 약속을 만들었고, Unicode는 전 세계의 문자와 기호를 하나의 문자 집합 안에서 다루도록 범위를 넓혔다.
Unicode 번호는 다시 UTF 인코딩을 통해 바이트열이 된다.
여기서는 바이트 순서인 endian과 Python의 `str`·`bytes`, `encode()`·`decode()`가 연결된다.
그다음 문자열을 순서가 있는 불변 시퀀스로 본다.
입력, 인덱싱, 슬라이싱, 연결, 반복, 메서드를 이용해 값을 읽고, 수정이 필요하면 리스트나 새 문자열을 만든다.
기본 연산에서는 뒤집기, 회문, 값 비교와 객체 동일성, 사전식 비교, 숫자 변환을 구현한다.
여기서 익힌 인덱스 대칭과 구간 경계는 2차원 회문 검색으로 확장된다.
패턴 매칭은 같은 문제를 서로 다른 수준의 정보 재사용으로 푼다.

- 브루트 포스는 가능한 시작 위치를 모두 확인한다.
- KMP는 패턴 자체의 접두사·접미사 정보를 LPS에 저장한다.
- Boyer-Moore의 bad-character 휴리스틱은 오른쪽부터 비교하고 불일치 문자로 점프 거리를 정한다.
마지막으로 문자 치환을 응용한다.
시저 암호와 단일 치환 암호는 키 공간과 공격 방법을 비교하게 하고, 실행 길이 압축은 연속 반복을 `(문자, 횟수)`로 요약하는 방법을 보여준다.
---

## 3. 본문 정리

### 3.1 코드 체계: 문자를 숫자로 표현하는 약속

코드 체계는 **문자에 고유한 숫자를 대응시키는 규칙**이다.
메모리는 숫자를 비트로 저장할 수 있으므로, 문자 `A`도 먼저 숫자로 바꿔야 한다.
초기 시스템이 지역마다 다른 규칙을 쓰면 같은 비트열이 서로 다른 문자로 해석되는 문제가 생긴다.
예를 들어 한 지역에서 `000000`을 `a`로, 다른 지역에서 `A`로 정했다면 파일을 주고받을 때 원문을 보존할 수 없다.
표준 코드 체계가 필요한 이유는 저장 자체보다 **교환한 데이터를 같은 의미로 읽기 위해서**다.
Python에서는 `ord()`와 `chr()`로 문자와 코드 포인트의 관계를 확인할 수 있다.
```python
letter = "A"
# 문자 하나가 가진 Unicode 코드 포인트를 정수로 얻는다.
code_point = ord(letter)
print(code_point)
# 정수 코드 포인트를 다시 문자로 바꾼다.
restored = chr(65)
print(restored)
```
실행 결과는 다음과 같다.
```text
65
A
```
`ord()`는 정확히 길이 1인 문자열을 받아야 한다.
`chr()`는 유효한 Unicode 코드 포인트 범위의 정수를 받아 문자를 만든다.
⚠️ 주의: 코드 포인트는 문자에 붙은 추상적인 번호다. 그 번호가 파일이나 네트워크에 저장되는 실제 바이트열과 항상 같지는 않다.
📌 핵심: 코드 체계는 “어떤 문자에 어떤 번호를 줄 것인가”에 대한 약속이다.
### 3.2 ASCII와 확장 ASCII

ASCII는 American Standard Code for Information Interchange의 약자다.
표준 ASCII는 7비트를 사용하므로 `0`부터 `127`까지 128개 값을 표현한다.
이 가운데 `0`부터 `31`, 그리고 `127`은 제어 문자이고, 나머지에는 공백·숫자·영문자·기호가 배치된다.
대표 값은 다음과 같다.
| 문자 | 10진수 | 16진수 |
|---|---:|---:|
| 공백 | 32 | `0x20` |
| `0` | 48 | `0x30` |
| `9` | 57 | `0x39` |
| `A` | 65 | `0x41` |
| `Z` | 90 | `0x5A` |
| `a` | 97 | `0x61` |
| `z` | 122 | `0x7A` |
영문 대문자가 연속된 값이라는 사실은 배열 인덱스를 만들 때 유용하다.
```python
letter = "C"
# 'A'를 0번으로 보았을 때 C는 2번이다.
index = ord(letter) - ord("A")
print(index)
```
실행 결과는 `2`다.
확장 ASCII라는 이름은 8비트의 나머지 128개 값에 문자를 더 배치한 여러 코드 페이지를 통칭한다.
중요한 점은 확장 ASCII가 하나의 전 세계 공통 표준이 아니라는 것이다.
코드 페이지마다 `128` 이상 값의 의미가 달랐기 때문에, 문서를 만든 환경과 읽는 환경이 다르면 문자가 깨질 수 있었다.
⚠️ 주의: `ord(c) - 65`는 입력이 `A`부터 `Z`까지라는 조건이 있을 때만 안전하다. 소문자·한글·기호가 들어오면 음수나 25보다 큰 인덱스가 생긴다.
### 3.3 Unicode: 문자 집합을 하나로 통합하기

Unicode는 전 세계 문자와 기호에 일관된 코드 포인트를 부여하는 표준이다.
표기는 보통 `U+` 뒤에 16진수를 붙인다.

- `A`는 `U+0041`이다.
- `€`는 `U+20AC`다.
- `한`은 `U+D55C`다.
Python 문자열 리터럴에서도 Unicode escape를 사용할 수 있다.
```python
print("\u0041")
print("\uD55C")
print("\U0001F600")
```
실행 결과는 각각 `A`, `한`, `😀`이다.
Unicode에는 이모지도 포함된다.
다만 “사용자가 한 글자라고 느끼는 단위”, “Unicode 코드 포인트 수”, “인코딩된 바이트 수”는 서로 다를 수 있다.
결합 문자나 이모지 조합은 여러 코드 포인트가 화면에서 하나처럼 보이기도 한다.
Unicode 초기에 UCS-2와 UCS-4처럼 고정 폭 코드 단위를 논의했지만, 문자 번호만 정해서는 파일의 바이트 표현과 바이트 순서를 완전히 해결할 수 없었다.
그래서 Unicode 코드 포인트를 외부 바이트열로 바꾸는 UTF 계열 인코딩이 필요하다.
### 3.4 Endian: 여러 바이트를 저장하는 순서

Endian은 여러 바이트로 된 값을 메모리나 파일에 어떤 순서로 놓는지 나타낸다.
예를 들어 16진수 값 `0x0030`은 두 바이트 `00`과 `30`으로 나뉜다.

- big-endian은 상위 바이트 `00`을 낮은 주소에 둔다.
- little-endian은 하위 바이트 `30`을 낮은 주소에 둔다.
같은 두 바이트를 순서 정보 없이 읽으면 `0x0030`과 `0x3000`처럼 전혀 다른 값이 될 수 있다.
UTF-16과 UTF-32 파일에서는 endian 구분이 실제 해석에 영향을 준다.
BOM(Byte Order Mark)은 파일 앞에서 인코딩과 바이트 순서를 알리는 표식으로 쓰일 수 있다.
UTF-16 big-endian BOM은 `FE FF`, little-endian BOM은 `FF FE`다.
UTF-8은 한 코드 단위 안의 바이트 순서가 인코딩 규칙으로 고정되어 있으므로 endian 선택이 없다.
UTF-8 BOM `EF BB BF`가 존재하기는 하지만 바이트 순서 표시가 목적은 아니며, 환경에 따라 불필요한 문자처럼 처리될 수 있다.
⚠️ 주의: endian은 문자 순서를 뒤집는 개념이 아니다. 하나의 다중 바이트 값을 구성하는 바이트의 배치 순서다.
### 3.5 UTF-8, UTF-16, UTF-32

UTF는 Unicode Transformation Format의 약자다.
Unicode 코드 포인트를 저장하거나 전송할 코드 단위의 열로 변환한다.
| 인코딩 | 코드 단위 | 코드 포인트당 크기 | 특징 |
|---|---:|---:|---|
| UTF-8 | 8비트 | 1~4바이트 | ASCII와 바이트 수준 호환, 웹과 파일에서 널리 사용 |
| UTF-16 | 16비트 | 2 또는 4바이트 | BMP 밖 문자는 surrogate pair 사용 |
| UTF-32 | 32비트 | 4바이트 | 고정 폭이지만 공간 사용량이 큼 |
UTF-8의 선두 비트 형태는 길이를 알려준다.
```text
0xxxxxxx
110xxxxx 10xxxxxx
1110xxxx 10xxxxxx 10xxxxxx
11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
```
ASCII 범위 문자는 UTF-8에서 그대로 1바이트다.
한글 `한`은 UTF-8에서 `ED 95 9C` 세 바이트가 된다.
```python
text = "A한"
utf8 = text.encode("utf-8")
utf16_be = text.encode("utf-16-be")
print(utf8)
print(utf8.hex(" "))
print(utf16_be.hex(" "))
```
실행 결과는 다음과 같다.
```text
b'A\xed\x95\x9c'
41 ed 95 9c
00 41 d5 5c
```
문자열 길이와 바이트 길이도 구분해야 한다.
```python
name = "홍길동"
print(len(name))
print(len(name.encode("utf-8")))
print(len(name.encode("utf-16-le")))
```
일반적인 결과는 `3`, `9`, `6`이다.
강의 슬라이드의 C 예시에서 `strlen(name)`이 `6`인 것은 한글 한 글자를 2바이트로 저장한 특정 레거시 인코딩을 전제한 설명이다.
UTF-8 소스의 동일 바이트열이라면 C의 `strlen`은 널 문자 전까지 바이트를 세므로 `9`가 된다.
또한 “Python 3 문자열은 UTF-8로 저장된다”는 표현은 엄밀히는 맞지 않는다.
Python 3의 `str`은 Unicode 텍스트 객체이고, UTF-8은 `str`을 파일이나 네트워크용 `bytes`로 바꿀 때 선택하는 인코딩이다.
📌 핵심: Unicode는 문자 번호의 표준이고, UTF는 그 번호를 코드 단위와 바이트로 표현하는 규칙이다.
### 3.6 Python의 인코딩: `str`, `bytes`, `encode`, `decode`

Python 3에서 텍스트와 바이트는 다른 자료형이다.

- `str`은 Unicode 텍스트다.
- `bytes`는 `0`부터 `255`까지 정수의 불변 시퀀스다.
`encode()`는 텍스트를 바이트로, `decode()`는 바이트를 텍스트로 바꾼다.
```python
text = "문자열"
# 프로그램 내부의 Unicode 텍스트를 UTF-8 바이트열로 직렬화한다.
payload = text.encode("utf-8")
# 같은 규칙으로 바이트열을 해석해 원래 텍스트를 복원한다.
restored = payload.decode("utf-8")
print(type(text), text)
print(type(payload), payload)
print(restored)
```
인코딩과 디코딩 규칙이 다르면 오류가 나거나 글자가 깨진다.
```python
payload = "한".encode("utf-8")
try:
    print(payload.decode("ascii"))
except UnicodeDecodeError as error:
    print(type(error).__name__)
```
Python 3 소스 파일의 기본 인코딩은 UTF-8이다.
다른 소스 인코딩을 쓸 때는 첫째 또는 둘째 줄에 PEP 263 형식의 선언을 둘 수 있지만, 현대 Python 코드에서는 UTF-8을 유지하는 편이 안전하다.
```python
# -*- coding: cp949 -*-
```
이 선언은 **소스 코드 파일 자체를 읽는 인코딩**을 정한다.
프로그램이 여는 데이터 파일의 인코딩은 별도로 지정해야 한다.
```python
with open("message.txt", "r", encoding="utf-8") as file:
    text = file.read()
```
Windows의 줄바꿈은 보통 CRLF(`\r\n`), Unix 계열은 LF(`\n`)를 사용한다.
줄바꿈 규칙과 문자 인코딩은 서로 다른 문제지만, 텍스트 파일을 바이트 단위로 비교할 때는 둘 다 차이를 만든다.
⚠️ 주의: `str(bytes_value)`는 디코딩이 아니다. 예를 들어 `str(b'A')`는 문자 `A`가 아니라 표현 문자열 `"b'A'"`를 만든다. 바이트를 텍스트로 해석하려면 `decode()`를 사용한다.
### 3.7 문자열 저장 방식과 Python `str` 객체

문자열 저장 방식은 크게 길이 기반과 구분자 기반으로 볼 수 있다.
Length-Controlled 문자열은 길이를 함께 저장하고 그만큼 읽는다.
Delimited 문자열은 종료 구분자를 만날 때까지 읽는다.
C의 문자열은 문자 배열 끝에 널 문자 `\0`을 두는 대표적인 구분자 기반 방식이다.
```c
char text[] = {'a', 'b', 'c', '\0'};
```
Java와 Python의 문자열 객체는 길이 정보를 관리한다.
따라서 문자열 내부에 널 문자가 있어도 그 지점에서 Python 문자열이 끝나지 않는다.
```python
text = "A\0B"
print(len(text))
print(repr(text))
```
실행 결과는 `3`과 `'A\x00B'`다.
CPython의 구체적인 `str` 구현에는 객체 헤더, 길이, 해시 캐시, intern 상태, 문자 저장 폭을 나타내는 정보 등이 들어간다.
PEP 393의 유연한 문자열 표현은 문자열에 필요한 가장 작은 1·2·4바이트 폭을 선택할 수 있게 한다.
이는 구현 세부 사항이며 Python 언어 차원에서 특정 내부 바이트 인코딩을 보장한다는 뜻은 아니다.
딕셔너리 키로 쓸 수 있도록 문자열은 해시 가능하고, 같은 문자열을 재사용하는 interning 최적화가 적용될 수도 있다.
그러나 `is` 결과에 interning을 기대해서는 안 된다.
### 3.8 Python 문자열은 불변 시퀀스다

문자열은 문자들이 순서대로 나열된 시퀀스다.
따라서 길이, 멤버십, 인덱싱, 슬라이싱, 반복을 사용할 수 있다.
```python
text = "abcde"
print(len(text))
print(text[0])
print(text[-1])
print(text[1:4])
print("bc" in text)
print(text + "!")
print("ab" * 3)
```
실행 결과는 다음과 같다.
```text
5
a
e
bcd
True
abcde!
ababab
```
문자열은 불변이므로 인덱스의 문자를 직접 바꿀 수 없다.
```python
text = "abc"
# text[1] = "X"  # TypeError: 'str' object does not support item assignment
```
수정이 필요하면 새 문자열을 만들거나 리스트로 바꿨다가 다시 결합한다.
```python
chars = list("abc")
chars[1] = "X"
text = "".join(chars)
print(text)
```
`replace()`, `split()`, `isalpha()`, `find()` 같은 메서드도 자주 사용한다.
`replace()` 역시 원본을 바꾸지 않고 새 문자열을 반환한다.
⚠️ 주의: 반복문 안에서 `result += char`를 계속 수행하면 문자열 불변성 때문에 중간 문자열이 반복 생성될 수 있다. 데이터가 크면 조각을 리스트에 모아 마지막에 `"".join(parts)`로 합치는 편이 효율적이다.
### 3.9 문자열 입력과 1차원·2차원 표현

`input()`은 줄바꿈을 제외한 한 줄을 `str`로 읽는다.
중간 공백은 보존된다.
```python
text = input()
```
각 문자를 수정해야 한다면 리스트로 바꿔 받는다.
```python
chars = list(input())
```
`N × N` 문자 격자는 다음처럼 읽는다.
```python
n = int(input())
# 읽기만 할 때는 각 행을 문자열로 보관해도 text[row][col] 접근이 가능하다.
text = [input() for _ in range(n)]
```
격자의 문자를 바꿔야 하면 각 행을 리스트로 만든다.
```python
n = int(input())
board = [list(input()) for _ in range(n)]
```
두 표현 모두 `board[row][col]` 형태로 읽을 수 있지만, 문자열 행은 수정할 수 없고 리스트 행은 수정할 수 있다.
강의의 입력 연습은 같은 입력 표현에서 서로 다른 순회를 끌어내는 문제다.
#### 연습 1: `s1`의 모든 글자가 `s2`에 존재하는가

```python
s1 = input()
s2 = input()
answer = all(char in s2 for char in s1)
print(answer)
```
중복 여부까지 세어야 하는 문제라면 단순 멤버십이 아니라 빈도표가 필요하다.
#### 연습 2: `N × N` 격자에 특정 문자가 존재하는가

```python
n = int(input())
text = [input() for _ in range(n)]
target = input()
found = any(target in row for row in text)
print(found)
```
#### 연습 3: `#` 피해 구역 수 세기

```python
n = int(input())
grid = [input() for _ in range(n)]
damaged = 0
for row in grid:
    for cell in row:
        if cell == "#":
            damaged += 1
print(damaged)
```
#### 연습 4: 가로·세로 `AB` 패턴 존재 여부

```python
n = int(input())
grid = [input() for _ in range(n)]
found = False
for row in range(n):
    for col in range(n):
        # 오른쪽 이웃을 볼 때는 col + 1이 범위 안인지 먼저 확인한다.
        if col + 1 < n and grid[row][col:col + 2] == "AB":
            found = True
        # 아래쪽 두 문자를 직접 조합해 세로 패턴을 검사한다.
        if row + 1 < n and grid[row][col] + grid[row + 1][col] == "AB":
            found = True
print(found)
```
#### 연습 5: 로봇이 상하좌우로 이동할 수 있는 칸 수

```python
n = int(input())
maze = [input() for _ in range(n)]
robot_row = robot_col = -1
for row in range(n):
    for col in range(n):
        if maze[row][col] == "#":
            robot_row, robot_col = row, col
movable = 0
for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
    nr = robot_row + dr
    nc = robot_col + dc
    if 0 <= nr < n and 0 <= nc < n and maze[nr][nc] == "0":
        movable += 1
print(movable)
```
⚠️ 주의: 입력을 문자열 행으로 둘지 문자 리스트로 둘지는 “수정하는가?”를 기준으로 정한다. 무조건 리스트로 바꾸면 메모리와 코드만 늘 수 있다.
### 3.10 글자수: 존재표와 빈도표를 분리하기

SWEA 4865 글자수는 `s1`의 글자 가운데 `s2`에 가장 많이 등장한 글자의 횟수를 구한다.
입력은 테스트 케이스 수와 두 문자열이고, 출력은 각 테스트 케이스의 최대 빈도다.
실습 `글자수.py`는 `s1_count`에 존재 표시만 한 뒤 `s2` 순회와 `max_count` 갱신이 비어 있다.
핵심 불변식은 `s2_count[i]`가 지금까지 확인한 `s2` 구간에서 `i`번 알파벳이 나온 횟수라는 것이다.
```python
t = int(input())
for tc in range(1, t + 1):
    s1 = input().strip()
    s2 = input().strip()
    # 문제 조건이 영문 대문자이므로 A~Z를 0~25에 대응시킨다.
    in_s1 = [False] * 26
    for char in s1:
        in_s1[ord(char) - ord("A")] = True
    counts = [0] * 26
    max_count = 0
    for char in s2:
        index = ord(char) - ord("A")
        # s1에 포함된 문자만 세면 불필요한 빈도를 저장하지 않아도 된다.
        if in_s1[index]:
            counts[index] += 1
            max_count = max(max_count, counts[index])
    print(f"#{tc} {max_count}")
```
예를 들어 `s1 = "XYPV"`, `s2 = "EOGGXYPVSY"`라면 `Y`가 두 번이고 나머지 대상 문자는 한 번씩이므로 답은 `2`다.
시간 복잡도는 `O(len(s1) + len(s2))`, 추가 공간은 알파벳 크기가 고정되어 `O(1)`이다.
종료 조건은 `s2`의 모든 문자를 처리한 시점이다.
⚠️ 주의: 존재표 `in_s1`에는 `0/1` 또는 `False/True`만 저장한다. 이것만 만들고 끝내면 `s2`의 실제 횟수를 알 수 없다. 실습 원본이 멈춘 지점이 바로 이 구분이다.
### 3.11 문자열 뒤집기

문자열 뒤집기는 마지막 문자부터 첫 문자까지 역순으로 새 문자열을 만드는 연산이다.
Python에서는 슬라이싱이 가장 간결하다.
```python
text = "Reverse this strings"
reversed_text = text[::-1]
print(reversed_text)
```
실행 결과는 다음과 같다.
```text
sgnirts siht esreveR
```
인덱스 이동을 연습하려면 실습 코드처럼 직접 구현할 수 있다.
```python
text = "Reverse this strings"
parts = []
# 마지막 인덱스 len(text)-1부터 0까지 감소한다.
for index in range(len(text) - 1, -1, -1):
    parts.append(text[index])
reversed_text = "".join(parts)
print(reversed_text)
```
`range(start, stop, step)`에서 `stop`은 포함되지 않으므로 0번까지 방문하려면 `stop`을 `-1`로 둔다.
리스트의 `reverse()`는 원본 리스트를 제자리에서 뒤집고 `None`을 반환한다.
```python
chars = list("abcd")
chars.reverse()
text = "".join(chars)
print(text)
```
⚠️ 주의: `text = text.reverse()`는 문자열에는 메서드가 없어 실패한다. `chars = chars.reverse()`도 `chars`에 `None`을 넣으므로 잘못이다.
### 3.12 회문 검사: 절반만 비교하기

회문은 앞에서 읽은 결과와 뒤에서 읽은 결과가 같은 문자열이다.
전체를 뒤집어 비교할 수도 있지만, 대칭 위치만 확인하면 새 문자열 없이 판별할 수 있다.
길이가 `n`일 때 `i`의 대칭 인덱스는 `n - 1 - i`다.
가운데 문자는 자기 자신과 같으므로 `n // 2`번만 비교한다.
```python
def is_palindrome(text):
    """문자열이 회문이면 True, 아니면 False를 반환한다."""
    n = len(text)
    for left in range(n // 2):
        right = n - 1 - left
        # 한 쌍이라도 다르면 이후 비교 결과와 무관하게 회문이 아니다.
        if text[left] != text[right]:
            return False
    # 모든 대칭 쌍이 같았을 때만 도달한다.
    return True
print(is_palindrome("토마토"))
print(is_palindrome("algorithm"))
```
실행 결과는 `True`, `False`다.
시간 복잡도는 `O(n)`, 추가 공간은 `O(1)`이다.
빈 문자열과 길이 1인 문자열은 비교할 쌍이 없으므로 이 정의에서는 회문이다.
실습 `초심자의회문.py`는 `for ... else`를 사용한다.
`else`는 반복이 `break` 없이 끝났을 때 실행되므로 올바른 접근이지만, 함수에서는 불일치 즉시 `return False`하는 방식이 종료 조건을 더 직접적으로 드러낸다.
### 3.13 `N × N` 격자에서 길이 `M` 회문 찾기

SWEA 4861 회문은 모든 행과 열에서 길이 `M`인 회문을 찾는다.
시작 인덱스가 `start`일 때 마지막 인덱스는 `start + M - 1`이다.
따라서 가능한 시작점은 `0`부터 `N - M`, 즉 `range(N - M + 1)`이다.
실습 `회문.py`는 가로 검색만 작성되어 있고 세로 검색이 비어 있다.
가로와 세로를 같은 후보 생성 함수로 다루면 누락을 줄일 수 있다.
```python
def is_palindrome(text):
    for index in range(len(text) // 2):
        if text[index] != text[-1 - index]:
            return False
    return True
t = int(input())
for tc in range(1, t + 1):
    n, m = map(int, input().split())
    board = [input().strip() for _ in range(n)]
    answer = ""
    for fixed in range(n):
        for start in range(n - m + 1):
            # fixed행에서 길이 m인 가로 후보를 만든다.
            horizontal = board[fixed][start:start + m]
            if is_palindrome(horizontal):
                answer = horizontal
                break
            # fixed열에서 start행부터 길이 m인 세로 후보를 만든다.
            vertical = "".join(
                board[row][fixed]
                for row in range(start, start + m)
            )
            if is_palindrome(vertical):
                answer = vertical
                break
        if answer:
            break
    print(f"#{tc} {answer}")
```
입력은 `N`, `M`, 그리고 `N`개의 길이 `N`인 문자열이다.
출력은 발견한 길이 `M`의 회문이다.
후보 하나의 회문 판별이 `O(M)`이고 후보 수가 가로·세로 각각 `N(N-M+1)`이므로 최악 시간은 `O(N(N-M+1)M)`이다.
코드의 불변식은 `fixed`와 `start`보다 앞선 모든 후보가 회문이 아니라는 것이다.
종료 조건은 첫 회문을 찾았거나 모든 후보를 확인한 경우다.
실습 `정사각형.py`의 `range(N - M + 1)`도 같은 경계 원리를 연습한다.
크기 `M`인 창의 마지막 칸이 `N - 1`을 넘지 않으려면 시작점은 최대 `N - M`이어야 한다.
⚠️ 주의: 가로 답을 찾은 뒤 내부 반복만 `break`하면 바깥 반복이 계속되어 답이 덮어써질 수 있다. `answer`를 확인해 바깥 반복도 종료해야 한다.
### 3.14 문자열 비교: `==`와 `is`

`==`는 두 객체의 값이 같은지 비교한다.
`is`는 두 변수가 정확히 같은 객체를 가리키는지 비교한다.
```python
first = [1, 2, 3]
second = [1, 2, 3]
alias = first
print(first == second)
print(first is second)
print(first is alias)
```
실행 결과는 다음과 같다.
```text
True
False
True
```
문자열 리터럴은 구현 최적화로 같은 객체가 될 때도 있지만, 이를 프로그램 논리로 사용하면 안 된다.
문자열 내용 비교는 항상 `==`와 `!=`를 사용한다.
C에서는 `strcmp()`가 문자열 내용을 비교하고, Java에서는 `equals()`가 내용을 비교한다.
Java의 `==`는 참조 비교이므로 Python의 `is`와 역할이 가깝다.
⚠️ 주의: `None`은 싱글턴이므로 `value is None`처럼 정체성 비교가 권장되지만, 문자열 값은 `text == "abc"`로 비교한다.
### 3.15 사전식 비교와 Unicode 순서

Python의 문자열 비교 연산자는 왼쪽부터 코드 포인트를 비교한다.
처음 다른 문자의 코드 포인트가 작은 문자열이 앞선다.
한 문자열이 다른 문자열의 접두사라면 짧은 문자열이 앞선다.
```python
def my_strcmp(first, second):
    """first가 앞서면 -1, 같으면 0, 뒤면 1을 반환한다."""
    if first < second:
        return -1
    if first > second:
        return 1
    return 0
print(my_strcmp("Apple", "apple"))
print("Zebra" < "apple")
```
대문자 `A`부터 `Z`의 코드 포인트가 소문자 `a`보다 작으므로 두 결과는 각각 `-1`, `True`다.
이 비교는 자연어 사전의 언어별 정렬 규칙과 같지 않다.
대소문자를 무시하려면 `casefold()`로 비교용 값을 만들 수 있다.
```python
print("Straße".casefold() == "STRASSE".casefold())
```
### 3.16 문자열과 숫자 사이의 변환

문자열을 정수나 실수로 바꿀 때 `int()`와 `float()`를 사용한다.
```python
decimal = int("123")
real = float("3.14")
hexadecimal = int("A0", 16)
print(decimal, real, hexadecimal)
```
실행 결과는 `123 3.14 160`이다.
`int(text, base)`의 `base`는 문자열을 몇 진법으로 해석할지 지정한다.
반대로 숫자를 문자열로 바꿀 때는 `str()`을 사용한다.
```python
integer_text = str(123)
float_text = str(3.14)
```
직접 10진수 문자열을 정수로 바꾸면 자릿값 원리를 확인할 수 있다.
```python
def parse_nonnegative_decimal(text):
    value = 0
    for char in text:
        if not "0" <= char <= "9":
            raise ValueError("10진수 숫자가 아닌 문자가 포함되었습니다.")
        digit = ord(char) - ord("0")
        value = value * 10 + digit
    return value
```
불변식은 지금까지 읽은 접두사 문자열의 정수 값이 `value`에 저장되어 있다는 것이다.
⚠️ 주의: `int(3.14)`는 실수를 버림 방향으로 정수화하고, `int("3.14")`는 문자열이 정수 형식이 아니어서 `ValueError`가 난다.
### 3.17 고지식한 패턴 검색: 모든 시작 위치 확인하기

패턴 매칭은 텍스트 `text` 안에서 패턴 `pattern`이 시작하는 위치를 찾는 문제다.
브루트 포스는 가능한 시작 위치마다 패턴의 문자를 왼쪽부터 비교한다.
텍스트 길이를 `n`, 패턴 길이를 `m`이라 하면 시작점은 `0`부터 `n - m`까지다.
```python
def brute_force_search(text, pattern):
    """첫 매칭의 시작 인덱스를 반환하고, 없으면 -1을 반환한다."""
    n = len(text)
    m = len(pattern)
    # 빈 패턴은 Python의 find와 같이 0에서 일치한다고 정의한다.
    if m == 0:
        return 0
    for start in range(n - m + 1):
        for offset in range(m):
            if text[start + offset] != pattern[offset]:
                # 현재 시작점은 실패했으므로 다음 시작점으로 이동한다.
                break
        else:
            # break 없이 m개 문자가 모두 일치했다.
            return start
    return -1
print(brute_force_search("TTTTTAACCA", "TTAT"))
print(brute_force_search("abracadabra", "cada"))
```
두 결과는 `-1`, `4`다.
입력은 텍스트와 패턴, 출력은 첫 시작 인덱스 또는 `-1`이다.
내부 반복의 불변식은 `pattern[:offset]`이 `text[start:start+offset]`과 일치한다는 것이다.
종료 조건은 전체 패턴이 일치했거나 모든 시작점을 검사한 경우다.
최악에는 `n-m+1`개 시작점에서 `m`개 문자를 비교하므로 `O((n-m+1)m)`, 보통 `O(nm)`으로 쓴다.
추가 공간은 `O(1)`이다.
강의의 두 포인터 구현은 불일치 때 `i = i - j`, `j = -1`로 되돌린 뒤 공통 증가를 수행한다.
동작은 맞지만 시작점과 패턴 오프셋을 분리한 위 코드가 경계와 불변식을 더 쉽게 읽게 한다.
⚠️ 주의: `range(n - m)`으로 쓰면 마지막 가능한 시작점 `n - m`을 검사하지 않는다. 길이가 같은 텍스트와 패턴도 검사하려면 반드시 `+1`이 필요하다.
### 3.18 KMP가 필요한 이유

브루트 포스는 불일치가 생기면 이미 맞았던 문자도 다음 시작점에서 다시 비교한다.
KMP는 Knuth, Morris, Pratt가 고안한 알고리즘으로, 패턴 안의 반복 구조를 미리 계산해 이 중복을 줄인다.
예를 들어 패턴 `abcdabce`에서 `abcdabc`까지 맞고 마지막 `e`에서 실패했다고 하자.
이미 맞은 접미사 `abc`가 패턴의 접두사 `abc`와 같다는 사실을 알고 있다.
따라서 텍스트 포인터를 뒤로 돌리지 않고, 패턴 포인터만 `abc` 다음 위치로 이동해 비교를 이어갈 수 있다.
이 “실패했을 때 패턴 안에서 어디로 돌아갈지”를 LPS 배열에 저장한다.
### 3.19 LPS 배열 만들기

LPS는 Longest Proper Prefix which is also Suffix의 약자다.
`lps[i]`는 `pattern[:i+1]`에서 접두사이면서 접미사인 가장 긴 **진부분 문자열**의 길이다.
진접두사는 문자열 전체와 같지 않은 접두사다.
패턴 `ABABCABAB`의 LPS는 다음과 같다.
| 인덱스 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 문자 | A | B | A | B | C | A | B | A | B |
| LPS | 0 | 0 | 1 | 2 | 0 | 1 | 2 | 3 | 4 |
```python
def build_lps(pattern):
    lps = [0] * len(pattern)
    # length는 직전 위치까지 확인한 최장 접두사=접미사 길이다.
    length = 0
    index = 1
    while index < len(pattern):
        if pattern[index] == pattern[length]:
            length += 1
            lps[index] = length
            index += 1
        elif length > 0:
            # index는 유지한다. 더 짧은 후보 경계로 돌아가 같은 문자를 다시 본다.
            length = lps[length - 1]
        else:
            # 일치하는 비어 있지 않은 경계가 없다.
            lps[index] = 0
            index += 1
    return lps
print(build_lps("ABABCABAB"))
```
실행 결과는 `[0, 0, 1, 2, 0, 1, 2, 3, 4]`다.
불일치인데 `length > 0`일 때 `index`를 증가시키지 않는 것이 핵심이다.
현재 문자와 더 짧은 접두사 후보를 아직 비교하지 않았기 때문이다.
전처리 시간은 `O(m)`, LPS 공간은 `O(m)`이다.
⚠️ 주의: `lps[i]`는 “다음 비교 인덱스 그 자체”로도 해석할 수 있지만, 이 구현에서는 **길이**다. 구현마다 `next` 배열의 정의와 초기값 `-1` 사용 여부가 다르므로 공식을 섞지 않아야 한다.
### 3.20 KMP 검색 구현

KMP 검색은 텍스트 인덱스 `text_index`를 뒤로 움직이지 않는다.
```python
def build_lps(pattern):
    lps = [0] * len(pattern)
    length = 0
    index = 1
    while index < len(pattern):
        if pattern[index] == pattern[length]:
            length += 1
            lps[index] = length
            index += 1
        elif length > 0:
            length = lps[length - 1]
        else:
            index += 1
    return lps
def kmp_search(text, pattern):
    """KMP로 첫 매칭 위치를 찾고 없으면 -1을 반환한다."""
    if pattern == "":
        return 0
    lps = build_lps(pattern)
    text_index = 0
    pattern_index = 0
    while text_index < len(text):
        if text[text_index] == pattern[pattern_index]:
            text_index += 1
            pattern_index += 1
            if pattern_index == len(pattern):
                return text_index - pattern_index
        elif pattern_index > 0:
            # 이미 일치한 접두사 정보를 재사용하고 텍스트는 되돌리지 않는다.
            pattern_index = lps[pattern_index - 1]
        else:
            text_index += 1
    return -1
```
검색 중 불변식은 `pattern[:pattern_index]`가 `text[text_index-pattern_index:text_index]`와 일치한다는 것이다.
검색은 `O(n)`, 전처리는 `O(m)`이므로 전체 시간은 `O(n+m)`이다.
추가 공간은 LPS 배열의 `O(m)`이다.
패턴이 고정되어 여러 텍스트를 검색한다면 LPS를 한 번만 만들어 재사용할 수 있다.
### 3.21 Boyer-Moore의 bad-character 휴리스틱

Boyer-Moore 계열은 패턴의 오른쪽 끝부터 비교한다.
오른쪽에서 불일치가 났을 때 텍스트의 불일치 문자가 패턴에 없다면 패턴 길이만큼 크게 이동할 수 있다.
그 문자가 패턴 안에 있다면, 패턴에서 그 문자의 가장 오른쪽 위치를 현재 텍스트 문자 아래로 맞춘다.
bad-character 테이블은 각 문자의 패턴 내 마지막 인덱스를 저장한다.
```python
def build_last_occurrence(pattern):
    last = {}
    for index, char in enumerate(pattern):
        # 같은 문자가 다시 나오면 더 오른쪽 인덱스로 갱신한다.
        last[char] = index
    return last
def boyer_moore_bad_character(text, pattern):
    """bad-character 휴리스틱만 사용해 첫 매칭 위치를 찾는다."""
    n = len(text)
    m = len(pattern)
    if m == 0:
        return 0
    last = build_last_occurrence(pattern)
    shift = 0
    while shift <= n - m:
        pattern_index = m - 1
        # 현재 정렬에서 오른쪽부터 일치하는 동안 왼쪽으로 이동한다.
        while (
            pattern_index >= 0
            and pattern[pattern_index] == text[shift + pattern_index]
        ):
            pattern_index -= 1
        if pattern_index < 0:
            return shift
        bad_char = text[shift + pattern_index]
        # 최소 한 칸은 이동해야 무한 반복하지 않는다.
        shift += max(1, pattern_index - last.get(bad_char, -1))
    return -1
```
패턴 `rithm`의 단순 skip 표를 “마지막 문자와 맞추기 위한 거리”로 쓰면 `r:4`, `i:3`, `t:2`, `h:1`, `m:0`, 그 밖의 문자는 `5`가 된다.
위 구현은 불일치가 패턴의 어느 인덱스에서 났는지도 반영하므로 `pattern_index - last[bad_char]` 공식을 사용한다.
bad-character만 사용하는 단순화 구현의 최악 시간은 `O(nm)`이다.
그러나 불일치 문자가 패턴에 없을 때 여러 칸을 건너뛰어 실제 텍스트에서는 빠르게 동작하는 경우가 많다.
완전한 Boyer-Moore는 good-suffix 휴리스틱도 함께 사용한다.
⚠️ 주의: 오른쪽부터 비교한다고 무조건 패턴 길이만큼 이동할 수 있는 것은 아니다. 불일치 문자가 패턴에 있는 위치와 이미 맞은 접미사를 고려해야 한다.
### 3.22 문자열 매칭 알고리즘 비교

텍스트 길이를 `n`, 패턴 길이를 `m`이라 하자.
| 알고리즘 | 전처리 | 검색 최악 시간 | 추가 공간 | 특징 |
|---|---:|---:|---:|---|
| 브루트 포스 | 없음 | `O(nm)` | `O(1)` | 짧고 단순하며 작은 입력에 적합 |
| KMP | `O(m)` | `O(n)` | `O(m)` | 텍스트를 되돌리지 않고 최악 시간을 보장 |
| Boyer-Moore bad-character만 | `O(m)` | `O(nm)` | 문자표 크기 | 오른쪽 비교와 큰 점프로 평균적으로 빠른 경우가 많음 |
| Rabin-Karp | 해시 계산 | 평균 `O(n+m)`, 충돌 시 `O(nm)` | 해시 상태 | 여러 패턴·해시 기반 검사에 응용 |
강의 자료는 Rabin-Karp를 비교표에서만 언급하므로 여기서는 위치만 잡아 둔다.
브루트 포스와 KMP는 검색 과정에서 텍스트 문자를 순서대로 확인한다.
Boyer-Moore는 점프 덕분에 일부 텍스트 문자를 아예 비교하지 않을 수 있다.
알고리즘 선택은 점근 복잡도 하나로 끝나지 않는다.

- 입력과 패턴이 짧으면 브루트 포스의 단순성이 유리하다.
- 최악의 선형 검색 보장이 필요하면 KMP가 분명하다.
- 긴 텍스트와 비교적 긴 패턴에서 실제 평균 성능을 노리면 Boyer-Moore 계열을 고려한다.
- 실무에서는 언어의 최적화된 내장 검색을 먼저 사용하고, 알고리즘 구현은 요구 조건과 학습 목적에 맞춰 선택한다.
### 3.23 시저 암호

시저 암호는 알파벳을 일정한 칸 수만큼 순환 이동시키는 치환 암호다.
평문 문자의 0~25 인덱스에 키를 더하고 26으로 나눈 나머지를 취한다.
키가 `1`이면 `A → B`, `Z → A`가 된다.
```python
def caesar_encrypt(text, key):
    result = []
    shift = key % 26
    for char in text:
        if "A" <= char <= "Z":
            index = ord(char) - ord("A")
            encrypted = (index + shift) % 26
            result.append(chr(ord("A") + encrypted))
        elif "a" <= char <= "z":
            index = ord(char) - ord("a")
            encrypted = (index + shift) % 26
            result.append(chr(ord("a") + encrypted))
        else:
            # 공백과 문장 부호는 그대로 둔다.
            result.append(char)
    return "".join(result)
def caesar_decrypt(ciphertext, key):
    return caesar_encrypt(ciphertext, -key)
ciphertext = caesar_encrypt("SAVE PRIVATE RYAN", 1)
print(ciphertext)
print(caesar_decrypt(ciphertext, 1))
```
실행 결과는 다음과 같다.
```text
TBWF QSJWBUF SZBO
SAVE PRIVATE RYAN
```
강의 슬라이드의 암호문은 공백을 제거해 `TBWFQSJWBUFSZBO`처럼 표현한다.
암호화와 복호화는 문자 수를 `n`이라 할 때 모두 `O(n)` 시간, 결과 저장에 `O(n)` 공간이 든다.
⚠️ 주의: `% 26`이 없으면 `Z` 다음이 `A`로 순환하지 않는다. 음수 키도 Python의 나머지 연산을 이용하면 같은 함수로 처리할 수 있다.
### 3.24 시저 암호 전사 공격

대문자 알파벳만 쓴 시저 암호의 서로 다른 유효 키는 26개이고, 키 `0`을 제외한 이동 키는 25개다.
키 공간이 매우 작으므로 모든 키를 대입해 평문 후보를 출력할 수 있다.
```python
def caesar_brute_force(ciphertext):
    candidates = []
    for key in range(26):
        plaintext = caesar_decrypt(ciphertext, key)
        candidates.append((key, plaintext))
    return candidates
for key, candidate in caesar_brute_force("TBWF"):
    print(f"key={key:2}: {candidate}")
```
후보 중 `key=1`일 때 `SAVE`가 나온다.
문자열 길이가 `n`이면 26개 키는 상수이므로 점근적으로 `O(n)`이지만, 실제 작업량은 약 `26n`이다.
전사 공격은 가능한 키 공간이 작으면 암호 알고리즘의 모양이 그럴듯해도 안전하지 않다는 사실을 보여준다.
### 3.25 단일 치환 암호

단일 치환 암호는 평문의 각 알파벳을 다른 고정 알파벳에 일대일 대응시킨다.
시저 암호는 26개 순환 이동만 허용하지만, 단일 치환은 알파벳 순열 전체를 키로 사용할 수 있다.
```python
import string
def substitution_encrypt(text, cipher_alphabet):
    if len(cipher_alphabet) != 26 or len(set(cipher_alphabet)) != 26:
        raise ValueError("치환표는 서로 다른 대문자 26개여야 합니다.")
    table = str.maketrans(string.ascii_uppercase, cipher_alphabet)
    return text.upper().translate(table)
key = "QHCB EJKARWSTUVD IOPXZFGLMNY".replace(" ", "")
print(substitution_encrypt("SAVE PRIVATE RYAN", key))
```
키의 수는 `26!`이다.
```text
26! = 403291461126605635584000000
```
모든 키를 직접 대입하는 전사 공격은 현실적으로 어렵다.
그러나 키 공간이 크다는 사실만으로 현대적 의미의 안전성이 보장되지는 않는다.
영어에서는 `E`, `T`, `A` 같은 문자가 자주 나타나고, 단어 모양과 문자 쌍에도 통계적 특징이 있다.
단일 치환은 같은 평문 문자를 항상 같은 암호문 문자로 바꾸므로 빈도와 패턴을 보존해 빈도 분석 공격에 취약하다.
⚠️ 주의: 치환표에 중복 문자가 있으면 복호화가 일대일로 결정되지 않는다. 키는 알파벳의 순열이어야 한다.
### 3.26 Run-Length Encoding

실행 길이 압축(Run-Length Encoding, RLE)은 같은 값이 연속으로 몇 번 반복되는지 기록한다.
예를 들어 `ABBBBBBBBA`는 `(A, 1), (B, 8), (A, 1)`로 요약된다.
```python
def run_length_encode(text):
    """연속된 문자를 (문자, 횟수) 튜플의 리스트로 압축한다."""
    if text == "":
        return []
    encoded = []
    current = text[0]
    count = 1
    for char in text[1:]:
        if char == current:
            count += 1
        else:
            # run이 끝나는 순간 지금까지의 문자와 길이를 확정한다.
            encoded.append((current, count))
            current = char
            count = 1
    # 반복문 뒤에는 마지막 run을 별도로 저장해야 한다.
    encoded.append((current, count))
    return encoded
def run_length_decode(encoded):
    parts = []
    for char, count in encoded:
        if count < 0:
            raise ValueError("반복 횟수는 음수일 수 없습니다.")
        parts.append(char * count)
    return "".join(parts)
compressed = run_length_encode("ABBBBBBBBA")
print(compressed)
print(run_length_decode(compressed))
```
실행 결과는 다음과 같다.
```text
[('A', 1), ('B', 8), ('A', 1)]
ABBBBBBBBA
```
인코딩 불변식은 `encoded`와 현재 `(current, count)`가 지금까지 읽은 접두사를 정확히 표현한다는 것이다.
문자열 끝이 종료 조건이며, 시간은 `O(n)`, 결과를 제외한 추가 상태는 `O(1)`이다.
같은 값이 길게 이어지는 이미지나 데이터에는 효과적이지만 `ABABABAB`처럼 run이 짧으면 문자와 횟수를 함께 저장하느라 원본보다 커질 수 있다.
RLE는 BMP 같은 일부 이미지 형식에서 사용되며, 허프만 코딩은 문자 빈도에 따라 자주 나오는 기호에 짧은 비트 코드를 주는 더 일반적인 압축 방법이다.
⚠️ 주의: 반복문 안에서 run이 바뀔 때만 저장하면 마지막 run이 빠진다. 반복 종료 뒤 마지막 `(current, count)`를 반드시 추가해야 한다.
---

## 4. 적용 관점에서 다시 보기

문자열 문제를 만나면 먼저 비교 단위를 정한다.
화면에 보이는 글자인지, Unicode 코드 포인트인지, 인코딩된 바이트인지에 따라 `len()`과 인덱싱의 의미가 달라진다.
파일·소켓·암호화 라이브러리 경계에서는 `str`과 `bytes`를 명시적으로 구분하고 인코딩 이름을 양쪽에서 맞춘다.
문자열을 읽기만 한다면 그대로 `str`로 둔다.
특정 위치를 수정해야 할 때만 리스트로 바꾸거나 새 문자열을 만든다.
격자 입력도 동일하다. 행을 바꾸지 않으면 문자열 리스트가 더 간결하고, 방문 표시나 값 변경이 필요하면 문자 리스트가 알맞다.
인덱스 문제에서는 마지막 위치부터 식을 세운다.

- 길이 `n`의 마지막 인덱스는 `n - 1`이다.
- `i`의 대칭 위치는 `n - 1 - i`다.
- 길이 `m`의 창이 들어갈 마지막 시작점은 `n - m`이다.
- 따라서 시작점 반복 범위는 `range(n - m + 1)`이다.
회문은 “전체를 뒤집을 것인가, 대칭 쌍만 볼 것인가”를 선택한다.
판별만 필요하면 절반 비교가 추가 문자열을 만들지 않는다.
2차원 회문에서는 가로와 세로 후보가 모두 있는지 체크리스트로 확인하고, 답을 찾은 뒤 중첩 반복 전체를 종료하는 구조를 정한다.
글자수처럼 알파벳 범위가 고정된 문제는 배열 빈도표가 빠르고 단순하다.
문자 범위가 넓거나 알 수 없다면 딕셔너리를 사용해 실제 등장한 문자만 세는 편이 안전하다.
패턴 검색에서는 입력 크기와 요구 조건을 본다.

- 한 번 찾고 입력이 작으면 브루트 포스로 정확한 경계를 먼저 구현한다.
- 긴 텍스트에서 최악 시간 보장이 필요하면 KMP와 LPS를 떠올린다.
- 긴 패턴의 오른쪽 비교와 큰 점프가 유리하면 Boyer-Moore 계열을 고려한다.
KMP를 디버깅할 때는 검색 함수보다 LPS부터 독립적으로 검증한다.
손으로 계산한 짧은 패턴의 표와 `build_lps()` 결과가 같아야 검색 포인터 이동을 믿을 수 있다.
Boyer-Moore에서는 skip 표의 정의를 먼저 적는다.
“마지막 문자 기준 거리” 표와 “마지막 등장 인덱스” 표는 값과 이동 공식이 다르므로 둘을 섞으면 안 된다.
암호화 문제는 문자 변환 함수와 키 탐색을 분리한다.
시저 암호는 `% 26`으로 순환을 처리하고, 전사 공격은 복호화 함수를 키마다 재사용한다.
치환 암호는 키가 순열인지 먼저 검증해야 역변환이 가능하다.
압축 문제는 현재 run의 문자와 길이를 상태로 둔다.
값이 바뀌는 순간 이전 run을 확정하고, 반복이 끝난 뒤 마지막 run을 한 번 더 기록한다.
실습 코드를 검토할 때는 “주석이 설명한 단계가 실제 문장으로 구현되었는가?”를 확인한다.
`글자수.py`에는 `s2` 계수와 최대 갱신이, `회문.py`에는 세로 후보 생성과 외부 반복 종료가 필요했다.
주석이 자세해도 핵심 상태 갱신이나 종료 조건이 빠지면 실행 가능한 알고리즘이 아니다.
🧠 기억할 것: 문자열 문제는 대부분 **표현 단위, 인덱스 경계, 불일치 후 이동** 세 가지를 명확히 하면 구조가 잡힌다.
---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

Unicode 코드 포인트와 UTF-8 바이트열은 같은 것이 아니며, Python `str`도 내부적으로 UTF-8 바이트를 그대로 저장하는 객체가 아니라는 점을 구분하게 되었다. 또한 회문과 패턴 검색은 모두 이미 확인한 대칭 또는 접두사 정보를 얼마나 재사용하는가의 문제로 볼 수 있다.
### 5.2 앞으로 이어지는 연결점

문자열 창의 시작 범위는 2차원 배열의 부분 행렬 순회와 연결되고, LPS 전처리는 동적 상태를 다음 비교에 재사용하는 사고로 이어진다. 빈도표·해시·문자 변환은 카운팅, 해싱, 파싱, 네트워크 입출력에서도 반복해서 사용된다.
### 5.3 더 파볼 만한 주제

Unicode 정규화와 grapheme cluster, 완전한 Boyer-Moore의 good-suffix 규칙, 여러 패턴을 동시에 찾는 Aho-Corasick, rolling hash와 Rabin-Karp를 더 살펴볼 수 있다. 압축에서는 허프만 코딩과 LZ 계열이 RLE의 한계를 어떻게 보완하는지도 자연스러운 확장 주제다.
---

## 6. 요약 정리

📌 핵심 정리

- 코드 체계는 문자에 번호를 부여하고, 인코딩은 그 번호를 저장 가능한 코드 단위와 바이트열로 바꾼다.
- ASCII는 7비트 영문 중심 표준이고, Unicode는 전 세계 문자와 기호의 코드 포인트를 통합한다.
- UTF-8은 1~4바이트, UTF-16은 2 또는 4바이트, UTF-32는 4바이트로 코드 포인트를 표현한다.
- endian은 다중 바이트 값의 바이트 저장 순서이며, 문자 순서를 뒤집는 개념이 아니다.
- Python의 `str`은 Unicode 텍스트, `bytes`는 바이트열이다. `encode()`와 `decode()`가 둘 사이를 연결한다.
- 문자열은 불변 시퀀스이므로 인덱싱과 슬라이싱은 가능하지만 요소를 직접 바꿀 수 없다.
- 회문은 `i`와 `n-1-i`를 절반만 비교하며, 길이 `m`인 창의 시작 범위는 `range(n-m+1)`이다.
- 값 비교에는 `==`, 같은 객체인지 확인할 때만 `is`를 사용한다.
- 브루트 포스는 모든 시작점을 확인해 `O(nm)`이고, KMP는 LPS를 이용해 전체 `O(n+m)`을 보장한다.
- Boyer-Moore의 bad-character 휴리스틱은 오른쪽부터 비교하고 불일치 문자의 마지막 위치로 점프한다.
- 시저 암호는 키 공간이 작아 전사 공격에 취약하고, 단일 치환 암호도 문자 빈도를 보존해 빈도 분석에 약하다.
- RLE는 연속된 같은 값을 문자와 횟수로 저장하며, 마지막 run을 반복문 뒤에 반드시 기록한다.
🧠 기억할 것

- 문자 수와 바이트 수를 섞지 않는다.
- `range`의 끝은 포함되지 않으므로 마지막 유효 시작점을 계산한 뒤 `+1`을 붙인다.
- 패턴 검색의 성능 차이는 불일치 후 이미 얻은 정보를 버리는지 재사용하는지에서 생긴다.
- 존재표와 빈도표는 목적이 다르다.
- 변환·검색·압축 코드에는 빈 문자열과 마지막 상태 처리를 명시한다.
---

## 7. 미니 퀴즈 또는 체크리스트

### 미니 퀴즈

1. Unicode 코드 포인트 `U+D55C`와 UTF-8 바이트 `ED 95 9C`는 각각 무엇을 의미하며 왜 구분해야 하는가?
2. `len("홍길동")`과 `len("홍길동".encode("utf-8"))`의 결과가 다른 이유를 `str`과 `bytes` 관점에서 설명해 보자.
3. 길이 `N`인 문자열에서 길이 `M` 후보를 자르는 시작점이 왜 `range(N-M+1)`인지 마지막 인덱스로 증명해 보자.
4. KMP가 불일치 후 텍스트 인덱스를 되돌리지 않을 수 있는 이유를 LPS의 접두사·접미사 정보로 설명해 보자.
5. Boyer-Moore bad-character 휴리스틱에서 `max(1, ...)`가 없으면 어떤 문제가 생길 수 있는가?
### 이해 점검 체크리스트

- [ ] 코드 체계, 코드 포인트, 인코딩, 바이트열을 서로 구분할 수 있다.
- [ ] big-endian과 little-endian의 차이를 다중 바이트 값의 저장 순서로 설명할 수 있다.
- [ ] Python에서 `str.encode()`와 `bytes.decode()`를 올바른 인코딩 이름으로 사용할 수 있다.
- [ ] 문자열 불변성 때문에 수정 시 새 문자열이나 리스트가 필요한 이유를 설명할 수 있다.
- [ ] 1차원과 2차원 문자열 입력을 수정 여부에 따라 선택할 수 있다.
- [ ] `글자수` 문제에서 존재표와 빈도표를 분리해 완성할 수 있다.
- [ ] 뒤집기와 회문에서 감소 범위와 대칭 인덱스를 정확히 계산할 수 있다.
- [ ] 2차원 회문에서 가로와 세로 후보를 모두 검사하고 중첩 반복을 종료할 수 있다.
- [ ] `==`와 `is`, Unicode 순서 비교의 차이를 설명할 수 있다.
- [ ] 브루트 포스 검색의 입력·출력·불변식·종료 조건·복잡도를 말할 수 있다.
- [ ] 짧은 패턴의 LPS 배열을 손으로 계산하고 코드 결과와 비교할 수 있다.
- [ ] KMP 검색에서 불일치 시 `pattern_index`만 되돌리는 이유를 설명할 수 있다.
- [ ] bad-character 표의 정의에 맞는 이동 공식을 사용할 수 있다.
- [ ] 입력 크기와 요구 조건에 따라 브루트 포스, KMP, Boyer-Moore 계열을 선택할 수 있다.
- [ ] 시저 암호를 순환 이동으로 구현하고 모든 키를 시험해 복호화 후보를 만들 수 있다.
- [ ] 단일 치환 키가 알파벳의 순열이어야 하는 이유를 설명할 수 있다.
- [ ] RLE에서 run이 바뀌는 시점과 마지막 run 저장을 빠뜨리지 않을 수 있다.
