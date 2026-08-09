# TypeScript 선언 파일과 외부 라이브러리 타입

- 🎯 학습 목표: `.d.ts`의 역할을 이해하고, 타입 정보가 없는 JavaScript 라이브러리에 안전한 타입을 제공하며, 선언 파일을 생성·배포·진단할 수 있다.
- 🧩 핵심 키워드: Declaration File, `.d.ts`, `declare`, Ambient Declaration, `@types`, Module Declaration, Global Augmentation, Module Augmentation, `types`, `typeRoots`, `declaration`
- ⭐ 중요도: ★★★★★
- 👀 한눈에 보는 내용: JavaScript는 런타임 동작을 담고 `.d.ts`는 그 코드의 공개 계약을 설명한다. 먼저 패키지에 내장된 타입과 `@types`를 찾고, 없을 때 실제 API를 관찰하여 최소한의 로컬 선언을 작성한다.
- 🔗 관련 문서: [06. 모듈과 프로젝트 설정](../06_Modules_and_Project_Configuration/07_24_TypeScript_Modules_and_Project_Configuration.md)

---

## 1. 들어가며

TypeScript 프로젝트에서 오래된 JavaScript 패키지를 설치하면 다음 오류를 만날 수 있다.

```ts
import { average } from "legacy-math";
// 모듈 'legacy-math'에 대한 선언 파일을 찾을 수 없습니다.
```

패키지의 JavaScript 파일은 존재하므로 런타임에는 실행될 수도 있다. 하지만 TypeScript는 `average`가 함수인지, 어떤 값을 받고 무엇을 반환하는지 알 수 없다. 이 빈칸을 채우는 문서가 **선언 파일(declaration file)** 이다.

선언 파일의 확장자는 `.d.ts`이다. 구현을 다시 만드는 파일이 아니라 이미 존재하는 JavaScript의 외부 모습을 타입으로 설명하는 파일이다.

```text
legacy-math.js     → 실제 계산을 수행하는 런타임 코드
legacy-math.d.ts   → 그 코드의 사용법을 설명하는 타입 계약
```

이 구분이 중요한 이유는 TypeScript의 타입이 컴파일 뒤 대부분 사라지기 때문이다. 선언 파일이 정확해도 실제 JavaScript가 없으면 프로그램은 실행되지 않는다. 반대로 JavaScript가 있어도 선언이 틀리면 편집기와 컴파일러가 잘못된 사용법을 허용할 수 있다.

> `.d.ts`는 코드를 대신 실행하는 파일이 아니라, 실행될 코드가 어떤 모양인지 TypeScript에 알려 주는 파일이다.

---

## 2. 핵심 개념 정리

### 2.1 구현 파일과 선언 파일

같은 API를 구현 파일과 선언 파일로 비교해 보자.

```js
// legacy-math.js
export function average(values, options = {}) {
  const result = values.reduce((sum, value) => sum + value, 0) / values.length;
  return options.round === undefined
    ? result
    : Number(result.toFixed(options.round));
}
```

```ts
// legacy-math.d.ts
export interface AverageOptions {
  round?: number;
}

export function average(
  values: readonly number[],
  options?: AverageOptions,
): number;
```

선언 파일에는 함수 본문이 없다. 입력, 출력, 공개 인터페이스만 기록한다.

| 구분 | `.ts` / `.js` 구현 | `.d.ts` 선언 |
| --- | --- | --- |
| 목적 | 실제 동작 수행 | 코드의 공개 타입 설명 |
| 함수 본문 | 있음 | 없음 |
| 런타임 출력 | JavaScript로 실행됨 | 보통 실행 코드가 생성되지 않음 |
| 주요 독자 | JavaScript 런타임 | TypeScript 컴파일러와 편집기 |

### 2.2 `declare`의 의미

`declare`는 “이 값은 다른 곳에 실제로 존재하니 여기서는 타입만 설명하겠다”는 뜻이다.

```ts
declare const APP_VERSION: string;

declare function showToast(message: string, duration?: number): void;
```

