// Everything the player makes is kept in this browser under one key.
// The classic app (classic/) keeps its own data and is never touched.

const KEY = 'undertow-desk-v1';

const EMPTY = { settings: {}, takes: {}, edits: {}, songs: [] };

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === 'object') return { ...EMPTY, ...saved };
  } catch {
    // Unreadable data starts fresh; it is not overwritten until the next save.
  }
  return structuredClone(EMPTY);
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// A portable copy of everything, for File > Save a Copy.
export function exportFile(data) {
  return new Blob([JSON.stringify({ format: 'undertow-desk', version: 1, ...data }, null, 1)], { type: 'application/json' });
}

export function importFile(text) {
  const parsed = JSON.parse(text);
  if (parsed.format !== 'undertow-desk') throw new Error('This is not an OK Computer lessons file.');
  return {
    settings: parsed.settings || {},
    takes: parsed.takes || {},
    edits: parsed.edits || {},
    songs: Array.isArray(parsed.songs) ? parsed.songs : [],
  };
}
