# 미니 프로젝트: 학습 기록 대시보드

- 🎯 글의 목표: 컴포넌트·Props·state·폼·리스트·라우팅을 하나의 작은 앱 구조로 연결한다.
- 🧩 핵심 키워드: 데이터 모델, 컴포넌트 책임, route, params, controlled form
- ⭐ 중요도: ★★★★★ — 분리해서 배운 개념을 실제 화면 흐름으로 조합하는 단계다.
- 📝 한눈에 보는 내용: 학습 기록의 타입을 먼저 정의하고, 목록·상세·작성 페이지의 책임을 나눈 뒤 URL과 컴포넌트를 연결한다.
- 🔗 관련 주제: 리스트, 폼, state 끌어올리기, React Router
- 🧱 선수 지식: 01~16번 React 문서의 기본 개념

---

이 프로젝트는 지금까지 학습한 컴포넌트, Props, state, 폼, 목록과 라우팅을 **학습 기록 대시보드**에 연결한다. 코드를 작성하기 전에 데이터와 화면의 책임을 나누는 연습에 초점을 둔다.

## 1. 요구사항

- `/`에서 학습 기록 목록을 보여 준다.
- `/notes/:noteId`에서 한 기록의 상세 내용을 보여 준다.
- `/notes/new`에서 제목과 분류를 입력해 새 기록을 추가한다.
- 목록은 완료 여부로 필터링한다.
- 존재하지 않는 ID에는 안내 화면을 보여 준다.

## 2. 데이터 모델

```tsx
export type StudyNote = {
  // URL과 목록 key에서 사용할 변하지 않는 식별자다.
  id: string
  // 목록과 상세 화면에 표시할 제목이다.
  title: string
  // 허용할 분류만 유니언 타입으로 제한한다.
  category: 'react' | 'typescript'
  // 학습 완료 여부를 boolean으로 표현한다.
  completed: boolean
  // 상세 페이지에 표시할 짧은 복습 내용이다.
  summary: string
}

// 첫 렌더링에 사용할 샘플 데이터다.
export const initialNotes: StudyNote[] = [
  {
    id: 'react-state',
    title: 'State 스냅샷 복습',
    category: 'react',
    completed: false,
    summary: '렌더링마다 state가 고정된 값처럼 보이는 이유를 정리한다.',
  },
]
```

ID는 데이터가 생성될 때 한 번 만든다. 렌더링 중 `Math.random()`으로 만들지 않는다.

이 코드는 화면을 그리지 않고 애플리케이션이 다룰 데이터의 모양을 정의한다. 이후 모든 컴포넌트는 같은 `StudyNote` 타입을 사용하므로 필드 이름을 잘못 적거나 허용되지 않은 category를 넣으면 TypeScript가 먼저 알려 준다.

## 3. 컴포넌트 책임

```text
App
├── AppLayout
│   ├── Navigation
│   └── Outlet
├── NoteListPage
│   ├── NoteFilter
│   └── NoteList
│       └── NoteListItem
├── NoteDetailPage
└── NewNotePage
    └── NoteForm
```

- 페이지는 route params와 화면 단위 state를 연결한다.
- 표시 컴포넌트는 가능한 한 props를 받아 JSX를 반환한다.
- 폼은 사용자 입력과 유효성 검사를 담당한다.
- 목록 필터 결과는 state로 복제하지 않고 렌더링 중 계산한다.

## 4. 현재 React Router의 선언형 구성

```bash
# 프로젝트 루트에서 라우팅 패키지를 설치한다.
npm install react-router
```

```tsx
import { BrowserRouter, Route, Routes } from 'react-router'

function AppRoutes() {
  // BrowserRouter가 브라우저 주소와 React 화면을 연결한다.
  return (
    <BrowserRouter>
      {/* 현재 URL과 일치하는 Route를 선택한다. */}
      <Routes>
        {/* path가 없는 부모 Route는 공통 레이아웃만 제공한다. */}
        <Route element={<AppLayout />}>
          {/* index Route는 부모 경로인 '/'에서 목록을 보여 준다. */}
          <Route index element={<NoteListPage />} />
          {/* 새 기록 작성 화면과 상세 화면의 URL을 각각 연결한다. */}
          <Route path="notes/new" element={<NewNotePage />} />
          <Route path="notes/:noteId" element={<NoteDetailPage />} />
          {/* 앞의 어떤 경로에도 맞지 않으면 안내 화면을 보여 준다. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

React Router의 선언형 모드는 설치한 주 버전에 맞는 패키지와 API를 사용해야 한다. 이 예제는 `react-router` 패키지를 기준으로 하며, 중첩 route의 자식 화면은 `AppLayout` 안의 `<Outlet />` 위치에 렌더링된다.

## 5. 상세 페이지에서 params 검증

```tsx
import { Link, useParams } from 'react-router'

