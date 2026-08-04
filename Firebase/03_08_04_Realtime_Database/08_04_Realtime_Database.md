# TypeScript로 배우는 Firebase Realtime Database

- 🎯 글의 목표: JSON 트리 기반 데이터 모델과 참조·구독·갱신·트랜잭션의 차이를 이해한다.
- 🧩 핵심 키워드: JSON tree, `ref`, `onValue`, `set`, `update`, `push`, `runTransaction`
- ⭐ 중요도: ★★★★☆ — 참조 범위를 너무 크게 잡거나 동시 수정을 단순 덮어쓰기로 처리하면 비용과 데이터 정확성 문제가 생긴다.
- 📝 한눈에 보는 내용: Realtime Database는 하나의 JSON 트리로 데이터를 저장한다. 필요한 가장 낮은 경로를 구독하고 listener를 해제하며, 일부 변경에는 `update`, 동시 카운터에는 transaction을 사용한다.
- 🔗 관련 주제: Firebase Rules, 실시간 UI, 비정규화, 동시성
- 🧱 선수 지식: Firebase 초기화, 객체와 배열, React Effect

---

## 1. Firestore와 다른 데이터 모델

```text
root
└─ rooms
   └─ room-a
      ├─ title: "React 복습"
      └─ participants
         ├─ user-1: true
         └─ user-2: true
```

Realtime Database는 전체가 하나의 JSON 트리다. 깊은 부모 경로를 읽으면 모든 자식 데이터가 함께 내려오므로, 화면이 필요한 단위에 맞춰 경로를 평평하게 설계하는 경우가 많다.

## 2. 참조와 쓰기 방식

```ts
import { getDatabase, push, ref, set, update } from 'firebase/database'
import { firebaseApp } from '../lib/firebase'

const database = getDatabase(firebaseApp)

type StudyRoom = {
  title: string
  ownerId: string
  createdAt: number
}

export async function createStudyRoom(room: StudyRoom): Promise<string> {
  // push는 rooms 아래에 충돌 가능성이 낮은 새 key를 만든다.
  const roomRef = push(ref(database, 'rooms'))

  // set은 해당 경로의 기존 값을 통째로 교체하므로 정확한 경로에 사용한다.
  await set(roomRef, room)
  return roomRef.key ?? ''
}

export async function renameStudyRoom(id: string, title: string): Promise<void> {
  // update는 지정한 자식 필드만 바꾸고 다른 필드는 유지한다.
  await update(ref(database, `rooms/${id}`), { title })
}
```

`set(ref(database, 'rooms'), oneRoom)`처럼 너무 높은 경로에 쓰면 기존 방 전체가 사라질 수 있다. 쓰기 전에 참조 경로와 `set`·`update` 차이를 확인한다.

## 3. React에서 가장 낮은 경로 구독하기

```tsx
import { onValue, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
import { realtimeDatabase } from '../lib/firebase'

export function ParticipantCount({ roomId }: { roomId: string }) {
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    // 필요한 값이 participants뿐이므로 root나 rooms 전체를 구독하지 않는다.
    const participantsRef = ref(
      realtimeDatabase,
      `rooms/${roomId}/participants`,
    )

    const unsubscribe = onValue(
      participantsRef,
      snapshot => {
        // 값이 없을 때 val()은 null이므로 빈 객체로 바꿔 key 수를 계산한다.
        const participants = snapshot.val() as Record<string, true> | null
        setCount(Object.keys(participants ?? {}).length)
      },
      caught => setError(caught.message),
    )

    // roomId가 바뀌거나 화면이 사라지면 이전 listener를 해제한다.
    return unsubscribe
  }, [roomId])

  if (error) return <span role="alert">참여자 수를 불러오지 못했습니다.</span>
  return <span>현재 참여자: {count}명</span>
}
```

`onValue`는 등록 직후 현재 값을 한 번 전달하고, 해당 경로 또는 자식이 바뀔 때 다시 호출한다. 루트에 listener를 달면 작은 변경에도 큰 snapshot을 반복해서 받을 수 있다.

