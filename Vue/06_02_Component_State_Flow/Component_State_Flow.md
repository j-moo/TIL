# Vue Component State Flow - Props와 Emit으로 컴포넌트 간 데이터 흐름 이해하기

- 🎯 글의 목표: Vue 컴포넌트에서 부모가 자식에게 데이터를 내려보내는 `props`와, 자식이 부모에게 이벤트를 올려보내는 `emit` 흐름을 이해한다.
- 🧩 핵심 키워드: Component, Props, One-Way Data Flow, `defineProps`, `v-bind`, Static Props, Dynamic Props, `v-for`, `$emit`, `defineEmits`, Event Arguments
- ⭐ 중요도: 매우 높음. Vue에서 컴포넌트를 나누어 화면을 만들기 시작하면 거의 모든 기능이 props와 emit 흐름 위에서 동작한다.
- 📝 한눈에 보는 내용: 부모 → 자식 데이터 전달은 props, 자식 → 부모 요청 전달은 emit으로 처리한다. 데이터는 위에서 아래로 흐르고, 변경 요청은 아래에서 위로 올라간다.
- 🔗 관련 문제 / 주제: Vue 컴포넌트 구조 설계, 부모-자식 상태 관리, 리스트 컴포넌트 분리, 이벤트 기반 UI 변경

---

## 1. 들어가며

Vue에서 컴포넌트를 처음 배우면 가장 헷갈리는 부분은 “데이터를 어디에 두고, 누가 바꾸어야 하는가”이다. 화면을 하나의 파일에 모두 작성할 때는 변수를 한 곳에서 만들고 바로 사용하면 되지만, 컴포넌트를 여러 개로 나누면 상황이 달라진다.

예를 들어 하나의 사진 데이터가 화면의 여러 위치에서 반복해서 사용된다고 생각해보자. 이때 각각의 자식 컴포넌트가 같은 데이터를 따로 가지고 있다면, 사진을 변경할 때 모든 컴포넌트를 하나씩 수정해야 한다. 이 방식은 처음에는 단순해 보이지만, 컴포넌트가 늘어날수록 데이터 흐름이 금방 복잡해진다.

이번 강의의 핵심은 이 문제를 해결하는 Vue의 기본 흐름이다. 공통 데이터는 부모 컴포넌트에서 관리하고, 부모는 자식에게 필요한 데이터를 `props`로 내려준다. 반대로 자식 컴포넌트에서 어떤 일이 발생했을 때는 부모에게 직접 데이터를 고치는 것이 아니라 `emit`으로 “이 일이 발생했다”고 알려준다.

쉽게 말하면, Vue 컴포넌트의 기본 대화 방식은 다음과 같다.

```text
부모 → 자식 : props로 데이터 전달
자식 → 부모 : emit으로 이벤트 전달
```

이 흐름을 이해하면 컴포넌트를 단순히 나누는 것을 넘어, 어떤 데이터가 어디에 있어야 하는지까지 판단할 수 있다.

---

## 2. 핵심 개념 정리

이번 강의는 하나의 질문에서 출발한다.

> 컴포넌트를 여러 개로 나누었을 때, 데이터는 어떻게 전달하고 변경 요청은 어떻게 처리해야 할까?

이 질문을 해결하기 위해 먼저 `props`를 배운다. `props`는 부모 컴포넌트가 자식 컴포넌트에게 데이터를 전달할 때 사용하는 통로다. 중요한 점은 데이터가 부모에서 자식 방향으로만 흐른다는 것이다. 그래서 자식 컴포넌트는 전달받은 props를 직접 수정하지 않고 읽어서 사용해야 한다.

그다음에는 `emit`을 배운다. `emit`은 자식 컴포넌트가 부모에게 이벤트를 발생시켜 알리는 방식이다. 자식이 부모의 데이터를 직접 바꾸는 대신, 부모에게 “이 버튼이 클릭되었으니 값을 바꿔 주세요”라고 요청하는 구조라고 볼 수 있다.

마지막으로 props와 emit의 세부 문법을 다룬다. props 이름은 부모 템플릿에서는 `kebab-case`, 자식 스크립트에서는 `camelCase`로 다루는 경우가 많고, props는 문자열 배열보다 객체 문법으로 선언하는 것이 안정적이다. emit 역시 `defineEmits`로 선언할 수 있으며, 필요한 경우 이벤트와 함께 인자를 전달하거나 유효성 검사를 붙일 수 있다.

이제 본문에서는 강의 흐름에 맞춰 `props → props 활용 → emit → emit 활용 → 선언 문법` 순서로 정리한다.

---

## 3. 본문 정리

이 섹션에서는 Vue 컴포넌트 간 데이터 흐름을 실제 코드 흐름과 함께 정리한다. 코드는 단순히 외우기보다 “데이터가 어디에서 만들어지고, 어디로 전달되며, 어디에서 변경되는지”를 따라가며 읽는 것이 중요하다.

### 3.1 컴포넌트 데이터 흐름의 기본 구조

컴포넌트를 여러 개로 나누면 같은 데이터를 여러 컴포넌트에서 사용해야 하는 상황이 자주 나온다. 이때 각 컴포넌트가 같은 데이터를 따로 관리하면, 데이터가 바뀔 때마다 여러 곳을 수정해야 한다.

그래서 Vue에서는 공통 데이터를 보통 공통 부모 컴포넌트에서 관리한다. 부모는 자식에게 필요한 데이터를 내려주고, 자식은 자신에게 일어난 일을 부모에게 알린다.

![화면 캡처 2026-06-02 090835.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 090835.png>)

