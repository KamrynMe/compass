// Habits in canonical order. IDs stay stable so saved data persists.
// `anchor` true marks "Essentials". Customs merge in via afterId at runtime.
const ORIGINAL_QUESTIONS = [
  // PREREQUISITE
  { id: 'q8',  pillar: 'prerequisite', anchor: true,  emoji: '🛏️',
    text: 'Did you seal off, prime, and protect your sleep window?',
    note: 'Melatonin, light, wind-down.' },

  // SPIRITUAL
  { id: 'q1',  pillar: 'spiritual', anchor: true,  emoji: '📖',
    text: 'Did you do the text?',
    note: "Daily Text read, meditated on, and applied to today's outlook." },
  { id: 'q2',  pillar: 'spiritual', anchor: true,  emoji: '📚',
    text: 'Did you read and meditate on meeting preparation?',
    note: 'Watchtower (Sun), CBS (Thu), CLAM (Tue) — whichever is next.' },
  { id: 'q3',  pillar: 'spiritual', anchor: false, emoji: '🏠',
    text: 'How can you care for your necessary familial relationships?',
    note: 'One intentional act of presence today.' },
  { id: 'q4',  pillar: 'spiritual', anchor: false, emoji: '🖥️',
    text: 'What supplementary studying is available?',
    note: 'Broadcasting, videos, personal study beyond meeting prep.' },
  { id: 'q5',  pillar: 'spiritual', anchor: true,  emoji: '🧆',
    text: 'How can you make the congregation warmer?',
    note: 'One act of warmth — a text, a conversation, noticing someone.' },
  { id: 'q6',  pillar: 'spiritual', anchor: true,  emoji: '🗂️',
    text: 'How can you expand your preaching and teaching?',
    note: 'Territory, return visits, informal witness.' },
  { id: 'q7',  pillar: 'spiritual', anchor: false, emoji: '🏔️',
    text: 'How can you support Jehovah in specialized ways?',
    note: 'LDC contribution, specialized assignments, kingdom hall care.' },

  // HEALTH (now with cleanliness + hygiene as essentials)
  { id: 'q9',  pillar: 'health', anchor: true,  emoji: '🍗',
    text: 'Are you eating healthily?',
    note: 'Huel + Berries base. Fasted window honored. Gut health.' },
  { id: 'q10', pillar: 'health', anchor: false, emoji: '⛹🏽‍♂️',
    text: 'Are you getting stronger and more capable?',
    note: 'Training completed. Hot/cold exposure.' },
  { id: 'q27', pillar: 'health', anchor: true,  emoji: '🧹',
    text: 'Are you keeping up cleanliness in your environment?',
    note: 'Tidy spaces, tools put away, surfaces wiped.' },
  { id: 'q28', pillar: 'health', anchor: true,  emoji: '🪥',
    text: 'Are you taking care of your personal hygiene aims?',
    note: 'Daily care routines kept up.' },
  { id: 'q11', pillar: 'health', anchor: false, emoji: '🥬',
    text: 'Neurogenesis, Stem cells, Telomeres, Mitochondria, Inflammation, Autophagy.',
    note: 'Are longevity protocols active this week?' },

  // STRATEGY — q15 promoted to first slot, rewritten as Essential
  { id: 'q15', pillar: 'strategy', anchor: true,  emoji: '🔨',
    text: 'Has beta enabled sufficient micro-skill investments for needs?',
    note: 'Ensure Beta tasks satisfy minimum needs.' },
  { id: 'q12', pillar: 'strategy', anchor: false, emoji: '🧮',
    text: 'Organized systems to automate days and weeks — preparation for alpha flow state?',
    note: "Tomorrow's environment set. Friction removed." },
  { id: 'q13', pillar: 'strategy', anchor: false, emoji: '🧠',
    text: 'Time allocated for Gamma schedule scrutinization for improvement?',
    note: 'Weekly audit of the structure.' },
  { id: 'q14', pillar: 'strategy', anchor: false, emoji: '🧘🏾‍♂️',
    text: 'Protected space and time for Theta gratitude and visualization?',
    note: 'Quiet, unscheduled. Image, feel, gratitude.' },
  { id: 'q16', pillar: 'strategy', anchor: false, emoji: '🎵',
    text: 'Music set aside to support all modes?',
    note: 'Alpha, theta, ambient audio environment ready.' },

  // EXPANSION (formerly Financial)
  { id: 'q17', pillar: 'expansion', anchor: false, emoji: '🤹',
    text: 'Psychology hitting the mark in real life practice?',
    note: 'Where did it land this week?' },
  { id: 'q18', pillar: 'expansion', anchor: false, emoji: '🎡',
    text: 'Is what can be reliably automated, automated?',
    note: 'One system to build or refine this week.' },

  // ENJOYMENT — athleticism slotted in as Essential
  { id: 'q29', pillar: 'enjoyment', anchor: true,  emoji: '🏀',
    text: 'Have I enjoyed athleticism?',
    note: 'Stay active and capable — play, move, push.' },
  { id: 'q19', pillar: 'enjoyment', anchor: false, emoji: '🫂',
    text: 'How can I be a good friend to two people this week?',
    note: 'Name them. One specific act each.' },
  { id: 'q20', pillar: 'enjoyment', anchor: false, emoji: '🐬',
    text: 'How can I connect with what Jehovah created this week?',
    note: 'Outside. Full attention. 15 minutes minimum.' },
  { id: 'q21', pillar: 'enjoyment', anchor: false, emoji: '🃏',
    text: 'How can I strengthen my logical strategic muscle under fun, safe conditions?',
    note: 'Chess, puzzles, games.' },
  { id: 'q22', pillar: 'enjoyment', anchor: false, emoji: '🏏',
    text: 'How can I create fun situations for new people?',
    note: 'Curate a context, not a conversation.' },
  { id: 'q23', pillar: 'enjoyment', anchor: false, emoji: '🗣️',
    text: 'How can I be comfortable, myself, and spontaneous?',
    note: 'Leave one window truly open this week.' },
  { id: 'q24', pillar: 'enjoyment', anchor: false, emoji: '⛓️',
    text: 'How can I build something soon?',
    note: 'Physical, digital, or conceptual. Schedule it.' },
  { id: 'q25', pillar: 'enjoyment', anchor: false, emoji: '🪐',
    text: 'How can I learn about physics soon?',
    note: 'One concept. One video. One thought experiment.' },
  { id: 'q26', pillar: 'enjoyment', anchor: false, emoji: '🎹',
    text: 'When can I learn about music, so I can eventually make it?',
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
  // Merge custom pillars
  const customs = await loadCustomPillars();
  PILLARS.length = 0;
  for (const p of PILLARS_BUILTIN) PILLARS.push(p);
  for (const p of customs) PILLARS.push({ ...p, custom: true });

  let list = await loadUserGoals();
  list = await _migrateGoalsToCanonical(list);
  rebuildQuestionsFrom(list);
}

// Idempotent: forces ORIGINAL_QUESTIONS as the canonical source for original
// items (text/note/emoji/anchor/pillar/order), while preserving user-added
// customs at their afterId positions, plus any per-goal startDate / imageDataUrl.
async function _migrateGoalsToCanonical(savedList) {
  const saved = Array.isArray(savedList) ? savedList : [];
  const savedMap = new Map(saved.map((q) => [q.id, q]));
  // Migrate pillar rename
  for (const q of saved) if (q.pillar === 'financial') q.pillar = 'expansion';
  // Pull customs and remember their afterId so we can reinsert them.
  const customs = saved.filter((q) => q.custom || (!ORIGINAL_QUESTIONS.find((o) => o.id === q.id)));
  // Build fresh originals from ORIGINAL_QUESTIONS, preserving user data fields.
  const fresh = ORIGINAL_QUESTIONS.map((orig) => {
    const ex = savedMap.get(orig.id);
    return {
      ...orig,
      original: true,
      ...(ex && ex.startDate ? { startDate: ex.startDate } : {}),
      ...(ex && ex.imageDataUrl ? { imageDataUrl: ex.imageDataUrl } : {}),
    };
  });
  // Insert customs into the fresh order by afterId; fall back to end.
  let result = [...fresh];
  for (const c of customs) {
    if (c.pillar === 'financial') c.pillar = 'expansion';
    const idx = c.afterId ? result.findIndex((q) => q.id === c.afterId) : -1;
    if (idx >= 0) result.splice(idx + 1, 0, { ...c, custom: true });
    else result.push({ ...c, custom: true });
  }
  await saveUserGoals(result);
  return result;
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

// Custom categories. User-defined categories can be added; prerequisite stays.
async function loadCustomPillars() {
  return (await getSetting('customPillars')) || [];
}
async function saveCustomPillars(list) {
  await setSetting('customPillars', list);
}
async function getEffectivePillars() {
  const customs = await loadCustomPillars();
  return [...PILLARS_BUILTIN, ...customs];
}

// Built-ins (the original 6).
const PILLARS_BUILTIN = [
  { id: 'prerequisite', name: 'Prerequisite', symbol: '🛏️' },
  { id: 'spiritual',    name: 'Spiritual',    symbol: '✦' },
  { id: 'health',       name: 'Health',       symbol: '◈' },
  { id: 'strategy',     name: 'Strategy',     symbol: '◎' },
  { id: 'expansion',    name: 'Expansion',    symbol: '◇' },
  { id: 'enjoyment',    name: 'Enjoyment',    symbol: '◉' },
];
// PILLARS reflects built-ins + customs at runtime; populated by initQuestions().
const PILLARS = [...PILLARS_BUILTIN];

function questionsByPillar(pillarId) {
  return QUESTIONS.filter((q) => q.pillar === pillarId);
}

const SLIDERS = [
  { id: 'circumstances', label: 'Circumstances', cls: 'circumstances' },
  { id: 'mood',          label: 'Mood',          cls: 'mood' },
  { id: 'productivity',  label: 'Productivity',  cls: 'productivity' },
  { id: 'strength',      label: 'Strength',      cls: 'strength' },
];

// --- Habit unlock chain ---
// A habit is unlocked when its predecessor in QUESTIONS order has been checked
// at least 5 times in the previous 7 days (not counting today). The first habit
// is always unlocked.
// Returns { qid: { avg, daysAt50, window } } over the last 30 days (honoring startDate).
// `window` is the actual number of eligible days observed (≤30).
async function recentCheckCounts(dateISO) {
  const endDate = new Date(dateISO + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 29);
  const startISO = startDate.toISOString().slice(0, 10);
  const recent = await getDaysInRange(startISO, dateISO);
  const out = {};
  for (const q of QUESTIONS) {
    const qStart = q.startDate || '0000-01-01';
    const eligible = recent.filter((r) => r.date >= qStart);
    const denom = Math.max(1, Math.min(30, eligible.length));
    let sum = 0;
    let daysAt50 = 0;
    for (const r of eligible) {
      const qr = r.questions?.[q.id];
      if (!qr) continue;
      const v = qr.value != null ? qr.value : (qr.checked ? 100 : 0);
      sum += v;
      if (v >= 50) daysAt50++;
    }
    out[q.id] = { avg: sum / denom, daysAt50, window: eligible.length };
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
  // Essentials rate is global; factor applied to non-essentials within the pillar.
  const allEssentials = QUESTIONS.filter((q) => q.anchor);
  let essentialsValueSum = 0;
  for (const q of allEssentials) {
    const qr = record.questions?.[q.id];
    essentialsValueSum += qr ? valueOf(qr) : 0;
  }
  const essentialsRate = allEssentials.length ? (essentialsValueSum / (allEssentials.length * 100)) : 1;
  const factor = Math.min(1.25, essentialsRate * essentialsRate);
  let actual = 0;
  for (const q of habits) {
    const pts = await pointsForCheck(record, q.id);
    actual += q.anchor ? pts : Math.round(pts * factor);
  }
  return (actual / target) * 100;
}
async function overallScorePct(record) {
  const target = dailyTarget();
  if (target === 0) return 0;
  const s = await scoreForRecord(record);
  return (s.score / target) * 100;
}

// Threshold helper.
function _ok(c, qid) {
  const e = c[qid];
  if (!e) return false;
  // Backwards-compat: old schema returned a number (avg).
  if (typeof e === 'number') return e >= 50;
  return (e.daysAt50 || 0) >= 5;
}

async function computeUnlockedSet(/* dateISO, counts */) {
  // Unlock mechanic removed — every habit is always available.
  return new Set(QUESTIONS.map((q) => q.id));
}
async function _legacyComputeUnlockedSet_unused(dateISO, counts) {
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

// Total daily score with the essentials-squared factor on non-essentials.
//   essentialsRate = sum(essentials' value)/((# essentials) × 100)  (0–1)
//   factor = min(1.25, essentialsRate²)
//   total = Σ essentials_pts + factor × Σ non_essentials_pts
async function scoreForRecord(record) {
  if (!record) return { score: 0, possible: 0, checks: 0 };
  const { wake, wind } = await getWakeWind();
  let essentialsPts = 0, nonEssentialsPts = 0;
  let essentialsValueSum = 0, essentialsCount = 0;
  let checks = 0;
  for (const q of QUESTIONS) {
    const qr = record.questions?.[q.id];
    if (q.anchor) essentialsCount++;
    if (!qr) continue;
    const v = valueOf(qr);
    if (q.anchor) essentialsValueSum += v;
    if (v > 0) {
      const t = qr.firstSetAt || qr.checkedAt || qr.lastChangedAt || record.lastEditedAt;
      const pts = Math.round(v * scoreMultiplierFor(t, wake, wind, record.date));
      if (q.anchor) essentialsPts += pts; else nonEssentialsPts += pts;
      checks++;
    }
  }
  const essentialsRate = essentialsCount > 0 ? (essentialsValueSum / (essentialsCount * 100)) : 1;
  const factor = Math.min(1.25, essentialsRate * essentialsRate);
  const total = essentialsPts + Math.round(nonEssentialsPts * factor);
  return { score: total, possible: QUESTIONS.length * 500, checks, essentialsRate, factor };
}

// Seconds until the multiplier for a habit set NOW will tick down by enough to
// shave 1 point off (at value 100). Used by the live "next change in" banner.
function secondsUntilNextPointDrop() {
  const total = 14 * 3600; // wake to wind = 14h
  return Math.round(total / 400); // ≈ 126s ≈ 2m 6s
}
