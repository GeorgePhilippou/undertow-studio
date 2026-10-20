// Records what you play in a record - pads, riffs, the remix and the keys -
// as a stereo take, trimmed of the silence before you start and after you
// stop. The record playing underneath is not included.

export class TakeRecorder {
  constructor(context, sources) {
    this.context = context;
    this.sources = sources;
    this.tap = context.createScriptProcessor(4096, 2, 2);
    this.silent = context.createGain();
    this.silent.gain.value = 0;
    this.tap.onaudioprocess = event => {
      // Only blocks heard after Record was pressed belong to the take.
      if (!this.recording || event.playbackTime < this.started) return;
      this.left.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      this.right.push(new Float32Array(event.inputBuffer.getChannelData(1)));
    };
  }

  get seconds() {
    return this.recording ? this.context.currentTime - this.started : 0;
  }

  // The tap stays connected while a record is open: plugging it in only when
  // Record is pressed let a stale block of earlier sound into the take.
  attach() {
    if (this.attached) return;
    this.attached = true;
    for (const source of this.sources) source.connect(this.tap);
    this.tap.connect(this.silent).connect(this.context.destination);
  }

  detach() {
    if (!this.attached || this.recording) return;
    this.attached = false;
    for (const source of this.sources) {
      try { source.disconnect(this.tap); } catch { /* not connected */ }
    }
    try { this.tap.disconnect(); } catch { /* not connected */ }
  }

  start() {
    this.attach();
    this.left = [];
    this.right = [];
    this.recording = true;
    this.started = this.context.currentTime;
  }

  // Returns an AudioBuffer of the take, or null if nothing was played.
  stop() {
    this.recording = false;
    const join = parts => {
      const all = new Float32Array(parts.reduce((sum, p) => sum + p.length, 0));
      let offset = 0;
      for (const part of parts) {
        all.set(part, offset);
        offset += part.length;
      }
      return all;
    };
    const left = join(this.left);
    const right = join(this.right);
    // Anything quieter than about -40 dB, such as the last breath of a reverb,
    // counts as silence.
    const loud = i => Math.abs(left[i]) > 0.01 || Math.abs(right[i]) > 0.01;
    let first = 0;
    while (first < left.length && !loud(first)) first++;
    let last = left.length - 1;
    while (last > first && !loud(last)) last--;
    if (first >= left.length) return null;
    const rate = this.context.sampleRate;
    const from = Math.max(0, first - Math.round(rate * 0.02));
    const to = Math.min(left.length, last + Math.round(rate * 0.3));
    const buffer = this.context.createBuffer(2, to - from, rate);
    buffer.copyToChannel(left.subarray(from, to), 0);
    buffer.copyToChannel(right.subarray(from, to), 1);
    return buffer;
  }
}
