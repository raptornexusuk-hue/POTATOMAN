// Actual mesh collision and pose continuity: no renderer/GPU or visual-quality claims.
import assert from 'node:assert/strict';
import * as T from '../dist/assets/three.module.js';
import {World} from '../dist/world.js';
import {LEVELS} from '../dist/core.js';
import {ARM_LENGTHS} from '../dist/character-rig.js';
import {muzzlePosition,cameraPose,MIN_PITCH,MAX_PITCH} from '../dist/aiming.js';
const ctx=new Proxy({measureText:t=>({width:t.length*31})},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({getContext:()=>ctx})};globalThis.innerWidth=1440;globalThis.innerHeight=900;globalThis.devicePixelRatio=1;
const renderer={shadowMap:{},capabilities:{getMaxAnisotropy:()=>4},setPixelRatio(){},setSize(){}};
World.prototype.loadMaterials=async function(){};
const w=new World({},renderer);await w.ready;w.root=new T.Group();w.scene.add(w.root);w.level=LEVELS[0];w.solids=[];w.isBonus=false;w.characters=[w.character(0)];
const p={id:0,name:'AUDIT',hp:100,x:0,y:0,z:0,yaw:0,pitch:-.08,respawn:0,crouching:false,runner:false,dashTime:0,shotAnim:0,shotDuration:.46,catchTime:0,reload:0,gun:false,weapon:'throw',panX:0,panY:0,cameraDistance:4.6,grounded:true};
const initial={...p},m=w.characters[0],body=m.bob.children[0];
const all=[];
const n=number=>+number.toFixed(5),vec=v=>v.toArray().slice(0,3).map(n);
// Hidden per-weapon attachments are geometry nobody can see, so only the visible kit is measured.
const shown=object=>{for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;};
function triList(mesh){const g=mesh.geometry,arr=g.attributes.position,ix=g.index,triangles=[];for(let i=0;i<(ix?.count??arr.count);i+=3){const vs=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(arr,ix?ix.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));const tri=new T.Triangle(...vs);triangles.push({tri,box:new T.Box3().setFromPoints(vs),center:tri.getMidpoint(new T.Vector3())});}return triangles;}
function bvh(tris){const box=new T.Box3();for(const t of tris)box.union(t.box);if(tris.length<=10)return{box,tris};const s=box.getSize(new T.Vector3()),axis=s.x>s.y&&s.x>s.z?'x':s.y>s.z?'y':'z';tris.sort((a,b)=>a.center[axis]-b.center[axis]);const mid=Math.floor(tris.length/2);return{box,left:bvh(tris.slice(0,mid)),right:bvh(tris.slice(mid))};}
const rayDir=new T.Vector3(.717,.373,.589).normalize();
const temp=new T.Vector3();
function intersections(node,ray,out){if(!ray.intersectsBox(node.box))return; if(node.tris){for(const {tri}of node.tris){if(ray.intersectTriangle(tri.a,tri.b,tri.c,false,temp))out.push(temp.distanceTo(ray.origin));}return;}intersections(node.left,ray,out);intersections(node.right,ray,out);}
function inside(tree,point){if(!tree.box.containsPoint(point))return false;const hits=[];intersections(tree,new T.Ray(point,rayDir),hits);hits.sort((a,b)=>a-b);const uniq=hits.filter((v,i)=>i===0||v-hits[i-1]>1e-7);return uniq.length%2===1;}
function closest(tree,point){let best=Infinity;let bestPoint=null;function recur(node){if(node.box.distanceToPoint(point)>=best)return;if(node.tris){for(const {tri}of node.tris){tri.closestPointToPoint(point,temp);const d=temp.distanceTo(point);if(d<best){best=d;bestPoint=temp.clone();}}return;}const dl=node.left.box.distanceToPoint(point),dr=node.right.box.distanceToPoint(point);if(dl<dr){recur(node.left);recur(node.right);}else{recur(node.right);recur(node.left);}}recur(tree);return{distance:best,point:bestPoint};}
function meshPoints(mesh){const arr=mesh.geometry.attributes.position,keys=new Set(),out=[];for(let i=0;i<arr.count;i++){const v=new T.Vector3().fromBufferAttribute(arr,i).applyMatrix4(mesh.matrixWorld),key=v.toArray().map(x=>x.toFixed(6)).join(',');if(!keys.has(key)){keys.add(key);out.push(v);}}return out;}
function metric(tree,meshes){let points=0,penetrating=0,deepPenetrating=0,maxDepth=0,deepest=null;for(const mesh of meshes){for(const v of meshPoints(mesh)){points++;if(inside(tree,v)){penetrating++;const near=closest(tree,v);if(near.distance>.0200001)deepPenetrating++;if(near.distance>maxDepth){maxDepth=near.distance;deepest=v;}}}}return{points,penetrating,deepPenetrating,maxDepth:n(maxDepth),deepest:deepest?vec(deepest):null};}
function pose(opts,withTree=true){Object.assign(p,initial,opts);m.crouchBlend=opts.crouchBlend??(p.crouching?1:0);m.walk=opts.walk??0;m.stride=opts.stride??0;m.gaitX=opts.gaitX??0;m.gaitZ=opts.gaitZ??1;m.lastX=p.x;m.lastZ=p.z;w.updatePlayers([p],0,0);w.root.updateMatrixWorld(true);return withTree?bvh(triList(body)):null;}

