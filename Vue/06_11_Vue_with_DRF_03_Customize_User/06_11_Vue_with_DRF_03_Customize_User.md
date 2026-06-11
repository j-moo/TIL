# Vue with DRF 03 - Customize User

- 🎯 글의 목표: Vue와 DRF를 연결한 프로젝트에서 회원가입, 로그인, 토큰 저장, 인증이 필요한 요청, 접근 제어, 커스텀 유저 필드, 로그아웃까지 하나의 인증 흐름으로 이해한다.
- 🧩 핵심 키워드: Vue, DRF, dj-rest-auth, Token Authentication, Pinia Store, Authorization Header, computed, Navigation Guard, Custom User Model, CustomRegisterSerializer, Logout, Django Signals, Vite Environment Variable
- ⭐ 중요도: ★★★★★  
  Vue와 DRF를 함께 사용하는 프로젝트에서 인증은 거의 모든 기능의 기준이 된다. 게시글 목록 조회, 게시글 작성, 마이페이지 접근, 회원가입 후 사용자 정보 저장처럼 실제 서비스의 핵심 흐름이 모두 인증 상태와 연결된다.
- 📝 한눈에 보는 내용:  
  이번 강의는 “DRF 서버에서 토큰 인증을 요구하는데, Vue는 이 토큰을 어디에 저장하고 어떻게 요청마다 함께 보낼까?”라는 질문에서 출발한다. 먼저 인증 토큰 없이 게시글 요청을 보내면 401 오류가 발생하는 상황을 확인하고, 회원가입과 로그인 화면을 만든 뒤, 로그인 응답으로 받은 토큰을 Pinia store에 저장한다. 이후 게시글 전체 조회와 게시글 생성 요청에 `Authorization` 헤더를 추가하여 인증 문제를 해결한다. 그다음 `computed`와 Navigation Guard로 로그인 여부에 따른 접근 제어를 구현하고, 마지막으로 dj-rest-auth의 `RegisterSerializer`를 커스터마이징하여 `age` 같은 추가 유저 필드를 회원가입 과정에서 함께 저장하는 방법까지 정리한다.
- 🔗 관련 문제 / 주제: Vue + DRF 프로젝트 인증 흐름, 게시글 CRUD 인증 처리, 회원가입/로그인 화면 구현, 토큰 기반 API 요청, Pinia persisted state, 커스텀 유저 모델, 회원가입 Serializer 커스터마이징, 로그인 여부에 따른 라우터 접근 제한

---

## 1. 들어가며

Vue와 DRF를 함께 쓰는 프로젝트에서 가장 먼저 마주치는 벽 중 하나가 **인증 흐름**이다. DRF 쪽에서는 이미 `TokenAuthentication`이나 permission 설정을 통해 “인증된 사용자만 요청할 수 있다”는 규칙을 만들 수 있다. 하지만 프론트엔드인 Vue가 이 규칙에 맞게 동작하지 않으면, 서버는 요청을 정상 요청으로 받아들이지 않는다.

이때 브라우저 화면에서는 단순히 “게시글이 안 나온다”처럼 보일 수 있다. 하지만 개발자 도구의 Network 탭을 보면 실제 원인은 `401 Unauthorized`인 경우가 많다. 서버 입장에서는 요청을 보낸 사용자가 누구인지 확인할 수 없기 때문에 응답을 거부하는 것이다.

이번 강의는 이 문제를 Vue 쪽에서 해결하는 흐름을 다룬다. 먼저 회원가입과 로그인 화면을 만들고, 로그인 성공 시 서버가 발급한 토큰을 Pinia store에 저장한다. 그다음 인증이 필요한 요청마다 이 토큰을 `Authorization` 헤더에 담아 보낸다. 여기까지가 기본 인증 흐름이다.

하지만 실제 서비스는 여기서 끝나지 않는다. 로그인하지 않은 사용자가 메인 페이지에 접근하지 못하게 해야 하고, 이미 로그인한 사용자는 다시 로그인 페이지나 회원가입 페이지에 들어가지 못하게 막아야 한다. 이를 위해 `computed`로 로그인 상태를 계산하고, Vue Router의 Navigation Guard로 접근 제어를 구현한다.

후반부에서는 한 단계 더 나아가 사용자 모델을 커스터마이징한다. 기본 회원가입에서는 `username`, `email`, `password1`, `password2` 정도만 처리되지만, 프로젝트에서는 `age`, `nickname`, `profile_image`처럼 추가 정보가 필요할 수 있다. 이때 단순히 Vue에서 데이터를 더 보내는 것만으로는 부족하고, DRF의 회원가입 Serializer도 함께 수정해야 한다.

---

## 2. 핵심 개념 정리

이번 강의의 큰 질문은 다음과 같다.

> DRF에서 인증이 필요한 API를 만들었을 때, Vue는 사용자의 로그인 상태와 토큰을 어떻게 관리해야 할까?

이 질문에 답하려면 인증 흐름을 한 번에 보려고 하면 어렵다. 대신 다음 순서로 나누어 이해하는 것이 좋다.

첫 번째는 **토큰 발급**이다. 사용자가 로그인 정보를 입력하면 Vue는 DRF의 로그인 API로 요청을 보낸다. 서버는 username과 password를 검증한 뒤, 해당 사용자를 식별할 수 있는 token을 응답으로 돌려준다.

두 번째는 **토큰 저장**이다. 응답으로 받은 token을 컴포넌트 내부 변수에만 저장하면 페이지가 바뀌거나 새로고침했을 때 유지하기 어렵다. 그래서 Pinia store에 저장하고, 필요하면 `pinia-plugin-persistedstate`를 이용해 localStorage에도 유지한다.

세 번째는 **토큰 사용**이다. 인증이 필요한 API 요청을 보낼 때는 HTTP header에 다음과 같은 형식으로 토큰을 담아야 한다.

```text
Authorization: Token 발급받은토큰값
```

네 번째는 **인증 상태에 따른 화면 제어**다. 토큰이 있으면 로그인 상태로 보고, 토큰이 없으면 비로그인 상태로 볼 수 있다. 이 값을 `computed`로 관리하면 token 값이 바뀔 때 로그인 상태도 함께 갱신된다.

다섯 번째는 **회원가입 Serializer 커스터마이징**이다. Vue에서 `age` 값을 추가로 보내더라도, dj-rest-auth의 기본 `RegisterSerializer`가 그 필드를 모르고 있으면 DB에 저장되지 않는다. 따라서 serializer에 `age` 필드를 추가하고, `get_cleaned_data()`와 `save()` 과정에서 해당 값을 명시적으로 처리해야 한다.

이 흐름을 잡고 나면 이번 강의의 코드는 단순히 많은 파일을 수정하는 것이 아니라, “인증 흐름을 프론트엔드와 백엔드가 함께 맞춰가는 과정”으로 이해할 수 있다.

---

## 3. 본문 정리

## 3.1 인증이 필요한 요청에서 401 오류가 발생하는 이유

이번 강의는 기존에 정상 작동하던 게시글 전체 조회가 갑자기 동작하지 않는 상황에서 시작한다. 화면만 보면 게시글이 보이지 않는 문제처럼 보이지만, 개발자 도구에서 요청 결과를 확인하면 `401 Unauthorized` 상태 코드를 확인할 수 있다.

![토큰 없이 게시글 조회 요청을 보냈을 때 발생하는 401 오류](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103027.png>)

`401`은 서버가 요청자를 인증할 수 없다는 의미다. 즉, 사용자가 누구인지 확인할 수 있는 수단이 요청에 포함되어 있지 않다는 뜻이다. DRF에서 permission을 설정해 인증된 사용자만 게시글을 조회하거나 작성할 수 있도록 만들었다면, Vue는 매 요청마다 인증 정보를 함께 보내야 한다.

