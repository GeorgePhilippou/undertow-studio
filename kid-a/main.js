// Kid A - play Radiohead's piano parts from the computer keyboard, one chord
// at a time, on a classic Mac desk. It shares the piano, song data, interface
// and the records loaded in OK Computer (same site, same browser storage) but
// keeps its own settings.

import { Engine, loadPiano } from '../src/audio/engine.js';
import { SONGS, prepareSong, noteName } from '../src/songs.js';
import { Keyboard } from '../src/ui/keyboard.js';
import { MenuBar, setupWindows, showDialog, toast, escape } from '../src/ui/mac.js';
import { ICONS, renderIcons } from '../src/ui/icons.js';
import { BalloonHelp } from '../src/ui/balloons.js';
import { listTracks, getTrack } from '../src/records/tracks.js';
import { TapAlong, handsFor, keyFor, plain } from './tapalong.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

// Songs with a piano part to tap along to, in the order they are offered.
const PLAYABLE = ['pyramid'];
const STORE = 'kid-a-v1';

function loadSettings() {
  try {
    return { pedal: true, song: PLAYABLE[0], record: '', speed: 1, ...JSON.parse(localStorage.getItem(STORE) || '{}') };
  } catch {
    return { pedal: true, song: PLAYABLE[0], record: '', speed: 1 };
  }
}
const settings = loadSettings();
function saveSettings() {
  try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch { /* private window */ }
}

