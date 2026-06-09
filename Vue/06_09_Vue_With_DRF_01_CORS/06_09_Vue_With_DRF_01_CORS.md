# Vue With DRF 01 - CORS와 게시글 API 연동

- 🎯 글의 목표: Vue와 Django REST Framework를 분리된 서버로 실행했을 때 발생하는 요청·응답 흐름을 이해하고, CORS 정책을 해결한 뒤 Axios와 Pinia를 사용해 게시글 목록 조회, 단일 조회, 게시글 생성을 구현한다.
- 🧩 핵심 키워드: Vue, DRF, REST API, Axios, Pinia, RouterLink, useRoute, useRouter, CORS, SOP, Origin, django-cors-headers, Local Storage, v-model, POST 요청
- ⭐ 중요도: ★★★★★  
  프론트엔드와 백엔드를 분리해 개발할 때 반드시 마주치는 기본 흐름이다. 특히 Vue에서 DRF API를 호출하면 대부분 CORS, 비동기 요청, 상태 저장, 라우터 이동, form 제출 처리를 함께 다루게 되므로 프로젝트 연결의 출발점으로 매우 중요하다.
- 📝 한눈에 보는 내용:  
  이번 강의는 Vue와 DRF를 각각 독립된 서버로 실행하고, Vue에서 DRF API로 게시글 데이터를 요청하는 흐름을 다룬다. 처음에는 DRF와 Vue 스켈레톤 프로젝트 구조를 확인하고, Vue의 Article 페이지에서 임시 데이터를 출력한다. 이후 Axios를 사용해 DRF 서버에 실제 요청을 보내면서 CORS 오류를 만나고, 왜 브라우저가 요청을 막는지 SOP와 Origin 개념을 통해 이해한다. 마지막으로 Django 서버에 CORS Header를 설정한 뒤, 전체 게시글 조회, 상세 게시글 조회, 게시글 생성 기능까지 연결한다.
- 🔗 관련 문제 / 주제: Vue + DRF 프로젝트 연동, API 서버와 프론트엔드 분리 개발, 게시판 CRUD, Axios 비동기 요청, Pinia 상태 관리, Vue Router 동적 라우팅, CORS 오류 해결, 인증 시스템으로 확장

---

## 1. 들어가며

Vue와 DRF를 함께 사용하면 프론트엔드와 백엔드가 서로 역할을 나누어 동작한다. Vue는 사용자가 보는 화면과 상호작용을 담당하고, DRF는 데이터베이스에 저장된 데이터를 API 형태로 제공한다. 사용자는 브라우저에서 Vue 화면을 보고 있지만, 게시글 목록이나 상세 정보는 DRF 서버로 요청을 보내 받아오게 된다.

이 구조는 실제 웹 서비스에서 매우 자주 사용된다. 프론트엔드는 `localhost:5173`에서 실행되고, 백엔드는 `127.0.0.1:8000`에서 실행될 수 있다. 겉보기에는 같은 내 컴퓨터에서 실행되는 개발 서버처럼 보이지만, 브라우저 입장에서는 프로토콜, 호스트, 포트 중 하나라도 다르면 서로 다른 출처로 판단한다.

이번 강의에서 중요한 지점은 단순히 코드를 따라 작성하는 것이 아니다. Vue에서 DRF로 요청을 보내는 순간, 브라우저 보안 정책인 CORS를 반드시 만나게 된다. 서버는 분명히 `200 OK`로 응답했는데 브라우저 콘솔에서는 에러가 발생하는 상황도 확인한다. 이때 “서버가 안 되는 것인지, 브라우저가 막는 것인지”를 구분할 수 있어야 이후 프로젝트에서 문제를 훨씬 빠르게 해결할 수 있다.

전체 흐름은 다음과 같다. 먼저 DRF 스켈레톤 프로젝트와 Vue 스켈레톤 프로젝트의 구조를 확인한다. 그다음 Vue에서 임시 게시글 데이터를 출력해 화면 구조를 만든다. 이후 Axios로 DRF 서버에 실제 요청을 보내고, CORS 오류를 해결한다. 마지막으로 API 응답 데이터를 Pinia store에 저장하고, 라우터와 form을 활용해 게시글 목록 조회, 상세 조회, 생성 기능을 구현한다.

---

## 2. 핵심 개념 정리

이번 강의의 큰 질문은 다음과 같다.

> Vue와 DRF를 분리해서 실행할 때, Vue 화면은 어떻게 DRF 서버의 데이터를 가져와 사용할 수 있을까?

이 질문에 답하려면 세 가지 흐름을 함께 이해해야 한다.

첫 번째는 **프로젝트 구조**다. DRF 프로젝트는 데이터를 제공하는 API 서버 역할을 한다. 모델, serializer, URL, view 함수가 준비되어 있고, fixtures 데이터를 로드해 게시글 데이터를 미리 넣어둔다. Vue 프로젝트는 이 API를 호출해 화면에 데이터를 렌더링하는 클라이언트 역할을 한다.

두 번째는 **요청과 응답**이다. Vue에서 `axios`를 사용해 DRF 서버에 HTTP 요청을 보내면, DRF는 JSON 데이터를 응답한다. 이 데이터를 Vue에서 바로 화면에 뿌려도 되지만, 프로젝트가 커지면 여러 컴포넌트가 같은 데이터를 사용하게 되므로 Pinia store에 저장해 관리한다.

세 번째는 **CORS 정책**이다. Vue 개발 서버와 DRF 개발 서버는 서로 다른 포트에서 실행되므로 브라우저는 이를 다른 출처로 본다. 브라우저는 기본적으로 같은 출처의 리소스만 자유롭게 접근하도록 허용한다. 따라서 DRF 서버가 “Vue 출처에서 온 요청은 허용한다”는 CORS Header를 응답에 포함해야 브라우저가 데이터를 사용할 수 있다.

이 기본 흐름을 이해한 뒤에는 게시글 기능으로 확장한다. 전체 게시글 목록은 `GET /api/v1/articles/` 요청으로 가져오고, 단일 게시글은 URL 파라미터의 `id`를 이용해 `GET /api/v1/articles/:id/`로 조회한다. 새 게시글은 `v-model`로 form 입력값을 관리한 뒤 `POST /api/v1/articles/` 요청으로 생성한다.

---

## 3. 본문 정리

## 3.1 프로젝트 개요: Vue와 DRF를 연결하는 첫 번째 단계

이번 수업에서 진행할 프로젝트는 Vue와 DRF의 기본 연동을 시작점으로 삼는다. 앞으로 이어질 내용은 크게 세 단계로 확장된다.

1. Vue와 DRF 간 기본적인 요청과 응답
2. Vue와 DRF에서의 인증 시스템
3. User 커스터마이징

이번 강의는 그중 첫 번째 단계인 **기본 요청과 응답**을 다룬다. 인증이나 사용자 커스터마이징으로 넘어가기 전에, 먼저 Vue가 DRF API에 요청을 보내고 응답 데이터를 화면에 출력하는 기본 구조를 잡는 것이 중요하다.

