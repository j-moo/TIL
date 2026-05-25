# Django DRF 2: N:1 관계와 응답 데이터 재구성

- 🎯 글의 목표: DRF에서 `Article`과 `Comment`처럼 N:1 관계를 가진 데이터를 API로 표현하고, 댓글 CRUD와 응답 데이터 재구성 흐름을 이해한다.
- 🧩 핵심 키워드: DRF, N:1 Relation, ForeignKey, CommentSerializer, read_only_fields, read_only, Nested Serializer, 역참조, comment_set, related_name, annotate, Count, SerializerMethodField, OpenAPI, Swagger, ReDoc, get_object_or_404, get_list_or_404
- ⭐ 중요도: 높음
- 📝 한눈에 보는 내용: 댓글 모델을 추가한 뒤 댓글 목록·상세 조회, 게시글에 연결된 댓글 생성, 댓글 수정·삭제를 구현한다. 이어서 댓글 응답에 게시글 제목을 포함하고, 게시글 상세 응답에는 댓글 목록과 댓글 개수를 함께 담는 방식까지 정리한다.
- 🔗 관련 문제 / 주제: Django REST Framework 관계형 API 구현, 게시글-댓글 API, Nested relationships, RESTful API 문서화, 예외 처리

---

## 1. 들어가며

이전 DRF 강의에서는 하나의 모델을 기준으로 게시글 목록 조회, 상세 조회, 생성, 수정, 삭제 API를 구현했다. 이번 강의에서는 여기서 한 단계 더 나아가 **모델 간 관계가 있는 데이터**를 API로 어떻게 표현할지 다룬다. 실제 서비스에서는 게시글만 따로 존재하는 경우보다, 게시글에 댓글이 달리고, 상품에 리뷰가 달리며, 사용자에게 주문 내역이 연결되는 식의 관계가 훨씬 더 자주 등장한다.

이번 강의의 중심 관계는 `Article`과 `Comment`이다. 하나의 게시글에는 여러 개의 댓글이 달릴 수 있고, 하나의 댓글은 반드시 하나의 게시글에 속한다. 이 관계를 Django 모델에서는 `ForeignKey`로 표현하고, DRF에서는 Serializer와 View 로직을 통해 JSON 응답 구조로 바꿔준다.

처음에는 댓글 자체를 조회하고 생성하는 API부터 만든다. 그다음 댓글 생성 과정에서 왜 `article` 필드를 클라이언트에게 직접 입력받으면 문제가 생기는지 확인하고, `read_only_fields`를 사용해 서버가 관계를 직접 주입하는 방식으로 바꾼다. 이후에는 응답 데이터를 더 읽기 좋게 만들기 위해 댓글 응답에 게시글 번호만 보여주는 대신 게시글 제목을 함께 보여주고, 반대로 게시글 상세 조회에서는 그 게시글에 달린 댓글 목록과 댓글 개수를 함께 내려주는 구조를 만든다.

따라서 이번 글은 단순히 댓글 API 코드를 나열하는 정리가 아니다. 핵심은 **관계형 데이터를 API 응답에서 어떤 구조로 보여줄 것인가**를 이해하는 데 있다.

---

## 2. 핵심 개념 정리

이번 강의는 크게 네 흐름으로 이어진다.

첫 번째는 **N:1 관계를 가진 모델 설계**이다. 댓글은 게시글에 속해야 하므로 `Comment` 모델에 `article = models.ForeignKey(Article, on_delete=models.CASCADE)`를 둔다. 이 한 줄은 댓글이 어떤 게시글의 댓글인지 연결해주는 기준이 된다.

두 번째는 **댓글 CRUD API 구현**이다. 댓글 목록 조회와 상세 조회는 기존 게시글 조회와 비슷하게 `CommentSerializer`를 통해 구현할 수 있다. 하지만 댓글 생성은 조금 다르다. 댓글은 단독으로 생성되는 데이터가 아니라 특정 게시글에 연결되어야 하므로, URL에 `article_pk`를 포함하고 View에서 해당 게시글을 먼저 조회한 뒤 `serializer.save(article=article)`처럼 저장해야 한다.

세 번째는 **읽기 전용 필드와 응답 데이터 재구성**이다. 댓글을 생성할 때 `article` 값을 클라이언트가 직접 보내지 않게 하려면 `read_only_fields`를 사용한다. 또한 댓글 응답에서 게시글 번호만 보여주는 것이 아니라 게시글 제목을 보여주고 싶다면, `article` 필드를 다른 Serializer로 재정의하고 `read_only=True`를 붙여야 한다.

네 번째는 **역참조와 추가 계산 필드**이다. 댓글은 `article` 필드로 게시글을 참조하지만, 게시글 입장에서는 자신에게 연결된 댓글들을 역으로 조회할 수 있다. 기본 역참조 이름은 `comment_set`이고, `related_name='comments'`를 지정했다면 `comments`라는 이름으로 접근한다. 여기에 댓글 개수처럼 모델에 실제로 없는 값을 응답에 추가하려면 `annotate()`와 `SerializerMethodField`를 함께 사용할 수 있다.

정리하면, 이번 강의는 다음 질문에 답하는 과정이다.

> 댓글처럼 특정 게시글에 속하는 데이터를 어떻게 생성하고, 게시글과 댓글의 관계를 JSON 응답에 어떻게 자연스럽게 표현할 것인가?

---

## 3. 본문 정리

## 3.1 DRF에서 N:1 관계를 다룬다는 것

N:1 관계는 **여러 개의 데이터가 하나의 부모 데이터에 연결되는 구조**이다. 이번 강의에서는 여러 댓글이 하나의 게시글에 연결된다. 즉, 댓글 입장에서는 게시글 하나를 참조하고, 게시글 입장에서는 여러 댓글을 가질 수 있다.

Django 모델에서는 이 관계를 `ForeignKey`로 표현한다.

```python
# articles/models.py

class Comment(models.Model):
    # 하나의 댓글은 하나의 게시글에 속한다.
    # on_delete=models.CASCADE는 게시글이 삭제되면 연결된 댓글도 함께 삭제한다는 의미이다.
    article = models.ForeignKey(Article, on_delete=models.CASCADE)

    # 댓글 본문은 최대 200자까지 저장한다.
    content = models.CharField(max_length=200)

    # 생성 시간과 수정 시간은 Django가 자동으로 관리한다.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

여기서 중요한 점은 `Comment`가 독립적으로만 존재하지 않는다는 점이다. 댓글은 반드시 어떤 게시글에 속해야 한다. 그래서 API를 만들 때도 댓글 생성 주소는 단순히 `comments/`가 아니라, 특정 게시글을 나타내는 `articles/<article_pk>/comments/` 형태로 설계하는 것이 자연스럽다.

모델을 정의한 뒤에는 데이터베이스에 반영해야 한다.

```bash
# 모델 변경 사항을 migration 파일로 만든다.
$ python manage.py makemigrations

# migration을 실제 데이터베이스에 적용한다.
$ python manage.py migrate

