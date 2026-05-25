# Django DRF 1: REST API와 단일 모델 CRUD

- 🎯 글의 목표: REST API의 기본 구조를 이해하고, Django REST Framework를 사용해 단일 모델 기반 API 서버를 구현하는 흐름을 정리한다.
- 🧩 핵심 키워드: API, REST, URI, HTTP Method, JSON, Django REST Framework, Serializer, ModelSerializer, CRUD, Postman, Status Code, partial
- ⭐ 중요도: 높음
- 📝 한눈에 보는 내용: API가 왜 필요한지에서 출발해 REST의 자원 중심 설계 방식, JSON 응답, DRF의 Serializer 역할, 그리고 GET/POST/DELETE/PUT/PATCH 요청 처리까지 이어진다.
- 🔗 관련 문제 / 주제: Django API 서버 구현, 프론트엔드/백엔드 분리 구조, RESTful URL 설계, Postman API 테스트

---

## 1. 들어가며

이번 강의는 Django가 단순히 HTML 페이지를 응답하는 서버에서 벗어나, **데이터를 JSON 형태로 응답하는 API 서버**가 되는 과정을 다룬다. 이전까지의 Django 수업에서는 사용자가 브라우저로 페이지를 요청하면 서버가 템플릿을 렌더링해서 HTML을 보내주는 방식이 중심이었다. 하지만 실제 서비스에서는 웹 브라우저뿐 아니라 모바일 앱, 다른 서버, 프론트엔드 프레임워크 등 다양한 클라이언트가 같은 데이터를 필요로 한다.

이때 필요한 것이 API이다. API는 서로 다른 프로그램이 정해진 규칙에 따라 요청하고 응답할 수 있게 해주는 약속이다. 그리고 웹 환경에서 API를 설계할 때 가장 많이 사용하는 방식 중 하나가 REST이다.

이번 글에서는 먼저 API와 REST의 큰 그림을 잡고, Django REST Framework를 사용해 게시글 목록 조회, 상세 조회, 생성, 삭제, 수정 API를 구현하는 흐름까지 이어서 정리한다. 단순히 코드를 외우기보다, **URL은 자원을 나타내고, HTTP Method는 행위를 나타내며, 응답은 JSON으로 표현한다**는 기준을 잡는 것이 핵심이다.

---

## 2. 핵심 개념 정리

이번 강의의 흐름은 크게 세 단계로 이어진다.

첫 번째는 **API와 REST의 개념**이다. API는 소프트웨어끼리 대화하기 위한 규칙이고, REST는 그 규칙을 자원 중심으로 일관되게 설계하는 방법이다. 여기서 중요한 기준은 URI, HTTP Method, JSON이다.

두 번째는 **Django 서버의 역할 변화**이다. 기존 Django는 HTML 페이지를 만들어 응답했지만, REST API 서버에서는 JSON 데이터만 응답한다. 화면은 Vue 같은 프론트엔드가 담당하고, Django는 데이터 제공에 집중하는 구조가 된다.

세 번째는 **DRF를 이용한 CRUD 구현**이다. DRF에서는 모델 객체를 JSON으로 바꾸기 위해 Serializer를 사용한다. 목록 조회에는 `many=True`가 필요하고, 생성이나 수정 요청에서는 `request.data`를 Serializer에 넣어 유효성 검사를 거친 뒤 저장한다. 삭제 요청에서는 일반적으로 본문 없이 `204 No Content`를 반환한다.

정리하면, 이번 강의는 다음 질문에 답하는 과정이라고 볼 수 있다.

> Django에서 모델 데이터를 어떻게 JSON API로 만들고, 클라이언트의 GET, POST, DELETE, PUT, PATCH 요청에 어떻게 응답할 것인가?

---

## 3. 본문 정리

## 3.1 API: 소프트웨어끼리 대화하기 위한 약속

API는 **Application Programming Interface**의 약자로, 두 소프트웨어가 서로 통신할 수 있게 하는 메커니즘이다. 쉽게 말하면 한 프로그램이 다른 프로그램에게 정보를 요청하거나 기능을 사용하려고 할 때 필요한 공통 규칙이다.

클라이언트와 서버처럼 서로 다른 프로그램이 요청과 응답을 주고받으려면, 서로 이해할 수 있는 형식이 필요하다. API는 바로 이 형식을 정해준다. 어떤 주소로 요청해야 하는지, 어떤 값을 보내야 하는지, 어떤 형태로 응답이 돌아오는지를 안내하는 매뉴얼과 같다.

### 날씨 데이터 예시로 이해하기

스마트폰의 날씨 앱이나 웹 사이트의 날씨 정보는 직접 기상 데이터를 생산하지 않는다. 대신 기상청 서버에 날씨 데이터를 요청하고, 서버가 정해진 형식에 맞춰 응답해준다.

![다양한 서비스가 기상청 서버에 날씨 데이터를 요청하는 구조](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-24 221712.png>)

위 그림에서 스마트폰 앱, 웹 서비스 등 다양한 클라이언트는 기상청 서버에 데이터를 요청한다. 이때 아무 형식으로 요청하는 것이 아니라, 기상청이 제공하는 API 규칙에 맞춰 요청해야 한다.

![API 매뉴얼을 통해 요청 형식을 확인하는 구조](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-24 221821.png>)

날씨 데이터를 얻기 위해서는 지역, 날짜, 조회할 항목 같은 정보를 정해진 방식으로 보내야 한다. 이처럼 “이렇게 요청하면, 이렇게 정보를 제공해준다”는 약속이 API이다.

💡 포인트: API는 기능 자체라기보다, 기능을 안전하고 일관되게 사용할 수 있도록 제공되는 **소통 규칙**에 가깝다.

### API의 역할

API의 역할은 복잡한 내부 구현을 직접 다루지 않아도 되게 해주는 데 있다. 예를 들어 냉장고를 작동시키기 위해 사용자가 직접 전기 배선을 하지 않는다. 그냥 플러그를 콘센트에 꽂으면 된다. 전기 공급의 복잡한 구조는 안쪽에 숨겨져 있고, 사용자는 정해진 인터페이스만 사용한다.

API도 비슷하다. 복잡한 코드와 내부 동작을 모두 알 필요 없이, 정해진 요청 형식만 지키면 원하는 기능을 사용할 수 있다.

