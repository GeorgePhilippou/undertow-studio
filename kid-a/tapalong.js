// Tap along: every press plays the next chord of a song's piano part, in the
// player's own time. The left of the computer keyboard is the left hand (the
// bass), the right of it is the right hand (the chord on top). Pressing both
// together plays the whole hit; pressing one hand twice moves on without the
// other.

// Physical keys (KeyboardEvent.code), so the layout works on any keyboard
// language. Each row has its own loudness: the number row is loudest, the
// bottom row softest.
export const ROWS = [
  { name: 'Number row', velocity: 0.95, left: ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'], right: ['Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'] },
  { name: 'Top row', velocity: 0.8, left: ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT'], right: ['KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'] },
  { name: 'Home row', velocity: 0.62, left: ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG'], right: ['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'] },
  { name: 'Bottom row', velocity: 0.42, left: ['IntlBackslash', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB'], right: ['KeyN', 'KeyM', 'Comma', 'Period', 'Slash'] },
];

const KEYS = new Map();
for (const row of ROWS) {
  for (const code of row.left) KEYS.set(code, { hand: 'left', velocity: row.velocity });
  for (const code of row.right) KEYS.set(code, { hand: 'right', velocity: row.velocity });
}

// Which hand and how loud a physical key plays, or null.
export function keyFor(code) {
  return KEYS.get(code) || null;
}

// Plain ASCII chord names for the pixel fonts: F♯ becomes F#.
export const plain = name => String(name || '').replace(/♯/g, '#').replace(/♭/g, 'b');

// The hits of a prepared song part, each split into the two hands. A chord
// from the song's chord table splits where the table does (bass | upper);
// loose notes split at middle C.
export function handsFor(song, part) {
  const length = part.length || song.loop;
  const events = part.events.filter(event => event.notes.length);
  return events.map((event, i) => {
    const next = i + 1 < events.length ? events[i + 1].beat : length + events[0].beat;
    const chord = event.chord && song.chords[event.chord];
    let left;
    let right;
    if (chord) {
      const upper = new Set(chord.upper);
      left = event.notes.filter(midi => !upper.has(midi));
      right = event.notes.filter(midi => upper.has(midi));
    } else {
      left = event.notes.filter(midi => midi < 60);
      right = event.notes.filter(midi => midi >= 60);
    }
    return {
      beat: event.beat,
      gap: next - event.beat,
      length: event.length,
      velocity: event.velocity,
      chord: event.chord,
      left,
      right,
    };
  });
}

export class TapAlong {
  constructor(hits) {
    this.hits = hits;
    this.restart();
  }

  restart() {
    this.index = 0;
    this.round = 1;
    this.played = { left: false, right: false };
  }

  get next() {
    return this.hits[this.index];
  }

  advance() {
    this.index++;
    if (this.index >= this.hits.length) {
      this.index = 0;
      this.round++;
    }
    this.played = { left: false, right: false };
  }

  back() {
    if (this.played.left || this.played.right) {
      this.played = { left: false, right: false };
      return;
    }
    if (this.index === 0 && this.round > 1) this.round--;
    this.index = (this.index - 1 + this.hits.length) % this.hits.length;
  }

  // Plays one hand of the next hit and returns { hit, index, notes }. A hand
  // that already played this hit moves the song on first.
  press(hand) {
    if (this.played[hand]) this.advance();
    const index = this.index;
    const hit = this.hits[index];
    this.played[hand] = true;
    const notes = hit[hand];
    // A hit with nothing for the other hand is complete with this one.
    const other = hand === 'left' ? 'right' : 'left';
    if (!hit[other].length) this.played[other] = true;
    if (this.played.left && this.played.right) this.advance();
    return { hit, index, notes };
  }

  // Both hands at once: whatever is left of the next chord. After one hand
  // has played it, that is the other hand's part.
  both() {
    const index = this.index;
    const hit = this.hits[index];
    const left = this.played.left ? [] : hit.left;
    const right = this.played.right ? [] : hit.right;
    this.advance();
    return { hit, index, left, right, notes: [...left, ...right] };
  }
}
