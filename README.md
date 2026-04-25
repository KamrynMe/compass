# Compass — Personal Life Navigation PWA

A private, offline-first daily tracking and reflection app installed to iPhone via Safari's "Add to Home Screen."

## What's in this folder (before build)

- `compass-handoff.md` — Full build specification (read this first)
- `life-guide-reference.html` — Visual/UX reference prototype
- `README.md` — This file

After Claude Code builds the app, this folder will also contain the full app source (HTML, CSS, JS, manifest, service worker, icons).

## Getting it on your iPhone

**1. Local test (optional):**
```
cd compass-app
python -m http.server 8000
```
Then visit `http://localhost:8000` in any browser.

**2. Deploy to GitHub Pages:**
```
git add .
git commit -m "build"
git push
```
Then in your GitHub repo: Settings → Pages → Source: Deploy from branch → main → / (root) → Save.

**3. Install on iPhone:**
- Open Safari (must be Safari)
- Go to `https://YOUR-USERNAME.github.io/REPO-NAME/`
- Tap the Share button
- Tap "Add to Home Screen"
- Name it "Compass"
- Tap Add

The app icon now sits on your home screen. Open it — full screen, works offline, stores data privately on your device.

## Updating the app later

Edit any file, then:
```
git add .
git commit -m "what you changed"
git push
```

GitHub Pages rebuilds in about a minute. Reopen the app on your iPhone — it will pick up the changes automatically (the service worker handles this).

## Data & Privacy

All data lives on your iPhone only, in IndexedDB. Nothing is ever sent to a server. The only external network call is to the Open-Meteo weather API (public, no account required, no personal data sent — just latitude and longitude).

To back up your data: Settings tab → Export → saves a JSON file.
To restore: Settings tab → Import → select your JSON file.
