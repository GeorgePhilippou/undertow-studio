// Renders every song offline and checks the output is audible and unclipped.
// This proves signal and headroom, not that a song sounds like the record.
const { launch, openApp, check } = require('./helpers.cjs');

(async () => {
  const browser = await launch();
  const { page, errors } = await openApp(browser);
  const results = await page.evaluate(async () => {
    const { SONGS, prepareSong } = await import('./src/songs.js');
    const { renderWav } = await import('./src/render.js');
    const out = [];
    for (const raw of SONGS) {
      const song = prepareSong(raw);
      const { blob, peak, seconds } = await renderWav(song, { beats: song.loop });
      const samples = new Int16Array((await blob.arrayBuffer()).slice(44));
      let sum = 0;
      for (const s of samples) sum += (s / 32768) ** 2;
      out.push({ id: song.id, peak, rms: Math.sqrt(sum / samples.length), seconds });
    }
    return out;
  });
  for (const r of results) {
    console.log(`  ${r.id}: ${r.seconds.toFixed(1)} s, peak ${r.peak.toFixed(3)}, rms ${r.rms.toFixed(4)}`);
    check(r.rms > 0.01, `${r.id} is audible`);
    check(r.peak < 1, `${r.id} does not clip before normalising`);
  }
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
