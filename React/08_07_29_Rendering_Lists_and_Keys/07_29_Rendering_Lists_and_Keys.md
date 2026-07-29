# TypeScript로 배우는 리스트 렌더링과 key

- 🎯 글의 목표: 배열 데이터를 `map()`과 `filter()`로 JSX 목록으로 변환하고 안정적인 `key`를 선택한다.
- 🧩 핵심 키워드: 배열, `map`, `filter`, `key`, 안정적인 ID, Fragment
- ⭐ 중요도: 상 — 게시글, 댓글, 상품, 메뉴처럼 대부분의 실제 화면은 목록 데이터를 포함한다.
- 📝 한눈에 보는 내용: 배열의 각 데이터를 JSX로 변환하고 형제 항목을 구분하는 안정적인 key를 제공한다.
- 🔗 관련 주제: 조건부 렌더링, Props, 불변성, 상태 보존
- 🧱 선수 지식: 배열, 객체, `map()`, `filter()`, TypeScript 객체 타입

---

## 1. 들어가며

다음처럼 같은 마크업을 반복해서 작성하면 데이터가 늘어날 때 코드도 계속 늘어난다.

```tsx
<ul>
  <li>JSX 복습</li>
  <li>Props 복습</li>
  <li>조건부 렌더링 복습</li>
</ul>
```

React에서는 반복되는 내용을 배열에 저장하고 배열 메서드로 JSX 목록을 만든다.

## 2. 핵심 개념 정리

```text
TypeScript 배열 데이터
          ↓ filter()
표시할 데이터만 선택
          ↓ map()
각 데이터를 JSX로 변환
          ↓ key 지정
React가 항목의 정체성을 구분
          ↓
목록 렌더링
```

```text
filter: 어떤 데이터를 보여줄 것인가?
map: 각 데이터를 어떤 JSX로 바꿀 것인가?
key: 각 항목을 이전 렌더링과 어떻게 연결할 것인가?
```

## 3. 본문 정리

### 3.1 배열을 JSX 배열로 변환하기

```tsx
type StudyTopic = {
  id: number
  title: string
}

const topics: StudyTopic[] = [
  { id: 1, title: 'JSX' },
  { id: 2, title: 'Props' },
  { id: 3, title: '조건부 렌더링' },
]

function StudyList() {
  const listItems = topics.map((topic) => (
    <li key={topic.id}>{topic.title}</li>
  ))

  return <ul>{listItems}</ul>
}
```

`map()`은 원본 배열의 각 항목을 새로운 값으로 바꾼 배열을 반환한다.

```text
StudyTopic 객체 배열
→ map에서 객체 하나씩 받음
→ 각 객체를 <li> React 엘리먼트로 변환
→ React 엘리먼트 배열 생성
→ <ul> 안에서 렌더링
```

JSX 안에 바로 작성할 수도 있다.

```tsx
function StudyList() {
  return (
    <ul>
      {topics.map((topic) => (
        <li key={topic.id}>{topic.title}</li>
      ))}
    </ul>
  )
}
```

변환이 단순하면 JSX 안에 작성하고, 복잡하면 의미 있는 변수나 자식 컴포넌트로 분리한다.

### 3.2 `filter()`로 표시할 데이터 선택하기

```tsx
type Task = {
  id: number
  title: string
  completed: boolean
}

type TaskListProps = {
  tasks: Task[]
  showCompleted: boolean
}

function TaskList({ tasks, showCompleted }: TaskListProps) {
  const visibleTasks = showCompleted
    ? tasks
    : tasks.filter((task) => !task.completed)

  return (
    <ul>
      {visibleTasks.map((task) => (
        <li key={task.id}>
          {task.title}
          {task.completed && ' ✅'}
        </li>
      ))}
    </ul>
  )
}
```

`filter()`는 조건이 참인 항목만 모은 새 배열을 만든다. 원본 `tasks` 배열을 직접 바꾸지 않는다.

```text
tasks
→ filter로 미완료 항목 선택
→ map으로 각 Task를 <li>로 변환
```

### 3.3 `key`는 형제 사이에서 항목을 식별한다

```tsx
<li key={task.id}>{task.title}</li>
```

key는 React가 이전 목록과 다음 목록의 항목을 연결할 때 사용하는 힌트다.

```text
이전 렌더링: [A, B, C]
다음 렌더링: [B, C, D]

안정적인 key가 있으면
→ A 제거
→ B와 C 유지
→ D 추가
```

key가 없거나 불안정하면 React가 항목의 이동·추가·삭제를 잘못 연결할 수 있다.

### 3.4 좋은 key의 조건

좋은 key는 다음 조건을 만족한다.

1. 같은 배열의 형제 사이에서 고유하다.
2. 렌더링이 반복되어도 같은 데이터에는 같은 값이다.
3. 데이터가 생성될 때 정해지며 렌더링 중 새로 만들지 않는다.

```tsx
type Post = {
  id: string
  title: string
}

function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

일반적으로 다음 값을 사용한다.

- 서버나 데이터베이스가 제공하는 ID
- 데이터를 생성할 때 한 번 만든 UUID
- 변경되지 않는 도메인 고유값

### 3.5 index를 key로 사용할 때의 문제

```tsx
{tasks.map((task, index) => (
  <li key={index}>{task.title}</li>
))}
```

배열의 순서가 절대 바뀌지 않는 정적인 목록에서는 동작할 수 있다. 하지만 항목을 추가·삭제·정렬하면 같은 index가 다른 데이터를 가리키게 된다.

```text
처음
0 → 사과
1 → 바나나
2 → 포도

