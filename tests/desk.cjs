// Checks for the desktop and records: loading a song file you own, playing
// along with its chords, looping, slowing down and the sampler pads.
const { launch, openApp, check } = require('./helpers.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Twelve seconds of C, D-flat and E-flat chords at 124 BPM, like the opening
// of Everything In Its Right Place, with a sharp attack on every chord.
function testRecord() {
  const rate = 22050;
  const beat = 60 / 124;
  const samples = new Int16Array(rate * 12);
  const chords = [[261.6, 329.6, 392], [277.2, 349.2, 415.3], [311.1, 392, 466.2]];
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    if (t < 0.5) continue;
    const cycle = (t - 0.5) % (beat * 10);
    const chord = chords[cycle < beat * 2 ? 0 : cycle < beat * 4 ? 1 : 2];
    const since = (t - 0.5) % (beat * 0.75);
    const v = Math.exp(-since * 5) * chord.reduce((sum, hz) => sum + Math.sin(2 * Math.PI * hz * t), 0) / 3;
    samples[i] = Math.round(v * 26000);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples.length * 2, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples.length * 2, 40);
  const file = path.join(os.tmpdir(), '01 Everything In Its Right Place.wav');
  fs.writeFileSync(file, Buffer.concat([header, Buffer.from(samples.buffer)]));
  return file;
}

// Help balloons on screen that miss their control or leave the screen.
function balloonMisses(page) {
  return page.evaluate(async () => {
    const { showBalloon, hideBalloon } = await import('./src/ui/balloons.js');
    const wrong = [];
    for (const element of document.querySelectorAll('[data-help]')) {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height || box.bottom < 24 || box.top > innerHeight) continue;
      const balloon = showBalloon(element, element.dataset.help);
      const x = Number(balloon.dataset.tipX);
      const y = Number(balloon.dataset.tipY);
      const b = balloon.getBoundingClientRect();
      const inside = x >= box.left - 8 && x <= box.right + 8 && y >= box.top - 8 && y <= box.bottom + 8;
      const onScreen = b.left >= 0 && b.right <= innerWidth && b.top >= 24 && b.bottom <= innerHeight;
      if (!inside || !onScreen) wrong.push(element.id || element.className || element.tagName);
      hideBalloon();
    }
    return wrong;
  });
}

