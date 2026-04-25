let _calState = { year: null, month: null };

// Returns a CSS background color for a given completion %.
// 0 → muted brown; 50 → orange-yellow; 100 → green.
function calCellColor(pct) {
  if (pct <= 0) return '#f0e8de';
  // Three-stop gradient interpolation.
  const stops = [
    { p: 0,   r: 154, g: 110, b: 70 },   // brown
    { p: 50,  r: 232, g: 178, b: 80 },   // orange-yellow
    { p: 100, r: 90,  g: 168, b: 110 },  // green
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (pct >= stops[i].p && pct <= stops[i + 1].p) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const t = (pct - lo.p) / Math.max(1, (hi.p - lo.p));
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);
  // Soften with white blend so the day number stays readable.
  const blend = 0.55;
  const wr = Math.round(r * blend + 255 * (1 - blend));
  const wg = Math.round(g * blend + 255 * (1 - blend));
  const wb = Math.round(b * blend + 255 * (1 - blend));
  return `rgb(${wr},${wg},${wb})`;
}

async function renderCalendarView(container) {
  if (_calState.year == null) {
    const now = new Date();
    _calState.year = now.getFullYear();
    _calState.month = now.getMonth();
  }
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <div>
      <div class="view-title">Calendar</div>
      <div class="view-sub">Tap any day to edit</div>
    </div>
    <button class="cal-today-btn" id="cal-today">Today</button>
  `;
  container.appendChild(header);

  const controls = document.createElement('div');
  controls.className = 'cal-controls';
  controls.innerHTML = `
    <button class="cal-nav-btn" id="cal-prev">‹</button>
    <div class="cal-month" id="cal-label"></div>
    <button class="cal-nav-btn" id="cal-next">›</button>
  `;
  container.appendChild(controls);
  controls.querySelector('#cal-prev').addEventListener('click', () => {
    _calState.month--;
    if (_calState.month < 0) { _calState.month = 11; _calState.year--; }
    renderCalendarView(container);
  });
  controls.querySelector('#cal-next').addEventListener('click', () => {
    _calState.month++;
    if (_calState.month > 11) { _calState.month = 0; _calState.year++; }
    renderCalendarView(container);
  });
  header.querySelector('#cal-today').addEventListener('click', () => {
    const n = new Date();
    _calState.year = n.getFullYear();
    _calState.month = n.getMonth();
    renderCalendarView(container);
  });

  const monthName = new Date(_calState.year, _calState.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  controls.querySelector('#cal-label').textContent = monthName;

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  for (const d of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
    const e = document.createElement('div');
    e.className = 'cal-dow';
    e.textContent = d;
    grid.appendChild(e);
  }

  const firstDow = new Date(_calState.year, _calState.month, 1).getDay();
  const lastDay = new Date(_calState.year, _calState.month + 1, 0).getDate();

  const startISO = `${_calState.year}-${String(_calState.month + 1).padStart(2, '0')}-01`;
  const endISO = `${_calState.year}-${String(_calState.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const records = await getDaysInRange(startISO, endISO);
  const byDate = {};
  for (const r of records) byDate[r.date] = r;

  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }
  const today = todayISO();
  for (let day = 1; day <= lastDay; day++) {
    const dateISO = `${_calState.year}-${String(_calState.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const rec = byDate[dateISO];
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (dateISO === today) cell.classList.add('today');
    const pct = rec ? overallCompletion(rec) : 0;
    cell.style.background = calCellColor(pct);
    if (rec && isLateEdit(rec)) cell.classList.add('late');
    cell.innerHTML = `<div class="cal-num">${day}</div><div class="cal-pct">${rec ? pct + '%' : ''}</div>`;
    cell.addEventListener('click', () => openDayModal(dateISO));
    grid.appendChild(cell);
  }
  container.appendChild(grid);

  const legend = document.createElement('div');
  legend.className = 'muted';
  legend.style.marginTop = '12px';
  legend.style.fontSize = '13px';
  legend.style.textAlign = 'center';
  legend.innerHTML = `
    <span class="cal-legend-bar"></span>
    <div style="margin-top:4px;">Brown 0% &nbsp;→&nbsp; Yellow 50% &nbsp;→&nbsp; Green 100%</div>
    <div style="margin-top:6px;">Red dashed outline = last edited &gt; 48 hrs after the day ended.</div>
  `;
  container.appendChild(legend);
}

async function openDayModal(dateISO) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  overlay.appendChild(modal);
  root.appendChild(overlay);

  let record = await getOrInitDay(dateISO);

  const head = document.createElement('div');
  head.className = 'modal-head';
  const niceDate = new Date(dateISO + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  head.innerHTML = `
    <div class="modal-date">${niceDate}</div>
    <button class="modal-close" id="modal-close">×</button>
  `;
  modal.appendChild(head);

  const editor = await renderDayEditor(record, {
    onChange: async (rec) => {
      await saveDay(rec);
      editor.element.dispatchEvent(new Event('record-saved'));
    },
  });
  modal.appendChild(editor.element);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  actions.innerHTML = `
    <button class="btn-secondary" id="modal-cancel">Close</button>
    <button class="btn-primary" id="modal-save">Save</button>
  `;
  overlay.appendChild(actions);

  const close = () => { root.innerHTML = ''; renderCalendarView(document.getElementById('view')); };
  head.querySelector('#modal-close').addEventListener('click', close);
  actions.querySelector('#modal-cancel').addEventListener('click', close);
  actions.querySelector('#modal-save').addEventListener('click', async () => {
    await saveDay(record);
    showToast('Saved');
    close();
  });
}
