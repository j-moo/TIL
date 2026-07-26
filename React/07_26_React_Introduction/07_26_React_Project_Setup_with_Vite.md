# Vite로 React 프로젝트 시작하기

- 🎯 글의 목표: Create React App의 현재 상태를 이해하고, Vite로 React 프로젝트를 생성한 뒤 `index.html`에서 `App` 컴포넌트까지 이어지는 실행 흐름을 설명할 수 있다.
- 🧩 핵심 키워드: Node.js, npm, Create React App, Vite, `package.json`, `index.html`, `main.jsx`, `createRoot`, HMR, Fast Refresh
- ⭐ 중요도: ★★★★★ — React 코드를 실행하고 오류를 찾기 위한 기본 환경이다.
- 📝 한눈에 보는 내용: 신규 학습 프로젝트는 Vite의 React 템플릿으로 시작할 수 있다. 프로젝트 생성, 의존성 설치, 개발 서버 실행을 거친 뒤 브라우저가 `index.html`과 `main.jsx`를 읽어 `App`을 렌더링한다.
- 🧱 선수 지식: 터미널에서 폴더 이동하기, Node.js와 npm의 기본 역할
- 🔗 이전 학습: [React 입문](./07_26_React_Introduction.md)
- 🔗 다음 학습: [React 생태계와 도구 선택](./07_26_React_Ecosystem.md)

---

## 1. 들어가며

React는 UI 라이브러리이므로 프로젝트 폴더, 개발 서버, JSX 변환, 프로덕션 빌드를 모두 혼자 제공하지 않는다. 로컬에서 React 프로젝트를 개발하려면 이런 작업을 담당하는 도구가 필요하다.

과거에는 Create React App이 대표적인 시작 방법이었다. 현재 신규 앱에서는 deprecated되었으며, React의 기본 원리를 직접 학습하거나 프레임워크가 맞지 않는 프로젝트에는 Vite 같은 빌드 도구를 사용할 수 있다.

이 글에서는 도구 이름을 외우는 데 그치지 않고 다음 흐름을 연결한다.

```text
프로젝트 생성
→ 의존성 설치
→ 개발 서버 실행
→ index.html 로드
→ main.jsx 실행
→ App 컴포넌트 렌더링
```

---

## 2. 핵심 개념 정리

- **Node.js**: 브라우저 밖에서 JavaScript를 실행할 수 있는 환경
- **npm**: 패키지 설치와 프로젝트 명령 실행을 돕는 도구
- **Vite**: 개발 서버와 프로덕션 빌드를 제공하는 프론트엔드 빌드 도구
- **개발 서버**: 개발 중 파일을 브라우저에 제공하고 변경 사항을 빠르게 반영
- **빌드**: 작성한 소스와 의존성을 배포 가능한 결과물로 변환
- **HMR**: 페이지 전체를 새로고침하지 않고 변경된 모듈을 교체
- **Fast Refresh**: React 코드 변경 시 가능한 경우 컴포넌트 state를 유지

---

## 3. 본문 정리

### 3.1 Create React App은 신규 앱에서 deprecated되었다

Create React App, 줄여서 CRA는 과거 React 프로젝트를 쉽게 시작하도록 여러 설정을 묶어 제공했다.

```bash
# 과거 React 입문 자료에서 널리 사용한 방식
npx create-react-app my-app
cd my-app
npm start
```

CRA는 JSX 변환, 개발 서버, 린트, 프로덕션 빌드를 하나의 구성으로 제공했다. 하지만 현재는 적극적인 유지보수자가 없고, 프로덕션 앱에 필요한 라우팅·데이터 로딩·코드 분할 등을 통합하기 어렵다는 한계가 있다.

2025년 2월 14일 React 팀은 신규 앱에서 CRA를 deprecated 처리했다.

```text
deprecated
→ 설치 즉시 작동하지 않는다는 뜻이 아님
→ 신규 프로젝트에 권장하지 않음
→ 기존 프로젝트는 유지보수 모드로 사용할 수 있음
```

⚠️ 주의: CRA의 상태를 단순히 “React 18은 CRA, React 19는 Vite”로 구분하면 부정확하다. React 버전 하나가 아니라 프로젝트 요구사항과 도구의 유지보수 상태를 기준으로 선택해야 한다.

---

### 3.2 Vite는 React 전용 도구가 아니다

Vite는 현대 웹 프로젝트를 위한 빌드 도구다. React 외에도 Vue, Svelte, Vanilla JavaScript 등 여러 템플릿을 제공한다.

Vite의 중심 역할은 다음과 같다.

- 개발 서버 실행
- ES 모듈 기반 개발 환경
- Hot Module Replacement
- JSX, TypeScript, CSS 처리
- 프로덕션용 번들 생성
- 플러그인을 통한 확장

