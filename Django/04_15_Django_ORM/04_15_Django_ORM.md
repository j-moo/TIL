# Django ORM 첫걸음: Python 객체로 데이터베이스 다루기

- 🎯 글의 목표: Django ORM이 무엇인지 이해하고, `Article` 모델을 기준으로 데이터를 생성·조회·수정·삭제하는 흐름을 Python 코드만으로 익힌다.
- 🧩 핵심 키워드: ORM, QuerySet API, Query, QuerySet, Instance, CRUD, `save()`, `create()`, `all()`, `filter()`, `get()`, Field Lookups, View-Template 연결
- ⭐ 중요도: 상
- 📝 한눈에 보는 내용: 이 강의는 “Django가 어떻게 Python 코드로 데이터베이스를 다루게 해 주는가”를 처음부터 끝까지 연결해서 보여준다. 특히 ORM의 번역자 역할, QuerySet API의 기본 문법, Shell에서의 CRUD 실습, 그리고 View에서 QuerySet을 가져와 Template에 넘기는 흐름까지 한 번에 다룬다.
- 🔗 관련 문제 / 주제(있다면): Django Model, View, Template, URL 연결, DB 실습, 조건 조회

---

## 1. 들어가며

Django를 처음 배우면 가장 신기한 지점 중 하나가, **SQL을 직접 쓰지 않아도 데이터베이스와 대화할 수 있다**는 점이다.  
게시글을 저장하고, 불러오고, 수정하고, 삭제하는 작업이 전부 Python 코드처럼 보이기 때문이다.

하지만 이 과정은 단순히 “편해서” 그렇게 보이는 것이 아니다.  
중간에는 **ORM**이라는 번역 계층이 있고, 개발자는 그 위에서 **QuerySet API**라는 인터페이스를 사용한다.  
즉, 우리가 작성한 Python 코드가 곧바로 DB에 들어가는 것이 아니라, **ORM이 Python 객체와 데이터베이스 레코드 사이를 연결해 주는 구조**다.

이번 강의에서 중요한 흐름은 아래와 같다.

1. ORM이 왜 필요한지 이해한다.
2. `Article.objects.all()` 같은 QuerySet API 구문을 해석한다.
3. Shell에서 직접 데이터를 만들고 저장하면서 객체가 레코드가 되는 과정을 확인한다.
4. `all()`, `filter()`, `get()`으로 데이터를 조회하는 방식의 차이를 이해한다.
5. 수정과 삭제를 거쳐 CRUD 흐름을 완성한다.
6. 마지막으로 View에서 QuerySet을 가져와 Template에 전달하는 방식까지 연결한다.

이 흐름을 한 번 잡아 두면, 이후 Django의 게시판, 회원 기능, 댓글 기능 같은 많은 기능이 훨씬 덜 낯설게 느껴진다.

## 2. 핵심 개념 정리

이 강의의 큰 줄기는 사실 아주 단순하다.  
**Python 객체로 데이터베이스를 다루는 법**을 배우는 것이다.

그 중심에는 세 가지가 있다.

### 2-1. ORM은 번역자다

Django는 Python을 사용하고, 데이터베이스는 SQL을 사용한다.  
둘은 서로 쓰는 언어가 다르기 때문에, 중간에서 번역해 줄 장치가 필요하다.  
그 역할을 ORM이 맡는다.

### 2-2. 개발자는 QuerySet API를 사용한다

개발자가 직접 SQL을 작성하는 대신, Django가 제공하는 `.all()`, `.filter()`, `.get()`, `.create()` 같은 메서드를 사용한다.  
이 메서드들이 바로 QuerySet API이고, ORM은 이것을 SQL로 바꿔서 DB에 전달한다.

### 2-3. 실습의 핵심은 “객체 → 레코드” 전환을 눈으로 확인하는 것이다

처음에는 `Article()`처럼 단순한 Python 객체를 만든다.  
그다음 값을 넣고 `save()`를 호출하면, 그제서야 데이터베이스에 실제 행(row)으로 저장된다.  
이 차이를 직접 확인하는 것이 ORM 이해의 핵심이다.

