// 26 questions, exact wording. Pillar order: Spiritual, Health, Strategy, Financial, Enjoyment.
const QUESTIONS = [
  // SPIRITUAL
  { id: 'q1',  pillar: 'spiritual', anchor: true,  text: 'Did you do the text?',
    note: "Daily Text read, meditated on, and applied to today's outlook." },
  { id: 'q2',  pillar: 'spiritual', anchor: true,  text: 'Did you read and meditate on meeting preparation?',
    note: 'Watchtower (Sun), CBS (Thu), CLAM (Tue) — whichever is next.' },
  { id: 'q3',  pillar: 'spiritual', anchor: false, text: 'How can you care for your necessary familial relationships?',
    note: 'One intentional act of presence today.' },
  { id: 'q4',  pillar: 'spiritual', anchor: false, text: 'What supplementary studying is available?',
    note: 'Broadcasting, videos, personal study beyond meeting prep.' },
  { id: 'q5',  pillar: 'spiritual', anchor: false, text: 'How can you make the congregation warmer?',
    note: 'One act of warmth — a text, a conversation, noticing someone.' },
  { id: 'q6',  pillar: 'spiritual', anchor: false, text: 'How can you expand your preaching and teaching?',
    note: 'Territory, return visits, informal witness.' },
  { id: 'q7',  pillar: 'spiritual', anchor: false, text: 'How can you support Jehovah in specialized ways?',
    note: 'LDC contribution, specialized assignments, kingdom hall care.' },

  // HEALTH
  { id: 'q8',  pillar: 'health', anchor: true,  text: 'Did you seal off, prime, and protect your sleep window?',
    note: 'Melatonin, light, wind-down.' },
  { id: 'q9',  pillar: 'health', anchor: true,  text: 'Are you eating healthily?',
    note: 'Huel + Berries base. Fasted window honored. Gut health.' },
  { id: 'q10', pillar: 'health', anchor: true,  text: 'Are you getting stronger and more capable?',
    note: 'Training completed. Hot/cold exposure.' },
  { id: 'q11', pillar: 'health', anchor: false, text: 'Neurogenesis, Stem cells, Telomeres, Mitochondria, Inflammation, Autophagy.',
    note: 'Are longevity protocols active this week?' },

  // STRATEGY
  { id: 'q12', pillar: 'strategy', anchor: true,  text: 'Organized systems to automate days and weeks — preparation for alpha flow state?',
    note: "Tomorrow's environment set. Friction removed." },
  { id: 'q13', pillar: 'strategy', anchor: false, text: 'Time allocated for Gamma schedule scrutinization for improvement?',
    note: 'Weekly audit of the structure.' },
  { id: 'q14', pillar: 'strategy', anchor: false, text: 'Protected space and time for Theta gratitude and visualization?',
    note: 'Quiet, unscheduled. Image, feel, gratitude.' },
  { id: 'q15', pillar: 'strategy', anchor: false, text: 'Does Beta have a job this week?',
    note: 'Reactive mode assigned specific slots.' },
  { id: 'q16', pillar: 'strategy', anchor: false, text: 'Music set aside to support all modes?',
    note: 'Alpha, theta, ambient audio environment ready.' },

  // FINANCIAL
  { id: 'q17', pillar: 'financial', anchor: true,  text: 'Psychology hitting the mark in real life practice?',
    note: 'Where did it land this week?' },
  { id: 'q18', pillar: 'financial', anchor: false, text: 'Is what can be reliably automated, automated?',
    note: 'One system to build or refine this week.' },

  // ENJOYMENT
  { id: 'q19', pillar: 'enjoyment', anchor: false, text: 'How can I be a good friend to two people this week?',
    note: 'Name them. One specific act each.' },
  { id: 'q20', pillar: 'enjoyment', anchor: false, text: 'How can I connect with what Jehovah created this week?',
    note: 'Outside. Full attention. 15 minutes minimum.' },
  { id: 'q21', pillar: 'enjoyment', anchor: false, text: 'How can I strengthen my logical strategic muscle under fun, safe conditions?',
    note: 'Chess, puzzles, games.' },
  { id: 'q22', pillar: 'enjoyment', anchor: false, text: 'How can I create fun situations for new people?',
    note: 'Curate a context, not a conversation.' },
  { id: 'q23', pillar: 'enjoyment', anchor: false, text: 'How can I be comfortable, myself, and spontaneous?',
    note: 'Leave one window truly open this week.' },
  { id: 'q24', pillar: 'enjoyment', anchor: false, text: 'How can I build something soon?',
    note: 'Physical, digital, or conceptual. Schedule it.' },
  { id: 'q25', pillar: 'enjoyment', anchor: false, text: 'How can I learn about physics soon?',
    note: 'One concept. One video. One thought experiment.' },
  { id: 'q26', pillar: 'enjoyment', anchor: false, text: 'When can I learn about music, so I can eventually make it?',
    note: 'Theory, ear training. Learning is the path.' },
];

const PILLARS = [
  { id: 'spiritual', name: 'Spiritual',  symbol: '✦' },
  { id: 'health',    name: 'Health',     symbol: '◈' },
  { id: 'strategy',  name: 'Strategy',   symbol: '◎' },
  { id: 'financial', name: 'Financial',  symbol: '◇' },
  { id: 'enjoyment', name: 'Enjoyment',  symbol: '◉' },
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
