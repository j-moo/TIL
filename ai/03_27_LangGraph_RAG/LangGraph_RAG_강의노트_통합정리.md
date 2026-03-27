# LangGraph와 RAG 강의노트 통합정리

- 🎯 글의 목표: LangGraph와 RAG의 큰 흐름을 한 번에 잡고, LLM 단독 응답의 한계에서 출발해 검색 기반 응답 시스템을 직접 구성하는 과정을 이해한다.
- 🧩 핵심 키워드: AI Workflow, LangGraph, LLM Hallucination, Context Injection, Keyword Search, Embedding, VectorDB, Retriever, Chunking, StateGraph, RAG, LangSmith
- ⭐ 중요도: 상
- 📝 한눈에 보는 내용: 이 자료는 `AI Workflow와 LangGraph의 개요`에서 시작해, `LLM의 한계`, `자료 기반 응답`, `키워드 검색`, `의미 기반 검색`, `청킹 전략`, `LangGraph 기반 RAG 파이프라인`, `실습/과제에서의 파라미터 비교`까지 한 번에 묶은 통합 노트다.
- 🔗 관련 문제 / 주제(있다면): 고객 서비스 AI 에이전트, 문서 검색형 챗봇, 사내 문서 Q&A, 검색 증강 생성 시스템 설계

---

## 1. 들어가며

이번 강의의 핵심은 단순히 “RAG를 써보는 법”을 익히는 데 있지 않다.  
더 정확히 말하면, **왜 LLM만으로는 실무 문제를 안정적으로 풀기 어려운지**를 먼저 체감하고, 그 한계를 **검색과 상태 기반 워크플로우**로 어떻게 보완하는지 이해하는 데 있다.

처음에는 LLM이 아주 똑똑해 보인다. 짧은 질문에 자연스럽게 답하고, 웬만한 설명도 곧잘 해낸다. 하지만 실무로 들어가면 곧 막히는 지점이 생긴다. 최신 정책은 반영되지 않을 수 있고, 특정 회사의 내부 문서는 아예 학습되어 있지 않으며, 모르는 내용도 그럴듯하게 답하는 환각 현상이 나타날 수 있다.

이때 필요한 것이 RAG다.  
RAG는 질문에 바로 답하게 하는 대신, 먼저 관련 자료를 찾아서 그 자료를 근거로 답하게 만드는 방식이다. 즉, **“모델의 기억력”에만 기대지 않고, “검색된 근거”를 함께 주는 구조**라고 이해하면 훨씬 쉽다.

그리고 LangGraph는 이 과정을 흐름으로 조립하게 도와준다.  
질문을 받고, 검색하고, 필요한 문맥을 모으고, 답변을 생성하는 단계를 **노드와 엣지로 분리해 상태 기반으로 설계**할 수 있게 해준다. 그래서 단순한 한 번짜리 호출을 넘어, **실제로 운영 가능한 AI 워크플로우**로 확장하기 좋다.

이번 노트는 이 흐름을 다음 순서로 따라간다.

1. AI Workflow와 LangGraph의 역할 이해  
2. LLM 단독 사용의 한계 체감  
3. 자료를 직접 주입하는 방식 이해  
4. 키워드 검색과 의미 기반 검색의 차이 이해  
5. 청킹이 왜 필요한지 정리  
6. LangGraph로 RAG 파이프라인 조립  
7. 실습과 과제를 통해 `chunk_size`, `overlap`, `top_k`를 비교하며 품질 조정 감각 익히기  

---

## 2. 핵심 개념 정리

이 강의는 겉으로 보면 여러 개의 소주제로 나뉘어 있지만, 실제로는 하나의 질문을 단계적으로 풀고 있다.

> **LLM이 모르는 내용을, 어떻게 더 정확하게 답하게 만들 수 있을까?**

이 질문에 대한 흐름은 아래처럼 이어진다.

| 단계 | 다루는 질문 | 핵심 개념 |
|---|---|---|
| 1 | AI 시스템을 흐름으로 만들려면? | AI Workflow, LangGraph |
| 2 | LLM만 쓰면 왜 불안정한가? | Hallucination, 최신 정보 한계, 도메인 지식 부재 |
| 3 | 자료를 직접 넣으면 무엇이 달라지는가? | Context Injection |
| 4 | 관련 자료를 어떻게 찾을까? | Keyword Search, Semantic Search |
| 5 | 문서를 왜 잘게 나눠야 할까? | Chunking, Overlap |
| 6 | 검색과 생성을 어떻게 연결할까? | Retriever, Prompt, RAG |
| 7 | 전체 과정을 어떻게 제어할까? | StateGraph, Node, Edge |
| 8 | 품질은 무엇으로 조정할까? | chunk_size, overlap, top_k, 평가 비교 |

여기서 중요한 점은, RAG를 하나의 마법 같은 기능으로 보면 이해가 끊긴다는 것이다.  
RAG는 사실 여러 단계를 이어 붙인 구조다.

- 문서를 준비하고
- 적절한 크기로 나누고
- 벡터로 바꾸어 저장하고
- 질문과 비슷한 조각을 찾고
- 그 조각을 근거로 답을 생성한다

즉, **RAG는 모델 하나가 아니라 파이프라인**이다.  
그래서 어느 한 부분이 부실하면 전체 응답 품질이 무너질 수 있다. 검색이 틀리면 답도 틀리고, 청킹이 어색하면 근거가 끊기고, top_k가 너무 크면 오히려 불필요한 문맥이 섞여 답이 흐려진다.

이제부터는 이 큰 흐름을 실제 코드와 함께 차근히 따라가 보자.

---

## 3. 본문 정리

## 3.1 AI Workflow와 LangGraph

**AI Workflow**는 LLM이 포함된 작업 흐름을 뜻한다.  
중요한 점은, LLM이 혼자 모든 일을 하는 것이 아니라 **입력 → 처리 → 후처리 → 저장/전송** 같은 단계 안에 들어간다는 것이다.

강의에서는 노코드 도구의 예시를 먼저 보여준다. 예를 들어 어떤 자동화 툴에서는 다음과 같은 흐름이 가능하다.

