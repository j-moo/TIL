# Vue State Management와 Pinia

- 🎯 글의 목표: Vue에서 상태 관리가 왜 필요한지 이해하고, Pinia를 사용해 여러 컴포넌트가 공유하는 상태를 중앙 저장소에서 관리하는 흐름을 Todo CRUD 실습까지 연결해 정리한다.
- 🧩 핵심 키워드: State, View, Actions, 단방향 데이터 흐름, Props, Emit, State Management, Pinia, Store, `defineStore`, State, Getters, Actions, Plugin, Todo CRUD, `v-model`, `watch`, Local Storage, `pinia-plugin-persistedstate`
- ⭐ 중요도: ★★★★★  
  Vue 프로젝트가 단순한 컴포넌트 연습을 넘어 실제 SPA 구조로 커질 때 반드시 필요한 내용이다. 여러 컴포넌트가 같은 데이터를 함께 읽고 수정해야 하는 순간부터 상태 관리 설계가 프로젝트 유지보수성을 크게 좌우한다.
- 📝 한눈에 보는 내용:  
  이번 강의는 “컴포넌트가 많아졌을 때 데이터를 어디에 두고 어떻게 바꿔야 할까?”라는 질문에서 출발한다. 먼저 Vue의 기본 구조인 `State → View → Actions` 흐름을 살펴보고, Props와 Emit만으로 공유 상태를 관리할 때 생기는 한계를 확인한다. 이후 Vue의 공식 상태 관리 라이브러리인 Pinia를 도입해 `state`, `getters`, `actions`, `plugin`의 역할을 정리하고, Todo 프로젝트에서 조회·생성·삭제·수정·완료 개수 계산·Local Storage 저장까지 연결해 본다.
- 🔗 관련 문제 / 주제: Vue 컴포넌트 간 데이터 전달, Props와 Emit, Composition API, Pinia Store, Todo CRUD, SPA 전역 상태 관리, Local Storage 상태 유지, 로그인 정보 관리, 장바구니, 사용자 설정 저장

---

## 1. 들어가며

Vue를 처음 배울 때는 하나의 컴포넌트 안에서 모든 것을 처리해도 크게 어렵지 않다. `ref()`로 데이터를 만들고, 템플릿에서 그 값을 보여주고, 버튼을 누르면 함수를 실행해 값을 바꾸면 된다. 이때는 상태가 어디에 있는지, 어떤 컴포넌트가 값을 바꾸는지, 화면이 왜 바뀌는지 비교적 쉽게 따라갈 수 있다.

하지만 프로젝트가 조금만 커지면 상황이 달라진다. 하나의 데이터가 여러 컴포넌트에서 동시에 필요해지고, 서로 멀리 떨어진 컴포넌트들이 같은 데이터를 바꿔야 하는 경우가 생긴다. 예를 들어 Todo 프로젝트에서 목록은 `TodoList`가 보여주지만, 새 Todo는 `TodoForm`이 만들고, 삭제와 완료 처리는 `TodoListItem`이 담당한다. 이때 Todo 목록이라는 하나의 상태는 여러 컴포넌트와 연결된다.

처음에는 이런 상황도 Props와 Emit으로 해결할 수 있다. 부모 컴포넌트가 데이터를 가지고 있다가 자식에게 Props로 내려주고, 자식이 어떤 동작을 요청하면 Emit으로 부모에게 알려주는 방식이다. 이 방식은 Vue의 기본이고, 단순한 부모-자식 관계에서는 여전히 가장 직관적이다.

문제는 컴포넌트 계층이 깊어지고 공유 상태가 많아지는 순간부터 시작된다. 데이터를 실제로 사용하지 않는 중간 컴포넌트가 단지 아래로 넘겨주기 위해 Props를 받아야 하고, 상태 변경 요청은 여러 단계의 Emit을 거쳐 위로 올라가야 한다. 이 흐름이 많아지면 “데이터가 어디서 왔는지”, “누가 값을 바꿨는지”, “왜 화면이 바뀌었는지”를 추적하기 어려워진다.

이번 강의에서 배우는 Pinia는 바로 이 문제를 해결하기 위한 Vue의 공식 상태 관리 라이브러리다. Pinia는 여러 컴포넌트가 함께 사용하는 상태를 컴포넌트 바깥의 중앙 저장소에 두고, 필요한 컴포넌트가 그 저장소를 직접 사용하도록 도와준다. 그래서 이 강의의 핵심은 단순히 Pinia 문법을 외우는 것이 아니라, **상태를 어디에 둘 것인지 판단하고, 상태 변경 로직을 어떤 위치에 둘 것인지 설계하는 감각**을 익히는 것이다.

---

## 2. 핵심 개념 정리

이번 강의의 큰 질문은 다음과 같다.

> Vue 프로젝트에서 여러 컴포넌트가 같은 데이터를 함께 사용할 때, 그 상태를 어떻게 관리해야 할까?

이 질문에 답하려면 먼저 Vue의 기본 데이터 흐름을 이해해야 한다. Vue 컴포넌트는 상태를 화면에 보여주고, 화면에서 발생한 사용자의 동작이 다시 상태를 바꾸는 구조로 움직인다. 이 흐름은 `State`, `View`, `Actions`라는 세 요소로 정리할 수 있다.

처음에는 이 구조가 단순하다. 하나의 컴포넌트 안에서 `state`를 만들고, `view`에 보여주고, 버튼 클릭 같은 `actions`로 값을 바꾸면 된다. 하지만 여러 컴포넌트가 같은 상태를 필요로 하면 상태를 특정 컴포넌트 하나에만 두기 어려워진다. 이때 공유 상태를 공통 조상 컴포넌트로 올리고 Props와 Emit으로 전달할 수 있지만, 컴포넌트 계층이 깊어질수록 코드가 복잡해진다.

Pinia는 이 공유 상태를 중앙 저장소인 `store`로 분리한다. 컴포넌트는 더 이상 여러 단계의 Props를 거칠 필요 없이, 필요한 store를 호출해 상태를 읽고 actions를 실행할 수 있다. Pinia 안에서는 원본 데이터는 `state`, 원본 데이터에서 계산되는 값은 `getters`, 상태를 변경하는 로직은 `actions`로 나누어 관리한다.

이번 강의의 흐름은 이론에서 끝나지 않고 Todo 프로젝트로 이어진다. Todo 목록을 store의 `state`로 만들고, Todo 추가·삭제·수정은 `actions`로 구현하며, 완료된 Todo 개수는 `getters`로 계산한다. 마지막에는 `pinia-plugin-persistedstate`를 사용해 Pinia state를 Local Storage에 저장하고, 새로고침 후에도 Todo 데이터가 유지되는 구조를 확인한다.

---

## 3. 본문 정리

이 섹션에서는 강의 흐름을 따라가며 상태 관리의 필요성부터 Pinia 구조, Todo CRUD 실습, Local Storage 상태 유지까지 차례대로 정리한다. 중요한 점은 Pinia를 “새로운 문법”으로만 보는 것이 아니라, 컴포넌트가 많아졌을 때 상태의 위치와 변경 흐름을 정리해주는 도구로 이해하는 것이다.

### 3.1 Vue 컴포넌트 구조: State, View, Actions

Vue의 컴포넌트는 상태, 화면, 기능이 서로 연결된 구조로 동작한다. 강의에서는 이를 `State`, `View`, `Actions`라는 세 요소로 나누어 설명한다.

- `State`: 앱을 구동하는 데 필요한 기본 데이터
- `View`: 상태를 선언적으로 매핑해 화면에 보여주는 부분
- `Actions`: 사용자의 입력이나 이벤트에 반응해 상태를 변경하는 동작

![Vue 컴포넌트의 State, View, Actions 구조](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 090722.png>)

위 그림에서 중요한 점은 데이터 흐름이 한 방향으로 이어진다는 것이다. 상태가 바뀌면 화면이 바뀌고, 사용자가 화면에서 어떤 동작을 하면 action이 실행되어 다시 상태가 바뀐다. 이 흐름은 아래처럼 정리할 수 있다.

