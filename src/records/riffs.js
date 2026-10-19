// Riffs: the recognisable bit of a song, ready to perform. Every tap on the
// big pad plays the next hit, so anyone can play it in rhythm. The sound is
// sliced from the player's own record, hit by hit, or played by the app's
// instrument for that part. Playing the right keys moves on as well.

import { Sampler } from './sampler.js';

const TITLES = {
  everything: 'The opening keyboard figure',
  idioteque: 'The four chords',
  karma: 'The opening piano',
  pyramid: 'The floating piano chords',
  codex: 'The slow piano chords',
  videotape: 'The closing piano',
  truelove: 'The layered pianos',
  motionpicture: 'The organ hymn',
};

const plain = name => (name || '').replace(/♭/g, 'b').replace(/♯/g, '#');

// The hits of a song's learn part: every moment something is played, with
// how long until the next one ("span") and the chord it belongs to.
export function riffFor(song) {
  const part = song?.parts.find(p => p.learn && p.kind === 'notes');
  if (!part || !part.events.length) return null;
  const length = part.length || song.loop;
  const byBeat = new Map();
  for (const event of part.events) {
    if (event.beat >= length - 1e-6) continue;
    const beat = Math.round(event.beat * 1000) / 1000;
    const hit = byBeat.get(beat) || { beat, notes: [], chord: null, velocity: 0, length: 0 };
    hit.notes.push(...event.notes);
    hit.chord ||= event.chord;
    hit.velocity = Math.max(hit.velocity, event.velocity);
    hit.length = Math.max(hit.length, event.length);
    byBeat.set(beat, hit);
  }
  const hits = [...byBeat.values()].sort((a, b) => a.beat - b.beat);
  let last = null;
  hits.forEach((hit, i) => {
    hit.span = (hits[i + 1]?.beat ?? length) - hit.beat;
    hit.notes = [...new Set(hit.notes)].sort((a, b) => a - b);
    last = hit.chord || last;
    hit.name = last;
  });
  return { title: TITLES[song.id] || `The ${part.name.toLowerCase()} part`, about: song.about, instrument: part.instrument, bpm: song.bpm, length, hits };
}

export class RiffView {
  constructor(screen) {
    this.screen = screen;
    this.$ = screen.$;
    this.context = screen.context;
    this.engine = screen.engine;
    this.sampler = new Sampler(this.context, screen.output);
    this.index = 0;
    this.sound = 'record';
    this.pressed = new Map();
    this.bind();
  }

  get beat() {
    return 60 / (this.screen.track?.sync.bpm || this.riff?.bpm || 120);
  }

  setRecord(buffer) {
    this.sampler.setBuffer(buffer);
  }

  setSong(song) {
    this.stopDemo();
    this.riff = riffFor(song);
    this.index = 0;
    this.render();
  }

  // Where each hit sits in the record, from the chart's start.
  sliceOf(i) {
    const hit = this.riff.hits[i];
    const start = (this.screen.track.sync.start || 0) + hit.beat * this.beat;
    return { start, end: Math.min(start + hit.span * this.beat, this.screen.duration) };
  }

  region() {
    if (!this.riff) return null;
    const start = this.screen.track.sync.start || 0;
    return { start, end: start + this.riff.length * this.beat };
  }

  playHit(i, velocity = 0.85, time = this.context.currentTime) {
    const hit = this.riff.hits[i];
    if (this.sound === 'record') {
      this.sampler.play('riff', this.sliceOf(i), { time, velocity });
    } else {
      const output = this.engine.channel('riff', { instrument: this.riff.instrument, volume: 0.9 });
      const hold = Math.max(0.12, hit.length * this.beat);
      for (const midi of hit.notes) this.engine.note(this.riff.instrument, midi, Math.min(1, hit.velocity * (0.6 + velocity * 0.5)), time, hold, output);
    }
  }

  // The big pad: play this hit and get ready for the next.
  tap(velocity = 0.85) {
    if (!this.riff) return;
    this.stopDemo();
    this.playHit(this.index, velocity);
    this.flash();
    this.advance();
  }

  advance() {
    this.index = (this.index + 1) % this.riff.hits.length;
    this.pressed.clear();
    this.render();
  }

  restart() {
    this.stopDemo();
    this.index = 0;
    this.render();
  }

