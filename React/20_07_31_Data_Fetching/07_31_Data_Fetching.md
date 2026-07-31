# TypeScript로 배우는 React 데이터 패칭과 비동기 상태

> 학습 목표: 네트워크 요청의 성공·실패·진행·취소 상태를 모델링하고, React 렌더링과 서버 데이터를 안전하게 연결한다.

## 1. 먼저 구분할 것

React state는 화면 상태를 기억한다. 서버 데이터는 네트워크에서 가져온 원격 상태다. 둘을 하나의 `isLoading` 변수로 뭉치면 요청이 겹치거나 재시도할 때 오류를 설명하기 어렵다.

| 구분 | 예시 | 소유자 |
| --- | --- | --- |
| UI state | 선택된 탭, 모달 열림 여부 | 컴포넌트 state |
| 서버 상태 | 게시글, 사용자, 목록의 최신 결과 | API·캐시 계층 |
| 파생 값 | 필터된 목록, 합계 | 렌더링 중 계산 |

## 2. 응답 타입과 상태 모델

```tsx
export type Article = {
  id: string
  title: string
  summary: string
}

type RequestState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'pending'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: T | null; error: Error }
```

판별 유니언을 사용하면 `status`를 확인한 뒤 TypeScript가 `data`와 `error`의 존재를 좁혀 준다. `loading: boolean`, `error?: string`, `data?: T`를 무작정 조합하는 것보다 불가능한 상태를 줄이기 쉽다.

## 3. API 함수와 컴포넌트 분리

```tsx
export async function getArticles(signal?: AbortSignal): Promise<Article[]> {
  const response = await fetch('/api/articles', { signal })

  if (!response.ok) {
    throw new Error(`요청 실패: ${response.status}`)
  }

  return (await response.json()) as Article[]
}
```

`fetch`는 404나 500에서 자동으로 reject되지 않는다. `response.ok`를 확인해 애플리케이션 오류로 바꾸고, JSON이 실제 `Article[]`인지 검증해야 하는 API라면 Zod 같은 런타임 스키마 검증 도구를 별도로 검토한다. TypeScript 타입만으로 외부 JSON의 안전성을 보장할 수는 없다.

## 4. Effect에서 요청하기

```tsx
import { useEffect, useState } from 'react'

export function ArticleList() {
  const [state, setState] = useState<RequestState<Article[]>>({
    status: 'idle',
    data: null,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    setState({ status: 'pending', data: null, error: null })

    getArticles(controller.signal)
      .then(data => setState({ status: 'success', data, error: null }))
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error : new Error('알 수 없는 오류'),
        })
      })

    return () => controller.abort()
  }, [])

  if (state.status === 'pending') return <p>불러오는 중…</p>
  if (state.status === 'error') return <p role="alert">{state.error.message}</p>
  if (state.status === 'success') {
    return (
      <ul>
        {state.data.map(article => <li key={article.id}>{article.title}</li>)}
      </ul>
    )
  }
  return <p>목록을 준비하고 있습니다.</p>
}
```

Effect는 컴포넌트가 보이는 동안 외부 네트워크 상태와 동기화하는 경우에 적합하다. cleanup에서 요청을 취소하면 화면이 사라진 뒤 결과가 state를 갱신하는 일을 줄일 수 있다.

## 5. 경쟁 상태(race condition)

검색어가 빠르게 바뀌면 요청 A보다 늦게 시작한 요청 B가 먼저 끝날 수 있다. A의 응답이 마지막에 도착해 화면을 오래된 결과로 덮으면 경쟁 상태다.

```tsx
useEffect(() => {
  const controller = new AbortController()

  void searchArticles(query, controller.signal)
    .then(nextResults => setResults(nextResults))
    .catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setError(error instanceof Error ? error : new Error('검색 실패'))
    })

  return () => controller.abort()
}, [query])
```

취소를 지원하지 않는 클라이언트라면 cleanup에서 `let ignore = false`를 두고 응답 직전에 확인하는 방식도 사용할 수 있다. 핵심은 **현재 Effect가 만든 요청만 현재 화면을 갱신하게 하는 것**이다.

## 6. 재시도와 사용자 행동

화면 표시 때문에 가져오는 요청은 Effect에서 시작할 수 있지만, 구매·삭제처럼 사용자의 특정 행동으로 발생하는 변경 요청은 이벤트 핸들러에 둔다.

