// Variable catalog for correlation explorer
function buildVariableCatalog() {
  const vars = [];
  // Sliders
  for (const s of SLIDERS) {
    vars.push({ id: 'slider:' + s.id, name: s.label, group: 'Sliders',
      get: (r) => r.sliders ? r.sliders[s.id] : null });
  }
  // Daily score (raw points)
  vars.push({ id: 'score:daily', name: 'Daily Score (points)', group: 'Score',
    get: (r) => {
      let total = 0;
      for (const q of QUESTIONS) {
        const qr = r.questions?.[q.id];
        if (qr?.checked) total += 100; // simplified; real scoring uses settings async
      }
      return total;
    } });
  // Pillar percentages + overall
  vars.push({ id: 'pct:overall', name: 'Overall Completion %', group: 'Completion',
    get: (r) => overallCompletion(r) });
  for (const p of PILLARS) {
    vars.push({ id: 'pct:' + p.id, name: p.name + ' Completion %', group: 'Completion',
      get: (r) => pillarCompletion(r, p.id) });
  }
  // Questions
  for (const q of QUESTIONS) {
    vars.push({
      id: 'q:' + q.id,
      name: q.id.toUpperCase() + ': ' + q.text,
      group: 'Questions',
      get: (r) => (r.questions && r.questions[q.id] && r.questions[q.id].checked) ? 100 : 0,
    });
  }
  // Weather
  vars.push({ id: 'w:temp6am', name: '6am Temperature (°F)', group: 'Weather',
    get: (r) => r.weather ? r.weather.temp6am : null });
  vars.push({ id: 'w:temp3pm', name: '3pm Temperature (°F)', group: 'Weather',
    get: (r) => r.weather ? r.weather.temp3pm : null });
  vars.push({ id: 'w:feel3pm', name: '3pm Real-Feel (°F)', group: 'Weather',
    get: (r) => r.weather ? r.weather.realFeel3pm : null });
  vars.push({ id: 'w:precip', name: 'Precipitation (inches)', group: 'Weather',
    get: (r) => r.weather ? r.weather.precipitation : null });
  return vars;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b;
    dx2 += a * a;
    dy2 += b * b;
  }
  const den = Math.sqrt(dx2 * dy2);
  if (den === 0) return null;
  return num / den;
}

function interpretR(r) {
  if (r == null) return '';
  const a = Math.abs(r);
  const dir = r >= 0 ? 'positive' : 'negative';
  let strength;
  if (a < 0.2) return 'Little to no relationship';
  if (a < 0.4) strength = 'weak';
  else if (a < 0.6) strength = 'moderate';
  else if (a < 0.8) strength = 'strong';
  else strength = 'very strong';
  return dir.charAt(0).toUpperCase() + dir.slice(1) + ' ' + strength + ' relationship';
}

// Average a set of variables for a record. Returns null if any source value is null.
function compositeForRecord(record, varObjs) {
  if (!varObjs.length) return null;
  let sum = 0, n = 0;
  for (const v of varObjs) {
    const val = v.get(record);
    if (val == null || isNaN(val)) return null;
    sum += val;
    n++;
  }
  return n ? sum / n : null;
}

function buildPairs(records, xVars, yVars, lagDays = 0) {
  const byDate = {};
  for (const r of records) byDate[r.date] = r;
  const pairs = [];
  for (const r of records) {
    let xRec = r;
    if (lagDays > 0) {
      const d = new Date(r.date + 'T00:00:00');
      d.setDate(d.getDate() - lagDays);
      const xISO = d.toISOString().slice(0, 10);
      xRec = byDate[xISO];
      if (!xRec) continue;
    }
    const x = compositeForRecord(xRec, xVars);
    const y = compositeForRecord(r, yVars);
    if (x != null && y != null) pairs.push({ x, y, date: r.date });
  }
  return pairs;
}
