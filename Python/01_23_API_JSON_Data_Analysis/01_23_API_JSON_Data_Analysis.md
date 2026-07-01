# PJT 01: API와 JSON 데이터를 읽고 분석 가능한 결과로 바꾸기

- 🎯 글의 목표: API의 요청·응답 구조와 JSON/Python 자료형의 관계를 이해하고, 외부 데이터를 안전하게 수집해 요구한 형태로 가공하는 과정을 익힌다.
- 🧩 핵심 키워드: 클라이언트·서버, API, HTTP 요청, `requests`, API Key, JSON, 중첩 데이터 탐색, 입력·출력 계약, 필터링, 집계, 정렬, 테스트
- ⭐ 중요도: ★★★★★
- 📝 한눈에 보는 내용: 파일이나 API에서 JSON을 읽는 일과 데이터를 변환하는 일을 분리하고, 작은 함수와 체계적인 테스트로 금융·도서·영화 데이터의 서로 다른 구조를 다룬다.
- 🔗 관련 문제 / 주제: 날씨·예금 API 응답 가공, 도서 목록 분석, 영화·아티스트 정보 변환

---

## 1. 들어가며

JSON 분석 문제는 겉으로는 “키를 찾아 값을 출력하는 문제”처럼 보인다. 하지만 실제로 틀리는 지점은 키 하나가 아니라 데이터의 **구조**다. 어떤 응답은 최상위가 딕셔너리이고 그 안에 목록이 있으며, 어떤 파일은 처음부터 여러 객체의 리스트다. 장르처럼 본문에는 ID만 있고 이름은 별도 목록에서 찾아야 하기도 한다. 영화 목록의 요약 정보와 개별 영화 파일의 상세 정보처럼, 같은 대상도 파일마다 필드가 다를 수 있다.

따라서 구현 전에 다음 질문을 먼저 답해야 한다.

1. 입력의 최상위 자료형은 무엇인가?
2. 원하는 값까지 어떤 키와 인덱스를 지나야 하는가?
3. 함수가 받아야 할 값과 반환해야 할 값은 무엇인가?
4. 필터, 집계, 정렬 중 어떤 변환이 필요한가?
5. 키 누락, 빈 리스트, 잘못된 타입은 어떻게 처리할 것인가?

이 글에서는 금융·도서·영화 자료의 모든 세부 요구사항을 나열하지 않는다. 대신 서로 다른 중첩 구조를 대표하는 예를 이용해, 다른 JSON 문제에도 그대로 적용할 수 있는 분석 순서를 정리한다.

## 2. 핵심 개념 정리

이 프로젝트가 해결하려는 핵심 질문은 “외부에서 받은 복잡한 데이터를 어떻게 요구사항에 맞는 작고 예측 가능한 결과로 바꿀 것인가?”이다.

전체 흐름은 다음과 같다.

```text
JSON 파일/API 응답
        │ 읽기·역직렬화(I/O)
        ▼
Python dict/list
        │ 구조 확인·검증
        ▼
순수 변환 함수
  ├─ 필요한 필드 선택
  ├─ 중첩 구조 탐색
  ├─ ID를 이름으로 변환
  ├─ 조건 필터링
  └─ 집계·정렬
        │ 반환 계약 확인
        ▼
dict/list/숫자/문자열 결과
        │ 출력·저장(I/O)
        ▼
사용자 또는 다음 프로그램
```

본문에서는 먼저 JSON과 Python 자료형의 경계를 확인한다. 그다음 딕셔너리와 리스트가 섞인 구조를 읽고, I/O와 변환을 분리한 함수로 요구사항을 구현한다. 마지막으로 누락된 값에 대한 정책, 입력·출력 계약, 작은 데이터부터 경계값까지 이어지는 테스트 순서를 살펴본다.

## 3. 본문 정리

### 3.1 API는 프로그램이 기능을 요청하는 약속이다

PJT 01은 금융 상품 비교, 영화 추천, 도서 정보 검색 가운데 한 도메인으로 시작하지만 공통 목표는 같다. 외부 데이터를 받아 구조를 읽고, 사용 목적에 맞는 결과로 바꾸는 것이다. 이후 웹 화면과 데이터베이스가 붙어도 이 흐름은 계속 유지된다.

