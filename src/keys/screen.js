// The Piano: play a song's keyboard part on the computer keyboard. Every
// chord has its own key on the home row and the lane shows which key comes
// next. Wait for Me stops at each chord until its key is pressed; In Time
// scrolls at the song's tempo and counts how many chords landed in time;
// Hear It plays the part so you know how it goes.

import { Keyboard } from '../ui/keyboard.js';
import { INSTRUMENTS } from '../audio/engine.js';
import { showDialog, toast, escape } from '../ui/mac.js';
import { ICONS, renderIcons } from '../ui/icons.js';
import { listTracks, getTrack } from '../records/tracks.js';
import { playableSongs, keymapFor, piecesOf, sectionAt, nth, plain, noteList } from './keymap.js';

const BLACK = new Set([1, 3, 6, 8, 10]);
const PERFECT = 0.08; // seconds either side
const WINDOW = 0.28;
const AHEAD = 8; // beats shown after the now line
const SPEEDS = [1, 0.9, 0.8, 0.75, 0.7, 0.6, 0.5];

export class PianoScreen {
  constructor({ engine, $, settings, persist }) {
    this.engine = engine;
    this.context = engine.context;
    this.$ = $;
    this.store = () => {
      const all = settings();
      all.piano ||= {};
      return all.piano;
    };
    this.persist = persist;
    this.songs = playableSongs();
    this.mode = this.store().mode === 'time' ? 'time' : 'wait';
    this.run = null; // In Time or Hear It while it plays
    this.n = 0; // the hit to play next, counted from the start
    this.cursor = { from: 0, to: 0, at: 0, time: 0 };
    this.ringing = [];
    this.held = new Map(); // key code -> voices, with the pedal up
    this.sounding = new Set();
    this.results = new Map();
    this.down = new Set();
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.keyboard = new Keyboard({ piano: $('#pk-piano'), pads: $('#pk-pads'), drumPads: $('#pk-drums') }, {
      noteOn: (midi, velocity) => this.freeOn(midi, velocity),
      noteOff: midi => this.freeOff(midi),
      padOn: () => {},
      padOff: () => {},
      drum: () => {},
    });
    this.keyboard.show('keys');
    // Narrow keys, so the whole part fits even on a phone.
    this.whites = 22;
    this.keyboard.whiteCount = () => Math.max(8, Math.min(this.whites + 2, Math.floor((this.keyboard.pianoElement.clientWidth || 600) / 14)));
    this.free = new Map();
    this.bind();
    this.setSong(this.store().song, false);
  }

  // ------------------------------------------------------------ songs

  setSong(id, save = true) {
    this.stop();
    this.releaseAll();
    this.song = this.songs.find(s => s.id === id) || this.songs.find(s => s.id === 'pyramid') || this.songs[0];
    const pieces = piecesOf(this.song);
    const saved = this.store().pieces?.[this.song.id];
    this.piece = pieces.some(p => p.id === saved) ? saved : pieces[0].id;
    this.map = keymapFor(this.song, this.piece);
    this.restart();
    const $ = this.$;
    $('#pk-title').textContent = `Piano - ${this.song.title}`;
    $('#pk-song').value = this.song.id;
    $('#pk-piece').innerHTML = pieces.map(p => `<option value="${p.id}">${escape(p.name)}</option>`).join('');
    $('#pk-piece').value = this.piece;
    $('#pk-piece').hidden = pieces.length < 2;
    this.renderSound();
    this.renderKeys();
    this.fit();
    if (save) {
      this.store().song = this.song.id;
      this.persist();
    }
    this.chooseRecord();
    this.show();
  }

  setPiece(id) {
    this.stop();
    this.releaseAll();
    this.piece = id;
    this.store().pieces = { ...this.store().pieces, [this.song.id]: id };
    this.persist();
    this.map = keymapFor(this.song, id);
    this.restart();
    this.renderKeys();
    this.fit();
    this.show();
  }

  get instrument() {
    return this.store().sounds?.[this.song.id] || this.map.part.instrument || 'piano';
  }

