import {mapId} from './map-catalogue.js';
import {bodyHeight,updateStance,STANDING_HEIGHT} from './stance.js';
export const STEP=1/120, CELL=3.2, ROUND_TIME=120, BONUS_TIME=40;
// Half the gravity applied to a thrown potato. A hand-thrown spud is lobbed, not fired: this is
// what gives it a visible arc to lead with, and every launch solver below derives from it, so the
// crosshair keeps converging on the same point the potato actually reaches.
export const THROW_DROP=5.4;
export const LEVELS=[
 {name:'Market Mayhem',tag:'VILLAGE • DAY',mode:'battle',size:15,theme:'market',seed:11,detail:'Fight through the town streets. Flank around the buildings and contest weapon drops in the market.',skill:'Move · aim · dodge'},
 {name:'Hedge Your Bets',tag:'GARDENS • DAY',mode:'race',size:15,theme:'hedge',seed:32,detail:'Fastest complete escape wins. Follow the landmarks, then improve your route.',skill:'Find the fastest route'},
 {name:'King of the Crop',tag:'ALLOTMENTS • GOLDEN HOUR',mode:'capture',size:17,theme:'garden',seed:48,detail:'Cut through hedge courtyards to hold the golden crop circle. A contested zone earns no points.',skill:'Control space'},
 {name:'Harvest Havoc',tag:'FARMYARD • SUNSET',mode:'smash',size:17,theme:'fair',seed:53,detail:'Fight around barns and hay stacks. Break the marked harvest crates before your opponents do.',skill:'Aim under pressure'},
 {name:'A-maize-ing Escape',tag:'FARMLAND • AFTERNOON',mode:'race',size:19,theme:'corn',seed:71,detail:'Longer paths and more dead ends. Keep your bearings.',skill:'Route memory'},
 {name:'Canal Carnage',tag:'CANALSIDE • DUSK',mode:'battle',size:19,theme:'canal',seed:82,detail:'Cross three bridges between moonlit quays. Use the warehouses for cover and stay out of the water.',skill:'Lead moving targets'},
 {name:'Quayside Domination',tag:'HARBOUR • NIGHT',mode:'capture',size:21,theme:'depot',seed:96,detail:'Fight between containers for a moving control zone.',skill:'Rotate and intercept'},
 {name:'The Butter Run',tag:'HARBOUR ASSAULT COURSE • SUNSET',mode:'assault',size:21,theme:'course',seed:114,detail:'Jump onto each numbered platform, duck through the three low gates, then reach the exit. Fastest completed run wins.',skill:'Jump · land · keep momentum'},
 {name:'The Midnight Maze',tag:'OLD TOWN • NIGHT',mode:'race',size:23,theme:'night',seed:129,detail:'Twisting brick alleys and longer routes. Fastest complete escape wins.',skill:'Navigate under pressure'},
 {name:'Quarry Quarrel',tag:'CHALK QUARRY • OVERCAST',mode:'battle',size:19,theme:'quarry',seed:157,detail:'Fight across the cutting floor. Stone blocks give cover; the gantry lane is the fast flank.',skill:'Use hard cover'},
 {name:'Cider Run',tag:'ORCHARD • MORNING',mode:'race',size:25,theme:'grove',seed:152,detail:'Race the mown lanes between fruit rows. Fastest complete escape wins.',skill:'Read the rows'},
 {name:'Stone Cold Smash',tag:'CUTTING FLOOR • AFTERNOON',mode:'smash',size:19,theme:'pit',seed:181,detail:'Break the marked blocks stacked around the cutting floor before your rivals do.',skill:'Pick your target'},
 {name:'Orchard Ambush',tag:'CIDER ORCHARD • GOLDEN HOUR',mode:'capture',size:21,theme:'orchard',seed:194,detail:'Hold the pressing yard while rivals close in through the fruit rows.',skill:'Hold and rotate'},
 {name:'The Final Mash',tag:'FORTRESS GARDEN • STORM',mode:'race',size:27,theme:'fort',seed:143,detail:'The longest maze and the quickest rivals. One final escape.',skill:'Bring it all together'}
];
export const MODES={battle:'TOTALLY MASH',race:'MAZE RACE',assault:'BUTTER RUN · TIME TRIAL',capture:'KING OF THE CROP',smash:'BANGERS & SMASH'};
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function makeMap(level,bonus=false){
 const n=bonus?17:level.size,r=rng(level.seed+(bonus?907:0)),grid=Array.from({length:n},()=>Array(n).fill(1));
 if(level.mode==='race'&&!bonus){
  const stack=[[1,n-2]];grid[n-2][1]=0;
  while(stack.length){const [x,z]=stack.at(-1),next=[[2,0],[-2,0],[0,2],[0,-2]].map(([a,b])=>[x+a,z+b]).filter(([a,b])=>a>0&&b>0&&a<n-1&&b<n-1&&grid[b][a]);
   if(!next.length){stack.pop();continue;}const [a,b]=next[Math.floor(r()*next.length)];grid[(z+b)/2][(x+a)/2]=0;grid[b][a]=0;stack.push([a,b]);
  }
  // Identical start and finish spaces for all racers.
  for(let z=n-3;z<n-1;z++)for(let x=1;x<4;x++)grid[z][x]=0;
 }else{
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++)grid[z][x]=0;
  const put=(x,z)=>{if(x>1&&z>1&&x<n-2&&z<n-2)grid[z][x]=1;},m=Math.floor(n/2);
  if(bonus){for(let z=3;z<n-3;z+=3)for(let x=3;x<n-3;x+=3)if(r()<.7){put(x,z);if(r()<.5)put(x+1,z);}}
  else if(level.mode==='assault'){}
  else if(level.theme==='market'){for(const [x,z]of[[4,4],[n-5,4],[4,n-5],[n-5,n-5]]){put(x,z);put(x+1,z);put(x,z+1);}}
  else if(level.theme==='garden'){for(let z=3;z<n-3;z+=3)for(let x=3;x<n-3;x+=4){put(x,z);put(x+1,z);}}
  else if(level.theme==='canal'){for(const z of[m-3,m+3])for(let x=3;x<n-3;x++)if(![4,m,n-5].includes(x))put(x,z);for(const x of[4,n-5]){put(x,m-1);put(x,m+1);}}
  else if(level.theme==='depot'){for(let z=3;z<n-3;z+=4)for(let x=3;x<n-3;x+=4){put(x,z);put(x,z+1);put(x+1,z);put(x+1,z+1);}}
  else if(level.theme==='shop'){for(let z=4;z<n-4;z+=3)for(let x=3;x<n-3;x++)if(x%6!==0&&x%6!==1)put(x,z);}
  else if(level.theme==='fair'){for(const [dx,dz]of[[-4,-4],[0,-4],[4,-4],[-4,0],[4,0],[-4,4],[0,4],[4,4]]){put(m+dx,m+dz);if(dx)put(m+dx,m+dz+1);}}
  else for(let z=3;z<n-3;z+=3)for(let x=3;x<n-3;x+=3)if(r()<.76){put(x,z);if(r()<.5)put(x+1,z);}
  if(level.remix&&!bonus&&level.mode!=='assault'&&!['market','canal','garden'].includes(level.theme))for(let k=0;k<n/2;k++){const x=3+Math.floor(r()*(n-6)),z=3+Math.floor(r()*(n-6));put(x,z);}
  const mid=Math.floor(n/2);for(let i=1;i<n-1;i++){grid[mid][i]=0;grid[i][mid]=0;}
 }
 if(level.mode!=='race'||bonus)for(const [cx,cz]of[[2,2],[n-3,n-3],[n-3,2],[2,n-3]])for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)grid[cz+dz][cx+dx]=0;
 const toWorld=(x,z)=>({x:(x-(n-1)/2)*CELL,z:(z-(n-1)/2)*CELL});
 const toCell=(x,z)=>({x:Math.max(0,Math.min(n-1,Math.round(x/CELL+(n-1)/2))),z:Math.max(0,Math.min(n-1,Math.round(z/CELL+(n-1)/2)))});
 const buildings=[],waterCells=[],props=[],family=mapId(level);
 if(bonus||!isTrial(level)){
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++)grid[z][x]=0;
  const mid=Math.floor(n/2),addProp=(cx,cz,type,h=1.3,size=2.5)=>{grid[cz][cx]=1;props.push({...toWorld(cx,cz),w:size,d:size,h,prop:type});};
  if(family==='estate'){
   for(const [cx,cz]of[[4,4],[n-5,4],[4,n-5],[n-5,n-5]])for(let j=-1;j<=1;j++){grid[cz-1][cx+j]=1;grid[cz+1][cx+j]=1;grid[cz][cx-1]=1;grid[cz][cx+1]=1;}
   for(const [x,z]of[[4,5],[n-5,3],[3,n-5],[n-4,n-5]])grid[z][x]=0;
  }else{
   const blocks=family==='harbour'?[[5,4],[n-7,4],[5,n-6],[n-7,n-6]]:[[4,4],[n-6,4],[4,n-6],[n-6,n-6]];
   for(const [x,z]of blocks){for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++)grid[z+dz][x+dx]=1;buildings.push({...toWorld(x+.5,z+.5),w:CELL*2,d:CELL*2,h:family==='farm'?4.2:family==='harbour'?5.8:5.2,architecture:true,kind:family});}
   if(family==='harbour'){const bridges=[3,mid,n-4];for(let z=mid-1;z<=mid+1;z++)for(let x=1;x<n-1;x++)if(!bridges.includes(x)){grid[z][x]=2;waterCells.push(toWorld(x,z));}}
   if(family==='village')for(const x of[mid-2,mid+2])for(const z of[mid-1,mid+1])addProp(x,z,'marketStall',2.2);
   if(family==='village')for(const x of[4,n-5])for(const z of[6,n-7])addProp(x,z,'bin',1.45,1.1);
   if(family==='harbour')for(const x of[5,n-6])for(const z of[6,n-7])addProp(x,z,'cargo',1.8);
   if(family==='farm')for(const x of[mid-3,mid+3])for(const z of[mid-1,mid+1])addProp(x,z,'hay',1.25);
   // Cut blocks on the quarry floor and pressing barrels in the orchard yard give each new
   // world its own hard cover, placed on the same authored grid as the other families.
   if(family==='quarry'){for(const x of[mid-3,mid+3])for(const z of[mid-2,mid+2])addProp(x,z,'stoneBlock',1.75,2.6);for(const x of[5,n-6])for(const z of[6,n-7])addProp(x,z,'spoil',1.2,2.4);}
   if(family==='orchard'){for(const x of[mid-3,mid+3])for(const z of[mid-1,mid+1])addProp(x,z,'cider',1.35,2.3);for(const x of[4,n-5])for(const z of[6,n-7])addProp(x,z,'crateStack',1.5,2.2);}
  }
 }
 if(bonus){for(const [cx,cz] of [[3,3],[n-4,n-4],[Math.floor(n/2),n-3]])for(const[dx,dz]of[[0,0],[1,0],[-1,0],[0,1],[0,-1]])grid[cz+dz][cx+dx]=0;}
 const fountain=!bonus&&level.theme==='garden'?{...toWorld(Math.floor(n/2),3),w:2.5,d:2.5,h:1.35,prop:'fountain'}:null;if(fountain)grid[3][Math.floor(n/2)]=1;
 const walls=[...buildings,...props];let cover=0;for(let z=0;z<n;z++)for(let x=0;x<n;x++)if(grid[z][x]===1){const p=toWorld(x,z);if(props.some(w=>w.x===p.x&&w.z===p.z))continue;if(fountain&&p.x===fountain.x&&p.z===fountain.z){walls.push(fountain);continue;}if(buildings.some(b=>Math.abs(p.x-b.x)<b.w/2&&Math.abs(p.z-b.z)<b.d/2))continue;const interior=x>1&&x<n-2&&z>1&&z<n-2,w={...p,w:CELL,d:CELL,h:2.65};if(interior&&!isTrial(level)&&!bonus&&!['garden','market','canal'].includes(level.theme)){w.h=1.65;if(cover++%3===0)Object.assign(w,{prop:'bin',w:1.1,d:1.1,h:1.45});}else if(interior&&family==='estate')w.h=1.8;walls.push(w);}
 // The visible bridge handrails block bodies, while shots can pass underneath.
 const bridgeRails=[];if(waterCells.length){const mid=Math.floor(n/2);for(const cell of[3,mid,n-4])for(const side of[-1,1])bridgeRails.push({x:toWorld(cell,mid).x+side*1.42,z:0,w:.07,d:9.7,base:1.03,h:.08,prop:'bridgeRail'});walls.push(...bridgeRails);}
 // Harvest targets belong to loading rows beside the barns, with open routes between them.
 const targetSpots=!bonus&&level.mode==='smash'?[[4,3],[5,3],[n-6,3],[n-5,3],[4,n-4],[5,n-4],[n-6,n-4],[n-5,n-4],[3,4],[3,5],[n-4,4],[n-4,5],[3,n-6],[n-4,n-6]].filter(([x,z])=>grid[z]?.[x]===0).map(([x,z])=>toWorld(x,z)):[];
 const map={n,grid,walls,buildings,props,targetSpots,worldId:family,waterCells,bridgeRails,toWorld,toCell,start:toWorld(1,n-2),exit:toWorld(n-2,1),platforms:[],course:[]};
 if(level.mode==='assault'&&!bonus){
  const flip=level.seed%2?1:-1,span=(n-5)*CELL*.5;
  map.start={x:-span*flip,z:span};
  const points=[[-span,span-5],[-span+3,span-5],[-span+6,span-5],[0,span-5],[span,span-5],[span,1],[span-3,1],[span-6,1],[0,1],[-span,1],[-span,-span+3],[-span+3,-span+3],[-span+6,-span+3],[0,-span+3],[span,-span+3]];
  map.course=points.map(([x,z],i)=>({x:x*flip,z,h:[.55,1.05,1.55,0,0,.55,1.05,1.55,0,0,.65,1.15,1.65,0,0][i],index:i}));
  for(const i of[3,8,13]){map.course[i].duck=true;map.course[i].direction=i===8?-flip:flip;}
  map.platforms=map.course.filter(c=>c.h>0).map(c=>({...c,w:2.4,d:2.4,platform:true}));
  for(const [x,z]of[[span*.5,span-5],[-span*.5,1],[span*.5,-span+3]])map.platforms.push({x:x*flip,z,w:.45,d:3.4,h:.65+(level.seed%3)*.1,hurdle:true,platform:true});
  for(const c of map.course.filter(c=>c.duck)){map.platforms.push({x:c.x,z:c.z,w:2.5,d:3.6,base:1.76,h:.30,duckRoof:true,platform:true});for(const side of[-1,1])map.platforms.push({x:c.x,z:c.z+side*1.87,w:.18,d:.18,h:2.06,duckPost:true,platform:true});}
  map.exit={x:span*flip,z:-span};
 }
 return map;
}
// BFS expansion order decides which of the equally-short paths comes back. Rotating it per
// bot spreads them across parallel lanes instead of filing down one identical groove.
const DIR_ORDERS=[[[1,0],[-1,0],[0,1],[0,-1]],[[0,1],[0,-1],[1,0],[-1,0]],[[-1,0],[1,0],[0,-1],[0,1]],[[0,-1],[0,1],[-1,0],[1,0]],[[1,0],[0,1],[-1,0],[0,-1]],[[0,-1],[-1,0],[0,1],[1,0]]];
export function route(map,start,end,variant=0){
 const originalStart=map.toCell(start.x,start.z),originalEnd=map.toCell(end.x,end.z);
 const resolve=pos=>{const c=map.toCell(pos.x,pos.z);if(map.grid[c.z]?.[c.x]===0)return c;let candidates=[];for(let z=Math.max(1,c.z-2);z<=Math.min(map.n-2,c.z+2);z++)for(let x=Math.max(1,c.x-2);x<=Math.min(map.n-2,c.x+2);x++){if(map.grid[z][x]!==0)continue;const w=map.toWorld(x,z);if(!map.walls.some(wall=>segmentBox(pos.x,pos.z,w.x,w.z,wall,.42)))candidates.push({x,z,d:Math.hypot(pos.x-w.x,pos.z-w.z)});}return candidates.sort((a,b)=>a.d-b.d)[0]??null;};
 const a=resolve(start),b=resolve(end);if(!a||!b)return[];const queue=[a],seen=new Map([[a.x+','+a.z,null]]);let goal=null;
 for(let i=0;i<queue.length;i++){let p=queue[i],key=p.x+','+p.z;if(p.x===b.x&&p.z===b.z){goal=key;break;}
 for(const [dx,dz]of DIR_ORDERS[((variant%DIR_ORDERS.length)+DIR_ORDERS.length)%DIR_ORDERS.length]){const x=p.x+dx,z=p.z+dz,k=x+','+z;if(map.grid[z]?.[x]===0&&!seen.has(k)){seen.set(k,key);queue.push({x,z});}}}
 if(!goal)return[];const path=[];while(goal){const [x,z]=goal.split(',').map(Number);path.push(map.toWorld(x,z));goal=seen.get(goal);}path.reverse();if(map.grid[originalStart.z]?.[originalStart.x]!==0)path.unshift({x:start.x,z:start.z});if(map.grid[originalEnd.z]?.[originalEnd.x]!==0)path.push({x:end.x,z:end.z});return path;
}
export function blocked(x,z,r,walls,y=0,height=STANDING_HEIGHT){return walls.some(w=>y<(w.base??0)+(w.h??2.65)-.035&&y+height>(w.base??0)+.025&&Math.abs(x-w.x)<w.w/2+r&&Math.abs(z-w.z)<w.d/2+r);}
export function slideMove(p,dx,dz,walls,r=.42){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
 for(let i=0;i<steps;i++){if(!blocked(p.x+dx/steps,p.z,r,walls,p.y??0,bodyHeight(p)))p.x+=dx/steps;if(!blocked(p.x,p.z+dz/steps,r,walls,p.y??0,bodyHeight(p)))p.z+=dz/steps;}
}
export function movement(p,input,dt,walls,speed=6){
 let x=input.x,z=input.z;const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
 const response=1-Math.exp(-28*dt);p.vx+=(x*speed-p.vx)*response;p.vz+=(z*speed-p.vz)*response;
 slideMove(p,p.vx*dt,p.vz*dt,walls);
}
export function segmentCircle(ax,az,bx,bz,cx,cz,r){const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((cx-ax)*dx+(cz-az)*dz)/l)):0;return Math.hypot(ax+t*dx-cx,az+t*dz-cz)<=r;}
export function segmentBox(ax,az,bx,bz,w,pad=0){let lo=0,hi=1;for(const [a,b,c,s]of[[ax,bx,w.x,w.w],[az,bz,w.z,w.d]]){const d=b-a,min=c-s/2-pad,max=c+s/2+pad;if(Math.abs(d)<1e-9){if(a<min||a>max)return false;}else{let t1=(min-a)/d,t2=(max-a)/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;}}return true;}
export function clearShot(a,b,walls){return !walls.some(w=>segmentBox(a.x,a.z,b.x,b.z,w));}
export function deadzone(x,z,d=.16){const l=Math.hypot(x,z);if(l<d)return{x:0,z:0};const k=Math.min(1,(l-d)/(1-d))/l;return{x:x*k,z:z*k};}