브라우저가 서버에 화면을 요청하듯 Python 프로그램도 서버에 데이터를 요청할 수 있다. API는 서버 내부 구현을 공개하는 것이 아니라, 서버가 허용한 기능의 주소와 요청·응답 형식을 문서로 약속한 접점이다.

```text
클라이언트(Python)                       외부 API 서버
      |                                      |
      |  GET /weather?q=Seoul&appid=...      |
      | -----------------------------------> |
      |                                      | 요청 검증·데이터 조회
      |       상태 코드 + JSON 응답           |
      | <----------------------------------- |
      |                                      |
      |  dict/list로 변환한 뒤 필요한 값 분석  |
```

| 용어 | 이 프로젝트에서의 의미 |
|---|---|
| 클라이언트 | 데이터를 요청하는 Python 프로그램 |
| 서버 | 요청을 처리하고 데이터를 돌려주는 외부 시스템 |
| 엔드포인트 | 특정 기능을 요청하는 URL |
| 메서드 | 요청의 의도. 조회 실습에서는 주로 `GET` 사용 |
| 파라미터 | 도시명, 위도·경도, 단위처럼 요청에 덧붙이는 값 |
| 응답 | 상태 코드, 헤더, 본문을 포함한 서버의 결과 |

같은 날씨 서비스라도 현재 날씨, 시간별 예보, 과거 날씨는 서로 다른 기능이다. 필요한 URL과 파라미터도 달라지므로 검색 결과의 코드를 그대로 복사하기보다 공식 API 문서에서 요청 계약을 확인해야 한다.

### 3.2 `requests`로 요청하고 응답을 단계적으로 확인한다

교재는 공개 테스트 API에 `GET` 요청을 보내고 `.json()`으로 데이터를 확인한 뒤, OpenWeather의 현재 날씨 데이터로 확장한다. `requests.get()`이 반환하는 것은 데이터 딕셔너리가 아니라 `Response` 객체다. 상태를 확인한 다음 JSON 본문을 Python 객체로 변환해야 한다.

```python
import requests


def fetch_carts() -> list[dict]:
    """테스트 API의 장바구니 목록을 JSON으로 받아 반환한다."""
    url = 'https://fakestoreapi.com/carts'

    # 네트워크가 무한히 기다리지 않도록 제한 시간을 둔다.
    response = requests.get(url, timeout=10)

    # 4xx·5xx 응답을 정상 데이터처럼 처리하지 않는다.
    response.raise_for_status()

    # JSON 본문을 Python의 list/dict 구조로 역직렬화한다.
    data = response.json()
    if not isinstance(data, list):
        raise ValueError('장바구니 목록 응답은 리스트여야 합니다.')
    return data
```

학습용 최소 코드는 `requests.get(url).json()`처럼 짧게 쓸 수 있다. 다만 실제 프로젝트에서는 인터넷 연결 실패, 잘못된 URL, 서버 오류, JSON이 아닌 오류 페이지도 생긴다. 디버깅 순서는 `상태 코드 → 응답 본문 → JSON 변환 → 중첩 구조`가 되어야 한다.

⚠️ 주의: 응답 구조가 예상과 다르다고 바로 키 이름부터 고치지 않는다. 인증 실패나 호출 제한 때문에 정상 데이터 대신 오류 메시지를 받았을 수도 있다.

### 3.3 파라미터와 API Key를 안전하게 다룬다

API 문서에는 흔히 `?q=Seoul&appid=...` 같은 쿼리 문자열이 보인다. 문자열을 직접 이어 붙이면 공백과 한글의 URL 인코딩을 빠뜨리기 쉽다. `params`를 사용하면 요청값과 URL을 분리해서 읽을 수 있다.

```python
import os
import requests


def fetch_current_weather(city: str) -> dict:
    """도시의 현재 날씨 응답을 받아 딕셔너리로 반환한다."""
    api_key = os.getenv('OPENWEATHER_API_KEY')
    if not api_key:
        raise RuntimeError('OPENWEATHER_API_KEY 환경 변수가 필요합니다.')

    url = 'https://api.openweathermap.org/data/2.5/weather'
    params = {
        'q': city,
        'appid': api_key,
        'units': 'metric',
        'lang': 'kr',
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    payload = response.json()

    if not isinstance(payload, dict):
        raise ValueError('현재 날씨 응답은 딕셔너리여야 합니다.')
    return payload
```

