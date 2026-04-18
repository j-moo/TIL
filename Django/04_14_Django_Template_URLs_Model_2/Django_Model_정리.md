# Django Model

- 🎯 글의 목표: Django Model이 어떤 역할을 하는지 이해하고, 모델 정의부터 마이그레이션, 관리자 페이지 등록, 데이터베이스 초기화까지 한 흐름으로 정리한다.
- 🧩 핵심 키워드: Model, Field type, Field option, Migration, makemigrations, migrate, Admin site, SQLite
- ⭐ 중요도: 상
- 📝 한눈에 보는 내용: 이번 강의는 Django에서 데이터를 어떻게 설계하고 관리하는지를 다룬다. 화면을 만드는 `templates`나 요청을 받는 `views.py`와 달리, `models.py`는 어떤 데이터를 어떤 구조로 저장할지 정하는 출발점이다. 이 설계를 실제 DB에 반영하려면 migration 과정이 필요하고, 이후에는 admin site를 통해 웹에서 직접 데이터를 관리할 수도 있다.
- 🔗 관련 문제 / 주제(있다면): 게시판 CRUD, 데이터 설계, 관리자 페이지, DB 변경 반영

---

## 1. 들어가며

Django를 처음 배울 때는 URL과 View, Template 흐름이 먼저 눈에 들어온다. 하지만 프로젝트가 조금만 커져도 결국 중요한 질문은 하나로 모인다.

**“이 데이터를 어떤 구조로 저장할 것인가?”**

바로 이 질문에 답하는 자리가 `Model`이다. Model은 단순히 데이터를 담는 클래스가 아니라, **데이터베이스 테이블의 구조를 파이썬 코드로 설계하는 자리**다. 그래서 이번 강의는 문법 하나를 더 배우는 시간이기보다, Django 프로젝트가 데이터를 다루는 방식의 중심축을 이해하는 시간에 가깝다.

이 글은 다음 흐름으로 읽으면 이해가 쉽다.

1. Model이 프로젝트 안에서 어디에 놓이는지 먼저 잡고,
2. Model class가 실제로 어떤 테이블을 의미하는지 이해한 뒤,
3. Field type과 option으로 열의 성격을 정하고,
4. migration으로 그 설계를 DB에 반영하는 흐름을 익힌다.
5. 마지막으로 admin site와 SQLite, 초기화 방법까지 연결해 보면 전체 그림이 한 번에 정리된다.

## 2. 핵심 개념 정리

이번 강의의 핵심 흐름은 아래처럼 정리할 수 있다.

- **Model은 데이터 설계도**다. 어떤 컬럼을 만들지, 그 컬럼이 어떤 자료형을 가질지 Python 클래스로 정의한다.
- **Field type**은 데이터의 종류를 정한다. 예를 들어 짧은 문자열인지, 긴 본문인지, 날짜인지가 여기에 해당한다.
- **Field option**은 제약 조건과 동작을 정한다. `null`, `blank`, `default`, `auto_now_add`, `auto_now` 같은 옵션이 대표적이다.
- **Migration**은 설계한 모델을 실제 DB 구조로 반영하는 과정이다.
  - `makemigrations`: 최종 설계도를 만든다.
  - `migrate`: 설계도를 DB에 적용한다.
- **Admin site**는 등록된 모델을 웹 UI로 관리하게 해 준다.
- **SQLite**는 Django 기본 DB이며, `db.sqlite3`는 버전 관리 대상에서 제외하는 것이 원칙이다.

즉, 이번 강의는 개별 명령어를 외우는 것보다,

> **“모델을 정의하고 → 설계도를 만들고 → DB에 반영하고 → 관리자 페이지에서 다루는 흐름”**

을 하나의 묶음으로 이해하는 것이 중요하다.

## 3. 본문 정리

이번 장에서는 Model의 위치와 의미를 먼저 잡고, 그 뒤에 실제 코드와 migration 흐름, admin 등록까지 차례대로 연결한다. 핵심은 개념과 예시를 따로 떼지 않고, **설명하는 자리에서 바로 코드와 화면을 같이 보는 것**이다.

### 3.1 Model은 프로젝트에서 어디에 놓일까

한 줄로 말하면, **Model은 Django 프로젝트 안에서 데이터베이스와 가장 직접적으로 맞닿아 있는 레이어**다.