# 실습용 게시글과 댓글 fixture 데이터를 데이터베이스에 삽입한다.
$ python manage.py loaddata articles.json comments.json
```

이 과정에서 `makemigrations`는 “모델 설계도를 변경 기록으로 남기는 단계”이고, `migrate`는 “그 변경 기록을 실제 데이터베이스에 적용하는 단계”라고 이해하면 좋다. fixture를 불러오는 `loaddata`는 테스트용 데이터를 미리 넣어 API 응답을 확인하기 위한 준비 작업이다.

📌 핵심: N:1 관계에서는 자식 모델이 부모 모델을 `ForeignKey`로 참조하고, API 구현에서도 이 관계를 기준으로 URL과 저장 로직을 설계해야 한다.

---

## 3.2 URL과 HTTP Method 구성 먼저 보기

댓글 API를 구현하기 전에, 어떤 URL이 어떤 HTTP Method와 연결되는지 먼저 정리하면 흐름을 훨씬 쉽게 잡을 수 있다.

![alt text](<../assets/images/05_12_Django_DRF_2/화면 캡처 2026-05-25 182321.png>)

위 표에서 핵심은 **같은 자원이라도 HTTP Method에 따라 하는 일이 달라진다**는 점이다. `comments/`에 `GET` 요청을 보내면 댓글 목록을 조회하고, `comments/1/`에 `GET` 요청을 보내면 1번 댓글을 조회한다. 같은 `comments/1/` 주소라도 `PUT`이면 댓글 수정, `DELETE`이면 댓글 삭제가 된다.

댓글 생성은 조금 특별하다. 댓글은 어떤 게시글에 달리는지 알아야 하므로 `articles/1/comments/`처럼 게시글 번호가 URL에 포함된다. 이 주소는 “1번 게시글에 댓글을 작성한다”는 의미를 가진다.

| URL | Method | 의미 |
|---|---|---|
| `comments/` | `GET` | 댓글 목록 조회 |
| `comments/<comment_pk>/` | `GET` | 단일 댓글 조회 |
| `comments/<comment_pk>/` | `PUT` | 단일 댓글 수정 |
| `comments/<comment_pk>/` | `DELETE` | 단일 댓글 삭제 |
| `articles/<article_pk>/comments/` | `POST` | 특정 게시글에 댓글 생성 |

REST API를 설계할 때는 URL에 `create`, `delete`, `update` 같은 동작 이름을 계속 붙이기보다, URL은 자원을 나타내고 동작은 Method로 구분하는 쪽이 더 일관적이다.

📌 핵심: 댓글 생성은 특정 게시글과 연결되어야 하므로 `article_pk`가 포함된 URL에서 처리하고, 수정·삭제·조회는 댓글 자체의 `comment_pk`를 기준으로 처리한다.

---

## 3.3 댓글 목록 조회: `CommentSerializer`와 `many=True`

댓글 목록 조회는 여러 개의 `Comment` 객체를 JSON으로 바꾸는 작업이다. DRF에서는 모델 객체를 JSON으로 바꾸기 위해 Serializer를 사용한다.

먼저 `Comment` 모델을 기반으로 Serializer를 정의한다.

```python
# articles/serializers.py

from rest_framework import serializers
from .models import Article, Comment

class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        # Comment 모델을 기준으로 Serializer를 만든다.
        model = Comment

        # Comment 모델의 모든 필드를 응답에 포함한다.
        fields = '__all__'
```

`ModelSerializer`는 Django 모델 구조를 바탕으로 Serializer 필드를 자동으로 만들어준다. 그래서 `Comment` 모델에 `article`, `content`, `created_at`, `updated_at` 필드가 있다면, `fields = '__all__'` 설정을 통해 이 필드들이 자동으로 응답에 포함된다.

이제 댓글 목록 조회 URL을 연결한다.

```python
# articles/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # 댓글 목록 조회
    path('comments/', views.comment_list),
]
```

View 함수에서는 모든 댓글을 조회한 뒤 Serializer에 넣어 응답한다.

```python
# articles/views.py

from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Comment
from .serializers import CommentSerializer

@api_view(['GET'])
def comment_list(request):
    # 데이터베이스에 저장된 모든 댓글을 조회한다.
    comments = Comment.objects.all()

    # 여러 개의 객체를 직렬화할 때는 many=True가 필요하다.
    serializer = CommentSerializer(comments, many=True)

    # 직렬화된 데이터를 JSON 응답으로 반환한다.
    return Response(serializer.data)
```

여기서 가장 자주 놓치는 부분은 `many=True`이다. `comments`는 댓글 하나가 아니라 QuerySet, 즉 여러 댓글의 묶음이다. Serializer는 기본적으로 객체 하나를 처리한다고 생각하기 때문에, 여러 객체를 넘길 때는 반드시 `many=True`를 지정해야 한다.

⚠️ 주의: 원본 필기에는 `CommentSerialzier`처럼 철자가 섞인 형태가 보이는데, 실제 코드에서는 `CommentSerializer`로 정확히 맞춰야 한다. Serializer 클래스명은 import와 사용 위치의 철자가 하나라도 다르면 바로 에러가 난다.

📌 핵심: 목록 조회에서는 QuerySet을 Serializer에 넘기므로 `many=True`가 필요하다.

---

## 3.4 단일 댓글 조회: URL의 `comment_pk`로 하나만 가져오기

단일 댓글 조회는 댓글 목록 조회와 구조가 비슷하지만, 조회 대상이 여러 개가 아니라 하나이다. 따라서 URL에 댓글의 pk 값을 포함한다.

```python
# articles/urls.py

urlpatterns = [
    # 단일 댓글 조회
    path('comments/<int:comment_pk>/', views.comment_detail),
]
```

View에서는 URL에서 받은 `comment_pk`를 사용해 특정 댓글 하나를 조회한다.

```python
# articles/views.py

@api_view(['GET'])
def comment_detail(request, comment_pk):
    # URL로 전달된 comment_pk에 해당하는 댓글 하나를 조회한다.
    comment = Comment.objects.get(pk=comment_pk)

    # 단일 객체이므로 many=True를 사용하지 않는다.
    serializer = CommentSerializer(comment)

    # 직렬화된 댓글 데이터를 응답한다.
    return Response(serializer.data)
```

목록 조회와 단일 조회의 차이는 Serializer에 들어가는 데이터 형태이다. 목록 조회에서는 QuerySet이 들어가고, 단일 조회에서는 모델 인스턴스 하나가 들어간다. 그래서 목록 조회에는 `many=True`가 필요하고, 단일 조회에는 필요하지 않다.

다만 이 코드에는 아직 보완할 점이 있다. 존재하지 않는 `comment_pk`로 요청하면 `Comment.objects.get()`에서 예외가 발생하고, 적절한 404 응답이 아니라 서버 오류처럼 보일 수 있다. 이 문제는 뒤에서 `get_object_or_404()`로 개선한다.

📌 핵심: 단일 조회는 URL의 pk로 객체 하나를 찾고, Serializer에는 모델 인스턴스 하나를 그대로 넘긴다.

---

## 3.5 댓글 생성: 특정 게시글에 댓글 연결하기

댓글 생성은 이번 강의에서 가장 중요한 흐름 중 하나이다. 댓글은 반드시 특정 게시글에 속해야 하므로, 먼저 URL에서 어떤 게시글의 댓글인지 확인해야 한다.

```python
# articles/urls.py

