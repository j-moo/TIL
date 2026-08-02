# TypeScript로 다루는 React 폼

- 🎯 글의 목표: controlled와 uncontrolled 입력을 구분하고, 입력 종류에 맞는 값과 이벤트 타입으로 안전한 폼을 만든다.
- 🧩 핵심 키워드: controlled input, uncontrolled input, `value`, `checked`, `FormData`, 제출
- ⭐ 중요도: ★★★★★ — 사용자의 입력을 읽고 검증해 애플리케이션 데이터로 바꾸는 기본 흐름이다.
- 📝 한눈에 보는 내용: 입력 중 React가 현재 값을 알아야 하면 state로 제어하고, 제출 시점에만 필요하면 DOM과 `FormData`를 활용할 수 있다.
- 🔗 관련 주제: 이벤트, state, 유효성 검사, 서버 요청
- 🧱 선수 지식: `useState`, 객체 펼침, 이벤트 타입

---

폼은 사용자가 입력한 값을 애플리케이션으로 전달한다. React에서는 브라우저가 값을 관리하게 둘 수도 있고, state를 연결해 React가 현재 값을 관리하게 할 수도 있다. 어떤 방식을 선택하든 입력 종류에 맞는 속성과 제출 시점을 이해해야 한다.

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
  // 폼의 현재 값을 하나의 객체 state로 관리한다.
  const [values, setValues] = useState<FormValues>({
    title: '',
    category: 'study',
    isPublic: false,
  })

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    // 기존 category와 isPublic을 유지하고 title만 새 값으로 교체한다.
    setValues(current => ({ ...current, title: event.currentTarget.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // 브라우저 기본 제출을 막고 React 코드에서 값을 처리한다.
    event.preventDefault()
    console.log(values)
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        제목
        {/* state를 value로 전달하고 입력 이벤트에서 같은 state를 갱신한다. */}
        <input value={values.title} onChange={handleTitleChange} />
      </label>

      <label>
        분류
        <select
          value={values.category}
          onChange={event => setValues(current => ({
            ...current,
            // option의 value는 문자열이므로 허용한 category 타입으로 좁힌다.
            category: event.currentTarget.value as FormValues['category'],
          }))}
        >
          <option value="study">학습</option>
          <option value="project">프로젝트</option>
        </select>
      </label>

      <label>
        {/* checkbox의 선택 여부는 value가 아니라 checked로 제어한다. */}
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
    // form 안에서 name이 있는 입력을 key-value 데이터로 수집한다.
    const data = new FormData(event.currentTarget)
    // FormData 값은 File일 수도 있으므로 문자열로 변환하고 null을 처리한다.
    const query = String(data.get('query') ?? '')
    console.log(query)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* defaultValue는 초기값만 지정하며 이후 값은 DOM이 관리한다. */}
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
  // 파일을 선택하지 않았으면 files 또는 첫 항목이 없을 수 있다.
  const file = event.currentTarget.files?.[0]
  // 실제 파일이 있을 때만 메타데이터를 읽는다.
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

## 6. 적용 관점에서 다시 보기

입력할 때마다 검증 결과나 미리보기를 보여 줘야 한다면 controlled 방식을 선택한다. 단순 검색처럼 제출할 때만 값이 필요하면 `FormData`를 이용한 uncontrolled 방식이 더 간단할 수 있다. 여러 입력을 하나의 객체 state로 관리할 때는 기존 필드를 펼친 뒤 바뀐 필드만 덮어쓴다.

입력이 수정되지 않으면 `value`와 `onChange`의 연결을 확인한다. controlled 여부 경고가 나오면 첫 렌더링부터 마지막 렌더링까지 문자열은 문자열, boolean은 boolean으로 유지되는지 살핀다.

## 7. 배운 점 / 확장 포인트

### 7.1 새로 이해한 것

controlled는 input에 `value`만 넣는 문법이 아니라 state를 단일 진실 공급원으로 만드는 설계다. checkbox와 radio는 텍스트 입력과 달리 `checked`를 사용한다.

### 7.2 이전·다음 학습과의 연결

이벤트 처리와 state가 폼에서 결합된다. 이후 서버 전송, 로딩 상태, 오류 메시지, 접근 가능한 검증 안내로 확장한다.

### 7.3 더 확인할 주제

- 클라이언트와 서버 유효성 검사
- React 19 form Actions
- 대규모 폼의 상태 구조
- 파일 업로드 진행률과 용량 검사

## 8. 요약 정리

폼은 React가 항상 값을 소유해야 하는지부터 판단한다. 입력 종류에 따라 `value`와 `checked`를 구분하고, 제출 데이터에는 `name`을 붙인다.

🧠 기억할 것: React가 현재 값을 계속 알아야 하면 `value` 또는 `checked`와 `onChange`를 연결하고, 초기값만 주려면 `defaultValue`를 사용한다.

## 9. 미니 퀴즈

1. `value`와 `defaultValue`는 어떻게 다른가?
2. checkbox의 현재 선택 여부는 어떤 속성으로 제어하는가?
3. 파일 입력을 일반적인 controlled 입력으로 다루지 않는 이유는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. `value`는 React가 현재 값을 계속 제어하고, `defaultValue`는 DOM이 사용할 초기값만 지정한다.
2. boolean인 `checked`로 제어하며 `onChange`에서 `event.currentTarget.checked`를 읽는다.
3. 보안상 파일 선택은 사용자가 수행하며 코드가 파일 경로 값을 임의로 설정할 수 없기 때문이다.

</details>

## 참고 자료

- [`<input>`](https://react.dev/reference/react-dom/components/input)
- [`<select>`](https://react.dev/reference/react-dom/components/select)
- [`<textarea>`](https://react.dev/reference/react-dom/components/textarea)
- [`<form>`](https://react.dev/reference/react-dom/components/form)
