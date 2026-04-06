# PEFT·LoRA·QLoRA와 GGUF/llama.cpp까지 한 번에 정리

- 🎯 글의 목표: Full Fine-tuning의 한계를 이해하고, LoRA/QLoRA 기반 학습부터 결과 저장, GGUF 변환과 llama.cpp 배포 흐름까지 한 번에 복습할 수 있도록 정리한다.
- 🧩 핵심 키워드: PEFT, LoRA, QLoRA, NF4, Chat Template, Label Masking, SFTTrainer, Adapter 저장, merge_and_unload, GGUF, llama.cpp
- ⭐ 중요도: 높음
- 📝 한눈에 보는 내용: 왜 Full Fine-tuning이 부담스러운지에서 출발해, LoRA의 수학적 원리와 핵심 하이퍼파라미터를 이해하고, 실제 데이터셋을 Chat 형식으로 바꿔 response-only 방식으로 학습한 뒤, 저장·추론·GGUF 변환·배포까지 이어지는 전체 파이프라인을 연결한다.
- 🔗 관련 문제 / 주제(있다면): LLM 파인튜닝, 16GB VRAM 환경 학습, Text-to-SQL, 체스 instruction tuning, 양자화 추론 성능 비교

---

## 1. 들어가며

이번 강의 흐름의 핵심은 아주 분명하다. **"큰 모델을 어떻게 현실적인 장비에서 학습하고, 학습한 결과를 어떻게 실제 추론 환경까지 가져갈 것인가"**를 단계적으로 이해하는 것이다.

처음에는 Full Fine-tuning과 PEFT를 비교하며 왜 모든 파라미터를 전부 학습하는 방식이 부담스러운지부터 확인한다. 그 다음에는 LoRA가 어떻게 적은 수의 추가 파라미터만 학습하면서도 성능을 유지하는지 수식과 코드로 이해한다. 여기서 한 걸음 더 가면, QLoRA를 통해 **Base Model은 4-bit로 줄이고, 실제 학습은 LoRA Adapter만 수행하는 방식**이 왜 강력한지 자연스럽게 연결된다.

이후 흐름도 중요하다. 모델만 로드한다고 끝나는 것이 아니라, 데이터셋을 모델이 이해하는 **chat template 형식**으로 바꾸고, 사용자 질문까지 외우지 않도록 **label masking**을 적용하고, `SFTTrainer`로 실제 학습을 수행한다. 학습이 끝나면 저장 방식도 갈린다. 어댑터만 저장할지, base model에 병합해서 저장할지에 따라 추론 편의성과 용량이 달라진다.

마지막으로 이 강의는 학습에서 멈추지 않는다. **GGUF 포맷과 llama.cpp**를 통해 "학습된 모델을 빠르게 추론하는 실제 환경"까지 시야를 확장한다. 즉, 이 문서는 단순히 LoRA만 설명하는 노트가 아니라, **학습 효율화 → 데이터 구성 → 학습 → 저장 → 배포/추론 최적화**까지 이어지는 하나의 실전형 흐름을 정리한 문서라고 보면 된다.

---

## 2. 핵심 개념 정리

이 강의의 큰 흐름은 아래 순서로 잡아두면 이해가 훨씬 쉽다.

### 2.1 왜 Full Fine-tuning이 부담스러운가

모델이 커질수록 학습해야 할 파라미터 수가 폭증한다. 문제는 단순히 가중치만 메모리에 올리는 것이 아니라, **gradient, optimizer state, activation**까지 함께 고려해야 한다는 점이다. 그래서 "모델 파라미터가 메모리에 겨우 올라간다"는 것과 "실제로 학습 가능하다"는 것은 전혀 다른 이야기다.

### 2.2 PEFT와 LoRA는 무엇을 줄여주는가

PEFT는 전체 모델을 다 건드리지 않고, 일부 파라미터만 학습하는 접근이다. 그중 LoRA는 업데이트 자체를 저차원 행렬 두 개의 곱으로 근사한다. 쉽게 말하면, **거대한 가중치 전체를 새로 배우는 대신, 필요한 변화만 압축해서 배우는 방식**이다.

### 2.3 왜 QLoRA가 필요한가

LoRA만으로도 학습 파라미터 수는 줄지만, base model 자체가 FP16/BF16이면 여전히 메모리가 많이 든다. QLoRA는 base model을 **NF4 4-bit**로 양자화해 올리고, LoRA adapter만 FP16/BF16으로 학습한다. 그래서 제한된 VRAM에서도 대형 모델 학습이 가능해진다.

### 2.4 데이터는 반드시 모델이 기대하는 형식으로 바뀌어야 한다

LLM은 그냥 문자열 덩어리를 넣는다고 학습이 잘 되는 것이 아니다. `system / user / assistant` 구조를 가진 **chat template**로 데이터를 정리해야 학습과 추론이 일관되게 동작한다. 같은 데이터라도 템플릿이 달라지면 instruction 구간과 response 구간의 경계가 달라지고, 그 차이가 바로 label masking 설정에도 이어진다.

### 2.5 학습은 "무엇을 맞히게 할 것인가"를 정확히 정해야 한다

SFT에서는 보통 모델이 **assistant 응답만 잘 생성하도록** 학습시키고 싶다. 그래서 instruction 부분은 `-100`으로 마스킹해서 loss 계산에서 제외한다. 이 지점이 중요한 이유는, 모델이 사용자의 질문까지 암기하는 방향으로 파라미터를 낭비하지 않도록 막아주기 때문이다.

### 2.6 저장과 배포는 학습과 다른 문제다

학습이 잘 끝났다고 바로 실제 서비스에 적합한 것은 아니다. LoRA adapter만 저장하면 가볍고 유연하지만, 배포 환경에서는 base model과 다시 합쳐 로드해야 한다. 반대로 `merge_and_unload()`로 병합하면 추론은 편해지지만 저장 용량은 커진다. 더 나아가 빠른 추론 환경까지 생각하면 GGUF 변환과 llama.cpp 같은 추론 엔진까지 고려해야 한다.

