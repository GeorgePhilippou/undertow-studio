// A record you own, opened from the desktop. Play shows its chords in time
// while it plays (slowed down without changing pitch, or looped) and lets you
// tap through the song's recognisable riff; Pads cuts it into three banks of
// sixteen sampler pads; Remix sequences them. The record never leaves this
// device.

import { Keyboard } from '../ui/keyboard.js';
import { SONGS } from '../songs.js';
import { getTrack, updateTrack, listTracks, decode } from './tracks.js';
import { songFor, timeline, chordAt, chordNotes, chordChoices } from './chart.js';
import { sliceAtAttacks, sliceEvenly, estimateBeat } from './slices.js';
import { TakeRecorder } from './take.js';
import { encodeWav } from '../render.js';
import { savePiece } from './pieces.js';
import { toast, escape, showDialog } from '../ui/mac.js';
import { Sampler, MODES } from './sampler.js';
import { RiffView } from './riffs.js';
import { Remix } from './remix.js';
import { ICONS } from '../ui/icons.js';

const PAD_KEYS = '1234qwerasdfzxcv';
const PIANO_KEYS = 'awsedftgyhujkolp;';
const SPEEDS = [1, 0.9, 0.8, 0.75, 0.7, 0.6, 0.5];
const BEFORE = 2;
const AHEAD = 8;
const BANKS = 'ABC';
const FADES = [[0, 'No fade'], [10, 'Short fade'], [40, 'Soft fade'], [150, 'Long fade']];

const plain = name => name.replace(/♭/g, 'b').replace(/♯/g, '#');