📌 핵심: API는 서로 다른 소프트웨어가 복잡한 내부 구현을 몰라도 정해진 규칙으로 통신할 수 있게 해주는 약속이다.

---

## 3.2 Web API와 Open API

Web API는 웹 서버 또는 웹 브라우저를 위한 API이다. 현대 웹 개발에서는 모든 기능을 직접 만들기보다 이미 제공되는 다양한 Open API를 활용하는 경우가 많다.

대표적인 Third Party Open API에는 다음과 같은 것들이 있다.

| API 예시 | 활용 예시 |
|---|---|
| YouTube API | 영상 검색, 채널 정보 조회 |
| Google Map API | 지도 표시, 위치 검색 |
| Naver Papago API | 번역 기능 제공 |
| Kakao Map API | 장소 검색, 길찾기 |

여기서 Open API는 누구나 접근할 수 있도록 공개된 외부 소프트웨어와의 통신 인터페이스를 의미한다. Third Party는 내가 직접 만든 서비스가 아니라 외부에서 제공하는 서비스나 소프트웨어를 뜻한다.

따라서 Web API를 이해한다는 것은 단순히 Django 코드 작성법을 아는 것에서 끝나지 않는다. 외부 서비스와 데이터를 주고받는 방식, 프론트엔드와 백엔드가 분리되어 동작하는 구조까지 함께 이해하는 출발점이 된다.

📌 핵심: Web API는 웹 환경에서 서로 다른 서비스가 데이터를 주고받을 수 있게 해주는 통신 규칙이다.

---

## 3.3 REST API: 자원 중심으로 API를 설계하는 방법

REST API는 **Representational State Transfer**의 약자로, API 서버를 개발하기 위한 소프트웨어 설계 방법론이다. REST는 아주 엄격한 문법 규칙이라기보다, API를 일관성 있게 설계하기 위한 기준에 가깝다.

집을 지을 때도 사람마다 마음대로 창문부터 만들고 지붕부터 올리면 공사가 복잡해진다. 그래서 기초, 골조, 내장, 마감처럼 어느 정도의 순서와 기준을 따른다. REST도 마찬가지이다. API마다 제각각인 구조를 정리하고, 누구나 예측 가능한 방식으로 통신할 수 있도록 제안된 설계 기준이다.

### RESTful API란?

RESTful API는 REST 원리를 따르는 API를 의미한다. 핵심은 다음과 같다.

- 자원을 정의한다.
- 자원에 대한 주소를 지정한다.
- 자원에 어떤 행위를 할지는 HTTP Method로 구분한다.
- 응답은 JSON 같은 표현 방식으로 전달한다.

즉, API 주소를 볼 때 “무슨 데이터를 다루는지”가 보여야 하고, HTTP Method를 볼 때 “무슨 작업을 하는지”가 보여야 한다.

REST에서 자원을 정의하고 주소를 지정하는 방법은 다음 세 가지로 정리할 수 있다.

| REST 구성 요소 | 의미 | 예시 |
|---|---|---|
| 자원의 식별 | 어떤 자원을 다룰 것인가 | URI |
| 자원의 행위 | 그 자원에 무엇을 할 것인가 | GET, POST, PUT, DELETE |
| 자원의 표현 | 결과를 어떤 형태로 보여줄 것인가 | JSON 데이터 |

예를 들어 게시글 목록을 조회하는 API라면 `articles/`라는 자원 주소에 `GET` 요청을 보내고, 서버는 게시글 목록을 JSON으로 응답한다. 게시글을 생성할 때도 주소를 `articles/create/`처럼 동작 중심으로 만들기보다, 같은 `articles/` 주소에 `POST` 요청을 보내는 방식이 REST스럽다.

📌 핵심: REST API는 URL에 동작을 적기보다 자원을 표현하고, 실제 동작은 HTTP Method로 구분하는 방식이다.

---

## 3.4 URI와 URL: 자원을 식별하고 위치를 알려주는 주소

URI는 **Uniform Resource Identifier**의 약자로, 인터넷에서 리소스를 식별하는 문자열이다. URL은 URI의 대표적인 형태로, 웹에서 특정 리소스의 위치를 나타내는 주소이다.

![URL을 구성하는 Schema, Domain, Port, Path, Parameters, Anchor 구조](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-24 223224.png>)

위 그림은 하나의 URL이 여러 부분으로 나뉜다는 것을 보여준다. URL은 단순한 문자열이 아니라, 서버가 어떤 요청인지 이해할 수 있도록 여러 정보를 담고 있다.

### URL 구성 요소

| 구성 요소 | 설명 | 예시 |
|---|---|---|
| Schema 또는 Protocol | 브라우저가 리소스를 요청할 때 사용할 규약 | `http`, `https`, `mailto`, `ftp` |
| Domain Name | 요청 중인 웹 서버 | `www.example.com` |
| Port | 서버 리소스에 접근하는 기술적인 문 | HTTP 80, HTTPS 443 |
| Path | 웹 서버의 리소스 경로 | `/articles/1/` |
| Parameters | 서버에 추가로 전달하는 key-value 데이터 | `?key=value&name=kim` |
| Anchor | 문서 내부 특정 위치를 가리키는 북마크 | `#section` |

여기서 주의할 부분은 Path이다. 예전에는 Path가 실제 파일 위치를 의미하는 경우가 많았지만, 오늘날 웹 프레임워크에서는 실제 폴더 구조가 아니라 추상화된 URL 구조를 의미하는 경우가 많다. 예를 들어 `/articles/create/`라는 주소가 실제로 `articles` 폴더 안의 `create` 폴더를 의미하는 것은 아니다.

또한 Anchor는 서버에 전달되지 않는다. 예를 들어 `#quick-install-guide` 같은 부분은 브라우저가 페이지 안에서 해당 위치로 이동하기 위해 사용하는 정보이며, 서버 요청에는 포함되지 않는다.

⚠️ 주의: Django에서 URL을 설계할 때 실제 파일 위치를 떠올리기보다, 클라이언트가 어떤 자원에 접근하는지 기준으로 생각해야 한다.

