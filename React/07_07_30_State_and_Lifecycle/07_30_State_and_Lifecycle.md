# 함수 컴포넌트로 이해하는 State와 생명주기

> 학습 목표: state가 필요한 이유와 렌더링마다 값이 보이는 방식을 이해하고, 컴포넌트의 시작·동기화·정리를 함수 컴포넌트 관점에서 설명한다.

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
  const [score, setScore] = useState<number>(0)

  return (
    <section>
      <p>점수: {score}</p>
      <button type="button" onClick={() => setScore(current => current + 1)}>
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
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
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
  const total = price * quantity
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

## 7. 요약과 복습

state는 컴포넌트의 기억이고, 각 렌더링은 state의 스냅샷을 받는다. setter는 값을 즉시 덮어쓰기보다 다음 렌더링을 요청한다. Effect는 생명주기 메서드의 대체 문법이 아니라 외부 시스템과의 동기화 도구다.

1. 지역 변수 변경과 state setter 호출의 차이는 무엇인가?
2. 이전 state로 다음 state를 계산할 때 updater 함수가 필요한 이유는 무엇인가?
3. cleanup이 필요한 외부 시스템의 예를 두 가지 말할 수 있는가?

## 참고 자료

- [State: A Component's Memory](https://react.dev/learn/state-a-components-memory)
- [State as a Snapshot](https://react.dev/learn/state-as-a-snapshot)
- [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
