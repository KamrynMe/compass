// Achievements: monthly tier badges + monthly/lifetime point milestones.

const TIER_THRESHOLDS = [
  { id: 'diamond',  name: 'Diamond',  pct: 125, color: '#7ec8ff' },
  { id: 'platinum', name: 'Platinum', pct: 100, color: '#d4d4dc' },
  { id: 'gold',     name: 'Gold',     pct: 85,  color: '#c9a84c' },
  { id: 'silver',   name: 'Silver',   pct: 70,  color: '#a8a8a8' },
  { id: 'bronze',   name: 'Bronze',   pct: 50,  color: '#a06840' },
];

const POINT_BADGES = [
  { id: 'mo10k',   name: '10K monthly',  scope: 'month',    threshold: 10000 },
  { id: 'mo100k',  name: '100K monthly', scope: 'month',    threshold: 100000 },
  { id: 'lt1m',    name: '1M lifetime',  scope: 'lifetime', threshold: 1000000 },
];

function _monthKey(dateISO) {
  return dateISO.slice(0, 7); // YYYY-MM
}

async function computeAchievements() {
  const all = await getAllDays();
  const byMonth = new Map();
  let lifetimeTotal = 0;
  for (const r of all) {
    const k = _monthKey(r.date);
    if (!byMonth.has(k)) byMonth.set(k, { total: 0, count: 0, sumPct: 0 });
    const s = await scoreForRecord(r);
    const pct = (r.overallScorePct != null) ? r.overallScorePct : 0;
    const m = byMonth.get(k);
    m.total += s.score;
    m.sumPct += pct;
    m.count++;
    lifetimeTotal += s.score;
  }
  const monthly = [];
  for (const [k, v] of byMonth) {
    const avgPct = v.count ? v.sumPct / v.count : 0;
    let tier = null;
    for (const t of TIER_THRESHOLDS) {
      if (avgPct >= t.pct) { tier = t; break; }
    }
    const pointBadges = [];
    for (const pb of POINT_BADGES) {
      if (pb.scope === 'month' && v.total >= pb.threshold) pointBadges.push(pb);
    }
    monthly.push({ month: k, total: v.total, avgPct, days: v.count, tier, pointBadges });
  }
  monthly.sort((a, b) => b.month.localeCompare(a.month));
  const lifetimeBadges = POINT_BADGES.filter((pb) => pb.scope === 'lifetime' && lifetimeTotal >= pb.threshold);
  return { monthly, lifetimeTotal, lifetimeBadges };
}

async function badgesForMonth(monthKey) {
  const ach = await computeAchievements();
  return ach.monthly.find((m) => m.month === monthKey) || null;
}

async function renderAchievementsView(container) {
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <div>
      <div class="view-title">Awards</div>
      <div class="view-sub">Monthly tiers and point milestones</div>
    </div>
  `;
  container.appendChild(header);

  const ach = await computeAchievements();

  // Lifetime card
  const lifeCard = document.createElement('div');
  lifeCard.className = 'card leaderboard';
  lifeCard.innerHTML = `
    <h3>Lifetime</h3>
    <div style="font-size:32px;font-weight:800;font-variant-numeric:tabular-nums;text-align:center;">${ach.lifetimeTotal.toLocaleString()} pts</div>
    <div style="margin-top:10px;text-align:center;">
      ${ach.lifetimeBadges.length ? ach.lifetimeBadges.map((b) => `<span class="badge-pill" style="background:#1ec45a;color:white;">🏆 ${escapeHtml(b.name)}</span>`).join(' ') : '<span class="muted" style="font-size:13px;">Earn 1,000,000 pts for the lifetime trophy.</span>'}
    </div>
  `;
  container.appendChild(lifeCard);

  // Monthly list
  if (!ach.monthly.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No data yet — log a day to start earning awards.';
    container.appendChild(empty);
    return;
  }
  for (const m of ach.monthly) {
    const c = document.createElement('div');
    c.className = 'card month-award';
    const dt = new Date(m.month + '-01T12:00:00');
    const monthLabel = dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const tier = m.tier;
    c.innerHTML = `
      <h3>${monthLabel}</h3>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-size:18px;font-weight:700;">${m.total.toLocaleString()} pts</div>
          <div class="muted" style="font-size:13px;">Avg ${Math.round(m.avgPct)}% over ${m.days} day${m.days === 1 ? '' : 's'}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;">
          ${tier ? `<span class="badge-pill" style="background:${tier.color};color:#1a1612;">⬢ ${tier.name}</span>` : ''}
          ${m.pointBadges.map((pb) => `<span class="badge-pill" style="background:#c9a84c;color:white;">🏅 ${escapeHtml(pb.name)}</span>`).join('')}
        </div>
      </div>
    `;
    container.appendChild(c);
  }
}

// ===== STREAK =====
// Days in a row with at least one habit value > 0 set during the user's waking
// window (firstSetAt is between wake and wind on that day).
async function computeStreak() {
  const all = await getAllDays();
  if (!all.length) return 0;
  const wake = (await getSetting('wakeTime')) || '05:00';
  const wind = (await getSetting('winddownTime')) || '19:00';
  const today = todayISO();
  function _wokeForDay(r) {
    if (!r.questions) return false;
    for (const q of QUESTIONS) {
      const qr = r.questions[q.id];
      if (!qr) continue;
      const v = qr.value != null ? qr.value : (qr.checked ? 100 : 0);
      if (v <= 0 || !qr.firstSetAt) continue;
      // Must have been set during waking window
      const t = new Date(qr.firstSetAt).getTime();
      const [wH, wM] = wake.split(':').map(Number);
      const [dH, dM] = wind.split(':').map(Number);
      const base = new Date(r.date + 'T00:00:00');
      const wakeT = new Date(base); wakeT.setHours(wH, wM, 0, 0);
      const windT = new Date(base); windT.setHours(dH, dM, 0, 0);
      if (windT <= wakeT) windT.setDate(windT.getDate() + 1);
      if (t >= wakeT.getTime() && t <= windT.getTime()) return true;
    }
    return false;
  }
  let count = 0;
  // Walk backwards from today (or yesterday if today not yet active)
  const map = new Map(all.map((r) => [r.date, r]));
  let cur = new Date(today + 'T00:00:00');
  while (true) {
    const iso = cur.toISOString().slice(0, 10);
    const r = map.get(iso);
    if (!r || !_wokeForDay(r)) break;
    count++;
    cur.setDate(cur.getDate() - 1);
  }
  return count;
}

async function streakBonusPoints(streak, momentumPct) {
  const base = Math.min(500, streak * 10);
  const cap = Math.min(125, momentumPct ?? 0) / 100;
  return Math.round(base * cap);
}
