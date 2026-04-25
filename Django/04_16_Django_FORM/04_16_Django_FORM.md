# 04.16 Django Form

- 🎯 글의 목표: Django Form과 ModelForm이 왜 필요한지 이해하고, 입력 검증부터 생성·수정 로직 통합까지 한 흐름으로 정리한다.
- 🧩 핵심 키워드: `Form`, `ModelForm`, `widgets`, `Meta`, `fields`, `exclude`, `is_valid()`, `save()`, `request.method`, `instance`
- ⭐ 중요도: 상
- 📝 한눈에 보는 내용: HTML form만으로는 입력 검증을 안전하게 처리하기 어렵다. Django Form은 입력 수집과 유효성 검사를 체계화하고, ModelForm은 여기에 모델 연동까지 더해 생성·수정 로직을 훨씬 간결하게 만든다. 마지막에는 GET/POST 분기를 활용해 `new/create`, `edit/update`를 하나의 view로 묶는 흐름까지 이어진다.
- 🔗 관련 문제 / 주제(있다면): Django CRUD, 사용자 입력 검증, 템플릿 렌더링, HTTP method 분기, 게시글 생성/수정 폼

---

## 1. 들어가며

게시글을 작성하거나 수정하는 기능은 겉으로 보면 단순해 보이지만, 실제로는 꽤 많은 책임을 함께 갖고 있다.  
사용자에게 입력창을 보여줘야 하고, 제출된 데이터를 받아야 하며, 그 값이 비어 있지는 않은지, 형식이 맞는지, 저장해도 괜찮은지까지 확인해야 한다.

문제는 이 과정을 HTML `form`만으로 처리하면 화면은 만들 수 있어도, **입력 데이터가 정말 유효한지**를 체계적으로 다루기가 어렵다는 점이다.  
여기서 Django Form이 등장한다. Form은 단순히 입력창을 예쁘게 그려주는 도구가 아니라, **사용자 입력을 수집하고 검증하고 다시 화면에 돌려주는 흐름을 표준화하는 장치**다.

이번 강의는 그 출발점인 `Form`에서 시작해, 데이터베이스와 연결되는 `ModelForm`, 그리고 이를 실제 CRUD 흐름에 녹여서 `new/create`, `edit/update`를 정리하는 구조까지 이어진다.  
즉, 이번 내용의 핵심은 “폼을 만든다”가 아니라, **입력 처리 로직을 더 안전하고 더 읽기 좋게 바꾸는 방법**을 배우는 데 있다.

---

## 2. 핵심 개념 정리

이번 강의의 흐름은 아래 순서로 이해하면 가장 자연스럽다.

1. **HTML form의 한계 파악**  
   화면에서 입력은 받을 수 있지만, 서버에 들어오는 값이 정말 올바른지 직접 챙겨야 한다.

2. **Form Class 도입**  
   입력 필드를 Python 코드로 정의하고, Django가 그 정보를 바탕으로 HTML과 유효성 검사를 함께 처리하게 만든다.

3. **widgets로 표현 조정**  
   Form 필드가 브라우저에서 어떤 `input`, `textarea`로 보일지, 그리고 어떤 속성을 가질지 세밀하게 조정한다.

4. **ModelForm으로 확장**  
   모델과 폼을 연결해, 입력 폼 생성과 DB 저장을 하나의 흐름으로 묶는다.

5. **`is_valid()`와 `save()` 이해**  
   값이 유효한지 먼저 검사한 뒤, 유효할 때만 저장하는 안전한 흐름을 만든다.

6. **request method에 따라 view 구조화**  
   생성은 `GET`과 `POST`, 수정도 `GET`과 `POST`라는 공통 구조를 가지므로, 분기만 잘 잡으면 두 개의 함수를 하나로 합칠 수 있다.

7. **키워드 인자와 수동 렌더링까지 확장**  
   `data`, `instance`의 의미를 정확히 이해하고, 필요할 때는 `{{ form }}` 전체 출력 대신 필드를 수동으로 렌더링할 수 있다.

이 큰 흐름을 잡고 보면, Form과 ModelForm은 단순한 문법 추가가 아니라 **입력 처리 전체를 정리하는 설계 도구**라는 점이 더 선명하게 보인다.

---

## 3. 본문 정리

## 3.1 HTML form만으로는 왜 부족할까

**한 줄 정의**  
HTML `form`은 입력을 제출하는 출발점이지만, 데이터가 올바른지까지 책임져 주지는 않는다.

