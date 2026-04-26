let _calState = { year: null, month: null };

function lerpHex(a, b, t) {
  const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const c = Math.round(ab + (bb - ab) * t);
  return '#' + ((r << 16) | (g << 8) | c).toString(16).padStart(6, '0');
}
function colorForPct(pct) {
  // brown(0) → orange(30) → yellow(60) → green(90)+; clamp at 100+
  if (pct <= 0) return '#a89070';
  if (pct < 30) return lerpHex('#a89070', '#d68030', pct / 30);
  if (pct < 60) return lerpHex('#d68030', '#e8c040', (pct - 30) / 30);
  if (pct < 90) return lerpHex('#e8c040', '#4a9a6a', (pct - 60) / 30);
  return '#4a9a6a';
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
    const isPast = dateISO < today;
    let bg;
    if (rec) {
      bg = colorForPct(pct);
    } else if (isPast) {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      bg = dark ? '#2a241e' : '#cfc6b8';
    } else {
      bg = 'transparent';
    }
    cell.style.background = bg;
    // White text on every filled cell (brown is dark enough); grey on past empty.
    if (rec) cell.style.setProperty('color', '#ffffff', 'important');
    else if (isPast) cell.style.setProperty('color', '#6a6050', 'important');

    if (rec && rec.lastEditedAt && !isLateEdit(rec)) cell.classList.add('timely');

    const isFuture = dateISO > today;
    if (isFuture) cell.classList.add('future');
    cell.innerHTML = `<div>${day}</div>`;
    cell.addEventListener('click', () => {
      if (isFuture) { showToast('Future dates can\'t be edited'); return; }
      openDayModal(dateISO);
    });
    grid.appendChild(cell);
  }
  container.appendChild(grid);

  const legend = document.createElement('div');
  legend.className = 'muted';
  legend.style.marginTop = '12px';
  legend.style.fontSize = '12px';
  legend.style.textAlign = 'center';
  legend.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
      <span style="background:#a89070;display:inline-block;width:14px;height:14px;border-radius:3px;"></span> 0%
      <span style="background:#d68030;display:inline-block;width:14px;height:14px;border-radius:3px;"></span> 30%
      <span style="background:#e8c040;display:inline-block;width:14px;height:14px;border-radius:3px;"></span> 60%
      <span style="background:#4a9a6a;display:inline-block;width:14px;height:14px;border-radius:3px;"></span> 90%+
    </div>
    <div style="margin-top:6px;">Blue outline: edited on time (within 48h of day's end).</div>
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
    <button class="modal-back" id="modal-close" aria-label="Back">←</button>
    <div class="modal-date">${niceDate}</div>
    <span style="width:44px;"></span>
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
