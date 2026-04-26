# 04_23 Django Auth 3

- 🎯 글의 목표: Django 인증 흐름의 세 번째 단계로, 회원정보 수정과 비밀번호 변경을 구현하고, 그 뒤에 이어지는 비밀번호 저장 원리와 초기화 흐름까지 한 번에 이해한다.
- 🧩 핵심 키워드: `UserChangeForm`, `PasswordChangeForm`, `update_session_auth_hash`, 해시, 솔트, 키 스트레칭, `django.contrib.auth.urls`, `EMAIL_BACKEND`
- ⭐ 중요도: 매우 높음
- 📝 한눈에 보는 내용: 이번 강의는 단순히 “회원정보 수정 페이지를 만든다”에서 끝나지 않는다. 사용자의 정보를 바꾸는 기능을 구현하면서, 비밀번호는 왜 일반 필드처럼 다루면 안 되는지, 비밀번호를 바꾼 뒤 왜 로그아웃이 되는지, Django가 비밀번호를 어떤 방식으로 안전하게 저장하는지까지 함께 다룬다. 마지막에는 Django가 이미 제공하는 비밀번호 초기화 모듈을 어떻게 연결하는지도 확인한다.
- 🔗 관련 문제 / 주제(있다면): Django 인증 시스템, 커스텀 유저 모델, 세션 유지, 보안 설계, 비밀번호 재설정

---

## 1. 들어가며

인증 기능을 처음 배울 때는 보통 회원가입과 로그인에 가장 먼저 시선이 간다. 하지만 실제 서비스에서는 그 다음 단계가 더 중요해지는 경우가 많다. 이미 가입한 사용자가 자신의 정보를 바꾸고 싶을 수도 있고, 비밀번호를 바꾸거나 잊어버릴 수도 있기 때문이다.

이때 중요한 점은, **회원정보 수정과 비밀번호 변경은 겉보기에는 비슷해 보여도 내부적으로는 완전히 같은 작업이 아니라는 점**이다. 이름이나 이메일을 바꾸는 것은 User 객체의 필드를 갱신하는 문제에 가깝지만, 비밀번호를 바꾸는 일은 인증 정보와 세션, 암호화까지 함께 연결된다.

이번 강의는 바로 그 차이를 이해하게 해 준다. 먼저 `UserChangeForm`을 이용해 회원정보 수정 기능을 만들고, 이어서 `PasswordChangeForm`으로 비밀번호 변경을 구현한다. 그 다음에는 왜 비밀번호 변경 직후 로그아웃되는지, 이를 막기 위해 `update_session_auth_hash`가 왜 필요한지 확인한다. 마지막으로는 비밀번호를 평문으로 저장하면 왜 위험한지, 해시·솔트·키 스트레칭이 왜 필요한지, 그리고 Django의 내장 URL로 비밀번호 초기화 기능을 어떻게 붙일 수 있는지까지 이어서 살펴본다.

즉, 이번 내용은 **“사용자 정보를 수정하는 기능 구현”과 “그 기능이 왜 보안적으로 이렇게 설계되어야 하는지”를 함께 묶어 이해하는 강의**라고 볼 수 있다.

## 2. 핵심 개념 정리

이번 강의의 흐름은 크게 여섯 단계로 이어진다.

첫째, **회원정보 수정**이다. 기존의 `request.user`를 수정 대상으로 잡고, 그 객체를 `UserChangeForm`과 연결해서 화면에 보여주고 저장한다. 여기서 핵심은 새 사용자를 만드는 것이 아니라, **기존 사용자 인스턴스를 갱신하는 것**이다.

둘째, **수정 폼 커스터마이징**이다. 기본 `UserChangeForm`은 관리자용에 가까워서 일반 사용자에게 불필요하거나 보여주면 안 되는 필드까지 포함할 수 있다. 그래서 커스텀 폼을 만들어 노출할 필드를 직접 제한해야 한다.