export function circleContact(ax,az,bx,bz,cx,cz,r){const dx=bx-ax,dz=bz-az,fx=ax-cx,fz=az-cz,c=fx*fx+fz*fz-r*r;if(c<=0)return 0;const a=dx*dx+dz*dz;if(a<1e-12)return Infinity;const b=2*(fx*dx+fz*dz),disc=b*b-4*a*c;if(disc<0)return Infinity;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:Infinity;}
export function boxContact(ax,az,bx,bz,w,pad=0){let lo=0,hi=1;for(const[a,b,c,s]of[[ax,bx,w.x,w.w],[az,bz,w.z,w.d]]){const d=b-a,min=c-s/2-pad,max=c+s/2+pad;if(Math.abs(d)<1e-9){if(a<min||a>max)return Infinity;}else{let t1=(min-a)/d,t2=(max-a)/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return Infinity;}}return lo;}

// Keep the hot camera/projectile/occlusion query allocation-free.
export function boxContact3D(ax,ay,az,bx,by,bz,w,pad=0){let lo=0,hi=1;for(let axis=0;axis<3;axis++){const a=axis===0?ax:axis===1?ay:az,b=axis===0?bx:axis===1?by:bz,c=axis===0?w.x:axis===1?(w.base??0)+w.h/2:w.z,size=axis===0?w.w:axis===1?w.h:w.d;const delta=b-a,min=c-size/2-pad,max=c+size/2+pad;if(Math.abs(delta)<1e-9){if(a<min||a>max)return Infinity;}else{let t1=(min-a)/delta,t2=(max-a)/delta;if(t1>t2){const swap=t1;t1=t2;t2=swap;}lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return Infinity;}}return lo;}