강의에서는 이 문제를 해결하기 위해 다음 흐름을 구현한다.

1. 회원가입 화면을 만든다.
2. 로그인 화면을 만든다.
3. 로그인 성공 시 DRF가 발급한 token을 Pinia store에 저장한다.
4. 인증이 필요한 요청마다 token을 `Authorization` header에 담아 보낸다.
5. token 유무를 기준으로 로그인 상태를 계산하고, 페이지 접근을 제어한다.

![토큰을 저장하고 인증 요청에 활용한 뒤 게시글이 정상 출력되는 흐름](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103132.png>)

여기서 중요한 점은 “로그인 화면을 만들었다”가 곧 인증 완료를 뜻하지 않는다는 것이다. 로그인 요청을 통해 받은 token을 저장하고, 이후 요청에 계속 포함해야 실제 인증 흐름이 완성된다.

⚠️ 주의: 게시글 조회가 안 될 때 화면 코드만 먼저 의심하면 원인을 놓치기 쉽다. Vue + DRF 프로젝트에서는 Network 탭에서 status code를 먼저 확인해야 한다. `401`이면 인증 정보가 없거나 잘못된 것이고, `403`이면 인증은 되었지만 권한이 부족한 상황일 가능성이 크다.

---

## 3.2 회원가입 화면과 요청 흐름 만들기

회원가입은 인증 흐름의 출발점이다. 사용자가 계정을 만들 수 있어야 이후 로그인도 할 수 있다. Vue에서는 회원가입 화면을 라우터에 등록하고, 사용자가 입력한 데이터를 DRF 서버로 전송하는 구조를 만든다.

### 3.2.1 SignUpView 라우트 연결

먼저 `SignUpView`가 실제 URL로 접근 가능하도록 route 설정을 활성화한다. 강의에서는 기존에 주석 처리되어 있던 회원가입 route 관련 코드를 주석 해제하는 방식으로 진행했다.

![SignUpView 라우트 설정 주석 해제](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103207.png>)

대표적인 라우터 구조는 다음과 같다.

```js
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import ArticleView from '@/views/ArticleView.vue'
import SignUpView from '@/views/SignUpView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'ArticleView',
      component: ArticleView,
    },
    {
      path: '/signup',
      name: 'SignUpView',
      component: SignUpView,
    },
  ],
})

export default router
```

이 설정에서 `path`는 브라우저 주소이고, `name`은 코드에서 해당 route를 부를 이름이다. 앞으로 `RouterLink`나 `router.push()`에서 `name: 'SignUpView'`처럼 사용할 수 있다.

### 3.2.2 App.vue에 회원가입 링크 추가

라우터에 등록만 해두면 사용자가 직접 `/signup` 주소를 입력해야 접근할 수 있다. 일반적인 화면에서는 상단 네비게이션이나 메뉴에 회원가입 링크를 만들어준다.

![App 컴포넌트에 SignUpView로 이동하는 RouterLink 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103236.png>)

```vue
<!-- App.vue -->
<template>
  <header>
    <nav>
      <!-- 게시글 목록 페이지로 이동한다. -->
      <RouterLink :to="{ name: 'ArticleView' }">Articles</RouterLink>

      <!-- 회원가입 페이지로 이동한다. -->
      <RouterLink :to="{ name: 'SignUpView' }">SignUpPage</RouterLink>
    </nav>
  </header>

  <!-- 현재 URL과 일치하는 View 컴포넌트가 이 위치에 렌더링된다. -->
  <RouterView />
</template>
```

`RouterLink`를 사용할 때 실제 path 문자열을 직접 작성할 수도 있지만, 강의 흐름에서는 `name`을 사용해 이동하는 방식이 반복된다. 이렇게 하면 나중에 `/signup` 경로가 바뀌더라도 route의 `name`이 유지되는 한 링크 코드를 크게 바꾸지 않아도 된다.

### 3.2.3 회원가입 form 작성

회원가입 화면에서는 사용자가 `username`, `password1`, `password2`를 입력할 수 있어야 한다. 두 개의 password를 받는 이유는 사용자가 비밀번호를 잘못 입력하지 않았는지 확인하기 위해서다.

![SignUpView 회원가입 form 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103303.png>)

```vue
<!-- SignUpView.vue -->
<template>
  <div>
    <h1>Sign Up Page</h1>

    <!-- submit 이벤트가 발생하면 기본 새로고침을 막고 signUp 함수를 실행한다. -->
    <form @submit.prevent="signUp">
      <div>
        <label for="username">username : </label>
        <input type="text" id="username" v-model.trim="username">
      </div>

      <div>
        <label for="password1">password : </label>
        <input type="password" id="password1" v-model.trim="password1">
      </div>

      <div>
        <label for="password2">password confirmation : </label>
        <input type="password" id="password2" v-model.trim="password2">
      </div>

      <input type="submit" value="SignUp">
    </form>
  </div>
</template>
```

여기서 `@submit.prevent`는 form 제출 시 페이지가 새로고침되는 기본 동작을 막는다. SPA에서는 새로고침 없이 JavaScript 함수에서 직접 요청을 보내야 하므로 이 처리가 중요하다.

### 3.2.4 입력값을 반응형 변수와 연결하기

form만 만들면 입력값을 JavaScript에서 사용할 수 없다. Vue에서는 `ref()`로 반응형 변수를 만들고, `v-model`로 input과 연결한다.

![사용자 입력 데이터와 바인딩될 반응형 변수 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103335.png>)

```vue
<script setup>
import { ref } from 'vue'

// input에 입력되는 값이 각각의 ref와 양방향 바인딩된다.
const username = ref(null)
const password1 = ref(null)
const password2 = ref(null)
</script>
```

`v-model`은 사용자가 입력한 값을 변수에 자동으로 반영한다. 반대로 변수 값이 바뀌면 input에도 반영된다. 회원가입처럼 form 데이터를 서버로 보내는 기능에서는 거의 필수로 사용된다.

화면이 정상적으로 연결되면 `/signup` 주소에서 회원가입 페이지를 확인할 수 있다.

![SignUpView 컴포넌트 출력 확인](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103415.png>)

### 3.2.5 컴포넌트의 signUp 함수와 store의 signUp 함수 분리

회원가입 요청을 보낼 때 컴포넌트가 모든 로직을 직접 처리할 수도 있다. 하지만 이번 강의에서는 실제 요청 로직을 Pinia store에 둔다. 컴포넌트는 입력값을 모아 payload를 만들고, store의 함수를 호출하는 역할을 한다.

![회원가입 요청을 보내기 위한 signUp 함수가 해야 할 일](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103458.png>)

```vue
<script setup>
import { ref } from 'vue'
import { useAccountStore } from '@/stores/accounts'

const store = useAccountStore()

const username = ref(null)
const password1 = ref(null)
const password2 = ref(null)

const signUp = function () {
  // 사용자가 입력한 값을 하나의 객체로 묶는다.
  const payload = {
    username: username.value,
    password1: password1.value,
    password2: password2.value,
  }

  // 실제 회원가입 요청은 store 함수에게 맡긴다.
  store.signUp(payload)
}
</script>
```

![컴포넌트에서 입력 데이터를 저장한 뒤 store의 signUp 함수 호출](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103538.png>)

이렇게 역할을 나누면 컴포넌트는 화면과 입력 처리에 집중하고, store는 서버 통신과 인증 상태 관리에 집중할 수 있다.

### 3.2.6 store에서 실제 회원가입 요청 보내기

