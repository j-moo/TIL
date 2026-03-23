# 신경망과 MLP, PyTorch 학습 흐름 통합 강의노트

- 🎯 글의 목표: 선형 분류기의 한계에서 출발해, PyTorch의 텐서·자동 미분·모델 구성요소·데이터 파이프라인을 이해하고, Perceptron과 MLP를 직접 구현해 학습·평가·시각화까지 이어지는 전체 흐름을 한 번에 정리한다.
- 🧩 핵심 키워드: 선형분류기, XOR, Neural Network, Tensor, Autograd, nn.Module, nn.Linear, Activation Function, Sequential, Dataset, DataLoader, Perceptron, MLP, CrossEntropyLoss, Optimizer, Early Stopping, Checkpoint, Decision Boundary, GPU
- ⭐ 중요도: 매우 높음
- 📝 한눈에 보는 내용: 왜 선형 모델만으로는 부족한지, PyTorch가 NumPy와 어떻게 다른지, 자동 미분이 학습과 어떻게 연결되는지, 데이터는 어떤 구조로 모델에 들어가는지, MLP는 어떤 코드 패턴으로 구현되는지, 그리고 학습 루프를 어떻게 안정적으로 작성하는지를 하나의 문서 흐름으로 묶었다.
- 🔗 관련 문제 / 주제(있다면): 간단한 Perceptron 구현, MLP 구현, MNIST 숫자 분류, Digits 데이터셋 분류, make_moons 결정 경계 시각화

---

## 1. 들어가며

이번 묶음의 강의는 단순히 “PyTorch 문법을 배운다”에서 끝나지 않는다. 출발점은 더 앞에 있다. 먼저 선형 분류기가 어디까지 할 수 있는지 보고, 그 한계를 넘어가기 위해 왜 신경망이 필요한지 이해한 뒤, 그 신경망을 실제 코드로 다루기 위해 PyTorch의 핵심 도구들을 하나씩 익히는 흐름이다.

여기서 중요한 점은, 각 개념이 따로 떨어져 있지 않다는 점이다. 텐서를 배우는 이유는 연산을 하기 위해서이고, `autograd`를 배우는 이유는 손실을 기준으로 파라미터를 업데이트하기 위해서다. `nn.Module`을 배우는 이유는 모델을 깔끔하게 정의하고 관리하기 위해서이며, `Dataset`과 `DataLoader`를 배우는 이유는 학습 데이터를 배치 단위로 안정적으로 흘려보내기 위해서다. 결국 이 모든 조각은 하나의 학습 파이프라인으로 연결된다.

쉽게 말하면, 이번 강의의 핵심 질문은 이것이다.

> **데이터를 모델에 넣고, 손실을 계산하고, 기울기로 가중치를 업데이트해서, 더 잘 분류하는 신경망을 어떻게 구현할 것인가?**

이 질문을 끝까지 따라가면, 단순한 Perceptron부터 MLP, 그리고 실제 분류 문제에서의 학습 루프·평가·시각화까지 자연스럽게 이어진다.

## 2. 핵심 개념 정리

이번 강의 전체 흐름은 아래 다섯 단계로 이해하면 가장 자연스럽다.

### 2-1. 선형 분류기에서 신경망으로 넘어가는 이유

선형 분류기는 입력 공간에 직선이나 평면 하나를 그어 클래스를 나눈다. 데이터가 단순하면 잘 맞지만, XOR처럼 직선 하나로 분리되지 않는 문제에서는 한계가 분명하다. 이 지점에서 “함수를 중첩하고, 활성화 함수를 넣어 비선형성을 만들자”는 아이디어가 신경망으로 이어진다.

### 2-2. PyTorch의 기본 재료: Tensor와 Autograd

신경망 학습은 결국 행렬 연산과 미분의 반복이다. Tensor는 그 계산을 담는 자료형이고, `autograd`는 계산 그래프를 추적해 역전파를 자동으로 수행한다. NumPy와 비슷하게 보이지만, GPU 사용과 자동 미분 지원이 결정적인 차이다.

### 2-3. 모델의 뼈대: `nn.Module`, 레이어, 활성화 함수, `nn.Sequential`

모델은 단순한 함수가 아니라, 학습해야 할 파라미터를 가진 구조다. PyTorch에서는 이를 `nn.Module`로 표현한다. `nn.Linear`로 선형 변환을 만들고, `ReLU`, `Sigmoid`, `Tanh` 같은 활성화 함수로 비선형성을 넣고, 필요하면 `Dropout`으로 규제를 더한다. 여러 층을 쌓으면 MLP가 된다.

### 2-4. 데이터 파이프라인: `Dataset`과 `DataLoader`

현실의 학습은 전체 데이터를 한 번에 던지는 방식보다, 배치 단위로 나누어 반복 처리하는 방식이 훨씬 일반적이다. 그래서 PyTorch에서는 데이터를 추상화하는 `Dataset`과, 그것을 배치·셔플·반복 가능한 형태로 만들어 주는 `DataLoader`가 매우 중요하다.

### 2-5. 학습 루프와 평가 루프

학습은 보통 다음 순서로 반복된다.

1. 배치 데이터를 가져온다.
2. 모델에 넣어 출력값을 만든다.
3. 손실을 계산한다.
4. `backward()`로 기울기를 구한다.
5. `optimizer.step()`으로 파라미터를 갱신한다.
6. 검증 데이터로 성능을 점검한다.

이 흐름을 정확히 이해하면, Digits 같은 다중 분류 문제도 풀 수 있고, make_moons 같은 2차원 데이터에서는 결정 경계를 직접 그려 모델이 무엇을 배웠는지 눈으로 확인할 수 있다.

---

## 3. 본문 정리

이제부터는 개념이 등장하는 자리에서 바로 예시와 코드가 이어지도록, 실제 강의 흐름에 맞춰 정리해보자.

### 3.1 선형 분류기의 한계와 신경망의 출발점

선형 분류기는 입력과 출력 사이를 하나의 선형식으로 연결한다.

\[
 y = Wx + b
\]

한 줄로 쓰면 단순해 보이지만, 이 식은 굉장히 중요한 의미를 가진다. 입력 `x`에 가중치 `W`를 곱하고 편향 `b`를 더해 점수를 만드는 구조이기 때문이다. 이 방식은 직선이나 평면 하나로 구분 가능한 문제에서는 강력하다.

문제는 모든 데이터가 그렇게 예쁘게 나뉘지 않는다는 데 있다. 대표적인 예가 XOR이다. XOR는 두 입력이 다를 때만 1이 되는 문제인데, 직선 하나로는 두 클래스를 분리할 수 없다. 이 지점에서 단일 선형식의 한계가 드러난다.

