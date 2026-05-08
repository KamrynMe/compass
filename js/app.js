const ROUTES = {
  today: renderTodayView,
  calendar: renderCalendarView,
  analytics: renderAnalyticsView,
  achievements: renderAchievementsView,
  beats: renderBeatsView,
  settings: renderSettingsView,
};

function currentRoute() {
  const h = (location.hash || '#today').replace('#', '');
  return ROUTES[h] ? h : 'today';
}

async function navigate() {
  const route = currentRoute();
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === route);
  });
  const view = document.getElementById('view');
  // Reset scroll BEFORE render so the URL bar / position:fixed elements settle correctly.
  window.scrollTo(0, 0);
  // Always release any open settings menu when navigating between tabs.
  document.body.classList.remove('settings-menu-open');
  view.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    await ROUTES[route](view);
  } catch (e) {
    console.error(e);
    view.innerHTML = '<div class="empty-state">Something went wrong: ' + (e.message || e) + '</div>';
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', navigate);
function applyTheme(setting) {
  let t = setting || 'dark';
  try { localStorage.setItem('themeMode', setting || 'dark'); } catch (_) {}
  if (t === 'system') {
    t = matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
}

if (matchMedia) {
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const s = (await getSetting('themeMode')) || 'system';
      if (s === 'system') applyTheme('system');
    });
  } catch (_) {}
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!location.hash) location.hash = '#today';
  try { await initQuestions(); } catch (_) {}
  try { applyTheme((await getSetting('themeMode')) || 'dark'); } catch (_) {}
  try { await maybePromptWakeTime(); } catch (_) {}
  navigate();
  setupTabDoubleTap();
  // Cloud sync — pull at boot, then auto-push on changes.
  try { if (typeof syncBootstrap === 'function') syncBootstrap(); } catch (_) {}
  // Allow Supabase REST in the SW network-first list (fetch passes through naturally — no extra setup needed).

  // Re-arm reminder if set
  try {
    const t = await getSetting('reminderTime');
    if (t) scheduleReminder(t);
  } catch (_) {}
  try { await loadSoundPref(); } catch (_) {}
  try { await maybeShowBackupBanner(); } catch (_) {}
});

async function maybeShowBackupBanner() {
  const days = await getAllDays();
  if (!days.length) return;
  const lastExport = await getSetting('lastExportAt');
  const lastNag = await getSetting('lastBackupNagAt');
  const now = Date.now();
  const dayMs = 86400000;
  const exportAgeDays = lastExport ? (now - new Date(lastExport).getTime()) / dayMs : Infinity;
  const nagAgeDays = lastNag ? (now - new Date(lastNag).getTime()) / dayMs : Infinity;
  // Nag if never exported AND there are 3+ days of data, or last export > 14 days ago.
  // Don't nag more than once every 7 days.
  const shouldNag = (exportAgeDays > 14 || (!lastExport && days.length >= 3)) && nagAgeDays > 7;
  if (!shouldNag) return;

  const wrap = document.createElement('div');
  wrap.className = 'backup-banner';
  wrap.innerHTML = `
    <div>
      <strong>Back up your data.</strong>
      <div style="font-size:13px;margin-top:2px;opacity:0.9;">Removing the home-screen icon erases everything. Export now to be safe.</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0;">
      <button class="btn-secondary" id="bk-later">Later</button>
      <button class="btn-primary" id="bk-go">Export</button>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector('#bk-later').addEventListener('click', async () => {
    await setSetting('lastBackupNagAt', new Date().toISOString());
    wrap.remove();
  });
  wrap.querySelector('#bk-go').addEventListener('click', async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `compass-export-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await setSetting('lastExportAt', new Date().toISOString());
    await setSetting('lastBackupNagAt', new Date().toISOString());
    wrap.remove();
    showToast('Exported');
  });
}