URL이 요청의 입구를 맡고, View가 요청을 처리한다면, Model은 그 과정에서 필요한 데이터를 저장하고 읽어오는 기준을 만든다. Template은 그렇게 가공된 결과를 화면으로 보여준다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 011023.jpg>)

위 구조를 보면 `models.py`가 프로젝트 바깥의 데이터베이스와 연결되는 핵심 지점이라는 점이 분명해진다. 여기서 중요한 점은, Django가 DB를 직접 SQL로만 다루게 하지 않고, **Python 클래스라는 익숙한 형식으로 추상화해 준다**는 것이다. 그래서 개발자는 DB 내부 동작을 매번 직접 작성하기보다, 필요한 데이터 구조를 코드로 명확하게 표현하는 데 집중할 수 있다.

💡 포인트: Model은 단순 저장소가 아니라, **프로젝트에서 데이터가 어떤 의미를 갖는지 선언하는 자리**라고 보면 이해가 쉽다.

📌 핵심: `models.py`는 Django에서 데이터 구조를 정의하고 데이터베이스와 상호작용하는 중심 지점이다.

### 3.2 Model class는 테이블의 설계도다

Model class는 **DB 테이블의 구조를 Python 클래스로 표현한 것**이다. 강의에서는 `Article` 모델을 예시로 사용한다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 011435.jpg>)

```python
# articles/models.py
from django.db import models


class Article(models.Model):
    # 제목처럼 길이가 비교적 짧은 문자열은 CharField로 정의한다.
    # max_length는 저장 가능한 최대 길이를 정하는 중요한 기준이다.
    title = models.CharField(max_length=10)

    # 본문처럼 길이가 길어질 수 있는 값은 TextField로 정의한다.
    # 일반적으로 게시글 내용, 설명문, 긴 텍스트에 자주 사용한다.
    content = models.TextField()
```

이 코드는 단순히 파이썬 클래스 하나를 만든 것이 아니라, **`Article`이라는 이름의 테이블에 어떤 열이 필요한지를 선언한 것**이다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 011608.jpg>)

위 그림처럼 `title`, `content`는 각각 테이블의 컬럼이 된다. 그리고 `id` 필드는 별도로 쓰지 않았더라도 Django가 기본 키로 자동 생성해 준다. 그래서 Model을 읽을 때는 “이 클래스가 어떤 객체를 만들까?”보다 **“이 클래스가 어떤 테이블 구조를 만들까?”**라는 관점으로 보는 것이 더 중요하다.

또 하나 중요한 점은 `models.Model`을 상속받는다는 부분이다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 102704.jpg>)

이 상속 덕분에 개발자는 DB 연결, 저장, 조회, 수정, 삭제에 필요한 복잡한 기능을 직접 구현하지 않아도 된다. Django는 이미 잘 만들어진 부모 클래스를 제공하고, 개발자는 그 위에 **필드 정의라는 핵심 설계 정보만 올려놓으면 된다.**

📌 핵심: Model class는 테이블 구조를 정의하는 설계도이고, `models.Model` 상속은 Django가 제공하는 데이터 조작 기능을 그대로 활용하기 위한 기반이다.

### 3.3 클래스 변수와 Model Field는 무엇을 의미할까

Model 안에서 선언한 클래스 변수는 단순한 파이썬 속성이 아니라, **데이터베이스 테이블의 각 열(column)** 에 대응한다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 102800.jpg>)

예를 들어 `title`, `content`라는 이름은 이후 테이블의 컬럼명으로 이어진다. 그래서 모델을 작성할 때는 변수명을 아무렇게나 짓기보다, **실제로 DB에 저장될 데이터의 의미가 잘 드러나는 이름**으로 정하는 것이 중요하다.

그다음 눈여겨볼 부분이 `CharField`, `TextField` 같은 표현이다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 102900.jpg>)

Model Field는 데이터의 종류와 제약 조건을 함께 담는 핵심 요소다. 위 예시에서는 다음 두 가지를 바로 읽어낼 수 있다.

- `title = models.CharField(max_length=10)`
  - 짧은 문자열을 저장한다.
  - 최대 길이 10이라는 제한을 가진다.
- `content = models.TextField()`
  - 비교적 긴 텍스트를 저장한다.
  - 게시글 본문처럼 길이 제한이 유연한 데이터에 어울린다.