Pinia store에서는 axios를 사용해 DRF 서버의 회원가입 엔드포인트로 요청을 보낸다. dj-rest-auth를 사용하는 경우 일반적으로 회원가입 주소는 `/accounts/signup/` 형태로 구성된다.

![store에서 실제 회원가입 요청을 보내는 signUp 함수 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103613.png>)

```js
// stores/accounts.js
import { ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAccountStore = defineStore('account', () => {
  const API_URL = 'http://127.0.0.1:8000'

  const signUp = function (payload) {
    // 컴포넌트에서 전달받은 payload를 구조 분해 할당한다.
    const { username, password1, password2 } = payload

    axios({
      method: 'post',
      url: `${API_URL}/accounts/signup/`,
      data: {
        username,
        password1,
        password2,
      },
    })
      .then((response) => {
        // 회원가입 성공 시 서버 응답을 확인한다.
        console.log('회원가입 성공')
        console.log(response.data)
      })
      .catch((error) => {
        // 비밀번호 불일치, 필드 누락, 중복 username 등이 여기서 확인된다.
        console.log(error)
      })
  }

  return { API_URL, signUp }
}, { persist: true })
```

회원가입 요청이 성공하면 Django DB에서 사용자가 실제로 생성되었는지 확인한다.

![회원가입 테스트 후 Django DB에서 사용자 생성 확인](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103640.png>)

⚠️ 주의: 회원가입 요청은 성공했는데 DB에 원하는 필드가 저장되지 않을 수 있다. 특히 뒤에서 다루는 `age` 같은 커스텀 필드는 Vue에서 payload에 넣었다고 자동 저장되지 않는다. 서버의 Serializer가 해당 필드를 처리해야 한다.

---

## 3.3 로그인 화면과 토큰 발급 흐름 만들기

회원가입 후에는 사용자가 로그인할 수 있어야 한다. 로그인은 단순히 화면을 바꾸는 기능이 아니라, 서버로부터 token을 발급받는 과정이다. 이 token이 이후 인증 요청의 핵심이 된다.

### 3.3.1 LogInView 라우트 연결

회원가입과 마찬가지로 로그인 화면도 route에 등록해야 한다. 강의에서는 `LogInView` 관련 route 코드의 주석을 해제한다.

![LogInView 라우트 관련 코드 주석 해제](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103717.png>)

```js
// router/index.js
import LogInView from '@/views/LogInView.vue'

const routes = [
  {
    path: '/login',
    name: 'LogInView',
    component: LogInView,
  },
]
```

### 3.3.2 App.vue에 로그인 링크 추가

이제 App 컴포넌트에도 로그인 페이지로 이동하는 링크를 추가한다.

![App 컴포넌트에 LogInView로 이동하는 RouterLink 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103749.png>)

```vue
<template>
  <header>
    <nav>
      <RouterLink :to="{ name: 'ArticleView' }">Articles</RouterLink>
      <RouterLink :to="{ name: 'SignUpView' }">SignUpPage</RouterLink>
      <RouterLink :to="{ name: 'LogInView' }">LogInPage</RouterLink>
    </nav>
  </header>

  <RouterView />
</template>
```

로그인 링크도 회원가입 링크와 마찬가지로 `name` 기반으로 이동한다. 라우터 이름으로 이동하는 방식은 프로젝트가 커질수록 유지보수에 유리하다.

### 3.3.3 로그인 form과 반응형 변수

로그인 화면에서는 `username`과 `password`만 입력받는다. 회원가입과 달리 `password2`는 필요 없다.

![LogInView 로그인 form 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103809.png>)

![로그인 입력 데이터와 연결될 반응형 변수 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 103838.png>)

```vue
<!-- LogInView.vue -->
<script setup>
import { ref } from 'vue'
import { useAccountStore } from '@/stores/accounts'

const store = useAccountStore()

const username = ref(null)
const password = ref(null)

const logIn = function () {
  const payload = {
    username: username.value,
    password: password.value,
  }

  store.logIn(payload)
}
</script>

<template>
  <div>
    <h1>LogIn Page</h1>

    <form @submit.prevent="logIn">
      <div>
        <label for="username">username : </label>
        <input type="text" id="username" v-model.trim="username">
      </div>

      <div>
        <label for="password">password : </label>
        <input type="password" id="password" v-model.trim="password">
      </div>

      <input type="submit" value="logIn">
    </form>
  </div>
</template>
```

화면이 정상적으로 연결되면 `/login` 주소에서 로그인 페이지가 출력된다.

![LogInView 컴포넌트 출력 확인](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104024.png>)

### 3.3.4 로그인 요청과 응답 토큰 확인

로그인 함수가 해야 할 일은 두 가지다. 사용자 입력 데이터를 받아 서버에 로그인 요청을 보내고, 응답으로 받은 token을 저장하는 것이다.

![로그인 요청 함수가 해야 할 일](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104103.png>)

컴포넌트에서는 회원가입 때와 마찬가지로 입력 데이터를 payload로 묶어 store의 `logIn` 함수를 호출한다.

![컴포넌트에서 입력 데이터를 저장한 뒤 store의 logIn 함수 호출](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104140.png>)

store에서는 `/accounts/login/`으로 요청을 보낸다.

![store에서 실제 로그인 요청을 보내는 logIn 함수 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104209.png>)

```js
// stores/accounts.js
const logIn = function (payload) {
  const { username, password } = payload

  axios({
    method: 'post',
    url: `${API_URL}/accounts/login/`,
    data: {
      username,
      password,
    },
  })
    .then((response) => {
      // dj-rest-auth는 로그인 성공 시 key라는 이름으로 token을 내려준다.
      console.log('로그인 성공')
      console.log(response.data)
    })
    .catch((error) => {
      console.log(error)
    })
}
```

로그인에 성공하면 응답 객체 안에 Django가 발급한 token이 포함되어 있는 것을 확인할 수 있다.

![로그인 응답 객체 안에 발급된 token이 포함된 모습](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104256.png>)

📌 핵심: 로그인 성공의 핵심 결과물은 화면 이동이 아니라 token 발급이다. 이 token을 저장해야 이후 인증이 필요한 요청을 보낼 수 있다.

---

## 3.4 Pinia store에 토큰 저장하기

로그인 응답으로 받은 token을 콘솔에만 출력하면 다음 요청에서 사용할 수 없다. 따라서 Pinia store에 token 상태를 만들고, 로그인 성공 시 이 값을 저장해야 한다.

### 3.4.1 token 반응형 변수 선언

store에 `token`이라는 ref를 만든다. 로그인 성공 시 `response.data.key`를 token에 저장한다.

![Pinia store에 token 반응형 변수 선언 및 저장](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104331.png>)

```js
// stores/accounts.js
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAccountStore = defineStore('account', () => {
  const API_URL = 'http://127.0.0.1:8000'

  // 로그인 성공 후 발급받은 토큰을 저장한다.
  const token = ref(null)

  const logIn = function (payload) {
    const { username, password } = payload

    axios({
      method: 'post',
      url: `${API_URL}/accounts/login/`,
      data: {
        username,
        password,
      },
    })
      .then((response) => {
        // dj-rest-auth 응답의 key 값을 token에 저장한다.
        token.value = response.data.key
      })
      .catch((error) => {
        console.log(error)
      })
  }

  return { API_URL, token, logIn }
}, { persist: true })
```

`{ persist: true }` 설정은 Pinia 상태를 localStorage 등에 유지하기 위한 설정이다. 이 설정이 있으면 새로고침 후에도 token이 유지되어 로그인 상태를 계속 사용할 수 있다.

로그인 후 store에 token이 저장되는지 확인한다.

