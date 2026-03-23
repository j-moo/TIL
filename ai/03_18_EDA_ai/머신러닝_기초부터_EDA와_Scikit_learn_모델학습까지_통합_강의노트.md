# 머신러닝 기초부터 EDA와 Scikit-learn 모델 학습까지

- 🎯 글의 목표: 업로드된 여러 강의 노트의 흐름을 하나로 묶어, **머신러닝의 큰 그림 → EDA → 전처리 → 회귀/분류 모델 학습 → 평가 → 확장 주제(PCA, KMeans)**까지 한 번에 복습할 수 있는 설명형 강의노트로 정리한다.
- 🧩 핵심 키워드: 머신러닝, 학습과 추론, EDA, 상관관계, 분포, 결측치, 이상치, 표준화, 데이터 누수, 선형 회귀, 로지스틱 회귀, MAE, MSE, R², Accuracy, F1-score, ROC-AUC, 교차검증, PCA, KMeans
- ⭐ 중요도: 매우 높음. 이번 내용은 이후의 모델링 실습에서 반복해서 다시 쓰이는 기본 문법이자 사고 흐름이다.
- 📝 한눈에 보는 내용:  
  1) 머신러닝이 무엇을 하는지 이해하고  
  2) 데이터를 보기 전에 먼저 EDA로 구조를 파악한 뒤  
  3) train/test 분할과 표준화 같은 전처리를 거쳐  
  4) 회귀와 분류 모델을 학습하고  
  5) 지표와 시각화로 해석하는 흐름을 익힌다.
- 🔗 관련 문제 / 주제(있다면): tips 데이터셋, mpg 데이터셋, wine 데이터셋, Boston Housing(OpenML), 선형 회귀, 로지스틱 회귀, PCA, KMeans

---

## 1. 들어가며

이번 강의 묶음은 겉으로 보면 서로 다른 주제를 다루는 것처럼 보이지만, 실제로는 하나의 흐름으로 연결된다.  
처음에는 머신러닝이 무엇인지, 모델을 학습한다는 말이 정확히 무슨 뜻인지부터 출발한다. 그 다음에는 데이터를 **바로 모델에 넣지 않고 먼저 살펴보는 과정**, 즉 EDA를 배운다. 그리고 나서야 비로소 데이터를 나누고, 정리하고, 표준화한 뒤 모델을 학습한다.

여기서 중요한 점은, **모델링 자체보다도 모델링 전에 해야 할 준비가 훨씬 많다**는 사실이다.  
강의의 초반부가 선형 회귀와 로지스틱 회귀의 개념을 설명하는 데 집중했다면, 뒤쪽 실습은 그 개념이 실제 데이터셋에서 어떻게 구현되는지 보여준다. 그래서 이 노트는 개념과 실습을 따로 떼어 보지 않고, **"왜 이런 전처리가 필요한지"와 "코드에서 그 개념이 어떻게 나타나는지"**를 같은 자리에서 같이 정리한다.

이 문서를 읽을 때는 아래 흐름을 머릿속에 두고 따라가면 좋다.

- 머신러닝은 **데이터로부터 규칙을 찾는 과정**이다.
- 좋은 규칙을 찾으려면 먼저 **데이터의 상태를 이해**해야 한다.
- 데이터의 상태를 이해하면 **어떤 전처리와 어떤 지표가 필요한지**가 보인다.
- 그 다음에야 회귀든 분류든 **모델 선택과 평가가 의미를 갖는다**.

---

## 2. 핵심 개념 정리

이번 강의 전체를 한 장으로 요약하면 다음과 같다.

### 2-1. 머신러닝의 큰 그림
머신러닝은 입력 \(X\)와 정답 \(y\) 사이의 관계를 학습해, 새로운 \(X\)가 들어왔을 때 적절한 예측값을 내놓는 과정이다.  
이때 모델을 만드는 과정이 **학습(training)**이고, 학습된 모델로 새로운 값을 맞히는 과정이 **추론(inference)**이다.

### 2-2. EDA는 모델링의 준비 단계가 아니라, 모델링의 방향을 정하는 단계다
EDA를 하면 데이터의 크기, 컬럼 구성, 결측치 여부, 분포, 변수 간 상관관계를 볼 수 있다.  
이 과정에서 어떤 변수가 중요한지, 이상치가 심한지, 표준화가 필요한지 같은 판단이 나온다.

### 2-3. 전처리에서 가장 중요한 두 단어는 "분리"와 "기준"이다
- **분리**: train / validation / test를 나눈다.
- **기준**: 평균, 표준편차, IQR 같은 기준값은 반드시 **train 데이터에서만 계산**한다.

이 지점을 놓치면 데이터 누수(data leakage)가 생기고, 검증 성능이 실제보다 좋게 보이는 문제가 생긴다.

### 2-4. 회귀와 분류는 출력의 성격이 다르다
- **선형 회귀**는 연속형 값을 예측한다. 예: 집값, 팁, 매출
- **로지스틱 회귀**는 범주를 분류한다. 예: 합격/불합격, 정상/비정상, 클래스 0/1