const GUNS=['spud','repeater','scatter','masher','rpg','peeler','fryer','sticky','mortar'];
const cases=[];
for(const crouching of[false,true]){
 for(const elapsed of[0,.035,.068,.095,.12,.20,.27,.37,.46])cases.push({weapon:'throw',crouching,shotAnim:elapsed===.46?0:.46-elapsed});
 for(const weapon of GUNS)for(const pitch of[MIN_PITCH,0,MAX_PITCH])cases.push({weapon,crouching,pitch});
 for(const runner of[false,true])for(const grounded of[true,false])cases.push({runner,crouching,grounded,dashTime:.08,walk:1,stride:.7});
}
// Reachable crouch frames while dashing and aiming down previously buried a glove fingertip.
for(const weapon of GUNS)for(const crouchBlend of[.35,.65,.82330555,1])cases.push({weapon,pitch:MIN_PITCH,crouching:true,crouchBlend,dashTime:.08,grounded:true,walk:1.35,stride:0,shotAnim:.09});
// Boosted recovery combined with crouch/dash must not crumple the arm surface.
for(const shotDuration of[.46,.3286])for(const crouchBlend of[0,.5,1])for(const dashTime of[0,.08])for(const clock of[.01,.05,.085,.12,.15,.18,.22,.26,.30,.32])cases.push({weapon:'throw',shotDuration,shotAnim:shotDuration-clock,crouching:crouchBlend>0,crouchBlend,dashTime,grounded:true,walk:1.35,stride:.7});
// Walk direction and opposite stride extremes expose attachment failures missed by idle poses.
for(const [gaitX,gaitZ]of[[0,1],[0,-1],[1,0],[-1,0]])for(const stride of[0,Math.PI/2,Math.PI,Math.PI*1.5])for(const crouching of[false,true])for(const dashTime of[0,.08])for(const mode of['throw','spud','runner'])cases.push({weapon:mode==='runner'?'throw':mode,runner:mode==='runner',gaitX,gaitZ,walk:1.35,stride,crouching,dashTime});
let maxDepth=0;
for(const opts of cases){const tree=pose(opts),scale=p.runner?1.18:1;
 for(const arm of m.arms){const a=arm.userData,parts=[a.upper,a.lower];a.hand.traverse(o=>{if(o.isMesh)parts.push(o);});
  const shoulder=a.shoulder.getWorldPosition(new T.Vector3()),elbow=a.joint.getWorldPosition(new T.Vector3()),wrist=a.hand.getWorldPosition(new T.Vector3());
  assert.ok(meshPoints(a.shoulder).some(point=>inside(tree,point)&&closest(tree,point).distance>.035*scale),'shoulder socket must blend deeply into the actual body surface, not merely touch it');
  assert.ok(shoulder.distanceTo(elbow)/scale<.77&&elbow.distanceTo(wrist)/scale<.77,`limb reach ${JSON.stringify({opts,upper:shoulder.distanceTo(elbow)/scale,lower:elbow.distanceTo(wrist)/scale})}`);
  for(const part of parts)for(const point of meshPoints(part)){
   // The narrow upper-arm root blends into its shoulder socket; distal limbs get no exemption.
   if(part===a.upper&&point.distanceTo(shoulder)<.17*scale)continue;
   if(inside(tree,point)){const depth=closest(tree,point).distance/scale;maxDepth=Math.max(maxDepth,depth);assert.ok(depth<=.020001,`torso clipping ${depth.toFixed(4)}m in ${part===a.upper?'upper':part===a.lower?'forearm':'hand'} at ${JSON.stringify(opts)}`);}
  }
 }
 if(m.gun.visible){const parts=[];m.gun.traverse(o=>{if(o.isMesh&&shown(o))parts.push(o);});const collision=metric(tree,parts);assert.ok(collision.maxDepth/scale<=.02,`weapon mesh must remain outside torso: ${collision.maxDepth}m at ${JSON.stringify(opts)}`);}
 if(m.heldSpud.visible){const clearance=metric(tree,[m.heldSpud]);assert.ok(clearance.maxDepth/scale<=.02,'held potato must stay outside torso');}
}
console.log(`PASS ${cases.length} actual torso/arm/hand/spud mesh poses: no deep penetration or disconnected shoulders`);
const joint=()=>m.arms.map(a=>({elbow:a.userData.joint.position.clone(),wrist:a.userData.hand.position.clone()}));
for(const crouching of[false,true])for(const dashTime of[0,.08]){
 let previous;
 for(let i=0;i<=920;i++){pose({weapon:'throw',crouching,dashTime,walk:1,stride:.7,shotAnim:i===920?0:.46-i*.0005},false);const now=joint();if(previous)for(let j=0;j<2;j++)assert.ok(now[j].elbow.distanceTo(previous[j].elbow)<.035,`throw elbow discontinuity at ${JSON.stringify({i,crouching,dashTime,j,distance:now[j].elbow.distanceTo(previous[j].elbow)})}`);previous=now;}
 for(const weapon of GUNS){previous=null;for(let i=0;i<=310;i++){pose({weapon,crouching,dashTime,pitch:MIN_PITCH+i*.005},false);const now=joint();if(previous)for(let j=0;j<2;j++)assert.ok(now[j].elbow.distanceTo(previous[j].elbow)<.025,'aiming cannot snap elbows between solutions');previous=now;}}
}
console.log('PASS continuous elbows through full throw cycles and gun pitch sweeps, standing/crouched/dashing');
pose({weapon:'throw',shotAnim:.46-.12});const release=muzzlePosition(p),point=m.heldSpud.getWorldPosition(new T.Vector3());assert.ok(point.distanceTo(new T.Vector3(release.x,release.y,release.z))<1e-7);
pose({weapon:'throw'});const socket=m.heldSpud.position.clone().sub(m.arms[0].userData.hand.position).applyQuaternion(m.arms[0].userData.hand.quaternion.clone().invert());
for(const shotAnim of[.46,.42,.392,.365,.34]){pose({weapon:'throw',shotAnim});const actual=m.heldSpud.position.clone().sub(m.arms[0].userData.hand.position).applyQuaternion(m.arms[0].userData.hand.quaternion.clone().invert());assert.ok(actual.distanceTo(socket)<1e-7,'held potato stays attached to the palm throughout windup');}
console.log('PASS held potato remains in its hand socket and meets the exact launch point');

