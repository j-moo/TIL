# LangGraph로 배우는 Agent 설계와 Multi-Agent Workflow

- 🎯 글의 목표: LangGraph의 핵심 개념을 `State → Tool → Memory → Planning → ReAct → Trustworthiness → Multi-Agent → UI 연동` 흐름으로 한 번에 정리하고, 실습 코드가 왜 그렇게 구성되는지까지 이해하는 데 있다.
- 🧩 핵심 키워드: `StateGraph`, `MessagesState`, `Tool`, `MemorySaver`, `create_react_agent`, `ReAct`, `Direct Pattern`, `Guardrail`, `Planner-Worker`, `Supervisor`, `Reflection`, `Gradio`
- ⭐ 중요도: 매우 높음
- 📝 한눈에 보는 내용: 이번 강의는 단순히 “LangGraph 문법을 익히는 수업”이 아니라, **LLM을 실제로 일하게 만드는 구조를 설계하는 법**을 단계적으로 익히는 수업이다. 처음에는 State와 Graph의 기본 문법을 배우고, 그 위에 Tool과 Memory를 얹어 Agent를 만든다. 이후 Direct와 ReAct를 비교하며 “왜 단순 연결만으로는 부족한가”를 이해하고, 신뢰성 계층을 더해 실무형 Agent로 확장한다. 마지막에는 Planner-Worker, Supervisor, Reflection 같은 대표 Multi-Agent 패턴과 Gradio UI 연동까지 이어지며, 결국 **혼자 답하는 LLM에서, 협업하고 검증하며 서비스화되는 Agent 시스템**으로 시야를 넓히게 된다.
- 🔗 관련 문제 / 주제(있다면): 고객 서비스 AI, 정책 검색 RAG, 쿠폰 발급 자동화, 여행 플래너, 보고서 작성, 다단계 작업 분해, 평가 기반 개선 루프

---

## 1. 들어가며

LLM은 질문에 답을 잘하는 것처럼 보이지만, 실제 서비스 문제를 맡기기 시작하면 곧 한계가 드러난다.  
예를 들어 “주문 상태를 확인하고, 배송 지연이면 정책을 검색한 뒤 쿠폰을 발급해줘” 같은 요청은 단순 질의응답이 아니다. 입력을 이해해야 하고, 외부 정보를 찾아야 하며, 조건을 검증해야 하고, 때로는 이전 대화까지 기억해야 한다.

여기서 중요한 점은, **LLM의 성능만 높인다고 이 문제가 자동으로 해결되지는 않는다는 것**이다.  
실제로 필요한 것은 더 큰 모델이 아니라, **작업의 흐름을 상태로 관리하고, 필요한 순간에 도구를 실행하고, 잘못된 요청을 막아내며, 복잡한 일을 여러 단계나 여러 역할로 나누는 구조**다.

LangGraph는 바로 이 지점을 다룬다.  
이 라이브러리는 “LLM 호출을 몇 번 더 해보자” 수준이 아니라, **Agent를 그래프 형태의 워크플로우로 설계**하게 해준다. 그래서 이번 강의는 문법 자체보다도, **어떤 상황에서 어떤 패턴을 써야 하는가**를 이해하는 쪽이 더 중요하다.

이번 노트는 강의 자료와 실습, 과제 정답까지 한 흐름으로 엮어 정리했다.  
처음에는 LangGraph의 가장 작은 단위인 State와 Node를 이해하고, 그 다음 Tool과 Memory를 연결해 Agent를 만들고, 이어서 ReAct와 Guardrail로 실무형 구조를 설계한다. 그리고 마지막에는 Planner-Worker, Supervisor, Reflection, UI 연동까지 확장하면서 “단일 Agent를 넘어서는 구조적 사고”를 잡는 흐름으로 읽으면 가장 자연스럽다.

---

## 2. 핵심 개념 정리

이번 강의를 큰 줄기로 보면, 아래 여섯 단계로 이해할 수 있다.

### 2.1 가장 먼저: State는 노드들이 함께 쓰는 공유 변수다

LangGraph의 그래프는 노드만 있다고 움직이지 않는다.  
노드가 무엇을 입력받고 무엇을 돌려줄지, 그리고 그 결과가 다음 노드로 어떻게 이어질지를 정의해야 한다. 이때 중심이 되는 것이 `State`다.

쉽게 말하면, State는 **그래프 안을 흐르는 작업용 메모장**이다.  
각 노드는 이 메모장을 읽고, 일부를 갱신한 뒤, 다음 노드로 넘긴다. 그래서 LangGraph를 처음 배울 때는 “LLM을 어떻게 호출하느냐”보다 **State를 어떻게 설계하느냐**가 더 중요하다.

### 2.2 Agent는 LLM 하나가 아니라, Tool·Memory·Planning이 결합된 구조다

강의에서 반복해서 강조하는 관점은 명확하다.  
**AI Agent = LLM + Tool + Memory + Planning**

- LLM: 추론과 응답 생성
- Tool: 검색, 조회, 실행 같은 외부 행동
- Memory: 이전 대화와 맥락 유지
- Planning: 복잡한 요청을 순서 있는 작업으로 분해

이 네 요소가 붙기 전까지의 LLM은 “답변하는 모델”에 가깝고, 네 요소가 결합된 뒤부터는 “일을 처리하는 Agent”에 가까워진다.

### 2.3 Direct와 ReAct의 차이는 “한 번 실행하고 끝나는가, 다시 생각하는가”에 있다

처음에는 `agent -> tools -> 종료` 같은 Direct 패턴이 이해하기 쉽다.  
하지만 실전 요청은 한 번 도구를 쓴 뒤 끝나지 않는 경우가 많다. 도구 결과를 보고 다시 판단하고, 또 다른 도구를 써야 하는 일이 생긴다.

이때 필요한 것이 ReAct다.

- **Thought**: 지금 무엇을 해야 하는지 판단
- **Action**: 도구 호출
- **Observation**: 도구 결과를 받아 다시 생각

즉, ReAct는 단순 반복이 아니라 **도구 결과를 근거로 다시 추론하는 루프**다.

### 2.4 잘 동작하는 것과, 믿고 써도 되는 것은 다르다

Agent가 한 번쯤 그럴듯한 답을 낸다고 해서 신뢰할 수 있는 시스템이 되는 것은 아니다.  
특히 고객 서비스, 환불, 쿠폰 발급 같은 시나리오에서는 **정책 위반**, **과도한 행동**, **유해 요청 처리**, **민감 정보 노출** 같은 문제가 곧바로 실무 리스크로 이어진다.

그래서 강의의 중반 이후에는 기능 구현보다도 아래 계층이 중요해진다.

- 평가 함수
- 입력 가드레일
- 출력 가드레일
- 도구 내부 검증
- 안전한 실행 래퍼

이 흐름은 결국 **Trustworthiness를 별도 계층으로 설계해야 한다**는 메시지로 이어진다.

### 2.5 복잡한 작업은 한 Agent에게 몰아주기보다, 계획과 역할을 나누는 쪽이 낫다

보고서 작성, 여행 플래너, 시장 분석처럼 단계가 많고 조건이 많은 일은 단일 Agent가 한 번에 잘하기 어렵다.  
그래서 강의 후반은 자연스럽게 Multi-Agent 패턴으로 넘어간다.

- Planner-Worker: 계획 수립 후 실행
- Plan-and-Execute: 순차 단계 실행
- Supervisor / Fan-out / Fan-in: 역할을 병렬 또는 분산 처리
- Evaluator-Optimizer / Reflection: 결과를 평가하고 다시 개선

핵심은, **문제를 더 잘게 쪼개고 역할을 분리하면 결과 품질과 제어 가능성이 올라간다**는 점이다.

### 2.6 마지막은 서비스화다: Gradio 연동

좋은 그래프를 만들었다고 끝이 아니다.  
사용자가 쓸 수 있는 인터페이스가 붙어야 비로소 서비스가 된다. 강의는 마지막에 Gradio를 연결해, LangGraph Agent를 실제 대화형 UI로 옮기는 지점까지 보여준다.

즉, 이번 강의는 아래 흐름으로 정리하면 된다.

```text
State 설계
→ Tool / Memory / Planning 추가
→ Direct → ReAct로 확장
→ Guardrail / Safety / Evaluation 적용
→ Multi-Agent 패턴 도입
→ Gradio UI로 서비스화
```

---

## 3. 본문 정리

이제부터는 개념이 등장하는 자리에서 바로 예시와 코드를 붙여 정리한다.  
핵심은 “읽는 자리에서 이해가 끝나게” 하는 것이다.

### 3.1 State와 MessagesState: LangGraph의 가장 작은 시작점

LangGraph에서 가장 먼저 익혀야 하는 것은 `StateGraph`와 `State`의 관계다.  
노드는 독립된 함수처럼 보이지만, 실제로는 State를 읽고 일부를 반환하는 방식으로 연결된다.

