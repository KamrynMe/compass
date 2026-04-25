---
name: pwa-pages-builder
description: Use this skill whenever Cameron asks to "build an app", "make a tracker", "make me a tool to…", or otherwise wants a usable personal web tool. It builds a self-contained Progressive Web App (vanilla HTML/CSS/JS, no build step) with IndexedDB persistence, ships it to a fresh GitHub repo under his account, and enables GitHub Pages so it installs to his iPhone via Safari → Add to Home Screen. Works offline, stores data only on-device, deploys with `git push`.
---

# Cameron's PWA Builder Skill

## When this triggers

Any request that's shaped like "I want an app for X" or "Build me a tool that tracks Y" — anything Cameron wants on his phone. He prefers full ownership of the source, no third-party accounts, no subscriptions. He installs everything as a PWA via iPhone Safari.

If Cameron says **"keep it simple"** or **"just for me"**, default to this skill. If he says **"I want to ship this to other people"** or **"I need a backend"**, ask first — this skill is for personal tools.

## Cameron's stack — non-negotiable defaults

- **Vanilla HTML / CSS / JS.** No React, no bundler, no npm install, no build step. Files run as-is.
- **IndexedDB** for storage. Single `db` per app, object stores for the few entities he needs. Wrap in a thin promise helper — don't pull in libraries.
- **Service Worker** with cache-first for static assets, network-first for any external API calls.
- **Manifest + apple-touch-icon + apple-mobile-web-app-capable** so it installs cleanly on iOS Safari.
- **Inter font** from Google Fonts. **No italics in body text.** Minimum 16 px base, 17 px for primary content. Cameron explicitly cares about readability — never go smaller.
- **Bottom tab bar** (4–5 tabs max), each tab a full-screen view. Hash-routed (`#today`, `#settings`, etc.) so the SW can cache a single `index.html`.
- **44 × 44 px minimum tap targets.** `touch-action: manipulation` on buttons.
- **Chart.js via CDN** when charts are needed. Anything else, write it from scratch.
- **GitHub Pages** for hosting. Free tier supports unlimited project sites; one repo per app under his account.

## The build pipeline — step by step

1. **Get the spec straight first.** Ask one round of clarifying questions if the request is vague. Don't ask about implementation — ask about the *user-visible* model (what does a "day record" contain? what should the home screen feel like? which data points matter?). Confirm the data shape before writing storage code.

2. **Create the file skeleton in this exact order** (so the PWA is installable from the very first commit even before features land):
   ```
   <app-name>/
   ├── index.html
   ├── manifest.json
   ├── service-worker.js
   ├── README.md
   ├── css/styles.css
   ├── js/app.js          # router across hash routes
   ├── js/storage.js      # IndexedDB wrapper
   ├── js/<feature>.js    # one per tab
   └── icons/icon-192.png, icon-512.png
   ```
   Generate the icons with a Python one-liner using `struct` + `zlib` (no PIL dependency) — a flat color circle with the app's first letter is fine.

3. **Write the layers in this order** so each commit leaves a working app:
   1. PWA shell (index.html + manifest + SW + icons) — installable, blank.
   2. Storage layer (open DB, CRUD helpers, `lastEditedAt` field on every record).
   3. Primary "Today" view — the daily input.
   4. Secondary views (Calendar / Analytics / Settings).
   5. Feedback polish (sounds via Web Audio, animations via CSS keyframes).
   6. Background work (notifications, beats, etc.).

4. **Always include in storage.js:**
   - `lastEditedAt` ISO timestamp on every record, updated on every save.
   - `exportAll()` → JSON blob and `importAll(blob)` for backup/restore.
   - `wipeAll()` for the Settings reset button.
   - Forward-compatible reads: when loading an old record, fill in any missing fields silently and persist.

5. **Always include in Settings:**
   - **Export JSON** — Blob + anchor tag download.
   - **Import JSON** — file input, confirm dialog, merge.
   - **Reset all data** — red button, two-step confirm.
   - About line with version and build date.

6. **Service worker discipline:**
   - Bump the `CACHE` version constant (e.g. `compass-v3` → `compass-v4`) on **every** push. Cameron's iPhone caches aggressively; without a bump, he won't see updates.
   - List every static asset in `ASSETS`. Forgetting a file means it works locally but breaks offline.

7. **Ship to GitHub:**
   - `git init -b main`, configure user.name = "Cameron Thomas", user.email = "cameroon.v5000@gmail.com".
   - First commit → `gh repo create <name> --public --source=. --remote=origin --push`.
   - Enable Pages: `gh api -X POST repos/KamrynMe/<name>/pages -f "source[branch]=main" -f "source[path]=/"`.
   - Tell Cameron the live URL: `https://kamrynme.github.io/<name>/`.

8. **Hand off the install instructions** at the end:
   > Open **Safari** (must be Safari, not Chrome) → `https://kamrynme.github.io/<name>/` → Share button → **Add to Home Screen** → name it → Add. Open it from the home screen — full screen, offline, your data stays on the device.

## Iteration

When Cameron asks for changes, the loop is always:
1. Edit files locally.
2. Bump `CACHE` version in `service-worker.js`.
3. `git add . && git commit -m "<what changed>" && git push`.
4. Pages rebuilds in ~1 minute. He hard-closes the iPhone app and reopens to pick up the new bundle.

Never re-init the repo. Never force-push. Don't add `node_modules` or build artifacts — there should be none.

## Things to refuse / push back on

- Any request to add accounts, login, or sync — Cameron's apps are device-local on purpose.
- Any framework or build step — vanilla only.
- Italic body text or font sizes under 16 px — readability is sacred.
- Background audio that "works when the phone is locked" — iOS PWAs cannot do this. Be honest and offer Wake Lock as a partial mitigation.
- Pulling in heavy libraries when 30 lines of vanilla JS will do.

## What done looks like

- Cameron can install the new app on his iPhone in under 2 minutes.
- Every save survives an app close and a phone reboot.
- He can update any feature later by editing files and pushing — no rebuild, no npm, no toolchain.
- The repo is small (< 100 KB), readable, and editable by hand.
- Free-tier GitHub forever: no bandwidth concerns at his scale.