```text
State 변경
   ↓
View 자동 업데이트
   ↓
사용자 입력 발생
   ↓
Actions 실행
   ↓
State 다시 변경
```

예를 들어 카운터 컴포넌트를 생각하면 `count`가 state이고, `{{ count }}`를 보여주는 부분이 view이며, 버튼 클릭 시 `count++`을 실행하는 함수가 action이다. 상태가 바뀌면 Vue의 반응형 시스템이 화면을 다시 업데이트하기 때문에, 개발자는 DOM을 직접 조작하지 않아도 된다.

이 구조는 작고 단순한 컴포넌트에서는 매우 직관적이다. 데이터가 컴포넌트 내부에 있고, 그 데이터를 바꾸는 함수도 같은 컴포넌트 안에 있으므로 전체 흐름을 한눈에 파악할 수 있다.

📌 핵심: Vue의 기본 구조는 상태가 화면을 만들고, 화면의 이벤트가 다시 상태를 바꾸는 단방향 데이터 흐름이다.

---

### 3.2 단방향 데이터 흐름이 복잡해지는 순간

단방향 데이터 흐름은 상태가 한 컴포넌트 안에 있을 때는 단순하다. 하지만 여러 컴포넌트가 같은 상태를 공유하기 시작하면 흐름이 복잡해진다. 강의에서는 대표적으로 두 가지 상황을 다룬다.

첫 번째는 여러 view가 동일한 상태에 종속되는 경우다. 예를 들어 Todo 목록 데이터가 여러 컴포넌트에서 필요하다면, 이 상태를 공통 조상 컴포넌트로 끌어올린 뒤 Props를 통해 아래 컴포넌트로 전달할 수 있다.

![여러 컴포넌트가 같은 상태를 Props로 전달받는 구조](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 091006.png>)

이 방식은 부모와 자식 관계가 단순할 때는 괜찮다. 하지만 컴포넌트 계층이 깊어지면 중간 컴포넌트가 실제로 데이터를 사용하지 않는데도, 아래로 전달하기 위해 Props를 받아야 한다. 이를 흔히 props drilling이라고 부른다. 데이터가 여러 단계를 지나가면 전달 경로가 길어지고, 나중에 구조를 수정할 때 어디를 함께 바꿔야 하는지 파악하기 어려워진다.

두 번째는 서로 다른 view의 기능이 동일한 상태를 변경해야 하는 경우다. 자식 컴포넌트는 부모의 상태를 직접 바꾸지 않고, 이벤트를 `emit`으로 올려보낸 뒤 부모가 상태를 변경한다.

![Emit을 통해 상태 변경 요청을 전달하는 구조](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 091020.png>)

이 방식도 Vue의 기본적인 흐름이다. 하지만 상태 변경 요청이 많아지면 이벤트 이름이 늘어나고, 어떤 이벤트가 어느 컴포넌트에서 발생해 어느 상태를 바꾸는지 추적하기 어려워질 수 있다. 특히 서로 멀리 떨어진 컴포넌트들이 같은 상태를 바꿔야 한다면 emit 흐름이 길어지고 코드가 복잡해진다.

⚠️ 주의: Props와 Emit은 잘못된 방식이 아니다. 부모-자식 관계에서 단순히 데이터를 전달하고 이벤트를 알리는 상황에서는 여전히 가장 기본적이고 좋은 방식이다. 다만 여러 컴포넌트가 공유하는 상태가 많아지는 순간부터는 별도의 상태 관리 도구를 고려해야 한다.

---

### 3.3 공유 상태를 중앙 저장소로 분리하기

상태 관리 문제를 해결하는 대표적인 방법은 여러 컴포넌트가 공유하는 상태를 컴포넌트 내부가 아니라 외부 저장소로 분리하는 것이다. 각 컴포넌트가 데이터 전달 경로에 의존하는 대신, 필요한 경우 중앙 저장소에 직접 접근하도록 만드는 방식이다.

![공유 상태를 전역 저장소로 분리하는 개념](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 091503.png>)

이 구조에서는 공유 상태가 특정 부모 컴포넌트에 묶이지 않는다. 상태와 상태 변경 로직이 중앙 저장소에 있고, 컴포넌트들은 필요한 상태를 읽거나 필요한 action을 호출한다. 그래서 계층 구조가 깊어져도 상태 접근 방식이 크게 복잡해지지 않는다.

![Pinia를 통해 모든 컴포넌트가 중앙 저장소에 접근하는 구조](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 091753.png>)

Pinia는 Vue에서 이 중앙 저장소 역할을 담당하는 공식 상태 관리 라이브러리다. 컴포넌트 트리는 하나의 큰 View가 되고, 공유 상태와 기능은 Pinia store에 모인다.

```text
컴포넌트 A ┐
컴포넌트 B ├──> Pinia Store
컴포넌트 C ┘       ├─ state: 공유 데이터
                  ├─ getters: 계산된 값
                  └─ actions: 상태 변경 로직
```

이렇게 구조를 나누면 컴포넌트는 화면과 사용자 입력 처리에 집중하고, store는 공유 상태와 상태 변경 로직을 담당한다. 역할이 나뉘기 때문에 프로젝트 규모가 커져도 상태 흐름을 추적하기 쉬워진다.

---

### 3.4 Pinia의 의미와 설치

Pinia는 Vue의 공식 상태 관리 라이브러리다. 여러 컴포넌트가 함께 사용해야 하는 공통 데이터를 중앙 저장소에서 통합 관리하도록 도와준다. Props나 Emit으로 복잡하게 데이터를 전달하지 않아도, 어떤 컴포넌트든 필요한 store에 접근해 데이터를 읽거나 action을 호출할 수 있다.

강의에서는 Vite 프로젝트를 생성할 때 Pinia 라이브러리를 함께 추가하는 방식으로 시작한다.

![Vite 프로젝트 생성 시 Pinia 추가](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 103259.png>)

Vite는 빠른 개발 환경을 위한 빌드 도구이자 개발 서버를 제공하는 프론트엔드 개발 도구다. Vue 프로젝트 생성 과정에서 Pinia를 선택하면 기본 프로젝트 구조 안에 상태 관리에 필요한 설정이 포함된다.

Pinia를 추가하면 프로젝트에 `stores` 폴더가 생성된다.

![Pinia 설치 후 stores 폴더 생성](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 103333.png>)

`stores` 폴더에는 여러 컴포넌트가 함께 사용할 상태 저장소 파일을 만든다. 예를 들어 Todo 목록을 관리한다면 `counter.js` 또는 `todo.js` 같은 store 파일을 둘 수 있고, 사용자 정보를 관리한다면 `user.js`, 장바구니를 관리한다면 `cart.js`처럼 역할별로 나누어 관리할 수 있다.

⚠️ 주의: 강의 필기에는 `sotres`처럼 오타가 보일 수 있지만 실제 폴더명은 보통 `stores`다. import 경로를 작성할 때 폴더명이 하나라도 다르면 모듈을 찾지 못하는 오류가 발생한다.

---

### 3.5 Pinia 구성 요소 한눈에 보기

Pinia를 제대로 사용하려면 구성 요소의 역할을 구분해야 한다. 강의에서는 다음 여섯 가지를 중심으로 Pinia를 설명한다.

1. `store`
2. `state`
3. `getters`
4. `actions`
5. 반환 값
6. `plugin`

이 요소들은 따로 떨어진 개념이 아니라 하나의 store 안에서 함께 동작한다. 아래 예시는 `counter` store를 기준으로 Pinia의 기본 구조를 정리한 것이다.

![Pinia store 기본 구조](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 103552.png>)