## 4. 여러 경로를 원자적으로 갱신하기

JSON 트리를 조회에 맞게 비정규화하면 같은 데이터를 여러 경로에 저장할 수 있다. `update`에 경로별 값을 전달하면 여러 위치를 한 번에 성공하거나 모두 실패하게 만들 수 있다.

```ts
import { push, ref, update } from 'firebase/database'
import { realtimeDatabase } from '../lib/firebase'

export async function addNotice(ownerId: string, message: string): Promise<void> {
  const noticeKey = push(ref(realtimeDatabase, 'notices')).key
  if (!noticeKey) throw new Error('공지 식별자를 만들지 못했습니다.')

  const notice = { ownerId, message, createdAt: Date.now() }

  // 같은 공지를 전체 목록과 작성자별 목록에 원자적으로 기록한다.
  await update(ref(realtimeDatabase), {
    [`notices/${noticeKey}`]: notice,
    [`userNotices/${ownerId}/${noticeKey}`]: notice,
  })
}
```

중복 저장은 읽기를 단순하게 만들지만 모든 쓰기 경로를 일관되게 갱신해야 한다. 어떤 화면을 얼마나 자주 읽는지 기준으로 구조를 정한다.

## 5. 동시 수정에는 transaction

두 사용자가 동시에 현재 값을 읽고 `+1`을 저장하면 한 번의 증가가 사라질 수 있다. 카운터처럼 현재 값에 의존하는 변경은 `runTransaction`으로 최신 값을 기준으로 재시도한다.

```ts
import { ref, runTransaction } from 'firebase/database'
import { realtimeDatabase } from '../lib/firebase'

export async function increaseReviewCount(topicId: string): Promise<void> {
  const countRef = ref(realtimeDatabase, `topics/${topicId}/reviewCount`)

  await runTransaction(countRef, current => {
    // 처음 값이 없으면 0으로 보고 1을 더한다.
    const safeCurrent = typeof current === 'number' ? current : 0
    return safeCurrent + 1
  })
}
```

## 6. Rules와 검증

클라이언트 타입은 악의적인 직접 요청을 막지 못한다. Rules에서 로그인 여부, 경로의 uid와 사용자 uid 일치, 허용 필드, 문자열 길이 같은 조건을 검사한다. 공개 테스트 규칙은 학습이 끝나는 즉시 제한한다.

## 7. 요약 정리

- Realtime Database는 하나의 JSON 트리다.
- `ref`는 읽거나 쓸 정확한 경로를 가리킨다.
- `set`은 경로 전체를 교체하고 `update`는 일부 자식을 바꾼다.
- `onValue`는 초기 값과 이후 변경을 계속 전달한다.
- listener는 필요한 가장 낮은 경로에 두고 cleanup에서 해제한다.
- 여러 경로 갱신은 root `update`로 원자화할 수 있다.
- 현재 값에 의존하는 동시 수정은 transaction을 검토한다.

🧠 기억할 것: Realtime Database에서는 어떤 API를 쓰는지만큼 어느 경로를 읽고 쓰는지가 중요하다.

## 8. 미니 퀴즈

1. `set`과 `update`의 가장 중요한 차이는 무엇인가?
2. root에 `onValue`를 두는 것이 위험한 이유는 무엇인가?
3. 카운터 증가에 transaction이 필요한 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. `set`은 대상 경로 전체를 교체하고 `update`는 지정한 자식만 변경한다.
2. 작은 자식 변경에도 큰 snapshot을 반복해서 받아 성능과 비용 문제가 생길 수 있다.
3. 여러 클라이언트의 동시 읽기·쓰기로 증가 값이 유실되는 것을 막기 위해서다.

</details>

## 참고 자료

- [Realtime Database 웹 읽기와 쓰기](https://firebase.google.com/docs/database/web/read-and-write)
- [Realtime Database 데이터 구조화](https://firebase.google.com/docs/database/web/structure-data)