- 새 데이터가 들어온다.
- LLM이 내용을 요약한다.
- 필요한 정보만 추출한다.
- 다시 스프레드시트나 SNS, 메신저로 보낸다.

쉽게 말하면, **AI Workflow는 “LLM을 포함한 데이터 처리 흐름”**이다.

실무에서 중요한 이유는 여기 있다.  
기업 서비스는 보통 “질문 하나 넣고 답 하나 받기”로 끝나지 않는다.  
대신 다음처럼 여러 단계가 이어진다.

- 고객 질문 수신
- 관련 문서 검색
- 필요한 정보 정리
- 답변 생성
- 로그 저장
- 모니터링/추적

LangGraph는 이런 흐름을 코드로 다루기 쉽게 만든다.  
노드(node)는 작업 단위이고, 엣지(edge)는 순서를 나타낸다.  
그리고 상태(state)는 각 노드가 공유하는 데이터 공간이라고 보면 된다.

### 가장 단순한 LangGraph 예시

```python
from langgraph.graph import StateGraph, START, END

# 1) 첫 번째 노드: 시작 작업
def kfc(state):
    print("KFC 실행")
    return {"result": "kfc 실행"}

# 2) 두 번째 노드: 앞 단계 결과를 이어 받아 후속 작업 수행
def bbq(state):
    print("BBQ 실행")
    return {"result": state["result"] + " -> bbq 실행"}

# 3) 상태 타입으로는 가장 단순하게 dict를 사용
graph = StateGraph(dict)

# 4) 그래프에 노드 등록
graph.add_node("KFC", kfc)
graph.add_node("BBQ", bbq)

# 5) 실행 순서 연결
graph.add_edge(START, "KFC")
graph.add_edge("KFC", "BBQ")
graph.add_edge("BBQ", END)

# 6) 그래프를 실행 가능한 객체로 컴파일
agent = graph.compile()

# 7) 실행
result = agent.invoke({})
print(result)
```

이 코드는 단순하지만 LangGraph의 감각을 잡는 데 매우 좋다.

- 노드는 상태를 입력으로 받고
- 일부 값을 추가하거나 바꾼 뒤
- 다음 노드로 넘긴다

즉, **LangGraph는 “상태를 가지고 흐르는 함수들의 연결망”**이라고 이해하면 된다.

⚠️ **자주 하는 실수**  
LangGraph를 처음 볼 때 노드 함수 자체만 보다가, 상태가 어떻게 이어지는지 놓치기 쉽다.  
하지만 실제로 중요한 것은 함수 한 개보다도, **어떤 값이 상태에 저장되고 다음 노드로 어떻게 전달되는가**이다.

📌 **핵심**  
LangGraph는 LLM 호출을 포함한 여러 단계를 **상태 기반 워크플로우**로 조립하게 해주는 도구다.

---

## 3.2 환경 설정과 LLM의 한계

이제 RAG가 왜 필요한지를 보기 전에, 먼저 LLM을 단독으로 써본다.  
강의가 여기서 바로 RAG로 가지 않고, 일부러 LLM만 먼저 실행해보게 하는 이유가 중요하다. 그래야 이후 단계가 왜 필요한지 몸으로 이해되기 때문이다.

### LLM 초기화

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# temperature=0으로 두면 응답 변동성을 줄여
# 실습에서 결과를 비교하기가 더 쉬워진다.
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0
)

# LangChain에서는 사용자 입력을 HumanMessage로 감싸서 전달한다.
response = llm.invoke([
    HumanMessage(content="안녕하세요")
])

print(response.content)
print(f"모델: {response.response_metadata['model_name']}")
```

여기서 중요한 포인트는 두 가지다.

첫째, `temperature=0`은 실습과 비교 실험에 유리하다.  
같은 질문에 답이 너무 흔들리면, 검색 품질 차이인지 모델 랜덤성인지 구분하기 어렵기 때문이다.

둘째, LangChain에서는 문자열 하나를 바로 던질 수도 있지만, 메시지 객체로 구조화해 두는 습관이 이후 대화형 파이프라인에서 훨씬 유리하다.

### 왜 LLM 단독 응답은 불안정한가

강의는 “삼성전자의 2025년 3분기 매출액은?” 같은 질문을 던져 환각을 확인하게 한다.

```python
response = llm.invoke([
    HumanMessage(content="삼성전자의 2025년 3분기 매출액은?")
])
print(response.content)
```

이 질문의 핵심은 숫자 자체가 아니다.  
핵심은 **모델이 모를 가능성이 큰 정보를 그럴듯하게 말할 수 있다**는 점이다.

LLM 단독 사용의 한계는 보통 세 가지로 정리할 수 있다.

1. **학습 시점 한계**  
   모델은 특정 시점까지의 데이터로만 학습되어 있다. 그 이후 정보는 원천적으로 비어 있을 수 있다.

2. **도메인 지식 부재**  
   사내 문서, 내부 정책, 특정 서비스 약관처럼 공개적으로 널리 알려지지 않은 정보는 모델이 모른다.

3. **환각(Hallucination)**  
   모르는 내용을 “모른다”고 하기보다, 그럴듯하게 꾸며 답하는 경우가 있다.

쉽게 말하면, LLM은 말은 잘하지만 **근거가 자동으로 붙는 것은 아니다**.  
그래서 실무에서는 “대답을 잘하는 모델”보다, **“근거를 바탕으로 말하게 만드는 구조”**가 더 중요해진다.

💡 **포인트**  
RAG는 LLM을 대체하는 기술이 아니라, LLM이 답할 때 참고할 자료를 붙여 **답의 근거를 보강하는 기술**이다.

📌 **핵심**  
LLM 단독 응답은 자연스럽지만, 최신성·정확성·도메인 특화 정보에서는 쉽게 흔들릴 수 있다.

---

## 3.3 자료 기반 응답: 문서를 직접 주입해 보기

환각을 확인한 뒤, 다음 단계는 아주 단순하다.  
검색을 붙이기 전에 먼저 **문서를 직접 프롬프트에 넣어보는 것**이다.

이 단계는 RAG의 축소판처럼 볼 수 있다.  
아직 자동 검색은 없지만, “자료를 같이 넣으면 답이 달라진다”는 감각을 먼저 익히게 해준다.

### PDF 문서 로드

```python
from langchain_community.document_loaders import PyMuPDFLoader

