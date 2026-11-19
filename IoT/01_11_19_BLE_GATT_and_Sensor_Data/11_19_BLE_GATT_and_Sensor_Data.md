# BLE GATT로 센서 값 읽기: 특성 발견부터 알림 바이트 해석까지

- 🎯 글의 목표: 온도계가 연결됐는데도 값이 보이지 않는 이유를 단계별로 좁히고, 수신한 `01 83 ff`를 `-1.25 °C`로 해석할 수 있다.
- 🧩 핵심 키워드: Bluetooth LE(BLE), GATT, 서비스·특성, UUID·핸들, Read·Notify·Indicate, CCCD, 바이트 순서와 부호
- ⭐ 중요도: 높음. 기기와 앱이 연결되는 것, 값이 전달되는 것, 그 값이 올바르게 표시되는 것은 서로 다른 성공 조건이다.
- 📝 한눈에 보는 내용: 가상 온도계의 측정 항목 찾기 → 한 번 읽기와 구독 구분 → 3바이트를 섭씨로 변환 → 잘못된 입력 거절
- 🔗 관련 주제: [문자와 바이트 순서](../../Algorithm/02_06_String/02_06_String.md) · [IoT 학습 순서](../README.md)
- 🧱 선수 지식: Python 함수와 조건문. BLE 장비나 펌웨어 개발 경험은 필요하지 않다.

> 기준일 2026-11-19 · 통신 개념은 Bluetooth Core 5.4, 예제는 Python 3.12 표준 라이브러리 기준이다. 가상의 실내 온도계를 위해 만든 **사용자 정의 형식**이다. §3의 변환과 오류 처리는 PC에서 검증했으며, 보드 연결·무선 전송·Zephyr 빌드는 검증 범위가 아니다.

## 1. 들어가며

휴대폰에서 무선 온도계를 선택하자 ‘연결됨’이 뜬다. 그런데 온도 칸은 여전히 비어 있다. 잠시 뒤 개발 도구에는 `01 83 ff`가 찍힌다. 이제 문제가 하나에서 둘로 나뉜다. **앱이 어느 항목에서 값을 받아야 하는가? 받은 세 바이트는 무슨 뜻인가?** 첫 질문은 통신 절차로, 둘째 질문은 데이터 형식으로 풀어야 한다.

Bluetooth Low Energy(BLE)는 낮은 전력 소비를 고려한 블루투스 통신 방식이다. 여기서는 센서와 앱이 연결된 후의 값 교환에 집중한다. 앞서 문자열에서 같은 바이트라도 인코딩 약속이 필요했다면, 센서 값에서는 **어떤 정수 형식이고 단위가 무엇인지**가 그 약속이다. 특정 제품의 통신 기록 없이도 두 원리를 함께 연습할 수 있다.

## 2. 핵심 개념 정리

| 지금 답할 질문 | 예제에서 확인할 것 |
| --- | --- |
| 누구와 연결했나? | 앱이 가상 온도계와 연결을 맺었다. 아직 측정값을 읽은 것은 아니다. |
| 어디에서 읽나? | 온도계의 서비스 안에서 측정값 **특성**을 찾는다. |
| 언제 받나? | 지금 한 번 필요하면 읽기를 요청하고, 새 측정값이 생길 때 받고 싶으면 알림을 구독한다. |
| 어떻게 표시하나? | 그 특성의 값만 꺼내 버전·길이·부호·단위를 확인하고 섭씨로 환산한다. |

순서대로 보면 ‘온도가 안 보인다’는 같은 증상이라도, 특성을 못 찾은 경우와 바이트를 잘못 읽은 경우에 손댈 곳이 다르다.

## 3. 본문 정리

### 3.1 연결된 기기 안에서 온도 항목 찾기

**GATT(Generic Attribute Profile)**는 연결된 기기가 어떤 데이터 항목을 제공하고 다른 기기가 그것을 어떻게 찾아 읽거나 갱신받을지 정한 규칙이다. 값을 제공하는 쪽이 **GATT 서버**, 그 항목을 찾아 읽는 쪽이 **GATT 클라이언트**다. 여기서는 온도계가 서버이고 휴대폰이 클라이언트다. ‘서버’는 인터넷상의 컴퓨터를 가리키는 말이 아니다.