---

## 3. 본문 정리

이 장에서는 개념이 나오는 자리에서 바로 예시와 코드까지 붙여 이해가 끊기지 않도록 정리한다.

### 3.1 Full Fine-tuning의 메모리 문제

**한 줄 정의:** Full Fine-tuning은 사전학습된 모델의 모든 파라미터를 업데이트하는 방식이다.

이 방식이 직관적으로는 가장 "정석"처럼 보이지만, 실제로는 가장 먼저 부딪히는 벽이 있다. 바로 메모리다. 많은 경우 학습이 안 되는 이유는 코드가 틀려서가 아니라, **모델을 전부 학습 대상으로 잡았기 때문에 메모리가 감당되지 않아서**다.

쉽게 말하면, 큰 창고 전체를 매번 새로 정리하는 것과 비슷하다. 필요한 물건 몇 개만 바꾸면 될 때도, Full Fine-tuning은 창고 전체를 다 뒤집어 정렬하는 셈이다. 그래서 바뀌는 정보보다 관리 비용이 훨씬 커진다.

#### 7B 모델 기준 비트 정밀도별 메모리 감각

| 정밀도 | 파라미터당 메모리 | 7B 모델 크기 | 16GB 환경에서의 감각 |
|---|---:|---:|---|
| FP32 | 4 bytes | 약 28 GB | 불가능 |
| FP16/BF16 | 2 bytes | 약 14 GB | 추론만 간신히 가능 수준 |
| INT8 | 1 byte | 약 7 GB | 추론 중심 |
| NF4 | 0.5 bytes | 약 3.5 GB | QLoRA 학습의 출발점 |

여기서 중요한 점은, FP16 7B 모델이 "14GB니까 16GB VRAM에 들어가네"로 끝나지 않는다는 것이다. 학습에는 모델 가중치 외에도 gradient, optimizer state, activation이 더 필요하다. 강의에서는 FP16 기준으로도 **Full FT 총 메모리가 대략 56GB 이상**으로 커질 수 있음을 강조했다. 즉, 16GB 장비에서 Full Fine-tuning은 구조적으로 어렵다.

#### 왜 이 문제가 바로 PEFT로 연결되는가

이 지점에서 질문이 하나 생긴다. 정말 전체를 다 학습해야만 할까? 강의는 바로 이 질문에서 PEFT로 넘어간다. 즉, **필요한 부분만 학습하는 방식으로 전환해야 현실적인 장비에서도 실험이 가능하다**는 것이다.

📌 핵심: Full Fine-tuning이 어려운 이유는 모델이 크기 때문만이 아니라, 학습 시 함께 관리해야 하는 메모리 요소가 너무 많기 때문이다.

---

### 3.2 PEFT와 LoRA의 핵심 원리

**한 줄 정의:** LoRA는 원래 가중치 \(W\)를 직접 업데이트하지 않고, 저차원 행렬 두 개의 곱으로 변화량 \(\Delta W\)를 근사하는 방식이다.

강의에서 반복해서 등장하는 수식은 아래와 같다.

\[
W' = W + BA
\]

여기서 중요한 점은, **\(W\)는 동결되고 실제로 학습되는 것은 \(A\)와 \(B\)뿐**이라는 것이다. 즉, 원래 거대한 가중치 전체를 바꾸는 대신, 변화량만 작은 차원에서 학습한다.

#### 왜 이 방식이 효과적인가

이 개념은 처음 보면 "그렇게 적게 바꿔서 충분할까?"라는 의문이 든다. 그런데 강의는 대형 모델의 업데이트가 실제로는 **저랭크 구조를 띠는 경우가 많다**는 점을 강조한다. 다시 말해, 모델이 새로운 태스크를 배우는 데 필요한 변화는 생각보다 훨씬 압축 가능하다는 뜻이다.

#### 수치 예시: d=4096, r=8

강의 예시에서는 다음처럼 계산했다.

- 원래 가중치 파라미터 수: \(4096 \times 4096 = 16,777,216\)
- LoRA 파라미터 수: \(4096 \times 8 + 8 \times 4096 = 65,536\)
- 비율: 약 **0.4%**

즉, 이 예시에서는 전체의 0.4%만 추가로 학습해도 된다. 이 숫자를 보면 LoRA가 왜 "가벼운 파인튜닝"으로 불리는지 감이 잡힌다.

```python
# d: 원래 가중치 행렬의 한 축 크기
# r: LoRA에서 사용하는 저차원 rank
d = 4096
r = 8

# 원래 가중치 W의 파라미터 수
original = d * d

# LoRA에서 추가로 학습되는 A, B의 파라미터 수
# 강의 흐름에서는 d*r + r*d 형태로 계산했다.
lora = (d * r) + (r * d)

# 원래 파라미터 대비 몇 퍼센트인지 계산
ratio = lora / original * 100

print(f"원래 파라미터: {original:,}")
print(f"LoRA 파라미터: {lora:,}")
print(f"비율: {ratio:.1f}%")
```

#### 코드 흐름 해설

이 코드는 단순 계산처럼 보이지만, 사실 LoRA의 핵심 감각을 아주 잘 보여준다.

- `original = d * d`는 원본 가중치 하나를 직접 학습할 경우의 크기다.
- `lora = d*r + r*d`는 저차원으로 쪼갠 두 행렬만 학습할 때의 크기다.
- 마지막 `ratio`가 작을수록, 적은 파라미터로 같은 차원의 업데이트를 근사하고 있다는 뜻이다.

#### 자주 하는 실수 / 디버깅 포인트

⚠️ **행렬 크기 표기가 자료마다 다를 수 있다.**  
어떤 자료는 \(A \in \mathbb{R}^{r \times d}\), \(B \in \mathbb{R}^{d \times r}\)로 쓰고, 어떤 자료는 반대로 적는다. 중요한 것은 이름이 아니라 **곱한 결과가 원래 \(W\)와 같은 차원으로 복원되느냐**다.

