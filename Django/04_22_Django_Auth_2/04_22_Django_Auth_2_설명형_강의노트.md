# 04_22 Django Auth 2

- 🎯 글의 목표: Django 인증 시스템의 두 번째 흐름인 **로그아웃, 회원가입, 회원탈퇴, 접근 제한, 회원가입 직후 자동 로그인**을 구현하고, 커스텀 User 모델을 사용하는 이유까지 함께 이해한다.
- 🧩 핵심 키워드: `logout`, `UserCreationForm`, `get_user_model`, `request.user.delete()`, `is_authenticated`, `login_required`, 자동 로그인
- ⭐ 중요도: 상
- 📝 한눈에 보는 내용: 로그인 이후의 인증 기능을 확장하면서, **사용자 생성(Create)과 삭제(Delete)**, 그리고 **인증 여부에 따른 접근 제어**를 실제 Django 코드 흐름으로 정리한다.
- 🔗 관련 문제 / 주제(있다면): Django 인증 시스템, 커스텀 User 모델, 게시글 권한 제어

---

## 1. 들어가며

로그인 기능을 한 번 구현하고 나면, 그 다음에는 자연스럽게 이런 질문이 따라온다.

“로그인한 사용자는 어떻게 로그아웃시키지?”  
“회원가입은 Django가 기본으로 제공하는 폼을 그대로 써도 될까?”  
“로그인하지 않은 사용자가 글을 작성하거나 삭제하려고 하면 어떻게 막아야 할까?”

이번 강의는 바로 그 흐름을 다룬다. 단순히 기능 몇 개를 더 붙이는 시간이 아니라, **인증 시스템이 실제 서비스에서 어떻게 이어져야 하는지**를 배우는 시간이라고 보는 편이 더 정확하다.

특히 이번 내용에서 중요한 점은, 인증 기능이 각각 따로 떨어져 있지 않다는 것이다. 로그아웃은 세션 삭제와 연결되고, 회원가입은 커스텀 User 모델과 연결되며, 회원탈퇴는 현재 로그인한 사용자 정보와 연결된다. 또 `is_authenticated`와 `login_required`는 화면 제어와 권한 제어를 동시에 다루게 만든다.

그래서 이번 정리는 **기능 하나씩 외우는 방식**보다, **인증 흐름 전체를 이어서 이해하는 방식**으로 보는 것이 훨씬 중요하다.

## 2. 핵심 개념 정리

이번 강의의 큰 흐름은 아래 순서로 이어진다.

1. **Logout**  
   로그인 상태를 유지하던 세션을 삭제해, 사용자를 인증되지 않은 상태로 되돌린다.

2. **Signup**  
   새로운 `User` 객체를 생성한다. 이때 Django의 기본 `UserCreationForm`을 그대로 쓰면, 커스텀 User 모델을 사용하는 프로젝트에서는 문제가 생길 수 있다.

3. **Custom UserCreationForm**  
   `get_user_model()`을 사용해 현재 프로젝트에서 활성화된 사용자 모델을 정확히 참조하도록 폼을 다시 작성한다.

4. **Delete Account**  
   현재 로그인된 사용자를 `request.user.delete()`로 삭제한다. 다만 삭제와 세션 정리 순서까지 함께 생각해야 한다.

5. **Access Control**  
   `is_authenticated`로 템플릿과 뷰에서 분기하고, `login_required`로 인증된 사용자만 특정 기능에 접근하게 만든다.

6. **Auto Login After Signup**  
   회원가입 직후 생성된 사용자 객체를 바로 로그인시키면, 사용자 경험이 훨씬 자연스러워진다.

즉, 이번 강의는 “인증 기능을 하나 더 배우는 시간”이 아니라, **사용자 생애주기 전체를 다루는 인증 흐름 정리**라고 볼 수 있다.

## 3. 본문 정리

### 3.1 로그아웃: 인증 상태를 끝내는 가장 기본적인 작업

로그아웃은 한 줄로 말하면 **현재 로그인 상태를 해제하는 과정**이다.