게시글 작성 페이지를 떠올리면, 사용자는 제목과 내용을 입력하고 제출 버튼을 누른다.  
이때 브라우저는 값을 서버로 보내 주지만, 그 값이 비어 있거나, 형식이 틀리거나, 저장하면 안 되는 값인지까지 자동으로 정리해 주지는 않는다.

그래서 입력 기능을 만들 때는 단순히 “제출된다”보다 **“유효한 값만 다음 단계로 넘어간다”**가 더 중요하다.

### 기본적으로 필요한 입력 검증 관점

- 필수값이 비어 있지 않은가
- 형식이 올바른가
- 모델 제약조건을 어기지 않는가
- 에러가 났을 때 사용자에게 다시 보여줄 수 있는가

이 과정을 매번 직접 구현하면 중복도 많고 실수도 잦아진다.  
Django Form은 바로 이 지점을 줄여 주는 도구다.

📌 **핵심**: HTML form은 “입력을 보낸다”에 가깝고, Django Form은 “입력을 안전하게 다룬다”에 가깝다.

---

## 3.2 Form Class: 입력 필드를 Python 코드로 정의하기

**한 줄 정의**  
Form Class는 사용자 입력 필드를 Python 코드로 선언하고, 그 정의를 바탕으로 렌더링과 검증을 함께 처리하게 만드는 클래스다.

강의에서는 먼저 제목과 내용을 받는 `ArticleForm`을 `forms.Form`으로 정의한다.

![Form Class 정의](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-23 233506.jpg>)

```python
# articles/forms.py
from django import forms


class ArticleForm(forms.Form):
    # 제목은 문자열 입력을 받는 필드다.
    # max_length=10은 최대 길이 제한도 함께 건다는 뜻이다.
    title = forms.CharField(max_length=10)

    # 내용 역시 문자열 입력을 받는다.
    # 별도 옵션을 주지 않으면 기본 검증 규칙이 적용된다.
    content = forms.CharField()
```

여기서 중요한 점은, 이 코드가 단순한 “파이썬 변수 선언”이 아니라는 것이다.  
Django는 이 필드 정의를 보고 HTML 입력 요소를 만들고, 제출된 값이 유효한지도 검사한다.

쉽게 말하면, Form Class는 **입력 화면의 설계도이면서 검증 규칙표** 역할도 함께 한다.

### Form을 view와 template에 연결하는 흐름

Form을 만들었다고 바로 화면에 보이는 것은 아니다.  
view에서 form 인스턴스를 만든 뒤, template으로 넘겨야 한다.

![new view에서 form 인스턴스 생성](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-23 233547.jpg>)

```python
# articles/views.py
from .forms import ArticleForm


def new(request):
    # 빈 폼 인스턴스를 생성한다.
    form = ArticleForm()

    # 템플릿에서 사용할 수 있도록 context에 담는다.
    context = {
        'form': form,
    }
    return render(request, 'articles/new.html', context)
```

그리고 템플릿에서는 `{{ form }}`으로 폼 전체를 렌더링할 수 있다.

![템플릿에서 form 전체 렌더링](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 162637.jpg>)

![렌더링 결과와 실제 생성된 input 요소](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 162717.jpg>)

```html
<!-- articles/new.html -->
<h1>NEW</h1>
<form action="{% url 'articles:create' %}" method="POST">
  {% csrf_token %}
  {{ form }}
  <input type="submit">
</form>
```

위처럼 템플릿에는 `{{ form }}` 한 줄만 적었지만, 실제 브라우저에서는 `label`, `input`, `required`, `maxlength`, `id`, `name` 같은 요소가 자동으로 생성된다.  
즉, Form Class는 “입력창을 하나씩 손으로 작성하는 작업” 일부를 대체한다.

![Form class가 대체하는 것](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 162754.jpg>)

⚠️ **주의**  
`{{ form }}`은 빠르고 편하지만, 화면 구조를 세밀하게 제어하기는 어렵다.  
초반 학습에는 편하지만, 커스텀이 필요해질수록 필드를 직접 렌더링하는 방식도 함께 알아둘 필요가 있다.

📌 **핵심**: Form Class는 입력 필드 정의, HTML 렌더링, 기본 검증을 한 곳에서 다루게 해 준다.

---

## 3.3 Widgets: 폼이 브라우저에서 어떻게 보일지 정하기

**한 줄 정의**  
Widget은 Form 필드가 HTML에서 어떤 입력 요소로 출력될지 결정하는 표현 담당 객체다.