셋째, **비밀번호 변경**이다. 비밀번호는 일반적인 `ModelForm` 저장과 다르게 다뤄야 한다. `PasswordChangeForm`은 현재 로그인한 사용자를 기준으로 기존 비밀번호 확인, 새 비밀번호 검증, 암호화 저장을 함께 처리한다.

넷째, **세션 유지**다. 비밀번호를 바꾸면 인증 정보가 달라지므로 기존 세션이 더 이상 유효하지 않다고 판단되어 로그아웃된다. 이때 `update_session_auth_hash`를 사용하면, 새 비밀번호 기준으로 세션을 갱신하여 로그인 상태를 유지할 수 있다.

다섯째, **비밀번호 암호화 원리**다. Django는 비밀번호를 그대로 저장하지 않는다. 해시를 사용하고, 솔트를 붙여 레인보우 테이블 공격을 어렵게 만들며, 키 스트레칭으로 무차별 대입 공격의 속도를 늦춘다.

여섯째, **비밀번호 초기화**다. 사용자가 비밀번호를 잊어버렸을 때를 대비해 `django.contrib.auth.urls`를 연결하면, Django가 이미 만들어 둔 URL과 뷰를 활용할 수 있다. 이메일 서버가 없더라도 콘솔 백엔드를 통해 흐름을 테스트할 수 있다.

이 큰 그림을 잡고 보면, 이번 강의는 단순한 폼 처리 수업이 아니라 **인증 기능을 실제 서비스 수준으로 조금 더 끌어올리는 단계**라는 점이 선명해진다.

## 3. 본문 정리

### 3.1 회원정보 수정은 “새로 생성”이 아니라 “기존 사용자 갱신”이다

회원정보 수정은 말 그대로 이미 존재하는 사용자 정보를 바꾸는 작업이다. 그래서 회원가입 때처럼 빈 폼을 만들고 새 객체를 저장하는 접근과는 다르다. 핵심은 **현재 로그인한 사용자(`request.user`)를 수정 대상으로 삼는 것**이다.

먼저 수정 페이지로 들어가기 위한 URL을 만든다.

![회원정보 수정 URL 생성](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 231906-1.png>)

위 흐름에서 중요한 점은 `update/` 경로가 따로 생긴다는 것이다. 사용자는 이 주소를 통해 자신의 정보를 수정하는 페이지에 진입하게 된다.

다음으로, 커스텀 유저 모델을 기준으로 동작할 수 있는 수정 폼을 준비한다.

![커스텀 UserChangeForm 생성](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 231947-1.png>)

```python
# accounts/forms.py
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserChangeForm


class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        # 현재 프로젝트에서 사용하는 커스텀 유저 모델을 기준으로 폼을 연결한다.
        # 회원가입 때와 마찬가지로, built-in User가 아니라 실제 사용하는 모델을 바라봐야 한다.
        model = get_user_model()
```

여기서 중요한 이유는, 이미 커스텀 유저 모델을 사용하고 있다면 Django 기본 `User`를 그대로 쓰는 순간 필드 구성이나 동작이 어긋날 수 있기 때문이다. 그래서 회원가입 폼을 다시 정의했던 것처럼, 수정 폼도 다시 이어 붙여야 한다.

이제 뷰에서는 `request.user`를 인스턴스로 전달하여 수정 폼을 화면에 띄운다.

![회원정보 수정 GET 처리](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232019-1.png>)

```python
# accounts/views.py
from django.shortcuts import render
from .forms import CustomUserChangeForm


def update(request):
    # GET 요청에서는 현재 로그인한 사용자의 기존 정보를 폼에 채워서 보여준다.
    form = CustomUserChangeForm(instance=request.user)
    context = {
        'form': form,
    }
    return render(request, 'accounts/update.html', context)
```