for(const shotDuration of[.46,.62*.53]){
 const h=.000001,socketAt=t=>{pose({weapon:'throw',shotDuration,shotAnim:shotDuration-t},false);return m.heldSpud.position.clone();};
 const at=socketAt(.12),before=at.clone().sub(socketAt(.12-h)).divideScalar(h),after=socketAt(.12+h).sub(at).divideScalar(h);
 assert.ok(before.distanceTo(after)<.01,'normal/boosted throw release must have continuous socket velocity');
}
console.log('PASS boosted recovery keeps release velocity continuous');

// The ready potato stays beside the head before the player presses fire.
for(const crouching of[false,true]){pose({weapon:'throw',crouching});const potato=m.heldSpud.getWorldPosition(new T.Vector3()),eye=m.eyes[0].getWorldPosition(new T.Vector3());assert.ok(potato.y>eye.y+.18,'ready potato must sit above eye level');}
const pa=new T.Vector3(),pb=new T.Vector3(),pc=new T.Vector3(),surface=new T.Vector3(),normal=new T.Vector3();
for(const opts of cases){pose(opts,false);for(const arm of m.arms){const {upper,lower}=arm.userData;
 for(const attribute of['position','normal']){const a=upper.geometry.attributes[attribute],b=lower.geometry.attributes[attribute];for(let j=0;j<17;j++){pa.fromBufferAttribute(a,a.count-17+j);pb.fromBufferAttribute(b,j);assert.ok(pa.distanceTo(pb)<1e-6,'rounded elbow surface and lighting must have no seam');}}
 for(const mesh of[upper,lower]){const {position,normal:n}=mesh.geometry.attributes,ix=mesh.geometry.index;for(let i=0;i<ix.count;i+=3){pa.fromBufferAttribute(position,ix.getX(i));pb.fromBufferAttribute(position,ix.getX(i+1));pc.fromBufferAttribute(position,ix.getX(i+2));surface.copy(pb).sub(pa).cross(pc.sub(pa));if(surface.lengthSq()<1e-10)continue;normal.fromBufferAttribute(n,ix.getX(i));assert.ok(surface.normalize().dot(normal)>.1,'arm triangles must face outward, not expose the inside of a hollow sleeve');}}
}}
console.log('PASS head-high ready stance and continuous outward-facing rounded arm surfaces');
for(const mode of['race','assault']){w.level=LEVELS.find(l=>l.mode===mode);pose({weapon:'throw',walk:1,stride:.7});assert.equal(m.heldSpud.visible,false);for(const arm of m.arms)assert.ok(arm.userData.hand.position.y<arm.userData.shoulder.position.y,'unarmed course runners use a free arm swing, not a raised invisible potato');}
w.level=LEVELS[0];
console.log('PASS maze and assault runners keep a free unarmed arm swing');

