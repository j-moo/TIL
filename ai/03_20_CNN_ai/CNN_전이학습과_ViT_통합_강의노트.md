# CNN, 전이학습, Fine-tuning, ViT 통합 강의노트

- 🎯 글의 목표: CNN의 기본 원리부터 AlexNet·ResNet·전이학습·Fine-tuning·ViT 활용까지를 하나의 흐름으로 묶어, 이론과 실습이 함께 떠오르는 복습용 정리본으로 만드는 것
- 🧩 핵심 키워드: Convolution, Padding, Pooling, Feature Map, AlexNet, ResNet, Residual Connection, Transfer Learning, Linear Probing, Fine-tuning, Data Augmentation, StepLR, ReduceLROnPlateau, ViT, Patch Embedding
- ⭐ 중요도: 매우 높음
- 📝 한눈에 보는 내용: 컴퓨터 비전의 배경 → CNN이 이미지를 다루는 방식 → MNIST로 보는 CNN 구조 → AlexNet과 ResNet의 의미 → 전이학습과 Linear Probing → Fine-tuning과 데이터 증강 → Optimizer/Scheduler 비교 → ViT의 패치 기반 추론
- 🔗 관련 문제 / 주제(있다면): CIFAR-10 분류, Flowers102 전이학습, 강아지/비강아지 이진 분류, Hugging Face 기반 ViT 추론

---

## 1. 들어가며

이미지 분류를 처음 배우면 흔히 이런 질문이 생긴다. 텍스트는 토큰으로 나누면 되는데, 이미지는 무엇을 기준으로 잘라서 이해해야 할까? 그리고 왜 CNN이 오랫동안 컴퓨터 비전의 표준 구조였는지, 또 왜 최근에는 ViT 같은 Transformer 기반 모델이 강력한 대안이 되었는지도 함께 궁금해진다.

이번 강의 묶음은 바로 그 질문에 순서대로 답한다. 먼저 컴퓨터 비전이 어떤 문제를 풀어왔는지 큰 배경을 잡고, CNN이 이미지에서 특징을 추출하는 기본 방식을 본다. 그 다음에는 AlexNet과 ResNet이 왜 역사적으로 중요했는지 살펴보고, 실제 실습에서는 사전학습된 ResNet-18을 가져와 Linear Probing과 Fine-tuning을 수행한다. 마지막에는 ViT가 CNN과 어떻게 다른 관점으로 이미지를 처리하는지 연결한다.

중요한 점은, 이 강의가 단순히 모델 이름을 외우는 수업이 아니라는 것이다. 실제로는 **입력 이미지가 텐서로 바뀌고, 특징 맵이 만들어지고, 사전학습된 백본을 새 문제에 맞게 재사용하고, 마지막에는 다른 구조인 ViT까지 연결해 보는 흐름** 자체가 핵심이다. 따라서 이 노트도 개념과 코드가 멀어지지 않도록, 설명이 나온 자리에서 바로 예시와 구현을 붙여 정리한다.

## 2. 핵심 개념 정리

이번 강의 전체 흐름은 아래처럼 잡아두면 이해가 훨씬 편하다.

1. **컴퓨터 비전의 문제의식**  
   사진은 숫자 행렬이지만, 그 안에는 경계선·질감·형태 같은 의미 있는 패턴이 숨어 있다. 컴퓨터 비전은 이 패턴을 어떻게 안정적으로 추출할지를 다룬다.

2. **CNN의 기본 원리**  
   Convolution은 작은 커널을 슬라이딩하며 국소 패턴을 읽어내는 연산이고, Pooling은 중요한 반응만 남기며 공간 크기를 줄인다. 이 과정을 반복하면 픽셀 수준의 정보가 점차 의미 있는 특징으로 바뀐다.

3. **대표 모델의 등장**  
   AlexNet은 GPU와 깊은 CNN 구조를 결합해 이미지 분류의 흐름을 바꿨고, ResNet은 잔차 연결을 통해 더 깊은 네트워크 학습을 가능하게 했다.

4. **전이학습의 실전 적용**  
   ImageNet 같은 대규모 데이터셋으로 학습된 모델은 이미 강력한 특징 추출기를 갖고 있다. 그래서 새 데이터셋에서는 처음부터 학습하기보다, 기존 백본을 재사용하는 편이 훨씬 효율적이다.

5. **Linear Probing → Fine-tuning**  
   전이학습의 시작은 보통 마지막 분류층만 바꾸는 Linear Probing이다. 그 다음 단계가 백본 일부 또는 전체까지 업데이트하는 Fine-tuning이다. 데이터가 적을수록 어느 범위까지 풀어 학습할지 전략이 중요해진다.

6. **데이터 증강과 학습 안정화**  
   이미지 분류는 입력이 조금만 바뀌어도 분포가 달라질 수 있다. 그래서 Random Crop, Flip, Rotation 같은 데이터 증강과 적절한 Optimizer/Scheduler 조합이 일반화 성능에 큰 영향을 준다.

7. **ViT의 관점 전환**  
   CNN은 커널로 국소 정보를 쌓아 올리는 구조이고, ViT는 이미지를 패치 단위 토큰으로 나누어 Transformer처럼 처리한다. 즉, 같은 이미지 분류 문제를 다른 계산 관점으로 푸는 셈이다.

이 큰 그림을 먼저 잡고 나면, 뒤에 나오는 코드가 단순한 라이브러리 사용법이 아니라 "왜 이런 순서로 모델을 준비하는가"로 읽히기 시작한다.

## 3. 본문 정리

### 3.1 컴퓨터 비전은 무엇을 해결하려는가