urlpatterns = [
    # 특정 게시글에 댓글 생성
    path('articles/<int:article_pk>/comments/', views.comment_create),
]
```

이 URL은 “`article_pk`번 게시글에 댓글을 생성한다”는 의미이다. 따라서 View 함수에서는 먼저 해당 게시글을 조회하고, 그 게시글을 댓글 저장 시 함께 넣어준다.

```python
# articles/views.py

from rest_framework import status
from .models import Article, Comment
from .serializers import CommentSerializer

@api_view(['POST'])
def comment_create(request, article_pk):
    # URL에 담긴 article_pk로 댓글이 달릴 게시글을 먼저 찾는다.
    article = Article.objects.get(pk=article_pk)

    # 클라이언트가 보낸 댓글 내용은 request.data에 들어 있다.
    serializer = CommentSerializer(data=request.data)

    # 데이터가 유효한지 검사한다.
    # raise_exception=True를 쓰면 유효하지 않을 때 자동으로 400 응답을 반환한다.
    if serializer.is_valid(raise_exception=True):
        # 댓글 내용은 클라이언트가 보내지만,
        # 어떤 게시글에 속하는지는 서버가 URL의 article_pk를 바탕으로 직접 주입한다.
        serializer.save(article=article)

        # 새 댓글이 생성되었으므로 201 CREATED 상태 코드를 반환한다.
        return Response(serializer.data, status=status.HTTP_201_CREATED)
```

이 코드에서 가장 중요한 줄은 `serializer.save(article=article)`이다. Serializer를 저장할 때 추가 데이터를 함께 넘기면, 클라이언트가 보낸 데이터에는 없더라도 서버가 필요한 값을 직접 채워 넣을 수 있다.

![alt text](<../assets/images/05_12_Django_DRF_2/화면 캡처 2026-05-25 183704.png>)

위 캡처는 댓글 생성 View에서 `article = Article.objects.get(pk=article_pk)`로 게시글을 찾고, `serializer.save(article=article)`로 댓글과 게시글을 연결하는 흐름을 보여준다. 즉, 댓글 작성 요청의 본문에는 댓글 내용만 들어가고, 게시글 정보는 URL과 서버 로직을 통해 결정된다.

그런데 이 상태로 POST 요청을 보내면 처음에는 400 응답이 발생할 수 있다. 이유는 `CommentSerializer`가 `fields = '__all__'`로 되어 있기 때문에 `article` 필드도 클라이언트가 입력해야 하는 값으로 판단하기 때문이다. 하지만 우리는 `article` 값을 클라이언트에게 직접 받지 않고, View에서 `serializer.save(article=article)`로 넣어주려고 한다.

이 문제를 해결하려면 `article` 필드를 읽기 전용으로 지정해야 한다.

```python
# articles/serializers.py

class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = '__all__'

        # article은 클라이언트가 직접 입력하는 값이 아니라,
        # URL의 article_pk를 바탕으로 서버가 주입하는 값이다.
        # 따라서 유효성 검사 입력 대상에서 제외하고 응답에는 포함되도록 한다.
        read_only_fields = ('article',)
```

`read_only_fields`를 지정하면 `article` 필드는 입력 검증 대상에서 빠진다. 대신 응답 데이터에는 그대로 포함될 수 있다. 그래서 클라이언트는 댓글 내용만 보내고, 서버는 URL의 게시글 번호를 기준으로 관계를 완성한다.

⚠️ 주의: 댓글 생성 API에서 `article` 값을 요청 body로 직접 받게 만들면 클라이언트가 임의의 게시글 번호를 넣을 수 있다. URL로 이미 게시글이 정해져 있다면, 관계 필드는 서버에서 주입하는 방식이 더 명확하다.

📌 핵심: 댓글 생성에서는 `article_pk`로 게시글을 먼저 찾고, `serializer.save(article=article)`로 댓글과 게시글을 연결한다.

---

## 3.6 읽기 전용 필드: `read_only_fields`를 왜 쓰는가

읽기 전용 필드는 **서버가 응답할 때는 보여주지만, 클라이언트 입력으로는 받지 않는 필드**이다. 댓글 생성에서 `article` 필드가 대표적인 예이다.

`article`은 댓글에 반드시 필요한 값이다. 하지만 이 값을 클라이언트가 body에 직접 넣는 것이 아니라, URL의 `article_pk`를 바탕으로 서버가 결정한다. 이런 경우 Serializer에서 `article`을 일반 입력 필드로 남겨두면 DRF는 “article 값이 빠졌다”고 판단해 400 에러를 반환한다.

```python
class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = '__all__'
        read_only_fields = ('article',)
```

`read_only_fields`를 사용하면 다음 효과가 있다.

| 특징 | 의미 |
|---|---|
| 유효성 검사에서 제외 | 클라이언트가 보내야 하는 필드로 보지 않는다. |
| 응답에는 포함 가능 | 서버가 가진 값은 JSON 응답에 표시할 수 있다. |
| 생성·수정 요청 모두에 적용 | POST뿐 아니라 PUT 요청에서도 클라이언트 입력으로 받지 않는다. |
| 서버 로직과 잘 맞음 | View에서 `save(article=article)`처럼 값을 직접 주입할 수 있다. |

쉽게 말하면, `read_only_fields`는 “이 필드는 사용자가 직접 쓰는 값이 아니라 서버가 관리하는 값”이라고 Serializer에게 알려주는 장치이다.

⚠️ 주의: `read_only_fields`는 기존 모델 필드를 그대로 응답에 보여주되 입력만 막고 싶을 때 잘 맞는다. 하지만 뒤에서처럼 필드를 새 Serializer로 재정의하는 경우에는 `read_only_fields`가 아니라 필드 선언부에 직접 `read_only=True`를 붙여야 한다.

📌 핵심: View에서 직접 넣어줄 필드라면 Serializer의 유효성 검사 입력 대상에서 제외하기 위해 `read_only_fields`를 사용한다.

---

## 3.7 댓글 수정과 삭제: 하나의 Detail View에서 Method로 분기하기

단일 댓글을 조회하는 URL은 수정과 삭제에도 함께 사용할 수 있다. 같은 댓글 자원에 대해 `GET`, `PUT`, `DELETE` 요청이 들어올 수 있기 때문이다.

```python
# articles/views.py

from rest_framework import status

@api_view(['GET', 'PUT', 'DELETE'])
def comment_detail(request, comment_pk):
    # 수정, 삭제, 조회 모두 먼저 대상 댓글을 찾아야 한다.
    comment = Comment.objects.get(pk=comment_pk)

    if request.method == 'GET':
        # 단일 댓글 조회
        serializer = CommentSerializer(comment)
        return Response(serializer.data)

    elif request.method == 'PUT':
        # 기존 comment 인스턴스에 request.data를 덮어써 수정한다.
        serializer = CommentSerializer(comment, data=request.data)

        # 수정 데이터가 유효한지 검사한다.
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data)

    elif request.method == 'DELETE':
        # 대상 댓글을 삭제한다.
        comment.delete()

        # 삭제 성공 시 응답 본문 없이 204 상태 코드를 반환한다.
        return Response(status=status.HTTP_204_NO_CONTENT)