const context = new (window.AudioContext || window.webkitAudioContext)();
const engine = new Engine(context);
const balloons = new BalloonHelp();
const noteList = notes => notes.map(midi => plain(noteName(midi))).join(' ') || '-';
const clock = seconds => {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- the song

let song = null;
let part = null;
let tap = null;

function pianoPart(prepared) {
  return prepared.parts.find(p => p.kind === 'notes' && p.instrument === 'piano' && p.learn)
    || prepared.parts.find(p => p.kind === 'notes' && p.instrument === 'piano');
}

function setSong(id) {
  stopDemo();
  releaseAll();
  const raw = SONGS.find(s => s.id === id) || SONGS.find(s => s.id === PLAYABLE[0]);
  song = prepareSong(raw);
  part = pianoPart(song);
  tap = new TapAlong(handsFor(song, part));
  settings.song = song.id;
  saveSettings();
  $('#kida-title').textContent = song.title;
  document.title = `Kid A - ${song.title}`;
  $('#kida-song').value = song.id;
  $('#kida-about').textContent = plain(song.about);
  fitPart();
  chooseRecord();
  show();
}

// ---------------------------------------------------------------- sound

// Voices still ringing for each hand, and for the keys of a held key.
const ringing = { left: [], right: [] };
const held = new Map(); // key code or pointer -> voices
const free = new Map(); // midi -> voice, for keys touched on the piano
const sounding = new Set();

function channel(hand) {
  return engine.channel(`kida-${hand}`, { instrument: 'piano', volume: hand === 'left' ? 0.85 : 0.8 });
}

function start(hand, notes, velocity) {
  const now = context.currentTime;
  // The pedal changes on every chord: the hand's last chord lets go as the
  // next one sounds.
  for (const voice of ringing[hand]) {
    voice.release(now + 0.04);
    sounding.delete(voice.midi);
  }
  const voices = notes.map(midi => {
    const voice = engine.noteOn('piano', midi, velocity, now, channel(hand));
    voice.midi = midi;
    sounding.add(midi);
    return voice;
  });
  ringing[hand] = voices;
  return voices;
}

function stopVoices(voices) {
  const now = context.currentTime;
  for (const voice of voices) {
    voice.release(now);
    sounding.delete(voice.midi);
  }
  for (const hand of ['left', 'right']) ringing[hand] = ringing[hand].filter(v => !voices.includes(v));
}

function releaseAll() {
  stopVoices([...ringing.left, ...ringing.right]);
  held.clear();
  keyboard?.releaseAll();
  showSounding();
}

// One hand plays the next hit. Returns the voices so a key can stop them
// when it is let go with the pedal up.
function playHand(hand, velocity) {
  const { notes } = tap.press(hand);
  const voices = start(hand, notes, velocity);
  flashHand(hand);
  show();
  return voices;
}

function playBoth(velocity) {
  const { left, right } = tap.both();
  const voices = [];
  if (left.length) {
    voices.push(...start('left', left, velocity));
    flashHand('left');
  }
  if (right.length) {
    voices.push(...start('right', right, velocity));
    flashHand('right');
  }
  show();
  return voices;
}

function flashHand(hand) {
  const pad = $(`#hand-${hand}`);
  pad.classList.add('down');
  clearTimeout(pad.flash);
  pad.flash = setTimeout(() => pad.classList.remove('down'), 140);
}

// ---------------------------------------------------------------- keyboard

const keyboard = new Keyboard({ piano: $('#kida-piano'), pads: $('#kida-pads'), drumPads: $('#kida-drums') }, {
  noteOn: (midi, velocity) => {
    free.get(midi)?.release(context.currentTime);
    free.set(midi, engine.noteOn('piano', midi, velocity, context.currentTime, channel('right')));
  },
  noteOff: midi => {
    if (!$('#kida-pedal').checked) free.get(midi)?.release(context.currentTime);
    else free.get(midi)?.release(context.currentTime + 1.5);
    free.delete(midi);
  },
  padOn: () => {},
  padOff: () => {},
  drum: () => {},
});
keyboard.show('keys');
// Just the white keys the part needs, plus one each side, as narrow as a
// phone needs so all of a part fits.
let partWhites = 22;
keyboard.whiteCount = () => Math.max(8, Math.min(partWhites + 2, Math.floor((keyboard.pianoElement.clientWidth || 600) / 14)));
const BLACK = new Set([1, 3, 6, 8, 10]);

function fitPart() {
  const notes = tap.hits.flatMap(hit => [...hit.left, ...hit.right]);
  const low = Math.min(...notes);
  const high = Math.max(...notes);
  partWhites = 0;
  for (let midi = low; midi <= high; midi++) if (!BLACK.has(midi % 12)) partWhites++;
  keyboard.fit(low - 1, high + 1);
}

function showSounding() {
  keyboard.highlight({ targets: new Set(tap ? [...nextNotes()] : []), sounding: new Set(sounding) });
}

// What the next press of each hand would play.
function nextFor(hand) {
  if (!tap.played[hand]) return tap.next;
  return tap.hits[(tap.index + 1) % tap.hits.length];
}

function nextNotes() {
  return [...nextFor('left').left, ...nextFor('right').right];
}

function show() {
  const next = tap.next;
  $('#kida-chord').textContent = plain(next.chord) || noteList([...next.left, ...next.right]);
  $('#kida-count').textContent = `Chord ${tap.index + 1} of ${tap.hits.length}, time ${tap.round}`;
  $('#left-notes').textContent = noteList(nextFor('left').left);
  $('#right-notes').textContent = noteList(nextFor('right').right);
  $('#hand-left').classList.toggle('target', !tap.played.left);
  $('#hand-right').classList.toggle('target', !tap.played.right);
  showSounding();
  drawStrip();
}

// ---------------------------------------------------------------- the strip

function drawStrip() {
  const canvas = $('#kida-strip');
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width) return;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const g = canvas.getContext('2d');
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, width, height);
  const total = tap.hits.reduce((sum, hit) => sum + hit.gap, 0);
  let x = 0;
  canvas.boxes = [];
  tap.hits.forEach((hit, i) => {
    const w = (hit.gap / total) * width;
    const left = Math.round(x);
    const right = Math.round(x + w);
    canvas.boxes.push([left, right]);
    const on = i === tap.index;
    g.fillStyle = '#000';
    if (on) g.fillRect(left, 0, right - left, height);
    else g.fillRect(right - 1, 0, 1, height);
    g.save();
    g.beginPath();
    g.rect(left, 0, right - left - 1, height);
    g.clip();
    g.fillStyle = on ? '#fff' : '#000';
    g.textBaseline = 'middle';
    g.font = '18px Chicago, sans-serif';
    g.fillText(plain(hit.chord) || noteList(hit.left), left + 6, height / 2 - 6);
    g.font = '16px Geneva, sans-serif';
    const eighths = Math.round(hit.gap * 2);
    g.fillText(`${eighths}`, left + 6, height / 2 + 11);
    // A little mark for each hand that has played the chord to come.
    if (on) {
      if (tap.played.left) g.fillText('L', right - 30, height / 2 + 11);
      if (tap.played.right) g.fillText('R', right - 16, height / 2 + 11);
    }
    g.restore();
    x += w;
  });
}