위 그림은 이 관계를 단순하게 보여준다. 부모 컴포넌트는 자식 컴포넌트에게 `Pass Props`로 데이터를 내려주고, 자식 컴포넌트는 `Emit Event`로 부모에게 이벤트를 올려보낸다.

📌 핵심은 데이터와 이벤트의 방향이 다르다는 점이다. 데이터는 부모에서 자식으로 내려가고, 이벤트는 자식에서 부모로 올라간다.

---

### 3.2 Props: 부모에서 자식으로 데이터 내려보내기

`props`는 부모 컴포넌트가 자식 컴포넌트에게 데이터를 전달할 때 사용하는 사용자 지정 속성이다.

HTML 태그에 `class`, `id`, `src` 같은 속성을 전달하듯이, Vue 컴포넌트에도 부모가 원하는 값을 속성처럼 전달할 수 있다. 다만 일반 HTML 속성과 달리, Vue 컴포넌트의 props는 부모와 자식 사이의 데이터 전달 규칙을 만든다.

```text
props는 부모 컴포넌트가 자식 컴포넌트에게 데이터를 전달할 때 사용하는 특별한 속성이다.
데이터는 부모에서 자식으로 한 방향으로만 흐르며, 자식 컴포넌트는 전달받은 props를 직접 수정해서는 안 된다.
```

이 방식의 장점은 컴포넌트 재사용성이다. 같은 자식 컴포넌트라도 부모가 어떤 props를 전달하느냐에 따라 다른 내용을 보여줄 수 있다.

```vue
<!-- Parent.vue -->
<template>
  <div>
    <h1>Parent</h1>

    <!-- my-msg라는 이름의 props에 "message"라는 값을 전달한다. -->
    <ParentChild my-msg="message" />
  </div>
</template>
```

![화면 캡처 2026-06-02 100151.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 100151.png>)

위 코드에서 `my-msg`는 props 이름이고, `"message"`는 자식에게 내려보내는 props 값이다. 아직은 고정 문자열을 전달하고 있으므로 정적 props라고 볼 수 있다.

⚠️ 주의: props는 자식에게 전달된다고 해서 자식의 소유가 되는 것이 아니다. 부모가 가진 데이터를 자식이 읽을 수 있도록 전달받은 것에 가깝다. 그래서 자식 컴포넌트 내부에서 props를 직접 바꾸려고 하면 데이터 흐름이 깨진다.

---

### 3.3 One-Way Data Flow: props가 단방향으로 흐르는 이유

Vue의 모든 props는 부모 속성과 자식 속성 사이에 하향식 단방향 바인딩을 형성한다. 이를 `one-way-down binding` 또는 단방향 데이터 흐름이라고 부른다.

여기서 중요한 점은 부모 데이터가 바뀌면 자식에게 전달된 props도 최신 값으로 갱신되지만, 자식이 부모 데이터를 직접 바꿀 수는 없다는 것이다.

```text
부모 데이터 변경
  ↓
props를 통해 자식 컴포넌트에 최신 값 전달
  ↓
자식 화면 자동 갱신
```

단방향 흐름을 사용하는 이유는 앱의 상태 변화를 예측 가능하게 만들기 위해서다. 자식 컴포넌트가 마음대로 부모 데이터를 바꾸기 시작하면, 어떤 컴포넌트가 어떤 값을 언제 바꿨는지 추적하기 어려워진다. 작은 예제에서는 괜찮아 보여도, 컴포넌트가 늘어나면 디버깅 난이도가 크게 올라간다.

💡 포인트: 자식이 부모의 값을 바꾸고 싶을 때는 props를 수정하지 않고, 뒤에서 배울 `emit`으로 부모에게 변경을 요청해야 한다.

⚠️ 주의: 객체나 배열을 props로 전달받은 경우에는 내부 값을 변경할 수 있어 보이는 상황이 있다. 하지만 이 경우에도 부모의 원본 상태에 영향을 줄 수 있으므로 조심해야 한다. props는 기본적으로 읽기 전용으로 다룬다고 생각하는 것이 안전하다.

---

### 3.4 실습 준비: App → Parent → ParentChild 구조 만들기

props를 실습하기 위해 먼저 컴포넌트 계층을 만든다. 강의에서는 `App.vue`가 `Parent.vue`를 렌더링하고, `Parent.vue`가 다시 `ParentChild.vue`를 렌더링하는 구조로 출발한다.

사전 준비는 다음과 같다.

```text
1. Vue 프로젝트 생성
2. 초기 생성된 컴포넌트 모두 삭제(App.vue 제외)
3. src/assets 내부 파일 모두 삭제
4. main.js에서 import './assets/main.css' 코드 삭제
5. App > Parent > ParentChild 컴포넌트 관계 작성
```

먼저 `App.vue`에서 `Parent` 컴포넌트를 가져와 화면에 출력한다.

```vue
<!-- App.vue -->
<template>
  <div>
    <!-- App 컴포넌트가 Parent 컴포넌트를 화면에 렌더링한다. -->
    <Parent />
  </div>
</template>

<script setup>
// components 폴더의 Parent.vue를 가져온다.
import Parent from '@/components/Parent.vue'
</script>
```

![화면 캡처 2026-06-02 092201.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 092201.png>)

그다음 `Parent.vue`에서는 `ParentChild` 컴포넌트를 가져와 사용한다.

```vue
<!-- Parent.vue -->
<template>
  <div>
    <h1>Parent</h1>

    <!-- Parent 컴포넌트 안에서 ParentChild를 렌더링한다. -->
    <ParentChild />
  </div>
</template>

<script setup>
// 자식 컴포넌트 ParentChild를 가져온다.
import ParentChild from '@/components/ParentChild.vue'
</script>
```