같은 문자열 필드라도 브라우저에서는 한 줄 입력창으로 보일 수도 있고, 여러 줄 입력창으로 보일 수도 있다.  
이 차이를 정하는 것이 widget이다.

강의에서 강조한 것처럼 widget은 **유효성 검사 규칙 자체를 바꾸는 것보다, 화면에서 어떻게 보일지를 바꾸는 역할**에 가깝다.

![widget 적용 예시](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 163019.jpg>)

```python
# articles/forms.py
from django import forms


class ArticleForm(forms.Form):
    title = forms.CharField(
        max_length=10,
        widget=forms.TextInput(
            attrs={
                'placeholder': 'Enter the title',
            }
        ),
    )
```

위 코드에서 핵심은 `widget=forms.TextInput(...)` 부분이다.  
그리고 그 안의 `attrs`는 실제 HTML 태그의 속성으로 반영된다.

쉽게 말하면,

- `widget`은 “어떤 입력창으로 보일지”
- `attrs`는 “그 입력창에 어떤 속성을 줄지”

를 정하는 셈이다.

### 왜 widget이 중요한가

폼을 쓰기 시작하면 곧바로 “기능은 되는데 화면이 아쉽다”는 지점에 닿는다.  
이때 widget을 알면 placeholder, class, rows, cols 같은 표현 요소를 폼 정의 단계에서 함께 다룰 수 있다.

📌 **핵심**: widget은 검증보다 표현에 가깝고, `attrs`는 그 표현의 세부 속성을 조정한다.

---

## 3.4 ModelForm: 모델과 연결되는 폼

**한 줄 정의**  
ModelForm은 모델 필드를 바탕으로 폼을 자동 생성하고, 저장까지 쉽게 연결할 수 있게 해 주는 폼 클래스다.

Form은 입력 수집과 검증에 강하지만, DB 저장까지 직접 이어 붙여야 할 때 반복이 많아질 수 있다.  
반면 ModelForm은 모델 정보를 알고 있기 때문에, “어떤 필드를 받을지”와 “어떻게 저장할지”를 훨씬 자연스럽게 연결한다.

### Form과 ModelForm의 차이

- **Form**
  - 입력값 수집과 검증이 중심
  - DB 저장과 직접 연결되지 않음
  - 검색창, 로그인 폼처럼 저장이 목적이 아닐 때 적합

- **ModelForm**
  - 모델 기반으로 폼 필드 생성
  - 저장까지 연결 가능
  - 게시글 작성, 회원가입처럼 DB 반영이 필요한 경우에 적합

강의에서는 기존 `ArticleForm`을 `ModelForm`으로 바꾸는 흐름을 보여 준다.

![ModelForm class 정의](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 163322.jpg>)

```python
# articles/forms.py
from django import forms
from .models import Article


class ArticleForm(forms.ModelForm):
    class Meta:
        # 어떤 모델과 연결할지 지정한다.
        model = Article

        # 모델의 어떤 필드를 폼에 포함할지 지정한다.
        fields = '__all__'
```

이제 폼은 `Article` 모델의 필드 정보를 기반으로 자동 구성된다.  
즉, title과 content를 폼에서 다시 하나씩 적는 대신, 모델을 기준으로 가져오게 된다.

![ModelForm의 동작 개념](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 163352.jpg>)

![ModelForm class가 대체하는 것](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 163426.jpg>)

### Meta class는 왜 필요한가

ModelForm 안의 `Meta` class는 “이 폼이 어떤 모델과 연결되고, 어떤 필드를 사용할지”를 적는 설정 공간이다.  
여기서 중요한 점은, `Meta`를 단순히 파이썬 문법 차원의 내부 클래스로만 이해하면 안 된다는 것이다.  
Django는 ModelForm의 동작을 설명하는 메타 정보로 이 클래스를 해석한다.

### `fields`와 `exclude`

![fields와 exclude 예시](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 163657.jpg>)

```python
class ArticleForm(forms.ModelForm):
    class Meta:
        model = Article
        fields = ('title',)
        # 또는
        # exclude = ('title',)
```

- `fields`: 폼에 **포함할 필드**를 명시
- `exclude`: 폼에서 **제외할 필드**를 명시

보통 학습 단계에서는 `fields = '__all__'`이 이해하기 쉽지만, 실제 프로젝트에서는 필요한 필드만 명시하는 방식이 더 안전한 경우가 많다.