여기서 중요한 점은, 필드 선언이 단순히 저장 타입만 정하는 것이 아니라 **유효성 검사와 데이터 의미까지 함께 드러낸다**는 점이다. 제목은 짧아야 하고, 내용은 길어질 수 있다는 사실이 코드 자체에 녹아 있는 셈이다.

⚠️ 주의: 필드 정의를 대충 해 두면 나중에 폼 검증, DB 구조, 화면 출력까지 여러 곳에서 애매함이 생긴다. 처음 모델을 만들 때부터 데이터 성격을 분명히 정해 두는 습관이 중요하다.

📌 핵심: 클래스 변수명은 컬럼 이름이 되고, Model Field는 그 컬럼의 데이터 유형과 제약 조건을 함께 정의한다.

### 3.4 Field type과 Field option은 어떻게 나뉠까

한 줄 정의부터 잡고 가면,

- **Field type**은 “무슨 종류의 데이터인가”를 정하고,
- **Field option**은 “그 데이터에 어떤 제약과 동작을 줄 것인가”를 정한다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 104258.jpg>)

쉽게 말하면, `CharField`, `TextField`, `DateTimeField`는 **데이터의 본질적인 종류**를 말하고, `max_length`, `null`, `blank`, `default`, `auto_now_add`, `auto_now`는 **그 필드를 어떤 방식으로 다룰지**를 정한다.

대표적인 Field type은 다음과 같다.

- 문자열 필드: `CharField`, `TextField`
- 숫자 필드: `IntegerField`, `FloatField`
- 날짜/시간 필드: `DateField`, `TimeField`, `DateTimeField`
- 파일 관련 필드: `FileField`, `ImageField`

대표적인 Field option은 다음과 같다.

- `null`: DB에 `NULL` 값을 허용할지 결정
- `blank`: form 입력에서 빈 값을 허용할지 결정
- `default`: 기본값을 설정
- `auto_now_add`: 생성 시점의 날짜/시간 자동 저장
- `auto_now`: 수정 시점의 날짜/시간 자동 저장

특히 `null`과 `blank`는 초반에 자주 헷갈린다.

- `null`은 **데이터베이스 레벨**의 허용 여부이고,
- `blank`는 **입력 폼 레벨**의 허용 여부다.

비슷해 보이지만 적용되는 층위가 다르기 때문에, 실제 프로젝트에서는 둘을 구분해서 생각해야 한다.

📌 핵심: Field type은 데이터의 종류를, Field option은 그 데이터의 제약과 동작을 정한다.

### 3.5 Migration은 설계도를 DB에 반영하는 과정이다

Model class를 작성했다고 해서 곧바로 DB 구조가 바뀌는 것은 아니다. 여기서 필요한 과정이 바로 **Migration**이다.

강의에서는 migration을 “최종 설계도를 만들고, 그 설계도를 데이터베이스에 반영하는 과정”으로 설명한다. 이 표현이 아주 적절하다. 모델 클래스는 아직 초안이고, migration 파일은 그 초안을 실제로 반영 가능한 설계도로 정리한 결과라고 볼 수 있다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 111004.jpg>)

```bash
# 1) 모델 변경 사항을 감지해서 migration 파일 생성
python manage.py makemigrations
```

위 명령을 실행하면 `articles/migrations/0001_initial.py` 같은 파일이 만들어진다. 이 파일은 단순 로그가 아니라, **어떤 모델이 어떤 구조로 생성되어야 하는지 기록한 Python 코드**다.

그다음 이 설계도를 실제 DB에 적용해야 한다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 111319.jpg>)

```bash
# 2) 생성된 migration 파일을 실제 데이터베이스에 적용
python manage.py migrate
```

이 과정을 한 번에 보면 더 명확해진다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 111353.jpg>)

- `models.py`에서 모델을 정의한다.
- `makemigrations`로 migration 파일을 만든다.
- `migrate`로 그 설계를 DB에 반영한다.

많이들 여기서 막히는 이유는, 모델 코드를 고쳤을 때 “코드는 바뀌었는데 왜 DB는 그대로지?”라는 지점 때문이다. 이유는 간단하다. **모델 변경과 DB 반영은 별도의 단계**이기 때문이다.

⚠️ 주의: 모델을 수정한 뒤 `makemigrations`와 `migrate`를 빼먹으면 코드와 데이터베이스 상태가 서로 어긋난다.

📌 핵심: Model 수정은 시작일 뿐이고, 실제 반영은 `makemigrations`와 `migrate` 두 단계까지 가야 끝난다.

