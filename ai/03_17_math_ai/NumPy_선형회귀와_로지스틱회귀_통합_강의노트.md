# NumPy로 이해하는 선형 회귀와 로지스틱 회귀 통합 강의노트

- 🎯 글의 목표: `diamonds`와 `iris` 데이터셋을 바탕으로, **전처리 → 선형 회귀의 해석적 해법 → 경사하강법 → 미니배치/조기 종료 → 로지스틱 회귀 → L2 정규화와 하이퍼파라미터 실험**까지 하나의 흐름으로 정리한다.
- 🧩 핵심 키워드: 표준화, 정규화, 정규방정식, SVD, 유사역행렬, 최소제곱법, 데이터 분할, 데이터 누수, MSE, 경사하강법, 미니배치, 조기 종료, 시그모이드, BCE, 정확도, L2 정규화, Grid Search
- ⭐ 중요도: 매우 높음
- 📝 한눈에 보는 내용: 이번 강의는 NumPy만으로 머신러닝의 핵심 학습 루프를 직접 구현해 보는 과정이다. 앞부분에서는 `diamonds` 데이터로 **회귀 문제**를 다루고, 뒷부분에서는 `iris` 데이터로 **이진 분류 문제**를 다룬다. 중요한 점은 두 모델이 완전히 다른 것이 아니라, **예측값을 어떻게 만들고 어떤 손실을 줄이느냐**에 따라 문제 유형이 갈린다는 점이다.
- 🔗 관련 문제 / 주제: 데이터 전처리, 선형 회귀, 분류, 최적화, 과적합 방지, 하이퍼파라미터 실험

---

## 1. 들어가며

머신러닝을 처음 배울 때 가장 헷갈리는 지점은, 모델 이름이 많다는 사실보다도 **학습이 실제로 어떻게 돌아가는지 눈으로 잡히지 않는다는 점**이다.  
라이브러리를 쓰면 한 줄로 끝나는 작업도, 직접 구현해 보면 입력이 어떻게 행렬이 되고, 손실이 어떻게 계산되며, 파라미터가 어떤 방향으로 갱신되는지 비로소 연결된다.

이번 강의 묶음은 그 흐름을 단계적으로 밟도록 구성되어 있다.

앞부분은 `diamonds` 데이터셋으로 진행된다. 여기서는 가격(`price`)을 예측하는 **선형 회귀**를 다룬다. 먼저 수치형 피처를 골라 표준화하고, 정규방정식·SVD·최소제곱법으로 해를 구한 다음, 같은 문제를 경사하강법과 미니배치 학습으로 다시 풀어 본다. 즉, **하나의 회귀 문제를 여러 관점에서 푸는 훈련**이다.

뒷부분은 `iris` 데이터셋을 이용한 **이진 분류**로 넘어간다. 이때는 연속값을 그대로 예측하는 대신, 시그모이드 함수를 통해 확률을 만들고, Binary Cross-Entropy 손실을 줄이는 방식으로 학습한다. 마지막에는 L2 정규화와 하이퍼파라미터 탐색까지 이어지면서, 단순 구현을 넘어 **학습 안정성과 일반화 성능을 어떻게 관리하는가**까지 다룬다.

이 강의를 읽을 때는 다음 큰 흐름을 계속 붙잡고 가면 좋다.

> **데이터를 준비하고, 예측을 만들고, 손실을 계산하고, 그 손실을 줄이는 방향으로 파라미터를 갱신한다.**

회귀든 분류든, 이 뼈대는 같다. 달라지는 것은 **출력의 해석**과 **손실 함수의 선택**이다.

---

## 2. 핵심 개념 정리

이번 강의의 큰 흐름은 아래처럼 이어진다.

1. **데이터 전처리**
   - 수치형 열만 골라내기
   - 표준화(Standardization), 정규화(Min-Max Normalization)
   - 학습/검증 분할과 데이터 누수 방지

2. **선형 회귀의 해석적 해법**
   - 정규방정식으로 한 번에 해 구하기
   - `np.linalg.lstsq`로 안정적인 최소제곱해 구하기
   - SVD와 유사역행렬로 역행렬이 없는 경우까지 다루기

3. **선형 회귀의 반복적 최적화**
   - MSE 손실 함수 계산
   - 경사하강법으로 반복 업데이트
   - 학습률이 수렴 속도와 안정성에 미치는 영향 관찰

4. **학습 전략 고도화**
   - Mini-batch Gradient Descent
   - Gradient Accumulation
   - Early Stopping

5. **이진 분류로 확장**
   - 시그모이드 함수
   - BCE(Binary Cross-Entropy)
   - 로지스틱 회귀의 그래디언트 계산
   - 정확도 평가

6. **과적합 제어와 실험**
   - L2 정규화
   - 가중치 감쇠(Weight Decay)
   - 학습률, L2 강도, 누적 스텝 수 조합 실험

여기서 중요한 점은, 각 장이 따로 떨어진 지식이 아니라는 것이다.  
예를 들어 표준화는 단순 전처리 기술이 아니라, **경사하강법이 안정적으로 움직이게 만드는 조건**이 된다. 또 정규방정식과 SVD는 단순한 선형대수 공식이 아니라, **왜 어떤 문제는 한 번에 풀 수 있고 어떤 문제는 반복적으로 풀어야 하는지**를 보여주는 비교 기준이 된다.

이제부터는 이 흐름을 따라, 개념이 등장하는 자리에서 바로 예시와 코드를 함께 붙여 보겠다.

---

## 3. 본문 정리

### 3.1 수치형 데이터 선별과 스케일링

머신러닝에서 전처리는 부수 작업이 아니라, 학습이 제대로 되기 위한 출발점이다.  
특히 `diamonds` 데이터처럼 숫자 열과 범주형 열이 섞여 있는 경우에는, 무엇을 그대로 계산에 넣고 무엇을 다른 방식으로 처리해야 하는지 먼저 구분해야 한다.

연속형 변수와 범주형 변수는 다루는 방식이 다르다.

- **연속형 변수**: `carat`, `depth`, `table`, `x`, `y`, `z`, `price`처럼 수치 연산이 가능한 값
- **범주형 변수**: `cut`, `color`, `clarity`처럼 등급이나 범주를 나타내는 값

회귀 모델을 바로 만들 때는 보통 먼저 **수치형 피처만 선택**한다. 이 단계가 필요한 이유는, 문자열이나 category 타입을 그대로 행렬 연산에 넣을 수 없기 때문이다.

