# TypeScript 모듈과 프로젝트 설정

- 🎯 글의 목표: 모듈의 경계, 값과 타입 import, 모듈 해석과 출력의 차이를 이해하고 `tsconfig.json`으로 실제 실행 환경에 맞는 프로젝트를 구성한다.
- 🧩 핵심 키워드: ES Modules, CommonJS, `import type`, Module Resolution, `module`, `moduleResolution`, `target`, `strict`, `include`, `exclude`, `noEmit`, Project Reference
- ⭐ 중요도: ★★★★★
- 📝 한눈에 보는 내용: `import` 문법이 맞아도 실행 환경이 파일을 찾는 방식과 TypeScript의 설정이 다르면 빌드가 실패한다. 모듈 문법, 모듈 해석, 출력 형식을 분리해서 이해하고 프로젝트 유형에 맞춰 설정해야 한다.
- 🔗 관련 문제 / 주제: Node.js ESM, Vite, 라이브러리 배포, 경로 별칭, 모노레포, 빌드 설정

---

## 1. 들어가며

코드가 한 파일을 넘어서면 값을 내보내고 가져와야 한다.

```ts
// math.ts
export function add(a: number, b: number): number {
  return a + b;
}
```

```ts
// app.ts
import { add } from "./math.js";

console.log(add(1, 2));
```

여기서 세 가지 문제를 구분해야 한다.

1. 어떤 `import`/`export` 문법을 쓰는가?
2. `"./math.js"`가 실제 어느 파일을 가리키는가?
3. 컴파일 결과에서 모듈 문법을 어떤 형태로 남기거나 바꾸는가?

각각 모듈 문법, 모듈 해석, 모듈 출력의 문제다.

---

## 2. 핵심 개념 정리

최상위 `import`, `export`, top-level `await`가 있는 파일은 모듈이다. 모듈 내부 선언은 명시적으로 내보내기 전까지 다른 파일에서 보이지 않는다.

```ts
export {};
```

아무것도 내보내지 않더라도 위 문장이 있으면 스크립트가 아닌 모듈로 취급할 수 있다.

`tsconfig.json`은 프로젝트의 루트와 검사·출력 규칙을 정의한다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmitOnError": true
  },
  "include": ["src/**/*.ts"]
}
```

설정은 유행하는 값을 복사하는 것이 아니라 코드가 실제로 실행될 런타임과 빌드 도구를 모델링해야 한다.

---

## 3. 본문 정리

### 3.1 모듈과 스크립트

모듈은 독립된 스코프를 가진다.

```ts
// user.ts
const name = "Mina";
export const userName = name;
```

`name`은 파일 외부에서 보이지 않고 `userName`만 import할 수 있다.

최상위 import/export가 없는 파일은 스크립트로 간주되어 선언이 전역 스코프에 놓일 수 있다. 서로 관계없는 파일의 변수 이름이 충돌한다면 `export {}`를 추가해 모듈로 만드는 방법을 검토한다.

### 3.2 이름 있는 export와 default export

```ts
// math.ts
export const PI = 3.14;
export function add(a: number, b: number): number {
  return a + b;
}
```

```ts
import { PI, add } from "./math.js";
```

이름을 바꿀 수 있다.

```ts
import { PI as circleRatio } from "./math.js";
```

default export는 모듈당 하나의 주 내보내기를 표현한다.

```ts
export default class UserService {}
```

```ts
import UserService from "./UserService.js";
```

이름 있는 export는 가져오는 이름이 원본과 연결되어 리팩터링과 자동 완성에 명확한 장점이 있다. default export는 하나의 중심 값이 분명할 때 사용한다. 프로젝트 규칙을 일관되게 유지한다.

### 3.3 namespace import와 부수 효과 import

모든 이름 있는 export를 하나의 객체처럼 가져올 수 있다.

```ts
import * as math from "./math.js";

math.add(1, 2);
```

바인딩 없이 파일만 실행하면 부수 효과 import다.

```ts
import "./polyfill.js";
```

이 import는 해당 모듈의 최상위 코드를 실행한다. 전역 등록, CSS 로딩, 폴리필처럼 부수 효과가 목적일 때만 사용하고 의존성이 숨지 않도록 주의한다.

### 3.4 타입 전용 import와 export

타입은 JavaScript 출력에서 제거된다.

```ts
// user.ts
export interface User {
  id: number;
  name: string;
}

