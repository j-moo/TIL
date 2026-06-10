# Vue With DRF 02 - Authentication and Permission

- 🎯 글의 목표: DRF에서 토큰 기반 인증이 어떻게 동작하는지 이해하고, `dj-rest-auth`를 사용해 회원가입·로그인 API를 구성한 뒤, Vue 클라이언트가 발급받은 Token을 이용해 인증이 필요한 API 요청을 보내는 흐름을 정리한다.
- 🧩 핵심 키워드: DRF Authentication, TokenAuthentication, dj-rest-auth, Authorization Header, Token, Permission, IsAuthenticated, IsAdminUser, IsAuthenticatedOrReadOnly, AllowAny, 401 Unauthorized, 403 Forbidden, `request.user`, `@permission_classes`
- ⭐ 중요도: ★★★★★  
  Vue와 DRF를 분리해서 사용하는 프로젝트에서 로그인, 회원가입, 게시글 작성, 사용자별 데이터 저장을 구현하려면 반드시 이해해야 하는 내용이다. 특히 단순히 API 요청을 보내는 단계를 넘어, “누가 요청했는가”와 “그 사용자가 이 요청을 해도 되는가”를 서버에서 판단하는 기준이 된다.
- 📝 한눈에 보는 내용:  
  이번 강의는 Vue와 DRF를 연결한 뒤, 이제 API 요청에 사용자 인증 정보를 어떻게 포함시킬 것인가를 다룬다. 먼저 게시글 모델과 serializer, view에서 사용자 정보를 저장할 준비를 하고, DRF의 인증과 권한 개념을 구분한다. 이후 `TokenAuthentication`을 활성화하고 `dj-rest-auth`로 회원가입·로그인 API를 구성한 뒤, 로그인 성공 시 발급된 Token을 `Authorization` 헤더에 담아 요청하는 방법을 확인한다. 마지막에는 DRF Permission 정책을 적용하면서 `401 Unauthorized`와 `403 Forbidden`의 차이를 실습 흐름 안에서 이해한다.
- 🔗 관련 문제 / 주제: Vue 로그인 상태 관리, Pinia 인증 store, DRF 토큰 인증, 게시글 작성자 저장, 로그인 사용자만 글 작성, 관리자 전용 API, API 권한 제어, Postman 인증 요청 테스트

---

## 1. 들어가며

이전 단계에서 Vue와 DRF가 서로 데이터를 주고받는 구조를 만들었다면, 이번 강의에서는 한 단계 더 나아가 **사용자를 식별하는 요청**을 다룬다. 단순히 게시글 목록을 조회하는 API라면 누구의 요청인지 몰라도 동작할 수 있다. 하지만 게시글을 작성하거나, 사용자의 프로필을 수정하거나, 로그인한 사용자만 볼 수 있는 데이터를 제공하려면 서버는 반드시 요청을 보낸 사용자가 누구인지 알아야 한다.

웹 서비스에서 이 과정을 **인증(Authentication)** 이라고 한다. 인증은 “이 요청을 보낸 사용자가 누구인가?”를 확인하는 과정이다. DRF에서는 요청이 view 함수의 본문 로직에 도달하기 전에 인증 절차를 먼저 수행한다. 이때 요청에 포함된 세션, 토큰, 기본 인증 정보 등을 확인해 `request.user`를 결정한다.

하지만 인증만으로 모든 문제가 끝나는 것은 아니다. 어떤 사용자인지 확인했다면, 그다음에는 “이 사용자가 이 요청을 해도 되는가?”를 판단해야 한다. 이것이 **권한(Permission)** 이다. 예를 들어 로그인한 일반 사용자는 자신의 글을 작성할 수 있지만, 전체 회원 목록을 조회하는 관리자 API에는 접근하면 안 될 수 있다.

이번 강의는 이 두 개념을 분리해서 이해하는 것이 중요하다.

```text
인증(Authentication): 요청을 보낸 사용자가 누구인지 확인하는 과정
권한(Permission): 확인된 사용자가 해당 요청을 수행해도 되는지 판단하는 과정
```

DRF와 Vue를 연결한 프로젝트에서는 보통 로그인 성공 후 서버가 Token을 발급하고, Vue는 이 Token을 저장해두었다가 이후 요청마다 `Authorization` 헤더에 담아 보낸다. 서버는 이 Token을 보고 사용자를 식별하고, 권한 정책을 적용해 요청을 허용하거나 거부한다.

---

## 2. 핵심 개념 정리

이번 강의의 큰 질문은 다음과 같다.

> Vue 클라이언트가 DRF 서버에 요청을 보낼 때, 서버는 어떻게 “누가 요청했는지”를 알 수 있을까?

이 질문에 답하려면 먼저 DRF의 인증 흐름을 이해해야 한다. 클라이언트가 API 요청을 보낼 때 요청 안에 인증 정보를 함께 담아 보내면, DRF는 view 함수가 실행되기 전에 이 정보를 확인한다. 인증에 성공하면 `request.user`에 인증된 사용자 정보가 들어가고, 인증에 실패하거나 인증 정보가 없다면 익명 사용자로 처리되거나 요청이 거부될 수 있다.

이번 강의에서는 여러 인증 방식 중 **TokenAuthentication**을 중심으로 다룬다. Token 인증은 로그인 성공 시 서버가 고유한 Token 값을 발급하고, 클라이언트가 이후 요청마다 그 Token을 HTTP Header에 담아 보내는 방식이다. Vue처럼 브라우저에서 동작하는 프론트엔드와 DRF처럼 API 서버 역할을 하는 백엔드가 분리되어 있을 때 자주 사용된다.

흐름을 크게 보면 다음 순서로 진행된다.

1. 게시글과 사용자 모델의 관계를 다시 활성화한다.
2. DRF 인증과 권한의 차이를 정리한다.
3. `TokenAuthentication`을 DRF 인증 방식으로 설정한다.
4. `dj-rest-auth`를 사용해 회원가입·로그인 API를 만든다.
5. 로그인 후 발급된 Token을 확인한다.
6. Postman 요청에서 `Authorization: Token 토큰값` 형태로 인증 정보를 보낸다.
7. Permission 정책을 적용해 요청 허용 여부를 제어한다.
8. `401 Unauthorized`와 `403 Forbidden`의 차이를 확인한다.

이 흐름은 이후 Vue에서 로그인 상태를 Pinia store로 관리하고, Axios 요청마다 Token을 자동으로 붙이는 구조로 이어진다. 따라서 이번 내용은 단순한 DRF 설정이 아니라, 프론트엔드와 백엔드가 함께 동작하는 인증 구조의 기반이라고 볼 수 있다.

---

## 3. 본문 정리

## 3.1 인증 로직을 위한 사전 준비

이번 실습은 게시글 데이터가 사용자와 연결되는 구조를 전제로 한다. 즉, 게시글을 생성할 때 단순히 `title`, `content`만 저장하는 것이 아니라, “누가 작성했는가”에 해당하는 사용자 정보도 함께 저장되어야 한다.

