// Original 26 questions in their habit-stack order. Always present, never removed.
// IDs stay stable (q1..q26) so saved data + correlation explorer keep working.
// Custom user goals are merged into QUESTIONS at runtime via rebuildQuestions().
const ORIGINAL_QUESTIONS = [
  // PREREQUISITE
  { id: 'q8',  pillar: 'prerequisite',  emoji: '🛏️', text: 'Did you seal off, prime, and protect your sleep window?',
    note: 'Melatonin, light, wind-down.' },

  // SPIRITUAL
  { id: 'q1',  pillar: 'spiritual',  emoji: '📖', text: 'Did you do the text?',
    note: "Daily Text read, meditated on, and applied to today's outlook." },
  { id: 'q2',  pillar: 'spiritual',  emoji: '📚', text: 'Did you read and meditate on meeting preparation?',
    note: 'Watchtower (Sun), CBS (Thu), CLAM (Tue) — whichever is next.' },
  { id: 'q3',  pillar: 'spiritual', emoji: '🏠', text: 'How can you care for your necessary familial relationships?',
    note: 'One intentional act of presence today.' },
  { id: 'q4',  pillar: 'spiritual', emoji: '🖥️', text: 'What supplementary studying is available?',
    note: 'Broadcasting, videos, personal study beyond meeting prep.' },
  { id: 'q5',  pillar: 'spiritual', emoji: '🧆', text: 'How can you make the congregation warmer?',
    note: 'One act of warmth — a text, a conversation, noticing someone.' },
  { id: 'q6',  pillar: 'spiritual',  emoji: '🗂️', text: 'How can you expand your preaching and teaching?',
    note: 'Territory, return visits, informal witness.' },
  { id: 'q7',  pillar: 'spiritual', emoji: '🏔️', text: 'How can you support Jehovah in specialized ways?',
    note: 'LDC contribution, specialized assignments, kingdom hall care.' },

  // HEALTH (sleep moved to prerequisite)
  { id: 'q9',  pillar: 'health',  emoji: '🍗', text: 'Are you eating healthily?',
    note: 'Huel + Berries base. Fasted window honored. Gut health.' },
  { id: 'q10', pillar: 'health',  emoji: '⛹🏽‍♂️', text: 'Are you getting stronger and more capable?',
    note: 'Training completed. Hot/cold exposure.' },
  { id: 'q11', pillar: 'health', emoji: '🥬', text: 'Neurogenesis, Stem cells, Telomeres, Mitochondria, Inflammation, Autophagy.',
    note: 'Are longevity protocols active this week?' },

  // STRATEGY
  { id: 'q12', pillar: 'strategy',  emoji: '🧮', text: 'Organized systems to automate days and weeks — preparation for alpha flow state?',
    note: "Tomorrow's environment set. Friction removed." },
  { id: 'q13', pillar: 'strategy', emoji: '🧠', text: 'Time allocated for Gamma schedule scrutinization for improvement?',
    note: 'Weekly audit of the structure.' },
  { id: 'q14', pillar: 'strategy', emoji: '🧘🏾‍♂️', text: 'Protected space and time for Theta gratitude and visualization?',
    note: 'Quiet, unscheduled. Image, feel, gratitude.' },
  { id: 'q15', pillar: 'strategy', emoji: '🔨', text: 'Does Beta have a job this week?',
    note: 'Reactive mode assigned specific slots.' },
  { id: 'q16', pillar: 'strategy', emoji: '🎵', text: 'Music set aside to support all modes?',
    note: 'Alpha, theta, ambient audio environment ready.' },

  // FINANCIAL
  { id: 'q17', pillar: 'financial',  emoji: '🤹', text: 'Psychology hitting the mark in real life practice?',
    note: 'Where did it land this week?' },
  { id: 'q18', pillar: 'financial', emoji: '🎡', text: 'Is what can be reliably automated, automated?',
    note: 'One system to build or refine this week.' },

  // ENJOYMENT
  { id: 'q19', pillar: 'enjoyment', emoji: '🫂', text: 'How can I be a good friend to two people this week?',
    note: 'Name them. One specific act each.' },
  { id: 'q20', pillar: 'enjoyment', emoji: '🐬', text: 'How can I connect with what Jehovah created this week?',
    note: 'Outside. Full attention. 15 minutes minimum.' },
  { id: 'q21', pillar: 'enjoyment', emoji: '🃏', text: 'How can I strengthen my logical strategic muscle under fun, safe conditions?',
    note: 'Chess, puzzles, games.' },
  { id: 'q22', pillar: 'enjoyment', emoji: '🏏', text: 'How can I create fun situations for new people?',
    note: 'Curate a context, not a conversation.' },
  { id: 'q23', pillar: 'enjoyment', emoji: '🗣️', text: 'How can I be comfortable, myself, and spontaneous?',
    note: 'Leave one window truly open this week.' },
  { id: 'q24', pillar: 'enjoyment', emoji: '⛓️', text: 'How can I build something soon?',
    note: 'Physical, digital, or conceptual. Schedule it.' },
  { id: 'q25', pillar: 'enjoyment', emoji: '🪐', text: 'How can I learn about physics soon?',
    note: 'One concept. One video. One thought experiment.' },
  { id: 'q26', pillar: 'enjoyment', emoji: '🎹', text: 'When can I learn about music, so I can eventually make it?',
    note: 'Theory, ear training. Learning is the path.' },
];