📌 핵심: URI와 URL은 웹에서 자원을 식별하고 접근하기 위한 주소 체계이며, REST API에서는 URL을 자원 중심으로 설계하는 것이 중요하다.

---

## 3.5 HTTP Method와 응답 상태 코드

HTTP Request Method는 리소스에 대해 수행하고자 하는 동작을 정의한다. REST API에서는 URL에 동작명을 넣기보다, HTTP Method를 통해 행위를 구분한다.

| Method | 역할 | 예시 |
|---|---|---|
| GET | 서버에 리소스의 표현을 요청 | 게시글 목록 조회, 상세 조회 |
| POST | 데이터를 지정된 리소스에 제출 | 게시글 생성 |
| PUT | 요청한 주소의 리소스를 전체 수정 | 게시글 전체 수정 |
| PATCH | 리소스의 일부 필드만 수정 | 게시글 제목만 수정 |
| DELETE | 지정된 리소스를 삭제 | 게시글 삭제 |

여기서 GET은 데이터를 조회하는 요청이므로 서버의 데이터를 바꾸지 않아야 한다. 반면 POST, PUT, PATCH, DELETE는 서버 상태를 변경할 수 있다.

### HTTP Response Status Code

클라이언트가 서버에 요청을 보내면, 서버는 요청이 성공했는지 실패했는지를 상태 코드로 알려준다. 클라이언트는 이 숫자를 보고 어떤 일이 일어났는지 판단할 수 있다.

| 상태 코드 범위 | 의미 |
|---|---|
| 100-199 | 요청이 계속 진행 중이라는 중간 응답 |
| 200-299 | 요청이 정상적으로 처리됨 |
| 300-399 | 리소스가 다른 위치로 이동함 |
| 400-499 | 클라이언트 요청에 문제가 있음 |
| 500-599 | 서버 내부 문제로 요청 처리 실패 |

CRUD 구현에서 자주 보는 상태 코드는 다음과 같다.

| 상태 코드 | 의미 | 사용 상황 |
|---|---|---|
| 200 OK | 요청 성공 | 조회 성공, 수정 성공, 삭제 후 메시지 반환 |
| 201 Created | 생성 성공 | POST로 새 데이터 생성 |
| 204 No Content | 요청 성공, 응답 본문 없음 | DELETE 성공 |
| 400 Bad Request | 잘못된 요청 | 필수 데이터 누락, 형식 오류 |
| 405 Method Not Allowed | 허용되지 않은 메서드 | `@api_view`에 없는 메서드 요청 |

📌 핵심: REST API에서는 요청의 행위는 Method로, 처리 결과는 Status Code로 명확하게 표현한다.

---

## 3.6 HTML 응답에서 JSON 응답으로 바뀌는 서버의 역할

기존 Django 서버는 사용자에게 페이지, 즉 HTML을 응답했다. 사용자가 웹 브라우저로 요청하면 서버가 템플릿을 렌더링해서 완성된 HTML을 보내주는 방식이었다.

하지만 REST API 서버에서는 HTML이 아니라 JSON 데이터를 응답한다. JSON은 데이터만 전달하기 위한 최소한의 형식이며, 언어와 플랫폼에 독립적으로 사용할 수 있다.

![프론트엔드와 백엔드가 분리되어 Django가 JSON 데이터를 응답하는 구조](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-24 225003.png>)

위 그림처럼 Django는 더 이상 화면을 직접 그리는 역할에 집중하지 않는다. 화면은 Vue 같은 Front-end Framework가 담당하고, Django 서버는 필요한 데이터를 JSON으로 제공한다. 이것이 전통적인 MTV 구조에서 프론트엔드/백엔드 분리 구조로 전환되는 핵심이다.

### 기존 Django View와 API View 비교

기존에는 모델 데이터를 템플릿에 넘기고 HTML을 렌더링했다.

```python
# 기존 Django 방식: HTML 페이지를 응답하는 View

def index(request):
    # DB에서 게시글 전체 조회
    articles = Article.objects.all()

    # 템플릿에 전달할 데이터 구성
    context = {
        'articles': articles,
    }

    # articles/index.html을 렌더링한 HTML 페이지를 응답
    return render(request, 'articles/index.html', context)
```

DRF에서는 모델 데이터를 Serializer로 JSON 변환이 가능한 형태로 만들고, `Response`로 응답한다.

```python
# DRF 방식: JSON 데이터를 응답하는 API View

@api_view(['GET'])
def article_list(request):
    # DB에서 게시글 전체 조회
    articles = Article.objects.all()

    # QuerySet은 여러 객체이므로 many=True를 지정하여 직렬화
    serializer = ArticleListSerializer(articles, many=True)

    # serializer.data를 통해 JSON 응답 가능한 데이터로 반환
    return Response(serializer.data)
```

두 코드 모두 게시글 목록을 조회하지만, 응답 방식이 다르다. 첫 번째는 HTML 페이지를 응답하고, 두 번째는 JSON 데이터를 응답한다.

📌 핵심: REST API 서버에서 Django는 화면을 만드는 역할보다 데이터를 JSON으로 제공하는 역할에 집중한다.

---

## 3.7 Python으로 JSON 응답 확인하기

API 서버는 브라우저뿐 아니라 Python 코드에서도 요청할 수 있다. `requests` 라이브러리를 사용하면 특정 주소로 GET 요청을 보내고, 응답으로 받은 JSON 데이터를 Python 타입으로 변환할 수 있다.

먼저 서버가 실행되어 있어야 한다.

```bash
# Django 개발 서버 실행
$ python manage.py runserver
```

그다음 별도의 터미널에서 아래 코드를 실행한다.

```python
# python-request-sample.py

# HTTP 요청을 보내기 위한 외부 라이브러리
import requests

# 응답 데이터를 보기 좋게 출력하기 위한 함수
from pprint import pprint

# 실행 중인 Django API 서버에 GET 요청을 보냄
response = requests.get('http://127.0.0.1:8000/api/v1/articles/')

# 응답으로 받은 JSON 문자열을 Python 자료형으로 변환
result = response.json()

# 변환된 결과의 타입 확인
print(type(result))

# 실제 응답 데이터 확인
pprint(result)
```

실행 방법은 다음과 같다.

