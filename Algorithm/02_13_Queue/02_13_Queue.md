# Queue - 선형 큐, 원형 큐, 연결 큐와 BFS

- 🎯 글의 목표: 큐의 FIFO 불변식과 구현별 경계 조건을 이해하고, 버퍼·시뮬레이션·BFS·미로 최단 거리 문제에 안전하고 효율적으로 적용한다.
- 🧩 핵심 키워드: Queue, FIFO, front, rear, enqueue, dequeue, linear queue, false overflow, circular queue, linked queue, deque, priority queue, buffer, BFS, visited, shortest path
- ⭐ 중요도: ★★★★★  큐는 자료구조 구현 문제뿐 아니라 순서 보존, 시뮬레이션, 그래프 탐색, 최단 거리 계산의 기반이 된다.
- 📝 한눈에 보는 내용: 먼저 큐의 앞과 뒤가 맡는 역할을 정리하고, 배열 기반 선형 큐가 왜 사용 가능한 앞 공간을 잃는지 살펴본다. 이어서 나머지 연산으로 인덱스를 순환시키는 원형 큐, 노드를 연결하는 연결 큐, 파이썬의 `deque`, 우선순위 큐를 비교한다. 후반에는 버퍼와 마이쮸 시뮬레이션을 거쳐, 큐의 FIFO 성질이 BFS의 레벨 순서와 무가중 그래프 최단 거리를 어떻게 보장하는지 연결한다.
- 🔗 관련 문제 / 주제: 큐 구현, 회전, 암호 생성기, 마이쮸 나눠주기, 그래프 순회, 미로 최단 거리

---

## 1. 들어가며

줄을 서서 서비스를 기다리는 사람들을 생각해 보자.
먼저 온 사람이 먼저 서비스를 받고,
새로 온 사람은 줄의 맨 뒤에 선다.
큐는 이 질서를 그대로 자료구조로 만든 것이다.
삽입과 삭제가 아무 곳에서나 일어나는 리스트와 달리,
큐는 삽입은 뒤에서,
삭제는 앞에서만 수행한다.
이 단순한 제한 덕분에 “먼저 들어온 작업을 먼저 처리한다”는 순서를 안정적으로 보존할 수 있다.
하지만 큐를 실제 코드로 구현하면 몇 가지 질문이 생긴다.

- 배열 앞쪽에 빈칸이 생겼는데 왜 더 넣을 수 없다고 판단할까?
- 원형 큐는 왜 배열 크기보다 한 칸 적게 저장할까?
- 연결 큐에서 마지막 노드를 꺼낼 때 `front`와 `rear`는 어떻게 바뀌어야 할까?
- 파이썬 리스트의 `pop(0)`은 왜 큐 용도로 느릴까?
- BFS에서는 방문 표시를 큐에 넣을 때 해야 할까, 꺼낼 때 해야 할까?

이번 강의는 이 질문들을 순서대로 해결한다.
앞부분에서는 큐의 추상적인 규칙을 배열과 링크로 구현하는 방법을 배운다.
중간에서는 버퍼와 시뮬레이션을 통해 FIFO가 실제 처리 순서를 어떻게 모델링하는지 확인한다.
마지막에서는 BFS를 통해 큐의 순서가 “가까운 정점부터 탐색한다”는 알고리즘적 보장으로 바뀌는 과정을 살펴본다.
여기서 가장 중요한 학습 태도는 저장 배열에 남아 있는 값과 논리적으로 큐에 들어 있는 값을 구분하는 것이다.
삭제한 값을 배열에서 `0`으로 지우지 않아도,
`front`가 그 칸을 지나갔다면 그 값은 더 이상 큐의 원소가 아니다.
반대로 배열에 빈칸이 보여도,
현재 구현의 인덱스 규칙이 그 칸을 재사용하지 못한다면 그 공간은 논리적으로 사용할 수 없다.
큐를 제대로 이해한다는 것은 값의 모양보다 `front`, `rear`, 공백 조건, 포화 조건이라는 불변식을 읽는다는 뜻이다.

---

## 2. 핵심 개념 정리

이번 강의는 “처리할 대상을 어떤 순서로 보관하고 꺼낼 것인가?”라는 질문에서 시작한다.
첫 번째 단계에서는 FIFO와 기본 연산을 통해 큐가 보장해야 하는 규칙을 잡는다.
이 규칙은 구현 방식이 배열이든 연결 리스트든 바뀌지 않는다.
두 번째 단계에서는 고정 배열을 사용하는 선형 큐를 구현한다.
`front`와 `rear`만 움직이면 각 연산은 빠르지만,
삭제로 생긴 앞 공간을 다시 쓰지 못하는 false overflow 문제가 드러난다.
세 번째 단계에서는 인덱스를 배열 끝에서 처음으로 되돌리는 원형 큐로 공간을 재사용한다.
이때 공백과 포화를 구분하기 위해 한 칸을 비워 두는 규칙이 핵심이 된다.
네 번째 단계에서는 노드를 연결해 크기를 동적으로 늘리는 연결 큐와,
파이썬에서 같은 목적에 가장 실용적인 `collections.deque`를 살펴본다.
그 뒤에는 FIFO가 아닌 우선순위 기준으로 꺼내는 우선순위 큐를 비교한다.
이는 이름에 “큐”가 들어가도 삭제 순서를 결정하는 정책은 달라질 수 있음을 보여준다.
다섯 번째 단계에서는 버퍼와 마이쮸 시뮬레이션으로 큐가 현실의 대기열을 어떻게 코드로 옮기는지 본다.
마지막 단계에서는 BFS의 대기 목록으로 큐를 사용한다.
큐에 들어 있는 정점은 “발견되었지만 아직 인접 정점을 모두 조사하지 않은 정점”이다.
이 불변식과 올바른 방문 표시 시점이 합쳐져야 중복 삽입을 막고 최단 거리를 정확히 계산할 수 있다.
전체 흐름은 다음과 같다.
`FIFO 규칙 → 배열 구현 → 공간 재사용 → 동적 구현 → 실제 대기열 → BFS 레벨 순서 → 최단 거리`

---

## 3. 본문 정리

이 절에서는 강의 순서를 따라가되,
각 개념 바로 아래에서 예시와 구현, 복잡도, 경계 조건을 함께 확인한다.

### 3.1 큐의 개념과 FIFO

큐는 **먼저 들어온 데이터가 먼저 나가는 선형 자료구조**다.
이를 선입선출,
영어로는 FIFO(First In, First Out)라고 한다.
`1`, `2`, `3`을 차례로 넣었다면 꺼내는 순서도 `1`, `2`, `3`이어야 한다.
```text
삽입 순서: 1 → 2 → 3
큐 상태:   front [1, 2, 3] rear
삭제 순서: 1 → 2 → 3
```
큐의 두 끝은 역할이 다르다.

- `front` 쪽은 가장 먼저 처리할 원소가 있는 쪽이다.
- `rear` 쪽은 새 원소가 들어오는 쪽이다.
- 삽입은 `rear`에서만 일어난다.
- 삭제는 `front`에서만 일어난다.

서비스 대기 행렬,
프린터 작업 목록,
네트워크 패킷 버퍼처럼 도착 순서를 지켜야 하는 상황에서 이 구조가 자연스럽다.
스택과 비교하면 차이가 더 선명하다.

| 자료구조 | 삽입 위치 | 삭제 위치 | 처리 순서 |
|---|---|---|---|
| 스택 | top | top | LIFO |
| 큐 | rear | front | FIFO |

큐의 핵심은 단순히 “앞에서 뺀다”가 아니다.
먼저 들어온 원소를 뒤에 들어온 원소가 추월하지 못하게 만드는 것이 핵심이다.
📌 핵심: 큐의 구현이 달라져도 먼저 들어온 유효 원소가 먼저 나와야 한다는 FIFO 불변식은 변하지 않는다.

### 3.2 큐의 기본 연산과 상태

큐를 하나의 추상 자료형으로 보면 다음 연산이 필요하다.

| 연산 | 기능 |
|---|---|
| `create_queue()` | 빈 큐를 만든다. |
| `enqueue(item)` | 뒤에 `item`을 삽입한다. |
| `dequeue()` | 앞 원소를 삭제하고 반환한다. |
| `qpeek()` | 앞 원소를 삭제하지 않고 반환한다. |
| `is_empty()` | 큐가 비었는지 검사한다. |
| `is_full()` | 고정 크기 큐가 가득 찼는지 검사한다. |

