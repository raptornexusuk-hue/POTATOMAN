import {boxContact3D} from './core.js';
import {bodyHeight,bodyScale,muzzleHeight} from './stance.js';
import {weaponConfig} from './weapons.js';
const GUN_TUNING={lightRight:.60,lightLift:.10,heavyRight:.42,heavyForward:.90,heavyLift:0};
export const MIN_PITCH=-.85,MAX_PITCH=.70,DEFAULT_PITCH=-.08,CAMERA_SHOULDER=.98;
export const cameraHeight=p=>(p.crouching?1.17:1.55)*bodyScale(p);
// Socket locations are independent of camera distance and body animation.
export function muzzlePosition(p,solids=[]){const scale=bodyScale(p),throwing=p.weapon==='throw',right=(throwing?.58:.74)*scale,forward=(throwing?.56:p.weapon==='rpg'?.96:.82)*scale,origin={x:p.x,y:(p.y??0)+(throwing?(p.crouching?1.54:2.04)*scale:muzzleHeight(p)),z:p.z},muzzle={x:p.x+Math.sin(p.yaw)*forward+Math.cos(p.yaw)*right,y:origin.y,z:p.z-Math.cos(p.yaw)*forward+Math.sin(p.yaw)*right};let fraction=1;for(const w of solids)fraction=Math.min(fraction,boxContact3D(origin.x,origin.y,origin.z,muzzle.x,muzzle.y,muzzle.z,w,.18));if(fraction<1)for(const k of ['x','y','z'])muzzle[k]=mix(origin[k],muzzle[k],Math.max(0,fraction-.04));return muzzle;}

const mix=(a,b,t)=>a+(b-a)*t;
// Intersect the full swept segment with a finite vertical cylinder, including head/foot planes.
export function cylinderContact(a,b,p,pad=0){
 const dx=b.x-a.x,dz=b.z-a.z,fx=a.x-p.x,fz=a.z-p.z,r=(p.runner?.72:.53)+pad,A=dx*dx+dz*dz,B=2*(fx*dx+fz*dz),C=fx*fx+fz*fz-r*r;let lo=0,hi=1;
 if(A<1e-12){if(C>0)return Infinity;}else{const disc=B*B-4*A*C;if(disc<0)return Infinity;const root=Math.sqrt(disc);lo=Math.max(lo,(-B-root)/(2*A));hi=Math.min(hi,(-B+root)/(2*A));}
 const bottom=(p.y??0)-pad,top=(p.y??0)+bodyHeight(p)+pad,dy=b.y-a.y;
 if(Math.abs(dy)<1e-12){if(a.y<bottom||a.y>top)return Infinity;}else{const t1=(bottom-a.y)/dy,t2=(top-a.y)/dy;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}return lo<=hi?lo:Infinity;
}
export function cameraPose(p,settings={},solids=[]){
 const pitch=Math.max(MIN_PITCH,Math.min(MAX_PITCH,p.pitch??DEFAULT_PITCH)),horizontal=Math.cos(pitch),direction={x:Math.sin(p.yaw)*horizontal,y:Math.sin(pitch),z:-Math.cos(p.yaw)*horizontal},right={x:Math.cos(p.yaw),z:Math.sin(p.yaw)},zoom=Math.max(3,Math.min(9,settings.zoom??p.cameraDistance??4.6));
 const body={x:p.x,y:(p.y??0)+cameraHeight(p),z:p.z},shoulder=CAMERA_SHOULDER*bodyScale(p),anchor={x:body.x+right.x*shoulder,y:body.y,z:body.z+right.z*shoulder};
 // The shoulder pivot is fixed. Looking up tilts the sight without driving the boom into the floor.
 // Only solid cover may compress the boom; aiming never changes the selected zoom.
 let side=1;for(const w of solids)side=Math.min(side,boxContact3D(body.x,body.y,body.z,anchor.x,anchor.y,anchor.z,w,.16));if(side<1)for(const k of ['x','y','z'])anchor[k]=mix(body[k],anchor[k],Math.max(0,side-.04));
 const orbitPitch=Math.min(pitch,Math.asin(Math.max(-1,Math.min(1,(anchor.y-.28)/zoom)))),orbitCos=Math.cos(orbitPitch),desired={x:anchor.x-Math.sin(p.yaw)*orbitCos*zoom,y:anchor.y-Math.sin(orbitPitch)*zoom,z:anchor.z+Math.cos(p.yaw)*orbitCos*zoom};let fraction=1;
 for(const w of solids)fraction=Math.min(fraction,boxContact3D(anchor.x,anchor.y,anchor.z,desired.x,desired.y,desired.z,w,.18));
 fraction=Math.max(0,fraction-(fraction<1?.035:0));
 const position={x:mix(anchor.x,desired.x,fraction),y:mix(anchor.y,desired.y,fraction),z:mix(anchor.z,desired.z,fraction)},look={x:position.x+direction.x*10,y:position.y+direction.y*10,z:position.z+direction.z*10};return{position,direction,look,anchor,distance:zoom*fraction};
}
export function aimPoint(p,view,players,solids,targets=[],range=28){const camera=view.position,dir=view.direction,horizontal=dir.x*dir.x+dir.z*dir.z;
 // Sight starts just ahead of the player, so a long barrel cannot skip a point-blank opponent.
 const near=Math.max(0,((p.x-camera.x)*dir.x+(p.z-camera.z)*dir.z+.20)/horizontal),a={x:camera.x+dir.x*near,y:camera.y+dir.y*near,z:camera.z+dir.z*near},b={x:a.x+dir.x*range,y:a.y+dir.y*range,z:a.z+dir.z*range};let at=1;
 for(const w of solids)at=Math.min(at,boxContact3D(a.x,a.y,a.z,b.x,b.y,b.z,w));
 for(const q of players)if(q.id!==p.id&&q.respawn<=0)at=Math.min(at,cylinderContact(a,b,q));
 for(const q of targets)if(q.hp>0)at=Math.min(at,boxContact3D(a.x,a.y,a.z,b.x,b.y,b.z,{x:q.x,z:q.z,w:1.1,d:1.1,h:1.1}));
 if(dir.y<0){const ground=(.05-a.y)/(b.y-a.y);if(ground>=0)at=Math.min(at,ground);}
 return{x:mix(a.x,b.x,at),y:mix(a.y,b.y,at),z:mix(a.z,b.z,at)};
}
export function shotVelocity(p,target,speed,gun=false,muzzle=muzzlePosition(p)){const d=Math.max(.05,Math.hypot(target.x-muzzle.x,target.z-muzzle.z)),t=d/speed;return{...muzzle,vx:(target.x-muzzle.x)/d*speed,vz:(target.z-muzzle.z)/d*speed,vy:(target.y-muzzle.y)/t+(gun?0:1.9*t)};}

