# 비동기 JS with Django: Ajax로 팔로우와 좋아요 처리하기

- 🎯 글의 목표: Django가 HTML 전체를 다시 보내지 않고 JSON으로 응답할 때, JavaScript가 그 응답을 받아 팔로우와 좋아요 UI를 즉시 갱신하는 흐름을 이해한다.
- 🧩 핵심 키워드: Ajax, Axios, JsonResponse, CSRF Token, data-* 속성, DOM 업데이트, 이벤트 버블링, 이벤트 위임
- ⭐ 중요도: 높음. Django와 JavaScript를 함께 사용하는 프로젝트에서 페이지 새로고침 없는 상호작용을 구현하는 기본 패턴이다.
- 📝 한눈에 보는 내용: form 기본 제출을 막고, 필요한 pk와 CSRF 토큰을 Axios 요청에 담아 Django view로 보낸 뒤, view가 반환한 JSON을 기준으로 버튼과 숫자를 갱신한다.
- 🔗 관련 문제 / 주제: 팔로우/언팔로우, 좋아요 토글, M:N 관계, 사용자 경험 개선, 비동기 요청 처리

---

## 1. 들어가며

Django만으로도 팔로우나 좋아요 기능은 만들 수 있다. 사용자가 버튼을 누르면 form이 제출되고, view에서 관계를 추가하거나 삭제한 뒤, 다시 redirect로 페이지를 보여주면 된다. 이 방식은 단순하고 안정적이지만 매번 페이지 전체가 새로고침된다.

이번 강의의 핵심은 이 흐름을 조금 바꾸는 것이다. 사용자가 팔로우 버튼이나 좋아요 버튼을 눌렀을 때 페이지 전체를 다시 받는 대신, JavaScript가 서버에 비동기 요청을 보내고 서버는 필요한 결과만 JSON으로 돌려준다. 그러면 브라우저는 받은 JSON을 바탕으로 버튼 문구, 팔로워 수, 좋아요 상태 같은 작은 부분만 바꿀 수 있다.

흐름은 어렵게 보이지만 크게 보면 한 가지 패턴이다.

1. HTML에 JavaScript가 사용할 데이터를 심어 둔다.
2. JavaScript가 submit 이벤트를 가로챈다.
3. Axios로 Django view에 POST 요청을 보낸다.
4. Django view는 HTML이 아니라 JSON으로 응답한다.
5. JavaScript가 JSON을 읽고 DOM을 갱신한다.

이 패턴을 팔로우와 좋아요에 각각 적용해 보면, Ajax가 단순히 "비동기 요청"이라는 말에서 끝나지 않고 실제 프로젝트 안에서 어떻게 쓰이는지 선명해진다.

## 2. 핵심 개념 정리

이 강의는 "Django view가 처리한 결과를 어떻게 JavaScript 화면에 즉시 반영할 것인가"라는 질문을 다룬다. 일반적인 Django 요청에서는 view가 템플릿을 렌더링하거나 redirect를 반환한다. 하지만 Ajax 요청에서는 view가 JSON을 반환하고, 화면 변경은 JavaScript가 맡는다.

팔로우 구현에서는 한 사람의 프로필 페이지에 있는 form 하나를 다룬다. 그래서 form을 직접 선택하고, 해당 form의 `data-user-id`에서 대상 사용자 pk를 읽으면 된다.

좋아요 구현에서는 한 페이지에 여러 게시글과 여러 좋아요 form이 존재한다. 이때 각 form마다 이벤트 리스너를 붙일 수도 있지만, 더 좋은 방법은 상위 요소에 이벤트를 한 번만 등록하고 이벤트 버블링을 이용하는 것이다. 이 방식이 이벤트 위임이다.

결국 이번 강의의 큰 줄기는 다음과 같다.

- `data-*` 속성으로 Django 템플릿의 값을 JavaScript로 넘긴다.
- `event.preventDefault()`로 form의 기본 제출을 막는다.
- Axios 요청에 CSRF 토큰을 헤더로 포함한다.
- Django view는 `JsonResponse`로 상태값과 카운트를 응답한다.
- JavaScript는 응답 데이터를 기준으로 버튼과 숫자를 바꾼다.
- 좋아요처럼 반복되는 요소는 이벤트 버블링을 이용해 효율적으로 처리한다.

## 3. 본문 정리

