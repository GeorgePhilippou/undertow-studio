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

`bars` lists the bar lengths in beats (`[4, 6]` for Everything In Its Right Place). The loop is the shortest length that every part fits into. Instruments: `piano`, `prophet`, `lansky`, `epiano`, `musicbox`, `organ`, `bass`. Kits: `machine`, `electro`, `soft`.

Players can also correct a part in the app: record it as they hear it, then choose **Use as Part** in the Takes window. That edit is stored in the browser, not in this file.

## How close each song is

These are synthesised arrangements of short passages. They are not transcriptions of the records and they are not the original sounds.

| Song | Checked against sources | Reconstructed |
| --- | --- | --- |
| Everything In Its Right Place | C, D♭maj7, E♭6 with a high C on top; ten-beat (4 + 6) cycle; about 124 BPM | Stab rhythm and voicing spacing |
| Idioteque | Four E♭maj7 voicings, five-bar cycle (Ali Jamieson) | Six-beat drum pattern, pad sound |
| Karma Police | Am, D/F♯, Em, G, Am, F, Em, G | Voicings, repeated-chord rhythm, light drums |
| Pyramid Song | 3 + 3 + 4 + 3 + 3 rhythm; F♯, Gmaj7, A6 with a high F♯ | Which chord falls on each hit; tempo |
| Codex | C, B♭add9, Dm | Pulse, chord lengths and tempo |

Source links are in each song's `sources` and its Get Info window. Before adding a song or changing one, check it against at least one published analysis and say in `accuracy` what is checked and what is not.