API Key는 서버가 사용자를 식별하고 호출량을 관리하는 인증 수단이다. 계정의 호출 한도나 비용과 연결될 수 있으므로 소스 코드와 Git에 기록하지 않고 환경 변수에서 읽는다. `.env`를 쓴다면 실제 파일은 `.gitignore`에 넣고, 저장소에는 변수 이름만 담은 `.env.example`을 둔다.

호출 한도와 키 활성화 시간은 서비스와 요금제에 따라 달라질 수 있다. 숫자를 외우기보다 공식 문서에서 분당·일일 한도와 오류 상태 코드를 확인한다.

⚠️ 주의: 완성된 요청 URL을 로그로 출력하면 쿼리 문자열 속 API Key도 함께 남을 수 있다. 디버깅 로그에서는 키를 마스킹한다.

### 3.4 전체 날씨 응답에서 필요한 값만 추출한다

교재의 날씨 실습은 먼저 전체 응답을 출력해 구조를 확인하고, 마지막에 필요한 정보만 꺼내는 순서다. 이 순서를 지켜야 키와 인덱스를 추측해서 생기는 오류를 줄일 수 있다.

```python
def summarize_weather(response: dict) -> dict:
    """현재 날씨 응답을 화면에 사용할 작은 결과로 변환한다."""
    main = response.get('main') or {}
    weather_items = response.get('weather') or []

    temperature = main.get('temp')
    if temperature is None:
        raise ValueError('main.temp 값이 없습니다.')

    description = None
    if weather_items and isinstance(weather_items[0], dict):
        description = weather_items[0].get('description')

    return {
        'city': response.get('name'),
        'temperature': temperature,
        'description': description,
    }


sample = {
    'name': 'Seoul',
    'main': {'temp': 23.4},
    'weather': [{'description': '맑음'}],
}
assert summarize_weather(sample) == {
    'city': 'Seoul',
    'temperature': 23.4,
    'description': '맑음',
}
```

`fetch_current_weather()`는 외부 통신을, `summarize_weather()`는 데이터 해석을 맡는다. 이 분리는 단순히 코드를 예쁘게 만드는 기법이 아니다. 네트워크가 없어도 가공 로직을 검사하고, 실패 원인이 통신인지 변환인지 구분하게 해 주는 실전적인 설계다.

### 3.5 JSON은 문자열 형식이고, 분석 대상은 Python 객체다

JSON은 데이터를 표현하는 **텍스트 형식**이다. 파일을 열었다고 바로 딕셔너리가 되는 것은 아니다. `json.load()`가 파일 객체의 JSON 텍스트를 읽어 Python 객체로 역직렬화한다.

| JSON | Python | 탐색 방법 |
|---|---|---|
| object | `dict` | `data['key']`, `data.get('key')` |
| array | `list` | `data[0]`, `for item in data` |
| string | `str` | 슬라이싱, 문자열 메서드 |
| number | `int` 또는 `float` | 산술·비교 |
| true / false | `True` / `False` | 조건식 |
| null | `None` | `is None` |

파일과 문자열은 함수가 다르다.

```python
import json
from pathlib import Path


def load_json(path: Path):
    """JSON 파일 하나를 Python 객체로 변환한다."""
    # with 블록이 끝나면 파일이 자동으로 닫힌다.
    with path.open(encoding='utf-8') as file:
        return json.load(file)  # 파일 객체 -> dict 또는 list


raw_text = '{"city": "Seoul", "temperature": 21.5}'
weather = json.loads(raw_text)  # JSON 문자열 -> dict

output_text = json.dumps(weather, ensure_ascii=False, indent=2)
# dict -> JSON 문자열. ensure_ascii=False는 한글을 그대로 보이게 한다.
```

`load`/`dump`는 파일 객체를, `loads`/`dumps`는 문자열을 다룬다. 이름 끝의 `s`를 string으로 기억하면 구분하기 쉽다.

⚠️ 주의: `response.json()`의 결과도 보통 이미 `dict`나 `list`다. 여기에 다시 `json.loads()`를 적용하면 문자열이 아니라는 타입 오류가 난다. 먼저 `type(data)`를 확인해야 한다.

### 3.6 중첩 구조는 경로를 한 단계씩 추적한다

중첩 JSON을 한 번에 읽으려 하지 말고, 현재 값의 자료형을 단계마다 확인한다. 예를 들어 날씨 응답에서 설명은 다음 구조에 있다.