  flash() {
    const pad = this.$('#riff-tap');
    pad.classList.add('down');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => pad.classList.remove('down'), 120);
  }

  // Playing the notes of the next hit on the keyboard counts as playing it.
  // Any octave is fine.
  notePlayed(midi) {
    if (!this.riff) return;
    this.pressed.set(midi % 12, performance.now());
    const now = performance.now();
    const wanted = new Set(this.riff.hits[this.index].notes.map(n => n % 12));
    for (const pitch of wanted) {
      if (!this.pressed.has(pitch) || now - this.pressed.get(pitch) > 700) return;
    }
    this.advance();
  }

  // Hear It: the whole riff in time, with the chosen sound.
  hear() {
    if (!this.riff) return;
    if (this.demo) {
      this.stopDemo();
      return;
    }
    const start = this.context.currentTime + 0.06;
    this.riff.hits.forEach((hit, i) => this.playHit(i, hit.velocity, start + hit.beat * this.beat));
    this.demo = { start, end: start + this.riff.length * this.beat };
    this.$('#riff-hear').setAttribute('aria-pressed', 'true');
  }

  stopDemo() {
    if (!this.demo) return;
    this.demo = null;
    this.sampler.stopAll();
    this.$('#riff-hear').setAttribute('aria-pressed', 'false');
    this.render();
  }

  setSound(sound) {
    this.sound = sound;
    this.sampler.stopAll();
    this.$$('#riff-sound [data-sound]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sound === sound)));
  }

  $$(selector) {
    return [...document.querySelectorAll(selector)];
  }

  // The hit playing now: from the demo while it runs, otherwise the next one.
  current() {
    if (this.demo) {
      const beat = (this.context.currentTime - this.demo.start) / this.beat;
      if (beat > this.riff.length) {
        this.stopDemo();
        return this.index;
      }
      let found = 0;
      this.riff.hits.forEach((hit, i) => { if (hit.beat <= beat) found = i; });
      return found;
    }
    return this.index;
  }

  render() {
    const $ = this.$;
    const riff = this.riff;
    $('#riff-none').hidden = Boolean(riff);
    $('#riff-body').hidden = !riff;
    if (!riff) return;
    $('#riff-title').textContent = riff.title;
    $('#riff-about').textContent = riff.about;
    const hit = riff.hits[this.index];
    $('#riff-next').textContent = `${this.index + 1} of ${riff.hits.length}${hit.name ? ` - ${plain(hit.name)}` : ''}`;
    this.lit = null;
  }

  draw() {
    if (!this.riff) return;
    const canvas = this.$('#riff-strip');
    this.screen.fit(canvas);
    const g = canvas.getContext('2d');
    const { width, height } = canvas;
    const riff = this.riff;
    const x = beat => Math.round((beat / riff.length) * (width - 1));
    const current = this.current();
    g.fillStyle = '#fff';
    g.fillRect(0, 0, width, height);
    g.textBaseline = 'middle';
    riff.hits.forEach((hit, i) => {
      const left = x(hit.beat);
      const right = x(hit.beat + hit.span);
      const on = i === current;
      g.fillStyle = on ? '#000' : '#fff';
      g.fillRect(left, 0, right - left, height);
      g.strokeStyle = '#000';
      g.strokeRect(left + 0.5, 0.5, right - left - 1, height - 1);
      if (i < current && !this.demo) {
        g.fillStyle = '#000';
        for (let px = left + 2; px < right - 2; px += 2) for (let py = height - 8; py < height - 3; py += 2) g.fillRect(px + (py % 4 ? 1 : 0), py, 1, 1);
      }
      const label = hit.chord && (i === 0 || hit.chord !== riff.hits[i - 1].chord) ? plain(hit.chord) : '';
      if (label || on) {
        g.save();
        g.beginPath();
        g.rect(left + 2, 0, Math.max(0, right - left - 4), height);
        g.clip();
        g.fillStyle = on ? '#fff' : '#000';
        g.font = '18px Chicago, sans-serif';
        g.fillText(label || plain(hit.name), left + 5, height / 2 - 6);
        g.restore();
      }
    });
    // Light the notes of the hit to play next.
    if (this.lit !== current) {
      this.lit = current;
      const hit = riff.hits[current];
      this.screen.keyboard.highlight({ targets: new Set(hit.notes), chord: hit.chord });
    }
  }

  bind() {
    const $ = this.$;
    const pad = $('#riff-tap');
    pad.addEventListener('pointerdown', event => {
      event.preventDefault();
      const box = pad.getBoundingClientRect();
      const velocity = event.pointerType === 'pen' && event.pressure > 0
        ? Math.min(1, 0.2 + event.pressure)
        : Math.max(0.45, Math.min(1, 0.45 + ((event.clientY - box.top) / box.height) * 0.6));
      this.tap(velocity);
    });
    pad.addEventListener('click', event => {
      if (event.detail === 0) this.tap();
    });
    $('#riff-hear').addEventListener('click', () => this.hear());
    $('#riff-restart').addEventListener('click', () => this.restart());
    $('#riff-sound').addEventListener('click', event => {
      const button = event.target.closest('[data-sound]');
      if (button) this.setSound(button.dataset.sound);
    });
    $('#riff-strip').addEventListener('pointerdown', event => {
      if (!this.riff) return;
      const box = event.currentTarget.getBoundingClientRect();
      const beat = ((event.clientX - box.left) / box.width) * this.riff.length;
      let index = 0;
      this.riff.hits.forEach((hit, i) => { if (hit.beat <= beat) index = i; });
      this.stopDemo();
      this.index = index;
      this.playHit(index);
      this.advance();
    });
  }
}