```js
// src/stores/counter.js

// ref는 반응형 원본 데이터를 만들 때 사용한다.
// computed는 원본 데이터를 기반으로 계산된 값을 만들 때 사용한다.
import { ref, computed } from 'vue'

// defineStore는 Pinia store를 정의하는 함수다.
import { defineStore } from 'pinia'

// defineStore의 반환 값을 담는 변수명은 use...Store 패턴을 권장한다.
// 이 이름을 보면 컴포넌트에서 호출하는 store 함수라는 점을 알 수 있다.
export const useCounterStore = defineStore('counter', () => {
  // state: 여러 컴포넌트가 공유할 반응형 데이터
  const count = ref(0)

  // getters: state를 기반으로 계산되는 값
  // count가 바뀔 때만 doubleCount도 다시 계산된다.
  const doubleCount = computed(() => count.value * 2)

  // actions: state를 변경하는 함수
  // 버튼 클릭 같은 이벤트에서 호출할 수 있다.
  function increment() {
    count.value++
  }

  // 외부 컴포넌트에서 사용할 값과 함수는 반드시 return한다.
  return { count, doubleCount, increment }
})
```

여기서 첫 번째 인자인 `'counter'`는 애플리케이션 전체에서 이 store를 구분하는 고유 ID다. 그리고 `useCounterStore`는 컴포넌트에서 호출해 store 인스턴스를 가져오는 함수다.

---

### 3.6 store: 공통 데이터를 관리하는 중앙 저장소

`store`는 여러 컴포넌트가 공유하는 상태와 기능이 모이는 중앙 저장소다. 컴포넌트 내부에 흩어져 있던 상태를 store로 옮기면, 필요한 컴포넌트가 store를 호출해서 같은 상태를 사용할 수 있다.

예를 들어 카운터 값을 여러 컴포넌트에서 보여줘야 한다면 `count`를 각 컴포넌트에 따로 만들지 않고 store에 둔다. 그러면 어느 컴포넌트에서 값을 변경하더라도 같은 store를 바라보는 컴포넌트들이 함께 업데이트된다.

`defineStore()`의 반환 값을 담는 변수 이름은 보통 `use...Store` 패턴으로 작성한다.

```js
export const useCounterStore = defineStore('counter', () => {
  // store 내용
})
```

이 패턴은 단순한 이름 규칙처럼 보이지만, 프로젝트가 커질수록 중요해진다. `useCounterStore`, `useUserStore`, `useTodoStore`처럼 작성하면 어떤 store를 가져오는 함수인지 바로 알 수 있다.

---

### 3.7 state: 중앙 저장소에 저장되는 반응형 데이터

`state`는 store 안에 저장되는 원본 데이터다. 컴포넌트 내부에서 `ref()`로 만든 데이터가 그 컴포넌트 안에서만 사용되는 반응형 상태라면, Pinia store의 state는 여러 컴포넌트가 함께 사용할 수 있는 반응형 상태다.

![Pinia state 예시](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 103716.png>)

```js
const count = ref(0)
```

`count`를 변경하면 이 값을 사용하고 있는 모든 컴포넌트의 화면이 자동으로 업데이트된다. 이 점은 Vue의 반응형 시스템과 같다. 차이는 이 값이 특정 컴포넌트 내부에 있는 것이 아니라 store 안에 있다는 점이다.

```text
컴포넌트 내부 ref
- 해당 컴포넌트 중심의 로컬 상태

Pinia state
- 여러 컴포넌트가 함께 사용하는 공유 상태
```

⚠️ 주의: store에 정의하지 않은 state를 컴포넌트에서 임의로 새로 추가해서 쓰는 방식은 피해야 한다. 공유 상태는 store 안에서 명확히 정의하고, 컴포넌트는 그 상태를 읽거나 action을 통해 변경하는 흐름으로 잡는 것이 좋다.

---

### 3.8 getters: state를 기반으로 계산되는 값

`getters`는 state를 기반으로 파생된 값을 계산하는 부분이다. Vue의 `computed()`와 같은 역할이라고 이해하면 쉽다.

![Pinia getters 예시](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 103828.png>)

```js
const doubleCount = computed(() => count.value * 2)
```

`doubleCount`는 원본 데이터가 아니다. `count`라는 원본 state에서 계산되는 값이다. 따라서 별도의 state로 저장하기보다 computed 형태로 계산하는 것이 자연스럽다.

Todo 프로젝트에서는 완료된 Todo 개수가 getters의 좋은 예시다. 완료 개수는 따로 저장해야 하는 원본 데이터가 아니라, `todos` 배열에서 `isDone`이 `true`인 항목을 세면 얻을 수 있는 값이다. 이런 값은 state로 따로 관리하면 오히려 동기화 실수가 생길 수 있다.

📌 핵심: 직접 저장해야 하는 원본 데이터는 state, 원본 데이터에서 계산할 수 있는 값은 getters로 분리한다.

---

### 3.9 actions: state를 변경하는 로직

`actions`는 state를 변경하거나, 비동기 요청처럼 상태 변경과 연결된 로직을 실행하는 함수다. Vue 컴포넌트의 methods와 비슷한 역할을 한다.

![Pinia actions 예시](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 104200.png>)

```js
function increment() {
  count.value++
}
```

actions는 단순히 값을 하나 바꾸는 함수만 의미하지 않는다. 실제 프로젝트에서는 actions 안에서 API 요청을 보내고, 응답 데이터를 받아 state에 저장하거나, 여러 state를 함께 변경하거나, 조건에 따라 다른 처리를 할 수 있다.

Todo 프로젝트에서는 `addTodo`, `deleteTodo`, `updateTodo`가 actions에 해당한다. 컴포넌트가 직접 `todos` 배열을 조작하지 않고 store action을 호출하면, 상태 변경 로직이 한곳에 모이기 때문에 관리하기 쉽다.

---

### 3.10 반환 값: 컴포넌트에서 사용할 값은 반드시 return하기

Pinia setup store에서는 외부에서 사용할 값과 함수를 반드시 반환해야 한다. store 안에서 `count`, `doubleCount`, `increment`를 만들었더라도 `return`하지 않으면 컴포넌트에서 접근할 수 없다.

![Pinia setup store의 반환 값](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 104256.png>)

```js
return { count, doubleCount, increment }
```

이 줄은 단순한 마무리 코드가 아니라, store의 공개 범위를 결정하는 부분이다. 컴포넌트에서 사용할 state, getters, actions는 모두 return 객체 안에 포함되어야 한다.

⚠️ 주의: setup store에서 값을 만들고 return을 빼먹으면 template이나 다른 컴포넌트에서 해당 값을 사용할 수 없다. 특히 state나 action을 추가한 뒤 return에 넣지 않아 “정의했는데 왜 안 보이지?”라는 오류가 자주 생긴다.

---

### 3.11 plugin: Pinia 기능 확장하기

Pinia의 plugin은 상태 관리에 필요한 추가 기능을 제공하거나 확장하는 도구다. 강의에서는 Local Storage에 Pinia state를 자동 저장하고 복원하는 `pinia-plugin-persistedstate`를 예시로 다룬다.

plugin을 사용하면 store의 state 값이 바뀔 때마다 자동으로 브라우저 저장소에 저장할 수 있다. 이렇게 하면 페이지를 새로고침해도 값이 초기화되지 않고 유지된다.

```text
Pinia state 변경
   ↓
persistedstate plugin이 감지
   ↓
Local Storage에 저장
   ↓
새로고침 후 store 복원
```

이 내용은 뒤쪽의 Local Storage 섹션에서 Todo 프로젝트와 함께 다시 연결된다.

---

### 3.12 컴포넌트에서 Pinia store 사용하기

store를 정의했다면 컴포넌트에서는 해당 store를 import한 뒤 호출해서 사용한다. 컴포넌트 깊이에 관계없이 store 인스턴스로 state에 접근할 수 있고, getters와 actions도 같은 방식으로 사용할 수 있다.

![컴포넌트에서 Pinia state 접근](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 104602.png>)

```vue
<script setup>
// store 파일에서 useCounterStore 함수를 가져온다.
import { useCounterStore } from '@/stores/counter'

// store 인스턴스를 생성한다.
// 이제 template에서 store.count처럼 접근할 수 있다.
const store = useCounterStore()
</script>

<template>
  <!-- state는 store.count 형태로 읽을 수 있다. -->
  <p>count: {{ store.count }}</p>
</template>
```

getters도 state처럼 값으로 접근한다.

