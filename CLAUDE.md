# Undertow contributor guide

Read README.md, SOUND_NOTES.md and VALIDATION.md first.

This is a static iPad music instrument using native Web Audio and a classic Macintosh interface. Prioritise recognisable teaching passages (currently Idioteque, Everything in Its Right Place and Karma Police), simple touch controls, useful rhythm guidance, and preservation of saved projects. Preserve preset indices, source and sample credits. Distinguish harmonic reductions and original variations from exact transcriptions. No recordings or vocals are bundled.

## Work locally

Serve the root with `python3 -m http.server 8000`. Main sources are index.html, app.js, audio.js, studies.js, passages.js, lessons.js, beats.js, render.js and macintosh.css. The other loaded style sheets support advanced dialogs; machine.css is historical and not loaded.

`python3 scripts/package.py` regenerates dist/ and prototype.html; both are ignored build output. Check /dist/ and a GitHub Pages-style /undertow-studio/ subdirectory. Use relative asset paths.

Browser regressions use Node, the playwright package and Chromium. Tests currently expect /usr/bin/chromium; adapt the executable path to your environment. Prioritise tests/passages.cjs, tests/sofa.cjs and tests/audit.cjs for guided-play changes. Other suites cover the library, sound, lessons and saved projects. Automated signal checks establish audibility and headroom, not perceptual equivalence. Physical iPad Safari/Pencil remain unverified.

## Publish

GitHub is the source of truth for this checkout. Pushes and merges to main trigger the Pages workflow, which builds source and deploys only dist/. Do not edit generated bundles. Run appropriate checks, commit source changes and push your working branch. Claude Code cloud normally pushes a task branch; open a pull request and merge it into main to publish. Direct pushes to main require permission from your coding environment and repository. Keep this guide and relevant documentation in sync.

Never commit credentials, browser storage, personal recordings, or platform-specific hosting identity files. No API keys are needed for this app.
