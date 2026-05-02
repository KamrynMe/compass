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
  // Tap month label to jump to a specific month/year
  controls.querySelector('#cal-label').style.cursor = 'pointer';
  controls.querySelector('#cal-label').addEventListener('click', () => openMonthPicker(container));
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
    const isFuture = dateISO > today;
    let bg;
    if (rec) {
      bg = colorForPct(pct);
    } else if (isFuture) {
      // Upcoming days now appear dark
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      bg = dark ? '#2a241e' : '#9a8b78';
    } else if (isPast) {
      // Past empty days are blank
      bg = 'transparent';
    } else {
      bg = 'transparent';
    }
    cell.style.background = bg;
    if (rec) cell.style.setProperty('color', '#ffffff', 'important');
    else if (isFuture) cell.style.setProperty('color', '#ffffff', 'important');

    if (rec && rec.lastEditedAt && !isLateEdit(rec)) cell.classList.add('timely');

    if (isFuture) cell.classList.add('future');
    cell.innerHTML = `<div>${day}</div>`;
    cell.addEventListener('click', () => {
      if (isFuture) { showToast('Future dates can\'t be edited'); return; }
      openDayModal(dateISO);
    });
    grid.appendChild(cell);
  }
  container.appendChild(grid);

  // Swipe left/right to change months
  let touchStartX = null, touchStartY = null;
  grid.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
  }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) {
        _calState.month++;
        if (_calState.month > 11) { _calState.month = 0; _calState.year++; }
      } else {
        _calState.month--;
        if (_calState.month < 0) { _calState.month = 11; _calState.year--; }
      }
      renderCalendarView(container);
    }
    touchStartX = touchStartY = null;
  });

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

  await renderCalendarCorrelations(container);
}

async function renderCalendarCorrelations(container) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h3>Top Correlations — Last 30 Days</h3>
    <div id="cal-corr-body" class="muted" style="font-size:14px;">Computing…</div>
  `;
  container.appendChild(card);
  const body = card.querySelector('#cal-corr-body');
  try {
    const all = await getAllDays();
    const today30 = new Date();
    today30.setDate(today30.getDate() - 30);
    const cutoffISO = today30.toISOString().slice(0, 10);
    const recent = all.filter((r) => r.date >= cutoffISO);
    if (recent.length < 5) {
      body.innerHTML = '<div class="empty-state">Need at least 5 days of recent data.</div>';
      return;
    }
    const catalog = buildVariableCatalog();
    function topN(lag, n) {
      const out = [];
      for (let i = 0; i < catalog.length; i++) {
        for (let j = i + 1; j < catalog.length; j++) {
          const a = catalog[i], b = catalog[j];
          if (a.id === b.id) continue;
          const pairs = buildPairs(recent, [a], [b], lag);
          if (pairs.length < 5) continue;
          const r = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y));
          if (r == null) continue;
          out.push({ a: a.name, b: b.name, r, n: pairs.length });
        }
      }
      out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
      return out.slice(0, n);
    }
    const sameDay = topN(0, 3);
    const lag2 = topN(2, 1);
    const lag7 = topN(7, 1);
    function fmt(rows, label) {
      if (!rows.length) return `<div class="muted" style="font-size:12px;">${label}: not enough data.</div>`;
      return `
        <div class="section-title" style="margin:8px 0 4px;">${label}</div>
        ${rows.map((r) => {
          const pct = Math.round(r.r * 100);
          const cls = Math.abs(r.r) >= 0.6 ? 'high' : Math.abs(r.r) >= 0.3 ? 'mid' : 'low';
          return `
            <div class="var-item" style="border-bottom:1px solid #f0ece4;">
              <div style="flex:1;min-width:0;font-size:13px;">${escapeHtml(r.a)} ↔ ${escapeHtml(r.b)}</div>
              <div class="q-streak ${cls}" style="font-variant-numeric:tabular-nums;">${pct >= 0 ? '+' : ''}${pct}%</div>
            </div>
          `;
        }).join('')}
      `;
    }
    body.innerHTML = `
      ${fmt(sameDay, 'Same-day · top 3')}
      ${fmt(lag2, '2-day lag · top 1')}
      ${fmt(lag7, '7-day lag · top 1')}
    `;
  } catch (e) {
    body.innerHTML = '<div class="empty-state">Could not compute.</div>';
  }
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

function openMonthPicker(container) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.innerHTML = `
    <div class="modal" style="max-width:340px;height:auto;align-self:center;border-radius:14px;">
      <h3 style="margin-bottom:12px;">Jump to month</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <label class="muted" style="font-size:12px;">Month
          <select id="mp-month" class="input-text"></select>
        </label>
        <label class="muted" style="font-size:12px;">Year
          <input id="mp-year" class="input-text" type="number" value="${_calState.year}">
        </label>
      </div>
      <div class="row-buttons" style="margin-top:14px;">
        <button class="btn-secondary" id="mp-cancel">Cancel</button>
        <button class="btn-primary" id="mp-go">Go</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);
  const sel = overlay.querySelector('#mp-month');
  for (let i = 0; i < 12; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' });
    if (i === _calState.month) opt.selected = true;
    sel.appendChild(opt);
  }
  const close = () => { root.innerHTML = ''; };
  overlay.querySelector('#mp-cancel').addEventListener('click', close);
  overlay.querySelector('#mp-go').addEventListener('click', () => {
    _calState.month = parseInt(sel.value, 10);
    _calState.year = parseInt(overlay.querySelector('#mp-year').value, 10) || _calState.year;
    close();
    renderCalendarView(container);
  });
}

async function renderTopDaysSection(container, title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<h3>${title}</h3><div id="top-days-body" class="muted" style="font-size:14px;">Computing…</div>`;
  container.appendChild(card);
  try {
    const all = await getAllDays();
    const today = todayISO();
    const scored = [];
    for (const r of all) {
      const s = (await scoreForRecord(r)).score;
      if (s > 0) scored.push({ date: r.date, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);
    if (!top.length) {
      card.querySelector('#top-days-body').innerHTML = '<div class="empty-state">No scores yet.</div>';
      return;
    }
    card.querySelector('#top-days-body').innerHTML = top.map((d, i) => {
      const date = new Date(d.date + 'T12:00:00');
      const formatted = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
      const isToday = d.date === today;
      return `<div class="top-day-row${isToday ? ' is-today' : ''}">${i + 1}. ${formatted} - ${d.score.toLocaleString()} pts</div>`;
    }).join('');
  } catch (_) {
    card.querySelector('#top-days-body').innerHTML = '<div class="empty-state">Could not compute.</div>';
  }
}
