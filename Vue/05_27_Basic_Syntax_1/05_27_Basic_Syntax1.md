# Vue Basic Syntax 1: Template Syntax, v-bind, v-on, v-model

- 🎯 글의 목표: Vue 템플릿 문법에서 데이터와 화면을 연결하는 방식, 동적 속성 바인딩, 이벤트 처리, 폼 양방향 바인딩의 흐름을 하나의 구조로 이해한다.
- 🧩 핵심 키워드: Template Syntax, Text Interpolation, v-html, v-bind, Dynamic Argument, Class Binding, Style Binding, v-on, Event Modifier, Key Modifier, v-model, IME
- ⭐ 중요도: ★★★★★  
  Vue 컴포넌트를 작성할 때 가장 자주 사용하는 기본 문법이므로, 이후 컴포넌트 분리·props·emit·form 처리·API 연동을 이해하는 출발점이 된다.
- 📝 한눈에 보는 내용:  
  JavaScript의 반응형 데이터를 HTML 템플릿에 연결하는 기본 방식부터, 사용자의 클릭과 입력을 처리하는 방식까지 순서대로 정리한다. 핵심은 “데이터가 바뀌면 화면이 바뀌고, 사용자의 입력은 다시 데이터로 들어온다”는 흐름을 이해하는 것이다.
- 🔗 관련 문제 / 주제: Vue 컴포넌트 템플릿 작성, 동적 class/style 적용, 버튼 클릭 이벤트 처리, form input 상태 관리, 한글 입력 처리

---

## 1. 들어가며

Vue를 처음 배울 때 가장 먼저 잡아야 하는 감각은 **HTML 화면과 JavaScript 데이터가 서로 연결되어 있다**는 점이다. 일반적인 HTML은 한 번 작성하면 정적인 구조로 남지만, Vue에서는 데이터 값이 바뀌면 화면도 함께 바뀐다. 반대로 사용자가 화면에서 버튼을 클릭하거나 input에 값을 입력하면, 그 행동을 JavaScript 로직과 연결할 수 있다.

이번 강의는 이 연결 방식을 다룬다. 먼저 템플릿에서 데이터를 출력하는 기본 문법을 보고, 그 다음 HTML 속성을 동적으로 바꾸는 `v-bind`, 사용자의 이벤트를 처리하는 `v-on`, 마지막으로 입력값과 데이터를 양방향으로 연결하는 `v-model`을 정리한다.

처음에는 문법이 많아 보일 수 있다. 하지만 큰 흐름은 단순하다.

1. 데이터를 화면에 보여준다.
2. HTML 속성을 데이터에 맞게 바꾼다.
3. 사용자의 이벤트를 감지한다.
4. 사용자가 입력한 값을 다시 데이터에 반영한다.

이 네 흐름을 이해하면 Vue 템플릿 문법은 단순 암기가 아니라, 화면과 상태를 연결하는 방식으로 자연스럽게 정리된다.

---

## 2. 핵심 개념 정리

이번 강의는 “Vue에서 JavaScript 데이터와 HTML 화면을 어떻게 연결할 것인가?”라는 질문을 중심으로 진행된다. 템플릿 문법은 단순히 HTML 안에 특수한 문법을 넣는 것이 아니라, **화면을 데이터의 결과로 선언하는 방법**이다.

전체 흐름은 다음과 같다.

| 흐름 | 핵심 질문 | 사용하는 문법 |
|---|---|---|
| 데이터 출력 | 데이터를 화면에 어떻게 보여줄까? | `{{ }}`, `v-html` |
| 속성 바인딩 | `id`, `href`, `class`, `style` 같은 속성을 데이터로 어떻게 바꿀까? | `v-bind`, `:` |
| 이벤트 처리 | 클릭, 입력, submit 같은 사용자 행동을 어떻게 받을까? | `v-on`, `@` |
| 폼 입력 처리 | 사용자가 입력한 값을 데이터와 어떻게 동기화할까? | `v-bind` + `v-on`, `v-model` |

여기서 중요한 점은 각 문법이 서로 따로 떨어져 있는 것이 아니라는 점이다. 예를 들어 `v-model`은 완전히 새로운 마법 같은 문법이 아니라, 내부적으로는 `v-bind`로 값을 보여주고 `v-on`으로 입력 이벤트를 받아 데이터를 갱신하는 구조로 이해할 수 있다.

따라서 본문에서는 템플릿 문법의 기본 형태를 먼저 잡고, 그 위에 동적 바인딩과 이벤트 처리, 입력 바인딩을 차례대로 연결해 나간다.

---

## 3. 본문 정리

이 섹션에서는 강의 흐름에 맞춰 Vue 템플릿 문법을 하나씩 정리한다. 개념을 설명한 뒤 바로 예시 이미지와 코드 흐름을 붙여, 복습할 때 자료와 설명이 따로 떨어지지 않도록 구성했다.

### 3.1 Template Syntax: Vue에서 화면과 데이터를 연결하는 방식

Vue의 Template Syntax는 HTML 기반 템플릿 안에서 JavaScript 데이터를 선언적으로 연결하는 문법이다. 여기서 “선언적”이라는 말은 직접 DOM을 찾아서 바꾸는 것이 아니라, **데이터와 화면의 관계를 미리 적어두면 Vue가 알아서 갱신한다**는 뜻이다.

예를 들어 `msg`라는 데이터가 있을 때, 템플릿에 `{{ msg }}`라고 작성하면 화면에는 `msg`의 현재 값이 나타난다. 이후 `msg` 값이 바뀌면 DOM도 자동으로 다시 렌더링된다.

템플릿 문법은 크게 네 가지 흐름으로 볼 수 있다.

- **Text Interpolation**: 데이터를 텍스트로 출력한다.
- **Raw HTML**: HTML 문자열을 실제 HTML로 렌더링한다.
- **Attribute Bindings**: HTML 속성을 데이터와 연결한다.
- **JavaScript Expressions**: 바인딩 위치에서 JavaScript 표현식을 사용한다.

이 네 가지는 뒤에서 배우는 directive의 기본 바탕이 된다.

---

### 3.2 Text Interpolation: 콧수염 구문으로 데이터 출력하기

Text Interpolation은 Vue 데이터 바인딩의 가장 기본적인 형태다. 이중 중괄호, 즉 콧수염 구문을 사용해 컴포넌트 인스턴스의 데이터를 텍스트로 출력한다.

![화면 캡처 2026-06-03 204045.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 204045.png>)

위 예시는 `msg`라는 상태 값을 화면에 출력하는 기본 형태를 보여준다. 템플릿 안의 `{{ msg }}`는 고정 문자열이 아니라, 컴포넌트 내부의 `msg` 값으로 대체된다.