// Live, mutable list. Starts as a copy of ORIGINAL_QUESTIONS; rebuilt with customs at boot.
const QUESTIONS = ORIGINAL_QUESTIONS.map((q) => ({ ...q, original: true }));

function displayNumberFor(qid) {
  const q = QUESTIONS.find((x) => x.id === qid);
  return q?.displayNum || '?';
}

// All goals (originals + customs + edits) live in a single user list now.
async function loadUserGoals() {
  let list = await getSetting('userGoals');
  if (!Array.isArray(list) || !list.length) {
    // Migrate from older customGoals setting if present
    const customs = (await getSetting('customGoals')) || [];
    const merged = ORIGINAL_QUESTIONS.map((q) => ({ ...q, original: true }));
    const remaining = [...customs];
    let safety = remaining.length * 4 + 4;
    while (remaining.length && safety-- > 0) {
      const c = remaining.shift();
      const idx = c.afterId ? merged.findIndex((q) => q.id === c.afterId) : -1;
      if (idx >= 0) merged.splice(idx + 1, 0, { ...c, custom: true });
      else if (!c.afterId) merged.push({ ...c, custom: true });
      else remaining.push(c);
    }
    for (const c of remaining) merged.push({ ...c, custom: true });
    list = merged;
    await setSetting('userGoals', list);
  }
  return list;
}

async function saveUserGoals(list) {
  await setSetting('userGoals', list);
}

async function resetGoalsToDefault() {
  const list = ORIGINAL_QUESTIONS.map((q) => ({ ...q, original: true }));
  await setSetting('userGoals', list);
  QUESTIONS.length = 0;
  for (let i = 0; i < list.length; i++) {
    list[i].displayNum = i + 1;
    QUESTIONS.push(list[i]);
  }
}

// Backwards-compat shims for callers still using the old API.
async function loadCustomGoals() { return loadUserGoals(); }
async function saveCustomGoals(list) { return saveUserGoals(list); }

function rebuildQuestionsFrom(list) {
  QUESTIONS.length = 0;
  for (let i = 0; i < list.length; i++) {
    list[i].displayNum = i + 1;
    QUESTIONS.push(list[i]);
  }
}

async function initQuestions() {
  const list = await loadUserGoals();
  rebuildQuestionsFrom(list);
}

// Display number = 1-based index in current QUESTIONS order.
function displayNumberFor(qid) {
  const i = QUESTIONS.findIndex((q) => q.id === qid);
  return i >= 0 ? i + 1 : null;
}

// Time (ms from now) until the next 1-point tick of multiplier change.
// Multiplier formula: m = 1 + 4 * (remaining/total). One 0.01 step in m is
// (total/400) seconds of remaining time. With a 14h waking window that's
// 50,400/400 = 126 s ≈ 2 min 6 s.
function msUntilNextScoreTick(wakeStr, windStr, dateISO) {
  if (!wakeStr || !windStr) return null;
  const [wH, wM] = wakeStr.split(':').map(Number);
  const [dH, dM] = windStr.split(':').map(Number);
  const base = new Date(dateISO + 'T00:00:00');
  const wake = new Date(base); wake.setHours(wH, wM, 0, 0);
  const wind = new Date(base); wind.setHours(dH, dM, 0, 0);
  if (wind <= wake) wind.setDate(wind.getDate() + 1);
  const total = (wind - wake) / 1000; // seconds
  const stepSec = total / 400;
  const now = Date.now();
  const remaining = (wind - now) / 1000;
  if (remaining <= 0 || total <= 0) return null;
  const next = (remaining % stepSec) * 1000;
  return Math.max(500, Math.round(next));
}