`enqueue`와 `dequeue`의 입력과 출력도 구분해야 한다.

- `enqueue(item)`의 입력은 삽입할 원소이며, 보통 반환값은 필요 없다.
- `dequeue()`는 입력 없이 가장 앞 원소를 반환한다.
- `qpeek()`도 앞 원소를 반환하지만 큐 상태를 바꾸지 않는다.

빈 큐에서 `dequeue()`나 `qpeek()`를 요청하는 상황을 underflow라고 한다.
고정 크기 큐가 가득 찼는데 `enqueue()`를 요청하는 상황을 overflow라고 한다.
오류 처리 방식은 구현 계약에 따라 달라질 수 있다.
학습 코드에서는 `None`을 반환하거나 메시지를 출력할 수 있지만,
실전 코드에서는 예외를 발생시키거나 호출 전에 상태를 검사하는 편이 오류를 숨기지 않는다.
```python
def safe_front(q):
    """비어 있지 않은 deque의 맨 앞 값을 삭제 없이 반환한다."""
    if not q:
        raise IndexError("peek from an empty queue")
    return q[0]
```
⚠️ 주의: `None`도 정상 데이터로 저장할 수 있는 큐라면, 빈 큐에서 `None`을 반환하는 방식은 실패와 정상 값을 구분하지 못한다.

### 3.3 선형 큐의 구조

선형 큐는 데이터를 배열의 왼쪽부터 오른쪽으로 저장하는 가장 직접적인 구현이다.
크기 `N`의 배열과 두 인덱스를 사용한다.

- `front`: 가장 최근에 삭제한 원소의 인덱스
- `rear`: 가장 최근에 삽입한 원소의 인덱스

초기에는 아무 원소도 없으므로 둘 다 `-1`이다.
```python
N = 10
queue = [0] * N
front = -1
rear = -1
```
이 표현에서 실제 첫 원소의 위치는 `front`가 아니라 `front + 1`이다.
예를 들어 `A`, `B`를 넣으면 다음 상태가 된다.
```text
index    0   1   2
queue   [A] [B] [ ]
front   -1
rear         1
```
`dequeue()`로 `A`를 꺼내면 `front`가 `0`이 된다.
```text
index    0   1   2
queue   [A] [B] [ ]   # 물리적 값 A는 남아 있을 수 있다.
front    0             # 논리적 큐는 B부터 시작한다.
rear         1
```
즉 유효한 큐 구간은 항상 `front + 1`부터 `rear`까지다.
유효 원소 수는 `rear - front`로 계산할 수 있다.
```python
def queue_size(front, rear):
    return rear - front
```
공백과 포화 조건은 다음과 같다.
```python
def is_empty(front, rear):
    return front == rear
def is_full(queue, rear):
    return rear == len(queue) - 1
```
초기 상태도 `front == rear == -1`이므로 공백이고,
모든 원소를 꺼낸 뒤에도 `front == rear`이므로 공백이다.
⚠️ 주의: 실습 파일 `선형큐1.py`의 주석에는 `front`를 “첫 원소의 위치”라고도 적었지만, 해당 코드가 실제로 사용하는 규칙은 “가장 최근에 삭제된 위치”다. 이 둘을 섞으면 첫 원소를 한 칸 잘못 읽는다.

### 3.4 선형 큐의 삽입, 삭제, 조회

삽입할 때는 먼저 `rear`를 한 칸 옮기고 그 위치에 값을 쓴다.
삭제할 때는 먼저 `front`를 한 칸 옮기고 그 위치의 값을 읽는다.
```python
class LinearQueue:
    def __init__(self, capacity):
        self.items = [None] * capacity
        self.front = -1
        self.rear = -1
    def is_empty(self):
        return self.front == self.rear
    def is_full(self):
        return self.rear == len(self.items) - 1
    def enqueue(self, item):
        if self.is_full():
            raise OverflowError("linear queue is full")
        self.rear += 1
        self.items[self.rear] = item
    def dequeue(self):
        if self.is_empty():
            raise IndexError("dequeue from an empty queue")
        self.front += 1
        return self.items[self.front]
    def peek(self):
        if self.is_empty():
            raise IndexError("peek from an empty queue")
        return self.items[self.front + 1]
    def __len__(self):
        return self.rear - self.front
```
실행 흐름을 확인해 보자.
```python
q = LinearQueue(3)
q.enqueue(1)
q.enqueue(2)
q.enqueue(3)
print(q.peek())     # 1
print(q.dequeue())  # 1
print(q.dequeue())  # 2
print(q.dequeue())  # 3
print(len(q))       # 0
```
각 삽입과 삭제는 인덱스 이동과 한 번의 배열 접근만 하므로 `O(1)`이다.
배열 자체는 용량만큼 필요하므로 공간 복잡도는 `O(N)`이다.
삭제한 칸을 `None`으로 덮지 않아도 논리적 삭제는 완료된다.
다만 큰 객체 참조를 오래 유지하면 메모리 회수가 늦어질 수 있으므로,
일반 목적 구현에서는 꺼낸 칸을 `None`으로 비우는 선택도 가능하다.
⚠️ 주의: `선형큐1.py`는 정확히 10번 삽입하고 10번 삭제한다는 전제만 있어 overflow와 underflow 검사를 생략했다. 반복 횟수나 입력 크기가 바뀌면 즉시 `IndexError`가 날 수 있다.
⚠️ 주의: 삭제 뒤 `print(q)`에 `1`부터 `10`까지 그대로 보이는 것은 삭제 실패가 아니다. `front == rear == 9`이므로 논리적 큐는 비어 있다.

### 3.5 선형 큐의 false overflow

선형 큐의 가장 큰 문제는 배열 앞쪽의 삭제된 칸을 재사용하지 않는다는 점이다.
크기 4인 배열에서 네 값을 넣고 세 값을 꺼냈다고 하자.
```text
index    0   1   2   3
array   [A] [B] [C] [D]
front            2
rear                 3
logical queue        [D]
```
논리적으로는 원소가 하나뿐이고 앞쪽 세 칸은 더 이상 사용하지 않는다.
그러나 선형 큐의 포화 조건은 `rear == N - 1`이다.
따라서 새 원소를 넣으려 하면 가득 찼다고 판단한다.
이것이 false overflow,
즉 잘못된 포화 상태 인식이다.
배열에 실제 빈 공간이 있지만 현재 인덱스 규칙으로는 그 공간을 쓸 수 없는 상태다.
한 가지 해결책은 남은 원소를 매번 배열 앞으로 이동하는 것이다.
```text
이동 전: [x, x, x, D]
이동 후: [D, _, _, _]
```
하지만 원소가 `k`개 남아 있다면 이동에 `O(k)` 시간이 든다.
큐 연산의 장점인 `O(1)` 처리가 무너진다.
더 나은 해결책은 배열의 끝과 처음이 논리적으로 연결되어 있다고 보고,
앞의 빈칸을 다음 삽입 위치로 재사용하는 것이다.
이 생각이 원형 큐로 이어진다.
📌 핵심: false overflow는 메모리가 정말 가득 찬 것이 아니라, 선형으로만 증가하는 `rear`가 배열 끝에 도달해서 생긴다.

### 3.6 파이썬 리스트를 큐로 쓸 때의 성능

파이썬 리스트에 `append()`하고 `pop(0)`하면 겉보기에는 큐가 된다.
```python
queue = []
queue.append(10)
queue.append(20)
print(queue.pop(0))  # 10
```
문제는 `pop(0)` 뒤에 있는 모든 원소를 한 칸씩 왼쪽으로 옮겨야 한다는 점이다.
원소가 `n`개일 때 한 번의 `pop(0)`은 `O(n)`이다.
모든 원소를 차례로 꺼내면 이동량은 다음처럼 누적된다.
```text
(n - 1) + (n - 2) + ... + 1 = O(n²)
```
실습의 `선형큐2.py`는 기능적으로 FIFO를 지키지만,
큰 입력에서는 이 이동 비용 때문에 큐 구현으로 적합하지 않다.
반면 배열과 `front` 인덱스를 쓰면 실제 이동 없이 `front += 1`만 하면 된다.
파이썬 실전에서는 보통 `deque.popleft()`를 사용한다.