그래서 같은 "회귀"라는 이름이 붙어 있지만, 예측 방식과 손실 함수, 평가 지표가 다르다.

### 2-5. 평가지표는 문제의 종류에 맞춰 써야 한다
- 회귀: MAE, MSE, RMSE, R²
- 분류: Accuracy, Precision, Recall, F1-score, ROC-AUC, Confusion Matrix

### 2-6. 확장 주제는 "데이터를 더 잘 보거나 더 잘 나누는 법"이다
- **PCA**는 고차원 데이터를 낮은 차원으로 줄여 구조를 더 쉽게 보게 해 준다.
- **KMeans**는 정답 라벨 없이 비슷한 데이터끼리 묶는다.
- **교차검증**은 한 번의 train/test 분할 결과만 믿지 않기 위해 여러 번 나누어 평균 성능을 본다.

이제부터는 이 큰 그림을 본문에서 실제 예시와 코드 흐름으로 풀어본다.

---

## 3. 본문 정리

## 3.1 머신러닝은 무엇을 학습하는가

머신러닝의 핵심은 "정답표를 외우는 것"이 아니라, **입력과 출력 사이의 규칙을 찾는 것**이다.  
Easy 노트에서는 tips 데이터셋을 예로 들어, `total_bill`이 커질수록 `tip`도 대체로 커지는 관계를 직선으로 근사하는 방식으로 선형 회귀를 소개했다.

쉽게 말하면, 선형 회귀는 흩어진 점들 사이를 가장 잘 설명하는 추세선을 찾는 과정이다.  
로지스틱 회귀는 같은 아이디어를 분류 문제에 적용한 것으로, 이번에는 직선 대신 **확률**을 다룬다.

### 예시: 학습과 추론의 기본 흐름

```python
import seaborn as sns
from sklearn.linear_model import LinearRegression

# 1. 데이터 불러오기
tips = sns.load_dataset("tips")

# 2. 입력(X)과 정답(y) 분리
# sklearn 모델은 보통 X를 2차원 배열로 받으므로 reshape이 필요하다.
X = tips["total_bill"].values.reshape(-1, 1)
y = tips["tip"].values

# 3. 모델 생성
# 아직은 규칙을 모르는 '빈 모델' 상태다.
model = LinearRegression()

# 4. 학습
# 내부적으로 total_bill과 tip 사이의 가장 잘 맞는 직선을 계산한다.
model.fit(X, y)

# 5. 추론(예측)
# 학습된 직선을 바탕으로 각 입력에 대한 예측 팁을 구한다.
y_hat = model.predict(X)
```

이 코드에서 중요한 점은, `fit`과 `predict`가 완전히 다른 역할을 가진다는 점이다.  
`fit`은 규칙을 만드는 단계이고, `predict`는 만든 규칙을 사용하는 단계다. 이 구분이 이후 모든 sklearn 실습의 공통 문법이 된다.

### 자주 하는 실수 / 디버깅 포인트
- `X`를 1차원으로 넣으면 오류가 나는 경우가 많다. sklearn의 회귀 모델은 보통 `(샘플 수, 특성 수)` 형태를 기대한다.
- `fit`을 하기 전에 `predict`를 호출하면 당연히 학습된 계수가 없으므로 사용할 수 없다.

📌 핵심: **머신러닝 코드는 결국 `데이터 준비 → 모델 생성 → fit → predict`라는 공통 흐름으로 읽으면 훨씬 덜 헷갈린다.**

---

## 3.2 EDA는 왜 모델보다 먼저 와야 하는가

EDA(탐색적 데이터 분석)는 그럴듯한 그래프를 그리는 작업이 아니라, **데이터가 어떤 상태인지 확인하는 첫 점검 단계**다.  
강의에서는 `mpg`, `wine`, `Boston Housing(OpenML)` 데이터를 번갈아 보면서, EDA가 항상 거의 같은 질문에서 시작된다는 점을 보여준다.

- 데이터는 몇 개나 있는가?
- 어떤 컬럼들로 구성되어 있는가?
- 결측치는 있는가?
- 수치 범위는 어떤가?
- 타깃과 관련이 큰 변수는 무엇인가?

### 예시: 가장 기본적인 EDA 시작점

```python
import seaborn as sns

# seaborn 내장 데이터셋 로드
df = sns.load_dataset("mpg")

# 앞부분 몇 줄로 컬럼 구성을 감 잡기
df.head()

# 데이터 타입, 결측치, 전체 개수 확인
df.info()

# 수치형 컬럼의 대표 통계량 확인
df.describe()
```

이 세 줄기만 잘 봐도 이미 많은 정보가 나온다.

- `head()`는 데이터가 어떤 컬럼으로 이루어졌는지 감을 잡게 해 준다.
- `info()`는 컬럼별 타입과 결측치 유무를 보여준다.
- `describe()`는 평균, 표준편차, 최소/최대, 사분위수를 통해 분포의 윤곽을 보여준다.

