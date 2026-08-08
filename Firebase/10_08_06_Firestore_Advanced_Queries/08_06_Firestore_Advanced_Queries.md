# TypeScript로 배우는 Firestore 고급 조회와 페이지네이션

- 🎯 글의 목표: Firestore에서 필요한 문서만 안정적인 순서로 조회하고, 복합 인덱스와 커서를 이용해 데이터를 여러 페이지로 나눈다.
- 🧩 핵심 키워드: `where`, `orderBy`, `limit`, composite index, query cursor, `startAfter`
- ⭐ 중요도: ★★★★★ — 조회 조건은 화면 정확성뿐 아니라 Security Rules, 응답 속도, 읽기 비용에 직접 영향을 준다.
- 📝 한눈에 보는 내용: Firestore query는 조건에 맞는 인덱스를 읽어 결과를 만든다. 필터와 정렬을 함께 사용하면 복합 인덱스가 필요할 수 있으며, 많은 결과는 `limit`과 마지막 문서 snapshot을 이용한 커서 방식으로 나누어 읽는다.
- 🔗 관련 주제: Cloud Firestore, Security Rules, React 비동기 상태, 무한 스크롤
- 🧱 선수 지식: Firestore 컬렉션·문서, `getDocs`, Promise, TypeScript 객체 타입

---

## 1. 왜 전체 문서를 한 번에 읽으면 안 될까?

학습 메모가 10개일 때는 컬렉션 전체를 읽어도 큰 차이를 느끼기 어렵다. 하지만 문서가 수천 개로 늘어나면 사용자가 아직 보지도 않을 데이터까지 내려받게 된다. 첫 화면이 느려지고, 메모리 사용량과 Firestore 읽기 비용도 함께 늘어난다.

좋은 조회는 데이터가 많아진 뒤에 붙이는 장식이 아니다. 어떤 필드로 필터링하고 어떤 순서로 보여 줄지를 데이터 구조와 함께 설계하는 작업이다.

```text
화면이 요구하는 데이터 범위 결정
              ↓
where로 필요한 문서만 제한
              ↓
orderBy로 결과 순서 고정
              ↓
필요한 복합 인덱스 준비
              ↓
limit으로 한 번에 읽을 개수 제한
              ↓
마지막 문서 snapshot을 다음 커서로 저장
```

## 2. 조회에 사용할 데이터 구조

이 문서에서는 사용자별 학습 메모를 최신순으로 보여 주고, 학습 상태로 필터링한다고 가정한다.

```text
studyNotes/{noteId}
├─ ownerId: string
├─ topic: string
├─ summary: string
├─ status: "learning" | "reviewing" | "done"
└─ createdAt: timestamp
```

`status`는 기존 학습 메모 구조를 확장한 필드다. 실제 프로젝트에 추가한다면 클라이언트 타입만 바꾸지 말고 생성 코드와 Firestore Security Rules의 허용 필드·타입 검사도 함께 수정해야 한다.

```ts
import type { Timestamp } from 'firebase/firestore'

// 화면과 query가 공통으로 사용하는 학습 상태의 범위를 제한한다.
export type StudyNoteStatus = 'learning' | 'reviewing' | 'done'

export type StudyNote = {
  id: string
  ownerId: string
  topic: string
  summary: string
  status: StudyNoteStatus
  createdAt: Timestamp
}
```

TypeScript 타입은 개발 중 잘못된 속성 사용을 줄여 주지만, 데이터베이스에 저장된 값까지 자동으로 검사하지 않는다. 오래된 문서나 다른 클라이언트가 잘못 저장한 값은 런타임에 별도로 확인해야 한다.

기존 Rules에 `status`를 추가한다면 허용 필드 목록과 필수 필드 목록에 이름을 넣고 값의 범위도 검사한다. 아래 함수는 생성과 수정 조건에서 공통으로 호출할 수 있는 일부 코드다.

```text
// firestore.rules의 service 블록 안에 추가하는 함수다.
function hasValidStatus() {
  // 문자열이라는 사실뿐 아니라 허용한 세 값 중 하나인지 확인한다.
  return request.resource.data.status is string
    && request.resource.data.status in ['learning', 'reviewing', 'done'];
}

// create의 keys().hasOnly()와 keys().hasAll() 목록에도 'status'를 추가한다.
// create와 update 허용 조건에서 hasValidStatus()를 호출한다.
```

