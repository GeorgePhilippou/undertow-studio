// Song data for Undertow.
//
// Every part is written as plain text so it can be corrected by ear.
//
//   chords:  name -> 'bass notes | upper notes'. Pads play the whole chord.
//   notes:   one line per attack:  <beat> <notes or [Chord]> <length> [velocity]
//            beats count from 0 at the start of the loop; [Chord] means the
//            chord\'s upper notes; plain note names are written like C4, F#2, Bb3.
//   drums:   one string per voice, one character per sixteenth note.
//            X loud, x normal, o soft, . rest; | is only a visual bar line.
//
// "accuracy" tells the player how much of each song is checked against
// published analyses and how much is a best reconstruction. No recordings
// or vocals are included.

export const SONGS = [
  {
    id: 'everything',
    legacyIndex: 4,
    title: 'Everything In Its Right Place',
    album: 'Kid A',
    year: 2000,
    bpm: 124,
    bars: [4, 6],
    key: 'C, D♭, E♭',
    youtube: 'd9zk2j3JPK4',
    about: 'The opening keyboard figure. A bar of four and a bar of six make a ten-beat cycle, and the high C stays on top of every chord.',
    accuracy: 'Chords and the ten-beat cycle follow published analyses (C, D♭maj7, E♭6 with a high C pedal; 124 BPM). The stab rhythm is a reconstruction.',
    sources: [
      ['Ali Jamieson — chord analysis', 'https://alijamieson.co.uk/2015/04/09/chord-of-the-day-everything-in-its-right-place/'],
    ],
    chords: {
      'C': 'C2 | E3 G3 C4',
      'D♭maj7': 'Db2 | F3 Ab3 C4',
      'E♭6': 'Eb2 | G3 Bb3 C4',
    },
    parts: [
      {
        id: 'keys', name: 'Keyboard', instrument: 'prophet', length: 10, learn: true,
        notes: `
          0     C2 [C]        0.6   0.85
          0.75  C2 [C]        0.6   0.6
          1.5   C2 [C]        0.45  0.7
          2     Db2 [D♭maj7]  0.6   0.85
          2.75  Db2 [D♭maj7]  0.6   0.6
          3.5   Db2 [D♭maj7]  0.45  0.7
          4     Eb2 [E♭6]     0.6   0.85
          4.75  Eb2 [E♭6]     0.6   0.6
          5.5   Eb2 [E♭6]     0.45  0.7
          6     Eb2 [E♭6]     0.6   0.8
          6.75  Eb2 [E♭6]     0.6   0.6
          7.5   Eb2 [E♭6]     0.45  0.7
          8     Eb2 [E♭6]     0.6   0.8
          8.75  Eb2 [E♭6]     0.6   0.6
          9.5   Eb2 [E♭6]     0.45  0.7
        `,
      },
    ],
  },

  {
    id: 'idioteque',
    legacyIndex: 3,
    title: 'Idioteque',
    album: 'Kid A',
    year: 2000,
    bpm: 138,
    bars: [4],
    key: 'E♭maj7',
    youtube: 'svwJTnZOaco',
    about: 'Four voicings of one E♭maj7 chord over five bars, against a drum cycle that repeats every six beats. They line up again after fifteen bars.',
    accuracy: 'The four E♭maj7 voicings follow Ali Jamieson\'s analysis of the sampled chords. The drum pattern is a six-beat reconstruction, not a transcription.',
    sources: [
      ['Ali Jamieson — Idioteque', 'https://alijamieson.co.uk/2017/12/12/radiohead-idioteque/'],
    ],
    chords: {
      'E♭maj7 i': '| G3 D4 Bb4 Eb5',
      'E♭maj7 ii': '| Eb3 Bb3 D5 G5',
      'E♭maj7 iii': '| G3 D4 Eb5 Bb5',
      'E♭maj7 iv': '| Eb3 Bb3 G5 D6',
    },
    parts: [
      {
        id: 'keys', name: 'Chords', instrument: 'lansky', length: 20, learn: true,
        notes: `
          0    [E♭maj7 i]    3.9  0.8
          4    [E♭maj7 ii]   3.9  0.8
          8    [E♭maj7 iii]  3.9  0.8
          12   [E♭maj7 iv]   7.9  0.8
        `,
      },
      {
        id: 'drums', name: 'Drums', kit: 'machine',
        drums: {
          kick:  'x.......x.....x.|x.......',
          snare: '....x.......x...|....x...',
          hat:   'x.o.x.o.x.o.x.o.|x.o.x.o.',
          perc:  '...o.......o....|...o..o.',
        },
      },
    ],
  },

  {
    id: 'karma',
    legacyIndex: 5,
    title: 'Karma Police',
    album: 'OK Computer',
    year: 1997,
    bpm: 75,
    bars: [4],
    key: 'A minor',
    youtube: '1uYWYWPc9HU',
    about: 'The opening piano: Am, D/F♯, Em, G, then Am, F, Em, G. Two beats for each chord, with the bass walking down underneath.',
    accuracy: 'The chord sequence matches published charts. The voicings and the repeated-chord rhythm are a piano reconstruction.',
    sources: [
      ['Heartwood Guitar — chord chart', 'https://www.heartwoodguitar.com/chords/radiohead-karma-police/'],
      ['Cifra Club — chords', 'https://www.cifraclub.com/radiohead/karma-police/'],
    ],
    chords: {
      'Am': 'A1 A2 | A3 C4 E4',
      'D/F♯': 'F#1 F#2 | A3 D4 F#4',
      'Em': 'E1 E2 | G3 B3 E4',
      'G': 'G1 G2 | G3 B3 D4',
      'F': 'F1 F2 | A3 C4 F4',
    },
    parts: [
      {
        id: 'piano', name: 'Piano', instrument: 'piano', length: 16, learn: true,
        notes: `
          0    A1 A2      2    0.65
          0    [Am]       0.9  0.8
          1    [Am]       0.9  0.5
          2    F#1 F#2    2    0.65
          2    [D/F♯]     0.9  0.8
          3    [D/F♯]     0.9  0.5
          4    E1 E2      2    0.65
          4    [Em]       0.9  0.8
          5    [Em]       0.9  0.5
          6    G1 G2      2    0.65
          6    [G]        0.9  0.8
          7    [G]        0.9  0.5
          8    A1 A2      2    0.65
          8    [Am]       0.9  0.8
          9    [Am]       0.9  0.5
          10   F1 F2      2    0.65
          10   [F]        0.9  0.8
          11   [F]        0.9  0.5
          12   E1 E2      2    0.65
          12   [Em]       0.9  0.8
          13   [Em]       0.9  0.5
          14   G1 G2      2    0.65
          14   [G]        0.9  0.8
          15   [G]        0.9  0.5
        `,
      },
      {
        id: 'drums', name: 'Drums', kit: 'soft', volume: 0.55,
        drums: {
          kick:  'x.......x.......',
          snare: '....o.......o...',
          hat:   'o.o.o.o.o.o.o.o.',
        },
      },
    ],
  },

  {
    id: 'pyramid',
    legacyIndex: 8,
    title: 'Pyramid Song',
    album: 'Amnesiac',
    year: 2001,
    bpm: 77,
    bars: [4],
    key: 'F♯',
    youtube: '3M_Gg1xAHE4',
    about: 'The floating piano figure: five chords grouped 3 + 3 + 4 + 3 + 3 eighth notes across two bars, with F♯ held on top.',
    accuracy: 'The 3+3+4+3+3 rhythm and the F♯ → Gmaj7 → A6 → Gmaj7 movement follow published breakdowns. The exact chord on each hit and the tempo are best estimates.',
    sources: [
      ['Melodics — the rhythm of Pyramid Song', 'https://melodics.com/blog/breaking-down-the-rhythm-of-pyramid-song-by-radiohead'],
      ['Songsterr — chords', 'https://www.songsterr.com/a/wsa/radiohead-pyramid-song-chords-s51267'],
    ],
    chords: {
      'F♯': 'F#1 F#2 | A#3 C#4 F#4',
      'Gmaj7': 'G1 G2 | B3 D4 F#4',
      'A6': 'A1 A2 | C#4 E4 F#4',
    },
    parts: [
      {
        id: 'piano', name: 'Piano', instrument: 'piano', length: 8, learn: true,
        notes: `
          0    F#1 F#2 [F♯]    1.45  0.8
          1.5  G1 G2 [Gmaj7]   1.45  0.7
          3    A1 A2 [A6]      1.95  0.8
          5    G1 G2 [Gmaj7]   1.45  0.7
          6.5  F#1 F#2 [F♯]    1.45  0.65
        `,
      },
    ],
  },

  {
    id: 'codex',
    legacyIndex: null,
    title: 'Codex',
    album: 'The King of Limbs',
    year: 2011,
    bpm: 64,
    bars: [4],
    key: 'D minor',
    youtube: null,
    about: 'Slow piano chords: C, B♭add9 and D minor, repeated in a steady pulse.',
    accuracy: 'The three chords (C, B♭add9, Dm) follow published charts. The pulse, the length of each chord and the tempo are estimates. Correct them by recording your own take.',
    sources: [
      ['Howard Wright — Codex', 'https://www.hakwright.co.uk/music/tab/codex.txt'],
    ],
    chords: {
      'C': 'C2 | G3 C4 E4',
      'B♭add9': 'Bb1 | F3 Bb3 C4 D4',
      'Dm': 'D2 | F3 A3 D4',
    },
    parts: [
      {
        id: 'piano', name: 'Piano', instrument: 'piano', length: 16, learn: true,
        notes: `
          0    C2 [C]           1    0.7
          1    [C]              1    0.45
          2    [C]              1    0.55
          3    [C]              1    0.45
          4    Bb1 [B♭add9]     1    0.7
          5    [B♭add9]         1    0.45
          6    [B♭add9]         1    0.55
          7    [B♭add9]         1    0.45
          8    D2 [Dm]          2    0.7
          10   [Dm]             1    0.45
          11   [Dm]             1    0.5
          12   D2 [Dm]          2    0.6
          14   [Dm]             1    0.45
          15   [Dm]             1    0.4
        `,
      },
    ],
  },

  {
    id: 'nosurprises',
    legacyIndex: 6,
    title: 'No Surprises',
    album: 'OK Computer',
    year: 1997,
    bpm: 76,
    bars: [4],
    key: 'F major',
    youtube: 'u5CVsCnxyXg',
    about: 'The lullaby introduction: F major turning to B-flat minor, with a glockenspiel line ringing over the chords.',
    accuracy: 'The F to B-flat minor introduction, the key of F and 76 BPM match published chord charts. The glockenspiel pattern and the chord rhythm are reconstructions.',
    sources: [
      ['E-Chords - chords', 'https://www.e-chords.com/chords/radiohead/no-surprises'],
      ['Ultimate Guitar - chords', 'https://tabs.ultimate-guitar.com/tab/radiohead/no-surprises-chords-1050911'],
    ],
    chords: {
      'F': 'F2 | F3 A3 C4',
      'B♭m': 'F2 | F3 Bb3 Db4',
    },
    parts: [
      {
        id: 'chords', name: 'Chords', instrument: 'epiano', length: 8, learn: true,
        notes: `
          0    F2 [F]       1.9  0.7
          2    [F]          1.9  0.5
          4    F2 [B♭m]     1.9  0.7
          6    [B♭m]        1.9  0.5
        `,
      },
      {
        id: 'glock', name: 'Glockenspiel', instrument: 'musicbox', length: 8, volume: 0.8,
        notes: `
          0    C6   0.5  0.7
          0.5  A5   0.5  0.5
          1    F5   0.5  0.55
          1.5  A5   0.5  0.5
          2    C6   0.5  0.65
          2.5  A5   0.5  0.5
          3    F5   0.5  0.55
          3.5  A5   0.5  0.5
          4    Db6  0.5  0.7
          4.5  Bb5  0.5  0.5
          5    F5   0.5  0.55
          5.5  Bb5  0.5  0.5
          6    Db6  0.5  0.65
          6.5  Bb5  0.5  0.5
          7    F5   0.5  0.55
          7.5  Bb5  0.5  0.5
        `,
      },
    ],
  },

  {
    id: 'videotape',
    legacyIndex: null,
    title: 'Videotape',
    album: 'In Rainbows',
    year: 2007,
    bpm: 72,
    bars: [4],
    key: 'A major',
    youtube: null,
    about: 'The closing piano: A, C-sharp minor, E and back to A, in steady repeated chords with E ringing on top.',
    accuracy: 'The A, C#m, E cycle, the key of A and about 72 BPM follow Hooktheory and published chord charts. The steady chord pulse and voicings are a reconstruction; on the record the changes famously feel pushed half a beat early.',
    sources: [
      ['Hooktheory - Videotape', 'https://www.hooktheory.com/theorytab/view/radiohead/videotape'],
      ['Songsterr - chords', 'https://www.songsterr.com/a/wsa/radiohead-videotape-chords-s51307'],
      ['Open Culture - the secret rhythm', 'https://openculture.com/2017/08/the-secret-rhythm-behind-radioheads-videotape-now-finally-revealed.html'],
    ],
    chords: {
      'A': 'A1 A2 | E3 A3 C#4 E4',
      'C#m': 'C#2 C#3 | E3 G#3 C#4 E4',
      'E': 'E1 E2 | E3 G#3 B3 E4',
    },
    parts: [
      {
        id: 'piano', name: 'Piano', instrument: 'piano', length: 16, learn: true,
        notes: `
          0    A1 A2 [A]       1    0.7
          1    [A]             1    0.45
          2    [A]             1    0.55
          3    [A]             1    0.45
          4    C#2 C#3 [C#m]   1    0.7
          5    [C#m]           1    0.45
          6    [C#m]           1    0.55
          7    [C#m]           1    0.45
          8    E1 E2 [E]       1    0.7
          9    [E]             1    0.45
          10   [E]             1    0.55
          11   [E]             1    0.45
          12   A1 A2 [A]       1    0.65
          13   [A]             1    0.45
          14   [A]             1    0.5
          15   [A]             1    0.4
        `,
      },
    ],
  },

  {
    id: 'truelove',
    legacyIndex: null,
    title: 'True Love Waits',
    album: 'A Moon Shaped Pool',
    year: 2016,
    bpm: 69,
    bars: [4],
    key: 'C',
    youtube: null,
    about: 'The layered pianos of the album version: C, an aching E over C, A minor and A-flat, one chord to a bar.',
    accuracy: 'The chord cycle (C, E/C, Am, A-flat) comes from published charts of live versions and a piano arrangement in C at 69 BPM. The two interlocking piano parts are a reconstruction of the album texture.',
    sources: [
      ['Songsterr - live chords', 'https://www.songsterr.com/a/wsa/radiohead-true-love-waits-live-in-oslo-chords-s17090'],
      ['Super Simple Piano - arrangement', 'https://www.supersimplepiano.com/player/true-love-waits-852847401157962683/leadsheet'],
    ],
    chords: {
      'C': 'C2 | E3 G3 C4',
      'E/C': 'C2 | E3 G#3 B3',
      'Am': 'A1 | E3 A3 C4',
      'A♭maj7': 'Ab1 | Eb3 G3 C4',
    },
    parts: [
      {
        id: 'piano', name: 'Piano', instrument: 'piano', length: 16, learn: true,
        notes: `
          0    C2 [C]          3.9  0.65
          4    C2 [E/C]        3.9  0.65
          8    A1 [Am]         3.9  0.65
          12   Ab1 [A♭maj7]    3.9  0.65
        `,
      },
      {
        id: 'piano2', name: 'Second Piano', instrument: 'piano', length: 16, volume: 0.7,
        notes: `
          0    G4   0.5  0.45
          0.5  C5   0.5  0.4
          1    E5   1    0.45
          2    C5   0.5  0.4
          2.5  G4   1.5  0.4
          4    G#4  0.5  0.45
          4.5  B4   0.5  0.4
          5    E5   1    0.45
          6    B4   0.5  0.4
          6.5  G#4  1.5  0.4
          8    A4   0.5  0.45
          8.5  C5   0.5  0.4
          9    E5   1    0.45
          10   C5   0.5  0.4
          10.5 A4   1.5  0.4
          12   G4   0.5  0.45
          12.5 C5   0.5  0.4
          13   Eb5  1    0.45
          14   C5   0.5  0.4
          14.5 G4   1.5  0.4
        `,
      },
    ],
  },

  {
    id: 'fifteenstep',
    legacyIndex: 9,
    title: '15 Step',
    album: 'In Rainbows',
    year: 2007,
    bpm: 184,
    bars: [5],
    key: 'G# minor',
    youtube: 'xpqk9MD6vLM',
    about: 'A beat in five: kick on 1 and 4, snare and claps on the and of 2 and 5. Play the drums yourself, or the chords over them.',
    accuracy: 'The 5/4 meter, G# minor and about 184 BPM match published sheet music; the kick and snare placement follows a published groove analysis, and the bass stresses B on each downbeat as described by Bass Magazine. The chord order and the hi-hats are a reconstruction from community tabs.',
    sources: [
      ['Musicnotes - published sheet music', 'https://www.musicnotes.com/sheetmusic/radiohead/15-step/MN0103664'],
      ['Sunhouse - grooves in five', 'https://sunhou.se/blog/dive-into-five'],
      ['Bass Magazine - Colin Greenwood bass lines', 'https://bassmagazine.com/transcription-colin-greenwoods-radiohead-bass-line/'],
    ],
    chords: {
      'G#m': '| G#3 B3 D#4',
      'C#': '| G#3 C#4 F4',
      'D#m': '| A#3 D#4 F#4',
    },
    parts: [
      {
        id: 'drums', name: 'Drums', kit: 'electro', learn: true,
        drums: {
          kick:  'x...........x.......',
          snare: '......x...........x.',
          clap:  '......x...........x.',
          hat:   'o.o.o.o.o.o.o.o.o.o.',
        },
      },
      {
        id: 'keys', name: 'Chords', instrument: 'epiano', length: 20, volume: 0.75,
        notes: `
          0    [G#m]   0.5  0.65
          1.5  [G#m]   0.5  0.5
          3    [G#m]   0.5  0.55
          5    [C#]    0.5  0.65
          6.5  [C#]    0.5  0.5
          8    [C#]    0.5  0.55
          10   [D#m]   0.5  0.65
          11.5 [D#m]   0.5  0.5
          13   [D#m]   0.5  0.55
          15   [C#]    0.5  0.65
          16.5 [C#]    0.5  0.5
          18   [C#]    0.5  0.55
        `,
      },
      {
        id: 'bass', name: 'Bass', instrument: 'bass', length: 5, volume: 0.8,
        notes: `
          0    B1    1    0.75
          2.5  G#1   0.5  0.55
          3.5  D#2   0.5  0.5
        `,
      },
    ],
  },

  {
    id: 'motionpicture',
    legacyIndex: null,
    title: 'Motion Picture Soundtrack',
    album: 'Kid A',
    year: 2000,
    bpm: 70,
    bars: [4],
    key: 'G',
    youtube: null,
    about: 'The closing hymn of Kid A on a wheezing organ: G, C, B minor, C.',
    accuracy: 'The G, C, Bm, C progression follows published commentary and chord charts. The organ voicing, one chord to a bar and the tempo are estimates.',
    sources: [
      ['Audiofanzine - Thom Yorke\'s chords', 'https://en.audiofanzine.com/music-theory/editorial/articles/instruction/thom-yorke-s-signature-strange-chords.html'],
      ['Guitar Tabs Explorer - chords', 'https://www.guitartabsexplorer.com/radiohead/motion-picture-soundtrack-acoustic-chords'],
    ],
    chords: {
      'G': 'G1 G2 | B3 D4 G4',
      'C': 'C2 C3 | C4 E4 G4',
      'Bm': 'B1 B2 | B3 D4 F#4',
    },
    parts: [
      {
        id: 'organ', name: 'Organ', instrument: 'organ', length: 16, learn: true,
        notes: `
          0    G1 G2 [G]     3.9  0.7
          4    C2 C3 [C]     3.9  0.7
          8    B1 B2 [Bm]    3.9  0.7
          12   C2 C3 [C]     3.9  0.7
        `,
      },
    ],
  }

];

