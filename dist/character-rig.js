import * as T from './assets/three.module.js';
import {muzzlePosition} from './aiming.js';
import {THROW_DURATION,THROW_WINDUP} from './weapons.js';
// A side-on torso puts the shoulder, the throwing hand and the whole receiver in the shoulder view,
// so the weapon reads as pointing at the crosshair instead of hiding behind the potato.
export const BODY_YAW_OFFSET=-.80;
export const ARM_LENGTHS=Object.freeze({upper:.46,forearm:.48});
// The torso ellipsoid the arms socket into. world.js builds the actual mesh from these numbers,
// so the shoulder can be placed against the real surface rather than a width that suited one turn.
export const TORSO=Object.freeze({x:.635,y:.86,z:.48,centre:1.09});
const SHOULDER_HEIGHT=1.30,SOCKET_REACH=1.15;
const shoulderBand=Math.sqrt(Math.max(.05,1-((SHOULDER_HEIGHT-TORSO.centre)/TORSO.y)**2));
// Half-width of the torso at shoulder height along a body-local direction.
const torsoReach=(x,z)=>1/Math.hypot(x/(TORSO.x*shoulderBand),z/(TORSO.z*shoulderBand));
const xAxis=new T.Vector3(1,0,0),up=new T.Vector3(0,1,0),direction=new T.Vector3(),bend=new T.Vector3(),elbow=new T.Vector3(),wrist=new T.Vector3(),target=new T.Vector3(),inverse=new T.Quaternion(),handTurn=new T.Quaternion(),spud=new T.Vector3();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>t*t*(3-2*t);
const palmAxis=new T.Vector3(),align=new T.Quaternion(),identity=new T.Quaternion();
const handSocket=new T.Vector3(0,-.13,.235),socketOffset=new T.Vector3(),aimRight=new T.Vector3(-Math.cos(BODY_YAW_OFFSET),0,-Math.sin(BODY_YAW_OFFSET)),aimForward=new T.Vector3(-Math.sin(BODY_YAW_OFFSET),0,Math.cos(BODY_YAW_OFFSET));
// Shoulders sit a fixed fraction past the torso surface along the aim frame's "across" axis, so
// turning the body further keeps the socket sphere buried instead of leaving it floating outside.
// Shoulder sockets, rest pose and elbow pole targets are all in that aim-aligned frame: "across"
// is the player's right and "fwd" is the sight direction, so arms hang at the sides of the
// side-on torso rather than off its front.
export const ARM_TUNING={shoulderWidth:torsoReach(aimRight.x,aimRight.z)*SOCKET_REACH,shoulderHeight:SHOULDER_HEIGHT,shoulderDepth:.02,restAcross:.82,restHeight:.80,pole:[.07,.95,.864],lightPole:[1.06,.80,.35],heavyOffPole:[-.75,.72,1.15],aimDownSpread:.55,aimDownDrop:.30};
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
   const shoulderMass=.014*Math.exp(-(t/.10)*(t/.10)),radius=.066+shoulderMass-t*.028;
   for(let j=0;j<=16;j++){const nx=sleeveNormal.x*ringCos[j]+sleeveSide.x*ringSin[j],ny=sleeveNormal.y*ringCos[j]+sleeveSide.y*ringSin[j],nz=sleeveNormal.z*ringCos[j]+sleeveSide.z*ringSin[j],index=ring*17+j;position.setXYZ(index,sleevePoint.x+nx*radius,sleevePoint.y+ny*radius,sleevePoint.z+nz*radius);normal.setXYZ(index,nx,ny,nz);}
  }position.needsUpdate=normal.needsUpdate=true;
 }
}
export function makeArm(world,parent,limbSkin,sign){
 // Arms wear the same textured potato skin as the legs, a few shades lighter than the torso,
 // so limbs read as potato and stand out against the body rather than vanishing into it.
 world.geo.finger??=new T.CapsuleGeometry(.037,.043,5,10);
 const arm=new T.Group();parent.add(arm);const shoulder=world.mesh('sphere',limbSkin,arm,0,0,0,.145,.152,.145),upper=world.mesh(sleeveGeometry(),limbSkin,arm),lower=world.mesh(sleeveGeometry(),limbSkin,arm),joint=new T.Object3D();upper.userData.ownGeometry=lower.userData.ownGeometry=true;arm.add(joint);
 const hand=new T.Group();arm.add(hand);world.mesh('sphere',limbSkin,hand,0,-.09,0,.137,.117,.076);world.mesh('cylinder',limbSkin,hand,0,.012,0,.078,.065,.073);world.mesh('sphere',limbSkin,hand,0,.025,0,.092,.032,.083);
 const fingers=[];
 for(let j=0;j<3;j++){const finger=new T.Group();finger.position.set((j-1)*.079,-.176,.008);hand.add(finger);const length=[.88,1,.91][j];world.mesh('finger',limbSkin,finger,0,-.035,0,1,length,1);const tip=new T.Group();tip.position.y=-.071*length;finger.add(tip);world.mesh('finger',limbSkin,tip,0,-.030,0,.97,.76,.97);fingers.push({finger,tip});}
 const thumb=new T.Group();thumb.position.set(sign*.12,-.060,.033);thumb.rotation.z=-sign*.65;hand.add(thumb);world.mesh('finger',limbSkin,thumb,0,-.035,0,1.15,1.05,1.1);const thumbTip=world.mesh('finger',limbSkin,thumb,sign*.022,-.086,.020,1.05,.8,1.05);thumbTip.rotation.x=-.5;
 arm.userData={sign,shoulder,upper,lower,joint,hand,fingers,thumb};return arm;
}
function grip(arm,curl){for(const {finger,tip}of arm.userData.fingers){finger.rotation.x=-curl;tip.rotation.x=-curl*.75;}arm.userData.thumb.rotation.x=-curl*.65;}
// Tuck wide reaches forward around the potato with a smooth, bounded lateral reach.
function tuckReach(point,threshold,width){const over=point.dot(aimRight)-threshold;if(over>0){const correction=over*over/(over+width);point.addScaledVector(aimRight,-correction).addScaledVector(aimForward,correction);}}
const REACH=(ARM_LENGTHS.upper+ARM_LENGTHS.forearm)*.985;
function solveArm(arm,shoulder,point,pole,throwing=false){const {upper,lower,joint,hand}=arm.userData;arm.userData.shoulder.position.copy(shoulder);wrist.copy(point);
 // Keep both bones at their intended length. Animated bend guides and the
 // outboard hand recovery avoid singularities without moving a solved elbow.
 // A target past the arm's reach is pulled back onto it, so a distant fore-end grip
 // bends the elbow open instead of silently stretching the sleeve into a rubber tube.
 direction.copy(wrist).sub(shoulder);let distance=Math.max(.001,direction.length());direction.divideScalar(distance);
 if(distance>REACH){distance=REACH;wrist.copy(shoulder).addScaledVector(direction,REACH);}
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
 // Everything the arms reach for is authored in the aim-aligned frame — "across" is the player's
 // right and "fwd" the sight direction — so turning the torso swings the body under a fixed
 // throwing action instead of dragging the action round with it.
 const aimLocal=(out,across,height,fwd)=>bodyPoint(out,aimRight.x*across+aimForward.x*fwd,height,aimRight.z*across+aimForward.z*fwd);
 const tossing=canThrow&&p.weapon==='throw'&&!p.runner,duration=p.shotDuration??THROW_DURATION,clock=p.shotAnim>0?Math.max(0,duration-p.shotAnim):0,recovery=Math.max(.01,duration-THROW_WINDUP),u=clamp((clock-THROW_WINDUP)/recovery,0,1),k=recovery/(THROW_DURATION-THROW_WINDUP),mapped=k*u+(1-k)*smooth(u),elapsed=clock<=THROW_WINDUP?clock:THROW_WINDUP+(THROW_DURATION-THROW_WINDUP)*mapped;
 if(tossing){const origin=muzzlePosition(p);aimLocal(ready,.790,1.78,-.203);aimLocal(windup,.724,2.04,-.350);toLocal(release,origin.x,origin.y,origin.z);aimLocal(follow,.754,1.20,.617);aimLocal(recoverPoint,1.081,1.85,.041);recoverVelocity.copy(ready).sub(follow).multiplyScalar(2);
  windVelocity.copy(release).sub(ready).multiplyScalar(4);releaseVelocity.copy(follow).sub(windup).multiplyScalar(4);followVelocity.copy(ready).sub(release).multiplyScalar(2);
  if(!p.shotAnim)spud.copy(ready);else if(elapsed<.068)arc(spud,ready,windup,zero,windVelocity,elapsed/.068,.068);else if(elapsed<THROW_WINDUP)arc(spud,windup,release,windVelocity,releaseVelocity,(elapsed-.068)/(THROW_WINDUP-.068),THROW_WINDUP-.068);else if(elapsed<.27)arc(spud,release,follow,releaseVelocity,followVelocity,(elapsed-THROW_WINDUP)/(.27-THROW_WINDUP),.27-THROW_WINDUP);else if(elapsed<.37)arc(spud,follow,recoverPoint,followVelocity,recoverVelocity,(elapsed-.27)/.10,.10);else arc(spud,recoverPoint,ready,recoverVelocity,zero,(elapsed-.37)/(THROW_DURATION-.37),THROW_DURATION-.37);
  // A carried potato follows the gait, then settles into the throwing action and
  // returns smoothly. Release itself remains pinned to the gameplay launch socket.
  const carry=p.shotAnim<=0?1:elapsed<.068?1-smooth(elapsed/.068):elapsed>.37?smooth((elapsed-.37)/(THROW_DURATION-.37)):0;
  bodyPoint(target,Math.cos(stride)*walk*.02*(m.gaitX??0),Math.sin(stride*2)*walk*.014,Math.cos(stride)*walk*.045*(m.gaitZ??1));bodyPoint(socketOffset,0,0,0);spud.addScaledVector(target.sub(socketOffset),carry);
  tuckReach(spud,.72,.06);m.heldSpud.position.copy(spud);m.heldSpud.visible=p.shotAnim<=0||elapsed<THROW_WINDUP;m.heldSpud.rotation.set(.2,-.2,.1);
 }else m.heldSpud.visible=false;
 m.gun.updateMatrix();
 for(let j=0;j<2;j++){const arm=m.arms[j],sign=j===0?-1:1,{hand}=arm.userData,side=-sign;
  // Shoulders and elbow poles are placed on the aim-aligned left/right axis, so the
  // quarter-turned torso no longer swings one arm across the chest and the other behind the back.
  // `side` is +1 for the weapon arm (the player's right) and -1 for the support arm.
  const socketX=aimRight.x*side*ARM_TUNING.shoulderWidth+aimForward.x*ARM_TUNING.shoulderDepth,socketZ=aimRight.z*side*ARM_TUNING.shoulderWidth+aimForward.z*ARM_TUNING.shoulderDepth;
  bodyPoint(shoulder,socketX,ARM_TUNING.shoulderHeight,socketZ);
  // Aiming down swings the elbow wide and low, the way a real shoulder clears the ribs, instead
  // of letting the upper arm fold back through the torso.
  const aimDown=m.gun.visible?Math.max(0,-(p.pitch??0))/.85:0,spread=1+aimDown*ARM_TUNING.aimDownSpread,drop=aimDown*ARM_TUNING.aimDownDrop;
  // A free elbow sits a little outboard of its own socket and well behind the torso. Both offsets
  // are measured in the aim frame, like the socket itself: pushing the elbow out along body x
  // alone only happened to look outboard at one particular body turn.
  const poleAcross=ARM_TUNING.pole[0]*spread,poleBack=ARM_TUNING.pole[2];
  bodyPoint(pole,socketX+aimRight.x*side*poleAcross-aimForward.x*poleBack,ARM_TUNING.pole[1]-drop,socketZ+aimRight.z*side*poleAcross-aimForward.z*poleBack);
  if(j===0&&m.gun.visible)aimLocal(pole,ARM_TUNING.lightPole[0]*spread,ARM_TUNING.lightPole[1]-drop,ARM_TUNING.lightPole[2]);
  else if(j===1&&m.gun.visible&&(p.weapon==='scatter'||p.weapon==='rpg'))aimLocal(pole,ARM_TUNING.heavyOffPole[0],ARM_TUNING.heavyOffPole[1]-drop,ARM_TUNING.heavyOffPole[2]);
  // The throw arc lives in the aim frame like every other pole here, not in body coordinates:
   // the spud it reaches for is placed in aim space, so a further-turned torso has to swing under
   // the same arm path rather than drag the upper arm through the chest.
   if(j===0&&tossing){aimLocal(readyPole,.90,1.17,-.84);aimLocal(windPole,.90,1.40,-.84);aimLocal(releasePole,.755,1.85,.006);aimLocal(followPole,.775,.90,-.018);aimLocal(recoverPole,1.018,1.40,-.214);
   if(!p.shotAnim)pole.copy(readyPole);else if(elapsed<.068)pole.lerpVectors(readyPole,windPole,smooth(elapsed/.068));else if(elapsed<THROW_WINDUP)pole.lerpVectors(windPole,releasePole,smooth((elapsed-.068)/(THROW_WINDUP-.068)));else if(elapsed<.27)pole.lerpVectors(releasePole,followPole,smooth((elapsed-THROW_WINDUP)/(.27-THROW_WINDUP)));else if(elapsed<.37)pole.lerpVectors(followPole,recoverPole,smooth((elapsed-.27)/.10));else pole.lerpVectors(recoverPole,readyPole,smooth((elapsed-.37)/(THROW_DURATION-.37)));
  }hand.rotation.set(0,0,sign*.08);let curl=.22;
  // Only the weapon arm grips. A potato torso is wider than the arms are long, so a support
  // hand can never actually reach across to the fore-end; forcing it drove a straight upper
  // arm clean through the chest. The free arm braces at the side instead.
  if(m.gun.visible&&j===0){
   // Grip where the shorter arm can actually hold: the wide-bodied weapons are gripped at the
   // receiver rather than out along the fore-end, so the upper arm never gets dragged into the ribs.
   target.set(0,-.10,p.weapon==='rpg'||p.weapon==='scatter'?-.50:-.72).applyMatrix4(m.gun.matrix);hand.quaternion.copy(m.gun.quaternion);curl=1.35;}
  else if(tossing&&j===0){
   // Palm faces the throw, fingers cradle the rear skin; a small wrist cock
   // replaces the old upward/backward-facing palm and under-potato grip.
   const handX=elapsed<.068?-.18*smooth(elapsed/.068):elapsed<THROW_WINDUP?-.18+.30*smooth((elapsed-.068)/(THROW_WINDUP-.068)):elapsed<.27?.12+.18*smooth((elapsed-THROW_WINDUP)/(.27-THROW_WINDUP)):.30*(1-smooth((elapsed-.27)/(THROW_DURATION-.27)));
   hand.rotation.set(handX,-BODY_YAW_OFFSET,Math.PI,'YXZ');hand.quaternion.premultiply(m.bob.quaternion);socketOffset.copy(handSocket).applyQuaternion(hand.quaternion);target.copy(spud).sub(socketOffset);curl=p.shotAnim>0&&elapsed>=THROW_WINDUP?.08:.82;}
  else if(p.catchTime>0){aimLocal(target,side*.72,1.40,.66);hand.rotation.x=-1.4;curl=.10;}
  else{const swing=Math.cos(stride+j*Math.PI)*walk,gaitAcross=(m.gaitX??0)*aimRight.x+(m.gaitZ??1)*aimRight.z,gaitFwd=(m.gaitX??0)*aimForward.x+(m.gaitZ??1)*aimForward.z;
   // Gait comes in body coordinates; rotate it into the aim frame the arms now live in so the
   // swing still opposes the same-side foot in real travel directions.
   aimLocal(target,side*ARM_TUNING.restAcross+swing*.055*gaitAcross,ARM_TUNING.restHeight+Math.abs(swing)*.025,-.04+swing*.21*gaitFwd);hand.rotation.x=-swing*.12;if(tossing&&p.shotAnim>0){target.y+=Math.sin(elapsed/THROW_DURATION*Math.PI)*.10;target.z-=Math.sin(elapsed/THROW_DURATION*Math.PI)*.08;}}
  solveArm(arm,shoulder,target,pole,tossing&&j===0);if(!(tossing&&j===0))limitWrist(arm);grip(arm,curl);
 }
}
