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
    note: 'A4 carrier (446 Hz) — slightly tuned-up for clean perceived pitch with wide beat',
    carrier: 446.00, beat: 40, pulsate: false, color: '#c05050' },
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

// Smooth crossfade: fade current beats out while next fades in.
function transitionToWave(waveId, fadeSec = 2.0) {
  const wave = WAVES.find((w) => w.id === waveId);
  if (!wave) return;
  if (!_beats.ctx || !_beats.gain) {
    return startBeats(waveId);
  }
  const ctx = _beats.ctx;
  // Fade out current
  const oldGain = _beats.gain;
  const oldL = _beats.oscL, oldR = _beats.oscR, oldPulseTimer = _beats.pulseTimer;
  try {
    const now = ctx.currentTime;
    const cur = Math.max(0.0001, oldGain.gain.value || 0.0001);
    oldGain.gain.cancelScheduledValues(now);
    oldGain.gain.setValueAtTime(cur, now);
    oldGain.gain.linearRampToValueAtTime(0, now + fadeSec);
  } catch (_) {}
  if (oldPulseTimer) clearInterval(oldPulseTimer);
  setTimeout(() => {
    try { oldL && oldL.stop(); } catch (_) {}
    try { oldR && oldR.stop(); } catch (_) {}
    try { oldL && oldL.disconnect(); } catch (_) {}
    try { oldR && oldR.disconnect(); } catch (_) {}
    try { oldGain && oldGain.disconnect(); } catch (_) {}
  }, fadeSec * 1000 + 50);

  // Build new
  const merger = ctx.createChannelMerger(2);
  const oscL = ctx.createOscillator(); oscL.type = 'sine';
  const oscR = ctx.createOscillator(); oscR.type = 'sine';
  const baseLeft = wave.carrier - wave.beat / 2;
  const baseRight = wave.carrier + wave.beat / 2;
  oscL.frequency.value = baseLeft;
  oscR.frequency.value = baseRight;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(_beats.volume, ctx.currentTime + fadeSec);
  oscL.connect(merger, 0, 0);
  oscR.connect(merger, 0, 1);
  merger.connect(gain).connect(ctx.destination);
  oscL.start(); oscR.start();
  _beats.oscL = oscL; _beats.oscR = oscR; _beats.gain = gain;
  _beats.active = waveId;
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
}

// --- Circadian auto mode ---
let _circadianTimer = null;
const CIRCADIAN_DEFAULTS = [
  { offsetMin: 0,    wave: 'beta'  }, // wake
  { offsetMin: 40,   wave: 'gamma' }, // wake + 40 min
  { offsetMin: 240,  wave: 'alpha' }, // wake + 4h
  { offsetMin: 600,  wave: 'theta' }, // 4h before wind (10h after wake)
  { offsetMin: 840,  wave: 'delta' }, // wind (14h after wake)
  { offsetMin: 1350, wave: 'theta' }, // 90 min before next wake
  { offsetMin: 1410, wave: 'alpha' }, // 30 min before next wake
];

async function getCircadianTransitions() {
  const stored = await getSetting('circadianTransitions');
  return Array.isArray(stored) && stored.length ? stored : CIRCADIAN_DEFAULTS;
}

// Default volume curve (1-100, percent). Defaults align with frequency transitions.
const CIRCADIAN_VOLUME_DEFAULTS = [
  { offsetMin: 0,    vol: 22 },
  { offsetMin: 40,   vol: 22 },
  { offsetMin: 240,  vol: 18 },
  { offsetMin: 600,  vol: 16 },
  { offsetMin: 840,  vol: 12 },
  { offsetMin: 1350, vol: 14 },
  { offsetMin: 1410, vol: 18 },
];

async function getCircadianVolumeNodes() {
  const stored = await getSetting('circadianVolumeNodes');
  return Array.isArray(stored) && stored.length ? stored : CIRCADIAN_VOLUME_DEFAULTS;
}

