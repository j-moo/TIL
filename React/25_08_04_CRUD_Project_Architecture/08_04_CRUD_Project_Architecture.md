# React CRUD 프로젝트를 책임별로 설계하기

- 🎯 글의 목표: 게시글 CRUD를 예로 데이터 모델·API·라우팅·폼·화면 상태의 책임을 나누고 구현 순서를 설명한다.
- 🧩 핵심 키워드: CRUD, resource, API layer, route, mutation, validation
- ⭐ 중요도: ★★★★★ — 기능을 한 컴포넌트에 몰아넣지 않고 오류 위치를 찾기 쉬운 구조로 만드는 종합 연습이다.
- 📝 한눈에 보는 내용: 먼저 데이터와 URL을 설계하고 API 함수를 분리한다. 화면은 요청 상태를 표현하고, 생성·수정·삭제는 사용자 사건에서 실행하며 성공 후 목록을 다시 맞춘다.
- 🔗 관련 주제: React Router, 폼, 데이터 패칭, 상태 관리, 테스트
- 🧱 선수 지식: `fetch`, `async/await`, Hook, React Router

---

## 1. 들어가며

CRUD는 Create(생성), Read(조회), Update(수정), Delete(삭제)의 앞글자를 묶은 말이다. 간단한 게시판도 목록 조회, 상세 조회, 작성, 수정, 삭제라는 서로 다른 요청과 화면을 가진다.

처음부터 JSX를 길게 작성하면 데이터 필드, URL, 요청 상태가 뒤섞인다. 구현 전에 **데이터·서버 통신·화면·이동 책임**을 나누는 것이 중요하다.

## 2. 전체 지도

```text
사용자 행동
   ↓
Page 컴포넌트 ── URL 매개변수·화면 상태
   ↓
API 함수 ───── HTTP method·상태 코드·JSON
   ↓
서버 데이터
   ↓
성공 시 UI 갱신 또는 경로 이동
실패 시 오류 상태와 재시도 제공
```

## 3. 데이터와 URL부터 정하기

```ts
export type Article = {
  id: string
  title: string
  body: string
  createdAt: string
}

// 서버가 id와 생성 시각을 결정하므로 입력 타입에서는 제외한다.
export type ArticleInput = Pick<Article, 'title' | 'body'>
```

| 기능 | URL | HTTP method |
| --- | --- | --- |
| 목록 | `/articles` | GET |
| 상세 | `/articles/:articleId` | GET |
| 작성 | `/articles/new` | POST |
| 수정 | `/articles/:articleId/edit` | PUT 또는 PATCH |
| 삭제 | `/articles/:articleId` | DELETE |

PUT은 자원 전체 교체, PATCH는 일부 수정이라는 의미 차이가 있다. 서버 계약이 어떤 방식을 사용하는지 확인한 뒤 클라이언트와 맞춘다.

## 4. API 계층 분리하기

```ts
// api/articles.ts
import type { Article, ArticleInput } from '../types/article'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)

  // 네트워크 성공과 HTTP 성공은 다르므로 상태 코드를 직접 검사한다.
  if (!response.ok) {
    throw new Error(`API 요청 실패 (${response.status})`)
  }

  // 이 타입 단언은 런타임 검증이 아니다. 외부 API라면 스키마 검증을 추가한다.
  return (await response.json()) as T
}

export function getArticles(signal?: AbortSignal): Promise<Article[]> {
  return request<Article[]>('/api/articles', { signal })
}

export function createArticle(input: ArticleInput): Promise<Article> {
  return request<Article>('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deleteArticle(id: string): Promise<void> {
  const response = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(`삭제 실패 (${response.status})`)
}
```

컴포넌트는 서버 URL과 헤더 세부 사항을 알 필요가 없다. API 함수의 인수와 반환 타입만 사용하므로 테스트에서 가짜 구현으로 바꾸기도 쉬워진다.

## 5. 작성 폼의 책임

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { createArticle } from '../api/articles'