  renderSound() {
    const own = this.map.part.instrument || 'piano';
    const options = Object.entries(INSTRUMENTS).filter(([id]) => id !== 'bass');
    this.$('#pk-sound').innerHTML = options.map(([id, name]) => `<option value="${id}">${escape(name)}${id === own ? ' (song)' : ''}</option>`).join('');
    this.$('#pk-sound').value = this.instrument;
  }

  renderKeys() {
    this.$('#pk-keys').innerHTML = this.map.keys.map(key => `
      <button class="pad pk-key" data-code="${key.code}" aria-label="${escape(key.label)}: ${escape(plain(key.name))}">
        <span class="pk-cap">${escape(key.label)}</span>
        <strong>${escape(plain(key.name))}</strong>
        <small>${escape(noteList(key.notes))}</small>
      </button>`).join('');
  }

  fit() {
    const notes = this.map.hits.flatMap(hit => hit.notes);
    const low = Math.min(...notes);
    const high = Math.max(...notes);
    this.whites = 0;
    for (let midi = low; midi <= high; midi++) if (!BLACK.has(midi % 12)) this.whites++;
    this.keyboard.fit(low - 1, high + 1);
  }

  setMode(mode) {
    this.stop();
    this.mode = mode;
    this.store().mode = mode;
    this.persist();
    this.restart();
    this.show();
  }

  restart() {
    this.n = 0;
    this.results.clear();
    this.cursor = { from: -1, to: 0, at: 0, time: 0 };
    this.score = null;
  }

  // ------------------------------------------------------------ timing

  get beatSeconds() {
    return 60 / this.song.bpm / (this.run?.speed || this.speed);
  }

  get speed() {
    return this.store().speed || 1;
  }

  // In Time, or Hear It (auto), after a bar of count-in.
  start(auto = false) {
    this.stop();
    this.releaseAll();
    this.restart();
    const speed = this.speed;
    const spb = 60 / this.song.bpm / speed;
    const countIn = this.song.barLengths[0] || 4;
    const now = this.context.currentTime + 0.1;
    const first = this.map.hits[0].beat;
    this.run = { auto, speed, spb, start: now + countIn * spb - first * spb, clickBeat: Math.ceil(first - countIn), round: 0, roundHits: 0, roundGood: 0, roundPerfect: 0 };
    for (let beat = 0; beat < countIn; beat++) this.engine.click(now + beat * spb, beat === 0);
    this.run.clickBeat = first;
    this.showRunning();
    this.show();
  }

  stop() {
    if (!this.run) return;
    const wasAuto = this.run.auto;
    this.run = null;
    this.releaseAll();
    if (wasAuto || this.mode === 'wait') this.restart();
    this.showRunning();
    this.show();
  }

  beatNow() {
    return (this.context.currentTime - this.run.start) / this.run.spb;
  }

  tick() {
    if (!this.run) return;
    const run = this.run;
    const beat = this.beatNow();
    // The click, scheduled a little ahead.
    if (this.store().click) {
      while ((run.clickBeat - beat) * run.spb < 0.15) {
        if (run.clickBeat >= beat - 0.05) this.engine.click(run.start + run.clickBeat * run.spb, this.barStart(run.clickBeat));
        run.clickBeat++;
      }
    } else {
      run.clickBeat = Math.max(run.clickBeat, Math.ceil(beat));
    }
    if (run.auto) {
      while (nth(this.map, this.n).beat <= beat) {
        const { hit } = nth(this.map, this.n);
        this.play(hit.notes, hit.velocity, null);
        this.flashKey(hit.key.code);
        this.n++;
        // A short part plays twice, a whole song once.
        if (this.n >= this.map.hits.length * (this.map.length > 32 ? 1 : 2)) {
          setTimeout(() => this.stop(), hit.gap * run.spb * 1000);
          run.auto = 'ending';
          break;
        }
      }
      if (run.auto === 'ending') return;
    } else {
      // Chords that went by without their key.
      while ((beat - nth(this.map, this.n).beat) * run.spb > WINDOW) {
        this.judge('miss');
      }
    }
  }