가장 단순한 형태는 숫자나 문자열을 누적하는 예제다. 이런 예제는 쉬워 보여도, **“노드는 전체 State를 통째로 다시 만드는 것이 아니라, 바뀐 부분만 반환한다”**는 감각을 익히게 해준다.

```python
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

# 그래프 전체에서 공유할 상태를 정의한다.
class State(TypedDict):
    count: int

# 노드는 현재 상태를 읽고, 바뀐 값만 반환한다.
def add_one(state: State):
    return {"count": state["count"] + 1}

def add_two(state: State):
    return {"count": state["count"] + 2}

# 그래프 조립
graph = StateGraph(State)
graph.add_node("add_one", add_one)
graph.add_node("add_two", add_two)

graph.add_edge(START, "add_one")
graph.add_edge("add_one", "add_two")
graph.add_edge("add_two", END)

app = graph.compile()
result = app.invoke({"count": 0})
print(result)
```

여기서 중요한 점은, `State`가 단순한 자료형 정의를 넘어 **그래프의 계약서** 역할을 한다는 것이다.  
어떤 값이 흐르고, 어떤 값이 누적되고, 다음 노드가 무엇을 기대하는지가 모두 State에 녹아 있다.

대화형 Agent에서는 보통 문자열 하나가 아니라 메시지 목록이 필요하다. 이때 자주 등장하는 것이 `MessagesState` 또는 `Annotated[..., operator.add]` 방식이다.

```python
from typing_extensions import TypedDict, Annotated
import operator

from langchain.messages import AnyMessage, AIMessage
from langgraph.graph import StateGraph, START, END

class ChatState(TypedDict):
    # 메시지 리스트를 새로 덮어쓰는 것이 아니라, 뒤에 이어 붙이도록 지정한다.
    messages: Annotated[list[AnyMessage], operator.add]

def step1(state: ChatState):
    return {"messages": [AIMessage(content="안녕? ")]}

def step2(state: ChatState):
    return {"messages": [AIMessage(content="나는 ")]}

def step3(state: ChatState):
    return {"messages": [AIMessage(content="LangGraph를 배우는 중이야.")]}

graph = StateGraph(ChatState)
graph.add_node("step1", step1)
graph.add_node("step2", step2)
graph.add_node("step3", step3)

graph.add_edge(START, "step1")
graph.add_edge("step1", "step2")
graph.add_edge("step2", "step3")
graph.add_edge("step3", END)

app = graph.compile()
result = app.invoke({"messages": []})
print(result["messages"])
```

쉽게 말하면, `Annotated[list[AnyMessage], operator.add]`는  
“이 필드는 이전 메시지를 버리지 말고 계속 누적해 달라”는 선언이다.

⚠️ 주의  
메시지 상태를 설계할 때 가장 흔한 실수는, 리스트를 통째로 덮어써서 이전 대화가 사라지게 만드는 것이다.  
특히 멀티턴 대화나 ToolMessage를 써야 하는 Agent에서는 이 실수가 바로 문맥 손실로 이어진다.

📌 핵심  
State는 LangGraph의 뼈대이고, 메시지형 Agent에서는 **누적 규칙이 붙은 메시지 State 설계**가 가장 먼저 잡혀야 한다.

---

### 3.2 Tool: LLM이 “알기만 하는 모델”에서 “행동하는 모델”로 넘어가는 지점

LLM만 단독으로 두면, 실제 정책을 검색하거나 쿠폰을 발급할 수 없다.  
그럴듯하게 답할 수는 있어도, **현실 세계의 정보 조회나 시스템 동작은 직접 하지 못한다.**

그래서 강의 실습에서는 고객 서비스 AI를 예로 들며, 정책 검색과 주문 조회, 쿠폰 발급 도구를 붙인다.  
이 과정에서 가장 중요한 문법은 `@tool`과 `bind_tools`, 그리고 필요하다면 `ToolNode`다.

아래 코드는 강의의 핵심 구조를 가장 잘 보여주는 최소 예시다.

```python
from langchain_core.tools import tool

@tool
def search_policy(query: str) -> str:
    """고객 서비스 정책을 검색합니다."""
    documents = retriever.invoke(query)

    # 검색 결과 문서를 하나의 문자열로 묶어 반환한다.
    return "\n".join([doc.page_content for doc in documents])

# 도구를 리스트로 등록한다.
tools = [search_policy]

# LLM에게 '이런 도구를 쓸 수 있다'는 사실을 알려준다.
llm_with_tools = llm.bind_tools(tools)

# 이 시점의 LLM은 도구 호출을 '결정'할 수 있다.
# 단, 실제 도구 실행까지 스스로 하지는 못한다.
response = llm_with_tools.invoke("환불 정책이 뭐야?")

print(response.tool_calls)
```

여기서 헷갈리기 쉬운 지점은 `bind_tools()`의 의미다.  
이 함수는 “도구를 직접 실행한다”가 아니라, **LLM이 도구를 호출해야 할 상황을 판단할 수 있게 만든다**는 뜻이다.

그래서 실제 실행 단계가 한 번 더 필요하다. 그때 등장하는 것이 `ToolNode` 또는 직접 작성한 도구 실행 노드다.

```python
from langgraph.prebuilt import ToolNode

# 등록된 도구를 실제로 실행하는 노드
tool_node = ToolNode(tools)

print([tool.name for tool in tools])
```

강의의 고객 서비스 실습에서는 정책 문서 자체도 도구와 연결되는 정보원으로 준비한다.  
예를 들어 실습용 정책 파일에는 다음과 같은 내용이 들어 있다.

```text
보상 정책:
- 배송 지연 시 최대 10,000원 쿠폰 발급 가능
- 상품 불량 시 최대 20,000원 쿠폰 발급 가능
- 단순 변심은 쿠폰 발급 불가

배송 정책:
- 배송 지연은 예상 배송일 초과 상태
```

이 정책을 벡터 저장소에 넣고 검색 도구로 연결하면, Agent는 “알아서 아는 척”하지 않고 **필요한 순간 정책을 조회한 뒤 응답**하게 된다.

```python
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import CharacterTextSplitter
from langchain_community.vectorstores import Chroma

# 정책 문서를 불러와서 분할한 뒤 벡터스토어에 저장한다.
loaders = [
    TextLoader("reward_policy.txt", encoding="utf-8"),
    TextLoader("shipping_policy.txt", encoding="utf-8"),
]

docs = []
for loader in loaders:
    docs.extend(loader.load())

splitter = CharacterTextSplitter(chunk_size=300, chunk_overlap=50)
split_docs = splitter.split_documents(docs)

vectorstore = Chroma.from_documents(split_docs, embedding=embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 2})

def search_policy(query: str) -> str:
    """정책 문서를 검색하여 관련 내용을 반환합니다."""
    docs = retriever.invoke(query)
    return "\n\n".join(doc.page_content for doc in docs)
```

💡 포인트  
강의에서도 비교하듯, 모든 질문마다 무조건 검색하는 구조보다 **필요할 때만 Tool로 검색하는 방식**이 더 자연스럽고 비용도 덜 든다.

⚠️ 주의  
도구 설명(docstring)이 빈약하면 LLM이 언제 어떤 도구를 써야 하는지 잘 판단하지 못한다.  
즉, Tool의 성능은 함수 구현뿐 아니라 **이름과 설명 설계**에도 달려 있다.

📌 핵심  
Tool은 “LLM에게 팔을 달아주는 것”에 가깝다. 단, `bind_tools()`는 실행이 아니라 **도구 호출 판단 능력**을 주는 단계라는 점을 반드시 구분해야 한다.

---

### 3.3 Memory: 멀티턴 대화에서 맥락을 잃지 않게 만드는 장치

기본 Agent는 호출마다 독립적으로 실행된다.  
그래서 사용자가 “내 주문번호는 ORD001이야”라고 말한 뒤, 다음 턴에 “아까 말한 주문번호가 뭐였지?”라고 묻더라도 기억하지 못하는 것이 자연스럽다.

이 한계를 해결하는 것이 `MemorySaver` 또는 `InMemorySaver` 같은 체크포인터다.

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

memory = MemorySaver()

agent_with_memory = create_react_agent(
    model=llm,
    tools=tools,
    checkpointer=memory
)

config = {"configurable": {"thread_id": "user123"}}

# 첫 번째 대화
response1 = agent_with_memory.invoke(
    {"messages": [("user", "내 주문번호는 ORD001이야.")]},
    config=config
)

# 두 번째 대화 — 같은 thread_id를 주면 이전 맥락을 이어받는다.
response2 = agent_with_memory.invoke(
    {"messages": [("user", "아까 말한 주문번호가 뭐였지?")]},
    config=config
)

