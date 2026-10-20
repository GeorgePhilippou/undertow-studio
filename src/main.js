// Undertow - play, practise and record Radiohead songs on a classic Mac desk.

import { SONGS, prepareSong, padsFor, noteName, barBeat, barLines, blankSong } from './songs.js';
import { Engine, INSTRUMENTS, loadPiano } from './audio/engine.js';
import { KITS, DRUM_VOICES, DRUM_LABELS } from './audio/drums.js';
import { Player, takeToPart } from './player.js';
import { renderWav } from './render.js';
import { BEATS, beatEvents } from './beats.js';
import * as storage from './storage.js';
import { Keyboard } from './ui/keyboard.js';
import { drawRoll } from './ui/roll.js';
import { MenuBar, setupWindows, openFloating, showDialog, alertBox, confirmBox, toast, escape } from './ui/mac.js';
import { ICONS, renderIcons } from './ui/icons.js';
import { BalloonHelp, runTour, hideBalloon } from './ui/balloons.js';
import { pianoReady } from './audio/piano.js';
import { showPieces, showPiece } from './records/pieces.js';
import { Desktop, keepData } from './records/desktop.js';
import { RecordScreen } from './records/record.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const SPEEDS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.25];
const PIANO_KEYS = 'awsedftgyhujkolp;';

let data = storage.load();
data.settings = { parts: {}, instruments: {}, kits: {}, muted: {}, octave: {}, volumes: {}, ...data.settings };
data.scores ||= {};
data.progress ||= {};
const settings = () => data.settings;
const undoStack = [];
let song = null;
let selectedTake = null;
let drumPage = 0;

// ---------------------------------------------------------------- audio

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const context = new AudioContextClass({ latencyHint: 'interactive' });
try {
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
} catch {
  // Older Safari: the ring/silent switch may mute Web Audio.
}
const engine = new Engine(context);
const player = new Player(engine);
setStatus('Loading piano…');
loadPiano(context).then(count => setStatus(count ? '' : 'Piano samples unavailable'));

// ---------------------------------------------------------------- songs

const allSongs = () => [...SONGS, ...data.songs];
const rawSong = id => allSongs().find(s => s.id === id) || SONGS[0];

function buildSong(raw) {
  const edits = data.edits[raw.id]?.parts || {};
  const kit = settings().kits[raw.id];
  const parts = raw.parts.map(part => {
    const kind = part.drums ? 'drums' : 'notes';
    const edited = edits[part.id] ? { ...part, kind, events: structuredClone(edits[part.id].events), length: edits[part.id].length } : part;
    return kind === 'drums' && kit ? { ...edited, kit } : edited;
  });
  // A drum part added in the Drum Machine to a song that had none.
  for (const [id, edit] of Object.entries(edits)) {
    if (edit.added && !parts.some(p => p.id === id)) {
      parts.push({ ...edit.added, id, kind: 'drums', events: structuredClone(edit.events), length: edit.length, ...(kit ? { kit } : {}) });
    }
  }
  return prepareSong({ ...raw, parts });
}

function selectSong(id) {
  player.stop();
  keyboard.releaseAll();
  const raw = rawSong(id);
  song = buildSong(raw);
  settings().songId = song.id;
  player.myInstrument = settings().instruments[song.id] || null;
  player.myPart = settings().parts[song.id] || null;
  player.muted = new Set(settings().muted[song.id] || []);
  player.volumes = settings().volumes[song.id] || {};
  player.setSong(song);
  player.setMode(currentStep().mode);
  selectedTake = null;
  drumPage = 0;
  $('#score').textContent = '';
  renderSong();
  persist();
}

// Rebuilds the song after an edit without stopping playback.
function refreshSong() {
  song = buildSong(rawSong(song.id));
  player.updateSong(song);
  renderTracks();
  renderKeyboard();
  renderDrumMachine();
}

function renderSong() {
  $('#song-title').textContent = song.title;
  $('#song-window-title').textContent = song.title;
  document.title = `${song.title} - OK Computer`;
  const meter = song.barLengths.length > 1 ? `${song.barLengths.join(' + ')} beats` : `${song.barLengths[0]} beats to a bar`;
  $('#song-meta').textContent = [song.custom ? 'My song' : `${song.album}, ${song.year}`, song.key, `${song.bpm} BPM`, meter].filter(Boolean).join(', ');
  $('#song-about').textContent = song.about;
  renderSongList();
  renderParts();
  renderTracks();
  renderKeyboard();
  renderSpeed();
  renderSteps();
  renderTakes();
  renderDrumMachine();
}

function renderSongList() {
  const item = s => `
    <li><button data-song="${s.id}" aria-current="${s.id === song.id}">
      ${s.custom ? ICONS.mine : ICONS.song}<span>${escape(s.title)}</span>
      <span class="meta">${escape(s.custom ? `${s.bpm} BPM` : `${s.album}, ${s.year}`)}${progressLabel(s.id)}${scoreLabel(s.id)}</span>
    </button></li>`;
  const mine = data.songs;
  $('#song-list').innerHTML = SONGS.map(item).join('') +
    (mine.length ? `<li class="heading small">My Songs</li>${mine.map(item).join('')}` : '');
}

function scoreLabel(id) {
  const best = data.scores[id];
  if (!best) return '';
  return `<br><span class="best">${best.percent === 100 ? '\u2605 ' : ''}Best ${best.percent}%${best.speed < 1 ? ` at ${Math.round(best.speed * 100)}% speed` : ''}</span>`;
}

function renderParts() {
  $('#my-part').innerHTML = song.parts.map(p => `<option value="${p.id}" ${p.id === player.myPart ? 'selected' : ''}>${escape(p.name)}</option>`).join('');
}

function renderTracks() {
  const hasDrums = song.parts.some(p => p.kind === 'drums');
  $('#tracks').innerHTML = `<span class="label">Hear:</span>` + song.parts.map(p => `
    <label class="check"><input type="checkbox" data-part="${p.id}" ${player.muted.has(p.id) ? '' : 'checked'}> ${escape(p.name)}${p.id === player.myPart ? ' (you)' : ''}</label>`).join('') +
    `<span class="spacer" style="flex:1"></span><button id="open-mixer" class="btn" data-help="Set how loud each part is.">Mixer...</button><button id="open-drums" class="btn" data-help="${hasDrums ? 'Edit the drum beat on a grid, or start from a ready-made beat.' : 'This song has no drums yet. Open the Drum Machine to add a beat of your own.'}">${hasDrums ? 'Drum Machine...' : 'Add Drums...'}</button>`;
}

function myPart() {
  return player.part();
}

// ---------------------------------------------------------------- keyboard window

const balloons = new BalloonHelp();
const keyboard = new Keyboard({ piano: $('#piano'), pads: $('#pads'), drumPads: $('#drum-pads') }, {
  noteOn: (midi, velocity) => player.noteOn(midi, velocity),
  noteOff: midi => player.noteOff(midi),
  padOn: (pad, velocity) => player.chordOn(pad, velocity * 0.85),
  padOff: pad => pad.notes.forEach(midi => player.noteOff(midi)),
  drum: (voice, velocity) => player.drumHit(voice, velocity),
});

function renderKeyboard() {
  const part = myPart();
  const drums = part?.kind === 'drums';
  const pads = padsFor(song, part);
  const tabs = { keys: !drums, chords: !drums && pads.length > 0, drums };
  let tab = settings().tab;
  if (!tabs[tab]) tab = drums ? 'drums' : 'keys';
  $$('#keys-tabs button').forEach(button => {
    button.hidden = !tabs[button.dataset.tab];
    button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
  });
  $('#keys-tabs').hidden = Object.values(tabs).filter(Boolean).length < 2;
  keyboard.setPads(pads);
  keyboard.setDrums(drums ? [...new Set([...DRUM_VOICES.filter(v => part.events.some(e => e.drum === v)), ...DRUM_VOICES])] : DRUM_VOICES);
  keyboard.show(tab);
  $('#keys-title').textContent = drums ? 'Drum Pads' : tab === 'chords' ? 'Chord Pads' : 'Keyboard';
  $('#octave-tools').hidden = tab !== 'keys';
  if (tab === 'keys') {
    const saved = settings().octave[`${song.id}:${part.id}`];
    const pitches = part.events.flatMap(e => e.notes);
    const { low } = saved ? keyboard.layout(saved)
      : pitches.length ? keyboard.fit(Math.min(...pitches), Math.max(...pitches)) : keyboard.layout(48);
    $('#octave').textContent = noteName(low);
  }
  $('#instrument').innerHTML = drums
    ? Object.entries(KITS).map(([id, kit]) => `<option value="${id}" ${id === part.kit ? 'selected' : ''}>${kit.name}</option>`).join('')
    : Object.entries(INSTRUMENTS).map(([id, name]) => `<option value="${id}" ${id === player.instrumentFor(part) ? 'selected' : ''}>${name}</option>`).join('');
  lastHighlight = '';
}

