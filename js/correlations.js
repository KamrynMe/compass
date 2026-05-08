// Variable catalog for correlation explorer.
// Pass `records` to also generate "(30d avg)" variants of every variable.
function buildVariableCatalog(records) {
  const vars = [];
  // Score group is FIRST per UX request — most important variable.
  vars.push({ id: 'score:daily', name: 'Daily Score (points)', group: 'Score',
    get: (r) => {
      let total = 0;
      for (const q of QUESTIONS) {
        const qr = r.questions?.[q.id];
        if (!qr) continue;
        const v = qr.value != null ? qr.value : (qr.checked ? 100 : 0);
        total += v;
      }
      return total;
    } });
  // Sliders
  for (const s of SLIDERS) {
    vars.push({ id: 'slider:' + s.id, name: s.label, group: 'Sliders',
      get: (r) => r.sliders ? r.sliders[s.id] : null });
  }
  // Pillar percentages + overall
  vars.push({ id: 'pct:overall', name: 'Overall Completion %', group: 'Completion',
    get: (r) => overallCompletion(r) });
  for (const p of PILLARS) {
    vars.push({ id: 'pct:' + p.id, name: p.name + ' Completion %', group: 'Completion',
      get: (r) => pillarCompletion(r, p.id) });
  }
  // Questions (use slider value 0-100; fall back to checked era)
  for (const q of QUESTIONS) {
    vars.push({
      id: 'q:' + q.id,
      name: '#' + (q.displayNum || '?') + ': ' + q.text,
      group: 'Questions',
      get: (r) => {
        const qr = r.questions && r.questions[q.id];
        if (!qr) return 0;
        return qr.value != null ? qr.value : (qr.checked ? 100 : 0);
      },
    });
  }
  // Days of week (binary 100/0)
  const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let i = 0; i < 7; i++) {
    vars.push({
      id: 'dow:' + i,
      name: DOW_NAMES[i],
      group: 'Day of week',
      get: (r) => {
        const d = new Date(r.date + 'T12:00:00');
        return d.getDay() === i ? 100 : 0;
      },
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

  // 30-day moving average variants — one per base variable. Skips when no
  // records were provided (catalogs that don't need avgs can call without).
  if (Array.isArray(records) && records.length) {
    const sortedAsc = records.slice().sort((a, b) => a.date.localeCompare(b.date));
    const baseVars = vars.slice();
    for (const v of baseVars) {
      vars.push({
        id: 'avg30:' + v.id,
        name: v.name + ' (30d avg)',
        group: v.group + ' (30d)',
        get: (record) => {
          // Average over the previous 30 calendar days ending at record.date
          // (regardless of how many actual records fall inside that window).
          const end = new Date(record.date + 'T00:00:00');
          const start = new Date(end);
          start.setDate(start.getDate() - 29);
          const startISO = start.toISOString().slice(0, 10);
          let sum = 0, count = 0;
          for (const r of sortedAsc) {
            if (r.date < startISO || r.date > record.date) continue;
            const val = v.get(r);
            if (val == null || isNaN(val)) continue;
            sum += val;
            count++;
          }
          return count ? sum / count : null;
        },
      });
    }
  }
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