### 3.6 Migration 경고 메시지는 무엇을 뜻할까

서버를 실행했는데 migration 관련 경고가 뜨는 경우가 있다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 111725.jpg>)

이 메시지는 지금 프로젝트 안에 **아직 DB에 반영되지 않은 migration 파일이 남아 있다**는 뜻이다. 다시 말해, 모델 구조와 실제 데이터베이스 구조가 완전히 일치하지 않을 가능성이 있다는 신호다.

이때 가장 먼저 할 일은 메시지 그대로 `python manage.py migrate`를 실행하는 것이다.

이 경고를 가볍게 넘기면 안 되는 이유는 분명하다.

- 최신 모델이 DB에 반영되지 않았을 수 있고,
- 그 결과 CRUD 동작이나 조회 결과가 예상과 다르게 나올 수 있으며,
- 필드 추가/삭제가 적용되지 않은 상태에서 프로젝트를 계속 진행하면 더 큰 혼란이 생긴다.

💡 포인트: migration 경고는 단순 알림이 아니라, **모델 설계와 실제 DB 상태가 어긋나 있다는 실전 신호**다.

📌 핵심: migration 경고가 보이면, 지금 당장 DB 반영 상태를 점검해야 한다.

### 3.7 기존 테이블에 필드를 추가할 때 왜 기본값을 묻는가

새 모델을 처음 만드는 것보다, 이미 존재하는 테이블에 필드를 추가할 때 더 많이 헷갈린다. 강의에서는 `created_at`, `updated_at` 필드를 추가하는 예시로 이 상황을 설명한다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 112110.jpg>)

```python
# articles/models.py
from django.db import models


class Article(models.Model):
    title = models.CharField(max_length=10)
    content = models.TextField()

    # 레코드가 처음 생성될 때의 시각을 자동 저장
    created_at = models.DateTimeField(auto_now_add=True)

    # 레코드가 저장될 때마다 현재 시각으로 자동 갱신
    updated_at = models.DateTimeField(auto_now=True)
```

이제 `makemigrations`를 실행하면, Django가 기본값을 정하라고 물을 수 있다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 112351.jpg>)

왜 이런 질문이 나올까? 이미 DB 안에는 기존 데이터 행이 들어 있는데, 새 필드를 추가하면 그 기존 행의 `created_at` 값은 무엇으로 채워야 할지 결정해야 하기 때문이다. 즉, **새 필드는 코드 한 줄로 끝나지만, 기존 데이터에는 실제 값이 필요하다**는 점에서 문제가 생긴다.

강의에서는 이 상황을 다음처럼 이해하면 쉽다.

- 새 테이블 생성: 처음부터 구조를 만들면 되므로 비교적 단순하다.
- 기존 테이블 수정: 이미 존재하는 데이터와 새 구조를 연결해야 하므로 기본값 판단이 필요하다.

그 결과 새로운 migration 파일이 추가로 만들어진다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 112737.jpg>)

이 흐름을 보면 migration 파일이 단순 산출물이 아니라, **모델 구조가 시간에 따라 어떻게 변했는지를 기록하는 이력**이라는 점도 함께 보인다. 그래서 강의에서 Git commit에 비유한 설명이 잘 어울린다.

⚠️ 주의: 이미 생성된 migration 파일을 직접 수정하거나 삭제하는 것은 초반에는 특히 피하는 것이 좋다. 이력 관리가 꼬이면 복구가 더 어려워질 수 있다.

📌 핵심: 기존 테이블에 새 필드를 추가할 때는, 이미 존재하는 데이터 행을 어떤 값으로 채울지 결정해야 하므로 기본값 관련 질문이 나타난다.

### 3.8 Admin site에 모델을 등록하면 무엇이 달라질까

Django의 큰 장점 중 하나는 관리자 페이지를 기본 제공한다는 점이다. 다만 모델을 만든 것만으로는 관리자 페이지에 자동으로 보이지 않는다. **등록 과정이 한 번 더 필요하다.**

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 113822.jpg>)

```python
# articles/admin.py
from django.contrib import admin
from .models import Article

# 관리자 페이지에서 Article 모델을 관리할 수 있도록 등록
admin.site.register(Article)
```

이렇게 등록하면 관리자 페이지에서 `Article` 모델이 보이게 된다.

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 113853.jpg>)