이 코드는 변수를 만들거나 함수를 구현하지 않는다. 브라우저 스크립트, 네이티브 환경, 외부 번들 등이 값을 제공한다는 전제만 TypeScript에 알려 준다. 실제 값이 없다면 타입 검사는 통과해도 런타임에서 `ReferenceError`가 발생한다.

### 2.3 선언을 얻는 우선순위

외부 패키지의 타입 오류가 보이면 곧바로 직접 `.d.ts`를 쓰기보다 다음 순서로 확인한다.

1. 패키지가 자체 선언 파일을 포함하는지 확인한다.
2. 없다면 같은 이름의 `@types` 패키지가 있는지 확인한다.
3. 둘 다 없다면 프로젝트 안에 로컬 선언을 작성한다.
4. 재사용 가치가 크다면 라이브러리 본체 또는 DefinitelyTyped에 기여한다.

```bash
npm install legacy-math
npm install --save-dev @types/legacy-math
```

자체 타입이 포함된 패키지에는 별도의 `@types`를 중복 설치할 필요가 없다. 패키지의 `package.json`에 있는 `types` 또는 `typings` 필드가 대표 선언 파일을 가리킬 수 있다.

---

## 3. 본문 정리

### 3.1 가장 작은 임시 선언부터 시작하기

타입을 전혀 모르는 패키지에 아래처럼 빈 모듈 선언을 추가하면 오류는 사라진다.

```ts
// src/types/legacy-math.d.ts
declare module "legacy-math";
```

하지만 이 방식은 모듈의 내보내기를 사실상 `any`로 취급한다. 컴파일 오류를 잠시 우회할 뿐 타입 안전성을 얻지는 못한다.

```ts
import math from "legacy-math";

math.notExistingMethod(123); // 잘못된 호출도 놓칠 수 있다.
```

따라서 긴급한 마이그레이션의 출발점으로만 사용하고, 실제 API를 확인하면서 구체적인 선언으로 좁혀 간다.

### 3.2 실제 API를 관찰한 뒤 모듈 선언 작성하기

패키지의 문서, 소스 코드, 런타임 예제를 확인한 뒤 사용되는 공개 API만 선언한다.

```ts
// src/types/legacy-math.d.ts
declare module "legacy-math" {
  export interface AverageOptions {
    /** 소수점 이하 자릿수 */
    round?: number;
  }

  export function average(
    values: readonly number[],
    options?: AverageOptions,
  ): number;

  export function sum(values: readonly number[]): number;
}
```

이제 소비 코드에서 자동 완성과 오류 검사를 얻는다.

```ts
import { average } from "legacy-math";

average([10, 20, 30], { round: 1 });
average([10, 20], { round: "1" });
//                         ~~~ string은 number에 할당할 수 없다.
```

`readonly number[]`를 사용한 이유도 계약에 포함된다. 함수가 배열을 읽기만 한다면 호출자가 `readonly` 배열을 넘길 수 있도록 불필요한 가변성 요구를 피한다.

### 3.3 내보내기 방식과 선언을 일치시키기

선언 파일은 런타임 모듈의 내보내기 모양과 같아야 한다.

#### 이름 있는 내보내기

```ts
declare module "text-tools" {
  export function trim(value: string): string;
  export const version: string;
}
```

```ts
import { trim, version } from "text-tools";
```

#### 기본 내보내기

```ts
declare module "logger" {
  interface Logger {
    info(message: string): void;
    error(message: string, cause?: unknown): void;
  }

  const logger: Logger;
  export default logger;
}
```

```ts
import logger from "logger";
```

#### CommonJS의 `export =`

라이브러리가 `module.exports = createClient`처럼 하나의 값을 내보내는 구조라면 다음 패턴을 사용할 수 있다.

```ts
declare module "legacy-client" {
  interface Client {
    get(path: string): Promise<unknown>;
  }

  function createClient(baseUrl: string): Client;
  export = createClient;
}
```

```ts
import createClient = require("legacy-client");
```

