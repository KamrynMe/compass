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

  await renderInboxCard(container);

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

  // (Debug moved to Advanced — appears later, after Storage)

  // Score-percent target — drives the projection on Today.
  const tgtPct = (await getSetting('completionTargetPct')) || 75;
  const cardCT = document.createElement('div');
  cardCT.className = 'card';
  cardCT.innerHTML = `
    <h3>Score Target</h3>
    <div class="setting-help">Pick the overall-score percentage you're aiming for. The Today tab shows projected dates to reach this average.</div>
    <div class="setting-row">
      <div class="setting-label">Target: <span id="ct-val">${tgtPct}%</span></div>
      <input type="range" min="10" max="150" step="5" value="${tgtPct}" id="ct-slider" class="slider-input" style="--c:#c9a84c;">
    </div>
  `;
  container.appendChild(cardCT);
  cardCT.querySelector('#ct-slider').addEventListener('input', (e) => {
    cardCT.querySelector('#ct-val').textContent = e.target.value + '%';
  });
  cardCT.querySelector('#ct-slider').addEventListener('change', async (e) => {
    await setSetting('completionTargetPct', parseInt(e.target.value, 10));
    showToast('Target saved');
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
      <button class="btn-secondary" id="data-export">Save Data</button>
      <button class="btn-secondary" id="data-import">Load Data</button>
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
    if (e.target.checked) playCheckSound();
  });

  await renderCircadianCard(container);
  await renderCustomGoalsCard(container);

  const cardS = document.createElement('div');
  cardS.className = 'card';
  cardS.innerHTML = `<h3>Storage</h3><div id="storage-info" class="muted" style="font-size:14px;">Reading…</div>`;
  container.appendChild(cardS);
  await renderStorageCard(cardS);

  await renderAdvancedCard(container);

  const card4 = document.createElement('div');
  card4.className = 'card card-about';
  card4.innerHTML = `
    <h3>About</h3>
    <div class="setting-help">Scheduler · <strong>Beta</strong> — built ${new Date().toLocaleDateString()}.<br>Made by Cameron Thomas.<br>All data lives only on this device unless cloud sync is enabled.</div>
  `;
  container.appendChild(card4);

  // Convert every non-About card into a tap-to-open full-screen menu.
  menuizeSettingsCards(container);
}

function menuizeSettingsCards(container) {
  const cards = container.querySelectorAll(':scope > .card');
  cards.forEach((card) => {
    if (card.classList.contains('card-about')) return; // About stays inline
    if (card.dataset.menuized === '1') return;
    const h3 = card.querySelector(':scope > h3');
    if (!h3) return;
    card.dataset.menuized = '1';

    // Hide the card body by default; show only the menu row.
    card.classList.add('card-menu-host');

    const row = document.createElement('button');
    row.className = 'settings-menu-row';
    row.innerHTML = `<span class="settings-menu-title">${h3.innerHTML}</span><span class="settings-menu-chev">›</span>`;

    // Insert row before the h3 (which we'll keep but hide visually inside the
    // menu when collapsed, and display when active for context).
    card.insertBefore(row, h3);

    row.addEventListener('click', () => {
      document.body.classList.add('settings-menu-open');
      card.classList.add('card-menu-active');
      // Add a back button + safe-area scaffolding once.
      if (!card.querySelector(':scope > .settings-menu-back')) {
        const back = document.createElement('button');
        back.className = 'settings-menu-back';
        back.innerHTML = '←';
        back.setAttribute('aria-label', 'Back');
        back.addEventListener('click', (e) => {
          e.stopPropagation();
          card.classList.remove('card-menu-active');
          // If no other cards are open, take settings-menu-open off the body.
          if (!container.querySelector('.card-menu-active')) {
            document.body.classList.remove('settings-menu-open');
          }
          window.scrollTo(0, 0);
        });
        card.insertBefore(back, row);
      }
    });
  });
}

