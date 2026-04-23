# Django ORM을 View에 연결하기: CRUD, HTTP Method, CSRF, Redirect까지 한 흐름으로 이해하기

- 🎯 글의 목표: Django에서 `view` 함수와 ORM을 연결해 게시글의 조회·생성·수정·삭제를 구현하고, 그 과정에서 `GET`, `POST`, `CSRF`, `redirect()`가 왜 필요한지 한 흐름으로 이해한다.
- 🧩 핵심 키워드: Django View, QuerySet API, CRUD, `GET`, `POST`, CSRF Token, `redirect()`, `render()`, detail/new/create/edit/update/delete
- ⭐ 중요도: 상
- 📝 한눈에 보는 내용: 이번 강의는 단순히 게시글 기능을 추가하는 법을 나열하는 시간이 아니다. Django ORM으로 데이터를 다루는 코드를 실제 `view` 함수에 연결하면서, 브라우저의 요청 방식과 서버의 응답 방식까지 함께 이해하는 시간이다. 특히 “조회는 왜 GET인가”, “생성은 왜 POST여야 하는가”, “왜 CSRF 토큰이 필요한가”, “저장 후 왜 redirect 해야 하는가”가 하나의 흐름으로 이어진다.
- 🔗 관련 문제 / 주제(있다면): Django 게시판 CRUD, URL 설계, Template-View 연결, HTTP Method, 보안, 브라우저 동작

---

## 1. 들어가며

Django ORM을 처음 배울 때는 `Article.objects.all()` 같은 코드가 익숙해지는 것만으로도 벅찰 수 있다.  
하지만 실제 웹 서비스에서는 ORM을 Shell에서만 쓰지 않는다. 결국 사용자가 브라우저에서 페이지를 열고, 폼에 값을 입력하고, 버튼을 눌렀을 때 그 요청을 받아 처리하는 곳은 `view` 함수다.

그래서 이번 강의의 핵심은 단순한 ORM 문법 암기가 아니라, **ORM이 View 안에서 어떻게 실제 기능이 되는지**를 연결해서 보는 데 있다.  
전체 흐름은 아래처럼 이어진다.

1. 먼저 게시글을 조회하는 `detail` 기능을 만든다.
2. 그다음 `new`와 `create`를 분리해, 입력 페이지와 저장 로직을 각각 맡긴다.
3. 이 과정에서 `GET`과 `POST`의 역할 차이를 분명히 구분한다.
4. `POST` 요청에는 왜 CSRF 토큰이 필요한지 이해한다.
5. 생성이 끝난 뒤에는 왜 완료 페이지를 바로 주지 않고 `redirect()`를 써야 하는지 확인한다.
6. 마지막으로 같은 패턴을 `delete`, `edit`, `update`까지 확장해 CRUD를 완성한다.

이 흐름을 한 번 잡아 두면, 이후의 댓글 기능, 회원 정보 수정, 좋아요 처리처럼 “사용자 요청으로 DB를 바꾸는 기능”이 훨씬 더 선명하게 읽힌다.

## 2. 핵심 개념 정리

이번 강의는 게시글 기능을 몇 개 더 붙이는 시간이 아니라, **웹 요청과 데이터베이스 변경이 어떻게 만나는지**를 보여주는 강의라고 보는 것이 맞다.

### 2-1. 조회와 변경은 같은 요청이 아니다

사용자가 페이지를 보기 위해 정보를 가져오는 행동과, 새로운 데이터를 저장하거나 기존 데이터를 바꾸는 행동은 성격이 다르다.  
Django는 이 차이를 `GET`과 `POST`로 구분해서 다루고, 우리도 그 의미에 맞게 코드를 작성해야 한다.

### 2-2. View는 요청을 받아 ORM으로 DB를 다룬다

브라우저는 URL과 HTTP Method를 통해 요청을 보내고,  
`view` 함수는 그 요청에서 필요한 데이터를 꺼내 ORM으로 조회하거나 저장한 뒤, 다시 적절한 응답을 반환한다.

즉, 이번 강의의 중심에는 아래 구조가 있다.

- URL이 어떤 `view`를 호출할지 정한다.
- `view`가 요청 데이터를 읽는다.
- ORM이 데이터베이스를 조회하거나 변경한다.
- `render()` 또는 `redirect()`로 클라이언트에게 다음 동작을 안내한다.

