# Firebase 학습 로드맵

Firebase를 처음 사용하는 사람이 **프로젝트 연결 → 데이터·파일 저장소 → 사용자 인증 → Security Rules → Emulator 테스트 → 고급 조회와 페이지네이션** 순서로 학습하도록 정리했다.

폴더 이름은 `[학습 순서]_[날짜]_[주제]` 형식이다. 이름순으로 정렬한 뒤 `01`부터 읽는다. 웹 예제는 npm 기반 모듈형 Firebase JavaScript SDK와 TypeScript를 사용한다.

## 권장 학습 순서

| 순서 | 날짜 | 주제 | 학습 목표 | 노트 |
| ---: | --- | --- | --- | --- |
| 01 | 08/04 | Firebase 시작 | 프로젝트·웹 앱·SDK·환경별 설정의 관계 이해 | [Firebase 웹 프로젝트 시작](./01_08_04_Firebase_Setup/08_04_Firebase_Setup.md) |
| 02 | 08/04 | Cloud Firestore | 컬렉션·문서 모델과 CRUD·실시간 구독 이해 | [Cloud Firestore](./02_08_04_Cloud_Firestore/08_04_Cloud_Firestore.md) |
| 03 | 08/04 | Realtime Database | JSON 트리와 참조·구독·원자적 갱신 이해 | [Realtime Database](./03_08_04_Realtime_Database/08_04_Realtime_Database.md) |
| 04 | 08/04 | Cloud Storage | 파일 경로·업로드 진행률·다운로드 URL·규칙 이해 | [Cloud Storage](./04_08_04_Cloud_Storage/08_04_Cloud_Storage.md) |
| 05 | 08/05 | Authentication | 이메일 계정·로그인·로그아웃·세션 상태 이해 | [Firebase Authentication](./05_08_05_Firebase_Authentication/08_05_Firebase_Authentication.md) |
| 06 | 08/05 | Firestore Rules | 사용자별 CRUD 권한과 필드·query 제한 설계 | [Firestore Security Rules](./06_08_05_Firestore_Security_Rules/08_05_Firestore_Security_Rules.md) |
| 07 | 08/05 | Emulator 테스트 | 운영 데이터 없이 Rules의 허용·거부 사례 자동 검증 | [Firebase Emulator 테스트](./07_08_05_Firebase_Emulator_Testing/08_05_Firebase_Emulator_Testing.md) |
| 08 | 08/06 | 고급 조회와 페이지네이션 | 필터·정렬·복합 인덱스·커서와 읽기 비용 이해 | [Firestore 고급 조회와 페이지네이션](./08_08_06_Firestore_Advanced_Queries/08_06_Firestore_Advanced_Queries.md) |

## 제품 선택 기준

| 요구 사항 | 우선 검토할 제품 |
| --- | --- |
| 문서 중심 데이터, 복합 질의, 컬렉션 구조 | Cloud Firestore |
| 작은 JSON 트리의 매우 빠른 실시간 동기화 | Realtime Database |
| 이미지·음성·문서 같은 바이너리 파일 | Cloud Storage |

데이터베이스와 파일 저장소는 대체 관계가 아니다. 게시글 필드는 Firestore에, 첨부 이미지 원본은 Storage에 저장하고 문서에는 파일 경로나 다운로드 URL 같은 메타데이터를 연결할 수 있다.

React 화면에서 Firebase를 사용하는 전체 흐름은 [TypeScript로 React와 Firebase 연결하기](../React/26_08_04_React_with_Firebase/08_04_React_with_Firebase.md)에서 이어서 학습한다.

## 복습 기준

1. Firebase project, web app, SDK instance의 관계를 설명할 수 있는가?
2. 웹 설정 객체가 보안 규칙을 대신하지 못하는 이유를 설명할 수 있는가?
3. Firestore와 Realtime Database의 데이터 모델 차이를 설명할 수 있는가?
4. 실시간 listener를 React Effect cleanup에서 해제할 수 있는가?
5. Storage 업로드 전에 파일 크기와 MIME type을 검사할 수 있는가?
6. 개발용 공개 규칙을 운영 환경에 남기면 안 되는 이유를 설명할 수 있는가?
7. 인증과 인가의 차이, `request.auth.uid`의 역할을 설명할 수 있는가?
8. Rules에서 `resource.data`와 `request.resource.data`를 구분할 수 있는가?
9. Emulator에서 허용 요청과 거부 요청을 독립적으로 테스트할 수 있는가?
10. `where`, `orderBy`, `limit`이 각각 query에서 맡는 역할을 설명할 수 있는가?
11. 복합 인덱스가 필요한 이유와 오류 발생 시 확인 순서를 설명할 수 있는가?
12. offset 대신 마지막 문서 snapshot과 `startAfter`를 사용하는 이유를 설명할 수 있는가?