⚠️ **주의**  
모델에 존재한다고 해서 모든 필드를 무조건 폼으로 노출하는 것은 위험할 수 있다.  
특히 작성자, 권한, 생성일 같은 값은 사용자가 직접 입력하지 않도록 구분해야 한다.

📌 **핵심**: ModelForm은 “모델 기반 폼 자동 생성 + 저장 연결”이라는 점에서 Form보다 CRUD에 훨씬 가깝다.

---

## 3.5 `is_valid()`: 유효한 값만 다음 단계로 보내기

**한 줄 정의**  
`is_valid()`는 폼에 들어온 데이터를 여러 규칙으로 검사하고, 유효하면 `True`, 그렇지 않으면 `False`를 반환하는 메서드다.

폼을 `request.POST`와 연결했다고 해서 바로 저장하면 안 된다.  
사용자가 제목을 비워 두었을 수도 있고, 길이 제한을 넘겼을 수도 있기 때문이다.  
그래서 저장 전에 반드시 거쳐야 하는 관문이 `is_valid()`다.

![ModelForm을 작성한 create 로직](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 163839.jpg>)

```python
# articles/views.py
from .forms import ArticleForm


def create(request):
    # 사용자가 제출한 데이터를 폼에 바인딩한다.
    form = ArticleForm(request.POST)

    # 유효성 검사를 통과했을 때만 저장한다.
    if form.is_valid():
        article = form.save()
        return redirect('articles:detail', article.pk)

    # 유효하지 않다면 에러가 담긴 폼을 다시 돌려준다.
    context = {
        'form': form,
    }
    return render(request, 'articles/new.html', context)
```

### 공백 입력 시 에러가 나는 이유

![유효성 검사 에러 메시지 출력](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 163922.jpg>)

모델 필드에서 `blank=True`를 따로 주지 않았다면, Django는 기본적으로 빈 값을 허용하지 않는다.  
따라서 제목이나 내용을 비워 두고 제출하면 `is_valid()`는 `False`가 되고, 폼 내부에는 해당 에러 메시지가 담긴다.

![빈 값이 False가 되고 에러가 폼에 쌓이는 흐름](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 164125.jpg>)

```python
class Article(models.Model):
    title = models.CharField(max_length=10)
    content = models.TextField()
    created_at = models.DateField(auto_now_add=True)
    updated_at = models.DateField(auto_now=True)


def create(request):
    form = ArticleForm(request.POST)
    if form.is_valid():
        article = form.save()
        return redirect('articles:detail', article.pk)

    context = {
        'form': form,
    }
    return render(request, 'articles/new.html', context)
```

여기서 중요한 점은, **유효성 검사 실패도 정상 흐름의 일부**라는 것이다.  
에러가 났다고 view가 끝나는 것이 아니라, 에러 메시지가 포함된 form을 다시 템플릿에 보내 사용자에게 무엇이 잘못됐는지 보여준다.

⚠️ **주의**  
`request.POST`가 있다는 사실과 데이터가 유효하다는 사실은 다르다.  
값이 제출되었다고 바로 저장하지 말고, 항상 `is_valid()`를 거쳐야 한다.

📌 **핵심**: `is_valid()`는 저장 전 마지막 확인 단계이며, 실패한 경우에도 form 객체 안에 중요한 정보가 남는다.

---

## 3.6 `save()`: 생성과 수정을 같은 메서드로 처리하기

**한 줄 정의**  
`save()`는 유효한 ModelForm 데이터를 기반으로 모델 인스턴스를 생성하거나 수정하고 DB에 반영하는 메서드다.

ModelForm의 큰 장점은 검증 다음 단계가 자연스럽다는 점이다.  
직접 `Article(...)`을 만들고, 필드 하나씩 넣고, 다시 `save()`를 호출하는 반복을 줄일 수 있다.

### 생성(create)에서의 `save()`

```python
form = ArticleForm(request.POST)
if form.is_valid():
    article = form.save()
```

이 경우에는 새로운 `Article` 객체가 만들어지고 저장된다.

### 수정(update)에서의 `save()`

```python
form = ArticleForm(request.POST, instance=article)
if form.is_valid():
    form.save()
```

이 경우에는 새 객체를 만드는 것이 아니라, 기존 `article` 인스턴스의 값을 수정한 뒤 저장한다.

![save()가 생성과 수정을 구분하는 기준](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 165457.jpg>)

