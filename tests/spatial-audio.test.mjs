import assert from 'node:assert/strict';
import {SpatialAudio,SOUND_TYPES} from '../dist/spatial-audio.js';
const values=[];
const param=()=>({value:0,setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&Number.isFinite(t));this.value=v;values.push([v,t]);},exponentialRampToValueAtTime(v,t){assert.ok(v>0&&Number.isFinite(t));values.push([v,t]);},setTargetAtTime(v,t){assert.ok(Number.isFinite(v)&&Number.isFinite(t));this.value=v;}});
const node=props=>({connect(){},disconnect(){},...props});
class Context {
 constructor(){this.currentTime=1;this.sampleRate=24000;this.state='running';this.destination={};this.sources=[];this.listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,param()]));}
 createGain(){return node({gain:param()});}
 createDynamicsCompressor(){return node(Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,param()])));}
 createConvolver(){return node({});}
 createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return{getChannelData:i=>data[i]};}
 createBiquadFilter(){return node({frequency:param(),Q:param()});}
 source(props){const n=node({...props,start(t){assert.ok(Number.isFinite(t));},stop(t){if(t!==undefined)assert.ok(Number.isFinite(t));}});this.sources.push(n);return n;}
 createBufferSource(){return this.source({playbackRate:param()});}
 createOscillator(){return this.source({frequency:param()});}
 createPanner(){return node({positionX:param(),positionY:param(),positionZ:param()});}
}
const c=new Context(),audio=new SpatialAudio(c),camera={matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,1.8,0,1]}};
audio.listener(camera,[]);assert.equal(c.listener.forwardZ.value,-1);assert.equal(c.listener.positionY.value,1.8);
const signatures=[];
for(const type of SOUND_TYPES){values.length=0;const before=c.sources.length;assert.equal(audio.effect(type,{x:4,y:1.8,z:-8}),true);const event=[...audio.active].at(-1);assert.equal(event.panner.panningModel,'HRTF');assert.equal(event.panner.positionX.value,4);assert.equal(event.panner.distanceModel,'inverse');assert.equal(event.panner.rolloffFactor,1.15);assert.ok(c.sources.length-before>=2,type+' needs layered sound');if(type.startsWith('boost_'))signatures.push(JSON.stringify(values));audio.stop();assert.equal(audio.active.size,0);}
assert.equal(new Set(signatures).size,3);
const before=c.sources.length;assert.equal(audio.effect('explosion',{x:100,y:1,z:0}),false);assert.equal(c.sources.length,before);
audio.listener(camera,[{x:0,z:-3,w:6,d:.5,h:4}]);audio.effect('shot_rpg',{x:0,y:1,z:-8});const muffled=[...audio.active][0];assert.equal(muffled.filter.frequency.value,1150);assert.equal(muffled.gain.gain.value,.53);c.currentTime+=.1;audio.listener(camera,[]);assert.equal(muffled.filter.frequency.value,18000);assert.equal(muffled.gain.gain.value,1);
for(let i=0;i<50;i++)audio.effect('step',{x:1,y:.1,z:-3});assert.equal(audio.active.size,28);audio.stop();assert.equal(audio.active.size,0);
console.log('PASS distinct layered boost/weapon effects, valid audio schedules, HRTF world coordinates, distance culling, changing cover muffling and bounded cleanup');
const {SAMPLE_NAMES}=await import('../dist/sound-pack.js');const samples=new Map(SAMPLE_NAMES.map(name=>[name,{duration:1}]));const recorded=new SpatialAudio(c,samples);recorded.listener(camera,[]);
for(const type of SOUND_TYPES){recorded.effect(type,{x:2,y:1,z:-3});const event=[...recorded.active].at(-1);assert.equal(event.sampled,true,type+' must use recorded samples');assert.ok(event.nodes.some(n=>n.buffer));for(const n of event.nodes)assert.equal(n.frequency,undefined,'no oscillator in the recorded effect graph');recorded.stop();}
recorded.enabled(true);recorded.ambience([{x:0,y:1,z:-5}]);assert.equal(recorded.ambient.size,1);const count=c.sources.length;recorded.ambience([{x:0,y:1,z:-5}]);assert.equal(c.sources.length,count,'moving listener must not restart fountain loop');recorded.ambience([]);assert.equal(recorded.ambient.size,0);recorded.ambience([{x:0,y:1,z:-5}]);recorded.stop();assert.equal(recorded.ambient.size,0);
console.log('PASS every game cue uses recorded sample layers; positional fountain loops persist, change with levels and stop with effects');
