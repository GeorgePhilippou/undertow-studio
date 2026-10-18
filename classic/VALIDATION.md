# Prototype validation

Validated in headless Chromium on 17 October 2026. Browser console reported no application errors during the tested flows.

- Audio unlocked on Play; transport advanced to step 7 after 900 ms at 108 BPM.
- Drum editor displayed 64 cells per bar; melodic editor displayed 128 cells per bar.
- Note toggle changed aria-pressed from false to true; Undo restored false.
- Audio import decoded a 20.78-second WAV, and sample pads played with reverse enabled.
- Mute updated its pressed state. Imported audio and project state survived a reload.
- Portable project export embedded imported audio. Reopening restored project title, sample name, and reverse state.
- Clear removed all visible sample notes; Undo restored the prior note.
- Help dialog opened successfully.
- Responsive widths of 1440, 834, and 390 pixels had no horizontal document overflow.
- Offline WAV export: 2 channels, 44,100 Hz, 20.78 seconds, 16-bit PCM. Peak 16,942/32,768 and RMS 1,853.57; output contains signal and does not clip.

Not verified: physical Apple Pencil pressure, Safari/iPad audio and download behavior, actual loudspeaker/headphone quality, or live GitHub Pages deployment. The GitHub integration rejected new repository creation with HTTP 403, “Resource not accessible by integration.”

## Radiohead Field Unit revision

- All six studies produced non-zero, unclipped output in offline audio rendering. Peak range: 0.129–0.401; RMS range: 0.015–0.039.
- Tested 40-step page limits, inactive last-page cells, rebuild/reference painting, undo, track restore, Solo Keys, project export/import with pitch palettes and chord voicings, and persistence after reload.
- Legacy prototype project import retained its original title, patterns and audio.
- Real-time playback and updated WAV export passed. Desktop and tablet widths of 1440, 1024, 834, and phone width of 390 had no horizontal overflow. No application errors were reported.
- Song studies are deliberately reduced arrangements; individual tape descriptions identify harmonic reductions and original arpeggio studies. They are not full transcriptions or recordings. Source links are available in the interface.

## Night School revision

- Six extended studies passed signal and clipping checks, legacy project import, project roundtrip, and responsive layouts.
- Idioteque patterns now span 240 steps; note holds preserve the two-bar final chord.
- Verified all 2,832 steps of the full practice route resolve to valid pattern positions and the event stream stops at its end.
- Browser tests cover exercises, speed, section selection, selected-track rebuilding and reconstruction score, complete reference-file import, playback rate, and A–B looping.
- Physical Safari/Pencil playback, pitch-preservation quality, and memory use on the user's iPad remain unverified. Source harmony and form were cross-checked; drum reconstruction and approximate section lengths are expressly labeled.

- Full Idioteque teaching-arrangement WAV export passed after switching to short cached render blocks: 311.83 seconds including tail, 44.1 kHz stereo, about 53 MB, with no clipped PCM samples. All six exercises, reference playback/A–B looping, speed changes, rebuild feedback, and both lesson timelines passed browser checks without application errors.

## Vintage Sound Machine revision

- Main-screen touch pad generated measurable audio (RMS ≈ 0.029), and immediate loop playback advanced the transport.
- Vertical dial dragging and keyboard arrows updated both instrument settings and visible hardware controls.
- Power switching disabled/enabled controls and audio correctly. Tape selection updated the LCD and closed the library.
- Lessons remained usable inside the modal panel. Studio checks passed for all six studies, project save/open, legacy sessions, rebuilding, audio output and WAV export.
- Main viewports of 1024×768 and 834×1194 fit on one screen. Phone portrait and landscape widths had no horizontal overflow.
- Physical Apple Pencil and Safari behavior remain unverified; pointer/touch and keyboard behavior were exercised in Chromium.

## Full-song reference and playing refinement (2026-10-18)

