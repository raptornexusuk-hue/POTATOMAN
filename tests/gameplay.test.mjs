// Executes gameplay in Node with a minimal DOM and renderer substitute. This verifies
// rules and transitions, not GPU rendering, browser input delivery or hardware feel.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DEFAULT_PITCH} from '../dist/aiming.js';
const elements=new Map(),events=new Map();globalThis.worldConstructed=0;
function el(id){if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'',style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getBoundingClientRect(){return{left:0,top:0,right:1440,bottom:900,width:1440,height:900};},addEventListener(type,fn){events.set(id+':'+type,fn);},focus(){},showModal(){this.open=true;},close(){this.open=false;},querySelector(){return el(id+'child');}});return elements.get(id);}
globalThis.document={getElementById:el,querySelectorAll(selector){return selector==='dialog[open]'?[...elements.values()].filter(e=>e.open):[];},querySelector(){return [...elements.values()].find(e=>e.open)??null;},addEventListener(type,fn){events.set('document:'+type,fn);}};globalThis.window=globalThis;globalThis.location={hash:'',href:'http://localhost/'};globalThis.matchMedia=()=>({matches:false});globalThis.addEventListener=(type,fn)=>events.set('window:'+type,fn);globalThis.requestAnimationFrame=()=>0;Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[]},configurable:true});
let code=await fs.readFile(new URL('../dist/app.js',import.meta.url),'utf8');
for(const file of['progression','map-catalogue','camera-input','game-audio','difficulty','weapons','stance','aiming','weapon-pickup','spatial-audio','locker'])code=code.replace(`'./${file}.js'`,JSON.stringify(new URL(`../dist/${file}.js`,import.meta.url).href));
code=code.replace("'./profiles.js'",JSON.stringify(new URL('../dist/profiles.js',import.meta.url).href));
code=code.replace("'./network.js'",JSON.stringify(new URL('../dist/network.js',import.meta.url).href)).replace("'./net-state.js'",JSON.stringify(new URL('../dist/net-state.js',import.meta.url).href));
code=code.replace("'./core.js'",JSON.stringify(new URL('../dist/core.js',import.meta.url).href)).replace("'./controls.js'",JSON.stringify(new URL('../dist/controls.js',import.meta.url).href));
code=code.replace("import {World,colors} from './world.js';",`const colors=[0xf1bc40,0x4ccbd3,0xef6b72,0x9b92ed];const pos=(x=0,z=0)=>({x,z,set(a,b,c){this.x=a;this.z=c;}});class World{constructor(){globalThis.worldConstructed++;if(globalThis.worldFailure)throw Error('Injected GPU failure');this.ready=globalThis.worldReady;this.cameraReady=[];}build(map,level,players,bonus){this.built=true;this.checkpoints=[map.toWorld(3,3),map.toWorld(map.n-4,map.n-4)].map(p=>({position:pos(p.x,p.z),visible:true}));this.zone={position:pos()};}crate(){return{visible:true};}marker(){return{visible:true};}burst(){}effectsUpdate(){}updatePlayers(){}syncProjectiles(){}render(p,duo){if(!this.built)throw Error('World not built');if(p.length<(duo?2:1))throw Error('Missing viewport player');}quality(){}}`);
code+=`\nexport const testAPI={audio:()=>gameAudio,init(index,isBonus=false,seed=0){circuitSeed=seed;arenaFailed=false;pendingSnapshot=null;world=new World();circuitHistory=[];circuitId=crypto.randomUUID();players=Array.from({length:4},(_,i)=>newPlayer(i));levelIndex=index;penalty.clear();nextPenalty.clear();loadRound(isBonus);introRemaining=0;},frame,setFrameClock:v=>last=v,start,showStartError,getWorld:()=>world,botInput,pause,resume,tick,inputs,keys,fire,actions,finishBonus,snapshot:()=>({players,map,state,remaining,time,bonus,targets,shots,pickups,penalty,nextPenalty,epoch:roundEpoch,paused}),next:()=>resultAction?.(),setPause:v=>{paused=v;},getSettings:()=>settings,readInputs,setMouse:v=>mouseButtons=v,getInputs:()=>inputs,setDuration:v=>{settings.roundSeconds=v;},setClock:t=>{time=t;remaining=activeDuration-t;},hit,setOnline:v=>{online=v;},becomeGuest:v=>{online=v;roundEpoch='';},makeSnapshot,finishMain,receiveRemoteSnapshot,drainSnapshots,localPlayer,guestFrame,remoteInput,loadRound,clearIntro:()=>introRemaining=0,setIntro:v=>introRemaining=v};`;
const {testAPI:a}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const {LEVELS,BONUS_TIME}=await import('../dist/core.js');
const {playerAccount}=await import('../dist/profiles.js');playerAccount.player={id:'test',name:'Test Player',motto:''};
const dt=1/120;
// Levels are addressed by mode, not by index, so adding maps to the circuit cannot silently
// re-point a test at a different round.
const levelOf=mode=>LEVELS.findIndex(l=>l.mode===mode);
const {equipWeapon,WEAPONS}=await import('../dist/weapons.js');
for(const i of LEVELS.map((_,idx)=>idx).filter(idx=>LEVELS[idx].mode==='race')){a.init(i);let count=0;while(a.snapshot().state==='playing'&&count++<14402)a.tick(dt);const s=a.snapshot();assert.equal(s.state,'results');assert.ok(Math.abs(s.time-120)<dt*1.1);for(const p of s.players.slice(1))assert.ok(Number.isFinite(p.best),`Level ${i+1}, bot ${p.id} failed to escape`);console.log(`PASS level ${i+1}: full 2-minute race, all AI rivals escaped`);}
for(const i of[levelOf('smash')]){a.init(i);const t=a.snapshot().targets;assert.equal(t.length,14);assert.equal(new Set(t.map(p=>p.x+','+p.z)).size,t.length);console.log(`PASS level ${i+1}: destruction targets do not overlap`);}
a.init(0,true);let s=a.snapshot();const runner=s.players.find(p=>p.runner);assert.ok(s.players.filter(p=>!p.runner).every(p=>Math.hypot(p.x-runner.x,p.z-runner.z)>5));assert.equal(s.pickups.length,1);const bonusGun=s.pickups[0];assert.equal(bonusGun.weapon,'masher');assert.equal(bonusGun.phase,'available');Object.assign(s.players[1],{x:bonusGun.x,z:bonusGun.z});a.tick(dt);assert.equal(s.players.filter(p=>p.gun).length,1);assert.equal(bonusGun.phase,'held');console.log('PASS bonus: separate starts and one shared finite gun');
a.finishBonus(true);a.next();s=a.snapshot();assert.equal(s.bonus,false);assert.equal(s.penalty.size,3);assert.equal(s.remaining,120);a.clearIntro();a.fire(s.players[1]);for(let i=0;i<15;i++)a.tick(dt);assert.ok(Math.abs(Math.hypot(s.shots[0].vx,s.shots[0].vz)-20.7)<1e-8);a.setClock(16);s.players[1].throwCD=0;s.players[1].shotAnim=0;a.fire(s.players[1]);for(let i=0;i<15;i++)a.tick(dt);assert.ok(Math.abs(Math.hypot(s.shots[1].vx,s.shots[1].vz)-23)<1e-8);console.log('PASS escape consequence: 10% launch-speed penalty expires after 15 seconds');
a.init(0);a.setPause(true);const before=JSON.stringify(a.snapshot());a.tick(dt);assert.equal(JSON.stringify(a.snapshot()),before);console.log('PASS pause freezes positions, timers and all gameplay state');
a.setPause(false);a.setClock(119.999);a.tick(dt);assert.equal(a.snapshot().state,'results');a.next();assert.equal(a.snapshot().bonus,true);a.finishBonus(false);a.next();assert.equal(a.snapshot().penalty.size,0);assert.equal(a.snapshot().remaining,120);console.log('PASS main → bonus → next level with normal throws after a hunter win');

