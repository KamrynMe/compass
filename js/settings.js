function time12h(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

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
  const wakeT = (await getSetting('wakeTime')) || '05:00';
  const windT = (await getSetting('winddownTime')) || '19:00';
  const reminder = (await getSetting('reminderTime')) || wakeT;
  const lastExport = await getSetting('lastExportAt');

  // Theme card
  const themeMode = (await getSetting('themeMode')) || 'system';
  const cardT = document.createElement('div');
  cardT.className = 'card';
  cardT.innerHTML = `
    <h3>Appearance</h3>
    <div class="row-buttons" id="theme-row">
      <button class="btn-secondary theme-pick ${themeMode==='light'?'active':''}" data-mode="light">Light</button>
      <button class="btn-secondary theme-pick ${themeMode==='dark'?'active':''}" data-mode="dark">Dark</button>
      <button class="btn-secondary theme-pick ${themeMode==='system'?'active':''}" data-mode="system">System</button>
    </div>
  `;
  container.appendChild(cardT);
  cardT.querySelectorAll('.theme-pick').forEach((b) => {
    b.addEventListener('click', async () => {
      const m = b.dataset.mode;
      await setSetting('themeMode', m);
      applyTheme(m);
      cardT.querySelectorAll('.theme-pick').forEach((x) => x.classList.toggle('active', x === b));
    });
  });

  const cardW = document.createElement('div');
  cardW.className = 'card';
  const wDerived = winddownFromWake(wakeT);
  cardW.innerHTML = `
    <h3>Wake-up Time</h3>
    <div class="setting-help">Wind-down is automatic at wake + 14h. Score earns up to 5× early in the day.</div>
    <div class="setting-row">
      <div class="setting-label">Wake-up Time</div>
      <input class="input-text" type="time" step="300" id="wake-time" value="${wakeT}">
    </div>
    <div class="setting-row">
      <div class="setting-label">Wind-Down (auto)</div>
      <div id="wind-derived" class="muted" style="font-size:16px;font-weight:600;">${time12h(wDerived)}</div>
    </div>
    <div class="row-buttons">
      <button class="btn-secondary" id="wake-default">Default (5:00 am)</button>
      <button class="btn-primary" id="wake-save">Save</button>
    </div>
  `;
  container.appendChild(cardW);
  cardW.querySelector('#wake-time').addEventListener('input', (e) => {
    cardW.querySelector('#wind-derived').textContent = time12h(winddownFromWake(e.target.value));
  });
  cardW.querySelector('#wake-default').addEventListener('click', () => {
    cardW.querySelector('#wake-time').value = '05:00';
    cardW.querySelector('#wind-derived').textContent = time12h(winddownFromWake('05:00'));
  });
  cardW.querySelector('#wake-save').addEventListener('click', async () => {
    const w = cardW.querySelector('#wake-time').value;
    await setSetting('wakeTime', w);
    await setSetting('winddownTime', winddownFromWake(w));
    showToast('Wake time saved');
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
      <input class="input-text" type="time" step="300" id="rem-time" value="${reminder || ''}">
    </div>
    <div class="row-buttons">
      <button class="btn-secondary" id="rem-wake">Set to Wake-up Time</button>
      <button class="btn-secondary" id="rem-perm">Enable Notifications</button>
      <button class="btn-primary" id="rem-save">Save Reminder</button>
    </div>
  `;
  container.appendChild(card2);
  card2.querySelector('#rem-wake').addEventListener('click', () => {
    const w = cardW.querySelector('#wake-time').value || wakeT;
    card2.querySelector('#rem-time').value = w;
  });
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
  const exportNote = lastExport
    ? `Last exported ${new Date(lastExport).toLocaleDateString()}.`
    : `<strong style="color:var(--e-color);">Never exported. Removing the home-screen icon will erase all your data — back up first.</strong>`;
  card3.innerHTML = `
    <h3>Data</h3>
    <div class="setting-help" style="margin-bottom:8px;">${exportNote}</div>
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
    await setSetting('lastExportAt', new Date().toISOString());
    showToast('Exported');
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

  const cardF = document.createElement('div');
  cardF.className = 'card';
  const sEnabled = soundsEnabled();
  cardF.innerHTML = `
    <h3>Feedback</h3>
    <label class="setting-row" style="flex-direction:row;align-items:center;justify-content:space-between;">
      <div>
        <div class="setting-label">Check sounds</div>
        <div class="setting-help">Plays a short chime when checking off a habit.</div>
      </div>
      <input type="checkbox" id="snd-toggle" ${sEnabled ? 'checked' : ''} style="width:28px;height:28px;">
    </label>
  `;
  container.appendChild(cardF);
  cardF.querySelector('#snd-toggle').addEventListener('change', (e) => {
    setSoundsEnabled(e.target.checked);
    showToast(e.target.checked ? 'Sounds on' : 'Sounds off');
  });

  await renderCircadianCard(container);
  await renderCustomGoalsCard(container);

  const cardS = document.createElement('div');
  cardS.className = 'card';
  cardS.innerHTML = `<h3>Storage</h3><div id="storage-info" class="muted" style="font-size:14px;">Reading…</div>`;
  container.appendChild(cardS);
  await renderStorageCard(cardS);

  const card4 = document.createElement('div');
  card4.className = 'card';
  card4.innerHTML = `
    <h3>About</h3>
    <div class="setting-help">Compass Habits — built ${new Date().toLocaleDateString()}.<br>Made by Cameron Thomas.<br>All data lives only on this device. No accounts.</div>
  `;
  container.appendChild(card4);
}

function _hmHtml(totalMin, hMax = 23, mStep = 5) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const hOpts = [];
  for (let i = 0; i <= hMax; i++) hOpts.push(`<option value="${i}" ${i===h?'selected':''}>${i}</option>`);
  const mOpts = [];
  for (let i = 0; i < 60; i += mStep) mOpts.push(`<option value="${i}" ${i===m?'selected':''}>${String(i).padStart(2,'0')}</option>`);
  return `
    <select class="input-text hm-h" style="max-width:70px;">${hOpts.join('')}</select>
    <span style="align-self:center;">h</span>
    <select class="input-text hm-m" style="max-width:70px;">${mOpts.join('')}</select>
    <span style="align-self:center;">m</span>
  `;
}
function _readHm(rowEl) {
  const h = parseInt(rowEl.querySelector('.hm-h').value, 10) || 0;
  const m = parseInt(rowEl.querySelector('.hm-m').value, 10) || 0;
  return h * 60 + m;
}

function _fmtBytes(b) {
  if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + ' MB';
  if (b > 1024) return (b / 1024).toFixed(1) + ' KB';
  return b + ' B';
}

async function renderStorageCard(card) {
  let used = 0, quota = 0;
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      used = e.usage || 0; quota = e.quota || 0;
    }
  } catch (_) {}
  const all = await getAllDays();
  const days = all.length;
  const imageBytes = all.reduce((s, r) => s + (Array.isArray(r.images) ? r.images.reduce((t, i) => t + (i.dataUrl?.length || 0), 0) : 0), 0);
  const pct = quota ? Math.min(100, (used / quota) * 100) : null;
  card.querySelector('#storage-info').innerHTML = `
    <div>Records: <strong>${days}</strong> days</div>
    ${imageBytes ? `<div>Photos total: <strong>${_fmtBytes(imageBytes)}</strong></div>` : ''}
    ${used ? `<div>App storage: <strong>${_fmtBytes(used)}</strong>${quota ? ' of ' + _fmtBytes(quota) : ''}${pct !== null ? ' (' + pct.toFixed(2) + '%)' : ''}</div>` : ''}
    <div class="row-buttons" style="margin-top:10px;">
      <button class="btn-secondary" id="photos-browse">Browse photos</button>
    </div>
  `;
  card.querySelector('#photos-browse')?.addEventListener('click', () => openPhotoBrowser(card));
}

