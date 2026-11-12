import assert from "node:assert/strict"; // 결과 값과 객체 필드를 함께 비교한다.
import { readFileSync } from "node:fs"; // 문서에 실린 모듈을 그대로 실행한다.
import test from "node:test"; // 외부 패키지 없이 독립된 시나리오를 실행한다.

const note = readFileSync(new URL("./11_12_SSE_Observability_and_Troubleshooting.md", import.meta.url), "utf8");
const fences = [...note.matchAll(/^```javascript\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
assert.equal(fences.length, 1, "검증할 JavaScript 코드 펜스는 하나여야 한다.");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(fences[0][1], "utf8").toString("base64");
const { createSseProbe } = await import(moduleUrl); // 임시 파일이나 서버를 만들지 않는다.

const target = Object.freeze({ id: "probe-upload", revision: "9", state: "READY" });
const matches = value =>
  value.id === target.id && value.revision === target.revision && value.state === target.state;

function setup() {
  let ms = 1_000; // 시작값이 0이 아니어도 경과 시간만 계산하는지 확인한다.
  const probe = createSseProbe({ matches, budgetMs: 500, now: () => ms });
  const advance = delta => { ms += delta; }; // 실제로 기다리지 않고 단조 시계를 진행한다.
  return { probe, advance };
}

test("유효하지 않은 비교 함수와 시간 예산을 거절한다", () => {
  assert.throws(() => createSseProbe({ budgetMs: 500 }), TypeError);
  for (const budgetMs of [0, -1, Infinity, NaN, "500"]) {
    assert.throws(() => createSseProbe({ matches, budgetMs }), TypeError);
  }
});

test("연결이 열려도 상태가 적용되지 않으면 마감 실패다", () => {
  const { probe, advance } = setup();
  advance(20);
  probe.opened(); // 200·open은 예상 상태를 받았다는 뜻이 아니다.
  advance(480);
  assert.deepEqual(probe.deadline(), { outcome: "deadline", elapsedMs: 500, firstOpenMs: 20 });
});

test("같은 점검이 다시 연결돼도 첫 open 시간은 유지한다", () => {
  const { probe, advance } = setup();
  advance(40);
  probe.opened();
  advance(140);
  probe.opened();
  advance(20);
  assert.deepEqual(probe.applied(target), { outcome: "applied", elapsedMs: 200, firstOpenMs: 40 });
});

test("다른 업로드·오래된 revision·예상과 다른 상태는 성공이 아니다", () => {
  const { probe, advance } = setup();
  advance(20);
  probe.opened();
  for (const wrong of [{ id: "other" }, { revision: "8" }, { state: "SCANNING" }]) {
    assert.equal(probe.applied({ ...target, ...wrong }), null);
  }
  advance(40);
  assert.deepEqual(probe.applied(target), { outcome: "applied", elapsedMs: 60, firstOpenMs: 20 });
});

test("마감 직전의 적용은 통과하고 지표에 식별자를 담지 않는다", () => {
  const { probe, advance } = setup();
  probe.opened();
  advance(499);
  // 객체 전체를 비교해 ID·revision 등 원래 상태 값이 결과에 포함되지 않음을 확인한다.
  assert.deepEqual(probe.applied(target), { outcome: "applied", elapsedMs: 499, firstOpenMs: 0 });
});

test("너무 이른 타이머는 결론을 내지 않고 정확한 마감에는 실패한다", () => {
  const { probe, advance } = setup();
  advance(499);
  assert.equal(probe.deadline(), null);
  advance(1);
  assert.deepEqual(probe.deadline(), { outcome: "deadline", elapsedMs: 500, firstOpenMs: null });
});

test("마감 타이머가 늦어도 예산을 넘긴 상태는 합격하지 않는다", () => {
  for (const duration of [500, 580]) {
    const { probe, advance } = setup();
    probe.opened();
    advance(duration);
    assert.deepEqual(probe.applied(target), { outcome: "deadline", elapsedMs: duration, firstOpenMs: 0 });
  }
});

test("연결 종료는 마감과 구분하고 이미 마감을 넘겼으면 마감으로 센다", () => {
  const early = setup();
  early.advance(80);
  assert.deepEqual(early.probe.stopped(), { outcome: "closed", elapsedMs: 80, firstOpenMs: null });
  const late = setup();
  late.advance(510);
  assert.deepEqual(late.probe.stopped(), { outcome: "deadline", elapsedMs: 510, firstOpenMs: null });
});

test("어떤 결과로 끝났든 늦게 온 신호로 다시 보고하지 않는다", () => {
  for (const finish of ["applied", "deadline", "stopped"]) {
    const { probe, advance } = setup();
    if (finish === "deadline") advance(500);
    assert.notEqual(probe[finish](target), null);
    advance(1_000);
    probe.opened();
    assert.equal(probe.applied(target), null);
    assert.equal(probe.deadline(), null);
    assert.equal(probe.stopped(), null);
  }
});
