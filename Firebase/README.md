# Firebase 학습 로드맵

Firebase를 처음 사용하는 사람이 **프로젝트 연결 → Firestore 문서 데이터 → Realtime Database 동기화 → Storage 파일 업로드** 순서로 학습하도록 정리했다.

폴더 이름은 `[학습 순서]_[날짜]_[주제]` 형식이다. 이름순으로 정렬한 뒤 `01`부터 읽는다. 웹 예제는 npm 기반 모듈형 Firebase JavaScript SDK와 TypeScript를 사용한다.

## 권장 학습 순서

| 순서 | 날짜 | 주제 | 학습 목표 | 노트 |
| ---: | --- | --- | --- | --- |
| 01 | 08/04 | Firebase 시작 | 프로젝트·웹 앱·SDK·환경별 설정의 관계 이해 | [Firebase 웹 프로젝트 시작](./01_08_04_Firebase_Setup/08_04_Firebase_Setup.md) |
| 02 | 08/04 | Cloud Firestore | 컬렉션·문서 모델과 CRUD·실시간 구독 이해 | [Cloud Firestore](./02_08_04_Cloud_Firestore/08_04_Cloud_Firestore.md) |
| 03 | 08/04 | Realtime Database | JSON 트리와 참조·구독·원자적 갱신 이해 | [Realtime Database](./03_08_04_Realtime_Database/08_04_Realtime_Database.md) |
| 04 | 08/04 | Cloud Storage | 파일 경로·업로드 진행률·다운로드 URL·규칙 이해 | [Cloud Storage](./04_08_04_Cloud_Storage/08_04_Cloud_Storage.md) |

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