function setTab(tab) {
  settings().tab = tab;
  persist();
  renderKeyboard();
}

function shiftOctave(direction) {
  const part = myPart();
  if (!part || part.kind === 'drums') return;
  const low = Math.max(24, Math.min(84, keyboard.low + direction * 12));
  settings().octave[`${song.id}:${part.id}`] = low;
  persist();
  keyboard.releaseAll();
  renderKeyboard();
}

function setInstrument(value) {
  const part = myPart();
  if (part.kind === 'drums') {
    settings().kits[song.id] = value;
    persist();
    refreshSong();
  } else {
    settings().instruments[song.id] = value === part.instrument ? undefined : value;
    player.myInstrument = settings().instruments[song.id] || null;
    persist();
    renderKeyboard();
  }
  toast(`Sound: ${part.kind === 'drums' ? KITS[value].name : INSTRUMENTS[value]}`);
}

function useOriginalSound() {
  delete settings().instruments[song.id];
  delete settings().kits[song.id];
  player.myInstrument = null;
  persist();
  refreshSong();
}

// ---------------------------------------------------------------- transport

// ---------------------------------------------------------------- lesson steps

const STEPS = [
  { label: 'Listen', mode: 'listen', hint: 'Press Play and listen all the way round. Watch the keys light up.' },
  { label: 'Learn', mode: 'wait', hint: 'Press Play. The song waits at each chord until you play it. Any octave counts; the Chords tab gives one pad per chord.' },
  { label: 'Slow', mode: 'along', speed: 0.75, hint: 'Press Play and keep up at 75% speed. Score 80% to tick this off.' },
  { label: 'Full Speed', mode: 'along', speed: 1, hint: 'Now at full speed. Score 80% to tick this off.' },
  { label: 'Record', mode: 'listen', hint: 'Press Record and play your part over the band. Every take is kept.' },
];

function currentStepNumber() {
  return (settings().steps ||= {})[song?.id] || 1;
}

function currentStep() {
  return STEPS[currentStepNumber() - 1];
}

// The step's instructions, worded for drums when the part is a drum part.
function stepHint() {
  const drums = myPart()?.kind === 'drums';
  if (drums && currentStepNumber() === 2) return 'Press Play. The song waits at each beat until you tap those drums on the pads.';
  if (drums && currentStepNumber() === 1) return 'Press Play and listen all the way round. Watch the pads light up.';
  return currentStep().hint;
}

function setStep(number) {
  const step = STEPS[number - 1];
  const running = player.state === 'playing';
  player.stop();
  (settings().steps ||= {})[song.id] = number;
  player.setMode(step.mode);
  if (step.speed) {
    settings().speed = step.speed;
    renderSpeed();
  }
  $('#score').textContent = '';
  persist();
  renderSteps();
  if (running && number !== 5) play();
}

function renderSteps() {
  const done = data.progress[song.id] || [];
  const current = currentStepNumber();
  const next = [1, 2, 3, 4, 5].find(n => !done[n]);
  $$('#steps [data-step]').forEach(button => {
    const n = Number(button.dataset.step);
    button.setAttribute('aria-pressed', String(n === current));
    button.classList.toggle('done', Boolean(done[n]));
    button.classList.toggle('next', n === next && n !== current);
  });
  $('#record').classList.toggle('next', current === 5 && !done[5]);
}

function completeStep(number) {
  const done = (data.progress[song.id] ||= []);
  if (done[number]) return;
  done[number] = true;
  persist();
  renderSteps();
  renderSongList();
  const next = [1, 2, 3, 4, 5].find(n => !done[n]);
  toast(next ? `Step ${number} done. Next: ${next} ${STEPS[next - 1].label}.` : `All five steps done for ${song.title}. Well played!`);
}

function progressLabel(id) {
  const done = data.progress[id] || [];
  if (!done.some(Boolean)) return '';
  return `<span class="progress" aria-label="${done.filter(Boolean).length} of 5 steps done">${[1, 2, 3, 4, 5].map(n => `<i class="${done[n] ? 'on' : ''}"></i>`).join('')}</span>`;
}

function togglePlay() {
  if (player.state === 'playing' || player.state === 'take') player.stop();
  else play();
}

async function play(options = {}) {
  await context.resume();
  player.play(options);
}

function toggleRecord() {
  if (player.state === 'recording') player.stop();
  else play({ record: true });
}

function renderTransport(state) {
  $('#play').setAttribute('aria-pressed', String(state === 'playing' || state === 'take'));
  $('#record').setAttribute('aria-pressed', String(state === 'recording'));
  $('#take-play').textContent = state === 'take' ? 'Stop' : 'Play';
  $('#drum-play').setAttribute('aria-pressed', String(state === 'playing'));
  $('#drum-play span:last-child').textContent = state === 'playing' ? 'Stop' : 'Play';
  if (state === 'stopped') keyboard.highlight({});
}

function renderSpeed() {
  const speed = settings().speed || 1;
  player.setSpeed(speed);
  $('#tempo').textContent = speed === 1 ? `${song.bpm} BPM` : `${Math.round(speed * 100)}% (${Math.round(song.bpm * speed)})`;
  $('#slower').disabled = speed <= SPEEDS[0];
  $('#faster').disabled = speed >= SPEEDS.at(-1);
}

function changeSpeed(direction) {
  const speed = settings().speed || 1;
  const index = SPEEDS.indexOf(speed);
  settings().speed = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (index < 0 ? 6 : index) + direction))];
  persist();
  renderSpeed();
}

player.on('state', renderTransport);
player.on('state', state => keepAwake(state !== 'stopped'));
player.on('wrong', ({ keys, chord }) => keyboard.flashWrong(keys, chord));

// Keep the iPad screen on while the music plays.
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

player.on('pass', ({ hit, total, section }) => {
  if (!total) return;
  const percent = Math.round((hit / total) * 100);
  if (percent >= 80 && !section) {
    completeStep(3);
    if ((settings().speed || 1) >= 1) completeStep(4);
  }
  $('#score').textContent = hit === total ? `Perfect - all ${total} notes in time` : `Last time round: ${hit} of ${total} notes (${percent}%)`;
  if (!section) {
    const best = data.scores[song.id];
    const speed = settings().speed || 1;
    if (!best || percent > best.percent || (percent === best.percent && speed > best.speed)) {
      data.scores[song.id] = { percent, speed, when: new Date().toISOString() };
      persist();
      renderSongList();
      if (best && percent > best.percent) toast(`New best for ${song.title}: ${percent}%`);
    }
  }
  if (hit === total && settings().trainer && (settings().speed || 1) < 1) {
    changeSpeed(1);
    toast(`Perfect! Speeding up to ${Math.round(settings().speed * 100)}%.`);
  }
});

player.on('section', section => {
  $('#loop-all').hidden = !section;
});

player.on('take', take => {
  (data.takes[take.song] ||= []).push(take);
  persist();
  selectedTake = take.id;
  renderTakes();
  openFloating($('#takes-window'), $('#keys-window'));
  toast('Take recorded. Play it back, save it, or use it as the part.');
  completeStep(5);
});

player.on('advance', () => {
  if (player.waitIndex >= player.targets.length && !player.section) completeStep(2);
});