function NoteDetailPage({ notes }: { notes: StudyNote[] }) {
  // URL의 :noteId 부분을 문자열로 읽는다.
  const { noteId } = useParams<{ noteId: string }>()

  // URL ID와 같은 기록을 배열에서 찾는다. 없으면 undefined가 된다.
  const note = notes.find(item => item.id === noteId)

  // 외부 입력인 URL이 잘못되었을 때도 빈 화면 대신 복구 경로를 제공한다.
  if (!note) {
    return (
      <section>
        <h1>기록을 찾을 수 없습니다.</h1>
        <Link to="/">목록으로</Link>
      </section>
    )
  }

  // 조회에 성공한 경우에만 note의 필드를 안전하게 사용한다.
  return (
    <article>
      <h1>{note.title}</h1>
      <p>{note.summary}</p>
    </article>
  )
}
```

TypeScript 타입은 URL 값이 실제 데이터에 존재함을 보장하지 않는다. params는 외부 입력이므로 조회 실패 UI가 필요하다.

## 6. 구현 순서

1. 정적 데이터로 목록과 상세 컴포넌트를 만든다.
2. 컴포넌트를 페이지와 재사용 UI로 나눈다.
3. route와 링크를 연결한다.
4. 목록 state를 가장 가까운 공통 부모에 둔다.
5. controlled 폼으로 새 항목을 추가한다.
6. 빈 목록, 잘못된 URL, 빈 제목을 직접 시험한다.

## 7. 완료 기준

- 새로고침해도 각 URL에 맞는 화면이 열린다.
- 목록의 `key`로 안정적인 `id`를 사용한다.
- 폼 버튼의 `type`이 의도와 맞다.
- state 배열을 직접 수정하지 않는다.
- route params와 사용자 입력을 신뢰하지 않고 검증한다.
- 각 컴포넌트의 책임을 한 문장으로 설명할 수 있다.

## 8. 적용 관점에서 다시 보기

구현은 데이터 모델에서 시작한다. 화면부터 만들면 같은 데이터의 필드 이름과 상태가 페이지마다 달라지기 쉽다. 타입을 정한 뒤 정적 목록을 렌더링하고, 상세 페이지와 작성 폼을 하나씩 연결한다.

라우팅 문제는 주소창의 URL, Route의 `path`, `useParams`로 읽은 값, 실제 데이터 ID를 순서대로 확인한다. 목록이 갱신되지 않으면 배열을 직접 수정하지 않았는지와 state 소유자가 목록과 작성 페이지의 공통 부모인지 확인한다.

## 9. 배운 점 / 확장 포인트

### 9.1 새로 이해한 것

페이지 컴포넌트는 URL과 데이터 상태를 연결하고, 표시 컴포넌트는 Props로 받은 값을 표현한다. 이 책임을 나누면 라우팅이 바뀌어도 목록 항목 UI를 재사용하기 쉽다.

### 9.2 이전·다음 학습과의 연결

리스트의 key, controlled 폼, state 끌어올리기, 합성이 하나의 앱에서 함께 동작한다. 다음 단계에서는 데이터를 메모리 배열이 아니라 API에서 가져오고 테스트를 추가할 수 있다.

### 9.3 더 확인할 주제

- localStorage를 이용한 새로고침 후 데이터 보존
- route loader와 오류 화면
- 작성·수정·삭제 mutation
- 컴포넌트 테스트와 E2E 테스트

## 10. 요약 정리

- 데이터 타입을 화면보다 먼저 정의한다.
- 페이지와 재사용 컴포넌트의 책임을 분리한다.
- URL params는 외부 입력이므로 실제 데이터 존재 여부를 확인한다.
- 목록 key에는 생성 시 결정한 안정적인 ID를 사용한다.
- state 배열은 새 배열로 갱신한다.

🧠 기억할 것: 작은 프로젝트도 데이터의 주인, URL의 역할, 컴포넌트의 책임을 먼저 정하면 구현 순서가 선명해진다.

## 11. 미니 퀴즈

1. `StudyNote`의 `id`가 목록 key와 URL에서 모두 중요한 이유는 무엇인가?
2. `useParams`의 TypeScript 타입만으로 올바른 기록이 존재한다고 보장할 수 있는가?
3. `AppLayout`의 `<Outlet />`은 어떤 역할을 하는가?

<details>
<summary>정답과 해설</summary>

1. 같은 기록을 렌더링 사이와 서로 다른 페이지에서 일관되게 식별하는 기준이기 때문이다.
2. 보장할 수 없다. 타입은 문자열 형태만 설명하며 실제 배열에 해당 ID가 있는지는 런타임 조회로 확인해야 한다.
3. 현재 URL과 일치한 자식 Route의 element가 렌더링될 위치를 지정한다.

</details>

## 참고 자료

- [Thinking in React](https://react.dev/learn/thinking-in-react)
- [React Router: Picking a Mode](https://reactrouter.com/start/modes)
- [React Router: Declarative Installation](https://reactrouter.com/start/declarative/installation)
- [React Router: Routing](https://reactrouter.com/start/declarative/routing)
