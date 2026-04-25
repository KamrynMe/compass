const WAVES = [
  { id: 'delta', name: 'Delta',  range: '0.5–4 Hz', use: 'Deep sleep, healing',         offset: 2,  color: '#4a7ab0' },
  { id: 'theta', name: 'Theta',  range: '4–8 Hz',   use: 'Meditation, gratitude, REM',  offset: 6,  color: '#8a5ab0' },
  { id: 'alpha', name: 'Alpha',  range: '8–13 Hz',  use: 'Calm focus, flow',            offset: 10, color: '#4a9a6a' },
  { id: 'beta',  name: 'Beta',   range: '13–30 Hz', use: 'Active thinking, alertness',  offset: 20, color: '#c9a84c' },
  { id: 'gamma', name: 'Gamma',  range: '30–100 Hz',use: 'Insight, peak cognition',     offset: 40, color: '#c05050' },
];

let _beats = {
  ctx: null,
  oscL: null, oscR: null, gain: null,
  active: null,        // wave id when playing
  carrier: 200,
  volume: 0.15,
  durationSec: 0,      // 0 = open-ended
  stopTimer: null,
  fadeTimer: null,
};

function startBeats(waveId) {
  stopBeats(true);
  const wave = WAVES.find((w) => w.id === waveId);
  if (!wave) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) { showToast('Audio not supported'); return; }
  if (!_beats.ctx) _beats.ctx = new Ctor();
  if (_beats.ctx.state === 'suspended') _beats.ctx.resume();
  const ctx = _beats.ctx;

  const merger = ctx.createChannelMerger(2);
  const oscL = ctx.createOscillator(); oscL.type = 'sine';
  const oscR = ctx.createOscillator(); oscR.type = 'sine';
  oscL.frequency.value = _beats.carrier - wave.offset / 2;
  oscR.frequency.value = _beats.carrier + wave.offset / 2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(_beats.volume, ctx.currentTime + 0.8);

  oscL.connect(merger, 0, 0);
  oscR.connect(merger, 0, 1);
  merger.connect(gain).connect(ctx.destination);
  oscL.start(); oscR.start();

  _beats.oscL = oscL; _beats.oscR = oscR; _beats.gain = gain;
  _beats.active = waveId;

  if (_beats.durationSec > 0) {
    _beats.stopTimer = setTimeout(() => stopBeats(false), _beats.durationSec * 1000);
  }
}

function stopBeats(immediate) {
  if (_beats.stopTimer) { clearTimeout(_beats.stopTimer); _beats.stopTimer = null; }
  const { ctx, oscL, oscR, gain } = _beats;
  if (!ctx || !oscL) { _beats.active = null; return; }
  const fade = immediate ? 0.04 : 1.5;
  try {
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
  } catch (_) {}
  setTimeout(() => {
    try { oscL.stop(); oscR.stop(); } catch (_) {}
    _beats.oscL = null; _beats.oscR = null; _beats.gain = null;
  }, fade * 1000 + 50);
  _beats.active = null;
}

