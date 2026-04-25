// Per the cognitive directive: beat sets the state, carrier shapes how usable
// it is, pulsation is opt-in for immersion (theta + alpha). Each preset bakes
// the recommended carrier range and pulsation policy.
const WAVES = [
  {
    id: 'delta', name: 'Delta', range: '0.5–4 Hz', use: 'Deep sleep, healing',
    beat: 2.0, carrier: 100, carrierMin: 80,  carrierMax: 130, pulsation: false, color: '#4a7ab0',
    detail: 'Low carrier minimizes stimulation. No pulsation — full shutdown.',
  },
  {
    id: 'theta', name: 'Theta', range: '4–8 Hz', use: 'Meditation, gratitude, REM',
    beat: 6.0, carrier: 175, carrierMin: 150, carrierMax: 220, pulsation: true,  color: '#8a5ab0',
    detail: 'Mid-low carrier supports drift without sleep. Gentle pulsation deepens imagery.',
  },
  {
    id: 'alpha', name: 'Alpha', range: '8–13 Hz', use: 'Calm focus, flow',
    beat: 10.0, carrier: 250, carrierMin: 220, carrierMax: 300, pulsation: true,  color: '#4a9a6a',
    detail: 'Mid carrier balances calm and awareness. Subtle pulsation reduces monotony.',
  },
  {
    id: 'beta',  name: 'Beta',  range: '13–30 Hz', use: 'Active thinking, alertness',
    beat: 20.0, carrier: 360, carrierMin: 320, carrierMax: 420, pulsation: false, color: '#c9a84c',
    detail: 'Mid-high carrier adds alertness. No pulsation to preserve sharpness.',
  },
  {
    id: 'gamma', name: 'Gamma', range: '30–100 Hz', use: 'Insight, peak cognition',
    beat: 40.0, carrier: 500, carrierMin: 450, carrierMax: 600, pulsation: false, color: '#c05050',
    detail: 'Clean higher carrier maximizes precision. No pulsation.',
  },
];

