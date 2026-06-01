# Vue 입문: 프론트엔드 개발, SPA/CSR, Vue 기본 문법 정리

- 🎯 글의 목표: 현대 프론트엔드 개발에서 Client-side Framework가 왜 필요한지 이해하고, SPA와 CSR의 흐름을 바탕으로 Vue의 기본 구조와 핵심 문법을 정리한다.
- 🧩 핵심 키워드: Frontend Development, Client-side Framework, SPA, CSR, SSR, MPA, Vue, Component, createApp, mount, setup, ref, 반응성, Mustache Syntax, v-on, Ref Unwrap, SEO
- ⭐ 중요도: 높음
- 📝 한눈에 보는 내용: 이번 강의는 Vue 문법을 바로 외우기보다, 먼저 웹 개발 환경이 왜 Vue 같은 프레임워크를 필요로 하게 되었는지부터 출발한다. 이후 SPA와 CSR의 동작 방식, Vue의 선언적 렌더링과 반응성, 그리고 `createApp`, `mount`, `setup`, `ref`, `{{ }}`, `v-on`까지 Vue 입문에서 반드시 잡아야 할 흐름을 정리한다.
- 🔗 관련 문제 / 주제: Vue CDN 사용, Vue 앱 인스턴스 생성, 반응형 변수 선언, 템플릿 렌더링, 이벤트 처리, 일반 변수와 ref 차이, CSR/SSR 비교

---

## 1. 들어가며

Vue를 처음 배울 때 가장 헷갈리는 부분은 문법 자체보다도, 왜 이런 도구가 필요한지 감이 잘 오지 않는다는 점이다. HTML, CSS, JavaScript만으로도 웹 페이지를 만들 수 있는데, 왜 Vue, React, Angular 같은 프레임워크를 따로 배워야 할까?

이 질문에 답하려면 먼저 웹이 어떻게 변했는지부터 봐야 한다. 과거의 웹은 주로 문서를 읽는 공간에 가까웠다. 하지만 지금의 웹은 음악을 스트리밍하고, 지도를 움직이고, 채팅을 주고받고, 피드와 알림이 실시간으로 갱신되는 **웹 애플리케이션**에 가깝다. 화면의 상태가 자주 바뀌고, 그 상태 변화가 여러 UI에 동시에 반영되어야 한다.

Vue는 바로 이 지점에서 등장한다. Vue는 화면을 컴포넌트 단위로 나누고, 데이터가 바뀌면 그 데이터를 사용하는 화면이 자동으로 다시 그려지도록 도와준다. 이번 강의는 Vue를 문법 암기식으로 보기보다, **웹 애플리케이션이 복잡해진 이유 → Client-side Framework의 필요성 → SPA와 CSR → Vue의 기본 구조와 반응성** 순서로 이해하는 것이 핵심이다.

---

## 2. 핵심 개념 정리

이번 강의가 해결하려는 질문은 다음과 같다.

> 복잡한 웹 화면을 효율적으로 만들기 위해 Vue는 어떤 방식으로 화면과 데이터를 연결할까?

이 질문에 답하기 위해 본문에서는 먼저 프론트엔드 개발과 Client-side Framework의 역할을 잡는다. 그다음 현대 웹 애플리케이션의 대표 구조인 SPA와 CSR을 살펴보고, Vue가 그 구조 안에서 어떤 방식으로 UI를 만들고 갱신하는지 확인한다.

흐름은 크게 다섯 단계로 이어진다.

1. **Frontend Development와 Client-side Framework**  
   사용자가 직접 보는 화면과 상호작용을 만드는 영역을 이해하고, 복잡한 UI 개발에서 프레임워크가 필요한 이유를 정리한다.

2. **SPA와 CSR**  
   전체 페이지를 계속 새로 받는 방식이 아니라, 하나의 페이지에서 필요한 부분만 바꾸는 방식이 어떻게 동작하는지 이해한다.

3. **Vue의 핵심 특징**  
   Vue가 제공하는 선언적 렌더링, 반응성, 컴포넌트 기반 아키텍처가 무엇을 편하게 해주는지 정리한다.

4. **Vue Application 생성 흐름**  
   CDN으로 Vue를 불러오고, `createApp()`으로 앱을 만들고, `mount()`로 HTML 요소에 연결하는 기본 흐름을 익힌다.

5. **반응형 상태와 템플릿 문법**  
   `ref()`, `{{ }}`, `v-on`을 통해 데이터와 화면, 사용자 이벤트가 어떻게 연결되는지 확인한다.

---

## 3. 본문 정리

이 섹션에서는 강의 흐름을 따라가며 Vue를 처음 접할 때 필요한 개념을 하나씩 연결해서 정리한다. 중요한 점은 Vue 문법을 각각 따로 외우는 것이 아니라, **사용자 입력이나 이벤트 → 데이터 변경 → 화면 갱신**이라는 흐름 안에서 이해하는 것이다.

### 3.1 Frontend Development: 사용자가 보는 화면과 경험을 만드는 영역

프론트엔드 개발은 웹 사이트와 웹 애플리케이션의 **사용자 인터페이스(UI)**와 **사용자 경험(UX)**을 만들고 디자인하는 일이다. 사용자가 버튼을 클릭하고, 입력창에 값을 넣고, 화면이 바뀌는 모든 상호작용이 프론트엔드 개발의 대상이 된다.

HTML은 화면의 구조를 만들고, CSS는 화면의 모양을 꾸미며, JavaScript는 사용자의 행동에 따라 화면을 바꾸는 동작을 담당한다. Vue는 이 중에서도 JavaScript를 기반으로, 복잡한 화면 상태와 UI 갱신을 더 편하게 다루도록 도와주는 도구라고 볼 수 있다.

