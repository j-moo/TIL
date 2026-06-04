# Vue Router

- 🎯 글의 목표: Vue Router를 사용해 SPA에서 URL에 따라 컴포넌트를 전환하고, 동적 라우트·중첩 라우트·프로그래밍 방식 이동·네비게이션 가드까지 연결해서 이해한다.
- 🧩 핵심 키워드: Routing, SSR, CSR, SPA, Vue Router, RouterLink, RouterView, Named Routes, Dynamic Route Matching, Nested Routes, Programmatic Navigation, useRoute, useRouter, Navigation Guard, Lazy Loading
- ⭐ 중요도: ★★★★★  
  Vue 프로젝트에서 여러 화면을 구성하려면 반드시 필요한 핵심 개념이다. 특히 실습 프로젝트에서 로그인 페이지, 상세 페이지, 마이페이지, 게시글 목록·상세 화면을 만들 때 거의 매번 사용된다.
- 📝 한눈에 보는 내용:  
  이번 강의는 “SPA는 페이지가 하나인데 어떻게 여러 페이지처럼 보이게 만들까?”라는 질문에서 출발한다. 먼저 SSR과 CSR의 라우팅 차이를 비교하고, Vue Router의 기본 구조를 익힌 뒤, URL 파라미터를 사용하는 동적 라우팅과 부모-자식 URL 구조를 표현하는 중첩 라우팅으로 확장한다. 마지막에는 코드로 페이지를 이동시키는 방법과 특정 페이지 접근을 제어하는 네비게이션 가드를 정리한다.
- 🔗 관련 문제 / 주제: Vue 프로젝트 화면 전환, 로그인 접근 제한, 게시글 상세 페이지, 사용자 프로필 페이지, 관리자 페이지 권한 제어, SPA 배포

---

## 1. 들어가며

Vue로 만든 SPA는 기본적으로 하나의 HTML 페이지 위에서 동작한다. 화면은 계속 바뀌는 것처럼 보이지만, 실제로는 브라우저가 매번 새로운 HTML 문서를 서버에서 받아오는 방식이 아니다. 그래서 SPA에서는 “현재 어떤 화면을 보고 있는가”를 URL과 컴포넌트의 연결로 직접 관리해야 한다.

이 역할을 담당하는 도구가 **Vue Router**다. Vue Router는 사용자가 `/`, `/about`, `/user/1` 같은 주소로 이동했을 때 어떤 컴포넌트를 보여줄지 결정한다. 쉽게 말하면, URL과 Vue 컴포넌트 사이의 약속을 정리해두는 장치라고 볼 수 있다.

이번 강의는 단순히 링크를 만드는 것에서 끝나지 않는다. 처음에는 `RouterLink`와 `RouterView`로 기본 라우팅을 만들고, 이후에는 `name`으로 경로를 관리하는 Named Routes, `:id`처럼 URL 일부를 변수로 쓰는 동적 라우팅, 부모 화면 안에 자식 화면을 렌더링하는 중첩 라우팅으로 확장한다. 마지막에는 사용자의 로그인 여부나 이동 조건에 따라 페이지 접근을 막거나 다른 페이지로 보내는 Navigation Guard까지 다룬다.

---

## 2. 핵심 개념 정리

이번 강의의 큰 질문은 다음과 같다.

> SPA는 하나의 페이지로 동작하는데, 사용자는 어떻게 여러 페이지를 이동하는 것처럼 느낄 수 있을까?

이 질문에 답하려면 먼저 SSR과 CSR의 라우팅 방식 차이를 이해해야 한다. SSR에서는 서버가 URL에 맞는 HTML을 만들어 보내고, 브라우저는 새 HTML을 다시 로드한다. 반면 CSR에서는 브라우저 안의 JavaScript가 URL 변화를 감지하고, 필요한 컴포넌트만 바꿔 렌더링한다.

Vue Router는 바로 이 CSR 방식의 화면 전환을 Vue 프로젝트 안에서 쉽게 구현하게 해준다. 기본 흐름은 단순하다.

1. `router/index.js`에 URL과 컴포넌트의 연결 정보를 작성한다.
2. `App.vue`에서 `RouterLink`로 이동 링크를 만든다.
3. `RouterView` 위치에 현재 URL과 일치하는 컴포넌트가 렌더링된다.

이 기본 구조를 이해한 뒤에는 경로를 직접 쓰는 방식의 한계를 줄이기 위해 Named Routes를 사용하고, `/user/1`, `/user/2`처럼 패턴은 같고 값만 다른 주소를 처리하기 위해 Dynamic Route Matching을 사용한다. 더 나아가 `/user/1/profile`, `/user/1/posts`처럼 부모 페이지 내부의 하위 화면을 바꾸고 싶을 때는 Nested Routes를 사용한다.

라우팅을 단순히 링크 클릭으로만 처리하지 않을 때도 있다. 로그인 후 자동으로 홈으로 보내거나, 버튼 클릭 후 특정 상세 페이지로 이동시키는 경우에는 `useRouter()`와 `router.push()` 같은 Programmatic Navigation을 사용한다. 또, 로그인하지 않은 사용자가 마이페이지에 접근하지 못하게 하려면 Navigation Guard를 사용해 라우팅을 제어한다.

---

## 3. 본문 정리

## 3.1 Routing의 의미

라우팅은 사용자가 접속한 URL 주소에 따라 적절한 페이지 또는 컴포넌트를 보여주는 과정이다. Vue Router를 배우기 전에 먼저 “라우팅이 왜 필요한가”를 잡아두면 뒤의 개념들이 훨씬 자연스럽게 이어진다.

강의에서는 Routing을 다음처럼 설명한다.

> Routing은 네트워크에서 경로를 선택하는 프로세스이며, 웹 애플리케이션에서는 사용자가 접속한 URL 주소에 따라 적절한 페이지 또는 컴포넌트를 보여주는 기능이다.

예를 들어 `/home` 주소는 Home 컴포넌트로, `/about` 주소는 About 컴포넌트로 연결할 수 있다. 이때 핵심은 URL이 단순한 문자열이 아니라, “어떤 화면을 보여줄지 결정하는 기준”이 된다는 점이다.

---

### 3.1.1 SSR에서의 Routing

SSR, 즉 Server Side Rendering에서는 라우팅이 서버에서 수행된다. 사용자가 어떤 URL로 접속하면 서버는 그 URL에 맞는 HTML 문서를 만들어 브라우저로 보낸다. 링크를 클릭할 때마다 브라우저는 서버로부터 새로운 HTML 응답을 받고, 화면 전체를 다시 로드한다.

```text
SSR: 서버에서 완성된 HTML 페이지를 만들어 브라우저에 보내는 방식
```

![SSR에서의 Routing](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 091032.png>)

위 그림은 SSR 방식에서 URL 이동이 서버 요청과 HTML 응답으로 이어지는 흐름을 보여준다. 사용자는 링크를 클릭하고, 브라우저는 서버에 새 페이지를 요청한다. 서버가 완성된 HTML을 다시 보내면 브라우저는 기존 화면을 새 화면으로 교체한다.

이 방식은 서버가 페이지를 완성해서 보내기 때문에 초기 HTML이 명확하다는 장점이 있다. 하지만 페이지를 이동할 때마다 전체 문서를 다시 받아야 하므로, SPA처럼 부드러운 화면 전환과는 차이가 있다.

---

### 3.1.2 CSR에서의 Routing

CSR, 즉 Client Side Rendering에서는 라우팅이 브라우저에서 수행된다. 서버는 기본 HTML과 JavaScript를 보내고, 이후에는 브라우저 안의 JavaScript가 URL 변화를 감지해 필요한 컴포넌트를 렌더링한다.

```text
CSR: 서버는 뼈대만 주고, 브라우저가 직접 페이지를 그리는 방식
```

![CSR에서의 Routing](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 091339.png>)

CSR에서는 페이지 이동이 발생해도 매번 전체 HTML을 새로 받지 않는다. 대신 현재 URL에 맞는 컴포넌트만 바꿔 보여준다. Vue Router는 Vue 애플리케이션 안에서 이 CSR 라우팅을 담당한다.

