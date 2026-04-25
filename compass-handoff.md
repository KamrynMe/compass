# Compass — Full Build Specification

## Project Overview

Compass is a Progressive Web App (PWA) for personal daily life navigation. It installs to the iPhone home screen via Safari's "Add to Home Screen" and works offline. All data is stored locally on the device using IndexedDB. No backend. No accounts. No tracking.

The user is a Jehovah's Witness tracking daily reflection questions across five pillars (Spiritual, Health, Strategy, Financial, Enjoyment), four daily score sliders, and automatically-fetched weather data. The app provides historical calendar review with full editing capability and data visualization via an analytics page.

**Deployment:** GitHub Pages (free, static hosting). App is a single-page PWA with a service worker for offline capability and a manifest for home-screen installation.

---

## Tech Stack

- **Framework:** Vanilla JavaScript (no React, no build step required — keeps it simple for GitHub Pages and future editing)
- **Styling:** Plain CSS with CSS variables
- **Storage:** IndexedDB via a thin wrapper (or localForage if simpler)
- **Charts:** Chart.js via CDN
- **Calendar:** Custom-built month grid (lightweight, matches design)
- **Weather:** Open-Meteo API (free, no API key)
- **Service Worker:** For offline caching
- **Manifest:** For home-screen install with custom icon

**Why vanilla JS:** No npm install, no build pipeline, no bundler. Works immediately on GitHub Pages. Easy to edit and extend.

---

## Typography (Readability Priority)

The user specifically requested a clearly readable font. Use:

- **Primary UI font:** `Inter` (via Google Fonts) — weights 400, 500, 600, 700
- **Body text base size:** 16px minimum (never smaller)
- **Question text:** 17px, weight 500, line-height 1.5
- **Headings:** Inter 600–700
- **No italic body text** (the HTML prototype used italic for question text — replace with regular weight for mobile readability)
- **No serif fonts anywhere** — stick to Inter throughout for maximum legibility on small screens
- **Line height:** 1.5 minimum for all body text
- **Letter spacing:** Default (no condensed text)
- **High contrast:** Body text must be at least 4.5:1 contrast against background

---

## File Structure

```
compass-app/
├── index.html
├── manifest.json
├── service-worker.js
├── README.md
├── css/
│   └── styles.css
├── js/
│   ├── app.js              # Main app entry, routing between tabs
│   ├── storage.js          # IndexedDB wrapper for daily records
│   ├── questions.js        # The 26 questions data
│   ├── today.js            # Today tab logic
│   ├── calendar.js         # Calendar tab logic
│   ├── analytics.js        # Analytics tab logic
│   ├── settings.js         # Settings tab logic
│   ├── weather.js          # Open-Meteo fetch + cache
│   └── correlations.js     # Pearson r math
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── favicon.ico
```

The icons can be simple placeholder PNGs (gold circle with "C" in the middle) — generate them in code or as SVG-to-PNG during build.

---

## App Structure — 4 Tabs

Bottom tab bar (fixed), four tabs:

```
Today | Calendar | Analytics | Settings
```

Use large, clearly labeled tabs. Each tab is a full-screen view. Single-page app — routing handled by JS hash routes (`#today`, `#calendar`, `#analytics`, `#settings`).

---

## Tab 1: Today — Daily Check-In

### A. Top: Progress Bar
Shows "X / 26 answered today" as both a bar and a number.

### B. Day Score Sliders (4 sliders)
Each slider 0–100, with a live numeric readout.

| Slider | Color |
|--------|-------|
| Oura Sleep Score | Deep blue #4a7ab0 |
| Circumstances | Gold #c9a84c |
| Mood | Green #4a9a6a |
| Productivity | Purple #8a5ab0 |

Save on change (debounced 300ms). Pre-populate today with yesterday's values on first visit of the day.

### C. Weather Card (auto-fetched, read-only)
Three values fetched via Open-Meteo once per day:
- 6am Temperature (°F)
- 3pm Real-Feel (apparent temp, °F)
- Precipitation (inches, or "None")