쉽게 말하면 `save()`는 같은 메서드지만, **어떤 form을 만들었느냐**에 따라 동작이 달라진다.

- `ArticleForm(request.POST)` → 새 객체 생성
- `ArticleForm(request.POST, instance=article)` → 기존 객체 수정

📌 **핵심**: `save()`는 단일 메서드이지만, `instance` 유무에 따라 생성과 수정이 갈린다.

---

## 3.7 edit/update에도 ModelForm 적용하기

**한 줄 정의**  
수정 기능에서도 ModelForm을 사용하면, 기존 값을 폼에 채워 넣고 검증 후 저장하는 흐름을 일관되게 유지할 수 있다.

생성(create)만 폼으로 바꾸고 수정(update)은 예전 방식으로 남겨 두면 구조가 어색해진다.  
그래서 edit 화면과 update 처리도 같은 원리로 정리하는 것이 중요하다.

![ModelForm을 적용한 edit 로직](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 164157.jpg>)

```python
def edit(request, pk):
    article = Article.objects.get(pk=pk)

    # 기존 article 값을 폼 초기값으로 채운다.
    form = ArticleForm(instance=article)

    context = {
        'article': article,
        'form': form,
    }
    return render(request, 'articles/edit.html', context)
```

![ModelForm을 적용한 update 로직](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 164229.jpg>)

```python
def update(request, pk):
    article = Article.objects.get(pk=pk)

    # POST 데이터와 기존 객체를 함께 전달한다.
    form = ArticleForm(request.POST, instance=article)

    if form.is_valid():
        form.save()
        return redirect('articles:detail', article.pk)

    context = {
        'article': article,
        'form': form,
    }
    return render(request, 'articles/edit.html', context)
```

여기서 `instance=article`은 매우 중요하다.  
이 값이 있어야 Django가 “이건 새 글 작성이 아니라 기존 글 수정이구나”라고 이해한다.

⚠️ **주의**  
수정 로직에서 `instance`를 빼고 `ArticleForm(request.POST)`만 쓰면, 수정이 아니라 새 객체 생성으로 이어질 수 있다.

📌 **핵심**: 수정 폼은 기존 인스턴스를 form에 연결해 “초기값 표시 + 같은 객체 갱신”을 함께 처리한다.

---

## 3.8 request method로 `new/create`를 하나로 묶기

**한 줄 정의**  
생성 기능은 `GET`일 때 빈 폼을 보여주고, `POST`일 때 제출된 값을 검증·저장하므로 하나의 view로 구조화할 수 있다.

처음에는 보통 아래처럼 두 개의 함수를 나눠 만든다.

![분리된 new와 create 함수](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 165840.jpg>)

- `new()`는 빈 폼을 보여주는 함수
- `create()`는 제출된 값을 받아 저장하는 함수

목적은 같고, request method만 다르다.  
이 공통점을 이용하면 두 함수를 하나로 합칠 수 있다.

![new/create 함수 결합 개념](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 165902.jpg>)

![새로운 create view 함수](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 165949.jpg>)

```python
# articles/views.py
def create(request):
    # POST 요청이면 사용자가 제출한 데이터를 검증한다.
    if request.method == 'POST':
        form = ArticleForm(request.POST)
        if form.is_valid():
            article = form.save()
            return redirect('articles:detail', article.pk)

    # GET 요청이거나, POST 검증에 실패한 경우 여기로 온다.
    else:
        form = ArticleForm()

    context = {
        'form': form,
    }
    return render(request, 'articles/create.html', context)
```

### 이 구조가 왜 좋은가

- 같은 목적의 로직이 흩어지지 않는다.
- GET과 POST의 역할이 한 함수 안에서 분명하게 드러난다.
- 유효성 검사 실패 시에도 같은 템플릿을 다시 보여주기 쉽다.

![POST 분기 강조](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170033.jpg>)

![POST일 때 저장 로직 처리](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170117.jpg>)

![POST가 아닐 때 빈 폼 생성](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170205.jpg>)

그리고 이 구조로 바꾸면 URL과 템플릿도 함께 정리해야 한다.

![사용하지 않게 된 new url 제거](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170342.jpg>)

![new 키워드를 create로 변경한 템플릿](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170412.jpg>)

![변경 후 화면 흐름](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170445.jpg>)

또한 같은 URL이라도 method에 따라 의미가 달라진다는 점이 중요하다.

![GET과 POST에 따른 같은 URL의 역할 차이](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170517.jpg>)