![로그인 요청 후 store에 저장된 token 확인](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104356.png>)

⚠️ 주의: token을 저장해도 브라우저 새로고침 후 사라진다면 Pinia persisted state 설정이 되어 있는지 확인해야 한다. 반대로 로그아웃했는데도 로그인 상태처럼 보인다면 localStorage에 남아 있는 token을 삭제했는지 확인해야 한다.

### 3.4.2 로그인 성공 후 자동 이동

로그인에 성공하면 사용자가 계속 로그인 페이지에 머물 필요가 없다. 보통은 메인 페이지나 게시글 목록 페이지로 자동 이동시킨다.

![로그인 성공 후 자동으로 메인 페이지로 이동](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104419.png>)

```js
// stores/accounts.js
import { useRouter } from 'vue-router'

export const useAccountStore = defineStore('account', () => {
  const router = useRouter()
  const token = ref(null)

  const logIn = function (payload) {
    const { username, password } = payload

    axios({
      method: 'post',
      url: `${API_URL}/accounts/login/`,
      data: { username, password },
    })
      .then((response) => {
        token.value = response.data.key

        // 로그인 성공 후 게시글 목록 페이지로 이동한다.
        router.push({ name: 'ArticleView' })
      })
      .catch((error) => {
        console.log(error)
      })
  }

  return { token, logIn }
}, { persist: true })
```

이때 `router.push()`는 페이지 이동 기록을 남긴다. 로그인 후 이전 페이지로 돌아가도 되는지에 따라 `push()`와 `replace()` 중 어떤 것을 사용할지 판단할 수 있다.

---

## 3.5 인증이 필요한 요청에 token 추가하기

token을 저장했다면 이제 실제 API 요청에 사용해야 한다. 이번 강의에서 token이 필요한 요청은 크게 두 가지다.

1. 게시글 전체 목록 조회
2. 게시글 생성

서버에서 해당 API에 인증 permission을 걸어두었다면, Vue는 요청 header에 token을 포함해야 한다.

### 3.5.1 게시글 전체 목록 조회 with token

게시글 전체 목록을 가져오는 `getArticles` 함수에 token을 추가한다.

![게시글 전체 목록 조회 요청 함수에 Authorization header 추가](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104525.png>)

```js
// stores/articles.js 또는 관련 article store
import { useAccountStore } from '@/stores/accounts'

const getArticles = function () {
  const accountStore = useAccountStore()

  axios({
    method: 'get',
    url: `${API_URL}/api/v1/articles/`,
    headers: {
      // DRF TokenAuthentication은 Token 다음에 실제 토큰 값을 붙인다.
      Authorization: `Token ${accountStore.token}`,
    },
  })
    .then((response) => {
      articles.value = response.data
    })
    .catch((error) => {
      console.log(error)
    })
}
```

여기서 `Authorization`의 값은 단순히 token 문자열만 보내는 것이 아니라 `Token ${token}` 형식이어야 한다. DRF의 TokenAuthentication은 이 접두어를 기준으로 인증 정보를 해석한다.

⚠️ 주의: `Authorization: token`처럼 token 값만 보내면 DRF가 인증 정보를 올바르게 해석하지 못할 수 있다. 반드시 `Token` 접두어와 공백을 포함해 `Token abc123...` 형식으로 작성해야 한다.

### 3.5.2 게시글 생성 with token

게시글 작성도 인증된 사용자만 가능하도록 구성되어 있다면 create 요청에도 token이 필요하다.

![게시글 생성 요청 함수에 Authorization header 추가](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104614.png>)

```js
const createArticle = function (payload) {
  const accountStore = useAccountStore()

  axios({
    method: 'post',
    url: `${API_URL}/api/v1/articles/`,
    data: payload,
    headers: {
      Authorization: `Token ${accountStore.token}`,
    },
  })
    .then((response) => {
      console.log('게시글 생성 성공')
      console.log(response.data)
    })
    .catch((error) => {
      console.log(error)
    })
}
```

게시글 생성 요청에서 token이 필요한 이유는 서버가 “누가 작성한 글인가”를 알아야 하기 때문이다. 백엔드에서 serializer의 `save(user=request.user)` 같은 방식으로 작성자를 저장한다면, request.user가 정상적으로 채워지려면 인증 token이 반드시 필요하다.

---

## 3.6 computed로 로그인 상태 관리하기

지금까지는 token을 저장하고 요청에 사용하는 흐름을 만들었다. 이제 이 token을 기준으로 사용자가 로그인했는지 판단하는 값이 필요하다.

가장 단순한 기준은 다음과 같다.

```text
token이 있으면 로그인 상태
token이 없으면 비로그인 상태
```

이 값을 매번 직접 계산하면 코드가 지저분해진다. 그래서 `computed`를 사용해 `isLogin`이라는 계산된 상태를 만든다.

![token 소유 여부에 따라 로그인 상태를 나타내는 isLogin computed 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104804.png>)

```js
// stores/accounts.js
import { ref, computed } from 'vue'

export const useAccountStore = defineStore('account', () => {
  const token = ref(null)

  // token 값이 바뀔 때만 로그인 상태를 다시 계산한다.
  const isLogin = computed(() => {
    return token.value ? true : false
  })

  return { token, isLogin }
}, { persist: true })
```

`computed`는 원본 데이터가 바뀔 때만 값을 다시 계산하는 ref라고 볼 수 있다. 여기서는 원본 데이터가 `token`이고, 계산된 값이 `isLogin`이다.

`isLogin`을 만들어두면 템플릿과 라우터 가드에서 모두 쉽게 사용할 수 있다.

```vue
<template>
  <!-- 로그인 상태일 때만 로그아웃 버튼을 보여준다. -->
  <form v-if="accountStore.isLogin" @submit.prevent="logOut">
    <input type="submit" value="Logout">
  </form>

  <!-- 비로그인 상태일 때만 로그인/회원가입 링크를 보여준다. -->
  <RouterLink v-if="!accountStore.isLogin" :to="{ name: 'LogInView' }">
    LogInPage
  </RouterLink>
</template>
```

📌 핵심: 로그인 여부는 별도의 boolean을 수동으로 관리하기보다, token 유무에서 계산하는 편이 흐름이 단순하다.

---

## 3.7 Navigation Guard로 접근 제어하기

로그인 상태를 계산할 수 있게 되었으므로, 이제 페이지 접근을 제어할 수 있다. 이번 강의에서 구현하는 접근 제어는 두 가지다.

1. 인증되지 않은 사용자는 메인 페이지에 접근하지 못한다.
2. 인증된 사용자는 회원가입 페이지와 로그인 페이지에 접근하지 못한다.

이 로직은 개별 컴포넌트 안에서 처리할 수도 있지만, 페이지 진입 전에 막는 것이 더 자연스럽다. 그래서 Vue Router의 전역 네비게이션 가드인 `beforeEach`를 사용한다.

### 3.7.1 비로그인 사용자의 메인 페이지 접근 제한

`beforeEach`는 모든 페이지 이동 직전에 실행된다. 이동하려는 페이지가 보호된 페이지이고, 사용자가 로그인하지 않았다면 로그인 페이지로 redirect할 수 있다.

![beforeEach를 사용해 비로그인 사용자의 보호 페이지 접근 제한](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 104923.png>)

```js
// router/index.js
import { useAccountStore } from '@/stores/accounts'

router.beforeEach((to, from) => {
  const accountStore = useAccountStore()

  // 게시글 목록 페이지를 보호된 페이지라고 가정한다.
  if (to.name === 'ArticleView' && !accountStore.isLogin) {
    window.alert('로그인이 필요합니다.')

    // 로그인 페이지로 이동시킨다.
    return { name: 'LogInView' }
  }
})
```