그래서 먼저 기존 코드에서 주석 처리되어 있던 사용자 관련 코드를 다시 활성화한다. 이 준비가 되어 있어야 나중에 인증된 사용자가 게시글을 작성했을 때 `article.user = request.user`와 같은 흐름으로 작성자 정보가 저장된다.

---

### 3.1.1 Article 모델에서 user ForeignKey 활성화

게시글 모델에서 `user` 필드는 게시글과 작성자를 연결하는 역할을 한다. 한 명의 사용자는 여러 개의 게시글을 작성할 수 있으므로, 일반적으로 게시글 모델에서 사용자 모델을 ForeignKey로 참조한다.

![Article 모델의 user ForeignKey 활성화](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 090324.png>)

이 설정은 게시글 데이터에 작성자 정보를 붙이기 위한 가장 기본적인 구조다. 인증 기능을 붙이기 전에는 게시글 작성 요청이 단순히 데이터만 저장했다면, 인증 이후에는 요청을 보낸 사용자를 기준으로 작성자까지 함께 저장해야 한다.

예시 구조는 다음처럼 이해할 수 있다.

```python
# articles/models.py
from django.db import models
from django.conf import settings

class Article(models.Model):
    # 게시글은 하나의 사용자와 연결된다.
    # settings.AUTH_USER_MODEL을 사용하면 커스텀 유저 모델을 사용해도 안전하다.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )

    # 사용자가 입력하는 게시글 제목과 내용
    title = models.CharField(max_length=100)
    content = models.TextField()

    # 생성·수정 시각은 서버가 자동으로 관리한다.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

여기서 중요한 점은 `user` 필드가 클라이언트가 직접 보내는 값이 아니라는 점이다. 사용자가 브라우저에서 `user: 1` 같은 값을 마음대로 보내게 두면 다른 사람의 글처럼 데이터를 만들 수 있는 문제가 생긴다. 따라서 작성자 정보는 서버가 인증된 사용자 정보를 바탕으로 직접 넣어주는 것이 안전하다.

---

### 3.1.2 Serializer에서 read_only_fields 활성화

`ArticleSerializer`에서는 `read_only_fields`를 사용해 클라이언트가 직접 수정하면 안 되는 필드를 읽기 전용으로 설정한다.

![Serializer의 read_only_fields 설정](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 090401.png>)

`read_only_fields`는 serializer가 응답에는 해당 필드를 포함할 수 있지만, 요청 데이터로는 받지 않도록 만드는 설정이다. 예를 들어 게시글의 작성자, 생성 시간, 수정 시간은 클라이언트가 마음대로 정하면 안 된다.

```python
# articles/serializers.py
from rest_framework import serializers
from .models import Article

class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = '__all__'

        # user는 요청 body에서 받지 않고 서버가 직접 저장한다.
        # created_at, updated_at도 사용자가 직접 입력하는 값이 아니다.
        read_only_fields = ('user', 'created_at', 'updated_at')
```

이 설정을 해두면 클라이언트가 게시글 생성 요청을 보낼 때 `title`, `content`만 보내면 된다. 작성자 정보는 view 함수에서 `serializer.save(user=request.user)` 형태로 추가한다.

⚠️ 주의: `user` 필드를 읽기 전용으로 설정하지 않으면 클라이언트가 요청 body에 임의의 user 값을 넣을 수 있다. 실제 서비스에서는 작성자 정보처럼 신뢰해야 하는 값은 클라이언트 입력이 아니라 서버 인증 정보에서 가져와야 한다.

---

### 3.1.3 View에서 게시글 생성 시 request.user 저장하기

모델과 serializer 준비가 끝났다면, 게시글을 생성하는 view 함수에서 현재 인증된 사용자 정보를 함께 저장해야 한다.

![article_list view에서 user 저장 코드 활성화](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 090450.png>)

DRF의 함수형 view에서는 요청 객체인 `request`를 통해 현재 인증된 사용자에 접근할 수 있다. 인증에 성공한 요청이라면 `request.user`에는 해당 사용자 객체가 들어 있다.

```python
# articles/views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Article
from .serializers import ArticleSerializer

