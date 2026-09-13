import * as T from './assets/three.module.js';

// Alpha-tested leaf clusters keep detailed silhouettes without transparent sorting.
export function leafMaterial(texture,clock){const m=new T.MeshStandardMaterial({map:texture,color:0xb7ca8b,roughness:.86,side:T.DoubleSide,alphaTest:.42,alphaToCoverage:true});
 m.onBeforeCompile=shader=>{shader.uniforms.leafTime=clock;shader.vertexShader='uniform float leafTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec4 leafOrigin=vec4(0.0,0.0,0.0,1.0);
 #ifdef USE_INSTANCING
 leafOrigin=instanceMatrix*leafOrigin;
 #endif
 float wind=sin(leafTime*1.35+leafOrigin.x*.41+leafOrigin.z*.27);
 transformed.x+=wind*.045*(position.y+.5);
 transformed.z+=cos(leafTime*.93+leafOrigin.x*.30)*.028*(position.y+.5);`);};m.customProgramCacheKey=()=> 'oak-leaf-wind-v1';return m;
}

export function addTree(world,x,z,parent,r){
 const bark=world.mat(0x8b785d,'wood',{roughness:.95}),height=4.4+r()*1.2,base=new T.Vector3(x,0,z),top=new T.Vector3(x+.15,height,z-.1);
 const branch=(a,b,radius)=>{const mesh=world.mesh('cylinder',bark,parent),d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize());mesh.scale.set(radius,d.length(),radius);return mesh;};
 branch(base,top,.21);for(let i=0;i<5;i++){const angle=i*Math.PI*.4;branch(new T.Vector3(x+Math.cos(angle)*.6,.05,z+Math.sin(angle)*.6),new T.Vector3(x,.8,z),.10);}
 const tips=[];for(let i=0;i<9;i++){const angle=i*2.399,reach=1.1+r()*1.15,start=new T.Vector3(x,height*(.42+i*.04),z),tip=new T.Vector3(x+Math.cos(angle)*reach,height*.85+r()*1.25,z+Math.sin(angle)*reach);branch(start,tip,.07);const twig=tip.clone().add(new T.Vector3(Math.cos(angle+.8)*.7,.55,Math.sin(angle+.8)*.7));branch(tip,twig,.032);tips.push(twig);}
 const count=108,cards=new T.InstancedMesh(world.textures.foliage?world.geo.leaf:world.geo.leafPlain,world.leaves(),count),dummy=new T.Object3D();
 for(let i=0;i<count;i++){const tip=tips[i%tips.length],angle=r()*Math.PI*2,radius=Math.sqrt(r())*1.0;dummy.position.set(tip.x+Math.cos(angle)*radius,tip.y+(r()-.5)*1.2,tip.z+Math.sin(angle)*radius);dummy.rotation.set((r()-.5)*2.5,r()*Math.PI*2,(r()-.5)*1.4);dummy.scale.setScalar(.95+r()*.65);dummy.updateMatrix();cards.setMatrixAt(i,dummy.matrix);cards.setColorAt(i,new T.Color().setHSL(.22+r()*.035,.24+r()*.15,.62+r()*.22));}
 cards.castShadow=true;cards.receiveShadow=true;cards.userData.treeCards=true;cards.userData.fullCount=count;cards.computeBoundingSphere();parent.add(cards);return cards;
}

export function waterSurface(x,y,z,width,length,night,{round=false}={}){
 const geo=round?new T.CircleGeometry(width/2,64):new T.PlaneGeometry(width,length,Math.min(64,Math.ceil(width*2)),Math.min(128,Math.ceil(length*2)));geo.rotateX(-Math.PI/2);
 const material=new T.ShaderMaterial({uniforms:{clock:{value:0},night:{value:night?1:0},center:{value:new T.Vector2(x,z)},basin:{value:round?1:0}},
 vertexShader:`uniform float clock; varying vec3 waterWorld; varying vec2 waterUV;
 void main(){waterUV=uv;vec3 p=position;p.y+=.012*sin(p.x*2.4+clock*1.1)+.009*sin(p.z*3.2-clock*.8);waterWorld=(modelMatrix*vec4(p,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(waterWorld,1.0);}`,
 fragmentShader:`uniform float clock;uniform float night;uniform float basin;uniform vec2 center;varying vec3 waterWorld;varying vec2 waterUV;
 float noise(vec2 p){return sin(p.x*2.4+p.y*1.7)*sin(p.y*3.1-p.x*.4);}
 void main(){vec2 p=waterWorld.xz;float fine=noise(p*2.3+vec2(clock*.21,-clock*.17));vec3 n=normalize(vec3(-.06*cos(p.x*2.4+clock*1.1)+fine*.065,1.,-.07*cos(p.y*3.2-clock*.8)+fine*.055));vec3 eye=normalize(cameraPosition-waterWorld);float fresnel=.10+.70*pow(1.-max(0.,dot(eye,n)),4.);vec3 reflected=reflect(-eye,n);vec3 sky=mix(vec3(.40,.57,.62),vec3(.14,.32,.47),clamp(reflected.y,0.,1.));sky=mix(sky,vec3(.12,.22,.34),night*.70);vec3 deep=mix(vec3(.055,.22,.24),vec3(.035,.12,.17),night);vec3 color=mix(deep,sky,fresnel);vec3 light=normalize(vec3(-.5,.8,.4));float glint=pow(max(0.,dot(reflect(-light,n),eye)),130.);color+=mix(vec3(1.,.78,.43),vec3(.55,.71,.92),night)*glint*.9;float edge=min(min(waterUV.x,1.-waterUV.x),min(waterUV.y,1.-waterUV.y));float shore=(1.-smoothstep(.0,.035,edge))*(.35+.3*fine)*(1.-basin);float distance=length(p-center);float ripple=pow(max(0.,sin(distance*24.-clock*5.)),14.)*exp(-distance*1.4)*basin;color+=vec3(.40,.58,.60)*(shore+ripple*.22);gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});const mesh=new T.Mesh(geo,material);mesh.position.set(x,y,z);mesh.userData.ownGeometry=mesh.userData.ownMaterial=true;mesh.userData.waterSurface=true;return mesh;
}

// Water is actual curved geometry plus moving drops, separate from the stonework.
export function fountainFlow(x,z,parent,{y=.41,top=1.33,radius=.86,night=false}={}){
 const group=new T.Group(),clock={value:0};parent.add(group);group.userData.waterFlow=true;
 const mat=new T.MeshPhysicalMaterial({color:night?0x89c5e1:0xb5e4ef,roughness:.14,metalness:.12,transparent:true,opacity:.70,clearcoat:1,side:T.DoubleSide,depthWrite:false,emissive:0x315665,emissiveIntensity:.22});
 for(let i=0;i<8;i++){const angle=i*Math.PI/4;const points=[new T.Vector3(x+Math.cos(angle)*.34,top,z+Math.sin(angle)*.34),new T.Vector3(x+Math.cos(angle)*.52,top+.10,z+Math.sin(angle)*.52),new T.Vector3(x+Math.cos(angle)*radius,y+.08,z+Math.sin(angle)*radius)];const jet=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.024,6,false),mat);jet.userData.ownGeometry=true;group.add(jet);}
 const centerJet=new T.Mesh(new T.CylinderGeometry(.028,.05,.40,10),mat);centerJet.position.set(x,top+.16,z);centerJet.userData.ownGeometry=true;group.add(centerJet);centerJet.userData.ownMaterial=true;
 const count=96,positions=new Float32Array(count*3),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));const pm=new T.PointsMaterial({color:0xdaf4ff,size:.045,transparent:true,opacity:.8,depthWrite:false,sizeAttenuation:true});const drops=new T.Points(geo,pm);drops.frustumCulled=false;drops.userData.ownGeometry=drops.userData.ownMaterial=true;group.add(drops);
 const rings=[];for(let i=0;i<4;i++){const ring=new T.Mesh(new T.TorusGeometry(1,.014,5,48),new T.MeshBasicMaterial({color:0xa9d7e0,transparent:true,opacity:.35,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,y+.012,z);ring.userData.ownGeometry=ring.userData.ownMaterial=true;group.add(ring);rings.push(ring);}
 const update=time=>{clock.value=time;for(let i=0;i<count;i++){const angle=i*2.399,phase=(time*(.65+(i%5)*.04)+i*.618)%1,reach=.38+(radius-.38)*phase;positions[i*3]=x+Math.cos(angle)*reach;positions[i*3+1]=top+.07*Math.sin(phase*Math.PI)-(top-y)*phase*phase;positions[i*3+2]=z+Math.sin(angle)*reach;}geo.attributes.position.needsUpdate=true;rings.forEach((ring,i)=>{const p=(time*.40+i*.25)%1;ring.scale.setScalar(.18+p*radius);ring.material.opacity=(1-p)*.3;});};update(0);return {group,update,position:{x,y:top,z}};
}