💡 포인트: **선형 레이어를 여러 개 쌓기만 해서는 여전히 선형식 하나로 축약된다.** 그래서 중간에 활성화 함수가 꼭 필요하다.

쉽게 말하면, 신경망이 필요한 이유는 “선을 더 많이 긋기 위해서”가 아니라, **직선 하나로 표현할 수 없는 모양을 학습하기 위해서**다. 함수의 중첩과 활성화 함수가 들어가야 결정 경계가 휘어질 수 있다.

⚠️ 주의: “레이어를 많이 쌓으면 자동으로 복잡한 문제가 풀린다”라고 생각하기 쉽지만, 활성화 함수가 없다면 선형 변환의 반복일 뿐이다. 비선형성의 핵심은 층의 개수만이 아니라, **활성화 함수의 존재**다.

📌 핵심: **신경망은 선형 변환을 여러 번 쌓는 구조가 아니라, 선형 변환 사이에 비선형 함수를 넣어 복잡한 패턴을 표현하는 구조다.**

### 3.2 Tensor: PyTorch에서 계산이 흘러가는 기본 단위

Tensor는 PyTorch의 기본 자료형이다. 겉모습은 NumPy의 ndarray와 비슷하지만, 실제 학습에서는 두 가지 차이가 크다.

첫째, GPU 가속을 사용할 수 있다. 둘째, 자동 미분을 위한 계산 그래프를 추적할 수 있다. 이 두 기능 때문에 PyTorch는 단순한 수치 계산 도구가 아니라 딥러닝 프레임워크가 된다.

아래 코드는 텐서의 가장 기본적인 사용 예시다.

```python
import torch

# 1차원 텐서: 벡터처럼 생각하면 된다.
a = torch.tensor([1.0, 2.0, 3.0])

# 2차원 텐서: 행렬처럼 생각하면 된다.
b = torch.tensor([[1.0, 2.0, 3.0],
                  [4.0, 5.0, 6.0]])

print(a)
print(b)
print(a.shape)   # 크기 확인
print(b.dtype)   # 자료형 확인
```

여기서 중요한 점은, 모델의 입력도 텐서이고 가중치도 텐서이며 출력도 텐서라는 점이다. 즉, 학습 과정 전체가 텐서 위에서 움직인다.

또 하나 자주 나오는 개념이 NumPy와의 변환이다.

```python
import numpy as np
import torch

# NumPy 배열 생성
numpy_array = np.array([1, 2, 3])

# NumPy -> Tensor
x_tensor = torch.from_numpy(numpy_array)

# Tensor -> NumPy
x_numpy = x_tensor.numpy()

print(numpy_array)
print(x_tensor)
print(x_numpy)
```

이 변환은 편리하지만, 기본적으로 **메모리를 공유**할 수 있다는 점을 알아두어야 한다. 한쪽을 바꾸면 다른 쪽도 함께 바뀔 수 있다. 독립 복사가 필요하면 `.clone()`이나 `np.copy()`를 고려해야 한다.

⚠️ 주의: `torch.from_numpy()`로 만든 텐서는 원본 NumPy 배열과 메모리를 공유할 수 있다. “값만 복사된 줄 알았는데 같이 바뀐다”는 실수가 자주 나온다.

📌 핵심: **Tensor는 단순한 배열이 아니라, 신경망 계산과 학습을 위한 기본 단위다.**

### 3.3 Autograd: 역전파를 직접 미분하지 않게 해주는 장치

딥러닝 학습의 핵심은 손실을 줄이는 방향으로 파라미터를 업데이트하는 것이다. 그러려면 손실을 가중치로 미분한 기울기가 필요하다. PyTorch의 `autograd`는 이 미분 과정을 자동으로 처리한다.

아래 예시는 가장 간단한 자동 미분 흐름이다.

```python
import torch

# 미분을 추적할 텐서는 requires_grad=True로 만든다.
x = torch.tensor(2.0, requires_grad=True)

# x를 이용해 어떤 계산을 수행한다.
y = x**2 + 3*x + 1

# 스칼라 출력에 대해 backward()를 호출하면,
# PyTorch가 계산 그래프를 따라가며 dy/dx를 구한다.
y.backward()

print(x.grad)  # 결과: 7.0
```

왜 7이 나올까? 수학적으로는 간단하다.

\[
\frac{d}{dx}(x^2 + 3x + 1) = 2x + 3
\]

`x=2`이므로 결과는 7이다. 중요한 건, 이 미분을 우리가 직접 코드로 짜지 않았다는 점이다. PyTorch가 순전파 과정에서 계산 그래프를 기록해 두었다가, `backward()` 시점에 연쇄 법칙으로 기울기를 계산해준다.

이 개념은 곧바로 학습 코드와 연결된다. 손실 함수도 결국 스칼라 값이므로 `loss.backward()`를 호출하면, 모델 파라미터의 `.grad` 속성에 기울기가 채워진다.

아래는 선형 회귀 형태의 아주 작은 예시다.

```python
import torch

# 학습해야 할 파라미터
weight = torch.tensor([[3.0]], requires_grad=True)
bias   = torch.tensor([[1.0]], requires_grad=True)

# 입력과 정답
x = torch.tensor([[2.0]])
y_true = torch.tensor([[4.0]])

# 순전파: 예측값 만들기
# 2 * 3 + 1 = 7 이므로 현재 예측은 정답보다 크다.
y_pred = x @ weight + bias

# 손실 계산: 평균제곱오차(MSE)
loss = torch.mean((y_pred - y_true) ** 2)

# 역전파: loss를 기준으로 weight, bias의 기울기 계산
loss.backward()

print(weight.grad)
print(bias.grad)
```

이제 기울기를 이용해 파라미터를 갱신할 수 있다.

```python
with torch.no_grad():
    # 미분 추적을 잠시 끄고 파라미터를 직접 갱신한다.
    weight -= 0.1 * weight.grad
    bias   -= 0.1 * bias.grad

    # grad는 누적되므로, 다음 스텝 전에 반드시 초기화한다.
    weight.grad.zero_()
    bias.grad.zero_()
```

여기서 중요한 점은, `.grad`가 자동으로 덮어써지는 것이 아니라 **누적**된다는 사실이다. 그래서 학습 루프에서는 `optimizer.zero_grad()`가 항상 먼저 등장한다.

또 하나 꼭 알아둘 도구가 `torch.no_grad()`다. 추론이나 파라미터 수동 갱신처럼 기울기가 필요 없는 구간에서는 계산 그래프를 만들지 않도록 이 컨텍스트를 사용한다.