```bash
# 서버가 켜진 상태에서 두 번째 터미널에서 실행
$ python python-request-sample.py
```

이 실습의 목적은 API 응답이 단순히 브라우저 화면에서만 쓰이는 것이 아니라, 다른 프로그램에서도 사용할 수 있는 데이터라는 점을 확인하는 것이다.

⚠️ 주의: 이 코드는 Django 서버가 실행 중이어야 동작한다. 서버가 꺼져 있으면 연결 오류가 발생한다.

📌 핵심: JSON API는 브라우저뿐 아니라 Python 코드, 모바일 앱, 프론트엔드 프레임워크 등 다양한 클라이언트에서 사용할 수 있다.

---

## 3.8 Django REST Framework와 Serializer

Django REST Framework, 줄여서 DRF는 Django에서 RESTful API 서버를 쉽게 구축할 수 있도록 도와주는 오픈소스 라이브러리이다.

직접 API 서버를 만들려면 요청 처리, JSON 변환, 유효성 검사, 상태 코드 처리 등을 모두 직접 작성해야 한다. DRF는 이 과정을 표준화하고 자동화해준다. 조립식 가구처럼 필요한 도구와 구조가 준비되어 있어서, 개발자는 일관된 방식으로 API를 만들 수 있다.

### Serializer란?

Serializer는 **데이터 구조나 객체 상태를 다른 시스템에서도 활용할 수 있는 포맷으로 변환하는 과정**을 담당한다. 이 과정을 직렬화라고 한다.

![객체 데이터를 다른 프로그램에서 사용할 수 있는 형태로 변환하는 직렬화 과정](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-25 002106.png>)

직렬화된 데이터는 다른 프로그램, 다른 언어, 다른 컴퓨터에서도 다시 읽고 사용할 수 있다. 쉽게 말하면, Serializer는 데이터를 어디서든 읽을 수 있는 공통 언어로 번역하는 역할을 한다.

DRF에서 Serializer가 담당하는 위치는 다음과 같다.

![DRF에서 Serializer Class가 모델 데이터를 Serialized data로 바꾸는 위치](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-25 002259.png>)

Django의 ModelForm이 모델과 폼을 연결하듯, DRF의 ModelSerializer는 모델과 API 입출력 데이터를 연결한다. 단순히 JSON으로 바꾸는 것에서 끝나지 않고, 입력 데이터의 유효성 검사와 저장까지 담당한다.

### ModelSerializer 기본 구조

Article 모델을 기반으로 Serializer를 정의하면 다음과 같다.

```python
# articles/serializers.py

# DRF에서 Serializer 기능을 사용하기 위한 모듈
from rest_framework import serializers

# 직렬화할 대상 모델 가져오기
from .models import Article


class ArticleSerializer(serializers.ModelSerializer):
    # Meta 클래스에는 어떤 모델을 어떤 필드 기준으로 직렬화할지 작성한다.
    class Meta:
        # Article 모델을 기반으로 Serializer 생성
        model = Article

        # Article 모델의 모든 필드를 API 응답에 포함
        fields = '__all__'
```

여기서 `fields = '__all__'`은 모델의 모든 필드를 포함하겠다는 뜻이다. 목록 조회처럼 일부 필드만 보여주고 싶다면 별도의 Serializer를 만들 수도 있다.

⚠️ 주의: 강의 필기에서 `from .model import Article`, `serializer.ModelSerializer`처럼 적힌 부분은 실제 코드에서는 각각 `from .models import Article`, `serializers.ModelSerializer`로 작성해야 한다. 작은 오탈자지만 실행 시 바로 ImportError 또는 NameError로 이어질 수 있다.

📌 핵심: Serializer는 모델 객체와 JSON 데이터 사이를 연결하는 DRF의 핵심 계층이다.

---

## 3.9 RESTful URL과 HTTP Method 설계

API를 만들 때는 URL에 동작명을 넣기보다, 자원을 중심으로 설계해야 한다. 동작은 HTTP Method로 구분한다.

![articles 자원에 대해 GET, POST, PUT, DELETE를 매핑한 URL 설계 표](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-25 002814.png>)

위 표처럼 같은 자원이라도 HTTP Method에 따라 의미가 달라진다.

| URL | GET | POST | PUT | DELETE |
|---|---|---|---|---|
| `articles/` | 전체 글 조회 | 글 작성 | - | - |
| `articles/1/` | 1번 글 조회 | - | 1번 글 수정 | 1번 글 삭제 |

RESTful하게 설계하려면 다음 기준을 지키는 것이 좋다.

- URL에 `get`, `create`, `delete` 같은 동작명을 넣지 않는다.
- URL은 자원의 위치를 표현한다.
- 동작은 GET, POST, PUT, DELETE, PATCH로 구분한다.
- 복수형과 단수형을 섞지 않고 일관되게 사용한다.
- 깊은 중첩 URL은 피하고, 관계가 필요한 경우에만 명확히 표현한다.

예를 들어 게시글을 생성하는 주소를 `articles/create/`로 만들기보다 `articles/`에 POST 요청을 보내는 방식이 RESTful한 설계에 가깝다.

📌 핵심: URL은 자원을 나타내고, HTTP Method가 그 자원에 대한 행위를 나타낸다.

---

## 3.10 GET 요청: 게시글 목록 조회

GET 요청은 서버의 데이터를 조회할 때 사용한다. 먼저 게시글 목록을 조회하는 API를 구현한다.

목록 조회에서는 모든 필드를 다 보여주기보다 필요한 필드만 보여주는 Serializer를 따로 만들 수 있다.

```python
# articles/serializers.py

from rest_framework import serializers
from .models import Article


class ArticleListSerializer(serializers.ModelSerializer):
    class Meta:
        # 목록 조회에 사용할 모델
        model = Article

        # 목록에서는 핵심 정보만 보여주기 위해 일부 필드만 선택
        fields = (
            'id',
            'title',
            'content',
        )
```

이제 view 함수를 작성한다.

