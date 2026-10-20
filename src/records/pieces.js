// Recorded pieces, kept in this browser's IndexedDB and never uploaded.

import { showDialog, confirmBox, toast, escape } from '../ui/mac.js';

const DB = 'undertow-pieces';
const STORE = 'pieces';

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

export const savePiece = piece => run('readwrite', store => store.put(piece));
export const deletePiece = id => run('readwrite', store => store.delete(id));
export const listPieces = async () => ((await run('readonly', store => store.getAll())) || []).sort((a, b) => b.created.localeCompare(a.created));

// My Pieces: the takes recorded in a record window, and any pieces kept from
// the earlier Sound Worlds, with or without picture.

const fileName = piece => {
  const extension = piece.blob.type.includes('wav') ? 'wav' : piece.blob.type.includes('mp4') ? (piece.video ? 'mp4' : 'm4a') : 'webm';
  return `OK Computer - ${piece.title} - ${piece.created.slice(0, 16).replace('T', ' ').replace(':', '.')}.${extension}`;
};

export async function showPiece(piece, { fresh = false, download } = {}) {
  const url = URL.createObjectURL(piece.blob);
  const media = piece.video
    ? `<video class="piece-media" src="${url}" controls playsinline></video>`
    : `<audio class="piece-media" src="${url}" controls></audio>`;
  const length = `${Math.floor(piece.seconds / 60)}:${String(Math.round(piece.seconds % 60)).padStart(2, '0')}`;
  const { value } = await showDialog(`
    <h3>${fresh ? 'Your take' : escape(piece.title)}</h3>
    ${media}
    <p>${escape(piece.title)}, ${length}. ${fresh ? 'It is kept in My Pieces on this device.' : ''}</p>
    <div class="button-row"><button class="btn" data-value="delete">Delete</button><button class="btn" data-value="save">Save...</button><button class="btn default" data-value="ok">Done</button></div>`);
  URL.revokeObjectURL(url);
  if (value === 'save') download(piece.blob, fileName(piece));
  if (value === 'delete' && (await confirmBox('Delete this piece?', 'It is removed from this device.', 'Delete'))) {
    await deletePiece(piece.id);
    toast('Piece deleted.');
  }
}

export async function showPieces({ download }) {
  let pieces = [];
  try {
    pieces = await listPieces();
  } catch {
    // Storage unavailable: show the empty list.
  }
  const { value } = await showDialog(`
    <h3>My Pieces</h3>
    <div class="list-box">
      ${pieces.length ? pieces.map(p => `<button data-value="${p.id}"><span>${escape(p.title)}</span><span>${Math.round(p.seconds)} s</span>
        <span>${escape(new Date(p.created).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}${p.video ? ', with picture' : ''}</span></button>`).join('')
        : '<div class="empty">Nothing yet. In a record, press Record, play, then press Stop.</div>'}
    </div>
    <div class="button-row"><button class="btn default" data-value="ok">Done</button></div>`);
  const piece = pieces.find(p => p.id === value);
  if (piece) showPiece(piece, { download });
}
