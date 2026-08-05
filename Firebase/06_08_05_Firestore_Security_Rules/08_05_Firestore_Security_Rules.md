# 처음부터 안전하게 작성하는 Firestore Security Rules

- 🎯 글의 목표: 로그인 사용자와 문서 소유자를 확인하고, 생성·조회·수정·삭제마다 허용할 필드와 값의 범위를 제한한다.
- 🧩 핵심 키워드: `request.auth`, `resource.data`, `request.resource.data`, `diff`, query rules
- ⭐ 중요도: ★★★★★ — 클라이언트 검증과 화면 숨김만으로는 직접 API 요청을 막을 수 없다.
- 📝 한눈에 보는 내용: Rules는 각 요청을 서버에서 허용하거나 거부한다. 기존 문서와 쓰기 후 문서를 구분하고, 기본 거부 상태에서 필요한 작업만 허용한다. query도 허용 가능한 문서만 반환하도록 조건을 맞춰야 한다.
- 🔗 관련 주제: Firebase Authentication, Firestore query, Emulator 테스트
- 🧱 선수 지식: Firestore 문서·컬렉션, CRUD, Firebase uid

---

## 1. Rules가 필요한 이유

React에서 수정 버튼을 숨겨도 사용자는 Firebase SDK나 REST 요청을 직접 만들 수 있다. Rules는 클라이언트 코드와 별개로 Firebase 서버에서 평가되는 접근 제어 계층이다.

```text
클라이언트 요청
   ↓
경로와 작업 종류 확인
   ↓
인증 사용자·기존 데이터·새 데이터 검사
   ↓
조건 true  → 요청 실행
조건 false → permission-denied
```

Rules에 명시적인 허용 조건이 없으면 요청은 거부된다. 필요한 경로와 작업만 좁게 허용하는 방식으로 작성한다.

## 2. Rules에서 자주 쓰는 값

| 값 | 의미 | 대표 사용 시점 |
| --- | --- | --- |
| `request.auth` | 현재 인증 정보, 미로그인은 `null` | 모든 사용자 권한 검사 |
| `request.auth.uid` | 현재 사용자의 Firebase uid | 문서 소유자 비교 |
| `resource.data` | 데이터베이스에 이미 저장된 문서 | 조회·수정·삭제 |
| `request.resource.data` | 쓰기가 성공했을 때의 전체 문서 | 생성·수정 검증 |
| `request.time` | 서버가 요청을 받은 시각 | 시간 제한·서버 timestamp 검증 |

수정 요청이 일부 필드만 보냈더라도 `request.resource.data`에는 수정 후 전체 문서가 들어 있다. 실제로 바뀐 필드는 `diff(resource.data).affectedKeys()`로 구한다.

## 3. 사용자별 학습 메모 Rules

아래 데이터 구조를 기준으로 한다.

```text
studyNotes/{noteId}
├─ ownerId: Firebase uid
├─ topic: string
├─ summary: string
└─ createdAt: timestamp
```

```text
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function ownsExistingNote() {
      // 조회·수정·삭제에서는 이미 저장된 ownerId를 현재 uid와 비교한다.
      return signedIn() && resource.data.ownerId == request.auth.uid;
    }

    function hasValidCreateFields() {
      // 허용 목록에 없는 필드가 하나라도 들어오면 생성을 거부한다.
      return request.resource.data.keys().hasOnly([
          'ownerId', 'topic', 'summary', 'createdAt'
        ])
        && request.resource.data.keys().hasAll([
          'ownerId', 'topic', 'summary', 'createdAt'
        ])
        && request.resource.data.ownerId == request.auth.uid
        && request.resource.data.topic is string
        && request.resource.data.topic.size() >= 2
        && request.resource.data.topic.size() <= 100
        && request.resource.data.summary is string
        && request.resource.data.summary.size() >= 5
        && request.resource.data.summary.size() <= 2000
        // serverTimestamp()로 기록한 서버 시각만 허용한다.
        // 클라이언트가 과거나 미래의 임의 시각을 넣는 것을 막는다.
        && request.resource.data.createdAt == request.time;
    }

    match /studyNotes/{noteId} {
      // 목록과 상세 조회 모두 문서 소유자에게만 허용한다.
      allow read: if ownsExistingNote();

      // 생성에는 기존 resource가 없으므로 새 문서의 ownerId를 검사한다.
      allow create: if signedIn() && hasValidCreateFields();

      allow update: if ownsExistingNote()
        // ownerId와 createdAt을 바꾸지 못하고 두 내용 필드만 수정한다.
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['topic', 'summary'])
        && request.resource.data.topic is string
        && request.resource.data.topic.size() >= 2
        && request.resource.data.topic.size() <= 100
        && request.resource.data.summary is string
        && request.resource.data.summary.size() >= 5
        && request.resource.data.summary.size() <= 2000;

      allow delete: if ownsExistingNote();
    }
  }
}
```

`ownerId`를 클라이언트가 보내더라도 Rules가 현재 token의 uid와 같은지 다시 확인한다. 다른 사용자의 uid를 적어 소유권을 가장하는 요청은 거부된다.

## 4. 클라이언트 쓰기도 Rules 계약과 맞춘다