ESM과 CommonJS의 상호 운용은 `module`, `moduleResolution`, `esModuleInterop` 설정의 영향을 받는다. 단순히 원하는 import 문법에 맞춰 선언을 꾸미지 말고 실제 패키지의 런타임 export와 프로젝트 설정을 함께 확인한다.

### 3.4 전역 값 선언하기

`<script>` 태그로 불러온 라이브러리가 전역 객체를 만든다면 모듈 import 없이 접근할 수 있다.

```ts
// src/types/runtime-globals.d.ts
declare const BUILD_ID: string;

declare function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>,
): void;

declare class LegacyPlayer {
  constructor(element: HTMLElement);
  play(): void;
  pause(): void;
}
```

```ts
console.log(BUILD_ID);
trackEvent("page_view", { path: location.pathname });

const player = new LegacyPlayer(document.querySelector("video")!);
player.play();
```

이 선언도 값을 생성하지 않는다. HTML이나 런타임 환경이 실제 값을 제공하는지 반드시 확인해야 한다.

### 3.5 전역 객체의 기존 타입 확장하기

브라우저의 `window`에 애플리케이션 전용 값을 주입했다면 전역 보강을 사용할 수 있다.

```ts
// src/types/app-globals.d.ts
export {};

declare global {
  interface Window {
    appConfig: {
      apiBaseUrl: string;
      debug: boolean;
    };
  }
}
```

```ts
const endpoint = `${window.appConfig.apiBaseUrl}/users`;
```

맨 위의 `export {}`는 이 파일을 외부 모듈로 만든다. 그 안에서 `declare global`을 사용하면 기존 전역 선언에 안전하게 항목을 보강할 수 있다.

`window.appConfig`에 타입을 붙였다고 값이 자동으로 생기지는 않는다. 서버가 HTML에 설정을 삽입하거나 애플리케이션 초기화 코드가 값을 할당해야 한다.

### 3.6 기존 모듈 보강하기

플러그인이 기존 라이브러리의 객체에 메서드를 추가하는 경우 **모듈 보강(module augmentation)** 을 사용한다.

```ts
// src/types/http-client-retry.d.ts
import "http-client";

declare module "http-client" {
  interface RequestOptions {
    retryCount?: number;
  }
}
```

같은 이름의 `RequestOptions` 인터페이스가 기존 선언과 병합되어 새 속성이 보인다. 단, 이것 역시 런타임 동작을 추가하지 않는다. 실제 플러그인을 import하거나 초기화해야 한다.

```ts
import "http-client-retry-plugin";
import { request } from "http-client";

request("/users", { retryCount: 3 });
```

보강 대상의 모듈 이름은 소비 코드가 사용하는 specifier와 정확히 같아야 한다. 별칭이나 다른 경로를 선언하면 기존 모듈과 합쳐지지 않을 수 있다.

### 3.7 이미지와 스타일 파일 선언하기

Vite나 Webpack 같은 번들러는 TypeScript가 기본적으로 모르는 파일을 import할 수 있다. 이때 와일드카드 모듈 선언으로 결과 타입을 설명한다.

```ts
// src/types/assets.d.ts
declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
```

```ts
import logoUrl from "./logo.svg";
import styles from "./Button.module.css";

console.log(logoUrl, styles.primary);
```

실제 반환값은 번들러 플러그인 설정에 따라 URL, 문자열, React 컴포넌트 등으로 달라질 수 있다. 선언은 반드시 현재 도구의 실제 동작과 일치해야 한다.

### 3.8 오버로드로 호출 형태 표현하기

JavaScript 함수가 입력에 따라 다른 타입을 반환한다면 선언 오버로드로 관계를 보존할 수 있다.

```ts
declare module "storage-reader" {
  export function read(key: string, mode: "text"): string;
  export function read(key: string, mode: "json"): unknown;
  export function read(key: string, mode: "bytes"): Uint8Array;
}
```

```ts
import { read } from "storage-reader";

const text = read("profile", "text");   // string
const data = read("profile", "json");  // unknown
```

