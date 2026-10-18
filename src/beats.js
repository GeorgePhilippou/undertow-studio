// Ready-made beats for the Drum Machine. Same notation as song drum parts:
// one character per sixteenth note, X loud, x normal, o soft, . rest.
// Starting points to edit, not transcriptions of any record.

export const BEATS = [
  {
    id: 'backbeat', name: 'Backbeat',
    drums: {
      kick:  'x.......x.......',
      snare: '....x.......x...',
      hat:   'x.o.x.o.x.o.x.o.',
    },
  },
  {
    id: 'four', name: 'Four on the Floor',
    drums: {
      kick: 'x...x...x...x...',
      clap: '....x.......x...',
      hat:  '..x...x...x...x.',
    },
  },
  {
    id: 'break', name: 'Broken Beat',
    drums: {
      kick:  'x.....x...x.....x.....x.......x.',
      snare: '....x.......x.......x.......x...',
      hat:   'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
      perc:  '.......o...............o........',
    },
  },
  {
    id: 'half', name: 'Half-time',
    drums: {
      kick:  'x.........x.....',
      snare: '........x.......',
      hat:   'x.o.x.o.x.o.x.o.',
    },
  },
  {
    id: 'machine', name: 'Six-beat Machine',
    drums: {
      kick:  'x.......x.....x.x.......',
      snare: '....x.......x.......x...',
      hat:   'x.o.x.o.x.o.x.o.x.o.x.o.',
      perc:  '...o.......o.......o..o.',
    },
  },
  {
    id: 'five', name: 'Five-beat Clap',
    drums: {
      kick:  'x...........x.......',
      snare: '......x...........x.',
      clap:  '......x...........x.',
      hat:   'o.o.o.o.o.o.o.o.o.o.',
    },
  },
  {
    id: 'brushes', name: 'Quiet Brushes',
    drums: {
      kick:  'o...............',
      snare: '........o.......',
      hat:   'o...o...o...o...',
    },
  },
];

const LEVELS = { X: 1, x: 0.8, o: 0.45 };

// Repeats a beat across a part of the given length in beats.
export function beatEvents(beat, length) {
  const events = [];
  const steps = Math.round(length * 4);
  for (const [voice, pattern] of Object.entries(beat.drums)) {
    const cells = pattern.replace(/\|/g, '');
    for (let step = 0; step < steps; step++) {
      const level = LEVELS[cells[step % cells.length]];
      if (level) events.push({ beat: step / 4, drum: voice, velocity: level, length: 0.25, notes: [] });
    }
  }
  return events;
}
