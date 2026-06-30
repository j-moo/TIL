# JWT 기반 인증과 Refresh Token 흐름

- 🎯 글의 목표: DRF와 Vue 프로젝트에서 기존 TokenAuthentication 방식과 JWT 방식의 차이를 이해하고, `djangorestframework-simplejwt`와 `dj-rest-auth`를 활용해 로그인, Access Token 저장, 인증 요청, Refresh Token을 통한 재발급 흐름까지 연결해서 정리한다.
- 🧩 핵심 키워드: JWT, JSON Web Token, Header, Payload, Signature, Access Token, Refresh Token, Stateless, TokenAuthentication, JWTAuthentication, Simple JWT, dj-rest-auth, Bearer Token, Authorization Header, 401 Unauthorized, Token Refresh
- ⭐ 중요도: ★★★★★  
  Vue와 DRF를 함께 사용하는 프로젝트에서 인증 흐름은 거의 모든 기능의 기반이 된다. 특히 게시글 생성, 좋아요, 댓글, 마이페이지처럼 로그인한 사용자만 접근할 수 있는 기능을 만들려면 토큰 발급과 요청 헤더 처리, 만료 시 재발급 흐름을 반드시 이해해야 한다.
- 📝 한눈에 보는 내용:  
  이번 강의는 기존 DRF Token 방식에서 JWT 방식으로 인증 구조를 바꾸는 흐름을 다룬다. 먼저 JWT가 어떤 구조를 가진 토큰인지 이해하고, Token 방식과 JWT 방식의 차이를 비교한다. 이후 Django 설정에서 `JWTAuthentication`과 `REST_AUTH` 설정을 추가하고, Vue의 Pinia store에서 로그인 응답으로 받은 Access Token을 저장한다. 마지막에는 Access Token이 만료되었을 때 Refresh Token으로 새 Access Token을 발급받고, 실패한 요청을 다시 시도하는 흐름까지 정리한다.
- 🔗 관련 문제 / 주제: Vue + DRF 인증 연동, 로그인 상태 유지, 게시글 작성 권한, Authorization Header, 401 에러 처리, 토큰 재발급, Pinia 상태 관리, Local Storage 인증 정보 저장

---

## 1. 들어가며

웹 서비스에서 로그인은 단순히 아이디와 비밀번호를 입력하는 화면으로 끝나지 않는다. 사용자가 한 번 로그인한 뒤에도 게시글을 작성하거나, 마이페이지에 접근하거나, 댓글을 남길 때마다 서버는 “이 요청을 보낸 사람이 누구인지”를 확인해야 한다. 이때 매 요청마다 아이디와 비밀번호를 다시 보내는 것은 안전하지도 않고 불편하다.

그래서 서버는 로그인에 성공한 사용자에게 **토큰**을 발급한다. 클라이언트는 이후 요청을 보낼 때 이 토큰을 함께 보내고, 서버는 토큰을 확인해 사용자를 식별한다. 이전 강의에서는 DRF의 기본 TokenAuthentication 방식을 사용했다면, 이번 강의에서는 이 구조를 **JWT(JSON Web Token)** 방식으로 바꿔본다.

JWT는 단순한 랜덤 문자열이 아니라, 토큰 자체 안에 사용자 식별에 필요한 정보와 위조 검증을 위한 서명이 함께 들어 있는 방식이다. 그래서 서버가 매번 DB에서 토큰을 조회하지 않아도 토큰을 해석해 인증할 수 있다. 이 특징 때문에 JWT는 서버를 여러 대로 확장해야 하는 서비스나 모바일 앱과 연동되는 서비스에서 자주 사용된다.

다만 JWT는 편리한 만큼 주의할 점도 있다. 토큰 안의 Payload는 암호화된 비밀 공간이 아니라 누구나 열어볼 수 있는 정보 영역에 가깝다. 또한 Access Token이 유출되면 만료되기 전까지 사용될 수 있으므로, 유효시간을 짧게 잡고 Refresh Token으로 새 Access Token을 재발급하는 구조를 함께 사용한다.

이번 노트에서는 JWT의 개념을 먼저 잡고, DRF와 Vue 프로젝트에서 어떤 파일을 수정해야 하는지, 그리고 Access Token 만료 상황을 어떻게 처리하는지까지 하나의 인증 흐름으로 정리한다.

---

## 2. 핵심 개념 정리

이번 강의의 중심 질문은 다음과 같다.

> 기존 TokenAuthentication을 JWT 방식으로 바꾸면, 로그인과 인증 요청 흐름은 어떻게 달라질까?

이 질문에 답하려면 먼저 JWT가 무엇인지부터 이해해야 한다. JWT는 서버가 사용자에게 발급하는 디지털 출입증처럼 볼 수 있다. 사용자는 로그인에 성공하면 서버로부터 긴 문자열 형태의 토큰을 받고, 이후 요청마다 이 토큰을 함께 보낸다. 서버는 토큰을 보고 사용자가 누구인지 판단한다.

JWT는 세 부분으로 구성된다. Header에는 어떤 알고리즘으로 서명했는지에 대한 정보가 들어가고, Payload에는 사용자 식별 정보나 토큰 만료 시간 같은 데이터가 들어간다. Signature는 서버의 비밀키를 바탕으로 만들어지는 위조 방지 도장 역할을 한다.

이번 실습 흐름은 크게 네 단계로 이어진다.

1. **JWT 구조 이해**  
   Header, Payload, Signature가 각각 어떤 역할을 하는지 확인한다.

2. **DRF 인증 설정 변경**  
   기존 `TokenAuthentication`을 주석 처리하고, `JWTAuthentication`을 기본 인증 방식으로 사용하도록 설정한다.

3. **Vue 로그인 로직 변경**  
   로그인 응답으로 받은 `access` 값을 Pinia store의 token에 저장하고, 인증이 필요한 요청에는 `Authorization: Bearer ...` 형식으로 보낸다.

