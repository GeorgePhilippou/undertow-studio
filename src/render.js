// Offline rendering to a 16-bit stereo WAV file.

import { Engine, loadPiano } from './audio/engine.js';
import { loopEvents } from './songs.js';

const RATE = 44100;
const TAIL = 3;

export async function renderWav(song, { beats, muted = new Set(), take = null, instruments = {}, volumes = {} }) {
  const seconds = beats * (60 / song.bpm) + TAIL;
  const context = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  await loadPiano(context);
  const engine = new Engine(context);
  const time = beat => 0.05 + beat * (60 / song.bpm);
  const play = (part, event, beat, output, instrument) => {
    if (event.drum) return engine.drum(part.kit, event.drum, event.velocity, time(beat), output);
    for (const midi of event.notes) {
      engine.note(instrument, midi, event.velocity, time(beat), Math.max(0.05, event.length * (60 / song.bpm)), output);
    }
  };
  for (const part of song.parts) {
    if (muted.has(part.id) || take?.part === part.id) continue;
    const instrument = instruments[part.id] || part.instrument;
    const output = engine.channel(part.id, { volume: (part.volume ?? 1) * (volumes[part.id] ?? 1), instrument, kit: part.kit });
    const events = loopEvents(song, part);
    for (let offset = 0; offset < beats; offset += song.loop) {
      for (const event of events) if (offset + event.beat < beats) play(part, event, offset + event.beat, output, instrument);
    }
  }
  if (take) {
    const part = song.parts.find(p => p.id === take.part);
    const output = engine.channel('take', { volume: 1, instrument: take.instrument, kit: part?.kit });
    for (const event of take.events) play(part || {}, event, event.beat, output, take.instrument);
  }
  return encodeWav(await context.startRendering());
}

export function encodeWav(buffer) {
  const channels = [buffer.getChannelData(0), buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0)];
  let peak = 0;
  for (const data of channels) for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const scale = peak > 0.98 ? 0.98 / peak : 1;
  const frames = buffer.length;
  const view = new DataView(new ArrayBuffer(44 + frames * 4));
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + frames * 4, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, frames * 4, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (const data of channels) {
      const sample = Math.max(-1, Math.min(1, data[i] * scale));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return { blob: new Blob([view], { type: 'audio/wav' }), peak, seconds: frames / buffer.sampleRate };
}
