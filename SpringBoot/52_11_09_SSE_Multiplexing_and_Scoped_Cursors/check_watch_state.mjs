import assert from "node:assert/strict"; // 판단 종류와 전체 모델의 값을 정확히 비교한다.
import { readFileSync } from "node:fs"; // 설명에 실린 모듈을 그대로 검사한다.
import test from "node:test"; // 별도 서버나 패키지가 필요 없는 테스트 실행기다.

const note = readFileSync(new URL("./11_09_SSE_Multiplexing_and_Scoped_Cursors.md", import.meta.url), "utf8");
const fences = [...note.matchAll(/^```javascript\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
assert.equal(fences.length, 1, "검사할 JavaScript 펜스는 하나여야 한다.");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(fences[0][1], "utf8").toString("base64");
const { startWatch, cursorOf, decideWatchFrame } = await import(moduleUrl); // 임시 파일을 만들지 않는다.

const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const C = "00000000-0000-0000-0000-000000000003"; // 이 watch에 포함되지 않은 업로드다.
const watchId = "00000000-0000-0000-0000-000000000052";
const previousWatch = "00000000-0000-0000-0000-000000000051";
const item = (id, revision, state = "SCANNING") => ({ id, state, revision });
const a8 = item(A, "8");
const b3 = item(B, "3");
const initial = { watchId, items: [a8, b3] };
const model = startWatch(initial, [A, B]);
model.items.forEach(Object.freeze); // 실패한 프레임뿐 아니라 정상 적용도 기존 모델을 바꾸지 않아야 한다.
Object.freeze(model.items);
Object.freeze(model);

const key = (a, b, scope = watchId) => ["v1", scope, a, b].join(".");
const frame = (name, id, snapshot, from = model) =>
  decideWatchFrame(from, name, id, JSON.stringify(snapshot));

test("초기 화면은 요청 배열을 바꾸지 않고 표준 순서로 슬롯을 만든다", () => {
  const reversed = [B, A]; // 서버의 결과 순서와 화면이 선택한 순서는 달라도 된다.
  assert.deepEqual(startWatch(initial, reversed), model);
  assert.deepEqual(reversed, [B, A]);
  assert.equal(cursorOf(model), key("8", "3"));
});

test("중복 대상·과다 대상·누락·순서가 다른 초기 응답을 거절한다", () => {
  assert.equal(startWatch(initial, [A, A]), null);
  assert.equal(startWatch(initial, Array(9).fill(A)), null);
  assert.equal(startWatch({ watchId, items: [a8] }, [A, B]), null);
  assert.equal(startWatch({ watchId, items: [b3, a8] }, [A, B]), null);
});

test("A:9와 B:4는 각각 한 슬롯씩 진행한다", () => {
  const a9 = item(A, "9", "QUARANTINED");
  const b4 = item(B, "4", "READY");
  const first = frame("transition", key("9", "3"), a9);
  assert.equal(first.kind, "append");
  assert.equal(first.slot, 0);
  assert.equal(cursorOf(first.model), key("9", "3")); // A만 받았을 때 B:4는 여전히 필요하다.
  const second = frame("transition", key("9", "4"), b4, first.model);
  assert.equal(second.kind, "append");
  assert.equal(second.slot, 1);
  assert.deepEqual(second.model.items, [a9, b4]);
  assert.equal(cursorOf(model), key("8", "3")); // 기존 모델은 변하지 않았다.
});

test("A의 reset 뒤에도 B는 기존 위치 다음부터 재생한다", () => {
  const a12 = item(A, "12", "READY");
  const reset = frame("reset", key("12", "3"), a12);
  assert.deepEqual(reset, { kind: "replace", slot: 0, model: { watchId, items: [a12, b3] } });
  assert.equal(reset.model.items[1], model.items[1]); // B는 스냅샷과 위치가 그대로다.
  assert.equal(frame("transition", key("12", "4"), item(B, "4"), reset.model).kind, "append");
});

test("전체 벡터가 과거인 전이와 reset은 무시한다", () => {
  assert.deepEqual(frame("transition", key("8", "3"), a8), { kind: "ignore" });
  assert.deepEqual(frame("reset", key("7", "2"), item(A, "7", "READY")), { kind: "ignore" });
});

test("A가 중복이더라도 벡터가 미적용 B를 포함하면 복구한다", () => {
  assert.deepEqual(frame("transition", key("8", "4"), a8), { kind: "gap" });
});

test("A 프레임이 B 위치를 앞으로 보내거나 뒤로 되돌리면 거절한다", () => {
  const a9 = item(A, "9");
  assert.deepEqual(frame("transition", key("9", "4"), a9), { kind: "gap" });
  assert.deepEqual(frame("transition", key("9", "2"), a9), { kind: "gap" });
  assert.deepEqual(frame("reset", key("12", "4"), item(A, "12")), { kind: "gap" });
});

test("일반 전이 한 건이 자기 슬롯의 중간 번호를 건너뛰지 않는다", () => {
  assert.deepEqual(frame("transition", key("10", "3"), item(A, "10")), { kind: "gap" });
  assert.equal(cursorOf(model), key("8", "3"));
});

test("다른 watch의 커서와 지원하지 않는 버전은 적용하지 않는다", () => {
  assert.deepEqual(frame("transition", key("9", "3", previousWatch), item(A, "9")), { kind: "invalid" });
  assert.deepEqual(frame("transition", "v2." + watchId + ".9.3", item(A, "9")), { kind: "invalid" });
});

test("관찰 대상에 없는 업로드의 스냅샷은 적용하지 않는다", () => {
  assert.deepEqual(frame("transition", key("9", "3"), item(C, "9")), { kind: "invalid" });
});

test("SSE ID의 슬롯 위치와 본문 revision이 달라서는 안 된다", () => {
  assert.deepEqual(frame("transition", key("8", "4"), item(A, "9")), { kind: "invalid" });
});

test("슬롯 수·빈 자리·비정규화 숫자·범위 초과를 거절한다", () => {
  for (const bad of ["9", "9.3.4", "9.", "09.3", "9.-3", "9.3\n", "9223372036854775808.3"]) {
    assert.deepEqual(frame("transition", "v1." + watchId + "." + bad, item(A, "9")), { kind: "invalid" });
  }
});

test("안전 정수 범위를 넘는 연속 revision과 bigint 상한을 보존한다", () => {
  const large = startWatch({ watchId, items: [item(A, "9223372036854775806"), b3] }, [A, B]);
  const top = "9223372036854775807";
  const result = frame("transition", key(top, "3"), item(A, top), large);
  assert.equal(result.kind, "append");
  assert.equal(cursorOf(result.model), key(top, "3"));
});

test("알 수 없는 이벤트 이름·상태와 깨진 JSON은 적용하지 않는다", () => {
  assert.deepEqual(frame("notice", key("9", "3"), item(A, "9")), { kind: "invalid" });
  assert.deepEqual(frame("transition", key("9", "3"), item(A, "9", "UNKNOWN")), { kind: "invalid" });
  assert.deepEqual(decideWatchFrame(model, "transition", key("9", "3"), "{"), { kind: "invalid" });
});