브라우저 localStorage에서 token을 삭제한 뒤 메인 페이지에 접속하면, 로그인 페이지로 이동하는 것을 확인할 수 있다.

![localStorage에서 token 삭제 후 메인 페이지 접근 시 로그인 페이지로 이동](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 105005.png>)

localStorage는 브라우저를 껐다 켜도 데이터가 사라지지 않는 저장 공간이다. persisted state를 사용할 경우 Pinia store의 token이 localStorage에 저장될 수 있다. 따라서 로그인 상태 테스트를 할 때는 localStorage의 token 존재 여부도 함께 확인해야 한다.

⚠️ 주의: token을 삭제했는데도 화면이 로그인 상태처럼 보인다면 store 상태와 localStorage 상태가 서로 맞지 않을 수 있다. 테스트할 때는 localStorage를 삭제한 뒤 새로고침하여 상태가 다시 계산되는지 확인하는 것이 좋다.

### 3.7.2 로그인 사용자의 회원가입/로그인 페이지 접근 제한

이미 로그인한 사용자가 다시 회원가입이나 로그인 페이지에 들어가는 것은 자연스럽지 않다. 따라서 인증된 사용자가 해당 페이지로 이동하려 하면 메인 페이지로 보내준다.

![인증된 사용자의 회원가입 및 로그인 페이지 접근 제한](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 105117.png>)

```js
router.beforeEach((to, from) => {
  const accountStore = useAccountStore()

  // 로그인이 필요한 페이지 접근 제한
  if (to.name === 'ArticleView' && !accountStore.isLogin) {
    window.alert('로그인이 필요합니다.')
    return { name: 'LogInView' }
  }

  // 이미 로그인한 사용자는 회원가입/로그인 페이지에 들어가지 않게 한다.
  if ((to.name === 'SignUpView' || to.name === 'LogInView') && accountStore.isLogin) {
    window.alert('이미 로그인 되어 있습니다.')
    return { name: 'ArticleView' }
  }
})
```

로그인 후 회원가입 페이지나 로그인 페이지 접속을 시도하면 메인 페이지로 이동하는 것을 확인할 수 있다.

![로그인 후 회원가입 및 로그인 페이지 접근 시도 결과](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 105207.png>)

⚠️ 주의: Navigation Guard를 작성할 때 redirect 조건이 잘못되면 무한 redirect가 발생할 수 있다. 예를 들어 로그인 페이지로 보내는 로직이 로그인 페이지 진입까지 막아버리면 계속 같은 페이지로 보내려는 문제가 생긴다. 조건을 작성할 때 `to.name`을 기준으로 예외 페이지를 명확히 구분해야 한다.

---

## 3.8 User Model 커스터마이징하기

기본 회원가입 흐름이 완성되면, 실제 프로젝트에서는 사용자 정보를 더 저장하고 싶어진다. 예를 들어 나이, 닉네임, 프로필 이미지, 관심사 같은 정보가 필요할 수 있다.

이번 강의에서는 사용자 나이를 저장하기 위해 User Model에 `age` 필드를 추가한다. 여기서 중요한 점은 프론트엔드와 백엔드가 함께 바뀌어야 한다는 것이다.

단순히 Vue 회원가입 form에 `age` input을 추가하고 서버로 보내는 것만으로는 부족하다. Django의 User Model에 필드가 있어야 하고, dj-rest-auth의 회원가입 Serializer도 해당 필드를 받아 저장할 수 있어야 한다.

### 3.8.1 User Model에 age 필드 추가

먼저 Django의 사용자 모델에 `age` 필드를 추가한다. 강의에서는 음수가 될 수 없는 숫자를 저장하기 위해 `PositiveIntegerField`를 사용한다.

![User Model에 age 필드 추가](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 105619.png>)

```python
# accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # 나이는 음수가 될 수 없으므로 PositiveIntegerField를 사용한다.
    # 기존 사용자나 테스트 상황을 고려해 null=True, blank=True를 줄 수 있다.
    age = models.PositiveIntegerField(null=True, blank=True)
```

모델을 수정했다면 migration을 다시 진행해야 한다.

```bash
python manage.py makemigrations
python manage.py migrate
```

DB를 초기화한 상황이라면 `db.sqlite3` 삭제 후 migration과 관리자 계정 생성까지 다시 진행한다. 강의에서도 기존 fixtures 데이터는 user 정보가 없으므로 그대로 사용할 수 없다는 점을 사전 준비로 언급한다.

⚠️ 주의: 커스텀 User Model은 프로젝트 초기에 설정하는 것이 가장 안전하다. 이미 migration이 많이 진행된 프로젝트에서 User Model을 바꾸면 DB와 migration이 꼬일 수 있다. 실습에서는 DB 초기화를 통해 흐름을 맞춘다.

### 3.8.2 Vue 회원가입 form에 age 추가

백엔드 모델에 age 필드를 추가했으면, Vue의 회원가입 화면에서도 age를 입력받아야 한다.

![Vue 회원가입 form에 age input과 반응형 변수 추가](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 105746.png>)

```vue
<script setup>
const username = ref(null)
const password1 = ref(null)
const password2 = ref(null)
const age = ref(null)

const signUp = function () {
  const payload = {
    username: username.value,
    password1: password1.value,
    password2: password2.value,
    age: age.value,
  }

  store.signUp(payload)
}
</script>

<template>
  <form @submit.prevent="signUp">
    <div>
      <label for="username">username : </label>
      <input type="text" id="username" v-model.trim="username">
    </div>

    <div>
      <label for="password1">password : </label>
      <input type="password" id="password1" v-model.trim="password1">
    </div>

    <div>
      <label for="password2">password confirmation : </label>
      <input type="password" id="password2" v-model.trim="password2">
    </div>

    <div>
      <label for="age">age : </label>
      <input type="number" id="age" v-model.number="age">
    </div>

    <input type="submit" value="SignUp">
  </form>
</template>
```

여기서 `payload data`는 header나 metadata가 아니라, 실제 요청의 목적이 되는 본문 데이터를 의미한다. 회원가입에서는 `username`, `password1`, `password2`, `age`가 payload에 해당한다.

### 3.8.3 store의 signUp 함수에 age 포함하기

컴포넌트에서 age를 payload에 넣었다면, store의 `signUp` 함수에서도 이 값을 서버로 보내야 한다.

![store의 signUp 함수에 age 정보 추가](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 105815.png>)

```js
const signUp = function (payload) {
  const { username, password1, password2, age } = payload

  axios({
    method: 'post',
    url: `${API_URL}/accounts/signup/`,
    data: {
      username,
      password1,
      password2,
      age,
    },
  })
    .then((response) => {
      console.log('회원가입 성공')
      console.log(response.data)
    })
    .catch((error) => {
      console.log(error)
    })
}
```

이제 Vue는 age를 서버로 보낸다. 하지만 여기서 중요한 문제가 발생한다.

---

## 3.9 age를 보냈는데 DB에 저장되지 않는 이유

회원가입 요청을 보내고 응답을 확인하면, 요청 자체는 성공할 수 있다.

![age를 포함해 회원가입 요청을 보낸 뒤 응답 결과 확인](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 105849.png>)

하지만 Django DB를 확인하면 새 유저는 생성되었는데 age 정보가 저장되지 않은 것을 볼 수 있다.

![요청한 username은 생성되었지만 age 정보가 누락된 모습](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 105920.png>)

