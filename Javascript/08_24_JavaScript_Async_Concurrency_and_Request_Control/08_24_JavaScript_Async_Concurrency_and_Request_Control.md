# JavaScript 비동기 제어: Promise 병렬 처리, 요청 취소, 경쟁 상태와 debounce

- 🎯 글의 목표: 서로 독립적인 비동기 작업을 효율적으로 시작하고, 불필요한 요청과 늦게 도착한 응답이 화면 상태를 망치지 않도록 제어한다.
- 🧩 핵심 키워드: `Promise.all`, `Promise.allSettled`, 동시성, `AbortController`, 경쟁 상태, debounce, `fetch`
- ⭐ 중요도: ★★★★★ — 검색·자동완성·대시보드처럼 요청이 여러 번 발생하는 화면에서는 단순히 `await`만 사용하면 느려지거나 오래된 응답이 최신 화면을 덮어쓸 수 있다.
- 📝 한눈에 보는 내용: 의존하지 않는 작업은 먼저 모두 시작한 뒤 함께 기다린다. 모든 결과가 필수면 `Promise.all`, 일부 실패도 기록해야 하면 `Promise.allSettled`를 사용한다. 반복 요청은 debounce로 줄이고, 이미 시작된 불필요한 요청은 `AbortController`로 취소한다.
- 🔗 관련 주제: 이벤트 루프, `async`/`await`, Fetch API, React 데이터 요청, 에러 처리
- 🧱 선수 지식: 함수, Promise, `async`/`await`, `try`/`catch`, DOM 이벤트

---

## 1. 들어가며

사용자가 검색창에 `javascript`를 빠르게 입력하면 입력 글자마다 요청이 발생할 수 있다.

```text
j           → 요청 1
ja          → 요청 2
jav         → 요청 3
java        → 요청 4
javascript  → 요청 5
```

이때 두 문제가 생긴다.

1. 사용하지 않을 중간 검색어까지 요청해 서버와 브라우저가 불필요하게 일한다.
2. 먼저 보낸 요청이 나중에 도착해 최신 결과를 오래된 결과로 덮어쓸 수 있다.

또한 화면에 사용자 정보와 알림 정보를 함께 표시할 때 두 요청을 차례로 기다리면 서로 의존하지 않는데도 전체 대기 시간이 길어진다.

이 문서는 비동기 문제를 다음 세 종류로 나누어 해결한다.

```text
독립 작업을 차례로 기다림
        → Promise.all로 함께 진행

여러 작업의 일부 실패도 확인해야 함
        → Promise.allSettled로 전체 결과 수집

짧은 시간에 요청이 반복되고 응답 순서가 뒤섞임
        → debounce + AbortController + 최신 요청 확인
```

## 2. 비동기 작업의 순차 실행과 동시 실행

### 2.1 순차 실행이 필요한 경우

두 번째 작업이 첫 번째 결과를 입력으로 사용한다면 순서대로 기다려야 한다.

```js
async function loadUserPosts(userId) {
  // 게시물을 요청하려면 먼저 사용자 정보를 알아야 한다.
  const user = await fetchUser(userId)
  const posts = await fetchPosts(user.id)

  return { user, posts }
}
```

```text
fetchUser 시작
      ↓ 완료까지 대기
fetchPosts 시작
      ↓ 완료까지 대기
결과 반환
```

이 경우 두 번째 작업의 입력이 첫 번째 결과에 의존하므로 순차 실행이 맞다.

### 2.2 독립 작업을 순차 실행하면 대기 시간이 더해진다

다음 두 함수가 각각 약 1초 걸리고 서로 의존하지 않는다고 가정한다.

```js
function delay(value, milliseconds) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), milliseconds)
  })
}

async function loadSequentially() {
  // 첫 작업이 끝날 때까지 기다린 다음 두 번째 작업을 시작한다.
  const profile = await delay('프로필', 1000)
  const notifications = await delay('알림', 1000)

  return { profile, notifications }
}
```

