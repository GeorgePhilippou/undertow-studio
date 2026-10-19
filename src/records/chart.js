// The chords along a record you own. Either the matched song's chord loop,
// repeated from the moment the player sets as its start at the song's tempo,
// or chords the player marked by tapping while the record played.

import { SONGS, prepareSong, loopEvents, padsFor, noteNumber } from '../songs.js';

const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Plain major and minor chords, for records that are not in the song list.
export const PALETTE = ROOTS.flatMap((root, i) => [
  { name: root, notes: [48 + i, 60 + i, 64 + i, 67 + i] },
  { name: `${root}m`, notes: [48 + i, 60 + i, 63 + i, 67 + i] },
]);

const simple = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');

// Guesses the song from a file name: "01 Everything In Its Right Place.m4a".
export function matchSong(name) {
  const title = simple(name);
  return SONGS.find(song => title.includes(simple(song.title)))?.id || null;
}

export function songFor(id) {
  const raw = SONGS.find(song => song.id === id);
  return raw ? prepareSong(raw) : null;
}

function learnPart(song) {
  return song.parts.find(part => part.learn && part.kind === 'notes') || song.parts.find(part => part.kind === 'notes');
}

// The chords a player can mark or play on pads: the song's, or the palette.
export function chordChoices(song) {
  if (!song) return PALETTE;
  return padsFor(song, learnPart(song));
}

// Chord changes inside one loop of the song: [{ beat, name }].
export function songChanges(song) {
  const part = learnPart(song);
  if (!part) return [];
  const changes = [];
  for (const event of loopEvents(song, part)) {
    if (event.chord && changes.at(-1)?.name !== event.chord) changes.push({ beat: event.beat, name: event.chord });
  }
  if (changes.length > 1 && changes[0].name === changes.at(-1).name && changes[0].beat === 0) changes.pop();
  return changes;
}

// Every chord along the record as [{ time, end, name }], in seconds.
export function timeline(song, sync, duration) {
  const chords = [];
  if (sync.marks?.length) {
    const marks = [...sync.marks].sort((a, b) => a.time - b.time);
    marks.forEach((mark, i) => chords.push({ time: mark.time, end: marks[i + 1]?.time ?? duration, name: mark.name }));
    return chords;
  }
  if (!song) return chords;
  const changes = songChanges(song);
  if (!changes.length) return chords;
  const beat = 60 / (sync.bpm || song.bpm);
  const cycle = song.loop * beat;
  for (let start = sync.start || 0; start < duration; start += cycle) {
    changes.forEach((change, i) => {
      const time = start + change.beat * beat;
      const end = start + (changes[i + 1]?.beat ?? song.loop) * beat;
      if (time < duration) chords.push({ time, end: Math.min(end, duration), name: change.name });
    });
  }
  return chords;
}

export function chordAt(chords, time) {
  let low = 0;
  let high = chords.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (chords[mid].time <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

// The notes of a chord name, from the song's voicings or the palette.
export function chordNotes(song, name) {
  const voiced = song?.chords[name];
  if (voiced) return [...voiced.bass, ...voiced.upper];
  const plain = PALETTE.find(chord => chord.name === name);
  if (plain) return plain.notes;
  const root = noteNumber(`${name.replace(/m$/, '')}3`);
  return root === null ? [] : [root, root + 4, root + 7];
}
