import assert from 'node:assert/strict';
import test from 'node:test';

process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test';
process.env.CLOUDINARY_API_SECRET = 'test';

const { handleRecoveryRequest } = await import('../recoveryApi.mjs');
let nextTestIp = 1;

function makeRequest(path, { method = 'GET', headers = {}, body } = {}) {
  return new Request(`https://recovery.example${path}`, {
    method,
    headers: {
      'x-forwarded-for': `198.51.100.${nextTestIp++}`,
      ...headers,
    },
    body,
  });
}

test('health endpoint reports configuration without exposing credentials', async () => {
  const response = await handleRecoveryRequest(makeRequest('/api/health', {
    headers: { origin: 'https://app.example' },
  }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await response.json(), { ok: true, configured: true });
});

test('recovery creation returns a well-formed high-entropy code', async () => {
  const response = await handleRecoveryRequest(makeRequest('/api/recovery/create', {
    method: 'POST',
    body: '{}',
  }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.match(result.code, /^[A-Za-z0-9_-]{32}$/);
});

test('recovery sync rejects invalid codes before attempting an upload', async () => {
  const response = await handleRecoveryRequest(makeRequest('/api/recovery/sync', {
    method: 'POST',
    body: JSON.stringify({ code: 'invalid', module: 'habits', data: {} }),
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid recovery code.' });
});

test('file upload signatures validate the asset identifier and return signed upload details', async () => {
  const invalid = await handleRecoveryRequest(makeRequest('/api/recovery/upload-signature', {
    method: 'POST',
    body: JSON.stringify({ code: 'A'.repeat(32), fileId: '../invalid' }),
  }));
  assert.equal(invalid.status, 400);

  const response = await handleRecoveryRequest(makeRequest('/api/recovery/upload-signature', {
    method: 'POST',
    body: JSON.stringify({ code: 'A'.repeat(32), kind: 'file', fileId: 'b'.repeat(32) }),
  }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.apiKey, 'test');
  assert.equal(result.cloudName, 'test-cloud');
  assert.equal(result.publicId, `habit-tracker/backups/${'A'.repeat(32)}/files/${'b'.repeat(32)}.bin`);
  assert.match(result.signature, /^[0-9a-f]{40}$/);
  assert.match(result.timestamp, /^\d+$/);

  const manifestResponse = await handleRecoveryRequest(makeRequest('/api/recovery/upload-signature', {
    method: 'POST',
    body: JSON.stringify({ code: 'A'.repeat(32), kind: 'manifest' }),
  }));
  assert.equal(manifestResponse.status, 200);
  assert.equal((await manifestResponse.json()).publicId, `habit-tracker/backups/${'A'.repeat(32)}/full.json`);
});

test('unknown methods and routes return explicit client errors', async () => {
  const methodResponse = await handleRecoveryRequest(makeRequest('/api/recovery/create', {
    method: 'DELETE',
  }));
  const routeResponse = await handleRecoveryRequest(makeRequest('/api/not-found', {
    method: 'POST',
    body: '{}',
  }));

  assert.equal(methodResponse.status, 405);
  assert.equal(routeResponse.status, 404);
});

test('oversized request bodies are rejected from their declared length', async () => {
  const response = await handleRecoveryRequest(makeRequest('/api/recovery/sync', {
    method: 'POST',
    headers: { 'content-length': String(8 * 1024 * 1024 + 1) },
    body: '{}',
  }));

  assert.equal(response.status, 413);
});

test('oversized streamed bodies are stopped while reading', async () => {
  const response = await handleRecoveryRequest(makeRequest('/api/recovery/sync', {
    method: 'POST',
    body: ' '.repeat(8 * 1024 * 1024 + 1),
  }));

  assert.equal(response.status, 413);
});

test('web preflight requests receive CORS headers without consuming rate limits', async () => {
  const ip = '203.0.113.88';
  const response = await handleRecoveryRequest(makeRequest('/api/recovery/create', {
    method: 'OPTIONS',
    headers: {
      'x-forwarded-for': ip,
      origin: 'https://app.example',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  }));

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
  const normalRequests = await Promise.all(Array.from({ length: 60 }, () =>
    handleRecoveryRequest(makeRequest('/api/health', {
      headers: { 'x-forwarded-for': ip },
    }))
  ));
  assert.equal(normalRequests.every((result) => result.status === 200), true);
});

test('rate limiting caps repeated requests from one address', async () => {
  const responses = await Promise.all(Array.from({ length: 61 }, () =>
    handleRecoveryRequest(makeRequest('/api/health', {
      headers: { 'x-forwarded-for': '203.0.113.77' },
    }))
  ));

  assert.equal(responses.filter((response) => response.status === 200).length, 60);
  assert.equal(responses.at(-1)?.status, 429);
});

test('valid recovery snapshots upload and return a safe success response', async () => {
  const originalFetch = globalThis.fetch;
  let uploadCalled = false;
  globalThis.fetch = async (url, options) => {
    uploadCalled = true;
    assert.match(String(url), /^https:\/\/api\.cloudinary\.com\//);
    assert.equal(options.method, 'POST');
    return Response.json({ public_id: 'test/backup' });
  };

  try {
    const response = await handleRecoveryRequest(makeRequest('/api/recovery/sync', {
      method: 'POST',
      body: JSON.stringify({
        code: 'A'.repeat(32),
        module: 'habits',
        data: { habits: [], logs: [], dailyNotes: {}, settings: {} },
      }),
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(uploadCalled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
