// Real Three.js geometry/matrix checks; renderer substitute, no GPU image claims.
import assert from 'node:assert/strict';
import * as T from '../dist/assets/three.module.js';
import {World} from '../dist/world.js';
import {LEVELS,makeMap,boxContact3D} from '../dist/core.js';
import {cameraPose,weaponAim,cameraHeight,CAMERA_SHOULDER,MIN_PITCH,MAX_PITCH,muzzlePosition} from '../dist/aiming.js';
const ctx=new Proxy({measureText:t=>({width:t.length*31})},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({getContext:()=>ctx})};globalThis.innerWidth=1440;globalThis.innerHeight=900;globalThis.devicePixelRatio=1;
const renderer={shadowMap:{},capabilities:{getMaxAnisotropy:()=>4},setPixelRatio(){},setSize(){}};
World.prototype.loadMaterials=async function(){};
const w=new World({},renderer);await w.ready;
const player=id=>({id,name:'TEST',hp:100,x:0,y:0,z:0,yaw:0,pitch:-.08,respawn:0,crouching:false,runner:false,dashTime:0,shotAnim:0,catchTime:0,reload:0,gun:false,weapon:'spud',panX:0,panY:0,cameraDistance:4.6,grounded:true});
const players=[player(0),{...player(1),z:-8}],p=players[0];w.build(makeMap(LEVELS[0]),LEVELS[0],players,false);w.solids=[];
for(const crouching of[false,true])for(const yaw of[0,1.3,-2.7])for(const pitch of[MIN_PITCH,-.08,MAX_PITCH])for(const weapon of['spud','scatter','rpg']){
 Object.assign(p,{crouching,yaw,pitch,weapon,shotAnim:.08,dashTime:.1});w.updatePlayers(players,3,1/60);w.root.updateMatrixWorld(true);
 const m=w.characters[0],barrel=m.gun.userData.barrel,tip=barrel.localToWorld(new T.Vector3(0,.5,0)),v=weaponAim(p,players,[]).velocity;
 assert.ok(tip.distanceTo(new T.Vector3(v.x,v.y,v.z))<1e-6,'visible barrel tip must equal actual projectile origin');
 const barrelAxis=tip.clone().sub(barrel.localToWorld(new T.Vector3(0,-.5,0))).normalize();assert.ok(barrelAxis.distanceTo(new T.Vector3(v.vx,v.vy,v.vz).normalize())<1e-6,'barrel direction must follow actual launch velocity');
}
console.log('PASS actual barrel geometry matches projectile origin/direction for 54 stance, pitch, yaw and weapon combinations, including recoil');
Object.assign(p,player(0));
for(const crouching of[false,true])for(const distance of[1,2,4,11]){
 Object.assign(players[1],player(1),{z:-distance,crouching});
 p.yaw=-Math.asin(CAMERA_SHOULDER/distance);p.pitch=Math.atan2((crouching?1.05:1.44)-cameraHeight(p),Math.sqrt(distance**2-CAMERA_SHOULDER**2));
 for(let frame=0;frame<60;frame++)w.updatePlayers(players,4,1/60);w.root.updateMatrixWorld(true);
 const view=cameraPose(p),ray=new T.Raycaster(new T.Vector3(...Object.values(view.position)),new T.Vector3(...Object.values(view.direction)));
 assert.ok(ray.intersectObject(w.characters[1].bob.children[0],false).length>0,`crosshair must intersect visible torso at ${distance}m, crouch=${crouching}`);
}
console.log('PASS centered sight ray intersects actual potato torso mesh at 1, 2, 4 and 11m standing and crouched');
Object.assign(p,player(0));const rear={x:.75,z:3,w:.12,d:.2,h:4};
for(const pitch of[MIN_PITCH,-.08,MAX_PITCH]){p.pitch=pitch;const expected=cameraPose(p).direction;for(const zoom of[3,5.6,9])for(const solids of[[],[rear],[{x:0,z:2,w:5,d:.3,h:5}]])assert.deepEqual(cameraPose(p,{zoom},solids).direction,expected);}
Object.assign(p,player(0));assert.ok(weaponAim(p,players,[rear]).velocity.vz<0,'cover behind player must never cause a backwards shot');
const sideWall={x:.95,z:0,w:1,d:5,h:4},muzzle=muzzlePosition(p,[sideWall]);assert.ok(muzzle.x<.27);assert.equal(boxContact3D(muzzle.x,muzzle.y,muzzle.z,muzzle.x,muzzle.y,muzzle.z-.4,sideWall,.18),Infinity,'large potatoes must clear parallel side cover');
const ahead={x:0,z:-1,w:4,d:.1,h:4},v=weaponAim(p,players,[ahead]).velocity;assert.ok(Number.isFinite(boxContact3D(v.x,v.y,v.z,v.x+v.vx*.1,v.y+v.vy*.1,v.z+v.vz*.1,ahead,.18)),'near cover must still block outgoing shots');
console.log('PASS zoom/wall compression preserve sight direction; rear cover cannot reverse shots; large spuds clear side walls and hit frontal cover');
// Gliding is a measurable defect, not a matter of taste: whichever foot is planted has to hold
// the ground while the body travels over it. Sampling both feet each frame and taking the
// stiller one tracks the stance foot through the cycle without needing to know the phase.
const m=w.characters[0];Object.assign(p,player(0));w.updatePlayers(players,5,1/60);const stride=m.stride;let lift=0,slip=0,steps=0,previous=null;
for(let f=0;f<120;f++){p.x+=.1;w.updatePlayers(players,5+f/60,1/60);w.root.updateMatrixWorld(true);lift=Math.max(lift,...m.legs.map(l=>l.userData.foot.position.y-.09));
 const feet=m.legs.map(l=>l.userData.foot.getWorldPosition(new T.Vector3()).x);if(previous){slip+=Math.min(...feet.map((v,i)=>Math.abs(v-previous[i])));steps++;}previous=feet;}