print(response1["messages"][-1].content)
print(response2["messages"][-1].content)
```

여기서 핵심은 `thread_id`다.  
쉽게 말하면 이 값은 “이 대화가 누구의 어떤 세션인지”를 구분하는 열쇠다. 같은 `thread_id`를 써야 같은 대화 흐름으로 이어진다.

강의의 기본 예제도 같은 구조를 보여준다.

```python
from typing_extensions import TypedDict, Annotated
import operator

from langchain.messages import AnyMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver

class State(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]

def chat_node(state: State):
    return {"messages": [llm.invoke(state["messages"])]}

graph = StateGraph(State)
graph.add_node("chat", chat_node)
graph.add_edge(START, "chat")
graph.add_edge("chat", END)

# 메모리 없는 그래프도 가능하지만, 체크포인터를 넣으면 멀티턴 대화가 된다.
checkpointer = InMemorySaver()
agent = graph.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "user1"}}

agent.invoke(
    {"messages": [HumanMessage(content="내 이름은 KFC 탐정이야. 기억해둬.")]},
    config=config
)

result = agent.invoke(
    {"messages": [HumanMessage(content="아까 내 이름이 뭐였지?")]},
    config=config
)

print(result["messages"][-1].content)
```

왜 필요한지 감이 잘 안 올 수 있는데, 멀티턴 대화에서는 **현재 입력만 보고는 풀 수 없는 문제**가 많다.  
주문번호, 이전 합의, 직전 작업 결과, 사용자 취향 같은 정보가 빠지면 Agent는 매번 처음부터 다시 물어보게 된다.

⚠️ 주의  
메모리가 있다고 해서 무조건 좋은 것은 아니다.  
세션 구분을 제대로 안 하면 다른 대화가 섞일 수 있고, 너무 긴 이력을 그대로 쌓으면 비용과 응답 품질이 나빠질 수 있다. 실서비스에서는 요약 메모리나 DB 기반 저장을 함께 고려해야 한다.

📌 핵심  
Memory는 “똑똑한 기억력”이 아니라, **대화 세션을 상태로 이어주는 장치**다. 멀티턴 Agent는 사실상 이 기능이 없으면 완성되기 어렵다.

---

### 3.4 Planning과 create_react_agent: 복잡한 요청을 순서 있게 다루는 시작점

사용자 요청이 간단할 때는 Tool 몇 개만 붙여도 된다.  
하지만 “주문 여러 건을 확인하고, 배송 지연인 것만 골라 쿠폰을 발급해줘” 같은 요청은 작업 순서가 중요하다.

강의 실습에서는 이때 `create_react_agent()`가 주는 장점을 강조한다.  
이 함수는 Tool 사용과 ReAct 흐름을 내장한 프리빌트 Agent를 빠르게 만들 수 있게 해준다.

```python
from langgraph.prebuilt import create_react_agent

system_prompt = """
당신은 고객 서비스 AI 에이전트입니다.
고객의 요청을 처리하기 위해 제공된 도구를 사용하세요.
"""

agent_executor = create_react_agent(
    model=llm,
    tools=tools,
    prompt=system_prompt
)

response = agent_executor.invoke({
    "messages": [{
        "role": "user",
        "content": "주문 ORD001의 상태를 확인하고, 배송 지연이면 5000원 쿠폰을 발급해줘."
    }]
})

print(response["messages"][-1].content)
```

이 구조가 편리한 이유는, 복잡한 요청을 받았을 때 Agent가 대략 아래와 같은 흐름으로 움직이기 때문이다.

1. 먼저 어떤 정보가 필요한지 생각한다.
2. 필요한 Tool을 고른다.
3. Tool 결과를 확인한다.
4. 조건에 맞으면 다음 행동을 결정한다.
5. 최종 답을 구성한다.

강의 실습에서는 여기에 Memory까지 더해, 여러 주문을 다루는 요청을 처리하게 만든다.

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

memory_plan = MemorySaver()

agent_with_plan = create_react_agent(
    model=llm,
    tools=tools,
    checkpointer=memory_plan,
    prompt="당신은 정책을 준수하며 단계적으로 판단하는 고객 서비스 AI입니다."
)

config = {"configurable": {"thread_id": "user456"}}

response = agent_with_plan.invoke(
    {"messages": [{
        "role": "user",
        "content": "주문 ORD001, ORD002, ORD003의 상태를 확인하고 배송 지연인 주문에만 쿠폰 5000원을 발급해줘."
    }]},
    config=config
)

print(response["messages"][-1].content)
```

여기서 중요한 점은, Planning이 꼭 별도 Planner 노드여야만 하는 것은 아니라는 것이다.  
강의 초반의 Planning은 **“단계를 세우며 처리하도록 Agent를 유도하는 것”**에 가깝고, 후반 Multi-Agent에서는 이것이 명시적 Planner 노드로 발전한다.

💡 포인트  
프리빌트 Agent는 빠르게 시작하기 좋다. 하지만 동작을 아주 세밀하게 통제하고 싶다면, 결국 직접 `StateGraph`를 짜는 단계로 넘어가야 한다.

⚠️ 주의  
프롬프트에 “도구를 사용하라”만 적는다고 항상 올바른 순서로 행동하지는 않는다.  
복잡한 요청일수록 상태 설계, 도구 설명, 메모리, 검증 로직까지 함께 붙어야 안정된다.

📌 핵심  
Planning은 “길게 생각하는 능력”이 아니라, **작업을 순서 있는 구조로 다루게 하는 설계 요소**다. `create_react_agent()`는 그 출발점을 빠르게 마련해 준다.

---

### 3.5 Direct Pattern vs ReAct Pattern: 왜 다시 Agent로 돌아와야 하는가

강의에서 정말 중요한 비교가 하나 있다.  
바로 Direct 패턴과 ReAct 패턴의 차이다.

처음 보면 Direct 패턴도 충분해 보인다.

```python
def should_continue(state):
    """마지막 메시지에 tool_calls가 있으면 tools, 없으면 종료"""
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END

graph = StateGraph(MessagesState)
graph.add_node("agent", call_model)
graph.add_node("tools", tool_node)

graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue)
graph.add_edge("tools", END)  # 도구 실행 후 바로 종료
```

이 구조는 “질문 → 도구 실행 → 끝”인 문제에는 잘 맞는다.  
예를 들어 단순 정책 조회처럼, 도구 결과를 그대로 보여주면 되는 경우에는 이 방식이 충분하다.

하지만 실전에서는 도구 결과가 나온 뒤 다시 판단해야 하는 일이 많다.  
예를 들어 “3일 전에 산 상품 환불 가능해?”라는 질문은 단순 정책 조회로 끝나지 않는다.

- 몇 일 전인지 해석해야 하고
- 배송 상태나 환불 조건을 확인해야 하며
- 조회 결과를 다시 읽고 최종 결론을 내려야 한다

이런 문제에서는 ReAct가 필요하다.

```python
graph = StateGraph(MessagesState)
graph.add_node("agent", call_model)
graph.add_node("tools", tool_node)

graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue)
graph.add_edge("tools", "agent")  # 도구 실행 후 다시 agent로 복귀
```

이 한 줄 차이가 크다.  
Direct는 도구 결과를 내놓고 끝나지만, ReAct는 **도구 결과를 Observation으로 받아 다시 Thought를 수행**한다.

강의의 기본 예제도 같은 구조를 더 직접적으로 보여준다.

```python
from langchain.tools import tool
from langchain.messages import HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph, START, END, MessagesState
from typing_extensions import Literal

@tool
def googling_search(query: str) -> str:
    """인터넷 검색을 수행하는 함수"""
    return f"{query} 검색 결과입니다."

@tool
def kfc_recipe_search(query: str) -> str:
    """사내 레시피 검색 함수"""
    return f"{query}에 대한 KFC 레시피 결과입니다."

tools = [googling_search, kfc_recipe_search]
tools_by_name = {tool.name: tool for tool in tools}
llm_with_tools = llm.bind_tools(tools)

def llm_call(state: MessagesState):
    return {
        "messages": [
            llm_with_tools.invoke(
                [SystemMessage(content="필요한 경우 도구를 사용하세요.")] + state["messages"]
            )
        ]
    }

def tool_node(state: MessagesState):
    observations = []

    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        observation = tool.invoke(tool_call["args"])

        # Tool 실행 결과를 ToolMessage로 감싸서 다시 메시지 흐름에 넣는다.
        observations.append(
            ToolMessage(content=observation, tool_call_id=tool_call["id"])
        )

    return {"messages": observations}

def should_continue(state: MessagesState) -> Literal["tool_node", END]:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tool_node"
    return END

agent_builder = StateGraph(MessagesState)
agent_builder.add_node("llm_call", llm_call)
agent_builder.add_node("tool_node", tool_node)

agent_builder.add_edge(START, "llm_call")
agent_builder.add_conditional_edges("llm_call", should_continue, ["tool_node", END])
agent_builder.add_edge("tool_node", "llm_call")  # ReAct의 핵심 루프

agent = agent_builder.compile()
```

