# Vue Basic Syntax 2 - Computed, Conditional Rendering, List Rendering, Watch, Lifecycle Hooks

- 🎯 글의 목표: Vue에서 반응형 데이터를 화면에 더 효율적으로 연결하는 방법을 익히고, `computed`, `v-if`, `v-show`, `v-for`, `watch`, Lifecycle Hooks를 상황에 맞게 사용할 수 있도록 정리한다.
- 🧩 핵심 키워드: `computed`, `cache`, `method`, `v-if`, `v-show`, `v-for`, `key`, `watch`, `onMounted`, `onUpdated`, Vue Style Guide
- ⭐ 중요도: ★★★★★  
  Vue 화면 구현에서 거의 매번 등장하는 기본 문법이다. 특히 `computed`와 `watch`, `v-for`와 `key`, `v-if`와 `v-for`의 관계는 실습과 프로젝트에서 자주 실수하는 지점이므로 정확히 구분해두는 것이 중요하다.
- 📝 한눈에 보는 내용:  
  이번 강의는 “데이터가 바뀔 때 화면을 어떻게 효율적으로 다시 보여줄 것인가?”라는 질문을 중심으로 이어진다. 먼저 계산된 값을 캐싱하는 `computed`를 배우고, 조건에 따라 화면을 보이거나 숨기는 `v-if`와 `v-show`를 비교한다. 이후 배열과 객체를 반복 출력하는 `v-for`, 변경을 감지해 부수 효과를 실행하는 `watch`, 컴포넌트 생애주기 시점에 코드를 실행하는 Lifecycle Hooks까지 연결한다.
- 🔗 관련 문제 / 주제: Vue Composition API, Todo App 구현, 조건부 렌더링, 목록 렌더링, API 요청 시점 제어, 반응형 데이터 관리

---

## 1. 들어가며

Vue를 처음 사용할 때는 `ref`로 데이터를 만들고, 템플릿에서 그 값을 출력하는 방식만으로도 간단한 화면을 만들 수 있다. 하지만 화면이 조금만 복잡해지면 단순 출력만으로는 부족해진다. 예를 들어 할 일 목록이 남아 있는지 계산해야 하거나, 로그인 여부에 따라 다른 버튼을 보여주거나, 배열의 항목을 반복 출력해야 하는 상황이 바로 생긴다.

이때 필요한 것이 Vue의 기본 문법들이다. `computed`는 원본 데이터를 바탕으로 계산된 값을 만들고, `v-if`와 `v-show`는 조건에 따라 화면 표시 방식을 결정한다. `v-for`는 배열과 객체를 반복해서 화면에 출력하며, `watch`는 데이터 변화가 생겼을 때 특정 작업을 수행하게 해준다. 마지막으로 Lifecycle Hooks는 컴포넌트가 화면에 나타나는 시점이나 업데이트되는 시점에 코드를 실행할 수 있게 한다.

이번 강의의 핵심은 문법을 따로따로 외우는 것이 아니라, **데이터 변화 → 계산 → 렌더링 → 감시 → 생애주기 실행**이라는 흐름으로 이해하는 것이다. 이렇게 연결해서 보면 Vue 문법이 단순한 암기 대상이 아니라, 화면을 안정적으로 구성하기 위한 도구라는 점이 분명해진다.

---

## 2. 핵심 개념 정리

이번 강의는 Vue에서 화면을 구성할 때 자주 부딪히는 네 가지 질문을 해결하는 방향으로 진행된다.

첫 번째 질문은 **“템플릿 안의 복잡한 계산을 어떻게 깔끔하게 분리할 것인가?”**이다. 이 질문은 `computed`로 해결한다. `computed`는 원본 반응형 데이터에 의존하는 계산 결과를 미리 정의해두고, 원본이 바뀔 때만 다시 계산한다.

두 번째 질문은 **“조건에 따라 어떤 요소를 보여줄 것인가?”**이다. 여기서는 `v-if`, `v-else`, `v-else-if`, `v-show`가 등장한다. 겉으로는 모두 조건에 따라 화면을 제어하지만, 실제 DOM에서 요소를 제거하는지 아니면 CSS로 숨기는지에 따라 사용처가 달라진다.

세 번째 질문은 **“배열이나 객체 데이터를 어떻게 반복해서 출력할 것인가?”**이다. `v-for`를 사용하면 목록을 렌더링할 수 있다. 이때 `key`는 각 항목을 구분하는 이름표 역할을 하므로 반드시 함께 사용하는 것이 좋다.

네 번째 질문은 **“데이터가 바뀌었을 때 계산값이 아니라 특정 행동을 실행하려면 어떻게 할 것인가?”**이다. 이때는 `watch`를 사용한다. `computed`가 값을 만드는 도구라면, `watch`는 값의 변경을 감지해서 API 요청, 로그 출력, 다른 데이터 업데이트 같은 작업을 수행하는 도구다.

마지막으로 Lifecycle Hooks는 컴포넌트가 생성되고, DOM에 연결되고, 업데이트되고, 사라지는 흐름 속에서 원하는 시점에 코드를 실행할 수 있게 해준다. 특히 API 요청처럼 화면이 준비된 뒤 실행해야 하는 작업은 `onMounted`와 자주 연결된다.

---

## 3. 본문 정리

이 섹션에서는 각 개념을 강의 흐름에 맞춰 정리한다. 단순히 문법만 적는 것이 아니라, 해당 문법이 왜 필요한지와 어떤 실수를 조심해야 하는지까지 함께 본다.

### 3.1 Computed Properties: 계산된 값을 템플릿 밖으로 꺼내기

`computed`는 **반응형 데이터를 기반으로 계산된 값을 정의하는 함수**다. 쉽게 말하면, 템플릿에서 매번 계산식을 직접 쓰지 않고, 계산 결과에 이름을 붙여 재사용할 수 있게 만드는 방식이다.

할 일 목록을 예로 들어보면, `todos.length > 0`이라는 조건은 “할 일이 남았는가?”를 판단하는 계산이다. 이 계산을 템플릿 안에 직접 쓰면 처음에는 간단해 보이지만, 같은 계산이 여러 번 반복되거나 조건이 길어지면 템플릿이 금방 복잡해진다.

#### Computed가 없는 경우

아래 예시는 할 일이 남았는지 여부를 템플릿 안에서 직접 계산하는 흐름이다.

![computed를 사용하지 않고 템플릿에서 직접 조건을 계산하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 223138.png>)

```html
<!-- computed를 사용하지 않는 경우 -->
<div id="app">
  <!-- todos.length를 템플릿에서 직접 검사한다. -->
  <!-- 계산식이 짧을 때는 괜찮지만, 여러 곳에서 반복되면 템플릿이 복잡해진다. -->
  <h2>남은 할 일</h2>
  <p>{{ todos.length > 0 ? '아직 남았다' : '퇴근!' }}</p>
</div>
```

이 방식의 문제는 계산 로직이 화면 구조 안으로 들어온다는 점이다. 템플릿은 원래 “어떤 HTML을 보여줄지”를 표현하는 공간인데, 계산식이 길어질수록 화면 구조와 데이터 처리 로직이 섞이게 된다.

#### Computed를 사용하는 경우

같은 계산을 `computed`로 분리하면 템플릿은 훨씬 읽기 쉬워진다.

