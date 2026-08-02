# TypeScript로 배우는 React 컴포넌트 테스트

> 학습 목표: 사용자가 실제로 하는 행동을 기준으로 컴포넌트를 검증하고, Vitest와 React Testing Library로 실패 원인을 읽을 수 있는 테스트를 작성한다.

## 1. 테스트는 무엇을 확인하는가?

컴포넌트 테스트의 질문은 “내부 state가 정확히 몇 번 바뀌었는가?”가 아니다.

> 사용자가 이 화면을 보고 버튼을 누르거나 입력했을 때, 기대한 결과를 볼 수 있는가?

테스트에는 보통 다음 세 단계가 있다.

1. **Arrange**: 컴포넌트와 필요한 초기 조건을 준비한다.
2. **Act**: 사용자의 클릭, 입력, 제출을 수행한다.
3. **Assert**: 화면에 나타난 결과나 호출된 외부 동작을 확인한다.

구현을 바꿔도 사용자 경험이 같다면 테스트가 계속 통과해야 한다. 따라서 `useState`의 내부 값이나 특정 CSS 클래스보다 텍스트, 레이블, 역할, 링크 목적지를 우선 확인한다.

## 2. 도구의 역할

| 도구 | 역할 |
| --- | --- |
| Vitest | 테스트 파일을 찾고 실행하며 `test`, `expect`, `vi` 제공 |
| jsdom | Node에서 브라우저와 비슷한 DOM 환경 제공 |
| React Testing Library | 컴포넌트를 렌더링하고 DOM을 조회 |
| `@testing-library/user-event` | 클릭·입력·키보드 같은 사용자 상호작용 시뮬레이션 |
| `@testing-library/jest-dom` | `toBeInTheDocument`, `toBeDisabled` 같은 DOM assertion 제공 |

React Testing Library는 테스트 실행기가 아니다. Vitest와 함께 사용해야 테스트를 실제로 실행할 수 있다.

## 3. Vite TypeScript 프로젝트에 설치하기

```bash
# 테스트 실행기와 브라우저 DOM 환경을 설치한다.
npm install --save-dev vitest jsdom

# React 컴포넌트 렌더링과 접근 가능한 DOM 조회 도구를 설치한다.
npm install --save-dev @testing-library/react @testing-library/jest-dom

# 실제 클릭·입력에 가까운 상호작용을 시뮬레이션한다.
npm install --save-dev @testing-library/user-event
```

Vitest 공식 문서는 최신 버전에 Vite와 Node 버전 조건이 있을 수 있다고 안내한다. 설치한 프로젝트의 Vite·Node 버전과 호환되는 Vitest 버전을 확인한다.