이제부터 본문에서는 이 큰 흐름을 따라가며, 개념과 예시, 코드와 화면 캡처를 같은 자리에서 묶어 보겠다.

## 3. 본문 정리

이 섹션에서는 ORM의 개념 설명에 그치지 않고, 실제 실습 코드와 화면 흐름까지 연결해서 정리한다.  
핵심은 **개념을 읽는 순간 바로 예시와 코드가 이어져 이해가 끊기지 않게 하는 것**이다.

### 3.1 ORM과 QuerySet API: 왜 필요한가

**ORM은 Python 객체와 데이터베이스의 레코드를 연결해 주는 매핑 기술**이다.

Django 입장에서는 Python 객체를 다루는 것이 자연스럽고, 데이터베이스 입장에서는 SQL이 자연스럽다.  
ORM은 이 둘 사이에서 서로의 언어를 번역한다.  
그래서 우리는 “게시글 하나를 만들고 싶다”는 생각을 Python 코드로 표현할 수 있고, ORM은 그것을 INSERT 같은 SQL 작업으로 바꿔 준다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 191733.jpg>)

위 그림에서 중요한 점은, 우리가 직접 SQL을 쓰는 대신 **QuerySet API를 통해 ORM에게 요청을 전달한다**는 점이다.  
응답 역시 SQL 결과 그대로 받는 것이 아니라, Python 객체 형태인 `QuerySet` 또는 `Instance`로 받게 된다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 192328.jpg>)

이 구조를 이해하면 `Article.objects.all()` 같은 코드가 왜 가능한지도 자연스럽게 보인다.

```python
# Model class: 어떤 테이블을 Python 클래스 형태로 표현한 것
Article

# Manager: DB 조회 작업의 시작점
Article.objects

# QuerySet API: 실제 조회 명령
Article.objects.all()
```

여기서 `Article`은 테이블 자체를 Python 쪽에서 대표하는 클래스이고,  
`objects`는 그 테이블에 대해 조회 작업을 시작할 수 있게 해 주는 매니저이며,  
`all()`은 “해당 테이블의 전체 레코드를 가져와 달라”는 요청이다.

💡 포인트:  
중요한 것은 이 문법을 암기하는 것이 아니라, **“모델 클래스 → 매니저 → 조회 메서드”**라는 흐름을 익히는 것이다.  
이 구조를 알아야 이후의 `filter()`, `get()`, `create()`도 같은 방식으로 읽힌다.

📌 핵심: `Article.objects.메서드()` 형태는 Django ORM으로 DB와 대화하는 기본 출발점이다.

### 3.2 Query, QuerySet, Instance를 구분해서 보기

**Query는 데이터베이스에 원하는 데이터를 요청하는 행위**이고,  
**QuerySet은 그 요청 결과를 Django ORM이 Python 객체 목록처럼 감싸서 돌려준 결과물**이다.

쉽게 말하면 이런 흐름이다.

1. 개발자가 Python 코드로 조회 요청을 작성한다.
2. ORM이 이를 SQL로 바꿔 DB에 전달한다.
3. DB가 결과를 반환한다.
4. ORM이 그 결과를 다시 Python 객체 형태로 바꿔 준다.

이때 결과가 여러 개면 보통 `QuerySet`으로 받고,  
하나의 객체만 딱 집어 가져오면 모델 인스턴스 하나로 받게 된다.

예를 들어:

```python
# 여러 개를 가져오면 QuerySet
Article.objects.all()

# 조건에 맞는 여러 개를 가져오면 QuerySet
Article.objects.filter(title='first')

# 조건에 맞는 딱 하나를 가져오면 인스턴스
Article.objects.get(pk=1)
```

여기서 초반에 많이 헷갈리는 부분은,  
겉보기에는 전부 비슷한 조회 코드처럼 보이는데 **반환값의 형태가 다르다**는 점이다.

- `all()`, `filter()` → 여러 개일 수 있으므로 `QuerySet`
- `get()` → 하나만 가져와야 하므로 모델 인스턴스

