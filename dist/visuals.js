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
void main(){vec3 d=normalize(vDirection);float h=pow(max(d.y,0.0),.55);vec3 c=mix(horizon,top,h);float sun=pow(max(dot(d,sunDir),0.0),350.0);c+=vec3(1.0,.74,.4)*sun*(1.0-night)*1.2;vec2 p=d.xz/max(d.y+.3,.08)*3.0;float n=noise(p)*.6+noise(p*2.2)*.27+noise(p*4.5)*.13;float cloud=smoothstep(.55,.78,n)*smoothstep(.02,.35,d.y);c=mix(c,mix(vec3(.97,.93,.87),vec3(.19,.25,.37),night),cloud*.65);gl_FragColor=vec4(c,1.0);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});const mesh=new T.Mesh(new T.SphereGeometry(140,32,20),m);mesh.frustumCulled=false;mesh.userData.ownGeometry=true;mesh.userData.ownMaterial=true;return mesh;}
export function curveTube(points,r=.025){return new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,r,8,false);}
export function clogGeometry(){
 const shape=new T.Shape();shape.moveTo(-.145,-.29);shape.bezierCurveTo(-.26,-.25,-.28,.13,-.225,.34);shape.bezierCurveTo(-.19,.52,-.065,.73,0,.78);shape.bezierCurveTo(.065,.73,.19,.52,.225,.34);shape.bezierCurveTo(.28,.13,.26,-.25,.145,-.29);shape.quadraticCurveTo(0,-.34,-.145,-.29);
 const g=new T.ExtrudeGeometry(shape,{depth:.20,bevelEnabled:true,bevelThickness:.065,bevelSize:.045,bevelSegments:6,steps:1,curveSegments:24});g.rotateX(-Math.PI/2);g.rotateY(Math.PI);
 const p=g.attributes.position;for(let i=0;i<p.count;i++){const toe=Math.max(0,Math.min(1,(p.getZ(i)-.28)/.50));p.setY(i,p.getY(i)+.14*toe*toe);}g.computeVertexNormals();return g;
}