### 2-3. 폼 처리에서는 보안과 응답 방식까지 함께 생각해야 한다

폼을 만들고 저장 기능을 붙이는 것만으로는 충분하지 않다.  
데이터를 바꾸는 요청이라면 **CSRF 토큰**으로 요청의 정당성을 확인해야 하고, 저장이 끝난 뒤에는 **redirect**로 후속 흐름을 정리해야 한다.

쉽게 말하면, 이번 강의는 CRUD를 배우는 동시에 **웹이 데이터를 안전하게 주고받는 기본 원칙**도 함께 익히는 시간이다.

## 3. 본문 정리

이 섹션에서는 강의의 실제 흐름을 따라가며, 개념 설명과 화면, 코드와 해설을 같은 자리에서 묶어 정리한다.  
핵심은 “왜 이렇게 짜는가”가 코드 옆에서 바로 이해되도록 하는 것이다.

### 3.1 단일 게시글 조회: `detail`은 한 개를 정확히 집어오는 조회다

`detail`은 여러 게시글 중 하나를 선택해서 보여주는 기능이다.  
여기서 중요한 점은, 목록을 보여주는 `index`와 달리 **기본키(pk)로 특정 게시글 하나를 조회한다**는 점이다.

![detail URL, view, template 연결 흐름](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 201409.jpg>)

위 흐름을 보면 세 가지가 연결된다.

- URL은 `<int:pk>/` 형태로 게시글 번호를 받는다.
- View는 `pk`를 이용해 `Article.objects.get(pk=pk)`로 게시글 하나를 조회한다.
- Template은 전달받은 `article` 객체의 필드를 출력한다.

```python
# articles/urls.py
urlpatterns = [
    # 게시글 번호를 함께 받아 detail view로 넘긴다.
    path('<int:pk>/', views.detail, name='detail'),
]

# articles/views.py
def detail(request, pk):
    # pk와 정확히 일치하는 게시글 하나를 조회한다.
    article = Article.objects.get(pk=pk)

    # template에서 사용할 이름으로 context를 구성한다.
    context = {
        'article': article,
    }

    # detail 페이지를 렌더링한다.
    return render(request, 'articles/detail.html', context)
```

```html
<!-- templates/articles/detail.html -->
<h2>DETAIL</h2>
<h3>{{ article.pk }}번째 글</h3>
<hr>
<p>제목: {{ article.title }}</p>
<p>내용: {{ article.content }}</p>
<p>작성일: {{ article.created_at }}</p>
<p>수정일: {{ article.updated_at }}</p>
<hr>
<a href="{% url 'articles:index' %}">[back]</a>
```

여기서 `get()`을 쓰는 이유는, `detail`이 “하나의 게시글”을 보여주는 페이지이기 때문이다.  
즉, 목록처럼 여러 개를 돌려받는 것이 아니라 **정확히 하나의 객체**를 가져오는 상황과 잘 맞는다.

![index에서 detail 페이지로 이동하는 링크 작성](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 201524.jpg>)

`index`에서는 각 게시글 제목이나 번호에 `detail` URL을 연결해 주면 된다.  
이 링크가 있어야 사용자가 목록에서 특정 게시글 화면으로 자연스럽게 이동할 수 있다.

⚠️ 주의: `get()`은 조건에 맞는 객체가 하나라는 전제가 있을 때 쓰는 메서드다.  
그래서 `detail`처럼 `pk`를 기준으로 조회할 때 특히 잘 어울린다.

📌 핵심: `detail`은 “하나를 정확히 조회하는 기능”이므로 `pk`와 `get()`의 조합으로 이해하면 가장 자연스럽다.

### 3.2 Create를 두 단계로 나누는 이유: `new`와 `create`

게시글 생성 기능을 처음 만들 때 자주 헷갈리는 부분이, “입력 폼을 보여주는 페이지”와 “실제로 데이터를 저장하는 기능”이 다르다는 점이다.  
강의에서 Create 로직을 두 개의 view로 나누는 이유도 바로 여기에 있다.

![Create 로직에는 두 개의 view가 필요함](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 201616.jpg>)

쉽게 말하면,

- `new`는 사용자가 입력할 수 있는 화면을 보여주는 역할
- `create`는 사용자가 보낸 데이터를 받아 DB에 저장하는 역할

을 맡는다.