![화면 캡처 2026-06-02 092237.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 092237.png>)

마지막으로 `ParentChild.vue`는 아직 간단한 제목만 출력하는 상태로 둔다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <h2>ParentChild</h2>
  </div>
</template>

<script setup>
// 아직 별도의 로직은 없다.
</script>
```

![화면 캡처 2026-06-02 092645.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 092645.png>)

이 구조를 먼저 만들어두면 이후 props와 emit 흐름을 눈으로 따라가기 쉽다.

```text
App.vue
  └── Parent.vue
        └── ParentChild.vue
```

---

### 3.5 props 선언: 자식이 받을 데이터를 명시하기

부모가 자식에게 props를 전달했다고 해서 자식이 바로 아무 준비 없이 사용할 수 있는 것은 아니다. 자식 컴포넌트에서는 “나는 이런 props를 받을 것이다”라고 명시해야 한다. Vue의 `<script setup>`에서는 `defineProps()`를 사용한다.

부모 컴포넌트에서 `my-msg="message"`를 전달한다고 해보자.

```vue
<!-- Parent.vue -->
<template>
  <div>
    <h1>Parent</h1>

    <!-- my-msg라는 props 이름으로 message 문자열 전달 -->
    <ParentChild my-msg="message" />
  </div>
</template>
```

![화면 캡처 2026-06-02 100256.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 100256.png>)

이제 자식 컴포넌트에서는 `defineProps()`로 `myMsg`를 선언한다.

```vue
<!-- ParentChild.vue -->
<script setup>
// 문자열 배열 방식으로 props 선언
// 부모 템플릿에서 my-msg로 전달된 값은 스크립트에서 myMsg로 사용한다.
defineProps(['myMsg'])
</script>
```

![화면 캡처 2026-06-02 100429.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 100429.png>)

`defineProps()`에는 크게 두 가지 방식으로 props를 선언할 수 있다.

```js
// 1. 문자열 배열 방식
// 어떤 이름의 props를 받을지만 간단히 선언한다.
defineProps(['myMsg'])
```

```js
// 2. 객체 방식
// props 이름과 함께 타입까지 지정한다.
defineProps({
  myMsg: String,
})
```

![화면 캡처 2026-06-02 100525.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 100525.png>)

문자열 배열 방식은 간단하지만, 어떤 타입의 값이 들어와야 하는지 코드만 보고 알기 어렵다. 반면 객체 방식은 `myMsg`가 문자열이어야 한다는 의도를 코드에 드러낼 수 있다.

📌 핵심: 실습 초반에는 배열 방식도 가능하지만, 실제 프로젝트에서는 props 타입을 명확히 볼 수 있는 객체 선언 방식을 더 권장한다.

---

### 3.6 props 데이터 사용: 템플릿과 스크립트에서 접근하기

props를 선언한 뒤에는 템플릿에서 반응형 변수처럼 사용할 수 있다. `ParentChild.vue`에서 `myMsg`를 출력하면 부모가 전달한 `message`가 화면에 나타난다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <h2>ParentChild</h2>

    <!-- 템플릿에서는 선언한 props 이름을 바로 사용할 수 있다. -->
    <p>{{ myMsg }}</p>
  </div>
</template>

<script setup>
// JS에서 props 데이터가 필요하면 defineProps의 반환값을 변수에 담아 사용할 수 있다.
const props = defineProps({
  myMsg: String,
})

// 스크립트에서는 props 객체를 통해 접근한다.
console.log(props)
console.log(props.myMsg)
</script>
```

![화면 캡처 2026-06-02 101113.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 101113.png>)

템플릿에서는 `{{ myMsg }}`처럼 바로 접근할 수 있고, JavaScript 영역에서는 `props.myMsg`처럼 객체 속성으로 접근한다.

⚠️ 주의: 템플릿과 스크립트에서 접근 방식이 조금 다르다. 템플릿에서는 `myMsg`를 바로 쓰지만, 스크립트에서 반환값을 변수에 담았다면 `props.myMsg`처럼 접근한다.

---

### 3.7 props를 한 단계 더 내려보내기

컴포넌트가 2단계 이상으로 깊어질 때는 props를 중간 컴포넌트가 다시 아래로 전달할 수 있다. 강의에서는 `ParentChild`의 자식으로 `ParentGrandChild` 컴포넌트를 만든다.

먼저 `ParentGrandChild.vue`를 생성한다.

```vue
<!-- ParentGrandChild.vue -->
<template>
  <div></div>
</template>

<script setup>
// 처음 생성 시에는 비워둔다.
</script>
```

![화면 캡처 2026-06-02 114450.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 114450.png>)

이제 `ParentChild.vue`에서 `ParentGrandChild`를 가져와 등록한다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <h2>ParentChild</h2>
    <p>{{ myMsg }}</p>

    <!-- ParentChild 내부에서 ParentGrandChild를 렌더링한다. -->
    <ParentGrandChild />
  </div>
</template>

<script setup>
import ParentGrandChild from '@/components/ParentGrandChild.vue'

defineProps({
  myMsg: String,
})
</script>
```

![화면 캡처 2026-06-02 114532.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 114532.png>)

중간 컴포넌트인 `ParentChild`가 부모로부터 받은 `myMsg`를 다시 `ParentGrandChild`에게 전달하려면 `v-bind`를 사용한다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <h2>ParentChild</h2>
    <p>{{ myMsg }}</p>

    <!-- myMsg 변수 값을 my-msg props로 다시 내려보낸다. -->
    <ParentGrandChild :my-msg="myMsg" />
  </div>
</template>

<script setup>
import ParentGrandChild from '@/components/ParentGrandChild.vue'

defineProps({
  myMsg: String,
})
</script>
```

