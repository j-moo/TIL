# 함수 컴포넌트로 이해하는 State와 생명주기

- 🎯 글의 목표: state가 필요한 이유와 렌더링마다 값이 보이는 방식을 이해하고, 컴포넌트의 시작·동기화·정리를 함수 컴포넌트 관점에서 설명한다.
- 🧩 핵심 키워드: state, state 스냅샷, setter, mount, update, unmount, Effect, cleanup
- ⭐ 중요도: ★★★★★ — state와 Effect를 혼동하면 이후 폼, 데이터 요청, 사용자 상호작용을 예측하기 어렵다.
- 📝 한눈에 보는 내용: state는 렌더링 사이에 값을 보존하고, setter는 다음 렌더링을 예약한다. Effect는 렌더링 결과를 브라우저 API나 네트워크 같은 외부 시스템과 맞춘다.
- 🔗 관련 주제: 렌더링, 이벤트, Hook, 순수 컴포넌트
- 🧱 선수 지식: TypeScript 함수, 구조 분해, 이벤트 핸들러

---

컴포넌트가 다시 실행되면 지역 변수는 새로 만들어진다. 그런데 입력값이나 카운트처럼 화면이 기억해야 하는 값도 모두 사라진다면 상호작용하는 UI를 만들 수 없다. state는 이 문제를 해결하며, 생명주기는 컴포넌트가 화면에 추가되고 갱신되며 제거되는 동안 외부 연결을 언제 시작하고 정리할지 이해하는 기준이 된다.

## 1. 핵심 개념

| 개념 | 의미 |
| --- | --- |
| state | 컴포넌트가 렌더링 사이에 기억해야 하는 값 |
| state 스냅샷 | 한 번의 렌더링에서 props와 state는 고정된 값처럼 보인다는 성질 |
| mount | 컴포넌트가 화면에 처음 추가되는 시점 |
| update | props 또는 state 변경으로 다시 렌더링되는 과정 |
| unmount | 컴포넌트가 화면에서 제거되는 시점 |
| Effect | 렌더링 결과를 외부 시스템과 동기화하는 로직 |

과거 자료는 클래스 컴포넌트의 `this.state`와 생명주기 메서드를 중심으로 설명한다. 개념 자체는 유효하지만, 새 코드는 함수 컴포넌트와 Hook을 기준으로 배우는 편이 좋다.

## 2. 지역 변수와 state의 차이

지역 변수는 렌더링할 때마다 다시 만들어지고, 값을 바꿔도 React에 새 렌더링을 요청하지 않는다. `useState`는 값을 보존하며 setter 호출을 통해 다음 렌더링을 예약한다.

```tsx
import { useState } from 'react'

export default function ScoreBoard() {
  // 점수는 클릭 후에도 기억되고 화면에 표시되어야 하므로 state로 만든다.
  const [score, setScore] = useState<number>(0)

  return (
    <section>
      <p>점수: {score}</p>
      {/* 최신 대기 값을 기준으로 1을 더하도록 updater 함수를 전달한다. */}
      <button
        type="button"
        onClick={() => setScore(current => current + 1)}
      >
        1점 추가
      </button>
    </section>
  )
}
```

이벤트 핸들러 안의 `score`는 해당 렌더링의 스냅샷이다. 이전 값으로 다음 값을 계산할 때는 `setScore(current => current + 1)`처럼 updater 함수를 사용하면 연속 업데이트에도 안전하다.

## 3. state를 설계하는 기준

- 화면에 영향을 주고 렌더링 사이에 기억해야 할 때만 state로 둔다.
- props나 기존 state로 계산할 수 있는 값은 중복 state로 만들지 않는다.
- 객체와 배열은 직접 수정하지 않고 새 값으로 교체한다.
- 서로 항상 함께 바뀌는 값은 하나의 객체나 명확한 상태 모델로 묶는 것을 검토한다.

```tsx
type Filter = 'all' | 'open' | 'done'

const [filter, setFilter] = useState<Filter>('all')
```

유니언 타입을 사용하면 존재할 수 없는 문자열 상태를 컴파일 단계에서 막을 수 있다.

## 4. 생명주기는 Effect의 목적과 구분한다

`useEffect`를 `componentDidMount`, `componentDidUpdate`, `componentWillUnmount`의 단순 합본으로 외우면 불필요한 Effect가 늘어난다. Effect의 핵심 목적은 **React 바깥의 시스템과 동기화**하는 것이다.

```tsx
import { useEffect, useState } from 'react'

export default function OnlineStatus() {
  // 브라우저의 현재 네트워크 상태를 첫 state 값으로 사용한다.
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

  useEffect(() => {
    // 브라우저 이벤트가 발생하면 다음 렌더링에 사용할 state를 갱신한다.
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    // 컴포넌트가 화면에 있는 동안 두 이벤트를 구독한다.
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      // 같은 함수 참조로 리스너를 제거해 중복 등록과 메모리 누수를 막는다.
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return <p>{isOnline ? '온라인' : '오프라인'}</p>
}
```