// Both the camera and weapon converge on the same point eleven metres ahead.
export function launchVerticalSpeed(speed,pitch,gun=false){const flight=10.42/speed;return(pitch*7-.02)/flight+(gun?0:THROW_DROP*flight);}

export const POWERUPS={run:{label:'BUTTER BOOTS',caption:'RUN FASTER',color:0x60edbd,field:'runBoost',seconds:12},fire:{label:'HOT SPUD',caption:'SHOOT FASTER',color:0xff9861,field:'fireBoost',seconds:12},jump:{label:'SPRING CLOGS',caption:'JUMP HIGHER',color:0xb89bff,field:'jumpBoost',seconds:14}};
export function isTrial(level){return level.mode==='race'||level.mode==='assault';}
export function jump(p){if(p.respawn>0||!p.grounded||p.crouching)return false;p.vy=p.jumpBoost>0?10.4:7.8;p.grounded=false;return true;}
export function movePlayer(p,input,dt,map,speed=6){
 const solids=map.platforms?.length?[...map.walls,...map.platforms]:map.walls;
 updateStance(p,input.crouch,solids);
 const oldY=p.y??0;p.vy=(p.vy??0)-22*dt;p.y=oldY+p.vy*dt;
 if(p.dashTime>0)slideMove(p,p.dashX*17*dt,p.dashZ*17*dt,solids);else movement(p,input,dt,solids,speed*(p.runBoost>0?1.4:1)*(p.crouching?.58:1));
 let floor=0;
 for(const w of solids){if(Math.abs(p.x-w.x)>=w.w/2+.30||Math.abs(p.z-w.z)>=w.d/2+.30)continue;const bottom=w.base??0,top=bottom+w.h;
  if(oldY>=top-.06&&p.y<=top)floor=Math.max(floor,top);
  if(bottom>0&&p.vy>0&&oldY+bodyHeight(p)<=bottom+.02&&p.y+bodyHeight(p)>bottom){p.y=bottom-bodyHeight(p);p.vy=0;}
 }
 p.grounded=p.vy<=0&&p.y<=floor;if(p.grounded){p.y=floor;p.vy=0;}
 p.inWater=!!map.waterCells?.length&&p.y<.18&&map.grid[map.toCell(p.x,p.z).z]?.[map.toCell(p.x,p.z).x]===2;
 if(map.n){const limit=(map.n-2)*CELL/2-.43;p.x=Math.max(-limit,Math.min(limit,p.x));p.z=Math.max(-limit,Math.min(limit,p.z));}
}
export function applyPowerup(p,kind){const boost=POWERUPS[kind];if(!boost)return false;p[boost.field]=boost.seconds;return true;}
export function circuitLevels(seed=0){
 const order=LEVELS.map((_,i)=>i);if(!seed)return order;const random=rng(seed);
 // Alternate combat and movement challenges; each new circuit opens somewhere different.
 const shuffle=items=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;};
 // Derived from the level list so added levels join the rotation without retuning index tables.
 const last=LEVELS.length-1,pool=order.filter(i=>i!==last);
 const combat=shuffle(pool.filter(i=>!isTrial(LEVELS[i]))),trials=shuffle(pool.filter(i=>isTrial(LEVELS[i]))),mixed=[];
 let t=0;for(let i=0;i<combat.length;i++){mixed.push(combat[i]);const want=Math.round((i+1)*trials.length/combat.length);while(t<want&&t<trials.length)mixed.push(trials[t++]);}
 while(t<trials.length)mixed.push(trials[t++]);
 mixed.push(last);return mixed;
}
export function roundLevel(index,seed=0){const id=circuitLevels(seed)[index];return{...LEVELS[id],id,seed:LEVELS[id].seed+(seed?((seed+index*997)%100000):0)};}
export function playableMap(level,bonus=false,duration=120){
 let map=makeMap(level,bonus);if(bonus||level.mode!=='race'||!level.remix)return map;
 // A relaxed runner must have time to finish, including turns. Add loops to long DFS paths.
 const limit=Math.max(30,Math.min(145,Math.floor(duration*3.5/CELL)));
 const random=rng(level.seed+783);let count=0;
 while(route(map,map.start,map.exit).length>limit&&count++<1000){const x=1+Math.floor(random()*(map.n-2)),z=1+Math.floor(random()*(map.n-2));if(!map.grid[z][x])continue;if((map.grid[z][x-1]===0&&map.grid[z][x+1]===0)||(map.grid[z-1][x]===0&&map.grid[z+1][x]===0)){map.grid[z][x]=0;const w=map.toWorld(x,z);map.walls=map.walls.filter(a=>a.x!==w.x||a.z!==w.z);}}
 return map;
}