```

이 구조에서 중요한 점은 `PUT` 요청에서 Serializer를 만드는 방식이다.

```python
serializer = CommentSerializer(comment, data=request.data)
```

첫 번째 인자로 기존 객체 `comment`를 넣고, 두 번째로 새 데이터 `request.data`를 넣는다. 이렇게 해야 DRF가 “새로 만드는 것”이 아니라 “기존 객체를 수정하는 것”으로 이해한다. 만약 기존 객체 없이 `CommentSerializer(data=request.data)`만 사용하면 생성 요청처럼 처리된다.

삭제 요청은 데이터를 반환할 필요가 없으므로 일반적으로 `204 No Content`를 사용한다. 이 상태 코드는 요청이 성공했지만 응답 본문은 없다는 뜻이다.

⚠️ 주의: 수정 요청에서도 `article`을 바꾸게 할 필요가 없다면 `read_only_fields = ('article',)` 설정이 그대로 도움이 된다. 댓글 내용은 수정하되, 댓글이 어느 게시글에 속하는지는 클라이언트가 마음대로 바꾸지 못하게 막을 수 있다.

📌 핵심: 단일 댓글 URL 하나에서 `GET`, `PUT`, `DELETE`를 Method로 구분하면 조회·수정·삭제를 일관된 구조로 처리할 수 있다.

---

## 3.8 댓글 응답에 게시글 제목 포함하기

기본적으로 댓글 Serializer에서 `article` 필드는 게시글의 pk 값으로 표현된다. 예를 들어 댓글 목록을 조회하면 `article: 2`처럼 게시글 번호만 보일 수 있다. 하지만 API를 사용하는 입장에서는 번호만으로는 어떤 게시글인지 직관적으로 알기 어렵다. 그래서 댓글 응답에 게시글의 제목을 함께 보여주는 방식으로 응답 구조를 바꿀 수 있다.

![alt text](<../assets/images/05_12_Django_DRF_2/화면 캡처 2026-05-25 214857.png>)

위 캡처는 댓글 목록 응답에서 `article`이 단순 숫자에서 게시글 제목 정보를 포함한 객체 형태로 바뀌는 흐름을 보여준다. 왼쪽처럼 `article: 2`만 있으면 게시글의 실제 제목을 알기 어렵지만, 오른쪽처럼 `article: { "title": ... }` 형태로 내려주면 응답이 더 설명적이 된다.

이 작업은 Serializer에서 처리한다. Serializer는 DRF에서 응답 구조를 결정하는 주체이기 때문이다. 먼저 게시글의 제목만 표현하는 Serializer를 만든다.

```python
# articles/serializers.py

class CommentSerializer(serializers.ModelSerializer):
    # CommentSerializer 안에서만 사용할 Serializer라면 내부 클래스로 정의할 수 있다.
    class ArticleTitleSerializer(serializers.ModelSerializer):
        class Meta:
            model = Article
            fields = ('title',)

    # 기존 article 필드를 게시글 pk가 아니라 title만 가진 객체로 재정의한다.
    # 재정의한 필드는 read_only_fields가 아니라 read_only=True를 직접 붙여야 한다.
    article = ArticleTitleSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = '__all__'
```

여기서 `ArticleTitleSerializer`를 `CommentSerializer` 안에 넣은 이유는 사용 범위를 분명하게 하기 위해서이다. 이 Serializer가 댓글 응답에서 게시글 제목을 보여주는 용도로만 사용된다면, 독립 클래스로 밖에 두는 것보다 내부 클래스로 두는 편이 응집도가 높다.

이제 댓글의 `article` 필드는 단순 pk 값이 아니라 다음처럼 표현될 수 있다.

```json
{
  "id": 1,
  "article": {
    "title": "게시글 제목"
  },
  "content": "댓글 내용",
  "created_at": "...",
  "updated_at": "..."
}
```

이때 꼭 기억해야 할 차이가 있다.

| 구분 | 사용하는 상황 |
|---|---|
| `read_only_fields` | 기존 모델 필드를 그대로 응답에 보여주되, 입력만 막고 싶을 때 |
| `read_only=True` | 필드를 직접 재정의했거나, 새롭게 만든 응답 필드일 때 |

`article = ArticleTitleSerializer(read_only=True)`처럼 필드를 직접 재정의하면, `Meta` 안의 `read_only_fields`만으로는 충분하지 않다. 필드 선언부에 직접 `read_only=True`를 붙여야 한다.

⚠️ 주의: 관계 필드를 다른 Serializer로 덮어쓰면 응답 구조는 좋아지지만, 생성·수정 입력으로는 사용할 수 없도록 읽기 전용 처리를 명확히 해야 한다.

📌 핵심: 댓글 응답에서 게시글 번호 대신 제목을 보여주고 싶다면, `article` 필드를 별도 Serializer로 재정의하고 `read_only=True`를 붙인다.

---

## 3.9 역참조: 게시글에서 댓글 목록 가져오기

지금까지는 댓글이 게시글을 참조하는 방향을 다뤘다. 하지만 실제 API에서는 반대 방향도 자주 필요하다. 예를 들어 게시글 상세 조회를 할 때, 그 게시글에 달린 댓글 목록을 함께 보여주고 싶을 수 있다.

이때 사용하는 개념이 **역참조**이다. 댓글 모델에는 `article = ForeignKey(...)`가 있으므로 댓글에서 게시글로 접근할 수 있다. 반대로 게시글에서 자신을 참조하는 댓글들을 가져오는 것도 가능하다. Django는 이를 위해 기본적으로 `comment_set`이라는 역참조 매니저를 제공한다.

단일 게시글 조회 응답에 댓글 목록을 포함하려면 `ArticleSerializer` 안에 댓글용 Serializer를 중첩해서 정의할 수 있다.

```python
# articles/serializers.py

class ArticleSerializer(serializers.ModelSerializer):
    # 게시글 상세 응답 안에 포함할 댓글 정보만 따로 정의한다.
    class CommentDetailSerializer(serializers.ModelSerializer):
        class Meta:
            model = Comment
            fields = ('id', 'content',)

    # Article -> Comment 방향의 역참조 필드이다.
    # ForeignKey에 related_name을 따로 지정하지 않았다면 기본 이름은 comment_set이다.
    comment_set = CommentDetailSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = '__all__'
```

여기서 `many=True`가 다시 등장한다. 하나의 게시글에는 댓글이 여러 개 달릴 수 있으므로, `comment_set`은 댓글 하나가 아니라 댓글 목록이다. 따라서 중첩 Serializer에도 `many=True`가 필요하다.

응답 구조는 대략 다음처럼 된다.

```json
{
  "id": 1,
  "title": "게시글 제목",
  "content": "게시글 내용",
  "comment_set": [
    {
      "id": 1,
      "content": "첫 번째 댓글"
    },
    {
      "id": 2,
      "content": "두 번째 댓글"
    }
  ]
}
```

이 구조의 장점은 게시글 상세 페이지를 만들 때 별도로 댓글 목록 API를 한 번 더 호출하지 않아도 된다는 점이다. 게시글 상세 응답 안에 필요한 댓글 정보가 함께 들어 있기 때문이다.

⚠️ 주의: 기본 역참조 이름은 `comment_set`이지만, `ForeignKey`에 `related_name`을 지정했다면 이름이 달라진다. 이 이름이 Serializer 필드명과 정확히 맞아야 한다.

📌 핵심: 게시글에서 댓글 목록을 함께 응답하려면 역참조 매니저를 Serializer 필드로 선언하고, 댓글은 여러 개이므로 `many=True`를 사용한다.

---

## 3.10 `related_name`을 지정했을 때 Serializer도 함께 바꾸기

Django의 기본 역참조 이름인 `comment_set`은 동작에는 문제가 없지만, API 응답 필드명으로 보기에는 조금 어색할 수 있다. 그래서 모델의 `ForeignKey`에 `related_name`을 지정해 역참조 이름을 바꿀 수 있다.

![alt text](<../assets/images/05_12_Django_DRF_2/화면 캡처 2026-05-25 222923.png>)

위 캡처에서는 `Comment` 모델의 `article` 필드에 `related_name='comments'`를 지정하고 있다. 이렇게 하면 게시글에서 댓글 목록에 접근할 때 `article.comment_set`이 아니라 `article.comments`를 사용할 수 있다. Serializer에서도 이에 맞춰 필드명을 `comments`로 작성해야 한다.

```python
# articles/models.py