```python
import numpy as np
import seaborn as sns

# diamonds 데이터셋 로드
df = sns.load_dataset("diamonds")

# category 타입 열과 number 타입 열을 각각 분리
categorical_cols = list(df.select_dtypes(include=["category"]).columns)
continuous_cols = list(df.select_dtypes(include=["number"]).columns)

print("범주형 변수:", categorical_cols)
print("연속형 변수:", continuous_cols)
```

이제 연속형 변수만 골랐다고 바로 학습에 넣는 것은 아니다.  
여기서 다음으로 필요한 것이 **스케일링**이다.

#### 왜 스케일링이 필요한가?

서로 다른 피처의 범위가 크게 다르면, 경사하강법이 특정 피처에 끌려가게 된다.  
예를 들어 `carat`은 비교적 작은 범위를 가지지만, `price`는 훨씬 큰 범위를 가진다. 이 상태로 학습하면 손실의 기울기 계산에서 큰 스케일의 값이 더 큰 영향력을 가지게 되고, 학습이 느려지거나 불안정해질 수 있다.

#### 표준화(Standardization)

표준화는 각 피처를 평균 0, 표준편차 1이 되도록 바꾸는 방식이다.

\[
z = \frac{x - \mu}{\sigma}
\]

여기서 중요한 것은 `axis=0`이다.  
정규화는 **샘플별**이 아니라 **피처별**로 해야 하므로, 각 열의 평균과 표준편차를 계산해야 한다.

```python
# 연속형 변수만 NumPy 배열로 추출
X_raw = df[continuous_cols].values

# 각 열(피처)의 평균과 표준편차 계산
mu = np.mean(X_raw, axis=0)
std = np.std(X_raw, axis=0)

# 표준편차가 0인 열이 있으면 1.0으로 대체
# 이렇게 하면 0으로 나누는 문제를 막을 수 있다.
std = np.where(std == 0, 1.0, std)

# 브로드캐스팅을 활용한 표준화
X_norm = (X_raw - mu) / std
```

이 코드는 겉보기에는 짧지만, 실제로는 NumPy의 핵심인 **브로드캐스팅**을 잘 보여준다.  
`X_raw`가 `(m, n)` 모양이고 `mu`, `std`가 `(n,)` 모양이면, NumPy는 자동으로 각 행에 같은 평균과 표준편차를 적용해 준다.

#### Min-Max 정규화

표준화와 함께 비교되는 방식이 **Min-Max 정규화**다.

\[
x' = \frac{x - x_{min}}{x_{max} - x_{min}}
\]

이 방식은 값을 `[0, 1]` 범위로 맞춘다.  
특히 거리 기반 알고리즘(KNN, K-means 등)에서 자주 쓰인다. 스케일이 다른 피처가 거리 계산을 왜곡하는 것을 줄이기 때문이다.

```python
x_min = np.min(X_raw, axis=0)
x_max = np.max(X_raw, axis=0)

denom = np.where((x_max - x_min) == 0, 1.0, (x_max - x_min))
X_minmax = (X_raw - x_min) / denom
```

⚠️ **주의**  
스케일링은 항상 **학습 데이터의 통계값으로 계산하고**, 검증/테스트 데이터는 그 값을 그대로 사용해야 한다.  
검증 데이터의 평균과 표준편차를 따로 구해 버리면, 아직 보지 말아야 할 정보를 학습 단계에 섞어 넣는 셈이 된다.

📌 **핵심**  
표준화와 정규화는 단순한 전처리가 아니라, **학습이 안정적으로 움직이도록 좌표계를 정리하는 과정**이다.

---

### 3.2 선형 회귀를 행렬로 보는 법

선형 회귀는 가장 단순한 회귀 모델이지만, 그 안에 머신러닝의 핵심 구조가 들어 있다.

\[
\hat{y} = \theta_0 + \theta_1 x_1 + \theta_2 x_2 + \cdots + \theta_n x_n
\]

행렬 형태로 쓰면 더 깔끔해진다.

\[
\hat{y} = X_b \theta
\]

여기서 `X_b`는 맨 앞 열에 1을 추가한 설계 행렬이고, `theta`는 절편과 가중치를 함께 담은 파라미터 벡터다.  
절편을 따로 떼지 않고 하나의 행렬 곱으로 표현하기 위해 앞에 1의 열을 붙인다고 이해하면 좋다.

```python
import pandas as pd

# 표준화된 데이터를 DataFrame으로 다시 구성
X_df = pd.DataFrame(X_norm, columns=continuous_cols)

# 피처와 타깃 분리
X = X_df.drop(labels="price", axis=1).values
y = X_df["price"].values

# 절편항을 위한 1의 열 추가
m, n = X.shape
X_b = np.c_[np.ones((m, 1)), X]

print("X_b shape:", X_b.shape)   # (샘플 수, 피처 수 + 1)
```

여기서 `np.c_`는 열 방향 결합을 한다.  
즉, `(m, 1)` 크기의 1 벡터를 기존 피처 행렬 왼쪽에 붙여서, 절편까지 포함한 하나의 설계 행렬을 만든다.

이 구조를 이해해 두면, 뒤에서 정규방정식도, 경사하강법도, 로지스틱 회귀도 모두 훨씬 자연스럽게 읽힌다.  
왜냐하면 공통적으로 **예측 = 입력 행렬 × 파라미터**라는 뼈대를 공유하기 때문이다.

⚠️ **자주 하는 실수**
- `X` shape를 `(m,)`로 두고 바로 계산해서 브로드캐스팅 오류가 나는 경우
- 절편항을 따로 둘지, `X_b`에 합칠지 혼동하는 경우
- `y`를 DataFrame 형태 `(m, 1)`로 두어 shape mismatch가 나는 경우

📌 **핵심**  
선형 회귀는 “값을 맞추는 공식”이 아니라, **행렬 곱으로 예측을 만드는 가장 기본적인 모델 구조**다.

---

### 3.3 정규방정식, SVD, 최소제곱법

선형 회귀는 반복 학습 없이도 해를 한 번에 구할 수 있다.  
이때 쓰는 대표적인 공식이 **정규방정식**이다.

\[
\theta = (X_b^T X_b)^{-1} X_b^T y
\]

이 식은 “MSE를 최소로 만드는 파라미터를 해석적으로 구한다”는 뜻이다.  
즉, 반복해서 조금씩 이동하는 대신, 수학적으로 최적점을 바로 계산한다.