컴퓨터 비전은 한마디로 말하면 **이미지에서 사람이 알아보는 정보를 컴퓨터도 읽어내게 만드는 분야**다. 다만 이미지 데이터는 텍스트보다 훨씬 복잡하다. 같은 강아지라도 조명, 각도, 배경, 크기가 모두 달라질 수 있기 때문이다.

초기의 흐름에서는 전처리와 패턴 인식이 중심이었다. 밝기 보정, 엣지 검출, 특징점 추출 같은 영상 처리 기법으로 이미지를 다듬은 뒤, 사람이 정의한 특징을 바탕으로 물체를 분류하려 했다. 하지만 이런 방식은 복잡한 실제 이미지를 다루기에는 한계가 컸다.

여기서 CNN이 중요해진다. CNN은 사람이 직접 특징을 설계하는 대신, **데이터로부터 유용한 필터를 학습**한다. 쉽게 말하면, 어떤 커널은 가로선을 잘 보고, 어떤 커널은 모서리를 잘 보고, 어떤 커널은 질감 변화를 잘 보게 되는데, 이 필터들이 학습을 통해 자동으로 결정되는 것이다.

💡 포인트: 컴퓨터 비전에서 핵심은 단순히 이미지를 숫자로 바꾸는 것이 아니라, **어떤 숫자 패턴이 분류에 유용한지를 점점 추상화하는 것**이다.

📌 핵심: CNN은 사람이 특징을 손으로 설계하던 시대에서, 모델이 특징을 스스로 학습하는 시대로 넘어가게 한 대표 구조다.

### 3.2 CNN은 이미지를 어떻게 읽는가

CNN의 출발점은 이미지가 텐서라는 사실이다. 컬러 이미지는 보통 RGB 3채널을 가지므로 `(채널, 높이, 너비)` 형태로 볼 수 있다. 배치까지 포함하면 `(배치 크기, 채널, 높이, 너비)`가 된다.

왜 이런 형식이 중요할까? Convolution 연산이 바로 이 구조를 전제로 하기 때문이다. 커널은 이미지 전체를 한 번에 보지 않고, 작은 영역을 훑으면서 지역 패턴을 찾는다. 그래서 CNN은 처음부터 전역 의미를 읽기보다, **작은 패턴을 여러 층에 걸쳐 쌓아 큰 의미로 연결하는 구조**라고 이해하는 편이 좋다.

#### Convolution, Padding, ReLU, Pooling의 연결

- **Convolution**: 작은 필터를 이동시키며 특징을 추출한다.
- **Padding**: 가장자리 정보를 잃지 않도록 입력 주변에 값을 채운다.
- **ReLU**: 선형 연산 뒤에 비선형성을 추가해 표현력을 높인다.
- **Pooling**: 반응이 강한 값만 남기며 공간 크기를 줄인다.

쉽게 말하면, Convolution은 "무엇을 볼지" 정하고, ReLU는 "단순 합이 아니라 의미 있는 반응만 통과"시키고, Pooling은 "중요한 정보만 압축해서 남기는 과정"이라고 볼 수 있다.

#### MNIST를 기준으로 보는 CNN 흐름

강의에서는 MNIST를 예로 들어 CNN 구조를 단계적으로 설명한다. MNIST는 흑백 이미지이므로 입력 채널이 1개이고, 크기는 28×28이다.

- 입력: `(1, 28, 28)`
- Conv + ReLU + Pooling
- Conv + ReLU + Pooling
- Flatten
- Fully Connected
- 10개 숫자 클래스 출력

이 과정을 보면 CNN이 결국 마지막에는 MLP처럼 분류를 수행한다는 점도 드러난다. 차이는 그 전에 **Convolution 블록이 특징 추출기 역할을 한다는 점**이다.

#### 관련 코드: MNIST용 간단한 CNN

```python
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

# GPU가 있으면 GPU를 쓰고, 없으면 CPU를 사용한다.
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# CSV로 저장된 MNIST 데이터를 읽는다.
train_df = pd.read_csv("sample_data/mnist_train_small.csv")

# 첫 번째 열은 정답 레이블, 나머지 열은 28x28 픽셀값이다.
# 픽셀 범위는 0~255이므로 255로 나눠 0~1 범위로 맞춘다.
X_train = torch.tensor(train_df.iloc[:, 1:].values, dtype=torch.float32) / 255.0
y_train = torch.tensor(train_df.iloc[:, 0].values, dtype=torch.long)

# CNN은 (배치, 채널, 높이, 너비) 형태를 기대하므로 1채널 이미지로 reshape한다.
X_train = X_train.reshape(-1, 1, 28, 28)

# 미니배치 단위로 학습하기 위해 DataLoader를 만든다.
train_loader = DataLoader(list(zip(X_train, y_train)), batch_size=64, shuffle=True)

# CNN 블록 2개와 FC 레이어로 이루어진 간단한 분류기다.
model = nn.Sequential(
    nn.Conv2d(1, 32, kernel_size=5, padding=2),  # (1,28,28) -> (32,28,28)
    nn.ReLU(),                                   # 비선형성 추가
    nn.MaxPool2d(2, 2),                          # (32,28,28) -> (32,14,14)

    nn.Conv2d(32, 64, kernel_size=5, padding=2), # (32,14,14) -> (64,14,14)
    nn.ReLU(),
    nn.MaxPool2d(2, 2),                           # (64,14,14) -> (64,7,7)

    nn.Flatten(),                                 # 3차원 특징맵을 1차원 벡터로 펼친다.
    nn.Linear(64 * 7 * 7, 128),
    nn.ReLU(),
    nn.Linear(128, 10)                            # 숫자 10개 클래스로 분류
).to(device)

criterion = nn.CrossEntropyLoss()                 # 다중분류 손실 함수
optimizer = optim.Adam(model.parameters(), lr=0.001)

for epoch in range(3):
    model.train()                                 # 학습 모드 전환
    running_loss = 0.0

    for images, labels in train_loader:
        # 배치 데이터를 같은 장치로 보낸다.
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()                     # 이전 기울기 초기화
        outputs = model(images)                   # 순전파
        loss = criterion(outputs, labels)         # 손실 계산
        loss.backward()                           # 역전파
        optimizer.step()                          # 가중치 업데이트

        running_loss += loss.item()

    print(f"Epoch {epoch+1}: loss={running_loss/len(train_loader):.4f}")
```