![화면 캡처 2026-06-02 114629.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 114629.png>)

여기서 `:my-msg="myMsg"`는 문자열 `"myMsg"`를 보내는 것이 아니라, 현재 컴포넌트가 가진 `myMsg` 변수의 값을 보내겠다는 뜻이다.

이제 `ParentGrandChild.vue`에서도 props를 선언하고 출력한다.

```vue
<!-- ParentGrandChild.vue -->
<template>
  <div>
    <!-- ParentChild가 다시 내려준 myMsg를 출력한다. -->
    <p>{{ myMsg }}</p>
  </div>
</template>

<script setup>
defineProps({
  myMsg: String,
})
</script>
```

![화면 캡처 2026-06-02 114717.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 114717.png>)

결과적으로 `Parent`에서 정의한 값이 `ParentChild`와 `ParentGrandChild`까지 전달된다.

![화면 캡처 2026-06-02 114835.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 114835.png>)

이 흐름에서 중요한 점은 원본 데이터의 출발점이 여전히 부모라는 것이다. 부모의 값이 바뀌면 props를 전달받은 모든 하위 컴포넌트가 함께 갱신된다.

---

### 3.8 Props Name Casing: 부모에서는 kebab-case, 자식에서는 camelCase

props 이름을 다룰 때는 케이스 규칙을 조심해야 한다. Vue 컴포넌트의 부모 템플릿에서는 HTML 속성처럼 props를 작성하므로 보통 `kebab-case`를 사용한다.

```vue
<!-- Parent.vue -->
<ParentChild my-msg="message" />
```

![화면 캡처 2026-06-02 115015.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 115015.png>)

반면 자식 컴포넌트의 JavaScript 영역에서는 변수명 규칙에 맞게 `camelCase`를 사용한다.

```vue
<!-- ParentChild.vue -->
<script setup>
defineProps({
  myMsg: String,
})
</script>
```

![화면 캡처 2026-06-02 115058.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 115058.png>)

이 둘은 서로 다른 이름처럼 보이지만 Vue가 연결해준다.

```text
부모 템플릿: my-msg
자식 스크립트: myMsg
```

⚠️ 주의: 부모에서 `myMsg`처럼 camelCase로 작성하거나, 자식에서 `my-msg`처럼 작성하려고 하면 헷갈리기 쉽다. 템플릿의 속성은 `kebab-case`, 스크립트의 변수/속성은 `camelCase`로 생각하면 정리된다.

---

### 3.9 Static Props와 Dynamic Props

지금까지 작성한 `my-msg="message"`는 정적 props다. 정적 props는 고정된 문자열 값을 전달한다.

```vue
<ParentChild my-msg="message" />
```

반면 부모의 반응형 데이터를 자식에게 전달하고 싶다면 동적 props를 사용한다. 이때 필요한 directive가 `v-bind`이고, 축약형으로 `:`를 사용할 수 있다.

```vue
<!-- Parent.vue -->
<template>
  <div>
    <ParentChild
      my-msg="message"
      :dynamic-props="name"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 부모가 관리하는 반응형 데이터
const name = ref('Alice')
</script>
```

자식 컴포넌트에서는 `dynamicProps`를 props로 선언하고 출력한다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <p>{{ myMsg }}</p>
    <p>{{ dynamicProps }}</p>
  </div>
</template>

<script setup>
defineProps({
  myMsg: String,
  dynamicProps: String,
})
</script>
```

![화면 캡처 2026-06-02 130613.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 130613.png>)

위 코드에서 `:dynamic-props="name"`은 부모의 `name` 변수 값을 자식에게 전달한다는 의미다. 부모의 `name`이 바뀌면 자식에게 전달된 `dynamicProps`도 자동으로 갱신된다.

![화면 캡처 2026-06-02 130650.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 130650.png>)

💡 포인트: `v-bind`를 사용한 동적 할당은 고정된 값을 전달하는 것이 아니라, 부모의 데이터와 자식의 props를 실시간으로 연결하는 것이다.

⚠️ 주의: `my-msg="message"`와 `:my-msg="message"`는 다르다. 앞의 코드는 문자열 `message`를 보내고, 뒤의 코드는 JavaScript 변수 `message`의 값을 보내려고 한다.

---

### 3.10 v-for와 함께 props 전달하기

props는 반복되는 데이터를 자식 컴포넌트로 분리할 때 특히 자주 사용된다. 예를 들어 여러 개의 아이템을 화면에 출력해야 한다면, 부모는 배열을 가지고 있고 각 아이템을 자식 컴포넌트에게 하나씩 전달할 수 있다.

먼저 `ParentItem.vue` 컴포넌트를 생성하고 `Parent`의 하위 컴포넌트로 등록한다.

![화면 캡처 2026-06-02 130842.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 130842.png>)

부모 컴포넌트에서는 배열 데이터를 정의한다.

```vue
<!-- Parent.vue -->
<script setup>
import { ref } from 'vue'

// 부모가 전체 목록 데이터를 관리한다.
const items = ref([
  { id: 1, name: '사과' },
  { id: 2, name: '바나나' },
  { id: 3, name: '딸기' },
])
</script>
```

이 배열을 `v-for`로 반복하면서 각 `item`을 자식 컴포넌트에 props로 전달한다.

```vue
<!-- Parent.vue -->
<template>
  <div>
    <ParentItem
      v-for="item in items"
      :key="item.id"
      :my-prop="item"
    />
  </div>