assert.ok((m.stride-stride)/(Math.PI*4)>4.5&&(m.stride-stride)/(Math.PI*4)<5.2,'running gait stays between 4.5 and 5.2 cycles/second');
assert.ok(slip/steps<.025,`planted foot must grip the ground rather than skate: ${(slip/steps/.1*100).toFixed(0)}% of body travel`);
assert.ok(lift<.18,'foot lift stays restrained');
const shoe=m.legs[0].userData.foot.children[0];assert.equal(shoe.material.color.getHex(),0xffc522);assert.equal(shoe.material.map,null);const pos=shoe.geometry.attributes.position;let midWidth=0,tipWidth=0,tipTop=0;for(let i=0;i<pos.count;i++){const x=Math.abs(pos.getX(i)),z=pos.getZ(i);if(z>.3&&z<.45)midWidth=Math.max(midWidth,x);if(z>.75){tipWidth=Math.max(tipWidth,x);tipTop=Math.max(tipTop,pos.getY(i));}}assert.ok(tipWidth<midWidth*.65);assert.ok(tipTop>.3);
console.log('PASS lively gait, restrained foot lift and bright yellow upturned pointed clogs');

// Inspect exactly what each viewport renders, including close cover and split-screen.
Object.assign(renderer,{setScissorTest(){},setViewport(){},setScissor(){}});
let rendered=[];renderer.render=()=>rendered.push(w.characters.map(m=>({visible:m.g.visible,label:m.label.sprite.visible})));
Object.assign(p,player(0));Object.assign(players[1],player(1),{x:8,z:-8});
w.solids=[];w.updatePlayers(players,7,1/60);w.render(players,false,1/60);
assert.equal(rendered.at(-1)[0].visible,true,'ordinary shoulder view must retain the character');
assert.equal(rendered.at(-1)[0].label,false,'own name cannot cover the sight');
assert.ok(w.characters.every(m=>m.fadeMaterials.every(mat=>!mat.transparent&&mat.opacity===1)),'body materials stay opaque');
w.solids=[{x:0,z:1,w:6,d:.2,h:4}];w.render(players,false,1/60);
assert.equal(rendered.at(-1)[0].visible,false,'compressed view must hide the entire own model');assert.equal(m.g.visible,true,'visibility must be restored after rendering');
w.solids=[];Object.assign(players[1],{x:0,z:-1.3});w.updatePlayers(players,8,1/60);w.render(players,false,1/60);
assert.equal(rendered.at(-1)[0].visible,true,'nearby rivals must not hide the own character');assert.equal(rendered.at(-1)[1].visible,true,'point-blank rival stays visible');
Object.assign(players[1],{x:8,z:-8});w.updatePlayers(players,9,1/60);rendered=[];w.render(players,true,1/60);assert.equal(rendered.length,2);assert.equal(rendered[0][1].visible,true);assert.equal(rendered[1][0].visible,true);
console.log('PASS clear shoulder view, opaque bodies, close-cover clearance and independent split-screen visibility');
Object.assign(p,{weapon:'throw',shotAnim:0,runner:false,roundWins:2});w.updatePlayers(players,10,1/60);const ready=m.arms[0].userData.hand.position.clone();assert.equal(m.heldSpud.visible,true);assert.equal(m.gun.visible,false);assert.equal(m.cape.visible,false);assert.equal(m.crown.visible,false);
p.shotAnim=.2;w.updatePlayers(players,10.14,1/60);assert.ok(m.arms[0].userData.hand.position.distanceTo(ready)>.1);assert.equal(m.heldSpud.visible,false);
Object.assign(p,{runner:true,roundWins:3});w.updatePlayers(players,11,1/60);assert.equal(m.cape.visible,true);assert.equal(m.crown.visible,true);assert.ok(m.legs.every(l=>l.userData.foot.rotation.y*l.position.x>0),'both clog toes point outward');
console.log('PASS hand throwing motion, weapon visibility, Potatoman cape, three-win crown and outward clog toes');