4. **Refresh Token으로 Access Token 갱신**  
   Access Token이 만료되어 401 에러가 발생하면 Refresh Token으로 새 Access Token을 발급받고, 기존 요청을 다시 실행한다.

이 흐름에서 가장 자주 헷갈리는 부분은 `Token`과 `Bearer`의 차이, Access Token과 Refresh Token의 역할 구분, 그리고 401 에러가 발생했을 때 단순 실패로 끝내지 않고 재발급 로직으로 이어주는 부분이다.

---

## 3. 본문 정리

## 3.1 JWT란 무엇인가

JWT는 **JSON Web Token**의 약자다. 강의에서는 JWT를 “유저가 스스로 누군지 증명하는 디지털 출입증”에 비유했다. 서버가 로그인에 성공한 사용자에게 긴 문자열 형태의 토큰을 발급하고, 사용자는 이후 요청마다 이 토큰을 함께 보내 자신이 누구인지 증명한다.

기존 세션 방식에서는 서버가 로그인 상태를 기억한다. 반면 JWT 방식에서는 사용자가 들고 있는 토큰 안에 필요한 정보가 들어 있고, 서버는 그 토큰을 검증해 인증 여부를 판단한다. 그래서 JWT는 서버가 로그인 상태를 직접 저장하지 않는 **Stateless 인증 방식**에 가깝다.

쉽게 말하면, JWT는 서버가 발급한 출입증이다. 사용자는 매번 “저 로그인했어요”라고 말하는 대신, 서버가 발급해준 출입증을 보여준다. 서버는 그 출입증이 자신이 발급한 것이 맞는지만 확인하면 된다.

---

## 3.2 JWT의 구조

JWT는 하나의 긴 문자열처럼 보이지만 내부적으로는 `.`을 기준으로 세 부분으로 나뉜다.

```text
Header.Payload.Signature
```

각 부분의 역할은 다음과 같다.

| 구성 요소 | 역할 | 주의할 점 |
|---|---|---|
| Header | 어떤 타입의 토큰인지, 어떤 알고리즘으로 서명했는지 담는다. | 보통 토큰의 메타 정보에 해당한다. |
| Payload | 실제 사용자 정보나 만료 시간 같은 내용이 들어간다. | 누구나 열어볼 수 있으므로 민감한 정보를 넣으면 안 된다. |
| Signature | 토큰이 위조되지 않았음을 검증하는 서명이다. | 서버의 비밀키를 기준으로 검증한다. |

![JWT 구조](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 172400.png>)

위 이미지는 JWT를 jwt.io에서 확인했을 때 Encoded 영역과 Decoded 영역이 나뉘어 보이는 모습을 보여준다. 왼쪽의 긴 문자열은 실제 토큰이고, 오른쪽에는 Header, Payload, Signature에 해당하는 정보가 분리되어 표시된다.

여기서 특히 중요한 부분은 Payload다. Payload에는 `user_id`, `exp`, `iat` 같은 정보가 들어갈 수 있다. 그런데 이 정보는 숨겨진 비밀 정보가 아니다. 누구나 토큰 문자열을 복사해서 디코딩하면 Payload를 볼 수 있다. 따라서 비밀번호, 주민번호, 전화번호, 계좌번호 같은 민감한 값은 절대 Payload에 넣으면 안 된다.

⚠️ 주의: JWT의 Payload는 “암호화되어 아무도 못 보는 영역”이 아니다. Base64URL로 인코딩된 값이라 쉽게 열어볼 수 있다. JWT에서 신뢰해야 하는 부분은 Payload가 숨겨져 있다는 점이 아니라, Signature를 통해 토큰이 위조되지 않았는지 검증할 수 있다는 점이다.

📌 핵심: JWT는 `Header.Payload.Signature` 세 부분으로 구성되며, Payload에는 민감한 정보를 넣지 않는다.

---

## 3.3 JWT 동작 흐름

JWT 인증 흐름은 로그인 요청에서 시작한다. 사용자가 아이디와 비밀번호를 서버에 보내면, 서버는 사용자 정보를 검증한 뒤 Access Token과 Refresh Token을 발급한다. 이후 클라이언트는 인증이 필요한 요청을 보낼 때 Access Token을 함께 보낸다.

![JWT 동작 흐름](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 172441.png>)

흐름을 단계별로 정리하면 다음과 같다.

1. 클라이언트가 로그인 정보를 서버에 보낸다.
2. 서버는 아이디와 비밀번호를 확인한다.
3. 인증에 성공하면 서버가 Access Token과 Refresh Token을 발급한다.
4. 클라이언트는 Access Token을 저장한다.
5. 이후 인증이 필요한 요청에 Access Token을 담아 보낸다.
6. 서버는 토큰의 서명을 검증하고, 토큰이 유효하면 요청을 처리한다.

이 구조에서 Access Token은 “짧게 사용하는 출입증”이다. 유출되면 위험하므로 유효시간을 짧게 둔다. 반면 Refresh Token은 Access Token이 만료되었을 때 새 Access Token을 발급받기 위한 “장기 열쇠”에 가깝다.

즉, 실제 요청에는 Access Token을 주로 사용하고, Access Token이 만료되었을 때만 Refresh Token을 사용한다.

---

## 3.4 JWT의 장점과 단점

JWT의 가장 큰 장점은 서버가 로그인 상태를 직접 저장하지 않아도 된다는 점이다. 기존 Token 방식에서는 서버가 토큰 정보를 DB에 저장하고, 요청이 올 때마다 해당 토큰이 DB에 있는지 확인해야 한다. 반면 JWT는 토큰 자체에 필요한 정보와 서명이 들어 있어 서버가 토큰을 해석하고 검증할 수 있다.

JWT의 장점은 다음과 같다.

