"""Run from repository root: python -B -m unittest discover -s problem_review/10_25 -v."""

import itertools
import random
import unittest
from pathlib import Path

from square_components import solution as count_squares
from time_window_ticket_exchange import solution as exchange_ticket


def square_reference(board):
    """Small-input oracle: enumerate solid squares and reject same-value outside neighbors."""
    rows, cols = len(board), len(board[0])
    answer = 0
    for size in range(2, min(rows, cols) + 1):  # 가능한 정사각형 자체를 모두 열거한다.
        for top in range(rows - size + 1):
            for left in range(cols - size + 1):
                cells = set(itertools.product(range(top, top + size), range(left, left + size)))
                value = board[top][left]
                if any(board[r][c] != value for r, c in cells):  # 내부가 같은 숫자로 꽉 차야 한다.
                    continue
                attached = False
                for r, c in cells:
                    for nr in range(max(0, r - 1), min(rows, r + 2)):
                        for nc in range(max(0, c - 1), min(cols, c + 2)):
                            if (nr, nc) not in cells and board[nr][nc] == value:
                                attached = True  # 밖에 같은 숫자가 연결되면 묶음 전체가 아니다.
                if not attached:
                    answer += 1
    return answer


def exchange_reference(preferences, requests):
    """Small-input oracle: enumerate exchange sequences with per-request usage tracking."""
    used = [False] * len(requests)  # 실제 1회 사용 제한을 분기별로 추적한다.
    rank = {name: i for i, name in enumerate(preferences)}
    best = 0

    def visit(current, time):
        nonlocal best
        best = max(best, rank[current])  # 이 자리에서 교환을 멈추는 선택도 반영한다.
        for i, (start, end, offered, wanted) in enumerate(requests):
            if used[i] or wanted != current:
                continue
            start_time = int(start[:2]) * 60 + int(start[3:])
            end_time = int(end[:2]) * 60 + int(end[3:])
            trade_time = max(time, start_time)
            if trade_time >= end_time:
                continue
            used[i] = True  # 이 분기에서만 해당 요청을 소비한다.
            visit(offered, trade_time)  # 모든 가능한 다음 요청 순서를 직접 조사한다.
            used[i] = False  # 다른 교환 순서를 조사하기 전에 사용 상태를 복원한다.

    visit(preferences[0], 0)
    return preferences[best]


class SquareTests(unittest.TestCase):
    def test_regressions(self):
        cases = [
            ("minimum", [[7, 7], [7, 7]], 1),
            ("zero", [[0, 0], [0, 0]], 1),
            ("singletons", [[1, 2], [3, 4]], 0),
            ("rectangle", [[5, 5, 5], [5, 5, 5]], 0),
            ("diagonal", [[1, 2], [2, 1]], 0),
            ("hole", [[7, 7, 7], [7, 0, 7], [7, 7, 7]], 0),
            ("extra_cell", [[1, 1, 2], [1, 1, 2], [2, 2, 1]], 0),
            ("thin", [[1, 1, 1, 1], [2, 2, 2, 2]], 0),
            ("separated", [[1, 1, 0, 1, 1], [1, 1, 0, 1, 1]], 2),
            ("whole", [[1, 1, 1], [1, 1, 1], [1, 1, 1]], 1),
            ("four", [[1, 1, 2, 2], [1, 1, 2, 2], [3, 3, 0, 0], [3, 3, 0, 0]], 4),
            ("mixed", [[1, 1, 2, 2], [1, 1, 2, 2], [3, 3, 0, 0], [4, 4, 0, 0]], 3),
            ("merged", [[1, 1, 2, 2], [1, 1, 2, 2], [2, 2, 1, 1], [2, 2, 1, 1]], 0),
        ]
        for name, board, expected in cases:
            with self.subTest(name=name):
                original = [row[:] for row in board]  # 함수가 원본 격자를 바꾸지 않는지도 확인한다.
                self.assertEqual(count_squares(board), expected)
                self.assertEqual(board, original)

    def test_all_small_binary_boards(self):
        checked = 0
        for rows in (2, 3):
            for cols in (2, 3):
                for values in itertools.product((0, 1), repeat=rows * cols):
                    board = [list(values[r * cols:(r + 1) * cols]) for r in range(rows)]
                    self.assertEqual(count_squares(board), square_reference(board), board)
                    checked += 1
        self.assertEqual(checked, 656)

    def test_large_single_component(self):
        self.assertEqual(count_squares([[0] * 1000 for _ in range(1000)]), 1)

    def test_large_isolated_cells(self):
        board = [[(r % 2) * 2 + c % 2 for c in range(1000)] for r in range(1000)]
        self.assertEqual(count_squares(board), 0)