이 둘을 분리하면 페이지의 역할이 명확해지고, 나중에 `GET`과 `POST`의 차이도 더 분명하게 보인다.

📌 핵심: Create는 “입력 화면 제공”과 “데이터 저장”이 다른 책임이므로 보통 `new`와 `create`를 나눠 구현한다.

### 3.3 `new`: 사용자가 값을 입력할 폼 페이지를 렌더링한다

`new`는 아직 DB를 바꾸지 않는다.  
그저 사용자가 제목과 내용을 입력할 수 있는 폼을 화면에 보여준다.

![new URL, view, template 기본 구현](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 201720.jpg>)

```python
# articles/urls.py
urlpatterns = [
    path('new/', views.new, name='new'),
]

# articles/views.py
def new(request):
    # 입력 폼이 담긴 페이지를 보여준다.
    return render(request, 'articles/new.html')
```

```html
<!-- templates/articles/new.html -->
<h1>NEW</h1>
<form action="#" method="GET">
  <div>
    <label for="title">Title: </label>
    <input type="text" name="title" id="title">
  </div>
  <div>
    <label for="content">Content: </label>
    <textarea name="content" id="content"></textarea>
  </div>
  <input type="submit">
</form>
<hr>
<a href="{% url 'articles:index' %}">[back]</a>
```

처음에는 이렇게 `GET`으로 폼을 전송하도록 만들어 두고, 이후에 왜 이것이 적절하지 않은지 비교하며 `POST`로 바꾸게 된다.  
즉, 이 초기 버전은 최종형이라기보다 **HTTP Method 차이를 체감하기 위한 출발점**이라고 보면 좋다.

![index에서 new 페이지로 이동하는 링크 작성](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 201812.jpg>)

`index`에 `new`로 이동하는 링크를 달아 두면, 사용자는 목록 화면에서 자연스럽게 작성 페이지로 들어갈 수 있다.

💡 포인트: 조회용 링크를 누르는 동작과, 폼을 제출해 데이터를 보내는 동작은 겉보기엔 둘 다 “페이지 이동”처럼 보이지만 실제 의미는 다르다. `new`는 그 차이를 배우는 출발점이다.

📌 핵심: `new`의 역할은 데이터를 저장하는 것이 아니라, 사용자가 데이터를 입력할 수 있는 UI를 제공하는 것이다.

### 3.4 `create`: 요청에서 값을 꺼내 ORM으로 저장한다

이제 실제 저장 로직을 담당하는 `create`를 본다.  
핵심은 브라우저가 보낸 값을 `request`에서 꺼내고, 그 값을 ORM으로 `Article` 객체에 넣어 저장하는 과정이다.

![create URL과 view의 기본 저장 로직](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 201858.jpg>)

```python
# articles/views.py
def create(request):
    # 처음 버전에서는 GET 요청의 query string에서 값을 꺼낸다.
    title = request.GET.get('title')
    content = request.GET.get('content')

    # 1) 빈 인스턴스를 만든 뒤 속성을 넣고 save() 하는 방법
    # article = Article()
    # article.title = title
    # article.content = content
    # article.save()

    # 2) 인스턴스 생성 시 값을 넣고 save() 하는 방법
    article = Article(title=title, content=content)
    article.save()

    # 3) create() 메서드로 생성과 저장을 한 번에 처리하는 방법도 가능하다.
    # Article.objects.create(title=title, content=content)

    return render(request, 'articles/create.html')
```

위 코드에서 강의가 보여주는 중요한 포인트는, **저장 방법이 하나만 있는 것이 아니라는 점**이다.  
하지만 결국 공통점은 같다. 어떤 방식이든 최종적으로는 ORM을 통해 새 레코드가 DB에 저장된다.

![GET 방식으로 전송된 데이터가 URL에 노출되는 모습](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 201923.jpg>)

초기에는 폼 전송을 `GET`으로 두었기 때문에, 저장 후 URL에 `?title=...&content=...` 같은 Query String이 붙는다.  
이 장면은 오히려 좋은 학습 포인트다. 왜냐하면 “데이터를 생성하는 요청이 GET으로 가는 것이 왜 어색한지”를 눈으로 확인하게 해 주기 때문이다.

⚠️ 주의: 데이터를 만드는 요청인데 `request.GET`으로 값을 받고 있다는 점 자체가, 지금 단계의 코드가 임시 상태라는 신호다. 곧 `POST`로 바꾸게 되는 이유가 바로 여기에 있다.

