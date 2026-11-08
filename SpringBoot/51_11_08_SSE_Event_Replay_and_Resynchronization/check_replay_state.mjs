import assert from "node:assert/strict"; // 결과의 종류와 모델 값까지 정확히 비교한다.
import { readFileSync } from "node:fs"; // 문서의 예제를 읽어 검사 대상 코드와 설명을 한곳에 둔다.
import test from "node:test"; // 외부 패키지 없이 Node의 테스트 실행기를 사용한다.

const note = readFileSync(new URL("./11_08_SSE_Event_Replay_and_Resynchronization.md", import.meta.url), "utf8");
const fences = [...note.matchAll(/^```javascript\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
assert.equal(fences.length, 1, "회귀 검사 대상 JavaScript 펜스는 하나여야 한다.");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(fences[0][1], "utf8").toString("base64");
const { readSnapshot, decideReplay } = await import(moduleUrl); // 임시 파일 없이 문서의 코드를 실행한다.

const id = "00000000-0000-0000-0000-000000000051"; // 이 화면에서 선택한 업로드다.
const other = "00000000-0000-0000-0000-000000000052"; // 번호가 같아도 다른 스트림이다.
const snapshot = (revision, state = "SCANNING", uploadId = id) => ({ id: uploadId, state, revision });
const current = Object.freeze(snapshot("8")); // 잘못된 프레임이 기존 상태를 바꾸면 테스트가 실패한다.
const frame = (name, next, from = current) =>
  decideReplay(from, name, next.id + ":" + next.revision, JSON.stringify(next));

test("GET 스냅샷에서 화면에 필요한 필드만 선택한다", () => {
  const raw = { ...current, objectKey: "unused" }; // 추가 필드가 있어도 화면 모델에 보관하지 않는다.
  assert.deepEqual(readSnapshot(raw, id), current);
  assert.equal(readSnapshot(snapshot("8", "SCANNING", other), id), null);
});

test("9번의 재검사 대기 상태가 8번 검사 중 뒤에 이어진다", () => {
  const next = snapshot("9", "QUARANTINED"); // 상태 이름이 이전 단계로 돌아가도 새 전이다.
  assert.deepEqual(frame("transition", next), { kind: "append", next });
});

test("같은 8번을 다시 받은 경우 이력을 추가하지 않는다", () => {
  assert.deepEqual(frame("transition", current), { kind: "ignore" });
});

test("늦게 온 과거 READY가 현재 화면을 덮지 않는다", () => {
  assert.deepEqual(frame("transition", snapshot("7", "READY")), { kind: "ignore" });
});

test("8번 뒤 일반 11번은 누락으로 분류하고 모델을 건너뛰지 않는다", () => {
  assert.deepEqual(frame("transition", snapshot("11", "READY")), { kind: "gap" });
  assert.deepEqual(current, snapshot("8")); // 실패 결과에 새로운 상태가 없고 기존 상태도 유지된다.
});

test("8번 뒤 reset 11번은 현재 스냅샷을 새 기준점으로 삼는다", () => {
  const next = snapshot("11", "READY");
  assert.deepEqual(frame("reset", next), { kind: "replace", next });
  // reset 이후에는 같은 번호의 재전송과 다음 전이를 새 기준점으로 판단한다.
  assert.deepEqual(frame("reset", next, next), { kind: "ignore" });
  const deletion = snapshot("12", "DELETE_PENDING");
  assert.deepEqual(frame("transition", deletion, next), { kind: "append", next: deletion });
});

test("과거 reset은 최신 스냅샷을 되돌리지 않는다", () => {
  assert.deepEqual(frame("reset", snapshot("7", "READY")), { kind: "ignore" });
});

test("다른 업로드의 본문과 그에 맞는 커서가 와도 거절한다", () => {
  assert.deepEqual(frame("transition", snapshot("9", "READY", other)), { kind: "invalid" });
});

test("전송 커서가 본문 revision과 다르거나 비면 거절한다", () => {
  const data = JSON.stringify(snapshot("9"));
  assert.deepEqual(decideReplay(current, "reset", id + ":10", data), { kind: "invalid" });
  assert.deepEqual(decideReplay(current, "transition", "", data), { kind: "invalid" });
});

test("깨진 JSON·알 수 없는 상태·이름을 각각 거절한다", () => {
  assert.deepEqual(decideReplay(current, "transition", id + ":9", "{"), { kind: "invalid" });
  assert.deepEqual(frame("transition", snapshot("9", "UNKNOWN")), { kind: "invalid" });
  assert.deepEqual(frame("heartbeat", snapshot("9")), { kind: "invalid" });
});

test("문자열 정수 계약을 어긴 값은 GET과 SSE 양쪽에서 거절한다", () => {
  for (const rev of [9, "-9", "+9", "09", "9\n", " 9", "9.0", "9223372036854775808"]) {
    const raw = snapshot(rev); // 숫자 타입, 부호, 포맷, bigint 상한 초과를 모두 시험한다.
    assert.equal(readSnapshot(raw, id), null);
    assert.deepEqual(frame("transition", raw), { kind: "invalid" });
  }
});

test("JavaScript 안전 정수 범위 너머에서도 한 칸 차이를 구별한다", () => {
  const from = snapshot("9007199254740992"); // Number 변환 시 다음 번호와 같아질 수 있다.
  const next = snapshot("9007199254740993");
  assert.deepEqual(frame("transition", next, from), { kind: "append", next });
});

test("최초 위치 0과 PostgreSQL bigint 최댓값을 허용한다", () => {
  const initial = snapshot("0", "RECEIVING");
  const max = snapshot("9223372036854775807", "READY");
  assert.deepEqual(readSnapshot(initial, id), initial);
  assert.deepEqual(frame("transition", max, snapshot("9223372036854775806")), { kind: "append", next: max });
});