![computed를 사용해 restOfTodos 값을 만든 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 223320.png>)

```html
<div id="app">
  <h2>남은 할 일</h2>

  <!-- 템플릿에서는 계산식이 아니라 계산된 이름만 사용한다. -->
  <p>{{ restOfTodos }}</p>
</div>

<script>
const { createApp, ref, computed } = Vue

createApp({
  setup() {
    // todos는 원본 반응형 데이터다.
    const todos = ref([
      { text: 'Vue 학습' },
      { text: '계산된 속성 정리' },
    ])

    // restOfTodos는 todos를 기반으로 계산되는 값이다.
    // todos.value.length가 바뀔 때만 다시 계산된다.
    const restOfTodos = computed(() => {
      return todos.value.length > 0 ? '아직 남았다' : '퇴근!'
    })

    // 템플릿에서 사용할 값은 return 해야 한다.
    return { todos, restOfTodos }
  }
}).mount('#app')
</script>
```

여기서 중요한 점은 `restOfTodos`가 단순 문자열 변수가 아니라 **computed ref**라는 점이다. 일반 `ref`처럼 `.value`로 접근할 수 있지만, 템플릿에서는 Vue가 자동으로 `.value`를 풀어주기 때문에 `{{ restOfTodos }}`처럼 사용할 수 있다.

#### Computed의 특징

`computed`는 의존하는 반응형 데이터를 자동으로 추적한다. 아래 예시에서 `restOfTodos`는 `todos.value.length`에 의존하고 있으므로, `todos`가 변경될 때만 다시 계산된다.

![computed가 의존하는 데이터가 변경될 때만 다시 계산되는 구조](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 223435.png>)

```js
const restOfTodos = computed(() => {
  // 이 computed는 todos.value.length를 읽고 있다.
  // 따라서 Vue는 restOfTodos가 todos에 의존한다는 것을 추적한다.
  return todos.value.length > 0 ? '아직 남았다' : '퇴근!'
})
```

`ref`가 기본형 데이터나 객체를 반응형으로 만드는 도구라면, `computed ref`는 원본 데이터가 바뀔 때만 값을 다시 계산하는 파생 데이터라고 볼 수 있다.

📌 핵심: `computed`는 템플릿을 단순하게 만들고, 같은 계산을 여러 번 사용할 때 불필요한 반복 계산을 줄여준다.

---

### 3.2 Computed와 Method: 계산값인가, 실행 동작인가

`computed`와 `method`는 겉으로 보면 비슷한 일을 할 수 있다. 둘 다 어떤 로직을 함수로 분리할 수 있기 때문이다. 하지만 Vue에서 두 개념은 실행 방식이 다르다.

`computed`는 의존하는 데이터가 바뀌기 전까지 계산 결과를 캐싱한다. 반면 `method`는 호출될 때마다 함수를 다시 실행한다.

#### Method로 같은 로직을 처리하는 경우

아래 예시는 `computed`에서 했던 계산을 method로 처리하는 구조다.

![computed와 동일한 로직을 method로 작성한 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 223646.png>)

```html
<div id="app">
  <h2>남은 할 일</h2>

  <!-- method는 함수이므로 괄호를 붙여 호출한다. -->
  <p>{{ getRestOfTodos() }}</p>
</div>

<script>
const { createApp, ref } = Vue

createApp({
  setup() {
    const todos = ref([
      { text: 'Vue 학습' },
    ])

    // method는 호출될 때마다 실행된다.
    const getRestOfTodos = function () {
      return todos.value.length > 0 ? '아직 남았다' : '퇴근!'
    }

    return { todos, getRestOfTodos }
  }
}).mount('#app')
</script>
```

템플릿에서 `computed`는 값처럼 사용하고, `method`는 함수처럼 호출한다. 이 차이는 단순한 문법 차이가 아니라 실행 방식의 차이로 이어진다.

#### Cache를 기준으로 이해하기

캐시는 한 번 계산하거나 받아온 데이터를 잠시 저장해두는 임시 저장소다. 강의에서는 캐시를 “자주 꺼내 먹는 식재료를 넣어두는 냉장고”처럼 이해할 수 있다고 설명했다. 요리할 때마다 매번 마트에 갈 필요 없이 냉장고에서 재료를 꺼내 쓰는 것처럼, 이미 계산된 결과를 다시 사용할 수 있다면 성능을 아낄 수 있다.

웹 페이지에서도 캐시는 자주 사용된다. 이전에 방문한 페이지의 일부 데이터를 브라우저 캐시에 저장해두면, 같은 페이지에 다시 접속할 때 모든 데이터를 새로 받지 않고 일부 캐시된 데이터를 사용해 더 빠르게 렌더링할 수 있다.

#### computed와 method의 사용 기준

| 구분 | computed | method |
|---|---|---|
| 실행 방식 | 의존 데이터가 바뀔 때만 다시 계산 | 호출될 때마다 실행 |
| 캐싱 여부 | 캐싱됨 | 캐싱되지 않음 |
| 템플릿 사용 | `{{ restOfTodos }}` | `{{ getRestOfTodos() }}` |
| 적합한 상황 | 데이터 기반 계산값 | 특정 동작 실행, 매개변수 필요한 함수 |

계산 결과가 원본 데이터에 의존하고, 같은 결과를 여러 곳에서 재사용한다면 `computed`가 적합하다. 반대로 버튼 클릭 처리처럼 어떤 행동을 실행하거나, 계산할 때 외부 인자가 필요하다면 `method`를 사용하는 편이 자연스럽다.

⚠️ 주의: `computed`가 좋아 보인다고 모든 함수를 `computed`로 만들면 안 된다. 매개변수가 필요한 계산이나 이벤트 처리처럼 “호출” 자체가 중요한 로직은 `method`가 더 알맞다.

---

### 3.3 Conditional Rendering: 조건에 따라 화면 보여주기

조건부 렌더링은 특정 조건에 따라 화면에 보여줄 요소를 결정하는 문법이다. Vue에서는 대표적으로 `v-if`, `v-else`, `v-else-if`, `v-show`를 사용한다.

#### v-if: 조건이 참일 때만 DOM에 생성하기

`v-if`는 표현식이 `true`일 때만 요소를 렌더링한다. 조건이 `false`이면 해당 요소는 화면에서만 숨겨지는 것이 아니라 DOM 구조에서 완전히 제거된다.

![v-if를 사용해 true일 때만 요소를 보여주는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 224556.png>)

```html
<div id="app">
  <!-- isSeen이 true일 때만 p 태그가 DOM에 생성된다. -->
  <p v-if="isSeen">true일 때 보여요</p>

  <!-- 버튼을 누르면 isSeen 값이 true/false로 전환된다. -->
  <button @click="isSeen = !isSeen">토글</button>
</div>

<script>
const { createApp, ref } = Vue

createApp({
  setup() {
    // 처음에는 true이므로 문장이 보인다.
    const isSeen = ref(true)

    return { isSeen }
  }
}).mount('#app')
</script>
```

`v-if`에서 중요한 점은 조건이 거짓일 때 요소가 DOM에서 사라진다는 것이다. 즉, 단순히 눈에 안 보이게 하는 것보다 더 강한 조건부 렌더링이다.

#### v-else와 v-else-if

