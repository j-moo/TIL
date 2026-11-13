import assert from "node:assert/strict"; // 실제 예약 시간과 중단 사유를 비교한다.
import { readFileSync } from "node:fs"; // 문서에 실린 코드 자체를 검사한다.
import test from "node:test"; // 네트워크와 외부 패키지 없이 실행한다.

const note = readFileSync(new URL("./11_13_SSE_Reconnect_Storms_and_Graceful_Drain.md", import.meta.url), "utf8");
const blocks = [...note.matchAll(/^```javascript\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
assert.equal(blocks.length, 1, "검사 대상 JavaScript 펜스는 하나여야 한다.");
const url = "data:text/javascript;base64," + Buffer.from(blocks[0][1], "utf8").toString("base64");
const { planSseRetry } = await import(url); // 임시 파일을 만들지 않는다.

const plan = options => planSseRetry({
  status: null, retryIndex: 0, remainingMs: 30_000, random: () => 0.5, ...options,
}); // 고정 난수와 가상의 시간 예산을 주어 테스트에서 실제로 기다리지 않는다.

test("첫 단절은 기본 대기와 지터를 더해 예약한다", () => {
  assert.deepEqual(plan(), { kind: "retry", delayMs: 500 }); // 250 + 500 × 0.5
});

test("같은 순간 실패한 두 연결의 재시도 시점을 분리한다", () => {
  const early = plan({ random: () => 0 });
  const late = plan({ random: () => 0.999 });
  assert.deepEqual(early, { kind: "retry", delayMs: 250 });
  assert.deepEqual(late, { kind: "retry", delayMs: 749 }); // 범위의 끝 750에는 닿지 않는다.
});

test("연속 실패할수록 지터 범위가 늘어난다", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(retryIndex => plan({ retryIndex }).delayMs),
    [500, 750, 1_250, 2_250, 4_250]);
});

test("429·503의 Retry-After는 지터를 적용해도 최소 대기 시간으로 지킨다", () => {
  for (const status of [429, 503]) {
    assert.deepEqual(plan({ status, retryAfter: "3" }), { kind: "retry", delayMs: 3_250 });
    assert.deepEqual(plan({ status, retryAfter: "3", random: () => 0 }), { kind: "retry", delayMs: 3_000 });
  }
});

test("서버 대기 시간이 예산보다 길어도 앞당기지 않는다", () => {
  assert.deepEqual(plan({ status: 503, retryAfter: "3", remainingMs: 2_000 }), { kind: "stop", reason: "budget" });
  assert.deepEqual(plan({ status: 503, retryAfter: "999999999" }), { kind: "stop", reason: "budget" });
});

test("다음 시도가 정확히 마감 시점이면 예약하지 않는다", () => {
  assert.deepEqual(plan({ remainingMs: 500 }), { kind: "stop", reason: "budget" });
  assert.deepEqual(plan({ remainingMs: 501 }), { kind: "retry", delayMs: 500 });
});

test("날짜 형식과 범위를 벗어난 헤더를 임의의 0초로 해석하지 않는다", () => {
  for (const retryAfter of ["Wed, 21 Oct 2015 07:28:00 GMT", "-1", "0.5", "1\n", "1, 2", "1000000000", 3]) {
    assert.deepEqual(plan({ status: 503, retryAfter }), { kind: "stop", reason: "unsupported_retry_after" });
  }
});

test("204와 인증·권한·잘못된 커서는 자동 반복하지 않는다", () => {
  for (const status of [204, 400, 401, 403, 404, 500]) {
    assert.deepEqual(plan({ status }), { kind: "stop", reason: "not_retryable" });
  }
  for (const status of [502, 504]) assert.equal(plan({ status }).kind, "retry"); // 예시 정책에서 선택한 일시 오류다.
});

test("다섯 번째 예약 이후에는 시간이 남아도 종료한다", () => {
  assert.equal(plan({ retryIndex: 4 }).kind, "retry");
  assert.deepEqual(plan({ retryIndex: 5 }), { kind: "stop", reason: "attempts" });
});

test("음수·비정수 번호와 유효하지 않은 시간 예산·난수는 설정 오류다", () => {
  for (const options of [{ retryIndex: -1 }, { retryIndex: 1.5 }, { remainingMs: -1 }, { remainingMs: Infinity }]) {
    assert.throws(() => plan(options), TypeError);
  }
  for (const fraction of [-0.01, 1, NaN]) assert.throws(() => plan({ random: () => fraction }), RangeError);
});
