// A record you own, opened from the desktop. Play Along shows its chords in
// time while it plays, slowed down without changing pitch or looped; Pads cuts
// it into sixteen sampler pads to play. The record never leaves this device.

import { Keyboard } from '../ui/keyboard.js';
import { SONGS } from '../songs.js';
import { getTrack, updateTrack, decode, overview } from '../play/tracks.js';
import { songFor, timeline, chordAt, chordNotes, chordChoices } from './chart.js';
import { sliceAtAttacks, sliceEvenly } from './slices.js';
import { toast, escape } from '../ui/mac.js';
import { ICONS } from '../ui/icons.js';

const PAD_KEYS = '1234qwerasdfzxcv';
const PIANO_KEYS = 'awsedftgyhujkolp;';
const SPEEDS = [1, 0.9, 0.8, 0.75, 0.7, 0.6, 0.5];
const BEFORE = 2;
const AHEAD = 8;

const plain = name => name.replace(/♭/g, 'b').replace(/♯/g, '#');

export const clock = seconds => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class RecordScreen {
  constructor({ engine, $, onPlaying }) {
    this.engine = engine;
    this.context = engine.context;
    this.$ = $;
    this.onPlaying = onPlaying || (() => {});
    this.view = 'along';
    this.loop = null;
    this.voices = new Map();
    this.padVoices = new Map();
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.preservesPitch = true;
    this.audio.webkitPreservesPitch = true;
    this.audio.mozPreservesPitch = true;
    // A finished record is already mastered, so it skips the instrument
    // compressor and reverb.
    this.output = this.context.createGain();
    this.output.gain.value = 0.85;
    this.output.connect(this.context.destination);
    this.keyboard = new Keyboard({ piano: $('#along-piano'), pads: $('#along-pads'), drumPads: $('#along-drums') }, {
      noteOn: (midi, velocity) => this.noteOn(midi, velocity),
      noteOff: midi => this.noteOff(midi),
      padOn: (pad, velocity) => pad.notes.forEach(midi => this.noteOn(midi, velocity * 0.8)),
      padOff: pad => pad.notes.forEach(midi => this.noteOff(midi)),
      drum: () => {},
    });
    this.bind();
  }

  get playing() {
    return !this.audio.paused;
  }

  get time() {
    return this.audio.currentTime || 0;
  }

  get duration() {
    return this.buffer?.duration || this.audio.duration || 0;
  }

  // ------------------------------------------------------------ opening

  async open({ record, buffer, track }) {
    this.stop();
    this.loop = null;
    this.$('#record-title').textContent = 'Opening...';
    const stored = track || (await getTrack(record));
    if (!stored) throw new Error('missing record');
    this.track = { ...stored, sync: { start: null, bpm: null, marks: [], ...stored.sync } };
    delete this.track.blob;
    this.buffer = buffer || (await decode(this.context, stored.blob));
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(stored.blob);
    this.audio.src = this.url;
    if (!this.source) {
      this.source = this.context.createMediaElementSource(this.audio);
      this.source.connect(this.output);
    }
    this.audio.playbackRate = this.speed || 1;
    if (this.track.sync.start === null) this.track.sync.start = this.firstSound();
    this.slices = stored.slices || sliceAtAttacks(this.buffer);
    if (!stored.slices) this.save({ slices: this.slices, sync: this.track.sync });
    this.wave = null;
    this.$('#record-title').textContent = this.track.name;
    this.$('#record-song').value = this.track.songId || '';
    this.setSong(this.track.songId, false);
    this.renderPads();
    this.setView(this.view);
  }

  // Where the music begins, after any silence at the top of the file.
  firstSound() {
    const data = this.buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 64) {
      if (Math.abs(data[i]) > 0.02) return Math.max(0, i / this.buffer.sampleRate - 0.02);
    }
    return 0;
  }

  setSong(id, save = true) {
    this.song = songFor(id);
    this.track.songId = this.song ? id : null;
    this.chords = null;
    this.litChord = undefined;
    const choices = this.song ? chordChoices(this.song) : this.markedChoices();
    this.keyboard.setPads(choices.map(c => ({ name: c.name, notes: c.notes })));
    const notes = choices.flatMap(c => c.notes);
    if (notes.length) this.keyboard.fit(Math.min(...notes), Math.max(...notes));
    else this.keyboard.layout(48);
    this.renderMarks();
    this.renderSync();
    if (save) this.save({ songId: this.track.songId });
  }

  // For records not in the song list, pads are the chords the player marked.
  markedChoices() {
    const names = [...new Set(this.track.sync.marks.map(m => m.name))];
    const chosen = names.length ? names : ['C', 'G', 'Am', 'F'];
    return chosen.map(name => ({ name, notes: chordNotes(null, name) }));
  }

  save(fields) {
    Object.assign(this.track, fields);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      updateTrack(this.track.id, { songId: this.track.songId, sync: this.track.sync, slices: this.slices }).catch(() => {});
    }, 300);
  }

  enter() {
    this.active = true;
    this.wave = null;
    this.loopFrame();
  }

  leave() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.stop();
    this.releaseAll();
  }

  // ------------------------------------------------------------ transport

  play() {
    if (!this.track) return;
    if (this.loop && (this.time < this.loop.start || this.time >= this.loop.end)) this.audio.currentTime = this.loop.start;
    this.audio.play().catch(() => toast('Touch Play again to start the record.'));
    this.renderTransport();
  }

  stop() {
    this.audio.pause();
    this.renderTransport();
  }

  toggle() {
    if (this.playing) this.stop();
    else this.play();
  }

  seek(time) {
    this.audio.currentTime = Math.max(0, Math.min(time, this.duration - 0.05));
  }

  setSpeed(speed) {
    this.speed = speed;
    this.audio.playbackRate = speed;
  }

  setLoop(loop) {
    this.loop = loop && loop.end - loop.start >= 0.25 ? loop : null;
    if (this.loop && this.playing) this.seek(this.loop.start);
    this.renderTransport();
  }

  renderTransport() {
    const $ = this.$;
    $('#rec-play').setAttribute('aria-pressed', String(this.playing));
    $('#rec-play span:last-child').textContent = this.playing ? 'Stop' : 'Play';
    $('#rec-play [data-icon]').innerHTML = ICONS[this.playing ? 'stop' : 'play'];
    $('#rec-loop').disabled = !this.loop;
    $('#rec-loop').setAttribute('aria-pressed', String(Boolean(this.loop)));
    $('#rec-loop span:last-child').textContent = this.loop ? `Loop ${clock(this.loop.start)}-${clock(this.loop.end)}` : 'Loop';
    $('#rec-assign').disabled = !this.loop;
    this.onPlaying(this.playing);
  }

  // ------------------------------------------------------------ chords

  chordList() {
    if (!this.chords) this.chords = timeline(this.song, this.track.sync, this.duration);
    return this.chords;
  }

  setStart() {
    const reaction = this.playing ? 0.08 * this.audio.playbackRate : 0;
    this.track.sync.start = Math.max(0, this.time - reaction);
    this.chords = null;
    this.save({});
    this.renderSync();
    toast(`The chords now start at ${clock(this.track.sync.start)}.`);
  }

  nudgeTempo(amount) {
    if (!this.song) return;
    this.track.sync.bpm = Math.round(((this.track.sync.bpm || this.song.bpm) + amount) * 10) / 10;
    this.chords = null;
    this.save({});
    this.renderSync();
  }

  mark(name) {
    const time = Math.max(0, this.time - (this.playing ? 0.12 * this.audio.playbackRate : 0));
    const marks = this.track.sync.marks.filter(m => Math.abs(m.time - time) > 0.15);
    marks.push({ time, name });
    marks.sort((a, b) => a.time - b.time);
    this.track.sync.marks = marks;
    this.chords = null;
    this.save({});
    if (!this.song) this.setSong(null, false);
    this.renderSync();
    const notes = chordNotes(this.song, name);
    notes.forEach(midi => this.engine.note('piano', midi, 0.5, this.context.currentTime, 0.4, this.engine.channel('along', { instrument: 'piano', volume: 0.9 })));
  }

  undoMark() {
    const now = this.time;
    const marks = this.track.sync.marks;
    if (!marks.length) return;
    const last = marks.reduce((best, m, i) => (m.time <= now + 0.2 && (best < 0 || m.time >= marks[best].time) ? i : best), -1);
    marks.splice(last < 0 ? marks.length - 1 : last, 1);
    this.chords = null;
    this.save({});
    this.renderSync();
  }

  clearMarks() {
    this.track.sync.marks = [];
    this.chords = null;
    this.save({});
    if (!this.song) this.setSong(null, false);
    this.renderSync();
  }

  renderMarks() {
    const choices = this.song ? chordChoices(this.song) : chordChoices(null);
    this.$('#mark-chords').innerHTML = choices.map(c => `<button class="btn square" data-mark="${escape(c.name)}">${escape(plain(c.name))}</button>`).join('');
  }

  renderSync() {
    const $ = this.$;
    const marks = this.track.sync.marks.length;
    const bpm = this.track.sync.bpm || this.song?.bpm;
    $('#rec-bpm').textContent = bpm ? `${bpm.toFixed(1)} BPM` : '- BPM';
    $('#rec-tempo').hidden = !this.song || marks > 0;
    $('#rec-start').hidden = !this.song || marks > 0;
    $('#mark-undo').disabled = !marks;
    $('#mark-clear').disabled = !marks;
    let hint;
    if (marks) hint = `Showing the ${marks} chord${marks === 1 ? '' : 's'} you marked. Clear Marks to go back${this.song ? ' to the song\'s chart' : ''}.`;
    else if (this.song) hint = `Chords from ${this.song.title}, starting at ${clock(this.track.sync.start)}.${Math.floor((this.track.sync.start % 1) * 10)}. If they are early or late, press Set Start the moment you hear the first ${plain(this.chordList()[0]?.name || 'chord')}. They follow the loop from Learn, so other sections of the record may differ.`;
    else hint = 'Choose the song above to see its chords, or press Mark Chords and tap each chord as you hear it.';
    $('#along-hint').textContent = hint;
  }

  // ------------------------------------------------------------ keyboard

  noteOn(midi, velocity) {
    this.noteOff(midi);
    const output = this.engine.channel('along', { instrument: 'piano', volume: 0.9 });
    this.voices.set(midi, this.engine.noteOn('piano', midi, velocity, this.context.currentTime, output));
  }

  noteOff(midi) {
    this.voices.get(midi)?.release(this.context.currentTime);
    this.voices.delete(midi);
  }

  releaseAll() {
    this.keyboard.releaseAll();
    for (const midi of [...this.voices.keys()]) this.noteOff(midi);
    for (const index of [...this.padVoices.keys()]) this.padOff(index, true);
  }

  // ------------------------------------------------------------ pads

  renderPads() {
    const $ = this.$;
    $('#sampler').innerHTML = this.slices.map((slice, i) => `
      <button class="pad sample" data-slice="${i}" aria-label="Pad ${i + 1}">
        <span class="number">${i + 1}<span class="key">${PAD_KEYS[i].toUpperCase()}</span></span>
        <canvas width="96" height="28"></canvas>
        <small>${clock(slice.start)}</small>
      </button>`).join('');
    this.$$('#sampler canvas').forEach((canvas, i) => this.drawSlice(canvas, this.slices[i]));
  }

  drawSlice(canvas, slice) {
    const g = canvas.getContext('2d');
    const data = this.buffer.getChannelData(0);
    const rate = this.buffer.sampleRate;
    const from = Math.floor(slice.start * rate);
    const to = Math.floor(slice.end * rate);
    const step = Math.max(1, Math.floor((to - from) / canvas.width));
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#000';
    for (let x = 0; x < canvas.width; x++) {
      let peak = 0;
      for (let i = from + x * step; i < from + (x + 1) * step && i < data.length; i += 8) peak = Math.max(peak, Math.abs(data[i]));
      const h = Math.max(1, Math.round(peak * canvas.height));
      g.fillRect(x, Math.round((canvas.height - h) / 2), 1, h);
    }
  }

  padOn(index, velocity = 0.85) {
    const slice = this.slices[index];
    if (!slice) return;
    if (this.assigning) {
      this.slices[index] = { ...this.loop };
      this.assigning = false;
      this.$('#rec-assign').setAttribute('aria-pressed', 'false');
      this.save({});
      this.renderPads();
      toast(`Pad ${index + 1} now plays ${clock(this.loop.start)}-${clock(this.loop.end)}.`);
      return;
    }
    this.padOff(index, true);
    const now = this.context.currentTime;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4 + velocity * 0.6, now + 0.005);
    gain.connect(this.output);
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = 1;
    source.connect(gain);
    const length = slice.end - slice.start;
    source.start(now, slice.start, length + 0.02);
    gain.gain.setValueAtTime(0.4 + velocity * 0.6, now + Math.max(0.006, length - 0.02));
    gain.gain.linearRampToValueAtTime(0, now + length + 0.02);
    const pad = this.$(`#sampler [data-slice="${index}"]`);
    pad?.classList.add('down');
    this.lastPad = index;
    const voice = { source, gain, pad };
    this.padVoices.set(index, voice);
    source.onended = () => {
      if (this.padVoices.get(index) === voice) this.padVoices.delete(index);
      pad?.classList.remove('down');
    };
  }

  padOff(index, now = false) {
    const voice = this.padVoices.get(index);
    if (!voice) return;
    if (!now && !this.$('#pad-hold').checked) return;
    const t = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
    voice.gain.gain.linearRampToValueAtTime(0, t + 0.03);
    try { voice.source.stop(t + 0.04); } catch { /* already stopped */ }
    voice.pad?.classList.remove('down');
    this.padVoices.delete(index);
  }

  cut(how) {
    if (how === 'attacks') this.slices = sliceAtAttacks(this.buffer);
    else if (how === 'loop' && this.loop) this.slices = sliceEvenly(this.loop.start, this.loop.end);
    else if (how === 'beats') {
      const beat = 60 / (this.track.sync.bpm || this.song?.bpm || 120);
      const from = this.loop ? this.loop.start : this.time;
      this.slices = sliceEvenly(from, Math.min(from + beat * 16, this.duration));
    } else {
      return;
    }
    this.save({});
    this.renderPads();
    toast('The pads are cut.');
  }

  // ------------------------------------------------------------ view

  setView(view) {
    this.view = view;
    this.$('#record-window').dataset.view = view;
    this.$$('#record-view [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    this.releaseAll();
    this.wave = null;
    this.renderTransport();
    if (view === 'along') {
      requestAnimationFrame(() => this.setSong(this.track?.songId ?? null, false));
    }
  }

  $$(selector) {
    return [...document.querySelectorAll(selector)];
  }

  bind() {
    const $ = this.$;
    $('#rec-play').addEventListener('click', () => this.toggle());
    $('#rec-speed').innerHTML = SPEEDS.map(s => `<option value="${s}">${Math.round(s * 100)}%</option>`).join('');
    $('#rec-speed').addEventListener('change', event => this.setSpeed(Number(event.target.value)));
    $('#rec-loop').addEventListener('click', () => this.setLoop(null));
    $('#rec-start').addEventListener('click', () => this.setStart());
    $('#tempo-down').addEventListener('click', () => this.nudgeTempo(-0.5));
    $('#tempo-up').addEventListener('click', () => this.nudgeTempo(0.5));
    $('#rec-mark').addEventListener('click', () => {
      const on = $('#rec-mark').getAttribute('aria-pressed') !== 'true';
      $('#rec-mark').setAttribute('aria-pressed', String(on));
      $('#mark-row').hidden = !on;
      if (on) toast('Play the record and tap each chord the moment you hear it change.');
    });
    $('#mark-chords').addEventListener('click', event => {
      const button = event.target.closest('[data-mark]');
      if (button) this.mark(button.dataset.mark);
    });
    $('#mark-undo').addEventListener('click', () => this.undoMark());
    $('#mark-clear').addEventListener('click', () => this.clearMarks());
    $('#record-song').innerHTML = `<option value="">Not in the list</option>${SONGS.map(s => `<option value="${s.id}">${escape(s.title)}</option>`).join('')}`;
    $('#record-song').addEventListener('change', event => this.setSong(event.target.value || null));
    $('#record-view').addEventListener('click', event => {
      const button = event.target.closest('[data-view]');
      if (button) this.setView(button.dataset.view);
    });
    $('#along-tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-along]');
      if (!button) return;
      this.keyboard.show(button.dataset.along);
      this.$$('#along-tabs [data-along]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    });
    this.keyboard.show('keys');
    $('#rec-cut').addEventListener('change', event => {
      this.cut(event.target.value);
      event.target.value = '';
    });
    $('#rec-assign').addEventListener('click', () => {
      this.assigning = !this.assigning;
      $('#rec-assign').setAttribute('aria-pressed', String(this.assigning));
      if (this.assigning) toast('Now touch the pad that should play the loop.');
    });
    const sampler = $('#sampler');
    const held = new Map();
    sampler.addEventListener('pointerdown', event => {
      const pad = event.target.closest('[data-slice]');
      if (!pad) return;
      event.preventDefault();
      const index = Number(pad.dataset.slice);
      held.set(event.pointerId, index);
      const velocity = event.pointerType === 'pen' && event.pressure > 0 ? Math.min(1, 0.2 + event.pressure) : 0.85;
      this.padOn(index, velocity);
    });
    const release = event => {
      if (!held.has(event.pointerId)) return;
      this.padOff(held.get(event.pointerId));
      held.delete(event.pointerId);
    };
    sampler.addEventListener('pointerup', release);
    sampler.addEventListener('pointercancel', release);
    sampler.addEventListener('contextmenu', event => event.preventDefault());
    this.bindWave();
    this.audio.addEventListener('ended', () => this.renderTransport());
    this.audio.addEventListener('pause', () => this.renderTransport());
  }

  // Touch the waveform to jump there; drag across it to loop that part.
  bindWave() {
    const canvas = this.$('#record-wave');
    let drag = null;
    const timeAt = event => {
      const box = canvas.getBoundingClientRect();
      return Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * this.duration;
    };
    canvas.addEventListener('pointerdown', event => {
      if (!this.buffer) return;
      canvas.setPointerCapture(event.pointerId);
      drag = { from: timeAt(event), x: event.clientX, moved: false };
    });
    canvas.addEventListener('pointermove', event => {
      if (!drag) return;
      if (Math.abs(event.clientX - drag.x) > 6) drag.moved = true;
      if (drag.moved) {
        const to = timeAt(event);
        this.selecting = { start: Math.min(drag.from, to), end: Math.max(drag.from, to) };
      }
    });
    const end = event => {
      if (!drag) return;
      if (drag.moved) {
        this.setLoop(this.selecting);
        if (this.loop) toast(`Looping ${clock(this.loop.start)}-${clock(this.loop.end)}. Touch Loop to stop looping.`);
      } else {
        const time = timeAt(event);
        if (this.loop && (time < this.loop.start || time > this.loop.end)) this.setLoop(null);
        this.seek(time);
      }
      this.selecting = null;
      drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => { drag = null; this.selecting = null; });
  }

  // ------------------------------------------------------------ keys

  keyDown(event) {
    const key = event.key.toLowerCase();
    if (key === ' ') {
      event.preventDefault();
      this.toggle();
      return;
    }
    if (this.view === 'pads' && PAD_KEYS.includes(key)) {
      this.padOn(PAD_KEYS.indexOf(key));
      return;
    }
    if (this.view === 'along' && PIANO_KEYS.includes(key) && this.keyboard.tab === 'keys') {
      this.keyboard.press(this.keyboard.low + PIANO_KEYS.indexOf(key), 0.75);
    } else if (this.view === 'along' && /^[1-9]$/.test(key)) {
      const pad = this.keyboard.pads[Number(key) - 1];
      if (pad) this.keyboard.handlers.padOn(pad, 0.8);
    }
  }

  keyUp(event) {
    const key = event.key.toLowerCase();
    if (this.view === 'pads' && PAD_KEYS.includes(key)) {
      this.padOff(PAD_KEYS.indexOf(key));
    } else if (this.view === 'along' && PIANO_KEYS.includes(key) && this.keyboard.tab === 'keys') {
      this.keyboard.release(this.keyboard.low + PIANO_KEYS.indexOf(key));
    } else if (this.view === 'along' && /^[1-9]$/.test(key)) {
      const pad = this.keyboard.pads[Number(key) - 1];
      if (pad) this.keyboard.handlers.padOff(pad);
    }
  }

  midiNote(note, velocity) {
    if (velocity > 0) this.keyboard.press(note, velocity);
    else this.keyboard.release(note);
  }

  // ------------------------------------------------------------ drawing

  loopFrame() {
    if (!this.active) return;
    if (this.loop && this.playing && this.time >= this.loop.end) this.audio.currentTime = this.loop.start;
    this.draw();
    this.frame = requestAnimationFrame(() => this.loopFrame());
  }

  draw() {
    if (!this.buffer) return;
    this.drawWave();
    if (this.view === 'along') this.drawLane();
    this.$('#rec-clock').textContent = `${clock(this.time)} / ${clock(this.duration)}`;
  }

  fit(canvas) {
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  drawWave() {
    const canvas = this.$('#record-wave');
    if (this.fit(canvas) || !this.wave) {
      this.wave = overview(this.buffer, canvas.width);
    }
    const g = canvas.getContext('2d');
    const { width, height } = canvas;
    const x = time => Math.round((time / this.duration) * width);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, width, height);
    g.fillStyle = '#000';
    const middle = height / 2;
    for (let i = 0; i < width; i++) {
      const h = Math.max(1, Math.round(this.wave[i] * (height - 8)));
      g.fillRect(i, Math.round(middle - h / 2), 1, h);
    }
    if (this.view === 'pads') {
      g.font = '16px Geneva, sans-serif';
      this.slices.forEach((slice, i) => {
        const left = x(slice.start);
        const right = Math.max(left + 2, x(slice.end));
        g.fillStyle = i === this.lastPad ? '#000' : '#fff';
        g.fillRect(left, 0, right - left, 4);
        g.strokeStyle = '#000';
        g.strokeRect(left + 0.5, 0.5, right - left - 1, 4);
      });
    }
    if (this.view === 'along') {
      const marks = this.track.sync.marks;
      g.fillStyle = '#000';
      for (const mark of marks) g.fillRect(x(mark.time), height - 6, 1, 6);
    }
    const shade = this.selecting || this.loop;
    if (shade) {
      g.globalCompositeOperation = 'difference';
      g.fillStyle = '#fff';
      g.fillRect(x(shade.start), 0, Math.max(1, x(shade.end) - x(shade.start)), height);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalCompositeOperation = 'difference';
    g.fillStyle = '#fff';
    g.fillRect(x(this.time) - 1, 0, 2, height);
    g.globalCompositeOperation = 'source-over';
  }

  drawLane() {
    const canvas = this.$('#chord-lane');
    this.fit(canvas);
    const g = canvas.getContext('2d');
    const { width, height } = canvas;
    const now = this.time;
    const span = BEFORE + AHEAD;
    const nowX = Math.round(width * (BEFORE / span));
    const x = time => Math.round(nowX + ((time - now) / span) * width);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, width, height);
    const chords = this.chordList();
    const index = chordAt(chords, now);
    const current = chords[index];
    g.textBaseline = 'middle';
    const top = 6;
    const boxHeight = height - 22;
    for (let i = Math.max(0, index - 3); i < chords.length; i++) {
      const chord = chords[i];
      if (chord.time > now + AHEAD) break;
      if (chord.end < now - BEFORE) continue;
      const left = x(chord.time);
      const right = x(chord.end);
      const on = chord === current;
      g.fillStyle = on ? '#000' : '#fff';
      g.fillRect(left, top, right - left, boxHeight);
      g.strokeStyle = '#000';
      g.lineWidth = 1;
      g.strokeRect(left + 0.5, top + 0.5, right - left - 1, boxHeight - 1);
      g.save();
      g.beginPath();
      g.rect(left + 2, top, Math.max(0, right - left - 4), boxHeight);
      g.clip();
      g.fillStyle = on ? '#fff' : '#000';
      g.font = `${on ? 34 : 24}px Chicago, sans-serif`;
      g.fillText(plain(chord.name), Math.max(left + 8, on ? nowX + 8 : left + 8), top + boxHeight / 2);
      g.restore();
    }
    // Beats along the bottom when the chords come from the song.
    if (this.song && !this.track.sync.marks.length) {
      const beat = 60 / (this.track.sync.bpm || this.song.bpm);
      g.fillStyle = '#000';
      const first = Math.ceil((now - BEFORE - this.track.sync.start) / beat);
      for (let n = first; ; n++) {
        const time = this.track.sync.start + n * beat;
        if (time > now + AHEAD) break;
        if (time >= 0) g.fillRect(x(time), height - 12, 1, n % this.song.cycle === 0 ? 10 : 5);
      }
    }
    // The "now" line, drawn as a dotted rule.
    g.fillStyle = '#000';
    for (let y = 0; y < height; y += 2) g.fillRect(nowX - 1, y, 2, 1);
    if (!chords.length) {
      g.fillStyle = '#000';
      g.font = '16px Geneva, sans-serif';
      g.fillText('No chords yet', nowX + 10, top + boxHeight / 2);
    }
    // Light the keys and pad of the chord that is playing now.
    const name = current?.name || null;
    if (name !== this.litChord) {
      this.litChord = name;
      const targets = new Set(name ? chordNotes(this.song, name) : []);
      this.keyboard.highlight({ targets, chord: name });
      this.$('#chord-now').textContent = name ? plain(name) : '-';
    }
  }
}