⚠️ 주의:
- `requires_grad=True`가 없는 텐서는 기울기를 추적하지 않는다.
- `backward()`를 여러 번 호출하면 `.grad`가 누적된다.
- 평가 단계에서 `torch.no_grad()`를 빼면 불필요한 메모리를 사용하게 된다.

📌 핵심: **Autograd는 손실에서 파라미터까지의 미분 경로를 자동으로 계산해, 역전파를 코드 몇 줄로 가능하게 만든다.**

### 3.4 `nn.Module`: 신경망을 “모델답게” 정의하는 방식

작은 예제에서는 텐서를 직접 만들고 업데이트해도 되지만, 레이어가 여러 개가 되면 파라미터가 금방 복잡해진다. 그래서 PyTorch는 모델을 `nn.Module`로 정의하도록 설계되어 있다.

`nn.Module`을 쓰면 다음 이점이 생긴다.

- 파라미터가 자동 등록된다.
- `model.parameters()`로 옵티마이저에 넘길 수 있다.
- `model.train()` / `model.eval()` 같은 모드를 명확히 전환할 수 있다.
- `state_dict()`로 저장과 로드가 쉬워진다.

아래는 가장 단순한 사용자 정의 모델 예시다.

```python
import torch
import torch.nn as nn

class MyModel(nn.Module):
    def __init__(self):
        super().__init__()

        # 입력 784차원을 256차원으로 바꾸는 선형 레이어
        self.layer1 = nn.Linear(784, 256)

        # 256차원을 10차원으로 바꾸는 출력 레이어
        self.layer2 = nn.Linear(256, 10)

    def forward(self, x):
        # forward는 입력이 들어왔을 때 데이터가 어떻게 흐르는지 정의하는 부분이다.
        x = self.layer1(x)
        x = torch.relu(x)
        x = self.layer2(x)
        return x

model = MyModel()
print(model)
```

여기서 `forward()`는 “이 모델이 입력을 받아 어떤 순서로 계산할 것인가”를 표현한다. 실제 사용할 때는 `model(x)`처럼 호출하면 내부적으로 `forward()`가 실행된다.

💡 포인트: 객체에 `()`를 붙여 호출하면 PyTorch가 내부적으로 `forward()`를 연결해준다. 그래서 모델은 함수처럼 보이지만, 실제로는 상태와 파라미터를 가진 객체다.

📌 핵심: **`nn.Module`은 모델의 구조와 파라미터를 함께 관리하는 기본 단위다.**

### 3.5 `nn.Linear`와 활성화 함수: 선형식을 층으로 만들기

`nn.Linear`는 신경망에서 가장 기본이 되는 레이어다. 수식으로는 다음과 같다.

\[
 y = Wx + b
\]

딥러닝에서는 보통 기울기와 절편 대신 `weight`, `bias`라는 용어를 쓴다. 의미는 같지만, 학습 가능한 파라미터라는 점을 더 강조하는 표현이라고 이해하면 된다.

입력이 여러 개인 경우도 본질은 같다.

\[
 y = w_1x_1 + w_2x_2 + \cdots + b
\]

문제는, 이 선형식만으로는 표현력이 부족하다는 점이다. 그래서 중간에 활성화 함수를 넣는다.

대표적인 활성화 함수는 다음과 같다.

- `ReLU`: 음수는 0으로, 양수는 그대로 보낸다.
- `Sigmoid`: 값을 0~1 사이로 압축한다.
- `Tanh`: 값을 -1~1 사이로 압축한다.

간단한 비교 코드는 아래와 같다.

```python
import torch
import torch.nn as nn

x = torch.tensor([-2.0, -1.0, 0.0, 1.0, 2.0])

relu = nn.ReLU()
sigmoid = nn.Sigmoid()
tanh = nn.Tanh()

print("ReLU   :", relu(x))
print("Sigmoid:", sigmoid(x))
print("Tanh   :", tanh(x))
```

ReLU가 많이 쓰이는 이유는 계산이 단순하고, 깊은 네트워크에서도 비교적 안정적으로 학습되는 경우가 많기 때문이다. 물론 모든 문제에 무조건 ReLU가 정답은 아니지만, MLP의 기본 출발점으로는 매우 자주 등장한다.

⚠️ 주의: 다중 분류의 마지막 출력층 뒤에 바로 `Softmax`를 수동으로 붙이는 습관은 조심해야 한다. `CrossEntropyLoss`는 내부적으로 softmax를 포함한 형태로 동작하므로, 보통 마지막 레이어는 점수(logits)만 출력하게 둔다.

📌 핵심: **`nn.Linear`는 선형 변환을 만들고, 활성화 함수는 그 사이에 비선형성을 넣어 신경망의 표현력을 키운다.**

### 3.6 `nn.Sequential`과 MLP: 여러 층을 자연스럽게 쌓기

레이어가 조금만 많아져도 `forward()`에서 하나씩 호출하는 코드가 길어진다. 이때 `nn.Sequential`을 쓰면 순차적인 구조를 훨씬 간결하게 표현할 수 있다.

아래는 가장 단순한 MLP 예시다.

```python
import torch
import torch.nn as nn

class SimpleMLP(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()

        # 직접 레이어를 하나씩 정의하는 방식
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_dim, output_dim)

    def forward(self, x):
        x = self.fc1(x)
        x = self.relu(x)
        x = self.fc2(x)
        return x


class SequentialMLP(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()

        # 순차 구조를 한 번에 묶는 방식
        self.layers = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, output_dim)
        )

    def forward(self, x):
        return self.layers(x)
```

두 모델은 아이디어가 같다. 입력을 첫 번째 선형층에 넣고, ReLU를 거쳐, 마지막 선형층으로 보낸다. 다만 `nn.Sequential`은 “앞에서 뒤로 순서대로 흐르는 구조”를 표현할 때 특히 편하다.

좀 더 일반적인 MLP는 은닉층의 개수를 리스트처럼 받아 유연하게 구성할 수 있다.

```python
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self, input_dim, num_classes, hidden_dims=(128, 64), dropout=0.2):
        super().__init__()

        layers = []
        previous_dim = input_dim

        # hidden_dims를 순회하면서 [Linear -> ReLU -> Dropout] 블록을 반복한다.
        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(previous_dim, hidden_dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            previous_dim = hidden_dim

        # 마지막에는 클래스 수만큼 점수를 출력하는 레이어를 붙인다.
        layers.append(nn.Linear(previous_dim, num_classes))

        self.network = nn.Sequential(*layers)

    def forward(self, input_tensor):
        return self.network(input_tensor)
```