### 3.1 HTML 전체가 아니라 JSON으로 응답하기

Ajax를 적용하면 Django view의 역할이 조금 달라진다. 기존 view가 "처리 후 어디로 이동할지"를 결정했다면, Ajax용 view는 "처리 결과로 어떤 데이터가 필요한지"를 결정한다.

예를 들어 팔로우 버튼을 눌렀을 때 브라우저가 알아야 하는 정보는 많지 않다. 현재 사용자가 팔로우 상태인지, 팔로워 수가 몇 명인지, 팔로잉 수가 몇 명인지 정도면 충분하다. 그래서 view는 redirect 대신 JSON을 반환한다.

```python
# accounts/views.py

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST


@login_required
@require_POST
def follow(request, user_pk):
    # 팔로우 대상 사용자를 조회한다.
    # URL에 들어온 user_pk는 JavaScript가 data-user-id에서 읽어 보낸 값이다.
    target_user = get_object_or_404(get_user_model(), pk=user_pk)

    # 자기 자신을 팔로우하는 상황은 관계를 바꿀 필요가 없으므로 제외한다.
    if request.user != target_user:
        # 이미 팔로우 중이면 관계를 끊고, 아니면 새로 연결한다.
        if target_user.followers.filter(pk=request.user.pk).exists():
            target_user.followers.remove(request.user)
        else:
            target_user.followers.add(request.user)

    # 화면 갱신에 필요한 최소 데이터만 JSON으로 보낸다.
    is_followed = target_user.followers.filter(pk=request.user.pk).exists()
    return JsonResponse({
        'is_followed': is_followed,
        'followers_count': target_user.followers.count(),
        'followings_count': target_user.followings.count(),
    })
```

여기서 중요한 점은 view가 더 이상 새 HTML을 만들지 않는다는 것이다. 관계 변경은 서버가 처리하지만, 버튼 문구와 숫자 변경은 브라우저가 처리한다. 그래서 응답 데이터에는 화면 변경에 필요한 값이 빠지지 않아야 한다.

⚠️ 주의: Ajax 요청에서도 Django의 CSRF 검사는 그대로 동작한다. form을 일반 제출할 때는 hidden input이 함께 전송되지만, Axios로 직접 요청할 때는 CSRF 토큰을 헤더에 실어 보내야 한다.

### 3.2 data-* 속성으로 Django 데이터를 JavaScript에 전달하기

JavaScript는 Django 템플릿 변수를 직접 알지 못한다. 템플릿이 렌더링되는 순간 `{{ person.pk }}` 같은 값은 HTML 문자열로 바뀌지만, 별도로 HTML에 남겨 두지 않으면 JavaScript가 읽을 방법이 없다.

이때 사용하는 것이 `data-*` 속성이다. `data-user-id`, `data-article-id`처럼 HTML 요소에 사용자 지정 데이터를 넣어 두면, JavaScript에서는 `dataset`으로 읽을 수 있다.

```html
<!-- accounts/profile.html -->

<form id="follow-form" data-user-id="{{ person.pk }}">
  {% csrf_token %}

  {% if request.user in person.followers.all %}
    <input id="follow-button" type="submit" value="언팔로우">
  {% else %}
    <input id="follow-button" type="submit" value="팔로우">
  {% endif %}
</form>

<p>
  팔로워 <span id="followers-count">{{ person.followers.count }}</span>
  /
  팔로잉 <span id="followings-count">{{ person.followings.count }}</span>
</p>
```

이 구조에서 form은 단순히 제출을 담당하는 요소가 아니라, JavaScript가 필요한 데이터를 읽는 기준점이 된다.

```javascript
const followForm = document.querySelector('#follow-form')

// HTML의 data-user-id는 JavaScript에서 dataset.userId로 읽는다.
const userId = followForm.dataset.userId
```

`data-user-id`가 `dataset.userId`가 되는 이유는 HTML의 kebab-case 이름이 JavaScript에서 camelCase로 변환되기 때문이다. 이 규칙을 알아두면 여러 값을 HTML에서 JavaScript로 넘길 때 훨씬 편하다.

⚠️ 주의: `data-*` 이름에는 대문자를 쓰지 않는 편이 안전하다. HTML에서는 대소문자 처리가 섞일 수 있고, JavaScript의 `dataset` 변환 규칙도 헷갈리기 쉽다.