# PDF를 읽어서 페이지 단위 Document 리스트로 변환한다.
loader = PyMuPDFLoader("report.pdf")
documents = loader.load()

print(f"페이지 수: {len(documents)}")
print(f"첫 페이지 내용(100자): {documents[0].page_content[:100]}...")
print(f"메타데이터: {documents[0].metadata}")
```

여기서 `documents`는 단순 문자열 리스트가 아니라 `Document` 객체 리스트다.  
각 원소에는 보통 다음 정보가 들어 있다.

- `page_content`: 실제 텍스트
- `metadata`: 페이지 번호, 파일 경로 등 부가 정보

이 구조가 중요한 이유는, 나중에 검색 결과를 보여주거나 출처를 추적할 때 **텍스트만이 아니라 문서 정보까지 함께 다뤄야 하기 때문**이다.

### 문서를 프롬프트에 주입

```python
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_template("""
다음 자료를 기반으로 질문에 답변하세요.

자료:
{context}

질문: {question}
""")

# 여러 페이지를 하나의 문자열로 이어 붙인다.
context = "\n".join([doc.page_content for doc in documents])

# 프롬프트와 LLM을 체인으로 연결
chain = prompt | llm

# 자료를 넣은 상태로 질문
response = chain.invoke({
    "context": context,
    "question": "매출액은?"
})

print(response.content)
```

이 단계에서 중요한 점은, 답변 품질이 “모델이 똑똑해서” 좋아지는 것이 아니라  
**관련 자료가 같이 들어가서** 좋아진다는 것이다.

즉, 자료 기반 응답은 LLM 자체를 바꾸는 것이 아니라 **입력 구조를 바꾸는 방식**이다.

⚠️ **자주 하는 실수**  
문서 전체를 무작정 한 번에 넣는 방식은 실습 초반에는 이해에 도움이 되지만, 문서가 커지면 곧 한계가 온다.

- 토큰 수가 너무 커질 수 있고
- 관련 없는 내용까지 같이 들어가며
- 질문과 무관한 문맥이 응답을 흐릴 수 있다

그래서 다음 단계에서 검색이 필요해진다.

📌 **핵심**  
자료를 직접 프롬프트에 넣는 방식은 RAG 이전 단계로서, **컨텍스트가 있으면 답변이 더 정확해진다**는 사실을 확인하게 해준다.

---

## 3.4 키워드 검색: 가장 단순한 검색부터 시작하기

이제 “자료를 넣으면 좋다”는 것은 알았다.  
문제는 **어떤 자료를 넣을 것인가**이다. 모든 문서를 다 넣을 수는 없으니, 질문과 관련된 문서를 찾아야 한다.

가장 단순한 방법은 키워드 검색이다.  
질문에 포함된 단어나, 우리가 지정한 단어가 문서 안에 그대로 들어 있는지 확인하는 방식이다.

### 키워드 검색 함수

```python
def keyword_search(documents, keyword):
    """문서 텍스트 안에 keyword가 포함된 Document만 반환한다."""
    results = []

    for doc in documents:
        # page_content는 실제 문서 텍스트다.
        if keyword in doc.page_content:
            results.append(doc)

    return results


# 사용 예시
results = keyword_search(documents, "매출")
print(f"검색 결과: {len(results)}건")

for doc in results[:2]:
    page_no = doc.metadata.get("page", "?")
    print(f"[p.{page_no}] {doc.page_content[:80]}...")
```

이 코드는 매우 단순하지만, 검색의 본질을 이해하는 데 도움이 된다.  
질문과 관련 있는 문서를 고르는 첫 기준을 **텍스트 일치 여부**로 두는 것이다.

### 왜 키워드 검색은 금방 한계를 드러낼까

문제는 단어가 다르면 검색이 되지 않는다는 점이다.  
예를 들어 문서에는 “총알배송”이라고 적혀 있는데, 사용자가 “빠른 배송”, “신속 배송”, “배송 빨리”라고 질문하면 어떻게 될까?

실습에서는 이런 식으로 한계를 시험한다.

```python
test_keywords = [
    "빠른 배송",
    "배송 빨리",
    "신속 배송",
    "총알배송",
]

for kw in test_keywords:
    results = keyword_search(all_documents, kw)
    print(f"'{kw}': {len(results)}개 문서 발견")
```

이 비교에서 핵심은, **사람은 같은 의미로 느끼지만 컴퓨터는 같은 문자열이 아니면 못 찾을 수 있다**는 점이다.

키워드 검색은 다음 상황에서는 꽤 잘 작동한다.

- 용어가 정확히 고정된 경우
- 문서 표현이 표준화된 경우
- 특정 키워드 존재 여부만 보면 되는 경우

하지만 다음 상황에서는 약해진다.

- 동의어, 유의어가 많은 경우
- 표현 방식이 질문마다 달라지는 경우
- 문장이 길고 자연어 표현이 많은 경우

💡 **쉽게 말하면**  
키워드 검색은 “단어를 찾는 검색”이고, 우리가 원하는 것은 점점 “의미를 찾는 검색”에 가까워진다.

⚠️ **자주 하는 실수**  
키워드 검색 결과가 0건이라고 해서 관련 내용이 없는 것은 아니다.  
단지 **같은 의미를 다른 표현으로 적었을 가능성**을 먼저 떠올려야 한다.

📌 **핵심**  
키워드 검색은 가장 단순하고 직관적이지만, **표현이 조금만 달라져도 놓칠 수 있다**는 한계가 있다.

---

## 3.5 의미 기반 검색과 VectorDB

키워드 검색의 한계를 넘기 위해 등장하는 것이 임베딩과 의미 기반 검색이다.

핵심 아이디어는 단순하다.  
문장을 문자 그대로 비교하지 않고, **의미를 벡터로 바꿔서 가까운 것끼리 찾는 것**이다.

예를 들어 아래 문장들은 글자는 다르지만 의미가 꽤 비슷하다.

- 매출이 증가했다
- 수익이 늘었다
- 실적이 좋아졌다

키워드 검색은 이 셋을 각각 다른 문자열로 본다.  
하지만 의미 기반 검색은 이 셋을 **비슷한 방향의 벡터**로 표현하려고 한다.

### 임베딩 생성

```python
from langchain_openai import OpenAIEmbeddings