let _beats = {
  ctx: null,
  oscL: null, oscR: null, gain: null,
  lfo: null, lfoGain: null,        // pulsation chain
  active: null,
  carrier: null,
  beat: null,
  volume: 0.15,
  durationSec: 0,
  pulsationOn: null,
  stopTimer: null,
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

  const carrier = _beats.carrier ?? wave.carrier;
  const beat = _beats.beat ?? wave.beat;
  const pulse = _beats.pulsationOn ?? wave.pulsation;

  const merger = ctx.createChannelMerger(2);
  const oscL = ctx.createOscillator(); oscL.type = 'sine';
  const oscR = ctx.createOscillator(); oscR.type = 'sine';
  oscL.frequency.value = carrier - beat / 2;
  oscR.frequency.value = carrier + beat / 2;

  // Pulsation: a slow LFO modulates BOTH carriers together so the gap stays
  // constant. Amplitude is tiny (a couple Hz) and frequency is well below
  // perceptible rhythm (0.05–0.2 Hz).
  let lfo = null, lfoGain = null;
  if (pulse) {
    lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.08;
    lfoGain = ctx.createGain(); lfoGain.gain.value = 1.5;
    lfo.connect(lfoGain);
    lfoGain.connect(oscL.frequency);
    lfoGain.connect(oscR.frequency);
    lfo.start();
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(_beats.volume, ctx.currentTime + 0.8);

  oscL.connect(merger, 0, 0);
  oscR.connect(merger, 0, 1);
  merger.connect(gain).connect(ctx.destination);
  oscL.start(); oscR.start();

  _beats.oscL = oscL; _beats.oscR = oscR; _beats.gain = gain;
  _beats.lfo = lfo; _beats.lfoGain = lfoGain;
  _beats.active = waveId;
  _beats.carrier = carrier;
  _beats.beat = beat;
  _beats.pulsationOn = pulse;
  requestWakeLock();

  if (_beats.durationSec > 0) {
    _beats.stopTimer = setTimeout(() => stopBeats(false), _beats.durationSec * 1000);
  }
}

function stopBeats(immediate) {
  if (_beats.stopTimer) { clearTimeout(_beats.stopTimer); _beats.stopTimer = null; }
  const { ctx, oscL, oscR, gain, lfo, lfoGain } = _beats;
  _beats.active = null;
  if (!ctx) return;
  const fade = immediate ? 0.05 : 1.2;
  if (gain) {
    try {
      const now = ctx.currentTime;
      const cur = Math.max(0.0001, gain.gain.value);
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(cur, now);
      gain.gain.linearRampToValueAtTime(0, now + fade);
    } catch (_) {}
  }
  setTimeout(() => {
    try { if (oscL) oscL.stop(); } catch (_) {}
    try { if (oscR) oscR.stop(); } catch (_) {}
    try { if (lfo)  lfo.stop();  } catch (_) {}
    try { if (oscL) oscL.disconnect(); } catch (_) {}
    try { if (oscR) oscR.disconnect(); } catch (_) {}
    try { if (lfo)  lfo.disconnect();  } catch (_) {}
    try { if (lfoGain) lfoGain.disconnect(); } catch (_) {}
    try { if (gain) gain.disconnect(); } catch (_) {}
    _beats.oscL = null; _beats.oscR = null; _beats.gain = null;
    _beats.lfo = null; _beats.lfoGain = null;
  }, fade * 1000 + 60);
  releaseWakeLock();
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
      <div class="view-sub">Binaural focus / meditation</div>
    </div>
  `;
  container.appendChild(header);

  const note = document.createElement('div');
  note.className = 'card';
  note.innerHTML = `
    <div class="muted" style="font-size:14px;line-height:1.5;">
      <strong>Headphones required.</strong> The beat (frequency gap) drives the brain state. The carrier shapes how the state feels. Pulsation deepens immersion for theta and alpha.
      <br><span style="font-size:12px;">iOS limitation: audio stops if you lock the screen, switch apps, or close Compass.</span>
    </div>
  `;
  container.appendChild(note);

  const wavesCard = document.createElement('div');
  wavesCard.className = 'card';
  wavesCard.innerHTML = `<h3>Brain Wave</h3><div class="beats-grid"></div>`;
  container.appendChild(wavesCard);
  const grid = wavesCard.querySelector('.beats-grid');

  const ctrlCard = document.createElement('div');
  ctrlCard.className = 'card';
  ctrlCard.innerHTML = `<h3>Tuning</h3><div id="beats-tune"></div>`;
  container.appendChild(ctrlCard);
  const tune = ctrlCard.querySelector('#beats-tune');

  for (const w of WAVES) {
    const btn = document.createElement('button');
    btn.className = 'beat-btn';
    btn.dataset.wave = w.id;
    btn.style.setProperty('--wc', w.color);
    btn.innerHTML = `
      <div class="beat-name">${w.name}</div>
      <div class="beat-range">Beat ${w.beat} Hz · Carrier ${w.carrier} Hz</div>
      <div class="beat-use">${w.use}</div>
      <div class="beat-detail">${w.detail}</div>
    `;
    btn.addEventListener('click', () => {
      if (_beats.active === w.id) {
        stopBeats(true);
        _beats.carrier = null; _beats.beat = null; _beats.pulsationOn = null;
      } else {
        _beats.carrier = w.carrier; _beats.beat = w.beat; _beats.pulsationOn = w.pulsation;
        startBeats(w.id);
      }
      refreshActive();
      renderTune();
    });
    grid.appendChild(btn);
  }

  function refreshActive() {
    grid.querySelectorAll('.beat-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.wave === _beats.active);
    });
  }

  function renderTune() {
    if (!_beats.active) {
      tune.innerHTML = '<div class="muted" style="font-size:14px;">Pick a brain wave above to start. Tuning controls will appear here.</div>';
      return;
    }
    const w = WAVES.find((x) => x.id === _beats.active);
    const carrier = _beats.carrier ?? w.carrier;
    tune.innerHTML = `
      <div class="setting-row">
        <div class="setting-label">Beat: <span id="b-beat-val">${_beats.beat.toFixed(1)} Hz</span></div>
        <input type="range" min="${Math.max(0.5, w.beat - 4)}" max="${w.beat + 4}" step="0.5" value="${_beats.beat}" id="b-beat" class="slider-input" style="--c:${w.color}">
      </div>
      <div class="setting-row">
        <div class="setting-label">Carrier: <span id="b-car-val">${carrier} Hz</span> <span class="muted" style="font-size:12px;">(recommended ${w.carrierMin}–${w.carrierMax})</span></div>
        <input type="range" min="${w.carrierMin}" max="${w.carrierMax}" step="5" value="${carrier}" id="b-car" class="slider-input" style="--c:${w.color}">
      </div>
      <div class="setting-row">
        <div class="setting-label">Volume: <span id="b-vol-val">${Math.round(_beats.volume*100)}%</span></div>
        <input type="range" min="0" max="40" step="1" value="${Math.round(_beats.volume*100)}" id="b-vol" class="slider-input" style="--c:#4a9a6a">
      </div>
      <label class="setting-row" style="flex-direction:row;align-items:center;justify-content:space-between;">
        <div>
          <div class="setting-label">Pulsation</div>
          <div class="muted" style="font-size:12px;">Slow movement of the carriers (gap stays fixed). Recommended only for theta & alpha.</div>
        </div>
        <input type="checkbox" id="b-pulse" ${_beats.pulsationOn ? 'checked' : ''} style="width:28px;height:28px;">
      </label>
      <div class="setting-row">
        <div class="setting-label">Auto-stop</div>
        <select class="input-text" id="b-dur">
          <option value="0">Off (open-ended)</option>
          <option value="600">10 minutes</option>
          <option value="1500">25 minutes</option>
          <option value="3600">60 minutes</option>
        </select>
      </div>
      <div class="row-buttons" style="margin-top:8px;">
        <button class="btn-secondary" id="b-stop">Stop</button>
      </div>
    `;
    tune.querySelector('#b-dur').value = String(_beats.durationSec || 0);

    tune.querySelector('#b-beat').addEventListener('input', (e) => {
      _beats.beat = parseFloat(e.target.value);
      tune.querySelector('#b-beat-val').textContent = _beats.beat.toFixed(1) + ' Hz';
      applyLive();
    });
    tune.querySelector('#b-car').addEventListener('input', (e) => {
      _beats.carrier = parseInt(e.target.value, 10);
      tune.querySelector('#b-car-val').textContent = _beats.carrier + ' Hz';
      applyLive();
    });
    tune.querySelector('#b-vol').addEventListener('input', (e) => {
      _beats.volume = parseInt(e.target.value, 10) / 100;
      tune.querySelector('#b-vol-val').textContent = Math.round(_beats.volume * 100) + '%';
      if (_beats.gain && _beats.ctx) _beats.gain.gain.setTargetAtTime(_beats.volume, _beats.ctx.currentTime, 0.1);
      persist();
    });
    tune.querySelector('#b-pulse').addEventListener('change', (e) => {
      _beats.pulsationOn = e.target.checked;
      // Restart for clean pulsation chain
      const id = _beats.active;
      if (id) startBeats(id);
    });
    tune.querySelector('#b-dur').addEventListener('change', (e) => {
      _beats.durationSec = parseInt(e.target.value, 10) || 0;
      persist();
      if (_beats.active && _beats.durationSec > 0) {
        if (_beats.stopTimer) clearTimeout(_beats.stopTimer);
        _beats.stopTimer = setTimeout(() => { stopBeats(false); refreshActive(); renderTune(); }, _beats.durationSec * 1000);
      }
    });
    tune.querySelector('#b-stop').addEventListener('click', () => {
      stopBeats(true);
      refreshActive();
      renderTune();
    });
  }

  function applyLive() {
    if (!_beats.active || !_beats.oscL || !_beats.oscR || !_beats.ctx) return;
    const c = _beats.carrier, b = _beats.beat;
    _beats.oscL.frequency.setTargetAtTime(c - b / 2, _beats.ctx.currentTime, 0.05);
    _beats.oscR.frequency.setTargetAtTime(c + b / 2, _beats.ctx.currentTime, 0.05);
  }
  function persist() {
    setSetting('beats', { volume: _beats.volume, durationSec: _beats.durationSec });
  }

  refreshActive();
  renderTune();
}