```python
# 1. X_b^T X_b 계산
XT_X = X_b.T @ X_b

# 2. X_b^T y 계산
XT_y = X_b.T @ y

# 3. 역행렬을 사용해 theta 계산
theta_ne = np.linalg.inv(XT_X) @ XT_y

# 4. 예측값 계산
y_pred_ne = X_b @ theta_ne
mse_ne = np.mean((y_pred_ne - y) ** 2)

print("정규방정식 theta:", theta_ne)
print("정규방정식 MSE:", mse_ne)
```

#### 그런데 왜 항상 정규방정식을 쓰지 않을까?

여기서 중요한 한계가 나온다.

- `X_b^T X_b`가 역행렬을 가져야 한다.
- 피처 수가 많아지면 계산량이 커진다.
- 다중공선성처럼 열들이 선형 종속이면 역행렬이 존재하지 않을 수 있다.

이 문제를 더 안정적으로 다루는 방법이 **SVD**와 **유사역행렬**이다.

#### SVD와 유사역행렬

SVD는 행렬을 다음처럼 분해한다.

\[
A = U \Sigma V^T
\]

이 분해를 이용하면 유사역행렬을 만들 수 있다.

\[
A^+ = V \Sigma^+ U^T
\]

그리고 이를 통해 선형 회귀 해를 다음처럼 구한다.

\[
\theta = X_b^+ y
\]

```python
# SVD 수행
U, S, Vt = np.linalg.svd(X_b, full_matrices=False)

# 특이값 역수를 대각행렬로 구성
S_plus = np.diag(1.0 / S)

# 유사역행렬 기반 해
theta_svd = Vt.T @ S_plus @ U.T @ y

y_pred_svd = X_b @ theta_svd
mse_svd = np.mean((y_pred_svd - y) ** 2)

print("SVD theta:", theta_svd)
print("SVD MSE:", mse_svd)
```

실무에서는 직접 SVD를 구성하기보다, `np.linalg.lstsq`나 `np.linalg.pinv`를 더 자주 쓴다.

```python
theta_lstsq, residuals, rank, singular_vals = np.linalg.lstsq(X_b, y, rcond=None)

y_pred_lstsq = X_b @ theta_lstsq
mse_lstsq = np.mean((y_pred_lstsq - y) ** 2)

print("lstsq theta:", theta_lstsq)
print("잔차:", residuals)
print("랭크:", rank)
print("특이값:", singular_vals)
print("lstsq MSE:", mse_lstsq)
```

#### 세 방법을 어떻게 이해하면 좋을까?

- **정규방정식**: 공식이 가장 직관적이다.
- **SVD / 유사역행렬**: 역행렬이 없거나 수치적으로 불안정한 경우를 다룰 수 있다.
- **`np.linalg.lstsq`**: 실전에서 가장 안정적으로 쓰기 좋다.

💡 **포인트**  
세 방법은 결국 같은 최적화 문제를 푸는 서로 다른 관점이다.  
그래서 결과 파라미터가 거의 비슷하게 나온다. 다만 **수치 안정성**과 **예외 상황 대응력**에서 차이가 난다.

⚠️ **자주 하는 실수**
- `Vt`가 이미 전치된 행렬인데 다시 `Vt`를 그대로 써서 shape가 꼬이는 경우
- `X_b` 대신 `X`만 넣어 절편항이 빠지는 경우
- `pinv`와 `inv`의 쓰임새를 혼동하는 경우

📌 **핵심**  
정규방정식은 선형 회귀를 “반복 없이 푸는 방법”이고, SVD와 `lstsq`는 그 해를 **더 안정적으로 구하는 방법**이다.

---

### 3.4 데이터 분할과 데이터 누수 방지

모델이 학습 데이터에만 잘 맞고 새로운 데이터에는 약하다면, 그 모델은 실제로 쓸 수 없다.  
그래서 학습 전에 반드시 **Train / Validation**을 나누어야 한다.

일반적인 흐름은 다음과 같다.

- **Train**: 모델 학습
- **Validation**: 하이퍼파라미터 튜닝, 조기 종료 판단
- **Test**: 최종 성능 평가

이번 강의에서는 `Train 80% / Validation 20%` 구성을 주로 사용한다.

```python
# 예: diamonds 데이터에서 피처와 타깃이 준비된 상태라고 가정
n = len(X)
shuffled_index = np.random.permutation(n)

# 셔플된 인덱스를 X와 y에 동시에 적용
X_shuffled = X[shuffled_index]
y_shuffled = y[shuffled_index]

# 80:20 분할
train_ratio = 0.8
cut = int(n * train_ratio)

X_train = X_shuffled[:cut]
X_valid = X_shuffled[cut:]
y_train = y_shuffled[:cut]
y_valid = y_shuffled[cut:]

print(f"Train: {X_train.shape}, Valid: {X_valid.shape}")
```

여기서 `np.random.permutation`을 쓰는 이유는, **X와 y를 같은 순서로 동시에 섞어야 하기 때문**이다.  
`shuffle`은 원본 배열을 직접 바꾸기 때문에 인덱스를 기준으로 한 일관된 처리가 더 어려울 수 있다.

#### 데이터 누수가 왜 위험한가?

전처리에서 가장 흔한 실수는, 분할 전에 전체 데이터로 평균과 표준편차를 구해 버리는 것이다.

예를 들어 아래는 잘못된 방식이다.

```python
# 잘못된 예시: 전체 데이터 기준 통계값 사용
mu = np.mean(X, axis=0)
sigma = np.std(X, axis=0)
```

이렇게 하면 검증 데이터의 정보가 이미 학습 과정에 들어간다.  
겉으로는 성능이 더 좋아 보일 수 있지만, 실제 새 데이터에서는 같은 성능이 나오지 않는다.

정상적인 방식은 학습 데이터 기준으로만 통계값을 구하는 것이다.

```python
mu = np.mean(X_train, axis=0)
sigma = np.std(X_train, axis=0)

# 표준편차가 0인 열 안전 처리
sigma = np.where(sigma == 0, 1.0, sigma)

# 학습/검증 모두 같은 기준으로 변환
X_train = (X_train - mu) / sigma
X_valid = (X_valid - mu) / sigma
```

#### 왜 표준편차 0을 따로 처리할까?

모든 값이 같은 열은 퍼짐이 없으므로 표준편차가 0이 된다.  
이때 그대로 나누면 0으로 나누는 문제가 생긴다.