// ---------------------------------------------------------------------------
// Parsing

const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE = /^([A-G])(#|b|♯|♭)?(-?\d)$/;
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function noteNumber(name) {
  const match = NOTE.exec(name);
  if (!match) return null;
  const accidental = { '#': 1, '♯': 1, b: -1, '♭': -1 }[match[2]] || 0;
  return (Number(match[3]) + 1) * 12 + LETTERS[match[1]] + accidental;
}

export function noteName(midi, withOctave = true) {
  return NAMES[midi % 12] + (withOctave ? Math.floor(midi / 12) - 1 : '');
}

function parseNotes(text) {
  return text.trim().split(/\s+/).filter(Boolean).map(name => {
    const midi = noteNumber(name);
    if (midi === null) throw new Error(`Unknown note "${name}"`);
    return midi;
  });
}

export function parseChord(text) {
  const [bass, upper] = text.includes('|') ? text.split('|') : ['', text];
  return { bass: parseNotes(bass), upper: parseNotes(upper) };
}

function parseLine(line, chords) {
  // Chord names may contain spaces; protect them while splitting the line.
  const tokens = line.replace(/\[([^\]]+)\]/g, (_, name) => `[${name.replace(/ /g, '~')}]`).trim().split(/\s+/);
  const beat = Number(tokens.shift());
  const numbers = [];
  while (tokens.length && /^\d*\.?\d+$/.test(tokens.at(-1))) numbers.unshift(Number(tokens.pop()));
  const notes = [];
  let chord = null;
  for (const token of tokens) {
    if (token.startsWith('[')) {
      chord = token.slice(1, -1).replace(/~/g, ' ');
      if (!chords[chord]) throw new Error(`Unknown chord "${chord}"`);
      notes.push(...chords[chord].upper);
    } else {
      notes.push(...parseNotes(token));
    }
  }
  return { beat, notes, length: numbers[0] ?? 1, velocity: numbers[1] ?? 0.75, chord };
}

