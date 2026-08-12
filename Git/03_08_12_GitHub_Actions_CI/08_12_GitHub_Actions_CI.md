# GitHub Actions로 TypeScript·React·Firebase 자동 검사하기

- 🎯 글의 목표: 코드를 GitHub에 올릴 때 타입 검사, 린트, 테스트, 빌드와 Firebase Security Rules 테스트를 자동으로 실행하는 CI 흐름을 이해한다.
- 🧩 핵심 키워드: CI, workflow, event, job, step, runner, `npm ci`, 권한, 캐시, Firebase Emulator
- ⭐ 중요도: 상 — 사람이 매번 같은 검사를 빠뜨리지 않게 하고, 문제가 있는 변경이 기본 브랜치에 합쳐지는 일을 줄여 준다.
- 📝 한눈에 보는 내용: 로컬에서 실행하던 검증 명령을 `package.json`에 모으고, GitHub Actions가 같은 명령을 깨끗한 환경에서 다시 실행하게 만든다.
- 🔗 관련 주제: Git push, npm scripts, TypeScript, ESLint, Vitest, Vite, Firebase Security Rules
- 🧱 선수 지식: GitHub 저장소에 코드를 push하는 방법과 `npm run` 명령의 기본 사용법

---

## 1. 들어가며

내 컴퓨터에서 잘 동작한 코드가 다른 환경에서도 반드시 같은 결과를 내는 것은 아니다. 설치된 Node.js 버전이 다르거나, 저장되지 않은 파일에 의존하거나, 테스트를 실행하지 않은 채 코드를 올렸을 수도 있다.

**CI(Continuous Integration, 지속적 통합)** 는 코드 변경이 저장소에 들어올 때마다 정해 둔 검사를 자동으로 실행하는 방식이다. GitHub Actions를 사용하면 별도 서버를 직접 준비하지 않아도 GitHub가 제공하는 임시 컴퓨터에서 검사를 실행할 수 있다.

이 문서는 배포보다 먼저 다음 질문에 답하는 데 집중한다.

- 어떤 시점에 자동 검사를 시작할 것인가?
- 모든 개발 환경에서 같은 명령을 어떻게 실행할 것인가?
- TypeScript·React 검사와 Firebase 보안 규칙 검사를 어떻게 나눌 것인가?
- 실패했을 때 어느 단계부터 확인할 것인가?

## 2. CI의 전체 흐름

GitHub Actions의 설정 파일을 **워크플로(workflow)** 라고 한다. 워크플로는 저장소의 `.github/workflows` 폴더 안에 YAML 파일로 저장한다.

```text
개발자가 코드를 push하거나 Pull Request를 생성
                    ↓ event
GitHub가 워크플로 파일을 읽음
                    ↓
깨끗한 임시 컴퓨터(runner)를 준비
                    ↓
저장소 코드 가져오기 → Node.js 준비 → 의존성 설치
                    ↓
타입 검사 → 린트 → 테스트 → 프로덕션 빌드
                    ↓
모두 성공하면 초록색 체크, 하나라도 실패하면 실패 표시
```

여기서 중요한 점은 CI가 새로운 검사를 발명하지 않는다는 것이다. 개발자가 로컬에서 실행할 수 있는 명령을 GitHub의 실행 환경에서도 같은 순서로 실행한다.

### 2.1 구성 요소의 관계

| 구성 요소 | 쉬운 설명 | 예시 |
| --- | --- | --- |
| event | 워크플로를 시작시키는 사건 | `push`, `pull_request` |
| workflow | 자동화 전체 설계도 | `.github/workflows/ci.yml` |
| job | 한 실행 환경에서 처리할 작업 묶음 | 품질 검사, Rules 테스트 |
| runner | job을 실행하는 임시 컴퓨터 | `ubuntu-latest` |
| step | job 안에서 순서대로 실행되는 한 단계 | 코드 받기, `npm ci` |
| action | 반복 작업을 포장한 재사용 도구 | `actions/checkout` |

하나의 job 안에 있는 step은 위에서 아래로 실행된다. 앞 단계가 실패하면 뒤 단계는 기본적으로 실행되지 않는다. 서로 다른 job은 의존 관계를 지정하지 않으면 병렬로 실행될 수 있다.