```tsx
async function handleDelete(id: string): Promise<void> {
  setDeletingId(id)
  try {
    const response = await fetch(`/api/articles/${id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('삭제에 실패했습니다.')
    setArticles(current => current.filter(article => article.id !== id))
  } catch (error) {
    setError(error instanceof Error ? error : new Error('삭제에 실패했습니다.'))
  } finally {
    setDeletingId(null)
  }
}
```

중복 클릭을 막기 위해 진행 중인 항목의 버튼을 비활성화하고, 성공 전 UI를 바꾸는 낙관적 업데이트는 실패 시 되돌릴 방법을 함께 설계한다.

## 7. 수동 Effect의 한계

컴포넌트마다 직접 `fetch`하면 다음 문제가 반복된다.

- 뒤로 가기 후 같은 데이터를 다시 요청한다.
- 여러 컴포넌트가 같은 URL을 동시에 요청한다.
- 캐시, stale 시간, 재시도, 페이지네이션을 직접 구현해야 한다.
- 서버 렌더링에서는 Effect가 실행되지 않아 첫 HTML이 로딩 화면일 수 있다.
- 부모 요청이 끝난 뒤 자식 요청이 시작되는 네트워크 waterfall이 생길 수 있다.

작은 클라이언트 앱에서는 수동 구현이 학습에 유용하지만, 실제 앱에서는 프레임워크의 loader나 클라이언트 캐시 계층을 검토한다. React 공식 문서도 Effect 직접 패칭의 한계를 설명하며 TanStack Query, SWR, React Router 등의 대안을 언급한다.

## 8. TanStack Query를 도입할 때의 개념

```tsx
import { useQuery } from '@tanstack/react-query'

function ArticleList() {
  const query = useQuery({
    queryKey: ['articles'],
    queryFn: () => getArticles(),
  })

  if (query.isPending) return <p>불러오는 중…</p>
  if (query.isError) return <p role="alert">{query.error.message}</p>

  return (
    <ul>
      {query.data.map(article => <li key={article.id}>{article.title}</li>)}
    </ul>
  )
}
```

라이브러리는 요청 상태뿐 아니라 query key 기반 캐시, 중복 요청 제거, 재검증과 무효화를 관리한다. `queryKey`는 URL과 필터 같은 요청 입력을 모두 표현해야 한다. 도입 전에는 `QueryClientProvider` 설정과 팀의 캐시 정책을 먼저 이해한다.

## 9. React 19의 `use`와 Suspense

React 19의 `use(promise)`는 캐시된 Promise의 결과를 읽고, 대기 중에는 가장 가까운 `Suspense` fallback을 보여 줄 수 있다. 클라이언트 컴포넌트에서 렌더링마다 새 Promise를 만들면 계속 suspend할 수 있으므로 Promise를 캐시하거나 상위 loader에서 만들어 전달해야 한다.

```tsx
import { Suspense, use } from 'react'

function ArticleBody({ articlePromise }: { articlePromise: Promise<Article> }) {
  const article = use(articlePromise)
  return <article><h1>{article.title}</h1><p>{article.summary}</p></article>
}

function Page({ articlePromise }: { articlePromise: Promise<Article> }) {
  return (
    <Suspense fallback={<p>본문을 준비하는 중…</p>}>
      <ArticleBody articlePromise={articlePromise} />
    </Suspense>
  )
}
```

`use`는 기초 `useEffect` 패칭을 즉시 대체하는 만능 문법이 아니다. 캐시·서버 컴포넌트·프레임워크의 데이터 전달 방식이 함께 있어야 안전하게 사용할 수 있다. 오류는 `try/catch`가 아니라 Error Boundary로 처리한다.

## 10. 체크리스트

- 외부 응답을 TypeScript 타입만 믿지 않고 HTTP 상태와 데이터 형식을 확인했는가?
- `idle`, `pending`, `success`, `error` 상태를 사용자가 구분할 수 있는가?
- Effect cleanup에서 요청을 취소하거나 오래된 응답을 무시하는가?
- 특정 클릭으로 발생한 mutation을 Effect에 넣지 않았는가?
- 캐시·중복 제거·재검증이 필요해진 시점을 판단했는가?
- 네트워크 오류와 빈 결과를 같은 화면으로 처리하지 않았는가?

## 11. 요약과 복습

데이터 패칭은 `fetch` 한 줄이 아니라 서버 상태의 생명주기를 UI에 표현하는 일이다. 먼저 API 함수와 상태 모델을 분리하고, Effect 요청에는 cleanup을 둔다. 규모가 커지면 캐시 계층이나 프레임워크 loader를 선택하며, React 19 `use`는 캐시된 Promise와 Suspense를 전제로 사용한다.

1. `fetch`에서 `response.ok`를 확인해야 하는 이유는 무엇인가?
2. 검색어를 빠르게 입력할 때 오래된 응답이 화면에 남는 이유와 해결 방법은 무엇인가?
3. UI state와 서버 상태를 분리하면 어떤 책임이 명확해지는가?
4. 수동 Effect 대신 TanStack Query를 고려할 신호를 세 가지 말할 수 있는가?

## 참고 자료

- [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [`use`](https://react.dev/reference/react/use)
- [`Suspense`](https://react.dev/reference/react/Suspense)
- [TanStack Query React Docs](https://tanstack.com/query/latest/docs/framework/react)