| 구현 | 뒤 삽입 | 앞 삭제 | `n`개 전체 삭제 |
|---|---:|---:|---:|
| `list.append`, `list.pop(0)` | 평균 `O(1)` | `O(n)` | `O(n²)` |
| 배열 + `front` | `O(1)` | `O(1)` | `O(n)` |
| `deque.append`, `deque.popleft` | `O(1)` | `O(1)` | `O(n)` |

### 3.7 원형 큐의 논리 구조와 나머지 연산

원형 큐는 1차원 배열을 그대로 사용하되,
마지막 인덱스 다음이 0번 인덱스라고 해석한다.
인덱스를 한 칸 이동하는 식은 다음과 같다.
```python
next_index = (current_index + 1) % capacity
```
용량이 4일 때 인덱스 변화는 다음과 같다.
```text
0 → 1 → 2 → 3 → 0 → 1 → ...
```
`3`에서 한 칸 증가하면 `4`지만,
`4 % 4 == 0`이므로 배열의 처음으로 돌아간다.
원형 큐는 초기 `front`와 `rear`를 모두 0으로 둔다.
```python
capacity = 4
queue = [None] * capacity
front = 0
rear = 0
```
강의의 규칙에서는 `front`가 가리키는 칸을 항상 비워 둔다.
실제 첫 원소는 `(front + 1) % capacity`에 있다.
삽입은 `rear`를 먼저 옮긴 뒤 저장하고,
삭제는 `front`를 먼저 옮긴 뒤 읽는다.
```python
rear = (rear + 1) % capacity
queue[rear] = item
front = (front + 1) % capacity
item = queue[front]
```
모듈러 연산은 값 자체를 원형으로 만드는 것이 아니다.
물리적으로는 여전히 평평한 배열이고,
인덱스 해석만 순환한다.

### 3.8 원형 큐의 공백과 포화 조건

원형 큐에서 `front == rear`이면 큐가 비었다고 판단한다.
그런데 모든 칸을 사용하도록 허용하면,
한 바퀴 돌아 가득 찬 상태에서도 `front == rear`가 된다.
같은 표현이 공백과 포화를 동시에 뜻하게 되는 문제가 생긴다.
강의에서는 이를 피하기 위해 항상 한 칸을 비워 둔다.
따라서 포화 조건은 `rear`의 다음 위치가 `front`인 경우다.
```python
def is_empty(front, rear):
    return front == rear
def is_full(front, rear, capacity):
    return (rear + 1) % capacity == front
```
배열 길이가 `N`이면 저장 가능한 원소는 최대 `N - 1`개다.
8개를 저장해야 한다면 배열은 9칸이어야 한다.
```python
logical_capacity = 8
queue = [None] * (logical_capacity + 1)
```
실습의 `원형큐.py`는 `N = 10`인 배열에 1부터 10까지 넣으려고 한다.
그러나 한 칸을 비워 두는 구현이므로 9개만 저장할 수 있다.
열 번째 값은 `is_full()`이 참이 되어 조용히 삽입되지 않는다.
이 동작을 모르면 “배열 크기가 10인데 왜 10개가 안 들어가지?”라고 오해하기 쉽다.
⚠️ 주의: 삽입 실패를 단순히 건너뛰면 데이터 유실을 알아차리기 어렵다. `False`를 반환하거나 `OverflowError`를 발생시켜 호출자가 실패를 처리하게 해야 한다.

### 3.9 원형 큐의 안전한 구현

다음 구현은 논리 용량과 내부 배열 크기를 구분한다.
```python
class CircularQueue:
    def __init__(self, capacity):
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        # 한 칸은 공백/포화 구분용으로 남긴다.
        self.items = [None] * (capacity + 1)
        self.front = 0
        self.rear = 0
    def is_empty(self):
        return self.front == self.rear
    def is_full(self):
        next_rear = (self.rear + 1) % len(self.items)
        return next_rear == self.front
    def enqueue(self, item):
        if self.is_full():
            raise OverflowError("circular queue is full")
        self.rear = (self.rear + 1) % len(self.items)
        self.items[self.rear] = item
    def dequeue(self):
        if self.is_empty():
            raise IndexError("dequeue from an empty queue")
        self.front = (self.front + 1) % len(self.items)
        item = self.items[self.front]
        self.items[self.front] = None
        return item
    def peek(self):
        if self.is_empty():
            raise IndexError("peek from an empty queue")
        first = (self.front + 1) % len(self.items)
        return self.items[first]
```
배열 끝을 넘어 다시 앞 공간을 쓰는지 확인해 보자.
```python
q = CircularQueue(3)
q.enqueue("A")
q.enqueue("B")
q.enqueue("C")
print(q.dequeue())  # A
print(q.dequeue())  # B
q.enqueue("D")
q.enqueue("E")      # rear가 배열 앞쪽을 다시 사용한다.
print(q.dequeue())  # C
print(q.dequeue())  # D
print(q.dequeue())  # E
```
각 연산은 인덱스 계산과 한 번의 접근만 수행하므로 `O(1)`이다.
원형 큐는 고정 크기 버퍼에서 특히 유용하다.
메모리를 한 번 할당하고 계속 재사용할 수 있기 때문이다.
⚠️ 주의: 실습 `원형큐.py`의 삭제 반복은 정확히 9개가 들어갔다는 사실에 의존한다. 공백 검사를 하지 않고 한 번 더 삭제하면 오래된 칸을 정상 값처럼 읽게 된다.

### 3.10 회전 문제와 불필요한 큐 확장

실습 `회전.py`는 맨 앞 값을 꺼내 맨 뒤에 넣는 동작을 `M`번 수행한다.
선형 배열을 `N + M + 100`칸 미리 만들고,
매 회전마다 `front`와 `rear`를 증가시킨다.
이 코드는 주어진 배열 길이가 양수이고 메모리가 충분하면 답을 낼 수 있다.
하지만 시간과 공간이 모두 `O(N + M)`이다.
회전 뒤 맨 앞 원소만 필요하다면 실제 이동은 필요 없다.
길이 `N`인 배열을 왼쪽으로 `M`번 회전한 첫 원소는 원래 배열의 `M % N` 위치다.
```python
def front_after_left_rotations(values, rotations):
    if not values:
        raise ValueError("values must not be empty")
    return values[rotations % len(values)]
print(front_after_left_rotations([10, 20, 30, 40], 6))  # 30
```
이 방식은 입력 배열을 제외하면 추가 공간 `O(1)`,
답 계산 `O(1)`이다.
모든 회전 결과가 필요하다면 `deque.rotate(-M)` 또는 원형 인덱스를 사용할 수 있다.
⚠️ 주의: `M`이 매우 크면 실습 방식은 같은 상태를 반복해서 만들며 시간과 메모리를 낭비한다. `M %= N`으로 주기를 먼저 줄여야 한다.

### 3.11 연결 큐의 구조

연결 큐는 배열 대신 노드를 링크로 연결한다.
`front`는 첫 노드를,
`rear`는 마지막 노드를 가리킨다.
```text
front                                      rear
  ↓                                           ↓
[A | next] → [B | next] → [C | next] → [D | None]
```
초기 상태와 공백 상태는 모두 다음과 같다.
```python
front = None
rear = None
```
삽입할 때 새 노드를 만들고 기존 `rear.next`에 연결한 뒤,
`rear`를 새 노드로 옮긴다.
단 빈 큐에 첫 노드를 넣을 때는 `front`와 `rear`가 모두 그 노드를 가리켜야 한다.
삭제할 때는 `front`를 `front.next`로 옮긴다.
삭제 결과 큐가 비었다면 `rear`도 반드시 `None`으로 바꿔야 한다.
이 마지막 처리가 연결 큐의 핵심 경계 조건이다.
배열처럼 고정 용량에 따른 false overflow는 없지만,
노드마다 링크를 저장하는 추가 메모리가 필요하다.
또한 메모리 할당 자체가 실패할 정도로 자원이 부족하면 무한히 늘어날 수 있는 것은 아니다.

### 3.12 연결 큐의 올바른 구현

