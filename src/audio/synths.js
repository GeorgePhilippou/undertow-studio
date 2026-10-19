// Synthesized instruments. Each returns a voice with release(time).

const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

function envelope(context, output, time, { attack, decay, sustain, release, peak }) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + attack);
  gain.gain.setTargetAtTime(peak * sustain, time + attack, decay / 3);
  gain.connect(output);
  const sources = [];
  return {
    gain,
    add(node) { sources.push(node); return node; },
    release(at) {
      const end = Math.max(at, time + attack);
      gain.gain.cancelScheduledValues(end);
      gain.gain.setTargetAtTime(0, end, release / 4);
      for (const source of sources) {
        try { source.stop(end + release * 1.5); } catch { /* already stopped */ }
      }
    },
  };
}

function oscillator(context, type, hz, detune, time, destination) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.value = hz;
  osc.detune.value = detune;
  osc.connect(destination);
  osc.start(time);
  return osc;
}

// Pulse waves, which Web Audio lacks: a Fourier series with the given duty cycle.
const pulses = new WeakMap();
function pulseWave(context, duty) {
  if (!pulses.has(context)) pulses.set(context, new Map());
  const cache = pulses.get(context);
  if (!cache.has(duty)) {
    const real = new Float32Array(64);
    const imag = new Float32Array(64);
    for (let n = 1; n < 64; n++) {
      real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }
    cache.set(duty, context.createPeriodicWave(real, imag));
  }
  return cache.get(duty);
}

// The Prophet-5 keyboard of Everything In Its Right Place, after published
// recreations: two pulse oscillators through a fairly closed, resonant
// low-pass filter that sweeps down after each key, a long amp decay, about
// 19 cents flat like the record, and two takes panned hard left and right.
// On the record the filter was turned by hand while a MIDI take replayed, so
// each side's brightness drifts slowly over time.
function prophet(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.004, decay: 2.1, sustain: 0.7, release: 0.35, peak: 0.075 + velocity * 0.06 });
  const sides = [
    { pan: -0.9, delay: 0, detune: -21, drift: Math.sin(time * 2 * Math.PI / 23) },
    { pan: 0.9, delay: 0.011, detune: -16, drift: Math.cos(time * 2 * Math.PI / 31) },
  ];
  for (const side of sides) {
    const start = time + side.delay;
    const level = context.createGain();
    level.gain.value = 0.5;
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = side.pan;
      level.connect(panner).connect(voice.gain);
    } else {
      level.connect(voice.gain);
    }
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4.5;
    const base = 140 + hz * 0.9;
    const open = (700 + 2100 * velocity) * (1 + 0.35 * side.drift);
    filter.frequency.setValueAtTime(base + open, start);
    filter.frequency.setTargetAtTime(base * 1.5, start + 0.005, 0.28);
    filter.connect(level);
    for (const [duty, cents] of [[0.32, 0], [0.45, 5]]) {
      const osc = context.createOscillator();
      osc.setPeriodicWave(pulseWave(context, duty));
      osc.frequency.value = hz;
      osc.detune.value = side.detune + cents;
      osc.connect(filter);
      osc.start(start);
      voice.add(osc);
    }
  }
  return voice;
}

// Glassy, trembling chord pad standing in for the Paul Lansky sample in Idioteque.
function lansky(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.09, decay: 2.5, sustain: 0.7, release: 1.1, peak: 0.07 + velocity * 0.05 });
  const tremolo = context.createGain();
  tremolo.gain.value = 0.82;
  const lfo = voice.add(context.createOscillator());
  lfo.frequency.value = 5.3 + (midi % 5) * 0.21;
  const depth = context.createGain();
  depth.gain.value = 0.18;
  lfo.connect(depth).connect(tremolo.gain);
  lfo.start(time);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 4200;
  tremolo.connect(filter).connect(voice.gain);
  [[1, 1], [2, 0.42], [3, 0.3], [4, 0.12], [5, 0.16], [7, 0.05]].forEach(([ratio, level], i) => {
    const partial = context.createGain();
    partial.gain.value = level;
    partial.connect(tremolo);
    voice.add(oscillator(context, 'sine', hz * ratio, i % 2 ? 4 : -3, time, partial));
  });
  return voice;
}