여기서 중요한 점은, 로그아웃이 단순히 화면에서 “로그아웃 버튼을 눌렀다”는 의미가 아니라는 것이다. 실제로는 **서버에 저장된 세션 데이터와 브라우저의 세션 쿠키를 정리하는 과정**이다. 즉, 서버와 클라이언트가 “이 사용자는 더 이상 로그인 상태가 아니다”라고 같은 정보를 갖게 만드는 작업이다.

먼저 URL에 로그아웃 경로를 추가한다.

![로그아웃 URL 등록](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225143-1.png>)

그 다음 뷰에서는 Django가 제공하는 `logout` 함수를 호출한다. 충돌을 피하기 위해 `auth_logout`처럼 별칭을 붙여 쓰는 방식도 자주 사용한다.

![로그아웃 뷰 작성](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225221-1.png>)

```python
from django.contrib.auth import logout as auth_logout
from django.shortcuts import redirect


def logout(request):
    # 현재 요청과 연결된 세션 정보를 정리한다.
    auth_logout(request)

    # 로그아웃 후에는 메인 페이지로 이동시킨다.
    return redirect('articles:index')
```

코드 자체는 짧지만, 의미는 분명하다.

- `request` 안에는 현재 사용자의 세션 정보가 연결되어 있다.
- `auth_logout(request)`는 이 요청과 연결된 로그인 상태를 종료한다.
- 이후에는 보통 메인 페이지나 로그인 페이지로 이동시킨다.

로그아웃 버튼은 반드시 **POST 방식**으로 보내는 것이 좋다. 인증 상태를 바꾸는 작업은 조회가 아니라 변경이기 때문이다. 그리고 CSRF 공격을 막기 위해 `csrf_token`도 함께 넣는다.

![로그아웃 버튼과 POST 폼](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225243-1.png>)

```html
<form action="{% url 'accounts:logout' %}" method="POST">
  {% csrf_token %}
  <input type="submit" value="Logout">
</form>
```

#### 코드 흐름 해설

로그아웃 구현은 다음 순서로 이해하면 쉽다.

1. 사용자가 로그아웃 버튼을 누른다.
2. 브라우저가 `POST /accounts/logout/` 요청을 보낸다.
3. Django가 현재 세션 정보를 찾아 정리한다.
4. 이후 인증되지 않은 사용자 상태가 된다.
5. 메인 페이지로 리다이렉트된다.

#### 자주 하는 실수 / 디버깅 포인트

- 로그아웃을 `<a>` 태그 링크로 처리하는 실수  
  인증 상태를 바꾸는 요청은 GET보다 POST가 안전하다.
- `csrf_token`을 빠뜨리는 실수  
  POST 폼이면 거의 자동으로 같이 떠올려야 한다.
- `logout` 이름 충돌  
  직접 만든 뷰 함수 이름과 Django 내장 함수 이름이 겹치면 헷갈리기 쉽다.

📌 핵심: 로그아웃은 “버튼 하나 만드는 작업”이 아니라, **현재 사용자와 연결된 세션을 정리하는 작업**이다.

### 3.2 회원가입: User 객체를 새로 만드는 과정

회원가입은 한 줄로 말하면 **새로운 사용자 객체를 생성하는 과정**이다.

로그인과 달리, 이번에는 단순 인증이 아니라 실제로 데이터베이스에 새로운 사용자 정보를 저장해야 한다. 그래서 여기서는 `AuthenticationForm`이 아니라, **사용자 생성을 위한 폼**이 필요하다.

먼저 회원가입 URL과 템플릿 링크를 연결한다.

![회원가입 URL과 링크](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225316-1.png>)

기본 뷰 흐름은 아래처럼 시작한다.

![기본 UserCreationForm 사용](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225343-1.png>)

```python
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import render, redirect


def signup(request):
    if request.method == 'POST':
        # 제출된 회원가입 데이터를 받아 폼 객체를 만든다.
        form = UserCreationForm(request.POST)

        # 검증에 통과하면 새로운 사용자 객체를 생성할 수 있다.
        if form.is_valid():
            form.save()
            return redirect('articles:index')
    else:
        # 처음 페이지에 들어왔을 때는 빈 폼을 보여준다.
        form = UserCreationForm()

    context = {
        'form': form,
    }
    return render(request, 'accounts/signup.html', context)
```