조건이 하나만 있는 경우에는 `v-if`만으로 충분하지만, 조건에 따라 다른 내용을 보여줘야 한다면 `v-else`와 `v-else-if`를 함께 사용한다.

![v-if와 v-else를 사용해 조건에 따라 다른 문장을 보여주는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 224655.png>)

```html
<div id="app">
  <!-- isSeen이 true이면 첫 번째 문장이 보인다. -->
  <p v-if="isSeen">true일 때 보여요</p>

  <!-- isSeen이 false이면 v-else 블록이 보인다. -->
  <p v-else>false일 때 보여요</p>

  <button @click="isSeen = !isSeen">토글</button>
</div>
```

여러 조건을 나눠야 할 때는 `v-else-if`를 사용한다.

![v-else-if를 사용해 name 값에 따라 다른 요소를 보여주는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 224747.png>)

```html
<div id="app">
  <!-- name 값에 따라 하나의 블록만 선택된다. -->
  <div v-if="name === 'Alice'">Alice입니다</div>
  <div v-else-if="name === 'Bella'">Bella입니다</div>
  <div v-else-if="name === 'Cathy'">Cathy입니다</div>
  <div v-else>아무도 아닙니다</div>
</div>

<script>
const { createApp, ref } = Vue

createApp({
  setup() {
    const name = ref('Cathy')
    return { name }
  }
}).mount('#app')
</script>
```

#### 여러 요소를 하나의 조건으로 묶기

여러 개의 태그를 같은 조건으로 함께 보여주고 싶을 때는 `<template>`에 `v-if`를 사용할 수 있다. `<template>`은 실제 DOM에 남는 요소가 아니라, 여러 요소를 묶어주는 보이지 않는 wrapper 역할을 한다.

![template에 v-if를 적용해 여러 요소를 조건부 렌더링하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 224842.png>)

```html
<div id="app">
  <!-- template은 화면에 실제 태그로 남지 않고 내부 요소만 조건부로 렌더링한다. -->
  <template v-if="name === 'Cathy'">
    <div>Cathy입니다</div>
    <div>나이는 30살입니다</div>
  </template>
</div>
```

⚠️ 주의: 여러 요소를 조건부로 묶기 위해 의미 없는 `<div>`를 무조건 추가하면 HTML 구조가 불필요하게 복잡해질 수 있다. 실제 wrapper가 필요 없다면 `<template>`을 사용하는 것이 더 깔끔하다.

---

### 3.4 v-if와 v-show: DOM에서 제거할 것인가, CSS로 숨길 것인가

`v-show`도 조건에 따라 요소를 보여주거나 숨긴다. 하지만 `v-if`와 결정적인 차이가 있다. `v-if`는 조건이 false이면 DOM에서 요소를 제거하지만, `v-show`는 요소를 항상 DOM에 렌더링해두고 CSS `display` 속성만 전환한다.

![v-show가 display none으로 가시성만 전환되는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 225158.png>)

```html
<div id="app">
  <!-- isShow가 false이면 DOM에는 남아 있지만 display: none이 적용된다. -->
  <div v-show="isShow">v-show</div>
</div>

<script>
const { createApp, ref } = Vue

createApp({
  setup() {
    const isShow = ref(false)
    return { isShow }
  }
}).mount('#app')
</script>
```

개발자 도구에서 확인하면 `v-show`가 적용된 요소는 DOM에 남아 있고, 대신 다음과 같이 스타일이 적용된다.

```html
<div style="display: none;">v-show</div>
```

`display: none`은 요소를 화면에서 보이지 않게 만들고, 공간도 차지하지 않게 한다. 하지만 요소 자체가 DOM에서 삭제되는 것은 아니다.

#### v-if와 v-show의 선택 기준

| 구분 | v-if | v-show |
|---|---|---|
| false일 때 | DOM에서 제거 | DOM에는 남고 CSS로 숨김 |
| 초기 렌더링 | 조건이 false이면 렌더링하지 않음 | 조건과 관계없이 렌더링 |
| 토글 비용 | 높음 | 낮음 |
| 적합한 상황 | 조건이 자주 바뀌지 않을 때 | 자주 보여주고 숨길 때 |

강의에서는 `v-if`를 “초기 로딩은 가볍지만 토글 비용이 높은 방식”, `v-show`를 “초기 로딩은 무겁지만 토글 비용이 낮은 방식”으로 정리했다. 콘텐츠를 매우 자주 전환한다면 `v-show`가 유리하고, 실행 중 조건이 거의 바뀌지 않는다면 `v-if`가 더 알맞다.

📌 핵심: `v-if`와 `v-show`는 둘 다 조건부 표시를 하지만, DOM 처리 방식이 다르므로 토글 빈도를 기준으로 선택해야 한다.

---

### 3.5 List Rendering: v-for로 배열과 객체 출력하기

`v-for`는 배열이나 객체 데이터를 기반으로 요소를 반복 렌더링하는 Directive다. 게시글 목록, 상품 목록, 할 일 목록처럼 같은 구조의 UI를 여러 번 반복해서 보여줄 때 사용한다.

#### v-for 기본 구조

`v-for`는 `alias in expression` 형식을 사용한다. 여기서 `alias`는 반복 중 현재 항목을 가리키는 이름이고, `expression`은 반복할 데이터다.

![v-for의 기본 구조](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 231551.png>)

```html
<!-- items 배열의 각 요소를 item이라는 이름으로 하나씩 꺼낸다. -->
<div v-for="item in items">
  {{ item.text }}
</div>
```

배열을 순회할 때는 현재 값뿐 아니라 인덱스도 함께 받을 수 있다.

![배열을 v-for로 반복하며 index를 함께 사용하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 232236.png>)

```html
<div id="app">
  <!-- myArr 배열을 순회하며 item과 index를 함께 사용한다. -->
  <div v-for="(item, index) in myArr">
    {{ index }} / {{ item.name }}
  </div>
</div>

<script>
const { createApp, ref } = Vue

createApp({
  setup() {
    const myArr = ref([
      { name: 'Alice', age: 20 },
      { name: 'Bella', age: 21 },
    ])

    return { myArr }
  }
}).mount('#app')
</script>
```

객체를 순회할 때는 값, 키, 인덱스를 함께 사용할 수 있다.

![객체 v-for 순회 구조](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 231640.png>)

![객체를 value, key, index로 반복 출력하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 232306.png>)

```html
<div id="app">
  <!-- 객체 순회 순서: value, key, index -->
  <div v-for="(value, key, index) in myObj">
    {{ index }} / {{ key }} / {{ value }}
  </div>
</div>

<script>
const { createApp, ref } = Vue

createApp({
  setup() {
    const myObj = ref({
      name: 'Cathy',
      age: 30,
    })

    return { myObj }
  }
}).mount('#app')
</script>
```

#### 여러 요소를 반복할 때 template 사용하기

반복으로 여러 태그를 한 묶음으로 출력해야 할 때는 `<template>`에 `v-for`를 사용할 수 있다.

![template에 v-for를 적용해 여러 요소를 반복 렌더링하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 232348.png>)

```html
<ul>
  <!-- template은 실제 DOM 요소로 남지 않고 li 여러 개를 묶어 반복한다. -->
  <template v-for="item in myArr">
    <li>{{ item.name }}</li>
    <li>{{ item.age }}</li>
    <hr>
  </template>
</ul>
```