DRF는 Django REST Framework의 약자로, Django 프로젝트에서 API 서버를 쉽게 만들 수 있도록 도와주는 도구다. Django가 기본적으로 HTML 페이지를 렌더링하는 서버 역할에 익숙하다면, DRF는 JSON 데이터를 주고받는 API 서버로 Django를 사용하는 방식이라고 이해하면 된다.

---

## 3.2 DRF 스켈레톤 프로젝트 확인

DRF 프로젝트는 제공된 스켈레톤 코드를 기반으로 진행한다. 강의에서는 이미 필요한 파일과 패키지가 준비되어 있으며, 주석 처리된 코드를 해제하면서 진행하는 방식이다. 이때 단순히 주석을 해제하는 데서 끝나는 것이 아니라, 각 파일이 어떤 역할을 하는지 같이 이해해야 한다.

### 3.2.1 Model 클래스 확인

Model은 데이터베이스에 저장될 데이터의 구조를 정의한다. 게시판 프로젝트에서는 게시글과 댓글 같은 데이터가 대표적인 모델이 된다. 모델에 어떤 필드가 있는지 알아야 serializer와 view에서 어떤 데이터를 주고받는지 이해할 수 있다.

![Model 클래스 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084344.png>)

위 캡처에서는 `Article` 모델과 관련 필드를 확인한다. 게시글 데이터는 보통 제목, 내용, 작성 시간, 수정 시간 같은 정보를 가진다. DRF에서는 이 모델을 기반으로 JSON 응답을 만들고, 클라이언트에서 보낸 데이터를 다시 모델 인스턴스로 저장한다.

### 3.2.2 URL 확인

Django에서 URL은 요청이 들어왔을 때 어떤 view 함수로 연결할지 결정한다. API 서버에서는 URL이 곧 API endpoint가 된다. 예를 들어 `/api/v1/articles/`는 전체 게시글 목록을 조회하거나 게시글을 생성하는 주소로 사용할 수 있다.

![URL 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084408.png>)

URL 구조를 확인할 때는 단순히 경로 문자열만 보는 것이 아니라, 해당 경로가 어떤 view 함수와 연결되어 있는지를 함께 봐야 한다. Vue에서 Axios 요청을 보낼 때 정확한 URL을 사용해야 하므로 이 부분은 프론트엔드 코드와도 직접 연결된다.

### 3.2.3 Serializer 확인

Serializer는 Django 모델 데이터를 JSON으로 바꾸거나, 클라이언트가 보낸 JSON 데이터를 Django 모델에서 사용할 수 있는 형태로 검증하고 변환하는 역할을 한다.

![Serializers 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084428.png>)

쉽게 말하면 serializer는 DRF와 클라이언트 사이의 번역기다. Vue는 JavaScript 객체와 JSON에 익숙하고, Django는 Python 객체와 모델 인스턴스를 다룬다. Serializer는 이 둘 사이에서 데이터 형식을 맞춰준다.

```python
# serializers.py 예시 구조
from rest_framework import serializers
from .models import Article

class ArticleListSerializer(serializers.ModelSerializer):
    class Meta:
        # 어떤 모델을 JSON으로 변환할지 지정한다.
        model = Article
        # 목록 조회에서 필요한 필드만 응답할 수 있다.
        fields = ('id', 'title', 'content')

class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        # 상세 조회나 생성에서는 전체 필드를 다룰 수 있다.
        fields = '__all__'
```

Serializer를 사용할 때 중요한 점은 목록 조회와 상세 조회에서 필요한 데이터가 다를 수 있다는 것이다. 목록에서는 `id`, `title`, `content` 정도만 필요하고, 상세에서는 더 많은 필드가 필요할 수 있다.

### 3.2.4 views.py의 import와 View 함수 확인

DRF의 view 함수는 실제 요청을 처리하는 핵심 위치다. 어떤 HTTP method가 들어왔는지에 따라 게시글 목록을 반환하거나, 새 게시글을 저장하거나, 특정 게시글을 조회할 수 있다.

![views.py import 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084452.png>)

![View 함수 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084517.png>)

대표적인 view 구조는 다음과 같이 이해할 수 있다.

```python
# views.py 예시 구조
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Article
from .serializers import ArticleListSerializer, ArticleSerializer

@api_view(['GET', 'POST'])
def article_list(request):
    # GET 요청은 전체 게시글 목록을 조회한다.
    if request.method == 'GET':
        articles = Article.objects.all()
        serializer = ArticleListSerializer(articles, many=True)
        return Response(serializer.data)

    # POST 요청은 새 게시글을 생성한다.
    elif request.method == 'POST':
        serializer = ArticleSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
def article_detail(request, article_pk):
    # URL로 받은 article_pk에 해당하는 게시글 하나를 조회한다.
    article = Article.objects.get(pk=article_pk)
    serializer = ArticleSerializer(article)
    return Response(serializer.data)
```

여기서 중요한 점은 Vue가 보내는 요청과 DRF view의 method가 맞아야 한다는 것이다. Vue에서 목록을 가져올 때는 `GET`, 새 게시글을 생성할 때는 `POST`를 사용한다. DRF view도 해당 method를 허용해야 정상적으로 응답할 수 있다.

⚠️ 주의: Vue에서 URL을 정확히 작성했는데도 응답이 오지 않는다면, DRF의 URL 패턴과 view 함수가 연결되어 있는지 먼저 확인해야 한다. 프론트엔드 오류처럼 보여도 실제 원인은 백엔드 URL 설정일 수 있다.

### 3.2.5 settings.py와 fixtures 확인

DRF 프로젝트를 실행하기 위해서는 `settings.py`에서 앱 등록, 미들웨어, REST framework 관련 설정을 확인해야 한다. 이후 fixtures 데이터를 로드해 초기 게시글 데이터를 준비한다.

![settings.py 확인 1](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084538.png>)

![settings.py 확인 2](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084556.png>)

Fixtures는 데이터베이스에 미리 넣어둘 초기 데이터 파일이다. 실습에서는 게시글 데이터를 직접 하나씩 만들지 않고, 준비된 JSON 파일을 로드해 테스트 데이터를 구성한다.

![Fixtures 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084622.png>)

실행 순서는 다음과 같다.

```bash
# 1. 가상 환경 생성
python -m venv venv

# 2. 가상 환경 활성화
source venv/Scripts/activate

# 3. 필요한 패키지 설치
pip install -r requirements.txt

# 4. 마이그레이션 파일 생성 및 DB 반영
python manage.py makemigrations
python manage.py migrate

# 5. fixtures 데이터 로드
python manage.py loaddata articles.json

# 6. Django 개발 서버 실행
python manage.py runserver
```

![가상 환경 생성 및 활성화](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084645.png>)

![패키지 설치](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084702.png>)

![Migration 진행](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084721.png>)

![Fixtures 데이터 로드](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084741.png>)

Django 서버 실행 후 API endpoint로 요청을 보내면 전체 게시글 데이터를 확인할 수 있다.

![Django 서버 실행 후 전체 게시글 조회 요청](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 084808.png>)

📌 핵심: DRF 프로젝트는 Vue가 데이터를 요청할 대상이다. Vue 코드 작성 전에 DRF API가 단독으로 정상 응답하는지 먼저 확인해야 한다.