예를 들어 `mpg` 데이터에서는 `horsepower`에 결측치가 있다는 사실을 `info()`에서 바로 확인할 수 있었다.  
이 정보는 나중에 pairplot이나 모델 학습을 하기 전에 무엇을 먼저 처리해야 하는지 결정하는 기준이 된다.

### 자주 하는 실수 / 디버깅 포인트
- `describe()`만 보고 데이터를 다 안다고 착각하기 쉽다. 하지만 범주형 컬럼이나 결측치는 `info()`를 같이 봐야 제대로 드러난다.
- EDA를 건너뛰면, 뒤에서 모델이 왜 이상하게 동작하는지 원인을 찾기 어려워진다.

📌 핵심: **EDA는 보기 좋은 그래프를 위한 단계가 아니라, 전처리와 모델 선택의 방향을 정하는 단계다.**

---

## 3.3 상관관계와 분포는 어떻게 읽어야 하는가

변수 간 관계를 보는 가장 기본적인 관찰 도구는 **산점도(scatterplot)**와 **상관계수(correlation)**다.  
강의에서는 `mpg` 데이터와 `wine` 데이터, `Boston Housing` 데이터를 통해 이 두 가지를 반복해서 확인했다.

여기서 중요한 점은, 상관계수는 숫자로 요약한 관계이고, 산점도는 그 관계가 실제로 어떤 모양인지 보여준다는 점이다.  
둘은 대체 관계가 아니라 **서로 보완 관계**다.

### 상관관계 확인 코드

```python
import seaborn as sns
import numpy as np

df = sns.load_dataset("mpg")

# 수치형 컬럼끼리 상관계수 행렬 계산
corr = df.corr(numeric_only=True)

# 히트맵으로 시각화
sns.heatmap(corr, annot=True, cmap="coolwarm", linewidths=1)
```

히트맵은 변수 쌍 전체를 한눈에 볼 수 있다는 장점이 있다.  
하지만 히트맵만 보면 관계의 모양은 알기 어렵다. 그래서 산점도를 같이 봐야 한다.

### 산점도 예시

```python
import seaborn as sns

df = sns.load_dataset("mpg")

# 두 변수 사이의 관계를 실제 점의 형태로 확인
sns.scatterplot(data=df, x="weight", y="acceleration", alpha=0.7)
```

산점도를 보면 선형인지, 곡선인지, 이상치가 섞여 있는지, 클래스별로 구분이 되는지 같은 정보가 드러난다.

### 분포 시각화 예시

```python
import seaborn as sns
import matplotlib.pyplot as plt

df = sns.load_dataset("mpg")

# 한 컬럼이 어떤 분포를 가지는지 확인
sns.histplot(df["weight"], bins=20, kde=True, color="skyblue")
plt.title("Weight Distribution")
plt.show()
```

분포를 보는 이유는 단순히 예쁘게 보기 위해서가 아니다.  
분포를 보면 값이 한쪽으로 치우쳐 있는지, 중심이 어디에 있는지, 극단값이 있는지, 표준화가 왜 필요한지 감이 잡힌다.

### wine 데이터에서 상관관계와 pairplot 연결하기

실습 노트에서는 와인 데이터셋에서 타깃(`quality`)과 가장 관련이 큰 상위 특성들을 먼저 찾고, 그 변수들만 뽑아 pairplot으로 관계를 한 번에 시각화했다.

```python
import seaborn as sns
import matplotlib.pyplot as plt

# corr는 이미 계산되어 있다고 가정
corr_with_quality = corr["quality"].abs().sort_values(ascending=False)

# quality 자신을 제외하고 상위 5개 선택
top_features = corr_with_quality.index[1:6]

# 선택된 특성과 타깃만 모아서 pairplot
plot_df = df[top_features.tolist() + ["quality"]]
sns.pairplot(data=plot_df, hue="quality", corner=True)
plt.show()
```

이 흐름이 중요한 이유는, pairplot을 그냥 무턱대고 전 컬럼에 그리는 것이 아니라 **EDA로 중요해 보이는 변수부터 좁혀서 본다**는 사고를 보여주기 때문이다.

### 자주 하는 실수 / 디버깅 포인트
- 상관계수가 크다고 무조건 인과관계가 있다고 해석하면 안 된다.
- pairplot은 컬럼이 많으면 너무 복잡해진다. 먼저 상관관계나 도메인 지식으로 후보를 줄이는 편이 좋다.
- 결측치가 있는 상태에서는 pairplot이나 일부 시각화 함수가 에러를 낼 수 있다.

📌 핵심: **상관계수는 관계를 요약한 숫자이고, 산점도와 pairplot은 그 관계의 실제 모양을 보여준다. 둘을 같이 봐야 해석이 완성된다.**

---

## 3.4 결측치와 이상치는 어떻게 다뤄야 하는가

