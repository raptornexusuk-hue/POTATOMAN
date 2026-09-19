// A live potato in the locker, wearing the kit being chosen, instead of a flat drawing of it.
//
// The drawing was there because three.js is not loaded on the menu and a spinning model is not what
// the screen is for -- it has to answer "what am I picking" instantly. Both of those are still true,
// which is why the model is loaded only when the locker is actually opened, the flat drawing shows
// until it arrives, and it stays as the answer on any device that cannot give us WebGL. What the
// drawing could never do is show the piece you are about to wear: it approximated a bucket hat with
// an ellipse, and the thing you got in the match was a different object built somewhere else. This
// is the same builder the match uses, so the hat in the locker is the hat on your head.
let session=null;
export function closePreview(){if(!session)return;cancelAnimationFrame(session.frame);session.world.dispose?.();session.canvas.remove();session=null;}
// Rebuilding the whole potato for a hat change is wasteful, but it is also exactly what guarantees
// the preview cannot drift from the match: there is one character builder and it runs from scratch.
export async function showPreview(host,outfit,onFail){
 try{
  if(!session){
   const [T,{World},{LEVELS}]=await Promise.all([import('./assets/three.module.js'),import('./world.js'),import('./core.js')]);
   const canvas=document.createElement('canvas');canvas.className='locker-stage';host.append(canvas);
   const world=new World(canvas);await world.ready;
   world.root=new T.Group();world.scene.add(world.root);// A maze level, because on one of those the potato carries nothing: the arms fall to its sides
   // and the kit is what you see, rather than a spud held across the chest in front of the scarf
   // you are trying to look at.
   world.level=LEVELS.find(l=>l.mode==='race')??LEVELS[0];world.solids=[];world.isBonus=false;
   // The renderer has no alpha buffer, so the stage gets a colour of its own rather than a black
   // rectangle punched through the panel behind it.
   world.scene.background=new T.Color(0x16242c);world.scene.fog=null;world.environment?.(false);
   const camera=new T.PerspectiveCamera(30,1,.1,40);
   // Lit like a shop window rather than like a street: a warm key, a cool rim to pull the silhouette
   // off the background, and enough fill that a dark hat is still a hat.
   const key=new T.DirectionalLight(0xfff1d4,3.2);key.position.set(2.4,3.4,3.2);world.scene.add(key);
   const rim=new T.DirectionalLight(0x9cc6ff,1.5);rim.position.set(-2.6,1.8,-2.2);world.scene.add(rim);
   world.scene.add(new T.AmbientLight(0xb9d2e2,1.15));
   session={T,world,canvas,camera,model:null,turn:0,frame:0,outfit:null};
   const tick=()=>{session.frame=requestAnimationFrame(tick);draw();};
   tick();
  }
  if(JSON.stringify(outfit)!==session.outfit)rebuild(outfit);
  host.classList.add('live');
  return true;
 }catch(e){closePreview();host.classList.remove('live');onFail?.(e);return false;}
}
function rebuild(outfit){
 const {T,world}=session;
 if(session.model){world.root.remove(session.model.g);session.model.label?.dispose?.();}
 const model=world.character(0,outfit);world.characters=[model];session.model=model;session.outfit=JSON.stringify(outfit);session.fit=null;
 // A name plate, a team ring on the floor and a potato held ready to throw all belong in a match.
 // None of them is a thing you are choosing here, and each one is something to look at instead of
 // the hat.
 if(model.label?.sprite)model.label.sprite.visible=false;
 model.g.traverse(o=>{if(o.isSprite)o.visible=false;});
 if(model.badge)model.badge.visible=false;
 void T;
}
// One still frame is not enough to judge a hat, so the potato turns slowly: a piece reads by its
// silhouette from the side and by its detail from the front, and the turn gives both without
// anybody having to drag it.
// The potato plus whatever it is wearing, with a margin, in the turned pose it will be seen in.
function measure(model){const T=session.T,box=new T.Box3();
 for(const part of[model.bob,...model.legs])box.expandByObject(part);
 if(box.isEmpty())return{tall:2.6,wide:1.6,centre:1.25};
 // Height and width are fitted separately. Fitting the potato's height into the frame's width, on
 // a stage that is much taller than it is wide, pushed the camera back far enough to leave the
 // potato swimming in empty panel. The turn sweeps the deepest thing it is wearing round to face
 // us, so the width to fit is the larger of the two ground extents.
 const tall=Math.max(2.35,box.max.y-box.min.y),wide=Math.max(1.5,box.max.x-box.min.x,box.max.z-box.min.z);
 return{tall,wide,centre:(box.max.y+box.min.y)*.5};}
function draw(){
 const {world,camera,canvas,model}=session;if(!model)return;
 const width=canvas.clientWidth||300,height=canvas.clientHeight||340;
 if(canvas.width!==Math.round(width*devicePixelRatio)||canvas.height!==Math.round(height*devicePixelRatio)){
  world.renderer.setPixelRatio(Math.min(devicePixelRatio,2));world.renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();
 }
 session.turn+=.006;
 const player={id:0,name:'',hp:100,x:0,y:0,z:0,vy:0,yaw:session.turn,pitch:-.08,respawn:0,crouching:false,runner:false,dashTime:0,shotAnim:0,shotDuration:.46,catchTime:0,reload:0,gun:false,weapon:'throw',cameraDistance:4,grounded:true,outfit:null};
 model.crouchBlend=0;model.walk=0;model.stride=0;model.gaitX=0;model.gaitZ=1;model.lastX=0;model.lastZ=0;
 world.updatePlayers([player],performance.now()/1000,1/60);
 model.shadow&&(model.shadow.visible=false);model.heldSpud&&(model.heldSpud.visible=false);
 // Framed from the potato's own bounds rather than from numbers that suit one hat: a top hat is
 // taller than a bare head, and a camera placed for the bare head cuts the top hat off. The frame
 // is measured once per outfit and held, so it does not breathe as the model turns.
 world.root.updateMatrixWorld(true);
 session.fit??=measure(model);
 const {tall,wide,centre}=session.fit,reach=Math.tan(camera.fov*Math.PI/360);
 camera.position.set(0,centre+tall*.03,Math.max(tall*.5/reach,wide*.5/(reach*camera.aspect))*1.06);camera.lookAt(0,centre,0);
 world.renderer.render(world.scene,camera);
}