#### 중첩된 v-for

`v-for`는 중첩해서 사용할 수도 있다. 하위 `v-for`는 상위 `v-for`의 영역에 접근할 수 있다. 예를 들어 사람마다 친구 목록이 있을 때, 바깥 반복문에서는 사람을 꺼내고 안쪽 반복문에서는 그 사람의 친구 목록을 순회한다.

![중첩된 v-for에서 상위 영역의 item에 접근하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 232427.png>)

```html
<ul>
  <!-- 바깥 반복문: 사람 목록을 순회한다. -->
  <li v-for="item in myInfo">
    {{ item.name }}

    <ul>
      <!-- 안쪽 반복문: 현재 사람(item)의 friends를 순회한다. -->
      <li v-for="friend in item.friends">
        {{ friend }}
      </li>
    </ul>
  </li>
</ul>
```

⚠️ 주의: 중첩 반복문에서는 변수 이름을 대충 지으면 헷갈리기 쉽다. 바깥 항목은 `person`, 안쪽 항목은 `friend`처럼 역할이 드러나는 이름을 쓰면 코드 흐름이 훨씬 선명해진다.

---

### 3.6 v-for with key: 각 항목에 이름표 붙이기

`v-for`를 사용할 때는 `key`를 함께 작성하는 것이 매우 중요하다. `key`는 각 항목을 고유하게 식별하는 이름표 역할을 한다. Vue는 이전 목록과 새 목록을 비교할 때 이 `key`를 기준으로 어떤 항목이 그대로이고, 어떤 항목이 변경되었는지 판단한다.

![v-for에서 key를 사용해 항목을 고유하게 식별하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 232651.png>)

```html
<div id="app">
  <!-- item.id를 key로 사용하여 각 항목을 고유하게 구분한다. -->
  <div v-for="item in items" :key="item.id">
    {{ item.name }}
  </div>
</div>

<script>
const { createApp, ref } = Vue

createApp({
  setup() {
    let id = 0

    const items = ref([
      { id: id++, name: 'Alice' },
      { id: id++, name: 'Bella' },
    ])

    return { items }
  }
}).mount('#app')
</script>
```

`key`는 숫자나 문자열처럼 안정적으로 비교 가능한 값이어야 한다. 데이터베이스의 고유 ID나 UUID처럼 항목마다 변하지 않는 고유 식별자를 사용하는 것이 좋다.

#### 올바른 key 선택 기준

| 권장되는 key | 피해야 할 key |
|---|---|
| 데이터베이스의 고유 ID | 배열 인덱스 |
| UUID 같은 고유 식별자 | 객체 자체 |
| 항목 생성 시 부여한 고정 ID | 매번 바뀔 수 있는 값 |

배열 인덱스를 `key`로 쓰면 항목이 추가, 삭제, 정렬될 때 Vue가 항목을 잘못 대응시킬 수 있다. 예를 들어 두 번째 항목을 삭제했는데 인덱스가 밀리면서 기존 항목과 새 항목의 연결이 어긋날 수 있다.

📌 핵심: `v-for`를 사용할 때는 “이 항목이 누구인지” Vue가 확실히 알 수 있도록 고유한 `key`를 함께 작성한다.

---

### 3.7 v-for와 v-if를 같은 요소에 쓰면 안 되는 이유

강의에서 특히 중요한 주의점으로 다룬 내용이 `v-for`와 `v-if`의 조합이다. 결론부터 말하면, **동일한 요소에 `v-for`와 `v-if`를 함께 사용하면 안 된다.**

아래 예시는 todo 목록 중 완료된 항목만 출력하려는 상황이다.

![v-for와 v-if를 함께 사용하려는 상황](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 233052.png>)

문제는 같은 요소에 `v-for`와 `v-if`를 함께 작성하면 `v-if`가 더 높은 우선순위를 가진다는 점이다. 그래서 `v-if` 조건식에서 `v-for`의 반복 변수인 `todo`에 접근할 수 없다.

![동일 요소에서 v-if가 v-for보다 우선되어 todo에 접근할 수 없는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 233133.png>)

```html
<!-- 좋지 않은 예시 -->
<ul>
  <!-- v-if가 먼저 평가되기 때문에 todo를 아직 사용할 수 없다. -->
  <li v-for="todo in todos" v-if="todo.isComplete" :key="todo.id">
    {{ todo.name }}
  </li>
</ul>
```

⚠️ 주의: 이 코드는 “반복하면서 조건을 검사한다”라고 생각하면 자연스러워 보인다. 하지만 Vue의 처리 우선순위에서는 `v-if`가 먼저 평가되기 때문에, 아직 만들어지지 않은 `todo`를 조건에서 쓰는 문제가 생긴다.

#### 해결법 1: computed로 필터링된 목록 만들기

가장 깔끔한 해결법은 먼저 `computed`로 완료된 todo만 걸러낸 목록을 만들고, 템플릿에서는 그 결과만 반복하는 것이다.

![computed로 완료된 todo 목록을 미리 필터링하는 해결법](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 233420.png>)

```html
<ul>
  <!-- 이미 필터링된 completeTodos를 반복한다. -->
  <li v-for="todo in completeTodos" :key="todo.id">
    {{ todo.name }}
  </li>
</ul>

<script>
const completeTodos = computed(() => {
  // todos 원본은 그대로 두고, 완료된 항목만 모은 새 배열을 반환한다.
  return todos.value.filter((todo) => todo.isComplete)
})
</script>
```

이 방식은 템플릿이 단순해지고, 필터링 로직도 명확하게 분리된다. 특히 목록 전체를 특정 조건으로 걸러서 보여줄 때 가장 많이 쓰는 방식이다.

#### 해결법 2: template에 v-for를 두고 내부에 v-if 사용하기

두 번째 방법은 `v-for`를 `<template>`에 두고, 실제 렌더링되는 내부 요소에 `v-if`를 작성하는 것이다.

![template에 v-for를 두고 내부 li에 v-if를 적용하는 해결법](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 233553.png>)

```html
<ul>
  <!-- template에서 먼저 todo를 만든다. -->
  <template v-for="todo in todos" :key="todo.id">
    <!-- 내부에서는 todo에 접근할 수 있으므로 조건 검사가 가능하다. -->
    <li v-if="todo.isComplete">
      {{ todo.name }}
    </li>
  </template>
</ul>
```

두 방법 중에서는 일반적으로 `computed`를 활용하는 방식이 더 권장된다. 조건이 “목록을 필터링한다”는 의미라면, 애초에 필터링된 목록을 만든 뒤 반복하는 편이 읽기 쉽기 때문이다.

📌 핵심: `v-for`와 `v-if`를 같은 태그에 함께 쓰지 말고, `computed`로 먼저 거르거나 `<template>`으로 구조를 분리한다.

---

### 3.8 Watchers: 값이 바뀌었을 때 특정 행동 실행하기

`watch`는 하나 이상의 반응형 데이터를 감시하고, 감시 대상이 변경되면 콜백 함수를 실행한다. `computed`가 새로운 값을 계산하기 위한 도구라면, `watch`는 값의 변화를 감지해서 특정 작업을 수행하기 위한 도구다.

#### watch 기본 구조