</template>
```

자식 컴포넌트에서는 객체 props를 받아서 출력한다.

```vue
<!-- ParentItem.vue -->
<template>
  <div>
    <p>{{ myProp.id }}</p>
    <p>{{ myProp.name }}</p>
  </div>
</template>

<script setup>
defineProps({
  myProp: Object,
})
</script>
```

![화면 캡처 2026-06-02 130935.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 130935.png>)

결과적으로 부모가 가진 배열의 각 원소가 하나씩 `ParentItem` 컴포넌트에 전달되어 화면에 출력된다.

![화면 캡처 2026-06-02 131003.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 131003.png>)

⚠️ 주의: `v-for`로 컴포넌트를 반복할 때는 `:key`를 함께 작성해야 한다. Vue가 각 컴포넌트를 안정적으로 구분하고 갱신하기 위해 필요하다.

---

### 3.11 Emit: 자식에서 부모에게 이벤트 올려보내기

지금까지는 부모가 자식에게 데이터를 내려보내는 props를 배웠다. 하지만 실제 화면에서는 자식 컴포넌트 안에서 버튼을 누르는 일이 자주 생긴다. 이때 자식이 부모의 데이터를 직접 바꾸면 단방향 데이터 흐름이 깨진다.

그래서 Vue에서는 자식 컴포넌트가 부모에게 이벤트를 발생시켜 알리는 `emit`을 사용한다.

```text
emit은 자식 컴포넌트가 부모 컴포넌트에게 특정 이벤트가 발생했음을 알리고 데이터를 전달하는 기능이다.
```

props가 “내려가는 데이터 흐름”이라면 emit은 “올라가는 이벤트 흐름”이다.

```text
부모 → 자식 : props
자식 → 부모 : emit
```

`$emit()`의 기본 형태는 다음과 같다.

```js
$emit(event, ...args)
```

![화면 캡처 2026-06-02 131427.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 131427.png>)

여기서 `event`는 부모에게 알릴 커스텀 이벤트 이름이고, `args`는 필요할 때 함께 전달하는 추가 인자다.

---

### 3.12 템플릿에서 직접 이벤트 발신하고 부모에서 수신하기

가장 간단한 방식은 자식 컴포넌트의 템플릿에서 `$emit()`을 직접 호출하는 것이다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <!-- 버튼을 클릭하면 someEvent라는 이름의 커스텀 이벤트를 부모에게 발신한다. -->
    <button @click="$emit('someEvent')">클릭</button>
  </div>
</template>
```

![화면 캡처 2026-06-02 131637.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 131637.png>)

부모 컴포넌트에서는 `v-on` 또는 축약형 `@`를 사용해서 자식이 발신한 이벤트를 수신한다.

```vue
<!-- Parent.vue -->
<template>
  <div>
    <!-- 자식이 someEvent를 emit하면 someCallback 함수를 실행한다. -->
    <ParentChild @some-event="someCallback" />
  </div>
</template>
```

![화면 캡처 2026-06-02 131711.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 131711.png>)

실제 흐름을 조금 더 구체적으로 보면 다음과 같다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <button @click="$emit('someEvent')">클릭</button>
  </div>
</template>
```

![화면 캡처 2026-06-02 131756.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 131756.png>)

```vue
<!-- Parent.vue -->
<template>
  <div>
    <ParentChild
      @some-event="someCallback"
      my-msg="message"
      :dynamic-props="name"
    />
  </div>
</template>

<script setup>
// 자식이 someEvent를 emit하면 실행될 콜백 함수
const someCallback = function () {
  console.log('ParentChild가 발신한 이벤트를 수신했어요.')
}
</script>
```

![화면 캡처 2026-06-02 131837.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 131837.png>)

여기서 자식은 `someEvent`라고 발신하지만, 부모 템플릿에서는 `@some-event`로 수신한다. 이벤트 이름도 props 이름처럼 템플릿에서는 `kebab-case`로 작성하는 흐름을 기억하면 된다.

---

### 3.13 defineEmits: 스크립트에서 emit 함수 사용하기

템플릿에서 `$emit()`을 직접 사용할 수도 있지만, 버튼 클릭 시 실행할 함수를 따로 만들고 그 안에서 이벤트를 발신할 수도 있다. 이때 `<script setup>`에서는 `defineEmits()`를 사용한다.

`defineEmits()`는 발신할 이벤트를 선언하고, 스크립트 안에서 사용할 수 있는 `emit` 함수를 반환한다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <!-- 클릭하면 buttonClick 함수가 실행된다. -->
    <button @click="buttonClick">클릭</button>
  </div>
</template>

<script setup>
// 발신할 이벤트 이름을 배열 방식으로 선언한다.
const emit = defineEmits(['someEvent'])

const buttonClick = function () {
  // 선언한 이벤트를 부모에게 발신한다.
  emit('someEvent')
}
</script>
```

부모는 이전과 동일하게 이벤트를 수신한다.

```vue
<!-- Parent.vue -->
<template>
  <div>
    <ParentChild
      @some-event="someCallback"
      my-msg="message"
      :dynamic-props="name"
    />
  </div>
</template>

<script setup>
const someCallback = function () {
  console.log('ParentChild가 발신한 이벤트를 수신했어요.')
}
</script>
```

![화면 캡처 2026-06-02 132058.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132058.png>)