```python
# articles/views.py

# DRF 응답 객체
from rest_framework.response import Response

# 요청 메서드를 제한하고 DRF View로 동작하게 하는 데코레이터
from rest_framework.decorators import api_view

from .models import Article
from .serializers import ArticleListSerializer


@api_view(['GET'])
def article_list(request):
    # 게시글 전체 데이터를 QuerySet 형태로 조회
    articles = Article.objects.all()

    # QuerySet은 여러 개의 객체이므로 many=True가 필요하다.
    serializer = ArticleListSerializer(articles, many=True)

    # 직렬화된 데이터를 JSON 응답으로 반환
    return Response(serializer.data)
```

여기서 중요한 인자는 `many=True`이다. `Article.objects.all()`의 결과는 게시글 하나가 아니라 여러 게시글 객체의 묶음인 QuerySet이다. Serializer는 기본적으로 단일 객체를 처리한다고 보기 때문에, 여러 객체를 직렬화할 때는 `many=True`를 명시해야 한다.

### `serializer.data`의 의미

Serializer 객체 자체를 바로 응답하는 것이 아니라, `serializer.data`를 통해 실제 직렬화된 데이터를 꺼내야 한다.

```python
# 직렬화된 실제 데이터를 꺼내 응답으로 사용
return Response(serializer.data)
```

⚠️ 주의: `many=True`를 빼면 QuerySet을 단일 객체처럼 처리하려고 하면서 오류가 발생할 수 있다. 목록 조회에서는 QuerySet인지 단일 객체인지 먼저 확인하는 습관이 필요하다.

📌 핵심: 목록 조회에서는 QuerySet을 Serializer에 넣으므로 `many=True`가 필요하고, 응답할 때는 `serializer.data`를 반환한다.

---

## 3.11 `@api_view` 데코레이터의 역할

DRF view 함수에서는 `@api_view` 데코레이터를 필수로 작성해야 한다. 이 데코레이터는 해당 함수가 어떤 HTTP Method를 허용하는지 지정한다.

```python
@api_view(['GET'])
def article_list(request):
    ...
```

위 코드는 `article_list` 함수가 GET 요청만 처리하도록 지정한다. 만약 POST나 DELETE 같은 허용되지 않은 요청이 들어오면, DRF는 `405 Method Not Allowed`로 응답한다.

`@api_view`를 빠뜨리면 함수가 일반 Django view처럼 인식되어 DRF의 요청/응답 처리 방식이 제대로 적용되지 않을 수 있다. 이 경우 JSON 응답이 아니라 HTML 에러 페이지가 나오거나, 예상하기 어려운 500번대 오류가 발생할 수 있다.

⚠️ 주의: API 요청이 이상하게 실패할 때는 URL, Method, Serializer뿐 아니라 `@api_view([...])`에 해당 Method가 포함되어 있는지도 확인해야 한다.

📌 핵심: `@api_view`는 DRF view 함수가 허용할 HTTP Method를 지정하고, 요청을 DRF 방식으로 처리하게 해준다.

---

## 3.12 GET 요청: 단일 게시글 상세 조회

상세 조회는 게시글 하나를 가져오는 기능이다. 목록 조회와 달리 단일 객체를 다루므로 `many=True`를 사용하지 않는다.

먼저 전체 필드를 보여줄 Serializer를 정의한다.

```python
# articles/serializers.py

from rest_framework import serializers
from .models import Article


class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        # 상세 조회에서는 Article 모델 전체 정보를 사용
        model = Article

        # 모든 필드를 응답에 포함
        fields = '__all__'
```

URL은 특정 게시글의 pk를 받을 수 있게 작성한다.

```python
# articles/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # 게시글 목록 조회 및 생성
    path('articles/', views.article_list),

    # article_pk에 해당하는 단일 게시글 조회, 수정, 삭제
    path('articles/<int:article_pk>/', views.article_detail),
]
```

view 함수는 다음과 같다.

```python
# articles/views.py

from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import Article
from .serializers import ArticleSerializer, ArticleListSerializer


@api_view(['GET'])
def article_detail(request, article_pk):
    # URL로 전달받은 article_pk에 해당하는 게시글 하나를 조회
    article = Article.objects.get(pk=article_pk)

    # 단일 객체이므로 many=True를 사용하지 않는다.
    serializer = ArticleSerializer(article)

    # 직렬화된 단일 게시글 데이터를 응답
    return Response(serializer.data)
```

목록 조회와 상세 조회의 가장 큰 차이는 Serializer에 들어가는 대상이다. 목록 조회는 QuerySet이고, 상세 조회는 모델 객체 하나이다.

| 구분 | 조회 대상 | Serializer 사용 |
|---|---|---|
| 목록 조회 | `Article.objects.all()` | `many=True` 필요 |
| 상세 조회 | `Article.objects.get(pk=article_pk)` | `many=True` 불필요 |

⚠️ 주의: 필기에서 `article_deital`, `ArticleSerializer(serializers.ModelSerilizer)`처럼 적힌 부분은 오타이다. 실제 코드에서는 함수명과 클래스명을 일관되게 작성해야 URL 연결 오류를 피할 수 있다.

📌 핵심: 상세 조회는 단일 객체를 직렬화하므로 `many=True`를 사용하지 않는다.

---

## 3.13 POST 요청: 게시글 생성

POST 요청은 서버에 새 데이터를 생성할 때 사용한다. 게시글 생성이 성공하면 `201 Created`를 반환하고, 입력 데이터에 문제가 있으면 `400 Bad Request`를 반환한다.

POST 요청은 게시글 목록 주소인 `articles/`에서 함께 처리할 수 있다. 같은 URL이지만 GET이면 목록 조회, POST이면 생성으로 분기한다.

