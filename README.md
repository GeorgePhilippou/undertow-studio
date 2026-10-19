# Undertow

A classic Macintosh music desk for iPad, built around Radiohead records you own: tap through a song's famous riff with its real sound, cut it into sampler pads and remix them, play along with its chords, or explore sound worlds and lessons.

Open https://GeorgePhilippou.github.io/undertow-studio/ and tap **Start**. Headphones recommended.

## The desktop

Undertow opens on a Finder-style desktop. The **Records** window holds the songs you have loaded; touch one to open it. Icons on the right open **Sound Worlds**, **Lessons** and **My Pieces**. The **Desktop** button in the menu bar always brings you back.

Only the records themselves sound exactly like Radiohead, so they are at the heart of the app. Load an MP3, M4A, AAC or WAV you own from Files (**Load a Record...** or File > Load a Record). It stays in this browser on this device; nothing is uploaded or bundled. Apple Music downloads are copy-protected and cannot be opened.

### Moving between Mac and iPad

Records are kept in the browser on each device; nothing syncs or uploads by itself. To carry a record over, choose **File > Save Record to Files**. It saves the song and everything set up for it (riff timing, pads, pattern, chord marks, effects) as one `.undertow.json` file. Put it in iCloud Drive, then choose **Load a Record...** on the other device and it opens just as it was. Undertow also asks the browser to keep its records rather than clear them; on iPad, adding it to the Home Screen helps too.

## A record

A record opens in a window with four views:

- **Riffs:** the song's recognisable part, ready to perform - the Everything In Its Right Place keyboard figure, the Idioteque chords, the Karma Police piano and the rest of the songs in Lessons.
  - Tap the big **Tap** pad (or Space) in rhythm: every tap plays the next hit. **Your Record** cuts each hit straight from your own record, so it is Radiohead's real sound; **Keys** plays it with the app's instrument.
  - The keyboard shows the notes of the next hit, and playing them moves on too, so you can learn it properly. **Hear It** plays the whole riff in time; touch any box in the strip to start from there.
  - **Set Start** (the moment the riff begins on the record) and the tempo line the hits up with the record.
- **Pads:** the record cut into sixteen sampler pads, each with its own little waveform. Touch them, or press 1-4, Q-R, A-F and Z-V.
  - **Cut Pads...** recuts them: at the strongest attacks, **1 beat, 1 bar, 2 bars or 4 bars each** from the loop or the playhead, or the loop into sixteen. **Loop to Pad** puts the looped part on one pad.
  - **Edit Pad:** touch a pad, then drag across the waveform to set exactly where it starts and ends, or nudge its start and end a sixteenth note at a time. Choose **Once** (plays the whole pad), **Hold** (plays round and round while held, stops when you let go) or **Loop** (repeats until touched again), pitch it up or down in semitones, or **Reverse** it.
  - **Filter** and **Echo** colour everything the pads play.
  - While a pad plays, its waveform fills in as it goes, and the record's waveform marks where it is in the song.
  - **Snap** (on by default) lands pad edits and beat or bar cuts on the beat grid, a sixteenth note at a time, and **Snap all pads to the beat** lines up every pad at once, so loops stay in time. Bar marks run along the bottom of the waveform. For a record that is not in the song list, the tempo and the first beat are heard from the record itself (shown with a question mark) and can be nudged.
- **Remix:** a sixteen-step pattern grid, one row per pad and one column per sixteenth note, played round and round at the song's tempo (or your own) through the same filter and echo.
- **Play Along:** the whole record as a waveform with the chords scrolling past in time, lit on the keyboard or on one pad per chord.
  - If the record is one of the songs in Lessons (it is recognised from the file name, or choose it from the Song menu), its chord loop is lined up from where the music starts. **Set Start** lines it up by ear and the tempo can be nudged. The chart repeats the passage from Lessons, so other sections of the record may differ.
  - **Mark Chords:** tap each chord the moment you hear it change. Your marks replace the chart for that record.
  - **Speed** from 100% down to 50% without changing the pitch; drag across the waveform to loop a part.
- **Record** (in every view) records what you play - pads, riff, remix or keys - and keeps it in My Pieces as a WAV to play back, save or share. The record playing underneath is not included.
- Your song choice, sync, marks, pads and pattern are kept with the record.

The record is one finished mix, so the app cannot pull out just the piano or the guitar; chords and riffs work whatever instruments play them. Official stems that Radiohead released (Nude and Reckoner) load as records like any other file.

## Sound Worlds

Touch anywhere to play: one window, one picture.

- **Your Song** plays a track you load: left to right is the track, touch to hear any moment, slide to scrub, higher up slows it into a frozen cloud of grains.
- **Three sound worlds**, each an original loop in the manner of an album, not a song from it:
  - **Kid A** - glass chords, a crunchy machine beat and a singing ondes-style voice that glides under your finger.
  - **OK Computer** - tape strings, electric piano and glockenspiel in a slow, glowing room.
  - **In Rainbows** - clean guitars weaving around each other over a steady groove; you pluck along.
- **Nothing sounds wrong:** the surface plays only notes from the world's scale. Left is low, right is high, higher up is brighter; Apple Pencil pressure sets loudness. Several fingers, computer keys (A W S E D...) and MIDI keyboards all play.
- **Living one-bit art:** each world has its own dithered black-and-white picture that pulses with the music and ripples where you touch. It is original artwork, not album art.
- **Record a piece:** the sound and the moving picture together as a video (sound only where a browser cannot record video), kept in My Pieces; Save opens the share sheet.
- **Band** on or off (Space), **Full Screen** from the window's zoom box.

## Lessons

**Lessons** on the desktop opens the song desk, where the app's own instruments play short passages to learn step by step:

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
| `src/records/` | The desktop and records: Finder window, riffs, sampler pads and pad editing, remix grid, chord chart and play along |
| `src/play/` | Sound Worlds: worlds, Your Song (grains, stored tracks), touch surface, generative art, recording pieces |
| `src/main.js` | Wires the windows, menus and storage together |

Browser checks need Node, the `playwright` package and Chromium (set `CHROMIUM_PATH` if it is not Playwright's own):

```sh
node tests/desk.cjs    # desktop and records: riffs, pads, remix, chords, looping, speed
node tests/play.cjs    # Sound Worlds: worlds, touch, art, recording, layouts
node tests/app.cjs     # Lessons: songs, practice modes, recording, editing, layouts
node tests/sound.cjs   # every song renders audibly without clipping
node tests/balloons.cjs  # every tour step and help balloon points at its control
```

`python3 scripts/package.py` copies the site into `dist/`. Pushes to `main` build and deploy `dist/` with GitHub Actions.

## Credits

- Piano: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, CC BY 3.0 (`assets/piano/README`).
- Chicago-style type: ChiKareGo2 by Giles Booth, CC BY. Geneva-style type: Geneva 9 by Kelsey Higham, CC BY 3.0 (`assets/fonts/README`).
- Song analyses are credited per song in `src/songs.js` and in each Get Info window.
