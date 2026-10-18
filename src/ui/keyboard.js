// On-screen piano, chord pads and drum pads. All three accept several fingers
// at once; the piano also lets a finger glide from key to key.

import { noteName } from '../songs.js';
import { DRUM_LABELS } from '../audio/drums.js';

const BLACK = new Set([1, 3, 6, 8, 10]);

// Velocity from Pencil pressure, or from how far down the key was touched.
function velocityOf(event, element) {
  if (event.pointerType === 'pen' && event.pressure > 0) return Math.min(1, 0.2 + event.pressure * 0.9);
  const box = element.getBoundingClientRect();
  const depth = (event.clientY - box.top) / box.height;
  return Math.max(0.35, Math.min(1, 0.4 + depth * 0.6));
}

export class Keyboard {
  constructor({ piano, pads, drumPads }, handlers) {
    this.pianoElement = piano;
    this.padsElement = pads;
    this.drumElement = drumPads;
    this.handlers = handlers;
    this.low = 48;
    this.high = 72;
    this.keys = new Map();
    this.pointers = new Map();
    this.down = new Set();
    this.pads = [];
    this.bindPiano();
    this.bindPads(pads, 'pad');
    this.bindPads(drumPads, 'drum');
  }

  whiteCount() {
    const width = this.pianoElement.clientWidth || 600;
    const minimum = width < 500 ? 30 : 38;
    return Math.max(8, Math.min(29, Math.floor(width / minimum)));
  }

  // Lays out as many white keys as fit, starting from a white note.
  layout(low) {
    this.low = Math.max(21, Math.min(low, 96));
    if (BLACK.has(this.low % 12)) this.low--;
    let whites = 0;
    let midi = this.low;
    while (whites < this.whiteCount()) {
      if (!BLACK.has(midi % 12)) whites++;
      midi++;
    }
    this.high = midi - 1;
    this.render();
    return { low: this.low, high: this.high };
  }

  // Chooses a range that shows every note from min to max, or the top of it.
  fit(min, max) {
    let low = BLACK.has(min % 12) ? min - 1 : min;
    let whites = 0;
    for (let midi = low; midi <= max; midi++) if (!BLACK.has(midi % 12)) whites++;
    if (whites > this.whiteCount()) {
      low = max;
      for (let count = 0; count < this.whiteCount() - 1 || BLACK.has(low % 12); ) {
        low--;
        if (!BLACK.has(low % 12)) count++;
      }
    }
    return this.layout(low);
  }

  render() {
    this.pianoElement.replaceChildren();
    this.keys.clear();
    const whites = [];
    for (let midi = this.low; midi <= this.high; midi++) if (!BLACK.has(midi % 12)) whites.push(midi);
    const whiteWidth = 100 / whites.length;
    for (let midi = this.low; midi <= this.high; midi++) {
      const key = document.createElement('button');
      key.dataset.midi = midi;
      key.tabIndex = -1;
      key.setAttribute('aria-label', noteName(midi));
      if (BLACK.has(midi % 12)) {
        key.className = 'black';
        const index = whites.filter(w => w < midi).length;
        key.style.left = `calc(${index * whiteWidth}% - ${whiteWidth * 0.31}%)`;
        key.style.width = `${whiteWidth * 0.62}%`;
      } else {
        key.className = 'white';
        if (midi % 12 === 0) key.innerHTML = `<span class="label-c">${noteName(midi)}</span>`;
        else if (this.labels) key.innerHTML = `<span class="label-c">${noteName(midi, false)}</span>`;
      }
      this.pianoElement.append(key);
      this.keys.set(midi, key);
    }
    this.refresh();
  }