## 3. 자동화 전에 로컬 명령부터 정리하기

워크플로 파일에 긴 명령을 직접 적기 전에 `package.json`의 `scripts`를 프로젝트의 공통 계약으로 만든다. 그러면 개발자와 CI가 모두 `npm run typecheck`처럼 같은 명령을 사용한다.

다음은 Vite, TypeScript, ESLint, Vitest를 사용하는 React 프로젝트의 일부 예시다. 실제 프로젝트에 설치된 도구와 설정에 맞게 이름을 조정해야 한다.

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "build": "tsc -b && vite build",
    "test:rules:unit": "vitest run src/rules-tests",
    "test:rules": "firebase emulators:exec --project demo-study-notes --only firestore \"npm run test:rules:unit\""
  }
}
```

- `tsc --noEmit`은 JavaScript 파일을 만들지 않고 TypeScript 타입 오류만 검사한다.
- `eslint .`은 현재 프로젝트 전체에서 정해 둔 코드 규칙 위반을 찾는다.
- `vitest run`은 감시 모드로 기다리지 않고 테스트를 한 번 실행한 뒤 종료한다. CI에서는 종료되는 명령이 필요하다.
- `tsc -b && vite build`는 타입 검사가 성공한 경우에만 Vite 프로덕션 빌드를 만든다.
- `test:rules:unit`은 Rules 테스트 파일만 실행한다.
- `test:rules`는 Firestore Emulator를 켜고 테스트를 실행한 뒤 Emulator를 종료한다. `demo-`로 시작하는 프로젝트 ID를 사용하면 실제 Firebase 프로젝트에 연결하지 않고 테스트할 수 있다.

`test:rules`와 `test:rules:unit`을 나눈 이유는 재귀 실행을 피하기 위해서다. Emulator 안에서 다시 `npm run test:rules`를 호출하면 같은 명령이 계속 자신을 호출하게 된다.

### 3.1 CI를 만들기 전에 확인할 명령

프로젝트 루트, 즉 `package.json`이 있는 폴더에서 다음 명령을 하나씩 실행한다.

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:rules
```

로컬에서도 존재하지 않거나 실패하는 명령은 CI에서도 성공하지 않는다. 먼저 각 명령이 무엇을 검사하는지 확인하고 오류를 해결한 뒤 자동화한다.

## 4. 첫 번째 GitHub Actions 워크플로

실제 React 프로젝트에 `.github/workflows/ci.yml` 파일을 만들고 다음과 같이 작성할 수 있다. 예시는 GitHub 공식 액션의 현재 주요 버전인 `actions/checkout@v6`, `actions/setup-node@v6`를 사용한다. 액션의 주요 버전은 시간이 지나면 바뀔 수 있으므로 새 프로젝트에 적용할 때 공식 저장소를 다시 확인한다.

```yaml
# Actions 화면과 상태 검사 목록에 표시할 워크플로 이름이다.
name: React CI

# 언제 검사를 시작할지 정한다.
on:
  # master 브랜치에 코드가 직접 push될 때 실행한다.
  push:
    branches: [master]

  # master 브랜치를 대상으로 Pull Request가 만들어지거나 갱신될 때 실행한다.
  pull_request:
    branches: [master]

# 워크플로가 저장소 내용을 읽는 데 필요한 최소 권한만 허용한다.
permissions:
  contents: read

# 같은 브랜치에 새 커밋이 올라오면 이전의 오래된 실행을 취소한다.
# github.workflow는 워크플로 이름, github.ref는 브랜치나 PR 참조 값이다.
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    # GitHub가 관리하는 Ubuntu 임시 컴퓨터에서 job을 실행한다.
    runs-on: ubuntu-latest

    # 명령이 멈춰도 무한히 실행되지 않도록 job 전체 제한 시간을 둔다.
    timeout-minutes: 15

    steps:
      # 1. runner는 처음에 저장소 파일이 없으므로 코드를 내려받는다.
      - name: Checkout repository
        uses: actions/checkout@v6

      # 2. 프로젝트에서 사용할 Node.js 버전을 준비한다.
      # .nvmrc를 사용하면 로컬과 CI가 같은 버전 정보를 공유할 수 있다.
      # cache: npm은 npm 다운로드 캐시를 재사용해 설치 시간을 줄인다.
      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: npm

      # 3. package-lock.json에 기록된 버전 그대로 의존성을 설치한다.
      - name: Install dependencies
        run: npm ci

      # 4. JavaScript 파일을 만들지 않고 타입 오류만 확인한다.
      - name: Check TypeScript types
        run: npm run typecheck

      # 5. 프로젝트의 ESLint 규칙을 위반한 코드를 찾는다.
      - name: Run ESLint
        run: npm run lint

      # 6. 테스트를 한 번 실행하고 성공 또는 실패 코드로 종료한다.
      - name: Run tests
        run: npm run test

      # 7. 마지막으로 실제 배포용 결과물을 만들 수 있는지 확인한다.
      - name: Build application
        run: npm run build
```

