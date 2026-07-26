# 순차 데이터 모델: RNN, LSTM, Transformer와 BERT

- 🎯 글의 목표: 순차 데이터에서 RNN과 LSTM이 정보를 전달하는 방식, Transformer의 Attention 구조, BERT의 사전학습 목적을 큰 흐름으로 구분한다.
- 🧩 핵심 키워드: Sequence, RNN, Hidden State, Vanishing Gradient, LSTM, Attention, Transformer, BERT, NLP Evaluation
- ⭐ 중요도: ★★★★☆ — 현대 자연어 처리 모델의 발전 흐름을 이해하는 기초다.
- 📝 한눈에 보는 내용: RNN은 이전 hidden state를 다음 시점으로 전달하지만 긴 의존성 학습에 어려움이 있다. LSTM은 정보 흐름을 제어하는 gate를 추가하고, Transformer는 Attention으로 토큰 사이 관계를 직접 계산한다. BERT는 Transformer Encoder를 이용해 문맥 표현을 학습한다.
- 🔗 관련 노트: [토큰화·임베딩·Transformer 통합 노트](../03_24_tokenization_embedding/강의노트_통합정리_토큰화_임베딩_시퀀스모델_트랜스포머.md)

---

## 1. 들어가며

문장, 음성, 주가처럼 순서가 중요한 데이터는 각 값을 독립적으로만 보면 의미를 놓칠 수 있다.

```text
"나는 사과를 먹었다"

나는 → 사과를 → 먹었다
```

`먹었다`의 의미를 해석하려면 앞의 `사과를`과 연결해야 한다. 순차 모델은 현재 입력뿐 아니라 다른 시점의 정보도 함께 사용하려고 한다.

이 글은 다음 발전 흐름을 중심으로 정리한다.

```text
RNN
→ 이전 정보를 hidden state로 전달

LSTM
→ gate로 장기 정보 흐름 보완

Transformer
→ Attention으로 토큰 관계를 직접 계산

BERT
→ Transformer Encoder로 양방향 문맥 표현 학습
```

---

## 2. 핵심 개념 정리

| 모델 | 핵심 아이디어 | 대표적인 한계 또는 특징 |
|---|---|---|
| RNN | 이전 hidden state를 다음 시점에 전달 | 긴 의존성 학습과 병렬화가 어려움 |
| LSTM | gate로 기억과 삭제를 제어 | RNN보다 구조와 계산이 복잡함 |
| Transformer | Self-Attention으로 토큰 관계 계산 | 긴 입력에서 Attention 계산량이 큼 |
| BERT | Transformer Encoder 사전학습 | 이해 중심 표현에 강점 |

---

## 3. 본문 정리

### 3.1 RNN은 이전 정보를 hidden state에 담는다

RNN은 입력을 순서대로 처리하며 이전 시점의 hidden state를 현재 계산에 사용한다.

```text
x₁ → h₁
      ↓
x₂ → h₂
      ↓
x₃ → h₃
```

- `xₜ`: 현재 시점의 입력
- `hₜ₋₁`: 이전 시점의 hidden state
- `hₜ`: 현재 입력과 이전 정보를 반영한 새 hidden state

같은 RNN 셀이 각 시점에서 파라미터를 공유하므로 길이가 다른 입력도 처리할 수 있다.

---

### 3.2 RNN의 기울기 소실 문제

RNN 학습에서는 시간 순서를 거슬러 기울기를 전달한다. 긴 시퀀스에서는 작은 값이 반복해서 곱해지며 앞 시점의 기울기가 매우 작아질 수 있다.

```text
먼 과거의 정보
→ 여러 시점을 거쳐 전달
→ 기울기가 점점 작아짐
→ 장기 의존성 학습이 어려워짐
```

반대로 값이 반복해서 커지는 기울기 폭주도 생길 수 있다. 기울기 클리핑은 폭주를 완화할 수 있지만 장기 의존성 문제 전체를 해결하는 방법은 아니다.

---

### 3.3 LSTM은 gate로 정보 흐름을 조절한다

LSTM은 RNN에 cell state와 여러 gate를 추가한다.

- **Forget gate**: 이전 정보 중 무엇을 잊을지 결정
- **Input gate**: 새로운 정보 중 무엇을 저장할지 결정
- **Output gate**: 현재 상태에서 무엇을 출력할지 결정

```text
이전 cell state
→ 일부 정보는 유지
→ 불필요한 정보는 제거
→ 새 정보를 선택적으로 추가
→ 다음 시점으로 전달
```

LSTM은 기본 RNN보다 긴 의존성을 다루기 쉽게 설계됐지만, 입력을 순차적으로 처리하므로 모든 시점을 완전히 병렬 계산하기 어렵다.

---

### 3.4 Attention은 필요한 정보를 직접 참고한다

Attention은 현재 토큰을 처리할 때 입력의 다른 토큰이 얼마나 중요한지 가중치를 계산한다.

```text
"은행에서 돈을 찾았다"

"돈"과 "찾았다"를 함께 보면
"은행"이 금융기관이라는 문맥을 잡기 쉬워진다.
```

Self-Attention에서는 같은 입력 시퀀스 안의 토큰들이 서로를 참고한다.

- Query: 지금 찾고 싶은 정보
- Key: 각 토큰이 가진 검색 기준
- Value: 실제로 모아올 정보

Query와 Key의 유사도로 가중치를 만들고, 그 가중치로 Value를 합친다.

---

### 3.5 Transformer

Transformer는 순환 구조 대신 Attention을 중심으로 시퀀스를 처리한다.

