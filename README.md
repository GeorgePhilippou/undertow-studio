# Undertow

A classic Macintosh music instrument for iPad: touch anything to make sounds and pictures in the spirit of Radiohead's records, or learn the songs.

Open https://GeorgePhilippou.github.io/undertow-studio/ and tap **Start**. Headphones recommended.

## Play

Undertow opens on **Play**: one window, one picture, touch anywhere.

- **Your Song** - the real thing: load a Radiohead track you own (MP3, M4A or WAV from Files) and the screen becomes the song. Left to right is the track; touch to hear any moment, slide to scrub through it, and higher up slows it into a frozen, shimmering cloud of grains. The Song button plays it straight through to play over. The file stays on the device; nothing is uploaded or bundled. Apple Music downloads are copy-protected and cannot be opened.
- **Three sound worlds**, each an original loop in the manner of an album, not a song from it:
  - **Kid A** - glass chords, a crunchy machine beat and a singing ondes-style voice that glides under your finger.
  - **OK Computer** - tape strings, electric piano and glockenspiel in a slow, glowing room.
  - **In Rainbows** - clean guitars weaving around each other over a steady groove; you pluck along.
- **Nothing sounds wrong:** the surface plays only notes from the world's scale. Left is low, right is high, higher up is brighter; Apple Pencil pressure sets loudness. Several fingers, computer keys (A W S E D...) and MIDI keyboards all play.
- **Living one-bit art:** each world has its own dithered black-and-white picture - your song's own waveform, signal interference, a night road, rippling arcs - that pulses with the music and ripples where you touch. It is original artwork, not album art.
- **Record a piece:** the sound and the moving picture together as a video (sound only where a browser cannot record video). Pieces are kept on the device in My Pieces, and Save opens the share sheet.
- **Band** on or off (Space), **Full Screen** from the window's zoom box.

## Learn

**Learn** (top right of the menu bar) opens the song desk:

- **Songs:** Everything In Its Right Place, Idioteque, Karma Police, Pyramid Song, Codex, Videotape, True Love Waits and Motion Picture Soundtrack. Each is a short, looping passage with its own sound. Get Info explains what is checked against published analyses and what is a reconstruction. No Surprises and 15 Step are held back until their parts sound right.
- **Five lesson steps** for every song, each ticked off as you go and shown in the Songs list:
  1. **Listen** while the note roll and the keyboard show your part.
  2. **Learn:** the song stops at every chord until you play it. Any octave counts, and on chord pads only the right chord counts.
  3. **Slow** and 4. **Full Speed:** your part drops out, the dotted keys show what comes next, and you get a score after each time round; 80% ticks the step off.
  5. **Record** yourself over the band.
- **Record:** a bar of count-in, then play over the backing and press Stop. Takes can be played back, saved as WAV, or used as the song's part. That is how you correct a song by ear.
- **Keyboard window:** a multi-touch piano with gliding and Apple Pencil pressure, a sustain Pedal (also Shift or a MIDI pedal), one pad per chord, and drum pads. Computer keys (A W S E D…) and Web MIDI keyboards also work.
- **Feedback as you play:** wrong notes and chords flash crossed out, the counter flashes on every beat, and *Guide* plays your part quietly while you practise it.
- **Mixer:** Sound ▸ Mixer or the Mixer button sets each part's level; levels are kept per song and used for WAV export.
- **Sound:** a sampled grand piano, a plucked-string guitar, analogue keys and pads, notes spread across the stereo field like a real keyboard, a warm room reverb, and a breathing organ vibrato.
- **On iPad:** the screen stays awake while music plays, sound resumes with a tap after an interruption, and saved files open the share sheet (Files, AirDrop, Messages).
- **Drum Machine:** a step grid with its own Play button, ready-made beats to start from, three synthesised kits, and Add Drums for songs that have none.
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
| `src/beats.js` | Ready-made beats for the Drum Machine |
| `src/player.js` | Transport, looping, count-in, practice modes and recording |
| `src/audio/` | Sampled piano, synthesisers, drum kits, reverb and limiter |
| `src/render.js` | Offline WAV export |
| `src/ui/` | Menus and windows, keyboard and pads, note roll, Balloon Help, icons |
| `sw.js`, `manifest.webmanifest` | Offline support and Home Screen install |
| `src/play/` | Play screen: sound worlds, Your Song (grains, stored tracks), touch surface, generative art, recording pieces |
| `src/main.js` | Wires the windows, menus and storage together |

Browser checks need Node, the `playwright` package and Chromium (set `CHROMIUM_PATH` if it is not Playwright's own):

```sh
node tests/play.cjs    # Play screen: worlds, touch, art, recording, layouts
node tests/app.cjs     # Learn: songs, practice modes, recording, editing, layouts
node tests/sound.cjs   # every song renders audibly without clipping
node tests/balloons.cjs  # every tour step and help balloon points at its control
```

`python3 scripts/package.py` copies the site into `dist/`. Pushes to `main` build and deploy `dist/` with GitHub Actions.

## Credits

- Piano: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, CC BY 3.0 (`assets/piano/README`).
- Chicago-style type: ChiKareGo2 by Giles Booth, CC BY. Geneva-style type: Geneva 9 by Kelsey Higham, CC BY 3.0 (`assets/fonts/README`).
- Song analyses are credited per song in `src/songs.js` and in each Get Info window.