프로젝트 루트에는 사용할 Node.js 주요 버전을 적은 `.nvmrc`도 커밋한다.

```text
24
```

Node.js 버전을 워크플로에 직접 `node-version: 24`로 적어도 된다. 그러나 `.nvmrc` 같은 버전 파일을 공유하면 개발자와 CI가 서로 다른 값을 따로 관리할 가능성이 줄어든다.

### 4.1 YAML을 읽을 때 주의할 점

YAML은 들여쓰기로 포함 관계를 표현한다. 탭 대신 공백을 사용하고, 같은 수준의 항목은 같은 칸에서 시작해야 한다.

```yaml
# 올바름: run은 name과 같은 step에 속한다.
- name: Run tests
  run: npm run test
```

```yaml
# 잘못됨: run의 들여쓰기 수준이 달라 구조가 깨진다.
- name: Run tests
    run: npm run test
```

`${{ ... }}`는 GitHub Actions의 표현식 문법이다. 일반 셸의 환경 변수 문법이 아니며, GitHub가 워크플로를 해석할 때 값을 계산한다.

## 5. `npm install` 대신 `npm ci`를 사용하는 이유

`npm install`은 의존성을 추가하거나 갱신하는 개발 과정에 적합하다. 반면 `npm ci`는 이미 커밋된 `package-lock.json`을 기준으로 깨끗하게 다시 설치하는 CI 환경에 적합하다.

`npm ci`는 다음 특성이 있다.

1. `package-lock.json`이 반드시 필요하다.
2. `package.json`과 lock 파일의 내용이 맞지 않으면 임의로 고치지 않고 실패한다.
3. 기존 `node_modules`를 정리하고 lock 파일에 기록된 버전을 설치한다.
4. lock 파일을 변경하지 않는다.

따라서 `package-lock.json`도 Git에 커밋해야 한다. CI에서 lock 파일 불일치로 실패했다면 로컬에서 무조건 삭제부터 하지 말고, 의존성 변경을 제대로 반영했는지 확인한 뒤 `npm install`로 lock 파일을 갱신하고 함께 커밋한다.

`setup-node`의 npm 캐시는 `node_modules` 자체를 저장하는 기능이 아니다. npm이 내려받은 패키지 데이터를 재사용하여 다음 설치를 빠르게 만들며, 실제 의존성 구성은 매번 `npm ci`가 lock 파일을 기준으로 재현한다.

## 6. Firebase Security Rules 테스트를 별도 job으로 나누기

React의 타입 검사나 컴포넌트 테스트가 통과해도 Firestore Security Rules가 잘못되면 허용하지 않아야 할 읽기·쓰기가 가능할 수 있다. 반대로 Rules가 지나치게 엄격하면 정상 사용자도 데이터를 사용할 수 없다.

Firestore Emulator는 Java가 필요하므로 일반 품질 검사와 준비 과정이 다르다. 이를 별도 job으로 나누면 두 검사가 병렬로 실행되고, 실패 위치도 더 분명해진다.

다음 내용을 앞의 `ci.yml`에 있는 `jobs` 아래에 `quality`와 같은 들여쓰기 수준으로 추가한다.