async function openPhotoBrowser(card) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  overlay.appendChild(modal);
  root.appendChild(overlay);

  const head = document.createElement('div');
  head.className = 'modal-head';
  head.innerHTML = `
    <button class="modal-back" id="ph-close" aria-label="Back">←</button>
    <div class="modal-date">All Photos</div>
    <span style="width:44px;"></span>
  `;
  modal.appendChild(head);
  head.querySelector('#ph-close').addEventListener('click', async () => {
    root.innerHTML = '';
    await renderStorageCard(card);
  });

  const list = document.createElement('div');
  modal.appendChild(list);

  async function paint() {
    const all = await getAllDays();
    const items = [];
    for (const r of all) {
      if (!Array.isArray(r.images)) continue;
      r.images.forEach((im, idx) => items.push({ rec: r, im, idx, idxOnDay: idx + 1, bytes: (im.dataUrl?.length || 0), date: r.date }));
    }
    items.sort((a, b) => b.bytes - a.bytes);
    if (!items.length) { list.innerHTML = '<div class="empty-state">No photos yet.</div>'; return; }
    list.innerHTML = items.map((p) => `
      <div class="card photo-row" data-date="${p.date}" data-imid="${p.im.id}">
        <div style="display:flex;gap:10px;align-items:center;">
          <img src="${p.im.dataUrl}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;">${p.date} · #${p.idxOnDay}</div>
            <div class="muted" style="font-size:12px;">${_fmtBytes(p.bytes)}</div>
          </div>
        </div>
        <div class="row-buttons" style="margin-top:8px;">
          <button class="btn-secondary" data-act="compress">Compress</button>
          <button class="btn-danger" data-act="delete">Delete</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.photo-row').forEach((row) => {
      const dateISO = row.dataset.date;
      const imId = row.dataset.imid;
      row.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        if (!confirm('Delete this photo permanently?')) return;
        const rec = await getDay(dateISO);
        if (rec) {
          rec.images = (rec.images || []).filter((x) => x.id !== imId);
          await saveDay(rec);
        }
        await paint();
      });
      row.querySelector('[data-act="compress"]').addEventListener('click', async () => {
        const rec = await getDay(dateISO);
        const orig = rec?.images?.find((x) => x.id === imId);
        if (!orig) return;
        // Build a more aggressive compression
        const compressed = await compressDataUrl(orig.dataUrl, 800, 0.55);
        const ok = await confirmCompressionPreview(orig.dataUrl, compressed.dataUrl, orig.dataUrl.length, compressed.dataUrl.length);
        if (!ok) return;
        orig.dataUrl = compressed.dataUrl;
        await saveDay(rec);
        await paint();
      });
    });
  }
  await paint();
}

function compressDataUrl(dataUrl, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (Math.max(width, height) > maxDim) {
        const r = maxDim / Math.max(width, height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve({ dataUrl: c.toDataURL('image/jpeg', quality) });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function confirmCompressionPreview(origUrl, newUrl, origBytes, newBytes) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.style.zIndex = 200;
    ov.innerHTML = `
      <div class="modal" style="max-width:600px;align-self:center;">
        <h3 style="margin-bottom:10px;">Confirm compression</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><div class="muted" style="font-size:12px;text-align:center;">Original (${_fmtBytes(origBytes)})</div><img src="${origUrl}" style="width:100%;border-radius:6px;"></div>
          <div><div class="muted" style="font-size:12px;text-align:center;">Compressed (${_fmtBytes(newBytes)})</div><img src="${newUrl}" style="width:100%;border-radius:6px;"></div>
        </div>
        <div class="row-buttons" style="margin-top:14px;">
          <button class="btn-secondary" id="cmp-cancel">Cancel</button>
          <button class="btn-primary" id="cmp-ok">Replace with smaller</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    const close = (val) => { ov.remove(); resolve(val); };
    ov.querySelector('#cmp-cancel').addEventListener('click', () => close(false));
    ov.querySelector('#cmp-ok').addEventListener('click', () => close(true));
  });
}