---

## 3.3 Vue 스켈레톤 프로젝트 확인

Vue 프로젝트는 Vite 기반으로 제공되며, 이미 Pinia와 Vue Router가 추가되어 있다. 또한 `pinia-plugin-persistedstate`가 설치 및 등록되어 있어 Pinia store의 일부 상태를 브라우저 Local Storage에 유지할 수 있다.

이 프로젝트에서는 제공된 스켈레톤 코드 위에 직접 코드를 작성하며 진행한다. 즉, DRF 프로젝트는 주석을 해제하면서 API 서버를 준비하고, Vue 프로젝트는 컴포넌트와 store, router 코드를 직접 연결해 화면을 완성하는 방식이다.

![Vue 컴포넌트와 프로젝트 구조 확인 1](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 085012.png>)

![Vue 컴포넌트와 프로젝트 구조 확인 2](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 085028.png>)

### 3.3.1 App 컴포넌트와 라우터 구조

`App.vue`는 Vue 애플리케이션의 최상위 컴포넌트다. 여기에는 보통 전체 페이지에서 공통으로 보이는 네비게이션 링크와 `RouterView`가 배치된다.

![App 컴포넌트 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 090557.png>)

라우터에는 Article, Create, Detail, Login, Signup과 같은 페이지 컴포넌트가 등록될 수 있다. 이번 강의에서는 게시글 목록, 상세 조회, 생성 기능을 중심으로 Article, Detail, Create 화면을 연결한다.

![route에 등록된 컴포넌트 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 090637.png>)

### 3.3.2 ArticleList와 ArticleListItem 컴포넌트

게시글 목록 화면은 하나의 컴포넌트로만 구성하지 않고, 목록 전체를 담당하는 `ArticleList`와 게시글 하나를 담당하는 `ArticleListItem`으로 나누어 구성한다.

![ArticleList 컴포넌트](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 090703.png>)

![ArticleListItem 컴포넌트](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 090726.png>)

이렇게 컴포넌트를 나누면 게시글 목록 전체의 흐름과 게시글 한 개의 출력 방식을 분리할 수 있다. `ArticleList`는 반복문을 돌며 여러 게시글을 렌더링하고, `ArticleListItem`은 props로 받은 게시글 하나를 화면에 출력한다.

### 3.3.3 router, store, main.js 확인

Vue Router 설정은 `router/index.js`에서 관리한다. 여기에는 URL path, route name, 연결할 컴포넌트가 작성된다.

![router/index.js 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 090750.png>)

Pinia store는 여러 컴포넌트가 함께 사용할 데이터를 관리한다. 이번 강의에서는 게시글 목록을 store에 저장하고, 필요한 컴포넌트에서 참조한다.

![store 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 090809.png>)

`main.js`에서는 Vue 앱을 생성하고, Pinia, Router, persistedstate plugin 등을 앱에 등록한다.

![main.js 현황](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 090831.png>)

Vue 프로젝트 실행 흐름은 다음과 같다.

```bash
# 1. 필요한 패키지 설치
npm install

# 2. 개발 서버 실행
npm run dev
```

⚠️ 주의: 프론트엔드와 백엔드를 동시에 테스트하려면 Vue 서버와 Django 서버가 모두 실행 중이어야 한다. Vue만 실행하면 화면은 뜰 수 있지만 API 요청은 실패하고, Django만 실행하면 API는 동작하지만 Vue 화면에서 데이터를 렌더링할 수 없다.

---

## 3.4 메인 페이지 구현: 임시 데이터로 흐름 먼저 잡기

실제 DRF 요청을 보내기 전에 먼저 Vue 화면에서 게시글 목록이 어떻게 출력되는지 구조를 잡는다. 이 단계에서는 완벽한 프로젝트를 만드는 것이 목표가 아니다. 프론트엔드와 백엔드 프레임워크 간의 요청과 응답, 그리고 그 과정에서 마주치는 문제를 해결하며 하나의 웹 애플리케이션을 완성하는 흐름을 익히는 것이 중요하다.

### 3.4.1 ArticleView route 연결

게시글 목록을 출력하려면 먼저 `ArticleView`를 라우터에 등록해야 한다. 사용자가 특정 URL로 이동했을 때 ArticleView 컴포넌트가 렌더링되어야 하기 때문이다.

![ArticleView route 코드 주석 해제](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091020.png>)

라우터 설정은 보통 다음 구조로 작성한다.

```js
// router/index.js 예시
import { createRouter, createWebHistory } from 'vue-router'
import ArticleView from '@/views/ArticleView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      // 게시글 목록 페이지 URL
      path: '/articles',
      // RouterLink나 router.push에서 사용할 이름
      name: 'article',
      // 이 경로에서 렌더링할 컴포넌트
      component: ArticleView,
    },
  ],
})

export default router
```

### 3.4.2 App.vue에서 ArticleView로 이동하는 링크 작성

라우터에 경로를 등록했다면, 사용자가 해당 페이지로 이동할 수 있도록 `RouterLink`를 작성한다.

![App 컴포넌트 ArticleView RouterLink 작성](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091047.png>)

```vue
<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <nav>
    <!-- name이 article인 라우트로 이동한다. -->
    <RouterLink :to="{ name: 'article' }">Articles</RouterLink>
  </nav>

  <!-- 현재 URL에 매칭되는 view 컴포넌트가 이 위치에 렌더링된다. -->
  <RouterView />
</template>
```

여기서 `RouterLink`는 페이지를 새로고침하지 않고 URL만 변경한다. 그리고 변경된 URL에 맞는 컴포넌트가 `RouterView` 위치에 렌더링된다.

### 3.4.3 ArticleView에 ArticleList 등록

`ArticleView`는 게시글 페이지의 큰 화면 단위 컴포넌트다. 실제 목록 출력은 `ArticleList` 컴포넌트에 맡긴다.

![ArticleList 컴포넌트를 ArticleView에 등록](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091119.png>)

```vue
<!-- ArticleView.vue 예시 -->
<script setup>
// 게시글 목록 출력을 담당하는 하위 컴포넌트를 불러온다.
import ArticleList from '@/components/ArticleList.vue'
</script>

<template>
  <main>
    <h1>Article Page</h1>

    <!-- 게시글 목록 출력 영역 -->
    <ArticleList />
  </main>
</template>
```

이렇게 나누면 ArticleView는 “게시글 페이지”라는 화면 단위 역할을 하고, ArticleList는 “게시글 목록 출력”이라는 구체적인 역할을 맡는다.

### 3.4.4 store에 임시 articles 데이터 작성

처음부터 DRF 서버와 연결하면 에러 원인이 화면 구조인지, 요청 코드인지, 서버 설정인지 구분하기 어렵다. 그래서 먼저 store에 임시 데이터를 넣고 화면 출력 구조가 정상인지 확인한다.

![store에 임시 데이터 articles 배열 작성](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091146.png>)