여기서 중요한 점은, CSR의 화면 전환은 실제 페이지 이동처럼 보이지만 브라우저 안에서 JavaScript가 컴포넌트를 교체하는 방식이라는 점이다. 이 차이를 알아야 `RouterLink`를 눌렀을 때 새로고침 없이 화면이 바뀌는 이유를 이해할 수 있다.

---

## 3.2 SPA에서 Routing이 필요한 이유

SPA는 Single Page Application의 약자다. 이름 그대로 하나의 페이지 안에서 동작하는 웹 애플리케이션이다. 하지만 사용자는 실제 서비스를 사용할 때 홈, 소개, 게시글 목록, 상세 페이지, 마이페이지처럼 여러 화면을 이동한다고 느낀다.

만약 SPA에 라우팅이 없다면 문제가 생긴다.

- URL을 통해 현재 화면 상태를 알 수 없다.
- 새로고침하면 항상 처음 화면으로 돌아갈 수 있다.
- 특정 화면의 링크를 다른 사람에게 공유하기 어렵다.
- 브라우저의 뒤로 가기와 앞으로 가기 기능을 자연스럽게 사용할 수 없다.

즉, SPA는 페이지는 하나이지만 주소에 따라 여러 컴포넌트를 새로 렌더링하여 여러 페이지처럼 보이도록 만들어야 한다.

> SPA는 하나의 페이지 안에서 내용만 바꿔가며 보여주는 웹 앱이다.  
> Vue Router는 이 “내용 교체”를 URL과 연결해주는 역할을 한다.

---

## 3.3 Vue Router

Vue Router는 Vue.js의 공식 라우팅 라이브러리다. Vue로 만든 SPA에서 페이지 이동 기능을 구현할 때 사용한다.

Vue Router에서 가장 먼저 기억해야 할 핵심 컴포넌트는 두 가지다.

| 구성 요소 | 역할 |
|---|---|
| `RouterLink` | 새로고침 없이 URL을 변경하는 링크를 만든다. 내부적으로 HTML의 `<a>` 태그처럼 렌더링된다. |
| `RouterView` | 현재 URL과 일치하는 컴포넌트를 화면에 표시하는 자리다. |

Vue Router는 “어떤 URL 경로에 어떤 컴포넌트를 보여줄지”만 정의해두면, 사용자가 링크를 클릭하거나 주소를 직접 입력했을 때 알맞은 컴포넌트를 연결해준다.

---

### 3.3.1 Vite 프로젝트 생성 시 Router 추가

Vue Router를 사용하려면 프로젝트 생성 단계에서 Router를 추가할 수 있다. Vite로 Vue 프로젝트를 만들 때 필요한 옵션을 선택하면 기본 Router 구조가 함께 생성된다.

![Vite 프로젝트 생성 시 Router 추가](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 125702.png>)

프로젝트를 생성한 뒤 서버를 실행하면 기본으로 생성된 Home, About 링크를 확인할 수 있다. 링크를 클릭하면 URL이 바뀌고, 그에 따라 화면에 렌더링되는 컴포넌트도 바뀐다.

![Router 적용 후 화면 전환 확인](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 125835.png>)

Vue 프로젝트 실행 흐름은 보통 다음과 같다.

```bash
# 1. Vue 프로젝트 생성
npm create vue@latest

# 2. 생성된 프로젝트 폴더로 이동
cd 프로젝트명

# 3. 필요한 패키지 설치
npm install

# 4. 개발 서버 실행
npm run dev
```

⚠️ 주의: Vite 프로젝트를 생성할 때 Router 옵션을 선택하지 않았다면 `router` 폴더와 `views` 폴더가 자동으로 생기지 않을 수 있다. 이 경우에는 `vue-router`를 직접 설치하고 설정해야 한다.

---

## 3.4 Vue Router를 추가했을 때 프로젝트 구조 변화

Router를 포함해 Vue 프로젝트를 만들면 기존 프로젝트와 비교해 몇 가지 구조가 달라진다.

1. `App.vue`에 `RouterLink`와 `RouterView`가 사용된다.
2. `router` 폴더가 새로 생성된다.
3. `views` 폴더가 새로 생성된다.

![Vue 프로젝트 구조 변화](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 125855.png>)

이 구조를 처음 보면 `components`와 `views`가 왜 나뉘는지 헷갈릴 수 있다. 기능적으로는 둘 다 Vue 컴포넌트 파일이다. 다만 일반적으로 `views`는 라우터에 직접 연결되는 페이지 단위 컴포넌트를 넣고, `components`는 그 페이지 안에서 재사용되는 작은 부품 컴포넌트를 넣는 식으로 구분한다.

---

### 3.4.1 App.vue의 RouterLink

`RouterLink`는 페이지를 다시 로드하지 않고 URL을 변경한다. HTML의 `<a>` 태그처럼 링크 역할을 하지만, Vue Router와 연결되어 새로고침 없이 컴포넌트를 전환할 수 있다.

![App.vue의 RouterLink](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 125916.png>)

기본 예시는 다음과 같다.

```vue
<script setup>
// RouterLink와 RouterView는 vue-router에서 제공하는 컴포넌트다.
// RouterLink는 이동 링크를 만들고, RouterView는 현재 경로의 컴포넌트를 보여준다.
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
    <nav>
      <!-- to 속성에는 이동할 URL 경로를 작성한다. -->
      <!-- 일반 a 태그와 달리 페이지 전체를 새로고침하지 않는다. -->
      <RouterLink to="/">Home</RouterLink>

      <!-- /about 경로로 이동하면 router/index.js에 연결된 AboutView가 렌더링된다. -->
      <RouterLink to="/about">About</RouterLink>
    </nav>
  </header>

  <!-- 현재 URL과 일치하는 컴포넌트가 이 위치에 표시된다. -->
  <RouterView />
</template>
```

이 코드에서 `RouterLink`는 “어디로 이동할지”를 담당하고, `RouterView`는 “그 결과 어떤 컴포넌트를 보여줄지”를 담당한다. 둘 중 하나만 있어서는 라우팅 화면 전환이 완성되지 않는다.

---

### 3.4.2 App.vue의 RouterView

`RouterView`는 현재 URL과 일치하는 컴포넌트를 표시하는 자리다. 원하는 위치에 배치할 수 있으므로, 상단 메뉴는 고정하고 본문 영역만 바꾸는 구조를 만들 수 있다.

![App.vue의 RouterView](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 125938.png>)

아래 그림은 `RouterLink`와 `RouterView`가 함께 동작하는 구조를 보여준다.

![RouterLink와 RouterView](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 125956.png>)

흐름을 문장으로 정리하면 다음과 같다.

1. 사용자가 `RouterLink`를 클릭한다.
2. Vue Router가 URL을 변경한다.
3. 변경된 URL과 일치하는 라우트 설정을 찾는다.
4. 해당 컴포넌트를 `RouterView` 위치에 렌더링한다.

📌 핵심: `RouterLink`는 이동을 만들고, `RouterView`는 이동 결과를 보여준다.

---

### 3.4.3 router/index.js

`router/index.js`는 라우팅과 관련된 정보 및 설정이 작성되는 파일이다. 웹 사이트의 여러 주소 목록을 작성하고, 각 주소로 접속했을 때 어떤 Vue 컴포넌트를 보여줄지 연결한다.

![router/index.js 구조](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130016.png>)

대표적인 구조는 다음과 같다.

```js
// createRouter: 라우터 인스턴스를 생성하는 함수
// createWebHistory: 브라우저의 history API를 사용하는 라우팅 방식
import { createRouter, createWebHistory } from 'vue-router'

// 라우터에 연결할 페이지 컴포넌트를 불러온다.
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'

// routes 배열에는 URL과 컴포넌트의 연결 정보를 작성한다.
const routes = [
  {
    // 사용자가 / 주소로 접근했을 때
    path: '/',

    // 이 라우트를 코드에서 부를 이름
    name: 'home',

    // RouterView 위치에 렌더링할 컴포넌트
    component: HomeView,
  },
  {
    // 사용자가 /about 주소로 접근했을 때
    path: '/about',

    // Named Routes에서 사용할 이름
    name: 'about',

    // AboutView 컴포넌트를 보여준다.
    component: AboutView,
  },
]

// 라우터 인스턴스를 생성한다.
const router = createRouter({
  // 브라우저 주소창의 history 기능을 사용한다.
  history: createWebHistory(import.meta.env.BASE_URL),

  // 위에서 작성한 라우트 목록을 등록한다.
  routes,
})

// main.js에서 사용할 수 있도록 router를 내보낸다.
export default router
```

