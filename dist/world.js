import {makeSpudGun} from './weapon-model.js';
import {makeArm,poseArms,BODY_YAW_OFFSET,TORSO} from './character-rig.js';
import {validateOutfit,tintColor,skinColor} from './locker.js';
import {dressWorld,barn} from './environment-design.js';
import {mapId} from './map-catalogue.js';
import {leafMaterial,addTree,waterSurface,fountainFlow} from './nature.js';
import {cameraPose,weaponAim,cylinderContact} from './aiming.js';
import {bodyHeight} from './stance.js';
import {WEAPONS} from './weapons.js';
import * as T from './assets/three.module.js';
import {PlayerLabel} from './player-label.js';
import {CELL,rng,POWERUPS,isTrial,boxContact3D,JUMP_SPEED} from './core.js';
import {roundedBox,potatoGeometry,applyWorldUV,makeSky,curveTube,clogGeometry,clogProfile,ambientDust} from './visuals.js';
// Sampled once: the shoe's own surface, so painted decoration can be laid on it rather than guessed.
const CLOG_PROFILE=clogProfile();
const colors=[0xf1bc40,0x4ccbd3,0xef6b72,0x9b92ed];
export {colors};
// Feet have to keep up with the ground, which a sine wave alone never does: it only matches
// ground speed at mid-stance and skates at either end. So the stance half drives the foot back
// linearly and STRIDE_RATE is derived to make that return exactly cancel the body's travel,
// leaving the planted foot pinned to the ground; the swing half keeps its cosine arc.
const STEP_REACH=.30,STRIDE_RATE=Math.PI/(2*STEP_REACH),TAU=Math.PI*2;
// The eyelid is a shell cap sharing the eyeball's centre, so closing it sweeps the cap around the
// eye at a constant size the way a lid actually moves. Open, it is tipped back out of sight behind
// the brow; the sweep below carries it down across the front.
const LID_OPEN=-1.18;
// One entry per player slot: skin, how the body is stretched, the paint on the klompen carving and
// which piece of headwear it wears. `hat:null` is the bare-headed baseline the sight-line tests
// measure against.
// Each rival's kit is written in the same wardrobe the player picks from, so the locker and the
// four bots can never drift apart: one list of pieces, one set of builders.
const BREEDS=[
 {build:[1,1,1],paint:0xb5342f,outfit:{skin:'russet',head:'none',eyes:'none',neck:'none',tint:'sun'}},
 {build:[1.05,.95,1.04],paint:0x2f6f8c,outfit:{skin:'maris',head:'cap',eyes:'none',neck:'none',tint:'slate'}},
 {build:[.94,1.07,.95],paint:0x3f7f4a,outfit:{skin:'rooster',head:'headscarf',eyes:'none',neck:'none',tint:'rust'}},
 {build:[1.03,1.02,.97],paint:0x7a4b9c,outfit:{skin:'golden',head:'goggles',eyes:'none',neck:'none',tint:'coal'}}
];
const indoorGlow=half=>Math.min(3.4,1.6+half*.045);
// bulk/length are scales on the shared launcher mesh; kit names an optional attachment group.
const GUN_SHAPES={spud:{bulk:1,length:.72},repeater:{bulk:1,length:.74,kit:'mag'},scatter:{bulk:1.06,length:.82},
 masher:{bulk:.92,length:.70},rpg:{bulk:1.2,length:.91,kit:'warhead'},peeler:{bulk:.88,length:.92,kit:'scope'},
 fryer:{bulk:1.16,length:.60,kit:'funnel'},sticky:{bulk:1.1,length:.56,kit:'drum'}};
// How far the knee tucks climbing, how far the leg reaches falling, and the stride the legs hold
// apart throughout a leap. AIR_REACH is negative lift: it puts the ankle below where it stands, so
// the legs are visibly longer in the air than on the ground.
const AIR_TUCK=.15,AIR_REACH=.10,AIR_SPLIT=.30;
const footReach=(phase,walk)=>{const cycle=((phase%TAU)+TAU)%TAU;return walk*STEP_REACH*(cycle<Math.PI?-Math.cos(cycle):1-2*(cycle-Math.PI)/Math.PI);};