async function renderCircadianCard(container) {
  const card = document.createElement('div');
  card.className = 'card';
  container.appendChild(card);
  const WAVE_OPTS = ['delta','theta','alpha','beta','gamma'];

  async function draw() {
    const transitions = (await getCircadianTransitions()).slice().sort((a,b)=>a.offsetMin-b.offsetMin);
    const rowsHtml = transitions.map((t) => `
      <div class="circ-row" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
        ${_hmHtml(t.offsetMin, 23, 5)}
        <span style="align-self:center;">→</span>
        <select class="input-text circ-wave" style="max-width:120px;">
          ${WAVE_OPTS.map((w) => `<option value="${w}" ${t.wave===w?'selected':''}>${w[0].toUpperCase()+w.slice(1)}</option>`).join('')}
        </select>
        <button class="var-btn" data-act="del" style="background:#fce4e4;color:var(--e-color);">×</button>
      </div>
    `).join('');
    card.innerHTML = `
      <h3>Circadian Timing</h3>
      <div class="setting-help">Each row: hours/minutes after wake → which state to play. Rows reorder automatically when saved.</div>
      <div id="circ-list" style="display:flex;flex-direction:column;gap:8px;margin:10px 0;">${rowsHtml}</div>
      <div class="row-buttons">
        <button class="btn-secondary" id="circ-add">+ Add transition</button>
        <button class="btn-secondary" id="circ-reset">Reset to default</button>
        <button class="btn-primary" id="circ-save">Save</button>
      </div>
    `;
    card.querySelectorAll('.circ-row').forEach((row) => {
      row.querySelector('[data-act="del"]').addEventListener('click', () => row.remove());
    });
    card.querySelector('#circ-add').addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'circ-row';
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
      row.innerHTML = _hmHtml(0, 23, 5) + `
        <span style="align-self:center;">→</span>
        <select class="input-text circ-wave" style="max-width:120px;">
          ${WAVE_OPTS.map((w) => `<option value="${w}">${w[0].toUpperCase()+w.slice(1)}</option>`).join('')}
        </select>
        <button class="var-btn" data-act="del" style="background:#fce4e4;color:var(--e-color);">×</button>
      `;
      row.querySelector('[data-act="del"]').addEventListener('click', () => row.remove());
      card.querySelector('#circ-list').appendChild(row);
    });
    card.querySelector('#circ-reset').addEventListener('click', async () => {
      await setSetting('circadianTransitions', null);
      await draw();
      showToast('Reset to defaults');
    });
    card.querySelector('#circ-save').addEventListener('click', async () => {
      const next = [];
      card.querySelectorAll('.circ-row').forEach((row) => {
        const m = _readHm(row);
        const w = row.querySelector('.circ-wave').value;
        if (!isNaN(m) && w) next.push({ offsetMin: m, wave: w });
      });
      next.sort((a, b) => a.offsetMin - b.offsetMin);
      await setSetting('circadianTransitions', next);
      showToast('Schedule saved');
      await draw();
    });
  }
  await draw();

  // Volume curve nodes editor
  const volCard = document.createElement('div');
  volCard.className = 'card';
  container.appendChild(volCard);
  let _testTimer = null;
  let _testActiveBtn = null;
  function stopTest() {
    if (_testTimer) { clearTimeout(_testTimer); _testTimer = null; }
    stopBeats(true);
    if (_testActiveBtn) { _testActiveBtn.textContent = 'Test'; _testActiveBtn = null; }
  }

  async function drawVol() {
    const nodes = (await getCircadianVolumeNodes()).slice().sort((a,b)=>a.offsetMin-b.offsetMin);
    const wakeStr = (await getSetting('wakeTime')) || '05:00';
    const transitions = await getCircadianTransitions();
    const waveAtMin = (m) => {
      const sorted = transitions.slice().sort((a,b) => a.offsetMin - b.offsetMin);
      let active = sorted[sorted.length-1].wave;
      for (const t of sorted) { if (t.offsetMin <= m) active = t.wave; else break; }
      return active;
    };
    const rowsHtml = nodes.map((n, i) => `
      <div class="vol-row" data-i="${i}" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
        ${_hmHtml(n.offsetMin, 23, 5)}
        <span style="align-self:center;font-size:12px;color:var(--ink3);">@</span>
        <input type="number" class="input-text vol-pct" min="1" max="100" step="1" value="${n.vol}" style="max-width:80px;">
        <span style="align-self:center;font-size:12px;">%</span>
        <button class="var-btn vol-test" data-i="${i}" style="background:var(--gold);color:white;">Test</button>
        <button class="var-btn" data-act="del" style="background:#fce4e4;color:var(--e-color);">×</button>
      </div>
    `).join('');
    volCard.innerHTML = `
      <h3>Circadian Volume Curve</h3>
      <div class="setting-help">Nodes interpolate smoothly through the day. Volumes 1-100%. Test plays the wave that would play at that time at that volume.</div>
      <div id="vol-list" style="display:flex;flex-direction:column;gap:8px;margin:10px 0;">${rowsHtml}</div>
      <div class="row-buttons">
        <button class="btn-secondary" id="vol-add">+ Add node</button>
        <button class="btn-secondary" id="vol-reset">Reset to default</button>
        <button class="btn-primary" id="vol-save">Save</button>
      </div>
    `;
    volCard.querySelectorAll('.vol-row').forEach((row) => {
      row.querySelector('[data-act="del"]').addEventListener('click', () => row.remove());
      const testBtn = row.querySelector('.vol-test');
      testBtn.addEventListener('click', async () => {
        if (_testActiveBtn === testBtn) {
          stopTest();
          return;
        }
        stopTest();
        const m = _readHm(row);
        const pct = Math.max(1, Math.min(100, parseInt(row.querySelector('.vol-pct').value, 10) || 1));
        const wave = waveAtMin(m);
        // override global volume for test
        const prevVol = _beats.volume;
        _beats.volume = pct / 100;
        if (typeof stopCircadian === 'function') stopCircadian();
        startBeats(wave);
        _beats.volume = prevVol;
        testBtn.textContent = 'Stop';
        _testActiveBtn = testBtn;
        _testTimer = setTimeout(() => {
          if (_testActiveBtn === testBtn) stopTest();
        }, 6000);
      });
    });
    volCard.querySelector('#vol-add').addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'vol-row';
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
      row.innerHTML = _hmHtml(0, 23, 5) + `
        <span style="align-self:center;font-size:12px;">@</span>
        <input type="number" class="input-text vol-pct" min="1" max="100" step="1" value="20" style="max-width:80px;">
        <span style="align-self:center;font-size:12px;">%</span>
        <button class="var-btn vol-test" style="background:var(--gold);color:white;">Test</button>
        <button class="var-btn" data-act="del" style="background:#fce4e4;color:var(--e-color);">×</button>
      `;
      row.querySelector('[data-act="del"]').addEventListener('click', () => row.remove());
      volCard.querySelector('#vol-list').appendChild(row);
    });
    volCard.querySelector('#vol-reset').addEventListener('click', async () => {
      await setSetting('circadianVolumeNodes', null);
      await drawVol();
      showToast('Volume curve reset');
    });
    volCard.querySelector('#vol-save').addEventListener('click', async () => {
      const next = [];
      volCard.querySelectorAll('.vol-row').forEach((row) => {
        const m = _readHm(row);
        const v = parseInt(row.querySelector('.vol-pct').value, 10);
        if (!isNaN(m) && !isNaN(v)) next.push({ offsetMin: m, vol: Math.max(1, Math.min(100, v)) });
      });
      next.sort((a, b) => a.offsetMin - b.offsetMin);
      await setSetting('circadianVolumeNodes', next);
      showToast('Volume curve saved');
      await drawVol();
    });
  }
  await drawVol();
}