이 현상은 Vue 코드가 틀렸기 때문이 아니라, 서버의 회원가입 Serializer가 age 필드를 처리하지 않았기 때문에 발생한다. dj-rest-auth의 기본 `RegisterSerializer`는 기본적으로 `username`, `email`, `password1`, `password2` 정도만 알고 있다. 따라서 age가 요청 body에 들어와도 serializer가 이 값을 꺼내 저장하지 않으면 DB에는 반영되지 않는다.

기본 `RegisterSerializer`의 field 정보를 확인하면, age가 포함되어 있지 않다는 점을 알 수 있다.

![dj-rest-auth RegisterSerializer의 기본 field 정보 확인](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 110025.png>)

📌 핵심: 프론트엔드에서 데이터를 보낸다고 해서 백엔드가 자동으로 저장하는 것은 아니다. 서버의 serializer가 해당 필드를 받아 검증하고 저장하는 코드가 있어야 한다.

---

## 3.10 CustomRegisterSerializer 작성하기

이제 dj-rest-auth의 기본 `RegisterSerializer`를 상속하여 커스텀 serializer를 만든다. 목적은 회원가입 요청에서 age를 함께 받고, 유효성 검사와 저장 과정에 age를 포함시키는 것이다.

### 3.10.1 age 필드를 추가한 CustomRegisterSerializer

먼저 `accounts/serializers.py`에 `CustomRegisterSerializer`를 작성한다. `RegisterSerializer`를 상속하면 기존 회원가입 동작은 유지하면서 필요한 필드만 추가할 수 있다.

![RegisterSerializer를 상속한 CustomRegisterSerializer에 age 필드 추가](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 110137.png>)

```python
# accounts/serializers.py
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

class CustomRegisterSerializer(RegisterSerializer):
    # 회원가입 요청에서 age 값을 받을 수 있도록 필드를 추가한다.
    age = serializers.IntegerField(required=False)
```

필드만 추가하면 요청에서 age를 받을 수는 있지만, 실제 저장까지 보장되지는 않는다. 따라서 다음 단계에서 `get_cleaned_data()`와 `save()`를 수정한다.

### 3.10.2 get_cleaned_data()에 추가 필드 반영하기

`get_cleaned_data()`는 입력 받은 데이터의 유효성 검사 결과를 객체 형태로 정리해 반환하는 역할을 한다. 기존 serializer는 username, email, password 등을 cleaned data로 만들지만, 새로 추가한 age는 직접 포함시켜야 한다.

![get_cleaned_data 함수 구조 확인](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 114640.png>)

강의에서는 `super()`를 사용해 기존 필드에 대한 처리를 먼저 수행한 뒤, age만 추가로 반영하는 방식으로 작성한다.

![super를 사용해 기존 cleaned data에 age를 추가하는 흐름](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 114719.png>)

```python
class CustomRegisterSerializer(RegisterSerializer):
    age = serializers.IntegerField(required=False)

    def get_cleaned_data(self):
        # 부모 RegisterSerializer가 처리하던 기본 필드들을 먼저 가져온다.
        data = super().get_cleaned_data()

        # 새로 추가한 age 필드를 cleaned data에 포함한다.
        data['age'] = self.validated_data.get('age', '')

        return data
```

`super()`를 쓰는 이유는 기존 회원가입 로직을 직접 다시 작성하지 않기 위해서다. 이미 잘 작동하는 username, email, password 처리 로직은 부모 클래스에 맡기고, 우리가 추가한 필드만 보완한다.

⚠️ 주의: `get_cleaned_data()`에서 age를 반환하지 않으면, 뒤의 `save()`에서 age를 저장하려 해도 사용할 값이 없을 수 있다. 커스텀 필드는 “필드 선언 → cleaned data 반영 → save 반영” 흐름이 함께 맞아야 한다.

### 3.10.3 save()에서 User 객체에 age 저장하기

`save()`는 실제 User 객체를 생성하거나 저장하는 단계다. `super().save(request)`를 호출하면 기본 회원가입 저장 로직이 수행되고, 이후 반환된 user 객체에 age를 넣어 저장한다.

![save 함수에서 커스텀 필드를 저장하는 흐름](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 114837.png>)

```python
class CustomRegisterSerializer(RegisterSerializer):
    age = serializers.IntegerField(required=False)

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data['age'] = self.validated_data.get('age', '')
        return data

    def save(self, request):
        # 기본 회원가입 로직을 먼저 수행해 user 객체를 만든다.
        user = super().save(request)

        # cleaned_data에서 age를 꺼내 user 객체에 저장한다.
        user.age = self.cleaned_data.get('age')
        user.save()

        return user
```

이 코드에서 핵심은 `user = super().save(request)`이다. 부모 클래스의 저장 로직을 먼저 실행해야 username, password 처리 등 기본 회원가입 기능이 유지된다. 그 후 우리가 추가한 age 필드만 user 객체에 넣는다.

### 3.10.4 settings.py에 CustomRegisterSerializer 등록하기

Serializer를 만들었다고 해서 dj-rest-auth가 자동으로 사용하는 것은 아니다. settings.py에서 회원가입 serializer를 커스텀 serializer로 바꾸도록 설정해야 한다.

![settings.py에서 CustomRegisterSerializer 사용 설정](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 114937.png>)

```python
# settings.py
REST_AUTH = {
    'REGISTER_SERIALIZER': 'accounts.serializers.CustomRegisterSerializer',
}
```

프로젝트나 dj-rest-auth 버전에 따라 설정 키 이름이 다르게 안내되는 경우가 있을 수 있다. 강의 흐름에서는 `REST_AUTH` 설정 안에서 `REGISTER_SERIALIZER`를 지정하는 방식으로 정리하면 된다.

⚠️ 주의: serializer 파일을 작성했는데도 age가 계속 저장되지 않는다면 settings.py에서 커스텀 serializer 경로가 정확한지 확인해야 한다. 오타가 있거나 앱 이름이 다르면 dj-rest-auth가 여전히 기본 serializer를 사용할 수 있다.

### 3.10.5 회원가입 요청 결과 확인

설정을 마친 뒤 다시 회원가입 요청을 보내면, 이전과 달리 age 정보가 정상적으로 저장되는 것을 확인할 수 있다.

![커스텀 serializer 적용 후 age 정보가 정상 저장된 모습](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 115016.png>)

이 흐름은 age뿐 아니라 다른 사용자 정보에도 똑같이 적용할 수 있다. 예를 들어 nickname을 추가하려면 User Model에 nickname 필드를 만들고, Vue form과 payload에 nickname을 추가한 뒤, CustomRegisterSerializer에서 필드 선언, cleaned data 반영, save 저장을 맞추면 된다.

---

## 3.11 로그아웃 구현하기

로그인 기능이 있으면 로그아웃 기능도 필요하다. 로그아웃은 서버에 로그아웃 요청을 보내고, 프론트엔드에 저장된 token을 제거하는 흐름으로 이해하면 된다.

### 3.11.1 store의 logOut 함수 작성

로그아웃 요청도 인증이 필요한 요청이다. 따라서 현재 token을 Authorization header에 담아 `/accounts/logout/`으로 요청을 보낸다.

![store에 logOut 함수 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 115048.png>)

```js
// stores/accounts.js
const logOut = function () {
  axios({
    method: 'post',
    url: `${API_URL}/accounts/logout/`,
    headers: {
      Authorization: `Token ${token.value}`,
    },
  })
    .then((response) => {
      // 서버 로그아웃 요청이 성공하면 store의 token을 삭제한다.
      token.value = null

      // 필요하다면 로그인 페이지나 메인 페이지로 이동시킨다.
      router.push({ name: 'LogInView' })
    })
    .catch((error) => {
      console.log(error)
    })
}
```