function _legacy_collapseSettingsCards_unused(container) {
  const cards = container.querySelectorAll(':scope > .card');
  cards.forEach((card) => {
    if (card.classList.contains('inbox-card')) return;
    if (card.dataset.collapsibleApplied === '1') return;
    const h3 = card.querySelector(':scope > h3');
    if (!h3) return;
    // Mutate the existing card node so any closure references in paint() callbacks
    // remain valid when later refreshes call card.innerHTML = ...
    card.classList.add('card-collapsible-host');
    const det = document.createElement('details');
    det.className = 'card-collapsible-inner';
    det.open = false;
    const sum = document.createElement('summary');
    sum.innerHTML = h3.innerHTML;
    det.appendChild(sum);
    // Wrap remaining children inside <details> while keeping `card` as host.
    while (card.firstChild) det.firstChild.nextSibling
      ? det.appendChild(card.firstChild)
      : det.appendChild(card.firstChild);
    // h3 was moved into details too — remove it (we kept its text in <summary>).
    const movedH3 = det.querySelector(':scope > h3');
    if (movedH3) movedH3.remove();
    card.appendChild(det);
    card.dataset.collapsibleApplied = '1';
    // When subsequent paint() calls replace card.innerHTML, re-wrap on the next tick.
    const reapply = () => {
      if (!card.querySelector(':scope > details.card-collapsible-inner')) {
        const h3b = card.querySelector(':scope > h3');
        if (h3b) {
          const d2 = document.createElement('details');
          d2.className = 'card-collapsible-inner';
          d2.open = det.open;
          const s2 = document.createElement('summary');
          s2.innerHTML = h3b.innerHTML;
          d2.appendChild(s2);
          h3b.remove();
          while (card.firstChild) d2.appendChild(card.firstChild);
          card.appendChild(d2);
        }
      }
    };
    new MutationObserver(reapply).observe(card, { childList: true });
  });
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

async function renderInboxCard(container) {
  const card = document.createElement('div');
  card.className = 'card inbox-card';
  container.appendChild(card);
  async function paint() {
    const seen = (await getSetting('inboxSeenIds')) || [];
    const messages = await getInboxMessages();
    const unread = messages.filter((m) => !seen.includes(m.id)).length;
    card.innerHTML = `
      <button class="inbox-summary" id="inbox-open">
        <span class="inbox-summary-label">📬 Inbox</span>
        <span class="inbox-summary-meta">
          ${messages.length} message${messages.length === 1 ? '' : 's'}
          ${unread > 0 ? `<span class="inbox-badge">${unread} new</span>` : ''}
        </span>
        <span class="inbox-summary-arrow">›</span>
      </button>
    `;
    card.querySelector('#inbox-open').addEventListener('click', () => openInboxModal(paint));
  }
  await paint();
}

async function openInboxModal(onClose) {
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
    <button class="modal-back" id="ib-close" aria-label="Back">←</button>
    <div class="modal-date">Inbox</div>
    <span style="width:44px;"></span>
  `;
  modal.appendChild(head);
  const list = document.createElement('div');
  modal.appendChild(list);
  head.querySelector('#ib-close').addEventListener('click', async () => {
    root.innerHTML = '';
    if (onClose) await onClose();
  });
  const seen = (await getSetting('inboxSeenIds')) || [];
  const messages = await getInboxMessages();
  if (!messages.length) {
    list.innerHTML = '<div class="empty-state">Nothing here yet.</div>';
    return;
  }
  list.innerHTML = messages.map((m) => `
    <details class="inbox-row ${seen.includes(m.id) ? 'seen' : 'unread'}" data-id="${m.id}">
      <summary class="inbox-row-head">
        <span class="inbox-row-title">${escapeHtml(m.title)}</span>
        <span class="inbox-row-date">${m.date}</span>
      </summary>
      <div class="inbox-row-body">${m.body}</div>
    </details>
  `).join('');
  list.querySelectorAll('.inbox-row').forEach((row) => {
    row.addEventListener('toggle', async () => {
      if (!row.open) return;
      const id = row.dataset.id;
      const cur = (await getSetting('inboxSeenIds')) || [];
      if (!cur.includes(id)) {
        cur.push(id);
        await setSetting('inboxSeenIds', cur);
        row.classList.remove('unread');
        row.classList.add('seen');
        updateSettingsBadge();
      }
    });
  });
}

async function getInboxMessages() {
  // Hardcoded message log; can be augmented by service-worker update events later.
  return [
    {
      id: 'v21-2026-05-01',
      title: 'Big update — Scheduler v21',
      date: '2026-05-01',
      body: `<div style="font-size:14px;line-height:1.55;">
        <p><strong>Renamed</strong> from Compass Habits to Scheduler.</p>
        <p><strong>New:</strong> all goals editable + removable in Settings, with reset-to-default. Per-goal picture (shown when goal is expanded). Top 5 Days panel on Calendar + Analytics. Days-of-week as correlation variables. Relationships Ranking now has a category filter.</p>
        <p><strong>Calendar:</strong> swipe between months, tap month name to jump anywhere, past empty days are blank, future days are dark.</p>
        <p><strong>Beats:</strong> L/R ear assignment slowly alternates (every 90 s) to keep the dissonance fresh.</p>
        <p><strong>Today:</strong> "Best" added between "To Beat" and "Score". Projection compares today's pace vs. 7 days ago. Wake-up prompt on first run.</p>
        <p><strong>Tabs:</strong> double-tap shortcuts — Today→top uncompleted goal, Calendar→jump to today, Beats→toggle Circadian, Settings→toggle theme, Analytics→Relationships Ranking with Daily Score.</p>
        <p><strong>Backups:</strong> use Save Data (Settings → Data) regularly. iOS Safari does not allow PWAs to auto-write to Files.</p>
      </div>`,
    },
  ];
}

function updateSettingsBadge() {
  // Optional: add a badge to the tabbar Settings tab
  const tab = document.querySelector('.tab[data-tab="settings"]');
  if (!tab) return;
  getSetting('inboxSeenIds').then(async (seenRaw) => {
    const seen = seenRaw || [];
    const messages = await getInboxMessages();
    const unread = messages.filter((m) => !seen.includes(m.id)).length;
    let badge = tab.querySelector('.tab-badge');
    if (unread > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'tab-badge';
        tab.appendChild(badge);
      }
      badge.textContent = unread;
    } else if (badge) {
      badge.remove();
    }
  });
}

async function renderSyncCard(container) {
  const card = document.createElement('div');
  card.className = 'card';
  container.appendChild(card);
  async function paint() {
    const cfg = await syncConfig();
    const last = await getSetting('lastSyncAt');
    const dev = await syncDeviceId();
    card.innerHTML = `
      <h3>Cloud Sync <span style="color:var(--e-border);font-weight:700;font-size:13px;">live</span></h3>
      <div class="setting-help">Auto-syncs your full data to a private Supabase row keyed by this device. Pulls at app start, pushes a few seconds after each change.</div>
      <div style="margin-top:10px;font-size:13px;line-height:1.6;">
        <div><strong>Endpoint:</strong> ${escapeHtml(cfg.url)}</div>
        <div><strong>Device:</strong> <span style="font-family:monospace;font-size:11px;">${escapeHtml(dev)}</span></div>
        <div><strong>Last sync:</strong> ${last ? new Date(last).toLocaleString() : '—'}</div>
      </div>
      <div class="row-buttons" style="margin-top:10px;">
        <button class="btn-secondary" id="sync-pull">Pull from cloud</button>
        <button class="btn-primary" id="sync-push">Push now</button>
      </div>
    `;
    card.querySelector('#sync-pull').addEventListener('click', async () => {
      const r = await pullSyncNow();
      showToast(r.ok ? 'Pulled ' + (r.days || 0) + ' day(s)' : 'Pull failed: ' + r.reason);
      paint();
    });
    card.querySelector('#sync-push').addEventListener('click', async () => {
      await pushSyncNow();
      showToast('Pushed');
      paint();
    });
  }
  await paint();
}

async function renderAdvancedCard(container) {
  const card = document.createElement('div');
  card.className = 'card';
  container.appendChild(card);
  async function paint() {
    const debugOn = !!(await getSetting('debugMomentum'));
    const isAdmin = await adminIsLoggedIn();
    const last = isAdmin ? await getSetting('lastSyncAt') : null;
    card.innerHTML = `
      <h3>Advanced</h3>
      <label class="setting-row toggle-row">
        <div>
          <div class="setting-label">Show Momentum calculation</div>
          <div class="setting-help">Adds a breakdown of how today's Momentum % is computed beneath the tile.</div>
        </div>
        <span class="toggle-switch ${debugOn ? 'on' : ''}" data-toggle="dbg-mom" role="switch" aria-checked="${debugOn}"></span>
      </label>
      <div style="margin-top:14px;border-top:1px solid var(--rule);padding-top:12px;">
        <div class="setting-label">Admin login</div>
        <div class="setting-help">${isAdmin ? 'Cloud sync is active.' : 'Local-only mode. Admin login enables cloud sync.'}${last ? ' Last sync: ' + new Date(last).toLocaleString() + '.' : ''}</div>
        <div class="row-buttons" style="margin-top:8px;">
          ${isAdmin
            ? '<button class="btn-primary" id="adm-refresh" style="flex:1;">↻ Refresh</button><button class="btn-danger" id="adm-out">Log out</button>'
            : '<button class="btn-primary" id="adm-in">Log in</button>'}
        </div>
      </div>
    `;
    card.querySelector('[data-toggle="dbg-mom"]').addEventListener('click', async (e) => {
      const el = e.currentTarget;
      const next = !el.classList.contains('on');
      el.classList.toggle('on', next);
      el.setAttribute('aria-checked', next);
      await setSetting('debugMomentum', next);
      showToast(next ? 'Debug on' : 'Debug off');
    });
    if (isAdmin) {
      card.querySelector('#adm-refresh').addEventListener('click', async () => {
        const r = await refreshSyncNow();
        showToast(r.ok ? 'Synced (' + (r.days || 0) + ' remote day(s) merged)' : 'Sync failed: ' + (r.reason || ''));
        paint();
      });
      card.querySelector('#adm-out').addEventListener('click', async () => {
        await adminLogOut();
        showToast('Logged out');
        paint();
      });
    } else {
      card.querySelector('#adm-in').addEventListener('click', () => openAdminLoginModal(paint));
    }
  }
  await paint();
}

function openAdminLoginModal(onDone) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.innerHTML = `
    <div class="modal" style="max-width:340px;height:auto;align-self:center;border-radius:14px;">
      <h3 style="margin-bottom:8px;">Admin login</h3>
      <div class="setting-row">
        <div class="setting-label">Username</div>
        <input class="input-text" id="adm-user" autocapitalize="none" autocomplete="off">
      </div>
      <div class="setting-row">
        <div class="setting-label">Password</div>
        <input class="input-text" id="adm-pass" type="password">
      </div>
      <div class="row-buttons" style="margin-top:12px;">
        <button class="btn-secondary" id="adm-cancel">Cancel</button>
        <button class="btn-primary" id="adm-ok">Log in</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);
  const close = () => { root.innerHTML = ''; };
  overlay.querySelector('#adm-cancel').addEventListener('click', close);
  overlay.querySelector('#adm-ok').addEventListener('click', async () => {
    const u = overlay.querySelector('#adm-user').value.trim();
    const p = overlay.querySelector('#adm-pass').value;
    const ok = await adminLogIn(u, p);
    if (ok) {
      close();
      showToast('Cloud sync enabled');
      try { syncBootstrap && syncBootstrap(); } catch (_) {}
      if (onDone) onDone();
    } else {
      showToast('Invalid credentials');
    }
  });
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
    ov.className = 'compress-overlay';
    ov.innerHTML = `
      <div class="compress-head">
        <button class="modal-back" id="cmp-cancel" aria-label="Cancel">←</button>
        <div class="compress-title">Compare — swipe sideways</div>
        <button class="btn-primary" id="cmp-ok" style="min-height:38px;">Replace</button>
      </div>
      <div class="compress-strip" id="cmp-strip">
        <div class="compress-pane">
          <div class="compress-tag">Original · ${_fmtBytes(origBytes)}</div>
          <img src="${origUrl}" alt="Original">
        </div>
        <div class="compress-pane">
          <div class="compress-tag">Compressed · ${_fmtBytes(newBytes)} (${Math.round((1 - newBytes / origBytes) * 100)}% smaller)</div>
          <img src="${newUrl}" alt="Compressed">
        </div>
      </div>
      <div class="compress-dots"><span class="dot active" data-i="0"></span><span class="dot" data-i="1"></span></div>
    `;
    document.body.appendChild(ov);
    const close = (val) => { ov.remove(); resolve(val); };
    ov.querySelector('#cmp-cancel').addEventListener('click', () => close(false));
    ov.querySelector('#cmp-ok').addEventListener('click', () => close(true));
    const strip = ov.querySelector('#cmp-strip');
    const dots = ov.querySelectorAll('.compress-dots .dot');
    strip.addEventListener('scroll', () => {
      const idx = Math.round(strip.scrollLeft / strip.clientWidth);
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    });
    dots.forEach((d) => d.addEventListener('click', () => {
      const i = parseInt(d.dataset.i, 10);
      strip.scrollTo({ left: i * strip.clientWidth, behavior: 'smooth' });
    }));
  });
}