`np.where(sigma == 0, 1.0, sigma)`는 이 상황을 안전하게 처리하는 장치다.  
이렇게 하면 해당 열은 `(x - mu) / 1.0 = 0`이 되어, 값이 모두 0인 피처로 남는다.

⚠️ **자주 하는 실수**
- `X_valid`에 `X_train` 기준이 아닌 `X_valid` 기준 평균/표준편차를 다시 적용하는 경우
- 셔플은 했는데 `X`와 `y`를 다른 방식으로 섞는 경우
- 분할한 뒤 shape를 확인하지 않아 인덱스 오류를 뒤늦게 발견하는 경우

📌 **핵심**  
분할은 평가를 위한 장치이고, 전처리는 반드시 **학습 데이터 기준**으로 수행해야 한다. 이 순서를 지켜야 데이터 누수를 막을 수 있다.

---

### 3.5 MSE와 경사하강법

정규방정식은 선형 회귀의 해를 한 번에 구할 수 있지만, 데이터가 크거나 모델이 복잡해지면 반복적 최적화가 더 중요해진다.  
그 대표가 **경사하강법(Gradient Descent)**이다.

경사하강법은 손실 함수의 기울기를 보고, 손실이 줄어드는 방향으로 파라미터를 조금씩 이동시키는 알고리즘이다.

\[
\theta_{t+1} = \theta_t - \alpha \nabla J(\theta_t)
\]

여기서 \(\alpha\)는 학습률이다.  
즉, “한 번에 얼마나 이동할 것인가”를 정하는 값이다.

선형 회귀에서 주로 사용하는 손실은 **MSE**다.

\[
MSE = \frac{1}{n} \sum_{i=1}^{n} (y_i - \hat{y}_i)^2
\]

이 식을 행렬로 전개하고 \(\theta\)에 대해 미분하면, 그래디언트는 다음처럼 정리된다.

\[
\nabla_\theta MSE = \frac{2}{n} X^T(X\theta - y)
\]

직접 구현하면 흐름이 아주 명확해진다.

```python
import numpy as np

def mean_squared_error(X, y, theta):
    # 현재 theta로 예측값 계산
    predictions = X @ theta

    # 예측과 실제값의 차이를 제곱한 뒤 평균
    return np.mean((y - predictions) ** 2)


def gradient_descent(X, y, theta, learning_rate=0.01, iterations=500):
    data_count = len(y)
    cost_list = []

    for iteration in range(iterations):
        # 1. 예측값 계산
        predictions = X @ theta

        # 2. 오차 계산
        error = predictions - y

        # 3. MSE 그래디언트 계산
        gradient = (2 / data_count) * X.T @ error

        # 4. 파라미터 업데이트
        theta = theta - learning_rate * gradient

        # 5. 현재 비용 기록
        cost = mean_squared_error(X, y, theta)
        cost_list.append(cost)

        # 학습 중간 점검
        if iteration % 100 == 0:
            print(f"iteration={iteration:3d}, cost={cost:.6f}")

    return theta, cost_list
```

이 코드의 핵심은 단 네 줄이다.

1. 예측
2. 오차
3. 그래디언트
4. 업데이트

이 4단계가 바로 머신러닝 학습의 가장 기본적인 반복 구조다.

#### 학습률은 왜 중요한가?

같은 그래디언트를 써도 학습률에 따라 결과가 완전히 달라진다.

- 너무 크면: 최솟값을 지나쳐서 발산할 수 있다.
- 너무 작으면: 수렴은 하지만 너무 느리다.
- 적절하면: 안정적으로 빠르게 내려간다.

그래서 실습에서는 학습률을 바꿔 가며 Loss Curve를 그려 보는 것이 중요하다.  
숫자 하나를 바꾸는 일이 아니라, **최적화의 성격이 어떻게 달라지는지 관찰하는 과정**이기 때문이다.

⚠️ **자주 하는 실수**
- `theta -= learning_rate * gradient` 대신 부호를 반대로 써서 손실이 커지는 경우
- 표준화 없이 학습해서 학습률이 지나치게 민감해지는 경우
- 매 반복마다 손실을 기록하지 않아 수렴 여부를 눈으로 확인하지 못하는 경우

📌 **핵심**  
경사하강법은 “공식을 외우는 것”보다, **예측 → 오차 → 그래디언트 → 업데이트**라는 반복 구조를 몸에 익히는 것이 중요하다.

---

### 3.6 미니배치 학습, Gradient Accumulation, Early Stopping

배치 경사하강법은 전체 데이터를 한 번에 사용하므로 안정적이지만, 데이터가 많아지면 메모리 부담이 커진다.  
이때 사용하는 전략이 **Mini-batch Gradient Descent**다.

즉, 전체 데이터를 여러 조각으로 나누고, 작은 묶음(batch) 단위로 그래디언트를 계산해 업데이트한다.

#### 왜 미니배치를 쓸까?

- 한 번에 다 올리지 않아도 되므로 메모리 부담이 줄어든다.
- 전체 배치보다 더 자주 업데이트하므로 학습이 빨라질 수 있다.
- 약간의 노이즈 덕분에 국소적인 지형에서 빠져나오기 쉬울 때도 있다.

#### Gradient Accumulation

배치가 너무 작으면 노이즈가 커질 수 있다.  
그래서 여러 미니배치의 그래디언트를 모아서 한 번에 업데이트하는 방식을 쓰기도 한다. 이것이 Gradient Accumulation이다.

실습 노트북에서는 이를 아주 명확하게 구현했다.

```python
def train_linear_regression_sequential(
    X_b, y,
    alpha=0.01,
    epochs=100,
    tol=None,
    batch_size=None,
    accumulate_steps=1,
):
    m, n = X_b.shape
    theta = np.zeros(n)
    history = []

    # batch_size가 None이면 전체 데이터를 한 배치로 사용
    bs = batch_size or m

    for epoch in range(1, epochs + 1):
        grad_accum = np.zeros_like(theta)  # 그래디언트 누적 버퍼
        accum_count = 0                    # 현재 몇 배치를 누적했는지 기록

        # start:end 인덱스로 순차적 미니배치 구성
        for start in range(0, m, bs):
            end = min(start + bs, m)
            X_batch = X_b[start:end]
            y_batch = y[start:end]

            # 배치 예측과 오차 계산
            y_pred = X_batch @ theta
            error = y_pred - y_batch

            # 현재 배치의 그래디언트
            grad = (2 / X_batch.shape[0]) * X_batch.T @ error

            # 그래디언트 누적
            grad_accum += grad
            accum_count += 1

            # 지정한 횟수만큼 누적되면 평균 그래디언트로 한 번 업데이트
            if accum_count == accumulate_steps or end == m:
                theta -= alpha * (grad_accum / accum_count)
                grad_accum[:] = 0
                accum_count = 0

        # 매 epoch 끝에서 전체 데이터 기준 MSE 계산
        mse = np.mean((X_b @ theta - y) ** 2)
        history.append(mse)
        print(f"Epoch {epoch:3d}/{epochs}    MSE: {mse:.6f}")

        # 충분히 작아지면 조기 종료
        if tol is not None and mse < tol:
            print(f"-> Early stopping at epoch {epoch}, MSE={mse:.6f}")
            break

    return theta, history
```

