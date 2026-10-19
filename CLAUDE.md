# Undertow contributor guide

Read README.md and SONGS.md first.

Undertow is a static iPad music instrument in the style of a one-bit classic Macintosh (System 6/7), built on native Web Audio. It opens on a Finder-style **desktop** (`src/records/`) built around Radiohead records the person owns and loads themselves: a record opens to **Play Along** (waveform, loop, pitch-kept speed, chords scrolling in time from the matching song or from chords the person marks) and **Pads** (the record cut into sixteen sampler pads). Desktop icons open **Sound Worlds** (`src/play/`: touch anywhere to play scale-locked worlds inspired by Kid A, OK Computer and In Rainbows, with generative dithered art and recordable pieces) and **Lessons**, the song desk for practising short passages. Worlds are original music and original art in the spirit of the albums; never copy songs or album artwork into them. Loaded records (also used by the Your Song world) stay in the browser's IndexedDB `undertow-tracks` on their device and must never be uploaded, bundled or committed. Keep the interface simple and consistent: black, white and dither patterns only; Chicago-style type for controls and titles, Geneva-style type for small text; every window, menu, button and dialog uses the shared styles in `mac.css`. The pixel fonts only cover basic ASCII; other characters (♭ ♯ ’ — ·) fall back to a system font, so prefer plain ASCII punctuation in UI strings.

Musical accuracy matters most. Song data in `src/songs.js` must say in `accuracy` what is checked against published analyses and what is reconstructed, with sources. Never present a reconstruction as an exact transcription. No recordings or vocals are bundled. Preserve source, piano-sample and font credits.

Saved work: the desk stores everything under the localStorage key `undertow-desk-v1` (see `src/storage.js`). Keep that format compatible or migrate it. The previous app lives in `classic/` with its own storage and must keep opening for older projects; do not change it except to fix asset paths.

## Work locally

Serve the root with `python3 -m http.server 8000`. Sources: `index.html`, `mac.css`, `src/` (songs, player, render, storage, main, `audio/`, `ui/`, `play/`, `records/`). Element ids must be unique; `tests/play.cjs` checks.

Browser checks use Node, the `playwright` package and Chromium; set `CHROMIUM_PATH` to use a specific executable. Run `node tests/desk.cjs`, `node tests/play.cjs`, `node tests/app.cjs`, `node tests/sound.cjs` and `node tests/balloons.cjs` with the server running; set `UNDERTOW_URL` to test another address. Signal checks prove audibility and headroom, not resemblance to the records. Physical iPad Safari, Apple Pencil and MIDI hardware remain unverified.

`sw.js` precaches the core files listed in `CORE` and serves pages and code network-first, so a deploy shows up on the next online load. Add new source files to `CORE`. Give new controls a `data-help` balloon.

`python3 scripts/package.py` copies the site into `dist/` (ignored build output). Check `/dist/` from a GitHub Pages-style `/undertow-studio/` subdirectory; use relative asset paths.

## Publish

GitHub is the source of truth. Pushes and merges to `main` run the Pages workflow, which checks JavaScript syntax, builds and deploys only `dist/`. Commit source changes and push your working branch; Claude Code cloud normally pushes a task branch, so open a pull request and merge it into `main` to publish. Keep this guide and the README in sync.

Never commit credentials, browser storage, personal recordings, or platform-specific hosting identity files. No API keys are needed.
