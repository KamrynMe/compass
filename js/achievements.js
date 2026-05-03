// Awards: monthly tier badges, monthly/lifetime point milestones, streak.
// Visual badges are inline SVGs so they render anywhere and look distinct.

const TIER_THRESHOLDS = [
  { id: 'diamond',  name: 'Diamond',  pct: 125 },
  { id: 'platinum', name: 'Platinum', pct: 100 },
  { id: 'gold',     name: 'Gold',     pct: 85  },
  { id: 'silver',   name: 'Silver',   pct: 70  },
  { id: 'bronze',   name: 'Bronze',   pct: 50  },
];

const POINT_BADGES = [
  { id: 'mo10k',   name: '10K month',     scope: 'month',    threshold: 10000 },
  { id: 'mo100k',  name: '100K month',    scope: 'month',    threshold: 100000 },
  { id: 'lt1m',    name: '1M lifetime',   scope: 'lifetime', threshold: 1000000 },
];

function _monthKey(dateISO) { return dateISO.slice(0, 7); }

// ===== BADGE SVGs =====
// Each tier and point badge gets a distinct visual identity.

function badgeSvg(id, size = 64) {
  const s = size;
  switch (id) {
    case 'bronze': return `
      <svg viewBox="0 0 64 64" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bz" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#ffd9a8"/>
            <stop offset="50%" stop-color="#c8843e"/>
            <stop offset="100%" stop-color="#5e3014"/>
          </radialGradient>
        </defs>
        <path d="M14 4 L20 18 H44 L50 4 Z" fill="#a83a32"/>
        <circle cx="32" cy="38" r="22" fill="url(#bz)" stroke="#3a1a08" stroke-width="2"/>
        <circle cx="32" cy="38" r="14" fill="none" stroke="#c8843e" stroke-width="0.5" opacity="0.6"/>
        <text x="32" y="44" text-anchor="middle" font-family="serif" font-weight="900" font-size="16" fill="#3a1a08">III</text>
      </svg>`;
    case 'silver': return `
      <svg viewBox="0 0 64 64" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sv" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="50%" stop-color="#bcbcc4"/>
            <stop offset="100%" stop-color="#5a5a64"/>
          </radialGradient>
        </defs>
        <path d="M10 4 L20 16 H44 L54 4 Z" fill="#3a4a82"/>
        <polygon points="32,12 52,26 44,52 20,52 12,26" fill="url(#sv)" stroke="#2a2a30" stroke-width="2"/>
        <polygon points="32,18 46,28 41,46 23,46 18,28" fill="none" stroke="#ffffff" stroke-width="0.4" opacity="0.5"/>
        <text x="32" y="40" text-anchor="middle" font-family="serif" font-weight="900" font-size="14" fill="#2a2a30">II</text>
      </svg>`;
    case 'gold': return `
      <svg viewBox="0 0 64 64" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="gd" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#fff6c8"/>
            <stop offset="45%" stop-color="#e8c040"/>
            <stop offset="100%" stop-color="#7a5a10"/>
          </radialGradient>
        </defs>
        <path d="M10 4 L20 16 H44 L54 4 Z" fill="#a83232"/>
        <polygon points="32,8 38,26 56,26 42,38 47,56 32,46 17,56 22,38 8,26 26,26"
                 fill="url(#gd)" stroke="#5a3e08" stroke-width="1.5"/>
      </svg>`;
    case 'platinum': return `
      <svg viewBox="0 0 64 64" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f0f4ff"/>
            <stop offset="50%" stop-color="#a8b4d6"/>
            <stop offset="100%" stop-color="#3a4868"/>
          </linearGradient>
        </defs>
        <path d="M8 4 L18 16 H46 L56 4 Z" fill="#1a2640"/>
        <polygon points="32,12 52,32 32,56 12,32" fill="url(#pt)" stroke="#1a2640" stroke-width="2"/>
        <polygon points="32,20 44,32 32,48 20,32" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.6"/>
        <circle cx="32" cy="32" r="3" fill="#ffffff" opacity="0.85"/>
      </svg>`;
    case 'diamond': return `
      <svg viewBox="0 0 64 64" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dm1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e0f6ff"/>
            <stop offset="50%" stop-color="#7ec8ff"/>
            <stop offset="100%" stop-color="#1a4a82"/>
          </linearGradient>
          <linearGradient id="dm2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#7ec8ff" stop-opacity="0.3"/>
          </linearGradient>
        </defs>
        <polygon points="14,22 32,4 50,22 32,60" fill="url(#dm1)" stroke="#0a2840" stroke-width="2"/>
        <polygon points="14,22 50,22 32,60" fill="none" stroke="#ffffff" stroke-width="0.6" opacity="0.5"/>
        <polygon points="14,22 32,4 32,22" fill="url(#dm2)"/>
        <line x1="14" y1="22" x2="50" y2="22" stroke="#ffffff" stroke-width="0.4" opacity="0.7"/>
        <line x1="22" y1="22" x2="32" y2="60" stroke="#ffffff" stroke-width="0.4" opacity="0.4"/>
        <line x1="42" y1="22" x2="32" y2="60" stroke="#ffffff" stroke-width="0.4" opacity="0.4"/>
        <circle cx="22" cy="14" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>`;
    case 'mo10k': return `
      <svg viewBox="0 0 64 64" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="26" fill="#c9a84c" stroke="#5a3e08" stroke-width="2"/>
        <circle cx="32" cy="32" r="20" fill="none" stroke="#fff6c8" stroke-width="1" stroke-dasharray="2 2"/>
        <text x="32" y="30" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="13" fill="#3a1a08">10K</text>
        <text x="32" y="44" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="8" fill="#3a1a08" letter-spacing="1">MONTH</text>
      </svg>`;
    case 'mo100k': return `
      <svg viewBox="0 0 64 64" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="r100" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#ff8a3a"/>
            <stop offset="100%" stop-color="#a83232"/>
          </radialGradient>
        </defs>
        <path d="M32 4 L40 22 L60 24 L46 38 L50 58 L32 48 L14 58 L18 38 L4 24 L24 22 Z" fill="url(#r100)" stroke="#3a0a08" stroke-width="2"/>
        <text x="32" y="34" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="11" fill="#fff6c8">100K</text>
        <text x="32" y="46" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="7" fill="#fff6c8" letter-spacing="1">MONTH</text>
      </svg>`;
    case 'lt1m': return `
      <svg viewBox="0 0 64 64" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff6c8"/>
            <stop offset="50%" stop-color="#e8c040"/>
            <stop offset="100%" stop-color="#5a3e08"/>
          </linearGradient>
        </defs>
        <rect x="22" y="48" width="20" height="6" fill="#5a3e08"/>
        <rect x="18" y="54" width="28" height="4" fill="#3a1a08"/>
        <path d="M16 10 H48 V26 C48 36 42 44 32 44 C22 44 16 36 16 26 Z" fill="url(#tr)" stroke="#3a1a08" stroke-width="1.5"/>
        <path d="M10 14 C6 14 6 22 16 22" fill="none" stroke="#3a1a08" stroke-width="2"/>
        <path d="M54 14 C58 14 58 22 48 22" fill="none" stroke="#3a1a08" stroke-width="2"/>
        <text x="32" y="32" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="11" fill="#3a1a08">1M</text>
      </svg>`;
  }
  return '';
}