![watch의 기본 구조](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 233930.png>)

```js
watch(source, (newValue, oldValue) => {
  // source가 변경될 때 실행할 작업을 작성한다.
})
```

첫 번째 인자인 `source`는 감시할 대상이다. 반응형 변수나 값을 반환하는 함수가 올 수 있다. 두 번째 인자인 콜백 함수는 source가 변경될 때 실행된다. 이 콜백은 새 값 `newValue`와 이전 값 `oldValue`를 받을 수 있다.

#### count 변경 감시하기

아래 예시는 버튼을 누를 때마다 `count`가 증가하고, `watch`가 그 변화를 감지해 콘솔에 새 값과 이전 값을 출력하는 구조다.

![count 값 변경을 watch로 감시하는 기본 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 234026.png>)

```html
<div id="app">
  <!-- 버튼을 누르면 count 값이 증가한다. -->
  <button @click="count++">Add 1</button>
  <p>Count: {{ count }}</p>
</div>

<script>
const { createApp, ref, watch } = Vue

createApp({
  setup() {
    const count = ref(0)

    // count가 변경될 때마다 콜백 함수가 실행된다.
    watch(count, (newValue, oldValue) => {
      console.log(`newValue: ${newValue}, oldValue: ${oldValue}`)
    })

    return { count }
  }
}).mount('#app')
</script>
```

여기서 `watch`는 값을 만들어내는 것이 아니라, 값의 변경을 보고 특정 작업을 실행한다. 그래서 로그 출력, API 요청, 다른 상태 업데이트 같은 부수 효과와 잘 어울린다.

#### 입력값 변화에 따라 다른 데이터 업데이트하기

사용자가 입력한 메시지의 길이를 보여주는 예시를 보면 `watch`의 역할이 더 분명해진다.

![입력값 message의 변화를 감시해 messageLength를 업데이트하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 234056.png>)

```html
<div id="app">
  <!-- input과 message를 양방향 바인딩한다. -->
  <input v-model="message">
  <p>Message length: {{ messageLength }}</p>
</div>

<script>
const { createApp, ref, watch } = Vue

createApp({
  setup() {
    const message = ref('')
    const messageLength = ref(0)

    // message가 바뀔 때마다 messageLength를 새로 업데이트한다.
    watch(message, (newValue) => {
      messageLength.value = newValue.length
    })

    return { message, messageLength }
  }
}).mount('#app')
</script>
```

사실 이 예시처럼 어떤 값을 계산해서 보여주는 목적이라면 `computed`가 더 자연스러울 수 있다. 하지만 “변화가 생겼을 때 특정 작업을 실행한다”는 watch의 감각을 이해하기에는 좋은 예시다.

#### 여러 source 감시하기

`watch`는 배열을 사용해 여러 대상을 동시에 감시할 수도 있다.

![여러 source를 배열로 묶어 watch하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 234128.png>)

```js
watch([foo, bar], ([newFoo, newBar], [prevFoo, prevBar]) => {
  // foo 또는 bar가 변경되면 실행된다.
  // 새 값과 이전 값도 같은 순서의 배열로 전달된다.
})
```

여러 source를 감시할 때는 콜백의 새 값과 이전 값도 같은 순서의 배열로 들어온다. 이 순서를 잘못 이해하면 어떤 값이 바뀐 것인지 헷갈릴 수 있다.

⚠️ 주의: 배열 안의 객체 내부 값까지 깊게 감시해야 하는 경우에는 `{ deep: true }` 같은 옵션이 필요할 수 있다. 단순히 ref 배열을 watch한다고 해서 모든 내부 변화가 항상 원하는 방식으로 감지되는 것은 아니다.

---

### 3.9 computed와 watch 비교하기

`computed`와 `watch`는 모두 반응형 데이터와 연결되어 있지만 목적이 다르다. 강의에서는 둘의 차이를 다음 표로 정리했다.

![computed와 watch 차이를 비교한 표](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 234255.png>)

| 구분 | computed | watch |
|---|---|---|
| 공통점 | 데이터 변화를 기반으로 동작 | 데이터 변화를 기반으로 동작 |
| 목적 | 의존 데이터로부터 새로운 계산값 생성 | 특정 데이터 변경 시 작업 수행 |
| 사용 목적 | 계산된 값을 캐싱해서 재사용 | API 요청, 로그, DOM 관련 작업 등 부수 효과 |
| 원본 데이터 변경 | 원본을 직접 변경하지 않음 | 원본을 직접 변경하지 않는 방향으로 사용 |

쉽게 구분하면, 화면에 보여줄 “값”이 필요하면 `computed`를 먼저 생각하고, 값이 바뀐 뒤 실행할 “행동”이 필요하면 `watch`를 생각하면 된다.

예를 들어 `message.length`를 화면에 보여주기만 한다면 `computed`가 적합하다. 반면 검색어가 바뀔 때마다 API를 요청하거나, 특정 값이 바뀌면 로컬 스토리지에 저장하는 작업은 `watch`가 적합하다.

🧠 기억할 것: `computed`는 값을 만들고, `watch`는 변화에 반응해 일을 한다.

---

### 3.10 Lifecycle Hooks: 컴포넌트의 특정 시점에 코드 실행하기

Lifecycle Hooks는 Vue 컴포넌트가 생성되고, DOM에 마운트되고, 업데이트되고, 소멸되는 각 단계에서 실행할 수 있도록 제공되는 함수다.

컴포넌트는 한 번에 완성된 상태로 존재하는 것이 아니라, 생성 전후, 마운트 전후, 업데이트 전후, 소멸 전후 같은 흐름을 가진다. 개발자는 이 흐름 중 필요한 시점에 Hook을 등록해 원하는 로직을 실행할 수 있다.

![Vue 컴포넌트 Lifecycle Hooks 다이어그램](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 234435.png>)

#### onMounted: DOM이 만들어진 뒤 실행하기

`onMounted`는 컴포넌트의 초기 렌더링이 끝나고 DOM 요소가 생성된 뒤 실행된다. 화면이 준비된 뒤 API 요청을 보내거나, DOM 요소에 접근해야 할 때 자주 사용한다.

![onMounted를 사용해 mounted 시점에 코드를 실행하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 234610.png>)

```js
const { createApp, ref, onMounted } = Vue

createApp({
  setup() {
    // 컴포넌트가 DOM에 마운트된 뒤 실행된다.
    onMounted(() => {
      console.log('mounted')
    })
  }
}).mount('#app')
```

#### onUpdated: 반응형 데이터 변경으로 DOM이 업데이트된 뒤 실행하기

`onUpdated`는 반응형 데이터 변경으로 인해 컴포넌트의 DOM이 업데이트된 뒤 실행된다.

![onUpdated를 사용해 업데이트 이후 코드를 실행하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 234656.png>)

```html
<div id="app">
  <button @click="count++">Add 1</button>
  <p>Count: {{ count }}</p>
  <p>{{ message }}</p>
</div>

<script>
const { createApp, ref, onUpdated } = Vue

createApp({
  setup() {
    const count = ref(0)
    const message = ref(null)

    // count 변경 등으로 DOM 업데이트가 끝난 뒤 실행된다.
    onUpdated(() => {
      message.value = 'updated!'
    })

    return { count, message }
  }
}).mount('#app')
</script>
```