템플릿에서는 POST 방식과 CSRF 토큰을 함께 사용한다.

![회원가입 템플릿](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225408-1.png>)

```html
<h1>Signup</h1>
<form action="{% url 'accounts:signup' %}" method="POST">
  {% csrf_token %}
  {{ form }}
  <input type="submit">
</form>
```

여기서 `UserCreationForm`이 중요한 이유는, 이 폼이 단순히 화면 입력용이 아니라 **실제로 User 객체를 저장하는 ModelForm**이기 때문이다. 비밀번호도 일반 텍스트 그대로 저장하는 것이 아니라 내부 로직을 통해 암호화된 형태로 저장된다.

#### 코드 흐름 해설

회원가입의 기본 흐름은 다음과 같다.

1. GET 요청이면 빈 폼을 렌더링한다.
2. 사용자가 회원정보를 입력하고 제출한다.
3. POST 요청으로 받은 데이터를 `UserCreationForm(request.POST)`에 담는다.
4. `form.is_valid()`로 유효성 검사를 한다.
5. 통과하면 `form.save()`로 새 사용자 객체를 저장한다.
6. 저장 후 적절한 페이지로 리다이렉트한다.

#### 자주 하는 실수 / 디버깅 포인트

- GET과 POST를 구분하지 않고 한 덩어리로 처리하는 실수  
  폼 화면 렌더링과 데이터 저장은 역할이 다르다.
- `method="POST"`를 빼먹는 실수
- `csrf_token` 누락
- 저장 성공 후 리다이렉트를 하지 않아 새로고침 시 중복 제출 문제가 생기는 경우

📌 핵심: 회원가입은 **폼을 띄우는 것**이 아니라, **유효성 검사를 거쳐 새로운 User 객체를 저장하는 흐름**까지 포함한다.

### 3.3 커스텀 User 모델과 UserCreationForm 에러 해결

이번 강의에서 가장 중요한 부분 중 하나는 바로 여기다. 기본 `UserCreationForm`을 그대로 썼더니 다음과 같은 에러가 발생한다.

> `Manager isn't available; 'auth.User' has been swapped for 'accounts.User'`

이 메시지는 단순히 “코드 한 줄이 틀렸다”는 뜻이 아니다. **프로젝트는 이미 기본 User가 아니라 커스텀 User 모델을 사용 중인데, 폼은 여전히 과거 기본 User 모델을 기준으로 동작하고 있다**는 뜻이다.

에러 원인을 설명하는 화면이다.

![기본 User 참조 문제](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225459-1.png>)

쉽게 말하면, 프로젝트에서는 `accounts.User`를 쓰고 있는데 `UserCreationForm` 내부 메타 정보는 기본 `auth.User`를 바라보고 있어서 충돌이 나는 것이다.

이 문제를 해결하려면 현재 프로젝트에서 활성화된 사용자 모델을 동적으로 가져와야 한다. 그때 사용하는 함수가 `get_user_model()`이다.

![커스텀 회원가입 폼 작성](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225530-1.png>)

```python
# accounts/forms.py
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserCreationForm


class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        # 현재 프로젝트에서 활성화된 User 모델을 가져온다.
        model = get_user_model()
```

이 코드가 중요한 이유는, `User` 클래스를 직접 고정해서 쓰지 않고 **프로젝트 설정에 맞는 User 모델을 알아서 가져오게 만든다**는 점이다. 그래서 커스텀 User 모델을 써도 폼이 올바르게 동작한다.

#### 왜 `get_user_model()`을 써야 할까?

- 프로젝트마다 사용자 모델이 다를 수 있다.
- 기본 `auth.User`를 그대로 쓸 수도 있고, 직접 만든 `accounts.User`를 쓸 수도 있다.
- 따라서 `User`를 직접 참조하기보다, **현재 활성화된 사용자 모델을 가져오는 함수**를 써야 안전하다.

이제 뷰에서도 기본 `UserCreationForm` 대신 새로 만든 `CustomUserCreationForm`을 사용한다.

![회원가입 로직 완성](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225606-1.png>)

```python
# accounts/views.py
from .forms import CustomUserCreationForm


def signup(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('articles:index')
    else:
        form = CustomUserCreationForm()

    context = {
        'form': form,
    }
    return render(request, 'accounts/signup.html', context)
```

