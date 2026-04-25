# 04_20 Django Static & Media

- 🎯 글의 목표: Django에서 정적 파일과 미디어 파일이 어떻게 다르게 다뤄지는지 이해하고, 실제 프로젝트에서 CSS·이미지 적용과 이미지 업로드까지 연결할 수 있도록 정리한다.
- 🧩 핵심 키워드: `Static Files`, `Media Files`, `STATIC_URL`, `STATICFILES_DIRS`, `MEDIA_ROOT`, `MEDIA_URL`, `ImageField`, `request.FILES`, `multipart/form-data`
- ⭐ 중요도: 상
- 📝 한눈에 보는 내용: 이번 강의는 “화면을 꾸미는 파일”과 “사용자가 올리는 파일”을 Django가 어떻게 구분하고 처리하는지를 다룬다. 앞부분에서는 CSS와 이미지 같은 정적 파일을 불러오는 흐름을, 뒷부분에서는 사용자가 업로드한 이미지를 서버에 저장하고 다시 화면에 출력하는 흐름을 단계적으로 연결한다.
- 🔗 관련 문제 / 주제(있다면): Django CRUD 프로젝트, 게시글 이미지 업로드, 정적 자원 관리, 배포 환경에서의 파일 저장 구조

---

## 1. 들어가며

Django로 웹 페이지를 만들다 보면 두 종류의 파일을 다루게 된다. 하나는 개발자가 미리 준비해 둔 CSS, JavaScript, 로고 이미지처럼 **항상 같은 모습으로 제공되는 파일**이고, 다른 하나는 사용자가 글을 작성하거나 프로필을 수정하면서 **직접 올리는 파일**이다.

겉으로 보면 둘 다 결국 “파일”이지만, Django는 이 둘을 같은 방식으로 처리하지 않는다. 정적 파일은 프로젝트가 미리 들고 있는 자원을 URL로 연결해 제공하면 되고, 미디어 파일은 업로드를 받고, 서버에 저장하고, 다시 웹에서 접근 가능한 주소로 노출하는 과정이 필요하다.

이번 강의는 바로 이 차이를 분명하게 잡아주는 흐름이다. 먼저 Static files의 개념과 경로 설정을 이해한 뒤, Media files 설정과 이미지 업로드까지 이어 보면, 왜 `STATIC_URL`과 `MEDIA_URL`이 따로 존재하는지 자연스럽게 이해할 수 있다.

---

## 2. 핵심 개념 정리

이번 강의의 큰 흐름은 아래처럼 정리할 수 있다.

1. **정적 파일(Static files)** 이 무엇인지 이해한다.
2. 정적 파일을 Django 템플릿에서 `static` 태그로 불러오는 방법을 익힌다.
3. 앱 내부 기본 경로와 프로젝트 공용 추가 경로를 구분해 본다.
4. **미디어 파일(Media files)** 은 왜 별도 설정이 필요한지 이해한다.
5. `ImageField`, `MEDIA_ROOT`, `MEDIA_URL`, `request.FILES`를 연결해 실제 이미지 업로드를 구현한다.
6. 마지막으로 이 구조가 배포 환경이나 클라우드 저장소와는 어떻게 연결되는지 감을 잡는다.

여기서 중요한 점은, Static과 Media의 차이가 단순히 “파일 종류”의 차이가 아니라는 점이다. **누가 만들고, 언제 바뀌며, 어디에 저장되고, 어떤 URL로 접근하는가**까지 모두 달라진다. 이 구분이 정확해야 나중에 이미지가 안 보이거나 업로드가 실패할 때도 원인을 훨씬 쉽게 찾을 수 있다.

---

## 3. 본문 정리

### 3.1 Static files란 무엇인가

**정적 파일은 서버에서 미리 준비해 둔 채, 요청이 올 때마다 같은 모습으로 제공되는 파일**이다.

쉽게 말하면 식당에 비치된 인쇄된 메뉴판과 비슷하다. 손님이 누구인지에 따라 내용이 바뀌는 것이 아니라, 서버가 정해 둔 파일을 그대로 건네준다. CSS, JavaScript, 이미지, 폰트 파일이 대표적인 예다.

