// Builds real Three.js scene graphs with a renderer substitute. Does not render GPU pixels.
import assert from 'node:assert/strict';
import {World} from '../dist/world.js';
import {LEVELS,makeMap,route,slideMove,boxContact3D} from '../dist/core.js';
const ctx=new Proxy({measureText:text=>({width:text.length*31})},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({getContext:()=>ctx})};globalThis.innerWidth=1440;globalThis.innerHeight=900;globalThis.devicePixelRatio=1;
const renderer={shadowMap:{},capabilities:{getMaxAnisotropy:()=>4},setPixelRatio(){},setSize(){}};
const oldLoad=World.prototype.loadMaterials;World.prototype.loadMaterials=async function(){};
const w=new World({},renderer);await w.ready;World.prototype.loadMaterials=oldLoad;
const players=[0,1,2,3].map(id=>({id,name:['YOU','MASH','ROAST','CHIP'][id],hp:100,x:0,z:0,yaw:0,pitch:0,respawn:0,runner:false,dashTime:0,shotAnim:0,catchTime:0,reload:0,gun:false,panX:0,panY:0,cameraDistance:5.6}));
let maxMeshes=0;
for(const l of LEVELS){const m=makeMap(l);w.build(m,l,players,false);assert.equal(w.characters.length,4);w.updatePlayers(players,1,1/60);let meshes=0;w.root.traverse(o=>{if(o.isMesh)meshes++;if(o.geometry?.attributes?.position){const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++){assert.ok(Number.isFinite(pos.getX(i))&&Number.isFinite(pos.getY(i))&&Number.isFinite(pos.getZ(i)));}}});maxMeshes=Math.max(maxMeshes,meshes);if(l.mode==='race'){let p={...m.start};for(const next of route(m,p,m.exit).slice(1)){slideMove(p,next.x-p.x,next.z-p.z,m.walls);assert.ok(Math.hypot(p.x-next.x,p.z-next.z)<1e-5);}}}
console.log(`PASS all ${LEVELS.length} actual scene graphs build with finite geometry and clear maze routes (${maxMeshes} mesh objects max after batching)`);
const map=makeMap(LEVELS[0]);w.build(map,LEVELS[0],players,false);const p=map.toWorld(7,7);assert.ok(route(map,map.start,p).length>0);console.log('PASS navigation reaches the town square between full building blocks');
assert.equal(boxContact3D(-4,2.5,0,4,2.5,0,{x:0,z:0,w:1,d:1,h:1.45},.1),Infinity);assert.ok(Number.isFinite(boxContact3D(-4,1,0,4,1,0,{x:0,z:0,w:1,d:1,h:1.45},.1)));console.log('PASS shots clear low cover at the correct height');
const m=w.characters[0];players[0].runner=true;players[0].x=1;w.updatePlayers(players,2,1/60);const cape=Array.from(m.cape.geometry.attributes.position.array);players[0].x=1.1;w.updatePlayers(players,2.1,1/60);assert.notDeepEqual(Array.from(m.cape.geometry.attributes.position.array),cape);assert.ok(m.stride>0);players[0].runner=false;console.log('PASS equipped cape and movement drive stride and cloth deformation');
// Texture downloads may fail or never settle; procedural materials must remain usable.
const {Texture}=await import('../dist/assets/three.module.js');const skin=new Texture(),oldStone=w.textures.stone,oldBrick=w.textures.brick;let late;
await w.loadMaterials({loadAsync(file){if(file.includes('skin'))return Promise.resolve(skin);if(file.includes('cobblestone'))return Promise.reject(Error('network'));return new Promise(r=>late=r);}},5);
assert.equal(w.textures.skin,skin);assert.equal(w.textures.stone,oldStone);assert.equal(w.textures.brick,oldBrick);assert.deepEqual(w.materialFallbacks.sort(),['brick','foliage','oak','paving','stone']);let disposed=false;late({dispose(){disposed=true;}});await Promise.resolve();assert.equal(disposed,true);
console.log('PASS failed and stalled textures keep procedural materials; late downloads are disposed');
// Overhead UI follows the same live player state used by online and local rendering.
const label=w.characters[0].label,firstTextureVersion=label.texture.version;
players[0].hp=40;w.updatePlayers(players,3,1/60);assert.equal(label.healthFraction,.4);assert.equal(label.sprite.position.x,players[0].x);assert.ok(label.texture.version>firstTextureVersion);
const unchanged=label.texture.version;w.updatePlayers(players,3.1,1/60);assert.equal(label.texture.version,unchanged,'unchanged labels must not upload a texture per frame');
Object.assign(players[0],{name:'OWL',runner:true,hp:140});w.updatePlayers(players,3.2,1/60);assert.equal(label.name,'OWL');assert.equal(label.healthFraction,1);assert.ok(label.sprite.position.y>2.4);players[0].hp=70;w.updatePlayers(players,3.3,1/60);assert.equal(label.healthFraction,.5);
players[0].respawn=2;w.updatePlayers(players,3.4,1/60);assert.equal(label.sprite.visible,false);Object.assign(players[0],{respawn:0,hp:140,x:2,z:0});w.updatePlayers(players,3.5,1/60);assert.equal(label.sprite.visible,true);assert.equal(label.sprite.position.x,2);
const cam=w.cameras[0];cam.position.set(2,3,8);cam.updateProjectionMatrix();label.prepare(cam,900,[]);const projectedHeight=label.sprite.scale.y*cam.projectionMatrix.elements[5]*900/2;assert.ok(Math.abs(projectedHeight-40)<1e-8);label.prepare(cam,390,[]);assert.ok(Math.abs(label.sprite.scale.y*cam.projectionMatrix.elements[5]*390/2-40)<1e-8);
label.prepare(cam,900,[{x:2,z:4,w:4,d:1,h:5}]);assert.equal(label.sprite.visible,false,'cover must block labels');label.prepare(cam,900,[]);assert.equal(label.sprite.visible,true);
assert.equal(label.material.depthTest,true);assert.equal(label.material.depthWrite,false);assert.equal(label.material.sizeAttenuation,false);
const drawn=[];Object.assign(renderer,{setScissorTest(){},setViewport(){},setScissor(){},render(){drawn.push(w.characters.map(m=>m.label.sprite.scale.y));}});
players.forEach(p=>Object.assign(p,{hp:100,runner:false,respawn:0}));w.updatePlayers(players,4,1/60);w.render(players,true,1/60);assert.equal(drawn.length,2);assert.ok(drawn.every(view=>view.length===4&&view.every(size=>size===view[0])));drawn.length=0;w.render([players[2]],false,1/60);assert.equal(drawn[0].length,4,'online guest camera retains every player label');
let textureDisposals=0,materialDisposals=0;for(const m of w.characters){m.label.texture.addEventListener('dispose',()=>textureDisposals++);m.label.material.addEventListener('dispose',()=>materialDisposals++);}w.build(map,LEVELS[0],players,false);assert.equal(textureDisposals,4);assert.equal(materialDisposals,4);assert.equal(w.root.children.filter(o=>o.isSprite).length,4);
console.log('PASS overhead names/health update, 140HP transformation, respawn, wall occlusion, split-screen/guest sizing and texture cleanup');
w.textures.foliage=new Texture();w.materials.delete('oak-leaf-clusters');const garden=LEVELS.find(l=>l.theme==='garden');w.build(makeMap(garden),garden,players,false);const trees=w.root.children.filter(o=>o.userData.treeCards);assert.equal(trees.length,16);assert.ok(trees.every(t=>t.geometry===w.geo.leaf&&t.material.map===w.textures.foliage&&t.material.alphaTest>.3&&t.castShadow));
assert.equal(w.waterSurfaces.length,1);assert.equal(w.waterFlows.length,1);const pool=w.waterSurfaces[0],flow=w.waterFlows[0],drops=flow.group.children.find(o=>o.isPoints);const beforeDrops=Array.from(drops.geometry.attributes.position.array);w.updatePlayers(players,8.7,1/60);assert.notDeepEqual(Array.from(drops.geometry.attributes.position.array),beforeDrops);assert.equal(pool.material.uniforms.clock.value,8.7);assert.equal(w.leafClock.value,8.7);assert.ok(flow.group.children.filter(o=>o.isMesh).every(o=>o.parent===flow.group),'animated flow cannot be detached by batching');
const disposalCounts=[];flow.group.traverse(o=>{for(const [flag,key]of[['ownGeometry','geometry'],['ownMaterial','material']])if(o.userData[flag]){const count={value:0};disposalCounts.push(count);o[key].addEventListener('dispose',()=>count.value++);}});w.build(map,LEVELS[0],players,false);assert.ok(disposalCounts.every(c=>c.value===1));assert.ok(w.waterSurfaces[0].parent===w.root);console.log('PASS textured leaf-card trees, shadows, flowing fountain, moving drops/ripples and exact cleanup across level changes');

