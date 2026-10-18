const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:834,height:1194}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.STUDIO_URL||'http://localhost:8000');
 assert.equal(await page.locator('[data-preset]').count(),18);
 const choose=async preset=>{if(await page.locator('#learn-panel').evaluate(d=>d.open))await page.locator('[data-close=learn-panel]').click();await page.locator('#change-tape').click();await page.locator('[data-preset="'+preset+'"]').click();await page.locator('#learn-part').click();await page.locator('summary').filter({hasText:'Make your own pattern'}).click();await page.locator('summary').filter({hasText:'Save, export & more'}).click();};
 const results=[];
 for(let preset=3;preset<9;preset++){
  await choose(preset);
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('undertow-session')));
  assert.equal(data.preset,preset);assert.equal(data.patterns.keys.length,8);assert.ok(data.patterns.keys.some(row=>row.some(v=>v>0)));
  assert.equal(await page.locator('[data-bank]').count(),[15,10,8,8,16,8][preset-3]);
  const signal=await page.evaluate(async()=>{
   const {Engine,loadPianoSamples}=await import('./audio.js?v=10');await loadPianoSamples();const state=JSON.parse(localStorage.getItem('undertow-session'));
   const audio=new OfflineAudioContext(2,44100*3,44100),engine=new Engine(audio,state);
   let time=.02;for(let step=0;step<state.steps;step++){if(time>2)break;engine.step(step,time);time+=60/state.bpm/4;}
   const rendered=await audio.startRendering(),data=rendered.getChannelData(0);let energy=0,peak=0;for(const x of data){energy+=x*x;peak=Math.max(peak,Math.abs(x));}
   return {rms:Math.sqrt(energy/data.length),peak};
  });
  assert.ok(signal.rms>.001,'Study has audible signal');assert.ok(signal.peak<1,'Study does not clip');
  results.push({song:data.title,steps:data.steps,...signal});
 }
 await choose(4);
 await page.locator('[data-bank="9"]').click();assert.equal(await page.locator('button.step-cell').count(),128);assert.equal(await page.locator('.step-cell.unused').count(),0);
 await page.locator('#rebuild').click();assert.equal(await page.locator('.step-cell.on').count(),0);assert.ok(await page.locator('.step-cell.reference').count()>0);
 const reference=page.locator('.step-cell.reference').first();await reference.click();assert.equal(await page.locator('.step-cell.on').count(),1);assert.equal(await page.locator('.step-cell.on.reference').count(),0);
 await page.locator('#undo').click();assert.equal(await page.locator('.step-cell.on').count(),0);
 await page.locator('#restore').click();assert.ok(await page.locator('.step-cell.on').count()>0);
 await page.locator('#focus').click();assert.equal(await page.locator('[data-solo="keys"]').getAttribute('aria-pressed'),'true');
 const saved=page.waitForEvent('download');await page.locator('#save').click();await(await saved).saveAs('test-results/forty-step-project.json');
 await page.locator('#new-project').click();await page.locator('#project-file').setInputFiles('test-results/forty-step-project.json');await page.waitForFunction(()=>document.querySelectorAll('[data-bank]').length===10);
 const reloaded=await page.evaluate(()=>JSON.parse(localStorage.getItem('undertow-session')));assert.equal(reloaded.steps,160);assert.equal(reloaded.voice,'prophet');assert.deepEqual(reloaded.voicings[6],[49,61,65,68,72]);
 await page.reload();await page.locator('#learn-part').click();await page.locator('summary').filter({hasText:'Make your own pattern'}).click();await page.locator('summary').filter({hasText:'Save, export & more'}).click();await page.waitForSelector('[data-bank="9"]');assert.equal(await page.locator('#study-title').innerText(),'Everything in Its Right Place');
 await page.locator('#play').click();await page.waitForTimeout(600);assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause');await page.locator('#stop').click();
 const exportWait=page.waitForEvent('download');await page.locator('#export').click();await(await exportWait).saveAs('test-results/radiohead-study.wav');
 await choose(0);
 const legacy=await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('undertow-session'));for(const k of ['steps','voice','notes','voicings','keyLabel','chordLabels'])delete data[k];return JSON.stringify(data);});
 await page.locator('#project-file').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(legacy)});await page.waitForFunction(()=>document.querySelectorAll('[data-bank]').length===2);
 assert.equal(await page.locator('#project-title').innerText(),'Everything in its wake');
 for(const width of [1440,1024,834,390]){await page.setViewportSize({width,height:1100});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'No overflow at '+width);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({studies:results,flows:'extended editing, rebuild, reference, restore, solo, project roundtrip, legacy project import, playback, WAV export, responsive layouts passed',pageErrors:errors},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