export function weaponAim(p,players,solids,targets=[],speed=weaponConfig(p).speed){const w=weaponConfig(p),view=cameraPose(p,{zoom:p.cameraDistance},solids),target=aimPoint(p,view,players,solids,targets,w.gun?60:28),scale=bodyScale(p),origin={x:p.x,y:(p.y??0)+muzzleHeight(p),z:p.z};let muzzle=muzzlePosition(p),velocity,nearTarget=false;
 if(p.weapon!=='throw'){
  // Aim around a shoulder grip, rather than swinging the stock around a fixed muzzle.
  const twoHanded=p.weapon==='scatter'||p.weapon==='rpg',gripRight=twoHanded?GUN_TUNING.heavyRight:GUN_TUNING.lightRight,gripForward=twoHanded?GUN_TUNING.heavyForward:.64,grip={x:p.x+Math.cos(p.yaw)*gripRight*scale+Math.sin(p.yaw)*gripForward*scale,y:origin.y+(twoHanded?GUN_TUNING.heavyLift:GUN_TUNING.lightLift),z:p.z+Math.sin(p.yaw)*gripRight*scale-Math.cos(p.yaw)*gripForward*scale},length=(p.weapon==='rpg'?.69:p.weapon==='scatter'?.62:.55)*scale;
  nearTarget=Math.hypot(target.x-grip.x,target.y-grip.y,target.z-grip.z)<length+.12;
  velocity=shotVelocity(p,target,speed,w.gun,grip);
  for(let i=0;i<5;i++){const norm=Math.hypot(velocity.vx,velocity.vy,velocity.vz);muzzle={x:grip.x+velocity.vx/norm*length,y:grip.y+velocity.vy/norm*length,z:grip.z+velocity.vz/norm*length};if(!nearTarget)velocity=shotVelocity(p,target,speed,w.gun,muzzle);}
  velocity={...velocity,...muzzle};
 }else velocity=shotVelocity(p,target,speed,w.gun,muzzle);
 // A barrel crossing cover impacts at that cover. It never retracts into the avatar.
 let contact=Infinity;for(const wall of solids)contact=Math.min(contact,boxContact3D(origin.x,origin.y,origin.z,muzzle.x,muzzle.y,muzzle.z,wall,w.gun&&p.weapon!=='rpg'?.025:.18));
 const obstruction=Number.isFinite(contact)?{x:mix(origin.x,muzzle.x,contact),y:mix(origin.y,muzzle.y,contact),z:mix(origin.z,muzzle.z,contact)}:nearTarget?target:null;
 return{target,velocity,obstruction};}
