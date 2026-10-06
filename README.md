# QuickGrade

A single HTML app for printing, scanning, and grading multiple-choice bubble sheets. `index.html` is the deployable app, with all JavaScript and styles embedded. `QuickGrade.html` is an identical downloadable copy. No server processes student photos.

Use the visible **New Quiz** button beside the quiz selector to create a quiz with **1–20 questions**. Every printed sheet has **20 answer rows** in two columns (1–10 and 11–20), with four or five choices per row. The scanner reads and scores only rows 1 through the selected quiz’s question count; unused marks do not affect the grade. The sheet header tells students which rows to answer. A small footer QR opens `https://altarac.github.io/QuickGrade/#scan`: an existing quiz opens on the Scan tab, while a new device gets quiz setup. Camera access still starts from the teacher’s Start Camera button. The QR is included in preview, print, and downloaded PNGs; its matrix is bundled locally, with no QR service or runtime network request. Regenerate it with `npm run qr` if the hosted address changes.

Older quizzes above 20 questions remain available for viewing/exporting their saved Gradebook records. They are not silently shortened; create a new quiz of up to 20 questions to scan or print. Older printed layouts for quizzes of up to 20 questions remain supported.

## Lightning scanning

1. Create a quiz and complete its answer key.
2. Open **Scan**, turn on **Lightning mode**, and start the camera.
3. Show the entire printed sheet with all four corner markers visible. After two matching steady readings, the score and percentage appear while the camera stays live.
4. Point at the next sheet. A changed answer pattern updates automatically. For sheets with identical answers, briefly move the previous sheet out of view or move to a clearly different position before holding steady.

Lightning mode keeps only the latest score in memory. It does not ask for names, create gradebook submissions, save photos, or open a frozen review image. A held sheet does not repeatedly sound the chime. Blank or multiple marks score zero; faint readings are flagged. Turn Lightning mode off to review/correct answers and save student grades.

Live camera access requires HTTPS (or localhost) and browser permission. On iPhone, open the hosted app directly in Safari. An enclosing website such as Google Sites can block camera access; the HTML app cannot override its permissions. **Take sheet photo** and **Upload Photo** remain available.

## Faster detection

- Validate bubble outlines directly in the camera pixels instead of reconstructing the entire page on every normal-sheet scan.
- Retain measured older-sheet layouts between frames, validating their outlines again before using them.
- Read camera pixels once per check, reuse canvas buffers, and precompute projective coefficients when an older grid needs reconstruction.
- Check approximately every 200 ms, one frame at a time, and require two steady readings instead of three checks spaced 700 ms apart.
- Normal auto-capture grades the exact stable frame; it does not detect and scan the page again.

The original scanner optimization benchmark, recorded before the fixed 20-row form was introduced, measured 70–73 ms per full scan before and 7–10 ms after on the development Mac's headless Chromium. The generated live camera fixture produced a first Lightning score in roughly half a second. These are local test measurements, not an iPhone speed guarantee; lighting, camera focus, sheet size, and device speed matter. Those historical measurements are in `tests/performance-before.json` and `tests/performance-after.json`. The current fixed-sheet benchmark is in `tests/performance-fixed-sheet.json`.

## Development

The editable React source is included so the single HTML can be rebuilt without editing a minified bundle. Requires Node 22.12 or newer.

```sh
npm ci
npm run dev
npm run build
```

Build regenerates both standalone HTML files and `dist/index.html`. Deploy the root `index.html` to static HTTPS hosting (including GitHub Pages). Runtime requires no npm installation or external assets.

## Verification

```sh
npx playwright install chromium
npm run build
npm test
npm run benchmark
```

Tests run on isolated intercepted origins with generated sheets/camera streams. They cover every quiz length from 1–20 questions, fixed 20-row printing, marks in unused rows, creation/editing limits, preservation of older Gradebook records, four/five choices, weighted scores, perspective and shadows, older printed layouts, blank/double marks, missing markers, correction, persistence, printing, photo upload, CSV/backup, camera startup and embed policy, plus continuous Lightning scanning and same-answer re-arming. Camera startup fixtures emulate browser failure conditions; physical iPhone camera behavior still needs a device check.