export function createUser(name: string): User {
  return { id: 1, name };
}
```

타입만 가져온다는 의도를 `import type`으로 명확히 한다.

```ts
import type { User } from "./user.js";
import { createUser } from "./user.js";
```

한 import에서 구분할 수도 있다.

```ts
import { createUser, type User } from "./user.js";
```

`import type`으로 가져온 이름은 런타임 값으로 사용할 수 없다. Babel, SWC, esbuild처럼 파일 단위로 변환하는 도구도 어떤 import를 제거해야 하는지 명확히 알 수 있다.

### 3.5 재내보내기와 배럴 파일

```ts
// models/index.ts
export type { User } from "./User.js";
export type { Product } from "./Product.js";
```

배럴 파일은 공개 API를 한곳에 모을 수 있지만, 지나치게 사용하면 순환 의존성과 번들 분석의 어려움을 만들 수 있다. 내부 파일 모두를 무조건 `export *`하기보다 외부에 공개할 항목을 의도적으로 고른다.

### 3.6 ES Modules와 CommonJS

ES Modules는 `import`/`export`, CommonJS는 `require`/`module.exports`를 중심으로 한다.

```js
// CommonJS
const math = require("./math");
module.exports = { math };
```

둘은 default와 namespace 의미가 완전히 같지 않다. `esModuleInterop`은 상호 운용의 마찰을 줄이지만 패키지의 실제 모듈 형식과 런타임 규칙을 무시하게 해 주는 옵션은 아니다.

새 코드는 가능한 한 실행 환경이 지원하는 ES Modules 방향을 우선 검토한다. Node.js에서는 `package.json`의 `"type"`, 파일 확장자, `module`/`moduleResolution` 설정이 함께 작동한다.

### 3.7 모듈 해석

모듈 해석은 import 문자열을 실제 파일과 연결하는 과정이다.

```ts
import { add } from "./math.js";
import express from "express";
```

- 상대 경로는 현재 파일을 기준으로 찾는다.
- 패키지 이름은 `node_modules`, 패키지 `exports`, 타입 선언 등 런타임과 패키지 규칙을 따른다.

TypeScript는 `.js` import가 소스의 `.ts` 파일과 연결되는 상황도 설정에 맞춰 해석한다. Node ESM 프로젝트에서 소스가 `math.ts`여도 출력 후 실행할 경로인 `"./math.js"`를 쓰는 이유다.

`paths`는 TypeScript의 해석을 돕지만 런타임 import 경로를 자동으로 바꾸는 기능으로 오해하면 안 된다. 번들러나 런타임도 같은 별칭을 이해하도록 설정해야 한다.

### 3.8 `tsconfig.json`의 역할

디렉터리에 `tsconfig.json`이 있으면 해당 위치가 프로젝트의 기준점이 된다. `tsc`에 입력 파일을 직접 넘기면 설정 파일이 무시될 수 있으므로 보통 프로젝트 단위로 실행한다.

```bash
npx tsc
npx tsc --noEmit
npx tsc --watch
```

`--noEmit`은 타입 검사만 수행한다.

### 3.9 파일 범위: `files`, `include`, `exclude`

```json
{
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["dist", "coverage"]
}
```

`include`는 패턴으로 시작 파일을 찾고 `files`는 정확한 파일 목록을 지정한다. `exclude`는 `include`가 찾는 대상에서 제외할 뿐, 제외된 파일이 다른 파일에서 import되면 프로젝트에 다시 포함될 수 있다.

### 3.10 핵심 컴파일러 옵션

#### `target`

출력 JavaScript의 문법 수준을 정한다. 실행할 브라우저나 Node.js 버전이 지원하는 기능을 기준으로 선택한다.

#### `module`

출력 모듈 형식과 일부 모듈 관련 동작을 정한다. Node 프로젝트는 현재 Node의 이중 ESM/CJS 규칙을 모델링하는 `NodeNext` 계열을 검토하고, 번들러 프로젝트는 도구가 권장하는 설정을 따른다.

#### `moduleResolution`

import 경로를 파일로 연결하는 방식을 정한다. `module`과 모순되지 않게 맞춘다.

#### `lib`

타입 검사에 포함할 표준 라이브러리 선언을 정한다. `DOM`을 포함하면 브라우저 API 타입을 사용할 수 있지만 Node 전용 코드에 무조건 DOM을 넣으면 실제 런타임에 없는 전역을 허용할 수 있다.

#### `strict`

엄격한 타입 검사 옵션 묶음이다.

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` 등이 함께 활성화된다. 버전이 올라가면서 `strict`가 포함하는 검사가 늘 수 있으므로 업그레이드 시 새 오류가 나타날 수 있다.

#### `noEmitOnError`와 `noEmit`

- `noEmitOnError`: 오류가 있으면 출력을 만들지 않는다.
- `noEmit`: 항상 출력하지 않고 타입 검사만 한다.

Vite나 다른 빌드 도구가 변환을 담당한다면 `noEmit: true`로 TypeScript를 검사기로만 쓰는 구성이 일반적이다.

#### `declaration`

라이브러리가 소비자에게 타입을 제공하도록 `.d.ts`를 생성한다. 애플리케이션에서는 보통 필요하지 않다.

### 3.11 `extends`로 설정 공유

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

공통 엄격 옵션을 기반 설정에 두고 환경별 설정이 상속할 수 있다. 상대 경로 옵션은 각 옵션이 처음 정의된 설정 파일 위치를 기준으로 해석된다는 점을 확인한다.

