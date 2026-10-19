/* global Buffer */
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

function loadLocalEnv() {
  try {
    for (const line of readFileSync(new URL('./.env', import.meta.url), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
loadLocalEnv();

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
const ready = [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET].every(Boolean);
const rateLimits = new Map();
const MAX_BODY = 8 * 1024 * 1024;
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const MAX_TRACKED_IPS = 10_000;
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function requireConfig() {
  if (!ready) throw Object.assign(new Error('Recovery API is missing server configuration.'), { status: 503 });
}

function getCode(body) {
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(code)) {
    throw Object.assign(new Error('Invalid recovery code.'), { status: 400 });
  }
  return code;
}

function sign(params) {
  const canonical = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
  return createHash('sha1').update(canonical + CLOUDINARY_API_SECRET).digest('hex');
}

async function cloudinaryUpload(code, module, data) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = { invalidate: 'true', overwrite: 'true', public_id: `habit-tracker/backups/${code}/${module}.json`, timestamp };
  const form = new FormData();
  form.append('file', `data:application/json;base64,${Buffer.from(JSON.stringify(data)).toString('base64')}`);
  for (const [key, value] of Object.entries(params)) form.append(key, value);
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('signature', sign(params));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  } catch {
    throw Object.assign(new Error('Cloudinary backup upload failed. Please try again.'), { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result?.error?.message === 'string'
      ? result.error.message
      : 'Cloudinary backup upload failed.';
    throw Object.assign(new Error(message), { status: 502 });
  }
}

function parseBody(raw) {
  if (Buffer.byteLength(raw) > MAX_BODY) {
    throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(new Error('Request body must be JSON.'), { status: 400 });
  }
}

async function readBody(request) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY) {
    throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  if (!request.body) return parseBody('');

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        void reader.cancel().catch(() => undefined);
        throw Object.assign(new Error('Request is too large.'), { status: 413 });
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return parseBody(Buffer.concat(chunks, size).toString('utf8'));
}

function responseHeaders(request) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  });
  const origin = request.headers.get('origin');
  if (origin && allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
}

function send(request, status, data) {
  return Response.json(data, {
    status,
    headers: responseHeaders(request),
  });
}

function isRateLimited(ip, now) {
  const previous = rateLimits.get(ip);
  if (!previous || now - previous.start >= RATE_WINDOW_MS) {
    rateLimits.set(ip, { start: now, count: 1 });
    if (rateLimits.size > MAX_TRACKED_IPS) {
      for (const [key, bucket] of rateLimits) {
        if (now - bucket.start >= RATE_WINDOW_MS) rateLimits.delete(key);
      }
      while (rateLimits.size > MAX_TRACKED_IPS) {
        const oldest = rateLimits.keys().next().value;
        if (oldest === undefined) break;
        rateLimits.delete(oldest);
      }
    }
    return false;
  }
  if (previous.count >= MAX_REQUESTS_PER_WINDOW) return true;
  previous.count += 1;
  return false;
}

export async function handleRecoveryRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(request) });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  if (isRateLimited(ip, now)) return send(request, 429, { error: 'Too many requests. Try again in a minute.' });

  const path = new URL(request.url).pathname.replace(/^\/api(?=\/|$)/, '');
  if (request.method === 'GET' && path === '/health') {
    return send(request, 200, { ok: true, configured: ready });
  }

  if (!['/recovery/create', '/recovery/sync', '/recovery/upload-signature'].includes(path)) {
    return send(request, 404, { error: 'Endpoint not found.' });
  }

  try {
    requireConfig();
    if (request.method !== 'POST') return send(request, 405, { error: 'Method not allowed.' });
    const body = await readBody(request);
    if (path === '/recovery/create') {
      return send(request, 200, { code: randomBytes(24).toString('base64url') });
    }

    const code = getCode(body);
    if (path === '/recovery/upload-signature') {
      const isManifest = body.kind === 'manifest';
      if (!isManifest && (body.kind !== 'file' || typeof body.fileId !== 'string' || !/^[0-9a-f]{32}$/i.test(body.fileId))) {
        throw Object.assign(new Error('Invalid backup file identifier.'), { status: 400 });
      }
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const publicId = isManifest
        ? `habit-tracker/backups/${code}/full.json`
        : `habit-tracker/backups/${code}/files/${body.fileId}.json`;
      const params = { invalidate: 'true', overwrite: 'true', public_id: publicId, timestamp };
      return send(request, 200, {
        apiKey: CLOUDINARY_API_KEY,
        cloudName: CLOUDINARY_CLOUD_NAME,
        publicId,
        timestamp,
        signature: sign(params),
      });
    }
    if (path === '/recovery/sync') {
      if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
        throw Object.assign(new Error('Backup data is invalid.'), { status: 400 });
      }
      if (Buffer.byteLength(JSON.stringify(body.data)) > MAX_BODY) {
        throw Object.assign(new Error('Backup data is too large.'), { status: 413 });
      }
      const module = typeof body.module === 'string' ? body.module : 'habits';
      if (!['habits', 'loans', 'expenses', 'full'].includes(module)) {
        throw Object.assign(new Error('Invalid backup module.'), { status: 400 });
      }
      await cloudinaryUpload(code, module, body.data);
      return send(request, 200, { ok: true });
    }
    return send(request, 404, { error: 'Endpoint not found.' });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Recovery API error:', error.message);
    return send(request, status, { error: error.message || 'Unexpected server error.' });
  }
}