모든 반환값을 `string | unknown | Uint8Array`로 합치는 것보다 호출 인자와 반환값의 관계가 분명하다. 다만 실제 구현이 보장하지 않는 정밀한 타입을 상상해서 추가하면 선언이 거짓말이 된다.

### 3.9 `any`보다 `unknown`과 제네릭 사용하기

선언 파일은 프로젝트 전체가 믿는 경계이므로 편의를 위해 `any`를 남발하면 영향이 크게 퍼진다.

```ts
// 좋지 않은 계약
export function parse(value: string): any;
```

반환 구조를 알 수 없다면 `unknown`으로 두고 소비자가 검증하게 한다.

```ts
export function parse(value: string): unknown;
```

호출자가 기대 타입을 지정하는 것이 실제 API의 공식 동작이라면 제네릭을 고려할 수 있다.

```ts
export function parse<T = unknown>(value: string): T;
```

하지만 제네릭은 런타임 검증을 만들지 않는다. `parse<User>(text)`는 JSON이 정말 `User`인지 검사하지 않으므로 검증 라이브러리나 타입 가드가 별도로 필요하다.

### 3.10 선언 파일이 프로젝트에 포함되는 조건

로컬 `.d.ts` 파일은 `tsconfig.json`의 파일 범위에 포함되어야 한다.

```json
{
  "compilerOptions": {
    "strict": true
  },
  "include": ["src"]
}
```

`src/types/legacy-math.d.ts`는 `src` 아래에 있으므로 포함된다. 선언을 프로젝트 바깥에 만들었거나 `files`로 입력 목록을 제한했다면 컴파일러가 읽지 않을 수 있다.

다음 명령은 TypeScript가 최종적으로 포함한 파일을 확인할 때 유용하다.

```bash
npx tsc --noEmit --listFiles
```

모듈을 어떻게 찾았는지 자세히 보려면 해석 추적을 사용한다.

```bash
npx tsc --noEmit --traceResolution
```

출력이 길기 때문에 문제가 되는 패키지 이름을 중심으로 탐색한다.

### 3.11 `types`와 `typeRoots` 구분하기

기본적으로 보이는 `node_modules/@types` 패키지들은 전역 범위에 포함될 수 있다. `types`를 지정하면 전역에 포함할 `@types` 패키지 목록을 제한한다.

```json
{
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  }
}
```

이 설정은 목록에 없는 패키지를 직접 import했을 때 그 패키지 자체의 타입까지 제거한다는 뜻은 아니다. 주로 전역 선언 자동 포함 범위를 제어한다.

`typeRoots`는 타입 패키지를 탐색할 폴더를 지정한다.

```json
{
  "compilerOptions": {
    "typeRoots": ["./src/types", "./node_modules/@types"]
  }
}
```

`typeRoots`를 지정하면 명시한 폴더만 사용하므로 기본 `node_modules/@types` 경로가 필요하다면 함께 적어야 한다. 단순히 로컬 선언 하나를 추가하려고 무조건 `typeRoots`를 바꾸기보다 먼저 `include` 아래에 `.d.ts`를 두는 편이 간단하다.

### 3.12 TypeScript 소스에서 선언 파일 생성하기

라이브러리를 TypeScript로 작성한다면 공개 API 선언을 수동 복사하지 않고 컴파일러로 생성할 수 있다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "strict": true
  },
  "include": ["src"]
}
```

```ts
// src/index.ts
export interface User {
  id: string;
  name: string;
}

export function formatUser(user: User): string {
  return `${user.name} (${user.id})`;
}
```

빌드하면 JavaScript와 함께 `dist/index.d.ts`가 생성된다.

```ts
export interface User {
  id: string;
  name: string;
}
export declare function formatUser(user: User): string;
```

타입 선언만 만들고 JavaScript 출력은 다른 도구에 맡긴다면 `emitDeclarationOnly`를 사용한다.

```json
{
  "compilerOptions": {
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist/types"
  }
}
```

`declarationMap`은 선언과 원본 소스의 연결 정보를 만들어 편집기에서 정의로 이동하기 쉽게 한다.

### 3.13 JavaScript 소스에서 선언 생성하기

기존 JavaScript 프로젝트도 TypeScript 컴파일러로 선언 초안을 생성할 수 있다.

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist/types"
  },
  "include": ["src/**/*.js"]
}
```

