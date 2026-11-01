// Run from repository root with Node.js 24+: node SpringBoot/48_11_01_S3_Multipart_Upload_and_Resume/check_client.mjs
// This tests the documented helper with fake responses, not a browser, IAM, CORS, or real S3.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const noteUrl = new URL("./11_01_S3_Multipart_Upload_and_Resume.md", import.meta.url);
const note = await readFile(noteUrl, "utf8"); // 저장한 노트에서 실행할 코드를 직접 읽는다.
const block = note.match(/```typescript\r?\n([\s\S]*?)\r?\n```/);
assert.ok(block, "documented TypeScript helper not found");
const javascript = stripTypeScriptTypes(block[1], { mode: "strip" }); // 타입 제거이며 타입 검사가 아니다.
const helper = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));
const { preparePart, putPreparedPart } = helper;

let passed = 0;
async function test(name, verify) {
  await verify(); // 실패하면 즉시 중단하여 통과 결과와 혼동하지 않는다.
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

const origin = "https://fixture-bucket.s3.ap-northeast-2.amazonaws.com"; // 테스트 전용 주소이며 요청하지 않는다.
const file = new File(["hello"], "memo.bin");
const part = await preparePart(file, { partNumber: 1, offset: 0, bytes: 5 });
const sha256 = createHash("sha256").update("hello").digest("base64");
const grant = {
  partNumber: 1,
  url: `${origin}/test/body.bin?uploadId=fixture&partNumber=1`, // 실제 AWS 서명이 아니다.
  requiredHeaders: { "x-amz-checksum-sha256": sha256 },
};
let calls = 0;
const successTransport = async (url, request) => {
  calls += 1; // 네트워크 대신 요청 계약을 검사하고 모의 응답을 반환한다.
  assert.equal(url, grant.url);
  assert.equal(request.method, "PUT");
  assert.equal(request.credentials, "omit");
  assert.equal(request.redirect, "error");
  assert.equal(request.headers["x-amz-checksum-sha256"], sha256);
  assert.equal(await request.body.text(), "hello");
  return new Response(null, {
    status: 200,
    headers: { ETag: '"fixture-etag"', "x-amz-checksum-sha256": sha256 },
  });
};

await test("small part hash and bytes", async () => {
  assert.equal(part.checksumSHA256, sha256);
  assert.equal(part.body.size, 5);
  assert.equal(await part.body.text(), "hello");
});

await test("last part uses remaining one byte", async () => {
  const boundary = 8 * 1024 * 1024;
  const large = new File([new Uint8Array(boundary), "z"], "large.bin");
  const last = await preparePart(large, { partNumber: 2, offset: boundary, bytes: 1 });
  assert.equal(last.body.size, 1);
  assert.equal(await last.body.text(), "z");
});

await test("reject changed part plan", async () => {
  await assert.rejects(() => preparePart(file, { partNumber: 1, offset: 1, bytes: 4 }));
});

await test("successful PUT preserves quoted ETag", async () => {
  const receipt = await putPreparedPart(part, grant, origin, undefined, successTransport);
  assert.deepEqual(receipt, { partNumber: 1, eTag: '"fixture-etag"', checksumSHA256: sha256 });
  assert.equal(calls, 1);
});

await test("reject unexpected storage origin before transport", async () => {
  await assert.rejects(() => putPreparedPart(part,
    { ...grant, url: "https://unexpected.example.test/body" }, origin, undefined, successTransport));
  assert.equal(calls, 1); // 잘못된 주소로는 전송 함수가 호출되지 않았다.
});

await test("reject mismatching checksum before transport", async () => {
  await assert.rejects(() => putPreparedPart(part,
    { ...grant, requiredHeaders: { "x-amz-checksum-sha256": "wrong" } },
    origin, undefined, successTransport));
  assert.equal(calls, 1);
});

await test("reject mismatching part number before transport", async () => {
  await assert.rejects(() => putPreparedPart(part, { ...grant, partNumber: 2 },
    origin, undefined, successTransport));
  assert.equal(calls, 1);
});

await test("missing ETag is not a confirmed receipt", async () => {
  const missingHeader = async () => new Response(null, {
    status: 200, headers: { "x-amz-checksum-sha256": sha256 },
  });
  await assert.rejects(() => putPreparedPart(part, grant, origin, undefined, missingHeader));
});

await test("HTTP failure is not converted into success", async () => {
  const conflict = async () => new Response(null, { status: 409 });
  await assert.rejects(() => putPreparedPart(part, grant, origin, undefined, conflict));
});

assert.equal(passed, 9);
process.stdout.write(`OK ${passed} helper checks; no network calls were made.\n`);
