# TIL 저장소 점검 기록 — 2026-09-05

## 1. 점검 범위와 해석

원격 `master`를 fast-forward 방식으로 pull하여 이미 최신임을 확인한 뒤 작업했다. 기존 작업 폴더에는 미커밋 변경이 없었다.

이 저장소는 하나의 실행 애플리케이션이 아니라 여러 기술의 Markdown 강의노트와 이미지·실습 자료를 모은 저장소다. 따라서 **저장소 전체의 문서 구조 검사**와 **선택한 예제의 수동 정확성 검토**를 나누었다. 모든 문장·모든 코드 블록의 동작을 전수 검증했다는 뜻은 아니다.

| 범위 | 점검 방식 | 결과·판단 |
| --- | --- | --- |
| 전체 Markdown | Git 추적 파일과 ignore되지 않은 신규 파일의 로컬 링크·코드 fence 검사 | 검사 도구 기준 누락 링크·닫히지 않은 fence 없음 |
| 18개 학습 분야 | README를 제외한 학습 노트 수 집계, 루트 과목별 수치 대조 | 기존 198개 일치, 신규 노트 반영 후 199개 |
| 루트·분야 로드맵 | 학습 순서, 다음 주제, 새 노트 진입 경로 확인 | Spring Boot 08단계 완료 및 다음 트랜잭션 단계 연결 |
| Spring Boot 최근 노트 | DTO·Validation·데이터 접근 예제의 앞뒤 계약과 공식 API 대조 | SQL·Entity·오류 응답 보정 |
| Python 유지보수 코드 4개 | 동일 함수 비교, 임시 파일 기반 회귀 테스트 | 파일명 예약 충돌과 루트 재수집 문제 수정 |
| JSON 예시 | JSON으로 표시한 블록 후보를 파싱해 수동 분류 | REST JSON 주석 제거; AI 프롬프트 내부의 자리표시자 예시는 전송용 JSON과 구분 |

시작 시 Markdown 213개와 검사 대상 로컬 링크 1,048개를 확인했다. 최종 검사에서는 새 강의와 이 점검 기록을 포함해 Markdown 215개·로컬 링크 1,059개를 검사했고, 이슈 0건을 확인했다. `docs`, `scripts`, `study_summarize_prompt`와 README는 학습 노트 집계 대상이 아니다.

## 2. 수정한 내용

### 2.1 이미지 정리 스크립트의 경로 예약 충돌

대상: DB·Django·Javascript·Vue의 `reconfigure.py`.

기존 `choose_final_dest()`는 아직 디스크에 생성되지 않았지만 이동 계획에 예약된 경로를 만나면 `make_unique_path()`를 반복 호출했다. 그러나 이 함수는 파일이 실제로 존재하지 않으면 같은 경로를 돌려주었으므로 반복이 끝나지 않을 수 있었다.

수정 후에는 고유 이름을 선택할 때 **디스크의 기존 파일과 메모리의 예약 경로를 함께 검사**한다. 원본과 목적지가 이미 같으면 그대로 반환한다. 목적지 파일을 무조건 덮어쓰는 방식으로 해결하지 않았다.

또한 과목 루트에 README가 있으면 루트가 별도 강의 후보가 되는데, 기존 재귀 수집은 하위 강의와 이미 정리된 `assets/images`까지 다시 처리할 수 있었다. 루트 작업은 루트 문서·루트 이미지로 한정하고 이미지 저장소 내부 파일은 이동 계획에서 제외했다.

실제 저장소 이미지에 정리 도구를 실행하지 않았다. 강의 이미지·백업·원본 첨부 파일을 삭제하거나 이동한 변경은 없다.

### 2.2 Spring Boot 데이터 접근 예제 연결

[데이터 접근 기초 노트](../SpringBoot/07_09_03_Data_Access_Fundamentals/09_03_Data_Access_Fundamentals.md)를 수정했다.

- ID를 생략하는 INSERT와 맞도록 MySQL DDL에 `AUTO_INCREMENT`를 추가했다.
- 최소 Entity에 `isbn`을 포함해 `findByIsbn`·`existsByIsbn`의 Java 속성과 일치시켰다.
- 확장 Entity에 생성 시각 매핑·`@PrePersist`·getter를 추가했다.
- `BookResponse.from(entity)` 구현을 제공해 Service 예제의 호출 대상을 연결했다.
- JDBC 모델과 JPA 모델, 서로 대체하는 Service 예제, 별도로 필요한 설정·import를 명시했다.

### 2.3 Spring MVC 오류 응답의 의미 보존

[Validation과 예외 처리 노트](../SpringBoot/05_09_01_Validation_and_Exception_Handling/09_01_Validation_and_Exception_Handling.md)를 수정했다.