export const clock = seconds => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class RecordScreen {
  constructor({ engine, $, onPlaying, showPiece, records, openRecord }) {
    this.showPiece = showPiece;
    this.records = records || (() => []);
    this.openRecord = openRecord || (() => {});
    this.engine = engine;
    this.context = engine.context;
    this.$ = $;
    this.onPlaying = onPlaying || (() => {});
    this.view = 'play';
    this.loop = null;
    this.editing = null;
    this.bank = 0;
    this.banks = [[], null, null];
    // While editing a pad the waveform shows a close-up of it, or the whole
    // song to choose a different part.
    this.zoomed = true;
    this.undoStack = [];
    this.voices = new Map();
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.preservesPitch = true;
    this.audio.webkitPreservesPitch = true;
    this.audio.mozPreservesPitch = true;
    // The record plays straight from the audio element: Safari can fall
    // silent when a blob: file is routed into Web Audio, and a finished record
    // needs no compressor or reverb anyway. Pads play through this gain.
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
    this.sampler = new Sampler(this.context, this.output);
    this.recorder = new TakeRecorder(this.context, [this.output, engine.master]);
    this.riffs = new RiffView(this);
    this.remix = new Remix(this);
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

  // The pads of the bank on screen.
  get slices() {
    return this.banks[this.bank];
  }

  set slices(slices) {
    this.banks[this.bank] = slices;
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
    this.audio.volume = 1;
    this.audio.muted = false;
    this.audio.playbackRate = this.speed || 1;
    if (this.track.sync.start === null) this.track.sync.start = this.firstSound();
    if (!this.track.sync.estimate) this.track.sync.estimate = estimateBeat(this.buffer);
    this.$('#pad-snap').checked = this.track.snap !== false;
    this.bank = 0;
    this.banks = stored.banks?.length ? stored.banks.map(bank => bank && bank.map(slice => ({ ...slice }))) : [stored.slices || sliceAtAttacks(this.buffer), null, null];
    this.undoStack = [];
    if (!stored.slices) this.save({ sync: this.track.sync });
    this.sampler.setBuffer(this.buffer);
    this.loadBorrowed();
    this.riffs.setRecord(this.buffer);
    this.remix.load(this.track);
    this.editing = null;
    const fx = this.track.fx || {};
    this.$('#fx-filter').value = Math.round((fx.filter || 0) * 100);
    this.$('#fx-echo').value = Math.round((fx.echo || 0) * 100);
    this.applyFx();
    this.wave = null;
    this.$('#record-title').textContent = this.track.name;
    this.renderPicker();
    this.$('#record-song').value = this.track.songId || '';
    this.setSong(this.track.songId, false);
    this.renderPads();
    this.setView(['play', 'pads', 'remix'].includes(this.view) ? this.view : 'play');
  }

  // The menu of records at the top of the window, to switch to another.
  renderPicker() {
    const records = this.records();
    const list = records.some(r => r.id === this.track.id) ? records : [{ id: this.track.id, name: this.track.name }, ...records];
    this.$('#record-pick').innerHTML = list.map(r => `<option value="${r.id}">${escape(r.name)}</option>`).join('');
    this.$('#record-pick').value = this.track.id;
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
    this.riffs.setSong(this.song);
    this.remix.renderTempo();
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
    this.saveTimer = setTimeout(() => this.flush(), 300);
  }

  // Writes any changes waiting to be saved straight away.
  async flush() {
    clearTimeout(this.saveTimer);
    if (!this.track) return;
    await updateTrack(this.track.id, { songId: this.track.songId, sync: this.track.sync, slices: this.banks[0], banks: this.banks, remix: this.track.remix, fx: this.track.fx, snap: this.track.snap }).catch(() => {});
  }

  enter() {
    this.active = true;
    this.wave = null;
    cancelAnimationFrame(this.frame);
    this.recorder.attach();
    this.loopFrame();
  }

  leave() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.stop();
    this.remix.stop();
    this.riffs.stopDemo();
    if (this.recorder.recording) this.toggleTake();
    this.recorder.detach();
    this.releaseAll();
  }

  // ------------------------------------------------------------ takes

  // Record what you play here; Stop keeps it in My Pieces as a WAV file.
  async toggleTake() {
    const button = this.$('#rec-take');
    if (!this.recorder.recording) {
      // Start at once, so a quick second tap always stops this take.
      this.context.resume();
      this.recorder.start();
      button.setAttribute('aria-pressed', 'true');
      button.classList.add('armed');
      button.querySelector('span:last-child').textContent = 'Stop';
      toast('Recording. Play the pads, the riff or the keys, then press Stop.');
      return;
    }
    const buffer = this.recorder.stop();
    button.setAttribute('aria-pressed', 'false');
    button.classList.remove('armed');
    button.querySelector('span:last-child').textContent = 'Record';
    this.$('#take-time').textContent = '';
    if (!buffer) {
      toast('Nothing was recorded. Press Record, then play something.');
      return;
    }
    const { blob, seconds } = encodeWav(buffer);
    const names = { play: 'play', pads: 'pads', remix: 'remix' };
    const piece = { id: `piece-${Date.now().toString(36)}`, record: this.track.id, title: `${this.track.name} (${names[this.view]})`, created: new Date().toISOString(), seconds, video: false, blob };
    try {
      await savePiece(piece);
    } catch {
      toast('The take could not be kept in this browser; save it now.');
    }
    this.lastTake = piece;
    this.showPiece?.(piece, true);
  }

  // ------------------------------------------------------------ transport

  play() {
    if (!this.track) return;
    if (this.loop && (this.time < this.loop.start || this.time >= this.loop.end)) this.audio.currentTime = this.loop.start;
    this.remix.stop();
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
    this.onPlaying(this.playing || this.remix?.playing);
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
    this.track.sync.bpm = Math.round((this.bpm + amount) * 10) / 10;
    this.chords = null;
    this.save({});
    this.renderSync();
    this.remix.renderTempo();
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
    const heard = !this.track.sync.bpm && !this.song && this.track.sync.estimate;
    $('#rec-bpm').textContent = `${this.bpm.toFixed(1)} BPM${heard ? '?' : ''}`;
    $('#rec-start').hidden = !this.song || marks > 0;
    $('#mark-undo').disabled = !marks;
    $('#mark-clear').disabled = !marks;
    let hint;
    if (marks) hint = `Showing the ${marks} chord${marks === 1 ? '' : 's'} you marked. Clear Marks to go back${this.song ? ' to the song\'s chart' : ''}.`;
    else if (this.song) hint = `Chords from ${this.song.title}, starting at ${clock(this.track.sync.start)}.${Math.floor((this.track.sync.start % 1) * 10)}. If they are early or late, press Set Start the moment you hear the first ${plain(this.chordList()[0]?.name || 'chord')}. They repeat one passage of the song, so other sections of the record may differ.`;
    else hint = `Choose the song above to see its chords, or press Mark Chords and tap each chord as you hear it.${heard ? ` The tempo, about ${this.bpm.toFixed(0)} BPM, is heard from the record; nudge it if the pads drift.` : ''}`;
    $('#along-hint').textContent = hint;
  }

  // ------------------------------------------------------------ keyboard

  // With a riff, the keys sound like the song's own part; otherwise a piano.
  noteOn(midi, velocity) {
    this.noteOff(midi);
    const instrument = this.riffs.riff ? this.riffs.riff.instrument : 'piano';
    const output = this.engine.channel(`along-${instrument}`, { instrument, volume: 0.9 });
    this.voices.set(midi, this.engine.noteOn(instrument, midi, velocity, this.context.currentTime, output));
    if (!this.playing) this.riffs.notePlayed(midi);
  }

  noteOff(midi) {
    this.voices.get(midi)?.release(this.context.currentTime);
    this.voices.delete(midi);
  }

  releaseAll() {
    this.keyboard.releaseAll();
    for (const midi of [...this.voices.keys()]) this.noteOff(midi);
    this.sampler.stopAll();
    this.$$('#sampler .pad.down').forEach(pad => pad.classList.remove('down'));
  }

  // ------------------------------------------------------------ pads

  // The tempo: as nudged, the song's, or the one heard in the record.
  get bpm() {
    return this.track?.sync.bpm || this.song?.bpm || this.track?.sync.estimate?.bpm || 120;
  }

  get beatLength() {
    return 60 / this.bpm;
  }

  // Where beat one falls: the chart's start for known songs, otherwise the
  // first beat heard in the record.
  get gridStart() {
    if (this.song) return this.track.sync.start || 0;
    return this.track?.sync.estimate?.start ?? this.track?.sync.start ?? 0;
  }

  get snapping() {
    return this.$('#pad-snap').checked;
  }

  // The nearest point on the beat grid, a sixteenth note by default.
  snap(time, unit = this.beatLength / 4) {
    const origin = this.gridStart;
    return Math.max(0, origin + Math.round((time - origin) / unit) * unit);
  }

  // Lines every pad up with the beat: starts on the nearest sixteenth and
  // lengths in whole sixteenths, so chopped bars loop without a stumble.
  snapAll() {
    const unit = this.beatLength / 4;
    this.slices = this.slices.map(slice => {
      const start = this.snap(slice.start);
      const length = Math.max(unit, Math.round((slice.end - slice.start) / unit) * unit);
      return { ...slice, start, end: Math.min(start + length, this.duration) };
    });
  }

  // Each pad's own name for the sampler, so pads in different banks never cut
  // each other off. Bank A keeps the plain names.
  padKey(index, bank = this.bank) {
    return bank ? `pad-${BANKS[bank]}${index}` : `pad-${index}`;
  }

  // A bank's pads, cut the first time it is used: bank B is a bar per pad
  // from the first beat, bank C two bars per pad after that.
  bankSlices(bank) {
    if (!this.banks[bank]) {
      const bar = this.beatLength * (this.song?.barLengths?.[0] || 4);
      const size = bank === 1 ? bar : bar * 2;
      const from = this.gridStart + (bank === 1 ? 0 : bar * 16);
      this.banks[bank] = [...Array(16).keys()].map(i => {
        const start = Math.max(0, Math.min(from + i * size, this.duration - size));
        return { start, end: Math.min(start + size, this.duration) };
      });
      this.save({});
    }
    return this.banks[bank];
  }

  setBank(bank) {
    this.bankSlices(bank);
    this.bank = bank;
    if (this.editing !== null) this.editing = Math.min(this.editing, 15);
    this.$$('#pad-banks [data-bank]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.bank) === bank)));
    this.renderPads();
  }

  // ------------------------------------------------------------ undo

  // Every change to the pads can be taken back, up to thirty steps.
  remember(label) {
    this.undoStack.push({ label, bank: this.bank, banks: JSON.parse(JSON.stringify(this.banks)) });
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.renderUndo();
  }

  undo() {
    const last = this.undoStack.pop();
    if (!last) return;
    this.sampler.stopAll();
    this.banks = last.banks;
    this.setBank(last.bank);
    this.save({});
    this.renderUndo();
    toast(`Undid ${last.label}.`);
  }

  renderUndo() {
    const last = this.undoStack.at(-1);
    const button = this.$('#pad-undo');
    button.disabled = !last;
    button.textContent = last ? `Undo ${last.label}` : 'Undo';
  }

  // ------------------------------------------------------------ borrowing

  // Pads borrowed from other records need those records' songs decoded.
  async loadBorrowed() {
    const sources = new Set(this.banks.flat().filter(slice => slice?.source).map(slice => slice.source));
    for (const id of sources) {
      if (this.sampler.buffers.has(id)) continue;
      try {
        const stored = await getTrack(id);
        if (stored) this.sampler.buffers.set(id, await decode(this.context, stored.blob));
      } catch {
        // The other record was removed; its pads stay silent.
      }
    }
    if (sources.size) this.renderPads();
  }

  // Edit Pad > From Another Record: copy a pad from any other record.
  async borrow() {
    const index = this.editing;
    if (index === null) return;
    const others = (await listTracks()).filter(t => t.id !== this.track.id);
    if (!others.length) {
      toast('Load another record first, then borrow its pads here.');
      return;
    }
    const chosen = await showDialog(`
      <h3>Borrow a Pad</h3>
      <p class="small">Choose a record. Pad ${index + 1} will play one of its pads, mixed into this record.</p>
      <div class="list-box">${others.map(t => `<button data-value="${t.id}"><span>${escape(t.name)}</span><span>${Math.round(t.seconds / 60)} min</span></button>`).join('')}</div>
      <div class="button-row"><button class="btn default" data-value="cancel">Cancel</button></div>`, { defaultValue: 'cancel' });
    const record = others.find(t => t.id === chosen.value);
    if (!record) return;
    const stored = await getTrack(record.id);
    const banks = stored.banks?.length ? stored.banks : [stored.slices || []];
    const choices = [];
    banks.forEach((bank, b) => bank?.forEach((slice, i) => { if (!slice.source) choices.push({ label: `${BANKS[b]}${i + 1}`, slice }); }));
    if (!choices.length) {
      toast(`${record.name} has no pads yet. Open it once to cut them.`);
      return;
    }
    const picked = await showDialog(`
      <h3>Pads of ${escape(record.name)}</h3>
      <div class="list-box">${choices.map((c, n) => `<button data-value="${n}"><span>Pad ${c.label}</span><span>${clock(c.slice.start)} for ${(c.slice.end - c.slice.start).toFixed(1)} s</span></button>`).join('')}</div>
      <div class="button-row"><button class="btn default" data-value="cancel">Cancel</button></div>`, { defaultValue: 'cancel' });
    const choice = choices[Number(picked.value)];
    if (!choice || picked.value === 'cancel') return;
    if (!this.sampler.buffers.has(record.id)) this.sampler.buffers.set(record.id, await decode(this.context, stored.blob));
    this.remember('Borrow');
    this.slices[index] = { ...choice.slice, source: record.id, from: record.name };
    this.save({});
    this.renderPads();
    this.audition(index);
    toast(`Pad ${index + 1} now plays pad ${choice.label} of ${record.name}.`);
  }

  renderPads() {
    const $ = this.$;
    $('#sampler').innerHTML = this.slices.map((slice, i) => {
      const tags = [slice.mode && slice.mode !== 'once' ? MODES[slice.mode] : '', slice.pitch ? `${slice.pitch > 0 ? '+' : ''}${slice.pitch}` : '', slice.reverse ? 'Rev' : '', slice.volume !== undefined && slice.volume !== 1 ? `${Math.round(slice.volume * 100)}%` : ''].filter(Boolean).join(' ');
      const where = slice.source ? `from ${escape(slice.from || 'another record')}` : clock(slice.start);
      return `
      <button class="pad sample${i === this.editing ? ' editing' : ''}${slice.source ? ' borrowed' : ''}" data-slice="${i}" aria-label="Pad ${BANKS[this.bank]}${i + 1}">
        <span class="number">${BANKS[this.bank]}${i + 1}<span class="key">${PAD_KEYS[i].toUpperCase()}</span></span>
        <canvas width="192" height="32"></canvas>
        <small>${where} - ${(slice.end - slice.start).toFixed(1)} s${tags ? ` - ${tags}` : ''}</small>
      </button>`;
    }).join('');
    this.$$('#sampler canvas').forEach((canvas, i) => this.drawSlice(canvas, this.slices[i]));
    this.renderEditor();
    this.renderUndo();
  }

  drawSlice(canvas, slice) {
    const g = canvas.getContext('2d');
    const buffer = this.sampler.bufferOf(slice);
    if (!buffer) {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#000';
      g.font = '16px Geneva, sans-serif';
      g.fillText('Not loaded', 4, canvas.height / 2 + 5);
      canvas.base = g.getImageData(0, 0, canvas.width, canvas.height);
      return;
    }
    const data = buffer.getChannelData(0);
    const rate = buffer.sampleRate;
    const from = Math.floor(slice.start * rate);
    const to = Math.floor(slice.end * rate);
    const step = Math.max(1, Math.floor((to - from) / canvas.width));
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#000';
    for (let x = 0; x < canvas.width; x++) {
      let peak = 0;
      for (let i = from + x * step; i < from + (x + 1) * step && i < data.length; i += 8) peak = Math.max(peak, Math.abs(data[i]));
      const h = Math.max(1, Math.round(peak * canvas.height));
      const column = slice.reverse ? canvas.width - 1 - x : x;
      g.fillRect(column, Math.round((canvas.height - h) / 2), 1, h);
    }
    canvas.base = g.getImageData(0, 0, canvas.width, canvas.height);
    canvas.through = null;
  }

  // While a pad plays, the part already heard is inverted and a line moves
  // across its waveform, here and on the record's waveform above.
  drawPadProgress() {
    this.$$('#sampler canvas').forEach((canvas, i) => {
      const through = this.sampler.progress(this.padKey(i));
      if (through === canvas.through || !canvas.base) return;
      canvas.through = through;
      const g = canvas.getContext('2d');
      g.putImageData(canvas.base, 0, 0);
      if (through === null) return;
      const x = Math.round(through * canvas.width);
      g.globalCompositeOperation = 'difference';
      g.fillStyle = '#fff';
      g.fillRect(0, 0, x, canvas.height);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000';
      g.fillRect(Math.min(x, canvas.width - 2), 0, 2, canvas.height);
    });
  }

  // Where each sounding pad is in the record, for the big waveform.
  padPlayheads() {
    const heads = [];
    this.slices.forEach((slice, i) => {
      const through = this.sampler.progress(this.padKey(i));
      if (through === null || slice.source) return;
      const length = slice.end - slice.start;
      heads.push(slice.reverse ? slice.end - through * length : slice.start + through * length);
    });
    return heads;
  }

  padElement(index) {
    return this.$(`#sampler [data-slice="${index}"]`);
  }

  padOn(index, velocity = 0.85) {
    const slice = this.slices[index];
    if (!slice) return;
    if (this.assigning) {
      this.remember('Loop to Pad');
      this.slices[index] = { ...slice, start: this.loop.start, end: this.loop.end, source: undefined, from: undefined };
      this.assigning = false;
      this.$('#rec-assign').setAttribute('aria-pressed', 'false');
      this.save({});
      this.renderPads();
      toast(`Pad ${index + 1} now plays ${clock(this.loop.start)}-${clock(this.loop.end)}.`);
      return;
    }
    if (this.$('#pad-edit').getAttribute('aria-pressed') === 'true' && this.view === 'pads') this.selectPad(index);
    const key = this.padKey(index);
    const pad = this.padElement(index);
    if (slice.mode === 'loop' && this.sampler.playing(key)) {
      this.sampler.stop(key);
      pad?.classList.remove('down');
      return;
    }
    pad?.classList.add('down');
    this.lastPad = index;
    // Loops join in on the beat of any loop already going.
    const synced = slice.mode === 'loop' && this.$('#pad-sync').checked;
    this.sampler.play(key, slice, {
      velocity,
      ...(synced ? { time: this.sampler.syncedStart(this.beatLength) } : {}),
      onEnd: () => {
        if (!this.sampler.playing(key)) this.padElement(index)?.classList.remove('down');
      },
    });
  }

  padOff(index) {
    if (this.slices[index]?.mode !== 'hold') return;
    this.sampler.stop(this.padKey(index));
    this.padElement(index)?.classList.remove('down');
  }

  // Cuts all sixteen pads again: at the record's attacks, the loop into
  // sixteen, or sixteen pads of a beat, a bar, two bars or four bars each,
  // from the loop or the playhead.
  cut(how) {
    const beat = this.beatLength;
    const bar = beat * (this.song?.barLengths?.[0] || 4);
    const from = this.loop ? this.loop.start : this.snapping ? this.snap(this.time, beat) : this.time;
    const lengths = { beat, bar, bars2: bar * 2, bars4: bar * 4 };
    if (how !== 'loop' || this.loop) this.remember(how === 'snap' ? 'Snap' : 'Cut Pads');
    if (how === 'snap') {
      this.snapAll();
      this.save({});
      this.renderPads();
      toast(`Every pad now starts on the beat at ${this.bpm.toFixed(1)} BPM.`);
      return;
    }
    if (how === 'attacks') {
      this.slices = sliceAtAttacks(this.buffer);
    } else if (how === 'loop') {
      if (!this.loop) {
        toast('Drag across the waveform to make a loop first.');
        return;
      }
      this.slices = sliceEvenly(this.loop.start, this.loop.end);
    } else if (lengths[how]) {
      const size = lengths[how];
      this.slices = [...Array(16).keys()].map(i => {
        const start = Math.min(from + i * size, Math.max(0, this.duration - size));
        return { start, end: Math.min(start + size, this.duration) };
      });
    } else {
      return;
    }
    this.save({});
    this.renderPads();
    toast('The pads are cut.');
  }

  // ------------------------------------------------------------ pad editor

  selectPad(index) {
    this.editing = index;
    this.$$('#sampler .pad.editing').forEach(pad => pad.classList.remove('editing'));
    this.padElement(index)?.classList.add('editing');
    this.renderEditor();
  }

  setZoom(zoomed) {
    this.zoomed = zoomed;
    const button = this.$('#wave-zoom');
    button.setAttribute('aria-pressed', String(zoomed));
    button.textContent = zoomed ? 'Whole Song' : 'Zoom In';
  }

  toggleEditing() {
    const on = this.$('#pad-edit').getAttribute('aria-pressed') !== 'true';
    this.$('#pad-edit').setAttribute('aria-pressed', String(on));
    this.$('#pad-editor').hidden = !on;
    this.$('#wave-zoom').hidden = !on;
    if (on) {
      this.selectPad(this.lastPad ?? 0);
      toast('Touch a pad to edit it. Drag across the waveform to set where it starts and ends; Whole Song zooms out to choose any part.');
    } else {
      this.editing = null;
      this.$$('#sampler .pad.editing').forEach(pad => pad.classList.remove('editing'));
    }
  }

  renderEditor() {
    const slice = this.slices?.[this.editing];
    if (!slice) return;
    const $ = this.$;
    $('#edit-label').textContent = `Pad ${BANKS[this.bank]}${this.editing + 1}: ${slice.source ? `from ${slice.from || 'another record'}, ` : ''}${clock(slice.start)}.${Math.floor((slice.start % 1) * 10)} for ${(slice.end - slice.start).toFixed(2)} s`;
    $('#edit-vol').textContent = `${Math.round((slice.volume ?? 1) * 100)}%`;
    $('#edit-fade').value = String(slice.fade || 0);
    this.$$('#edit-mode [data-mode]').forEach(b => b.setAttribute('aria-pressed', String((slice.mode || 'once') === b.dataset.mode)));
    $('#edit-pitch').textContent = `${slice.pitch > 0 ? '+' : ''}${slice.pitch || 0}`;
    $('#edit-reverse').checked = Boolean(slice.reverse);
  }

  changePad(change, label = 'Edit Pad') {
    const index = this.editing;
    if (index === null) return;
    this.remember(label);
    const slice = { ...this.slices[index], ...change };
    const length = this.sampler.bufferOf(slice)?.duration || this.duration;
    slice.start = Math.max(0, Math.min(slice.start, length - 0.05));
    slice.end = Math.max(slice.start + 0.05, Math.min(slice.end, length));
    this.slices[index] = slice;
    this.save({});
    this.renderPads();
  }

  setPadRegion(index, region) {
    if (!region || region.end - region.start < 0.05) return;
    if (this.snapping) {
      const start = this.snap(region.start);
      region = { start, end: Math.max(start + this.beatLength / 4, this.snap(region.end)) };
    }
    this.changePad({ start: region.start, end: region.end });
    this.audition(index);
  }

  // Plays a pad from the start after a change, even a looping one.
  audition(index) {
    this.sampler.stop(this.padKey(index));
    this.padOn(index);
  }

  // While a pad of this record is edited, the waveform zooms in around it.
  get range() {
    const slice = this.view === 'pads' && this.editing !== null && this.zoomed ? this.slices[this.editing] : null;
    if (!slice || slice.source || !this.duration) return { from: 0, to: this.duration || 1 };
    const length = slice.end - slice.start;
    const span = Math.min(this.duration, Math.max(2, length * 3));
    const from = Math.max(0, Math.min(slice.start - (span - length) / 2, this.duration - span));
    return { from, to: from + span };
  }

  // Loudness per column across a stretch of the record, for drawing.
  peaks(from, to, columns) {
    const key = `${from}-${to}-${columns}`;
    if (this.peakKey === key) return this.peakCache;
    const data = this.buffer.getChannelData(0);
    const rate = this.buffer.sampleRate;
    const first = Math.floor(from * rate);
    const step = Math.max(1, ((to - from) * rate) / columns);
    const stride = Math.max(1, Math.floor(step / 64));
    const peaks = new Float32Array(columns);
    let loudest = 0;
    for (let c = 0; c < columns; c++) {
      let peak = 0;
      const start = first + Math.floor(c * step);
      for (let i = start; i < start + step && i < data.length; i += stride) peak = Math.max(peak, Math.abs(data[i]));
      peaks[c] = peak;
      loudest = Math.max(loudest, peak);
    }
    for (let c = 0; c < columns; c++) peaks[c] = loudest ? peaks[c] / loudest : 0;
    this.peakKey = key;
    this.peakCache = peaks;
    return peaks;
  }

  // Nudges by a sixteenth note when the tempo is known.
  nudgePad(edge, direction) {
    const slice = this.slices[this.editing];
    if (!slice) return;
    const step = this.beatLength / 4 * direction;
    const moved = slice[edge] + step;
    this.changePad({ [edge]: this.snapping ? this.snap(moved) : moved });
    this.audition(this.editing);
  }

  // ------------------------------------------------------------ effects

  applyFx() {
    const filter = Number(this.$('#fx-filter').value) / 100;
    const echo = Number(this.$('#fx-echo').value) / 100;
    this.sampler.setFilter(filter);
    this.sampler.setEcho(echo, this.remix.bpm);
    if (this.track) this.track.fx = { filter, echo };
  }

  // ------------------------------------------------------------ view

  setView(view) {
    if (this.view !== view) {
      this.remix.stop();
      this.riffs.stopDemo();
      if (view === 'remix') this.remix.render();
    }
    this.view = view;
    this.$('#record-window').dataset.view = view;
    this.$$('#record-view [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    this.releaseAll();
    this.wave = null;
    this.litChord = undefined;
    this.riffs.lit = null;
    this.renderTransport();
    if (view === 'play') {
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
    $('#record-pick').addEventListener('change', async event => {
      const id = event.target.value;
      if (id === this.track?.id) return;
      await this.flush();
      this.openRecord(id);
    });
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
    $('#pad-edit').addEventListener('click', () => this.toggleEditing());
    $('#pad-undo').addEventListener('click', () => this.undo());
    $('#pad-banks').addEventListener('click', event => {
      const button = event.target.closest('[data-bank]');
      if (button) this.setBank(Number(button.dataset.bank));
    });
    $('#edit-borrow').addEventListener('click', () => this.borrow());
    $('#wave-zoom').addEventListener('click', () => this.setZoom(!this.zoomed));
    $('#edit-fade').innerHTML = FADES.map(([ms, name]) => `<option value="${ms}">${name}</option>`).join('');
    $('#edit-fade').addEventListener('change', event => {
      this.changePad({ fade: Number(event.target.value) }, 'Fade');
      this.audition(this.editing);
    });
    $('#edit-vol-down').addEventListener('click', () => {
      this.changePad({ volume: Math.max(0, Math.round(((this.slices[this.editing].volume ?? 1) - 0.1) * 10) / 10) }, 'Volume');
      this.audition(this.editing);
    });
    $('#edit-vol-up').addEventListener('click', () => {
      this.changePad({ volume: Math.min(2, Math.round(((this.slices[this.editing].volume ?? 1) + 0.1) * 10) / 10) }, 'Volume');
      this.audition(this.editing);
    });
    $('#rec-take').addEventListener('click', () => this.toggleTake());
    $('#pad-snap').addEventListener('change', event => this.save({ snap: event.target.checked }));
    $('#edit-start-down').addEventListener('click', () => this.nudgePad('start', -1));
    $('#edit-start-up').addEventListener('click', () => this.nudgePad('start', 1));
    $('#edit-end-down').addEventListener('click', () => this.nudgePad('end', -1));
    $('#edit-end-up').addEventListener('click', () => this.nudgePad('end', 1));
    $('#edit-mode').addEventListener('click', event => {
      const button = event.target.closest('[data-mode]');
      if (!button) return;
      this.sampler.stop(this.padKey(this.editing));
      this.changePad({ mode: button.dataset.mode }, 'Mode');
    });
    $('#edit-pitch-down').addEventListener('click', () => {
      this.changePad({ pitch: Math.max(-12, (this.slices[this.editing].pitch || 0) - 1) }, 'Pitch');
      this.audition(this.editing);
    });
    $('#edit-pitch-up').addEventListener('click', () => {
      this.changePad({ pitch: Math.min(12, (this.slices[this.editing].pitch || 0) + 1) }, 'Pitch');
      this.audition(this.editing);
    });
    $('#edit-reverse').addEventListener('change', event => {
      this.changePad({ reverse: event.target.checked }, 'Reverse');
      this.audition(this.editing);
    });
    for (const id of ['#fx-filter', '#fx-echo']) {
      $(id).addEventListener('input', () => this.applyFx());
      $(id).addEventListener('change', () => this.save({}));
    }
    const sampler = $('#sampler');
    const held = new Map();
    sampler.addEventListener('pointerdown', event => {
      const pad = event.target.closest('[data-slice]');
      if (!pad) return;
      event.preventDefault();
      const index = Number(pad.dataset.slice);
      held.set(event.pointerId, index);
      // Keep the finger's pad even if it slides off, so Hold always lets go.
      try { sampler.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
      const velocity = event.pointerType === 'pen' && event.pressure > 0 ? Math.min(1, 0.2 + event.pressure) : 0.85;
      this.padOn(index, velocity);
    });
    const release = event => {
      if (!held.has(event.pointerId)) return;
      this.padOff(held.get(event.pointerId));
      held.delete(event.pointerId);
    };
    sampler.addEventListener('pointerup', release);
    // Only the grid's own capture ending means the finger has gone; a pad
    // handing its capture over to the grid does not.
    sampler.addEventListener('lostpointercapture', event => {
      if (event.target === sampler) release(event);
    });
    sampler.addEventListener('pointercancel', release);
    sampler.addEventListener('contextmenu', event => event.preventDefault());
    this.bindWave();
    this.audio.addEventListener('ended', () => this.renderTransport());
    this.audio.addEventListener('pause', () => this.renderTransport());
    this.audio.addEventListener('error', () => {
      if (this.audio.src) toast('This browser cannot play this file. Try an MP3 or M4A, or another browser.');
    });
  }

  // Touch the waveform to jump there; drag across it to loop that part.
  bindWave() {
    const canvas = this.$('#record-wave');
    let drag = null;
    const timeAt = event => {
      const box = canvas.getBoundingClientRect();
      const { from, to } = this.range;
      return from + Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * (to - from);
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
      if (drag.moved && this.editing !== null && this.view === 'pads') {
        this.setPadRegion(this.editing, this.selecting);
      } else if (drag.moved) {
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
    const padKeys = this.view === 'pads' || this.view === 'remix';
    if (key === 'enter' && this.view === 'play') {
      event.preventDefault();
      this.riffs.tap();
      return;
    }
    if (key === ' ') {
      event.preventDefault();
      if (this.view === 'remix') this.remix.togglePlay();
      else this.toggle();
      return;
    }
    if (padKeys && PAD_KEYS.includes(key)) {
      this.padOn(PAD_KEYS.indexOf(key));
      return;
    }
    const keys = this.view === 'play';
    if (keys && PIANO_KEYS.includes(key) && this.keyboard.tab === 'keys') {
      this.keyboard.press(this.keyboard.low + PIANO_KEYS.indexOf(key), 0.75);
    } else if (keys && /^[1-9]$/.test(key)) {
      const pad = this.keyboard.pads[Number(key) - 1];
      if (pad) this.keyboard.handlers.padOn(pad, 0.8);
    }
  }

  keyUp(event) {
    const key = event.key.toLowerCase();
    const keys = this.view === 'play';
    if ((this.view === 'pads' || this.view === 'remix') && PAD_KEYS.includes(key)) {
      this.padOff(PAD_KEYS.indexOf(key));
    } else if (keys && PIANO_KEYS.includes(key) && this.keyboard.tab === 'keys') {
      this.keyboard.release(this.keyboard.low + PIANO_KEYS.indexOf(key));
    } else if (keys && /^[1-9]$/.test(key)) {
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
    // The keys show the riff's next hit when stopped, the chord when playing.
    if (this.playing !== this.wasPlaying) {
      this.wasPlaying = this.playing;
      this.litChord = undefined;
      this.riffs.lit = null;
    }
    this.drawWave();
    if (this.view === 'play') {
      this.drawLane();
      this.riffs.draw();
    } else if (this.view === 'remix') {
      this.remix.drawStep();
    }
    if (this.view === 'pads') this.drawPadProgress();
    this.$('#rec-clock').textContent = `${clock(this.time)} / ${clock(this.duration)}`;
    if (this.recorder.recording) this.$('#take-time').textContent = clock(this.recorder.seconds);
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
    this.fit(canvas);
    const g = canvas.getContext('2d');
    const { width, height } = canvas;
    const { from, to } = this.range;
    this.wave = this.peaks(from, to, width);
    const x = time => Math.round(((time - from) / (to - from)) * width);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, width, height);
    g.fillStyle = '#000';
    const middle = height / 2;
    for (let i = 0; i < width; i++) {
      const h = Math.max(1, Math.round(this.wave[i] * (height - 8)));
      g.fillRect(i, Math.round(middle - h / 2), 1, h);
    }
    if (this.view === 'pads' || this.view === 'remix') {
      this.slices.forEach((slice, i) => {
        if (slice.source) return;
        const left = x(slice.start);
        const right = Math.max(left + 2, x(slice.end));
        g.fillStyle = i === this.lastPad ? '#000' : '#fff';
        g.fillRect(left, 0, right - left, 4);
        g.strokeStyle = '#000';
        g.strokeRect(left + 0.5, 0.5, right - left - 1, 4);
      });
      // Bars along the bottom, so cuts can be lined up with the beat.
      const bar = this.beatLength * (this.song?.barLengths?.[0] || 4);
      const visible = to - from;
      const tick = bar * width / visible >= 4 ? bar : null;
      const fine = this.beatLength / 4;
      if (tick) {
        g.fillStyle = '#000';
        for (let at = this.gridStart + Math.ceil((from - this.gridStart) / tick) * tick; at < to; at += tick) g.fillRect(x(at), height - 6, 1, 6);
        // Zoomed in, the sixteenth-note grid shows too.
        if (fine * width / visible >= 6) {
          for (let at = this.gridStart + Math.ceil((from - this.gridStart) / fine) * fine; at < to; at += fine) g.fillRect(x(at), height - 2, 1, 2);
        }
      }
      const edited = this.editing !== null && !this.selecting ? this.slices[this.editing] : null;
      if (edited && !edited.source) {
        g.globalCompositeOperation = 'difference';
        g.fillStyle = '#fff';
        g.fillRect(x(edited.start), 6, Math.max(1, x(edited.end) - x(edited.start)), height - 6);
        g.globalCompositeOperation = 'source-over';
      }
    }
    if (this.view === 'play' && this.riffs.riff) {
      const region = this.riffs.region();
      g.fillStyle = '#000';
      for (const hit of this.riffs.riff.hits) g.fillRect(x(region.start + hit.beat * this.riffs.beat), 0, 1, 8);
      g.strokeStyle = '#000';
      g.strokeRect(x(region.start) + 0.5, 0.5, Math.max(2, x(region.end) - x(region.start)), height - 1);
    }
    if (this.view === 'play') {
      const marks = this.track.sync.marks;
      g.fillStyle = '#000';
      for (const mark of marks) g.fillRect(x(mark.time), height - 6, 1, 6);
    }
    const shade = this.selecting || (this.view === 'pads' && this.editing !== null ? null : this.loop);
    if (shade) {
      g.globalCompositeOperation = 'difference';
      g.fillStyle = '#fff';
      g.fillRect(x(shade.start), 0, Math.max(1, x(shade.end) - x(shade.start)), height);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalCompositeOperation = 'difference';
    g.fillStyle = '#fff';
    g.fillRect(x(this.time) - 1, 0, 2, height);
    if (this.view === 'pads' || this.view === 'remix') {
      for (const head of this.padPlayheads()) g.fillRect(x(head), 6, 1, height - 6);
    }
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
      if (this.playing || !this.riffs.riff) this.keyboard.highlight({ targets: new Set(name ? chordNotes(this.song, name) : []), chord: name });
      this.$('#chord-now').textContent = name ? plain(name) : '-';
    }
  }
}

