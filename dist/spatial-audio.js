import {soundRecipe} from './sound-pack.js';
import {boxContact3D} from './core.js';

export const SOUND_TYPES=new Set(['boost_run','boost_fire','boost_jump','weaponPickup','weaponDrop','shot_throw','shot_spud','shot_repeater','shot_scatter','shot_masher','shot_rpg','shot_peeler','shot_fryer','shot_sticky','shot_mortar','explosion','hit','catch','dash','jump','land','step','crouch','duckGate','checkpoint','pickup','win','impact']);
const aliases={throw:'shot_spud',gun:'shot_masher'};
const point=p=>({x:p.x,y:p.y??0,z:p.z});
export class SpatialAudio {
 constructor(context,samples=new Map()){this.c=context;this.samples=samples;this.ambient=new Map();this.active=new Set();this.position={x:0,y:1.8,z:0};this.solids=[];this.foot=0;const c=context;
  this.bus=c.createGain();this.bus.gain.value=.75;this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-16;this.compressor.knee.value=14;this.compressor.ratio.value=5;this.compressor.attack.value=.003;this.compressor.release.value=.18;this.bus.connect(this.compressor);this.compressor.connect(c.destination);
  this.reverb=c.createConvolver();const length=Math.floor(c.sampleRate*.48),impulse=c.createBuffer(2,length,c.sampleRate);let seed=487;
  for(let channel=0;channel<2;channel++){const data=impulse.getChannelData(channel);for(let i=0;i<length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=((seed/4294967296)*2-1)*Math.pow(1-i/length,3)*.22;}}
  this.reverb.buffer=impulse;this.wet=c.createGain();this.wet.gain.value=.14;this.reverb.connect(this.wet);this.wet.connect(this.bus);
  this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 }
 listener(camera,solids=[]){if(!camera?.matrixWorld)return;const e=camera.matrixWorld.elements,c=this.c,l=c.listener;this.position={x:e[12],y:e[13],z:e[14]};this.solids=solids;
  if(l.positionX){for(const [key,value]of Object.entries({positionX:e[12],positionY:e[13],positionZ:e[14],forwardX:-e[8],forwardY:-e[9],forwardZ:-e[10],upX:e[4],upY:e[5],upZ:e[6]}))l[key].setValueAtTime(value,c.currentTime);}else{l.setPosition(e[12],e[13],e[14]);l.setOrientation(-e[8],-e[9],-e[10],e[4],e[5],e[6]);}
  if(c.currentTime>=(this.nextOcclusion??0)){this.nextOcclusion=c.currentTime+.08;for(const event of [...this.active,...this.ambient.values()])this.occlusion(event);}
 }
 occlusion(event){if(!event.position)return;const a=this.position,b=event.position;const blocked=this.solids.some(w=>{const t=boxContact3D(a.x,a.y,a.z,b.x,b.y,b.z,w,.015);return t>.015&&t<.97;});event.filter.frequency.setTargetAtTime(blocked?1150:18000,this.c.currentTime,.04);event.gain.gain.setTargetAtTime(event.level*(blocked?.53:1),this.c.currentTime,.04);}
 stop(){for(const event of [...this.active])event.end();for(const event of this.ambient.values())event.end();this.ambient.clear();this.bus.gain.value=0;}
 enabled(value){this.bus.gain.value=value?.75:0;}
 ambience(positions=[]){const buffer=this.samples.get('water-loop'),keep=new Set();if(!buffer)return;for(const p of positions.slice(0,3)){const key=p.x+':'+p.y+':'+p.z;keep.add(key);if(this.ambient.has(key))continue;const c=this.c,source=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter(),panner=c.createPanner(),event={position:point(p),gain,filter,panner,level:.26};source.buffer=buffer;source.loop=true;panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=2;panner.maxDistance=40;panner.rolloffFactor=1.35;for(const k of ['x','y','z'])panner['position'+k.toUpperCase()].value=event.position[k];filter.type='lowpass';filter.frequency.value=15000;gain.gain.value=event.level;source.connect(gain);gain.connect(filter);filter.connect(panner);panner.connect(this.bus);event.end=()=>{try{source.stop();}catch{}source.disconnect();gain.disconnect();filter.disconnect();panner.disconnect();};this.ambient.set(key,event);this.occlusion(event);source.start(c.currentTime);}for(const [key,event]of this.ambient)if(!keep.has(key)){event.end();this.ambient.delete(key);}}
 effect(input,source){const type=aliases[input]??input,c=this.c;if(!SOUND_TYPES.has(type)||c.state!=='running')return false;
  this.enabled(true);const position=source?point(source):null;if(position&&(!Object.values(position).every(Number.isFinite)||Math.hypot(position.x-this.position.x,position.y-this.position.y,position.z-this.position.z)>60))return false;
  if(this.active.size>=28){const old=[...this.active].find(e=>e.type==='step'||e.type==='impact')??this.active.values().next().value;old.end();}
  const gain=c.createGain(),filter=c.createBiquadFilter(),panner=position?c.createPanner():null,event={type,position,gain,filter,panner,level:type==='step'?.55:1,nodes:[],left:0};filter.type='lowpass';filter.frequency.value=18000;gain.gain.value=event.level;gain.connect(filter);
  if(panner){panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=4;panner.maxDistance=60;panner.rolloffFactor=1.15;for(const key of ['x','y','z'])panner['position'+key.toUpperCase()].value=position[key];filter.connect(panner);panner.connect(this.bus);panner.connect(this.reverb);}else filter.connect(this.bus);
  event.end=()=>{if(!this.active.delete(event))return;for(const n of event.nodes){try{n.stop?.();}catch{}n.disconnect();}gain.disconnect();filter.disconnect();panner?.disconnect();};this.active.add(event);this.occlusion(event);
  const at=c.currentTime+.003,variation=.965+Math.random()*.07;
  const recipe=soundRecipe(type,type==='step'?this.foot++:Math.floor(Math.random()*2)).filter(([name])=>this.samples.has(name));
  if(recipe.length){event.sampled=true;for(const [name,level,rate=1,delay=0]of recipe){const source=c.createBufferSource(),mix=c.createGain();source.buffer=this.samples.get(name);source.playbackRate.value=rate*variation;mix.gain.value=level;source.connect(mix);mix.connect(gain);event.nodes.push(source,mix);event.left++;source.onended=()=>{if(--event.left<=0)event.end();};source.start(at+delay);source.stop(at+delay+source.buffer.duration/(rate*variation)+.015);}return true;}

  const layer=(noise,from,to,duration,level,delay=0,wave='sine',q=.7)=>{const n=noise?c.createBufferSource():c.createOscillator(),g=c.createGain();let f;if(noise){n.buffer=this.noise;f=c.createBiquadFilter();f.type='bandpass';f.frequency.setValueAtTime(from,at+delay);f.frequency.exponentialRampToValueAtTime(Math.max(20,to),at+delay+duration);f.Q.value=q;n.connect(f);f.connect(g);event.nodes.push(f);}else{n.type=wave;n.frequency.setValueAtTime(from*variation,at+delay);n.frequency.exponentialRampToValueAtTime(to*variation,at+delay+duration);n.connect(g);}g.gain.setValueAtTime(.0001,at+delay);g.gain.exponentialRampToValueAtTime(Math.max(.001,level),at+delay+.004);g.gain.exponentialRampToValueAtTime(.0001,at+delay+duration);g.connect(gain);event.nodes.push(n,g);event.left++;n.onended=()=>{if(--event.left<=0)event.end();};n.start(at+delay);n.stop(at+delay+duration+.012);};
  const tone=(a,b,d,v,delay=0,wave='sine')=>layer(false,a,b,d,v,delay,wave),noise=(a,b,d,v,delay=0,q=.7)=>layer(true,a,b,d,v,delay,'sine',q);
  switch(type){
   case 'boost_run':noise(450,4200,.48,.7);for(let i=0;i<5;i++)tone(380+i*110,160+i*70,.065,.16,i*.06/(1+i*.2),'triangle');tone(330,1320,.42,.13);break;
   case 'boost_fire':noise(1500,7500,.42,.5);tone(100,42,.16,.3);for(let i=0;i<4;i++){tone(320+i*140,540+i*200,.12,.12,i*.065,'triangle');noise(3100,1700,.035,.32,i*.065);}break;
   case 'boost_jump':tone(160,740,.48,.19,0,'triangle');tone(210,960,.43,.10,.04);noise(2400,6500,.22,.25,.14);tone(1500,1600,.20,.05,.30);break;
   case 'weaponPickup':tone(145,63,.13,.32);noise(900,350,.12,.65);tone(1700,520,.07,.09,.065,'triangle');noise(2600,850,.12,.50,.12);tone(660,880,.15,.08,.21);break;
   case 'weaponDrop':tone(110,45,.18,.32);noise(850,280,.23,.6);tone(890,420,.10,.08,.09,'triangle');break;
   case 'shot_throw':noise(650,2300,.19,.27);noise(1800,850,.12,.14,.04);break;
   case 'shot_spud':tone(170,58,.16,.28);noise(1700,700,.14,.48);tone(480,190,.045,.10,0,'triangle');break;
   case 'shot_repeater':tone(240,84,.08,.20);noise(3400,950,.085,.48);tone(1100,580,.035,.05,.035,'triangle');break;
   case 'shot_scatter':tone(88,28,.29,.48);for(const d of [0,.012,.024])noise(4200,750,.11,.50,d);noise(1100,180,.30,.25,.04);break;
   case 'shot_masher':tone(155,42,.115,.29);noise(4700,1000,.12,.73);tone(1450,780,.045,.07,.065,'triangle');break;
   case 'shot_peeler':tone(120,34,.34,.55);noise(6200,900,.17,.85);tone(2100,640,.06,.12,.02,'triangle');noise(700,180,.42,.22,.06);break;
   case 'shot_fryer':noise(2600,5200,.13,.34);tone(760,980,.07,.05,0,'sawtooth');break;
   case 'shot_sticky':tone(300,110,.13,.22,0,'triangle');noise(1300,420,.11,.30);tone(880,1180,.06,.07,.05,'sine');break;
   case 'shot_mortar':tone(96,30,.30,.52);noise(1500,340,.24,.55);tone(420,150,.09,.12,.03,'triangle');break;
   case 'shot_rpg':tone(92,31,.27,.50);noise(2400,4900,.16,.8);noise(900,320,.62,.60,.035);tone(180,70,.4,.12,.05,'sawtooth');break;
   case 'explosion':tone(90,24,.85,.66);noise(5000,950,.14,.9);noise(520,95,.9,.86);for(const d of [.12,.22,.34,.43])noise(1500,280,.12,.22,d);break;
   case 'step':{const side=(this.foot++%2)?1:.84;tone(520*side,270*side,.067,.15,0,'triangle');tone(900*side,470*side,.058,.075,.026,'triangle');noise(1600,650,.045,.18);break;}
   case 'land':tone(150,42,.19,.32);tone(480,195,.1,.14,.014,'triangle');noise(1400,450,.21,.37);break;
   case 'jump':tone(260,620,.18,.12,0,'triangle');noise(1800,4000,.22,.28);tone(540,270,.055,.13);break;
   case 'dash':noise(520,3300,.28,.7);tone(130,55,.2,.13);break;
   case 'catch':noise(1400,250,.1,.50);tone(160,340,.15,.19);tone(620,490,.075,.09,.055,'triangle');tone(820,680,.07,.06,.095,'triangle');break;
   case 'crouch':noise(900,450,.12,.16);tone(390,185,.085,.04,0,'triangle');break;
   case 'hit':tone(130,34,.24,.32);noise(1600,340,.19,.55);noise(500,130,.25,.23,.05);break;
   case 'impact':tone(340,140,.1,.12,0,'triangle');noise(2200,750,.13,.27);break;
   case 'duckGate':for(let i=0;i<3;i++)tone([440,554,740][i],[330,440,660][i],.13,.12,i*.07,'triangle');noise(2700,4900,.18,.13,.1);break;
   case 'checkpoint':case 'pickup':for(let i=0;i<3;i++)tone([523,659,784][i],[523,659,784][i],.18,.10,i*.08,'triangle');break;
   case 'win':for(let i=0;i<4;i++)tone([440,554,659,880][i],[440,554,659,880][i],.35,.11,i*.09,'triangle');break;
  }
  return true;
 }
}