![컴포넌트에서 Pinia getters 접근](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 104644.png>)

```vue
<template>
  <!-- getter는 computed 기반 값이므로 함수 호출이 아니라 값처럼 사용한다. -->
  <p>double count: {{ store.doubleCount }}</p>
</template>
```

actions는 함수이므로 이벤트에서 호출할 수 있다.

![컴포넌트에서 Pinia actions 호출](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 104746.png>)

```vue
<template>
  <!-- 버튼 클릭 시 store의 action을 호출한다. -->
  <button @click="store.increment()">증가</button>
</template>
```

getters와 actions는 이름이 비슷하게 store에 붙어 있지만 역할이 다르다. getters는 값을 계산해서 보여주는 데 사용하고, actions는 상태를 변경하거나 로직을 실행하는 데 사용한다.

Vue Devtools를 사용하면 Pinia store의 state와 getters를 확인할 수 있다.

![Vue Devtools에서 Pinia store 확인](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 104821.png>)

개발 중에는 Devtools로 store 값이 원하는 시점에 바뀌는지 확인하는 습관이 중요하다. 특히 Todo 생성, 삭제, 수정처럼 state가 자주 바뀌는 기능에서는 Devtools가 디버깅에 큰 도움이 된다.

---

### 3.13 Pinia 실습: Todo 프로젝트의 목표와 구조

이제 Pinia를 실제 Todo 프로젝트에 적용한다. 실습 목표는 단순히 Todo 화면을 만드는 것이 아니라, Todo 목록이라는 공유 상태를 Pinia store에서 관리하는 흐름을 익히는 것이다.

![Pinia Todo 프로젝트 구현 목표](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 104914.png>)

실습에서 구현할 기능은 크게 두 가지로 정리할 수 있다.

1. Todo CRUD 구현
2. 완료된 Todo 개수 계산

![Todo 프로젝트 결과 화면 예시](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 104930.png>)

컴포넌트 구조는 다음처럼 볼 수 있다.

```text
App.vue
├── TodoForm.vue
└── TodoList.vue
    └── TodoListItem.vue
```

각 컴포넌트의 역할은 분명하게 나뉜다.

| 파일 | 역할 |
|---|---|
| `App.vue` | 전체 화면 구조를 조립하고 완료된 Todo 개수를 보여준다. |
| `TodoForm.vue` | 새 Todo를 입력하고 생성 요청을 보낸다. |
| `TodoList.vue` | store의 todos를 반복하며 TodoListItem을 렌더링한다. |
| `TodoListItem.vue` | 개별 Todo 하나의 표시, 삭제, 완료 여부 수정을 담당한다. |
| `stores/counter.js` | Todo 목록 state와 Todo 변경 actions, 완료 개수 getter를 관리한다. |

---

### 3.14 Todo 프로젝트 사전 준비

실습을 시작하기 전에 기본 생성 파일을 정리한다. 초기 생성된 컴포넌트는 `App.vue`를 제외하고 삭제하고, `src/assets` 내부 파일도 필요하지 않다면 정리한다. `main.js`에서 기본 CSS import가 남아 있다면 삭제할 수 있다.

![Todo 프로젝트 사전 파일 정리](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105043.png>)

이후 `TodoListItem` 컴포넌트와 `TodoList` 컴포넌트를 만들고, `TodoList` 안에서 `TodoListItem`을 등록한다.

![TodoList와 TodoListItem 컴포넌트 작성](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105125.png>)

그리고 `TodoForm` 컴포넌트를 작성한 뒤, `App.vue`에서 `TodoList`와 `TodoForm`을 함께 등록한다.

![TodoForm 작성과 App 컴포넌트 등록](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105207.png>)

마지막으로 화면에서 컴포넌트 구성이 제대로 잡혔는지 확인한다.

![Todo 프로젝트 컴포넌트 구성 확인](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105334.png>)

이 준비 단계에서 중요한 점은 컴포넌트를 무작정 나누는 것이 아니라 역할을 기준으로 나누는 것이다. 입력을 담당하는 부분, 목록을 반복하는 부분, 개별 항목을 처리하는 부분이 분리되어야 뒤에서 Pinia store와 연결할 때 흐름이 깔끔해진다.

---

### 3.15 Todo 조회: state에 목록을 만들고 화면에 출력하기

Todo 조회의 시작은 store에 임시 `todos` 목록 state를 정의하는 것이다. Todo 목록은 여러 컴포넌트가 함께 사용해야 하므로 컴포넌트 내부가 아니라 store에 둔다.

![store에 임시 todos state 정의](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105416.png>)

```js
// src/stores/counter.js

import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', () => {
  // Todo마다 고유한 id를 부여하기 위한 변수다.
  // 새 Todo를 만들 때마다 id++로 증가시킨다.
  let id = 0

  // todos는 여러 컴포넌트가 함께 읽고 수정할 Todo 목록 state다.
  const todos = ref([
    { id: id++, text: '할 일 1', isDone: false },
    { id: id++, text: '할 일 2', isDone: false },
  ])

  // 컴포넌트에서 todos를 사용해야 하므로 return에 포함한다.
  return { todos }
})
```

`TodoList.vue`에서는 store의 todos를 참조하고, `v-for`로 반복하면서 각 todo를 `TodoListItem`에 props로 전달한다.

![TodoList에서 todos 반복 출력](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105501.png>)

```vue
<!-- TodoList.vue -->

<script setup>
import { useCounterStore } from '@/stores/counter'
import TodoListItem from '@/components/TodoListItem.vue'

// store를 호출하면 todos state에 접근할 수 있다.
const store = useCounterStore()
</script>

<template>
  <div>
    <!-- v-for는 배열의 각 요소를 반복해서 화면에 그린다. -->
    <!-- todo 하나를 TodoListItem에 props로 전달한다. -->
    <TodoListItem
      v-for="todo in store.todos"
      :key="todo.id"
      :todo="todo"
    />
  </div>
</template>
```

`v-for`는 배열 형태의 데이터를 반복해서 HTML 요소나 컴포넌트로 그릴 때 사용한다. 이때 `:key`는 Vue가 각 항목을 구분하는 기준이다. Todo처럼 추가, 삭제, 수정이 일어나는 목록에서는 `:key`를 안정적인 고유값으로 지정하는 것이 중요하다.

`TodoListItem.vue`에서는 props를 정의한 뒤 전달받은 todo의 text를 출력한다.

![TodoListItem에서 props로 받은 todo 출력](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105545.png>)

```vue
<!-- TodoListItem.vue -->

<script setup>
// 부모 컴포넌트에서 전달받은 todo 객체를 props로 정의한다.
defineProps({
  todo: Object,
})
</script>

<template>
  <div>
    <!-- 전달받은 todo의 text를 화면에 보여준다. -->
    <span>{{ todo.text }}</span>
  </div>
</template>
```

이 단계까지 구현하면 store의 `todos` state가 `TodoList`를 거쳐 `TodoListItem`에 표시된다. 즉, Pinia store에 있는 데이터가 화면에 렌더링되는 조회 흐름이 완성된다.

⚠️ 주의: `TodoListItem`에서 `todo`를 사용하려면 부모에서 `:todo="todo"`로 넘겨야 하고, 자식에서는 `defineProps`로 받아야 한다. store를 쓴다고 해서 모든 컴포넌트가 반드시 store에 직접 접근해야 하는 것은 아니다. 목록 전체는 `TodoList`가 store에서 읽고, 개별 항목은 props로 전달하는 방식도 충분히 자연스럽다.

---

### 3.16 Todo 생성: actions로 목록에 새 항목 추가하기

Todo 생성은 사용자가 입력한 문자열을 받아 `todos` 배열에 새 Todo 객체를 추가하는 기능이다. 상태를 변경하는 로직이므로 store의 actions로 작성한다.

![addTodo action 정의](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105626.png>)

```js
// src/stores/counter.js

const addTodo = function (todoText) {
  // todos.value는 실제 배열이다.
  // 새 Todo 객체를 만들어 배열 끝에 추가한다.
  todos.value.push({
    id: id++,
    text: todoText,
    isDone: false,
  })
}

// 컴포넌트에서 addTodo를 호출해야 하므로 return에 포함한다.
return { todos, addTodo }
```

