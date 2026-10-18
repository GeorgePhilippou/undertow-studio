// Yamaha C5 samples by Alexander Holm (CC BY 3.0); see assets/piano/README.
const roomImpulses=new Map(),stringBuffers=new Map();
const pianoBuffers = new Map();
let pianoLoading;
export function loadPianoSamples(){
  if(!pianoLoading)pianoLoading=(async()=>{
    const decoder=new OfflineAudioContext(1,1,44100);
    await Promise.all([[45,'A2'],[48,'C3'],[54,'Fs3'],[60,'C4'],[66,'Fs4'],[72,'C5']].map(async([note,file])=>{
      try{const response=await fetch(new URL('../assets/piano/'+file+'.mp3',import.meta.url));if(!response.ok)return;const buffer=await decoder.decodeAudioData(await response.arrayBuffer());pianoBuffers.set(note,buffer);}catch{}
    }));return pianoBuffers.size;
  })();return pianoLoading;
}
export const TRACKS = ['drums', 'bass', 'keys', 'sample'];
export const NOTES = [76, 74, 72, 71, 69, 67, 66, 64];
export const frequency = n => 440 * 2 ** ((n - 69) / 12);
export function makeSample(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2.4, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate, part = Math.floor(t / .6), local = t % .6;
    const f = frequency([76, 71, 79, 74][part]);
    data[i] = (.5 * Math.sin(2 * Math.PI * f * local) + .23 * Math.sin(2 * Math.PI * f * 2.003 * local) + .08 * Math.sin(2 * Math.PI * f * 3.99 * local)) * Math.exp(-local * 9) * Math.min(local * 250, 1);
  }
  return buffer;
}
export class Engine {
  constructor(ctx, state, sample) {
    this.parameters=new Map();this.previewGroups=new Set();this.previewTimers=new Set();this.previewLifetimes=new WeakMap();this.ctx = ctx; this.state = state; this.sample = sample || makeSample(ctx); this.reverseCache = null;
    this.master = ctx.createGain(); this.master.gain.value = state.master / 100 * .75;
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = state.tone; this.filter.Q.value = .55;
    this.limiter = ctx.createDynamicsCompressor(); this.limiter.threshold.value = -9; this.limiter.knee.value = 12; this.limiter.ratio.value = 8; this.limiter.attack.value = .003; this.limiter.release.value = .15;
    this.delay = ctx.createDelay(2); this.delay.delayTime.value = 60 / state.bpm * .75;
    this.feedback = ctx.createGain(); this.feedback.gain.value = .26;
    this.wet = ctx.createGain(); this.wet.gain.value = state.space / 100 * .65;
    this.echoFilter=ctx.createBiquadFilter();this.echoFilter.type='lowpass';this.echoFilter.frequency.value=2100;
    this.filter.connect(this.master); this.filter.connect(this.delay); this.delay.connect(this.echoFilter);this.echoFilter.connect(this.feedback); this.feedback.connect(this.delay); this.echoFilter.connect(this.wet); this.wet.connect(this.master);
    this.master.connect(this.limiter); this.limiter.connect(ctx.destination);
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 256; this.limiter.connect(this.analyser);
    this.buses = {};
    for (const name of TRACKS) { const g = ctx.createGain(); g.connect(this.filter); this.buses[name] = g; }
    this.room=ctx.createConvolver();this.room.normalize=false;this.roomLevel=ctx.createGain();this.roomLevel.gain.value=state.space/100*.3;
    if(!roomImpulses.has(ctx.sampleRate)){const impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*1.35),ctx.sampleRate);let seed=10831;for(let ch=0;ch<2;ch++){const d=impulse.getChannelData(ch);for(let i=0;i<d.length;i++){seed=seed*16807%2147483647;const t=i/ctx.sampleRate;d[i]=(seed/1073741824-1)*Math.exp(-t*6)*Math.min(t*80,1)*.018;}}roomImpulses.set(ctx.sampleRate,impulse);}this.room.buffer=roomImpulses.get(ctx.sampleRate);this.buses.keys.connect(this.room);this.room.connect(this.roomLevel);this.roomLevel.connect(this.filter);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    let seed = 8932; const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741824 - 1; }
    this.update();
  }
  update() {
    const t = this.ctx.currentTime, s = this.state;
    const smooth=(key,param,value,tau=.035)=>{if(this.parameters.get(key)===value)return;this.parameters.set(key,value);param.setTargetAtTime(value,t,tau);};
    smooth('room',this.roomLevel.gain,s.space/100*.3);smooth('tone',this.filter.frequency,s.tone);smooth('space',this.wet.gain,s.space/100*.65);
    smooth('master',this.master.gain,s.master/100*.75);smooth('tempo',this.delay.delayTime,60/s.bpm*.75,.1);
    const solo=TRACKS.some(n=>s.mix[n].solo);
    for(const n of TRACKS)smooth(n,this.buses[n].gain,s.mix[n].mute||(solo&&!s.mix[n].solo)?0:s.mix[n].volume/100);
  }
  previewNote(row,time,velocity,hold=0){
    for(const group of this.previewGroups){if(group.releasing)continue;group.releasing=true;const lifetime=this.previewLifetimes.get(group);clearTimeout(lifetime);this.previewTimers.delete(lifetime);group.gain.cancelScheduledValues(time);group.gain.setTargetAtTime(0,time,.018);const timer=setTimeout(()=>{group.disconnect();this.previewGroups.delete(group);this.previewTimers.delete(timer);},180);this.previewTimers.add(timer);}
    const bus=this.buses.keys,group=this.ctx.createGain();group.connect(bus);this.previewGroups.add(group);this.buses.keys=group;
    try{this.note('keys',row,time,velocity,hold);}finally{this.buses.keys=bus;}
    const timer=setTimeout(()=>{group.disconnect();this.previewGroups.delete(group);this.previewTimers.delete(timer);},15000);this.previewLifetimes.set(group,timer);this.previewTimers.add(timer);
  }
  piano(note,time,level,duration){
    if(!pianoBuffers.size)return false;
    const root=[...pianoBuffers.keys()].reduce((a,b)=>Math.abs(a-note)<Math.abs(b-note)?a:b);
    const source=this.ctx.createBufferSource();source.buffer=pianoBuffers.get(root);source.playbackRate.value=2**((note-root)/12);
    const length=Math.min(duration,source.buffer.duration/source.playbackRate.value),gain=this.naturalEnvelope(time,level*4.5,length);
    source.connect(gain);source.start(time);source.stop(time+length+.02);source.onended=()=>{source.disconnect();gain.disconnect();};return true;
  }

  naturalEnvelope(time,level,duration){const gain=this.ctx.createGain(),attack=Math.min(.005,duration*.1),release=Math.min(.07,duration*.2);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+attack);gain.gain.setValueAtTime(level,time+Math.max(attack,duration-release));gain.gain.linearRampToValueAtTime(0,time+duration);gain.connect(this.buses.keys);return gain;}
  string(time,f,level,duration,pan=0){
    const c=this.ctx,key=c.sampleRate+':'+f;
    if(!stringBuffers.has(key)){
      const size=Math.max(2,Math.floor(c.sampleRate/f-.5)),fraction=c.sampleRate/f-size-.5,a=(1-fraction)/(1+fraction),ring=new Float32Array(size),buffer=c.createBuffer(1,Math.ceil(c.sampleRate*2.8),c.sampleRate);let seed=Math.round(f*100)+733;for(let i=0;i<size;i++){seed=seed*16807%2147483647;ring[i]=(seed/1073741824-1)*.7;}
      let previous=ring[size-1],lastInput=0,lastOutput=0,peak=0;const data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){const at=i%size,value=ring[at],filtered=(value+previous)*.5;previous=value;const output=a*filtered+lastInput-a*lastOutput;lastInput=filtered;lastOutput=output;ring[at]=output*.996;data[i]=value;peak=Math.max(peak,Math.abs(value));}
      if(peak)for(let i=0;i<data.length;i++)data[i]=data[i]/peak*.92;
      if(stringBuffers.size>=48)stringBuffers.delete(stringBuffers.keys().next().value);stringBuffers.set(key,buffer);
    }
    const source=c.createBufferSource(),gain=this.naturalEnvelope(time,level*2.1,duration),position=c.createStereoPanner();source.buffer=stringBuffers.get(key);position.pan.value=pan;source.connect(position);position.connect(gain);source.start(time);source.stop(time+Math.min(duration,source.buffer.duration));source.onended=()=>{source.disconnect();position.disconnect();gain.disconnect();};
  }

  envelope(bus, time, level, duration, attack = .004) {
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(Math.max(.0001, level), time + attack); g.gain.exponentialRampToValueAtTime(.0001, time + duration); g.connect(this.buses[bus]); return g;
  }
  osc(bus, time, freq, type, level, duration, detune = 0) {
    const o = this.ctx.createOscillator(), g = this.envelope(bus, time, level, duration, bus === 'keys' ? .025 : .006);
    o.type = type; o.frequency.setValueAtTime(freq, time); o.detune.value = detune; o.connect(g); o.start(time); o.stop(time + duration + .02); o.onended = () => {o.disconnect(); g.disconnect();}; return o;
  }
  drum(row,time,velocity){
    const c=this.ctx,v=velocity,kit=this.state.kit||'modular',soft=kit==='soft'||kit==='toms';
    if(kit==='toms'&&row>=2){const o=this.osc('drums',time,row===2?250:165,'sine',v*.8,row===2?.19:.27);o.frequency.exponentialRampToValueAtTime(row===2?145:87,time+.08);this.osc('drums',time,1300,'triangle',v*.025,.015);return;}
    if(row===0){const duration=soft?.25:.34,o=this.osc('drums',time,soft?100:kit==='machine'?138:165,'sine',v*(soft?.7:.82),duration);o.frequency.exponentialRampToValueAtTime(soft?48:43,time+.12);if(kit==='modular')this.osc('drums',time,1450,'triangle',v*.022,.015);return;}
    if(row===3&&kit==='modular'){const carrier=c.createOscillator(),mod=c.createOscillator(),depth=c.createGain(),g=this.envelope('drums',time,v*.19,.14,.002);carrier.frequency.value=430;mod.frequency.value=683;depth.gain.setValueAtTime(440,time);depth.gain.exponentialRampToValueAtTime(24,time+.13);mod.connect(depth);depth.connect(carrier.frequency);carrier.connect(g);carrier.start(time);mod.start(time);carrier.stop(time+.16);mod.stop(time+.16);carrier.onended=()=>{carrier.disconnect();mod.disconnect();depth.disconnect();g.disconnect();};return;}
    const source=c.createBufferSource(),high=c.createBiquadFilter(),low=c.createBiquadFilter(),duration=row===1?(soft?.13:.18):row===2?(soft?.045:.055):.12;
    const g=this.envelope('drums',time,v*(row===1?(soft?.4:.54):row===2?.2:.24),duration,.002);
    source.buffer=this.noise;high.type=row===3?'bandpass':'highpass';high.frequency.value=row===1?(soft?1100:1700):row===2?7000:2200;high.Q.value=row===3?1.8:.65;low.type='lowpass';low.frequency.value=soft?6500:11000;source.connect(high);high.connect(low);low.connect(g);source.start(time,row*.13);source.stop(time+duration+.02);source.onended=()=>{source.disconnect();high.disconnect();low.disconnect();g.disconnect();};
    if(row===1)this.osc('drums',time,soft?170:195,'triangle',v*(soft?.12:.19),.09);
  }
  analogue(time,f,level,duration,pan=0,organ=false){
    const c=this.ctx,g=c.createGain(),filter=c.createBiquadFilter(),position=c.createStereoPanner();filter.type='lowpass';filter.Q.value=.45;filter.frequency.setValueAtTime(organ?2200:Math.min(4200,f*9),time);filter.frequency.exponentialRampToValueAtTime(organ?1800:Math.max(500,f*2.5),time+duration);position.pan.value=pan;
    const attack=organ?.035:.018,release=Math.min(.22,duration*.22);g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(level,time+attack);g.gain.setValueAtTime(level*(organ?.8:.6),time+Math.max(attack,duration-release));g.gain.exponentialRampToValueAtTime(.0001,time+duration);g.connect(filter);filter.connect(position);position.connect(this.buses.keys);
    const specs=organ?[[1,'sine',.8,0],[2,'sine',.25,0],[3,'sine',.08,0]]:[[1,'sawtooth',.48,-5],[1,'triangle',.6,5]];let left=specs.length;
    for(const [ratio,type,volume,detune]of specs){const o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.value=f*ratio;o.detune.value=detune;v.gain.value=volume;o.connect(v);v.connect(g);o.start(time);o.stop(time+duration+.02);o.onended=()=>{o.disconnect();v.disconnect();if(!--left){g.disconnect();filter.disconnect();position.disconnect();}};}
  }
  roundedKeys(time,f,level,gate,pan){
    const c=this.ctx,o=c.createOscillator(),filter=c.createBiquadFilter(),g=c.createGain(),position=c.createStereoPanner();
    o.type='sawtooth';o.frequency.value=f;filter.type='lowpass';filter.frequency.value=Math.max(170,Math.min(2600,f*2.2*(this.state.tone/1100)));filter.Q.value=.45;position.pan.value=pan;
    const sustainAt=Math.min(.45,gate),release=.65;g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(level*1.35,time+.008);g.gain.exponentialRampToValueAtTime(level*.55,time+Math.max(.02,sustainAt));g.gain.setValueAtTime(level*.55,time+Math.max(.02,gate));g.gain.exponentialRampToValueAtTime(.0001,time+gate+release);
    o.connect(filter);filter.connect(g);g.connect(position);position.connect(this.buses.keys);o.start(time);o.stop(time+gate+release+.02);o.onended=()=>{o.disconnect();filter.disconnect();g.disconnect();position.disconnect();};
  }
  swell(time, frequencyValue, level, duration, pan) {
    const c=this.ctx,carrier=c.createOscillator(),mod=c.createOscillator(),depth=c.createGain(),amp=c.createGain(),position=c.createStereoPanner();
    carrier.setPeriodicWave(c.createPeriodicWave(new Float32Array(5),new Float32Array([0,1,.28,0,.09])));carrier.frequency.value=frequencyValue;mod.frequency.value=frequencyValue*2.003;depth.gain.setValueAtTime(frequencyValue*.3,time);depth.gain.exponentialRampToValueAtTime(frequencyValue*.06,time+duration);
    mod.connect(depth);depth.connect(carrier.frequency);carrier.connect(amp);position.pan.value=pan;amp.connect(position);position.connect(this.buses.keys);
    const attack=Math.min(.32,duration*.22),release=Math.min(.65,duration*.3);
    amp.gain.setValueAtTime(0,time);amp.gain.linearRampToValueAtTime(level,time+attack);amp.gain.setValueAtTime(level*.82,time+Math.max(attack,duration-release));amp.gain.linearRampToValueAtTime(0,time+duration);
    carrier.start(time);mod.start(time);carrier.stop(time+duration+.02);mod.stop(time+duration+.02);carrier.onended=()=>{carrier.disconnect();mod.disconnect();depth.disconnect();amp.disconnect();position.disconnect();};
  }
  click(time,accent=false){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.value=accent?1400:950;g.gain.setValueAtTime(.12,time);g.gain.exponentialRampToValueAtTime(.0001,time+.035);o.connect(g);g.connect(this.master);o.start(time);o.stop(time+.04);o.onended=()=>{o.disconnect();g.disconnect();};}
  note(track, row, time, velocity, hold=0) {
    const n = (this.state.notes || NOTES)[row] - (track === 'bass' ? 24 : 0), beat = 60 / this.state.bpm;
    if (track === 'bass') { this.osc(track, time, frequency(n), 'triangle', velocity * .46, beat * .65); this.osc(track, time, frequency(n - 12), 'sine', velocity * .24, beat * .8); }
    else if(this.state.voice && this.state.voice !== 'legacy') {
      const chord=this.state.voicings?.[row] || [n], level=velocity*.22/Math.sqrt(chord.length);
      for(const [voiceIndex,note] of chord.entries()){const f=frequency(note);
        if(this.state.voice==='piano'){
          if(this.piano(note,time,level,Math.max(beat*2.4,hold*beat/4)))continue;
          this.osc(track,time,f,'sine',level,beat*2.4);this.osc(track,time,f*2.003,'sine',level*.33,beat*.9);this.osc(track,time,f*3.008,'sine',level*.12,beat*.35);
        }else if(this.state.voice==='bell'){
          this.osc(track,time,f,'sine',level,beat*2.2);this.osc(track,time,f*2.756,'sine',level*.2,beat*.9);this.osc(track,time,f*5.4,'sine',level*.04,beat*.25);
        }else if(this.state.voice==='pluck'){
          this.string(time+voiceIndex*.003,f,level,hold?Math.min(2.8,hold*beat/4):Math.min(2.8,beat*.9),(voiceIndex-(chord.length-1)/2)*.12);
        }else if(this.state.voice==='organ'){this.analogue(time,f,level,hold?hold*beat/4:beat*2.5,0,true);
        }else if(this.state.voice==='prophet'){
          if(this.state.preset===4&&(!this.state.soundPatch||this.state.soundPatch==='study'))this.roundedKeys(time,f,level,hold?hold*beat/4:beat*.5,(voiceIndex-(chord.length-1)/2)*.06);else this.analogue(time,f,level,Math.max(beat*.95,hold*beat/4),(voiceIndex-(chord.length-1)/2)*.1);
        }else{
          this.swell(time,f,level*.7,hold?hold*beat/4:beat*3.8,(voiceIndex-(chord.length-1)/2)*.16);
        }
      }
    } else { for (const [interval, level] of [[0,.16],[7,.055],[12,.07]]) { this.osc(track, time, frequency(n + interval), 'triangle', velocity * level, beat * 1.7, -4); this.osc(track, time, frequency(n + interval), 'sine', velocity * level * .5, beat * 1.9, 4); } }
  }
  setSample(buffer) { this.sample = buffer; this.reverseCache = null; }
  slice(row, time, velocity = .8) {
    const s = this.state, original = this.sample;
    if (!original) return;
    if (s.reverse && !this.reverseCache) {
      this.reverseCache = this.ctx.createBuffer(original.numberOfChannels, original.length, original.sampleRate);
      for(let ch = 0; ch < original.numberOfChannels; ch++) this.reverseCache.getChannelData(ch).set(original.getChannelData(ch).slice().reverse());
    }
    const b = s.reverse ? this.reverseCache : original;
    const length = original.duration * (s.trimEnd - s.trimStart) / 100 / 4;
    const start = original.duration * (s.reverse ? (100 - s.trimEnd) / 100 : s.trimStart / 100) + row * length;
    if(length<=0)return;const source = this.ctx.createBufferSource(), g = this.ctx.createGain(); source.buffer = b;
    g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(velocity * .65, time + Math.min(.006,length / 4)); g.gain.setValueAtTime(velocity * .65, time + Math.max(Math.min(.006,length/4),length-Math.min(.015,length/4))); g.gain.linearRampToValueAtTime(0, time + length);
    source.connect(g); g.connect(this.buses.sample); source.start(time, start, length); source.onended = () => {source.disconnect(); g.disconnect();};
  }
  hit(track, row, time, velocity,hold=0) { if (track === 'drums') this.drum(row,time,velocity); else if (track === 'sample') this.slice(row,time,velocity); else this.note(track,row,time,velocity,hold); }
  step(step, time,options={}) { for (const track of TRACKS) {if(options.tracks&&!options.tracks.includes(track))continue;this.state.patterns[track].forEach((row, i) => {if(track==='drums'&&options.drumRows&&!options.drumRows.includes(i))return;if(row[step] > 0)this.hit(track,i,time,row[step]*(options.fade??1),track==='keys'?this.state.holds?.[i]?.[step]||0:0);});} }
  disconnect() { for(const timer of this.previewTimers)clearTimeout(timer);for(const group of this.previewGroups)group.disconnect();this.previewTimers.clear();this.previewGroups.clear();for (const n of [this.room,this.roomLevel,this.echoFilter,this.master,this.filter,this.limiter,this.delay,this.feedback,this.wet,this.analyser,...Object.values(this.buses)]) n.disconnect(); }
}
export function encodeWav(buffer) {
  const channels = buffer.numberOfChannels, size = buffer.length * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + size));
  const text = (at, s) => [...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
  text(0,'RIFF'); view.setUint32(4,36+size,true); text(8,'WAVE'); text(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true); view.setUint32(24,buffer.sampleRate,true); view.setUint32(28,buffer.sampleRate*channels*2,true); view.setUint16(32,channels*2,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,size,true);
  const data = Array.from({length:channels},(_,i)=>buffer.getChannelData(i)); let at=44;
  for(let i=0;i<buffer.length;i++) for(let ch=0;ch<channels;ch++){const v=Math.max(-1,Math.min(1,data[ch][i])); view.setInt16(at,v<0?v*32768:v*32767,true);at+=2;}
  return new Blob([view],{type:'audio/wav'});
}