![Frontend Framework와 클라이언트-서버 구조](<../assets/images/05_26_Introduce_of_Vue/스크린샷 2026-05-26 143114.png>)

위 그림은 사용자가 있는 클라이언트 영역과 서버 영역 사이에 프론트엔드 프레임워크가 위치하는 모습을 보여준다. 사용자가 직접 만지는 화면은 클라이언트 쪽에서 구성되고, 필요한 데이터는 서버와 통신하며 받아온다.

💡 포인트: 프론트엔드는 단순히 예쁜 화면을 만드는 작업이 아니라, **사용자가 보는 화면과 실제 데이터 흐름을 연결하는 작업**이다.

---

### 3.2 Client-side Framework: 복잡한 UI를 효율적으로 만들기 위한 뼈대

Client-side Framework는 클라이언트 측에서 UI와 상호작용을 개발하기 위해 사용하는 JavaScript 기반 프레임워크이다. 대표적으로 Vue, React, Angular가 있다.

쉽게 말하면, 웹 사이트의 사용자 인터페이스를 효율적으로 만들기 위해 미리 마련된 코드의 뼈대라고 볼 수 있다. 복잡한 웹 애플리케이션을 한 덩어리로 만드는 것이 아니라, 가능한 부품 단위로 나누어 레고처럼 조립할 수 있게 도와준다.

Client-side Framework가 필요해진 이유는 웹의 역할이 크게 바뀌었기 때문이다. 예전에는 웹이 단순히 글을 읽고 정보를 확인하는 공간이었다면, 이제는 음악 스트리밍, 영상 재생, 실시간 채팅, 지도 탐색, 소셜 피드처럼 사용자가 계속 조작하는 공간이 되었다. 이런 웹을 **웹 애플리케이션**이라고 부른다.

또 하나의 중요한 이유는 다루는 데이터가 많아졌다는 점이다. 예를 들어 친구가 이름을 변경했다면 친구 목록, 타임라인, 스토리, 댓글 영역 등 친구 이름이 표시되는 모든 곳이 함께 바뀌어야 한다. Vanilla JavaScript만으로 이 모든 DOM 요소를 직접 찾아서 수정하면 코드가 반복되고, 실수도 쉽게 생긴다.

![Vanilla JS만으로 UI를 수정할 때 발생하는 반복 코드](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 183507.png>)

위 예시는 여러 DOM 요소를 직접 선택하고, 각각의 텍스트를 변경하는 흐름을 보여준다. 작은 예제에서는 괜찮아 보이지만, 화면이 커지고 데이터가 많아질수록 같은 패턴의 코드가 계속 반복된다.

```html
<!-- 같은 사용자 이름이 여러 위치에 출력되어 있다고 가정한다. -->
<label for="inputArea">Username:</label>
<input type="text" id="inputArea" name="inputArea">

<p>첫 번째 사용자명: <span id="username1">unknown</span></p>
<p>두 번째 사용자명: <span id="username2">unknown</span></p>
<p>세 번째 사용자명: <span id="username3">unknown</span></p>

<script>
  // 각각의 DOM 요소를 직접 찾아 변수에 저장한다.
  const inputArea = document.querySelector('#inputArea')
  const username1 = document.querySelector('#username1')
  const username2 = document.querySelector('#username2')
  const username3 = document.querySelector('#username3')

  // input 값이 바뀔 때마다 여러 위치의 텍스트를 직접 수정한다.
  inputArea.addEventListener('input', function (event) {
    username1.textContent = event.target.value
    username2.textContent = event.target.value
    username3.textContent = event.target.value
  })
</script>
```

이 코드는 동작 자체는 어렵지 않다. 하지만 이름이 출력되는 위치가 3곳이 아니라 30곳이라면, 또는 이름뿐 아니라 프로필 이미지, 상태 메시지, 알림 목록까지 함께 바뀌어야 한다면 코드 관리가 매우 어려워진다.

⚠️ 주의: DOM을 직접 조작하는 방식은 처음에는 직관적이지만, 화면 상태가 많아질수록 “어떤 데이터가 어디에 반영되어야 하는지”를 개발자가 직접 계속 추적해야 한다. 이 부담을 줄여주는 것이 Vue 같은 Client-side Framework의 중요한 역할이다.

Client-side Framework의 필요성은 다음 세 가지로 정리할 수 있다.

| 필요성 | 의미 |
|---|---|
| 동적이고 반응적인 웹 애플리케이션 개발 | 데이터가 바뀔 때 화면도 자연스럽게 갱신된다. |
| 코드 재사용성 증가 | 컴포넌트 기반으로 화면 조각을 재사용할 수 있다. |
| 개발 생산성 향상 | 반복적인 DOM 조작을 줄이고, 개발 도구의 도움을 받을 수 있다. |

---

### 3.3 SPA: 하나의 페이지에서 필요한 부분만 바꾸는 방식

SPA는 **Single Page Application**의 약자로, 단일 페이지에서 동작하는 웹 애플리케이션을 의미한다. 하나의 HTML 파일 위에서 JavaScript가 필요한 부분만 교체하며, 실제 페이지 이동 없이 앱처럼 작동하는 방식이다.

쉽게 비유하면, 하나의 무대에서 배우와 배경만 계속 바꾸는 연극과 비슷하다. 무대 전체를 매번 새로 만들지 않고, 현재 장면에 필요한 요소만 바꾸는 것이다. 사용자는 페이지 전체가 새로고침되는 느낌 없이 빠르고 부드럽게 화면을 전환할 수 있다.

SPA의 작동 흐름은 다음과 같다.

