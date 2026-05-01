// Supabase sync: device-keyed last-write-wins of the entire export blob.
// Designed to be invisible — set URL + anon key once, then it auto-syncs.
//
// Schema (run once in Supabase SQL editor):
//   create table scheduler_state (
//     device_id uuid primary key,
//     data jsonb not null,
//     updated_at timestamptz not null default now()
//   );
//   alter table scheduler_state enable row level security;
//   create policy "anon read+write own row"
//     on scheduler_state for all using (true) with check (true);
//
// The anon key is a public token; safe to ship in client. The device_id keeps
// each device's row separate. To merge two devices' history, the user can
// "Pull from cloud" once on the second device.

const SYNC_DEBOUNCE_MS = 4000;
let _syncTimer = null;
let _syncing = false;
let _lastPullAt = 0;

// Pre-configured project — auto-sync works the moment the app loads.
const SYNC_DEFAULT_URL = 'https://llvqfneoelymvkigltqa.supabase.co';
const SYNC_DEFAULT_KEY = 'sb_publishable_klbrY4121TC85eO-jJUwvg_ecZAXqgW';

async function syncConfig() {
  const stored = await getSetting('syncConfig');
  if (stored && stored.url && stored.anonKey) return stored;
  // Default — write once so the user can later edit/disable in Settings.
  const def = { url: SYNC_DEFAULT_URL, anonKey: SYNC_DEFAULT_KEY, autoSync: true };
  await setSetting('syncConfig', def);
  return def;
}
async function setSyncConfig(c) { await setSetting('syncConfig', c); }
async function syncDeviceId() {
  let id = await getSetting('deviceId');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      ('dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2));
    await setSetting('deviceId', id);
  }
  return id;
}

async function syncEnabled() {
  const c = await syncConfig();
  return !!(c && c.url && c.anonKey);
}

function _headers(c) {
  return {
    'apikey': c.anonKey,
    'Authorization': `Bearer ${c.anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal',
  };
}

async function pushSyncNow() {
  if (_syncing) return;
  const c = await syncConfig();
  if (!c) return;
  _syncing = true;
  try {
    const data = await exportAll();
    const deviceId = await syncDeviceId();
    const url = `${c.url.replace(/\/$/, '')}/rest/v1/scheduler_state`;
    const r = await fetch(url, {
      method: 'POST',
      headers: _headers(c),
      body: JSON.stringify({
        device_id: deviceId,
        data,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!r.ok && r.status !== 201 && r.status !== 200) {
      console.warn('sync push failed', r.status, await r.text());
    }
    await setSetting('lastSyncAt', new Date().toISOString());
  } catch (e) {
    console.warn('sync push error', e);
  } finally {
    _syncing = false;
  }
}

function schedulePush() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(pushSyncNow, SYNC_DEBOUNCE_MS);
}

async function pullSyncNow(opts = {}) {
  const c = await syncConfig();
  if (!c) return { ok: false, reason: 'No sync config' };
  const deviceId = await syncDeviceId();
  const url = `${c.url.replace(/\/$/, '')}/rest/v1/scheduler_state?device_id=eq.${deviceId}&select=data,updated_at`;
  try {
    const r = await fetch(url, { headers: _headers(c) });
    if (!r.ok) return { ok: false, reason: 'HTTP ' + r.status };
    const arr = await r.json();
    if (!arr || !arr.length) return { ok: true, days: 0, message: 'No remote data yet' };
    const remote = arr[0];
    const localExport = await exportAll();
    const merged = mergeExports(localExport, remote.data);
    await importAll(merged);
    _lastPullAt = Date.now();
    await setSetting('lastSyncAt', new Date().toISOString());
    return { ok: true, days: (remote.data.days || []).length };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// Last-write-wins per day record + per-setting key.
function mergeExports(localData, remoteData) {
  const out = { ...localData };
  // Days
  const localDays = new Map((localData.days || []).map((d) => [d.date, d]));
  for (const rd of (remoteData.days || [])) {
    const ld = localDays.get(rd.date);
    if (!ld) localDays.set(rd.date, rd);
    else {
      const lt = new Date(ld.lastEditedAt || 0).getTime();
      const rt = new Date(rd.lastEditedAt || 0).getTime();
      if (rt > lt) localDays.set(rd.date, rd);
    }
  }
  out.days = Array.from(localDays.values()).sort((a, b) => a.date.localeCompare(b.date));
  // Settings (remote wins for keys not held locally; locally-set syncConfig is preserved).
  const skipKeys = new Set(['syncConfig', 'deviceId', 'lastSyncAt']);
  const localSettings = new Map((localData.settings || []).map((s) => [s.key, s]));
  for (const rs of (remoteData.settings || [])) {
    if (skipKeys.has(rs.key)) continue;
    if (!localSettings.has(rs.key)) localSettings.set(rs.key, rs);
  }
  out.settings = Array.from(localSettings.values());
  return out;
}

// Hook: call from saveDay / setSetting after a normal write.
function maybeAutoSync() {
  syncEnabled().then((on) => { if (on) schedulePush(); });
}

// On app boot, pull once if config is set, then push pending state.
async function syncBootstrap() {
  if (!(await syncEnabled())) return;
  try {
    await pullSyncNow();
    schedulePush();
  } catch (_) {}
}