⚠️ 주의: `defineEmit()`이 아니라 `defineEmits()`다. 마지막에 `s`가 붙는다. 강의 필기에는 `defineEmit()`처럼 적힌 부분이 있지만, 실제 Vue 문법은 `defineEmits()`를 사용해야 한다.

📌 핵심: 템플릿에서는 `$emit()`을 바로 쓸 수 있지만, `<script setup>` 내부에서 이벤트를 발신하려면 `defineEmits()`가 반환하는 `emit` 함수를 사용한다.

---

### 3.14 이벤트 인자 전달하기

emit은 단순히 “이벤트가 발생했다”는 신호만 보내는 것이 아니라, 필요한 데이터를 함께 부모에게 전달할 수도 있다.

기본 형태는 다음과 같다.

```js
emit('이벤트이름', 인자1, 인자2, 인자3)
```

강의에서는 먼저 자식이 이벤트와 함께 추가 인자를 발신하고, 부모가 그 이벤트를 수신하는 구조를 확인했다.

![화면 캡처 2026-06-02 132140.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132140.png>)

![화면 캡처 2026-06-02 132207.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132207.png>)

먼저 자식 컴포넌트에서 `emitArgs` 이벤트를 발신하면서 숫자 1, 2, 3을 함께 전달한다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <button @click="emitArgs">추가 인자 전달</button>
  </div>
</template>

<script setup>
const emit = defineEmits(['emitArgs'])

const emitArgs = function () {
  // 이벤트 이름 뒤에 작성한 값들이 부모 콜백 함수의 인자로 전달된다.
  emit('emitArgs', 1, 2, 3)
}
</script>
```

![화면 캡처 2026-06-02 132252.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132252.png>)

부모 컴포넌트에서는 이 이벤트를 `@emit-args`로 수신하고, 전달된 인자를 함수에서 받는다.

```vue
<!-- Parent.vue -->
<template>
  <div>
    <ParentChild @emit-args="getNumbers" />
  </div>
</template>

<script setup>
import ParentChild from '@/components/ParentChild.vue'

const getNumbers = function (...args) {
  // 자식이 보낸 1, 2, 3이 배열처럼 모인다.
  console.log(args)
  console.log(`ParentChild가 전달한 추가인자 ${args}를 수신했어요.`)
}
</script>
```

![화면 캡처 2026-06-02 132321.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132321.png>)

실행 결과를 보면 부모 쪽 함수가 자식이 보낸 인자를 정상적으로 받는 것을 확인할 수 있다.

![화면 캡처 2026-06-02 132342.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132342.png>)

`...args`는 여러 개의 인자를 한 번에 받기 위한 문법이다. 자식이 `1, 2, 3`처럼 여러 값을 보내면 부모는 `args` 배열처럼 받아서 처리할 수 있다.

⚠️ 주의: 자식에서 발신한 이벤트 이름과 부모에서 수신하는 이벤트 이름의 케이스를 맞춰야 한다. 스크립트에서는 `emitArgs`, 템플릿에서는 `emit-args`로 작성한다.

---

### 3.15 Event Name Casing: 이벤트 이름 컨벤션

이벤트 이름도 props 이름과 비슷한 케이스 규칙을 따른다. 선언하고 발신할 때는 JavaScript 영역이므로 `camelCase`를 사용한다.

```vue
<button @click="emit('someEvent')">클릭</button>

<script setup>
const emit = defineEmits(['someEvent'])

emit('someEvent')
</script>
```

![화면 캡처 2026-06-02 132423.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132423.png>)

부모 컴포넌트에서 수신할 때는 템플릿 속성이므로 `kebab-case`를 사용한다.

```vue
<ParentChild @some-event="someCallback" />
```

![화면 캡처 2026-06-02 132455.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132455.png>)

이 규칙을 기억하면 props와 emit을 함께 사용할 때 혼동이 줄어든다.

```text
props 전달: my-msg / myMsg
event 수신: some-event / someEvent
```

---

### 3.16 emit 활용: 최하단 컴포넌트에서 부모 상태 변경 요청하기

이번 실습의 목표는 최하단 컴포넌트인 `ParentGrandChild`에서 최상위에 가까운 `Parent` 컴포넌트의 `name` 변수를 변경 요청하는 것이다.

여기서 중요한 점은 `ParentGrandChild`가 `Parent`의 `name`을 직접 바꾸지 않는다는 것이다. 대신 이벤트를 위로 올려 보낸다.

먼저 `ParentGrandChild.vue`에서 이름 변경을 요청하는 이벤트를 발신한다.

```vue
<!-- ParentGrandChild.vue -->
<template>
  <div>
    <button @click="updateName">이름 변경</button>
  </div>
</template>

<script setup>
const emit = defineEmits(['updateName'])

const updateName = function () {
  // 바로 부모인 ParentChild에게 이름 변경 요청 이벤트를 보낸다.
  emit('updateName')
}
</script>
```

![화면 캡처 2026-06-02 132603.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132603.png>)

그다음 중간 컴포넌트인 `ParentChild.vue`는 `ParentGrandChild`의 이벤트를 수신하고, 다시 자신의 부모인 `Parent`에게 같은 이벤트를 올려 보낸다.

```vue
<!-- ParentChild.vue -->
<template>
  <div>
    <ParentGrandChild
      :my-msg="myMsg"
      @update-name="updateName"
    />
  </div>
</template>

<script setup>
import ParentGrandChild from '@/components/ParentGrandChild.vue'

// ParentChild가 부모에게 발신할 수 있는 이벤트들을 선언한다.
const emit = defineEmits(['someEvent', 'emitArgs', 'updateName'])

