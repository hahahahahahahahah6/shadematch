// ShadeMatch server. No dependencies: Node 18.17+ only.
// Photos are kept in memory for the length of one request and never written to disk.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { YouCamClient, YouCamError } from './lib/youcam.js';
import { estimateUndertone, depthLabel } from './lib/color.js';
import { recommendFoundations, recommendLipsticks } from './lib/catalog.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

// Load .env (simple KEY=VALUE lines) without printing anything from it.
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 12 * 1024 * 1024;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

function samplePath() {
  for (const n of ['sample.jpg', 'sample.jpeg', 'sample.png']) { const p = join(ROOT, 'samples', n); if (existsSync(p)) return p; }
  return null;
}

function client() { return new YouCamClient(process.env.YOUCAM_API_KEY, { log }); }

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new YouCamError('Photo is too large (max ~9 MB).'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function decodeImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw new YouCamError('Please send a JPG or PNG photo.');
  return { type: m[1], bytes: Buffer.from(m[2], 'base64') };
}

async function handleApi(req, res, path) {
  try {
    if (path === '/api/status' && req.method === 'GET') return send(res, 200, { keyConfigured: Boolean(process.env.YOUCAM_API_KEY), sample: Boolean(samplePath()) });

    if (path === '/api/sample' && req.method === 'GET') {
      const p = samplePath();
      if (!p) return send(res, 404, { error: 'No sample photo. Put samples/sample.jpg in the project folder.' });
      res.writeHead(200, { 'Content-Type': p.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Cache-Control': 'no-store' });
      return res.end(await readFile(p));
    }

    if (path === '/api/analyze' && req.method === 'POST') {
      const { image } = await readJson(req);
      const { type, bytes } = decodeImage(image);
      const yc = client();
      const fileId = await yc.upload(bytes, type);
      const { taskId, color } = await yc.skinTone(fileId);
      const skin = color.skin_color;
      const undertone = estimateUndertone(skin);
      return send(res, 200, {
        fileId,
        youcam: { task: 'skin-tone-analysis', taskId, color },
        skin: { hex: skin, undertone, depth: depthLabel(skin) },
        foundations: recommendFoundations(skin, undertone),
        lipsticks: recommendLipsticks(skin, undertone)
      });
    }

    if (path === '/api/tryon' && req.method === 'POST') {
      const { fileId, foundationHex, lipHex } = await readJson(req);
      if (!/^[\w+/=-]{4,300}$/.test(fileId || '')) throw new YouCamError('Missing photo reference. Analyze a photo first.');
      const hex = /^#[0-9a-f]{6}$/i;
      if ((foundationHex && !hex.test(foundationHex)) || (lipHex && !hex.test(lipHex))) throw new YouCamError('Invalid shade color.');
      const out = await client().makeupTryOn(fileId, { foundationHex, lipHex });
      return send(res, 200, { youcam: { task: 'makeup-vto', taskId: out.taskId }, resultUrl: out.url });
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    log('error:', err.message, err.details ? JSON.stringify(err.details).slice(0, 500) : '');
    send(res, err instanceof YouCamError ? 400 : 500, { error: err.message, details: err.details ?? null });
  }
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path.startsWith('/api/')) return handleApi(req, res, path);
  const rel = normalize(path === '/' ? '/index.html' : path).replace(/^([\\/])+/, '');
  if (rel.includes('..')) { res.writeHead(400); return res.end(); }
  try {
    const body = await readFile(join(ROOT, 'public', rel));
    res.writeHead(200, { 'Content-Type': MIME[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});

server.listen(PORT, () => {
  log(`ShadeMatch running at http://localhost:${PORT}`);
  log(process.env.YOUCAM_API_KEY ? 'YouCam API key loaded from environment.' : 'WARNING: YOUCAM_API_KEY is not set. Copy .env.example to .env and add your key.');
});