이 구조가 중요한 이유는, 실제 프로젝트에서 은닉층 개수나 크기가 자주 바뀌기 때문이다. `hidden_dims=(256, 128, 64)`처럼 바꾸면 구조를 쉽게 확장할 수 있다.

또 여기서 `Dropout`이 함께 등장한다. 드롭아웃은 학습 중 일부 뉴런을 무작위로 꺼 과적합을 줄이려는 정규화 기법이다.

⚠️ 주의:
- `Dropout`은 학습 모드(`train`)에서만 작동한다.
- 평가 모드(`eval`)로 전환하지 않으면 검증이나 테스트에서도 드롭아웃이 켜진 채로 남아 결과가 흔들릴 수 있다.

📌 핵심: **MLP는 여러 개의 선형층과 활성화 함수, 필요하면 드롭아웃을 순차적으로 쌓아 만드는 가장 기본적인 다층 신경망이다.**

### 3.7 Dataset과 DataLoader: 데이터를 학습 가능한 흐름으로 바꾸기

모델이 준비되었다고 해서 바로 학습이 되는 것은 아니다. 데이터를 모델이 이해할 수 있는 방식으로 묶고, 배치 단위로 나누고, 필요하면 섞어 주는 과정이 필요하다.

먼저 `TensorDataset`은 가장 간단한 형태의 데이터셋이다.

```python
import torch
from torch.utils.data import TensorDataset

# 입력 X와 정답 y를 텐서로 준비한다.
X = torch.tensor([[1, 2],
                  [3, 4],
                  [5, 6],
                  [7, 8]], dtype=torch.float32)

y = torch.tensor([0, 1, 0, 1], dtype=torch.long)

# 두 텐서를 하나의 데이터셋으로 묶는다.
dataset = TensorDataset(X, y)

print(len(dataset))
print(dataset[0])
```

직접 클래스를 만들 수도 있다. 이때는 `__len__`과 `__getitem__`만 구현하면 된다.

```python
import torch
from torch.utils.data import Dataset

class MyDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.long)

    def __len__(self):
        # 전체 샘플 수를 반환한다.
        return len(self.X)

    def __getitem__(self, idx):
        # idx번째 샘플과 라벨을 반환한다.
        return self.X[idx], self.y[idx]
```

그 다음 `DataLoader`가 이 데이터셋을 학습용 흐름으로 바꾼다.

```python
from torch.utils.data import DataLoader

loader = DataLoader(dataset, batch_size=2, shuffle=True)

for xb, yb in loader:
    print("입력 배치 shape:", xb.shape)
    print("라벨 배치 shape:", yb.shape)
    print(yb)
```

여기서 `batch_size=2`는 한 번에 두 개 샘플씩 모델에 넣겠다는 뜻이고, `shuffle=True`는 매 epoch마다 데이터를 무작위로 섞겠다는 의미다.

쉽게 말하면, `Dataset`은 “데이터를 꺼내는 규칙”이고, `DataLoader`는 “그 데이터를 학습 루프에 맞게 배치로 전달하는 도구”다.

강의에서 DataLoader의 필요성을 설명할 때 “고등어만 100마리 연속으로 보고 갈치를 나중에 본다면 특징을 잘못 잡을 수 있다”는 비유가 나왔는데, 바로 이런 맥락이다. 데이터를 섞어 가며 배치로 학습하면, 모델이 클래스 간 차이를 더 안정적으로 배울 수 있다.

⚠️ 주의:
- 분류 문제의 타깃은 보통 `torch.long`이어야 `CrossEntropyLoss`와 잘 맞는다.
- 학습용 로더는 보통 `shuffle=True`, 검증/테스트는 `shuffle=False`가 자연스럽다.

📌 핵심: **`Dataset`이 데이터를 정의하고, `DataLoader`가 그 데이터를 배치·셔플·반복 가능한 학습 입력으로 바꾼다.**

### 3.8 전처리와 분할: 모델보다 먼저 잡아야 하는 학습 습관

실제 분류 실습에서는 데이터 분할과 표준화가 거의 항상 함께 등장한다. Digits 데이터셋 실습도 그 흐름을 따른다.

```python
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# 1. 데이터 로드
# digits.data는 (샘플 수, 64) 형태이며,
# 8x8 이미지를 펼친 64개 특성으로 생각하면 된다.
digits_dataset = load_digits()
features = digits_dataset.data
target = digits_dataset.target

# 2. 학습/테스트 분할
features_train, features_test, target_train, target_test = train_test_split(
    features,
    target,
    test_size=0.2,
    random_state=42,
    stratify=target
)

# 3. 학습 데이터 기준으로 표준화
scaler = StandardScaler()
features_train_scaled = scaler.fit_transform(features_train)
features_test_scaled = scaler.transform(features_test)
```

여기서 중요한 점은, **스케일러를 학습 데이터에만 `fit`하고 테스트 데이터에는 `transform`만 한다는 점**이다. 이것은 이전 강의의 데이터 누수 방지 원칙과 정확히 같은 맥락이다.

그다음 NumPy 배열을 텐서로 바꾸고 DataLoader를 만든다.

```python
import torch
from torch.utils.data import TensorDataset, DataLoader

features_train_tensor = torch.from_numpy(features_train_scaled).float()
target_train_tensor = torch.from_numpy(target_train).long()
features_test_tensor = torch.from_numpy(features_test_scaled).float()
target_test_tensor = torch.from_numpy(target_test).long()

train_dataset = TensorDataset(features_train_tensor, target_train_tensor)
test_dataset = TensorDataset(features_test_tensor, target_test_tensor)

train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
validation_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
```

💡 포인트: 신경망 공부를 하다 보면 모델 구조에만 시선이 쏠리기 쉽다. 하지만 실제 성능은 데이터 분할, 전처리, 배치 구성 같은 기본기에 크게 좌우된다.

📌 핵심: **좋은 학습 루프는 모델 코드보다 먼저, 올바른 데이터 분할과 전처리에서 시작된다.**

### 3.9 손실 함수와 옵티마이저: 무엇을 줄이고, 어떻게 움직일 것인가

모델이 출력한 값이 있으면, 이제 그것이 정답과 얼마나 다른지를 측정해야 한다. 그 역할이 손실 함수다.

다중 분류에서는 보통 `CrossEntropyLoss`를 사용한다.

```python
import torch.nn as nn
import torch.optim as optim

cross_entropy = nn.CrossEntropyLoss()
optimizer = optim.Adam(mlp_model.parameters(), lr=1e-3, weight_decay=1e-4)
```