// Mouse firing is configurable and must release cleanly while panning remains independent.
a.init(0);a.setMouse(2);a.readInputs(dt);assert.equal(a.getInputs()[0].fire,false);assert.equal(a.getInputs()[0].catch,false);a.setMouse(4);a.readInputs(dt);assert.equal(a.getInputs()[0].fire,false);assert.equal(a.getInputs()[0].catch,false);a.setMouse(3);a.readInputs(dt);assert.equal(a.getInputs()[0].fire,true);a.setMouse(2);a.readInputs(dt);assert.equal(a.getInputs()[0].fire,false);a.setMouse(0);console.log('PASS left mouse fires, right/middle do not, and release stops firing');
const {bindKey}=await import('../dist/controls.js');bindKey(a.getSettings(),0,'forward','KeyZ');a.keys.add('KeyW');a.readInputs(dt);assert.equal(Math.hypot(a.getInputs()[0].x,a.getInputs()[0].z),0);a.keys.clear();a.keys.add('KeyZ');a.readInputs(dt);assert.ok(Math.hypot(a.getInputs()[0].x,a.getInputs()[0].z)>.99);a.keys.clear();console.log('PASS remapped key drives gameplay and the old key is released');
a.setDuration(90);a.init(0);assert.equal(a.snapshot().remaining,90);a.setDuration(300);assert.equal(a.snapshot().remaining,90);a.setClock(89.999);a.tick(dt);a.next();assert.equal(a.snapshot().remaining,BONUS_TIME);a.finishBonus(false);a.next();assert.equal(a.snapshot().remaining,300);console.log('PASS level duration is captured per round; the hunt keeps its own fixed length');