JSDoc을 추가하면 추론되는 선언의 품질을 높일 수 있다.

```js
/**
 * @param {readonly number[]} values
 * @returns {number}
 */
export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
```

생성 결과는 출발점이다. 공개되지 않아야 할 타입이 노출되는지, 실제 패키지 진입점과 경로가 맞는지, 소비 프로젝트에서 정상적으로 import되는지 검토해야 한다.

### 3.14 npm 패키지에 타입 함께 배포하기

생성한 대표 선언 파일을 패키지의 `types` 필드로 연결한다.

```json
{
  "name": "@example/text-tools",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

배포 전에 실제 패키지에 `.d.ts`가 들어가는지 확인한다.

```bash
npm pack --dry-run
```

라이브러리 본체를 관리할 수 있다면 타입을 패키지와 함께 배포하는 방식이 구현과 선언의 버전을 맞추기 쉽다. 본체에 포함하기 어렵다면 DefinitelyTyped에 선언을 기여하여 `@types` 패키지로 배포할 수 있다.

### 3.15 선언 파일 품질을 소비자 관점에서 검사하기

선언 파일은 그 자체로 문법 오류가 없는지만 봐서는 부족하다. 실제 사용 예를 타입 검사해야 한다.

```ts
// test/consumer.ts
import { average } from "legacy-math";

const result: number = average([1, 2, 3], { round: 2 });

// @ts-expect-error round는 number여야 한다.
average([1, 2, 3], { round: "2" });
```

`@ts-expect-error`는 다음 줄에서 오류가 발생해야 테스트가 통과한다. 잘못된 사용을 선언이 실제로 막는지 확인하는 데 유용하다.

검사 관점은 다음과 같다.

- 정상 사용 예가 통과하는가?
- 잘못된 인수와 존재하지 않는 속성을 거부하는가?
- ESM과 CommonJS 중 지원한다고 밝힌 import 방식이 동작하는가?
- 하위 경로 import를 제공한다면 각 경로의 선언이 해석되는가?
- 패키지를 새 임시 프로젝트에 설치했을 때도 타입을 찾는가?

### 3.16 `skipLibCheck`는 무엇을 해결하는가

`skipLibCheck: true`는 선언 파일의 전체 타입 검사를 건너뛰어 검사 시간을 줄이고, 서로 충돌하는 라이브러리 선언 때문에 생기는 일부 오류를 피할 수 있다.

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

하지만 누락된 선언을 만들어 주거나 잘못된 런타임 export를 고치지는 않는다. 중복된 타입 패키지 버전, 잘못된 의존성, 직접 작성한 부정확한 선언이 원인이라면 원인을 먼저 수정해야 한다.

마이그레이션이나 빌드 시간 최적화 때문에 사용할 수는 있지만, “외부 타입 오류가 보이면 무조건 켠다”는 식의 만능 해결책으로 보면 안 된다.

### 3.17 자주 만나는 오류와 진단 순서

#### 선언 파일을 찾을 수 없음

```text
Could not find a declaration file for module 'legacy-math'
```

확인 순서:

1. 패키지가 정상 설치되었는지 확인한다.
2. 패키지에 자체 `.d.ts` 또는 `types` 필드가 있는지 본다.
3. `@types/legacy-math`가 있는지 확인한다.
4. 로컬 선언의 모듈 이름 철자가 import 문자열과 같은지 본다.
5. `.d.ts`가 `include` 또는 `files` 범위에 포함되는지 본다.
6. `moduleResolution`이 실행 환경과 맞는지 확인한다.

#### 선언은 찾았지만 내보내기가 없음

```text
Module has no exported member 'average'
```

런타임 패키지의 ESM/CJS export 모양과 선언의 `export`, `export default`, `export =`가 맞는지 확인한다.

#### 전역 보강이 적용되지 않음

`declare global` 바깥 파일이 모듈인지 확인한다. 필요하면 `export {}`를 추가하고 파일이 컴파일 대상인지 확인한다.

#### 같은 타입이 충돌함

중복 설치된 `@types` 버전이나 패키지 자체 타입과 별도 `@types`의 중복을 조사한다. 패키지 매니저의 의존성 트리와 `--traceResolution` 결과가 단서가 된다.

---

## 4. 적용 관점에서 다시 보기

### 4.1 팀 프로젝트에서 로컬 선언을 추가하는 흐름

타입 없는 라이브러리를 만났을 때 다음 흐름으로 작업하면 임시 우회가 영구적인 `any`가 되는 일을 줄일 수 있다.

```text
오류 확인
  ↓