# 텍스트를 벡터로 바꾸는 임베딩 모델
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# 하나의 문장을 벡터로 변환
vector = embeddings.embed_query("매출이 증가했다")

print(f"벡터 차원: {len(vector)}")
print(f"벡터 앞 5개 값: {[round(v, 4) for v in vector[:5]]}")
```

벡터 값 그 자체를 읽어 이해할 필요는 없다.  
중요한 것은, **텍스트를 숫자 공간으로 옮겨 의미적 거리 계산이 가능해진다**는 점이다.

### Vector Store에 문서 저장

```python
from langchain_chroma import Chroma

# Document 리스트를 임베딩해서 벡터 저장소에 적재
vectorstore = Chroma.from_documents(
    documents=documents,
    embedding=embeddings
)

print(f"저장된 문서 수: {vectorstore._collection.count()}")
```

Vector Store는 말 그대로 **벡터 검색을 위한 저장소**다.  
강의에서는 Chroma를 사용한다. 실습 기준으로는 가볍게 시작하기 좋고, 로컬 환경에서도 빠르게 테스트하기 편하다.

### Retriever로 의미 기반 검색

```python
# 상위 3개 문서를 찾아오는 검색기 생성
retriever = vectorstore.as_retriever(
    search_kwargs={"k": 3}
)

# 질문과 의미적으로 비슷한 문서를 찾는다.
results = retriever.invoke("회사 실적은?")

print(f"검색 결과: {len(results)}건")
for doc in results:
    page_no = doc.metadata.get("page", "?")
    print(f"[p.{page_no}] {doc.page_content[:60]}...")
```

이제부터 검색은 단순 포함 여부가 아니라 **질문과 문서 조각이 얼마나 비슷한 의미를 갖는가**로 바뀐다.

실습 자료에서도 “총알배송” 대신 “빠른 배송”, “신속 배송” 같은 표현을 넣었을 때 의미 기반 검색이 더 잘 반응하는 흐름을 보여준다.

### 키워드 검색 vs 의미 기반 검색

| 비교 항목 | 키워드 검색 | 의미 기반 검색 |
|---|---|---|
| 기준 | 문자열 일치 | 의미 유사도 |
| 장점 | 단순하고 빠름 | 표현이 달라도 찾기 쉬움 |
| 약점 | 동의어 처리 약함 | 임베딩 품질과 데이터 품질에 영향 받음 |
| 잘 맞는 상황 | 정형 문서, 정확한 용어 검색 | 자연어 질문, 다양한 표현 처리 |

⚠️ **자주 하는 실수**  
의미 기반 검색이 항상 완벽하다고 생각하면 안 된다.  
문서 조각이 너무 크거나 너무 작으면 의미가 흐려질 수 있고, 질문이 지나치게 짧으면 엉뚱한 문서가 매칭될 수도 있다.

즉, 의미 기반 검색은 강력하지만 **전처리와 청킹 품질에 크게 의존**한다.

📌 **핵심**  
의미 기반 검색은 질문과 문서를 벡터 공간에서 비교해, **같은 단어가 아니어도 비슷한 의미를 찾게 해준다.**

---

## 3.6 청킹 전략: 문서를 왜 잘라야 하는가

이제 검색의 방향은 잡혔다.  
그런데 실제 문서는 길다. PDF 한 페이지도 길 수 있고, 여러 페이지를 그대로 임베딩하려 하면 문맥이 너무 넓어지거나 토큰 제한에 걸릴 수 있다.

그래서 필요한 것이 청킹이다.

청킹은 긴 문서를 적절한 크기의 조각으로 나누는 작업이다.  
여기서 중요한 점은 단순 분할이 아니라, **검색과 생성이 모두 잘 되도록 문맥 단위를 조절하는 것**이다.

### 기본 청킹 코드

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

# 의미 단위를 최대한 보존하려고
# 큰 구분자부터 순서대로 분할을 시도한다.
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,      # 청크 최대 길이
    chunk_overlap=50,    # 인접 청크 간 겹침 길이
    separators=["\n\n", "\n", ".", " "]
)

chunks = splitter.split_documents(documents)

print(f"원본 문서 수: {len(documents)}")
print(f"생성된 청크 수: {len(chunks)}")

sizes = [len(c.page_content) for c in chunks]
print(f"평균 길이: {sum(sizes)/len(sizes):.0f}")
print(f"최소 길이: {min(sizes)}")
print(f"최대 길이: {max(sizes)}")
```

이 코드에서 이해해야 할 핵심 변수는 두 개다.

### `chunk_size`는 무엇을 조절할까

`chunk_size`가 작으면 검색 대상이 더 세밀해진다.  
질문과 정확히 맞는 짧은 조각을 고르기 쉬워질 수 있다. 대신 문맥이 잘려나가 의미가 끊길 수 있다.

반대로 `chunk_size`가 크면 한 조각 안에 더 많은 정보가 들어간다.  
문맥은 풍부해지지만, 관련 없는 정보까지 함께 들어가서 검색이 흐려질 수 있다.

### `chunk_overlap`은 왜 필요할까

문장이 청크 경계에서 잘리면 중요한 정보가 둘로 쪼개질 수 있다.  
이때 겹침을 조금 두면, 경계 근처 정보가 다음 청크에도 일부 포함되어 문맥 손실을 줄일 수 있다.

쉽게 말하면, overlap은 **책장을 자를 때 문장 끝이 날아가지 않도록 조금 겹쳐 복사하는 것**에 가깝다.

### chunk_size 비교 실험

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