⚠️ 주의:  
`get()`은 “조건에 맞는 게 하나일 것”이 전제된 메서드다.  
없으면 `DoesNotExist`, 두 개 이상이면 `MultipleObjectsReturned`가 발생한다.  
그래서 보통 `pk`처럼 **고유성이 보장되는 값**과 함께 사용한다.

📌 핵심: 조회 메서드는 비슷해 보여도, **결과가 여러 개인지 하나인지에 따라 반환 형태와 사용 목적이 달라진다.**

### 3.3 Django Shell에서 ORM을 실습하는 이유

ORM은 개념만 보면 추상적으로 느껴질 수 있다.  
그래서 처음 배울 때는 View나 Template보다 먼저 **Django Shell에서 직접 객체를 만들고 저장해 보는 과정**이 중요하다.

Shell에서는 프로젝트의 Django 환경 안에서 코드를 바로 실행할 수 있다.  
즉, 작성한 QuerySet API가 실제 프로젝트 DB에 영향을 주는 상태에서 즉시 결과를 확인할 수 있다.

실습 전에는 다음과 같이 IPython을 설치하고 의존성을 기록할 수 있다.

```bash
$ pip install ipython
$ pip freeze > requirements.txt
```

Django Shell에 들어가는 기본 명령은 다음과 같다.

```bash
$ python manage.py shell
```

좀 더 자세한 정보를 보고 싶다면 `-v 2` 옵션을 줄 수 있다.

```bash
$ python manage.py shell -v 2
```

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 193612.jpg>)

이 화면에서 확인할 수 있는 핵심은,  
Shell이 단순한 Python 콘솔이 아니라 **Django 프로젝트에 등록된 모델들을 이미 불러온 상태의 실행 환경**이라는 점이다.

💡 포인트:  
처음 ORM을 배울 때는 View까지 한꺼번에 보면 흐름이 복잡해질 수 있다.  
Shell은 오직 “객체 생성 → 저장 → 조회” 흐름만 따로 실험할 수 있어서 개념을 익히기에 좋다.

📌 핵심: Django Shell은 ORM을 가장 빠르고 직접적으로 확인할 수 있는 실습 공간이다.

### 3.4 Create: 데이터를 만드는 3가지 방법

이 강의에서 Create는 단순히 “새 글을 하나 저장한다”는 기능 이상이다.  
**Python 객체가 실제 DB 레코드가 되는 순간이 언제인지**를 보여 주기 때문이다.

강의에서는 세 가지 방법을 다룬다.

1. 빈 객체를 만든 뒤 값을 넣고 저장하기
2. 초기값을 넣어 객체를 만든 뒤 저장하기
3. `create()`로 한 번에 생성과 저장하기

#### 3.4.1 빈 객체 생성 후 값 할당, 그리고 `save()`

가장 기본적인 방식은 먼저 빈 인스턴스를 만들고, 그 뒤 필드값을 넣는 것이다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 193759.jpg>)

```python
# 1) 아직 DB에 저장되지 않은 Article 인스턴스를 만든다.
article = Article()

# 2) Python 객체의 속성처럼 필드값을 채운다.
article.title = 'first'
article.content = 'django!'
```

여기서 중요한 점은, **이 시점에는 아직 DB에 저장되지 않았다는 것**이다.  
즉, 메모리 안에만 존재하는 Python 객체일 뿐이다.

위 실습 화면에서도 `article`을 출력하면 `pk`가 `None`인 상태로 보이고,  
`Article.objects.all()`을 해도 아직 빈 QuerySet이 나온다.  
그만큼 객체를 만든 것과 저장한 것은 다른 단계다.

이제 `save()`를 호출하면 상황이 달라진다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 193824.jpg>)

```python
# 3) save()를 호출하는 순간 DB에 실제 레코드가 저장된다.
article.save()

# 4) 이제 pk가 생기고, 전체 조회에도 보인다.
article.id
article.pk
Article.objects.all()
```

`id`나 `pk`가 생겼다는 것은, 이제 이 객체가 데이터베이스의 특정 행과 연결되었다는 뜻이다.

저장된 뒤에는 인스턴스를 통해 값도 확인할 수 있다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 193846.jpg>)