const updateName = function () {
  // ParentGrandChild에서 받은 요청을 Parent에게 다시 전달한다.
  emit('updateName')
}
</script>
```

![화면 캡처 2026-06-02 132638.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132638.png>)

마지막으로 `Parent.vue`에서 `update-name` 이벤트를 수신하고 실제 `name` 값을 변경한다.

```vue
<!-- Parent.vue -->
<template>
  <div>
    <ParentChild @update-name="updateName" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ParentChild from '@/components/ParentChild.vue'

// 실제 상태는 Parent가 관리한다.
const name = ref('Alice')

const updateName = function () {
  // 상태를 가진 부모가 직접 값을 변경한다.
  name.value = 'Bella'
}
</script>
```

![화면 캡처 2026-06-02 132715.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132715.png>)

버튼을 클릭하면 최하단 컴포넌트에서 시작한 이벤트가 중간 컴포넌트를 거쳐 부모에게 도달하고, 부모가 자신의 상태를 변경한다.

![화면 캡처 2026-06-02 132737.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132737.png>)

이 구조는 처음에는 번거로워 보일 수 있다. 하지만 데이터가 어디서 바뀌는지 명확하게 유지해주기 때문에, 컴포넌트가 많아질수록 훨씬 안전하다.

```text
ParentGrandChild 버튼 클릭
  ↓ emit('updateName')
ParentChild가 수신
  ↓ emit('updateName')
Parent가 수신
  ↓ name.value = 'Bella'
props를 받는 하위 컴포넌트들이 자동 갱신
```

📌 핵심: 자식은 부모 상태를 직접 바꾸지 않는다. 자식은 이벤트로 요청하고, 실제 변경은 상태를 가진 부모가 수행한다.

---

### 3.17 정적 props와 동적 props의 타입 차이

정적 props와 동적 props는 값이 전달되는 방식뿐 아니라 타입에서도 차이가 난다.

```vue
<!-- 1. 정적 props -->
<SomeComponent num-props="1" />

<!-- 2. 동적 props -->
<SomeComponent :num-props="1" />
```

![화면 캡처 2026-06-02 132839.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132839.png>)

첫 번째 코드는 `"1"`을 문자열로 전달한다. HTML 속성에 작성된 값은 기본적으로 문자열로 해석되기 때문이다.

반면 두 번째 코드는 `v-bind`를 사용했으므로 JavaScript 표현식으로 평가된다. 따라서 숫자 `1`이 전달된다.

```text
num-props="1"   → 문자열 "1"
:num-props="1"  → 숫자 1
```

⚠️ 주의: 숫자, 불리언, 객체, 배열처럼 문자열이 아닌 값을 전달할 때는 대부분 `v-bind`를 사용해야 한다. 그렇지 않으면 의도와 다르게 문자열로 전달될 수 있다.

---

### 3.18 Props 객체 선언 문법

props는 문자열 배열로 간단히 선언할 수도 있지만, 객체 선언 문법을 사용하면 타입, 필수 여부, 기본값 등을 함께 지정할 수 있다.

```js
defineProps({
  // 여러 타입을 허용한다.
  propB: [String, Number],

  // 문자열이며 반드시 전달되어야 하는 props
  propC: {
    type: String,
    required: true,
  },

  // 기본값을 가지는 숫자형 props
  propD: {
    type: Number,
    default: 10,
  },
})
```

![화면 캡처 2026-06-02 132955.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 132955.png>)

객체 선언 문법을 권장하는 이유는 컴포넌트의 의도가 코드에 명확히 드러나기 때문이다. 다른 개발자가 잘못된 타입의 데이터를 전달하면 Vue가 콘솔에 경고를 출력할 수 있고, 필수 props나 기본값도 한눈에 확인할 수 있다.

📌 핵심: props 객체 선언은 단순한 문법 선택이 아니라, 컴포넌트를 안전하게 쓰기 위한 설명서 역할을 한다.

---

### 3.19 Emit 객체 선언 문법과 유효성 검사

emit 이벤트도 객체 선언 문법으로 작성할 수 있다. 객체 구문을 사용하면 이벤트 이름뿐 아니라, 이벤트가 올바른 인자를 가지고 발신되었는지도 검사할 수 있다.

```js
const emit = defineEmits({
  // 유효성 검사 없음
  click: null,

  // submit 이벤트 유효성 검사
  submit: ({ email, password }) => {
    if (email && password) {
      return true
    } else {
      console.warn('submit 이벤트가 옳지 않음')
      return false
    }
  },
})

