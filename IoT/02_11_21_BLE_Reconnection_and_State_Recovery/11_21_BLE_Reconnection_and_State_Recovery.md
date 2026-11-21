# BLE 재연결과 최신값 확인: 다시 연결된 것과 값을 확인한 것은 다르다

- 🎯 글의 목표: 연결이 끊겼다가 돌아왔을 때 구독을 복구하고, 이전 연결의 응답과 뒤늦은 초기 Read가 현재 값을 덮어쓰지 않도록 한다.
- 🧩 핵심 키워드: 연결 세대, 재구독, CCCD와 본딩, Read·Notify 경쟁, 마지막 확인값
- ⭐ 중요도: 높음. 온도 숫자가 화면에 남아 있어도 지금 연결에서 읽은 값인지는 별도로 확인해야 한다.
- 📝 한눈에 보는 내용: 끊기기 전 숫자를 표시만 보존 → 새 연결에서 대상과 구독 확인 → 첫 유효 값 반영 → 늦은 응답 무시
- 🔗 관련 주제: [BLE GATT로 센서 값 읽기](../01_11_19_BLE_GATT_and_Sensor_Data/11_19_BLE_GATT_and_Sensor_Data.md) · [IoT 학습 로드맵](../README.md)
- 🧱 선수 지식: Read가 한 번의 읽기이고 Notify가 서버의 알림이라는 구분, Python 함수와 조건문

> 기준일 2026-11-21 · Bluetooth Core 5.4와 Zephyr v4.2.0 공식 자료를 참고한다. 예제는 가상의 실내 온도계 하나를 위한 Python 3.12 화면 상태 모델이다. 장비·BLE 스택 없이 콜백 순서를 재현하며, 실제 재연결·구독·타이머·센서 정확도는 검증 범위가 아니다.

## 1. 들어가며

실내 온도계가 `22.5 °C`를 보낸 뒤 휴대폰이 통신 범위를 벗어났다. 다시 가까이 왔을 때 화면에 같은 온도가 보인다. 아직 이전 숫자를 보여 주는 걸까, 아니면 다시 확인했는데 온도가 같았던 걸까? 숫자만 보고는 답할 수 없다.

[앞 노트](../01_11_19_BLE_GATT_and_Sensor_Data/11_19_BLE_GATT_and_Sensor_Data.md)에서는 특성을 찾고 바이트를 온도로 해석했다. 이번에는 **어느 연결에서 받은 값인지**, **재연결 후 어떤 값이 처음 화면에 들어갈 수 있는지**를 다룬다. 가상의 온도계와 기존 v1 형식을 그대로 쓰므로 실제 제품의 통신 이력을 몰라도 실습할 수 있다.

## 2. 핵심 개념 정리

| 단계 | 화면에서 알고 있는 것 |
| --- | --- |
| 연결 끊김 | 숫자를 남기더라도 이전에 확인한 값이다. |
| 새 연결·구독 준비 | 다시 연결됐지만 현재 연결에서는 아직 값을 확인하지 않았다. |
| 첫 유효 Read 또는 Notify | 이번 연결에서 제공한 값을 확인했다. |
| 이후 새 Notify | 유효한 알림을 반영하고 더는 초기 Read로 덮지 않는다. |

이 흐름에서는 연결 성공, 구독 준비, 값 확인을 따로 다룬다. 특히 마지막 줄은 무선 통신 규칙이 아니라 이 예제의 **화면 갱신 정책**이다.

## 3. 본문 정리

### 3.1 새 연결에서는 무엇을 다시 확인할까?

연결이 끊어지면 앱은 이전 연결의 대기 중 읽기와 화면 갱신을 끝낸다. 마지막 숫자를 보존할 수는 있지만 `22.5 °C · 마지막 확인값`처럼 구분한다. 다시 연결한 뒤에는 선택한 기기와 특성이 맞는지, 알림을 받을 경로가 준비됐는지 확인한다. **콜백(callback)**은 비동기 동작이 끝났거나 값이 도착했을 때 라이브러리가 호출하는 함수다. 서버 쪽 구독 설정이 남아 있어도 앱이 받을 콜백을 유지했는지는 별개의 문제다.

