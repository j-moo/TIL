import heapq  # 가장 이른 시각의 후보를 먼저 꺼내는 최소 힙을 사용한다.


def solution(preferences, requests):
    n = len(preferences)  # 실습 종류의 수이며, 뒤쪽 실습일수록 더 선호한다.
    index = {}  # 실습 이름을 배열에서 사용할 정수 번호로 바꾼다.
    for i, name in enumerate(preferences):  # 번호 0이 처음 보유한 실습이다.
        index[name] = i  # 이름과 선호도 순서 번호를 연결한다.

    graph = [[] for _ in range(n)]  # 내가 가진 참가권별로 가능한 교환 요청을 저장한다.
    for start, end, offered, wanted in requests:  # offered/wanted는 요청자 관점이다.
        start_time = int(start[:2]) * 60 + int(start[3:])  # HH:MM을 자정 이후 분으로 바꾼다.
        end_time = int(end[:2]) * 60 + int(end[3:])  # 종료 시각은 교환할 수 없는 경계다.
        source = index[wanted]  # 내가 이 참가권을 가지고 있어야 요청을 이용할 수 있다.
        target = index[offered]  # 교환 후 내가 받는 참가권의 번호다.
        graph[source].append((target, start_time, end_time))  # wanted → offered 방향이다.

    inf = float("inf")  # 아직 그 참가권을 얻는 방법을 찾지 못했다는 표시다.
    earliest = [inf] * n  # 참가권별 가장 이른 획득 시각만 저장한다.
    earliest[0] = 0  # 00:00부터 가장 선호도가 낮은 참가권을 가지고 있다.
    heap = [(0, 0)]  # (획득 시각, 참가권 번호)이므로 시각이 작은 후보가 우선이다.

    while heap:  # 더 조사할 도달 후보가 있는 동안 반복한다.
        time, current = heapq.heappop(heap)  # 가장 이른 후보부터 다음 교환을 조사한다.
        if time != earliest[current]:  # 더 이른 기록으로 대체된 오래된 후보라면 버린다.
            continue

        for target, start_time, end_time in graph[current]:  # 현재 참가권을 원하는 요청들이다.
            next_time = max(time, start_time)  # 일찍 도착했으면 시작 시각까지 기다린다.
            if next_time >= end_time:  # 종료 시각과 같거나 늦으면 이용할 수 없다.
                continue
            if next_time < earliest[target]:  # 실제로 더 일찍 얻는 경우에만 갱신한다.
                earliest[target] = next_time  # 교환 시간이 0이므로 실행 시각이 획득 시각이다.
                heapq.heappush(heap, (next_time, target))  # 같은 시각의 연속 교환도 처리한다.

    for i in range(n - 1, -1, -1):  # 가장 선호하는 실습부터 도달 가능 여부를 확인한다.
        if earliest[i] != inf:  # 한 번 얻었다면 이후 교환하지 않고 유지할 수 있다.
            return preferences[i]  # 번호가 아니라 문제에서 요구한 실습 이름을 반환한다.