정적 파일이 웹 페이지에서 보이려면 단순히 컴퓨터 안에 저장되어 있는 것만으로는 부족하다. 브라우저가 그 파일을 찾아갈 수 있도록 **URL**이 있어야 한다. 웹 서버는 그 URL을 보고, 약속된 폴더에서 파일을 찾아 응답한다.

![정적 파일 요청 흐름](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 193622.jpg>)

위 그림은 “사용자가 URL로 파일을 요청하면, 서버가 약속된 폴더에서 해당 파일을 찾아 응답한다”는 정적 파일의 가장 기본적인 구조를 보여준다. 결국 핵심은 **정적 파일도 웹에서 보이려면 주소가 필요하다**는 점이다.

💡 포인트: 정적 파일은 “파일 그 자체”보다도, **그 파일에 연결된 웹 주소**를 어떻게 만들어 줄 것인가가 더 중요하다.

📌 핵심: Static files는 서버가 미리 준비해 둔 파일이며, 브라우저는 URL을 통해 그 파일을 요청한다.

---

### 3.2 앱 내부 기본 경로에서 정적 파일 제공하기

Django는 각 앱 내부의 `static/` 폴더를 정적 파일의 기본 탐색 경로로 사용한다. 그래서 가장 먼저 익혀야 할 구조는 다음과 같다.

```text
articles/
└── static/
    ├── stylesheets/
    │   └── style.css
    └── images/
        └── sample-1.png
```

정적 CSS 파일을 적용하려면 템플릿에서 먼저 `static` 태그를 사용할 수 있도록 불러와야 한다.

```html
<!-- articles/index.html -->
{% load static %}

<link rel="stylesheet" href="{% static 'stylesheets/style.css' %}">
```

![CSS 정적 파일 연결](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 193804.jpg>)

여기서 막히기 쉬운 부분은 `style.css`의 실제 저장 위치를 그대로 쓰는 것이 아니라, **`static/` 폴더 이후의 경로만** `static` 태그에 넘긴다는 점이다. 즉, `articles/static/stylesheets/style.css` 전체를 쓰는 것이 아니라 `stylesheets/style.css`만 쓴다.

`{% load static %}` 는 built-in처럼 자동으로 사용 가능한 태그가 아니기 때문에, 템플릿 최상단에서 먼저 불러와야 한다. 이 선언이 있어야 Django 템플릿 엔진이 `{% static %}` 구문을 해석할 수 있다.

⚠️ 주의:
- `{% load static %}` 를 빼먹으면 템플릿 에러가 날 수 있다.
- `{% static %}` 안에는 **실제 파일 시스템 경로**가 아니라, `static/` 이후의 상대 경로를 넣어야 한다.

📌 핵심: 앱 내부의 `static/` 폴더는 Django가 기본으로 탐색하는 정적 파일 위치이며, 템플릿에서는 `{% load static %}` 와 `{% static %}` 로 접근한다.

---

### 3.3 STATIC_URL과 정적 파일 URL의 의미

`STATIC_URL`은 **정적 파일의 웹 주소 시작점**이다.

```python
# settings.py
STATIC_URL = 'static/'
```

이 값은 서버 컴퓨터 안의 실제 폴더 경로가 아니라, 브라우저가 접근할 때 사용할 URL 접두사다. 쉽게 말하면 “정적 파일은 웹에서 `/static/`이라는 별명으로 찾아오세요”라고 정해 두는 셈이다.

예를 들어 템플릿에서 아래처럼 작성하면,

```html
<img src="{% static 'images/sample-1.png' %}" alt="sample image">
```

Django는 내부적으로 `STATIC_URL`을 기준으로 URL을 계산한다. 그래서 브라우저 입장에서는 `/static/images/sample-1.png` 같은 주소로 보이게 된다.

![기본 경로 이미지 배치](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 194442.jpg>)

![기본 경로 이미지 출력 코드](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 194513.jpg>)