```python
# articles/views.py

from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import Article
from .serializers import ArticleSerializer, ArticleListSerializer


@api_view(['GET', 'POST'])
def article_list(request):
    # GET 요청: 게시글 목록 조회
    if request.method == 'GET':
        articles = Article.objects.all()
        serializer = ArticleListSerializer(articles, many=True)
        return Response(serializer.data)

    # POST 요청: 게시글 생성
    elif request.method == 'POST':
        # 클라이언트가 보낸 JSON 데이터를 Serializer에 전달
        serializer = ArticleSerializer(data=request.data)

        # 입력 데이터가 모델 필드 조건에 맞는지 검증
        if serializer.is_valid():
            # 검증을 통과한 데이터를 DB에 저장
            serializer.save()

            # 생성 성공 시 201 Created와 함께 생성된 데이터 반환
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        # 검증 실패 시 어떤 필드가 문제인지 에러 정보와 함께 400 반환
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

여기서 `request.data`는 클라이언트가 보낸 요청 본문 데이터를 의미한다. Postman에서 JSON Body로 보낸 값이 이곳에 들어온다.

`serializer.is_valid()`는 입력 데이터가 모델 필드 조건에 맞는지 확인한다. 예를 들어 필수 필드가 빠졌거나, 데이터 타입이 잘못되었으면 검증에 실패한다. 이때 `serializer.errors`를 응답하면 어떤 필드가 문제인지 확인할 수 있다.

⚠️ 주의: 필기에는 `elif request.method == 'POST:`처럼 따옴표가 닫히지 않은 부분, `Serializer.data`, `Serializer.error`처럼 대문자로 잘못 적힌 부분이 있다. 실제 코드에서는 반드시 소문자 변수명인 `serializer.data`, `serializer.errors`를 사용해야 한다.

📌 핵심: POST 생성 요청에서는 `request.data`를 Serializer에 넣고, `is_valid()` 검증 후 `save()`를 호출한다.

---

## 3.14 DELETE 요청: 게시글 삭제

DELETE 요청은 특정 리소스를 삭제할 때 사용한다. 게시글 하나를 삭제하는 기능은 상세 URL인 `articles/<int:article_pk>/`에서 처리한다.

삭제가 성공했을 때 일반적으로는 응답 본문 없이 `204 No Content`를 반환한다.

```python
# articles/views.py

from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import Article
from .serializers import ArticleSerializer


@api_view(['GET', 'DELETE'])
def article_detail(request, article_pk):
    # 삭제하거나 조회할 게시글을 먼저 가져온다.
    article = Article.objects.get(pk=article_pk)

    # GET 요청: 단일 게시글 조회
    if request.method == 'GET':
        serializer = ArticleSerializer(article)
        return Response(serializer.data)

    # DELETE 요청: 게시글 삭제
    elif request.method == 'DELETE':
        # DB에서 해당 게시글 삭제
        article.delete()

        # 삭제 성공, 응답 본문 없음
        return Response(status=status.HTTP_204_NO_CONTENT)
```

`Response()`는 기본적으로 데이터를 꼭 넣어야 하는 것은 아니다. 삭제 성공처럼 응답 본문이 필요 없는 경우에는 `status`만 키워드 인자로 전달한다.

![Response 클래스에서 data와 status 인자를 확인하는 예시](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-25 174729.png>)

위 그림처럼 `Response`는 `data`, `status`, `headers` 등의 인자를 받을 수 있다. 삭제 요청에서 본문이 필요 없다면 `Response(status=status.HTTP_204_NO_CONTENT)`처럼 작성한다.

⚠️ 주의: `Response(status.HTTP_204_NO_CONTENT)`처럼 첫 번째 위치 인자로 상태 코드를 넣으면 상태 코드가 아니라 data로 해석될 수 있다. 상태 코드를 전달할 때는 `status=` 키워드를 명시하는 습관이 안전하다.

📌 핵심: DELETE 성공 응답의 기본은 본문 없이 `204 No Content`를 반환하는 것이다.

---

## 3.15 DELETE 후 메시지를 반환해야 하는 경우

REST 원칙상 DELETE 요청은 삭제 성공 시 `204 No Content`를 반환하는 것이 일반적이다. 하지만 상황에 따라 삭제된 객체의 정보를 사용자에게 보여줘야 할 수 있다. 예를 들어 “3번 게시글 'Django 소개'가 삭제되었습니다.” 같은 메시지를 UI에 표시하고 싶을 수 있다.

이 경우에는 삭제 전에 필요한 값을 변수에 저장해두고, 삭제 후 그 값을 사용해 응답 데이터를 만든다.

```python
# articles/views.py

@api_view(['GET', 'DELETE'])
def article_detail(request, article_pk):
    article = Article.objects.get(pk=article_pk)

    if request.method == 'GET':
        serializer = ArticleSerializer(article)
        return Response(serializer.data)

    elif request.method == 'DELETE':
        # delete() 이후에는 객체가 DB에서 사라지므로 필요한 값은 미리 저장한다.
        pk = article.pk
        title = article.title

        # 게시글 삭제
        article.delete()

        # 삭제 후 클라이언트에게 보여줄 메시지 구성
        data = {
            'message': f'{pk}번 게시글 "{title}"이 삭제되었습니다.'
        }

        # 본문 데이터를 반환하므로 204가 아니라 200 OK를 사용
        return Response(data, status=status.HTTP_200_OK)
```

여기서 중요한 점은 `delete()`를 먼저 실행한 뒤 객체의 값을 꺼내려고 하지 않는 것이다. 삭제된 객체를 계속 참조하는 방식은 혼란을 만들 수 있으므로, 필요한 값은 삭제 전에 저장하는 것이 안정적이다.

⚠️ 주의: 필기에는 `title = articel.title`처럼 오타가 있다. 실제 코드에서는 `article.title`로 작성해야 한다.

📌 핵심: DELETE 후 메시지를 반환하려면 삭제 전에 필요한 데이터를 저장하고, 응답 본문이 있으므로 `200 OK`를 사용한다.

---

## 3.16 PUT 요청: 게시글 수정

PUT 요청은 리소스를 수정할 때 사용한다. 일반적으로 PUT은 리소스 전체를 수정하는 요청으로 이해한다. 게시글 수정이 성공하면 `200 OK`와 함께 수정된 데이터를 반환한다.

