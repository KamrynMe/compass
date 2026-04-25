const ROUTES = {
  today: renderTodayView,
  calendar: renderCalendarView,
  analytics: renderAnalyticsView,
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
window.addEventListener('DOMContentLoaded', async () => {
  if (!location.hash) location.hash = '#today';
  navigate();

  // Re-arm reminder if set
  try {
    const t = await getSetting('reminderTime');
    if (t) scheduleReminder(t);
  } catch (_) {}
});

function showToast(msg, ms = 2200) {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