프로젝트 규모가 작을 때는 `index.js` 하나에 모든 라우트 설정을 작성해도 충분하다. 하지만 프로젝트 규모가 커지면 기능별로 라우트 파일을 나누고, `index.js`에서 합치는 방식으로 관리할 수 있다.

⚠️ 주의: `path`는 실제 URL 주소이고, `component`는 해당 주소에서 보여줄 Vue 컴포넌트다. 처음에는 이 둘을 헷갈려서 `path`에 컴포넌트 이름을 쓰거나, `component`에 문자열을 쓰는 실수가 자주 나온다.

---

### 3.4.4 views 폴더

`views` 폴더는 `RouterView` 위치에 렌더링할 페이지 단위 컴포넌트를 배치하는 곳이다. 기능적으로는 `components` 폴더의 컴포넌트와 다르지 않지만, 역할을 구분하기 위해 따로 관리한다.

![views 폴더](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130054.png>)

일반적으로 다음처럼 구분한다.

| 폴더 | 주로 넣는 파일 |
|---|---|
| `views` | 라우터에 직접 연결되는 페이지 컴포넌트. 예: `HomeView.vue`, `AboutView.vue`, `UserView.vue` |
| `components` | 페이지 안에서 재사용되는 작은 컴포넌트. 예: `UserCard.vue`, `BaseButton.vue`, `NavBar.vue` |

> 일반 컴포넌트와 구분하기 위해 라우터에 연결되는 컴포넌트 이름은 `View`로 끝나도록 작성하는 것을 권장한다.

---

## 3.5 Basic Routing

Basic Routing은 Vue Router의 가장 기본 흐름이다. 핵심은 `router/index.js`에 경로를 등록하고, `RouterLink`로 해당 경로에 이동하며, `RouterView`에서 알맞은 컴포넌트를 보여주는 것이다.

강의에서 정리한 기본 동작 순서는 다음과 같다.

1. `index.js`에 라우터 관련 설정을 작성한다.
2. `RouterLink`에 `index.js`에서 정의한 주소 값을 작성한다.
3. `RouterLink` 클릭 시 경로와 일치하는 컴포넌트가 `RouterView`에서 렌더링된다.

---

### 3.5.1 라우팅 기본 동작 살펴보기

먼저 `router/index.js`에 주소, 이름, 컴포넌트를 연결한다.

![index.js에 라우터 설정 작성](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130144.png>)

그다음 `RouterLink`의 `to` 속성에 `index.js`에서 정의한 주소 값을 사용한다.

![RouterLink의 to 속성 사용](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130203.png>)

마지막으로 사용자가 링크를 클릭하면 경로와 일치하는 컴포넌트가 `RouterView` 위치에 렌더링된다.

![RouterView에 컴포넌트 렌더링](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130229.png>)

기본 흐름을 코드로 묶으면 다음과 같다.

```vue
<template>
  <nav>
    <!-- / 경로로 이동한다. -->
    <RouterLink to="/">Home</RouterLink>

    <!-- /about 경로로 이동한다. -->
    <RouterLink to="/about">About</RouterLink>
  </nav>

  <!-- 현재 주소가 /이면 HomeView, /about이면 AboutView가 표시된다. -->
  <RouterView />
</template>
```

여기서 중요한 점은 `RouterLink`의 `to` 값과 `router/index.js`의 `path` 값이 맞아야 한다는 것이다. `RouterLink to="/about"`이라고 작성했는데 라우터에는 `/about-us`로 등록되어 있다면 원하는 컴포넌트가 렌더링되지 않는다.

---

## 3.6 Named Routes

처음에는 `RouterLink`에 `/about`, `/user/1` 같은 실제 경로를 직접 작성해도 된다. 하지만 프로젝트가 커지면 같은 경로를 여러 파일에서 반복해서 사용하게 된다. 이때 URL 구조가 바뀌면 모든 파일을 찾아서 수정해야 한다.

예를 들어 현재 `/about`을 여러 곳에서 직접 사용하고 있는데, 나중에 경로를 `/about-us`로 바꾸면 관련된 모든 `RouterLink`를 수정해야 한다. 이런 방식은 유지보수에 불리하다.

![path 경로를 그대로 사용하는 방식](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130250.png>)

Named Routes는 이런 문제를 줄이기 위해 라우트에 `name`을 붙이고, 이동할 때 실제 URL 대신 그 이름을 사용하는 방식이다.

---

### 3.6.1 name으로 경로 관리하기

Named Routes는 라우트 설정 객체의 `name` 속성을 사용한다. 경로에 이름을 붙여두면, `RouterLink`에서 `to`에 객체를 전달해 해당 이름으로 이동할 수 있다.

![Named Routes 설정](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130313.png>)

```js
// router/index.js
const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
  },
]
```

```vue
<template>
  <nav>
    <!-- 문자열 경로를 직접 쓰는 방식 -->
    <RouterLink to="/about">About</RouterLink>

    <!-- name을 사용해 이동하는 방식 -->
    <!-- 객체를 전달해야 하므로 :to 형태로 v-bind를 사용한다. -->
    <RouterLink :to="{ name: 'about' }">About</RouterLink>
  </nav>
</template>
```

여기서 `:to`는 `v-bind:to`의 축약형이다. 단순 문자열이 아니라 JavaScript 객체를 전달해야 하므로 콜론을 붙인다.

```text
v-bind: HTML 속성을 Vue의 데이터 또는 JavaScript 표현식과 연결하는 문법
props 객체: 컴포넌트에 데이터를 전달할 때 사용하는 객체 형태의 값
```

Named Routes를 사용하면 URL이 바뀌어도 라우트 이름이 유지되는 한 링크 코드는 그대로 둘 수 있다.

```js
// 기존
{
  path: '/about',
  name: 'about',
  component: AboutView,
}

// 나중에 URL만 변경
{
  path: '/about-us',
  name: 'about',
  component: AboutView,
}
```

위처럼 변경해도 `:to="{ name: 'about' }"`로 작성한 링크는 계속 정상적으로 동작한다.

⚠️ 주의: `name`은 프로젝트 안에서 중복되지 않게 작성해야 한다. 같은 이름을 여러 라우트에 붙이면 어떤 경로로 이동해야 하는지 헷갈리는 문제가 생긴다.

📌 핵심: 실제 URL을 여러 곳에 직접 쓰기보다, 라우트에 이름을 붙이고 그 이름으로 이동하면 유지보수가 쉬워진다.

---

## 3.7 Dynamic Route Matching

서비스를 만들다 보면 패턴은 같고 값만 다른 URL이 자주 등장한다.

예를 들어 사용자 프로필 페이지를 생각해보면 다음과 같은 주소가 필요할 수 있다.

```text
/user/1
/user/2
/user/3
```

이때 사용자 수가 100명이라고 해서 라우트 설정을 100개 작성하면 관리하기 어렵다. 필요한 것은 “`/user/` 뒤에 어떤 값이 오든 UserView 컴포넌트로 연결하되, 그 값을 컴포넌트 안에서 사용할 수 있게 하는 것”이다.

이때 사용하는 개념이 **Dynamic Route Matching**이다.

---

### 3.7.1 동적 라우트 매칭의 의미

Dynamic Route Matching은 URL의 일부를 변수처럼 사용해 경로를 동적으로 매칭하는 기능이다.

```text
/user/1
/user/2
/user/100
```

위 주소들은 모두 `/user/:id`라는 하나의 패턴으로 처리할 수 있다. 여기서 `:id`는 실제 URL에 들어오는 값을 담는 매개변수다.

```js
{
  // :id 부분은 URL에서 변하는 값이다.
  path: '/user/:id',

  // 이 라우트의 이름
  name: 'user',

  // 모든 사용자 상세 화면은 UserView 하나로 처리한다.
  component: UserView,
}
```

