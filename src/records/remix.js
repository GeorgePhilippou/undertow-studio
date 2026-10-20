// Remix: four sixteen-step patterns, A to D, one row per pad of a bank, played
// in time by the sampler with the pads' own lengths, pitch, direction, volume
// and effects. Patterns can be chained one after another, and swing delays
// every other sixteenth for a looser groove.

import { ICONS } from '../ui/icons.js';

const STEPS = 16;
const ROWS = 16;
const NAMES = 'ABCD';

export const emptyPattern = () => Array.from({ length: ROWS }, () => Array(STEPS).fill(false));
const blank = () => ({ steps: emptyPattern(), bank: 0 });
const used = pattern => pattern.steps.some(row => row.some(Boolean));

export class Remix {
  constructor(screen) {
    this.screen = screen;
    this.$ = screen.$;
    this.context = screen.context;
    this.patterns = NAMES.split('').map(blank);
    this.current = 0;
    this.chain = false;
    this.swing = 0;
    this.queue = [];
    this.step = -1;
    this.bind();
  }

  get sampler() {
    return this.screen.sampler;
  }

  get bpm() {
    return this.screen.track?.remix?.bpm || this.screen.bpm;
  }

  get pattern() {
    return this.patterns[this.current].steps;
  }

  // Older records kept one pattern as remix.pattern; it becomes pattern A.
  load(track) {
    this.stop();
    const saved = track.remix || {};
    const valid = steps => Array.isArray(steps) && steps.length === ROWS;
    if (Array.isArray(saved.patterns)) {
      this.patterns = NAMES.split('').map((_, i) => {
        const p = saved.patterns[i];
        return valid(p?.steps) ? { steps: p.steps.map(row => row.slice(0, STEPS)), bank: p.bank || 0 } : blank();
      });
    } else {
      this.patterns = NAMES.split('').map(blank);
      if (valid(saved.pattern)) this.patterns[0].steps = saved.pattern.map(row => row.slice(0, STEPS));
    }
    this.current = 0;
    this.chain = Boolean(saved.chain);
    this.swing = saved.swing || 0;
    this.$('#remix-chain').checked = this.chain;
    this.$('#remix-swing').value = Math.round(this.swing * 100);
    this.render();
  }

  save() {
    const remix = this.screen.track.remix || {};
    this.screen.track.remix = { bpm: remix.bpm, patterns: this.patterns, chain: this.chain, swing: this.swing };
    this.screen.save({});
  }

