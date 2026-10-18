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
  check(ids.join() === 'everything,idioteque,karma,pyramid,codex,videotape,truelove,motionpicture', 'eight checked songs are listed in order');
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
  await page.click('[data-step="2"]');
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
  await page.click('[data-step="4"]');
  await page.click('#faster');
  await page.click('#faster');
  await page.click('#play');
  await page.waitForFunction(() => document.getElementById('score').textContent.includes('notes'), null, { timeout: 15000 });
  check(/0 of \d+ notes/.test(await page.textContent('#score')), 'Play Along reports a score after each time round');
  await page.click('#stop');
  await page.click('#slower');
  await page.click('#slower');
  await page.click('[data-step="1"]');

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
  await page.click('[data-step="4"]');
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
  await page.click('[data-step="1"]');

  // Lesson steps: the perfect full-speed pass above ticks off steps 3 and 4.
  check(await page.evaluate(() => JSON.stringify(undertow.data.progress.pyramid?.slice(3, 5))) === '[true,true]', 'a good full-speed pass ticks off steps 3 and 4');
  check(await page.$$eval('#steps .done', buttons => buttons.map(b => b.dataset.step).join()) === '3,4,5', 'ticked steps (including the take recorded earlier) show in the lesson strip');
  check(await page.$$eval('[data-song="pyramid"] .progress i.on', boxes => boxes.length) === 3, 'the Songs list shows lesson progress');
  await page.click('[data-step="1"]');
  await page.click('#faster');
  await page.click('#faster');
  await page.click('#play');
  await page.waitForFunction(() => undertow.data.progress.pyramid?.[1], null, { timeout: 12000 });
  check(true, 'listening all the way round ticks off step 1');
  await page.click('#stop');
  await page.click('#slower');
  await page.click('#slower');
  await page.click('[data-step="2"]');
  check(await page.evaluate(() => undertow.player.mode) === 'wait', 'step 2 switches to Wait for Me');
  await page.click('#play');
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(() => undertow.player.holding, null, { timeout: 8000 });
    const chord = await page.evaluate(() => undertow.player.waitTarget.chord);
    const index = await page.evaluate(name => undertow.keyboard.pads.findIndex(p => p.name === name), chord);
    await pressPad(page, index);
  }
  await page.waitForFunction(() => undertow.data.progress.pyramid?.[2], null, { timeout: 4000 });
  check(true, 'playing every chord in Wait for Me ticks off step 2');
  await page.click('#stop');
  await page.click('[data-step="3"]');
  check(await page.textContent('#tempo') === '75% (58)', 'step 3 slows the song to 75%');
  await page.click('[data-step="1"]');
  await page.click('[data-tab="keys"]');

  // Drum machine on a song with no drums.
  await page.click('[data-song="codex"]');
  check((await page.textContent('#open-drums')).startsWith('Add Drums'), 'songs without drums offer Add Drums');
  await page.click('#open-drums');
  const covers = await page.evaluate(() => {
    const a = document.getElementById('drum-window').getBoundingClientRect();
    const b = document.getElementById('play').getBoundingClientRect();
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  });
  check(!covers, 'the Drum Machine does not cover the Play button');
  await page.click('#add-drums');
  check(await page.evaluate(() => undertow.song.parts.some(p => p.id === 'drums' && p.kind === 'drums')), 'Add Drums gives the song a drum part');
  await page.selectOption('#beat-preset', 'backbeat');
  check(await page.evaluate(() => undertow.song.parts.find(p => p.id === 'drums').events.length) === 48, 'a ready-made beat fills the grid across the loop (8 kicks, 8 snares, 32 hats)');
  check(await page.textContent('#drum-page') === 'Beats 1-4 of 16', 'the grid is labelled in beats');
  await page.evaluate(() => {
    window.drumHits = 0;
    const original = undertow.engine.drum.bind(undertow.engine);
    undertow.engine.drum = (...args) => { window.drumHits++; return original(...args); };
  });
  await page.click('#drum-play');
  await wait(1500);
  check(await page.evaluate(() => undertow.player.state === 'playing' && window.drumHits > 2), 'the Drum Machine\'s own Play button plays the beat');
  await page.click('#drum-play');
  check(await page.evaluate(() => undertow.player.state) === 'stopped', 'and stops it again');
  await page.reload();
  await page.click('#boot-start');
  await page.waitForFunction(() => window.undertow && !document.getElementById('boot'));
  check(await page.evaluate(() => undertow.song.id === 'codex' && undertow.song.parts.find(p => p.id === 'drums')?.events.length === 48), 'added drums survive a reload');
  await page.click('[data-song="idioteque"]');
  await page.click('#open-drums');
  check(await page.textContent('#drum-page') === 'Beats 1-4 of 6', 'the six-beat Idioteque pattern pages in beats');
  await page.click('#drum-window [data-close]');

  // Sustain pedal: notes keep ringing after the key is let go.
  await page.click('[data-song="karma"]');
  await page.click('[data-tab="keys"]');
  await page.click('#pedal');
  await page.keyboard.down('a');
  await page.keyboard.up('a');
  check(await page.evaluate(() => undertow.player.sustained.size) === 1, 'with the Pedal down, a released note keeps ringing');
  await page.click('#pedal');
  check(await page.evaluate(() => undertow.player.sustained.size) === 0, 'lifting the Pedal lets it go');
  await page.keyboard.down('Shift');
  check(await page.evaluate(() => undertow.player.pedal), 'Shift works as a sustain pedal');
  await page.keyboard.up('Shift');

  // Wrong chords flash; the beat light flashes; the guide plays your part quietly.
  await page.click('[data-song="idioteque"]');
  await page.click('[data-step="2"]');
  await page.click('[data-tab="chords"]');
  await page.click('#play');
  await page.waitForFunction(() => undertow.player.holding, null, { timeout: 8000 });
  const wrongPad = page.locator('#pads .pad').nth(2);
  const box = await wrongPad.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  check(await wrongPad.evaluate(el => el.classList.contains('wrong')), 'a wrong chord flashes on its pad');
  await page.mouse.up();
  await page.click('#stop');
  await page.click('[data-step="4"]');
  await page.click('#guide');
  await page.evaluate(() => {
    window.channels = new Set();
    const original = undertow.engine.channel.bind(undertow.engine);
    undertow.engine.channel = (id, options) => { window.channels.add(id); return original(id, options); };
  });
  await page.click('#play');
  await page.waitForFunction(() => undertow.player.beat > 0.2, null, { timeout: 8000 });
  let flashes = 0;
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.getElementById('counter').classList.contains('flash'))) flashes++;
    await wait(50);
  }
  check(flashes > 0 && flashes < 40, 'the counter flashes on each beat');
  check(await page.evaluate(() => window.channels.has('guide')), 'Guide plays your part quietly while you practise');
  await page.click('#stop');
  await page.click('#guide');
  await page.click('[data-step="1"]');
  await page.click('[data-tab="keys"]');

  // Mixer.
  await page.click('#open-mixer');
  await page.waitForSelector('#dialog[open] .slider');
  await page.evaluate(() => {
    const slider = document.querySelector('#mix-drums');
    slider.value = 40;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  check(await page.evaluate(() => undertow.player.volumes.drums === 0.4 && undertow.data.settings.volumes.idioteque.drums === 0.4), 'the Mixer sets and remembers a part\'s level');
  await page.click('#dialog [data-value="reset"]');
  check(await page.evaluate(() => Object.keys(undertow.player.volumes).length === 0), 'Mixer Reset puts levels back');

  // Interrupted audio comes back on the next touch.
  await page.evaluate(() => undertow.engine.context.suspend());
  await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Sound paused'));
  await page.mouse.click(600, 120);
  await page.waitForFunction(() => undertow.engine.context.state === 'running');
  check(true, 'paused sound resumes on the next touch');

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
  check((await fresh.textContent('.balloon')).includes('1 of 5'), 'a first visit opens on Play and starts its tour');
  for (let i = 0; i < 5; i++) await fresh.click('.balloon [data-tour="next"]');
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