- `GET /articles/create/` → 작성 페이지 보여주기
- `POST /articles/create/` → 작성 요청 처리하기

이 지점을 이해하면 “왜 URL 하나로도 두 역할이 가능하지?”라는 의문이 풀린다.

📌 **핵심**: 생성 화면과 생성 처리의 차이는 URL보다 method에 있고, 그래서 하나의 view로 묶을 수 있다.

---

## 3.9 request method로 `edit/update`도 하나로 묶기

**한 줄 정의**  
수정 기능 역시 `GET`이면 기존 값을 담은 폼을 보여주고, `POST`이면 수정 요청을 처리하므로 하나의 view로 통합할 수 있다.

생성과 같은 논리가 수정에도 그대로 적용된다.  
기존에는 `edit()`와 `update()`가 따로 있었지만, 둘 다 결국 “특정 글을 수정한다”는 같은 목적을 갖는다.

![새로운 update view 함수](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170613.jpg>)

```python
def update(request, pk):
    article = Article.objects.get(pk=pk)

    if request.method == 'POST':
        # 제출된 수정 데이터를 기존 객체에 반영한다.
        form = ArticleForm(request.POST, instance=article)
        if form.is_valid():
            form.save()
            return redirect('articles:detail', article.pk)
    else:
        # 수정 화면에 들어왔을 때는 기존 값이 채워진 폼을 만든다.
        form = ArticleForm(instance=article)

    context = {
        'article': article,
        'form': form,
    }
    return render(request, 'articles/update.html', context)
```

![edit url 제거](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170644.jpg>)

![edit를 update로 정리한 템플릿/링크](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170736.jpg>)

이 구조에서 특히 보기 좋은 부분은 생성과 수정이 서로 닮아진다는 점이다.

- 생성: `request.POST`만 필요
- 수정: `request.POST + instance=article` 필요

즉, 둘의 차이는 구조 전체가 아니라 **기존 인스턴스를 함께 다루느냐의 차이**로 정리된다.

📌 **핵심**: update는 create와 구조가 거의 같고, 차이는 기존 객체를 함께 넘긴다는 점이다.

---

## 3.10 ModelForm 키워드 인자: `data`와 `instance`

**한 줄 정의**  
ModelForm을 만들 때 `data`는 제출된 값, `instance`는 수정 대상 객체를 뜻한다.

강의에서는 생성자 시그니처를 보여 주면서, 왜 `request.POST`는 위치 인자로 바로 들어가고 `instance`는 이름을 꼭 써야 하는지도 짚는다.

![BaseModelForm 생성자와 data, instance 위치](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170905.jpg>)

```python
form = ArticleForm(request.POST, instance=article)
```

이 코드는 짧지만 의미가 분명하다.

- `request.POST` → 폼에 들어갈 실제 사용자 입력 데이터
- `instance=article` → 이 데이터를 어떤 기존 객체에 반영할지

여기서 `request.POST`는 첫 번째 위치 인자라서 생략 없이 바로 쓸 수 있지만,  
`instance`는 특정 의미를 가진 키워드 인자이므로 이름을 명확히 적어야 한다.

💡 **포인트**  
이 차이를 이해하면 생성과 수정 로직을 머릿속에서 더 정확히 구분할 수 있다.

- 생성: `ArticleForm(request.POST)`
- 수정 화면: `ArticleForm(instance=article)`
- 수정 처리: `ArticleForm(request.POST, instance=article)`

📌 **핵심**: `data`는 입력값, `instance`는 수정 대상 객체다.

---

## 3.11 Widgets 응용: label, class, placeholder, 에러 메시지 커스터마이징

**한 줄 정의**  
ModelForm에서도 필드를 직접 재정의하면 label, widget, attrs, error_messages 등을 세밀하게 바꿀 수 있다.

처음에는 ModelForm이 모델 기반으로 자동 폼을 만든다는 점이 편리하지만, 실제 프로젝트에서는 화면 문구와 스타일도 손보고 싶어진다.  
이때는 ModelForm 안에서 특정 필드를 다시 선언하면 된다.

![widget 응용 코드](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170934.jpg>)

```python
# articles/forms.py
from django import forms
from .models import Article


class ArticleForm(forms.ModelForm):
    title = forms.CharField(
        label='제목',
        widget=forms.TextInput(
            attrs={
                'class': 'my-title',
                'placeholder': 'Enter the title',
            }
        ),
    )

    content = forms.CharField(
        label='내용',
        widget=forms.Textarea(
            attrs={
                'class': 'my-content',
                'placeholder': 'Enter the content',
                'rows': 5,
                'cols': 50,
            }
        ),
        error_messages={
            'required': '내용을 입력해주세요.',
        }
    )

    class Meta:
        model = Article
        fields = '__all__'
```