// ---------------------------------------------------------------- live display

let lastHighlight = '';
let lastRoll = '';
let rollLayout = null;
let selecting = null;
let tool = 'arrow';
let editVersion = 0;

function describe(target) {
  if (!target) return '';
  if (target.drums?.size) return [...target.drums].map(d => DRUM_LABELS[d]).join(' + ');
  return [...target.notes].sort((a, b) => a - b).map(n => noteName(n)).join(' ');
}

function barsLabel(section) {
  const bars = barLines(song);
  const first = bars.findIndex(b => Math.abs(b - section.start) < 1e-6) + 1;
  const last = bars.filter(b => b < section.end - 1e-6).length;
  return first === last ? `bar ${first}` : `bars ${first}-${last}`;
}

function frame() {
  requestAnimationFrame(frame);
  if (!song) return;
  const running = player.state !== 'stopped';
  const beat = running ? player.beat : 0;
  const loopBeat = running ? (beat < 0 ? beat : beat % player.span) : 0;
  const songBeat = player.offset + Math.max(0, loopBeat);
  const mode = player.mode;
  const part = myPart();

  // Counter, flashing on each beat.
  $('#counter').classList.toggle('flash', running && beat >= 0 && beat % 1 < 0.12);
  if (beat < 0) {
    $('#counter').textContent = `Count ${Math.max(1, Math.ceil(-beat))}`;
  } else {
    const position = barBeat(song, songBeat);
    $('#counter').textContent = `${position.bar} : ${position.beat}`;
  }

  // What to play next, and what is sounding.
  const target = player.state === 'take' ? null : player.upcoming(Math.max(0, loopBeat), 1)[0] || null;
  const sounding = running && (mode === 'listen' || player.state === 'take') ? player.soundingNotes(part.id, loopBeat) : new Set();
  const soundingChord = running ? currentChord(part, songBeat) : null;
  const showTarget = player.state !== 'recording' && (mode !== 'listen' || !running);
  const targetSet = showTarget && target ? (target.drums.size ? target.drums : target.notes) : new Set();
  const key = `${[...targetSet].join()}|${[...sounding].join()}|${soundingChord}|${showTarget && target?.chord}`;
  if (key !== lastHighlight) {
    lastHighlight = key;
    keyboard.highlight({ targets: targetSet, sounding, chord: showTarget ? target?.chord : null, soundingChord: mode === 'listen' ? soundingChord : null });
  }

  if (running && mode === 'listen' && player.state === 'playing' && !player.section && beat >= player.span - 0.05) completeStep(1);

  // Message line.
  let label = '';
  let detail = '';
  if (player.state === 'recording') {
    label = beat < 0 ? 'Get ready...' : 'Recording';
    detail = 'Play your part. Press Stop when you\'re done.';
  } else if (player.state === 'take') {
    label = 'Playing take';
  } else if (tool !== 'arrow' && !running) {
    label = tool === 'pencil' ? 'Pencil' : 'Eraser';
    detail = tool === 'pencil'
      ? 'Tap the roll to add a note, drag right to make it longer, tap a note to remove it.'
      : 'Drag across notes to rub them out. Edit > Undo puts them back.';
  } else if (mode === 'listen') {
    label = running ? soundingChord || 'Listening' : 'Listen first';
    detail = running ? (myPart()?.kind === 'drums' ? 'Watch the pads light up with each hit.' : 'Watch the keys light up as each chord plays.') : stepHint();
  } else if (mode === 'along') {
    label = target ? `Next: ${target.chord || describe(target)}` : 'Play Along';
    detail = target?.chord ? describe(target) : running ? '' : stepHint();
  } else {
    label = target ? `${player.holding ? 'Your turn' : 'Next'}: ${target.chord || describe(target)}` : 'Wait for Me';
    detail = target ? `${target.chord ? describe(target) : ''}${player.holding ? ' - the song waits for you' : ''}` : '';
    if (!running) detail = stepHint();
  }
  if (player.section && player.state !== 'recording') detail = `Looping ${barsLabel(player.section)}. ${detail}`;
  if ($('#next-label').textContent !== label) $('#next-label').textContent = label;
  if ($('#next-detail').textContent !== detail) $('#next-detail').textContent = detail;
  $('#trainer-box').hidden = mode !== 'along';
  $('#guide-box').hidden = mode === 'listen';

  // Roll.
  const countIn = running && beat < 0 ? Math.max(1, Math.ceil(-beat)) : null;
  const rollTarget = showTarget && target ? player.offset + (target.absolute % player.span) : null;
  const rollKey = [songBeat.toFixed(3), countIn, rollTarget, song.id, part.id, $('#roll').clientWidth, $('#roll').clientHeight,
    player.marksVersion, JSON.stringify(player.section), JSON.stringify(selecting), tool, editVersion, running].join('|');
  if (rollKey !== lastRoll) {
    lastRoll = rollKey;
    rollLayout = drawRoll($('#roll'), {
      song, part, events: player.songTimeline.get(part.id) || [],
      position: running ? songBeat : player.offset, target: rollTarget, playing: running && beat >= 0,
      section: player.section, selecting, marks: player.marks, offset: player.offset, countIn, editing: tool !== 'arrow',
    });
  }

  // Drum machine step light.
  if (!$('#drum-window').hidden) lightDrumStep(running && beat >= 0 ? songBeat : -1);
}

function currentChord(part, songBeat) {
  let chord = null;
  for (const event of player.songTimeline.get(part.id) || []) {
    if (event.beat > songBeat) break;
    if (event.chord) chord = event.chord;
  }
  return chord;
}

// ---------------------------------------------------------------- roll: sections and editing

function barRange(fromBeat, toBeat) {
  const bars = barLines(song);
  const low = Math.min(fromBeat, toBeat);
  const high = Math.max(fromBeat, toBeat);
  const start = [...bars].reverse().find(b => b <= low + 1e-6) ?? 0;
  const after = bars.find(b => b > high + 1e-6);
  return { start, end: after ?? song.loop };
}