여기서 `Adam`은 학습률을 적절히 조절해 주는 대표적인 옵티마이저이며, `weight_decay`는 L2 규제 효과를 주는 옵션으로 이해하면 된다.

왜 마지막 출력층에서 `Softmax`를 직접 넣지 않았는지도 여기서 함께 이해할 수 있다. `CrossEntropyLoss`는 로짓(logits)을 받아 내부적으로 분류 손실 계산에 필요한 연산을 수행한다. 그래서 보통 모델은 마지막에 점수만 출력하면 충분하다.

⚠️ 주의:
- `CrossEntropyLoss`는 입력으로 `(batch_size, num_classes)` 모양의 로짓과 `(batch_size,)` 모양의 정수 라벨을 기대한다.
- 정답을 원-핫 인코딩으로 바꾸는 습관이 있는 경우, PyTorch 기본 패턴과 맞지 않아 헷갈릴 수 있다.

📌 핵심: **손실 함수는 “얼마나 틀렸는가”를 정의하고, 옵티마이저는 그 틀림을 줄이는 방향으로 파라미터를 움직인다.**

### 3.10 학습 루프: 신경망 코드가 실제로 살아 움직이는 순간

학습 루프는 PyTorch 실습의 중심이다. 아래 코드는 강의의 MLP 실습에서 핵심이 되는 `train_one_epoch` 구조를 학습용 주석과 함께 정리한 것이다.

```python
import torch


def train_one_epoch(model, loader, optimizer, device):
    running_loss = 0.0
    correct = 0
    total = 0

    # 학습 모드로 전환한다.
    # Dropout, BatchNorm 같은 층은 train/eval에서 동작이 달라진다.
    model.train()

    for xb, yb in loader:
        # 배치 데이터를 CPU/GPU 장치로 옮긴다.
        xb, yb = xb.to(device), yb.to(device)

        # 이전 배치에서 누적된 gradient를 초기화한다.
        optimizer.zero_grad()

        # 순전파: 입력을 넣어 클래스별 점수(logits)를 얻는다.
        logits = model(xb)

        # 손실 계산: 다중 분류이므로 cross entropy를 사용한다.
        loss = torch.nn.functional.cross_entropy(logits, yb)

        # 역전파: loss를 기준으로 각 파라미터의 기울기를 계산한다.
        loss.backward()

        # 옵티마이저가 계산된 gradient를 이용해 파라미터를 갱신한다.
        optimizer.step()

        # 통계 기록용 값 누적
        running_loss += loss.item() * xb.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == yb).sum().item()
        total += yb.size(0)

    avg_loss = running_loss / total
    acc = correct / total
    return avg_loss, acc
```

여기서 `loss.item() * xb.size(0)`으로 누적하는 이유는, 배치 크기가 마지막 배치에서 달라질 수 있기 때문이다. 단순 평균을 평균 내는 것보다, 샘플 수 기준으로 가중 평균을 잡는 편이 더 정확하다.

이제 평가 루프를 보자.

```python
import torch


def evaluate(model, loader, device):
    running_loss = 0.0
    correct = 0
    total = 0
    all_preds = []
    all_targets = []

    # 평가 모드로 전환한다.
    model.eval()

    # 평가에서는 기울기가 필요 없으므로 그래프 생성을 끈다.
    with torch.no_grad():
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)

            logits = model(xb)
            loss = torch.nn.functional.cross_entropy(logits, yb)

            running_loss += loss.item() * xb.size(0)
            preds = logits.argmax(dim=1)
            correct += (preds == yb).sum().item()
            total += yb.size(0)

            all_preds.append(preds.cpu())
            all_targets.append(yb.cpu())

    avg_loss = running_loss / total
    acc = correct / total
    preds_cat = torch.cat(all_preds).numpy()
    targets_cat = torch.cat(all_targets).numpy()
    return avg_loss, acc, preds_cat, targets_cat
```

학습 루프와 평가 루프가 비슷해 보여도 차이는 분명하다.

- 학습 루프는 `model.train()` + `zero_grad()` + `backward()` + `step()`이 있다.
- 평가 루프는 `model.eval()` + `torch.no_grad()`가 있고, 파라미터 업데이트가 없다.

⚠️ 주의:
- `optimizer.zero_grad()`를 빼면 gradient가 계속 누적된다.
- 검증 단계에서 `model.eval()`를 빼면 드롭아웃이 켜진 채로 평가될 수 있다.
- `argmax(dim=1)`의 축을 잘못 잡으면 예측 클래스 계산이 틀어진다.

📌 핵심: **학습 루프는 순전파, 손실 계산, 역전파, 업데이트의 반복이고, 평가 루프는 같은 흐름에서 업데이트만 빠진 구조다.**

### 3.11 전체 학습 실행: 기록, 시각화, Early Stopping, 체크포인트

실제 실습에서는 한 epoch마다 학습 손실/정확도와 검증 손실/정확도를 기록한 뒤, 학습 곡선으로 시각화한다. 이 과정은 “모델이 잘 배우고 있는가”를 확인하는 가장 기본적인 습관이다.

대표 실행 패턴은 아래와 같다.

```python
import math
import time
import torch

model = MLP(
    input_dim=64,
    num_classes=10,
    hidden_dims=(128, 64),
    dropout=0.2
).to(DEVICE)

optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

best_val_loss = math.inf
best_val_acc = -1.0
epochs_no_improve = 0
checkpoint_path = "model.ckpt"
earlystop_patience = 5

train_losses, train_accs = [], []
valid_losses, valid_accs = [], []

for epoch in range(1, 201):
    t0 = time.time()

    train_loss, train_acc = train_one_epoch(model, train_loader, optimizer, DEVICE)
    val_loss, val_acc, _, _ = evaluate(model, valid_loader, DEVICE)

    train_losses.append(train_loss)
    train_accs.append(train_acc)
    valid_losses.append(val_loss)
    valid_accs.append(val_acc)

    print(
        f"Epoch {epoch:03d} | "
        f"train loss {train_loss:.4f} acc {train_acc*100:5.2f}% | "
        f"val loss {val_loss:.4f} acc {val_acc*100:5.2f}% | "
        f"{time.time() - t0:.1f}s"
    )

    # 검증 성능이 좋아졌을 때만 체크포인트 저장
    improved = (val_loss < best_val_loss) or (val_acc > best_val_acc)
    if improved:
        best_val_loss = min(best_val_loss, val_loss)
        best_val_acc = max(best_val_acc, val_acc)
        torch.save({
            "model_state_dict": model.state_dict(),
            "input_dim": 64,
            "num_classes": 10,
        }, checkpoint_path)
        epochs_no_improve = 0
    else:
        epochs_no_improve += 1

    # 개선이 없으면 조기 종료
    if epochs_no_improve >= earlystop_patience:
        print("Early stopping triggered")
        break
```