⚠️ **LoRA는 원본을 버리는 것이 아니다.**  
\(W\)를 없애고 \(BA\)만 쓰는 것이 아니라, **동결된 \(W\) 위에 작은 업데이트를 더하는 구조**라는 점을 놓치기 쉽다.

📌 핵심: LoRA의 본질은 "큰 가중치를 다 배우는 것"이 아니라, "필요한 변화만 저차원으로 압축해 배우는 것"이다.

---

### 3.3 LoRA 핵심 하이퍼파라미터

**한 줄 정의:** LoRA의 성능과 비용은 `r`, `lora_alpha`, `target_modules`, `lora_dropout` 조합에 크게 좌우된다.

강의에서 특히 강조한 항목은 아래 네 가지다.

| 파라미터 | 의미 | 강의에서 자주 쓰인 값/감각 |
|---|---|---|
| `r` | 저차원 rank | 8, 16, 32, 64 |
| `lora_alpha` | LoRA 출력 스케일링 계수 | 보통 `r × 2` |
| `target_modules` | LoRA를 꽂을 레이어 | `q_proj`, `k_proj`, `v_proj`, `o_proj`, 필요 시 MLP |
| `lora_dropout` | 과적합 방지용 드롭아웃 | 0.0 ~ 0.1 |

여기서 가장 자주 막히는 부분은 `r`과 `lora_alpha`의 관계다. 강의는 **실제 스케일은 `alpha / r`**이라는 점을 반복해서 짚었다. 그래서 `r=16, alpha=32`라면 스케일은 2가 된다. 즉, rank를 늘리면 alpha도 같이 조정해 균형을 맞추는 경우가 많다.

```python
from peft import LoraConfig

# LoRA의 핵심 설정을 한 번에 묶는다.
config = LoraConfig(
    r=16,                              # 표현력을 늘리는 rank
    lora_alpha=32,                     # 실제 스케일은 alpha / r
    lora_dropout=0.05,                 # 과적합 방지용 드롭아웃
    target_modules=["q_proj", "v_proj"],  # Attention 핵심 모듈부터 시작
    task_type="CAUSAL_LM"              # 생성형 언어모델 태스크
)

print(f"랭크 (r): {config.r}")
print(f"알파: {config.lora_alpha}")
print(f"스케일링 (alpha/r): {config.lora_alpha / config.r}")
print(f"대상 모듈: {config.target_modules}")
print(f"태스크 타입: {config.task_type}")
```

#### 왜 `target_modules`가 중요한가

이 설정은 "LoRA를 어디에 꽂을 것인가"를 결정한다.  
Attention 레이어만 선택하면 파라미터 수는 적고 가볍다. 반대로 `gate_proj`, `up_proj`, `down_proj`까지 포함하면 표현력은 늘지만 학습 파라미터 수도 증가한다.

실습 노트에서는 체스 instruction tuning에서 Attention + MLP까지 넓게 적용하는 예시도 보였고, 원리 노트에서는 우선 `q_proj`, `v_proj`처럼 핵심 attention 레이어부터 잡는 방식을 보여줬다. 즉, **작게 시작해 보고 필요하면 확장하는 감각**이 중요하다.

#### 자주 하는 실수 / 디버깅 포인트

⚠️ **`r`만 무작정 키우면 좋은 것이 아니다.**  
표현력은 늘 수 있지만 메모리와 학습 시간이 같이 늘어난다.

⚠️ **`target_modules` 이름은 모델마다 다르다.**  
Qwen, Gemma, Llama 계열은 비슷해 보이지만 모듈 이름이 정확히 일치하지 않을 수 있다. 모델 구조를 확인하지 않고 하드코딩하면 바로 에러가 난다.

📌 핵심: LoRA 튜닝은 "얼마나 크게 학습할까"보다 "어디를 얼마나 작게 바꿀까"를 설계하는 작업에 가깝다.

---

### 3.4 QLoRA: 4-bit 양자화와 LoRA의 결합

**한 줄 정의:** QLoRA는 4-bit로 양자화된 base model 위에 LoRA adapter만 학습하는 방식이다.

LoRA만 알아도 이미 상당히 효율적이지만, base model 자체가 FP16/BF16이라면 여전히 메모리 부담이 있다. QLoRA는 여기서 한 번 더 나아가 **base model을 NF4 4-bit로 로드**한다.

#### QLoRA의 핵심 기술 3가지

1. **NF4**  
   일반 INT4보다 가중치 분포에 더 잘 맞춘 4-bit 표현이다. 강의는 이 점을 "같은 4-bit여도 정보 손실을 줄이기 위한 설계"로 설명했다.

2. **Double Quantization**  
   양자화 상수까지 다시 양자화해 추가 메모리를 줄인다.

3. **Paged Optimizers**  
   GPU 메모리가 부족할 때 일부를 CPU 메모리로 넘기며 OOM을 줄인다.

#### LoRA와 QLoRA를 나란히 보면

| 구분 | LoRA | QLoRA |
|---|---|---|
| Base Model | FP16/BF16 | NF4 4-bit |
| Adapter | FP16/BF16 | FP16/BF16 |
| 메모리 감각 | 더 큼 | 훨씬 작음 |
| 16GB 환경에서 7B 학습 | 어렵다 | 가능성이 생긴다 |

실습 노트에서는 Unsloth의 `bnb-4bit` 모델을 로드하는 순간, 그 자체가 QLoRA의 "Q"에 해당한다고 설명한다. 즉, QLoRA는 별도의 신비한 학습기가 아니라 **어떻게 base model을 로드하고, 어떤 부분만 학습하느냐의 조합**으로 이해하면 된다.

#### 왜 실습과 과제의 프레임워크가 달랐는가

이 강의 자료는 실습과 과제를 일부러 다르게 구성했다.

- **실습**: Unsloth + Gemma 4bit + ChessInstruct → QLoRA 감각 체득
- **과제**: HuggingFace PEFT/TRL + Qwen2.5-1.5B + ko_text2sql → 다른 태스크에 LoRA 적용

