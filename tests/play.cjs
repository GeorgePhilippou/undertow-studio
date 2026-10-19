// Checks for the Play screen: the touch-anywhere instrument, the sound
// worlds, the art, recording and switching to Learn.
const { BASE, launch, check } = require('./helpers.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');

// A 20-second test recording: a soft chord that swells, then a pulsing beat.
function testSong() {
  const rate = 22050;
  const samples = new Int16Array(rate * 20);
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const v = t < 10
      ? (0.1 + 0.5 * (t / 10)) * (Math.sin(2 * Math.PI * 220 * t) + 0.6 * Math.sin(2 * Math.PI * 277.2 * t)) / 1.6
      : 0.7 * Math.exp(-((t * 2) % 1) * 8) * Math.sin(2 * Math.PI * 110 * t);
    samples[i] = Math.round(v * 32000);
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
  const file = path.join(os.tmpdir(), 'Undertow test song.wav');
  fs.writeFileSync(file, Buffer.concat([header, Buffer.from(samples.buffer)]));
  return file;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => message.type() === 'error' && errors.push(message.text()));
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem('undertow-desk-v1', JSON.stringify({ settings: { toured: true, deskToured: true } }));
    indexedDB.deleteDatabase('undertow-pieces');
  });
  await page.reload();
  await page.click('#boot-start');
  await page.waitForFunction(() => window.undertow && !document.getElementById('boot'));
  await wait(300);

  const duplicates = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  check(duplicates.length === 0, `every element id is unique ${duplicates.join(', ')}`);
  check(await page.evaluate(() => document.body.dataset.screen) === 'desk', 'Undertow opens on the desktop');
  await page.click('#desk-icons [data-open="play"]');
  await page.waitForFunction(() => document.body.dataset.screen === 'play');
  await wait(300);
  check(true, 'Sound Worlds opens from the desktop');
  check(await page.isVisible('#touch-hint'), 'a first visit says to touch anywhere');
  check(await page.evaluate(() => undertow.play.band.state) === 'playing', 'the band starts playing');

  // Every note on every world's surface belongs to its scale.
  const scales = await page.evaluate(async () => {
    const { WORLDS, surfaceNotes } = await import('./src/play/worlds.js');
    return WORLDS.filter(w => !w.track).map(w => ({ id: w.id, ok: surfaceNotes(w).every(n => w.scale.includes(n % 12)), count: surfaceNotes(w).length }));
  });
  for (const s of scales) check(s.ok && s.count >= 11, `${s.id}: ${s.count} notes, all in the world's scale`);

  // Spy on notes the engine starts.
  await page.evaluate(() => {
    window.started = [];
    const original = undertow.engine.noteOn.bind(undertow.engine);
    undertow.engine.noteOn = (instrument, midi, ...rest) => {
      const voice = original(instrument, midi, ...rest);
      // Only notes you play go to the lead channel; the band has its own.
      if (rest[2] === undertow.engine.channels.get('lead')?.input) window.started.push({ instrument, midi });
      const setPitch = voice.setPitch;
      if (setPitch) voice.setPitch = (m, at) => { window.glides = (window.glides || 0) + 1; return setPitch(m, at); };
      return voice;
    };
  });
  const art = await page.locator('#art').boundingBox();

  // Kid A: one touch, dragged across, glides one singing voice.
  await page.selectOption('#world-select', 'kida');
  await page.evaluate(() => { window.started = []; window.glides = 0; });
  await page.mouse.move(art.x + 60, art.y + 300);
  await page.mouse.down();
  await page.mouse.move(art.x + art.width - 60, art.y + 200, { steps: 25 });
  await page.mouse.up();
  const kida = await page.evaluate(() => ({ leads: window.started.filter(s => s.instrument === 'ondes').length, glides: window.glides }));
  check(kida.leads === 1 && kida.glides >= 8, `Kid A: a drag glides one ondes voice (${kida.glides} glides)`);
  check(await page.isHidden('#touch-hint'), 'the hint goes once you play');

  // In Rainbows: a drag plucks a run of guitar notes, low on the left, high on the right.
  await page.selectOption('#world-select', 'inrainbows');
  await page.evaluate(() => { window.started = []; });
  await page.mouse.move(art.x + 30, art.y + 300);
  await page.mouse.down();
  await page.mouse.move(art.x + art.width - 30, art.y + 300, { steps: 40 });
  await page.mouse.up();
  const run = await page.evaluate(() => window.started.filter(s => s.instrument === 'guitar').map(s => s.midi));
  check(run.length >= 10 && run[0] < run.at(-1), `In Rainbows: a drag plucks ${run.length} rising guitar notes`);
  check(await page.evaluate(() => undertow.play.band.song.id) === 'world-inrainbows', 'the band follows the chosen world');

  // OK Computer through the arrows, played from the computer keyboard.
  await page.click('#world-prev');
  check(await page.evaluate(() => undertow.play.world.id) === 'okcomputer', 'the arrows step through the worlds');
  await page.evaluate(() => { window.started = []; });
  await page.keyboard.down('a');
  await page.keyboard.up('a');
  await page.keyboard.down('d');
  await page.keyboard.up('d');
  check(await page.evaluate(() => window.started.filter(s => s.instrument === 'epiano').length) === 2, 'computer keys play the electric piano');
  await page.keyboard.press('Space');
  check(await page.evaluate(() => undertow.play.band.state) === 'stopped', 'Space stops the band');
  await page.click('#band');
  check(await page.evaluate(() => undertow.play.band.state) === 'playing', 'the Band button starts it again');

  // The art is a live one-bit picture that answers touches.
  const pixels = () => page.evaluate(() => {
    const canvas = document.getElementById('art');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === 0) ink++;
    const grey = [...data].some((v, i) => i % 4 === 0 && v !== 0 && v !== 255);
    return { ink: ink / (data.length / 4), grey };
  });
  const before = await pixels();
  check(before.ink > 0.15 && before.ink < 0.85 && !before.grey, `the picture is pure black and white (${Math.round(before.ink * 100)}% ink)`);
  await page.mouse.click(art.x + art.width / 2, art.y + art.height / 2);
  await wait(250);
  const after = await pixels();
  check(Math.abs(after.ink - before.ink) > 0.002, 'touching sends a ripple through the picture');

  // Recording a piece with picture and sound.
  await page.click('#play-record');
  await wait(400);
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(art.x + 150 + i * 160, art.y + 250);
    await wait(200);
  }
  await page.click('#play-record');
  await page.waitForSelector('#dialog[open] .piece-media', { timeout: 10000 });
  check(await page.evaluate(() => document.querySelector('#dialog .piece-media').tagName) === 'VIDEO', 'Record makes a video of the picture and the sound');
  await page.click('#dialog [data-value="ok"]');
  await page.click('#pieces-button');
  await page.waitForSelector('#dialog[open] .list-box');
  check(await page.$$eval('#dialog .list-box button', rows => rows.length) === 1, 'the piece is kept in My Pieces');
  await page.click('#dialog .list-box button');
  await page.waitForSelector('#dialog[open] .piece-media');
  await page.click('#dialog [data-value="delete"]');
  await page.waitForSelector('#dialog[open] [data-value="ok"]');
  await page.click('#dialog [data-value="ok"]');
  await wait(300);
  const left = await page.evaluate(async () => (await (await import('./src/play/pieces.js')).listPieces()).length);
  check(left === 0, 'a piece can be deleted');

  // Your Song: a recording you own, played by touch.
  await page.evaluate(() => indexedDB.deleteDatabase('undertow-tracks'));
  await page.selectOption('#world-select', 'yoursong');
  check(await page.isVisible('#track-panel'), 'Your Song asks for a song you own');
  await page.setInputFiles('#track-file', testSong());
  await page.waitForFunction(() => undertow.play.track, null, { timeout: 10000 });
  check(await page.evaluate(() => undertow.play.track.name) === 'Undertow test song', 'a loaded song is named from its file');
  check(await page.isHidden('#track-panel'), 'the panel steps aside once a song is loaded');
  const cloud = () => page.evaluate(() => {
    const touch = [...undertow.play.touches.values()][0];
    return { position: touch.cloud.now, grains: touch.cloud.grains };
  });
  await page.mouse.move(art.x + art.width * 0.75, art.y + art.height * 0.95);
  await page.mouse.down();
  const first = await cloud();
  await wait(1000);
  const second = await cloud();
  check(first.position >= 14.9 && first.position < 15.4, `touching three-quarters across starts three-quarters into the song (${first.position.toFixed(2)} s)`);
  const speed = second.position - first.position;
  check(speed > 0.8 && speed < 1.2 && second.grains > 20, `low on the screen the song plays on at its own speed (${speed.toFixed(2)} s in 1 s)`);
  await page.mouse.move(art.x + art.width * 0.25, art.y + 10, { steps: 8 });
  await wait(400);
  const frozenA = await cloud();
  await wait(800);
  const frozenB = await cloud();
  check(Math.abs(frozenA.position - 5) < 0.3 && Math.abs(frozenB.position - frozenA.position) < 0.01, 'sliding to the top freezes that moment into a cloud');
  await page.mouse.up();
  const ink = await page.evaluate(() => {
    const canvas = document.getElementById('art');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const column = x => { let n = 0; for (let y = 0; y < canvas.height; y++) if (data[(y * canvas.width + x) * 4] === 0) n++; return n; };
    return { start: column(Math.floor(canvas.width * 0.05)), loud: column(Math.floor(canvas.width * 0.45)) };
  });
  check(ink.loud > ink.start * 1.3, `the picture draws the song's own shape (${ink.start} -> ${ink.loud} dark pixels)`);
  await page.click('#band');
  check(await page.evaluate(() => undertow.play.trackPlayer.playing) && (await page.textContent('#band')).includes('Song On'), 'the Song button plays the track straight through');
  await page.reload();
  await page.click('#boot-start');
  await page.waitForFunction(() => window.undertow && undertow.play.track, null, { timeout: 10000 });
  check(await page.evaluate(() => document.body.dataset.screen) === 'desk', 'a reload starts on the desktop');
  await page.click('#desk-icons [data-open="play"]');
  await page.waitForFunction(() => document.body.dataset.screen === 'play');
  check(await page.evaluate(() => undertow.play.world.id === 'yoursong' && undertow.play.track.name === 'Undertow test song'), 'the song is still there after a reload');
  await page.click('#track-button');
  await page.waitForSelector('#dialog[open] [data-value="remove"]');
  await page.click('#dialog [data-value="remove"]');
  await page.waitForSelector('#dialog[open] [data-value="ok"]');
  await page.click('#dialog [data-value="ok"]');
  await wait(300);
  check(await page.evaluate(() => undertow.play.track === null) && await page.isVisible('#track-panel'), 'a song can be removed from the device');
  await page.selectOption('#world-select', 'kida');

  // Learn and back.
  await page.click('#to-desk');
  await page.click('#desk-icons [data-open="learn"]');
  await page.waitForSelector('.balloon.tour');
  await page.click('.balloon [data-tour="skip"]');
  check(await page.evaluate(() => document.body.dataset.screen === 'learn' && undertow.play.band.state === 'stopped'), 'Lessons opens the song desk and quiets the band');
  check(await page.isVisible('#song-list'), 'the songs are there in Learn');
  await page.click('#to-desk');
  await page.click('#desk-icons [data-open="play"]');
  await page.waitForFunction(() => document.body.dataset.screen === 'play');
  check(await page.evaluate(() => document.body.dataset.screen === 'play' && undertow.play.band.state === 'playing'), 'Sound Worlds brings the band back');

  // Layouts.
  for (const [width, height] of [[390, 844], [820, 1180], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await wait(200);
    const fits = await page.evaluate(() => {
      const strip = document.getElementById('strip').getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && strip.bottom <= innerHeight + 1;
    });
    check(fits, `the Play screen fits at ${width}x${height}`);
  }

  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