function setTool(name) {
  tool = name;
  $$('#tools [data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === name)));
  $('#roll').dataset.tool = name;
}

// Edits the part's own events. A part repeats through the loop, so an edit
// to one repeat changes them all.
function editPart(change) {
  const part = myPart();
  const length = part.length || song.loop;
  const events = structuredClone(part.events).map(e => ({ ...e, notes: [...e.notes] }));
  change(events, length);
  (data.edits[song.id] ||= { parts: {} }).parts[part.id] = { events: events.filter(e => e.drum || e.notes.length), length };
  persist();
  refreshSong();
  editVersion++;
}

function eventAt(events, length, beat, row, drums) {
  const local = ((beat % length) + length) % length;
  return events.find(e => (drums ? e.drum === row : e.notes.includes(row)) &&
    local >= e.beat - 1e-6 && local < e.beat + Math.max(e.length, 0.25) - 1e-6);
}

let stroke = null;

$('#roll').addEventListener('pointerdown', event => {
  if (!rollLayout || player.state === 'recording' || player.state === 'take') return;
  const box = event.currentTarget.getBoundingClientRect();
  const px = event.clientX - box.left;
  const py = event.clientY - box.top;
  const beat = Math.max(0, Math.min(song.loop - 1e-3, rollLayout.beatAt(px)));
  event.currentTarget.setPointerCapture(event.pointerId);
  if (tool === 'arrow' || py < rollLayout.header) {
    selecting = barRange(beat, beat);
    stroke = { kind: 'select', anchor: beat, moved: false };
    return;
  }
  const row = rollLayout.rowAt(py);
  if (row === undefined) return;
  const part = myPart();
  const drums = part.kind === 'drums';
  const grid = 0.25;
  const snapped = Math.floor(beat / grid) * grid;
  pushUndo(tool === 'pencil' ? 'Pencil' : 'Eraser');
  if (tool === 'eraser') {
    stroke = { kind: 'erase' };
    eraseAt(beat, row);
    return;
  }
  editPart((events, length) => {
    const existing = eventAt(events, length, beat, row, drums);
    if (existing) {
      if (drums) events.splice(events.indexOf(existing), 1);
      else existing.notes = existing.notes.filter(n => n !== row);
      stroke = { kind: 'removed' };
      return;
    }
    const local = ((snapped % length) + length) % length;
    const added = drums
      ? { beat: local, drum: row, notes: [], length: 0.25, velocity: 0.8 }
      : { beat: local, notes: [row], length: 1, velocity: 0.75, chord: null };
    events.push(added);
    stroke = { kind: 'draw', start: snapped, local, row, drums };
  });
  if (drums) player.drumHit(row, 0.8);
  else if (stroke.kind === 'draw') engine.note(player.instrumentFor(part), row, 0.75, context.currentTime, 0.4, engine.channel('you', { instrument: player.instrumentFor(part) }));
});

$('#roll').addEventListener('pointermove', event => {
  if (!stroke || !rollLayout) return;
  const box = event.currentTarget.getBoundingClientRect();
  const px = event.clientX - box.left;
  const py = event.clientY - box.top;
  const beat = Math.max(0, Math.min(song.loop - 1e-3, rollLayout.beatAt(px)));
  if (stroke.kind === 'select') {
    stroke.moved = true;
    selecting = barRange(stroke.anchor, beat);
  } else if (stroke.kind === 'erase') {
    const row = rollLayout.rowAt(py);
    if (row !== undefined) eraseAt(beat, row);
  } else if (stroke.kind === 'draw' && !stroke.drums) {
    const length = Math.max(0.25, Math.ceil((beat - stroke.start) / 0.25) * 0.25);
    const part = myPart();
    const current = part.events.find(e => Math.abs(e.beat - stroke.local) < 1e-6 && e.notes.includes(stroke.row) && !e.chord);
    if (current && Math.abs(current.length - length) > 1e-6) {
      editPart(events => {
        const match = events.find(e => Math.abs(e.beat - stroke.local) < 1e-6 && e.notes.includes(stroke.row) && !e.chord);
        if (match) match.length = length;
      });
    }
  }
});

function eraseAt(beat, row) {
  const part = myPart();
  const drums = part.kind === 'drums';
  if (!eventAt(part.events, part.length || song.loop, beat, row, drums)) return;
  editPart((events, length) => {
    const hit = eventAt(events, length, beat, row, drums);
    if (!hit) return;
    if (drums) events.splice(events.indexOf(hit), 1);
    else hit.notes = hit.notes.filter(n => n !== row);
  });
}

function endStroke() {
  if (stroke?.kind === 'select' && selecting) {
    const whole = selecting.start <= 1e-6 && selecting.end >= song.loop - 1e-6;
    const same = player.section && Math.abs(player.section.start - selecting.start) < 1e-6 && Math.abs(player.section.end - selecting.end) < 1e-6;
    player.setSection(whole || (same && !stroke.moved) ? null : selecting);
  }
  selecting = null;
  stroke = null;
}

$('#roll').addEventListener('pointerup', endStroke);
$('#roll').addEventListener('pointercancel', endStroke);

// ---------------------------------------------------------------- takes

function songTakes() {
  return data.takes[song.id] || [];
}

function renderTakes() {
  const takes = songTakes();
  if (!takes.some(t => t.id === selectedTake)) selectedTake = takes.at(-1)?.id || null;
  $('#take-list').innerHTML = takes.length
    ? takes.map((take, i) => {
      const seconds = Math.round((take.length * 60) / song.bpm);
      const when = new Date(take.created).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const part = song.parts.find(p => p.id === take.part)?.name || take.part;
      return `<button role="option" data-take="${take.id}" aria-selected="${take.id === selectedTake}">
        <span>Take ${i + 1} - ${escape(part)}</span><span>${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</span>
        <span>${escape(when)}, ${escape(INSTRUMENTS[take.instrument] || KITS[take.instrument]?.name || 'Drums')}</span></button>`;
    }).join('')
    : '<div class="empty">No takes yet. Press Record, play your part, then press Stop.</div>';
  for (const id of ['#take-play', '#take-use', '#take-export', '#take-delete']) $(id).disabled = !selectedTake;
}

const currentTake = () => songTakes().find(t => t.id === selectedTake);

async function playTake() {
  if (player.state === 'take') return player.stop();
  const take = currentTake();
  if (take) await play({ take });
}

async function useTake() {
  const take = currentTake();
  if (!take) return;
  const part = song.parts.find(p => p.id === take.part);
  const ok = await confirmBox(`Use this take as the ${part.name} part?`,
    'Your take replaces the written part, snapped to the nearest sixteenth note. Edit ▸ Undo or Revert to Original brings the original back.', 'Use as Part');
  if (!ok) return;
  pushUndo('Use as Part');
  (data.edits[song.id] ||= { parts: {} }).parts[take.part] = takeToPart(take, song);
  persist();
  selectSong(song.id);
  toast(`${part.name} part replaced.`);
}

async function deleteTake() {
  const take = currentTake();
  if (!take || !(await confirmBox('Delete this take?', 'This cannot be undone.', 'Delete'))) return;
  if (player.state === 'take') player.stop();
  data.takes[song.id] = songTakes().filter(t => t.id !== take.id);
  selectedTake = null;
  persist();
  renderTakes();
}

async function exportAudio(take = null) {
  setStatus('Rendering…');
  try {
    const beats = take ? take.length : song.loop * Math.max(1, Math.ceil(16 / song.loop));
    const instruments = player.myInstrument ? { [player.myPart]: player.myInstrument } : {};
    const { blob } = await renderWav(song, { beats, muted: player.muted, take, instruments, volumes: player.volumes });
    download(blob, `${song.title}${take ? ' take' : ''}.wav`);
    setStatus('');
  } catch (error) {
    setStatus('');
    alertBox('The audio could not be saved.', error.message);
  }
}

// On touch devices the share sheet saves to Files, AirDrops or sends the file;
// elsewhere it downloads.
function download(blob, name) {
  if (navigator.canShare && window.matchMedia('(pointer: coarse)').matches) {
    const file = new File([blob], name.replace(/[\\/:*?"<>|]/g, ''), { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: file.name }).catch(error => {
        if (error.name !== 'AbortError') saveFile(blob, name);
      });
      return;
    }
  }
  saveFile(blob, name);
}

function saveFile(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name.replace(/[\\/:*?"<>|]/g, '');
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

// ---------------------------------------------------------------- drum machine

function drumPart() {
  return song.parts.find(p => p.kind === 'drums');
}

function renderDrumMachine() {
  const win = $('#drum-window');
  if (win.hidden) return;
  const part = drumPart();
  const grid = $('#drum-grid');
  $('#beat-preset').innerHTML = '<option value="">Start from a beat...</option>' + BEATS.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  for (const id of ['#beat-preset', '#kit', '#drum-prev', '#drum-next', '#drum-clear']) $(id).disabled = !part;
  if (!part) {
    grid.style.gridTemplateColumns = '1fr';
    grid.innerHTML = `<div class="drum-empty"><p class="small" style="margin:0">${escape(song.title)} has no drum part yet. Add one to make your own beat to play along with.</p><button id="add-drums" class="btn default">Add Drums</button></div>`;
    $('#drum-page').textContent = '';
    return;
  }
  $('#kit').innerHTML = Object.entries(KITS).map(([id, kit]) => `<option value="${id}" ${id === part.kit ? 'selected' : ''}>${kit.name}</option>`).join('');
  const steps = Math.round(part.length * 4);
  const pages = Math.max(1, Math.ceil(steps / 16));
  drumPage = Math.min(drumPage, pages - 1);
  const first = drumPage * 16;
  const count = Math.min(16, steps - first);
  const beats = `${first / 4 + 1}-${(first + count) / 4}`;
  $('#drum-page').textContent = pages > 1 ? `Beats ${beats} of ${part.length}` : `${part.length} beats`;
  $('#drum-prev').disabled = drumPage === 0;
  $('#drum-next').disabled = drumPage >= pages - 1;
  const hits = new Map(part.events.map(e => [`${e.drum}:${Math.round(e.beat * 4)}`, e]));
  grid.style.gridTemplateColumns = `auto repeat(${count}, minmax(26px, 1fr))`;
  let html = '<span></span>';
  for (let i = 0; i < count; i++) html += `<span class="head">${(first + i) % 4 === 0 ? (first + i) / 4 + 1 : ''}</span>`;
  for (const voice of DRUM_VOICES) {
    html += `<span class="lane">${DRUM_LABELS[voice]}</span>`;
    for (let i = 0; i < count; i++) {
      const step = first + i;
      const hit = hits.get(`${voice}:${step}`);
      html += `<button class="cell${step % 4 === 0 ? ' beat' : ''}${hit && hit.velocity < 0.6 ? ' soft' : ''}" data-voice="${voice}" data-step="${step}" aria-pressed="${Boolean(hit)}" aria-label="${DRUM_LABELS[voice]} step ${step + 1}"></button>`;
    }
  }
  grid.innerHTML = html;
}

function addDrums() {
  pushUndo('Add Drums');
  const length = song.loop <= 16 ? song.loop : song.cycle;
  (data.edits[song.id] ||= { parts: {} }).parts.drums = { added: { name: 'Drums', kit: 'electro' }, events: [], length };
  persist();
  refreshSong();
  renderParts();
  toast('Drums added. Tap squares, or start from a ready-made beat.');
}

function applyBeat(id) {
  const beat = BEATS.find(b => b.id === id);
  const part = drumPart();
  if (!beat || !part) return;
  pushUndo('Beat');
  const edit = (data.edits[song.id] ||= { parts: {} }).parts[part.id] || {};
  data.edits[song.id].parts[part.id] = { ...edit, events: beatEvents(beat, part.length), length: part.length };
  persist();
  refreshSong();
  toast(`${beat.name} beat. Tap squares to change it; Edit > Undo goes back.`);
}

function toggleDrum(voice, step) {
  const part = drumPart();
  const events = part.events.filter(e => !(e.drum === voice && Math.round(e.beat * 4) === step));
  const removed = events.length !== part.events.length;
  if (!removed) events.push({ beat: step / 4, drum: voice, velocity: 0.8, length: 0.25, notes: [] });
  pushUndo('Drum Edit');
  const edit = (data.edits[song.id] ||= { parts: {} }).parts[part.id] || {};
  data.edits[song.id].parts[part.id] = { ...edit, events, length: part.length };
  persist();
  refreshSong();
  if (!removed) player.drumHit(voice, 0.8);
}

function clearDrums() {
  const part = drumPart();
  if (!part) return;
  pushUndo('Clear Drums');
  const edit = (data.edits[song.id] ||= { parts: {} }).parts[part.id] || {};
  data.edits[song.id].parts[part.id] = { ...edit, events: [], length: part.length };
  persist();
  refreshSong();
}

let litStep = null;

function lightDrumStep(loopBeat) {
  const part = drumPart();
  if (!part) return;
  const step = loopBeat < 0 ? null : Math.floor((loopBeat % part.length) * 4);
  if (step === litStep) return;
  litStep = step;
  if (step !== null && Math.floor(step / 16) !== drumPage) {
    drumPage = Math.floor(step / 16);
    renderDrumMachine();
  }
  $$('#drum-grid .cell').forEach(cell => cell.classList.toggle('now', Number(cell.dataset.step) === step));
}

// ---------------------------------------------------------------- edits and undo

function pushUndo(label) {
  undoStack.push({ song: song.id, label, edits: structuredClone(data.edits[song.id] || null) });
  if (undoStack.length > 60) undoStack.shift();
}

function undo() {
  const last = undoStack.pop();
  if (!last) return;
  if (last.edits) data.edits[last.song] = last.edits;
  else delete data.edits[last.song];
  persist();
  if (last.song === song.id) refreshSong();
  toast(`Undid ${last.label}.`);
}

async function revertSong() {
  if (!data.edits[song.id]) return;
  if (!(await confirmBox('Revert to the original parts?', 'Parts you replaced with takes and drum edits are undone. Your takes are kept.', 'Revert'))) return;
  pushUndo('Revert');
  delete data.edits[song.id];
  persist();
  selectSong(song.id);
}

// ---------------------------------------------------------------- dialogs

function showInfo() {
  const listen = song.youtube
    ? `https://www.youtube.com/watch?v=${song.youtube}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(`Radiohead ${song.title}`)}`;
  const meter = song.barLengths.length > 1 ? song.barLengths.join(' + ') : song.barLengths[0];
  showDialog(`
    <div class="alert">${ICONS.song}<div>
      <h3>${escape(song.title)}</h3>
      <p>${escape(song.custom ? 'My song' : `Radiohead - ${song.album} (${song.year})`)}<br>
      ${song.key ? `Key: ${escape(song.key)}, ` : ''}${song.bpm} BPM, ${escape(String(meter))} beats a bar</p>
      <p>${escape(song.about)}</p>
      ${song.accuracy ? `<p><b>How close is it?</b> ${escape(song.accuracy)} If something sounds wrong, record the part as you hear it and choose Use as Part.</p>` : ''}
      ${song.sources?.length ? `<p><b>Sources</b><br>${song.sources.map(([name, url]) => `<a href="${escape(url)}" target="_blank" rel="noopener">${escape(name)}</a>`).join('<br>')}</p>` : ''}
      ${song.custom ? '' : `<p>No recordings are included. <a href="${escape(listen)}" target="_blank" rel="noopener">Listen to the record on YouTube</a>.</p>`}
    </div></div>
    <div class="button-row"><button class="btn default" data-value="ok">OK</button></div>`);
}

function showHelp() {
  showDialog(`
    <h3>Records</h3>
    <ul>
      <li><b>Load a Record</b> on the desktop: a Radiohead song you own as an MP3, M4A, AAC or WAV from Files. It stays on this device. (Apple Music downloads are copy-protected and cannot be opened.) Touch a record to open it.</li>
      <li><b>Riffs</b> - the song's famous part. Tap the big pad (or Space) in rhythm and each tap plays the next hit, cut from your own record or played on keys. The keyboard shows the notes, and playing them moves on too. Hear It plays the whole riff.</li>
      <li><b>Pads</b> - the record cut into sixteen pads. Cut Pads recuts them at attacks or into beats and bars; Edit Pad sets a pad's start and end, Once, Hold or Loop, pitch and Reverse. Filter and Echo colour the pads. Keys 1-4, Q-R, A-F and Z-V play them.</li>
      <li><b>Remix</b> - put the pads into a sixteen-step pattern and play it round and round.</li>
      <li><b>Record</b> keeps what you play here in My Pieces as a sound file to save or share. <b>Snap</b> keeps pad edits and cuts on the beat.</li>
      <li><b>Play Along</b> - the chords scroll past in time with the record and light up on the keys. Touch the waveform to jump, drag across it to loop a part, and slow it down without changing the pitch. Set Start lines the chords up; Mark Chords lets you tap them in yourself.</li>
    </ul>
    <h3>Lessons</h3>
    <ul>
      <li><b>Choose a song</b> from the Songs window or the Song menu.</li>
      <li><b>Follow the five steps</b> along the top. Each gets a tick when you've done it, and your progress shows in the Songs list.</li>
      <li><b>1 Listen</b> - press Play. The roll and the keys show your part as it plays.</li>
      <li><b>2 Learn</b> - the song stops at every chord until you play it. Any octave counts.</li>
      <li><b>3 Slow, 4 Full Speed</b> - the song plays without your part. The dotted keys show what comes next; score 80% to tick the step off.</li>
      <li><b>5 Record</b> - press Record, play over the count-in and the backing, then press Stop. Your take appears in the Takes window, where you can play it, save it as a WAV file, or <i>Use as Part</i> to correct a song by ear.</li>
      <li><b>Slower / faster</b> with − and +. <b>Click</b> adds a metronome.</li>
      <li><b>Chords</b> tab turns the keyboard into one pad per chord.</li>
      <li><b>Drum Machine</b> - edit the beat on a grid, start from a ready-made beat, or add drums to a song that has none.</li>
    </ul>
    <h3>Keyboard shortcuts</h3>
    <ul>
      <li>Space: Play / Stop, R: Record, 1–9: chord or drum pads</li>
      <li>A W S E D F T G Y H U J K O L P ; play the piano from the lowest key shown, Z / X change octave</li>
      <li>A USB or Bluetooth MIDI keyboard works in browsers that support Web MIDI.</li>
    </ul>
    <div class="button-row"><button class="btn default" data-value="ok">OK</button></div>`);
}

function showAbout() {
  showDialog(`
    <div class="alert">${ICONS.mac}<div>
      <h3>OK Computer</h3>
      <p>A classic Macintosh music desk for playing along with, practising and sampling Radiohead records you own. Everything you load and make stays in this browser. No recordings or vocals are included; the lessons are played by the instruments in this app.</p>
      <p><b>Credits</b><br>
      Piano: Salamander Grand Piano by Alexander Holm, CC BY 3.0.<br>
      Chicago-style type: ChiKareGo2 by Giles Booth, CC BY.<br>
      Geneva-style type: Geneva 9 by Kelsey Higham, CC BY 3.0.<br>
      Song analyses are credited in each song\'s Get Info window.</p>
      <p>A fan-made app, not connected with Radiohead or their record labels.</p>
      <p>Older projects open in <a href="classic/">Undertow Classic</a>, the earlier version.</p>
    </div></div>
    <div class="button-row"><button class="btn default" data-value="ok">OK</button></div>`);
}

async function newSong() {
  const { value, fields } = await showDialog(`
    <form>
      <h3>New Song</h3>
      <div class="row"><label class="label" for="ns-title">Title</label><input id="ns-title" class="field" name="title" value="Untitled" maxlength="60"></div>
      <div class="row"><label class="label" for="ns-bpm">Tempo</label><input id="ns-bpm" class="field" name="bpm" type="number" min="40" max="220" value="90" style="width:90px"> <span class="small">BPM</span></div>
      <div class="row"><label class="label" for="ns-meter">Beats in a bar</label><select id="ns-meter" class="popup" name="beats">${[3, 4, 5, 6, 7].map(n => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="row"><label class="label" for="ns-bars">Bars to loop</label><select id="ns-bars" class="popup" name="bars">${[1, 2, 4, 8].map(n => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="row"><label class="label" for="ns-sound">Keys sound</label><select id="ns-sound" class="popup" name="sound">${Object.entries(INSTRUMENTS).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select></div>
      <div class="button-row"><button type="button" class="btn" data-value="cancel">Cancel</button><button type="submit" class="btn default">Create</button></div>
    </form>`, { defaultValue: 'create' });
  if (value !== 'create') return;
  const created = blankSong({
    id: `my-${Date.now().toString(36)}`,
    title: fields.title.trim() || 'Untitled',
    bpm: Math.max(40, Math.min(220, Number(fields.bpm) || 90)),
    beatsPerBar: Number(fields.beats),
    barCount: Number(fields.bars),
    instrument: fields.sound,
  });
  data.songs.push(created);
  persist();
  selectSong(created.id);
  toast('New song. Record keys, bass or drums - or open the Drum Machine.');
}

async function deleteSong() {
  if (!song.custom) return;
  if (!(await confirmBox(`Delete “${song.title}”?`, 'Its parts and takes are removed from this browser.', 'Delete'))) return;
  data.songs = data.songs.filter(s => s.id !== song.id);
  delete data.takes[song.id];
  delete data.edits[song.id];
  persist();
  selectSong(SONGS[0].id);
}

function chooseSongDialog() {
  showDialog(`
    <h3>Choose a Song</h3>
    <ul class="song-list" style="border:1px solid #000;max-height:60vh;overflow:auto">
      ${allSongs().map(s => `<li><button data-value="${s.id}" aria-current="${s.id === song.id}">${s.custom ? ICONS.mine : ICONS.song}<span>${escape(s.title)}</span><span class="meta">${escape(s.custom ? 'My song' : s.album)}</span></button></li>`).join('')}
    </ul>
    <div class="button-row"><button class="btn" data-value="new">New Song…</button><button class="btn default" data-value="cancel">Cancel</button></div>`)
    .then(({ value }) => {
      if (value === 'new') newSong();
      else if (value !== 'cancel') selectSong(value);
    });
}

function saveCopy() {
  download(storage.exportFile(data), 'OK Computer lessons.okcomputer-lessons.json');
}

function openCopy() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const imported = storage.importFile(await file.text());
      if (!(await confirmBox('Replace your songs and takes?', 'Everything in this browser is replaced with the contents of the file.', 'Replace'))) return;
      data = { ...imported, settings: { ...data.settings, ...imported.settings } };
      persist();
      selectSong(data.settings.songId || SONGS[0].id);
    } catch (error) {
      alertBox('This file could not be opened.', error.message);
    }
  });
  input.click();
}

