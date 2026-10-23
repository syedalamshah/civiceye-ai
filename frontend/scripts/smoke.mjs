// Actual HTTP integration test. No mock predictions or browser simulation.
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import assert from 'node:assert/strict';
import { validateResult } from '../src/data.js';

const url = (process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const origin = 'http://localhost:5173';
const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10000) });
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: 'ok' });
console.log('health: PASS');
if (process.argv.length < 3) throw new Error('Pass one or more real JPG/PNG paths.');
for (const path of process.argv.slice(2)) {
  const data = new FormData();
  data.append('file', new Blob([await readFile(path)], { type: path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg' }), basename(path));
  const start = performance.now();
  const response = await fetch(`${url}/api/detect`, { method: 'POST', body: data, headers: { Origin: origin }, signal: AbortSignal.timeout(90000) });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  validateResult(body);
  console.log(JSON.stringify({ file: basename(path), http: response.status, milliseconds: Math.round(performance.now()-start), response: body }));
}