class Comment(models.Model):
    # related_name을 지정하면 Article에서 역참조할 때 comments라는 이름을 사용한다.
    article = models.ForeignKey(
        Article,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    content = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

모델에서 역참조 이름을 `comments`로 바꾸었다면, ArticleSerializer도 다음처럼 바뀐다.

```python
# articles/serializers.py

class ArticleSerializer(serializers.ModelSerializer):
    class CommentDetailSerializer(serializers.ModelSerializer):
        class Meta:
            model = Comment
            fields = ('id', 'content',)

    # related_name='comments'를 사용했다면 필드명도 comments로 맞춘다.
    comments = CommentDetailSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = '__all__'
```

이렇게 하면 응답도 `comment_set`이 아니라 `comments`라는 더 자연스러운 이름으로 내려간다.

```json
{
  "id": 2,
  "comments": [
    {
      "id": 14,
      "content": "댓글 내용"
    }
  ]
}
```

![alt text](<../assets/images/05_12_Django_DRF_2/화면 캡처 2026-05-25 222950.png>)

위 캡처는 `related_name='comments'`를 지정했을 때, 댓글 수 계산에서도 `Count('comments')`처럼 바뀐 역참조 이름을 사용해야 한다는 점을 보여준다. 즉, 모델에서 관계 이름을 바꾸면 Serializer와 ORM 집계 코드도 함께 맞춰야 한다.

| 모델 설정 | 게시글에서 댓글 접근 | Serializer 필드명 | 댓글 수 Count 기준 |
|---|---|---|---|
| `related_name` 없음 | `comment_set` | `comment_set` | `Count('comment')` |
| `related_name='comments'` | `comments` | `comments` | `Count('comments')` |

⚠️ 주의: `related_name`을 바꿨는데 Serializer에는 여전히 `comment_set`을 쓰거나, `annotate()`에는 예전 이름을 쓰면 원하는 데이터가 응답에 포함되지 않거나 오류가 발생할 수 있다.

📌 핵심: 역참조 이름을 바꾸면 모델, Serializer, annotate 기준 이름을 모두 같은 이름으로 맞춰야 한다.

---

## 3.11 게시글 상세 응답에 댓글 개수 포함하기

게시글 상세 조회에서 댓글 목록뿐 아니라 댓글 개수도 함께 보여주고 싶을 수 있다. 예를 들어 프론트엔드에서 “댓글 3개” 같은 표시를 하려면 댓글 개수 정보가 필요하다.

문제는 `Article` 모델 안에 `num_of_comments`라는 실제 필드가 없다는 점이다. 댓글 개수는 데이터베이스에 저장된 고정 값이 아니라, 현재 연결된 댓글을 세어서 계산해야 하는 값이다.

이럴 때 View에서 `annotate()`를 사용할 수 있다.

```python
# articles/views.py

from django.db.models import Count

@api_view(['GET', 'DELETE', 'PUT'])
def article_detail(request, article_pk):
    # related_name을 따로 지정하지 않았다면 Count('comment')를 사용할 수 있다.
    # related_name='comments'를 지정했다면 Count('comments')로 맞춰야 한다.
    article = Article.objects.annotate(
        num_of_comments=Count('comment')
    ).get(pk=article_pk)
```

`annotate()`는 Django ORM에서 쿼리 결과에 임시 계산 필드를 붙이는 기능이다. 위 코드에서는 각 게시글에 연결된 댓글 수를 세고, 그 값을 `num_of_comments`라는 이름으로 붙인다.

다만 여기서 한 가지 중요한 문제가 있다. `annotate()`로 붙인 값은 실제 모델 필드가 아니다. 즉, `Article` 모델 클래스에 `num_of_comments`라는 필드를 새로 만든 것이 아니라, 조회한 객체에만 임시로 붙은 값이다.

그래서 Serializer에서 단순히 `fields = '__all__'`만 사용하면 `num_of_comments`는 자동으로 포함되지 않는다. `__all__`은 실제 모델 필드 기준으로 동작하기 때문이다.

이런 동적 계산 필드를 응답에 포함하려면 `SerializerMethodField`를 사용한다.

```python
# articles/serializers.py

class ArticleSerializer(serializers.ModelSerializer):
    class CommentDetailSerializer(serializers.ModelSerializer):
        class Meta:
            model = Comment
            fields = ('id', 'content',)

    # 댓글 목록을 함께 응답한다.
    comment_set = CommentDetailSerializer(many=True, read_only=True)

    # 모델에 실제로 없는 계산 필드를 응답에 추가한다.
    num_of_comments = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = '__all__'

    def get_num_of_comments(self, obj):
        # obj는 현재 직렬화 중인 Article 인스턴스이다.
        # View에서 annotate로 붙여둔 num_of_comments 값을 꺼내 응답에 넣는다.
        return obj.num_of_comments
```

이제 `serializer.data`를 반환하면 `get_num_of_comments()` 메서드가 자동으로 실행되고, 그 반환값이 `num_of_comments` 필드에 들어간다.

만약 `related_name='comments'`를 사용한 상태라면 View는 다음처럼 작성하는 편이 자연스럽다.

```python
# articles/views.py

from django.db.models import Count
from django.shortcuts import get_object_or_404

@api_view(['GET', 'DELETE', 'PUT'])
def article_detail(request, article_pk):
    # related_name='comments'에 맞춰 Count 기준도 comments로 사용한다.
    article = get_object_or_404(
        Article.objects.annotate(num_of_comments=Count('comments')),
        pk=article_pk,
    )

    if request.method == 'GET':
        serializer = ArticleSerializer(article)
        return Response(serializer.data)
```

이 구조에서 View와 Serializer의 역할은 분명히 나뉜다. View는 어떤 데이터를 가져오고 어떤 계산을 붙일지 결정한다. Serializer는 그 결과를 어떤 JSON 구조로 보여줄지 결정한다.

⚠️ 주의: 원본 필기에는 `SerializerMethodFeild`, `ArtricleSerializer`처럼 오탈자가 섞인 부분이 있다. 실제 코드에서는 반드시 `SerializerMethodField`, `ArticleSerializer`로 작성해야 한다.

📌 핵심: 모델에 실제로 없는 계산 값을 응답에 포함하려면 View에서 `annotate()`로 값을 붙이고, Serializer에서 `SerializerMethodField`로 꺼내 보여준다.

---

## 3.12 `SerializerMethodField`의 동작 원리

`SerializerMethodField`는 Serializer에서 추가적인 데이터를 가공해 응답에 넣고 싶을 때 사용한다. 예를 들어 댓글 개수, 평균 점수, 이름 조합, 특정 조건에 따른 상태값처럼 모델 필드만으로 바로 표현하기 어려운 값을 만들 때 활용할 수 있다.

기본 구조는 다음과 같다.

```python
class ArticleSerializer(serializers.ModelSerializer):
    # 응답에 num_of_comments라는 읽기 전용 필드를 추가한다.
    num_of_comments = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = '__all__'

    def get_num_of_comments(self, obj):
        # DRF는 필드명 앞에 get_을 붙인 메서드를 자동으로 찾는다.
        # num_of_comments 필드라면 get_num_of_comments 메서드를 찾는다.
        return obj.num_of_comments
```

동작 순서는 다음과 같다.

1. Serializer가 `num_of_comments = serializers.SerializerMethodField()` 필드를 발견한다.
2. DRF는 `get_num_of_comments(self, obj)`라는 메서드를 찾는다.
3. 현재 직렬화 중인 객체가 `obj`로 전달된다.
4. 메서드의 반환값이 최종 JSON 응답의 `num_of_comments` 값으로 들어간다.

여기서 `obj`는 현재 Serializer가 처리 중인 모델 인스턴스이다. 게시글 하나를 직렬화하고 있다면 `obj`는 Article 객체 하나이고, 게시글 목록을 직렬화하고 있다면 각 Article 객체가 차례대로 `obj`로 들어간다.

`SerializerMethodField`는 읽기 전용이다. 즉, POST나 PUT 요청에서 클라이언트가 이 필드 값을 보내도 그것을 입력값으로 사용하지 않는다. 응답을 만들 때 계산해서 보여주는 용도에 가깝다.

| 사용 목적 | 예시 |
|---|---|
| 계산 값 추가 | 댓글 개수, 평균 점수, 총합 |
| 필드 조합 | 이름과 성을 합친 `full_name` |
| 조건 판단 | 좋아요 여부, 권한 여부 |
| 응답 가공 | 특정 형식의 문자열 또는 요약 정보 |

⚠️ 주의: 메서드 이름은 반드시 `get_<필드명>` 형태여야 한다. 필드가 `num_of_comments`라면 메서드는 `get_num_of_comments`여야 한다. 이름이 다르면 DRF가 메서드를 찾지 못한다.

📌 핵심: `SerializerMethodField`는 모델에 없는 읽기 전용 응답 필드를 만들고, `get_<필드명>` 메서드의 반환값으로 JSON 값을 채운다.

---

## 3.13 API 문서화: OpenAPI, Swagger, ReDoc

API는 만드는 사람만 이해하면 끝나는 것이 아니다. 프론트엔드 개발자, 모바일 앱 개발자, 다른 서버 개발자, 혹은 미래의 내가 다시 사용할 수 있어야 한다. 그래서 API가 어떤 URL을 제공하고, 어떤 Method를 지원하고, 어떤 요청과 응답 형식을 가지는지 문서화하는 것이 중요하다.

OpenAPI Specification, 줄여서 OAS는 RESTful API를 설명하고 시각화하는 표준화된 방법이다. 쉽게 말해 API에 대한 세부사항을 기술할 수 있는 공식 표준이다.

![alt text](<../assets/images/05_12_Django_DRF_2/화면 캡처 2026-05-25 223153.png>)

위 이미지에 나온 Swagger와 ReDoc은 OAS 기반 API 문서를 보기 좋게 만들어주는 대표적인 도구이다. Swagger UI는 API를 문서로 보는 것뿐 아니라 직접 요청을 보내 테스트해볼 수 있는 화면을 제공한다. ReDoc은 API 구조를 문서처럼 읽기 좋게 표현하는 데 강점이 있다.

OAS의 중요한 장점 중 하나는 **설계 우선 접근법**이다. 이는 코드를 먼저 막 작성한 뒤 나중에 문서를 맞추는 방식이 아니라, API의 명세와 구조를 먼저 설계하고 그 기준에 따라 구현하는 방식이다.

이 접근이 중요한 이유는 API가 여러 클라이언트와 연결되기 때문이다. 프론트엔드 개발자는 백엔드 코드 내부를 보지 않아도 API 문서만 보고 어떤 요청을 보내야 하는지 알아야 한다. API 문서가 잘 되어 있으면 협업이 쉬워지고, 테스트도 명확해진다.

📌 핵심: OpenAPI는 REST API를 표준 형식으로 설명하는 방법이고, Swagger와 ReDoc은 이 명세를 사람이 보기 좋게 시각화하는 도구이다.

---

## 3.14 올바르게 404 응답하기: `get_object_or_404()`

지금까지의 코드에서는 객체를 조회할 때 `Article.objects.get()` 또는 `Comment.objects.get()`을 사용했다. 이 방식은 객체가 존재할 때는 문제가 없지만, 존재하지 않는 pk로 요청하면 예외가 발생한다. API를 사용하는 클라이언트 입장에서는 “해당 데이터가 없다”는 사실을 명확히 받아야 하는데, 서버 오류처럼 보이면 원인을 오해할 수 있다.

Django는 이를 위해 shortcut function을 제공한다.

- `render()`
- `redirect()`
- `get_object_or_404()`
- `get_list_or_404()`

`get_object_or_404()`는 내부적으로 `objects.get()`을 호출하지만, 객체가 없을 때 `DoesNotExist` 예외 대신 `Http404`를 발생시킨다. DRF에서는 이를 적절한 404 응답으로 처리할 수 있다.

![alt text](<../assets/images/05_12_Django_DRF_2/화면 캡처 2026-05-25 223739.png>)

위 캡처는 기존 방식과 `get_object_or_404()` 적용 방식을 비교한다. 기존에는 조회 대상이 없을 경우 500 서버 에러처럼 보일 수 있지만, `get_object_or_404()`를 사용하면 “해당 리소스가 없다”는 의미의 404 응답을 반환할 수 있다.

```python
# articles/views.py

from django.shortcuts import get_object_or_404

@api_view(['GET', 'PUT', 'DELETE'])
def comment_detail(request, comment_pk):
    # 해당 pk의 댓글이 없으면 자동으로 404 응답을 발생시킨다.
    comment = get_object_or_404(Comment, pk=comment_pk)

    if request.method == 'GET':
        serializer = CommentSerializer(comment)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = CommentSerializer(comment, data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data)

    elif request.method == 'DELETE':
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

`get_object_or_404()`를 사용하면 코드의 의도가 더 분명해진다. 이 API는 특정 댓글 하나를 대상으로 하므로, 해당 댓글이 없으면 404가 맞다. 클라이언트도 서버 오류가 아니라 “요청한 댓글이 존재하지 않는다”고 이해할 수 있다.

📌 핵심: 단일 객체 조회에서 대상이 없을 수 있다면 `get_object_or_404()`를 사용해 명확한 404 응답을 반환하는 것이 좋다.

---

## 3.15 목록 조회에서의 404: `get_list_or_404()`

`get_list_or_404()`는 `filter()` 결과를 반환하되, 조건에 맞는 객체 목록이 하나도 없으면 404를 발생시킨다. 단일 객체용 `get_object_or_404()`와 비슷하지만, 여러 객체 조회에 사용한다는 점이 다르다.

![alt text](<../assets/images/05_12_Django_DRF_2/화면 캡처 2026-05-25 223916.png>)

위 캡처는 기존 목록 조회 방식과 `get_list_or_404()` 적용 방식을 비교한다. 기존 방식에서는 조회 결과가 없어도 빈 리스트와 200 OK가 반환될 수 있다. 반면 `get_list_or_404()`를 사용하면 조회 대상이 없을 때 404 Not Found를 반환할 수 있다.

```python
# articles/views.py

from django.shortcuts import get_list_or_404

@api_view(['GET'])
def comment_list(request):
    # 댓글 목록이 하나도 없으면 404 응답을 발생시킨다.
    comments = get_list_or_404(Comment)

    serializer = CommentSerializer(comments, many=True)
    return Response(serializer.data)
```

다만 목록 조회에서 항상 404가 정답인 것은 아니다. 예를 들어 “전체 댓글 목록” API에서 댓글이 하나도 없는 상황은 정상적인 빈 결과로 보고 `200 OK`와 `[]`를 반환해도 된다. 반대로 “특정 조건에 반드시 존재해야 하는 목록”을 조회하는 API라면 404가 더 명확할 수 있다.

강의에서 중요한 포인트는 단순히 `get_list_or_404()`를 무조건 쓰라는 것이 아니라, **클라이언트가 상황을 정확히 이해할 수 있는 응답을 설계해야 한다**는 것이다.

⚠️ 주의: 목록 조회에서 빈 배열 `[]`을 반환할지, 404를 반환할지는 API 설계 의도에 따라 달라질 수 있다. 중요한 것은 일관성이다.

📌 핵심: `get_list_or_404()`는 목록 조회 결과가 없을 때 404로 응답하고 싶을 때 사용하는 shortcut function이다.

---

## 3.16 View와 Serializer의 역할 나누기

DRF를 사용하다 보면 “이 로직을 View에 써야 할까, Serializer에 써야 할까?”라는 고민이 생긴다. 이번 강의에서 `annotate()`와 `SerializerMethodField`를 함께 쓰는 이유도 이 역할 분리와 연결된다.

일반적으로 View는 다음 역할에 집중한다.

- 어떤 모델 데이터를 조회할지 결정한다.
- 어떤 조건으로 필터링할지 결정한다.
- 필요한 경우 `annotate()`, `select_related()`, `prefetch_related()` 등으로 쿼리를 최적화하거나 가공한다.
- 요청 Method에 따라 생성, 수정, 삭제 흐름을 분기한다.

Serializer는 다음 역할에 집중한다.

- 모델 인스턴스를 JSON으로 변환한다.
- 요청 데이터를 검증한다.
- 응답에 어떤 필드를 포함할지 결정한다.
- 필드를 어떤 구조로 보여줄지 결정한다.
- `SerializerMethodField`로 응답용 계산 값을 표현한다.

예를 들어 댓글 개수를 응답에 포함하는 경우, 댓글 개수를 세는 쿼리 자체는 View에서 `annotate()`로 처리한다. 그리고 Serializer는 그 결과를 `num_of_comments`라는 응답 필드로 보여준다. 이렇게 나누면 View와 Serializer가 서로의 책임을 침범하지 않는다.

```python
# articles/views.py
# 데이터 조회와 계산 필드 추가는 View에서 처리한다.
article = Article.objects.annotate(
    num_of_comments=Count('comment')
).get(pk=article_pk)
```

```python
# articles/serializers.py
# 계산된 값을 어떤 응답 필드로 보여줄지는 Serializer에서 처리한다.
num_of_comments = serializers.SerializerMethodField()

def get_num_of_comments(self, obj):
    return obj.num_of_comments
```

복잡한 쿼리나 집계가 필요한 경우 View에서 처리하고, Serializer는 직렬화와 응답 구조에 집중시키는 것이 일반적으로 유지보수에 좋다.

📌 핵심: View는 데이터 조회와 비즈니스 흐름을 담당하고, Serializer는 데이터 검증과 응답 구조 표현을 담당한다.

---

## 3.17 DRF를 배우는 이유

DRF를 배우는 이유는 단순히 Django에서 JSON을 반환하는 법을 익히기 위해서만은 아니다. 더 큰 관점에서는 **백엔드와 프론트엔드를 분리하는 구조**를 이해하기 위해서이다.

기존 Django 템플릿 방식에서는 서버가 HTML을 만들어 브라우저에 전달했다. 즉, 백엔드가 데이터 처리와 화면 렌더링을 함께 담당했다. 하지만 DRF를 사용하면 Django는 데이터와 로직을 API로 제공하고, 화면은 JavaScript나 Vue 같은 프론트엔드가 구성할 수 있다.

이 구조는 실제 서비스 개발에서 매우 중요하다.

| 학습 이유 | 의미 |
|---|---|
| 백엔드와 프론트엔드 분리 경험 | Django는 데이터 API를 제공하고, 화면은 프론트엔드가 담당하는 구조를 이해한다. |
| 표준화된 API 구축 역량 | RESTful API를 만들고 관리하는 방법을 익힌다. |
| 다양한 클라이언트와 연동 | 웹, 모바일 앱, 외부 서비스가 같은 API를 사용할 수 있다. |
| Vue 학습과 연결 | Vue는 주로 API를 통해 데이터를 받아 화면을 구성하므로 DRF와 자연스럽게 이어진다. |

이번 강의에서 다룬 게시글-댓글 API는 이후 Vue 같은 프론트엔드 프레임워크와 연결될 때 더 의미가 커진다. 프론트엔드는 `GET /articles/1/` 요청으로 게시글과 댓글을 받아 화면을 그리고, `POST /articles/1/comments/` 요청으로 새 댓글을 작성할 수 있다.

📌 핵심: DRF는 Django를 화면 렌더링 서버가 아니라 여러 클라이언트가 사용할 수 있는 API 서버로 확장해준다.

---

## 4. 적용 관점에서 다시 보기

이번 강의의 내용을 실제 구현 문제나 프로젝트에서 떠올리려면, 먼저 데이터 사이의 관계를 봐야 한다. “댓글은 게시글에 속한다”, “리뷰는 상품에 속한다”, “주문 내역은 사용자에 속한다”처럼 한쪽 데이터가 다른 데이터에 연결된다면 N:1 관계를 의심해야 한다.

이때 구현 순서는 다음처럼 잡으면 좋다.

1. 자식 모델에 `ForeignKey`가 있는지 확인한다.
2. URL에서 부모 객체의 pk를 받을지, 자식 객체의 pk를 받을지 구분한다.
3. 자식 생성 API에서는 부모 객체를 먼저 조회한다.
4. Serializer에는 클라이언트가 직접 입력하지 않을 관계 필드를 `read_only_fields`로 지정한다.
5. 저장할 때 `serializer.save(parent=parent)` 형태로 관계를 주입한다.
6. 응답 구조를 더 읽기 좋게 만들 필요가 있으면 Nested Serializer를 사용한다.
7. 부모 응답에 자식 목록이 필요하면 역참조 필드를 Serializer에 추가한다.
8. 개수나 집계 값이 필요하면 View에서 `annotate()`, Serializer에서 `SerializerMethodField`를 사용한다.
9. 없는 객체 요청에 대해서는 `get_object_or_404()`로 명확한 404 응답을 반환한다.

문제를 풀거나 프로젝트를 구현할 때 다음 신호가 보이면 이번 강의 내용을 떠올리면 된다.

| 요구사항 신호 | 떠올릴 개념 |
|---|---|
| “특정 게시글에 댓글 작성” | URL에 `article_pk`, View에서 `serializer.save(article=article)` |
| “댓글 응답에 게시글 제목 포함” | 관계 필드 재정의, Nested Serializer, `read_only=True` |
| “게시글 상세에 댓글 목록 포함” | 역참조, `comment_set` 또는 `related_name` |
| “게시글 상세에 댓글 개수 포함” | `annotate()`, `Count`, `SerializerMethodField` |
| “없는 pk로 요청하면 404” | `get_object_or_404()` |
| “목록이 없으면 404 처리” | `get_list_or_404()` |

가장 많이 헷갈리는 부분은 `read_only_fields`와 `read_only=True`의 차이이다. 기존 모델 필드를 그대로 두고 입력만 막고 싶다면 `read_only_fields`를 사용한다. 반대로 필드를 새 Serializer나 계산 필드로 직접 재정의했다면, 필드 선언부에 `read_only=True`를 직접 붙이는 식으로 생각하면 된다.

또 하나의 실수 포인트는 역참조 이름이다. `related_name`을 지정하지 않았다면 Serializer 필드는 `comment_set`이 된다. 하지만 `related_name='comments'`를 지정했다면 Serializer 필드도 `comments`, `Count()` 기준도 `comments`로 맞춰야 한다.

📌 핵심: 관계형 API 구현에서는 “누가 누구를 참조하는가”, “입력으로 받을 값인가 서버가 넣을 값인가”, “응답에서 어떤 구조로 보여줄 것인가”를 순서대로 정리해야 한다.

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의를 통해 DRF에서 관계형 데이터를 다루는 기본 흐름을 정리할 수 있었다. 단일 모델 CRUD에서는 Serializer가 모델 데이터를 JSON으로 바꿔주는 역할만 이해해도 어느 정도 구현이 가능했다. 하지만 게시글과 댓글처럼 관계가 생기면 단순히 필드를 나열하는 것만으로는 부족하다.

특히 댓글 생성 과정에서 `article` 필드를 클라이언트에게 직접 받지 않고, URL의 `article_pk`를 바탕으로 서버가 주입하는 구조가 중요했다. 이 흐름을 이해하면 앞으로 리뷰, 좋아요, 주문, 북마크처럼 특정 대상에 연결되는 데이터를 만들 때도 비슷한 방식으로 구현할 수 있다.

또한 응답 데이터를 재구성하는 과정에서 Serializer의 역할이 더 분명해졌다. Serializer는 단순히 모델을 JSON으로 바꾸는 도구가 아니라, 클라이언트에게 어떤 형태의 데이터를 보여줄지 결정하는 계층이다. 게시글 번호 대신 제목을 보여주거나, 게시글 상세 응답에 댓글 목록을 포함하거나, 댓글 개수 같은 계산 값을 추가하는 작업이 모두 Serializer와 연결된다.

앞으로 더 확장해서 공부할 만한 부분은 쿼리 최적화이다. Nested Serializer를 많이 사용하면 편리하지만, 관계 데이터를 계속 조회하면서 쿼리가 늘어날 수 있다. 이때 `select_related()`나 `prefetch_related()`를 사용해 성능을 개선하는 방법을 함께 익히면 실제 프로젝트에서 더 안정적인 API를 만들 수 있다.

🧠 기억할 것: DRF에서 관계형 API를 잘 만들려면 모델 관계, URL 설계, View 저장 로직, Serializer 응답 구조를 함께 봐야 한다.

---

## 6. 요약 정리

📌 **N:1 관계**  
여러 댓글이 하나의 게시글에 속하는 구조는 `ForeignKey`로 표현한다. 댓글 모델은 `article` 필드를 통해 게시글을 참조한다.

📌 **댓글 생성**  
댓글은 특정 게시글에 달리므로 `articles/<article_pk>/comments/` URL에서 생성하고, View에서 게시글을 먼저 조회한 뒤 `serializer.save(article=article)`로 관계를 주입한다.

📌 **읽기 전용 필드**  
클라이언트가 직접 입력하지 않고 서버가 관리하는 필드는 `read_only_fields`로 지정한다. 필드를 직접 재정의한 경우에는 `read_only=True`를 붙인다.

📌 **응답 데이터 재구성**  
댓글 응답에 게시글 제목을 포함하려면 `article` 필드를 Nested Serializer로 재정의할 수 있다.

📌 **역참조**  
게시글에서 자신을 참조하는 댓글 목록을 가져올 때 기본 이름은 `comment_set`이다. `related_name='comments'`를 지정했다면 `comments`를 사용한다.

📌 **댓글 개수 응답**  
댓글 개수처럼 모델에 실제로 없는 계산 값은 View에서 `annotate()`로 붙이고, Serializer에서 `SerializerMethodField`로 응답에 포함한다.

📌 **404 처리**  
존재하지 않는 객체를 조회할 수 있는 API에서는 `get_object_or_404()`를 사용해 정확한 404 응답을 반환하는 것이 좋다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 댓글 생성 API에서 `serializer.save(article=article)`를 사용하는 이유는 무엇인가?
2. `read_only_fields = ('article',)`를 설정하지 않으면 댓글 생성 요청에서 왜 400 에러가 발생할 수 있는가?
3. 댓글 응답에서 `article: 1` 대신 `article: {"title": "..."}` 형태로 보여주려면 Serializer를 어떻게 바꿔야 하는가?
4. `related_name='comments'`를 지정했을 때, `ArticleSerializer`의 댓글 목록 필드명은 무엇으로 작성해야 하는가?
5. `annotate()`로 만든 `num_of_comments`가 `fields = '__all__'`에 자동으로 포함되지 않는 이유는 무엇인가?
6. `SerializerMethodField`를 선언하면 DRF는 어떤 이름의 메서드를 자동으로 찾는가?
7. `get_object_or_404()`를 사용하는 이유를 클라이언트 관점에서 설명할 수 있는가?

체크리스트로 다시 확인하면 다음과 같다.

- [ ] N:1 관계에서 어느 모델에 `ForeignKey`가 들어가는지 설명할 수 있다.
- [ ] 특정 게시글에 댓글을 생성하는 URL 구조를 작성할 수 있다.
- [ ] 목록 조회와 단일 조회에서 `many=True` 사용 여부를 구분할 수 있다.
- [ ] `read_only_fields`와 `read_only=True`의 차이를 설명할 수 있다.
- [ ] 역참조 기본 이름 `comment_set`과 `related_name` 사용 시의 차이를 구분할 수 있다.
- [ ] `annotate()`와 `SerializerMethodField`를 함께 사용하는 흐름을 설명할 수 있다.
- [ ] 존재하지 않는 리소스 요청에 대해 404 응답을 반환하도록 코드를 개선할 수 있다.