이 차이가 중요한 이유는, "LoRA를 배운다"는 것이 특정 라이브러리 한 개만 외우는 것이 아니라, **원리를 다른 프레임워크와 태스크로 옮겨갈 수 있어야 한다**는 점을 보여주기 때문이다.

📌 핵심: QLoRA는 LoRA의 대체재가 아니라, LoRA를 더 작은 메모리 환경에서 가능하게 만드는 확장형 실전 기술이다.

---

### 3.5 Chat Template과 데이터 전처리

**한 줄 정의:** 학습용 데이터는 `system / user / assistant` 구조를 가진 chat 형식으로 바뀌어야 한다.

이 부분은 자칫 "문자열 포맷팅" 정도로 가볍게 보이지만, 실제로는 파인튜닝의 품질을 좌우하는 핵심 단계다. 모델은 그냥 텍스트 덩어리를 보는 것이 아니라, **누가 말했고, 어떤 부분이 질문이며, 어디서부터 답변이 시작되는지**를 템플릿을 통해 학습한다.

#### 실습 예시: ChessInstruct → conversations

실습에서는 아래처럼 `task`, `input`, `expected_output`을 각각 `system`, `user`, `assistant`에 매핑했다.

```python
def convert_to_chatml(example):
    """원본 데이터를 대화 형식으로 바꾼다."""
    return {
        "conversations": [
            {"role": "system", "content": example["task"]},             # 해야 할 작업 지시
            {"role": "user", "content": example["input"]},              # 사용자의 실제 입력
            {"role": "assistant", "content": example["expected_output"]}# 모델이 배워야 할 정답
        ]
    }
```

이 매핑이 중요한 이유는, 모델이 "체스 기보 전체를 답으로 내야 하는지", 아니면 "이 기보를 보고 다음 수를 답해야 하는지"를 정확히 구분하게 해주기 때문이다.

#### 과제 예시: ko_text2sql → ChatML

Text-to-SQL 과제에서는 시스템 프롬프트와 사용자 프롬프트를 더 명시적으로 구성했다.  
즉, 질문만 던지는 것이 아니라 **SCHEMA + USER_QUERY + 시스템 지시문**을 함께 넣어 SQL 생성 태스크임을 분명히 만들었다.

```python
# 시스템 프롬프트: 모델의 역할을 먼저 고정한다.
system_prompt = """You are a text to SQL query translator. Users will ask you questions in Korean and you will generate a SQL query based on the provided SCHEMA."""

# 사용자 프롬프트: 스키마와 질문을 함께 넣어 실제 입력을 구성한다.
user_prompt = """Given the <USER_QUERY> and the <SCHEMA>, generate the corresponding SQL command.

<SCHEMA>
{context}
</SCHEMA>

<USER_QUERY>
{question}
</USER_QUERY>"""

def convert_to_conversation(examples):
    """데이터프레임 배치를 chat template이 적용될 messages 구조로 바꾼다."""
    train_data = []

    for i in range(len(examples["question"])):
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": user_prompt.format(
                    question=examples["question"][i],
                    context=examples["context"][i]
                )
            },
            {"role": "assistant", "content": examples["answer"][i]}
        ]

        # 모델이 기대하는 chat 형식 문자열로 변환
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False
        )
        train_data.append({"text": text})

    return train_data
```

#### 왜 `apply_chat_template()`가 중요한가

이 함수는 단순 편의 기능이 아니다. 모델마다 기대하는 구분 토큰이 다를 수 있는데, `apply_chat_template()`는 그 규칙을 tokenizer가 가진 템플릿에 맞춰 자동 적용해준다.

- Gemma 계열은 `<start_of_turn>` 형태를 쓰는 경우가 있고,
- Qwen 계열은 `<|im_start|>`, `<|im_end|>`를 쓰는 경우가 있다.

즉, 겉보기에는 둘 다 `system / user / assistant` 구조지만, **경계 토큰이 다르기 때문에 후속 label masking 설정도 같이 달라진다.**

#### 자주 하는 실수 / 디버깅 포인트

⚠️ **학습 데이터와 추론 프롬프트의 템플릿이 다르면 결과가 흔들린다.**  
학습할 때는 Qwen ChatML로 넣고, 추론할 때는 다른 형식으로 질문하면 모델이 익숙한 구조를 잃는다.

⚠️ **`max_seq_length`를 데이터보다 너무 짧게 잡으면 잘림이 발생한다.**  
과제 노트에서 EDA를 먼저 하는 이유도 바로 이 때문이다. `context + question + answer` 길이가 얼마나 되는지 모르면 잘린 상태로 학습될 수 있다.

📌 핵심: Chat template은 포맷 장식이 아니라, 모델에게 "이 데이터가 어떤 역할 구조를 갖는지"를 알려주는 학습 규칙이다.

---

### 3.6 Label Masking과 response-only 학습

**한 줄 정의:** Label masking은 질문(instruction) 부분의 loss를 무시하고, 응답(response) 부분만 학습하게 만드는 기법이다.

이 개념은 SFT에서 특히 중요하다. 모델이 배우길 원하는 것은 보통 **질문을 따라 치는 능력**이 아니라, **질문을 보고 적절한 답변을 생성하는 능력**이다. 그런데 전체 시퀀스에 대해 loss를 계산하면 질문 영역까지 학습 대상으로 들어가 버린다.

#### 왜 `-100`을 쓰는가

PyTorch의 `CrossEntropyLoss`는 기본적으로 `ignore_index=-100`을 사용한다. 그래서 label이 `-100`인 위치는 loss 계산에서 자동으로 제외된다. 강의는 이 점을 이용해 instruction 구간을 마스킹했다.

- instruction 구간 → `-100`
- response 구간 → 실제 토큰 ID

즉, 모델은 "질문을 복사하는 것"에는 점수를 받지 않고, "답변을 잘 생성하는 것"에만 점수를 받게 된다.

#### 실습 코드 감각

```python
from unsloth.chat_templates import train_on_responses_only

# trainer를 response-only 학습 방식으로 감싼다.
trainer = train_on_responses_only(
    trainer,
    instruction_part="<start_of_turn>user\n",   # 사용자 질문 시작점
    response_part="<start_of_turn>model\n",     # 모델 응답 시작점
)
```