여기서 `addTodo`가 받는 `todoText`는 사용자가 form에 입력한 문자열이다. store는 이 문자열을 받아 Todo 객체로 만들고, 기존 `todos` 배열에 추가한다. Todo 객체에 `id`와 `isDone`을 함께 넣는 이유는 이후 삭제와 수정에서 필요하기 때문이다.

`TodoForm.vue`에서는 입력값을 다루기 위해 `v-model`을 사용한다.

![TodoForm에서 v-model로 입력값 관리](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105717.png>)

```vue
<!-- TodoForm.vue -->

<script setup>
import { ref } from 'vue'

// 사용자가 input에 입력한 문자열을 저장한다.
const todoText = ref('')
</script>

<template>
  <form>
    <!-- v-model은 input 값과 todoText를 양방향으로 동기화한다. -->
    <input type="text" v-model="todoText">
    <input type="submit">
  </form>
</template>
```

`v-model`은 form 요소와 데이터를 양방향으로 묶는 문법이다. 사용자가 input에 값을 입력하면 `todoText`가 바뀌고, 코드에서 `todoText`를 바꾸면 input의 값도 함께 바뀐다.

이제 submit 이벤트가 발생했을 때 store의 `addTodo` action을 호출한다.

![submit 이벤트에서 addTodo 호출](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105755.png>)

```vue
<!-- TodoForm.vue -->

<script setup>
import { ref } from 'vue'
import { useCounterStore } from '@/stores/counter'

// Todo를 추가하기 위해 store를 호출한다.
const store = useCounterStore()

// input과 연결될 반응형 변수다.
const todoText = ref('')

const createTodo = function (todoText) {
  // 사용자가 입력한 텍스트를 store action에 전달한다.
  store.addTodo(todoText)
}
</script>

<template>
  <!-- submit 기본 동작인 새로고침을 막고 createTodo를 실행한다. -->
  <form @submit.prevent="createTodo(todoText)">
    <input type="text" v-model="todoText">
    <input type="submit">
  </form>
</template>
```

여기서 `@submit.prevent`는 form 제출 시 페이지가 새로고침되는 기본 동작을 막는다. SPA에서 form submit으로 화면이 새로고침되면 현재 앱 상태가 초기화될 수 있으므로, 기본 동작을 막고 JavaScript 로직으로 처리하는 경우가 많다.

입력 후 input을 초기화하려면 form 요소를 참조해 reset할 수 있다.

![form ref를 사용한 입력 초기화](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105832.png>)

```vue
<!-- TodoForm.vue -->

<script setup>
import { ref } from 'vue'
import { useCounterStore } from '@/stores/counter'

const store = useCounterStore()
const todoText = ref('')

// form DOM 요소를 참조하기 위한 ref다.
const formElem = ref(null)

const createTodo = function (todoText) {
  // 새 Todo를 store에 추가한다.
  store.addTodo(todoText)

  // form의 입력 값을 초기화한다.
  formElem.value.reset()
}
</script>

<template>
  <!-- ref 속성으로 form DOM 요소를 연결한다. -->
  <form @submit.prevent="createTodo(todoText)" ref="formElem">
    <input type="text" v-model="todoText">
    <input type="submit">
  </form>
</template>
```

결과를 확인하면 입력한 Todo가 목록에 추가된다.

![Todo 생성 결과 확인](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105851.png>)

강의에서는 store의 `addTodo`를 template에서 직접 호출하지 않고, `createTodo`라는 컴포넌트 내부 함수를 한 번 거쳐서 호출했다.

![createTodo 함수를 따로 만드는 이유](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 105944.png>)

이렇게 하는 이유는 `addTodo` 호출 전후로 추가 로직을 작성할 수 있기 때문이다. 예를 들어 빈 문자열이면 추가하지 않기, 추가 후 input 초기화하기, 추가 후 알림 보여주기 같은 처리를 `createTodo` 안에 함께 넣을 수 있다.

⚠️ 주의: `formElem.value.reset()`은 DOM form의 입력값을 초기화하는 방식이다. 반응형 변수까지 확실하게 비우고 싶다면 `todoText.value = ''`를 함께 사용하는 편이 더 분명하다. 특히 `v-model`로 연결된 값은 화면과 상태가 함께 관리되므로, 상태 값을 직접 초기화하는 습관이 안전하다.

---

### 3.17 Todo 삭제: id를 기준으로 특정 항목 제거하기

Todo 삭제는 선택된 Todo의 `id`를 기준으로 목록에서 해당 항목을 제거하는 기능이다. 먼저 store에 `deleteTodo` action을 정의한다.

![deleteTodo action 정의](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110026.png>)

```js
// src/stores/counter.js

const deleteTodo = function (selectedId) {
  // 처음에는 전달받은 id가 잘 들어오는지 확인하면서 구현할 수 있다.
  console.log('delete', selectedId)
}

return { todos, addTodo, deleteTodo }
```

`TodoListItem.vue`에서는 삭제 버튼을 클릭했을 때 현재 Todo의 id를 store action에 전달한다.

![삭제 버튼에서 todo id 전달](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110127.png>)

```vue
<!-- TodoListItem.vue -->

<script setup>
import { useCounterStore } from '@/stores/counter'

const props = defineProps({
  todo: Object,
})

const store = useCounterStore()

const deleteTodo = function (todoId) {
  // 컴포넌트 내부 함수는 store action을 호출하는 중간 역할을 한다.
  store.deleteTodo(todoId)
}
</script>

<template>
  <div>
    <span>{{ todo.text }}</span>

    <!-- 현재 todo의 id를 삭제 action에 전달한다. -->
    <button @click="deleteTodo(todo.id)">삭제</button>
  </div>
</template>
```

삭제 로직은 크게 두 가지 방식으로 구현할 수 있다. 첫 번째는 `findIndex`로 삭제할 항목의 위치를 찾고, `splice`로 해당 위치의 요소를 제거하는 방식이다.

![findIndex와 splice를 사용한 Todo 삭제](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110258.png>)

```js
const deleteTodo = function (selectedId) {
  // selectedId와 일치하는 todo의 인덱스를 찾는다.
  const index = todos.value.findIndex((todo) => todo.id === selectedId)

  // 찾은 위치에서 1개 요소를 제거한다.
  todos.value.splice(index, 1)
}
```

이 방식은 “정확히 하나의 항목을 찾아 그 위치에서 제거한다”는 의도가 분명하다. 다만 일치하는 항목이 없을 때 `findIndex`는 `-1`을 반환하므로, 실제 프로젝트에서는 안전 처리를 추가하는 것이 좋다.

```js
const deleteTodo = function (selectedId) {
  const index = todos.value.findIndex((todo) => todo.id === selectedId)

  // index가 -1이면 일치하는 항목이 없다는 뜻이다.
  if (index !== -1) {
    todos.value.splice(index, 1)
  }
}
```

두 번째 방식은 `filter`로 삭제 대상이 아닌 항목만 남겨 새 배열을 만드는 방식이다.

![filter를 사용한 Todo 삭제](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110326.png>)

```js
const deleteTodo = function (selectedId) {
  // selectedId와 다른 id를 가진 todo만 남긴다.
  // 결과적으로 선택된 todo만 배열에서 제거된다.
  todos.value = todos.value.filter((todo) => todo.id !== selectedId)
}
```

`filter` 방식은 기존 배열에서 특정 요소를 직접 제거한다기보다, 조건에 맞는 요소들로 새 배열을 만든 뒤 state를 교체하는 방식이다. 삭제 조건이 코드에 잘 드러나기 때문에 가독성이 좋은 편이다.

⚠️ 주의: 삭제 기준으로 배열의 인덱스보다 `id`를 사용하는 편이 안전하다. 화면에서 목록 순서가 바뀌거나 항목이 추가·삭제되면 인덱스는 변할 수 있지만, Todo의 고유 id는 해당 항목을 안정적으로 구분해준다.