1. 최초 로드 시 애플리케이션에 필요한 주요 리소스를 다운로드한다.
2. 이후 화면이 바뀔 때는 필요한 데이터만 비동기적으로 받아온다.
3. JavaScript가 클라이언트 측에서 필요한 콘텐츠를 생성하고 화면을 업데이트한다.

여기서 중요한 기술 중 하나가 AJAX와 같은 비동기 통신이다. 전체 HTML을 다시 받는 대신, 필요한 데이터만 서버에서 받아와 화면의 일부를 갱신한다.

📌 핵심: SPA는 “페이지가 하나뿐”이라는 뜻보다, **페이지 전체를 새로고침하지 않고 필요한 화면만 바꾸는 사용자 경험**에 초점이 있다.

---

### 3.4 CSR: 브라우저가 화면을 직접 그리는 방식

CSR은 **Client Side Rendering**의 약자로, 클라이언트에서 콘텐츠를 렌더링하는 방식이다. 서버가 완성된 HTML을 보내주는 것이 아니라, 브라우저가 JavaScript를 실행하여 화면을 완성한다.

비유하면, 서버가 완성된 집을 보내주는 것이 아니라 거의 빈 집과 조립 설명서(JavaScript)를 보내고, 브라우저가 가구를 직접 배치하며 화면을 완성하는 방식이다.

CSR의 작동 원리는 다음과 같다.

1. 사용자가 웹사이트에 요청을 보낸다.
2. 서버는 최소한의 HTML과 JavaScript 파일을 클라이언트로 전송한다.
3. 브라우저는 HTML과 JavaScript를 다운로드한다.
4. JavaScript가 실행되면서 동적으로 페이지 콘텐츠를 생성한다.
5. 필요한 데이터는 API를 통해 서버로부터 비동기적으로 가져온다.

여기서 비동기란 하나의 작업이 끝날 때까지 모든 동작을 멈추고 기다리는 것이 아니라, 요청을 보내놓고 다른 작업을 계속 진행할 수 있는 방식을 말한다.

![CSR 작동 흐름](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 184422.png>)

위 그림처럼 최초 요청에서는 서버가 최소한의 HTML과 JavaScript를 응답한다. 이후에는 서버가 매번 완성된 HTML을 제공하는 것이 아니라, 필요한 데이터만 응답하고 브라우저가 DOM을 업데이트한다. Google Maps, Facebook, Instagram 같은 서비스에서 화면 전환 시 전체 새로고침이 자주 보이지 않는 이유도 이런 구조와 관련이 있다.

> DOM은 JavaScript가 HTML을 조작할 수 있도록 문서 구조를 객체처럼 표현한 모델이다.

CSR과 SPA는 함께 자주 등장하지만 완전히 같은 말은 아니다. SPA는 애플리케이션의 화면 전환 방식에 가까운 개념이고, CSR은 콘텐츠를 어느 쪽에서 렌더링하느냐에 대한 방식이다. 다만 많은 SPA가 CSR 방식으로 구현되기 때문에 같이 묶어서 설명되는 경우가 많다.

---

### 3.5 CSR과 SPA의 장단점: 빠른 전환과 초기 로딩 문제

CSR과 SPA의 가장 큰 장점은 빠른 페이지 전환이다. 최초 로드가 끝난 뒤에는 필요한 데이터만 가져와 화면 일부를 다시 렌더링하면 되므로, 전체 페이지를 새로 받는 방식보다 부드러운 사용자 경험을 제공할 수 있다.

또한 프론트엔드와 백엔드의 역할이 명확하게 나뉜다. 프론트엔드는 UI 렌더링과 사용자 상호작용 처리를 담당하고, 백엔드는 데이터와 API 제공을 담당한다. 이 구조는 대규모 애플리케이션을 개발하고 유지보수할 때 도움이 된다.

반면 단점도 있다.

| 단점 | 이유 |
|---|---|
| 느린 초기 로드 속도 | JavaScript를 다운로드하고 실행해야 화면이 완성된다. |
| SEO 문제 | 검색 엔진이 처음 받은 HTML만 보면 콘텐츠가 부족해 보일 수 있다. |

SEO는 Search Engine Optimization의 약자로, 검색 엔진에 내 서비스나 제품이 잘 노출되도록 개선하는 과정을 말한다. 검색 엔진은 기본적으로 HTML에 작성된 정보를 읽어 분석하는데, CSR에서는 콘텐츠가 JavaScript 실행 이후에 생성되므로 검색 노출에 불리할 수 있다.

다만 최근에는 Node.js 기반의 하이브리드 프레임워크가 발전하면서 이 단점이 많이 완화되었다. Vue 생태계에서는 Nuxt.js, React 생태계에서는 Next.js가 대표적이다. 이들은 SEO와 초기 로딩 문제를 보완하면서도 SPA의 장점을 함께 활용할 수 있도록 도와준다.

⚠️ 주의: CSR과 SSR은 흑과 백처럼 하나만 정답인 관계가 아니다. 서비스의 목적, 규모, 성능 요구사항, SEO 중요도에 따라 적절한 렌더링 방식을 선택해야 한다.

---

### 3.6 MPA, SSR과 비교해서 SPA/CSR 이해하기

SPA와 CSR을 더 분명히 이해하려면 반대편 개념인 MPA와 SSR도 함께 봐야 한다.

MPA는 **Multi Page Application**으로, 여러 개의 HTML 파일이 서버로부터 각각 로드되는 방식이다. 사용자가 다른 페이지로 이동할 때마다 서버에서 새로운 HTML 문서를 받아온다.

SSR은 **Server Side Rendering**으로, 서버에서 화면을 렌더링하는 방식이다. 서버가 데이터를 포함한 완성된 HTML을 만든 뒤 클라이언트에게 전달한다.

