// Checks for the Piano: one key per chord on the home row, Wait for Me,
// In Time with its score, Hear It, every song with a keyboard part, and the
// start screen's choice between Pads and Piano.
const { BASE, launch, check } = require('./helpers.cjs');

async function openPiano(browser, viewport = { width: 1180, height: 820 }) {
  const page = await browser.newPage({ viewport, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => message.type() === 'error' && errors.push(message.text()));
  await page.goto(BASE);
  await page.evaluate(() => localStorage.setItem('undertow-desk-v1', JSON.stringify({ settings: { toured: true, learnToured: true, deskToured: true } })));
  await page.reload();
  check(await page.isVisible('#boot-start') && await page.isVisible('#boot-piano'), 'the start screen offers Pads and Piano');
  await page.click('#boot-piano');
  await page.waitForFunction(() => window.undertow && !document.getElementById('boot') && document.body.dataset.screen === 'piano');
  return { page, errors };
}

const state = page => page.evaluate(() => ({ n: undertow.piano.n, sounding: [...undertow.piano.sounding].sort((a, b) => a - b) }));

(async () => {
  const browser = await launch();
  const { page, errors } = await openPiano(browser);
  check(await page.isVisible('#pk-window'), 'Piano on the start screen opens the piano');
  check(await page.textContent('#pk-title') === 'Piano - Pyramid Song', 'it starts on Pyramid Song');

  // Every song with a keyboard part, each chord on its own key.
  const songs = await page.evaluate(async () => {
    const { playableSongs, keymapFor } = await import('./src/keys/keymap.js');
    return playableSongs().map(song => {
      const map = keymapFor(song);
      return { id: song.id, keys: map.keys.map(k => k.label).join(''), order: map.hits.map(h => h.key.label).join('') };
    });
  });
  const ids = songs.map(s => s.id);
  check(['everything', 'karma', 'pyramid', 'codex', 'videotape', 'truelove', 'idioteque', 'motionpicture', 'creep'].every(id => ids.includes(id)), `the songs with keyboard parts are all there (${ids.join(', ')})`);
  check(await page.$$eval('#pk-song option', options => options.length) === songs.length, 'the song menu lists them');
  const pyramid = songs.find(s => s.id === 'pyramid');
  check(pyramid.keys === 'ASD' && pyramid.order === 'ASDSA', `Pyramid Song is A S D S A on the home row (${pyramid.order})`);
  const karma = songs.find(s => s.id === 'karma');
  check(karma.order.startsWith('AASSDDFF'), `Karma Police reads left to right (${karma.order})`);
  check(songs.every(s => s.keys.length >= 2 && s.keys.length <= 20), 'every song fits on the home and top rows');
  const creep = songs.find(s => s.id === 'creep');
  check(creep.keys === 'ASDF' && creep.order === 'AASSDDFF', `Creep is G B C Cm on A S D F (${creep.order})`);
  const pieces = await page.evaluate(async () => {
    const { playableSongs, keymapFor, piecesOf } = await import('./src/keys/keymap.js');
    const karma = playableSongs().find(s => s.id === 'karma');
    const whole = keymapFor(karma, 'whole');
    return {
      pieces: piecesOf(karma).map(p => p.id),
      bars: whole.length / 4,
      sections: whole.sections.map(s => s.name),
      chorus: keymapFor(karma, 'chorus').hits.map(h => h.key.name).filter((n, i, all) => n !== all[i - 1]).join(' '),
      coda: keymapFor(karma, 'coda').keys.map(k => k.name).join(' '),
      wholeKeys: whole.keys.length,
    };
  });
  check(pieces.pieces.join() === 'whole,verse,chorus,coda', `Karma Police offers the whole song or one section (${pieces.pieces})`);
  check(pieces.bars === 77 && pieces.sections[0] === 'Intro' && pieces.sections.includes('Chorus') && pieces.sections.at(-1) === 'Last Chord', `the whole song runs intro, verses, choruses and coda (${pieces.bars} bars)`);
  check(pieces.chorus === 'C D G F♯7 C D G F♯7 C D G Bm/F♯ C Bm D', `the chorus chords follow the chart (${pieces.chorus})`);
  check(pieces.coda === 'Bm D G Eadd9', `the coda is Bm D G Eadd9 (${pieces.coda})`);
  check(await page.$$eval('#pk-keys [data-code]', keys => keys.map(k => k.textContent.replace(/\s+/g, ' ').trim())).then(t => t[0].startsWith('A F#') && t.length === 3), 'the chord keys show their letter and chord');

  // Wait for Me.
  check(await page.textContent('#pk-next-key') === 'A', 'the next key is shown');
  check(await page.$eval('#pk-keys [data-code="KeyA"]', el => el.classList.contains('target')), 'and dotted on screen');
  await page.keyboard.press('KeyD');
  check((await state(page)).n === 0, 'a wrong key plays its chord but the song waits');
  await page.keyboard.press('KeyA');
  let s = await state(page);
  check(s.n === 1 && s.sounding.join() === '30,42,58,61,66', `the right key plays the chord and moves on (${s.sounding})`);
  await page.keyboard.press('KeyS');
  s = await state(page);
  check(s.n === 2 && s.sounding.join() === '31,43,59,62,66', 'the pedal changes with the next chord');
  check(await page.textContent('#pk-next-key') === 'D' && (await page.textContent('#pk-hint')).includes('Press D for A6'), 'the hint says what comes next');
  await page.keyboard.press('Backspace');
  check((await state(page)).n === 1, 'Delete steps back');
  for (const key of ['KeyS', 'KeyD', 'KeyS', 'KeyA']) await page.keyboard.press(key);
  check((await state(page)).n === 5 && await page.textContent('#pk-next-key') === 'A', 'after the last chord it goes round again');

  // Pedal off: a chord lasts as long as its key.
  await page.click('#pk-restart');
  await page.uncheck('#pk-pedal');
  await page.keyboard.down('KeyA');
  check((await state(page)).sounding.length === 5, 'holding a key holds its chord');
  await page.keyboard.up('KeyA');
  check((await state(page)).sounding.length === 0, 'with the pedal up, letting go stops it');
  await page.check('#pk-pedal');

  // Touch the keys on screen.
  await page.tap('#pk-keys [data-code="KeyS"]');
  check((await state(page)).n === 2, 'the chord keys work by touch');

  // Sound.
  await page.waitForFunction(() => undertow.engine.context.state === 'running');
  await page.click('#pk-restart');
  await page.keyboard.press('KeyA');
  let level = 0;
  for (let i = 0; i < 12 && level < 0.005; i++) {
    await page.waitForTimeout(50);
    level = await page.evaluate(() => undertow.engine.meter());
  }
  check(level > 0.005, `the piano sounds (${level.toFixed(4)})`);

  // Karma Police: the bass comes with the first chord of each bar only.
  await page.selectOption('#pk-song', 'karma');
  check(await page.textContent('#pk-title') === 'Piano - Karma Police', 'choosing a song changes the keys');
  await page.keyboard.press('KeyA');
  const first = (await state(page)).sounding;
  await page.keyboard.press('KeyA');
  const second = (await state(page)).sounding;
  check(first.includes(33) && first.includes(45) && !second.includes(33), `each key plays what the part has there: bass and chord, then the chord (${first} / ${second})`);
  check(await page.isVisible('#pk-piece') && await page.inputValue('#pk-piece') === 'whole', 'Karma Police starts on the whole song');
  check((await page.textContent('#pk-hint')).startsWith('Intro.'), 'the hint says which section you are in');
  check(await page.$$eval('#pk-keys [data-code]', keys => keys.length) === 12, 'the whole song needs twelve keys, on the home and top rows');
  await page.selectOption('#pk-piece', 'coda');
  check(await page.$$eval('#pk-keys [data-code]', keys => keys.map(k => k.dataset.code).join()) === 'KeyA,KeyS,KeyD,KeyF', 'one section has its own few keys');
  await page.keyboard.press('KeyA');
  check((await state(page)).sounding.includes(47), 'and plays its first chord, Bm');
  check(await page.evaluate(() => undertow.data.settings.piano.pieces.karma) === 'coda', 'the section is kept for the song');
  await page.selectOption('#pk-piece', 'whole');
  await page.selectOption('#pk-sound', 'epiano');
  check(await page.evaluate(() => undertow.data.settings.piano.sounds.karma) === 'epiano', 'the sound is kept for the song');

  // Hear It.
  await page.selectOption('#pk-song', 'pyramid');
  await page.click('#pk-hear');
  const spb = 60 / 77;
  await page.waitForTimeout((4 + 3) * spb * 1000 + 250);
  s = await state(page);
  check(s.n === 3, `Hear It plays the part in time after a bar of clicks (chord ${s.n} after three beats)`);
  await page.keyboard.press('KeyA');
  check(await page.getAttribute('#pk-hear', 'aria-pressed') === 'false', 'a chord key takes over from Hear It');

  // In Time: press keys when due, miss one, and get a score.
  await page.click('#pk-mode [data-mode="time"]');
  check(await page.isVisible('#pk-go') && !(await page.isVisible('#pk-restart')), 'In Time has a Play button');
  await page.selectOption('#pk-speed', '0.75');
  await page.click('#pk-go');
  const result = await page.evaluate(async () => {
    const piano = undertow.piano;
    const context = undertow.engine.context;
    const wait = time => new Promise(resolve => {
      const step = () => (context.currentTime >= time ? resolve() : requestAnimationFrame(step));
      step();
    });
    const { nth } = await import('./src/keys/keymap.js');
    const codes = [];
    for (let n = 0; n < 5; n++) {
      const { hit, beat } = nth(piano.map, n);
      const due = piano.run.start + beat * piano.run.spb;
      if (n === 2) continue; // miss the third chord
      await wait(due - 0.02);
      piano.press(hit.key.code);
      piano.release(hit.key.code);
      codes.push(hit.key.code);
    }
    await wait(piano.run.start + nth(piano.map, 4).beat * piano.run.spb + 0.1);
    return { results: [...piano.results.values()].slice(0, 5), score: piano.score, speed: piano.run.speed };
  });
  check(result.speed === 0.75, 'In Time plays at the chosen speed');
  check(result.results.join() === 'perfect,perfect,miss,perfect,perfect', `chords pressed on time count, a missed one is crossed (${result.results})`);
  check(result.score && result.score.includes('4 of 5'), `a score each time round (${result.score})`);
  await page.keyboard.press('Space');
  check(await page.evaluate(() => !undertow.piano.run), 'Space stops it');
  check((await page.textContent('#pk-hint')).includes('4 of 5'), 'the score stays on screen');

  // Help and Get Info.
  await page.click('#pk-info');
  const info = await page.textContent('#dialog');
  check(info.includes('not an exact transcription') && info.includes('Melodics'), 'Get Info gives the accuracy and sources');
  await page.click('#dialog [data-value="ok"]');
  await page.click('[data-menu="help"]');
  await page.click('.menu button:has-text("How to Play the Piano")');
  await page.waitForFunction(() => document.getElementById('dialog').open && document.getElementById('dialog').textContent.includes('home row'));
  check(true, 'Help explains how to play');
  await page.click('#dialog [data-value="ok"]');

  // Every help balloon fits, and the whole part fits on the keys.
  for (const viewport of [{ width: 1180, height: 820 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    const misses = await page.evaluate(async () => {
      const { showBalloon, hideBalloon } = await import('./src/ui/balloons.js');
      const wrong = [];
      for (const element of document.querySelectorAll('#piano-screen [data-help]')) {
        const b = element.getBoundingClientRect();
        if (!b.width || !b.height || b.bottom < 24 || b.top > innerHeight) continue;
        const balloon = showBalloon(element, element.dataset.help);
        const r = balloon.getBoundingClientRect();
        if (r.left < 0 || r.right > innerWidth || r.top < 24 || r.bottom > innerHeight) wrong.push(element.id || element.className);
        hideBalloon();
      }
      return wrong;
    });
    check(misses.length === 0, `every help balloon fits at ${viewport.width}x${viewport.height} ${misses.join(', ')}`);
    const fit = await page.evaluate(() => {
      const notes = undertow.piano.map.hits.flatMap(h => h.notes);
      return document.documentElement.scrollWidth <= innerWidth && undertow.piano.keyboard.low <= Math.min(...notes) && undertow.piano.keyboard.high >= Math.max(...notes);
    });
    check(fit, `the whole part fits on the piano at ${viewport.width}x${viewport.height}`);
  }

  // Getting around: the close box, the desktop icon and the apple menu.
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.click('#pk-close');
  await page.waitForFunction(() => document.body.dataset.screen === 'desk');
  check(await page.isVisible('#records-window'), 'closing the piano goes to the desktop');
  await page.click('#desk-icons [data-open="piano"]');
  await page.waitForFunction(() => document.body.dataset.screen === 'piano');
  check(true, 'the Piano icon on the desktop opens it');
  await page.click('[data-menu="undertow"]');
  check(await page.isDisabled('.menu button:has-text("Piano")'), 'Piano in the apple menu is dimmed while it is open');
  await page.click('.menu button:has-text("Desktop")');
  await page.waitForFunction(() => document.body.dataset.screen === 'desk');
  await page.click('[data-menu="undertow"]');
  await page.click('.menu button:has-text("Piano")');
  await page.waitForFunction(() => document.body.dataset.screen === 'piano');
  check(true, 'and the apple menu opens it from anywhere');
  check(await page.evaluate(() => undertow.piano.song.id) === 'pyramid' && await page.evaluate(() => undertow.piano.mode) === 'time', 'it comes back to the song and mode you left');
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await page.close();

  // The old Kid A address sends people to OK Computer.
  const old = await browser.newPage();
  await old.goto(new URL('kid-a/', BASE).href);
  await old.waitForFunction(() => document.getElementById('boot-piano'));
  check(true, 'the old Kid A address opens OK Computer');
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