for size in [200, 500, 1000]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=50
    )
    chunked = splitter.split_documents(documents)
    print(f"chunk_size={size:4d} -> 청크 수: {len(chunked):3d}개")
```

이 비교에서 기억해야 할 감각은 다음과 같다.

- 작은 청크: 세밀한 검색, 그러나 문맥 부족 위험
- 큰 청크: 문맥 풍부, 그러나 검색 초점 약화 위험
- overlap 증가: 문맥 보존에 도움, 그러나 중복 증가

실습 과제에서는 실제로 `chunk_size`, `chunk_overlap`을 바꿔가며 검색 결과 차이를 비교하게 만든다. 이 부분이 중요한 이유는, RAG 품질이 모델 하나로 정해지는 것이 아니라 **문서 분할 방식에도 크게 좌우된다**는 점을 체감하게 해주기 때문이다.

### 실무형 청킹 함수 예시

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
import tiktoken

def create_vectorstore_with_chunking(documents, chunk_size, chunk_overlap, collection_name):
    # 1) 문서를 청크 단위로 분할
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    chunked_docs = splitter.split_documents(documents)

    # 2) 임베딩 모델의 토큰 제한을 넘지 않도록 안전장치 적용
    max_tokens = 8000
    enc = tiktoken.encoding_for_model("text-embedding-3-small")

    for doc in chunked_docs:
        tokens = enc.encode(doc.page_content)

        # 너무 긴 청크는 잘라서 임베딩 오류를 예방
        if len(tokens) > max_tokens:
            doc.page_content = enc.decode(tokens[:max_tokens])

    # 3) 청크를 벡터 저장소에 저장
    vectorstore = Chroma.from_documents(
        documents=chunked_docs,
        embedding=embeddings,
        collection_name=collection_name
    )

    return vectorstore, chunked_docs
```

이 함수에서 특히 눈여겨볼 부분은 토큰 제한 안전장치다.  
실무에서는 “문서를 벡터화했다”에서 끝나는 것이 아니라, **임베딩 모델 입력 제한**도 반드시 고려해야 한다.

⚠️ **자주 하는 실수**  
문서가 길다고 무조건 크게 자르면 좋은 것이 아니다.  
검색은 오히려 덜 정확해질 수 있다.  
반대로 너무 짧게 자르면 문장 맥락이 분리되어, 답변 생성 시 필요한 근거가 끊긴다.

📌 **핵심**  
청킹은 단순한 전처리가 아니라, **검색 품질과 답변 품질을 함께 좌우하는 핵심 설계 요소**다.

---

## 3.7 RAG 파이프라인: 검색과 생성을 연결하기

이제 필요한 부품은 거의 다 모였다.

- LLM
- 문서
- 임베딩
- 벡터 저장소
- 검색기
- 프롬프트

이제 이것들을 연결하면 RAG가 된다.  
그리고 LangGraph는 이 연결을 **상태 기반 파이프라인**으로 정리해 준다.

### RAGState 정의

```python
from typing import TypedDict, List
from langchain_core.documents import Document

# 그래프에서 공유할 상태 정의
class RAGState(TypedDict):
    question: str               # 사용자 질문
    context: List[Document]     # 검색된 문서 조각
    answer: str                 # 최종 생성 답변
```

여기서 중요한 점은, 상태를 미리 명시하면 각 노드가 무엇을 받아 무엇을 채워 넣는지 훨씬 선명해진다는 것이다.

### retrieve / generate 노드 구현

```python
from langchain_core.prompts import ChatPromptTemplate

def retrieve(state: RAGState) -> RAGState:
    """질문을 받아 관련 문서를 검색한다."""
    docs = retriever.invoke(state["question"])
    return {"context": docs}

def generate(state: RAGState) -> RAGState:
    """검색된 문서를 바탕으로 답변을 생성한다."""
    # Document 리스트를 하나의 문자열 컨텍스트로 합친다.
    context_text = "\n".join([
        doc.page_content for doc in state["context"]
    ])

    # 질문 + 검색 문맥을 함께 넣는 프롬프트
    prompt = ChatPromptTemplate.from_template("""
다음 자료를 기반으로 답변하세요.

자료:
{context}

질문:
{question}
""")

    chain = prompt | llm
    response = chain.invoke({
        "context": context_text,
        "question": state["question"]
    })

    return {"answer": response.content}
```

이 구조가 RAG의 핵심이다.

1. `retrieve`가 먼저 관련 근거를 찾는다.  
2. `generate`가 그 근거를 바탕으로 답을 만든다.  

즉, 답변 생성 전에 **근거 수집 단계가 하나 끼어든다**.

### StateGraph로 조립

```python
from langgraph.graph import StateGraph, START, END

graph = StateGraph(RAGState)

# 노드 등록
graph.add_node("retrieve", retrieve)
graph.add_node("generate", generate)

# 실행 순서 연결
graph.add_edge(START, "retrieve")
graph.add_edge("retrieve", "generate")
graph.add_edge("generate", END)

# 실행 가능한 그래프로 컴파일
app = graph.compile()

# 질문 실행
result = app.invoke({"question": "매출 현황은?"})

print(f"질문: {result['question']}")
print(f"검색 문서 수: {len(result['context'])}")
print(f"답변: {result['answer']}")
```

이 코드는 구조가 아주 직관적이다.  
START에서 시작해 retrieve로 가고, generate를 거쳐 END로 끝난다.

이렇게 명시적으로 흐름을 만들면 좋은 점이 많다.

- 검색과 생성을 분리해 디버깅하기 쉽다
- 중간 상태를 보기 쉽다
- 이후 재검색, 분기, 평가 노드를 추가하기 좋다

즉, LangGraph를 쓰는 이유는 “코드가 멋져서”가 아니라  
**파이프라인을 관리 가능한 구조로 만들기 위해서**다.

💡 **포인트**  
초보자 입장에서는 RAG가 복잡해 보이지만, 결국 retrieve와 generate라는 두 축으로 보면 이해가 훨씬 쉬워진다.