  barStart(beat) {
    const cycle = this.song.cycle;
    let rest = ((beat % cycle) + cycle) % cycle;
    for (const length of this.song.barLengths) {
      if (Math.abs(rest) < 1e-6) return true;
      rest -= length;
    }
    return false;
  }

  // Scores the chord due now and moves on; a round's score shows when the
  // part comes round again.
  judge(result) {
    this.results.set(this.n, result);
    const run = this.run;
    run.roundHits++;
    if (result !== 'miss') run.roundGood++;
    if (result === 'perfect') run.roundPerfect++;
    this.n++;
    if (this.n % this.map.hits.length === 0) {
      this.score = `Time ${this.n / this.map.hits.length}: ${run.roundGood} of ${run.roundHits} chords in time, ${run.roundPerfect} spot on.`;
      run.roundHits = run.roundGood = run.roundPerfect = 0;
      for (const n of [...this.results.keys()]) if (n < this.n - this.map.hits.length * 2) this.results.delete(n);
    }
    this.show();
  }

  // ------------------------------------------------------------ playing

  keyFor(code) {
    return this.map.keys.find(key => key.code === code) || null;
  }

  // A chord key went down, from the keyboard or a touch.
  press(code) {
    const key = this.keyFor(code);
    if (!key) return false;
    this.down.add(code);
    const expected = nth(this.map, this.n).hit;
    if (this.run && !this.run.auto) {
      const due = this.run.start + nth(this.map, this.n).beat * this.run.spb;
      const off = Math.abs(this.context.currentTime - due);
      if (expected.key === key && off <= WINDOW) {
        this.play(expected.notes, expected.velocity, code);
        this.judge(off <= PERFECT ? 'perfect' : 'good');
      } else {
        this.play(key.notes, 0.6, code);
        this.flashWrong(code);
      }
    } else if (this.run) {
      this.stop();
      this.play(key.notes, 0.65, code);
    } else if (this.mode === 'wait' && expected.key === key) {
      this.play(expected.notes, expected.velocity, code);
      this.moveOn();
    } else {
      this.play(key.notes, 0.6, code);
      if (this.mode === 'wait') this.flashWrong(code);
    }
    this.showKeys();
    return true;
  }

  release(code) {
    this.down.delete(code);
    const voices = this.held.get(code);
    this.held.delete(code);
    if (voices && !this.pedal) this.stopVoices(voices);
    this.showKeys();
  }

  moveOn() {
    const from = nth(this.map, this.n).beat;
    this.n++;
    const to = nth(this.map, this.n).beat;
    // The lane glides to the next chord at the song's own pace, never slower
    // than about half a second.
    const seconds = Math.min(0.5, ((to - from) * 60) / this.song.bpm);
    this.cursor = { from, to, at: performance.now(), time: seconds * 1000 };
    this.show();
  }

  back() {
    if (this.run || this.n === 0) return;
    this.n--;
    const beat = nth(this.map, this.n).beat;
    this.cursor = { from: beat, to: beat, at: 0, time: 0 };
    this.show();
  }

  get pedal() {
    return this.$('#pk-pedal').checked;
  }

  channel() {
    return this.engine.channel(`pk-${this.instrument}`, { instrument: this.instrument, volume: 0.9 });
  }

  // Plays notes. With the pedal down, the last chord lets go as this one
  // sounds, like a pedal changed on every chord; with it up, the notes last
  // as long as the key is held.
  play(notes, velocity, code) {
    const now = this.context.currentTime;
    if (this.pedal || !code) {
      this.stopVoices(this.ringing, now + 0.03);
    }
    const output = this.channel();
    const voices = notes.map(midi => {
      const voice = this.engine.noteOn(this.instrument, midi, velocity, now, output);
      voice.midi = midi;
      this.sounding.add(midi);
      return voice;
    });
    this.ringing.push(...voices);
    if (code && !this.pedal) this.held.set(code, [...(this.held.get(code) || []), ...voices]);
    this.showPiano();
  }