Passed `tests/machine.cjs`, `tests/studies.cjs`, `tests/lessons.cjs`, and `tests/refinement.cjs` in Chromium. Verified touch-pad audio, duplicate pointer/click suppression, keyboard pads and dials, drag controls, power, persistence, existing projects, practice lessons, reference-file speed/A–B loops, loop WAV and complete arrangement export. The final six-study signal checks load the piano assets; every study has measurable output and peak below 1. Sampled Karma Police chord: three sample voices, RMS 0.00742, peak 0.11513.

Verified six official recording IDs, privacy-enhanced embed URLs and direct links, stopping practice playback when opening the player, removing the iframe on close/Escape, and preventing global transport shortcuts inside it. Tested at 1024×768, 834×1194, 390×844 and 844×390. External player requests were intercepted for deterministic integration testing. YouTube playback itself could not be verified because the execution network rejects YouTube requests; actual embedding depends on YouTube availability. The fallback link remains visible. No original audio is included in project files or WAV exports.

The bundled prototype initializes nine tapes without browser errors. Six Salamander piano assets decode successfully. Piano license/source attribution is included in assets and the guide. Tests establish behavior and output/headroom, not album-level transcription accuracy or physical iPad Safari verification.

## Macintosh desktop and expanded music tools (2026-10-18)

Passed `tests/macintosh.cjs`, `tests/machine.cjs`, `tests/studies.cjs`, `tests/refinement.cjs`, and `tests/lessons.cjs` in Chromium. The Macintosh test verifies twelve distinct drum patterns, preservation of chord notes and holds during beat changes, three kit choices, instrument changes, fills and undo, 16–256 step loop resizing, persistence, native slider/keyboard controls, layer mutes, pad audio, power, transport, mobile library access and a finger swipe that scrolls the grid without editing it. Physical Apple Pencil pressure and iPad Safari remain unverified; pen input uses Pointer Events.

Offline renders of all twelve beats, all three kits, and seven engine voices produced finite, audible signals with peak below 1. The highest measured peak was 0.416. Six existing song studies remain audible and unclipped. Complete 2,832-step Idioteque lesson structure and full WAV export passed, along with reference-recording import, speed and A/B loop controls. Official-player tests verify integration and cleanup with third-party requests intercepted; provider playback remains subject to the existing YouTube verification limitation.

Visually inspected desktop, iPad, phone, and lesson-modal screenshots. Checked document width at 320, 390, 834, 844, 1024, 1280 and 1440 pixels across the browser checks. Narrow rhythm grids scroll inside the window. The menu bar stays visible with a Play/Pause control. External font imports were removed so the desktop uses system fonts. One-bar saved-project reload and the bundled prototype startup were also checked before publication.

## Fifteen-song library and instrument refinement (2026-10-18)

Passed `tests/library.cjs`, `tests/studies.cjs`, `tests/refinement.cjs`, `tests/macintosh.cjs`, `tests/lessons.cjs`, and `tests/machine.cjs`. Final sound-balance changes were followed by the complete library and original-study checks. New song indices append after the original six, preserving prior project identities.

Verified fifteen study cards plus three original sketches; search by title, album and instrument; album filters; empty results; all nine new pad palettes, written patterns, audible playback and recording-player targets; three-exercise workshops per new study; practice-sequence WAV export; the new high/low tom kit; persisted organ/tom settings; three- and five-beat meters; twelve-step and 320-step project reloads; pinned editing pages and Follow reactivation. Browser checks cover 320, 390, 834, 1024 and 1440 pixel widths. The original complete Idioteque lesson and full WAV export still pass.

Offline five-second renders of all nine new studies produced finite, audible output without clipping. The largest measured final peak was 0.387 (There There); the original six study checks also remained below 1. These tests establish signal/headroom and function, not perceptual identity with the albums. Source links identify the harmonic references, and each study explains its reductions and original variations. Recording-player integration is tested with third-party requests intercepted; external YouTube playback retains the provider/network limitation noted above.