setup은 mount 뒤에 실행되고, 의존성이 바뀌면 이전 cleanup 후 새 setup이 실행된다. unmount 때 마지막 cleanup이 실행된다. 개발 환경의 Strict Mode는 누락된 정리 로직을 찾기 위해 setup과 cleanup을 한 차례 더 시험할 수 있다.

## 5. Effect가 필요하지 않은 경우

```tsx
type Props = { price: number; quantity: number }

function OrderTotal({ price, quantity }: Props) {
  // Props만으로 계산할 수 있으므로 별도 state와 Effect를 만들지 않는다.
  const total = price * quantity
  // 계산 결과는 현재 렌더링에서 바로 JSX에 사용한다.
  return <strong>{total.toLocaleString()}원</strong>
}
```

`total`처럼 렌더링 중 계산할 수 있는 값은 Effect로 다시 state에 저장하지 않는다. 사용자의 클릭 때문에 실행되는 구매 요청도 Effect가 아니라 클릭 이벤트에 둔다.

## 6. 자주 하는 실수

- state를 직접 대입하거나 배열에 `push()`한 뒤 화면이 바뀌길 기대한다.
- setter 호출 직후 같은 렌더링의 state가 즉시 바뀐다고 생각한다.
- 모든 계산을 `useEffect`로 옮긴다.
- 구독·타이머·이벤트 리스너를 만들고 cleanup을 생략한다.
- 의존성 경고를 무시하기 위해 값을 임의로 배열에서 뺀다.

## 7. 적용 관점에서 다시 보기

새 값을 화면에 표시해야 한다면 먼저 그 값이 props로 받는 값인지, 렌더링 중 계산할 수 있는 값인지, 정말 state로 기억해야 하는 값인지 구분한다. state가 필요하다면 이벤트에서 setter를 호출하고, 이전 값에 의존하는 계산은 updater 함수를 사용한다.

Effect를 작성하기 전에는 “동기화할 React 바깥의 대상이 있는가?”라고 묻는다. DOM 이벤트 리스너, 타이머, 네트워크 연결처럼 정리가 필요한 대상이라면 setup과 반대되는 cleanup을 함께 작성한다. 계산 가능한 값을 state에 복제하는 용도라면 Effect를 제거하는 편이 낫다.

문제가 생기면 React DevTools와 콘솔로 렌더링 횟수를 보기 전에 다음 순서로 확인한다.

1. 렌더링 중 setter를 호출했는가?
2. 객체나 배열 state를 직접 수정했는가?
3. Effect가 읽는 반응형 값을 의존성에 포함했는가?
4. cleanup이 setup을 정확히 되돌리는가?

## 8. 배운 점 / 확장 포인트

### 8.1 새로 이해한 것

state는 컴포넌트 함수 안의 일반 변수와 달리 React가 렌더링 사이에 보존한다. setter 호출은 현재 변수의 값을 즉시 교체하는 명령이라기보다 다음 렌더링에 사용할 값을 예약하는 요청이다.

### 8.2 이전·다음 학습과의 연결

렌더링 흐름을 이해하면 state 스냅샷이 자연스럽게 연결된다. 다음에는 `useEffect`의 의존성, 커스텀 Hook, 데이터 패칭에서 cleanup이 왜 필요한지 확장한다.

### 8.3 더 확인할 주제

- 여러 state 업데이트의 batching
- 객체와 배열 state의 불변성
- Effect 없이 계산할 수 있는 파생 값
- state 보존과 `key`를 이용한 초기화

## 9. 요약 정리

state는 컴포넌트의 기억이고, 각 렌더링은 state의 스냅샷을 받는다. setter는 값을 즉시 덮어쓰기보다 다음 렌더링을 요청한다. Effect는 생명주기 메서드의 대체 문법이 아니라 외부 시스템과의 동기화 도구다.

🧠 기억할 것: 화면에 기억할 값은 state, 외부 시스템과 맞출 일은 Effect, setup으로 만든 연결은 cleanup으로 정리한다.

## 10. 미니 퀴즈

1. 지역 변수 변경과 state setter 호출의 차이는 무엇인가?
2. 이전 state로 다음 state를 계산할 때 updater 함수가 필요한 이유는 무엇인가?
3. cleanup이 필요한 외부 시스템의 예를 두 가지 말할 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 지역 변수 변경은 React에 화면 갱신을 알리지 않으며 다음 렌더링에서 다시 초기화된다. setter는 값을 보존하고 다음 렌더링을 예약한다.
2. 이벤트 함수는 자신이 만들어진 렌더링의 state 스냅샷을 본다. updater 함수는 React가 관리하는 최신 대기 값을 기준으로 다음 값을 계산한다.
3. `addEventListener`로 등록한 리스너, `setInterval` 타이머, WebSocket 연결 등이 있다. 각각 제거, 해제, 연결 종료가 cleanup에 필요하다.

</details>

## 참고 자료

- [State: A Component's Memory](https://react.dev/learn/state-a-components-memory)
- [State as a Snapshot](https://react.dev/learn/state-as-a-snapshot)
- [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
