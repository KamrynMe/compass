let _calState = { year: null, month: null, filter: 'all' };

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

  const toggle = document.createElement('div');
  toggle.className = 'cal-toggle';
  toggle.innerHTML = `
    <button data-f="all"  class="${_calState.filter === 'all' ? 'active' : ''}">All Days</button>
    <button data-f="late" class="${_calState.filter === 'late' ? 'active' : ''}">Late Edits Only</button>
  `;
  container.appendChild(toggle);
  toggle.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      _calState.filter = b.dataset.f;
      renderCalendarView(container);
    });
  });

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

  // Build grid
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

  // Lookup of records for this month
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
    let dotCls = 'l1';
    if (pct >= 76) dotCls = 'l4';
    else if (pct >= 51) dotCls = 'l3';
    else if (pct >= 26) dotCls = 'l2';

    const late = rec && isLateEdit(rec);
    if (_calState.filter === 'late' && !late) cell.classList.add('dim');

    cell.innerHTML = `
      ${late ? '<span class="late-mark">●</span>' : ''}
      <div>${day}</div>
      <span class="dot ${dotCls}"></span>
    `;
    cell.addEventListener('click', () => openDayModal(dateISO));
    grid.appendChild(cell);
  }
  container.appendChild(grid);

  const legend = document.createElement('div');
  legend.className = 'muted';
  legend.style.marginTop = '12px';
  legend.style.fontSize = '13px';
  legend.style.textAlign = 'center';
  legend.innerHTML = '<span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--rule);margin:0 4px;vertical-align:middle"></span>0–25% &nbsp; <span style="background:#e0a050" class="dot" ></span>26–50% &nbsp; <span style="background:var(--gold)" class="dot"></span>51–75% &nbsp; <span style="background:var(--h-border)" class="dot"></span>76–100%';
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

  const editor = renderDayEditor(record, {
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
