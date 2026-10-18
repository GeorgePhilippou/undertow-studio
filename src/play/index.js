// The Play screen: a whole-window instrument. Touch anywhere to play the
// world's lead sound in its scale; left is low, right is high, higher up is
// brighter. The band loops underneath and the picture answers both.

import { Player } from '../player.js';
import { prepareSong, noteName } from '../songs.js';
import { WORLDS, surfaceNotes } from './worlds.js';
import { Art } from './art.js';
import { Recorder, canRecord, savePiece, listPieces, deletePiece } from './pieces.js';
import { showDialog, confirmBox, toast, escape } from '../ui/mac.js';

const PIANO_KEYS = 'awsedftgyhujkolp;';

export class PlayScreen {
  constructor({ engine, settings, persist, download, $ }) {
    this.engine = engine;
    this.context = engine.context;
    this.settings = settings;
    this.persist = persist;
    this.download = download;
    this.$ = $;
    this.band = new Player(engine);
    this.band.countIn = false;
    this.art = new Art($('#art'));
    this.touches = new Map();
    this.keys = new Map();
    this.active = false;
    this.bind();
    this.setWorld(settings().world || WORLDS[0].id, false);
  }

  get world() {
    return WORLDS.find(w => w.id === this.worldId) || WORLDS[0];
  }

  // ------------------------------------------------------------ screen

  enter() {
    this.active = true;
    this.$('#touch-hint').hidden = Boolean(this.settings().played);
    if (this.settings().band !== false) this.startBand();
    this.loop();
    this.renderStrip();
  }