여기서 `torch.save()`는 학습이 가장 잘된 시점의 가중치를 저장한다. 조기 종료를 함께 쓰는 이유는, 검증 성능이 더 좋아지지 않는 구간에서 계속 학습해도 오히려 과적합이 심해질 수 있기 때문이다.

저장한 모델은 나중에 다시 불러와 추론에 사용할 수 있다.

```python
checkpoint = torch.load("model.ckpt", map_location=DEVICE)

model = MLP(
    input_dim=checkpoint["input_dim"],
    num_classes=checkpoint["num_classes"],
    hidden_dims=(128, 64),
    dropout=0.2
).to(DEVICE)

model.load_state_dict(checkpoint["model_state_dict"])
model.eval()
```

또는 `state_dict()`만 저장한 경우에는 모델 구조를 먼저 만든 뒤 가중치를 덮어쓰면 된다.

학습 곡선 시각화도 매우 중요하다.

```python
import matplotlib.pyplot as plt

plt.figure(figsize=(12, 4))

plt.subplot(1, 2, 1)
plt.plot(train_losses, label="train loss")
plt.plot(valid_losses, label="valid loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.title("Learning Curves - Loss")
plt.legend()
plt.grid(alpha=0.3)

plt.subplot(1, 2, 2)
plt.plot(train_accs, label="train acc")
plt.plot(valid_accs, label="valid acc")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.title("Learning Curves - Accuracy")
plt.legend()
plt.grid(alpha=0.3)

plt.tight_layout()
plt.show()
```

이 그래프를 보면 손실이 안정적으로 감소하는지, 학습 정확도는 오르는데 검증 정확도가 멈추는지, 과적합이 시작되는 시점이 어디인지 감을 잡을 수 있다.

📌 핵심: **좋은 학습은 한 번 실행하고 끝나는 것이 아니라, 기록하고 비교하고 가장 좋은 시점을 저장하는 습관까지 포함한다.**

### 3.12 GPU 사용: 학습이 느릴 때 가장 먼저 확인할 것

PyTorch를 쓰는 이유 중 하나는 GPU를 쉽게 활용할 수 있다는 점이다. 기본 패턴은 아래처럼 매우 단순하다.

```python
import torch

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", DEVICE)

model = model.to(DEVICE)

for xb, yb in train_loader:
    xb = xb.to(DEVICE)
    yb = yb.to(DEVICE)
```

여기서 중요한 점은 모델과 데이터가 **같은 장치**에 있어야 한다는 것이다. 모델만 GPU로 보내고 입력은 CPU에 두면 장치 불일치 에러가 난다.

⚠️ 주의: `tensor.cuda()`와 `model.cuda()`를 섞어 쓰기보다, `device` 변수를 하나 정하고 `.to(device)` 패턴으로 통일하는 편이 훨씬 안전하다.

📌 핵심: **GPU 사용의 핵심은 모델과 배치를 같은 장치로 보내는 것이다.**

### 3.13 Perceptron과 결정 경계: 모델이 무엇을 배웠는지 눈으로 확인하기

결정 경계 시각화 실습은, 분류 모델이 “실제로 어떤 선을 그어 데이터를 나누고 있는가”를 눈으로 확인하게 해 준다. 특히 2차원 데이터에서는 학습의 의미가 훨씬 직관적으로 보인다.

실습에서는 `make_moons` 데이터를 사용했다.

```python
import numpy as np
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from sklearn.datasets import make_moons
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# 1. 반달 모양 데이터 생성
moons_features, moons_target = make_moons(n_samples=1000, noise=0.2, random_state=42)

# 2. 학습/테스트 분할
moons_train_features, moons_test_features, moons_train_target, moons_test_target = train_test_split(
    moons_features,
    moons_target,
    test_size=0.2,
    random_state=42,
    stratify=moons_target
)

# 3. 표준화
moons_scaler = StandardScaler()
moons_train_scaled = moons_scaler.fit_transform(moons_train_features)
moons_test_scaled = moons_scaler.transform(moons_test_features)

# 4. DataLoader 생성
moons_train_loader = DataLoader(
    TensorDataset(
        torch.from_numpy(moons_train_scaled).float(),
        torch.from_numpy(moons_train_target).long(),
    ),
    batch_size=32,
    shuffle=True,
)
```

그 다음 작은 분류 모델을 학습시킨다.

```python
class SimplePerceptron(nn.Module):
    def __init__(self, input_dim=2, num_classes=2, hidden_dims=(16,), dropout=0.0):
        super().__init__()
        layers = []
        previous_dim = input_dim

        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(previous_dim, hidden_dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            previous_dim = hidden_dim

        layers.append(nn.Linear(previous_dim, num_classes))
        self.network = nn.Sequential(*layers)

    def forward(self, x):
        return self.network(x)


simple_perceptron = SimplePerceptron(input_dim=2, num_classes=2, hidden_dims=(16,), dropout=0.0)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(simple_perceptron.parameters(), lr=0.01)

for epoch in range(100):
    simple_perceptron.train()
    for features_batch, target_batch in moons_train_loader:
        optimizer.zero_grad()
        output = simple_perceptron(features_batch)
        loss = criterion(output, target_batch)
        loss.backward()
        optimizer.step()
```

결정 경계를 그리는 함수는 아래처럼 만들 수 있다.

```python
def plot_decision_boundary(model, features, target, scaler, title="Decision Boundary"):
    model.eval()

    # 2D 평면 전체를 촘촘한 격자로 만든다.
    h = 0.02
    x_min, x_max = features[:, 0].min() - 1, features[:, 0].max() + 1
    y_min, y_max = features[:, 1].min() - 1, features[:, 1].max() + 1
    xx, yy = np.meshgrid(np.arange(x_min, x_max, h),
                         np.arange(y_min, y_max, h))

    # 격자점을 원래 데이터와 같은 방식으로 스케일링한다.
    grid_points = np.c_[xx.ravel(), yy.ravel()]
    grid_scaled = scaler.transform(grid_points)
    grid_tensor = torch.from_numpy(grid_scaled).float()

    # 각 점의 예측 클래스를 계산한다.
    with torch.no_grad():
        outputs = model(grid_tensor)
        _, predictions = outputs.max(1)

    predictions = predictions.numpy().reshape(xx.shape)

    # 배경을 예측 클래스로 채우고, 실제 데이터를 겹쳐 그린다.
    plt.figure(figsize=(10, 8))
    plt.contourf(xx, yy, predictions, alpha=0.4, cmap="RdYlBu")
    plt.scatter(features[target == 0, 0], features[target == 0, 1],
                c="blue", label="Class 0", edgecolors="k", s=50, alpha=0.7)
    plt.scatter(features[target == 1, 0], features[target == 1, 1],
                c="red", label="Class 1", edgecolors="k", s=50, alpha=0.7)
    plt.xlabel("Feature 1")
    plt.ylabel("Feature 2")
    plt.title(title)
    plt.legend()
    plt.grid(alpha=0.3)
    plt.show()
```