// Exercise guest slot selection, snapshot round initialization and host input application.
a.setDuration(120);a.init(0);a.setIntro(2.5);const initial=a.snapshot().remaining;for(let i=0;i<300;i++)a.tick(dt);assert.equal(a.snapshot().remaining,initial);a.clearIntro();
const roster=[{slot:0,name:'HOST'},{slot:1,name:'GUEST'}],host={slot:0,isHost:true,roster,remoteInputs:new Map()};a.setOnline(host);let epoch=a.snapshot().epoch;host.remoteInputs.set(1,{data:{epoch,seq:1,x:-1,z:0,yaw:-Math.PI/2,pitch:0,fire:false,dodge:0,catch:0},received:performance.now()});const x=a.snapshot().players[1].x;a.tick(dt);assert.ok(a.snapshot().players[1].x<x);const snap=a.makeSnapshot();assert.equal(snap.acks[1],1);
const guest={slot:1,isHost:false,roster,remoteInputs:new Map()};a.becomeGuest(guest);a.receiveRemoteSnapshot(snap);assert.equal(a.localPlayer().id,1);assert.equal(a.snapshot().players.length,4);assert.equal(a.snapshot().epoch,snap.epoch);a.guestFrame(dt);assert.equal(a.snapshot().state,'playing');
let me=a.localPlayer();me.panX=1;me.pitch=.4;a.keys.add(a.getSettings().keys[0].resetCamera);a.guestFrame(dt);a.keys.clear();assert.equal(me.panX,0);assert.equal(me.pitch,DEFAULT_PITCH);
a.setOnline(host);a.finishMain();const result=a.makeSnapshot(),totals=result.players.map(p=>p.total);a.setOnline(guest);a.receiveRemoteSnapshot(result);a.receiveRemoteSnapshot({...result,seq:result.seq+1});assert.deepEqual(a.snapshot().players.map(p=>p.total),totals);assert.equal(a.snapshot().state,'results');
a.setOnline(host);a.loadRound(true);a.clearIntro();const bonusPacket=a.makeSnapshot();a.setOnline(guest);a.receiveRemoteSnapshot(bonusPacket);assert.equal(a.snapshot().bonus,true);assert.equal(a.snapshot().players.filter(p=>p.runner).length,1);
a.setOnline(null);a.init(2);const victim=a.snapshot().players[1];victim.invuln=0;victim.hp=40;a.hit(victim,{owner:0,vx:0,vz:24,gun:false,damage:40});assert.equal(a.snapshot().players[0].score,0);assert.equal(a.snapshot().players[0].knockouts,1);
console.log('PASS round briefing clock, remote human input, processed acknowledgments, guest view/reset, result idempotence and bonus rebuild');
// Deliver the actual registered pointer handlers: moving with no button must pan, without a first-entry jump.
a.init(0);let player=a.snapshot().players[0],yaw=player.yaw;events.get('world:mousemove')({pointerType:'mouse',clientX:1000,clientY:500,buttons:0});assert.equal(player.yaw,yaw);events.get('world:mouseenter')({clientX:1000,clientY:500});events.get('world:mousemove')({pointerType:'mouse',clientX:1020,clientY:510,buttons:0});assert.notEqual(player.yaw,yaw);a.readInputs(dt);assert.equal(a.getInputs()[0].fire,false);
console.log('PASS out-of-box hover panning has no first-entry jump or unsolicited firing');

// Long foreground frames must not pause or execute an unbounded simulation backlog.
a.init(0);a.keys.add(a.getSettings().keys[0].forward);const beforeStall=a.snapshot().remaining;a.setFrameClock(1000);a.frame(2000);assert.equal(a.snapshot().paused,false);assert.equal(a.snapshot().state,'playing');assert.ok(beforeStall-a.snapshot().remaining<=8*dt+1e-8);a.keys.clear();
events.get('window:blur')();assert.equal(a.snapshot().paused,true);a.resume();assert.equal(a.snapshot().paused,false);a.frame(2300);assert.equal(a.snapshot().paused,false);
console.log('PASS one-second foreground stall stays playable with bounded catch-up; intentional blur pause resumes');

// Guest failure retains the latest snapshot but waits for an explicit retry.
a.init(2);a.setOnline(host);const recoveryPacket=a.makeSnapshot();a.setOnline(guest);el('onlineDialog').showModal();a.showStartError('Injected arena failure');assert.equal(el('onlineDialog').open,false);assert.equal(el('error').hidden,false);const count=globalThis.worldConstructed;
a.receiveRemoteSnapshot(recoveryPacket);a.receiveRemoteSnapshot({...recoveryPacket,seq:recoveryPacket.seq+1});assert.equal(globalThis.worldConstructed,count);let ready;globalThis.worldReady=new Promise(r=>ready=r);el('retryStart').onclick();assert.equal(a.snapshot().state,'loading');assert.equal(a.getWorld().built,undefined);a.frame(2400);ready();await new Promise(setImmediate);globalThis.worldReady=undefined;assert.equal(a.snapshot().state,'playing');assert.equal(a.getWorld().built,true);assert.equal(a.snapshot().epoch,recoveryPacket.epoch);assert.equal(el('hud').hidden,false);assert.equal(el('error').hidden,true);a.guestFrame(dt);
console.log('PASS same-epoch online retry rebuilds before play; failures cannot trigger retry storms or hide behind dialogs');

// Failure -> retry is useful for a solo player too, and concurrent Play clicks are ignored.
a.setOnline(null);a.showStartError('Test solo retry');globalThis.worldFailure=true;const oldRAF=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>{queueMicrotask(()=>fn(performance.now()));return 1;};await a.start(1);assert.equal(a.snapshot().state,'menu');assert.equal(el('error').hidden,false);globalThis.worldFailure=false;const attempts=globalThis.worldConstructed;await Promise.all([a.start(1),a.start(1)]);assert.equal(globalThis.worldConstructed,attempts+1);assert.equal(a.snapshot().state,'playing');assert.equal(el('error').hidden,true);assert.equal(el('loading').hidden,true);globalThis.requestAnimationFrame=oldRAF;
console.log('PASS failed solo level can retry successfully; duplicate Play clicks cannot race');

