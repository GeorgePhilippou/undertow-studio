// Transport, practice and recording.
//
// Beats are counted from the start of the playing range (the whole loop, or a
// section of bars) and keep increasing while it repeats ("absolute" beats).
// Audio is scheduled a little ahead against the audio clock, so the timing
// never depends on the screen.

import { loopEvents, barLines } from './songs.js';

const LOOKAHEAD = 0.14;
const PRACTICE_WINDOW = 0.4; // beats either side of a note that still count as in time

export class Player {
  constructor(engine) {
    this.engine = engine;
    this.context = engine.context;
    this.song = null;
    this.timeline = new Map();
    this.state = 'stopped'; // stopped | playing | recording | take
    this.mode = 'listen'; // listen | along | wait
    this.speed = 1;
    this.metronome = false;
    this.countIn = true;
    this.myPart = null;
    this.myInstrument = null;
    this.muted = new Set();
    this.listeners = {};
    this.held = new Map();
    this.timer = null;
    this.section = null; // { start, end } in song beats, or null for the whole loop
    this.marks = new Map(); // target beat -> 'hit' | 'part' | 'miss'
    this.marksVersion = 0;
  }

  on(name, callback) {
    (this.listeners[name] ||= []).push(callback);
  }

  emit(name, detail) {
    for (const callback of this.listeners[name] || []) callback(detail);
  }

  setSong(song) {
    this.stop();
    this.song = song;
    this.section = null;
    this.rebuild();
    const learnable = song.parts.find(p => p.learn) || song.parts[0];
    if (!song.parts.some(p => p.id === this.myPart)) this.myPart = learnable?.id;
    this.muted = new Set([...this.muted].filter(id => song.parts.some(p => p.id === id)));
    this.buildTargets();
  }

  // Swaps in an edited song without interrupting playback.
  updateSong(song) {
    this.song = song;
    this.rebuild();
  }

  // Events for the playing range, measured from its start.
  rebuild() {
    const song = this.song;
    if (this.section && (this.section.end > song.loop + 1e-6 || this.section.start >= this.section.end)) this.section = null;
    this.songTimeline = new Map(song.parts.map(part => [part.id, loopEvents(song, part)]));
    const { offset, span } = this;
    this.timeline = new Map([...this.songTimeline].map(([id, events]) => [id, events
      .filter(e => e.beat >= offset - 1e-6 && e.beat < offset + span - 1e-6)
      .map(e => ({ ...e, beat: round(e.beat - offset) }))]));
    this.bars = barLines(song).filter(b => b >= offset && b < offset + span).map(b => b - offset);
    this.buildTargets();
  }

  get offset() {
    return this.section ? this.section.start : 0;
  }

  get span() {
    return this.section ? this.section.end - this.section.start : this.song.loop;
  }