과제에서는 Qwen ChatML을 사용했기 때문에 구분 문자열도 달라졌다.

```python
trainer = train_on_responses_only(
    trainer,
    instruction_part="<|im_start|>user\n",
    response_part="<|im_start|>assistant\n",
)
```

#### 여기서 중요한 이해 포인트

같은 `train_on_responses_only()`라도 **모델 템플릿에 맞는 경계 문자열을 정확히 지정해야 한다.**  
즉, 이 함수는 마법처럼 작동하는 것이 아니라, **"어디까지가 질문이고 어디서부터 답변인지"를 네가 정확히 알려줘야 동작하는 도구**다.

#### 자주 하는 실수 / 디버깅 포인트

⚠️ **경계 문자열이 템플릿과 다르면 마스킹이 엉뚱하게 된다.**  
그 결과 질문까지 학습하거나, 반대로 응답까지 마스킹되어 loss가 이상해질 수 있다.

⚠️ **라벨 일부를 출력해보지 않고 넘어가면 디버깅이 어렵다.**  
강의에서 처음 20개 토큰의 labels를 직접 출력해 `-100`과 실제 토큰이 어디서 갈리는지 확인한 이유가 바로 이것이다.

📌 핵심: response-only 학습은 모델을 "질문을 암기하는 기계"가 아니라 "답변을 생성하는 모델"로 맞추는 핵심 설정이다.

---

### 3.7 SFTTrainer로 실제 학습하기

**한 줄 정의:** `SFTTrainer`는 데이터 로딩, 토큰화, 배치 구성, 학습 루프를 한 번에 관리하는 SFT 전용 트레이너다.

이 단계에서는 드디어 LoRA와 데이터 전처리가 학습 설정으로 이어진다. 여기서 중요한 것은 하이퍼파라미터 하나하나의 의미를 "숫자"로만 보지 않고, **메모리와 학습 안정성 관점에서 해석하는 것**이다.

```python
from trl import SFTConfig, SFTTrainer

# 16GB VRAM 환경을 고려한 학습 설정 예시
train_cfg = SFTConfig(
    output_dir="outputs-text2sql",   # 체크포인트 저장 위치
    per_device_train_batch_size=1,   # 한 번에 GPU에 올릴 샘플 수
    gradient_accumulation_steps=4,   # 누적해서 실효 배치 크기 4 확보
    learning_rate=5e-5,              # LoRA 학습률
    max_steps=100,                   # 빠른 실습용 step 제한
    logging_steps=10,                # 로그 출력 간격
    fp16=False,                      # 이 예시에서는 bf16 사용
    bf16=True,                       # 메모리 절약과 안정성 균형
    optim="adamw_torch",             # 옵티마이저
    report_to="none",                # 외부 로깅 비활성화
)

trainer = SFTTrainer(
    model=model,
    processing_class=tokenizer,
    train_dataset=train_dataset,
    peft_config=peft_config,
    args=train_cfg,
)
```

#### 코드 흐름 해설

- `per_device_train_batch_size`는 한 번에 GPU에 올리는 크기다. 작을수록 메모리는 줄지만 업데이트가 불안정할 수 있다.
- `gradient_accumulation_steps`는 작은 배치를 여러 번 누적해 더 큰 배치처럼 학습하게 만든다.
- `bf16=True`는 메모리를 줄이면서도 비교적 안정적인 학습을 돕는다.
- `max_steps=100`은 실습 시간을 고려한 제한이다. 실제 학습이라면 epoch 기준으로 더 길게 갈 수 있다.

실습 노트에서는 Unsloth와 `adamw_8bit` 같은 설정으로 더 공격적으로 메모리를 줄이는 구성도 보여주었다. 반면 과제 노트는 표준 HuggingFace 흐름으로 옮겨 적용하는 형태였다. 두 경우 모두 중요한 것은 동일하다. **"가용 VRAM 안에서 배치, 정밀도, 옵티마이저를 조절한다"**는 감각이다.

#### 실습에서 확인한 효율성

강의 코드에서는 LoRA 적용 후 학습 파라미터 비율을 직접 출력한다. 예시 중 하나는 아래와 같았다.

- trainable params: 3,407,872
- all params: 6,742,609,920
- trainable%: **0.0506%**

이 숫자는 LoRA의 효율성을 아주 잘 보여준다. 전체 모델 규모는 수십억 파라미터인데, 실제로 바뀌는 것은 그중 극히 일부다.

#### 자주 하는 실수 / 디버깅 포인트

⚠️ **배치 크기만 줄인다고 모든 OOM이 해결되지는 않는다.**  
`max_seq_length`, optimizer, precision, target_modules까지 같이 봐야 한다.

⚠️ **loss가 안 줄면 데이터 포맷부터 의심해야 한다.**  
LoRA 설정 문제처럼 보이더라도, 실제 원인은 chat template이나 label masking 경계 오류인 경우가 많다.

📌 핵심: 실제 학습 설정은 모델 성능을 튜닝하는 일이기도 하지만, 동시에 메모리 예산 안에서 시스템을 설계하는 일이기도 하다.

---

### 3.8 학습 전후 비교, 추론, 저장, 병합

**한 줄 정의:** 학습이 끝난 뒤에는 같은 입력에 대해 전후 응답을 비교하고, adapter 저장과 병합 저장의 차이를 이해해야 한다.

이 단계는 "정말 학습이 됐는가"를 가장 직관적으로 확인하는 자리다. 강의에서는 학습 전에 베이스 모델 응답을 저장해두고, 학습 후 동일한 프롬프트로 다시 추론해 비교했다. 여기서 포인트는 반드시 **학습에 사용하지 않은 데이터로 테스트해야 한다**는 점이다.

#### 추론에서 `add_generation_prompt=True`가 중요한 이유

학습 때는 assistant 응답이 이미 데이터 안에 들어 있다. 그래서 `add_generation_prompt=False`가 자연스럽다. 반대로 추론 때는 아직 모델 답변이 없기 때문에, **assistant가 시작될 위치를 알려주는 프롬프트가 필요**하다.