자체 타입 확인
  ↓ 없음
@types 확인
  ↓ 없음
실제 API 문서·소스·테스트 관찰
  ↓
사용하는 공개 API부터 로컬 .d.ts 작성
  ↓
정상·오류 소비 예제로 타입 검사
  ↓
업스트림 또는 DefinitelyTyped 기여 검토
```

로컬 선언에는 왜 필요한지, 어떤 라이브러리 버전을 기준으로 했는지 주석이나 커밋 메시지로 남긴다. 라이브러리 업데이트 때 계약이 바뀌었는지 재검토하기 쉽다.

### 4.2 선언 파일은 신뢰 경계다

외부 JavaScript는 TypeScript가 구현을 검사할 수 없는 영역이다. 선언 파일은 그 경계에서 “이 API는 이렇게 동작한다”고 보증한다.

따라서 선언이 지나치게 넓으면 잘못된 값이 애플리케이션 내부로 들어온다.

```ts
declare function loadConfig(): any;
```

경계 값을 `unknown`으로 받고 검증하면 신뢰를 획득하는 과정이 코드에 드러난다.

```ts
declare function loadConfig(): unknown;

interface AppConfig {
  apiUrl: string;
}

function isAppConfig(value: unknown): value is AppConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "apiUrl" in value &&
    typeof value.apiUrl === "string"
  );
}
```

### 4.3 공개 API를 작게 유지하기

선언 생성 결과에 어떤 타입이 나타난다면 그 타입은 소비자와의 계약이 될 수 있다. 내부 구현 타입이 공개 함수의 반환값에 새어 나오지 않도록 명시적인 공개 인터페이스를 둔다.

```ts
// 공개 계약
export interface UserSummary {
  id: string;
  displayName: string;
}