로그아웃에서 중요한 것은 서버 요청만 보내는 것이 아니다. 프론트엔드 store에 남아 있는 token도 삭제해야 한다. 그렇지 않으면 화면에서는 여전히 로그인 상태로 판단할 수 있다.

### 3.11.2 App.vue에 로그아웃 form 작성

사용자가 로그아웃할 수 있도록 App 컴포넌트에 로그아웃 form을 추가한다.

![App 컴포넌트에 로그아웃 form 요소 작성](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 115112.png>)

```vue
<!-- App.vue -->
<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { useAccountStore } from '@/stores/accounts'

const accountStore = useAccountStore()

const logOut = function () {
  accountStore.logOut()
}
</script>

<template>
  <header>
    <nav>
      <RouterLink :to="{ name: 'ArticleView' }">Articles</RouterLink>
      <RouterLink v-if="!accountStore.isLogin" :to="{ name: 'SignUpView' }">SignUpPage</RouterLink>
      <RouterLink v-if="!accountStore.isLogin" :to="{ name: 'LogInView' }">LogInPage</RouterLink>

      <!-- 로그인 상태일 때만 로그아웃 버튼을 보여준다. -->
      <form v-if="accountStore.isLogin" @submit.prevent="logOut">
        <input type="submit" value="Logout">
      </form>
    </nav>
  </header>

  <RouterView />
</template>
```

⚠️ 주의: 로그아웃 버튼을 항상 보여주면 비로그인 상태에서도 로그아웃 요청을 보낼 수 있다. `isLogin`을 이용해 로그인 상태일 때만 버튼을 보여주는 편이 자연스럽다.

---

## 3.12 회원가입 성공 후 자동 로그인하기

회원가입이 성공하면 사용자가 다시 로그인 화면으로 가서 같은 정보를 입력하게 만들 수도 있지만, 서비스 흐름상 회원가입 직후 자동으로 로그인시키는 편이 더 자연스럽다.

강의에서는 회원가입 성공 후 `logIn` 함수를 호출하는 방식으로 자동 로그인을 구현한다.

![회원가입 성공 후 자동으로 로그인까지 진행하는 흐름](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 115240.png>)

```js
const signUp = function (payload) {
  const { username, password1, password2, age } = payload

  axios({
    method: 'post',
    url: `${API_URL}/accounts/signup/`,
    data: {
      username,
      password1,
      password2,
      age,
    },
  })
    .then((response) => {
      // 회원가입에 사용한 password1을 로그인 요청의 password로 사용한다.
      const password = password1

      // 회원가입 성공 후 바로 로그인 요청을 보낸다.
      logIn({ username, password })
    })
    .catch((error) => {
      console.log(error)
    })
}
```

여기서 `password1`과 `password2` 중 로그인에 사용할 값은 `password1`이다. `password2`는 비밀번호 확인용이므로 로그인 API가 요구하는 필드명인 `password`로 다시 맞춰 전달한다.

⚠️ 주의: 자동 로그인 흐름에서 `logIn({ username, password1 })`처럼 보내면 로그인 API가 요구하는 field 이름과 맞지 않을 수 있다. 로그인 API는 보통 `username`, `password`를 요구하므로 payload 이름을 맞춰야 한다.

---

## 3.13 Django Signals

강의 후반부에서는 Django Signals도 소개한다. Signals는 Django 애플리케이션 안에서 특정 이벤트가 발생했을 때 다른 부분에 신호를 보내 추가 로직을 실행할 수 있게 하는 이벤트 알림 시스템이다.

![Django Signals 개념과 활용 예시](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 115413.png>)

예를 들어 사용자가 새로운 게시글을 작성했을 때 이메일 알림을 보내거나, 특정 모델이 저장된 직후 로그를 남기는 작업을 Signals로 처리할 수 있다.

```python
# 예시: 모델 저장 후 특정 작업 실행
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Article

@receiver(post_save, sender=Article)
def after_article_created(sender, instance, created, **kwargs):
    if created:
        # 새 게시글이 생성되었을 때 실행할 로직
        print(f'새 게시글 생성: {instance.title}')
```

다만 Signals는 흐름이 눈에 잘 보이지 않을 수 있다. 어디선가 저장이 일어났을 때 다른 파일의 함수가 자동 실행되기 때문에, 프로젝트가 커지면 디버깅이 어려워질 수 있다. 따라서 단순한 로직은 view나 serializer 안에서 명시적으로 처리하고, 여러 곳에서 공통으로 반응해야 하는 이벤트성 작업에 Signals를 사용하는 것이 좋다.

---

## 3.14 Vite 환경 변수 사용하기

환경 변수는 애플리케이션의 설정이나 동작을 제어하기 위해 사용하는 변수다. API 서버 주소, API key, 배포 환경별 설정처럼 코드에 직접 박아두기 애매한 값을 관리할 때 사용한다.

Vue 프로젝트에서는 Vite를 사용하므로 `.env.local` 파일에 환경 변수를 작성할 수 있다.

![Vite에서 .env.local 파일로 환경 변수 사용하는 방법](<../assets/images/06_11_Vue_with_DRF_03_Customize_User/화면 캡처 2026-06-11 130228.png>)

```text
# .env.local
VITE_API_URL=http://127.0.0.1:8000
```

Vite에서 환경 변수를 사용할 때는 반드시 변수명 앞에 `VITE_` 접두어를 붙여야 한다. 그렇지 않으면 클라이언트 코드에서 접근할 수 없다.

```js
// stores/accounts.js
const API_URL = import.meta.env.VITE_API_URL
```

환경 변수를 사용하면 개발 서버와 배포 서버의 주소를 쉽게 바꿀 수 있다. 예를 들어 개발 중에는 `http://127.0.0.1:8000`을 사용하고, 배포 후에는 실제 서버 주소로 바꿔도 코드 전체를 수정할 필요가 없다.

⚠️ 주의: `.env.local` 파일을 수정한 뒤에는 Vite 개발 서버를 재시작해야 반영되는 경우가 많다. 또한 변수명과 값 사이에 공백을 넣지 않는 것이 안전하다.

---

## 3.15 Vue 프로젝트 진행 시 참고할 자료와 설치 라이브러리

이번 강의의 마지막에는 Vue 프로젝트를 진행할 때 참고할 만한 자료와 설치한 라이브러리를 정리한다.

### 3.15.1 참고 자료

Vue 생태계에는 다양한 라이브러리와 참고 자료가 있다. 강의에서는 Vue 관련 유용한 자료를 모아둔 Awesome Vue와 UI 라이브러리인 Vuetify를 언급한다.

| 자료 | 설명 |
|---|---|
| Awesome Vue.js | Vue와 관련된 유용한 자료, 라이브러리, 예제를 모아둔 저장소 |
| Vuetify | Vue를 위한 UI 컴포넌트 라이브러리. Bootstrap처럼 미리 만들어진 UI 구성 요소를 사용할 수 있다. |

### 3.15.2 설치한 라이브러리 정리

이번 Vue + DRF 흐름에서는 여러 라이브러리가 함께 사용된다.

| 라이브러리 | 역할 |
|---|---|
| `pinia-plugin-persistedstate` | Pinia 상태를 localStorage에 자동으로 저장해 새로고침 후에도 유지한다. |
| `axios` | Vue에서 Django 서버로 HTTP 요청을 보내기 위해 사용한다. |
| `djangorestframework` | Django로 REST API를 만들기 위한 핵심 프레임워크다. |
| `django-cors-headers` | 서로 다른 출처의 Vue와 Django 서버가 통신할 수 있도록 CORS 헤더를 처리한다. |
| `dj-rest-auth` | 로그인, 로그아웃, 비밀번호 변경 등 인증 기능을 API 엔드포인트로 제공한다. |
| `dj-rest-auth[with-social]` | dj-rest-auth와 함께 django-allauth 기반 회원가입/소셜 인증 기능을 구성할 때 사용한다. |

