// Shared setup for the browser checks. Start a server at the repository root
// first:  python3 -m http.server 8000
const { chromium } = require('playwright');

const BASE = process.env.UNDERTOW_URL || 'http://localhost:8000/';

async function launch() {
  const options = { args: ['--autoplay-policy=no-user-gesture-required'] };
  if (process.env.CHROMIUM_PATH) options.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(options);
}

async function openApp(browser, viewport = { width: 1180, height: 820 }) {
  const page = await browser.newPage({ viewport, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => message.type() === 'error' && errors.push(message.text()));
  await page.goto(BASE);
  await page.evaluate(() => localStorage.removeItem('undertow-desk-v1'));
  await page.reload();
  await page.click('#boot-start');
  await page.waitForFunction(() => window.undertow && !document.getElementById('boot'));
  return { page, errors };
}

function check(condition, message) {
  if (!condition) throw new Error(`Failed: ${message}`);
  console.log(`ok - ${message}`);
}

module.exports = { BASE, launch, openApp, check };
