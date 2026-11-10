import assert from "node:assert/strict"; // 응답 상태, 헤더, 이벤트 순서를 정확히 비교한다.
import { once } from "node:events"; // 서버가 실제로 포트를 열 때까지 기다린다.
import { createServer } from "node:http"; // 가짜 객체 대신 로컬 HTTP 소켓을 사용한다.
import test from "node:test"; // 각 시나리오에 독립된 서버와 실패 시간 한도를 둔다.

if (typeof EventSource !== "function") throw new Error("Node.js 24에서 --experimental-eventsource를 켜세요.");
const timeout = 8_000; // 지연을 만드는 sleep이 아니라, 신호가 오지 않을 때 실패하는 상한이다.
const watch = "00000000-0000-0000-0000-000000000053";
const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const cursor = (a, b) => ["v1", watch, a, b].join("."); // 52번 노트처럼 한 ID에 두 위치를 담는다.
const initial = cursor(8, 3);
const afterA = cursor(9, 3);
const afterB = cursor(9, 4);
const headers = { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" };

function frame(id, revision, state, eventId) {
  const body = JSON.stringify({ id, state, revision }); // 공개 DTO의 필드만 한 줄 JSON으로 보낸다.
  return "event: transition\nid: " + eventId + "\ndata: " + body + "\n\n"; // 빈 줄이 프레임을 완성한다.
}

const aFrame = frame(A, "9", "SCANNING", afterA);
const bFrame = frame(B, "4", "READY", afterB);

async function serve(t, handler) {
  const errors = []; // 비동기 요청 처리 실패를 테스트 실패로 드러낸다.
  const server = createServer((req, res) => {
    Promise.resolve().then(() => handler(req, res)).catch(error => {
      errors.push(error);
      res.destroy(); // 오류가 나면 클라이언트를 무한 대기시키지 않는다.
    });
  });
  server.listen(0, "127.0.0.1"); // 이 PC 내부에서만 접근할 수 있는 임시 포트를 OS에 요청한다.
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve()); // 새 연결을 먼저 막는다.
      server.closeAllConnections(); // 실패한 시험이 남긴 활성 소켓도 이 실습 서버에서만 닫는다.
    });
    assert.deepEqual(errors, [], "서버 내부 처리 오류가 없어야 한다.");
  });
  return "http://127.0.0.1:" + server.address().port;
}

function subscribe(t, url, receive) {
  const source = new EventSource(url); // 헤더를 시험 코드가 대리 생성하지 않는다.
  source.addEventListener("transition", receive);
  const close = () => source.close(); // 자동 재연결과 현재 요청을 모두 종료한다.
  t.signal.addEventListener("abort", close, { once: true });
  t.after(() => {
    t.signal.removeEventListener("abort", close);
    close(); // 단언에 실패해도 재연결 타이머를 남기지 않는다.
  });
  return source;
}

function observeClose(res, active, closed) {
  active.add(res); // 실습용 활성 연결 집합이다.
  res.once("close", () => {
    active.delete(res); // 정상 종료와 클라이언트 취소 모두에서 등록을 정리한다.
    closed.resolve();
  });
}

for (const partial of [false, true]) {
  const name = partial ? "불완전한 B 프레임은 재연결 위치를 전진시키지 않는다" : "재연결 헤더는 최초 쿼리보다 우선한다";
  test(name, { timeout }, async t => {
    const requests = [];
    const delivered = [];
    const resumed = Promise.withResolvers(); // 두 번째 요청이 실제 도착했다는 신호다.
    const receivedB = Promise.withResolvers(); // B를 네트워크에서 수신했다는 별도 신호다.

    const origin = await serve(t, (req, res) => {
      const query = new URL(req.url, "http://127.0.0.1").searchParams.get("after");
      const header = req.headers["last-event-id"];
      requests.push({ query, header });
      if (requests.length === 1) {
        res.writeHead(200, headers);
        res.write("retry: 20\n\n" + aFrame); // 실습에만 짧은 재연결 간격을 쓴다.
        res.end(partial ? bFrame.slice(0, -1) : undefined); // B의 마지막 빈 줄이 없는 HTTP 본문을 만든다.
        return;
      }

      resumed.resolve();
      const effective = header ?? query; // 자동 재연결이면 이전 URL보다 헤더를 사용한다.
      res.writeHead(200, headers);
      res.write(effective === afterA ? bFrame : aFrame); // 잘못된 커서는 중복 A를 보내도록 관측 가능하게 만든다.
    });

    const source = subscribe(t, origin + "/events?" + new URLSearchParams({ after: initial }), event => {
      delivered.push({ cursor: event.lastEventId, data: JSON.parse(event.data) });
      if (event.lastEventId === afterB) receivedB.resolve();
    });
    await resumed.promise; // 단순히 일정 시간이 흘렀다는 이유로 재연결을 가정하지 않는다.
    assert.deepEqual(requests, [{ query: initial, header: undefined }, { query: initial, header: afterA }]);
    await receivedB.promise;
    source.close();
    assert.deepEqual(delivered, [
      { cursor: afterA, data: { id: A, state: "SCANNING", revision: "9" } },
      { cursor: afterB, data: { id: B, state: "READY", revision: "4" } },
    ]); // B가 빠지거나, 끊기기 전 불완전한 B까지 적용되면 실패한다.
  });
}