큐는 뒤로만 연결하면 되므로 단순 연결 리스트로 충분하다.
```python
class Node:
    def __init__(self, item):
        self.item = item
        self.next = None
class LinkedQueue:
    def __init__(self):
        self.front = None
        self.rear = None
        self.size = 0
    def is_empty(self):
        return self.front is None
    def enqueue(self, item):
        new_node = Node(item)
        if self.rear is None:
            # 빈 큐의 첫 노드는 앞이면서 뒤다.
            self.front = new_node
            self.rear = new_node
        else:
            self.rear.next = new_node
            self.rear = new_node
        self.size += 1
    def dequeue(self):
        if self.front is None:
            raise IndexError("dequeue from an empty queue")
        item = self.front.item
        self.front = self.front.next
        self.size -= 1
        if self.front is None:
            # 마지막 노드를 꺼냈다면 rear도 비워야 한다.
            self.rear = None
        return item
    def peek(self):
        if self.front is None:
            raise IndexError("peek from an empty queue")
        return self.front.item
    def __len__(self):
        return self.size
```
```python
q = LinkedQueue()
q.enqueue("A")
q.enqueue("B")
print(q.dequeue())  # A
print(q.dequeue())  # B
print(q.is_empty()) # True
```
`front`와 `rear`를 모두 유지하므로 삽입과 삭제는 `O(1)`이다.
만약 `rear`가 없다면 삽입할 때마다 마지막 노드를 찾느라 `O(n)`이 든다.

### 3.13 실습 연결 큐의 경계 버그

실습 `연결큐.py`의 `deq()`는 먼저 다음 코드를 수행한다.
```python
result = self.front
if result.next:
    ...
```
빈 큐라면 `result`가 `None`이므로 `result.next`에서 `AttributeError`가 발생한다.
따라서 `result`를 사용하기 전에 공백을 검사해야 한다.
더 큰 문제는 원소가 하나인 경우다.
이때 `result.next`는 `None`이므로 조건문 본문이 실행되지 않는다.
`front`와 `rear`가 그대로 남아,
꺼낸 노드가 계속 큐에 있는 것처럼 보인다.
같은 노드를 여러 번 반환할 수도 있고 `is_empty()`도 계속 거짓이 된다.
마지막 원소 삭제는 다음 상태 전이를 반드시 만들어야 한다.
```text
삭제 전: front → [A] ← rear
삭제 후: front = None, rear = None
```
실습 노드는 `prev` 링크까지 갖고 있지만 FIFO 큐에는 필요하지 않다.
양방향 삭제를 지원하는 덱을 직접 구현하려는 것이 아니라면,
불필요한 `prev`는 메모리와 연결 해제 코드만 늘린다.
또 `enq(node)`처럼 외부에서 만든 노드를 직접 받으면,
이미 다른 리스트에 연결된 노드가 들어와 구조를 망가뜨릴 수 있다.
일반적인 큐 인터페이스는 값을 받고 내부에서 새 노드를 만드는 편이 안전하다.
⚠️ 주의: 강의의 연결 큐 연산 그림 중 `B`를 남긴 뒤 `C`를 삽입하는 단계에서 `front` 주소가 이전 `A`의 주소로 표시된 부분이 있다. 링크 규칙상 이 시점의 `front`는 `B`를 가리켜야 한다.

### 3.14 파이썬의 deque와 양방향 큐

`collections.deque`는 양쪽 끝에서 빠르게 삽입하고 삭제하도록 설계된 컨테이너다.
직접 연결 큐를 만들 필요가 없는 일반 문제에서는 가장 실용적인 선택이다.
```python
from collections import deque
queue = deque()
for value in range(1, 11):
    queue.append(value)       # 오른쪽에 삽입: enqueue
while queue:
    print(queue.popleft(), end=" ")  # 왼쪽에서 삭제: dequeue

# 1 2 3 4 5 6 7 8 9 10
```
`deque`는 양방향 큐라는 이름처럼 네 방향 연산을 제공한다.

| 연산 | 의미 | 시간 복잡도 |
|---|---|---:|
| `append(x)` | 오른쪽 삽입 | `O(1)` |
| `appendleft(x)` | 왼쪽 삽입 | `O(1)` |
| `pop()` | 오른쪽 삭제 | `O(1)` |
| `popleft()` | 왼쪽 삭제 | `O(1)` |

일반 FIFO 큐는 `append()`와 `popleft()`를 한 쌍으로 사용한다.
슬라이딩 윈도우,
양끝 선택,
0-1 BFS처럼 양쪽 삽입이 필요한 문제에서는 덱의 전체 기능을 사용한다.
실습 `덱.py`는 1부터 10까지 넣고 모두 `popleft()`하여 FIFO 순서를 확인한다.
마지막 출력이 `deque([])`인 것은 모든 원소가 논리적·물리적으로 제거되었다는 뜻이다.
⚠️ 주의: 빈 `deque`에서 `popleft()`를 호출하면 강의 자료의 OCR처럼 `Index Error`가 아니라 실제로 `IndexError` 예외가 발생한다. 보통 `if queue:` 또는 `while queue:`로 먼저 검사한다.

### 3.15 구현별 성능과 벤치마크 해석

큐 구현은 같은 FIFO 기능을 제공해도 비용 구조가 다르다.

| 구현 | 삽입 | 삭제 | 용량 | 핵심 주의점 |
|---|---:|---:|---|---|
| 선형 배열 큐 | `O(1)` | `O(1)` | 고정 | 앞 공간 재사용 불가 |
| 원형 배열 큐 | `O(1)` | `O(1)` | 고정 | 한 칸 비우는 규칙 |
| 연결 큐 | `O(1)` | `O(1)` | 동적 | 마지막 노드 삭제 처리 |
| `list.pop(0)` | 평균 삽입 `O(1)` | `O(n)` | 동적 | 전체 삭제 `O(n²)` |
| `deque` | `O(1)` | `O(1)` | 동적 | 양끝 외 중간 접근은 목적이 아님 |

실습 `큐시간테스트.py`는 `list.pop(0)`, 배열 인덱스, `deque.popleft()`를 비교한다.
성능 경향을 관찰하는 데는 도움이 되지만 공정한 벤치마크는 아니다.
구체적인 문제는 다음과 같다.

- `q1`은 타이머 시작 전에 빈 리스트를 만들지만 `q2`, `q3` 생성 시점은 측정 구간에 포함된다.
- 배열 방식은 삭제 값을 읽거나 반환하지 않고 `front += 1`만 한다.
- 결과가 같은지 검증하지 않는다.
- 한 번만 측정해 운영체제 스케줄링과 캐시 변동의 영향을 크게 받는다.
- 짧은 구간에는 `time.time()`보다 `time.perf_counter()`가 적합하다.

비교하려면 같은 입력과 같은 논리 작업을 반복 측정해야 한다.
```python
from collections import deque
from time import perf_counter
def consume_with_list(values):
    q = list(values)
    checksum = 0
    while q:
        checksum += q.pop(0)
    return checksum
def consume_with_deque(values):
    q = deque(values)
    checksum = 0
    while q:
        checksum += q.popleft()
    return checksum
values = list(range(20_000))
for function in (consume_with_list, consume_with_deque):
    start = perf_counter()
    result = function(values)
    elapsed = perf_counter() - start
    print(function.__name__, result, elapsed)
```
정확한 수치는 실행 환경마다 달라진다.
반면 `pop(0)`이 선형 시간이고 `popleft()`가 양끝 상수 시간이라는 복잡도 차이는 환경과 무관한 핵심이다.

### 3.16 우선순위 큐

우선순위 큐는 항목마다 우선순위를 두고,
FIFO가 아니라 우선순위가 높은 항목부터 꺼내는 자료구조다.
일반 큐와 연산 이름은 비슷하지만 삭제 정책이 다르다.
```text
일반 큐: 먼저 도착한 항목 먼저 삭제
우선순위 큐: 가장 높은 우선순위 항목 먼저 삭제
```
시뮬레이션 이벤트 처리,
네트워크 트래픽 제어,
운영체제 태스크 스케줄링 등에 사용한다.
배열에서 삽입할 때마다 적절한 위치를 찾아 정렬 상태를 유지할 수 있다.
그러나 중간 삽입에 원소 이동이 필요해 `O(n)`이 들 수 있다.
반대로 끝에 그냥 넣고 삭제할 때 최고 우선순위를 찾으면 삭제가 `O(n)`이다.
효율적인 일반 구현에는 힙을 사용한다.
파이썬의 `heapq`는 최소 힙이므로 작은 우선순위 값이 먼저 나온다.
```python
import heapq
jobs = []
heapq.heappush(jobs, (2, "normal"))
heapq.heappush(jobs, (1, "urgent"))
heapq.heappush(jobs, (3, "later"))
while jobs:
    priority, name = heapq.heappop(jobs)
    print(priority, name)
```
실행 결과는 우선순위 `1`, `2`, `3` 순이다.
힙의 삽입과 삭제는 각각 `O(log n)`이다.
같은 우선순위에서 도착 순서를 보존해야 한다면 증가하는 일련번호를 함께 저장한다.
```python
heapq.heappush(jobs, (priority, sequence, item))
```
⚠️ 주의: 우선순위 큐는 이름 때문에 FIFO라고 생각하기 쉽지만, 핵심 불변식은 “최고 우선순위 원소가 먼저 나온다”는 것이다.