반면 **central·peripheral**은 연결을 기준으로 한 역할이다. 이 예에서 휴대폰(central)이 연결을 시작하고 온도계(peripheral)가 연결을 받는다. 누가 연결했는지와 누가 데이터를 제공하는지는 다른 질문이다. 한 기기가 다른 항목에 대해서는 GATT 클라이언트와 서버를 겸할 수도 있다. [Bluetooth Core 5.4, GAP](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-access-profile.html) · [GATT §2, 역할과 계층](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html)

온도계가 제공하는 **서비스(service)**는 관련 항목의 묶음이고, **특성(characteristic)**은 그 안에서 한 값을 어떤 방식으로 이용할 수 있는지 나타내는 단위다. **디스크립터(descriptor)**는 특성에 덧붙는 설명이나 설정 항목이다. 예를 들어 아래에서 앱이 읽을 곳은 ‘측정값’이고, 알림을 켤 곳은 그 아래 ‘구독 설정’이다.

```text
온도계 (GATT 서버)
└─ 실내 환경 서비스
   └─ 측정값 특성                 지원 동작: Read, Notify
      ├─ 특성 값                 예: 01 83 ff
      └─ 구독 설정(CCCD)          이 클라이언트에 알림을 보낼지 설정
```

이 이름들은 설명용이다. 앱은 실제로 **UUID**(항목의 종류를 식별하는 번호)를 이용해 원하는 서비스 안의 특성을 **발견(discovery)**한다. 그 결과로 얻는 **핸들(handle)**은 해당 서버의 속성 표에서 개별 항목을 가리키는 번호다. UUID가 ‘온도 측정값을 찾는다’는 검색 기준이라면, 값 핸들은 ‘이 서버에서는 여기서 읽는다’는 결과다. 다른 기기에서 본 핸들을 고정하거나 특성 값 바로 다음 번호를 구독 설정이라고 추측하지 않는다. [Bluetooth Core 5.4, GATT §3~4](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html)

### 3.2 한 번 읽을 때와 계속 받을 때

앱을 열 때 온도 숫자 하나가 필요하면 **Read**가 맞다. 앱이 읽기를 요청하고 온도계가 그 시점에 제공하는 특성 값으로 응답한다. 서버가 마지막 측정값을 보관하는 설계라면, 읽기 성공은 ‘그 값을 받았다’는 뜻이지 ‘지금 새로 측정했다’는 뜻은 아니다. 이후의 측정값까지 보고 싶다면 매번 Read를 보내는 대신 서버가 먼저 보내는 방식을 쓸 수 있다.

| 동작 | 누가 시작하나? | 어디까지 확인되나? |
| --- | --- | --- |
| Read(읽기) | 앱이 값 하나를 요청한다. | 응답으로 값 또는 오류를 받는다. 이후의 구독은 생기지 않는다. |
| Notify(알림) | 구독 설정 후 서버가 값을 보낸다. | 값을 보낼 때마다 상대의 ATT 수신 확인을 요구하지 않는다. |
| Indicate(확인형 알림) | 해당 동작을 지원하고 설정된 경우 서버가 값을 보낸다. | 상대 ATT가 수신 확인을 돌려준다. 앱이 화면에 표시했거나 파일에 저장했다는 확인은 아니다. |

**ATT(Attribute Protocol)**는 GATT 아래에서 속성의 요청·응답을 실제로 주고받는 프로토콜이다. 위 표의 ‘확인’은 **ATT 층**에서의 확인이다. 또 Read·Notify·Indicate는 각각 별개 기능이다. 예제 온도계는 Read와 Notify만 지원하므로, 수신 확인을 원한다고 앱에서 Indicate로 바꿀 수는 없다. [Bluetooth Core 5.4, GATT §3.3.1.1·4.8·4.10~4.11](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html)