| 장점 | 설명 |
|---|---|
| 서버 부담 감소 | 서버가 로그인 세션을 따로 저장하지 않아도 된다. |
| 확장성 | 서버를 여러 대로 늘려도 같은 비밀키로 토큰을 검증할 수 있다. |
| 모바일 친화적 | 웹뿐 아니라 앱에서도 Authorization Header로 쉽게 사용할 수 있다. |

하지만 JWT에도 단점이 있다.

| 단점 | 설명 |
|---|---|
| 유출 대응이 어렵다 | 토큰이 유출되면 만료 전까지 사용될 수 있다. |
| Payload 노출 위험 | Payload는 누구나 디코딩할 수 있으므로 개인정보를 넣으면 안 된다. |
| 비밀키 관리 중요 | SECRET_KEY가 노출되면 서명 검증 신뢰성이 무너진다. |

JWT를 사용할 때는 편리함만 보는 것이 아니라, 토큰 유효시간과 Refresh Token 관리, 보관 위치까지 함께 고민해야 한다.

---

## 3.5 Token 방식과 JWT 방식 비교

기존 DRF TokenAuthentication 방식과 JWT 방식은 모두 “토큰을 이용해 인증한다”는 점에서는 비슷하다. 하지만 토큰의 의미가 다르다.

기존 TokenAuthentication 방식에서 토큰은 단순한 키에 가깝다. 토큰 문자열 자체에는 사용자 정보가 들어 있지 않고, 서버 DB에 저장된 토큰 정보를 조회해서 사용자를 확인한다.

반면 JWT는 토큰 안에 사용자 식별 정보와 만료 시간 등이 들어 있다. 서버는 DB에서 토큰을 찾기보다, 토큰을 해석하고 서명을 검증해 사용자를 판단한다.

| 구분 | TokenAuthentication | JWT |
|---|---|---|
| 토큰 내부 정보 | 정보 없음. 랜덤 키에 가까움 | 사용자 정보와 만료 정보 포함 |
| 서버 확인 방식 | DB에 저장된 토큰 조회 | 토큰 해석 및 서명 검증 |
| 유출 대응 | 서버에서 토큰 삭제 또는 비활성화 가능 | 만료 전까지 대응이 까다로움 |
| 적합한 상황 | 로그인 관리가 엄격한 서비스 | 확장성과 트래픽 처리가 중요한 서비스 |

강의에서는 Token 방식은 은행처럼 로그인 관리가 엄격한 경우에 적합하고, JWT 방식은 SNS나 쇼핑몰처럼 대규모 트래픽 처리가 필요한 서비스에서 자주 사용된다고 설명했다.

⚠️ 주의: JWT가 항상 더 좋은 방식은 아니다. JWT는 Stateless 구조와 확장성 측면에서 장점이 있지만, 토큰 유출 시 즉시 무효화하기 어렵다는 점을 반드시 고려해야 한다.

---

## 3.6 DRF와 dj-rest-auth에서 JWT 사용 준비

이번 실습에서는 DRF 프로젝트에 JWT 방식을 적용하기 위해 공식 문서를 확인하고, `djangorestframework-simplejwt`를 사용한다.

![DRF 공식 문서 확인](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 172843.png>)

DRF 공식 문서에서는 인증 방식의 확장 가능성을 확인할 수 있다. DRF는 기본 인증, 세션 인증, 토큰 인증뿐 아니라 외부 패키지를 통해 JWT 인증 방식도 사용할 수 있다.

![dj-rest-auth 공식 문서 확인](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 172937.png>)

`dj-rest-auth`에서는 JWT Token 방식을 사용하기 위해 `djangorestframework-simplejwt`를 함께 활용한다. 기존 로그인 URL을 크게 바꾸지 않고도 JWT 기반 응답을 받을 수 있도록 설정할 수 있다는 점이 실습의 핵심이다.

설치 명령은 다음과 같다.

```bash
# JWT 인증을 위해 Simple JWT 패키지를 설치한다.
pip install djangorestframework-simplejwt
```

이 패키지를 설치한 뒤에는 Django settings에서 인증 방식과 앱 등록, dj-rest-auth의 JWT 사용 여부를 설정해야 한다.

---

## 3.7 Django settings.py에서 JWTAuthentication 설정하기

기존 TokenAuthentication을 사용하던 프로젝트라면, 먼저 DRF의 기본 인증 클래스를 JWT 방식으로 변경해야 한다.

![JWTAuthentication 설정](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 173122.png>)

설정 예시는 다음과 같다.

```python
# settings.py

REST_FRAMEWORK = {
    # DRF가 요청을 인증할 때 어떤 인증 방식을 사용할지 지정한다.
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # 기존 TokenAuthentication을 사용하는 경우에는 아래처럼 주석 처리하거나 제거한다.
        # 'rest_framework.authentication.TokenAuthentication',

        # JWT 기반 인증을 사용하기 위해 Simple JWT의 인증 클래스를 등록한다.
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}
```

이 설정은 DRF가 요청을 받을 때 `Authorization` 헤더의 JWT를 읽고 사용자를 인증하도록 만든다. 기존 TokenAuthentication에서는 `Authorization: Token ...` 형식을 사용했지만, JWTAuthentication에서는 일반적으로 `Authorization: Bearer ...` 형식을 사용한다.

⚠️ 주의: 백엔드 인증 방식을 JWT로 바꿨다면 프론트엔드 요청 헤더도 함께 바꿔야 한다. Django는 JWT를 기대하는데 Vue에서 여전히 `Token ${token}` 형식으로 보내면 인증이 실패할 수 있다.

---

## 3.8 INSTALLED_APPS에 simplejwt 등록하기

Simple JWT를 사용하려면 `INSTALLED_APPS`에도 관련 앱을 등록한다.

![INSTALLED_APPS에 simplejwt 등록](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 173201.png>)

