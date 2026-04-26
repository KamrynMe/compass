// Five state presets per the binaural directive.
// Carrier frequencies are anchored to A minor / A natural minor (parasympathetic-friendly):
//   A2 110, D3 146.83, A3 220, E4 329.63, A4 440 — all consonant intervals, no dissonance.
// Beat = stable difference between L/R carriers; pulsation = slow carrier glide where useful.
const WAVES = [
  { id: 'delta', name: 'Delta', range: '2 Hz', use: 'Deep sleep, physiological shutdown',
    note: 'A2 carrier — low, heavy, minimally stimulating',
    carrier: 110.00, beat: 2,  pulsate: false, color: '#4a7ab0' },
  { id: 'theta', name: 'Theta', range: '6 Hz', use: 'Meditation, imagery, gratitude, REM',
    note: 'D3 carrier — mid-low, supports drift without sleep, gentle pulsation',
    carrier: 146.83, beat: 6,  pulsate: true,  pulseDepth: 0.6, pulsePeriod: 12, color: '#8a5ab0' },
  { id: 'alpha', name: 'Alpha', range: '10 Hz', use: 'Calm focus, flow',
    note: 'A3 carrier — balanced calm + awareness, light pulsation',
    carrier: 220.00, beat: 10, pulsate: true,  pulseDepth: 0.3, pulsePeriod: 18, color: '#4a9a6a' },
  { id: 'beta',  name: 'Beta',  range: '18 Hz', use: 'Active problem-solving',
    note: 'E4 carrier — alert without stress, no pulsation for stability',
    carrier: 329.63, beat: 18, pulsate: false, color: '#c9a84c' },
  { id: 'gamma', name: 'Gamma', range: '40 Hz', use: 'Deep analysis, integration, planning',
    note: 'A5 carrier (880 Hz) — clean, precise, true pitch with wide beat',
    carrier: 880.00, beat: 40, pulsate: false, color: '#c05050' },
];

const _beats = {
  ctx: null,
  oscL: null, oscR: null, gain: null,
  pulseTimer: null,
  active: null,
  volume: 0.18,
  durationSec: 0,
  stopTimer: null,
};

function _ensureCtx() {
  if (!_beats.ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    // latencyHint: 'playback' encourages mixing with other audio (Spotify etc) on iOS
    _beats.ctx = new Ctor({ latencyHint: 'playback' });
  }
  if (_beats.ctx.state === 'suspended') _beats.ctx.resume();
  return _beats.ctx;
}

function _hardStop() {
  if (_beats.stopTimer) { clearTimeout(_beats.stopTimer); _beats.stopTimer = null; }
  if (_beats.pulseTimer) { clearInterval(_beats.pulseTimer); _beats.pulseTimer = null; }
  try { if (_beats.oscL) _beats.oscL.stop(); } catch (_) {}
  try { if (_beats.oscR) _beats.oscR.stop(); } catch (_) {}
  try { if (_beats.oscL) _beats.oscL.disconnect(); } catch (_) {}
  try { if (_beats.oscR) _beats.oscR.disconnect(); } catch (_) {}
  try { if (_beats.gain) _beats.gain.disconnect(); } catch (_) {}
  _beats.oscL = null; _beats.oscR = null; _beats.gain = null;
  _beats.active = null;
  releaseWakeLock();
}

