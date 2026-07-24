# TypeScript 학습 로드맵

TypeScript 공식 핸드북을 한 파일에 압축하지 않고, 앞 개념이 다음 개념의 재료가 되도록 여섯 단계로 나누어 정리했다.

## 학습 순서

| 순서 | 주제 | 핵심 질문 | 노트 |
|---:|---|---|---|
| 1 | 기초와 일상 타입 | TypeScript는 JavaScript에 무엇을 더하며, 유니언을 어떻게 좁히는가? | [기초와 일상 타입](./07_24_TypeScript_Basics_and_Everyday_Types/07_24_TypeScript_Basics_and_Everyday_Types.md) |
| 2 | 함수와 객체 타입 | 호출 규칙과 객체 구조를 어떻게 계약으로 표현하는가? | [함수와 객체 타입](./07_24_TypeScript_Functions_and_Object_Types/07_24_TypeScript_Functions_and_Object_Types.md) |
| 3 | 제네릭과 타입 연산자 | 입력과 출력의 타입 관계를 어떻게 잃지 않는가? | [제네릭과 타입 연산자](./07_24_TypeScript_Generics_and_Type_Operators/07_24_TypeScript_Generics_and_Type_Operators.md) |
| 4 | 고급 타입 조작 | 기존 타입을 조건과 규칙에 따라 어떻게 변환하는가? | [고급 타입 조작](./07_24_TypeScript_Advanced_Type_Manipulation/07_24_TypeScript_Advanced_Type_Manipulation.md) |
| 5 | 클래스 | 생성자 값, 인스턴스 타입, 상속과 접근 경계를 어떻게 구분하는가? | [클래스](./07_24_TypeScript_Classes/07_24_TypeScript_Classes.md) |
| 6 | 모듈과 프로젝트 설정 | TypeScript의 모듈 그래프와 실제 런타임을 어떻게 일치시키는가? | [모듈과 프로젝트 설정](./07_24_TypeScript_Modules_and_Project_Configuration/07_24_TypeScript_Modules_and_Project_Configuration.md) |

## 범위 선정 기준

이번 시리즈는 공식 문서 전체를 줄여 옮긴 것이 아니다. 일상적인 애플리케이션 개발에 필요한 핵심 핸드북 흐름을 우선했다.

- 시작 가이드, The Basics, Everyday Types, Narrowing
- More on Functions, Object Types
- Generics와 주요 타입 연산자
- Conditional, Mapped, Template Literal Types
- Classes, Modules
- `tsconfig.json`과 Project References의 기본 흐름

선언 파일 작성, 데코레이터, JSX, 네임스페이스, 믹스인, 버전별 릴리스 노트는 목적이 생겼을 때 별도의 심화 노트로 다룬다. 이 주제들은 모든 입문자가 순서대로 외울 내용이라기보다 라이브러리 제작이나 특정 프레임워크 환경에서 필요에 따라 참고하는 레퍼런스에 가깝다.

## 추천 학습 방법

1. 각 노트의 `들어가며`와 `핵심 개념 정리`로 해결할 문제를 먼저 파악한다.
2. 코드 예제를 TypeScript Playground에서 직접 바꾸어 오류와 추론 타입을 확인한다.
3. `적용 관점에서 다시 보기`를 현재 프로젝트의 함수, API 모델, 상태 타입에 연결한다.
4. 마지막 체크리스트를 코드 없이 설명할 수 있는지 확인한다.
5. 고급 타입은 직접 만드는 것보다 기존 라이브러리 타입을 읽고 단계별로 풀어 보는 연습을 먼저 한다.

## 공식 문서

- [TypeScript Documentation](https://www.typescriptlang.org/ko/docs/)
- [The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig/)
- [TypeScript Playground](https://www.typescriptlang.org/ko/play/)

> 로드맵 작성 기준일: 2026-07-24