전체 대기 시간은 대략 `1초 + 1초 = 2초`가 된다.

### 2.3 독립 작업은 먼저 시작하고 함께 기다린다

```js
async function loadConcurrently() {
  // 두 비동기 작업을 즉시 시작한다.
  const profilePromise = delay('프로필', 1000)
  const notificationsPromise = delay('알림', 1000)

  // 두 작업이 모두 끝날 때까지 한 번에 기다린다.
  const [profile, notifications] = await Promise.all([
    profilePromise,
    notificationsPromise,
  ])

  return { profile, notifications }
}
```

두 타이머가 비슷한 시점에 진행되므로 전체 대기 시간은 약 1초에 가까워진다.

📌 핵심: `Promise.all()`이 작업을 생성하는 것은 아니다. 배열을 만들기 전에 호출한 `delay()` 또는 `fetch()`가 Promise와 작업을 시작하고, `Promise.all()`은 그 결과들을 하나로 묶어 기다린다.

## 3. 동시성과 병렬 실행을 구분한다

프론트엔드에서 여러 네트워크 요청을 함께 처리하는 일을 흔히 병렬 요청이라고 표현한다. 더 정확하게는 여러 작업의 대기 시간이 겹치는 **동시성(concurrency)**으로 이해하는 편이 좋다.

```text
JavaScript 코드 실행
  ├─ 요청 A를 브라우저에 맡김
  ├─ 요청 B를 브라우저에 맡김
  └─ 두 Promise의 완료를 기다림
```

`Promise.all()`은 JavaScript의 CPU 계산을 여러 CPU 코어에서 자동으로 병렬 실행하지 않는다. 무거운 반복 계산을 Promise로 감싼다고 메인 스레드의 멈춤이 해결되는 것도 아니다. CPU 병렬 처리가 필요하면 Web Worker 같은 별도 실행 환경을 검토한다.

## 4. `Promise.all()`은 모두 성공해야 할 때 사용한다

`Promise.all(iterable)`은 전달받은 작업이 모두 이행되면 결과 배열을 반환한다. 하나라도 거부되면 반환 Promise도 거부된다.

```js
async function loadDashboard() {
  const [profile, notifications, tasks] = await Promise.all([
    fetchProfile(),
    fetchNotifications(),
    fetchTasks(),
  ])

  return { profile, notifications, tasks }
}
```

### 4.1 결과 순서는 완료 순서가 아니라 입력 순서다

```js
async function checkResultOrder() {
  const results = await Promise.all([
    delay('첫 번째 입력', 300),
    delay('두 번째 입력', 50),
    delay('세 번째 입력', 150),
  ])

  console.log(results)
  // ['첫 번째 입력', '두 번째 입력', '세 번째 입력']
}
```

두 번째 작업이 가장 먼저 완료되어도 결과 배열의 두 번째 자리에 들어간다. 구조 분해 할당을 사용할 때는 입력 Promise와 결과 변수의 위치를 정확히 맞춘다.

### 4.2 하나의 실패로 전체 결과를 사용할 수 없을 때 적합하다

```js
async function prepareCheckout() {
  try {
    // 재고와 결제 수단이 모두 있어야 결제 화면을 구성할 수 있다.
    const [stock, paymentMethods] = await Promise.all([
      fetchStock(),
      fetchPaymentMethods(),
    ])

    return { stock, paymentMethods }
  } catch (error) {
    // 어느 하나라도 실패하면 전체 준비 작업을 실패로 처리한다.
    throw new Error('결제 정보를 준비하지 못했습니다.', {
      cause: error,
    })
  }
}
```

`Promise.all()`이 실패를 빠르게 알려 주더라도 이미 시작한 다른 작업을 자동으로 취소하지는 않는다. 네트워크 요청까지 중단해야 한다면 `AbortController`를 별도로 연결해야 한다.

## 5. `Promise.allSettled()`는 모든 성공과 실패를 수집한다