---

### 3.18 Todo 수정: 완료 여부를 토글하고 스타일 적용하기

Todo 수정의 목표는 각 Todo의 `isDone` 값을 변경해 완료 여부를 처리하는 것이다. 완료된 Todo에는 취소선 스타일을 적용해 화면에서 구분한다.

![Todo 수정 기능 목표와 updateTodo action 정의](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110449.png>)

화면에서는 체크박스를 클릭하면 `isDone` 값이 바뀌고, 그 변화를 감지해 store의 `updateTodo` action을 호출한다.

![체크박스와 isDone ref 연결](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110530.png>)

```vue
<!-- TodoListItem.vue -->

<script setup>
import { ref } from 'vue'

const props = defineProps({
  todo: Object,
})

// props로 받은 todo의 isDone 값을 컴포넌트 내부 ref로 연결한다.
const isDone = ref(props.todo.isDone)
</script>

<template>
  <div>
    <!-- 체크박스와 isDone을 v-model로 연결한다. -->
    <input type="checkbox" name="todo-text" v-model="isDone">
    <label for="todo-text">{{ todo.text }}</label>
  </div>
</template>
```

이제 `watch`를 사용해 `isDone`이 바뀌는 순간 store의 `updateTodo`를 호출한다.

![watch로 isDone 변경 감지](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110602.png>)

```vue
<!-- TodoListItem.vue -->

<script setup>
import { ref, watch } from 'vue'
import { useCounterStore } from '@/stores/counter'

const props = defineProps({
  todo: Object,
})

const store = useCounterStore()
const isDone = ref(props.todo.isDone)

// isDone 값이 바뀌면 실행된다.
watch(isDone, () => {
  // 현재 todo의 id를 기준으로 store의 상태를 수정한다.
  store.updateTodo(props.todo.id)
})
</script>
```

여기서 핵심은 체크박스가 직접 store state를 수정하는 것이 아니라, 변경을 감지한 뒤 store action을 호출한다는 점이다. 상태 변경 로직은 store에 모아두고, 컴포넌트는 사용자 입력을 받아 action을 실행하는 역할을 한다.

수정 로직도 삭제와 마찬가지로 두 가지 방식으로 볼 수 있다. 첫 번째는 `forEach`를 사용해 일치하는 항목을 직접 수정하는 방식이다.

![forEach를 사용한 Todo 수정](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110804.png>)

```js
const updateTodo = function (selectedId) {
  todos.value.forEach((todo) => {
    // id가 일치하는 Todo를 찾는다.
    if (todo.id === selectedId) {
      // 완료 여부를 반대로 바꾼다.
      todo.isDone = !todo.isDone
    }
  })
}
```

두 번째는 `map`을 사용해 수정된 결과를 반영한 새 배열을 만드는 방식이다.

![map을 사용한 Todo 수정](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110841.png>)

```js
const updateTodo = function (selectedId) {
  todos.value = todos.value.map((todo) => {
    // id가 일치하는 항목만 완료 여부를 바꾼다.
    if (todo.id === selectedId) {
      todo.isDone = !todo.isDone
    }

    // 각 todo를 새 배열의 요소로 반환한다.
    return todo
  })
}
```

완료된 Todo에는 class binding으로 취소선 스타일을 적용한다.

![isDone 값에 따른 스타일 바인딩](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 110917.png>)

```vue
<!-- TodoListItem.vue -->

<template>
  <label
    for="todo-text"
    :class="{ 'is-done': todo.isDone }"
  >
    {{ todo.text }}
  </label>
</template>

<style scoped>
.is-done {
  text-decoration: line-through;
}
</style>
```

`:class="{ 'is-done': todo.isDone }"`는 `todo.isDone`이 `true`일 때만 `is-done` 클래스를 적용한다. 즉, 완료 상태와 화면 스타일이 직접 연결된다.

⚠️ 주의: 강의 필기 중 `idDone`처럼 보이는 표현은 실제 코드에서는 `isDone`으로 이해해야 한다. 변수명 하나가 틀리면 체크박스, 수정 로직, 스타일 바인딩이 모두 제대로 연결되지 않을 수 있다.

---

### 3.19 수정과 삭제 구현 방식 비교

수정과 삭제는 구현 방식에 따라 크게 두 관점으로 나눌 수 있다.

- In-place 방식: 기존 배열에서 필요한 항목만 직접 수정하거나 제거한다.
- 전체 배열 재생성 방식: 배열을 순회해 필요한 변경 사항이 반영된 새 배열을 만들고 기존 배열에 다시 할당한다.

```text
In-place 방식
- findIndex + splice로 특정 항목 삭제
- forEach로 특정 항목 직접 수정

전체 배열 재생성 방식
- filter로 삭제할 항목을 제외한 새 배열 생성
- map으로 수정된 항목이 반영된 새 배열 생성
```

두 방식은 작은 프로젝트에서는 성능 차이가 크게 느껴지지 않을 수 있다. 그래서 중요한 것은 어떤 방식이 무조건 더 좋다는 결론보다, 지금 코드가 무엇을 의도하는지 분명히 알고 선택하는 것이다.

예를 들어 `splice`는 “이 인덱스에서 하나를 제거한다”는 의도가 강하고, `filter`는 “조건을 만족하는 항목만 남긴다”는 의도가 강하다. `forEach`는 “찾아서 직접 바꾼다”는 느낌이고, `map`은 “각 항목을 변환해 새 배열을 만든다”는 느낌이다.

📌 핵심: 삭제와 수정 코드를 작성할 때는 코드 길이보다 의도를 먼저 본다. 단일 항목을 직접 바꿀 것인지, 새 배열을 만들어 상태를 교체할 것인지 기준을 잡고 선택해야 한다.

---

### 3.20 완료된 Todo 개수 계산: getters로 파생 값 만들기

완료된 Todo 개수는 `todos` 배열을 기반으로 계산할 수 있는 값이다. 따라서 별도의 state로 저장하기보다 getters로 만드는 것이 좋다.

![완료된 Todo 개수 getter 작성](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 112432.png>)

```js
// src/stores/counter.js

import { computed } from 'vue'

const doneTodosCount = computed(() => {
  // isDone이 true인 todo만 모은다.
  const doneTodos = todos.value.filter((todo) => todo.isDone)

  // 완료된 todo의 개수를 반환한다.
  return doneTodos.length
})

return {
  todos,
  addTodo,
  deleteTodo,
  updateTodo,
  doneTodosCount,
}
```

`doneTodosCount`는 원본 데이터가 아니라 `todos`에서 계산된 결과다. 완료 여부가 바뀌면 `todos`가 바뀌고, 그에 따라 `doneTodosCount`도 자동으로 다시 계산된다.

`App.vue`에서는 이 getter를 참조해 화면에 출력한다.

![App 컴포넌트에서 doneTodosCount 출력](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 112529.png>)

```vue
<!-- App.vue -->

<script setup>
import { useCounterStore } from '@/stores/counter'
import TodoList from '@/components/TodoList.vue'
import TodoForm from '@/components/TodoForm.vue'

const store = useCounterStore()
</script>

<template>
  <div>
    <h1>Todo Project</h1>

    <!-- getter는 함수 호출이 아니라 값처럼 사용한다. -->
    <h2>완료된 Todo 개수: {{ store.doneTodosCount }}</h2>

    <TodoList />
    <TodoForm />
  </div>
</template>
```

⚠️ 주의: 완료된 Todo 개수를 별도의 state로 저장하면 생성, 삭제, 수정이 일어날 때마다 개수를 직접 맞춰야 한다. 이 과정에서 동기화 실수가 생기기 쉽다. 기존 state에서 계산 가능한 값은 getters로 처리하는 것이 더 안전하다.

---

### 3.21 Local Storage: 브라우저에 상태 저장하기

Local Storage는 브라우저 안에 key-value 쌍으로 데이터를 저장하는 웹 스토리지 객체다. 쉽게 말하면 브라우저 안에 작은 저장 공간을 두는 것이다.