```python
messages = [
    {"role": "system", "content": "당신은 도움이 되는 AI 어시스턴트입니다."},
    {"role": "user", "content": "머신러닝이란?"}
]

# 추론 시에는 모델이 이제부터 응답을 생성해야 하므로
# assistant 시작 위치를 포함한 generation prompt가 필요하다.
input_text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True
)

# 문자열을 토큰으로 바꿔 모델 장치로 이동
inputs = tokenizer(input_text, return_tensors="pt").to(model.device)

# 실제 생성
outputs = model.generate(
    **inputs,
    max_new_tokens=256,
    temperature=0.7,
    do_sample=True
)

# 생성 결과를 다시 문자열로 복원
response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(response)
```

#### 저장 방식 1: Adapter만 저장

```python
# LoRA adapter만 저장한다.
# 용량이 작고, base model과 조합해 다시 불러오기 좋다.
model.save_pretrained("./finetuned_model")

# 토크나이저도 함께 저장해 두어야 추론 재현이 쉽다.
tokenizer.save_pretrained("./finetuned_model")
```

이 방식의 장점은 가볍다는 점이다. 강의 예시에서도 adapter 파일은 수 MB 수준으로 매우 작았다. 다만 추론할 때는 base model을 다시 로드한 뒤 adapter를 얹어야 한다.

#### 저장 방식 2: 병합 저장

```python
# LoRA adapter를 base model에 완전히 병합한다.
merged_model = model.merge_and_unload()

# 병합된 모델은 일반 transformers 모델처럼 다루기 쉬워진다.
merged_model.save_pretrained("./merged_model")
tokenizer.save_pretrained("./merged_model")
```

`merge_and_unload()`는 수식 관점에서 보면 LoRA의 \(BA\)를 원래 \(W\)에 합쳐 하나의 모델로 만드는 작업이다. 그래서 배포 환경에서는 편할 수 있다. 반면 저장 용량은 당연히 훨씬 커진다.

#### 자주 하는 실수 / 디버깅 포인트

⚠️ **추론에서 `add_generation_prompt=False`로 두면 모델이 응답 시작 위치를 제대로 못 잡을 수 있다.**

⚠️ **토크나이저를 같이 저장하지 않으면 재로드 시 템플릿과 special token 설정이 어긋날 수 있다.**

⚠️ **병합 저장은 편하지만, 어댑터를 따로 재사용하거나 다른 base model 조합을 시도하는 유연성은 줄어든다.**

📌 핵심: 학습이 끝난 뒤에는 "모델이 좋아졌는가"와 "어떤 형태로 저장해야 다음 단계가 편한가"를 함께 판단해야 한다.

---

### 3.9 GGUF와 llama.cpp: 배포를 위한 추론 관점

**한 줄 정의:** GGUF는 llama.cpp가 빠르게 추론할 수 있도록 사용하는 전용 모델 포맷이다.

여기서 강의의 시야가 넓어진다. 지금까지는 주로 **학습**에 초점이 있었다면, 이제는 **추론기(inference engine)** 자체를 본다. 강의는 추론기를 "게임 소프트웨어를 실행하는 게임기"에 비유했다. 같은 모델이라도 어떤 추론 엔진을 쓰느냐에 따라 속도와 안정성이 달라질 수 있다는 뜻이다.

#### 왜 GGUF가 필요한가

llama.cpp는 PyTorch의 `.safetensors`나 `.pt`를 그대로 쓰지 않는다. 대신 **GGUF 포맷**을 사용한다. 그래서 내가 만든 모델을 llama.cpp로 추론하려면, 결국 **GGUF로 변환하는 단계**가 필요하다.

![PyTorch 모델을 GGUF로 변환해야 하는 이유](integrated_note_assets/gguf_conversion_need.png)

위 흐름처럼, 학습은 PyTorch/HuggingFace/Unsloth에서 수행하더라도, 빠른 로컬 추론으로 넘어가려면 GGUF 경로를 따로 이해해야 한다.

#### GGUF에 무엇이 들어가는가

강의는 GGUF 파일 하나에 아래 정보가 함께 담길 수 있다고 설명한다.

- 텐서(가중치)
- vocab
- 모델 메타정보
- 양자화 정보(있는 경우)

즉, 여러 파일을 조합해 로드하는 HuggingFace 방식과 달리, GGUF는 **하나의 추론용 묶음 파일**이라는 감각으로 이해하면 쉽다.

#### 어떤 GGUF 파일을 고를까

Qwen2.5 1.5B GGUF 예시에서는 여러 양자화 버전이 함께 제공된다. 강의는 실습용으로 다음 두 가지를 주로 비교했다.

- `FP16.gguf`: 양자화 없는 원본에 가까운 버전
- `Q4_K_M.gguf`: llama.cpp에서 권장하는 대표적인 4-bit 양자화 옵션

![Qwen2.5 GGUF 파일 목록 예시](integrated_note_assets/gguf_files_list.png)

이 장면에서 중요한 것은 파일이 많아 보이더라도 겁먹을 필요가 없다는 점이다. 핵심은 **원본과 양자화본을 비교할 때 어떤 포맷과 옵션을 쓰는지 명확히 아는 것**이다.

📌 핵심: GGUF는 "학습용 포맷"이 아니라 "빠른 추론과 배포를 위한 포맷"이다.

---

### 3.10 llama.cpp로 성능 비교하고, 직접 GGUF로 변환하기

**한 줄 정의:** llama.cpp는 GGUF 모델을 빠르게 추론하기 위한 엔진이며, 직접 변환한 GGUF 모델도 같은 방식으로 벤치마크할 수 있다.

강의는 먼저 HuggingFace Hub에서 FP16 GGUF와 Q4_K_M GGUF를 내려받아 llama.cpp로 비교했다. 이후에는 직접 학습한 PyTorch 모델을 GGUF로 변환하는 흐름까지 보여준다.