// ---------------------------------------------------------------- menus

const menus = new MenuBar($('.menubar'), $('#menus'), name => {
  const part = myPart();
  switch (name) {
    case 'undertow':
      return [
        { label: 'About OK Computer…', action: showAbout },
        '-',
        { label: 'Open Undertow Classic…', action: openClassic },
      ];
    case 'file':
      if (screen() === 'desk' || screen() === 'record') {
        return [
          { label: 'Load a Record...', action: () => $('#record-file').click() },
          { label: 'Save All Records to Files...', disabled: !desktop.records.length, action: () => desktop.saveAll() },
          { label: screen() === 'record' ? 'Save Record to Files...' : 'Save a Record to Files...', disabled: !desktop.records.length, action: () => (screen() === 'record' ? desktop.save(recordScreen.track.id) : desktop.chooseToSave()) },
          { label: 'Remove a Record...', action: () => desktop.remove() },
          '-',
          { label: 'Close Record', disabled: screen() !== 'record', action: () => setScreen('desk') },
          '-',
          { label: 'My Pieces...', action: () => showPieces({ download }) },
          { label: 'Open Undertow Classic...', action: openClassic },
        ];
      }
      return [
        { label: 'New Song…', shortcut: '⌘N', action: newSong },
        '-',
        { label: 'Save a Copy…', shortcut: '⌘S', action: saveCopy },
        { label: 'Open a Copy…', action: openCopy },
        '-',
        { label: 'Save Loop as WAV…', action: () => exportAudio() },
        { label: 'Save Take as WAV…', disabled: !currentTake(), action: () => exportAudio(currentTake()) },
        '-',
        { label: 'Delete This Song…', disabled: !song.custom, action: deleteSong },
        { label: 'Open Undertow Classic…', action: openClassic },
      ];
    case 'edit':
      return [
        { label: undoStack.length ? `Undo ${undoStack.at(-1).label}` : 'Can\'t Undo', shortcut: '⌘Z', disabled: !undoStack.length, action: undo },
        '-',
        { label: 'Revert to Original…', disabled: !data.edits[song.id], action: revertSong },
      ];
    case 'song':
      return [
        ...SONGS.map(s => ({ label: s.title, checked: s.id === song.id, action: () => selectSong(s.id) })),
        ...(data.songs.length ? [{ header: 'My Songs' }, ...data.songs.map(s => ({ label: s.title, checked: s.id === song.id, action: () => selectSong(s.id) }))] : []),
        '-',
        { label: 'Count-in Before Playing', checked: player.countIn, action: toggleCountIn },
        '-',
        { label: 'Get Info', shortcut: '⌘I', action: showInfo },
        { label: 'Listen to the Record', disabled: Boolean(song.custom), action: () => window.open(song.youtube ? `https://www.youtube.com/watch?v=${song.youtube}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(`Radiohead ${song.title}`)}`, '_blank', 'noopener') },
      ];
    case 'sound':
      if (part.kind === 'drums') {
        return [
          { header: 'Drum kit' },
          ...Object.entries(KITS).map(([id, kit]) => ({ label: kit.name, checked: id === part.kit, action: () => setInstrument(id) })),
          '-',
          { label: 'Use Original Sound', action: useOriginalSound },
          { label: 'Mixer...', action: showMixer },
        ];
      }
      return [
        { header: `Sound for ${part.name}` },
        ...Object.entries(INSTRUMENTS).map(([id, label]) => ({ label, checked: id === player.instrumentFor(part), action: () => setInstrument(id) })),
        '-',
        { label: 'Use Original Sound', action: useOriginalSound },
        { label: 'Mixer...', action: showMixer },
        { label: 'Show Note Names on Keys', checked: Boolean(settings().labels), action: toggleLabels },
      ];
    case 'window':
      return [
        { label: 'Songs', action: () => { $('#songs-window').hidden = false; } },
        { label: 'Keyboard', action: () => $('#keys-window').classList.remove('shaded') },
        { label: 'Drum Machine', disabled: !drumPart(), action: openDrumMachine },
        { label: 'Takes', action: openTakes },
      ];
    case 'help':
      return [
        { label: balloons.enabled ? 'Hide Balloons' : 'Show Balloons', action: () => toast(balloons.toggle() ? 'Point at or touch anything to see what it does.' : 'Balloons off.') },
        { label: 'Take the Tour', action: startTour },
        '-',
        { label: 'How to Use OK Computer…', shortcut: '?', action: showHelp },
        { label: 'About OK Computer…', action: showAbout },
      ];
    default:
      return [];
  }
});