앞 노트의 **CCCD(Client Characteristic Configuration Descriptor)**는 서버가 특정 클라이언트에 알림을 보낼지 저장하는 특성 설정이다. **본딩(bonding)**은 두 기기가 이후 연결에서도 사용할 보안 정보를 저장해 두는 것이다. 예제에서 휴대폰이 같은 온도계로 돌아왔다고 해도, 명세 기준 CCCD는 본딩 여부에 따라 아래처럼 다르다. [Bluetooth Core 5.4, GATT §3.3.3.3](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html) · [Security Manager §3.5.1](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/security-manager-specification.html)

| 상대와의 상태 | GATT 서버의 CCCD | 앱이 확인할 일 |
| --- | --- | --- |
| 본딩 유지 | 명세상 연결 사이에 값이 보존된다. 이전 값이 꺼짐이었다면 저절로 켜지지 않는다. | 알림 설정이 실제로 활성인지와 현재 콜백이 연결됐는지 확인한다. |
| 본딩 없음 | 연결마다 기본값 `0x0000`(꺼짐)으로 시작한다. | 앱 또는 사용하는 스택에서 현재 연결의 구독을 설정하고 결과를 확인한다. |

예를 들어 Zephyr v4.2.0의 GATT 클라이언트는 구독을 끊김 때 제거하는 플래그와 자동 재구독을 막는 플래그를 각각 제공한다. 따라서 **재구독은 ‘필요한 구독이 다시 동작하는 상태를 확인한다’는 뜻**이지 ‘항상 CCCD를 직접 새로 쓴다’는 뜻이 아니다. 또한 특성의 핸들(서버 속성 표에 있는 항목 번호)은 이전 값이 항상 유효하다고 가정하지 않는다. 플랫폼의 유효한 속성 캐시(앞서 찾은 항목 정보)를 사용하거나 필요하면 다시 발견한다. [Zephyr v4.2.0 GATT 헤더의 구독 플래그](https://raw.githubusercontent.com/zephyrproject-rtos/zephyr/v4.2.0/include/zephyr/bluetooth/gatt.h) · [Bluetooth Core 5.4, GATT §2.5](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html)

⚠️ 주의: 플랫폼 API가 호출을 접수한 시점과 구독이 준비된 시점을 섞으면 ‘재연결 성공’인데도 알림이 안 올 수 있다. 구독을 복구하지 못하면 값 확인 단계로 넘기지 않고, 실패를 표시해 연결을 정리한다. 이 노트는 실제 재시도 간격이나 권한 요청을 정하지 않는다.

### 3.2 이전 연결의 콜백을 가려내는 연결 세대

**연결 세대**는 앱이 연결을 새로 사용할 때마다 붙이는 번호다. 앱에서 만든 식별표이므로 Bluetooth 패킷에 넣는 번호도, 센서가 측정할 때 붙이는 순번도 아니다. 예를 들어 이전 연결의 Read 콜백에 세대 `1`을 저장해 두고, 재연결 후 활성 세대가 `2`라면 값이 올바른 온도로 해석되더라도 화면에 반영하지 않는다. 종료 알림에도 같은 조건을 적용해야 이전 연결의 늦은 종료가 새 연결을 끊긴 상태로 바꾸지 않는다.

콜백에는 만들 때의 번호를 고정한다. **콜백이 실행될 때 최신 번호를 다시 읽어 붙이면** 이전 연결의 응답이 새 연결인 것처럼 통과한다. 세대 검사는 자원 정리를 대신하지도 않는다. 실제 앱은 종료된 연결의 구독·콜백·타이머를 플랫폼에 맞게 정리하고, 이미 전달 대기 중인 결과에는 세대 검사까지 적용한다. 아래 모델은 한 온도계만 다루므로, 다른 기기를 선택한다면 별도 모델로 시작해 이전 기기의 마지막 온도를 섞지 않는다.

### 3.3 초기 읽기와 알림이 겹칠 때의 판단

가상 온도계는 마지막 측정값을 특성에 보관하고, 새 측정이 생기면 알림을 보낸다. 따라서 구독을 켰지만 새 측정 대기 시간이 길면 화면이 비어 있을 수 있다. 이때 현재 특성 값으로 화면의 첫 값을 채우기 위해 **구독 준비 직후 Read를 한 번** 요청한다. 앱은 수신 콜백을 구독 전에 등록하되, 이 예제는 구독 준비가 확인되기 전에 들어온 값을 표시하지 않는다. 이후 Read로 최신 저장값을 확인하는 대신, 준비 중 지나간 모든 변화까지 복원하지는 않는다. [Bluetooth Core 5.4, GATT §4.8.1·4.10](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html)

아래는 같은 연결에서 콜백이 화면에 도착하는 순서의 예다. 연결 세대 검사를 통과하더라도 초기 Read와 Notify의 역할이 같지는 않다.

| 앱에서 처리한 순서 | 이 예제에서의 결과 |
| --- | --- |
| 초기 Read `22.5` → 유효 Notify `23.0` | 처음에 `22.5`로 채운 뒤 `23.0`으로 갱신한다. |
| 유효 Notify `23.0` → 초기 Read `22.5` | `23.0`을 유지한다. 알림이 먼저 값을 채웠으므로 초기 읽기는 더 이상 화면에 쓸 필요가 없다. |
| 형식이 잘못된 Notify → 초기 Read `22.5` | 알림은 무시한다. 올바른 읽기 결과로 처음 값을 채운다. |
| 초기 Read 실패 또는 제한 시간 경과 → 유효 Notify `23.0` | 읽기는 종료하지만 구독은 유지한다. 알림이 올 때까지 이전 숫자는 마지막 확인값이다. |

⚠️ 주의: 마지막에 처리한 콜백이 센서에서 마지막으로 측정한 값을 담는다고 단정할 수 없다. v1에는 측정 시각이나 순번이 없다. **유효 Notify가 먼저 도착했다면 초기 Read를 무시한다**는 정책은 화면이 초기 읽기로 되돌아가는 것을 막을 뿐, 그 Read가 실제로 더 최근 측정값인지 판정하지 못한다. 여기서 ‘확인’은 **이번 연결에서 유효한 특성 값을 받음**이지, 센서가 방금 측정했거나 중간 측정을 빠짐없이 받았다는 뜻이 아니다.

### 3.4 노트 안에서 콜백 도착 순서 실습하기

아래는 **완성된 Python 대화형 예제**다. 외부 라이브러리 없이 처음부터 아래로 이어 실행한다. 실제 BLE 연결 코드는 아니다. 통신 결과를 화면 모델에 전달하는 코드가 한 실행 흐름에서 콜백을 하나씩 전달하고, 실제 새 연결이 성립했을 때만 `connected()`를 한 번 호출한다고 가정한다. 이 전달부가 [앞 노트 3.4의 온도 변환 함수](../01_11_19_BLE_GATT_and_Sensor_Data/11_19_BLE_GATT_and_Sensor_Data.md#34-python으로-형식-계약-검증하기)로 해석한 숫자, 또는 오류를 뜻하는 `None`을 넣는다. `0.0`도 정상 온도라서 `None`과 구별한다.

```pycon
>>> class TemperatureView:
...     def __init__(self):
...         self.epoch = 0  # 첫 연결부터 1로 번호를 붙인다.
...         self.phase = "offline"  # 지금 연결에서 확인한 값이 없는 시작 상태다.
...         self.last = None  # 아직 이전 연결의 값도 없다.
...         self.read_pending = False  # 초기 Read의 화면 반영 기회가 남았는지 나타낸다.
...
...     def connected(self):
...         self.epoch += 1  # 새 연결에 번호를 발급한다. 콜백은 아래 반환값을 기억한다.
...         self.phase = "subscribing"  # 연결 성공을 값 확인으로 표시하지 않는다.
...         self.read_pending = False  # 이전 연결의 초기 Read 기회를 넘겨주지 않는다.
...         return self.epoch
...
...     def subscribed(self, epoch):
...         if epoch != self.epoch or self.phase != "subscribing":  # 늦거나 중복된 완료를 거절한다.
...             return False
...         self.phase = "syncing"  # 이제 값을 받을 수 있지만 확인한 값은 아직 없다.
...         self.read_pending = True  # 호출자가 현재 연결의 초기 Read를 한 번만 요청하게 한다.
...         return True
...
...     def disconnected(self, epoch):
...         if epoch != self.epoch:  # 이전 연결의 종료가 새 화면을 끊어 놓으면 안 된다.
...             return
...         self.phase = "offline"  # last는 지우지 않되 더는 현재 연결의 값이 아니다.
...         self.read_pending = False  # 이 연결의 늦은 읽기 결과도 화면에 못 쓰게 한다.
...
...     def read_finished(self, epoch, celsius):
...         if epoch != self.epoch or not self.read_pending:  # 첫 값 채우기 기회가 끝났으면 무시한다.
...             return
...         self.read_pending = False  # 성공, 실패, 시간 초과 모두 초기 Read를 종료한다.
...         if celsius is not None:  # 실패라면 구독을 유지해 다음 알림을 기다린다.
...             self._confirm(celsius)
...
...     def notified(self, epoch, celsius):
...         if epoch != self.epoch or self.phase not in ("syncing", "confirmed"):  # 준비된 현재 구독만 받는다.
...             return
...         if celsius is None:  # 잘못된 알림은 무시하고, 진행 중인 Read에는 영향을 주지 않는다.
...             return
...         self.read_pending = False  # 실제 읽기를 취소하는 대신 그 결과가 화면에 쓰이지 않게 한다.
...         self._confirm(celsius)
...
...     def _confirm(self, celsius):
...         self.last = celsius  # 숫자가 직전과 같아도 이번 연결에서 받은 값으로 처리한다.
...         self.phase = "confirmed"  # 수신과 해석이 확인됐다는 뜻이며 센서 측정 시각은 모른다.

```

`subscribed()`가 `True`일 때만 전달부가 Read를 시작한다. 시작에 실패하거나 기다릴 시간을 넘겼다면 같은 세대로 `read_finished(epoch, None)`을 호출한다. `read_pending`이 꺼졌다는 것은 **이제 화면에서 그 결과를 사용하지 않는다**는 뜻이다. 실제 무선 요청을 자동으로 취소했다는 뜻은 아니다. 구독 준비에 실패하면 전달부가 해당 연결을 닫고 종료를 이 모델에 알린다.

첫 실습에서는 온도가 같더라도 표시 상태가 달라지는지, 이전 연결의 종료와 Read가 새 연결에 영향을 주지 않는지 확인한다.

```pycon
>>> view = TemperatureView()
>>> first = view.connected()  # 이 연결의 모든 콜백에는 first를 전달한다.
>>> view.subscribed(first)  # 초기 Read를 요청할 수 있다.
True
>>> view.read_finished(first, 22.5)  # 첫 연결은 읽기 응답으로 값을 확인한다.
>>> view.disconnected(first)
>>> view.phase, view.last
('offline', 22.5)
>>> second = view.connected()  # 같은 기기라도 새로운 세대다.
>>> view.notified(second, 99.0)  # 구독 준비 전의 값은 이 모델에서 표시하지 않는다.
>>> view.subscribed(second)
True
>>> view.subscribed(second)  # 중복 콜백으로 초기 읽기를 하나 더 시작하지 않는다.
False
>>> view.disconnected(first)  # 이전 연결의 종료 알림이 늦게 왔다.
>>> view.read_finished(first, -10.0)  # 현재 연결의 초기 Read 기회를 소모하지 않는다.
>>> view.phase, view.last, view.read_pending
('syncing', 22.5, True)
>>> view.notified(second, 22.5)  # 숫자는 같지만 지금 연결의 첫 유효 값이다.
>>> view.read_finished(second, 21.0)  # 초기 읽기가 늦어도 알림에서 확인한 값을 유지한다.
>>> view.notified(first, 50.0)  # 현재 확인 후에도 이전 연결 알림을 반영하지 않는다.
>>> view.phase, view.last, view.read_pending
('confirmed', 22.5, False)

```

두 번째 실습은 무효 알림과 Read 제한 시간의 차이를 확인한다. 무효 알림은 읽기 기회를 남겨야 하고, 제한 시간을 넘긴 읽기는 그 결과가 나중에 와도 쓰지 않아야 한다.

```pycon
>>> third = view.connected()
>>> view.subscribed(third)
True
>>> view.notified(third, None)  # 해석할 수 없는 알림은 초기 읽기를 막지 않는다.
>>> view.read_finished(third, 23.0)
>>> view.phase, view.last
('confirmed', 23.0)
>>> view.notified(third, 23.5)  # 초기 읽기로 화면을 채웠어도 이후 알림은 계속 반영한다.
>>> view.phase, view.last
('confirmed', 23.5)
>>> fourth = view.connected()
>>> view.subscribed(fourth)
True
>>> view.read_finished(fourth, None)  # 제한 시간 경과를 전달부가 알렸다고 가정한다.
>>> view.read_finished(fourth, 99.0)  # 제한 시간 후 받은 초기 읽기는 반영하지 않는다.
>>> view.phase, view.last, view.read_pending
('syncing', 23.5, False)
>>> view.notified(fourth, 0.0)  # 0 °C는 실패가 아니라 새 연결에서 확인한 온도다.
>>> view.phase, view.last
('confirmed', 0.0)
>>> view.disconnected(fourth)
>>> view.notified(fourth, 99.0)  # 세대가 같아도 이미 끊긴 연결의 알림은 거절한다.
>>> view.phase, view.last
('offline', 0.0)

```

저장소 루트에서 [Python `doctest`](https://docs.python.org/3.12/library/doctest.html#command-line-usage)를 실행한다. 성공하면 문서 속 명령과 예상 결과가 모두 일치하고 마지막에 `Test passed.`가 나온다. Python 3.12.12에서 예제를 실행해 이전 연결의 종료·응답, 유효 알림과 초기 읽기의 도착 순서, 읽기 제한 시간 뒤의 값 반영 여부를 확인했다. 실제 BLE 신호 손실, 운영체제의 이벤트 전달, 두 스레드의 동시 실행은 재현하지 않는다.

```powershell
python -X utf8 -m doctest -v IoT/02_11_21_BLE_Reconnection_and_State_Recovery/11_21_BLE_Reconnection_and_State_Recovery.md
```

## 4. 적용 관점에서 다시 보기

| 증상 | 먼저 확인할 질문 |
| --- | --- |
| 다시 연결됐는데 예전 온도만 보인다 | 구독이 준비됐는가? 현재 연결의 첫 유효 값이 들어왔는가? |
| 새 연결이 성공한 뒤 갑자기 화면이 끊긴 상태가 된다 | 종료 콜백의 세대가 현재 연결의 세대와 같은가? |
| 새 값이 잠깐 보였다가 이전 숫자로 돌아간다 | 유효 알림 이후에도 초기 Read가 화면을 갱신하고 있는가? |
| 온도는 그대로인데 정상 복구인지 모르겠다 | 숫자가 바뀌었는지가 아니라 화면 상태가 `confirmed`로 바뀌었는지 확인한다. |

진단은 연결 → 구독 → 값 순서로 좁힌다. 이미 수신한 값의 순서 문제라면, 같은 연결인지와 초기 읽기에 여전히 화면을 채울 권한이 있는지를 따로 보면 된다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

재연결 후 구독을 확인하는 일과 유효한 첫 값을 확인하는 일은 다르다. 연결 세대는 어느 연결의 응답인지 가릴 뿐이며, 같은 연결 안에서 읽기와 알림이 겹칠 때는 별도의 갱신 정책이 필요하다.

### 5.2 이전·다음 학습과의 연결

[앞 노트](../01_11_19_BLE_GATT_and_Sensor_Data/11_19_BLE_GATT_and_Sensor_Data.md)의 바이트 해석은 그대로 두고, 결과를 화면에 반영할 조건을 이번에 추가했다. 다음 학습 후보는 **센서 측정 순번과 재부팅 경계**다. 앱에 도착한 순서가 아니라 센서가 만든 순서로 두 값을 비교하는 문제로 이어진다.

### 5.3 더 파볼 만한 주제

연결은 끊기지 않았는데 센서가 값을 오랫동안 보내지 않는다면, 무엇을 기준으로 마지막 확인값 표시로 되돌릴까? 화면에서 확인한 시각과 센서가 실제로 측정한 시각은 언제 달라질 수 있을까?

### 5.4 참고 자료

- [Bluetooth SIG · Core 5.4, Vol. 3 Part G: GATT](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html) — §2.5 캐시, §3.3.3.3 CCCD, §4.8.1·§4.10의 Read와 Notify를 확인한다.
- [Bluetooth SIG · Core 5.4, Vol. 3 Part H: Security Manager](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/security-manager-specification.html) — §3.5.1에서 본딩 요청과 비본딩 요청을 구분한다.
- [Zephyr v4.2.0 · GATT 헤더](https://raw.githubusercontent.com/zephyrproject-rtos/zephyr/v4.2.0/include/zephyr/bluetooth/gatt.h) — `bt_gatt_sub_flag`에서 구독 제거와 자동 재구독 설정의 차이를 확인한다.
- [Python 3.12 · doctest 명령줄](https://docs.python.org/3.12/library/doctest.html#command-line-usage) — Markdown 안의 대화형 예제와 예상 결과를 함께 검사한다.

## 6. 요약 정리

1. 끊기기 전의 온도는 남겨도 되지만 현재 연결의 값으로 표시하지 않는다.
2. 재연결 후 대상 특성과 구독 준비 상태를 확인하고, 연결 성공만으로 값이 갱신됐다고 보지 않는다.
3. 콜백을 등록할 때 연결 세대를 기억해 예전 Read·Notify·종료 신호를 걸러 낸다.
4. 초기 Read는 빈 화면을 채우는 용도다. 유효 Notify가 먼저 값을 채우면 그 읽기로 덮어쓰지 않는다.
5. 새 연결에서 같은 숫자를 받는 것도 재확인이다. 반대로 재확인 자체가 새 측정이나 이력 복원을 보장하지는 않는다.

🧠 기억할 것: 숫자가 바뀌었는지가 아니라, 어느 연결에서 어떤 값을 확인했는지가 중요하다.

## 7. 미니 퀴즈 또는 체크리스트

1. 본딩된 온도계의 CCCD가 이전 연결에서 켜져 있었다. 재연결 직후 화면을 바로 ‘이번 연결에서 확인한 값’으로 바꿔도 될까?
2. 현재 세대는 `2`인데 세대 `1`의 종료 콜백이 왔다. 값이 없는 이벤트라도 왜 무시하는가?
3. 같은 연결에서 무효 알림 → Read `22.5` → 유효 알림 `23.0` 순으로 처리됐다. 화면 값은 어떻게 변하는가?
4. Notify `23.0`을 표시한 뒤 초기 Read `24.0`이 왔다. 이 예제는 무엇을 표시하고, 왜 `24.0`이 더 오래된 측정이라고는 말할 수 없는가?

<details>
<summary>정답과 해설</summary>

1. 안 된다. 설정이 서버에 남을 수 있지만 현재 수신 경로를 확인해야 한다. 유효한 Read 또는 Notify를 받아야 이번 연결에서 확인한 값이다.
2. 종료 이벤트도 화면 상태를 바꾸기 때문이다. 무시하지 않으면 이전 연결의 이벤트가 현재 연결을 끊긴 것처럼 표시한다.
3. 무효 알림은 반영하지 않고 Read에서 `22.5`로 채운 뒤 Notify의 `23.0`으로 바꾼다.
4. `23.0`을 유지한다. 초기 Read가 화면을 채울 기회는 이미 끝났다. 그러나 v1에는 순번과 시각이 없어 어떤 값이 센서에서 먼저 만들어졌는지는 알 수 없다.

</details>