const DRUM_LEVELS = { X: 1, x: 0.8, o: 0.45 };

function parseDrums(lanes) {
  const events = [];
  let length = 0;
  for (const [voice, pattern] of Object.entries(lanes)) {
    const steps = pattern.replace(/\|/g, '');
    length = Math.max(length, steps.length / 4);
    [...steps].forEach((char, step) => {
      if (DRUM_LEVELS[char]) events.push({ beat: step / 4, drum: voice, velocity: DRUM_LEVELS[char], length: 0.25, notes: [] });
    });
  }
  return { events, length };
}

// Turns text data into playable parts with events sorted by beat.
export function prepareSong(song) {
  const chords = Object.fromEntries(Object.entries(song.chords || {}).map(([name, text]) => [name, parseChord(text)]));
  const parts = song.parts.map(part => {
    if (part.events) return { volume: 1, ...part };
    if (part.drums) {
      const { events, length } = parseDrums(part.drums);
      return { volume: 1, ...part, kind: 'drums', events, length: part.length || length };
    }
    const events = (part.notes || '').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'))
      .map(line => parseLine(line, chords));
    return { volume: 1, ...part, kind: 'notes', events };
  });
  for (const part of parts) part.events.sort((a, b) => a.beat - b.beat);
  const barLengths = song.bars || [4];
  const cycle = barLengths.reduce((a, b) => a + b, 0);
  const loop = song.loop || leastCommonLength(parts.map(p => p.length), cycle);
  return { ...song, chords, parts, loop, barLengths, cycle };
}