  // Loops part of the song (null for all of it), restarting if it was playing.
  setSection(section) {
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) this.stop(false);
    this.section = section;
    this.rebuild();
    this.resetPractice();
    this.emit('section', this.section);
    if (wasPlaying) this.play();
    else this.emit('state', this.state);
  }

  setSpeed(speed) {
    if (this.state !== 'stopped' && !this.holding) {
      const now = this.context.currentTime;
      this.anchorBeat = this.beatAt(now);
      this.anchorTime = now;
    }
    this.speed = speed;
  }

  part(id = this.myPart) {
    return this.song?.parts.find(p => p.id === id);
  }

  instrumentFor(part) {
    if (part?.id === this.myPart && this.myInstrument) return this.myInstrument;
    return part?.instrument || 'piano';
  }

  setMyPart(id) {
    this.myPart = id;
    this.buildTargets();
    this.resetPractice();
  }

  setMode(mode) {
    this.mode = mode;
    this.resetPractice();
  }

  get beatsPerSecond() {
    return (this.song.bpm * this.speed) / 60;
  }

  // ---------------------------------------------------------------- transport

  beatAt(time) {
    if (this.state === 'stopped') return this.position || 0;
    if (this.holding) return this.anchorBeat;
    return this.anchorBeat + (time - this.anchorTime) * this.beatsPerSecond;
  }

  // Beat the listener is hearing now, allowing for output latency.
  get beat() {
    const latency = this.context.outputLatency || this.context.baseLatency || 0;
    return this.beatAt(this.context.currentTime - latency);
  }

  get loopBeat() {
    const beat = this.beat;
    return beat < 0 ? beat : beat % this.span;
  }

  play({ record = false, take = null } = {}) {
    if (!this.song) return;
    this.stop(false);
    if (record && this.section) {
      // Takes always start at the top of the song so they can become its part.
      this.section = null;
      this.rebuild();
      this.emit('section', null);
    }
    const startBeat = take ? 0 : Math.floor(this.position || 0);
    const countBeats = this.countIn && (record || this.mode !== 'listen') && !take ? this.song.barLengths[0] : 0;
    const now = this.context.currentTime + 0.06;
    this.anchorTime = now + countBeats / this.beatsPerSecond;
    this.anchorBeat = startBeat;
    this.scheduledUntil = startBeat;
    this.holding = false;
    this.take = take;
    this.state = take ? 'take' : record ? 'recording' : 'playing';
    for (let i = 0; i < countBeats; i++) this.engine.click(now + i / this.beatsPerSecond, i === 0);
    if (record) {
      this.recording = { start: startBeat, events: [], open: new Map() };
    }
    this.resetPractice(startBeat);
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
    this.emit('state', this.state);
  }

  stop(emit = true) {
    clearInterval(this.timer);
    this.timer = null;
    let take = null;
    if (this.state !== 'stopped') {
      this.position = 0;
      if (this.state === 'recording') take = this.finishRecording();
    }
    this.state = 'stopped';
    this.holding = false;
    this.take = null;
    this.waitTarget = null;
    if (emit) this.emit('state', 'stopped');
    if (take) this.emit('take', take);
    return take;
  }

  tick() {
    const now = this.context.currentTime;
    let horizon = this.beatAt(now + LOOKAHEAD);
    if (this.mode === 'wait' && this.state === 'playing' && this.waitTarget) {
      if (!this.holding && this.beatAt(now) >= this.waitTarget.absolute) {
        this.holding = true;
        this.anchorBeat = this.waitTarget.absolute;
        this.emit('wait', this.waitTarget);
      }
      horizon = Math.min(horizon, this.waitTarget.absolute - 1e-6);
    }
    if (this.take && this.beatAt(now) >= this.take.length + 0.5) {
      this.stop();
      return;
    }
    if (horizon > this.scheduledUntil) {
      this.schedule(this.scheduledUntil, horizon);
      this.scheduledUntil = horizon;
    }
    if (this.mode === 'along' && this.state === 'playing') this.checkPass();
  }

  timeOf(beat) {
    return this.anchorTime + (beat - this.anchorBeat) / this.beatsPerSecond;
  }

  schedule(from, to) {
    const loop = this.span;
    for (const part of this.song.parts) {
      if (this.muted.has(part.id)) continue;
      const silent = this.take ? part.id === this.take.part : part.id === this.myPart && (this.mode !== 'listen' || this.state === 'recording');
      if (silent) continue;
      const events = this.timeline.get(part.id);
      const output = this.engine.channel(part.id, { volume: part.volume, instrument: this.instrumentFor(part), kit: part.kit });
      for (let cycle = Math.floor(from / loop); cycle * loop < to; cycle++) {
        for (const event of events) {
          const beat = cycle * loop + event.beat;
          if (beat < from || beat >= to) continue;
          this.playEvent(part, event, this.timeOf(beat), output, this.instrumentFor(part));
        }
      }
    }
    if (this.take) {
      const part = this.part(this.take.part);
      const output = this.engine.channel('take', { volume: 1, instrument: this.take.instrument, kit: part?.kit });
      for (const event of this.take.events) {
        if (event.beat >= from && event.beat < to) {
          this.playEvent(part, event, this.timeOf(event.beat), output, this.take.instrument);
        }
      }
    }
    if (this.metronome) {
      for (let beat = Math.ceil(from); beat < to; beat++) {
        const inLoop = ((beat % loop) + loop) % loop;
        this.engine.click(this.timeOf(beat), this.bars.includes(inLoop));
      }
    }
  }

  playEvent(part, event, time, output, instrument) {
    if (event.drum) {
      this.engine.drum(part.kit, event.drum, event.velocity, time, output);
      return;
    }
    const duration = Math.max(0.05, event.length / this.beatsPerSecond);
    for (const midi of event.notes) this.engine.note(instrument, midi, event.velocity, time, duration, output);
  }

  // Notes of a part sounding at a loop position (for the on-screen keyboard).
  soundingNotes(partId, loopBeat) {
    const events = this.timeline.get(partId) || [];
    const notes = new Set();
    for (const event of events) {
      if (event.beat <= loopBeat && loopBeat < event.beat + Math.max(event.length, 0.2)) {
        for (const midi of event.notes) notes.add(midi);
        if (event.drum) notes.add(event.drum);
      }
    }
    return notes;
  }

  // ---------------------------------------------------------------- practice

  // Notes that start together are one target: a chord to play at once.
  buildTargets() {
    const part = this.part();
    const groups = new Map();
    for (const event of this.timeline.get(part?.id) || []) {
      const key = Math.round(event.beat * 1000) / 1000;
      const group = groups.get(key) || { beat: key, notes: new Set(), drums: new Set(), chord: null };
      event.notes.forEach(n => group.notes.add(n));
      if (event.drum) group.drums.add(event.drum);
      if (event.chord) group.chord = event.chord;
      groups.set(key, group);
    }
    this.targets = [...groups.values()].sort((a, b) => a.beat - b.beat);
  }

  // The next few targets after a loop position, for highlighting.
  upcoming(loopBeat, count = 1) {
    if (!this.targets?.length) return [];
    if (this.mode === 'wait' && this.waitTarget) return [this.waitTarget];
    const result = [];
    for (let i = 0; i < this.targets.length * 2 && result.length < count; i++) {
      const target = this.targets[i % this.targets.length];
      const beat = target.beat + (i >= this.targets.length ? this.span : 0);
      if (beat >= loopBeat - 0.05) result.push({ ...target, absolute: beat });
    }
    return result;
  }

  resetPractice(startBeat = 0) {
    const span = this.song ? this.span : 1;
    this.pass = { start: Math.floor(startBeat / span) * span, hits: new Map() };
    this.waitIndex = 0;
    this.waitTarget = null;
    this.marks.clear();
    this.marksVersion++;
    if (this.mode === 'wait' && this.targets?.length) {
      const loop = this.span;
      const cycle = Math.floor(startBeat / loop);
      const offset = startBeat - cycle * loop;
      let index = this.targets.findIndex(t => t.beat >= offset - 1e-6);
      if (index < 0) index = this.targets.length;
      this.waitIndex = cycle * this.targets.length + index;
      this.setWaitTarget();
    }
  }

  setWaitTarget() {
    const count = this.targets.length;
    const target = this.targets[this.waitIndex % count];
    const absolute = Math.floor(this.waitIndex / count) * this.span + target.beat;
    this.waitTarget = { ...target, absolute, remaining: new Set(target.drums.size ? target.drums : [...target.notes].map(n => n % 12)) };
  }

  checkPass() {
    const loop = this.span;
    if (this.beatAt(this.context.currentTime) < this.pass.start + loop + PRACTICE_WINDOW) return;
    let total = 0;
    let hit = 0;
    for (const target of this.targets) {
      const size = this.wanted(target).size;
      const got = Math.min(size, this.pass.hits.get(round(this.pass.start + target.beat))?.size || 0);
      total += size;
      hit += got;
      this.marks.set(target.beat, got === size ? 'hit' : got ? 'part' : 'miss');
    }
    this.marksVersion++;
    this.emit('pass', { hit, total, section: this.section });
    this.pass.start += loop;
    for (const key of this.pass.hits.keys()) if (key < this.pass.start - 1) this.pass.hits.delete(key);
  }

  wanted(target) {
    return target.drums.size ? target.drums : new Set([...target.notes].map(n => n % 12));
  }

  // Called for every note, drum or chord pad the player plays. A chord pad
  // counts only for its own chord; single notes count by name in any octave.
  registerInput(keys, chord = null) {
    if (this.state === 'stopped' || !this.targets?.length) return;
    const accept = target => {
      const wanted = this.wanted(target);
      if (chord && target.chord) return chord === target.chord ? [...wanted] : [];
      return keys.map(k => (typeof k === 'number' ? k % 12 : k)).filter(k => wanted.has(k));
    };
    if (this.mode === 'wait' && this.waitTarget) {
      for (const key of accept(this.waitTarget)) this.waitTarget.remaining.delete(key);
      if (this.waitTarget.remaining.size === 0) {
        this.marks.set(this.waitTarget.beat, 'hit');
        this.marksVersion++;
        const wasHolding = this.holding;
        const resumeAt = this.waitTarget.absolute;
        this.waitIndex++;
        this.setWaitTarget();
        if (wasHolding) {
          this.holding = false;
          this.anchorTime = this.context.currentTime;
          this.anchorBeat = resumeAt;
        }
        this.emit('advance', this.waitTarget);
      }
      return;
    }
    if (this.mode !== 'along') return;
    const now = this.beatAt(this.context.currentTime - (this.context.baseLatency || 0));
    const loop = this.span;
    for (const target of this.targets) {
      for (const cycle of [Math.floor(now / loop) - 1, Math.floor(now / loop), Math.floor(now / loop) + 1]) {
        const beat = cycle * loop + target.beat;
        if (Math.abs(beat - now) > PRACTICE_WINDOW) continue;
        if (beat < this.pass.start - 1e-6) continue;
        const got = accept(target);
        if (!got.length) continue;
        const key = round(beat);
        const hits = this.pass.hits.get(key) || new Set();
        got.forEach(k => hits.add(k));
        this.pass.hits.set(key, hits);
        if (hits.size >= this.wanted(target).size) {
          this.marks.set(target.beat, 'hit');
          this.marksVersion++;
        }
        return;
      }
    }
  }

  // ---------------------------------------------------------------- live input

  chordOn(pad, velocity) {
    for (const midi of pad.notes) this.noteOn(midi, velocity, false);
    this.registerInput(pad.notes, pad.name);
  }

  noteOn(midi, velocity = 0.75, register = true) {
    const part = this.part();
    const output = this.engine.channel('you', { volume: 1, instrument: this.instrumentFor(part) });
    this.noteOff(midi);
    const voice = this.engine.noteOn(this.instrumentFor(part), midi, velocity, this.context.currentTime, output);
    this.held.set(midi, voice);
    if (register) this.registerInput([midi]);
    if (this.state === 'recording') {
      const event = { beat: this.recordBeat(), notes: [midi], length: 0.25, velocity };
      this.recording.events.push(event);
      this.recording.open.set(midi, event);
    }
  }

  noteOff(midi) {
    this.held.get(midi)?.release(this.context.currentTime);
    this.held.delete(midi);
    const event = this.recording?.open.get(midi);
    if (event && this.state === 'recording') {
      event.length = Math.max(0.1, this.recordBeat() - event.beat);
      this.recording.open.delete(midi);
    }
  }

  drumHit(voice, velocity = 0.85) {
    const part = this.part();
    const output = this.engine.channel('you-drums', { volume: 1, kit: part?.kit || 'electro' });
    this.engine.drum(part?.kit || 'electro', voice, velocity, this.context.currentTime, output);
    this.registerInput([voice]);
    if (this.state === 'recording') {
      this.recording.events.push({ beat: this.recordBeat(), drum: voice, notes: [], length: 0.25, velocity });
    }
  }

  recordBeat() {
    return Math.max(0, this.beatAt(this.context.currentTime - (this.context.baseLatency || 0)) - this.recording.start);
  }

  finishRecording() {
    const { events, open } = this.recording;
    const end = this.recordBeat();
    for (const event of open.values()) event.length = Math.max(0.1, end - event.beat);
    this.recording = null;
    if (!events.length) return null;
    const part = this.part();
    const lastNote = Math.max(...events.map(e => e.beat + e.length));
    return {
      id: `take-${Date.now().toString(36)}`,
      song: this.song.id,
      part: part.id,
      kind: part.kind,
      instrument: this.instrumentFor(part),
      created: new Date().toISOString(),
      length: Math.max(1, Math.ceil(Math.min(end, lastNote + 1))),
      events: events.map(e => ({ ...e, beat: round(e.beat), length: round(e.length) })),
    };
  }
}

const round = value => Math.round(value * 1000) / 1000;

// Snap a take to a grid and fit it to whole bars so it can replace a part.
export function takeToPart(take, song, grid = 0.25) {
  const snap = value => Math.round(value / grid) * grid;
  const length = Math.max(1, Math.ceil(take.length / song.cycle)) * song.cycle;
  const events = take.events
    .map(e => ({ ...e, beat: snap(e.beat), length: Math.max(grid, snap(e.length)) }))
    .filter(e => e.beat < length);
  return { events, length };
}