export class World{
 constructor(canvas,renderer=null){
  if(renderer)this.renderer=renderer;else{try{this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch{this.renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'default'});}}this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
  this.scene=new T.Scene();this.scene.background=new T.Color(0x8db4c3);this.scene.fog=new T.Fog(0x8db4c3,45,125);this.cameras=[0,1].map(()=>new T.PerspectiveCamera(65,1,.08,180));this.cameraReady=[false,false];this.ray=new T.Raycaster();this.wallMeshes=[];this.materials=new Map();this.movers=[];this.geo={box:new T.BoxGeometry(1,1,1),sphere:new T.SphereGeometry(1,24,16),foliage:new T.SphereGeometry(1,16,10),foliageLow:new T.SphereGeometry(1,8,6),eyelid:new T.SphereGeometry(1,24,10,0,Math.PI*2,0,Math.PI*.55),hipRoof:new T.ConeGeometry(Math.SQRT1_2,1,4).rotateY(Math.PI/4),smallSphere:new T.SphereGeometry(1,10,8),potato:potatoGeometry(),rounded:roundedBox(),clog:clogGeometry(),cylinder:new T.CylinderGeometry(1,1,1,20),cone:new T.ConeGeometry(1,1,4),leaf:new T.PlaneGeometry(1,1),leafPlain:new T.CircleGeometry(.5,12)};
  this.scratch={hip:new T.Vector3(),ankle:new T.Vector3(),knee:new T.Vector3(),direction:new T.Vector3(),inverse:new T.Quaternion(),up:new T.Vector3(0,1,0),forward:new T.Vector3(0,0,1)};
  this.textures={skin:this.texture('skin'),brick:this.texture('brick'),stone:this.texture('stone'),wood:this.texture('wood'),hedge:this.texture('hedge')};this.effects=[];this.projectileMeshes=new Map();this.characters=[];this.qualityMode='high';this.ready=this.loadMaterials();this.resize();
 }
 async loadMaterials(loader=new T.TextureLoader(),timeoutMs=8000){
  this.materialFallbacks=[];this.pbr??={};
  await Promise.all([this.loadPBR(loader,timeoutMs),...([['foliage','oak-foliage-v10.png'],['skin','potato-skin-albedo-realistic.png'],['stone','dutch-cobblestone-color.png'],['brick','dutch-brick-color.png']].map(async([key,file])=>{
   const texture=await new Promise(resolve=>{let done=false;const finish=value=>{if(done){value?.dispose();return;}done=true;clearTimeout(timer);resolve(value);};const timer=setTimeout(()=>finish(null),timeoutMs);try{loader.loadAsync('assets/'+file).then(finish,()=>finish(null));}catch{finish(null);}});
   if(!texture){this.materialFallbacks.push(key);return;}
   texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures[key]?.dispose();this.textures[key]=texture;
  }))]);
 }
 async loadPBR(loader,timeoutMs){await Promise.all([['paving','cobblestone_floor_08','2k'],['oak','oak_veneer_02','1k']].map(async([key,name,size])=>{const loaded=await Promise.all(['diff','nor_gl','rough'].map(type=>new Promise(resolve=>{let done=false;const finish=t=>{if(done){t?.dispose();return;}done=true;clearTimeout(timer);resolve(t);};const timer=setTimeout(()=>finish(null),timeoutMs);try{loader.loadAsync('assets/'+name+'_'+type+'_'+size+'.jpg').then(finish,()=>finish(null));}catch{finish(null);}})));if(loaded.some(t=>!t)){loaded.forEach(t=>t?.dispose());this.materialFallbacks.push(key);return;}loaded.forEach((t,i)=>{t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=i===0?T.SRGBColorSpace:T.NoColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());});this.pbr[key]=loaded;}));}
 groundMaterial(size,night,tint=null){if(!this.pbr?.paving)return this.mat(tint??0xf0eee0,'stone');const key='ground:'+size+':'+night+':'+tint;if(!this.materials.has(key)){const maps=this.pbr.paving.map(t=>{const clone=t.clone();clone.repeat.set(size/2,size/2);return clone;});this.groundMaps??=[];this.groundMaps.push(...maps);this.materials.set(key,new T.MeshStandardMaterial({color:tint??(night?0xa7b8c1:0xe8e7db),map:maps[0],normalMap:maps[1],normalScale:new T.Vector2(.7,.7),roughnessMap:maps[2],roughness:night?.65:.95}));}return this.materials.get(key);}

 // Anything that only a physical material can do — a clear coat on paint, the sheen of wool, glass
 // that bends light — builds a physical material. Asking for those on a standard one silently did
 // nothing but print a warning, so the request itself is what decides now.
 static PHYSICAL=['clearcoat','clearcoatRoughness','sheen','sheenColor','sheenRoughness','transmission','thickness','iridescence','specularIntensity'];
 mat(c,texture=null,opts={}){const key=c+':'+texture+':'+JSON.stringify(opts);if(!this.materials.has(key)){const projected=['stone','brick','hedge'].includes(texture);const {physical,...rest}=opts,wants=physical||World.PHYSICAL.some(k=>k in rest);const m=new (wants?T.MeshPhysicalMaterial:T.MeshStandardMaterial)({color:c,roughness:.8,...(texture?{map:this.textures[texture],bumpMap:this.textures[texture],bumpScale:projected?.13:.028}:{}),...rest});if(texture==='wood'&&this.pbr?.oak){m.map=this.pbr.oak[0];m.normalMap=this.pbr.oak[1];m.normalScale.set(.32,.32);m.roughnessMap=this.pbr.oak[2];m.bumpMap=null;}if(projected)applyWorldUV(m,texture==='brick'?.58:texture==='stone'?.40:.85);this.materials.set(key,m);}return this.materials.get(key);}
 mesh(geo,mat,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new T.Mesh(geo==='sphere'&&Math.max(sx,sy,sz)<.2?this.geo.smallSphere:this.geo[geo]??geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 texture(type){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),r=rng(551+type.length);let base={skin:'#d3a565',brick:'#c1a48b',stone:'#b4b8b4',wood:'#dac088',hedge:'#719768'}[type];ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
  for(let i=0;i<7000;i++){ctx.globalAlpha=r()*.23;ctx.fillStyle=r()>.5?'#fff':'#201d10';const x=r()*256,y=r()*256,s=r()*2.5+.4;ctx.fillRect(x,y,type==='wood'?s*20:s,s);}ctx.globalAlpha=1;
  if(type==='stone'||type==='brick'){let h=type==='brick'?32:48;ctx.lineWidth=3;ctx.strokeStyle=type==='brick'?'#695c50':'#747c77';for(let y=0;y<280;y+=h){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();for(let x=(y/h%2)*32-64;x<280;x+=64){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+h);ctx.stroke();}}}
  if(type==='skin'){for(let i=0;i<70;i++){const x=r()*256,y=r()*256;ctx.fillStyle='#735335';ctx.beginPath();ctx.ellipse(x,y,r()*2+1,r()*3+1,r()*3,0,7);ctx.fill();ctx.fillStyle='#ead4a178';ctx.fillRect(x-2,y-3,2,1);}}
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
 }
 quality(v){this.qualityMode=v;this.resolutionLow=0;this.resolutionHigh=0;this.resolutionCooldown=0;const size=v==='cinematic'?2048:v==='high'?1536:768;if(this.sun&&this.sun.shadow.mapSize.x!==size){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(size,size);}this.renderer.shadowMap.needsUpdate=true;this.pixelRatio=Math.min(devicePixelRatio,v==='cinematic'?2:v==='high'?1.5:1);this.renderer.setPixelRatio(this.pixelRatio);this.renderer.shadowMap.enabled=v!=='performance';this.resize();}
 balanceResolution(fps){
  if(this.qualityMode==='cinematic'||!Number.isFinite(fps))return;
  if(this.resolutionCooldown>0){this.resolutionCooldown--;return;}
  this.resolutionLow=fps<55?(this.resolutionLow??0)+1:0;this.resolutionHigh=fps>=60?(this.resolutionHigh??0)+1:0;
  const maximum=Math.min(devicePixelRatio,this.qualityMode==='high'?1.5:1),minimum=Math.min(this.qualityMode==='performance'?.8:1,maximum),current=this.pixelRatio??maximum,next=Math.min(maximum,Math.max(minimum,current+(this.resolutionLow>=2?-.10:this.resolutionHigh>=4?.05:0)));
  if(Math.abs(next-current)>.01){this.pixelRatio=next;this.resolutionLow=this.resolutionHigh=0;this.resolutionCooldown=2;this.renderer.setPixelRatio(next);}
 }

 dispose(){this.characters.forEach(m=>m.label.dispose());this.root?.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.isLight&&o.shadow)o.shadow.dispose();if(o.userData.ownGeometry)o.geometry.dispose();if(o.userData.ownMaterial)o.material.dispose();o.userData.ownTexture?.dispose();});Object.values(this.geo).forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());Object.values(this.textures).forEach(t=>t.dispose());Object.values(this.pbr??{}).flat().forEach(t=>t.dispose());this.groundMaps?.forEach(t=>t.dispose());this.environmentMaps?.forEach(t=>t.dispose());this.contactTexture?.dispose();this.renderer.dispose();}
 environment(night){if(!this.renderer.isWebGLRenderer)return;this.environmentMaps??=new Map();if(!this.environmentMaps.has(night)){
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,night?'#101d37':'#6ea3c5');gradient.addColorStop(.47,night?'#8492b0':'#e9d7b3');gradient.addColorStop(.53,night?'#353c42':'#998e74');gradient.addColorStop(1,'#30342e');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);const glow=ctx.createRadialGradient(340,65,1,340,65,44);glow.addColorStop(0,'#ffffff');glow.addColorStop(.06,'#ffffff');glow.addColorStop(.16,night?'#c6dcfa':'#fff6dd');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(291,16,98,98);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.mapping=T.EquirectangularReflectionMapping;this.environmentMaps.set(night,texture);
 }this.scene.environment=this.environmentMaps.get(night);
  // Metal and clear coat need something to reflect. The sky this builds is all these worlds have.
  this.scene.environmentIntensity=night?.58:.95;}
 resize(){this.w=innerWidth;this.h=innerHeight;this.renderer.setSize(this.w,this.h,false);}
 build(map,level,players,bonus){
  this.characters.forEach(m=>m.label.dispose());
  if(this.root){this.scene.remove(this.root);this.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.isLight&&o.shadow)o.shadow.dispose();if(o.userData.ownGeometry)o.geometry.dispose();if(o.userData.ownMaterial)o.material.dispose();if(o.userData.ownTexture)o.userData.ownTexture.dispose();});}
  this.root=new T.Group();this.scene.add(this.root);this.map=map;this.level=level;this.isBonus=bonus;this.solids=[...map.walls,...map.platforms];this.movers=[];this.wallMeshes=[];this.effects=[];this.projectileMeshes.clear();this.characters=[];this.cameraReady=[false,false];this.water=null;this.waterSurfaces=[];this.waterFlows=[];this.ambientParticles=null;this.leafClock??={value:0};
  const night=['canal','depot','shop','night','fort','factory','cannery'].includes(level.theme),hedge=['hedge','garden','corn','fort','orchard','grove'].includes(level.theme),stoneWorld=['quarry','pit'].includes(level.theme),r=rng(level.seed),root=this.root;
  // Three surfaces the older worlds never needed: a lit shed with a roof over it, open sand, and
  // a freight yard's asphalt. `indoor` in particular changes what the sky and the horizon mean.
  const indoor=['factory','cannery'].includes(level.theme),sand=['beach','dunes'].includes(level.theme),yard=['shipment','gantry'].includes(level.theme);
  this.indoor=indoor;
  this.environment(night);this.scene.background.set(night?0x182d45:0x87b8c9);this.scene.fog.color.copy(this.scene.background);this.renderer.toneMappingExposure=night?1.2:1.03;
  if(!indoor)root.add(makeSky(night,level.theme==='fort'));
  root.add(new T.HemisphereLight(indoor?0xe4ecf2:night?0xadc3fa:0xc1e2fa,indoor?0x6b7278:0x71614c,indoor?1.15:night?.7:.75));
  const sun=this.sun=new T.DirectionalLight(night?0xbed6ff:0xffdfab,night?2.1:3.2);sun.position.set(-25,50,20);sun.castShadow=true;sun.shadow.mapSize.set(this.qualityMode==='cinematic'?2048:this.qualityMode==='high'?1536:768,this.qualityMode==='cinematic'?2048:this.qualityMode==='high'?1536:768);const d=map.n*CELL*.55;Object.assign(sun.shadow.camera,{left:-d,right:d,top:d,bottom:-d,near:1,far:120});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;root.add(sun);
  // Soft opposite-side fill keeps the shadowed side of characters/buildings readable without a second shadow pass.
  const fill=new T.DirectionalLight(night?0x3d5a86:0xcfe3ec,night?.26:.34);fill.position.set(22,16,-18);root.add(fill);
  const dust=ambientDust(150,map.n*CELL*.42,night?3.6:5.5);root.add(dust);this.ambientParticles=dust;
  const groundTint=indoor?0xb4bbc1:sand?0xead3a0:yard?0x8d9095:null;
  const ground=this.mesh(new T.PlaneGeometry(map.n*CELL,map.n*CELL),indoor?this.mat(groundTint,null,{roughness:.92}):this.groundMaterial(map.n*CELL,night,groundTint),root,0,-.005,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;ground.userData.ownGeometry=true;
  // Paved perimeter and non-playable surroundings.
  this.mesh('box',this.mat(indoor?0x7d848b:sand?0xd9bf8c:night?0x344352:0x7e9b84),root,0,-.52,0,map.n*CELL+120,.5,map.n*CELL+120);
  const half=map.n*CELL/2;
  if(indoor)this.shedShell(map,half);
  for(const w of map.walls)if(w.prop==='bin')this.bin(w.x,w.z,0).scale.setScalar(1.5);
  for(const b of map.buildings??[]){const g=mapId(level)==='farm'?barn(this,b):this.building(b.x,b.z,b.w,b.h,r,night);if(mapId(level)!=='farm')g.scale.z=b.d/4;this.mesh('box',this.mat(0xd5cbbb,'stone'),root,b.x,.025,b.z,b.w+1.4,.05,b.d+1.4);}
  const wallMat=indoor?this.mat(0xcdd5da,null,{roughness:.58,metalness:.14}):this.mat(hedge?(level.theme==='corn'?0xb7ac4f:['orchard','grove'].includes(level.theme)?0x59813f:0x496b45):stoneWorld?0xd6d8ce:sand?0xe0c48f:yard?0x7f8a90:(['depot','shop'].includes(level.theme)?0x93a4a5:0xf0dbbc),hedge?'hedge':stoneWorld||sand||yard?'stone':'brick');
  const im=new T.InstancedMesh(this.geo.rounded,wallMat,map.walls.length),dummy=new T.Object3D();im.castShadow=im.receiveShadow=true;
  map.walls.forEach((w,i)=>{dummy.position.set(w.x,w.h/2,w.z);dummy.scale.set((w.prop||w.architecture)?0:w.w,(w.prop||w.architecture)?0:w.h,(w.prop||w.architecture)?0:w.d);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);});root.add(im);this.wallMeshes.push(im);
  if(hedge){const foliage=new T.InstancedMesh(this.textures.foliage?this.geo.leaf:this.geo.leafPlain,this.leaves(),map.walls.length*10);map.walls.forEach((w,i)=>{for(let j=0;j<10;j++){const angle=j*2.399;dummy.position.set(w.x+Math.cos(angle)*w.w*.47,w.h-.15+(j%3)*.10,w.z+Math.sin(angle)*w.d*.47);dummy.rotation.set((j%3-1)*.6,angle,Math.sin(angle)*.5);dummy.scale.setScalar(w.prop||w.architecture?0:1.15);dummy.updateMatrix();foliage.setMatrixAt(i*10+j,dummy.matrix);foliage.setColorAt(i*10+j,new T.Color(level.theme==='corn'?0xd0c78a:j%2?0xced39c:0xabc195));}});foliage.castShadow=false;foliage.receiveShadow=true;root.add(foliage);dummy.rotation.set(0,0,0);}
  else{const tops=new T.InstancedMesh(this.geo.box,indoor?this.mat(0x5d666e,null,{metalness:.55,roughness:.4}):this.mat(0xd8cbb0,'stone'),map.walls.length);map.walls.forEach((w,i)=>{dummy.position.set(w.x,w.h+(indoor?.03:.05),w.z);dummy.scale.set((w.prop||w.architecture)?0:w.w+.08,(w.prop||w.architecture)?0:indoor?.09:.15,(w.prop||w.architecture)?0:w.d+.08);dummy.updateMatrix();tops.setMatrixAt(i,dummy.matrix);});tops.castShadow=true;root.add(tops);
   // A painted dado band at waist height keeps the partitions from reading as blank white slabs,
   // and is the one line of colour a working floor actually has on its walls.
   if(indoor){const band=new T.InstancedMesh(this.geo.box,this.mat(0xd8a13a,null,{roughness:.62}),map.walls.length);
    map.walls.forEach((w,i)=>{const blank=(w.prop||w.architecture)?0:1;dummy.position.set(w.x,.96,w.z);dummy.scale.set(blank*(w.w+.05),blank*.14,blank*(w.d+.05));dummy.updateMatrix();band.setMatrixAt(i,dummy.matrix);});
    band.castShadow=false;band.receiveShadow=true;root.add(band);}
  }
  this.dressEnvironment(map,level,night,r);if(level.mode==='assault'&&!bonus)this.assaultCourse(map);if(level.mode==='climb'&&!bonus)this.climbTower(map);
  this.trailCells=new Set();this.trail=null;if(!bonus&&level.mode==='race'){this.trail=new T.InstancedMesh(this.geo.cylinder,this.mat(0xe7cc8d,null,{emissive:0xaa883f,emissiveIntensity:.25}),map.n*map.n);this.trail.count=0;this.root.add(this.trail);}
  this.goal=this.marker(map.exit.x,map.exit.z,0x79edba,'exit');this.goal.position.y=(map.exitHeight??0)+.03;this.goal.visible=bonus||isTrial(level);
  this.zone=this.marker(0,0,0xffcf50,'zone');this.zone.visible=!bonus&&level.mode==='capture';
  this.checkpoints=[];this.pickups=[];this.targets=[];
  if(bonus)for(const [i,p]of (map.objectives??[]).entries()){
   const marker=this.marker(p.x,p.z,0xffcc3e,'checkpoint');this.checkpoints.push(marker);
   // A crate to actually stand over and hold, rather than a ring painted on the floor.
   const crate=this.mesh('rounded',this.mat(0xc9963f,'wood',{roughness:.7}),this.root,p.x,.42,p.z,1.5,.84,1.5);crate.castShadow=true;marker.userData.crate=crate;
   this.mesh('rounded',this.mat(0xffd76b,null,{emissive:0xffb347,emissiveIntensity:.6}),this.root,p.x,.87,p.z,1.56,.10,1.56).userData.ownMaterial=false;
   for(const side of[-1,1])this.mesh('rounded',this.mat(0x6d4f2a,'wood'),this.root,p.x+side*.72,.42,p.z,.10,.88,1.52);
  }
  for(const p of players)this.characters.push(this.character(p.id,p.outfit));
 }
 markTrail(p){if(!this.trail||p.respawn>0)return;const cell=this.map.toCell(p.x,p.z),key=cell.x+','+cell.z;if(this.trailCells.has(key))return;this.trailCells.add(key);const d=new T.Object3D();d.position.set(p.x,.04,p.z);d.scale.set(.15,.025,.15);d.updateMatrix();this.trail.setMatrixAt(this.trail.count++,d.matrix);this.trail.instanceMatrix.needsUpdate=true;this.trail.computeBoundingSphere();}
 building(x,z,w,h,r,night,front=z<0?1:-1){
  const g=new T.Group();g.position.set(x,0,z);this.root.add(g);const palette=[0xe9c8aa,0xf1dfbc,0xd7a78e,0xc9c3af,0xe9d5b9],facade=this.mat(palette[Math.floor(r()*palette.length)],'brick');this.mesh('rounded',facade,g,0,h/2,0,w,h,4);
  const roofMat=this.mat(0x3f505b,'wood',{roughness:.82});for(const side of[-1,1]){const roof=this.mesh('rounded',roofMat,g,side*w*.268,h+w*.195,0,w*.68,.16,4.5);roof.rotation.z=-side*.64;}
  const triangle=new T.Shape();triangle.moveTo(-w*.49,0);triangle.lineTo(0,w*.37);triangle.lineTo(w*.49,0);triangle.closePath();const geo=new T.ExtrudeGeometry(triangle,{depth:.16,bevelEnabled:false});for(const side of[-1,1]){const gable=this.mesh(geo,facade,g,0,h,side*2);gable.userData.ownGeometry=true;}
  this.mesh('rounded',this.mat(0xded6bd),g,0,h+.01,2.09,w+.20,.15,.24);this.mesh('rounded',this.mat(0xc9c0ac,'stone'),g,0,.24,0,w+.15,.38,4.15);
  for(let y=1.6;y<h-.5;y+=2.3)for(let a=-w/2+1;a<w/2;a+=1.7){const glow=night&&r()>.28,frame=this.mat(0xdfd8bb);this.mesh('rounded',frame,g,a,y,front*2.06,1.0,1.48,.14);this.mesh('rounded',this.mat(glow?0xf6c677:0x304958,null,glow?{emissive:0xffb35e,emissiveIntensity:.45,roughness:.4}:{roughness:.18,metalness:.25}),g,a,y,front*2.15,.81,1.27,.035);this.mesh('box',frame,g,a,y,front*2.185,.05,1.28,.035);this.mesh('box',frame,g,a,y+.08,front*2.185,.83,.045,.04);this.mesh('rounded',frame,g,a,y-.75,front*2.20,1.10,.10,.31);
   if(y<2&&r()>.5){this.mesh('rounded',this.mat(0x515c48,'wood'),g,a,y-.94,front*2.27,.90,.27,.30);for(let j=0;j<4;j++)this.mesh('sphere',this.mat(j%2?0xb6414b:0xe3b152),g,a-.3+j*.2,y-.73,front*2.27,.10,.09,.1);}
  }
  this.mesh('rounded',this.mat(0xddd2b7),g,0,1.04,front*2.1,1.22,2.1,.18);this.mesh('rounded',this.mat(0x35504f,'wood'),g,0,.98,front*2.21,1.0,1.96,.08);this.mesh('sphere',this.mat(0xd6b868,null,{metalness:.8,roughness:.25}),g,.33,.9,front*2.28,.04,.04,.025);
  this.mesh('rounded',facade,g,-w*.27,h+w*.32,0,.64,1.65,.66);this.mesh('rounded',this.mat(0x777363),g,-w*.27,h+w*.32+.83,0,.81,.15,.83);
  for(const a of[-w*.48,w*.48])this.mesh('cylinder',this.mat(0x4b5551,null,{metalness:.5}),g,a,h/2,front*2.12,.045,h,.045);
  return g;
 }
 dressEnvironment(map,level,night,r){
  if(map.waterCells?.length){
   // The surface follows wherever the water cells actually are, rather than assuming every map's
   // water is a canal across the middle. The harbour still gets its canal; the beach gets a tide
   // line along its own edge.
   const xs=map.waterCells.map(c=>c.x),zs=map.waterCells.map(c=>c.z);
   const minX=Math.min(...xs)-CELL/2,maxX=Math.max(...xs)+CELL/2,minZ=Math.min(...zs)-CELL/2,maxZ=Math.max(...zs)+CELL/2;
   this.water=waterSurface((minX+maxX)/2,.045,(minZ+maxZ)/2,maxX-minX,maxZ-minZ,night);this.waterSurfaces.push(this.water);this.root.add(this.water);}
  dressWorld(this,map,level,night,r);
 }
 addCanalBackdrop(map,night){const half=map.n*CELL/2;this.water=waterSurface(half+5,-.08,0,7,map.n*CELL+20,night);this.waterSurfaces.push(this.water);this.root.add(this.water);for(const side of[-1,1])this.mesh('rounded',this.mat(0x777c72,'stone'),this.root,half+5+side*3.6,.2,0,.35,.6,map.n*CELL+20);}

 canalBridges(map){
  const root=this.root,mid=Math.floor(map.n/2),wood=this.mat(0xa88a60,'wood'),iron=this.mat(0x35474b,null,{metalness:.65,roughness:.35});
  for(const cell of[3,mid,map.n-4]){const {x}=map.toWorld(cell,mid);for(let plank=0;plank<24;plank++)this.mesh('rounded',wood,root,x,.04,(plank-11.5)*.43,CELL-.05,.08,.4);for(const side of[-1,1]){for(let post=0;post<6;post++)this.mesh('cylinder',iron,root,x+side*1.42,.55,(post-2.5)*1.65,.045,1.1,.045);}this.lamp(x-1.42,-5.4,0,true);this.lamp(x+1.42,5.4,0,true);}
  for(const rail of map.bridgeRails)this.mesh('rounded',iron,root,rail.x,rail.base+rail.h/2,rail.z,rail.w,rail.h,rail.d);
  for(const side of[-1,1]){this.mesh('rounded',this.mat(0xb2b5ac,'stone'),root,0,.025,side*5.1,(map.n-2)*CELL,.05,.55);}
  // Moored boats sit in water cells, so their hulls never obstruct a bridge route.
  for(const cell of[6,map.n-7]){const {x}=map.toWorld(cell,mid),g=new T.Group();g.position.set(x,.08,.2);root.add(g);this.mesh('sphere',this.mat(0x3f555b,null,{metalness:.25}),g,0,0,0,2.35,.33,.8);this.mesh('rounded',wood,g,0,.18,0,3.4,.12,1.25);this.mesh('rounded',this.mat(0xe2d6b5),g,-.4,.55,0,1.4,.75,1.2);this.mesh('rounded',iron,g,-.4,.98,0,1.7,.10,1.35);}
 }
 marketSquare(map){const root=this.root,stone=this.mat(0xd9c7a5,'stone');
  for(const b of map.buildings){const sign=b.z<0?1:-1;this.stall(b.x,b.z+sign*(b.d/2-.85),0,Math.round(b.x));this.bin(b.x-b.w/2+.5,b.z+sign*(b.d/2-.4),0);this.lamp(b.x+b.w/2-.35,b.z+sign*(b.d/2-.35),0,false);}
  const ring=this.mesh(new T.TorusGeometry(4,.08,8,64),stone,root,0,.026,0);ring.rotation.x=Math.PI/2;ring.userData.ownGeometry=true;
  for(const side of[-1,1])for(let n=0;n<5;n++){const post=this.mesh('cylinder',this.mat(0x425951),root,side*2.5,.28,(n-2)*4,.04,.56,.04);post.castShadow=false;}
 }
 formalGarden(map){const root=this.root,leaf=this.mat(0x47794c,'hedge');
  for(const [cx,cz]of[[4,5],[map.n-5,3],[3,map.n-5],[map.n-4,map.n-5]]){const p=map.toWorld(cx,cz);for(const side of[-1,1])this.mesh('cylinder',this.mat(0xf0dcb4),root,p.x+side*1.32,1.35,p.z,.10,2.7,.10);const arch=this.mesh(new T.TorusGeometry(1.3,.20,8,24,Math.PI),leaf,root,p.x,2.15,p.z);arch.userData.ownGeometry=true;}
  const p=map.toWorld(Math.floor(map.n/2),3);this.mesh('cylinder',this.mat(0xdacfb8,'stone'),root,p.x,.18,p.z,1.25,.36,1.25);const pool=waterSurface(p.x,.405,p.z,2.14,2.14,false,{round:true});root.add(pool);this.waterSurfaces.push(pool);this.mesh('cylinder',this.mat(0xe6d6b7,'stone'),root,p.x,.78,p.z,.22,.80,.22);this.mesh('sphere',this.mat(0xe6d6b7,'stone'),root,p.x,1.22,p.z,.55,.10,.55);const rim=this.mesh(new T.TorusGeometry(1.16,.10,12,64),this.mat(0xdacfb8,'stone'),root,p.x,.40,p.z);rim.rotation.x=-Math.PI/2;rim.userData.ownGeometry=true;this.waterFlows.push(fountainFlow(p.x,p.z,root));
 }
 weaponDrop(x,z,weapon,ammo=WEAPONS[weapon].ammo){const g=this.crate(x,z,0,.85);const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const material=new T.SpriteMaterial({map:texture,depthTest:true,toneMapped:false});const sprite=new T.Sprite(material);sprite.position.y=1.75;sprite.scale.set(2.8,.875,1);sprite.userData.ownMaterial=true;sprite.userData.ownTexture=texture;g.add(sprite);g.userData.weaponCanvas=canvas;g.userData.weaponTexture=texture;this.relabelWeaponDrop(g,weapon,ammo);return g;}
 relabelWeaponDrop(g,weapon,ammo=WEAPONS[weapon].ammo){const c=g.userData.weaponCanvas;if(!c)return;const w=WEAPONS[weapon],ctx=c.getContext('2d');ctx.fillStyle='#17252a';ctx.fillRect(0,0,512,160);ctx.fillStyle='#'+w.color.toString(16).padStart(6,'0');ctx.fillRect(0,0,512,8);ctx.textAlign='center';ctx.font='bold 37px Arial';ctx.fillText(w.name,256,72);ctx.font='23px Arial';ctx.fillText(weapon==='rpg'?ammo+' ROCKET'+(ammo===1?'':'S')+' · LETHAL DIRECT HIT':ammo+' SHOTS · WALK OVER TO EQUIP',256,120);g.userData.weaponTexture.needsUpdate=true;}
 chunkInstances(){
  // Bound each wall/foliage batch to a small area, allowing the renderer to cull unseen streets.
  const sources=this.root.children.filter(o=>o.isInstancedMesh&&o.count>32&&!o.userData.treeCards),matrix=new T.Matrix4(),color=new T.Color();
  for(const source of sources){const cells=new Map();for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);if(matrix.elements[0]===0&&matrix.elements[5]===0)continue;const key=Math.floor(matrix.elements[12]/16)+','+Math.floor(matrix.elements[14]/16);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);}
   for(const ids of cells.values()){const batch=new T.InstancedMesh(source.geometry,source.material,ids.length);batch.userData.foliage=source.userData.foliage;batch.castShadow=source.castShadow;batch.receiveShadow=source.receiveShadow;batch.userData.ownGeometry=source.userData.ownGeometry;ids.forEach((id,i)=>{source.getMatrixAt(id,matrix);batch.setMatrixAt(i,matrix);if(source.instanceColor){source.getColorAt(id,color);batch.setColorAt(i,color);}});batch.computeBoundingSphere();this.root.add(batch);}this.root.remove(source);source.dispose();
  }
 }
 batchStatic(){
  this.root.updateMatrixWorld(true);const groups=new Map();this.root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.material.isShaderMaterial)return;for(let a=o;a;a=a.parent)if(a.userData.dynamic)return;const key=o.geometry.uuid+':'+o.material.uuid+':'+o.castShadow+':'+o.receiveShadow+':'+Math.floor(o.matrixWorld.elements[12]/16)+':'+Math.floor(o.matrixWorld.elements[14]/16);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);});
  for(const meshes of groups.values()){if(meshes.length<2)continue;const first=meshes[0],batch=new T.InstancedMesh(first.geometry,first.material,meshes.length);batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.userData.ownGeometry=meshes.some(m=>m.userData.ownGeometry);meshes.forEach((m,i)=>{batch.setMatrixAt(i,m.matrixWorld);m.parent.remove(m);});this.root.add(batch);}
 }
 // Rooftops for the deep skyline: silhouette and colour only. Sixty metres out and through fog the
 // window detail of a full building cannot be seen, so one of these costs four meshes instead of
 // thirty and batches with its neighbours.
 distantBlock(x,z,width,height,depth,yaw,r,night,flat=false){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=yaw;this.root.add(g);
  const palette=[0xb9a289,0xc8b393,0xa88e78,0xb0a892,0xc4ab8d],facade=this.mat(palette[Math.floor(r()*palette.length)],'brick',{roughness:.92});
  this.mesh('rounded',facade,g,0,height/2,0,width,height,depth);
  // One hipped pyramid rather than two pitched slabs: no gable is needed to close the ends, so the
  // roof cannot read as two planes floating over a box the way an open gable does at this range.
  const roofMat=this.mat(night?0x2b3742:0x3a4a55,'wood',{roughness:.85});
  // A warehouse has a shallow deck, not a pitched roof, so a freight yard's horizon reads as
  // industrial rather than as a row of houses that happen to be low.
  if(flat){this.mesh('rounded',roofMat,g,0,height+.22,0,width+.5,.44,depth+.5);this.mesh('rounded',roofMat,g,0,height+.7,-depth*.3,width*.6,.5,.9);}
  else{this.mesh(this.geo.hipRoof,roofMat,g,0,height+width*.145,0,width*1.02,width*.29,depth*1.02);
   this.mesh('rounded',facade,g,width*.20,height+width*.24,0,.5,1.3,.5);}
  if(night)this.mesh('rounded',this.mat(0xf6c677,null,{emissive:0xffb35e,emissiveIntensity:.5,roughness:.4}),g,0,height*.55,depth/2+.04,width*.62,.9,.06);
  g.userData.backdrop=true;return g;
 }
 // An indoor map needs a building around it, not a horizon: four tall walls, a roof deck and the
 // strip lights that make the space read as lit from above rather than by an invisible sun.
 shedShell(map,half){
  const root=this.root,steel=this.mat(0x7b838c,null,{metalness:.35,roughness:.62}),panel=this.mat(0xc6ccd1,'stone',{roughness:.82}),deck=this.mat(0x9aa2aa,null,{roughness:.85});
  const reach=half+2.2,top=7.4;
  for(const side of[-1,1]){
   this.mesh('box',panel,root,side*reach,top/2,0,.5,top,reach*2+1,);
   this.mesh('box',panel,root,0,top/2,side*reach,reach*2+1,top,.5);
   for(let i=-2;i<=2;i++){this.mesh('box',steel,root,side*(reach-.35),top*.55,i*reach*.38,.2,top*.9,.34);this.mesh('box',steel,root,i*reach*.38,top*.55,side*(reach-.35),.34,top*.9,.2);}
  }
  const roof=this.mesh('box',deck,root,0,top+.3,0,reach*2+1,.6,reach*2+1);roof.receiveShadow=false;roof.castShadow=false;
  const truss=this.mat(0x59616a,null,{metalness:.45,roughness:.5});
  for(let i=-3;i<=3;i++){this.mesh('box',truss,root,0,top-.25,i*reach*.28,reach*2,.22,.22);
   const lamp=this.mesh('box',this.mat(0xfff0cf,null,{emissive:0xffe6b0,emissiveIntensity:1.5,roughness:.4}),root,0,top-.5,i*reach*.28,reach*1.7,.10,.34);lamp.castShadow=false;}
  // Lamps down every bay, not one bulb in the middle: an indoor map has no sun, so the light has
  // to come from the fittings that are visibly there.
  for(const [lx,lz]of[[0,0],[-half*.55,-half*.55],[half*.55,-half*.55],[-half*.55,half*.55],[half*.55,half*.55]]){
   const glow=new T.PointLight(0xffeccd,indoorGlow(half),half*2.6,1.5);glow.position.set(lx,top-1.3,lz);root.add(glow);}
  root.add(new T.AmbientLight(0xdfe6ec,.42));
 }
 leaves(){const key='oak-leaf-clusters';if(!this.materials.has(key))this.materials.set(key,leafMaterial(this.textures.foliage??null,this.leafClock));return this.materials.get(key);}
 tree(x,z,parent,r){return addTree(this,x,z,parent,r);}
 // The boundary avenue is a distinct call so decorative planting (orchard rows) stays separable.
 avenueTree(x,z,parent,r){return this.tree(x,z,parent,r);}
 bin(x,z,y){const g=new T.Group();g.position.set(x,y,z);this.root.add(g);this.mesh('rounded',this.mat(0x284b48),g,0,.48,0,.66,.86,.65);this.mesh('rounded',this.mat(0x233c3b),g,0,.95,0,.74,.12,.74);this.mesh('box',this.mat(0xb7c5a8),g,0,.58,.333,.25,.25,.012);for(const a of[-.25,.25]){const m=this.mesh('cylinder',this.mat(0x202629),g,a,.14,-.25,.11,.08,.11);m.rotation.z=Math.PI/2;}return g;}
 crate(x,z,y,s=1){const g=new T.Group();g.position.set(x,y,z);this.root.add(g);this.mesh('rounded',this.mat(0xae864e,'wood'),g,0,s*.5,0,s,s,s);for(let i of[-1,1])for(let j of[-1,1])this.mesh('box',this.mat(0xd8b576,'wood'),g,i*s*.38,s*.5,j*s*.51,.08,s,.035);return g;}
 lamp(x,z,y,night){const g=new T.Group();g.position.set(x,y,z);this.root.add(g);this.mesh('cylinder',this.mat(0x26363c,null,{metalness:.5}),g,0,1.8,0,.065,3.6,.065);this.mesh('box',this.mat(0xffe3a1,null,{emissive:0xffd38b,emissiveIntensity:night?1.2:.25}),g,0,3.65,0,.3,.45,.3);this.mesh('cone',this.mat(0x26363c),g,0,3.98,0,.34,.25,.34);}
 stall(x,z,y,i){const g=new T.Group();g.position.set(x,y,z);this.root.add(g);for(const a of[-1,1])for(const b of[-.6,.6])this.mesh('box',this.mat(0xa37b48,'wood'),g,a,1.1,b,.09,2.2,.09);for(let k=0;k<8;k++)this.mesh('box',this.mat(k%2?0xf5e3b3:(i%3?0xba4644:0x3e8980)),g,-1+k*.29,2.2,0,.29,.09,1.6);this.mesh('box',this.mat(0xc6a46b,'wood'),g,0,.82,0,2.2,.18,1.2);for(let k=0;k<5;k++)this.mesh('sphere',this.mat(0xb8894d,'skin'),g,-.75+k*.35,.99,.1,.16,.14,.2);}
 bike(x,z,y){const g=new T.Group();g.position.set(x,y,z);this.root.add(g);for(const a of[-.6,.6]){const wheel=this.mesh(new T.TorusGeometry(.38,.035,6,20),this.mat(0x273a3e),g,a,.4,0);wheel.userData.ownGeometry=true;}
 for(const [a,b,c]of[[0,.5,.9],[-.25,.52,-.9],[.3,.67,-.65]]){const rod=this.mesh('cylinder',this.mat(0xc76648,null,{metalness:.4}),g,a,b,0,.035,.9,.035);rod.rotation.z=c;}this.mesh('box',this.mat(0x3b3430),g,-.2,.95,0,.32,.08,.15);}
 marker(x,z,color,type){const g=new T.Group();g.position.set(x,.03,z);this.root.add(g);let radius=type==='zone'?3:1.2;const ring=this.mesh(new T.TorusGeometry(radius,.08,8,48),this.mat(color,null,{emissive:color,emissiveIntensity:.8}),g,0,.04,0);ring.rotation.x=Math.PI/2;ring.userData.ownGeometry=true;this.mesh('cylinder',this.mat(color,null,{transparent:true,opacity:.1,depthWrite:false}),g,0,1.2,0,radius,2.4,radius);
 if(type==='exit'){for(const s of[-1,1])this.mesh('box',this.mat(color,null,{emissive:color,emissiveIntensity:.4}),g,s*1.2,1.5,0,.13,3,.13);this.mesh('box',this.mat(color),g,0,3,0,2.5,.16,.16);}return g;}
 powerup(x,z,kind){
  const boost=POWERUPS[kind],g=new T.Group();g.position.set(x,0,z);this.root.add(g);
  const ring=this.mesh(new T.TorusGeometry(.53,.045,8,36),this.mat(boost.color,null,{emissive:boost.color,emissiveIntensity:.9}),g,0,.18,0);ring.rotation.x=Math.PI/2;ring.userData.ownGeometry=true;
  const body=this.mesh('potato',this.mat(boost.color,'skin',{emissive:boost.color,emissiveIntensity:.15,roughness:.35}),g,0,.95,0,.29,.4,.28);
  const icon=kind==='run'?'»':kind==='fire'?'×2':'↑';
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#101920';ctx.fillRect(0,0,256,128);ctx.fillStyle='#'+boost.color.toString(16);ctx.textAlign='center';ctx.font='bold 64px Arial';ctx.fillText(icon,128,68);ctx.font='bold 21px Arial';ctx.fillText(boost.caption,128,104);
  const texture=new T.CanvasTexture(canvas),material=new T.SpriteMaterial({map:texture,depthTest:true,transparent:true,toneMapped:false});const sprite=new T.Sprite(material);sprite.position.y=1.95;sprite.scale.set(1.85,.925,1);g.add(sprite);sprite.userData.ownMaterial=true;sprite.userData.ownTexture=texture;
  return g;
 }
 // A spiral of stacked crates up a crane tower. Each pillar is banded so its top edge reads from
 // below, the catching ledges are a different colour, and the top one carries the finish marker.
 climbTower(map){
  const root=this.root,crate=this.mat(0xb07b42,'wood',{roughness:.85}),ledge=this.mat(0x3f7f8c,null,{roughness:.6}),beamMat=this.mat(0x8a6a3c,'wood',{roughness:.8}),moverMat=this.mat(0xd2892f,null,{roughness:.5,emissive:0x7a4409,emissiveIntensity:.35}),edge=this.mat(0xffd36b,null,{roughness:.5}),steelMat=this.mat(0x5d666d,null,{metalness:.55,roughness:.42});
  // A moving platform's meshes hang off a group that batchStatic leaves alone, so the whole piece
  // can be driven from the one collider the physics uses rather than drawn a second time.
  this.movers=[];
  for(const [index,c]of map.course.entries()){
   const solid=map.platforms[index],w=solid.w,d=solid.d;
   let parent=root,ox=c.x,oy=c.h,oz=c.z;
   if(c.mover){const group=new T.Group();group.userData.dynamic=true;root.add(group);this.movers.push({group,platform:solid});parent=group;ox=oy=oz=0;}
   const body=this.mesh('rounded',c.mover?moverMat:c.beam?beamMat:c.wide?ledge:crate,parent,ox,oy-.225,oz,w,.45,d);body.receiveShadow=true;
   this.mesh('rounded',edge,parent,ox,oy+.02,oz,w+.06,.06,d+.06);
   for(const side of[-1,1]){this.mesh('rounded',steelMat,parent,ox+side*(w/2-.12),oy-.46,oz,.14,.5,d*.8);this.mesh('rounded',steelMat,parent,ox,oy-.46,oz+side*(d/2-.12),w*.8,.5,.14);}
   if(!c.mover){const label=this.marker(c.x,c.z,c.index===map.course.length-1?0x79edba:c.wide?0x7fd8e8:0xffd36b,'checkpoint');label.position.y=c.h+.05;}
  }
  // The crane that the tower hangs off, so the climb reads as a place rather than floating boxes.
  const top=map.course.at(-1).h;
  for(const side of[-1,1])this.mesh('rounded',steelMat,root,side*9.5,top*.6,-9.5,.6,top*1.2,.6);
  this.mesh('rounded',steelMat,root,0,top+2.4,-9.5,20.4,.7,.8);
  this.mesh('rounded',steelMat,root,0,top+2.0,0,.5,.5,19.4);
  this.mesh('rounded',steelMat,root,9,top+2.0,6.2,19,.5,.5);
 }
 assaultCourse(map){
  for(const h of map.platforms.filter(p=>p.duckRoof||p.duckPost)){this.mesh('rounded',this.mat(h.duckRoof?0xdc8c3c:0x39474d,h.duckRoof?'wood':null),this.root,h.x,(h.base??0)+h.h/2,h.z,h.w,h.h,h.d);if(h.duckRoof)for(const side of[-1,1])for(let i=0;i<6;i++)this.mesh('box',this.mat(i%2?0x26383e:0xf9d979),this.root,h.x+side*(h.w/2+.01),h.base+h.h/2,h.z+(i-2.5)*.51,.025,.21,.32);}

  for(const h of map.platforms.filter(p=>p.hurdle)){this.mesh('rounded',this.mat(0xeec461,'wood'),this.root,h.x,h.h-.08,h.z,h.w,.16,h.d);for(const sign of[-1,1])this.mesh('rounded',this.mat(0x414c52),this.root,h.x,h.h/2,h.z+sign*(h.d/2-.12),.12,h.h,.12);}
  for(const c of map.course){
   if(c.h>0){this.mesh('rounded',this.mat(0x776347,'wood'),this.root,c.x,c.h/2,c.z,2.4,c.h,2.4);this.mesh('rounded',this.mat(0xe2b249,null,{roughness:.55}),this.root,c.x,c.h+.025,c.z,2.43,.055,2.43);for(const sign of[-1,1])this.mesh('box',this.mat(0x252f32),this.root,c.x+sign*.92,c.h+.06,c.z,.14,.02,2.0);}
   const marker=this.marker(c.x,c.z,c.h>0?0xffd36b:0x75dcbb,'checkpoint');marker.position.y=c.h+.03;
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#14272f';ctx.fillRect(0,0,128,128);ctx.fillStyle='#ffdf8b';ctx.font=c.duck?'bold 29px Arial':'bold 82px Arial';ctx.textAlign='center';ctx.fillText(c.duck?'DUCK':String(c.index+1),64,c.duck?65:96);if(c.duck){ctx.font='bold 25px Arial';ctx.fillText(String(c.index+1)+' →',64,106);}const texture=new T.CanvasTexture(canvas),mat=new T.SpriteMaterial({map:texture,depthTest:true,toneMapped:false});const number=new T.Sprite(mat);number.position.set(c.x,c.h+2.1,c.z);number.scale.set(.9,.9,1);number.userData.ownMaterial=true;number.userData.ownTexture=texture;this.root.add(number);
   if(c.index>0){const prev=map.course[c.index-1],dx=c.x-prev.x,dz=c.z-prev.z,length=Math.hypot(dx,dz);const path=this.mesh('box',this.mat(0xe5c270,null,{roughness:1}),this.root,(c.x+prev.x)/2,.012,(c.z+prev.z)/2,.16,.016,length);path.rotation.y=Math.atan2(dx,dz);path.castShadow=false;}
  }
 }
 // A klomp on the cover is varnished yellow wood that has been walked through a market in: the
 // colour is broken by mud flecks and the grain shows through the paint. A flat colour reads as
 // plastic next to a photoreal potato, so the yellow carries its own weathering.
 clogTexture(){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),r=rng(4711);
  ctx.fillStyle='#ffc93a';ctx.fillRect(0,0,256,256);
  // Grain running the length of the shoe, then a warmer wash where the varnish has pooled.
  for(let i=0;i<260;i++){ctx.globalAlpha=.05+r()*.09;ctx.fillStyle=r()>.45?'#d79a1c':'#ffe08a';ctx.fillRect(r()*256,r()*256,r()*90+20,r()*2+.6);}
  for(let i=0;i<40;i++){ctx.globalAlpha=.05+r()*.06;ctx.fillStyle='#b97d17';ctx.beginPath();ctx.ellipse(r()*256,r()*256,r()*40+12,r()*16+5,r()*3,0,7);ctx.fill();}
  // Mud. Heavier towards the sole, which is the half of the shoe that meets the street.
  for(let i=0;i<2600;i++){const y=r();ctx.globalAlpha=(.10+r()*.50)*(y*y);ctx.fillStyle=r()>.35?'#4a3418':'#6d5227';ctx.beginPath();ctx.ellipse(r()*256,y*256,r()*2.0+.25,r()*1.5+.25,r()*3,0,7);ctx.fill();}
  ctx.globalAlpha=1;const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
 clogMaterial(){const key='painted-yellow-klompens';if(!this.materials.has(key)){this.textures.clog??=this.clogTexture();const m=new T.MeshPhysicalMaterial({color:0xffc522,map:this.textures.clog,roughness:.30,clearcoat:.62,clearcoatRoughness:.19,emissive:0x4f3100,emissiveIntensity:.10});if(this.pbr?.oak){m.normalMap=this.pbr.oak[1];m.normalScale.set(.11,.11);m.roughnessMap=this.pbr.oak[2];}this.materials.set(key,m);}return this.materials.get(key);}
 // Every piece is cut from the skull band at its own height, so nothing has to be re-guessed for
 // the rounder or narrower bodies. Headgear belongs above the eyes and is the only kit the sight
 // audit measures as such; eyewear and neckwear sit on the face and the shoulders and go in their
 // own group so that rule still means something.
 headwear(kind,hat,skull,colour){
  if(kind==='cap'){
   // A flat cap: crown, a peak over the brow and a button on top.
   const wool=this.mat(colour,'wood',{roughness:.95,sheen:.6,sheenRoughness:.75,sheenColor:0xffffff}),at=1.775,fit=skull(at);
   this.mesh(this.geo.sphere,wool,hat,0,at,-.01,fit.x*1.16,.20,fit.z*1.16);
   const peak=this.mesh(this.geo.sphere,wool,hat,0,at-.04,fit.z*1.05,fit.x*.82,.035,fit.z*.70);peak.rotation.x=-.14;
   this.mesh(this.geo.smallSphere,wool,hat,0,at+.19,-.01,.065,.05,.065);
  }else if(kind==='headscarf'){
   // A knotted headscarf, with the knot and both tails hanging off the back of the head.
   const cloth=this.mat(colour,'wood',{roughness:.9,sheen:.5,sheenRoughness:.7,sheenColor:0xffffff}),at=1.74,fit=skull(at);
   this.mesh(this.geo.sphere,cloth,hat,0,at,-.01,fit.x*1.14,.18,fit.z*1.14);
   this.mesh(this.geo.smallSphere,cloth,hat,fit.x*.55,at-.05,-fit.z*1.05,.10,.09,.10);
   for(const side of[-1,1]){const tail=this.mesh(this.geo.sphere,cloth,hat,fit.x*.55+side*.05,at-.19,-fit.z*1.18,.05,.14,.045);tail.rotation.x=.38;tail.rotation.z=side*.28;}
  }else if(kind==='goggles'){
   // Welding goggles pushed up onto the forehead, with the strap running round the back.
   const strap=this.mat(colour,'wood',{roughness:.92}),brass=this.mat(0xc39a45,null,{metalness:.7,roughness:.32}),glass=this.mat(0x6fa9b8,null,{metalness:.5,roughness:.16});
   const at=1.695,fit=skull(at);
   this.mesh(this.geo.sphere,strap,hat,0,at,-.01,fit.x*1.13,.065,fit.z*1.13);
   for(const side of[-1,1]){this.mesh('cylinder',brass,hat,side*fit.x*.52,at+.02,fit.z*.86,.105,.09,.105).rotation.x=Math.PI/2;
    this.mesh('cylinder',glass,hat,side*fit.x*.52,at+.02,fit.z*.86+.05,.074,.02,.074).rotation.x=Math.PI/2;}
   this.mesh('rounded',brass,hat,0,at+.02,fit.z*.86,fit.x*.5,.03,.045);
  }else if(kind==='bucket'){
   // A soft crown with an all-round brim that turns down towards the back.
   const cloth=this.mat(colour,'wood',{roughness:.93,sheen:.55,sheenRoughness:.75,sheenColor:0xffffff}),at=1.80,fit=skull(at),brim=skull(1.70);
   this.mesh(this.geo.sphere,cloth,hat,0,at-.03,-.01,fit.x*1.12,.19,fit.z*1.12);
   const ring=this.mesh('cylinder',cloth,hat,0,1.685,-.01,brim.x*1.62,.028,brim.z*1.62);ring.rotation.x=-.07;
  }else if(kind==='beanie'){
   // A knitted dome, a rolled band at the brow and a bobble on top.
   const wool=this.mat(colour,'wood',{roughness:.98,sheen:.75,sheenRoughness:.85,sheenColor:0xfff4e4}),at=1.79,fit=skull(at),band=skull(1.68);
   this.mesh(this.geo.sphere,wool,hat,0,at-.05,-.01,fit.x*1.13,.24,fit.z*1.13);
   this.mesh('cylinder',wool,hat,0,1.675,-.01,band.x*1.19,.075,band.z*1.19);
   this.mesh(this.geo.smallSphere,wool,hat,0,at+.20,-.01,.095,.09,.095);
  }else if(kind==='tophat'){
   // Absurd on a potato, which is the point. Straight sides, flat brim, ribbon at the base.
   const felt=this.mat(colour,'wood',{roughness:.62,sheen:.45,sheenRoughness:.5,sheenColor:0xffffff}),ribbon=this.mat(0x1d1a17,null,{roughness:.5}),fit=skull(1.76);
   this.mesh('cylinder',felt,hat,0,2.05,-.01,fit.x*.86,.20,fit.z*.96);
   this.mesh('cylinder',ribbon,hat,0,1.875,-.01,fit.x*.88,.035,fit.z*.98);
   this.mesh('cylinder',felt,hat,0,1.845,-.01,fit.x*1.42,.022,fit.z*1.52);
  }
 }
 eyewear(kind,group,skull,colour){
  if(kind==='none')return;
  const at=1.40,fit=skull(at),lens=fit.z*1.02;
  const dark=this.mat(0x1d1a18,null,{physical:true,roughness:.30,clearcoat:.7,clearcoatRoughness:.15});
  const frame=this.mat(colour,null,{metalness:.55,roughness:.28});
  const glass=this.mat(0xd8ecf4,null,{physical:true,metalness:.08,roughness:.05,opacity:.42,transparent:true,clearcoat:1,clearcoatRoughness:.04});
  const own=mesh=>{mesh.userData.ownGeometry=true;return mesh;};
  if(kind==='glasses'){
   // Round wire frames: a drawn rim rather than a disc, a bridge over the nose and temples that
   // run back to the side of the head.
   for(const side of[-1,1]){
    own(this.mesh(new T.TorusGeometry(.185,.016,8,24),frame,group,side*.225,at,lens));
    this.mesh(this.geo.sphere,glass,group,side*.225,at,lens-.004,.175,.175,.028);
    const temple=this.mesh('rounded',frame,group,side*fit.x*.92,at+.03,lens*.30,.022,.022,fit.z*.86);temple.rotation.y=side*.12;
   }
   this.mesh('rounded',frame,group,0,at+.025,lens,.095,.016,.022);
   for(const side of[-1,1])this.mesh(this.geo.smallSphere,frame,group,side*.045,at+.055,lens*.98,.016,.016,.016);
  }else if(kind==='shades'){
   // A wraparound: one curved lens shell across both eyes, a brow bar and thick temples.
   const shell=this.mesh(this.geo.sphere,dark,group,0,at-.005,.02,fit.x*1.06,.115,fit.z*1.06);shell.scale.z=fit.z*1.06;
   this.mesh('rounded',frame,group,0,at+.10,lens*.97,fit.x*1.5,.030,.035);
   for(const side of[-1,1]){const temple=this.mesh('rounded',frame,group,side*fit.x*.95,at+.06,lens*.28,.026,.028,fit.z*.88);temple.rotation.y=side*.14;}
  }else if(kind==='minion'){
   // The banana kind: a thick rubber band right round the head, big steel rims with rivets, a
   // domed glass in each and a bar bridging them.
   const rubber=this.mat(0x2b2f33,null,{physical:true,roughness:.58,clearcoat:.25,clearcoatRoughness:.5});
   const steel=this.mat(0xcbd1d8,null,{metalness:.96,roughness:.14});
   this.mesh(this.geo.sphere,rubber,group,0,at,.02,fit.x*1.11,.085,fit.z*1.11);
   for(const side of[-1,1]){
    own(this.mesh(new T.TorusGeometry(.175,.046,10,26),steel,group,side*.235,at,lens*.93));
    this.mesh(this.geo.sphere,glass,group,side*.235,at,lens*1.02,.152,.152,.062);
    for(let j=0;j<6;j++){const a=j*Math.PI/3;this.mesh(this.geo.smallSphere,steel,group,side*.235+Math.cos(a)*.176,at+Math.sin(a)*.176,lens*.99,.023,.023,.023);}
   }
   this.mesh('rounded',steel,group,0,at,lens*.93,.13,.05,.055);
  }else if(kind==='visor'){
   const tinted=this.mat(colour,null,{physical:true,metalness:.65,roughness:.10,opacity:.68,transparent:true,clearcoat:1,clearcoatRoughness:.05});
   const band=this.mesh(this.geo.sphere,tinted,group,0,at+.01,.02,fit.x*1.08,.13,fit.z*1.08);band.scale.z=fit.z*1.08;
   this.mesh(this.geo.sphere,this.mat(0x2c2a27,null,{physical:true,roughness:.55,clearcoat:.3}),group,0,at+.15,.02,fit.x*1.05,.045,fit.z*1.05);
   for(const side of[-1,1])this.mesh('rounded',this.mat(0x9aa2a8,null,{metalness:.8,roughness:.3}),group,side*fit.x*.96,at+.09,lens*.35,.03,.03,fit.z*.5);
  }else if(kind==='patch'){
   const leather=this.mat(0x17130f,null,{physical:true,roughness:.52,clearcoat:.3,clearcoatRoughness:.4});
   this.mesh(this.geo.sphere,leather,group,-.225,at,lens*.99,.205,.205,.048);
   own(this.mesh(new T.TorusGeometry(.20,.012,6,20),leather,group,-.225,at,lens*1.01));
   const strap=this.mesh(this.geo.sphere,leather,group,0,at+.14,.02,fit.x*1.04,.026,fit.z*1.04);strap.rotation.z=.16;
  }
 }
 neckwear(kind,group,skull,colour){
  if(kind==='none')return;
  const at=1.16,fit=skull(at),cloth=this.mat(colour,'wood',{roughness:.95,sheen:.7,sheenRoughness:.8,sheenColor:0xfff6ea});
  if(kind==='scarf'){
   // Wool: three offset wraps with a ribbed edge, and two tails hanging down the front.
   for(let j=0;j<3;j++){const wrap=this.mesh('cylinder',cloth,group,0,at+.055-j*.055,0,fit.x*(1.06+j*.015),.062,fit.z*(1.11+j*.015));wrap.rotation.y=j*.22;}
   for(let j=0;j<9;j++){const a=j*Math.PI*2/9;this.mesh(this.geo.smallSphere,cloth,group,Math.sin(a)*fit.x*1.08,at+.085,Math.cos(a)*fit.z*1.13,.035,.024,.035);}
   for(const side of[-1,1]){const tail=this.mesh('rounded',cloth,group,side*.13,at-.28,fit.z*1.02,.13,.44,.055);tail.rotation.z=side*.12;
    for(let j=0;j<3;j++)this.mesh(this.geo.smallSphere,cloth,group,side*.13,at-.46+j*.03,fit.z*1.05,.055,.022,.035);}
  }else if(kind==='bandana'){
   this.mesh('cylinder',cloth,group,0,at+.02,0,fit.x*1.06,.055,fit.z*1.11);
   const front=this.mesh(this.geo.sphere,cloth,group,0,at-.17,fit.z*1.02,.30,.22,.05);front.rotation.x=.12;
  }else if(kind==='tie'){
   this.mesh('rounded',cloth,group,0,at+.02,fit.z*1.04,.085,.075,.045);
   this.mesh('rounded',cloth,group,0,at-.30,fit.z*1.00,.11,.52,.035);
  }
 }
 character(id,worn){
  const g=new T.Group();this.root.add(g);
  if(!this.contactTexture){const pixels=new Uint8Array(64*64*4);for(let z=0;z<64;z++)for(let x=0;x<64;x++){const i=(z*64+x)*4,d=Math.hypot((x-31.5)/31.5,(z-31.5)/31.5);pixels[i+3]=Math.max(0,1-d)**2*150;}this.contactTexture=new T.DataTexture(pixels,64,64);this.contactTexture.needsUpdate=true;}
  const shadow=new T.Mesh(new T.PlaneGeometry(2.7,2.7),new T.MeshBasicMaterial({map:this.contactTexture,transparent:true,depthWrite:false,opacity:.65}));shadow.rotation.x=-Math.PI/2;shadow.userData.ownGeometry=shadow.userData.ownMaterial=true;this.root.add(shadow);
  // Alternate light baked and golden russet skins consistently on every client.
  // Limbs wear the same russet skin a few shades lighter than the torso, so arms and legs
  // match each other and still read as potato rather than pale plastic.
  // Four rivals that are the same potato in two skin tones are hard to read in a fight. Each one
  // now has its own variety: a skin, a build, the paint on its klompen and something on its head.
  // The yellow klompen itself never changes — it is the one thing every Potatoman has in common.
  const breed=BREEDS[id%BREEDS.length],kit=validateOutfit({...breed.outfit,...worn}),tone=skinColor(kit),lift=t=>Math.round(t+(255-t)*.22),limbColor=lift(tone>>16&255)<<16|lift(tone>>8&255)<<8|lift(tone&255);
  const skin=this.mat(tone,'skin',{roughness:.88,bumpScale:.037,envMapIntensity:.28}),limb=this.mat(limbColor,'skin',{roughness:.86,bumpScale:.032,envMapIntensity:.30}),dark=this.mat(0x352719,null,{roughness:.65}),white=this.mat(0xfff6df,null,{roughness:.25}),wood=this.clogMaterial(),iris=this.mat([0x778146,0x50787e,0x987343,0x6b7190][id],null,{roughness:.32});const bob=new T.Group();g.add(bob);
  const body=this.mesh('potato',skin,bob,0,TORSO.centre,0,TORSO.x*breed.build[0],TORSO.y*breed.build[1],TORSO.z*breed.build[2]);body.rotation.z=-.045;
  const brows=[],eyes=[],cheeks=[],pupils=[],lids=[],browSkin=this.mat(0x6a4523,null,{roughness:.92});
  for(const sign of[-1,1]){const x=sign*.225,eye=new T.Group();eye.position.set(x,1.40,.392);bob.add(eye);
   // A socket rim sunk into the skin gives the eyeball somewhere to sit, so it reads as set into
   // the potato rather than stuck onto the front of it.
   const socket=this.mesh(this.geo.sphere,skin,bob,x,1.395,.368,.206,.196,.068);socket.rotation.x=-.10;
   this.mesh(this.geo.sphere,white,eye,0,0,0,.172,.155,.087);const gaze=new T.Group();eye.add(gaze);
   this.mesh(this.geo.sphere,iris,gaze,0,-.01,.082,.101,.105,.022);this.mesh(this.geo.sphere,dark,gaze,0,-.008,.101,.054,.065,.011);
   // Two catchlights, a bright one and a faint bounce below it, are what make an eye look wet.
   this.mesh(this.geo.sphere,white,gaze,-.030,.034,.112,.024,.025,.008);this.mesh(this.geo.sphere,white,gaze,.030,-.028,.110,.012,.012,.005);
   eyes.push(eye);pupils.push(gaze);
   // The upper lid hinges on the crease at the top of the eyeball and reads as a thin fold when
   // open, rather than hooding half the eye with a permanent brown blob.
   const lidPivot=new T.Group();lidPivot.rotation.x=LID_OPEN;eye.add(lidPivot);
   this.mesh(this.geo.eyelid,skin,lidPivot,0,0,0,.181,.167,.097);lids.push(lidPivot);
   this.mesh(this.geo.sphere,skin,eye,0,-.158,-.006,.150,.030,.050);
   const brow=this.mesh(curveTube([[-.155,-.014,-.018],[-.06,.028,.008],[.05,.038,.014],[.155,.006,-.014]],.028),browSkin,bob,x,1.596,.410);brow.userData.ownGeometry=true;brow.rotation.y=sign*.10;brows.push(brow);
   // A flat skin ridge under the brow, not a ball: it shades the eye without stacking a third lump
   // above it.
   this.mesh(this.geo.sphere,skin,bob,x,1.572,.352,.240,.034,.058);
   cheeks.push(this.mesh(this.geo.sphere,skin,bob,sign*.315,1.070,.280,.200,.062,.062));
  }
  // Nose: a broad bulb over a short bridge, the way a sprout swells out of a potato, with two
  // small skin eyes for nostrils.
  this.mesh(this.geo.sphere,skin,bob,0,1.255,.410,.062,.085,.055);
  this.mesh(this.geo.sphere,skin,bob,0,1.175,.436,.108,.105,.086);
  for(const sign of[-1,1])this.mesh(this.geo.sphere,dark,bob,sign*.045,1.136,.505,.023,.016,.020);
  const smile=new T.Group();smile.position.set(0,.955,.475);bob.add(smile);
  const lip=this.mesh(curveTube([[-.255,.052,-.030],[-.12,-.018,.014],[0,-.042,.022],[.12,-.018,.014],[.255,.052,-.030]],.017),this.mat(0x6d4730,null,{roughness:.82}),smile);lip.userData.ownGeometry=true;
  // A lower lip catches the light under the mouth line, so the smile is a mouth rather than a
  // line drawn on a potato.
  this.mesh(this.geo.sphere,this.mat(0xa9705a,null,{roughness:.72}),smile,0,-.060,.010,.128,.030,.030);
  const mouth=new T.Group();mouth.position.set(0,-.030,.020);smile.add(mouth);const mouthInside=this.mesh(new T.CircleGeometry(.132,32),this.mat(0x3a1f16,null,{roughness:.95}),mouth);mouthInside.userData.ownGeometry=true;
  this.mesh('rounded',this.mat(0xf2e3c6,null,{roughness:.35}),mouth,0,.074,.010,.158,.034,.014);this.mesh(this.geo.sphere,this.mat(0xb67461,null,{roughness:.8}),mouth,0,-.074,.011,.082,.034,.012);mouth.scale.y=.02;mouth.visible=false;

  // Headwear is sized from the skull it sits on rather than hard-coded, so it fits every build:
  // the potato is an ellipsoid squeezed on x and stretched on z, and the band at a given height
  // follows from that. Anything guessed instead ends up buried in the head on the rounder bodies.
  const hat=new T.Group();bob.add(hat);
  const skull=height=>{const ry=TORSO.y*breed.build[1],t=(height-TORSO.centre)/ry,band=Math.sqrt(Math.max(.05,1-t*t));
   return{x:TORSO.x*breed.build[0]*band*.917,z:TORSO.z*breed.build[2]*band*1.035};};
  const kitGroup=new T.Group();bob.add(kitGroup);
  this.headwear(kit.head,hat,skull,tintColor(kit));this.eyewear(kit.eyes,kitGroup,skull,tintColor(kit));this.neckwear(kit.neck,kitGroup,skull,tintColor(kit));
  const arms=[],forearms=[],legs=[];
  for(const sign of[-1,1]){const arm=makeArm(this,g,limb,sign);arms.push(arm);forearms.push(arm.userData.lower);
   const leg=new T.Group();leg.position.x=sign*.38;g.add(leg);const thigh=this.mesh('sphere',limb,leg,0,.69,0,.115,.22,.12),shin=this.mesh('sphere',limb,leg,0,.40,0,.125,.21,.135),knee=this.mesh('sphere',limb,leg,0,.53,.08,.13,.13,.13),foot=new T.Group();leg.add(foot);foot.position.y=.09;foot.rotation.y=sign*.32;foot.scale.set(.49,.70,.49);
   this.mesh('clog',wood,foot,0,0,.04,1.13,1,1.13);
   // The reshaped klomp sits a little taller, so opening and carving ride on one lifted trim group.
   const trim=new T.Group();trim.position.y=.028;foot.add(trim);
   this.mesh('clog',this.mat(0x815c28,'wood'),foot,0,-.02,.04,1.15,.17,1.15);
   // Painted work belongs ON the klomp. It used to be authored as numbers measured against a
   // picture of the shoe, so 52 of the 63 pieces were sitting inside the wood and a klomp the code
   // describes as carrying a tulip spray and beaded borders arrived on screen plain yellow. Every
   // piece is now placed against the shoe's own profile -- `atop` gives the height of the instep at
   // a point along the shoe, `beside` the half-width of the side wall there -- so the pattern
   // survives the next time the toe or the outline is reshaped.
   const paint=this.mat(0xfdf4e2,null,{physical:true,roughness:.42,clearcoat:.5,clearcoatRoughness:.3}),heartPaint=this.mat(0xc22b33,null,{physical:true,roughness:.36,clearcoat:.65,clearcoatRoughness:.2}),brass=this.mat(0xc79a3f,null,{metalness:.8,roughness:.3});
   const {top:clogTop,wall:clogWall}=CLOG_PROFILE,gz=z=>(z-.04)/1.13;
   // `atop` asks the shoe how high it is at a point rather than telling it. The cap is triangulated
   // straight across the outline, so its long triangles carry the toe's upsweep back over the middle
   // of the instep: a formula put the surface at 0.386 where the wood is actually at 0.469, and the
   // painted work went under it.
   const atop=(x,z,lift=.014)=>clogTop(x/1.13,gz(z))-trim.position.y+lift;
   // Wall work drops down the outside of the shoe from the shoulder where the top bevel ends -- a
   // fixed line, not the centre of the instep, which the cap's upsweep carries far above it -- and
   // then asks how far out the wood actually is at that height. Assuming the wall is as wide there
   // as at its fattest point put every bead, nail and painted band inside it.
   const WALL_TOP=.215;
   const onWall=(z,drop,out=.005)=>{const y=WALL_TOP-drop;return{y,x:clogWall(y+trim.position.y,gz(z))*1.13+out};};
   const carving=this.mat(0x2f1c09,null,{physical:true,roughness:.44,clearcoat:.5,clearcoatRoughness:.25}),inlay=this.mat(breed.paint,null,{roughness:.5});
   const carve=(points,r=.007,mat=carving)=>{const piece=this.mesh(curveTube(points,r),mat,trim);piece.userData.ownGeometry=true;return piece;};
   // The one thing every painted klomp has: a bold double outline round the foot opening, carried
   // forward over the instep and closed off at the nose, with the tulip work sitting inside it.
   // The foot opening: a dark recess and the lip of wood around it, both sitting on the instep
   // rather than at a height that has to be retuned whenever the shoe is redrawn.
   this.mesh('sphere',this.mat(0x4a3116),trim,0,atop(0,-.065,.008),-.065,.145,.016,.160);
   const rim=this.mesh(new T.TorusGeometry(.145,.024,10,28),wood,trim,0,atop(0,-.065,.022),-.065);rim.rotation.x=Math.PI/2;rim.scale.y=1.13;rim.userData.ownGeometry=true;
   const collar=(across,fore,width)=>carve(Array.from({length:33},(_,j)=>{const a=j*Math.PI*2/32,z=-.065+Math.cos(a)*fore,x=Math.sin(a)*across;return[x,atop(x,z),z];}),width);
   collar(.170,.205,.0125);collar(.212,.252,.0078);
   // Sampled along its length rather than drawn between four corners: the instep sweeps up towards
   // the nose, and a spline through widely spaced points cuts underneath a curve that steep.
   for(const side of[-1,1])carve(Array.from({length:9},(_,j)=>{const t=j/8,z=.16+t*.50,x=side*(.150-t*.100);return[x,atop(x,z),z];}),.0125);
   carve(Array.from({length:9},(_,j)=>{const a=(j/8-.5)*Math.PI,z=.66+Math.cos(a)*.06,x=Math.sin(a)*.050;return[x,atop(x,z),z];}),.0125);
   // Tulip spray on the instep: bloom, stem, paired leaves and a seed bead, the whole of it inside
   // the outline above.
   carve([[-.052,atop(-.052,.50),.50],[-.040,atop(-.040,.565),.565],[0,atop(0,.545),.545],[.040,atop(.040,.565),.565],[.052,atop(.052,.50),.50],[0,atop(0,.475),.475],[-.052,atop(-.052,.50),.50]],.011,inlay);
   carve([[0,atop(0,.465),.465],[0,atop(0,.40),.40],[0,atop(0,.33),.33]],.0060);
   for(const side of[-1,1])carve([[0,atop(0,.39),.39],[side*.058,atop(side*.058,.415),.415],[side*.082,atop(side*.082,.46),.46]],.0052);
   this.mesh(this.geo.smallSphere,inlay,trim,0,atop(0,.565,.030),.565,.026,.018,.026);
   // There were chevrons across the heel here. They were inside the heel block rather than on the
   // back of it -- painted work on an end face needs placing against that face, which nothing here
   // measures -- and the heel is the one part of a klomp the shoulder camera never sees, so they
   // cost three meshes a foot to draw nothing.
   for(const side of[-1,1]){
    // Beaded border along the top of each side wall, and a scrolled volute curling back from the
    // nose. Both are laid on the wall itself, a hair proud of it.
    for(let j=0;j<7;j++){const t=j/6,z=-.10+t*.72,w=onWall(z,.052);this.mesh(this.geo.smallSphere,carving,trim,side*w.x,w.y,z,.019,.019,.019);}
    carve([[.60,.060],[.50,.030],[.42,.012],[.47,.026]].map(([z,drop])=>{const w=onWall(z,drop);return[side*w.x,w.y,z];}),.0062);
    // Painted work on the side walls, where a klomp actually carries it: a white band under the
    // beading, a red heart on the outer wall and brass nail heads along the sole seam.
    carve(Array.from({length:6},(_,j)=>{const z=-.20+j/5*.88,w=onWall(z,.105);return[side*w.x,w.y,z];}),.0125,paint);
    // A red heart, traced as an outline on the wall rather than stacked out of beads, which read
    // as three red balls at any distance at which the heart was supposed to be recognisable.
    carve(Array.from({length:25},(_,j)=>{const t=j/24*Math.PI*2,hx=Math.sin(t)**3,hy=(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/16,z=.21+hx*.072;
     const w=onWall(z,.150);return[side*w.x,onWall(.21,.150).y+hy*.062,z];}),.0072,heartPaint);
    for(let j=0;j<4;j++){const z=-.14+j*.30,w=onWall(z,.195);this.mesh(this.geo.smallSphere,brass,trim,side*w.x,w.y,z,.016,.013,.016);}
   }
   leg.userData={thigh,shin,knee,foot};legs.push(leg);
  }
  const capeGeo=new T.PlaneGeometry(1.36,1.30,20,22),cp=capeGeo.attributes.position;for(let i=0;i<cp.count;i++){const y=cp.getY(i),t=(.65-y)/1.3;cp.setX(i,cp.getX(i)*(.47+t*.60));cp.setZ(i,Math.sin(cp.getX(i)*16)*.022*t);}capeGeo.computeVertexNormals();
  const cape=new T.Mesh(capeGeo,this.mat(id===0?0xaa252c:colors[id],null,{side:T.DoubleSide,roughness:.72,sheen:.85,sheenRoughness:.55,sheenColor:0xffe9d6}));cape.position.set(0,1.00,-.38);cape.rotation.x=.22;cape.castShadow=true;cape.receiveShadow=true;cape.userData.ownGeometry=true;bob.add(cape);const capeBase=capeGeo.attributes.position.array.slice();
  const clasp=this.mesh('sphere',this.mat(0xf0c865,null,{metalness:.75,roughness:.28}),bob,0,1.65,.28,.09,.055,.045);
  const badge=this.mesh(new T.TorusGeometry(.65,.018,8,48),this.mat(colors[id],null,{emissive:colors[id],emissiveIntensity:.35}),g,0,.035,0);badge.rotation.x=Math.PI/2;badge.userData.ownGeometry=true;
  const gun=makeSpudGun(this,g);
  const heldSpud=this.mesh('potato',skin,g,0,0,0,.17,.19,.17);
  // A crown worth three round wins: a rimmed band, eight tapered points with ball finials, and
  // faceted stones set round it in three colours. Nothing here is post-processed, so the gold is
  // bright metal with a warm emissive floor and the stones glow a little on their own.
  const crown=new T.Group();crown.position.set(0,1.95,0);bob.add(crown);
  const gold=this.mat(0xffd84a,null,{metalness:.96,roughness:.13,emissive:0x6d4d00,emissiveIntensity:.34}),bright=this.mat(0xfff0a6,null,{metalness:.92,roughness:.09,emissive:0x7d5e08,emissiveIntensity:.42});
  const own=mesh=>{mesh.userData.ownGeometry=true;return mesh;};
  own(this.mesh(new T.CylinderGeometry(.375,.35,.17,36,1,true),gold,crown,0,.02,0));
  for(const [y,radius]of[[-.065,.355],[.105,.378]]){const hoop=own(this.mesh(new T.TorusGeometry(radius,.026,10,36),bright,crown,0,y,0));hoop.rotation.x=Math.PI/2;}
  const stones=[this.mat(0xd5203a,null,{metalness:.35,roughness:.06,emissive:0x5c0713,emissiveIntensity:.5}),this.mat(0x1f9d63,null,{metalness:.35,roughness:.06,emissive:0x05341f,emissiveIntensity:.5}),this.mat(0x2f6fd0,null,{metalness:.35,roughness:.06,emissive:0x061f47,emissiveIntensity:.5})];
  for(let j=0;j<8;j++){const a=j*Math.PI*2/8,sin=Math.sin(a),cos=Math.cos(a);
   const point=own(this.mesh(new T.ConeGeometry(.072,.34,6),gold,crown,sin*.335,.27,cos*.335));point.rotation.set(cos*.12,0,-sin*.12);
   own(this.mesh(this.geo.smallSphere,bright,crown,sin*.335,.45,cos*.335,.052,.052,.052));
   const gem=own(this.mesh(new T.OctahedronGeometry(.055,0),stones[j%3],crown,sin*.385,.02,cos*.385));gem.rotation.y=a;gem.scale.set(1,1.25,.55);
   own(this.mesh(new T.TorusGeometry(.052,.013,6,12),bright,crown,sin*.372,.02,cos*.372)).lookAt(sin*2,.02,cos*2);}
  crown.visible=false;
  const label=new PlayerLabel(colors[id]);this.root.add(label.sprite);
  const fadeMaterials=[];g.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=false;o.userData.ownMaterial=true;fadeMaterials.push(o.material);}});
  return{g,shadow,label,badge,fadeMaterials,crouchBlend:0,bob,hat,kit:kitGroup,arms,forearms,legs,cape,capeBase,clasp,crown,heldSpud,gun,eyes,brows,cheeks,pupils,lids,smile,mouth,lip,hurt:0,joy:0,gaze:0,lastHP:null,stride:0,walk:0,lastX:null,lastZ:null,blinkAt:2.5+id*.7};
 }
 updatePlayers(players,time,dt){// Moving platforms are drawn where the collider already is, so what a climber can stand on and
  // what they can see are the same object.
  for(const m of this.movers)m.group.position.set(m.platform.x,m.platform.base+m.platform.h,m.platform.z);
  const {hip,ankle,knee,direction,inverse,up:upAxis,forward}=this.scratch,aimPlayers=this.isBonus?players.filter(q=>q.runner):players;players.forEach((p,i)=>{const m=this.characters[i];m.g.visible=p.respawn<=0;const dx=m.lastX===null?0:p.x-m.lastX,dz=m.lastZ===null?0:p.z-m.lastZ,travelled=Math.hypot(dx,dz);m.lastX=p.x;m.lastZ=p.z;
  const speed=travelled<2?travelled/Math.max(dt,.001):0;const smoothing=1-Math.exp(-10*dt);m.walk+=(Math.min(speed/6,1.35)-m.walk)*smoothing;if(travelled<2)m.stride+=travelled*STRIDE_RATE;else{m.walk=0;m.stride=0;}
  const stride=m.stride,walk=m.walk,dash=p.dashTime>0?Math.sin(Math.min(1,p.dashTime/.16)*Math.PI):0,throwProgress=p.shotAnim>0?1-p.shotAnim/(p.shotDuration??(p.weapon==='throw'?.46:.18)):0,throwSwing=p.shotAnim>0?Math.sin(throwProgress*Math.PI):0;
  m.shadow.position.set(p.x,.02,p.z);m.shadow.visible=p.respawn<=0;m.shadow.material.opacity=.65/(1+(p.y??0));m.shadow.scale.setScalar(1+(p.y??0)*.15);m.g.position.set(p.x,p.y??0,p.z);m.g.rotation.y=Math.PI-p.yaw+BODY_YAW_OFFSET;m.g.scale.setScalar(p.runner?1.18:1);
  // Ground-relative travel, rotated into the quarter-turned torso's frame.
  if(travelled>.00001&&travelled<2){const c=Math.cos(m.g.rotation.y),s=Math.sin(m.g.rotation.y);m.gaitX=(dx*c-dz*s)/travelled;m.gaitZ=(dx*s+dz*c)/travelled;}
  m.crouchBlend+=((p.crouching?1:0)-m.crouchBlend)*(1-Math.exp(-26*dt));const crouch=m.crouchBlend;m.bob.position.y=.15-crouch*.23+Math.abs(Math.sin(stride))*walk*.026+Math.sin(time*2.3+i)*.007;m.label.update(p,Math.abs(Math.sin(stride))*walk*.026);
  const carryMotion=p.weapon==='throw'?1:.35;
  m.bob.rotation.x=crouch*.18+walk*.025+dash*.38+(p.grounded===false?-.13:0);m.bob.rotation.z=Math.sin(stride)*walk*.027;m.bob.rotation.y=Math.sin(stride)*walk*.032*carryMotion;
  m.bob.scale.set(1+dash*.035,1-dash*.045-crouch*.15,1);
  // Lean around the torso, rather than sweeping its shoulders forward from the feet.
  direction.set(0,1.09*m.bob.scale.y,0).applyEuler(m.bob.rotation);m.bob.position.x=-direction.x;m.bob.position.z=-direction.z;m.bob.position.y+=1.09*m.bob.scale.y-direction.y;

  // Airborne legs run their own cycle. Holding both of them in a near-straight hang with a token
  // lift read as dangling: the knees never came up, the feet never reached, and a leap looked like
  // being lifted by the scruff. Where the player is in the jump comes from the live vertical speed
  // rather than from the walk stride, which has stopped by then. Climbing, the lead knee tucks up
  // and forward while the trailing leg sweeps back -- a stride held in the air. Falling, both legs
  // straighten and reach down past where they stand, which is what sells the landing and is also
  // the moment the legs are longest and most visible.
  m.legs.forEach((leg,j)=>{const phase=stride+j*Math.PI,air=p.grounded===false,lead=j===0?1:-1;
   const rise=air?Math.max(-1,Math.min(1,(p.vy??0)/JUMP_SPEED)):0,tuck=Math.max(0,rise),fall=Math.max(0,-rise);
   const up=air?AIR_TUCK*tuck*(lead>0?1:.45)-AIR_REACH*fall:Math.max(0,Math.sin(phase))*.135*walk;
   const step=air?lead*AIR_SPLIT+lead*(tuck*.16+fall*.10):footReach(phase,walk),x=step*(m.gaitX??0),z=step*(m.gaitZ??1);
   hip.set(0,.78-crouch*.19,0);ankle.set(x,.315+up,z);knee.set(x*.5,(hip.y+ankle.y)*.5,(hip.z+ankle.z)*.5+.11+crouch*.21+(lead>0?tuck*.22:0));const {thigh,shin,foot}=leg.userData;leg.userData.knee.position.copy(knee);
   for(let segment=0;segment<2;segment++){const mesh=segment?shin:thigh,a=segment?knee:hip,b=segment?ankle:knee,width=segment?.125:.135;mesh.position.copy(a).add(b).multiplyScalar(.5);direction.copy(b).sub(a);const length=direction.length();mesh.quaternion.setFromUnitVectors(upAxis,direction.normalize());mesh.scale.set(width,length*.58,width*1.06);}
   foot.position.set(x,.09+up,z);foot.rotation.x=air?-.52*tuck+.34*fall:Math.max(0,Math.sin(phase))*.05*walk;});
  m.gun.visible=p.weapon!=='throw'&&!p.runner&&(!isTrial(this.level)||this.isBonus);
  // Each weapon gets its own bulk, length and attachment, so what a rival is carrying is readable
  // across the arena. Length scales the whole launcher, which keeps the muzzle on the gun's origin.
  const shape=GUN_SHAPES[p.weapon]??GUN_SHAPES.spud;m.gun.scale.set(shape.bulk,shape.bulk,shape.length);
  for(const [name,group]of Object.entries(m.gun.userData.kit??{}))group.visible=shape.kit===name;
  if(m.gun.visible){const {velocity}=weaponAim(p,aimPlayers,this.solids,this.level.mode==='smash'&&!this.isBonus?(this.aimTargets??[]):[],p.shotAnim>0?p.visualShotSpeed:undefined),scale=p.runner?1.18:1;inverse.copy(m.g.quaternion).invert();direction.set(velocity.vx,velocity.vy,velocity.vz).normalize().applyQuaternion(inverse);m.gun.position.set(velocity.x-p.x,velocity.y-(p.y??0),velocity.z-p.z).applyQuaternion(inverse).divideScalar(scale);m.gun.quaternion.setFromUnitVectors(forward,direction);m.gun.scale.z*=1-throwSwing*.025;}

  poseArms(m,p,stride,walk,crouch,!isTrial(this.level)||this.isBonus);
  m.cape.visible=m.clasp.visible=!!p.runner;m.crown.visible=(p.roundWins??0)>=3;
  const blink=Math.max(0,1-Math.abs((time+i*.73)%4.1-3.9)/.095);if(m.lastHP!==null&&p.hp<m.lastHP&&p.respawn<=0)m.hurt=1;m.lastHP=p.hp;m.hurt=Math.max(0,m.hurt-dt*3.5);m.joy+=((p.catchTime>0?1:p.runner?.35:0)-m.joy)*(1-Math.exp(-8*dt));
  const throwing=p.weapon==='throw'&&!p.runner&&p.shotAnim>0,throwClock=throwing?Math.max(0,(p.shotDuration??.46)-p.shotAnim):0,effort=throwing?Math.sin(Math.PI*Math.min(1,throwClock/.27)):0,exhale=throwing?Math.exp(-Math.pow((throwClock-.145)/.055,2)):0;
  // Lids do the closing; the eyeball keeps its shape and only squashes a little under a wince.
  const shut=Math.min(1,blink+m.hurt*.45+effort*.30);
m.lids.forEach(l=>l.rotation.x=LID_OPEN+shut*1.52);m.eyes.forEach(e=>e.scale.y=1-m.hurt*.10+m.joy*.03);
  // Eyes lead the turn and follow the aim, so the head reads as looking where the player looks.
  m.gaze+=((travelled>.004?Math.max(-1,Math.min(1,(m.gaitX??0)*1.6)):0)-m.gaze)*(1-Math.exp(-6*dt));
  // Pupils widen with delight and pinch under a wince; a fixed iris is what makes a face look dead.
  m.pupils.forEach(g=>{g.position.y=Math.sin(p.pitch??0)*.016-effort*.004;g.position.x=m.gaze*.022+effort*.006;g.scale.setScalar(1+m.joy*.07-m.hurt*.05);});
  m.brows.forEach((b,j)=>{b.position.y=1.596+m.joy*.030-m.hurt*.014-effort*.024;b.rotation.z=(j?1:-1)*(m.hurt*.10+effort*.13+walk*.006);});m.cheeks.forEach(c=>{c.position.y=1.070+effort*.022+m.joy*.014;c.scale.y=.062*(1+effort*.18+m.joy*.14);});
  // Taking a hit gapes the mouth too, so damage registers on the face and not only on the bar.
  const gape=Math.max(exhale,m.hurt*.80);
  m.mouth.visible=gape>.025;m.mouth.scale.set(1-effort*.12+m.hurt*.10,.05+gape*.66,1);m.lip.scale.y=1+effort*.3;m.smile.scale.set(1+m.joy*.12-effort*.06,1-m.hurt*.35,1);
  if(m.cape.visible){const pos=m.cape.geometry.attributes.position;for(let k=0;k<pos.count;k++){const x=m.capeBase[k*3],y=m.capeBase[k*3+1],a=(.65-y)/1.3;pos.setZ(k,m.capeBase[k*3+2]-a*(.09+Math.min(speed,10)*.034)+Math.sin(time*7-x*5+a*5)*a*(.022+walk*.065));}pos.needsUpdate=true;const normalTick=Math.floor(time*24+i/4);if(normalTick!==m.normalTick){m.cape.geometry.computeVertexNormals();m.normalTick=normalTick;}}
 });for(const water of this.waterSurfaces??[])water.material.uniforms.clock.value=time;for(const flow of this.waterFlows??[])flow.update(time);if(this.leafClock)this.leafClock.value=time;if(this.ambientParticles){this.ambientParticles.rotation.y=time*.007;const dustTime=this.ambientParticles.material.userData?.dustTime;if(dustTime)dustTime.value=time;}}
 syncProjectiles(shots){const live=new Set();for(const s of shots){live.add(s.id);let m=this.projectileMeshes.get(s.id);if(!m){m=this.mesh(s.gun&&s.weapon!=='rpg'?'box':'sphere',s.weapon==='rpg'?this.mat(0xf4ad4e,'skin',{emissive:0x8b2e05,emissiveIntensity:.6}):s.gun?this.mat(0xffe3a3,null,{emissive:0xffc137,emissiveIntensity:3}):this.mat(0xbb8e50,'skin'),this.root);this.projectileMeshes.set(s.id,m);}m.position.set(s.x,s.y,s.z);m.scale.set(s.weapon==='rpg'?.23:s.gun?.045:.23,s.weapon==='rpg'?.23:s.gun?.045:.18,s.weapon==='rpg'?.55:s.gun?.6:.30);m.rotation.set(s.age*14,Math.atan2(s.vx,s.vz),s.age*8);}
  for(const[id,m]of this.projectileMeshes)if(!live.has(id)){this.root.remove(m);this.projectileMeshes.delete(id);}
 }
 // Shared teardown for every transient effect mesh/sprite, whether cached or one-off.
 releaseEffect(e){this.root.remove(e.m);if(e.m.userData.ownGeometry)e.m.geometry.dispose();if(e.m.userData.ownMaterial)e.m.material.dispose();}
 burst(x,z,color=0xdeb872,n=9){for(let i=0;i<n;i++){if(this.effects.length>100)this.releaseEffect(this.effects.shift());const m=this.mesh('sphere',this.mat(color),this.root,x,1,z,.075,.055,.08);this.effects.push({m,vx:(Math.random()-.5)*6,vy:2+Math.random()*4,vz:(Math.random()-.5)*6,life:.65});}}
 // A quick emissive billboard at the muzzle; purely cosmetic, cleared within a couple of frames.
 flash(x,y,z,color=0xfff3c0){if(this.effects.length>100)this.releaseEffect(this.effects.shift());const material=new T.SpriteMaterial({color,transparent:true,opacity:.9,depthWrite:false,toneMapped:false});const sprite=new T.Sprite(material);sprite.position.set(x,y,z);sprite.scale.setScalar(.5);sprite.userData.ownMaterial=true;this.root.add(sprite);this.effects.push({m:sprite,life:.07,maxLife:.07,flash:true});}
 // An expanding, fading ring for explosions and destroyed targets.
 shockwave(x,z,color=0xffcf6b,maxRadius=4.5){if(this.effects.length>100)this.releaseEffect(this.effects.shift());const geometry=new T.TorusGeometry(1,.085,8,32),material=new T.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false});const ring=new T.Mesh(geometry,material);ring.position.set(x,.14,z);ring.rotation.x=Math.PI/2;ring.scale.setScalar(.3);ring.userData.ownGeometry=true;ring.userData.ownMaterial=true;this.root.add(ring);this.effects.push({m:ring,life:.5,maxLife:.5,shockwave:true,maxRadius});}
 effectsUpdate(dt){for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;
  if(e.flash){const t=Math.max(0,e.life)/e.maxLife;e.m.material.opacity=t*.9;e.m.scale.setScalar(.3+(1-t)*.45);if(e.life<=0){this.releaseEffect(e);this.effects.splice(i,1);}continue;}
  if(e.shockwave){const t=1-Math.max(0,e.life)/e.maxLife;e.m.scale.setScalar(.3+t*e.maxRadius);e.m.material.opacity=.85*(1-t);if(e.life<=0){this.releaseEffect(e);this.effects.splice(i,1);}continue;}
  e.vy-=12*dt;e.m.position.x+=e.vx*dt;e.m.position.y+=e.vy*dt;e.m.position.z+=e.vz*dt;e.m.rotation.x+=dt*8;if(e.life<=0){this.root.remove(e.m);this.effects.splice(i,1);}
 }}
 render(players,duo,dt){
  for(const mesh of this.root.children)if(mesh.userData.treeCards){const center=mesh.boundingSphere.center;let d=Infinity;for(let i=0;i<(duo?2:1);i++)d=Math.min(d,Math.hypot(players[i].x-center.x,players[i].z-center.z));mesh.count=d>50?36:d>30?72:mesh.userData.fullCount;}
  for(const mesh of this.root.children)if(mesh.userData.foliage){const center=mesh.boundingSphere?.center;mesh.geometry=center&&players.slice(0,duo?2:1).every(p=>Math.hypot(p.x-center.x,p.z-center.z)>24)?this.geo.foliageLow:this.geo.foliage;}
  this.renderer.setScissorTest(true);this.renderCount=(this.renderCount??0)+1;this.renderer.shadowMap.needsUpdate ||= this.qualityMode==='cinematic'||this.renderCount%2===0;
  for(let i=0;i<(duo?2:1);i++){
   const cam=this.cameras[i],p=players[i],width=duo?Math.floor(this.w/2):this.w,left=i*width,aspect=width/this.h,fov=this.viewSettings?.fov??70;
   if(cam.aspect!==aspect||cam.fov!==fov){cam.aspect=aspect;cam.fov=fov;cam.updateProjectionMatrix();}
   const pose=cameraPose(p,{zoom:p.cameraDistance??this.viewSettings?.zoom??4.6},this.solids);cam.position.set(pose.position.x,pose.position.y,pose.position.z);cam.lookAt(pose.look.x,pose.look.y,pose.look.z);cam.updateMatrixWorld(true);
   this.characters.forEach(m=>m.label.prepare(cam,this.h,this.solids));
   const own=this.characters[p.id],distance=Math.hypot(cam.position.x-p.x,cam.position.z-p.z),end={x:pose.position.x+pose.direction.x*12,y:pose.position.y+pose.direction.y*12,z:pose.position.z+pose.direction.z*12},blockedSight=Number.isFinite(cylinderContact(pose.position,end,p,.12));
   // Clear only actual camera penetration/obstruction; nearby rivals never make the player pop away.
   // Drop the own model when the boom has been crushed against cover, or when the shoulder offset
   // itself has collapsed and the camera is standing in the player. Measuring the distance to the
   // player alone only worked while the camera sat directly behind them.
   const visible=own.g.visible,labelVisible=own.label.sprite.visible;if(pose.distance<1.1||distance<.9||blockedSight)own.g.visible=false;own.label.sprite.visible=false;
   this.renderer.setViewport(left,0,width,this.h);this.renderer.setScissor(left,0,width,this.h);try{this.renderer.render(this.scene,cam);}finally{own.g.visible=visible;own.label.sprite.visible=labelVisible;}

  }this.renderer.setScissorTest(false);
 }
}