EDA를 하다 보면 "값이 비어 있는 경우"와 "값이 지나치게 튀는 경우"를 자주 만난다.  
강의 실습에서는 wine 데이터에 일부 결측치와 이상치를 인위적으로 만들어 본 뒤, 이를 처리하는 흐름을 단계별로 익혔다. 이 방식이 좋은 이유는, 왜 이런 처리가 필요한지를 눈으로 확인할 수 있기 때문이다.

### IQR 기반 이상치 탐지 함수

```python
def detect_outliers_iqr(data, column):
    # 1사분위수, 3사분위수 계산
    Q1 = data[column].quantile(0.25)
    Q3 = data[column].quantile(0.75)

    # 사분위 범위(IQR)
    IQR = Q3 - Q1

    # IQR 기준으로 이상치 경계 설정
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR

    # 경계를 벗어나는 행만 반환
    return data[(data[column] < lower_bound) | (data[column] > upper_bound)]
```

이 함수는 매우 자주 쓰이는 전형적인 이상치 탐지 패턴이다.  
핵심은 평균이나 표준편차가 아니라, **사분위수 기반의 경계**를 쓴다는 점이다. 그래서 극단값에 조금 더 덜 민감하게 범위를 잡을 수 있다.

### 결측치 대체와 이상치 제거

```python
# 결측치는 수치형 컬럼의 평균값으로 채운다.
df_filled = df_missing.fillna(df_missing.mean(numeric_only=True))

# 앞에서 찾은 이상치 인덱스를 제외하고 새로운 데이터프레임을 만든다.
df_no_outliers = df_filled[~df_filled.index.isin(outliers_alcohol.index)]
```

물론 실제 현업에서는 결측치를 무조건 평균으로 채우는 것이 항상 정답은 아니다.  
하지만 이번 실습의 목적은 **처리 흐름을 익히는 것**이므로, 가장 기본적인 방법부터 시작한 것이다.

### 쉬운 해설
- 결측치는 "값이 없는 상태"이므로, 모델이 읽을 수 있게 먼저 채우거나 제거해야 한다.
- 이상치는 "대부분의 패턴과 다른 값"이므로, 그대로 두면 모델이 그 몇 개의 극단값에 끌려갈 수 있다.

### 자주 하는 실수 / 디버깅 포인트
- 결측치와 이상치를 train/test 분할 전에 전부 처리해버리면, 나중에 데이터 누수 문제가 생길 수 있다.
- 어떤 이상치가 진짜 오류인지, 실제로 드문 정상값인지 구분 없이 제거하면 정보 손실이 발생할 수 있다.

📌 핵심: **결측치와 이상치 처리는 데이터를 깨끗하게 만드는 작업이 아니라, 모델이 '잘못된 기준'을 배우지 않게 하는 작업이다.**

---

## 3.5 데이터 분할과 표준화: 전처리에서 가장 많이 틀리는 부분

전처리에서 가장 자주 나오는 실수는 두 가지다.

1. train/test를 나누기 전에 전체 데이터 기준으로 표준화해버리는 것  
2. 이상치 경계나 평균/표준편차를 test 데이터까지 포함해서 계산하는 것

이 둘은 모두 **데이터 누수**로 이어진다.  
그래서 강의 실습에서는 이 기준을 매우 분명하게 강조했다. 모든 기준값은 train에서만 구하고, test는 그 기준으로 "변환만" 해야 한다.

### 기본적인 train/test 분할

```python
from sklearn.model_selection import train_test_split

# 입력과 타깃 분리
X = df.drop("MEDV", axis=1)
y = df["MEDV"]

# 회귀 문제에서는 y를 구간으로 나눠 stratify 대용으로 쓰기도 한다.
stratify_bins = pd.qcut(y, q=10, labels=False, duplicates='drop')

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.3,
    random_state=42,
    stratify=stratify_bins
)
```

여기서 `random_state`는 결과를 재현 가능하게 만들고, `stratify`는 분할된 데이터의 분포가 크게 흔들리지 않도록 돕는다.  
분류 문제에서는 원래 라벨을 stratify에 넣고, 회귀 문제에서는 이렇게 구간을 나눠 근사적으로 사용하기도 한다.

### StandardScaler로 표준화하기

```python
from sklearn.preprocessing import StandardScaler

# 연속형 컬럼만 따로 표준화
scaler = StandardScaler()

# 1. train 데이터에서 평균과 표준편차를 학습
X_train_scaled_num = scaler.fit_transform(X_train[continuous_cols])

# 2. test 데이터는 train에서 배운 기준으로만 변환
X_test_scaled_num = scaler.transform(X_test[continuous_cols])

# 3. 결과를 다시 원래 DataFrame에 반영
X_train[continuous_cols] = X_train_scaled_num
X_test[continuous_cols] = X_test_scaled_num
```

### 쉬운 해설
표준화는 각 컬럼을 평균 0, 표준편차 1 근처로 맞추는 작업이다.  
이렇게 하면 값의 크기 차이가 큰 변수들이 모델 학습을 지나치게 지배하는 것을 막을 수 있다.

