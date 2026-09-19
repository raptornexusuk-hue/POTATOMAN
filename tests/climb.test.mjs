// Executes gameplay in Node with a minimal DOM and renderer substitute. This verifies
// rules and transitions, not GPU rendering, browser input delivery or hardware feel.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DEFAULT_PITCH} from '../dist/aiming.js';
const elements=new Map(),events=new Map();globalThis.worldConstructed=0;
function el(id){if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getBoundingClientRect(){return{left:0,top:0,right:1440,bottom:900,width:1440,height:900};},addEventListener(type,fn){events.set(id+':'+type,fn);},focus(){},showModal(){this.open=true;},close(){this.open=false;},querySelector(){return el(id+'child');}});return elements.get(id);}
globalThis.document={getElementById:el,querySelectorAll(selector){return selector==='dialog[open]'?[...elements.values()].filter(e=>e.open):[];},querySelector(){return [...elements.values()].find(e=>e.open)??null;},addEventListener(type,fn){events.set('document:'+type,fn);}};globalThis.window=globalThis;globalThis.location={hash:'',href:'http://localhost/'};globalThis.matchMedia=()=>({matches:false});globalThis.addEventListener=(type,fn)=>events.set('window:'+type,fn);globalThis.requestAnimationFrame=()=>0;Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[]},configurable:true});
let code=await fs.readFile(new URL('../dist/app.js',import.meta.url),'utf8');
// Every relative import in app.js is pointed at the real file, except world.js, which is replaced
// with the stub below. This used to be a hand-written list of module names, so adding a module to
// the game broke the tests with a resolver error that named neither the test nor the reason.
code=code.replace(/'\.\/([\w-]+)\.js'/g,(whole,name)=>name==='world'?whole:JSON.stringify(new URL(`../dist/${name}.js`,import.meta.url).href));
code=code.replace("import {World,colors} from './world.js';",`const colors=[0xf1bc40,0x4ccbd3,0xef6b72,0x9b92ed];const pos=(x=0,z=0)=>({x,z,set(a,b,c){this.x=a;this.z=c;}});class World{constructor(){globalThis.worldConstructed++;if(globalThis.worldFailure)throw Error('Injected GPU failure');this.ready=globalThis.worldReady;this.cameraReady=[];}build(map,level,players,bonus){this.built=true;this.checkpoints=[map.toWorld(3,3),map.toWorld(map.n-4,map.n-4)].map(p=>({position:pos(p.x,p.z),visible:true}));this.zone={position:pos()};}crate(){return{visible:true};}marker(){return{visible:true};}burst(){}effectsUpdate(){}updatePlayers(){}syncProjectiles(){}render(p,duo){if(!this.built)throw Error('World not built');if(p.length<(duo?2:1))throw Error('Missing viewport player');}quality(){}}`);
code+=`\nexport const testAPI={audio:()=>gameAudio,init(index,isBonus=false,seed=0){circuitSeed=seed;arenaFailed=false;pendingSnapshot=null;world=new World();circuitHistory=[];circuitId=crypto.randomUUID();players=Array.from({length:4},(_,i)=>newPlayer(i));levelIndex=index;penalty.clear();nextPenalty.clear();loadRound(isBonus);introRemaining=0;},frame,setFrameClock:v=>last=v,start,showStartError,getWorld:()=>world,botInput,pause,resume,tick,inputs,keys,fire,actions,finishBonus,snapshot:()=>({players,map,state,remaining,time,bonus,targets,shots,pickups,penalty,nextPenalty,epoch:roundEpoch,paused}),next:()=>resultAction?.(),setPause:v=>{paused=v;},getSettings:()=>settings,readInputs,setMouse:v=>mouseButtons=v,getInputs:()=>inputs,setDuration:v=>{settings.roundSeconds=v;},setClock:t=>{time=t;remaining=activeDuration-t;},hit,setOnline:v=>{online=v;},becomeGuest:v=>{online=v;roundEpoch='';},makeSnapshot,finishMain,receiveRemoteSnapshot,drainSnapshots,localPlayer,guestFrame,remoteInput,loadRound,clearIntro:()=>introRemaining=0,setIntro:v=>introRemaining=v};`;
const {testAPI:a}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const {LEVELS,BONUS_TIME}=await import('../dist/core.js');
const {playerAccount}=await import('../dist/profiles.js');playerAccount.player={id:'test',name:'Test Player',motto:''};
// The climb is authored by hand, so the checks are the things a hand cannot keep true by itself:
// that every gap is inside the jump the game actually gives you, that each moving step really does
// reach both ledges it serves, that a passenger is carried, and that the whole tower can be
// climbed. Nothing here is a claim about how it feels; it is a claim about whether it is possible.
import {makeMap,moveCourse,movePlayer,jump,STEP} from '../dist/core.js';
const level=LEVELS.find(l=>l.mode==='climb'),map=makeMap(level);
const GRAVITY=22,RUN=6;
const takeoff=(()=>{const p={grounded:true,respawn:0,crouching:false,vy:0};jump(p);return p.vy;})();
// Flight time still above a given rise, and the ground covered in it at running speed.
const hang=rise=>{const disc=takeoff*takeoff-2*GRAVITY*rise;return disc<0?null:(takeoff+Math.sqrt(disc))/GRAVITY;};
const footGap=(a,b)=>Math.hypot(Math.max(0,Math.abs(a.x-b.x)-a.w/2-b.w/2),Math.max(0,Math.abs(a.z-b.z)-a.d/2-b.d/2));
assert.ok(map.course.length>=28,`a climb worth the name is more than a handful of steps: ${map.course.length}`);
assert.ok(map.motion.length>=4,'the climb has moving sections');
assert.ok(map.course.at(-1).h>20,`the tower is actually tall: ${map.course.at(-1).h}m`);
assert.equal(map.exitHeight,map.course.at(-1).h);
assert.deepEqual({x:map.exit.x,z:map.exit.z},{x:map.course.at(-1).x,z:map.course.at(-1).z});
const kinds=new Set(map.course.map(c=>c.mover?'mover':c.beam?'beam':c.wide?'ledge':'step'));
assert.deepEqual([...kinds].sort(),['beam','ledge','mover','step'],'the climb is more than one idea repeated');
// The start has to be a step away from the first platform, not a step onto nothing.
const first=map.platforms[0];assert.ok(footGap({...map.start,w:.6,d:.6},first)<hang(first.base+first.h)*RUN,'the tower can be got onto from the ground');
let statics=0,widest=0;
for(let i=1;i<map.course.length;i++){
 const before=map.course[i-1],step=map.course[i],a=map.platforms[i-1],b=map.platforms[i];
 const rise=step.h-before.h,gap=footGap(a,b);
 if(before.mover||step.mover)continue;
 assert.ok(rise<=0||hang(rise)!==null,`step ${i} rises ${rise.toFixed(2)}m, higher than a jump goes`);
 const reach=rise<=0?hang(0)*RUN:hang(rise)*RUN;
 assert.ok(gap<=reach,`step ${i} is ${gap.toFixed(2)}m across at a ${rise.toFixed(2)}m rise; a running jump covers ${reach.toFixed(2)}m`);
 widest=Math.max(widest,gap);statics++;
}
assert.ok(statics>18&&widest>1.2,`the static jumps are worth jumping: ${statics} of them, longest ${widest.toFixed(2)}m`);
// Each ride has to arrive. Sampled over a full sweep, it must come within a step of the platform
// before it and the one after, or it is a lift to nowhere.
for(const m of map.motion){
 const index=m.course.index,before=map.platforms[index-1],after=map.platforms[index+1];
 let nearBefore=Infinity,nearAfter=Infinity,lowest=Infinity,highest=-Infinity;
 for(let t=0;t<m.period*2;t+=m.period/240){moveCourse(map,t);const live=map.platforms[index];
  nearBefore=Math.min(nearBefore,footGap(live,before)+Math.abs(live.base+live.h-(before.base+before.h)));
  nearAfter=Math.min(nearAfter,footGap(live,after)+Math.abs(live.base+live.h-(after.base+after.h)));
  lowest=Math.min(lowest,live.base+live.h);highest=Math.max(highest,live.base+live.h);}
 assert.ok(nearBefore<.45,`the ride at step ${index} never reaches the ledge that loads it (${nearBefore.toFixed(2)}m)`);
 assert.ok(nearAfter<.45,`the ride at step ${index} never reaches the ledge it unloads onto (${nearAfter.toFixed(2)}m)`);
 assert.ok(highest-lowest>1||footGap(before,after)>hang(0)*RUN,`the ride at step ${index} crosses a gap that could simply be jumped`);
}
console.log(`PASS ${map.course.length} climb steps: every jump inside the jump the game gives, every ride reaching both its ledges`);
// A passenger travels with the platform rather than standing still while it leaves.
{
 const m=map.motion.find(m=>m.axis!=='y');moveCourse(map,0);
 const ride=map.platforms[m.course.index],rider={id:9,x:ride.x,z:ride.z,y:ride.base+ride.h,vy:0,grounded:true,crouching:false,respawn:0,dashTime:0,runBoost:0};
 const still={...rider,x:map.platforms[m.course.index-1].x,z:map.platforms[m.course.index-1].z,y:map.platforms[m.course.index-1].base+map.platforms[m.course.index-1].h};
 const input={x:0,z:0,crouch:false};let travelled=0;
 for(let t=0,n=0;n<240;n++,t+=STEP){moveCourse(map,t);const was={x:rider.x,z:rider.z};
  movePlayer(rider,input,STEP,map);movePlayer(still,input,STEP,map);
  travelled+=Math.hypot(rider.x-was.x,rider.z-was.z);
  assert.ok(Math.abs(rider.y-(ride.base+ride.h))<.02,'a passenger stays on the deck of the platform carrying them');
  assert.ok(Math.hypot(rider.x-ride.x,rider.z-ride.z)<.05,'and stays where they stood on it');}
 assert.ok(travelled>1.5,`the platform actually went somewhere: ${travelled.toFixed(2)}m`);
 assert.equal(Math.hypot(still.x-map.platforms[m.course.index-1].x,still.z-map.platforms[m.course.index-1].z),0,'nobody standing on solid ground is dragged along with it');
}
// How far a passenger is carried is a property of the platform and the time, not of how the caller
// chose to chop that time up. Stepping the platforms once per frame and the player in fixed
// substeps carried a rider several times the distance the platform actually went.
{
 const m=map.motion.find(m=>m.axis!=='y'),index=m.course.index;
 const carry=substep=>{moveCourse(map,0);const ride=map.platforms[index];
  const rider={id:9,x:ride.x,z:ride.z,y:ride.base+ride.h,vy:0,grounded:true,crouching:false,respawn:0,dashTime:0,runBoost:0};
  for(let clock=0;clock<2;){const d=Math.min(substep,2-clock);clock+=d;moveCourse(map,clock);movePlayer(rider,{x:0,z:0,crouch:false},d,map);}
  return{x:rider.x,z:rider.z};};
 const fine=carry(STEP),coarse=carry(STEP*4);
 assert.ok(Math.hypot(fine.x-coarse.x,fine.z-coarse.z)<.06,`a two-second ride has to be the same ride at either step size: ${JSON.stringify({fine,coarse})}`);
 moveCourse(map,2);
 assert.ok(Math.hypot(fine.x-map.platforms[index].x,fine.z-map.platforms[index].z)<.06,'and the passenger ends where the platform ended, not past it');
}
console.log('PASS a climber standing on a moving platform is carried by it, one standing beside it is not, and the ride is the same at any step size');
// And the whole thing can be climbed: three bots, from the floor to the top, inside a round.
const dt=1/120;
a.init(LEVELS.findIndex(l=>l.mode==='climb'));a.clearIntro();
const done=new Map();let ticks=0;
while(a.snapshot().state==='playing'&&ticks++<120*120){a.tick(dt);
 for(const p of a.snapshot().players)if(p.score>0&&!done.has(p.id))done.set(p.id,ticks/120);}
assert.equal(done.size,3,`every bot has to get to the top; ${done.size} did`);
const slowest=Math.max(...done.values());
assert.ok(slowest<110,`and inside a round: slowest ascent ${slowest.toFixed(1)}s`);
assert.ok(slowest>25,`a climb this long should not be over in a moment: ${slowest.toFixed(1)}s`);
console.log(`PASS all three climbers reach the summit, slowest in ${slowest.toFixed(1)}s`);