```text
response                  dict
├─ main                   dict
│  └─ temp                float
└─ weather                list
   └─ [0]                 dict
      └─ description      str
```

따라서 접근식은 자료형의 순서와 정확히 대응한다.

```python
def summarize_weather(response: dict) -> dict:
    """날씨 응답에서 온도와 첫 번째 날씨 설명만 추출한다."""
    kelvin = response['main']['temp']
    description = response['weather'][0]['description']

    return {
        'temperature_celsius': round(kelvin - 273.15, 2),
        'description': description,
    }
```

`response['weather']['description']`가 실패하는 이유는 `weather`가 딕셔너리가 아니라 리스트이기 때문이다. 리스트에서는 먼저 `[0]`처럼 원소를 선택해야 한다.

도서 응답은 또 다른 구조다. `books_20.json`은 최상위 메타데이터와 실제 도서 목록인 `item`을 함께 가진 딕셔너리지만, 대량 자료인 `books_500.json`과 `books_2000.json`은 최상위 자체가 도서 리스트다.

```python
def extract_items(payload) -> list[dict]:
    """두 가지 도서 입력 구조를 동일한 도서 리스트로 정규화한다."""
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict) and isinstance(payload.get('item'), list):
        return payload['item']

    raise ValueError('도서 목록을 찾을 수 없는 입력 구조입니다.')
```

이처럼 구조 차이를 입구에서 한 번 정규화하면, 이후 분석 함수는 항상 `list[dict]`만 받으면 된다.

📌 핵심: 접근식을 외우는 것이 아니라 `dict → list → dict → value`와 같은 자료형 경로를 읽어야 한다.

### 3.7 요구사항을 입력·변환·출력으로 번역한다

“평점이 높은 최신 영화를 제목순으로 반환한다”는 문장을 바로 코드로 옮기면 조건이 뒤섞이기 쉽다. 먼저 계약으로 바꿔 적는다.

| 구분 | 결정할 내용 |
|---|---|
| 입력 | 영화 딕셔너리들의 리스트 |
| 필수 필드 | `title`, `release_date`, `vote_average` |
| 조건 | 기준 연도 이상, 기준 평점 이상 |
| 정렬 | 제목 오름차순 |
| 출력 | 원본 객체가 아닌 제목 문자열 리스트 |
| 예외 정책 | 날짜·평점 누락 항목은 제외 |

그 뒤 변환을 함수로 만든다.

```python
def select_movies(
    movies: list[dict],
    min_year: int,
    min_vote: float,
) -> list[str]:
    """조건을 만족하는 영화 제목을 오름차순으로 반환한다."""
    selected = []

    for movie in movies:
        release_date = movie.get('release_date')
        vote_average = movie.get('vote_average')

        # 비교에 필요한 필드가 없으면 이 항목은 분석 대상에서 제외한다.
        if not release_date or vote_average is None:
            continue

        # YYYY-MM-DD 형식이라는 입력 계약 아래 앞의 네 자리를 연도로 바꾼다.
        year = int(release_date[:4])
        if year >= min_year and vote_average >= min_vote:
            selected.append(movie['title'])

    return sorted(selected)
```

여기서 반환값은 `print()`의 결과가 아니다. `print()`는 화면에 표시하고 `None`을 반환한다. 채점 코드나 다른 함수가 결과를 다시 사용하려면 반드시 값 자체를 `return`해야 한다.

⚠️ 주의: 요구사항의 “이상/초과/이하/미만”은 각각 `>=`, `>`, `<=`, `<`로 다르다. 예를 들어 500만 이상 1,000만 미만은 `5_000_000 <= followers < 10_000_000`이다.

### 3.8 I/O와 변환을 분리하면 테스트가 단순해진다

파일 열기, API 호출, 출력은 외부 환경에 의존하는 I/O다. 반면 이미 받은 딕셔너리를 다른 딕셔너리로 바꾸는 함수는 같은 입력에 같은 결과를 내는 순수 변환으로 만들 수 있다.

