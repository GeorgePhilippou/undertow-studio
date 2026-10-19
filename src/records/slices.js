// Cuts a record into sampler pads, like loading a break into a sampler.

const HOP = 512;

// Loudness per hop, mixed to mono.
function energies(buffer) {
  const channels = [...Array(buffer.numberOfChannels).keys()].map(c => buffer.getChannelData(c));
  const count = Math.floor(buffer.length / HOP);
  const levels = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (const data of channels) {
      for (let j = i * HOP; j < (i + 1) * HOP; j += 2) sum += data[j] * data[j];
    }
    levels[i] = sum / (HOP / 2) / channels.length;
  }
  return levels;
}

// Moments where the sound suddenly gets louder: [{ time, strength }].
export function attacks(buffer) {
  const levels = energies(buffer);
  const rate = buffer.sampleRate / HOP;
  const flux = new Float32Array(levels.length);
  for (let i = 4; i < levels.length; i++) {
    const before = (levels[i - 1] + levels[i - 2] + levels[i - 3] + levels[i - 4]) / 4;
    flux[i] = Math.max(0, Math.log10(levels[i] + 1e-7) - Math.log10(before + 1e-7)) * Math.sqrt(levels[i]);
  }
  let mean = 0;
  for (const value of flux) mean += value;
  mean /= flux.length || 1;
  const found = [];
  for (let i = 3; i < flux.length - 3; i++) {
    const value = flux[i];
    if (value <= mean * 1.5) continue;
    let peak = true;
    for (let j = i - 3; j <= i + 3; j++) if (flux[j] > value) peak = false;
    if (peak) found.push({ time: Math.max(0, i / rate - 0.012), strength: value });
  }
  return found;
}

// Sixteen slices at the strongest attacks, spread out across the record.
export function sliceAtAttacks(buffer, count = 16) {
  const all = attacks(buffer);
  const gap = Math.min(4, buffer.duration / (count * 1.5));
  const chosen = [];
  for (const attack of [...all].sort((a, b) => b.strength - a.strength)) {
    if (chosen.every(c => Math.abs(c.time - attack.time) >= gap)) chosen.push(attack);
    if (chosen.length === count) break;
  }
  chosen.sort((a, b) => a.time - b.time);
  const slices = chosen.map(({ time }) => {
    const next = all.find(a => a.time > time + 0.35);
    const end = Math.min(next ? next.time : buffer.duration, time + 3, buffer.duration);
    return { start: time, end: Math.max(end, Math.min(time + 0.3, buffer.duration)) };
  });
  // A quiet or very short record still gets sixteen pads.
  while (slices.length < count) {
    const step = buffer.duration / count;
    const start = slices.length * step;
    slices.push({ start, end: Math.min(start + Math.min(step, 3), buffer.duration) });
  }
  return slices.sort((a, b) => a.start - b.start);
}

// A stretch of the record cut into equal slices, such as one per beat.
export function sliceEvenly(start, end, count = 16) {
  const step = (end - start) / count;
  return [...Array(count).keys()].map(i => ({ start: start + i * step, end: start + (i + 1) * step }));
}
