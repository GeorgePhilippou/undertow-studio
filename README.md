# Undertow

A classic Macintosh music desk for iPad: play, practise and record Radiohead songs.

Open https://GeorgePhilippou.github.io/undertow-studio/, tap **Start**, choose a song and press **Play**. Headphones recommended.

## What it does

- **Songs:** Everything In Its Right Place, Idioteque, Karma Police, Pyramid Song and Codex. Each is a short, looping passage with its own sound. Get Info explains what is checked against published analyses and what is a reconstruction.
- **Listen:** the song plays while the note roll and the keyboard show your part.
- **Play Along:** your part drops out, the dotted keys show what comes next, and you get a score after each time round.
- **Wait for Me:** the song stops at every chord until you play it. Any octave counts, and on chord pads only the right chord counts.
- **Record:** a bar of count-in, then play over the backing and press Stop. Takes can be played back, saved as WAV, or used as the song's part. That is how you correct a song by ear.
- **Keyboard window:** a multi-touch piano with gliding and Apple Pencil pressure, one pad per chord, and drum pads. Computer keys (A W S E D…) and Web MIDI keyboards also work.
- **Drum Machine:** a step grid for the drum part, with three synthesised kits.
- **New Song:** start your own loop and build it up from takes and drum steps.
- **Loop a section:** drag across bar numbers in the roll to repeat just those bars; Loop All goes back to the whole passage.
- **See how you did:** ticks and crosses on each chord after every time round, your best score under each song, and *Speed up when perfect* to step the tempo up as you improve.
- **Pencil and Eraser:** MacPaint-style tools for adding and removing notes or drum hits right in the roll.
- **Slower/faster** from 50% to 125%, a click track, a big count-in, and Undo / Revert to Original for every change.
- **Balloon Help and a tour:** Help ▸ Show Balloons explains anything you point at or touch; the tour runs on a first visit and from the Help menu.
- **Install it:** in Safari choose Share ▸ Add to Home Screen. It opens full screen and works offline once loaded.

Everything you make is stored in this browser. File ▸ Save a Copy writes a portable file. No recordings or vocals are bundled; the songs are played by the app's own instruments. Listen to the Record opens the official recording on YouTube.

## Older projects

The previous version of Undertow lives at `classic/` and opens from the Undertow menu or File ▸ Open Undertow Classic. It keeps its own saved session and imported audio, so older projects are untouched.

## Develop

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. The page is plain HTML, CSS and ES modules with no dependencies:

| Path | Role |
| --- | --- |
| `index.html`, `mac.css` | The desk: menu bar, windows and one-bit System 7 style |
| `src/songs.js` | Song data in plain text; see [SONGS.md](SONGS.md) |
| `src/player.js` | Transport, looping, count-in, practice modes and recording |
| `src/audio/` | Sampled piano, synthesisers, drum kits, reverb and limiter |
| `src/render.js` | Offline WAV export |
| `src/ui/` | Menus and windows, keyboard and pads, note roll, Balloon Help, icons |
| `sw.js`, `manifest.webmanifest` | Offline support and Home Screen install |
| `src/main.js` | Wires the windows, menus and storage together |

Browser checks need Node, the `playwright` package and Chromium (set `CHROMIUM_PATH` if it is not Playwright's own):

```sh
node tests/app.cjs     # songs, practice modes, recording, editing, layouts
node tests/sound.cjs   # every song renders audibly without clipping
node tests/balloons.cjs  # every tour step and help balloon points at its control
```

`python3 scripts/package.py` copies the site into `dist/`. Pushes to `main` build and deploy `dist/` with GitHub Actions.

## Credits

- Piano: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, CC BY 3.0 (`assets/piano/README`).
- Chicago-style type: ChiKareGo2 by Giles Booth, CC BY. Geneva-style type: Geneva 9 by Kelsey Higham, CC BY 3.0 (`assets/fonts/README`).
- Song analyses are credited per song in `src/songs.js` and in each Get Info window.