| 구분 | 의미 | 특징 |
|---|---|---|
| SPA | 하나의 페이지에서 필요한 부분만 바꿈 | 앱처럼 부드러운 전환 |
| MPA | 페이지 이동마다 새 HTML을 받음 | 전통적인 웹 페이지 구조 |
| CSR | 브라우저가 JavaScript로 화면을 그림 | 초기 로딩 이후 상호작용이 빠름 |
| SSR | 서버가 완성된 HTML을 만들어 보냄 | 초기 화면과 SEO에 유리 |

이 비교에서 중요한 점은 SPA/MPA와 CSR/SSR이 서로 다른 기준의 분류라는 것이다. 하나는 페이지 구성 방식이고, 다른 하나는 화면을 어디서 렌더링하느냐의 차이다.

---

### 3.7 Vue: UI를 쉽고 빠르게 만들기 위한 JavaScript 프레임워크

Vue는 사용자 인터페이스를 구축하기 위한 JavaScript 프레임워크이다. 웹사이트 UI를 쉽고 빠르게 만들 수 있게 도와주며, 데이터를 바꾸면 화면도 자동으로 바뀌는 반응성이 큰 특징이다.

Vue는 Evan You가 발표한 프레임워크이며, 현재 강의에서는 Vue 3를 기준으로 학습한다. Vue는 간결하고 직관적인 문법을 가지고 있어 처음 배우는 사람도 비교적 접근하기 쉽고, 작은 프로젝트부터 대규모 애플리케이션까지 유연하게 사용할 수 있다.

Vue를 학습하는 이유는 다음과 같이 정리할 수 있다.

| 이유 | 설명 |
|---|---|
| 낮은 학습 곡선 | 문법이 간결하고 공식 문서가 잘 정리되어 있다. |
| 확장성과 생태계 | 다양한 플러그인과 라이브러리를 활용할 수 있다. |
| 유연성 및 성능 | 작은 프로젝트부터 큰 애플리케이션까지 적용 가능하다. |
| 주목받는 프레임워크 | Vue, React, Angular는 대표적인 Client-side Framework이다. |

Vue의 핵심 기능은 크게 두 가지다.

1. **선언적 렌더링**  
   JavaScript 상태를 기반으로 화면에 출력될 HTML을 선언적으로 작성한다. 즉, DOM을 하나하나 직접 바꾸기보다 “이 데이터가 화면에 이렇게 보여야 한다”라고 템플릿에 적는다.

2. **반응성**  
   JavaScript 상태 변경을 추적하고, 변경 사항이 발생하면 자동으로 DOM을 업데이트한다.

📌 핵심: Vue는 화면을 직접 조작하는 코드를 줄이고, **데이터와 화면의 관계를 선언해두면 Vue가 변경 사항을 추적해 화면을 갱신하는 방식**으로 동작한다.

---

### 3.8 Component: 재사용 가능한 UI 블록

컴포넌트는 재사용 가능한 코드 블록이다. UI를 독립적이고 재사용 가능한 일부분으로 분할하고, 각 부분을 개별적으로 다룰 수 있게 해준다.

![컴포넌트 트리 구조](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 190017.png>)

위 그림처럼 애플리케이션은 자연스럽게 중첩된 컴포넌트 트리 형태로 구성된다. 최상위에 Root 컴포넌트가 있고, 그 아래에 Header, Main, Aside, Article, Item 같은 하위 컴포넌트가 들어갈 수 있다.

![웹 서비스의 컴포넌트 예시](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 190053.png>)

실제 웹 서비스도 여러 개의 컴포넌트로 이루어진다. 메뉴 영역, 프로필 영역, 콘텐츠 카드, 버튼, 입력창처럼 역할이 분명한 화면 조각을 컴포넌트로 나누면 재사용과 유지보수가 쉬워진다.

💡 포인트: 컴포넌트는 단순히 코드를 나누는 기술이 아니라, **복잡한 화면을 역할 단위로 사고하는 방식**이다.

---

### 3.9 Vue를 시작하는 방법: CDN과 NPM

Vue를 시작하는 방법은 크게 두 가지가 있다.

1. **CDN 방식**  
   HTML 파일에서 Vue 라이브러리를 `<script>` 태그로 불러와 사용하는 방식이다. 간단한 실습이나 개념 학습에 적합하다.

2. **NPM 방식**  
   Vite 같은 빌드 도구와 함께 Vue 프로젝트를 생성하여 사용하는 방식이다. 실제 프로젝트 개발에서 주로 사용한다.

이번 강의의 기본 예시는 CDN 방식을 중심으로 Vue 앱 인스턴스를 생성하는 흐름을 살펴본다. CDN 방식에서는 브라우저가 전역 `Vue` 객체를 사용할 수 있게 된다.

---

### 3.10 Vue Application 생성: createApp에서 mount까지

Vue 애플리케이션은 `createApp()` 함수로 새 Application instance를 생성하는 것으로 시작한다. 그리고 생성된 앱 인스턴스를 HTML의 특정 요소에 `mount()`로 연결한다.

![Vue CDN 작성](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 190228.png>)

가장 먼저 HTML에서 Vue CDN을 불러온다.

```html
<!-- vue_instance.html -->

<!-- Vue 앱이 연결될 HTML 요소 -->
<div id="app"></div>

<!-- CDN 방식으로 Vue 3 전역 빌드 파일을 불러온다. -->
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>

<script>
  // Vue 객체에서 createApp 함수를 꺼내온다.
  const { createApp } = Vue

  // Vue 애플리케이션 인스턴스를 생성한다.
  const app = createApp({
    // setup은 컴포넌트의 데이터와 함수를 준비하는 시작점이다.
    setup() {
    }
  })

  // id가 app인 HTML 요소에 Vue 앱을 연결한다.
  app.mount('#app')
</script>
```

