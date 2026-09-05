# TIL

개발 과정에서 배운 내용을 제 언어로 다시 설명하고, 나중에 빠르게 복습할 수 있도록 기록하는 학습 저장소입니다.

단순한 개념 요약보다 **왜 필요한지, 어떻게 동작하는지, 실제 코드에서 무엇을 주의해야 하는지**를 함께 남기는 것을 목표로 합니다.

> 2026-09-06 기준 · 18개 학습 분야 · 학습 노트 200개 · Spring Boot 입문 노트 10개
>
> 개발 경험과 프로젝트 소개는 [GitHub 프로필](https://github.com/j-moo)에서 확인할 수 있습니다.

## Start Here

- **최신 강의노트**: [Spring 트랜잭션과 rollback](./SpringBoot/09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md) — 줄별 주석을 단 재고·대여 예제로 commit·rollback·프록시·전파와 실패 테스트를 연결합니다.
- **현재 학습 중**: [Spring Boot 로드맵](./SpringBoot/README.md) — 사전지식부터 데이터 접근·트랜잭션까지 정리했고, 다음은 단위·슬라이스·통합 테스트입니다.
- **기초부터 복습**: [Java](./Java/README.md) · [TypeScript](./TypeScript/README.md) · [React](./React/README.md) — 각 로드맵의 핵심 질문을 기준으로 필요한 노트를 찾습니다.

## Recently Updated

| 주제 | 핵심 내용 | 노트 |
| --- | --- | --- |
| Spring Boot 입문 시리즈 | IoC·DI, MVC·REST, 검증·설정, JDBC·JPA·연관관계, 트랜잭션과 rollback | [로드맵](./SpringBoot/README.md) |
| React 입문 시리즈 | TypeScript 기반 컴포넌트·라우팅·상태 관리·CRUD·Firebase 인증 경로·테스트·오류 복구 | [로드맵](./React/README.md) |
| Firebase 웹 시리즈 | SDK 설정, 데이터·파일 저장소, Authentication, 계정 수명주기, App Check, Security Rules, Emulator 테스트와 커서 페이지네이션 | [로드맵](./Firebase/README.md) |
| TypeScript 핵심 핸드북 시리즈 | 기초 타입부터 함수·객체·제네릭·고급 타입·모듈·선언 파일·타입 오류 읽기까지 | [로드맵](./TypeScript/README.md) |
| API와 JSON 데이터 분석 | HTTP 요청, API Key, 중첩 JSON 탐색, 필터링·집계·정렬, I/O와 변환 로직 분리 | [바로가기](./Python/01_23_API_JSON_Data_Analysis/01_23_API_JSON_Data_Analysis.md) |
| NumPy·Pandas·Matplotlib | 배열 연산, DataFrame 전처리, 결측치 처리, 그룹 집계, 시계열 분석과 시각화 | [바로가기](./Python/01_30_NumPy_Pandas_Matplotlib/01_30_NumPy_Pandas_Matplotlib.md) |
| Vue JWT 인증 | Vue와 DRF 환경에서 JWT 인증 흐름과 사용자 상태 관리 | [바로가기](./Vue/06_12_JWT/06_12_JWT_lecture_note.md) |
| FastAPI | API 기초, 모델 서빙, API Gateway와 멀티모달 연동 | [바로가기](./FastAPI/05_22_FastAPI/05_22_FastAPI.md) |
| GitHub Actions CI | TypeScript·React 품질 검사와 Firebase Security Rules 테스트 자동화 | [로드맵](./Git/README.md) |
| Java 입문 시리즈 | 실행 환경·기본 문법·객체지향·컬렉션·예외·제네릭을 처음부터 연결해 학습 | [로드맵](./Java/README.md) |
| 웹 접근성 기초 | 시맨틱 HTML, 키보드·focus, 폼, ARIA와 React 동적 상태 접근성 | [로드맵](./Web/README.md) |
| 브라우저 웹 보안 기초 | SOP·CORS·cookie·XSS·CSRF·CSP와 React·Firebase의 신뢰 경계 | [로드맵](./Web/README.md) |
| Windows·Python 개발환경 | PowerShell 실행 정책, Conda 가상환경, 환경 정의 파일과 PEP 8 | [바로가기](./Python/08_17_Python_Development_Environment/08_17_Python_Development_Environment.md) |
| SQL 쿼리 해석 | GROUP BY의 결과 행, 스칼라 서브쿼리, EXISTS·NOT EXISTS, LIKE ESCAPE | [바로가기](./DB/08_17_SQL_Query_Reading/08_17_SQL_Query_Reading.md) |
| Hadoop·MapReduce | HDFS 블록·복제·장애 허용성과 Map·Shuffle·Combine·Reduce 흐름 | [로드맵](./DataEngineering/README.md) |
| UX/UI 설계 | 사용자 흐름, 라우팅, 화면 상태, 컨셉보드와 디자인 시스템 | [로드맵](./Web/README.md) |
| AI 코딩 도구 협업 | 범위·맥락·권한·인증 경로와 검증 가능한 완료 조건 | [바로가기](./ai/08_17_AI_Coding_Assistant_Workflow/08_17_AI_Coding_Assistant_Workflow.md) |
| JavaScript 배열 리팩터링 | map 반환값, 빈 배열 조건, splice·reduce와 읽기 좋은 개선 기준 | [바로가기](./Javascript/08_18_JavaScript_Array_Refactoring/08_18_JavaScript_Array_Refactoring.md) |
| JavaScript 문자열·2차원 배열 | 숫자 문자 판별, filter·map 구분, 열 추출과 행렬 계산 | [바로가기](./Javascript/08_19_JavaScript_String_and_2D_Array/08_19_JavaScript_String_and_2D_Array.md) |
| Oracle 계층형 쿼리 | START WITH·CONNECT BY·PRIOR와 LEVEL·순환·형제 정렬 | [바로가기](./DB/08_20_Oracle_Hierarchical_Query/08_20_Oracle_Hierarchical_Query.md) |
| JavaScript 참조·복사·불변성 | 객체 참조, 얕은·깊은 복사, 중첩 갱신과 structuredClone | [바로가기](./Javascript/08_22_JavaScript_Reference_Copy_and_Immutability/08_22_JavaScript_Reference_Copy_and_Immutability.md) |
| JavaScript 객체·다차원 배열 문제 해결 | 동적 키, 속성 검사, spread, map 인덱스, 행렬 대각선과 차원 순회 | [바로가기](./Javascript/08_23_JavaScript_Object_and_Multidimensional_Array_Problem_Solving/08_23_JavaScript_Object_and_Multidimensional_Array_Problem_Solving.md) |
| JavaScript 비동기 요청 제어 | Promise 동시성, 요청 취소, 경쟁 상태와 debounce | [바로가기](./Javascript/08_24_JavaScript_Async_Concurrency_and_Request_Control/08_24_JavaScript_Async_Concurrency_and_Request_Control.md) |

## Learning Timeline

2026년 7월 3일을 기준점으로, 9월 6일까지 **88개의 노트**를 추가했습니다. 아래는 이 기간의 학습 흐름이며 프로필 갱신 날짜와는 별도로 관리합니다.

| 기간 | 학습 축 | 주요 내용 |
| --- | --- | --- |
| 2026.07.04–07.07 | Python·Django·DB | 데이터 크롤링, 고급 Model/Form, 데이터베이스 모델링과 정규화 |
| 2026.07.08–07.23 | Java | 문법, 배열, I/O, 클래스·객체, 상속·인터페이스, 예외 처리, 컬렉션, 함수형 프로그래밍 |
| 2026.07.24–07.26 | TypeScript | 타입 기초, 함수·객체, 제네릭, 고급 타입, 클래스, 모듈과 학습 순서 정리 |
| 2026.07.26–08.11 | React·Firebase | 라우팅·상태 관리·CRUD, Firebase 인증·계정 수명주기·App Check·Rules·Emulator 테스트·커서 페이지네이션·오류 복구 |
| 2026.08.09 | TypeScript | 선언 파일, 외부 라이브러리 타입, 전역·모듈 보강, 선언 생성과 배포 |
| 2026.08.12 | GitHub Actions | TypeScript·React 자동 검사와 Firebase Emulator 기반 Security Rules 테스트 CI |
| 2026.08.13 | React·TypeScript | Hook·폼·상태 공유·Context·스타일 개념 보강과 타입 시스템 사고방식·오류 읽기 |
| 2026.08.14 | Java | 처음 학습자를 위한 전체 안내서와 제네릭·와일드카드·타입 안전성 심화 정리 |
| 2026.08.15 | Web·React | WCAG 원칙, 시맨틱 HTML, 키보드·focus, 폼과 동적 UI 접근성 |
| 2026.08.16 | Web·React·Firebase | 브라우저 origin 보안, CORS·cookie·XSS·CSRF·CSP와 서버 신뢰 경계 |
| 2026.08.17 | Python·DB·Data Engineering·Web·AI | 개발환경, SQL 쿼리 해석, Hadoop·MapReduce, UX/UI 설계, AI 코딩 도구 협업 |
| 2026.08.18 | JavaScript·DB | 배열 리팩터링과 스칼라 서브쿼리 보강 |
| 2026.08.19–08.20 | JavaScript·DB | 문자열·2차원 배열 처리와 Oracle 계층형 쿼리 |
| 2026.08.21 | Spring Boot | Java·Maven/Gradle·HTTP·DB·IoC/DI·Bean과 첫 프로젝트 실행 구조 사전 학습 |
| 2026.08.22 | JavaScript·React | 객체 참조, 얕은·깊은 복사와 불변 상태 갱신 |
| 2026.08.23 | JavaScript | 객체의 동적 키·속성 검사와 2·3차원 배열 문제 해결 패턴 |
| 2026.08.24 | JavaScript·Web API | Promise 동시성, 요청 취소, 경쟁 상태와 debounce |
| 2026.08.25 | Spring Boot | Initializr 생성 옵션, 프로젝트 구조, Wrapper와 첫 애플리케이션 실행 |
| 2026.08.26 | Spring Boot | IoC 컨테이너, Bean 등록, 생성자 주입, 다중 후보와 순환 의존성 진단 |
| 2026.08.28 | Spring Boot | 내장 서버, DispatcherServlet, Controller 매핑, HTTP 메시지 변환과 요청·응답 흐름 |
| 2026.08.29 | Spring Boot | 자원 중심 URI, HTTP 메서드·상태 코드, 요청·응답 DTO와 JSON API 계약 설계 |
| 2026.09.01 | Spring Boot | Bean Validation, 검증 계층, 사용자 정의 예외, ProblemDetail과 일관된 오류 응답 |
| 2026.09.02 | Spring Boot | 외부 설정 우선순위, ConfigurationProperties, Profile, 환경 변수와 비밀값 관리 |
| 2026.09.03 | Spring Boot | JDBC·DataSource·연결 풀부터 JPA·Hibernate·Spring Data Repository까지 데이터 접근 계층 |
| 2026.09.05 | Spring Boot | Entity 생명주기, 변경 감지·flush, 연관관계 주인, 지연 로딩·N+1과 DB 재조회 테스트 |
| 2026.09.06 | Spring Boot | Service 트랜잭션 경계, 예외별 rollback, 프록시·전파, 격리 수준과 실패 경로 통합 테스트 |

## Learning Areas

| 분야 | 내용 | 노트 |
| --- | --- | ---: |
| [Python](./Python) | 문법, 함수, 자료구조, 객체지향, API·JSON, 데이터 분석, Windows·Conda 개발환경 | 12 |
| [Algorithm](./Algorithm) | 배열, 문자열, 스택, 큐, 트리와 문제 해결 전략 | 16 |
| [Problem Review](./problem_review) | 알고리즘 문제 풀이와 접근 과정 복기 | 23 |
| [Web](./Web) | HTML, CSS, 레이아웃, Bootstrap, 반응형 웹, 접근성, 브라우저 보안, UX/UI 설계 | 7 |
| [JavaScript](./Javascript) | 문법, DOM, 이벤트, 객체·다차원 배열, 불변성과 비동기 요청 제어 | 11 |
| [TypeScript](./TypeScript) | 정적 타입 검사, 함수·객체, 제네릭, 고급 타입, 클래스, 모듈, 선언 파일, 오류 읽기 | 8 |
| [React](./React) | 컴포넌트, Hook, 라우팅, 상태 관리, CRUD, Firebase 연동·보호 경로·테스트·오류 복구 | 29 |
| [Firebase](./Firebase) | SDK 설정, Firestore, Realtime Database, Storage, Authentication, 계정 수명주기, App Check, Rules, Emulator, 고급 query | 10 |
| [Vue](./Vue) | Vue 3, Composition API, Router, Pinia, JWT | 11 |
| [DB](./DB) | 관계형 데이터베이스, SQL, 모델 관계, 쿼리 해석과 Oracle 계층형 조회 | 9 |
| [Django](./Django) | Django, ORM, 인증, DRF 기반 API 개발 | 13 |
| [FastAPI](./FastAPI) | API 기초, 모델 서빙, API Gateway, 멀티모달 연동 | 1 |
| [AI](./ai) | 머신러닝, LLM, RAG, Fine-tuning, 모델 활용과 AI 코딩 도구 협업 | 17 |
| [Data Engineering](./DataEngineering) | HDFS 분산 저장, 장애 허용성과 MapReduce 배치 처리 | 1 |
| [Java](./Java) | Java 문법, 객체지향, 컬렉션, 제네릭, 예외 처리와 함수형 프로그래밍 | 17 |
| [Spring Boot](./SpringBoot) | 실행 구조, IoC·DI, MVC·REST, 검증·설정, JDBC·JPA·연관관계와 트랜잭션 | 10 |
| [Git](./Git) | 버전 관리, 원격 저장소와 GitHub Actions CI | 3 |
| [Markdown](./markdown) | Markdown 문법과 문서 작성 연습 | 2 |

현재 총 **200개의 학습 노트**를 관리하고 있습니다. README·작성 프롬프트·점검 보고서는 학습 노트 수에서 제외합니다.

## Current Focus

현재는 **프론트엔드에서 사용하는 API를 서버·DB의 동작 원리까지 연결해 이해하는 것**에 집중합니다.

1. **Spring Boot·JPA**: 요청 처리부터 Service·Repository, Entity 상태와 SQL 실행, commit·rollback 경계와 예외 규칙까지 추적합니다.
2. **다음 학습 — 테스트**: 트랜잭션 실패 테스트를 출발점으로 단위·슬라이스·통합 테스트의 검증 범위와 mock·실제 DB의 역할을 구분합니다.
3. **Java 기반 강화**: 객체지향·컬렉션·제네릭을 복습하고 Entity의 동일성·동등성 문제로 연결합니다.
4. **React·TypeScript·Firebase 복습**: 타입 계약, 비동기 상태, 인증·인가, 접근성·오류 복구를 실제 사용자 흐름으로 설명합니다.
5. **학습 기록의 재현성**: 설명용 코드와 실행 가능한 코드를 구분하고, 문서 링크·집계·유지보수 도구를 검사합니다.

기존 데이터 분석·AI·알고리즘 학습 기록은 위의 분야별 목록과 학습 이력에서 이어서 확인할 수 있습니다.

## How I Write

각 노트는 가능한 한 다음 흐름으로 정리합니다.

1. 학습 주제가 해결하려는 문제와 전체 흐름을 먼저 파악합니다.
2. 핵심 개념을 처음 배우는 사람도 이해할 수 있도록 풀어 설명합니다.
3. 예제와 코드를 관련 개념 바로 옆에 배치하고 실행 흐름을 해설합니다.
4. 자주 발생하는 실수와 디버깅 기준을 함께 기록합니다.
5. 마지막에는 핵심 요약과 질문을 남겨 스스로 이해도를 확인합니다.

## Repository Structure

```text
TIL/
├── Python/          # Python, API·JSON, 데이터 분석
├── Algorithm/       # 자료구조와 알고리즘 강의
├── problem_review/  # 알고리즘 문제 풀이 기록
├── Web/             # HTML, CSS, 반응형 웹, 접근성과 브라우저 보안
├── Javascript/      # JavaScript와 DOM
├── TypeScript/      # 정적 타입 검사와 안전한 JavaScript 개발
├── React/           # 컴포넌트, state, JSX와 React 개발 환경
├── Firebase/        # Firestore, Realtime Database, Storage와 보안 규칙
├── Vue/             # Vue 생태계, JWT와 프론트엔드
├── DB/              # 데이터베이스와 SQL
├── Django/          # Django와 DRF
├── FastAPI/         # FastAPI와 모델 서빙
├── ai/              # 머신러닝과 생성형 AI
├── DataEngineering/ # HDFS와 MapReduce 기반 분산 데이터 처리
├── Java/            # Java 문법, 객체지향과 표준 라이브러리
├── SpringBoot/      # Spring Boot, Spring MVC와 데이터 접근
├── Git/             # Git과 버전 관리
└── markdown/        # 문서 작성 연습
```

## Note

라이브러리나 프레임워크의 API는 버전에 따라 달라질 수 있습니다. 각 문서의 환경과 공식 문서를 함께 확인하며 내용을 계속 보완합니다.

문서 유지보수에는 [읽기 전용 점검 도구](./scripts/check_notes.py)를 사용합니다. Python 3.10 이상에서 실행합니다.

```powershell
python scripts/check_notes.py
python -B -m unittest discover -s scripts -p 'test_*.py' -v
```

점검 범위와 수정·미검증 항목은 [2026-09-05 저장소 점검 기록](./docs/2026_09_05_Repository_Review.md)에 남겼습니다. 강의의 모든 코드 블록을 실행한 결과와 문서 정적 검사 결과는 구분합니다.