@api_view(['GET', 'POST'])
def article_list(request):
    if request.method == 'GET':
        # 게시글 목록 조회
        articles = Article.objects.all()
        serializer = ArticleSerializer(articles, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        # 클라이언트가 보낸 title, content를 serializer에 넣는다.
        serializer = ArticleSerializer(data=request.data)

        if serializer.is_valid(raise_exception=True):
            # user는 request.data에서 꺼내지 않는다.
            # 인증된 사용자 정보인 request.user를 서버가 직접 저장한다.
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
```

이 코드는 인증과 권한을 적용한 뒤 의미가 더 분명해진다. 인증되지 않은 사용자가 이 view에 접근하면 `request.user`가 정상적인 사용자 객체가 아니므로 글 작성이 막혀야 한다. 그래서 뒤에서 Permission 설정을 함께 적용한다.

---

### 3.1.4 DB 초기화와 Migration 재진행

모델에 `user` ForeignKey가 추가되면 기존 DB 구조와 맞지 않을 수 있다. 특히 기존 `articles.json` fixture에 사용자 정보가 없다면, 새 모델 구조에서는 데이터를 그대로 불러올 수 없다.

![DB 초기화와 fixture 로드 불가 상황](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 090605.png>)

강의 흐름에서는 다음 순서로 초기화를 진행한다.

```bash
# 1. 기존 SQLite DB 삭제
# db.sqlite3 파일 삭제

# 2. 기존 migration 파일 삭제
# 각 앱의 migrations 폴더 안에서 __init__.py를 제외한 migration 파일 삭제

# 3. migration 파일 다시 생성
python manage.py makemigrations

# 4. DB에 반영
python manage.py migrate
```

기존 fixture 파일이 `user` 필드를 포함하지 않는다면 `loaddata` 과정에서 문제가 생길 수 있다. 게시글 모델이 작성자를 필수로 요구하는 구조로 바뀌었기 때문이다.

⚠️ 주의: 모델 구조를 바꾼 뒤 기존 fixture를 그대로 사용하면 필수 필드 누락 오류가 발생할 수 있다. 특히 ForeignKey가 추가되면 fixture 데이터에도 해당 관계 정보가 있어야 한다.

📌 핵심: 인증을 붙이기 전에 데이터 모델부터 “사용자와 연결되는 구조”로 준비해야 한다.

---

## 3.2 인증(Authentication)의 필요성

인증은 클라이언트가 보낸 요청이 누구의 요청인지 확인하는 과정이다. 웹 서비스는 HTTP 기반으로 동작하고, HTTP는 기본적으로 요청과 응답이 서로 독립적이다. 그래서 서버는 아무 정보 없이 들어온 요청만 보고는 이전에 로그인한 사용자인지 알 수 없다.

강의에서는 인증의 필요성을 쿠키와 세션 복습에서 출발해 설명한다. 클라이언트와 서버 간 상태 정보를 유지하기 위해 쿠키와 세션을 사용하지만, 결국 핵심은 서버가 사용자를 식별할 수 있어야 한다는 점이다.

사용자 인증 방식은 다양하다.

| 인증 방식 | 설명 |
|---|---|
| 아이디/비밀번호 | 가장 기본적인 로그인 방식이다. |
| 소셜 로그인(OAuth) | Google, Kakao, GitHub 같은 외부 서비스 계정을 활용한다. |
| 생체 인증 | 지문, 얼굴 인식 등 기기 기반 인증에 자주 사용된다. |
| Token 인증 | 로그인 후 발급받은 토큰을 요청마다 함께 보내 사용자를 식별한다. |

Django는 사용자 인증과 관련된 기본 뼈대를 제공한다. 이를 **Django Authentication System**이라고 한다. DRF는 이 Django 인증 시스템 위에서 API 요청에 맞는 인증 흐름을 제공한다.

---

## 3.3 DRF에서 인증이 동작하는 위치

DRF에서 인증은 view 함수 내부 로직이 실행되기 전에 먼저 수행된다. 요청이 view에 도착하면 DRF는 설정된 인증 클래스들을 확인하고, 요청에 포함된 인증 정보를 분석한다.

```text
요청 도착 → 인증 클래스 실행 → request.user 결정 → 권한 검사 → view 함수 본문 실행
```

이 순서를 이해하는 것이 중요하다. 왜냐하면 view 함수 안에서 `request.user`를 사용할 수 있는 이유가 바로 이 사전 인증 과정 덕분이기 때문이다.

DRF 인증은 요청을 사용자 또는 토큰 같은 자격 증명 자료와 연결한다. 하지만 인증 자체가 요청을 허용하거나 거부하는 것은 아니다. 인증은 어디까지나 “요청자가 누구인지 확인하는 과정”이고, 요청 허용 여부는 권한 정책이 판단한다.

```text
인증은 요청의 사용자 또는 자격 증명을 식별한다.
권한은 그 요청을 허용할지 거부할지 결정한다.
```

이 둘을 혼동하면 에러를 해석하기 어려워진다. 예를 들어 Token이 없어서 사용자를 식별하지 못한 경우와, Token은 있지만 그 사용자가 관리자 권한이 없어 거절된 경우는 서로 다른 상황이다.

---

## 3.4 401 Unauthorized와 403 Forbidden

인증과 권한을 다루다 보면 `401`과 `403` 상태 코드를 자주 만난다. 두 에러 모두 요청이 거부되었다는 점에서는 비슷하지만, 의미는 다르다.

| 상태 코드 | 의미 | 핵심 차이 |
|---|---|---|
| `401 Unauthorized` | 유효한 인증 자격 증명이 없어 사용자를 식별할 수 없음 | 서버가 “너 누구인지 모르겠다”고 보는 상황 |
| `403 Forbidden` | 사용자는 식별했지만 권한이 없어 요청을 거부함 | 서버가 “누구인지는 알지만 이 요청은 안 된다”고 보는 상황 |

`401 Unauthorized`는 이름만 보면 “권한 없음”처럼 느껴지지만, 실제 의미는 인증 자격 증명이 없거나 유효하지 않다는 쪽에 가깝다. 예를 들어 Token을 보내지 않았거나, 잘못된 Token을 보낸 경우가 여기에 해당한다.

반면 `403 Forbidden`은 서버가 요청자를 알고 있지만, 해당 요청을 수행할 권한이 없을 때 발생한다. 예를 들어 일반 사용자가 관리자 전용 API에 접근하는 경우다.

⚠️ 주의: 처음에는 `401`과 `403`을 모두 “접근 거부” 정도로만 이해하기 쉽다. 하지만 디버깅할 때는 차이가 중요하다. `401`이면 Token 전달 여부와 인증 설정을 먼저 확인하고, `403`이면 Permission 정책과 사용자 권한을 확인해야 한다.

---

## 3.5 인증 정책 설정 방법

DRF에서 인증 정책을 설정하는 방법은 크게 두 가지다.

1. 프로젝트 전체에 적용하는 전역 설정
2. 특정 view 함수에만 적용하는 개별 설정

전역 설정은 프로젝트 전체의 기본 인증 방식을 정할 때 사용하고, 개별 설정은 특정 view만 다른 인증 방식을 적용하고 싶을 때 사용한다.

---

### 3.5.1 전역 인증 설정

전역 인증 설정은 `settings.py`의 `REST_FRAMEWORK` 설정 안에 `DEFAULT_AUTHENTICATION_CLASSES`를 작성하는 방식이다.

![DEFAULT_AUTHENTICATION_CLASSES 전역 인증 설정](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 092017.png>)

예시는 다음과 같다.

```python
# settings.py
REST_FRAMEWORK = {
    # 프로젝트 전체에서 기본으로 사용할 인증 방식을 지정한다.
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # Token 기반 인증을 사용한다.
        'rest_framework.authentication.TokenAuthentication',
    ],
}
```

이렇게 설정하면 별도로 인증 클래스를 지정하지 않은 view에서도 기본적으로 Token 인증을 사용한다. 프로젝트 전체에서 인증 정책을 통일하고 싶을 때 적합하다.

---

### 3.5.2 View 함수별 인증 설정

특정 view 함수에만 인증 방식을 지정하고 싶다면 `@authentication_classes` 데코레이터를 사용할 수 있다.

![authentication_classes 데코레이터 예시](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 092105.png>)

```python
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.authentication import TokenAuthentication

@api_view(['GET'])
@authentication_classes([TokenAuthentication])
def article_list(request):
    # 이 view에는 TokenAuthentication이 적용된다.
    pass