// AI tuning changes bots only. Chill holds its sampled aim and respects a slower cadence.
a.init(0);let sim=a.snapshot(),bot=sim.players[1];sim.map.walls=[];Object.assign(bot,{x:0,z:0,yaw:0,botDelay:0});Object.assign(sim.players[0],{x:0,z:-10});for(const p of sim.players.slice(2))Object.assign(p,{x:100,z:100});a.setClock(10);assert.equal(a.botInput(bot,dt).fire,false);const sampled={...bot.aiAim};sim.players[0].x=2;a.setClock(10.2);a.botInput(bot,.2);assert.deepEqual(bot.aiAim,sampled);let fired=0;for(let i=0;i<360;i++){a.setClock(10+i*dt);bot.throwCD=Math.max(0,bot.throwCD-dt);bot.shotAnim=Math.max(0,bot.shotAnim-dt);const input=a.botInput(bot,dt);if(input.fire){fired++;a.fire(bot);}}assert.ok(fired>0&&fired<=2,`Chill fired ${fired} potatoes in 3s`);for(let i=0;i<80;i++){sim.shots.unshift({id:1000+i,owner:0,x:bot.x,z:bot.z,gun:false});assert.equal(a.botInput(bot,dt).catch,false);}a.getSettings().difficulty='hard';const human=sim.players[0];human.throwCD=0;a.fire(human);assert.equal(human.throwCD,.62);a.getSettings().difficulty='chill';
console.log('PASS Chill bots delay acquisition, hold aim, fire less often and never catch; human cooldown stays responsive');

// Movement and collection rules use the same simulation in every render path.
a.setOnline(null);a.init(levelOf('assault'));let courseTicks=0;while(a.snapshot().state==='playing'&&courseTicks++<14402)a.tick(dt);
for(const p of a.snapshot().players.slice(1))assert.ok(Number.isFinite(p.best),`Assault bot ${p.id} failed at platform ${p.courseStep}, y=${p.y}`);
console.log('PASS every Chill bot completes the full jumping assault course within two minutes');
a.init(0);let powers=a.snapshot();assert.equal(powers.pickups.filter(p=>p.kind!=='weapon').length,4);const boost=powers.pickups.find(b=>b.kind==='run'),hero=powers.players[0];Object.assign(hero,{x:boost.x,z:boost.z});a.tick(dt);assert.ok(hero.runBoost>11);assert.equal(boost.collected,true);Object.assign(hero,{x:mapStartSafe(powers).x,z:mapStartSafe(powers).z});for(let i=0;i<2161;i++)a.tick(dt);assert.equal(boost.collected,false);assert.equal(hero.runBoost,0);
function mapStartSafe(s){return s.map.toWorld(1,1);}
hero.fireBoost=12;hero.throwCD=0;a.fire(hero);assert.equal(hero.throwCD,.62*.53);for(let i=0;i<40;i++)a.tick(dt);hero.fireBoost=0;hero.throwCD=0;a.fire(hero);assert.equal(hero.throwCD,.62);
console.log('PASS shared pickups collect once, expire, respawn and change actual fire cadence');
a.init(levelOf('assault'));let course=a.snapshot();const racer=course.players[0];Object.assign(racer,course.map.exit);a.tick(dt);assert.equal(racer.score,0);assert.equal(racer.best,Infinity);
console.log('PASS assault exit rejects skipped checkpoints');
for(const seed of[3,717,90001]){a.init(LEVELS.length-1,false,seed);let t=0;while(a.snapshot().state==='playing'&&t++<14402)a.tick(dt);assert.ok(a.snapshot().players.slice(1).every(p=>Number.isFinite(p.best)),`Remixed finale ${seed} must be completable`);}
console.log('PASS varied finale seeds stay completable at Chill difficulty and two-minute duration');
// A guest with a different preferred round time must rebuild the host's exact maze.
a.setOnline(host);a.setDuration(60);a.init(LEVELS.length-1,false,22);const shortRound=a.makeSnapshot(),hostMaze=JSON.stringify(a.snapshot().map.grid);a.setDuration(300);a.getSettings().remix=false;a.becomeGuest(guest);a.receiveRemoteSnapshot(shortRound);await new Promise(setImmediate);assert.equal(JSON.stringify(a.snapshot().map.grid),hostMaze);assert.equal(a.snapshot().remaining,60);a.setOnline(null);a.setDuration(120);a.getSettings().remix=true;
console.log('PASS guests rebuild the identical remixed maze using host seed and active duration');
a.init(0);let combat=a.snapshot();combat.players.forEach(p=>p.botDelay=999);let pad=combat.pickups.find(p=>p.kind==='weapon');const padKind=pad.weapon;assert.equal(combat.pickups.filter(p=>p.kind==='weapon').length,1);assert.equal(pad.collected,false);a.setIntro(2.5);const introTime=combat.remaining;for(let i=0;i<300;i++)a.tick(dt);assert.equal(a.snapshot().remaining,introTime);a.clearIntro();const gunner=combat.players[0];Object.assign(gunner,{x:pad.x,z:pad.z});a.tick(dt);assert.equal(gunner.weapon,padKind);assert.equal(gunner.mag,WEAPONS[padKind].ammo);
combat.map.walls=[];Object.assign(gunner,{x:0,z:0,yaw:-Math.asin(.6/6),pitch:0,throwCD:0,invuln:0});const target=combat.players[1];Object.assign(target,{x:0,z:-6,hp:140,invuln:0});combat.players.slice(2).forEach(p=>Object.assign(p,{x:20,z:20}));a.fire(gunner);for(let i=0;i<60;i++)a.tick(dt);assert.ok(target.respawn>0);assert.equal(gunner.knockouts,1);equipWeapon(target,'scatter');target.respawn=.001;a.tick(dt);assert.equal(target.weapon,'throw');assert.equal(target.reload,0);assert.equal(target.gun,false);
console.log('PASS one opening shared box, fair intro freeze, RPG direct-hit elimination and base-weapon respawn');