이 함수는 세 가지를 한 번에 보여 준다.

1. **미니배치**: `range(0, m, bs)`로 배치를 순차적으로 자른다.
2. **누적 업데이트**: 여러 배치의 그래디언트를 모아 한 번 갱신한다.
3. **조기 종료**: 손실이 충분히 작아지면 더 이상 반복하지 않는다.

#### Early Stopping을 어떻게 봐야 할까?

Early Stopping은 단순히 “빨리 끝내기”가 아니다.  
핵심은 **불필요한 학습을 멈추어 과적합과 계산 낭비를 줄이는 것**이다.

실습에서는 `tol` 기준으로 학습 손실이 충분히 작아지면 멈추는 방식을 먼저 보이고, 별도 노트북에서는 검증 손실이 더 좋아지지 않을 때 멈추는 방식도 다룬다. 후자가 실전에서는 더 자주 쓰인다.

#### 배치 크기와 학습률 실험

미니배치 장에서는 배치 크기와 학습률을 바꾸며 학습 곡선을 비교하는 실험도 한다.  
특히 학습률은 다음 식으로 해석하면 이해가 쉽다.

- `1e-5`: 너무 작아서 거의 움직이지 않음
- `0.01`: 대체로 안정적
- `0.05`: 빠르지만 진동 가능
- `1.0`: 지나치게 커서 발산 가능

그래서 Loss Curve를 로그 스케일로 그려 보면, “같이 내려가는 것 같아 보여도 실제 속도 차이가 얼마나 큰지” 더 뚜렷하게 볼 수 있다.

⚠️ **자주 하는 실수**
- 마지막 배치가 `batch_size`보다 작을 수 있다는 점을 놓치는 경우
- 그래디언트를 누적만 하고 초기화하지 않는 경우
- 조기 종료를 학습 손실 기준으로만 보고, 검증 손실은 따로 확인하지 않는 경우

📌 **핵심**  
미니배치와 누적 업데이트는 “학습 수식을 바꾸는 기술”이 아니라, **같은 학습 원리를 더 현실적인 자원 환경에서 쓰기 위한 전략**이다.

---

### 3.7 로지스틱 회귀: 선형 점수를 확률로 바꾸기

이제 문제를 회귀에서 분류로 옮겨 보자.  
`iris` 데이터셋에서는 꽃의 종류를 나누는 문제가 등장하고, 실습에서는 `virginica vs 나머지` 형태의 **이진 분류**로 바꾸어 다룬다.

여기서 중요한 변화는 단 하나다.

> 선형 회귀는 연속값을 그대로 출력하지만, 로지스틱 회귀는 그 선형 점수를 **확률**로 바꾼다.

그 역할을 하는 함수가 **시그모이드**다.

\[
\sigma(z) = \frac{1}{1 + e^{-z}}
\]

- \(z \ll 0\) 이면 출력은 0에 가까워진다.
- \(z = 0\) 이면 출력은 0.5다.
- \(z \gg 0\) 이면 출력은 1에 가까워진다.

즉, 선형 모델의 출력을 바로 클래스가 아니라 **클래스 1일 확률**로 해석할 수 있게 된다.

```python
import numpy as np
import seaborn as sns

# iris 데이터셋 준비
df = sns.load_dataset("iris")
feature_cols = ["sepal_length", "sepal_width", "petal_length", "petal_width"]

X = df[feature_cols].values
y = (df["species"] == "virginica").astype(int).values  # virginica면 1, 아니면 0

# 표준화
X_mean, X_std = X.mean(axis=0), X.std(axis=0)
X_std = np.where(X_std == 0, 1.0, X_std)
X = (X - X_mean) / X_std

# train/valid 분할
dataset_count = len(X)
shuffled_index = np.random.permutation(dataset_count)
cut_index = int(dataset_count * 0.8)

X_train, X_valid = X[shuffled_index[:cut_index]], X[shuffled_index[cut_index:]]
y_train, y_valid = y[shuffled_index[:cut_index]], y[shuffled_index[cut_index:]]
```

시그모이드 구현은 단순하지만, **overflow 방지**를 꼭 넣는 것이 좋다.

```python
def sigmoid(z):
    # 극단적인 값에서 exp overflow를 방지
    z = np.clip(z, -500, 500)
    return 1.0 / (1.0 + np.exp(-z))


def predict_probability(X, W, b):
    # 선형 점수 z = XW + b 를 확률로 변환
    return sigmoid(X @ W + b)
```

이제 분류 기준은 0.5가 된다.

- \(\hat{p} \ge 0.5\) → 클래스 1
- \(\hat{p} < 0.5\) → 클래스 0

이 0.5를 **결정 경계**라고 본다.

#### 왜 로지스틱 회귀가 선형 회귀와 이어지는가?

구조를 비교해 보면 둘은 생각보다 가깝다.

- 선형 회귀: `X @ theta`
- 로지스틱 회귀: `sigmoid(X @ W + b)`

즉, 입력과 가중치의 선형 결합을 먼저 만든다는 점은 같다.  
다만 분류에서는 그 값을 그대로 쓰지 않고, 시그모이드로 눌러서 확률로 해석하는 것이다.

⚠️ **자주 하는 실수**
- `y`가 0/1이 아닌 다중 클래스인데 그대로 BCE에 넣는 경우
- `sigmoid`에서 큰 음수나 큰 양수 때문에 `exp` overflow가 나는 경우
- 예측 확률과 분류 결과(`True/False`)를 혼동하는 경우

📌 **핵심**  
로지스틱 회귀는 완전히 새로운 모델이라기보다, **선형 점수를 확률로 해석하도록 바꾼 선형 모델**이다.

