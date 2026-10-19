// Plays slices of a record, like an old hardware sampler: once, while held,
// or looping, at any pitch, forwards or reversed, through a filter and echo.

export const MODES = { once: 'Once', hold: 'Hold', loop: 'Loop' };

export class Sampler {
  constructor(context, output) {
    this.context = context;
    this.voices = new Map();
    this.reversed = new Map();
    this.input = context.createGain();
    this.filter = context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.9;
    this.delay = context.createDelay(2);
    this.feedback = context.createGain();
    this.wet = context.createGain();
    this.wet.gain.value = 0;
    this.feedback.gain.value = 0.42;
    this.input.connect(this.filter).connect(output);
    this.filter.connect(this.delay);
    this.delay.connect(this.feedback).connect(this.delay);
    this.delay.connect(this.wet).connect(output);
    this.setEcho(0, 120);
  }

  setBuffer(buffer) {
    this.stopAll();
    this.buffer = buffer;
    this.reversed.clear();
  }

  // 0 is open; 1 closes the low-pass filter right down.
  setFilter(amount) {
    this.filterAmount = amount;
    const hz = 20000 * Math.pow(160 / 20000, amount);
    this.filter.frequency.setTargetAtTime(hz, this.context.currentTime, 0.02);
    this.filter.Q.setTargetAtTime(0.9 + amount * 5, this.context.currentTime, 0.02);
  }

  // An echo three sixteenths long, the dub delay of a thousand remixes.
  setEcho(amount, bpm) {
    this.echoAmount = amount;
    this.delay.delayTime.setTargetAtTime(Math.min(1.9, (60 / (bpm || 120)) * 0.75), this.context.currentTime, 0.02);
    this.wet.gain.setTargetAtTime(amount * 0.7, this.context.currentTime, 0.02);
  }

  reverseOf(slice) {
    const key = `${slice.start}-${slice.end}`;
    if (!this.reversed.has(key)) {
      const rate = this.buffer.sampleRate;
      const from = Math.floor(slice.start * rate);
      const length = Math.max(1, Math.floor((slice.end - slice.start) * rate));
      const copy = this.context.createBuffer(this.buffer.numberOfChannels, length, rate);
      for (let c = 0; c < this.buffer.numberOfChannels; c++) {
        const source = this.buffer.getChannelData(c);
        const target = copy.getChannelData(c);
        for (let i = 0; i < length; i++) target[i] = source[from + length - 1 - i] || 0;
      }
      this.reversed.set(key, copy);
    }
    return this.reversed.get(key);
  }

  // Starts a slice. Anything already playing under the same key is cut, as
  // one pad chokes itself on a sampler.
  play(key, slice, { time = this.context.currentTime, velocity = 0.85, onEnd } = {}) {
    if (!this.buffer || !slice) return null;
    this.stop(key, time);
    const length = Math.max(0.02, slice.end - slice.start);
    const rate = 2 ** ((slice.pitch || 0) / 12);
    const level = 0.35 + velocity * 0.65;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.004);
    gain.connect(this.input);
    const source = this.context.createBufferSource();
    source.playbackRate.value = rate;
    if (slice.reverse) {
      source.buffer = this.reverseOf(slice);
    } else {
      source.buffer = this.buffer;
    }
    const offset = slice.reverse ? 0 : slice.start;
    source.connect(gain);
    if (slice.mode === 'loop') {
      source.loop = true;
      source.loopStart = offset;
      source.loopEnd = offset + length;
      source.start(time, offset);
    } else {
      const heard = length / rate;
      source.start(time, offset, length + 0.01);
      gain.gain.setValueAtTime(level, time + Math.max(0.005, heard - 0.012));
      gain.gain.linearRampToValueAtTime(0, time + heard);
    }
    const voice = { source, gain, key, slice, started: time, rate, length, loop: slice.mode === 'loop' };
    this.voices.set(key, voice);
    source.onended = () => {
      if (this.voices.get(key) === voice) this.voices.delete(key);
      onEnd?.();
    };
    return voice;
  }

  stop(key, time = this.context.currentTime) {
    const voice = this.voices.get(key);
    if (!voice) return;
    this.voices.delete(key);
    voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, time);
    voice.gain.gain.linearRampToValueAtTime(0, time + 0.015);
    try { voice.source.stop(time + 0.02); } catch { /* already stopped */ }
  }

  // How far through its slice a voice is, from 0 to 1, or null when silent.
  progress(key) {
    const voice = this.voices.get(key);
    if (!voice) return null;
    const through = ((this.context.currentTime - voice.started) * voice.rate) / voice.length;
    if (through < 0) return 0;
    return voice.loop ? through % 1 : Math.min(1, through);
  }

  playing(key) {
    return this.voices.has(key);
  }

  stopAll() {
    for (const key of [...this.voices.keys()]) this.stop(key);
  }
}