![widget 응용 결과 화면](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 170958.jpg>)

여기서 볼 수 있는 포인트는 다음과 같다.

- `label='제목'` → 사용자에게 보이는 필드 이름 변경
- `class='my-title'` → CSS 연결용 클래스 지정
- `placeholder='Enter the title'` → 힌트 문구 표시
- `rows`, `cols` → textarea 크기 조정
- `error_messages` → 기본 오류 문구를 사용자 친화적으로 바꾸기

⚠️ **주의**  
widget 커스터마이징은 표현을 바꾸는 데 강력하지만, 저장 여부를 결정하는 핵심은 여전히 `is_valid()`와 모델 제약조건이다.  
즉, 예쁘게 보이게 하는 것과 안전하게 저장하는 것은 구분해서 이해해야 한다.

📌 **핵심**: ModelForm도 자동 생성에만 머무르지 않고, 필요한 필드는 직접 재정의해 세밀하게 다듬을 수 있다.

---

## 3.12 필드를 수동으로 렌더링하기

**한 줄 정의**  
폼 전체를 한 번에 출력하는 대신, 각 필드와 에러를 템플릿에서 직접 배치하는 방식이다.

`{{ form }}`은 빠르지만, 화면 구조를 원하는 대로 만들기 어렵다.  
그래서 실제로는 아래처럼 필드별로 직접 렌더링하는 경우가 많다.

![필드를 수동으로 렌더링하는 템플릿](<../assets/images/04_16_Django_FORM/화면 캡처 2026-04-25 171033.jpg>)

```html
{{ form.non_field_errors }}
<form action="..." method="POST">
  {% csrf_token %}

  <div>
    {{ form.title.errors }}
    <label for="{{ form.title.id_for_label }}">Title:</label>
    {{ form.title }}
  </div>

  <div>
    {{ form.content.errors }}
    <label for="{{ form.content.id_for_label }}">Content:</label>
    {{ form.content }}
  </div>

  <input type="submit">
</form>
```

이 방식의 장점은 분명하다.

- 에러 메시지를 원하는 위치에 둘 수 있다.
- label과 input 배치를 자유롭게 조절할 수 있다.
- 필드별 CSS 적용이 쉬워진다.
- 실제 서비스 화면처럼 더 세밀하게 구성할 수 있다.

쉽게 말하면, `{{ form }}`은 빠른 자동 출력이고, 수동 렌더링은 **구조를 직접 설계하는 방식**이다.

⚠️ **주의**  
수동 렌더링을 할 때도 `{% csrf_token %}`과 에러 출력은 빠뜨리지 않는 것이 중요하다.  
특히 에러 메시지를 출력하지 않으면 검증이 실패해도 사용자는 이유를 알기 어렵다.

📌 **핵심**: 수동 렌더링은 템플릿 제어권을 높여 주지만, 필드와 에러를 직접 챙겨야 한다.

---

## 4. 적용 관점에서 다시 보기

이번 강의 내용을 실제 구현 흐름으로 다시 묶어 보면, 게시글 생성과 수정은 결국 아래 순서로 정리된다.

### 4.1 게시글 생성(create)에서 떠올릴 흐름

1. `GET` 요청이면 빈 폼을 보여준다.
2. `POST` 요청이면 `request.POST`로 바인딩된 폼을 만든다.
3. `is_valid()`로 검사한다.
4. 통과하면 `save()` 후 상세 페이지로 이동한다.
5. 실패하면 에러가 담긴 form을 다시 같은 템플릿에 보여준다.

이 흐름을 기억하면, “입력 폼을 띄우는 view”와 “제출을 처리하는 view”를 굳이 따로 떼어 생각하지 않아도 된다.

### 4.2 게시글 수정(update)에서 떠올릴 흐름

1. 먼저 수정 대상 객체를 가져온다.
2. `GET`이면 `instance=article`로 기존 값이 채워진 폼을 만든다.
3. `POST`이면 `request.POST`와 `instance=article`을 함께 넣는다.
4. `is_valid()` 후 `save()`로 기존 객체를 갱신한다.
5. 실패하면 에러와 함께 수정 폼을 다시 보여준다.