```yaml
  firebase-rules:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      # Rules 파일과 테스트 코드를 runner로 가져온다.
      - name: Checkout repository
        uses: actions/checkout@v6

      # Firebase Firestore Emulator가 사용하는 Java 실행 환경을 준비한다.
      - name: Setup Java
        uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: "21"

      # Firebase CLI와 Vitest가 설치될 Node.js 환경을 준비한다.
      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: npm

      # firebase-tools를 devDependencies에 포함해 두면 함께 설치된다.
      - name: Install dependencies
        run: npm ci

      # package.json의 test:rules가 Emulator 시작, 테스트, 종료를 담당한다.
      - name: Test Firestore Security Rules
        run: npm run test:rules
```

Rules 테스트용 Emulator만 사용한다면 실제 Firebase 로그인 정보나 서비스 계정 키가 필요하지 않다. `firebase.json`에는 테스트할 Rules 파일 경로와 Emulator 설정이 있어야 하며, `--only firestore`로 필요한 Emulator만 실행하면 준비 시간을 줄일 수 있다.

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": false
    }
  }
}
```

이 파일은 JSON이므로 주석을 넣을 수 없다. `firestore.rules` 경로가 실제 파일 위치와 다르면 Emulator가 올바른 규칙을 읽지 못한다.

## 7. 최소 권한과 비밀 값 관리

GitHub Actions는 실행 중에 저장소와 상호작용할 수 있는 `GITHUB_TOKEN`을 받는다. 검사만 하는 워크플로는 저장소 파일을 읽을 수 있으면 충분하므로 다음처럼 최소 권한을 명시한다.

```yaml
permissions:
  contents: read
```

권한을 넓게 주면 워크플로 또는 사용한 외부 액션이 공격당했을 때 피해 범위도 커진다. 댓글 작성이나 배포처럼 쓰기 작업을 추가할 때만 필요한 권한을 job 단위로 검토한다.

Firebase 웹 앱의 공개 설정 값과 관리자 인증 정보도 구분해야 한다. 클라이언트의 Firebase 설정은 앱에 포함되는 식별 정보이며, 데이터 보호를 맡는 비밀번호가 아니다. 실제 접근 통제는 Authentication, Security Rules, App Check가 함께 담당한다. 반면 서비스 계정 개인 키, 배포 토큰, API를 호출하는 비밀 키는 저장소나 YAML에 직접 적지 않고 GitHub Actions Secrets에 저장해야 한다.

```yaml
# 비밀 값이 정말 필요한 배포 단계에서만 환경 변수로 전달하는 형태다.
- name: Example deployment command
  run: npm run deploy
  env:
    DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

로그에 비밀 값을 출력하는 `echo` 명령을 넣지 않는다. 출처를 신뢰할 수 없는 Pull Request에서는 비밀 값이 전달되지 않을 수 있으며, `pull_request_target` 이벤트는 기본 브랜치 권한과 결합될 수 있으므로 단순히 비밀 값 문제를 해결하려고 바꾸면 안 된다.

## 8. 실패 로그를 읽는 순서

워크플로가 실패하면 빨간 표시만 보고 모든 명령을 다시 실행하기보다 처음 실패한 step부터 확인한다.

### 8.1 `npm ci`가 실패한 경우

- `package-lock.json`이 저장소에 있는가?
- `package.json`만 수정하고 lock 파일을 커밋하지 않았는가?
- 프로젝트가 하위 폴더에 있는데 루트에서 명령을 실행하고 있지 않은가?
- 사설 패키지 저장소 인증이 필요한가?

프로젝트가 `frontend` 폴더에 있다면 step마다 반복하는 대신 job의 기본 실행 폴더를 지정할 수 있다.

```yaml
defaults:
  run:
    working-directory: frontend
```

이 설정은 `run` 명령의 위치를 바꾸지만 `uses`로 실행하는 action의 위치까지 자동으로 바꾸지는 않는다. `setup-node`의 lock 파일 탐색 경로가 다르면 `cache-dependency-path: frontend/package-lock.json`도 지정한다.

### 8.2 타입 검사 또는 빌드가 실패한 경우

- 대소문자가 다른 import 경로가 없는가? Windows에서는 지나갔지만 Linux runner에서는 실패할 수 있다.
- 로컬에만 있고 Git에 커밋하지 않은 파일을 import하지 않았는가?
- `VITE_` 환경 변수가 빌드 과정에 필요한가?
- 타입 검사와 빌드가 서로 다른 `tsconfig`를 사용하고 있지 않은가?

### 8.3 테스트가 끝나지 않는 경우