// FM electric piano.
function epiano(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.003, decay: 2.6, sustain: 0.05, release: 0.4, peak: 0.16 + velocity * 0.12 });
  const carrier = voice.add(oscillator(context, 'sine', hz, 0, time, voice.gain));
  const modulator = voice.add(context.createOscillator());
  modulator.frequency.value = hz;
  const index = context.createGain();
  index.gain.setValueAtTime(hz * (1.2 + velocity * 2.2), time);
  index.gain.setTargetAtTime(hz * 0.25, time, 0.35);
  modulator.connect(index).connect(carrier.frequency);
  modulator.start(time);
  const tine = voice.add(context.createOscillator());
  tine.frequency.value = hz * 14;
  const tineIndex = context.createGain();
  tineIndex.gain.setValueAtTime(hz * velocity * 1.5, time);
  tineIndex.gain.setTargetAtTime(0, time, 0.02);
  tine.connect(tineIndex).connect(carrier.frequency);
  tine.start(time);
  return voice;
}

function musicbox(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.002, decay: 1.6, sustain: 0, release: 0.5, peak: 0.12 + velocity * 0.12 });
  [[1, 1], [3, 0.22], [5.04, 0.1], [8.2, 0.04]].forEach(([ratio, level]) => {
    const partial = context.createGain();
    partial.gain.value = level;
    partial.connect(voice.gain);
    voice.add(oscillator(context, 'sine', hz * ratio, 0, time, partial));
  });
  return voice;
}

// Reed organ with a gentle vibrato, like air moving through a harmonium.
function organ(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.06, decay: 1, sustain: 0.85, release: 0.25, peak: 0.06 + velocity * 0.04 });
  const vibrato = voice.add(context.createOscillator());
  vibrato.frequency.value = 5.6;
  const depth = context.createGain();
  depth.gain.setValueAtTime(0, time);
  depth.gain.linearRampToValueAtTime(7, time + 0.4);
  vibrato.connect(depth);
  vibrato.start(time);
  [[0.5, 0.6], [1, 1], [2, 0.5], [3, 0.25]].forEach(([ratio, level]) => {
    const partial = context.createGain();
    partial.gain.value = level;
    partial.connect(voice.gain);
    const osc = voice.add(oscillator(context, 'sine', hz * ratio, 0, time, partial));
    depth.connect(osc.detune);
  });
  return voice;
}

function bass(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.004, decay: 0.5, sustain: 0.6, release: 0.12, peak: 0.22 + velocity * 0.14 });
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900 * velocity + 300, time);
  filter.frequency.setTargetAtTime(380, time, 0.12);
  filter.connect(voice.gain);
  voice.add(oscillator(context, 'sawtooth', hz, 0, time, filter));
  voice.add(oscillator(context, 'sine', hz, 0, time, voice.gain));
  return voice;
}

// Plucked string (Karplus-Strong): a burst of noise circulating in a tuned,
// slightly lossy delay line. Each pitch is rendered once and reused.
const strings = new Map();

function stringBuffer(context, midi) {
  const key = `${context.sampleRate}:${midi}`;
  if (strings.has(key)) return strings.get(key);
  const rate = context.sampleRate;
  const length = Math.round(rate * 3);
  const buffer = context.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  const period = rate / frequency(midi);
  const delay = period - 0.5; // the averaging filter adds half a sample
  const whole = Math.floor(delay);
  const frac = delay - whole;
  const loss = 0.996 + Math.min(0.0035, (60 - Math.min(60, midi - 30)) * 0.00004);
  let previous = 0;
  for (let i = 0; i < length; i++) {
    let sample;
    if (i < period) {
      // A softened pick: noise smoothed a little so it is not too bright.
      previous += 0.55 * ((Math.random() * 2 - 1) - previous);
      sample = previous;
    } else {
      const a = out[i - whole] * (1 - frac) + out[i - whole - 1] * frac;
      const b = out[i - whole - 1] * (1 - frac) + (out[i - whole - 2] ?? 0) * frac;
      sample = loss * 0.5 * (a + b);
    }
    out[i] = sample;
  }
  strings.set(key, buffer);
  return buffer;
}