#### 자주 하는 실수 / 디버깅 포인트

- 커스텀 User 모델을 만들었는데도 기본 `UserCreationForm`을 그대로 쓰는 실수
- `User`를 직접 import 해서 참조하는 습관
- 에러 메시지를 제대로 읽지 않고 “왜 갑자기 안 되지?”에서 멈추는 경우

💡 포인트: Django 인증 관련 에러는 대부분 **“지금 어떤 User 모델을 기준으로 동작하는가”**를 추적하면 풀리는 경우가 많다.

📌 핵심: 커스텀 User 모델을 쓰는 프로젝트에서는, 회원가입 폼도 그 모델을 기준으로 다시 맞춰야 한다.

### 3.4 회원 탈퇴: 현재 로그인한 사용자를 삭제하기

회원 탈퇴는 결국 **현재 로그인한 사용자 객체를 삭제하는 작업**이다.

로그아웃이 세션을 지우는 작업이었다면, 회원 탈퇴는 아예 **사용자 자체를 지우는 작업**이라는 점에서 차이가 있다.

먼저 URL과 템플릿 버튼을 연결한다.

![회원탈퇴 URL과 버튼](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225637-1.png>)

기본 뷰는 다음처럼 매우 단순하게 시작할 수 있다.

![회원탈퇴 뷰 기본 형태](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225701-1.png>)

```python
def delete(request):
    # 현재 로그인된 사용자를 삭제한다.
    request.user.delete()
    return redirect('articles:index')
```

이 코드가 간단해 보여도 중요한 전제가 있다. `request.user`는 **현재 요청을 보낸 사용자**를 가리키므로, 로그인 상태라면 그 사용자 객체를 직접 삭제할 수 있다.

#### 코드 흐름 해설

1. 사용자가 회원탈퇴 버튼을 누른다.
2. 서버는 현재 로그인한 사용자를 `request.user`에서 가져온다.
3. `delete()`를 호출해 DB에서 해당 사용자를 삭제한다.
4. 이후 메인 페이지로 이동한다.

#### 자주 하는 실수 / 디버깅 포인트

- 탈퇴 버튼도 GET 링크로 만드는 실수
- 로그인하지 않은 상태에서 `request.user.delete()`를 고려하지 않는 문제
- 탈퇴 후 세션 정리까지 생각하지 않아, 상태가 어색해지는 경우

📌 핵심: 회원 탈퇴는 **현재 로그인한 사용자의 세션을 끊는 것**이 아니라, **사용자 객체 자체를 삭제하는 작업**이다.

### 3.5 `is_authenticated`: 인증 여부에 따라 화면과 로직을 분기하기

`is_authenticated`는 **사용자가 인증되었는지 확인하는 읽기 전용 속성**이다.

여기서 자주 헷갈리는 부분은 이것이 **메서드가 아니라 속성**이라는 점이다. 즉, `request.user.is_authenticated()`처럼 괄호를 붙이지 않고, `request.user.is_authenticated`처럼 값으로 사용한다.

로그인 여부에 따라 화면을 다르게 보여주는 예시는 아래와 같다.

![템플릿에서 인증 여부 분기](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225739-1.png>)

```django
{% if request.user.is_authenticated %}
  <h3>Hello, {{ user.username }}!</h3>
  <a href="{% url 'articles:create' %}">NEW</a>

  <form action="{% url 'accounts:logout' %}" method="POST">
    {% csrf_token %}
    <input type="submit" value="Logout">
  </form>

  <form action="{% url 'accounts:delete' %}" method="POST">
    {% csrf_token %}
    <input type="submit" value="회원탈퇴">
  </form>

  <a href="{% url 'accounts:update' %}">회원정보 수정</a>
{% else %}
  <a href="{% url 'accounts:login' %}">Login</a>
  <a href="{% url 'accounts:signup' %}">Signup</a>
{% endif %}
```

이렇게 하면 로그인한 사용자에게만 필요한 메뉴를 보여주고, 비로그인 사용자에게는 로그인/회원가입 링크만 노출할 수 있다.