### 3.17 버퍼와 FIFO

버퍼는 데이터를 한 곳에서 다른 곳으로 전송하는 동안 일시적으로 보관하는 메모리 영역이다.
생산자와 소비자의 처리 속도가 다를 때,
버퍼가 그 차이를 흡수한다.
키보드 입력을 예로 들면 사용자가 입력한 문자는 즉시 프로그램 연산에 사용되지 않을 수 있다.
먼저 입력 버퍼에 쌓이고,
프로그램은 준비된 순서대로 문자를 읽는다.
입력 순서가 `A`, `P`, `S`, `Enter`라면 프로그램도 그 순서대로 받아야 한다.
그래서 일반적인 순차 입출력 버퍼에는 FIFO 큐가 잘 맞는다.
버퍼를 채우는 동작을 버퍼링이라고 한다.
버퍼에는 보통 다음 정책도 함께 필요하다.

- 최대 용량은 얼마인가?
- 가득 찼을 때 생산자를 기다리게 할 것인가?
- 가장 오래된 데이터를 버릴 것인가?
- 새 데이터를 거부할 것인가?
- 소비자가 비어 있는 버퍼를 읽으려 하면 기다릴 것인가?

고정 크기 스트리밍 버퍼는 원형 큐로 구현하면 메모리를 반복 재사용할 수 있다.
네트워크와 동시성 환경에서는 큐 자체뿐 아니라 대기와 동기화 정책도 정확성의 일부가 된다.
📌 핵심: 버퍼는 저장 장소이고, 큐는 그 안에서 데이터 처리 순서를 정하는 대표적인 정책이다.

### 3.18 마이쮸 나눠주기 시뮬레이션

강의의 마이쮸 문제는 대기열의 상태 변화를 큐로 모델링한다.
규칙은 다음과 같이 정리할 수 있다.

1. 1번 사람이 1개를 받을 차례로 줄에 선다.
2. 맨 앞 사람은 자신의 이번 차례 수만큼 받는다.
3. 받은 사람은 다음번에 받을 수를 1 늘려 다시 줄 뒤에 선다.
4. 새로운 사람이 1개를 받을 차례로 줄 뒤에 선다.
5. 사탕이 모두 없어질 때까지 반복한다.

큐의 각 원소는 사람 번호만이 아니라,
그 사람이 다음에 받을 개수도 함께 저장해야 한다.
```python
from collections import deque
def last_receiver(total_candies):
    if total_candies <= 0:
        return None
    queue = deque([(1, 1)])
    next_person = 2
    remaining = total_candies
    while remaining > 0:
        person, requested = queue.popleft()
        # 마지막 차례에는 요청량보다 적게 남을 수 있다.
        given = min(requested, remaining)
        remaining -= given
        if remaining == 0:
            return person
        # 같은 사람은 다음 차례에 한 개 더 받는다.
        queue.append((person, requested + 1))
        # 새 사람은 항상 1개부터 시작한다.
        queue.append((next_person, 1))
        next_person += 1
```
20개일 때 지급 흐름은 다음과 같다.

| 차례 | 사람 | 요청 | 실제 지급 | 남은 개수 |
|---:|---:|---:|---:|---:|
| 1 | 1 | 1 | 1 | 19 |
| 2 | 1 | 2 | 2 | 17 |
| 3 | 2 | 1 | 1 | 16 |
| 4 | 1 | 3 | 3 | 13 |
| 5 | 3 | 1 | 1 | 12 |
| 6 | 2 | 2 | 2 | 10 |
| 7 | 4 | 1 | 1 | 9 |
| 8 | 1 | 4 | 4 | 5 |
| 9 | 5 | 1 | 1 | 4 |
| 10 | 3 | 2 | 2 | 2 |
| 11 | 6 | 1 | 1 | 1 |
| 12 | 2 | 3 | 1 | 0 |

따라서 마지막 마이쮸를 받는 사람은 2번이다.
마지막 차례에 2번은 3개를 요청하지만 1개만 남았으므로 실제 지급은 1개다.
이 경계값을 처리하지 않고 무조건 `remaining -= requested`만 하면 남은 수가 음수가 된다.
종료 조건은 “남은 수가 0 이하”로 잡을 수도 있지만,
`min()`으로 실제 지급량을 계산하면 상태가 음수가 되지 않아 의미가 더 명확하다.

### 3.19 암호 생성기: 원형 처리의 실전 예

실습 `암호생성기_과제.py`는 8개 숫자를 큐에 넣고,
앞 숫자에서 `1, 2, 3, 4, 5`를 주기적으로 뺀 뒤 뒤로 보내는 문제의 뼈대다.
감소한 값이 0 이하가 되는 순간 그 값을 0으로 바꾸고 종료한다.
```python
from collections import deque
def generate_password(numbers):
    if len(numbers) != 8:
        raise ValueError("password must contain exactly 8 numbers")
    queue = deque(numbers)
    decrease = 1
    while True:
        value = queue.popleft() - decrease
        if value <= 0:
            queue.append(0)
            return list(queue)
        queue.append(value)
        decrease = decrease % 5 + 1
```
핵심 불변식은 큐에 항상 8개가 있다는 것이다.
한 개를 꺼낸 뒤 반드시 가공한 값을 다시 넣고,
종료할 때도 0을 뒤에 넣은 다음 결과를 반환한다.
감소량 갱신식 `decrease % 5 + 1`은 다음 순서를 만든다.
```text
1 → 2 → 3 → 4 → 5 → 1 → ...
```
실습 파일에는 다음 문제가 남아 있다.

- 선형 큐를 만든 직후 같은 변수 `q`에 원형 큐를 다시 대입해 첫 구현을 버린다.
- 실제 감소 반복문과 출력이 작성되지 않아 실행해도 암호를 만들지 않는다.
- 주석 한 곳은 감소 순서를 `1, 2, 3, 5`로 적어 `4`를 빠뜨렸다.
- 입력 첫 줄을 테스트 수 `T`로 해석하는데, 사용하는 문제의 실제 입력 계약과 일치하는지 확인이 필요하다.
- 선형 큐를 `100000`칸으로 잡는 방식은 종료 횟수를 모른다는 문제를 메모리 과다 할당으로 미룬다.

원형 큐를 직접 쓴다면 8개 원소를 저장하기 위해 9칸을 만든 부분은 올바르다.
그러나 이 문제에서는 `deque`가 더 간결하고 안전하다.
⚠️ 주의: 학습용 미완성 파일은 설계 아이디어를 보여 줄 수 있지만, 실행 가능한 정답으로 간주하면 안 된다. 반복, 종료, 출력, 입력 형식을 모두 검증해야 한다.

### 3.20 BFS의 개념과 큐 불변식

BFS(Breadth First Search)는 시작 정점에서 가까운 정점부터 넓게 탐색하는 방법이다.
먼저 시작 정점의 모든 인접 정점을 발견하고,
그다음 한 간선 떨어진 정점들의 인접 정점을 조사한다.
큐를 사용하면 먼저 발견한 정점을 먼저 확장하므로 이 순서가 자연스럽게 유지된다.
강의의 트리 모양 예시에서 시작점이 `A`이고 인접 순서가 왼쪽부터라면 방문 순서는 다음과 같다.
```text
A → B → C → D → E → F → G → H → I
```
BFS에서 큐의 의미는 다음 한 문장으로 잡을 수 있다.

