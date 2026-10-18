# Undertow audit — 18 October 2026

The audit focused on playback, project/audio integrity, the two editors, reference recordings, accessible controls and the responsive Macintosh interface. The fifteen song studies and existing project format are retained.

| Finding | Change | Verification |
| --- | --- | --- |
| A pending audio start could complete after Stop; repeated Play could create overlapping starts. | Cancel pending transport requests, allow only one active scheduler, and show a cancellable starting state. Pause retains the next queued position. | Reproduced with delayed audio activation; Stop and double-Play regression checks pass. |
| Imported sound was absent from Undo snapshots, and sample import did not create an Undo entry. | Undo retains the prior audio bytes and decoded buffer alongside the pattern. It restores the browser audio store too. | Import two distinct WAV files, undo sample/project replacement, export and reload; verify the recovered bytes. |
| Slow file imports could finish after a newer file choice or Undo. | Apply only the latest import request; project changes invalidate pending file loads. | A delayed project decode cannot overwrite a subsequent sample selection. |
| Saving required powered-on Web Audio. | Save the project and retained sample bytes without starting audio. | Powered-off and reloaded-session downloads preserve the exact imported WAV. |
| The interface claimed autosaving even when storage failed. | Distinguish ready, saved, project-copy-needed and audio-copy-needed states. | Simulated localStorage and IndexedDB failures; portable audio project saving remains available. |
| Layer buttons could disagree with audible mute/solo state. | Keep layer states synchronized with pad audition, mixer changes and solos; clicking a solo-silenced layer enables it. | Pad-unmute and solo/layer regression checks pass. |
| Resizing a loop did not repeat reconstruction references; Clear/Restore did not manage held-note lengths. | Repeat source patterns and holds together. Clear/remove resets lengths; rebuilding/restoring recovers them. | Rebuild Idioteque into an expanded page and verify its long-note durations. |
| Reference A/B buttons could leave invalid bounds, and short loops relied on coarse media events. | Normalize both bounds after manual changes and button presses, start inside the range, and check boundaries on animation frames. | A 200 ms reference loop stayed within the tested passage; bounds remain valid when A/B cross. |
| Preview row labels were inaccessible to keyboard users; several touch targets were small. | Use native preview buttons, enlarge grid/paging/close targets and label Follow playback. | Keyboard activation and responsive checks at 320–1440 px. |
| Meter refreshes allocated a new buffer every frame; faded pad previews retained redundant timers. | Reuse the meter buffer, refresh meters at up to 30 Hz and release obsolete preview timers. | Existing audio, pad and export checks pass. |

## Verification

Passed the targeted audit suite plus the existing machine, Macintosh, library, studies, lessons and recording-integration suites. This includes all fifteen studies, twelve rhythm starters, saved-project compatibility, imported samples, complete Idioteque practice export, odd-meter loops and layouts at phone/iPad/desktop widths. The exact `dist/` build and bundled HTML edition were smoke-tested and screenshots inspected.

Checks ran in Chromium with touch emulation and simulated audio/storage failures. Physical iPad Safari, Apple Pencil pressure and third-party YouTube playback still require device/provider verification. The editable music remains source-linked teaching arrangements and original variations; this audit does not establish album transcription accuracy.