📌 핵심: React는 UI 라이브러리이고 Vite는 React 코드를 개발하고 빌드할 환경을 제공한다.

---

### 3.3 프로젝트 생성 전 환경을 확인한다

터미널에서 다음 명령으로 Node.js와 npm 설치를 확인한다.

```bash
node --version
npm --version
```

2026년 7월 기준 최신 Vite 문서는 Node.js `20.19+` 또는 `22.12+`를 요구한다. 이 값은 Vite 주요 버전에 따라 바뀔 수 있으므로 설치 오류가 발생하면 현재 공식 문서를 다시 확인한다.

⚠️ 주의: 버전 명령이 인식되지 않으면 React 문제가 아니라 Node.js 설치 또는 PATH 설정 문제일 가능성이 높다.

---

### 3.4 Vite React 프로젝트를 생성한다

JavaScript 기반 React 프로젝트는 다음 순서로 만든다.

```bash
# 최신 create-vite로 React 템플릿을 생성한다.
npm create vite@latest my-app -- --template react

# 생성된 프로젝트 폴더로 이동한다.
cd my-app

# package.json에 기록된 의존성을 설치한다.
npm install

# 개발 서버를 실행한다.
npm run dev
```

TypeScript를 사용한다면 `react-ts` 템플릿을 선택한다.

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm run dev
```

명령을 나누어 보면 다음과 같다.

| 명령 또는 부분 | 의미 |
|---|---|
| `npm create vite@latest` | 최신 create-vite 실행 |
| `my-app` | 생성할 프로젝트 폴더 이름 |
| `--` | 뒤 옵션을 create-vite에 전달 |
| `--template react` | React JavaScript 템플릿 선택 |
| `npm install` | 필요한 패키지 설치 |
| `npm run dev` | 개발 서버 실행 |

`npm run dev`가 성공하면 터미널에 로컬 주소가 표시된다. 기본값은 보통 `http://localhost:5173`이지만 포트가 사용 중이면 다른 번호가 선택될 수 있다.

---

### 3.5 프로젝트 구조를 읽는다

생성된 프로젝트는 대략 다음 구조를 가진다.

```text
my-app/
├─ index.html
├─ package.json
├─ src/
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ assets/
└─ vite.config.js
```

| 파일 | 역할 |
|---|---|
| `package.json` | 패키지와 실행 명령 기록 |
| `index.html` | 브라우저가 처음 읽는 HTML |
| `src/main.jsx` | React 애플리케이션 진입점 |
| `src/App.jsx` | 기본 루트 컴포넌트 |
| `vite.config.js` | Vite 설정 |

---

### 3.6 `index.html`은 React가 연결될 DOM을 제공한다

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <title>React App</title>
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

두 부분을 연결해서 본다.

```text
<div id="root"></div>
→ React UI가 들어갈 DOM 위치

<script type="module" src="/src/main.jsx"></script>
→ React 진입 파일을 JavaScript 모듈로 실행
```

---

### 3.7 `main.jsx`가 React root를 만든다

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const rootElement = document.getElementById('root')
const root = createRoot(rootElement)

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

실행 흐름은 다음과 같다.

```text
브라우저가 index.html 로드
→ /src/main.jsx 실행
→ id가 root인 DOM 요소 탐색
→ createRoot()로 React root 생성
→ root.render(<App />) 요청
→ App 컴포넌트 렌더링
```

React가 `<body>` 전체를 무조건 관리하는 것은 아니다. `createRoot()`에 전달한 요소 내부를 관리한다. 기존 HTML 페이지의 특정 영역에만 React를 연결하는 것도 가능하다.

---

### 3.8 `package.json`의 scripts를 이해한다

Vite 프로젝트의 `package.json`에는 보통 다음과 같은 명령이 있다.

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

- `npm run dev`: 개발 서버 실행
- `npm run build`: 배포용 결과물 생성
- `npm run lint`: 코드 규칙 검사
- `npm run preview`: 빌드 결과를 로컬에서 미리 확인

⚠️ 주의: `npm run preview`는 개발 서버가 아니다. 먼저 `npm run build`로 생성한 결과를 확인하는 용도다.

---

### 3.9 HMR과 Fast Refresh를 구분한다

HMR은 `Hot Module Replacement`의 약자다.

```text
파일 수정
→ Vite 개발 서버가 변경 감지
→ 변경된 모듈을 브라우저에 전달
→ 가능한 경우 전체 페이지 새로고침 없이 반영
```

React 프로젝트에서는 Fast Refresh가 함께 동작해 가능한 경우 컴포넌트 state를 유지한다. 카운터 값이 7일 때 버튼 문구만 수정하면 값이 유지될 수 있다.