> 큐에는 이미 발견되어 방문 예약은 되었지만, 아직 모든 인접 정점을 조사하지 않은 정점이 들어 있다.

이 불변식을 유지하려면 큐에 넣는 순간 “발견됨”을 기록해야 한다.
큐에서 꺼낸 정점은 그때 인접 정점을 조사하고,
조사가 끝나면 처리 완료 상태가 된다.
그래프가 인접 리스트로 주어졌을 때 시간 복잡도는 `O(V + E)`다.
각 정점을 한 번 발견하고,
각 간선을 인접 리스트에서 한 번씩 확인하기 때문이다.
방문 배열과 큐, 인접 리스트를 포함한 공간은 `O(V + E)`다.

### 3.21 방문 표시 시점: enqueue 때 표시하기

강의의 첫 BFS 의사코드는 큐에서 꺼낸 뒤 방문 표시를 한다.
```python
# 개념 설명용이지만 일반 그래프에서는 중복 삽입이 생길 수 있다.
while queue:
    current = queue.pop(0)
    if not visited[current]:
        visited[current] = True
        for neighbor in graph[current]:
            if not visited[neighbor]:
                queue.append(neighbor)
```
트리처럼 각 노드로 들어가는 경로가 하나뿐이면 문제가 잘 드러나지 않는다.
하지만 일반 그래프에서 두 정점이 같은 이웃을 발견하면,
그 이웃이 아직 dequeue되지 않아 `visited`가 거짓인 동안 여러 번 큐에 들어갈 수 있다.
```text
A의 이웃: B, C
B의 이웃: D
C의 이웃: D
```
`B`가 `D`를 넣은 뒤에도 `D`의 방문 표시가 아직 없다면,
`C`도 `D`를 다시 넣는다.
중복 삽입은 큐 크기와 실행 시간을 늘리고,
거리나 부모를 나중에 덮어쓰는 버그로 이어질 수 있다.
일반적인 BFS는 발견한 즉시 표시한다.
```python
from collections import deque
def bfs_order(graph, start):
    visited = [False] * len(graph)
    queue = deque([start])
    visited[start] = True
    order = []
    while queue:
        current = queue.popleft()
        order.append(current)
        for neighbor in graph[current]:
            if not visited[neighbor]:
                visited[neighbor] = True
                queue.append(neighbor)
    return order
```
방문 표시가 `queue.append(neighbor)`와 한 묶음으로 붙어 있다는 점이 중요하다.
`visited`는 단순히 “처리를 끝냈다”가 아니라,
이 구현에서는 “이미 발견되어 큐에 들어갔거나 처리를 마쳤다”는 뜻이다.
⚠️ 주의: 방문 표시의 의미를 “dequeue 완료”와 “enqueue 예약” 사이에서 섞지 말아야 한다. BFS 중복 방지에는 enqueue 시점의 발견 표시가 안전하다.

### 3.22 그래프 입력과 BFS 순회

강의 예제는 정점 7개와 간선 8개를 다음 순서로 준다.
```text
1-2, 1-3, 2-4, 2-5, 4-6, 5-6, 6-7, 3-7
```
무방향 그래프이므로 간선을 양쪽 인접 리스트에 모두 넣어야 한다.
```python
from collections import deque
def build_undirected_graph(vertex_count, edges):
    graph = [[] for _ in range(vertex_count + 1)]
    for a, b in edges:
        graph[a].append(b)
        graph[b].append(a)
    return graph
def bfs(graph, start):
    visited = [False] * len(graph)
    queue = deque([start])
    visited[start] = True
    order = []
    while queue:
        current = queue.popleft()
        order.append(current)
        for neighbor in graph[current]:
            if not visited[neighbor]:
                visited[neighbor] = True
                queue.append(neighbor)
    return order
edges = [
    (1, 2), (1, 3), (2, 4), (2, 5),
    (4, 6), (5, 6), (6, 7), (3, 7),
]
graph = build_undirected_graph(7, edges)
print(*bfs(graph, 1))
# 1 2 3 4 5 7 6
```
강의 출력 예시는 `1 2 3 4 5 7 6`이다.
BFS 순서는 그래프 구조만으로 하나로 고정되는 것이 아니다.
같은 레벨의 정점은 인접 리스트에 들어 있는 순서에 따라 방문 순서가 달라질 수 있다.
문제가 “번호가 작은 정점부터”를 요구하면 각 인접 리스트를 정렬해야 한다.
정렬 비용은 별도로 발생한다.
또 그래프가 끊어져 있으면 한 시작점의 BFS만으로 모든 정점을 방문하지 못한다.
모든 연결 요소를 순회하려면 방문하지 않은 정점마다 BFS를 다시 시작한다.

### 3.23 BFS 거리 배열의 의미

방문 배열에 참·거짓 대신 거리를 저장할 수 있다.
시작 정점의 거리를 0으로 두고,
이웃은 현재 거리에 1을 더한다.
```python
from collections import deque
def bfs_distances(graph, start):
    distance = [-1] * len(graph)
    distance[start] = 0
    queue = deque([start])
    while queue:
        current = queue.popleft()
        for neighbor in graph[current]:
            if distance[neighbor] == -1:
                distance[neighbor] = distance[current] + 1
                queue.append(neighbor)
    return distance
```
여기서 `-1`은 아직 발견하지 못했다는 표시다.
시작 거리를 0으로 두면 `distance[v]`는 시작점에서 `v`까지 지나간 간선 수가 된다.
강의의 두 번째 BFS 코드는 시작점을 `1`로 표시하고 이웃에 `visited[t] + 1`을 저장한다.
그 표현도 레벨 계산에는 사용할 수 있지만,
저장값은 실제 간선 거리보다 1 크다.
따라서 문제의 출력이 간선 수인지,
방문 칸 수인지,
시작 칸을 포함한 이동 단계인지 확인해야 한다.
`-1`을 미방문,
0을 시작 거리로 쓰면 두 의미가 겹치지 않아 해석이 명확하다.
📌 핵심: BFS의 거리 값은 발견 시 한 번만 확정되며, 무가중 그래프에서는 그 값이 최단 간선 수다.

### 3.24 BFS가 무가중 최단 거리를 보장하는 이유

BFS 큐에는 거리가 작은 정점이 먼저 들어간다.
시작점의 거리는 0이다.
거리 0인 정점을 처리하면서 거리 1인 정점을 넣는다.
거리 1인 정점들을 모두 처리하기 전에 거리 2인 정점이 앞질러 나올 수 없다.
FIFO가 같은 발견 순서를 보존하기 때문이다.
따라서 큐에서 처리되는 거리의 흐름은 감소하지 않는다.
```text
0, 1, 1, 1, 2, 2, 2, ...
```
어떤 정점을 처음 발견한 경로보다 더 짧은 경로가 나중에 나타나려면,
더 작은 거리의 정점이 나중에 처리되어야 한다.
하지만 FIFO 레벨 순서에서는 그런 일이 일어나지 않는다.
그래서 첫 발견 거리를 확정해도 안전하다.
단 이 보장은 모든 간선 비용이 동일할 때 성립한다.
가중치가 서로 다르면 간선 수가 적은 경로가 비용이 작은 경로라는 보장이 없다.
그때는 다익스트라 같은 우선순위 큐 기반 알고리즘이 필요하다.

### 3.25 BFS를 활용한 미로 탐색

격자 미로도 그래프로 볼 수 있다.
통로 칸 하나가 정점이고,
상하좌우로 이동 가능한 두 칸 사이에 간선이 있다고 생각하면 된다.
미로 탐색의 입력과 출력은 다음처럼 정리할 수 있다.

- 입력: 벽과 통로가 표시된 2차원 격자, 시작 좌표, 도착 좌표
- 출력: 도착까지의 최단 이동 횟수 또는 도달 불가 표시
- 불변식: 큐의 좌표는 이미 최단 거리가 확정된 발견 좌표다.
- 종료: 도착 좌표를 꺼내거나 큐가 빌 때까지 반복한다.

