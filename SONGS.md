# Songs: how they are written and how close they are

Every song lives in `src/songs.js` as plain text, so a wrong chord or rhythm can be fixed by ear without touching the engine.

## Format

```js
chords: {
  'Am': 'A1 A2 | A3 C4 E4',   // bass notes | upper notes; pads play both
},
parts: [{
  id: 'piano', name: 'Piano', instrument: 'piano', length: 16, learn: true,
  notes: `
    0    A1 A2   2    0.65    // beat, notes, length in beats, velocity 0–1
    0    [Am]    0.9  0.8     // [Am] = the chord's upper notes
  `,
}, {
  id: 'drums', name: 'Drums', kit: 'soft',
  drums: { kick: 'x.......x.......' },   // one character per sixteenth: X x o .
}]
```

`bars` lists the bar lengths in beats (`[4, 6]` for Everything In Its Right Place). The loop is the shortest length that every part fits into. Instruments: `piano`, `prophet`, `lansky`, `epiano`, `musicbox`, `organ`, `guitar`, `bass`. Kits: `machine`, `electro`, `soft`.

Players can also correct a part in the app: record it as they hear it, then choose **Use as Part** in the Takes window. That edit is stored in the browser, not in this file.

## How close each song is

These are synthesised arrangements of short passages. They are not transcriptions of the records and they are not the original sounds.

| Song | Checked against sources | Reconstructed |
| --- | --- | --- |
| Everything In Its Right Place | C, D♭maj7, E♭6 with a high C on top; ten-beat (4 + 6) cycle; 124 BPM. Sound after published Prophet-5 recreations: pulse waves, closed resonant filter swept per key, long decay, two takes panned hard left and right, about 19 cents flat | Stab rhythm (no source gives it note for note) and voicing spacing |
| Idioteque | Four E♭maj7 voicings, five-bar cycle (Ali Jamieson) | Six-beat drum pattern, pad sound |
| Karma Police | Am, D/F♯, Em, G, Am, F, Em, G | Voicings, repeated-chord rhythm, light drums |
| Pyramid Song | 3 + 3 + 4 + 3 + 3 rhythm; F♯, Gmaj7, A6 with a high F♯ | Which chord falls on each hit; tempo |
| Codex | C, B♭add9, Dm | Pulse, chord lengths and tempo |
| Videotape | A, C♯m, E cycle, key of A, about 72 BPM | Steady chord pulse and voicings (the record's changes feel pushed early) |
| True Love Waits | C, E/C, Am, A♭ cycle; C at about 69 BPM (from live and arranged versions) | The two interlocking piano parts |
| Motion Picture Soundtrack | G, C, Bm, C | Organ voicing, chord lengths, tempo |

**Held back:** No Surprises and 15 Step did not sound like the records when checked by ear. Their data is kept in `UNCHECKED_SONGS` in `src/songs.js`; correct the recognisable riffs (the No Surprises guitar and glockenspiel line, the 15 Step beat and guitar figure) and move them back into `SONGS`.

## Records

When a loaded record matches a song here (by file name, or chosen in the record's Song menu), Play Along repeats that song's chord loop along the record from where the music starts, at the song's `bpm`. The chord changes come from the part marked `learn: true`. The player can line it up with Set Start, nudge the tempo, or mark the chords themselves; the chart only covers the passage written here, so other sections of the record may differ.

Source links are in each song's `sources` and its Get Info window. Before adding a song or changing one, check it against at least one published analysis and say in `accuracy` what is checked and what is not.