API: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,apparent_temperature,precipitation&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`

Use the 6am and 15:00 hourly values. Sum all 24 hourly precipitation values for the daily total.

Cache weather in the day record. If fetch fails, show "—" with a retry button.

### D. The 26 Questions
Five collapsible pillar sections. Each question has:
- A checkbox (large tap target, min 44x44px)
- Question text (17px, weight 500)
- A small italic note beneath (13px, lighter color)
- Expandable note field — tap a small "+" icon to reveal a textarea for that question

⭐ Non-negotiable questions have a gold left border and a small star badge.

When checked: question text gets strikethrough, whole row fades to 50% opacity, count updates.

### E. Today's Intentions (bottom)
Free-form textarea. Saves on blur.

### F. Last Edited Indicator (bottom of page)
Small text showing: "Last edited: [timestamp]"

---

## The 26 Questions (exact text — do not modify)

### SPIRITUAL
1. ⭐ **Did you do the text?** — Daily Text read, meditated on, and applied to today's outlook.
2. ⭐ **Did you read and meditate on meeting preparation?** — Watchtower (Sun), CBS (Thu), CLAM (Tue) — whichever is next.
3. **How can you care for your necessary familial relationships?** — One intentional act of presence today.
4. **What supplementary studying is available?** — Broadcasting, videos, personal study beyond meeting prep.
5. **How can you make the congregation warmer?** — One act of warmth — a text, a conversation, noticing someone.
6. **How can you expand your preaching and teaching?** — Territory, return visits, informal witness.
7. **How can you support Jehovah in specialized ways?** — LDC contribution, specialized assignments, kingdom hall care.

### HEALTH
8. ⭐ **Did you seal off, prime, and protect your sleep window?** — Melatonin, light, wind-down.
9. ⭐ **Are you eating healthily?** — Huel + Berries base. Fasted window honored. Gut health.
10. ⭐ **Are you getting stronger and more capable?** — Training completed. Hot/cold exposure.
11. **Neurogenesis, Stem cells, Telomeres, Mitochondria, Inflammation, Autophagy.** — Are longevity protocols active this week?

### STRATEGY
12. ⭐ **Organized systems to automate days and weeks — preparation for alpha flow state?** — Tomorrow's environment set. Friction removed.
13. **Time allocated for Gamma schedule scrutinization for improvement?** — Weekly audit of the structure.
14. **Protected space and time for Theta gratitude and visualization?** — Quiet, unscheduled. Image, feel, gratitude.
15. **Does Beta have a job this week?** — Reactive mode assigned specific slots.
16. **Music set aside to support all modes?** — Alpha, theta, ambient audio environment ready.

### FINANCIAL
17. ⭐ **Psychology hitting the mark in real life practice?** — Where did it land this week?
18. **Is what can be reliably automated, automated?** — One system to build or refine this week.

### ENJOYMENT
19. **How can I be a good friend to two people this week?** — Name them. One specific act each.
20. **How can I connect with what Jehovah created this week?** — Outside. Full attention. 15 minutes minimum.
21. **How can I strengthen my logical strategic muscle under fun, safe conditions?** — Chess, puzzles, games.
22. **How can I create fun situations for new people?** — Curate a context, not a conversation.
23. **How can I be comfortable, myself, and spontaneous?** — Leave one window truly open this week.
24. **How can I build something soon?** — Physical, digital, or conceptual. Schedule it.
25. **How can I learn about physics soon?** — One concept. One video. One thought experiment.
26. **When can I learn about music, so I can eventually make it?** — Theory, ear training. Learning is the path.

---

## Tab 2: Calendar

### Month Grid
Standard month view. Navigation arrows (‹ ›) to move between months. "Today" button to jump back.

Each day cell shows:
- Day number
- A small color dot indicating completion (grey 0-25%, amber 26-50%, gold 51-75%, green 76-100%)
- A small "●" or dot indicator if it has a late edit (see below)

### View Toggle (above grid)
Two radio buttons:
- **All Days** (default)
- **Late Edits Only** — filters grid to highlight only days that were last edited more than 48 hours after the day ended. Other days are faded/dimmed.

**Late edit definition:** A day's record's `lastEditedAt` timestamp is more than 48 hours after `{date} 23:59:59 local time`.

### Day Detail Modal
Tap any day (past, today, or future-none-yet) to open a full-screen modal. This is **fully editable**, not read-only.

The modal shows:
- The date (large header)
- "Last edited: [timestamp]" (and a "Late edit" badge if applicable)
- The 4 sliders (editable)
- The weather card (editable — user can manually adjust if the auto-fetched data was wrong, or fetch retroactively)
- All 26 questions with checkboxes and notes (editable)
- Today's Intentions textarea (editable)
- "Save" button at the bottom (though edits can also auto-save)
- "Close" button

When the modal saves, update `lastEditedAt` to the current timestamp.

**Important:** Allow editing of any past date. No restrictions on how far back. The app should never prevent edits.

---

## Tab 3: Analytics

### Section A: Score Trends (line chart)
Last 30 days of all 4 slider values. Each line a different color matching the slider. Legend with tap-to-toggle.

### Section B: Pillar Completion Trends (bar chart)
Last 14 days, grouped bars per day showing completion % per pillar (5 bars per day).

### Section C: Correlation Explorer

Two selection panels side-by-side or stacked: **X-Axis** and **Y-Axis**. Each is a searchable, scrollable multi-select list.

**Multi-select behavior:** User can select one or more variables per axis. When multiple are selected, daily values are averaged (normalized to 0-100) to create a single composite score per axis.

**Axis-switching behavior:** If a user taps a variable on one axis that is already selected on the other axis, do NOT duplicate. Instead:
1. Remove it from the original axis
2. Add it to the new axis
3. Show a brief toast/inline notice: *"'{variable name}' moved from {X/Y} to {Y/X}."*

**Axis label:** When one variable is selected, show its name. When multiple, show "Avg: A, B, C" (truncate with "..." if more than 3 names would overflow).

### Available Variables (complete list, 39 total)

**Sliders (0-100 native):**
- Oura Sleep Score
- Circumstances
- Mood
- Productivity

**Pillar completion % (0-100 computed):**
- Overall Completion %
- Spiritual Completion %
- Health Completion %
- Strategy Completion %
- Financial Completion %
- Enjoyment Completion %

**Individual questions (binary, treated as 0 or 100):**
- Q1: Did you do the text?
- Q2: Did you read and meditate on meeting preparation?
- Q3: How can you care for your necessary familial relationships?
- Q4: What supplementary studying is available?
- Q5: How can you make the congregation warmer?
- Q6: How can you expand your preaching and teaching?
- Q7: How can you support Jehovah in specialized ways?
- Q8: Did you seal off, prime, and protect your sleep window?
- Q9: Are you eating healthily?
- Q10: Are you getting stronger and more capable?
- Q11: Neurogenesis, Stem cells, Telomeres, Mitochondria, Inflammation, Autophagy
- Q12: Organized systems — alpha flow state?
- Q13: Time for Gamma scrutinization?
- Q14: Theta gratitude and visualization?
- Q15: Does Beta have a job this week?
- Q16: Music set aside for all modes?
- Q17: Psychology hitting the mark?
- Q18: What can be automated, automated?
- Q19: Be a good friend to two people?
- Q20: Connect with what Jehovah created?
- Q21: Logical strategic muscle under fun conditions?
- Q22: Fun situations for new people?
- Q23: Comfortable, yourself, spontaneous?
- Q24: Build something soon?
- Q25: Learn about physics soon?
- Q26: Learn about music soon?

**Weather (native units, charted as-is):**
- 6am Temperature (°F)
- 3pm Real-Feel (°F)
- Precipitation (inches)

### Scatter Plot + Pearson r

Below the axis selectors:
- Scatter plot of (X, Y) pairs across all available history
- Pearson correlation coefficient shown numerically
- Plain-English interpretation:
  - |r| < 0.2: "Little to no relationship"
  - 0.2–0.4: "Weak relationship"
  - 0.4–0.6: "Moderate relationship"
  - 0.6–0.8: "Strong relationship"
  - 0.8–1.0: "Very strong relationship"
  - Prefix with "positive" or "negative" based on sign
- Require minimum 5 days of data before showing a correlation; otherwise show "Keep tracking — correlations appear after 5 days of data."

### Section D: Weather Influence Table
After 7+ days, show a table with 4 rows (sliders) × 3 columns (weather variables), each cell containing the Pearson r.

---

## Tab 4: Settings

- **Location:** Use device GPS (`navigator.geolocation`) OR manually entered lat/lon/label. Used for weather fetching.
- **Daily Reminder:** Since PWAs on iOS have limited push notification support, use the browser's Notification API as a best-effort. Time picker for when to remind.
- **Data Export:** Button downloads a JSON file with all data (use `Blob` + anchor tag download).
- **Data Import:** Button uploads a JSON file, merges into storage (with confirmation dialog).
- **Data Reset:** Red button, double-confirmation, wipes all storage.
- **About:** App name, version, build date.

---

## Data Model (IndexedDB)

**Database:** `CompassDB`
**Object store:** `days` (keyPath: `date`)

```javascript
{
  date: "2026-04-24",                   // YYYY-MM-DD, primary key
  createdAt: "2026-04-24T08:00:00Z",    // first time this day was recorded
  lastEditedAt: "2026-04-24T21:30:00Z", // updated on every save
  sliders: {
    oura: 78,
    circumstances: 65,
    mood: 72,
    productivity: 80
  },
  weather: {
    temp6am: 58,
    realFeel3pm: 71,
    precipitation: 0.0,
    fetchedAt: "2026-04-24T08:00:00Z"
  },
  questions: {
    q1:  { checked: true,  note: "" },
    q2:  { checked: true,  note: "" },
    q3:  { checked: false, note: "" },
    // ... q1 through q26
  },
  intentions: "Today I want to..."
}
```

**Helpers needed:**
- `getDay(date)` → returns record or null
- `saveDay(record)` → upsert, auto-updates `lastEditedAt`
- `getAllDays()` → array sorted by date ascending
- `getDaysInRange(start, end)` → array
- `exportAll()` → JSON blob
- `importAll(blob)` → merge

**Late edit detection helper:**
```javascript
function isLateEdit(record) {
  const dayEnd = new Date(record.date + 'T23:59:59');
  const editedAt = new Date(record.lastEditedAt);
  const hoursAfter = (editedAt - dayEnd) / (1000 * 60 * 60);
  return hoursAfter > 48;
}
```

**Settings object store:** `settings` (keyPath: `key`) — stores `location`, `reminderTime`, etc.

---

## Design Language

- **Background:** `#f7f4ee` (warm parchment)
- **Surface:** `#ffffff` (cards)
- **Ink (primary text):** `#1a1612`
- **Ink secondary:** `#3a3228`
- **Ink tertiary:** `#6a6050`
- **Rule (borders):** `#ccc5b5`
- **Accent gold:** `#c9a84c`
- **Spiritual:** `#8a6820` (text), `#fdf6e8` (bg), `#c9a84c` (border)
- **Health:** `#1b3a2a` (text), `#eef7f1` (bg), `#4a9a6a` (border)
- **Strategy:** `#1b2e4a` (text), `#eef2f9` (bg), `#4a7ab0` (border)
- **Financial:** `#2e1b4a` (text), `#f4eef9` (bg), `#8a5ab0` (border)
- **Enjoyment:** `#4a1b1b` (text), `#fdf0f0` (bg), `#c05050` (border)