```python
import json
from pathlib import Path


def transform_movie(movie: dict) -> dict:
    """I/O를 모르는 순수 변환 함수다."""
    return {
        'id': movie['id'],
        'title': movie['title'],
        'release_year': movie['release_date'][:4],
    }


def run(input_path: Path) -> dict:
    """프로그램 경계에서만 파일을 읽고 변환 함수를 호출한다."""
    with input_path.open(encoding='utf-8') as file:
        movie = json.load(file)
    return transform_movie(movie)


if __name__ == '__main__':
    current_dir = Path(__file__).resolve().parent
    result = run(current_dir / 'data' / 'movie.json')
    print(result)
```

이 구조에서는 `transform_movie()`를 검사하려고 실제 파일이나 네트워크가 필요하지 않다. 테스트가 실패해도 파일 경로 문제인지 변환 로직 문제인지 빠르게 구분할 수 있다.

API를 쓸 때도 같다. 요청 함수는 상태 코드, 시간 초과, JSON 변환을 담당하고 분석 함수는 응답 딕셔너리만 받게 한다. API 키는 코드에 직접 기록하지 않고 환경 변수 등 외부 설정에서 읽어야 한다.

### 3.9 필요한 필드만 골라 새 딕셔너리를 만든다

원본 데이터는 화면이나 다음 처리에 필요하지 않은 필드를 많이 포함한다. 변환 함수는 원본을 수정하기보다 필요한 필드만 가진 새 딕셔너리를 반환하는 편이 안전하다.

```python
def book_summary(book: dict) -> dict:
    """도서 원본에서 화면에 필요한 필드만 선택한다."""
    return {
        'title': book['title'],
        'author': book.get('author', '작자 미상'),
        'price': book.get('priceSales'),
        'rating': book.get('customerReviewRank'),
    }


def summarize_books(books: list[dict]) -> list[dict]:
    """단일 항목 변환을 목록 전체에 재사용한다."""
    return [book_summary(book) for book in books]
```

단일 객체 변환과 목록 변환을 분리하면 책임이 선명하다. 영화 한 편을 바꾸는 `movie_info(movie)`를 먼저 완성한 뒤, 여러 영화를 순회하는 함수에서 재사용하는 식이다.

원본을 그대로 수정하면 이후 다른 분석이 이미 삭제되거나 이름이 바뀐 필드를 보게 될 수 있다. 특별히 제자리 변경이 요구되지 않는다면 새 객체를 반환하는 방식을 기본으로 삼는다.

### 3.10 ID 목록과 기준표를 연결한다

영화·아티스트 요약 데이터에는 장르 이름 대신 `genre_ids` 또는 `genres_ids`가 들어 있고, 별도 `genres.json`에는 `id`와 `name`의 대응표가 있다. 이는 두 데이터 집합을 공통 키로 연결하는 문제다.

작은 데이터에서는 이중 반복문도 동작하지만, 매 항목마다 장르 전체를 다시 검색한다. 장르 목록을 조회용 딕셔너리로 한 번 바꾸면 의도도 분명하고 반복 비용도 줄어든다.

```python
def make_genre_map(genres: list[dict]) -> dict[int, str]:
    """[{id, name}, ...]을 {id: name} 조회표로 바꾼다."""
    return {genre['id']: genre['name'] for genre in genres}


def resolve_genres(genre_ids: list[int], genre_map: dict[int, str]) -> list[str]:
    """ID 순서를 유지하면서 찾을 수 있는 장르 이름만 반환한다."""
    names = []
    for genre_id in genre_ids:
        name = genre_map.get(genre_id)
        if name is not None:
            names.append(name)
    return names


def movie_info(movie: dict, genre_map: dict[int, str]) -> dict:
    return {
        'title': movie['title'],
        'genres': resolve_genres(movie.get('genre_ids', []), genre_map),
    }
```

영화 20편과 장르 19개처럼 데이터가 작아도 이 패턴을 익혀 두면 대량 데이터에서 유리하다. 기준표 크기를 `G`, 영화 수를 `M`이라 하면 매번 선형 검색하는 방식은 대략 `M × G`만큼 확인하지만, 조회표를 만든 뒤에는 `G + M`에 가깝다.

⚠️ 주의: 자료에 따라 단일 상세 영화는 `genres`를, 영화 목록은 `genre_ids`를 사용할 수 있다. 이름이 비슷하다는 이유로 같은 구조라고 가정하지 말고 실제 키와 값의 타입을 확인해야 한다.

### 3.11 필터링·집계·정렬을 서로 다른 단계로 본다

데이터 분석의 대표 연산은 다음 세 가지다.