function badgeBlock(id, label, won = true) {
  return `
    <div class="badge-block ${won ? 'won' : 'unclaimed'}">
      <div class="badge-svg">${badgeSvg(id)}</div>
      <div class="badge-label">${label}</div>
    </div>
  `;
}

// ===== STATS =====

async function computeAchievements() {
  const all = await getAllDays();
  const byMonth = new Map();
  let lifetimeTotal = 0;
  for (const r of all) {
    const k = _monthKey(r.date);
    if (!byMonth.has(k)) byMonth.set(k, { total: 0, count: 0, sumPct: 0, days: [] });
    const s = await scoreForRecord(r);
    const pct = (r.overallScorePct != null) ? r.overallScorePct : 0;
    const m = byMonth.get(k);
    m.total += s.score;
    m.sumPct += pct;
    m.count++;
    m.days.push(r);
    lifetimeTotal += s.score;
  }
  const monthly = [];
  for (const [k, v] of byMonth) {
    const avgPct = v.count ? v.sumPct / v.count : 0;
    const avgPts = v.count ? v.total / v.count : 0;
    let tier = null;
    for (const t of TIER_THRESHOLDS) {
      if (avgPct >= t.pct) { tier = t; break; }
    }
    const pointBadges = [];
    for (const pb of POINT_BADGES) {
      if (pb.scope === 'month' && v.total >= pb.threshold) pointBadges.push(pb);
    }
    // Strongest / weakest habit per month — by sum of values.
    const sums = new Map();
    for (const r of v.days) {
      if (!r.questions) continue;
      for (const q of QUESTIONS) {
        const qr = r.questions[q.id];
        if (!qr) continue;
        const val = qr.value != null ? qr.value : (qr.checked ? 100 : 0);
        sums.set(q.id, (sums.get(q.id) || 0) + val);
      }
    }
    let strongest = null, weakest = null;
    for (const q of QUESTIONS) {
      const total = sums.get(q.id) || 0;
      if (strongest == null || total > strongest.total) strongest = { q, total };
      if (weakest == null || total < weakest.total) weakest = { q, total };
    }
    monthly.push({ month: k, total: v.total, avgPct, avgPts, days: v.count, tier, pointBadges, strongest, weakest });
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
  const ach = await computeAchievements();
  const years = Array.from(new Set(ach.monthly.map((m) => m.month.slice(0, 4)))).sort().reverse();
  const selectedYear = window._awardsYear || (years[0] || null);

  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <div>
      <div class="view-title">Awards</div>
      <div class="view-sub">Monthly tiers and point milestones</div>
    </div>
    ${years.length ? `
      <select id="awards-year" class="input-text" style="max-width:110px;">
        ${years.map((y) => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
    ` : ''}
  `;
  container.appendChild(header);
  const yearSel = header.querySelector('#awards-year');
  if (yearSel) {
    yearSel.addEventListener('change', (e) => {
      window._awardsYear = e.target.value;
      renderAchievementsView(container);
    });
  }

  // Lifetime card
  const lifeCard = document.createElement('div');
  lifeCard.className = 'card leaderboard';
  lifeCard.innerHTML = `
    <h3>Lifetime</h3>
    <div style="font-size:32px;font-weight:800;font-variant-numeric:tabular-nums;text-align:center;">${ach.lifetimeTotal.toLocaleString()} pts</div>
    <div class="badge-grid" style="margin-top:12px;justify-content:center;">
      ${ach.lifetimeBadges.length ? ach.lifetimeBadges.map((b) => badgeBlock(b.id, b.name)).join('') : '<div class="muted" style="font-size:13px;">Earn 1,000,000 pts for the lifetime trophy.</div>'}
    </div>
  `;
  container.appendChild(lifeCard);

  // Monthly list filtered by year
  const monthsForYear = ach.monthly.filter((m) => m.month.startsWith(selectedYear || ''));
  if (!monthsForYear.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No data yet for this year.';
    container.appendChild(empty);
  }
  const today = todayISO();
  const thisMonthKey = today.slice(0, 7);
  for (const m of monthsForYear) {
    const c = document.createElement('details');
    c.className = 'card month-award';
    c.dataset.month = m.month;
    if (m.month === thisMonthKey) c.id = 'awards-this-month';
    const dt = new Date(m.month + '-01T12:00:00');
    const monthLabel = dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    c.innerHTML = `
      <summary class="month-summary">
        <div class="month-summary-left">
          <div class="month-name">${monthLabel}</div>
          <div class="muted" style="font-size:13px;">Avg ${Math.round(m.avgPct)}% · ${Math.round(m.avgPts).toLocaleString()} pts/day · ${m.days} day${m.days === 1 ? '' : 's'}</div>
        </div>
        <div class="badge-grid month-badges">
          ${m.tier ? badgeBlock(m.tier.id, m.tier.name) : ''}
          ${m.pointBadges.map((pb) => badgeBlock(pb.id, pb.name)).join('')}
        </div>
      </summary>
      <div class="month-detail">
        <div><strong>Total points:</strong> ${m.total.toLocaleString()}</div>
        ${m.strongest ? `<div><strong>Strongest habit:</strong> ${escapeHtml((m.strongest.q.emoji || '') + ' ' + m.strongest.q.text).slice(0, 70)} (${m.strongest.total.toLocaleString()} pts)</div>` : ''}
        ${m.weakest ? `<div><strong>Weakest habit:</strong> ${escapeHtml((m.weakest.q.emoji || '') + ' ' + m.weakest.q.text).slice(0, 70)} (${m.weakest.total.toLocaleString()} pts)</div>` : ''}
      </div>
    `;
    container.appendChild(c);
  }

  // Unclaimed awards section
  const unclaimedCard = document.createElement('div');
  unclaimedCard.className = 'card';
  const earnedTiers = new Set();
  const earnedMonthPts = new Set();
  for (const m of ach.monthly) {
    if (m.tier) earnedTiers.add(m.tier.id);
    for (const pb of m.pointBadges) earnedMonthPts.add(pb.id);
  }
  const earnedLifetime = new Set(ach.lifetimeBadges.map((b) => b.id));

  const unclaimedTiers = TIER_THRESHOLDS.filter((t) => !earnedTiers.has(t.id));
  const unclaimedMo = POINT_BADGES.filter((pb) => pb.scope === 'month' && !earnedMonthPts.has(pb.id));
  const unclaimedLt = POINT_BADGES.filter((pb) => pb.scope === 'lifetime' && !earnedLifetime.has(pb.id));

  unclaimedCard.innerHTML = `
    <h3>Yet to Earn</h3>
    <div class="badge-grid">
      ${unclaimedTiers.map((t) => badgeBlock(t.id, t.name + ' · ' + t.pct + '%', false)).join('')}
      ${unclaimedMo.map((pb) => badgeBlock(pb.id, pb.name, false)).join('')}
      ${unclaimedLt.map((pb) => badgeBlock(pb.id, pb.name, false)).join('')}
    </div>
    ${(!unclaimedTiers.length && !unclaimedMo.length && !unclaimedLt.length) ? '<div class="muted" style="font-size:13px;">All possible awards earned.</div>' : ''}
  `;
  container.appendChild(unclaimedCard);
}

// ===== STREAK =====
// 48-hour grace window per day (matching the calendar's "timely edit" rule):
// a day counts toward the streak if any habit was first set up to 48h after that day's end.
async function computeStreak() {
  const all = await getAllDays();
  if (!all.length) return 0;
  const today = todayISO();
  function _wokeForDay(r) {
    if (!r.questions) return false;
    const dayEnd = new Date(r.date + 'T23:59:59');
    const grace = dayEnd.getTime() + 48 * 3600 * 1000;
    const dayStart = new Date(r.date + 'T00:00:00').getTime();
    for (const q of QUESTIONS) {
      const qr = r.questions[q.id];
      if (!qr) continue;
      const v = qr.value != null ? qr.value : (qr.checked ? 100 : 0);
      if (v <= 0 || !qr.firstSetAt) continue;
      const t = new Date(qr.firstSetAt).getTime();
      if (t >= dayStart && t <= grace) return true;
    }
    return false;
  }
  let count = 0;
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