📌 핵심: `create`는 요청에서 값을 꺼내 ORM으로 저장하는 함수이며, 생성 요청은 결국 `POST`와 함께 가야 자연스럽다.

### 3.5 왜 `GET`이 아니라 `POST`여야 할까

폼을 제출해 게시글을 저장하는 동작은 단순 조회가 아니라 **서버의 상태를 바꾸는 요청**이다.  
이때 `GET`과 `POST`의 의미 차이를 이해해야 이후의 수정, 삭제도 같은 기준으로 읽힌다.

`GET`은 서버에게 “정보를 보여 달라”는 요청에 가깝다.  
반면 `POST`는 “데이터를 보내서 뭔가를 생성하거나 바꾸겠다”는 요청에 가깝다.

- `GET`
  - 주로 조회에 사용
  - 데이터가 URL에 노출될 수 있음
  - 캐싱 가능
- `POST`
  - 생성·수정·삭제처럼 상태 변경에 사용
  - 요청 본문(body)으로 데이터를 보냄
  - 기본적으로 캐시 대상이 아님

![폼 전송 method를 GET에서 POST로 변경](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 203100.jpg>)

```html
<!-- templates/articles/new.html -->
<form action="{% url 'articles:create' %}" method="POST">
  ...
</form>
```

이렇게 바꾸면 브라우저는 더 이상 Query String으로 값을 붙여 보내지 않고, 요청 본문에 데이터를 담아 전송한다.  
즉, “새 글 작성”이라는 동작의 의미에 더 맞는 방식으로 바뀌는 것이다.

💡 포인트: 여기서 중요한 점은 단지 URL이 깔끔해진다는 것이 아니다. **조회와 변경을 다른 메서드로 구분하는 것 자체가 웹의 기본 약속**이라는 점이다.

📌 핵심: 게시글 작성은 조회가 아니라 리소스 생성이므로 `GET`보다 `POST`가 의미적으로도, 기술적으로도 더 적절하다.

### 3.6 `POST`로 바꾸자마자 403이 뜨는 이유: CSRF 토큰 검증

폼 전송을 `POST`로 바꾸면 곧바로 403 응답을 만나게 된다.  
이 지점은 단순 오류가 아니라, Django가 **위험할 수 있는 요청을 그냥 통과시키지 않는다**는 것을 보여주는 중요한 장면이다.

403 Forbidden은 요청이 서버에 도달했지만, 권한이나 검증 문제로 거절되었다는 뜻이다.  
이 강의에서는 그 이유가 **CSRF 토큰 누락**이다.

![CSRF 토큰을 form 안에 추가하는 위치](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 224648.jpg>)

```html
<!-- templates/articles/new.html -->
<form action="{% url 'articles:create' %}" method="POST">
  {% csrf_token %}
  <div>
    <label for="title">Title: </label>
    <input type="text" name="title" id="title">
  </div>
  <div>
    <label for="content">Content: </label>
    <textarea name="content" id="content"></textarea>
  </div>
  <input type="submit">
</form>
```

CSRF는 사용자가 의도하지 않았는데도 브라우저가 로그인 상태를 이용해 위험한 요청을 보내게 만드는 공격이다.  
강의의 비유처럼, 로그인된 브라우저가 “신뢰받는 인감도장” 역할을 하다 보니, 서버는 단지 쿠키만 보고 요청을 믿어 버릴 수 있다.

그래서 Django는 데이터베이스를 바꾸는 요청에 대해 “이 요청이 정말 내가 제공한 정상 페이지에서 만들어진 요청인가”를 확인하려고 CSRF 토큰을 요구한다.

즉,

- 단순 조회 요청인 `GET`에는 보통 CSRF 검사가 필요하지 않고,
- 생성·수정·삭제처럼 DB에 영향을 주는 `POST` 요청에는 검사가 필요하다.

⚠️ 주의: `{% csrf_token %}`은 **반드시 form 태그 안**에 있어야 한다. form 바깥에 두면 요청과 함께 전송되지 않는다.

📌 핵심: `POST` 요청에서 CSRF 토큰을 확인하는 이유는, “DB를 바꾸는 요청이 정말 정상 페이지에서 시작된 요청인지” 확인하기 위해서다.

