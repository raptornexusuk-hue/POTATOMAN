import {mapId} from './map-catalogue.js';
import {bodyHeight,updateStance,STANDING_HEIGHT} from './stance.js';
export const STEP=1/120, CELL=3.2, ROUND_TIME=120, BONUS_TIME=55;
// Half the gravity applied to a thrown potato. A hand-thrown spud is lobbed, not fired: this is
// what gives it a visible arc to lead with, and every launch solver below derives from it, so the
// crosshair keeps converging on the same point the potato actually reaches.
export const THROW_DROP=5.4;
export const LEVELS=[
// The circuit is three acts. It opens on the friendliest arena and closes on the tower, and in
// between no two rounds running share a world or a mode, so every round is a change of place and a
// change of job. The mazes still appear in order of size, because that is the ramp a racer feels.
 {name:'Market Mayhem',tag:'VILLAGE • DAY',mode:'battle',size:15,theme:'market',seed:11,detail:'Fight through the town streets. Flank around the buildings and contest weapon drops in the market.',skill:'Move · aim · dodge'},
 {name:'Hedge Your Bets',tag:'GARDENS • DAY',mode:'race',size:15,theme:'hedge',seed:32,detail:'Fastest complete escape wins. Follow the landmarks, then improve your route.',skill:'Find the fastest route'},
 {name:'Harvest Havoc',tag:'FARMYARD • SUNSET',mode:'smash',size:17,theme:'fair',seed:53,detail:'Fight around barns and hay stacks. Break the marked harvest crates before your opponents do.',skill:'Aim under pressure'},
 {name:'Shipment',tag:'CONTAINER YARD • OVERCAST',mode:'battle',size:11,theme:'shipment',seed:64,detail:'A yard the size of a tennis court, walled in by containers. Everyone is always in range of everyone.',skill:'Snap aim · never stand still'},
 {name:'A-maize-ing Escape',tag:'FARMLAND • AFTERNOON',mode:'race',size:19,theme:'corn',seed:71,detail:'Longer paths and more dead ends. Keep your bearings.',skill:'Route memory'},
 {name:'Canal Carnage',tag:'CANALSIDE • DUSK',mode:'battle',size:19,theme:'canal',seed:82,detail:'Cross three bridges between moonlit quays. Use the warehouses for cover and stay out of the water.',skill:'Lead moving targets'},
 {name:'King of the Crop',tag:'ALLOTMENTS • GOLDEN HOUR',mode:'capture',size:17,theme:'garden',seed:48,detail:'Cut through hedge courtyards to hold the golden crop circle. A contested zone earns no points.',skill:'Control space'},
 {name:'Dune Dash',tag:'DUNES • AFTERNOON',mode:'race',size:21,theme:'dunes',seed:88,detail:'Marram-grass ridges hide the turns. Fastest complete escape wins.',skill:'Commit to a line'},
 {name:'Quarry Quarrel',tag:'CHALK QUARRY • OVERCAST',mode:'battle',size:19,theme:'quarry',seed:157,detail:'Fight across the cutting floor. Stone blocks give cover; the gantry lane is the fast flank.',skill:'Use hard cover'},
 {name:'The Butter Run',tag:'HARBOUR ASSAULT COURSE • SUNSET',mode:'assault',size:21,theme:'course',seed:114,detail:'Jump onto each numbered platform, duck through the three low gates, then reach the exit. Fastest completed run wins.',skill:'Jump · land · keep momentum'},
 {name:'Butterscotch Bay',tag:'BEACH • MIDDAY',mode:'battle',size:17,theme:'beach',seed:77,detail:'Fight across open sand between timber groynes and beach huts. The tide takes anyone who backs up too far.',skill:'Use what little cover there is'},
 {name:'Below Sea Level',tag:'WINDMILL POLDER • BREEZY',mode:'capture',size:19,theme:'polder',seed:233,detail:'Reclaimed flats with raised dykes to run along, sluice gates in the gaps and stacked peat for cover. Hold the zone from the top of a bank if you can hold the bank.',skill:'Take the high ground, then keep it'},
 {name:'The Midnight Maze',tag:'OLD TOWN • NIGHT',mode:'race',size:23,theme:'night',seed:129,detail:'Twisting brick alleys and longer routes. Fastest complete escape wins.',skill:'Navigate under pressure'},
 {name:'Orchard Ambush',tag:'CIDER ORCHARD • GOLDEN HOUR',mode:'capture',size:21,theme:'orchard',seed:194,detail:'Hold the pressing yard while rivals close in through the fruit rows.',skill:'Hold and rotate'},
 {name:'Stone Cold Smash',tag:'CUTTING FLOOR • AFTERNOON',mode:'smash',size:19,theme:'pit',seed:181,detail:'Break the marked blocks stacked around the cutting floor before your rivals do.',skill:'Pick your target'},
 {name:'Cider Run',tag:'ORCHARD • MORNING',mode:'race',size:25,theme:'grove',seed:152,detail:'Race the mown lanes between fruit rows. Fastest complete escape wins.',skill:'Read the rows'},
 {name:'The Chip Factory',tag:'INDOORS • NIGHT SHIFT',mode:'battle',size:17,theme:'factory',seed:203,detail:'Inside the works. Partition walls, doorways and fryer vats turn every fight into a room fight.',skill:'Clear corners'},
 {name:'Quayside Domination',tag:'HARBOUR • NIGHT',mode:'capture',size:21,theme:'depot',seed:96,detail:'Fight between containers for a moving control zone.',skill:'Rotate and intercept'},
 {name:'Gantry Grab',tag:'CONTAINER YARD • DUSK',mode:'smash',size:17,theme:'gantry',seed:219,detail:'Break the marked crates stacked between container rows before your rivals reach them.',skill:'Move between lanes'},
 {name:'Cannery Row',tag:'PACKING FLOOR • NIGHT SHIFT',mode:'capture',size:19,theme:'cannery',seed:211,detail:'Hold the packing floor in the middle of the shed while rivals push through the side doors.',skill:'Hold a room'},
 {name:'The Final Mash',tag:'FORTRESS GARDEN • STORM',mode:'race',size:27,theme:'fort',seed:143,detail:'The longest maze and the quickest rivals. One final escape.',skill:'Bring it all together'},
 {name:'Get Higher',tag:'CRANE TOWER • DUSK',mode:'climb',size:15,theme:'gantry',seed:166,detail:'Six stages up a crane tower: switchback scaffolding, a run of long jumps, two shuttles and two lifts that have to be ridden, a beam run round the mast and the jib to the summit. Miss and the wide ledges catch you — for a while. Fastest ascent wins.',skill:'Read the gap, and wait for the ride'}
];
export const MODES={battle:'TOTALLY MASH',race:'MAZE RACE',assault:'BUTTER RUN · TIME TRIAL',climb:'GET HIGHER · ASCENT',capture:'KING OF THE CROP',smash:'BANGERS & SMASH'};
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function makeMap(level,bonus=false){
 const n=bonus?17:level.size,r=rng(level.seed+(bonus?907:0)),grid=Array.from({length:n},()=>Array(n).fill(1));
 if(level.mode==='race'&&!bonus){
  const stack=[[1,n-2]];grid[n-2][1]=0;
  while(stack.length){const [x,z]=stack.at(-1),next=[[2,0],[-2,0],[0,2],[0,-2]].map(([a,b])=>[x+a,z+b]).filter(([a,b])=>a>0&&b>0&&a<n-1&&b<n-1&&grid[b][a]);
   if(!next.length){stack.pop();continue;}const [a,b]=next[Math.floor(r()*next.length)];grid[(z+b)/2][(x+a)/2]=0;grid[b][a]=0;stack.push([a,b]);
  }
  // A perfect maze has exactly one route between any two cells, which is why every racer ran the
  // same line nose to tail and no route variant could differ. Braiding a share of the dead ends
  // opens loops, so alternative equal-length routes exist and rivals can be overtaken rather than
  // queued behind. A fifth is as much as that needs: opening more than that shortened the run
  // through every maze without buying any more overtaking than this does.
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++){
   if(grid[z][x]||r()>.20)continue;
   const open=[[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>grid[z+b]?.[x+a]===0);
   if(open.length!==1)continue;
   const shut=[[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>x+a>0&&z+b>0&&x+a<n-1&&z+b<n-1&&grid[z+b][x+a]===1&&grid[z+b*2]?.[x+a*2]===0);
   if(shut.length){const [a,b]=shut[Math.floor(r()*shut.length)];grid[z+b][x+a]=0;}
  }
  // Identical start and finish spaces for all racers.
  for(let z=n-3;z<n-1;z++)for(let x=1;x<4;x++)grid[z][x]=0;
 }else{
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++)grid[z][x]=0;
  const put=(x,z)=>{if(x>1&&z>1&&x<n-2&&z<n-2)grid[z][x]=1;},m=Math.floor(n/2);
  if(bonus){for(let z=3;z<n-3;z+=3)for(let x=3;x<n-3;x+=3)if(r()<.7){put(x,z);if(r()<.5)put(x+1,z);}}
  else if(level.mode==='assault'||level.mode==='climb'){}
  else if(level.theme==='market'){for(const [x,z]of[[4,4],[n-5,4],[4,n-5],[n-5,n-5]]){put(x,z);put(x+1,z);put(x,z+1);}}
  else if(level.theme==='garden'){for(let z=3;z<n-3;z+=3)for(let x=3;x<n-3;x+=4){put(x,z);put(x+1,z);}}
  else if(level.theme==='canal'){for(const z of[m-3,m+3])for(let x=3;x<n-3;x++)if(![4,m,n-5].includes(x))put(x,z);for(const x of[4,n-5]){put(x,m-1);put(x,m+1);}}
  else if(level.theme==='depot'){for(let z=3;z<n-3;z+=4)for(let x=3;x<n-3;x+=4){put(x,z);put(x,z+1);put(x+1,z);put(x+1,z+1);}}
  else if(level.theme==='shop'){for(let z=4;z<n-4;z+=3)for(let x=3;x<n-3;x++)if(x%6!==0&&x%6!==1)put(x,z);}
  else if(level.theme==='fair'){for(const [dx,dz]of[[-4,-4],[0,-4],[4,-4],[-4,0],[4,0],[-4,4],[0,4],[4,4]]){put(m+dx,m+dz);if(dx)put(m+dx,m+dz+1);}}
  else for(let z=3;z<n-3;z+=3)for(let x=3;x<n-3;x+=3)if(r()<.76){put(x,z);if(r()<.5)put(x+1,z);}
  // A remixed circuit used to scatter extra blocks through this grid. On a combat map the grid is
  // wiped again below and rebuilt from authored props, so the scatter never reached the arena; on
  // the tower it was not wiped, and dropping blocks at random around the foot of a climb is how a
  // remixed finale ended up walling its own climbers in on their spawn.
  const mid=Math.floor(n/2);for(let i=1;i<n-1;i++){grid[mid][i]=0;grid[i][mid]=0;}
 }
 if(level.mode!=='race'||bonus)for(const [cx,cz]of[[2,2],[n-3,n-3],[n-3,2],[2,n-3]])for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)grid[cz+dz][cx+dx]=0;
 const toWorld=(x,z)=>({x:(x-(n-1)/2)*CELL,z:(z-(n-1)/2)*CELL});
 const toCell=(x,z)=>({x:Math.max(0,Math.min(n-1,Math.round(x/CELL+(n-1)/2))),z:Math.max(0,Math.min(n-1,Math.round(z/CELL+(n-1)/2)))});
 // What each prop is standing on, so clearing a cell can take the thing on it away again
 // whichever cells it was laid across.
 const buildings=[],waterCells=[],props=[],hollow=[],propCells=new Map(),family=mapId(level),map0={};
 if(bonus||!isTrial(level)){
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++)grid[z][x]=0;
  const mid=Math.floor(n/2),addProp=(cx,cz,type,h=1.3,size=2.5,depth=size,extra={})=>{grid[cz][cx]=1;const prop={...toWorld(cx,cz),w:size,d:depth,h,prop:type,...extra};propCells.set(prop,[[cx,cz]]);props.push(prop);};
  // Quarter-turn about the centre. Anything placed through this is symmetric under 90 degrees, so
  // no spawn corner is closer to the middle — or better covered — than any other.
  const spin=(cx,cz,place)=>{let x=cx,z=cz;for(let k=0;k<4;k++){place(x,z,k);const nx=z,nz=n-1-x;x=nx;z=nz;}};
  // The four headings a quarter turn maps a row onto, so a row authored once comes out the same
  // way round on all four sides instead of being rebuilt by hand for each.
  const TURNS=[[1,0],[0,-1],[-1,0],[0,1]];
  // A shipping container is two cells long, so it occupies both of them and stands between them.
  // Laid out a cell at a time they were nearly square, and a yard of square boxes reads as rubble.
  const addLong=(cx,cz,dx,dz,type,h,extra={})=>{if(cx<1||cz<1||cx+dx>n-2||cz+dz>n-2||cx+dx<1||cz+dz<1)return;
   if(grid[cz][cx]===1||grid[cz+dz][cx+dx]===1)return;
   // The middle cell and the four ways into it stay clear: it is where the contested weapon box
   // lands on every map, and a ring of rows closed neatly around it is a ring nobody can enter.
   const core=(x,z)=>Math.abs(x-mid)+Math.abs(z-mid)<=1;if(core(cx,cz)||core(cx+dx,cz+dz))return;
   // The spawn corners and the ring round them are cleared before anything is placed here; a row
   // that lands back on one walls a player into their own spawn.
   const spawn=(x,z)=>[[2,2],[n-3,2],[2,n-3],[n-3,n-3]].some(([a,b])=>x===a&&z===b);
   if(spawn(cx,cz)||spawn(cx+dx,cz+dz))return;
   grid[cz][cx]=1;grid[cz+dz][cx+dx]=1;const a=toWorld(cx,cz),b=toWorld(cx+dx,cz+dz);
   const prop={x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:dx?CELL*2-.62:2.42,d:dz?CELL*2-.62:2.42,h,prop:type,...extra};
   propCells.set(prop,[[cx,cz],[cx+dx,cz+dz]]);props.push(prop);
   // A container with its doors chained open is a piece of the map you run through, not round. The
   // thing you see is still one prop; what stops you is the two side walls and the roof, so the
   // inside is a corridor and the top is still somewhere to stand. Its cells stay marked, because a
   // route planner has no way to know it may only be crossed end to end.
   if(prop.open){const along=dx?'w':'d',across=dx?'d':'w',wall=.30,inner=prop[across]/2-wall/2;
    for(const side of[-1,1])hollow.push({of:prop,x:prop.x+(dx?0:side*inner),z:prop.z+(dz?0:side*inner),w:dx?prop.w:wall,d:dz?prop.d:wall,h:prop.h,prop:'containerWall'});
    hollow.push({of:prop,x:prop.x,z:prop.z,w:prop.w,d:prop.d,base:2.28,h:prop.h-2.28,prop:'containerRoof'});
    void along;void across;}};
  if(family==='shipyard'){
   // Shipment: a yard you can cross in four seconds, packed tight enough that every sightline is
   // short and nowhere is safe for long. Double-stacked rows are the only cover a launcher must arc.
   // Boxes lie in rows, not in a heap: every container in a row shares its heading, the rows
   // against the walls are double-stacked, and the single-height inner square leaves four lanes
   // and an open middle where the weapon box lands.
   // A container yard is rows. Every box in a row shares its heading, rows sit two cells apart so
   // a four-metre lane runs between them, alternate rows are offset so the cross gaps stagger instead of
   // lining up into one clear run end to end, and every second row is double-stacked so the
   // skyline steps rather than walling the yard in.
   for(let z=2,row=0;z<=n-3;z+=2,row++)for(let x=row%2?2:3,chunk=0;x+1<=n-2;x+=3,chunk++)addLong(x,z,1,0,'container',row%2?2.6:5.2,{...(row%2?{}:{stacked:true}),open:(chunk+row)%2===0});
   // Pallets of crates on the cross lanes: low enough to shoot over, solid enough to stop a run.
   spin(mid,2,(x,z)=>{if(grid[z][x]===0)addProp(x,z,'cargo',1.8,2.4);});
  }
  else if(family==='coast'){
   // Open sand broken only by timber groynes running down to the water, with painted huts along
   // the promenade. The sea itself is a hazard: back up too far and the tide takes you.
   // Groynes as a pinwheel of three-cell breakwaters: each quarter turn puts one on a different
   // side, which keeps the map 90-degree symmetric so no spawn corner is closer to the middle.
   spin(3,mid-3,(x,z,k)=>{const alongZ=k%2===0;
    for(let i=0;i<3;i++){const gx=alongZ?x:x+i-1,gz=alongZ?z+i-1:z;
     if(gx>1&&gz>1&&gx<n-2&&gz<n-2)addProp(gx,gz,'groyne',1.15,alongZ?.7:CELL*.94,alongZ?CELL*.94:.7);}});
   for(const [x,z]of[[mid-3,mid],[mid+3,mid],[mid,mid-3],[mid,mid+3]])addProp(x,z,'beachHut',2.5,2.6);
   for(const [x,z]of[[mid-2,mid-2],[mid+2,mid+2],[mid-2,mid+2],[mid+2,mid-2]])addProp(x,z,'rock',1.35,2.2,2,{});
   for(let x=3;x<n-3;x++){grid[1][x]=2;waterCells.push(toWorld(x,1));}
  }
  else if(family==='polder'){
   // Land below the water line. Raised dykes you jump onto and run along, sluice gates standing in
   // the gaps between them and stacked peat for cover: the fight here is about height rather than
   // corners, which no other world on the circuit asks for.
   spin(3,mid-2,(x,z,k)=>{const [dx,dz]=TURNS[k];
    for(let i=0;i<5;i++){const cx=x+dx*i,cz=z+dz*i;if(cx>1&&cz>1&&cx<n-2&&cz<n-2&&grid[cz][cx]===0)addProp(cx,cz,'dyke',1.15,dx?CELL:1.6,dz?CELL:1.6);}});
   spin(mid,3,(x,z)=>{if(grid[z]?.[x]===0)addProp(x,z,'sluice',2.4,2.7,1.15);});
   spin(mid-3,mid-3,(x,z)=>{if(grid[z]?.[x]===0)addProp(x,z,'peat',1.35,2.3);});
   for(let x=3;x<n-3;x++){grid[1][x]=2;waterCells.push(toWorld(x,1));}
  }
  else if(family==='interior'){
   // A floor plan rather than scattered cover: full-height partitions split the shed into rooms
   // and every partition is punched with doorways, so fights happen in rooms and in the gaps
   // between them. The ceiling overhead is drawn by the world, not by the grid.
   const lines=[];for(let i=4;i<n-4;i+=4)lines.push(i);
   for(const line of lines)for(let i=2;i<n-2;i++){grid[i][line]=1;grid[line][i]=1;}
   // The central aisle is three cells wide, so a partition that happens to land on the middle of
   // the shed opens a crossroads instead of sealing the centre into a one-cell pocket.
   for(const line of lines)for(const gap of[3,mid-1,mid,mid+1,n-4]){grid[gap][line]=0;grid[line][gap]=0;}
   // The middle cell stays clear: it is where the contested weapon box lands on every map.
   for(const [x,z]of[[mid-2,mid-2],[mid+2,mid+2],[mid+2,mid-2],[mid-2,mid+2]])if(grid[z][x]===0)addProp(x,z,'vat',2.1,2.6);
   for(const [x,z]of[[2,mid],[n-3,mid],[mid,2],[mid,n-3]])if(grid[z][x]===0)addProp(x,z,'pallet',1.15,2.6);
   for(const [x,z]of[[2,2],[n-3,n-3],[n-3,2],[2,n-3]].map(([a,b])=>[a+ (a<mid?2:-2),b])) if(grid[z]?.[x]===0)addProp(x,z,'conveyor',1.1,2.7,1.5);
  }
  else if(family==='estate'){
   for(const [cx,cz]of[[4,4],[n-5,4],[4,n-5],[n-5,n-5]])for(let j=-1;j<=1;j++){grid[cz-1][cx+j]=1;grid[cz+1][cx+j]=1;grid[cz][cx-1]=1;grid[cz][cx+1]=1;}
   for(const [x,z]of[[4,5],[n-5,3],[3,n-5],[n-4,n-5]])grid[z][x]=0;
  }else{
   // Four blocks at the corners is a field with something in each corner, not a place. A second
   // rank halfway along each side turns the gaps between them into streets: the corner blocks and
   // the mid-side ones face each other across a lane, with the middle left open. The mid-side
   // anchors are the corner set turned a quarter at a time, so no spawn is better covered.
   // A second rank of buildings needs two things: a map wide enough to leave streets around it —
   // on the smallest arenas the two ranks meet and close the plan into courtyards nobody can get
   // into — and a world where a terrace belongs. A chalk quarry is not short of a row of houses.
   const streets=['village','harbour','farm'].includes(family),ranked=n>=17&&streets;
   const blocks=family==='harbour'
    ?[[5,4],[n-7,4],[5,n-6],[n-7,n-6],...(ranked?[[2,4],[n-4,4],[2,n-6],[n-4,n-6]]:[])]
    :[[4,4],[n-6,4],[4,n-6],[n-6,n-6],...(ranked?[[mid-1,2],[2,mid],[mid,n-4],[n-4,mid-1]]:[])];
   for(const [x,z]of blocks){const cells=[];for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){grid[z+dz][x+dx]=1;cells.push([x+dx,z+dz]);}const block={...toWorld(x+.5,z+.5),w:CELL*2,d:CELL*2,h:family==='farm'?4.2:family==='harbour'?5.8:5.2,architecture:true,kind:family};propCells.set(block,cells);buildings.push(block);}
   if(family==='harbour'){const bridges=[3,mid,n-4];for(let z=mid-1;z<=mid+1;z++)for(let x=1;x<n-1;x++)if(!bridges.includes(x)){grid[z][x]=2;waterCells.push(toWorld(x,z));}}
   // Street furniture goes round on the quarter turn like everything else. Mirrored pairs looked
   // symmetric and were not: two spawn corners ended up four steps nearer the weapon box than the
   // other two once there were buildings on the streets to route around.
   const furnish=(cx,cz,...rest)=>spin(cx,cz,(x,z)=>{if(grid[z]?.[x]===0)addProp(x,z,...rest);});
   if(family==='village'){furnish(mid-2,mid-1,'marketStall',2.2);furnish(4,6,'bin',1.45,1.1);}
   // The canal runs one way across the harbour, so that world is symmetric about its two axes
   // rather than under a quarter turn; its quayside cargo is placed to match, one stack per bank end.
   if(family==='harbour')for(const x of[4,n-5])for(const z of[2,n-3])if(grid[z]?.[x]===0)addProp(x,z,'cargo',1.8);
   if(family==='farm')furnish(mid-3,mid-1,'hay',1.25);
   // Cut blocks on the quarry floor and pressing barrels in the orchard yard give each new
   // world its own hard cover, placed on the same authored grid as the other families.
   // The working worlds get a second rank of their own kit instead: cut blocks and spoil on the
   // quarry floor, barrels and crate stacks in the pressing yard, on the same quarter turn.
   if(family==='quarry'){furnish(mid-3,mid-2,'stoneBlock',1.75,2.6);furnish(5,6,'spoil',1.2,2.4);
    if(n>=17){furnish(mid-1,3,'stoneBlock',1.75,2.6);furnish(3,mid+2,'spoil',1.2,2.4);}}
   if(family==='orchard'){furnish(mid-3,mid-1,'cider',1.35,2.3);furnish(4,6,'crateStack',1.5,2.2);
    if(n>=17){furnish(mid-1,3,'crateStack',1.5,2.2);furnish(3,mid+2,'cider',1.35,2.3);}}
  }
 }
 if(bonus){const cleared=new Set(),mid=Math.floor(n/2);
  // The two objectives moved every round instead of sitting in the same two corners of every map.
  // Each pair is a genuine traverse of the arena, so the runner is always crossing open ground
  // between them rather than cutting one corner.
  const pairs=[[[3,3],[n-4,n-4]],[[n-4,3],[3,n-4]],[[3,mid],[n-4,mid]],[[mid,3],[3,n-4]],[[n-4,mid],[mid,3]]];
  const pick=pairs[level.seed%pairs.length];
  map0.objectiveCells=pick;
  const spots=[];
  for(const [cx,cz] of [...pick,[mid,n-3]])for(const[dx,dz]of[[0,0],[1,0],[-1,0],[0,1],[0,-1]]){grid[cz+dz][cx+dx]=0;spots.push(toWorld(cx+dx,cz+dz));cleared.add(cx+dx+','+(cz+dz));}
  // Clearing a checkpoint has to take whatever is standing on it, and free every cell that thing
  // was laid across. Matching on the prop's own coordinates only ever caught the ones placed a
  // single cell at a time, so a container laid between two cells stayed parked exactly where the
  // runner had to reach.
  for(const list of[props,buildings])for(let i=list.length-1;i>=0;i--){const piece=list[i];
   if(!spots.some(at=>Math.abs(at.x-piece.x)<piece.w/2+.7&&Math.abs(at.z-piece.z)<piece.d/2+.7))continue;
   for(const [cx,cz]of propCells.get(piece)??[])grid[cz][cx]=0;list.splice(i,1);
   for(let k=hollow.length-1;k>=0;k--)if(hollow[k].of===piece)hollow.splice(k,1);}
 }
 const fountain=!bonus&&level.theme==='garden'?{...toWorld(Math.floor(n/2),3),w:2.5,d:2.5,h:1.35,prop:'fountain'}:null;if(fountain)grid[3][Math.floor(n/2)]=1;
 // Cells a prop already stands on must not also become a full-cell block. Matching on the prop's
 // own coordinates only caught the ones placed a single cell at a time, so every container laid
 // across two cells was quietly wrapped in two three-metre boxes — including the open ones, which
 // were then not open at all.
 const claimed=new Set();for(const [piece,cells]of propCells)if(props.includes(piece)||buildings.includes(piece))for(const [cx,cz]of cells)claimed.add(cx+','+cz);
 const walls=[...buildings,...props.filter(p=>!p.open),...hollow];let cover=0;for(let z=0;z<n;z++)for(let x=0;x<n;x++)if(grid[z][x]===1){const p=toWorld(x,z);if(claimed.has(x+','+z))continue;if(fountain&&p.x===fountain.x&&p.z===fountain.z){walls.push(fountain);continue;}if(buildings.some(b=>Math.abs(p.x-b.x)<b.w/2&&Math.abs(p.z-b.z)<b.d/2))continue;const interior=x>1&&x<n-2&&z>1&&z<n-2,w={...p,w:CELL,d:CELL,h:2.65};
  // The seaward edge of a beach is a low sea wall, not a boundary you cannot see over. It still
  // stops bodies; it just does not wall the bay off from its own sea.
  if((family==='coast'||family==='polder')&&z===0)w.h=.42;if(interior&&!isTrial(level)&&!bonus&&!['garden','market','canal','factory','cannery','shipment','gantry','beach'].includes(level.theme)){w.h=1.65;if(cover++%3===0)Object.assign(w,{prop:'bin',w:1.1,d:1.1,h:1.45});}else if(interior&&family==='estate')w.h=1.8;walls.push(w);}
 // The visible bridge handrails block bodies, while shots can pass underneath.
 // Handrails belong to the harbour's three bridges. Any map with water at all used to get them,
 // which put invisible rails across the beach where there is no bridge to hold.
 const bridgeRails=[];if(waterCells.length&&family==='harbour'){const mid=Math.floor(n/2);for(const cell of[3,mid,n-4])for(const side of[-1,1])bridgeRails.push({x:toWorld(cell,mid).x+side*1.42,z:0,w:.07,d:9.7,base:1.03,h:.08,prop:'bridgeRail'});walls.push(...bridgeRails);}
 // Harvest targets belong to loading rows beside the barns, with open routes between them.
 const targetSpots=!bonus&&level.mode==='smash'?[[4,3],[5,3],[n-6,3],[n-5,3],[4,n-4],[5,n-4],[n-6,n-4],[n-5,n-4],[3,4],[3,5],[n-4,4],[n-4,5],[3,n-6],[n-4,n-6]].filter(([x,z])=>grid[z]?.[x]===0).map(([x,z])=>toWorld(x,z)):[];
 const map={n,grid,walls,buildings,props,targetSpots,worldId:family,waterCells,bridgeRails,toWorld,toCell,start:toWorld(1,n-2),exit:toWorld(n-2,1),platforms:[],course:[],objectives:(map0.objectiveCells??[[3,3],[n-4,n-4]]).map(([x,z])=>toWorld(x,z))};
 if(level.mode==='climb'&&!bonus){
  // Six stages, not one spiral. Every gap is measured against the actual jump: a standing jump
  // peaks at 1.38m and clears 0.85m of rise between 0.8m and 3.45m of travel, or nearly 3.9m when
  // the step up is small. The moving stages bridge gaps deliberately wider than that, so the only
  // way across is to wait and ride — which is the point of putting them there.
  const course=[],motion=[];
  const add=(x,z,h,extra={})=>{const c={x,z,h,index:course.length,...extra};course.push(c);return c;};
  // A mover is an ordinary platform whose position is recomputed before anything touches it, so
  // collision, the climbers' route and the meshes all read the same numbers. Its travel is set so
  // that at each end of the sweep it overlaps the ledge it serves: mistiming costs a wait, not a
  // fall, while the gap between those ledges stays far past anything a jump can cross.
  const shuttle=(x,z,h,axis,range,period,phase=0)=>{const c=add(x,z,h,{mover:true});motion.push({course:c,x,z,h,axis,range,period,phase});return c;};
  // 1 · Scaffold switchbacks up the west face: two runs of four, doubling back on themselves.
  let h=.9;
  for(const [x,z]of[[-10,-9],[-10,-6],[-10,-3],[-10,0],[-6.6,0],[-6.6,-3],[-6.6,-6],[-6.6,-9]]){add(x,z,h,{wide:x===-6.6&&z===0});h+=.7;}
  // 2 · Four long jumps east along the deck. Barely any step up, so the whole jump buys distance.
  h=6.1;for(const x of[-2.8,1,4.8,8.6]){add(x,-9,h);h+=.3;}
  // 3 · Two shuttles, each crossing a gap no jump can make: one along the deck, one across it. A
  // ride collects at the height of the ledge it serves and sets down a step below the next, so
  // boarding is a walk taken when it arrives and leaving it is a hop onto something that will
  // still be there — never a jump at a platform that has moved on by the time you land.
  add(12,-9,7.6,{wide:true});
  shuttle(12,-4.3,7.6,'z',2.15,6.4);
  add(12,.4,8,{wide:true});
  shuttle(7,.4,8,'x',2,5.6,.35);
  add(2,.4,8.4,{wide:true});
  // 4 · Two lifts. They rise and fall between the ledge that loads them and the one they unload
  // onto, so the ride is the climb: nothing up here can be jumped to from the floor below it.
  shuttle(2,2.6,10.4,'y',2,7.2,.5);
  add(2,5.8,12.8,{wide:true});
  shuttle(2,9,14.7,'y',1.9,6.8,.15);
  add(2,12.2,17,{wide:true});
  // 5 · A beam run round the mast: narrow, and it turns two corners.
  h=17.6;for(const [x,z,along]of[[-1.2,12.2,'x'],[-4.4,12.2,'x'],[-4.4,9,'z'],[-4.4,5.8,'z'],[-1.2,5.8,'x'],[2,5.8,'x']]){add(x,z,h,{beam:along});h+=.6;}
  // 6 · Out along the crane jib to the summit.
  h=21.2;for(const x of[5.2,8.4,11.6]){add(x,5.8,h);h+=.6;}
  add(14.8,5.8,23,{wide:true});
  map.course=course;map.motion=motion;
  // Slabs, not columns: a floating platform can sit above an earlier one without the climber being
  // blocked by a tower of solid geometry on the way to it.
  map.platforms=course.map(c=>{const span=c.wide?4.2:2.4,platform={x:c.x,z:c.z,w:c.beam?(c.beam==='x'?3:1.3):span,d:c.beam?(c.beam==='x'?1.3:3):span,base:Math.max(0,c.h-.45),h:c.h>.45?.45:c.h,platform:true};if(c.mover)platform.mover=true;return platform;});
  for(const m of motion)m.platform=map.platforms[m.course.index];
  const top=course.at(-1);
  map.start={x:-10,z:-11.6};
  map.exit={x:top.x,z:top.z};map.exitHeight=top.h;
 }
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
export function launchVerticalSpeed(speed,pitch,drop=1){const flight=10.42/speed;return(pitch*7-.02)/flight+drop*THROW_DROP*flight;}