### 3.12 프로젝트 참조

큰 저장소를 여러 TypeScript 프로젝트로 나누고 관계를 선언할 수 있다.

```json
{
  "references": [
    { "path": "../core" },
    { "path": "../web" }
  ]
}
```

참조되는 프로젝트는 보통 `composite: true`가 필요하다. 빌드 모드는 의존 순서를 따라 증분 빌드한다.

```bash
npx tsc --build
npx tsc --build --clean
```

프로젝트 참조는 논리 경계를 강제하고 편집기·빌드 성능을 개선할 수 있지만 작은 프로젝트에 미리 도입하면 설정 비용만 늘 수 있다.

### 3.13 환경별 설정 예시

번들러가 변환과 모듈 처리를 담당하는 웹 앱의 개념적 설정:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM"],
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

Node.js 프로젝트의 설정은 사용하는 Node 버전, ESM/CJS 여부, `package.json`에 따라 달라진다. 공식 모듈 가이드와 해당 프레임워크의 설정을 기준으로 `NodeNext` 계열을 맞춘다.

> ⚠️ 주의: 설정 예시는 출발점이지 모든 프로젝트에 복사할 정답이 아니다. TypeScript가 모방해야 할 실제 런타임과 빌드 도구를 먼저 정한다.

---

## 4. 적용 관점에서 다시 보기

모듈 오류를 만났을 때 다음 순서로 확인한다.

1. 소스가 ESM인지 CommonJS인지 확인한다.
2. Node라면 `package.json`의 `"type"`과 파일 확장자를 확인한다.
3. `module`과 `moduleResolution`이 실행 환경을 모델링하는지 확인한다.
4. 상대 경로의 확장자가 출력 후 런타임 기준으로 올바른지 확인한다.
5. 패키지의 `exports`와 타입 선언 제공 여부를 확인한다.
6. 경로 별칭을 런타임이나 번들러도 아는지 확인한다.

설정을 바꿔 오류만 숨기지 말고 TypeScript와 런타임이 같은 모듈 그래프를 보게 만드는 것이 목표다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 점

`module`은 단순히 import 문법 허용 여부가 아니다. 출력 형식과 모듈 관련 검사에 영향을 준다. `moduleResolution`은 import 문자열을 파일로 찾는 알고리즘이다. 두 옵션은 서로 다른 질문에 답하지만 실행 환경에 맞게 함께 구성해야 한다.

### 5.2 앞으로 이어지는 연결점

라이브러리 배포에서는 `.d.ts`, `package.json`의 `exports`와 `types`, ESM/CJS 이중 배포 문제가 이어진다. 대규모 저장소에서는 프로젝트 참조와 증분 빌드가 중요해진다.

### 5.3 더 파볼 만한 주제

- Node.js ESM/CJS 상호 운용
- `verbatimModuleSyntax`
- 패키지 `exports`와 조건부 export
- 선언 파일 생성과 라이브러리 배포
- 모노레포 프로젝트 참조

---

## 6. 요약 정리

- 최상위 import/export가 있는 파일은 독립 스코프의 모듈이다.
- 타입만 가져올 때 `import type`으로 런타임 의존성과 구분한다.
- 모듈 문법, 모듈 해석, 모듈 출력은 서로 다른 문제다.
- TypeScript 설정은 실제 런타임과 빌드 도구를 모델링해야 한다.
- `paths`만으로 런타임 별칭이 자동 설정되지는 않는다.
- `strict`는 엄격한 검사 옵션 묶음이다.
- `noEmit`은 검사만 수행하고, `noEmitOnError`는 오류 시 출력을 막는다.
- 프로젝트 참조는 큰 코드베이스를 논리 단위로 나누고 빌드 순서를 표현한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 모듈과 스크립트를 구분하는 기준은 무엇인가?
2. `import type`으로 가져온 이름을 값으로 사용할 수 없는 이유는 무엇인가?
3. `module`과 `moduleResolution`의 차이를 설명할 수 있는가?
4. 소스 `.ts`에서 상대 경로에 `.js`를 쓰는 경우가 있는 이유는 무엇인가?
5. `paths`가 런타임 경로를 자동 변환하는가?
6. `noEmit`과 `noEmitOnError`의 차이는 무엇인가?
7. `exclude`된 파일이 import를 통해 포함될 수 있는 이유는 무엇인가?
8. 프로젝트 참조가 적합한 규모와 목적을 설명할 수 있는가?

---

## 참고한 공식 문서

- [Modules](https://www.typescriptlang.org/docs/handbook/2/modules.html)
- [Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)
- [What is a tsconfig.json](https://www.typescriptlang.org/ko/docs/handbook/tsconfig-json.html)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig/)
- [Project References](https://www.typescriptlang.org/ko/docs/handbook/project-references.html)

> 문서 작성 기준일: 2026-07-24