```vue
<template>
  <!-- msg 데이터의 현재 값을 화면에 텍스트로 출력한다. -->
  <p>{{ msg }}</p>
</template>

<script setup>
import { ref } from 'vue'

// ref로 만든 반응형 데이터는 값이 바뀌면 화면도 다시 갱신된다.
const msg = ref('Hello Vue')
</script>
```

이 코드를 이해할 때는 `{{ msg }}` 자체보다도, **msg가 변경될 때 화면이 함께 갱신된다**는 점을 잡는 것이 중요하다. Vue는 데이터와 화면 사이의 연결을 기억하고 있다가, 데이터가 바뀌면 필요한 부분의 DOM을 다시 반영한다.

⚠️ 주의: 콧수염 구문은 HTML 속성 안에서는 사용할 수 없다. 예를 들어 `<div id="{{ dynamicId }}">`처럼 쓰는 방식은 올바른 Vue 문법이 아니다. 속성을 동적으로 연결할 때는 뒤에서 배우는 `v-bind`를 사용해야 한다.

📌 핵심: `{{ }}`는 데이터를 일반 텍스트로 출력하는 가장 기본적인 바인딩 문법이다.

---

### 3.3 Raw HTML: HTML 문자열을 실제 태그로 렌더링하기

콧수염 구문은 데이터를 **일반 텍스트**로 해석한다. 따라서 데이터 안에 `<strong>` 같은 HTML 태그 문자열이 들어 있어도, 그것은 태그로 실행되지 않고 문자열 그대로 출력된다. 실제 HTML로 렌더링하고 싶다면 `v-html`을 사용한다.

![화면 캡처 2026-06-03 204137.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 204137.png>)

```vue
<template>
  <!-- 일반 텍스트로 출력된다. 태그가 실행되지 않는다. -->
  <p>{{ rawHtml }}</p>

  <!-- 문자열 안의 HTML 태그를 실제 HTML로 렌더링한다. -->
  <p v-html="rawHtml"></p>
</template>

<script setup>
import { ref } from 'vue'

const rawHtml = ref('<span style="color: red">빨간 글씨</span>')
</script>
```

`v-html`은 강력하지만, 아무 값에나 사용하는 문법은 아니다. 사용자가 입력한 문자열을 그대로 `v-html`로 출력하면 악성 스크립트가 삽입될 위험이 있다. 따라서 신뢰할 수 있는 HTML 문자열을 출력해야 할 때만 제한적으로 사용하는 것이 좋다.

⚠️ 주의: `v-html`은 Vue가 템플릿 안의 내용을 HTML로 해석하게 만드는 문법이다. 사용자가 직접 입력한 값을 그대로 넣으면 보안 문제가 생길 수 있다.

---

### 3.4 Attribute Bindings: HTML 속성을 데이터와 연결하기

HTML 속성은 콧수염 구문으로 바인딩하지 않는다. `id`, `href`, `src`, `disabled` 같은 속성 값을 Vue 데이터와 연결하려면 `v-bind`를 사용한다.

![화면 캡처 2026-06-03 204302.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 204302.png>)

```vue
<template>
  <!-- dynamicId 값이 id 속성에 연결된다. -->
  <div v-bind:id="dynamicId">동적으로 id가 바뀌는 요소</div>

  <!-- v-bind는 : 약어로 줄여 쓸 수 있다. -->
  <a :href="myUrl">링크 이동</a>
</template>

<script setup>
import { ref } from 'vue'

const dynamicId = ref('app-title')
const myUrl = ref('https://example.com')
</script>
```

속성 바인딩에서 기억해야 할 점은 값이 `null` 또는 `undefined`가 되면 해당 속성이 렌더링 결과에서 제거될 수 있다는 것이다. 예를 들어 `:disabled="null"`처럼 평가되면 `disabled` 속성이 붙지 않는다.

⚠️ 주의: 속성 안에 `{{ }}`를 넣으려고 하면 문법이 어색해진다. HTML 속성은 `v-bind` 또는 약어 `:`를 사용해 연결한다고 정리하면 된다.

---

### 3.5 JavaScript Expressions: 바인딩 안에서 표현식 사용하기

Vue 템플릿에서는 단순히 변수만 넣는 것이 아니라, 하나의 값으로 평가될 수 있는 JavaScript 표현식을 사용할 수 있다. 이 표현식은 콧수염 구문 내부나 directive의 속성 값에서 사용할 수 있다.

![화면 캡처 2026-06-03 204444.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 204444.png>)

```vue
<template>
  <!-- 문자열을 뒤집은 결과를 출력한다. -->
  <p>{{ message.split('').reverse().join('') }}</p>

  <!-- 조건 표현식도 하나의 값으로 평가되므로 사용할 수 있다. -->
  <p>{{ isLogin ? '로그인 상태' : '로그아웃 상태' }}</p>

  <!-- directive 값에도 표현식을 사용할 수 있다. -->
  <button :disabled="count === 0">감소</button>
</template>
```

여기서 핵심은 “표현식”과 “문장”을 구분하는 것이다. 표현식은 결과적으로 하나의 값이 된다. 반면 `if`, `for`, `let` 선언처럼 실행 흐름을 제어하는 문장은 템플릿 바인딩 안에서 그대로 사용할 수 없다.

![화면 캡처 2026-06-03 204606.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 204606.png>)

```vue
<template>
  <!-- 가능: 하나의 값으로 평가된다. -->
  <p>{{ number + 1 }}</p>
  <p>{{ ok ? 'YES' : 'NO' }}</p>

  <!-- 불가능: if문은 값 하나로 평가되는 표현식이 아니다. -->
  <!-- <p>{{ if (ok) { return 'YES' } }}</p> -->
</template>
```

⚠️ 주의: Vue 템플릿의 각 바인딩에는 하나의 단일 표현식만 들어간다. 복잡한 로직이 필요하다면 템플릿 안에 억지로 쓰기보다, `computed`나 메서드로 분리하는 것이 좋다.

---

### 3.6 Directive: `v-` 접두사를 가진 Vue의 특수 속성

Directive는 `v-` 접두사가 붙은 Vue의 특수 속성이다. HTML 요소에 특정 반응형 동작을 적용하라는 명령이라고 보면 된다. 예를 들어 `v-if`는 조건에 따라 렌더링 여부를 결정하고, `v-for`는 배열을 반복 출력하며, `v-bind`는 속성을 데이터와 연결한다.

![화면 캡처 2026-06-03 204855.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 204855.png>)

```vue
<template>
  <!-- seen 값이 true일 때만 화면에 렌더링된다. -->
  <p v-if="seen">이 문장은 조건에 따라 보입니다.</p>
</template>
```

Directive의 값은 대부분 단일 JavaScript 표현식이어야 한다. 다만 `v-for`, `v-on`처럼 문법적으로 예외가 있는 directive도 있다.