### 3.7 `create`의 최종형: `request.POST`와 `redirect()`

이제 폼이 `POST`로 전송되고, CSRF 토큰도 포함되었으니 `create` view도 그에 맞게 바뀌어야 한다.  
이때 핵심 변화는 두 가지다.

1. `request.GET`이 아니라 `request.POST`에서 값을 가져온다.
2. 저장 후 `render()`가 아니라 `redirect()`를 사용한다.

![create view에서 POST 데이터 처리와 redirect 적용](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 225849.jpg>)

```python
from django.shortcuts import render, redirect


def create(request):
    # POST body에서 값을 읽는다.
    title = request.POST.get('title')
    content = request.POST.get('content')

    # 전달받은 값으로 새 게시글을 만들고 저장한다.
    article = Article(title=title, content=content)
    article.save()

    # 저장이 끝났다면 방금 생성된 게시글의 detail 페이지로 다시 요청하게 한다.
    return redirect('articles:detail', article.pk)
```

여기서 `redirect()`는 서버가 곧바로 다른 페이지 내용을 대신 보내는 함수가 아니다.  
정확히는, **클라이언트에게 “이 주소로 다시 요청해 주세요”라고 응답하는 역할**을 한다.

그래서 실제 흐름은 아래처럼 된다.

![redirect 이후 클라이언트가 detail로 다시 GET 요청하는 흐름](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230023.jpg>)

![개발자 도구에서 redirect 후 detail 요청이 이어지는 모습](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230049.jpg>)

1. 사용자가 `POST /create/`로 저장 요청을 보낸다.
2. 서버는 게시글을 저장한 뒤 `detail` 주소로 이동하라는 redirect 응답을 보낸다.
3. 브라우저는 그 응답을 받고 다시 `GET /<pk>/` 요청을 보낸다.
4. 최종적으로 사용자는 새로 생성된 글의 상세 페이지를 보게 된다.

이 방식이 중요한 이유는, 저장 후 새로고침 문제를 줄여 주기 때문이다.  
만약 POST 응답으로 완료 페이지를 직접 렌더링하면, 사용자가 새로고침할 때 같은 POST가 다시 전송되어 중복 저장이 일어날 수 있다.

💡 포인트: `redirect()`는 단순한 화면 이동 함수가 아니라, **POST 이후의 사용자 흐름을 GET으로 정리해 주는 장치**다.

📌 핵심: 데이터 저장 후에는 `render()`로 끝내기보다 `redirect()`로 안전한 후속 GET 요청을 유도하는 것이 자연스럽다.

### 3.8 `delete`: 삭제도 결국 상태를 바꾸는 `POST` 요청이다

삭제는 조회가 아니라 데이터 제거다.  
즉, 브라우저 입장에서는 “페이지를 보여 달라”가 아니라 “DB 상태를 바꿔 달라”는 요청이다. 그래서 삭제도 `POST`로 처리하는 것이 맞다.

![delete URL, view, form 버튼 구현](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230214.jpg>)

```python
# articles/urls.py
urlpatterns = [
    path('<int:pk>/delete/', views.delete, name='delete'),
]

# articles/views.py
def delete(request, pk):
    # 삭제할 게시글 하나를 먼저 조회한다.
    article = Article.objects.get(pk=pk)

    # 조회한 객체를 삭제한다.
    article.delete()

    # 삭제 후에는 목록 페이지로 돌려보낸다.
    return redirect('articles:index')
```

```html
<!-- templates/articles/detail.html -->
<form action="{% url 'articles:delete' article.pk %}" method="POST">
  {% csrf_token %}
  <input type="submit" value="DELETE">
</form>
```

링크(`<a>`)가 아니라 `form`과 `POST`를 쓰는 이유를 꼭 기억해야 한다.  
삭제를 링크 클릭 같은 `GET` 요청으로 처리하면, 단순 조회처럼 보이지만 실제로는 데이터를 지우는 위험한 동작이 되어 HTTP 의미와 맞지 않는다.

⚠️ 주의: 삭제 버튼도 DB를 바꾸는 요청이므로 CSRF 토큰이 필요하다.

📌 핵심: 삭제는 조회가 아니라 상태 변경이므로, `POST` + CSRF + redirect 흐름으로 처리하는 것이 자연스럽다.

### 3.9 Update도 두 단계다: `edit`와 `update`