이렇게 하면 `/user/1`로 접속했을 때도 `UserView`가 렌더링되고, `/user/100`으로 접속했을 때도 같은 `UserView`가 렌더링된다. 대신 컴포넌트 안에서는 현재 URL의 `id` 값을 읽어 서로 다른 사용자 정보를 보여주면 된다.

---

### 3.7.2 매개변수를 사용한 동적 경로 매칭 활용

먼저 프로필 페이지로 사용할 `UserView` 컴포넌트를 `views` 폴더 안에 만든다.

![UserView 컴포넌트 작성](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130342.png>)

그다음 `router/index.js`에서 `:id` 매개변수를 사용해 라우트를 등록한다. 매개변수는 콜론(`:`)으로 표시한다.

![동적 라우트 등록](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130400.png>)

```js
// router/index.js
import UserView from '../views/UserView.vue'

const routes = [
  {
    // /user/1, /user/2 같은 경로를 하나로 처리한다.
    path: '/user/:id',

    // RouterLink에서 name으로 이동할 때 사용할 이름이다.
    name: 'user',

    // id 값만 달라져도 같은 UserView가 렌더링된다.
    component: UserView,
  },
]
```

이제 `RouterLink`에서 동적 라우트로 이동할 수 있다. 이때 매개변수는 `params` 속성의 객체 형태로 전달한다.

![params를 사용한 RouterLink](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130419.png>)

```vue
<template>
  <!-- name이 user인 라우트로 이동하면서 id 값 1을 전달한다. -->
  <RouterLink :to="{ name: 'user', params: { id: 1 } }">
    User 1
  </RouterLink>

  <!-- id 값만 바꾸면 같은 UserView를 재사용하면서 다른 사용자 페이지처럼 표현할 수 있다. -->
  <RouterLink :to="{ name: 'user', params: { id: 2 } }">
    User 2
  </RouterLink>
</template>
```

여기서 꼭 기억해야 할 점이 있다. `params` 객체의 key 이름은 `router/index.js`에서 지정한 매개변수 이름과 같아야 한다.

```js
// path에서 매개변수 이름이 :id라면
path: '/user/:id'

// RouterLink에서도 params의 key가 id여야 한다.
:to="{ name: 'user', params: { id: 1 } }"
```

만약 `params: { userId: 1 }`처럼 작성하면 `:id`에 값이 들어가지 않아 원하는 URL이 만들어지지 않는다.

---

### 3.7.3 컴포넌트에서 route params 읽기

경로가 일치하면 라우트의 매개변수는 컴포넌트에서 `$route.params`로 참조할 수 있다.

![template에서 $route.params 사용](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130442.png>)

```vue
<template>
  <!-- 현재 URL이 /user/1이면 1이 출력된다. -->
  <h1>User {{ $route.params.id }}</h1>
</template>
```

하지만 Vue Composition API를 사용하는 `<script setup>` 구조에서는 `useRoute()`를 사용해 스크립트 안에서 route 객체를 가져오고, 필요한 값을 변수로 정리한 뒤 템플릿에 출력하는 방식을 권장한다.

![useRoute를 사용한 params 처리](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130459.png>)

```vue
<script setup>
// 현재 활성화된 route 정보를 읽기 위해 useRoute를 가져온다.
import { useRoute } from 'vue-router'

// useRoute()는 현재 URL 정보가 담긴 route 객체를 반환한다.
const route = useRoute()

// /user/:id에서 :id에 해당하는 값은 route.params.id로 접근한다.
const userId = route.params.id
</script>

<template>
  <!-- script에서 정리한 값을 템플릿에 출력한다. -->
  <h1>User {{ userId }}</h1>
</template>
```

이 방식은 템플릿 안에 `$route.params.id`를 직접 반복해서 쓰는 것보다 코드의 의미가 분명하다. 나중에 `id` 값을 이용해 API 요청을 보내거나, 추가 로직을 작성할 때도 스크립트 안에서 다루는 편이 편하다.

⚠️ 주의: `route`와 `router`는 이름이 비슷하지만 역할이 다르다. `route`는 현재 URL 정보를 읽는 객체이고, `router`는 페이지 이동을 실행하는 객체다. 이 구분은 뒤에서 다시 정리한다.

---

## 3.8 Nested Routes

애플리케이션의 UI는 여러 단계로 중첩된 컴포넌트 구조를 가질 수 있다. 예를 들어 사용자 페이지 안에 프로필 탭과 게시글 탭이 있고, 상단 사용자 정보는 유지한 채 아래 내용만 바뀌는 구조를 생각해볼 수 있다.

이런 경우 URL도 컴포넌트 구조에 맞춰 중첩해서 표현할 수 있다.

```text
/user/1/profile
/user/1/posts
```

이 방식을 **Nested Routes**, 즉 중첩 라우팅이라고 부른다.

![중첩된 컴포넌트와 URL 구조](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130521.png>)

중첩 라우트는 특정 페이지의 레이아웃은 유지한 채, 그 안의 일부 영역만 다른 내용으로 교체하는 방식이다. 사용자 페이지의 공통 영역은 그대로 두고, 본문 영역만 `Profile`, `Posts` 등으로 바꿔 보여줄 때 유용하다.

---

### 3.8.1 중첩 라우팅 활용

먼저 유저 프로필 내부에서 중첩으로 사용할 컴포넌트를 만든다. 강의에서는 `components` 폴더에 `UserProfile`, `UserPosts` 컴포넌트를 작성한 뒤 라우터에 등록한다.

![UserProfile, UserPosts 컴포넌트 작성](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130541.png>)

중첩 라우트는 라우트 설정 객체 안에서 `children` 옵션을 사용해 작성한다. `children`은 배열 형태이며, 필요한 만큼 하위 경로를 표현할 수 있다.

![children 옵션으로 중첩 라우트 등록](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130559.png>)

```js
// router/index.js
import UserView from '../views/UserView.vue'
import UserProfile from '../components/UserProfile.vue'
import UserPosts from '../components/UserPosts.vue'

const routes = [
  {
    // 부모 라우트
    path: '/user/:id',
    component: UserView,

    // 부모 라우트 안에서 렌더링될 자식 라우트 목록
    children: [
      {
        // /user/:id/profile로 연결된다.
        // 자식 path에는 앞에 /를 붙이지 않는다.
        path: 'profile',
        name: 'user-profile',
        component: UserProfile,
      },
      {
        // /user/:id/posts로 연결된다.
        path: 'posts',
        name: 'user-posts',
        component: UserPosts,
      },
    ],
  },
]
```

여기서 가장 중요한 부분은 자식 라우트의 `path`를 `/profile`이 아니라 `profile`로 작성한다는 점이다. 자식 라우트의 path에 `/`를 붙이면 부모 경로 뒤에 이어지는 상대 경로가 아니라, 루트 기준의 절대 경로처럼 동작할 수 있다.

---

### 3.8.2 부모 컴포넌트 안에 RouterView 배치하기

중첩 라우팅을 사용하려면 부모 컴포넌트 안에도 `RouterView`가 있어야 한다. 상위의 `App.vue`에 있는 `RouterView`가 `UserView`를 보여주고, `UserView` 안의 `RouterView`가 다시 `UserProfile` 또는 `UserPosts`를 보여주는 구조다.

![중첩 라우트용 RouterLink와 RouterView 작성](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130616.png>)

```vue
<!-- UserView.vue -->
<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <section>
    <!-- 부모 라우트에서 받은 id 값을 사용한다. -->
    <h1>User {{ route.params.id }}</h1>

    <nav>
      <!-- 현재 사용자 id를 유지하면서 profile 하위 경로로 이동한다. -->
      <RouterLink
        :to="{ name: 'user-profile', params: { id: route.params.id } }"
      >
        Profile
      </RouterLink>

      <!-- 현재 사용자 id를 유지하면서 posts 하위 경로로 이동한다. -->
      <RouterLink
        :to="{ name: 'user-posts', params: { id: route.params.id } }"
      >
        Posts
      </RouterLink>
    </nav>

    <!-- 자식 라우트 컴포넌트가 이 위치에 표시된다. -->
    <RouterView />
  </section>
</template>
```

중첩된 Named Routes를 다룰 때는 일반적으로 하위 경로에만 이름을 지정하는 방식을 많이 사용한다. 이렇게 하면 `/user/:id`로 이동했을 때 어떤 자식 화면을 기본으로 보여줄지도 함께 설계할 수 있다.