export const POWERUPS={run:{label:'BUTTER BOOTS',caption:'RUN FASTER',color:0x60edbd,field:'runBoost',seconds:12},fire:{label:'HOT SPUD',caption:'SHOOT FASTER',color:0xff9861,field:'fireBoost',seconds:12},jump:{label:'SPRING CLOGS',caption:'JUMP HIGHER',color:0xb89bff,field:'jumpBoost',seconds:14}};
// How far through the circuit a round sits, 0 at the opener and 1 at the finale. The game's
// difficulty curves are written against this rather than against a round number, so a circuit that
// grows from ten rounds to twenty-one stretches its pacing to fit instead of finishing it early.
export const circuitProgress=index=>LEVELS.length>1?Math.max(0,Math.min(1,index/(LEVELS.length-1))):0;
export function isTrial(level){return level.mode==='race'||level.mode==='assault'||level.mode==='climb';}
export function jump(p){if(p.respawn>0||!p.grounded||p.crouching)return false;p.vy=p.jumpBoost>0?10.4:7.8;p.grounded=false;return true;}
export function movePlayer(p,input,dt,map,speed=6){
 const solids=map.platforms?.length?[...map.walls,...map.platforms]:map.walls;
 // Whatever the player was standing on last tick takes them with it.
 if(p.ride?.mover&&p.ride.shift){p.x+=p.ride.shift.x;p.z+=p.ride.shift.z;}
 updateStance(p,input.crouch,solids);
 const oldY=p.y??0;p.vy=(p.vy??0)-22*dt;p.y=oldY+p.vy*dt;
 if(p.dashTime>0)slideMove(p,p.dashX*17*dt,p.dashZ*17*dt,solids);else movement(p,input,dt,solids,speed*(p.runBoost>0?1.4:1)*(p.crouching?.58:1));
 let floor=0,ride=null;
 for(const w of solids){if(Math.abs(p.x-w.x)>=w.w/2+.30||Math.abs(p.z-w.z)>=w.d/2+.30)continue;const bottom=w.base??0,top=bottom+w.h;
  if(oldY>=top-.06&&p.y<=top){if(top>=floor)ride=w;floor=Math.max(floor,top);}
  if(bottom>0&&p.vy>0&&oldY+bodyHeight(p)<=bottom+.02&&p.y+bodyHeight(p)>bottom){p.y=bottom-bodyHeight(p);p.vy=0;}
 }
 p.grounded=p.vy<=0&&p.y<=floor;if(p.grounded){p.y=floor;p.vy=0;}
 // Whatever is underfoot, so a mover can carry its passenger and a climber can tell where its edge is.
 p.ride=p.grounded?ride:null;
 p.inWater=!!map.waterCells?.length&&p.y<.18&&map.grid[map.toCell(p.x,p.z).z]?.[map.toCell(p.x,p.z).x]===2;
 if(map.n){const limit=(map.n-2)*CELL/2-.43;p.x=Math.max(-limit,Math.min(limit,p.x));p.z=Math.max(-limit,Math.min(limit,p.z));}
}
// Moving platforms are updated once per tick, before anything reads them. Each one also remembers
// how far it travelled this tick so a climber standing on it is carried rather than left behind,
// which is the difference between riding a lift and watching it leave.
export function moveCourse(map,time){
 if(!map.motion?.length)return;
 for(const m of map.motion){
  const at=Math.sin((time/m.period+m.phase)*Math.PI*2)*m.range,platform=m.platform,before={x:platform.x,z:platform.z,base:platform.base};
  if(m.axis==='y')platform.base=Math.max(0,m.h+at-.45);else platform[m.axis]=m[m.axis]+at;
  m.course.x=platform.x;m.course.z=platform.z;m.course.h=platform.base+platform.h;
  platform.shift={x:platform.x-before.x,z:platform.z-before.z,y:platform.base-before.base};
 }
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
 // A relaxed runner must have time to finish, including turns. The slowest rivals travel
 // 6 * .62 m/s and lose roughly a quarter of the round to cornering, jostling and the hesitation
 // the easiest difficulty runs with, so the reachable route length follows from their actual
 // speed rather than from a hand-picked number that quietly stopped being reachable.
 const limit=Math.max(30,Math.min(145,Math.floor(duration*6*.62*.75/CELL)));
 const random=rng(level.seed+783);let count=0;
 while(route(map,map.start,map.exit).length>limit&&count++<1000){const x=1+Math.floor(random()*(map.n-2)),z=1+Math.floor(random()*(map.n-2));if(!map.grid[z][x])continue;if((map.grid[z][x-1]===0&&map.grid[z][x+1]===0)||(map.grid[z-1][x]===0&&map.grid[z+1][x]===0)){map.grid[z][x]=0;const w=map.toWorld(x,z);map.walls=map.walls.filter(a=>a.x!==w.x||a.z!==w.z);}}
 return map;
}