쉽게 말하면, ReAct의 핵심은 “도구를 썼다”가 아니라 **도구 결과를 다시 생각의 재료로 쓴다**는 데 있다.

⚠️ 주의  
ReAct 루프를 만들었는데 종료 조건이 약하면 무한 반복이 날 수 있다.  
그래서 강의 후반의 Reflection 패턴에서도 반복 횟수 제한 같은 장치가 함께 등장한다.

📌 핵심  
Direct는 “한 번 실행하고 끝나는 흐름”, ReAct는 “도구 결과를 보고 다시 판단하는 흐름”이다. 실전 Agent의 핵심은 대부분 ReAct 쪽에 가깝다.

---

### 3.6 고객 서비스 AI 실습: Tool + RAG + 주문 처리 로직이 실제로 만나는 지점

이번 강의의 실습은 추상적인 예제에서 끝나지 않고, 고객 서비스 시나리오로 이어진다.  
이 부분이 중요한 이유는, “그래프 패턴”이 실제 문제에 어떻게 적용되는지를 한 번에 보여주기 때문이다.

실습용 주문 데이터는 대략 아래처럼 구성된다.

```python
orders_db = {
    "ORD001": {"status": "배송 지연", "product": "노트북", "customer": "홍길동"},
    "ORD002": {"status": "배송 완료", "product": "키보드", "customer": "김철수"},
    "ORD003": {"status": "배송 중", "product": "마우스", "customer": "이영희"},
}

issued_coupons = {}
```

그리고 도구는 보통 세 종류가 붙는다.

1. 정책 검색 도구
2. 주문 상태 조회 도구
3. 쿠폰 발급 도구

```python
from langchain_core.tools import tool

@tool
def search_policy_tool(query: str) -> str:
    """고객 서비스 정책(보상, 배송)을 검색합니다. 쿠폰 발급 조건, 한도 등을 확인할 때 사용합니다."""
    return search_policy(query)

@tool
def get_order_status_tool(order_id: str) -> str:
    """주문 상태를 조회합니다."""
    order = orders_db.get(order_id)
    if not order:
        return f"주문 {order_id}를 찾을 수 없습니다."
    return f"주문 {order_id}: 상태={order['status']}, 상품={order['product']}, 고객={order['customer']}"

@tool
def issue_coupon_tool(order_id: str, amount: int) -> str:
    """주문에 쿠폰을 발급합니다."""
    issued_coupons[order_id] = amount
    return f"주문 {order_id}에 {amount:,}원 쿠폰 발급 완료"
```

이 예제가 좋은 이유는, 단순 Tool 데모가 아니라 **여러 도구가 정책 조건을 사이에 두고 연결**되기 때문이다.

예를 들어 사용자의 요청이 아래와 같다고 해보자.

> “주문 ORD001의 상태를 확인하고, 배송 지연이면 5000원 쿠폰을 발급해줘.”

그러면 올바른 흐름은 대략 이렇다.

```text
주문 상태 조회
→ 배송 지연 여부 확인
→ 필요 시 정책 검색
→ 조건 만족 여부 판단
→ 쿠폰 발급
→ 결과 응답
```

이 흐름을 LLM이 한 번에 완벽하게 알아서 처리해 줄 것이라고 기대하면, 종종 정책을 무시하거나 잘못된 순서로 행동한다.  
그래서 강의에서는 ReAct, Planning, 그리고 나중의 Trustworthiness까지 순서대로 붙여 나간다.

💡 포인트  
실습 예제의 본질은 “고객 서비스” 자체보다, **조회와 실행이 섞인 작업을 Agent로 안전하게 처리하는 법**을 배우는 데 있다.

⚠️ 주의  
도구가 동작한다고 끝이 아니다. 특히 `issue_coupon_tool` 같은 실행형 도구는 잘못 쓰이면 곧바로 정책 위반이 된다. 그래서 다음 절의 안전한 도구 패턴이 중요해진다.

📌 핵심  
실습은 LangGraph 문법 연습이 아니라, **RAG 조회 + 조건 판단 + 시스템 실행이 섞인 실제 Agent 문제**를 구조적으로 풀어보는 과정이다.

---

### 3.7 Trustworthiness 1: 평가 함수와 테스트 케이스로 “잘했는지” 먼저 확인하기

Agent는 한 번 시연이 성공했다고 해서 검증된 것이 아니다.  
그래서 강의에서는 테스트 케이스를 돌리고, 응답에서 환불 승인/거부 상태를 추출해 정량적으로 평가하는 흐름을 넣는다.

아래 함수는 그 핵심 아이디어를 잘 보여준다.

```python
import re

def extract_refund_statuses(response: str) -> list:
    """응답에서 환불 상태를 추출"""
    statuses = []

    # '환불 승인' 계열 표현이 있으면 approved 추가
    if re.search(r"환불.*승인|승인.*환불", response):
        statuses.append("approved")

    # '환불 거부/불가' 계열 표현이 있으면 denied 추가
    if re.search(r"환불.*거부|거부.*환불|환불.*불가", response):
        statuses.append("denied")

    return statuses
```

이 함수는 아주 단순해 보이지만, 강의가 말하려는 핵심은 분명하다.  
**평가 기준을 먼저 세워야 Agent 품질을 관리할 수 있다.**

그 다음에는 테스트 케이스를 여러 개 준비해 평가한다.

```python
def evaluate_agent(agent, test_cases):
    """Agent 정확도 평가"""
    correct = 0
    total = len(test_cases)

    for case in test_cases:
        result = agent.invoke({
            "messages": [("user", case["input"])]
        })

        output = result["messages"][-1].content
        predicted = extract_refund_statuses(output)

        if predicted == case["expected"]:
            correct += 1

    return {"accuracy": correct / total, "correct": correct, "total": total}

test_cases = [
    {"input": "7일 전에 산 상품 환불하고 싶어요", "expected": ["approved"]},
    {"input": "10일 전에 산 상품 환불하고 싶어요", "expected": ["denied"]},
]
```

왜 중요한지 다시 보면, Agent 시스템은 프롬프트만 보고 평가하기 어렵다.  
겉보기 응답이 그럴듯해도 정책을 어겼을 수 있고, 도구 순서가 잘못되었을 수 있고, 실행은 했지만 요구사항을 절반만 만족했을 수도 있다.

그래서 강의 과제에서는 아예 **도구 호출 로그를 뽑아 순서까지 평가**하는 흐름으로 확장한다.  
이 지점에서 “Agent를 만든다”와 “Agent를 운영한다”는 전혀 다른 문제라는 사실이 드러난다.

⚠️ 주의  
정규식 기반 평가는 빠르게 시작하기 좋지만, 표현이 다양해지면 놓치는 경우가 많다. 실전에서는 구조화 출력, 별도 evaluator LLM, 또는 rule-based checker를 함께 쓰는 것이 더 안정적이다.

📌 핵심  
Trustworthiness의 출발점은 가드레일보다 먼저, **평가 기준과 테스트 케이스를 갖는 것**이다.

---

### 3.8 Trustworthiness 2: Safety Tool과 Guardrail로 실행 자체를 안전하게 만들기

실행형 도구는 편리하지만, 가장 위험하기도 하다.  
특히 쿠폰 발급, 환불 처리, 시스템 수정처럼 실제 액션이 발생하는 함수는 LLM에게 완전히 맡기면 안 된다.

강의에서 제시한 가장 중요한 원칙은 이것이다.

> **“도구 내부에 정책 검증을 넣어라.”**

즉, Agent가 잘못된 판단을 하더라도 마지막 실행 단계에서 한 번 더 막아야 한다.

```python
MAX_COUPON_AMOUNT = 20000

orders_db = {
    "ORD001": {"status": "배송 지연", "product": "노트북"},
    "ORD002": {"status": "배송 완료", "product": "키보드"},
}

def issue_coupon_safe(order_id: str, amount: int) -> str:
    """검증 로직이 포함된 안전한 쿠폰 발급"""

    # 1. 금액 검증
    if amount > MAX_COUPON_AMOUNT:
        return f"❌ 발급 불가: 정책상 최대 {MAX_COUPON_AMOUNT:,}원까지 가능합니다. (요청: {amount:,}원)"

    # 2. 주문 존재 여부 검증
    if order_id not in orders_db:
        return f"❌ 발급 불가: 주문 {order_id}을 찾을 수 없습니다."

    # 3. 주문 상태 검증
    status = orders_db[order_id]["status"]
    if status != "배송 지연":
        return f"❌ 발급 불가: 현재 '{status}' 상태입니다. 배송 지연 시에만 쿠폰 발급이 가능합니다."

    # 4. 모든 조건을 통과했을 때만 실제 실행
    return f"✅ 주문 {order_id}에 {amount:,}원 쿠폰 발급 완료 (정책 준수 확인됨)"
```