function startBeats(waveId) {
  // Always stop any existing first to prevent overlap.
  _hardStop();
  const wave = WAVES.find((w) => w.id === waveId);
  if (!wave) return;
  const ctx = _ensureCtx();
  if (!ctx) { showToast('Audio not supported'); return; }

  const merger = ctx.createChannelMerger(2);
  const oscL = ctx.createOscillator(); oscL.type = 'sine';
  const oscR = ctx.createOscillator(); oscR.type = 'sine';
  const baseLeft = wave.carrier - wave.beat / 2;
  const baseRight = wave.carrier + wave.beat / 2;
  oscL.frequency.value = baseLeft;
  oscR.frequency.value = baseRight;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(_beats.volume, ctx.currentTime + 0.8);

  oscL.connect(merger, 0, 0);
  oscR.connect(merger, 0, 1);
  merger.connect(gain).connect(ctx.destination);
  oscL.start(); oscR.start();

  _beats.oscL = oscL; _beats.oscR = oscR; _beats.gain = gain;
  _beats.active = waveId;

  // Optional carrier pulsation — slow, subtle, preserves the beat exactly.
  if (wave.pulsate) {
    const period = wave.pulsePeriod || 15;
    const depth = wave.pulseDepth || 0.4;
    const start = ctx.currentTime;
    const tick = () => {
      if (!_beats.oscL || !_beats.oscR) return;
      const t = ctx.currentTime - start;
      const offset = Math.sin((2 * Math.PI * t) / period) * depth;
      try {
        _beats.oscL.frequency.setTargetAtTime(baseLeft + offset, ctx.currentTime, 0.5);
        _beats.oscR.frequency.setTargetAtTime(baseRight + offset, ctx.currentTime, 0.5);
      } catch (_) {}
    };
    _beats.pulseTimer = setInterval(tick, 1000);
  }

  if (_beats.durationSec > 0) {
    _beats.stopTimer = setTimeout(() => stopBeats(false), _beats.durationSec * 1000);
  }

  requestWakeLock();
}

function stopBeats(immediate) {
  if (!_beats.ctx || !_beats.gain) { _hardStop(); return; }
  if (_beats.stopTimer) { clearTimeout(_beats.stopTimer); _beats.stopTimer = null; }
  if (_beats.pulseTimer) { clearInterval(_beats.pulseTimer); _beats.pulseTimer = null; }
  const fade = immediate ? 0.06 : 1.2;
  const ctx = _beats.ctx;
  const gain = _beats.gain;
  const oscL = _beats.oscL, oscR = _beats.oscR;
  // Mark inactive immediately so UI updates
  _beats.active = null;
  try {
    const now = ctx.currentTime;
    const cur = Math.max(0.0001, gain.gain.value || 0.0001);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(cur, now);
    gain.gain.linearRampToValueAtTime(0, now + fade);
  } catch (_) {}
  setTimeout(() => {
    try { oscL && oscL.stop(); } catch (_) {}
    try { oscR && oscR.stop(); } catch (_) {}
    try { oscL && oscL.disconnect(); } catch (_) {}
    try { oscR && oscR.disconnect(); } catch (_) {}
    try { gain && gain.disconnect(); } catch (_) {}
    _beats.oscL = null; _beats.oscR = null; _beats.gain = null;
    releaseWakeLock();
  }, fade * 1000 + 80);
}

let _wakeLock = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { _wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
}
function releaseWakeLock() {
  if (_wakeLock) { try { _wakeLock.release(); } catch (_) {} _wakeLock = null; }
}