```python
# 저장된 객체의 필드값과 생성 시각 확인
article.title
article.content
article.created_at
```

💡 포인트:  
`save()`는 단순한 마무리 버튼이 아니라, **Python 객체를 DB 레코드로 확정하는 시점**이다.  
그래서 저장 전에 추가 처리나 검증이 필요할 때 이 방식을 많이 사용한다.

⚠️ 주의:  
초반에는 객체를 만들고 필드값도 다 넣었으니 이미 저장되었다고 착각하기 쉽다.  
하지만 `save()` 전까지는 DB에 반영되지 않는다.

📌 핵심: 객체 생성과 DB 저장은 별개의 단계이며, 그 경계를 만드는 메서드가 `save()`다.

#### 3.4.2 초기값과 함께 인스턴스를 만든 뒤 저장하기

두 번째 방법은 객체를 만들 때부터 필드값을 같이 넣는 방식이다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 194126.jpg>)

```python
# 생성자에 초기값을 넣어 인스턴스를 만든다.
article = Article(title='second', content='django!')

# 아직 저장되지 않았기 때문에 pk는 None 상태다.
article

# save()를 호출해야 DB에 반영된다.
article.save()

# 저장 후에는 pk가 생기고, 전체 조회 결과에도 포함된다.
article.pk
article.title
article.content
Article.objects.all()
```

첫 번째 방법과의 차이는 문법상의 편의성에 가깝다.  
둘 다 결국은 **인스턴스를 만든 뒤 `save()`를 호출해야 저장된다**는 점은 같다.

이 방식은 값이 이미 준비되어 있을 때 조금 더 간결하다.  
반대로 객체를 먼저 만들고 뒤에서 관계 설정이나 추가 검증이 필요하다면 첫 번째 방식이 더 자연스러울 수 있다.

📌 핵심: 초기값을 생성자에 넣어도, `save()`를 호출하기 전까지는 아직 DB 레코드가 아니다.

#### 3.4.3 `create()`로 한 번에 생성과 저장하기

세 번째 방법은 QuerySet API의 `create()`를 사용하는 것이다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 194337.jpg>)

```python
# 객체 생성과 DB 저장을 한 번에 처리한다.
article = Article.objects.create(title='third', content='django!')
```

이 방식은 **생성과 저장이 한 번에 일어난다**는 점이 핵심이다.  
그래서 별도로 `save()`를 호출하지 않아도, 이미 저장된 인스턴스가 반환된다.

이전에 본 두 방식과 비교하면 차이가 분명하다.

- `Article(...)` → 인스턴스 생성만 함
- `save()` → 그 인스턴스를 DB에 저장
- `Article.objects.create(...)` → 생성과 저장을 동시에 수행

⚠️ 주의:  
`create()`는 간편하지만, 저장 전에 중간 처리를 넣기 어렵다.  
그래서 저장 전에 값을 더 손보거나 검증할 일이 있다면 `save()`를 직접 호출하는 방식이 더 적합할 수 있다.

📌 핵심: `create()`는 “한 번에 끝내는 단축 메서드”이고, `save()` 방식은 “중간 제어가 가능한 방식”이다.

### 3.5 Read: `all()`, `filter()`, `get()`을 어떻게 구분할까

데이터 조회는 단순히 “가져온다”로 끝나지 않는다.  
**몇 개를 가져오려는지, 조건이 어떤지, 결과가 반드시 하나여야 하는지**에 따라 메서드를 다르게 선택해야 한다.

#### 3.5.1 `all()`: 전체 조회

```python
# 전체 게시글을 가져온다.
articles = Article.objects.all()
```

`all()`은 가장 단순한 조회다.  
연결된 테이블의 전체 데이터를 QuerySet 형태로 가져온다.

전체 목록 페이지를 만들 때 가장 자주 쓰이는 시작점이기도 하다.

#### 3.5.2 `filter()`: 조건에 맞는 여러 개 조회

```python
# title이 second로 시작하는 게시글들을 조회
articles = Article.objects.filter(title__startswith='second')
```

