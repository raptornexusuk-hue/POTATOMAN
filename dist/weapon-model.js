import * as T from './assets/three.module.js';
import {roundedBox} from './visuals.js';

// Compact pressure-powered launcher. Every part stays forward of the original
// grip, and the visible barrel end retains the exact gameplay muzzle socket.
export function makeSpudGun(w,parent){
 const gun=new T.Group();parent.add(gun);
 const steel=w.mat(0x263b46,null,{metalness:.82,roughness:.29}),brass=w.mat(0xd3a950,null,{metalness:.76,roughness:.3}),silver=w.mat(0x92a7aa,null,{metalness:.9,roughness:.24}),rubber=w.mat(0x1c292a,null,{roughness:.88}),walnut=w.mat(0x95602d,'wood',{roughness:.48}),paint=w.mat(0xd2ab37,null,{metalness:.38,roughness:.42});
 const mesh=(geo,mat,x,y,z,sx=1,sy=1,sz=1)=>w.mesh(geo,mat,gun,x,y,z,sx,sy,sz);
 const tube=(mat,x,y,z,radius,length)=>{const part=mesh('cylinder',mat,x,y,z,radius,length,radius);part.rotation.x=Math.PI/2;return part;};
 const ring=(radius,thickness,z,mat=brass,x=0,y=.035)=>{const part=mesh(new T.TorusGeometry(radius,thickness,8,32),mat,x,y,z);part.userData.ownGeometry=true;return part;};
 w.geo.spudReceiver??=roundedBox(.16,6);w.geo.spudGrip??=roundedBox(.20,6);
 mesh('spudReceiver',steel,0,0,.28,.25,.27,.75);
 w.geo.gunBarrel??=new T.CylinderGeometry(1,1,1,24,1,true);
 const barrel=mesh('gunBarrel',silver,0,.035,.81,.08,.51,.08);barrel.rotation.x=Math.PI/2;
 // Walnut pistol grip, brass heel and an inset receiver panel.
 mesh('spudGrip',walnut,0,-.155,.325,.17,.22,.22);
 mesh('rounded',brass,0,-.251,.325,.178,.026,.222);
 for(const side of[-1,1]){
  mesh('rounded',walnut,side*.126,0,.26,.018,.19,.33);
  mesh('rounded',brass,side*.139,.068,.26,.012,.024,.30);
  mesh('rounded',paint,side*.14,-.016,.28,.015,.09,.20);
  for(const z of[.15,.37]){mesh('sphere',silver,side*.139,.035,z,.013,.017,.017);mesh('box',rubber,side*.153,.035,z,.002,.005,.019);}
  for(let j=0;j<5;j++)mesh('rounded',rubber,side*.087,-.105-j*.025,.325,.009,.008,.15);
 }
 // Pressure chamber, vented shroud and polished barrel bands.
 tube(steel,0,.035,.62,.106,.29);
 for(const z of[.49,.62,.76])ring(.107,.012,z);
 for(const side of[-1,1])for(let j=0;j<4;j++)mesh('rounded',rubber,side*.098,.07,.52+j*.054,.009,.035,.030);
 ring(.086,.009,.89,silver);ring(.093,.013,1.048);
 const bore=mesh(new T.CircleGeometry(.067,32),rubber,0,.035,1.026);bore.userData.ownGeometry=true;
 // A copper feed pipe curls beneath the chamber without obstructing the trigger.
 const curve=new T.CatmullRomCurve3([[.10,-.07,.42],[.11,-.115,.57],[.07,-.105,.72]].map(p=>new T.Vector3(...p)));
 const pipe=mesh(new T.TubeGeometry(curve,12,.012,8,false),brass,0,0,0);pipe.userData.ownGeometry=true;
 const guardPath=new T.CatmullRomCurve3([[0,-.08,.45],[0,-.24,.45],[0,-.25,.60],[0,-.09,.62]].map(p=>new T.Vector3(...p)));
 const guard=mesh(new T.TubeGeometry(guardPath,16,.014,8,false),silver,0,0,0);guard.userData.ownGeometry=true;
 mesh('rounded',brass,0,-.14,.47,.025,.075,.022).rotation.x=-.22;
 // Small pressure dial faces the player's shoulder camera side.
 const dial=tube(brass,-.146,.045,.40,.060,.018);dial.rotation.set(0,0,Math.PI/2);
 const face=mesh(new T.CircleGeometry(.048,24),w.mat(0xf4e4b7,null,{roughness:.72}),-.157,.045,.40);face.rotation.y=-Math.PI/2;face.userData.ownGeometry=true;
 for(let i=0;i<5;i++){const angle=-1.1+i*.55;mesh('sphere',rubber,-.160,.045+Math.cos(angle)*.034,.40+Math.sin(angle)*.034,.002,.005,.004);}
 const needle=mesh('box',rubber,-.163,.057,.409,.003,.033,.004);needle.rotation.x=-.6;
 mesh('rounded',brass,0,.151,.16,.12,.026,.16);
 mesh('rounded',rubber,0,.158,.17,.040,.031,.067);
 for(const part of gun.children){part.position.y-=.035;part.position.z-=1.065;}
 // Bake fixed details into one draw per material. Keep the barrel separate as the
 // explicit muzzle reference used by the rig and projectile alignment checks.
 const groups=new Map();for(const part of gun.children){if(part===barrel)continue;const group=groups.get(part.material)??[];group.push(part);groups.set(part.material,group);}
 for(const [material,parts]of groups){if(parts.length<2)continue;const baked=parts.map(part=>{part.updateMatrix();let geo=part.geometry.clone();geo.applyMatrix4(part.matrix);if(geo.index){const flat=geo.toNonIndexed();geo.dispose();geo=flat;}return geo;});const geometry=new T.BufferGeometry();
  for(const attribute of['position','normal','uv']){const size=baked[0].attributes[attribute].itemSize,values=new Float32Array(baked.reduce((sum,geo)=>sum+geo.attributes[attribute].array.length,0));let offset=0;for(const geo of baked){values.set(geo.attributes[attribute].array,offset);offset+=geo.attributes[attribute].array.length;}geometry.setAttribute(attribute,new T.BufferAttribute(values,size));}
  geometry.computeBoundingSphere();const batch=new T.Mesh(geometry,material);batch.castShadow=parts[0].castShadow;batch.receiveShadow=parts[0].receiveShadow;batch.userData.ownGeometry=true;gun.add(batch);
  parts.forEach(part=>{gun.remove(part);if(part.userData.ownGeometry)part.geometry.dispose();});baked.forEach(geo=>geo.dispose());
 }
 gun.userData.barrel=barrel;gun.visible=false;return gun;
}