여기서 `instance=request.user`가 빠지면, 수정 폼처럼 보이더라도 실제로는 “기존 값을 가진 수정 폼”이 아니라 의도와 다른 동작이 될 수 있다. 쉽게 말하면, **이 폼이 누구를 수정하는지 먼저 지정해 주는 과정**이라고 이해하면 된다.

화면에서는 POST 방식과 CSRF 토큰을 사용해 수정 데이터를 안전하게 보낸다.

![회원정보 수정 템플릿](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232053-1.png>)

```html
<!-- accounts/update.html -->
<h1>회원정보 수정</h1>
<form action="{% url 'accounts:update' %}" method="POST">
  {% csrf_token %}
  {{ form }}
  <input type="submit" value="제출">
</form>
```

회원정보 수정 링크도 메인 페이지나 네비게이션에서 접근할 수 있어야 실제로 사용할 수 있다.

![회원정보 수정 링크 추가](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232117-1.png>)

초기 상태의 `UserChangeForm`은 관리자 관점의 정보까지 그대로 보여줄 수 있다.

![기본 UserChangeForm의 문제점](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232204-1.png>)

왼쪽 화면처럼 비밀번호 해시 정보나 권한 관련 필드까지 보이면 일반 사용자용 수정 화면으로는 적절하지 않다. 이 지점에서 “기본 제공 폼을 그대로 쓰면 편하지 않을까?”라는 생각이 들 수 있지만, 실제 서비스에서는 **사용자에게 보여줄 범위를 다시 좁히는 작업이 꼭 필요하다.**

⚠️ 주의
- 수정 폼은 빈 폼이 아니라 **기존 객체와 연결된 폼**이어야 한다.
- `request.user`를 넘기지 않으면 “누구의 정보를 수정하는지”가 흐려진다.
- 일반 사용자 화면에 관리자용 필드까지 노출되면 보안과 UX 모두 좋지 않다.

📌 핵심: 회원정보 수정의 핵심은 **현재 로그인한 사용자 객체를 인스턴스로 연결해 갱신하는 것**이다.

### 3.2 수정 폼은 사용자에게 필요한 필드만 다시 정의해야 한다

기본 `UserChangeForm`은 너무 많은 필드를 보여줄 수 있다. 그래서 커스텀 폼에서 실제로 수정하게 할 항목만 골라 다시 정의한다.

![출력 필드 재정의](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232234-1.png>)

```python
# accounts/forms.py
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserChangeForm


class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = get_user_model()
        # 일반 사용자가 스스로 바꿀 수 있는 정보만 노출한다.
        fields = ('first_name', 'last_name', 'email')
```

이렇게 하면 사용자에게는 꼭 필요한 입력창만 보이게 된다. 여기서 중요한 점은, 폼을 새로 만드는 이유가 단순히 “예쁘게 보이기 위해서”가 아니라 **권한상 보여줘도 되는 정보만 통제하기 위해서**라는 점이다.

회원정보 수정 로직을 POST와 GET으로 완성하면 다음과 같은 구조가 된다.

![회원정보 수정 로직 완성](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232304-1.png>)

```python
# accounts/views.py
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from .forms import CustomUserChangeForm


@login_required
def update(request):
    if request.method == 'POST':
        # POST 요청에서는 제출된 데이터를 기존 사용자 인스턴스에 덮어쓴다.
        form = CustomUserChangeForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
            return redirect('articles:index')
    else:
        # GET 요청에서는 현재 사용자 정보를 미리 채운 폼을 보여준다.
        form = CustomUserChangeForm(instance=request.user)

    context = {
        'form': form,
    }
    return render(request, 'accounts/update.html', context)
```

이 코드는 회원가입 뷰와 구조가 비슷해 보이지만, 결정적인 차이는 `instance=request.user`에 있다. 회원가입은 새 객체 생성이고, 수정은 기존 객체 갱신이기 때문이다.