### 3.3 form 제출을 막고 Axios로 POST 요청 보내기

form에 submit 이벤트가 발생하면 원래 브라우저는 form의 `action` 주소로 이동한다. Ajax를 적용할 때는 이 기본 동작을 막고, JavaScript가 직접 요청을 보내야 한다.

```javascript
// accounts/profile.html 또는 별도 JS 파일

const followForm = document.querySelector('#follow-form')
const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value

followForm.addEventListener('submit', function (event) {
  // form의 기본 제출을 막아 페이지 전체 새로고침을 방지한다.
  event.preventDefault()

  // Django 템플릿에서 HTML에 심어 둔 사용자 pk를 읽는다.
  const userId = event.currentTarget.dataset.userId

  axios({
    method: 'post',
    url: `/accounts/${userId}/follow/`,
    headers: {
      // Django가 POST 요청을 신뢰할 수 있도록 CSRF 토큰을 헤더에 담는다.
      'X-CSRFToken': csrfToken,
    },
  })
    .then((response) => {
      // Django view가 JsonResponse로 보낸 데이터는 response.data에 들어 있다.
      const isFollowed = response.data.is_followed
      const followersCount = response.data.followers_count
      const followingsCount = response.data.followings_count

      const followButton = document.querySelector('#follow-button')
      const followersCountTag = document.querySelector('#followers-count')
      const followingsCountTag = document.querySelector('#followings-count')

      // 서버가 알려준 현재 상태를 기준으로 버튼 문구를 바꾼다.
      followButton.value = isFollowed ? '언팔로우' : '팔로우'

      // 팔로워/팔로잉 수 역시 서버 계산 결과를 그대로 반영한다.
      followersCountTag.textContent = followersCount
      followingsCountTag.textContent = followingsCount
    })
    .catch((error) => {
      console.log(error)
    })
})
```

여기서 `event.currentTarget`은 이벤트 리스너가 붙은 요소, 즉 `followForm`을 가리킨다. 팔로우 form은 하나이기 때문에 `followForm.dataset.userId`로 읽어도 되지만, 이벤트 핸들러 안에서는 `event.currentTarget`을 사용하면 "이 이벤트를 처리하는 기준 요소"라는 의미가 더 분명해진다.

📌 핵심: Ajax 요청에서 서버는 상태를 바꾸고, 브라우저는 응답 JSON을 기준으로 화면을 바꾼다. 둘 중 하나라도 빠지면 사용자는 결과를 즉시 확인할 수 없다.

### 3.4 좋아요는 여러 form을 구별해야 한다

팔로우는 보통 프로필 페이지의 form 하나를 다룬다. 하지만 좋아요는 게시글 목록 페이지에 여러 개가 있다. 게시글마다 form이 하나씩 있고, 각 form은 자신이 어떤 게시글의 좋아요인지 알아야 한다.

이때도 `data-*` 속성을 사용한다.

```html
<!-- articles/index.html -->

<section id="articles-container">
  {% for article in articles %}
    <article>
      <h2>{{ article.title }}</h2>

      <form class="like-form" data-article-id="{{ article.pk }}">
        {% csrf_token %}

        {% if request.user in article.like_users.all %}
          <input id="like-{{ article.pk }}" type="submit" value="좋아요 취소">
        {% else %}
          <input id="like-{{ article.pk }}" type="submit" value="좋아요">
        {% endif %}
      </form>
    </article>
  {% endfor %}
</section>
```

각 form은 `data-article-id`를 가지고 있다. 각 버튼은 `like-게시글pk` 형태의 고유한 id를 가진다. 이렇게 해 두면 서버 응답을 받은 뒤 어떤 버튼을 바꿔야 하는지 정확히 찾을 수 있다.

좋아요 view도 팔로우 view와 비슷하다. 차이는 대상이 사용자 관계가 아니라 게시글과 사용자 사이의 M:N 관계라는 점이다.

```python
# articles/views.py

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from .models import Article


@login_required
@require_POST
def likes(request, article_pk):
    # 어떤 게시글의 좋아요 버튼을 눌렀는지 URL의 article_pk로 찾는다.
    article = get_object_or_404(Article, pk=article_pk)

    # 이미 좋아요를 누른 사용자라면 제거하고, 아니라면 추가한다.
    if article.like_users.filter(pk=request.user.pk).exists():
        article.like_users.remove(request.user)
    else:
        article.like_users.add(request.user)

    is_liked = article.like_users.filter(pk=request.user.pk).exists()
    return JsonResponse({
        'is_liked': is_liked,
    })
```

