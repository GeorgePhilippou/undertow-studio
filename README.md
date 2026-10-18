# GitHub deployment

Prepared for **GeorgePhilippou/undertow-studio**. This is not live on GitHub Pages until the repository exists, source is pushed and Pages is enabled.

In Settings → Pages, choose **GitHub Actions** as the source. Pushes and merges to main run the included workflow, build dist/ and deploy it. GitHub shows the actual live URL when deployment succeeds.

Connect this repository to Claude Code and start with CLAUDE.md. Claude Code cloud normally pushes a task branch; merge its pull request into main to publish. Direct pushes require the relevant permissions. The existing ChatGPT-hosted site is a separate deployment and is not updated by GitHub pushes.

---

# UNDERTOW

The current interface is a classic Macintosh listening room. Open https://GeorgePhilippou.github.io/undertow-studio/, choose a song, then move through **Hear the loop → Follow along → Play it yourself**. Start a loop, isolate a layer, or play the highlighted pads over a backing. The beat editor opens only when needed.

A compact electronic music sketchbook for iPad, Apple Pencil, touch, and desktop. Built with native Web Audio and zero application dependencies. The original three sketches and factory sounds are original. Fifteen Radiohead learning tapes use short, simplified, synthesized arrangements and harmonic/rhythm studies, with per-tape source links and explicit arrangement descriptions. No Radiohead recording files or vocals are bundled. Full Song opens the official full recording in a privacy-enhanced YouTube player, with a direct YouTube fallback. The editable instrument remains an approximate teaching arrangement.

## Guided play

Choose a named opening passage for Idioteque, Everything in Its Right Place or Karma Police. Each has a distinct revised sound and a clear teaching label. The rest of the library is labeled as inspired variations. Passage selection changes playback without rewriting notes. Karma Police’s second phrase begins at its actual offset and changes the available second pad from D/F♯ to F.

**Hear the loop** demonstrates the study. **Follow along** moves a marker using the audio clock, lights each pad when its note arrives and shows hold lengths. **Play it yourself** leaves the instrument out of the backing and hides the hints; Show hints brings them back. This guides rhythm and order without claiming to grade timing. The four-pad guide includes only notes represented on those pads.

Layer switches stay directly below the pads. Alone restores the preceding mixer configuration when toggled off. Empty layers are hidden. One sticky transport contains Play, Stop, speed and click. Sound controls and the beat editor open when needed; More tools retains advanced lessons, sampling, project saving and export.

Existing projects are preserved. For an older saved version of these three songs, **Load improved study** loads the new factory material while keeping imported audio. Undo restores the preceding project. Source-backed musical decisions and the limits of these reconstructions are documented in [SOUND_NOTES.md](SOUND_NOTES.md).

## Play

Open https://GeorgePhilippou.github.io/undertow-studio/ in Safari, Chrome, or Edge. Tap Play to unlock audio. Headphones recommended. The quick guide explains sequencing, sample slicing, mixing, and export.

- Four tracks: synthesized analogue drums, bass, harmonic keys, and a four-slice sampler.
- Meter-aware loops at 50–180 BPM, with three-, four- and five-beat bars and up to sixteen bars. The sixteen-step pages can cross bar boundaries. Pencil pressure controls step velocity where supported.
- Fifteen song studies, six instrument choices plus each study’s own sound, and four drum kits. Every study has its own pitch palette, voicings, source link and description.
- Solo Keys, Rebuild, dotted reference notes, and Restore track for reconstructing each study.
- Classic Macintosh desktop with a searchable, album-filtered library, chord pads, native sliders and an editable rhythm grid. Follow playback can be switched off to pin the current page.
- Track mute, solo, volume; shared low-pass filter and tempo-synced feedback delay, with output compression.
- Audio import up to 20 MB / 120 seconds, trim, reverse, and slice preview. Formats depend on browser codecs; WAV is recommended.
- Session state autosaves to localStorage; imported audio persists in IndexedDB. Portable JSON projects embed imported audio. Project files are local downloads, never uploaded.
- WAV export renders two practice-loop repeats or the selected teaching/practice sequence, with a four-second effects tail at 44.1 kHz stereo.
- Pencil squeeze, double-tap, and barrel rotation are not available in this browser implementation. No microphone recording; editable playback uses curated instrumental studies, while Listen to record opens the official streamed recording. Effects pad changes are live and not recorded as automation.
- Playback pauses when the document is hidden. Browser audio latency and download behavior vary by device; physical iPad/Pencil validation remains necessary.

## Local development