  bindPiano() {
    const element = this.pianoElement;
    const keyAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-midi]');
    element.addEventListener('pointerdown', event => {
      const key = event.target.closest('[data-midi]');
      if (!key) return;
      event.preventDefault();
      element.setPointerCapture?.(event.pointerId);
      const midi = Number(key.dataset.midi);
      this.pointers.set(event.pointerId, midi);
      this.press(midi, velocityOf(event, key));
    });
    element.addEventListener('pointermove', event => {
      if (!this.pointers.has(event.pointerId)) return;
      const key = keyAt(event.clientX, event.clientY);
      const midi = key && element.contains(key) ? Number(key.dataset.midi) : null;
      const previous = this.pointers.get(event.pointerId);
      if (midi === previous || midi === null) return;
      this.release(previous);
      this.pointers.set(event.pointerId, midi);
      this.press(midi, velocityOf(event, key));
    });
    const end = event => {
      if (!this.pointers.has(event.pointerId)) return;
      this.release(this.pointers.get(event.pointerId));
      this.pointers.delete(event.pointerId);
    };
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('lostpointercapture', end);
    element.addEventListener('contextmenu', event => event.preventDefault());
  }

  bindPads(element, kind) {
    const active = new Map();
    element.addEventListener('pointerdown', event => {
      const pad = event.target.closest('[data-index]');
      if (!pad) return;
      event.preventDefault();
      const index = Number(pad.dataset.index);
      active.set(event.pointerId, index);
      pad.classList.add('down');
      if (kind === 'pad') this.handlers.padOn(this.pads[index], velocityOf(event, pad));
      else this.handlers.drum(this.drums[index], velocityOf(event, pad));
    });
    const end = event => {
      if (!active.has(event.pointerId)) return;
      const index = active.get(event.pointerId);
      active.delete(event.pointerId);
      element.querySelector(`[data-index="${index}"]`)?.classList.remove('down');
      if (kind === 'pad') this.handlers.padOff(this.pads[index]);
    };
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('pointerleave', end);
    element.addEventListener('contextmenu', event => event.preventDefault());
    // Keyboard users can still press pads with Enter or Space.
    element.addEventListener('click', event => {
      if (event.detail !== 0) return;
      const pad = event.target.closest('[data-index]');
      if (!pad) return;
      const index = Number(pad.dataset.index);
      if (kind === 'pad') {
        this.handlers.padOn(this.pads[index], 0.75);
        setTimeout(() => this.handlers.padOff(this.pads[index]), 400);
      } else {
        this.handlers.drum(this.drums[index], 0.8);
      }
    });
  }

  press(midi, velocity) {
    this.down.add(midi);
    this.handlers.noteOn(midi, velocity);
    this.refresh();
  }

  release(midi) {
    this.down.delete(midi);
    this.handlers.noteOff(midi);
    this.refresh();
  }

  setPads(pads) {
    this.pads = pads;
    this.padsElement.innerHTML = pads.map((pad, i) => `
      <button class="pad" data-index="${i}" aria-label="${pad.name}">
        <span class="number">${i + 1}</span>
        <strong>${pad.name}</strong>
        <small>${pad.notes.map(n => noteName(n, false)).filter((n, j, all) => all.indexOf(n) === j).join(' ')}</small>
      </button>`).join('');
  }

  setDrums(voices) {
    this.drums = voices;
    this.drumElement.innerHTML = voices.map((voice, i) => `
      <button class="pad" data-index="${i}" aria-label="${DRUM_LABELS[voice]}">
        <span class="number">${i + 1}</span><strong>${DRUM_LABELS[voice]}</strong><small></small>
      </button>`).join('');
  }

  show(tab) {
    this.tab = tab;
    this.pianoElement.hidden = tab !== 'keys';
    this.padsElement.hidden = tab !== 'chords';
    this.drumElement.hidden = tab !== 'drums';
  }

  // targets: notes or drum names to play next; sounding: what the song plays now.
  highlight({ targets = new Set(), sounding = new Set(), chord = null, soundingChord = null, external = new Set() }) {
    this.state = { targets, sounding, chord, soundingChord, external };
    this.refresh();
  }

  refresh() {
    const { targets = new Set(), sounding = new Set(), chord = null, soundingChord = null, external = new Set() } = this.state || {};
    if (this.tab === 'keys' || !this.tab) {
      const visibleTargets = new Set();
      for (const midi of targets) {
        if (typeof midi !== 'number') continue;
        let shown = midi;
        while (shown < this.low) shown += 12;
        while (shown > this.high) shown -= 12;
        if (shown >= this.low) visibleTargets.add(shown);
      }
      for (const [midi, key] of this.keys) {
        key.classList.toggle('down', this.down.has(midi) || external.has(midi));
        key.classList.toggle('target', visibleTargets.has(midi));
        key.classList.toggle('sounding', sounding.has(midi));
      }
    }
    if (this.tab === 'chords') {
      this.padsElement.querySelectorAll('.pad').forEach((element, i) => {
        element.classList.toggle('target', this.pads[i]?.name === chord);
        element.classList.toggle('sounding', this.pads[i]?.name === soundingChord);
      });
    }
    if (this.tab === 'drums') {
      this.drumElement.querySelectorAll('.pad').forEach((element, i) => {
        element.classList.toggle('target', targets.has(this.drums[i]));
        element.classList.toggle('sounding', sounding.has(this.drums[i]));
      });
    }
  }

  releaseAll() {
    for (const midi of [...this.down]) this.release(midi);
    this.pointers.clear();
  }
}