수정 기능도 Create와 비슷하게 두 단계로 나뉜다.  
먼저 기존 값을 보여주는 페이지가 필요하고, 그다음 수정된 값을 실제로 저장하는 기능이 필요하다.

![Update 역시 두 개의 view로 나뉨](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230301.jpg>)

즉,

- `edit`는 수정 폼을 보여주는 역할
- `update`는 수정 결과를 저장하는 역할

을 맡는다.

이 구조는 Create에서 본 `new` / `create`와 거의 같은 패턴이다.  
다만 수정에서는 “기존 데이터가 미리 채워져 있어야 한다”는 차이가 추가된다.

📌 핵심: 수정도 입력 화면과 저장 로직의 책임이 다르므로 `edit`와 `update`로 나누는 것이 자연스럽다.

### 3.10 `edit`: 기존 데이터를 미리 채운 수정 폼을 보여준다

수정 페이지의 핵심은 빈 폼이 아니라 **현재 값이 이미 채워진 폼**이라는 점이다.  
그래야 사용자가 전체를 다시 입력하지 않고 필요한 부분만 바꿀 수 있다.

![edit URL과 view 구현](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230359.jpg>)

```python
# articles/urls.py
urlpatterns = [
    path('<int:pk>/edit/', views.edit, name='edit'),
]

# articles/views.py
def edit(request, pk):
    # 수정할 게시글을 먼저 조회해 template에 전달한다.
    article = Article.objects.get(pk=pk)
    context = {
        'article': article,
    }
    return render(request, 'articles/edit.html', context)
```

![edit.html에서 input과 textarea에 기존 값 채우기](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230439.jpg>)

```html
<!-- templates/articles/edit.html -->
<h1>EDIT</h1>
<form action="#" method="POST">
  {% csrf_token %}
  <div>
    <label for="title">Title: </label>
    <input type="text" name="title" id="title" value="{{ article.title }}">
  </div>
  <div>
    <label for="content">Content: </label>
    <textarea name="content" id="content">{{ article.content }}</textarea>
  </div>
  <input type="submit">
</form>
<hr>
<a href="{% url 'articles:index' %}">[back]</a>
```

여기서 자주 헷갈리는 지점이 바로 `input`과 `textarea`의 차이다.

- `input`은 `value` 속성에 기존 값을 넣는다.
- `textarea`는 여는 태그와 닫는 태그 사이에 값을 넣는다.

![input은 value 속성을 사용](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230721.jpg>)

![textarea는 태그 사이에 값을 넣음](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230733.jpg>)

이 차이를 놓치면 수정 페이지가 열리기는 해도 기존 값이 화면에 채워지지 않아 불편한 폼이 된다.

![detail 페이지에서 edit로 이동하는 링크 작성](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230839.jpg>)

사용자는 보통 상세 페이지에서 “수정” 버튼이나 링크를 눌러 edit로 이동하게 된다.  
즉, `detail → edit → update → detail`의 흐름으로 이어진다고 보면 이해가 쉽다.

⚠️ 주의: `textarea`에는 `value` 속성이 없다는 점을 자주 틀린다. 수정 폼이 비어 보인다면 가장 먼저 이 부분을 확인하는 것이 좋다.

📌 핵심: 수정 폼은 기존 데이터를 미리 보여줘야 하며, `input`과 `textarea`의 값 채우는 방식이 서로 다르다.

### 3.11 `update`: 기존 객체를 다시 저장해 수정한다

`update`는 새 객체를 만드는 것이 아니라, **기존 객체를 다시 불러와 필드 값을 덮어쓴 뒤 저장하는 과정**이다.

![update URL과 view 구현](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230912.jpg>)

```python
# articles/urls.py
urlpatterns = [
    path('<int:pk>/update/', views.update, name='update'),
]

# articles/views.py
def update(request, pk):
    # 수정 대상 게시글을 먼저 조회한다.
    article = Article.objects.get(pk=pk)

    # 수정 폼에서 전달된 새 값을 꺼낸다.
    article.title = request.POST.get('title')
    article.content = request.POST.get('content')

    # 바뀐 값을 다시 저장한다.
    article.save()

    # 수정 후에는 detail 페이지로 돌려보낸다.
    return redirect('articles:detail', article.pk)
```