async function renderCircadianCard(container) {
  const card = document.createElement('div');
  card.className = 'card';
  container.appendChild(card);
  // "type" = wave id OR 'volume'. When 'volume', the row's value is a percentage.
  const TYPE_OPTS = [
    { v: 'delta',  l: 'Delta' },
    { v: 'theta',  l: 'Theta' },
    { v: 'alpha',  l: 'Alpha' },
    { v: 'beta',   l: 'Beta' },
    { v: 'gamma',  l: 'Gamma' },
    { v: 'volume', l: 'Volume %' },
  ];
  const WAVE_OPTS = TYPE_OPTS.filter((t) => t.v !== 'volume').map((t) => t.v);

  async function loadMerged() {
    // Merge transitions and volume nodes into one ordered list.
    const trans = await getCircadianTransitions();
    const vols  = await getCircadianVolumeNodes();
    const merged = [
      ...trans.map((t) => ({ offsetMin: t.offsetMin, type: t.wave })),
      ...vols.map((v)  => ({ offsetMin: v.offsetMin, type: 'volume', vol: v.vol })),
    ];
    return merged.sort((a, b) => a.offsetMin - b.offsetMin || (a.type === 'volume' ? 1 : -1));
  }

  async function draw() {
    const merged = await loadMerged();
    const rowsHtml = merged.map((n) => {
      const isVol = n.type === 'volume';
      return `
        <div class="circ-row" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
          ${_hmHtml(n.offsetMin, 23, 5)}
          <span style="align-self:center;">→</span>
          <select class="input-text circ-type" style="max-width:130px;">
            ${TYPE_OPTS.map((t) => `<option value="${t.v}" ${t.v===n.type?'selected':''}>${t.l}</option>`).join('')}
          </select>
          <input type="number" class="input-text circ-vol" min="1" max="100" step="1" value="${isVol ? (n.vol ?? 20) : ''}" placeholder="%" style="max-width:70px;${isVol?'':'display:none;'}">
          <button class="var-btn" data-act="del" style="background:#fce4e4;color:var(--e-color);">×</button>
        </div>
      `;
    }).join('');
    card.innerHTML = `
      <h3>Circadian Schedule</h3>
      <div class="setting-help">One ordered list of timeline nodes — choose Delta/Theta/Alpha/Beta/Gamma to switch the active state, or Volume % to set the playback level. Times are hours/minutes after wake. Rows reorder on save.</div>
      <div id="circ-list" style="display:flex;flex-direction:column;gap:8px;margin:10px 0;">${rowsHtml}</div>
      <div class="row-buttons">
        <button class="btn-secondary" id="circ-add">+ Add node</button>
        <button class="btn-secondary" id="circ-reset">Reset to default</button>
        <button class="btn-primary" id="circ-save">Save</button>
      </div>
      <div class="setting-row" style="margin-top:14px;border-top:1px solid var(--rule);padding-top:12px;">
        <div class="setting-label">Test moment</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
          ${_hmHtml(0, 23, 5).replace('hm-h', 'test-h').replace('hm-m', 'test-m')}
          <button class="btn-primary" id="circ-test" style="min-height:38px;">Test</button>
        </div>
        <div class="setting-help">Plays the wave + volume that would play at that time, with smooth fade-in/out so it interleaves with other audio.</div>
      </div>
    `;
    card.querySelectorAll('.circ-row').forEach((row) => {
      row.querySelector('[data-act="del"]').addEventListener('click', () => row.remove());
      const typeEl = row.querySelector('.circ-type');
      const volEl = row.querySelector('.circ-vol');
      typeEl.addEventListener('change', () => {
        volEl.style.display = typeEl.value === 'volume' ? '' : 'none';
      });
    });
    card.querySelector('#circ-add').addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'circ-row';
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
      row.innerHTML = _hmHtml(0, 23, 5) + `
        <span style="align-self:center;">→</span>
        <select class="input-text circ-type" style="max-width:130px;">
          ${TYPE_OPTS.map((t) => `<option value="${t.v}">${t.l}</option>`).join('')}
        </select>
        <input type="number" class="input-text circ-vol" min="1" max="100" step="1" value="" placeholder="%" style="max-width:70px;display:none;">
        <button class="var-btn" data-act="del" style="background:#fce4e4;color:var(--e-color);">×</button>
      `;
      row.querySelector('[data-act="del"]').addEventListener('click', () => row.remove());
      const typeEl = row.querySelector('.circ-type');
      const volEl = row.querySelector('.circ-vol');
      typeEl.addEventListener('change', () => {
        volEl.style.display = typeEl.value === 'volume' ? '' : 'none';
        if (typeEl.value === 'volume' && !volEl.value) volEl.value = '20';
      });
      card.querySelector('#circ-list').appendChild(row);
    });
    card.querySelector('#circ-reset').addEventListener('click', async () => {
      await setSetting('circadianTransitions', null);
      await setSetting('circadianVolumeNodes', null);
      await draw();
      showToast('Reset to defaults');
    });
    card.querySelector('#circ-save').addEventListener('click', async () => {
      const trans = []; const vols = [];
      card.querySelectorAll('.circ-row').forEach((row) => {
        const m = _readHm(row);
        const type = row.querySelector('.circ-type').value;
        if (type === 'volume') {
          const v = parseInt(row.querySelector('.circ-vol').value, 10);
          if (!isNaN(m) && !isNaN(v)) vols.push({ offsetMin: m, vol: Math.max(1, Math.min(100, v)) });
        } else if (WAVE_OPTS.includes(type)) {
          if (!isNaN(m)) trans.push({ offsetMin: m, wave: type });
        }
      });
      trans.sort((a, b) => a.offsetMin - b.offsetMin);
      vols.sort((a, b) => a.offsetMin - b.offsetMin);
      await setSetting('circadianTransitions', trans);
      await setSetting('circadianVolumeNodes', vols);
      showToast('Schedule saved');
      await draw();
    });

    // Bottom Test
    const testBtn = card.querySelector('#circ-test');
    let testActive = false;
    testBtn.addEventListener('click', async () => {
      if (testActive) {
        stopBeats(true);
        testBtn.textContent = 'Test';
        testActive = false;
        return;
      }
      const h = parseInt(card.querySelector('.test-h').value, 10) || 0;
      const m = parseInt(card.querySelector('.test-m').value, 10) || 0;
      const minute = h * 60 + m;
      // Determine wave + volume from current saved settings.
      const trans = await getCircadianTransitions();
      const vols = await getCircadianVolumeNodes();
      const sortedT = trans.slice().sort((a,b)=>a.offsetMin-b.offsetMin);
      let wave = sortedT[sortedT.length-1].wave;
      for (const t of sortedT) { if (t.offsetMin <= minute) wave = t.wave; else break; }
      const vol = volumeAtMinute(minute, vols) / 100;
      stopCircadian();
      const prev = _beats.volume;
      _beats.volume = Math.max(0.01, Math.min(1.0, vol));
      if (_beats.active) transitionToWave(wave); else startBeats(wave);
      _beats.volume = prev;
      testBtn.textContent = 'Stop';
      testActive = true;
      setTimeout(() => {
        if (testActive) {
          stopBeats(true);
          testBtn.textContent = 'Test';
          testActive = false;
        }
      }, 8000);
    });
  }
  await draw();
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
      <h3>Goals</h3>
      <div class="setting-help">All goals are editable. Reset wipes any custom edits and restores the original 26.</div>
      <div id="custom-list" style="margin:10px 0;display:flex;flex-direction:column;gap:8px;"></div>
      <details ${editing ? 'open' : ''} id="custom-form-wrap">
        <summary class="goals-add-btn">${editing ? '✏️ Edit goal' : '＋ Add new goal'}</summary>
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
          <label class="setting-label" style="font-size:13px;">Category
            <select class="input-text" id="cg-pillar">${pillarOptions}<option value="__new__">＋ New category…</option></select>
          </label>
          <label class="setting-label" style="font-size:13px;">Insert after
            <select class="input-text" id="cg-after">${buildAfterOptionsHtml(editing?.pillar || 'enjoyment')}</select>
          </label>
          <label class="setting-label" style="font-size:13px;">Start date
            <input class="input-text" type="date" id="cg-start" value="${escapeHtml(editing?.startDate || todayISO())}">
          </label>
          <div class="row-buttons" style="margin-top:6px;">
            ${editing ? '<button class="btn-secondary" id="cg-cancel">Cancel</button>' : ''}
            <button class="btn-primary" id="cg-save">${editing ? 'Save changes' : 'Add goal'}</button>
          </div>
        </div>
      </details>
      <div class="row-buttons" style="margin-top:10px;">
        <button class="btn-danger" id="goals-reset" style="flex:1;">Reset to defaults</button>
      </div>
    `;

    card.querySelector('#goals-reset').addEventListener('click', async () => {
      if (!confirm('Reset all goals to the original 26? Custom goals will be removed (their saved history stays in the database).')) return;
      await resetGoalsToDefault();
      editingId = null;
      showToast('Reset to default goals');
      refresh();
    });

    card.querySelector('#custom-list').innerHTML = listHtml;
    if (editing) {
      card.querySelector('#cg-pillar').value = editing.pillar;
      card.querySelector('#cg-after').value = editing.afterId;
    } else {
      card.querySelector('#cg-pillar').value = 'enjoyment';
    }
    // Re-filter "insert after" when pillar changes.
    card.querySelector('#cg-pillar').addEventListener('change', async (e) => {
      if (e.target.value === '__new__') {
        const name = prompt('New category name:');
        if (!name || !name.trim()) { e.target.value = 'enjoyment'; return; }
        const emoji = (prompt('Category emoji (one character):') || '🎯').trim();
        const id = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const customs = await loadCustomPillars();
        customs.push({ id, name: name.trim(), symbol: emoji });
        await saveCustomPillars(customs);
        await initQuestions();
        showToast('Category added');
        // Re-render the whole goals card to pick up new pillar in dropdown.
        editingId = null;
        await refresh();
        return;
      }
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
      const startDate = card.querySelector('#cg-start').value || todayISO();
      if (!text) { showToast('Goal text required'); return; }
      const list = await loadCustomGoals();
      if (editing) {
        const idx = list.findIndex((c) => c.id === editing.id);
        if (idx >= 0) list[idx] = { ...list[idx], emoji, text, note, pillar, afterId, startDate };
      } else {
        const id = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        list.push({ id, emoji, text, note, pillar, afterId, startDate });
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
