import assert from "node:assert/strict"; // 계산 결과뿐 아니라 예외와 필드 구조도 확인한다.
import { readFileSync } from "node:fs"; // 노트에 실린 코드와 테스트 코드가 따로 변하지 않게 한다.
import test from "node:test"; // Node 내장 실행기로 계산만 검사한다.

const note = readFileSync(new URL("./11_17_SSE_Capacity_Planning_and_Load_Testing.md", import.meta.url), "utf8");
const blocks = [...note.matchAll(/^```javascript\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
assert.equal(blocks.length, 1, "검사 대상 코드 펜스는 하나여야 한다.");
const url = "data:text/javascript;base64," + Buffer.from(blocks[0][1], "utf8").toString("base64");
const { estimateSseCapacity } = await import(url); // 네트워크나 별도 파일 작성 없이 실행한다.

const estimate = options => estimateSseCapacity({
  acceptedPerSecond: 10, meanLifetimeSeconds: 120, // 평상시 승인율과 유지 시간이다.
  instances: 3, unavailable: 1, safeSlotsPerInstance: 750,
  reconnecting: 400, spreadSeconds: 20, replayQueriesPerReconnect: 4,
  baselineQueriesPerSecond: 45, safeQueriesPerSecond: 110,
  ...options, // 한 조건씩 바꿔 어떤 예산이 영향을 받는지 확인한다.
});

test("활성 슬롯이 남아도 재생 조회 예산은 초과할 수 있다", () => {
  assert.deepEqual(estimate(), {
    meanActive: 1_200, survivingSlots: 1_500, slotHeadroom: 300,
    reconnectsPerSecond: 20, estimatedQueries: 125, queryHeadroom: -15,
    minimumSpreadSeconds: 25,
  });
});

test("분산 시간을 계산상 하한까지 늘리면 예시의 평균 조회 예산 안에 든다", () => {
  assert.equal(estimate({ spreadSeconds: 24 }).queryHeadroom < 0, true);
  const revised = estimate({ spreadSeconds: 25 });
  assert.equal(revised.estimatedQueries, 109);
  assert.equal(revised.queryHeadroom, 1); // 실제 피크를 감당했다는 뜻은 아니다.
});

test("나눗셈이 정확히 떨어지면 한 초를 더하지 않는다", () => {
  const result = estimate({ reconnecting: 390, spreadSeconds: 24 }); // 390 × 4 ÷ 65 = 24
  assert.equal(result.minimumSpreadSeconds, 24);
  assert.equal(result.queryHeadroom, 0);
});

test("공유 DB의 평시 여유가 없으면 양수의 재생량을 분산만으로 수용할 수 없다", () => {
  const result = estimate({ safeQueriesPerSecond: 45 });
  assert.equal(result.minimumSpreadSeconds, null);
  assert.equal(result.queryHeadroom, -80);
});

test("평상시부터 예산을 넘으면 재연결이 없어도 해가 없다", () => {
  const result = estimate({ reconnecting: 0, safeQueriesPerSecond: 44 });
  assert.equal(result.minimumSpreadSeconds, null);
  assert.equal(result.queryHeadroom, -1);
});

test("예산 안에서 추가 재생이 없으면 조회량 때문에 분산할 필요는 없다", () => {
  for (const options of [{ reconnecting: 0 }, { replayQueriesPerReconnect: 0 }]) {
    assert.equal(estimate({ ...options, safeQueriesPerSecond: 45 }).minimumSpreadSeconds, 0);
  }
});

test("남은 인스턴스가 없으면 기존 활성 구독을 수용할 슬롯도 없다", () => {
  const result = estimate({ unavailable: 3 });
  assert.equal(result.survivingSlots, 0);
  assert.equal(result.slotHeadroom, -1_200);
});

test("승인률·초당 비용과 같은 평균에는 소수 입력을 허용한다", () => {
  const result = estimate({ acceptedPerSecond: 2.5, meanLifetimeSeconds: 50.5, replayQueriesPerReconnect: 1.25 });
  assert.equal(result.meanActive, 126.25);
  assert.equal(result.estimatedQueries, 70);
  assert.equal(result.minimumSpreadSeconds, 8);
});

test("음수·비정수·분산 시간 0과 불가능한 인스턴스 수를 거절한다", () => {
  for (const options of [{ spreadSeconds: 0 }, { unavailable: 4 }, { instances: 0 },
    { reconnecting: 1.5 }, { safeSlotsPerInstance: -1 }, { meanLifetimeSeconds: NaN }]) {
    assert.throws(() => estimate(options), RangeError);
  }
});

test("계산 과정에서 무한대 또는 안전 정수 범위를 넘는 슬롯을 거절한다", () => {
  assert.throws(() => estimate({ acceptedPerSecond: Number.MAX_VALUE }), RangeError);
  assert.throws(() => estimate({ safeSlotsPerInstance: Number.MAX_SAFE_INTEGER }), RangeError);
});