- `BindingResult`의 내부 오류 객체를 그대로 직렬화하지 않고 공개 가능한 오류 응답으로 바꿨다.
- 메서드 **입력값** 검증 실패의 400과 **반환값** 검증 실패의 500을 구분했다.
- 일반 `Exception` Handler가 405·415를 500으로 덮지 않도록 부모 MVC Handler와 통합하는 전제를 설명했다.
- `ResponseEntityExceptionHandler` 상속 방식과 단순 Advice 예제를 중복 복사하지 않도록 주의를 추가했다.
- 국제화 파일 작성 외에도 `MessageSource`를 통해 `FieldError` 메시지를 해석해야 함을 코드로 연결했다.

[REST API와 DTO 노트](../SpringBoot/04_08_29_REST_API_and_DTO/08_29_REST_API_and_DTO.md)의 요청·응답 구분 주석은 JSON 코드 밖으로 옮겼다.

## 3. 새 학습 내용 선정

새 노트: [JPA Entity 생명주기와 연관관계](../SpringBoot/08_09_05_Entity_Lifecycle_and_Relationships/09_05_Entity_Lifecycle_and_Relationships.md).

기존 로드맵의 다음 단계이며, 직전 노트에서 미룬 영속성 컨텍스트·변경 감지·연관관계의 주인을 연결할 수 있어 선정했다. 새로운 기술을 병렬로 늘리기보다 이미 시작한 Spring Boot 데이터 접근 흐름을 완성하는 방향이다.

책·저자 모델을 통해 다음을 다룬다.

1. Entity 상태, 동일성, `persist`·`merge`·`save` 구분
2. 변경 감지, flush와 commit, Service 트랜잭션 전제
3. 외래키와 `mappedBy`, 양방향 관계 편의 메서드
4. LAZY·cascade·orphanRemoval·N+1의 서로 다른 책임
5. fetch join, DTO 변환, flush·clear·재조회 테스트와 미니 퀴즈

본문의 관련 설명 가까이에 Jakarta Persistence·Hibernate·Spring 공식 문서 링크를 배치했다.

## 4. 재현 가능한 검증

Python 3.10 이상, Git이 PATH에 있는 환경에서 저장소 루트에서 실행한다.

```powershell
python scripts/check_notes.py
python -B -m unittest discover -s scripts -p 'test_*.py' -v
git diff --check
```

[문서 검사기](../scripts/check_notes.py)는 읽기 전용이다. 검사 결과를 JSON으로 출력하고 누락 경로·닫히지 않은 fence·README 집계 불일치가 있으면 종료 코드 1을 반환한다. 정상일 때는 0이다.

[회귀 테스트](../scripts/test_note_tools.py)는 10개 테스트 메서드로 구성되며, 이미지 계획 테스트 5개는 스크립트 4개 각각에 적용한다. 예약만 된 파일명, 기존 파일 충돌, 원본=목적지, 루트 README 재수집, 재실행 계획 및 Markdown 검사 동작을 임시 디렉터리에서 확인했다. 모두 통과했다.

## 5. 남아 있는 한계와 다음 보강 순서

- 문서 검사기는 완전한 CommonMark 렌더러가 아니다. 지원하는 inline·참조 정의·HTML 링크의 경로 존재를 확인하며, 앵커의 정확성·모든 확장 문법·대소문자 호환성을 보장하지 않는다.
- 외부 링크 전체의 상태, 이미지 내용, 압축 자료·Notebook 내부 코드는 전수 검사하지 않았다.
- Spring 예제는 공식 문서와 코드 계약을 대조했지만 실행 프로젝트·실제 DB에서 컴파일·통합 테스트하지 않았다. 노트의 테스트 코드는 독자가 실행할 예제이며, 이번에 실행한 Python 회귀 테스트와 다르다.
- 과거 강의는 학습 당시 버전과 의도적으로 실패하는 코드가 섞일 수 있다. 버전이 오래되었다는 이유만으로 일괄 최신 API로 치환하지 않았다.
- 이미지 정리 스크립트는 여전히 파일을 이동하는 도구다. 이번 충돌·재수집 수정이 모든 입력 경로나 장애 상황의 안전성을 보장하지 않는다. 실제 사용 전 Git 상태와 별도 백업을 확인하고 과목 폴더를 명시한다.

후속 학습 우선순위는 Spring 트랜잭션 → Service·Repository 통합 테스트 → Java Entity 동등성과 `equals`·`hashCode`다. 장기적으로는 기술별 최소 실행 프로젝트와 버전별 검증 명령을 따로 갖추면 문서 예제의 재현성을 높일 수 있다.