`filter()`는 조건에 맞는 데이터를 QuerySet으로 반환한다.  
조건에 맞는 것이 0개일 수도 있고, 1개일 수도 있고, 여러 개일 수도 있다.  
그래서 “조건 기반 목록 조회”에 적합하다.

#### 3.5.3 `get()`: 조건에 맞는 딱 하나 조회

```python
# pk가 1인 게시글 하나를 조회
article = Article.objects.get(pk=1)
```

`get()`은 결과가 반드시 하나여야 할 때 사용한다.  
보통 상세 페이지처럼 특정 게시글 하나를 가져올 때 쓰기 좋다.

하지만 이 메서드는 전제가 분명하다.

- 없으면 예외 발생
- 둘 이상이면 예외 발생

그래서 고유성이 보장되는 `pk`, `id`, `unique=True` 필드와 함께 사용하는 것이 안전하다.

📌 핵심:  
`all()`은 전체 목록, `filter()`는 조건 목록, `get()`은 단일 객체 조회에 맞는 메서드다.

### 3.6 Update: 조회한 인스턴스를 바꾸고 다시 저장하기

수정은 생각보다 단순하다.  
**먼저 수정할 객체를 가져오고, 인스턴스의 속성을 바꾸고, 다시 `save()`를 호출하면 된다.**

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 203801.jpg>)

```python
# 1) 수정할 대상을 하나 가져온다.
article = Article.objects.get(pk=1)

# 2) Python 객체의 속성을 바꾸듯 필드값을 수정한다.
article.title = 'byebye'

# 3) 다시 save()를 호출해 변경사항을 DB에 반영한다.
article.save()
```

여기서도 흐름은 Create 때와 비슷하다.  
필드값을 바꾼 것만으로는 Python 객체 상태가 바뀐 것이고,  
DB에 실제 반영되려면 `save()`가 다시 필요하다.

쉽게 말하면, **ORM에서는 수정도 “객체 변경 → 저장”의 흐름으로 이해하면 된다.**

⚠️ 주의:  
수정할 객체를 가져오지 않고 바로 값을 바꾸려 하면 안 된다.  
먼저 어떤 레코드를 수정할지 특정할 수 있어야 하고, 그다음에 인스턴스 값을 바꿔 저장해야 한다.

📌 핵심: 수정은 “조회 → 값 변경 → save” 순서로 기억하면 된다.

### 3.7 Delete: 조회한 인스턴스를 삭제하기

삭제 역시 먼저 대상을 조회한 뒤, 그 인스턴스에 대해 `delete()`를 호출하는 방식이다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 203850.jpg>)

```python
# 1) 삭제할 객체를 하나 가져온다.
article = Article.objects.get(pk=1)

# 2) delete()를 호출하면 삭제되고, 삭제 결과 정보가 반환된다.
article.delete()

# 3) 삭제된 객체는 더 이상 같은 pk로 조회할 수 없다.
Article.objects.get(pk=1)
```

실습 화면에서도 `delete()` 호출 뒤 `(1, {'articles.Article': 1})` 같은 반환값이 보인다.  
이는 “총 몇 개가 삭제되었는지”와 “어떤 모델에서 몇 개가 삭제되었는지”를 알려 주는 정보다.

그 뒤 다시 같은 `pk`로 조회하면 `DoesNotExist` 예외가 발생한다.  
즉, 삭제가 실제로 DB에 반영되었다는 뜻이다.

⚠️ 주의:  
삭제 후에는 당연히 같은 객체를 다시 조회할 수 없다.  
그래서 실무에서는 삭제 전에 정말 맞는 대상인지 확인하는 흐름이 중요하다.

📌 핵심: 삭제도 결국 “조회한 인스턴스에 대해 메서드를 호출하는 방식”으로 동작한다.

### 3.8 ORM with View: QuerySet을 화면까지 연결하기

Shell에서 ORM을 이해했다면, 이제 그 데이터를 실제 웹 페이지에 보여 주는 단계로 넘어간다.  
여기서 중요한 것은 **Model → View → Template** 흐름이다.

먼저 전체 구조를 보면 다음과 같다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-19 204044.jpg>)