#### 코드 흐름 해설

이 코드는 CNN의 핵심 흐름을 아주 압축해서 보여준다. 앞의 두 `Conv2d` 블록은 특징을 추출하고, `Flatten` 뒤의 `Linear` 층은 추출된 특징을 분류기로 넘긴다. 중요한 점은, Conv 블록이 이미지의 공간 정보를 점차 요약해 간다는 것이다. 처음에는 픽셀 근처의 국소 패턴을 읽고, 뒤로 갈수록 더 추상적인 특징이 만들어진다.

`padding=2`가 들어간 이유도 놓치기 쉽다. 5×5 커널을 그대로 적용하면 가장자리 정보가 빠르게 줄어드는데, padding을 주면 크기를 유지하면서 필터 반응을 계산할 수 있다. 그리고 `MaxPool2d(2,2)`는 해상도를 절반으로 줄이면서 강한 특징만 남긴다.

⚠️ 주의:
- `Conv2d` 입력은 `(N, C, H, W)` 순서다. `(N, H, W, C)`로 넣으면 shape 오류가 난다.
- `CrossEntropyLoss`를 쓸 때는 출력에 `softmax`를 먼저 씌우지 않는다. 손실 함수 내부에서 처리하기 때문이다.
- `Flatten` 이후 첫 `Linear` 입력 크기를 잘못 계산하면 가장 자주 shape mismatch가 난다.

📌 핵심: CNN은 "Convolution으로 특징을 만들고, Pooling으로 줄이고, 마지막 FC에서 분류한다"는 흐름으로 이해하면 된다.

### 3.3 AlexNet과 ResNet은 왜 중요한가

CNN이라는 아이디어 자체는 오래전부터 있었지만, AlexNet이 등장하기 전까지는 대규모 이미지 분류에서 결정적인 성과를 내지 못했다. AlexNet은 깊은 CNN 구조와 GPU 학습을 결합해 ImageNet 대회에서 큰 격차로 우승하면서, 딥러닝 기반 컴퓨터 비전 시대를 본격적으로 열었다.

강의에서 AlexNet은 "CNN이 실제로 산업과 연구의 표준 도구가 되는 전환점"으로 다뤄진다. 즉, AlexNet을 외워야 해서가 아니라, **왜 딥러닝 기반 특징 추출이 기존의 수작업 특징보다 강력했는지 이해하기 위한 역사적 기준점**인 셈이다.

ResNet은 그 다음 단계다. 네트워크를 더 깊게 만들면 더 복잡한 패턴을 배울 수 있을 것 같지만, 실제로는 깊어질수록 학습이 어려워지는 문제가 생겼다. 대표적으로 역전파 중 기울기가 지나치게 작아지는 **기울기 소실(Vanishing Gradient)** 문제가 있다.

ResNet은 이 지점에서 **Residual Connection(잔차 연결)** 을 도입했다. 이전 층의 입력을 몇 개 층을 거친 출력에 더해주는 구조인데, 쉽게 말하면 "원래 정보가 완전히 사라지지 않도록 지름길을 만든 것"이라고 이해하면 된다.

#### 잔차 연결을 직관적으로 보면

기존 블록은 대략 이런 생각으로 학습한다.

- 출력 = 어떤 복잡한 함수 `H(x)`

ResNet 블록은 이렇게 바꾼다.

- 출력 = `F(x) + x`

즉, 모델이 처음부터 전체 함수를 새로 배우는 대신, 기존 입력에서 **얼마나 수정할지만** 배우게 한다. 그래서 깊은 네트워크에서도 학습이 훨씬 안정적이다.

#### ResNet 추론 코드의 핵심

```python
import torch
from torchvision import models, transforms
from torchvision.models import ResNet18_Weights
from PIL import Image
from io import BytesIO
import requests

# ImageNet으로 사전학습된 ResNet-18을 가져온다.
model = models.resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
model.eval()  # 추론 시에는 평가 모드로 바꾼다.

# 사전학습 모델이 기대하는 입력 분포에 맞춰 전처리를 구성한다.
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

# 인터넷 이미지를 하나 받아서 RGB 이미지로 변환한다.
url = "https://cdn.pixabay.com/photo/2020/02/03/07/40/cross-speed-4814978_1280.jpg"
img = Image.open(BytesIO(requests.get(url).content)).convert("RGB")

# 배치 차원을 추가한 뒤 모델에 넣는다.
input_tensor = transform(img).unsqueeze(0)

with torch.no_grad():
    logits = model(input_tensor)
    pred_idx = logits.argmax(dim=1).item()

print("예측 클래스 인덱스:", pred_idx)
```

#### 코드 흐름 해설

이 예시는 학습 코드가 아니라 추론 코드지만, 전이학습을 이해하는 데 매우 중요하다. 이미 학습된 ResNet-18은 사실상 **강력한 범용 특징 추출기**다. 그래서 새로운 작업을 할 때도 처음부터 모든 필터를 다시 학습하는 대신, 이 백본을 가져와 필요한 부분만 바꾸는 전략이 가능해진다.