또한 인증된 사용자라면 굳이 로그인 화면이나 회원가입 화면에 다시 들어갈 필요가 없다. 그래서 뷰에서도 아래처럼 막아둘 수 있다.

![로그인/회원가입 뷰 접근 제한](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225802-1.png>)

```python
def login(request):
    if request.user.is_authenticated:
        return redirect('articles:index')
    # 나머지 로그인 로직...


def signup(request):
    if request.user.is_authenticated:
        return redirect('articles:index')
    # 나머지 회원가입 로직...
```

#### 자주 하는 실수 / 디버깅 포인트

- `is_authenticated()`처럼 함수처럼 호출하는 실수
- 템플릿에서만 막고 뷰에서는 막지 않는 실수  
  화면에서 링크를 숨기는 것과 실제 접근을 막는 것은 다르다.
- 로그인한 사용자가 다시 회원가입 페이지에 들어가도 괜찮다고 넘기는 경우

📌 핵심: `is_authenticated`는 **현재 사용자의 인증 상태를 가장 빠르게 확인하는 기준점**이다.

### 3.6 `login_required`: 인증되지 않은 사용자의 접근 자체를 막기

`is_authenticated`가 조건 분기용이라면, `login_required`는 **아예 특정 뷰 실행 자체를 인증된 사용자로 제한하는 도구**다.

즉, 템플릿에서 버튼을 숨기는 수준을 넘어서, **비로그인 사용자가 URL을 직접 입력해도 접근하지 못하게** 만든다.

게시글 생성/수정/삭제 같은 기능은 누가 요청했는지가 중요하기 때문에 대표적으로 `login_required`를 붙인다.

![게시글 관련 뷰에 login_required 적용](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225836-1.png>)

```python
from django.contrib.auth.decorators import login_required


@login_required
def create(request):
    pass


@login_required
def delete(request, article_pk):
    pass


@login_required
def update(request, article_pk):
    pass
```

계정 관련 기능도 마찬가지다. 로그아웃, 회원탈퇴, 회원정보 수정, 비밀번호 변경은 모두 로그인한 사용자만 사용할 수 있어야 한다.

![계정 관련 뷰에 login_required 적용](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225902-1.png>)

```python
from django.contrib.auth.decorators import login_required


@login_required
def logout(request):
    pass


@login_required
def delete(request):
    pass


@login_required
def update(request):
    pass


@login_required
def change_password(request):
    pass
```

#### 코드 흐름 해설

- 인증된 사용자면 원래 뷰가 실행된다.
- 인증되지 않은 사용자면 Django가 로그인 페이지로 리다이렉트한다.
- 즉, 권한 체크를 뷰 함수 시작 전에 자동으로 처리하는 셈이다.

#### 자주 하는 실수 / 디버깅 포인트

- 템플릿에서 버튼만 숨기고 URL 직접 접근은 막지 않는 경우
- 정말 로그인해야만 하는 기능에 `login_required`를 빠뜨리는 경우
- “누가 작성했는가”가 중요한 기능에 인증 체크가 없는 경우

📌 핵심: `login_required`는 **링크를 숨기는 수준이 아니라, 뷰 실행 자체를 보호하는 장치**다.

### 3.7 회원가입 직후 자동 로그인: 사용자 경험을 매끄럽게 만들기

회원가입이 끝났는데 다시 로그인까지 하라고 하면, 사용자 입장에서는 흐름이 한 번 더 끊긴다. 그래서 실제 서비스에서는 **회원가입 직후 자동 로그인**을 이어 주는 경우가 많다.

이때 핵심은 `form.save()`가 **새로 생성된 User 객체를 반환한다**는 점이다.

![회원가입 후 자동 로그인](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 225934-1.png>)

```python
from django.contrib.auth import login as auth_login


def signup(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            # 저장된 사용자 객체를 반환받는다.
            user = form.save()

            # 방금 생성한 사용자를 바로 로그인 처리한다.
            auth_login(request, user)
            return redirect('articles:index')
    else:
        form = CustomUserCreationForm()

    context = {
        'form': form,
    }
    return render(request, 'accounts/signup.html', context)
```