// Audio snapshots deliver each world event once and never replay muted/paused backlog.
const {validSnapshot}=await import('../dist/net-state.js');a.setOnline(null);a.init(0);let audioState=a.snapshot();audioState.players.forEach(p=>p.botDelay=999);a.fire(audioState.players[0]);for(let i=0;i<15;i++)a.tick(dt);const packetOne=a.makeSnapshot();assert.ok(validSnapshot(packetOne));assert.ok(packetOne.audioEvents.some(e=>e.type==='shot_throw'));
for(const mutate of [s=>s.pickups.push({...s.pickups.find(p=>p.kind==='weapon'),id:7}),s=>s.pickups.find(p=>p.kind==='weapon').x=NaN,s=>s.pickups.find(p=>p.kind==='weapon').ammo=9999,s=>s.pickups.find(p=>p.kind==='weapon').phase='invalid']){const invalid=structuredClone(packetOne);mutate(invalid);assert.equal(validSnapshot(invalid),false);}
const played=[],engine=a.audio(),originalEffect=engine.effect;engine.effect=(type,position)=>{if(a.getSettings().sound)played.push({type,position});};a.becomeGuest(guest);a.receiveRemoteSnapshot(packetOne);assert.equal(played.length,0);
let serial=packetOne.audioEvents.at(-1).id;const packetWithSound=()=>({...packetOne,seq:packetOne.seq+(++serial),audioEvents:[{id:serial,type:'boost_run',x:2,y:1,z:3,time:packetOne.time}]});
const eventTwo=packetWithSound();a.receiveRemoteSnapshot(eventTwo);a.receiveRemoteSnapshot(eventTwo);assert.equal(played.length,1);assert.equal(played[0].position.x,2);a.getSettings().sound=false;const eventThree=packetWithSound();a.receiveRemoteSnapshot(eventThree);a.getSettings().sound=true;a.receiveRemoteSnapshot(eventThree);assert.equal(played.length,1);a.setPause(true);const eventFour=packetWithSound();a.receiveRemoteSnapshot(eventFour);a.setPause(false);a.receiveRemoteSnapshot(eventFour);assert.equal(played.length,1);engine.effect=originalEffect;a.setOnline(null);
console.log('PASS strict shared-item snapshots and guest spatial audio dedupe, initial sync, mute and pause watermarks');

a.init(0);const progression=a.snapshot();progression.players.forEach(p=>p.botDelay=999);const thrower=progression.players[0],rival=progression.players[1];rival.invuln=0;
assert.equal(thrower.weapon,'throw');
for(let i=0;i<3;i++)a.hit(rival,{owner:0,vx:0,vz:-23,gun:false,weapon:'throw',damage:10});
assert.equal(thrower.weapon,'throw','landing hits is no longer enough; the gun is earned by a knockout');
a.hit(rival,{owner:0,vx:0,vz:-23,gun:false,weapon:'throw',damage:200});
assert.equal(thrower.weapon,'spud');assert.equal(thrower.weaponLevel,1);assert.equal(thrower.kills,1,'objective rounds still count knockouts');
thrower.invuln=0;a.hit(thrower,{owner:1,vx:0,vz:23,gun:false,damage:200});
for(let i=0;i<365;i++)a.tick(dt);assert.equal(thrower.weapon,'throw','every death returns to hand throwing');assert.equal(thrower.weaponLevel,0);
const shared=progression.pickups.find(p=>p.kind==='weapon');Object.assign(thrower,{x:shared.x,z:shared.z});a.tick(dt);assert.equal(thrower.weaponLevel,2);const held=thrower.weapon,ammo=thrower.mag;
thrower.invuln=0;a.hit(thrower,{owner:1,vx:0,vz:23,gun:false,damage:200});assert.equal(shared.phase,'available');assert.equal(shared.weapon,held);assert.equal(shared.ammo,ammo);
for(let i=0;i<365;i++)a.tick(dt);assert.equal(thrower.weapon,'throw');
console.log('PASS a knockout earns the base gun; ordinary death resets it; special-weapon death drops remaining ammo and returns to hands');
// Being dead beats earning: a knockout landed by a still-travelling projectile after its owner
// has been mashed must not hand that corpse a gun to respawn with.
a.init(0);const resetMatch=a.snapshot(),resetPlayer=resetMatch.players[0],resetRival=resetMatch.players[1];resetMatch.players.forEach(p=>p.botDelay=999);resetMatch.pickups.forEach(p=>{p.x=p.z=1000;});
Object.assign(resetPlayer,{invuln:0});a.hit(resetPlayer,{owner:1,vx:0,vz:23,gun:false,damage:200});resetRival.invuln=0;
a.hit(resetRival,{owner:0,vx:0,vz:-23,gun:false,weapon:'throw',damage:200});
assert.equal(resetPlayer.weaponLevel,0);
for(let i=0;i<365;i++)a.tick(dt);assert.equal(resetPlayer.weapon,'throw');
resetRival.invuln=0;a.hit(resetRival,{owner:0,vx:0,vz:-23,gun:false,weapon:'throw',damage:200});assert.equal(resetPlayer.weapon,'spud');
// Water deaths follow the same rule, including host-to-guest state.
let waterMatch;for(let i=0;i<10;i++){a.init(i);waterMatch=a.snapshot();if(waterMatch.map.waterCells.length)break;}const waterPlayer=waterMatch.players[0];waterMatch.players.forEach(p=>p.botDelay=999);const water=waterMatch.map.waterCells[0];assert.ok(water);equipWeapon(waterPlayer,'spud');waterPlayer.weaponLevel=1;Object.assign(waterPlayer,{x:water.x,z:water.z,y:0,invuln:0});a.tick(dt);assert.ok(waterPlayer.respawn>0);for(let i=0;i<185;i++)a.tick(dt);assert.equal(waterPlayer.weapon,'throw');assert.equal(waterPlayer.weaponLevel,0);
const resetPacket=a.makeSnapshot();a.becomeGuest(guest);a.receiveRemoteSnapshot(resetPacket);await new Promise(setImmediate);const guestPlayer=a.snapshot().players[0];assert.equal(guestPlayer.weapon,'throw');assert.equal(guestPlayer.weaponLevel,0);a.setOnline(null);
console.log('PASS death resets progression, a post-death knockout cannot promote, a fresh kill re-earns the gun, and water/guest respawns use throwing');


