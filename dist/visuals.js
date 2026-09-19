import * as T from './assets/three.module.js';
export function roundedBox(radius=.05,segments=3){const g=new T.BoxGeometry(1,1,1,segments,segments,segments),p=g.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),inner=v.clone().clampScalar(-.5+radius,.5-radius),n=v.clone().sub(inner).normalize().multiplyScalar(radius);p.setXYZ(i,inner.x+n.x,inner.y+n.y,inner.z+n.z);}g.computeVertexNormals();return g;}
export function potatoGeometry(){const g=new T.SphereGeometry(1,64,48),pos=g.attributes.position;for(let i=0;i<pos.count;i++){let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const wave=1+.014*Math.sin(x*8+y*4)*Math.sin(z*7-y*3)+.009*Math.cos(y*11+z*6);pos.setXYZ(i,x*wave*(1-.095*y),y*wave,z*wave*(1+.04*y));}g.computeVertexNormals();return g;}
export function applyWorldUV(material,scale=.48){material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSurfaceWorld;\nvarying vec3 vSurfaceNormal;').replace('#include <begin_vertex>',`#include <begin_vertex>
vec4 surfacePosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
surfacePosition = instanceMatrix * surfacePosition;
#endif
vSurfaceWorld = (modelMatrix * surfacePosition).xyz;
vSurfaceNormal = inverseTransformDirection(transformedNormal, viewMatrix);`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSurfaceWorld;\nvarying vec3 vSurfaceNormal;').replace('#include <map_fragment>',`#ifdef USE_MAP
vec3 blendWeight = pow(abs(normalize(vSurfaceNormal)), vec3(5.0));
blendWeight /= max(dot(blendWeight, vec3(1.0)), 0.0001);
vec4 surfaceTexel = texture2D(map, vSurfaceWorld.zy * ${scale.toFixed(4)}) * blendWeight.x
 + texture2D(map, vSurfaceWorld.xz * ${scale.toFixed(4)}) * blendWeight.y
 + texture2D(map, vSurfaceWorld.xy * ${scale.toFixed(4)}) * blendWeight.z;
float pmHeight=dot(surfaceTexel.rgb,vec3(.299,.587,.114));
diffuseColor *= surfaceTexel;
#endif`).replace('#include <normal_fragment_maps>',`#ifdef USE_BUMPMAP
 normal = perturbNormalArb(-vViewPosition, normal, vec2(dFdx(pmHeight),dFdy(pmHeight))*bumpScale,faceDirection);
#endif`);};material.customProgramCacheKey=()=>`potatoman-world-uv-${scale}`;return material;}
export function makeSky(night,storm=false){const m=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(night?0x081327:storm?0x364657:0x4694c2)},horizon:{value:new T.Color(night?0x536888:storm?0x9ca5a0:0xf8cda3)},sunDir:{value:new T.Vector3(-.5,.65,.4).normalize()},night:{value:night?1:0}},vertexShader:'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec3 vDirection;uniform vec3 top;uniform vec3 horizon;uniform vec3 sunDir;uniform float night;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
void main(){vec3 d=normalize(vDirection);float h=pow(max(d.y,0.0),.55);vec3 c=mix(horizon,top,h);float sun=pow(max(dot(d,sunDir),0.0),350.0);c+=vec3(1.0,.74,.4)*sun*(1.0-night)*1.2;vec2 p=d.xz/max(d.y+.3,.08)*3.0;float n=noise(p)*.6+noise(p*2.2)*.27+noise(p*4.5)*.13;float cloud=smoothstep(.55,.78,n)*smoothstep(.02,.35,d.y);c=mix(c,mix(vec3(.97,.93,.87),vec3(.19,.25,.37),night),cloud*.65);
float starField=hash(floor(d.xz*380.0+d.y*151.0));float twinkle=hash(floor(d.xz*380.0+d.y*151.0)+vec2(11.0));float star=step(0.9975,starField)*(.55+.45*twinkle)*night*smoothstep(0.02,0.4,d.y)*(1.0-cloud);c+=vec3(star);
gl_FragColor=vec4(c,1.0);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});const mesh=new T.Mesh(new T.SphereGeometry(140,32,20),m);mesh.frustumCulled=false;mesh.userData.ownGeometry=true;mesh.userData.ownMaterial=true;return mesh;}
export function ambientDust(count=140,radius=26,riseHeight=5.5){
 const positions=new Float32Array(count*3),phases=new Float32Array(count);
 for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*radius;positions[i*3]=Math.cos(a)*r;positions[i*3+1]=.5+Math.random()*riseHeight;positions[i*3+2]=Math.sin(a)*r;phases[i]=Math.random()*Math.PI*2;}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('phase',new T.BufferAttribute(phases,1));
 const material=new T.PointsMaterial({color:0xfff2d4,size:.05,transparent:true,opacity:.32,depthWrite:false,sizeAttenuation:true});
 material.onBeforeCompile=shader=>{const dustTime={value:0};material.userData.dustTime=dustTime;shader.uniforms.dustTime=dustTime;
  shader.vertexShader='attribute float phase;\nuniform float dustTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=sin(dustTime*.4+phase)*.55;transformed.x+=cos(dustTime*.22+phase*1.7)*.4;transformed.z+=sin(dustTime*.18+phase*2.3)*.4;');
 };material.customProgramCacheKey=()=>'ambient-dust-v1';
 const points=new T.Points(geo,material);points.frustumCulled=false;points.userData.ownGeometry=true;points.userData.ownMaterial=true;return points;
}
export function curveTube(points,r=.025){return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,r,8,false);}
// The klomp's outline and the numbers the extrusion uses, in one place. `clogProfile` reads them
// back so painted decoration can be laid on the shoe's real surface instead of at heights measured
// against a picture of it -- which is how a tulip spray and beaded borders ended up inside the wood.
// A klomp on the cover is a deep chunky block of wood, not a slipper: the body is nearly as tall
// as the shoe is wide. Everything painted on it is placed from this profile, so deepening the
// shoe moves the decoration with it.
const CLOG={depth:.295,bevel:.065,toeStart:.24,toeSpan:.68,toeLift:.30};
function clogShape(){const shape=new T.Shape();shape.moveTo(-.115,-.33);
 shape.bezierCurveTo(-.228,-.29,-.252,.10,-.216,.34);
 shape.bezierCurveTo(-.198,.56,-.158,.78,-.092,.885);
 shape.quadraticCurveTo(0,.975,.092,.885);
 shape.bezierCurveTo(.158,.78,.198,.56,.216,.34);
 shape.bezierCurveTo(.252,.10,.228,-.29,.115,-.33);
 shape.quadraticCurveTo(0,-.385,-.115,-.33);return shape;}