- 필터링: 조건을 만족하는 항목만 남긴다.
- 집계: 여러 값을 합계, 평균, 최댓값 등의 하나의 값으로 줄인다.
- 정렬: 항목의 순서를 기준에 맞게 재배치한다.

#### 필터링

```python
def affordable_books(books: list[dict], max_price: int) -> list[dict]:
    """판매가가 존재하고 상한 이하인 도서만 반환한다."""
    return [
        book
        for book in books
        if book.get('priceSales') is not None
        and book['priceSales'] <= max_price
    ]
```

#### 집계

빈 입력의 정책까지 정해야 완전한 함수가 된다.

```python
def average_sales_point(books: list[dict]) -> float | None:
    """판매 지수가 있는 도서의 평균을 구하고, 값이 없으면 None을 반환한다."""
    points = [
        book['salesPoint']
        for book in books
        if book.get('salesPoint') is not None
    ]

    if not points:
        return None  # 0점과 '계산할 자료 없음'을 구분한다.

    return sum(points) / len(points)
```

최댓값 항목은 `max(..., key=...)`로 직접 구할 수 있다.

```python
def highest_rated_movie(movies: list[dict]) -> dict | None:
    candidates = [m for m in movies if m.get('vote_average') is not None]
    if not candidates:
        return None
    return max(candidates, key=lambda movie: movie['vote_average'])
```

#### 정렬

`sorted()`는 새 리스트를 반환하고, `list.sort()`는 원본을 바꾸며 반환값은 `None`이다.

```python
def sort_movies_by_revenue(movies: list[dict]) -> list[dict]:
    """수익 내림차순, 수익이 같으면 제목 오름차순으로 정렬한다."""
    return sorted(
        movies,
        key=lambda movie: (-movie.get('revenue', 0), movie.get('title', '')),
    )
```

복합 키를 사용하면 동률일 때의 순서까지 결정적이다. 이는 테스트 결과가 실행마다 달라지는 일을 막는다.

📌 핵심: “선택 → 계산 → 순서 결정 → 출력 형태 변환”을 분리하면 복합 요구사항도 작은 단계들의 조합이 된다.

### 3.12 누락된 키는 상황에 따라 다르게 처리한다

`data['key']`와 `data.get('key')` 중 어느 것이 항상 더 좋은 것은 아니다. 키의 의미에 따라 선택해야 한다.

| 상황 | 권장 방식 | 이유 |
|---|---|---|
| 계약상 반드시 존재 | `data['id']` | 누락을 즉시 오류로 드러냄 |
| 선택 필드 | `data.get('tagline')` | 없음을 `None`으로 표현 |
| 목록 기본값 | `data.get('genres', [])` | 반복을 안전하게 계속 |
| 표시용 문자열 | `data.get('author', '작자 미상')` | 사용자에게 의미 있는 대체값 제공 |

깊은 중첩에서 `.get()`을 연쇄 호출할 때도 타입을 생각해야 한다.

```python
def follower_count(artist: dict) -> int:
    followers = artist.get('followers') or {}
    total = followers.get('total')

    if not isinstance(total, int):
        raise ValueError('followers.total은 정수여야 합니다.')
    return total
```

`artist.get('followers', {}).get('total')`는 `followers` 키가 아예 없을 때는 안전하지만, 값이 명시적으로 `None`이면 `None.get(...)`이 되어 실패한다. `or {}`는 두 경우를 함께 처리한다.

기본값을 무분별하게 넣으면 데이터 오류가 숨는다. 예를 들어 필수 가격이 없는데 0으로 간주하면 가장 저렴한 상품으로 잘못 선택될 수 있다. “누락 항목 제외”, “`None` 반환”, “예외 발생”, “표시용 대체 문자열” 중 정책을 먼저 정해야 한다.

### 3.13 함수의 입력·출력 계약을 코드와 테스트에 고정한다

좋은 함수는 이름뿐 아니라 다음 계약이 분명하다.

- 입력 자료형과 구조
- 필수 키와 선택 키
- 반환 자료형과 키 이름
- 원본 변경 여부
- 빈 입력과 잘못된 입력의 처리
- 정렬 순서와 동률 처리