여기서 전처리가 특히 중요하다. 사전학습 모델은 ImageNet 평균·표준편차를 기준으로 학습되었기 때문에, 입력도 같은 분포로 맞추는 것이 성능 유지의 전제다.

⚠️ 주의:
- `model.eval()`을 빼먹으면 Dropout, BatchNorm 등이 학습 모드로 동작해 추론 결과가 흔들릴 수 있다.
- 사전학습 모델의 성능은 전처리 호환성에 크게 좌우된다. 크기와 Normalize가 다르면 성능이 급격히 떨어질 수 있다.

📌 핵심: AlexNet은 CNN 시대의 전환점이고, ResNet은 더 깊은 네트워크를 안정적으로 학습하게 만든 구조적 해법이다.

### 3.4 전이학습은 왜 강력한가

전이학습은 **이미 다른 대규모 데이터셋에서 학습된 모델의 지식을 새 작업에 재사용하는 방법**이다. 이미지 분류에서는 보통 ImageNet 사전학습 모델을 백본으로 많이 쓴다.

왜 강력할까? 새 데이터셋이 충분히 크지 않은 경우가 대부분이기 때문이다. 예를 들어 CIFAR-10, 강아지/비강아지 이진분류, Flowers102 같은 데이터셋은 ImageNet보다 훨씬 작다. 이런 경우 처음부터 깊은 CNN을 학습하면 시간도 오래 걸리고 과적합도 쉽게 일어난다.

전이학습은 이 문제를 줄인다. 이미 학습된 백본은 엣지, 색 대비, 텍스처, 형태 같은 일반적인 시각 특징을 잘 추출한다. 새 작업에서는 보통 마지막 분류기만 바꾸거나, 일부 레이어만 추가 학습해도 꽤 높은 성능을 낼 수 있다.

#### Backbone과 Head

이 구분은 계속 등장하므로 분명히 잡고 가야 한다.

- **Backbone**: 이미지 특징을 추출하는 본체
- **Head**: 최종 클래스를 예측하는 분류층

전이학습은 결국 "백본을 어디까지 믿고 재사용할 것인가"에 대한 선택이다.

📌 핵심: 전이학습은 학습 비용을 줄이면서도 높은 성능을 노릴 수 있게 해 주는, 실무형 이미지 분류의 기본 전략이다.

### 3.5 Linear Probing: 분류 헤드만 먼저 학습하기

Linear Probing은 전이학습의 가장 보수적인 시작점이다. **사전학습된 백본은 그대로 두고, 마지막 분류층만 새 작업에 맞게 교체해서 학습**한다.

왜 이렇게 시작할까? 데이터가 적을 때는 백본 전체를 건드리면 오히려 기존의 좋은 특징 표현을 망가뜨릴 수 있기 때문이다. 그래서 먼저 헤드만 학습해 보고, 성능이 부족하면 그다음에 Fine-tuning으로 확장하는 흐름이 자연스럽다.

#### CIFAR-10 실습에서의 준비 순서

1. ResNet-18 사전학습 모델 로드
2. 모든 파라미터 동결 (`requires_grad=False`)
3. 마지막 `fc` 레이어를 10클래스용으로 교체
4. `model.fc.parameters()`만 optimizer에 등록
5. CIFAR-10을 224×224로 맞춰 학습

#### 관련 코드: ResNet-18 Linear Probing

```python
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.models as models
import torchvision.transforms as transforms
from torch.utils.data import DataLoader
import torchvision

# 1) 사전학습된 ResNet-18을 불러온다.
model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)

# 2) 백본 전체를 얼려서 기존 가중치가 바뀌지 않게 한다.
for param in model.parameters():
    param.requires_grad = False

# 3) 마지막 분류층만 새 문제에 맞게 교체한다.
model.fc = nn.Linear(model.fc.in_features, 10)

# 4) 사전학습된 모델에 맞는 전처리를 구성한다.
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

# 5) CIFAR-10 데이터셋과 DataLoader를 준비한다.
train_dataset = torchvision.datasets.CIFAR10(root='./data', train=True,
                                             download=True, transform=transform)
test_dataset = torchvision.datasets.CIFAR10(root='./data', train=False,
                                            download=True, transform=transform)
train_loader = DataLoader(train_dataset, batch_size=256, shuffle=True, num_workers=2)
test_loader = DataLoader(test_dataset, batch_size=256, shuffle=False, num_workers=2)

# 6) 마지막 fc만 학습 대상으로 둔다.
criterion = nn.CrossEntropyLoss()
optimizer = optim.SGD(model.fc.parameters(), lr=0.001, momentum=0.9)
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=2, gamma=0.1)
```

#### 코드 흐름 해설

여기서 핵심은 `requires_grad=False`와 `model.fc = nn.Linear(...)`의 조합이다. 백본은 그대로 두고, 가장 마지막 출력층만 새로 만들었기 때문에 실제로 학습되는 파라미터 수가 크게 줄어든다. 즉, 기존의 "일반적인 시각 특징 추출 능력"은 보존하고, 그것을 현재 데이터셋 클래스 체계에 맞게 다시 읽는 헤드만 조정하는 셈이다.

실습 노트에서는 학습 가능한 파라미터 수를 따로 세어 보게 하는데, 이 과정이 중요한 이유도 여기에 있다. 전이학습 전략은 단순한 코드 패턴이 아니라, **학습할 자유도를 의도적으로 제한하는 설계 선택**이기 때문이다.

#### 학습 루프의 핵심

