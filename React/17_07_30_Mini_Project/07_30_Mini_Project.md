# 미니 프로젝트: 학습 기록 대시보드

> 학습 목표: 앞에서 배운 컴포넌트·Props·state·폼·리스트·라우팅을 하나의 작은 앱 구조로 연결한다.

강의의 블로그 코드를 복제하지 않고, 같은 개념을 **학습 기록 대시보드**에 적용한다. 구현보다 먼저 데이터와 화면 책임을 나누는 연습에 초점을 둔다.

## 1. 요구사항

- `/`에서 학습 기록 목록을 보여 준다.
- `/notes/:noteId`에서 한 기록의 상세 내용을 보여 준다.
- `/notes/new`에서 제목과 분류를 입력해 새 기록을 추가한다.
- 목록은 완료 여부로 필터링한다.
- 존재하지 않는 ID에는 안내 화면을 보여 준다.

## 2. 데이터 모델

```tsx
export type StudyNote = {
  id: string
  title: string
  category: 'react' | 'typescript'
  completed: boolean
  summary: string
}

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
npm install react-router
```

```tsx
import { BrowserRouter, Route, Routes } from 'react-router'

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<NoteListPage />} />
          <Route path="notes/new" element={<NewNotePage />} />
          <Route path="notes/:noteId" element={<NoteDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

현재 React Router 문서의 선언형 모드는 `react-router` 패키지에서 API를 가져온다. 오래된 강의의 `react-router-dom` 예제와 섞지 말고 설치한 주 버전의 공식 문서를 따른다. 중첩 route의 자식 화면은 `AppLayout` 안의 `<Outlet />` 위치에 렌더링된다.

## 5. 상세 페이지에서 params 검증

```tsx
import { Link, useParams } from 'react-router'

function NoteDetailPage({ notes }: { notes: StudyNote[] }) {
  const { noteId } = useParams<{ noteId: string }>()
  const note = notes.find(item => item.id === noteId)

  if (!note) {
    return (
      <section>
        <h1>기록을 찾을 수 없습니다.</h1>
        <Link to="/">목록으로</Link>
      </section>
    )
  }

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

## 참고 자료

- [Thinking in React](https://react.dev/learn/thinking-in-react)
- [React Router: Picking a Mode](https://reactrouter.com/start/modes)
- [React Router: Declarative Installation](https://reactrouter.com/start/declarative/installation)
- [React Router: Routing](https://reactrouter.com/start/declarative/routing)