```python
def popular_artists(
    artists: list[dict],
    minimum: int,
    maximum: int,
) -> list[dict]:
    """
    minimum 이상 maximum 미만의 팔로워를 가진 아티스트를 반환한다.

    입력 항목에는 name과 followers.total이 있어야 한다.
    반환값은 [{'name': str, 'followers': int}, ...]이며 이름순이다.
    원본 리스트와 원본 딕셔너리는 변경하지 않는다.
    """
    result = []

    for artist in artists:
        total = follower_count(artist)
        if minimum <= total < maximum:
            result.append({'name': artist['name'], 'followers': total})

    return sorted(result, key=lambda item: item['name'])
```

요구사항에서 “이름을 반환”했다면 딕셔너리 전체를 반환하는 것도 오답일 수 있다. 값은 맞더라도 타입, 키 이름, 목록 순서가 다르면 계약을 위반한다.

### 3.14 체계적인 테스트는 구조부터 경계값으로 확장한다

처음부터 전체 JSON 파일로만 시험하면 실패 원인을 찾기 어렵다. 다음 순서가 효과적이다.

1. `type`, `keys`, `len`으로 입력 구조를 확인한다.
2. 손으로 만든 최소 입력 1개로 정상 동작을 확인한다.
3. 조건의 바로 아래·경계·바로 위 값을 검사한다.
4. 누락 키, `None`, 빈 리스트를 검사한다.
5. 동률과 정렬 방향을 검사한다.
6. 마지막에 실제 전체 파일로 통합 실행한다.

```python
def test_popular_artists():
    sample = [
        {'name': 'below', 'followers': {'total': 4_999_999}},
        {'name': 'lower-bound', 'followers': {'total': 5_000_000}},
        {'name': 'inside', 'followers': {'total': 9_999_999}},
        {'name': 'upper-bound', 'followers': {'total': 10_000_000}},
    ]

    actual = popular_artists(sample, 5_000_000, 10_000_000)

    assert actual == [
        {'name': 'inside', 'followers': 9_999_999},
        {'name': 'lower-bound', 'followers': 5_000_000},
    ]
    # 하한은 포함되고 상한은 제외되며, 결과는 이름순이어야 한다.


def test_average_sales_point_with_empty_input():
    assert average_sales_point([]) is None
    assert average_sales_point([{'title': 'no point'}]) is None
```

디버깅할 때는 긴 중첩식 전체를 한 번에 의심하지 않는다.

```python
print(type(data))
print(data.keys() if isinstance(data, dict) else len(data))

weather = data.get('weather')
print(type(weather), weather[:1] if isinstance(weather, list) else weather)
```

`pprint`는 구조 확인에는 유용하지만 검증을 대신하지 않는다. 사람이 보기 좋은 출력이 아니라 `assert`로 예상값과 자료형을 고정해야 회귀 오류를 잡을 수 있다.

## 4. 적용 관점에서 다시 보기

JSON 문제를 받으면 코딩보다 먼저 입력 샘플과 예상 출력을 나란히 놓는다. 최상위 타입, 반복 대상, 연결에 쓰는 ID, 필터 조건, 정렬 기준을 표시하면 구현 단위가 자연스럽게 드러난다.

권장 구현 순서는 다음과 같다.

1. 실제 입력의 `type`, 최상위 키, 리스트 첫 원소의 키를 확인한다.
2. 요구사항을 함수의 입력·출력 계약으로 적는다.
3. 한 항목을 변환하는 함수를 먼저 만든다.
4. 여러 항목에 반복 적용한다.
5. 필요하면 ID 조회표를 미리 만든다.
6. 필터링, 집계, 정렬을 각각 확인한 뒤 결합한다.
7. 최소 입력과 경계값 테스트를 통과시킨다.
8. 마지막에 파일/API I/O와 연결한다.

문제 문장에서 다음 신호를 찾으면 사용할 연산을 결정하기 쉽다.

| 요구사항의 신호 | 구현 관점 |
|---|---|
| “필요한 정보만” | 새 딕셔너리 생성 |
| “각각”, “모든” | 리스트 순회 |
| “이상/미만” | 경계를 포함한 필터 |
| “가장 높은” | 빈 입력 정책 + `max(key=...)` |
| “평균/총합” | 유효값 선택 후 집계 |
| “순으로” | 정렬 방향과 동률 기준 |
| “ID에 해당하는 이름” | 조회표를 이용한 데이터 연결 |
| “폴더의 각 상세 파일” | 파일 읽기와 변환 함수 분리 |