![중첩 Named Routes 구성](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130635.png>)

기본 자식 화면을 지정하고 싶다면 빈 path를 사용할 수 있다.

```js
const routes = [
  {
    path: '/user/:id',
    component: UserView,
    children: [
      {
        // /user/:id로 접근했을 때 기본으로 렌더링될 자식 라우트
        path: '',
        name: 'user-profile',
        component: UserProfile,
      },
      {
        path: 'posts',
        name: 'user-posts',
        component: UserPosts,
      },
    ],
  },
]
```

⚠️ 주의: Nested Routes는 “컴포넌트 파일이 부모-자식 관계인가”보다 “URL이 중첩 구조를 표현하는가”의 관점으로 이해해야 한다. 또한 부모 라우트의 파라미터인 `:id`는 자식 컴포넌트에서도 접근할 수 있다.

📌 핵심: 중첩 라우팅에서는 부모 컴포넌트 안에 자식 라우트를 보여줄 `RouterView`가 한 번 더 필요하다.

---

## 3.9 Programmatic Navigation

지금까지는 사용자가 `RouterLink`를 클릭해서 페이지를 이동했다. 하지만 실제 프로젝트에서는 JavaScript 로직으로 페이지를 이동시켜야 하는 경우가 많다.

예를 들어 다음과 같은 상황이다.

- 로그인 성공 후 홈 화면으로 이동
- 게시글 작성 완료 후 상세 페이지로 이동
- 권한이 없으면 이전 페이지로 이동
- 버튼 클릭 시 특정 사용자 페이지로 이동

이처럼 `<RouterLink>`를 사용하는 대신 JavaScript 코드를 사용해 페이지를 이동시키는 방식을 **Programmatic Navigation**이라고 한다.

```text
Programmatic Navigation은 사용자가 링크를 클릭하는 대신,
JavaScript 로직을 통해 특정 URL로 이동시키는 기능이다.
```

---

### 3.9.1 router.push()

`router.push()`는 다른 URL로 이동하는 메서드다. 새 항목을 history stack에 추가하므로, 사용자가 브라우저의 뒤로 가기 버튼을 누르면 이전 URL로 돌아갈 수 있다.

`RouterLink`를 클릭하는 것도 내부적으로는 `router.push()`를 호출하는 것과 비슷하게 동작한다.

![router.push() 개념](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130659.png>)

```vue
<script setup>
// 페이지 이동을 제어하기 위해 useRouter를 가져온다.
import { useRouter } from 'vue-router'

// router 객체는 이동, replace, guard 등록 등 라우팅 제어 기능을 가진다.
const router = useRouter()

// 버튼 클릭 시 home 라우트로 이동시키는 함수
const goHome = () => {
  // name을 사용하면 실제 path를 직접 쓰지 않아도 된다.
  router.push({ name: 'home' })
}
</script>

<template>
  <button @click="goHome">Home으로 이동</button>
</template>
```

강의에서는 `UserView` 컴포넌트에서 `HomeView` 컴포넌트로 이동하는 버튼을 만드는 예시를 확인했다.

![router.push() 활용](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130719.png>)

`router.push()`에는 문자열 경로도 넣을 수 있고, Named Routes 객체도 넣을 수 있다.

```js
// 문자열 경로로 이동
router.push('/about')

// name으로 이동
router.push({ name: 'about' })

// 동적 라우트로 이동
router.push({
  name: 'user',
  params: { id: 1 },
})

// 쿼리 문자열과 함께 이동
router.push({
  path: '/search',
  query: { keyword: 'vue' },
})
```

![router.push의 인자 활용](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130820.png>)

---

### 3.9.2 router.replace()

`router.replace()`는 현재 위치를 바꾸는 메서드다. `push()`와 달리 history stack에 새로운 항목을 추가하지 않는다. 그래서 이동 후 브라우저 뒤로 가기 버튼을 눌러도 이동 전 URL로 돌아가지 않는다.

![router.replace() 개념](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130743.png>)

```vue
<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const replaceHome = () => {
  // 현재 기록을 home으로 대체한다.
  // 이동 전 페이지가 history stack에 남지 않는다.
  router.replace({ name: 'home' })
}
</script>

<template>
  <button @click="replaceHome">Home으로 replace 이동</button>
</template>
```

강의에서는 `UserView`에서 `HomeView`로 이동하는 버튼을 `replace()`로 구현하는 예시를 확인했다.

![router.replace() 활용](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130802.png>)

`push()`와 `replace()`의 차이는 뒤로 가기 가능 여부로 이해하면 쉽다.

| 메서드 | history stack | 뒤로 가기 |
|---|---|---|
| `router.push()` | 새 기록을 추가한다. | 이전 페이지로 돌아갈 수 있다. |
| `router.replace()` | 현재 기록을 대체한다. | 이동 전 페이지로 돌아가기 어렵다. |

⚠️ 주의: 로그인 후 다시 로그인 페이지로 돌아가면 안 되는 흐름에서는 `replace()`가 더 자연스러울 수 있다. 반대로 일반 페이지 이동에서는 사용자가 뒤로 가기를 기대하므로 `push()`가 더 적절하다.

---

## 3.10 route와 router

Vue Router를 사용할 때 가장 많이 헷갈리는 단어가 `route`와 `router`다. 이름이 비슷하지만 역할은 분명히 다르다.

- `route`: 현재 경로 상태를 읽는 객체
- `router`: 페이지 이동과 라우팅 제어를 수행하는 객체

---

### 3.10.1 useRoute()

`useRoute()`는 현재 활성화된 경로 정보가 담긴 `route` 객체를 반환한다. 이 함수는 컴포넌트의 `setup()` 함수나 `<script setup>` 최상단에서 호출해야 한다.

![useRoute()](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130840.png>)

```vue
<script setup>
import { useRoute } from 'vue-router'

// 현재 URL 정보가 담긴 route 객체를 가져온다.
const route = useRoute()

// route.params: 동적 라우트 매개변수
// route.query: 쿼리 문자열
// route.name: 현재 라우트 이름
console.log(route.params.id)
console.log(route.query)
console.log(route.name)
</script>
```

`route` 객체는 현재 URL 상태를 보여주는 역할을 한다. 읽기 전용에 가깝기 때문에, 이 객체 자체로 페이지 이동을 직접 제어하지는 않는다.

`route` 객체에서 자주 확인하는 값은 다음과 같다.

| 속성 | 의미 |
|---|---|
| `route.params` | `/user/:id` 같은 동적 라우트 매개변수 |
| `route.query` | `/search?keyword=vue` 같은 쿼리 문자열 |
| `route.name` | 현재 라우트의 name |
| `route.path` | 현재 경로 문자열 |
| `route.matched` | 현재 URL과 매칭된 라우트 기록 |

또한 `route` 객체는 반응형이다. URL이 바뀌면 `route.params.id` 같은 값도 자동으로 변경된다.

---

### 3.10.2 useRouter()

`useRouter()`는 라우터 인터페이스인 `router` 객체를 반환한다. `router`는 페이지 이동이나 네비게이션 가드 등록처럼 라우팅을 제어하는 역할을 한다.

![useRouter()](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130900.png>)

```vue
<script setup>
import { useRouter } from 'vue-router'

// 라우팅을 제어할 router 객체를 가져온다.
const router = useRouter()

const goUser = () => {
  // router는 페이지 이동을 실행할 수 있다.
  router.push({
    name: 'user',
    params: { id: 1 },
  })
}
</script>

<template>
  <button @click="goUser">User 1로 이동</button>
</template>
```

`router` 객체는 애플리케이션 전체 라우팅 로직을 제어할 수 있는 핵심 객체다. `router.push()`, `router.replace()` 같은 메서드를 통해 프로그래밍적으로 라우트를 변경할 수 있고, 네비게이션 가드나 히스토리 제어에도 사용된다.

---

### 3.10.3 route와 router 정리

![route와 router 정리](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130922.png>)

| 구분 | 가져오는 함수 | 역할 | 대표 사용 |
|---|---|---|---|
| `route` | `useRoute()` | 현재 라우트 상태를 읽는다. | `route.params.id`, `route.query` |
| `router` | `useRouter()` | 라우팅 동작을 제어한다. | `router.push()`, `router.replace()` |