Local Storage에 저장된 데이터는 사용자가 직접 삭제하지 않는 한 페이지를 새로고침하거나 브라우저를 껐다 켜도 유지된다. 그래서 서버와 무관하게 브라우저에 기억해두면 되는 사용자 설정이나 임시 상태를 저장할 때 사용할 수 있다.

```text
Local Storage 사용 예시
- 다크 모드 설정
- 언어 설정
- 간단한 사용자 옵션
- 장바구니 임시 데이터
- Todo 실습의 todos state
```

Local Storage의 특징은 다음과 같다.

- 페이지를 새로고침하고 브라우저를 다시 실행해도 데이터가 유지된다.
- 쿠키와 다르게 네트워크 요청 시 서버로 자동 전송되지 않는다.
- 같은 도메인 안에서는 여러 탭이나 창 간에 데이터를 공유할 수 있다.

쿠키는 서버가 사용자를 기억하기 위해 브라우저에 남기는 정보에 가깝다. 반면 Local Storage는 클라이언트 측에서 필요한 상태를 보관하는 공간에 가깝다.

⚠️ 주의: Local Storage는 브라우저에서 쉽게 확인할 수 있으므로 민감한 개인정보나 보안 토큰을 아무렇게나 저장하면 안 된다. 실습에서는 Todo 목록처럼 민감하지 않은 데이터를 저장하는 용도로 이해하는 것이 좋다.

---

### 3.22 pinia-plugin-persistedstate로 Pinia 상태 유지하기

`pinia-plugin-persistedstate`는 Pinia의 state를 Local Storage나 Session Storage에 저장하고 복원해주는 플러그인이다. Todo 목록이 store state에만 있으면 새로고침할 때 초기값으로 돌아가지만, persistedstate plugin을 적용하면 변경된 state가 브라우저 저장소에 남아 다시 복원된다.

먼저 패키지를 설치한다.

```bash
npm i pinia-plugin-persistedstate
```

그다음 `main.js`에서 Pinia에 plugin을 등록한다.

![pinia-plugin-persistedstate 설치 및 등록](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 113132.png>)

```js
// src/main.js

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import App from './App.vue'

const app = createApp(App)

// Pinia 인스턴스를 먼저 만든다.
const pinia = createPinia()

// Pinia 인스턴스에 persistedstate plugin을 등록한다.
pinia.use(piniaPluginPersistedstate)

// plugin이 등록된 Pinia 인스턴스를 Vue 앱에 연결한다.
app.use(pinia)

app.mount('#app')
```

여기서 순서가 중요하다. `createPinia()`로 만든 Pinia 인스턴스에 plugin을 등록한 뒤, 그 인스턴스를 `app.use(pinia)`로 연결해야 한다.

이후 `defineStore()`의 세 번째 인자로 `persist` 옵션을 추가한다.

![defineStore에 persist 옵션 추가](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 113201.png>)

```js
// src/stores/counter.js

export const useCounterStore = defineStore(
  'counter',
  () => {
    // state, getters, actions 작성
    return {
      todos,
      addTodo,
      deleteTodo,
      updateTodo,
      doneTodosCount,
    }
  },
  {
    // 이 store의 state를 브라우저 저장소에 저장하고 복원한다.
    persist: true,
  }
)
```

적용 후에는 개발자 도구의 Application 탭에서 Local Storage에 저장된 todos state를 확인할 수 있다.

![Local Storage에 todos state 저장 확인](<../assets/images/06_08_State_management/화면 캡처 2026-06-08 113254.png>)

이제 Todo를 추가하거나 완료 처리한 뒤 새로고침해도 이전 상태가 유지된다. 사용자가 페이지를 다시 열었을 때도 브라우저 저장소에 남아 있는 데이터를 기반으로 store가 복원된다.

⚠️ 주의: `app.use(createPinia())`처럼 바로 Pinia를 등록하면 plugin을 연결한 Pinia 인스턴스가 아니라 새 인스턴스를 등록하는 실수를 할 수 있다. plugin을 사용할 때는 `const pinia = createPinia()`로 만든 뒤 `pinia.use(...)`, `app.use(pinia)` 순서를 지키는 것이 안전하다.

---

### 3.23 Pinia는 언제 사용해야 할까?

Pinia를 배웠다고 해서 모든 데이터를 store에 넣어야 하는 것은 아니다. 컴포넌트 내부에서만 사용하는 데이터까지 Pinia로 관리하면 오히려 코드가 불필요하게 복잡해질 수 있다.

예를 들어 하나의 input 안에서만 잠깐 쓰는 값, 특정 모달 컴포넌트 내부에서만 필요한 열림/닫힘 상태, 특정 페이지에서만 쓰는 임시 필터 값은 컴포넌트 내부의 `ref()`로 관리하는 편이 더 간단할 수 있다.

반대로 다음과 같은 경우에는 Pinia 사용을 고려할 수 있다.

- 여러 컴포넌트가 같은 상태를 함께 읽어야 하는 경우
- 서로 다른 위치의 컴포넌트가 같은 상태를 수정해야 하는 경우
- Props 전달 단계가 너무 깊어지는 경우
- 로그인 사용자 정보처럼 앱 전역에서 필요한 상태가 있는 경우
- 장바구니, Todo 목록, 즐겨찾기처럼 여러 화면에서 유지되어야 하는 데이터가 있는 경우
- Local Storage와 연결해 상태를 유지하고 싶은 경우

단순한 부모-자식 데이터 전달은 Props와 Emit이 더 직관적이다. 하지만 중대형 규모의 SPA에서는 공유 상태가 자연스럽게 늘어나고, 이때 Pinia는 상태를 한곳에서 관리할 수 있게 해주는 좋은 선택이 된다.

📌 핵심: Pinia는 모든 데이터를 담는 곳이 아니라, 여러 컴포넌트가 함께 사용하는 공유 상태를 관리하는 곳이다.

---

## 4. 적용 관점에서 다시 보기

이번 강의의 핵심은 “상태를 어디에 둘 것인가”를 판단하는 것이다. Vue를 사용할 때 모든 데이터를 무조건 store에 넣는 것도 좋지 않고, 모든 데이터를 Props와 Emit으로만 처리하는 것도 프로젝트가 커지면 부담이 된다. 중요한 것은 상태의 범위와 사용 위치를 보고 적절한 관리 방식을 선택하는 것이다.

먼저 컴포넌트 하나에서만 쓰는 값이라면 `ref()`로 컴포넌트 내부에서 관리하면 된다. 예를 들어 특정 input의 임시 입력값이나 모달 내부의 열림 상태는 굳이 Pinia로 올리지 않아도 된다. 부모가 자식에게 단순히 값을 전달하는 정도라면 Props를 쓰면 되고, 자식이 부모에게 이벤트를 알려야 한다면 Emit을 쓰면 된다.

하지만 여러 컴포넌트가 같은 데이터를 함께 사용하거나, 서로 멀리 떨어진 컴포넌트가 같은 상태를 수정해야 한다면 Pinia를 떠올릴 수 있다. Todo 프로젝트에서는 `todos` 배열이 대표적인 공유 상태다. 목록은 `TodoList`가 보여주고, 생성은 `TodoForm`이 요청하고, 삭제와 수정은 `TodoListItem`이 처리한다. 이렇게 하나의 상태가 여러 컴포넌트의 기능과 연결되면 store에 두는 것이 자연스럽다.

실제 구현 순서는 다음처럼 잡으면 이해하기 쉽다.

```text
1. 여러 컴포넌트가 함께 사용하는 데이터인지 확인한다.
2. 공유 상태라면 store의 state로 만든다.
3. state를 변경하는 로직은 actions로 분리한다.
4. state에서 계산할 수 있는 값은 getters로 만든다.
5. 컴포넌트에서는 store를 호출해 state, getters, actions를 사용한다.
6. 새로고침 후에도 유지해야 하는 값이면 persistedstate plugin을 연결한다.
```

Todo 프로젝트에 적용하면 아래처럼 정리된다.