오른쪽에 나온 `UserCreationForm`의 `save()` 메서드를 보면, 내부적으로 비밀번호를 설정하고 저장한 뒤 마지막에 `user`를 반환한다. 그래서 이 반환값을 바로 `auth_login(request, user)`에 넘길 수 있다.

#### 자주 하는 실수 / 디버깅 포인트

- `form.save()`의 반환값을 받지 않고 그냥 저장만 하는 경우
- 저장 직후 로그인 가능한 사용자 객체가 이미 손에 들어온다는 점을 놓치는 경우
- 회원가입 직후 다시 로그인 페이지로 보내는 흐름을 당연하게 생각하는 경우

💡 포인트: 회원가입 성공 직후 자동 로그인은 기능적으로도 간단하고, 사용자 경험 측면에서도 매우 효과적이다.

📌 핵심: `form.save()`가 반환한 사용자 객체를 곧바로 `auth_login()`에 넘기면 회원가입과 로그인을 자연스럽게 연결할 수 있다.

### 3.8 회원 탈퇴 개선: 삭제 후 세션도 함께 정리하기

회원 탈퇴 기능은 `request.user.delete()`만으로도 동작하지만, 인증 흐름을 더 자연스럽게 만들려면 **세션 정리까지 함께 고려**해야 한다.

삭제 이후에도 현재 요청과 연결된 세션 정보가 남아 있으면, 사용자가 이미 지워졌는데도 인증 상태가 남아 있는 것처럼 보일 수 있다. 그래서 탈퇴 후에는 `logout`도 함께 호출해 주는 편이 좋다.

![회원탈퇴 개선: 삭제 후 로그아웃](<../assets/images/04_22_Django_Auth_2/화면 캡처 2026-04-26 230009-1.png>)

```python
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.decorators import login_required


@login_required
def delete(request):
    # 먼저 현재 사용자 객체를 삭제한다.
    request.user.delete()

    # 그 다음 현재 요청과 연결된 세션도 정리한다.
    auth_logout(request)

    return redirect('articles:index')
```

여기서 순서가 중요하다.

- **1단계: 탈퇴** (`request.user.delete()`)  
- **2단계: 로그아웃** (`auth_logout(request)`)

순서를 반대로 하면, 먼저 로그아웃하면서 현재 요청과 연결된 사용자 정보가 정리되어 버릴 수 있고, 그 뒤에는 탈퇴에 필요한 사용자 정보를 안정적으로 다루기 어려워질 수 있다.

#### 자주 하는 실수 / 디버깅 포인트

- 탈퇴와 로그아웃의 순서를 바꾸는 실수
- 회원탈퇴 후 세션 정리를 잊는 실수
- `login_required` 없이 탈퇴 기능을 열어 두는 경우

⚠️ 주의: 탈퇴 기능은 사용자 정보 자체를 지우는 작업이기 때문에, **반드시 인증된 사용자만 접근 가능하도록 제한**해야 한다.

📌 핵심: 회원탈퇴는 **사용자 삭제**로 끝내지 말고, **세션 정리까지 한 흐름으로 묶어야** 자연스럽다.

## 4. 적용 관점에서 다시 보기

이번 강의 내용을 실제 구현 흐름으로 다시 묶어 보면, 인증 기능은 아래처럼 떠올리면 된다.

### 4.1 어떤 기능이 세션을 다루는가?

- 로그인: 세션 생성
- 로그아웃: 세션 삭제
- 회원탈퇴: 사용자 삭제 + 세션 정리

즉, 로그인/로그아웃/회원탈퇴는 서로 완전히 다른 기능 같아 보여도, 실제로는 모두 **“현재 사용자 상태를 어떻게 바꾸는가”**라는 하나의 축 위에 있다.

### 4.2 어떤 기능이 User 객체를 직접 다루는가?

- 회원가입: `User` 생성
- 회원정보 수정: `User` 수정
- 회원탈퇴: `User` 삭제

이 관점으로 보면 회원가입과 회원탈퇴는 각각 Create/Delete이고, 결국 Django 인증 시스템도 일반적인 CRUD 흐름 위에 있다는 점이 보인다.

### 4.3 어떤 신호를 보면 인증 제어를 떠올려야 할까?

아래와 같은 문장을 보면 바로 인증 제어를 떠올리면 좋다.