Directive의 전체 구문은 네 부분으로 나눠 볼 수 있다.

![화면 캡처 2026-06-03 205142.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 205142.png>)

| 구성 요소 | 의미 | 예시 |
|---|---|---|
| Name | directive의 핵심 이름 | `v-bind`, `v-on` |
| Argument | 어떤 속성이나 이벤트에 적용할지 나타내는 대상 | `href`, `click` |
| Modifiers | 기본 동작을 바꾸는 특수 접미사 | `.prevent`, `.stop` |
| Value | 연결할 JavaScript 표현식 | `myUrl`, `doSomething` |

Directive의 argument는 콜론 뒤에 작성한다.

```html
<!-- href 속성을 myUrl 데이터와 연결한다. -->
<a v-bind:href="myUrl">Link</a>

<!-- click 이벤트가 발생하면 doSomething 메서드를 실행한다. -->
<button v-on:click="doSomething">Button</button>
```

Modifier는 점으로 이어 붙인다. 예를 들어 `.prevent`는 이벤트의 기본 동작을 막으라는 의미다.

![화면 캡처 2026-06-03 205641.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 205641.png>)

```html
<!-- submit 이벤트의 기본 새로고침 동작을 막고 onSubmit을 실행한다. -->
<form @submit.prevent="onSubmit">
  <button type="submit">제출</button>
</form>
```

⚠️ 주의: directive 안에는 `if문` 같은 문장을 직접 넣는 것이 아니라, 하나의 값으로 평가되는 표현식을 넣는다고 생각해야 한다. 문자열 값을 직접 넘길 때는 따옴표를 한 번 더 감싸야 하는 경우도 있다.

---

### 3.7 Built-in Directives: Vue가 기본 제공하는 directive

Vue는 여러 built-in directive를 제공한다. 이번 강의에서는 `v-bind`, `v-on`, `v-model`이 중심이지만, 전체적으로는 다음과 같은 directive들이 자주 사용된다.

| Directive | 역할 |
|---|---|
| `v-text` | 텍스트 콘텐츠를 갱신한다. |
| `v-show` | CSS display를 이용해 표시 여부를 제어한다. |
| `v-if` | 조건에 따라 요소 자체를 렌더링하거나 제거한다. |
| `v-for` | 배열이나 객체를 반복 렌더링한다. |
| `v-bind` | 속성을 데이터와 연결한다. |
| `v-on` | 이벤트를 수신한다. |
| `v-model` | 폼 입력과 데이터를 양방향 바인딩한다. |

이 중 `v-bind`, `v-on`, `v-model`은 화면과 데이터, 사용자 입력을 연결하는 데 직접적으로 쓰이므로 Vue 기본 문법에서 특히 중요하다.

---

### 3.8 v-bind: HTML 속성을 동적으로 바인딩하기

`v-bind`는 하나 이상의 HTML 속성 또는 컴포넌트 데이터를 JavaScript 표현식에 동적으로 연결하는 directive다. 쉽게 말하면, **HTML 속성 값을 고정 문자열이 아니라 Vue 데이터로부터 가져오게 만드는 문법**이다.

속성 바인딩은 크게 일반 속성 바인딩과 class/style 바인딩으로 나눠 볼 수 있다.

---

#### 3.8.1 Attribute Bindings: 일반 속성 바인딩

HTML의 속성 값을 Vue의 상태 값과 동기화할 때 `v-bind`를 사용한다.

![화면 캡처 2026-06-03 205958.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 205958.png>)

```vue
<template>
  <!-- imgUrl 값이 src 속성에 들어간다. -->
  <img :src="imgUrl" alt="Vue logo">

  <!-- isButtonDisabled 값에 따라 disabled 속성이 결정된다. -->
  <button :disabled="isButtonDisabled">버튼</button>
</template>
```

`v-bind`는 워낙 자주 사용되기 때문에 약어로 `:`를 쓴다.

![화면 캡처 2026-06-03 210035.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 210035.png>)

```html
<!-- 긴 표현 -->
<a v-bind:href="url">링크</a>

<!-- 약어 -->
<a :href="url">링크</a>
```

처음에는 `:`가 낯설 수 있지만, Vue 코드에서는 `:href`, `:src`, `:class`, `:style`처럼 거의 기본 문법처럼 등장한다.

---

#### 3.8.2 Dynamic Attribute Name: 동적 인자 이름

directive의 argument 자체를 동적으로 정하고 싶을 때는 대괄호 `[]`를 사용한다. 대괄호 안의 표현식이 평가된 결과가 최종 argument 이름이 된다.

![화면 캡처 2026-06-03 210140.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 210140.png>)

```vue
<template>
  <!-- attributeName이 'href'라면 :href와 같은 의미가 된다. -->
  <a :[attributeName]="url">동적 속성 링크</a>

  <!-- eventName이 'click'이라면 @click과 같은 의미가 된다. -->
  <button @[eventName]="handleEvent">동적 이벤트 버튼</button>
</template>

<script setup>
const attributeName = 'href'
const eventName = 'click'
const url = 'https://example.com'

const handleEvent = () => {
  console.log('event')
}
</script>
```

동적 인자는 강력하지만 너무 자주 사용하면 템플릿을 읽기 어려워질 수 있다. 대부분의 경우에는 `:href`, `@click`처럼 고정된 인자를 사용하는 편이 더 명확하다.

⚠️ 주의: 대괄호 안의 값이 `null`이면 해당 속성이나 이벤트 리스너가 제거될 수 있다. 또한 대괄호 안에는 공백이나 따옴표를 자유롭게 넣을 수 없으므로 간단한 표현식 위주로 사용하는 것이 좋다.

---

#### 3.8.3 Attribute Binding 예시 흐름

다음 예시는 속성 바인딩이 실제 템플릿에서 어떻게 적용되는지 보여준다.

![화면 캡처 2026-06-03 210253.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 210253.png>)

속성 바인딩을 읽을 때는 왼쪽의 HTML 속성과 오른쪽의 JavaScript 데이터가 연결된다고 보면 된다.

```vue
<template>
  <!-- imageSrc 값이 바뀌면 이미지 주소도 바뀐다. -->
  <img :src="imageSrc" :alt="imageAlt">

  <!-- isActive 값에 따라 버튼 비활성화 여부가 달라진다. -->
  <button :disabled="!isActive">실행</button>
</template>
```

📌 핵심: `v-bind`는 HTML 속성 값을 Vue 데이터와 연결하고, 약어 `:`로 자주 사용한다.

---

### 3.9 Class and Style Bindings: class와 style을 동적으로 다루기

