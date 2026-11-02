// Run from the repository root: node --test scripts/test_upload_failure_injection.mjs
// Only in-memory transports are used. This script never invokes global fetch or AWS.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

async function loadNoteModule(relativePath) {
  const note = new URL(`../${relativePath}`, import.meta.url);
  const blocks = [...readFileSync(note, 'utf8').matchAll(/^```typescript\r?\n([\s\S]*?)^```/gm)];
  assert.equal(blocks.length, 1, `Expected one TypeScript module: ${relativePath}`);
  const source = stripTypeScriptTypes(blocks[0][1], { mode: 'strip' });
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const { loseOneSuccessfulResponse, oneShotGate, OutcomeUnknown } = await loadNoteModule(
  'SpringBoot/49_11_02_Upload_Integration_Testing_and_Consistency/11_02_Upload_Integration_Testing_and_Consistency.md');
const { parseGrant, putDirect, ReconcileRequired } = await loadNoteModule(
  'SpringBoot/47_10_31_Presigned_Direct_Upload_and_Completion_Verification/10_31_Presigned_Direct_Upload_and_Completion_Verification.md');
const { preparePart, putPreparedPart } = await loadNoteModule(
  'SpringBoot/48_11_01_S3_Multipart_Upload_and_Resume/11_01_S3_Multipart_Upload_and_Resume.md');

const origin = 'https://uploads.example.test';
const url = `${origin}/probe?X-Amz-Signature=test-only`;
const id = '00000000-0000-0000-0000-000000000049';
const file = text => new File([text], 'memo.txt', { type: 'text/plain' });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const directGrant = () => parseGrant({
  id, url, method: 'PUT', expiresAt: '2026-11-02T00:02:00Z',
  requiredHeaders: { 'content-type': 'text/plain', 'if-none-match': '*' },
}, origin, Date.parse('2026-11-02T00:00:00Z'));
const partGrant = part => ({
  partNumber: part.partNumber, url,
  requiredHeaders: { 'x-amz-checksum-sha256': part.checksumSHA256 },
});

// The timeout bounds a missing signal. It does not choose the order of competing operations.
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('test gate timed out')), 2000);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

test('HTTP errors are preserved and exactly one later successful response is lost', async () => {
  let calls = 0;
  const transport = loseOneSuccessfulResponse(async () => {
    calls++;
    return new Response(null, { status: calls === 1 ? 503 : 200 });
  });
  assert.equal((await transport(url)).status, 503);
  await assert.rejects(transport(url), OutcomeUnknown);
  assert.equal((await transport(url)).status, 200);
  assert.equal(calls, 3);
});

test('an original delegate exception is not masked or counted as a lost success', async () => {
  const original = new Error('before effect');
  let calls = 0;
  let effects = 0;
  const transport = loseOneSuccessfulResponse(async () => {
    if (++calls === 1) throw original;
    effects++;
    return new Response(null, { status: 200 });
  });
  await assert.rejects(transport(url), error => error === original);
  assert.equal(effects, 0);
  await assert.rejects(transport(url), OutcomeUnknown);
  assert.equal((await transport(url)).status, 200);
  assert.equal(effects, 2);
});

test('two concurrent successful effects lose only one response', async () => {
  let effects = 0;
  const transport = loseOneSuccessfulResponse(async () => {
    effects++;
    return new Response(null, { status: 200 });
  });
  const results = await Promise.allSettled([transport(url), transport(url)]);
  assert.equal(effects, 2);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.filter(result => result.status === 'rejected');
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof OutcomeUnknown);
});