💡 포인트
- 회원가입 폼과 수정 폼은 겉모양은 비슷하지만, 내부 목적은 다르다.
- 수정에서는 “새 데이터를 저장한다”보다 “기존 객체를 바꾼다”가 더 정확한 표현이다.

⚠️ 주의
- 수정 가능한 필드를 제한하지 않으면 관리자용 정보까지 노출될 수 있다.
- `login_required`를 빼면 비로그인 사용자가 수정 URL에 접근할 수 있다.

📌 핵심: 수정 폼의 본질은 **기존 사용자 인스턴스를 안전하게 업데이트하도록 필드를 제한하는 것**이다.

### 3.3 비밀번호 변경은 일반 필드 수정과 다르게 다뤄야 한다

비밀번호는 이름이나 이메일처럼 단순히 한 필드를 바꾸는 작업이 아니다. 현재 비밀번호 검증, 새 비밀번호 규칙 검사, 암호화 저장까지 함께 처리되어야 한다. 그래서 Django는 이를 위해 `PasswordChangeForm`을 따로 제공한다.

먼저 비밀번호 변경 URL을 만든다.

![비밀번호 변경 URL](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232348-1.png>)

그리고 뷰에서 `PasswordChangeForm`을 사용한다.

![비밀번호 변경 폼 생성](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232412-1.png>)

```python
# accounts/views.py
from django.contrib.auth.forms import PasswordChangeForm


def password(request):
    if request.method == 'POST':
        pass
    else:
        # PasswordChangeForm은 어떤 사용자의 비밀번호를 바꾸는지 알아야 하므로
        # 첫 번째 인자로 user 객체를 받는다.
        form = PasswordChangeForm(request.user)

    context = {
        'form': form,
    }
    return render(request, 'accounts/password.html', context)
```

화면에서도 일반 수정 폼과 비슷하게 렌더링하지만, 내부 검증 규칙은 훨씬 엄격하다.

![비밀번호 변경 템플릿](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232511-1.png>)

```html
<!-- accounts/password.html -->
<h1>비밀번호 변경</h1>
<form action="{% url 'accounts:password' %}" method="POST">
  {% csrf_token %}
  {{ form }}
  <input type="submit">
</form>
```

POST 요청까지 완성하면 다음처럼 된다.

![비밀번호 변경 POST 처리](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232534-1.png>)

```python
# accounts/views.py
from django.contrib.auth.forms import PasswordChangeForm
from django.shortcuts import redirect, render


def password(request):
    if request.method == 'POST':
        # 첫 번째 인자로 현재 사용자, 두 번째 인자로 제출된 데이터를 전달한다.
        form = PasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            user = form.save()
            return redirect('articles:index')
    else:
        form = PasswordChangeForm(request.user)

    context = {
        'form': form,
    }
    return render(request, 'accounts/password.html', context)
```

여기서 `PasswordChangeForm`이 다른 폼과 달리 **첫 번째 인자로 user 객체를 받는 이유**가 중요하다. 이 폼은 “새 비밀번호 입력 폼”이 아니라, **현재 사용자가 누구인지 알고 있어야 기존 비밀번호 검증과 새 비밀번호 저장을 수행할 수 있는 폼**이기 때문이다.

⚠️ 주의
- `PasswordChangeForm(request.POST)`처럼 user를 빼고 쓰면 안 된다.
- 비밀번호는 일반적인 `ModelForm`처럼 단순 저장하면 안 된다.
- `form.save()`는 내부적으로 비밀번호를 안전하게 처리하도록 설계되어 있으므로, 직접 해시를 만들려 하기보다 제공된 흐름을 따르는 것이 안전하다.

📌 핵심: 비밀번호 변경은 **현재 사용자 확인 + 유효성 검사 + 암호화 저장**이 한 번에 이뤄지는 별도의 작업이다.

### 3.4 비밀번호를 바꾸면 왜 로그아웃되고, 어떻게 막을까?

