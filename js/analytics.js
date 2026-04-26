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
      scales: { y: { beginAtZero: true } },
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
  const colors = { oura: '#4a7ab0', circumstances: '#c9a84c', mood: '#4a9a6a', productivity: '#8a5ab0' };
  const datasets = SLIDERS.map((s) => ({
    label: s.label,
    data: days.map((d) => d.record ? d.record.sliders[s.id] : null),
    borderColor: colors[s.id],
    backgroundColor: colors[s.id] + '33',
    tension: 0.25,
    spanGaps: true,
    pointRadius: 2,
  }));
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
  const colors = { prerequisite: '#8a6820', spiritual: '#c05050', health: '#4a7ab0', strategy: '#c9a84c', financial: '#8a5ab0', enjoyment: '#4a9a6a' };
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
    <input type="range" min="0" max="30" step="1" value="${_corrState.lag}" id="lag-input" class="slider-input" style="--c:#8a5ab0;">
    <div class="muted" style="font-size:12px;">When > 0, X is taken from N days before each Y date — useful for "did sleep N days ago predict mood today?"</div>
  `;
  parent.appendChild(lagWrap);
  lagWrap.querySelector('#lag-input').addEventListener('input', (e) => {
    _corrState.lag = parseInt(e.target.value, 10);
    lagWrap.querySelector('#lag-val').textContent = _corrState.lag;
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
        <div class="r-value">r = ${r.toFixed(2)}</div>
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
  setTimeout(recompute, 0);
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
      html += `<td>${r == null ? '—' : r.toFixed(2)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';
  t.innerHTML = html;
  parent.appendChild(t);
}