---

### 3.8 BCE 손실, 그래디언트, 정확도

분류에서는 손실 함수도 바뀐다.  
MSE 대신 **Binary Cross-Entropy(BCE)** 를 사용한다.

\[
L = -\frac{1}{m}\sum_{i=1}^{m}\left[y_i \log(\hat{p}_i) + (1 - y_i)\log(1 - \hat{p}_i)\right]
\]

이 식은 “정답 클래스에 높은 확률을 줬는가”를 강하게 평가한다.

- 정답이 1인데 \(\hat{p}=0.99\)면 손실이 매우 작다.
- 정답이 1인데 \(\hat{p}=0.01\)면 손실이 매우 크다.

즉, 틀린 확신에 큰 벌점을 준다.

```python
def binary_cross_entropy(y, p, epsilon=1e-12):
    # log(0)을 피하기 위해 확률 범위를 잘라 준다
    p = np.clip(p, epsilon, 1 - epsilon)

    # BCE 계산
    loss = -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
    return loss
```

#### 그래디언트는 어떻게 생길까?

로지스틱 회귀도 결국 “손실을 줄이는 방향”으로 파라미터를 움직인다.  
시그모이드와 BCE를 함께 미분하면, 결과가 아주 깔끔하게 정리된다.

\[
\nabla_W = \frac{1}{m} X^T(\hat{p} - y)
\]

\[
\nabla_b = \frac{1}{m} \sum_{i=1}^{m}(\hat{p}_i - y_i)
\]

```python
def compute_gradients(X, y, p):
    m = len(y)

    # 예측과 실제의 차이
    diff = p - y

    # 가중치와 편향의 그래디언트
    gradient_W = (X.T @ diff) / m
    gradient_b = np.mean(diff)

    return gradient_W, gradient_b
```

이제 전체 학습 루프를 쓰면 다음과 같다.

```python
# 파라미터 초기화
m, n = X_train.shape
W = np.zeros(n)
b = 0.0

learning_rate = 0.1
epochs = 300
loss_list = []

for epoch in range(epochs):
    # 1. 순전파: 확률 예측
    p = predict_probability(X_train, W, b)

    # 2. 손실 계산
    loss = binary_cross_entropy(y_train, p)
    loss_list.append(loss)

    # 3. 그래디언트 계산
    gradient_W, gradient_b = compute_gradients(X_train, y_train, p)

    # 4. 파라미터 갱신
    W -= learning_rate * gradient_W
    b -= learning_rate * gradient_b

    if epoch % 50 == 0:
        print(f"epoch={epoch:3d}, loss={loss:.6f}")
```

학습이 끝나면 **정확도**로 직관적인 성능을 확인할 수 있다.

```python
def accuracy(X, W, b, y):
    # 예측 확률이 0.5 이상이면 클래스 1
    prediction = predict_probability(X, W, b) >= 0.5

    # 맞춘 비율의 평균
    return np.mean(prediction == y)

print("Train Accuracy:", accuracy(X_train, W, b, y_train))
print("Valid Accuracy:", accuracy(X_valid, W, b, y_valid))
```

#### 왜 MSE 대신 BCE를 쓸까?

분류 문제에서 MSE를 쓰면 학습이 아예 안 되는 것은 아니다.  
하지만 시그모이드와 결합했을 때 그래디언트가 지나치게 작아져 학습이 느려질 수 있다. BCE는 틀린 확률 예측에 더 큰 신호를 보내므로, 분류 문제에 더 잘 맞는다.

⚠️ **자주 하는 실수**
- `np.log(0)` 문제를 방치해서 `-inf`가 나오는 경우
- `prediction`은 `bool`인데 `y` shape가 `(m,1)`이라 비교가 꼬이는 경우
- 확률을 구하는 함수와 정확도를 구하는 함수를 섞어 쓰는 경우

📌 **핵심**  
로지스틱 회귀 학습은 결국 **확률 예측 → BCE 손실 → 그래디언트 → 업데이트** 구조다. 선형 회귀와 같지만, 출력 해석과 손실 함수가 분류에 맞게 바뀌었다.

---

### 3.9 과적합과 L2 정규화

학습이 잘된다는 말은 Train 성능만 높은 것을 뜻하지 않는다.  
Validation에서도 잘 맞아야 한다. 그런데 파라미터가 지나치게 커지고 Train 성능만 계속 올라가면 **과적합**이 발생할 수 있다.

이를 막기 위한 대표적인 방법이 **L2 정규화**다.

\[
L_{\text{total}} = L_{\text{BCE}} + \frac{\lambda}{2}\|W\|_2^2
\]

이 식은 원래 손실(BCE)에다가 “가중치가 너무 커지면 벌점을 준다”는 항을 더한 것이다.

- \(\lambda\)가 0이면 정규화가 없다.
- \(\lambda\)가 너무 크면 가중치를 지나치게 눌러서 과소적합이 생길 수 있다.
- 적절한 \(\lambda\)를 찾는 것이 중요하다.

```python
# 현재 예측 확률
p = predict_probability(X_train, W, b)

# BCE 손실
bce_loss = binary_cross_entropy(y_train, p)

# L2 페널티
l2 = 0.1
l2_penalty = 0.5 * l2 * np.sum(W ** 2)

# 전체 손실
total_loss = bce_loss + l2_penalty
```

여기서 \(\frac{1}{2}\)가 붙는 이유는 미분을 깔끔하게 만들기 위해서다.

\[
\frac{\partial}{\partial W}\left(\frac{\lambda}{2}W^2\right)=\lambda W
\]

즉, 그래디언트는 다음처럼 바뀐다.

\[
\nabla_W = \frac{1}{m} X^T (\hat{p} - y) + \lambda W
\]

\[
\nabla_b = \frac{1}{m} \sum_{i=1}^{m}(\hat{p}_i - y_i)
\]

편향 \(b\)에는 정규화를 적용하지 않는다는 점도 중요하다.  
편향은 모델 전체의 위치를 조정하는 값이므로, 여기에까지 벌점을 강하게 걸면 평균적인 위치조차 잘 맞추지 못할 수 있다.

```python
def compute_gradients_l2(X, y, p, W, l2=0.0):
    m = len(y)

    diff = p - y

    # 기본 그래디언트 + L2 항
    gradient_W = (X.T @ diff) / m + l2 * W

    # 편향에는 L2 정규화를 적용하지 않는다
    gradient_b = np.mean(diff)

    return gradient_W, gradient_b
```