상태 유지가 항상 보장되지는 않는다.

- 컴포넌트 구조를 크게 바꾼 경우
- 모듈 export 형태를 변경한 경우
- 문법 또는 런타임 오류로 전체 갱신이 필요한 경우
- Fast Refresh가 안전하게 state를 유지할 수 없는 경우

📌 핵심: HMR은 모듈 변경을 빠르게 반영하고, Fast Refresh는 가능한 경우 React state를 보존한다.

---

## 4. 적용 관점에서 다시 보기

프로젝트가 실행되지 않으면 다음 순서로 확인한다.

1. `node --version`, `npm --version`이 동작하는가?
2. 터미널의 현재 폴더에 `package.json`이 있는가?
3. `npm install`을 실행했는가?
4. `npm run dev`의 오류 메시지는 무엇인가?
5. 터미널에 표시된 정확한 주소로 접속했는가?
6. `index.html`의 `root` ID와 `main.jsx`에서 찾는 ID가 같은가?
7. `App.jsx`가 기본 export를 제공하는가?
8. 브라우저 개발자 도구 콘솔에 어떤 오류가 있는가?

새 프로젝트에서 Vite를 선택하는 기준도 구분한다.

```text
React 기본 원리를 직접 학습
→ Vite가 단순한 출발점이 될 수 있음

라우팅·데이터 로딩·코드 분할을 포함한 신규 서비스
→ React 프레임워크를 우선 검토

특수한 제약 때문에 직접 구성이 필요
→ Vite와 필요한 라이브러리를 조합
```

---

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

React 코드와 실행 환경은 같은 개념이 아니다. React는 UI를 만들고, Vite는 개발 서버와 빌드 환경을 제공한다.

### 5.2 다음 학습과의 연결

프로젝트 실행 흐름을 이해하면 이후 다음 파일과 설정을 읽기 쉬워진다.

- 컴포넌트를 파일별로 분리하기
- CSS와 정적 자산 불러오기
- 환경 변수 사용하기
- ESLint 설정 읽기
- 프로덕션 빌드와 배포

### 5.3 더 확인할 주제

- `dependencies`와 `devDependencies`
- ES Module의 `import`와 `export`
- `StrictMode`가 개발 환경에서 하는 일
- Vite 환경 변수의 `VITE_` 접두사
- `npm run build`로 만들어지는 `dist` 폴더

---

## 6. 요약 정리

- CRA는 신규 앱에서 deprecated되었으며 기존 앱은 유지보수 모드로 사용할 수 있다.
- Vite는 React 전용 생성기가 아니라 프론트엔드 빌드 도구다.
- 프로젝트는 생성, 폴더 이동, 의존성 설치, 개발 서버 실행 순으로 시작한다.
- `index.html`은 React가 연결될 DOM과 `main.jsx` 진입점을 제공한다.
- `main.jsx`는 `createRoot()`로 React root를 만들고 `App`을 렌더링한다.
- HMR은 변경 모듈을 반영하고 Fast Refresh는 가능한 경우 state를 유지한다.

🧠 기억할 것: `index.html → main.jsx → createRoot → App` 흐름을 알면 빈 화면과 실행 오류를 추적하기 쉬워진다.

---

## 7. 미니 퀴즈

1. React와 Vite의 역할은 어떻게 다른가?
2. CRA가 deprecated되었다는 말은 무엇을 의미하는가?
3. `npm create`, `npm install`, `npm run dev`는 각각 무엇을 하는가?
4. `index.html`의 `root`와 `main.jsx`의 `createRoot()`는 어떻게 연결되는가?
5. HMR과 Fast Refresh는 무엇이 다른가?

<details>
<summary>정답과 해설</summary>

1. React는 UI 라이브러리이고 Vite는 개발 서버와 빌드 환경을 제공하는 도구다.
2. 신규 프로젝트에 권장하지 않는다는 뜻이며, 기존 프로젝트가 즉시 작동하지 않는다는 뜻은 아니다.
3. 프로젝트 틀 생성, 패키지 설치, 개발 서버 실행을 각각 담당한다.
4. `main.jsx`가 ID로 DOM 요소를 찾고 그 요소를 `createRoot()`에 전달한다.
5. HMR은 변경된 모듈을 교체하며, Fast Refresh는 React 컴포넌트의 state를 가능한 경우 보존한다.

</details>

---

## 8. 참고 자료

- [React 설치와 시작 방법](https://react.dev/learn/installation)
- [React 앱을 처음부터 구성하기](https://react.dev/learn/build-a-react-app-from-scratch)
- [Create React App 지원 종료](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)
- [Vite 시작 가이드](https://vite.dev/guide/)