async function renderBeatsView(container) {
  // Restore last-used settings
  const stored = (await getSetting('beats')) || {};
  if (stored.carrier) _beats.carrier = stored.carrier;
  if (stored.volume != null) _beats.volume = stored.volume;
  if (stored.durationSec != null) _beats.durationSec = stored.durationSec;

  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <div>
      <div class="view-title">Beats</div>
      <div class="view-sub">Binaural focus / meditation</div>
    </div>
  `;
  container.appendChild(header);

  const note = document.createElement('div');
  note.className = 'card';
  note.innerHTML = `
    <div class="muted" style="font-size:14px;line-height:1.5;">
      <strong>Headphones required.</strong> Binaural beats only work with stereo separation between ears.
      <br><span style="font-size:12px;">iOS PWA note: audio pauses when the screen locks.</span>
    </div>
  `;
  container.appendChild(note);

  // Wave preset cards
  const wavesCard = document.createElement('div');
  wavesCard.className = 'card';
  wavesCard.innerHTML = `<h3>Brain Wave</h3><div class="beats-grid"></div>`;
  container.appendChild(wavesCard);
  const grid = wavesCard.querySelector('.beats-grid');
  for (const w of WAVES) {
    const btn = document.createElement('button');
    btn.className = 'beat-btn';
    btn.dataset.wave = w.id;
    btn.style.setProperty('--wc', w.color);
    btn.innerHTML = `
      <div class="beat-name">${w.name}</div>
      <div class="beat-range">${w.range}</div>
      <div class="beat-use">${w.use}</div>
    `;
    btn.addEventListener('click', () => {
      if (_beats.active === w.id) {
        stopBeats(true);
      } else {
        startBeats(w.id);
      }
      refreshActive();
    });
    grid.appendChild(btn);
  }
  function refreshActive() {
    grid.querySelectorAll('.beat-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.wave === _beats.active);
    });
  }
  refreshActive();

  // Controls card
  const ctrlCard = document.createElement('div');
  ctrlCard.className = 'card';
  ctrlCard.innerHTML = `
    <h3>Controls</h3>
    <div class="setting-row">
      <div class="setting-label">Carrier frequency: <span id="beat-carrier-val">${_beats.carrier} Hz</span></div>
      <input class="slider-input" type="range" min="80" max="500" step="5" value="${_beats.carrier}" id="beat-carrier" style="--c:#4a7ab0">
    </div>
    <div class="setting-row">
      <div class="setting-label">Volume: <span id="beat-vol-val">${Math.round(_beats.volume*100)}%</span></div>
      <input class="slider-input" type="range" min="0" max="40" step="1" value="${Math.round(_beats.volume*100)}" id="beat-vol" style="--c:#4a9a6a">
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

  const carrierIn = ctrlCard.querySelector('#beat-carrier');
  const carrierVal = ctrlCard.querySelector('#beat-carrier-val');
  carrierIn.addEventListener('input', () => {
    _beats.carrier = parseInt(carrierIn.value, 10);
    carrierVal.textContent = _beats.carrier + ' Hz';
    if (_beats.active && _beats.oscL && _beats.oscR) {
      const wave = WAVES.find((w) => w.id === _beats.active);
      _beats.oscL.frequency.setTargetAtTime(_beats.carrier - wave.offset / 2, _beats.ctx.currentTime, 0.05);
      _beats.oscR.frequency.setTargetAtTime(_beats.carrier + wave.offset / 2, _beats.ctx.currentTime, 0.05);
    }
    persist();
  });
  const volIn = ctrlCard.querySelector('#beat-vol');
  const volVal = ctrlCard.querySelector('#beat-vol-val');
  volIn.addEventListener('input', () => {
    _beats.volume = parseInt(volIn.value, 10) / 100;
    volVal.textContent = Math.round(_beats.volume * 100) + '%';
    if (_beats.gain && _beats.ctx) {
      _beats.gain.gain.setTargetAtTime(_beats.volume, _beats.ctx.currentTime, 0.1);
    }
    persist();
  });
  ctrlCard.querySelector('#beat-dur').addEventListener('change', (e) => {
    _beats.durationSec = parseInt(e.target.value, 10) || 0;
    persist();
    if (_beats.active && _beats.durationSec > 0) {
      if (_beats.stopTimer) clearTimeout(_beats.stopTimer);
      _beats.stopTimer = setTimeout(() => { stopBeats(false); refreshActive(); }, _beats.durationSec * 1000);
    }
  });
  ctrlCard.querySelector('#beat-stop').addEventListener('click', () => {
    stopBeats(true);
    refreshActive();
  });

  function persist() {
    setSetting('beats', { carrier: _beats.carrier, volume: _beats.volume, durationSec: _beats.durationSec });
  }
}