  leave() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.band.stop();
    this.releaseAll();
    if (this.recorder) this.stopRecording();
    this.renderStrip();
  }

  setWorld(id, announce = true) {
    this.releaseAll();
    this.worldId = WORLDS.some(w => w.id === id) ? id : WORLDS[0].id;
    this.settings().world = this.worldId;
    this.persist();
    const world = this.world;
    this.notes = surfaceNotes(world);
    const playing = this.band.state === 'playing';
    this.band.setSong(prepareSong(world.song));
    this.band.setMode('listen');
    if (playing && this.active) this.band.play();
    this.$('#world-title').textContent = `${world.title} - Sound World`;
    this.$('#world-name').textContent = world.title;
    this.$('.world-caption').classList.remove('brief');
    this.$('#world-sub').textContent = world.subtitle;
    this.$('#world-select').innerHTML = WORLDS.map(w => `<option value="${w.id}" ${w.id === world.id ? 'selected' : ''}>${escape(w.title)}</option>`).join('');
    if (announce) toast(`${world.title}: ${world.subtitle}`);
  }

  shiftWorld(direction) {
    const index = WORLDS.findIndex(w => w.id === this.worldId);
    this.setWorld(WORLDS[(index + direction + WORLDS.length) % WORLDS.length].id);
  }

  startBand() {
    this.context.resume();
    if (this.band.state !== 'playing') this.band.play();
    this.settings().band = true;
    this.persist();
    this.renderStrip();
  }

  stopBand() {
    this.band.stop();
    this.settings().band = false;
    this.persist();
    this.renderStrip();
  }

  toggleBand() {
    if (this.band.state === 'playing') this.stopBand();
    else this.startBand();
  }

  renderStrip() {
    const playing = this.band.state === 'playing';
    this.$('#band').setAttribute('aria-pressed', String(playing));
    this.$('#band span:last-child').textContent = playing ? 'Band On' : 'Band Off';
    this.$('#play-record').setAttribute('aria-pressed', String(Boolean(this.recorder)));
    this.$('#play-record span:last-child').textContent = this.recorder ? 'Stop' : 'Record';
    this.$('#play-record').disabled = !canRecord();
  }

  // ------------------------------------------------------------ drawing

  loop() {
    if (!this.active) return;
    this.frame = requestAnimationFrame(() => this.loop());
    const playing = this.band.state === 'playing';
    const lit = new Set([...this.touches.values(), ...this.keys.values()].map(t => t.step));
    this.art.draw({
      field: this.world.art,
      beat: playing ? Math.max(0, this.band.beat) : performance.now() / 1000,
      playing,
      level: this.engine.meter(),
      steps: this.notes.length,
      lit,
    });
    if (this.recorder) {
      const s = Math.floor(this.recorder.seconds);
      this.$('#record-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }

  // ------------------------------------------------------------ playing

  stepAt(x) {
    const width = this.$('#art').clientWidth;
    return Math.max(0, Math.min(this.notes.length - 1, Math.floor((x / width) * this.notes.length)));
  }

  output() {
    return this.engine.channel('lead', { instrument: this.world.lead, volume: 1 });
  }

  start(id, step, velocity, brightness) {
    this.context.resume();
    this.$('.world-caption').classList.add('brief');
    if (!this.settings().played) {
      this.settings().played = true;
      this.persist();
      this.$('#touch-hint').hidden = true;
    }
    const midi = this.notes[step];
    const voice = this.engine.noteOn(this.world.lead, midi, velocity, this.context.currentTime, this.output());
    voice.setBrightness?.(brightness, this.context.currentTime);
    return { voice, step, midi, velocity };
  }

  move(touch, step, brightness) {
    const now = this.context.currentTime;
    touch.voice.setBrightness?.(brightness, now);
    if (step === touch.step) return touch;
    if (this.world.glide && touch.voice.setPitch) {
      touch.voice.setPitch(this.notes[step], now);
      return { ...touch, step, midi: this.notes[step] };
    }
    // Plucked and struck sounds: each new note rings on as the finger moves.
    touch.voice.release(now + 0.6);
    return this.start(null, step, touch.velocity * 0.9, brightness);
  }

  end(touch) {
    const ring = this.world.glide ? 0 : 0.25;
    touch?.voice.release(this.context.currentTime + ring);
  }

  releaseAll() {
    for (const touch of [...this.touches.values(), ...this.keys.values()]) this.end(touch);
    this.touches.clear();
    this.keys.clear();
  }

  bind() {
    const canvas = this.$('#art');
    const point = event => {
      const box = canvas.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const brightness = Math.max(0, Math.min(1, 1 - y / box.height));
      const velocity = event.pointerType === 'pen' && event.pressure > 0 ? Math.min(1, 0.25 + event.pressure * 0.85) : 0.4 + brightness * 0.5;
      return { x, y, brightness, velocity, step: this.stepAt(x) };
    };
    canvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      const p = point(event);
      this.touches.set(event.pointerId, this.start(event.pointerId, p.step, p.velocity, p.brightness));
      this.art.ripple(p.x, p.y, 1);
    });
    canvas.addEventListener('pointermove', event => {
      const touch = this.touches.get(event.pointerId);
      if (!touch) return;
      const p = point(event);
      const next = this.move(touch, p.step, p.brightness);
      if (next !== touch) {
        this.touches.set(event.pointerId, next);
        this.art.ripple(p.x, p.y, 0.6);
      }
    });
    const up = event => {
      this.end(this.touches.get(event.pointerId));
      this.touches.delete(event.pointerId);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);
    canvas.addEventListener('contextmenu', event => event.preventDefault());

    this.$('#world-prev').addEventListener('click', () => this.shiftWorld(-1));
    this.$('#world-next').addEventListener('click', () => this.shiftWorld(1));
    this.$('#world-select').addEventListener('change', event => this.setWorld(event.target.value));
    this.$('#band').addEventListener('click', () => this.toggleBand());
    this.$('#play-record').addEventListener('click', () => this.toggleRecording());
    this.$('#pieces-button').addEventListener('click', () => this.showPieces());
    this.$('#world-zoom').addEventListener('click', () => this.toggleFullScreen());
  }

  // Computer keys and MIDI keyboards play the surface too.
  keyDown(event) {
    const key = event.key.toLowerCase();
    if (key === ' ') {
      event.preventDefault();
      this.toggleBand();
      return true;
    }
    if (key === 'r') {
      this.toggleRecording();
      return true;
    }
    const index = PIANO_KEYS.indexOf(key);
    if (index >= 0 && index < this.notes.length && !this.keys.has(key)) {
      this.keys.set(key, this.start(key, index, 0.7, 0.6));
      const canvas = this.$('#art');
      this.art.ripple(((index + 0.5) / this.notes.length) * canvas.clientWidth, canvas.clientHeight * 0.5, 1);
      return true;
    }
    return false;
  }

  keyUp(event) {
    const key = event.key.toLowerCase();
    this.end(this.keys.get(key));
    this.keys.delete(key);
  }

  midiNote(note, velocity) {
    if (velocity > 0) {
      const step = this.notes.reduce((best, midi, i) => (Math.abs(midi - note) < Math.abs(this.notes[best] - note) ? i : best), 0);
      this.keys.set(`midi${note}`, this.start(null, step, velocity, 0.6));
    } else {
      this.end(this.keys.get(`midi${note}`));
      this.keys.delete(`midi${note}`);
    }
  }

  // ------------------------------------------------------------ recording

  toggleRecording() {
    if (this.recorder) this.stopRecording();
    else this.startRecording();
  }

  startRecording() {
    if (!canRecord()) {
      toast('This browser cannot record.');
      return;
    }
    if (this.band.state !== 'playing') this.startBand();
    this.recorder = new Recorder(this.art, this.engine.stream());
    try {
      this.recorder.start();
    } catch (error) {
      this.recorder = null;
      toast(`Recording could not start: ${error.message}`);
    }
    this.$('#record-time').textContent = '0:00';
    this.renderStrip();
  }

  async stopRecording() {
    const recorder = this.recorder;
    this.recorder = null;
    this.renderStrip();
    this.$('#record-time').textContent = '';
    const { blob, seconds, video } = await recorder.stop();
    if (!blob.size) return;
    const piece = { id: `piece-${Date.now().toString(36)}`, world: this.world.id, title: this.world.title, created: new Date().toISOString(), seconds, video, blob };
    try {
      await savePiece(piece);
    } catch {
      toast('The piece could not be kept in this browser; save it now.');
    }
    if (this.active) this.showPiece(piece, true);
  }

  fileName(piece) {
    const extension = piece.blob.type.includes('mp4') ? (piece.video ? 'mp4' : 'm4a') : 'webm';
    return `Undertow - ${piece.title} - ${piece.created.slice(0, 16).replace('T', ' ').replace(':', '.')}.${extension}`;
  }

  async showPiece(piece, fresh = false) {
    const url = URL.createObjectURL(piece.blob);
    const media = piece.video
      ? `<video class="piece-media" src="${url}" controls playsinline></video>`
      : `<audio class="piece-media" src="${url}" controls></audio>`;
    const length = `${Math.floor(piece.seconds / 60)}:${String(Math.round(piece.seconds % 60)).padStart(2, '0')}`;
    const { value } = await showDialog(`
      <h3>${fresh ? 'Your piece' : escape(piece.title)}</h3>
      ${media}
      <p>${escape(piece.title)} sound world, ${length}. ${fresh ? 'It is kept in My Pieces on this device.' : ''}</p>
      <div class="button-row"><button class="btn" data-value="delete">Delete</button><button class="btn" data-value="save">Save...</button><button class="btn default" data-value="ok">Done</button></div>`);
    URL.revokeObjectURL(url);
    if (value === 'save') this.download(piece.blob, this.fileName(piece));
    if (value === 'delete' && (await confirmBox('Delete this piece?', 'It is removed from this device.', 'Delete'))) {
      await deletePiece(piece.id);
      toast('Piece deleted.');
    }
  }

  async showPieces() {
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
          <span>${escape(new Date(p.created).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}${p.video ? ', with picture' : ', sound only'}</span></button>`).join('')
          : '<div class="empty">Nothing yet. Press Record, play, then press Stop.</div>'}
      </div>
      <div class="button-row"><button class="btn default" data-value="ok">Done</button></div>`);
    const piece = pieces.find(p => p.id === value);
    if (piece) this.showPiece(piece);
  }

  // ------------------------------------------------------------ full screen

  toggleFullScreen() {
    const element = this.$('#play-screen');
    const current = document.fullscreenElement || document.webkitFullscreenElement;
    if (current) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (element.requestFullscreen || element.webkitRequestFullscreen)?.call(element);
  }

  menu() {
    return [
      ...WORLDS.map(w => ({ label: w.title, checked: w.id === this.worldId, action: () => this.setWorld(w.id) })),
      '-',
      { label: this.band.state === 'playing' ? 'Stop the Band' : 'Start the Band', shortcut: 'Space', action: () => this.toggleBand() },
      { label: this.recorder ? 'Stop Recording' : 'Record a Piece', shortcut: 'R', disabled: !canRecord(), action: () => this.toggleRecording() },
      { label: 'My Pieces...', action: () => this.showPieces() },
      '-',
      { label: 'Full Screen', action: () => this.toggleFullScreen() },
    ];
  }

  describe() {
    return this.notes.map(n => noteName(n)).join(' ');
  }
}