📌 **핵심**  
RAG는 `검색 → 생성` 두 단계를 연결한 구조이고, LangGraph는 이를 **노드와 상태**로 명확하게 표현하게 해준다.

---

## 3.8 실습: Yes24 고객 서비스 AI 에이전트

실습 노트는 위 개념들을 실제 서비스형 예제로 묶어 보여준다.  
주제는 Yes24 관련 PDF 문서를 근거로 답하는 고객 서비스 AI 에이전트다.

이 예제가 좋은 이유는, 단순한 이론이 아니라 **서비스 문서 기반 질의응답**이라는 실무형 시나리오를 제공하기 때문이다.

### 1) 여러 PDF 문서 로드

```python
from langchain_community.document_loaders import PyMuPDFLoader
import glob
import os

DATA_DIR = "data/"
pdf_files = glob.glob(DATA_DIR + "*.pdf")

all_documents = []

for pdf_path in pdf_files:
    loader = PyMuPDFLoader(pdf_path)
    docs = loader.load()

    # 나중에 출처를 확인할 수 있도록 파일명도 메타데이터에 저장
    for doc in docs:
        doc.metadata["source_file"] = os.path.basename(pdf_path)

    all_documents.extend(docs)

print(f"총 {len(all_documents)}개 페이지 로드 완료")
```

이렇게 해 두면 나중에 검색 결과가 어느 PDF에서 왔는지 확인할 수 있다.  
RAG에서 출처를 추적하는 습관은 매우 중요하다. 답이 맞는지만 보는 것이 아니라, **무슨 근거로 그렇게 답했는지**를 확인해야 하기 때문이다.

### 2) 벡터 저장소 생성 전 토큰 제한 처리

```python
from langchain_community.vectorstores import Chroma
import tiktoken

MAX_TOKENS = 8000
enc = tiktoken.encoding_for_model("text-embedding-3-small")

for doc in all_documents:
    tokens = enc.encode(doc.page_content)

    # 임베딩 모델 입력 제한을 넘는 페이지는 잘라서 안전하게 처리
    if len(tokens) > MAX_TOKENS:
        doc.page_content = enc.decode(tokens[:MAX_TOKENS])

vectorstore = Chroma.from_documents(
    documents=all_documents,
    embedding=embeddings,
    collection_name="yes24_docs_page"
)
```

이 부분은 실습 코드이지만 실무 감각이 잘 드러난다.  
실제 시스템은 “이론적으로 된다”가 아니라 “오류 없이 돌아가야 한다”. 그래서 토큰 제한 같은 현실적인 제약도 설계에 포함되어야 한다.

### 3) LangGraph 기반 RAG 상담 흐름

```python
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_core.prompts import ChatPromptTemplate

class RAGState(TypedDict):
    question: str
    context: str
    answer: str

def retrieve(state: RAGState) -> RAGState:
    # 청킹된 벡터 저장소에서 관련 문서를 검색
    docs = retriever_chunked.invoke(state["question"])

    # 여러 문서 조각을 하나의 문자열 컨텍스트로 합친다.
    context = "\n\n".join([doc.page_content for doc in docs])
    return {"context": context}

def generate(state: RAGState) -> RAGState:
    rag_prompt = ChatPromptTemplate.from_messages([
        ("system", """당신은 AI 온라인 서점 'Yes24'의 고객 서비스 상담원입니다.
다음 검색된 자료를 참고하여 고객의 질문에 정확하고 친절하게 답변해주세요.

[검색된 자료]
{context}

답변 규칙:
1. 검색된 자료를 기반으로 답변하세요
2. 자료에 없는 내용은 추측하지 마세요
3. 존댓말을 사용하세요
4. 간결하고 명확하게 답변하세요"""),
        ("human", "{question}")
    ])

    messages = rag_prompt.format_messages(
        context=state["context"],
        question=state["question"]
    )

    response = llm.invoke(messages)
    return {"answer": response.content}

workflow = StateGraph(RAGState)
workflow.add_node("retrieve", retrieve)
workflow.add_node("generate", generate)

workflow.add_edge(START, "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

rag_graph = workflow.compile()
```

이 코드에서 아주 중요한 부분은 시스템 프롬프트의 규칙이다.

- 검색된 자료 기반 답변
- 자료에 없는 내용 추측 금지
- 존댓말 사용
- 간결하고 명확하게 답변

즉, RAG 품질은 검색만으로 끝나지 않는다.  
**검색된 문맥을 어떻게 사용하라고 모델에 지시하는지**도 매우 중요하다.

⚠️ **자주 하는 실수**  
검색을 붙였다고 해서 모델이 자동으로 얌전히 근거 기반 답변만 하지는 않는다.  
프롬프트에서 “없는 내용은 추측하지 말라”는 식의 규칙을 함께 주지 않으면, 검색 문맥이 있어도 여전히 과장하거나 보충해서 말할 수 있다.

📌 **핵심**  
서비스형 RAG에서는 검색 품질뿐 아니라, **답변 태도와 제약을 정하는 프롬프트 설계**도 함께 중요하다.

---

## 3.9 과제: chunk_size와 top_k를 어떻게 조정할까

강의의 마지막이 좋은 이유는, 여기서 끝내지 않고 품질 조정 실험까지 이어진다는 점이다.  
RAG는 “일단 만들면 끝”이 아니라, **검색 성능과 답변 품질을 튜닝해야 하는 시스템**이기 때문이다.

### chunk_size / overlap 비교용 함수

```python
def create_vectorstore_with_chunking(documents, chunk_size, chunk_overlap, collection_name):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""]
    )

    chunked_docs = splitter.split_documents(documents)

    max_tokens = 8000
    enc = tiktoken.encoding_for_model("text-embedding-3-small")

    for doc in chunked_docs:
        tokens = enc.encode(doc.page_content)
        if len(tokens) > max_tokens:
            doc.page_content = enc.decode(tokens[:max_tokens])

    vectorstore = Chroma.from_documents(
        documents=chunked_docs,
        embedding=embeddings,
        collection_name=collection_name
    )

    return vectorstore, chunked_docs
```