비밀번호를 변경하면 사용자의 인증 정보가 바뀐다. 그런데 현재 로그인 상태는 예전 인증 정보를 바탕으로 만들어진 세션에 연결되어 있다. 그래서 비밀번호를 바꾸는 순간 Django는 “기존 세션 정보가 더 이상 최신 인증 정보와 맞지 않는다”고 판단하고 로그아웃 처리한다.

이 현상은 보안상 자연스러운 동작이다. 만약 세션을 그대로 두면, 인증 정보가 바뀌었는데도 과거 세션이 계속 유효하게 남는 상황이 될 수 있기 때문이다.

하지만 사용자가 자기 비밀번호를 정상적으로 변경한 상황에서는, 바꾸자마자 로그아웃되는 UX가 다소 불편하게 느껴질 수 있다. 이때 사용하는 것이 `update_session_auth_hash`다.

![세션 무효화 방지](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232613-1.png>)

```python
# accounts/views.py
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm
from django.shortcuts import redirect, render


def password(request):
    if request.method == 'POST':
        form = PasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            user = form.save()
            # 변경된 비밀번호 기준으로 현재 세션의 인증 해시도 갱신한다.
            # 이 줄이 없으면 비밀번호 변경 직후 로그아웃될 수 있다.
            update_session_auth_hash(request, user)
            return redirect('articles:index')
    else:
        form = PasswordChangeForm(request.user)

    context = {
        'form': form,
    }
    return render(request, 'accounts/password.html', context)
```

쉽게 말하면, 이 함수는 **비밀번호는 새 것으로 바꿨는데 세션만 옛날 상태로 남아 있는 문제를 맞춰 주는 작업**이다.

💡 포인트
- 비밀번호 변경 후 로그아웃되는 것은 버그가 아니라 인증 일관성을 지키기 위한 기본 동작이다.
- `update_session_auth_hash`는 그 일관성을 유지한 채 사용자 편의성도 살리는 함수다.

⚠️ 주의
- `form.save()`만 하고 세션 갱신을 하지 않으면, 사용자 입장에서는 “비밀번호를 바꾸자마자 로그아웃되는 이상한 경험”을 하게 된다.
- 비밀번호 변경 뷰도 반드시 로그인된 사용자만 접근하게 제한하는 것이 자연스럽다.

📌 핵심: 비밀번호 변경 후 로그인 상태를 유지하려면 **새 비밀번호 기준으로 세션 인증 해시까지 갱신해야 한다.**

### 3.5 Django는 비밀번호를 저장하지 않고, 해시를 저장한다

이제 구현에서 한 걸음 더 들어가면, 중요한 보안 질문이 생긴다. **사용자가 입력한 비밀번호는 데이터베이스에 어떻게 저장될까?**

정답은 “그대로 저장하지 않는다”이다. 평문 저장은 가장 위험한 방식이다. 데이터베이스가 유출되는 순간 사용자의 실제 비밀번호가 그대로 드러나고, 같은 비밀번호를 다른 사이트에서 사용하는 경우 2차 피해로 이어질 수 있다.

그래서 Django는 비밀번호를 **복원이 불가능한 고정 길이 문자열로 변환한 뒤 저장**한다. 이 과정을 해시라고 부른다.

![해시 예시](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232658-1.png>)

해시는 같은 입력이면 같은 결과가 나오지만, 입력이 조금만 달라져도 전혀 다른 결과가 나온다. 또 결과만 보고 원래 입력값을 되돌리는 것은 사실상 불가능하다. 그래서 비밀번호 저장에 적합하다.

하지만 해시만 써도 완벽한 것은 아니다. 공격자는 자주 쓰이는 비밀번호를 미리 해시로 계산해 둔 거대한 표, 즉 **레인보우 테이블**을 이용할 수 있다. 이를 막기 위해 사용자마다 임의의 문자열을 덧붙인다. 이것이 **솔트(salt)** 다.