```sh
python3 -m http.server 8000
```

Visit http://localhost:8000. Serve over HTTP/HTTPS; ES modules do not load from a file URL.

## Publishing

The included Actions workflow deploys the repository to GitHub Pages on every main branch push. In repository Settings → Pages, select GitHub Actions as the build source. All asset paths are relative so project subpaths work.

## Architecture

`audio.js`: synthesis, shared effects graph, sample playback, offline rendering support, PCM WAV encoding.

`app.js`: project state and validation, lookahead audio scheduling, pointer editing, UI, local persistence, portable project import/export.

`style.css`: responsive visual system. Google Fonts is optional; system fonts are used if unavailable. No audio assets or third-party runtime libraries are fetched.

`studies.js`: fifteen learning arrangements, harmonic descriptions, source links, pitch palettes, chord voicings and pattern data. `equipment.css`: equipment-inspired visual theme.

Browser regression tests: `node tests/studies.cjs` with Playwright installed and the local server running.

## Night School / revision 03

Full guided instrumental practice routes are available for Idioteque and Everything in Its Right Place. Each has six exercises, chord pads with sounding pitches, 50–110% practice speed, click, four-beat count-in, section looping and a complete teaching arrangement. Idioteque runs 177 bars (about 5:08 at 138 BPM); Everything in Its Right Place runs 46 ten-beat cycles (about 4:06 at 112 BPM). These timelines are pedagogical, not recording-synchronized transcriptions. No vocal arrangement is included.

Idioteque now has a five-bar harmonic phrase, sustained FM pad voicings, and a 24-step drum reconstruction. Its 240-step / fifteen-bar loop allows those cycles to realign. The fourth chord occupies two bars. Drum hit placement remains a reconstruction. Source links and confidence limits appear in the lesson itself.

The six source studies now span 128–256 steps, with a complete eight-change opening harmony for Karma Police and a longer four-chord harmonic passage for Weird Fishes. Original arpeggio studies remain identified as such.

The reference deck loads a user-selected audio file (up to 120 MB) via a local object URL, supports pitch-preserving playback-rate changes and A–B looping, and pauses the sequencer when the reference plays. It does not upload or include reference audio in project exports. The sampler remains separate, with its existing 20 MB / 120-second limit.

WAV export now follows the active practice mode: two loop repetitions or one complete teaching arrangement, with an effects tail. Metronome and count-in are playback aids and are omitted from the exported music. The reconstruction score compares grid note positions with the stored teaching pattern; it does not score live timing or validate the pattern against a recording.

Existing sessions are retained. For an older short lesson, the Load revised study button explicitly loads the longer edition while preserving the user's imported sample.

Run `node tests/studies.cjs` and `node tests/lessons.cjs` with the local HTTP server running.

Full export uses cached, short offline blocks with overlapping effects tails, reducing audio graph size and peak memory on mobile. Reference deck data and practice speed/mode are session-only; save projects preserves the music pattern, instrument settings, holds and imported sampler audio.

## Vintage Sound Machine / revision 04

The primary UI is now a single-screen, tactile instrument matching the approved visual concept: one tape selector, four pressure-aware playable pads, Tone/Space/Tempo rotary controls, Play Loop, Stop and power. The pads map to each tape's chord voicings or melodic tones. Finger/Pencil drags vertically or horizontally turn the dials, keyboard arrows adjust them, and double-click restores the tape's default setting.

Main-screen playback starts immediately without count-in at the displayed tempo. Guided practice retains its own speed/count-in controls. Power disables pad and dial input and suspends audio. The green display shows the selected song, album, tempo and actual output waveform.

Change Tape opens the tape library. Learn This Part opens the existing lessons, with the sequencer/mixer, sampler/reference deck and project/export tools inside optional expandable sections. Existing saved projects and imported sampler audio are retained. Keyboard 1–4 triggers the main instrument pads; Space plays/pauses.

`machine.css` implements the physical panel, textured pads, green LCD, rotary hardware and responsive layout without bitmap UI controls. Main layouts at 1024×768 and 834×1194 fit without page scrolling. `node tests/machine.cjs` verifies the new touch controls and audio, while the study and lesson suites cover the retained tools.

## Refinement: full-song reference and smoother playing

The fifteen Radiohead tapes have a Listen to record button that loads the corresponding official YouTube recording only when opened. Closing the dialog removes the player. Playback is provided by YouTube and can depend on region, embedding policy and network access; use the direct link if needed. Official audio is never captured, sampled or exported. Import a recording you own into the existing local reference deck for A/B loops and speed control.

