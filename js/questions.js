// Questions in their habit-stack order. Each question's unlock depends on the prior one.
// IDs stay stable (q1..q26) so saved data + correlation explorer keep working.
const QUESTIONS = [
  // PREREQUISITE
  { id: 'q8',  pillar: 'prerequisite', anchor: true,  emoji: '🛏️', text: 'Did you seal off, prime, and protect your sleep window?',
    note: 'Melatonin, light, wind-down.' },

  // SPIRITUAL
  { id: 'q1',  pillar: 'spiritual', anchor: true,  emoji: '📖', text: 'Did you do the text?',
    note: "Daily Text read, meditated on, and applied to today's outlook." },
  { id: 'q2',  pillar: 'spiritual', anchor: true,  emoji: '📚', text: 'Did you read and meditate on meeting preparation?',
    note: 'Watchtower (Sun), CBS (Thu), CLAM (Tue) — whichever is next.' },
  { id: 'q3',  pillar: 'spiritual', anchor: false, emoji: '🏠', text: 'How can you care for your necessary familial relationships?',
    note: 'One intentional act of presence today.' },
  { id: 'q4',  pillar: 'spiritual', anchor: false, emoji: '🖥️', text: 'What supplementary studying is available?',
    note: 'Broadcasting, videos, personal study beyond meeting prep.' },
  { id: 'q5',  pillar: 'spiritual', anchor: false, emoji: '🧆', text: 'How can you make the congregation warmer?',
    note: 'One act of warmth — a text, a conversation, noticing someone.' },
  { id: 'q6',  pillar: 'spiritual', anchor: false, emoji: '🗂️', text: 'How can you expand your preaching and teaching?',
    note: 'Territory, return visits, informal witness.' },
  { id: 'q7',  pillar: 'spiritual', anchor: false, emoji: '🏔️', text: 'How can you support Jehovah in specialized ways?',
    note: 'LDC contribution, specialized assignments, kingdom hall care.' },

  // HEALTH (sleep moved to prerequisite)
  { id: 'q9',  pillar: 'health', anchor: true,  emoji: '🍗', text: 'Are you eating healthily?',
    note: 'Huel + Berries base. Fasted window honored. Gut health.' },
  { id: 'q10', pillar: 'health', anchor: true,  emoji: '⛹🏽‍♂️', text: 'Are you getting stronger and more capable?',
    note: 'Training completed. Hot/cold exposure.' },
  { id: 'q11', pillar: 'health', anchor: false, emoji: '🥬', text: 'Neurogenesis, Stem cells, Telomeres, Mitochondria, Inflammation, Autophagy.',
    note: 'Are longevity protocols active this week?' },

  // STRATEGY
  { id: 'q12', pillar: 'strategy', anchor: true,  emoji: '🧮', text: 'Organized systems to automate days and weeks — preparation for alpha flow state?',
    note: "Tomorrow's environment set. Friction removed." },
  { id: 'q13', pillar: 'strategy', anchor: false, emoji: '🧠', text: 'Time allocated for Gamma schedule scrutinization for improvement?',
    note: 'Weekly audit of the structure.' },
  { id: 'q14', pillar: 'strategy', anchor: false, emoji: '🧘🏾‍♂️', text: 'Protected space and time for Theta gratitude and visualization?',
    note: 'Quiet, unscheduled. Image, feel, gratitude.' },
  { id: 'q15', pillar: 'strategy', anchor: false, emoji: '🔨', text: 'Does Beta have a job this week?',
    note: 'Reactive mode assigned specific slots.' },
  { id: 'q16', pillar: 'strategy', anchor: false, emoji: '🎵', text: 'Music set aside to support all modes?',
    note: 'Alpha, theta, ambient audio environment ready.' },

  // FINANCIAL
  { id: 'q17', pillar: 'financial', anchor: true,  emoji: '🤹', text: 'Psychology hitting the mark in real life practice?',
    note: 'Where did it land this week?' },
  { id: 'q18', pillar: 'financial', anchor: false, emoji: '🎡', text: 'Is what can be reliably automated, automated?',
    note: 'One system to build or refine this week.' },

  // ENJOYMENT
  { id: 'q19', pillar: 'enjoyment', anchor: false, emoji: '🫂', text: 'How can I be a good friend to two people this week?',
    note: 'Name them. One specific act each.' },
  { id: 'q20', pillar: 'enjoyment', anchor: false, emoji: '🐬', text: 'How can I connect with what Jehovah created this week?',
    note: 'Outside. Full attention. 15 minutes minimum.' },
  { id: 'q21', pillar: 'enjoyment', anchor: false, emoji: '🃏', text: 'How can I strengthen my logical strategic muscle under fun, safe conditions?',
    note: 'Chess, puzzles, games.' },
  { id: 'q22', pillar: 'enjoyment', anchor: false, emoji: '🏏', text: 'How can I create fun situations for new people?',
    note: 'Curate a context, not a conversation.' },
  { id: 'q23', pillar: 'enjoyment', anchor: false, emoji: '🗣️', text: 'How can I be comfortable, myself, and spontaneous?',
    note: 'Leave one window truly open this week.' },
  { id: 'q24', pillar: 'enjoyment', anchor: false, emoji: '⛓️', text: 'How can I build something soon?',
    note: 'Physical, digital, or conceptual. Schedule it.' },
  { id: 'q25', pillar: 'enjoyment', anchor: false, emoji: '🪐', text: 'How can I learn about physics soon?',
    note: 'One concept. One video. One thought experiment.' },
  { id: 'q26', pillar: 'enjoyment', anchor: false, emoji: '🎹', text: 'When can I learn about music, so I can eventually make it?',
    note: 'Theory, ear training. Learning is the path.' },
];

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
  { id: 'oura',          label: 'Oura Sleep Score', cls: 'oura' },
  { id: 'circumstances', label: 'Circumstances',    cls: 'circumstances' },
  { id: 'mood',          label: 'Mood',             cls: 'mood' },
  { id: 'productivity',  label: 'Productivity',     cls: 'productivity' },
];

