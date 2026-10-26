def solution(board):
    rows = len(board)  # 격자의 행 개수이며, 입력은 비어 있지 않은 직사각형이다.
    cols = len(board[0])  # 모든 행의 길이가 같다는 문제 입력을 전제로 한다.
    visited = [[False] * cols for _ in range(rows)]  # 행마다 별도 방문 목록을 만든다.
    directions = [  # 현재 칸에 더할 (행 변화량, 열 변화량): 대각선을 포함한 8방향이다.
        (-1, -1), (-1, 0), (-1, 1),
        (0, -1),           (0, 1),
        (1, -1),  (1, 0),  (1, 1),
    ]
    answer = 0  # 조건에 맞는 연결 묶음의 개수만 누적한다.

    for r in range(rows):  # 모든 행을 시작점 후보로 확인한다.
        for c in range(cols):  # 현재 행의 모든 열을 확인한다.
            if visited[r][c]:  # 앞선 탐색에 포함된 칸은 다시 세지 않는다.
                continue

            value = board[r][c]  # 이번 묶음을 구성하는 숫자를 고정한다. 0도 가능하다.
            stack = [(r, c)]  # 아직 주변을 조사하지 않은 좌표를 튜플로 보관한다.
            visited[r][c] = True  # 넣는 순간 표시하여 같은 좌표의 중복 삽입을 막는다.
            min_r = max_r = r  # 위쪽·아래쪽 경계의 초기값은 시작 행이다.
            min_c = max_c = c  # 왼쪽·오른쪽 경계의 초기값은 시작 열이다.
            count = 0  # 중복 없이 꺼낸 칸의 수를 센다.

            while stack:  # 발견한 칸이 남아 있는 동안 묶음 전체를 탐색한다.
                cr, cc = stack.pop()  # 가장 나중에 넣은 좌표를 행·열 변수로 나눈다.
                count += 1  # 각 칸은 한 번만 들어오므로 한 번만 더해진다.
                min_r = min(min_r, cr)  # 지금까지 발견한 가장 위쪽 행이다.
                max_r = max(max_r, cr)  # 지금까지 발견한 가장 아래쪽 행이다.
                min_c = min(min_c, cc)  # 지금까지 발견한 가장 왼쪽 열이다.
                max_c = max(max_c, cc)  # 지금까지 발견한 가장 오른쪽 열이다.

                for dr, dc in directions:  # 8개의 이웃 후보를 하나씩 만든다.
                    nr = cr + dr  # 다음 칸의 행 좌표를 계산한다.
                    nc = cc + dc  # 다음 칸의 열 좌표를 계산한다.
                    if not (0 <= nr < rows and 0 <= nc < cols):  # 배열 접근 전에 범위를 검사한다.
                        continue
                    if visited[nr][nc]:  # 이미 발견한 칸은 다시 스택에 넣지 않는다.
                        continue
                    if board[nr][nc] != value:  # 다른 숫자는 이번 묶음에 속하지 않는다.
                        continue
                    visited[nr][nc] = True  # 같은 숫자의 새 칸을 발견했다고 먼저 표시한다.
                    stack.append((nr, nc))  # 이후 이 칸의 주변도 조사하도록 예약한다.

            height = max_r - min_r + 1  # 양 끝 행을 모두 포함하므로 1을 더한다.
            width = max_c - min_c + 1  # 양 끝 열을 모두 포함하므로 1을 더한다.
            if height >= 2 and height == width and count == height * width:
                answer += 1  # 최소 크기·같은 변 길이·빈틈없음을 모두 만족해야 센다.

    return answer  # 부분 정사각형 수가 아니라 조건을 만족한 묶음 수를 반환한다.
