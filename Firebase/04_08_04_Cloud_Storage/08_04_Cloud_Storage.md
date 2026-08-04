# TypeScript로 배우는 Cloud Storage for Firebase

- 🎯 글의 목표: 브라우저 파일을 검증하고 안전한 경로로 업로드하며 진행률·다운로드 URL·오류를 화면에 표현한다.
- 🧩 핵심 키워드: object storage, `ref`, `uploadBytesResumable`, metadata, download URL, Storage Rules
- ⭐ 중요도: ★★★★★ — 파일은 크기가 크고 사용자 입력이므로 경로 충돌, 비용, 악성 형식, 권한을 함께 고려해야 한다.
- 📝 한눈에 보는 내용: Storage에는 파일 원본을, 데이터베이스에는 파일 메타데이터를 저장한다. 업로드 전에 형식과 크기를 확인하고, 고유 경로와 진행률·오류 상태를 관리하며 Rules에서도 다시 제한한다.
- 🔗 관련 주제: Firebase Authentication, Security Rules, Firestore, React form
- 🧱 선수 지식: `<input type="file">`, Promise, Firebase 초기화

---

## 1. 데이터베이스와 파일 저장소 역할

```text
Cloud Storage
└─ users/{uid}/study-images/{uniqueId}.png  ← 실제 파일

Cloud Firestore
└─ notes/{noteId}
   ├─ imagePath
   ├─ downloadUrl
   └─ contentType                         ← 검색·연결용 메타데이터
```

Base64 문자열로 큰 이미지를 문서 데이터베이스에 넣기보다 Storage에 원본을 저장하고, 문서에는 연결 정보만 둔다. 삭제할 때는 문서와 파일 중 어느 쪽을 먼저 지울지, 한쪽만 성공한 경우를 어떻게 복구할지도 정한다.

## 2. 파일 선택은 uncontrolled 입력

```tsx
import { useState, type ChangeEvent } from 'react'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export function ImagePicker() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // multiple이 없으므로 첫 번째 파일 하나만 읽는다.
    const selected = event.currentTarget.files?.[0] ?? null
    setError('')

    if (!selected) {
      setFile(null)
      return
    }
    if (!selected.type.startsWith('image/')) {
      setError('이미지 파일만 선택할 수 있습니다.')
      event.currentTarget.value = ''
      return
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      setError('이미지는 5MB 이하여야 합니다.')
      event.currentTarget.value = ''
      return
    }

    setFile(selected)
  }

  return (
    <label>
      복습 이미지
      <input type="file" accept="image/*" onChange={handleChange} />
      {file && <span>{file.name}</span>}
      {error && <span role="alert">{error}</span>}
    </label>
  )
}
```

`accept`는 파일 선택 UI를 돕는 힌트이지 보안 검사가 아니다. 클라이언트 검증과 Storage Rules의 `contentType`·`size` 검증을 함께 사용한다.

## 3. 재개 가능한 업로드와 진행률

```ts
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from 'firebase/storage'
import { storage } from '../lib/firebase'

type UploadResult = {
  path: string
  downloadUrl: string
}

export function uploadStudyImage(
  userId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadResult> {
  // 사용자 id와 고유 id를 경로에 넣어 같은 파일명 충돌을 피한다.
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `users/${userId}/study-images/${crypto.randomUUID()}.${extension}`
  const storageRef = ref(storage, path)

  const task = uploadBytesResumable(storageRef, file, {
    // 브라우저가 전달한 MIME type을 메타데이터로 명시한다.
    contentType: file.type,
  })

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        // 전체 바이트가 0인 예외를 피하고 0~100 진행률을 계산한다.
        const percent = snapshot.totalBytes === 0
          ? 0
          : (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress(Math.round(percent))
      },
      error => reject(error),
      async () => {
        // 업로드 완료 뒤 같은 참조에서 다운로드 URL을 얻는다.
        const downloadUrl = await getDownloadURL(task.snapshot.ref)
        resolve({ path, downloadUrl })
      },
    )
  })
}
```