#### GGUF 모델 다운로드와 로드

```python
from huggingface_hub import hf_hub_download
from llama_cpp import Llama

# 비교를 위해 원본에 가까운 FP16 GGUF 파일을 받는다.
model_path1 = hf_hub_download(
    repo_id="Qwen/Qwen2.5-1.5B-Instruct-GGUF",
    filename="qwen2.5-1.5b-instruct-fp16.gguf"
)

# 4-bit 양자화 버전도 함께 받는다.
model_path2 = hf_hub_download(
    repo_id="Qwen/Qwen2.5-1.5B-Instruct-GGUF",
    filename="qwen2.5-1.5b-instruct-q4_k_m.gguf"
)

# llama.cpp 추론 엔진에 GGUF 모델을 로드한다.
llm1 = Llama(model_path=model_path1, n_gpu_layers=-1, verbose=False)
llm2 = Llama(model_path=model_path2, n_gpu_layers=-1, verbose=False)
```

#### Qwen용 프롬프트 구성

```python
def qwen_prompt(user_text, system_text):
    # Qwen ChatML 형식으로 프롬프트를 직접 만든다.
    return (
        f"<|im_start|>system\n{system_text}<|im_end|>\n"
        f"<|im_start|>user\n{user_text}<|im_end|>\n"
        f"<|im_start|>assistant\n<think>\n\n</think>\n"
    )
```

이 부분은 앞에서 본 chat template와 연결된다. 즉, GGUF 추론 단계로 넘어가도 결국 **모델이 기대하는 대화 형식**을 맞춰줘야 한다는 원칙은 변하지 않는다.

#### 벤치마크에서 무엇을 봐야 하나

강의는 `tps(tokens per second)`를 핵심 지표로 썼다.  
쉽게 말하면 **모델이 초당 몇 토큰을 생성하는가**를 보는 것이다. 한글에서는 대략 글자 단위 감각으로 이해해도 된다.

강의 결론은 단순했다.

- GGUF가 더 빠르게 토큰을 생성한다.
- 추론 안정성도 더 좋게 느껴질 수 있다.
- 배포 관점에서는 GGUF + llama.cpp가 매우 실용적이다.

![코랩 환경에서 정리한 성능 비교 결과](integrated_note_assets/benchmark_result.png)

정확한 수치는 장비와 설정에 따라 달라지지만, 이 장에서 가져가야 할 메시지는 "양자화 모델이 품질 손실만 있는 것이 아니라, 실제 추론 속도와 배포 편의성 면에서 큰 장점이 있다"는 점이다.

#### 직접 GGUF로 변환하는 흐름

강의는 두 가지 방법을 소개한다.

1. **llama.cpp 공식 가이드 경로**  
   HuggingFace 모델을 GGUF로 바꾸고, 다시 양자화한다.
2. **Unsloth 함수 사용**  
   `save_pretrained_gguf()`로 변환을 단순화한다.

```python
from unsloth import FastLanguageModel

# 학습 완료 후 저장된 HuggingFace 모델 경로
model_path = "./my_trained_model"

# 저장된 모델을 다시 불러온다.
model, tokenizer = FastLanguageModel.from_pretrained(
    model_path,
    dtype=None
)

# GGUF 형식으로 변환하면서 q4_k_m 양자화까지 수행한다.
model.save_pretrained_gguf(
    model_path,
    tokenizer=tokenizer,
    quantization_method="q4_k_m",
)

print("변환 완료!")
```

이 코드는 짧지만 의미는 크다. 지금까지 학습 중심으로 다루던 모델을 **실제 추론 친화적인 포맷으로 내보내는 마지막 다리**이기 때문이다.

#### GGUF의 한계점도 같이 기억해야 한다

강의는 GGUF의 장점만 말하지 않고 한계도 분명히 짚었다.

- GGUF는 **추론 전용 포맷**이다.
- GGUF로 변환한 뒤에는 LoRA 같은 파인튜닝을 다시 진행하지 않는다.
- 주로 Transformer 계열 LLM에 맞는 경로다.

즉, 학습 단계와 추론 단계는 역할이 다르다. **학습은 HuggingFace/PEFT/Unsloth에서, 빠른 추론은 GGUF/llama.cpp에서**라는 분업 구조로 이해하면 헷갈리지 않는다.

📌 핵심: GGUF 변환은 모델 학습의 부가 옵션이 아니라, 실제 서비스에 가까운 추론 환경으로 넘어가기 위한 마지막 정리 단계다.

---

## 4. 적용 관점에서 다시 보기

이제 본문 내용을 실제 문제풀이나 구현 흐름으로 다시 묶어보자. 여기서는 새로운 개념을 추가하기보다, **언제 무엇을 떠올려야 하는지**에 집중한다.

### 4.1 어떤 상황에서 PEFT/LoRA를 떠올려야 할까

- 모델이 커서 Full Fine-tuning이 메모리상 불가능해 보일 때
- 특정 도메인 적응은 필요하지만, 전체 모델을 다시 학습할 비용이 없을 때
- 여러 태스크별 어댑터를 분리해서 관리하고 싶을 때

즉, "큰 모델을 전부 다시 배우게 하기엔 너무 비싸다"는 신호가 보이면 LoRA를 먼저 떠올리면 된다.

### 4.2 어떤 상황에서 QLoRA를 떠올려야 할까

- 16GB 전후 GPU에서 7B급 모델을 다루고 싶을 때
- base model 로딩 자체가 부담스러울 때
- 메모리를 줄이면서도 LoRA 방식의 학습 효율을 유지하고 싶을 때

여기서는 `bnb-4bit`, NF4, paged optimizer 같은 키워드가 바로 연결되어야 한다.

### 4.3 구현 순서는 어떻게 잡으면 좋을까

강의 전체를 실전 순서로 다시 압축하면 아래와 같다.

1. **태스크 정의**  
   무엇을 답하게 만들 것인지 정한다.
2. **데이터 구조 확인**  
   어떤 필드를 `system/user/assistant`로 보낼지 정한다.
