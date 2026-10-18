import {STUDIES} from './studies.js?v=10';
// Instrumental teaching arrangements. Section durations are pedagogical,
// not claimed to be a synchronized transcription of the album master.
export const LESSONS = {
  3:{title:'Idioteque / from the circuit up',bpm:138,cycle:80,
    note:'A complete instrumental practice route through the song’s core parts and form. Chord pitch classes and five-bar phrase are reference-backed; drum hits, textures and section lengths are teaching reconstructions. No vocals. Use the reference deck to compare your own recording.',
    sources:[['Sound & five-bar harmony','https://alijamieson.co.uk/2017/12/12/radiohead-idioteque/'],['Form & layers','https://ianperform.blogspot.com/2009/04/eclectic-analysis-radiohead-idioteque.html'],['Official recording','https://www.youtube.com/watch?v=svwJTnZOaco']],
    exercises:[
      {name:'01 / The machine pulse',text:'Start at 50% speed. Hear the low kick against the noise snare. The 24-step teaching rhythm lasts six quarter-note beats; it is not a four-on-the-floor loop.',track:'drums',rows:[0,1],length:24},
      {name:'02 / Hats & metal',text:'Bring in the hats and metallic percussion. Listen to the quieter alternating hits. Rebuild Drums with reference notes visible, then hide the reference and repeat.',track:'drums',length:48},
      {name:'03 / Four voicings, five bars',text:'The four sonorities use E♭, G, B♭ and D in different registers. Hear I, II, III, then IV. The last one occupies two bars. Tap a chord pad to hear its pitches.',track:'keys',length:80},
      {name:'04 / Cycles moving apart',text:'Layer the six-beat drum model against the twenty-beat chord phrase. Their alignment returns after sixty beats: fifteen bars. Count the pulse, not the page changes.',length:240},
      {name:'05 / Leave a hole',text:'Practice the stripped section with the chords absent. Keep the percussion steady. Removing a layer creates tension without introducing another melody.',track:'drums',length:160},
      {name:'06 / Return & ending',text:'Put the pad back over the drums, then play through the whole teaching arrangement. Follow the highlighted sections; loop any section that needs another pass.',length:240}
    ],
    sections:[
      {name:'Machine intro',bars:7,tracks:['drums'],detail:'Let the sequencer establish the pulse.'},
      {name:'First chord entrance',bars:20,tracks:['drums','keys'],detail:'Listen for the long fourth voicing.'},
      {name:'Intro subtraction',bars:8,tracks:['drums'],detail:'Leave room; keep the pulse intact.'},
      {name:'Verse',bars:20,tracks:['drums','keys'],detail:'Hold the pattern steady beneath the implied vocal space.'},
      {name:'First refrain',bars:10,tracks:['drums','keys'],detail:'The texture opens without changing the chord family.'},
      {name:'Instrumental space',bars:15,tracks:['drums'],detail:'Take the pad away and listen to the machinery.'},
      {name:'Returning refrain',bars:20,tracks:['drums','keys'],detail:'Bring the chord cycle back.'},
      {name:'Breakdown',bars:30,tracks:['drums'],rows:[1,2,3],detail:'Remove the kick as a practice variation; hold time through the gap.'},
      {name:'Rebuild',bars:15,tracks:['drums'],detail:'Reintroduce the low pulse and increase the energy.'},
      {name:'Coda / release',bars:32,tracks:['drums','keys'],detail:'Let the pattern carry the ending; the final bars fade.'}
    ]},
  4:{title:'Everything in Its Right Place / the keyboard room',bpm:112,cycle:40,
    note:'An extended keyboard-learning arrangement built around the documented three-chord colour and ten-beat cycle. It teaches the instrumental framework; voicing details, note attacks and section lengths are simplified. Compare with the original using the reference deck.',
    sources:[['Keyboard harmony','https://alijamieson.co.uk/2015/04/09/chord-of-the-day-everything-in-its-right-place/']],
    exercises:[
      {name:'01 / C, then a semitone',text:'Solo the keys. Hear C move to D♭maj7. C stays in the harmony even while the lower voices change.',track:'keys',length:40},
      {name:'02 / The E♭ colour',text:'Listen to the added sixth in the E♭ voicing. Play its row, then tap the individual chord notes below to hear the colour from the inside.',track:'keys',length:40},
      {name:'03 / Count ten',text:'Count ten quarter-note beats before the phrase returns. The editor shows two full four-beat pages and a final two-beat page.',track:'keys',length:40},
      {name:'04 / Pulse & space',text:'Raise the filter slowly and use a small amount of echo. Rebuild the repeated pulses without filling every space.',length:80},
      {name:'05 / Hold the framework',text:'Repeat four whole cycles. Keep the attacks consistent as you move between the three voicings.',length:160},
      {name:'06 / Play the arrangement',text:'Move between the opening, sustained sections and ending. This route leaves room for you to add your own live gestures.',length:160}
    ],
    sections:[{name:'Opening',cycles:4,tracks:['keys'],detail:'Introduce the keyboard phrase.'},{name:'First passage',cycles:8,tracks:['keys','bass'],detail:'Keep the pulse even.'},{name:'Refrain space',cycles:8,tracks:['keys'],detail:'Listen through the repeated harmony.'},{name:'Suspended passage',cycles:6,tracks:['keys'],detail:'Shape a darker filter colour.'},{name:'Return',cycles:8,tracks:['keys','bass'],detail:'Restore the low foundation.'},{name:'Final passage',cycles:8,tracks:['keys'],detail:'Leave room for the tails.'},{name:'Release',cycles:4,tracks:['keys'],detail:'Let the final cycles fade.'}]
  }
};
// Focused practice routes for the new studies, rather than a claim of full-song form.
for(let index=6;index<STUDIES.length;index++){
 const study=STUDIES[index],quiet=[8,10,11].includes(index),length=study.steps;
 LESSONS[index+3]={title:study.name+' / study workshop',bpm:study.bpm,cycle:length,practiceOnly:true,
 note:'Three focused exercises around this editable study. The sequence isolates its layers and combines them again; it is not the song’s full arrangement or an album transcription.',
 sources:[['Harmony / study reference',study.source],['Official recording','https://www.youtube.com/watch?v='+study.recording]],
 exercises:[{name:'01 / Hear the voicings',text:'Play the four main pads in order. Listen to the bass movement and the notes that stay in common. Then hear the written Keys part alone.',track:'keys',length},
 {name:quiet?'02 / Pulse & space':'02 / Hear the rhythm',text:study.tip,track:quiet?'keys':'drums',length},
 {name:'03 / Make it your own',text:'Combine the layers, choose a slower practice speed, and change one note or one drum hit. Use Undo to compare. The original recording is available through Listen to record.',length}],
 sections:[{name:'Voicings',cycles:1,tracks:['keys'],detail:'Hear the harmonic shapes and their attacks.'},{name:quiet?'Pulse & space':'Rhythm',cycles:1,tracks:quiet?['keys']:['drums','bass'],detail:study.tip},{name:'Together',cycles:1,tracks:['drums','bass','keys'],detail:'Combine the layers and shape your own variation.'}]};
}
export function lessonSections(preset){const l=LESSONS[preset];if(!l)return[];let start=0;return l.sections.map((s,i)=>{const steps=s.bars?s.bars*16:s.cycles*l.cycle;const item={...s,index:i,start,end:start+steps,steps};start+=steps;return item;});}
export function arrangementEvent(state,mode,selected,position){
  const sections=lessonSections(state.preset);
  if(mode==='song'&&sections.length){const section=sections.find(s=>position>=s.start&&position<s.end);if(!section)return null;return {step:(position-section.start)%state.steps,section:section.index,tracks:section.tracks,drumRows:section.rows,sectionStep:position-section.start,absolute:position,fade:section.index===sections.length-1?Math.min(1,(section.end-position)/64):1};}
  if(mode==='section'&&sections.length){const section=sections[selected]||sections[0];return{step:position%state.steps,section:section.index,tracks:section.tracks,drumRows:section.rows,sectionStep:position%section.steps,absolute:position,fade:1};}
  return {step:position%state.steps,section:-1,absolute:position,fade:1};
}