이 시각화가 중요한 이유는, 숫자로만 보던 분류기가 실제로 공간을 어떻게 나누고 있는지 바로 확인할 수 있기 때문이다. 선형 모델이라면 거의 직선 경계가 나오고, 은닉층과 활성화 함수가 들어간 모델이라면 데이터 모양을 따라 휘어진 경계를 만들 수 있다.

💡 포인트: 결정 경계 시각화는 “정확도가 왜 높거나 낮은지”를 직관적으로 설명해준다. 단순히 숫자를 보는 것보다 학습 상태를 이해하는 데 도움이 크다.

📌 핵심: **결정 경계는 모델이 입력 공간을 어떻게 분리하고 있는지 보여주는 시각적 설명이다.**

### 3.14 MNIST와 Digits: 같은 원리, 다른 스케일

강의에서는 Digits 데이터셋과 MNIST CSV 예제가 모두 등장한다. 둘의 공통점은 “이미지를 펼쳐 벡터로 넣고, MLP로 분류한다”는 구조다.

MNIST 예시 코드는 다음과 같은 흐름을 가진다.

```python
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

# 1. CSV 로드
train_df = pd.read_csv("sample_data/mnist_train_small.csv")

# 2. 픽셀값 정규화
X_train = torch.tensor(train_df.iloc[:, 1:].values, dtype=torch.float32) / 255.0
y_train = torch.tensor(train_df.iloc[:, 0].values, dtype=torch.long)

# 3. DataLoader 구성
train_dataset = list(zip(X_train, y_train))
train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)

# 4. 모델 정의
model = nn.Sequential(
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Linear(256, 128),
    nn.ReLU(),
    nn.Linear(128, 10),
)

# 5. 손실 함수와 옵티마이저
loss_fn = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

# 6. 학습
epochs = 5
for epoch in range(epochs):
    total_loss = 0.0
    for X_batch, y_batch in train_loader:
        outputs = model(X_batch)
        loss = loss_fn(outputs, y_batch)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    print(f"Epoch {epoch+1}/{epochs}, Loss: {total_loss/len(train_loader):.4f}")

# 7. 학습된 파라미터 저장
torch.save(model.state_dict(), "model.pth")
```

Digits는 8x8 이미지라 입력 차원이 64이고, MNIST는 28x28 이미지라 입력 차원이 784라는 차이가 있다. 하지만 나머지 흐름은 거의 같다. 이 점이 중요하다. 즉, 데이터셋이 달라도 **파이프라인의 사고방식은 재사용 가능**하다는 뜻이다.

⚠️ 주의: 이미지 데이터는 픽셀 범위가 큰 경우가 많으므로, `/255.0` 같은 정규화가 학습 안정성에 큰 영향을 줄 수 있다.

📌 핵심: **Digits와 MNIST는 규모는 다르지만, MLP 학습 파이프라인이라는 관점에서는 같은 구조를 공유한다.**

---

## 4. 적용 관점에서 다시 보기

이 장에서는 본문에서 이미 설명한 내용을 바탕으로, 실제 문제를 만났을 때 어떤 순서로 떠올리면 좋은지 정리해본다.

### 4-1. 어떤 문제를 보면 MLP를 떠올려야 할까?

다음과 같은 신호가 보이면 MLP를 떠올리기 좋다.

- 입력이 고정 길이의 수치 벡터다.
- 분류나 회귀를 해야 한다.
- CNN이나 RNN처럼 더 특화된 구조가 아직 필요하지 않다.
- 먼저 기본 분류기 베이스라인을 만들어 보고 싶다.

예를 들어 Digits처럼 작은 이미지라도, 일단 픽셀을 펼쳐 64차원 벡터로 넣을 수 있다면 MLP를 빠르게 적용해볼 수 있다. make_moons 같은 2차원 데이터도 마찬가지다.

### 4-2. 구현 순서는 어떻게 잡으면 좋을까?

실전에서는 아래 순서를 습관처럼 가져가면 좋다.

1. **데이터 확인**: 입력 차원, 클래스 수, 샘플 수를 본다.
2. **분할과 전처리**: train/valid/test 분할, 표준화나 정규화를 먼저 끝낸다.
3. **텐서화와 DataLoader**: 입력은 float, 분류 라벨은 long으로 맞춘다.
4. **모델 정의**: 입력 차원과 출력 차원을 먼저 확정하고, 은닉층은 간단하게 시작한다.
5. **손실 함수와 옵티마이저 설정**: 분류면 CrossEntropyLoss, 시작은 Adam을 많이 쓴다.
6. **학습/평가 루프 작성**: `train()` / `eval()` / `no_grad()` / `zero_grad()`의 역할을 분명히 나눈다.
7. **기록과 시각화**: 손실과 정확도를 매 epoch 저장해 곡선을 본다.
8. **조기 종료와 저장**: 검증 성능이 가장 좋은 시점을 남긴다.

이 순서를 머릿속에 넣어두면, 새로운 데이터셋을 받아도 어디부터 시작해야 할지 막막하지 않다.

### 4-3. 자주 하는 실수는 무엇일까?

#### 1) `model.train()` / `model.eval()`를 바꾸지 않는다
드롭아웃이 있는 모델에서는 이 실수가 꽤 치명적이다. 학습과 평가에서 모델 동작이 달라지므로, 모드를 분명하게 전환해야 한다.

#### 2) 검증에서 `torch.no_grad()`를 빠뜨린다
결과는 나오지만 불필요한 계산 그래프가 만들어져 메모리를 더 사용한다. 속도와 안정성 측면에서도 손해다.

#### 3) `optimizer.zero_grad()`를 잊는다
PyTorch는 gradient를 누적하므로, 이전 배치의 기울기가 남아 있으면 의도하지 않은 업데이트가 된다.

#### 4) 분류 타깃 dtype을 잘못 둔다
`CrossEntropyLoss`는 타깃을 정수형 클래스 인덱스로 기대한다. float나 one-hot을 그대로 넣으면 에러나 혼란이 생긴다.