3. **길이 확인(EDA)**  
   `max_seq_length`보다 길어 잘리지 않는지 먼저 본다.
4. **chat template 적용**  
   모델 형식에 맞게 문자열을 구성한다.
5. **LoRA/QLoRA 설정**  
   `r`, `alpha`, `target_modules`, precision을 정한다.
6. **response-only 학습 적용**  
   instruction 마스킹 경계를 정확히 지정한다.
7. **학습 전후 비교**  
   반드시 학습에 안 쓴 샘플로 확인한다.
8. **저장 전략 결정**  
   adapter-only인지, merge인지 결정한다.
9. **배포가 필요하면 GGUF 변환**  
   llama.cpp나 다른 추론 엔진으로 연결한다.

### 4.4 문제를 보면 어떤 신호를 잡아야 할까

- `OOM`, `CUDA out of memory`  
  → 배치 크기만 볼 게 아니라 precision, target_modules, seq length를 같이 봐야 한다.

- 학습은 되는데 성능이 이상하다  
  → chat template 경계, label masking, 데이터 품질을 먼저 확인해야 한다.

- 추론 결과가 학습 때와 다르게 이상하다  
  → `add_generation_prompt`, 저장된 tokenizer, 추론 프롬프트 형식을 확인해야 한다.

- 배포에서 느리다  
  → GGUF, llama.cpp, vLLM 등 추론 엔진 관점을 따로 봐야 한다.

### 4.5 실전에서 자주 틀리는 패턴

⚠️ 모델 구조보다 데이터 포맷 문제를 늦게 발견하는 경우가 많다.  
⚠️ `target_modules`를 너무 넓게 잡아 메모리 이점을 스스로 줄이는 경우가 있다.  
⚠️ 학습과 추론에서 다른 chat template를 써서 결과를 흔들리게 만드는 경우가 있다.  
⚠️ adapter만 저장해 놓고 base model 없이 바로 추론하려다 로딩 흐름에서 막히는 경우가 있다.  
⚠️ GGUF가 빠르다는 이유만 보고, 학습용 포맷과 추론용 포맷의 역할 차이를 흐리게 이해하는 경우가 있다.

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의 묶음에서 가장 크게 남는 점은, LLM 파인튜닝을 이해하려면 단순히 "모델을 학습시키는 법"만 알아서는 부족하다는 것이다. 실제로는 **메모리 구조**, **데이터 형식**, **학습 목표 설계**, **저장 전략**, **추론 엔진 선택**까지 전부 이어져 있다.

특히 LoRA는 단순한 트릭이 아니라, **"전체를 다 바꾸지 않고도 필요한 변화만 학습할 수 있다"**는 점에서 매우 실용적인 사고방식으로 보인다. 이 감각은 이후 다른 PEFT 기법을 볼 때도 그대로 도움이 된다.

또 하나 중요한 배움은, QLoRA와 GGUF가 서로 다른 층위의 문제를 다룬다는 점이다.

- QLoRA는 **학습을 가능하게 만드는 메모리 효율화**
- GGUF는 **추론을 빠르게 만드는 배포/실행 최적화**

이 둘을 섞어서 이해하면 흐름이 흐려지지만, 역할을 분리해서 보면 전체 파이프라인이 훨씬 선명해진다.

### 더 공부해볼 만한 확장 포인트

- `r`, `target_modules`, `lora_dropout` 조합에 따른 성능 비교
- Attention만 적용한 경우와 MLP까지 확장한 경우의 비용 대비 효과
- `merge_and_unload()` 전후 추론 속도 차이
- GGUF 외에 vLLM, TensorRT-LLM 같은 추론 엔진 비교
- Text-to-SQL처럼 정답 형식이 엄격한 태스크에서 평가 지표 설계
- LLM-as-a-Judge 외에 정답 기반 평가(정확한 SQL 실행 결과 비교 등)

---

## 6. 요약 정리

📌 핵심  
Full Fine-tuning이 어려운 이유는 모델이 커서만이 아니라, 학습 시 필요한 메모리 구성 요소 전체가 너무 크기 때문이다.

📌 핵심  
LoRA는 원래 가중치 전체를 다시 배우지 않고, 저차원 행렬 두 개로 변화량만 학습한다.

📌 핵심  
QLoRA는 base model을 4-bit로 줄이고 LoRA adapter만 학습해 제한된 VRAM에서도 대형 모델 학습을 가능하게 만든다.

📌 핵심  
chat template과 label masking은 모델이 "무엇을 보고 무엇을 답해야 하는가"를 정해주는 학습 규칙이다.

📌 핵심  
학습 후에는 adapter 저장, 병합 저장, GGUF 변환처럼 **다음 단계에 맞는 저장 전략**을 선택해야 한다.

🧠 기억할 것  
- 학습과 추론은 같은 모델이라도 입력 형식과 저장 방식이 다를 수 있다.  
- LoRA는 효율적인 학습 전략이고, GGUF는 효율적인 추론 포맷이다.  
- 데이터 포맷이 틀리면 하이퍼파라미터를 아무리 잘 조정해도 결과가 흔들린다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. Full Fine-tuning이 16GB 환경에서 어려운 이유를 "모델 가중치 외에 무엇이 더 필요한가"까지 포함해 설명할 수 있는가?

2. LoRA의 수식 \(W' = W + BA\)에서, 왜 \(BA\)의 크기가 결국 \(W\)와 같은 차원으로 복원되어야 하는지 설명할 수 있는가?

3. `lora_alpha / r`가 실제 스케일로 작동한다는 말이 무슨 뜻인지, `r=16`, `alpha=32` 예시로 설명할 수 있는가?

4. chat template와 label masking이 서로 연결된다는 말이 왜 성립하는가?  
   즉, 템플릿이 바뀌면 왜 response-only 학습 설정도 함께 바뀌어야 하는가?

5. adapter-only 저장과 `merge_and_unload()` 저장은 각각 어떤 상황에서 더 적합한가?

6. QLoRA와 GGUF는 각각 학습과 추론 중 어느 단계의 문제를 해결하는가?

---