```python
# articles/views.py

@api_view(['GET', 'DELETE', 'PUT'])
def article_detail(request, article_pk):
    # 수정할 게시글 조회
    article = Article.objects.get(pk=article_pk)

    if request.method == 'GET':
        serializer = ArticleSerializer(article)
        return Response(serializer.data)

    elif request.method == 'DELETE':
        article.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    elif request.method == 'PUT':
        # 기존 article 객체를 request.data 내용으로 수정할 준비
        serializer = ArticleSerializer(article, data=request.data)

        # 유효성 검사를 통과하면 저장
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        # 검증 실패 시 에러와 함께 400 응답
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

생성과 수정은 Serializer 사용 방식이 조금 다르다.

| 작업 | Serializer 작성 방식 | 의미 |
|---|---|---|
| 생성 | `ArticleSerializer(data=request.data)` | 새 객체 생성 |
| 수정 | `ArticleSerializer(article, data=request.data)` | 기존 객체 수정 |

수정에서는 기존 객체인 `article`을 첫 번째 인자로 전달한다. 그래야 Serializer가 새로 만드는 것이 아니라 기존 객체를 업데이트한다.

📌 핵심: PUT 수정 요청에서는 기존 객체와 새 데이터를 함께 Serializer에 전달해야 한다.

---

## 3.17 PATCH와 `partial=True`: 일부 필드만 수정하기

`partial` 인자는 부분 업데이트를 허용하기 위한 설정이다. 기본값은 `False`이다. 따라서 기본 상태에서는 필수 필드 전체가 전달되어야 한다.

예를 들어 Article 모델에 `title`, `content`가 필수 필드라면, PUT 요청에서 제목만 보내고 본문을 보내지 않았을 때 검증에 실패할 수 있다. Serializer는 기본적으로 모든 필수 필드가 들어왔다고 가정하고 검증하기 때문이다.

PATCH는 리소스 전체가 아니라 일부 필드만 수정할 때 사용하는 HTTP Method이다. DRF에서는 `partial=True`를 설정해 일부 필드만 전달하는 수정 요청을 허용할 수 있다.

![PATCH 요청에서 partial=True를 사용해 일부 필드만 수정하는 코드 예시](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-25 180337.png>)

PATCH 요청을 view에 반영하면 다음과 같이 작성할 수 있다.

```python
# articles/views.py

