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
  check((await page.textContent('#dialog')).includes('Sources'), 'Get Info lists the sources');
  await page.click('#dialog [data-value="ok"]');
  await page.click('[data-menu="edit"]');
  await page.click('.menu button:has-text("Revert to Original")');
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