화면의 선택지를 제한해도 직접 요청으로 다른 문자열을 보낼 수 있다. 따라서 TypeScript union, 폼 선택지, Security Rules가 같은 상태 목록을 사용하도록 관리한다.

## 3. 필터와 정렬을 함께 생각하기

### 3.1 `where`는 결과의 범위를 줄인다

`where`는 필드 값이 조건에 맞는 문서만 요청한다. 예를 들어 로그인 사용자의 복습 중인 메모만 가져오려면 두 개의 동등 조건을 사용한다.

```ts
import { collection, query, where } from 'firebase/firestore'
import { firestore } from '../lib/firebase'
import type { StudyNoteStatus } from './types'

export function createFilteredNotesQuery(
  ownerId: string,
  status: StudyNoteStatus,
) {
  return query(
    collection(firestore, 'studyNotes'),
    // 다른 사용자의 문서를 요청 범위에서 제외한다.
    where('ownerId', '==', ownerId),
    // 화면에서 선택한 학습 상태만 요청한다.
    where('status', '==', status),
  )
}
```

클라이언트 query에 `ownerId` 조건을 넣었다고 권한 검사가 끝나는 것은 아니다. 공격자는 클라이언트 코드를 거치지 않고 요청을 만들 수 있으므로 Security Rules에서도 `request.auth.uid`와 문서의 `ownerId`를 비교해야 한다.

### 3.2 `orderBy`는 결과 순서를 고정한다

Firestore가 우연히 돌려준 순서를 화면 순서로 사용하면 새 문서가 추가되거나 query가 바뀔 때 결과를 예측하기 어렵다. 최신순 화면이라면 정렬 기준을 명시한다.

```ts
import {
  collection,
  documentId,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { firestore } from '../lib/firebase'

export function createRecentNotesQuery(ownerId: string) {
  return query(
    collection(firestore, 'studyNotes'),
    where('ownerId', '==', ownerId),
    // 생성 시각이 큰 문서, 즉 최근 문서를 먼저 배치한다.
    orderBy('createdAt', 'desc'),
    // createdAt이 같은 문서 사이에서도 순서가 결정되도록 보조 기준을 둔다.
    orderBy(documentId(), 'desc'),
  )
}
```

`orderBy('createdAt')`를 사용하면 해당 필드가 없는 문서는 결과에 포함되지 않는다. 정렬에 사용할 필드는 모든 대상 문서에 일관되게 저장하는 것이 좋다.

문서 ID 보조 정렬은 같은 timestamp를 가진 문서가 여러 개일 때도 전체 순서를 고정한다. 커서는 정렬 순서를 기준으로 다음 시작 위치를 결정하므로, 안정적인 정렬은 페이지네이션의 전제 조건이다.

## 4. 복합 인덱스는 무엇인가?

Firestore의 조회는 컬렉션을 처음부터 끝까지 훑어 조건을 검사하는 방식이 아니라, 미리 정렬해 둔 index를 이용한다. 하나의 필드에 대한 기본 index는 자동으로 만들어지지만 여러 필터와 정렬을 조합한 query에는 복합 인덱스가 필요할 수 있다.

예를 들어 다음 query는 `ownerId`, `status`, `createdAt`, 문서 ID를 함께 사용한다.

```ts
const notesQuery = query(
  collection(firestore, 'studyNotes'),
  where('ownerId', '==', ownerId),
  where('status', '==', 'reviewing'),
  orderBy('createdAt', 'desc'),
  orderBy(documentId(), 'desc'),
)
```

필요한 인덱스가 없다면 Firestore는 query를 느리게 실행하는 대신 오류를 반환한다. 오류 메시지에 포함된 링크로 Firebase Console의 인덱스 생성 화면을 열 수 있다. 인덱스 생성이 끝날 때까지는 같은 query가 계속 실패할 수 있다.

팀에서 같은 구성을 재현하려면 Console에서만 생성하고 끝내지 말고 `firestore.indexes.json`을 저장소에서 관리한다.