특히 로지스틱 회귀나 거리 기반 알고리즘은 스케일 차이에 영향을 많이 받으므로, 표준화는 사실상 기본 전처리처럼 다뤄진다.

### 자주 하는 실수 / 디버깅 포인트
- `fit_transform()`을 train과 test에 각각 해버리면 안 된다.
- 범주형 컬럼까지 무조건 표준화하면 해석이 이상해질 수 있다.
- 실습 코드에서는 `continuous_cols`와 범주형 컬럼을 분리해서 처리했다. 이 분리가 생각보다 중요하다.

📌 핵심: **표준화의 수식보다 더 중요한 것은, 그 수식의 기준값을 어디서 계산했는가이다. 기준은 항상 train이다.**

---

## 3.6 선형 회귀: 오차를 줄이며 추세선을 찾는 법

선형 회귀는 가장 단순한 모델처럼 보이지만, 그 안에는 머신러닝의 핵심 요소가 거의 다 들어 있다.  
입력과 출력의 관계를 함수로 표현하고, 예측값과 실제값의 차이를 오차로 정의하고, 그 오차를 줄이도록 파라미터를 찾는다.

### 3.6.1 선형 회귀의 기본 식

가장 단순한 1차원 선형 회귀는 아래처럼 쓸 수 있다.

\[
\hat{y} = ax + b
\]

여기서 \(a\)는 기울기, \(b\)는 절편이다.  
우리가 학습을 통해 찾고 싶은 것은 결국 이 두 값이다.

### 3.6.2 오차를 어떻게 볼 것인가: MAE와 MSE

Easy 노트에서는 먼저 **오차의 크기를 어떻게 측정할 것인지**를 소개했다.

- **MAE(Mean Absolute Error)**: 절대오차의 평균  
- **MSE(Mean Squared Error)**: 제곱오차의 평균

MAE는 직관적으로 해석하기 쉽고, MSE는 큰 오차를 더 강하게 벌주는 특징이 있다.  
그래서 실제 머신러닝에서는 MSE가 매우 자주 쓰인다.

### 3.6.3 파라미터를 찾는 방법: Grid Search, 정규방정식, 경사하강법

강의는 일부러 가장 비효율적인 방법부터 보여준다.

#### (1) Grid Search
`a`, `b` 값을 여러 개 찍어보며 오차가 가장 작은 조합을 찾는 방식이다.  
아이디어를 이해하기는 좋지만, 실전에서는 거의 쓰지 않는다.

#### (2) 정규방정식
행렬 계산으로 최적해를 한 번에 구하는 방식이다.  
선형 회귀에서는 매우 elegant한 해법이지만, 데이터가 커지면 계산 비용이 커지고 역행렬 문제가 생길 수 있다.

#### (3) 경사하강법
현재 파라미터에서 오차가 줄어드는 방향으로 조금씩 이동하는 반복 최적화 방식이다.  
딥러닝까지 이어지는 핵심 아이디어라서 반드시 익혀둘 가치가 있다.

#### (4) Adam
경사하강법을 더 안정적이고 똑똑하게 만든 최적화 알고리즘이다.  
이번 노트에서는 개념 수준으로만 다루지만, 이후 신경망 학습에서 매우 자주 등장한다.

### Boston Housing 회귀 실습

과제 노트에서는 Boston Housing 데이터를 OpenML에서 불러와 회귀 문제를 풀었다.  
이 실습은 **EDA → 전처리 → 선형 회귀 학습 → RMSE/MAE/R² 평가 → 예측 시각화**라는 회귀 파이프라인 전체를 보여준다.

```python
from sklearn.linear_model import LinearRegression
from sklearn.metrics import root_mean_squared_error, mean_absolute_error, r2_score

# 1. 모델 생성
model = LinearRegression()

# 2. 학습
model.fit(X_train, y_train)

# 3. 예측
y_pred = model.predict(X_test)

# 4. 평가
rmse = root_mean_squared_error(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print(f"RMSE: {rmse:.3f}")
print(f"MAE:  {mae:.3f}")
print(f"R²:   {r2:.4f}")
```

### 회귀 결과를 시각화로 해석하기

```python
import seaborn as sns
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 8))

# 실제값과 예측값의 관계를 산점도로 확인
sns.scatterplot(x=y_test, y=y_pred, alpha=0.6, ax=ax)

# 이상적인 예측선(y=x) 표시
min_val = min(y_test.min(), y_pred.min())
max_val = max(y_test.max(), y_pred.max())
ax.plot([min_val, max_val], [min_val, max_val], "r--", linewidth=2, label="Perfect Prediction")

ax.set_xlabel("Actual MEDV")
ax.set_ylabel("Predicted MEDV")
ax.set_title(f"Actual vs Predicted\nRMSE={rmse:.3f}, R²={r2:.4f}")
ax.legend()
ax.grid(alpha=0.3)
plt.show()
```

이 그래프에서 점들이 빨간 대각선에 가까울수록 예측이 잘 된 것이다.  
선 위에 있으면 과대 예측, 선 아래에 있으면 과소 예측이다.