쉽게 말하면 `route`는 “현재 어디에 있는지 확인하는 것”이고, `router`는 “어디로 이동할지 명령하는 것”이다.

📌 핵심: 읽을 때는 `route`, 이동시킬 때는 `router`를 사용한다.

---

## 3.11 Navigation Guard

Navigation Guard는 Vue Router를 통해 특정 URL에 접근할 때 이동을 허용하거나, 취소하거나, 다른 URL로 redirect하는 기능이다.

```text
Navigation Guard는 라우트 전환 전후에 실행되는 함수다.
사용자의 로그인 상태나 권한을 확인해 내비게이션을 허용하거나,
취소하거나, 다른 페이지로 보낼 수 있다.
```

예를 들어 로그인하지 않은 사용자가 마이페이지에 접근하려고 할 때, 마이페이지 진입을 막고 로그인 페이지로 보내는 로직을 만들 수 있다.

Navigation Guard는 적용 범위에 따라 크게 세 종류로 나뉜다.

| 종류 | 적용 범위 | 작성 위치 |
|---|---|---|
| Globally Guard | 애플리케이션 전체 라우트 전환 | `router/index.js` |
| Per-route Guard | 특정 라우트에만 적용 | `router/index.js`의 해당 route 객체 |
| In-component Guard | 특정 컴포넌트 내부에서만 적용 | 각 컴포넌트의 `<script setup>` |

---

## 3.12 Globally Guard

Globally Guard, 즉 전역 가드는 애플리케이션 전역에서 동작하는 가드다. 모든 라우트 전환에 공통으로 적용할 로직이 있을 때 사용한다.

대표적인 전역 가드는 다음과 같다.

1. `beforeEach()`
2. `beforeResolve()`
3. `afterEach()`

---

### 3.12.1 beforeEach()

`beforeEach()`는 다른 URL로 이동하기 직전에 실행되는 전역 가드다. 모든 라우트 전환 전에 실행되므로 로그인 여부 확인, 권한 검사 같은 공통 로직에 자주 사용된다.

![beforeEach() 구조](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 130956.png>)

모든 가드의 콜백 함수는 기본적으로 `to`, `from` 인자를 받는다.

![to와 from 인자](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131014.png>)

| 인자 | 의미 |
|---|---|
| `to` | 이동하려는 URL 정보가 담긴 Route 객체 |
| `from` | 현재 URL 정보가 담긴 Route 객체 |

기본 구조는 다음과 같다.

```js
// router/index.js
router.beforeEach((to, from) => {
  // to: 이동하려는 라우트 정보
  // from: 현재 라우트 정보
  console.log('to:', to)
  console.log('from:', from)

  // return이 없으면 이동을 그대로 허용한다.
})
```

`beforeEach()`에서는 선택적으로 값을 반환할 수 있다.

| 반환값 | 동작 |
|---|---|
| `false` | 현재 내비게이션을 취소한다. |
| Route Location 객체 | 해당 위치로 redirect한다. |
| 반환 없음 | 원래 이동하려던 `to` 경로로 이동한다. |

강의에서는 HomeView에서 UserView로 이동했을 때 `to`와 `from`에 어떤 값이 들어오는지 확인했다.

![beforeEach() 예시 코드](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131107.png>)

`to`에는 이동할 URL인 user 라우트 정보가 들어가고, `from`에는 현재 URL인 home 라우트 정보가 들어간다.

![beforeEach() 인자 출력 확인](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131124.png>)

---

### 3.12.2 로그인 여부에 따라 접근 제어하기

전역 가드의 대표 활용 예시는 로그인하지 않은 사용자의 접근을 막는 것이다. 강의에서는 “Login이 되어 있지 않다면 페이지 진입을 막고 Login 페이지로 이동시키기” 예시를 확인했다.

![로그인 여부에 따른 redirect](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131150.png>)

```js
// router/index.js

// 예시용 로그인 상태 값이다.
// 실제 프로젝트에서는 Pinia store, localStorage, 서버 인증 상태 등을 확인할 수 있다.
const isAuthenticated = false

router.beforeEach((to, from) => {
  // 로그인이 되어 있지 않고,
  // 이동하려는 페이지가 login 페이지가 아니라면
  if (!isAuthenticated && to.name !== 'login') {
    // login 페이지로 redirect한다.
    return { name: 'login' }
  }

  // 별도로 return하지 않으면 원래 이동하려던 페이지로 이동한다.
})
```

이 코드는 이해하기 쉽지만 실제 프로젝트에서는 모든 페이지를 막아버릴 수 있다. 그래서 보통은 `meta` 속성을 사용해 인증이 필요한 페이지에만 가드를 적용한다.

```js
const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/user/:id',
    name: 'user',
    component: UserView,

    // 이 페이지는 로그인 필요 페이지라는 표시
    meta: { requiresAuth: true },
  },
]

router.beforeEach((to, from) => {
  const isAuthenticated = false

  // 이동하려는 라우트에 requiresAuth가 있고,
  // 로그인 상태가 아니라면 login 페이지로 보낸다.
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' }
  }
})
```

⚠️ 주의: 로그인 페이지로 보내는 조건을 잘못 작성하면 무한 redirect가 발생할 수 있다. 예를 들어 로그인하지 않았을 때 모든 페이지를 login으로 보내면서, login 페이지 진입도 다시 막으면 계속 login으로 보내려는 문제가 생긴다. 그래서 `to.name !== 'login'` 같은 예외 조건을 확인하거나, `meta.requiresAuth` 방식으로 필요한 페이지에만 적용하는 것이 안전하다.

---

### 3.12.3 beforeResolve()

`beforeResolve()`는 `beforeEach`와 모든 컴포넌트 단위 가드가 실행된 후, 내비게이션이 확정되기 직전에 호출된다. 모든 비동기 컴포넌트가 로드되고 모든 가드가 통과된 상태에서 마지막으로 무언가를 확인하고 싶을 때 사용한다.

주로 다음과 같은 경우에 사용할 수 있다.

- 페이지에 진입하기 전에 권한 관련 데이터를 미리 가져와야 할 때
- 비동기 컴포넌트 로드 이후 최종 확인이 필요할 때
- `beforeEach`보다 더 늦은 시점에 검사가 필요할 때

다만 일반적인 프로젝트에서는 `beforeEach()`에 비해 사용 빈도가 낮다.

```js
router.beforeResolve((to, from) => {
  // 모든 가드가 통과된 뒤,
  // 이동이 확정되기 직전에 실행된다.
})
```

---

### 3.12.4 afterEach()

`afterEach()`는 내비게이션이 완전히 확정된 후, 즉 URL이 변경되고 화면 렌더링이 끝난 뒤에 호출된다.

이미 이동이 완료된 상태이므로 `afterEach()`에서는 내비게이션을 중단시키거나 변경할 수 없다. 대신 후처리 작업에 적합하다.

대표적인 활용은 다음과 같다.

- 페이지 이동 기록 로깅
- 페이지별 `document.title` 변경
- 화면 전환 후 분석 이벤트 전송

```js
router.afterEach((to, from) => {
  // 이동이 끝난 뒤 실행된다.
  // 이 시점에는 이동을 취소할 수 없다.
  document.title = to.name ? `${to.name} 페이지` : 'Vue App'
})
```

⚠️ 주의: `afterEach()`는 이동이 끝난 뒤 실행되므로 접근 제한 로직을 작성하기에 적절하지 않다. 접근 제한은 이동 전에 실행되는 `beforeEach()`나 `beforeEnter()`에서 처리해야 한다.

---

## 3.13 Per-route Guard

Per-route Guard는 특정 라우트에 진입할 때만 실행되도록 라우트 설정 객체에 직접 정의하는 가드다. 대표적으로 `beforeEnter`를 사용한다.

전역 가드는 모든 라우트 이동에 적용되지만, `beforeEnter`는 해당 라우트에 들어올 때만 실행된다. 특정 페이지에만 필요한 검사라면 전역 가드보다 더 명확하게 작성할 수 있다.

---

### 3.13.1 beforeEnter()

`beforeEnter()`는 특정 route에 진입했을 때만 실행되는 함수다.

