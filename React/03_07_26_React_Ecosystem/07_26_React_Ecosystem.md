# React 생태계와 도구 선택

- 🎯 글의 목표: React, SPA, React Router, React 프레임워크, React Native의 역할을 구분하고 프로젝트 목적에 맞는 출발점을 판단할 수 있다.
- 🧩 핵심 키워드: SPA, React Router, Framework, Next.js, React Native, Expo, React Foundation
- ⭐ 중요도: ★★★☆☆ — React 핵심 개념을 익힌 뒤 실제 프로젝트 방향을 선택할 때 필요하다.
- 📝 한눈에 보는 내용: React는 UI에 집중하므로 라우팅, 서버 데이터, 빌드, 네이티브 앱 같은 요구사항은 다른 도구와 결합한다. 선택지는 유행보다 프로젝트가 해결해야 할 문제를 기준으로 판단한다.
- 🧱 선수 지식: React 컴포넌트, props, state
- 🔗 이전 학습:
  - [React 입문](../01_07_26_React_Introduction/07_26_React_Introduction.md)
  - [Vite로 React 프로젝트 시작하기](../02_07_26_React_Project_Setup_with_Vite/07_26_React_Project_Setup_with_Vite.md)

---

## 1. 들어가며

React를 배우기 시작하면 여러 이름을 한꺼번에 만나게 된다.

```text
React
React Router
Vite
Next.js
React Native
Expo
TanStack Query
```

이 이름을 모두 React의 일부라고 생각하면 각 도구의 역할이 섞인다. 먼저 React가 담당하는 범위를 잡고, 나머지가 어떤 문제를 해결하는지 분리해야 한다.

```text
React
→ 컴포넌트와 UI 렌더링

주변 생태계
→ 라우팅, 데이터 로딩, 빌드, 서버 기능, 모바일 개발
```

---

## 2. 핵심 개념 정리

프로젝트 선택은 다음 질문에서 시작한다.

```text
브라우저 UI 일부만 필요한가?
→ 기존 프로젝트에 React 추가 가능

React 기본 원리를 학습하는가?
→ Vite 기반 작은 프로젝트

라우팅과 데이터 로딩이 있는 신규 웹 서비스인가?
→ React 프레임워크 우선 검토

Android와 iOS 앱이 목표인가?
→ React Native와 Expo 검토
```

도구를 “무엇이 더 좋은가”로 비교하지 말고 “어떤 문제를 해결하는가”로 구분한다.

---

## 3. 본문 정리

### 3.1 React는 SPA와 같은 말이 아니다

SPA는 `Single Page Application`의 약자다. 최초 HTML 문서와 JavaScript 애플리케이션을 불러온 뒤, 페이지 전체를 매번 새로고침하지 않고 필요한 UI를 바꾸는 애플리케이션 방식이다.

```text
React로 SPA를 만들 수 있다.
→ 맞음

React 자체가 SPA다.
→ 틀림
```

React는 기존 HTML 페이지의 일부에 작은 위젯으로 추가할 수도 있다.

```html
<body>
  <h1>기존 HTML 페이지</h1>
  <div id="react-widget"></div>
</body>
```

반대로 전체 화면을 React로 구성하고 라우터를 결합해 SPA를 만들 수도 있다.

📌 핵심: SPA는 애플리케이션 구성 방식이고 React는 UI 라이브러리다.

---

### 3.2 라우터는 URL과 화면을 연결한다

React 자체는 URL에 따라 어떤 화면을 보여줄지 모두 결정하는 라우터가 아니다.

```text
/
→ Home

/products
→ ProductList

/products/1
→ ProductDetail
```

React Router 같은 도구는 현재 URL과 렌더링할 컴포넌트를 연결한다. 라우팅이 필요하면 다음 요구도 함께 생기는 경우가 많다.

- 중첩된 화면 구조
- 페이지별 데이터 로딩
- 로딩 및 오류 UI
- 코드 분할
- 폼 제출과 탐색 상태

따라서 신규 서비스에서는 라우팅만 별도로 추가할지, 라우팅과 데이터 로딩을 통합한 프레임워크를 사용할지 판단해야 한다.

---

### 3.3 빌드 도구와 프레임워크를 구분한다

라이브러리와 프레임워크를 구분할 때는 제공 범위와 애플리케이션 구조를 본다.

| 도구 | 중심 역할 |
|---|---|
| React | 컴포넌트와 UI 렌더링 |
| Vite | 개발 서버와 프로덕션 빌드 |
| React Router | URL, 화면 전환, 라우팅 데이터 흐름 |
| Next.js | React 기반 라우팅·렌더링·서버 기능을 통합한 프레임워크 |

React 공식 문서는 신규 앱에 프레임워크 사용을 우선 권장한다. 다만 React 기본 원리를 배우거나 기존 프레임워크가 요구사항에 맞지 않으면 Vite 같은 빌드 도구에서 직접 시작할 수 있다.