```python
# settings.py

INSTALLED_APPS = [
    # 기본 Django 앱들
    'articles',
    'accounts',

    # 소셜 로그인 또는 계정 관련 앱을 사용하는 경우 함께 등록될 수 있다.
    'allauth.socialaccount',
    'dj_rest_auth.registration',

    # DRF와 JWT 인증에 필요한 앱
    'rest_framework',
    'rest_framework_simplejwt',
]
```

이 설정을 통해 프로젝트에서 Simple JWT 기능을 사용할 준비를 한다. 앱 등록 후에는 실제로 `REST_AUTH` 설정에서 JWT 사용 여부를 켜야 한다.

---

## 3.9 dj-rest-auth에서 JWT 사용 설정하기

`dj-rest-auth`의 로그인 URL을 그대로 활용하면서 JWT 토큰을 받고 싶다면 `REST_AUTH` 설정에 `USE_JWT`를 추가한다.

![REST_AUTH USE_JWT 설정](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 173246.png>)

```python
# settings.py

REST_AUTH = {
    # 회원가입에서 사용하는 serializer가 있다면 기존 설정을 유지한다.
    'REGISTER_SERIALIZER': 'accounts.serializers.CustomRegisterSerializer',

    # dj-rest-auth의 로그인 응답을 JWT 방식으로 사용한다.
    'USE_JWT': True,
}
```

이 설정을 추가하면 기존 `/accounts/login/` 같은 로그인 엔드포인트를 사용하더라도 응답으로 JWT 관련 값이 내려오도록 구성할 수 있다.

여기서 중요한 점은 백엔드 설정만 바꾼다고 끝나는 것이 아니라는 점이다. 로그인 응답 구조가 달라지면 Vue에서 응답을 읽는 방식도 함께 바뀌어야 한다.

---

## 3.10 Vue에서 로그인 응답 처리 변경하기

JWT 방식으로 바꾸면 로그인 성공 시 응답 데이터에 `access` 값이 포함된다. Vue에서는 이 값을 store의 token으로 저장해야 한다.

![Vue login 함수 수정](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 173326.png>)

Pinia store의 로그인 함수 흐름은 다음과 같이 이해할 수 있다.

```js
// stores/accounts.js

const login = function ({ username, password }) {
  axios({
    // 로그인 요청은 POST 방식으로 보낸다.
    method: 'post',

    // dj-rest-auth의 로그인 URL로 요청한다.
    url: `${API_URL}/accounts/login/`,

    // 사용자가 입력한 username, password를 서버로 전달한다.
    data: {
      username,
      password,
    },
  })
    .then((res) => {
      // JWT 방식에서는 응답 데이터 안의 access 값이 Access Token이다.
      // 기존 TokenAuthentication의 res.data.key와 다르므로 주의해야 한다.
      token.value = res.data.access

      // 로그인 성공 후 필요한 페이지로 이동한다.
      router.push({ name: 'ArticleView' })
    })
    .catch((err) => {
      // 로그인 실패 시 에러 내용을 확인한다.
      console.log(err)
    })
}
```

기존 TokenAuthentication에서는 `res.data.key`를 저장했다면, JWT에서는 `res.data.access`를 저장한다. 이 차이를 놓치면 로그인은 성공했는데 이후 인증 요청에서 token 값이 비어 있거나 잘못 저장되는 문제가 생긴다.

⚠️ 주의: 강의 필기에는 “token.value = res.data.access”로 바꾸는 부분이 핵심이다. JWT 방식에서는 응답 필드명이 `key`가 아니라 `access`라는 점을 반드시 확인해야 한다.

---

## 3.11 JWT 응답과 내부 정보 확인하기

로그인을 완료한 뒤에는 브라우저 console에서 응답 값을 확인할 수 있다. 이때 `access` 값이 실제 Access Token이고, 필요하면 이 값을 jwt.io에 붙여 넣어 내부 구조를 확인할 수 있다.

![jwt.io에서 access token 확인](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 173433.png>)

jwt.io에 Access Token을 넣으면 Header, Payload, Signature 영역이 나뉘어 표시된다. Payload에는 토큰 타입, 만료 시간, 발급 시간, 사용자 id 등이 표시될 수 있다.

이어서 Django settings.py의 `SECRET_KEY`를 jwt.io의 검증 영역에 넣으면 서명이 검증되는 것을 확인할 수 있다.

![SECRET_KEY를 통한 서명 검증](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 173513.png>)

이 실습은 JWT의 Signature가 어떤 의미인지 이해하는 데 도움이 된다. 서버는 자신이 가진 비밀키를 기준으로 토큰이 위조되었는지 확인한다. 만약 누군가 Payload를 임의로 바꾼다면 Signature 검증이 실패한다.

⚠️ 주의: 실제 프로젝트의 `SECRET_KEY`를 외부 사이트에 입력하는 것은 보안상 매우 위험하다. 강의 실습 환경에서 개념 확인용으로만 이해하고, 실제 서비스 키는 절대 외부에 입력하지 않아야 한다.

---

## 3.12 인증 요청에서 Authorization 헤더 변경하기

JWT 방식으로 바꾸면 인증이 필요한 요청의 Authorization 헤더도 바뀐다. 기존 TokenAuthentication에서는 다음과 같은 형식을 사용했다.

```http
Authorization: Token 토큰값
```

JWT 방식에서는 다음 형식을 사용한다.

```http
Authorization: Bearer 액세스토큰값
```

이 차이는 프론트엔드 코드에서 반드시 반영해야 한다.

---

### 3.12.1 게시글 목록 요청에서 Bearer 사용하기

게시글 목록을 가져오는 axios 요청에서는 headers에 `Bearer`를 붙여 Access Token을 전달한다.

![stores/articles.js Authorization 수정](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 173607.png>)

