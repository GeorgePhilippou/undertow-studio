// Checks for Kid A, the piano app: tapping along to Pyramid Song from the
// computer keyboard, the two hands, the pedal, Hear It, playing along with a
// record loaded in OK Computer, and getting there from the OK Computer desktop.
const { BASE, launch, openApp, check } = require('./helpers.cjs');

const KIDA = new URL('kid-a/', BASE).href;

async function openKidA(browser, viewport = { width: 1180, height: 820 }) {
  const page = await browser.newPage({ viewport, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => message.type() === 'error' && errors.push(message.text()));
  await page.goto(KIDA);
  await page.evaluate(() => localStorage.removeItem('kid-a-v1'));
  await page.reload();
  await page.click('#boot-start');
  await page.waitForFunction(() => window.kida && !document.getElementById('boot'));
  return { page, errors };
}

const state = page => page.evaluate(() => ({ index: kida.tap.index, round: kida.tap.round, played: { ...kida.tap.played }, sounding: [...kida.sounding].sort((a, b) => a - b) }));

(async () => {
  const browser = await launch();
  const { page, errors } = await openKidA(browser);

  const duplicates = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  check(duplicates.length === 0, `every element id is unique ${duplicates.join(', ')}`);
  check(await page.textContent('#kida-title') === 'Pyramid Song', 'Kid A opens on Pyramid Song');

  // The part, split into hands.
  const hits = await page.evaluate(() => kida.tap.hits.map(h => ({ chord: h.chord, left: h.left, right: h.right, eighths: Math.round(h.gap * 2) })));
  check(hits.length === 5 && hits.map(h => h.eighths).join('+') === '3+3+4+3+3', `the part is five chords grouped 3+3+4+3+3 (${hits.map(h => h.eighths).join('+')})`);
  check(hits[0].left.join() === '30,42' && hits[0].right.join() === '58,61,66', `the left hand plays the bass octave, the right hand the chord (${hits[0].left} | ${hits[0].right})`);
  check(hits.every(h => h.right.includes(66)), 'F# rings on top of every chord');
  const shown = await page.evaluate(() => [kida.keyboard.low, kida.keyboard.high]);
  check(shown[0] <= 30 && shown[1] >= 66 && shown[1] - shown[0] < 48, `the piano shows every note of the part and not much more (${shown})`);

  // Left and right hands from the keyboard.
  await page.keyboard.press('KeyF');
  let s = await state(page);
  check(s.index === 0 && s.played.left && !s.played.right && s.sounding.join() === '30,42', 'a key on the left plays the bass of the first chord');
  await page.keyboard.press('KeyJ');
  s = await state(page);
  check(s.index === 1 && s.sounding.join() === '30,42,58,61,66', 'a key on the right plays the chord on top and moves on');
  check(await page.textContent('#kida-chord') === 'Gmaj7', 'the next chord is shown');
  check(await page.$eval('#kida-piano [data-midi="31"]', key => key.classList.contains('target')), 'the next chord is dotted on the piano');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyS');
  s = await state(page);
  check(s.index === 2 && s.played.left && s.sounding.includes(33) && !s.sounding.includes(31), 'one hand pressed twice moves on without the other, and the pedal changes with each chord');
  await page.keyboard.press('Space');
  s = await state(page);
  check(s.index === 3 && s.sounding.join() === '33,45,61,64,66', `after one hand, Space plays the rest of the chord (${s.sounding})`);
  await page.keyboard.press('Space');
  s = await state(page);
  check(s.index === 4 && s.sounding.join() === '31,43,59,62,66', `Space plays both hands of the next chord (${s.sounding})`);
  await page.keyboard.press('Backspace');
  check((await state(page)).index === 3, 'Delete steps back a chord');
  for (const key of ['Space', 'Space']) await page.keyboard.press(key);
  s = await state(page);
  check(s.index === 0 && s.round === 2, 'after the last chord it goes round again');
  check((await page.textContent('#kida-count')).includes('time 2'), 'the count shows the time round');

  // Loudness by row.
  const loud = await page.evaluate(async () => {
    const { keyFor } = await import('./tapalong.js');
    return ['Digit3', 'KeyE', 'KeyD', 'KeyC', 'KeyK', 'Comma'].map(code => keyFor(code));
  });
  check(loud[0].velocity > loud[1].velocity && loud[1].velocity > loud[2].velocity && loud[2].velocity > loud[3].velocity, 'the number row plays loudest and the bottom row softest');
  check(loud[4].hand === 'right' && loud[5].hand === 'right' && loud[2].hand === 'left', 'keys are split between the hands down the middle');

  // Pedal off: notes stop when the key is let go.
  await page.click('#kida-restart');
  await page.uncheck('#kida-pedal');
  await page.keyboard.down('KeyD');
  check((await state(page)).sounding.join() === '30,42', 'holding a key holds the bass');
  await page.keyboard.up('KeyD');
  check((await state(page)).sounding.length === 0, 'with the pedal up, letting go stops it');
  await page.check('#kida-pedal');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('kid-a-v1')).pedal) === true, 'the pedal setting is kept');

  // Touch the hand pads.
  await page.click('#kida-restart');
  await page.tap('#hand-left');
  await page.tap('#hand-right');
  check((await state(page)).index === 1, 'the hand pads play by touch');

  // The strip.
  const box = await page.$eval('#kida-strip', el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await page.mouse.click(box.x + box.w * 0.5, box.y + box.h / 2);
  check((await state(page)).index === 2, 'touching a chord in the strip goes there');

  // Sound.
  await page.waitForFunction(() => kida.engine.context.state === 'running');
  await page.keyboard.press('Space');
  let level = 0;
  for (let i = 0; i < 10 && level < 0.005; i++) {
    await page.waitForTimeout(50);
    level = await page.evaluate(() => kida.engine.meter());
  }
  check(level > 0.005, `the piano sounds (${level.toFixed(4)})`);

  // Hear It plays the part in time: 77 BPM, the third chord on beat 3.
  await page.click('#kida-hear');
  await page.waitForTimeout(60 / 77 * 3 * 1000 + 300);
  s = await state(page);
  check(s.index === 3, `Hear It plays the part in time (chord ${s.index + 1} after three beats)`);
  await page.keyboard.press('KeyF');
  check(await page.getAttribute('#kida-hear', 'aria-pressed') === 'false', 'pressing a key takes over from Hear It');

  // Get Info says what is checked and what is a reconstruction.
  await page.click('#kida-info');
  const info = await page.textContent('#dialog');
  check(info.includes('published breakdowns') && info.includes('not an exact transcription') && info.includes('Melodics'), 'Get Info gives the accuracy and sources');
  await page.click('#dialog [data-value="ok"]');

  // Balloons point at their controls.
  for (const viewport of [{ width: 1180, height: 820 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    const misses = await page.evaluate(async () => {
      const { showBalloon, hideBalloon } = await import('../src/ui/balloons.js');
      const wrong = [];
      for (const element of document.querySelectorAll('[data-help]')) {
        const b = element.getBoundingClientRect();
        if (!b.width || !b.height || b.bottom < 24 || b.top > innerHeight) continue;
        const balloon = showBalloon(element, element.dataset.help);
        const r = balloon.getBoundingClientRect();
        if (r.left < 0 || r.right > innerWidth || r.top < 24 || r.bottom > innerHeight) wrong.push(element.id || element.className);
        hideBalloon();
      }
      return wrong;
    });
    check(misses.length === 0, `every help balloon fits on screen at ${viewport.width}x${viewport.height} ${misses.join(', ')}`);
    const fit = await page.evaluate(() => {
      const piano = document.getElementById('kida-piano').getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && piano.width > 0 && kida.keyboard.low <= 30 && kida.keyboard.high >= 66;
    });
    check(fit, `the whole part fits on the piano at ${viewport.width}x${viewport.height}`);
  }
  check(errors.length === 0, `no page errors in Kid A (${errors.join('; ')})`);
  await page.close();

  // From OK Computer: the desktop icon and the start screen open Kid A, and
  // a record loaded there plays along underneath.
  const okc = await openApp(browser);
  await okc.page.evaluate(() => undertow.setScreen('desk'));
  await okc.page.evaluate(async () => {
    const { saveTrack } = await import('./src/records/tracks.js');
    const rate = 8000;
    const samples = new Int16Array(rate * 2);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.round(Math.sin(i / 4) * 8000);
    const header = new DataView(new ArrayBuffer(44));
    const text = (at, value) => [...value].forEach((c, i) => header.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF'); header.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVEfmt ');
    header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true);
    header.setUint32(24, rate, true); header.setUint32(28, rate * 2, true); header.setUint16(32, 2, true); header.setUint16(34, 16, true);
    text(36, 'data'); header.setUint32(40, samples.length * 2, true);
    const blob = new Blob([header.buffer, samples.buffer], { type: 'audio/wav' });
    await saveTrack({ id: 'test-pyramid', name: 'Pyramid Song', added: new Date().toISOString(), seconds: 2, songId: 'pyramid', blob });
  });
  await okc.page.click('#desk-icons [data-open="kid-a"]');
  await okc.page.waitForURL(/kid-a\/$/);
  check(true, 'the Kid A icon on the OK Computer desktop opens Kid A');
  await okc.page.click('#boot-start');
  await okc.page.waitForFunction(() => window.kida && document.getElementById('kida-record').value === 'test-pyramid', null, { timeout: 5000 });
  check(true, 'a Pyramid Song record from OK Computer is chosen to play along with');
  await okc.page.waitForFunction(() => !document.getElementById('kida-play').disabled);
  await okc.page.click('#kida-play');
  await okc.page.waitForFunction(() => !kida.audio.paused && document.getElementById('kida-play').textContent === 'Stop');
  check(await okc.page.textContent('#kida-play') === 'Stop', 'the record plays underneath');
  await okc.page.keyboard.press('Enter');
  check(await okc.page.evaluate(() => kida.audio.paused), 'Return stops it');
  await okc.page.click('[data-menu="kida"]');
  await okc.page.click('.menu button:has-text("OK Computer")');
  await okc.page.waitForFunction(() => document.getElementById('boot-kida'));
  check(true, 'the apple menu goes back to OK Computer');
  await okc.page.click('#boot-kida');
  await okc.page.waitForURL(/kid-a\/$/);
  check(true, 'the OK Computer start screen opens Kid A too');
  await okc.page.evaluate(async () => {
    const { deleteTrack } = await import('../src/records/tracks.js');
    await deleteTrack('test-pyramid');
  });
  check(okc.errors.length === 0, `no page errors (${okc.errors.join('; ')})`);
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