**CCCD(Client Characteristic Configuration Descriptor)**는 이 특성에서 **이 클라이언트**에게 알림 또는 확인형 알림을 보낼지 설정하는 항목이다. 두 휴대폰 A와 B 중 A가 알림을 켰다고 B도 구독되는 것은 아니다. 실제 앱에서는 플랫폼의 구독 API에 수신 함수(값이 도착하면 호출할 코드)를 등록하고 구독 설정이 성공했는지 확인한다. 예를 들어 Zephyr의 GATT 클라이언트 API는 발견·읽기·구독을 각각 `bt_gatt_discover`, `bt_gatt_read`, `bt_gatt_subscribe`로 구분한다. [GATT §3.3.3.3, CCCD](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html) · [Zephyr GATT Client APIs](https://docs.zephyrproject.org/latest/doxygen/html/group__bt__gatt__client.html)

⚠️ 주의: `Notify` 표시는 서버가 그 기능을 **지원한다**는 뜻이지, 이미 **구독됐다**거나 첫 측정값을 **즉시 전송한다**는 뜻이 아니다. Read 표시 역시 필요한 접근 권한까지 충족했다는 뜻이 아니다. 알림이 없으면 구독 결과와 서버가 알림을 내는 조건을 확인하고, 읽기 요청이 거절되면 바이트 변환보다 접근 오류를 먼저 본다.

### 3.3 같은 세 바이트가 어떻게 영하의 온도가 될까?

GATT로 특성을 찾았더라도, 그 값의 첫 바이트가 버전인지 온도인지는 **그 특성의 형식 명세**를 봐야 한다. 아래는 연습을 위해 만든 **사용자 정의 측정값 v1**이다. Bluetooth SIG 표준 온도 특성의 형식이나 공통 BLE 패킷 헤더가 아니다. 입력은 운영체제나 BLE 라이브러리가 건넨 **특성 값**이며, 무선 패킷 전체가 아니다.

| 바이트 위치(0부터) | 이 예제의 약속 | `01 83 ff`에서의 값 |
| --- | --- | --- |
| 0 | 버전, 부호 없는 1바이트. 이 디코더는 `01`만 안다. | `01` → v1 |
| 1~2 | 부호 있는 16비트 정수, 작은 자릿값 바이트부터(little-endian), 단위는 0.01 °C | `83 ff` → `0xFF83` → `-125` |

여기서 `83`과 `ff`는 각각 한 바이트를 두 자리 **16진수**로 적은 것이다(`a`~`f`는 10~15). 작은 자리 `83`이 먼저 왔으므로 높은 자리부터 수로 적으면 `0xFF83`이다. **부호 있는 16비트의 2의 보수** 표현에서는 최상위 비트가 1일 때 그 수를 음수로 읽는다. 이 예에서는 부호 없는 값에서 65,536을 빼면 된다. 따라서 `65,411 − 65,536 = -125`이고, 단위를 적용하면 `-125 × 0.01 °C = -1.25 °C`다. 부호만 놓쳐도 같은 바이트가 `654.11 °C`가 된다. 이것은 연결 문제가 아니다.

### 3.4 Python으로 형식 계약 검증하기

아래 블록들은 위에서부터 이어지는 **완성된 Python 대화형 예제**다. 외부 패키지나 센서 없이 실행한다. `>>>`는 새 입력, `...`는 함수 안에서 이어지는 줄이다. 첫 블록은 Read 응답이든 Notify 알림이든 같은 형식의 특성 값 하나를 받아 섭씨를 반환한다. [Python 3.12 `struct` 형식 표](https://docs.python.org/3.12/library/struct.html#format-characters)

```pycon
>>> from struct import Struct  # 바이트 배치 규칙을 하나의 객체로 정의해 다시 사용한다.
>>> V1 = Struct("<Bh")  # <: 작은 자리 먼저, B: 부호 없는 1바이트, h: 부호 있는 2바이트. 패딩은 없다.
>>> def decode_celsius(value: bytes) -> float:
...     if not value:  # 빈 알림을 0도로 오해하지 않도록 첫 바이트를 읽기 전에 거른다.
...         raise ValueError("missing version")
...     if value[0] != 1:  # 다른 버전의 데이터에 v1의 배치와 단위를 적용하지 않는다.
...         raise ValueError("unsupported version")
...     if len(value) != V1.size:  # 짧은 값도, 정체를 모르는 바이트가 붙은 값도 거절한다.
...         raise ValueError("v1 requires exactly 3 bytes")
...     _, hundredths = V1.unpack(value)  # 버전은 이미 확인했으므로 두 번째 필드인 온도 정수만 사용한다.
...     return hundredths / 100  # 표시 단위인 °C로 딱 한 번 환산한다.

```

`bytes.fromhex()`는 공백으로 나눈 16진수 표기를 실제 바이트로 만드는 **실습 입력 도구**다. BLE 라이브러리가 이미 바이트를 줬다면 이 변환을 다시 할 필요가 없다. 영하·영상·0을 차례로 넣어 보자. `2c 01`은 `0x012C`, 즉 300이므로 `3.0`이 나와야 한다.

```pycon
>>> decode_celsius(bytes.fromhex("01 83 ff"))  # 부호를 놓치면 이 예제가 실패한다.
-1.25
>>> decode_celsius(bytes.fromhex("01 2c 01"))  # 순서를 뒤집어 읽으면 3.0 대신 112.65가 된다.
3.0
>>> decode_celsius(bytes.fromhex("01 00 00"))  # 실제 0도는 값이 없는 상태와 다르다.
0.0

```

정상 숫자가 나온다는 사실만으로 형식 검사가 끝나지는 않는다. 다음은 **거절하는 것이 정답인 네 입력**이다. 오류가 생긴 측정값은 온도로 표시하지 않는다. 예컨대 직전 숫자를 남겨 두려면 적어도 ‘마지막으로 확인한 값’이라고 구분해야 한다.

```pycon
>>> decode_celsius(b"")  # 값이 없으므로 버전조차 알 수 없다.
Traceback (most recent call last):
    ...
ValueError: missing version
>>> decode_celsius(bytes.fromhex("01 83"))  # 16비트 온도의 뒷바이트가 없다.
Traceback (most recent call last):
    ...
ValueError: v1 requires exactly 3 bytes
>>> decode_celsius(bytes.fromhex("01 83 ff 00"))  # 앞 3바이트만 자르면 형식 불일치를 감춘다.
Traceback (most recent call last):
    ...
ValueError: v1 requires exactly 3 bytes
>>> decode_celsius(bytes.fromhex("02 83 ff"))  # 길이가 같아도 알 수 없는 버전은 해석하지 않는다.
Traceback (most recent call last):
    ...
ValueError: unsupported version

```

저장소 루트에서 다음 명령을 실행하면 Python의 `doctest`가 **이 문서의 입력과 예상 출력**을 직접 대조한다. 성공할 때는 출력 없이 종료한다. Python 3.12.12에서 실행한 결과, 정상 입력 3개는 예상 온도와 일치했고 잘못된 입력 4개는 예상 오류로 거절됐다. 이 검사로 온도계가 실제로 그 바이트를 보냈는지, 센서가 정확한 온도를 쟀는지는 알 수 없다.

```powershell
python -X utf8 -m doctest IoT/01_11_19_BLE_GATT_and_Sensor_Data/11_19_BLE_GATT_and_Sensor_Data.md
```

## 4. 적용 관점에서 다시 보기

| 보이는 증상 | 먼저 확인할 질문 | 판단 이유 |
| --- | --- | --- |
| ‘연결됨’인데 측정 항목이 없다 | 올바른 서비스 안에서 목표 특성을 발견했나? | 무선 연결 성공과 항목 발견은 다른 단계다. |
| Read로 온도는 보이는데 이후 그대로다 | Notify 지원, 내 구독의 성공, 다음 측정 발생을 확인했나? | 한 번 읽은 값은 구독을 만들지 않는다. |
| 알림은 오는데 영하에서만 큰 양수가 된다 | 두 온도 바이트를 부호 있는 값으로 읽었나? | 바이트 순서가 맞아도 음수 표현을 놓치면 값이 달라진다. |
| 익숙한 길이인데 버전이 `02`다 | 숫자를 표시하기 전에 v1 디코더가 거절하나? | 길이만 같을 뿐 단위와 필드 배치가 같다는 근거는 없다. |

요점은 **값을 못 받는 문제**에는 발견·권한·구독을, **받은 값이 다른 문제**에는 원본 바이트와 형식 명세를 대조하는 것이다. `01 83 ff`가 손에 있다면 무선 연결을 반복하지 않고 PC에서 변환부터 재현할 수 있다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

GATT는 어떤 항목을 어떤 절차로 주고받는지 설명하고, 특성의 형식 명세는 그 바이트가 어떤 값인지 설명한다. 둘을 분리하면 ‘수신 성공’과 ‘온도 해석 성공’을 따로 확인할 수 있다.

### 5.2 이전·다음 학습과의 연결

[바이트 순서 기초](../../Algorithm/02_06_String/02_06_String.md)에서 배운 작은 자리·큰 자리 구분을 이번에는 센서의 숫자에 적용했다. 다음 주제는 **연결이 끊긴 뒤 재구독과 최신값 확인**이다. 이미 표시한 온도와 재연결 후 새로 확인한 온도를 어떻게 구별할지로 이어진다.

### 5.3 더 파볼 만한 주제

이 측정값에는 순번이나 측정 시각이 없다. 온도가 우연히 직전과 똑같은 경우와 새 측정이 아예 오지 않은 경우를 구별해야 한다면, 특성의 형식에 어떤 정보가 더 필요할까?

### 5.4 참고 자료

- [Bluetooth SIG · Core 5.4, Vol. 3 Part G: GATT](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html) — §2의 역할, §3.3의 특성과 CCCD, §4.8·4.10·4.11의 읽기·알림·수신 확인을 비교한다.
- [Bluetooth SIG · Core 5.4, Vol. 3 Part C: GAP](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-access-profile.html) — LE 연결에서 central·peripheral 역할이 뜻하는 바를 확인한다.
- [Zephyr Project · GATT Client APIs](https://docs.zephyrproject.org/latest/doxygen/html/group__bt__gatt__client.html) — 발견·읽기·구독이 별개의 호출이며 구독한 값이 수신 함수로 들어오는 과정을 확인한다.
- [Python 3.12 · `struct`](https://docs.python.org/3.12/library/struct.html) · [Python 3.12 · `doctest`](https://docs.python.org/3.12/library/doctest.html) — `<Bh`의 바이트 수·부호와 문서 속 대화형 예제를 검사하는 방법을 확인한다.

## 6. 요약 정리

1. 연결을 시작하는 central과 값을 제공하는 GATT 서버는 서로 다른 기준의 역할이다.
2. 서비스 안에서 특성을 찾고, 값과 구독 설정을 별개의 항목으로 다룬다.
3. Read는 한 번의 요청이고 Notify는 구독한 클라이언트에 보내는 알림이다. Indicate의 수신 확인은 앱 저장까지 보장하지 않는다.
4. 특성 값의 버전과 길이를 확인한 뒤 명세대로 바이트 순서·부호·단위를 적용한다.
5. 빈 입력이나 모르는 버전은 `0 °C`가 아니다. 거절해야 이전 값이나 잘못된 숫자를 새 측정값처럼 표시하지 않는다.

🧠 기억할 것: ‘연결됐다’, ‘바이트를 받았다’, ‘온도를 안다’에는 각각 다른 증거가 필요하다.

## 7. 미니 퀴즈 또는 체크리스트

1. 휴대폰 A는 온도 알림을 받는다. 같은 기기에 연결한 B는 Read만 성공했다. 이것만으로 B의 알림도 켜졌다고 할 수 있을까?
2. 예제 형식에서 `01 2c 01`과 `01 83 ff`는 각각 몇 °C인가? 두 번째를 `654.11 °C`로 표시했다면 무엇을 빠뜨렸는가?
3. `02 83 ff`는 예제와 똑같이 3바이트다. 마지막 두 바이트만 변환해 표시해도 될까?
4. 서버가 Indicate의 수신 확인을 받았다. 앱이 그 측정값을 저장했다고 사용자에게 알려도 될까?

<details>
<summary>정답과 해설</summary>

1. 아니다. Read는 한 번의 읽기이고 CCCD는 클라이언트별 설정이다. B의 구독 결과를 별도로 확인한다.
2. 각각 `3.00 °C`, `-1.25 °C`다. `0xFF83`을 부호 없는 65,411로 읽으면 `654.11`이 된다. 부호 있는 16비트로 해석해야 한다.
3. 안 된다. `02`는 지원하지 않는 버전이다. 길이가 같아도 단위나 필드의 의미가 바뀌었을 수 있다.
4. 아니다. 확인은 클라이언트의 ATT 수신을 뜻한다. 저장 완료 여부는 저장을 담당한 앱에서 별도로 확인해야 한다.

</details>