- Vitest가 감시 모드로 실행되고 있지 않은가? CI에서는 `vitest run`을 사용한다.
- 테스트가 생성한 서버, 타이머, 데이터베이스 연결을 종료했는가?
- Firebase Emulator 안에서 실행할 명령이 다시 Emulator 명령 자체를 호출하고 있지 않은가?

### 8.4 Emulator 테스트가 실패한 경우

- Java 실행 환경이 준비되었는가?
- `firebase-tools`와 `@firebase/rules-unit-testing`이 개발 의존성에 있는가?
- `firebase.json`이 실제 Rules 파일을 가리키는가?
- 테스트 환경의 프로젝트 ID와 `--project` 값이 같은가?
- 테스트 뒤에 환경을 정리하고 테스트 사이 데이터를 분리했는가?

## 9. CI가 있다고 끝이 아닌 이유

CI는 작성해 둔 검사만 실행한다. 테스트하지 않은 동작이나 잘못 설정한 Rules까지 자동으로 알아내지는 못한다. 따라서 다음 세 층을 함께 관리한다.

```text
코드 작성 중
  └─ 에디터의 TypeScript·ESLint 피드백

push 전
  └─ 로컬에서 typecheck, lint, test, build, Rules 테스트

push 후
  └─ GitHub Actions가 깨끗한 환경에서 같은 검사 재실행
```

팀 저장소에서는 기본 브랜치 보호 규칙 또는 ruleset에 CI job을 필수 상태 검사로 등록할 수 있다. 그러면 필요한 검사가 성공하기 전에는 Pull Request를 합치지 못하게 만들 수 있다. 직접 `master`에 push하는 흐름이라면 push 후 실패 알림을 반드시 확인하고 바로 수정해야 한다.

`continue-on-error: true`를 필수 검사에 사용하면 명령이 실패해도 job을 성공처럼 진행할 수 있다. 실험적인 검사처럼 실패를 허용할 분명한 이유가 있을 때만 사용한다.

## 10. 적용 순서와 체크리스트

처음부터 복잡한 워크플로를 만들기보다 다음 순서로 확장한다.

1. `package.json`에 로컬 검증 명령을 정리한다.
2. 모든 명령을 로컬에서 각각 실행해 성공시킨다.
3. Node.js 버전 파일과 `package-lock.json`을 커밋한다.
4. `quality` job 하나로 타입 검사, 린트, 테스트, 빌드를 자동화한다.
5. 의도적으로 작은 오류를 만들어 CI가 실제로 실패를 잡는지 확인한 뒤 오류를 되돌린다.
6. Firebase를 사용한다면 Emulator 기반 Rules 테스트를 별도 job으로 추가한다.
7. 저장소 설정에서 성공한 job을 필수 상태 검사로 연결할지 결정한다.

워크플로를 수정할 때는 아래 항목을 확인한다.

- [ ] 워크플로 파일이 `.github/workflows/*.yml` 또는 `*.yaml`에 있는가?
- [ ] 로컬과 CI가 같은 Node.js 버전을 사용하는가?
- [ ] `package-lock.json`이 커밋되어 있는가?
- [ ] 감시 모드가 아닌, 종료되는 테스트 명령을 사용하는가?
- [ ] 권한은 필요한 범위로 제한했는가?
- [ ] 비밀 값을 코드, YAML, 로그에 노출하지 않았는가?
- [ ] Firebase 테스트는 실제 운영 데이터가 아닌 Emulator를 사용하는가?
- [ ] 실패한 첫 step의 로그부터 읽었는가?

## 11. 배운 점과 확장 포인트

### 11.1 새로 이해한 것

GitHub Actions는 Git 명령을 대신하는 도구가 아니라 GitHub의 사건을 계기로 검증 명령을 실행하는 자동화 환경이다. 좋은 CI의 출발점은 복잡한 YAML이 아니라 어느 환경에서도 같은 이름으로 실행할 수 있는 로컬 스크립트다.

또한 React 코드 품질 검사와 Firebase Security Rules 테스트는 준비 환경과 실패 의미가 다르다. job을 나누면 책임과 로그가 선명해지고 독립적인 검사를 동시에 실행할 수 있다.

### 11.2 다음 학습과의 연결

