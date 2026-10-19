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
  check(await page.isVisible('#records-window'), 'the desktop shows the Records window');
  check(await page.isVisible('#desk-icons [data-open="play"]') && await page.isVisible('#desk-icons [data-open="learn"]'), 'the desktop has Sound Worlds and Lessons icons');
  check(await page.isVisible('#records-empty'), 'an empty desktop explains how to load a record');
  check(!(await page.isVisible('#to-desk')), 'the Desktop button is hidden on the desktop');

  await page.click('#desk-icons [data-open="learn"]');
  await page.waitForFunction(() => document.body.dataset.screen === 'learn');
  check(await page.isVisible('#songs-window') && await page.isVisible('#to-desk'), 'Lessons opens the song desk with a way back');
  await page.click('#to-desk');
  await page.click('#desk-icons [data-open="play"]');
  await page.waitForFunction(() => document.body.dataset.screen === 'play');
  check(await page.isVisible('#art'), 'Sound Worlds opens the touch screen');
  await page.click('#to-desk');

  // Load a record.
  await page.setInputFiles('#record-file', testRecord());
  await page.waitForFunction(() => document.body.dataset.screen === 'record', null, { timeout: 15000 });
  check(await page.textContent('#record-title') === 'Everything In Its Right Place', 'the record opens with a title from its file name');
  check(await page.inputValue('#record-song') === 'everything', 'the song is recognised from the file name');
  const start = await page.evaluate(() => undertow.record.track.sync.start);
  check(Math.abs(start - 0.48) < 0.06, `the chords start where the music starts (${start.toFixed(2)} s)`);

  // Riffs: tap through the opening keyboard figure.
  check(await page.evaluate(() => document.getElementById('record-window').dataset.view) === 'riffs' && await page.isVisible('#riff-tap'), 'a known song opens on its riff');
  check(await page.textContent('#riff-title') === 'The opening keyboard figure', 'the riff is named');
  const riff = await page.evaluate(() => ({ hits: undertow.record.riffs.riff.hits.length, first: undertow.record.riffs.sliceOf(0), second: undertow.record.riffs.sliceOf(1) }));
  const beat = 60 / 124;
  check(riff.hits === 15 && Math.abs(riff.first.start - start) < 0.001 && Math.abs(riff.second.start - (start + 0.75 * beat)) < 0.001, `each hit is cut from the record in time (${riff.hits} hits)`);
  const targets = await page.$$eval('#along-piano .target', keys => keys.map(k => Number(k.dataset.midi)).sort((a, b) => a - b));
  check(targets.join() === '36,52,55,60', `the keys show the first hit (${targets.join(' ')})`);
  await page.click('#riff-tap');
  check(await page.evaluate(() => undertow.record.riffs.index === 1 && undertow.record.riffs.sampler.playing('riff')), 'tapping plays the first hit from the record and moves on');
  await page.keyboard.press(' ');
  check(await page.evaluate(() => undertow.record.riffs.index) === 2, 'Space taps too');
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
  await page.click('#record-view [data-view="along"]');
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
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => undertow.record.sampler.filter.frequency.value);
  check(closed < 5000, `the Filter closes over the pads (${Math.round(closed)} Hz)`);
  await page.locator('#fx-filter').fill('0');

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

  // It is all kept on the device.
  await page.waitForTimeout(500);
  await page.reload();
  await page.click('#boot-start');
  await page.waitForFunction(() => window.undertow && !document.getElementById('boot'));
  check(await page.evaluate(() => document.body.dataset.screen) === 'desk', 'Undertow always starts on the desktop');
  await page.click('#records [data-record]');
  await page.waitForFunction(() => document.body.dataset.screen === 'record' && undertow.record.track, null, { timeout: 15000 });
  const kept = await page.evaluate(() => ({ bpm: undertow.record.track.sync.bpm, slice: undertow.record.slices[0], pattern: undertow.record.remix.pattern.flat().filter(Boolean).length }));
  check(kept.bpm === 124.5 && kept.slice.mode === 'loop' && kept.slice.pitch === 1 && kept.pattern === 4, 'the record reopens with its tempo, pads and pattern');
  await page.click('#record-close');
  check(await page.$$eval('#records [data-record]', icons => icons.length) === 1, 'the record is on the desktop');
  check(!(await page.isVisible('#records-empty')), 'the empty note goes once there is a record');

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
    for (const view of ['riffs', 'pads', 'remix', 'along']) {
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
