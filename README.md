# OK Computer

A classic Macintosh music desk for iPad, built around Radiohead records you own: tap through a song's famous riff with its real sound, cut it into sampler pads and remix them and play along with its chords.

Open https://GeorgePhilippou.github.io/undertow-studio/ and tap **Start**. (The app was called Undertow; the earlier version still opens as Undertow Classic. OK Computer is a fan-made app, not connected with Radiohead or their record labels.) Headphones recommended.

## The desktop

OK Computer opens on a Finder-style desktop. The **Records** window holds the songs you have loaded; touch one to open it. **My Pieces** keeps the takes you record. The **Desktop** button in the menu bar always brings you back.

Only the records themselves sound exactly like Radiohead, so everything is built from them. Load an MP3, M4A, AAC or WAV you own from Files (**Load a Record...** or File > Load a Record; several at once is fine). It stays in this browser on this device; nothing is uploaded or bundled. Apple Music downloads are copy-protected and cannot be opened.

### Moving between Mac and iPad

Records are kept in the browser on each device; nothing syncs or uploads by itself, and a web page cannot open an iCloud Drive folder on its own. To carry records over:

1. On the Mac, choose **File > Save All Records to Files** (or **Save Record to Files** for one). It saves the songs and everything set up for them (riff timing, pads, pattern, chord marks, effects) as one `.okcomputer.json` file. Put it in a folder in iCloud Drive, such as *OK Computer*. Chrome lets you choose that folder straight away; Safari saves to Downloads unless you set it to ask where to save.
2. On the iPad, tap **Load a Record...**, open that iCloud Drive folder in the file picker and choose the file. Every record arrives on the desktop just as it was. You can also select several song files or saved records at once. Undertow also asks the browser to keep its records rather than clear them; on iPad, adding it to the Home Screen helps too.

## A record

A record opens in one window with three tabs:

- **Play:** the whole record as a waveform: touch to jump, drag across a part to loop it, and slow it down to 50% without changing the pitch. Underneath, the chords scroll past in time, and the song's **riff** is ready to perform.
  - If the record is one of the known songs (Everything In Its Right Place, Idioteque, Karma Police, Pyramid Song, Codex, Videotape, True Love Waits, Motion Picture Soundtrack - recognised from the file name, or chosen in the Song menu), its chord loop and riff are lined up from where the music starts. **Set Start** and the tempo line them up by ear. The chart repeats one passage, so other sections of the record may differ.
  - **Tap** (or Return) plays the riff's next hit. **Song** cuts each hit straight from your record, so it is Radiohead's real sound; **Keys** plays it with the app's instrument. **Hear It** plays it in time.
  - The keyboard shows the riff's next hit when stopped and the chord playing now when the record plays. **Chords** turns it into one pad per chord.
  - **Mark Chords:** tap each chord the moment you hear it change. Your marks replace the chart for that record.
- **Pads:** three banks, **A, B and C**, of sixteen sampler pads cut from the record (bank B starts as a bar per pad, bank C as two bars per pad). Touch them, or press 1-4, Q-R, A-F and Z-V; several fingers or keys at once is fine. While a pad plays, its waveform fills in.
  - **Cut Pads...** recuts a bank: at the strongest attacks, **1 beat, 1 bar, 2 bars or 4 bars each** from the loop or the playhead, or the loop into sixteen. **Loop to Pad** puts the looped part on one pad.
  - **Edit Pad:** the waveform zooms in on the pad; drag across it to set where the pad starts and ends, or nudge its start and end a sixteenth note at a time. Choose **Once** (plays the whole pad), **Hold** (plays round and round while held) or **Loop** (repeats until touched again), set its **volume** and **fade**, pitch it, **Reverse** it, or play a pad **from another record** to mix songs together.
  - **Sync loops** starts a Loop pad on the next beat of any loop already playing, so loops stack in time. **Snap** keeps cuts and edits on the beat grid. **Undo** (or Command-Z) takes back any change to the pads.
  - **Filter** and **Echo** colour everything the pads play.
- **Remix:** four sixteen-step patterns, **A to D**, one row per pad and one column per sixteenth note. Each pattern plays one bank. **Chain** plays the patterns one after another, and **Swing** loosens the groove.
- **Record** (in every tab) records what you play - pads, riff, remix or keys - and keeps it in My Pieces as a WAV to play back, save or share. The record playing underneath is not included.
- Your song choice, sync, marks, pads, patterns and effects are kept with the record. For a record that is not a known song, the tempo and first beat are heard from the record itself (shown with a question mark) and can be nudged.

The record is one finished mix, so the app cannot pull out just the piano or the guitar; chords, riffs, pads and remixes work whatever instruments play them. Official stems that Radiohead released (Nude and Reckoner) load as records like any other file.

## Lessons (old)

The earlier song desk, where the app's own instruments play short passages to learn step by step, still opens from the apple menu: **Lessons (old)...**

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
| `src/records/` | The desktop and records: Finder window, stored records and pieces, riffs, sampler pads and pad editing, remix grid, takes, chord chart and play along |
| `src/main.js` | Wires the windows, menus and storage together |

Browser checks need Node, the `playwright` package and Chromium (set `CHROMIUM_PATH` if it is not Playwright's own):

```sh
node tests/desk.cjs    # desktop and records: riffs, pads, remix, chords, looping, speed
node tests/app.cjs     # Lessons: songs, practice modes, recording, editing, layouts
node tests/sound.cjs   # every song renders audibly without clipping
node tests/balloons.cjs  # every tour step and help balloon points at its control
```

`python3 scripts/package.py` copies the site into `dist/`. Pushes to `main` build and deploy `dist/` with GitHub Actions.

## Credits

- Piano: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, CC BY 3.0 (`assets/piano/README`).
- Chicago-style type: ChiKareGo2 by Giles Booth, CC BY. Geneva-style type: Geneva 9 by Kelsey Higham, CC BY 3.0 (`assets/fonts/README`).
- Song analyses are credited per song in `src/songs.js` and in each Get Info window.