- GitHub ruleset과 필수 상태 검사
- 테스트 결과와 빌드 결과물을 artifact로 보관하기
- 여러 Node.js 버전을 검사하는 matrix
- 중복 워크플로를 줄이는 재사용 가능한 workflow
- 검사가 통과한 커밋만 Firebase Hosting에 배포하는 CD

## 12. 요약 정리

1. CI는 코드 변경 때마다 정해 둔 검사를 깨끗한 환경에서 자동 실행한다.
2. GitHub Actions 워크플로는 event, job, runner, step으로 구성된다.
3. 자동화 전에 로컬 검증 명령을 `package.json` scripts로 통일해야 한다.
4. CI에서는 lock 파일을 기준으로 재현 가능한 설치를 하는 `npm ci`가 알맞다.
5. Node.js 버전 파일을 공유하면 로컬과 CI의 환경 차이를 줄일 수 있다.
6. 최소 권한인 `contents: read`부터 시작하고 비밀 값은 Secrets로 관리한다.
7. Firebase Rules는 실제 프로젝트 대신 Emulator에서 허용·거부 동작을 테스트한다.
8. 실패할 때는 전체 로그가 아니라 처음 실패한 step과 그 직전 준비 단계를 확인한다.

🧠 기억할 것: **CI는 나 대신 생각해 주는 도구가 아니라, 내가 정한 검증 약속을 매번 같은 환경에서 빠짐없이 실행해 주는 장치다.**

## 13. 미니 퀴즈

1. 내 컴퓨터에서 테스트가 성공했는데도 CI에서 다시 검사해야 하는 이유는 무엇인가?
2. workflow, job, step의 포함 관계를 설명해 보자.
3. CI에서 `npm install`보다 `npm ci`가 알맞은 이유는 무엇인가?
4. 테스트 명령이 `vitest`로만 되어 있을 때 CI가 끝나지 않을 수 있는 이유는 무엇인가?
5. React 품질 검사와 Firebase Rules 테스트를 별도 job으로 나누면 어떤 장점이 있는가?
6. `permissions: contents: read`가 의미하는 것은 무엇인가?
7. Windows에서는 성공하지만 Ubuntu runner에서 import 오류가 발생했을 때 무엇을 먼저 확인해야 하는가?

<details>
<summary>정답과 해설</summary>

1. CI는 저장되지 않은 로컬 상태를 제외하고 정해진 Node.js와 의존성으로 다시 검사하므로 환경 차이와 누락된 검사를 발견할 수 있다.
2. 하나의 workflow 안에 하나 이상의 job이 있고, 각 job 안에 순서대로 실행되는 step이 있다.
3. `npm ci`는 커밋된 lock 파일과 정확히 일치하는 의존성을 깨끗하게 설치하며 불일치를 임의로 고치지 않는다.
4. `vitest`는 기본적으로 파일 변경을 기다리는 감시 모드가 될 수 있다. CI에서는 한 번 실행하고 종료하는 `vitest run`을 사용한다.
5. 준비 환경과 실패 원인을 구분할 수 있고, 의존 관계가 없다면 두 job을 병렬로 실행할 수 있다.
6. 워크플로 토큰이 저장소 내용을 읽을 수 있지만 쓰기 권한은 갖지 않도록 제한한다는 뜻이다.
7. 파일명과 import 경로의 대소문자가 정확히 일치하는지 먼저 확인한다. Linux 파일 시스템은 대소문자를 구분하는 경우가 일반적이다.

</details>

## 참고 자료

- [GitHub Docs - Building and testing Node.js](https://docs.github.com/en/actions/how-tos/use-cases-and-examples/building-and-testing/building-and-testing-nodejs)
- [GitHub Docs - Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Docs - Assigning permissions to jobs](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/automatic-token-authentication)
- [actions/checkout 공식 저장소](https://github.com/actions/checkout)
- [actions/setup-node 공식 저장소](https://github.com/actions/setup-node)
- [npm Docs - npm ci](https://docs.npmjs.com/cli/commands/npm-ci)
- [Firebase Docs - Local Emulator Suite 설치와 CI 구성](https://firebase.google.com/docs/emulator-suite/install_and_configure)
- [Firebase Docs - Security Rules 테스트 환경](https://firebase.google.com/docs/rules/emulator-setup)
