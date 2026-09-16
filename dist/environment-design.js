import * as T from './assets/three.module.js';
import {mapId} from './map-catalogue.js';
// Authored environmental sets: props belong to a street, garden, quay or working yard.
export function dressWorld(w,map,level,night,r){
 const root=w.root,half=map.n*3.2/2,family=mapId(level),stone=w.mat(0xcac1ac,'stone'),iron=w.mat(0x344349,null,{metalness:.65,roughness:.4}),wood=w.mat(0x997244,'wood');
 const box=(mat,x,y,z,sx,sy,sz)=>w.mesh('rounded',mat,root,x,y,z,sx,sy,sz);
 const plaque=(text,x,y,z,width=3,rotation=0)=>{const c=document.createElement('canvas');c.width=768;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle='#183b3a';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#d7b877';ctx.lineWidth=8;ctx.strokeRect(12,12,744,168);ctx.fillStyle='#fff0c8';ctx.font='bold 65px Georgia';ctx.textAlign='center';ctx.fillText(text,384,117,710);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=w.mesh(new T.PlaneGeometry(width,width/4),new T.MeshStandardMaterial({map:tex,roughness:.65}),root,x,y,z);m.rotation.y=rotation;m.userData.ownGeometry=m.userData.ownMaterial=true;m.userData.ownTexture=tex;return m;};
 const bench=(x,z,rotation=0)=>{const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;root.add(g);for(let j=0;j<4;j++)w.mesh('rounded',wood,g,0,.58,-.23+j*.15,1.9,.085,.12);for(let j=0;j<3;j++)w.mesh('rounded',wood,g,0,.84+j*.14,.30,1.9,.10,.07);for(const s of[-1,1]){w.mesh('rounded',iron,g,s*.70,.3,0,.085,.60,.58);w.mesh('rounded',iron,g,s*.70,.8,.29,.07,.80,.07);}return g;};
 const flowerBed=(x,z,sx,sz)=>{box(stone,x,.15,z,sx,.3,sz);box(w.mat(0x493b28),x,.32,z,sx-.15,.06,sz-.15);for(let i=0;i<18;i++){const a=(i%6)/5-.5,b=Math.floor(i/6)/2-.5,px=x+a*(sx-.4),pz=z+b*(sz-.4);w.mesh('sphere',w.mat(0x3e643b),root,px,.43,pz,.15,.14,.15);w.mesh('sphere',w.mat([0xeeb444,0xb4414e,0xeee5d1][i%3]),root,px,.61,pz,.068,.095,.068);}};
 const fence=(z)=>{for(let x=-half;x<=half;x+=2){box(wood,x,.65,z,.12,1.3,.12);}for(const y of[.45,.98])box(wood,0,y,z,half*2,.10,.10);};
 // Fixed building sizes, map-relative street lengths, and reserved gaps at corners.
 const slots=(count,margin=6)=>Array.from({length:count},(_,i)=>(i/(count-1)*2-1)*(half-margin));
 const backdrop=(x,z,width,height,depth,yaw=z<0?0:Math.PI)=>{const g=w.building(x,z,width,height,r,night,1);g.scale.z=depth/4;g.rotation.y=yaw;g.userData.backdrop=true;return g;};
 const eastCanal=(family==='village'||family==='harbour')&&map.waterCells.length===0;
 // The playable roads are paved; fields and lawns are separate surfaces outside the paths.
 if(family==='farm'){w.scene.fog.color.set(0xbed1bd);box(w.mat(0x7c9560),0,-.12,0,half*2+55,.10,half*2+55);}
 const themeNames=family==='village'?['DE BOTERKELDER','KLOMPENS & CO.','DE GOUDEN SPUD','AARDAPPEL MARKT']:family==='harbour'?['KLOMPENS EXPORT','NORTH QUAY','SPUD SHIPPING','THE OLD BOATHOUSE']:['GOLDEN HARVEST','POTATO STORES','THE BUTTER BARN','FIELD OFFICE'];
 // Give each building a pavement, entrance, trade sign and facade detail.
 for(const [i,b]of(map.buildings??[]).entries()){
  const front=b.z<0?1:-1,z=b.z+front*(b.d/2+.02),facing=front===1?0:Math.PI;
  for(const side of[-1,1])box(stone,b.x+side*(b.w/2+.2),.05,b.z,.36,.10,b.d+.6);
  for(const side of[-1,1])box(stone,b.x,.05,b.z+side*(b.d/2+.2),b.w+.6,.10,.36);
  plaque(themeNames[i%4],b.x,2.75,z+.07*front,Math.min(4.5,b.w-.6),facing);
  if(family==='village'){
   const awning=box(w.mat(i%2?0x3d7373:0x9b4646,'wood'),b.x,2.4,z+.6*front,b.w*.72,.10,1.15);awning.rotation.x=front*.10;
   for(let j=0;j<9;j++)box(w.mat(0xf0e4c8),b.x-b.w*.32+j*b.w*.08,2.41,z+.6*front,.18,.025,1.16);
   // Window boxes are attached to the facade, not scattered around the street.
   for(const side of[-1,1])flowerBed(b.x+side*b.w*.32,z+.13*front,1.1,.40);
   // Seed-varied doorstep clutter keeps the same authored street from looking identical every circuit.
   if(r()<.7)w.crate(b.x-b.w*.42,z+.95*front,0,.72+r()*.3);
   if(r()<.6)w.bin(b.x+b.w*.42,z+.7*front,0);
   if(r()<.45){const barrel=w.mesh('cylinder',w.mat(0x6b4a2c,'wood'),root,b.x+(r()<.5?-1:1)*b.w*.2,.4,z+1.2*front,.32,.8,.32);barrel.rotation.x=r()<.3?Math.PI/2:0;}
  }else if(family==='harbour'){
   for(let j=0;j<9;j++)box(iron,b.x-b.w*.43+j*b.w*.108,1.15,z+.05*front,.055,2.2,.09);
   for(const sx of[-1,1])box(iron,b.x+sx*(b.w/2-.15),3,z+.08*front,.12,5.7,.15);
   // A stack of loading crates and a coiled rope by the warehouse door, count varies by seed.
   for(let k=0;k<1+Math.floor(r()*3);k++)w.crate(b.x-b.w*.3+k*1.1,z+1.3*front,0,.85+r()*.25);
   if(r()<.55){const rope=w.mesh(new T.TorusGeometry(.4,.09,6,20),w.mat(0xc9a25a,'wood'),root,b.x+b.w*.35,.1,z+1.0*front);rope.rotation.x=Math.PI/2;rope.userData.ownGeometry=true;}
  }else if(family==='farm'){
   // Farm fronts otherwise had only a plaque and paving; bales and tools fill the yard.
   for(let k=0;k<2+Math.floor(r()*3);k++){const straw=w.mat(0xd9b365,'wood');box(straw,b.x-b.w*.3+k*.95,.35,z+1.1*front,.7,.7,.7);}
   if(r()<.6){const fork=new T.Group();fork.position.set(b.x+b.w*.35,0,z+.9*front);fork.rotation.y=r()*6.28;root.add(fork);w.mesh('cylinder',wood,fork,0,.9,0,.035,1.8,.035);for(const side of[-1,1])w.mesh('cylinder',w.mat(0x5b5f5a,null,{metalness:.4}),fork,side*.07,1.75,.05,.02,.32,.02);}
  }
 }
 // Four readable skylines, instead of the same ring of houses on every map.
 if(family==='village'){
  for(const side of[-1,1]){box(stone,0,.015,side*(half+1.25),half*2,.06,2.3);for(const [i,x]of slots(Math.min(8,Math.max(5,Math.ceil(half*2/11)))).entries())backdrop(x,side*(half+5),7.4,6.5+(i%3)*1.5,5.6);}
  backdrop(0,-half-14,7,14,5.2);plaque('GOUDA',0,10,-half-11.1,3);
  for(const side of[-1,1]){const x=side*(half+(side===1&&eastCanal?15:5.5));for(const z of[-half*.55,0,half*.55])backdrop(x,z,7.2,5.8,5.6,-side*Math.PI/2);const bank=side===1&&eastCanal?half+10.4:-half-1.5;box(stone,bank,.015,0,2.4,.06,half*2);for(const z of[-half*.65,half*.65]){bench(bank,z,-side*Math.PI/2);w.bin(bank,z+2,0);}w.bike(bank,half*.25,0);}
  if(map.waterCells.length===0)w.addCanalBackdrop?.(map,night);
 }else if(family==='estate'){
  backdrop(0,-half-9,17,8,8.4);plaque('ROYAL BUTTER GARDENS',0,3,-half-4.30,6);
  for(const side of[-1,1]){box(stone,0,.015,side*(half+3),half*2,.06,4.2);for(const x of[-half*.66,0,half*.66]){flowerBed(x,side*(half+1.8),6,1.4);bench(x,side*(half+3.2),side===1?0:Math.PI);}for(const x of[-half*.68,half*.68])backdrop(x,side*(half+8),7.5,5,6);for(const z of[-half*.65,0,half*.65])flowerBed(side*(half+1.8),z,1.4,5);}
  // Clipped topiary urns along the promenade, count and spacing vary with the level seed.
  const urnCount=5+Math.floor(r()*4);
  for(let side of[-1,1])for(let i=0;i<urnCount;i++){const z=(i/(urnCount-1)*2-1)*(half-2),urn=w.mat(0xd8c9a3,'stone');w.mesh('cylinder',urn,root,side*(half+2.5),.3,z,.24,.55,.24);w.mesh('sphere',w.mat(0x3f6b41,'hedge'),root,side*(half+2.5),.85,z,.34,.4,.34);}
  // Gazebo, balustrade and formal avenue stay beyond the playable boundary.
  const gz=half+8;for(let i=0;i<8;i++){const a=i*Math.PI/4;w.mesh('cylinder',stone,root,Math.cos(a)*3,1.7,gz+Math.sin(a)*3,.10,3.4,.10);}w.mesh(new T.ConeGeometry(3.8,1.5,8),w.mat(0x4e695b),root,0,4.1,gz).userData.ownGeometry=true;
  if(map.walls.some(wall=>wall.prop==='fountain'))w.formalGarden(map);
 }else if(family==='harbour'){
  for(const side of[-1,1]){box(stone,0,.015,side*(half+1.5),half*2,.06,2.8);for(const [i,x]of slots(Math.min(7,Math.max(4,Math.floor((half*2-13)/11)+1)),6.5).entries())backdrop(x,side*(half+6),9,7+(i%2)*2,7.2);for(const z of[-half*.62,half*.62])backdrop(side*(half+(side===1&&eastCanal?15:6)),z,9,6.8,6.4,-side*Math.PI/2);}
  for(const side of[-1,1]){const x=side*(half+(side===1&&eastCanal?11:3)),z=side*half*.18;box(iron,x,4.8,z,.5,9.6,.5);const boom=box(iron,x-side*3.4,8.8,z,7.2,.35,.45);boom.rotation.z=side*.2;box(iron,x-side*6.2,5.6,z,.055,5.5,.055);w.mesh('sphere',w.mat(0xa38654,'wood'),root,x-side*6.2,3,z,.7,.65,.7);for(let i=0;i<3;i++)w.crate(side*(half+1),side*(half*.43+i*1.2),0,1.1);}
  if(map.waterCells.length)w.canalBridges(map);else w.addCanalBackdrop?.(map,true);
 }else if(family==='shipyard'){
  // A working freight yard: stacked container walls on every side, a straddle gantry over the
  // top and hard standing marked out in yellow. The stacks are the horizon here, not houses.
  w.scene.fog.color.set(0xa9b0b4);
  const shades=[0xc4562f,0x2f6f8c,0xd9a33a,0x4f7a4a,0x9a4457,0x6d6f74];
  for(const side of[-1,1]){
   box(w.mat(0x6f7378,'stone'),0,.015,side*(half+2),half*2,.06,3.2);
   for(let row=0;row<3;row++)for(let i=0;i<Math.ceil(half/3.2);i++){
    const x=(i/(Math.ceil(half/3.2)-1||1)*2-1)*(half-2),y=1.3+row*2.58;
    if(r()<.18)continue;
    const bin=box(w.mat(shades[Math.floor(r()*shades.length)],null,{metalness:.32,roughness:.64}),x,y,side*(half+6.5),6,2.5,2.4);bin.userData.backdrop=row===0;
    box(w.mat(0x2b3237),x,y,side*(half+6.5),6.1,.16,2.5);
   }
   for(let row=0;row<3;row++)for(let i=0;i<Math.ceil(half/3.2);i++){
    const z=(i/(Math.ceil(half/3.2)-1||1)*2-1)*(half-2),y=1.3+row*2.58;
    if(r()<.22)continue;
    box(w.mat(shades[Math.floor(r()*shades.length)],null,{metalness:.32,roughness:.64}),side*(half+6.5),y,z,2.4,2.5,6);
   }
  }
  // A straddle gantry stepping over the yard, well above head height.
  for(const side of[-1,1]){box(iron,side*(half+2.6),5.4,0,.55,10.8,.55);box(iron,side*(half+2.6),5.4,half*.6,.45,10.8,.45);box(iron,side*(half+2.6),5.4,-half*.6,.45,10.8,.45);}
  for(const z of[0,half*.6,-half*.6])box(iron,0,10.9,z,(half+3)*2,.7,.9);
  for(const x of[-half*.4,half*.4])box(iron,x,10.2,0,.5,.9,half*1.3);
  plaque('KLOMPENS FREIGHT',0,7.4,-half-3.2,9);
 }else if(family==='coast'){
  // Sand, a promenade wall, painted huts along it and the sea running out to the horizon.
  w.scene.fog.color.set(0xd8d2b6);
  const seaMat=w.mat(0x3f86a4,null,{roughness:.22,metalness:.25}),dune=w.mat(0xdcc089,'stone');
  box(seaMat,0,-.06,-half-46,half*2+140,.3,90);
  for(let i=0;i<7;i++)box(w.mat(0xe8f1f2,null,{roughness:.4}),(i/6*2-1)*(half+20),.10,-half-4-i%3*2.6,half*.5,.12,1.1);
  for(const side of[-1,1]){
   box(w.mat(0xcfc3a4,'stone'),side*(half+2.4),.5,0,1.6,1,half*2+6);
   for(let i=0;i<6;i++){const z=(i/5*2-1)*(half-3);
    const hut=box(w.mat([0xe36a5c,0x59a7c4,0xe8c15a,0x7fb36b,0xd68ec0][i%5],'wood'),side*(half+6.5),1.3,z,3.4,2.6,3);hut.userData.backdrop=true;
    w.mesh(w.geo.hipRoof,w.mat(0x3f4750,'wood'),root,side*(half+6.5),2.9,z,3.9,1,3.4);
    box(w.mat(0x2f3a42,'wood'),side*(half+6.5)-side*1.72,1.15,z,.06,1.9,1);
   }
  }
  box(dune,0,.7,half+7,half*2+20,1.4,5);
  for(let i=0;i<26;i++){const x=(i/25*2-1)*(half+8),tuft=w.mesh('sphere',w.mat(0x9fae62),root,x,1.42,half+7+(r()-.5)*3,.5,.7,.5);tuft.scale.y=.7+r()*.8;}
  plaque('BUTTERSCOTCH BAY',0,3.2,half+4.2,8,Math.PI);
 }else if(family==='interior'){
  // Nothing outside matters indoors. The dressing here is what is bolted to the shed: dock doors,
  // pipe runs, floor markings and racking along the walls.
  w.scene.fog.color.set(0x2d3439);
  const paint=w.mat(0xd8c24a,null,{roughness:.7}),pipe=w.mat(0x7c848a,null,{metalness:.55,roughness:.42});
  for(const side of[-1,1]){
   for(const at of[-half*.5,half*.5]){box(w.mat(0x44525c,null,{metalness:.3,roughness:.6}),side*(half+1.9),1.9,at,.3,3.8,4.6);
    for(let i=0;i<5;i++)box(w.mat(0x59676f),side*(half+1.75),.6+i*.74,at,.06,.5,4.4);}
   for(let i=0;i<4;i++)box(pipe,side*(half+1.5),6.2+i*.42,0,.26,.26,half*2);
   for(let i=0;i<5;i++){const z=(i/4*2-1)*(half-3);box(w.mat(0x8b939a,null,{metalness:.4,roughness:.5}),side*(half+1.2),1.5,z,.9,3,2.4);
    for(const y of[1.1,2.2])box(w.mat(0xb99a5e,'wood'),side*(half+1.2),y,z,1,.12,2.2);}
  }
  for(let i=-2;i<=2;i++){box(paint,i*half*.42,.02,0,.22,.04,half*2-2);box(paint,0,.02,i*half*.42,half*2-2,.04,.22);}
  plaque('THE CHIP FACTORY · PACKING FLOOR',0,4.6,-half-1.6,10);
 }else if(family==='quarry'){
  // Stepped chalk terraces ring the cutting floor, with a gantry and spoil heaps behind them.
  w.scene.fog.color.set(0xc4cdd2);
  const chalk=w.mat(0xd7dad0,'stone'),chalkDark=w.mat(0xb3b9b4,'stone');
  for(const side of[-1,1]){
   box(chalk,0,.015,side*(half+2),half*2,.06,3.4);
   for(let step=0;step<3;step++)box(step%2?chalkDark:chalk,0,.6+step*1.5,side*(half+6+step*3.2),half*2+step*6,1.5+step*1.5,3.2);
   for(const x of[-half*.6,half*.6])backdrop(x,side*(half+5),7,5.5,5.4);
  }
  for(const side of[-1,1]){
   const x=side*(half+4);
   for(let step=0;step<3;step++)box(step%2?chalkDark:chalk,x+side*(step*3.0),.6+step*1.5,0,3.0,1.5+step*1.5,half*2+step*5);
   // Gantry frame over the cut face.
   box(iron,x,5.2,half*.35,.42,10.4,.42);box(iron,x,5.2,-half*.35,.42,10.4,.42);
   const beam=box(iron,x,10.2,0,.5,.5,half*.75);beam.rotation.z=0;
   for(let i=0;i<3;i++)w.crate(x-side*1.4,(i-1)*2.3,0,1.15);
  }
  for(let i=0;i<7;i++){const a=i*2.399,cone=w.mesh(new T.ConeGeometry(1.5+r()*1.1,1.6+r()*1.4,9),w.mat(0xc8c4b2,'stone'),root,Math.cos(a)*(half+13),.8,Math.sin(a)*(half+13));cone.userData.ownGeometry=true;}
  plaque('CHALK QUARRY',0,4.2,-half-4.2,5);
 }else if(family==='orchard'){
  // Fruit rows outside the lanes, pressing sheds at the ends and crate stacks along the headland.
  w.scene.fog.color.set(0xcdd8bd);
  box(w.mat(0x87a35c),0,-.1,0,half*2+50,.10,half*2+50);
  for(const side of[-1,1]){
   box(w.mat(0xa8b477,'stone'),0,.015,side*(half+1.8),half*2,.06,3);
   for(const [i,x]of slots(5,5).entries())backdrop(x,side*(half+6.5),6.6,5+(i%2)*1.2,5.2);
   for(let row=0;row<3;row++)for(let i=0;i<6;i++){const tx=(i/5*2-1)*(half-3),tz=side*(half+11+row*4.5);w.tree(tx,tz,root,r);if(r()<.5)w.crate(tx+1.4,tz-1.6,0,.85);}
   for(const z of[-half*.5,half*.5]){bench(side*(half+2.6),z,-side*Math.PI/2);}
  }
  for(const side of[-1,1]){
   for(let row=0;row<2;row++)for(let i=0;i<5;i++)w.tree(side*(half+9+row*4.5),(i/4*2-1)*(half-3),root,r);
   // Pressing shed with barrel stacks on the headland.
   const g=barn(w,{x:side*(half+5),z:0,w:7,d:5,h:4});g.userData.backdrop=true;
   for(let i=0;i<4;i++){const barrel=w.mesh('cylinder',w.mat(0x7a4f2c,'wood'),root,side*(half+2.4),.42,(i-1.5)*1.5,.36,.85,.36);}
  }
  plaque('CIDER ORCHARD',0,3.4,-half-3.4,5);
 }else{
  fence(half+1.2);fence(-half-1.2);
  for(const side of[-1,1]){box(w.mat(0x67553b,'stone'),side*(half+9),-.025,0,12,.10,half*2-4);const field=w.mat(0x8d9b4f);for(const z of slots(12,3))box(field,side*(half+9),.10,z,12,.20,(half*2-6)/11*.55);for(const [i,x]of slots(3,7).entries()){const z=side*(half+7);if(side===-1&&i===1)backdrop(x,z,8,6,6);else{const g=barn(w,{x,z,w:8,d:6,h:4.5});g.userData.backdrop=true;}box(stone,x,.015,side*(half+2.8),4,.06,3.2);}}
  // A windmill overlooking the field gives orientation from any part of the farm.
  const gx=-half-8,gz=-half-9;w.mesh('cylinder',stone,root,gx,4,gz,2.2,8,2.2);w.mesh(new T.ConeGeometry(3,2.5,16),w.mat(0x5c5145),root,gx,9,gz).userData.ownGeometry=true;
  for(let arm=0;arm<4;arm++){const group=new T.Group();group.position.set(gx,6,gz+2.4);group.rotation.z=arm*Math.PI/2+.3;root.add(group);w.mesh('rounded',wood,group,0,3,0,.20,6,.15);for(let j=0;j<7;j++)w.mesh('rounded',w.mat(0xd3c9a2),group,.6,1+j*.7,0,1.4,.10,.13);}
  for(const side of[-1,1]){w.crate(half+3,side*4,0,1.2);w.crate(half+3,side*5.3,0,1.2);}
 }
 // Trees follow avenues and field boundaries, with room between trunks and walking routes.
 // A denser tree line reads as an actual avenue rather than a scattering of six trunks.
 // Two receding rows of rooftops plus corner blocks sit behind whatever each family builds, so the
 // horizon reads as a town the arena sits inside rather than one row of houses on an empty lawn.
 // The setbacks start beyond every family structure (the furthest reaches half+18.6), and the rows
 // stop short of each other's arms so no two backgrounds ever overlap.
 const outdoors=family!=='interior';
 // The horizon belongs to the world: a freight yard is ringed by low sheds rather than houses,
 // and the bay has open water on its seaward side where a street would make no sense.
 const shed=family==='shipyard',seaward=(x,z)=>family==='coast'&&z<-half;
 const BLOCK_W=shed?13:8.6,BLOCK_D=shed?9:7.0,PITCH=shed?15.5:11;
 if(outdoors){
 for(const setback of[27,39]){
  const span=half+12,count=Math.max(3,Math.round(span*2/PITCH)+1);
  for(const side of[-1,1])for(let i=0;i<count;i++){
   const along=(i/(count-1)*2-1)*span,height=shed?4+Math.floor(r()*3)*1.1:5+Math.floor(r()*4)*1.8;
   if(!seaward(along,side*(half+setback)))w.distantBlock(along,side*(half+setback),BLOCK_W,height,BLOCK_D,side<0?0:Math.PI,r,night,shed);
   if(!seaward(side*(half+setback),along))w.distantBlock(side*(half+setback),along,BLOCK_W,shed?4+Math.floor(r()*3)*1.1:5+Math.floor(r()*4)*1.8,BLOCK_D,-side*Math.PI/2,r,night,shed);
  }
 }
 // The corner blocks stand clear of both arms, so the wider warehouse sheds need more setback
 // than the houses do.
 const cornerAt=half+(shed?28:23);
 for(const sx of[-1,1])for(const sz of[-1,1])if(!seaward(sx*cornerAt,sz*cornerAt))w.distantBlock(sx*cornerAt,sz*cornerAt,BLOCK_W,shed?4.5:6+Math.floor(r()*3)*1.9,BLOCK_D,sz<0?0:Math.PI,r,night,shed);
 const treesPerSide=8;
 for(let i=0;i<treesPerSide*2;i++){const side=i<treesPerSide?-1:1,offset=family==='estate'?6:family==='farm'?17:family==='quarry'?16:family==='orchard'?20:side===1&&eastCanal?10.4:12,local=i%treesPerSide,x=side*(half+offset),z=(local/(treesPerSide-1)*2-1)*(half-5);w.avenueTree(x,z,root,r);}
 for(const side of[-1,1])for(const z of[-half+2,half-2])w.lamp(side*(half-2),z,0,night);
 // The pavement ring between the arena wall and the town was bare on every map. Street lamps and
 // kerb bollards at walking spacing fill the middle distance the player spends most time looking
 // across, and sit outside the playable grid so nothing new blocks a route.
 const ringCount=Math.max(4,Math.round(half/4.5));
 for(const side of[-1,1]){
  // The east bank carries the canal on the dry maps, so that arm steps out past the water rather
  // than planting lamp posts in it.
  const bank=side===1&&eastCanal?9.6:1.9;
  for(let i=0;i<ringCount;i++){
   const t=(i/(ringCount-1)*2-1)*(half-3);
   w.lamp(t,side*(half+1.9),0,night);w.lamp(side*(half+bank),t,0,night);
   if(i%2){box(stone,t,.34,side*(half+3.3),.34,.68,.34);box(stone,side*(half+bank+1.4),.34,t,.34,.68,.34);}
  }
 }
 }
 for(const prop of map.props??[]){if(prop.prop==='marketStall')w.stall(prop.x,prop.z,0,Math.round(prop.x));else if(prop.prop==='cargo'){box(wood,prop.x,.07,prop.z,2.35,.14,2.35);for(const side of[-1,1])for(const row of[-1,1])w.crate(prop.x+side*.58,prop.z+row*.58,.14,1.08);w.crate(prop.x,prop.z,1.22,.58);}else if(prop.prop==='hay'){const straw=w.mat(0xd9b365,'wood');box(straw,prop.x,.43,prop.z,2.3,.86,2.3);box(straw,prop.x,1.04,prop.z,1.6,.35,1.6);for(const side of[-1,1])box(w.mat(0x796845),prop.x+side*.7,.44,prop.z,.05,.89,2.33);}
  else if(prop.prop==='stoneBlock'){const cut=w.mat(0xd2d5cb,'stone');box(cut,prop.x,.55,prop.z,2.4,1.1,2.4);box(w.mat(0xbcc0b7,'stone'),prop.x,1.24,prop.z,1.9,.3,1.9);for(const side of[-1,1])box(w.mat(0x8d9189),prop.x+side*1.15,.55,prop.z,.08,1.05,2.3);}
  else if(prop.prop==='spoil'){const rubble=w.mat(0xc6c2b0,'stone');for(let i=0;i<5;i++){const a=i*2.399,chunk=w.mesh('rounded',rubble,root,prop.x+Math.cos(a)*.6,.22+(i%2)*.18,prop.z+Math.sin(a)*.6,.7,.5,.65);chunk.rotation.y=a;}box(rubble,prop.x,.12,prop.z,2.2,.24,2.2);}
  else if(prop.prop==='container'){
   // A corrugated box: ribbed sides, a painted door end and, on the stacked rows, a second one
   // sitting on top with its ribs offset so the pair does not read as one tall slab.
   const shade=[0xc4562f,0x2f6f8c,0xd9a33a,0x4f7a4a,0x9a4457][Math.floor(r()*5)],steelBox=w.mat(shade,null,{metalness:.35,roughness:.62}),trim=w.mat(0x2b3237,null,{metalness:.5,roughness:.5});
   const long=prop.turned?prop.d:prop.w,tall=prop.stacked?2:1;
   for(let level=0;level<tall;level++){
    const y=level*2.58+1.28;
    box(steelBox,prop.x,y,prop.z,prop.w-.06,2.5,prop.d-.06);
    for(let i=0;i<9;i++){const t=(i/8-.5)*(long-.5);
     if(prop.turned)box(trim,prop.x-prop.w/2+.02,y,prop.z+t,.05,2.3,.08),box(trim,prop.x+prop.w/2-.02,y,prop.z+t,.05,2.3,.08);
     else box(trim,prop.x+t,y,prop.z-prop.d/2+.02,.08,2.3,.05),box(trim,prop.x+t,y,prop.z+prop.d/2-.02,.08,2.3,.05);
    }
    for(const corner of[-1,1])for(const end of[-1,1])box(trim,prop.x+(prop.turned?corner*prop.w/2:end*prop.w/2),y,prop.z+(prop.turned?end*prop.d/2:corner*prop.d/2),.14,2.46,.14);
    box(w.mat(0xe6e0d2),prop.x+(prop.turned?0:prop.w*.36),y+.35,prop.z+(prop.turned?prop.d*.36:0),prop.turned?.9:.05,.34,prop.turned?.05:.9);
   }
  }
  else if(prop.prop==='groyne'){
   // A timber breakwater: posts sunk into the sand with weathered boards bolted across them.
   const timber=w.mat(0x6d5843,'wood',{roughness:.94}),along=prop.w>prop.d;
   for(let i=0;i<4;i++){const t=(i/3-.5)*(along?prop.w:prop.d)*.86;
    box(timber,prop.x+(along?t:0),.62,prop.z+(along?0:t),.3,1.24,.3);}
   for(const y of[.45,.9])box(timber,prop.x,y,prop.z,along?prop.w:.22,.22,along?.22:prop.d);
   for(let i=0;i<5;i++){const a=r()*6.28,d=.6+r()*.7;w.mesh('sphere',w.mat(0x9b8f6f),root,prop.x+Math.cos(a)*d,.06,prop.z+Math.sin(a)*d,.22,.09,.22);}
  }
  else if(prop.prop==='beachHut'){
   // Painted seaside huts, one colour per hut, with a pitched felt roof and a stable door.
   const paint=w.mat([0xe36a5c,0x59a7c4,0xe8c15a,0x7fb36b,0xd68ec0][Math.floor(r()*5)],'wood',{roughness:.8});
   box(paint,prop.x,1.1,prop.z,prop.w-.2,2.2,prop.d-.2);
   w.mesh(w.geo.hipRoof,w.mat(0x3f4750,'wood'),root,prop.x,2.55,prop.z,prop.w+.25,.85,prop.d+.25);
   box(w.mat(0x33414b,'wood'),prop.x,.95,prop.z+prop.d/2-.06,.8,1.9,.08);
   box(w.mat(0xf1ead7),prop.x,1.86,prop.z+prop.d/2-.03,.46,.3,.05);
  }
  else if(prop.prop==='rock'){
   const stoneMat=w.mat(0x8d8b80,'stone',{roughness:.95});
   for(let i=0;i<4;i++){const a=i*1.9,lump=w.mesh('rounded',stoneMat,root,prop.x+Math.cos(a)*prop.w*.22,.22+(i%2)*.34,prop.z+Math.sin(a)*prop.d*.22,prop.w*(.5+(i%2)*.18),.7+(i%3)*.4,prop.d*(.5+(i%3)*.14));lump.rotation.set(r()*.3,a,r()*.3);}
  }
  else if(prop.prop==='vat'){
   // A fryer vat: a steel drum on a plinth with a rolled rim, a gantry rail and a feed pipe.
   const steel=w.mat(0x8d969c,null,{metalness:.7,roughness:.35});
   w.mesh('cylinder',steel,root,prop.x,1.02,prop.z,prop.w*.42,2.04,prop.d*.42);
   const rim=w.mesh(new T.TorusGeometry(prop.w*.43,.08,8,24),w.mat(0x5d666c,null,{metalness:.6,roughness:.4}),root,prop.x,2.06,prop.z);rim.rotation.x=Math.PI/2;rim.userData.ownGeometry=true;
   w.mesh('cylinder',w.mat(0xe0b452,null,{roughness:.28,metalness:.15}),root,prop.x,2.0,prop.z,prop.w*.38,.06,prop.d*.38);
   box(w.mat(0x424a51),prop.x,.12,prop.z,prop.w,.24,prop.d);
   for(const side of[-1,1])box(steel,prop.x+side*prop.w*.5,1.5,prop.z,.12,.12,prop.d);
  }
  else if(prop.prop==='pallet'){
   const timber=w.mat(0xb08a56,'wood',{roughness:.9});
   for(let level=0;level<3;level++){box(timber,prop.x,.18+level*.36,prop.z,prop.w-.3,.12,prop.d-.3);
    for(const side of[-1,1])box(timber,prop.x+side*(prop.w-.3)*.36,.30+level*.36,prop.z,.18,.22,prop.d-.4);}
   box(w.mat(0xdad2bd),prop.x,1.16,prop.z,prop.w-.5,.3,prop.d-.5);
  }
  else if(prop.prop==='conveyor'){
   const frame=w.mat(0x5e666d,null,{metalness:.5,roughness:.5}),belt=w.mat(0x2d3338,null,{roughness:.9});
   box(belt,prop.x,.92,prop.z,prop.w-.2,.12,prop.d-.1);
   for(const side of[-1,1])box(frame,prop.x+side*(prop.w-.2)*.5,.5,prop.z,.1,1,prop.d-.1);
   for(let i=0;i<4;i++)box(frame,prop.x-prop.w*.35+i*prop.w*.23,.44,prop.z,.09,.88,.09);
   for(let i=0;i<3;i++)w.mesh('sphere',w.mat(0xd8b978,'skin'),root,prop.x-prop.w*.22+i*prop.w*.22,1.06,prop.z,.17,.19,.17);
  }
  else if(prop.prop==='cider'){const oak=w.mat(0x7a4f2c,'wood');for(const [dx,dz]of[[-.55,-.55],[.55,-.55],[-.55,.55],[.55,.55]]){const barrel=w.mesh('cylinder',oak,root,prop.x+dx,.45,prop.z+dz,.4,.9,.4);}box(w.mat(0x93643b,'wood'),prop.x,.95,prop.z,2.1,.12,2.1);w.crate(prop.x,prop.z,1.02,.7);}
  else if(prop.prop==='crateStack'){for(let i=0;i<3;i++)w.crate(prop.x+(i%2?.25:-.2),prop.z+(i===2?.3:-.15),i*.72,.78);box(w.mat(0x5c6a55),prop.x,.05,prop.z,2.2,.10,2.2);}}
 // Flush drainage grates sit by the kerb at repeatable street junctions.
 if(family==='village'||family==='harbour')for(const x of[-half+3,half-3])for(const z of[-half+3,half-3])for(let j=0;j<5;j++)box(iron,x-.25+j*.12,.012,z,.055,.02,.6);
 w.chunkInstances();w.batchStatic();
}

export function barn(w,b){const g=new T.Group();g.position.set(b.x,0,b.z);w.root.add(g);const red=w.mat(0x9c483b,'wood'),roof=w.mat(0x484c43,'wood'),trim=w.mat(0xe0d0a5,'wood');w.mesh('rounded',red,g,0,b.h/2,0,b.w,b.h,b.d);for(const side of[-1,1]){const m=w.mesh('rounded',roof,g,side*b.w*.27,b.h+.95,0,b.w*.65,.15,b.d+.5);m.rotation.z=-side*.52;for(let j=0;j<14;j++)w.mesh('rounded',trim,g,-b.w/2+j*b.w/13,b.h*.48,side*(b.d/2+.035),.035,b.h*.94,.035);w.mesh('rounded',w.mat(0x583a2c,'wood'),g,0,1.5,side*(b.d/2+.05),2.3,3,.10);for(const a of[-1,1]){const brace=w.mesh('rounded',trim,g,0,1.5,side*(b.d/2+.12),.10,3.6,.09);brace.rotation.z=a*.63;}}return g;}