이 코드는 아주 실무적이다.  
정책 판단을 프롬프트에만 맡기지 않고, **실행 직전에 코드 레벨에서 다시 검증**한다. 이게 Safety Tool 패턴의 핵심이다.

그 위에 입력/출력 가드레일까지 얹으면 더 강한 방어선이 생긴다.

```python
BLOCKED_KEYWORDS = ["해킹", "비밀번호", "탈취", "시스템 접근"]

def is_harmful_input(user_input: str) -> bool:
    """유해 요청 여부 검사"""
    for keyword in BLOCKED_KEYWORDS:
        if keyword in user_input:
            return True
    return False

SENSITIVE_PATTERNS = ["주민등록번호", "계좌번호", "카드번호"]

def filter_output(output: str) -> str:
    """출력에서 민감 정보를 필터링"""
    filtered = output
    for pattern in SENSITIVE_PATTERNS:
        filtered = filtered.replace(pattern, "[민감정보 필터링됨]")
    return filtered
```

그리고 최종적으로 Agent 실행을 감싸는 래퍼를 둔다.

```python
class TrustedAgentExecutor:
    """Trustworthiness 계층을 적용한 Agent 실행기"""

    def __init__(self, agent):
        self.agent = agent

    def run(self, user_input: str, config=None) -> str:
        # 1. 입력 가드레일
        if is_harmful_input(user_input):
            return "❌ 해당 요청은 처리할 수 없습니다."

        # 2. Agent 실행
        try:
            result = self.agent.invoke(
                {"messages": [("user", user_input)]},
                config=config
            )
            output = result["messages"][-1].content
        except Exception as e:
            return f"❌ 처리 중 오류가 발생했습니다: {str(e)}"

        # 3. 출력 가드레일
        return filter_output(output)
```

쉽게 말하면 이 구조는 아래처럼 이해하면 된다.

```text
사용자 입력
→ 입력 가드레일
→ Agent 추론 및 도구 호출
→ 도구 내부 검증
→ 출력 가드레일
→ 사용자 응답
```

강의의 메시지는 분명하다.  
**좋은 Agent는 영리한 Agent가 아니라, 통제 가능한 Agent다.**

⚠️ 주의  
입력 가드레일만 있다고 안전해지지 않는다.  
실행형 도구가 안전하지 않으면 내부에서 정책 위반 액션이 일어날 수 있고, 출력 가드레일이 없으면 민감 정보가 그대로 노출될 수 있다.

📌 핵심  
Trustworthiness는 프롬프트 한 줄로 해결되지 않는다.  
**입력 차단, 도구 내부 검증, 출력 필터링, 예외 처리**가 층층이 쌓여야 한다.

---

### 3.9 Planner-Worker와 Orchestrator-Worker: 복잡한 작업을 역할로 나누는 이유

단일 Agent는 간단한 요청에는 충분하지만, 작업이 길고 기준이 많아질수록 흔들리기 쉽다.  
그래서 강의 후반은 “계획 수립 역할”과 “실행 역할”을 분리하는 구조로 넘어간다.

가장 기본적인 Planner-Worker 패턴은 아래처럼 시작한다.

```python
from typing import TypedDict, List, Annotated
import operator

class AgentState(TypedDict):
    task: str
    plan: str
    results: Annotated[List[str], operator.add]
    reflection: str
    final_answer: str
```

여기서 `results`에 `operator.add`를 붙인 이유는, Worker가 낸 결과를 하나씩 누적해 가기 위해서다.

Planner, Worker, Reflection 노드는 각각 역할이 명확하다.

```python
def planner(state: AgentState) -> AgentState:
    """작업을 분석해 실행 계획을 만든다."""
    prompt = f"다음 작업의 실행 계획을 세워주세요: {state['task']}"
    plan = llm.invoke(prompt).content
    return {"plan": plan}

def worker(state: AgentState) -> AgentState:
    """계획에 따라 실제 작업을 수행한다."""
    prompt = f"계획: {state['plan']}\n실행하세요."
    result = llm.invoke(prompt).content
    return {"results": [result]}

def reflection(state: AgentState) -> AgentState:
    """현재 결과를 평가하고 개선 필요성을 판단한다."""
    prompt = f"결과: {state['results']}\n품질을 평가하세요."
    review = llm.invoke(prompt).content
    return {"reflection": review}
```

그리고 Reflection 결과에 따라 다시 Planner로 돌아가거나 종료한다.

```python
def evaluate(state: AgentState) -> str:
    """개선 필요 여부 판단"""
    if "개선" in state["reflection"]:
        return "planner"
    return "end"

graph = StateGraph(AgentState)
graph.add_node("planner", planner)
graph.add_node("worker", worker)
graph.add_node("reflection", reflection)

graph.add_edge(START, "planner")
graph.add_edge("planner", "worker")
graph.add_edge("worker", "reflection")
graph.add_conditional_edges("reflection", evaluate, {
    "planner": "planner",
    "end": END
})
```

이 구조를 쉽게 풀어 말하면 이렇다.

- Planner는 “어떻게 할지”를 정한다.
- Worker는 “실제로 한다.”
- Reflection은 “이대로 괜찮은지”를 본다.

강의의 응용 노트에서는 이 패턴이 두 가지 방향으로 확장된다.

#### (1) 병렬 Orchestrator-Worker

하나의 기획자가 여러 워커에게 챕터별 작업을 나눠 주는 구조다.

```python
from pydantic import BaseModel, Field
from langgraph.types import Send
from typing_extensions import NotRequired

class Chapter(BaseModel):
    name: str = Field(description="챕터 제목")
    description: str = Field(description="집필 가이드")

class BookPlan(BaseModel):
    chapters: List[Chapter]

class State(TypedDict):
    topic: str
    chapters: NotRequired[List[Chapter]]
    completed_chapters: NotRequired[Annotated[list[tuple[int, str]], operator.add]]
    final_report: NotRequired[str]

class WorkerState(TypedDict):
    index: int
    chapter: Chapter
    completed_chapters: Annotated[list[tuple[int, str]], operator.add]

def orchestrator(state: State):
    result = llm_planner.invoke([
        SystemMessage(content="주어진 주제로 2~5개 챕터 목차를 설계하라."),
        HumanMessage(content=state["topic"])
    ])
    return {"chapters": result.chapters, "completed_chapters": []}

def assign_workers(state: State):
    # 각 챕터를 개별 worker에게 보낸다.
    return [Send("worker", {"index": i, "chapter": c}) for i, c in enumerate(state["chapters"])]

def worker(state: WorkerState):
    idx = state["index"]
    ch = state["chapter"]

    result = llm.invoke([
        SystemMessage(content="제공된 챕터 정보를 바탕으로 내용을 3줄로 작성하라."),
        HumanMessage(content=f"제목: {ch.name}\n가이드: {ch.description}")
    ])

    return {"completed_chapters": [(idx, result.content)]}
```

이 구조의 핵심은 `Send`와 `Fan-out / Fan-in`이다.  
즉, 한 노드가 여러 Worker를 분산 호출하고, 완료된 결과를 다시 합친다.

#### (2) 순차 Plan-and-Execute

순서가 중요한 작업은 병렬보다 직렬이 맞다.  
강의의 요리 예제는 이 점을 잘 보여준다.

```python
class Step(BaseModel):
    title: str
    instruction: str

class Plan(BaseModel):
    steps: List[Step]

class State(TypedDict):
    topic: str
    steps: NotRequired[List[Step]]
    current_idx: NotRequired[int]
    context: NotRequired[str]

def planner(state: State):
    result = planner_llm.invoke([
        SystemMessage(content="순서가 중요한 2~5단계 계획을 세워라."),
        HumanMessage(content=state["topic"])
    ])

    return {
        "steps": result.steps,
        "current_idx": 0,
        "context": "--- [작업 시작] ---"
    }

def execute_step(state: State):
    curr_idx = state["current_idx"]
    step_info = state["steps"][curr_idx]

    response = llm.invoke([
        SystemMessage(content="이전 과정까지 반영하여 현재 단계를 완성하라."),
        HumanMessage(content=f"""
[지금까지 진행 상황]
{state['context']}

[이번 단계]
단계명: {step_info.title}
지침: {step_info.instruction}
""")
    ])

    step_result = f"\n\n### {curr_idx + 1}. {step_info.title}\n{response.content}"

    return {
        "context": state["context"] + step_result,
        "current_idx": curr_idx + 1
    }

def should_continue(state: State):
    if state["current_idx"] < len(state["steps"]):
        return "execute_step"
    return END
```