@api_view(['GET', 'DELETE', 'PUT', 'PATCH'])
def article_detail(request, article_pk):
    article = Article.objects.get(pk=article_pk)

    if request.method == 'GET':
        serializer = ArticleSerializer(article)
        return Response(serializer.data)

    elif request.method == 'DELETE':
        article.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    elif request.method == 'PUT':
        # PUT은 전체 수정을 기준으로 하므로 필요한 필드를 모두 보내는 것이 원칙
        serializer = ArticleSerializer(article, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'PATCH':
        # PATCH는 일부 필드 수정이므로 partial=True를 지정
        serializer = ArticleSerializer(article, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

PUT과 PATCH의 차이는 다음과 같이 정리할 수 있다.

![PUT과 PATCH의 수정 범위, 요청 데이터 요구, DRF 설정 차이 비교](<../assets/images/05_11_Django_DRF_1/화면 캡처 2026-05-25 180406.png>)

| 항목 | PUT | PATCH |
|---|---|---|
| 수정 대상 | 전체 리소스 | 리소스의 일부 필드 |
| 요청 데이터 요구 | 모든 필수 필드 포함 | 수정할 필드만 포함 가능 |
| 사용 목적 | 전체 덮어쓰기 | 일부 필드만 갱신 |
| DRF 설정 | 기본 `partial=False` | `partial=True` 필요 |

⚠️ 주의: PUT 요청에서도 편의상 `partial=True`를 사용할 수는 있지만, REST 원칙상 일부 필드만 수정할 때는 PATCH를 사용하는 것이 더 명확하다.

📌 핵심: 일부 필드만 수정할 때는 PATCH와 `partial=True`를 함께 사용한다.

---

## 3.18 `raise_exception=True`: 유효성 검사 실패를 자동으로 400 처리하기

`raise_exception=True`는 `is_valid()`의 선택 인자이다. 유효성 검사를 통과하지 못했을 때 DRF의 기본 예외 처리기가 자동으로 `400 Bad Request` 응답을 반환하도록 도와준다.

기본 방식은 다음과 같다.

```python
# 유효성 검사를 직접 분기 처리하는 방식

serializer = ArticleSerializer(data=request.data)

if serializer.is_valid():
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)

return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

`raise_exception=True`를 사용하면 검증 실패 시 자동으로 예외가 발생하고, DRF가 이를 400 응답으로 처리한다.

```python
# raise_exception=True를 사용하는 방식

@api_view(['POST'])
def article_create(request):
    # 클라이언트가 보낸 데이터를 Serializer에 전달
    serializer = ArticleSerializer(data=request.data)

    # 검증 실패 시 DRF가 자동으로 400 Bad Request 응답 처리
    serializer.is_valid(raise_exception=True)

    # 여기까지 왔다는 것은 검증을 통과했다는 의미
    serializer.save()

    # 생성 성공 응답
    return Response(serializer.data, status=status.HTTP_201_CREATED)
```

이 방식은 코드가 짧아지는 장점이 있다. 다만 학습 초반에는 직접 `serializer.errors`를 반환하는 방식도 함께 알아두는 것이 좋다. 어떤 필드에서 문제가 발생했는지 흐름을 직접 확인할 수 있기 때문이다.

⚠️ 주의: 필기에는 `rais_exception`, `BAD_REQUSET`처럼 오탈자가 있다. 실제 인자는 `raise_exception=True`, 상태 코드는 `HTTP_400_BAD_REQUEST`이다.

📌 핵심: `raise_exception=True`는 Serializer 유효성 검사 실패를 DRF가 자동으로 400 응답 처리하게 해주는 옵션이다.

---

## 4. 적용 관점에서 다시 보기

이번 강의 내용을 실제 구현 관점에서 보면, API를 만들 때 다음 순서로 접근하면 좋다.

첫째, **자원을 먼저 정한다.** 게시글을 다룬다면 자원은 `articles`이다. 이때 URL에 `create`, `delete`, `update` 같은 동작명을 먼저 넣으려고 하면 RESTful 설계에서 벗어나기 쉽다.

둘째, **URL과 Method를 함께 설계한다.** `articles/`는 목록 조회와 생성에 사용하고, `articles/<int:article_pk>/`는 상세 조회, 수정, 삭제에 사용한다. 같은 URL이라도 Method가 다르면 역할이 달라진다.

셋째, **Serializer를 설계한다.** 목록에서 보여줄 필드와 상세에서 보여줄 필드가 다를 수 있다. 목록은 `ArticleListSerializer`, 상세/생성/수정은 `ArticleSerializer`처럼 구분하면 응답 형태를 더 명확하게 관리할 수 있다.

넷째, **View에서는 Method에 따라 분기한다.** GET은 조회, POST는 생성, DELETE는 삭제, PUT은 전체 수정, PATCH는 일부 수정으로 나눈다. 각 분기마다 어떤 Serializer 인자가 필요한지 확인해야 한다.

다섯째, **응답 상태 코드를 명확히 지정한다.** 생성 성공은 `201 Created`, 삭제 성공 후 본문이 없으면 `204 No Content`, 입력 데이터 오류는 `400 Bad Request`를 사용한다. 클라이언트는 이 상태 코드를 기준으로 요청 결과를 판단한다.

실전에서 자주 헷갈리는 신호는 다음과 같다.

| 상황 | 확인할 것 |
|---|---|
| 목록 조회에서 오류 발생 | `many=True`를 넣었는지 확인 |
| POST 요청이 400 반환 | `serializer.errors`로 어떤 필드가 문제인지 확인 |
| Method Not Allowed 발생 | `@api_view([...])`에 해당 Method가 들어 있는지 확인 |
| 수정 요청에서 필수 필드 누락 오류 | 일부 수정이라면 PATCH와 `partial=True` 사용 |
| 삭제 후 응답 오류 | `Response(status=...)`처럼 키워드 인자로 상태 코드 전달 |

🧠 기억할 것: API 구현은 “URL 작성 → Method 결정 → Serializer 선택 → View 분기 → 상태 코드 반환”의 흐름으로 생각하면 정리하기 쉽다.

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의를 통해 Django가 HTML 페이지를 응답하는 서버에서 JSON 데이터를 제공하는 API 서버로 확장될 수 있다는 점을 배웠다. 특히 REST API를 이해할 때는 단순히 URL을 외우는 것보다, **자원과 행위를 분리해서 생각하는 관점**이 중요하다.

또한 DRF의 Serializer가 단순 변환 도구가 아니라는 점도 중요하다. Serializer는 모델 객체를 JSON으로 바꾸고, 클라이언트가 보낸 데이터를 검증하며, 검증된 데이터를 저장하는 흐름의 중심에 있다. Django 웹 개발에서 Form이나 ModelForm이 맡던 역할을 API 개발에서는 Serializer가 담당한다고 볼 수 있다.

이번 내용은 이후 관계 모델 API, 댓글 API, 인증이 필요한 API, 권한 처리, 프론트엔드와의 연동으로 이어진다. 단일 모델 CRUD 흐름을 정확히 이해해두면, 모델이 늘어나고 관계가 복잡해져도 기본 구조를 흔들리지 않고 확장할 수 있다.

---

## 6. 요약 정리

📌 API는 서로 다른 소프트웨어가 정해진 규칙으로 요청과 응답을 주고받기 위한 약속이다.

📌 REST API는 자원을 URL로 표현하고, 행위는 HTTP Method로 구분하는 설계 방식이다.

📌 Django REST API 서버는 HTML이 아니라 JSON 데이터를 응답한다.

📌 Serializer는 모델 객체와 JSON 데이터 사이를 변환하고, 입력 데이터 검증과 저장까지 담당한다.

📌 목록 조회에서는 QuerySet을 다루므로 `many=True`가 필요하다.

📌 생성 요청에서는 `ArticleSerializer(data=request.data)`를 사용하고, 수정 요청에서는 `ArticleSerializer(article, data=request.data)`를 사용한다.

📌 DELETE 성공의 기본 응답은 본문이 없는 `204 No Content`이다.

📌 일부 필드만 수정할 때는 PATCH와 `partial=True`를 사용한다.

🧠 기억할 것: REST API 구현의 핵심은 “자원은 URL, 행위는 Method, 결과는 JSON과 상태 코드”로 나누어 생각하는 것이다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. API는 왜 필요한가? “서로 다른 프로그램 간의 통신”이라는 관점에서 설명할 수 있는가?
2. REST API에서 URL에 `create` 같은 동작명을 넣는 방식이 왜 권장되지 않는가?
3. `Article.objects.all()`을 Serializer에 넣을 때 `many=True`가 필요한 이유는 무엇인가?
4. POST 요청에서 `serializer.is_valid()`가 실패하면 어떤 정보를 확인해야 하는가?
5. DELETE 성공 시 `204 No Content`를 사용하는 이유는 무엇인가?
6. PUT과 PATCH의 차이를 “전체 수정”과 “일부 수정” 관점에서 설명할 수 있는가?
7. `partial=True`를 언제 사용해야 하는가?

---

## 8. 실습 코드 흐름 한 번에 보기

마지막으로 이번 강의의 단일 모델 CRUD 흐름을 한 번에 연결하면 다음과 같다. 실제 프로젝트에서는 파일을 나누어 작성하지만, 복습할 때는 Serializer와 View의 연결 관계를 함께 보는 것이 도움이 된다.

```python
# articles/serializers.py

from rest_framework import serializers
from .models import Article


class ArticleListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = ('id', 'title', 'content')


class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = '__all__'
```

```python
# articles/views.py

from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import Article
from .serializers import ArticleSerializer, ArticleListSerializer


@api_view(['GET', 'POST'])
def article_list(request):
    if request.method == 'GET':
        articles = Article.objects.all()
        serializer = ArticleListSerializer(articles, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = ArticleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'DELETE', 'PUT', 'PATCH'])
def article_detail(request, article_pk):
    article = Article.objects.get(pk=article_pk)

    if request.method == 'GET':
        serializer = ArticleSerializer(article)
        return Response(serializer.data)

    elif request.method == 'DELETE':
        article.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    elif request.method == 'PUT':
        serializer = ArticleSerializer(article, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'PATCH':
        serializer = ArticleSerializer(article, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

```python
# articles/urls.py

from django.urls import path
from . import views

urlpatterns = [
    path('articles/', views.article_list),
    path('articles/<int:article_pk>/', views.article_detail),
]
```

이 코드는 이번 강의에서 다룬 흐름을 복습하기 위한 정리용 코드이다. 핵심은 코드를 그대로 외우는 것이 아니라, 각 Method마다 Serializer에 어떤 인자를 전달하고 어떤 상태 코드를 반환하는지 이해하는 것이다.