Dark mode is NOT required for v1. Can be added later.

All tap targets minimum 44×44px (iOS guideline). Use `touch-action: manipulation` to prevent double-tap zoom on buttons.

---

## PWA Requirements

### `manifest.json`
```json
{
  "name": "Compass",
  "short_name": "Compass",
  "description": "Daily life navigation",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f7f4ee",
  "theme_color": "#c9a84c",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker
Cache all static assets (HTML, CSS, JS, icons) on install. Use a cache-first strategy for assets, network-first for the Open-Meteo API call.

### `<head>` must include:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Compass">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="manifest" href="manifest.json">
```

---

## README.md for the Repo

Include clear steps for:
1. Local testing (how to run a simple local server: `python -m http.server 8000`)
2. How GitHub Pages is set up
3. How to install on iPhone (Safari → Share → Add to Home Screen)
4. How to update: edit files, `git add . && git commit -m "..." && git push`

---

## Build Order Priority

1. File skeleton + index.html + manifest + service worker (get PWA shell installable on iPhone first)
2. Storage layer (IndexedDB wrapper + day record CRUD)
3. Today tab: sliders + save/load
4. Today tab: 26 questions + pillars + per-question notes
5. Today tab: intentions textarea
6. Weather fetch + cache
7. Calendar tab: month grid + completion dots
8. Day detail modal (fully editable)
9. Late-edit filter toggle
10. Analytics: score trend line chart
11. Analytics: pillar completion bar chart
12. Analytics: correlation explorer (multi-select, axis-switching, scatter, r-value)
13. Analytics: weather influence table
14. Settings tab: location, export/import, reset
15. Polish + test on iPhone

---

## Critical Requirements Checklist

- [ ] Uses Inter font throughout, no italics in body text, 16px+ base
- [ ] All 26 questions present with exact wording
- [ ] 4 sliders save immediately and pre-populate from yesterday
- [ ] Weather fetches once per day, caches in day record
- [ ] Calendar allows editing ANY past date with no restriction
- [ ] Every save updates `lastEditedAt` to current timestamp
- [ ] Late-edit filter (48hr threshold) works in calendar view
- [ ] Correlation explorer supports multi-select per axis with averaging
- [ ] Axis-switching moves variables between axes instead of duplicating
- [ ] All 26 questions are selectable as correlation variables
- [ ] Works fully offline after first load
- [ ] Installs to iPhone home screen via Safari
- [ ] Data persists across app closes and iPhone reboots
- [ ] Data export/import works as JSON

---

*End of specification.*
