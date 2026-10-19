// The desktop: a Finder window of the records you have loaded, and icons for
// the sound worlds, the lessons and your pieces. Touch an icon to open it.

import { saveTrack, deleteTrack, listTracks, titleFrom, decode, MAX_BYTES, MAX_SECONDS } from '../play/tracks.js';
import { matchSong } from './chart.js';
import { SONGS } from '../songs.js';
import { ICONS } from '../ui/icons.js';
import { alertBox, confirmBox, showDialog, toast, escape } from '../ui/mac.js';

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
  constructor({ context, $, open }) {
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
      <button class="icon" data-load data-help="Load a Radiohead song you own from Files: MP3, M4A, AAC or WAV. It stays on this device. Apple Music downloads are copy-protected and cannot be opened.">
        <span class="glyph">${ICONS.floppy}</span><span class="name">Load a Record...</span></button>`;
    this.$('#records-empty').hidden = count > 0;
    this.$('#records-window').classList.add('active');
  }

  async load(file) {
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