test("열린 연결의 권한 철회는 대기 중인 B를 차단하고 재접속을 거절한다", { timeout }, async t => {
  let allowed = true; // 실제 계정 대신 이 실습의 가시 범위를 나타낸다.
  const active = new Set();
  const beforeSend = Promise.withResolvers(); // 이벤트 준비와 실제 전송 사이를 제어한다.
  const closed = Promise.withResolvers();
  const origin = await serve(t, async (_req, res) => {
    if (!allowed) {
      res.writeHead(404).end(); // SSE 응답을 열기 전에는 상태 코드로 거절할 수 있다.
      return;
    }
    observeClose(res, active, closed);
    res.writeHead(200, headers);
    res.write(aFrame); // 응답이 열려 200이 확정되게 한다.
    await beforeSend.promise;
    if (res.destroyed) return; // 실패로 이미 연결이 닫혔으면 더 쓰지 않는다.
    res.end(allowed ? bFrame : undefined); // 쓰기 직전에 권한을 다시 확인한다.
  });
  t.after(() => beforeSend.resolve()); // 실패 시에도 서버 쪽 대기를 풀어 준다.

  const response = await fetch(origin + "/events", { signal: t.signal });
  assert.equal(response.status, 200);
  assert.equal(active.size, 1);
  allowed = false; // 먼저 연결이 열린 것을 확인한 뒤 권한을 철회한다.
  beforeSend.resolve();
  assert.equal(await response.text(), aFrame); // 200은 그대로지만 B 본문과 커서는 노출되지 않는다.
  await closed.promise;
  assert.equal(active.size, 0);

  const reconnect = await fetch(origin + "/events", {
    headers: { "Last-Event-ID": afterA }, signal: t.signal,
  });
  assert.equal(reconnect.status, 404);
  assert.equal(await reconnect.text(), ""); // 예전 커서는 더 이상 상태 조회 권한이 아니다.
});

test("클라이언트가 닫으면 서버의 활성 연결이 정리된다", { timeout }, async t => {
  const active = new Set();
  const closed = Promise.withResolvers();
  const firstEvent = Promise.withResolvers();
  const origin = await serve(t, (_req, res) => {
    observeClose(res, active, closed);
    res.writeHead(200, headers);
    res.write(aFrame); // 서버가 먼저 종료하지 않는다.
  });
  const source = subscribe(t, origin + "/events", firstEvent.resolve);
  assert.equal((await firstEvent.promise).lastEventId, afterA);
  assert.equal(active.size, 1);
  source.close(); // 화면 이동에 해당하는 실제 요청 취소를 발생시킨다.
  await closed.promise;
  assert.equal(active.size, 0); // 테스트 서버 강제 종료 전에 정상 정리됐는지 확인한다.
});

for (const buffered of [false, true]) {
  const name = buffered ? "버퍼형 중계는 원본이 끝날 때까지 첫 프레임을 보류한다" : "즉시 중계는 원본이 열려 있는 동안 첫 프레임을 보낸다";
  test(name, { timeout }, async t => {
    const finishOrigin = Promise.withResolvers();
    const firstChunk = Promise.withResolvers();
    const arrived = Promise.withResolvers();
    let originEnded = false;
    let proxyResponse;

    const origin = await serve(t, async (_req, res) => {
      res.writeHead(200, headers);
      res.write(aFrame); // 프록시가 중계할 첫 이벤트를 먼저 쓴다.
      await finishOrigin.promise; // 관찰 지점에 도달하기 전에는 응답을 끝내지 않는다.
      originEnded = true;
      if (!res.destroyed) res.end();
    });
    t.after(() => finishOrigin.resolve());

    const proxy = await serve(t, async (_req, res) => {
      proxyResponse = res;
      const abort = new AbortController();
      res.once("close", () => abort.abort()); // 클라이언트가 떠나면 원본 읽기도 끝낸다.
      try {
        const upstream = await fetch(origin, { signal: abort.signal });
        assert.equal(upstream.status, 200);
        const reader = upstream.body.getReader();
        const held = []; // 입력은 이 시험의 작은 프레임 하나뿐이다. 일반 목적 프록시가 아니다.
        if (!buffered) res.writeHead(200, headers);
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (buffered) held.push(value);
          else res.write(value); // 수신한 바이트를 응답 종료 전에 전달한다.
          firstChunk.resolve(); // 원본을 읽었다는 사실과 클라이언트 수신을 분리해 관찰한다.
        }
        if (buffered) res.writeHead(200, headers);
        res.end(buffered ? Buffer.concat(held) : undefined); // 보류 모드는 원본 종료 뒤에만 전송한다.
      } catch (error) {
        if (!abort.signal.aborted) throw error; // 클라이언트 취소 이외의 오류를 숨기지 않는다.
      }
    });

    const source = subscribe(t, proxy + "/events", arrived.resolve);
    await firstChunk.promise;
    if (buffered) {
      assert.equal(proxyResponse.headersSent, false); // 원본 바이트가 있어도 아직 응답을 보내지 않았다.
      assert.equal(originEnded, false);
      finishOrigin.resolve();
    }
    const event = await arrived.promise;
    assert.equal(event.lastEventId, afterA);
    assert.equal(originEnded, buffered); // 이벤트 도착과 원본 종료 중 무엇이 먼저였는지 검증한다.
    source.close();
    finishOrigin.resolve(); // 즉시 중계 시험도 관찰이 끝난 후 원본을 종료한다.
  });
}