알림, 추천, 최근 본 항목처럼 한 영역이 실패해도 나머지 영역을 보여 줄 수 있다면 모든 작업의 최종 상태가 필요하다.

```js
async function loadOptionalSections() {
  const results = await Promise.allSettled([
    fetchRecommendations(),
    fetchRecentViews(),
    fetchAnnouncements(),
  ])

  return results
}
```

결과 객체는 `status`에 따라 모양이 다르다.

```js
const results = await Promise.allSettled([
  Promise.resolve('추천 목록'),
  Promise.reject(new Error('공지 서버 오류')),
])

console.log(results)
// [
//   { status: 'fulfilled', value: '추천 목록' },
//   { status: 'rejected', reason: Error(...) },
// ]
```

안전하게 읽으려면 먼저 `status`를 확인한다.

```js
function separateSettledResults(results) {
  const succeeded = []
  const failed = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      // 성공 결과에만 value가 있다.
      succeeded.push(result.value)
    } else {
      // 실패 결과에만 reason이 있다.
      failed.push(result.reason)
    }
  }

  return { succeeded, failed }
}
```

### 5.1 선택 기준

| 상황 | 선택 |
| --- | --- |
| 모든 결과가 있어야 다음 단계 진행 가능 | `Promise.all()` |
| 하나의 실패도 전체 실패로 처리 | `Promise.all()` |
| 일부 실패해도 성공 결과를 사용 | `Promise.allSettled()` |
| 모든 작업의 성공·실패 보고서 필요 | `Promise.allSettled()` |

## 6. Fetch API의 두 종류 오류를 구분한다

`fetch()`는 네트워크 연결 실패나 요청 취소 등에는 거부될 수 있지만, HTTP `404`, `500` 응답만으로는 보통 Promise를 거부하지 않는다. 응답의 `ok`를 직접 확인해야 한다.

```js
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)

  // 200~299 범위가 아니면 애플리케이션 오류로 바꾼다.
  if (!response.ok) {
    throw new Error(`HTTP 오류: ${response.status}`)
  }

  return response.json()
}
```

```text
네트워크 실패·취소
  → fetch Promise가 reject될 수 있음

404·500 같은 HTTP 응답
  → Response는 도착함
  → response.ok를 확인해 직접 오류 처리
```

여러 요청을 `Promise.all()`로 묶기 전에 각 요청 함수가 HTTP 실패를 올바르게 `throw`하도록 만들면 전체 실패 정책이 일관된다.

## 7. 경쟁 상태는 완료 순서가 실행 순서와 다를 때 생긴다

경쟁 상태(race condition)는 여러 비동기 작업의 완료 순서에 따라 결과가 달라지는 문제다.

사용자가 `java`를 검색한 직후 `javascript`를 검색했다고 가정한다.

```text
요청 A: java       ───────────────→ 늦게 완료
요청 B: javascript ───────→ 먼저 완료

화면에 B 결과 표시
        ↓
나중에 A 결과가 도착해 화면을 오래된 검색어 결과로 덮어씀
```

요청을 보낸 순서와 응답이 도착하는 순서는 보장되지 않는다. 단순히 마지막으로 응답한 결과를 화면에 표시하면 오래된 요청이 최신 상태를 덮을 수 있다.

## 8. `AbortController`로 더 이상 필요 없는 요청을 취소한다

`AbortController`는 `signal`을 작업에 전달하고, 나중에 `abort()`를 호출해 취소를 알린다. Fetch API는 이 신호를 받아 요청과 응답 본문 소비를 중단할 수 있다.