⚠️ 주의: Vite와 Next.js는 같은 종류의 도구가 아니다. Vite는 빌드 환경이고 Next.js는 더 넓은 애플리케이션 구조를 제공한다.

---

### 3.4 Next.js는 React 기반 웹 프레임워크다

React만 사용하면 프로젝트가 필요로 하는 다음 기능을 직접 선택해야 한다.

- URL 라우팅
- 서버와 클라이언트 렌더링
- 데이터 가져오기
- 코드 분할
- 이미지와 폰트 최적화
- 서버 기능
- 빌드와 배포 구조

Next.js는 이런 기능을 React 애플리케이션 구조 안에 통합한다.

```text
React
→ UI 컴포넌트와 렌더링 기반

Next.js
→ React를 사용하면서 라우팅·렌더링·서버 기능 통합
```

Next.js를 쓴다고 모든 페이지가 반드시 서버에서 동적으로 실행되는 것은 아니다. 프로젝트와 페이지 요구에 따라 클라이언트 렌더링, 정적 생성, 서버 렌더링 등을 선택할 수 있다.

---

### 3.5 서버 데이터와 UI state를 구분한다

모달의 열림 여부처럼 브라우저 UI 안에서만 필요한 값은 지역 state로 관리하기 좋다. 반면 서버에서 가져오는 상품 목록에는 다른 문제가 있다.

- 요청 중 상태
- 성공과 실패
- 캐시와 재요청
- 중복 요청 방지
- 데이터 갱신

작은 실습에서는 `fetch`와 state만으로 배울 수 있다. 프로젝트가 커지면 프레임워크의 데이터 로딩 기능이나 TanStack Query 같은 서버 상태 도구를 검토할 수 있다.

⚠️ 주의: 모든 서버 데이터를 무조건 전역 state 저장소에 복사하는 것은 좋은 설계가 아니다. 데이터의 원본과 갱신 책임을 먼저 확인한다.

---

### 3.6 React Native는 웹페이지를 모바일에 띄우는 도구가 아니다

React Native는 React의 컴포넌트 모델을 활용해 Android와 iOS 앱을 개발하는 프레임워크다.

React 웹에서는 HTML 요소를 사용한다.

```jsx
function WebButton() {
  return <button>웹 버튼</button>
}
```

React Native에서는 플랫폼 네이티브 UI에 연결되는 컴포넌트를 사용한다.

```jsx
import { Button, View } from 'react-native'

function NativeScreen() {
  return (
    <View>
      <Button
        title="네이티브 버튼"
        onPress={() => {}}
      />
    </View>
  )
}
```

JavaScript와 React 지식을 활용할 수 있지만 모든 기능을 같은 코드로 해결하는 것은 아니다.

- 플랫폼별 권한
- 카메라와 알림 같은 네이티브 기능
- Android와 iOS의 UI 차이
- 고성능 애니메이션과 그래픽
- 특정 플랫폼 SDK

Expo는 React Native 앱의 시작과 여러 네이티브 기능 사용을 돕는 React 프레임워크다.

---

### 3.7 React, Vue, Angular를 이름만으로 비교하지 않는다

| 도구 | 간단한 구분 |
|---|---|
| React | 컴포넌트 기반 UI 라이브러리 |
| Vue | 컴포넌트 기반 JavaScript 프레임워크 |
| Angular | Google이 개발하는 웹 애플리케이션 프레임워크 |
| AngularJS | Angular 이전의 1.x 프레임워크로 장기 지원 종료 |

지원이 종료된 것은 Angular가 아니라 AngularJS 1.x다. 또한 선택할 때 “무엇이 무조건 최고인가”보다 팀 경험, 기존 코드, 생태계, 프로젝트 요구사항을 함께 본다.

---

### 3.8 React의 지원 주체가 React Foundation으로 바뀌었다

React는 Meta에서 시작한 오픈소스 프로젝트다. 2026년 2월 React, React Native, JSX와 관련 프로젝트의 소유권은 독립 조직인 React Foundation으로 이전되었다.

React Foundation은 Linux Foundation 산하에서 운영된다. Meta는 여러 창립 회원 중 하나로 계속 참여한다.

이 내용은 React 코드 작성법에는 직접 영향을 주지 않지만, “React는 현재 Meta가 단독 소유한다”는 설명을 최신 상태로 바로잡는 데 의미가 있다.

---

### 3.9 React 생태계의 장점과 부담

#### 장점

- 컴포넌트로 UI를 구조화할 수 있다.
- props를 활용해 UI를 재사용할 수 있다.
- state에서 UI가 나오는 흐름을 선언적으로 표현한다.
- 웹, 네이티브, 라우팅, 데이터 관리 분야에 다양한 도구가 있다.
- 공식 문서와 학습 자료가 풍부하다.

#### 학습 부담