### 3.5 이벤트 버블링으로 좋아요 이벤트를 위임하기

좋아요 form이 여러 개라고 해서 모든 form에 각각 이벤트 리스너를 붙일 필요는 없다. 이벤트는 자식 요소에서 발생한 뒤 부모 요소로 전파된다. 이 흐름을 이벤트 버블링이라고 한다.

그래서 여러 좋아요 form을 감싸는 상위 요소에 이벤트 리스너를 하나만 등록할 수 있다. 하위 form에서 submit 이벤트가 발생하면, 그 이벤트가 상위 요소까지 올라오고 상위 요소의 핸들러가 이를 처리한다.

```javascript
const articlesContainer = document.querySelector('#articles-container')
const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value

articlesContainer.addEventListener('submit', function (event) {
  // submit 이벤트가 올라오면 우선 기본 제출을 막는다.
  event.preventDefault()

  // 이벤트가 실제로 시작된 form을 찾는다.
  const likeForm = event.target

  // 상위 요소에는 여러 submit 이벤트가 올라올 수 있으므로,
  // 좋아요 form에서 온 이벤트인지 확인한다.
  if (!likeForm.matches('.like-form')) {
    return
  }

  const articleId = likeForm.dataset.articleId

  axios({
    method: 'post',
    url: `/articles/${articleId}/likes/`,
    headers: {
      'X-CSRFToken': csrfToken,
    },
  })
    .then((response) => {
      const isLiked = response.data.is_liked

      // articleId를 이용해 방금 누른 게시글의 버튼만 선택한다.
      const likeButton = document.querySelector(`#like-${articleId}`)
      likeButton.value = isLiked ? '좋아요 취소' : '좋아요'
    })
    .catch((error) => {
      console.log(error)
    })
})
```

이 코드에서 `event.target`은 실제 이벤트가 발생한 요소다. 반면 `event.currentTarget`은 이벤트 리스너가 붙어 있는 요소, 즉 `articlesContainer`다. 이벤트 위임에서는 이 차이가 중요하다. 어떤 form에서 submit이 시작됐는지 알아야 하므로 `event.target`을 사용한다.

⚠️ 주의: 좋아요 버튼을 토글할 때 단순히 `document.querySelector('input[type="submit"]')`처럼 선택하면 첫 번째 버튼만 바뀔 수 있다. 반복되는 요소에서는 `article.pk`처럼 고유한 값을 조합해 특정 버튼을 선택해야 한다.

### 3.6 버블링을 쓰지 않는 방식과 비교하기

이벤트 위임을 쓰지 않는다면 `querySelectorAll()`로 모든 좋아요 form을 선택하고, `forEach()`로 각 form에 이벤트 리스너를 붙여야 한다.

```javascript
const likeForms = document.querySelectorAll('.like-form')