// Anatomical left/right gloves and a rearward elbow bend, including the back swing.
for(const stride of[0,Math.PI*.5,Math.PI,Math.PI*1.5]){pose({weapon:'throw',runner:true,walk:1.35,stride});const inverseBob=m.bob.matrix.clone().invert();
 for(const arm of m.arms){const a=arm.userData,s=a.shoulder.position.clone().applyMatrix4(inverseBob),e=a.joint.position.clone().applyMatrix4(inverseBob),h=a.hand.position.clone().applyMatrix4(inverseBob),axis=h.clone().sub(s).normalize(),bend=e.clone().sub(s);bend.addScaledVector(axis,-bend.dot(axis));assert.ok(bend.z<-.04,'free elbow must bend behind the shoulder-to-wrist chord');assert.ok(a.thumb.position.x*a.sign>.08,'thumb must be lateral when the glove palm faces forward');}
}
console.log('PASS correctly handed gloves and rearward free elbows through the arm swing');

// The far left arm must be visible from the normal third-person camera, not merely avoid the sight.
for(const weapon of['throw','spud'])for(const crouching of[false,true]){pose({weapon,crouching});const view=cameraPose(p),camera=new T.Vector3(view.position.x,view.position.y,view.position.z),arm=m.arms[1].userData,forearm=arm.lower.geometry.attributes.position,centre=new T.Vector3();for(let j=0;j<16;j++)centre.add(new T.Vector3().fromBufferAttribute(forearm,5*17+j));centre.divideScalar(16).applyMatrix4(arm.lower.matrixWorld);
 for(const point of[centre,arm.hand.localToWorld(new T.Vector3(0,-.09,0))]){const direction=point.clone().sub(camera),distance=direction.length(),ray=new T.Raycaster(camera,direction.normalize(),0,distance-.01);assert.equal(ray.intersectObject(body,false).length,0,'left forearm and glove centre cannot disappear behind the torso at rest');}
}
console.log('PASS left forearm and glove remain exposed in the normal rear shoulder view');

