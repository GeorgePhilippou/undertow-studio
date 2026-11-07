// Turns a song's keyboard part into something to play on a computer
// keyboard. Every chord of the part gets its own key on the home row, in the
// order the chords first come, so a progression reads left to right
// (Pyramid Song is A S D S A). Pressing a key plays that chord with the notes
// the part really has at that moment: the bass on the downbeat, the chord on
// its own where the part repeats it.

import { SONGS, prepareSong, noteName } from '../songs.js';

// Physical keys (KeyboardEvent.code), so the layout is the same whatever the
// keyboard's language.
export const HOME_ROW = [
  ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'],
  ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', ';'],
];
const TOP_ROW = [
  ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'], ['KeyT', 'T'],
  ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'],
];
const ROWS = [...HOME_ROW, ...TOP_ROW];

// Plain ASCII for the pixel fonts: F♯ becomes F#.
export const plain = name => String(name || '').replace(/♯/g, '#').replace(/♭/g, 'b');
export const noteList = notes => notes.map(midi => plain(noteName(midi))).join(' ');

// The song's keyboard part: the one marked to learn that has notes.
export function keyboardPart(song) {
  return song.parts.find(part => part.learn && part.kind === 'notes') || song.parts.find(part => part.kind === 'notes') || null;
}

// Songs that have a keyboard part, prepared, in the song list's order.
export function playableSongs() {
  return SONGS.map(prepareSong).filter(song => keyboardPart(song));
}

// The part as hits: everything that starts on the same beat is one hit.
export function hitsOf(song, part) {
  const hits = [];
  for (const event of part.events) {
    if (!event.notes.length) continue;
    const last = hits[hits.length - 1];
    if (last && Math.abs(last.beat - event.beat) < 1e-6) {
      for (const midi of event.notes) if (!last.notes.includes(midi)) last.notes.push(midi);
      last.chord ||= event.chord;
      last.length = Math.max(last.length, event.length);
      last.velocity = Math.max(last.velocity, event.velocity);
    } else {
      hits.push({ beat: event.beat, notes: [...event.notes], chord: event.chord, length: event.length, velocity: event.velocity });
    }
  }
  const length = part.length || song.loop;
  hits.forEach((hit, i) => {
    hit.notes.sort((a, b) => a - b);
    const next = i + 1 < hits.length ? hits[i + 1].beat : length + hits[0].beat;
    hit.gap = next - hit.beat;
  });
  return hits;
}

// A name for what a hit plays: its chord, or its notes when it has none.
const nameOf = hit => hit.chord || noteList(hit.notes);

// The keys for a song: { song, part, hits, keys, length }. Each key is
// { code, label, name, notes } where notes is the chord's full voicing.
export function keymapFor(song) {
  const part = keyboardPart(song);
  const hits = hitsOf(song, part);
  const keys = [];
  for (const hit of hits) {
    const name = nameOf(hit);
    let key = keys.find(k => k.name === name);
    if (!key) {
      const [code, label] = ROWS[keys.length] || [];
      if (!code) continue;
      const chord = hit.chord && song.chords[hit.chord];
      key = { code, label, name, notes: chord ? [...chord.bass, ...chord.upper].sort((a, b) => a - b) : [...hit.notes] };
      keys.push(key);
    }
    hit.key = key;
  }
  return { song, part, hits: hits.filter(hit => hit.key), keys, length: part.length || song.loop };
}

// The nth hit counted from the start, going round the part: its hit, and its
// beat counted from the very first hit.
export function nth(map, n) {
  const count = map.hits.length;
  const round = Math.floor(n / count);
  const hit = map.hits[((n % count) + count) % count];
  return { hit, beat: round * map.length + hit.beat, round };
}