```

데코레이터는 기존 함수를 감싸 특별한 기능을 추가하는 함수다. DRF에서는 view 함수에 인증, 권한, 렌더링 방식 등을 추가할 때 데코레이터를 자주 사용한다.

전역 설정과 view별 설정 중 무엇을 사용할지는 프로젝트 구조에 따라 다르다. 대부분의 API가 Token 인증을 사용한다면 전역 설정이 편하고, 일부 view만 예외적으로 다른 인증 방식을 사용한다면 데코레이터가 적합하다.

---

## 3.6 DRF가 제공하는 인증 체계

DRF는 여러 인증 방식을 제공한다. 이번 강의에서는 Token 인증을 중심으로 다루지만, 각 인증 방식의 차이를 간단히 구분해두면 상황에 맞게 선택하기 쉽다.

| 인증 방식 | 설명 | 대표 사용 상황 |
|---|---|---|
| `BasicAuthentication` | 요청마다 사용자 이름과 비밀번호를 Base64로 인코딩해 `Authorization` 헤더에 담아 보낸다. | 간단한 테스트, 내부 도구 |
| `TokenAuthentication` | 로그인 시 발급받은 Token을 요청마다 헤더에 담아 보낸다. | 모바일 앱, SPA, API 서버 |
| `SessionAuthentication` | Django의 세션 시스템과 `sessionid` 쿠키를 활용한다. | Django 템플릿 기반 웹 앱, 같은 도메인 웹 서비스 |
| `RemoteUserAuthentication` | 웹 서버 등 외부 시스템이 처리한 인증 결과를 신뢰한다. | 사내 인증 시스템, 프록시 인증 |

Vue와 DRF를 분리해서 사용하는 구조에서는 서버가 HTML 페이지를 직접 렌더링하지 않는다. 클라이언트는 API만 호출하고, 서버는 JSON 응답을 반환한다. 이런 환경에서는 요청마다 사용자 인증 정보를 명시적으로 전달해야 하므로 Token 인증 방식이 잘 맞는다.

---

## 3.7 TokenAuthentication

TokenAuthentication은 로그인 후 서버가 발급한 고유 Token을 클라이언트가 저장하고, 이후 인증이 필요한 요청마다 HTTP Header에 담아 보내는 방식이다.

```text
로그인 요청 → 서버가 Token 발급 → 클라이언트가 Token 저장 → 이후 요청마다 Token 포함 → 서버가 Token으로 사용자 식별
```

Token은 사용자의 신원이나 권한을 증명하는 값이다. 서버는 Token 값을 DB에 저장해두고, 요청이 들어올 때 Header에 담긴 Token과 DB의 Token을 비교해 사용자를 찾는다.

이 방식은 기본 데스크톱 앱, 모바일 클라이언트, Vue/React 같은 SPA 환경처럼 클라이언트와 서버가 분리된 구조에 적합하다.

⚠️ 주의: Token은 비밀번호와 비슷하게 민감한 값이다. 노출되면 다른 사람이 해당 사용자처럼 API 요청을 보낼 수 있으므로, 저장 위치와 관리 방식에 주의해야 한다.

---

## 3.8 Token 인증 설정

TokenAuthentication을 사용하려면 세 가지 작업이 필요하다.

1. DRF 인증 클래스를 TokenAuthentication으로 설정한다.
2. `INSTALLED_APPS`에 `rest_framework.authtoken`을 추가한다.
3. Migration을 진행해 Token 저장용 DB 테이블을 생성한다.

---

### 3.8.1 인증 클래스 설정

먼저 DRF의 전역 인증 정책을 Token 방식으로 설정한다.

![TokenAuthentication 전역 설정](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 093117.png>)

```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # 요청의 Authorization 헤더에서 Token 값을 읽어 사용자를 인증한다.
        'rest_framework.authentication.TokenAuthentication',
    ],
}
```

이 설정을 해두면 DRF는 요청이 들어올 때 `Authorization` 헤더를 확인하고, `Token` 형식의 인증 정보를 해석하려고 한다.

---

### 3.8.2 INSTALLED_APPS에 authtoken 추가

TokenAuthentication을 사용하려면 Token 값을 저장할 모델과 테이블이 필요하다. 이를 제공하는 앱이 `rest_framework.authtoken`이다.

![rest_framework.authtoken 앱 추가](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 093158.png>)

```python
# settings.py
INSTALLED_APPS = [
    # ...
    'rest_framework',
    'rest_framework.authtoken',
]
```

이 앱을 추가한 뒤 migrate를 진행하면 Token 저장을 위한 테이블이 생성된다.

```bash
python manage.py migrate
```

⚠️ 주의: 강의 원문에는 `migarte`처럼 오타가 있을 수 있는데, 실제 명령어는 `migrate`다. 터미널 명령어는 철자가 하나만 틀려도 실행되지 않으므로 주의해야 한다.

---

### 3.8.3 토큰 인증 방식 과정 정리

Token 인증의 전체 흐름은 다음 그림처럼 이해할 수 있다.

![Token 인증 방식 전체 흐름](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 093251.png>)

흐름을 문장으로 풀면 다음과 같다.

1. 사용자가 회원가입 또는 로그인을 요청한다.
2. 서버는 사용자 정보를 확인한다.
3. 인증에 성공하면 서버는 Token을 발급한다.
4. 클라이언트는 이 Token을 저장한다.
5. 이후 인증이 필요한 API 요청마다 Header에 Token을 담아 보낸다.
6. 서버는 Token을 확인해 사용자를 식별한다.
7. 권한 정책을 통과하면 view 로직을 실행한다.

📌 핵심: Token 인증에서는 로그인 이후의 모든 인증 요청이 `Authorization` 헤더를 중심으로 동작한다.

---

## 3.9 dj-rest-auth 라이브러리

DRF로 직접 회원가입, 로그인, 로그아웃, 비밀번호 재설정 API를 만들 수도 있지만, 인증 API는 반복되는 구현이 많고 실수하기 쉬운 부분이 많다. 그래서 강의에서는 `dj-rest-auth` 라이브러리를 사용한다.

`dj-rest-auth`는 Django의 기본 인증 시스템 위에 REST API 엔드포인트를 제공하는 라이브러리다. 즉, `django.contrib.auth`를 대체하는 것이 아니라, 기존 Django 인증 기능을 API 방식으로 사용할 수 있게 확장해준다.

```text
django.contrib.auth: Django의 기본 인증 뼈대
dj-rest-auth: 그 인증 기능을 REST API로 사용할 수 있게 해주는 라이브러리
```

`dj-rest-auth`를 사용하면 로그인, 로그아웃, 회원 정보 확인, 비밀번호 변경 같은 인증 관련 API를 직접 하나씩 만들지 않아도 된다.

---

### 3.9.1 dj-rest-auth 설치 및 앱 등록

설치는 다음 명령어로 진행한다. 강의 환경에서는 이미 설치되어 있는 상태를 전제로 한다.

```bash
pip install dj-rest-auth
```

설치 후에는 `INSTALLED_APPS`에 관련 앱을 추가한다.

![dj-rest-auth 앱 추가](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 093618.png>)

```python
# settings.py
INSTALLED_APPS = [
    # ...
    'dj_rest_auth',
]
```

그리고 프로젝트의 URL 설정에 dj-rest-auth가 제공하는 URL을 연결한다.

![dj-rest-auth URL 추가](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 093642.png>)

```python
# urls.py
from django.urls import path, include