```js
// stores/articles.js 예시
import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useArticleStore = defineStore('article', () => {
  // 처음에는 DRF 요청 없이 화면 출력 구조를 확인하기 위해 임시 데이터를 사용한다.
  const articles = ref([
    { id: 1, title: 'Article 1', content: 'Content of article 1' },
    { id: 2, title: 'Article 2', content: 'Content of article 2' },
  ])

  // 컴포넌트에서 articles를 사용할 수 있도록 return한다.
  return { articles }
}, { persist: true })
```

여기서 `ref([])`를 사용하는 이유는 게시글 목록이 나중에 API 응답을 받아 변경될 데이터이기 때문이다. Pinia setup store에서는 상태를 반응형으로 만들기 위해 `ref` 또는 `reactive`를 사용한다.

### 3.4.5 ArticleList에서 목록 출력

`ArticleList` 컴포넌트는 store의 `articles`를 참조하고, `v-for`를 사용해 게시글 개수만큼 `ArticleListItem`을 렌더링한다.

![ArticleList 컴포넌트에서 게시글 목록 출력](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091236.png>)

```vue
<!-- ArticleList.vue 예시 -->
<script setup>
import { useArticleStore } from '@/stores/articles'
import ArticleListItem from '@/components/ArticleListItem.vue'

// Pinia store를 가져온다.
const store = useArticleStore()
</script>

<template>
  <section>
    <h2>Article List</h2>

    <!-- store.articles 배열을 순회하며 게시글 하나마다 ArticleListItem을 렌더링한다. -->
    <ArticleListItem
      v-for="article in store.articles"
      :key="article.id"
      :article="article"
    />
  </section>
</template>
```

`ArticleListItem`은 부모로부터 게시글 하나를 props로 전달받는다.

```vue
<!-- ArticleListItem.vue 예시 -->
<script setup>
// 부모 컴포넌트에서 article 객체를 props로 전달받는다.
defineProps({
  article: Object,
})
</script>

<template>
  <article>
    <h3>{{ article.title }}</h3>
    <p>{{ article.content }}</p>
  </article>
</template>
```

![ArticleListItem props 정의 및 목록 출력 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091312.png>)

⚠️ 주의: `v-for`를 사용할 때는 `:key`를 작성하는 습관을 들여야 한다. Vue는 key를 기준으로 각 항목을 구분하므로, 게시글처럼 고유한 `id`가 있는 데이터는 `:key="article.id"`를 사용하는 것이 좋다.

📌 핵심: 실제 API 요청 전에 임시 데이터로 화면 구조를 먼저 확인하면, 이후 Axios나 CORS 문제가 발생했을 때 원인을 더 쉽게 좁힐 수 있다.

---

## 3.5 DRF와의 요청과 응답: Axios로 실제 데이터 가져오기

임시 데이터로 화면 구조를 확인했다면 이제 DRF 서버에서 실제 게시글 데이터를 가져온다. 이때 Vue에서 HTTP 요청을 보내기 위해 Axios를 사용한다.

### 3.5.1 임시 데이터 대신 DRF 응답 데이터 사용하기

이전에는 store에 직접 작성한 임시 배열을 사용했다. 이제는 DRF 서버에 요청을 보내고, 응답으로 받은 데이터를 store에 저장한 뒤 화면에 출력한다.

![DRF 서버로부터 받은 데이터로 저장하기](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091406.png>)

이 흐름은 다음처럼 정리할 수 있다.

1. Vue 컴포넌트가 렌더링된다.
2. `onMounted()`에서 store의 `getArticles()` action을 호출한다.
3. `getArticles()`는 Axios로 DRF 서버에 GET 요청을 보낸다.
4. DRF 서버는 게시글 목록 JSON을 응답한다.
5. 응답 데이터를 store의 `articles`에 저장한다.
6. ArticleList가 store 상태를 읽어 화면에 다시 렌더링한다.

### 3.5.2 Axios 설치

Axios는 Promise 기반의 HTTP 클라이언트 라이브러리다. Vue에서 서버로 요청을 보내고 응답 데이터를 처리할 때 자주 사용한다.

```bash
npm install axios
```

![Axios 설치 및 관련 코드 작성](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091508.png>)

패키지를 설치할 때는 Vue 개발 서버를 종료한 뒤 설치하고, 설치가 끝나면 서버를 다시 실행하는 것이 안전하다.

```bash
# Vue 서버 종료 후 설치
npm install axios

# 설치 후 다시 실행
npm run dev
```

`Promise`는 JavaScript에서 비동기 작업의 결과를 나타내는 객체다. Axios 요청은 서버 응답이 언제 도착할지 알 수 없으므로 Promise 기반으로 동작한다. 그래서 `.then()`에서 성공 응답을 처리하고, `.catch()`에서 실패 응답을 처리한다.

### 3.5.3 store에 getArticles action 작성

게시글 목록을 가져오는 요청은 여러 컴포넌트에서 사용할 수 있으므로 store의 action으로 작성한다.

![getArticles 함수 작성](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091628.png>)

```js
// stores/articles.js 예시
import { ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

export const useArticleStore = defineStore('article', () => {
  // DRF 서버로부터 받아온 게시글 목록을 저장할 상태
  const articles = ref([])

  // DRF 서버의 기본 주소를 상수처럼 관리한다.
  // endpoint를 여러 곳에서 조합할 때 반복을 줄일 수 있다.
  const API_URL = 'http://127.0.0.1:8000'

  const getArticles = function () {
    axios({
      // 전체 게시글 조회는 GET 요청이다.
      method: 'get',

      // DRF의 전체 게시글 목록 API endpoint
      url: `${API_URL}/api/v1/articles/`,
    })
      .then((response) => {
        // 서버 응답의 실제 데이터는 response.data에 들어 있다.
        // 이 데이터를 store 상태에 저장하면 화면이 자동으로 갱신된다.
        articles.value = response.data
      })
      .catch((error) => {
        // 요청 실패 시 콘솔에서 원인을 확인한다.
        console.log(error)
      })
  }

  return { articles, API_URL, getArticles }
}, { persist: true })
```

여기서 `API_URL`을 따로 저장해두면 상세 조회나 게시글 생성 요청에서도 같은 서버 주소를 재사용할 수 있다. endpoint가 여러 곳에 흩어져 있으면 나중에 서버 주소가 바뀌었을 때 수정 범위가 커진다.

### 3.5.4 ArticleView가 마운트될 때 getArticles 실행

게시글 목록 페이지에 들어왔을 때 항상 최신 게시글 목록을 가져오려면 `ArticleView`가 마운트될 때 `getArticles()`를 호출하면 된다.

![ArticleView 마운트 시 getArticles 실행](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091724.png>)

```vue
<!-- ArticleView.vue 예시 -->
<script setup>
import { onMounted } from 'vue'
import { useArticleStore } from '@/stores/articles'
import ArticleList from '@/components/ArticleList.vue'

const store = useArticleStore()

// 컴포넌트가 화면에 처음 렌더링된 뒤 실행된다.
onMounted(() => {
  // DRF 서버에서 전체 게시글 목록을 가져온다.
  store.getArticles()
})
</script>

<template>
  <main>
    <h1>Article Page</h1>
    <ArticleList />
  </main>
</template>
```