이 흐름을 이해하면 왜 정적 파일이 “그냥 폴더에 넣기만 한다고 보이는 게 아닌지”가 분명해진다. 파일은 저장되어 있어도, 브라우저가 접근할 수 있는 URL이 계산되지 않으면 화면에는 나타나지 않는다.

🧠 기억할 것: `STATIC_URL`은 실제 저장 경로가 아니라, 정적 파일에 붙는 **웹 주소 접두사**다.

📌 핵심: `{% static %}` 태그는 `STATIC_URL`을 기준으로 정적 파일의 접근 URL을 만들어 준다.

---

### 3.4 STATICFILES_DIRS로 추가 경로 관리하기

정적 파일은 꼭 앱 내부 `static/` 폴더에만 둘 필요는 없다. 여러 앱이 함께 쓰는 공용 이미지나 외부 라이브러리 파일처럼, 프로젝트 최상위에 모아 두고 싶은 경우도 있다. 이때 사용하는 설정이 `STATICFILES_DIRS`다.

일반적으로는 아래처럼 설정한다.

```python
# settings.py
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]
```

이 설정은 Django에게 “각 앱의 `static/` 폴더뿐 아니라, 프로젝트 루트의 `static/` 폴더도 함께 살펴봐라”라고 알려주는 역할을 한다.

![추가 경로 이미지 배치](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 195043.jpg>)

추가 경로에 있는 파일은 다음처럼 불러올 수 있다.

```html
<!-- articles/index.html -->
<img src="{% static 'sample-2.png' %}" alt="sample image">
```

![추가 경로 이미지 출력 코드](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 195115.jpg>)

이 부분에서 헷갈리기 쉬운 이유는, 파일이 프로젝트 루트의 `static/` 폴더에 있어도 템플릿에서는 여전히 **`static/` 이후 경로만** 적는다는 점이다. 즉, `static/sample-2.png`라고 쓰지 않고 `sample-2.png`라고 적는다.

![정적 파일은 URL이 있어야 보인다](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 195240.jpg>)

💡 포인트: `STATICFILES_DIRS`는 정적 파일을 찾는 **추가 탐색 경로 목록**이지, 템플릿에서 쓰는 URL 문자열을 바꾸는 설정은 아니다.

⚠️ 주의:
- `STATICFILES_DIRS` 이름을 `STATICFILES_DIR`처럼 잘못 쓰지 않도록 주의한다.
- 경로를 추가했다고 해서 템플릿 경로 표기 규칙이 달라지는 것은 아니다.

📌 핵심: `STATICFILES_DIRS`는 공용 정적 파일을 위한 추가 탐색 경로를 등록할 때 사용한다.

---

### 3.5 Media files란 무엇인가

**미디어 파일은 사용자가 직접 업로드하는 파일**이다.

Static files가 개발자가 미리 준비한 고정된 자원이라면, Media files는 서비스 운영 중에 새로 생기고 계속 바뀌는 파일이다. 게시글 이미지, 프로필 사진, 첨부 파일이 대표적인 예다.

이 차이가 중요한 이유는 처리 방식이 완전히 달라지기 때문이다.

- Static files: 프로젝트에 원래 들어 있는 파일
- Media files: 사용자의 요청을 통해 서버에 새로 저장되는 파일

그래서 미디어 파일은 단순히 템플릿에서 불러오는 것만으로 끝나지 않는다. **업로드를 받고, 저장 위치를 정하고, 웹에서 접근할 URL을 연결하는 작업**까지 필요하다.

📌 핵심: Media files는 사용자가 생성하는 파일이기 때문에, 저장과 제공을 위한 별도 설정이 필요하다.

---

### 3.6 ImageField와 데이터베이스 저장 방식

Django에서 이미지 업로드를 다룰 때는 모델에 `ImageField`를 사용한다.