`class`와 `style`도 HTML 속성이기 때문에 기본적으로 `v-bind`로 연결할 수 있다. 다만 class와 style은 문자열로 직접 조합하면 코드가 금방 복잡해진다. Vue는 이를 위해 객체와 배열 문법을 지원한다.

Class and Style Bindings는 크게 다음과 같이 나뉜다.

| 구분 | 방식 | 핵심 |
|---|---|---|
| Class Binding | 객체 | 조건에 따라 class를 켜고 끈다. |
| Class Binding | 배열 | 여러 class 값을 묶어서 적용한다. |
| Style Binding | 객체 | CSS 속성과 값을 객체로 작성한다. |
| Style Binding | 배열 | 여러 style 객체를 병합해서 적용한다. |

---

#### 3.9.1 Class Binding to Objects: 조건에 따라 class 전환하기

객체를 `:class`에 전달하면, 객체의 key는 class 이름이 되고 value는 해당 class를 적용할지 결정하는 조건이 된다.

![화면 캡처 2026-06-03 210654.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 210654.png>)

![화면 캡처 2026-06-03 210711.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 210711.png>)

```vue
<template>
  <!-- isActive가 true이면 active class가 붙는다. -->
  <div :class="{ active: isActive }">상태에 따라 class가 바뀝니다.</div>
</template>

<script setup>
import { ref } from 'vue'

const isActive = ref(true)
</script>
```

이 예시에서 `active`는 class 이름이고, `isActive`는 class 적용 여부를 결정하는 boolean 값이다. 렌더링 결과에서는 `isActive`가 true일 때만 `class="active"`가 붙는다.

객체에는 여러 class 조건을 함께 넣을 수 있다. 일반 class와 `:class`를 함께 사용하는 것도 가능하다.

![화면 캡처 2026-06-03 210816.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 210816.png>)

![화면 캡처 2026-06-03 210842.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 210842.png>)

```vue
<template>
  <!-- static은 항상 적용되고, active와 text-danger는 조건에 따라 적용된다. -->
  <div
    class="static"
    :class="{ active: isActive, 'text-danger': hasError }"
  >
    class 객체 바인딩
  </div>
</template>
```

조건이 많아지면 템플릿 안에 객체를 직접 쓰는 방식이 길어질 수 있다. 이때는 반응형 변수나 계산된 객체를 만들어 한 번에 연결하면 읽기 좋아진다.

![화면 캡처 2026-06-03 210920.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 210920.png>)

![화면 캡처 2026-06-03 210946.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 210946.png>)

```vue
<template>
  <!-- classObject 자체를 :class에 연결한다. -->
  <div :class="classObject">반응형 객체 class 바인딩</div>
</template>

<script setup>
import { ref } from 'vue'

const classObject = ref({
  active: true,
  'text-danger': false,
})
</script>
```

⚠️ 주의: class 이름에 하이픈이 들어가면 객체 key를 문자열로 감싸는 것이 안전하다. 예를 들어 `text-danger`는 `{ 'text-danger': hasError }`처럼 작성한다.

---

#### 3.9.2 Class Binding to Arrays: class 목록을 배열로 적용하기

배열을 `:class`에 바인딩하면 배열 안의 값들이 class 목록으로 적용된다.

![화면 캡처 2026-06-03 211046.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211046.png>)

![화면 캡처 2026-06-03 211110.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211110.png>)

```vue
<template>
  <!-- activeClass와 errorClass의 값이 class로 적용된다. -->
  <div :class="[activeClass, errorClass]">배열 class 바인딩</div>
</template>

<script setup>
const activeClass = 'active'
const errorClass = 'text-danger'
</script>
```

배열 안에는 객체 문법도 함께 넣을 수 있다. 이 방식은 항상 적용되는 class와 조건부 class를 함께 다룰 때 유용하다.

![화면 캡처 2026-06-03 211140.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211140.png>)

![화면 캡처 2026-06-03 211150.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211150.png>)

```vue
<template>
  <!-- activeClass는 항상 적용되고, text-danger는 조건에 따라 적용된다. -->
  <div :class="[activeClass, { 'text-danger': hasError }]">
    배열 안에서 객체 class 바인딩 사용
  </div>
</template>
```

💡 포인트: 객체 문법은 “조건에 따라 켜고 끄기”, 배열 문법은 “여러 class를 목록으로 묶기”에 가깝다.

---

#### 3.9.3 Style Binding to Objects: inline style을 객체로 작성하기

`:style`은 HTML의 `style` 속성에 JavaScript 객체를 바인딩한다. 객체의 key는 CSS 속성, value는 CSS 값이 된다.

![화면 캡처 2026-06-03 211251.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211251.png>)

![화면 캡처 2026-06-03 211304.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211304.png>)

```vue
<template>
  <!-- activeColor와 fontSize 값이 style에 반영된다. -->
  <div :style="{ color: activeColor, fontSize: fontSize + 'px' }">
    객체 style 바인딩
  </div>
</template>

<script setup>
const activeColor = 'red'
const fontSize = 30
</script>
```

Vue에서는 CSS 속성을 camelCase로 작성하는 방식을 권장한다. 다만 실제 CSS처럼 kebab-case 문자열 key도 사용할 수 있다.

![화면 캡처 2026-06-03 211351.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211351.png>)

![화면 캡처 2026-06-03 211408.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211408.png>)

```vue
<template>
  <!-- camelCase 방식 -->
  <div :style="{ backgroundColor: bgColor }">camelCase style</div>

  <!-- kebab-case는 문자열 key로 작성한다. -->
  <div :style="{ 'background-color': bgColor }">kebab-case style</div>
</template>
```

style 객체가 길어질 때는 템플릿 밖에서 객체로 분리해 바인딩할 수 있다.

![화면 캡처 2026-06-03 211453.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211453.png>)

![화면 캡처 2026-06-03 211508.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211508.png>)

```vue
<template>
  <!-- styleObject를 통째로 연결한다. -->
  <div :style="styleObject">분리된 style 객체 바인딩</div>
</template>

<script setup>
import { ref } from 'vue'

const styleObject = ref({
  color: 'blue',
  fontSize: '24px',
})
</script>
```

⚠️ 주의: CSS 속성명과 JavaScript 객체 key의 표기법이 다르기 때문에 오타가 자주 난다. `font-size`를 그대로 쓰려면 반드시 문자열 key로 작성하고, 일반적으로는 `fontSize`처럼 camelCase로 쓰는 편이 좋다.

---

#### 3.9.4 Style Binding to Arrays: 여러 style 객체 병합하기

여러 style 객체를 배열에 넣어 `:style`에 바인딩하면, 객체들이 병합되어 하나의 요소에 적용된다.

![화면 캡처 2026-06-03 211613.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211613.png>)

![화면 캡처 2026-06-03 211633.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211633.png>)

