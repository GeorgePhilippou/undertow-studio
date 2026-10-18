// Synthesized drum kits. Every kit has the same five voices so a pattern can
// change kit without changing its notes.

export const DRUM_VOICES = ['kick', 'snare', 'hat', 'clap', 'perc'];
export const DRUM_LABELS = { kick: 'Kick', snare: 'Snare', hat: 'Hi-hat', clap: 'Clap', perc: 'Metal' };

export const KITS = {
  machine: { name: 'Kid A Machine', drive: 2.6, kick: [130, 44, 0.32], snare: [1700, 0.16, 210], hat: [7200, 0.05], tone: 1 },
  electro: { name: 'Drum Machine', drive: 0.6, kick: [150, 48, 0.55], snare: [2200, 0.18, 190], hat: [8000, 0.06], tone: 1 },
  soft: { name: 'Soft Room', drive: 0, kick: [95, 50, 0.4], snare: [1300, 0.24, 170], hat: [6000, 0.07], tone: 0.55 },
};

let noiseBuffer = null;

function noise(context) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== context.sampleRate) {
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  return source;
}

function decayGain(context, output, time, peak, decay) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(peak, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  gain.connect(output);
  return gain;
}

const VOICES = {
  kick(context, output, kit, velocity, time) {
    const [start, end, decay] = kit.kick;
    const osc = context.createOscillator();
    osc.frequency.setValueAtTime(start, time);
    osc.frequency.exponentialRampToValueAtTime(end, time + 0.09);
    osc.connect(decayGain(context, output, time, 0.9 * velocity, decay));
    osc.start(time);
    osc.stop(time + decay + 0.05);
    const click = noise(context);
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2500;
    click.connect(filter).connect(decayGain(context, output, time, 0.25 * velocity * kit.tone, 0.012));
    click.start(time);
    click.stop(time + 0.03);
  },
  snare(context, output, kit, velocity, time) {
    const [band, decay, body] = kit.snare;
    const hiss = noise(context);
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = band;
    filter.Q.value = 0.7;
    hiss.connect(filter).connect(decayGain(context, output, time, 0.55 * velocity, decay));
    hiss.start(time);
    hiss.stop(time + decay + 0.05);
    const osc = context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(body, time);
    osc.frequency.exponentialRampToValueAtTime(body * 0.6, time + 0.08);
    osc.connect(decayGain(context, output, time, 0.35 * velocity * kit.tone, 0.1));
    osc.start(time);
    osc.stop(time + 0.15);
  },
  hat(context, output, kit, velocity, time) {
    const [cutoff, decay] = kit.hat;
    const hiss = noise(context);
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    hiss.connect(filter).connect(decayGain(context, output, time, 0.32 * velocity, decay));
    hiss.start(time);
    hiss.stop(time + decay + 0.05);
  },
  clap(context, output, kit, velocity, time) {
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1.1;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    [0, 0.011, 0.022].forEach(offset => {
      gain.gain.setValueAtTime(0.7 * velocity, time + offset);
      gain.gain.exponentialRampToValueAtTime(0.08 * velocity, time + offset + 0.009);
    });
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    const hiss = noise(context);
    hiss.connect(filter).connect(gain).connect(output);
    hiss.start(time);
    hiss.stop(time + 0.25);
  },
  // Six detuned square waves, the classic metallic cymbal recipe.
  perc(context, output, kit, velocity, time) {
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 8200;
    filter.Q.value = 1.4;
    filter.connect(decayGain(context, output, time, 0.22 * velocity, 0.16));
    for (const hz of [205, 296, 365, 415, 540, 800]) {
      const osc = context.createOscillator();
      osc.type = 'square';
      osc.frequency.value = hz * 1.7;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + 0.2);
    }
  },
};

export function playDrum(context, output, kitId, voice, velocity, time) {
  const kit = KITS[kitId] || KITS.electro;
  VOICES[voice]?.(context, output, kit, velocity, time);
}

// A soft-clipping curve for driven kits; null leaves the signal untouched.
export function driveCurve(amount) {
  if (!amount) return null;
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * (1 + amount)) / Math.tanh(1 + amount);
  }
  return curve;
}