// Rig constraints, including in-between frames: never shrink an arm to hide it.
for(const shotDuration of[.46,.3286])for(const crouchBlend of[0,.5,1])for(const dashTime of[0,.08])for(let clock=0;clock<shotDuration;clock+=.001){
 pose({weapon:'throw',shotDuration,shotAnim:shotDuration-clock,crouching:crouchBlend>0,crouchBlend,dashTime,walk:1.35,stride:.7},false);
 const a=m.arms[0].userData,s=a.shoulder.position,e=a.joint.position,h=a.hand.position;
 assert.ok(Math.abs(s.distanceTo(e)-ARM_LENGTHS.upper)<1e-5,'upper arm must retain its bone length throughout throwing');
 assert.ok(Math.abs(e.distanceTo(h)-ARM_LENGTHS.forearm)<1e-5,'forearm must retain its bone length throughout throwing');
}
for(const clock of[0,.03,.06]){pose({weapon:'throw',shotAnim:.46-clock},false);const a=m.arms[0].userData,inverseBob=m.bob.matrix.clone().invert(),s=a.shoulder.position.clone().applyMatrix4(inverseBob),e=a.joint.position.clone().applyMatrix4(inverseBob);assert.ok(e.x<s.x-.15,'throwing elbow stays out beside the torso through wind-up');}
console.log('PASS full normal/boosted throw sweeps retain bone lengths with an outboard elbow silhouette');

// Catch the brief arm crossings between the old sampled animation frames.
const drawn=object=>{for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;};let sightRays=0;
for(const shotDuration of[.46,.3286])for(const crouchBlend of[0,.5,1])for(const dashTime of[0,.08])for(let frame=0;frame<Math.round(shotDuration*1000);frame+=6){
 pose({weapon:'throw',shotDuration,shotAnim:shotDuration-frame*.001,crouching:crouchBlend>0,crouchBlend,dashTime,walk:1.35,stride:.7},false);
 for(const pitch of[MIN_PITCH,-.6,-.3,0,.3,MAX_PITCH]){p.pitch=pitch;const view=cameraPose(p),ray=new T.Raycaster(new T.Vector3(view.position.x,view.position.y,view.position.z),new T.Vector3(view.direction.x,view.direction.y,view.direction.z));assert.equal(ray.intersectObject(m.g,true).filter(h=>drawn(h.object)).length,0,`throw cannot cross sight at ${frame}ms / ${shotDuration}s, pitch ${pitch}, crouch ${crouchBlend}, dash ${dashTime}`);sightRays++;}
}
console.log(`PASS ${sightRays} full-cycle throw sight rays through normal, boosted, crouching and dashing poses`);

// The throwing hand must push from behind the potato, including every finger.
for(const yaw of[0,1.1])for(const crouching of[false,true])for(const dashTime of[0,.08])for(const clock of[0,.034,.068,.09,.119999]){
 pose({weapon:'throw',yaw,crouching,dashTime,shotAnim:.46-clock},false);
 const hand=m.arms[0].userData.hand,spud=m.heldSpud.getWorldPosition(new T.Vector3()),forward=new T.Vector3(Math.sin(yaw),0,-Math.cos(yaw)),palm=hand.localToWorld(new T.Vector3(0,-.09,0));
 assert.ok(palm.clone().sub(spud).dot(forward)<-.18,'palm stays behind the potato, facing the throw');
 hand.traverse(mesh=>{if(!mesh.isMesh)return;const vertices=mesh.geometry.attributes.position;for(let i=0;i<vertices.count;i++){const point=new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld);assert.ok(point.sub(spud).dot(forward)<-.005,'hand and fingers cannot cross the front half of the held potato');}});
}
console.log('PASS palm and every finger remain behind the potato through hold, wind-up and release, including crouch/dash and turned aim');