```js
let currentController = null

async function searchProducts(keyword) {
  // 이전 검색 요청이 진행 중이면 더 이상 필요하지 않으므로 취소한다.
  currentController?.abort()

  // 이번 요청 전용 controller를 만든다.
  const controller = new AbortController()
  currentController = controller

  try {
    const query = encodeURIComponent(keyword)
    const response = await fetch(`/api/products?q=${query}`, {
      // fetch가 취소 신호를 받을 수 있도록 연결한다.
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`검색 실패: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      // 사용자가 새 검색을 시작해 의도적으로 취소한 경우다.
      return null
    }

    // 실제 네트워크·HTTP·파싱 오류는 숨기지 않는다.
    throw error
  } finally {
    // 이번 요청이 여전히 최신 controller일 때만 참조를 정리한다.
    if (currentController === controller) {
      currentController = null
    }
  }
}
```

하나의 `AbortSignal`을 여러 fetch에 전달하면 같은 작업 묶음을 한 번에 취소할 수도 있다.

```js
async function loadPageData(signal) {
  return Promise.all([
    fetchJson('/api/profile', { signal }),
    fetchJson('/api/tasks', { signal }),
  ])
}

const controller = new AbortController()
const pageDataPromise = loadPageData(controller.signal)

// 페이지를 떠나는 시점 등에 실행한다.
controller.abort()
```

⚠️ 주의: 한 번 중단된 signal은 다시 원래 상태로 되돌릴 수 없다. 다음 요청에는 새 `AbortController`를 만든다.

## 9. 취소할 수 없다면 최신 요청 번호를 확인한다

모든 비동기 함수가 `AbortSignal`을 지원하는 것은 아니다. 이때는 요청마다 번호를 붙이고 최신 응답만 반영할 수 있다.

```js
let latestRequestId = 0

async function searchWithRequestId(keyword) {
  // 요청이 시작될 때마다 번호를 증가시킨다.
  const requestId = ++latestRequestId
  const result = await fetchSearchResult(keyword)

  // 기다리는 동안 더 최신 요청이 시작됐다면 이 결과는 사용하지 않는다.
  if (requestId !== latestRequestId) {
    return null
  }

  return result
}
```

이 방식은 오래된 결과의 화면 반영은 막지만 작업 자체를 중단하지는 않는다. 가능하면 취소로 자원 사용을 줄이고, 최신 요청 확인으로 상태 반영까지 방어할 수 있다.

## 10. debounce로 반복 호출 횟수를 줄인다

Debounce는 이벤트가 연속해서 발생할 때 타이머를 계속 다시 시작하고, 입력이 일정 시간 멈춘 뒤 마지막 호출만 실행하는 방식이다.

```text
입력 발생 → 300ms 타이머 시작
100ms 뒤 입력 → 이전 타이머 취소, 새 타이머 시작
120ms 뒤 입력 → 이전 타이머 취소, 새 타이머 시작
300ms 동안 새 입력 없음 → 마지막 입력으로 함수 실행
```

```js
function debounce(callback, delay) {
  // 여러 호출 사이에서 timerId를 기억한다.
  let timerId = null

  return function debounced(...args) {
    // 아직 실행되지 않은 이전 예약이 있으면 취소한다.
    if (timerId !== null) {
      clearTimeout(timerId)
    }

    // 마지막 호출 이후 delay만큼 조용하면 callback을 실행한다.
    timerId = setTimeout(() => {
      callback.apply(this, args)
      timerId = null
    }, delay)
  }
}
```

`timerId`는 바깥 함수 실행이 끝난 뒤에도 반환된 함수가 기억한다. 이것은 JavaScript의 클로저를 활용한 예다.

검색 입력에 적용하면 다음과 같다.

```js
const searchInput = document.querySelector('#search-input')

const handleSearch = debounce(async (event) => {
  const keyword = event.target.value.trim()

  if (keyword === '') {
    renderResults([])
    return
  }

  try {
    const results = await searchProducts(keyword)

    // 취소된 요청은 null을 반환하므로 화면을 바꾸지 않는다.
    if (results !== null) {
      renderResults(results)
    }
  } catch (error) {
    renderError('검색 결과를 불러오지 못했습니다.')
    console.error(error)
  }
}, 300)

