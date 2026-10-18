// Salamander Grand Piano (Yamaha C5) by Alexander Holm, CC BY 3.0.
// Samples are spaced in minor thirds and repitched to the nearest note.
// See assets/piano/README.

const SAMPLE_NAMES = ['A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4',
  'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7'];
const OFFSETS = { C: 0, Ds: 3, Fs: 6, A: 9 };

const buffers = new Map();
let loading = null;

function sampleMidi(name) {
  const [, letter, octave] = /^([A-Z]s?)(\d)$/.exec(name);
  return (Number(octave) + 1) * 12 + OFFSETS[letter];
}

export function loadPiano(context) {
  if (loading) return loading;
  loading = Promise.all(SAMPLE_NAMES.map(async name => {
    try {
      const response = await fetch(new URL(`../../assets/piano/${name}.mp3`, import.meta.url));
      if (!response.ok) return;
      const data = await response.arrayBuffer();
      const buffer = await new Promise((resolve, reject) => context.decodeAudioData(data, resolve, reject));
      buffers.set(sampleMidi(name), buffer);
    } catch {
      // A missing sample falls back to its neighbours or to synthesis.
    }
  })).then(() => buffers.size);
  return loading;
}

export function pianoReady() {
  return buffers.size > 0;
}

function nearest(midi) {
  let best = null;
  for (const root of buffers.keys()) {
    if (best === null || Math.abs(root - midi) < Math.abs(best - midi)) best = root;
  }
  return best;
}

export function piano(context, output, midi, velocity, time) {
  const root = nearest(midi);
  if (root === null) return null;
  const source = context.createBufferSource();
  source.buffer = buffers.get(root);
  source.playbackRate.value = 2 ** ((midi - root) / 12);
  const tone = context.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1200 + velocity * velocity * 9000;
  const gain = context.createGain();
  gain.gain.value = 0.25 + velocity ** 1.4 * 0.75;
  source.connect(tone).connect(gain).connect(output);
  source.start(time);
  const natural = source.buffer.duration / source.playbackRate.value;
  source.stop(time + natural);
  return {
    release(at) {
      gain.gain.setTargetAtTime(0, Math.max(at, time), 0.09);
      try { source.stop(Math.max(at, time) + 0.6); } catch { /* already stopped */ }
    },
  };
}
