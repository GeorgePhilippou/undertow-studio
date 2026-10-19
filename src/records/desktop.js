// The desktop: a Finder window of the records you have loaded, and icons for
// the sound worlds, the lessons and your pieces. Touch an icon to open it.

import { saveTrack, deleteTrack, getTrack, listTracks, titleFrom, decode, MAX_BYTES, MAX_SECONDS } from '../play/tracks.js';
import { matchSong } from './chart.js';
import { SONGS } from '../songs.js';
import { ICONS } from '../ui/icons.js';
import { alertBox, confirmBox, showDialog, toast, escape } from '../ui/mac.js';

// A saved record is one JSON file: the song file itself (as a data URL) and
// everything set up for it. Moved through Files or iCloud Drive, it opens on
// another device exactly as it was left. Nothing is sent anywhere else.
const FORMAT = 'undertow-record';
const KEPT = ['name', 'seconds', 'songId', 'sync', 'slices', 'remix', 'fx', 'snap'];

const dataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

export function isSavedRecord(file) {
  return /\.json$/i.test(file.name) || file.type === 'application/json';
}

// Asks the browser to keep Undertow's records rather than clear them when
// space runs low or the site goes unused for a while.
export async function keepData() {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

// Outlines grow from an icon to the screen, as the Finder did when opening.
export function zoomOpen(from) {
  if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const start = from.getBoundingClientRect();
  const end = { left: 12, top: 36, width: window.innerWidth - 24, height: window.innerHeight - 48 };
  return new Promise(resolve => {
    const frames = 6;
    const boxes = [];
    let frame = 0;
    const step = () => {
      frame++;
      const t = frame / frames;
      const box = document.createElement('div');
      box.className = 'zoom-rect';
      box.style.left = `${start.left + (end.left - start.left) * t}px`;
      box.style.top = `${start.top + (end.top - start.top) * t}px`;
      box.style.width = `${start.width + (end.width - start.width) * t}px`;
      box.style.height = `${start.height + (end.height - start.height) * t}px`;
      document.body.append(box);
      boxes.push(box);
      if (boxes.length > 3) boxes.shift().remove();
      if (frame < frames) setTimeout(step, 28);
      else setTimeout(() => { boxes.forEach(b => b.remove()); resolve(); }, 40);
    };
    step();
  });
}

export class Desktop {
  constructor({ context, $, open, download, flush }) {
    this.download = download;
    this.flush = flush || (async () => {});
    this.context = context;
    this.$ = $;
    this.open = open;
    this.records = [];
    this.bind();
  }

  bind() {
    const $ = this.$;
    $('#records').addEventListener('click', event => {
      const icon = event.target.closest('[data-record], [data-load]');
      if (!icon) return;
      if (icon.dataset.load !== undefined) $('#record-file').click();
      else this.openIcon(icon, { record: icon.dataset.record });
    });
    $('#desk-icons').addEventListener('click', event => {
      const icon = event.target.closest('[data-open]');
      if (icon) this.openIcon(icon, { screen: icon.dataset.open });
    });
    $('#record-file').addEventListener('change', event => {
      const file = event.target.files[0];
      event.target.value = '';
      if (file) this.load(file);
    });
  }

  async openIcon(icon, target) {
    icon.classList.add('opening');
    await zoomOpen(icon);
    icon.classList.remove('opening');
    this.open(target);
  }

  async render() {
    try {
      this.records = await listTracks();
    } catch {
      this.records = [];
    }
    const count = this.records.length;
    this.$('#records-info').textContent = count ? `${count} record${count === 1 ? '' : 's'} on this iPad` : 'No records yet';
    this.$('#records').innerHTML = `
      ${this.records.map(record => `<button class="icon" data-record="${record.id}">
        <span class="glyph">${ICONS.disc}</span><span class="name">${escape(record.name)}</span></button>`).join('')}
      <button class="icon" data-load data-help="Load a Radiohead song you own from Files: MP3, M4A, AAC or WAV, or a record saved on another device with File > Save Record to Files. It stays on this device. Apple Music downloads are copy-protected and cannot be opened.">
        <span class="glyph">${ICONS.floppy}</span><span class="name">Load a Record...</span></button>`;
    this.$('#records-empty').hidden = count > 0;
    this.$('#records-window').classList.add('active');
  }

  async load(file) {
    if (isSavedRecord(file)) {
      await this.loadSaved(file);
      return;
    }
    if (file.size > MAX_BYTES) {
      alertBox('That file is too large.', 'Choose a song file under 80 MB.');
      return;
    }
    toast('Opening...');
    let buffer;
    try {
      buffer = await decode(this.context, file);
    } catch {
      alertBox('This file cannot be played.', 'Songs from Apple Music are copy-protected. Use an MP3, M4A, AAC or WAV file you own, saved in Files.');
      return;
    }
    if (buffer.duration > MAX_SECONDS) {
      alertBox('That recording is too long.', 'Choose a song under 15 minutes.');
      return;
    }
    const name = titleFrom(file.name);
    const track = { id: `track-${Date.now().toString(36)}`, name, added: new Date().toISOString(), seconds: buffer.duration, blob: file, songId: matchSong(name) };
    try {
      await saveTrack(track);
    } catch {
      toast('This record could not be kept for next time, but you can play it now.');
    }
    await this.render();
    keepData();
    this.open({ record: track.id, buffer, track });
  }

  // Saves a record and all its settings as one file, for Files or iCloud Drive.
  async save(id) {
    await this.flush();
    const track = await getTrack(id);
    if (!track) return;
    toast('Saving...');
    const saved = { format: FORMAT, version: 1, saved: new Date().toISOString(), audio: await dataUrl(track.blob) };
    for (const key of KEPT) if (track[key] !== undefined) saved[key] = track[key];
    const blob = new Blob([JSON.stringify(saved)], { type: 'application/json' });
    this.download(blob, `${track.name}.undertow.json`);
  }

  // File > Save Record to Files: a list to choose from.
  async chooseToSave() {
    if (!this.records.length) {
      alertBox('There are no records to save.', 'Load a song first.');
      return;
    }
    const { value } = await showDialog(`
      <h3>Save Record to Files</h3>
      <p class="small">Saves the song and everything you set up for it - riff timing, pads, patterns and chords - as one file. Put it in iCloud Drive, then choose Load a Record on another device to carry on there.</p>
      <div class="list-box">${this.records.map(r => `<button data-value="${r.id}"><span>${escape(r.name)}</span><span>${Math.round(r.seconds / 60)} min</span></button>`).join('')}</div>
      <div class="button-row"><button class="btn default" data-value="cancel">Cancel</button></div>`, { defaultValue: 'cancel' });
    if (this.records.some(r => r.id === value)) this.save(value);
  }

  async loadSaved(file) {
    toast('Opening...');
    let saved;
    let blob;
    try {
      saved = JSON.parse(await file.text());
      if (saved.format !== FORMAT || !saved.audio) throw new Error('not a record');
      blob = await (await fetch(saved.audio)).blob();
    } catch {
      alertBox('This file is not an Undertow record.', 'Choose a song file, or a record saved with File > Save Record to Files.');
      return;
    }
    let buffer;
    try {
      buffer = await decode(this.context, blob);
    } catch {
      alertBox('The song in this record cannot be played on this device.');
      return;
    }
    const track = { id: `track-${Date.now().toString(36)}`, added: new Date().toISOString(), blob };
    for (const key of KEPT) if (saved[key] !== undefined) track[key] = saved[key];
    track.name ||= titleFrom(file.name.replace(/\.undertow\.json$/i, ''));
    track.seconds = buffer.duration;
    try {
      await saveTrack(track);
    } catch {
      toast('This record could not be kept for next time, but you can play it now.');
    }
    await this.render();
    keepData();
    toast(`${track.name} is here, just as it was saved.`);
    this.open({ record: track.id, buffer, track });
  }

  // File > Remove a Record: a list to choose from.
  async remove() {
    if (!this.records.length) {
      alertBox('There are no records to remove.');
      return;
    }
    const { value } = await showDialog(`
      <h3>Remove a Record</h3>
      <p class="small">The file is deleted from this device. Your pieces are kept.</p>
      <div class="list-box">${this.records.map(r => `<button data-value="${r.id}"><span>${escape(r.name)}</span><span>${Math.round(r.seconds / 60)} min</span></button>`).join('')}</div>
      <div class="button-row"><button class="btn default" data-value="cancel">Cancel</button></div>`, { defaultValue: 'cancel' });
    const record = this.records.find(r => r.id === value);
    if (record && (await confirmBox(`Remove ${record.name}?`, 'It is deleted from this device.', 'Remove'))) {
      await deleteTrack(record.id);
      await this.render();
      toast(`${record.name} removed.`);
    }
  }

  songTitle(id) {
    return SONGS.find(song => song.id === id)?.title || '';
  }
}