```python
model = model.to(device)
num_epochs = 5

for epoch in range(num_epochs):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()          # 이전 배치 기울기 제거
        outputs = model(images)        # 순전파
        loss = criterion(outputs, labels)
        loss.backward()                # 마지막 fc에 대한 기울기 계산
        optimizer.step()               # fc만 업데이트

        running_loss += loss.item()
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()

    scheduler.step()                   # 에폭 단위 학습률 조정
```

이 학습 루프는 일반 분류 학습과 비슷해 보이지만, 실제로는 `optimizer`가 `model.fc.parameters()`만 보고 있다는 점이 다르다. 즉 `loss.backward()`는 전체 계산 그래프를 타고 흐르지만, 업데이트는 마지막 분류층에만 적용된다.

#### 관찰된 결과

실습 정답 노트의 CIFAR-10 기준 결과에서는 **Linear Probing 테스트 정확도 약 67.62%**가 확인된다. 완전 처음부터 학습한 것도 아니고, 백본 전체를 손대지도 않았는데 꽤 높은 성능이 나온다는 점이 전이학습의 강점을 잘 보여준다.

⚠️ 주의:
- 모든 레이어를 동결한 뒤 `model.fc`를 새로 바꾸면, 새로 만든 `fc`는 기본적으로 학습 가능 상태다. 이 흐름을 이해하지 못하면 왜 마지막 층만 업데이트되는지 헷갈리기 쉽다.
- `optimizer`를 `model.parameters()`로 잡아 버리면 사실상 Fine-tuning처럼 동작할 수 있다.

📌 핵심: Linear Probing은 "백본은 믿고, 헤드만 다시 배운다"는 전이학습의 가장 기본적인 출발점이다.

### 3.6 Fine-tuning: 어디까지 풀어서 학습할 것인가

Fine-tuning은 사전학습된 모델의 가중치를 새 작업에 맞게 다시 조정하는 과정이다. 다만 여기서도 범위가 다양하다.

- **Full Fine-tuning**: 전체 레이어를 학습
- **Partial Fine-tuning**: 일부 상위 레이어와 헤드만 학습
- **Linear Probing**: 사실상 가장 좁은 형태의 Partial Fine-tuning

강의에서는 이 차이를 실습으로 아주 명확하게 보여준다. CIFAR-10에서는 Linear Probing 이후 전체 레이어를 풀어 학습시키고, Flowers102 과제에서는 `layer4 + fc`만 학습시키는 Partial Fine-tuning과 Optimizer/Scheduler 비교까지 진행한다.

#### Fine-tuning과 작은 학습률

사전학습된 레이어는 이미 꽤 좋은 상태다. 그래서 Fine-tuning에서는 보통 Linear Probing보다 더 작은 학습률을 쓴다. 너무 크게 업데이트하면 기존의 좋은 표현이 급격히 망가질 수 있기 때문이다.

#### 데이터 증강이 함께 등장하는 이유

Fine-tuning은 표현력은 강해지지만, 그만큼 과적합 위험도 커진다. 그래서 학습 데이터에 무작위 변형을 주는 데이터 증강을 함께 쓰는 경우가 많다.

예를 들면:
- `RandomResizedCrop(224)`
- `RandomHorizontalFlip(p=0.5)`
- `RandomRotation(15)`
- `ColorJitter(...)`

이 조합은 모델이 특정 배치의 고정된 모양만 외우지 않도록 도와준다.

#### 관련 코드: Fine-tuning + Data Augmentation

```python
import torchvision.transforms as transforms
from torchvision.models import resnet18, ResNet18_Weights

# 학습용은 랜덤 변형을 주고, 평가용은 안정적인 전처리만 사용한다.
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

test_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

# 사전학습된 ResNet-18을 다시 불러오고, 분류층을 새 문제에 맞게 교체한다.
model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
model.fc = nn.Linear(model.fc.in_features, 10)

# 전체 레이어를 모두 학습 가능 상태로 푼다.
for param in model.parameters():
    param.requires_grad = True

model = model.to(device)
criterion = nn.CrossEntropyLoss()
optimizer = optim.SGD(model.parameters(), lr=0.0005, momentum=0.9)
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.1)
```

#### 코드 흐름 해설

Fine-tuning에서 본질적으로 달라지는 부분은 두 가지다. 첫째, `requires_grad=True`로 더 많은 레이어를 풀어 준다. 둘째, optimizer가 더 이상 `model.fc.parameters()`만 보지 않고 전체 또는 일부 레이어를 보게 된다.

이때 데이터 증강이 같은 섹션에 붙어 있는 이유가 중요하다. 모델 자유도를 넓혀 놓고 데이터가 충분히 다양하지 않으면, 모델은 매우 빠르게 학습 데이터에만 과도하게 적응한다. 그래서 Fine-tuning은 거의 항상 "더 넓은 학습 범위 + 더 조심스러운 학습률 + 더 강한 데이터 다양화"의 묶음으로 이해해야 한다.

#### CIFAR-10 결과 비교

실습 정답 기준으로, **Linear Probing은 약 67.62%**, **Fine-tuning은 약 92.28%**의 테스트 정확도를 보였다. 물론 데이터셋과 설정에 따라 숫자는 달라질 수 있지만, 이 결과는 적어도 이번 실습 범위에서는 "백본까지 조정했을 때 성능이 크게 올라갈 수 있다"는 점을 분명히 보여준다.

#### Flowers102 과제에서의 Partial Fine-tuning

과제 노트에서는 Flowers102를 대상으로 `layer4`와 `fc`만 학습시키는 설정이 등장한다. 이 접근은 전체를 다 풀기에는 데이터가 충분하지 않거나 학습 비용을 줄이고 싶을 때 유용하다.

핵심 코드는 아래처럼 읽으면 된다.