async function maybePromptWakeTime() {
  const wake = await getSetting('wakeTime');
  const all = await getAllDays();
  if (wake || all.length > 0) return;
  // Show blocking modal
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;height:auto;align-self:center;border-radius:14px;">
      <h2 style="margin-bottom:6px;">Welcome to Scheduler</h2>
      <div class="muted" style="font-size:14px;line-height:1.5;margin-bottom:14px;">First, set your wake-up time. Your daily score, multipliers, and the circadian beat schedule all key off it. <strong>You can change this any time in Settings.</strong></div>
      <div class="setting-row">
        <div class="setting-label">Wake-up time</div>
        <input class="input-text" type="time" step="300" id="wt-time" value="05:00">
      </div>
      <div class="row-buttons" style="margin-top:14px;">
        <button class="btn-primary" id="wt-save" style="flex:1;">Save & continue</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);
  return new Promise((resolve) => {
    overlay.querySelector('#wt-save').addEventListener('click', async () => {
      const v = overlay.querySelector('#wt-time').value || '05:00';
      await setSetting('wakeTime', v);
      await setSetting('winddownTime', winddownFromWake(v));
      root.innerHTML = '';
      resolve();
    });
  });
}

let _lastTabTap = { tab: null, time: 0 };
function setupTabDoubleTap() {
  const bar = document.getElementById('tabbar');
  if (!bar) return;
  bar.addEventListener('click', async (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const id = tab.dataset.tab;
    const now = Date.now();
    if (_lastTabTap.tab === id && (now - _lastTabTap.time) < 450) {
      _lastTabTap = { tab: null, time: 0 };
      e.preventDefault();
      await handleTabDoubleTap(id);
      return;
    }
    _lastTabTap = { tab: id, time: now };
  });
}

async function handleTabDoubleTap(id) {
  if (id === 'today') {
    if (location.hash !== '#today') { location.hash = '#today'; await new Promise((r) => setTimeout(r, 60)); }
    // Scroll to first uncompleted (value 0) unlocked goal
    const rows = document.querySelectorAll('.q:not(.locked)');
    for (const row of rows) {
      const slider = row.querySelector('.q-slider');
      if (slider && parseInt(slider.value, 10) === 0) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    showToast('All unlocked goals worked on already!');
  } else if (id === 'calendar') {
    if (location.hash !== '#calendar') { location.hash = '#calendar'; await new Promise((r) => setTimeout(r, 60)); }
    const btn = document.getElementById('cal-today');
    if (btn) btn.click();
  } else if (id === 'beats') {
    if (typeof _beats !== 'undefined' && _beats.circadian) {
      stopCircadian();
      stopBeats(true);
      showToast('Circadian stopped');
    } else if (typeof startCircadian === 'function') {
      await startCircadian();
      showToast('Circadian started');
    }
    // Sync visual state of any rendered beats grid.
    document.querySelectorAll('.beat-btn').forEach((b) => {
      const isCirc = b.dataset.wave === '__circadian';
      b.classList.toggle('active', isCirc ? !!(typeof _beats !== 'undefined' && _beats.circadian) : (b.dataset.wave === (typeof _beats !== 'undefined' ? _beats.active : null)));
    });
  } else if (id === 'settings') {
    const cur = (await getSetting('themeMode')) || 'system';
    let next;
    if (cur === 'light') next = 'dark';
    else if (cur === 'dark') next = 'light';
    else next = matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
    await setSetting('themeMode', next);
    applyTheme(next);
    showToast('Theme: ' + next);
  } else if (id === 'achievements') {
    if (location.hash !== '#achievements') { location.hash = '#achievements'; await new Promise((r) => setTimeout(r, 150)); }
    const m = document.getElementById('awards-this-month');
    if (m) {
      m.open = true;
      m.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } else if (id === 'analytics') {
    if (location.hash !== '#analytics') { location.hash = '#analytics'; await new Promise((r) => setTimeout(r, 100)); }
    // Toggle: top of page ↔ Relationships Ranking with Daily Score selected.
    const card = document.getElementById('relationships-ranking');
    if (!card) return;
    const cardTop = card.getBoundingClientRect().top;
    const atRR = cardTop > -50 && cardTop < 200;
    if (atRR) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const items = card.querySelectorAll('.var-list .var-item');
      for (const it of items) {
        if (/Daily Score/i.test(it.textContent)) {
          const b = it.querySelector('button');
          if (b && !b.classList.contains('on')) b.click();
          break;
        }
      }
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

function showToast(msg, ms = 2200) {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