위 코드의 흐름은 네 단계로 볼 수 있다.

#### 1단계: Vue 객체에서 `createApp` 꺼내기

![createApp 구조분해할당](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 190412.png>)

```js
// Vue 객체 안에 들어 있는 createApp 함수를 꺼내서 사용한다.
const { createApp } = Vue
```

CDN에서 Vue를 사용하는 경우 전역 `Vue` 객체를 불러오게 된다. 이 객체 안에 있는 `createApp` 함수를 구조분해할당 문법으로 꺼내 사용한다.

#### 2단계: Application instance 생성하기

![Application instance 생성](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 190530.png>)

```js
// createApp 함수에 컴포넌트 객체를 전달하여 앱 인스턴스를 만든다.
const app = createApp({
  setup() {
  }
})
```

모든 Vue 애플리케이션은 `createApp()`으로 새 Application instance를 만드는 것에서 시작한다. 이때 `createApp()`에 전달되는 객체는 Vue 컴포넌트라고 볼 수 있다.

#### 3단계: Root Component 이해하기

![Root Component](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 190717.png>)

`createApp()`에 전달되는 객체는 현재 앱의 Root Component 역할을 한다. 모든 Vue 앱에는 다른 컴포넌트들을 하위 컴포넌트로 포함할 수 있는 최상위 컴포넌트가 필요하다.

지금 예제에서는 아직 컴포넌트를 여러 개로 나누지 않았기 때문에, `createApp()`에 전달된 객체 하나가 곧 전체 앱의 루트 컴포넌트가 된다.

#### 4단계: `mount()`로 HTML 요소에 연결하기

![mount로 HTML 요소에 Vue 앱 연결](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 190840.png>)

```js
// Vue 앱을 실제 HTML 요소에 탑재한다.
app.mount('#app')
```

`mount()`는 Vue Application instance를 HTML 요소에 연결하는 역할을 한다. 위 코드에서는 `id="app"`인 요소에 Vue 앱을 연결한다.

⚠️ 주의: 각 앱 인스턴스에 대해 `mount()`는 한 번만 호출될 수 있다. 같은 앱 인스턴스를 여러 요소에 동시에 연결하는 방식으로 사용하지 않는다.

---

### 3.11 setup(): 컴포넌트가 동작하기 전에 준비하는 시작점

`setup()` 함수는 컴포넌트가 동작하기 전에 필요한 데이터와 함수를 준비하는 시작점이다. 이 함수 안에서 화면에 표시할 값, 클릭했을 때 실행할 함수, 계산에 필요한 로직 등을 정의할 수 있다.

![setup 함수](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 191015.png>)

```js
const app = createApp({
  setup() {
    // 이 안에서 컴포넌트가 사용할 데이터와 함수를 준비한다.
  }
})
```

다만 `setup()` 안에서 변수를 선언했다고 해서 바로 템플릿에서 사용할 수 있는 것은 아니다. CDN 방식의 기본 예제에서는 템플릿에서 사용할 값을 `return`으로 객체 형태로 반환해야 한다.

---

### 3.12 ref(): Vue가 변화를 감지할 수 있는 반응형 상태 만들기

`ref()`는 반응형 상태를 선언하는 함수이다. 일반 JavaScript 변수를 Vue가 변화를 감지할 수 있는 반응형 객체로 만들어준다.

컴포넌트 안에서 값이 변하고, 그 값이 화면에도 반영되어야 한다면 `ref()`를 사용한다. 예를 들어 숫자, 문자열, input 값처럼 상태가 바뀌는 데이터를 추적하고 관리할 때 사용한다.

![ref 함수와 .value](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 191303.png>)

```js
// Vue 객체에서 createApp과 ref를 꺼내온다.
const { createApp, ref } = Vue

const app = createApp({
  setup() {
    // message는 반응형 상태가 된다.
    const message = ref('Hello vue!')

    // ref로 만든 값은 내부적으로 객체 형태이다.
    console.log(message)       // ref 객체 자체가 출력된다.

    // JavaScript 코드 안에서 실제 값에 접근할 때는 .value를 사용한다.
    console.log(message.value) // 'Hello vue!' 출력
  }
})
```

`ref()`로 만든 변수는 `.value` 속성이 있는 ref 객체로 감싸진다. 이처럼 어떤 값을 감싸서 Vue가 추적할 수 있는 형태로 만드는 것을 wrapping이라고 볼 수 있다.

여기서 처음에는 왜 굳이 `.value`를 써야 하는지 어색할 수 있다. 하지만 Vue는 이 객체를 통해 값이 읽히고 변경되는 시점을 추적한다. 값이 변경되면, 그 값을 사용하는 템플릿을 자동으로 다시 렌더링할 수 있다.

---

### 3.13 setup에서 반환한 값은 템플릿에서 사용할 수 있다

`setup()`에서 만든 값을 템플릿에서 사용하려면 반환해야 한다. 반환된 객체의 속성은 템플릿에서 사용할 수 있다.

![setup에서 message 반환](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 191400.png>)

```js
const app = createApp({
  setup() {
    // 반응형 문자열 상태를 만든다.
    const message = ref('Hello vue!')

    // 템플릿에서 사용할 수 있도록 객체로 반환한다.
    return {
      message,
    }
  }
})
```

![Vue 기본 구조와 return 객체](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 191623.png>)

Vue 컴포넌트의 상태는 `setup()` 함수 안에서 선언하고, 템플릿에서 사용할 값은 반드시 객체로 반환해야 한다.

⚠️ 주의: `setup()` 안에 변수를 선언했는데 화면에서 값이 보이지 않는다면, 그 변수를 `return`에 넣었는지 먼저 확인해야 한다.

---