### 자주 하는 실수 / 디버깅 포인트
- 회귀 문제인데 Accuracy 같은 분류 지표를 쓰면 안 된다.
- RMSE와 MAE는 낮을수록 좋고, R²는 높을수록 좋다. 방향이 다르다는 점을 자주 헷갈린다.
- 선형 회귀는 관계를 직선으로 본다. 관계가 심하게 비선형이면 한계가 있다.

📌 핵심: **선형 회귀는 단순한 모델이지만, 손실 함수·최적화·평가지표·시각화 해석까지 머신러닝의 기본 문법을 가장 잘 보여주는 출발점이다.**

---

## 3.7 로지스틱 회귀: 확률로 분류를 배우는 방식

로지스틱 회귀는 이름에 "회귀"가 들어가지만 실제로는 대표적인 **분류 모델**이다.  
차이는 출력에 있다. 선형 회귀는 연속형 값을 직접 예측하지만, 로지스틱 회귀는 먼저 점수를 만든 뒤 그것을 **시그모이드(sigmoid)** 함수에 통과시켜 0과 1 사이의 확률로 바꾼다.

### 3.7.1 왜 선형 회귀를 분류에 그대로 쓰면 안 되는가

분류 문제에서는 "이 샘플이 클래스 1일 확률"처럼 해석 가능한 출력이 필요하다.  
선형 회귀는 예측값이 음수나 1보다 큰 값도 나올 수 있기 때문에, 확률처럼 쓰기 어렵다.

그래서 로지스틱 회귀는 아래 함수를 사용한다.

\[
p = \frac{1}{1 + e^{-z}}
\]

여기서 \(z = Wx + b\) 이고, 결과 \(p\)는 0과 1 사이로 제한된다.

### 3.7.2 손실 함수: Cross Entropy

로지스틱 회귀에서는 MSE보다 **Cross Entropy(또는 Log Loss)**를 더 자주 쓴다.  
이 손실 함수는 잘못된 확신을 더 크게 벌주는 특성이 있어, 분류 확률 학습에 더 적합하다.

### 3.7.3 wine 데이터 실습: 이진 분류로 단순화하기

실습 노트에서는 sklearn의 `load_wine()` 데이터셋을 불러와 `quality`라는 이름으로 다루고,  
클래스 0은 0으로 두고 나머지 클래스는 1로 바꾸어 이진 분류 문제로 단순화했다.

```python
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# X: 특성, y: 라벨
X = df.drop("quality", axis=1).values.copy()
y = df["quality"].values.copy()

# 0 vs 나머지 형태의 이진분류로 변환
y[y == 0] = 0
y[y != 0] = 1

# 클래스 비율을 유지하며 분할
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.3,
    random_state=42,
    stratify=y
)

# 표준화
scaler = StandardScaler()
X_train_norm = scaler.fit_transform(X_train)
X_test_norm = scaler.transform(X_test)
```

### 3.7.4 로지스틱 회귀 학습과 평가

```python
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, classification_report, roc_curve, roc_auc_score
import matplotlib.pyplot as plt

# 1. 모델 생성
clf = LogisticRegression()

# 2. 학습
# 실제로는 표준화된 X_train_norm을 쓰는 편이 더 안정적이다.
clf.fit(X_train_norm, y_train)

# 3. 예측
y_pred = clf.predict(X_test_norm)

# 4. 기본 평가
print(confusion_matrix(y_test, y_pred))
print(classification_report(y_test, y_pred))

# 5. ROC-AUC
y_score = clf.predict_proba(X_test_norm)[:, 1]
fpr, tpr, thresholds = roc_curve(y_test, y_score)
auc = roc_auc_score(y_test, y_score)

plt.plot(fpr, tpr, label=f"ROC-AUC = {auc:.3f}")
plt.plot([0, 1], [0, 1], linestyle="--", label="Random")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.title("ROC Curve")
plt.legend()
plt.show()
```

### 코드 흐름 해설
- `predict()`는 최종 라벨 0/1을 준다.
- `predict_proba()`는 각 클래스일 확률을 준다.
- ROC-AUC는 확률 점수를 바탕으로 임계값을 바꿔가며 모델을 평가한다.

즉, Accuracy만 보면 놓칠 수 있는 정보를 ROC-AUC가 보완해 준다.

### 교차검증으로 더 안정적으로 보기

```python
from sklearn.model_selection import cross_val_score

# 5-fold 교차검증으로 F1-score 평균 확인
f1_scores = cross_val_score(
    estimator=clf,
    X=X_train_norm,
    y=y_train,
    cv=5,
    scoring="f1"
)

print("Average F1-score (CV):", f1_scores.mean())
```

교차검증은 한 번의 train/test 분할 결과만 보고 성급하게 결론 내리지 않게 해 준다.  
특히 데이터가 아주 크지 않을 때는 더욱 유용하다.