urlpatterns = [
    # /accounts/ 하위로 로그인, 로그아웃 등 인증 API가 연결된다.
    path('accounts/', include('dj_rest_auth.urls')),
]
```

이제 `/accounts/login/`, `/accounts/logout/` 같은 인증 관련 API를 사용할 수 있다.

---

### 3.9.2 Registration 기능 추가 설정

기본 `dj-rest-auth`는 인증 API 인터페이스를 제공하지만, 회원가입 기능까지 사용하려면 추가 패키지와 설정이 필요하다. 강의에서는 `dj-rest-auth[with-social]` 옵션을 사용한다.

```bash
pip install 'dj-rest-auth[with-social]'
```

이 옵션은 회원가입과 소셜 로그인 기능에 필요한 의존성을 함께 설치하는 방식이다. 강의 환경에서는 이 역시 이미 설치된 상태를 전제로 한다.

![Registration 기능을 위한 추가 앱 설정](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 093827.png>)

회원가입 기능을 사용하려면 `django.contrib.sites`, `allauth`, `allauth.account`, `dj_rest_auth.registration` 등 관련 앱이 필요하다. 실제 설정은 프로젝트 템플릿이나 강의 자료에 따라 조금씩 다를 수 있지만, 핵심은 회원가입 로직을 담당하는 앱을 활성화하는 것이다.

---

### 3.9.3 SITE_ID 설정

Registration 기능과 관련해 `SITE_ID` 설정도 등장한다.

```python
SITE_ID = 1
```

`SITE_ID`는 Django의 sites framework에서 현재 사이트 정보를 찾기 위해 사용하는 값이다. `django.contrib.sites` 앱이 활성화되면 DB에 `django_site` 테이블이 생성되고, `SITE_ID`는 그 테이블의 특정 사이트 레코드와 연결된다.

![SITE_ID 및 관련 설정 코드](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 094013.png>)

처음에는 이 설정이 왜 필요한지 헷갈릴 수 있다. 쉽게 말하면, 회원가입이나 이메일 인증, 소셜 로그인 같은 기능에서 “현재 서비스의 사이트 정보”가 필요한 경우가 있는데, 이때 Django가 어떤 사이트 정보를 사용할지 지정하는 값이라고 보면 된다.

---

### 3.9.4 Registration URL 추가와 Migration

회원가입 API를 사용하려면 registration URL도 추가해야 한다.

![Registration URL 추가 후 migrate 진행](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 094043.png>)

```python
# urls.py
from django.urls import path, include

urlpatterns = [
    path('accounts/', include('dj_rest_auth.urls')),

    # 회원가입 관련 API
    path('accounts/signup/', include('dj_rest_auth.registration.urls')),
]
```

설정 후에는 migrate를 진행한다.

```bash
python manage.py migrate
```

이 과정에서 Token, site, account 관련 테이블이 DB에 생성된다.

⚠️ 주의: 인증 관련 앱을 추가한 뒤 migrate를 하지 않으면 API는 연결되어 있어도 DB 테이블이 없어 오류가 발생할 수 있다. `INSTALLED_APPS`를 바꾼 뒤에는 migration 반영 여부를 확인해야 한다.

---

## 3.10 Token 발급하기

설정이 끝나면 실제로 회원가입과 로그인을 진행해 Token이 발급되는지 확인한다. 강의에서는 DRF Browsable API 화면을 사용해 테스트한다.

먼저 라이브러리 설치와 URL 연결로 인해 추가된 URL 목록을 확인한다.

![dj-rest-auth로 추가된 accounts URL 목록](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 094155.png>)

기본 주소는 다음처럼 접근할 수 있다.

```text
http://127.0.0.1:8000/accounts/
```

여기서 로그인, 로그아웃, 사용자 정보 관련 API 목록을 확인할 수 있다.

---

### 3.10.1 회원가입 요청

회원가입은 registration URL에서 진행한다.

```text
http://127.0.0.1:8000/accounts/signup/
```

![DRF 페이지에서 회원가입 진행](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 094248.png>)

DRF Browsable API 화면 하단에는 요청을 보낼 수 있는 form이 제공된다. 여기에 username, password, password 확인 값 등을 입력해 회원가입 요청을 보낼 수 있다.

실제 Vue 프로젝트에서는 이 form을 사용하는 것이 아니라, Vue 회원가입 페이지에서 Axios로 같은 API에 POST 요청을 보내게 된다. 하지만 API가 제대로 동작하는지 먼저 DRF 화면에서 확인해두면 이후 Vue 연동 디버깅이 훨씬 쉬워진다.

---

### 3.10.2 로그인 요청

회원가입이 끝났다면 로그인 API를 통해 Token 발급을 확인한다.

```text
http://127.0.0.1:8000/accounts/login/
```

![DRF 페이지에서 로그인 진행](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 094336.png>)

로그인 요청에는 보통 username과 password를 담아 보낸다. 인증에 성공하면 서버는 해당 사용자에게 연결된 Token을 응답으로 반환한다.

---

### 3.10.3 로그인 성공 후 Token 확인

로그인에 성공하면 응답에서 Token 값을 확인할 수 있다.

![로그인 성공 후 발급된 Token 확인](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 094433.png>)

이제 이 Token은 Vue 클라이언트가 별도로 저장해야 한다. 예를 들어 Pinia store에 저장하거나, 새로고침 후에도 유지해야 한다면 localStorage에 저장할 수 있다.

```js
// Vue에서 로그인 성공 후 Token을 저장하는 흐름 예시
const login = async (username, password) => {
  // 로그인 API 요청을 보낸다.
  const response = await axios.post('http://127.0.0.1:8000/accounts/login/', {
    username,
    password,
  })

  // 응답에서 token 값을 꺼낸다.
  const token = response.data.key

  // 이후 요청에서 사용할 수 있도록 저장한다.
  localStorage.setItem('token', token)
}
```

위 코드는 Vue 연동에서 이어질 흐름을 보여주기 위한 예시다. 핵심은 로그인 성공 응답의 Token을 클라이언트가 기억하고 있다가, 인증이 필요한 요청에 함께 보내야 한다는 점이다.

---

## 3.11 Token 활용하기

Token을 발급받았다면 이제 인증이 필요한 API 요청에 Token을 담아 보내야 한다. 강의에서는 게시글 작성 요청을 통해 Token 사용 방법을 확인한다.

게시글 작성 API는 다음 주소로 요청한다.

```text
POST http://127.0.0.1:8000/api/v1/articles/
```

Body에는 게시글 제목과 내용을 입력한다.

![Postman에서 게시글 작성 Body 입력](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 094601.png>)

이 요청이 인증이 필요한 API라면 Body만 보내서는 충분하지 않다. 요청 Header에 인증 정보를 함께 넣어야 한다.

---

### 3.11.1 Authorization Header에 Token 담기

DRF TokenAuthentication에서는 다음 형식으로 Header를 작성해야 한다.

```text
Authorization: Token 토큰값
```

Postman에서는 Headers 탭에 다음 값을 입력한다.

| Key | Value |
|---|---|
| `Authorization` | `Token 발급받은토큰값` |

![Postman Header에 Authorization Token 작성](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 094818.png>)

이때 `Token`과 실제 토큰 값 사이에는 반드시 공백이 있어야 한다.

```text
올바른 형식: Authorization: Token abc123...
잘못된 형식: Authorization: Tokenabc123...
잘못된 형식: Authorization: Bearer abc123...  # TokenAuthentication 기본 형식과 다름
```

---

### 3.11.2 클라이언트가 Token으로 인증받는 방법

강의에서는 클라이언트가 Token으로 인증받는 방법을 두 가지 포인트로 정리한다.

1. Token은 `Authorization` HTTP Header에 포함한다.
2. 키 앞에는 문자열 `Token`이 와야 하며, `Token`과 실제 값은 공백으로 구분한다.

![Authorization Header의 Token 형식](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 094922.png>)

Vue에서 Axios를 사용할 때는 다음처럼 Header를 붙일 수 있다.

```js
// localStorage에 저장된 token을 꺼낸다.
const token = localStorage.getItem('token')

