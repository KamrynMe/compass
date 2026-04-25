// Renders the Today view AND is reused by the day-detail modal.
function renderDayEditor(record, opts = {}) {
  const onChange = opts.onChange || (() => {});
  const wrap = document.createElement('div');

  // Progress
  const progressCard = document.createElement('div');
  progressCard.className = 'card';
  progressCard.innerHTML = `
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill" id="ed-progress-fill"></div></div>
      <div class="progress-label" id="ed-progress-label">0 / 26</div>
    </div>
  `;
  wrap.appendChild(progressCard);

  // Sliders
  const slidersCard = document.createElement('div');
  slidersCard.className = 'card';
  slidersCard.innerHTML = `<h3>Day Scores</h3><div class="sliders" id="ed-sliders"></div>`;
  wrap.appendChild(slidersCard);
  const slidersBox = slidersCard.querySelector('#ed-sliders');
  for (const s of SLIDERS) {
    const v = record.sliders[s.id] ?? 0;
    const row = document.createElement('div');
    row.className = 'slider-row ' + s.cls;
    row.innerHTML = `
      <div class="slider-label">${s.label}</div>
      <div class="slider-val" id="val-${s.id}">${v}</div>
      <input class="slider-input" type="range" min="0" max="100" step="1" value="${v}" data-slider="${s.id}">
    `;
    slidersBox.appendChild(row);
    const input = row.querySelector('input');
    const valOut = row.querySelector('.slider-val');
    let timer = null;
    input.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      valOut.textContent = val;
      record.sliders[s.id] = val;
      clearTimeout(timer);
      timer = setTimeout(() => onChange(record), 300);
    });
  }

  // Weather
  const weatherCard = document.createElement('div');
  weatherCard.className = 'card';
  weatherCard.id = 'ed-weather-card';
  wrap.appendChild(weatherCard);
  function renderWeather() {
    const w = record.weather;
    const t = (v, suf) => v == null ? '—' : v + suf;
    weatherCard.innerHTML = `
      <h3>Weather</h3>
      <div class="weather-grid">
        <div class="weather-cell"><div class="v" id="w-temp">${t(w?.temp6am, '°F')}</div><div class="l">6 AM</div></div>
        <div class="weather-cell"><div class="v" id="w-feel">${t(w?.realFeel3pm, '°F')}</div><div class="l">3 PM Feel</div></div>
        <div class="weather-cell"><div class="v" id="w-precip">${w?.precipitation == null ? '—' : (w.precipitation > 0 ? w.precipitation + '"' : 'None')}</div><div class="l">Precip</div></div>
      </div>
      <button class="weather-retry" id="ed-weather-fetch">${w?.fetchedAt ? 'Refresh weather' : 'Fetch weather'}</button>
      <details style="margin-top:10px;">
        <summary class="muted" style="cursor:pointer;font-size:13px;">Edit manually</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">
          <label class="muted" style="font-size:12px;">6am °F<input class="input-text" type="number" id="m-temp" value="${w?.temp6am ?? ''}"></label>
          <label class="muted" style="font-size:12px;">3pm Feel<input class="input-text" type="number" id="m-feel" value="${w?.realFeel3pm ?? ''}"></label>
          <label class="muted" style="font-size:12px;">Precip in<input class="input-text" type="number" step="0.01" id="m-precip" value="${w?.precipitation ?? ''}"></label>
        </div>
      </details>
    `;
    weatherCard.querySelector('#ed-weather-fetch').addEventListener('click', async () => {
      try {
        const w2 = await getOrFetchWeatherForToday({ ...record, weather: null });
        record.weather = w2;
        onChange(record);
        renderWeather();
        showToast('Weather updated');
      } catch (e) {
        showToast(e.message || 'Weather fetch failed');
      }
    });
    ['m-temp', 'm-feel', 'm-precip'].forEach((id) => {
      const el = weatherCard.querySelector('#' + id);
      el.addEventListener('change', () => {
        if (!record.weather) record.weather = { temp6am: null, realFeel3pm: null, precipitation: null, fetchedAt: new Date().toISOString() };
        const t = parseFloat(weatherCard.querySelector('#m-temp').value);
        const f = parseFloat(weatherCard.querySelector('#m-feel').value);
        const p = parseFloat(weatherCard.querySelector('#m-precip').value);
        record.weather.temp6am = isNaN(t) ? null : Math.round(t);
        record.weather.realFeel3pm = isNaN(f) ? null : Math.round(f);
        record.weather.precipitation = isNaN(p) ? null : Math.round(p * 100) / 100;
        record.weather.fetchedAt = record.weather.fetchedAt || new Date().toISOString();
        onChange(record);
        renderWeather();
      });
    });
  }
  renderWeather();

  // Pillars + questions
  for (const p of PILLARS) {
    const pillar = document.createElement('div');
    pillar.className = 'pillar ' + p.id;
    const qs = questionsByPillar(p.id);
    pillar.innerHTML = `
      <div class="pillar-head">
        <div>
          <div class="pillar-name">${p.symbol} &nbsp; ${p.name}</div>
          <div class="pillar-meta" data-meta="${p.id}">0 / ${qs.length} answered</div>
        </div>
        <div class="pillar-toggle">▾</div>
      </div>
      <div class="pillar-body" data-body="${p.id}"></div>
    `;
    pillar.querySelector('.pillar-head').addEventListener('click', () => {
      pillar.classList.toggle('collapsed');
    });
    const body = pillar.querySelector('[data-body]');
    for (const q of qs) {
      const qrec = record.questions[q.id] || { checked: false, note: '' };
      const row = document.createElement('div');
      row.className = 'q' + (q.anchor ? ' anchor' : '') + (qrec.checked ? ' checked' : '');
      row.innerHTML = `
        <label class="q-check-tap">
          <input type="checkbox" class="q-check" ${qrec.checked ? 'checked' : ''} data-q="${q.id}">
        </label>
        <div class="q-body">
          <div class="q-text">${escapeHtml(q.text)}${q.anchor ? ' <span class="q-star">★ Anchor</span>' : ''}</div>
          <div class="q-note">${escapeHtml(q.note)}</div>
          <textarea class="q-noteinput${qrec.note ? ' open' : ''}" placeholder="Add a note for ${q.id.toUpperCase()}…" data-note="${q.id}">${escapeHtml(qrec.note || '')}</textarea>
        </div>
        <button type="button" class="q-expand${qrec.note ? ' open' : ''}" aria-label="Toggle note">+</button>
      `;
      body.appendChild(row);

      const checkbox = row.querySelector('.q-check');
      checkbox.addEventListener('change', () => {
        record.questions[q.id].checked = checkbox.checked;
        row.classList.toggle('checked', checkbox.checked);
        updateProgress();
        onChange(record);
      });
      const noteInput = row.querySelector('.q-noteinput');
      const expandBtn = row.querySelector('.q-expand');
      expandBtn.addEventListener('click', () => {
        noteInput.classList.toggle('open');
        expandBtn.classList.toggle('open');
        if (noteInput.classList.contains('open')) noteInput.focus();
      });
      let noteTimer = null;
      noteInput.addEventListener('input', () => {
        record.questions[q.id].note = noteInput.value;
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => onChange(record), 400);
      });
    }
    wrap.appendChild(pillar);
  }

  // Intentions
  const intCard = document.createElement('div');
  intCard.className = 'card';
  intCard.innerHTML = `
    <h3>Today's Intentions</h3>
    <textarea class="intentions" id="ed-intentions" placeholder="What matters most today…">${escapeHtml(record.intentions || '')}</textarea>
  `;
  wrap.appendChild(intCard);
  const intArea = intCard.querySelector('#ed-intentions');
  let intTimer = null;
  intArea.addEventListener('input', () => {
    record.intentions = intArea.value;
    clearTimeout(intTimer);
    intTimer = setTimeout(() => onChange(record), 400);
  });

  // Last edited
  const lastEdited = document.createElement('div');
  lastEdited.className = 'last-edited';
  lastEdited.id = 'ed-last-edited';
  wrap.appendChild(lastEdited);
  function renderLastEdited() {
    if (!record.lastEditedAt) {
      lastEdited.textContent = 'Not yet saved';
      return;
    }
    const d = new Date(record.lastEditedAt);
    const txt = 'Last edited: ' + d.toLocaleString();
    lastEdited.innerHTML = txt + (isLateEdit(record) ? '<span class="late-badge">Late edit</span>' : '');
  }
  renderLastEdited();

  function updateProgress() {
    const checked = QUESTIONS.filter((q) => record.questions[q.id]?.checked).length;
    const fill = wrap.querySelector('#ed-progress-fill');
    const label = wrap.querySelector('#ed-progress-label');
    if (fill) fill.style.width = Math.round((checked / QUESTIONS.length) * 100) + '%';
    if (label) label.textContent = checked + ' / ' + QUESTIONS.length;
    for (const p of PILLARS) {
      const meta = wrap.querySelector(`[data-meta="${p.id}"]`);
      if (meta) {
        const qs = questionsByPillar(p.id);
        const done = qs.filter((q) => record.questions[q.id]?.checked).length;
        meta.textContent = `${done} / ${qs.length} answered`;
      }
    }
  }
  updateProgress();

  // Wrap onChange to also re-render lastEdited
  const userOnChange = onChange;
  const wrappedOnChange = async (rec) => {
    await userOnChange(rec);
    renderLastEdited();
  };
  // Replace handlers? Simpler: poll after onChange via mutation — but easier path:
  // We attach a custom event listener.
  wrap.addEventListener('record-saved', renderLastEdited);

  return { element: wrap, refreshLastEdited: renderLastEdited };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function renderTodayView(container) {
  const date = todayISO();
  let record = await getOrInitDay(date);

  // First-visit pre-population from yesterday
  if (!record.createdAt) {
    const yest = await getYesterdayRecord();
    if (yest && yest.sliders) {
      record.sliders = { ...yest.sliders };
    }
    // Try fetching weather once
    try {
      const loc = await getSetting('location');
      if (loc && loc.lat != null) {
        record.weather = await fetchWeather(loc.lat, loc.lon);
      }
    } catch (_) { /* ignore */ }
    await saveDay(record);
  }

  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'view-header';
  const niceDate = new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  header.innerHTML = `
    <div>
      <div class="view-title">Today</div>
      <div class="view-sub">${niceDate}</div>
    </div>
  `;
  container.appendChild(header);

  const editor = renderDayEditor(record, {
    onChange: async (rec) => {
      await saveDay(rec);
      editor.element.dispatchEvent(new Event('record-saved'));
    },
  });
  container.appendChild(editor.element);
}