- HTML, CSS, JavaScript 기반 지식이 계속 필요하다.
- 프로젝트가 커질수록 state 위치와 데이터 흐름 설계가 어려워질 수 있다.
- 라우팅, 데이터 요청, 테스트와 배포 도구를 선택해야 한다.
- 선택지가 많아 초보자가 모든 도구를 한꺼번에 배워야 한다고 느낄 수 있다.

React 핵심을 배울 때는 주변 도구를 모두 동시에 익히지 않는다. 현재 만드는 프로젝트가 요구하는 도구부터 하나씩 추가한다.

---

## 4. 적용 관점에서 다시 보기

다음 기준으로 출발점을 판단할 수 있다.

| 상황 | 우선 검토할 방법 |
|---|---|
| 설치 없이 React 문법 체험 | React 공식 문서의 온라인 Sandbox |
| 컴포넌트와 Hooks 기본 학습 | Vite React 템플릿 |
| 기존 페이지 일부에 React 추가 | 기존 빌드 환경 또는 Vite와 React DOM 연결 |
| 라우팅과 데이터 로딩이 있는 신규 웹 앱 | React Router 또는 Next.js 같은 React 프레임워크 |
| 특수한 제약이 있는 클라이언트 앱 | Vite와 필요한 라이브러리 직접 구성 |
| Android·iOS 앱 | Expo와 React Native |

도구를 추가하기 전에 다음을 묻는다.

1. 지금 해결해야 하는 문제가 무엇인가?
2. React 기본 기능만으로 해결 가능한가?
3. 라우팅 또는 서버 데이터 로딩이 필요한가?
4. 서버 렌더링이나 정적 생성이 필요한가?
5. 팀이 운영할 수 있는 복잡도인가?

---

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

React를 시작하는 도구와 React 자체는 다르다. Vite는 빌드 도구, Next.js는 React 프레임워크, React Native는 네이티브 앱 프레임워크다.

### 5.2 다음 학습과의 연결

- React Router를 사용한 중첩 라우팅
- 프레임워크의 loader와 데이터 요청
- TanStack Query의 캐시와 재검증
- Next.js의 App Router와 Server Components
- Expo를 이용한 React Native 앱 시작

### 5.3 계속 확인해야 할 것

생태계와 권장 도구는 변한다. 새 프로젝트를 시작할 때는 오래된 블로그의 명령만 복사하지 말고 React와 선택한 도구의 공식 문서를 확인한다.

---

## 6. 요약 정리

- React는 UI 라이브러리이며 SPA나 라우터 자체가 아니다.
- React Router는 URL과 화면, 라우팅 데이터 흐름을 관리한다.
- Vite는 개발 서버와 빌드를 제공하는 도구다.
- 신규 웹 앱은 요구사항에 맞는 React 프레임워크를 우선 검토한다.
- Next.js는 React 기반 라우팅, 렌더링, 서버 기능을 통합한다.
- React Native는 네이티브 모바일 앱을 위한 프레임워크다.
- React Foundation이 React와 관련 프로젝트를 소유하고 운영한다.
- 도구는 인기보다 해결해야 할 문제를 기준으로 선택한다.

🧠 기억할 것: React를 배우는 것과 React 주변의 모든 도구를 한꺼번에 배우는 것은 다르다.

---

## 7. 미니 퀴즈

1. React와 SPA가 같은 개념이 아닌 이유는 무엇인가?
2. React, Vite, React Router, Next.js의 역할을 각각 설명할 수 있는가?
3. 신규 서비스에서 프레임워크를 우선 검토하는 이유는 무엇인가?
4. UI state와 서버 데이터는 어떤 점에서 관리 요구가 다른가?
5. React Native가 웹페이지를 모바일 화면에 띄우는 도구가 아닌 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. React는 UI 라이브러리이고 SPA는 전체 페이지 새로고침 없이 UI를 전환하는 애플리케이션 방식이다.
2. React는 UI, Vite는 빌드 환경, React Router는 라우팅, Next.js는 더 넓은 React 애플리케이션 구조를 담당한다.
3. 실제 서비스에 필요한 라우팅, 데이터 로딩, 코드 분할과 오류 처리가 서로 연결되어 있기 때문이다.
4. UI state는 브라우저 상호작용에 가깝고, 서버 데이터는 요청 상태·캐시·재검증·동기화가 필요하다.
5. React Native는 HTML DOM 대신 플랫폼 네이티브 컴포넌트를 사용하며 플랫폼별 기능과 코드가 필요할 수 있다.

</details>

---

## 8. 참고 자료

- [React 앱 생성 방법](https://react.dev/learn/creating-a-react-app)
- [기존 프로젝트에 React 추가하기](https://react.dev/learn/add-react-to-an-existing-project)
- [React Router 공식 문서](https://reactrouter.com/)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [React Native 공식 문서](https://reactnative.dev/docs/getting-started)
- [React Foundation 출범](https://react.dev/blog/2026/02/24/the-react-foundation)
