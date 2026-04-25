// IndexedDB wrapper — CompassDB with `days` and `settings` stores.
const DB_NAME = 'CompassDB';
const DB_VERSION = 1;
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('days')) {
        db.createObjectStore('days', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(store, mode) {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function emptyQuestions() {
  const out = {};
  for (const q of QUESTIONS) out[q.id] = { checked: false, note: '' };
  return out;
}

function blankDay(date) {
  return {
    date,
    createdAt: null,
    lastEditedAt: null,
    sliders: { oura: 0, circumstances: 0, mood: 0, productivity: 0 },
    weather: null,
    questions: emptyQuestions(),
    intentions: '',
  };
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getDay(date) {
  const store = await tx('days', 'readonly');
  return reqAsPromise(store.get(date));
}

async function getOrInitDay(date) {
  const existing = await getDay(date);
  if (existing) {
    // Ensure all current questions exist (forward compat)
    let mutated = false;
    for (const q of QUESTIONS) {
      if (!existing.questions[q.id]) {
        existing.questions[q.id] = { checked: false, note: '' };
        mutated = true;
      }
    }
    if (mutated) await saveDay(existing, { silent: true });
    return existing;
  }
  return blankDay(date);
}

async function saveDay(record, opts = {}) {
  const now = new Date().toISOString();
  if (!record.createdAt) record.createdAt = now;
  if (!opts.silent) record.lastEditedAt = now;
  else if (!record.lastEditedAt) record.lastEditedAt = now;
  const store = await tx('days', 'readwrite');
  await reqAsPromise(store.put(record));
  return record;
}

async function getAllDays() {
  const store = await tx('days', 'readonly');
  const all = await reqAsPromise(store.getAll());
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

async function getDaysInRange(startISO, endISO) {
  const all = await getAllDays();
  return all.filter((d) => d.date >= startISO && d.date <= endISO);
}

async function getYesterdayRecord() {
  const all = await getAllDays();
  const today = todayISO();
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].date < today) return all[i];
  }
  return null;
}

async function exportAll() {
  const days = await getAllDays();
  const settings = await getAllSettings();
  return {
    app: 'Compass',
    exportedAt: new Date().toISOString(),
    version: 1,
    days,
    settings,
  };
}

async function importAll(data) {
  if (!data || !Array.isArray(data.days)) throw new Error('Invalid import file');
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const t = db.transaction(['days', 'settings'], 'readwrite');
    const dayStore = t.objectStore('days');
    const setStore = t.objectStore('settings');
    for (const d of data.days) dayStore.put(d);
    if (Array.isArray(data.settings)) for (const s of data.settings) setStore.put(s);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

async function wipeAll() {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const t = db.transaction(['days', 'settings'], 'readwrite');
    t.objectStore('days').clear();
    t.objectStore('settings').clear();
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

async function getSetting(key) {
  const store = await tx('settings', 'readonly');
  const r = await reqAsPromise(store.get(key));
  return r ? r.value : null;
}

async function setSetting(key, value) {
  const store = await tx('settings', 'readwrite');
  await reqAsPromise(store.put({ key, value }));
}

async function getAllSettings() {
  const store = await tx('settings', 'readonly');
  return reqAsPromise(store.getAll());
}

// Late edit helper — > 48h after end of day
function isLateEdit(record) {
  if (!record || !record.lastEditedAt) return false;
  const dayEnd = new Date(record.date + 'T23:59:59');
  const editedAt = new Date(record.lastEditedAt);
  const hoursAfter = (editedAt - dayEnd) / (1000 * 60 * 60);
  return hoursAfter > 48;
}

// Pillar completion percentage
function pillarCompletion(record, pillarId) {
  if (!record) return 0;
  const qs = QUESTIONS.filter((q) => q.pillar === pillarId);
  const checked = qs.filter((q) => record.questions[q.id] && record.questions[q.id].checked).length;
  return qs.length ? Math.round((checked / qs.length) * 100) : 0;
}

function overallCompletion(record) {
  if (!record) return 0;
  const checked = QUESTIONS.filter((q) => record.questions[q.id] && record.questions[q.id].checked).length;
  return Math.round((checked / QUESTIONS.length) * 100);
}