- “로그인한 사용자만 글 작성 가능” → `login_required`
- “로그인 여부에 따라 메뉴 다르게 표시” → `is_authenticated`
- “회원가입 후 곧바로 서비스 이용” → `form.save()` 반환값 + `auth_login`
- “커스텀 User 모델 사용 중” → `get_user_model()` 기반 폼 재작성

### 4.4 구현 순서를 어떻게 잡으면 좋은가?

실전에서는 보통 아래 순서로 잡으면 흐름이 덜 꼬인다.

1. URL 연결
2. 뷰 함수 작성
3. 템플릿 폼/링크 작성
4. POST + CSRF 확인
5. 인증 체크 (`is_authenticated`, `login_required`) 추가
6. 리다이렉트 흐름 점검
7. 세션 정리까지 확인

이 순서가 중요한 이유는, 인증 기능은 작은 누락 하나만 있어도 동작은 되는 것처럼 보이는데 실제로는 보안과 사용자 경험이 동시에 흔들릴 수 있기 때문이다.

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의를 통해 분명해지는 점은, Django 인증 시스템은 단순히 로그인 페이지만 만드는 기능이 아니라는 것이다. 사용자 생성, 인증 유지, 권한 제한, 사용자 삭제까지 모두 연결된 흐름으로 이해해야 한다.

특히 커스텀 User 모델과 `UserCreationForm` 충돌 문제는 실무 감각과도 연결된다. 겉으로 보기엔 작은 에러 하나처럼 보이지만, 실제로는 “프로젝트가 어떤 모델을 기준으로 동작하고 있는가”를 정확히 이해해야만 해결할 수 있기 때문이다.

또한 `is_authenticated`와 `login_required`를 함께 배우는 흐름도 중요하다. 하나는 조건 분기, 다른 하나는 접근 제한이기 때문에 둘을 역할별로 구분해서 떠올릴 수 있어야 한다.

앞으로 이어질 학습에서는 아래 내용과 자연스럽게 연결된다.

- 회원정보 수정
- 비밀번호 변경
- 작성자 본인만 수정/삭제 가능하도록 권한 세분화
- `next` 파라미터를 활용한 로그인 후 원래 페이지 복귀
- 인증과 인가(Authentication vs Authorization)의 구분

## 6. 요약 정리

📌 핵심

- 로그아웃은 세션을 정리하는 작업이다.
- 회원가입은 새로운 `User` 객체를 생성하는 작업이다.
- 커스텀 User 모델을 쓰는 프로젝트에서는 `UserCreationForm`도 그대로 쓰면 안 되고, `get_user_model()` 기반으로 다시 맞춰야 한다.
- 회원탈퇴는 `request.user.delete()`로 처리할 수 있다.
- `is_authenticated`는 인증 여부를 확인하는 **속성**이다.
- `login_required`는 인증되지 않은 사용자의 뷰 접근 자체를 막는다.
- 회원가입 후 `form.save()`가 반환한 사용자 객체로 바로 자동 로그인할 수 있다.
- 회원탈퇴 후에는 세션 정리까지 함께 고려해야 한다.

🧠 기억할 것

- 템플릿에서 숨기는 것과 뷰에서 막는 것은 다르다.
- 인증 기능은 GET보다 POST와 CSRF를 먼저 떠올려야 한다.
- Django 인증 에러는 “현재 어떤 User 모델을 기준으로 동작 중인가?”를 먼저 보면 풀리는 경우가 많다.

## 7. 미니 퀴즈 또는 체크리스트

1. 로그아웃 기능을 구현할 때 `<a>` 링크보다 `POST` 폼이 더 적절한 이유는 무엇인가?
2. 커스텀 User 모델을 사용하는 프로젝트에서 기본 `UserCreationForm`이 문제를 일으키는 이유를 설명할 수 있는가?
3. `is_authenticated`와 `login_required`는 각각 어떤 역할 차이가 있는가?
4. 회원가입 직후 자동 로그인을 구현하려면 `form.save()`의 어떤 특징을 활용해야 하는가?
5. 회원탈퇴 기능에서 `request.user.delete()`와 `auth_logout(request)`의 순서를 왜 신경 써야 하는가?