export function getUserSummary(id: string): Promise<UserSummary>;
```

공개 타입이 작고 안정적이면 내부 구현을 바꿀 때 소비자에게 미치는 영향도 줄어든다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 배운 점

1. `.d.ts`는 JavaScript 구현의 공개 모양을 설명하며 런타임 값을 만들지 않는다.
2. 외부 타입은 자체 포함 선언 → `@types` → 로컬 선언 순서로 찾는다.
3. `declare`는 다른 곳에 존재하는 값을 타입 수준에서 설명한다.
4. 모듈 선언의 export 모양은 실제 ESM·CommonJS 동작과 일치해야 한다.
5. 전역 보강과 모듈 보강은 기존 타입을 확장하지만 실제 기능을 추가하지 않는다.
6. `declaration`과 `emitDeclarationOnly`로 TypeScript 또는 JavaScript 소스에서 선언을 생성할 수 있다.
7. 선언 파일은 소비 코드와 오류 예제를 함께 검사해야 신뢰할 수 있다.

### 5.2 자주 하는 실수

- 오류만 없애려고 `declare module "패키지";`를 장기간 방치한다.
- 실제 함수가 받지 않는 값까지 넓게 허용한다.
- 런타임 export는 CommonJS인데 선언을 임의로 default export로 만든다.
- 보강 선언만 작성하고 실제 플러그인 초기화를 빼먹는다.
- `types`와 `typeRoots`를 혼동해 필요한 전역 타입을 사라지게 한다.
- 생성된 `.d.ts`가 npm 패키지에 포함되는지 확인하지 않는다.
- `skipLibCheck`로 근본적인 버전 충돌과 잘못된 의존성을 숨긴다.

### 5.3 다음 학습으로 확장하기

- Declaration Merging으로 인터페이스·네임스페이스 병합 규칙 깊게 보기
- Node.js의 `exports`와 하위 경로별 타입 선언 연결하기
- `typesVersions`로 TypeScript 버전별 선언 제공하기
- DefinitelyTyped 저장소의 테스트와 기여 규칙 살펴보기
- API Extractor 같은 도구로 공개 API 변경을 검토하기

---

## 6. 요약 정리

| 질문 | 핵심 답변 |
| --- | --- |
| `.d.ts`는 무엇인가? | JavaScript 구현의 공개 타입 계약을 설명하는 선언 파일이다. |
| 선언 파일이 코드를 실행하는가? | 아니다. 실제 런타임 JavaScript가 별도로 있어야 한다. |
| 외부 패키지 타입은 어디서 찾는가? | 패키지 내장 타입, `@types`, 로컬 선언 순으로 확인한다. |
| `declare`는 무엇을 뜻하는가? | 값은 외부에 존재하며 현재 위치에서는 타입만 설명한다는 뜻이다. |
| 전역 보강과 모듈 보강의 역할은? | 기존 전역 또는 모듈 타입에 새 계약을 합친다. 런타임 기능은 만들지 않는다. |
| 선언 파일은 어떻게 생성하는가? | `declaration`, 필요하면 `emitDeclarationOnly`와 `declarationMap`을 사용한다. |
| 배포한 타입은 어떻게 연결하는가? | `package.json`의 `types`가 대표 `.d.ts`를 가리키게 한다. |
| `skipLibCheck`가 누락 타입을 해결하는가? | 아니다. 선언 검사 일부를 생략할 뿐 누락되거나 틀린 계약을 고치지 않는다. |

---

## 7. 미니 퀴즈 또는 체크리스트

### 7.1 미니 퀴즈

1. `declare function openModal(): void;`를 작성하면 브라우저에 `openModal` 함수가 생성되는가?
2. 패키지가 자체 `.d.ts`를 제공하는데 같은 이름의 `@types`를 또 설치할 필요가 있는가?
3. `declare module "legacy-math";`만 작성했을 때 타입 안전성이 충분하지 않은 이유는 무엇인가?
4. `window.appConfig`를 보강할 때 `export {}`와 `declare global`은 각각 어떤 역할을 하는가?
5. `types`와 `typeRoots`의 차이는 무엇인가?
6. `emitDeclarationOnly`는 어떤 상황에 유용한가?
7. `skipLibCheck`를 켜도 해결되지 않는 문제 두 가지를 말해 보자.

### 7.2 실습 체크리스트

- [ ] 타입이 없는 가상의 패키지에 이름 있는 함수 선언을 작성했다.
- [ ] 정상 호출과 `@ts-expect-error`를 사용한 잘못된 호출을 함께 검사했다.
- [ ] `*.svg` 또는 `*.module.css` 와일드카드 선언을 설명할 수 있다.
- [ ] `Window` 인터페이스를 `declare global`로 보강해 보았다.
- [ ] `npx tsc --noEmit --listFiles`로 로컬 `.d.ts` 포함 여부를 확인했다.
- [ ] `declaration: true`로 작은 라이브러리의 `.d.ts`를 생성해 보았다.
- [ ] `npm pack --dry-run` 결과에서 선언 파일 포함 여부를 확인했다.

---

## 참고 자료

- [TypeScript Handbook - Declaration Files Introduction](https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html)
- [TypeScript Handbook - Declaration Reference](https://www.typescriptlang.org/docs/handbook/declaration-files/by-example.html)
- [TypeScript Handbook - Modules .d.ts](https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-d-ts.html)
- [TypeScript Handbook - Consumption](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html)
- [TypeScript Handbook - Publishing](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html)
- [TypeScript Handbook - Creating .d.ts Files from .js Files](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html)
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/)

> 정리 기준일: 2026-08-09
