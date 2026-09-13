import assert from 'node:assert/strict';
import {World} from '../dist/world.js';
import {LEVELS,makeMap,rng,boxContact3D,movePlayer,slideMove,route,STEP} from '../dist/core.js';
// Differential check protects the camera, projectile and audio slab optimization.
function reference(ax,ay,az,bx,by,bz,w,pad=0){let lo=0,hi=1;for(const[a,b,c,size]of[[ax,bx,w.x,w.w],[ay,by,(w.base??0)+w.h/2,w.h],[az,bz,w.z,w.d]]){const d=b-a,min=c-size/2-pad,max=c+size/2+pad;if(Math.abs(d)<1e-9){if(a<min||a>max)return Infinity;}else{let t1=(min-a)/d,t2=(max-a)/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return Infinity;}}return lo;}
const random=rng(1107),coord=()=>random()*30-15;
for(let i=0;i<20000;i++){const a=[coord(),coord(),coord()],b=a.map(v=>i%7===0?v:coord()),w={x:coord(),z:coord(),w:random()*9,d:random()*9,h:random()*6,...(i%3?{base:coord()}:{})},args=[...a,...b,w,random()*.5];assert.equal(boxContact3D(...args),reference(...args));}
console.log('PASS allocation-free collision matches prior solver for 20,000 seeded parallel, elevated and padded cases');
const canal=LEVELS.find(l=>l.theme==='canal'),map=makeMap(canal),mid=Math.floor(map.n/2);
assert.equal(map.bridgeRails.length,6);assert.ok(map.bridgeRails.every(r=>map.walls.includes(r)));
const player=(x,z)=>({x,z,y:0,vx:0,vz:0,vy:0,grounded:true,respawn:0,runner:false,crouching:false,dashTime:0});
for(const cell of[3,mid,map.n-4]){const {x}=map.toWorld(cell,mid);
 for(const side of[-1,1])for(const crouch of[false,true])for(const dash of[false,true])for(const z of[-4.3,0,4.3]){const p=player(x,z);if(dash)Object.assign(p,{dashTime:1,dashX:side,dashZ:0});for(let i=0;i<120;i++){movePlayer(p,{x:side,z:0,crouch},STEP,map);assert.equal(p.inWater,false);assert.ok(Math.abs(p.x-x)<1.01,'rail stops the body before the water edge');}}
 for(const sign of[-1,1]){const p=player(x,-sign*6);for(let i=0;i<300;i++){movePlayer(p,{x:0,z:sign},STEP,map);assert.equal(p.inWater,false);}assert.ok(sign*p.z>6,'bridge remains open end to end');}
 const p=player(x,-6);for(const next of route(map,p,{x,z:6}).slice(1)){slideMove(p,next.x-p.x,next.z-p.z,map.walls);assert.ok(Math.hypot(p.x-next.x,p.z-next.z)<1e-5);}
 const rail=map.bridgeRails.find(r=>r.x>x&&r.x<x+2);assert.equal(boxContact3D(x,.5,0,x+3,.5,0,rail),Infinity);assert.ok(Number.isFinite(boxContact3D(x,1.07,0,x+3,1.07,0,rail)));
}
const huntMap=makeMap(canal,true);assert.equal(huntMap.bridgeRails.length,6);assert.ok(huntMap.bridgeRails.every(r=>huntMap.walls.includes(r)),'harbour hunts retain protected crossings');
console.log('PASS all three bridges block walking/crouching/dashing off both sides, retain crossings and navigation, and match rail shot height');
let resizes=0,ratio=1.5;
const render={setPixelRatio(v){ratio=v;resizes++;}};
globalThis.devicePixelRatio=2;
const adaptive=Object.assign(Object.create(World.prototype),{qualityMode:'high',pixelRatio:1.5,renderer:render});
for(let i=0;i<24;i++)adaptive.balanceResolution(i%2?60:54);assert.equal(resizes,0,'alternating frame rate must not resize the canvas');
adaptive.balanceResolution(40);adaptive.balanceResolution(40);assert.equal(resizes,1);assert.equal(ratio,1.4);
for(let i=0;i<6;i++)adaptive.balanceResolution(60);assert.equal(resizes,2);assert.equal(ratio,1.45);
adaptive.qualityMode='cinematic';for(let i=0;i<20;i++)adaptive.balanceResolution(30);assert.equal(resizes,2,'cinematic resolution remains fixed');
console.log('PASS sustained frame signals resize once, noisy samples do not oscillate, and Cinematic stays fixed');