`onMounted()`를 사용하는 이유는 컴포넌트가 화면에 렌더링되는 시점에 서버 데이터를 가져오기 위해서다. 페이지에 들어올 때마다 목록을 새로 불러오면, 다른 페이지에서 게시글을 생성한 뒤 돌아왔을 때도 최신 목록을 볼 수 있다.

---

## 3.6 CORS 오류: 서버는 응답했는데 브라우저가 막는 상황

Vue와 DRF 서버를 모두 실행한 뒤 요청을 보내면 에러가 발생한다.

![Vue와 DRF 서버 실행 후 응답 데이터 확인 - 에러 발생](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091758.png>)

이때 DRF 서버 측에서는 정상적으로 응답한 것처럼 보인다. 실제로 Django 터미널에서는 `200 OK`가 확인된다.

![DRF 서버 측에서는 200 OK 응답](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 091849.png>)

그런데 브라우저 콘솔에서는 CORS policy에 의해 요청이 차단되었다는 메시지가 출력된다.

![브라우저가 CORS policy에 의해 요청 차단](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 092000.png>)

여기서 중요한 점은 서버가 응답하지 않은 것이 아니라는 점이다. 서버는 응답했지만, 브라우저가 그 응답을 Vue 애플리케이션에서 사용하지 못하도록 막은 것이다. 이 차이를 이해하지 못하면 백엔드 URL이나 view 함수만 계속 수정하게 될 수 있다.

### 3.6.1 웹 브라우저의 동일 출처 정책과 보안

브라우저는 기본적으로 같은 출처에서 온 요청만 자유롭게 허용한다. 다른 출처로의 요청은 보안상의 이유로 제한한다. 이 규칙을 **SOP(Same-Origin Policy)**, 즉 동일 출처 정책이라고 한다.

```text
동일 출처 정책(SOP)은 같은 출처에서만 리소스를 자유롭게 공유할 수 있다는
웹 브라우저의 기본 보안 규칙이다.
```

SOP는 악의적인 사이트가 사용자의 개인 정보나 인증 정보를 마음대로 가져가는 것을 막기 위해 필요하다. 예를 들어 사용자가 어떤 사이트에 로그인되어 있는 상태에서 악성 사이트에 접속했을 때, 악성 사이트가 다른 서비스의 데이터를 마음대로 읽어오면 매우 위험하다. 브라우저는 이런 위험을 줄이기 위해 기본적으로 다른 출처의 리소스 접근을 제한한다.

⚠️ 주의: CORS 오류는 서버 간 통신 자체를 막는 것이 아니라, 브라우저가 클라이언트 JavaScript에서 다른 출처의 응답을 읽지 못하게 막는 것이다. 그래서 Postman이나 서버 내부 요청에서는 잘 되는데 브라우저에서는 막히는 상황이 생길 수 있다.

---

## 3.7 Origin과 Same-Origin 판단 기준

Origin, 즉 출처는 URL에서 Protocol, Host, Port를 모두 포함한 개념이다. 세 요소가 모두 같아야 동일 출처로 인정된다.

![Origin의 구성 요소](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 100155.png>)

예를 들어 기준 URL이 다음과 같다고 하자.

```text
http://localhost:3000/articles/3/
```

이 URL의 출처는 다음 세 가지로 결정된다.

| 구성 요소 | 값 |
|---|---|
| Protocol | `http` |
| Host | `localhost` |
| Port | `3000` |

경로인 `/articles/3/`은 출처 판단에 포함되지 않는다. 출처는 protocol, host, port로 결정된다.

![동일 출처 여부 비교](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 100246.png>)

Vue 개발 서버가 `http://localhost:5173`이고, DRF 서버가 `http://127.0.0.1:8000`이라면 둘은 다른 출처다. 같은 컴퓨터에서 실행되어도 host와 port가 다르기 때문이다. 그래서 Vue에서 DRF로 요청을 보내면 브라우저는 “다른 출처의 리소스를 읽으려 한다”고 판단한다.

📌 핵심: CORS를 이해할 때는 “같은 컴퓨터인가?”보다 “protocol, host, port가 모두 같은가?”를 기준으로 봐야 한다.

---

## 3.8 CORS Policy의 등장과 의미

SOP는 보안을 위해 필요하지만, 현대 웹 애플리케이션은 여러 출처의 리소스를 함께 사용하는 경우가 많다. 프론트엔드 서버와 백엔드 서버를 분리해서 개발하는 것도 그중 하나다. 만약 SOP만 있고 예외를 허용할 방법이 없다면, Vue와 DRF를 분리한 구조는 브라우저에서 정상적으로 동작하기 어렵다.

그래서 등장한 것이 **CORS(Cross-Origin Resource Sharing)**다.

```text
CORS는 다른 출처의 자원 공유를 허용하기 위해
서버가 브라우저에게 보내는 허가 정책이다.
```

CORS는 서버가 응답에 특정 Header를 포함해 브라우저에게 알려주는 방식이다. 서버가 “이 출처에서 온 요청은 내 데이터를 읽어도 된다”고 응답하면, 브라우저는 그 응답을 클라이언트 JavaScript에서 사용할 수 있게 허용한다.

즉, CORS에서 허용 여부를 결정하는 주체는 서버이고, 실제로 응답 사용을 허용하거나 차단하는 주체는 브라우저다.

---

## 3.9 CORS 적용 방법

CORS를 적용하려면 서버가 응답 Header에 허용할 출처 정보를 포함해야 한다.

예를 들어 Vue 서버가 `http://localhost:5173`이고, DRF 서버가 이 출처를 허용하고 싶다면 응답 Header에 다음과 같은 정보가 포함되어야 한다.

```text
Access-Control-Allow-Origin: http://localhost:5173
```

![CORS 적용 방식](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 112908.png>)

이 흐름을 정리하면 다음과 같다.

1. 브라우저에서 실행 중인 Vue 앱이 DRF 서버에 요청을 보낸다.
2. 브라우저는 Vue 앱의 출처를 함께 고려한다.
3. DRF 서버는 응답에 CORS Header를 포함한다.
4. 브라우저는 Header를 확인하고, 허용된 출처라면 응답 데이터를 Vue 앱에서 사용할 수 있게 한다.

CORS Policy는 다른 출처에 있는 리소스에 안전하게 접근할 수 있도록 허용하거나 차단하는 보안 메커니즘이다. 핵심은 **서버에서 CORS Header를 만들어야 한다**는 점이다.

---

## 3.10 Django에서 CORS Headers 설정하기

Django에서는 `django-cors-headers` 라이브러리를 사용해 손쉽게 응답 객체에 CORS Header를 추가할 수 있다. 이번 스켈레톤 프로젝트에서는 `requirements.txt`에 이미 포함되어 있으므로, 필요한 설정의 주석을 해제하고 허용할 Vue 프로젝트의 출처를 등록한다.

```bash
pip install django-cors-headers
```

![django-cors-headers 설정](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113205.png>)

대표적인 설정은 다음과 같다.

```python
# settings.py 예시
INSTALLED_APPS = [
    # CORS Header를 추가하기 위한 앱
    'corsheaders',
    # ...
]

MIDDLEWARE = [
    # 가능한 위쪽에 배치해 응답에 CORS Header가 잘 추가되도록 한다.
    'corsheaders.middleware.CorsMiddleware',
    # ...
]

# Vue 개발 서버의 출처를 허용한다.
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
```