```python
# articles/models.py
class Article(models.Model):
    title = models.CharField(max_length=10)
    content = models.TextField()
    image = models.ImageField(upload_to='images/', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

![ImageField 추가](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 200646.jpg>)

여기서 중요한 점은 **이미지 파일 자체가 데이터베이스에 저장되지 않는다**는 점이다. 실제 파일은 서버의 특정 폴더에 저장되고, 데이터베이스에는 그 파일이 어디에 저장되었는지를 나타내는 **경로 문자열**만 기록된다.

`upload_to='images/'` 는 업로드된 파일을 어떤 하위 폴더에 저장할지 정하는 옵션이다. 또 `blank=True` 는 폼 유효성 검사에서 이 필드를 필수 입력으로 보지 않게 하므로, 게시글 작성 시 이미지를 첨부하지 않아도 저장할 수 있게 해 준다.

⚠️ 주의:
- `ImageField`를 추가한 뒤 migration을 진행할 때, 이미지 처리 라이브러리인 **Pillow**가 설치되어 있지 않으면 에러가 발생한다.

![migration 에러](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 200806.jpg>)

```bash
pip install pillow
```

![Pillow 설치 후 재진행](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 200921.jpg>)

💡 포인트: DB에는 파일이 아니라 “파일 위치”가 저장된다는 점을 이해하면, 업로드 후 DB에서 어떤 값이 보이는지도 자연스럽게 해석할 수 있다.

📌 핵심: `ImageField`는 실제 파일을 서버에 저장하고, DB에는 그 파일 경로만 저장한다.

---

### 3.7 MEDIA_ROOT와 MEDIA_URL 설정하기

미디어 파일을 다루려면 Django에게 두 가지를 알려줘야 한다.

1. 업로드된 파일을 **어디에 저장할지**
2. 저장된 파일을 **어떤 URL로 보여줄지**

이 역할을 각각 담당하는 설정이 `MEDIA_ROOT`와 `MEDIA_URL`이다.

```python
# settings.py
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = 'media/'
```

![MEDIA_ROOT와 MEDIA_URL 설정](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 200147.jpg>)

`MEDIA_ROOT`는 서버 내부의 실제 저장 위치다. 즉, 업로드된 파일이 물리적으로 들어갈 폴더다. 반면 `MEDIA_URL`은 브라우저가 그 파일에 접근할 때 사용할 웹 주소 접두사다.

이 설정만으로는 개발 서버가 자동으로 미디어 파일을 서빙하지 못하므로, URL 설정도 함께 추가해야 한다.

```python
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('articles/', include('articles.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

![미디어 파일 URL 연결](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 200356.jpg>)

이 코드는 “`media/`로 시작하는 요청이 들어오면, `MEDIA_ROOT` 폴더에서 실제 파일을 찾아 응답하라”는 규칙을 추가하는 것이다. 개발 서버 입장에서는 이 연결 고리가 있어야 업로드 파일을 브라우저에 다시 보여줄 수 있다.

⚠️ 주의:
- `MEDIA_ROOT`는 실제 파일 경로, `MEDIA_URL`은 웹 주소라는 점을 혼동하지 않는다.
- 개발 환경에서는 `static(... )` 헬퍼로 연결하지만, 배포 환경에서는 보통 웹 서버나 외부 저장소가 이 역할을 맡는다.

📌 핵심: `MEDIA_ROOT`는 저장 위치, `MEDIA_URL`은 접근 주소이며, 개발 서버에서는 URL 패턴 연결까지 해줘야 파일이 보인다.

---

### 3.8 이미지 업로드가 실제로 동작하려면 필요한 것

이미지 업로드는 모델 필드만 추가했다고 끝나지 않는다. 폼과 뷰도 파일 업로드를 받을 수 있는 구조로 바뀌어야 한다.

먼저 템플릿의 `<form>` 태그에 `enctype="multipart/form-data"`를 추가해야 한다.

```html
<!-- articles/create.html -->
<h1>CREATE</h1>
<form action="{% url 'articles:create' %}" method="POST" enctype="multipart/form-data">
  {% csrf_token %}
  {{ form }}
  <input type="submit">
</form>
```

![create 템플릿의 enctype 설정](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 200953.jpg>)

이 속성은 폼 데이터를 어떤 형식으로 인코딩해서 서버에 보낼지 정한다. 파일 업로드가 포함된 폼은 반드시 `multipart/form-data` 형식을 사용해야 한다. 그렇지 않으면 브라우저가 파일 데이터를 제대로 전송하지 못한다.

이후 뷰에서는 `request.POST`만 넘기는 것이 아니라, 업로드된 파일 데이터를 담고 있는 `request.FILES`도 함께 전달해야 한다.

```python
# articles/views.py
def create(request):
    if request.method == 'POST':
        # 텍스트 데이터(request.POST)와 파일 데이터(request.FILES)를 함께 전달한다.
        form = ArticleForm(request.POST, request.FILES)

        # 폼 검증이 통과되면 DB에는 이미지 경로가 저장되고,
        # 실제 이미지 파일은 MEDIA_ROOT 하위 폴더에 저장된다.
        if form.is_valid():
            form.save()
            return redirect('articles:index')
    else:
        # GET 요청일 때는 빈 폼을 만들어 작성 페이지를 렌더링한다.
        form = ArticleForm()

    context = {
        'form': form,
    }
    return render(request, 'articles/create.html', context)
```

![create view에서 request.FILES 전달](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 201106.jpg>)

이렇게 연결하면 작성 페이지에서 이미지 입력 필드가 생기고, 실제 업로드 후에는 파일이 `MEDIA_ROOT` 아래에 저장된다.

![생성 폼의 파일 입력 필드](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 201240.jpg>)

![업로드된 파일 위치](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 201321.jpg>)

![DB에 저장된 이미지 경로](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 201414.jpg>)

코드 흐름을 한 번 정리하면 다음과 같다.

1. 사용자가 폼에서 이미지를 선택한다.
2. 브라우저가 `multipart/form-data` 형식으로 텍스트 + 파일을 함께 전송한다.
3. 뷰에서 `request.POST`, `request.FILES`를 ModelForm에 넘긴다.
4. Django가 파일을 `MEDIA_ROOT`에 저장한다.
5. DB에는 저장된 파일 경로 문자열이 기록된다.

⚠️ 주의:
- `enctype`이 없으면 파일 데이터가 전송되지 않는다.
- `request.FILES`를 빼먹으면 폼은 제출되어도 이미지가 저장되지 않는다.

📌 핵심: 이미지 업로드는 **모델 + 폼 enctype + request.FILES + MEDIA 설정**이 모두 맞아야 동작한다.

---

### 3.9 업로드된 이미지를 상세 페이지에 출력하기

업로드가 잘 되었다면, 이제 그 이미지를 다시 화면에 보여줄 수 있어야 한다. 이때 사용하는 것이 `ImageField`의 `.url` 속성이다.

```html
<!-- articles/detail.html -->
{% if article.image %}
  <img src="{{ article.image.url }}" alt="image">
{% endif %}
```

![업로드 이미지 출력](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 205312.jpg>)

`.url`은 업로드된 파일의 웹 접근 주소를 반환한다. 즉, `MEDIA_URL`을 기반으로 브라우저가 접근할 수 있는 주소를 만들어 준다.

여기서 `if` 조건을 함께 쓰는 이유도 중요하다. `blank=True` 로 설정해 두었기 때문에, 어떤 게시글은 이미지가 없을 수 있다. 이 상태에서 무조건 `article.image.url`을 출력하려 하면 에러가 발생할 수 있다. 그래서 **이미지가 있는 경우에만 출력하도록 조건문을 걸어 주는 것**이 안전하다.

⚠️ 주의:
- 이미지가 없는 게시글에 대해 `.url`을 바로 호출하면 문제가 생길 수 있다.
- 따라서 템플릿에서는 `{% if article.image %}` 로 한 번 감싸 주는 습관이 중요하다.

📌 핵심: 업로드 이미지는 `article.image.url`로 출력하고, 이미지가 없을 수 있으므로 조건문으로 감싸는 것이 안전하다.

---

### 3.10 이미지 수정과 update 뷰 처리

이미지 업로드는 생성(create) 때만 필요한 것이 아니다. 수정(update) 시에도 같은 원리가 적용된다.

먼저 수정 폼에서도 파일 업로드가 가능하도록 `enctype="multipart/form-data"`를 유지해야 한다.

![update 템플릿의 enctype 설정](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 205412.jpg>)

그리고 update 뷰에서도 `request.FILES`를 함께 전달해야 한다.

```python
# articles/views.py
def update(request, pk):
    article = Article.objects.get(pk=pk)

    if request.method == 'POST':
        # 수정 시에도 파일 데이터가 함께 들어오므로 request.FILES가 필요하다.
        form = ArticleForm(request.POST, request.FILES, instance=article)

        # 기존 객체(instance=article)를 수정 대상으로 넘겨주면
        # 새 게시글을 만드는 것이 아니라 기존 게시글을 갱신한다.
        if form.is_valid():
            form.save()
            return redirect('articles:detail', article.pk)
    else:
        # GET 요청일 때는 기존 값이 채워진 폼을 보여준다.
        form = ArticleForm(instance=article)

    context = {
        'article': article,
        'form': form,
    }
    return render(request, 'articles/update.html', context)
```

![update view에서 request.FILES 전달](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 205446.jpg>)

이 부분은 create와 매우 비슷해 보이지만, `instance=article`이 있다는 점이 다르다. 이 인자를 주지 않으면 기존 게시글을 수정하는 것이 아니라, 새 게시글을 추가하는 방향으로 동작할 수 있다.

📌 핵심: 수정 페이지에서도 파일 업로드가 가능하도록 `enctype`과 `request.FILES`를 그대로 챙겨야 한다.

---

### 3.11 upload_to를 활용한 경로 관리

`upload_to`는 단순히 `'images/'` 같은 문자열만 받을 수 있는 것이 아니다. 더 체계적인 폴더 구조를 만들고 싶다면 날짜 형식이나 함수를 활용할 수 있다.

#### 날짜를 이용한 경로 구성

```python
class Photo(models.Model):
    # 예: 2100년 1월 1일 업로드 시 '2100/01/01/' 폴더에 저장
    image = models.ImageField(blank=True, upload_to='%Y/%m/%d/')
```

![날짜 기반 upload_to](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 205657.jpg>)

이 방식은 업로드 날짜 기준으로 폴더를 나눠 주기 때문에, 파일이 많아질수록 관리가 쉬워진다.

#### 함수를 이용한 동적 경로 생성

```python
# 경로 생성 함수 정의
def articles_image_path(instance, filename):
    # instance.user.username을 통해 게시글 작성자의 이름을 가져오고,
    # 업로드한 파일 이름(filename)과 합쳐 사용자별 폴더 경로를 만든다.
    return f'images/{instance.user.username}/{filename}'


class Article(models.Model):
    user = ...
    image = models.ImageField(blank=True, upload_to=articles_image_path)
```

![함수 기반 upload_to](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 205812.jpg>)

이 방식은 사용자별, 게시글별, 카테고리별처럼 더 유연한 저장 구조가 필요할 때 유용하다. 프로젝트가 커질수록 파일을 한 폴더에 모두 몰아넣는 것보다, 이런 식으로 규칙 있게 나누는 편이 훨씬 관리하기 쉽다.

💡 포인트: `upload_to`는 단순 저장 폴더 지정이 아니라, **파일 관리 전략**을 설계하는 도구라고 볼 수 있다.

📌 핵심: `upload_to`는 문자열뿐 아니라 날짜 형식, 함수도 받을 수 있어 업로드 경로를 유연하게 설계할 수 있다.

---

### 3.12 AWS와 파일 저장 구조를 연결해서 이해하기

강의 후반부에서는 Django 내부 설정에서 한 걸음 더 나아가, 실제 서비스 환경에서 파일이 어디에 저장될 수 있는지도 함께 다뤘다.

- **EC2**: Django 애플리케이션이 실행되는 서버
- **S3**: 이미지나 정적 파일을 저장하는 외부 스토리지
- **RDS**: 회원 정보, 게시글 같은 데이터를 저장하는 데이터베이스

![AWS 핵심 서비스](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 205932.jpg>)

![웹 서비스 데이터 흐름](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 210142.jpg>)

지금까지 실습에서는 `MEDIA_ROOT` 폴더에 파일을 저장했지만, 실제 배포 환경에서는 업로드 파일을 서버 로컬 디스크 대신 S3 같은 외부 저장소에 두는 경우가 많다. 이렇게 보면 Static/Media 설정은 단지 로컬 실습용 규칙이 아니라, **배포 환경의 저장 구조를 이해하는 출발점**이기도 하다.

📌 핵심: 로컬 실습에서는 폴더에 저장하지만, 실제 서비스에서는 S3 같은 외부 스토리지가 같은 역할을 맡을 수 있다.

---

### 3.13 BaseModelForm 생성자 인자 흐름 이해하기

강의 마지막에는 왜 `ArticleForm(request.POST, request.FILES)`처럼 파일을 두 번째 위치 인자로 전달하는지에 대한 배경도 짚고 넘어갔다. 이는 `ModelForm`의 상위 클래스인 `BaseModelForm` 생성자 구조와 연결된다.

![BaseModelForm 생성자 참고](<../assets/images/04_20_Django_Static_Media/화면 캡처 2026-04-25 210401.jpg>)

실습에서는 보통 “그냥 이렇게 쓴다” 수준으로 지나가기 쉽지만, 내부 구조를 한 번 이해해 두면 나중에 커스텀 폼이나 상속 구조를 볼 때 훨씬 덜 막힌다. 특히 `request.POST`와 `request.FILES`를 따로 넘기는 이유가 단순 암기가 아니라, **폼이 텍스트 데이터와 파일 데이터를 별도로 받도록 설계되어 있기 때문**이라는 점을 기억해 둘 만하다.

📌 핵심: `request.FILES`를 두 번째 인자로 넘기는 방식은 BaseModelForm의 생성자 구조와 연결된 규칙이다.

---

## 4. 적용 관점에서 다시 보기

이제 이 내용을 실제 구현 흐름으로 다시 묶어 보면, 문제를 볼 때 어떤 순서로 떠올려야 하는지가 더 분명해진다.

### 4.1 CSS나 이미지가 안 보일 때 체크할 순서

정적 파일이 안 보이면 아래 순서로 점검하는 것이 좋다.

1. 파일이 `app/static/` 또는 `STATICFILES_DIRS`에 등록된 경로 안에 있는가?
2. 템플릿 상단에 `{% load static %}` 가 있는가?
3. `{% static '...' %}` 안의 경로가 `static/` 이후 기준으로 잘 작성되었는가?
4. `STATIC_URL` 설정이 기본값 또는 의도한 값으로 잡혀 있는가?

이 문제는 대부분 “파일이 없어서”보다도, **경로 기준을 잘못 잡았거나 템플릿 태그를 빠뜨려서** 발생한다.

### 4.2 이미지 업로드가 안 될 때 체크할 순서

미디어 업로드 문제는 보통 다음 항목 중 하나가 빠졌을 때 발생한다.

1. 모델에 `ImageField`가 정의되어 있는가?
2. `Pillow`가 설치되어 있는가?
3. `MEDIA_ROOT`, `MEDIA_URL`이 설정되어 있는가?
4. URLConf에서 `static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)`가 연결되어 있는가?
5. `<form>`에 `enctype="multipart/form-data"`가 있는가?
6. 뷰에서 `request.FILES`를 함께 전달했는가?
7. 템플릿에서 `article.image.url`을 출력할 때 조건문으로 감쌌는가?

이 흐름은 사실 하나의 세트로 외우는 것이 좋다. 파일 업로드 기능은 한 부분만 맞아서는 동작하지 않고, **모델·설정·템플릿·뷰**가 모두 맞물려야 한다.

### 4.3 문제를 보면 어떤 신호를 포착해야 하는가

- “공통 CSS를 프로젝트 전체에서 관리하고 싶다” → `STATICFILES_DIRS`
- “사용자가 직접 파일을 업로드한다” → Media 설정 필요
- “이미지가 DB에 그대로 저장되나요?” → 아니다, 경로 문자열이 저장된다
- “게시글마다 이미지가 없을 수도 있다” → `blank=True` + 템플릿 조건문
- “업데이트에서도 이미지 교체가 안 된다” → `request.FILES`, `enctype` 누락 확인

🧠 기억할 것: Django에서 파일 관련 문제는 대부분 **경로**, **URL**, **폼 인코딩**, **FILES 전달 여부** 중 하나에서 발생한다.

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의에서 특히 중요하게 남는 지점은, 정적 파일과 미디어 파일을 단순히 “비슷한 파일”로 보면 안 된다는 점이다. 둘 다 이미지일 수는 있지만, 하나는 개발자가 미리 준비한 자원이고, 다른 하나는 사용자 요청으로 새로 생기는 데이터다. 이 차이를 이해하면 왜 설정도 나뉘고, 처리 흐름도 달라지는지가 훨씬 선명해진다.

또 하나 인상적인 점은, 업로드 기능이 생각보다 많은 요소를 함께 요구한다는 것이다. 모델 하나만 추가한다고 끝나는 것이 아니라, 폼의 인코딩 방식, 뷰의 `request.FILES`, URL 설정, 템플릿의 출력 조건까지 모두 연결되어야 한다. 이런 점에서 이미지 업로드는 Django의 여러 계층이 어떻게 맞물리는지 보여주는 좋은 예제이기도 하다.

확장해서 공부해 볼 만한 포인트는 다음과 같다.

- `FileField`와 `ImageField`의 차이
- 배포 환경에서 Nginx, S3로 정적/미디어 파일을 서빙하는 구조
- 사용자별 업로드 디렉터리 설계
- 업로드 파일 이름 중복 처리와 보안 이슈

---

## 6. 요약 정리

- `Static files`는 개발자가 미리 준비한 CSS, JS, 이미지 파일이다.
- 정적 파일은 앱의 `static/` 폴더나 `STATICFILES_DIRS`에 두고, 템플릿에서 `{% static %}` 으로 불러온다.
- `STATIC_URL`은 정적 파일의 웹 주소 접두사다.
- `Media files`는 사용자가 업로드하는 파일이며, 별도 저장과 제공 설정이 필요하다.
- `MEDIA_ROOT`는 실제 저장 경로, `MEDIA_URL`은 웹 접근 주소다.
- `ImageField`는 실제 파일은 서버에 저장하고, DB에는 파일 경로 문자열만 저장한다.
- 이미지 업로드를 구현하려면 `multipart/form-data`, `request.FILES`, 미디어 URL 연결이 모두 필요하다.
- 업로드 이미지는 `article.image.url`로 출력하고, 이미지가 없을 수 있으므로 조건문으로 감싸는 것이 안전하다.
- `upload_to`는 문자열, 날짜 패턴, 함수로 유연하게 설계할 수 있다.

📌 핵심: 정적 파일은 “미리 준비된 자원”, 미디어 파일은 “사용자가 만들어내는 자원”이며, Django는 이 둘을 다른 규칙으로 관리한다.

🧠 기억할 것: 파일 관련 오류는 대부분 경로, URL, 폼 인코딩, `request.FILES` 누락에서 시작된다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. `STATIC_URL`과 `MEDIA_URL`은 각각 어떤 역할을 하는가?
2. `ImageField`를 사용했을 때 실제 이미지 파일과 데이터베이스에는 각각 무엇이 저장되는가?
3. 파일 업로드 폼에 `enctype="multipart/form-data"`가 꼭 필요한 이유는 무엇인가?
4. 템플릿에서 `article.image.url`을 바로 출력하지 않고 `{% if article.image %}`로 감싸는 이유는 무엇인가?
5. `STATICFILES_DIRS`는 언제 필요한가? 앱 내부 `static/` 폴더만으로 부족한 상황을 예로 들어 설명해 보자.
6. create와 update 뷰 모두에서 `request.FILES`가 필요한 이유는 무엇인가?