// Every player slot has its own build and headwear now, and any of them can be the local player —
// slot 1 in split-screen, any slot online. So the crosshair has to stay clear and the hat has to
// stay out of the torso for all four, not just the bare-headed baseline the sweeps above use.
const breeds=[0,1,2,3].map(id=>w.character(id));
let breedRays=0;
for(const [id,model]of breeds.entries()){
 const torso=model.bob.children[0];
 for(const weapon of['throw','spud','rpg'])for(const crouching of[false,true]){
  Object.assign(p,initial,{weapon,crouching});
  m.crouchBlend=crouching?1:0;m.walk=1;m.stride=.7;m.gaitX=0;m.gaitZ=1;m.lastX=p.x;m.lastZ=p.z;
  w.characters=[model];model.crouchBlend=crouching?1:0;model.walk=1;model.stride=.7;model.gaitX=0;model.gaitZ=1;model.lastX=p.x;model.lastZ=p.z;
  w.updatePlayers([p],0,0);w.root.updateMatrixWorld(true);
  for(const pitch of[MIN_PITCH,-.3,0,MAX_PITCH]){
   p.pitch=pitch;w.updatePlayers([p],0,0);w.root.updateMatrixWorld(true);
   const view=cameraPose(p),ray=new T.Raycaster(new T.Vector3(view.position.x,view.position.y,view.position.z),new T.Vector3(view.direction.x,view.direction.y,view.direction.z));
   assert.equal(ray.intersectObject(model.g,true).filter(h=>drawn(h.object)).length,0,`slot ${id} blocks its own crosshair at pitch ${pitch}, ${weapon}, crouch ${crouching}`);breedRays++;
  }
  // A hat's inner half is meant to be inside the skull. What matters is that enough of it shows,
  // and that it sits on the crown rather than across the face.
  const tree=bvh(triList(torso)),brim=[];model.hat.traverse(o=>{if(o.isMesh)brim.push(o);});
  if(brim.length){
   const points=brim.flatMap(meshPoints),outside=points.filter(point=>!inside(tree,point));
   assert.ok(outside.length>points.length*.25,`slot ${id} headwear is swallowed by its own head`);
   const eye=model.eyes[0].getWorldPosition(new T.Vector3());
   assert.ok(outside.every(point=>point.y>eye.y-.02),`slot ${id} headwear hangs over its own face`);
  }
 }
}
w.characters=[m];
console.log(`PASS ${breedRays} sight rays across all four player builds; headwear sits on the head, not inside it`);

// The locker lets a player put any piece on any potato, so every piece has to hold the same two
// promises the four bots do: it shows (it is not swallowed by the head it sits on), and it never
// gets between the player and their own crosshair.
const {WARDROBE,SLOTS}=await import('../dist/locker.js');
let pieces=0,rays=0;
for(const [slot]of SLOTS){
 if(slot==='tint'||slot==='skin')continue;
 for(const [piece]of WARDROBE[slot]){
  const model=w.character(0,{head:'none',eyes:'none',neck:'none',[slot]:piece});
  const torso=model.bob.children[0],worn=[];for(const part of[model.hat,model.kit])part.traverse(o=>{if(o.isMesh)worn.push(o);});
  Object.assign(p,initial);w.characters=[model];model.crouchBlend=0;model.walk=0;model.stride=0;model.lastX=p.x;model.lastZ=p.z;
  w.updatePlayers([p],0,0);w.root.updateMatrixWorld(true);
  if(piece!=='none'){
   assert.ok(worn.length,`${slot}/${piece} builds nothing at all`);
   const tree=bvh(triList(torso)),points=worn.flatMap(meshPoints),outside=points.filter(point=>!inside(tree,point));
   assert.ok(outside.length>points.length*.25,`${slot}/${piece} is swallowed by the potato wearing it`);
   if(slot==='head'){const eye=model.eyes[0].getWorldPosition(new T.Vector3());
    assert.ok(outside.every(point=>point.y>eye.y-.02),`${slot}/${piece} hangs over its own face`);}
   pieces++;
  }
  for(const weapon of['throw','spud','rpg'])for(const pitch of[MIN_PITCH,0,MAX_PITCH]){
   Object.assign(p,initial,{weapon,pitch});w.updatePlayers([p],0,0);w.root.updateMatrixWorld(true);
   const view=cameraPose(p),ray=new T.Raycaster(new T.Vector3(view.position.x,view.position.y,view.position.z),new T.Vector3(view.direction.x,view.direction.y,view.direction.z));
   assert.equal(ray.intersectObject(model.g,true).filter(h=>drawn(h.object)).length,0,`${slot}/${piece} blocks the crosshair at pitch ${pitch} with ${weapon}`);rays++;
  }
 }
}
w.characters=[m];
console.log(`PASS all ${pieces} wardrobe pieces are visible on the potato and clear of its own sight across ${rays} rays`);
