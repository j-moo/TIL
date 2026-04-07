# 힙에 가중치를 기준으로 원소를 삽입 or 제거
# 원소를 제거 => 가중치가 가장 작은 원소가 뿅
from heapq import heappop, heappush

# V : 정점의 개수, E : 간선의 개수
V, E = map(int, input().split())

# 인접리스트
G = [[] for _ in range(V)]

for i in range(E):
    # s에서 e로 가는 간선의 가중치 w
    s, e, w = map(int, input().split())
    G[s].append((e, w))
    G[e].append((s, w))

"""
1. 임의의 정점을 하나 골라서 시작
2. 내가 지금까지 골랐던 정점들과 인접하는 정점중에 최소 가중치를
    가진 간선을 선택(조건 : 이전에 선택한적 없는 정점과 이어진 간선)

3. MST가 만들어질 때까지 반복
"""

# start : 시작 정점 번호
def prim(start):
    # 우선순위큐(최소힙)
    heap = [(가중치, 정점번호)]
    # 중복체크배열
    # MST[i] = 1 : i번 정점은 MST에 포함(이전에 골랐다.)
    # MST[i] = 0 : i번 정점은 MST에 미포함(이전에 고른적 없다.)
    MST = [0] * V

    # 최소비용
    min_w = 0

    # 정점을 선택한 횟수
    v_cnt = 0

    # 힙에 시작정점 추가
    # (가중치, 정점번호) 형태로 힙에 추가,
    # 이때 힙의 우선순위 선정 기준
    # 은 튜플의 첫번째 원소, 시작 정점을 추가할때는 가중치를 0으로
    heappush(heap, (0, start))

    # 가중치가 최소인 간선을 선택하는 일을 반복
    # 선택한 정점의 개수가 총 점점개수보다 작으면 아직 신장트리 완선x
    # 힙에 뭔가 남아있어야 남아있는것중에 작은 가중치를 선택
    while v_cnt < V and heap:
        # w : 가중치 ==> 최소힙이니 최소 가중치가 뿅
        # v : 최소가중치를 가진 간선의 도착지점(정점번호)
        w, v = heappop(heap)

        # v가 지금 내가 만들고 있는 신장트리에 포함되어있다면?
        if MST[v]:
            # 다음 최소 가중치 간선 꺼내기 위해 건너뜀
            continue
        
        # v는 최소신장트리에 포함
        MST[v] = 1
        # 가중치 합
        min_w += w
        # 선택횟수 + 1
        v_cnt += 1

        # v를 MST에 포함했으니
        # v에서 갈 수 있는 정점들의 정보도 힙에 추가
        for nv, nw in G[v]:
            # nv : v에서 갈 수 있는 정점 번호
            # nw : 그때 간선의 가중치

            if MST[nv]:
                continue

            # v => nv로 가는 간선 정보 힙에 추가
            heappush(heap, (nw, nv))

    # while문이 종료되면 MST완성
    return min_w

print(f'MST 가중치 : {prim(0)}')
print(f'MST 가중치 : {prim(4)}')