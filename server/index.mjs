import { createServer } from 'node:http';
import { handleRecoveryRequest } from './recoveryApi.mjs';

const { PORT = '3000' } = process.env;
const server = createServer((incoming, outgoing) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('x-forwarded-for', incoming.socket.remoteAddress || 'unknown');

  const method = incoming.method || 'GET';
  const init = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = incoming;
    init.duplex = 'half';
  }
  const request = new Request(
    new URL(incoming.url || '/', `http://${incoming.headers.host || 'localhost'}`),
    init,
  );

  void handleRecoveryRequest(request).then(async (response) => {
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  }).catch((error) => {
    console.error('Recovery API request failed:', error);
    outgoing.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    outgoing.end(JSON.stringify({ error: 'Unexpected server error.' }));
  });
});
server.listen(Number(PORT), '0.0.0.0', () => console.log(`Recovery API listening on ${PORT}`));