// The shoe's own top surface, read off the triangles it is actually built from. Every earlier
// attempt described it with a formula -- the extrusion depth plus the toe's upsweep -- and every
// one of them was wrong somewhere, because the bevel rounds the cap away near its edges and the
// cap itself is a ruled surface between outline vertices. Painted work placed against those
// formulas came out inside the wood, which is how a klomp the code describes as carrying a tulip
// spray and a bordered instep arrived on screen plain yellow. This is measured instead: for each
// triangle, the cells of a grid it covers take its plane height, highest wins. It cannot drift from
// the geometry, because it is the geometry.
const GRID={x0:-.36,x1:.36,z0:-.50,z1:1.10,y0:-.12,y1:.80,nx:49,nz:97,ny:61};
export function clogProfile(g=clogGeometry()){
 const cell=(i,j)=>i*GRID.nz+j,height=new Float32Array(GRID.nx*GRID.nz).fill(-Infinity);
 const dx=(GRID.x1-GRID.x0)/(GRID.nx-1),dz=(GRID.z1-GRID.z0)/(GRID.nz-1),pos=g.attributes.position,index=g.index;
 const count=index?index.count:pos.count,at=k=>index?index.getX(k):k;
 for(let t=0;t<count;t+=3){
  const a=at(t),b=at(t+1),c=at(t+2);
  const ax=pos.getX(a),ay=pos.getY(a),az=pos.getZ(a),bx=pos.getX(b),by=pos.getY(b),bz=pos.getZ(b),cx=pos.getX(c),cy=pos.getY(c),cz=pos.getZ(c);
  const area=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);if(Math.abs(area)<1e-9)continue;
  const i0=Math.max(0,Math.floor((Math.min(ax,bx,cx)-GRID.x0)/dx)),i1=Math.min(GRID.nx-1,Math.ceil((Math.max(ax,bx,cx)-GRID.x0)/dx));
  const j0=Math.max(0,Math.floor((Math.min(az,bz,cz)-GRID.z0)/dz)),j1=Math.min(GRID.nz-1,Math.ceil((Math.max(az,bz,cz)-GRID.z0)/dz));
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
   const x=GRID.x0+i*dx,z=GRID.z0+j*dz;
   const w0=((bx-x)*(cz-z)-(bz-z)*(cx-x))/area,w1=((cx-x)*(az-z)-(cz-z)*(ax-x))/area,w2=1-w0-w1;
   if(w0<-.02||w1<-.02||w2<-.02)continue;
   const y=w0*ay+w1*by+w2*cy,k=cell(i,j);if(y>height[k])height[k]=y;
  }
 }
 // A point between samples takes the highest of the four around it: paint riding a hair high is
 // paint you can see, and paint a hair low is paint that is not there at all.
 const top=(x,z)=>{const fi=(x-GRID.x0)/dx,fj=(z-GRID.z0)/dz;let best=-Infinity;
  for(const i of[Math.floor(fi),Math.ceil(fi)])for(const j of[Math.floor(fj),Math.ceil(fj)]){
   if(i<0||j<0||i>=GRID.nx||j>=GRID.nz)continue;const y=height[cell(i,j)];if(y>best)best=y;}
  return Number.isFinite(best)?best:CLOG.depth+CLOG.bevel;};
 // The side wall, measured the same way: how far out the wood is at a given height and point along
 // the shoe. The outline's own half-width is only right at the wall's fattest point, so beads, nails
 // and painted bands set below that line were sitting inside it.
 const wide=new Float32Array(GRID.ny*GRID.nz).fill(-Infinity),dy=(GRID.y1-GRID.y0)/(GRID.ny-1),wcell=(i,j)=>i*GRID.nz+j;
 for(let t=0;t<count;t+=3){
  const a=at(t),b=at(t+1),c=at(t+2);
  const ay=pos.getY(a),az=pos.getZ(a),by=pos.getY(b),bz=pos.getZ(b),cy=pos.getY(c),cz=pos.getZ(c);
  const area=(by-ay)*(cz-az)-(bz-az)*(cy-ay);if(Math.abs(area)<1e-9)continue;
  const ax=Math.abs(pos.getX(a)),bx=Math.abs(pos.getX(b)),cx=Math.abs(pos.getX(c));
  const i0=Math.max(0,Math.floor((Math.min(ay,by,cy)-GRID.y0)/dy)),i1=Math.min(GRID.ny-1,Math.ceil((Math.max(ay,by,cy)-GRID.y0)/dy));
  const j0=Math.max(0,Math.floor((Math.min(az,bz,cz)-GRID.z0)/dz)),j1=Math.min(GRID.nz-1,Math.ceil((Math.max(az,bz,cz)-GRID.z0)/dz));
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
   const y=GRID.y0+i*dy,z=GRID.z0+j*dz;
   const w0=((by-y)*(cz-z)-(bz-z)*(cy-y))/area,w1=((cy-y)*(az-z)-(cz-z)*(ay-y))/area,w2=1-w0-w1;
   if(w0<-.02||w1<-.02||w2<-.02)continue;
   const x=w0*ax+w1*bx+w2*cx,k=wcell(i,j);if(x>wide[k])wide[k]=x;
  }
 }
 // Below the wall, where the sole rounds away, there is no wood at that height at all. Returning
 // zero there quietly moved whatever was being placed onto the shoe's centre line and buried it, so
 // a miss climbs until it finds wall rather than answering with the middle of the shoe.
 const wall=(y,z)=>{const fj=(z-GRID.z0)/dz;
  for(let step=0;step<GRID.ny;step++){const fi=(y-GRID.y0)/dy+step;let best=-Infinity;
   for(const i of[Math.floor(fi),Math.ceil(fi)])for(const j of[Math.floor(fj),Math.ceil(fj)]){
    if(i<0||j<0||i>=GRID.ny||j>=GRID.nz)continue;const x=wide[wcell(i,j)];if(x>best)best=x;}
   if(Number.isFinite(best)&&best>0)return best;}
  return 0;};
 return{top,wall};
}
export function clogGeometry(){
 // A klomp the shape of the one on the cover: narrow heel, widest at the ball of the foot, and a
 // blunt rounded nose that sweeps up hard. It was drawn to a long point before, which is a clog
 // from a souvenir shop rather than one somebody stands in -- a real klompen's toe is a rounded
 // scoop, and the upsweep is what carries the painted work into view.
 const g=new T.ExtrudeGeometry(clogShape(),{depth:CLOG.depth,bevelEnabled:true,bevelThickness:CLOG.bevel,bevelSize:.042,bevelSegments:6,steps:1,curveSegments:24});g.rotateX(-Math.PI/2);g.rotateY(Math.PI);
 const p=g.attributes.position;for(let i=0;i<p.count;i++){const toe=Math.max(0,Math.min(1,(p.getZ(i)-CLOG.toeStart)/CLOG.toeSpan));p.setY(i,p.getY(i)+CLOG.toeLift*toe);}g.computeVertexNormals();return g;
}