다운로드 URL은 파일 내용 자체가 아니며 접근 정책에 따라 취급해야 한다. 장기적으로 URL을 저장할지 Storage 경로를 저장하고 필요할 때 URL을 얻을지는 삭제·토큰 회전·공개 범위를 고려해 결정한다.

## 4. React 업로드 화면

```tsx
import { useState, type FormEvent } from 'react'
import { uploadStudyImage } from './uploadStudyImage'

export function ImageUploadForm({ userId }: { userId: string }) {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = event.currentTarget.elements.namedItem('image')

    // namedItem 결과와 files 존재 여부를 런타임에서 확인한다.
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
      setMessage('업로드할 이미지를 선택하세요.')
      return
    }

    setUploading(true)
    setMessage('')
    setProgress(0)

    try {
      const result = await uploadStudyImage(userId, input.files[0], setProgress)
      // 실제 앱에서는 result.path를 관련 Firestore 문서에 연결할 수 있다.
      setMessage(`업로드 완료: ${result.path}`)
      event.currentTarget.reset()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="image" type="file" accept="image/*" />
      <button type="submit" disabled={uploading}>
        {uploading ? `업로드 중 ${progress}%` : '업로드'}
      </button>
      <progress max={100} value={progress}>{progress}%</progress>
      {message && <p role="status">{message}</p>}
    </form>
  )
}
```

## 5. Storage Rules에서 다시 제한한다

아래는 사용자별 이미지 경로의 학습용 출발점이다. 읽기 요청에는 `request.resource`가 없을 수 있으므로 `read`와 `write` 조건을 분리한다. 실제 규칙은 읽기 공개 범위와 파일 교체 정책까지 프로젝트 요구에 맞춰 Emulator Suite에서 테스트해야 한다.

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/study-images/{fileName} {
      // 로그인한 사용자가 자신의 경로에 있는 파일만 읽을 수 있다.
      allow read: if request.auth != null
                  && request.auth.uid == userId;

      // 삭제는 request.resource가 null이고, 업로드·교체에는 새 파일 정보가 들어온다.
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && (request.resource == null
                       || (request.resource.size < 5 * 1024 * 1024
                           && request.resource.contentType.matches('image/.*')));
    }
  }
}
```

## 6. 요약 정리

- Storage는 이미지·음성·문서 같은 파일 원본을 저장한다.
- 데이터베이스에는 파일 경로와 관련 메타데이터를 연결한다.
- 파일 입력은 `File | null` 가능성을 처리한다.
- `accept`와 클라이언트 검사는 보안 경계가 아니다.
- 고유한 경로를 만들어 파일명 충돌과 덮어쓰기를 줄인다.
- 재개 가능한 업로드에서 진행률과 실패 상태를 표시한다.
- Storage Rules에서 사용자 경로, 크기, MIME type을 다시 검사한다.

🧠 기억할 것: 파일 업로드는 저장 성공만 확인하는 기능이 아니라 입력 검증, 경로, 진행률, 권한, 메타데이터 일관성을 함께 설계하는 작업이다.

## 7. 미니 퀴즈

1. 큰 이미지를 Firestore 문서 대신 Storage에 두는 이유는 무엇인가?
2. `accept="image/*"`만으로 안전하지 않은 이유는 무엇인가?
3. 원래 파일명을 그대로 경로에 쓰면 어떤 문제가 생길 수 있는가?
4. Storage Rules에서 확인할 대표적인 세 가지 조건은 무엇인가?

<details>
<summary>정답과 해설</summary>

1. Storage가 큰 바이너리 파일의 업로드·다운로드에 맞는 객체 저장소이기 때문이다.
2. 선택 UI의 힌트일 뿐 직접 요청이나 위장된 파일을 막지 못하기 때문이다.
3. 같은 이름 충돌, 예측 가능한 경로, 의도하지 않은 덮어쓰기가 생길 수 있다.
4. 인증된 사용자와 경로 uid 일치, 파일 크기, MIME type을 확인한다.

</details>

## 참고 자료

- [Cloud Storage 웹 시작하기](https://firebase.google.com/docs/storage/web/start)
- [웹에서 파일 업로드](https://firebase.google.com/docs/storage/web/upload-files)
- [Cloud Storage Security Rules](https://firebase.google.com/docs/storage/security)