function volumeAtMinute(m, nodes) {
  if (!nodes || !nodes.length) return _beats.volume * 100;
  const sorted = nodes.slice().sort((a, b) => a.offsetMin - b.offsetMin);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].offsetMin >= m) {
      if (i === 0) return sorted[0].vol;
      const prev = sorted[i - 1], next = sorted[i];
      const t = (m - prev.offsetMin) / Math.max(1, (next.offsetMin - prev.offsetMin));
      return prev.vol + (next.vol - prev.vol) * t;
    }
  }
  // wrap
  const last = sorted[sorted.length - 1], first = sorted[0];
  const wrapMin = Math.max(1, (1440 - last.offsetMin) + first.offsetMin);
  const t = (m - last.offsetMin) / wrapMin;
  return last.vol + (first.vol - last.vol) * t;
}

async function waveForNow() {
  const wakeStr = (await getSetting('wakeTime')) || '05:00';
  const [wH, wM] = wakeStr.split(':').map(Number);
  const now = new Date();
  const minsNow = now.getHours() * 60 + now.getMinutes();
  const wakeMin = wH * 60 + wM;
  let m = (minsNow - wakeMin + 24 * 60) % (24 * 60);
  const trans = (await getCircadianTransitions()).slice().sort((a, b) => a.offsetMin - b.offsetMin);
  let active = trans[trans.length - 1].wave;
  for (const t of trans) {
    if (t.offsetMin <= m) active = t.wave;
    else break;
  }
  return active;
}

function stopCircadian() {
  if (_circadianTimer) { clearInterval(_circadianTimer); _circadianTimer = null; }
  _beats.circadian = false;
}

// --- Custom songs (sequence of segments) ---
let _songTimer = null;
let _songIndex = 0;
let _songActive = null; // song id when playing

async function loadSongs() {
  return (await getSetting('beatSongs')) || [];
}
async function saveSongs(list) { await setSetting('beatSongs', list); }

function stopSong() {
  if (_songTimer) { clearTimeout(_songTimer); _songTimer = null; }
  _songActive = null;
  _songIndex = 0;
}

function playSong(song) {
  stopCircadian();
  stopSong();
  if (!song?.segments?.length) return;
  _songActive = song.id;
  _songIndex = 0;
  const playSegment = () => {
    if (_songActive !== song.id) return;
    if (_songIndex >= song.segments.length) {
      stopBeats(true);
      stopSong();
      return;
    }
    const seg = song.segments[_songIndex];
    const prevVol = _beats.volume;
    _beats.volume = Math.max(0.01, Math.min(1.0, (seg.vol || 20) / 100));
    if (_beats.active) transitionToWave(seg.wave);
    else startBeats(seg.wave);
    _beats.volume = prevVol;
    _songTimer = setTimeout(() => {
      _songIndex++;
      playSegment();
    }, Math.max(1000, (seg.durationSec || 60) * 1000));
  };
  playSegment();
}

async function applyCircadianVolume() {
  if (!_beats.circadian || !_beats.gain || !_beats.ctx) return;
  const wakeStr = (await getSetting('wakeTime')) || '05:00';
  const [wH, wM] = wakeStr.split(':').map(Number);
  const now = new Date();
  const wakeMin = wH * 60 + wM;
  const minsNow = now.getHours() * 60 + now.getMinutes();
  const m = (minsNow - wakeMin + 24 * 60) % (24 * 60);
  const nodes = await getCircadianVolumeNodes();
  const pct = Math.max(1, Math.min(100, volumeAtMinute(m, nodes)));
  const target = pct / 100;
  try { _beats.gain.gain.setTargetAtTime(target, _beats.ctx.currentTime, 1.0); } catch (_) {}
}