상하좌우 방향은 변화량 배열로 표현한다.
```python
DIRECTIONS = ((-1, 0), (1, 0), (0, -1), (0, 1))
```
다음 코드는 `0`을 통로,
`1`을 벽으로 해석한다.
```python
from collections import deque
def shortest_maze_distance(maze, start, goal):
    rows = len(maze)
    if rows == 0:
        return -1
    cols = len(maze[0])
    sr, sc = start
    gr, gc = goal
    if not (0 <= sr < rows and 0 <= sc < cols):
        return -1
    if not (0 <= gr < rows and 0 <= gc < cols):
        return -1
    if maze[sr][sc] == 1 or maze[gr][gc] == 1:
        return -1
    distance = [[-1] * cols for _ in range(rows)]
    distance[sr][sc] = 0
    queue = deque([(sr, sc)])
    while queue:
        row, col = queue.popleft()
        if (row, col) == (gr, gc):
            return distance[row][col]
        for dr, dc in DIRECTIONS:
            nr = row + dr
            nc = col + dc
            if not (0 <= nr < rows and 0 <= nc < cols):
                continue
            if maze[nr][nc] == 1:
                continue
            if distance[nr][nc] != -1:
                continue
            distance[nr][nc] = distance[row][col] + 1
            queue.append((nr, nc))
    return -1
```
강의 그림은 시작 칸을 `1`로 표시하고 다음 칸을 `2`로 표시한다.
그 숫자는 시작 칸을 포함한 방문 단계 수다.
위 코드는 시작 거리를 0으로 두므로 실제 이동 횟수를 반환한다.
예를 들어 시작과 도착이 같으면 이동 횟수는 0이다.
문제가 칸 수를 요구하면 결과에 1을 더하는 등 출력 정의에 맞춰야 한다.

### 3.26 미로 탐색의 방문 시점과 경계 조건

미로에서도 방문 표시는 큐에 넣을 때 해야 한다.
한 통로 칸으로 여러 방향에서 들어갈 수 있기 때문이다.
표시를 dequeue 때로 미루면 같은 좌표가 여러 번 큐에 들어간다.
거리 배열을 방문 배열로 함께 쓰면 상태가 간결해진다.
```python
if distance[nr][nc] == -1:
    distance[nr][nc] = distance[row][col] + 1
    queue.append((nr, nc))
```
이 세 줄의 순서를 바꾸지 않는 것이 좋다.
먼저 거리를 기록해 발견 상태로 만들고,
그다음 큐에 넣는다.
미로 문제에서 자주 틀리는 경계는 다음과 같다.

- `0 <= nr < rows`, `0 <= nc < cols` 중 하나를 빠뜨린다.
- 행과 열의 크기가 다른 직사각형 미로에서 둘 다 `N`으로 검사한다.
- 벽 값과 통로 값의 의미를 반대로 해석한다.
- 시작점 또는 도착점이 벽인 경우를 처리하지 않는다.
- 도달할 수 없는데 기본값 0을 반환해 시작점과 구분하지 못한다.
- 시작 칸 포함 거리와 이동 횟수를 혼동한다.
- 도착을 발견했을 때와 dequeue했을 때의 종료 의미를 섞는다.

도착을 이웃으로 처음 발견하는 순간에도 최단 거리는 확정된다.
따라서 그 자리에서 반환해도 된다.
다만 코드의 불변식을 단순하게 유지하려면 모든 정점을 같은 방식으로 enqueue하고,
dequeue 직후 도착 여부를 검사하는 방법도 충분히 안전하다.

### 3.27 큐 구현 선택 기준

문제에서 “큐”가 보인다고 항상 직접 구현할 필요는 없다.
선택 기준은 필요한 연산과 제약이다.

| 상황 | 적합한 선택 | 이유 |
|---|---|---|
| 파이썬 일반 FIFO | `deque` | 양끝 `O(1)`, 코드가 간결함 |
| 고정 크기 장치 버퍼 | 원형 큐 | 메모리를 반복 재사용함 |
| 연결 구조 학습 | 연결 큐 | 링크와 경계 상태를 이해할 수 있음 |
| 최고 우선순위 처리 | 힙 기반 우선순위 큐 | 삽입·삭제 `O(log n)` |
| 회전 뒤 한 위치만 필요 | 모듈러 인덱스 | 실제 큐 연산을 생략할 수 있음 |
| BFS | `deque` | enqueue와 dequeue가 모두 `O(1)` |

직접 구현은 불변식을 배우는 데 중요하다.
문제 풀이에서는 검증된 표준 자료구조를 사용해 알고리즘 자체에 집중하는 편이 보통 더 안전하다.

---

## 4. 적용 관점에서 다시 보기

본문의 개념을 실제 문제에서 꺼내 쓰려면 먼저 “대기 순서가 답에 영향을 주는가?”를 확인한다.
먼저 들어온 작업을 먼저 처리해야 한다면 일반 큐가 출발점이다.
가장 최근 상태로 되돌아가야 한다면 스택,
가장 중요한 항목을 먼저 골라야 한다면 우선순위 큐다.

### 4.1 큐 문제의 구현 순서

큐 문제를 만나면 다음 순서로 설계한다.

1. 큐 원소 하나가 무엇을 담아야 하는지 정한다.
2. enqueue 시점과 dequeue 시점에 상태가 어떻게 바뀌는지 적는다.
3. 공백과 포화 조건을 정한다.
4. 반복문의 종료 조건을 정한다.
5. 각 원소가 큐에 몇 번 들어가는지 계산한다.
6. 요구 범위에서 시간과 메모리가 충분한지 확인한다.

마이쮸 문제에서는 `(사람 번호, 다음 지급량)`이 원소다.
BFS에서는 정점 번호 또는 좌표가 원소다.
암호 생성기에서는 현재 숫자 하나가 원소이고 감소량은 큐 밖의 주기 상태다.
원소에 필요한 상태를 덜 넣으면 dequeue한 뒤 다음 동작을 결정할 수 없다.
반대로 모든 전역 상태를 원소마다 복사하면 메모리를 낭비한다.

### 4.2 배열 큐 디버깅 체크

배열 큐가 틀렸다면 실제 배열 내용만 보지 말고 다음 값을 함께 출력한다.
```text
front, rear, is_empty, is_full, logical size
```
선형 큐에서는 유효 구간이 `front + 1 ... rear`인지 확인한다.
원형 큐에서는 다음 인덱스 계산에 항상 `% len(queue)`가 들어가는지 확인한다.
원형 큐의 내부 길이와 저장 가능한 논리 용량을 구분한다.
삭제 후 오래된 값이 배열에 남는 것은 오류가 아닐 수 있다.
오류 여부는 인덱스 불변식으로 판단한다.

### 4.3 성능 신호 읽기

파이썬 코드에서 `pop(0)`가 반복문 안에 보이면 입력 크기를 먼저 확인한다.
BFS처럼 모든 정점을 꺼내는 알고리즘이라면 `deque.popleft()`로 바꿔야 `O(V + E)` 분석이 실제 구현에서도 유지된다.
회전 횟수가 매우 크고 최종 위치만 묻는다면 큐 시뮬레이션보다 `% N`을 떠올린다.
고정 크기 공간에서 계속 넣고 빼면 선형 큐보다 원형 큐가 적합하다.
이처럼 자료구조 선택은 문법 문제가 아니라 전체 복잡도를 결정한다.

### 4.4 BFS 적용 신호

다음 표현이 보이면 BFS를 우선 검토한다.

- 시작점에서 가까운 순서로 탐색한다.
- 간선 가중치가 모두 같고 최단 이동 횟수를 구한다.
- 최소 버튼 클릭 수, 최소 변환 횟수, 최소 턴 수를 구한다.
- 격자에서 상하좌우 최단 경로를 구한다.
- 같은 단계의 상태를 모두 처리한 뒤 다음 단계로 넘어간다.

구현할 때는 시작점을 큐에 넣는 동시에 방문 표시한다.
이웃도 큐에 넣는 순간 거리와 방문 상태를 확정한다.
큐가 빌 때까지 도착하지 못하면 도달 불가다.
그래프 전체 순회가 목적이고 연결 그래프 보장이 없다면,
바깥 반복문으로 모든 정점을 확인해 새 BFS를 시작한다.

### 4.5 자주 틀리는 패턴