⚠️ 주의: `onUpdated` 안에서 다시 반응형 데이터를 변경하면 또 업데이트가 발생할 수 있다. 로직에 따라 반복 업데이트 구조가 될 수 있으므로, 실제 프로젝트에서는 조건을 두고 신중하게 사용해야 한다.

---

### 3.11 Lifecycle Hooks 활용: Cat API 요청하기

Lifecycle Hooks는 API 요청과 자주 연결된다. 컴포넌트가 화면에 마운트되는 시점에 API 요청을 보내면, 사용자가 화면을 열었을 때 필요한 데이터를 자동으로 가져올 수 있다.

강의에서는 Cat API를 예시로, 마운트 시점에 고양이 이미지를 요청하고 버튼을 누를 때도 새 이미지를 가져오는 흐름을 다뤘다.

![Cat API 예시의 템플릿 구조](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 234938.png>)

![onMounted에서 Cat API를 요청하는 코드 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 234951.png>)

```html
<div id="app">
  <!-- 버튼을 누르면 새로운 고양이 이미지를 다시 요청한다. -->
  <button @click="getCatImage">냥냥펀치</button>

  <!-- imgUrl 값이 있을 때만 img 태그를 렌더링한다. -->
  <div v-if="imgUrl">
    <img :src="imgUrl" alt="랜덤 고양이 이미지">
  </div>
</div>

<script>
const { createApp, ref, onMounted } = Vue

const API_URL = 'https://api.thecatapi.com/v1/images/search'

createApp({
  setup() {
    // 이미지 URL을 저장할 반응형 변수다.
    const imgUrl = ref(null)

    // Cat API에 요청을 보내고 응답에서 이미지 URL을 꺼낸다.
    const getCatImage = function () {
      axios({
        method: 'get',
        url: API_URL,
      })
        .then((response) => {
          // 응답 데이터의 첫 번째 이미지 URL을 화면에 연결한다.
          imgUrl.value = response.data[0].url
        })
        .catch((error) => {
          // 요청 실패 시 에러를 확인할 수 있도록 출력한다.
          console.log('실패했다옹', error)
        })
    }

    // 컴포넌트가 마운트되면 처음 한 번 이미지를 가져온다.
    onMounted(() => {
      getCatImage()
    })

    return { imgUrl, getCatImage }
  }
}).mount('#app')
</script>
```

이 예시에서 `onMounted`는 “처음 화면이 준비되었을 때 자동으로 한 번 실행할 작업”을 담당한다. 반면 버튼의 `@click`은 사용자의 행동에 따라 같은 함수를 다시 실행하는 역할을 한다.

📌 핵심: API 요청처럼 화면이 준비된 뒤 실행해야 하는 초기 작업은 `onMounted`와 잘 어울린다.

---

### 3.12 Vue Style Guide: 필수 규칙으로 보는 오늘의 핵심

Vue Style Guide는 Vue 코드를 작성할 때 지켜야 할 규칙을 우선순위에 따라 나눈다.

| 우선순위 | 의미 | 특징 |
|---|---|---|
| A | 필수 | 오류를 방지하기 위해 반드시 지켜야 하는 규칙 |
| B | 적극 권장 | 가독성과 개발자 경험을 높이는 규칙 |
| C | 권장 | 일관성을 맞추기 위한 선택 기준 |
| D | 주의 필요 | 잠재적 위험이 있어 신중히 사용해야 하는 규칙 |

이번 강의에서 우선순위 A에 해당하는 핵심 규칙은 두 가지였다.

1. `v-for`에는 반드시 `key`를 작성한다.
2. 동일 요소에 `v-if`와 `v-for`를 함께 사용하지 않는다.

![Vue Style Guide의 Use keyed v-for 규칙](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 235435.png>)

![Vue Style Guide의 Avoid v-if with v-for 규칙](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 235449.png>)

이 두 규칙은 단순한 스타일 문제가 아니라, 화면 업데이트의 예측 가능성과 연결된다. Vue가 어떤 항목을 어떻게 다시 렌더링해야 하는지 정확히 알 수 있어야 상태가 꼬이지 않는다.

---

### 3.13 computed 사용 시 주의사항

`computed`는 편리하지만, 계산된 값을 다룰 때 지켜야 할 중요한 원칙이 있다.

#### computed의 반환 값은 직접 변경하지 않는다

`computed`의 반환 값은 원본 데이터에서 파생된 결과다. 일종의 snapshot처럼 생각할 수 있다. 원본 데이터가 바뀌면 새 계산 결과가 만들어지지만, 계산 결과 자체를 직접 바꾸는 방식으로 사용하면 안 된다.

```js
const count = ref(1)

const doubleCount = computed(() => {
  return count.value * 2
})

// 좋지 않은 사용 방식
// doubleCount.value = 10
```

새 값을 얻고 싶다면 `computed` 결과를 바꾸는 것이 아니라, 그 계산의 기준이 되는 원본 데이터인 `count`를 바꿔야 한다.

#### computed 안에서 원본 배열을 변경하지 않는다

배열에서 `reverse()`나 `sort()`는 원본 배열을 직접 변경하는 메서드다. `computed` 안에서 원본 배열을 직접 변경하면, 계산만 하려던 코드가 원본 상태까지 바꾸게 된다.

![computed에서 reverse를 바로 호출하는 좋지 않은 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 235737.png>)

```js
// 좋지 않은 예시
const reversedNumbers = computed(() => {
  // reverse()는 원본 배열을 직접 변경한다.
  return numbers.value.reverse()
})
```

원본 배열을 지키려면 복사본을 만든 뒤 정렬하거나 뒤집어야 한다.

![복사본을 만든 뒤 reverse를 호출하는 올바른 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 235757.png>)

```js
// 올바른 예시
const reversedNumbers = computed(() => {
  // 전개 구문으로 복사본을 만든 뒤 reverse를 적용한다.
  return [...numbers.value].reverse()
})
```

⚠️ 주의: `filter()`, `slice()`, `concat()`처럼 새 배열을 반환하는 메서드와 `sort()`, `reverse()`, `push()`처럼 원본을 바꾸는 메서드를 구분해야 한다. computed는 원본 데이터를 변경하는 곳이 아니라, 원본에서 파생된 값을 계산하는 곳이다.

---

### 3.14 Lifecycle Hooks 사용 시 주의사항

Lifecycle Hooks는 반드시 동기적으로 작성해야 한다. Vue는 컴포넌트가 초기화될 때 어떤 Hook이 등록되어 있는지 한 번에 스캔하고 준비한다. 그런데 Hook 등록 자체를 비동기로 미루면, Vue가 적절한 생애주기 시점에 해당 Hook을 인식하지 못할 수 있다.

![setTimeout 안에서 lifecycle hook을 등록하는 잘못된 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-04 235938.png>)

```js
// 좋지 않은 예시
setTimeout(() => {
  // 이 시점에는 Vue가 이미 lifecycle hook을 스캔한 뒤일 수 있다.
  onMounted(() => {
    console.log('이 코드는 실행되지 않습니다!')
  })
}, 100)
```