async function openClassic() {
  if (await confirmBox('Open Undertow Classic?', 'The earlier version, Undertow, opens with its own saved projects. Your songs and takes here are kept.', 'Open')) {
    location.href = 'classic/';
  }
}

function openDrumMachine() {
  $('#drum-window').hidden = false;
  renderDrumMachine();
  openFloating($('#drum-window'), $('#keys-window'));
}

function openTakes() {
  renderTakes();
  openFloating($('#takes-window'), $('#keys-window'));
}

// ---------------------------------------------------------------- events

setupWindows(win => {
  if (win.id === 'songs-window') win.hidden = true;
  else if (win.classList.contains('floating')) win.hidden = true;
});

$('#song-list').addEventListener('click', event => {
  const button = event.target.closest('[data-song]');
  if (button) selectSong(button.dataset.song);
});
$('#new-song').addEventListener('click', newSong);
$('#songs-button').addEventListener('click', chooseSongDialog);
$('#info-button').addEventListener('click', showInfo);
$('#play').addEventListener('click', togglePlay);
$('#stop').addEventListener('click', () => player.stop());
$('#record').addEventListener('click', toggleRecord);
$('#slower').addEventListener('click', () => changeSpeed(-1));
$('#faster').addEventListener('click', () => changeSpeed(1));
$('#metronome').addEventListener('change', event => {
  player.metronome = event.target.checked;
  settings().metronome = player.metronome;
  persist();
});
function toggleCountIn() {
  player.countIn = !player.countIn;
  settings().countIn = player.countIn;
  persist();
  toast(player.countIn ? 'A bar of clicks plays before you start.' : 'Count-in off.');
}
$('#steps').addEventListener('click', event => {
  const button = event.target.closest('[data-step]');
  if (button) setStep(Number(button.dataset.step));
});
$('#drum-window').addEventListener('click', event => {
  if (event.target.closest('#add-drums')) addDrums();
});
$('#drum-play').addEventListener('click', togglePlay);
$('#beat-preset').addEventListener('change', event => {
  applyBeat(event.target.value);
  event.target.value = '';
});
$('#my-part').addEventListener('change', event => {
  player.stop();
  player.setMyPart(event.target.value);
  settings().parts[song.id] = event.target.value;
  persist();
  renderTracks();
  renderKeyboard();
});
$('#tracks').addEventListener('change', event => {
  const id = event.target.dataset.part;
  if (!id) return;
  if (event.target.checked) player.muted.delete(id);
  else player.muted.add(id);
  settings().muted[song.id] = [...player.muted];
  persist();
});
$('#tracks').addEventListener('click', event => {
  if (event.target.closest('#open-mixer')) showMixer();
  if (event.target.closest('#open-drums')) openDrumMachine();
});
$('#keys-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-tab]');
  if (button) setTab(button.dataset.tab);
});
$('#octave-down').addEventListener('click', () => shiftOctave(-1));
$('#octave-up').addEventListener('click', () => shiftOctave(1));
$('#instrument').addEventListener('change', event => setInstrument(event.target.value));
$('#kit').addEventListener('change', event => setInstrument(event.target.value));
$('#drum-grid').addEventListener('click', event => {
  const cell = event.target.closest('.cell');
  if (cell) toggleDrum(cell.dataset.voice, Number(cell.dataset.step));
});
$('#drum-prev').addEventListener('click', () => { drumPage--; renderDrumMachine(); });
$('#drum-next').addEventListener('click', () => { drumPage++; renderDrumMachine(); });
$('#drum-clear').addEventListener('click', clearDrums);
$('#tools').addEventListener('click', event => {
  const button = event.target.closest('[data-tool]');
  if (button) setTool(button.dataset.tool);
});
$('#loop-all').addEventListener('click', () => player.setSection(null));
$('#guide').addEventListener('change', event => {
  settings().guide = player.guide = event.target.checked;
  persist();
});
$('#pedal').addEventListener('click', () => setPedal(!player.pedal));
$('#trainer').addEventListener('change', event => {
  settings().trainer = event.target.checked;
  persist();
});
$('#take-list').addEventListener('click', event => {
  const row = event.target.closest('[data-take]');
  if (!row) return;
  selectedTake = row.dataset.take;
  renderTakes();
});
$('#take-list').addEventListener('dblclick', playTake);
$('#take-play').addEventListener('click', playTake);
$('#take-use').addEventListener('click', useTake);
$('#take-export').addEventListener('click', () => exportAudio(currentTake()));
$('#take-delete').addEventListener('click', deleteTake);