// Pillar order matches the habit-stack order above.
const PILLARS = [
  { id: 'prerequisite', name: 'Prerequisite', symbol: '🛏️' },
  { id: 'spiritual',    name: 'Spiritual',    symbol: '✦' },
  { id: 'health',       name: 'Health',       symbol: '◈' },
  { id: 'strategy',     name: 'Strategy',     symbol: '◎' },
  { id: 'financial',    name: 'Financial',    symbol: '◇' },
  { id: 'enjoyment',    name: 'Enjoyment',    symbol: '◉' },
];

function questionsByPillar(pillarId) {
  return QUESTIONS.filter((q) => q.pillar === pillarId);
}

const SLIDERS = [
  { id: 'circumstances', label: 'Circumstances', cls: 'circumstances' },
  { id: 'mood',          label: 'Mood',          cls: 'mood' },
  { id: 'productivity',  label: 'Productivity',  cls: 'productivity' },
];

// --- Habit unlock chain ---
// A habit is unlocked when its predecessor in QUESTIONS order has been checked
// at least 5 times in the previous 7 days (not counting today). The first habit
// is always unlocked.
// Returns { qid: { avg, daysAt50 } } over the last 7 days (honoring startDate).
async function recentCheckCounts(dateISO) {
  const endDate = new Date(dateISO + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  const startISO = startDate.toISOString().slice(0, 10);
  const recent = await getDaysInRange(startISO, dateISO);
  const out = {};
  for (const q of QUESTIONS) {
    const qStart = q.startDate || '0000-01-01';
    const eligible = recent.filter((r) => r.date >= qStart);
    const denom = Math.max(1, Math.min(7, eligible.length));
    let sum = 0;
    let daysAt50 = 0;
    for (const r of eligible) {
      const qr = r.questions?.[q.id];
      if (!qr) continue;
      const v = qr.value != null ? qr.value : (qr.checked ? 100 : 0);
      sum += v;
      if (v >= 50) daysAt50++;
    }
    out[q.id] = { avg: sum / denom, daysAt50 };
  }
  return out;
}

// Per-pillar target factor: enjoyment = 1/2, prerequisite + spiritual = 3/4, others = 2/3 of max possible (500/habit).
function pillarTargetFactor(pillarId) {
  if (pillarId === 'enjoyment') return 0.5;
  if (pillarId === 'prerequisite') return 0.75;
  return 2 / 3;
}
function pillarTarget(pillarId) {
  const habits = QUESTIONS.filter((q) => q.pillar === pillarId);
  return habits.length * 500 * pillarTargetFactor(pillarId);
}
function dailyTarget() {
  let t = 0;
  for (const p of PILLARS) t += pillarTarget(p.id);
  return t;
}

async function pillarScorePct(record, pillarId) {
  const habits = QUESTIONS.filter((q) => q.pillar === pillarId);
  const target = pillarTarget(pillarId);
  if (target === 0) return 0;
  let actual = 0;
  for (const q of habits) actual += await pointsForCheck(record, q.id);
  return (actual / target) * 100;
}
async function overallScorePct(record) {
  const target = dailyTarget();
  if (target === 0) return 0;
  let actual = 0;
  for (const q of QUESTIONS) actual += await pointsForCheck(record, q.id);
  return (actual / target) * 100;
}

// Threshold helper.
function _ok(c, qid) {
  const e = c[qid];
  if (!e) return false;
  // Backwards-compat: old schema returned a number (avg).
  if (typeof e === 'number') return e >= 50;
  return (e.daysAt50 || 0) >= 5;
}

async function computeUnlockedSet(dateISO, counts) {
  const c = counts || (await recentCheckCounts(dateISO));
  const unlocked = new Set();
  // Group by pillar in QUESTIONS order.
  const byPillar = new Map();
  for (const q of QUESTIONS) {
    if (!byPillar.has(q.pillar)) byPillar.set(q.pillar, []);
    byPillar.get(q.pillar).push(q);
  }
  for (const [pillar, items] of byPillar) {
    if (!items.length) continue;
    // Prerequisite: ALL items always unlocked, regardless of original/custom status.
    if (pillar === 'prerequisite') {
      for (const q of items) unlocked.add(q.id);
      continue;
    }
    // For every other category: first item always unlocked. Items 2+ gate on
    // their predecessor (within this category) hitting ≥50% on 5 of last 7 days.
    unlocked.add(items[0].id);
    let prevSatisfied = _ok(c, items[0].id);
    for (let i = 1; i < items.length; i++) {
      if (prevSatisfied) {
        unlocked.add(items[i].id);
        prevSatisfied = _ok(c, items[i].id);
      } else {
        prevSatisfied = false;
      }
    }
  }
  return unlocked;
}

// --- Scoring ---
// Multiplier = 1 + 4 * (time_remaining_until_winddown / total_waking_hours)
// Range: 1.0 (at wind-down) to 5.0 (at wake-up). Outside the window: 1.0.
function scoreMultiplierFor(checkTime, wakeStr, winddownStr, dateISO) {
  if (!checkTime || !wakeStr || !winddownStr) return 1;
  const [wH, wM] = wakeStr.split(':').map(Number);
  const [dH, dM] = winddownStr.split(':').map(Number);
  const base = new Date(dateISO + 'T00:00:00');
  const wake = new Date(base); wake.setHours(wH, wM, 0, 0);
  const winddown = new Date(base); winddown.setHours(dH, dM, 0, 0);
  if (winddown <= wake) winddown.setDate(winddown.getDate() + 1);
  const total = winddown - wake;
  if (total <= 0) return 1;
  const t = new Date(checkTime).getTime();
  // No early bonus before wake — multiplier only counts AT or AFTER wake.
  if (t < wake.getTime()) return 1;
  const remaining = winddown - t;
  if (remaining <= 0) return 1; // after wind-down: no bonus
  const frac = Math.max(0, Math.min(1, remaining / total));
  return 1 + 4 * frac;
}

// Wind-down is locked at wake + 14h.
function winddownFromWake(wakeStr) {
  const [h, m] = (wakeStr || '05:00').split(':').map(Number);
  let nh = h + 14;
  if (nh >= 24) nh -= 24;
  return String(nh).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

async function getWakeWind() {
  const wake = (await getSetting('wakeTime')) || '05:00';
  return { wake, wind: winddownFromWake(wake) };
}

function valueOf(qr) {
  if (!qr) return 0;
  if (qr.value != null) return qr.value;
  return qr.checked ? 100 : 0;
}

// Points earned by a single habit slider value, scaled by multiplier.
async function pointsForCheck(record, qid) {
  const qr = record?.questions?.[qid];
  if (!qr) return 0;
  const v = valueOf(qr);
  if (v <= 0) return 0;
  const { wake, wind } = await getWakeWind();
  const t = qr.firstSetAt || qr.checkedAt || qr.lastChangedAt || record.lastEditedAt;
  return Math.round(v * scoreMultiplierFor(t, wake, wind, record.date));
}

// Total daily score = Σ ROUND(value × multiplier) per habit. Round per-habit so
// the daily total matches what the per-row badges add up to.
async function scoreForRecord(record) {
  if (!record) return { score: 0, possible: 0, checks: 0 };
  const { wake, wind } = await getWakeWind();
  let total = 0;
  let checks = 0;
  for (const q of QUESTIONS) {
    const qr = record.questions?.[q.id];
    if (!qr) continue;
    const v = valueOf(qr);
    if (v > 0) {
      const t = qr.firstSetAt || qr.checkedAt || qr.lastChangedAt || record.lastEditedAt;
      total += Math.round(v * scoreMultiplierFor(t, wake, wind, record.date));
      checks++;
    }
  }
  return { score: total, possible: QUESTIONS.length * 500, checks };
}

// Seconds until the multiplier for a habit set NOW will tick down by enough to
// shave 1 point off (at value 100). Used by the live "next change in" banner.
function secondsUntilNextPointDrop() {
  const total = 14 * 3600; // wake to wind = 14h
  return Math.round(total / 400); // ≈ 126s ≈ 2m 6s
}