동기는 하나의 작업이 끝날 때까지 다음 작업이 순서대로 기다리는 방식이고, 비동기는 하나의 작업이 끝나기를 기다리지 않고 다른 작업을 실행할 수 있는 방식이다. API 요청 자체는 비동기로 실행할 수 있지만, Hook 등록은 컴포넌트 초기화 과정에서 동기적으로 이루어져야 한다.

![비동기적으로 작성한 lifecycle hook 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-05 000114.png>)

```js
// 올바른 방향
onMounted(() => {
  // Hook은 동기적으로 등록한다.
  // 내부에서 비동기 작업을 실행하는 것은 가능하다.
  getCatImage()
})
```

⚠️ 주의: “Hook 안에서 비동기 작업을 실행하는 것”과 “Hook 등록 자체를 비동기로 미루는 것”은 다르다. 문제는 Hook을 `setTimeout` 같은 비동기 콜백 안에서 뒤늦게 등록하는 경우다.

---

### 3.15 v-for와 배열을 활용한 필터링 / 정렬

목록을 렌더링할 때는 원본 데이터를 그대로 보여주는 경우도 있지만, 특정 조건으로 필터링하거나 정렬된 결과를 보여줘야 하는 경우도 많다. 이때 중요한 원칙은 **원본 데이터를 함부로 수정하지 않고, 화면에 보여줄 새 결과를 만드는 것**이다.

#### computed로 필터링된 새 배열 만들기

짝수만 출력하는 예시를 보면, 원본 배열 `numbers`는 그대로 두고 `computed`로 짝수만 담은 새 배열을 만든다.

![computed로 짝수 목록을 필터링하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-05 000313.png>)

```html
<ul>
  <!-- evenNumbers는 이미 짝수만 남은 배열이다. -->
  <li v-for="number in evenNumbers" :key="number">
    {{ number }}
  </li>
</ul>

<script>
const numbers = ref([1, 2, 3, 4, 5])

const evenNumbers = computed(() => {
  // filter는 원본 배열을 바꾸지 않고 새 배열을 반환한다.
  return numbers.value.filter((number) => number % 2 === 0)
})
</script>
```

#### method로 매개변수가 필요한 필터링 처리하기

중첩된 목록처럼 각 그룹마다 다른 배열을 필터링해야 하는 경우에는 `computed`만으로 처리하기 어려울 수 있다. 이때는 매개변수를 받을 수 있는 method를 사용한다.

![중첩된 배열에서 method로 짝수만 필터링하는 예시](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-05 000356.png>)

```html
<ul>
  <!-- 바깥 반복문은 숫자 묶음들을 순회한다. -->
  <li v-for="numbers in numberSets" :key="numbers.toString()">
    <ul>
      <!-- 현재 numbers 배열을 인자로 넘겨 짝수만 필터링한다. -->
      <li v-for="num in evenNumbers(numbers)" :key="num">
        {{ num }}
      </li>
    </ul>
  </li>
</ul>

<script>
const numberSets = ref([
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
])

const evenNumbers = function (numbers) {
  // 인자로 받은 배열에서 짝수만 새 배열로 반환한다.
  return numbers.filter((number) => number % 2 === 0)
}
</script>
```

`computed`는 매개변수를 직접 받는 구조가 아니기 때문에, 반복 중 각 항목마다 다른 인자를 넣어 계산해야 한다면 method가 더 적합하다.

#### 배열 변경 관련 메서드 구분

| 구분 | 메서드 | 특징 |
|---|---|---|
| 변화 메서드 | `push()`, `pop()`, `shift()`, `unshift()`, `splice()`, `sort()`, `reverse()` | 원본 배열을 변경함 |
| 배열 교체 메서드 | `filter()`, `concat()`, `slice()` | 원본을 수정하지 않고 새 배열을 반환함 |

배열을 다룰 때는 이 차이를 계속 의식해야 한다. 특히 `computed` 안에서는 원본 배열을 직접 변경하는 메서드를 사용할 때 복사본을 먼저 만드는 습관이 필요하다.

---

### 3.16 Todo 애플리케이션 구현으로 흐름 연결하기

마지막으로 강의에서는 `v-model`, `v-on`, `v-bind`, `v-for`를 활용해 간단한 Todo 애플리케이션을 구현했다. 이 예시는 지금까지 배운 문법이 하나의 화면에서 어떻게 연결되는지 보여준다.

![Todo 애플리케이션의 템플릿 구조와 실행 화면](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-05 000602.png>)

![Todo 애플리케이션의 setup 코드 구조](<../assets/images/05_28_Basic_Syntax_2/화면 캡처 2026-06-05 000616.png>)

```html
<div id="app">
  <!-- submit 이벤트의 기본 새로고침을 막고 addTodo 함수를 실행한다. -->
  <form @submit.prevent="addTodo">
    <!-- 입력값과 newTodo를 양방향 바인딩한다. -->
    <input v-model="newTodo">
    <button>Add Todo</button>
  </form>

  <ul>
    <!-- todos 배열을 반복 출력한다. 각 todo는 id를 key로 사용한다. -->
    <li v-for="todo in todos" :key="todo.id">
      {{ todo.text }}

      <!-- 클릭한 todo를 removeTodo 함수에 인자로 전달한다. -->
      <button @click="removeTodo(todo)">X</button>
    </li>
  </ul>
</div>

<script>
const { createApp, ref } = Vue

createApp({
  setup() {
    // 새로운 todo에 부여할 고유 id다.
    let id = 0

    // 입력창의 값을 저장한다.
    const newTodo = ref(null)

    // 화면에 출력할 todo 목록이다.
    const todos = ref([
      { id: id++, text: 'Learn HTML' },
      { id: id++, text: 'Learn JS' },
      { id: id++, text: 'Learn Vue' },
    ])

    // 새로운 todo를 추가하는 함수다.
    const addTodo = function () {
      // 빈 값이 들어가는 것을 막고 싶다면 조건 처리를 추가할 수 있다.
      if (!newTodo.value) return

      // 기존 배열에 새 todo 객체를 추가한다.
      todos.value.push({
        id: id++,
        text: newTodo.value,
      })

      // 입력창을 비워 다음 입력을 준비한다.
      newTodo.value = null
    }

    // 선택한 todo를 삭제하는 함수다.
    const removeTodo = function (selectedTodo) {
      // 선택한 todo와 다른 항목만 남긴 새 배열로 교체한다.
      todos.value = todos.value.filter((todo) => todo !== selectedTodo)
    }

    return { newTodo, todos, addTodo, removeTodo }
  }
}).mount('#app')
</script>
```

이 예시에는 여러 개념이 함께 들어 있다. `v-model`은 입력값을 반응형 데이터와 연결하고, `@submit.prevent`는 폼 제출 이벤트를 제어한다. `v-for`는 todo 목록을 반복 출력하고, `:key`는 각 항목을 고유하게 식별한다. `@click`은 삭제 버튼을 눌렀을 때 선택한 todo를 함수로 전달한다.

⚠️ 주의: 목록을 삭제할 때 배열을 직접 수정하는 방식도 가능하지만, `filter()`로 새 배열을 만들어 교체하면 “선택한 항목을 제외한 나머지를 남긴다”는 의도가 더 명확하게 드러난다.

---

## 4. 적용 관점에서 다시 보기

이번 강의의 문법들은 실제 구현에서 서로 따로 쓰이기보다 함께 등장한다. 따라서 문제나 프로젝트를 만났을 때 “어떤 문법을 써야 하지?”라고 외우기보다, 상황별 신호를 잡는 것이 중요하다.