```python
# 먼저 전체를 동결한다.
for param in model.parameters():
    param.requires_grad = False

# 마지막 블록(layer4)만 풀어 더 높은 수준 특징을 조정한다.
for param in model.layer4.parameters():
    param.requires_grad = True

# 최종 분류층(fc)은 반드시 학습한다.
for param in model.fc.parameters():
    param.requires_grad = True

# 학습 가능한 파라미터만 optimizer에 넣는다.
optimizer = optim.SGD(
    filter(lambda p: p.requires_grad, model.parameters()),
    lr=0.001,
    momentum=0.9
)
```

이 설정은 "아래쪽 일반 특징은 그대로 두고, 상위 의미 표현과 분류 헤드만 새 작업에 맞춘다"는 전략이다. 전이학습에서 매우 자주 쓰이는 절충안이다.

⚠️ 주의:
- Fine-tuning에서 학습률을 Linear Probing 때처럼 크게 잡으면 기존 가중치가 급격히 흔들릴 수 있다.
- 데이터 증강은 학습용에만 적용하고, 검증·테스트에는 적용하지 않는다.
- 일부 레이어만 학습할 때는 `filter(lambda p: p.requires_grad, model.parameters())`처럼 optimizer 대상도 맞춰 주는 편이 명확하다.

📌 핵심: Fine-tuning은 "사전학습된 표현을 현재 데이터에 맞게 얼마나 조정할지"를 결정하는 문제다.

### 3.7 Optimizer와 Scheduler는 전이학습에서 왜 더 중요할까

전이학습에서는 이미 좋은 초기값이 존재한다. 그래서 처음부터 무작정 빠르게 내려가는 것보다, **현재 가중치를 얼마나 안정적으로 보존하면서 새 작업에 적응시키는가**가 더 중요해진다. 이 때문에 Optimizer와 Scheduler 선택이 체감 성능 차이로 이어지는 경우가 많다.

강의에서는 두 조합을 비교한다.

- **Baseline**: SGD + Momentum + StepLR
- **Experiment**: Adam + ReduceLROnPlateau

#### 두 조합을 해석하는 관점

- `SGD + Momentum`은 흔들림을 줄이며 비교적 안정적으로 학습한다.
- `Adam`은 파라미터별 적응적 학습률을 사용하므로 초반 수렴이 빠를 때가 많다.
- `StepLR`은 미리 정한 시점마다 학습률을 줄인다.
- `ReduceLROnPlateau`는 성능 개선이 멈췄을 때 학습률을 낮춘다.

즉, 전자는 "미리 짠 계획대로 조정"하는 방식이고, 후자는 "학습 상태를 보고 반응적으로 조정"하는 방식이라고 이해해도 된다.

#### 관련 코드: Optimizer/Scheduler 비교 실험

```python
# Baseline: SGD + StepLR
criterion = nn.CrossEntropyLoss()
optimizer = optim.SGD(
    filter(lambda p: p.requires_grad, model.parameters()),
    lr=0.001,
    momentum=0.9
)
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.1)

# Experiment: Adam + ReduceLROnPlateau
optimizer = optim.Adam(
    filter(lambda p: p.requires_grad, model.parameters()),
    lr=0.001
)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(
    optimizer,
    mode="min",
    factor=0.1,
    patience=2
)
```

#### 관찰된 결과

Flowers102 과제 정답 노트에서는 Baseline 조합의 테스트 정확도가 **약 40.23%**, Adam + ReduceLROnPlateau 조합이 **약 87.54%**로 나타난다. 절대값은 실험 환경과 데이터 분할에 따라 달라질 수 있지만, 이번 결과는 적어도 해당 설정에서 **Optimizer와 Scheduler 선택이 단순 부차 요소가 아니라 핵심 설계 요소**임을 보여 준다.

이 결과를 그대로 일반화하면 곤란하지만, 한 가지는 분명하다. 전이학습에서는 모델 구조만큼이나 **어떻게 미세 조정할 것인지**가 성능을 크게 좌우한다.

⚠️ 주의:
- `ReduceLROnPlateau`는 보통 검증 손실이나 에폭 손실 값을 `scheduler.step(metric)` 형태로 넣어 주어야 한다.
- 스케줄러 종류마다 호출 시점이 다르다. `StepLR`은 보통 에폭 끝에서, `ReduceLROnPlateau`는 성능 지표 계산 뒤에 호출한다.

📌 핵심: 전이학습에서는 좋은 초기 가중치를 망치지 않으면서 조심스럽게 적응시키는 학습 전략이 매우 중요하다.

### 3.8 ViT는 CNN과 어떻게 다른가

ViT(Vision Transformer)는 이미지를 더 이상 커널 기반 공간 연산으로만 보지 않는다. 대신 **이미지를 작은 패치 단위로 잘라 토큰처럼 취급한 뒤, Transformer 구조로 처리**한다.

이 관점 전환이 중요한 이유는, CNN이 기본적으로 국소 영역에서 출발하는 반면 ViT는 패치 시퀀스를 통해 전역 관계를 더 직접적으로 다룰 수 있기 때문이다.

#### Patch Embedding의 직관

예를 들어 224×224 이미지를 16×16 패치로 나누면,

- 한 변에 14개 패치
- 전체 14×14 = 196개 패치

가 된다. 각 패치는 일종의 "이미지 토큰"이 되고, 이를 임베딩한 뒤 Transformer Encoder에 넣는다. 즉, 텍스트의 단어 토큰을 처리하듯 이미지를 패치 토큰으로 처리하는 것이다.

#### 관련 코드: ViTImageProcessor와 ViTForImageClassification