class ExchangeTests(unittest.TestCase):
    def test_regressions(self):
        preferences = ["cloud", "ai", "security", "mobility"]
        cases = [
            ("direction", [["09:00", "10:00", "cloud", "ai"]], "cloud"),
            ("wait", [["09:00", "10:00", "ai", "cloud"]], "ai"),
            ("end_excluded", [["10:00", "11:00", "ai", "cloud"],
                              ["09:00", "10:00", "mobility", "ai"]], "ai"),
            ("start_included", [["00:00", "00:01", "mobility", "cloud"]], "mobility"),
            ("chain_unsorted", [["09:00", "10:00", "mobility", "security"],
                                ["09:00", "10:00", "security", "ai"],
                                ["09:00", "10:00", "ai", "cloud"]], "mobility"),
            ("downgrade", [["09:00", "10:00", "security", "cloud"],
                           ["10:00", "11:00", "ai", "security"],
                           ["10:00", "11:00", "mobility", "ai"]], "mobility"),
            ("better_late", [["09:00", "10:00", "ai", "cloud"],
                             ["20:00", "21:00", "mobility", "cloud"]], "mobility"),
            ("improvement", [["15:00", "16:00", "ai", "cloud"],
                             ["09:00", "10:00", "security", "cloud"],
                             ["09:00", "10:00", "ai", "security"],
                             ["09:00", "10:00", "mobility", "ai"]], "mobility"),
            ("cycle", [["09:00", "10:00", "ai", "cloud"],
                       ["09:00", "10:00", "cloud", "ai"],
                       ["10:00", "11:00", "mobility", "cloud"]], "mobility"),
            ("parallel", [["20:00", "21:00", "ai", "cloud"],
                          ["09:00", "10:00", "ai", "cloud"],
                          ["10:00", "11:00", "mobility", "ai"]], "mobility"),
            ("last_minute", [["23:58", "23:59", "mobility", "cloud"]], "mobility"),
        ]
        for name, requests, expected in cases:
            with self.subTest(name=name):
                original = [row[:] for row in requests]
                self.assertEqual(exchange_ticket(preferences, requests), expected)
                self.assertEqual(requests, original)

    def test_exhaustive_tiny_requests(self):
        preferences = ["a", "b", "c"]
        intervals = [("00:00", "00:01"), ("00:00", "00:02"), ("00:01", "00:02")]
        options = [(start, end, offered, wanted)
                   for offered in preferences for wanted in preferences if offered != wanted
                   for start, end in intervals]  # 방향 6종류 × 시간대 3종류 = 요청 후보 18개다.
        checked = 0
        for size in (1, 2, 3):
            for requests in itertools.product(options, repeat=size):
                self.assertEqual(exchange_ticket(preferences, requests),
                                 exchange_reference(preferences, requests), requests)
                checked += 1
        self.assertEqual(checked, 6174)  # 18 + 18^2 + 18^3개의 정렬되지 않은 요청 배열이다.

    def test_random_small_requests(self):
        rng = random.Random(20261025)  # 같은 입력을 재현할 수 있도록 난수 시드를 고정한다.
        for _ in range(1000):
            preferences = [str(i) for i in range(rng.randint(2, 6))]
            requests = []
            for _ in range(rng.randint(1, 8)):
                offered, wanted = rng.sample(preferences, 2)
                start = rng.randint(0, 5)
                end = rng.randint(start + 1, 6)
                requests.append([f"00:{start:02d}", f"00:{end:02d}", offered, wanted])
            self.assertEqual(exchange_ticket(preferences, requests),
                             exchange_reference(preferences, requests), requests)

    def test_maximum_chain(self):
        preferences = [str(i) for i in range(3000)]
        requests = [["09:00", "10:00", str(i + 1), str(i)] for i in range(2999)]
        requests.append(["09:00", "10:00", "0", "2999"])  # 순환까지 넣어 요청 3000개를 만든다.
        self.assertEqual(exchange_ticket(preferences, list(reversed(requests))), "2999")


class DocumentationTests(unittest.TestCase):
    def test_documented_solutions_match_files(self):
        folder = Path(__file__).resolve().parent
        for stem in ("square_components", "time_window_ticket_exchange"):
            code = (folder / f"{stem}.py").read_text(encoding="utf-8").strip()
            note = (folder / f"{stem}.md").read_text(encoding="utf-8")
            self.assertIn("```python\n" + code + "\n```", note)  # 노트와 실행 파일의 코드 차이를 감지한다.


if __name__ == "__main__":
    unittest.main()