// Add after the existing scene tests. Captures actual geometry before batching.
const {Box3}=await import('../dist/assets/three.module.js');
const originalBatch=w.batchStatic,originalTree=w.avenueTree;
let backdrops,avenueTrees;
w.batchStatic=function(){
 this.root.updateMatrixWorld(true);backdrops=[];
 this.root.traverse(o=>{if(o.userData.backdrop)backdrops.push({x:o.position.x,z:o.position.z,box:new Box3().setFromObject(o)});});
 return originalBatch.call(this);
};
w.avenueTree=function(x,z,...args){avenueTrees.push({x,z});return originalTree.call(this,x,z,...args);};
const overlapXZ=(a,b)=>Math.min(a.max.x,b.max.x)>Math.max(a.min.x,b.min.x)+1e-4&&Math.min(a.max.z,b.max.z)>Math.max(a.min.z,b.min.z)+1e-4;
try{
 for(const bonus of[false,true])for(const level of LEVELS){
  const map=makeMap(level,bonus),half=map.n*3.2/2;avenueTrees=[];w.build(map,level,[],bonus);
  const arena={min:{x:-half,z:-half},max:{x:half,z:half}};
  for(let i=0;i<backdrops.length;i++){
   assert.ok(!overlapXZ(backdrops[i].box,arena),level.name+' background enters playable arena');
   for(let j=i+1;j<backdrops.length;j++)assert.ok(!overlapXZ(backdrops[i].box,backdrops[j].box),level.name+' background buildings overlap');
  }
  for(const side of[-1,1]){
   const row=avenueTrees.filter(t=>Math.sign(t.x)===side);
   assert.equal(row.length,8);assert.ok(Math.min(...row.map(t=>t.z))<=-half+5.01);assert.ok(Math.max(...row.map(t=>t.z))>=half-5.01);
  }
  if(['village','harbour'].includes(map.worldId)){
   for(const side of[-1,1]){
    const street=backdrops.filter(b=>Math.sign(b.z)===side&&Math.abs(b.z)>half&&Math.abs(b.x)<half);
    assert.ok(Math.min(...street.map(b=>b.box.min.x))<=-half+3,level.name+' north/south street fails to reach edge');
    assert.ok(Math.max(...street.map(b=>b.box.max.x))>=half-3,level.name+' north/south street fails to reach edge');
    assert.ok(backdrops.filter(b=>Math.sign(b.x)===side&&Math.abs(b.x)>half&&Math.abs(b.z)<half).length>=2,level.name+' side street missing');
   }
   if(!map.waterCells.length){
    const canal={min:{x:half+1.5,z:-half-10},max:{x:half+8.5,z:half+10}};
    assert.ok(backdrops.every(b=>!overlapXZ(b.box,canal)));
    assert.ok(avenueTrees.every(t=>t.x<canal.min.x||t.x>canal.max.x),'tree trunk planted in canal');
   }
  }
  w.root.updateMatrixWorld(true);w.root.traverse(o=>{
   assert.ok(o.matrixWorld.elements.every(Number.isFinite));
   if(o.isInstancedMesh)assert.ok(o.instanceMatrix.array.every(Number.isFinite));
  });
 }
}finally{w.batchStatic=originalBatch;w.avenueTree=originalTree;}
console.log('PASS all ${LEVELS.length*2} normal/bonus backgrounds: separated geometry, full-width/side streets, map-relative tree avenues, dry canal banks and finite batching');