```python
import torch
from transformers import ViTImageProcessor, ViTForImageClassification
from PIL import Image

# 1) ViT 전용 전처리기를 불러온다.
processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224")

# 2) 이미지를 읽고, 모델이 기대하는 텐서 형식으로 바꾼다.
image = Image.open("test.jpg")
inputs = processor(images=image, return_tensors="pt")

# 3) 분류 헤드가 포함된 ViT 모델을 불러온다.
model = ViTForImageClassification.from_pretrained("google/vit-base-patch16-224")

# 4) 추론 시에는 기울기가 필요 없으므로 no_grad를 사용한다.
with torch.no_grad():
    outputs = model(**inputs)

# 5) 가장 큰 logit의 클래스를 예측값으로 사용한다.
predicted_class = outputs.logits.argmax(dim=-1).item()
print("predicted class:", predicted_class)
```

#### 코드 흐름 해설

CNN 실습과 비교하면, 가장 눈에 띄는 차이는 우리가 직접 `Resize`, `Crop`, `Normalize`를 세세하게 구성하지 않아도 된다는 점이다. `ViTImageProcessor`가 모델에 맞는 전처리를 맡아준다. 물론 내부적으로는 크기 조정과 정규화가 일어나지만, 사용자는 모델 이름에 맞는 프로세서를 쓰는 것으로 일관성을 확보할 수 있다.

또 하나의 차이는 모델 호출 방식이다. CNN 실습에서는 `model(images)`처럼 바로 텐서를 넣는 느낌이었다면, Hugging Face 쪽은 `inputs` 딕셔너리를 `model(**inputs)`로 넘기는 패턴이 자연스럽다. 즉, 같은 이미지 분류라도 생태계에 따라 인터페이스가 달라진다.

#### CIFAR-10용 ViT 추론

강의 실습에서는 `nateraw/vit-base-patch16-224-cifar10` 모델을 이용해 CIFAR-10 샘플 이미지를 추론하고 시각화한다. 흐름은 다음과 같다.

1. `load_dataset("cifar10")`으로 데이터셋 로드
2. CIFAR-10에 미세 조정된 ViT 모델과 프로세서 로드
3. 샘플 이미지 5장을 선택
4. 각 이미지에 대해 전처리 → 추론 → 예측 클래스 저장
5. 원본 이미지와 예측 라벨을 함께 시각화

#### Pipeline으로 더 간단히 쓰기

```python
from transformers import pipeline

classifier = pipeline(
    "image-classification",
    model="nateraw/vit-base-patch16-224-cifar10"
)

result = classifier(image)
print(result)
```

이 방식은 학습보다는 빠른 실험과 데모에 적합하다. 즉, 구조를 깊게 이해하기 위한 코드는 `processor + model` 조합이 좋고, 빠르게 써보기에는 `pipeline`이 편하다.

⚠️ 주의:
- ViT는 입력 해상도와 패치 크기에 민감하므로, 해당 모델에 맞는 processor를 같이 써야 한다.
- CNN처럼 직접 tensor shape를 다루는 감각과는 조금 다르다. Hugging Face 모델은 보통 프로세서와 모델이 한 쌍으로 움직인다고 생각하는 편이 좋다.

📌 핵심: ViT는 이미지를 패치 시퀀스로 보고 Transformer로 처리한다는 점에서, CNN과는 다른 계산 관점을 제공한다.

## 4. 적용 관점에서 다시 보기

이제 본문에서 본 내용을 실제 문제풀이와 구현 감각으로 다시 묶어 보자. 여기서는 새로운 개념을 추가하기보다, 어떤 상황에서 무엇을 떠올려야 하는지를 정리하는 것이 목적이다.

### 4.1 이미지 분류 문제를 보면 먼저 무엇을 판단할까

첫 번째 판단은 **처음부터 학습할지, 전이학습을 쓸지**다. 데이터가 수천 장 이하 수준이거나 GPU 자원이 충분하지 않다면, 보통은 사전학습 모델을 쓰는 쪽이 훨씬 현실적이다. 이번 강의의 CIFAR-10, 강아지/비강아지, Flowers102 예시가 모두 그 방향을 보여준다.

두 번째 판단은 **학습 범위를 어디까지 열 것인가**다.

- 데이터가 적고 빠른 기준선이 필요하다 → Linear Probing
- 성능이 부족하고 데이터가 어느 정도 있다 → Partial Fine-tuning
- 데이터가 더 충분하고 도메인 차이가 크다 → Full Fine-tuning 고려

세 번째 판단은 **전처리 호환성**이다. ImageNet 사전학습 ResNet을 쓰면 입력 크기와 Normalize를 맞춰야 하고, ViT를 쓰면 모델 이름에 맞는 processor를 써야 한다.

### 4.2 구현 순서를 어떻게 잡으면 덜 헷갈릴까

이미지 분류 실습은 아래 순서로 생각하면 안정적이다.

1. **데이터셋과 전처리 확정**  
   입력 해상도, Normalize 기준, 증강 여부를 먼저 정한다.

2. **모델 로드와 헤드 교체**  
   새 태스크의 클래스 수에 맞게 `fc` 또는 classifier를 교체한다.

3. **동결 범위 결정**  
   `requires_grad`를 어디까지 켤지 정한다.

4. **optimizer 대상 확인**  
   헤드만 학습하는지, 일부 레이어만 학습하는지에 따라 optimizer에 들어가는 파라미터가 달라져야 한다.

5. **학습 루프와 평가 루프 분리**  
   `train()` / `eval()` / `torch.no_grad()` 사용 위치를 분명히 나눈다.

6. **스케줄러 호출 시점 확인**  
   StepLR인지 Plateau 기반인지에 따라 호출 위치를 맞춘다.

이 순서를 먼저 잡고 나면, 실습 코드가 길어도 의미 단위로 읽을 수 있다.