![솔트 개념](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232746-1.png>)

솔트가 붙으면 같은 비밀번호라도 사용자마다 다른 해시값이 만들어진다. 즉, 공격자가 하나의 거대한 답안지로 모든 사용자를 한 번에 공격하기 어려워진다.

그 다음 단계는 **무차별 대입 공격(Brute-force Attack)** 방어다. 공격자는 가능한 모든 비밀번호를 하나씩 넣어보며 맞추려 할 수 있다.

![무차별 대입 공격](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232843-1.png>)

이를 어렵게 만들기 위해 해시 계산을 일부러 여러 번 반복해 느리게 만든다. 이것이 **키 스트레칭(Key Stretching)** 이다.

![키 스트레칭](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 232923-1.png>)

Django는 이런 과정을 조합해 비밀번호를 저장한다. 강의에서 정리한 저장 형식은 다음 네 요소로 볼 수 있다.

```text
<algorithm>$<iterations>$<salt>$<hash>
```

- `algorithm`: 어떤 해시 알고리즘을 썼는가
- `iterations`: 키 스트레칭 반복 횟수
- `salt`: 사용자별 임의 문자열
- `hash`: 최종 결과 해시값

여기서 정말 중요한 태도는, **비밀번호 보안 기능을 직접 재발명하려고 하기보다 검증된 프레임워크의 방식을 이해하고 신뢰하는 것**이다. 보안은 단순 구현보다 “검증된 설계를 제대로 쓰는가”가 훨씬 중요하다.

💡 포인트
- 해시는 “되돌릴 수 없는 변환”이고, 암호화는 복호화 가능성을 전제로 한다는 점에서 다르다.
- 솔트는 같은 비밀번호의 해시값을 사용자마다 다르게 만든다.
- 키 스트레칭은 공격자의 대입 속도를 늦춘다.

⚠️ 주의
- 단순 인코딩은 보안이 아니다.
- 해시만 쓰고 솔트를 쓰지 않으면 레인보우 테이블 공격에 취약해질 수 있다.
- 솔트가 있다고 끝이 아니라, 빠른 연산 자체를 늦추는 키 스트레칭도 중요하다.

📌 핵심: Django 비밀번호 저장의 본질은 **해시 + 솔트 + 반복 연산으로 공격 효율을 떨어뜨리는 것**이다.

### 3.6 비밀번호 초기화는 내장 auth URL을 활용하면 된다

사용자가 비밀번호를 잊어버렸을 때는 비밀번호 변경과 다른 흐름이 필요하다. 로그인된 상태에서 스스로 바꾸는 것이 아니라, **이메일을 통해 본인 확인 후 새 비밀번호를 설정하는 흐름**이기 때문이다.

Django는 이 기능을 처음부터 전부 직접 구현하지 않아도 되도록 `django.contrib.auth.urls`를 제공한다.

![auth URL include](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 233042-1.png>)

```python
# crud/urls.py
from django.urls import include, path

urlpatterns = [
    path('articles/', include('articles.urls')),
    path('accounts/', include('accounts.urls')),
    # Django가 제공하는 인증 관련 URL 패턴을 함께 연결한다.
    path('accounts/', include('django.contrib.auth.urls')),
]
```

같은 `accounts/` prefix로 `include`가 두 번 들어가도 내부 URL 패턴이 충돌하지 않으면 순차적으로 검사되므로 함께 사용할 수 있다.

이후 `accounts/password_reset/` 같은 경로로 접근하면 비밀번호 초기화 흐름을 시작할 수 있다.

![password reset 진입](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 233115-1.png>)

이메일을 입력하고 전송을 시도하면, 실제 메일 서버가 없는 개발 환경에서는 바로 발송이 되지 않을 수 있다. 이때 Django는 콘솔 백엔드를 통해 메일 내용을 터미널에 출력하도록 설정할 수 있다.