  render() {
    const $ = this.$;
    const bank = this.patterns[this.current].bank;
    $('#remix-grid').innerHTML = this.pattern.map((row, r) => `
      <div class="remix-row" role="group" aria-label="Pad ${r + 1}">
        <button class="remix-pad" data-audition="${r}" aria-label="Hear pad ${r + 1}">${r + 1}</button>
        ${row.map((on, s) => `<button class="cell${s % 4 === 0 ? ' downbeat' : ''}" data-row="${r}" data-step="${s}" aria-pressed="${on}" aria-label="Pad ${r + 1}, step ${s + 1}"></button>`).join('')}
      </div>`).join('');
    this.$$('#remix-patterns [data-pattern]').forEach(b => {
      const i = Number(b.dataset.pattern);
      b.setAttribute('aria-pressed', String(i === this.current));
      b.classList.toggle('used', used(this.patterns[i]));
    });
    this.$$('#remix-bank [data-bank]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.bank) === bank)));
    this.drawn = undefined;
    this.renderTempo();
  }

  renderTempo() {
    this.$('#remix-bpm').textContent = `${this.bpm.toFixed(1)} BPM`;
    this.sampler.setEcho(this.sampler.echoAmount || 0, this.bpm);
  }

  // The pads a pattern plays: the bank it was made with.
  slicesFor(pattern) {
    return this.screen.bankSlices(pattern.bank);
  }

  toggle(row, step) {
    this.pattern[row][step] = !this.pattern[row][step];
    this.$(`#remix-grid [data-row="${row}"][data-step="${step}"]`).setAttribute('aria-pressed', String(this.pattern[row][step]));
    if (this.pattern[row][step] && !this.playing) this.audition(row);
    this.render();
    this.save();
  }

  audition(row) {
    const pattern = this.patterns[this.current];
    const slice = this.slicesFor(pattern)[row];
    this.sampler.play(this.screen.padKey(row, pattern.bank), slice, { velocity: 0.85, mode: slice?.mode === 'hold' ? 'once' : slice?.mode });
  }

  choose(index) {
    this.current = index;
    if (!this.playing) this.position = 0;
    this.render();
  }

  setBank(bank) {
    this.patterns[this.current].bank = bank;
    this.screen.bankSlices(bank);
    this.render();
    this.save();
  }

  clear() {
    this.patterns[this.current] = blank();
    this.render();
    this.save();
  }

  nudge(amount) {
    const track = this.screen.track;
    track.remix = { ...track.remix, bpm: Math.max(40, Math.min(240, Math.round((this.bpm + amount) * 10) / 10)) };
    this.screen.save({});
    this.renderTempo();
  }

  get playing() {
    return Boolean(this.timer);
  }

  // A lookahead scheduler on the audio clock, so the grid keeps time even
  // when the screen is busy.
  start() {
    if (this.playing) return;
    this.screen.stop();
    this.next = this.context.currentTime + 0.06;
    this.position = 0;
    this.playingPattern = this.current;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
    this.$('#remix-play').setAttribute('aria-pressed', 'true');
    this.$('#remix-play span:last-child').textContent = 'Stop';
    this.$('#remix-play [data-icon]').innerHTML = ICONS.stop;
    this.screen.onPlaying(true);
  }

  stop() {
    if (!this.playing) return;
    clearInterval(this.timer);
    this.timer = null;
    this.queue = [];
    this.step = -1;
    this.sampler.stopAll();
    this.$('#remix-play').setAttribute('aria-pressed', 'false');
    this.$('#remix-play span:last-child').textContent = 'Play';
    this.$('#remix-play [data-icon]').innerHTML = ICONS.play;
    this.screen.onPlaying(this.screen.playing);
    this.drawStep();
  }

  togglePlay() {
    if (this.playing) this.stop();
    else this.start();
  }

  // With Chain on, the next pattern with anything in it follows this one.
  following(index) {
    if (!this.chain) return this.current;
    for (let n = 1; n <= NAMES.length; n++) {
      const next = (index + n) % NAMES.length;
      if (used(this.patterns[next])) return next;
    }
    return index;
  }

  schedule() {
    const sixteenth = 60 / this.bpm / 4;
    while (this.next < this.context.currentTime + 0.12) {
      const pattern = this.patterns[this.playingPattern];
      const slices = this.slicesFor(pattern);
      const swung = this.position % 2 ? this.swing * sixteenth * 0.5 : 0;
      pattern.steps.forEach((row, r) => {
        const slice = slices[r];
        if (row[this.position] && slice) {
          this.sampler.play(this.screen.padKey(r, pattern.bank), slice, { time: this.next + swung, velocity: this.position % 4 === 0 ? 0.9 : 0.75, mode: slice.mode === 'hold' ? 'once' : slice.mode });
        }
      });
      this.queue.push({ step: this.position, pattern: this.playingPattern, time: this.next + swung });
      this.next += sixteenth;
      this.position = (this.position + 1) % STEPS;
      if (this.position === 0) this.playingPattern = this.following(this.playingPattern);
    }
  }

  drawStep() {
    let pattern = this.shown;
    while (this.queue.length && this.queue[0].time <= this.context.currentTime) {
      const item = this.queue.shift();
      this.step = item.step;
      pattern = item.pattern;
    }
    if (this.playing && pattern !== undefined && pattern !== this.current && this.chain) {
      this.current = pattern;
      this.render();
    }
    this.shown = pattern;
    if (this.step === this.drawn) return;
    this.drawn = this.step;
    this.$$('#remix-grid .cell.now').forEach(cell => cell.classList.remove('now'));
    if (this.step >= 0) this.$$(`#remix-grid [data-step="${this.step}"]`).forEach(cell => cell.classList.add('now'));
  }

  $$(selector) {
    return [...document.querySelectorAll(selector)];
  }

  bind() {
    const $ = this.$;
    $('#remix-grid').addEventListener('click', event => {
      const cell = event.target.closest('[data-row]');
      if (cell) {
        this.toggle(Number(cell.dataset.row), Number(cell.dataset.step));
        return;
      }
      const pad = event.target.closest('[data-audition]');
      if (pad) this.audition(Number(pad.dataset.audition));
    });
    $('#remix-patterns').addEventListener('click', event => {
      const button = event.target.closest('[data-pattern]');
      if (button) this.choose(Number(button.dataset.pattern));
    });
    $('#remix-bank').addEventListener('click', event => {
      const button = event.target.closest('[data-bank]');
      if (button) this.setBank(Number(button.dataset.bank));
    });
    $('#remix-chain').addEventListener('change', event => {
      this.chain = event.target.checked;
      this.save();
    });
    $('#remix-swing').addEventListener('input', event => {
      this.swing = Number(event.target.value) / 100;
    });
    $('#remix-swing').addEventListener('change', () => this.save());
    $('#remix-play').addEventListener('click', () => this.togglePlay());
    $('#remix-clear').addEventListener('click', () => this.clear());
    $('#remix-down').addEventListener('click', () => this.nudge(-1));
    $('#remix-up').addEventListener('click', () => this.nudge(1));
  }
}