```js
// stores/articles.js

const getArticles = function () {
  axios({
    // 게시글 목록을 조회하기 위한 GET 요청
    method: 'get',

    // articles API 엔드포인트
    url: `${API_URL}/api/v1/articles/`,

    headers: {
      // 기존 Token 방식: `Token ${accountStore.token}`
      // JWT 방식: `Bearer ${accountStore.token}`
      Authorization: `Bearer ${accountStore.token}`,
    },
  })
    .then((res) => {
      // 서버에서 받은 게시글 목록을 store 상태에 저장한다.
      articles.value = res.data
    })
    .catch((err) => {
      console.log(err)
    })
}
```

여기서 `Bearer`는 “이 요청에는 전달자 토큰이 들어 있다”는 의미로 Authorization 헤더에서 자주 사용되는 인증 스킴이다. JWTAuthentication은 이 형식을 기준으로 토큰을 읽는다.

---

### 3.12.2 게시글 생성 요청에서 Bearer 사용하기

게시글 생성처럼 인증된 사용자만 할 수 있는 요청에서도 같은 방식으로 Authorization 헤더를 수정한다.

![CreateView Authorization 수정](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 173644.png>)

```js
// views/CreateView.vue 또는 게시글 생성 로직

const createArticle = function () {
  axios({
    // 게시글 생성은 POST 요청으로 처리한다.
    method: 'post',

    // 게시글 생성 API 엔드포인트
    url: `${API_URL}/api/v1/articles/`,

    // 사용자가 입력한 제목과 내용을 서버로 보낸다.
    data: {
      title: title.value,
      content: content.value,
    },

    headers: {
      // JWT 인증에서는 Bearer 형식으로 Access Token을 전달한다.
      Authorization: `Bearer ${accountStore.token}`,
    },
  })
    .then((res) => {
      // 게시글 생성 성공 후 목록 또는 상세 페이지로 이동한다.
      router.push({ name: 'ArticleView' })
    })
    .catch((err) => {
      console.log(err)
    })
}
```

⚠️ 주의: 로그인 로직에서 Access Token을 잘 저장했더라도, 요청 헤더에서 `Bearer`를 빠뜨리면 서버는 인증 정보를 제대로 읽지 못한다. JWT 전환 후 401 에러가 난다면 먼저 Authorization 헤더 형식을 확인하는 것이 좋다.

📌 핵심: JWT 인증 요청은 `Authorization: Bearer ${accessToken}` 형식으로 보낸다.

---

## 3.13 Refresh Token의 의미

Access Token은 실제 인증 요청에 사용되는 토큰이다. 그런데 Access Token은 유출 위험을 줄이기 위해 유효시간을 짧게 설정한다. 유효시간이 짧으면 보안에는 유리하지만, 사용자가 너무 자주 다시 로그인해야 하는 문제가 생긴다.

이 문제를 해결하기 위해 사용하는 것이 **Refresh Token**이다.

Refresh Token은 “로그인을 다시 하지 않아도 Access Token을 새로 받을 수 있게 하는 장기 열쇠”라고 볼 수 있다. Access Token이 만료되면 클라이언트는 Refresh Token을 서버에 보내고, 서버는 Refresh Token이 유효한지 확인한 뒤 새 Access Token을 발급한다.

정리하면 다음과 같다.

| 토큰 | 역할 | 보통의 유효시간 | 사용 시점 |
|---|---|---|---|
| Access Token | 실제 API 요청 인증 | 짧게 설정 | 대부분의 인증 요청 |
| Refresh Token | Access Token 재발급 | Access Token보다 길게 설정 | Access Token 만료 시 |

Access Token은 짧게, Refresh Token은 길게 가져가는 이유는 보안과 편의성의 균형 때문이다. Access Token이 유출되더라도 짧은 시간 안에 만료되게 하고, 사용자는 Refresh Token으로 새 Access Token을 받아 로그인 상태를 이어갈 수 있다.

---

## 3.14 Access Token 재발급 흐름

Access Token 재발급 흐름은 인증 요청 실패에서 시작된다. 클라이언트가 기존 Access Token으로 서버에 요청했는데, 토큰이 만료되었다면 서버는 401 Unauthorized 응답을 보낸다.

이때 클라이언트는 바로 로그인 페이지로 보내지 않고, 먼저 Refresh Token으로 Access Token 재발급을 시도한다.

흐름을 단계로 정리하면 다음과 같다.

1. 기존 Access Token을 사용해서 서버에 요청한다.
2. Access Token이 만료되어 401 에러가 발생한다.
3. 저장해둔 Refresh Token으로 Access Token 재발급 API를 호출한다.
4. 재발급에 성공하면 새 Access Token을 저장한다.
5. 실패했던 원래 요청을 다시 실행한다.
6. 재발급에 실패하면 Refresh Token도 만료된 것으로 보고 로그인 정보를 삭제한 뒤 로그인 페이지로 이동한다.

이 흐름은 실제 서비스에서 매우 중요하다. 사용자가 글 목록을 보려고 했는데 Access Token이 만료되었다고 바로 로그아웃시키면 사용 경험이 나빠진다. 대신 Refresh Token이 살아 있다면 조용히 Access Token을 갱신하고 원래 요청을 다시 처리하는 것이 자연스럽다.

---

## 3.15 Refresh Token 발급 설정하기

현재 로그인 응답에서 Refresh Token이 빈 값으로 전달되는 상황이 있을 수 있다. 강의에서는 이것이 `dj_rest_auth`의 `JWT_AUTH_HTTPONLY` 기본값이 `True`로 되어 있기 때문이라고 설명했다.

![JWT_AUTH_HTTPONLY 설정](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 174649.png>)

실습에서는 Refresh Token을 응답 데이터에서 직접 확인하고 저장하기 위해 해당 값을 `False`로 설정한다.