// 인증이 필요한 API 요청에 Authorization 헤더를 포함한다.
axios.post(
  'http://127.0.0.1:8000/api/v1/articles/',
  {
    title: '새 게시글',
    content: '게시글 내용입니다.',
  },
  {
    headers: {
      // DRF TokenAuthentication은 반드시 "Token 토큰값" 형식을 사용한다.
      Authorization: `Token ${token}`,
    },
  }
)
```

나중에는 매 요청마다 이 코드를 반복하지 않도록 Axios instance나 Pinia store의 computed 값을 활용해 공통 설정으로 묶을 수 있다.

⚠️ 주의: `Authorization` 헤더 이름, `Token` 문자열, 공백 중 하나만 틀려도 DRF는 인증 정보를 읽지 못한다. 인증이 안 될 때는 먼저 Header 형식을 확인하는 것이 좋다.

---

### 3.11.3 Token 데이터 확인

발급된 Token은 Django DB에 저장된다. 강의에서는 DB를 확인해 발급받은 Token 데이터가 실제로 저장되어 있는지 확인한다.

![Django DB에 저장된 Token 데이터 확인](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 095135.png>)

TokenAuthentication은 요청 Header의 Token 값을 보고 DB에서 해당 Token을 찾는다. Token이 존재하면 연결된 사용자를 확인하고, 그 사용자를 `request.user`에 넣어 view 함수로 전달한다.

흐름을 다시 정리하면 다음과 같다.

```text
요청 Header의 Token 값 → DB의 Token 테이블 조회 → 연결된 User 확인 → request.user에 설정
```

📌 핵심: Token은 단순 문자열이지만, 서버 DB에서는 특정 사용자와 연결되어 있기 때문에 인증 수단으로 사용할 수 있다.

---

## 3.12 권한(Permission) with DRF

인증이 사용자를 식별하는 과정이라면, 권한은 해당 사용자가 요청한 작업을 수행해도 되는지 판단하는 과정이다.

예를 들어 다음과 같은 요구사항을 생각해볼 수 있다.

- 게시글 목록은 누구나 볼 수 있다.
- 게시글 작성은 로그인한 사용자만 할 수 있다.
- 관리자 페이지는 관리자만 접근할 수 있다.
- 회원 정보 수정은 본인만 할 수 있다.

이 요구사항은 모두 Permission과 연결된다. 인증된 사용자라고 해서 모든 요청이 허용되는 것은 아니다. 인증은 “누구인가”를 확인할 뿐이고, 권한은 “무엇을 할 수 있는가”를 결정한다.

---

## 3.13 권한 정책 설정 방법

DRF의 권한 정책도 인증 정책처럼 두 가지 방식으로 설정할 수 있다.

1. 전역 설정
2. View 함수별 설정

---

### 3.13.1 전역 권한 설정

전역 권한 설정은 `settings.py`의 `REST_FRAMEWORK` 안에 `DEFAULT_PERMISSION_CLASSES`를 작성하는 방식이다.

![DEFAULT_PERMISSION_CLASSES 전역 권한 설정](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 095325.png>)

```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        # 기본적으로 인증된 사용자만 접근 가능하게 설정한다.
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

전역 권한을 `IsAuthenticated`로 설정하면 모든 API가 기본적으로 로그인 사용자에게만 열리게 된다. 공개 API까지 모두 막힐 수 있으므로, 필요한 경우 view별로 `AllowAny`나 `IsAuthenticatedOrReadOnly`를 따로 지정해야 한다.

---

### 3.13.2 View 함수별 권한 설정

특정 view 함수에만 권한 정책을 적용하려면 `@permission_classes` 데코레이터를 사용한다.

![permission_classes 데코레이터 예시](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 095412.png>)

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def article_list(request):
    # 이 view는 인증된 사용자만 접근할 수 있다.
    pass
```

이 방식은 특정 API에만 권한을 적용할 때 유용하다. 예를 들어 게시글 목록 조회는 누구나 가능하게 두고, 게시글 생성만 로그인 사용자에게 허용하려면 view 로직 안에서 method에 따라 권한을 더 세밀하게 나누거나, class-based view와 permission 조합을 활용할 수 있다.

---

## 3.14 DRF가 제공하는 주요 권한 정책

DRF는 자주 사용하는 권한 클래스를 기본으로 제공한다. 이번 강의에서는 네 가지를 중심으로 정리한다.

| 권한 클래스 | 의미 | 대표 사용 상황 |
|---|---|---|
| `IsAuthenticated` | 인증된 사용자만 접근 가능 | 회원 전용 API, 글 작성, 프로필 수정 |
| `IsAdminUser` | 관리자(`is_staff=True`)만 접근 가능 | 관리자 전용 통계, 전체 회원 목록 |
| `IsAuthenticatedOrReadOnly` | 비인증 사용자는 읽기만 가능, 인증 사용자는 쓰기도 가능 | 게시글 목록·상세 조회 공개, 작성·수정은 로그인 필요 |
| `AllowAny` | 모든 요청 허용 | 회원가입, 로그인, 공개 API |

---

### 3.14.1 IsAuthenticated

`IsAuthenticated`는 인증된 사용자만 접근을 허용하는 권한 클래스다. 인증되지 않은 사용자의 요청은 거부된다.

```python
from rest_framework.permissions import IsAuthenticated

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_article(request):
    # 로그인한 사용자만 글을 작성할 수 있다.
    pass
```

이 권한은 보호해야 할 데이터나 로그인 사용자만 사용할 수 있는 기능에 적합하다. 예를 들어 게시글 작성, 댓글 작성, 프로필 수정, 장바구니, 결제 기능 등이 여기에 해당한다.

---

### 3.14.2 IsAdminUser

`IsAdminUser`는 관리자 권한을 가진 사용자만 접근할 수 있게 한다. 내부적으로는 `request.user.is_staff` 값이 `True`인지 확인한다.

```python
from rest_framework.permissions import IsAdminUser

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_article_list(request):
    # 관리자만 전체 게시글 관리 데이터를 볼 수 있다.
    pass
```

일반 사용자가 접근하면 권한이 없어 거부된다. 회원 목록 조회, 관리자 통계, 신고 관리, 내부 운영 API처럼 민감한 데이터에 적합하다.

---

### 3.14.3 IsAuthenticatedOrReadOnly

`IsAuthenticatedOrReadOnly`는 비인증 사용자에게 읽기 요청만 허용하고, 인증된 사용자에게는 읽기와 쓰기 요청을 모두 허용한다.

DRF에서 안전한 메서드로 보는 요청은 보통 `GET`, `HEAD`, `OPTIONS`다. 반면 `POST`, `PUT`, `PATCH`, `DELETE`는 데이터를 변경할 수 있으므로 인증이 필요하다.

```python
from rest_framework.permissions import IsAuthenticatedOrReadOnly

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def article_list(request):
    # GET: 누구나 게시글 목록 조회 가능
    # POST: 인증된 사용자만 게시글 작성 가능
    pass
