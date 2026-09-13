// Real rendered-foot transforms; deliberately checks movement direction, not just cadence.
// Renderer substitute only: this does not establish GPU animation quality.
import assert from 'node:assert/strict';
import * as T from '../dist/assets/three.module.js';
import {World} from '../dist/world.js';
import {LEVELS} from '../dist/core.js';
const ctx=new Proxy({measureText:t=>({width:t.length*31})},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({getContext:()=>ctx})};globalThis.innerWidth=1440;globalThis.innerHeight=900;globalThis.devicePixelRatio=1;
const renderer={shadowMap:{},capabilities:{getMaxAnisotropy:()=>4},setPixelRatio(){},setSize(){}};
World.prototype.loadMaterials=async function(){};
const w=new World({},renderer);await w.ready;w.root=new T.Group();w.scene.add(w.root);w.level=LEVELS[0];w.solids=[];w.isBonus=false;w.characters=[w.character(0)];
const m=w.characters[0],p={id:0,name:'GAIT',hp:100,x:0,y:0,z:0,yaw:0,pitch:-.08,respawn:0,crouching:false,runner:false,dashTime:0,shotAnim:0,catchTime:0,reload:0,gun:false,weapon:'throw',panX:0,panY:0,cameraDistance:4.6,grounded:true};
const sample=(phase,heading,side)=>{m.lastX=p.x-heading.x*.01;m.lastZ=p.z-heading.z*.01;m.stride=phase-.01*5.1;m.walk=1;w.updatePlayers([p],0,0);w.root.updateMatrixWorld(true);return m.legs[side].userData.foot.getWorldPosition(new T.Vector3()).sub(m.g.position);};
let checks=0;
for(const yaw of[0,.4,1.3,-2.7,Math.PI])for(const [motion,inputX,inputZ]of[['forward',0,-1],['back',0,1],['right',1,0],['left',-1,0],['forward-right',Math.SQRT1_2,-Math.SQRT1_2],['back-left',-Math.SQRT1_2,Math.SQRT1_2]]){
 p.yaw=yaw;const heading=new T.Vector3(inputX*Math.cos(yaw)-inputZ*Math.sin(yaw),0,inputX*Math.sin(yaw)+inputZ*Math.cos(yaw));
 for(const side of[0,1])for(const [stage,phase,expected]of[['swing',Math.PI*.5-side*Math.PI,1],['stance',Math.PI*1.5-side*Math.PI,-1]]){
  const a=sample(phase-.01,heading,side),b=sample(phase+.01,heading,side),delta=b.clone().sub(a);delta.y=0;const alignment=delta.normalize().dot(heading)*expected;
  assert.ok(alignment>.9999,`${motion} foot ${side} ${stage} at yaw ${yaw}: alignment ${alignment.toFixed(4)}; lifted feet travel along movement, planted feet return against it`);checks++;
 }
}
m.lastX=p.x;m.lastZ=p.z;const stride=m.stride;w.updatePlayers([p],1,1/60);assert.equal(m.stride,stride,'standing still cannot advance the run cycle');p.x+=3;w.updatePlayers([p],2,1/60);assert.equal(m.stride,0,'teleport must reset stride');assert.equal(m.walk,0,'teleport must reset walking blend');
console.log(`PASS ${checks} actual-foot movement directions across forward/back/strafe/diagonals, five yaws, both feet and swing/stance phases; idle and teleport remain stable`);

// Compare free hands against the same-side feet in actual movement coordinates.
Object.assign(p,{x:0,y:0,z:0,yaw:0,weapon:'throw',runner:true,crouching:false,dashTime:0});
for(const heading of [new T.Vector3(0,0,-1),new T.Vector3(0,0,1),new T.Vector3(1,0,0),new T.Vector3(-1,0,0)])for(const side of[0,1]){
 const phase=Math.PI*.5-side*Math.PI;
 sample(phase-.01,heading,side);const before=m.arms[side].userData.hand.getWorldPosition(new T.Vector3());
 sample(phase+.01,heading,side);const after=m.arms[side].userData.hand.getWorldPosition(new T.Vector3()),motion=after.sub(before);motion.y=0;
 assert.ok(motion.dot(heading)<-.00001,'free arm swings opposite its same-side swinging foot, including strafing');
}
Object.assign(p,{runner:false,weapon:'throw',shotAnim:0});sample(.5,new T.Vector3(0,0,-1),0);const carriedA=m.heldSpud.position.clone();sample(2,new T.Vector3(0,0,-1),0);assert.ok(carriedA.distanceTo(m.heldSpud.position)>.02,'carried potato responds to walking');
assert.ok(Math.abs(m.bob.rotation.y)>.01&&Math.abs(m.bob.rotation.z)>.01,'torso gently twists and rolls with the gait');
m.walk=0;m.lastX=p.x;m.lastZ=p.z;w.updatePlayers([p],0,0);assert.equal(m.bob.rotation.y,0);assert.equal(m.bob.rotation.z,0);
console.log('PASS opposite arm/leg swing in every direction, carried-potato motion and restrained torso wobble returning to rest');

// Expressions follow the live throw clock and reset when the action finishes.
Object.assign(p,{weapon:'throw',shotDuration:.46,shotAnim:0});w.updatePlayers([p],0,0);const openLid=m.lids[0].rotation.x,idleBrow=m.brows[0].position.y;
// Effort narrows the eye by dropping the actual lid over it, not by squashing the eyeball.
assert.equal(m.mouth.visible,false);p.shotAnim=.46-.12;w.updatePlayers([p],0,0);assert.ok(m.lids[0].rotation.x>openLid+.1);assert.ok(m.brows[0].position.y<idleBrow);assert.ok(m.mouth.visible&&m.mouth.scale.y>.5);
p.shotAnim=0;w.updatePlayers([p],0,0);assert.equal(m.mouth.visible,false);assert.equal(m.lids[0].rotation.x,openLid);assert.equal(m.brows[0].position.y,idleBrow);
assert.ok(m.gun.children.filter(o=>o.isMesh).length<=10,'detailed gun is batched into a bounded number of material draws');
console.log('PASS throw anticipation, effort/exhale and facial recovery; detailed launcher retains bounded draw calls');