async function startCircadian() {
  stopCircadian();
  _beats.circadian = true;
  const wave = await waveForNow();
  if (_beats.active) transitionToWave(wave); else startBeats(wave);
  await applyCircadianVolume();
  // Re-check every 30 seconds for state + volume curve
  _circadianTimer = setInterval(async () => {
    const next = await waveForNow();
    if (next !== _beats.active) transitionToWave(next);
    await applyCircadianVolume();
  }, 30 * 1000);
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

  // Circadian button FIRST
  const circBtn = document.createElement('button');
  circBtn.className = 'beat-btn beat-circadian';
  circBtn.dataset.wave = '__circadian';
  circBtn.style.setProperty('--wc', '#2a8a8a');
  circBtn.innerHTML = `
    <div class="beat-name">Circadian</div>
    <div class="beat-range">Auto</div>
    <div class="beat-use">Plays the right state for the time of day</div>
    <div class="beat-note">Theta → Delta → Theta → Alpha → Beta → Gamma → Alpha → Theta</div>
  `;
  circBtn.addEventListener('click', async () => {
    if (_beats.circadian) {
      stopCircadian();
      stopBeats(true);
    } else {
      await startCircadian();
    }
    refreshActive();
  });
  grid.appendChild(circBtn);

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
      if (_beats.circadian) stopCircadian();
      if (_beats.active === w.id) stopBeats(true);
      else if (_beats.active) transitionToWave(w.id);
      else startBeats(w.id);
      refreshActive();
    });
    grid.appendChild(btn);
  }

  let cdTimer = null;
  function refreshActive() {
    grid.querySelectorAll('.beat-btn').forEach((b) => {
      const isCirc = b.dataset.wave === '__circadian';
      b.classList.toggle('active', isCirc ? !!_beats.circadian : (b.dataset.wave === _beats.active));
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
    stopCircadian();
    stopSong();
    stopBeats(true);
    refreshActive();
  });

  await renderSongsCard(container);
}

async function renderSongsCard(container) {
  const card = document.createElement('div');
  card.className = 'card';
  container.appendChild(card);
  let editingId = null;

  async function draw() {
    const songs = await loadSongs();
    const editing = editingId ? songs.find((s) => s.id === editingId) : null;
    const listHtml = songs.length === 0
      ? '<div class="muted" style="font-size:14px;padding:8px 0;">No custom songs yet.</div>'
      : songs.map((s) => {
        const isPlaying = _songActive === s.id;
        const totalSec = (s.segments || []).reduce((t, seg) => t + (seg.durationSec || 0), 0);
        return `
          <div class="custom-row" data-id="${s.id}">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:15px;">${escapeHtmlBeats(s.name || 'Untitled')}</div>
              <div class="muted" style="font-size:12px;">${(s.segments || []).length} parts · ${Math.round(totalSec / 60)} min</div>
            </div>
            <button class="var-btn" data-act="play" style="background:${isPlaying ? '#c05050' : 'var(--gold)'};color:white;">${isPlaying ? 'Stop' : '▶'}</button>
            <button class="var-btn" data-act="edit">Edit</button>
            <button class="var-btn" data-act="del" style="background:#fce4e4;color:var(--e-color);">×</button>
          </div>
        `;
      }).join('');

    card.innerHTML = `
      <h3>Custom Songs</h3>
      <div class="setting-help">Sequence presets into a "song" with per-part duration and volume. Plays segments back-to-back with smooth crossfades.</div>
      <div id="songs-list" style="display:flex;flex-direction:column;gap:8px;margin:10px 0;">${listHtml}</div>
      ${editing ? renderSongEditor(editing) : `
        <div class="row-buttons"><button class="btn-primary" id="songs-add">+ Add custom song</button></div>
      `}
    `;

    card.querySelectorAll('.custom-row').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-act="play"]').addEventListener('click', async () => {
        if (_songActive === id) {
          stopSong();
          stopBeats(true);
        } else {
          const songs2 = await loadSongs();
          const s = songs2.find((x) => x.id === id);
          if (s) playSong(s);
        }
        await draw();
      });
      row.querySelector('[data-act="edit"]').addEventListener('click', () => {
        editingId = id;
        draw();
      });
      row.querySelector('[data-act="del"]').addEventListener('click', async () => {
        if (!confirm('Delete this song?')) return;
        if (_songActive === id) { stopSong(); stopBeats(true); }
        const list = await loadSongs();
        await saveSongs(list.filter((s) => s.id !== id));
        if (editingId === id) editingId = null;
        await draw();
      });
    });

    if (!editing) {
      card.querySelector('#songs-add')?.addEventListener('click', () => {
        const id = 'song_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const newSong = { id, name: 'New song', segments: [{ wave: 'alpha', durationSec: 600, vol: 18 }] };
        editingId = id;
        loadSongs().then((list) => { list.push(newSong); return saveSongs(list); }).then(draw);
      });
    } else {
      wireSongEditor(card, editing, draw, () => { editingId = null; draw(); });
    }
  }
  await draw();
}