// Regression: the sight must remain clear of the actual hands, arms, weapons and torso.
const isDrawn=object=>{for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;};
let poses=0;
for(const weapon of['throw','spud','scatter','rpg'])for(const pitch of[MIN_PITCH,-.3,0,.3,MAX_PITCH])for(const crouching of[false,true])for(const cameraDistance of[3,4.6,9])for(const shotAnim of[0,.44,.39,.34,.24]){
 Object.assign(p,player(0),{weapon,pitch,crouching,cameraDistance,shotAnim});w.solids=[];w.updatePlayers(players,13,1/60);w.root.updateMatrixWorld(true);const pose=cameraPose(p),ray=new T.Raycaster(new T.Vector3(pose.position.x,pose.position.y,pose.position.z),new T.Vector3(pose.direction.x,pose.direction.y,pose.direction.z));
 assert.equal(ray.intersectObject(m.g,true).filter(h=>isDrawn(h.object)).length,0,`${weapon} must clear the sight at pitch ${pitch}, crouch ${crouching}, zoom ${cameraDistance}, animation ${shotAnim}`);
 assert.ok(Math.abs(Math.hypot(pose.position.x-pose.anchor.x,pose.position.y-pose.anchor.y,pose.position.z-pose.anchor.z)-cameraDistance)<1e-8,'aiming cannot shorten the open-space camera boom');assert.ok(pose.position.y>=.279,'looking up cannot drive the camera into the ground');poses++;
}
console.log(`PASS ${poses} actual mesh poses keep the crosshair clear through pitch, crouch, zoom and throwing; camera distance stays fixed`);
Object.assign(p,player(0),{weapon:'throw',shotAnim:.46-.12});w.updatePlayers(players,14,1/60);w.root.updateMatrixWorld(true);const release=muzzlePosition(p),spudPoint=m.heldSpud.getWorldPosition(new T.Vector3());assert.ok(spudPoint.distanceTo(new T.Vector3(release.x,release.y,release.z))<1e-7,'overhead hand socket must meet the projectile release point');
assert.ok(m.arms.every(a=>a.userData.fingers.length===3&&a.userData.thumb),'each glove has three rounded fingers and an opposed thumb');for(const leg of m.legs){const foot=leg.userData.foot,shoe=foot.children[0];shoe.geometry.computeBoundingBox();const size=shoe.geometry.boundingBox.getSize(new T.Vector3()).multiply(shoe.scale).multiply(foot.scale);assert.ok(size.z<.90&&size.x<.42,'clog footprint stays proportional to the potato');}
for(const weapon of['spud','scatter','rpg']){let reference;for(const pitch of[0,MIN_PITCH,MAX_PITCH]){Object.assign(p,player(0),{weapon,pitch});const {velocity:v}=weaponAim(p,[],[]),axis=new T.Vector3(v.vx,v.vy,v.vz).normalize(),grip=new T.Vector3(v.x,v.y,v.z).addScaledVector(axis,weapon==='rpg'?-.69:weapon==='scatter'?-.62:-.55);reference??=grip.clone();assert.ok(grip.distanceTo(reference)<.001,'barrel pivots around a fixed grip throughout pitch');}}
console.log('PASS fixed shoulder grip, exact overhead release, articulated fingers/thumbs and smaller decorated clogs');

Object.assign(p,player(0),{runner:true,weapon:'throw'});for(const pitch of[MIN_PITCH,0,MAX_PITCH]){p.pitch=pitch;w.updatePlayers(players,15,1/60);w.root.updateMatrixWorld(true);const pose=cameraPose(p),ray=new T.Raycaster(new T.Vector3(pose.position.x,pose.position.y,pose.position.z),new T.Vector3(pose.direction.x,pose.direction.y,pose.direction.z));assert.equal(ray.intersectObject(m.g,true).filter(h=>isDrawn(h.object)).length,0,'transformed runner keeps a clear shoulder view');}

// Append to tests/render-aim.test.mjs. Uses its existing p, player, w and T helpers.
{
 Object.assign(p,player(0),{weapon:'throw'});w.solids=[];
 const rig=w.characters[0],step=1/120;
 const handPoint=()=>rig.arms[0].userData.hand.getWorldPosition(new T.Vector3());
 for(const held of[true,false]){
  p.crouching=!held;
  for(let i=0;i<40;i++)w.updatePlayers(players,20+i*step,step);
  w.root.updateMatrixWorld(true);const before=handPoint();
  p.crouching=held;w.updatePlayers(players,21,step);w.root.updateMatrixWorld(true);
  const jump=before.distanceTo(handPoint());
  assert.ok(jump<.2,`idle throw hand jumped ${jump.toFixed(3)}m on crouch ${held?'press':'release'}`);
 }
 console.log('PASS crouch press/release blend the idle throwing hand without a half-metre jump');
}