likeForms.forEach((likeForm) => {
  likeForm.addEventListener('submit', function (event) {
    event.preventDefault()

    const articleId = event.currentTarget.dataset.articleId
    // 이후 Axios 요청과 DOM 업데이트는 동일한 방식으로 진행된다.
  })
})
```

이 방식도 동작한다. 다만 게시글이 많아질수록 리스너도 많아지고, 나중에 JavaScript로 게시글을 동적으로 추가하는 경우 새 form에는 리스너가 자동으로 붙지 않는다. 반면 상위 요소에 리스너를 붙이는 이벤트 위임 방식은 구조가 더 단단하다.

📌 핵심: 같은 종류의 요소가 여러 개 반복될 때는 "각 요소마다 처리할 것인가", "상위 요소에서 한 번에 위임할 것인가"를 먼저 판단해야 한다.

## 4. 적용 관점에서 다시 보기

Ajax 기능을 구현할 때는 코드를 바로 쓰기보다 데이터 흐름을 먼저 잡는 것이 좋다.

팔로우라면 먼저 "어떤 사용자 pk가 필요한가"를 확인한다. 그 다음 form에 `data-user-id`를 넣고, JavaScript에서 `dataset.userId`로 읽는다. 요청은 POST이고, Django는 CSRF 검사를 하므로 Axios 헤더에 `X-CSRFToken`을 넣는다. view는 관계를 토글한 뒤 `is_followed`, `followers_count`, `followings_count`처럼 화면에 필요한 값만 JSON으로 반환한다.

좋아요라면 "한 페이지에 같은 form이 여러 개 있다"는 점을 먼저 떠올려야 한다. 각 form에는 `data-article-id`를 넣고, 각 버튼에는 article pk를 조합한 고유 id를 붙인다. 이벤트는 상위 요소에서 위임해 처리하면 반복되는 form을 효율적으로 관리할 수 있다.

구현 순서는 다음처럼 잡으면 안정적이다.

1. 기존 동기 방식 view와 URL이 정상 동작하는지 확인한다.
2. 템플릿 form에 JavaScript가 읽을 `data-*` 값을 넣는다.
3. form의 기본 제출을 `preventDefault()`로 막는다.
4. Axios POST 요청을 작성하고 CSRF 헤더를 포함한다.
5. view의 응답을 `JsonResponse`로 바꾼다.
6. 개발자도구 Network 탭에서 XHR 요청과 응답을 확인한다.
7. 응답 데이터로 DOM을 갱신한다.

⚠️ 주의: Ajax 구현이 안 될 때는 한 번에 DOM부터 의심하지 말고, Network 탭에서 요청 URL, 상태 코드, CSRF 오류 여부, JSON 응답 형태를 먼저 확인하는 편이 빠르다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

기존 Django 흐름에서는 view가 처리 후 redirect를 반환했지만, Ajax 흐름에서는 view가 화면 갱신에 필요한 데이터만 JSON으로 반환한다는 점이 핵심이다. 화면을 다시 그리는 책임이 서버에서 브라우저 쪽으로 일부 이동한다고 볼 수 있다.

### 5.2 앞으로 이어지는 연결점

이 패턴은 팔로우와 좋아요에만 머물지 않는다. 댓글 작성, 북마크, 알림 읽음 처리, 장바구니 수량 변경처럼 "서버 상태는 바꾸되 페이지 전체 새로고침은 피하고 싶은 기능"에 그대로 이어진다.

### 5.3 더 파볼 만한 주제

Axios 요청이 많아지면 CSRF 토큰을 매번 헤더에 적는 방식보다 공통 설정으로 분리하는 방법을 살펴볼 수 있다. 또한 Django REST Framework를 사용하면 JSON 응답 구조를 더 일관되게 설계할 수 있으므로, 이후 API 설계 학습과 자연스럽게 연결된다.

## 6. 요약 정리

Ajax with Django의 핵심은 서버와 브라우저가 역할을 나누는 것이다. Django는 관계를 변경하고 그 결과를 JSON으로 알려준다. JavaScript는 JSON을 받아 현재 화면의 일부만 바꾼다.

🧠 기억할 것:

- `data-*` 속성은 Django 템플릿 값을 JavaScript로 넘기는 안전한 통로다.
- Axios POST 요청에는 CSRF 토큰을 헤더로 포함해야 한다.
- Django view는 `JsonResponse`로 현재 상태와 필요한 카운트를 반환한다.
- 팔로우처럼 form이 하나인 경우 직접 선택해도 충분하다.
- 좋아요처럼 반복되는 form은 이벤트 버블링과 이벤트 위임을 활용하면 관리가 쉬워진다.
- `event.target`은 실제 이벤트가 시작된 요소이고, `event.currentTarget`은 리스너가 붙은 요소다.

## 7. 미니 퀴즈 또는 체크리스트

- [ ] Ajax 요청에서 `event.preventDefault()`를 사용하는 이유를 설명할 수 있는가?
- [ ] `data-user-id`가 JavaScript에서 `dataset.userId`로 읽히는 이유를 설명할 수 있는가?
- [ ] Axios POST 요청에서 CSRF 토큰을 어디에 담아야 하는지 알고 있는가?
- [ ] Django view가 redirect 대신 `JsonResponse`를 반환해야 하는 이유를 설명할 수 있는가?
- [ ] 좋아요 기능에서 `event.target`과 `event.currentTarget`의 차이를 구분할 수 있는가?
- [ ] 반복되는 좋아요 form을 이벤트 위임으로 처리하는 이유를 설명할 수 있는가?
