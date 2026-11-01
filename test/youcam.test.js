// Unit test of the request flow with a fake fetch. The real app always calls the real API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YouCamClient } from '../lib/youcam.js';

test('upload -> skin-tone-analysis -> poll', async () => {
  const calls = [];
  const res = obj => ({ ok: true, status: 200, text: async () => JSON.stringify(obj) });
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/file')) return res({ status: 200, data: { files: [{ file_id: 'f1', requests: [{ method: 'PUT', url: 'https://s3.example.com/up', headers: {} }] }] } });
    if (url.startsWith('https://s3.')) return { ok: true, status: 200 };
    if (opts.method === 'POST') return res({ status: 200, data: { task_id: 't1' } });
    return res({ status: 200, data: { task_status: 'success', results: { color: { skin_color: '#b9947c' } } } });
  };
  const yc = new YouCamClient('test-key', { fetchImpl: fakeFetch });
  const id = await yc.upload(Buffer.from('abc'), 'image/jpeg');
  const out = await yc.skinTone(id);
  assert.equal(out.color.skin_color, '#b9947c');
  assert.deepEqual(JSON.parse(calls[2].opts.body).src_file_id, 'f1');
  assert.match(calls[2].url, /\/task\/skin-tone-analysis$/);
});

test('missing key gives a clear error', () => {
  assert.throws(() => new YouCamClient(''), /YOUCAM_API_KEY/);
});
