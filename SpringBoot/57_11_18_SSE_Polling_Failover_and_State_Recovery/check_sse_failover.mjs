import assert from "node:assert/strict"; // 전이 결과뿐 아니라 무시된 입력의 객체 동일성도 확인한다.
import { readFileSync } from "node:fs"; // 설명과 다른 복제 코드를 시험하지 않는다.
import test from "node:test"; // 네트워크·패키지·실제 대기 없이 실행한다.

const note = readFileSync(new URL("./11_18_SSE_Polling_Failover_and_State_Recovery.md", import.meta.url), "utf8");
const blocks = [...note.matchAll(/^```javascript\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
assert.equal(blocks.length, 1, "실행할 JavaScript 펜스는 하나여야 한다.");
const url = "data:text/javascript;base64," + Buffer.from(blocks[0][1], "utf8").toString("base64");
const { startWatch, reduceWatch } = await import(url);

const id = "upload-1"; // 테스트용 ID이며 서버의 UUID 파싱을 재현하지 않는다.
const snapshot = (revision, state = "SCANNING") => ({ id, state, revision });
const input = (model, type, at, value, generation = model.generation) =>
  reduceWatch(model, { type, at, generation, value });
const first = () => startWatch(id, 0, 30_000);
const stream = () => input(first(), "stream-state", 10, snapshot("8"));
const fallback = () => input(stream(), "stream-failed", 100);
const recovering = () => input(fallback(), "poll-state", 30_100, snapshot("10"));

test("연결 열림만으로 성공하지 않고 마감 전에 유효한 상태를 받아야 한다", () => {
  const started = first();
  assert.equal(input(started, "open", 10), started);
  assert.equal(input(started, "probe-timeout", 4_999), started);
  const ready = input(started, "stream-state", 4_999, snapshot("8"));
  assert.equal(ready.mode, "sse");
  assert.equal(ready.generation, started.generation); // 이미 연결된 EventSource를 그대로 쓴다.
  assert.equal(ready.deadline, null);
});

test("기한이 되면 최초 SSE를 닫고 폴링에 새 세대를 부여한다", () => {
  const poll = input(first(), "probe-timeout", 5_000);
  assert.equal(poll.mode, "poll");
  assert.equal(poll.generation, 2);
  assert.equal(poll.snapshot, null); // 아직 확인하지 않은 업무 상태를 만들지 않는다.
  assert.equal(poll.retryAt, 35_000);
});

test("SSE 실패는 마지막 상태를 보존하며 업무 실패로 바꾸지 않는다", () => {
  const poll = fallback();
  assert.equal(poll.mode, "poll");
  assert.equal(poll.reason, "stream");
  assert.deepEqual(poll.snapshot, snapshot("8"));
  assert.equal(poll.verifiedAt, 10); // 실패 시각을 마지막 상태 확인 시각으로 바꾸지 않는다.
});

test("이전 세대의 더 큰 revision·권한 오류·타이머도 현재 화면을 바꾸지 못한다", () => {
  const poll = fallback();
  const updated = input(poll, "poll-state", 200, snapshot("10", "READY"));
  assert.equal(input(updated, "stream-state", 210, snapshot("11"), 1), updated);
  assert.equal(input(updated, "access-lost", 220, null, 1), updated);
  assert.equal(input(updated, "probe-timeout", 5_000, null, 1), updated);
});

test("폴링 쿨다운이 끝나기 전에는 현재 상태를 갱신하고 연결 방식은 유지한다", () => {
  const poll = fallback();
  const updated = input(poll, "poll-state", 30_099, snapshot("10", "READY"));
  assert.equal(updated.mode, "poll");
  assert.equal(updated.generation, poll.generation);
  assert.equal(updated.snapshot.revision, "10");
  assert.equal(updated.verifiedAt, 30_099);
});

test("쿨다운 뒤라도 뒤처진 GET으로 복귀를 시작하지 않는다", () => {
  const current = input(fallback(), "poll-state", 200, snapshot("10", "READY"));
  assert.equal(input(current, "poll-state", 30_100, snapshot("9")), current);
  const probe = input(current, "poll-state", 30_101, snapshot("10", "READY"));
  assert.equal(probe.mode, "probe"); // 같은 상태의 새 응답도 전송 경로의 증거가 된다.
  assert.equal(probe.generation, 3);
  assert.equal(probe.snapshot.revision, "10");
});

test("복귀 중 늦은 폴링이나 낮은 SSE revision은 무시하고 같은 SSE 상태는 수락한다", () => {
  const probe = recovering();
  assert.equal(input(probe, "poll-state", 30_101, snapshot("12"), 2), probe);
  assert.equal(input(probe, "stream-state", 30_102, snapshot("9")), probe);
  const live = input(probe, "stream-state", 30_103, snapshot("10"));
  assert.equal(live.mode, "sse");
  assert.equal(live.generation, probe.generation);
  assert.equal(live.verifiedAt, 30_103);
  assert.equal(input(live, "probe-timeout", 35_100), live); // 취소 직전 큐에 있던 타이머도 무효다.
});

test("마감과 정확히 같은 시점의 응답은 늦게 실행된 타이머보다 먼저 와도 실패한다", () => {
  const probe = recovering();
  const poll = input(probe, "stream-state", probe.deadline, snapshot("11", "READY"));
  assert.equal(poll.mode, "poll");
  assert.equal(poll.reason, "probe-timeout");
  assert.equal(poll.snapshot.revision, "10");
  assert.equal(poll.retryAt, probe.deadline + 30_000);
});

test("같은 revision의 상충하는 상태는 방식을 바꾸거나 오류로 멈추며 적용하지 않는다", () => {
  const poll = input(stream(), "stream-state", 20, snapshot("8", "READY"));
  assert.equal(poll.mode, "poll");
  assert.equal(poll.reason, "protocol");
  const stopped = input(poll, "poll-state", 21, snapshot("8", "READY"));
  assert.equal(stopped.mode, "stopped");
  assert.deepEqual(stopped.snapshot, snapshot("8")); // 오류 후 마지막 확인값으로만 표시할 수 있다.
});

test("다른 ID·알 수 없는 상태·잘못된 번호 형식을 계약 오류로 분류한다", () => {
  for (const bad of [{ ...snapshot("9"), id: "other" }, snapshot("9", "UNKNOWN"),
    snapshot("01"), snapshot("9\n"), snapshot("9223372036854775808"), snapshot(9), null]) {
    const result = input(fallback(), "poll-state", 200, bad);
    assert.equal(result.mode, "stopped");
    assert.equal(result.reason, "protocol");
  }
});

test("권한 상실과 화면 이탈은 상태를 지우고 종료 뒤 늦은 값도 반영하지 않는다", () => {
  for (const type of ["access-lost", "leave"]) {
    const poll = fallback();
    const stopped = input(poll, type, 200);
    assert.equal(stopped.mode, "stopped");
    assert.equal(stopped.snapshot, null);
    assert.equal(stopped.verifiedAt, null);
    assert.equal(input(stopped, "poll-state", 201, snapshot("12")), stopped);
  }
});

test("큰 정수 비교는 정확하며 폴링 예산 소진은 마지막 확인값만 남긴다", () => {
  const poll = input(fallback(), "poll-state", 200, snapshot("9007199254740993"));
  assert.equal(input(poll, "poll-state", 201, snapshot("9007199254740992")), poll);
  const stopped = input(poll, "poll-exhausted", 300);
  assert.equal(stopped.mode, "stopped");
  assert.equal(stopped.reason, "budget");
  assert.equal(stopped.snapshot.revision, "9007199254740993");
  assert.equal(stopped.verifiedAt, 200);
  assert.equal(input(stopped, "leave", 301).snapshot, null); // 이미 멈췄어도 화면을 떠나면 표시값은 지운다.
});