- `front`를 첫 원소 인덱스인지 마지막 삭제 인덱스인지 정하지 않고 섞는다.
- 빈 큐에서 먼저 값을 읽은 뒤 공백을 검사한다.
- 원형 큐 배열 `N`칸에 `N`개를 저장하려 한다.
- `% N`을 삽입에만 쓰고 삭제 인덱스에는 빠뜨린다.
- 연결 큐의 마지막 원소를 삭제하고 `rear`를 남겨 둔다.
- `list.pop(0)`으로 BFS를 구현하고도 `O(V + E)`라고만 분석한다.
- 방문 표시를 dequeue까지 미뤄 같은 정점이 여러 번 들어가게 한다.
- 무방향 간선을 한 방향에만 저장한다.
- 같은 레벨의 순서가 인접 리스트 순서에 따라 달라질 수 있음을 놓친다.
- 미로에서 시작 칸 포함 거리와 이동 횟수를 혼동한다.

🧠 기억할 것: 큐 문제는 값보다 순서와 상태 전이가 핵심이며, BFS 문제는 enqueue 순간의 발견 처리가 정확성과 성능을 함께 지킨다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

배열에 빈칸이 보여도 선형 큐의 `rear`가 끝에 도달하면 재사용할 수 없다는 false overflow를 이해했다. 또한 원형 큐가 한 칸을 비우는 이유는 낭비가 아니라 `front == rear`를 공백 상태로 유일하게 해석하기 위한 상태 표현 규칙임을 알 수 있었다.

### 5.2 앞으로 이어지는 연결점

큐의 FIFO는 BFS의 레벨 순서를 만들고, 거리 배열과 결합하면 무가중 그래프와 미로의 최단 거리를 구할 수 있다. 이후 트리의 레벨 순회, 위상 정렬, 다중 시작점 BFS에서도 같은 큐 불변식과 enqueue 시점 방문 표시를 그대로 사용한다.

### 5.3 더 파볼 만한 주제

고정 크기 링 버퍼에서 원소 수를 별도로 저장해 배열 모든 칸을 사용하는 방법, 양쪽 끝을 쓰는 0-1 BFS, 우선순위 큐를 사용하는 다익스트라, 동시성 환경의 blocking queue와 생산자-소비자 문제를 확장해 볼 수 있다.

---

## 6. 요약 정리

📌 핵심 정리

- 큐는 뒤에서 삽입하고 앞에서 삭제하는 FIFO 자료구조다.
- 선형 배열 큐에서 `front`는 마지막 삭제 위치, `rear`는 마지막 삽입 위치로 둘 수 있다.
- 선형 큐는 삭제된 앞 공간을 재사용하지 못해 false overflow가 생긴다.
- 원형 큐는 `(index + 1) % N`으로 배열 끝과 처음을 논리적으로 연결한다.
- 한 칸을 비우는 원형 큐는 배열 길이가 `N`일 때 `N - 1`개만 저장한다.
- 연결 큐는 첫 삽입과 마지막 삭제 때 `front`와 `rear`를 함께 갱신해야 한다.
- 파이썬의 일반 FIFO에는 `deque.append()`와 `deque.popleft()`가 적합하다.
- `list.pop(0)`은 한 번에 `O(n)`, 전체 삭제에 `O(n²)`이 들 수 있다.
- 우선순위 큐는 FIFO가 아니라 우선순위가 높은 항목을 먼저 꺼낸다.
- 버퍼는 임시 저장 영역이고 FIFO 큐는 순차 처리 정책을 제공한다.
- 시뮬레이션에서는 큐 원소가 다음 동작에 필요한 상태를 함께 가져야 한다.
- BFS 큐에는 발견되었지만 아직 인접 정점을 모두 조사하지 않은 정점이 들어 있다.
- 방문과 거리는 enqueue하는 순간 기록해야 중복 삽입을 막을 수 있다.
- BFS는 무가중 그래프에서 레벨 순서를 유지하므로 첫 발견 거리가 최단 거리다.
- 미로에서는 좌표 경계, 벽, 미방문 여부를 모두 통과한 이웃만 큐에 넣는다.

🧠 기억할 것

- 저장 배열의 값이 남아 있는지보다 `front`와 `rear`가 만드는 논리 구간을 본다.
- 원형 큐의 포화 조건은 `(rear + 1) % N == front`다.
- 연결 큐가 비면 `front is None`과 `rear is None`이 동시에 성립해야 한다.
- BFS에서는 `visited`를 “처리 완료”보다 “발견 완료”로 해석하면 구현이 안전하다.
- 최단 거리의 단위가 간선 수인지 시작 칸 포함 칸 수인지 출력 정의를 먼저 확인한다.

---

## 7. 미니 퀴즈 또는 체크리스트

### 미니 퀴즈

1. 크기 5인 선형 큐에서 앞의 네 칸을 삭제했는데도 새 원소를 넣을 수 없는 이유를 `front`, `rear`와 false overflow라는 말로 설명해 보자.
2. 한 칸을 비우는 원형 큐의 배열 길이가 8이라면 최대 몇 개를 저장할 수 있는가? 공백 조건과 포화 조건도 함께 적어 보자.
3. 연결 큐에 원소가 하나만 있을 때 `dequeue()`한 뒤 `front`와 `rear`는 각각 어떤 값이어야 하는가?
4. `list.pop(0)`을 `n`번 반복하는 코드와 `deque.popleft()`를 `n`번 반복하는 코드의 전체 시간 복잡도는 각각 무엇인가?
5. 일반 그래프 BFS에서 방문 표시를 dequeue 시점까지 미루면 같은 정점이 큐에 중복 삽입될 수 있는 예를 만들어 보자.
6. BFS 거리 배열을 `-1`로 초기화하고 시작점을 0으로 두는 방식이 참·거짓 방문 배열보다 편리한 이유는 무엇인가?
7. 가중치가 서로 다른 그래프에서 BFS가 최소 비용 경로를 항상 보장하지 않는 이유를 설명해 보자.

### 이해 점검 체크리스트

- [ ] FIFO를 삽입 위치와 삭제 위치를 사용해 설명할 수 있다.
- [ ] `enqueue`, `dequeue`, `peek`, `is_empty`, `is_full`의 역할을 구분할 수 있다.
- [ ] 선형 큐의 유효 구간 `front + 1 ... rear`를 읽을 수 있다.
- [ ] 배열에 값이 남아 있어도 논리적으로 삭제된 상태를 설명할 수 있다.
- [ ] false overflow가 생기는 상태를 직접 그릴 수 있다.
- [ ] 원형 인덱스가 `%` 연산으로 0으로 돌아오는 과정을 계산할 수 있다.
- [ ] 원형 큐에서 한 칸을 비우는 이유를 설명할 수 있다.
- [ ] 원형 큐의 실제 저장 용량과 내부 배열 길이를 구분할 수 있다.
- [ ] 연결 큐의 첫 삽입과 마지막 삭제를 안전하게 구현할 수 있다.
- [ ] `deque`의 네 가지 양끝 연산을 상황에 맞게 선택할 수 있다.
- [ ] `pop(0)`의 원소 이동 비용을 설명할 수 있다.
- [ ] 벤치마크에서 같은 작업과 같은 측정 범위를 비교해야 함을 설명할 수 있다.
- [ ] 일반 큐와 우선순위 큐의 삭제 정책을 구분할 수 있다.
- [ ] 버퍼가 생산자와 소비자의 속도 차이를 어떻게 흡수하는지 설명할 수 있다.
- [ ] 마이쮸 시뮬레이션에서 큐 원소에 필요한 두 상태를 말할 수 있다.
- [ ] 암호 생성기의 감소 주기 `1 → 2 → 3 → 4 → 5 → 1`을 구현할 수 있다.
- [ ] BFS 큐의 불변식을 한 문장으로 설명할 수 있다.
- [ ] 시작점과 이웃의 방문 표시를 enqueue 시점에 할 수 있다.
- [ ] 인접 리스트로 구현한 BFS가 `O(V + E)`인 이유를 설명할 수 있다.
- [ ] 인접 정점 순서가 BFS 출력 순서에 영향을 줄 수 있음을 안다.
- [ ] 끊어진 그래프 전체를 탐색하려면 BFS를 여러 번 시작할 수 있다.
- [ ] 거리 배열 하나로 방문 여부와 최단 거리를 함께 관리할 수 있다.
- [ ] 격자 좌표의 행·열 경계를 각각 검사할 수 있다.
- [ ] 미로에서 도달 불가와 거리 0을 서로 다른 값으로 표현할 수 있다.
- [ ] 시작 칸 포함 거리와 실제 이동 횟수를 문제 정의에 맞게 변환할 수 있다.