searchInput.addEventListener('input', handleSearch)
```

## 11. debounce와 요청 취소는 역할이 다르다

Debounce만으로 모든 경쟁 상태가 해결되지는 않는다. 첫 요청이 이미 시작된 뒤 사용자가 잠시 쉬었다가 새 검색어를 입력하면 두 요청이 동시에 진행될 수 있다.

| 도구 | 해결하는 문제 | 해결하지 못하는 것 |
| --- | --- | --- |
| debounce | 짧은 시간의 반복 호출을 줄임 | 이미 시작한 요청을 중단하지 않음 |
| `AbortController` | 지원하는 진행 중 작업을 취소 | 호출 자체가 너무 많이 시작되는 문제 |
| 요청 번호 확인 | 오래된 결과가 상태를 덮는 것을 방지 | 네트워크 작업 자체를 줄이지 않음 |

검색 UI에서는 세 방법을 경쟁 관계로 보지 않고 필요에 따라 함께 사용한다.

```text
debounce
  → 시작할 요청 수를 줄임

AbortController
  → 이전 요청을 중단함

최신 요청 확인
  → 마지막 상태 반영을 보장함
```

## 12. 자주 발생하는 실수

### 12.1 독립 작업을 습관적으로 연속 `await`한다

```js
// 두 작업이 독립적이라면 불필요하게 순차 실행된다.
const first = await fetchFirst()
const second = await fetchSecond()
```

의존 관계가 없다면 먼저 두 함수를 호출한 뒤 `Promise.all()`로 기다린다.

### 12.2 함수 자체를 `Promise.all()`에 넣는다

```js
// 함수가 호출되지 않았으므로 비동기 작업이 시작되지 않는다.
const results = await Promise.all([fetchFirst, fetchSecond])
```

```js
// 함수를 호출해 반환된 Promise를 전달한다.
const results = await Promise.all([fetchFirst(), fetchSecond()])
```

### 12.3 `Promise.all()`이 나머지 작업도 자동 취소한다고 생각한다

첫 실패로 반환 Promise가 거부되어도 다른 요청은 이미 진행 중일 수 있다. 취소가 필요하면 같은 controller의 signal을 요청에 전달하고 명시적으로 중단한다.

### 12.4 취소 오류와 실제 오류를 모두 무시한다

```js
try {
  await fetch(url, { signal })
} catch {
  // 모든 오류를 숨겨 실제 장애도 찾을 수 없다.
}
```

의도적인 `AbortError`만 별도로 처리하고 나머지 오류는 사용자 상태와 로그에 반영한다.

### 12.5 `fetch()`가 404에서 자동으로 거부된다고 생각한다

HTTP 응답이 도착했다면 `fetch()`는 이행될 수 있다. `response.ok` 또는 `response.status`를 확인한다.

## 13. 적용 관점에서 다시 보기

비동기 코드를 작성하기 전에 다음 질문에 답한다.

1. 각 작업은 서로의 결과에 의존하는가?
2. 하나라도 실패하면 전체 결과를 사용할 수 없는가?
3. 모든 작업의 성공과 실패를 각각 기록해야 하는가?
4. 사용자가 같은 동작을 짧은 시간에 반복할 수 있는가?
5. 이전 작업이 완료된 뒤에도 그 결과가 여전히 유효한가?
6. 사용 중인 API가 `AbortSignal`을 지원하는가?
7. 취소와 실제 실패를 사용자에게 다르게 보여 주는가?

### 문제를 디버깅하는 순서

```text
요청 시작 시각과 검색어 기록
        ↓
응답 완료 시각과 요청 번호 기록
        ↓
화면 반영 전에 최신 요청인지 확인
        ↓
취소 오류와 실제 오류를 분리
        ↓