여기서 `localhost`와 `127.0.0.1`은 개발자가 보기에는 비슷하지만, 브라우저 입장에서는 host 문자열이 다르므로 다른 출처로 취급될 수 있다. 실제 Vue 개발 서버 주소가 무엇으로 열리는지 확인하고 그 주소를 허용 목록에 넣어야 한다.

설정을 마친 뒤 다시 Vue에서 요청을 보내면 DRF 응답 데이터를 정상적으로 받을 수 있다.

![CORS 설정 후 DRF 응답 데이터 재확인 1](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113236.png>)

![CORS 설정 후 DRF 응답 데이터 재확인 2](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113251.png>)

개발자 도구의 Network 탭에서 응답 Header를 확인하면 `Access-Control-Allow-Origin`이 포함된 것을 볼 수 있다.

![Access-Control-Allow-Origin Header 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113349.png>)

⚠️ 주의: Django 설정을 바꾼 뒤에는 서버를 재시작해야 변경 사항이 반영된다. CORS 설정을 올바르게 작성했는데도 계속 오류가 난다면, Django 서버를 껐다가 다시 실행했는지 확인해야 한다.

📌 핵심: CORS 오류는 Vue에서 해결하는 문제가 아니라, DRF 서버가 허용할 출처를 응답 Header로 알려주어야 해결된다.

---

## 3.11 전체 게시글 조회: 응답 데이터를 store에 저장하고 출력하기

CORS 설정이 완료되면 Vue는 DRF 서버 응답을 정상적으로 사용할 수 있다. 이제 전체 게시글 조회 기능을 완성한다.

DRF에서 받은 각 게시글 데이터는 `id`, `title`, `content`와 같은 구조를 가진다.

![응답 받은 데이터의 게시글 구성 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113439.png>)

응답 데이터를 store에 저장하면, ArticleList 컴포넌트는 store의 `articles`를 읽어 목록을 출력한다. 또한 `pinia-plugin-persistedstate` 설정으로 인해 store의 상태가 브라우저 Local Storage에 저장될 수 있다.

![store에 게시글 목록 저장 및 Local Storage 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113536.png>)

이 흐름은 다음 코드로 정리할 수 있다.

```js
// stores/articles.js 핵심 흐름
const articles = ref([])
const API_URL = 'http://127.0.0.1:8000'

const getArticles = function () {
  axios({
    method: 'get',
    url: `${API_URL}/api/v1/articles/`,
  })
    .then((response) => {
      // response.data는 DRF가 JSON으로 보내준 게시글 배열이다.
      articles.value = response.data
    })
    .catch((error) => {
      console.log(error)
    })
}
```

Local Storage에 저장되는 상태는 새로고침 후에도 남아 있을 수 있다. 이는 사용자 경험에는 도움이 되지만, 개발 중에는 “서버에서 새로 받은 데이터인지, 이전에 저장된 데이터인지” 헷갈릴 수 있다.

⚠️ 주의: persistedstate를 사용할 때 화면에 예전 데이터가 계속 남아 있다면 Local Storage를 비우고 다시 확인해야 한다. 특히 API 응답 구조를 바꾸는 실습 중에는 캐시처럼 보이는 상태가 디버깅을 어렵게 만들 수 있다.

---

## 3.12 단일 게시글 조회: URL의 id로 상세 데이터 가져오기

전체 목록에서 게시글 하나를 클릭하면 상세 페이지로 이동하고, 해당 게시글의 상세 데이터를 출력해야 한다. 이때 필요한 것이 Vue Router의 동적 라우팅과 `useRoute()`다.

### 3.12.1 DetailView route 연결

먼저 `DetailView` 관련 route 주석을 해제해 상세 페이지 경로를 등록한다.

![DetailView route 주석 해제](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113616.png>)

```js
// router/index.js 예시
import DetailView from '@/views/DetailView.vue'

const routes = [
  {
    // :id는 URL에서 변하는 게시글 id 값이다.
    path: '/articles/:id',
    name: 'detail',
    component: DetailView,
  },
]
```

`/articles/1`, `/articles/2`처럼 게시글 id만 바뀌는 주소를 하나의 route 설정으로 처리할 수 있다. `:id`는 URL 파라미터이며, DetailView에서 읽어 API 요청에 사용한다.

### 3.12.2 ArticleListItem에서 DetailView로 이동하기

목록의 각 게시글은 상세 페이지로 이동하는 링크를 가져야 한다. `ArticleListItem`은 props로 받은 `article.id`를 사용해 상세 route로 이동한다.

![ArticleListItem에 DetailView RouterLink 작성](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113648.png>)

```vue
<!-- ArticleListItem.vue 예시 -->
<script setup>
defineProps({
  article: Object,
})
</script>

<template>
  <article>
    <h3>{{ article.title }}</h3>
    <p>{{ article.content }}</p>

    <!-- 현재 게시글 id를 URL 파라미터로 전달한다. -->
    <RouterLink :to="{ name: 'detail', params: { id: article.id } }">
      Detail
    </RouterLink>
  </article>
</template>
```

여기서 `params`의 key인 `id`는 router 설정의 `path: '/articles/:id'`에서 `:id`와 이름이 같아야 한다. 만약 `params: { articleId: article.id }`처럼 작성하면 route가 기대하는 `id` 값이 채워지지 않는다.

### 3.12.3 DetailView에서 useRoute로 id 읽기

상세 페이지가 마운트되면 현재 URL의 `id`를 읽고, 그 id로 DRF 서버에 단일 게시글 조회 요청을 보낸다.

![DetailView 마운트 시 특정 게시글 조회 요청](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113729.png>)

```vue
<!-- DetailView.vue 예시 -->
<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { useArticleStore } from '@/stores/articles'

const route = useRoute()
const store = useArticleStore()

// 상세 게시글 하나를 저장할 상태
const article = ref(null)

onMounted(() => {
  axios({
    method: 'get',
    // 현재 URL의 id 값을 사용해 단일 게시글 API endpoint를 만든다.
    url: `${store.API_URL}/api/v1/articles/${route.params.id}/`,
  })
    .then((response) => {
      // 단일 게시글 객체를 저장한다.
      article.value = response.data
    })
    .catch((error) => {
      console.log(error)
    })
})
</script>

<template>
  <main>
    <h1>Detail</h1>

    <!-- article이 아직 null일 수 있으므로 v-if로 데이터가 있을 때만 출력한다. -->
    <article v-if="article">
      <p>글 번호: {{ article.id }}</p>
      <p>제목: {{ article.title }}</p>
      <p>내용: {{ article.content }}</p>
      <p>작성일: {{ article.created_at }}</p>
      <p>수정일: {{ article.updated_at }}</p>
    </article>
  </main>
</template>
```

응답 데이터를 저장한 뒤 template에서 출력하면 상세 페이지가 완성된다.

![응답 데이터 저장 후 출력 1](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113756.png>)

![응답 데이터 저장 후 출력 2](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113810.png>)

결과 화면에서는 선택한 게시글의 상세 정보가 출력된다.