a.init(0);const waiting=a.snapshot(),humanOnly={slot:0,isHost:true,roster:[{slot:0},{slot:1},{slot:2}],remoteInputs:new Map()};a.setOnline(humanOnly);const beforeHumans=waiting.players.slice(1).map(p=>({x:p.x,z:p.z}));
for(let i=0;i<120;i++)a.tick(dt);assert.deepEqual(waiting.players.slice(1).map(p=>({x:p.x,z:p.z})),beforeHumans);assert.equal(waiting.players[3].played,0);assert.equal(a.snapshot().shots.length,0);a.setOnline(null);
console.log('PASS absent online input never creates bot movement or shooting, and unrostered players do not simulate');

// Compare real held-fire cadence and release timing, including cancellation and close cover.
function firingRange(kind){a.setOnline(null);a.init(0);const range=a.snapshot();range.map.walls=[];range.map.platforms=[];range.pickups.forEach(item=>{item.x=item.z=1000;});range.players.forEach((p,i)=>Object.assign(p,{x:40+i*4,z:40,botDelay:999,invuln:0}));const p=range.players[0];Object.assign(p,{x:0,z:0,y:0,yaw:0,pitch:0});equipWeapon(p,kind);return{range,p};}
let setup=firingRange('throw');a.fire(setup.p);assert.equal(setup.range.shots.length,0,'throw has a visible wind-up');for(let i=0;i<14;i++)a.tick(dt);assert.equal(setup.range.shots.length,0);a.tick(dt);assert.equal(setup.range.shots.length,1);assert.ok(a.makeSnapshot().audioEvents.some(e=>e.type==='shot_throw'),'throw sound occurs at release');
setup=firingRange('throw');a.fire(setup.p);setup.p.respawn=3;for(let i=0;i<20;i++)a.tick(dt);assert.equal(setup.range.shots.length,0,'death cancels an unreleased potato');
setup=firingRange('throw');a.fire(setup.p);equipWeapon(setup.p,'spud');for(let i=0;i<20;i++)a.tick(dt);assert.equal(setup.range.shots.length,0,'weapon changes cancel an unreleased potato');
const counts={};for(const kind of['throw','spud']){setup=firingRange(kind);a.setMouse(1);const seen=new Set();for(let i=0;i<240;i++){a.tick(dt);for(const s of setup.range.shots)if(s.owner===0)seen.add(s.id);}a.setMouse(0);counts[kind]=seen.size;}assert.ok(counts.spud>=counts.throw*1.5,JSON.stringify(counts));
setup=firingRange('spud');setup.range.map.walls.push({x:0,z:-.5,w:4,d:.1,h:4});Object.assign(setup.range.players[1],{x:0,z:-1.5,hp:100});a.fire(setup.p);assert.equal(setup.range.shots.length,1,'gun fires immediately');for(let i=0;i<30;i++)a.tick(dt);assert.equal(setup.range.players[1].hp,100,'barrel crossing cover cannot shoot through it');assert.equal(setup.range.shots.length,0);
console.log(`PASS overhead wind-up/release, death/equip cancellation, immediate gunfire, cover blocking and faster spud-gun cadence (${counts.spud} vs ${counts.throw} in two seconds)`);

// Append to tests/gameplay.test.mjs. Uses existing a, dt and firingRange helpers.
{
 const {range:probe,p}=firingRange('throw');p.fireBoost=12;a.setMouse(1);
 const starts=[],seen=new Set();
 for(let i=0;i<240;i++){
  const before=p.shotAnim;a.tick(dt);
  if(p.shotAnim>before+1e-9){
   assert.ok(before<=dt+1e-9,`boosted held throw reset with ${before.toFixed(3)}s of old animation left`);
   starts.push(a.snapshot().time);
  }
  for(const s of probe.shots)if(s.owner===p.id)seen.add(s.id);
 }
 a.setMouse(0);
 assert.equal(seen.size,6,'boosted held throw must preserve six releases in two seconds');
 for(let i=1;i<starts.length;i++)assert.ok(Math.abs(starts[i]-starts[i-1]-1/3)<1e-8,'boosted start cadence must stay at the existing 40 simulation ticks');
 // The wind-up remains 120 ms even when recovery is shortened.
 const reset=firingRange('throw');reset.p.fireBoost=12;a.fire(reset.p);
 for(let i=0;i<14;i++)a.tick(dt);
 assert.equal(reset.range.shots.length,0,'boost must preserve the wind-up');
 a.tick(dt);assert.equal(reset.range.shots.length,1,'boosted release remains on the fifteenth 120 Hz tick');
 console.log('PASS boosted throw fully recovers at unchanged cadence and preserves wind-up');
}

