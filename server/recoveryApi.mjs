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

function requireConfig() {
  if (!ready) throw Object.assign(new Error('Recovery API is missing server configuration.'), { status: 503 });
}

function getCode(body) {
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(code)) {
    throw Object.assign(new Error('Invalid recovery code.'), { status: 400 });
  }
  return code;
}

function sign(params) {
  const canonical = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
  return createHash('sha1').update(canonical + CLOUDINARY_API_SECRET).digest('hex');
}

async function cloudinaryUpload(code, data) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = { invalidate: 'true', overwrite: 'true', public_id: `recovery_${code}.json`, timestamp };
  const form = new FormData();
  form.append('file', `data:application/json;base64,${Buffer.from(JSON.stringify(data)).toString('base64')}`);
  for (const [key, value] of Object.entries(params)) form.append(key, value);
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('signature', sign(params));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`, {
    method: 'POST',
    body: form,
  });
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(result.error?.message || 'Cloudinary backup upload failed.'), { status: 502 });
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
  return parseBody(await request.text());
}

function send(status, data) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function handleRecoveryRequest(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const previous = rateLimits.get(ip);
  if (!previous || now - previous.start > 60_000) {
    rateLimits.set(ip, { start: now, count: 1 });
  } else if (++previous.count > 60) {
    return send(429, { error: 'Too many requests. Try again in a minute.' });
  }

  const path = new URL(request.url).pathname.replace(/^\/api(?=\/|$)/, '');
  if (request.method === 'GET' && path === '/health') {
    return send(200, { ok: true, configured: ready });
  }

  try {
    requireConfig();
    if (request.method !== 'POST') return send(405, { error: 'Method not allowed.' });
    const body = await readBody(request);
    if (path === '/recovery/create') {
      return send(200, { code: randomBytes(24).toString('base64url') });
    }

    const code = getCode(body);
    if (path === '/recovery/sync') {
      if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
        throw Object.assign(new Error('Backup data is invalid.'), { status: 400 });
      }
      if (Buffer.byteLength(JSON.stringify(body.data)) > MAX_BODY) {
        throw Object.assign(new Error('Backup data is too large.'), { status: 413 });
      }
      await cloudinaryUpload(code, body.data);
      return send(200, { ok: true });
    }
    return send(404, { error: 'Endpoint not found.' });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Recovery API error:', error.message);
    return send(status, { error: error.message || 'Unexpected server error.' });
  }
}