// --- Habit unlock chain ---
// A habit is unlocked when its predecessor in QUESTIONS order has been checked
// at least 5 times in the previous 7 days (not counting today). The first habit
// is always unlocked.
async function computeUnlockedSet(dateISO) {
  const unlocked = new Set();
  unlocked.add(QUESTIONS[0].id);
  // Build last-7-days lookup ending the day before `dateISO`
  const endDate = new Date(dateISO + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  const startISO = startDate.toISOString().slice(0, 10);
  const prevISO = new Date(endDate.getTime() - 86400000).toISOString().slice(0, 10);
  const recent = await getDaysInRange(startISO, prevISO);
  const checkCount = (qid) => recent.filter((r) => r.questions?.[qid]?.checked).length;

  for (let i = 1; i < QUESTIONS.length; i++) {
    const prev = QUESTIONS[i - 1];
    if (checkCount(prev.id) >= 5) {
      unlocked.add(QUESTIONS[i].id);
    } else {
      break; // stack stops here
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
  if (winddown <= wake) winddown.setDate(winddown.getDate() + 1); // overnight wind-down
  const total = winddown - wake;
  if (total <= 0) return 1;
  const t = new Date(checkTime).getTime();
  const remaining = winddown - t;
  if (remaining <= 0) return 1;
  if (t < wake.getTime()) return 5; // checked before wake — give max
  const frac = Math.max(0, Math.min(1, remaining / total));
  return 1 + 4 * frac;
}

// Score for one record. Each checked habit contributes 100 * multiplier.
async function scoreForRecord(record) {
  if (!record) return { score: 0, possible: 0, checks: 0 };
  const wake = (await getSetting('wakeTime')) || '05:00';
  const wind = (await getSetting('winddownTime')) || '19:00';
  let total = 0;
  let checks = 0;
  for (const q of QUESTIONS) {
    const qr = record.questions?.[q.id];
    if (qr && qr.checked) {
      const mult = scoreMultiplierFor(qr.checkedAt || record.lastEditedAt, wake, wind, record.date);
      total += 100 * mult;
      checks++;
    }
  }
  return { score: Math.round(total), possible: QUESTIONS.length * 500, checks };
}
