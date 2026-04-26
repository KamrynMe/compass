const ROUTES = {
  today: renderTodayView,
  calendar: renderCalendarView,
  analytics: renderAnalyticsView,
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
  let t = setting || 'system';
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
  try { applyTheme((await getSetting('themeMode')) || 'system'); } catch (_) {}
  navigate();

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

function showToast(msg, ms = 2200) {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