왜 필요한지 생각해 보면, 조리·보고서·분석처럼 앞 단계 결과가 뒤 단계를 바꾸는 문제는 병렬화보다 **순차적 컨텍스트 누적**이 훨씬 중요하다.

⚠️ 주의  
Planner-Worker 패턴에서 자주 하는 실수는, Planner가 너무 추상적인 계획을 만들거나 Worker가 계획을 무시하는 것이다. 계획은 “있기만 한 문장”이 아니라, 다음 노드가 실제로 사용할 수 있는 작업 지침이어야 한다.

📌 핵심  
복잡한 작업에서 중요한 것은 LLM 호출 횟수가 아니라, **계획과 실행의 역할을 분리해 제어 가능성을 높이는 것**이다.

---

### 3.10 Supervisor와 Fan-out / Fan-in: 여러 Worker를 한 번에 굴리는 구조

강의의 Reflection 패턴 노트에서는 단일 Agent의 한계를 먼저 체감하게 한 뒤, Supervisor 구조로 넘어간다.  
이 흐름이 중요한 이유는 “왜 여러 Agent가 필요한가”를 개념이 아니라 경험으로 이해하게 해 주기 때문이다.

Supervisor 패턴의 기본 상태는 이렇게 생긴다.

```python
from typing import TypedDict, List, Annotated
import operator

class SupervisorState(TypedDict):
    task: str
    worker_results: Annotated[List[str], operator.add]
    next_action: str
    final_output: str
```

`worker_results`가 리스트 누적 필드라는 점이 핵심이다.  
즉, 여러 Worker의 결과가 하나의 버스처럼 모이는 구조다.

Supervisor와 Worker는 보통 아래처럼 구성된다.

```python
def supervisor(state: SupervisorState) -> SupervisorState:
    """결과가 아직 없으면 분배, 있으면 종합 단계로 이동"""
    if not state.get("worker_results"):
        return {"next_action": "distribute"}
    else:
        return {"next_action": "synthesize"}

def worker_research(state: SupervisorState) -> SupervisorState:
    """조사 담당 Worker"""
    result = llm.invoke(f"조사: {state['task']}").content
    return {"worker_results": [f"[조사] {result[:50]}..."]}

def worker_analysis(state: SupervisorState) -> SupervisorState:
    """분석 담당 Worker"""
    result = llm.invoke(f"분석: {state['task']}").content
    return {"worker_results": [f"[분석] {result[:50]}..."]}

def synthesize(state: SupervisorState) -> SupervisorState:
    """분산된 결과를 하나의 최종 출력으로 통합"""
    combined = "\n".join(state["worker_results"])
    final = llm.invoke(f"종합하세요:\n{combined}").content
    return {"final_output": final}
```

그래프 구조는 다음과 같다.

```python
def route_supervisor(state: SupervisorState) -> str:
    return state["next_action"]

graph = StateGraph(SupervisorState)
graph.add_node("supervisor", supervisor)
graph.add_node("research", worker_research)
graph.add_node("analysis", worker_analysis)
graph.add_node("synthesize", synthesize)

graph.add_edge(START, "supervisor")
graph.add_conditional_edges("supervisor", route_supervisor, {
    "distribute": "research",
    "synthesize": "synthesize"
})
graph.add_edge("research", "analysis")
graph.add_edge("analysis", "supervisor")
graph.add_edge("synthesize", END)
```

이 코드는 단순화된 예시지만, 강의가 말하고 싶은 핵심은 명확하다.

- Supervisor는 직접 실무를 하기보다 **흐름을 조정**한다.
- Worker는 각각의 역할에 집중한다.
- 최종 응답은 분산된 결과를 다시 합친 뒤 만든다.

이 패턴은 여행 플래너 과제 정답에서도 더 실용적으로 확장된다.  
예를 들어 한 Worker는 일정과 관광지를 맡고, 다른 Worker는 예산과 맛집 추천을 맡는다. 그 뒤 Supervisor가 둘의 결과를 통합한다.

```python
class SupervisorState(TypedDict):
    user_request: str
    schedule_results: Annotated[List[str], operator.add]
    budget_results: Annotated[List[str], operator.add]
    final_output: str
```

쉽게 말하면, 이 패턴은 “한 사람에게 모든 걸 시키는 대신, 역할을 나눠 동시에 일하게 한 뒤 관리자가 정리하는 구조”다.

⚠️ 주의  
병렬 Worker를 쓸 때는 결과 순서나 누락 문제에 주의해야 한다. 그래서 강의의 Orchestrator 예제에서는 `(index, content)` 형태로 저장한 뒤 정렬하는 방식까지 보여 준다.

📌 핵심  
Supervisor 패턴은 단순히 Agent 수를 늘리는 것이 아니라, **역할 분리와 통합 책임을 명확히 만드는 설계**다.

---

### 3.11 Reflection / Evaluator-Optimizer: 한 번 낸 답을 다시 검토해 개선하는 루프

강의의 후반부에서 가장 실무적인 메시지 중 하나는 이것이다.

> LLM의 첫 답이 최종 답이라고 가정하지 마라.

Reflection 또는 Evaluator-Optimizer 패턴은 이 생각에서 출발한다.  
생성기(Optimizer)가 초안을 만들고, 평가기(Evaluator)가 품질을 보고, 부족하면 다시 생성하게 한다.

강의의 농담 예제는 가볍지만 구조는 매우 중요하다.

```python
from pydantic import BaseModel, Field
from typing import Literal
from typing_extensions import NotRequired

class State(TypedDict):
    topic: str
    joke: NotRequired[str]
    feedback: NotRequired[str]
    funny_or_not: NotRequired[str]

class Feedback(BaseModel):
    grade: Literal["funny", "not funny"] = Field(
        description="농담이 재미있는지 판별한다."
    )
    feedback: str = Field(
        description="재미없다면 어떻게 고치면 좋을지 피드백을 제공한다."
    )

llm_evaluator = llm.with_structured_output(Feedback)
```

생성기와 평가기는 이렇게 나뉜다.

```python
def llm_call_generator(state: State):
    prompt = f"{state['topic']}에 관련된 웃긴 농담 1개만 해줘 (3줄 이내)\n"

    # 이전 평가 피드백이 있으면 다음 시도에 반영한다.
    if state.get("feedback"):
        prompt += f"이전 피드백을 반영해줘: {state['feedback']}"

    result = llm.invoke(prompt)
    return {"joke": result.content}

def llm_call_evaluator(state: State):
    grade = llm_evaluator.invoke(
        f"다음 농담이 재미있는지 판별해줘: {state['joke']}"
    )
    return {"funny_or_not": grade.grade, "feedback": grade.feedback}
```

분기는 단순하지만 강력하다.

```python
def route_joke(state: State):
    if state["funny_or_not"] == "funny":
        return "Accepted"
    return "Rejected + Feedback"

graph = StateGraph(State)
graph.add_node("generator", llm_call_generator)
graph.add_node("evaluator", llm_call_evaluator)

graph.add_edge(START, "generator")
graph.add_edge("generator", "evaluator")
graph.add_conditional_edges(
    "evaluator",
    route_joke,
    {
        "Accepted": END,
        "Rejected + Feedback": "generator",
    }
)
```

이 패턴은 농담 생성뿐 아니라 아래 같은 문제에 응용된다.

- 초안 보고서 품질 개선
- 여행 일정 완성도 개선
- 정책 답변의 근거 충실도 개선
- 요약문의 형식 검수
- 코드 생성 후 자기 검토

실습 노트에서는 Reflection Node와 평가 함수도 같이 나온다.  
예를 들어 여행 계획 결과를 100점 만점으로 나눠 평가하는 구조가 등장한다.

```python
import json
import re

def evaluate_multi_agent(state: SupervisorState) -> dict:
    eval_prompt = f"""당신은 Multi-Agent 시스템의 성과를 평가하는 평가자입니다.

## 평가 기준
1. Planner 평가 (0~30점)
2. Worker 평가 (0~40점)
3. 전체 평가 (0~30점)

## 입력 정보
- 사용자 요청: {state['task']}
- Worker 결과들: {state.get('worker_results', [])}
- 최종 출력: {state.get('final_output', '없음')}

## 출력 형식
{{"planner_score": <0~30>, "worker_score": <0~40>, "overall_score": <0~30>, "feedback": "<전체 피드백>"}}
"""

    response = llm.invoke(eval_prompt)
    content = response.content

    try:
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_match = re.search(r'\{[\s\S]*\}', content)
            json_str = json_match.group(0) if json_match else content

        parsed = json.loads(json_str)
        total_score = (
            parsed["planner_score"]
            + parsed["worker_score"]
            + parsed["overall_score"]
        )

        return {
            "score": total_score,
            "feedback": parsed["feedback"],
            "details": {
                "planner": parsed["planner_score"],
                "worker": parsed["worker_score"],
                "overall": parsed["overall_score"],
            },
        }
    except Exception as e:
        return {"score": 0, "feedback": f"평가 실패: {str(e)}", "details": {}}
```