이 함수는 과제의 핵심 실험 기반이다.  
청킹 설정을 바꾸고, 그 결과 검색과 응답 품질이 어떻게 달라지는지 비교할 수 있게 만든다.

### top_k 비교용 구성

```python
from langchain_core.prompts import ChatPromptTemplate

rag_prompt = ChatPromptTemplate.from_messages([
    ("system", """당신은 온라인 서점 'Yes24'의 고객 서비스 상담원입니다.
다음 검색된 자료를 참고하여 고객의 질문에 정확하고 친절하게 답변해주세요.

[검색된 자료]
{context}

답변 규칙:
1. 검색된 자료를 기반으로 답변하세요
2. 자료에 없는 내용은 추측하지 마세요"""),
    ("human", "{question}")
])

def format_docs(docs):
    return "\n\n".join([doc.page_content for doc in docs])

def run_rag(retriever, question):
    docs = retriever.invoke(question)
    context = format_docs(docs)

    messages = rag_prompt.format_messages(
        context=context,
        question=question
    )
    response = llm.invoke(messages)
    return response.content

def create_rag_components(vectorstore, k):
    return vectorstore.as_retriever(search_kwargs={"k": k})
```

이제 `k=2`, `k=5`처럼 바꿔가며 비교할 수 있다.

### top_k는 무엇을 조절할까

`top_k`는 검색기가 몇 개의 관련 문서를 가져올지 정하는 값이다.

- 너무 작으면: 필요한 근거 일부를 놓칠 수 있다
- 너무 크면: 관련 없는 문맥이 섞여 답변이 흐려질 수 있다

즉, top_k는 “얼마나 많이 가져올까”의 문제가 아니라,  
**“얼마나 적절한 범위의 근거를 줄까”**의 문제다.

### 실무에서 자주 나타나는 경향

| 파라미터 | 작을 때 경향 | 클 때 경향 |
|---|---|---|
| `chunk_size` | 세밀하나 문맥 부족 가능 | 문맥 풍부하나 검색 초점 약화 가능 |
| `chunk_overlap` | 중복 적음, 경계 손실 가능 | 문맥 보완, 중복 증가 |
| `top_k` | 근거 부족 위험 | 잡음 증가 위험 |

이 비교에서 중요한 것은 “정답 하나”를 외우는 것이 아니다.  
문서 성격에 따라 적정값이 달라지기 때문이다.

예를 들어 정책 문서처럼 조항이 비교적 짧고 구조화되어 있으면 작은 청크가 유리할 수 있다.  
반대로 설명형 안내 문서처럼 맥락이 길게 이어지는 자료는 너무 잘게 자르면 오히려 문장이 끊길 수 있다.

💡 **포인트**  
좋은 RAG 설정은 절대적인 숫자가 아니라, **문서 구조와 질문 유형에 맞는 균형점**을 찾는 것이다.

📌 **핵심**  
RAG 품질은 모델만이 아니라 `chunk_size`, `chunk_overlap`, `top_k` 같은 검색 파라미터에 크게 좌우된다.

---

## 3.10 LangSmith와 트러블슈팅: 운영 관점에서 보기

강의 초반 자료에는 LangSmith 설정과 추적(Tracing)도 함께 나온다.  
이 부분은 초보자에게는 부가 기능처럼 보일 수 있지만, 실제로는 운영 관점에서 매우 중요하다.

RAG는 중간 단계가 많다.

- 어떤 질문이 들어왔는지
- 어떤 검색 결과가 뽑혔는지
- 어떤 프롬프트가 최종적으로 만들어졌는지
- 답변이 왜 그렇게 나왔는지

이 과정을 추적하지 않으면, 결과가 이상할 때 어디서 문제가 생겼는지 알기 어렵다.

그래서 LangSmith 같은 도구는 단순 로그 수집이 아니라, **LLM 애플리케이션 디버깅 도구**로 이해하는 것이 맞다.

또한 강의에서는 실습 중 생길 수 있는 문제도 언급한다.

- API 키 설정 문제
- `.env` 로드 문제
- 이전 실행 결과가 남아 보이는 문제
- 파이썬 프로세스 정리 필요 문제

이런 부분이 중요한 이유는, 실제 AI 개발은 개념 이해만으로 끝나지 않기 때문이다.  
**환경 설정, 실행 상태, 추적, 디버깅**까지 포함해야 비로소 “돌아가는 시스템”이 된다.

📌 **핵심**  
RAG와 LangGraph를 배우는 목적은 단순 구현이 아니라, **추적 가능한 AI 워크플로우를 운영 가능한 형태로 만드는 것**에 있다.

---

## 4. 적용 관점에서 다시 보기

이제 본문에서 배운 내용을 실제 문제풀이나 구현 감각으로 다시 묶어 보자.

### 어떤 상황에서 RAG를 떠올려야 할까

다음과 같은 신호가 보이면 RAG를 떠올릴 가능성이 높다.

- 모델이 최신 정보를 알아야 한다
- 특정 서비스 정책, 내부 문서, PDF, 매뉴얼을 근거로 답해야 한다
- 답변 정확도가 중요하고, 출처 확인이 필요하다
- 자연어 질문이 다양하게 들어온다

반대로, 이미 모델이 충분히 아는 일반 상식 질문이나 창작형 작업에서는 굳이 RAG가 필요하지 않을 수도 있다.

### 구현 순서는 어떻게 잡으면 좋을까

RAG를 만들 때는 보통 아래 순서가 가장 안정적이다.

1. **LLM 단독 응답 확인**  
   문제 상황을 먼저 눈으로 본다.

2. **문서 직접 주입 실험**  
   자료가 들어가면 좋아지는지 확인한다.

3. **검색 도입**  
   필요한 자료만 자동으로 뽑도록 만든다.

4. **의미 기반 검색으로 확장**  
   키워드 한계를 넘어선다.

5. **청킹 조정**  
   검색 품질을 개선한다.

6. **LangGraph로 흐름 구조화**  
   상태 기반으로 관리한다.

7. **파라미터 튜닝 및 평가**  
   chunk_size, overlap, top_k를 비교한다.