function leastCommonLength(lengths, cycle) {
  const gcd = (a, b) => (b < 1e-6 ? a : gcd(b, a % b));
  let result = cycle;
  for (const length of lengths) {
    if (!length) continue;
    result = (result * length) / gcd(result, length);
    if (result > 96) return Math.max(...lengths.filter(Boolean), cycle);
  }
  return Math.round(result * 1000) / 1000;
}

// Bar and beat for a position inside the loop, using the song\'s bar pattern.
export function barBeat(song, beat) {
  const cycles = Math.floor(beat / song.cycle);
  let rest = beat - cycles * song.cycle;
  let bar = cycles * song.barLengths.length;
  for (const length of song.barLengths) {
    if (rest < length) break;
    rest -= length;
    bar++;
  }
  return { bar: bar + 1, beat: Math.floor(rest) + 1 };
}

// Bar start positions within [0, loop).
export function barLines(song) {
  const lines = [];
  let beat = 0;
  for (let i = 0; beat < song.loop - 1e-6; i++) {
    lines.push(beat);
    beat += song.barLengths[i % song.barLengths.length];
  }
  return lines;
}

// Events of one part repeated across the song loop.
export function loopEvents(song, part) {
  const events = [];
  const length = part.length || song.loop;
  for (let offset = 0; offset < song.loop - 1e-6; offset += length) {
    for (const event of part.events) {
      if (event.beat + offset < song.loop - 1e-6) events.push({ ...event, beat: event.beat + offset });
    }
  }
  return events;
}

// Chords in order of first appearance in a part, with pad voicings.
export function padsFor(song, part) {
  if (!part || part.kind !== 'notes') return [];
  const names = [];
  for (const event of part.events) if (event.chord && !names.includes(event.chord)) names.push(event.chord);
  return names.map(name => ({ name, notes: [...song.chords[name].bass, ...song.chords[name].upper] }));
}

export function blankSong(options) {
  const beatsPerBar = options.beatsPerBar || 4;
  const length = beatsPerBar * (options.barCount || 4);
  return {
    id: options.id,
    custom: true,
    title: options.title || 'Untitled',
    album: 'My songs',
    year: new Date().getFullYear(),
    bpm: options.bpm || 90,
    bars: [beatsPerBar],
    key: '',
    about: 'Your own song. Record a part, then choose Use as Part to keep it.',
    accuracy: '',
    sources: [],
    chords: {},
    parts: [
      { id: 'keys', name: 'Keys', instrument: options.instrument || 'piano', length, learn: true, notes: '' },
      { id: 'bass', name: 'Bass', instrument: 'bass', length, notes: '' },
      { id: 'drums', name: 'Drums', kit: 'electro', length, drums: { kick: '', snare: '', hat: '', clap: '' } },
    ],
  };
}
