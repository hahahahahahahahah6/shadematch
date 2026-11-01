// Minimal YouCam API client: upload a photo, run a task, poll until it finishes.
// Docs: https://docs.perfectcorp.com/develop/quick_start_guide
export const API_BASE = process.env.YOUCAM_API_BASE || 'https://yce-api-01.makeupar.com/s2s/v2.0';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export class YouCamError extends Error {
  constructor(message, details) { super(message); this.details = details; }
}

export class YouCamClient {
  constructor(apiKey, { fetchImpl = fetch, log = () => {} } = {}) {
    if (!apiKey) throw new YouCamError('YOUCAM_API_KEY is not set. Copy .env.example to .env and add your key.');
    this.key = apiKey;
    this.fetch = fetchImpl;
    this.log = log;
  }

  async request(path, body) {
    const res = await this.fetch(API_BASE + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000)
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new YouCamError(`YouCam returned non-JSON (HTTP ${res.status}).`, text.slice(0, 300)); }
    if (!res.ok || (json.status && json.status !== 200)) {
      throw new YouCamError(`YouCam request failed (HTTP ${res.status}): ${json.error_code || json.error || json.message || 'error'}`, json);
    }
    return json;
  }

  // Step 1: ask YouCam for an upload URL, then PUT the image bytes there.
  async upload(bytes, contentType = 'image/jpeg') {
    const ct = contentType === 'image/jpeg' ? 'image/jpg' : contentType;
    const name = ct === 'image/png' ? 'photo.png' : 'photo.jpg';
    const json = await this.request('/file', { files: [{ content_type: ct, file_name: name, file_size: bytes.length }] });
    const file = json.data?.files?.[0];
    if (!file?.file_id || !file.requests?.length) throw new YouCamError('YouCam did not return an upload URL.', json);
    for (const req of file.requests) {
      const url = new URL(req.url);
      if (url.protocol !== 'https:') throw new YouCamError('Unexpected upload URL.');
      const up = await this.fetch(url.href, { method: req.method || 'PUT', headers: req.headers, body: bytes, signal: AbortSignal.timeout(30000) });
      if (!up.ok) throw new YouCamError(`Photo upload failed (HTTP ${up.status}).`);
    }
    this.log('uploaded file', file.file_id);
    return file.file_id;
  }

  // Step 2 + 3: start a task and poll it until success or error.
  async runTask(taskName, body, { timeoutMs = 90000 } = {}) {
    const created = await this.request(`/task/${taskName}`, body);
    const taskId = created.data?.task_id;
    if (!taskId) throw new YouCamError('YouCam did not return a task_id.', created);
    this.log(`task ${taskName} started`, taskId);
    const start = Date.now();
    let wait = 1000;
    while (Date.now() - start < timeoutMs) {
      await sleep(wait);
      const polled = await this.request(`/task/${taskName}/${encodeURIComponent(taskId)}`);
      const d = polled.data || {};
      if (d.polling_interval) wait = Math.max(500, Math.min(5000, Number(d.polling_interval)));
      if (d.task_status === 'success') { this.log(`task ${taskName} success`); return { taskId, data: d }; }
      if (d.task_status === 'error') throw new YouCamError(`YouCam task failed: ${d.error || d.failure_reason || d.error_message || 'unknown error'}`, d);
    }
    throw new YouCamError(`YouCam task ${taskName} timed out.`);
  }

  // AI Facial Color Tones Analyzer: returns skin, lip, eye, hair colors as hex.
  async skinTone(fileId) {
    const { taskId, data } = await this.runTask('skin-tone-analysis', { src_file_id: fileId, face_angle_strictness_level: 'medium' });
    const color = data.results?.color || data.results?.[0]?.color;
    if (!color?.skin_color) throw new YouCamError('Skin tone result did not include skin_color.', data);
    return { taskId, color };
  }

  // AI Makeup Virtual Try-On: applies foundation + lip color and returns a result image URL.
  async makeupTryOn(fileId, { foundationHex, lipHex }) {
    const effects = [];
    if (foundationHex) effects.push({ category: 'foundation', palettes: [{ color: foundationHex, colorIntensity: 50, glowIntensity: 20, coverageIntensity: 60 }] });
    if (lipHex) effects.push({ category: 'lip_color', shape: { name: 'original' }, style: { type: 'full' }, palettes: [{ color: lipHex, texture: 'matte', colorIntensity: 70 }] });
    const { taskId, data } = await this.runTask('makeup-vto', { src_file_id: fileId, version: '1.0', effects });
    const r = data.results;
    const url = r?.url || r?.download_url || (Array.isArray(r) ? (r[0]?.url || r[0]?.download_url) : undefined);
    if (!url) throw new YouCamError('Try-on result did not include an image URL.', data);
    return { taskId, url };
  }
}
