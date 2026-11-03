// Node.js 24+: node SpringBoot/50_11_03_Async_Status_Polling_and_SSE/check_status_client.mjs
// No network or real EventSource is used. Type stripping is not static type checking.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const note = await readFile(new URL("./11_03_Async_Status_Polling_and_SSE.md", import.meta.url), "utf8");
const block = note.match(/```typescript\r?\n([\s\S]*?)\r?\n```/);
assert.ok(block, "documented TypeScript helper not found");
const source = stripTypeScriptTypes(block[1], { mode: "strip" }); // 문서의 코드를 그대로 실행한다.
const client = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const { parseSnapshot, SnapshotGate, startPolling, watchSse, pause } = client;
const id = "00000000-0000-0000-0000-000000000050";
const snapshot = (revision, state = "SCANNING") => ({ id, state, revision: String(revision) });
const response = value => new Response(JSON.stringify(value), {
  headers: { "Content-Type": "application/json" },
});
let passed = 0;
async function test(name, run) {
  await run();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

class FakeEventSource {
  readyState = 1;
  closes = 0;
  onerror = null;
  listeners = new Map();
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  close() { this.closes += 1; this.readyState = 2; }
  emit(value) { this.listeners.get("snapshot")?.({ data: JSON.stringify(value) }); }
  error() { this.onerror?.(); } // 브라우저 재연결 자체가 아니라 오류 콜백 정책만 시험한다.
}

await test("large revision remains an exact decimal string", () => {
  assert.equal(parseSnapshot(snapshot("9223372036854775807"), id).revision, "9223372036854775807");
});

await test("reject invalid snapshot contracts", () => {
  for (const bad of [null, { ...snapshot(1), id: "other" }, snapshot(1, "UNKNOWN"),
    { ...snapshot(1), revision: 1 }, snapshot("01"), snapshot("1\n"), snapshot("9223372036854775808")]) {
    assert.throws(() => parseSnapshot(bad, id));
  }
});

await test("gate rejects duplicate and older snapshots", () => {
  const gate = new SnapshotGate(id);
  assert.equal(gate.accept(snapshot(10)), true);
  assert.equal(gate.accept(snapshot(10)), false);
  assert.equal(gate.accept(snapshot(9, "READY")), false);
});

await test("newer retry state is not rejected by state name", () => {
  const gate = new SnapshotGate(id);
  assert.equal(gate.accept(snapshot(8, "SCANNING")), true);
  assert.equal(gate.accept(snapshot(9, "QUARANTINED")), true);
});

await test("polls sequentially and ignores an old terminal response", async () => {
  const values = [snapshot(9), snapshot(8, "READY"), snapshot(10, "READY")];
  const rendered = [];
  let calls = 0, active = 0, maxActive = 0, waits = 0;
  const transport = async (url, options) => {
    assert.equal(url, `/uploads/${id}/status`);
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    maxActive = Math.max(maxActive, ++active);
    await Promise.resolve(); // 비동기 요청이 겹치면 active가 증가하도록 한다.
    active -= 1;
    return response(values[calls++]);
  };
  const watcher = startPolling(id, value => rendered.push(value.revision),
    error => { throw error; }, transport, async () => { waits += 1; });
  await watcher.finished;
  assert.deepEqual(rendered, ["9", "10"]);
  assert.equal(calls, 3);
  assert.equal(waits, 2);
  assert.equal(maxActive, 1);
});

await test("HTTP authorization failure stops without inventing a job state", async () => {
  const errors = [], rendered = [];
  let calls = 0;
  const watcher = startPolling(id, value => rendered.push(value), error => errors.push(error),
    async () => { calls += 1; return new Response(null, { status: 401 }); });
  await watcher.finished;
  assert.equal(errors.length, 1);
  assert.equal(calls, 1);
  assert.deepEqual(rendered, []);
});

await test("view cancellation ignores a transport that resolves late", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const rendered = [], errors = [];
  const watcher = startPolling(id, value => rendered.push(value), error => errors.push(error),
    () => pending); // 취소 신호를 무시하는 대역으로 늦은 완료를 재현한다.
  watcher.stop();
  release(response(snapshot(10, "READY")));
  await watcher.finished;
  assert.deepEqual(rendered, []);
  assert.deepEqual(errors, []);
});

await test("SSE ignores old READY and closes only for the latest READY", () => {
  const source = new FakeEventSource();
  const rendered = [];
  let unavailable = 0;
  const stop = watchSse(id, value => rendered.push(value.revision),
    () => { unavailable += 1; }, () => source);
  try {
    source.emit(snapshot(9));
    source.emit(snapshot(8, "READY"));
    assert.equal(source.closes, 0);
    source.emit(snapshot(10, "READY"));
    assert.deepEqual(rendered, ["9", "10"]);
    assert.equal(source.closes, 1);
    assert.equal(unavailable, 0);
  } finally { stop(); }
});

await test("invalid SSE data closes the connection once", () => {
  const source = new FakeEventSource();
  let unavailable = 0;
  const stop = watchSse(id, () => assert.fail("must not render"),
    () => { unavailable += 1; }, () => source);
  try {
    source.emit({ ...snapshot(1), id: "other" });
    source.emit({ ...snapshot(2), id: "other" });
    assert.equal(unavailable, 1);
    assert.equal(source.closes, 1);
  } finally { stop(); }
});

await test("SSE error budget is bounded", () => {
  const source = new FakeEventSource();
  let unavailable = 0;
  const stop = watchSse(id, () => {}, () => { unavailable += 1; }, () => source);
  try {
    source.error(); source.error();
    assert.equal(source.closes, 0);
    source.error(); source.error();
    assert.equal(source.closes, 1);
    assert.equal(unavailable, 1);
  } finally { stop(); }
});

await test("manual SSE cleanup ignores subsequent callbacks", () => {
  const source = new FakeEventSource();
  let rendered = 0, unavailable = 0;
  const stop = watchSse(id, () => { rendered += 1; },
    () => { unavailable += 1; }, () => source);
  stop(); stop();
  source.emit(snapshot(1)); source.error();
  assert.equal(source.closes, 1);
  assert.equal(rendered, 0);
  assert.equal(unavailable, 0);
});

await test("abortable delay releases its timer", async () => {
  const controller = new AbortController();
  const waiting = pause(controller.signal);
  controller.abort();
  await assert.rejects(waiting, error => error.name === "AbortError");
});

assert.equal(passed, 12);
process.stdout.write(`OK ${passed} client checks; no real HTTP or EventSource was used.\n`);