![콘솔 이메일 백엔드](<../assets/images/04_23_Django_Auth_3/화면 캡처 2026-04-26 233307-1.png>)

```python
# settings.py
# 실제 이메일 서버 대신, 전송 내용을 콘솔에 출력한다.
# 개발 중 비밀번호 초기화 흐름을 테스트할 때 유용하다.
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

이 설정을 하면 콘솔에 재설정 링크가 출력되고, 그 링크로 들어가 새 비밀번호를 설정할 수 있다.

여기서 흥미로운 점은, **입력한 이메일이 실제 사용자와 매칭되지 않아도 시스템이 노골적으로 알려주지 않는 경우가 많다**는 점이다. 이는 편의성보다 보안을 우선한 설계다. 만약 “존재하지 않는 이메일입니다”라고 친절하게 알려주면, 공격자가 이메일 존재 여부를 탐색하는 데 악용할 수 있기 때문이다.

💡 포인트
- 비밀번호 초기화는 직접 모든 뷰를 짜기보다 Django 내장 기능을 활용하는 것이 안전하고 효율적이다.
- 개발 단계에서는 콘솔 이메일 백엔드만으로도 전체 흐름을 충분히 검증할 수 있다.

⚠️ 주의
- 비밀번호 변경과 비밀번호 초기화는 같은 기능처럼 보여도 전제가 다르다.
  - 변경: 로그인된 사용자가 스스로 바꿈
  - 초기화: 비로그인 상태에서도 이메일 확인을 통해 재설정
- 이메일 전송 기능이 안 된다고 해서 흐름을 포기할 필요는 없다. 개발 환경에서는 콘솔 백엔드로 먼저 검증하면 된다.

📌 핵심: 비밀번호 초기화는 **`django.contrib.auth.urls`와 이메일 백엔드를 활용해 검증된 흐름을 재사용하는 것**이 핵심이다.

## 4. 적용 관점에서 다시 보기

이번 강의를 실제 구현 관점에서 다시 묶어 보면, 중요한 신호가 몇 가지 보인다.

먼저, **폼이 기존 객체를 수정하는지 새 객체를 생성하는지**를 항상 구분해야 한다. 회원가입과 회원정보 수정은 구조가 비슷해 보여도, 수정에서는 `instance=`가 핵심 신호가 된다. 화면은 비슷해도 동작의 본질은 다르다.

다음으로, **비밀번호는 일반 필드처럼 생각하면 안 된다**는 점을 기억해야 한다. 이름이나 이메일 수정과 같은 방식으로 비밀번호를 다루면 인증과 암호화 흐름이 깨질 수 있다. 비밀번호 관련 기능이 보이면, 먼저 Django가 제공하는 전용 폼과 내장 기능이 있는지 떠올리는 습관이 중요하다.

또한, 인증 관련 기능을 만들 때는 **기능 구현과 세션 흐름을 같이 확인해야 한다.** 예를 들어 비밀번호 변경이 성공했는데 사용자가 갑자기 로그아웃된다면, 이는 저장 자체의 문제가 아니라 세션 갱신의 문제일 가능성이 크다. 이때 `update_session_auth_hash`를 떠올릴 수 있어야 한다.

보안 관점에서는, “비밀번호를 어떻게 저장할까?”라는 질문이 나오면 해시, 솔트, 키 스트레칭을 함께 떠올려야 한다. 해시만 알면 절반만 이해한 것이다. Django가 이런 과정을 내장 처리한다는 점까지 연결해야 실제 개발에서 올바른 결정을 내릴 수 있다.

마지막으로, 비밀번호 찾기나 초기화처럼 흔한 기능은 **직접 만드는 것보다 검증된 모듈을 연결해서 쓰는 방향**을 먼저 생각하는 것이 좋다. 이번 강의의 핵심은 단지 기능 추가가 아니라, **“이미 잘 만들어진 인증 도구를 올바르게 조합하는 감각”**을 익히는 데 있다.

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의를 통해 인증 기능은 단순한 CRUD의 연장이 아니라는 점이 더 분명해진다. 이름과 이메일을 수정하는 기능은 겉보기에는 간단한 폼 처리처럼 보이지만, 비밀번호가 등장하는 순간부터는 세션과 보안 설계까지 함께 고려해야 한다.

특히 인상적인 부분은, Django가 단순히 “폼 몇 개를 제공하는 프레임워크”가 아니라는 점이다. `UserChangeForm`, `PasswordChangeForm`, `update_session_auth_hash`, `django.contrib.auth.urls` 같은 도구들은 각각 따로 떨어진 기능이 아니라, 실제 서비스에서 반복적으로 필요한 인증 흐름을 안전하게 구현하도록 설계된 조각들이다.

확장 관점에서 보면 다음 학습으로 자연스럽게 이어질 수 있다.

- 회원정보 수정 페이지에 프로필 이미지, 닉네임 등 커스텀 필드를 추가하기
- 비밀번호 변경/초기화 화면을 기본 폼 출력에서 벗어나 직접 템플릿 커스터마이징하기
- 인증이 필요한 페이지를 데코레이터뿐 아니라 믹스인, 권한 시스템과 함께 설계하기
- Django가 지원하는 다른 인증 모듈과 이메일 설정을 실제 배포 환경에서 다뤄 보기

즉, 이번 강의는 인증 기능을 “쓸 줄 아는 단계”에서 “왜 이렇게 동작하는지 이해하는 단계”로 넘겨 주는 연결 고리라고 볼 수 있다.

## 6. 요약 정리

📌 핵심
- 회원정보 수정은 `request.user`를 `instance`로 연결해 기존 사용자 객체를 갱신하는 작업이다.
- `UserChangeForm`은 관리자용 성격이 강하므로, 일반 사용자용으로는 필드를 다시 제한하는 커스텀 폼이 필요하다.
- 비밀번호 변경은 일반 필드 수정과 다르며, `PasswordChangeForm`으로 처리해야 한다.
- 비밀번호 변경 후 로그아웃되는 것은 세션과 인증 정보가 어긋나기 때문이며, `update_session_auth_hash`로 세션을 갱신해 유지할 수 있다.
- Django는 비밀번호를 평문으로 저장하지 않고, 해시·솔트·키 스트레칭을 이용해 안전하게 저장한다.
- 비밀번호 초기화는 `django.contrib.auth.urls`와 이메일 백엔드를 이용해 검증된 흐름을 재사용하는 것이 좋다.

🧠 기억할 것
- 수정 폼에서 가장 중요한 신호는 `instance=`다.
- 비밀번호 관련 기능이 보이면 일반 `ModelForm`보다 전용 auth 도구를 먼저 떠올린다.
- 인증 기능은 구현 코드만 보는 것이 아니라 세션과 보안 설계까지 같이 봐야 한다.

## 7. 미니 퀴즈 또는 체크리스트

1. 회원가입 폼과 회원정보 수정 폼은 구조가 비슷해 보여도, 왜 수정 폼에서는 `instance=request.user`가 꼭 필요할까?
2. 기본 `UserChangeForm`을 그대로 일반 사용자 페이지에 쓰면 어떤 문제가 생길 수 있을까?
3. `PasswordChangeForm`이 다른 폼과 달리 `request.user`를 첫 번째 인자로 받는 이유는 무엇일까?
4. 비밀번호 변경 후 로그아웃되는 현상은 왜 발생하며, 이를 막기 위해 어떤 함수를 사용해야 할까?
5. 해시만 사용하는 것과, 해시 + 솔트 + 키 스트레칭을 함께 사용하는 것의 차이는 무엇일까?
6. 비밀번호 초기화 기능을 구현할 때 직접 모든 URL과 뷰를 만드는 대신 Django 내장 URL을 활용하는 장점은 무엇일까?
