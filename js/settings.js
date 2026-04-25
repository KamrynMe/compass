async function renderSettingsView(container) {
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <div>
      <div class="view-title">Settings</div>
      <div class="view-sub">Location, data, and reminders</div>
    </div>
  `;
  container.appendChild(header);

  const loc = (await getSetting('location')) || { lat: '', lon: '', label: '' };
  const reminder = (await getSetting('reminderTime')) || '';
  const wakeT = (await getSetting('wakeTime')) || '05:00';
  const windT = (await getSetting('winddownTime')) || '19:00';

  const cardW = document.createElement('div');
  cardW.className = 'card';
  cardW.innerHTML = `
    <h3>Wake & Wind-Down</h3>
    <div class="setting-help">Used by the daily score: checks earlier in your waking window earn up to 5×.</div>
    <div class="setting-row">
      <div class="setting-label">Wake Time</div>
      <input class="input-text" type="time" id="wake-time" value="${wakeT}">
    </div>
    <div class="setting-row">
      <div class="setting-label">Wind-Down Time</div>
      <input class="input-text" type="time" id="wind-time" value="${windT}">
    </div>
    <div class="row-buttons">
      <button class="btn-secondary" id="wake-default">Defaults (5am / 7pm)</button>
      <button class="btn-primary" id="wake-save">Save</button>
    </div>
  `;
  container.appendChild(cardW);
  cardW.querySelector('#wake-default').addEventListener('click', () => {
    cardW.querySelector('#wake-time').value = '05:00';
    cardW.querySelector('#wind-time').value = '19:00';
  });
  cardW.querySelector('#wake-save').addEventListener('click', async () => {
    const w = cardW.querySelector('#wake-time').value;
    const d = cardW.querySelector('#wind-time').value;
    await setSetting('wakeTime', w);
    await setSetting('winddownTime', d);
    showToast('Times saved');
  });

  const card1 = document.createElement('div');
  card1.className = 'card';
  card1.innerHTML = `
    <h3>Location</h3>
    <div class="setting-row">
      <div class="setting-label">Label</div>
      <input class="input-text" id="loc-label" placeholder="e.g. Home" value="${escapeHtml(loc.label || '')}">
    </div>
    <div class="setting-row">
      <div class="setting-label">Latitude</div>
      <input class="input-text" id="loc-lat" type="number" step="any" value="${loc.lat ?? ''}">
    </div>
    <div class="setting-row">
      <div class="setting-label">Longitude</div>
      <input class="input-text" id="loc-lon" type="number" step="any" value="${loc.lon ?? ''}">
    </div>
    <div class="row-buttons" style="margin-top:10px;">
      <button class="btn-secondary" id="loc-gps">Use device GPS</button>
      <button class="btn-primary" id="loc-save">Save Location</button>
    </div>
  `;
  container.appendChild(card1);
  card1.querySelector('#loc-gps').addEventListener('click', () => {
    if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      card1.querySelector('#loc-lat').value = pos.coords.latitude.toFixed(4);
      card1.querySelector('#loc-lon').value = pos.coords.longitude.toFixed(4);
      showToast('Location captured — tap Save');
    }, (err) => showToast('GPS failed: ' + err.message));
  });
  card1.querySelector('#loc-save').addEventListener('click', async () => {
    const lat = parseFloat(card1.querySelector('#loc-lat').value);
    const lon = parseFloat(card1.querySelector('#loc-lon').value);
    const label = card1.querySelector('#loc-label').value.trim();
    if (isNaN(lat) || isNaN(lon)) { showToast('Enter both lat and lon'); return; }
    await setSetting('location', { lat, lon, label });
    showToast('Location saved');
  });

  const card2 = document.createElement('div');
  card2.className = 'card';
  card2.innerHTML = `
    <h3>Daily Reminder</h3>
    <div class="setting-help">Best-effort browser notification (limited on iOS PWAs).</div>
    <div class="setting-row">
      <input class="input-text" type="time" id="rem-time" value="${reminder || ''}">
    </div>
    <div class="row-buttons">
      <button class="btn-secondary" id="rem-perm">Enable Notifications</button>
      <button class="btn-primary" id="rem-save">Save Reminder</button>
    </div>
  `;
  container.appendChild(card2);
  card2.querySelector('#rem-perm').addEventListener('click', async () => {
    if (!('Notification' in window)) { showToast('Notifications not supported'); return; }
    const r = await Notification.requestPermission();
    showToast('Permission: ' + r);
  });
  card2.querySelector('#rem-save').addEventListener('click', async () => {
    const t = card2.querySelector('#rem-time').value;
    await setSetting('reminderTime', t);
    showToast('Reminder time saved');
    scheduleReminder(t);
  });

  const card3 = document.createElement('div');
  card3.className = 'card';
  card3.innerHTML = `
    <h3>Data</h3>
    <div class="row-buttons">
      <button class="btn-secondary" id="data-export">Export JSON</button>
      <button class="btn-secondary" id="data-import">Import JSON</button>
    </div>
    <input type="file" id="data-import-file" accept="application/json" style="display:none">
    <div style="margin-top:14px;">
      <button class="btn-danger" id="data-reset">Reset All Data</button>
    </div>
  `;
  container.appendChild(card3);
  card3.querySelector('#data-export').addEventListener('click', async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compass-export-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const fileInput = card3.querySelector('#data-import-file');
  card3.querySelector('#data-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (!confirm('Import will merge with existing data. Continue?')) return;
    try {
      const text = await f.text();
      await importAll(JSON.parse(text));
      showToast('Imported');
    } catch (e) {
      showToast('Import failed: ' + e.message);
    }
  });
  card3.querySelector('#data-reset').addEventListener('click', async () => {
    if (!confirm('Erase ALL Compass data? This cannot be undone.')) return;
    if (!confirm('Really erase everything?')) return;
    await wipeAll();
    showToast('All data erased');
  });

  const card4 = document.createElement('div');
  card4.className = 'card';
  card4.innerHTML = `
    <h3>About</h3>
    <div class="setting-help">Compass — v1.0 — built ${new Date().toLocaleDateString()}.<br>All data lives only on this device. No accounts.</div>
  `;
  container.appendChild(card4);
}

let _reminderTimer = null;
function scheduleReminder(timeStr) {
  if (_reminderTimer) clearTimeout(_reminderTimer);
  if (!timeStr || !('Notification' in window) || Notification.permission !== 'granted') return;
  const [hh, mm] = timeStr.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hh, mm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;
  _reminderTimer = setTimeout(() => {
    new Notification('Compass', { body: 'Time for your daily check-in.' });
    scheduleReminder(timeStr);
  }, ms);
}