#### 5) 전처리를 학습/검증/테스트에 섞어 적용한다
스케일러는 학습 데이터에만 `fit`해야 한다. 이 원칙이 무너지면 평가가 부정확해진다.

#### 6) 입력 차원과 레이어 차원을 맞추지 못한다
MNIST는 784, Digits는 64처럼 입력 차원이 다르다. 모델 첫 레이어와 데이터 shape을 꼭 같이 확인해야 한다.

### 4-4. 문제를 보면 어떤 신호를 포착해야 할까?

- **클래스가 10개다** → 출력층 `num_classes=10`
- **입력이 이미지지만 CNN까지는 아직 아니다** → 펼쳐서 MLP 베이스라인 가능
- **데이터가 2차원이다** → 결정 경계 시각화가 매우 유용
- **검증 성능이 흔들린다** → 드롭아웃, weight decay, early stopping을 점검
- **학습이 너무 느리다** → GPU 사용 여부, 배치 크기, DataLoader 구성을 점검

🧠 기억할 것: **MLP 실전은 “모델을 멋있게 짜는 일”보다, 데이터 흐름과 학습 루프를 안정적으로 맞추는 일”에 더 가깝다.**

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의 묶음의 가장 큰 의미는, 선형 회귀나 로지스틱 회귀에서 손으로 계산하던 학습 원리가 PyTorch에서 어떻게 일반화되는지를 직접 본 데 있다. 이전에는 직접 gradient를 계산하고 파라미터를 업데이트했다면, 여기서는 Tensor와 Autograd, `nn.Module`, 옵티마이저가 그 과정을 훨씬 체계적으로 대신해 준다.

또 하나 중요한 확장 포인트는, MLP가 딥러닝의 끝이 아니라 시작이라는 점이다. CNN, RNN, Transformer처럼 더 복잡한 모델도 결국은 “텐서 연산 + 자동 미분 + 모듈 조합 + 데이터 파이프라인 + 학습 루프”라는 공통 뼈대 위에 서 있다. 이번 강의를 제대로 이해하면 이후 모델이 바뀌어도 학습의 기본 흐름은 흔들리지 않는다.

특히 다음 단계로 확장할 만한 주제는 아래와 같다.

- Batch Normalization과 Dropout의 차이
- 학습률 스케줄러
- Confusion Matrix와 Classification Report 해석
- CNN으로 이미지 분류 성능 개선
- 실제 프로젝트용 커스텀 Dataset 설계
- 모델 저장 형식(`state_dict`, checkpoint)과 배포용 추론 코드 작성

📌 핵심: **이번 강의는 MLP 하나를 배우는 강의라기보다, PyTorch로 딥러닝 모델을 학습시키는 표준 패턴을 익히는 강의다.**

---

## 6. 요약 정리

- 📌 핵심: 선형 분류기는 XOR 같은 비선형 문제를 해결하지 못하고, 이 한계를 넘기 위해 신경망과 활성화 함수가 필요하다.
- 📌 핵심: Tensor는 PyTorch 계산의 기본 단위이고, Autograd는 역전파를 자동으로 계산한다.
- 📌 핵심: `nn.Module`은 모델 구조와 파라미터를 함께 관리하는 기본 틀이다.
- 📌 핵심: `nn.Linear` + 활성화 함수 + 필요하면 Dropout을 쌓으면 MLP가 된다.
- 📌 핵심: `Dataset`과 `DataLoader`는 데이터를 배치 단위 학습 흐름으로 바꿔준다.
- 📌 핵심: 학습 루프는 `train -> forward -> loss -> backward -> step`의 반복이다.
- 📌 핵심: 평가 루프는 `eval`과 `no_grad`를 반드시 구분해야 한다.
- 📌 핵심: Early Stopping과 체크포인트는 “가장 잘된 모델”을 남기기 위한 실전 습관이다.
- 📌 핵심: 결정 경계 시각화는 모델이 실제로 무엇을 배웠는지 눈으로 확인하게 해준다.

🧠 기억할 것:

- 모델보다 먼저 데이터 분할과 전처리를 바로잡아야 한다.
- 분류 문제에서는 라벨 dtype과 출력 shape를 항상 먼저 확인한다.
- `zero_grad`, `train/eval`, `no_grad`는 학습 루프의 기본 3종 세트다.
- PyTorch를 잘한다는 것은 복잡한 모델을 외우는 것보다, 학습 파이프라인을 안정적으로 설계하는 데 가깝다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. XOR 문제는 왜 단일 선형 분류기로 풀기 어려운가? “직선 하나로 분리할 수 있는가”라는 관점에서 설명해보자.
2. `requires_grad=True`가 붙은 텐서와 그렇지 않은 텐서의 차이는 무엇인가? `backward()`와 연결해 설명해보자.
3. `CrossEntropyLoss`를 사용할 때, 모델의 마지막 출력층 뒤에 softmax를 따로 두지 않는 이유는 무엇인가?
4. `model.train()`과 `model.eval()`의 차이는 무엇이며, 어떤 층에서 그 차이가 특히 중요하게 드러나는가?
5. `Dataset`과 `DataLoader`는 각각 어떤 역할을 맡는가? 둘을 하나의 파이프라인으로 설명해보자.
6. 검증 단계에서 `torch.no_grad()`를 쓰는 이유는 무엇인가?
7. 표준화를 할 때 스케일러를 학습 데이터에만 `fit`해야 하는 이유를 데이터 누수 관점에서 설명해보자.
8. 결정 경계 시각화는 단순히 보기 좋은 그림이 아니라, 모델 이해에 어떤 도움을 주는가?

---

## 부록: 빠르게 떠올리는 PyTorch 학습 루프 템플릿

복습할 때 바로 떠올릴 수 있도록 가장 압축된 형태의 학습 템플릿을 마지막에 남긴다.

```python
# 1. 데이터 준비
train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
valid_loader = DataLoader(valid_dataset, batch_size=32, shuffle=False)

# 2. 모델 / 손실 함수 / 옵티마이저
model = MLP(input_dim=64, num_classes=10).to(device)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

# 3. 학습 루프
for epoch in range(epochs):
    model.train()
    for xb, yb in train_loader:
        xb, yb = xb.to(device), yb.to(device)

        optimizer.zero_grad()
        logits = model(xb)
        loss = criterion(logits, yb)
        loss.backward()
        optimizer.step()

    model.eval()
    with torch.no_grad():
        for xb, yb in valid_loader:
            xb, yb = xb.to(device), yb.to(device)
            logits = model(xb)
            # 검증 손실 / 정확도 계산
```

이 템플릿이 낯설지 않게 느껴진다면, 이번 강의의 핵심 흐름은 잘 잡은 것이다.