```vue
<template>
  <!-- baseStyles와 overridingStyles가 하나로 합쳐져 적용된다. -->
  <div :style="[baseStyles, overridingStyles]">
    배열 style 바인딩
  </div>
</template>

<script setup>
const baseStyles = {
  color: 'gray',
  fontSize: '16px',
}

const overridingStyles = {
  fontWeight: 'bold',
}
</script>
```

여러 style 객체를 분리해두면 기본 스타일과 조건부 스타일을 나누어 관리하기 쉽다.

📌 핵심: `class`와 `style`은 단순 문자열보다 객체·배열 바인딩으로 관리할 때 조건 처리와 유지보수가 쉬워진다.

---

### 3.10 v-on: DOM 이벤트를 수신하고 메서드 실행하기

`v-on`은 DOM 요소에 이벤트 리스너를 연결하고, 이벤트가 발생했을 때 지정된 코드를 실행하는 directive다. 클릭, 입력, submit, keyup 같은 사용자 행동을 Vue 로직과 연결할 때 사용한다.

`v-on`도 자주 사용되기 때문에 약어 `@`로 줄여 쓴다.

![화면 캡처 2026-06-03 211846.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211846.png>)

![화면 캡처 2026-06-03 211936.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 211936.png>)

```vue
<template>
  <!-- 긴 표현 -->
  <button v-on:click="increase">증가</button>

  <!-- 약어 -->
  <button @click="increase">증가</button>
</template>
```

이벤트 핸들러는 크게 두 종류로 볼 수 있다.

| 종류 | 설명 | 적합한 상황 |
|---|---|---|
| Inline Handler | 템플릿 안에 실행할 JavaScript 코드를 직접 작성 | 매우 짧고 단순한 로직 |
| Method Handler | script에 정의한 메서드 이름을 연결 | 대부분의 실제 로직 |

---

#### 3.10.1 Inline Handlers: 짧은 로직을 바로 실행하기

Inline Handler는 이벤트가 발생했을 때 실행할 JavaScript 코드를 템플릿에 직접 작성하는 방식이다. 주로 간단한 값 증가나 상태 변경처럼 짧은 로직에 사용한다.

![화면 캡처 2026-06-03 212141.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 212141.png>)

```vue
<template>
  <!-- 클릭할 때마다 count 값을 1 증가시킨다. -->
  <button @click="count++">{{ count }}</button>
</template>

<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>
```

짧은 예시에서는 편리하지만, 로직이 길어지면 템플릿이 복잡해진다. 또한 같은 로직을 여러 곳에서 재사용하기 어렵다.

⚠️ 주의: Inline Handler에 복잡한 조건문이나 여러 줄 로직을 넣기 시작하면 템플릿이 읽기 어려워진다. 그럴 때는 메서드로 분리하는 것이 좋다.

---

#### 3.10.2 Method Handler: 로직을 메서드로 분리하기

Method Handler는 `script setup` 영역에 정의한 함수를 템플릿 이벤트에 연결하는 방식이다. 실제 개발에서는 대부분 이 방식을 사용한다.

![화면 캡처 2026-06-03 212258.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 212258.png>)

```vue
<template>
  <!-- 버튼을 클릭하면 myFunc 함수가 실행된다. -->
  <button @click="myFunc">메서드 실행</button>
</template>

<script setup>
const myFunc = () => {
  console.log('버튼이 클릭되었습니다.')
}
</script>
```

`@click="myFunc"`처럼 괄호 없이 메서드 이름만 연결하면, Vue는 DOM 이벤트 객체를 첫 번째 인자로 자동 전달한다.

![화면 캡처 2026-06-03 212357.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 212357.png>)

```vue
<template>
  <!-- event 객체가 myFunc의 첫 번째 인자로 자동 전달된다. -->
  <button @click="myFunc">이벤트 객체 확인</button>
</template>

<script setup>
const myFunc = (event) => {
  // event에는 클릭이 발생한 요소, 좌표 등 이벤트 상세 정보가 들어 있다.
  console.log(event)
  console.log(event.target)
}
</script>
```

`event` 객체는 이벤트 발생 시 브라우저가 제공하는 상세 정보 묶음이다. 어떤 요소에서 이벤트가 발생했는지, 기본 동작을 막을 수 있는지, 키보드 이벤트라면 어떤 키가 눌렸는지 등을 담고 있다.

---

#### 3.10.3 사용자 지정 인자 전달하기

메서드에 DOM 이벤트 객체 대신 내가 원하는 값을 넘길 수도 있다. 이때는 템플릿에서 메서드를 호출하는 형태로 작성한다.

![화면 캡처 2026-06-03 212455.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 212455.png>)

```vue
<template>
  <!-- greeting이라는 사용자 지정 인자를 메서드에 전달한다. -->
  <button @click="sayHello('안녕하세요')">인사하기</button>
</template>

<script setup>
const sayHello = (message) => {
  console.log(message)
}
</script>
```

이렇게 괄호를 사용해 직접 호출하면 자동으로 event 객체가 첫 번째 인자로 들어가지 않는다. event 객체도 함께 필요하다면 `$event`를 명시적으로 전달한다.

![화면 캡처 2026-06-03 212605.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 212605.png>)

![화면 캡처 2026-06-03 212636.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 212636.png>)

```vue
<template>
  <!-- $event를 사용하면 inline handler에서도 원래 DOM 이벤트 객체를 넘길 수 있다. -->
  <button @click="sayHello('안녕하세요', $event)">이벤트와 함께 전달</button>
</template>

<script setup>
const sayHello = (message, event) => {
  console.log(message)
  console.log(event.target)
}
</script>
```

`$event`는 Vue 템플릿에서 현재 발생한 원본 DOM 이벤트 객체를 가리키는 특별한 변수다. 전달 위치는 함수 정의와 맞기만 하면 된다.

⚠️ 주의: `@click="myFunc"`와 `@click="myFunc()"`는 비슷해 보이지만 event 전달 방식이 다르다. 괄호 없이 메서드 이름만 쓰면 event가 자동 전달되고, 괄호를 직접 쓰면 필요한 인자를 직접 넘겨야 한다.

---

### 3.11 Event Modifiers: 이벤트 기본 동작과 전파 제어하기

Vue는 `event.preventDefault()`나 `event.stopPropagation()` 같은 코드를 메서드 안에 직접 쓰지 않아도 되도록 event modifier를 제공한다. 이를 통해 메서드는 데이터 처리 로직에 집중하고, 이벤트 제어는 템플릿에서 선언적으로 표현할 수 있다.

![화면 캡처 2026-06-03 212803.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 212803.png>)

대표적인 modifier는 다음과 같다.

| Modifier | 의미 |
|---|---|
| `.prevent` | 이벤트의 기본 동작을 막는다. |
| `.stop` | 이벤트 버블링을 중단한다. |
| `.self` | 이벤트가 자기 자신에서 발생했을 때만 실행한다. |