// Computer keyboard.
const heldKeys = new Map();
document.addEventListener('keydown', event => {
  if ($('#dialog').open || event.target.closest('input, select, textarea')) return;
  const command = event.metaKey || event.ctrlKey;
  if (command) {
    const actions = { z: undo, n: newSong, i: showInfo, s: saveCopy };
    const action = actions[event.key.toLowerCase()];
    if (action) {
      event.preventDefault();
      action();
    }
    return;
  }
  if (event.repeat) return;
  if (document.getElementById('boot') || screen() === 'desk') return;
  if (screen() === 'record') {
    recordScreen.keyDown(event);
    return;
  }
  if (event.key === 'Shift') {
    setPedal(true);
    return;
  }
  const key = event.key.toLowerCase();
  if (key === ' ') {
    event.preventDefault();
    togglePlay();
  } else if (key === 'r') {
    toggleRecord();
  } else if (key === '?') {
    showHelp();
  } else if (key === 'z' || key === 'x') {
    shiftOctave(key === 'z' ? -1 : 1);
  } else if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    if (keyboard.tab === 'chords' && keyboard.pads[index]) {
      keyboard.handlers.padOn(keyboard.pads[index], 0.8);
      heldKeys.set(key, () => keyboard.handlers.padOff(keyboard.pads[index]));
    } else if (keyboard.tab === 'drums' && keyboard.drums[index]) {
      keyboard.handlers.drum(keyboard.drums[index], 0.85);
    }
  } else if (PIANO_KEYS.includes(key) && keyboard.tab === 'keys') {
    const midi = keyboard.low + PIANO_KEYS.indexOf(key);
    keyboard.press(midi, 0.75);
    heldKeys.set(key, () => keyboard.release(midi));
  }
});
document.addEventListener('keyup', event => {
  if (screen() === 'record') {
    recordScreen.keyUp(event);
    return;
  }
  if (event.key === 'Shift') setPedal(false);
  const key = event.key.toLowerCase();
  heldKeys.get(key)?.();
  heldKeys.delete(key);
});

