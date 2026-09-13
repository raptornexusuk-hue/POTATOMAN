import * as T from './assets/three.module.js';
import {muzzlePosition} from './aiming.js';
import {THROW_DURATION,THROW_WINDUP} from './weapons.js';
// A quarter-turned torso exposes the throwing hand and receiver in the shoulder view.
export const BODY_YAW_OFFSET=-.55;
export const ARM_LENGTHS=Object.freeze({upper:.53,forearm:.55});
const ARM_TUNING={lightPole:[-.85,.80,.35]};
const xAxis=new T.Vector3(1,0,0),up=new T.Vector3(0,1,0),direction=new T.Vector3(),bend=new T.Vector3(),elbow=new T.Vector3(),wrist=new T.Vector3(),target=new T.Vector3(),inverse=new T.Quaternion(),handTurn=new T.Quaternion(),spud=new T.Vector3();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>t*t*(3-2*t);
const palmAxis=new T.Vector3(),align=new T.Quaternion(),identity=new T.Quaternion();
const handSocket=new T.Vector3(0,-.13,.235),socketOffset=new T.Vector3(),aimRight=new T.Vector3(-Math.cos(BODY_YAW_OFFSET),0,-Math.sin(BODY_YAW_OFFSET)),aimForward=new T.Vector3(-Math.sin(BODY_YAW_OFFSET),0,Math.cos(BODY_YAW_OFFSET));
const sleeveU=new T.Vector3(),sleeveV=new T.Vector3(),sleeveNormal=new T.Vector3(),sleeveSide=new T.Vector3(),sleevePoint=new T.Vector3(),sleeveTangent=new T.Vector3(),sleeveTurn=new T.Vector3(),sleeveCentre=new T.Vector3(),cornerIn=new T.Vector3(),cornerOut=new T.Vector3();
const ringCos=Array.from({length:17},(_,j)=>Math.cos(j*Math.PI/8)),ringSin=ringCos.map((_,j)=>Math.sin(j*Math.PI/8));
function sleeveGeometry(){const geometry=new T.TubeGeometry(new T.LineCurve3(new T.Vector3(),new T.Vector3(0,1,0)),10,.07,16,false);geometry.attributes.position.setUsage(T.DynamicDrawUsage);geometry.attributes.normal.setUsage(T.DynamicDrawUsage);geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1.3,.35),2);return geometry;}
// A rounded continuous elbow replaces intersecting straight segments and visible joint balls.
// Both halves share a ring and normal at the bend; buffers are reused throughout the match.
function shapeSleeve(upper,lower,start,hinge,end){
 sleeveU.copy(hinge).sub(start);sleeveV.copy(end).sub(hinge);const a=sleeveU.length(),b=sleeveV.length();sleeveU.divideScalar(Math.max(a,.0001));sleeveV.divideScalar(Math.max(b,.0001));const angle=Math.acos(clamp(sleeveU.dot(sleeveV),-1,1)),halfTan=Math.tan(angle*.5),cut=Math.min(.10*halfTan,a*.65,b*.65),arcRadius=halfTan>1e-5?cut/halfTan:.10;cornerIn.copy(hinge).addScaledVector(sleeveU,-cut);cornerOut.copy(hinge).addScaledVector(sleeveV,cut);
 sleeveNormal.crossVectors(sleeveU,sleeveV);if(sleeveNormal.lengthSq()<1e-8)sleeveNormal.crossVectors(sleeveU,Math.abs(sleeveU.y)<.9?up:xAxis);sleeveNormal.normalize();
 sleeveTurn.crossVectors(sleeveNormal,sleeveU);sleeveCentre.copy(cornerIn).addScaledVector(sleeveTurn,arcRadius);
 for(let part=0;part<2;part++){const geometry=(part?lower:upper).geometry,{position,normal}=geometry.attributes;
  for(let ring=0;ring<=10;ring++){const t=(part+ring/10)*.5;if(t<.4){sleevePoint.lerpVectors(start,cornerIn,t/.4);sleeveTangent.copy(sleeveU);}else if(t>.6){sleevePoint.lerpVectors(cornerOut,end,(t-.6)/.4);sleeveTangent.copy(sleeveV);}else{const theta=(t-.4)/.2*angle,c=Math.cos(theta),s=Math.sin(theta);sleevePoint.copy(sleeveCentre).addScaledVector(sleeveTurn,-c*arcRadius).addScaledVector(sleeveU,s*arcRadius);sleeveTangent.copy(sleeveU).multiplyScalar(c).addScaledVector(sleeveTurn,s);}sleeveSide.crossVectors(sleeveNormal,sleeveTangent).normalize();
   // A rounder deltoid root (fully within the shoulder-blend exemption) tapers to a slimmer
   // wrist, replacing the previous near-uniform pipe without adding any outward bulge past it.
   const shoulderMass=.0135*Math.exp(-(t/.115)*(t/.115)),radius=.0735+shoulderMass-t*.0275;
   for(let j=0;j<=16;j++){const nx=sleeveNormal.x*ringCos[j]+sleeveSide.x*ringSin[j],ny=sleeveNormal.y*ringCos[j]+sleeveSide.y*ringSin[j],nz=sleeveNormal.z*ringCos[j]+sleeveSide.z*ringSin[j],index=ring*17+j;position.setXYZ(index,sleevePoint.x+nx*radius,sleevePoint.y+ny*radius,sleevePoint.z+nz*radius);normal.setXYZ(index,nx,ny,nz);}
  }position.needsUpdate=normal.needsUpdate=true;
 }
}
export function makeArm(world,parent,skin,sign){
 // Keep the rounded toy-arm silhouette, with warm potato-coloured skin and hands.
 world.geo.finger??=new T.CapsuleGeometry(.037,.043,5,10);
 const limbSkin=world.mat(skin.color.getHex(),null,{roughness:.72,bumpScale:.006,envMapIntensity:.22}),arm=new T.Group();limbSkin.bumpMap=skin.bumpMap;parent.add(arm);const shoulder=world.mesh('sphere',limbSkin,arm,0,0,0,.108,.116,.108),upper=world.mesh(sleeveGeometry(),limbSkin,arm),lower=world.mesh(sleeveGeometry(),limbSkin,arm),joint=new T.Object3D();upper.userData.ownGeometry=lower.userData.ownGeometry=true;arm.add(joint);
 const hand=new T.Group();arm.add(hand);world.mesh('sphere',limbSkin,hand,0,-.09,0,.137,.117,.076);world.mesh('cylinder',limbSkin,hand,0,.012,0,.078,.065,.073);world.mesh('sphere',limbSkin,hand,0,.025,0,.092,.032,.083);
 const fingers=[];
 for(let j=0;j<3;j++){const finger=new T.Group();finger.position.set((j-1)*.079,-.176,.008);hand.add(finger);const length=[.88,1,.91][j];world.mesh('finger',limbSkin,finger,0,-.035,0,1,length,1);const tip=new T.Group();tip.position.y=-.071*length;finger.add(tip);world.mesh('finger',limbSkin,tip,0,-.030,0,.97,.76,.97);fingers.push({finger,tip});}
 const thumb=new T.Group();thumb.position.set(sign*.12,-.060,.033);thumb.rotation.z=-sign*.65;hand.add(thumb);world.mesh('finger',limbSkin,thumb,0,-.035,0,1.15,1.05,1.1);const thumbTip=world.mesh('finger',limbSkin,thumb,sign*.022,-.086,.020,1.05,.8,1.05);thumbTip.rotation.x=-.5;
 arm.userData={sign,shoulder,upper,lower,joint,hand,fingers,thumb};return arm;
}
function grip(arm,curl){for(const {finger,tip}of arm.userData.fingers){finger.rotation.x=-curl;tip.rotation.x=-curl*.75;}arm.userData.thumb.rotation.x=-curl*.65;}
// Tuck wide reaches forward around the potato with a smooth, bounded lateral reach.
function tuckReach(point,threshold,width){const over=point.dot(aimRight)-threshold;if(over>0){const correction=over*over/(over+width);point.addScaledVector(aimRight,-correction).addScaledVector(aimForward,correction);}}
function solveArm(arm,shoulder,point,pole,throwing=false){const {upper,lower,joint,hand}=arm.userData;arm.userData.shoulder.position.copy(shoulder);wrist.copy(point);
 // Keep both bones at their intended length. Animated bend guides and the
 // outboard hand recovery avoid singularities without moving a solved elbow.
 direction.copy(wrist).sub(shoulder);const distance=Math.max(.001,direction.length());direction.divideScalar(distance);
  const a=ARM_LENGTHS.upper,b=ARM_LENGTHS.forearm,along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));bend.copy(pole).sub(shoulder);bend.addScaledVector(direction,-bend.dot(direction)).normalize();elbow.copy(shoulder).addScaledVector(direction,along).addScaledVector(bend,height);
 if(throwing){
  // Bound the elbow on its IK circle, so clearing the sight cannot shorten a bone.
  // Keep the same anatomical bend branch throughout wind-up and recovery.
  const over=Math.max(0,elbow.dot(aimRight)-.80);bendRight.copy(aimRight).addScaledVector(direction,-aimRight.dot(direction));const projection=bendRight.length(),radial=height*projection;
  if(radial>1e-7){bendRight.divideScalar(projection);bendSide.crossVectors(direction,bendRight).normalize();const wanted=elbow.dot(aimRight)-over*over/(over+.025),centre=shoulder.dot(aimRight)+along*direction.dot(aimRight),k=clamp((wanted-centre)/radial,-.999999,.999999);bend.copy(bendRight).multiplyScalar(k).addScaledVector(bendSide,-Math.sqrt(1-k*k));elbow.copy(shoulder).addScaledVector(direction,along).addScaledVector(bend,height);}
 }
 joint.position.copy(elbow);shapeSleeve(upper,lower,shoulder,elbow,wrist);hand.position.copy(wrist);
}
// Avoid the backwards-folded wrists caused by copying steep gun pitch directly.
function limitWrist(arm){const {hand,joint}=arm.userData;direction.copy(hand.position).sub(joint.position).normalize();palmAxis.set(0,-1,0).applyQuaternion(hand.quaternion);const angle=palmAxis.angleTo(direction),limit=1.22;if(angle>limit){align.setFromUnitVectors(palmAxis,direction);align.slerp(identity,limit/angle);hand.quaternion.premultiply(align);}}
// Cubic Hermite segments share velocities at the overhead release and follow-through.
function arc(out,a,b,va,vb,t,duration){const t2=t*t,t3=t2*t;return out.copy(a).multiplyScalar(2*t3-3*t2+1).addScaledVector(b,-2*t3+3*t2).addScaledVector(va,(t3-2*t2+t)*duration).addScaledVector(vb,(t3-t2)*duration);}
const zero=new T.Vector3(),releaseVelocity=new T.Vector3(),windVelocity=new T.Vector3(),followVelocity=new T.Vector3();
const bendRight=new T.Vector3(),bendSide=new T.Vector3();
const readyPole=new T.Vector3(),windPole=new T.Vector3(),releasePole=new T.Vector3(),followPole=new T.Vector3(),recoverPole=new T.Vector3();
const shoulder=new T.Vector3(),pole=new T.Vector3(),ready=new T.Vector3(),windup=new T.Vector3(),release=new T.Vector3(),follow=new T.Vector3(),recoverPoint=new T.Vector3(),recoverVelocity=new T.Vector3();
export function poseArms(m,p,stride,walk,crouch,canThrow=true){
 inverse.copy(m.g.quaternion).invert();const scale=p.runner?1.18:1;
 const toLocal=(out,x,y,z)=>out.set(x-p.x,y-(p.y??0),z-p.z).applyQuaternion(inverse).divideScalar(scale);
 m.bob.updateMatrix();
 const bodyPoint=(out,x,y,z)=>out.set(x,y,z).applyMatrix4(m.bob.matrix);
 const tossing=canThrow&&p.weapon==='throw'&&!p.runner,duration=p.shotDuration??THROW_DURATION,clock=p.shotAnim>0?Math.max(0,duration-p.shotAnim):0,recovery=Math.max(.01,duration-THROW_WINDUP),u=clamp((clock-THROW_WINDUP)/recovery,0,1),k=recovery/(THROW_DURATION-THROW_WINDUP),mapped=k*u+(1-k)*smooth(u),elapsed=clock<=THROW_WINDUP?clock:THROW_WINDUP+(THROW_DURATION-THROW_WINDUP)*mapped;
 if(tossing){const origin=muzzlePosition(p);bodyPoint(ready,-.78,1.78,.24);bodyPoint(windup,-.80,2.04,.08);toLocal(release,origin.x,origin.y,origin.z);bodyPoint(follow,-.32,1.20,.92);bodyPoint(recoverPoint,-.90,1.85,.60);recoverVelocity.copy(ready).sub(follow).multiplyScalar(2);
  windVelocity.copy(release).sub(ready).multiplyScalar(4);releaseVelocity.copy(follow).sub(windup).multiplyScalar(4);followVelocity.copy(ready).sub(release).multiplyScalar(2);
  if(!p.shotAnim)spud.copy(ready);else if(elapsed<.068)arc(spud,ready,windup,zero,windVelocity,elapsed/.068,.068);else if(elapsed<THROW_WINDUP)arc(spud,windup,release,windVelocity,releaseVelocity,(elapsed-.068)/(THROW_WINDUP-.068),THROW_WINDUP-.068);else if(elapsed<.27)arc(spud,release,follow,releaseVelocity,followVelocity,(elapsed-THROW_WINDUP)/(.27-THROW_WINDUP),.27-THROW_WINDUP);else if(elapsed<.37)arc(spud,follow,recoverPoint,followVelocity,recoverVelocity,(elapsed-.27)/.10,.10);else arc(spud,recoverPoint,ready,recoverVelocity,zero,(elapsed-.37)/(THROW_DURATION-.37),THROW_DURATION-.37);
  // A carried potato follows the gait, then settles into the throwing action and
  // returns smoothly. Release itself remains pinned to the gameplay launch socket.
  const carry=p.shotAnim<=0?1:elapsed<.068?1-smooth(elapsed/.068):elapsed>.37?smooth((elapsed-.37)/(THROW_DURATION-.37)):0;
  bodyPoint(target,Math.cos(stride)*walk*.02*(m.gaitX??0),Math.sin(stride*2)*walk*.014,Math.cos(stride)*walk*.045*(m.gaitZ??1));bodyPoint(socketOffset,0,0,0);spud.addScaledVector(target.sub(socketOffset),carry);
  tuckReach(spud,.72,.06);m.heldSpud.position.copy(spud);m.heldSpud.visible=p.shotAnim<=0||elapsed<THROW_WINDUP;m.heldSpud.rotation.set(.2,-.2,.1);
 }else m.heldSpud.visible=false;
 m.gun.updateMatrix();
 for(let j=0;j<2;j++){const arm=m.arms[j],sign=j===0?-1:1,{hand}=arm.userData;bodyPoint(shoulder,sign*.535,1.30,.28);bodyPoint(pole,sign*1.20,.95,-.37);if(j===0&&m.gun.visible)bodyPoint(pole,...ARM_TUNING.lightPole);
  if(j===0&&tossing){bodyPoint(readyPole,-.92,1.17,-.14);bodyPoint(windPole,-.92,1.40,-.14);bodyPoint(releasePole,-.64,1.85,.40);bodyPoint(followPole,-.67,.90,.39);bodyPoint(recoverPole,-.98,1.40,.35);
   if(!p.shotAnim)pole.copy(readyPole);else if(elapsed<.068)pole.lerpVectors(readyPole,windPole,smooth(elapsed/.068));else if(elapsed<THROW_WINDUP)pole.lerpVectors(windPole,releasePole,smooth((elapsed-.068)/(THROW_WINDUP-.068)));else if(elapsed<.27)pole.lerpVectors(releasePole,followPole,smooth((elapsed-THROW_WINDUP)/(.27-THROW_WINDUP)));else if(elapsed<.37)pole.lerpVectors(followPole,recoverPole,smooth((elapsed-.27)/.10));else pole.lerpVectors(recoverPole,readyPole,smooth((elapsed-.37)/(THROW_DURATION-.37)));
  }hand.rotation.set(0,0,sign*.08);let curl=.22;
  if(m.gun.visible&&(j===0||p.weapon==='scatter'||p.weapon==='rpg')){target.set(j===0?0:.085,j===0?-.10:-.13,j===0?-.77:-.53).applyMatrix4(m.gun.matrix);hand.quaternion.copy(m.gun.quaternion);if(j===1){handTurn.setFromAxisAngle(xAxis,-Math.PI/2);hand.quaternion.multiply(handTurn);}curl=j===0?1.35:.84;}
  else if(tossing&&j===0){
   // Palm faces the throw, fingers cradle the rear skin; a small wrist cock
   // replaces the old upward/backward-facing palm and under-potato grip.
   const handX=elapsed<.068?-.18*smooth(elapsed/.068):elapsed<THROW_WINDUP?-.18+.30*smooth((elapsed-.068)/(THROW_WINDUP-.068)):elapsed<.27?.12+.18*smooth((elapsed-THROW_WINDUP)/(.27-THROW_WINDUP)):.30*(1-smooth((elapsed-.27)/(THROW_DURATION-.27)));
   hand.rotation.set(handX,-BODY_YAW_OFFSET,Math.PI,'YXZ');hand.quaternion.premultiply(m.bob.quaternion);socketOffset.copy(handSocket).applyQuaternion(hand.quaternion);target.copy(spud).sub(socketOffset);curl=p.shotAnim>0&&elapsed>=THROW_WINDUP?.08:.82;}
  else if(p.catchTime>0){bodyPoint(target,sign*.72,1.40,.66);hand.rotation.x=-1.4;curl=.10;}
  else{const swing=Math.cos(stride+j*Math.PI)*walk;bodyPoint(target,sign*.90+swing*.055*(m.gaitX??0),.65+Math.abs(swing)*.025,-.04+swing*.21*(m.gaitZ??1));hand.rotation.x=-swing*.12;if(tossing&&p.shotAnim>0){target.y+=Math.sin(elapsed/THROW_DURATION*Math.PI)*.10;target.z-=Math.sin(elapsed/THROW_DURATION*Math.PI)*.08;}}
  solveArm(arm,shoulder,target,pole,tossing&&j===0);if(!(tossing&&j===0))limitWrist(arm);grip(arm,curl);
 }
}