#### 가중치 감쇠(Weight Decay) 관점

업데이트 식을 보면 L2의 효과가 더 잘 보인다.

\[
W \leftarrow W - \alpha(\nabla_W + \lambda W)
\]

이를 정리하면,

\[
W \leftarrow W(1 - \alpha\lambda) - \alpha\nabla_W
\]

즉, 매 스텝마다 가중치가 조금씩 줄어드는 효과가 생긴다.  
그래서 L2 정규화를 **가중치 감쇠(Weight Decay)** 라고도 부른다.

⚠️ **자주 하는 실수**
- `W`뿐 아니라 `b`까지 정규화하는 경우
- 손실에 L2 항은 넣었는데 그래디언트에는 넣지 않는 경우
- `l2`가 너무 커서 학습이 거의 멈추는 경우

📌 **핵심**  
L2 정규화는 손실에 벌점을 더하는 기법이지만, 실제로는 **가중치가 지나치게 커지지 않도록 지속적으로 눌러 주는 장치**로 이해하면 좋다.

---

### 3.10 하이퍼파라미터 실험과 결과 해석

모델을 구현하는 것만으로는 충분하지 않다.  
실제로는 학습률, 정규화 강도, 배치 크기, 누적 스텝 수 같은 하이퍼파라미터가 학습 품질을 크게 바꾼다.

노트북에서는 `itertools.product`를 이용해 여러 조합을 자동으로 만들어 비교한다.

```python
from itertools import product

learning_rates = [0.1, 0.01]
l2_strengths = [0.0, 0.1]
accumulate_steps = [1, 2]

experiments = list(product(learning_rates, l2_strengths, accumulate_steps))
print(experiments)
```

이렇게 하면 \(2 \times 2 \times 2 = 8\)개의 조합이 생긴다.

실험에서는 보통 각 조합마다 모델을 학습시키고,

- Loss Curve가 빠르게 내려가는지
- 진동 없이 안정적으로 수렴하는지
- Validation Accuracy가 높은지

를 함께 본다.

```python
import matplotlib.pyplot as plt

plt.figure(figsize=(10, 6))

for learning_rate, l2_strength, accumulate_step in experiments:
    # 여기서는 예시용으로 train_logistic_l2라는 학습 함수를 쓴다고 가정
    W, b, loss_list = train_logistic_l2(
        X_train, y_train,
        learning_rate=learning_rate,
        epochs=300,
        l2=l2_strength
    )

    val_acc = accuracy(X_valid, W, b, y_valid)

    label = (
        f"lr={learning_rate:.2f}, "
        f"l2={l2_strength:.2f}, "
        f"acc={accumulate_step}, "
        f"Val Acc={val_acc*100:3.1f}%"
    )

    plt.plot(loss_list, label=label)

plt.xlabel("Epochs")
plt.ylabel("Loss")
plt.title("Hyperparameter Comparison")
plt.legend(bbox_to_anchor=(1.05, 1), loc="upper left")
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()
```

#### 결과를 볼 때 무엇을 읽어야 할까?

단순히 마지막 Accuracy 숫자만 보는 것은 부족하다.

- **수렴 속도**: 초반에 얼마나 빠르게 내려가는가
- **안정성**: Loss가 매끄럽게 감소하는가, 크게 출렁이는가
- **최종 성능**: Validation Accuracy가 좋은가
- **과적합 신호**: Train 성능과 Validation 성능 차이가 큰가

이렇게 보면 하이퍼파라미터 실험은 “좋은 숫자 찾기”가 아니라,  
**모델이 어떤 성격으로 학습되는지 읽는 과정**이 된다.

⚠️ **주의**
- 학습률이 너무 크면 Loss가 발산할 수 있다.
- L2가 너무 크면 모델이 거의 아무것도 학습하지 못할 수 있다.
- 셔플링에 따라 결과가 조금씩 달라질 수 있으므로, 한 번의 결과만 절대적인 기준으로 삼지는 않는다.

📌 **핵심**  
하이퍼파라미터 튜닝은 구현의 부록이 아니라, **학습 곡선을 읽고 모델의 성격을 조절하는 과정**이다.

---

## 4. 적용 관점에서 다시 보기

여기까지의 내용을 실제 문제풀이와 구현 관점에서 다시 묶어 보면, 몇 가지 신호가 분명해진다.

### 4.1 회귀 문제를 보면 먼저 무엇을 떠올릴까?

타깃이 연속형 값이라면, 가장 먼저 선형 회귀를 떠올릴 수 있다.  
이때 구현 순서는 대체로 다음처럼 잡으면 된다.

1. 수치형 피처 선택
2. Train / Validation 분할
3. Train 기준 표준화
4. 절편항 포함 여부 결정
5. 해석적 해법(정규방정식 / lstsq)으로 기준선 확인
6. 경사하강법으로 반복 학습 구현
7. Loss Curve와 Validation 성능 확인

즉, 단순히 “경사하강법 코드를 짠다”가 아니라,  
**같은 문제를 해석적 해법과 반복적 해법으로 모두 바라볼 수 있어야 한다**는 점이 중요하다.

### 4.2 분류 문제를 보면 무엇이 달라지는가?

타깃이 0/1 클래스라면, 선형 회귀 공식을 그대로 쓰는 것이 아니라 다음 신호를 잡아야 한다.

- 출력은 확률이어야 한다 → **시그모이드**
- 손실은 BCE가 자연스럽다 → **Binary Cross-Entropy**
- 최종 판정은 임계값 기준이다 → **0.5 decision boundary**

즉, 입력과 가중치의 선형 결합이라는 골격은 유지하되, **출력을 어떻게 해석할지**가 달라진다.

### 4.3 데이터 누수는 언제 의심해야 할까?

다음 상황이 보이면 데이터 누수를 바로 의심해야 한다.

- 검증 성능이 비정상적으로 높다.
- 분할 전에 표준화나 피처 엔지니어링을 해 버렸다.
- 검증 데이터에도 자체 평균/표준편차를 다시 계산했다.

실전에서는 “분할 → Train 기준 변환 → Valid/Test에 동일 기준 적용” 순서를 습관처럼 지켜야 한다.

### 4.4 학습이 잘 안 될 때 어떤 순서로 점검할까?

학습이 안 되면 보통 아래 순서로 점검하는 것이 효율적이다.

1. **shape 확인**
   - `X`, `y`, `theta`, `W`, `b`가 의도한 차원인지