```ts
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, firestore } from '../lib/firebase'

export async function createMyStudyNote(
  topic: string,
  summary: string,
): Promise<string> {
  // 현재 사용자가 없으면 Rules 요청 전부터 화면에 명확한 오류를 제공한다.
  const user = auth.currentUser
  if (!user) throw new Error('로그인이 필요합니다.')

  const reference = await addDoc(collection(firestore, 'studyNotes'), {
    // Rules는 이 값과 request.auth.uid가 같은지 검사한다.
    ownerId: user.uid,
    topic: topic.trim(),
    summary: summary.trim(),
    createdAt: serverTimestamp(),
  })

  return reference.id
}
```

클라이언트 검증은 빠른 피드백을 제공하고 Rules는 우회 요청을 차단한다. 둘 중 하나를 다른 하나의 대체물로 보지 않는다.

## 5. Rules는 query 결과 필터가 아니다

소유자만 읽도록 Rules를 작성한 뒤 전체 컬렉션을 요청하면 Firebase가 결과에서 남의 문서만 제거해 주지 않는다. query가 애초에 현재 사용자의 문서만 요청해야 한다.

```ts
import { collection, query, where } from 'firebase/firestore'
import { auth, firestore } from '../lib/firebase'

export function getMyNotesQuery() {
  const user = auth.currentUser
  if (!user) throw new Error('로그인이 필요합니다.')

  return query(
    collection(firestore, 'studyNotes'),
    // query 제약이 Rules의 ownerId 조건과 일치해야 한다.
    where('ownerId', '==', user.uid),
  )
}
```

Rules는 query가 반환할 **가능성이 있는 전체 결과**를 기준으로 허용 여부를 판단한다. 필요한 `where`, `orderBy`, index를 데이터 모델과 함께 설계한다.

## 6. 작업별로 분리하는 이유

`allow read, write: if signedIn()`처럼 한 조건으로 묶으면 로그인한 모든 사용자가 서로의 문서를 수정할 수 있다. 생성에는 새 데이터, 수정에는 기존 데이터와 새 데이터, 삭제에는 기존 소유자를 각각 검사해야 한다.

| 작업 | 핵심 검사 |
| --- | --- |
| create | 새 ownerId, 필수 필드, 타입과 범위 |
| read | 기존 문서의 ownerId와 현재 uid |
| update | 기존 소유자, 변경 가능 필드, 수정 후 값 |
| delete | 기존 문서의 ownerId와 현재 uid |

## 7. 중요한 경계

- Admin SDK와 서버 클라이언트는 Firestore Security Rules를 우회하며 IAM 권한을 사용한다.
- Rules는 비즈니스 로직 전체를 실행하는 서버 코드가 아니라 접근 허용 조건이다.
- 없는 필드를 바로 읽으면 규칙 평가 오류로 요청이 거부될 수 있으므로 필수 필드를 명확히 한다.
- `get()`과 `exists()`로 다른 문서를 읽는 Rules에는 호출 제한과 추가 읽기 비용이 있다.
- Console에서 임시 공개 규칙을 설정했다면 만료와 배포 상태를 확인한다.

## 8. 적용 관점에서 다시 보기

먼저 컬렉션별 소유자와 허용 작업 표를 적는다. 기본 거부에서 시작해 create, read, update, delete를 나누고 필드 목록·타입·길이를 제한한다. 마지막으로 허용과 거부 사례를 Emulator에서 자동 테스트한다.

`permission-denied`가 발생하면 로그인 token, 문서 경로, 기존 ownerId, 새 데이터의 필수 필드, query 조건을 순서대로 확인한다.

## 9. 요약 정리

- Rules는 Firebase 서버에서 요청을 허용하거나 거부한다.
- `resource.data`는 기존 문서, `request.resource.data`는 쓰기 후 문서다.
- 생성·조회·수정·삭제를 각기 다른 조건으로 검사한다.
- 새 문서의 ownerId와 `request.auth.uid`가 같은지 확인한다.
- update에는 `diff().affectedKeys().hasOnly()`로 변경 필드를 제한할 수 있다.
- Rules는 query 결과를 사후 필터링하지 않는다.
- 클라이언트 검증과 Rules 검증은 모두 필요하다.
- Admin SDK는 Rules를 우회하므로 서버 IAM을 별도로 관리한다.

🧠 기억할 것: 화면에서 허용한 행동이 아니라, 공격자가 직접 만들 수 있는 요청을 기준으로 Rules를 설계한다.

## 10. 미니 퀴즈

1. `resource.data`와 `request.resource.data`의 차이는 무엇인가?
2. update에서 변경한 필드만 확인하는 표현은 무엇인가?
3. 소유자 Rules가 있는데 전체 컬렉션 query가 거부될 수 있는 이유는 무엇인가?
4. Admin SDK 요청에 Firestore Rules가 적용되는가?

<details>
<summary>정답과 해설</summary>

1. 전자는 현재 저장된 문서, 후자는 요청이 성공했을 때 만들어질 전체 문서다.
2. `request.resource.data.diff(resource.data).affectedKeys()`를 사용한다.
3. Rules는 결과를 필터링하지 않고 query가 반환할 수 있는 전체 범위를 평가하기 때문이다.
4. 적용되지 않는다. Admin SDK는 IAM 자격 증명으로 Rules를 우회한다.

</details>

## 참고 자료

- [Firestore Rules 조건 작성](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [수정 가능 필드 제한](https://firebase.google.com/docs/firestore/security/rules-fields)
- [Rules에 맞는 query 작성](https://firebase.google.com/docs/firestore/security/rules-query)