오류가 나면 `파일/API → JSON 변환 → 최상위 타입 → 중첩 경로 → 개별 변환 → 필터 경계 → 정렬 → 최종 반환 형태` 순으로 확인한다. 이 순서는 외부 경계에서 내부 로직으로 범위를 좁혀 주므로, 무작정 코드를 바꾸는 것보다 빠르다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

JSON을 다룬다는 것은 키를 외우는 일이 아니라, 역직렬화된 `dict`와 `list`의 경로를 추적하고 요구한 출력 계약으로 변환하는 일이다. 같은 도메인의 데이터도 요약 목록과 상세 파일의 구조가 다를 수 있으므로 실제 자료형 확인이 구현보다 앞선다.

### 5.2 앞으로 이어지는 연결점

I/O와 순수 변환을 분리하는 방식은 이후 웹 API, 데이터베이스, Django 응답 처리에도 그대로 이어진다. 조회표를 만들어 ID를 이름으로 바꾸는 패턴은 관계형 데이터의 조인과 외래 키를 이해하는 기초가 된다.

### 5.3 더 파볼 만한 주제

규모가 커지면 `dataclass`, `TypedDict`, Pydantic 같은 도구로 스키마를 명시하고, `pytest`의 매개변수화 테스트로 여러 경계값을 관리할 수 있다. 날짜 문자열은 `datetime`, 대량 데이터는 스트리밍 파서나 데이터 분석 도구로 확장해 볼 수 있다.

## 6. 요약 정리

- API는 클라이언트가 서버의 기능을 요청하기 위한 약속이며, 엔드포인트·메서드·파라미터·응답 형식을 문서에서 확인해야 한다.
- `requests.get()`의 `Response`에서 상태를 먼저 검증하고, 성공한 JSON 응답을 `.json()`으로 변환한다.
- API Key는 환경 변수로 관리하고, 호출 제한과 오류 응답을 정상 데이터와 구분한다.
- JSON은 텍스트 형식이며, `json.load()` 또는 `json.loads()`를 거친 뒤 Python의 `dict`와 `list`로 분석한다.
- 중첩 접근은 현재 값이 딕셔너리인지 리스트인지 한 단계씩 확인하며 작성한다.
- 요구사항은 입력, 필수 필드, 변환, 반환 타입, 예외 정책, 정렬 기준의 계약으로 바꾼다.
- 파일·API·출력 같은 I/O와 데이터 변환 함수를 분리하면 재사용과 테스트가 쉬워진다.
- 단일 항목 변환을 만든 뒤 목록 처리에 재사용하고, ID 기준표는 조회용 딕셔너리로 바꾼다.
- 필터링, 집계, 정렬은 서로 다른 단계이며 빈 입력과 경계값 정책이 필요하다.
- 누락 키는 무조건 숨기지 말고 필수 여부에 따라 즉시 오류, 제외, `None`, 기본값 중 하나를 선택한다.
- 최소 정상 입력에서 시작해 경계값, 누락값, 빈 입력, 동률, 전체 파일 순으로 테스트한다.

🧠 기억할 것: JSON 분석의 안정성은 긴 접근식을 빨리 쓰는 능력이 아니라, 구조와 계약을 먼저 확인하고 작은 변환을 검증하는 습관에서 나온다.

## 7. 미니 퀴즈 또는 체크리스트

1. `requests.get()`의 반환값과 `response.json()`의 반환값은 어떻게 다른가?
2. API Key를 코드에 직접 쓰면 안 되는 이유와 안전한 대안은 무엇인가?
3. `json.load()`와 `json.loads()`는 입력으로 무엇을 받는가?
4. `data['weather'][0]['description']`에서 각 접근 뒤의 자료형을 순서대로 설명할 수 있는가?
5. 필수 키에는 `[]`, 선택 키에는 `.get()`을 쓰는 이유와 반대로 사용했을 때의 위험은 무엇인가?
6. 아래 항목을 모두 확인했는가?
   - [ ] 함수가 출력이 아니라 요구한 값을 반환한다.
   - [ ] 원본 데이터를 의도치 않게 수정하지 않는다.
   - [ ] 빈 리스트와 누락 키의 정책이 정해져 있다.
   - [ ] 오름차순·내림차순과 동률 기준이 명확하다.
   - [ ] 파일이나 API 없이 변환 함수만 테스트할 수 있다.