$('#kida-strip').addEventListener('pointerdown', event => {
  const canvas = event.currentTarget;
  const x = event.clientX - canvas.getBoundingClientRect().left;
  const index = (canvas.boxes || []).findIndex(([left, right]) => x >= left && x < right);
  if (index < 0) return;
  stopDemo();
  tap.index = index;
  tap.played = { left: false, right: false };
  show();
});

// ---------------------------------------------------------------- hear it

let demo = null;

function startDemo() {
  stopDemo();
  releaseAll();
  tap.restart();
  const beat = 60 / song.bpm;
  const began = performance.now();
  const rounds = 2;
  const times = [];
  for (let round = 0; round < rounds; round++) {
    tap.hits.forEach(hit => times.push((round * (part.length || song.loop) + hit.beat) * beat * 1000));
  }
  let step = 0;
  const tick = () => {
    if (step >= times.length) {
      demo = { timer: setTimeout(() => stopDemo(true), tap.hits[tap.hits.length - 1].gap * beat * 1000) };
      return;
    }
    const hit = tap.next;
    playBoth(hit.velocity);
    step++;
    const wait = step < times.length ? times[step] - (performance.now() - began) : 0;
    demo.timer = setTimeout(tick, Math.max(0, wait));
  };
  demo = { timer: setTimeout(tick, 0) };
  $('#kida-hear').setAttribute('aria-pressed', 'true');
}

function stopDemo(finished = false) {
  if (!demo) return;
  clearTimeout(demo.timer);
  demo = null;
  $('#kida-hear').setAttribute('aria-pressed', 'false');
  if (finished) {
    tap.restart();
    show();
  }
}

// ---------------------------------------------------------------- keys

function pedalChanged() {
  settings.pedal = $('#kida-pedal').checked;
  saveSettings();
}

document.addEventListener('keydown', event => {
  if ($('#boot') || $('#dialog').open || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest?.('input[type="text"], input[type="number"], textarea')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (event.repeat) return;
    stopDemo();
    held.set(event.code, playBoth(0.7));
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (!event.repeat) togglePlay();
    return;
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    tap.back();
    show();
    return;
  }
  const key = keyFor(event.code);
  if (!key) return;
  event.preventDefault();
  if (event.repeat) return;
  stopDemo();
  held.set(event.code, playHand(key.hand, key.velocity));
});

document.addEventListener('keyup', event => {
  const voices = held.get(event.code);
  if (!voices) return;
  held.delete(event.code);
  if (!$('#kida-pedal').checked) {
    stopVoices(voices);
    showSounding();
  }
});

window.addEventListener('blur', () => {
  if (!$('#kida-pedal').checked) releaseAll();
});