```

게시판처럼 목록과 상세는 공개하지만, 작성·수정·삭제는 회원에게만 허용하고 싶을 때 자주 사용한다.

---

### 3.14.4 AllowAny

`AllowAny`는 모든 요청을 허용한다. 인증 여부와 관계없이 접근할 수 있다.

```python
from rest_framework.permissions import AllowAny

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    # 회원가입은 로그인하지 않은 사용자도 접근해야 한다.
    pass
```

회원가입, 로그인, 공개 게시글 조회처럼 누구나 접근해야 하는 API에 사용할 수 있다. 하지만 보호가 필요한 데이터에 적용하면 보안 문제가 생길 수 있다.

⚠️ 주의: 전역 권한을 `IsAuthenticated`로 설정한 뒤 로그인 API나 회원가입 API까지 막아버리면, 사용자는 로그인하기 위해 인증이 필요한 모순적인 상황에 빠질 수 있다. 공개되어야 하는 API에는 별도 예외가 필요하다.

---

## 3.15 IsAuthenticated 설정

강의에서는 전역 권한 설정에서 `DEFAULT_PERMISSION_CLASSES`를 활성화하는 흐름을 확인한다.

![IsAuthenticated 전역 권한 설정 활성화](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 101209.png>)

기본적으로 DRF의 권한 기본값은 `AllowAny`다. 즉, 별도로 설정하지 않으면 대부분의 view가 인증 없이도 접근 가능한 상태다. 하지만 인증 기능을 적용한 프로젝트에서는 기본 정책을 더 엄격하게 설정할 수 있다.

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

이 설정 이후에는 Token 없이 API 요청을 보내면 접근이 막힐 수 있다. 그래서 Vue나 Postman에서 요청할 때 반드시 Authorization Header를 포함해야 한다.

---

## 3.16 권한 활용하기

권한 정책이 실제로 어떻게 요청을 허용하거나 거부하는지 확인하기 위해, 강의에서는 임시로 관리자 권한을 요구하는 설정을 적용한다.

예를 들어 전체 게시글 조회 API가 관리자만 접근 가능하도록 설정되어 있다고 해보자. 이때 인증된 일반 사용자가 요청하면 어떻게 될까?

---

### 3.16.1 IsAdminUser로 임시 변경

테스트를 위해 권한 클래스를 `IsAdminUser`로 변경한다.

![테스트를 위해 IsAdminUser 권한으로 변경](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 101311.png>)

```python
from rest_framework.permissions import IsAdminUser

@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def article_list(request):
    # 관리자만 접근 가능하도록 임시 설정한다.
    pass
```

이 상태에서 일반 사용자 Token으로 요청하면 사용자는 인증되었지만 관리자 권한이 없기 때문에 요청이 거부된다.

---

### 3.16.2 403 Forbidden과 401 Unauthorized 확인

전체 게시글 조회 요청을 보낸다.

```text
GET http://127.0.0.1:8000/api/v1/articles/
```

![게시글 조회 요청에서 403 또는 401 응답 확인](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 101429.png>)

상황에 따라 응답은 달라진다.

| 상황 | 응답 |
|---|---|
| Token은 있지만 일반 사용자라 관리자 권한이 없음 | `403 Forbidden` |
| Token을 보내지 않았거나 인증 정보를 읽을 수 없음 | `401 Unauthorized` |

이 차이는 앞에서 정리한 인증과 권한의 차이와 그대로 연결된다. Token이 없어 사용자를 식별하지 못하면 `401`, 사용자는 알지만 권한이 부족하면 `403`이다.

---

### 3.16.3 IsAuthenticated로 복구

테스트가 끝나면 관리자 권한 설정을 삭제하고, 일반적인 인증 사용자 권한인 `IsAuthenticated`로 복구한다.

![IsAdminUser 삭제 후 IsAuthenticated로 복구](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 101500.png>)

```python
from rest_framework.permissions import IsAuthenticated

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def article_list(request):
    # 인증된 사용자만 접근할 수 있도록 복구한다.
    pass
```

이제 관리자 여부와 상관없이 로그인한 사용자라면 요청이 허용될 수 있다. 하지만 여전히 Token을 보내지 않으면 인증되지 않은 요청이므로 접근이 막힌다.

---

### 3.16.4 Token 없이 요청했을 때 401이 발생하는 이유

권한을 `IsAuthenticated`로 복구한 뒤에도, 게시글 전체 조회가 갑자기 동작하지 않을 수 있다. 강의에서는 정상 작동하던 게시글 조회 요청이 `401` 상태 코드를 반환하는 상황을 확인한다.

![Token 없이 게시글 조회 요청 시 401 응답](<../assets/images/06_10_Vue_with_DRF_02_Authentication_and_Permission/화면 캡처 2026-06-10 101602.png>)

이유는 단순하다. 이제 API는 인증된 사용자만 접근할 수 있도록 설정되었는데, 클라이언트가 요청에 인증 수단인 Token을 보내지 않았기 때문이다.

이때 해결 방향은 view 로직을 먼저 의심하는 것이 아니라, 요청 Header에 Token이 포함되어 있는지 확인하는 것이다.

```text
Authorization: Token 발급받은토큰값
```

Vue에서 Axios 요청을 보낼 때도 같은 원리가 적용된다.

```js
const token = localStorage.getItem('token')