그리고 `createsuperuser`로 관리자 계정을 만든 뒤 `/admin`에 접속하면, 웹 UI에서 데이터를 생성·조회·수정·삭제할 수 있다. 이 지점이 중요한 이유는, 우리가 지금까지 만든 Model이 단순한 코드 선언이 아니라 **실제로 관리 가능한 데이터 구조**라는 것이 눈에 보이기 시작하기 때문이다.

```bash
# 관리자 계정 생성
python manage.py createsuperuser
```

초기 학습 단계에서는 admin site가 특히 유용하다. 화면을 직접 만들지 않아도 모델 구조가 잘 동작하는지 빠르게 점검할 수 있고, 데이터가 DB에 잘 들어갔는지 확인하기도 쉽기 때문이다.

📌 핵심: Model을 admin에 등록하면, 직접 별도 UI를 만들지 않아도 웹에서 데이터를 관리할 수 있다.

### 3.9 데이터베이스 초기화와 SQLite는 함께 이해해야 한다

강의 후반부에서는 DB 초기화와 SQLite의 특징도 함께 다룬다. 이 부분은 실무 감각과도 연결된다.

먼저 데이터베이스 초기화는 보통 다음 두 대상을 정리하는 방식으로 이해한다.

1. migration 파일들 정리
2. `db.sqlite3` 파일 삭제

![alt text](<../assets/images/04_14_Django_Template_URLs_Model_2/화면 캡처 2026-04-18 114304.jpg>)

다만 여기서도 주의할 점이 있다. `migrations` 폴더 자체를 없애는 것이 아니라, 강의에서 강조한 것처럼 **`__init__.py`와 폴더 구조는 유지**한 채 정리해야 한다는 점이다.

그리고 SQLite는 Django의 기본 데이터베이스다. 파일 기반이라서 별도 서버 없이 가볍게 시작할 수 있다는 장점이 있다. 학습용, 소규모 프로젝트, 초기 프로토타이핑에서 특히 편하다. 하지만 바로 그 특성 때문에 `db.sqlite3`는 로컬 환경의 실제 데이터 상태를 담고 있으므로, 보통 Git 같은 버전 관리 대상에서는 제외한다.

쉽게 말하면,

- 코드(`models.py`, `views.py`, `templates`)는 함께 관리하고,
- 데이터 파일(`db.sqlite3`)은 각자의 환경에서 따로 관리하는 편이 자연스럽다.

그래서 `.gitignore`에 `db.sqlite3`를 추가하는 습관이 중요하다.

⚠️ 주의: SQLite 파일은 로컬 데이터의 현재 상태를 담고 있으므로, 코드처럼 협업용 이력 관리 대상이라고 생각하면 곤란하다.

📌 핵심: SQLite는 학습과 초기 개발에 매우 편리하지만, `db.sqlite3`는 보통 버전 관리에서 제외해야 한다.

## 4. 적용 관점에서 다시 보기

이제 개념을 다 훑었으니, 실제 문제풀이나 구현 상황에서 어떤 신호를 보고 무엇을 떠올려야 하는지 정리해 보자.

### 4.1 언제 Model을 떠올려야 할까

아래와 같은 요구가 보이면 거의 항상 Model부터 생각해야 한다.

- 게시글, 댓글, 회원 정보처럼 **저장해야 할 데이터 구조**가 필요할 때
- 화면에서 입력받은 값을 **DB에 남겨야 할 때**
- 목록 조회, 상세 조회, 수정, 삭제처럼 **CRUD 흐름**이 필요할 때

즉, “어떤 화면을 만들까?”보다 먼저 “어떤 데이터를 저장할까?”가 떠오르면 Model의 차례다.

### 4.2 구현 순서는 어떻게 잡으면 좋을까

이번 강의 기준으로 가장 안전한 순서는 아래와 같다.

1. `models.py`에서 모델 설계
2. `makemigrations` 실행
3. `migrate` 실행
4. 필요하면 `admin.py` 등록
5. 이후 view, template, form, CRUD 로직 확장

초보 단계에서 자주 하는 실수는 2번과 3번을 빼먹고 바로 화면 작업으로 넘어가는 것이다. 그렇게 되면 모델 코드와 DB 상태가 어긋나고, 원인을 찾기 더 어려워진다.

### 4.3 문제를 보면 어떤 신호를 포착해야 할까