### 3.14 Mustache Syntax: `{{ }}`로 데이터를 화면에 출력하기

Mustache Syntax, 즉 콧수염 구문은 `{{ }}` 안에 값을 넣어 템플릿에서 동적 텍스트를 렌더링하는 문법이다.

동적 텍스트는 변수 값에 따라 실시간으로 바뀌는 텍스트를 의미한다. 예를 들어 `message` 값이 바뀌면, `{{ message }}`를 사용하는 화면도 함께 바뀐다.

![Mustache Syntax로 message 출력](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 191733.png>)

```html
<div id="app">
  <!-- setup에서 반환한 message 값을 화면에 출력한다. -->
  <h1>{{ message }}</h1>
</div>
```

템플릿에서는 `ref`를 사용할 때 `.value`를 작성하지 않아도 된다. Vue가 편의상 자동으로 언래핑(unwrapping)해주기 때문이다.

```html
<!-- 템플릿에서는 message.value가 아니라 message라고 쓴다. -->
<h1>{{ message }}</h1>
```

반면 JavaScript 코드 안에서는 실제 값에 접근하거나 값을 수정할 때 `.value`를 사용해야 한다.

```js
// JavaScript 영역에서는 .value로 실제 값에 접근한다.
console.log(message.value)
```

Mustache 구문 안에는 단순 변수뿐 아니라 유효한 JavaScript 표현식도 사용할 수 있다.

![Mustache Syntax 안에서 JavaScript 표현식 사용](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 191825.png>)

```html
<!-- 문자열을 글자 단위로 나눈 뒤, 뒤집고, 다시 합쳐 출력한다. -->
<h1>{{ message.split('').reverse().join('') }}</h1>
```

위 표현식은 `message` 문자열을 뒤집어서 출력한다. 다만 템플릿 안에 너무 복잡한 로직을 많이 넣으면 가독성이 떨어질 수 있으므로, 실제 프로젝트에서는 계산 로직을 따로 정리하는 방식도 함께 고려해야 한다.

📌 핵심: `{{ }}`는 단순 출력 문법이 아니라, **Vue의 데이터와 화면을 연결하는 가장 기본적인 템플릿 문법**이다.

---

### 3.15 v-on: 사용자 이벤트를 받아 상태를 바꾸기

`v-on` directive는 DOM 이벤트를 수신할 때 사용한다. 버튼 클릭, input 입력, form 제출 같은 사용자 행동에 반응하여 함수를 실행할 수 있다.

![v-on directive를 사용한 이벤트 처리](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 191923.png>)

```html
<div id="app">
  <!-- 버튼을 클릭하면 increment 함수가 실행된다. -->
  <button v-on:click="increment">버튼</button>

  <!-- number 값이 화면에 출력된다. -->
  <p>{{ number }}</p>
</div>

<script>
  const { createApp, ref } = Vue

  const app = createApp({
    setup() {
      // 화면에 출력될 숫자를 반응형 상태로 만든다.
      const number = ref(0)

      // 버튼을 클릭했을 때 실행할 함수이다.
      const increment = function () {
        // JavaScript 영역에서 ref 값을 바꿀 때는 .value를 사용한다.
        number.value++
      }

      // 템플릿에서 사용할 값과 함수를 반환한다.
      return {
        number,
        increment,
      }
    }
  })

  app.mount('#app')
</script>
```

이 코드의 흐름은 다음과 같다.

1. `number`는 `ref(0)`으로 만들어진 반응형 상태이다.
2. 사용자가 버튼을 클릭하면 `v-on:click="increment"`에 의해 `increment` 함수가 실행된다.
3. 함수 안에서 `number.value++`가 실행되어 숫자가 증가한다.
4. Vue는 `number`의 변경을 감지하고, `{{ number }}`가 있는 화면을 자동으로 업데이트한다.

`v-on:click`은 자주 사용되기 때문에 축약 문법으로 다음처럼 쓸 수도 있다.

```html
<button @click="increment">버튼</button>
```

⚠️ 주의: `ref` 값을 JavaScript 코드에서 수정할 때는 `number++`가 아니라 `number.value++`를 사용해야 한다. 템플릿에서는 자동 언래핑이 되지만, JavaScript 코드에서는 ref 객체의 실제 값이 `.value` 안에 들어 있기 때문이다.

---

### 3.16 ref 객체가 필요한 이유: 변경 감지를 위해 객체로 감싼다

처음 Vue를 배울 때 가장 자주 드는 의문은 이것이다.

> 왜 그냥 일반 변수를 쓰지 않고 `ref()`라는 함수를 사용해야 할까?

이유는 Vue가 값의 변경을 추적해야 하기 때문이다. 일반 JavaScript 변수는 값이 바뀌었다는 사실을 Vue가 자동으로 감지하기 어렵다. 그래서 Vue는 값을 ref 객체로 감싸고, 렌더링 중에 사용된 ref를 추적한다. 이후 ref의 값이 변경되면 해당 ref를 사용하는 컴포넌트를 다시 렌더링한다.

이것을 의존성 추적 기반의 반응형 시스템이라고 볼 수 있다. 쉽게 말하면, Vue가 “이 화면은 어떤 데이터를 사용하고 있는지”를 기억해두었다가, 그 데이터가 바뀌면 화면을 다시 그리는 방식이다.

---

### 3.17 반응형 변수와 일반 변수의 차이

`ref`는 값이 바뀌면 화면이 자동으로 업데이트되지만, 일반 변수는 값이 바뀌어도 화면 갱신과 연결되지 않는다.

![반응형 변수와 일반 변수 비교](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 192226.png>)