이 코드는 Create와 비슷해 보이지만, 중요한 차이가 하나 있다.  
Create는 새 인스턴스를 만들지만, Update는 **이미 존재하는 객체를 가져와 그 객체를 변경**한다.

![수정 결과가 detail 페이지에 반영된 모습](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 230945.jpg>)

즉, “새 글 하나 추가”가 아니라 “기존 글 하나를 고쳐 쓰기”라는 점에서 동작의 의미가 다르다.  
하지만 저장 후 `redirect`로 마무리하는 패턴은 동일하다.

📌 핵심: Update는 새 객체 생성이 아니라, 기존 객체를 조회해 값을 덮어쓴 뒤 `save()` 하는 흐름이다.

### 3.12 GET과 POST를 한 번에 정리하면 무엇이 달라 보일까

강의 후반부의 핵심은 CRUD 기능 각각을 따로 외우는 것이 아니라, **HTTP Method의 의미에 맞춰 보면 전체 구조가 단순해진다**는 점이다.

![GET과 POST 비교 표](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 231018.jpg>)

표를 글로 다시 정리하면 이렇다.

| 구분 | GET | POST |
|---|---|---|
| 데이터 전달 방식 | URL 뒤 Query String | HTTP body |
| 데이터 공개 가능성 | URL에 노출될 수 있음 | URL에 직접 노출되지 않음 |
| 사용 목적 | 데이터 검색 및 조회 | 데이터 제출 및 변경 |
| 캐싱 | 가능 | 일반적으로 불가 |

강의의 마지막 그림은 이 차이를 URL 설계 관점까지 확장해서 보여준다.

![같은 URL도 Method에 따라 의미가 달라질 수 있음](<../assets/images/04_15_Django_ORM_with_view/화면 캡처 2026-04-23 231403.jpg>)

예를 들어 `articles/1/`이라는 같은 주소라도,

- `GET articles/1/`이면 “1번 게시글을 보여 달라”는 조회 요청이 되고,
- `POST articles/1/`이면 “1번 게시글에 어떤 조작을 가하겠다”는 요청이 될 수 있다.

즉, URL만 보는 것이 아니라 **URL + Method를 함께 봐야 요청의 의미가 완성된다**는 이야기다.

💡 포인트: Django의 URL 구조를 배울 때 주소 모양만 외우면 금방 헷갈린다. 주소와 메서드를 함께 봐야 “이 요청이 조회인지, 변경인지”가 분명해진다.

📌 핵심: 같은 URL이라도 `GET`과 `POST`가 붙는 순간 요청의 의미와 서버 동작이 달라진다.

## 4. 적용 관점에서 다시 보기

이제 CRUD 기능을 따로따로 보지 말고, 실제 문제를 만났을 때 어떤 신호로 판단하면 되는지 정리해 보자.

### 4-1. 화면을 보여주는가, DB를 바꾸는가

가장 먼저 봐야 할 것은 이 기능이 **조회인지 변경인지**다.

- 페이지를 보여주는 기능이라면 `GET` + `render()` 쪽으로 생각한다.
- 데이터를 저장·수정·삭제하는 기능이라면 `POST` + CSRF + `redirect()` 흐름으로 생각한다.

이 기준만 잡혀도 `new/edit`와 `create/update/delete`가 왜 분리되는지 자연스럽게 이해된다.

### 4-2. 폼 처리는 항상 두 단계로 본다

실전에서 폼 관련 기능이 나오면, 먼저 아래 두 질문을 던지면 좋다.

1. 사용자가 입력할 화면이 필요한가?
2. 입력한 값을 실제로 저장할 함수가 필요한가?

대부분의 경우 답은 둘 다 “예”다.  
그래서 `new/create`, `edit/update`처럼 두 단계 구조가 반복된다.

### 4-3. POST 이후에는 곧바로 페이지를 렌더링하기보다 redirect를 의심한다

문제를 풀거나 프로젝트를 구현할 때, 데이터 변경 후 응답을 어떻게 줄지 고민된다면 먼저 `redirect`를 떠올리는 습관이 좋다.  
특히 새로고침 시 중복 요청이 생길 수 있는 상황에서는 더 그렇다.

### 4-4. 수정 폼이 이상하면 값 바인딩 위치부터 확인한다

수정 페이지가 열리는데 기존 데이터가 안 보인다면, 보통 아래 둘 중 하나를 먼저 확인하면 된다.