Modifier는 체이닝해서 사용할 수 있다. 다만 작성한 순서대로 실행되므로 순서에 주의해야 한다.

---

#### 3.11.1 `.prevent`: form submit 기본 동작 막기

form의 submit 이벤트는 기본적으로 페이지를 새로고침하거나 요청을 보내는 동작을 수행한다. Vue에서 SPA 방식으로 form을 처리할 때는 이 기본 동작을 막고, 직접 정의한 메서드만 실행해야 하는 경우가 많다.

![화면 캡처 2026-06-03 212941.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 212941.png>)

```vue
<template>
  <!-- submit의 기본 동작을 막고 onSubmit만 실행한다. -->
  <form @submit.prevent="onSubmit">
    <input v-model="username" type="text">
    <button type="submit">제출</button>
  </form>
</template>

<script setup>
import { ref } from 'vue'

const username = ref('')

const onSubmit = () => {
  console.log('제출된 이름:', username.value)
}
</script>
```

여기서 `.prevent`가 없으면 submit 시 브라우저 기본 동작이 실행되어 화면이 새로고침될 수 있다. Vue 상태를 유지하며 form을 처리하려면 자주 사용하게 되는 modifier다.

---

#### 3.11.2 `.stop`과 `.prevent`: 링크 클릭과 버블링 제어하기

이벤트 버블링은 자식 요소에서 발생한 이벤트가 부모와 조상 요소로 전파되는 현상이다. 예를 들어 부모 `div`에 click 이벤트가 있고 그 안의 `a` 태그를 클릭하면, `a`의 click 이벤트가 실행된 뒤 부모의 click 이벤트도 실행될 수 있다.

첫 번째 링크는 기본 동작과 버블링이 모두 발생하는 상황을 보여준다.

![화면 캡처 2026-06-03 213042.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 213042.png>)

두 번째 링크는 `.prevent`로 페이지 이동 기본 동작만 막는 흐름이다. 다만 버블링은 막지 않았으므로 부모 이벤트는 계속 호출될 수 있다.

![화면 캡처 2026-06-03 213215.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 213215.png>)

세 번째 링크는 `.stop.prevent`를 함께 사용해 버블링과 기본 동작을 모두 막는 흐름이다.

![화면 캡처 2026-06-03 213325.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 213325.png>)

```vue
<template>
  <!-- 부모 영역의 클릭 이벤트 -->
  <div @click="detectBubble">
    <!-- 링크 기본 이동과 부모로의 이벤트 전파를 모두 막는다. -->
    <a href="https://google.com" @click.stop.prevent="onLink">
      이동하지 않고 현재 로직만 실행
    </a>
  </div>
</template>

<script setup>
const detectBubble = () => {
  console.log('부모 영역 클릭 감지')
}

const onLink = () => {
  console.log('링크 클릭 로직 실행')
}
</script>
```

⚠️ 주의: `.prevent`는 기본 동작을 막는 것이고, `.stop`은 이벤트 전파를 막는 것이다. 둘은 역할이 다르므로 “페이지 이동 방지”와 “부모 이벤트 호출 방지”를 구분해야 한다.

---

### 3.12 Key Modifiers: 특정 키 입력에만 반응하기

키보드 이벤트를 다룰 때는 특정 키가 눌렸을 때만 메서드를 실행하고 싶은 경우가 많다. Vue는 key modifier를 제공해 이 흐름을 간단히 작성할 수 있게 한다.

Enter 키가 입력되었을 때만 `onSubmit`을 호출하는 예시는 다음과 같다.

![화면 캡처 2026-06-03 213423.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 213423.png>)

```vue
<template>
  <!-- Enter 키를 눌렀을 때만 onSubmit이 실행된다. -->
  <input @keyup.enter="onSubmit">
</template>
```

Ctrl + Enter로 댓글을 등록하는 방식처럼 조합 키도 사용할 수 있다.

![화면 캡처 2026-06-03 213456.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 213456.png>)

```vue
<template>
  <!-- Ctrl + Enter 조합일 때만 submitComment가 실행된다. -->
  <textarea @keyup.ctrl.enter="submitComment"></textarea>
</template>
```

키 입력 처리는 게시글 작성, 댓글 등록, 검색창 submit 등에서 자주 사용된다. 이벤트 객체를 직접 확인하며 조건문을 작성할 수도 있지만, 단순한 키 조건은 modifier로 표현하는 편이 템플릿에서 의도가 더 잘 드러난다.

---

### 3.13 Form Input Bindings: 사용자 입력과 상태 동기화하기

폼을 처리할 때는 사용자가 input에 입력한 값을 JavaScript 상태에 실시간으로 반영해야 한다. 이 흐름을 **양방향 바인딩**이라고 부른다.

양방향 바인딩을 만드는 방법은 두 가지로 정리할 수 있다.

1. `v-bind`와 `v-on`을 함께 사용한다.
2. `v-model`을 사용한다.

`v-model`은 편리한 문법이지만, 내부적으로는 `value`를 바인딩하고 `input` 이벤트를 받아 값을 갱신하는 구조를 이해해야 한다.

---

#### 3.13.1 `v-bind`와 `v-on`을 함께 사용하기

먼저 `v-model` 없이 직접 양방향 바인딩을 구현해보면 구조가 잘 보인다.

![화면 캡처 2026-06-03 213716.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 213716.png>)

```vue
<template>
  <!-- 1. value 속성은 inputText 값과 연결된다. -->
  <!-- 2. input 이벤트가 발생할 때마다 현재 입력값을 inputText에 다시 저장한다. -->
  <input
    :value="inputText"
    @input="inputText = $event.target.value"
  >

  <!-- inputText가 바뀌면 이 문장도 함께 갱신된다. -->
  <p>{{ inputText }}</p>
</template>

<script setup>
import { ref } from 'vue'

const inputText = ref('')
</script>
```

이 코드는 양방향 바인딩을 두 단계로 나누어 보여준다.

- `:value="inputText"`: 데이터가 화면 input 값으로 내려간다.
- `@input="inputText = $event.target.value"`: 사용자의 입력이 다시 데이터로 올라온다.

이 구조를 이해하면 `v-model`이 왜 편리한지 자연스럽게 이해된다.

---

#### 3.13.2 v-model: 입력값과 반응형 변수를 양방향으로 연결하기

`v-model`은 form input 요소 또는 컴포넌트에서 양방향 바인딩을 만들어주는 directive다. 사용자의 입력이 데이터에 반영되고, 데이터가 변경되면 화면의 입력값도 함께 바뀐다.

![화면 캡처 2026-06-03 213933.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 213933.png>)