2. **스케일 확인**
   - 표준화가 제대로 되었는지
3. **손실 감소 여부 확인**
   - Loss Curve가 실제로 내려가는지
4. **학습률 점검**
   - 너무 크거나 작은지
5. **손실 함수와 문제 유형의 일치 여부 확인**
   - 회귀인데 BCE를 쓰거나, 분류인데 MSE를 쓰고 있지 않은지
6. **전처리 순서 확인**
   - 데이터 누수는 없는지

### 4.5 어떤 실수를 특히 경계해야 할까?

- 회귀/분류 문제를 구분하지 않고 손실 함수를 섞어 쓰는 실수
- 표준화 통계값을 전체 데이터에서 뽑는 실수
- 마지막 작은 배치를 처리하지 않는 실수
- `bool` 예측과 `int` 라벨 shape가 맞지 않는 실수
- `inv`가 안 되는 행렬에 무조건 정규방정식을 적용하는 실수

결국 구현 문제는 대부분 “공식이 어려워서”보다, **형태(shape), 순서(order), 기준(reference)** 를 놓쳐서 틀린다.  
그래서 코드를 짤 때는 수식보다 먼저 **입력과 출력이 어떤 모양으로 흐르는지**를 점검하는 습관이 중요하다.

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의 묶음의 가장 큰 장점은, 모델을 라이브러리 호출 결과가 아니라 **직접 조립되는 구조물**로 보게 만든다는 점이다.

앞부분에서는 선형 회귀를 해석적으로 풀 수 있다는 사실을 배웠다.  
정규방정식, SVD, 최소제곱법은 모두 같은 문제를 다른 수학적 시선으로 본 것이다. 이 비교를 통해 “왜 어떤 해법은 빠르지만 불안정하고, 어떤 해법은 더 안정적인가”를 이해할 수 있다.

중간에서는 경사하강법이 등장하면서, 머신러닝의 공통 학습 루프가 선명해진다.  
예측을 만들고, 손실을 계산하고, 그래디언트를 구해 업데이트하는 흐름은 이후의 거의 모든 모델 학습에 반복된다. 선형 회귀를 직접 구현해 보는 일은, 사실상 딥러닝까지 이어지는 학습 구조의 입문이다.

뒷부분에서는 로지스틱 회귀와 L2 정규화가 연결되면서, 회귀와 분류가 생각보다 멀리 떨어져 있지 않다는 점도 보게 된다.  
결국 입력을 선형 결합하는 뼈대는 같고, 문제 유형에 따라 **출력 변환 함수와 손실 함수가 달라질 뿐**이다.

앞으로 더 공부해 볼 만한 확장 포인트는 다음과 같다.

- 선형 회귀의 다중공선성과 조건수(condition number)
- 로지스틱 회귀의 결정 경계 시각화
- L1 정규화와 Elastic Net 비교
- Momentum, RMSProp, Adam 같은 고급 옵티마이저
- 다중 클래스 분류를 위한 Softmax 회귀

즉, 이번 강의는 단지 “NumPy로 모델 하나 만들기”가 아니라,  
**머신러닝 구현의 공통 문법을 익히는 출발점**이라고 볼 수 있다.

---

## 6. 요약 정리

📌 **핵심**

- 표준화와 정규화는 학습이 안정적으로 일어나기 위한 전처리다.
- 선형 회귀는 \(X_b \theta\) 형태의 행렬 곱으로 예측을 만든다.
- 정규방정식은 선형 회귀 해를 한 번에 구하는 방법이고, `lstsq`와 SVD는 더 안정적인 해법이다.
- 경사하강법은 **예측 → 손실 → 그래디언트 → 업데이트** 반복 구조로 이해해야 한다.
- 미니배치, Gradient Accumulation, Early Stopping은 같은 학습 원리를 더 현실적인 방식으로 운용하는 전략이다.
- 로지스틱 회귀는 선형 점수를 시그모이드로 확률로 바꾼다.
- 분류에서는 BCE가 핵심 손실 함수이고, 정확도는 0.5 기준 분류 결과로 계산한다.
- L2 정규화는 가중치가 지나치게 커지는 것을 막아 과적합을 줄인다.
- 하이퍼파라미터 실험은 단순 수치 비교가 아니라, 학습 곡선의 성격을 읽는 과정이다.

🧠 **기억할 것**

- 전처리는 반드시 **분할 후, Train 기준**으로 한다.
- `inv`가 불안정하면 `lstsq`나 `pinv`를 떠올린다.
- 학습률은 구현의 세부값이 아니라, 학습 성공 여부를 좌우하는 핵심 하이퍼파라미터다.
- 회귀와 분류는 다르지만, 학습의 큰 뼈대는 같다.
- 코드가 막히면 공식보다 먼저 **shape, 데이터 타입, 전처리 순서**를 점검한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 표준화를 할 때 `axis=0`을 사용하는 이유를, “행과 열 중 무엇의 통계값을 구하는가” 관점에서 설명해 보자.

2. 정규방정식과 `np.linalg.lstsq`가 같은 문제를 푼다고 할 때, 실무에서 `lstsq`를 더 선호하는 이유는 무엇인가?

3. 데이터 분할 후 표준화를 해야 하는 이유를, 데이터 누수 관점에서 설명해 보자.

4. 선형 회귀와 로지스틱 회귀가 공유하는 구조와 달라지는 요소를 각각 정리해 보자.

5. L2 정규화가 손실 함수와 그래디언트에 어떤 항을 추가하는지, 그리고 왜 편향에는 보통 적용하지 않는지 설명해 보자.

### 체크리스트

- [ ] 연속형 변수와 범주형 변수를 구분할 수 있다.
- [ ] 표준화와 Min-Max 정규화의 차이를 설명할 수 있다.
- [ ] 정규방정식, SVD, `lstsq`의 관계를 설명할 수 있다.
- [ ] MSE 기반 경사하강법을 직접 구현할 수 있다.
- [ ] 미니배치와 Gradient Accumulation의 목적을 설명할 수 있다.
- [ ] 시그모이드 함수와 BCE 손실의 역할을 설명할 수 있다.
- [ ] 로지스틱 회귀의 정확도 계산 과정을 구현할 수 있다.
- [ ] L2 정규화가 과적합을 줄이는 원리를 설명할 수 있다.
- [ ] 하이퍼파라미터 실험 결과를 Loss Curve 기준으로 해석할 수 있다.