  stopVoices(voices, at = this.context.currentTime) {
    const gone = new Set(voices);
    for (const voice of gone) {
      voice.release(at);
      if (![...this.ringing, ...[...this.held.values()].flat()].some(v => !gone.has(v) && v.midi === voice.midi)) this.sounding.delete(voice.midi);
    }
    this.ringing = this.ringing.filter(v => !gone.has(v));
    this.showPiano();
  }

  releaseAll() {
    this.stopVoices([...this.ringing]);
    this.held.clear();
    this.down.clear();
    for (const voice of this.free.values()) voice.release(this.context.currentTime);
    this.free.clear();
    this.keyboard.releaseAll();
    this.sounding.clear();
    this.showPiano();
    this.showKeys();
  }

  // Keys touched on the piano itself play single notes.
  freeOn(midi, velocity) {
    this.free.get(midi)?.release(this.context.currentTime);
    this.free.set(midi, this.engine.noteOn(this.instrument, midi, velocity, this.context.currentTime, this.channel()));
  }

  freeOff(midi) {
    this.free.get(midi)?.release(this.context.currentTime + (this.pedal ? 1.2 : 0));
    this.free.delete(midi);
  }

  midiNote(note, velocity) {
    if (velocity > 0) this.keyboard.press(note, velocity);
    else this.keyboard.release(note);
  }

  flashKey(code) {
    const element = this.$(`#pk-keys [data-code="${code}"]`);
    if (!element) return;
    element.classList.add('down');
    element.dataset.flash = '1';
    clearTimeout(element.flash);
    element.flash = setTimeout(() => {
      delete element.dataset.flash;
      if (!this.down.has(code)) element.classList.remove('down');
    }, 160);
  }

  flashWrong(code) {
    const element = this.$(`#pk-keys [data-code="${code}"]`);
    if (!element) return;
    element.classList.add('wrong');
    setTimeout(() => element.classList.remove('wrong'), 350);
  }

  // ------------------------------------------------------------ keys

  keyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (this.mode === 'time') this.toggle();
      else this.toggleHear();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      this.back();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.toggleRecord();
      return;
    }
    if (this.keyFor(event.code)) {
      event.preventDefault();
      this.press(event.code);
    }
  }

  keyUp(event) {
    if (this.down.has(event.code)) this.release(event.code);
  }

  toggle() {
    if (this.run && !this.run.auto) this.stop();
    else this.start(false);
  }

  toggleHear() {
    if (this.run?.auto) this.stop();
    else this.start(true);
  }

  // ------------------------------------------------------------ records

  async listRecords() {
    try {
      this.records = await listTracks();
    } catch {
      this.records = [];
    }
    this.$('#pk-record').innerHTML = `<option value="">Nothing</option>${this.records.map(r => `<option value="${escape(r.id)}">${escape(r.name)}</option>`).join('')}`;
    this.chooseRecord();
  }

  // A record of this song, if one is loaded.
  chooseRecord() {
    if (!this.records) return;
    const song = this.song;
    const match = this.records.find(r => r.songId === song.id) || this.records.find(r => r.name.toLowerCase().includes(song.title.toLowerCase()));
    const id = match?.id || '';
    if (this.$('#pk-record').value !== id || this.recordId !== id) {
      this.$('#pk-record').value = id;
      this.useRecord(id);
    }
  }

  async useRecord(id) {
    this.audio.pause();
    this.recordId = id;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.audio.removeAttribute('src');
    this.$('#pk-record-play').disabled = true;
    this.showRecord();
    if (!id) return;
    try {
      const track = await getTrack(id);
      if (!track?.blob) throw new Error('missing');
      this.url = URL.createObjectURL(track.blob);
      this.audio.src = this.url;
      this.$('#pk-record-play').disabled = false;
    } catch {
      toast('That record cannot be opened. Load it again from the desktop.');
      this.$('#pk-record').value = '';
    }
  }

  toggleRecord() {
    if (!this.audio.src) return;
    if (this.audio.paused) this.audio.play().catch(() => toast('Touch Play Record again to start it.'));
    else this.audio.pause();
  }

  showRecord() {
    const playing = !this.audio.paused;
    const button = this.$('#pk-record-play');
    button.setAttribute('aria-pressed', String(playing));
    button.innerHTML = `<span data-icon="${playing ? 'stop' : 'play'}"></span><span>${playing ? 'Stop Record' : 'Play Record'}</span>`;
    renderIcons(button);
  }

  // ------------------------------------------------------------ screen

  enter() {
    this.listRecords();
    this.fit();
    this.show();
    const loop = () => {
      if (!this.active) return;
      this.tick();
      this.drawLane();
      requestAnimationFrame(loop);
    };
    this.active = true;
    requestAnimationFrame(loop);
  }

  leave() {
    this.active = false;
    this.stop();
    this.audio.pause();
    this.releaseAll();
  }

  showRunning() {
    const $ = this.$;
    const running = this.run && !this.run.auto;
    const go = $('#pk-go');
    go.hidden = this.mode !== 'time';
    go.setAttribute('aria-pressed', String(Boolean(running)));
    go.innerHTML = `<span data-icon="${running ? 'stop' : 'play'}"></span><span>${running ? 'Stop' : 'Play'}</span>`;
    renderIcons(go);
    $('#pk-hear').setAttribute('aria-pressed', String(Boolean(this.run?.auto)));
    $('#pk-restart').hidden = this.mode !== 'wait';
    this.$$('#pk-mode [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === this.mode)));
  }

  show() {
    const $ = this.$;
    const { hit } = nth(this.map, this.n);
    $('#pk-next-key').textContent = hit.key.label;
    $('#pk-next-name').textContent = plain(hit.key.name);
    let hint;
    if (this.run?.auto) hint = 'Listen: the keys light up as the part plays. Press any chord key to take over.';
    else if (this.run) hint = this.score || 'Press each key as its box reaches the line.';
    else if (this.mode === 'time') hint = this.score ? `${this.score} Press Play (Space) to go again.` : `Press Play (Space): after a bar of clicks, press each key as its box reaches the line, at ${Math.round(this.speed * 100)}% speed.`;
    else hint = `Press ${hit.key.label} for ${plain(hit.key.name)}. The song waits for you; the boxes show each chord's length. Space plays the part to hear how it goes.`;
    const section = sectionAt(this.map, nth(this.map, this.n).beat);
    if (section) hint = `${section.name}. ${hint}`;
    $('#pk-hint').textContent = hint;
    this.showRunning();
    this.showKeys();
    this.showPiano();
  }

  showKeys() {
    if (!this.map) return;
    const next = nth(this.map, this.n).hit.key.code;
    for (const element of this.$$('#pk-keys [data-code]')) {
      element.classList.toggle('target', element.dataset.code === next && !this.run?.auto);
      if (this.down.has(element.dataset.code)) element.classList.add('down');
      else if (!element.dataset.flash) element.classList.remove('down');
    }
  }

  showPiano() {
    if (!this.map) return;
    const next = this.run?.auto ? [] : nth(this.map, this.n).hit.notes;
    this.keyboard.highlight({ targets: new Set(next), sounding: new Set(this.sounding) });
  }

  // Where the now line is, in beats.
  cursorBeat() {
    if (this.run) return this.beatNow();
    const c = this.cursor;
    const target = nth(this.map, this.n).beat;
    if (this.mode === 'time') return target - 1;
    if (!c.time || c.to !== target) return target;
    const t = Math.min(1, (performance.now() - c.at) / c.time);
    return c.from + (c.to - c.from) * (1 - (1 - t) ** 2);
  }

  drawLane() {
    const canvas = this.$('#pk-lane');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const g = canvas.getContext('2d');
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, width, height);
    const nowX = Math.min(90, width * 0.15);
    const perBeat = (width - nowX) / AHEAD;
    const cursor = this.cursorBeat();
    const x = beat => nowX + (beat - cursor) * perBeat;
    const top = this.map.sections.length ? 20 : 6;
    const boxHeight = height - top - 16;
    // Bar lines and beats along the bottom.
    g.fillStyle = '#000';
    for (let beat = Math.floor(cursor - nowX / perBeat) - 1; x(beat) < width; beat++) {
      const bx = Math.round(x(beat));
      if (this.barStart(beat)) g.fillRect(bx, height - 14, 1, 14);
      else g.fillRect(bx, height - 6, 1, 6);
    }
    // The chords as boxes as long as they last, with their key.
    const count = this.map.hits.length;
    const first = Math.max(0, this.n - count);
    for (let n = first; n < this.n + count * 3; n++) {
      const { hit, beat } = nth(this.map, n);
      const left = Math.round(x(beat));
      const right = Math.round(x(beat + hit.gap)) - 3;
      if (right < 0) continue;
      if (left > width) break;
      const next = n === this.n && !this.run?.auto;
      const result = this.results.get(n);
      g.fillStyle = '#000';
      g.fillRect(left, top, Math.max(1, right - left), boxHeight);
      if (!next) {
        g.fillStyle = '#fff';
        g.fillRect(left + 1, top + 1, Math.max(0, right - left - 2), boxHeight - 2);
      }
      g.save();
      g.beginPath();
      g.rect(left, top, Math.max(0, right - left), boxHeight);
      g.clip();
      g.fillStyle = next ? '#fff' : '#000';
      g.textBaseline = 'top';
      g.font = '34px Chicago, sans-serif';
      g.fillText(hit.key.label, left + 7, top + 6);
      g.font = '16px Geneva, sans-serif';
      g.fillText(plain(hit.key.name), left + 7, top + boxHeight - 22);
      if (result) this.mark(g, right - 18, top + 10, result);
      g.restore();
    }
    // Section names above the boxes, where each section starts.
    if (this.map.sections.length) {
      g.fillStyle = '#000';
      g.font = '16px Geneva, sans-serif';
      g.textBaseline = 'top';
      const span = this.map.length;
      const firstRound = Math.floor((cursor - AHEAD) / span);
      for (let round = firstRound; round <= firstRound + 2; round++) {
        for (const section of this.map.sections) {
          const sx = x(round * span + section.beat);
          if (sx < -200 || sx > width) continue;
          g.fillRect(Math.round(sx), 2, 1, top - 4);
          g.fillText(section.name, Math.round(sx) + 4, 2);
        }
      }
    }
    // The now line, dotted.
    g.fillStyle = '#000';
    for (let y = 0; y < height; y += 2) g.fillRect(Math.round(nowX) - 1, y, 2, 1);
  }

  // A tick for a chord in time, a cross for one missed.
  mark(g, cx, cy, result) {
    g.save();
    g.strokeStyle = '#000';
    g.lineWidth = 2;
    g.fillStyle = '#fff';
    g.fillRect(cx - 9, cy - 9, 18, 18);
    g.strokeRect(cx - 9, cy - 9, 18, 18);
    g.beginPath();
    if (result === 'miss') {
      g.moveTo(cx - 5, cy - 5); g.lineTo(cx + 5, cy + 5);
      g.moveTo(cx + 5, cy - 5); g.lineTo(cx - 5, cy + 5);
    } else {
      g.moveTo(cx - 5, cy); g.lineTo(cx - 1, cy + 4); g.lineTo(cx + 6, cy - 5);
    }
    g.stroke();
    if (result === 'perfect') g.fillRect(cx - 9, cy + 11, 18, 2);
    g.restore();
  }

  showInfo() {
    const song = this.song;
    const sources = (song.sources || []).map(([name, href]) => `<li><a href="${escape(href)}" target="_blank" rel="noopener">${escape(plain(name))}</a></li>`).join('');
    showDialog(`
      <div class="alert">${ICONS.piano}<div>
        <h3>${escape(song.title)}</h3>
        <p>${escape(song.album)}, ${song.year}. About ${song.bpm} BPM, key of ${escape(plain(song.key))}. You play: ${escape(this.map.part.name)}.</p>
        <p>${escape(plain(song.about))}</p>
        <p><b>How close is it?</b> ${escape(plain(song.accuracy))} It is a reconstruction for playing along, not an exact transcription.</p>
        ${sources ? `<p><b>Sources</b></p><ul>${sources}</ul>` : ''}
      </div></div>
      <div class="button-row"><button class="btn default" data-value="ok">OK</button></div>`);
  }

  // ------------------------------------------------------------ wiring

  $$(selector) {
    return [...document.querySelectorAll(selector)];
  }

  bind() {
    const $ = this.$;
    $('#pk-song').innerHTML = this.songs.map(song => `<option value="${song.id}">${escape(song.title)}</option>`).join('');
    $('#pk-song').addEventListener('change', event => this.setSong(event.target.value));
    $('#pk-piece').addEventListener('change', event => this.setPiece(event.target.value));
    $('#pk-info').addEventListener('click', () => this.showInfo());
    $('#pk-mode').addEventListener('click', event => {
      const button = event.target.closest('[data-mode]');
      if (button) this.setMode(button.dataset.mode);
    });
    $('#pk-go').addEventListener('click', () => this.toggle());
    $('#pk-hear').addEventListener('click', () => this.toggleHear());
    $('#pk-restart').addEventListener('click', () => {
      this.stop();
      this.releaseAll();
      this.restart();
      this.show();
    });
    const speed = $('#pk-speed');
    speed.innerHTML = SPEEDS.map(s => `<option value="${s}">${Math.round(s * 100)}%</option>`).join('');
    speed.value = String(this.speed);
    speed.addEventListener('change', () => {
      this.store().speed = Number(speed.value) || 1;
      this.persist();
      if (this.run) this.start(this.run.auto);
      else this.show();
    });
    $('#pk-pedal').checked = this.store().pedal !== false;
    $('#pk-pedal').addEventListener('change', () => {
      this.store().pedal = this.pedal;
      this.persist();
      if (!this.pedal) this.releaseAll();
    });
    $('#pk-click').checked = Boolean(this.store().click);
    $('#pk-click').addEventListener('change', () => {
      this.store().click = $('#pk-click').checked;
      this.persist();
    });
    $('#pk-sound').addEventListener('change', event => {
      this.releaseAll();
      this.store().sounds = { ...this.store().sounds, [this.song.id]: event.target.value };
      this.persist();
    });
    $('#pk-record').addEventListener('change', event => this.useRecord(event.target.value));
    $('#pk-record-play').addEventListener('click', () => this.toggleRecord());
    for (const type of ['play', 'pause', 'ended']) this.audio.addEventListener(type, () => this.showRecord());
    // Controls give the keyboard straight back to the chord keys once used.
    for (const control of this.$$('#piano-screen select, #piano-screen input')) control.addEventListener('change', () => control.blur());
    $('#piano-screen').addEventListener('click', event => event.target.closest?.('button')?.blur());
    // The chord keys work by touch too.
    const keys = $('#pk-keys');
    const touches = new Map();
    keys.addEventListener('pointerdown', event => {
      const key = event.target.closest('[data-code]');
      if (!key) return;
      event.preventDefault();
      touches.set(event.pointerId, key.dataset.code);
      this.press(key.dataset.code);
    });
    const end = event => {
      const code = touches.get(event.pointerId);
      if (!code) return;
      touches.delete(event.pointerId);
      this.release(code);
    };
    keys.addEventListener('pointerup', end);
    keys.addEventListener('pointercancel', end);
    keys.addEventListener('pointerleave', end);
    keys.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('resize', () => this.active && this.fit());
    window.addEventListener('blur', () => this.active && !this.pedal && this.releaseAll());
  }
}