💡 포인트  
이 패턴의 본질은 “더 많이 호출한다”가 아니라, **생성과 평가를 다른 역할로 분리한다**는 데 있다. 사람이 초안을 쓰고 검토자가 따로 있는 것과 비슷하다.

⚠️ 주의  
Reflection 루프는 좋아 보이지만, 종료 조건이 약하면 무한 반복에 빠질 수 있다.  
그래서 실습 코드에는 `MAX_REFLECTIONS` 같은 제한이 함께 들어간다.

📌 핵심  
Reflection / Evaluator-Optimizer는 “한 번 더 생각하기”가 아니라, **생성 결과를 별도 기준으로 다시 평가하게 만드는 구조**다.

---

### 3.12 CoT와 명시적 Reasoning 노드: 추론을 한 단계 분리해 보는 실험

과제 정답 노트에서는 실습에서 만든 Agent를 기반으로, CoT(Chain of Thought) 스타일의 Reasoning 노드를 앞단에 두는 실험도 진행한다.  
이 부분은 강의 전체에서 아주 긴 비중은 아니지만, 생각보다 중요한 포인트를 던진다.

핵심 아이디어는 이렇다.

- 사용자의 요청을 받자마자 곧바로 Agent가 Tool을 고르지 않는다.
- 먼저 별도의 Reasoning 노드가 “어떤 순서로 판단해야 하는가”를 정리한다.
- 그 다음 Agent와 Tool 단계로 넘긴다.

그래프 흐름은 다음과 같이 잡을 수 있다.

```python
from langgraph.graph import StateGraph, MessagesState, START, END

class AgentState(MessagesState):
    """메시지 기반 Agent 상태"""
    pass

graph = StateGraph(AgentState)

# reasoning -> agent -> tools -> end
graph.add_node("reasoning", call_reasoning)
graph.add_node("agent", call_agent)
graph.add_node("tools", call_tools)

graph.add_edge(START, "reasoning")
graph.add_edge("reasoning", "agent")
graph.add_edge("agent", "tools")
graph.add_edge("tools", END)

agent_cot = graph.compile()
```

이 패턴은 모든 경우에 꼭 필요한 것은 아니다.  
하지만 강의 맥락에서는 좋은 질문을 던진다.

> “LLM이 도구를 고르기 전에, 먼저 어떤 판단 틀을 만들게 하면 더 안정적일까?”

특히 환불 처리 같은 문제에서는  
정책 확인 → 상태 판단 → 조건 검증 → 실행 결정  
순서가 중요한데, 이런 경우에는 명시적 Reasoning 노드가 도움이 될 수 있다.

⚠️ 주의  
추론 노드를 추가하면 단계가 늘어나는 만큼 비용과 지연도 늘어난다.  
따라서 모든 문제에 붙이는 만능 장치는 아니고, **순서가 중요하고 실수가 비싼 작업**에서 더 유효하다.

📌 핵심  
CoT를 별도 노드로 빼는 것은 “더 똑똑해지게 한다”기보다, **판단 순서를 구조로 드러내는 방식**이라고 이해하면 좋다.

---

### 3.13 Gradio 연동: 그래프를 서비스 UI로 연결하기

강의 마지막은 “이제 만든 Agent를 어떻게 보여줄 것인가”로 이어진다.  
여기서 Gradio가 등장한다.

처음에는 가장 단순한 Hello World 형태로 감을 잡는다.

```python
import gradio as gr

def greet(name, intensity):
    return "Hello, " + name + "!" * int(intensity)

demo = gr.Interface(
    fn=greet,
    inputs=["text", "slider"],
    outputs=["text"],
)

demo.launch(share=True)
```

이 예제는 아주 단순하지만, 중요한 감각을 준다.  
즉, 함수 하나만 있으면 빠르게 데모 UI를 만들 수 있다는 점이다.

그 다음에는 실제 LangGraph Agent와 연결한다.  
강의의 핵심 연결 코드는 아래 구조다.

```python
import gradio as gr
from langchain_core.messages import HumanMessage

# 1. 채팅 처리 함수
def chat(user_input, history):
    result = agent.invoke(
        {"messages": [HumanMessage(content=user_input)]},
        config={"configurable": {"thread_id": "user_1"}}
    )

    ai_reply = result["messages"][-1].content

    history.append({"role": "user", "content": user_input})
    history.append({"role": "assistant", "content": ai_reply})

    return history, ""

# 2. UI 구성
with gr.Blocks() as demo:
    gr.Markdown("### 🍗 LangGraph 챗봇")

    with gr.Row():
        with gr.Column(scale=1):
            msg = gr.Textbox(
                label="질문 입력",
                placeholder="내 이름을 기억해줘 같은 요청도 가능",
                lines=3
            )
            submit_btn = gr.Button("🚀 전송", variant="primary")

        with gr.Column(scale=2):
            chatbot = gr.Chatbot(label="대화 이력", height=400)

    msg.submit(chat, [msg, chatbot], [chatbot, msg])
    submit_btn.click(chat, [msg, chatbot], [chatbot, msg])

# 3. 실행
demo.launch(share=True)
```

이 코드에서 꼭 봐야 할 부분은 두 가지다.

첫째, UI는 그저 입력창이 아니라 **Agent 실행 함수의 프런트엔드**라는 점이다.  
즉, 핵심 로직은 여전히 `agent.invoke()` 안에 있고, Gradio는 그 결과를 보여주는 역할을 한다.

둘째, 메모리 기반 Agent라면 `thread_id`를 함께 줘야 대화가 이어진다.  
그래야 사용자가 앞에서 말한 정보를 다음 턴에서도 유지할 수 있다.

💡 포인트  
강의 후반의 메시지는 분명하다.  
좋은 Agent 설계는 백엔드에서 끝나지 않는다. **사용자와 상호작용하는 입력-출력 인터페이스까지 붙여야 비로소 서비스**가 된다.

⚠️ 주의  
Gradio 데모를 붙였다고 바로 운영 가능한 서비스가 되는 것은 아니다.  
세션 관리, 인증, 장기 메모리 저장, 예외 처리, 로깅, 비용 통제 같은 운영 요소는 별도로 더 필요하다.

📌 핵심  
Gradio 연동은 “UI 꾸미기”보다, **그래프 기반 Agent를 실제 사용자 흐름으로 꺼내 오는 마지막 단계**라고 보는 편이 맞다.

---

## 4. 적용 관점에서 다시 보기

이 장에서는 앞에서 이미 본 개념을 바탕으로, 실제 문제를 보면 어떤 패턴을 떠올려야 하는지 정리한다.  
새로운 핵심 개념을 추가하기보다, 이미 배운 것을 실전 감각으로 다시 묶는 데 집중한다.

### 4.1 어떤 상황에서 어떤 패턴을 떠올려야 할까?

| 상황 | 먼저 떠올릴 패턴 | 이유 |
|---|---|---|
| 단순 조회형 질문 | Direct + Tool | 한 번 조회하고 끝나면 되기 때문 |
| 조회 후 다시 판단해야 하는 질문 | ReAct | 도구 결과를 보고 다음 행동을 결정해야 하기 때문 |
| 이전 대화 맥락이 필요한 챗봇 | Memory | thread_id 기준으로 문맥을 이어야 하기 때문 |
| 실행형 액션이 포함된 서비스 | Safety Tool + Guardrail | 잘못된 실행을 막아야 하기 때문 |
| 단계가 많은 복합 작업 | Planner-Worker / Plan-and-Execute | 계획 수립과 실행을 분리해야 하기 때문 |
| 역할이 분명히 나뉘는 작업 | Supervisor / Fan-out | 조사, 분석, 예산 등 역할 병렬화가 가능하기 때문 |
| 결과 품질을 한 번 더 다듬고 싶을 때 | Reflection / Evaluator-Optimizer | 초안 생성 후 평가-개선 루프가 필요하기 때문 |

이 표를 외우는 것보다 중요한 것은, **문제의 성격을 먼저 보는 습관**이다.  
예를 들어 “여행 계획 짜줘”는 단순 질의처럼 보여도 실제로는 일정, 예산, 맛집, 이동 동선이 얽혀 있어 Multi-Agent가 어울릴 수 있다.

### 4.2 구현 순서는 어떻게 잡으면 좋을까?

강의 전체를 실전 개발 순서로 다시 정리하면 아래처럼 보는 것이 자연스럽다.

