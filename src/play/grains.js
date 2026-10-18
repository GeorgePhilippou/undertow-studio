// Granular playing of a recording. A finger becomes a stream of short,
// overlapping fragments ("grains") taken from one moment of the song. Low on
// the screen the moment moves forward at normal speed, so you hear the song;
// high up it slows to a standstill and the grains blur into a shimmering cloud.

const LOOKAHEAD = 0.12;
const windows = new Map();

// A smooth fade in and out for each grain, so fragments join without clicks.
function hann(size = 256) {
  if (!windows.has(size)) {
    const curve = new Float32Array(size);
    for (let i = 0; i < size; i++) curve[i] = Math.sin((Math.PI * i) / (size - 1)) ** 2;
    windows.set(size, curve);
  }
  return windows.get(size);
}

export class GrainCloud {
  constructor(context, buffer, output) {
    this.context = context;
    this.buffer = buffer;
    this.output = output;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(output);
    this.grains = 0;
  }

  // position in seconds; air from 0 (play normally) to 1 (frozen cloud).
  start(position, air, level = 0.8) {
    const now = this.context.currentTime;
    this.position = position;
    this.set(position, air);
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(level, now, 0.02);
    this.next = now + 0.01;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  set(position, air) {
    if (Math.abs(position - this.target) > 0.25 || this.target === undefined) this.position = position;
    this.target = position;
    this.air = Math.max(0, Math.min(1, air));
  }

  schedule() {
    const until = this.context.currentTime + LOOKAHEAD;
    const duration = this.buffer.duration;
    while (this.next < until) {
      const air = this.air;
      const size = 0.09 + air * 0.28;
      const spacing = size / (3 + air * 3);
      const speed = Math.max(0, 1 - air * 1.15);
      // Drift towards the finger if it has moved a little, otherwise keep going.
      this.position += (this.target - this.position) * 0.2 + speed * spacing;
      this.target += speed * spacing;
      const jitter = (Math.random() - 0.5) * air * 0.12;
      const offset = Math.min(Math.max(0, this.position + jitter), duration - size - 0.01);
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      source.detune.value = (Math.random() - 0.5) * air * 24;
      const envelope = this.context.createGain();
      envelope.gain.value = 0;
      envelope.gain.setValueCurveAtTime(hann(), this.next, size);
      source.connect(envelope).connect(this.gain);
      source.start(this.next, offset, size + 0.01);
      this.next += spacing;
      this.grains++;
    }
  }

  // Seconds into the song that is sounding now.
  get now() {
    return this.position;
  }

  stop() {
    clearInterval(this.timer);
    const now = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(0, now, 0.08);
    setTimeout(() => this.gain.disconnect(), 800);
  }
}

// The whole track played straight through, as the Your Song "band".
export class TrackPlayer {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.offset = 0;
    this.source = null;
  }

  get playing() {
    return Boolean(this.source);
  }

  get position() {
    if (!this.buffer) return 0;
    if (!this.source) return this.offset;
    return (this.offset + (this.context.currentTime - this.started)) % this.buffer.duration;
  }

  load(buffer) {
    this.stop();
    this.buffer = buffer;
    this.offset = 0;
  }

  play(from = this.offset) {
    if (!this.buffer) return;
    this.stop();
    this.offset = Math.max(0, Math.min(from, this.buffer.duration - 0.05));
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = true;
    this.source.connect(this.output);
    this.started = this.context.currentTime;
    this.source.start(this.started, this.offset);
  }

  stop() {
    if (!this.source) return;
    this.offset = this.position;
    try { this.source.stop(); } catch { /* already stopped */ }
    this.source.disconnect();
    this.source = null;
  }
}