// The two hand pads work by touch, louder towards the bottom.
for (const pad of $$('.kida-hand')) {
  pad.addEventListener('pointerdown', event => {
    event.preventDefault();
    stopDemo();
    const box = pad.getBoundingClientRect();
    const depth = (event.clientY - box.top) / box.height;
    const velocity = event.pointerType === 'pen' && event.pressure > 0 ? Math.min(1, 0.2 + event.pressure * 0.9) : 0.4 + depth * 0.5;
    held.set(`pointer-${event.pointerId}`, playHand(pad.dataset.hand, velocity));
  });
  const end = event => {
    const voices = held.get(`pointer-${event.pointerId}`);
    if (!voices) return;
    held.delete(`pointer-${event.pointerId}`);
    if (!$('#kida-pedal').checked) {
      stopVoices(voices);
      showSounding();
    }
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('contextmenu', event => event.preventDefault());
}

// MIDI keyboards: keys below middle C play the left hand, from middle C up the
// right hand, with the keyboard's own touch.
function connectMidi() {
  navigator.requestMIDIAccess?.().then(access => {
    const listen = input => {
      input.onmidimessage = ({ data: [status, note, velocity] }) => {
        const type = status & 0xf0;
        const id = `midi-${note}`;
        if (type === 0x90 && velocity > 0) {
          stopDemo();
          held.set(id, playHand(note < 60 ? 'left' : 'right', velocity / 127));
        } else if (type === 0x80 || type === 0x90) {
          const voices = held.get(id);
          held.delete(id);
          if (voices && !$('#kida-pedal').checked) {
            stopVoices(voices);
            showSounding();
          }
        } else if (type === 0xb0 && note === 64) {
          $('#kida-pedal').checked = velocity >= 64;
        }
      };
    };
    access.inputs.forEach(listen);
    access.onstatechange = event => event.port.type === 'input' && event.port.state === 'connected' && listen(event.port);
  }).catch(() => {});
}

// ---------------------------------------------------------------- records

// A record loaded in OK Computer plays underneath, straight from an audio
// element, slowed down without changing pitch if asked.
const audio = new Audio();
audio.preload = 'auto';
audio.preservesPitch = true;
audio.webkitPreservesPitch = true;
let records = [];
let url = null;

async function listRecords() {
  try {
    records = await listTracks();
  } catch {
    records = [];
  }
  const select = $('#kida-record');
  select.innerHTML = `<option value="">Nothing</option>${records.map(r => `<option value="${escape(r.id)}">${escape(r.name)}</option>`).join('')}`;
  if (!records.length) select.title = 'Load records in OK Computer first.';
}

// The saved choice, or else a record of this song.
function chooseRecord() {
  if (!records.length) return;
  const saved = records.find(r => r.id === settings.record);
  const matching = records.find(r => r.songId === song.id) || records.find(r => r.name.toLowerCase().includes(song.title.toLowerCase()));
  const pick = saved || matching;
  if (pick && $('#kida-record').value !== pick.id) {
    $('#kida-record').value = pick.id;
    useRecord(pick.id);
  }
}

async function useRecord(id) {
  audio.pause();
  showPlaying();
  settings.record = id;
  saveSettings();
  $('#kida-play').disabled = true;
  if (url) URL.revokeObjectURL(url);
  url = null;
  audio.removeAttribute('src');
  if (!id) return;
  try {
    const track = await getTrack(id);
    if (!track?.blob) throw new Error('missing');
    url = URL.createObjectURL(track.blob);
    audio.src = url;
    audio.playbackRate = settings.speed;
    $('#kida-play').disabled = false;
  } catch {
    toast('That record cannot be opened. Load it again in OK Computer.');
    $('#kida-record').value = '';
  }
}

function togglePlay() {
  if (!audio.src) return;
  if (audio.paused) audio.play().catch(() => toast('Touch Play again to start the record.'));
  else audio.pause();
}

function showPlaying() {
  const playing = !audio.paused;
  const button = $('#kida-play');
  button.setAttribute('aria-pressed', String(playing));
  button.innerHTML = `<span data-icon="${playing ? 'stop' : 'play'}"></span><span>${playing ? 'Stop' : 'Play'}</span>`;
  renderIcons(button);
}

audio.addEventListener('play', showPlaying);
audio.addEventListener('pause', showPlaying);
audio.addEventListener('ended', showPlaying);
audio.addEventListener('timeupdate', () => ($('#kida-time').textContent = clock(audio.currentTime)));

// ---------------------------------------------------------------- dialogs

function showInfo() {
  const sources = (song.sources || []).map(([name, href]) => `<li><a href="${escape(href)}" target="_blank" rel="noopener">${escape(plain(name))}</a></li>`).join('');
  showDialog(`
    <div class="alert">${ICONS.piano}<div>
      <h3>${escape(song.title)}</h3>
      <p>${escape(song.album)}, ${song.year}. About ${song.bpm} BPM, key of ${escape(plain(song.key))}.</p>
      <p>${escape(plain(song.about))}</p>
      <p><b>How close is it?</b> ${escape(plain(song.accuracy))} This is a reconstruction for playing along, not an exact transcription.</p>
      ${sources ? `<p><b>Sources</b></p><ul>${sources}</ul>` : ''}
    </div></div>
    <div class="button-row"><button class="btn default" data-value="ok">OK</button></div>`);
}

function showHowTo() {
  showDialog(`
    <h3>How to Play</h3>
    <ul>
      <li>Each press plays the <b>next chord</b> of the part, in your own time.</li>
      <li><b>Left hand:</b> any key on the left of the keyboard (1-5, Q-T, A-G, Z-B) plays the bass.</li>
      <li><b>Right hand:</b> any key on the right (6-0, Y-P, H-;, N-/) plays the chord on top.</li>
      <li>Press one key on each side together for the whole chord, or <b>Space</b> for both hands. Pressing one hand twice moves on without the other.</li>
      <li>The <b>number row</b> plays loudest, then the top row, the home row, and the <b>bottom row</b> softest.</li>
      <li><b>Pedal</b> on: each chord rings until that hand plays again. Off: notes stop when you let go.</li>
      <li><b>Delete</b> steps back a chord; <b>Return</b> plays or stops the record underneath.</li>
      <li>On iPad, use a hardware keyboard, or touch the two hand pads. A MIDI keyboard works too: below middle C is the left hand.</li>
      <li>Many keyboards cannot register lots of keys at once. One key per hand is all you need.</li>
    </ul>
    <div class="button-row"><button class="btn default" data-value="ok">OK</button></div>`);
}

function showAbout() {
  showDialog(`
    <div class="alert">${ICONS.piano}<div>
      <h3>Kid A</h3>
      <p>Play Radiohead's piano parts on a computer keyboard, a chord at a time. It is the piano companion to OK Computer and can play along with the records you loaded there; nothing leaves this device.</p>
      <p><b>Credits</b><br>
      Piano: Salamander Grand Piano by Alexander Holm, CC BY 3.0.<br>
      Chicago-style type: ChiKareGo2 by Giles Booth, CC BY.<br>
      Geneva-style type: Geneva 9 by Kelsey Higham, CC BY 3.0.<br>
      Song analyses are credited in each song's Get Info window.</p>
      <p>A fan-made app, not connected with Radiohead or their record labels.</p>
    </div></div>
    <div class="button-row"><button class="btn default" data-value="ok">OK</button></div>`);
}

function openOkComputer() {
  location.href = '../';
}

new MenuBar($('.menubar'), $('#menus'), name => {
  switch (name) {
    case 'kida':
      return [
        { label: 'About Kid A...', action: showAbout },
        '-',
        { label: 'OK Computer', shortcut: '⌘D', action: openOkComputer },
      ];
    case 'song':
      return [
        ...PLAYABLE.map(id => ({ label: SONGS.find(s => s.id === id).title, checked: song.id === id, action: () => setSong(id) })),
        '-',
        { label: 'Get Info', action: showInfo },
        { label: 'Hear It', action: startDemo },
        { label: 'Start Over', action: () => { stopDemo(); tap.restart(); show(); } },
      ];
    case 'help':
      return [
        { label: 'How to Play...', action: showHowTo },
        { label: balloons.enabled ? 'Hide Balloons' : 'Show Balloons', action: () => toast(balloons.toggle() ? 'Point at or touch anything to see what it does.' : 'Balloons off.') },
      ];
    default:
      return [];
  }
});

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    openOkComputer();
  }
});

