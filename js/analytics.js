let _corrState = { x: [], y: [], search: '', lag: 0 };
let _charts = { score: null, trend: null, pillar: null, scatter: null };

async function renderAnalyticsView(container) {
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <div>
      <div class="view-title">Analytics</div>
      <div class="view-sub">Patterns across days</div>
    </div>
  `;
  container.appendChild(header);

  const all = await getAllDays();

  await renderTopDaysSection(container, 'Top 5 Days');

  // Top: Daily Score history
  const scoreCard = card('Daily Score — Last 30 Days');
  const scoreCanvas = document.createElement('div');
  scoreCanvas.className = 'chart-wrap';
  scoreCanvas.innerHTML = '<canvas id="ch-score"></canvas>';
  scoreCard.appendChild(scoreCanvas);
  container.appendChild(scoreCard);

  // A: Slider trend
  const trendCard = card('Slider Trends — Last 30 Days');
  const trendCanvas = document.createElement('div');
  trendCanvas.className = 'chart-wrap';
  trendCanvas.innerHTML = '<canvas id="ch-trend"></canvas>';
  trendCard.appendChild(trendCanvas);
  container.appendChild(trendCard);

  // B: Pillar trend
  const pillarCard = card('Pillar Completion — Last 14 Days');
  const pillarCanvas = document.createElement('div');
  pillarCanvas.className = 'chart-wrap';
  pillarCanvas.innerHTML = '<canvas id="ch-pillar"></canvas>';
  pillarCard.appendChild(pillarCanvas);
  container.appendChild(pillarCard);

  // C: Correlation explorer
  const corrCard = card('Correlation Explorer');
  container.appendChild(corrCard);
  renderCorrelationExplorer(corrCard, all);

  // D: Weather influence
  const wxCard = card('Weather Influence');
  container.appendChild(wxCard);
  renderWeatherInfluence(wxCard, all);

  // E: Relationships Ranking — pick one, see ranked relationships (with category filter)
  const expCard = card('Relationships Ranking');
  expCard.id = 'relationships-ranking';
  container.appendChild(expCard);
  renderCorrelationExploration(expCard, all);

  // Defer chart drawing until DOM attached
  setTimeout(async () => {
    await drawDailyScoreChart(all);
    drawScoreTrend(all);
    drawPillarTrend(all);
  }, 0);
}

async function drawDailyScoreChart(all) {
  const ctx = document.getElementById('ch-score');
  if (!ctx) return;
  if (_charts.score) _charts.score.destroy();
  const days = lastN(all, 30);
  const labels = days.map((d) => d.date.slice(5));
  const data = [];
  for (const d of days) {
    if (d.record) {
      const s = await scoreForRecord(d.record);
      data.push(s.score);
    } else data.push(0);
  }
  _charts.score = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Score',
        data,
        borderColor: '#c9a84c',
        backgroundColor: 'rgba(201,168,76,0.18)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, suggestedMax: 100 } },
    },
  });
}

function card(title) {
  const c = document.createElement('div');
  c.className = 'card';
  c.innerHTML = `<h3>${title}</h3>`;
  return c;
}

function lastN(records, n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const r = records.find((x) => x.date === iso) || null;
    out.push({ date: iso, record: r });
  }
  return out;
}

function drawScoreTrend(all) {
  const ctx = document.getElementById('ch-trend');
  if (!ctx) return;
  if (_charts.trend) _charts.trend.destroy();
  const days = lastN(all, 30);
  const labels = days.map((d) => d.date.slice(5));
  const colors = { circumstances: '#4a7ab0', mood: '#4a9a6a', productivity: '#8a5ab0' };
  const datasets = SLIDERS.map((s) => ({
    label: s.label,
    data: days.map((d) => d.record ? d.record.sliders[s.id] : null),
    borderColor: colors[s.id],
    backgroundColor: colors[s.id] + '33',
    tension: 0.25,
    spanGaps: true,
    pointRadius: 2,
  }));
  // Overall completion as gold dotted overlay
  datasets.push({
    label: 'Overall %',
    data: days.map((d) => d.record ? overallCompletion(d.record) : null),
    borderColor: '#c9a84c',
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderDash: [5, 4],
    pointRadius: 1,
    spanGaps: true,
    tension: 0.2,
  });
  _charts.trend = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100 } },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

function drawPillarTrend(all) {
  const ctx = document.getElementById('ch-pillar');
  if (!ctx) return;
  if (_charts.pillar) _charts.pillar.destroy();
  const days = lastN(all, 14);
  const labels = days.map((d) => d.date.slice(5));
  const colors = { prerequisite: '#c9a84c', spiritual: '#c05050', health: '#4a7ab0', strategy: '#8a6840', financial: '#8a5ab0', enjoyment: '#4a9a6a' };
  const datasets = PILLARS.map((p) => ({
    label: p.name,
    data: days.map((d) => d.record ? pillarCompletion(d.record, p.id) : 0),
    backgroundColor: colors[p.id],
  }));
  _charts.pillar = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100 } },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

function renderCorrelationExplorer(parent, all) {
  const catalog = buildVariableCatalog();

  const axes = document.createElement('div');
  axes.className = 'corr-axes';
  axes.innerHTML = `
    <div class="axis-card"><div class="axis-label">X axis</div><div class="axis-value" id="x-label"></div></div>
    <div class="axis-card"><div class="axis-label">Y axis</div><div class="axis-value" id="y-label"></div></div>
  `;
  parent.appendChild(axes);

  const search = document.createElement('input');
  search.className = 'var-search';
  search.placeholder = 'Search variables…';
  search.value = _corrState.search;
  parent.appendChild(search);

  const list = document.createElement('div');
  list.className = 'var-list';
  parent.appendChild(list);

  const lagWrap = document.createElement('div');
  lagWrap.className = 'lag-wrap';
  lagWrap.innerHTML = `
    <div class="lag-label">X-axis lag: <span id="lag-val">${_corrState.lag}</span> day${_corrState.lag === 1 ? '' : 's'}</div>
    <input type="range" min="0" max="30" step="1" value="${_corrState.lag}" id="lag-input" class="slider-input" style="--c:#8a6840;">
    <div class="muted" id="lag-explain" style="font-size:12px;line-height:1.5;"></div>
  `;
  parent.appendChild(lagWrap);
  function updateLagExplain() {
    const xNames = _corrState.x.map((id) => catalog.find((c) => c.id === id)?.name || id);
    const yNames = _corrState.y.map((id) => catalog.find((c) => c.id === id)?.name || id);
    const xLabel = xNames.length ? (xNames.length === 1 ? xNames[0] : `Avg of ${xNames.length} X variables`) : 'X variable';
    const yLabel = yNames.length ? (yNames.length === 1 ? yNames[0] : `Avg of ${yNames.length} Y variables`) : 'Y variable';
    const expl = lagWrap.querySelector('#lag-explain');
    if (!expl) return;
    if (_corrState.lag === 0) {
      expl.textContent = `Comparing "${xLabel}" and "${yLabel}" on the SAME day.`;
    } else {
      const d = _corrState.lag;
      const dayWord = d === 1 ? 'day' : 'days';
      expl.textContent = `Comparing "${xLabel}" from ${d} ${dayWord} BEFORE each day's "${yLabel}". Example: ${xLabel} on day D paired with ${yLabel} on day D + ${d}.`;
    }
  }
  lagWrap.querySelector('#lag-input').addEventListener('input', (e) => {
    _corrState.lag = parseInt(e.target.value, 10);
    lagWrap.querySelector('#lag-val').textContent = _corrState.lag;
    updateLagExplain();
    recompute();
  });

  const result = document.createElement('div');
  result.className = 'r-result';
  result.id = 'corr-result';
  parent.appendChild(result);

  const scatterWrap = document.createElement('div');
  scatterWrap.className = 'chart-wrap';
  scatterWrap.style.marginTop = '12px';
  scatterWrap.innerHTML = '<canvas id="ch-scatter"></canvas>';
  parent.appendChild(scatterWrap);

  function axisLabelText(axis) {
    const ids = _corrState[axis];
    if (!ids.length) return '<span class="axis-empty">Tap a variable below</span>';
    const names = ids.map((id) => catalog.find((c) => c.id === id)?.name || id);
    if (names.length === 1) return escapeHtml(names[0]);
    if (names.length <= 3) return 'Avg: ' + names.map(escapeHtml).join(', ');
    return 'Avg: ' + names.slice(0, 3).map(escapeHtml).join(', ') + '…';
  }
  function refreshAxisLabels() {
    axes.querySelector('#x-label').innerHTML = axisLabelText('x');
    axes.querySelector('#y-label').innerHTML = axisLabelText('y');
  }

  function toggleVar(id, axis) {
    const other = axis === 'x' ? 'y' : 'x';
    const otherIdx = _corrState[other].indexOf(id);
    const sameIdx = _corrState[axis].indexOf(id);
    if (sameIdx >= 0) {
      // Already on this axis — remove it
      _corrState[axis].splice(sameIdx, 1);
    } else if (otherIdx >= 0) {
      // Move from other axis
      _corrState[other].splice(otherIdx, 1);
      _corrState[axis].push(id);
      const v = catalog.find((c) => c.id === id);
      showToast(`'${v.name}' moved from ${other.toUpperCase()} to ${axis.toUpperCase()}.`);
    } else {
      _corrState[axis].push(id);
    }
    refreshAxisLabels();
    renderList();
    if (typeof updateLagExplain === 'function') updateLagExplain();
    recompute();
  }

  function renderList() {
    const q = _corrState.search.toLowerCase();
    const filtered = catalog.filter((v) => !q || v.name.toLowerCase().includes(q));
    list.innerHTML = '';
    let lastGroup = null;
    for (const v of filtered) {
      if (v.group !== lastGroup) {
        const h = document.createElement('div');
        h.className = 'section-title';
        h.style.padding = '8px 12px 0';
        h.style.margin = '0';
        h.textContent = v.group;
        list.appendChild(h);
        lastGroup = v.group;
      }
      const onX = _corrState.x.includes(v.id);
      const onY = _corrState.y.includes(v.id);
      const item = document.createElement('div');
      item.className = 'var-item';
      item.innerHTML = `
        <div style="flex:1;min-width:0;">${escapeHtml(v.name)}</div>
        <div class="var-actions">
          <button class="var-btn x ${onX ? 'on' : ''}" data-axis="x">X</button>
          <button class="var-btn y ${onY ? 'on' : ''}" data-axis="y">Y</button>
        </div>
      `;
      item.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', () => toggleVar(v.id, b.dataset.axis));
      });
      list.appendChild(item);
    }
  }

  function recompute() {
    const xVars = _corrState.x.map((id) => catalog.find((c) => c.id === id)).filter(Boolean);
    const yVars = _corrState.y.map((id) => catalog.find((c) => c.id === id)).filter(Boolean);
    if (!xVars.length || !yVars.length) {
      result.innerHTML = '<div class="r-text">Select at least one variable per axis.</div>';
      drawScatter([]);
      return;
    }
    const pairs = buildPairs(all, xVars, yVars, _corrState.lag || 0);
    if (pairs.length < 5) {
      result.innerHTML = '<div class="r-text">Keep tracking — correlations appear after 5 days of data.</div>';
      drawScatter(pairs);
      return;
    }
    const r = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y));
    if (r == null) {
      result.innerHTML = '<div class="r-text">Not enough variation to compute.</div>';
    } else {
      result.innerHTML = `
        <div class="r-value">r = ${r.toFixed(1)}</div>
        <div class="r-text">${interpretR(r)} &nbsp;·&nbsp; n=${pairs.length}</div>
      `;
    }
    drawScatter(pairs);
  }

  function drawScatter(pairs) {
    const ctx = document.getElementById('ch-scatter');
    if (!ctx) return;
    if (_charts.scatter) _charts.scatter.destroy();
    _charts.scatter = new Chart(ctx, {
      type: 'scatter',
      data: { datasets: [{
        label: 'Days',
        data: pairs.map((p) => ({ x: p.x, y: p.y })),
        backgroundColor: '#c9a84c',
        borderColor: '#8a6820',
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  }

  search.addEventListener('input', () => {
    _corrState.search = search.value;
    renderList();
  });

  refreshAxisLabels();
  renderList();
  updateLagExplain();
  setTimeout(recompute, 0);
}

let _expState = { picked: null, lag: 0, search: '', filterGroup: 'all' };

function renderCorrelationExploration(parent, all) {
  const catalog = buildVariableCatalog();

  const picked = document.createElement('div');
  picked.className = 'axis-card';
  picked.style.marginBottom = '10px';
  parent.appendChild(picked);

  const search = document.createElement('input');
  search.className = 'var-search';
  search.placeholder = 'Pick a variable to explore…';
  search.value = _expState.search;
  parent.appendChild(search);

  const list = document.createElement('div');
  list.className = 'var-list';
  list.style.maxHeight = '220px';
  parent.appendChild(list);

  const lagWrap = document.createElement('div');
  lagWrap.className = 'lag-wrap';
  lagWrap.style.marginTop = '12px';
  lagWrap.innerHTML = `
    <div class="lag-label">Day lag: <span id="exp-lag-val">${_expState.lag}</span> day${_expState.lag === 1 ? '' : 's'}</div>
    <input type="range" min="0" max="30" step="1" value="${_expState.lag}" id="exp-lag-input" class="slider-input" style="--c:#8a6840;">
    <div class="muted" style="font-size:12px;line-height:1.5;">Use lag to find lead/lag patterns: pick X, then see what other variables it predicted N days later.</div>
  `;
  parent.appendChild(lagWrap);

  // Category filter for the ranked list
  const groups = Array.from(new Set(catalog.map((c) => c.group)));
  const filterWrap = document.createElement('div');
  filterWrap.className = 'lag-wrap';
  filterWrap.style.marginTop = '10px';
  filterWrap.innerHTML = `
    <div class="lag-label">Filter ranking by category:</div>
    <select class="input-text" id="exp-filter">
      <option value="all" ${_expState.filterGroup === 'all' ? 'selected' : ''}>All categories</option>
      ${groups.map((g) => `<option value="${g}" ${_expState.filterGroup === g ? 'selected' : ''}>${g}</option>`).join('')}
    </select>
  `;
  parent.appendChild(filterWrap);
  filterWrap.querySelector('#exp-filter').addEventListener('change', (e) => {
    _expState.filterGroup = e.target.value;
    recompute();
  });

  const ranked = document.createElement('div');
  ranked.className = 'var-list';
  ranked.id = 'rr-ranked';
  ranked.style.marginTop = '12px';
  parent.appendChild(ranked);

  function updatePicked() {
    if (!_expState.picked) {
      picked.innerHTML = '<div class="axis-label">Picked variable</div><div class="axis-empty">Tap a variable below</div>';
    } else {
      const v = catalog.find((c) => c.id === _expState.picked);
      picked.innerHTML = `<div class="axis-label">Picked variable</div><div class="axis-value">${escapeHtml(v?.name || '?')}</div>`;
    }
  }
  updatePicked();

  function renderList() {
    const q = _expState.search.toLowerCase();
    const filtered = catalog.filter((v) => !q || v.name.toLowerCase().includes(q));
    list.innerHTML = '';
    let lastGroup = null;
    for (const v of filtered) {
      if (v.group !== lastGroup) {
        const h = document.createElement('div');
        h.className = 'section-title';
        h.style.padding = '8px 12px 0';
        h.style.margin = '0';
        h.textContent = v.group;
        list.appendChild(h);
        lastGroup = v.group;
      }
      const item = document.createElement('div');
      item.className = 'var-item';
      const isPicked = _expState.picked === v.id;
      item.innerHTML = `
        <div style="flex:1;min-width:0;">${escapeHtml(v.name)}</div>
        <button class="var-btn ${isPicked ? 'on' : ''}" style="${isPicked ? 'background:var(--gold);color:white;' : ''}">Pick</button>
      `;
      item.querySelector('button').addEventListener('click', () => {
        _expState.picked = isPicked ? null : v.id;
        updatePicked();
        renderList();
        recompute();
      });
      list.appendChild(item);
    }
  }
  renderList();

  function recompute() {
    if (!_expState.picked) { ranked.innerHTML = '<div class="empty-state">Pick a variable above to rank correlations.</div>'; return; }
    const pick = catalog.find((c) => c.id === _expState.picked);
    if (!pick) return;
    const lag = _expState.lag || 0;
    // Filter to last 30 days
    const today30 = new Date();
    today30.setDate(today30.getDate() - 30);
    const cutoffISO = today30.toISOString().slice(0, 10);
    const recent = all.filter((r) => r.date >= cutoffISO);
    if (recent.length < 5) {
      ranked.innerHTML = '<div class="empty-state">Need at least 5 days of recent data.</div>';
      return;
    }
    const rows = [];
    for (const other of catalog) {
      if (other.id === pick.id) continue;
      if (_expState.filterGroup && _expState.filterGroup !== 'all' && other.group !== _expState.filterGroup) continue;
      const pairs = buildPairs(recent, [pick], [other], lag);
      if (pairs.length < 5) continue;
      const r = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y));
      if (r == null) continue;
      rows.push({ name: other.name, group: other.group, r, n: pairs.length });
    }
    rows.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    if (!rows.length) { ranked.innerHTML = '<div class="empty-state">No variable pairs had enough data.</div>'; return; }
    ranked.innerHTML = rows.map((row) => {
      const pct = Math.round(row.r * 100);
      const dir = row.r >= 0 ? 'positive' : 'negative';
      const colorClass = Math.abs(row.r) >= 0.6 ? 'high' : Math.abs(row.r) >= 0.3 ? 'mid' : 'low';
      return `
        <div class="var-item">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;">${escapeHtml(row.name)}</div>
            <div class="muted" style="font-size:11px;">${row.group} · n=${row.n} · ${dir}</div>
          </div>
          <div class="q-streak ${colorClass}" style="font-variant-numeric:tabular-nums;">${pct >= 0 ? '+' : ''}${pct}%</div>
        </div>
      `;
    }).join('');
  }

  search.addEventListener('input', () => {
    _expState.search = search.value;
    renderList();
  });
  lagWrap.querySelector('#exp-lag-input').addEventListener('input', (e) => {
    _expState.lag = parseInt(e.target.value, 10);
    lagWrap.querySelector('#exp-lag-val').textContent = _expState.lag;
    recompute();
  });

  recompute();
}

function renderWeatherInfluence(parent, all) {
  if (all.length < 7) {
    parent.innerHTML += '<div class="muted">Available after 7 days of data.</div>';
    return;
  }
  const wxVars = [
    { id: 'temp6am', name: '6am Temp', get: (r) => r.weather?.temp6am },
    { id: 'temp3pm', name: '3pm Temp', get: (r) => r.weather?.temp3pm },
    { id: 'feel3pm', name: '3pm Feel', get: (r) => r.weather?.realFeel3pm },
    { id: 'precip',  name: 'Precip',   get: (r) => r.weather?.precipitation },
  ];
  const t = document.createElement('table');
  t.className = 'weather-table';
  let html = '<thead><tr><th></th>';
  for (const w of wxVars) html += `<th>${w.name}</th>`;
  html += '</tr></thead><tbody>';
  for (const s of SLIDERS) {
    html += `<tr><td>${s.label}</td>`;
    for (const w of wxVars) {
      const xs = [], ys = [];
      for (const r of all) {
        const wv = w.get(r);
        const sv = r.sliders ? r.sliders[s.id] : null;
        if (wv != null && sv != null) { xs.push(wv); ys.push(sv); }
      }
      const r = xs.length >= 5 ? pearson(xs, ys) : null;
      html += `<td>${r == null ? '—' : r.toFixed(1)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';
  t.innerHTML = html;
  parent.appendChild(t);
}