| 기능 | Pinia에서 담당하는 부분 | 설명 |
|---|---|---|
| Todo 목록 조회 | `state` | `todos` 배열을 store에 저장하고 여러 컴포넌트에서 참조한다. |
| Todo 추가 | `actions` | `addTodo`가 입력 문자열을 받아 새 Todo 객체를 만든다. |
| Todo 삭제 | `actions` | `deleteTodo`가 id를 기준으로 특정 Todo를 제거한다. |
| Todo 완료 수정 | `actions` | `updateTodo`가 `isDone` 값을 토글한다. |
| 완료 개수 계산 | `getters` | `doneTodosCount`가 완료된 Todo 개수를 계산한다. |
| 새로고침 후 유지 | `plugin` | persistedstate가 Local Storage에 state를 저장하고 복원한다. |

실전에서 자주 헷갈리는 부분은 `state`와 `getters`를 나누는 기준이다. 원본으로 저장해야 하는 데이터는 state에 두고, 그 원본에서 계산할 수 있는 값은 getters로 만든다. 완료 개수처럼 계산 가능한 값을 state로 따로 저장하면, Todo를 수정하거나 삭제할 때 개수를 맞춰주는 추가 로직이 필요하고 실수 가능성이 커진다.

또 하나 중요한 기준은 action의 역할이다. 컴포넌트에서 `todos` 배열을 직접 조작해도 화면은 바뀔 수 있지만, 상태 변경 로직이 컴포넌트 곳곳에 흩어지면 유지보수가 어려워진다. 가능하면 “상태를 어떻게 바꿀지”는 actions에 모으고, 컴포넌트는 사용자의 입력을 받아 action을 호출하는 역할에 집중시키는 편이 좋다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

이번 강의를 통해 Vue의 상태 관리가 단순히 `ref()`를 어디에 쓰느냐의 문제가 아니라, 프로젝트 구조가 커졌을 때 상태의 위치를 설계하는 문제라는 점을 이해할 수 있다. 하나의 컴포넌트 안에서는 단방향 데이터 흐름이 단순하지만, 여러 컴포넌트가 같은 상태를 공유하면 Props와 Emit만으로는 흐름이 길어지고 복잡해질 수 있다.

또한 Pinia의 `state`, `getters`, `actions`는 각각 따로 외우는 문법이 아니라 Todo CRUD 안에서 역할이 자연스럽게 나뉜다는 점이 중요하다. Todo 목록은 state, 목록을 바꾸는 추가·삭제·수정은 actions, 완료 개수처럼 목록에서 계산되는 값은 getters로 정리할 수 있다.

### 5.2 앞으로 이어지는 연결점

이번 내용은 Vue 프로젝트에서 로그인 상태, 사용자 정보, 장바구니, 즐겨찾기, 테마 설정, 알림 상태 등을 관리하는 구조로 이어진다. 특히 API 요청과 연결하면 actions 안에서 서버 데이터를 받아 state에 저장하고, getters로 화면에 필요한 형태를 계산하는 방식으로 확장할 수 있다.

또한 Vue Router에서 배운 Navigation Guard와 Pinia를 함께 사용하면 로그인 여부에 따라 페이지 접근을 제어하는 구조를 만들 수 있다. 예를 들어 Pinia store에 로그인 상태를 저장하고, Router Guard에서 해당 상태를 확인해 마이페이지 접근을 허용하거나 로그인 페이지로 redirect할 수 있다.

### 5.3 더 파볼 만한 주제

추가로 학습하면 좋은 주제는 `storeToRefs`, Pinia의 option store 방식과 setup store 방식의 차이, actions 안에서 API 요청을 처리하는 패턴, persistedstate에서 특정 state만 저장하는 설정이다. Local Storage에는 민감한 정보를 저장하면 안 되므로, 인증 토큰을 어디에 어떻게 저장할지에 대한 보안 관점도 함께 공부하면 좋다.

---

## 6. 요약 정리

📌 핵심

- Vue의 기본 구조는 `State → View → Actions → State`로 이어지는 단방향 데이터 흐름이다.
- Props와 Emit은 부모-자식 데이터 전달에 적합하지만, 공유 상태가 많아지면 관리가 복잡해질 수 있다.
- Pinia는 여러 컴포넌트가 함께 사용하는 상태를 중앙 store에서 관리하는 Vue 공식 상태 관리 라이브러리다.
- `state`는 원본 데이터, `getters`는 원본 데이터에서 계산되는 값, `actions`는 상태 변경 로직이다.
- setup store에서는 컴포넌트에서 사용할 값과 함수를 반드시 `return`해야 한다.
- Todo CRUD에서는 `todos`를 state로 두고, 추가·삭제·수정은 actions로 구현하며, 완료 개수는 getters로 계산한다.
- 삭제는 `findIndex + splice` 또는 `filter`, 수정은 `forEach` 또는 `map` 방식으로 구현할 수 있다.
- Local Storage와 `pinia-plugin-persistedstate`를 사용하면 새로고침 후에도 Pinia state를 유지할 수 있다.
- Pinia는 모든 데이터를 넣는 곳이 아니라, 여러 컴포넌트가 공유하는 상태를 관리하는 곳이다.

🧠 기억할 것

```text
컴포넌트 내부에서만 쓰는 값 → ref
부모가 자식에게 전달하는 값 → props
자식이 부모에게 알리는 이벤트 → emit
여러 컴포넌트가 함께 쓰는 값 → Pinia store
원본 데이터 → state
계산된 데이터 → getters
상태 변경 로직 → actions
새로고침 후 유지할 상태 → persistedstate plugin
```

---

## 7. 미니 퀴즈 또는 체크리스트

1. Vue의 `State`, `View`, `Actions`는 각각 어떤 역할을 하는가?
2. 여러 컴포넌트가 같은 상태를 공유할 때 Props와 Emit만으로 관리하면 어떤 문제가 생길 수 있는가?
3. Pinia에서 `state`, `getters`, `actions`는 각각 어떤 기준으로 나누어야 하는가?
4. setup store에서 만든 값을 컴포넌트에서 사용하려면 마지막에 무엇을 해야 하는가?
5. Todo 목록은 왜 컴포넌트 내부 `ref()`가 아니라 store의 state로 두는 것이 자연스러운가?
6. Todo 추가 기능에서 `createTodo` 함수를 따로 만든 이유는 무엇인가?
7. 삭제 로직에서 `findIndex + splice` 방식과 `filter` 방식은 어떤 차이가 있는가?
8. 수정 로직에서 `forEach` 방식과 `map` 방식은 어떤 관점 차이가 있는가?
9. 완료된 Todo 개수는 왜 별도의 state가 아니라 getters로 계산하는 것이 좋은가?
10. `pinia-plugin-persistedstate`를 사용하면 어떤 문제가 해결되는가?
11. Local Storage에 저장해도 되는 데이터와 저장하면 위험한 데이터는 어떻게 구분할 수 있는가?
12. Pinia를 사용하지 않고 Props와 Emit을 사용하는 편이 더 적절한 상황은 언제인가?

### 이해 점검 체크리스트

- [ ] Vue의 단방향 데이터 흐름을 `State`, `View`, `Actions`로 설명할 수 있다.
- [ ] Props와 Emit이 적합한 상황과 한계가 생기는 상황을 구분할 수 있다.
- [ ] `defineStore()`로 Pinia store를 만들고 컴포넌트에서 호출할 수 있다.
- [ ] `state`와 `getters`의 차이를 Todo 예제로 설명할 수 있다.
- [ ] `actions`에 상태 변경 로직을 모으는 이유를 설명할 수 있다.
- [ ] `v-model`, `@submit.prevent`, `watch`, `:class`가 Todo 프로젝트에서 어떤 역할을 했는지 설명할 수 있다.
- [ ] `filter`, `findIndex + splice`, `forEach`, `map`을 활용한 수정·삭제 방식의 차이를 말할 수 있다.
- [ ] Local Storage와 Pinia persistedstate plugin의 연결 흐름을 설명할 수 있다.
- [ ] 모든 데이터를 Pinia에 넣는 것이 아니라, 공유 상태에 Pinia를 사용하는 기준을 설명할 수 있다.