- `input`에 `value="{{ article.title }}"`를 넣었는가
- `textarea` 태그 사이에 `{{ article.content }}`를 넣었는가

이 두 지점은 실습에서 매우 자주 틀리는 부분이다.

### 4-5. 삭제 링크를 `<a>`로 만들고 싶어질 때가 있다

하지만 삭제는 조회가 아니다.  
브라우저에서 클릭 하나로 쉽게 보이더라도, 의미상으로는 DB 상태를 바꾸는 작업이다.  
그래서 링크보다는 `form + POST`로 구현하는 쪽이 HTTP 의미와 보안 측면에서 더 맞다.

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의를 통해 분명해지는 것은, Django의 CRUD는 단순히 ORM 메서드를 외우는 문제로 끝나지 않는다는 점이다.  
웹 개발에서는 항상 **브라우저가 어떤 방식으로 요청을 보냈는지**, 그리고 **서버가 그 요청을 어떤 의미로 받아들여야 하는지**를 함께 봐야 한다.

특히 이번 흐름에서 가장 중요한 확장 포인트는 다음과 같다.

- 이후 `ModelForm`을 배우면, 지금 수동으로 받던 `request.POST.get(...)`와 HTML form 작성이 더 추상화된다.
- `require_http_methods`, `require_POST` 같은 데코레이터를 배우면, 지금 배운 GET/POST 구분을 더 명확하게 강제할 수 있다.
- `get_object_or_404()`를 배우면, `get()` 실패 상황까지 더 안전하게 다룰 수 있다.
- 로그인과 권한 처리를 붙이면, CSRF와 함께 “누가 수정·삭제할 수 있는가”라는 문제까지 확장된다.

즉, 이번 강의는 게시판 기능 하나를 배우는 시간이면서, 앞으로 Django에서 거의 모든 사용자 입력 기능을 구현할 때 반복해서 쓰게 될 기본 뼈대를 익히는 시간이라고 볼 수 있다.

## 6. 요약 정리

- `detail`은 `pk`로 게시글 하나를 조회하는 기능이며, `get()`과 잘 어울린다.
- Create는 `new`와 `create`, Update는 `edit`와 `update`처럼 화면 제공과 저장 기능을 나누어 생각하면 흐름이 선명해진다.
- `GET`은 주로 조회, `POST`는 생성·수정·삭제처럼 상태 변경에 사용한다.
- `POST` 요청에는 CSRF 토큰이 필요하다.
- 데이터 저장 후에는 `render()`보다 `redirect()`로 후속 GET 요청을 유도하는 것이 자연스럽다.
- 삭제 역시 조회가 아니라 상태 변경이므로 `POST`로 처리해야 한다.

### 📌 핵심

- View는 요청을 받고, ORM으로 DB를 다루고, `render()` 또는 `redirect()`로 응답을 정리하는 곳이다.
- CRUD를 따로 외우기보다, “조회냐 변경이냐”로 먼저 나누면 구조가 단순해진다.
- 폼 처리의 기본 패턴은 **입력 화면(GET) → 제출 처리(POST) → redirect(GET)** 흐름이다.

### 🧠 기억할 것

- `new/edit`는 화면을 보여주는 함수다.
- `create/update/delete`는 DB를 바꾸는 함수다.
- `POST`로 DB를 바꾸면 CSRF와 redirect를 함께 떠올려야 한다.

## 7. 미니 퀴즈 또는 체크리스트

1. `detail` view에서 `Article.objects.get(pk=pk)`를 쓰는 이유를, `all()`이나 `filter()`와 비교해 설명할 수 있는가?
2. 게시글 생성 기능을 `new`와 `create` 두 개의 view로 나누는 이유를 말할 수 있는가?
3. 게시글 작성 폼에서 `method="GET"`이 아니라 `method="POST"`가 더 적절한 이유를 설명할 수 있는가?
4. `POST` 요청에서 CSRF 토큰이 필요한 이유를, 단순히 “Django 규칙이라서”가 아니라 요청 검증 관점에서 설명할 수 있는가?
5. 수정 폼에서 `input`과 `textarea`에 기존 값을 채우는 방식이 왜 다른지 설명할 수 있는가?
6. 저장이나 수정 후 `render()` 대신 `redirect()`를 쓰는 이유를 새로고침 문제와 연결해서 설명할 수 있는가?
