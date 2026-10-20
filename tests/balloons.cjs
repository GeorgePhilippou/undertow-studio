// Every balloon's tail must point at the thing it explains: each tour step and
// every control with Balloon Help, at iPad, phone and desktop sizes.
const { BASE, launch, openApp, check } = require('./helpers.cjs');

const SIZES = [[1180, 820], [1024, 768], [1000, 620], [820, 1180], [390, 844], [1440, 900]];

const tipInside = () => {
  const balloon = document.querySelector('.balloon');
  const target = document.querySelector(balloon.dataset.target);
  const box = target.getBoundingClientRect();
  const x = Number(balloon.dataset.tipX);
  const y = Number(balloon.dataset.tipY);
  const b = balloon.getBoundingClientRect();
  const onScreen = b.left >= 0 && b.right <= innerWidth && b.top >= 24 && b.bottom <= innerHeight;
  return { ok: onScreen && x >= box.left - 8 && x <= box.right + 8 && y >= box.top - 8 && y <= box.bottom + 8, x, y, box: [box.left, box.top, box.right, box.bottom].map(Math.round) };
};

(async () => {
  const browser = await launch();
  for (const [width, height] of SIZES) {
    // The tour, from a first visit.
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.click('#boot-start');
    const misses = [];
    // The desktop tour runs on a first visit; the others the first time each opens.
    for (const screen of ['desk', 'learn']) {
      if (screen !== 'desk') await page.click(`#desk-icons [data-open="${screen}"]`);
      await page.waitForSelector('.balloon.tour');
      const total = Number((await page.textContent('.balloon b')).split(' of ')[1]);
      for (let step = 1; step <= total; step++) {
        const result = await page.evaluate(tipInside);
        if (!result.ok) misses.push(`${screen} step ${step} ${JSON.stringify(result)}`);
        await page.click('.balloon [data-tour="next"]');
      }
    }
    check(misses.length === 0, `every tour balloon points at its control at ${width}x${height} ${misses.join('; ')}`);

    // Every Balloon Help target that is on screen, on both screens.
    const helpMisses = [];
    for (const screen of ['learn', 'desk']) {
      await page.evaluate(name => undertow.setScreen(name), screen);
      await page.waitForTimeout(150);
      helpMisses.push(...await page.evaluate(async () => {
      const { showBalloon, hideBalloon } = await import('./src/ui/balloons.js');
      const wrong = [];
      for (const [i, element] of [...document.querySelectorAll('[data-help]')].entries()) {
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height || box.bottom < 24 || box.top > innerHeight) continue;
        element.dataset.balloonCheck = i;
        const balloon = showBalloon(element, element.dataset.help);
        balloon.dataset.target = `[data-balloon-check="${i}"]`;
        const x = Number(balloon.dataset.tipX);
        const y = Number(balloon.dataset.tipY);
        const b = balloon.getBoundingClientRect();
        const inside = x >= box.left - 8 && x <= box.right + 8 && y >= box.top - 8 && y <= box.bottom + 8;
        const onScreen = b.left >= 0 && b.right <= innerWidth && b.top >= 24 && b.bottom <= innerHeight;
        if (!inside || !onScreen) wrong.push(`${element.id || element.className || element.tagName}`);
        hideBalloon();
      }
      return wrong;
    }));
    }
    check(helpMisses.length === 0, `every help balloon points at its control at ${width}x${height} ${helpMisses.join(', ')}`);
    await page.close();
  }
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