// ---------------------------------------------------------------- wiring

$('#kida-song').innerHTML = PLAYABLE.map(id => `<option value="${id}">${escape(SONGS.find(s => s.id === id).title)}</option>`).join('');
$('#kida-song').addEventListener('change', event => setSong(event.target.value));
$('#kida-info').addEventListener('click', showInfo);
$('#kida-hear').addEventListener('click', () => (demo ? stopDemo() : startDemo()));
$('#kida-restart').addEventListener('click', () => {
  stopDemo();
  releaseAll();
  tap.restart();
  show();
});
$('#kida-pedal').checked = settings.pedal !== false;
$('#kida-pedal').addEventListener('change', () => {
  pedalChanged();
  if (!$('#kida-pedal').checked) releaseAll();
});
$('#kida-record').addEventListener('change', event => useRecord(event.target.value));
$('#kida-play').addEventListener('click', togglePlay);
$('#kida-speed').value = String(settings.speed);
$('#kida-speed').addEventListener('change', event => {
  settings.speed = Number(event.target.value) || 1;
  audio.playbackRate = settings.speed;
  saveSettings();
});
window.addEventListener('resize', () => {
  fitPart();
  show();
});

// Controls hand the keyboard straight back to the piano once used, so a key
// press never changes a popup or toggles a checkbox by mistake.
for (const control of $$('select, input[type="checkbox"]')) control.addEventListener('change', () => control.blur());
document.addEventListener('click', event => event.target.closest?.('button')?.blur());

setupWindows(() => {});
renderIcons();
showPlaying();
setSong(settings.song);
listRecords().then(chooseRecord);

const tick = () => ($('#clock').textContent = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
tick();
setInterval(tick, 15000);

$('#boot-start').addEventListener('click', async () => {
  await context.resume();
  loadPiano(context).then(count => !count && toast('The piano samples did not load; a simpler piano plays instead.'));
  connectMidi();
  $('#boot').classList.add('leaving');
  setTimeout(() => {
    $('#boot').remove();
    drawStrip();
  }, 300);
});

document.addEventListener('pointerdown', () => context.state !== 'running' && context.resume());

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
}

// For the browser checks.
window.kida = { get tap() { return tap; }, get song() { return song; }, keyboard, engine, context, sounding, setSong, audio };
