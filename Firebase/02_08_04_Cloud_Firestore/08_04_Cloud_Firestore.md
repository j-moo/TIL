# TypeScript로 배우는 Cloud Firestore

- 🎯 글의 목표: 문서·컬렉션 데이터 모델을 이해하고 CRUD와 실시간 구독을 React에서 안전하게 처리한다.
- 🧩 핵심 키워드: collection, document, `addDoc`, `getDocs`, `updateDoc`, `deleteDoc`, `onSnapshot`
- ⭐ 중요도: ★★★★★ — 문서 구조와 구독 생명주기가 비용, 질의 가능성, 화면 정확성에 직접 영향을 준다.
- 📝 한눈에 보는 내용: Firestore는 컬렉션 안에 문서를 저장하는 NoSQL 데이터베이스다. 문서 id와 문서 데이터를 구분하고, 실시간 listener는 반드시 해제한다. TypeScript 타입은 서버 데이터의 런타임 검증을 대신하지 않는다.
- 🔗 관련 주제: Security Rules, index, server timestamp, React Effect
- 🧱 선수 지식: Firebase 초기화, Promise, `useEffect`

---

## 1. 데이터 모델

```text
studyNotes (collection)
└─ a1b2c3 (document)
   ├─ topic: "React Router"
   ├─ summary: "URL과 화면 연결"
   └─ createdAt: Timestamp
```

컬렉션은 문서를 묶고, 문서는 필드와 값으로 구성된다. Firestore는 문서 지향 데이터베이스이며 SQL 테이블의 join을 그대로 옮기는 방식으로 설계하지 않는다.

## 2. 입력 타입과 읽기 타입

```ts
import type { Timestamp } from 'firebase/firestore'

export type StudyNote = {
  id: string
  topic: string
  summary: string
  createdAt: Timestamp | null
}

export type StudyNoteInput = Pick<StudyNote, 'topic' | 'summary'>
```

문서 id는 snapshot의 `id`에 있고 `data()` 안에 자동 포함되지 않는다. 서버 timestamp는 서버 반영 전 잠시 `null`일 수 있어 화면이 그 상태를 처리해야 한다.

## 3. 생성과 한 번 읽기

```ts
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { firestore } from '../lib/firebase'
import type { StudyNote, StudyNoteInput } from './types'

const notesCollection = collection(firestore, 'studyNotes')

export async function createStudyNote(input: StudyNoteInput): Promise<string> {
  // createdAt을 브라우저 시간이 아닌 서버 시간으로 기록한다.
  const reference = await addDoc(notesCollection, {
    topic: input.topic,
    summary: input.summary,
    createdAt: serverTimestamp(),
  })

  // 자동으로 생성된 문서 id를 호출자에게 돌려준다.
  return reference.id
}

export async function getStudyNotes(): Promise<StudyNote[]> {
  // 정렬 필드를 명시하면 화면 순서를 문서 반환 우연에 맡기지 않는다.
  const notesQuery = query(notesCollection, orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(notesQuery)

  return snapshot.docs.map(document => {
    const data = document.data()
    return {
      id: document.id,
      // 외부 데이터는 실제 형식을 검증해야 하지만 여기서는 학습용 최소 변환을 보인다.
      topic: String(data.topic ?? ''),
      summary: String(data.summary ?? ''),
      createdAt: data.createdAt ?? null,
    }
  })
}
```

문서가 많아지면 전체 `getDocs`보다 `limit`, 커서 기반 페이지네이션, 필요한 필드 중심의 데이터 모델을 검토한다. 읽기 횟수와 실시간 listener 범위는 비용에도 영향을 준다.

## 4. 수정과 삭제