이 순서를 지키면, 무엇이 문제인지 단계별로 분해하기가 쉽다.  
처음부터 모든 것을 한꺼번에 얹으면, 검색이 문제인지 프롬프트가 문제인지 파라미터가 문제인지 분간하기 어려워진다.

### 문제를 보면 어떤 신호를 포착해야 할까

- 질문 표현이 다양하다 → 의미 기반 검색 필요성 상승
- 문서가 길다 → 청킹 전략 중요
- 답변이 장황하고 흐리다 → top_k 과다 가능성
- 필요한 정보가 자꾸 빠진다 → top_k 부족 또는 청크 분할 문제 가능성
- 검색 결과는 맞는데 답변이 과장된다 → 프롬프트 제약 보강 필요
- 같은 질문에서 결과가 들쭉날쭉하다 → temperature, 검색 안정성, 문맥 길이 점검

### 실전에서 자주 틀리는 패턴

1. **문서 전체를 그냥 넣고 RAG라고 부르는 경우**  
   이건 자료 주입일 수는 있어도, 자동 검색 기반 RAG라고 보기 어렵다.

2. **검색만 붙이면 해결된다고 생각하는 경우**  
   검색 결과를 어떤 규칙으로 쓰게 할지도 같이 설계해야 한다.

3. **chunk_size를 너무 감으로 정하는 경우**  
   실제 질문으로 비교 실험을 해봐야 한다.

4. **검색 결과 출처를 안 남기는 경우**  
   잘못된 답이 나왔을 때 역추적이 어려워진다.

5. **LangGraph를 복잡한 기능으로만 보는 경우**  
   핵심은 분기보다도 먼저, 상태 흐름을 명확하게 만드는 데 있다.

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의에서 가장 크게 남는 점은, 좋은 AI 응답이 단순히 좋은 모델에서만 나오지 않는다는 사실이다.  
오히려 실무에서는 **모델 앞뒤에 어떤 흐름을 붙이느냐**가 더 중요할 때가 많다.

특히 인상적인 흐름은 다음과 같다.

- LLM 단독 응답의 한계를 일부러 확인한다.
- 자료를 직접 주입해 보며 컨텍스트의 효과를 체감한다.
- 키워드 검색의 단순함과 한계를 본다.
- 의미 기반 검색으로 자연어 질의에 대응한다.
- 청킹과 top_k를 조정해 검색 품질을 다듬는다.
- LangGraph로 전체 과정을 관리 가능한 파이프라인으로 만든다.

이 흐름을 잘 이해하면, 이후에는 다음 주제로 자연스럽게 확장할 수 있다.

- 재검색(rewrite-query, multi-query retrieval)
- 검색 결과 재정렬(reranking)
- 답변 근거 출처 표시
- LLM as a Judge를 통한 응답 평가
- LangGraph 분기/반복 구조
- 멀티 에이전트 워크플로우
- 메모리와 대화 상태 결합

즉, 이번 강의는 RAG의 끝이 아니라 **검색형 AI 시스템 설계의 출발점**에 가깝다.

---

## 6. 요약 정리

📌 **핵심**

- LLM 단독 사용은 환각, 최신 정보 한계, 도메인 지식 부재 문제를 갖는다.
- 자료를 직접 프롬프트에 넣으면 답변 품질이 좋아질 수 있다.
- 하지만 문서가 많아지면 필요한 자료만 찾아주는 검색 단계가 필요하다.
- 키워드 검색은 단순하지만, 표현이 달라지면 놓칠 수 있다.
- 의미 기반 검색은 임베딩과 VectorDB를 통해 비슷한 의미의 문서를 찾게 해준다.
- 청킹은 검색과 생성 품질을 함께 좌우하는 핵심 설계 요소다.
- RAG는 `검색 → 생성` 구조이며, LangGraph는 이를 상태 기반 파이프라인으로 명확하게 만든다.
- 실무에서는 `chunk_size`, `chunk_overlap`, `top_k`를 비교하며 품질을 조정해야 한다.

🧠 **기억할 것**

- RAG는 기능 하나가 아니라 여러 단계를 묶은 파이프라인이다.
- 좋은 답변은 좋은 모델만으로 나오지 않는다. 좋은 검색과 좋은 문맥 설계가 함께 필요하다.
- LangGraph의 핵심은 복잡한 분기 이전에, **상태 흐름을 선명하게 만드는 것**이다.
- “검색 결과가 맞는가?”와 “그 결과를 모델이 잘 사용했는가?”는 별개의 문제다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. LLM 단독 응답에서 환각이 발생하는 이유를 `최신성`, `도메인 지식`, `응답 성향` 관점에서 설명해보자.

2. 문서를 직접 프롬프트에 넣는 방식과, 검색을 통해 필요한 문맥만 넣는 방식의 차이를 말해보자.

3. 키워드 검색이 실패하지만 의미 기반 검색은 성공할 수 있는 예시를 하나 직접 만들어보자.

4. `chunk_size`가 너무 작을 때와 너무 클 때 각각 어떤 문제가 생길 수 있는지 설명해보자.

5. LangGraph에서 `State`, `Node`, `Edge`가 각각 어떤 역할을 하는지 RAG 파이프라인에 연결해서 설명해보자.

6. `top_k=2`와 `top_k=5` 중 어느 쪽이 더 좋다고 단정할 수 없는 이유를 문서 특성과 질문 특성 관점에서 정리해보자.

7. 아래 항목을 스스로 점검해보자.

- [ ] LLM 단독 응답과 RAG 응답의 차이를 말할 수 있다.
- [ ] 키워드 검색과 의미 기반 검색의 차이를 설명할 수 있다.
- [ ] 청킹이 왜 필요한지 말할 수 있다.
- [ ] Retriever가 무엇을 하는지 설명할 수 있다.
- [ ] LangGraph로 `retrieve -> generate` 흐름을 왜 나누는지 설명할 수 있다.
- [ ] RAG 품질 조정에 `chunk_size`, `overlap`, `top_k`가 왜 중요한지 알고 있다.