Pads now crossfade manually played chords, prevent duplicate pointer/click triggers, and request interactive audio latency. Dial drags coalesce to one update per animation frame and update only affected controls. Audio automation skips unchanged parameters. Darker filtered repeats and softer FM voicings reduce harshness.

Karma Police and Pyramid Song use six actual Yamaha C5 piano samples from Alexander Holm’s Salamander Grand Piano, CC BY 3.0, distributed through Tonejs/audio. The reduced set is repitched and enveloped; licensing and source credits are in `assets/piano/README` and the in-app guide. Other instruments remain synthesized. Sample downloads total about 450 KB and fall back to synthesis if loading fails. These are improvements in instrument sound, not a claim of album-accurate transcriptions.

## Macintosh desktop / Rhythm Composer

- Fifteen song studies are available in Library; existing saved sessions and imports retain their notes, voicings, holds, and audio.
- Twelve editable rhythm starters include the six-beat Idioteque teaching model, sparse/metallic variations, broken beats, straight pulses, arpeggio motors, slower backbeats, uneven cycles, and fills. These are teaching studies and original variations, not claims of recording-accurate drum transcriptions.
- Three synthesized kits: Modular, Drum machine, Soft room. The modular kit adds a pitched metallic percussion voice; the soft kit has quieter, darker transients.
- Instrument selector keeps the same pitches and voicings while choosing tape-like chords, a warm polysynth, sampled piano, glass bell, picked strings, or soft organ. Song sound returns to the study’s original instrument. Warm synth and organ use shaped envelopes and local low-pass filters; the keys now have a modest stereo room response.
- Drum cells support tap, keyboard activation and pressure-sensitive Pencil painting. The phone grid scrolls horizontally. Instrument names audition individual drum voices. Beat changes automatically enable the drum layer while preserving all other written parts.
- Loop Length supports 1, 2, 4, 8, 15 and 16 bars, plus retained unusual study lengths. Expanding repeats existing material; shortening trims it. Undo restores the prior loop, including holds. Add fill writes a short snare fill on the current page. Song beat restores the study’s drum pattern. Layer buttons mute/unmute Drums, Bass, Keys and Sample.
- All controls work with touch or mouse; the three horizontal sliders use native keyboard-accessible range controls. Help explains the workflow, and Learn & edit opens existing lessons, advanced editing, sampling, reference recordings and export.

## Expanded library and sound refinement

Nine new playable studies: **15 Step, Reckoner, Daydreaming, Paranoid Android, Exit Music (For a Film), Nude, Lotus Flower, Bloom, There There**. Together with the original six studies, the library now contains fifteen songs plus three original sketches. Existing preset indices were preserved so older projects still identify their songs correctly.

Each new study has four main pad shapes, a written loop, a verified official recording target, source-linked harmony notes, and three practice exercises. Its practice sequence isolates the voicings, rhythm/pulse, and combined layers. These short routes are explicitly labeled practice sequences, not full-song forms. Idioteque and Everything in Its Right Place retain their longer full practice arrangements.

The picked-string instrument now uses a synthesized damped-string model with fractional delay, a bounded buffer cache and slight strumming between chord notes. Piano playback retains the recordings’ own decay, with a brief release instead of an additional exponential fade over the whole note. There There introduces the fourth kit, Toms & sticks, with distinct pitched high/low toms.

15 Step uses a five-quarter-note teaching grid; Daydreaming and Nude use three-quarter-note teaching grids. These are arrangements for this instrument, with simplified motifs and percussion. Meter is saved in project files and governs bar length, beat labels, click accents and count-in. The longest supported loop is 320 sixteenth-note steps (sixteen five-beat bars).

Library search matches title, album, instrument and description tags. Album and search filters can be combined. Editing or manually changing pages turns Follow off; re-enable it to return to the currently playing page. The quick library keeps the selected song in view.

Package with `python3 scripts/package.py`. This refreshes `dist/` and the bundled HTML from the same source without a hardcoded cache-version suffix. Publication still pushes and archives the exact committed source using the existing Sites project identity.

## Reliability and usability audit

See `AUDIT.md` for the findings and verification. Pending audio starts can be cancelled, sample/project Undo restores audio as well as patterns, Save works with power off, and the status badge identifies storage failures. Resized rebuild references include note lengths, layer indicators reflect solos, and reference A/B bounds stay valid. The rhythm grid and paging controls have larger touch targets; advanced instrument preview rows support keyboard activation. Existing projects and all fifteen song studies remain compatible.
