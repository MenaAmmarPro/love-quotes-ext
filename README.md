# Love Quotes — love-quotes-ext

A tiny browser extension for Mena: every time you open the popup it shows a
random **quote or reason**, you can filter by mood, star the ones you love and
copy one to send. All the words ship with the extension and nothing ever leaves
the browser.

Works in **Chrome, Edge and Firefox** (Manifest V3) with no build step.

## What it does

- **One at a time** — a fresh quote/reason each time the popup opens.
- **Categories** — Reasons I love you, Little quotes, Goodnights, Across the
  distance, Romanian sweetness (or *Everything*).
- **Favourites** — tap the star to keep a line; favourites are stored locally
  and listed under the card. Tap a favourite to copy it, or `×` to remove it.
- **Copy** — one tap puts the line on your clipboard.
- **Refresh** — "Another ↻" (or the ↻ button) picks a different one.
- **Keyboard** — while the popup is open: `n` next, `c` copy, `f` favourite.

## Storage key

- `mena-quotes` — `{ category, favourites: [ "…" ] }` (extension local storage)

## Permissions

- `storage` — to remember your category and favourites.
- `clipboardWrite` — to copy a line when you ask.

No host permissions, no content scripts, no network requests.

## Load unpacked / temporary add-on

The repo ships **two manifests**; copy the one for your browser to
`manifest.json` before loading.

### Chrome / Edge

1. Copy `manifest.chrome.json` to `manifest.json` in this folder.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick this folder.
5. Pin the ♥ icon to the toolbar and click it.

### Firefox

1. Copy `manifest.firefox.json` to `manifest.json` in this folder.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick `manifest.json`.
4. Click the ♥ icon in the toolbar.

> A temporary Firefox add-on is removed when the browser closes — that is
> normal. Loading it again is the same three clicks.

```powershell
# Windows PowerShell
Copy-Item manifest.chrome.json manifest.json   # or manifest.firefox.json
```

## Tests

No dependencies. Two quick checks:

```powershell
node --check src/common/api.js
node --check src/common/data.js
node --check src/popup/popup.js
node --check src/background.js
node test/harness.js
```

`test/harness.js` loads the scripts in a bare context with a mocked
`chrome.storage.local` and checks the pure helpers on `window.MenaQuotes`
(category filtering, picking a different line, favourites, prefs normalisation
and the storage round-trip).

The icons are generated with the dependency-free encoder in
`tools/make-icons.js`:

```powershell
node tools/make-icons.js
```

## Layout

```
manifest.chrome.json    MV3 manifest for Chrome/Edge (service worker)
manifest.firefox.json   MV3 manifest for Firefox (background scripts + gecko id)
src/background.js       seeds default prefs on install
src/common/api.js       const api = globalThis.browser || globalThis.chrome
src/common/data.js      the bundled quotes + reasons (5 categories)
src/common/theme.css    popup styling (light + dark aware)
src/popup/popup.css     small popup-only tweaks
src/popup/popup.js      the popup logic
icons/                  generated 16 / 32 / 48 / 128 PNGs + icon.svg
tools/make-icons.js     regenerates the icons
test/harness.js         node checks
```

Made with love, just for you ♥