- “제목은 짧고 본문은 길다” → `CharField` + `TextField`
- “생성일, 수정일이 필요하다” → `DateTimeField` + `auto_now_add`, `auto_now`
- “관리자 페이지에서 바로 다루고 싶다” → `admin.site.register()`
- “모델을 바꿨는데 반영이 안 된다” → migration 단계 점검
- “기존 테이블에 새 필드 추가” → 기본값 처리 필요 가능성 점검

이런 신호를 보고 적절한 필드와 명령어를 연결할 수 있어야 한다.

### 4.4 실전에서 자주 틀리는 패턴

- 모델만 수정하고 `migrate`를 안 해서 DB가 그대로인 경우
- `null`과 `blank`를 같은 의미로 생각하는 경우
- 기존 데이터가 있는 테이블에 필드를 추가하면서 기본값 문제를 놓치는 경우
- admin 등록을 하지 않고 “왜 관리자 페이지에 안 보이지?” 하고 막히는 경우
- `db.sqlite3`를 그대로 Git에 올리는 경우

🧠 기억할 것: **Django Model 학습의 핵심은 문법 암기가 아니라, 데이터 설계 → migration → 관리 흐름을 한 번에 보는 습관**이다.

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의에서 가장 중요한 배움은, Django에서 데이터를 다루는 과정이 생각보다 체계적으로 분리되어 있다는 점이다. Model은 구조를 정의하고, migration은 그 구조 변경 이력을 관리하며, admin은 그 결과를 실제 운영 가능한 형태로 확인하게 해 준다.

이 흐름을 이해하고 나면 이후의 CRUD 구현도 훨씬 선명해진다. 예를 들어 게시글 작성 기능을 만들 때도 단순히 view 로직을 짜는 것이 아니라,

- 먼저 어떤 모델이 필요한지,
- 어떤 필드가 필요한지,
- 생성/수정 시각을 자동으로 남길지,
- 관리자에서 먼저 테스트할지

같은 설계 관점으로 접근할 수 있게 된다.

다음 학습으로 자연스럽게 이어지는 주제도 분명하다.

- QuerySet과 ORM 조회 방식
- ModelForm을 이용한 입력 처리
- 1:N, M:N 관계 모델링
- 사용자 인증과 모델 연결
- 파일 업로드 / 이미지 필드 처리

즉, Model은 한 강의로 끝나는 주제가 아니라 Django 전체를 떠받치는 뼈대라고 볼 수 있다.

## 6. 요약 정리

📌 핵심

- Model은 데이터베이스 테이블 구조를 Python 클래스로 정의한 것이다.
- 클래스 변수는 컬럼이 되고, Field는 데이터 유형과 제약 조건을 함께 정의한다.
- `makemigrations`는 설계도를 만들고, `migrate`는 그것을 DB에 반영한다.
- 기존 테이블에 필드를 추가하면 기본값 처리 문제를 함께 고려해야 한다.
- `admin.site.register()`를 하면 관리자 페이지에서 모델 데이터를 바로 관리할 수 있다.
- SQLite는 파일 기반 DB라서 학습용으로 편리하지만, `db.sqlite3`는 버전 관리에서 제외하는 것이 일반적이다.

🧠 기억할 것

- **모델을 바꿨다면 migration까지 가야 반영이 끝난다.**
- **Field type은 데이터 종류, Field option은 제약과 동작이다.**
- **Admin site는 모델 구조를 빠르게 확인하는 좋은 실험장이다.**

## 7. 미니 퀴즈 또는 체크리스트

1. Django Model class를 “파이썬 클래스”가 아니라 “테이블 설계도”로 봐야 하는 이유는 무엇인가?
2. `CharField`와 `TextField`는 어떤 기준으로 나누어 선택하면 좋을까?
3. 모델을 수정한 뒤 `makemigrations`와 `migrate`를 각각 왜 따로 실행해야 할까?
4. 이미 데이터가 들어 있는 테이블에 `created_at` 필드를 추가할 때, Django가 기본값을 묻는 이유는 무엇인가?
5. `admin.site.register(Article)`를 했을 때 얻는 실질적인 장점은 무엇인가?
6. `db.sqlite3`를 Git에 올리지 않는 것이 왜 자연스러운 선택인지 설명할 수 있는가?

---

### 한 문장으로 마무리

Django Model은 단순한 클래스 문법이 아니라, **데이터를 어떤 구조로 저장하고 어떻게 안전하게 반영하며 어떻게 관리할지까지 연결해 주는 프로젝트의 데이터 설계 축**이다.