```json
{
  "indexes": [
    {
      "collectionGroup": "studyNotes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Firestore index는 마지막 정렬 필드와 같은 방향으로 문서 경로인 `__name__` 정렬을 기본 적용한다. 위 설정에서는 `createdAt`이 내림차순이므로 문서 경로도 내림차순으로 정렬되며, 코드의 `orderBy(documentId(), 'desc')`와 방향이 맞는다.

```bash
# Firebase 프로젝트 루트에서 Firestore index 설정을 배포한다.
npx firebase-tools deploy --only firestore:indexes
```

인덱스는 query를 가능하게 하지만 저장 공간과 쓰기 작업에도 영향을 준다. 실제로 조회하지 않는 모든 조합을 미리 만들기보다 화면에 필요한 query부터 정하고 필요한 인덱스만 관리한다.

## 5. 커서 기반 페이지네이션

페이지네이션은 많은 결과를 작은 묶음으로 나누어 읽는 방식이다. Firestore에서는 앞에서 몇 개를 건너뛰는 `offset`보다 마지막으로 읽은 위치를 기억하는 query cursor를 우선 사용한다.

### 5.1 첫 페이지 읽기

먼저 한 페이지의 크기와 반환 타입을 정의한다. 커서에는 마지막 문서의 전체 snapshot을 보관한다.

```ts
import type {
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore'

export const NOTES_PAGE_SIZE = 10

export type NotesPage = {
  items: StudyNote[]
  // 다음 query의 startAfter에 전달할 마지막 문서다.
  cursor: QueryDocumentSnapshot<DocumentData> | null
  // 현재 페이지가 꽉 찼다면 다음 데이터가 있을 가능성이 있다.
  hasMore: boolean
}
```

다음 함수는 첫 페이지와 이후 페이지를 모두 읽는다. `after`가 없으면 처음부터, 있으면 해당 문서 다음부터 시작한다.

```ts
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '../lib/firebase'
import {
  NOTES_PAGE_SIZE,
  type NotesPage,
  type StudyNote,
  type StudyNoteStatus,
} from './types'

// Firestore의 외부 데이터를 화면 타입으로 바꾸면서 최소한의 형식을 검사한다.
function toStudyNote(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): StudyNote {
  const data = snapshot.data()

  const validStatus =
    data.status === 'learning'
    || data.status === 'reviewing'
    || data.status === 'done'

  if (
    typeof data.ownerId !== 'string'
    || typeof data.topic !== 'string'
    || typeof data.summary !== 'string'
    || !validStatus
    || !(data.createdAt instanceof Timestamp)
  ) {
    // 잘못된 문서를 조용히 표시하지 않고 데이터 문제를 알린다.
    throw new Error(`학습 메모 ${snapshot.id}의 데이터 형식이 올바르지 않습니다.`)
  }

  return {
    id: snapshot.id,
    ownerId: data.ownerId,
    topic: data.topic,
    summary: data.summary,
    status: data.status as StudyNoteStatus,
    createdAt: data.createdAt,
  }
}

export async function getNotesPage(
  ownerId: string,
  status: StudyNoteStatus,
  after: QueryDocumentSnapshot<DocumentData> | null,
): Promise<NotesPage> {
  const notesRef = collection(firestore, 'studyNotes')

  // 첫 페이지와 다음 페이지의 필터·정렬·limit은 같아야 한다.
  // 다음 페이지에만 startAfter 커서가 추가된다.
  const notesQuery = after
    ? query(
        notesRef,
        where('ownerId', '==', ownerId),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
        startAfter(after),
        limit(NOTES_PAGE_SIZE),
      )
    : query(
        notesRef,
        where('ownerId', '==', ownerId),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
        limit(NOTES_PAGE_SIZE),
      )

  const snapshot = await getDocs(notesQuery)
  const lastDocument = snapshot.docs.at(-1) ?? null

  return {
    items: snapshot.docs.map(toStudyNote),
    cursor: lastDocument,
    // 정확한 다음 페이지 존재 여부는 다음 요청 전에는 알 수 없다.
    // 페이지가 덜 찼다면 더 이상 문서가 없다는 것은 확실하다.
    hasMore: snapshot.size === NOTES_PAGE_SIZE,
  }
}
```

`startAt`은 커서 문서를 다음 결과에 다시 포함하고, `startAfter`는 제외한다. “더 보기”에서는 이미 표시한 마지막 문서를 중복하지 않도록 `startAfter`가 자연스럽다.

`hasMore`가 `true`여도 문서 수가 정확히 페이지 크기의 배수라면 다음 요청이 빈 결과일 수 있다. 한 문서를 미리 더 읽어 확인할 수도 있지만 그 문서 읽기에도 비용이 들고 다음 페이지에서 다시 읽을 수 있다. 여기서는 빈 다음 페이지를 정상적으로 처리하는 단순한 방식을 선택했다.

### 5.2 페이지가 바뀌어도 query 조건은 유지한다

첫 페이지는 최신순인데 다음 페이지에서 정렬 방향이나 필터가 달라지면 커서의 의미가 사라진다. 아래 값들은 첫 페이지와 다음 페이지에서 모두 같아야 한다.

- 컬렉션 경로
- 모든 `where` 조건
- 모든 `orderBy` 필드와 방향
- 사용자에게 적용된 검색 조건
- 한 페이지의 크기

필터가 바뀌면 기존 목록과 커서를 비우고 새로운 첫 페이지부터 읽어야 한다.

## 6. React에서 “더 보기” 상태 관리하기

페이지네이션 UI는 문서 목록 외에도 커서, 다음 페이지 가능 여부, 요청 진행 여부를 기억해야 한다. 동시에 여러 번 요청하지 않도록 버튼을 비활성화한다.

```tsx
import type {
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { getNotesPage } from './notesService'
import type { StudyNote, StudyNoteStatus } from './types'

type PaginatedNotesProps = {
  ownerId: string
  status: StudyNoteStatus
}

export function PaginatedNotes({ ownerId, status }: PaginatedNotesProps) {
  const [notes, setNotes] = useState<StudyNote[]>([])
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadFirstPage() {
      // 사용자나 필터가 바뀌면 이전 query의 결과와 커서를 초기화한다.
      setNotes([])
      setCursor(null)
      setHasMore(true)
      setIsLoading(true)
      setError('')

      try {
        const page = await getNotesPage(ownerId, status, null)

        // Effect가 정리된 뒤 끝난 이전 요청은 현재 화면을 덮어쓰지 않는다.
        if (ignore) return
        setNotes(page.items)
        setCursor(page.cursor)
        setHasMore(page.hasMore)
      } catch (caught) {
        if (ignore) return
        setError(caught instanceof Error ? caught.message : '메모를 불러오지 못했습니다.')
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void loadFirstPage()

    return () => {
      ignore = true
    }
  }, [ownerId, status])

  async function loadMore() {
    // 진행 중인 중복 클릭과 마지막 페이지 이후 요청을 막는다.
    if (isLoading || !hasMore || !cursor) return

    setIsLoading(true)
    setError('')

    try {
      const page = await getNotesPage(ownerId, status, cursor)

      // 기존 목록 뒤에 다음 페이지를 이어 붙인다.
      setNotes(current => [...current, ...page.items])
      setCursor(page.cursor)
      setHasMore(page.hasMore)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '다음 메모를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section aria-labelledby="notes-heading">
      <h2 id="notes-heading">학습 메모</h2>

      {notes.length === 0 && !isLoading && !error && (
        <p>조건에 맞는 학습 메모가 없습니다.</p>
      )}

      <ul>
        {notes.map(note => (
          <li key={note.id}>
            <strong>{note.topic}</strong>
            <p>{note.summary}</p>
          </li>
        ))}
      </ul>

      {error && <p role="alert">{error}</p>}

      {hasMore && (
        <button type="button" onClick={loadMore} disabled={isLoading || !cursor}>
          {isLoading ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </section>
  )
}
```

이 예제의 `ignore` 변수는 이미 끝난 Effect의 첫 페이지 요청이 나중에 도착해 현재 필터 결과를 덮어쓰는 문제를 막는다. “더 보기” 요청까지 취소하거나 빠른 필터 전환을 더 엄격히 처리해야 한다면 요청 세대 번호나 데이터 패칭 라이브러리를 검토할 수 있다.

## 7. 페이지 번호보다 커서가 자연스러운 이유

SQL의 `OFFSET 20`과 비슷하게 앞의 문서를 건너뛰는 방식은 “3페이지로 바로 이동”을 표현하기 쉽다. 그러나 Firestore의 offset은 건너뛴 문서도 읽기 비용에 포함된다. 뒤 페이지로 갈수록 불필요한 읽기가 증가한다.

커서는 마지막 위치 다음에서 조회를 재개하므로 “다음 페이지”와 “더 보기”에 잘 맞는다. 반면 임의의 20페이지로 즉시 이동하려면 각 페이지의 커서를 따로 저장하거나 다른 데이터 구조가 필요하다.

| 방식 | 장점 | 주의점 |
| --- | --- | --- |
| 커서 | 건너뛴 문서를 다시 읽지 않고 다음 위치부터 조회 | 이전 커서가 있어야 다음 페이지를 만들기 쉽다 |
| offset | 페이지 번호 계산이 직관적 | 건너뛴 문서도 읽기 비용이 발생한다 |

## 8. 실시간 구독과 페이지네이션 구분하기

`onSnapshot`은 결과 변경을 즉시 화면에 반영해야 할 때 유용하다. 하지만 사용자가 보지 않는 여러 페이지까지 listener로 유지하면 상태 병합이 복잡해지고 읽기 범위도 커진다.

- 현재 화면의 작은 목록이 계속 바뀌어야 한다면 실시간 구독을 검토한다.
- 오래된 기록을 차례로 탐색한다면 `getDocs`와 커서 페이지네이션이 단순하다.
- 첫 페이지만 실시간으로 유지하고 다음 페이지는 한 번씩 읽는 혼합 방식은 중복·순서 변경 규칙을 먼저 정해야 한다.

listener는 결과에 문서가 추가되거나 갱신될 때도 읽기 비용이 발생할 수 있다. “실시간이면 더 최신이다”만 보고 선택하지 말고 화면의 실제 요구와 구독 범위를 먼저 확인한다.

## 9. 자주 발생하는 문제와 확인 순서

### 9.1 인덱스 오류가 발생한다

오류 메시지의 인덱스 생성 링크를 확인한다. query의 `where`, `orderBy`, 정렬 방향이 의도한 것과 같은지 먼저 검토한 뒤 필요한 인덱스를 생성한다. 생성 상태가 준비 완료가 되기 전에는 query가 실패할 수 있다.

### 9.2 다음 페이지에 문서가 중복된다

`startAt` 대신 `startAfter`를 사용했는지 확인한다. 다음 query에 전달한 snapshot이 현재 화면의 마지막 문서인지, 첫 페이지와 다음 페이지의 정렬 조건이 완전히 같은지도 점검한다.

### 9.3 일부 문서가 조회되지 않는다

`orderBy` 필드가 빠진 문서는 결과에서 제외될 수 있다. 기존 문서에 `createdAt`이나 `status`가 모두 존재하는지 확인하고, 데이터 마이그레이션과 Rules 변경이 필요한지 검토한다.

### 9.4 query가 `permission-denied`로 실패한다

Rules는 결과를 받은 다음 금지된 문서를 제거하는 필터가 아니다. query의 `ownerId` 조건이 Rules가 허용하는 소유자 범위와 맞는지 확인한다. 필요하면 Emulator에서 같은 인증 사용자와 query 조건으로 허용·거부 테스트를 작성한다.

### 9.5 필터를 바꿨는데 이전 결과가 섞인다

필터가 바뀔 때 목록, cursor, `hasMore`, 오류 상태를 함께 초기화했는지 확인한다. 이전 비동기 응답이 새 결과를 덮어쓰지 않도록 Effect cleanup 또는 요청 식별값도 필요하다.

## 10. 적용 관점에서 다시 보기

새 목록 화면을 만들 때 먼저 “누구의 어떤 문서를 어떤 순서로 몇 개 보여 줄 것인가?”를 한 문장으로 적는다. 그 문장을 `where`, `orderBy`, `limit`으로 옮기고 Rules 조건과 비교한다. query를 실행해 필요한 복합 인덱스를 확인한 뒤 마지막 snapshot을 커서로 보관한다.

문제가 생기면 다음 순서로 확인한다.

1. 문서에 필터·정렬 필드가 실제로 존재하는가?
2. query의 조건과 순서가 화면 요구와 같은가?
3. 필요한 복합 인덱스가 준비 완료 상태인가?
4. query 범위가 Security Rules의 허용 범위와 같은가?
5. 필터 변경 시 이전 cursor와 목록을 초기화했는가?
6. 같은 페이지를 동시에 두 번 요청하지 않았는가?

## 11. 배운 점과 확장 방향

### 11.1 새로 이해한 것

페이지네이션은 단순히 배열을 잘라 보여 주는 작업이 아니다. 서버 query의 정렬 순서, 마지막 snapshot, 화면의 비동기 상태를 하나의 계약으로 유지하는 과정이다.

### 11.2 이전·다음 학습과의 연결

이 문서의 query는 앞서 작성한 Firestore 소유자 Rules 및 Emulator 테스트와 연결된다. 다음에는 Firebase 사용자 계정 관리, App Check, React 오류 처리, CI 자동 검사를 순서대로 확장할 수 있다.

### 11.3 더 확인할 주제

- `count`, `sum`, `average` 집계 query
- collection group query
- Query Explain을 이용한 서버 query 성능 분석
- 검색 전문 서비스가 필요한 경우와 Firestore query의 경계

## 12. 요약 정리

- `where`는 필요한 문서 범위를 줄이고 `orderBy`는 결과 순서를 고정한다.
- 정렬 필드가 없는 문서는 해당 `orderBy` 결과에서 제외될 수 있다.
- 여러 필터와 정렬의 조합에는 복합 인덱스가 필요할 수 있다.
- 인덱스 오류 링크를 따르기 전에 query 조건이 의도와 같은지 먼저 검토한다.
- 많은 결과는 `limit`과 query cursor로 나누어 읽는다.
- 다음 페이지는 현재 페이지의 마지막 문서 snapshot과 `startAfter`로 시작한다.
- 필터가 바뀌면 목록과 cursor를 함께 초기화한다.
- offset은 건너뛴 문서에도 읽기 비용이 발생하므로 커서를 우선 검토한다.
- query 조건은 Security Rules가 허용하는 범위와 일치해야 한다.
- 실시간 구독과 한 번 읽기는 화면의 갱신 요구와 비용을 기준으로 선택한다.

🧠 기억할 것: Firestore 페이지네이션은 **같은 필터와 정렬을 유지하면서 마지막 문서 다음부터 필요한 수만큼 읽는 것**이다.

## 13. 미니 퀴즈

1. 최신순 query에서 `orderBy`를 명시해야 하는 이유는 무엇인가?
2. 복합 인덱스가 없을 때 Firestore는 느리게라도 query를 실행하는가?
3. “더 보기”에서 `startAt`보다 `startAfter`가 자연스러운 이유는 무엇인가?
4. 필터가 바뀌면 기존 cursor를 계속 사용할 수 있는가?
5. Firestore에서 offset보다 cursor를 우선 사용하는 비용상의 이유는 무엇인가?
6. 클라이언트에 `ownerId` 필터를 넣으면 Security Rules의 소유자 검사를 제거해도 되는가?

<details>
<summary>정답과 해설</summary>

1. 반환 우연에 의존하지 않고 화면과 cursor가 사용할 순서를 고정하기 위해서다.
2. 아니다. 필요한 인덱스가 없으면 오류와 인덱스 생성 안내를 반환한다.
3. `startAfter`는 이미 화면에 표시한 커서 문서를 다음 결과에서 제외해 중복을 막는다.
4. 사용할 수 없다. cursor는 기존 필터와 정렬 순서 안에서의 위치이므로 목록과 함께 초기화한다.
5. offset은 건너뛴 문서에도 읽기 비용이 발생하지만 cursor는 지정한 위치 다음부터 조회하기 때문이다.
6. 안 된다. 클라이언트 query는 사용자가 바꿀 수 있으므로 Rules에서도 접근 권한을 검사해야 한다.

</details>

## 참고 자료

- [Firestore 단순·복합 query](https://firebase.google.com/docs/firestore/query-data/queries)
- [Firestore 정렬과 결과 개수 제한](https://firebase.google.com/docs/firestore/query-data/order-limit-data)
- [Firestore index 개요](https://firebase.google.com/docs/firestore/query-data/index-overview)
- [query cursor로 데이터 페이지 나누기](https://firebase.google.com/docs/firestore/query-data/query-cursors)
- [Firestore 읽기 비용 이해하기](https://firebase.google.com/docs/firestore/pricing)
- [Security Rules에 맞는 query 작성](https://firebase.google.com/docs/firestore/security/rules-query)