사과 삭제 후
0 → 바나나
1 → 포도
```

React 입장에서 key `0`은 남아 있지만 실제 데이터는 사과에서 바나나로 바뀌었다. 항목 내부에 input이나 state가 있다면 잘못된 데이터에 상태가 연결되는 버그가 생길 수 있다.

### 3.6 렌더링 중 key를 생성하지 않는다

```tsx
// 잘못된 예
{tasks.map((task) => (
  <li key={Math.random()}>{task.title}</li>
))}
```

`Math.random()`은 렌더링마다 값이 달라진다. React는 모든 항목을 새로운 항목으로 판단할 수 있다.

```text
이전 key와 다음 key가 전부 다름
→ 기존 항목 제거
→ 새 항목 생성
→ DOM과 컴포넌트 state가 불필요하게 초기화
```

UUID가 필요하면 항목을 생성하는 시점에 한 번 만든 뒤 데이터에 저장한다.

```ts
const newTask: Task & { id: string } = {
  id: crypto.randomUUID(),
  title: '리스트 렌더링 복습',
  completed: false,
}
```

### 3.7 `key`는 컴포넌트의 Props로 전달되지 않는다

```tsx
type TaskItemProps = {
  taskId: number
  title: string
}

function TaskItem({ taskId, title }: TaskItemProps) {
  return <li>#{taskId} {title}</li>
}

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <ul>
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          taskId={task.id}
          title={task.title}
        />
      ))}
    </ul>
  )
}
```

`key`는 React만 사용한다. 자식 컴포넌트에서 ID가 필요하면 `taskId`처럼 별도 Props로 전달한다.

### 3.8 한 항목에서 여러 DOM 요소 반환하기

짧은 Fragment `<>...</>`에는 key를 지정할 수 없다. 여러 요소를 DOM 래퍼 없이 묶고 key가 필요하다면 명시적인 `Fragment`를 사용한다.

```tsx
import { Fragment } from 'react'

type Section = {
  id: number
  title: string
  description: string
}

function SectionList({ sections }: { sections: Section[] }) {
  return (
    <div>
      {sections.map((section) => (
        <Fragment key={section.id}>
          <h2>{section.title}</h2>
          <p>{section.description}</p>
        </Fragment>
      ))}
    </div>
  )
}
```

Fragment 자체는 실제 DOM 태그를 만들지 않는다.

### 3.9 빈 배열도 화면 상태로 다룬다

```tsx
function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <p>등록된 할 일이 없습니다.</p>
  }

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  )
}
```

빈 배열을 단순히 아무것도 없는 화면으로 두기보다 사용자가 현재 상태를 이해할 수 있는 안내를 제공한다.

## 4. 적용 관점에서 다시 보기

목록 UI는 다음 순서로 작성한다.

1. 항목 하나의 TypeScript 타입을 정의한다.
2. 데이터에 안정적인 ID가 있는지 확인한다.
3. 조건이 필요하면 `filter()`로 표시할 배열을 만든다.
4. `map()`으로 항목을 컴포넌트나 JSX로 변환한다.
5. `map()`이 직접 반환하는 최상위 요소에 key를 지정한다.
6. 빈 배열일 때 보여줄 화면을 결정한다.

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

- `map()`은 데이터를 JSX 배열로 변환한다.
- key는 화면에 표시하는 값이 아니라 React가 항목의 정체성을 판단하는 값이다.
- index와 랜덤값은 변경되는 목록의 안정적인 key가 아니다.

### 5.2 이전·다음 학습과의 연결

조건부 렌더링은 어떤 목록을 보여줄지 결정하고, 리스트 렌더링은 데이터를 반복 UI로 변환한다. 다음 문서에서는 이 계산이 원본 데이터나 외부 값을 바꾸지 않는 순수한 과정이어야 하는 이유를 다룬다.

### 5.3 더 확인할 주제

- 배열 state를 불변하게 업데이트하기
- key에 따른 state 보존과 초기화
- 큰 목록의 가상화

## 6. 요약 정리

1. 배열 데이터는 `map()`으로 JSX 배열로 변환한다.
2. `filter()`는 표시할 항목만 선택한 새 배열을 만든다.
3. `map()`이 직접 반환하는 JSX에는 key가 필요하다.
4. key는 같은 형제 배열 안에서 고유하고 렌더링 사이에 안정적이어야 한다.
5. 변경되는 목록에서는 배열 index를 key로 사용하지 않는 편이 좋다.
6. `Math.random()`처럼 렌더링마다 바뀌는 값을 key로 만들지 않는다.
7. key는 자식 Props로 전달되지 않으므로 필요한 ID는 별도로 전달한다.

🧠 기억할 것: key는 목록의 “현재 위치 번호”가 아니라 렌더링이 달라져도 같은 데이터를 알아볼 수 있게 하는 이름표다.

## 7. 미니 퀴즈

1. `filter()`와 `map()`은 각각 어떤 역할을 하는가?
2. key가 형제 사이에서 안정적이어야 하는 이유는 무엇인가?
3. 항목 삭제가 가능한 목록에서 index key가 위험한 이유는 무엇인가?
4. 자식 컴포넌트에서 key 값을 읽으려면 어떻게 해야 하는가?

<details>
<summary>정답과 해설</summary>

1. `filter()`는 항목을 선택하고 `map()`은 각 항목을 새로운 값이나 JSX로 변환한다.
2. React가 이전 항목과 다음 항목을 정확히 연결해야 하기 때문이다.
3. 삭제 후 index가 당겨지면서 같은 key가 다른 데이터를 가리킬 수 있다.
4. key와 별도로 `taskId` 같은 일반 Props를 전달해야 한다.

</details>

## 참고 자료

- [React 공식 문서: Rendering Lists](https://react.dev/learn/rendering-lists)
- [React 공식 문서: Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