async function renderBeatsView(container) {
  const stored = (await getSetting('beats')) || {};
  if (stored.volume != null) _beats.volume = stored.volume;
  if (stored.durationSec != null) _beats.durationSec = stored.durationSec;

  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <div>
      <div class="view-title">Beats</div>
      <div class="view-sub">Binaural — A minor, parasympathetic</div>
    </div>
  `;
  container.appendChild(header);

  const note = document.createElement('div');
  note.className = 'card';
  note.innerHTML = `
    <div class="muted" style="font-size:14px;line-height:1.5;">
      <strong>Headphones required.</strong> Each preset is fixed to the recommended carrier + beat for its task.
      <br><span style="font-size:12px;">iOS limit: audio stops if the screen locks or you switch apps. Screen will be kept on while playing.</span>
    </div>
  `;
  container.appendChild(note);

  const wavesCard = document.createElement('div');
  wavesCard.className = 'card';
  wavesCard.innerHTML = `<h3>State</h3><div class="beats-grid"></div>`;
  container.appendChild(wavesCard);
  const grid = wavesCard.querySelector('.beats-grid');
  for (const w of WAVES) {
    const btn = document.createElement('button');
    btn.className = 'beat-btn';
    btn.dataset.wave = w.id;
    btn.style.setProperty('--wc', w.color);
    btn.innerHTML = `
      <div class="beat-name">${w.name}</div>
      <div class="beat-range">Beat ${w.range}${w.pulsate ? ' · pulsed' : ''}</div>
      <div class="beat-use">${w.use}</div>
      <div class="beat-note">${w.note}</div>
      <div class="beat-countdown" data-wave="${w.id}" style="display:none;"></div>
    `;
    btn.addEventListener('click', () => {
      if (_beats.active === w.id) stopBeats(true);
      else startBeats(w.id);
      refreshActive();
    });
    grid.appendChild(btn);
  }
  let cdTimer = null;
  function refreshActive() {
    grid.querySelectorAll('.beat-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.wave === _beats.active);
    });
    grid.querySelectorAll('.beat-countdown').forEach((el) => { el.style.display = 'none'; el.textContent = ''; });
    if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
    if (_beats.active && _beats.durationSec > 0 && _beats.stopTimer) {
      const cdEl = grid.querySelector(`.beat-countdown[data-wave="${_beats.active}"]`);
      const endAt = Date.now() + _beats.durationSec * 1000;
      const fmtCd = (s) => {
        const m = Math.floor(s / 60);
        const r = s % 60;
        return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
      };
      const tick = () => {
        const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
        if (cdEl) { cdEl.style.display = ''; cdEl.textContent = '⏳ ' + fmtCd(left); }
        if (left <= 0) { clearInterval(cdTimer); refreshActive(); }
      };
      tick();
      cdTimer = setInterval(tick, 1000);
    }
  }
  refreshActive();

  const ctrlCard = document.createElement('div');
  ctrlCard.className = 'card';
  ctrlCard.innerHTML = `
    <h3>Volume & Duration</h3>
    <div class="setting-row">
      <div class="setting-label">Volume: <span id="beat-vol-val">${Math.round(_beats.volume*100)}%</span></div>
      <input class="slider-input" type="range" min="1" max="40" step="1" value="${Math.max(1, Math.round(_beats.volume*100))}" id="beat-vol" style="--c:#4a9a6a">
    </div>
    <div class="setting-row">
      <div class="setting-label">Auto-stop</div>
      <select class="input-text" id="beat-dur">
        <option value="0">Off (open-ended)</option>
        <option value="600">10 minutes</option>
        <option value="1500">25 minutes</option>
        <option value="3600">60 minutes</option>
      </select>
    </div>
    <div class="row-buttons" style="margin-top:8px;">
      <button class="btn-secondary" id="beat-stop">Stop</button>
    </div>
  `;
  container.appendChild(ctrlCard);
  ctrlCard.querySelector('#beat-dur').value = String(_beats.durationSec || 0);
  const volIn = ctrlCard.querySelector('#beat-vol');
  const volVal = ctrlCard.querySelector('#beat-vol-val');
  volIn.addEventListener('input', () => {
    _beats.volume = parseInt(volIn.value, 10) / 100;
    volVal.textContent = Math.round(_beats.volume * 100) + '%';
    if (_beats.gain && _beats.ctx) {
      _beats.gain.gain.setTargetAtTime(_beats.volume, _beats.ctx.currentTime, 0.1);
    }
    setSetting('beats', { volume: _beats.volume, durationSec: _beats.durationSec });
  });
  ctrlCard.querySelector('#beat-dur').addEventListener('change', (e) => {
    _beats.durationSec = parseInt(e.target.value, 10) || 0;
    setSetting('beats', { volume: _beats.volume, durationSec: _beats.durationSec });
    if (_beats.active && _beats.durationSec > 0) {
      if (_beats.stopTimer) clearTimeout(_beats.stopTimer);
      _beats.stopTimer = setTimeout(() => { stopBeats(false); refreshActive(); }, _beats.durationSec * 1000);
    }
    refreshActive();
  });
  ctrlCard.querySelector('#beat-stop').addEventListener('click', () => {
    stopBeats(true);
    refreshActive();
  });
}