![단일 게시글 조회 결과 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113828.png>)

⚠️ 주의: 상세 조회에서 가장 흔한 실수는 URL 끝의 `/`를 빠뜨리는 것이다. DRF 기본 설정에서는 trailing slash를 기대하는 경우가 많으므로, `/api/v1/articles/1/`처럼 마지막 슬래시까지 확인하는 습관이 필요하다.

📌 핵심: 목록에서 상세로 이동할 때는 `RouterLink`로 id를 넘기고, 상세 페이지에서는 `useRoute()`로 id를 읽어 DRF API 요청에 사용한다.

---

## 3.13 게시글 작성: v-model과 Axios POST 요청

마지막으로 게시글 생성 기능을 구현한다. 게시글 작성은 사용자의 입력을 받아 서버에 저장하는 기능이므로, form 입력 관리와 POST 요청이 함께 필요하다.

### 3.13.1 CreateView route 연결

먼저 `CreateView` 관련 route 주석을 해제해 게시글 작성 페이지를 라우터에 등록한다.

![CreateView route 주석 해제](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113859.png>)

```js
// router/index.js 예시
import CreateView from '@/views/CreateView.vue'

const routes = [
  {
    path: '/create',
    name: 'create',
    component: CreateView,
  },
]
```

### 3.13.2 ArticleView에서 CreateView로 이동하기

게시글 목록 페이지에서 글쓰기 페이지로 이동할 수 있도록 `RouterLink`를 작성한다.

![ArticleView에 CreateView RouterLink 작성](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 113933.png>)

```vue
<!-- ArticleView.vue 예시 -->
<template>
  <main>
    <h1>Article Page</h1>

    <!-- 게시글 작성 페이지로 이동 -->
    <RouterLink :to="{ name: 'create' }">CREATE</RouterLink>

    <ArticleList />
  </main>
</template>
```

### 3.13.3 v-model로 form 입력값 관리

게시글 작성 화면에서는 제목과 내용을 입력받는다. Vue에서는 `v-model`을 사용해 input 값과 script의 반응형 변수를 양방향으로 연결할 수 있다.

![v-model과 trim 수식어 사용](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 114013.png>)

```vue
<script setup>
import { ref } from 'vue'

// 사용자가 입력한 제목과 내용을 저장할 상태
const title = ref('')
const content = ref('')
</script>

<template>
  <form>
    <div>
      <label for="title">제목</label>
      <!-- trim 수식어는 앞뒤 공백을 제거한다. -->
      <input id="title" type="text" v-model.trim="title">
    </div>

    <div>
      <label for="content">내용</label>
      <textarea id="content" v-model.trim="content"></textarea>
    </div>
  </form>
</template>
```

`v-model`을 사용하면 사용자가 input에 입력한 값이 `title.value`, `content.value`에 자동으로 반영된다. 반대로 script에서 값을 바꾸면 input에도 반영된다. 그래서 양방향 바인딩이라고 부른다.

![양방향 바인딩 데이터 입력 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 114037.png>)

### 3.13.4 createArticle 함수 작성

사용자가 form을 제출하면 DRF 서버에 POST 요청을 보내 새 게시글을 생성한다. 생성이 성공하면 게시글 목록 페이지로 이동시킨다.

![createArticle 함수 작성](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 114119.png>)

```vue
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useArticleStore } from '@/stores/articles'

const router = useRouter()
const store = useArticleStore()

const title = ref('')
const content = ref('')

const createArticle = function () {
  axios({
    // 게시글 생성은 POST 요청이다.
    method: 'post',

    // 전체 게시글 endpoint로 POST 요청을 보내면 새 게시글을 생성한다.
    url: `${store.API_URL}/api/v1/articles/`,

    // 서버로 보낼 데이터는 data에 작성한다.
    data: {
      title: title.value,
      content: content.value,
    },
  })
    .then((response) => {
      // 생성 성공 후 게시글 목록 페이지로 이동한다.
      router.push({ name: 'article' })
    })
    .catch((error) => {
      console.log(error)
    })
}
</script>
```

여기서 `useRouter()`는 페이지 이동을 실행하기 위해 사용한다. `useRoute()`가 현재 URL 정보를 읽는 역할이라면, `useRouter()`는 `router.push()`처럼 실제 이동을 명령하는 역할이다.

### 3.13.5 submit.prevent로 기본 제출 동작 막기

HTML form은 기본적으로 submit이 발생하면 페이지를 새로고침하려는 동작을 가진다. SPA에서는 새로고침 없이 JavaScript 함수로 요청을 보내야 하므로, `@submit.prevent`를 사용해 기본 동작을 막고 `createArticle` 함수를 실행한다.

![submit.prevent로 createArticle 호출](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 114159.png>)

```vue
<template>
  <!-- submit 이벤트가 발생하면 새로고침을 막고 createArticle 함수를 실행한다. -->
  <form @submit.prevent="createArticle">
    <div>
      <label for="title">제목</label>
      <input id="title" type="text" v-model.trim="title">
    </div>

    <div>
      <label for="content">내용</label>
      <textarea id="content" v-model.trim="content"></textarea>
    </div>

    <input type="submit" value="CREATE">
  </form>
</template>
```

게시글 생성 요청이 성공하면 DB에 새 데이터가 추가되고, 목록 페이지로 돌아갔을 때 새 게시글을 확인할 수 있다.

![게시글 생성 결과 및 DB 확인](<../assets/images/06_09_Vue_With_DRF_01_CORS/화면 캡처 2026-06-09 114222.png>)

⚠️ 주의: form 제출에서 `.prevent`를 빼면 브라우저가 페이지를 새로고침하면서 Vue 상태가 초기화될 수 있다. Axios 요청을 보내기도 전에 화면이 갱신되어 원하는 흐름이 깨질 수 있으므로, SPA form에서는 `@submit.prevent`를 자주 사용한다.

📌 핵심: 게시글 생성은 `v-model`로 입력값을 관리하고, Axios POST 요청으로 DRF에 데이터를 보낸 뒤, 성공 시 `router.push()`로 목록 페이지로 이동하는 흐름이다.

---

## 4. 적용 관점에서 다시 보기

이번 강의 내용은 Vue와 DRF를 연결하는 프로젝트의 가장 기본적인 패턴이다. 실제 프로젝트에서 “프론트 화면은 만들었는데 백엔드 데이터와 어떻게 연결하지?”라는 상황이 오면 이번 흐름을 그대로 떠올리면 된다.

먼저 백엔드 API가 단독으로 정상 동작하는지 확인해야 한다. DRF의 model, serializer, url, view가 준비되어 있고, 브라우저나 Postman에서 `/api/v1/articles/` 요청이 정상 응답하는지 먼저 확인한다. 백엔드 단독 요청이 실패한다면 Vue 코드를 아무리 수정해도 해결되지 않는다.

그다음 Vue에서는 화면 구조를 먼저 만든다. ArticleView, ArticleList, ArticleListItem처럼 역할을 나누고, 처음에는 임시 데이터로 목록이 잘 렌더링되는지 확인한다. 화면 구조가 정상임을 확인한 뒤 Axios 요청으로 데이터를 바꾸면, 에러가 발생했을 때 원인을 더 쉽게 분리할 수 있다.

