// Lazy AudioContext. Must be created on a user gesture.
let _audioCtx = null;
function audioCtx() {
  if (!_audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    _audioCtx = new Ctor();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

let _soundsEnabled = true;
async function loadSoundPref() {
  const v = await getSetting('soundsEnabled');
  if (v === false) _soundsEnabled = false;
}
function setSoundsEnabled(b) {
  _soundsEnabled = b;
  setSetting('soundsEnabled', b);
}
function soundsEnabled() { return _soundsEnabled; }

function tone(freq, start, dur, gain = 0.18) {
  const ctx = audioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

function playCheckSound() {
  if (!_soundsEnabled) return;
  // Rising chime: G5 → C6
  tone(784, 0,    0.10, 0.18);
  tone(1047, 0.07, 0.14, 0.16);
}

function playUncheckSound() {
  if (!_soundsEnabled) return;
  tone(440, 0, 0.10, 0.10);
}

// Floating "+X" inline badge anchored to the row
function showPointsPop(rowEl, points) {
  if (!rowEl || !points) return;
  const pop = document.createElement('div');
  pop.className = 'points-pop';
  pop.textContent = '+' + points.toLocaleString();
  rowEl.appendChild(pop);
  setTimeout(() => pop.remove(), 1400);
}

// Compress an image File to a JPEG data URL via canvas.
async function compressImage(file, maxDim = 1280, quality = 0.78) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  let w = img.width, h = img.height;
  if (Math.max(w, h) > maxDim) {
    const s = maxDim / Math.max(w, h);
    w = Math.round(w * s); h = Math.round(h * s);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

// Brief flash class on a row + checkbox
function flashCheck(rowEl) {
  const cb = rowEl.querySelector('.q-check');
  if (cb) {
    cb.classList.add('just-checked');
    setTimeout(() => cb.classList.remove('just-checked'), 400);
  }
  rowEl.classList.add('row-flash');
  setTimeout(() => rowEl.classList.remove('row-flash'), 700);
}