이 라이브러리들은 각각 따로 존재하는 것처럼 보이지만, 실제 프로젝트에서는 하나의 인증 흐름 안에서 함께 작동한다. Vue는 axios로 요청을 보내고, Pinia는 token을 저장하며, DRF와 dj-rest-auth는 인증 API를 제공하고, CORS 설정은 프론트엔드와 백엔드가 서로 통신할 수 있게 해준다.

---

## 4. 적용 관점에서 다시 보기

이번 강의 내용은 Vue와 DRF를 연결한 실습 프로젝트에서 인증을 구현할 때 그대로 적용된다. 핵심은 “로그인했다”는 상태를 화면에서만 판단하지 않고, 서버가 발급한 token을 기준으로 관리하는 것이다.

먼저 회원가입과 로그인 화면을 만들 때는 route 등록, App의 RouterLink, View 컴포넌트의 form, ref와 v-model, store 함수 호출 순서로 구현하면 된다. 화면에서 입력을 받고, 컴포넌트가 payload를 만든 뒤, store가 axios 요청을 보내는 역할 분리가 중요하다.

로그인 요청이 성공하면 응답으로 받은 token을 Pinia store에 저장한다. 이후 게시글 목록 조회나 게시글 생성처럼 인증이 필요한 요청에서는 `Authorization: Token ${token}` 형식의 header를 반드시 포함해야 한다. 인증 오류가 발생하면 Network 탭에서 status code와 request headers를 먼저 확인하는 습관이 필요하다.

로그인 상태는 token 유무를 기준으로 `computed`로 관리하면 좋다. 이 값을 사용하면 App에서 로그인/회원가입 링크를 숨기거나, 로그아웃 버튼을 보여주는 화면 제어를 쉽게 할 수 있다. 또한 router의 `beforeEach`에서 비로그인 사용자의 보호 페이지 접근을 막고, 이미 로그인한 사용자의 로그인/회원가입 페이지 접근도 막을 수 있다.

커스텀 유저 필드를 추가할 때는 프론트엔드와 백엔드를 동시에 봐야 한다. Vue form에 input을 추가하고 payload에 넣는 것만으로는 부족하다. Django User Model에 필드를 추가하고 migration을 진행해야 하며, dj-rest-auth의 RegisterSerializer를 상속한 CustomRegisterSerializer에서 해당 필드를 선언하고, cleaned data와 save 과정에 반영해야 한다.

로그아웃은 서버 로그아웃 요청과 프론트엔드 token 삭제가 함께 이루어져야 한다. 서버 요청만 성공하고 store token이 남아 있으면 화면은 여전히 로그인 상태처럼 동작할 수 있다. 반대로 token만 지우고 서버 요청을 생략하면 서버 측 인증 토큰 관리와 맞지 않을 수 있다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

Vue에서 로그인 form을 만드는 것과 실제 인증을 완성하는 것은 다른 문제다. 인증의 핵심은 로그인 응답으로 받은 token을 저장하고, 인증이 필요한 요청마다 header에 담아 보내는 흐름에 있다.

또한 회원가입에서 추가 필드를 보내려면 Vue payload만 수정해서는 부족하다는 점이 중요하다. 서버의 User Model과 RegisterSerializer가 해당 필드를 알고 있어야 실제 DB에 저장된다.

### 5.2 앞으로 이어지는 연결점

이번 내용은 게시글 작성자 저장, 마이페이지, 프로필 수정, 좋아요, 댓글 작성, 팔로우 같은 기능으로 자연스럽게 이어진다. 대부분의 기능은 “현재 로그인한 사용자가 누구인가”를 알아야 하므로 token 인증 흐름이 기본 전제가 된다.

Navigation Guard는 이후 관리자 페이지 접근 제한, 비로그인 사용자의 작성 페이지 차단, 로그인 후 이전 페이지로 되돌리기 같은 UX 개선에도 활용할 수 있다. Pinia의 token 상태와 router guard를 함께 쓰는 구조를 익혀두면 프로젝트 전체 인증 설계를 잡기 쉬워진다.

### 5.3 더 파볼 만한 주제

이번 강의에서는 TokenAuthentication 기반 인증을 다뤘지만, 실제 서비스에서는 JWT 인증, refresh token, token 만료 처리, 자동 로그아웃, axios interceptor를 활용한 공통 header 설정까지 확장할 수 있다.

또한 커스텀 유저 모델을 더 깊게 다루려면 회원가입뿐 아니라 로그인 응답에 사용자 정보를 포함하는 방법, 프로필 조회/수정 API, serializer validation, password 변경 흐름까지 함께 살펴볼 만하다.

---

## 6. 요약 정리

📌 핵심

- DRF에서 인증이 필요한 API를 호출할 때 token을 보내지 않으면 `401 Unauthorized`가 발생한다.
- Vue에서는 로그인 요청 후 응답으로 받은 token을 Pinia store에 저장한다.
- 인증이 필요한 요청에는 `Authorization: Token ${token}` 형식의 header를 포함해야 한다.
- `computed`를 사용하면 token 유무를 기준으로 로그인 상태인 `isLogin`을 관리할 수 있다.
- Navigation Guard의 `beforeEach`를 사용하면 로그인 여부에 따라 페이지 접근을 제어할 수 있다.
- User Model에 `age` 필드를 추가해도, RegisterSerializer가 처리하지 않으면 회원가입 시 DB에 저장되지 않는다.
- `CustomRegisterSerializer`에서는 추가 필드 선언, `get_cleaned_data()`, `save()` 처리가 함께 필요하다.
- 로그아웃은 서버 요청과 store token 삭제를 함께 처리해야 한다.
- Vite 환경 변수는 `VITE_` 접두어가 있어야 클라이언트 코드에서 사용할 수 있다.

🧠 기억할 것

> 로그인 상태의 기준은 화면이 아니라 token이다.  
> token은 저장만 해서는 부족하고, 인증이 필요한 요청마다 header에 실어 보내야 한다.  
> 커스텀 회원가입 필드는 Vue form, payload, Django model, serializer 저장 로직이 모두 맞아야 한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. DRF에서 `401 Unauthorized`가 발생했을 때 가장 먼저 확인해야 할 요청 정보는 무엇인가?
2. dj-rest-auth 로그인 요청이 성공했을 때 Vue가 반드시 저장해야 하는 값은 무엇인가?
3. 인증이 필요한 axios 요청에서 `Authorization` header는 어떤 형식으로 작성해야 하는가?
4. Pinia store의 token을 새로고침 후에도 유지하려면 어떤 설정이나 플러그인이 필요한가?
5. `computed`로 `isLogin`을 만들 때 기준이 되는 원본 데이터는 무엇인가?
6. 로그인하지 않은 사용자가 메인 페이지에 접근하지 못하게 하려면 Vue Router의 어떤 기능을 사용할 수 있는가?
7. Vue에서 age를 payload에 포함했는데 DB에 저장되지 않는다면 백엔드에서 무엇을 확인해야 하는가?
8. `CustomRegisterSerializer`에서 `get_cleaned_data()`와 `save()`는 각각 어떤 역할을 하는가?
9. 로그아웃 구현 시 서버 요청 이후 프론트엔드에서 반드시 처리해야 하는 작업은 무엇인가?
10. Vite 환경 변수 이름 앞에 반드시 붙여야 하는 접두어는 무엇인가?