### 자주 하는 실수 / 디버깅 포인트
- 다중 클래스 데이터를 그대로 이진 로지스틱 회귀 수식에 넣으면 안 된다.
- `predict()`와 `predict_proba()`를 헷갈리면 ROC-AUC 계산이 틀어진다.
- 로지스틱 회귀는 표준화의 영향을 많이 받기 때문에, 실무에서는 보통 표준화 후 학습한다.

📌 핵심: **로지스틱 회귀는 선형 점수를 확률로 바꿔 분류하는 모델이며, Accuracy 하나만이 아니라 F1-score와 ROC-AUC까지 함께 봐야 해석이 안정적이다.**

---

## 3.8 PCA와 KMeans: 정답 없이 구조를 보는 법

강의의 마지막 부분은 지도학습을 잠깐 벗어나, 데이터를 **더 보기 쉽게 압축하거나 스스로 묶는 방법**을 소개한다.

- **PCA**: 많은 차원의 데이터를 적은 차원으로 줄인다.
- **KMeans**: 비슷한 데이터끼리 군집을 만든다.

이 둘은 목적이 다르지만, 함께 쓰면 데이터 구조를 해석하는 데 아주 유용하다.

### PCA + KMeans 예시

```python
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
import seaborn as sns
import matplotlib.pyplot as plt

# 1. 차원 축소
pca = PCA(n_components=2)
X_pca = pca.fit_transform(X)

# 2. 축소된 데이터에 대해 군집화
kmeans = KMeans(n_clusters=2, random_state=42)
y_cluster = kmeans.fit_predict(X_pca)

# 3. 시각화
fig, ax = plt.subplots(figsize=(9, 3), ncols=2)

sns.scatterplot(x=X_pca[:, 0], y=X_pca[:, 1], hue=y_cluster, palette="Set2", ax=ax[0])
ax[0].set_title("Labels inferred by KMeans")

sns.scatterplot(x=X_pca[:, 0], y=X_pca[:, 1], hue=y, palette="Set2", ax=ax[1])
ax[1].set_title("Actual Labels on PCA")

fig.suptitle("KMeans Clustering with PCA")
fig.tight_layout()
plt.show()
```

### 쉬운 해설
PCA는 원래의 여러 특성을 새로운 축 두 개로 요약해 준다.  
이렇게 차원을 줄이면 사람이 눈으로도 구조를 보기 쉬워진다.

그다음 KMeans를 적용하면, 라벨 없이도 데이터가 어떤 덩어리로 묶이는지 확인할 수 있다.  
그리고 실제 라벨과 비교해 보면, **데이터가 본질적으로 어느 정도 분리되는지** 감을 잡을 수 있다.

### 자주 하는 실수 / 디버깅 포인트
- PCA 결과축은 원래 컬럼명처럼 직접 해석하기 어렵다. "새로 만든 요약 축"이라고 이해하는 편이 좋다.
- KMeans의 군집 번호는 실제 클래스 번호와 의미가 일치하지 않을 수 있다. 숫자 자체보다 분리 구조를 보는 것이 중요하다.

📌 핵심: **PCA와 KMeans는 정답을 맞히기 위한 도구라기보다, 데이터의 숨은 구조를 시각적으로 이해하기 위한 도구에 가깝다.**

---

## 4. 적용 관점에서 다시 보기

이제 본문에서 배운 내용을 실제 문제 풀이 순서로 다시 묶어보자.  
새로운 개념을 추가하는 장이 아니라, 이미 본 내용을 실전 감각으로 정리하는 장이다.

### 4-1. 문제를 받았을 때 가장 먼저 떠올릴 순서

#### 회귀 문제라면
1. 타깃이 연속형인지 확인한다.  
2. EDA로 분포와 상관관계를 본다.  
3. 결측치와 이상치가 있으면 train 기준으로 처리 계획을 세운다.  
4. train/test를 나눈다.  
5. 필요하면 표준화한다.  
6. 선형 회귀 등 모델을 학습한다.  
7. RMSE, MAE, R²로 평가하고, 실제값 vs 예측값 그래프로 해석한다.

#### 분류 문제라면
1. 타깃이 범주형인지 확인한다.  
2. 클래스 불균형이 있는지 본다.  
3. train/test 분할 시 stratify를 고려한다.  
4. 표준화가 필요한 모델인지 확인한다.  
5. 로지스틱 회귀를 학습한다.  
6. Accuracy만 보지 말고 confusion matrix, F1-score, ROC-AUC를 함께 본다.

### 4-2. EDA에서 어떤 신호를 포착해야 하는가
- `info()`에서 결측치가 보이면: 전처리 계획이 필요하다는 신호
- `describe()`에서 min/max가 과하게 튀면: 이상치 가능성 점검 신호
- 히트맵에서 상관이 큰 변수가 보이면: 중요한 후보 특성 신호
- pairplot에서 클래스가 어느 정도 갈리면: 분류 가능성이 높은 신호
- 분포가 매우 치우쳐 있으면: 변환 또는 표준화 고려 신호