const submitForm = function (email, password) {
  // submit 이벤트와 함께 객체 인자를 전달한다.
  emit('submit', { email, password })
}
```

![화면 캡처 2026-06-02 133036.png](<../assets/images/06_02_Component_State_Flow/화면 캡처 2026-06-02 133036.png>)

위 코드에서 `submit` 이벤트는 `{ email, password }` 객체를 인자로 받는다. 두 값이 모두 있으면 `true`를 반환하고, 하나라도 없으면 경고를 출력한 뒤 `false`를 반환한다.

이 방식은 폼 제출처럼 특정 데이터가 반드시 필요한 이벤트에서 유용하다. 이벤트 이름만 선언하는 것보다 더 안전하게 컴포넌트 간 통신을 설계할 수 있다.

⚠️ 주의: 유효성 검사는 이벤트를 막기 위한 복잡한 로직을 작성하는 공간이라기보다, 잘못된 이벤트 발신을 개발 중에 빠르게 확인하기 위한 장치로 이해하는 것이 좋다.

---

## 4. 적용 관점에서 다시 보기

props와 emit은 Vue 컴포넌트를 나눌 때 가장 먼저 떠올려야 하는 기본 흐름이다. 문제나 과제를 볼 때 “부모 컴포넌트가 가진 값을 자식에게 보여줘야 한다”는 상황이면 props를 생각하면 된다. 예를 들어 목록 데이터를 부모가 가지고 있고, 각 항목을 카드 컴포넌트로 분리한다면 `v-for`와 props를 함께 사용한다.

반대로 “자식 컴포넌트의 버튼 클릭으로 부모의 값이 바뀌어야 한다”는 상황이면 emit을 떠올려야 한다. 자식이 부모의 상태를 직접 수정하는 것이 아니라, 이벤트를 발신하고 부모가 그 이벤트를 받아 자신의 상태를 변경한다.

구현 순서는 보통 다음처럼 잡으면 된다.

```text
1. 데이터가 어디에 있어야 하는지 먼저 정한다.
2. 부모가 자식에게 보여줄 값이면 props로 내려보낸다.
3. 자식은 defineProps로 받을 값을 선언한다.
4. 자식에서 부모에게 요청할 일이 있으면 emit 이벤트 이름을 정한다.
5. 자식은 defineEmits로 이벤트를 선언하고 emit으로 발신한다.
6. 부모는 @event-name으로 수신하고 실제 상태 변경 함수를 실행한다.
```

실전에서 가장 자주 틀리는 부분은 케이스 규칙과 정적/동적 props 차이다. 부모 템플릿에서는 `my-msg`, `some-event`처럼 `kebab-case`를 쓰고, 스크립트에서는 `myMsg`, `someEvent`처럼 `camelCase`를 쓴다. 또한 숫자나 변수 값을 전달할 때는 `:`를 빠뜨리지 않아야 한다.

🧠 기억할 것: 부모가 가진 데이터는 props로 내려가고, 자식에서 일어난 일은 emit으로 올라간다.

---

## 5. 배운 점 / 확장 포인트

1. **이번 강의 이전에 몰랐던 것 또는 새로 이해된 것**  
   props는 단순히 값을 전달하는 문법이 아니라, 부모가 상태를 관리하고 자식은 전달받은 값을 읽는 단방향 데이터 흐름을 만드는 장치다. 또한 emit은 자식이 부모의 상태를 직접 바꾸지 않고 변경 요청을 전달하는 방식이라는 점이 중요하다.

2. **앞으로 이어지는 연결점**  
   props와 emit 흐름은 이후 Vue에서 리스트 컴포넌트, 폼 컴포넌트, 모달, 버튼, 카드 UI를 분리할 때 계속 사용된다. 특히 여러 컴포넌트가 같은 상태를 공유해야 할 때는 “상태를 어느 부모에 둘 것인가”를 먼저 판단하는 연습으로 이어진다.

3. **더 파볼 만한 주제**  
   컴포넌트 단계가 깊어질수록 props와 emit을 여러 번 전달해야 하는 불편함이 생긴다. 이후에는 이를 해결하기 위해 `provide/inject`, 전역 상태 관리 라이브러리인 Pinia, 그리고 컴포넌트 슬롯 구조를 함께 살펴볼 수 있다.

---

## 6. 요약 정리

📌 핵심

- `props`는 부모 컴포넌트가 자식 컴포넌트에게 데이터를 전달할 때 사용한다.
- props는 부모에서 자식으로만 흐르는 단방향 데이터 흐름을 가진다.
- 자식 컴포넌트는 `defineProps()`로 전달받을 props를 선언한다.
- 정적 props는 고정 문자열을 전달하고, 동적 props는 `v-bind` 또는 `:`로 부모의 변수 값을 전달한다.
- `emit`은 자식 컴포넌트가 부모 컴포넌트에게 이벤트를 발신할 때 사용한다.
- `<script setup>`에서 emit을 사용하려면 `defineEmits()`로 이벤트를 선언하고 반환된 `emit` 함수를 호출한다.
- 이벤트와 함께 추가 인자를 전달할 수 있고, 부모는 콜백 함수의 인자로 그 값을 받을 수 있다.
- props와 emit 모두 템플릿에서는 `kebab-case`, 스크립트에서는 `camelCase` 흐름을 기억하면 좋다.
- props와 emit은 객체 선언 문법을 사용하면 타입과 유효성 검사를 통해 더 안전한 컴포넌트를 만들 수 있다.

🧠 기억할 것

```text
부모 → 자식 : props
자식 → 부모 : emit
상태 변경 : 상태를 가진 컴포넌트가 직접 수행
```

---

## 7. 미니 퀴즈 또는 체크리스트

1. 부모 컴포넌트가 자식 컴포넌트에게 데이터를 전달할 때 사용하는 Vue 문법은 무엇인가?
2. 자식 컴포넌트에서 전달받은 props를 직접 수정하면 왜 문제가 될 수 있는가?
3. `my-msg="message"`와 `:my-msg="message"`는 어떤 차이가 있는가?
4. 자식 컴포넌트에서 부모에게 버튼 클릭 사실을 알리고 싶을 때 어떤 문법을 사용하는가?
5. `defineEmits()`가 필요한 상황은 언제인가?
6. 부모 템플릿에서 이벤트를 수신할 때 `someEvent`를 어떤 이름으로 작성하는 것이 일반적인가?
7. 리스트 데이터를 자식 컴포넌트에 하나씩 전달할 때 `v-for`와 함께 꼭 작성해야 하는 속성은 무엇인가?
8. props와 emit을 객체 선언 문법으로 작성하면 어떤 장점이 있는가?