// Append to tests/gameplay.test.mjs. Uses existing a, dt and firingRange helpers.
{
 const {range:probe,p}=firingRange('throw');a.fire(p);a.setMouse(1);
 for(let i=0;i<4;i++)a.tick(dt);
 p.catchTime=.26;a.hit(p,{owner:1,vx:0,vz:23,gun:false,damage:34});assert.equal(p.hp,100);
 const releases=[],seen=new Set();
 for(let i=0;i<90;i++){
  const before=p.shotAnim;a.tick(dt);
  if(p.shotAnim>before+1e-9)assert.ok(before<=dt+1e-9,`catch restarted throw with ${before.toFixed(3)}s of release/recovery left`);
  for(const s of probe.shots)if(s.owner===p.id&&!seen.has(s.id)){seen.add(s.id);releases.push(a.snapshot().time);}
 }
 a.setMouse(0);
 assert.ok(Math.abs(releases[0]-.125)<1e-8,'catch must not delay the existing pending throw');
 assert.ok(releases.length>=2,'held fire must resume after recovery');
 console.log('PASS catch reset preserves pending release and waits for recovery before rethrow');
}

// Append to tests/gameplay.test.mjs. Uses its existing a, dt and firingRange helpers.
{
 const {range:probe,p}=firingRange('throw');
 probe.pickups.forEach(item=>{item.x=-12;item.z=12;});
 Object.assign(probe.players[1],{x:6,z:6});
 const roster=[{slot:0,name:'HOST'},{slot:1,name:'GUEST'}];
 const probeHost={slot:0,isHost:true,roster,remoteInputs:new Map()};
 const probeGuest={slot:1,isHost:false,roster,remoteInputs:new Map()};
 a.setOnline(probeHost);
 for(const q of probe.players.slice(0,2)){a.fire(q);q.catchTime=.21;}
 for(let i=0;i<6;i++)a.tick(dt);
 const packet=a.makeSnapshot();
 a.becomeGuest(probeGuest);a.receiveRemoteSnapshot(packet);await new Promise(setImmediate);
 const visualBefore=a.snapshot().players.slice(0,2).map(q=>({shotAnim:q.shotAnim,catchTime:q.catchTime,pendingThrow:q.pendingThrow,throwCD:q.throwCD}));
 const shotCount=a.snapshot().shots.length;
 for(let i=0;i<12;i++)a.guestFrame(1/60);
 for(const q of a.snapshot().players.slice(0,2)){
  const was=visualBefore[q.id];
  assert.ok(Math.abs(q.shotAnim-Math.max(0,was.shotAnim-.2))<1e-8,`guest avatar ${q.id}: throw animation must advance between snapshots`);
  assert.equal(q.catchTime,0,`guest avatar ${q.id}: catch animation must expire between snapshots`);
  assert.equal(q.pendingThrow,was.pendingThrow,'guest must not run the authoritative pending release');
  assert.equal(q.throwCD,was.throwCD,'guest must not change authoritative fire cooldown');
 }
 assert.equal(a.snapshot().shots.length,shotCount,'guest timer extrapolation must not create projectiles');
 // Pausing only guest controls does not pause the host's visible world.
 const liveBefore=a.snapshot().players[0].shotAnim;a.setPause(true);a.guestFrame(1/60);a.setPause(false);
 assert.ok(a.snapshot().players[0].shotAnim<liveBefore,'guest control pause must not freeze a live remote throw');
 // Host pause freezes visual timers too.
 a.receiveRemoteSnapshot({...packet,seq:packet.seq+1,paused:true});await new Promise(setImmediate);
 const frozen=a.snapshot().players.slice(0,2).map(q=>({shotAnim:q.shotAnim,catchTime:q.catchTime}));
 a.guestFrame(.1);
 assert.deepEqual(a.snapshot().players.slice(0,2).map(q=>({shotAnim:q.shotAnim,catchTime:q.catchTime})),frozen);
 a.setOnline(null);
 console.log('PASS guest animation extrapolation without guest-authoritative shooting, with guest/host pause behavior');
}