이 그림에서 핵심은 View가 중간에 있다는 점이다.  
브라우저 요청이 들어오면 View가 ORM을 사용해 데이터를 가져오고, 그 결과를 Template에 전달해 화면을 만든다.

#### 3.8.1 요청이 어디로 들어오는가: URL 연결

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-20 113404.jpg>)

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-20 113426.jpg>)

위 화면을 코드로 정리하면 다음과 같은 흐름이다.

```python
# crud/urls.py
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('articles/', include('articles.urls')),
]
```

```python
# articles/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
]
```

여기서 `articles/`까지는 프로젝트 URL이 담당하고,  
그 뒤의 나머지 경로는 `articles.urls`가 맡는다.

그래서 앱 URL에서 `path('', views.index, name='index')`라고 쓰면,  
이는 결국 **`articles/`로 들어온 요청을 `index` 뷰로 연결한다**는 뜻이 된다.

💡 포인트:  
앱 URL의 빈 문자열 `''`은 “아무 경로도 더 붙지 않은 상태”를 의미한다.  
즉, `articles/` 자체가 이 패턴에 해당한다.

#### 3.8.2 View에서 QuerySet을 가져오고 Template로 넘기기

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-20 113739.jpg>)

이 흐름을 코드로 다시 정리하면 다음과 같다.

```python
# articles/views.py
from django.shortcuts import render
from .models import Article

def index(request):
    # DB에서 전체 게시글을 QuerySet으로 가져온다.
    articles = Article.objects.all()

    # 템플릿에 넘길 데이터를 context 딕셔너리로 묶는다.
    context = {
        'articles': articles,
    }

    # 템플릿을 렌더링하면서 context를 함께 전달한다.
    return render(request, 'articles/index.html', context)
```

```html
<!-- templates/articles/index.html -->
<h1>Articles</h1>
<hr>
{% for article in articles %}
  <div>
    <p>글 번호: {{ article.pk }}</p>
    <p>글 제목: {{ article.title }}</p>
    <p>글 내용: {{ article.content }}</p>
  </div>
  <hr>
{% endfor %}
```

이 코드에서 중요한 점은 View가 단순히 템플릿만 호출하는 것이 아니라,  
**ORM으로 데이터를 조회한 뒤 그 데이터를 템플릿이 쓸 수 있는 이름으로 전달한다**는 점이다.

- `Article.objects.all()` → DB에서 게시글 목록 조회
- `context = {'articles': articles}` → 템플릿에 넘길 이름 지정
- `{% for article in articles %}` → 템플릿에서 반복 출력

이 흐름이 익숙해지면 이후에는 상세 페이지, 작성 페이지, 수정 페이지도 비슷한 구조로 이해할 수 있다.

⚠️ 주의:  
View에서 데이터를 조회만 하고 `context`로 넘기지 않으면 템플릿에서는 사용할 수 없다.  
반대로 템플릿에서 `articles`라는 이름을 쓰려면, View에서도 같은 키 이름으로 전달해야 한다.

📌 핵심: ORM은 Shell에서 끝나는 것이 아니라, **View가 QuerySet을 가져와 Template에 전달하는 순간 실제 화면 기능으로 이어진다.**

### 3.9 Field Lookups: 조건 조회를 더 세밀하게 만들기

단순한 동치 비교만으로는 실제 조회 요구를 다 처리하기 어렵다.  
예를 들어 “제목이 특정 단어로 시작하는 글”, “내용에 어떤 문자열이 포함된 글”, “특정 날짜 이후의 글” 같은 조건이 필요해진다.

이때 쓰는 것이 **Field Lookups**다.

Field Lookups는 **필드명 뒤에 이중 밑줄 `__`을 붙이고, 조회 조건을 이어 쓰는 방식**이다.

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-20 114042.jpg>)

강의의 대표 예시는 다음과 같다.

```python
# title 필드가 'second'로 시작하는 게시글을 조회
Article.objects.filter(title__startswith='second')
```

이 구문은 아래처럼 읽으면 이해가 쉽다.

