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
  const scoreToBeat = await computeScoreToBeat(record.date);
  const proj = await projectUnlockTimes();
  const momObj = await computeMomentum(record.date);
  const momentum = momObj?.pct;
  const momCol = momentumColor(momentum);
  const debugOn = !!(await getSetting('debugMomentum'));

  const momCard = document.createElement('div');
  momCard.className = 'momentum-card' + (momentum != null && momentum >= 100 ? ' glow' : '');
  let dbgHtml = '';
  if (debugOn && momObj?.debug) {
    const d = momObj.debug;
    if (d.reason) {
      dbgHtml = `<div class="mom-debug">${d.reason}</div>`;
    } else {
      const fmt = (n) => Math.round(n).toLocaleString();
      const past6Lines = (d.past6Scores || []).map((p) => `${p.date.slice(5)}: ${fmt(p.score)}`).join(' · ');
      const top2Lines = (d.top2 || []).map((p) => `${p.date.slice(5)} ${fmt(p.score)}`).join(' + ');
      dbgHtml = `
        <div class="mom-debug">
          <div>Past 6 days: ${past6Lines || '—'}</div>
          <div>Sum past 6: <strong>${fmt(d.sumPast6)}</strong> · Top 2: ${top2Lines || '—'} = ${fmt(d.top2Sum)} · Avg ${fmt(d.top2Avg)}</div>
          <div>Today: <strong>${fmt(d.todayScore)}</strong> · Yesterday: <strong>${fmt(d.yesterdayScore)}</strong> · Avg <strong>${fmt(d.tyAvg)}</strong></div>
          <div>(${fmt(d.sumPast6)} ÷ (${fmt(d.top2Sum)} × 3)) × (${fmt(d.tyAvg)} ÷ ${fmt(d.top2Avg)})</div>
          <div>= ${d.factorA.toFixed(3)} × ${d.factorB.toFixed(3)} × 100 = ${momentum}%</div>
        </div>
      `;
    }
  }
  momCard.innerHTML = `
    <div class="mom-value-wrap"><span class="mom-value" style="color:${momCol};">${momentum == null ? '—' : momentum + '<span class="mom-pct">%</span>'}</span></div>
    <div class="mom-label-wrap"><span class="mom-label">Momentum</span></div>
    <div class="mom-debug-slot"></div>
  `;
  if (dbgHtml) momCard.querySelector('.mom-debug-slot').innerHTML = dbgHtml;
  wrap.appendChild(momCard);
  fitMomentumText(momCard);

  async function refreshMomentum() {
    const m = await computeMomentum(record.date);
    const pct = m?.pct;
    const valEl = momCard.querySelector('.mom-value');
    if (valEl) {
      valEl.innerHTML = pct == null ? '—' : pct + '<span class="mom-pct">%</span>';
      valEl.style.color = momentumColor(pct);
    }
    momCard.classList.toggle('glow', pct != null && pct >= 100);
    const dbg = !!(await getSetting('debugMomentum'));
    const slot = momCard.querySelector('.mom-debug-slot');
    if (slot) {
      if (dbg && m?.debug && !m.debug.reason) {
        const d = m.debug;
        const fmt2 = (n) => Math.round(n).toLocaleString();
        const past6Lines = (d.past6Scores || []).map((p) => `${p.date.slice(5)}: ${fmt2(p.score)}`).join(' · ');
        const top2Lines = (d.top2 || []).map((p) => `${p.date.slice(5)} ${fmt2(p.score)}`).join(' + ');
        slot.innerHTML = `
          <div class="mom-debug">
            <div>Past 6 days: ${past6Lines || '—'}</div>
            <div>Sum past 6: <strong>${fmt2(d.sumPast6)}</strong> · Top 2: ${top2Lines || '—'} = ${fmt2(d.top2Sum)} · Avg ${fmt2(d.top2Avg)}</div>
            <div>Today: <strong>${fmt2(d.todayScore)}</strong> · Yesterday: <strong>${fmt2(d.yesterdayScore)}</strong> · Avg <strong>${fmt2(d.tyAvg)}</strong></div>
            <div>(${fmt2(d.sumPast6)} ÷ (${fmt2(d.top2Sum)} × 3)) × (${fmt2(d.tyAvg)} ÷ ${fmt2(d.top2Avg)})</div>
            <div>= ${d.factorA.toFixed(3)} × ${d.factorB.toFixed(3)} × 100 = ${pct}%</div>
          </div>`;
      } else {
        slot.innerHTML = '';
      }
    }
    fitMomentumText(momCard);
  }
  // Expose so slider input handler can call it
  wrap._refreshMomentum = refreshMomentum;
  progressCard.innerHTML = `
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill" id="ed-progress-fill"></div></div>
      <div class="progress-label" id="ed-progress-label">0 / ${unlockedCount}</div>
    </div>
    <div class="score-row score-row-3">
      <div><div class="score-label">to Beat</div><div class="score-value" id="ed-beat">${scoreToBeat.toLocaleString()}</div></div>
      <div><div class="score-label">Daily Score</div><div class="score-value" id="ed-score">0</div></div>
      <div><div class="score-label">Unlocked By</div><div class="score-value proj" id="proj-current">${proj.currentText}</div></div>
    </div>
    <div class="proj-row">
      <div class="proj-line"><span class="proj-label">Unlocked:</span> ${unlockedCount} / ${QUESTIONS.length}</div>
      <div class="proj-line"><span class="proj-label">Fastest possible:</span> <span id="proj-fast">${proj.fastestText}</span></div>
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
    const anyUnlocked = qs.some((q) => unlocked.has(q.id));
    const pillar = document.createElement('div');
    pillar.className = 'pillar ' + p.id + (anyUnlocked ? '' : ' collapsed');
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
    // Default-collapse pillars whose habits are all locked.
    const anyUnlockedHere = qs.some((q) => unlocked.has(q.id));
    if (!anyUnlockedHere) pillar.classList.add('collapsed');
    pillar.querySelector('.pillar-head').addEventListener('click', () => pillar.classList.toggle('collapsed'));
    const body = pillar.querySelector('[data-body]');
    for (const q of qs) {
      const qrec = record.questions[q.id] || (record.questions[q.id] = { value: 0, note: '', firstSetAt: null });
      if (qrec.value == null) qrec.value = qrec.checked ? 100 : 0;
      const isUnlocked = unlocked.has(q.id);
      const _e = counts[q.id];
      const avg7 = Math.round((_e && typeof _e === 'object') ? (_e.avg || 0) : (_e || 0));
      const days5 = (_e && typeof _e === 'object') ? (_e.daysAt50 || 0) : 0;
      const tier = days5 >= 5 ? 'high' : days5 >= 3 ? 'mid' : 'low';
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
            <span class="q-streak ${tier}" title="Days at ≥50% in last 7 days">${days5} / 7 days ≥50% &middot; avg ${avg7}</span>
            <span class="q-points-badge" data-points="${q.id}" style="display:none;"></span>
          </div>
          <textarea class="q-noteinput${qrec.note ? ' open' : ''}" placeholder="Add a note for #${q.displayNum}…" data-note="${q.id}">${escapeHtml(qrec.note || '')}</textarea>
        </div>
        <button type="button" class="q-expand${qrec.note ? ' open' : ''}" aria-label="Toggle note">+</button>
      `;
      body.appendChild(row);

      const slider = row.querySelector('.q-slider');
      const valOut = row.querySelector('.q-val');
      let preInputZero = qrec.value === 0;
      let momTimer = null;
      slider.addEventListener('input', async () => {
        const v = parseInt(slider.value, 10);
        qrec.value = v;
        valOut.textContent = v;
        if (v > 0 && !qrec.firstSetAt) qrec.firstSetAt = new Date().toISOString();
        if (v === 0) qrec.firstSetAt = null;
        row.classList.toggle('checked', v > 0);
        await renderPointsBadge(row, q.id);
        debouncedSave(record);
        autoFetchWeatherIfMissing();
        await refreshStreaksAndUnlocks();
        clearTimeout(momTimer);
        momTimer = setTimeout(async () => {
          await saveDay(record);
          if (typeof wrap._refreshMomentum === 'function') wrap._refreshMomentum();
        }, 350);
      });
      slider.addEventListener('pointerdown', () => { preInputZero = qrec.value === 0; });
      slider.addEventListener('change', async () => {
        const isNowZero = qrec.value === 0;
        if (preInputZero && !isNowZero) { playCheckSound(); flashCheck(row); }
        else if (!preInputZero && isNowZero) { playUncheckSound(); }
        else if (qrec.value > 0) { playCheckSound(); flashCheck(row); }
        preInputZero = isNowZero;
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

  // Today's Notes — text + up to 10 images
  if (!Array.isArray(record.images)) record.images = [];
  const intCard = document.createElement('div');
  intCard.className = 'card';
  intCard.innerHTML = `
    <h3>Today's Notes</h3>
    <textarea class="intentions" id="ed-intentions" placeholder="What's on your mind today…">${escapeHtml(record.intentions || '')}</textarea>
    <div class="img-strip" id="ed-img-strip"></div>
    <div class="row-buttons" style="margin-top:8px;">
      <button class="btn-secondary" id="ed-img-add">📷 Add photo (${record.images.length} / 10)</button>
      <button class="btn-secondary" id="ed-img-edit">✏️ Edit</button>
      <input type="file" id="ed-img-file" accept="image/*" multiple style="display:none;">
    </div>
  `;
  wrap.appendChild(intCard);
  const intArea = intCard.querySelector('#ed-intentions');
  intArea.addEventListener('input', () => {
    record.intentions = intArea.value;
    debouncedSave(record);
  });
  const strip = intCard.querySelector('#ed-img-strip');
  function paintImages() {
    strip.innerHTML = '';
    for (const img of record.images) {
      const t = document.createElement('div');
      t.className = 'img-thumb';
      t.innerHTML = `<img src="${img.dataUrl}" alt=""><button class="img-del" aria-label="Delete">×</button>`;
      t.querySelector('.img-del').addEventListener('click', () => {
        record.images = record.images.filter((x) => x.id !== img.id);
        intCard.querySelector('#ed-img-add').textContent = `📷 Add photo (${record.images.length} / 10)`;
        paintImages();
        debouncedSave(record);
      });
      t.querySelector('img').addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.className = 'img-overlay';
        overlay.innerHTML = `<img src="${img.dataUrl}" alt="">`;
        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
      });
      strip.appendChild(t);
    }
  }
  paintImages();
  const fileIn = intCard.querySelector('#ed-img-file');
  const editBtn = intCard.querySelector('#ed-img-edit');
  editBtn.addEventListener('click', () => {
    strip.classList.toggle('editing');
    editBtn.textContent = strip.classList.contains('editing') ? '✓ Done' : '✏️ Edit';
  });
  intCard.querySelector('#ed-img-add').addEventListener('click', () => {
    if (record.images.length >= 10) { showToast('Limit of 10 photos per day'); return; }
    fileIn.click();
  });
  fileIn.addEventListener('change', async () => {
    const remaining = 10 - record.images.length;
    if (remaining <= 0) { showToast('Limit of 10 photos per day'); fileIn.value = ''; return; }
    const files = Array.from(fileIn.files || []).slice(0, remaining);
    let added = 0;
    for (const f of files) {
      if (record.images.length >= 10) break;
      try {
        const dataUrl = await compressImage(f, 1280, 0.78);
        record.images.push({ id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), dataUrl, takenAt: new Date().toISOString() });
        added++;
      } catch (e) { showToast('Image add failed'); }
    }
    if ((fileIn.files?.length || 0) > remaining) showToast(`Only ${added} added — daily limit is 10`);
    fileIn.value = '';
    intCard.querySelector('#ed-img-add').textContent = `📷 Add photo (${record.images.length} / 10)`;
    paintImages();
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
      const e2 = c2[q.id];
      const avg = Math.round((e2 && typeof e2 === 'object') ? (e2.avg || 0) : (e2 || 0));
      const d5 = (e2 && typeof e2 === 'object') ? (e2.daysAt50 || 0) : 0;
      const badge = row.querySelector('.q-streak');
      if (badge) {
        badge.textContent = `${d5} / 7 days ≥50% · avg ${avg}`;
        badge.classList.remove('low', 'mid', 'high');
        badge.classList.add(d5 >= 5 ? 'high' : d5 >= 3 ? 'mid' : 'low');
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
    const tickRow = wrap.querySelector('#ed-tick');
    function fmt(s) {
      const m = Math.floor(s / 60);
      const r = s % 60;
      return m > 0 ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
    }
    if (tickEl) tickEl.textContent = fmt(secs);
    scoreTickTimer = setInterval(async () => {
      const awake = await isAwakeNow();
      if (!awake) {
        if (tickRow) {
          tickRow.classList.add('sleep');
          tickRow.innerHTML = '😴 Sleep window — score paused';
        }
        return;
      }
      if (tickRow && tickRow.classList.contains('sleep')) {
        tickRow.classList.remove('sleep');
        tickRow.innerHTML = `Next per-habit −1 in <span id="ed-tick-val">${fmt(secs)}</span>`;
      }
      secs--;
      if (secs <= 0) {
        secs = dropEvery;
        await updateProgress();
        for (const q of QUESTIONS) {
          const row = wrap.querySelector(`.q[data-qid="${q.id}"]`);
          if (row) await renderPointsBadge(row, q.id);
        }
      }
      const liveEl = wrap.querySelector('#ed-tick-val');
      if (liveEl) liveEl.textContent = fmt(secs);
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

async function computeMomentum(dateISO) {
  const all = await getAllDays();
  const past6 = all.filter((r) => r.date < dateISO).slice(-6);
  if (past6.length < 2) return { pct: null, debug: { reason: 'Need at least 2 prior days', past6: past6.length } };
  const past6Scores = [];
  for (const r of past6) past6Scores.push({ date: r.date, score: (await scoreForRecord(r)).score });
  const sumPast6 = past6Scores.reduce((s, x) => s + x.score, 0);
  const sortedDesc = [...past6Scores].sort((a, b) => b.score - a.score);
  const top2 = sortedDesc.slice(0, 2);
  const top2Sum = top2.reduce((s, x) => s + x.score, 0);
  const top2Avg = top2.length ? top2Sum / top2.length : 0;
  const todayRec = all.find((r) => r.date === dateISO);
  const todayScore = todayRec ? (await scoreForRecord(todayRec)).score : 0;
  const yesterdayScore = past6Scores.length ? past6Scores[past6Scores.length - 1].score : 0;
  const tyAvg = (todayScore + yesterdayScore) / 2;
  const debug = {
    past6Scores, sumPast6, top2, top2Sum, top2Avg, todayScore, yesterdayScore, tyAvg,
    factorA: top2Sum > 0 ? sumPast6 / (top2Sum * 3) : 0,
    factorB: top2Avg > 0 ? tyAvg / top2Avg : 0,
  };
  if (top2Sum === 0 || top2Avg === 0) return { pct: 0, debug };
  const momentum = (sumPast6 / (top2Sum * 3)) * (tyAvg / top2Avg);
  if (!isFinite(momentum) || momentum < 0) return { pct: 0, debug };
  return { pct: Math.floor(momentum * 100), debug };
}

function momentumColor(pct) {
  if (pct == null) return 'transparent';
  if (pct <= 0) return '#a89070';
  if (pct < 30) return _lerpHex('#a89070', '#d68030', pct / 30);
  if (pct < 60) return _lerpHex('#d68030', '#e8c040', (pct - 30) / 30);
  if (pct < 90) return _lerpHex('#e8c040', '#1ec45a', (pct - 60) / 30);
  return '#1ec45a';
}
function _lerpHex(a, b, t) {
  const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
  const r = Math.round(((ah >> 16) & 0xff) + (((bh >> 16) & 0xff) - ((ah >> 16) & 0xff)) * t);
  const g = Math.round(((ah >> 8) & 0xff) + (((bh >> 8) & 0xff) - ((ah >> 8) & 0xff)) * t);
  const c = Math.round((ah & 0xff) + ((bh & 0xff) - (ah & 0xff)) * t);
  return '#' + ((r << 16) | (g << 8) | c).toString(16).padStart(6, '0');
}

async function computeScoreToBeat(dateISO) {
  const all = await getAllDays();
  const past = all.filter((r) => r.date < dateISO);
  if (past.length < 2) return 99;
  const last2 = past.slice(-2);
  let sum = 0;
  for (const r of last2) {
    const s = await scoreForRecord(r);
    sum += s.score;
  }
  return Math.max(99, Math.ceil(sum / 2));
}

async function projectUnlockTimes() {
  const today = todayISO();
  const counts = await recentCheckCounts(today);
  const unlocked = await computeUnlockedSet(today, counts);
  const remaining = QUESTIONS.filter((q) => !unlocked.has(q.id)).length;
  const fastestDays = remaining * 4; // 4 days at value 100 → 7-day avg ≥ 50
  let currentDays = null;
  // Estimate current rate from past 30 days of unlock-counts.
  const all = await getAllDays();
  if (all.length >= 8) {
    const lookback = 30;
    const today30 = new Date(today + 'T00:00:00');
    today30.setDate(today30.getDate() - lookback);
    const lookbackISO = today30.toISOString().slice(0, 10);
    const oldCounts = await recentCheckCounts(lookbackISO);
    const oldUnlocked = await computeUnlockedSet(lookbackISO, oldCounts);
    const gained = unlocked.size - oldUnlocked.size;
    if (gained > 0) {
      const ratePerDay = gained / lookback;
      currentDays = remaining / ratePerDay;
    }
  }
  if (!currentDays || !isFinite(currentDays) || currentDays <= 0) {
    currentDays = fastestDays;
  }
  return {
    fastestText: remaining === 0 ? 'Done' : addDaysFmt(fastestDays),
    currentText: remaining === 0 ? 'Done' : addDaysFmt(Math.ceil(currentDays)),
  };
}

function addDaysFmt(days) {
  if (!days || days <= 0 || !isFinite(days)) return '—';
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysToYMD(days) {
  if (!days || days <= 0) return '0d';
  const y = Math.floor(days / 365);
  const rem1 = days - y * 365;
  const m = Math.floor(rem1 / 30);
  const d = rem1 - m * 30;
  const parts = [];
  if (y >= 1) parts.push(y + 'y');
  if (m >= 1) parts.push(m + 'mo');
  if (d >= 1 || parts.length === 0) parts.push(d + 'd');
  return parts.join(' ');
}

// Is the current local time within the user's waking window?
async function isAwakeNow() {
  const wake = (await getSetting('wakeTime')) || '05:00';
  const wind = winddownFromWake(wake);
  const [wh, wm] = wake.split(':').map(Number);
  const [dh, dm] = wind.split(':').map(Number);
  const now = new Date();
  const minsNow = now.getHours() * 60 + now.getMinutes();
  const wakeMin = wh * 60 + wm;
  let windMin = dh * 60 + dm;
  // wake → wind always 14h forward
  if (windMin <= wakeMin) windMin += 24 * 60;
  let nowAdj = minsNow;
  if (nowAdj < wakeMin) nowAdj += 24 * 60;
  return nowAdj >= wakeMin && nowAdj < windMin;
}

function fitMomentumText(card) {
  requestAnimationFrame(() => {
    const valEl = card.querySelector('.mom-value');
    const valWrap = card.querySelector('.mom-value-wrap');
    if (!valEl || !valWrap) return;
    const targetW = (valWrap.clientWidth || 1) * 0.75;
    valEl.style.fontSize = '180px';
    const ratio = targetW / Math.max(1, valEl.scrollWidth);
    valEl.style.fontSize = (180 * ratio).toFixed(1) + 'px';
  });
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