function renderSongEditor(song) {
  const WAVE_OPTS = ['delta','theta','alpha','beta','gamma'];
  return `
    <div style="border-top:1px solid var(--rule);padding-top:14px;margin-top:10px;">
      <div class="setting-row">
        <div class="setting-label">Name</div>
        <input class="input-text" id="se-name" value="${escapeHtmlBeats(song.name || '')}">
      </div>
      <div id="se-segs" style="display:flex;flex-direction:column;gap:8px;margin:10px 0;">
        ${(song.segments || []).map((seg, i) => `
          <div class="seg-row" data-i="${i}" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <select class="input-text seg-wave" style="max-width:110px;">
              ${WAVE_OPTS.map((w) => `<option value="${w}" ${seg.wave===w?'selected':''}>${w[0].toUpperCase()+w.slice(1)}</option>`).join('')}
            </select>
            <input type="number" class="input-text seg-min" min="0" max="240" step="1" value="${Math.floor((seg.durationSec || 60) / 60)}" style="max-width:70px;">
            <span style="align-self:center;font-size:12px;">min</span>
            <input type="number" class="input-text seg-vol" min="1" max="100" step="1" value="${seg.vol || 20}" style="max-width:70px;">
            <span style="align-self:center;font-size:12px;">%</span>
            <button class="var-btn" data-act="seg-del" style="background:#fce4e4;color:var(--e-color);">×</button>
          </div>
        `).join('')}
      </div>
      <div class="row-buttons">
        <button class="btn-secondary" id="se-add-seg">+ Add segment</button>
        <button class="btn-secondary" id="se-cancel">Cancel</button>
        <button class="btn-primary" id="se-save">Save</button>
      </div>
    </div>
  `;
}

function wireSongEditor(card, song, draw, cancel) {
  const WAVE_OPTS = ['delta','theta','alpha','beta','gamma'];
  card.querySelectorAll('.seg-row').forEach((row) => {
    row.querySelector('[data-act="seg-del"]').addEventListener('click', () => row.remove());
  });
  card.querySelector('#se-add-seg').addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'seg-row';
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
    row.innerHTML = `
      <select class="input-text seg-wave" style="max-width:110px;">
        ${WAVE_OPTS.map((w) => `<option value="${w}">${w[0].toUpperCase()+w.slice(1)}</option>`).join('')}
      </select>
      <input type="number" class="input-text seg-min" min="0" max="240" step="1" value="10" style="max-width:70px;">
      <span style="align-self:center;font-size:12px;">min</span>
      <input type="number" class="input-text seg-vol" min="1" max="100" step="1" value="20" style="max-width:70px;">
      <span style="align-self:center;font-size:12px;">%</span>
      <button class="var-btn" data-act="seg-del" style="background:#fce4e4;color:var(--e-color);">×</button>
    `;
    row.querySelector('[data-act="seg-del"]').addEventListener('click', () => row.remove());
    card.querySelector('#se-segs').appendChild(row);
  });
  card.querySelector('#se-cancel').addEventListener('click', cancel);
  card.querySelector('#se-save').addEventListener('click', async () => {
    const name = card.querySelector('#se-name').value.trim() || 'Untitled';
    const segs = [];
    card.querySelectorAll('.seg-row').forEach((row) => {
      const wave = row.querySelector('.seg-wave').value;
      const min = parseInt(row.querySelector('.seg-min').value, 10) || 0;
      const vol = parseInt(row.querySelector('.seg-vol').value, 10) || 20;
      if (WAVE_OPTS.includes(wave) && min > 0) segs.push({ wave, durationSec: min * 60, vol: Math.max(1, Math.min(100, vol)) });
    });
    if (!segs.length) { showToast('Add at least one segment'); return; }
    const list = await loadSongs();
    const idx = list.findIndex((s) => s.id === song.id);
    if (idx >= 0) list[idx] = { ...song, name, segments: segs };
    else list.push({ ...song, name, segments: segs });
    await saveSongs(list);
    showToast('Song saved');
    cancel();
  });
}

function escapeHtmlBeats(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