```python
# settings.py

REST_AUTH = {
    # 기존 회원가입 serializer 설정
    'REGISTER_SERIALIZER': 'accounts.serializers.CustomRegisterSerializer',

    # dj-rest-auth에서 JWT 사용
    'USE_JWT': True,

    # 실습에서는 refresh token을 응답 본문에서 확인하고 저장하기 위해 False로 설정한다.
    # 기본값이 True이면 HttpOnly 쿠키 방식으로 다뤄질 수 있어 JS에서 직접 접근하기 어렵다.
    'JWT_AUTH_HTTPONLY': False,
}
```

`JWT_AUTH_HTTPONLY`는 보안과 관련된 중요한 설정이다. HttpOnly 쿠키는 JavaScript에서 직접 접근할 수 없기 때문에 XSS 공격에 더 안전한 측면이 있다. 하지만 강의 실습에서는 Refresh Token을 store에서 직접 다루기 위해 False로 변경했다.

⚠️ 주의: 실습 편의를 위해 `JWT_AUTH_HTTPONLY: False`로 설정할 수 있지만, 실제 서비스에서는 Refresh Token을 어디에 저장할지 신중하게 결정해야 한다. Refresh Token은 Access Token보다 오래 살아 있으므로 유출되면 위험이 크다.

---

## 3.16 로그인 시 Refresh Token 저장하기

Refresh Token이 응답으로 내려오면 Vue store에서 Access Token과 함께 저장해야 한다.

![로그인 시 refresh token 저장](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 174723.png>)

Pinia store의 로그인 로직은 다음처럼 이해할 수 있다.

```js
// stores/accounts.js

const token = ref(null)
const refreshToken = ref(null)

const login = function ({ username, password }) {
  return axios({
    method: 'post',
    url: `${API_URL}/accounts/login/`,
    data: {
      username,
      password,
    },
  })
    .then((res) => {
      // access token은 실제 인증 요청에 사용한다.
      token.value = res.data.access

      // refresh token은 access token이 만료되었을 때 재발급 요청에 사용한다.
      refreshToken.value = res.data.refresh

      // 로그인 성공 후 원하는 페이지로 이동한다.
      router.push({ name: 'ArticleView' })
    })
    .catch((err) => {
      console.log(err)
    })
}
```

강의에서는 Refresh Token 저장과 함께 `return`을 같이 등록하는 흐름도 확인했다. 이 부분은 로그인 이후 다른 로직과 연결하거나, 비동기 흐름을 이어갈 때 필요할 수 있다.

---

## 3.17 Token 만료 기한 설정하기

Simple JWT의 기본 설정에서는 Access Token과 Refresh Token의 만료 기한이 정해져 있다. 강의에서는 현재 Access Token은 5분, Refresh Token은 1일로 설정되어 있다고 정리했다.

![Token 만료 기한 설정](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 174939.png>)

만료 시간을 직접 설정하려면 `datetime.timedelta`를 사용한다.

```python
# settings.py

from datetime import timedelta

SIMPLE_JWT = {
    # 테스트를 위해 Access Token 만료 시간을 짧게 설정할 수 있다.
    # 실제 서비스에서는 보안 수준과 사용자 경험을 함께 고려해야 한다.
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=1),

    # Refresh Token은 Access Token보다 길게 설정한다.
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=2),
}
```

Access Token의 적정 만료 시간은 서비스 성격에 따라 달라진다. 보안이 중요한 서비스에서는 5~10분처럼 짧게 설정할 수 있고, 일반적인 서비스에서는 10~15분 정도로 두는 경우가 많다. Refresh Token은 보통 1~2주 또는 30일처럼 더 길게 설정하지만, 이 역시 서비스의 보안 요구사항에 따라 달라진다.

⚠️ 주의: 테스트를 위해 만료 시간을 1분, 2분처럼 짧게 잡을 수는 있지만, 실제 서비스에 그대로 적용하면 사용자가 너무 자주 재발급 요청을 보내거나 로그아웃되는 문제가 생길 수 있다.

---

## 3.18 Refresh Token으로 Access Token 갱신하기

Access Token이 만료되었을 때 새 Access Token을 받으려면 재발급 API를 호출해야 한다. 강의에서는 `stores/accounts.js`에 `refreshAccessToken` 함수를 정의했다.

![refreshAccessToken 함수](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 175020.png>)

흐름은 다음과 같다.

```js
// stores/accounts.js

const refreshAccessToken = function () {
  return axios({
    // token refresh 요청은 POST 방식으로 보낸다.
    method: 'post',

    // dj-rest-auth 또는 simplejwt에서 제공하는 token refresh URL을 사용한다.
    url: `${API_URL}/accounts/token/refresh/`,

    // refresh token을 서버로 보내 새 access token을 요청한다.
    data: {
      refresh: refreshToken.value,
    },
  })
    .then((res) => {
      // 재발급에 성공하면 새 access token으로 교체한다.
      token.value = res.data.access

      // 호출한 쪽에서 성공 여부를 판단할 수 있도록 true를 반환한다.
      return true
    })
    .catch((err) => {
      console.log(err)

      // refresh token도 만료되었거나 유효하지 않으면 재발급에 실패한다.
      return false
    })
}
```

이 함수는 단독으로 끝나는 함수가 아니라, 다른 API 요청 실패 처리와 함께 사용된다. 예를 들어 게시글 목록 요청이 401로 실패하면 `refreshAccessToken()`을 호출하고, 성공하면 다시 게시글 목록 요청을 실행한다.

---

## 3.19 Article 목록 요청 실패 시 Access Token 재발급하기

Access Token 재발급 로직은 실제 API 요청과 연결되어야 의미가 있다. 강의에서는 Article 목록 요청에서 401 에러가 발생했을 때 Access Token을 재발급하고, 성공하면 목록 요청을 다시 실행하는 흐름을 구현했다.

![Article 목록 요청 시 access token 재발급](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 175228.png>)

코드 흐름은 다음처럼 정리할 수 있다.