```ts
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { firestore } from '../lib/firebase'
import type { StudyNoteInput } from './types'

export async function updateStudyNote(
  id: string,
  input: StudyNoteInput,
): Promise<void> {
  // 컬렉션 이름과 id로 수정할 문서 참조를 만든다.
  const noteRef = doc(firestore, 'studyNotes', id)
  await updateDoc(noteRef, {
    topic: input.topic,
    summary: input.summary,
  })
}

export function removeStudyNote(id: string): Promise<void> {
  // deleteDoc은 지정한 문서 하나를 삭제한다.
  return deleteDoc(doc(firestore, 'studyNotes', id))
}
```

클라이언트에서 문서 id를 안다고 수정 권한이 생기는 것은 아니다. 작성자 uid나 역할에 따른 권한을 Security Rules로 검사해야 한다.

## 5. React에서 실시간 구독하기

```tsx
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { firestore } from '../lib/firebase'
import type { StudyNote } from './types'

export function LiveStudyNotes() {
  const [notes, setNotes] = useState<StudyNote[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const notesQuery = query(
      collection(firestore, 'studyNotes'),
      orderBy('createdAt', 'desc'),
    )

    // onSnapshot은 현재 결과를 한 번 보내고 이후 변경 때마다 다시 호출한다.
    const unsubscribe = onSnapshot(
      notesQuery,
      snapshot => {
        setNotes(snapshot.docs.map(document => ({
          id: document.id,
          topic: String(document.data().topic ?? ''),
          summary: String(document.data().summary ?? ''),
          createdAt: document.data().createdAt ?? null,
        })))
      },
      caught => setError(caught.message),
    )

    // 화면이 사라질 때 listener를 해제해 중복 구독과 불필요한 읽기를 막는다.
    return unsubscribe
  }, [])

  if (error) return <p role="alert">{error}</p>
  return <ul>{notes.map(note => <li key={note.id}>{note.topic}</li>)}</ul>
}
```

## 6. Rules와 query는 함께 설계한다

테스트 편의를 위해 `allow read, write: if true`를 운영에 남기면 누구나 데이터를 읽고 바꿀 수 있다. Rules는 경로, 로그인 여부, 사용자 uid, 입력 필드와 타입을 검증해야 한다.

Firestore Rules는 “결과를 받아 각 문서를 걸러 주는 필터”가 아니다. query 자체가 허용된 문서만 반환할 수 있음을 증명해야 하므로 작성자별 제한이 있다면 query 조건도 맞춰야 한다.

## 7. 요약 정리

- Firestore는 컬렉션과 문서로 데이터를 구성한다.
- 문서 id와 `data()` 결과는 별도로 다룬다.
- 서버 시간에는 `serverTimestamp()`를 사용할 수 있다.
- 실시간 listener는 첫 snapshot 이후 변경마다 실행된다.
- React Effect cleanup에서 `unsubscribe`를 호출한다.
- TypeScript 타입은 외부 데이터 검증을 대신하지 않는다.
- Rules, query, index, 비용을 데이터 모델과 함께 설계한다.

🧠 기억할 것: Firestore 문서를 읽는 코드는 데이터 모양뿐 아니라 구독 수명과 접근 권한까지 함께 책임져야 한다.

## 8. 미니 퀴즈

1. 문서 id는 `document.data()`에 자동 포함되는가?
2. `onSnapshot` 반환값을 Effect에서 반환하는 이유는 무엇인가?
3. 공개 Rules를 운영에 두면 어떤 문제가 생기는가?

<details>
<summary>정답과 해설</summary>

1. 아니다. snapshot의 `id`에서 별도로 읽는다.
2. 컴포넌트가 사라질 때 listener를 해제해 중복 구독과 불필요한 읽기를 막기 위해서다.
3. 인증되지 않은 사용자도 데이터에 접근하거나 변경할 수 있다.

</details>

## 참고 자료

- [Cloud Firestore 데이터 모델](https://firebase.google.com/docs/firestore/data-model)
- [Firestore 실시간 업데이트](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firestore Security Rules 시작하기](https://firebase.google.com/docs/firestore/security/get-started)
