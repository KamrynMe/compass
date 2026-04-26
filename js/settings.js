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
    cardW.querySelector('#wind-derived').textContent = winddownFromWake('05:00');
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

  await renderCustomGoalsCard(container);

  const card4 = document.createElement('div');
  card4.className = 'card';
  card4.innerHTML = `
    <h3>About</h3>
    <div class="setting-help">Compass — v1.0 — built ${new Date().toLocaleDateString()}.<br>Made by Cameron Thomas.<br>All data lives only on this device. No accounts.</div>
  `;
  container.appendChild(card4);
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
      if (!text) { showToast('Goal text required'); return; }
      const list = await loadCustomGoals();
      if (editing) {
        const idx = list.findIndex((c) => c.id === editing.id);
        if (idx >= 0) list[idx] = { ...list[idx], emoji, text, note, pillar, afterId, anchor };
      } else {
        const id = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        list.push({ id, emoji, text, note, pillar, afterId, anchor });
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