불필요한 순차 await와 반복 호출 확인
```

## 14. 배운 점과 확장 포인트

### 14.1 새로 이해한 것

- `await`의 위치가 비동기 작업의 시작 순서와 전체 대기 시간을 바꾼다.
- `Promise.all()`의 결과 순서는 완료 순서가 아니라 입력 순서다.
- `Promise.all()`의 빠른 실패는 나머지 작업의 자동 취소를 뜻하지 않는다.
- `Promise.allSettled()`는 일부 실패가 허용되는 화면에 적합하다.
- debounce, 요청 취소, 최신 응답 확인은 서로 다른 문제를 해결한다.

### 14.2 이전·다음 학습과의 연결

기존 이벤트 루프와 `async`/`await` 학습에서 비동기 코드가 언제 다시 실행되는지를 배웠다면, 이번에는 여러 비동기 작업의 수명과 결과 반영 순서를 제어했다. 다음에는 재시도와 지수 백오프, 요청 타임아웃, 캐시, React Query 같은 서버 상태 관리로 확장할 수 있다.

### 14.3 더 확인할 주제

- `Promise.any()`와 `Promise.race()`의 사용 기준
- 네트워크 재시도와 지수 백오프
- `AbortSignal.timeout()`과 요청 제한 시간
- throttle과 debounce의 차이
- 동시 요청 개수 제한

## 15. 요약 정리

1. 결과에 의존하는 비동기 작업은 순차 실행한다.
2. 서로 독립적인 작업은 먼저 시작하고 `Promise.all()`로 함께 기다린다.
3. `Promise.all()`은 하나라도 실패하면 전체가 거부되며 나머지 작업을 자동으로 취소하지 않는다.
4. `Promise.allSettled()`는 모든 작업의 성공과 실패 상태를 수집한다.
5. Fetch API에서는 네트워크 오류와 HTTP 오류를 구분하고 `response.ok`를 확인한다.
6. 응답 완료 순서는 요청 시작 순서와 다를 수 있어 경쟁 상태가 발생한다.
7. `AbortController`는 더 이상 필요 없는 지원 작업을 취소한다.
8. debounce는 짧은 시간에 반복되는 함수 호출 수를 줄인다.
9. 요청 번호 확인은 오래된 결과의 화면 반영을 막는다.
10. debounce, 취소, 최신 결과 확인은 필요에 따라 함께 사용한다.

🧠 기억할 것: **요청을 덜 시작하고, 필요 없는 요청은 취소하며, 화면에는 최신 요청의 결과만 반영한다.**

## 16. 미니 퀴즈

1. 두 비동기 작업이 서로 독립적일 때 연속 `await`가 느릴 수 있는 이유는 무엇인가?
2. `Promise.all()`의 결과 배열은 완료 순서대로 정렬되는가?
3. 선택 기능 하나가 실패해도 나머지를 표시해야 한다면 어떤 Promise 메서드가 적합한가?
4. `Promise.all()`이 거부되면 진행 중인 모든 fetch도 자동 취소되는가?
5. `fetch()`로 받은 응답이 500일 때 무엇을 직접 확인해야 하는가?
6. debounce와 `AbortController`의 역할은 어떻게 다른가?
7. 요청 번호를 확인하는 방식이 네트워크 사용량 자체를 줄이지 못하는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 첫 작업이 끝난 뒤에야 두 번째 작업을 시작하므로 독립 작업의 대기 시간이 겹치지 않고 더해지기 때문이다.
2. 아니다. 각 작업의 완료 시점과 관계없이 입력한 Promise의 순서를 유지한다.
3. 모든 작업의 상태를 얻는 `Promise.allSettled()`가 적합하다.
4. 아니다. 반환 Promise는 빠르게 거부되지만 이미 시작한 요청은 별도 취소 신호가 없으면 계속될 수 있다.
5. `response.ok` 또는 `response.status`를 확인하고 필요한 오류를 직접 던진다.
6. debounce는 호출 시작 횟수를 줄이고, `AbortController`는 이미 시작한 지원 작업을 취소한다.
7. 오래된 결과를 무시할 뿐 이미 시작한 요청의 실행은 중단하지 않기 때문이다.

</details>

## 참고 자료

- [MDN — Promise.all()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
- [MDN — Promise.allSettled()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- [MDN — AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [MDN — AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
- [MDN — Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN — setTimeout()](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)
