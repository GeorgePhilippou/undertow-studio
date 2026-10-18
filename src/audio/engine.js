// Audio graph: one channel per part plus a channel for the player, a shared
// room reverb, and a gentle compressor on the output.

import { piano, loadPiano, pianoReady } from './piano.js';
import { SYNTHS } from './synths.js';
import { playDrum, driveCurve, KITS } from './drums.js';

export const INSTRUMENTS = {
  piano: 'Grand Piano',
  prophet: 'Analogue Keys',
  lansky: 'Glass Pad',
  epiano: 'Electric Piano',
  musicbox: 'Music Box',
  organ: 'Organ',
  bass: 'Synth Bass',
};

const REVERB = { piano: 0.22, prophet: 0.12, lansky: 0.35, epiano: 0.2, musicbox: 0.4, organ: 0.25, bass: 0.03 };

function impulse(context, seconds = 2.4) {
  const length = Math.round(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2;
  }
  return buffer;
}

export class Engine {
  constructor(context) {
    this.context = context;
    this.output = context.createGain();
    this.output.gain.value = 0.75;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    // A fast, hard second stage keeps peaks below full scale.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    this.output.connect(compressor).connect(limiter).connect(context.destination);
    this.reverb = context.createConvolver();
    this.reverb.buffer = impulse(context);
    const wet = context.createGain();
    wet.gain.value = 0.8;
    this.reverb.connect(wet).connect(this.output);
    this.channels = new Map();
  }

  channel(id, { volume = 1, instrument = 'piano', kit = null } = {}) {
    let channel = this.channels.get(id);
    if (!channel) {
      const input = this.context.createGain();
      const shaper = this.context.createWaveShaper();
      const level = this.context.createGain();
      const send = this.context.createGain();
      input.connect(shaper).connect(level).connect(this.output);
      level.connect(send).connect(this.reverb);
      channel = { input, shaper, level, send, drive: null };
      this.channels.set(id, channel);
    }
    const drive = kit ? KITS[kit]?.drive || 0 : 0;
    if (channel.drive !== drive) {
      channel.shaper.curve = driveCurve(drive);
      channel.drive = drive;
    }
    // Distortion raises the level, so driven kits are turned down to match.
    channel.level.gain.value = volume / (1 + drive * 0.35);
    channel.send.gain.value = kit ? 0.08 : REVERB[instrument] ?? 0.15;
    return channel.input;
  }

  // Starts one note and returns a voice that must be released.
  noteOn(instrument, midi, velocity, time, destination) {
    const at = Math.max(time, this.context.currentTime);
    if (instrument === 'piano') {
      const voice = piano(this.context, destination, midi, velocity, at);
      if (voice) return voice;
      return SYNTHS.fallbackPiano(this.context, destination, midi, velocity, at);
    }
    return (SYNTHS[instrument] || SYNTHS.epiano)(this.context, destination, midi, velocity, at);
  }

  note(instrument, midi, velocity, time, duration, destination) {
    this.noteOn(instrument, midi, velocity, time, destination).release(time + duration);
  }

  drum(kit, voice, velocity, time, destination) {
    playDrum(this.context, destination, kit, voice, velocity, Math.max(time, this.context.currentTime));
  }

  click(time, accent) {
    const osc = this.context.createOscillator();
    osc.frequency.value = accent ? 1760 : 1320;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(accent ? 0.22 : 0.13, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(gain).connect(this.output);
    osc.start(time);
    osc.stop(time + 0.05);
  }
}

export { loadPiano, pianoReady };
