// Remix: a sixteen-step pattern grid, one row per pad, played in time by the
// sampler with the pads' own lengths, pitch, direction and effects.

import { ICONS } from '../ui/icons.js';

const STEPS = 16;
const ROWS = 16;

export const emptyPattern = () => Array.from({ length: ROWS }, () => Array(STEPS).fill(false));

export class Remix {
  constructor(screen) {
    this.screen = screen;
    this.$ = screen.$;
    this.context = screen.context;
    this.pattern = emptyPattern();
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

  load(track) {
    this.stop();
    const saved = track.remix?.pattern;
    this.pattern = saved?.length === ROWS ? saved.map(row => row.slice(0, STEPS)) : emptyPattern();
    this.render();
  }

  save() {
    this.screen.track.remix = { ...this.screen.track.remix, pattern: this.pattern, bpm: this.screen.track.remix?.bpm };
    this.screen.save({});
  }

  render() {
    const $ = this.$;
    $('#remix-grid').innerHTML = this.pattern.map((row, r) => `
      <div class="remix-row" role="group" aria-label="Pad ${r + 1}">
        <button class="remix-pad" data-audition="${r}" aria-label="Hear pad ${r + 1}">${r + 1}</button>
        ${row.map((on, s) => `<button class="cell${s % 4 === 0 ? ' downbeat' : ''}" data-row="${r}" data-step="${s}" aria-pressed="${on}" aria-label="Pad ${r + 1}, step ${s + 1}"></button>`).join('')}
      </div>`).join('');
    this.renderTempo();
  }

  renderTempo() {
    this.$('#remix-bpm').textContent = `${this.bpm.toFixed(1)} BPM`;
    this.sampler.setEcho(this.sampler.echoAmount || 0, this.bpm);
  }

  toggle(row, step) {
    this.pattern[row][step] = !this.pattern[row][step];
    this.$(`#remix-grid [data-row="${row}"][data-step="${step}"]`).setAttribute('aria-pressed', String(this.pattern[row][step]));
    if (this.pattern[row][step] && !this.playing) this.screen.padOn(row, 0.8);
    this.save();
  }

  clear() {
    this.pattern = emptyPattern();
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

  schedule() {
    const sixteenth = 60 / this.bpm / 4;
    while (this.next < this.context.currentTime + 0.12) {
      this.pattern.forEach((row, r) => {
        const slice = this.screen.slices[r];
        if (row[this.position]) this.sampler.play(`pad-${r}`, slice, { time: this.next, velocity: this.position % 4 === 0 ? 0.9 : 0.75, mode: slice.mode === 'hold' ? 'once' : slice.mode });
      });
      this.queue.push({ step: this.position, time: this.next });
      this.next += sixteenth;
      this.position = (this.position + 1) % STEPS;
    }
  }

  drawStep() {
    while (this.queue.length && this.queue[0].time <= this.context.currentTime) this.step = this.queue.shift().step;
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
      if (pad) this.screen.padOn(Number(pad.dataset.audition), 0.85);
    });
    $('#remix-play').addEventListener('click', () => this.togglePlay());
    $('#remix-clear').addEventListener('click', () => this.clear());
    $('#remix-down').addEventListener('click', () => this.nudge(-1));
    $('#remix-up').addEventListener('click', () => this.nudge(1));
  }
}