```js
// stores/articles.js

const getArticles = function () {
  axios({
    method: 'get',
    url: `${API_URL}/api/v1/articles/`,
    headers: {
      // 현재 저장된 access token으로 요청한다.
      Authorization: `Bearer ${accountStore.token}`,
    },
  })
    .then((res) => {
      // 요청이 성공하면 게시글 목록을 저장한다.
      articles.value = res.data
    })
    .catch(async (err) => {
      // 요청 실패 원인이 401이라면 access token 만료를 의심할 수 있다.
      if (err.response && err.response.status === 401) {
        // refresh token으로 새 access token 발급을 시도한다.
        const isRefreshed = await accountStore.refreshAccessToken()

        if (isRefreshed) {
          // 재발급에 성공하면 원래 요청을 다시 실행한다.
          getArticles()
        } else {
          // 재발급에 실패하면 refresh token도 만료되었거나 유효하지 않은 상태다.
          // 인증 정보를 정리하고 로그인 페이지로 이동하는 흐름을 처리한다.
          accountStore.logout()
          router.push({ name: 'LoginView' })
        }
      } else {
        console.log(err)
      }
    })
}
```

이 구조의 핵심은 401 에러를 단순 실패로 끝내지 않는 것이다. 401이 발생했을 때 먼저 Refresh Token으로 복구 가능한 상황인지 확인하고, 복구 가능하면 사용자가 눈치채지 못하게 Access Token을 갱신한 뒤 원래 요청을 다시 실행한다.

⚠️ 주의: 재발급 성공 후 원래 요청을 다시 실행할 때 무한 반복이 생기지 않도록 주의해야 한다. Refresh Token도 만료되어 계속 401이 발생하는 상황이라면 반드시 로그아웃 처리 또는 로그인 페이지 이동으로 흐름을 끊어야 한다.

---

## 3.20 CreateView에서도 같은 재발급 로직 적용하기

게시글 생성 요청도 인증이 필요한 요청이다. 따라서 Access Token이 만료된 상태에서 게시글 생성 요청을 보내면 401 에러가 발생할 수 있다. 이 경우에도 Article 목록 요청과 같은 방식으로 Refresh Token 재발급 로직을 적용한다.

![CreateView에서 access token 재발급 처리](<../assets/images/06_12_JWT/화면 캡처 2026-06-30 175254.png>)

흐름은 다음과 같다.

1. 현재 Access Token으로 게시글 생성 요청을 보낸다.
2. 성공하면 게시글 목록 또는 상세 페이지로 이동한다.
3. 401 에러가 발생하면 `refreshAccessToken()`을 호출한다.
4. 재발급에 성공하면 생성 요청을 다시 실행한다.
5. 재발급에 실패하면 로그인 정보가 유효하지 않은 것으로 보고 로그인 페이지로 이동한다.

```js
// views/CreateView.vue

const createArticle = function () {
  axios({
    method: 'post',
    url: `${API_URL}/api/v1/articles/`,
    data: {
      title: title.value,
      content: content.value,
    },
    headers: {
      Authorization: `Bearer ${accountStore.token}`,
    },
  })
    .then((res) => {
      // 생성 성공 후 게시글 목록으로 이동한다.
      router.push({ name: 'ArticleView' })
    })
    .catch(async (err) => {
      if (err.response && err.response.status === 401) {
        // access token이 만료되었다면 refresh token으로 갱신을 시도한다.
        const isRefreshed = await accountStore.refreshAccessToken()

        if (isRefreshed) {
          // 갱신 성공 후 원래 생성 요청을 다시 실행한다.
          createArticle()
        } else {
          // refresh token까지 유효하지 않으면 인증 상태를 정리한다.
          accountStore.logout()
          router.push({ name: 'LoginView' })
        }
      } else {
        console.log(err)
      }
    })
}
```

이 로직은 목록 조회와 거의 동일하지만, 요청의 성격이 다르다는 점을 기억해야 한다. 목록 조회는 GET 요청이고, 게시글 생성은 POST 요청이다. POST 요청을 재시도할 때는 같은 데이터가 중복 전송될 가능성도 고려해야 한다. 실습에서는 단순한 게시글 생성 흐름이지만, 실제 서비스에서는 중복 제출 방지 로직도 함께 고려할 수 있다.

---

## 4. 적용 관점에서 다시 보기

이번 강의는 단순히 “JWT를 설치했다”에서 끝나는 내용이 아니다. Vue와 DRF를 연결하는 프로젝트에서 인증 흐름 전체를 바꾸는 작업이다.

먼저 백엔드에서는 `TokenAuthentication`에서 `JWTAuthentication`으로 인증 방식을 변경한다. 이때 `djangorestframework-simplejwt`를 설치하고, `REST_FRAMEWORK`의 기본 인증 클래스를 수정하며, `REST_AUTH`에서 `USE_JWT`를 켠다. 이 과정은 서버가 앞으로 어떤 형식의 Authorization 헤더를 인증 정보로 받아들일지 결정한다.

프론트엔드에서는 로그인 응답 구조가 바뀌는 것에 주의해야 한다. 기존 Token 방식에서는 `res.data.key`를 저장했다면, JWT 방식에서는 `res.data.access`를 저장한다. 그리고 이후 요청 헤더에서는 `Token`이 아니라 `Bearer`를 사용한다. JWT로 전환했는데 인증이 계속 실패한다면, 가장 먼저 확인해야 할 부분이 바로 이 응답 필드명과 Authorization 헤더 형식이다.

Refresh Token은 Access Token 만료 문제를 해결하기 위한 장치다. Access Token은 짧게 유지해 보안을 높이고, 사용자가 불편하지 않도록 Refresh Token으로 새 Access Token을 발급받는다. 이때 401 에러를 만났을 때의 처리 흐름이 중요하다. 401이 발생하면 바로 로그아웃시키는 것이 아니라, 먼저 재발급을 시도하고, 성공하면 원래 요청을 다시 실행한다.

