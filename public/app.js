const $ = id => document.getElementById(id);
const state = { image: null, fileId: null, foundation: null, lipstick: null };

function status(msg, { err = false, busy = false } = {}) {
  const el = $('status');
  if (!msg) { el.hidden = true; return; }
  el.hidden = false;
  el.className = 'status' + (err ? ' err' : '');
  el.innerHTML = (busy ? '<span class="spin"></span>' : '') + msg;
}

function step(n) {
  document.querySelectorAll('#steps li').forEach(li => {
    const s = Number(li.dataset.step);
    li.className = s < n ? 'done' : s === n ? 'active' : '';
  });
}

// Shrink the photo in the browser so the long side is at most 1080 px (YouCam limits).
function loadPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png)$/.test(file.type)) return reject(new Error('Please choose a JPG or PNG photo.'));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1080 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = URL.createObjectURL(file);
  });
}

async function api(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function choose(file) {
  try {
    state.image = await loadPhoto(file);
    $('preview').src = state.image; $('preview').hidden = false; $('dropText').hidden = true;
    $('analyzeBtn').disabled = false;
    ['analysis', 'shades', 'tryon'].forEach(id => ($(id).hidden = true));
    step(1); status('');
  } catch (e) { status(e.message, { err: true }); }
}

$('file').addEventListener('change', e => e.target.files[0] && choose(e.target.files[0]));
const drop = $('drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => e.dataTransfer.files[0] && choose(e.dataTransfer.files[0]));

function shadeButton(item, kind) {
  const b = document.createElement('button');
  b.className = 'shade'; b.type = 'button';
  const extra = kind === 'foundation' ? `ΔE ${item.distance} from your skin` : `${item.undertone} undertone`;
  b.innerHTML = `<span class="swatch" style="background:${item.hex}"></span><span><b>${item.name}</b><span class="tag">${item.id}</span><small>${item.hex} · ${extra}</small></span>`;
  b.onclick = () => {
    state[kind] = item;
    b.parentElement.querySelectorAll('.shade').forEach(x => x.classList.toggle('sel', x === b));
  };
  return b;
}

$('analyzeBtn').onclick = async () => {
  $('analyzeBtn').disabled = true;
  status('Uploading photo and running YouCam skin tone analysis…', { busy: true });
  try {
    const r = await api('/api/analyze', { image: state.image });
    state.fileId = r.fileId;
    $('skinSwatch').style.background = r.skin.hex;
    $('skinHex').textContent = r.skin.hex.toUpperCase();
    $('undertone').textContent = r.skin.undertone;
    $('depth').textContent = r.skin.depth;
    $('raw').textContent = JSON.stringify(r.youcam, null, 2);
    $('analysis').hidden = false; step(2);
    const fGrid = $('foundations'), lGrid = $('lipsticks');
    fGrid.innerHTML = ''; lGrid.innerHTML = '';
    r.foundations.forEach(f => fGrid.appendChild(shadeButton(f, 'foundation')));
    r.lipsticks.forEach(l => lGrid.appendChild(shadeButton(l, 'lipstick')));
    fGrid.firstChild.click(); lGrid.firstChild.click();
    setTimeout(() => { $('shades').hidden = false; step(3); $('shades').scrollIntoView({ behavior: 'smooth' }); }, 400);
    status('');
  } catch (e) { status(e.message, { err: true }); }
  $('analyzeBtn').disabled = false;
};

$('tryBtn').onclick = async () => {
  $('tryBtn').disabled = true;
  status('Applying shades with YouCam makeup virtual try-on…', { busy: true });
  try {
    const r = await api('/api/tryon', { fileId: state.fileId, foundationHex: state.foundation?.hex, lipHex: state.lipstick?.hex });
    $('before').src = state.image;
    $('after').src = r.resultUrl;
    $('afterCap').textContent = `${state.foundation.name} + ${state.lipstick.name}`;
    $('tryon').hidden = false; step(4);
    $('tryon').scrollIntoView({ behavior: 'smooth' });
    status('');
  } catch (e) { status(e.message, { err: true }); }
  $('tryBtn').disabled = false;
};

$('restartBtn').onclick = () => {
  Object.assign(state, { image: null, fileId: null, foundation: null, lipstick: null });
  $('preview').hidden = true; $('dropText').hidden = false; $('file').value = '';
  $('analyzeBtn').disabled = true;
  ['analysis', 'shades', 'tryon'].forEach(id => ($(id).hidden = true));
  step(1); window.scrollTo({ top: 0, behavior: 'smooth' });
};

$('sampleBtn').onclick = async () => {
  const blob = await fetch('/api/sample').then(r => (r.ok ? r.blob() : Promise.reject(new Error('No sample photo found.'))));
  choose(new File([blob], 'sample', { type: blob.type }));
};

fetch('/api/status').then(r => r.json()).then(s => { $('keyWarn').hidden = s.keyConfigured; $('sampleBtn').hidden = !s.sample; }).catch(() => {});
