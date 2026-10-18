// Recording pieces from the Play screen: the art and the sound together as a
// video where the browser can, otherwise sound only. Pieces are kept in this
// browser's IndexedDB and never uploaded.

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

const VIDEO_TYPES = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const AUDIO_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

function supported(types) {
  return types.find(type => window.MediaRecorder?.isTypeSupported?.(type));
}

export function canRecord() {
  return Boolean(window.MediaRecorder && (supported(VIDEO_TYPES) || supported(AUDIO_TYPES)));
}

// Copies the low-resolution art onto a larger canvas with hard pixel edges,
// so the recorded video stays crisp rather than blurred.
export class Recorder {
  constructor(art, audioStream) {
    this.art = art;
    this.audioStream = audioStream;
  }

  start() {
    const source = this.art.canvas;
    const scale = Math.max(2, Math.round(960 / Math.max(1, source.width)));
    this.frame = document.createElement('canvas');
    this.frame.width = source.width * scale;
    this.frame.height = source.height * scale;
    const context = this.frame.getContext('2d');
    context.imageSmoothingEnabled = false;
    const copy = () => {
      context.drawImage(source, 0, 0, this.frame.width, this.frame.height);
      this.copying = requestAnimationFrame(copy);
    };
    copy();
    const videoType = this.frame.captureStream ? supported(VIDEO_TYPES) : null;
    const tracks = [...this.audioStream.getAudioTracks()];
    if (videoType) tracks.unshift(...this.frame.captureStream(30).getVideoTracks());
    this.type = videoType || supported(AUDIO_TYPES);
    this.chunks = [];
    this.started = Date.now();
    this.recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: this.type });
    this.recorder.ondataavailable = event => event.data.size && this.chunks.push(event.data);
    this.recorder.start(500);
  }

  get seconds() {
    return this.started ? (Date.now() - this.started) / 1000 : 0;
  }

  stop() {
    cancelAnimationFrame(this.copying);
    const seconds = this.seconds;
    return new Promise(resolve => {
      this.recorder.onstop = () => {
        const type = this.type.split(';')[0];
        resolve({ blob: new Blob(this.chunks, { type }), seconds, video: type.startsWith('video') });
      };
      this.recorder.stop();
    });
  }
}