(async () => {
  const browser = await launch();
  const { page, errors } = await openApp(browser);
  await page.evaluate(() => undertow.setScreen('desk'));
  const duplicates = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  check(duplicates.length === 0, `every element id is unique ${duplicates.join(', ')}`);
  check(await page.isVisible('#records-window'), 'the desktop shows the Records window');
  const icons = await page.$$eval('#desk-icons [data-open]', els => els.map(e => e.dataset.open));
  check(icons.join() === 'pieces', `the desktop has My Pieces beside the records and nothing else (${icons.join(', ')})`);
  check(await page.isVisible('#records-empty'), 'an empty desktop explains how to load a record');
  await page.click('[data-menu="undertow"]');
  check(await page.isDisabled('.menu button:has-text("Desktop")'), 'Desktop in the apple menu is dimmed on the desktop');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('.menu') && document.body.click());

  await page.click('[data-menu="undertow"]');
  await page.click('.menu button:has-text("Lessons (old)")');
  await page.waitForFunction(() => document.body.dataset.screen === 'learn');
  check(await page.isVisible('#songs-window'), 'the old Lessons still open from the apple menu');
  await page.click('[data-menu="undertow"]');
  await page.click('.menu button:has-text("Desktop")');
  await page.waitForFunction(() => document.body.dataset.screen === 'desk');
  check(true, 'Desktop in the apple menu goes back to the desktop');
  await page.click('#desk-icons [data-open="pieces"]');
  await page.waitForSelector('#dialog[open] .list-box');
  check((await page.textContent('#dialog')).includes('My Pieces'), 'My Pieces opens from the desktop');
  await page.click('#dialog [data-value="ok"]');

  // Load a record.
  await page.setInputFiles('#record-file', testRecord());
  await page.waitForFunction(() => document.body.dataset.screen === 'record', null, { timeout: 15000 });
  check(await page.textContent('#record-title') === 'Everything In Its Right Place', 'the record opens with a title from its file name');
  check(await page.inputValue('#record-song') === 'everything', 'the song is recognised from the file name');
  const start = await page.evaluate(() => undertow.record.track.sync.start);
  check(Math.abs(start - 0.48) < 0.06, `the chords start where the music starts (${start.toFixed(2)} s)`);

  // Riffs: tap through the opening keyboard figure.
  check(await page.evaluate(() => document.getElementById('record-window').dataset.view) === 'play' && await page.isVisible('#riff-tap') && await page.isVisible('#chord-lane'), 'a known song opens on Play, with its chords and riff together');
  check((await page.textContent('#riff-next')).startsWith('The opening keyboard figure: 1 of 15'), 'the riff is named on the Tap pad');
  const riff = await page.evaluate(() => ({ hits: undertow.record.riffs.riff.hits.length, first: undertow.record.riffs.sliceOf(0), second: undertow.record.riffs.sliceOf(1) }));
  const beat = 60 / 124;
  check(riff.hits === 15 && Math.abs(riff.first.start - start) < 0.001 && Math.abs(riff.second.start - (start + 0.75 * beat)) < 0.001, `each hit is cut from the record in time (${riff.hits} hits)`);
  const targets = await page.$$eval('#along-piano .target', keys => keys.map(k => Number(k.dataset.midi)).sort((a, b) => a - b));
  check(targets.join() === '36,52,55,60', `the keys show the first hit (${targets.join(' ')})`);
  await page.click('#riff-tap');
  check(await page.evaluate(() => undertow.record.riffs.index === 1 && undertow.record.riffs.sampler.playing('riff')), 'tapping plays the first hit from the record and moves on');
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => undertow.record.riffs.index) === 2, 'Return taps too');
  await page.evaluate(() => [36, 52, 55, 60].forEach(n => undertow.record.keyboard.press(n, 0.7)));
  await page.evaluate(() => [36, 52, 55, 60].forEach(n => undertow.record.keyboard.release(n)));
  check(await page.evaluate(() => undertow.record.riffs.index) === 3, 'playing the right keys moves on as well');
  await page.click('#riff-sound [data-sound="keys"]');
  await page.click('#riff-tap');
  check(await page.evaluate(() => undertow.record.riffs.sound === 'keys' && undertow.record.riffs.index === 4 && !undertow.record.riffs.sampler.playing('riff')), 'Keys plays the riff with the app instrument');
  await page.click('#riff-sound [data-sound="record"]');
  await page.click('#riff-hear');
  await page.waitForTimeout(1300);
  const demo = await page.evaluate(() => undertow.record.riffs.current());
  check(demo >= 2 && demo <= 6, `Hear It plays the riff in time (hit ${demo + 1} after 1.3 s)`);
  await page.click('#riff-hear');
  await page.click('#riff-restart');
  check(await page.evaluate(() => undertow.record.riffs.index) === 0, 'Start Over goes back to the first hit');
  const chords = await page.evaluate(() => undertow.record.chordList().slice(0, 4).map(c => `${c.name}@${c.time.toFixed(2)}`));
  check(chords[0].startsWith('C@') && chords[1].startsWith('D♭maj7@') && chords[2].startsWith('E♭6@'), `the chart follows the song (${chords.join(', ')})`);
  await page.waitForTimeout(300);
  check(await page.textContent('#chord-now') !== '', 'the current chord is shown');

  // Play, speed, loop.
  await page.click('#rec-play');
  await page.waitForTimeout(1200);
  const t1 = await page.evaluate(() => undertow.record.time);
  check(t1 > 0.5, `the record plays (${t1.toFixed(2)} s)`);
  check(['C', 'Dbmaj7'].includes(await page.textContent('#chord-now')), 'the chord display follows the record');
  await page.selectOption('#rec-speed', '0.75');
  const rate = await page.evaluate(() => [document.querySelector('audio') ? 0 : 1, undertow.record.audio.playbackRate, undertow.record.audio.preservesPitch]);
  check(rate[1] === 0.75 && rate[2] === true, 'slowing down keeps the pitch');
  const box = await page.locator('#record-wave').boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const loop = await page.evaluate(() => undertow.record.loop);
  check(loop && Math.abs(loop.start - 3) < 0.4 && Math.abs(loop.end - 5.4) < 0.4, `dragging across the waveform loops that part (${loop && loop.start.toFixed(1)}-${loop && loop.end.toFixed(1)})`);
  await page.waitForTimeout(3600);
  const looped = await page.evaluate(() => undertow.record.time);
  check(looped >= loop.start - 0.1 && looped <= loop.end + 0.1, `the loop repeats (${looped.toFixed(2)} s)`);
  await page.click('#rec-loop');
  check(await page.evaluate(() => undertow.record.loop === null), 'the Loop button stops looping');

  // Set Start and tempo.
  await page.evaluate(() => { undertow.record.stop(); undertow.record.seek(1.0); });
  await page.click('#rec-start');
  check(Math.abs(await page.evaluate(() => undertow.record.track.sync.start) - 1.0) < 0.01, 'Set Start lines the chart up at the playhead');
  await page.click('#tempo-up');
  check(await page.textContent('#rec-bpm') === '124.5 BPM', 'the tempo can be nudged');

  // Mark chords.
  await page.click('#rec-mark');
  check(await page.isVisible('#mark-row'), 'Mark Chords shows the chord buttons');
  await page.evaluate(() => undertow.record.seek(2));
  await page.click('#mark-chords [data-mark="C"]');
  await page.evaluate(() => undertow.record.seek(4));
  await page.click('#mark-chords [data-mark="E♭6"]');
  const marked = await page.evaluate(() => undertow.record.chordList().map(c => c.name));
  check(marked.join() === 'C,E♭6', `marks replace the song's chart (${marked.join(', ')})`);
  await page.click('#mark-undo');
  check(await page.evaluate(() => undertow.record.track.sync.marks.length) === 1, 'Undo removes a mark');
  await page.click('#mark-clear');
  check(await page.evaluate(() => undertow.record.chordList()[0].name) === 'C', 'Clear Marks goes back to the song chart');

  // Keyboard lights the current chord.
  await page.evaluate(() => undertow.record.seek(1.2));
  await page.waitForTimeout(200);
  const lit = await page.$$eval('#along-piano .target', keys => keys.map(k => Number(k.dataset.midi) % 12).sort((a, b) => a - b));
  check(lit.includes(0) && lit.includes(4) && lit.includes(7), `the keyboard shows the chord playing now (${lit.join(' ')})`);

  // Pads.
  await page.click('#record-view [data-view="pads"]');
  const pads = await page.$$('#sampler [data-slice]');
  check(pads.length === 16, 'the record is cut into 16 pads');
  const slices = await page.evaluate(() => undertow.record.slices);
  check(slices.every(s => s.end > s.start && s.start >= 0 && s.end <= 12.01), 'every pad plays a part of the record');
  const before = await page.evaluate(() => { undertow.record.stop(); return undertow.engine.context.currentTime; });
  await page.click('#sampler [data-slice="0"]');
  check(await page.evaluate(() => undertow.record.sampler.playing('pad-0')), 'touching a pad plays it');
  await page.waitForTimeout(120);
  const through = await page.evaluate(() => document.querySelector('#sampler [data-slice="0"] canvas').through);
  check(through > 0 && through < 1, `the pad's waveform shows how far it has played (${through && through.toFixed(2)})`);
  await page.keyboard.press('w');
  check(await page.evaluate(() => undertow.record.sampler.playing('pad-5')), 'computer keys play the pads');
  await page.evaluate(() => undertow.record.setLoop({ start: 1, end: 3 }));
  await page.click('#rec-assign');
  await page.click('#sampler [data-slice="15"]');
  const assigned = await page.evaluate(() => undertow.record.slices[15]);
  check(assigned.start === 1 && assigned.end === 3, 'Loop to Pad puts the loop on a pad');
  await page.selectOption('#rec-cut', 'loop');
  const even = await page.evaluate(() => undertow.record.slices.map(s => +(s.end - s.start).toFixed(3)));
  check(even.every(d => Math.abs(d - 0.125) < 0.001), 'the loop can be cut into 16 even pads');
  await page.evaluate(() => undertow.record.setLoop(null));
  await page.evaluate(() => undertow.record.seek(0.5));
  await page.selectOption('#rec-cut', 'bar');
  const bars = await page.evaluate(() => undertow.record.slices.slice(0, 2).map(s => +(s.end - s.start).toFixed(3)));
  check(Math.abs(bars[0] - 4 * 60 / 124.5) < 0.01, `pads can be a bar long (${bars[0]} s)`);
  await page.selectOption('#rec-cut', 'bars2');
  const twoBars = await page.evaluate(() => +(undertow.record.slices[0].end - undertow.record.slices[0].start).toFixed(3));
  check(Math.abs(twoBars - 8 * 60 / 124.5) < 0.01, `or two bars long (${twoBars} s)`);

  // Editing a pad.
  await page.click('#pad-edit');
  check(await page.isVisible('#pad-editor'), 'Edit Pad shows the pad editor');
  await page.click('#sampler [data-slice="0"]');
  const was = await page.evaluate(() => ({ ...undertow.record.slices[0] }));
  await page.click('#edit-end-up');
  await page.click('#edit-end-up');
  const longer = await page.evaluate(() => undertow.record.slices[0].end);
  check(Math.abs(longer - (was.end + 2 * 60 / 124.5 / 4)) < 0.001, 'End + makes the pad longer a sixteenth at a time');
  const wave = await page.locator('#record-wave').boundingBox();
  await page.mouse.move(wave.x + wave.width * 0.1, wave.y + 30);
  await page.mouse.down();
  await page.mouse.move(wave.x + wave.width * 0.3, wave.y + 30, { steps: 6 });
  await page.mouse.up();
  const dragged = await page.evaluate(() => undertow.record.slices[0]);
  check(Math.abs(dragged.start - 1.2) < 0.3 && Math.abs(dragged.end - 3.6) < 0.3 && !(await page.evaluate(() => undertow.record.loop)), `dragging the waveform sets the pad (${dragged.start.toFixed(1)}-${dragged.end.toFixed(1)})`);
  await page.click('#edit-mode [data-mode="loop"]');
  await page.click('#sampler [data-slice="0"]');
  await page.waitForTimeout(150);
  check(await page.evaluate(() => undertow.record.sampler.voices.get('pad-0')?.source.loop === true), 'a Loop pad repeats');
  await page.click('#sampler [data-slice="0"]');
  check(await page.evaluate(() => !undertow.record.sampler.playing('pad-0')), 'touching a looping pad again stops it');
  await page.click('#edit-pitch-up');
  await page.click('#edit-reverse');
  const tuned = await page.evaluate(() => ({ pitch: undertow.record.slices[0].pitch, reverse: undertow.record.slices[0].reverse, rate: undertow.record.sampler.voices.get('pad-0')?.source.playbackRate.value }));
  check(tuned.pitch === 1 && tuned.reverse === true && Math.abs(tuned.rate - 2 ** (1 / 12)) < 0.001, 'a pad can be pitched and reversed');
  await page.click('#pad-edit');
  await page.evaluate(() => undertow.record.sampler.stopAll());
  await page.locator('#fx-filter').fill('80');
  const cutoff = await page.evaluate(() => undertow.record.sampler.filter.frequency.value);
  // The cutoff glides there on the audio clock, so check where it is heading.
  await page.waitForFunction(() => undertow.record.sampler.filter.frequency.value < 15000, null, { timeout: 10000 }).catch(() => {});
  const closed = await page.evaluate(() => ({ amount: undertow.record.sampler.filterAmount, hz: undertow.record.sampler.filter.frequency.value }));
  check(closed.amount === 0.8 && closed.hz < 15000, `the Filter closes over the pads (heading for ${Math.round(20000 * Math.pow(160 / 20000, closed.amount))} Hz, now ${Math.round(closed.hz)} Hz)`);
  await page.locator('#fx-filter').fill('0');

  // Hold keeps a short pad going for as long as it is held.
  await page.evaluate(() => { undertow.record.slices[8] = { start: 1, end: 1.3, mode: 'hold' }; undertow.record.renderPads(); });
  const pad8 = await page.locator('#sampler [data-slice="8"]').boundingBox();
  await page.mouse.move(pad8.x + pad8.width / 2, pad8.y + pad8.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  check(await page.evaluate(() => undertow.record.sampler.playing('pad-8')), 'a Hold pad keeps playing while held, past the end of its clip');
  await page.mouse.move(pad8.x - 40, pad8.y - 40);
  await page.mouse.up();
  await page.waitForTimeout(100);
  check(await page.evaluate(() => !undertow.record.sampler.playing('pad-8')), 'letting go stops it, even off the pad');

  // Two fingers play two pads at once, and a held Hold pad keeps going.
  await page.evaluate(() => { undertow.record.slices[9] = { start: 1, end: 3 }; undertow.record.slices[10] = { start: 4, end: 4.3, mode: 'hold' }; undertow.record.renderPads(); });
  const cdp = await page.context().newCDPSession(page);
  const centre = async (index, id) => {
    const box = await page.locator(`#sampler [data-slice="${index}"]`).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, id };
  };
  const first = await centre(9, 1);
  const second = await centre(10, 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
  await page.waitForTimeout(600);
  check(await page.evaluate(() => undertow.record.sampler.playing('pad-9') && undertow.record.sampler.playing('pad-10')), 'two fingers play two pads at once');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  check(await page.evaluate(() => !undertow.record.sampler.playing('pad-10')), 'lifting the fingers stops the Hold pad');
  await page.evaluate(() => undertow.record.sampler.stopAll());

  // Banks and Undo.
  await page.click('#pad-banks [data-bank="1"]');
  const bankB = await page.evaluate(() => ({ bank: undertow.record.bank, count: undertow.record.slices.length, length: undertow.record.slices[0].end - undertow.record.slices[0].start, bar: undertow.record.beatLength * 4 }));
  check(bankB.bank === 1 && bankB.count === 16 && Math.abs(bankB.length - bankB.bar) < 0.01, 'bank B has sixteen more pads, a bar each');
  check((await page.textContent('#sampler [data-slice="0"] .number')).startsWith('B1'), 'bank B pads are named B1 to B16');
  await page.click('#sampler [data-slice="0"]');
  check(await page.evaluate(() => undertow.record.sampler.playing('pad-B0')), 'a bank B pad plays');
  const beforeCut = await page.evaluate(() => JSON.stringify(undertow.record.slices));
  await page.selectOption('#rec-cut', 'beat');
  check(await page.evaluate(before => JSON.stringify(undertow.record.slices) !== before, beforeCut), 'Cut Pads recuts the bank');
  await page.click('#pad-undo');
  check(await page.evaluate(before => JSON.stringify(undertow.record.slices) === before, beforeCut), 'Undo brings the pads back');
  await page.click('#pad-banks [data-bank="0"]');
  check(await page.evaluate(() => undertow.record.bank === 0 && undertow.record.slices[0].mode === 'loop'), 'bank A is just as it was');

  // Zoom, volume and fade while editing.
  await page.evaluate(() => undertow.record.sampler.stopAll());
  await page.click('#pad-edit');
  await page.click('#sampler [data-slice="1"]');
  const zoom = await page.evaluate(() => ({ range: undertow.record.range, slice: undertow.record.slices[1], duration: undertow.record.duration }));
  check(zoom.range.to - zoom.range.from < zoom.duration && zoom.range.from <= zoom.slice.start && zoom.range.to >= zoom.slice.end, `the waveform zooms in on the pad being edited (${zoom.range.from.toFixed(1)}-${zoom.range.to.toFixed(1)} s)`);
  check(await page.isVisible('#wave-zoom') && (await page.textContent('#wave-zoom')) === 'Whole Song', 'a Whole Song button shows while editing');
  await page.click('#wave-zoom');
  const wholeSong = await page.evaluate(() => undertow.record.range);
  check(wholeSong.from === 0 && Math.abs(wholeSong.to - 12) < 0.05 && (await page.textContent('#wave-zoom')) === 'Zoom In', 'Whole Song zooms the waveform out to the whole song');
  const full = await page.locator('#record-wave').boundingBox();
  await page.mouse.move(full.x + full.width * 0.5, full.y + 30);
  await page.mouse.down();
  await page.mouse.move(full.x + full.width * 0.7, full.y + 30, { steps: 6 });
  await page.mouse.up();
  const moved = await page.evaluate(() => undertow.record.slices[1]);
  check(Math.abs(moved.start - 6) < 0.3 && Math.abs(moved.end - 8.4) < 0.3, `zoomed out, dragging gives the pad any part of the song (${moved.start.toFixed(1)}-${moved.end.toFixed(1)} s)`);
  await page.click('#wave-zoom');
  const closer = await page.evaluate(() => undertow.record.range);
  check(closer.to - closer.from < 12, 'Zoom In goes back to the close-up');
  await page.click('#edit-vol-down');
  await page.click('#edit-vol-down');
  check(await page.evaluate(() => undertow.record.slices[1].volume) === 0.8 && (await page.textContent('#edit-vol')) === '80%', 'a pad can be made quieter');
  await page.selectOption('#edit-fade', '40');
  check(await page.evaluate(() => undertow.record.slices[1].fade) === 40, 'a pad can fade in and out');
  await page.keyboard.press('Meta+z');
  check(!(await page.evaluate(() => undertow.record.slices[1].fade)), 'Command-Z undoes the fade');
  await page.click('#pad-edit');

  // Loops started while another loop plays join on its beat.
  await page.evaluate(() => {
    const r = undertow.record;
    r.slices[11] = { start: 1, end: 1 + r.beatLength * 2, mode: 'loop' };
    r.slices[12] = { start: 5, end: 5 + r.beatLength, mode: 'loop' };
    r.renderPads();
  });
  await page.click('#sampler [data-slice="11"]');
  await page.waitForTimeout(370);
  await page.click('#sampler [data-slice="12"]');
  const synced = await page.evaluate(() => {
    const v = undertow.record.sampler.voices;
    return { gap: v.get('pad-12').started - v.get('pad-11').started, beat: undertow.record.beatLength };
  });
  const beats = synced.gap / synced.beat;
  check(synced.gap > 0.3 && Math.abs(beats - Math.round(beats)) < 0.01, `a second loop starts on the beat of the first (${beats.toFixed(3)} beats later)`);
  await page.evaluate(() => undertow.record.sampler.stopAll());

  // Remix.
  await page.click('#record-view [data-view="remix"]');
  check(await page.$$eval('#remix-grid .cell', cells => cells.length) === 256, 'Remix shows sixteen pads by sixteen steps');
  for (const [row, step] of [[0, 0], [0, 8], [5, 4], [5, 12]]) await page.click(`#remix-grid [data-row="${row}"][data-step="${step}"]`);
  check(await page.$$eval('#remix-grid .cell[aria-pressed="true"]', cells => cells.length) === 4, 'touching squares builds a pattern');
  await page.evaluate(() => {
    window.remixHits = [];
    const play = undertow.record.sampler.play.bind(undertow.record.sampler);
    undertow.record.sampler.play = (key, slice, options) => { window.remixHits.push(key); return play(key, slice, options); };
  });
  await page.click('#remix-play');
  await page.waitForTimeout(1500);
  const hits = await page.evaluate(() => window.remixHits);
  check(hits.includes('pad-0') && hits.includes('pad-5') && !hits.some(h => !['pad-0', 'pad-5'].includes(h)), `the pattern plays its pads in time (${hits.length} hits)`);
  check(await page.$$eval('#remix-grid .cell.now', cells => cells.length) === 16, 'the playing step is lit');
  await page.click('#remix-up');
  check(await page.textContent('#remix-bpm') === '125.5 BPM', 'the pattern starts at the song tempo and can be changed');
  await page.click('#remix-play');
  check(await page.evaluate(() => !undertow.record.remix.playing), 'the pattern stops');
  await page.click('#remix-patterns [data-pattern="1"]');
  check(await page.$$eval('#remix-grid .cell[aria-pressed="true"]', cells => cells.length) === 0, 'pattern B starts empty');
  await page.click('#remix-bank [data-bank="1"]');
  await page.click('#remix-grid [data-row="3"][data-step="0"]');
  check(await page.$$eval('#remix-patterns button.used', b => b.length) === 2, 'patterns with something in them are marked');
  await page.check('#remix-chain');
  await page.locator('#remix-swing').fill('50');
  await page.click('#remix-patterns [data-pattern="0"]');
  await page.evaluate(() => { window.remixHits = []; });
  await page.click('#remix-play');
  await page.waitForTimeout(2600);
  const chained = await page.evaluate(() => window.remixHits);
  await page.click('#remix-play');
  check(chained.includes('pad-0') && chained.includes('pad-B3'), `Chain plays pattern A, then pattern B with bank B's pads (${[...new Set(chained)].join(', ')})`);
  check(await page.evaluate(() => undertow.record.remix.swing) === 0.5, 'Swing can be set');

  // Snap to the beat.
  await page.click('#record-view [data-view="pads"]');
  check(await page.isChecked('#pad-snap'), 'Snap is on by default');
  await page.evaluate(() => { undertow.record.slices[3] = { start: 2.03, end: 3.11 }; });
  await page.selectOption('#rec-cut', 'snap');
  const grid = await page.evaluate(() => {
    const r = undertow.record;
    const unit = r.beatLength / 4;
    return r.slices.map(s => [((s.start - r.gridStart) / unit), ((s.end - s.start) / unit)]);
  });
  const whole = n => Math.abs(n - Math.round(n)) < 0.01;
  check(grid.every(([start, length]) => whole(start) && (whole(length) || length < 1)), 'Snap all pads puts every pad on the sixteenth-note grid');

  // Record a take.
  await page.click('#rec-take');
  check(await page.evaluate(() => undertow.record.recorder.recording), 'Record starts a take');
  await page.waitForTimeout(200);
  await page.click('#sampler [data-slice="4"]');
  await page.waitForTimeout(700);
  await page.click('#rec-take');
  await page.waitForSelector('#dialog[open] audio');
  const take = await page.evaluate(async () => {
    const { listPieces } = await import('./src/records/pieces.js');
    const piece = (await listPieces()).find(p => p.record === undertow.record.track.id);
    return piece && { type: piece.blob.type, seconds: piece.seconds, title: piece.title };
  });
  check(take && take.type === 'audio/wav' && take.seconds > 0.3 && take.seconds < 3, `the take is kept in My Pieces as a WAV (${take && take.seconds.toFixed(2)} s, ${take && take.title})`);
  await page.click('#dialog [data-value="ok"]');
  // Silence every pad and its echo first, so the take really is empty.
  await page.evaluate(() => { undertow.record.sampler.stopAll(); undertow.record.remix.stop(); });
  await page.waitForTimeout(800);
  await page.click('#rec-take');
  await page.click('#rec-take');
  check(await page.evaluate(() => !undertow.record.recorder.recording), 'a take with nothing played is not kept');

  // A record that is not in the song list gets its tempo from the record.
  await page.waitForFunction(() => !document.getElementById('dialog').open);
  await page.click('#record-view [data-view="play"]');
  await page.selectOption('#record-song', '');
  const heard = await page.evaluate(() => ({ estimate: undertow.record.track.sync.estimate, label: document.getElementById('rec-bpm').textContent }));
  await page.selectOption('#record-song', 'everything');
  check(heard.estimate && heard.estimate.bpm >= 70 && heard.estimate.bpm < 140, `the tempo is heard from the record (${heard.estimate && heard.estimate.bpm} BPM, shown as ${heard.label})`);

  // It is all kept on the device.
  await page.waitForTimeout(500);
  await page.reload();
  await page.click('#boot-start');
  await page.waitForFunction(() => window.undertow && !document.getElementById('boot'));
  check(await page.evaluate(() => document.body.dataset.screen) === 'desk', 'OK Computer always starts on the desktop');
  await page.click('#records [data-record]');
  await page.waitForFunction(() => document.body.dataset.screen === 'record' && undertow.record.track, null, { timeout: 15000 });
  const kept = await page.evaluate(() => ({ bpm: undertow.record.track.sync.bpm, slice: undertow.record.slices[0], pattern: undertow.record.remix.patterns[0].steps.flat().filter(Boolean).length, second: undertow.record.remix.patterns[1], chain: undertow.record.remix.chain, banks: undertow.record.banks.filter(Boolean).length }));
  check(kept.bpm === 124.5 && kept.slice.mode === 'loop' && kept.slice.pitch === 1 && kept.pattern === 4, 'the record reopens with its tempo, pads and pattern');
  check(kept.second.bank === 1 && kept.second.steps[3][0] && kept.chain && kept.banks === 2, 'its banks, second pattern and chain are kept too');
  await page.click('#record-close');
  check(await page.$$eval('#records [data-record]', icons => icons.length) === 1, 'the record is on the desktop');
  check(!(await page.isVisible('#records-empty')), 'the empty note goes once there is a record');

  // Save a record to Files and open it again, as on another device.
  await page.click('#records [data-record]');
  await page.waitForFunction(() => document.body.dataset.screen === 'record');
  const original = await page.evaluate(() => ({ id: undertow.record.track.id, slices: undertow.record.slices, pattern: undertow.record.remix.pattern, bpm: undertow.record.track.sync.bpm, songId: undertow.record.track.songId }));
  // Chrome would offer its own folder picker; the test takes the download.
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const downloading = page.waitForEvent('download');
  await page.click('[data-menu="file"]');
  await page.click('.menu button:has-text("Save Record to Files")');
  const download = await downloading;
  const savedPath = path.join(os.tmpdir(), download.suggestedFilename());
  await download.saveAs(savedPath);
  check(download.suggestedFilename() === 'Everything In Its Right Place.okcomputer.json', `Save Record to Files makes one file (${download.suggestedFilename()})`);
  await page.click('#record-close');
  await page.setInputFiles('#record-file', savedPath);
  await page.waitForFunction(() => document.body.dataset.screen === 'record' && undertow.record.track && undertow.desktop.records.length === 2, null, { timeout: 15000 });
  const copy = await page.evaluate(() => ({ id: undertow.record.track.id, slices: undertow.record.slices, pattern: undertow.record.remix.pattern, bpm: undertow.record.track.sync.bpm, songId: undertow.record.track.songId, name: undertow.record.track.name }));
  check(copy.name === 'Everything In Its Right Place' && copy.songId === original.songId && copy.bpm === original.bpm && JSON.stringify(copy.slices) === JSON.stringify(original.slices) && JSON.stringify(copy.pattern) === JSON.stringify(original.pattern), 'loading the saved file brings back the song, its pads, pattern and tempo');
  const picks = await page.$$eval('#record-pick option', options => options.map(o => o.value));
  check(picks.length === 2 && picks.includes(original.id), 'the record menu lists every record');
  await page.selectOption('#record-pick', original.id);
  await page.waitForFunction(id => undertow.record.track.id === id, original.id);
  check(await page.evaluate(() => document.body.dataset.screen === 'record'), 'choosing another record in the menu opens it');
  await page.selectOption('#record-pick', copy.id);
  await page.waitForFunction(id => undertow.record.track.id === id, copy.id);

  // Borrow a pad from another record.
  await page.click('#record-view [data-view="pads"]');
  await page.click('#pad-edit');
  await page.click('#sampler [data-slice="7"]');
  await page.click('#edit-borrow');
  await page.waitForSelector('#dialog[open] .list-box button');
  await page.click(`#dialog .list-box button[data-value="${original.id}"]`);
  await page.waitForSelector('#dialog[open] h3:has-text("Pads of")');
  await page.click('#dialog .list-box button[data-value="0"]');
  await page.waitForFunction(id => undertow.record.slices[7].source === id, original.id);
  check(await page.evaluate(() => undertow.record.sampler.playing('pad-7')) && (await page.textContent('#sampler [data-slice="7"] small')).includes('from Everything'), 'a pad can be borrowed from another record and plays its sound');
  await page.click('#pad-edit');
  await page.click('#record-close');
  await page.evaluate(async id => {
    const { deleteTrack } = await import('./src/records/tracks.js');
    await deleteTrack(id);
    await undertow.desktop.render();
  }, copy.id);
  // Save every record in one file, then bring them all back at once.
  const bundling = page.waitForEvent('download');
  await page.click('[data-menu="file"]');
  await page.click('.menu button:has-text("Save All Records to Files")');
  const bundle = await bundling;
  const bundlePath = path.join(os.tmpdir(), bundle.suggestedFilename());
  await bundle.saveAs(bundlePath);
  check(bundle.suggestedFilename() === 'OK Computer records.okcomputer.json', 'Save All Records to Files makes one file of every record');
  await page.setInputFiles('#record-file', bundlePath);
  await page.waitForFunction(() => undertow.desktop.records.length === 2, null, { timeout: 15000 });
  check(true, 'loading the saved set adds its records to the desktop');
  await page.setInputFiles('#record-file', [testRecord(), savedPath]);
  await page.waitForFunction(() => undertow.desktop.records.length === 4, null, { timeout: 20000 });
  check(await page.$$eval('#records [data-record]', icons => icons.length) === 4, 'several files can be loaded at once');
  check(await page.evaluate(() => document.body.dataset.screen) === 'desk', 'loading several files stays on the desktop');
  await page.evaluate(async keep => {
    const { deleteTrack, listTracks } = await import('./src/records/tracks.js');
    for (const t of await listTracks()) if (t.id !== keep) await deleteTrack(t.id);
    await undertow.desktop.render();
  }, original.id);
  await page.setInputFiles('#record-file', { name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await page.waitForSelector('#dialog[open]');
  check((await page.textContent('#dialog')).includes('not an OK Computer record'), 'a JSON file that is not a record is turned away');
  await page.click('#dialog [data-value="ok"]');

  // Phone and iPad portrait layouts fit.
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(viewport);
    await page.click('#records [data-record]');
    await page.waitForFunction(() => document.body.dataset.screen === 'record');
    const fits = await page.evaluate(() => {
      const win = document.getElementById('record-window').getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && win.right <= innerWidth + 1;
    });
    check(fits, `the record window fits at ${viewport.width}x${viewport.height}`);
    const misses = [];
    for (const view of ['play', 'pads', 'remix']) {
      await page.click(`#record-view [data-view="${view}"]`);
      misses.push(...await balloonMisses(page));
    }
    check(misses.length === 0, `every help balloon in the record points at its control at ${viewport.width}x${viewport.height} ${misses.join(', ')}`);
    await page.click('#record-close');
  }

  // Remove the record.
  await page.click('[data-menu="file"]');
  await page.click('.menu button:has-text("Remove a Record")');
  await page.waitForSelector('#dialog[open] .list-box button');
  await page.click('#dialog .list-box button');
  await page.waitForSelector('#dialog[open] .btn.default:has-text("Remove")');
  await page.click('#dialog .btn.default');
  await page.waitForFunction(() => !document.querySelector('#records [data-record]'));
  check(true, 'a record can be removed');

  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