```vue
<template>
  <!-- v-model이 value 바인딩과 input 이벤트 처리를 대신해준다. -->
  <input v-model="message">
  <p>{{ message }}</p>
</template>

<script setup>
import { ref } from 'vue'

const message = ref('')
</script>
```

앞에서 본 `:value` + `@input` 방식과 비교하면 훨씬 간결하다. 하지만 실전에서 문제가 생겼을 때는 `v-model`을 단순 암기 문법으로만 보면 원인을 찾기 어렵다. `v-model`은 결국 **입력 요소의 값과 반응형 데이터를 동기화하는 약속**이라고 이해하는 것이 좋다.

⚠️ 주의: 한국어, 중국어, 일본어처럼 IME가 필요한 언어에서는 조합 중인 입력이 실시간으로 처리되는 방식 때문에 `v-model`이 의도와 다르게 동작할 수 있다. 이 경우 상황에 따라 `v-bind`와 `v-on`을 직접 사용하거나 `.lazy` 수식어를 검토할 수 있다.

📌 핵심: `v-model`은 `v-bind`와 `v-on`을 조합한 양방향 바인딩을 짧게 표현하는 문법이다.

---

### 3.14 v-model과 다양한 입력 양식

`v-model`은 단순한 text input뿐만 아니라 checkbox, select, radio, textarea 등 다양한 form 요소와 함께 사용할 수 있다. 입력 요소의 종류에 따라 연결되는 값의 형태가 달라진다.

---

#### 3.14.1 Checkbox: boolean 또는 배열로 관리하기

단일 체크박스는 보통 boolean 값과 연결된다.

![화면 캡처 2026-06-03 214207.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 214207.png>)

```vue
<template>
  <!-- 체크 여부가 checked 값에 true/false로 저장된다. -->
  <input type="checkbox" v-model="checked">
  <p>{{ checked }}</p>
</template>

<script setup>
import { ref } from 'vue'

const checked = ref(false)
</script>
```

여러 체크박스는 배열과 연결할 수 있다. 선택된 체크박스의 `value` 값들이 배열에 들어간다.

![화면 캡처 2026-06-03 214251.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 214251.png>)

```vue
<template>
  <!-- 선택된 값들이 checkedNames 배열에 들어간다. -->
  <label><input type="checkbox" value="HTML" v-model="checkedNames"> HTML</label>
  <label><input type="checkbox" value="CSS" v-model="checkedNames"> CSS</label>
  <label><input type="checkbox" value="Vue" v-model="checkedNames"> Vue</label>

  <p>{{ checkedNames }}</p>
</template>

<script setup>
import { ref } from 'vue'

// 여러 체크박스와 연결할 때는 초기값을 배열로 둔다.
const checkedNames = ref([])
</script>
```

⚠️ 주의: 여러 체크박스를 배열로 관리하려면 초기 반응형 변수를 배열로 만들어야 한다. 문자열이나 boolean으로 시작하면 선택값이 기대한 형태로 누적되지 않을 수 있다.

---

#### 3.14.2 Select: 선택된 option 값을 상태로 관리하기

`select`에서도 `v-model`을 사용할 수 있다. 선택된 option의 값이 연결된 반응형 변수에 저장된다.

![화면 캡처 2026-06-03 214358.png](<../assets/images/05_27_Basic_Syntax_1/화면 캡처 2026-06-03 214358.png>)

```vue
<template>
  <select v-model="selected">
    <option disabled value="">선택하세요</option>
    <option>HTML</option>
    <option>CSS</option>
    <option>Vue</option>
  </select>

  <p>선택한 값: {{ selected }}</p>
</template>

<script setup>
import { ref } from 'vue'

const selected = ref('')
</script>
```

`v-model`의 초기값이 어떤 option과도 일치하지 않으면, select 요소는 선택되지 않은 상태로 렌더링될 수 있다. 그래서 안내용 option을 두고 초기값을 빈 문자열로 맞추는 패턴을 자주 사용한다.

---

### 3.15 `$` 접두어와 Vue 공용 프로퍼티

`$` 접두어가 붙은 변수는 Vue 인스턴스 내부에서 사용할 수 있도록 Vue가 제공하는 공용 프로퍼티를 나타낸다. 사용자가 직접 만든 반응형 변수나 메서드와 구분하기 위한 이름 규칙이라고 볼 수 있다.

예를 들어 앞에서 본 `$event`는 inline handler 안에서 원래 DOM 이벤트 객체에 접근할 수 있게 해주는 특별한 변수다.

```vue
<template>
  <!-- $event는 현재 발생한 DOM 이벤트 객체를 가리킨다. -->
  <button @click="handleClick($event)">클릭</button>
</template>
```

⚠️ 주의: 사용자가 직접 만드는 데이터나 메서드 이름에 `$` 또는 `_` 접두사를 사용하는 것은 피하는 것이 좋다. Vue 내부에서 사용하는 이름과 충돌하거나, 내부 구현에 의존하는 코드가 될 수 있다.

---

### 3.16 IME: 한글 입력과 v-model에서 주의할 점

IME(Input Method Editor)는 키보드에 직접 없는 문자를 입력할 수 있도록 도와주는 운영 체제 수준의 입력 프로그램이다. 한국어처럼 자음과 모음을 조합해 한 글자를 만드는 언어에서는 IME가 필수적으로 사용된다.

문제는 한글을 조합하는 중에도 브라우저의 input 이벤트가 발생할 수 있고, 이 흐름이 `v-model`의 실시간 업데이트 방식과 충돌할 수 있다는 점이다. 그래서 한글 입력 중에는 값이 기대한 시점보다 늦게 반영되거나, 조합 중인 글자가 처리되는 방식이 어색하게 느껴질 수 있다.

```vue
<template>
  <!-- 실시간 반영이 꼭 필요하지 않다면 .lazy로 change 시점에 반영할 수 있다. -->
  <input v-model.lazy="message">
  <p>{{ message }}</p>
</template>
```

`.lazy`를 사용하면 사용자가 입력을 마치고 포커스를 잃거나 change 이벤트가 발생했을 때 값이 반영된다. 다만 실시간 검색이나 즉시 미리보기처럼 입력 중 값이 바로 필요하다면, `v-bind`와 `v-on`을 직접 사용해 입력 흐름을 더 세밀하게 제어해야 한다.

⚠️ 주의: `.lazy`는 IME 관련 문제를 완화할 수 있지만, 실시간 반영이 사라진다. 따라서 “정확한 조합 처리”와 “실시간 반영” 중 무엇이 더 중요한지에 따라 선택해야 한다.

---

## 4. 적용 관점에서 다시 보기

이번 강의의 문법은 실제 Vue 컴포넌트를 작성할 때 거의 매번 등장한다. 문제를 보거나 기능을 구현할 때는 다음 신호를 기준으로 어떤 문법을 떠올릴지 정리하면 좋다.