실제 프로젝트에서는 이 로직을 각 요청마다 반복해서 작성하기보다, axios interceptor로 공통 처리하는 방식까지 확장할 수 있다. 하지만 이번 강의에서는 흐름을 명확히 이해하기 위해 Article 목록 요청과 CreateView 요청에서 직접 재발급 로직을 작성한 것으로 볼 수 있다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

기존 TokenAuthentication과 JWT는 모두 토큰을 사용하지만, 토큰 내부 구조와 서버 검증 방식이 다르다는 점을 분명히 이해할 수 있다. 특히 JWT는 Payload를 누구나 열어볼 수 있으므로 “토큰 안에 정보가 들어 있다”는 말이 “안전하게 숨겨져 있다”는 뜻이 아니라는 점이 중요하다.

또한 JWT 방식으로 바꾸면 백엔드 설정만 바꾸는 것이 아니라, Vue의 로그인 응답 처리와 Authorization 헤더 형식까지 함께 수정해야 한다. `res.data.access`와 `Bearer` 형식은 JWT 전환 과정에서 가장 먼저 확인해야 할 포인트다.

### 5.2 앞으로 이어지는 연결점

이번 내용은 Vue + DRF 프로젝트의 로그인 유지, 인증 페이지 접근 제한, 게시글 생성 권한, 마이페이지 조회 기능과 바로 연결된다. 특히 Navigation Guard와 함께 사용하면 로그인하지 않은 사용자의 접근을 막고, 로그인 상태에 따라 화면을 다르게 보여주는 구조를 만들 수 있다.

Refresh Token 재발급 흐름은 이후 axios interceptor 학습으로 자연스럽게 이어진다. 현재는 각 요청의 catch 블록에서 직접 401을 처리하지만, 프로젝트가 커지면 모든 요청에 공통으로 적용되는 재발급 로직을 interceptor로 분리하는 것이 더 깔끔하다.

### 5.3 더 파볼 만한 주제

이번 강의에서 더 확장할 수 있는 주제는 Refresh Token 저장 위치와 보안이다. Local Storage에 저장하는 방식은 구현이 쉽지만 XSS에 취약할 수 있고, HttpOnly Cookie 방식은 JavaScript에서 접근할 수 없어 보안상 장점이 있다. 실제 서비스에서는 JWT를 어디에 저장할지, 로그아웃 시 토큰을 어떻게 폐기할지, Refresh Token을 서버에서 블랙리스트 처리할지까지 함께 고민해야 한다.

또한 Simple JWT의 blacklist app, token rotation, sliding token, axios interceptor, Pinia persisted state와 함께 공부하면 인증 흐름을 더 실전적으로 설계할 수 있다.

---

## 6. 요약 정리

📌 핵심

- JWT는 서버가 사용자에게 발급하는 디지털 출입증처럼 동작한다.
- JWT는 `Header.Payload.Signature` 세 부분으로 구성된다.
- Payload는 누구나 디코딩할 수 있으므로 민감한 정보를 넣으면 안 된다.
- 기존 TokenAuthentication은 서버 DB에서 토큰을 조회하고, JWT는 토큰 자체를 해석하고 서명을 검증한다.
- DRF에서 JWT를 사용하려면 `djangorestframework-simplejwt`를 설치하고 `JWTAuthentication`을 설정한다.
- `dj-rest-auth`에서 로그인 URL을 그대로 활용하려면 `REST_AUTH['USE_JWT'] = True`를 설정한다.
- Vue 로그인 로직에서는 `res.data.access`를 token으로 저장한다.
- JWT 인증 요청 헤더는 `Authorization: Bearer ${accessToken}` 형식을 사용한다.
- Access Token은 짧게 유지하고, Refresh Token으로 새 Access Token을 재발급받는다.
- 401 에러가 발생하면 Refresh Token으로 Access Token 재발급을 시도하고, 성공하면 원래 요청을 다시 실행한다.
- 재발급에 실패하면 Refresh Token도 만료되었거나 유효하지 않은 상태이므로 인증 정보를 삭제하고 로그인 페이지로 이동해야 한다.

🧠 기억할 것

> JWT로 바꾸면 백엔드 인증 클래스, dj-rest-auth 설정, Vue 로그인 응답 처리, Authorization 헤더 형식이 함께 바뀐다.  
> `Token ${token}`이 아니라 `Bearer ${accessToken}`을 사용해야 한다.  
> Access Token 만료는 실패가 아니라 Refresh Token 재발급 흐름으로 이어지는 신호다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. JWT는 어떤 세 부분으로 구성되는가?
2. JWT의 Payload에 비밀번호나 개인정보를 넣으면 안 되는 이유는 무엇인가?
3. 기존 DRF TokenAuthentication 방식과 JWT 방식의 가장 큰 차이는 무엇인가?
4. DRF에서 JWT 인증을 사용하려면 `DEFAULT_AUTHENTICATION_CLASSES`에 어떤 인증 클래스를 등록해야 하는가?
5. `dj-rest-auth`에서 JWT 응답을 사용하기 위해 `REST_AUTH`에 어떤 설정을 추가해야 하는가?
6. JWT 로그인 응답에서 Access Token은 보통 어떤 필드명으로 내려오는가?
7. JWT 인증 요청에서 Authorization 헤더는 `Token`과 `Bearer` 중 무엇을 사용해야 하는가?
8. Access Token과 Refresh Token의 역할 차이를 설명해보자.
9. Access Token이 만료되어 401 에러가 발생하면 클라이언트는 어떤 순서로 처리해야 하는가?
10. Refresh Token 재발급에도 실패했다면 어떤 처리를 해야 하는가?
11. `JWT_AUTH_HTTPONLY` 설정은 Refresh Token을 다루는 방식과 어떤 관련이 있는가?
12. 실제 프로젝트에서 각 axios 요청마다 401 처리 코드를 반복하지 않으려면 어떤 방식으로 확장할 수 있는가?
