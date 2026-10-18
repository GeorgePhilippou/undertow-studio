import {Engine,loadPianoSamples} from './audio.js?v=10';

// Keep the offline audio graph small for mobile devices. Repeated blocks share
// a rendered buffer; effect tails overlap into the next block.
export async function renderPractice(state,sample,events,onProgress=()=>{}){
 await loadPianoSamples();
 const rate=44100,beat=60/state.bpm/4,tail=4,blockSize=80;
 const stepDuration=i=>beat*(i%2===0?1+state.swing/100:1-state.swing/100);
 const starts=[0];for(let i=0;i<events.length;i++)starts.push(starts.at(-1)+stepDuration(i));
 const outputContext=new OfflineAudioContext(2,1,rate),output=outputContext.createBuffer(2,Math.ceil((starts.at(-1)+tail)*rate),rate),cache=new Map();
 for(let offset=0;offset<events.length;offset+=blockSize){
   const batch=events.slice(offset,offset+blockSize);
   const key=JSON.stringify(batch.map(e=>e?[e.step,e.tracks||null,e.drumRows||null,e.fade??1]:null));
   let buffer=cache.get(key);
   if(!buffer){
     const duration=starts[offset+batch.length]-starts[offset];
     const context=new OfflineAudioContext(2,Math.ceil((duration+tail)*rate),rate),engine=new Engine(context,state,sample);
     let t=.01;for(let i=0;i<batch.length;i++){if(batch[i])engine.step(batch[i].step,t,batch[i]);t+=stepDuration(offset+i);}
     buffer=await context.startRendering();engine.disconnect();cache.set(key,buffer);
   }
   const at=Math.round(starts[offset]*rate);
   for(let channel=0;channel<2;channel++){const target=output.getChannelData(channel),source=buffer.getChannelData(channel),count=Math.min(source.length,target.length-at);for(let i=0;i<count;i++)target[at+i]+=source[i];}
   onProgress(Math.min(1,(offset+batch.length)/events.length));
   await new Promise(resolve=>setTimeout(resolve,0));
 }
 let peak=0;for(let channel=0;channel<2;channel++){const data=output.getChannelData(channel);for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));}
 if(peak>.98)for(let channel=0;channel<2;channel++){const data=output.getChannelData(channel);for(let i=0;i<data.length;i++)data[i]*=.98/peak;}
 return output;
}