```html
<div id="app">
  <p>반응형 변수: {{ reactiveValue }}</p>
  <p>일반 변수: {{ normalValue }}</p>
  <button @click="updateValues">값 업데이트</button>
</div>

<script>
  const { createApp, ref } = Vue

  const app = createApp({
    setup() {
      // Vue가 변경을 추적할 수 있는 반응형 값이다.
      const reactiveValue = ref(0)

      // 일반 JavaScript 변수이다. 값은 바뀔 수 있지만 화면 갱신 추적 대상은 아니다.
      let normalValue = 0

      const updateValues = function () {
        // ref 값은 .value로 수정한다.
        reactiveValue.value++

        // 일반 변수도 값 자체는 증가한다.
        // 하지만 Vue가 이 변경을 화면 갱신 신호로 추적하지 않는다.
        normalValue++
      }

      return {
        reactiveValue,
        normalValue,
        updateValues,
      }
    }
  })

  app.mount('#app')
</script>
```

버튼을 눌렀을 때 `reactiveValue`는 화면에서 증가하는 것을 확인할 수 있다. 반면 `normalValue`는 JavaScript 내부에서는 값이 바뀌더라도 Vue의 반응형 추적 대상이 아니므로 화면이 기대처럼 갱신되지 않을 수 있다.

⚠️ 주의: 화면에 보여야 하고 값이 바뀌는 데이터라면 일반 변수보다 `ref()`를 우선 생각해야 한다. 일반 변수는 Vue의 자동 화면 갱신 흐름에 들어오지 않는다.

---

### 3.18 Ref Unwrap 주의사항: 템플릿에서 항상 자동으로 풀리는 것은 아니다

Vue 템플릿에서는 `ref` 값을 사용할 때 보통 `.value`를 쓰지 않아도 된다. 이를 Ref Unwrap이라고 한다. 하지만 이 자동 언래핑은 모든 상황에서 똑같이 적용되지 않는다.

템플릿에서의 unwrap은 `ref`가 `setup()`에서 반환된 객체의 **최상위 속성**일 경우에만 적용된다.

![Ref Unwrap 주의 예시](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 192325.png>)

```js
// object는 최상위 속성이지만, object.id는 object 내부의 속성이다.
const object = { id: ref(0) }
```

```html
<!-- object.id가 자동으로 완전히 unwrap되지 않아 의도와 다른 결과가 나올 수 있다. -->
{{ object.id + 1 }}  <!-- [object Object]1 -->
```

`[object Object]1`이 출력되는 이유는 `object.id`가 최상위 속성이 아니기 때문이다. 표현식을 평가할 때 `object.id`가 숫자 `0`으로 풀리는 것이 아니라 ref 객체로 남아 있고, 여기에 `+ 1` 연산이 붙으면서 예상과 다른 결과가 나온다.

이 문제를 해결하려면 `id`를 객체에서 분해하여 최상위 속성으로 만들어야 한다.

![객체에서 id를 분해하여 최상위 속성으로 만들기](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 192454.png>)

```js
const object = { id: ref(0) }

// id를 최상위 속성으로 꺼내서 반환하면 템플릿에서 자동 unwrap이 가능하다.
const { id } = object
```

```html
{{ id + 1 }}  <!-- 1 -->
```

다만 ref가 Mustache 구문의 최종 평가 값인 경우에는 unwrap이 가능하다.

![최종 평가 값으로 사용될 때의 unwrap](<../assets/images/05_26_Introduce_of_Vue/화면 캡처 2026-06-01 192525.png>)

```html
<!-- object.id 자체가 최종 평가 값이면 값으로 출력된다. -->
{{ object.id }}  <!-- 0 -->

<!-- 명시적으로 .value를 작성해도 값에 접근할 수 있다. -->
{{ object.id.value }}  <!-- 0 -->
```

⚠️ 주의: 템플릿에서 `.value`를 안 써도 된다는 말만 외우면 `object.id + 1` 같은 상황에서 막히기 쉽다. 자동 unwrap은 “setup 반환 객체의 최상위 속성”을 기준으로 먼저 이해해야 한다.

---

### 3.19 SEO와 CSR/SSR 선택 관점

SEO는 Search Engine Optimization의 약자로, Google, Bing 같은 검색 엔진에 내 서비스나 제품이 효율적으로 노출되도록 개선하는 과정을 말한다. 검색 엔진은 웹에 존재하는 정보를 긁어 모으는 방식으로 동작하며, 정보의 대상은 주로 HTML에 작성된 내용이다.

CSR 기반 SPA는 처음 받은 HTML에 실제 콘텐츠가 충분히 들어 있지 않을 수 있다. JavaScript가 실행된 뒤에야 화면 내용이 만들어지기 때문이다. 그래서 전통적으로 CSR 기반 SPA는 SEO에 불리하다는 단점이 있었다.

하지만 최근에는 검색 엔진이 JavaScript를 지원하는 방향으로 발전하고 있고, SPA 서비스에서도 SSR을 지원하는 프레임워크가 많이 발전했다.

- Vue의 Nuxt.js
- React의 Next.js

이번 강의의 마지막 관점은 이 부분이다.

> CSR과 SSR은 흑과 백이 아니다. 애플리케이션의 목적, 규모, 성능, SEO 요구사항에 따라 적절한 렌더링 방식을 선택해야 한다.

즉, Vue를 배운다는 것은 단순히 문법을 배우는 것을 넘어, 어떤 서비스에 어떤 렌더링 방식과 구조가 적합한지 판단할 수 있는 기반을 쌓는 과정이기도 하다.

---

## 4. 적용 관점에서 다시 보기

이번 강의 내용을 실제 구현 관점에서 떠올릴 때는 다음 흐름으로 정리하면 좋다.