### 4-3. 구현 순서를 어떻게 잡아야 하는가
실습에서 자주 흐름이 꼬이는 이유는, 코드 조각은 아는데 **순서**가 섞이기 때문이다.  
아래 순서를 템플릿처럼 기억해 두면 훨씬 덜 헷갈린다.

```text
데이터 로드
→ EDA(head, info, describe, 시각화)
→ X, y 분리
→ train/test split
→ train 기준 결측치/이상치/표준화 처리
→ 모델 생성
→ fit
→ predict / predict_proba
→ 지표 계산
→ 결과 시각화 및 해석
```

### 4-4. 실전에서 자주 틀리는 패턴
- 전체 데이터로 표준화하고 나서 train/test를 나누는 실수
- 분류 문제인데 회귀 지표를 쓰는 실수
- 회귀 문제인데 Accuracy 같은 지표를 찾는 실수
- `predict()`와 `predict_proba()`를 혼동하는 실수
- 회귀 시각화에서 대각선 기준 해석을 놓치는 실수
- 교차검증 없이 한 번의 점수만 보고 모델 우열을 단정하는 실수

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의 묶음을 통해 가장 크게 보이는 사실은, 머신러닝이 모델 선택의 문제가 아니라 **문제 구조를 읽는 과정**이라는 점이다.  
같은 LinearRegression이나 LogisticRegression을 쓰더라도, 데이터를 어떻게 살펴보았는지에 따라 결과 해석의 깊이가 크게 달라진다.

특히 다음 세 가지가 이후 학습으로 자연스럽게 이어진다.

### 5-1. 전처리의 기준을 train에서만 잡는 습관
이것은 단순 규칙이 아니라, 검증 신뢰성을 지키는 핵심 원칙이다.  
딥러닝으로 가더라도 데이터 누수 문제는 계속 등장하므로 지금 확실히 잡아두는 편이 좋다.

### 5-2. 평가지표를 문제의 성격에 맞춰 보는 습관
점수 하나만 높다고 좋은 모델이 아니다.  
회귀에서는 오차의 크기와 설명력을 함께 보고, 분류에서는 정답률뿐 아니라 클래스별 성능과 확률 기반 성능까지 함께 봐야 한다.

### 5-3. 지도학습과 비지도학습을 연결해서 보는 시야
PCA와 KMeans는 단순한 추가 주제가 아니라, "모델을 학습하기 전에 데이터를 더 잘 이해하는 도구"로도 볼 수 있다.  
이 시야가 생기면 이후 차원 축소, 군집화, 특성 공학까지 자연스럽게 연결된다.

---

## 6. 요약 정리

📌 핵심
- 머신러닝의 기본 흐름은 **데이터 준비 → EDA → 전처리 → 모델 학습 → 평가 → 해석**이다.
- EDA는 시각화 자체가 목적이 아니라, 전처리와 모델링 방향을 정하는 과정이다.
- 표준화, 이상치 경계, 결측치 처리 기준은 **항상 train 데이터에서만** 잡아야 한다.
- 선형 회귀는 연속형 값을 예측하고, MAE/MSE/RMSE/R²로 평가한다.
- 로지스틱 회귀는 확률 기반 분류 모델이며, Accuracy뿐 아니라 F1-score와 ROC-AUC까지 함께 봐야 한다.
- 교차검증은 한 번의 분할 결과를 과신하지 않게 해 준다.
- PCA와 KMeans는 데이터 구조를 더 잘 보기 위한 확장 도구다.

🧠 기억할 것
- `fit`은 규칙을 만드는 단계, `predict`는 규칙을 쓰는 단계다.
- 상관계수는 관계를 요약한 숫자이고, 산점도는 관계의 실제 모양을 보여준다.
- 전처리의 수식보다 중요한 것은 **그 기준을 어디서 계산했는가**이다.
- 좋은 모델링은 좋은 데이터 이해에서 시작된다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. 왜 `StandardScaler`는 train 데이터에 `fit()`하고 test 데이터에는 `transform()`만 해야 할까?

2. 선형 회귀 문제에서 RMSE와 R²는 각각 무엇을 보여주며, 둘의 해석 방향은 어떻게 다른가?

3. 로지스틱 회귀에서 `predict()`와 `predict_proba()`는 어떤 차이가 있고, ROC-AUC 계산에는 왜 확률 점수가 필요한가?

4. 상관계수 히트맵과 scatterplot을 함께 보는 이유는 무엇인가?

5. PCA와 KMeans를 함께 시각화했을 때, 실제 라벨과 군집 라벨을 비교해 얻을 수 있는 통찰은 무엇인가?

### 체크리스트
- [ ] 새로운 데이터를 받으면 `head()`, `info()`, `describe()`부터 볼 수 있다.
- [ ] 분류와 회귀 문제를 구분하고, 맞는 평가지표를 고를 수 있다.
- [ ] 데이터 누수가 왜 생기는지 설명할 수 있다.
- [ ] 로지스틱 회귀가 왜 확률을 출력하는지 설명할 수 있다.
- [ ] EDA 결과를 보고 어떤 전처리가 필요한지 말할 수 있다.