function guitar(context, output, midi, velocity, time) {
  const source = context.createBufferSource();
  source.buffer = stringBuffer(context, midi);
  const tone = context.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1800 + velocity * 4200;
  const body = context.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 220;
  body.gain.value = 4;
  const gain = context.createGain();
  gain.gain.value = 0.3 + velocity * 0.5;
  source.connect(tone).connect(body).connect(gain).connect(output);
  source.start(time);
  source.stop(time + source.buffer.duration);
  return {
    release(at) {
      // Lifting the finger damps the string.
      gain.gain.setTargetAtTime(0, Math.max(at, time), 0.06);
      try { source.stop(Math.max(at, time) + 0.4); } catch { /* already stopped */ }
    },
  };
}

// Singing electronic lead in the spirit of the ondes Martenot: a pure tone
// with a slow vibrato that can glide from note to note under the finger.
function ondes(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.07, decay: 1.5, sustain: 0.85, release: 0.45, peak: 0.1 + velocity * 0.1 });
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400 + velocity * 2600;
  filter.connect(voice.gain);
  const vibrato = voice.add(context.createOscillator());
  vibrato.frequency.value = 5.4;
  const depth = context.createGain();
  depth.gain.setValueAtTime(0, time);
  depth.gain.linearRampToValueAtTime(14, time + 0.5);
  vibrato.connect(depth);
  vibrato.start(time);
  const oscillators = [['sine', 1, 1], ['triangle', 1, 0.35], ['sine', 2, 0.12]].map(([type, ratio, level]) => {
    const gain = context.createGain();
    gain.gain.value = level;
    gain.connect(filter);
    const osc = voice.add(oscillator(context, type, hz * ratio, 0, time, gain));
    depth.connect(osc.detune);
    return { osc, ratio };
  });
  voice.setPitch = (next, at) => {
    for (const { osc, ratio } of oscillators) osc.frequency.setTargetAtTime(frequency(next) * ratio, at, 0.045);
  };
  voice.setBrightness = (amount, at) => filter.frequency.setTargetAtTime(900 + amount * 4000, at, 0.05);
  return voice;
}

// Tape-replay strings: three detuned saws, softened, with a slow wow.
function tapeStrings(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.28, decay: 2, sustain: 0.8, release: 0.7, peak: 0.035 + velocity * 0.03 });
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1500 + velocity * 900;
  filter.connect(voice.gain);
  const wow = voice.add(context.createOscillator());
  wow.frequency.value = 0.55;
  const depth = context.createGain();
  depth.gain.value = 6;
  wow.connect(depth);
  wow.start(time);
  for (const detune of [-9, 0, 8]) {
    const osc = voice.add(oscillator(context, 'sawtooth', hz, detune, time, filter));
    depth.connect(osc.detune);
  }
  return voice;
}

// Simple triangle piano used only while the samples are loading.
function fallbackPiano(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.003, decay: 1.8, sustain: 0.04, release: 0.3, peak: 0.14 + velocity * 0.12 });
  voice.add(oscillator(context, 'triangle', hz, 0, time, voice.gain));
  voice.add(oscillator(context, 'sine', hz * 2, 3, time, voice.gain));
  return voice;
}

export const SYNTHS = { prophet, lansky, epiano, musicbox, organ, bass, guitar, ondes, strings: tapeStrings, fallbackPiano };