// MIDI keyboards, where the browser supports them.
function connectMidi() {
  navigator.requestMIDIAccess?.().then(access => {
    const listen = input => {
      input.onmidimessage = ({ data: [status, note, velocity] }) => {
        const type = status & 0xf0;
        if (screen() === 'record' && (type === 0x90 || type === 0x80)) recordScreen.midiNote(note, type === 0x90 ? velocity / 127 : 0);
        else if (type === 0x90 && velocity > 0) keyboard.press(note, velocity / 127);
        else if (type === 0x80 || (type === 0x90 && velocity === 0)) keyboard.release(note);
        else if (type === 0xb0 && note === 64) setPedal(velocity >= 64);
      };
    };
    access.inputs.forEach(listen);
    access.onstatechange = event => event.port.type === 'input' && event.port.state === 'connected' && listen(event.port);
  }).catch(() => {});
}

// iPad Safari suspends or interrupts audio after calls, alarms or a locked
// screen; the next touch brings it back.
const wakeAudio = () => {
  if (context.state !== 'running' && !document.getElementById('boot')) context.resume();
};
document.addEventListener('pointerdown', wakeAudio, true);
document.addEventListener('keydown', wakeAudio, true);
context.addEventListener?.('statechange', () => {
  if (document.getElementById('boot')) return;
  if (context.state === 'running') {
    if ($('#status').textContent.startsWith('Sound paused')) setStatus('');
  } else {
    setStatus('Sound paused - tap anywhere');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    player.stop();
    keyboard.releaseAll();
    if (screen() === 'record') recordScreen.stop();
  }
});
window.addEventListener('resize', () => {
  if (keyboard.tab === 'keys') renderKeyboard();
});

// ---------------------------------------------------------------- status and storage

function setStatus(text) {
  $('#status').textContent = text;
}

function persist() {
  if (!storage.save(data)) setStatus('Not saved - browser storage is full or blocked');
  else if ($('#status').textContent.startsWith('Not saved')) setStatus('');
}

function tickClock() {
  $('#clock').textContent = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------- start

renderIcons();
tickClock();
setInterval(tickClock, 10000);
player.metronome = $('#metronome').checked = Boolean(settings().metronome);
player.countIn = settings().countIn !== false;
$('#trainer').checked = Boolean(settings().trainer);
player.guide = $('#guide').checked = Boolean(settings().guide);
keyboard.labels = Boolean(settings().labels);
selectSong(settings().songId || SONGS[0].id);
const recordScreen = new RecordScreen({ engine, $, onPlaying: keepAwake, showPiece: (piece, fresh) => showPiece(piece, { fresh, download }) });
const desktop = new Desktop({ context, $, open: openFromDesk, download, flush: () => recordScreen.flush() });
desktop.render();
// Undertow always starts on the desktop, whatever was open last time.
settings().screen = 'desk';
document.body.dataset.screen = 'desk';
$('#to-desk').addEventListener('click', () => setScreen('desk'));
$('#record-close').addEventListener('click', () => setScreen('desk'));
requestAnimationFrame(frame);

$('#boot-start').addEventListener('click', async () => {
  await context.resume();
  if (desktop.records.length) keepData();
  connectMidi();
  startChord();
  $('#boot').classList.add('leaving');
  setTimeout(() => {
    $('#boot').remove();
    setScreen('desk');
  }, 300);
});

// ---------------------------------------------------------------- screens

function screen() {
  return ['desk', 'record', 'learn'].includes(settings().screen) ? settings().screen : 'desk';
}

// The desktop opens records, My Pieces and the lessons (learn).
async function openFromDesk(target) {
  if (target.screen === 'pieces') {
    showPieces({ download });
    return;
  }
  if (target.screen) {
    setScreen(target.screen);
    return;
  }
  try {
    await recordScreen.open(target);
  } catch {
    alertBox('This record cannot be opened.', 'It may have been removed. Load it again from Files.');
    setScreen('desk');
    return;
  }
  settings().record = target.record;
  setScreen('record');
}

function setScreen(name) {
  const previous = document.body.dataset.screen;
  settings().screen = name;
  persist();
  document.body.dataset.screen = name;
  menus.close();
  if (previous === 'record' && name !== 'record') recordScreen.leave();
  if (previous === 'learn' && name !== 'learn') {
    player.stop();
    keyboard.releaseAll();
  }
  if (name === 'desk') {
    desktop.render();
    if (!settings().deskToured) startTour();
  } else if (name === 'record') {
    recordScreen.enter();
  } else {
    renderKeyboard();
    lastRoll = '';
    if (!settings().learnToured) startTour();
  }
}

// A soft open chord to say the sound is working.
function startChord() {
  const instrument = pianoReady() ? 'piano' : 'epiano';
  const output = engine.channel('you', { instrument });
  [53, 60, 64, 67, 72].forEach((midi, i) => engine.note(instrument, midi, 0.45, context.currentTime + 0.05 + i * 0.06, 1.6, output));
}

function startTour() {
  if (screen() === 'desk' || screen() === 'record') {
    runTour([
      { target: '#records', text: 'Your records live here. Load a Radiohead song you own from Files, then touch it to open it. It stays on this device.' },
      { target: '#desk-icons', text: 'Lessons teaches short passages of Radiohead songs step by step. My Pieces keeps the takes you record.' },
      { target: '[data-menu="help"]', text: 'Help > Show Balloons explains anything you point at or touch.' },
    ]).then(() => {
      settings().deskToured = true;
      persist();
    });
    return;
  }
  const narrow = window.matchMedia('(max-width: 860px)').matches;
  runTour([
    { target: narrow ? '#songs-button' : '#song-list', text: 'Choose a song here. Each one is a short passage with its own sound.' },
    { target: '#play', text: 'Press Play to hear it. The roll shows your part and the keys light up as it plays.' },
    { target: '#steps', text: 'Work through five steps: listen, learn chord by chord, play along slowly, then at full speed, then record. Each one gets a tick.' },
    { target: '#keys-tabs', text: 'Play with your fingers or Apple Pencil. The Chords tab gives you one big pad per chord.' },
    { target: '#tools', text: 'Drag across bar numbers to loop just those bars. The Pencil adds and removes notes.' },
    { target: '#record', text: 'Record yourself over the band. Every take is kept, and a good one can become the song\'s part.' },
    { target: '[data-menu="help"]', text: 'Help > Show Balloons explains anything on screen. Have fun.' },
  ]).then(() => {
    settings().learnToured = true;
    persist();
  });
}

function showMixer() {
  const levels = (settings().volumes[song.id] ||= {});
  const percent = id => Math.round((levels[id] ?? 1) * 100);
  const closed = showDialog(`
    <h3>Mixer - ${escape(song.title)}</h3>
    <div class="mixer">
      ${song.parts.map(p => `<div class="row"><label class="label" for="mix-${p.id}">${escape(p.name)}</label>
        <input id="mix-${p.id}" class="slider" type="range" min="0" max="150" step="5" value="${percent(p.id)}" data-part="${p.id}">
        <output>${percent(p.id)}%</output></div>`).join('')}
    </div>
    <div class="button-row"><button class="btn" data-value="reset">Reset</button><button class="btn default" data-value="ok">Done</button></div>`);
  const body = $('#dialog-body');
  const onInput = event => {
    const slider = event.target.closest('[data-part]');
    if (!slider) return;
    levels[slider.dataset.part] = Number(slider.value) / 100;
    slider.nextElementSibling.textContent = `${slider.value}%`;
    player.volumes = levels;
    persist();
  };
  body.addEventListener('input', onInput);
  closed.then(({ value }) => {
    body.removeEventListener('input', onInput);
    if (value === 'reset') {
      delete settings().volumes[song.id];
      player.volumes = {};
      persist();
      toast('Mixer reset.');
    }
  });
}

function setPedal(down) {
  player.setPedal(down);
  $('#pedal').setAttribute('aria-pressed', String(down));
}

function toggleLabels() {
  settings().labels = !settings().labels;
  keyboard.labels = settings().labels;
  persist();
  renderKeyboard();
}

// Works offline and installs to the Home Screen once loaded over https.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Exposed for automated browser checks.
window.undertow = { player, engine, keyboard, setScreen, get desktop() { return desktop; }, get record() { return recordScreen; }, get song() { return song; }, get data() { return data; } };