Visually inspected the searchable desktop and phone libraries, the practice workshop, and the mobile main interface. The packaged static folder and bundled HTML were smoke-tested for eighteen library entries, filtering, the tom instrument and new workshops. Physical iPad Safari and Apple Pencil remain outside this executor’s verification.

## Playback, persistence and usability audit (2026-10-18)

Passed `tests/audit.cjs` and the existing `machine`, `macintosh`, `library`, `studies`, `lessons` and `refinement` browser suites after the main audit changes. Targeted audit checks include delayed-start cancellation/double-Play, accurate pad/mute/solo layer indicators, exact WAV byte recovery through sample and project Undo, powered-off Save and reload persistence, latest-import-wins under delayed decoding, held-note removal/restore, expanded-loop ghost references, keyboard preview buttons, valid reference A/B button bounds and short-loop playback, plus fallback project downloads when browser audio storage is unavailable.

The short reference-loop check used a two-second local WAV with A=1.0 and B=1.2 seconds. The final sampled loop maximum was below 1.2 seconds in the recorded run; the assertion permits a modest scheduling tolerance. Layout and storage-failure badge checks include 320, 390, 834 and 1024 px. Existing library checks cover 1440 px too. Offline audio/headroom, complete Idioteque export and legacy project roundtrips still pass. The packaged site and bundled edition were checked for fifteen studies and synchronized layer behavior; iPad, phone and workshop screenshots were inspected.

These are Chromium/emulated-touch and fault-injection checks. Physical iPad Safari/Pencil and external provider playback remain outside this executor's verification. Detailed findings and practical limits are in `AUDIT.md`.

## Guided sofa experience (2026-10-18)

Added `tests/sofa.cjs`: guided listening and layer isolation; backing events that omit programmed keys while live pads remain available; the actual audio scheduler at 75% speed; an 80-step Idioteque phrase wrapping from step 79 to 0 while the saved 240-step pattern stays intact; correct-pad cue advancement; tone reset without note loss; quiet-study click; transition to advanced lessons; 320–1024 px layouts; and smoke checks for both static and bundled editions. The cue checks teach the order of notes represented on the four pads, without claiming timing assessment or a complete transcription.

The `macintosh`, `audit`, `machine`, `refinement` and `library` regressions also passed during this change. Existing editor tests now explicitly open the folded beat drawer and use the visible layer cards. All fifteen studies, advanced lessons, sample/project recovery, output headroom and provider-modal cleanup remain covered by those suites. Visual checks inspect the phone and iPad layouts. Physical iPad Safari/Pencil and external YouTube playback remain unverified in this executor.

## Revised opening passages and timing guide (2026-10-18)

Added `tests/passages.cjs` covering Idioteque’s four chord arrivals and two-bar final hold, the shared upper C in all three Everything voicings, Karma Police’s corrected D/F♯ chord and second-phrase offset/pad map, drum-only passage filtering, audio-clock timing cues, independent memory mode and optional hints, non-destructive loop selection, explicit/reversible upgrades of older saved projects, three offline audio renders, responsive transport controls, and both deployable editions. The guide does not grade player timing or promise album synchronization.

The `sofa`, `machine`, `studies`, `lessons`, `macintosh`, `audit`, `library` and `refinement` regressions passed during the revision. Existing assertions were updated for the intentional one-bar chord arrivals, shared upper-C voicings, folded sound controls and single transport. Full teaching exports, sample/project recovery and the wider library continue to pass. Final transport positioning is checked on narrow screens to keep all four pads above the fixed bar in the focused playing view.

Eight-second stereo renders of the revised studies produced finite output with peaks around 0.405 / 0.129 / 0.248. These checks establish headroom and audibility, not perceptual equivalence. The original recording remains a separate provider-controlled comparison. Source rationale and reconstruction limits are in `SOUND_NOTES.md`. Physical iPad Safari/Pencil and third-party recording playback remain outside executor verification.