| 구현 상황 | 떠올릴 문법 | 판단 기준 |
|---|---|---|
| 데이터를 화면에 출력해야 한다 | `{{ }}` | 단순 텍스트 출력인가? |
| HTML 문자열을 실제 태그로 보여줘야 한다 | `v-html` | 신뢰 가능한 HTML인가? |
| 링크, 이미지, disabled 같은 속성이 데이터에 따라 바뀐다 | `v-bind`, `:` | HTML 속성 값을 동적으로 바꿔야 하는가? |
| 조건에 따라 class를 붙였다 뺐다 해야 한다 | `:class` 객체 문법 | boolean 조건으로 class를 제어하는가? |
| 여러 class나 style을 묶어 적용해야 한다 | 배열 바인딩 | 여러 값을 하나의 속성에 합쳐야 하는가? |
| 버튼 클릭, form submit, 키 입력을 처리해야 한다 | `v-on`, `@` | 사용자 행동을 메서드와 연결해야 하는가? |
| 링크 이동이나 form 새로고침을 막아야 한다 | `.prevent` | 브라우저 기본 동작을 취소해야 하는가? |
| 부모 이벤트까지 실행되는 것을 막아야 한다 | `.stop` | 이벤트 버블링을 끊어야 하는가? |
| input 값을 상태와 동기화해야 한다 | `v-model` | 입력값과 데이터가 함께 바뀌어야 하는가? |

구현 순서는 보통 다음처럼 잡으면 된다.

1. 먼저 화면에 필요한 상태를 `ref`로 만든다.
2. 그 상태를 템플릿에 `{{ }}`, `:속성`, `:class`, `:style`로 연결한다.
3. 사용자의 행동이 필요한 지점에 `@click`, `@input`, `@submit` 같은 이벤트를 붙인다.
4. 이벤트 로직이 짧으면 inline handler로 처리하고, 길어지면 method handler로 분리한다.
5. form 입력은 먼저 `v-model`로 간단히 처리하되, 한글 입력이나 세밀한 제어가 필요하면 `v-bind` + `v-on` 구조로 다시 생각한다.

실전에서 가장 자주 헷갈리는 부분은 `v-bind`와 `v-on`의 역할이 섞이는 경우다. `v-bind`는 **데이터를 화면 속성으로 내려보내는 문법**이고, `v-on`은 **사용자의 이벤트를 받아 JavaScript 로직을 실행하는 문법**이다. `v-model`은 이 두 흐름이 함께 필요한 form 입력에서 등장한다고 정리하면 이해가 훨씬 안정된다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

Vue 템플릿 문법은 단순히 HTML 안에 특수 기호를 넣는 방식이 아니라, JavaScript 상태와 DOM 사이의 관계를 선언하는 방식이라는 점이 핵심이다. 특히 `v-model`을 독립 문법으로만 외우지 않고 `v-bind`와 `v-on`의 조합으로 이해하면, 폼 입력 흐름을 훨씬 명확하게 설명할 수 있다.

### 5.2 앞으로 이어지는 연결점

이번 내용은 컴포넌트 간 데이터 전달, 조건부 렌더링, 반복 렌더링, 폼 제출, API 요청과 바로 연결된다. 예를 들어 검색창을 만들 때는 `v-model`로 검색어를 관리하고, `@submit.prevent`로 submit 기본 동작을 막은 뒤, 검색 API를 호출하는 식으로 확장된다.

### 5.3 더 파볼 만한 주제

이후에는 `computed`와 `watch`를 함께 학습하면 템플릿 안에 복잡한 표현식을 줄이고 상태 변화에 따른 로직을 더 깔끔하게 관리할 수 있다. 또한 `props`와 `emit`을 배우면 부모·자식 컴포넌트 사이에서 `v-bind`와 `v-on`이 어떻게 확장되는지도 이해할 수 있다.

---

## 6. 요약 정리

📌 핵심 정리

- Vue Template Syntax는 JavaScript 데이터와 HTML 화면을 선언적으로 연결하는 문법이다.
- `{{ }}`는 데이터를 텍스트로 출력하고, `v-html`은 HTML 문자열을 실제 HTML로 렌더링한다.
- HTML 속성 안에서는 콧수염 구문을 쓰지 않고 `v-bind` 또는 약어 `:`를 사용한다.
- directive는 `v-` 접두사가 붙은 Vue 특수 속성이며, name·argument·modifier·value 구조로 이해할 수 있다.
- `:class`와 `:style`은 객체와 배열 문법을 활용하면 조건부 적용과 여러 값 병합을 쉽게 처리할 수 있다.
- `v-on` 또는 약어 `@`는 사용자 이벤트를 메서드와 연결한다.
- `.prevent`는 기본 동작을 막고, `.stop`은 이벤트 버블링을 막는다.
- `v-model`은 form 입력값과 반응형 데이터를 양방향으로 동기화한다.
- 한글처럼 IME가 필요한 입력에서는 `v-model`의 업데이트 시점을 주의해야 한다.

🧠 기억할 것

Vue 템플릿 문법은 “데이터를 화면에 보여주기”, “사용자의 행동을 데이터로 되돌리기”라는 두 방향의 흐름으로 정리하면 된다. `v-bind`는 데이터가 화면으로 내려가는 흐름, `v-on`은 화면의 이벤트가 JavaScript로 올라오는 흐름, `v-model`은 이 둘을 합친 form 입력 흐름이다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 콧수염 구문 `{{ }}`을 HTML 속성 안에서 사용할 수 없는 이유는 무엇이며, 대신 어떤 문법을 사용해야 하는가?
2. `v-bind:href="url"`과 `:href="url"`은 어떤 관계인가?
3. `:class="{ active: isActive }"`에서 `active`와 `isActive`는 각각 어떤 역할을 하는가?
4. `@click="myFunc"`와 `@click="myFunc()"`는 event 객체 전달 방식에서 어떤 차이가 있는가?
5. `.prevent`와 `.stop`은 각각 어떤 문제를 해결하기 위해 사용하는가?
6. `v-model`을 `v-bind`와 `v-on`의 조합으로 설명하면 어떤 흐름이 되는가?
7. 여러 체크박스를 `v-model`로 관리할 때 초기값을 배열로 두어야 하는 이유는 무엇인가?
8. 한글 입력처럼 IME가 필요한 상황에서 `v-model`을 사용할 때 어떤 점을 주의해야 하는가?

---

## 부록. 원본 이미지 경로 보존 확인

이 정리본에서는 강의노트 원본에 포함된 이미지 참조 형식을 변경하지 않았다. 모든 이미지는 원본과 동일하게 `attachment:파일명.png` 주소 형식을 유지한다.