// Append after the existing gameplay checks; uses their a, dt and assert bindings.
{
 const oldDifficulty=a.getSettings().difficulty;
 a.setOnline(null);a.setDuration(120);a.getSettings().difficulty='chill';
 for(const level of [0,2,3]){
  a.init(level);const match=a.snapshot(),seen=new Set();
  const activity=match.players.map(p=>({x:p.x,z:p.z,still:0,maxStill:0,distance:0,shots:0}));
  let tickCount=0,claimed=false;
  while(a.snapshot().state==='playing'&&tickCount++<14402){
   const before=match.players.map(p=>({x:p.x,z:p.z,respawn:p.respawn}));a.tick(dt);
   claimed ||= match.pickups.find(q=>q.kind==='weapon').phase!=='available';
   for(const shot of match.shots)if(!seen.has(shot.id)){seen.add(shot.id);activity[shot.owner].shots++;}
   for(const p of match.players.slice(1)){
    assert.ok([p.x,p.y,p.z,p.yaw,p.pitch,p.hp].every(Number.isFinite),`level ${level}: bot ${p.id} stays finite`);
    const m=activity[p.id];
    if(p.respawn<=0&&before[p.id].respawn<=0)m.distance+=Math.hypot(p.x-before[p.id].x,p.z-before[p.id].z);
    if(tickCount%120===0){const shift=Math.hypot(p.x-m.x,p.z-m.z);m.still=shift<.12&&p.respawn<=0&&p.botDelay<=0?m.still+1:0;m.maxStill=Math.max(m.maxStill,m.still);m.x=p.x;m.z=p.z;}
   }
  }
  assert.equal(a.snapshot().state,'results');assert.ok(claimed,`level ${level}: throwing bots contest shared box`);
  for(const m of activity.slice(1)){assert.ok(m.distance>80,'bots stay active throughout the round');assert.ok(m.shots>5,'bots engage targets');assert.ok(m.maxStill<12,`level ${level}: bots leave firing positions instead of remaining AFK: ${JSON.stringify(m)}`);}
  assert.ok(match.players.slice(1).some(p=>p.score>0),`level ${level}: bots make objective progress`);
 }
 // Exact overlapping spawn positions must separate, even without an available box.
 for(const difficulty of ['chill','easy','normal','hard']){
  a.getSettings().difficulty=difficulty;a.init(2);const match=a.snapshot();
  const box=match.pickups.find(q=>q.kind==='weapon');Object.assign(box,{phase:'spent',collected:true,holder:-1,ammo:0});
  Object.assign(match.players[0],{x:12,z:12,invuln:999});
  for(const p of match.players.slice(1))Object.assign(p,{x:0,z:0,botDelay:0,invuln:999});
  const pairs=[[1,2],[1,3],[2,3]].map(([i,j])=>({i,j,separated:false,stalled:0,maxStalled:0}));
  for(let n=0;n<720;n++){
   const before=match.players.map(p=>({x:p.x,z:p.z}));a.tick(dt);
   for(const pair of pairs){const p=match.players[pair.i],q=match.players[pair.j],distance=Math.hypot(p.x-q.x,p.z-q.z);
    pair.separated ||= distance>.9;
    const stationary=[p,q].every(v=>Math.hypot(v.x-before[v.id].x,v.z-before[v.id].z)<.001);
    pair.stalled=distance<.75&&stationary?pair.stalled+dt:0;pair.maxStalled=Math.max(pair.maxStalled,pair.stalled);
   }
  }
  for(const p of match.players.slice(1))assert.ok([p.x,p.y,p.z,p.yaw,p.pitch,p.hp].every(Number.isFinite),`${difficulty} overlap recovery is finite`);
  // Crossing moving paths is allowed; remaining motionless together is the regression.
  for(const pair of pairs){assert.ok(pair.separated,`${difficulty} bots ${pair.i}/${pair.j} separate`);assert.ok(pair.maxStalled<1,`${difficulty} close bots must not cancel each other's navigation`);}
 }
 a.getSettings().difficulty='chill';a.init(1,true);
 const hunt=a.snapshot();let huntTicks=0;
 while(a.snapshot().state==='playing'&&huntTicks++<4802)a.tick(dt);
 assert.equal(a.snapshot().state,'results');
 assert.notEqual(hunt.pickups.find(q=>q.kind==='weapon').phase,'available','throwing hunters contest the bonus box');
 a.getSettings().difficulty=oldDifficulty;
 console.log('PASS full battle/capture/smash bot activity, objective progress, shared box pursuit and exact-overlap recovery at every difficulty');
}

// A piercing round has to survive the body it hits without skipping the ground it has not covered
// yet. The first attempt jumped the shot 0.06s down its own velocity, which at the Peeler's 96m/s
// is over six metres — measured, it cleared a wall entirely and struck the rival behind it.
// Both rivals are placed on the line the round actually travels rather than on a guessed heading,
// because a shoulder-fired shot does not leave along the player's yaw.
function rifleRange(gap,wallAt){
 const {range,p}=firingRange('peeler'),[,near,far,spare]=range.players;
 range.map.walls.length=0;
 for(const q of range.players)Object.assign(q,{botDelay:999,invuln:0,respawn:0,hp:100});
 Object.assign(spare,{x:300,z:300});Object.assign(near,{x:300,z:300});Object.assign(far,{x:300,z:300});
 Object.assign(p,{x:0,z:0,y:0,yaw:0,pitch:0,throwCD:0});
 a.fire(p);a.tick(dt);
 const shot=range.shots[0],speed=Math.hypot(shot.vx,shot.vy,shot.vz),at=d=>({x:shot.x+shot.vx/speed*d,z:shot.z+shot.vz/speed*d});
 const first=at(5),second=at(gap);
 Object.assign(near,{x:first.x,z:first.z,y:0});Object.assign(far,{x:second.x,z:second.z,y:0});
 if(wallAt){const w=at(wallAt);range.map.walls.push({x:w.x,z:w.z,w:10,d:.6,h:4});}
 for(let i=0;i<120;i++)a.tick(dt);
 return{near,far};
}
{const {near,far}=rifleRange(13,0);
 assert.ok(near.hp<100||near.respawn>0,'the rifle round must hit the rival in front');
 assert.ok(far.hp<100||far.respawn>0,'and must carry on through into the one behind');}
{const {near,far}=rifleRange(13,9);
 assert.ok(near.hp<100||near.respawn>0,'the round still hits the first rival');
 assert.equal(far.hp,100,'but a wall in the gap stops it rather than being tunnelled through');}
console.log('PASS a piercing round carries through one body and is still stopped by a wall behind it');
