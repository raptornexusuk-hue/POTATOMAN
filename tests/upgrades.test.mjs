import assert from 'node:assert/strict';
import {STEP,LEVELS,makeMap,movePlayer,jump,applyPowerup,circuitLevels,roundLevel,playableMap,route} from '../dist/core.js';
import {defaults,validateSettings} from '../dist/controls.js';
import {RoomConnection} from '../dist/network.js';
import {remoteControl} from '../dist/net-state.js';
const player=()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,grounded:true,runBoost:0,jumpBoost:0,respawn:0});
const field={n:30,walls:[],platforms:[]};
const normal=player(),spring=player();applyPowerup(spring,'jump');jump(normal);jump(spring);assert.equal(jump(normal),false);let a=0,b=0;
for(let i=0;i<200;i++){movePlayer(normal,{x:0,z:0},STEP,field);movePlayer(spring,{x:0,z:0},STEP,field);a=Math.max(a,normal.y);b=Math.max(b,spring.y);}
assert.ok(a>1.3&&a<1.5);assert.ok(b>a*1.7);assert.equal(normal.y,0);assert.equal(spring.y,0);assert.equal(normal.grounded,true);
const walker=player(),runner=player();applyPowerup(runner,'run');for(let i=0;i<120;i++){movePlayer(walker,{x:1,z:0},STEP,field);movePlayer(runner,{x:1,z:0},STEP,field);}assert.ok(Math.abs(runner.x/walker.x-1.4)<.001);
const wall=player();wall.runBoost=10;wall.y=4;wall.vy=5;for(let i=0;i<600;i++)movePlayer(wall,{x:1,z:0},STEP,field);assert.ok(wall.x<(field.n-1)*3.2/2);
console.log('PASS jump height, airborne repeat rejection, landings, speed boost and airborne arena bounds');
for(const seed of[1,71,821,9099]){assert.deepEqual(circuitLevels(seed).slice().sort((a,b)=>a-b),LEVELS.map((_,i)=>i));assert.deepEqual(circuitLevels(seed),circuitLevels(seed));for(const index of[1,4,8,9]){const level={...LEVELS[index],seed:seed+index,remix:true};const map=playableMap(level,false,120);assert.ok(route(map,map.start,map.exit).length<=145);}}
assert.notDeepEqual(circuitLevels(1),circuitLevels(71));
console.log('PASS seeded orders contain all ten levels; varied mazes stay within the route-length budget');
const old=defaults();old.keys[0].fire='KeyZ';delete old.keys[0].jump;delete old.keys[1].jump;delete old.pad[0].jump;delete old.pad[1].jump;old.version=3;const migrated=validateSettings(old);assert.equal(migrated.keys[0].fire,'KeyZ');assert.ok(migrated.keys.every(k=>k.jump));assert.equal(migrated.pad[0].jump,0);assert.equal(validateSettings({fov:999,zoom:-3}).fov,100);assert.equal(validateSettings({fov:999,zoom:-3}).zoom,3);
console.log('PASS existing custom controls migrate without loss and camera settings stay bounded');
const connection=new RoomConnection();connection.observeInput({jump:true},'round');connection.observeInput({jump:false},'round');const packet=connection.input({jump:false,x:0,z:0},{yaw:0,pitch:0},'round');const edges={};assert.equal(remoteControl(packet,{},'round',edges,0).jump,true);assert.equal(remoteControl(packet,{},'round',edges,0).jump,false);assert.equal(connection.input({jump:false,x:0,z:0},{yaw:0,pitch:0},'next').jump,0);
console.log('PASS jump taps between network sends arrive once and cannot leak into the next round');

// The difficulty curve is written against circuit progress rather than a round number, so it
// stretches to whatever length the circuit is. It used to clamp at round nine, which meant that
// once the circuit passed ten rounds the rivals stopped getting harder before the half way point.
const {circuitProgress}=await import('../dist/core.js');
const {aiSettings,AI_LEVELS}=await import('../dist/difficulty.js');
assert.equal(circuitProgress(0),0);assert.equal(circuitProgress(LEVELS.length-1),1);
assert.equal(circuitProgress(LEVELS.length+50),1,'progress cannot run past the finale');
for(const name of Object.keys(AI_LEVELS)){
 const speeds=LEVELS.map((_,i)=>aiSettings(name,circuitProgress(i)).speed);
 assert.equal(speeds[0],AI_LEVELS[name].speed,name+' opens at its base speed');
 assert.ok(speeds.every((v,i)=>!i||v>=speeds[i-1]),name+' never gets easier as the circuit goes on');
 const top=Math.min(1,AI_LEVELS[name].speed+9*AI_LEVELS[name].growth);
 assert.ok(Math.abs(speeds.at(-1)-top)<1e-12,name+' reaches its full speed at the finale');
 if(top>speeds[0])assert.ok(speeds.at(-1)>speeds[Math.floor(LEVELS.length/2)],name+' must still be ramping in the back half of the circuit');
}
console.log('PASS the rival difficulty ramp spans the whole circuit whatever its length');