먼저 웹 화면이 복잡해지고 데이터가 여러 곳에 동시에 반영되어야 하는 상황이라면, Vanilla JavaScript로 DOM을 직접 수정하는 방식보다 Client-side Framework를 떠올릴 수 있다. 특히 화면을 작은 UI 단위로 나누고, 데이터 변화에 따라 자동으로 화면이 바뀌어야 한다면 Vue의 컴포넌트와 반응성 개념이 자연스럽게 연결된다.

Vue CDN 실습에서는 다음 순서가 기본이다.

1. HTML에 Vue가 연결될 요소를 만든다. 예를 들어 `<div id="app"></div>`를 준비한다.
2. Vue CDN을 `<script>` 태그로 불러온다.
3. `const { createApp } = Vue`로 앱 생성 함수를 꺼낸다.
4. `createApp({ setup() { ... } })`으로 앱 인스턴스를 만든다.
5. 화면에 사용할 데이터는 `ref()`로 만들고, 템플릿에서 사용할 수 있도록 `return`한다.
6. `app.mount('#app')`으로 Vue 앱을 HTML 요소에 연결한다.

사용자 이벤트가 있는 문제에서는 `v-on` 또는 `@`를 떠올리면 된다. 버튼 클릭으로 숫자를 증가시키거나, 특정 함수를 실행해야 한다면 `@click="함수명"` 형태로 이벤트를 연결하고, 함수 안에서 `ref` 값의 `.value`를 수정한다.

실전에서 자주 틀리는 부분은 세 가지다.

- `setup()`에서 변수를 만들고 `return`하지 않아 템플릿에서 사용할 수 없는 경우
- JavaScript 코드에서 `ref` 값을 수정할 때 `.value`를 빠뜨리는 경우
- 템플릿에서 ref unwrap이 항상 되는 줄 알고 객체 내부의 ref를 표현식에 바로 사용하는 경우

이 세 가지를 조심하면 Vue 입문 코드의 흐름을 훨씬 안정적으로 읽을 수 있다.

---

## 5. 배운 점 / 확장 포인트

### 1. 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

Vue는 단순히 HTML을 더 편하게 쓰는 문법이 아니라, 데이터 변화와 화면 갱신을 연결해주는 반응형 시스템을 제공한다는 점이 핵심이다. 특히 `ref()`를 통해 Vue가 값을 추적하고, 그 값을 사용하는 템플릿을 자동으로 업데이트한다는 흐름을 이해하는 것이 중요하다.

### 2. 앞으로 이어지는 연결점

이번 강의에서 배운 `createApp`, `setup`, `ref`, `{{ }}`, `v-on`은 이후 SFC, Vite 프로젝트, 컴포넌트 분리, `v-model`, `props`, `emit` 같은 Vue 문법으로 이어진다. 즉, 이번 내용은 Vue 프로젝트 구조를 배우기 전에 반드시 필요한 기초 문법이다.

### 3. 더 파볼 만한 주제

CSR과 SSR의 차이를 더 깊게 이해하면 Nuxt.js 같은 프레임워크가 왜 등장했는지 자연스럽게 연결된다. 또한 Vue의 반응형 시스템을 더 공부하면 `reactive`, `computed`, `watch`처럼 상태 변화를 다루는 더 다양한 도구도 이해할 수 있다.

---

## 6. 요약 정리

📌 핵심: 현대 웹은 단순한 문서가 아니라 사용자가 계속 조작하는 웹 애플리케이션이 되었고, 이 복잡한 UI 상태를 효율적으로 관리하기 위해 Client-side Framework가 필요해졌다.

🧠 기억할 것:

- SPA는 하나의 페이지에서 필요한 부분만 바꾸며 동작하는 웹 애플리케이션 방식이다.
- CSR은 브라우저가 JavaScript를 실행하여 화면을 완성하는 렌더링 방식이다.
- Vue는 선언적 렌더링과 반응성을 핵심으로 하는 JavaScript 프레임워크이다.
- `createApp()`은 Vue 앱 인스턴스를 만들고, `mount()`는 그 앱을 HTML 요소에 연결한다.
- `setup()`은 컴포넌트가 사용할 데이터와 함수를 준비하는 시작점이다.
- `ref()`는 Vue가 변경을 추적할 수 있는 반응형 상태를 만든다.
- JavaScript 코드에서 ref의 실제 값에 접근하거나 수정할 때는 `.value`를 사용한다.
- 템플릿에서는 `{{ }}`로 데이터를 출력하고, `v-on` 또는 `@`로 이벤트를 처리한다.
- Ref Unwrap은 편리하지만, 객체 내부 ref 표현식에서는 주의가 필요하다.
- CSR과 SSR은 서비스 목적과 SEO 요구사항에 따라 선택해야 하는 렌더링 전략이다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. Client-side Framework가 필요한 이유를 “데이터 변경과 UI 갱신” 관점에서 설명할 수 있는가?
2. SPA와 CSR의 차이를 각각 “페이지 구성 방식”과 “렌더링 위치” 기준으로 구분할 수 있는가?
3. `createApp()`과 `mount()`가 각각 어떤 역할을 하는지 설명할 수 있는가?
4. `ref()`로 만든 값을 JavaScript 코드와 템플릿에서 각각 어떻게 사용하는지 설명할 수 있는가?
5. 버튼을 클릭했을 때 숫자가 증가하는 Vue 코드를 작성한다면, `v-on`, 함수, `.value`, `return`이 각각 어디에 들어가야 하는지 떠올릴 수 있는가?
6. `{{ object.id + 1 }}`에서 `object.id`가 ref일 때 예상과 다른 결과가 나올 수 있는 이유를 설명할 수 있는가?
7. CSR 기반 SPA가 SEO에서 불리할 수 있는 이유와 이를 보완하는 프레임워크 예시를 말할 수 있는가?
