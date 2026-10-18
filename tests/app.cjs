// Behaviour checks for the Undertow desk in Chromium with touch emulation.
// Run with a server at the repository root:  python3 -m http.server 8000
const { BASE, launch, openApp, check } = require('./helpers.cjs');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function pressPad(page, index) {
  const box = await page.locator('#pads .pad').nth(index).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await wait(120);
  await page.mouse.up();
}

(async () => {
  const browser = await launch();
  const { page, errors } = await openApp(browser);
  const state = () => page.evaluate(() => ({
    song: undertow.song.id,
    state: undertow.player.state,
    beat: undertow.player.beat,
    holding: undertow.player.holding,
    target: undertow.player.waitTarget?.chord,
  }));

  // Songs.
  const ids = await page.$$eval('#song-list [data-song]', buttons => buttons.map(b => b.dataset.song));
  check(ids.join() === 'everything,idioteque,karma,pyramid,codex', 'five songs are listed in order');
  for (const id of ids) {
    await page.click(`[data-song="${id}"]`);
    const title = await page.textContent('#song-title');
    check((await state()).song === id && title.length > 0, `${title} opens`);
  }

  // Listening.
  await page.click('[data-song="karma"]');
  await page.click('#play');
  await wait(1200);
  let now = await state();
  check(now.state === 'playing' && now.beat > 0.5, 'Play starts the song immediately in Listen mode');
  check(await page.$$eval('#piano .sounding', keys => keys.length) > 0, 'the keyboard shows the notes being played');
  await page.click('#stop');
  check((await state()).state === 'stopped', 'Stop stops');

  // Wait for Me on chord pads.
  await page.click('[data-song="idioteque"]');
  await page.click('input[value="wait"]');
  await page.click('[data-tab="chords"]');
  check(await page.$$eval('#pads .pad', pads => pads.length) === 4, 'Idioteque shows four chord pads');
  await page.click('#play');
  await page.waitForFunction(() => undertow.player.holding, null, { timeout: 6000 });
  now = await state();
  check(now.holding && now.target === 'E♭maj7 i', 'Wait for Me stops at the first chord');
  await pressPad(page, 2);
  await wait(200);
  check((await state()).holding, 'a wrong chord does not move the song on');
  await pressPad(page, 0);
  await wait(300);
  now = await state();
  check(!now.holding && now.target === 'E♭maj7 ii', 'the right chord moves the song on to the next one');
  await page.click('#stop');

  // Play Along scoring after one time round, at the fastest speed.
  await page.click('[data-song="everything"]');
  await page.click('input[value="along"]');
  await page.click('#faster');
  await page.click('#faster');
  await page.click('#play');
  await page.waitForFunction(() => document.getElementById('score').textContent.includes('notes'), null, { timeout: 15000 });
  check(/0 of \d+ notes/.test(await page.textContent('#score')), 'Play Along reports a score after each time round');
  await page.click('#stop');
  await page.click('#slower');
  await page.click('#slower');
  await page.click('input[value="listen"]');

  // Recording with the computer keyboard, then Use as Part and Undo.
  await page.click('[data-song="pyramid"]');
  await page.click('[data-tab="keys"]');
  const originalEvents = await page.evaluate(() => undertow.song.parts[0].events.length);
  await page.click('#record');
  await page.waitForFunction(() => undertow.player.beat > 0.2, null, { timeout: 8000 });
  for (const key of ['a', 'f', 'h']) await page.keyboard.down(key);
  await wait(400);
  for (const key of ['a', 'f', 'h']) await page.keyboard.up(key);
  await wait(300);
  await page.keyboard.press('r');
  await wait(300);
  const takes = await page.evaluate(() => undertow.data.takes.pyramid || []);
  check(takes.length === 1 && takes[0].events.length === 3, 'Record captures three notes as a take');
  check(await page.isVisible('#takes-window'), 'the Takes window opens after recording');
  await page.click('#take-use');
  await page.click('#dialog [data-value="ok"]');
  await wait(200);
  check(await page.evaluate(() => undertow.song.parts[0].events.length) === 3, 'Use as Part replaces the written part');
  await page.keyboard.press('Control+z');
  await wait(200);
  check(await page.evaluate(() => undertow.song.parts[0].events.length) === originalEvents, 'Undo restores the original part');
  await page.click('#takes-window [data-close]');

  // Drum machine edits are kept.
  await page.click('[data-song="karma"]');
  await page.click('#open-drums');
  const before = await page.evaluate(() => undertow.song.parts[1].events.length);
  await page.click('#drum-grid [data-voice="clap"][data-step="12"]');
  check(await page.evaluate(() => undertow.song.parts[1].events.length) === before + 1, 'a drum square adds a hit');
  await page.reload();
  await page.click('#boot-start');
  await page.waitForFunction(() => window.undertow && !document.getElementById('boot'));
  check(await page.evaluate(() => undertow.song.id === 'karma' && undertow.song.parts[1].events.length) === before + 1, 'drum edits survive a reload');

  // Menus and dialogs.
  await page.click('[data-menu="song"]');
  check(await page.isVisible('.menu'), 'the Song menu opens');
  await page.click('.menu button:has-text("Get Info")');
  await page.waitForSelector('#dialog[open]');
  check((await page.textContent('#dialog')).includes('Sources'), 'Get Info lists the sources');
  await page.click('#dialog [data-value="ok"]');
  await page.click('[data-menu="edit"]');
  await page.click('.menu button:has-text("Revert to Original")');
  await page.waitForSelector('#dialog[open]');
  await page.click('#dialog [data-value="ok"]');
  check(await page.evaluate(() => undertow.song.parts[1].events.length) === before, 'Revert to Original removes edits');

  // New song.
  await page.click('#new-song');
  await page.fill('#ns-title', 'Test Loop');
  await page.click('#dialog button[type="submit"]');
  await wait(200);
  check(await page.evaluate(() => undertow.song.custom && undertow.song.title === 'Test Loop'), 'New Song creates and opens a song');
  check(await page.isVisible('#song-list .heading'), 'My Songs appear in the list');

  // WAV export.
  await page.click('[data-song="pyramid"]');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    (async () => {
      await page.click('[data-menu="file"]');
      await page.click('.menu button:has-text("Save Loop as WAV")');
    })(),
  ]);
  check(download.suggestedFilename() === 'Pyramid Song.wav', 'Save Loop as WAV downloads a file');

  // Looping a section by dragging across bar numbers.
  await page.click('[data-song="karma"]');
  let roll = await page.locator('#roll').boundingBox();
  await page.mouse.move(roll.x + roll.width * 0.3, roll.y + 10);
  await page.mouse.down();
  await page.mouse.move(roll.x + roll.width * 0.6, roll.y + 10, { steps: 4 });
  await page.mouse.up();
  check(await page.evaluate(() => JSON.stringify(undertow.player.section)) === '{"start":4,"end":12}', 'dragging across bars 2-3 loops them');
  await page.click('#play');
  await page.waitForFunction(() => undertow.player.beat > 9, null, { timeout: 12000 });
  const counter = await page.textContent('#counter');
  check(/^[23] :/.test(counter), `playback stays inside the looped bars (${counter})`);
  await page.click('#stop');
  await page.click('#loop-all');
  check(await page.evaluate(() => undertow.player.section) === null, 'Loop All returns to the whole passage');

  // Pencil and Eraser.
  await page.click('[data-tool="pencil"]');
  roll = await page.locator('#roll').boundingBox();
  const count = () => page.evaluate(() => undertow.song.parts[0].events.reduce((n, e) => n + e.notes.length, 0));
  const beforePencil = await count();
  await page.mouse.click(roll.x + roll.width * 0.86, roll.y + roll.height * 0.3);
  check(await count() === beforePencil + 1, 'the Pencil adds a note');
  await page.mouse.click(roll.x + roll.width * 0.86, roll.y + roll.height * 0.3);
  check(await count() === beforePencil, 'the Pencil on a note removes it');
  await page.click('[data-tool="eraser"]');
  await page.mouse.move(roll.x + 40, roll.y + roll.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(roll.x + roll.width - 20, roll.y + roll.height * 0.25, { steps: 30 });
  await page.mouse.up();
  check(await count() < beforePencil, 'the Eraser rubs out notes');
  await page.keyboard.press('Control+z');
  await wait(100);
  check(await count() === beforePencil, 'Undo brings erased notes back');
  await page.click('[data-tool="arrow"]');

  // Perfect Play Along: ticks in the roll, best score in the list.
  await page.click('[data-song="pyramid"]');
  await page.click('input[value="along"]');
  await page.click('[data-tab="chords"]');
  await page.click('#play');
  const pass = await page.evaluate(() => new Promise(resolve => {
    const p = undertow.player;
    const done = new Set();
    p.on('pass', resolve);
    const loop = () => {
      const beat = p.beatAt(p.context.currentTime);
      for (const t of p.targets) {
        if (!done.has(t.beat) && beat >= t.beat - 0.05 && beat < t.beat + 0.2) {
          done.add(t.beat);
          const pad = undertow.keyboard.pads.find(x => x.name === t.chord);
          p.chordOn(pad, 0.7);
          setTimeout(() => pad.notes.forEach(n => p.noteOff(n)), 100);
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  }));
  check(pass.hit === pass.total, `playing every chord on time scores ${pass.hit} of ${pass.total}`);
  check(await page.evaluate(() => [...undertow.player.marks.values()].every(m => m === 'hit')), 'every chord gets a tick');
  check((await page.textContent('[data-song="pyramid"]')).includes('Best 100%'), 'the best score shows in the Songs list');
  await page.click('#stop');
  await page.click('input[value="listen"]');

  // Balloon Help.
  await page.click('[data-menu="help"]');
  await page.click('.menu button:has-text("Show Balloons")');
  await page.waitForSelector('.menu', { state: 'detached' });
  await page.hover('#record');
  check((await page.textContent('.balloon')).includes('Record yourself'), 'Balloon Help explains the control under the pointer');
  await page.click('[data-menu="help"]');
  await page.click('.menu button:has-text("Hide Balloons")');
  await page.waitForSelector('.menu', { state: 'detached' });
  await page.mouse.move(5, 300);

  // Layouts.
  for (const [width, height] of [[390, 844], [820, 1180], [1024, 768], [1180, 820]]) {
    await page.setViewportSize({ width, height });
    await wait(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `no sideways scrolling at ${width}×${height}`);
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await wait(200);
  const pianoBottom = await page.evaluate(() => document.getElementById('piano').getBoundingClientRect().bottom);
  check(pianoBottom <= 768, 'the whole keyboard fits on a 1024×768 iPad screen');

  // A first visit starts the guided tour.
  const fresh = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await fresh.goto(BASE);
  await fresh.evaluate(() => localStorage.clear());
  await fresh.reload();
  await fresh.click('#boot-start');
  await fresh.waitForSelector('.balloon.tour');
  check((await fresh.textContent('.balloon')).includes('1 of 7'), 'a first visit starts the tour');
  for (let i = 0; i < 7; i++) await fresh.click('.balloon [data-tour="next"]');
  check(await fresh.evaluate(() => undertow.data.settings.toured === true && !document.querySelector('.balloon')), 'finishing the tour remembers it');
  check(await fresh.evaluate(() => navigator.serviceWorker.getRegistration().then(r => Boolean(r))), 'the offline service worker registers');
  await fresh.close();

  // The classic app still opens for older projects.
  const classic = await browser.newPage();
  const classicErrors = [];
  classic.on('pageerror', error => classicErrors.push(error.message));
  await classic.goto(`${BASE}classic/`);
  await wait(800);
  check(classicErrors.length === 0 && (await classic.title()).includes('Undertow'), 'Undertow Classic still opens');

  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