API 요청을 store action에 작성하는 것도 중요한 패턴이다. 게시글 목록은 여러 컴포넌트에서 사용할 수 있고, 목록 페이지에 들어올 때마다 새로 불러와야 하므로 Pinia store에 `getArticles()` 같은 action으로 정리하는 것이 자연스럽다.

CORS 오류를 만나면 서버 로그와 브라우저 콘솔을 함께 봐야 한다. 서버 로그에 `200 OK`가 찍혔다면 서버 view가 실패한 것이 아니라 브라우저가 응답 사용을 막은 것일 수 있다. 이때는 Django의 `django-cors-headers` 설정과 `CORS_ALLOWED_ORIGINS`에 Vue 개발 서버 주소가 정확히 들어갔는지 확인한다.

상세 페이지는 URL 파라미터를 API 요청에 연결하는 대표적인 예시다. 목록에서 `article.id`를 params로 넘기고, DetailView에서 `useRoute()`로 읽어 단일 조회 API에 사용한다. 이런 패턴은 게시글뿐 아니라 상품 상세, 사용자 프로필, 영화 상세 페이지에서도 그대로 사용된다.

게시글 생성은 form 입력값, POST 요청, 이동 처리가 연결된 흐름이다. 입력값은 `v-model`, 요청은 Axios, 생성 후 이동은 `useRouter()`와 `router.push()`로 처리한다. 이 세 가지가 자연스럽게 이어지면 이후 수정, 삭제 기능도 비슷한 방식으로 확장할 수 있다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

Vue와 DRF를 각각 실행하면 단순히 다른 서버 두 개가 뜨는 것이 아니라, 브라우저 기준으로 서로 다른 출처 간 요청이 발생한다는 점을 이해하게 된다. 서버가 정상 응답했더라도 브라우저가 CORS 정책에 따라 응답 사용을 막을 수 있다는 점이 핵심이다.

또한 API 요청 코드는 컴포넌트에 무작정 작성하기보다 Pinia store의 action으로 정리하면 데이터 흐름이 더 명확해진다. 컴포넌트는 화면과 사용자 이벤트를 담당하고, store는 서버 요청과 상태 저장을 담당하는 식으로 역할을 나눌 수 있다.

### 5.2 앞으로 이어지는 연결점

이번 강의의 요청·응답 구조는 이후 인증 시스템으로 이어진다. 로그인, 회원가입, 토큰 저장, 인증이 필요한 요청을 보낼 때도 결국 Vue에서 DRF로 Axios 요청을 보내고, 응답 데이터를 상태로 관리하는 흐름이 반복된다.

또한 게시글 목록, 상세, 생성 흐름은 CRUD의 절반 이상을 차지한다. 여기에 수정 요청은 `PUT` 또는 `PATCH`, 삭제 요청은 `DELETE`를 연결하면 기본 게시판 기능을 확장할 수 있다.

### 5.3 더 파볼 만한 주제

이번 강의에서는 CORS를 개발 환경 중심으로 다뤘지만, 실제 배포 환경에서는 허용 출처를 더 신중하게 관리해야 한다. 모든 출처를 허용하는 설정은 편하지만 보안상 위험할 수 있으므로, 운영 환경에서는 실제 프론트엔드 도메인만 명시적으로 허용하는 방식이 필요하다.

또한 Axios 요청이 많아지면 API 모듈을 따로 분리하거나, Axios instance를 만들어 기본 URL과 header를 공통 관리하는 방식으로 발전시킬 수 있다. 인증 토큰을 사용하는 프로젝트에서는 이 구조가 특히 중요해진다.

---

## 6. 요약 정리

📌 핵심

- DRF는 API 서버 역할을 하고, Vue는 API를 호출해 화면을 렌더링하는 클라이언트 역할을 한다.
- Vue와 DRF가 서로 다른 포트에서 실행되면 브라우저는 서로 다른 출처로 판단한다.
- SOP는 같은 출처의 리소스만 자유롭게 접근하도록 허용하는 브라우저 보안 정책이다.
- CORS는 서버가 다른 출처의 접근을 허용한다는 Header를 브라우저에게 알려주는 정책이다.
- CORS 오류는 Vue 코드만의 문제가 아니라, DRF 서버 응답 Header 설정이 필요하다.
- Django에서는 `django-cors-headers`를 사용해 `CORS_ALLOWED_ORIGINS`에 Vue 개발 서버 주소를 등록한다.
- Axios는 Vue에서 DRF 서버로 HTTP 요청을 보내고 응답을 처리하는 데 사용한다.
- 전체 게시글 목록은 `GET /api/v1/articles/` 요청으로 가져와 Pinia store에 저장한다.
- 상세 게시글은 RouterLink로 id를 넘기고, DetailView에서 `useRoute()`로 id를 읽어 단일 조회 API에 요청한다.
- 게시글 생성은 `v-model`로 입력값을 관리하고, Axios POST 요청으로 DRF에 데이터를 전송한다.
- 생성 성공 후에는 `useRouter()`와 `router.push()`로 게시글 목록 페이지로 이동할 수 있다.

🧠 기억할 것

> 서버가 `200 OK`를 반환했는데 브라우저에서 CORS 오류가 난다면, 서버 응답 자체가 실패한 것이 아니라 브라우저가 응답 사용을 막은 것이다.  
> URL의 출처는 Protocol, Host, Port 세 가지로 판단한다.  
> Vue에서 읽을 때는 `useRoute()`, 이동시킬 때는 `useRouter()`를 사용한다.  
> API 요청은 화면 구조를 먼저 확인한 뒤 연결하면 디버깅이 훨씬 쉬워진다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. Vue와 DRF를 분리해서 실행할 때 Vue 서버와 DRF 서버는 왜 다른 출처로 판단될 수 있는가?
2. Origin을 구성하는 세 가지 요소는 무엇인가?
3. SOP는 어떤 보안 문제를 막기 위한 브라우저 정책인가?
4. 서버 로그에는 `200 OK`가 찍혔는데 브라우저 콘솔에는 CORS 오류가 뜬다면, 어느 쪽 문제로 접근해야 하는가?
5. Django에서 CORS Header를 추가하기 위해 사용하는 라이브러리는 무엇인가?
6. `CORS_ALLOWED_ORIGINS`에 등록해야 하는 주소는 DRF 서버 주소인가, Vue 개발 서버 주소인가?
7. Axios 요청에서 서버 응답 데이터는 보통 어느 속성에 들어 있는가?
8. Pinia store에 `getArticles()` action을 작성하면 어떤 장점이 있는가?
9. 목록 페이지에서 상세 페이지로 이동할 때 `params: { id: article.id }`의 `id`는 router 설정의 무엇과 일치해야 하는가?
10. 게시글 작성 form에서 `@submit.prevent`를 사용하는 이유는 무엇인가?
11. `useRoute()`와 `useRouter()`는 각각 어떤 상황에서 사용하는가?
12. 게시글 생성 후 목록 페이지로 이동하려면 어떤 메서드를 사용할 수 있는가?
