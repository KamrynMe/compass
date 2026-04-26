// Renders the Today view AND is reused by the day-detail modal.
async function renderDayEditor(record, opts = {}) {
  const onChange = opts.onChange || (() => {});
  const wrap = document.createElement('div');
  const counts = await recentCheckCounts(record.date);
  const unlocked = await computeUnlockedSet(record.date, counts);
  const unlockedCount = unlocked.size;
  let scoreTickTimer = null;
  let saveTimer = null;
  const debouncedSave = (rec) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => onChange(rec), 250);
  };

  // Header card: progress bar, daily score, unlocked count, score-change countdown
  const progressCard = document.createElement('div');
  progressCard.className = 'card';
  progressCard.innerHTML = `
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill" id="ed-progress-fill"></div></div>
      <div class="progress-label" id="ed-progress-label">0 / ${unlockedCount}</div>
    </div>
    <div class="score-row">
      <div><div class="score-label">Daily Score</div><div class="score-value" id="ed-score">0</div></div>
      <div><div class="score-label">Unlocked</div><div class="score-value" id="ed-unlocked">${unlockedCount} / ${QUESTIONS.length}</div></div>
    </div>
    <div class="score-tick-row" id="ed-tick">Next per-habit −1 in <span id="ed-tick-val">—</span></div>
  `;
  wrap.appendChild(progressCard);

  // Sliders (day scores: circumstances, mood, productivity)
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
    input.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      valOut.textContent = val;
      record.sliders[s.id] = val;
      debouncedSave(record);
      autoFetchWeatherIfMissing();
    });
  }

  // Weather (single row, all 4 cells)
  const weatherCard = document.createElement('div');
  weatherCard.className = 'card';
  weatherCard.id = 'ed-weather-card';
  wrap.appendChild(weatherCard);
  function renderWeather() {
    const w = record.weather;
    const t = (v, suf) => v == null ? '—' : v + suf;
    weatherCard.innerHTML = `
      <h3>Weather</h3>
      <div class="weather-grid weather-grid-row">
        <div class="weather-cell"><div class="v">${t(w?.temp6am, '°')}</div><div class="l">6 AM</div></div>
        <div class="weather-cell"><div class="v">${t(w?.temp3pm, '°')}</div><div class="l">3 PM</div></div>
        <div class="weather-cell"><div class="v">${t(w?.realFeel3pm, '°')}</div><div class="l">3 PM Feel</div></div>
        <div class="weather-cell"><div class="v">${w?.precipitation == null ? '—' : (w.precipitation > 0 ? w.precipitation + '"' : 'None')}</div><div class="l">Precip</div></div>
      </div>
      <button class="weather-retry" id="ed-weather-fetch">Refresh weather</button>
      <details style="margin-top:10px;">
        <summary class="muted" style="cursor:pointer;font-size:13px;">Edit manually</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:8px;">
          <label class="muted" style="font-size:12px;">6am °F<input class="input-text" type="number" id="m-temp" value="${w?.temp6am ?? ''}"></label>
          <label class="muted" style="font-size:12px;">3pm °F<input class="input-text" type="number" id="m-temp3" value="${w?.temp3pm ?? ''}"></label>
          <label class="muted" style="font-size:12px;">3pm Feel<input class="input-text" type="number" id="m-feel" value="${w?.realFeel3pm ?? ''}"></label>
          <label class="muted" style="font-size:12px;">Precip in<input class="input-text" type="number" step="0.01" id="m-precip" value="${w?.precipitation ?? ''}"></label>
        </div>
      </details>
    `;
    weatherCard.querySelector('#ed-weather-fetch').addEventListener('click', () => fetchWeatherNow(true));
    ['m-temp', 'm-temp3', 'm-feel', 'm-precip'].forEach((id) => {
      const el = weatherCard.querySelector('#' + id);
      el.addEventListener('change', () => {
        if (!record.weather) record.weather = { temp6am: null, temp3pm: null, realFeel3pm: null, precipitation: null, fetchedAt: new Date().toISOString() };
        const t = parseFloat(weatherCard.querySelector('#m-temp').value);
        const t3 = parseFloat(weatherCard.querySelector('#m-temp3').value);
        const f = parseFloat(weatherCard.querySelector('#m-feel').value);
        const p = parseFloat(weatherCard.querySelector('#m-precip').value);
        record.weather.temp6am = isNaN(t) ? null : Math.round(t);
        record.weather.temp3pm = isNaN(t3) ? null : Math.round(t3);
        record.weather.realFeel3pm = isNaN(f) ? null : Math.round(f);
        record.weather.precipitation = isNaN(p) ? null : Math.round(p * 100) / 100;
        record.weather.fetchedAt = record.weather.fetchedAt || new Date().toISOString();
        onChange(record);
        renderWeather();
      });
    });
  }
  async function fetchWeatherNow(showMsg) {
    try {
      const loc = await getSetting('location');
      if (!loc || loc.lat == null) {
        if (showMsg) showToast('Set a location in Settings first');
        return;
      }
      const w = await fetchWeatherForDate(loc.lat, loc.lon, record.date);
      if (!w) { if (showMsg) showToast("That day is too far back to fetch — sorry."); return; }
      record.weather = w;
      onChange(record);
      renderWeather();
      if (showMsg) showToast('Weather updated');
    } catch (e) {
      if (showMsg) showToast(e.message || 'Weather fetch failed');
    }
  }
  let _weatherAutoFetched = false;
  function autoFetchWeatherIfMissing() {
    if (_weatherAutoFetched) return;
    _weatherAutoFetched = true;
    if (!record.weather || record.weather.temp6am == null) {
      fetchWeatherNow(false);
    }
  }
  renderWeather();

  // Pillars + habit sliders
  for (const p of PILLARS) {
    const qs = questionsByPillar(p.id);
    if (!qs.length) continue;
    const pillar = document.createElement('div');
    pillar.className = 'pillar ' + p.id;
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
    pillar.querySelector('.pillar-head').addEventListener('click', () => pillar.classList.toggle('collapsed'));
    const body = pillar.querySelector('[data-body]');
    for (const q of qs) {
      const qrec = record.questions[q.id] || (record.questions[q.id] = { value: 0, note: '', firstSetAt: null });
      if (qrec.value == null) qrec.value = qrec.checked ? 100 : 0;
      const isUnlocked = unlocked.has(q.id);
      const avg7 = Math.round(counts[q.id] || 0);
      const tier = avg7 >= 50 ? 'high' : avg7 >= 30 ? 'mid' : 'low';
      const row = document.createElement('div');
      row.className = 'q' + (q.anchor ? ' anchor' : '') + (qrec.value > 0 ? ' checked' : '') + (isUnlocked ? '' : ' locked');
      row.dataset.qid = q.id;
      row.innerHTML = `
        <div class="q-body">
          <div class="q-text"><span class="q-num">${q.displayNum}.</span> <span class="q-emoji">${q.emoji || ''}</span> ${escapeHtml(q.text)}${q.anchor ? ' <span class="q-star">★ Anchor</span>' : ''}${isUnlocked ? '' : ' <span class="q-lock">🔒 Locked</span>'}</div>
          <div class="q-note">${escapeHtml(q.note)}</div>
          <div class="q-slider-row">
            <input type="range" class="q-slider" min="0" max="100" step="5" value="${qrec.value}" ${isUnlocked ? '' : 'disabled'} data-q="${q.id}">
            <span class="q-val" data-val="${q.id}">${qrec.value}</span>
          </div>
          <div class="q-meta-row">
            <span class="q-streak ${tier}" title="7-day average">Avg ${avg7} / 100 last 7 days</span>
            <span class="q-points-badge" data-points="${q.id}" style="display:none;"></span>
          </div>
          <textarea class="q-noteinput${qrec.note ? ' open' : ''}" placeholder="Add a note for #${q.displayNum}…" data-note="${q.id}">${escapeHtml(qrec.note || '')}</textarea>
        </div>
        <button type="button" class="q-expand${qrec.note ? ' open' : ''}" aria-label="Toggle note">+</button>
      `;
      body.appendChild(row);

      const slider = row.querySelector('.q-slider');
      const valOut = row.querySelector('.q-val');
      slider.addEventListener('input', async () => {
        const v = parseInt(slider.value, 10);
        const wasZero = qrec.value === 0;
        const isNowZero = v === 0;
        qrec.value = v;
        valOut.textContent = v;
        if (v > 0 && !qrec.firstSetAt) qrec.firstSetAt = new Date().toISOString();
        if (v === 0) qrec.firstSetAt = null;
        row.classList.toggle('checked', v > 0);
        if (wasZero && !isNowZero) { playCheckSound(); flashCheck(row); }
        else if (!wasZero && isNowZero) { playUncheckSound(); }
        await renderPointsBadge(row, q.id);
        debouncedSave(record);
        autoFetchWeatherIfMissing();
        await refreshStreaksAndUnlocks();
      });

      const noteInput = row.querySelector('.q-noteinput');
      const expandBtn = row.querySelector('.q-expand');
      expandBtn.addEventListener('click', () => {
        noteInput.classList.toggle('open');
        expandBtn.classList.toggle('open');
        if (noteInput.classList.contains('open')) noteInput.focus();
      });
      noteInput.addEventListener('input', () => {
        qrec.note = noteInput.value;
        debouncedSave(record);
      });
      // Initial points badge
      renderPointsBadge(row, q.id);
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
  intArea.addEventListener('input', () => {
    record.intentions = intArea.value;
    debouncedSave(record);
  });

  // Last edited
  const lastEdited = document.createElement('div');
  lastEdited.className = 'last-edited';
  wrap.appendChild(lastEdited);
  function renderLastEdited() {
    if (!record.lastEditedAt) { lastEdited.textContent = 'Not yet saved'; return; }
    const d = new Date(record.lastEditedAt);
    const txt = 'Last edited: ' + d.toLocaleString();
    lastEdited.innerHTML = txt + (isLateEdit(record) ? '<span class="late-badge">Late edit</span>' : '');
  }
  renderLastEdited();

  async function renderPointsBadge(row, qid) {
    const badge = row.querySelector(`.q-points-badge[data-points="${qid}"]`);
    if (!badge) return;
    const qr = record.questions[qid];
    const v = qr ? (qr.value != null ? qr.value : (qr.checked ? 100 : 0)) : 0;
    if (v > 0) {
      const pts = await pointsForCheck(record, qid);
      badge.textContent = '+' + pts.toLocaleString();
      badge.style.display = '';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }

  async function refreshStreaksAndUnlocks() {
    const c2 = await recentCheckCounts(record.date);
    const u2 = await computeUnlockedSet(record.date, c2);
    for (const q of QUESTIONS) {
      const row = wrap.querySelector(`.q[data-qid="${q.id}"]`);
      if (!row) continue;
      const avg = Math.round(c2[q.id] || 0);
      const badge = row.querySelector('.q-streak');
      if (badge) {
        badge.textContent = `Avg ${avg} / 100 last 7 days`;
        badge.classList.remove('low', 'mid', 'high');
        badge.classList.add(avg >= 50 ? 'high' : avg >= 30 ? 'mid' : 'low');
      }
      const slider = row.querySelector('.q-slider');
      const wasUnlocked = !row.classList.contains('locked');
      const nowUnlocked = u2.has(q.id);
      if (wasUnlocked !== nowUnlocked) {
        row.classList.toggle('locked', !nowUnlocked);
        if (slider) slider.disabled = !nowUnlocked;
        const lockSpan = row.querySelector('.q-lock');
        if (nowUnlocked && lockSpan) lockSpan.remove();
        if (!nowUnlocked && !lockSpan) {
          const txt = row.querySelector('.q-text');
          if (txt) txt.insertAdjacentHTML('beforeend', ' <span class="q-lock">🔒 Locked</span>');
        }
      }
    }
  }

  async function updateProgress() {
    let answered = 0;
    for (const q of QUESTIONS) {
      const qr = record.questions[q.id];
      const v = qr ? (qr.value != null ? qr.value : (qr.checked ? 100 : 0)) : 0;
      if (v > 0) answered++;
    }
    const fill = wrap.querySelector('#ed-progress-fill');
    const label = wrap.querySelector('#ed-progress-label');
    if (fill) fill.style.width = unlockedCount ? Math.round((answered / unlockedCount) * 100) + '%' : '0%';
    if (label) label.textContent = answered + ' / ' + unlockedCount;
    for (const p of PILLARS) {
      const meta = wrap.querySelector(`[data-meta="${p.id}"]`);
      if (meta) {
        const qs = questionsByPillar(p.id);
        let done = 0;
        for (const q of qs) {
          const qr = record.questions[q.id];
          const v = qr ? (qr.value != null ? qr.value : (qr.checked ? 100 : 0)) : 0;
          if (v > 0) done++;
        }
        meta.textContent = `${done} / ${qs.length} answered`;
      }
    }
    const sc = await scoreForRecord(record);
    const scoreEl = wrap.querySelector('#ed-score');
    if (scoreEl) scoreEl.textContent = sc.score.toLocaleString();
  }

  // Live "next −1 in" countdown ticker
  function startTicker() {
    if (scoreTickTimer) clearInterval(scoreTickTimer);
    const dropEvery = secondsUntilNextPointDrop();
    let secs = dropEvery;
    const tickEl = wrap.querySelector('#ed-tick-val');
    function fmt(s) {
      const m = Math.floor(s / 60);
      const r = s % 60;
      return m > 0 ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
    }
    if (tickEl) tickEl.textContent = fmt(secs);
    scoreTickTimer = setInterval(async () => {
      secs--;
      if (secs <= 0) {
        secs = dropEvery;
        await updateProgress();
        for (const q of QUESTIONS) {
          const row = wrap.querySelector(`.q[data-qid="${q.id}"]`);
          if (row) await renderPointsBadge(row, q.id);
        }
      }
      if (tickEl) tickEl.textContent = fmt(secs);
    }, 1000);
  }
  startTicker();
  // Stop ticker if element removed
  const observer = new MutationObserver(() => {
    if (!document.body.contains(wrap)) {
      clearInterval(scoreTickTimer);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  updateProgress();
  wrap.addEventListener('record-saved', () => { renderLastEdited(); updateProgress(); });

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

  if (!record.createdAt) {
    const yest = await getYesterdayRecord();
    if (yest && yest.sliders) {
      record.sliders = { ...yest.sliders };
      delete record.sliders.oura;
    }
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

  const editor = await renderDayEditor(record, {
    onChange: async (rec) => {
      await saveDay(rec);
      editor.element.dispatchEvent(new Event('record-saved'));
    },
  });
  container.appendChild(editor.element);
}