- `title` → 어떤 필드를 볼 것인가
- `__startswith` → 어떤 조건으로 비교할 것인가
- `'second'` → 무엇과 비교할 것인가

![alt text](<../assets/images/04_15_Django_ORM/화면 캡처 2026-04-23 191103.jpg>)

위 실습 화면에 나온 예시도 같이 보면 흐름이 더 분명해진다.

```python
# 내용에 'dja'가 포함된 게시글 조회
Article.objects.filter(content__contains='dja')

# 제목이 'he'로 시작하는 게시글 조회
Article.objects.filter(title__startswith='he')
```

강의에서 함께 정리한 대표 조건은 아래와 같다.

| 조회 조건 | 의미 |
|---|---|
| `exact` | 정확히 일치 |
| `iexact` | 대소문자 무시하고 정확히 일치 |
| `contains` | 특정 문자열 포함 |
| `icontains` | 대소문자 무시하고 포함 |
| `gt` | 초과 |
| `gte` | 이상 |
| `lt` | 미만 |
| `lte` | 이하 |
| `startswith` | 특정 문자열로 시작 |

💡 포인트:  
Field Lookups는 문법을 많이 외우는 것보다,  
**“필드명 + `__` + 조회조건”이라는 조합 규칙을 먼저 익히는 것**이 더 중요하다.  
규칙이 익숙해지면 새로운 조건도 훨씬 쉽게 받아들일 수 있다.

⚠️ 주의:  
초반에는 `title_startswith='he'`처럼 밑줄 하나로 쓰는 실수를 자주 한다.  
Django ORM의 조회 조건 연결은 반드시 **이중 밑줄 `__`** 이다.

📌 핵심: Field Lookups를 익히면, ORM 조회가 단순 전체 조회에서 실제 검색 기능 수준으로 확장된다.

## 4. 적용 관점에서 다시 보기

이제 본문에서 본 내용을 바탕으로, 실제로 어떤 상황에서 어떤 ORM 메서드를 떠올려야 하는지 정리해 보자.

### 4-1. “몇 개를 가져오려는가”부터 먼저 판단하기

ORM 조회에서 가장 먼저 떠올려야 할 질문은 이것이다.

**“나는 지금 하나를 가져오려는가, 여러 개를 가져오려는가?”**

- 전체 목록이 필요하다 → `all()`
- 조건에 맞는 여러 개가 필요하다 → `filter()`
- 특정 하나가 필요하다 → `get()`

이 기준이 먼저 서야, 반환값이 `QuerySet`인지 인스턴스인지도 자연스럽게 따라온다.

### 4-2. 저장이 필요한 시점을 놓치지 않기

초반 실습에서 가장 중요한 감각은  
**객체를 만든 것과 저장한 것은 다르다**는 점이다.

- `Article()` → 객체만 생성
- `article.title = ...` → 객체 속성 변경
- `article.save()` → DB 반영

이 흐름을 놓치면, 왜 조회 결과에 안 보이는지 이해하기 어려워진다.

### 4-3. Create 방식은 상황에 따라 고른다

- 저장 전에 값을 더 손봐야 한다 → 인스턴스 생성 후 `save()`
- 값이 이미 준비되어 있고 빠르게 저장하면 된다 → `create()`

즉, 짧게 끝내고 싶다고 항상 `create()`를 쓰는 것이 아니라,  
**중간 제어가 필요한가**를 같이 봐야 한다.

### 4-4. View에서는 QuerySet을 가져오는 것만으로 끝나지 않는다

실제 페이지를 만들 때는 다음 순서를 기억하면 좋다.

1. URL이 어떤 View를 호출하는지 정한다.
2. View에서 ORM으로 데이터를 가져온다.
3. `context`에 담아 템플릿으로 넘긴다.
4. 템플릿에서 반복문이나 변수 출력으로 보여 준다.

즉, ORM은 데이터 접근의 시작이고,  
화면 출력까지 완성하려면 **URL → View → Template** 흐름까지 함께 잡아야 한다.

### 4-5. 검색 기능의 시작점은 Field Lookups다

게시판에서 “제목 검색”, “내용 검색”, “최근 글만 보기” 같은 기능은  
결국 `filter()`와 Field Lookups 조합으로 시작된다.

