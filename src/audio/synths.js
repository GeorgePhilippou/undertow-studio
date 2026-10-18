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

// Warm analogue keyboard for Everything In Its Right Place: two detuned
// oscillators through a resonant low-pass filter that closes after each attack.
function prophet(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.006, decay: 0.9, sustain: 0.42, release: 0.35, peak: 0.09 + velocity * 0.07 });
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 3.2;
  const base = Math.min(hz * 1.4 + 180, 2400);
  filter.frequency.setValueAtTime(base + 1600 * velocity, time);
  filter.frequency.setTargetAtTime(base, time + 0.01, 0.16);
  filter.connect(voice.gain);
  voice.add(oscillator(context, 'sawtooth', hz, -6, time, filter));
  voice.add(oscillator(context, 'square', hz, 7, time, filter));
  voice.add(oscillator(context, 'triangle', hz / 2, 0, time, filter));
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

// Simple triangle piano used only while the samples are loading.
function fallbackPiano(context, output, midi, velocity, time) {
  const hz = frequency(midi);
  const voice = envelope(context, output, time, { attack: 0.003, decay: 1.8, sustain: 0.04, release: 0.3, peak: 0.14 + velocity * 0.12 });
  voice.add(oscillator(context, 'triangle', hz, 0, time, voice.gain));
  voice.add(oscillator(context, 'sine', hz * 2, 3, time, voice.gain));
  return voice;
}

export const SYNTHS = { prophet, lansky, epiano, musicbox, organ, bass, guitar, fallbackPiano };