test('direct PUT can store exact bytes while reporting an uncertain result without retry', async () => {
  const input = file('upload evidence');
  let stored;
  let calls = 0;
  const transport = loseOneSuccessfulResponse(async (_target, init) => {
    calls++;
    stored = { version: 'stored-v1', bytes: Buffer.from(await init.body.arrayBuffer()) };
    return new Response(null, { status: 200, headers: { 'x-amz-version-id': stored.version } });
  });
  await assert.rejects(putDirect(input, directGrant(), undefined, transport), error => {
    assert.ok(error instanceof ReconcileRequired);
    assert.equal(error.uploadId, id);
    assert.ok(!error.message.includes('X-Amz-Signature'));
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(stored.version, 'stored-v1');
  assert.equal(stored.bytes.toString(), 'upload evidence');
  assert.equal(sha256(stored.bytes), sha256(Buffer.from('upload evidence')));
});

test('a before-effect failure has the same client uncertainty but no stored object', async () => {
  const objects = new Map();
  await assert.rejects(putDirect(file('abc'), directGrant(), undefined, async () => {
    throw new Error('before effect'); // Deliberately do not write into objects.
  }), ReconcileRequired);
  assert.equal(objects.size, 0);
});

test('missing exposed version metadata does not prove that storage failed', async () => {
  let stored;
  await assert.rejects(putDirect(file('abc'), directGrant(), undefined, async (_target, init) => {
    stored = Buffer.from(await init.body.arrayBuffer());
    return new Response(null, { status: 200 }); // Model an unobservable header, not real CORS.
  }), ReconcileRequired);
  assert.equal(stored.toString(), 'abc');
});

test('lost part response is recovered with the same bytes and a new matching receipt', async () => {
  const part = await preparePart(file('part evidence'), { partNumber: 1, offset: 0, bytes: 13 });
  const remoteParts = new Map();
  const appReceipts = [];
  let writes = 0;
  const transport = loseOneSuccessfulResponse(async (_target, init) => {
    const bytes = Buffer.from(await init.body.arrayBuffer());
    const checksum = createHash('sha256').update(bytes).digest('base64');
    const eTag = `"probe-${++writes}"`; // Opaque fake identifier; not an S3 checksum prediction.
    remoteParts.set('attempt-1:1', { bytes, eTag, checksum });
    return new Response(null, { status: 200, headers: { ETag: eTag, 'x-amz-checksum-sha256': checksum } });
  });
  await assert.rejects(putPreparedPart(part, partGrant(part), origin, undefined, transport), OutcomeUnknown);
  assert.equal(appReceipts.length, 0);
  assert.equal(remoteParts.size, 1);
  const receipt = await putPreparedPart(part, partGrant(part), origin, undefined, transport);
  appReceipts.push(receipt);
  const remote = remoteParts.get('attempt-1:1');
  assert.equal(writes, 2); // Retrying a part may perform the write twice; final approval is still absent.
  assert.equal(remoteParts.size, 1);
  assert.equal(remote.bytes.toString(), 'part evidence');
  assert.equal(receipt.eTag, '"probe-2"');
  assert.equal(receipt.eTag, remote.eTag);
  assert.equal(receipt.checksumSHA256, remote.checksum);
  assert.equal(appReceipts.length, 1);
  assert.ok(!('versionId' in receipt)); // A part receipt is not a final object version.
});

test('same filename and size with different content cannot use a frozen part checksum', async () => {
  const slice = { partNumber: 1, offset: 0, bytes: 3 };
  const first = await preparePart(file('abc'), slice);
  const changed = await preparePart(file('abd'), slice);
  assert.notEqual(first.checksumSHA256, changed.checksumSHA256);
  let calls = 0;
  await assert.rejects(putPreparedPart(changed, partGrant(first), origin, undefined, async () => {
    calls++;
    return new Response(null, { status: 200 });
  }));
  assert.equal(calls, 0);
});

test('a controlled late remote effect can outlive local cancellation (in-memory model)', async () => {
  const gate = oneShotGate();
  const controller = new AbortController();
  const part = await preparePart(file('abc'), { partNumber: 1, offset: 0, bytes: 3 });
  const remoteParts = new Map();
  const transport = loseOneSuccessfulResponse(async (_target, init) => {
    await gate.wait(); // Signal arrival before performing the effect.
    assert.equal(init.signal.aborted, true);
    // Intentionally ignore AbortSignal: model a remote operation that was already accepted.
    remoteParts.set('attempt-1:1', Buffer.from(await init.body.arrayBuffer()));
    return new Response(null, { status: 200, headers: {
      ETag: '"late"', 'x-amz-checksum-sha256': part.checksumSHA256,
    } });
  });
  const pending = putPreparedPart(part, partGrant(part), origin, controller.signal, transport);
  const rejected = assert.rejects(pending, OutcomeUnknown); // Attach the rejection observer immediately.
  try {
    await bounded(gate.entered);
    assert.equal(remoteParts.size, 0);
    controller.abort();
  } finally {
    gate.release(); // Assertion failure must not leave the fake operation waiting forever.
    await bounded(rejected);
  }
  assert.equal(remoteParts.get('attempt-1:1').toString(), 'abc');
  // No browser, SQL authorization, MPU Abort, or final object deletion was executed here.
});