```text
1) State 정의
2) 기본 Node 작성
3) Direct Graph로 최소 기능 확인
4) Tool 연결
5) Memory 연결
6) ReAct 루프 추가
7) 실행형 도구에 안전 검증 추가
8) 평가 함수 / 테스트 케이스 작성
9) 필요 시 Planner-Worker, Supervisor로 확장
10) 마지막에 UI 연동
```

이 순서가 중요한 이유는, 처음부터 Multi-Agent와 UI까지 한 번에 붙이면 어디서 문제가 났는지 추적하기 어려워지기 때문이다.  
즉, **작게 시작하고 점진적으로 확장하는 방식**이 가장 안정적이다.

### 4.3 문제를 보면 어떤 신호를 포착해야 할까?

아래 신호가 보이면, 단일 LLM 호출로는 부족할 가능성이 크다.

- “조회하고, 비교하고, 조건에 맞으면 실행해줘”
- “이전 대화 내용을 기억해서 이어서 해줘”
- “단계별로 계획을 세워서 처리해줘”
- “조사와 분석을 나눠서 해줘”
- “초안을 만들고, 평가해서 더 좋게 고쳐줘”
- “실행 결과가 정책 위반이면 막아야 해”

이 표현들이 보이면 바로 아래처럼 연결해 볼 수 있다.

- 조회 + 조건 + 실행 → ReAct + Safety Tool
- 이전 대화 기반 → Memory
- 단계별 처리 → Planner-Worker / Plan-and-Execute
- 역할 분리 → Supervisor
- 품질 개선 → Reflection

### 4.4 실전에서 자주 틀리는 패턴

#### (1) Tool을 붙였는데 실제 실행 흐름이 없다
`bind_tools()`만 해놓고 끝내면, LLM은 도구 호출을 결정만 하고 아무것도 실행하지 못한다.

#### (2) ReAct 루프는 있는데 종료 조건이 약하다
도구를 계속 부르기만 하고 종료하지 못하는 루프가 생길 수 있다.

#### (3) Memory는 넣었는데 thread_id를 매번 다르게 준다
이 경우 메모리가 있는 것 같지만 실제로는 턴이 이어지지 않는다.

#### (4) 실행형 도구에 검증이 없다
LLM이 실수하면 바로 정책 위반 실행으로 이어질 수 있다.

#### (5) Multi-Agent로 나눴는데 역할 구분이 흐리다
Planner, Worker, Supervisor가 각각 무엇을 책임지는지 불명확하면 구조만 복잡해지고 성능은 오히려 흔들린다.

#### (6) 평가 없이 “잘 되는 것 같다”로 끝낸다
데모에서는 멋져 보여도, 실제 케이스를 몇 개만 돌려 보면 오류가 바로 드러나는 경우가 많다.

### 4.5 결국 무엇을 설계해야 하는가?

이번 강의를 한 줄로 요약하면, 결국 설계해야 하는 것은 세 가지다.

1. **상태(State)의 흐름**
2. **행동(Tool / Execution)의 통제**
3. **품질(평가 / Guardrail / Reflection)의 관리**

LLM 자체는 이 구조 안의 한 컴포넌트일 뿐이다.  
그래서 LangGraph를 익힌다는 것은 “LLM 호출 라이브러리를 하나 더 배우는 것”이 아니라, **AI 시스템의 제어 구조를 설계하는 법을 배우는 것**에 가깝다.

---

## 5. 배운 점 / 느낀 점 / 확장 포인트

이번 강의에서 가장 크게 남는 배움은, Agent를 “성능 좋은 LLM”으로 이해하면 안 된다는 점이다.  
실제로 Agent의 품질을 결정하는 것은 모델 이름보다도, **상태를 어떻게 설계했는지, 도구를 어떻게 연결했는지, 위험한 행동을 어떻게 차단했는지, 평가와 개선 루프를 어떻게 넣었는지**에 더 가깝다.

특히 고객 서비스 실습은 이 점을 아주 선명하게 보여준다.  
정책 검색, 주문 조회, 쿠폰 발급은 각각 보면 단순하지만, 이것이 한 요청 안에 묶이면 순서와 검증이 중요해진다. 여기서 ReAct와 Safety Tool, Guardrail의 필요성이 자연스럽게 드러난다.

또 하나 중요한 확장 포인트는 Multi-Agent 패턴이다.  
복잡한 작업을 한 모델에게 통째로 던지기보다, Planner-Worker나 Supervisor로 역할을 분리하면 결과를 더 통제하기 쉬워진다. 이는 단순히 성능 최적화 문제가 아니라, **설명의 책임과 검토 책임을 분리하는 구조적 사고**에 가깝다.

앞으로 더 확장해 볼 수 있는 방향은 아래와 같다.

- `InMemorySaver` 대신 DB 기반 장기 메모리 연결
- Tool 실행 결과 로깅과 재시도 정책 추가
- Structured Output을 더 적극적으로 사용해 평가와 분기 안정화
- Supervisor 패턴의 병렬 Worker를 실제 외부 API와 연결
- Gradio 이후 FastAPI / 배포 환경으로 확장
- LangSmith와 연동한 실행 추적 및 디버깅 자동화

이번 내용을 잘 이해했다면, 다음 단계에서는 단순한 예제 Agent를 넘어서  
**실제 도메인 문제를 안전하게 처리하는 서비스형 Agent**를 설계해 볼 수 있다.

---

## 6. 요약 정리

### 📌 핵심

- LangGraph의 출발점은 LLM이 아니라 **State 설계**다.
- Agent는 `LLM + Tool + Memory + Planning`의 결합으로 이해하는 것이 맞다.
- Direct는 한 번 실행하고 끝나는 흐름이고, ReAct는 도구 결과를 보고 다시 판단하는 흐름이다.
- 실무형 Agent는 기능 구현만으로 끝나지 않고, **평가 / Guardrail / Safety Tool**이 함께 있어야 한다.
- 복잡한 작업은 Planner-Worker, Supervisor, Reflection 같은 패턴으로 나누면 더 안정적으로 다룰 수 있다.
- 마지막에는 Gradio 같은 UI와 연결해 사용자 흐름까지 완성해야 서비스 형태가 된다.

### 🧠 기억할 것

- `bind_tools()`는 도구 실행이 아니라 도구 호출 **판단 능력**을 주는 단계다.
- `thread_id`는 메모리 세션을 유지하는 핵심 키다.
- 실행형 도구는 프롬프트만 믿지 말고 **도구 내부 검증**을 반드시 넣어야 한다.
- Multi-Agent는 Agent 수를 늘리는 것이 아니라 **역할과 책임을 나누는 설계**다.
- Reflection은 단순 재시도가 아니라 **평가 결과를 다음 생성에 반영하는 루프**다.

### 짧게 다시 보면

```text
State를 설계한다.
→ Tool과 Memory를 붙인다.
→ ReAct로 판단-행동-관찰 루프를 만든다.
→ Guardrail과 Safety Tool로 신뢰성을 높인다.
→ Planner-Worker / Supervisor / Reflection으로 복잡한 작업을 분해한다.
→ 마지막에 UI로 연결해 서비스 형태로 꺼낸다.
```

---

## 7. 미니 퀴즈 또는 체크리스트

1. `bind_tools()`와 `ToolNode`의 역할 차이를 설명해 보자.  
   왜 둘이 분리되어 있어야 하는가?

2. Direct 패턴과 ReAct 패턴의 차이를 “도구 실행 후 다음 단계” 관점에서 설명해 보자.  
   어떤 문제에서 ReAct가 꼭 필요한가?

3. `MemorySaver`를 붙였는데도 Agent가 이전 대화를 기억하지 못한다면, 가장 먼저 무엇을 확인해야 할까?

4. `issue_coupon_tool()` 대신 `issue_coupon_safe()` 같은 안전한 도구가 필요한 이유를 설명해 보자.  
   입력 가드레일만으로는 왜 충분하지 않은가?

5. Planner-Worker와 Supervisor 패턴은 둘 다 여러 역할을 나눈다는 공통점이 있다.  
   하지만 어떤 종류의 작업에서 각각 더 잘 맞는가?

6. Reflection / Evaluator-Optimizer 패턴을 넣었을 때 얻는 장점은 무엇인가?  
   반대로, 종료 조건을 잘못 설계하면 어떤 문제가 생길까?

7. 아래 요청을 보면 어떤 패턴 조합이 어울리는지 생각해 보자.  
   - “내가 아까 말한 주문번호 기준으로 환불 가능 여부를 확인해줘.”  
   - “3일 여행 일정, 예산, 맛집, 동선을 한 번에 정리해줘.”  
   - “정책을 검색해서 조건이 맞을 때만 쿠폰을 발급해줘.”

---

이 노트의 핵심은 LangGraph 문법을 외우는 것이 아니라,  
**Agent를 상태·행동·검증·역할 분리의 관점에서 구조적으로 설계하는 감각**을 잡는 데 있다.
