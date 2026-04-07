# V : 정점의 개수, E : 간선의 개수
V, E = map(int, input().split())

# 간선 정보를 저장할 리스트
edges = []

for i in range(E):
    # s와 e를 잇는 간선의 가중치 w
    s, e, w = map(int, input().split())
    edges.append((s, e, w))

# edges 에 추가할 때 가중치는 인덱스 2번 이었으니 2번 인덱스를 기준으로 정렬(오름차순)
edges.sort(key=lambda x : x[2])

# 크루스칼 알고리즘은 상호배타집합(유니온파인드) 를 통해서 사이클의 유무를 파악한다.
# 정점A와 정점B가 같은 잡합에 속해있을 때 그 간선을 사용해서 MST를 만들면 => 사이클 생김
# 같은 집합에 속해있지 않은 두 정점 사이의 간선을 선택해야 사이클이 생기지 않는다.

# make set : 집합 초기화
p = [i for i in range(V)]

# find set : 대표 찾기
def find_set(x):
    if x == p[x]:
        return x
    
    p[x] = find_set(p[x])   # 경로 압축
    return p[x]

# union : 집합 합치기
def union(x, y):
    king_x = find_set(x)
    king_y = find_set(y)

    if king_x == king_y:
        return
    
    p[king_y] = king_x

# 선택한 간선의 개수
e_cnt = 0

# 가중치 합
min_w = 0

# 크루스칼 알고리즘은 0번 인덱스에 있는 간선 정보로부터 차례대로 확인(오름차순으로 정렬을 해놨음)
# 0번 인덱스에 있는 간선은 가중치가 최소인 간선

for s, e, w in edges:
    # s, e 를 잇는 간선의 가중치가 w
    # s, e 가 같은 집합에 속해있다면, 이 간선을 추가하면 => 사이클이 생긴다 => MST X
    # s, e 가 다른 집합에 속해있다면, 이 간서은 추가하면 => 사이클이 안생긴다 => MST 0

    if find_set(s) != find_set(e):
        union(s, e)
        e_cnt += 1
        min_w += w
        print(s, e, w)

        if e_cnt == V - 1:
            break

print(f'최소 비용 : {min_w}')