## 4. Vitest 설정

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 앱을 빌드할 때와 같은 React 플러그인을 사용한다.
  plugins: [react()],

  test: {
    // document, button, input 같은 DOM API가 필요하므로 jsdom을 선택한다.
    environment: 'jsdom',

    // 모든 테스트 파일을 실행하기 전에 공통 matcher를 등록한다.
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'

// 이 파일은 테스트마다 자동으로 먼저 실행된다.
// toBeInTheDocument() 같은 DOM 전용 matcher를 Vitest에 연결한다.
```

`@testing-library/jest-dom/vitest` 경로를 사용하면 Vitest의 assertion 타입과 맞게 확장된다. 프로젝트 버전에 따라 설정 문법이 다를 수 있으므로 설치된 패키지의 공식 문서를 함께 확인한다.

`package.json`에는 테스트 명령을 등록한다.

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- `npm test`: 파일 변경을 감시하며 개발한다.
- `npm run test:run`: 한 번 실행하고 종료하므로 CI에서 사용하기 좋다.

## 5. 테스트할 컴포넌트

먼저 테스트 대상이 될 작은 컴포넌트를 만든다.

```tsx
// Counter.tsx
import { useState } from 'react'

export default function Counter() {
  // 사용자가 버튼을 누르면 이 값이 바뀐다.
  const [count, setCount] = useState<number>(0)

  return (
    <section>
      {/* heading은 테스트에서 화면의 목적을 찾는 단서가 된다. */}
      <h1>카운터</h1>

      {/* 버튼의 이름은 화면에 보이는 “증가”다. */}
      <button
        type="button"
        onClick={() => setCount(current => current + 1)}
      >
        증가
      </button>

      {/* 숫자 자체가 사용자가 확인하는 결과다. */}
      <output>현재 값: {count}</output>
    </section>
  )
}
```

## 6. 첫 번째 컴포넌트 테스트

```tsx
// Counter.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import Counter from './Counter'

test('증가 버튼을 누르면 현재 값이 1 증가한다', async () => {
  // userEvent 인스턴스는 이 테스트 안에서만 만든다.
  const user = userEvent.setup()

  // Arrange: 컴포넌트를 테스트 DOM에 렌더링한다.
  render(<Counter />)

  // Assert: 처음에는 사용자에게 0이 보인다.
  expect(screen.getByOutputValue('현재 값: 0')).toBeInTheDocument()

  // Act: 사용자가 “증가”라는 이름의 버튼을 클릭한다.
  await user.click(screen.getByRole('button', { name: '증가' }))

  // Assert: 클릭 후 DOM에 1이 보이는지 확인한다.
  expect(screen.getByOutputValue('현재 값: 1')).toBeInTheDocument()
})
```

테스트 함수가 `async`인 이유는 `user.click`이 여러 브라우저 이벤트를 비동기적으로 처리할 수 있기 때문이다. `userEvent.setup()`과 `await user.click()`을 기본 패턴으로 사용한다.

## 7. DOM을 찾는 우선순위

Testing Library의 조회 함수는 사용자가 요소를 찾는 방식에 가까운 순서로 선택한다.

1. `getByRole`: 버튼, 제목, 체크박스처럼 접근 가능한 역할
2. `getByLabelText`: 입력과 연결된 `<label>`의 이름
3. `getByPlaceholderText`: 레이블을 만들 수 없을 때의 보조 수단
4. `getByText`: 화면에 표시되는 텍스트
5. `getByTestId`: 다른 방법이 정말 어려울 때의 마지막 수단

```tsx
function LoginForm() {
  return (
    <form>
      {/* label의 htmlFor와 input의 id가 연결되어 있다. */}
      <label htmlFor="email">이메일</label>
      <input id="email" name="email" type="email" />

      <button type="submit">로그인</button>
    </form>
  )
}
```

```tsx
// 레이블을 통해 input을 찾으므로 내부 className에 의존하지 않는다.
const emailInput = screen.getByRole('textbox', { name: '이메일' })

// 버튼도 DOM 태그가 아니라 사용자가 보는 이름으로 찾는다.
const loginButton = screen.getByRole('button', { name: '로그인' })
```

접근 가능한 레이블이 없으면 테스트가 어려워질 뿐 아니라 실제 보조기술 사용자도 불편하다. 테스트 작성은 접근성 문제를 발견하는 기회이기도 하다.

## 8. 입력과 폼 제출 테스트

```tsx
import { useState, type FormEvent } from 'react'

export function SearchForm({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState<string>('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // 브라우저의 페이지 새로고침을 막는다.
    event.preventDefault()

    // 부모가 전달한 callback에 사용자가 입력한 값만 전달한다.
    onSearch(query.trim())
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="query">검색어</label>
      <input
        id="query"
        value={query}
        onChange={event => setQuery(event.currentTarget.value)}
      />
      <button type="submit">검색</button>
    </form>
  )
}
```

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SearchForm } from './SearchForm'

test('검색어를 입력하고 제출하면 부모 callback을 호출한다', async () => {
  const user = userEvent.setup()
  // vi.fn은 호출 횟수와 전달 인자를 기록하는 가짜 함수다.
  const onSearch = vi.fn<(query: string) => void>()

  render(<SearchForm onSearch={onSearch} />)

  // input은 레이블 이름으로 찾는다.
  await user.type(screen.getByRole('textbox', { name: '검색어' }), ' React ')
  await user.click(screen.getByRole('button', { name: '검색' }))

  // trim된 값이 한 번 전달되었는지 확인한다.
  expect(onSearch).toHaveBeenCalledTimes(1)
  expect(onSearch).toHaveBeenCalledWith('React')
})
```

callback 호출을 확인할 때도 `setQuery`가 몇 번 실행됐는지 같은 내부 구현은 테스트하지 않는다. 부모가 받아야 할 공개 계약(여기서는 `'React'`)을 확인한다.

## 9. 비동기 UI 조회

조회 함수의 접두사는 결과가 아직 없는지에 따라 달라진다.

| 함수 | 조건 | 실패하면 |
| --- | --- | --- |
| `getBy...` | 지금 즉시 있어야 함 | 즉시 테스트 실패 |
| `queryBy...` | 없어도 되는지 확인 | 없으면 `null` 반환 |
| `findBy...` | 잠시 후 나타날 수 있음 | Promise를 반환하므로 `await` |

```tsx
test('저장 후 성공 메시지를 비동기로 표시한다', async () => {
  const user = userEvent.setup()
  render(<SaveButton />)

  await user.click(screen.getByRole('button', { name: '저장' }))

  // 화면에 나중에 나타나는 요소이므로 findBy를 await한다.
  expect(await screen.findByRole('status')).toHaveTextContent('저장 완료')
})
```

`waitFor`는 특정 조건을 반복해서 기다려야 할 때 사용한다. 단순히 나타나는 요소는 `findBy`가 더 읽기 쉽다. `setTimeout`을 직접 기다리는 방식은 테스트를 느리고 불안정하게 만든다.

## 10. 네트워크 요청 테스트의 경계

컴포넌트 테스트에서 실제 서버를 호출하면 네트워크 상태에 따라 결과가 달라진다. 초보 단계에서는 다음 두 층을 구분한다.

- 컴포넌트 테스트: 로딩·성공·실패라는 화면 전환을 가짜 응답으로 검증한다.
- 통합/E2E 테스트: 실제 API 또는 테스트 서버와 연결해 여러 모듈의 계약을 확인한다.

`vi.fn()`으로 API 함수를 주입하거나 MSW(Mock Service Worker)처럼 요청을 가로채는 도구를 사용하면 테스트가 네트워크에 의존하지 않는다. `fetch` 구현 자체를 다시 테스트하기보다 컴포넌트가 로딩과 오류를 올바르게 보여 주는지 확인한다.

## 11. 테스트하기 쉬운 컴포넌트의 조건

- 버튼과 입력에 의미 있는 접근성 이름이 있다.
- 데이터 요청, 형식 변환, 화면 표현의 책임이 분리되어 있다.
- 현재 화면에 필요한 Props가 명확하다.
- 시간, 난수, 전역 객체를 무조건 읽지 않고 주입하거나 격리한다.
- 하나의 테스트가 하나의 사용자 결과를 설명한다.

## 12. 피해야 할 테스트

- `container.querySelector('.blue-button')`처럼 CSS 구현에 결합한다.
- `data-testid`만 사용해 접근성 이름의 부재를 숨긴다.
- state setter 호출 횟수나 Hook 호출 순서를 확인한다.
- 한 테스트에서 여러 사용자 시나리오를 연달아 실행한다.
- 비동기 결과를 `setTimeout`으로 임의의 시간만큼 기다린다.
- 모든 하위 컴포넌트를 mock해 실제 화면 흐름을 없앤다.

## 13. 테스트 실행과 실패 읽기

```bash
# 개발 중 변경된 테스트를 감시한다.
npm test

# CI처럼 한 번 실행하고 종료한다.
npm run test:run

# 특정 파일만 실행해 원인을 좁힌다.
npx vitest run src/components/Counter.test.tsx
```

실패 메시지에서 먼저 확인할 것은 다음이다.

1. 어떤 사용자 행동 직후 실패했는가?
2. 조회한 역할과 이름이 실제 DOM에 존재하는가?
3. 비동기 결과를 `await`했는가?
4. 테스트 사이에 DOM이나 mock 상태가 남았는가?
5. 컴포넌트가 아니라 테스트의 기대값이 잘못된 것은 아닌가?

## 14. 요약과 복습

컴포넌트 테스트는 내부 구현이 아니라 사용자가 보는 DOM과 행동을 검증한다. Vitest가 테스트를 실행하고, jsdom이 DOM을 제공하며, Testing Library와 user-event가 실제 사용 흐름에 가까운 테스트를 작성하게 한다.

1. `getBy`, `queryBy`, `findBy`는 각각 언제 사용하는가?
2. `fireEvent`보다 `userEvent`를 먼저 고려하는 이유는 무엇인가?
3. CSS class보다 role과 accessible name으로 요소를 찾는 장점은 무엇인가?
4. 네트워크 요청을 컴포넌트 테스트에서 직접 호출하지 않는 이유는 무엇인가?
5. `act`를 직접 호출하지 않아도 Testing Library가 대부분의 업데이트를 처리할 수 있는 이유는 무엇인가?

## 참고 자료

- [Vitest Getting Started](https://vitest.dev/guide/index.html)
- [Vitest Features](https://vitest.dev/guide/features)
- [React Testing Library 소개](https://testing-library.com/docs/react-testing-library/intro/)
- [React Testing Library API](https://testing-library.com/docs/react-testing-library/api/)
- [Testing Library user-event](https://testing-library.com/docs/user-event/intro/)
- [React `act`](https://react.dev/reference/react/act)