axios.get('http://127.0.0.1:8000/api/v1/articles/', {
  headers: {
    Authorization: `Token ${token}`,
  },
})
```

⚠️ 주의: 권한 설정을 `IsAuthenticated`로 바꾼 순간, 단순 조회 요청도 인증이 필요한 요청이 될 수 있다. 이전에는 잘 되던 API가 갑자기 401을 반환한다면 “서버가 고장났다”보다 “이제 Token을 요구하는 구조가 되었다”를 먼저 떠올리는 것이 좋다.

📌 핵심: Permission을 엄격하게 설정할수록 Vue의 모든 API 요청에서 Token 포함 여부가 중요해진다.

---

## 4. 적용 관점에서 다시 보기

이번 강의 내용은 Vue와 DRF를 연결한 프로젝트에서 로그인 기능을 구현할 때 거의 그대로 사용된다. 핵심은 로그인 API 하나를 만드는 것이 아니라, 로그인 이후의 모든 요청 흐름을 인증 기반으로 바꾸는 것이다.

먼저 DRF 쪽에서는 모델과 serializer, view가 사용자 정보를 저장할 수 있도록 준비되어 있어야 한다. 게시글 작성 기능을 예로 들면, `Article` 모델에 `user` ForeignKey가 있어야 하고, serializer에서는 `user`를 `read_only_fields`로 지정해야 하며, view에서는 `serializer.save(user=request.user)` 형태로 작성자를 서버가 직접 저장해야 한다.

그다음 인증 정책을 설정한다. Vue와 DRF가 분리된 구조에서는 `TokenAuthentication`을 사용해 요청 Header의 Token으로 사용자를 식별할 수 있다. 이를 위해 `REST_FRAMEWORK` 설정에 Token 인증 클래스를 등록하고, `rest_framework.authtoken` 앱을 추가한 뒤 migrate를 진행한다.

회원가입과 로그인 API는 `dj-rest-auth`를 활용하면 빠르게 구성할 수 있다. `/accounts/signup/`에서 회원가입을 진행하고, `/accounts/login/`에서 로그인에 성공하면 Token이 발급된다. 이 Token은 Vue에서 저장해두었다가 인증이 필요한 API 요청마다 `Authorization: Token 토큰값` 형식으로 전송해야 한다.

Permission은 API 접근 범위를 설계하는 기준이 된다. 단순히 로그인한 사용자만 접근하면 되는 경우에는 `IsAuthenticated`, 관리자만 접근해야 하는 경우에는 `IsAdminUser`, 조회는 공개하되 작성은 로그인 사용자에게만 허용하고 싶다면 `IsAuthenticatedOrReadOnly`를 떠올리면 된다.

디버깅할 때는 `401`과 `403`을 구분해야 한다. `401`은 인증 정보가 없거나 유효하지 않은 상황이고, `403`은 인증은 되었지만 권한이 부족한 상황이다. 따라서 `401`이면 Token Header를 먼저 확인하고, `403`이면 Permission 설정과 사용자의 권한 상태를 확인하는 식으로 접근하면 된다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

이번 강의를 통해 인증과 권한이 같은 말이 아니라는 점을 분명히 구분할 수 있다. 인증은 요청자를 식별하는 과정이고, 권한은 식별된 사용자가 해당 작업을 수행할 수 있는지 판단하는 과정이다.

또한 Token 인증에서는 로그인 성공 후 발급받은 Token을 클라이언트가 직접 관리해야 한다. 서버가 사용자를 기억해주는 것이 아니라, 클라이언트가 매 요청마다 Token을 보내야 서버가 사용자를 식별할 수 있다는 흐름이 중요하다.

### 5.2 앞으로 이어지는 연결점

이번 내용은 Vue의 Pinia 상태 관리와 바로 연결된다. 로그인 성공 후 받은 Token을 Pinia store에 저장하고, 새로고침 후에도 유지하려면 localStorage와 함께 관리해야 한다. 이후 Axios 요청을 보낼 때 store의 Token 값을 읽어 Authorization Header에 자동으로 붙이는 구조로 확장할 수 있다.

또한 게시글 작성, 댓글 작성, 좋아요, 팔로우처럼 사용자와 연결되는 기능은 모두 `request.user`를 기반으로 구현된다. 따라서 DRF에서 인증된 사용자 정보를 어떻게 저장하고 활용하는지 이해하는 것이 이후 프로젝트 기능 구현의 기반이 된다.

### 5.3 더 파볼 만한 주제

이번 강의에서는 기본 TokenAuthentication과 dj-rest-auth를 중심으로 다뤘지만, 실제 서비스에서는 JWT 인증, Token 만료 처리, Refresh Token, 로그아웃 시 Token 삭제, Axios interceptor, Router Guard와 인증 상태 연동까지 함께 고려하게 된다.

또한 보안 관점에서는 Token을 localStorage에 저장할 때의 위험성, CSRF와 XSS 차이, 쿠키 기반 인증과 Token 기반 인증의 장단점도 더 깊게 살펴볼 만하다.

---

## 6. 요약 정리

📌 핵심

- 인증(Authentication)은 요청을 보낸 사용자가 누구인지 확인하는 과정이다.
- 권한(Permission)은 확인된 사용자가 해당 요청을 수행해도 되는지 판단하는 과정이다.
- DRF의 인증은 view 함수 본문이 실행되기 전에 먼저 수행된다.
- TokenAuthentication은 로그인 후 발급받은 Token을 요청 Header에 담아 사용자를 인증하는 방식이다.
- Token 인증을 사용하려면 `DEFAULT_AUTHENTICATION_CLASSES`, `rest_framework.authtoken`, migration 과정이 필요하다.
- `dj-rest-auth`는 Django 인증 기능을 REST API로 사용할 수 있게 해주는 라이브러리다.
- 회원가입과 로그인 후 발급받은 Token은 Vue 클라이언트가 저장하고 이후 요청마다 함께 보내야 한다.
- Token은 `Authorization: Token 토큰값` 형식으로 HTTP Header에 포함해야 한다.
- `read_only_fields`를 사용하면 클라이언트가 직접 수정하면 안 되는 필드를 보호할 수 있다.
- 게시글 작성자 정보는 요청 body가 아니라 `request.user`를 통해 서버가 직접 저장하는 것이 안전하다.
- `IsAuthenticated`는 로그인 사용자만, `IsAdminUser`는 관리자만, `IsAuthenticatedOrReadOnly`는 읽기는 공개하고 쓰기는 인증 사용자에게만 허용한다.
- `401 Unauthorized`는 인증 정보가 없거나 유효하지 않은 경우이고, `403 Forbidden`은 인증은 되었지만 권한이 부족한 경우다.

🧠 기억할 것

> Token 인증에서 서버는 클라이언트를 자동으로 기억하지 않는다.  
> 클라이언트가 매 요청마다 `Authorization: Token 토큰값`을 보내야 서버가 사용자를 식별할 수 있다.

> `401`이면 Token 전달 여부를 먼저 보고, `403`이면 Permission 설정과 사용자 권한을 먼저 확인한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 인증(Authentication)과 권한(Permission)의 차이를 각각 한 문장으로 설명할 수 있는가?
2. DRF에서 인증은 view 함수 실행 전과 후 중 언제 수행되는가?
3. TokenAuthentication을 사용하기 위해 `settings.py`에 추가해야 하는 인증 클래스는 무엇인가?
4. `rest_framework.authtoken`을 `INSTALLED_APPS`에 추가한 뒤 왜 migrate를 해야 하는가?
5. `dj-rest-auth`는 Django의 기본 인증 시스템을 대체하는가, 아니면 확장하는가?
6. 로그인 성공 후 발급받은 Token은 Vue에서 왜 저장해야 하는가?
7. 인증이 필요한 요청에서 `Authorization` Header의 올바른 형식은 무엇인가?
8. `serializer.save(user=request.user)`는 왜 필요한가?
9. 게시글 작성자의 user 값을 클라이언트 요청 body에서 직접 받으면 어떤 문제가 생길 수 있는가?
10. `IsAuthenticated`, `IsAdminUser`, `IsAuthenticatedOrReadOnly`, `AllowAny`의 차이를 설명할 수 있는가?
11. `401 Unauthorized`와 `403 Forbidden`을 구분해서 디버깅할 수 있는가?
12. 이전에는 잘 되던 게시글 조회 API가 `IsAuthenticated` 설정 후 401을 반환한다면 가장 먼저 무엇을 확인해야 하는가?
