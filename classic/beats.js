// Editable rhythm studies, not transcriptions of the original recordings.
export const BEATS=[
 {id:'six',name:'01 · Six-beat machine',length:24,kit:'modular',tip:'Idioteque study: a six-beat drum cycle against the five-bar chord phrase.',hits:[[0,8,14,16],[4,12,20],[0,2,4,6,8,10,12,14,16,18,20,22],[3,11,19,22]]},
 {id:'sparse',name:'02 · Machine, stripped',length:24,kit:'modular',tip:'Leave space: kick, noise snare and a quiet offbeat.',hits:[[0,8,16],[4,12,20],[2,6,10,14,18,22],[]]},
 {id:'metal',name:'03 · Metal & motion',length:24,kit:'modular',tip:'An original busier variation with metallic offbeats.',hits:[[0,6,8,14,16,22],[4,12,20],[0,2,3,6,8,10,11,14,16,18,19,22],[3,7,11,15,19,23]]},
 {id:'break',name:'04 · Broken circuitry',length:32,kit:'machine',tip:'Two-bar syncopation. Listen to the kick answering the snare.',hits:[[0,6,10,16,19,26,30],[4,12,20,28],[0,2,6,8,10,14,16,18,22,24,26,30],[7,15,23,31]]},
 {id:'four',name:'05 · Four on the floor',length:16,kit:'machine',tip:'A straight pulse for learning the step grid.',hits:[[0,4,8,12],[4,12],[2,6,10,14],[15]]},
 {id:'garage',name:'06 · Skipping pulse',length:32,kit:'machine',tip:'Original displaced kicks and ghost snares.',hits:[[0,7,10,16,23,26],[4,12,20,27,28],[0,2,5,6,8,10,13,14,16,18,21,22,24,26,29,30],[11,31]]},
 {id:'fishes',name:'07 · Arpeggio motor',length:32,kit:'soft',tip:'An even eighth-note motor for interlocking guitar-style figures.',hits:[[0,6,16,22],[4,12,20,28],[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30],[15,31]]},
 {id:'slow',name:'08 · Slow melancholy',length:32,kit:'soft',tip:'A restrained backbeat for a piano progression.',hits:[[0,16,22],[8,24],[0,4,8,12,16,20,24,28],[]]},
 {id:'pyramid',name:'09 · Floating 3 + 3 + 4',length:32,kit:'soft',tip:'Accent groups of 3+3+4+3+3 eighth notes. An original rhythm exercise.',hits:[[0,12,26],[6,20],[0,6,12,20,26],[30]]},
 {id:'half',name:'10 · Half-time room',length:32,kit:'soft',tip:'Keep the hats moving while the snare falls only once per bar.',hits:[[0,3,14,16,22],[8,24],[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30],[7,23]]},
 {id:'offgrid',name:'11 · Uneven transmission',length:20,kit:'modular',tip:'A five-beat cycle shifts against a four-beat bar.',hits:[[0,6,14],[4,12],[0,2,4,6,8,10,12,14,16,18],[9,19]]},
 {id:'ending',name:'12 · Mechanical fill',length:32,kit:'modular',tip:'An original two-bar pattern with a rising snare fill.',hits:[[0,8,16,24],[4,12,20,26,28,30,31],[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30],[15,27,29]]}
];
export function applyBeat(state,id){const beat=BEATS.find(b=>b.id===id);if(!beat)return;state.patterns.drums=beat.hits.map((hits,row)=>Array.from({length:state.steps},(_,i)=>hits.includes(i%beat.length)?(row===0?.8:row===1?(i%4?.32:.62):row===2?(i%4?.24:.43):.25):0));state.kit=beat.kit;state.beatId=id;state.mix.drums.mute=false;state.mix.drums.volume=Math.max(65,state.mix.drums.volume);Object.values(state.mix).forEach(m=>m.solo=false);return beat;}
export function resizePattern(state,steps){for(const rows of Object.values(state.patterns))for(let r=0;r<rows.length;r++){const old=rows[r];rows[r]=Array.from({length:steps},(_,i)=>old[i%old.length]);}if(state.holds)state.holds=state.holds.map(row=>Array.from({length:steps},(_,i)=>row[i%row.length]));state.steps=steps;}