async function renderCustomGoalsCard(container) {
  const card = document.createElement('div');
  card.className = 'card';
  container.appendChild(card);
  let editingId = null;

  async function refresh() {
    const customs = await loadCustomGoals();
    const pillarOptions = PILLARS.map((p) => `<option value="${p.id}">${p.symbol} ${p.name}</option>`).join('');
    const buildAfterOptionsHtml = (pillarId) => {
      return QUESTIONS
        .filter((q) => q.pillar === pillarId)
        .map((q) => {
          const num = displayNumberFor(q.id);
          const label = `${num}. ${q.emoji || ''} ${q.text.slice(0, 50)}${q.text.length > 50 ? '…' : ''}`;
          return `<option value="${q.id}">${escapeHtml(label)}</option>`;
        }).join('');
    };

    const editing = editingId ? customs.find((c) => c.id === editingId) : null;

    const listHtml = customs.length === 0
      ? '<div class="muted" style="font-size:14px;padding:8px 0;">No custom goals yet.</div>'
      : customs.map((c) => `
          <div class="custom-row" data-id="${c.id}">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:15px;">${escapeHtml(c.emoji || '🎯')} ${escapeHtml(c.text)}</div>
              <div class="muted" style="font-size:12px;">After ${escapeHtml(QUESTIONS.find((q) => q.id === c.afterId)?.text?.slice(0, 40) || '—')}…</div>
            </div>
            <button class="var-btn" data-act="edit">Edit</button>
            <button class="var-btn" data-act="del" style="background:#fce4e4;color:var(--e-color);">Delete</button>
          </div>
        `).join('');

    card.innerHTML = `
      <h3>Custom Goals</h3>
      <div class="setting-help">Add your own goals anywhere in the habit stack. The original 26 cannot be removed.</div>
      <div id="custom-list" style="margin:10px 0;display:flex;flex-direction:column;gap:8px;"></div>
      <details ${editing ? 'open' : ''} id="custom-form-wrap">
        <summary style="cursor:pointer;font-weight:600;font-size:15px;padding:8px 0;">${editing ? '✏️ Edit goal' : '＋ Add a new goal'}</summary>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
          <label class="setting-label" style="font-size:13px;">Emoji
            <input class="input-text" id="cg-emoji" maxlength="4" value="${escapeHtml(editing?.emoji || '🎯')}">
          </label>
          <label class="setting-label" style="font-size:13px;">Goal text
            <input class="input-text" id="cg-text" placeholder="e.g. Did I journal today?" value="${escapeHtml(editing?.text || '')}">
          </label>
          <label class="setting-label" style="font-size:13px;">Note (optional)
            <input class="input-text" id="cg-note" placeholder="A short hint or reminder" value="${escapeHtml(editing?.note || '')}">
          </label>
          <label class="setting-label" style="font-size:13px;">Pillar
            <select class="input-text" id="cg-pillar">${pillarOptions}</select>
          </label>
          <label class="setting-label" style="font-size:13px;">Insert after
            <select class="input-text" id="cg-after">${buildAfterOptionsHtml(editing?.pillar || 'enjoyment')}</select>
          </label>
          <label class="setting-label" style="font-size:13px;">Start date
            <input class="input-text" type="date" id="cg-start" value="${escapeHtml(editing?.startDate || todayISO())}">
          </label>
          <label class="setting-label" style="font-size:13px;display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="cg-anchor" ${editing?.anchor ? 'checked' : ''} style="width:24px;height:24px;">
            Anchor (gold border + ★)
          </label>
          <div class="row-buttons" style="margin-top:6px;">
            ${editing ? '<button class="btn-secondary" id="cg-cancel">Cancel</button>' : ''}
            <button class="btn-primary" id="cg-save">${editing ? 'Save changes' : 'Add goal'}</button>
          </div>
        </div>
      </details>
    `;

    card.querySelector('#custom-list').innerHTML = listHtml;
    if (editing) {
      card.querySelector('#cg-pillar').value = editing.pillar;
      card.querySelector('#cg-after').value = editing.afterId;
    } else {
      card.querySelector('#cg-pillar').value = 'enjoyment';
    }
    // Re-filter "insert after" when pillar changes.
    card.querySelector('#cg-pillar').addEventListener('change', (e) => {
      card.querySelector('#cg-after').innerHTML = buildAfterOptionsHtml(e.target.value);
    });

    card.querySelectorAll('.custom-row').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-act="edit"]').addEventListener('click', () => {
        editingId = id; refresh();
      });
      row.querySelector('[data-act="del"]').addEventListener('click', async () => {
        if (!confirm('Delete this custom goal? Your saved check history for it stays in the database but it will no longer appear.')) return;
        const list = await loadCustomGoals();
        await saveCustomGoals(list.filter((c) => c.id !== id));
        rebuildQuestionsFrom(await loadCustomGoals());
        if (editingId === id) editingId = null;
        showToast('Goal removed');
        refresh();
      });
    });

    if (editing) {
      card.querySelector('#cg-cancel').addEventListener('click', () => { editingId = null; refresh(); });
    }
    card.querySelector('#cg-save').addEventListener('click', async () => {
      const emoji = card.querySelector('#cg-emoji').value.trim() || '🎯';
      const text = card.querySelector('#cg-text').value.trim();
      const note = card.querySelector('#cg-note').value.trim();
      const pillar = card.querySelector('#cg-pillar').value;
      const afterId = card.querySelector('#cg-after').value;
      const anchor = card.querySelector('#cg-anchor').checked;
      const startDate = card.querySelector('#cg-start').value || todayISO();
      if (!text) { showToast('Goal text required'); return; }
      const list = await loadCustomGoals();
      if (editing) {
        const idx = list.findIndex((c) => c.id === editing.id);
        if (idx >= 0) list[idx] = { ...list[idx], emoji, text, note, pillar, afterId, anchor, startDate };
      } else {
        const id = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        list.push({ id, emoji, text, note, pillar, afterId, anchor, startDate });
      }
      await saveCustomGoals(list);
      rebuildQuestionsFrom(list);
      editingId = null;
      showToast('Goal saved');
      refresh();
    });
  }

  await refresh();
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
