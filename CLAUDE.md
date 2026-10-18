# Undertow contributor guide

Read README.md and SONGS.md first.

Undertow is a static iPad music desk in the style of a one-bit classic Macintosh (System 6/7). People play, practise and record recognisable Radiohead songs, electronic or piano, with native Web Audio. Keep the interface simple and consistent: black, white and dither patterns only; Chicago-style type for controls and titles, Geneva-style type for small text; every window, menu, button and dialog uses the shared styles in `mac.css`. The pixel fonts only cover basic ASCII; other characters (♭ ♯ ’ — ·) fall back to a system font, so prefer plain ASCII punctuation in UI strings.

Musical accuracy matters most. Song data in `src/songs.js` must say in `accuracy` what is checked against published analyses and what is reconstructed, with sources. Never present a reconstruction as an exact transcription. No recordings or vocals are bundled. Preserve source, piano-sample and font credits.

Saved work: the desk stores everything under the localStorage key `undertow-desk-v1` (see `src/storage.js`). Keep that format compatible or migrate it. The previous app lives in `classic/` with its own storage and must keep opening for older projects; do not change it except to fix asset paths.

## Work locally

Serve the root with `python3 -m http.server 8000`. Sources: `index.html`, `mac.css`, `src/` (songs, player, render, storage, main, `audio/`, `ui/`).

Browser checks use Node, the `playwright` package and Chromium; set `CHROMIUM_PATH` to use a specific executable. Run `node tests/app.cjs` and `node tests/sound.cjs` with the server running; set `UNDERTOW_URL` to test another address. Signal checks prove audibility and headroom, not resemblance to the records. Physical iPad Safari, Apple Pencil and MIDI hardware remain unverified.

`python3 scripts/package.py` copies the site into `dist/` (ignored build output). Check `/dist/` from a GitHub Pages-style `/undertow-studio/` subdirectory; use relative asset paths.

## Publish

GitHub is the source of truth. Pushes and merges to `main` run the Pages workflow, which checks JavaScript syntax, builds and deploys only `dist/`. Commit source changes and push your working branch; Claude Code cloud normally pushes a task branch, so open a pull request and merge it into `main` to publish. Keep this guide and the README in sync.

Never commit credentials, browser storage, personal recordings, or platform-specific hosting identity files. No API keys are needed.