그래서 Field Lookups는 단순 문법이 아니라,  
**실제 사용자가 요구하는 검색 조건을 ORM으로 표현하는 첫 단계**라고 볼 수 있다.

🧠 기억할 것:  
ORM은 단순 DB 문법이 아니라, **Django 전체 흐름 안에서 데이터가 움직이는 방식**이다.

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의는 Django ORM을 처음 배우는 단계에서 꼭 필요한 감각을 잘 보여 준다.  
특히 중요한 것은 ORM을 “SQL을 안 써도 되는 편한 기능” 정도로만 보면 금방 한계에 부딪힌다는 점이다.

실제로는 아래와 같은 이해가 함께 필요하다.

- ORM은 Python과 DB 사이의 번역 계층이다.
- QuerySet API는 그 번역 계층을 개발자가 다루는 인터페이스다.
- 객체 생성, 저장, 조회, 수정, 삭제는 모두 **모델 인스턴스와 QuerySet 중심으로 생각해야 한다.**
- View에서 QuerySet을 템플릿으로 넘기는 순간, ORM은 실제 웹 기능이 된다.

다음 학습으로 자연스럽게 이어질 수 있는 포인트도 분명하다.

1. **상세 조회**: `get(pk=...)`를 이용한 detail 페이지
2. **조건 검색**: `filter()`와 Field Lookups를 조합한 검색 기능
3. **작성 폼 연동**: 사용자가 입력한 데이터를 ORM으로 저장하기
4. **수정/삭제 페이지**: 조회한 인스턴스를 바꿔 `save()`, `delete()`로 반영하기
5. **관계형 모델 확장**: 댓글, 작성자, 카테고리처럼 모델 간 관계 연결하기

즉, 이번 강의는 ORM의 끝이 아니라,  
이후 Django 애플리케이션 개발 전체를 위한 출발점에 가깝다.

## 6. 요약 정리

📌 핵심

- ORM은 Python 객체와 데이터베이스 레코드를 연결하는 번역자 역할을 한다.
- 개발자는 QuerySet API를 사용해 SQL 없이도 데이터를 다룰 수 있다.
- `Article.objects.메서드()` 형태가 ORM 사용의 기본 문법이다.
- `all()`과 `filter()`는 `QuerySet`을, `get()`은 단일 인스턴스를 반환한다.
- 객체를 만드는 것과 저장하는 것은 다르며, `save()`가 그 경계를 만든다.
- `create()`는 생성과 저장을 한 번에 처리하는 단축 메서드다.
- 수정은 `조회 → 값 변경 → save`, 삭제는 `조회 → delete` 흐름으로 이해하면 된다.
- View에서 QuerySet을 가져와 Template에 넘기면 실제 화면 출력으로 이어진다.
- Field Lookups는 조건 조회를 더 정교하게 만드는 문법이다.

🧠 기억할 것

- **ORM의 핵심은 “객체처럼 다루되, 결국 DB와 연결되어 있다”는 감각이다.**
- **반환값이 QuerySet인지 인스턴스인지 구분할 줄 알아야 이후 코드가 덜 헷갈린다.**
- **조회 문법은 곧 검색 기능, 상세 페이지, 목록 페이지로 확장된다.**

## 7. 미니 퀴즈 또는 체크리스트

1. `Article()`로 객체를 만든 뒤 `save()`를 호출하지 않으면, 왜 `Article.objects.all()`에서 보이지 않을까?
2. `all()`, `filter()`, `get()`은 각각 어떤 상황에서 써야 할까?
3. `get()`을 `pk` 같은 고유값과 함께 사용하는 이유는 무엇일까?
4. `Article.objects.create(...)`와 `Article(...); article.save()`의 차이는 무엇일까?
5. View에서 `articles = Article.objects.all()`로 가져온 데이터를 템플릿에서 쓰려면, 왜 `context`로 넘겨야 할까?
6. `title__startswith='he'`처럼 Field Lookups를 쓰는 이유를, 단순 동치 비교와 비교해서 설명할 수 있는가?

---