화면에 보여줄 값이 원본 데이터에서 계산되는 값이라면 먼저 `computed`를 떠올리면 된다. 예를 들어 완료된 todo 개수, 필터링된 상품 목록, 검색어에 맞는 결과 목록처럼 원본이 바뀌면 함께 바뀌어야 하는 값은 `computed`와 잘 맞는다.

반대로 값이 바뀌었을 때 어떤 행동을 해야 한다면 `watch`를 떠올린다. 검색어가 바뀔 때 API 요청을 보내거나, 입력값 변화에 따라 저장 작업을 수행하거나, 특정 상태 변화에 맞춰 로그를 남기는 경우가 여기에 해당한다.

조건부 화면 표시에서는 토글 빈도를 먼저 생각한다. 거의 한 번만 결정되는 조건이면 `v-if`가 적합하고, 자주 켜고 끄는 UI라면 `v-show`가 더 적합할 수 있다. 예를 들어 로그인 여부에 따른 메뉴는 `v-if`, 자주 열고 닫는 단순 패널은 `v-show`를 고려할 수 있다.

목록 렌더링에서는 `v-for`와 `key`를 한 세트로 생각해야 한다. 목록을 출력하는 순간 “이 항목을 구분할 고유 ID가 있는가?”를 같이 확인해야 한다. 그리고 목록을 조건으로 걸러야 한다면, 같은 요소에 `v-if`를 같이 붙이기보다 `computed`로 먼저 필터링된 목록을 만드는 방식이 가장 안정적이다.

마지막으로 API 요청이나 초기 데이터 불러오기는 `onMounted`를 기준으로 생각하면 좋다. 컴포넌트가 화면에 연결된 뒤 처음 한 번 실행할 작업이라면 `onMounted` 안에 함수를 호출하는 흐름으로 구성한다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

이번 강의에서는 `computed`가 단순히 함수를 줄여 쓰는 문법이 아니라, 의존하는 데이터가 바뀔 때만 다시 계산되는 캐싱 기반의 계산 속성이라는 점이 중요했다. 또한 `v-if`와 `v-show`가 겉보기에는 비슷하지만, DOM에서 제거하는 방식과 CSS로 숨기는 방식이라는 근본적인 차이가 있음을 정리할 수 있었다.

`v-for`에서는 `key`가 단순 경고를 없애기 위한 문법이 아니라, Vue가 각 항목을 정확히 식별하고 예측 가능하게 업데이트하기 위한 필수 힌트라는 점을 배웠다. 특히 `v-for`와 `v-if`를 같은 요소에 쓰면 안 되는 이유를 우선순위 관점에서 이해하는 것이 중요하다.

### 5.2 앞으로 이어지는 연결점

이번 내용은 Vue 프로젝트의 거의 모든 화면 구현과 연결된다. Todo 앱처럼 작은 예제에서도 입력값 관리, 목록 렌더링, 이벤트 처리, 항목 추가와 삭제, key 관리가 모두 등장한다. 이후 컴포넌트 분리, props/emit, Pinia 같은 상태 관리로 넘어가도 이번 문법들이 기본 토대가 된다.

특히 API 데이터를 받아와 목록으로 출력하는 화면에서는 `onMounted`로 초기 요청을 보내고, 응답 데이터를 `ref`에 저장한 뒤, `computed`로 필터링하거나 정렬하여 `v-for`로 렌더링하는 흐름이 자주 사용된다.

### 5.3 더 파볼 만한 주제

심화해서 볼 만한 주제는 `watch`의 옵션들이다. 예를 들어 `immediate`, `deep` 옵션을 사용하면 감시 시점과 감시 깊이를 조절할 수 있다. 또한 `computed`의 getter/setter 구조, 배열 렌더링 성능, key 선택에 따른 DOM 재사용 방식도 실제 프로젝트에서 중요하게 이어진다.

---

## 6. 요약 정리

📌 핵심 정리

- `computed`는 원본 반응형 데이터에서 파생된 값을 만들고, 의존 데이터가 바뀔 때만 다시 계산한다.
- `method`는 호출될 때마다 실행되므로, 매개변수가 필요하거나 특정 동작을 수행할 때 적합하다.
- `v-if`는 조건이 false일 때 DOM에서 요소를 제거하고, `v-show`는 DOM에 남긴 채 CSS `display`로 숨긴다.
- `v-for`는 배열과 객체를 반복 렌더링하며, 각 항목을 구분하기 위해 `key`를 함께 작성해야 한다.
- 같은 요소에 `v-for`와 `v-if`를 함께 쓰면 안 된다. 필터링은 `computed`로 먼저 처리하거나 `<template>`으로 구조를 분리한다.
- `watch`는 값이 바뀌었을 때 특정 작업을 실행하기 위한 도구다.
- Lifecycle Hooks는 컴포넌트 생애주기의 특정 시점에 코드를 실행할 수 있게 한다. 초기 API 요청은 `onMounted`와 자주 연결된다.
- `computed` 안에서는 원본 배열을 직접 바꾸는 `reverse()`, `sort()` 같은 메서드 사용에 주의해야 한다.

🧠 기억할 것

- 값을 만들면 `computed`, 행동을 실행하면 `watch`.
- 목록을 출력하면 `v-for`와 `key`를 함께 생각한다.
- 조건부 렌더링은 DOM 제거 여부를 기준으로 `v-if`와 `v-show`를 구분한다.
- 원본 데이터는 최대한 안전하게 유지하고, 화면용 데이터는 계산된 결과로 분리한다.

---

## 7. 미니 퀴즈 또는 체크리스트

### 미니 퀴즈

1. `computed`와 `method`가 같은 계산 결과를 만들 수 있을 때, `computed`를 선택하면 어떤 장점이 있는가?
2. `v-if`와 `v-show`는 조건이 false일 때 각각 요소를 어떻게 처리하는가?
3. `v-for`에서 `key`를 배열 인덱스로 쓰는 것이 왜 위험할 수 있는가?
4. 같은 요소에 `v-for`와 `v-if`를 함께 쓰면 왜 문제가 생기는가?
5. `computed`와 `watch`를 구분할 때 “값”과 “행동”이라는 기준을 어떻게 적용할 수 있는가?

### 이해 점검 체크리스트

- [ ] 템플릿 안의 복잡한 계산을 `computed`로 분리할 수 있다.
- [ ] `computed`와 `method`의 실행 방식 차이를 설명할 수 있다.
- [ ] `v-if`와 `v-show`를 토글 빈도와 DOM 처리 방식 기준으로 선택할 수 있다.
- [ ] 배열과 객체를 `v-for`로 순회하고, 고유한 `key`를 지정할 수 있다.
- [ ] `v-for`와 `v-if`를 같은 요소에 쓰지 않고, `computed` 또는 `<template>`으로 해결할 수 있다.
- [ ] `watch`의 source, newValue, oldValue 구조를 설명할 수 있다.
- [ ] `onMounted`를 사용해 컴포넌트 마운트 시점에 API 요청을 실행할 수 있다.
- [ ] `computed` 안에서 원본 배열을 직접 변경하지 않도록 복사본을 사용할 수 있다.
