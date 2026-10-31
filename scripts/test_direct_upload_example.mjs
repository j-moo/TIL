// Run from the repository root: node --test scripts/test_direct_upload_example.mjs
// Extract the actual TypeScript example; no network, AWS account, or package install is used.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const note = new URL('../SpringBoot/47_10_31_Presigned_Direct_Upload_and_Completion_Verification/10_31_Presigned_Direct_Upload_and_Completion_Verification.md', import.meta.url);
const blocks = [...readFileSync(note, 'utf8').matchAll(/^```typescript\r?\n([\s\S]*?)^```/gm)];
assert.equal(blocks.length, 1, 'Expected exactly one complete TypeScript module in the note');
const source = stripTypeScriptTypes(blocks[0][1], { mode: 'strip' });
const { parseGrant, sha256Hex, putDirect, ReconcileRequired } =
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const origin = 'https://uploads.example.test';
const now = Date.parse('2026-10-31T00:00:00Z');
const id = '00000000-0000-0000-0000-000000000047';
const rawGrant = () => ({
  id, url: `${origin}/incoming/file?X-Amz-Signature=not-a-real-signature`, method: 'PUT',
  requiredHeaders: { 'content-type': 'text/plain', 'if-none-match': '*' },
  expiresAt: '2026-10-31T00:02:00Z',
});
const grant = () => parseGrant(rawGrant(), origin, now);
const file = () => new File(['abc'], 'memo.txt', { type: 'application/octet-stream' });
const success = () => new Response(null, { status: 200, headers: { 'x-amz-version-id': 'stored-v1' } });
const needsReconcile = error => {
  assert.ok(error instanceof ReconcileRequired);
  assert.equal(error.uploadId, id);
  assert.ok(!error.message.includes('X-Amz-Signature'));
  return true;
};

test('SHA-256 is lowercase hex for the exact File bytes', async () => {
  assert.equal(await sha256Hex(file()), createHash('sha256').update('abc').digest('hex'));
});

test('grant rejects wrong origin, method, mandatory headers and app authorization', () => {
  assert.throws(() => parseGrant({ ...rawGrant(), url: 'https://other.example.test/file' }, origin, now));
  assert.throws(() => parseGrant({ ...rawGrant(), method: 'GET' }, origin, now));
  assert.throws(() => parseGrant({ ...rawGrant(), requiredHeaders: { 'content-type': 'text/plain' } }, origin, now));
  const raw = rawGrant();
  raw.requiredHeaders.authorization = 'must-not-be-forwarded';
  assert.throws(() => parseGrant(raw, origin, now));
});

test('grant expires at the exact boundary and keeps the original URL string', () => {
  const raw = rawGrant();
  assert.throws(() => parseGrant(raw, origin, Date.parse(raw.expiresAt)));
  assert.equal(parseGrant(raw, origin, now).url, raw.url);
});

test('PUT sends the original File, signed headers, no cookies and returns versionId', async () => {
  const input = file();
  const permit = grant();
  const signal = new AbortController().signal;
  let calls = 0;
  const version = await putDirect(input, permit, signal, async (url, init) => {
    calls++;
    assert.equal(url, permit.url);
    assert.equal(init.body, input);
    assert.equal(init.method, 'PUT');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.mode, 'cors');
    assert.equal(init.redirect, 'error');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.equal(init.signal, signal);
    assert.deepEqual(init.headers, permit.requiredHeaders);
    assert.equal(init.headers['content-type'], 'text/plain');
    assert.ok(!('authorization' in init.headers));
    return success();
  });
  assert.equal(calls, 1);
  assert.equal(version, 'stored-v1');
});

test('missing or null versionId requests server reconciliation', async () => {
  for (const headers of [{}, { 'x-amz-version-id': 'null' }]) {
    await assert.rejects(putDirect(file(), grant(), undefined,
      async () => new Response(null, { status: 200, headers })), needsReconcile);
  }
});

test('412 does not silently overwrite, recreate or retry the upload', async () => {
  let calls = 0;
  await assert.rejects(putDirect(file(), grant(), undefined, async () => {
    calls++;
    return new Response(null, { status: 412 });
  }), needsReconcile);
  assert.equal(calls, 1);
});

test('network failure and cancellation are uncertain outcomes without URL disclosure', async () => {
  for (const failure of [new Error(rawGrant().url), new DOMException('cancelled', 'AbortError')]) {
    await assert.rejects(putDirect(file(), grant(), undefined, async () => { throw failure; }), needsReconcile);
  }
});

test('empty and oversized inputs fail before hashing or issuing PUT', async () => {
  let calls = 0;
  for (const size of [0, 65_537]) {
    const input = new File([new Uint8Array(size)], 'memo.txt');
    await assert.rejects(sha256Hex(input));
    await assert.rejects(putDirect(input, grant(), undefined, async () => { calls++; return success(); }));
  }
  assert.equal(calls, 0);
});

test('exact 64KiB boundary is accepted by the browser helper', async () => {
  const input = new File([new Uint8Array(65_536)], 'memo.txt');
  assert.equal((await sha256Hex(input)).length, 64);
  assert.equal(await putDirect(input, grant(), undefined, async () => success()), 'stored-v1');
  // The server's UTF-8/control-character policy is intentionally NOT simulated by this test.
});