```text
토큰화
→ 임베딩
→ 위치 정보 추가
→ Multi-Head Self-Attention
→ Feed Forward Network
→ 다음 층으로 전달
```

순환 연결이 없으므로 학습할 때 여러 토큰을 병렬로 처리하기 쉽다. Multi-Head Attention은 서로 다른 관점의 관계를 동시에 학습하도록 돕는다.

⚠️ 주의: Transformer가 순서를 전혀 사용하지 않는다는 뜻은 아니다. 순환 구조가 없기 때문에 위치 임베딩이나 위치 인코딩으로 순서 정보를 추가한다.

---

### 3.6 Encoder와 Decoder

원래 Transformer는 Encoder와 Decoder를 함께 사용한다.

```text
Encoder
→ 입력 전체를 문맥 표현으로 변환

Decoder
→ 이전 출력과 Encoder 정보를 이용해 다음 토큰 생성
```

모델에 따라 구조를 다르게 활용한다.

- Encoder 중심: BERT
- Decoder 중심: GPT 계열
- Encoder-Decoder: 번역과 요약에 쓰이는 T5 등

---

### 3.7 BERT

BERT는 `Bidirectional Encoder Representations from Transformers`의 약자다. Transformer Encoder를 이용해 토큰의 왼쪽과 오른쪽 문맥을 함께 반영한 표현을 학습한다.

대표적인 사전학습 과제는 Masked Language Modeling이다.

```text
"나는 [MASK]를 먹었다"
→ 주변 문맥으로 가려진 토큰 예측
```

사전학습 후 분류, 개체명 인식, 질의응답 같은 작업에 맞게 fine-tuning할 수 있다.

⚠️ 주의: BERT는 기본적으로 다음 토큰을 하나씩 생성하는 모델이 아니다. 문맥 이해와 표현 학습을 중심으로 설계된 Encoder 모델이다.

---

### 3.8 NLP 성능 평가

자연어 처리 평가는 작업에 따라 지표가 달라진다.

| 작업 | 대표 지표 | 확인할 점 |
|---|---|---|
| 문장 분류 | Accuracy, Precision, Recall, F1 | 클래스 불균형 |
| 개체명 인식 | Token 또는 Entity F1 | 개체 경계와 타입 |
| 기계 번역 | BLEU | 정답 문장과 n-gram 겹침 |
| 요약 | ROUGE | 정답 요약과 내용 겹침 |
| 언어 모델 | Perplexity | 모델과 토큰화가 같은 조건인지 |

자동 지표 하나만으로 자연스러움, 사실성, 유용성을 모두 평가할 수는 없다. 생성 작업에서는 사람 평가나 작업별 평가 기준을 함께 사용한다.

---

## 4. 적용 관점에서 다시 보기

모델을 선택하기 전에 다음을 확인한다.

1. 입력 순서가 중요한가?
2. 전체 문맥을 이해해야 하는가, 다음 토큰을 생성해야 하는가?
3. 입력 길이는 어느 정도인가?
4. 학습과 추론 속도 제약은 무엇인가?
5. 분류, 태깅, 번역, 생성 중 어떤 작업인가?
6. 평가 지표가 실제 목표를 반영하는가?

---

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

RNN에서 Transformer로의 변화는 단순히 새 모델이 이전 모델을 대체한 사건이 아니다. 긴 관계를 전달하는 방식과 병렬 계산 방법이 달라진 것이다.

### 5.2 다음 학습과의 연결

- 토큰화와 임베딩
- Positional Encoding
- Multi-Head Attention
- Encoder-only와 Decoder-only 모델
- Fine-tuning과 Prompting

### 5.3 더 확인할 주제

- GRU
- Attention mask
- Causal Attention
- Context window
- 생성 모델의 평가와 환각

---

## 6. 요약 정리

- RNN은 이전 hidden state를 다음 시점으로 전달한다.
- 긴 시퀀스에서는 기울기 소실로 장기 의존성 학습이 어려울 수 있다.
- LSTM은 gate와 cell state로 정보 흐름을 조절한다.
- Self-Attention은 같은 입력 안의 토큰 관계를 직접 계산한다.
- Transformer는 Attention과 위치 정보를 사용한다.
- BERT는 Transformer Encoder 기반의 양방향 문맥 표현 모델이다.
- NLP 평가는 작업에 맞는 여러 지표와 사람 평가를 함께 고려한다.

🧠 기억할 것: 순차 모델의 핵심 차이는 **멀리 떨어진 정보를 어떤 방식으로 연결하고 학습하는가**에 있다.

---

## 7. 미니 퀴즈

1. RNN의 hidden state는 어떤 역할을 하는가?
2. LSTM의 gate가 필요한 이유는 무엇인가?
3. Self-Attention의 Query, Key, Value를 검색에 비유해 설명할 수 있는가?
4. Transformer가 순서 정보를 얻는 방법은 무엇인가?
5. BERT와 GPT 계열의 기본 구조 차이는 무엇인가?

<details>
<summary>정답과 해설</summary>

1. 이전 시점의 정보를 현재와 다음 시점으로 전달한다.
2. 유지할 정보와 버릴 정보를 선택해 장기 정보 흐름을 돕는다.
3. Query는 찾을 내용, Key는 비교 기준, Value는 실제로 가져올 정보다.
4. 위치 임베딩 또는 위치 인코딩을 추가한다.
5. BERT는 Encoder 중심의 문맥 이해 모델이고 GPT 계열은 Decoder 중심의 생성 모델이다.

</details>