export function ArticleCreatePage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    // 현재 제출된 form에서 이름별 값을 읽는다.
    const formData = new FormData(event.currentTarget)
    const title = formData.get('title')
    const body = formData.get('body')

    // FormData는 File과 null도 포함할 수 있으므로 문자열 여부를 확인한다.
    if (typeof title !== 'string' || typeof body !== 'string') {
      setError('입력값 형식을 확인하세요.')
      return
    }
    if (title.trim().length < 2 || body.trim().length < 10) {
      setError('제목은 2자, 본문은 10자 이상 입력하세요.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const created = await createArticle({
        title: title.trim(),
        body: body.trim(),
      })
      // 서버가 반환한 실제 id를 사용해 방금 만든 상세 화면으로 이동한다.
      navigate(`/articles/${created.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '작성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        제목
        <input name="title" minLength={2} required />
      </label>
      <label>
        본문
        <textarea name="body" minLength={10} required />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? '등록 중…' : '등록'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

HTML 검증 속성은 빠른 사용자 피드백에 유용하지만 보안 경계가 아니다. 서버도 같은 규칙을 다시 검증해야 한다.

## 6. 삭제 후 화면을 맞추는 두 방법

목록에서 삭제했다면 성공 후 해당 id를 지역 state에서 제거할 수 있다. 서버 상태 캐시를 사용한다면 mutation 성공 뒤 목록 query를 무효화해 서버의 최신 값을 다시 받는 방식이 더 적합할 수 있다.

```tsx
async function handleDelete(id: string): Promise<void> {
  setDeletingId(id)
  try {
    await deleteArticle(id)
    // 서버 삭제가 성공한 뒤 현재 목록에서도 같은 항목을 제거한다.
    setArticles(current => current.filter(article => article.id !== id))
  } catch (caught) {
    setError(caught instanceof Error ? caught.message : '삭제에 실패했습니다.')
  } finally {
    setDeletingId(null)
  }
}
```

삭제 버튼에는 대상 제목을 확인할 수 있는 문구를 제공하고, 요청 중에는 같은 항목의 버튼을 비활성화한다. 낙관적으로 먼저 지운다면 실패 시 원래 위치에 복원할 데이터가 필요하다.

## 7. 권장 폴더 구조

```text
src/
├─ app/                 # Router, Provider, 전역 설정
├─ api/                 # HTTP 요청 함수
├─ components/          # 여러 화면에서 재사용하는 UI
├─ features/articles/   # 게시글 기능의 타입·컴포넌트·Hook
├─ pages/               # URL 단위 화면
└─ main.tsx             # 애플리케이션 진입점
```

폴더명보다 중요한 것은 의존 방향이다. Page가 API를 호출할 수는 있지만, 범용 버튼 컴포넌트가 특정 게시글 API를 직접 알게 만들면 재사용과 테스트가 어려워진다.

## 8. 구현 순서와 디버깅

1. 데이터 타입과 서버 계약을 적는다.
2. URL과 페이지 목록을 정한다.
3. API 함수를 만들고 상태 코드를 처리한다.
4. 목록·상세 읽기 화면을 먼저 연결한다.
5. 작성·수정 폼에 검증과 pending을 추가한다.
6. 삭제 확인과 실패 복구를 구현한다.
7. 성공·오류·빈 목록·없는 id를 테스트한다.

문제가 생기면 브라우저 Network 탭에서 URL, method, request body, status, response를 먼저 본다. 화면 state를 추측하기 전에 서버 요청이 계약대로 오갔는지 확인한다.

## 9. 요약 정리

- CRUD는 생성·조회·수정·삭제의 데이터 생명주기다.
- 데이터 타입과 URL을 JSX보다 먼저 설계한다.
- API 함수는 HTTP 세부 사항을 컴포넌트에서 분리한다.
- `response.ok`를 확인하고 외부 JSON은 필요하면 런타임 검증한다.
- mutation은 사용자 행동에서 실행하고 pending·오류 상태를 보여 준다.
- 클라이언트 검증과 서버 검증은 둘 다 필요하다.
- 삭제 성공 뒤 지역 목록 수정 또는 캐시 무효화로 화면을 맞춘다.

🧠 기억할 것: CRUD 화면은 버튼 네 개가 아니라 데이터 계약, 요청 상태, URL, 실패 복구가 연결된 하나의 흐름이다.

## 10. 미니 퀴즈

1. `Article`과 `ArticleInput` 타입을 나누는 이유는 무엇인가?
2. `fetch` 뒤에 `response.ok`를 검사해야 하는 이유는 무엇인가?
3. 클라이언트의 `required`만으로 충분하지 않은 이유는 무엇인가?
4. 삭제 성공 후 UI와 서버를 맞추는 방법 두 가지는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. id와 생성 시각처럼 서버가 결정하는 필드는 작성 입력에 포함하지 않기 위해서다.
2. `fetch`는 404와 500도 정상적으로 resolve하기 때문이다.
3. 사용자가 요청을 직접 만들 수 있어 서버가 신뢰할 수 없기 때문이다.
4. 지역 목록에서 항목을 제거하거나 서버 상태 query를 무효화해 다시 가져올 수 있다.

</details>

## 참고 자료

- [React: Effect에서 데이터 가져오기](https://react.dev/reference/react/useEffect#fetching-data-with-effects)
- [React Router 선언형 라우팅](https://reactrouter.com/start/declarative/routing)