![beforeEnter() 구조](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131227.png>)

```js
const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,

    // /login 라우트에 진입할 때만 실행된다.
    beforeEnter: (to, from) => {
      console.log('to:', to)
      console.log('from:', from)
    },
  },
]
```

강의에서는 HomeView에서 LoginView로 이동한 뒤 `to`와 `from` 값이 어떻게 출력되는지 확인했다.

![beforeEnter() 예시 코드](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131248.png>)

![beforeEnter() 출력 확인](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131302.png>)

`to`에는 이동할 URL인 login 라우트 정보가 들어가고, `from`에는 현재 URL인 home 라우트 정보가 들어간다. 이 가드는 다른 경로에서 login 라우트로 탐색해 올 때 실행된다.

---

### 3.13.2 이미 로그인한 사용자의 LoginView 진입 막기

`beforeEnter()`의 대표 활용은 이미 로그인한 사용자가 로그인 페이지에 다시 접근하지 못하게 막는 것이다.

강의에서는 “이미 로그인한 상태라면 LoginView 진입을 막고 HomeView로 이동시키기” 예시를 확인했다.

![beforeEnter() 활용](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131323.png>)

```js
const isAuthenticated = true

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,

    beforeEnter: (to, from) => {
      // 이미 로그인한 상태라면 로그인 페이지에 들어갈 필요가 없다.
      if (isAuthenticated) {
        // HomeView로 이동시킨다.
        return { name: 'home' }
      }

      // 로그인하지 않은 상태라면 LoginView 진입을 허용한다.
    },
  },
]
```

이 로직은 로그인 페이지에만 관련된 조건이므로 전역 가드보다 `beforeEnter()`로 작성하는 것이 의도가 더 분명하다.

⚠️ 주의: `beforeEnter()`는 특정 라우트에 새로 진입할 때 실행된다. 단순히 같은 라우트 안에서 파라미터나 쿼리만 바뀌는 경우에는 기대한 것처럼 실행되지 않을 수 있다. 같은 컴포넌트 안에서 라우트 업데이트를 감지해야 한다면 `onBeforeRouteUpdate()`를 사용한다.

---

## 3.14 In-component Guard

In-component Guard는 특정 컴포넌트 안에서만 동작하는 가드다. 컴포넌트의 생명주기와 라우팅 전환을 함께 다루고 싶을 때 사용한다.

대표적으로 두 가지를 기억하면 된다.

| 가드 | 실행 시점 | 대표 활용 |
|---|---|---|
| `onBeforeRouteLeave()` | 현재 라우트에서 다른 라우트로 이동하기 전 | 작성 중인 내용이 있을 때 페이지 이탈 확인 |
| `onBeforeRouteUpdate()` | 같은 라우트에서 params/query 등이 바뀌어 컴포넌트가 업데이트되기 전 | `/user/1`에서 `/user/100`으로 이동할 때 데이터 갱신 |

---

### 3.14.1 onBeforeRouteLeave()

`onBeforeRouteLeave()`는 사용자가 현재 페이지를 떠나려 할 때 실행된다. 예를 들어 사용자가 글 작성 페이지에서 내용을 입력하다가 다른 페이지로 이동하려 할 때 확인창을 띄울 수 있다.

강의에서는 사용자가 `UserView`를 떠날 때 팝업 창을 출력하는 예시를 확인했다.

![onBeforeRouteLeave 활용](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131405.png>)

```vue
<script setup>
import { onBeforeRouteLeave } from 'vue-router'

onBeforeRouteLeave((to, from) => {
  // 사용자가 현재 페이지를 떠나려고 할 때 확인창을 띄운다.
  const answer = window.confirm('정말 이 페이지를 떠나시겠습니까?')

  // false를 반환하면 현재 내비게이션이 취소된다.
  if (!answer) {
    return false
  }

  // 반환값이 없으면 이동을 허용한다.
})
</script>
```

이 가드는 사용자가 현재 컴포넌트를 떠나는 상황에 특화되어 있다. 작성 중인 폼, 저장되지 않은 데이터, 이탈 확인이 필요한 페이지에서 자주 사용된다.

---

### 3.14.2 onBeforeRouteUpdate()

`onBeforeRouteUpdate()`는 이미 렌더링된 컴포넌트가 같은 라우트 내에서 업데이트되기 전에 실행된다.

예를 들어 `/user/1`에서 `/user/100`으로 이동한다고 해보자. 두 주소는 모두 같은 `UserView` 컴포넌트를 사용한다. 이 경우 Vue는 컴포넌트를 완전히 새로 만들지 않고 기존 컴포넌트를 재사용할 수 있다. 그래서 처음에 만든 `userId` 값이 자동으로 원하는 방식으로 갱신되지 않을 수 있다.

강의에서는 UserView 페이지에서 다른 id를 가진 UserView 페이지로 이동하는 경우를 확인했다.

![onBeforeRouteUpdate 활용](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131428.png>)

```vue
<script setup>
import { ref } from 'vue'
import { useRoute, onBeforeRouteUpdate } from 'vue-router'

const route = useRoute()

// 처음 접속했을 때의 id 값을 저장한다.
const userId = ref(route.params.id)

// 같은 UserView 컴포넌트 안에서 id만 바뀌는 경우 실행된다.
onBeforeRouteUpdate((to, from) => {
  // 새로 이동하려는 URL의 id 값으로 userId를 갱신한다.
  userId.value = to.params.id
})
</script>

<template>
  <h1>User {{ userId }}</h1>

  <!-- 예: /user/1에서 /user/100으로 이동 -->
  <RouterLink :to="{ name: 'user', params: { id: 100 } }">
    User 100으로 이동
  </RouterLink>
</template>
```

만약 `onBeforeRouteUpdate()`에서 `userId`를 변경하지 않으면, 컴포넌트가 재사용되는 상황에서 화면에 표시되는 값이 갱신되지 않을 수 있다.

![onBeforeRouteUpdate를 사용하지 않았을 때](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131509.png>)

⚠️ 주의: 동적 라우트에서 같은 컴포넌트를 재사용하는 경우, “URL은 바뀌었는데 화면 데이터가 그대로인 문제”가 생길 수 있다. 이때는 `route.params`를 직접 반응형으로 사용하거나, `watch`, `onBeforeRouteUpdate()` 등을 사용해 값 변경을 처리해야 한다.

---

### 3.14.3 Navigation Guard 정리

강의의 Navigation Guard 내용을 범위와 작성 위치 기준으로 다시 정리하면 다음과 같다.

| 종류 | 동작 범위 | 작성 위치 | 대표 사용 |
|---|---|---|---|
| Globally Guard | 애플리케이션 전역 | `router/index.js` | 로그인 여부 공통 검사 |
| Per-route Guard | 특정 route | `router/index.js`의 각 route 객체 | 특정 페이지 진입 제한 |
| In-component Guard | 특정 컴포넌트 | 각 컴포넌트 script | 페이지 이탈 확인, 같은 컴포넌트 내 params 변경 처리 |

전역에서 처리해야 하는 조건인지, 특정 라우트에만 필요한 조건인지, 컴포넌트 내부 상태와 연결된 조건인지에 따라 가드를 선택하면 된다.

---

## 3.15 Lazy Loading Routes

Lazy Loading Routes는 Vue 애플리케이션을 처음 빌드할 때 모든 컴포넌트를 한 번에 로드하지 않고, 해당 경로를 처음 방문할 때 컴포넌트를 로드하는 방식이다.

처음부터 모든 컴포넌트를 준비하면 프로젝트 규모가 커질수록 초기 로드 시간이 길어질 수 있다. 그래서 자주 방문하지 않는 페이지나 크기가 큰 페이지는 Lazy Loading으로 분리하면 초기 로딩 부담을 줄일 수 있다.

![Lazy Loading Routes](<../assets/images/06_04_Vue_Router/화면 캡처 2026-06-04 131529.png>)

일반 import 방식은 다음과 같다.

```js
import AboutView from '../views/AboutView.vue'

const routes = [
  {
    path: '/about',
    name: 'about',
    component: AboutView,
  },
]
```

Lazy Loading 방식은 `component`에 import 함수를 직접 작성한다.

