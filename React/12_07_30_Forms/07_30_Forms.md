# TypeScript로 다루는 React 폼

> 학습 목표: controlled와 uncontrolled 입력을 구분하고, 입력 종류에 맞는 값과 이벤트 타입으로 안전한 폼을 만든다.

## 1. 폼의 두 가지 관리 방식

| 방식 | 현재 값의 주인 | 적합한 경우 |
| --- | --- | --- |
| controlled | React state | 입력 즉시 검증·조건부 UI·여러 입력 동기화 |
| uncontrolled | DOM | 간단한 제출, `FormData`, 파일 입력 |

둘 중 하나가 항상 우월한 것은 아니다. 입력하는 동안 React가 값을 알아야 하는지에 따라 선택한다.

## 2. controlled 입력

```tsx
import { useState, type ChangeEvent, type FormEvent } from 'react'

type FormValues = {
  title: string
  category: 'study' | 'project'
  isPublic: boolean
}

export default function NoteForm() {
  const [values, setValues] = useState<FormValues>({
    title: '',
    category: 'study',
    isPublic: false,
  })

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues(current => ({ ...current, title: event.currentTarget.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    console.log(values)
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        제목
        <input value={values.title} onChange={handleTitleChange} />
      </label>

      <label>
        분류
        <select
          value={values.category}
          onChange={event => setValues(current => ({
            ...current,
            category: event.currentTarget.value as FormValues['category'],
          }))}
        >
          <option value="study">학습</option>
          <option value="project">프로젝트</option>
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={values.isPublic}
          onChange={event => setValues(current => ({
            ...current,
            isPublic: event.currentTarget.checked,
          }))}
        />
        공개
      </label>

      <button type="submit">저장</button>
    </form>
  )
}
```

텍스트·`textarea`·`select`는 `value`, checkbox와 radio는 `checked`를 사용한다. controlled 입력은 `onChange`에서 backing state를 동기적으로 갱신해야 한다.

## 3. uncontrolled 폼과 `FormData`

```tsx
function SimpleSearch() {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const query = String(data.get('query') ?? '')
    console.log(query)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="query" defaultValue="" />
      <button type="submit">검색</button>
    </form>
  )
}
```

`name`은 제출 데이터의 key가 된다. `defaultValue`와 `defaultChecked`는 초기값만 지정하며 이후 현재 값을 제어하지 않는다.

## 4. 파일 입력

브라우저 보안 정책상 파일 입력의 값은 사용자가 선택한다. 보통 uncontrolled로 두고 `event.currentTarget.files` 또는 `FormData`로 읽는다.

```tsx
const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.currentTarget.files?.[0]
  if (file) console.log(file.name, file.size)
}

<input type="file" accept="image/*" onChange={handleFileChange} />
```

## 5. 자주 하는 실수

- 처음에는 `undefined`, 이후에는 문자열을 `value`로 넘겨 controlled 여부를 바꾼다.
- checkbox의 선택 상태를 `value`로 읽고 `checked`를 빼먹는다.
- `<textarea>`의 현재 값을 자식 텍스트로 작성한다.
- 폼 내부의 일반 버튼에 `type="button"`을 지정하지 않는다.
- 모든 입력을 한 핸들러로 억지로 처리하면서 타입 단언을 남발한다.

controlled 텍스트 입력은 항상 문자열을 유지하도록 `useState('')`로 초기화하거나 API 값에 `value={value ?? ''}`를 사용한다.

## 6. 요약과 복습

폼은 React가 항상 값을 소유해야 하는지부터 판단한다. 입력 종류에 따라 `value`와 `checked`를 구분하고, 제출 데이터에는 `name`을 붙인다.

1. `value`와 `defaultValue`는 어떻게 다른가?
2. checkbox의 현재 선택 여부는 어떤 속성으로 제어하는가?
3. 파일 입력을 일반적인 controlled 입력으로 다루지 않는 이유는 무엇인가?

## 참고 자료

- [`<input>`](https://react.dev/reference/react-dom/components/input)
- [`<select>`](https://react.dev/reference/react-dom/components/select)
- [`<textarea>`](https://react.dev/reference/react-dom/components/textarea)
- [`<form>`](https://react.dev/reference/react-dom/components/form)
