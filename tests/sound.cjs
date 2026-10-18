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
  // Low notes sit a little left and high notes a little right.
  const balance = await page.evaluate(async () => {
    const { Engine, loadPiano } = await import('./src/audio/engine.js');
    const sides = async midi => {
      const context = new OfflineAudioContext(2, 44100, 44100);
      await loadPiano(context);
      const engine = new Engine(context);
      engine.note('piano', midi, 0.8, 0.01, 0.5, engine.channel('test', { instrument: 'piano' }));
      const buffer = await context.startRendering();
      const energy = data => data.reduce((sum, v) => sum + v * v, 0);
      return energy(buffer.getChannelData(1)) / energy(buffer.getChannelData(0));
    };
    return { low: await sides(36), high: await sides(88) };
  });
  check(balance.low < 1 && balance.high > 1, `notes spread across the stereo field (low ${balance.low.toFixed(2)}, high ${balance.high.toFixed(2)} right/left)`);
  // The plucked guitar must be in tune across its range.
  const tuning = await page.evaluate(async () => {
    const { Engine } = await import('./src/audio/engine.js');
    const cents = [];
    for (const midi of [40, 52, 57, 64, 69, 76]) {
      const context = new OfflineAudioContext(1, 44100, 44100);
      const engine = new Engine(context);
      engine.note('guitar', midi, 0.7, 0, 0.9, engine.channel('test', { instrument: 'guitar' }));
      const data = (await context.startRendering()).getChannelData(0).slice(4410, 4410 + 8192);
      const expected = 440 * 2 ** ((midi - 69) / 12);
      // Autocorrelation peak near the expected period, refined by parabola.
      const target = 44100 / expected;
      let best = 0;
      let lag = 0;
      const score = l => { let sum = 0; for (let i = 0; i + l < data.length; i++) sum += data[i] * data[i + l]; return sum; };
      for (let l = Math.floor(target * 0.9); l <= Math.ceil(target * 1.1); l++) {
        const value = score(l);
        if (value > best) { best = value; lag = l; }
      }
      const [a, b, c] = [score(lag - 1), score(lag), score(lag + 1)];
      const exact = lag + (a - c) / (2 * (a - 2 * b + c));
      cents.push(Math.round(1200 * Math.log2(44100 / exact / expected)));
    }
    return cents;
  });
  check(tuning.every(c => Math.abs(c) <= 8), `the guitar is in tune (cents off: ${tuning.join(', ')})`);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