### 4.3 어떤 신호를 보면 전략을 바꿔야 할까

- **Linear Probing 성능이 너무 낮다**  
  백본이 현재 데이터 분포에 충분히 맞지 않는다는 신호일 수 있다. 일부 레이어 또는 전체를 Fine-tuning하는 쪽을 고려한다.

- **학습 손실은 줄지만 검증 성능이 정체된다**  
  과적합 가능성이 있다. 데이터 증강 강화, 학습률 조정, 동결 범위 축소를 생각한다.

- **초반 수렴이 지나치게 느리다**  
  Optimizer나 Scheduler 조합을 다시 보아야 한다. Adam류가 더 유리한지, 스케줄러가 너무 보수적인지 점검한다.

- **ViT를 쓸 때 shape나 전처리 오류가 자주 난다**  
  대개 processor와 모델을 맞지 않게 썼거나, PIL 이미지/텐서 흐름을 섞은 경우가 많다.

### 4.4 자주 틀리는 패턴

⚠️ 주의:
- 사전학습 모델인데 입력 전처리를 임의로 바꿔 버리는 실수
- `model.eval()`을 하지 않고 평가하는 실수
- 동결은 해 놓고 optimizer는 전체 파라미터로 잡는 실수
- `CrossEntropyLoss`와 `softmax`를 중복 적용하는 실수
- 증강을 테스트셋에도 적용하는 실수
- `ReduceLROnPlateau`를 일반 스케줄러처럼 인자 없이 호출하는 실수

🧠 기억할 것: 전이학습 문제의 핵심은 모델을 새로 만드는 것이 아니라, **좋은 백본을 망치지 않으면서 얼마나 잘 적응시키는가**에 있다.

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의 묶음의 가장 큰 장점은 "컴퓨터 비전 모델을 외우는 수업"이 아니라 "이미지 분류를 어떻게 설계할지 생각하는 수업"으로 이어진다는 점이다. CNN의 기본 원리를 먼저 잡아두면 AlexNet과 ResNet은 역사적 이름이 아니라 구조적 해결책으로 읽히고, 전이학습 실습은 단순한 라이브러리 예제가 아니라 현실적인 학습 전략으로 이해된다.

또 하나 중요한 확장 포인트는, CNN과 ViT를 경쟁 관계로만 볼 필요가 없다는 점이다. 이번 강의처럼 CNN으로 이미지 표현 학습의 기본 감각을 익히고, ViT를 통해 패치 기반 전역 모델링 관점을 추가로 이해하면, 이후의 현대 비전 모델을 훨씬 자연스럽게 받아들일 수 있다.

앞으로 더 공부해 볼 만한 주제는 아래와 같다.

- Residual Block을 직접 구현하며 ResNet 구조를 더 깊게 이해하기
- BatchNorm과 Dropout이 학습/평가 모드에서 왜 다르게 동작하는지 살펴보기
- Transfer Learning에서 layer-wise learning rate를 다르게 두는 기법
- ViT의 CLS 토큰, Position Embedding, Self-Attention 시각화
- ConvNeXt, Swin Transformer처럼 CNN과 Transformer의 장점을 잇는 현대 비전 구조

## 6. 요약 정리

📌 핵심

- CNN은 이미지에서 국소 패턴을 추출하고, 이를 점차 추상화해 분류로 연결하는 구조다.
- AlexNet은 딥러닝 기반 이미지 분류 시대를 연 전환점이고, ResNet은 잔차 연결로 깊은 네트워크 학습을 안정화했다.
- 전이학습은 ImageNet 사전학습 모델 같은 강한 백본을 새 작업에 재사용하는 전략이다.
- Linear Probing은 마지막 분류층만 학습하고, Fine-tuning은 일부 또는 전체 레이어를 다시 조정한다.
- 데이터 증강, Optimizer, Scheduler는 Fine-tuning 성능에 큰 영향을 준다.
- ViT는 이미지를 패치 토큰으로 바꾸어 Transformer로 처리하는 구조다.

🧠 기억할 것

- 전이학습에서는 "무엇을 학습할지"보다도 "무엇을 그대로 둘지"가 더 중요할 때가 많다.
- 사전학습 모델은 입력 전처리와 세트로 이해해야 한다.
- 성능이 잘 안 나오면 모델 구조보다 먼저 동결 범위, 학습률, 증강, 스케줄러를 점검하는 편이 실전적이다.
- CNN과 ViT는 둘 다 이미지 분류를 풀지만, 정보를 요약하는 방식이 다르다.

## 7. 미니 퀴즈 또는 체크리스트

1. Linear Probing과 Fine-tuning의 차이를 "학습 가능한 파라미터 범위" 관점에서 설명해 보자.
2. 사전학습된 ResNet을 사용할 때 ImageNet 기준 Normalize를 맞춰 주는 이유는 무엇인가?
3. ResNet의 Residual Connection은 왜 깊은 네트워크 학습을 돕는가?
4. 데이터가 적은 새 이미지 분류 문제를 만났을 때, Full Fine-tuning보다 Partial Fine-tuning을 먼저 고려할 수 있는 이유는 무엇인가?
5. ViT가 이미지를 처리하는 방식은 CNN의 Convolution 방식과 어떻게 다른가?

---

이 노트는 CNN의 기본 원리, 대표 구조, 전이학습 실습, ViT 활용을 한 흐름으로 다시 묶은 복습용 정리본이다. 실제 실습 코드를 떠올릴 때는 **입력 전처리 → 모델 로드 → 헤드 교체 → 동결 범위 결정 → optimizer/scheduler 설정 → 학습/평가 루프** 순서를 함께 기억해 두면 훨씬 덜 흔들린다.
