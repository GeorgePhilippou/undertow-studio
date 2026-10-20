# OK Computer contributor guide

Read README.md and SONGS.md first.

OK Computer (formerly Undertow; the repository, storage keys and file formats keep the old name for compatibility) is a static iPad music instrument in the style of a one-bit classic Macintosh (System 6/7), built on native Web Audio. It opens on a Finder-style **desktop** (`src/records/`) built around Radiohead records the person owns and loads themselves: a record opens to **Riffs** (tap through the matching song's learn part, hit by hit, sliced from the record or played by the part's instrument), **Pads** (sixteen sampler pads with lengths, trimming, modes, pitch, reverse, filter and echo), **Remix** (a 16-step pattern grid of the pads) and **Play Along** (waveform, loop, pitch-kept speed, chords scrolling in time from the matching song or from chords the person marks). The record itself plays from an audio element, not through Web Audio. Desktop icons open **Lessons**, the song desk for practising short passages, and **My Pieces**, the takes recorded in records. The synthesised Sound Worlds were removed so everything is built from the person's own records; older pieces kept from them still play in My Pieces. Never bundle songs or album artwork. Loaded records (stored as a copy of the file's bytes) stay in the browser's IndexedDB `undertow-tracks` on their device and must never be uploaded, bundled or committed. File > Save Record to Files writes a record and its settings as one `undertow-record` JSON file, and Save All Records to Files writes an `undertow-records` bundle of them (the audio as a data URL) for the person to move through their own Files or iCloud Drive; Load a Record reads it back. Keep that format compatible. Keep the interface simple and consistent: black, white and dither patterns only; Chicago-style type for controls and titles, Geneva-style type for small text; every window, menu, button and dialog uses the shared styles in `mac.css`. The pixel fonts only cover basic ASCII; other characters (♭ ♯ ’ — ·) fall back to a system font, so prefer plain ASCII punctuation in UI strings.

Musical accuracy matters most. Song data in `src/songs.js` must say in `accuracy` what is checked against published analyses and what is reconstructed, with sources. Never present a reconstruction as an exact transcription. No recordings or vocals are bundled. Preserve source, piano-sample and font credits.

Saved work: the desk stores everything under the localStorage key `undertow-desk-v1` (see `src/storage.js`). Keep that format compatible or migrate it. The previous app lives in `classic/` with its own storage and must keep opening for older projects; do not change it except to fix asset paths.

## Work locally

Serve the root with `python3 -m http.server 8000`. Sources: `index.html`, `mac.css`, `src/` (songs, player, render, storage, main, `audio/`, `ui/`, `records/`). Element ids must be unique; `tests/desk.cjs` checks.

Browser checks use Node, the `playwright` package and Chromium; set `CHROMIUM_PATH` to use a specific executable. Run `node tests/desk.cjs`, `node tests/app.cjs`, `node tests/sound.cjs` and `node tests/balloons.cjs` with the server running; set `UNDERTOW_URL` to test another address. Signal checks prove audibility and headroom, not resemblance to the records. Physical iPad Safari, Apple Pencil and MIDI hardware remain unverified.

`sw.js` precaches the core files listed in `CORE` and serves pages and code network-first, so a deploy shows up on the next online load. Add new source files to `CORE`. Give new controls a `data-help` balloon.

`python3 scripts/package.py` copies the site into `dist/` (ignored build output). Check `/dist/` from a GitHub Pages-style `/undertow-studio/` subdirectory; use relative asset paths.

## Publish

GitHub is the source of truth. Pushes and merges to `main` run the Pages workflow, which checks JavaScript syntax, builds and deploys only `dist/`. Commit source changes and push your working branch; Claude Code cloud normally pushes a task branch, so open a pull request and merge it into `main` to publish. Keep this guide and the README in sync.

Never commit credentials, browser storage, personal recordings, or platform-specific hosting identity files. No API keys are needed.