```js
const routes = [
  {
    path: '/about',
    name: 'about',

    // /about 경로를 처음 방문할 때 AboutView 컴포넌트를 불러온다.
    component: () => import('../views/AboutView.vue'),
  },
]
```

이렇게 작성하면 해당 컴포넌트는 처음부터 메인 번들에 포함되지 않고, 필요한 시점에 나누어 로드된다.

⚠️ 주의: 모든 컴포넌트를 무조건 Lazy Loading으로 바꾸는 것이 정답은 아니다. 초기 화면에 반드시 필요한 페이지는 일반 import로 두고, 사용자가 나중에 방문할 가능성이 높은 페이지를 Lazy Loading 대상으로 잡는 식으로 판단하면 된다.

---

## 4. 적용 관점에서 다시 보기

이번 강의 내용은 Vue 프로젝트에서 화면을 나누는 거의 모든 상황에 연결된다. 단순히 “링크를 눌러 화면을 바꾼다”가 아니라, URL 구조를 어떻게 설계하고 컴포넌트를 어떻게 배치할지 결정하는 기준이 된다.

먼저 기본 페이지 이동은 `router/index.js`에 `path`, `name`, `component`를 등록하고, `App.vue`나 필요한 컴포넌트에서 `RouterLink`를 작성한 뒤, `RouterView` 위치에 화면을 렌더링하는 흐름으로 잡으면 된다. 실습 중 화면이 안 바뀐다면 `RouterLink`의 `to` 값과 라우터의 `path`가 일치하는지, `RouterView`가 실제로 배치되어 있는지 먼저 확인하는 것이 좋다.

URL에 값이 들어가는 상세 페이지는 Dynamic Route Matching을 떠올리면 된다. `/articles/1`, `/articles/2`, `/user/100`처럼 숫자나 문자열만 바뀌고 화면 구조가 같은 경우에는 `:id` 같은 매개변수를 사용한다. 이때 컴포넌트에서는 `useRoute()`로 현재 파라미터를 읽는다.

부모 페이지 안에서 일부 영역만 바뀌는 구조라면 Nested Routes를 사용한다. 예를 들어 `/user/:id/profile`, `/user/:id/posts`처럼 같은 사용자 페이지 안에서 탭만 바뀌는 구조가 여기에 해당한다. 이때는 부모 컴포넌트 안에 자식 컴포넌트를 보여줄 `RouterView`가 한 번 더 필요하다.

버튼 클릭이나 로그인 성공처럼 코드 로직에 의해 이동해야 하는 상황에서는 `useRouter()`와 `router.push()` 또는 `router.replace()`를 사용한다. 뒤로 가기가 가능해야 하는 일반 이동은 `push()`, 이동 전 페이지로 돌아가면 어색한 흐름은 `replace()`를 고려한다.

접근 제한이 필요하면 Navigation Guard를 사용한다. 모든 페이지에 공통으로 적용할 로그인 검사는 `beforeEach()`, 특정 페이지에만 필요한 검사는 `beforeEnter()`, 페이지를 떠날 때 확인하거나 같은 컴포넌트 안에서 파라미터 변경을 처리해야 할 때는 In-component Guard를 사용하면 된다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

SPA는 페이지가 하나라서 URL이 없어도 화면 전환이 가능해 보이지만, 실제 서비스처럼 사용하려면 URL과 컴포넌트 상태를 연결해야 한다. Vue Router는 이 연결을 담당하며, `RouterLink`와 `RouterView`의 역할을 나누어 이해하면 기본 라우팅 구조가 명확해진다.

또한 `route`와 `router`의 차이를 구분하는 것이 중요하다. `route`는 현재 경로 정보를 읽는 객체이고, `router`는 페이지 이동을 실행하는 객체다. 이름이 비슷해도 역할은 완전히 다르다.

### 5.2 앞으로 이어지는 연결점

이번 내용은 Vue 프로젝트의 인증 흐름, 게시글 상세 페이지, 마이페이지, 관리자 페이지 같은 기능으로 바로 이어진다. 특히 로그인 여부에 따른 접근 제한은 Pinia 상태 관리나 토큰 인증과 함께 자주 사용된다.

동적 라우트와 중첩 라우트는 DRF나 FastAPI 백엔드에서 받아온 상세 데이터와 연결하기 좋다. 예를 들어 `/articles/:id`에 접속했을 때 `route.params.id`로 id를 읽고, 해당 id로 API 요청을 보내 상세 데이터를 불러오는 식으로 확장할 수 있다.

### 5.3 더 파볼 만한 주제

이번 강의에서는 Vue Router의 핵심 기능을 중심으로 다뤘지만, 실제 프로젝트에서는 인증 토큰 저장 방식, Pinia와 Router Guard 연동, 404 Not Found 라우트 처리, route meta를 활용한 권한 관리, 페이지 전환 애니메이션까지 함께 다루게 된다.

또한 Lazy Loading을 더 깊게 이해하려면 Vite의 코드 스플리팅과 동적 import가 빌드 결과에 어떤 영향을 주는지도 함께 살펴볼 만하다.

---

## 6. 요약 정리

📌 핵심

- Routing은 URL에 따라 어떤 컴포넌트를 보여줄지 결정하는 과정이다.
- SSR에서는 서버가 URL에 맞는 HTML을 보내고, CSR에서는 브라우저의 JavaScript가 컴포넌트를 교체한다.
- SPA에서 Vue Router가 없으면 URL 공유, 새로고침, 뒤로 가기 같은 기능을 자연스럽게 처리하기 어렵다.
- `RouterLink`는 새로고침 없는 이동 링크를 만들고, `RouterView`는 현재 URL에 맞는 컴포넌트를 보여준다.
- `router/index.js`에는 `path`, `name`, `component`를 중심으로 라우트 설정을 작성한다.
- Named Routes를 사용하면 실제 URL을 직접 반복해서 쓰지 않아 유지보수가 쉬워진다.
- Dynamic Route Matching은 `/user/:id`처럼 URL 일부를 변수로 사용하는 방식이다.
- Nested Routes는 부모 URL과 자식 URL 구조를 연결해 부모 화면 안에서 자식 화면을 교체한다.
- `useRoute()`는 현재 경로 정보를 읽고, `useRouter()`는 페이지 이동을 실행한다.
- `router.push()`는 새 이동 기록을 추가하고, `router.replace()`는 현재 기록을 대체한다.
- Navigation Guard는 페이지 이동을 허용, 취소, redirect하는 라우팅 제어 기능이다.
- Lazy Loading Routes는 해당 경로에 처음 방문할 때 컴포넌트를 불러와 초기 로딩 부담을 줄인다.

🧠 기억할 것

> 읽을 때는 `route`, 이동시킬 때는 `router`를 사용한다.  
> 부모 라우트 안에 자식 라우트를 보여주려면 부모 컴포넌트 안에도 `RouterView`가 필요하다.  
> 로그인 접근 제한은 화면 컴포넌트에서 막는 것보다 Router Guard에서 먼저 제어하는 편이 구조적으로 깔끔하다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. `RouterLink`와 `RouterView`는 각각 어떤 역할을 하는가?
2. `path: '/user/:id'`에서 `:id`는 어떤 의미이며, 컴포넌트에서는 어떻게 읽을 수 있는가?
3. `RouterLink :to="{ name: 'user', params: { id: 1 } }"`에서 `params`의 key 이름은 무엇과 일치해야 하는가?
4. 중첩 라우팅에서 자식 라우트의 `path`에 `/`를 붙이면 왜 문제가 될 수 있는가?
5. `useRoute()`와 `useRouter()`의 차이를 “읽기”와 “이동”이라는 단어를 사용해 설명해보자.
6. `router.push()`와 `router.replace()`의 차이는 무엇인가?
7. 로그인하지 않은 사용자의 마이페이지 접근을 막으려면 어떤 Navigation Guard를 사용할 수 있는가?
8. `/user/1`에서 `/user/100`으로 이동했는데 같은 컴포넌트가 재사용되어 화면 값이 갱신되지 않는다면 어떤 가드를 고려할 수 있는가?
9. `beforeEach`, `beforeEnter`, `onBeforeRouteLeave`는 각각 어느 범위에서 동작하는가?
10. Lazy Loading Routes는 어떤 문제를 줄이기 위해 사용하는가?
