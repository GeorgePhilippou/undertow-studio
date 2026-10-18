// Songs you load for the Your Song world. The files stay in this browser's
// IndexedDB on this device; nothing is uploaded and nothing is bundled.

const DB = 'undertow-tracks';
const STORE = 'tracks';
export const MAX_BYTES = 80 * 1024 * 1024;
export const MAX_SECONDS = 15 * 60;

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
  });
}

export const saveTrack = track => run('readwrite', store => store.put(track));
export const deleteTrack = id => run('readwrite', store => store.delete(id));
export const getTrack = id => run('readonly', store => store.get(id));
export const listTracks = async () => ((await run('readonly', store => store.getAll())) || [])
  .map(({ id, name, added, seconds }) => ({ id, name, added, seconds }))
  .sort((a, b) => b.added.localeCompare(a.added));

// A readable title from a file name: "02 Idioteque.m4a" becomes "Idioteque".
export function titleFrom(fileName) {
  return fileName.replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]+/, '').replace(/_/g, ' ').trim() || 'Untitled';
}

export function decode(context, blob) {
  return blob.arrayBuffer().then(data => new Promise((resolve, reject) => context.decodeAudioData(data, resolve, reject)));
}

// Loudness across the song, one value per column, for drawing.
export function overview(buffer, columns) {
  const data = buffer.getChannelData(0);
  const size = Math.max(1, Math.floor(data.length / columns));
  const peaks = new Float32Array(columns);
  let loudest = 0;
  for (let c = 0; c < columns; c++) {
    let sum = 0;
    const start = c * size;
    for (let i = 0; i < size; i += 16) sum += data[start + i] ** 2;
    peaks[c] = Math.sqrt(sum / (size / 16));
    loudest = Math.max(loudest, peaks[c]);
  }
  for (let c = 0; c < columns; c++) peaks[c] = loudest ? peaks[c] / loudest : 0;
  return peaks;
}
