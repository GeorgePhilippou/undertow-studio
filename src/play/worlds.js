// Sound worlds for the Play screen. Each is an original loop written in the
// manner of an album's sound - its instruments, tempo and harmonic colour -
// not a transcription of any song. The touch surface plays the world's scale,
// which fits every chord in its loop, so nothing played sounds wrong.
//
// Backing parts use the same plain-text format as src/songs.js.

// Interlocking guitar figures: one cycles three notes, the other four, so the
// pattern shifts against the beat.
function arpeggio(chords, size, offset, velocity) {
  const lines = [];
  chords.forEach(([name, notes], bar) => {
    for (let i = 0; i < 8; i++) {
      const beat = bar * 4 + i / 2 + offset;
      const note = notes[(bar * 8 + i) % size % notes.length];
      lines.push(`${beat} ${note} 0.7 ${i % size === 0 ? velocity + 0.12 : velocity}`);
    }
  });
  return lines.join('\n');
}

export const WORLDS = [
  {
    id: 'kida',
    title: 'Kid A',
    subtitle: 'Machines, glass chords and a singing electronic voice. Inspired by Kid A and Amnesiac.',
    art: 'signal',
    lead: 'ondes',
    glide: true,
    scale: [3, 5, 7, 10, 0, 2], // E-flat, F, G, B-flat, C, D
    low: 58, // B-flat 3
    song: {
      id: 'world-kida',
      title: 'Kid A world',
      bpm: 132,
      bars: [4],
      chords: {
        'E♭maj7': '| Eb3 G3 Bb3 D4',
        'Cm9': '| C3 Eb3 G3 Bb3 D4',
        'A♭maj7': '| Ab2 C3 Eb3 G3 D4',
        'Fm9': '| F2 Ab2 C3 Eb3 G3',
      },
      parts: [
        {
          id: 'pad', name: 'Glass chords', instrument: 'lansky', length: 16, volume: 0.8,
          notes: `
            0   [E♭maj7]  3.9  0.7
            4   [Cm9]     3.9  0.65
            8   [A♭maj7]  3.9  0.7
            12  [Fm9]     3.9  0.65
          `,
        },
        {
          id: 'bass', name: 'Bass', instrument: 'bass', length: 16, volume: 0.7,
          notes: `
            0    Eb2  0.9  0.7
            1.5  Eb2  0.4  0.5
            3    Bb1  0.9  0.55
            4    C2   0.9  0.7
            5.5  C2   0.4  0.5
            7    G1   0.9  0.55
            8    Ab1  0.9  0.7
            9.5  Ab1  0.4  0.5
            11   Eb2  0.9  0.55
            12   F1   0.9  0.7
            13.5 F1   0.4  0.5
            15   C2   0.9  0.55
          `,
        },
        {
          id: 'drums', name: 'Machine', kit: 'machine', volume: 0.75,
          drums: {
            kick:  'x.....x...x.....',
            snare: '....x.......x..o',
            hat:   'xoo.xo.ox.o.xo.o',
            perc:  '...o......o...o.',
          },
        },
      ],
    },
  },
  {
    id: 'okcomputer',
    title: 'OK Computer',
    subtitle: 'Electric piano, tape strings and a glockenspiel in a slow, glowing room. Inspired by OK Computer.',
    art: 'motorway',
    lead: 'epiano',
    glide: false,
    scale: [9, 0, 2, 4, 7], // A minor pentatonic
    low: 57, // A3
    song: {
      id: 'world-okcomputer',
      title: 'OK Computer world',
      bpm: 80,
      bars: [4],
      chords: {
        'Am': 'A2 | E3 A3 C4 E4',
        'F': 'F2 | F3 A3 C4 F4',
        'C': 'C3 | E3 G3 C4 E4',
        'G': 'G2 | D3 G3 B3 D4',
      },
      parts: [
        {
          id: 'strings', name: 'Tape strings', instrument: 'strings', length: 16, volume: 0.9,
          notes: `
            0   [Am]  3.9  0.7
            4   [F]   3.9  0.7
            8   [C]   3.9  0.7
            12  [G]   3.9  0.7
          `,
        },
        {
          id: 'rhodes', name: 'Electric piano', instrument: 'epiano', length: 16, volume: 0.55,
          notes: `
            0    A3   0.5  0.55
            0.5  C4   0.5  0.4
            1    E4   0.5  0.45
            1.5  C4   0.5  0.4
            2    A3   0.5  0.5
            2.5  C4   0.5  0.4
            3    E4   1    0.45
            4    F3   0.5  0.55
            4.5  A3   0.5  0.4
            5    C4   0.5  0.45
            5.5  A3   0.5  0.4
            6    F3   0.5  0.5
            6.5  A3   0.5  0.4
            7    C4   1    0.45
            8    E3   0.5  0.55
            8.5  G3   0.5  0.4
            9    C4   0.5  0.45
            9.5  G3   0.5  0.4
            10   E3   0.5  0.5
            10.5 G3   0.5  0.4
            11   C4   1    0.45
            12   D3   0.5  0.55
            12.5 G3   0.5  0.4
            13   B3   0.5  0.45
            13.5 G3   0.5  0.4
            14   D3   0.5  0.5
            14.5 G3   0.5  0.4
            15   B3   1    0.45
          `,
        },
        {
          id: 'glock', name: 'Glockenspiel', instrument: 'musicbox', length: 16, volume: 0.4,
          notes: `
            0    E6   1    0.5
            3    C6   1    0.4
            6    A5   1    0.45
            11   G5   1    0.4
            14   D6   1    0.45
          `,
        },
        {
          id: 'bass', name: 'Bass', instrument: 'bass', length: 16, volume: 0.65,
          notes: `
            0   A1  1.9  0.6
            2   A1  1.9  0.5
            4   F1  1.9  0.6
            6   F1  1.9  0.5
            8   C2  1.9  0.6
            10  C2  1.9  0.5
            12  G1  1.9  0.6
            14  G1  1.9  0.5
          `,
        },
        {
          id: 'drums', name: 'Drums', kit: 'soft', volume: 0.6,
          drums: {
            kick:  'x.....x.x.......',
            snare: '....x.......x...',
            hat:   'o.o.o.o.o.o.o.o.',
          },
        },
      ],
    },
  },
  {
    id: 'inrainbows',
    title: 'In Rainbows',
    subtitle: 'Clean guitars weaving around each other over a steady groove. Inspired by In Rainbows.',
    art: 'ripples',
    lead: 'guitar',
    glide: false,
    scale: [4, 6, 7, 9, 11, 2], // E, F-sharp, G, A, B, D
    low: 52, // E3
    song: {
      id: 'world-inrainbows',
      title: 'In Rainbows world',
      bpm: 150,
      bars: [4],
      chords: {
        'Em7': 'E2 | E3 B3 D4 G4',
        'Gmaj7': 'G2 | G3 B3 D4 F#4',
        'Cmaj7': 'C2 | E3 G3 B3 E4',
        'Am7': 'A1 | E3 G3 A3 C4',
      },
      parts: [
        {
          id: 'guitar1', name: 'Guitar (threes)', instrument: 'guitar', length: 16, volume: 0.75,
          notes: arpeggio([
            ['Em7', ['B3', 'D4', 'G4']], ['Gmaj7', ['B3', 'D4', 'F#4']],
            ['Cmaj7', ['G3', 'B3', 'E4']], ['Am7', ['G3', 'A3', 'C4']],
          ], 3, 0, 0.5),
        },
        {
          id: 'guitar2', name: 'Guitar (fours)', instrument: 'guitar', length: 16, volume: 0.55,
          notes: arpeggio([
            ['Em7', ['E4', 'G4', 'B4', 'D5']], ['Gmaj7', ['D4', 'F#4', 'B4', 'D5']],
            ['Cmaj7', ['E4', 'G4', 'B4', 'E5']], ['Am7', ['E4', 'G4', 'C5', 'E5']],
          ], 4, 0.25, 0.4),
        },
        {
          id: 'bass', name: 'Bass', instrument: 'bass', length: 16, volume: 0.7,
          notes: `
            0   E2  0.9  0.65
            1   E2  0.9  0.5
            2   E2  0.9  0.55
            3   D2  0.9  0.5
            4   G1  0.9  0.65
            5   G1  0.9  0.5
            6   G1  0.9  0.55
            7   A1  0.9  0.5
            8   C2  0.9  0.65
            9   C2  0.9  0.5
            10  C2  0.9  0.55
            11  B1  0.9  0.5
            12  A1  0.9  0.65
            13  A1  0.9  0.5
            14  A1  0.9  0.55
            15  B1  0.9  0.5
          `,
        },
        {
          id: 'drums', name: 'Drums', kit: 'soft', volume: 0.7,
          drums: {
            kick:  'x.......x.x.....',
            snare: '....x.......x...',
            hat:   'x.o.x.o.x.o.x.o.',
          },
        },
      ],
    },
  },
];

// The notes the touch surface offers, low to high, over two octaves.
export function surfaceNotes(world) {
  const notes = [];
  for (let midi = world.low; notes.length < world.scale.length * 2 + 1; midi++) {
    if (world.scale.includes(midi % 12)) notes.push(midi);
  }
  return notes;
}