수정에서 핵심 신호는 항상 **“기존 인스턴스가 필요하다”**는 점이다.

### 4.3 문제를 보면 어떤 신호를 포착해야 할까

- **저장할 필요가 없는 입력인가?** → `Form`
- **모델에 저장해야 하는 입력인가?** → `ModelForm`
- **화면만 보여주는 요청인가?** → `GET`
- **실제 제출을 처리하는 요청인가?** → `POST`
- **새 객체 생성인가?** → `instance` 없음
- **기존 객체 수정인가?** → `instance` 있음

### 4.4 자주 하는 실수 패턴

- `request.POST`만 받았다고 바로 저장하기
- 수정 로직에서 `instance`를 빼먹기
- 에러가 났을 때 빈 폼을 다시 만들어서 기존 입력과 에러를 잃어버리기
- 템플릿을 수동 렌더링하면서 에러 메시지를 출력하지 않기
- `fields='__all__'`을 무조건 습관처럼 쓰기

🧠 **기억할 것**: Form은 문법 문제가 아니라 흐름 문제다.  
사용자 입력을 어떤 순서로 받고, 검증하고, 다시 보여주고, 저장할지를 구조적으로 떠올리는 것이 중요하다.

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의에서 가장 중요한 변화는 “폼을 쓴다”가 아니라, **입력 처리 로직을 Django스럽게 정리한다**는 관점이다.

초반에는 `{{ form }}` 한 줄로 입력창이 자동 생성되는 부분이 편리하게 느껴지지만, 강의가 진행될수록 진짜 핵심은 그 뒤에 있다.  
입력 필드 정의, 모델 연동, 유효성 검사, 저장, 에러 메시지 재출력, 그리고 GET/POST에 따른 view 통합까지 이어지는 흐름이 정리되면서, CRUD 코드 전체가 훨씬 읽기 쉬워진다.

특히 `ModelForm + is_valid() + save()` 조합은 단순히 코드를 줄이는 수준이 아니라,  
**잘못된 데이터는 막고, 올바른 데이터만 저장하는 기본 규율**을 코드 안에 자연스럽게 녹여 준다는 점에서 중요하다.

앞으로 더 확장해서 공부해볼 만한 포인트는 다음과 같다.

- `clean_<field명>()`과 `clean()`을 이용한 커스텀 유효성 검사
- `commit=False`를 활용한 저장 전 후처리
- `class Meta`에서 widgets를 함께 설정하는 방식
- Bootstrap 같은 CSS 프레임워크와 폼 렌더링 연결
- CBV(CreateView, UpdateView)에서 Form 처리 흐름 비교

---

## 6. 요약 정리

📌 **핵심**

- HTML `form`만으로는 입력 검증을 체계적으로 처리하기 어렵다.
- `Form`은 사용자 입력 수집과 유효성 검사를 정리해 주는 도구다.
- `ModelForm`은 모델과 연결되어 폼 생성과 저장을 더 쉽게 만든다.
- `is_valid()`는 저장 전에 반드시 거쳐야 하는 유효성 검사 단계다.
- `save()`는 `instance` 유무에 따라 생성과 수정을 구분한다.
- 생성과 수정 로직은 `request.method` 분기로 각각 하나의 view로 구조화할 수 있다.
- widget과 수동 렌더링을 활용하면 폼의 표현도 세밀하게 제어할 수 있다.

🧠 **기억할 것**

- `GET`은 폼을 보여주는 요청, `POST`는 폼을 처리하는 요청이다.
- 수정은 항상 “어떤 객체를 수정할 것인가”를 함께 생각해야 하므로 `instance`가 중요하다.
- 유효성 검사 실패 시에도 form 객체는 버리는 값이 아니라, **에러와 입력 흔적을 담고 있는 중요한 상태**다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. HTML `form`만으로 입력 기능을 만들었을 때, Django Form이 추가로 해결해 주는 핵심 문제는 무엇인가?
2. `Form`과 `ModelForm`은 어떤 상황에서 각각 더 적절한가?
3. `is_valid()`를 호출하지 않고 `save()`부터 실행하면 왜 위험한가?
4. `ArticleForm(request.POST)`와 `ArticleForm(request.POST, instance=article)`의 차이를 설명할 수 있는가?
5. 생성(create)과 수정(update)에서 `GET`과 `POST`가 각각 어떤 역할을 하는지 구분할 수 있는가?
6. `{{ form }}` 전체 출력과 필드 수동 렌더링은 어떤 점에서 차이가 있는가?
