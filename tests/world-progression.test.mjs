import assert from 'node:assert/strict';
import {MAPS,mapId,nextCircuitSeed} from '../dist/map-catalogue.js';
import {LEVELS,roundLevel,circuitLevels,makeMap,route,slideMove} from '../dist/core.js';
import {lastPlaceLine,awardRoundWins} from '../dist/progression.js';
import {preferredVoice,GameAudio} from '../dist/game-audio.js';

// Every world in the catalogue is visited by the circuit, and every level belongs to one.
assert.ok(MAPS.length>=9);assert.equal(new Set(LEVELS.map(mapId)).size,MAPS.length);
for(const previous of MAPS.map(m=>m.id))for(let trial=0;trial<100;trial++){
 const seed=nextCircuitSeed(previous,trial*973,seed=>roundLevel(0,seed));
 assert.notEqual(mapId(roundLevel(0,seed)),previous);
 const circuit=circuitLevels(seed);assert.equal(new Set(circuit).size,LEVELS.length);assert.equal(circuit.at(-1),LEVELS.length-1);
 assert.equal(new Set(circuit.map(i=>mapId(LEVELS[i]))).size,MAPS.length);
}
// The shape of the circuit, rather than the levels in it: consecutive rounds have to be a change of
// place and a change of job, the mazes have to arrive in order of size because that is the ramp a
// racer feels, and the last round has to be the one worth finishing on.
for(let i=1;i<LEVELS.length;i++){
 assert.notEqual(mapId(LEVELS[i]),mapId(LEVELS[i-1]),`rounds ${i} and ${i+1} are the same world twice running`);
 assert.notEqual(LEVELS[i].mode,LEVELS[i-1].mode,`rounds ${i} and ${i+1} ask for the same thing twice running`);
}
{
 let last=0;for(const level of LEVELS.filter(l=>l.mode==='race')){assert.ok(level.size>last,`${level.name} is not longer than the maze before it`);last=level.size;}
 assert.equal(LEVELS.at(-1).mode,'climb','the circuit finishes on the tower');
 const modes=new Set(LEVELS.map(l=>l.mode));assert.ok(modes.size>=5,'the circuit is more than two kinds of round');
 for(const mode of modes)assert.ok(LEVELS.filter(l=>l.mode===mode).length<=LEVELS.length/3,`too much of the circuit is ${mode}`);
}
console.log('PASS the circuit changes world and job every round, the mazes grow, and it ends on the tower');
// Running through one is the whole point of an open container, so it is measured rather than
// assumed: a potato that enters at one end comes out of the other, and one that walks at its side
// is stopped by it.
{
 const yard=LEVELS.find(l=>mapId(l)==='shipyard'&&l.mode!=='climb'),map=makeMap(yard);
 const open=map.props.find(p=>p.open);assert.ok(open,'the container yard has containers you can run through');
 const along=open.w>open.d?'x':'z',across=along==='x'?'z':'x',length=Math.max(open.w,open.d);
 const through={x:open.x,z:open.z,y:0};through[along]=open[along]-length/2+.55;
 for(let i=0;i<260;i++)slideMove(through,along==='x'?.05:0,along==='z'?.05:0,map.walls);
 assert.ok(through[along]>open[along]+length/2-.05,`a potato runs the length of an open container and out the far side, reaching ${through[along].toFixed(2)} of ${(open[along]+length/2).toFixed(2)}`);
 assert.ok(Math.abs(through[across]-open[across])<.6,'and is held between its walls on the way');
 const side={x:open.x,z:open.z,y:0};side[across]=open[across]-1.9;
 for(let i=0;i<260;i++)slideMove(side,across==='x'?.05:0,across==='z'?.05:0,map.walls);
 assert.ok(side[across]<open[across]-.7,'and walking at its side is stopped by the side wall, not waved through');
}
console.log('PASS the container yard has containers that are a way through rather than round');

// A maze has to be worth running: a long way round and real dead ends to lose time in. Braiding
// buys the alternative lines that stop racers queuing nose to tail, but it buys them where the maze
// happens to allow, so the second line is a property of the set rather than a promise per map.
let branching=0;
for(const i of LEVELS.map((l,i)=>i).filter(i=>LEVELS[i].mode==='race')){
 const map=makeMap(LEVELS[i]),line=route(map,map.start,map.exit);
 let open=0,ends=0;
 for(let z=1;z<map.n-1;z++)for(let x=1;x<map.n-1;x++){if(map.grid[z][x]===1)continue;open++;
  if([[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>map.grid[z+b]?.[x+a]===0).length===1)ends++;}
 assert.ok(line.length>open*.24,`${LEVELS[i].name}: the way through is ${line.length} of ${open} open cells, barely a detour`);
 assert.ok(ends>=5,`${LEVELS[i].name}: only ${ends} dead ends to lose yourself in`);
 const lines=[0,1,2,3,4,5].map(v=>route(map,map.start,map.exit,v).map(c=>c.x+','+c.z));
 if(new Set(lines.flat()).size>lines[0].length)branching++;
}
assert.ok(branching>=2,`only ${branching} mazes offer a second line, so racers queue nose to tail`);
console.log(`PASS every maze runs long and keeps its dead ends, and ${branching} of them offer a second line through`);
// Every authored combat level must stay navigable corner-to-centre with colliding props.
for(const i of LEVELS.map((l,i)=>i).filter(i=>!['race','assault'].includes(LEVELS[i].mode))){
 const map=makeMap(LEVELS[i]),mid=Math.floor(map.n/2),goal=map.toWorld(mid,mid);
 for(const [x,z]of[[2,2],[map.n-3,2],[2,map.n-3],[map.n-3,map.n-3]])assert.ok(route(map,map.toWorld(x,z),goal).length>0);
 // Every prop occupies the cells it stands on. A solid one is its own collider; an open container
 // is a shell, so what stops you is its walls and its roof, and you can run the length of it.
 for(const prop of map.props){const cell=map.toCell(prop.x,prop.z);assert.equal(map.grid[cell.z][cell.x],1);
  if(!prop.open){assert.ok(map.walls.includes(prop));continue;}
  assert.ok(!map.walls.includes(prop),'an open container is not a solid block');
  const shell=map.walls.filter(w=>Math.abs(w.x-prop.x)<prop.w&&Math.abs(w.z-prop.z)<prop.d&&/^container/.test(w.prop??''));
  assert.ok(shell.filter(w=>w.prop==='containerWall').length===2&&shell.some(w=>w.prop==='containerRoof'),'an open container has two walls and a roof');
  const along=prop.w>prop.d?'x':'z',across=along==='x'?'z':'x';
  assert.ok(shell.filter(w=>w.prop==='containerWall').every(w=>Math.abs(w[across]-prop[across])>.6),'its walls are the sides, leaving the length open');
  assert.ok(shell.find(w=>w.prop==='containerRoof').base>2.15,'and its roof clears a standing potato');
 }
 // A block plan that closes on itself leaves courtyards nobody can reach, which reads on the map as
 // cover and plays as a bot standing in a corner for two minutes. Routing corner to centre does not
 // catch it: what does is flooding the arena and finding almost all of it.
 const seen=new Set(['2,2']),queue=[[2,2]];
 while(queue.length){const [x,z]=queue.pop();
  for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=z+dz;
   if(a<1||b<1||a>map.n-2||b>map.n-2||map.grid[b][a]===1||seen.has(a+','+b))continue;seen.add(a+','+b);queue.push([a,b]);}}
 let open=0;for(let z=1;z<map.n-1;z++)for(let x=1;x<map.n-1;x++)if(map.grid[z][x]!==1)open++;
 assert.ok(seen.size>=open*.92,`${LEVELS[i].name}: only ${seen.size} of ${open} open cells can be walked to`);
 // Containers are boxes laid in rows, not cubes dropped in a heap: each one is longer than it is
 // wide, and everything in a row points the same way.
 const rows=new Map();
 for(const prop of map.props.filter(p=>p.prop==='container')){
  assert.ok(Math.max(prop.w,prop.d)>Math.min(prop.w,prop.d)*2,'a container is longer than it is wide');
  const along=prop.w>prop.d?'x':'z',line=along==='x'?prop.z:prop.x;
  const key=along+':'+line.toFixed(2);rows.set(key,(rows.get(key)??0)+1);
 }
 const boxes=map.props.filter(p=>p.prop==='container').length;
 if(boxes>3)assert.ok(boxes>=rows.size*1.5,`containers are scattered across ${rows.size} lines rather than laid in rows: ${boxes} boxes`);
}
console.log(`PASS ${MAPS.length} world families, every round, 600 non-repeating openings, authored routes and colliders, walkable arenas and containers in rows`);

const players=[{id:0,name:'MACCA',score:0,best:Infinity},{id:1,name:'JAMIE',score:8,best:40},{id:2,name:'SAM',score:4,best:70}];
for(let i=0;i<10;i++){assert.ok(lastPlaceLine(players,false,i).includes('MACCA'));assert.ok(lastPlaceLine(players,true,i).includes('MACCA'));}
assert.equal(lastPlaceLine(players.map(p=>({...p,score:0})),false,0),'');
// The crown counts any three wins, so an interrupted run keeps everything already earned and
// a shared victory credits every winner.
for(let i=0;i<2;i++)awardRoundWins(players,[players[1]]);assert.equal(players[1].roundWins,2);
awardRoundWins(players,[players[2]]);assert.equal(players[1].roundWins,2,'losing a round cannot take back earlier wins');assert.equal(players[2].roundWins,1);
awardRoundWins(players,[players[1],players[2]]);assert.equal(players[1].roundWins,3);assert.equal(players[2].roundWins,2);assert.equal(players[0].roundWins,undefined);
console.log('PASS last-place-only named commentary, silent all-tied rounds and consecutive-win crown resets');

const voices=[{name:'Generic English',lang:'en-GB',voiceURI:'generic'},{name:'Moira (Enhanced)',lang:'en-IE',voiceURI:'moira'},{name:'Rishi',lang:'en-IN',voiceURI:'rishi'}];
assert.equal(preferredVoice(voices,'','commentary').voiceURI,'moira');assert.equal(preferredVoice(voices,'','pain').voiceURI,'rishi');assert.equal(preferredVoice(voices,'generic','pain').voiceURI,'rishi');assert.equal(preferredVoice(voices.slice(0,1),'','pain'),null);
let now=0;const spoken=[],audio=new GameAudio(()=>({voice:true,voiceVolume:1}),{performance:{now:()=>now},speechSynthesis:{getVoices:()=>voices,speaking:false,speak:u=>spoken.push(u)},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}});
assert.equal(audio.pain(),true);spoken.at(-1).onend();now=4000;assert.equal(audio.pain(),false);now=5000;assert.equal(audio.pain(),true);assert.equal(spoken.at(-1).voice.voiceURI,'rishi');
console.log('PASS Moira/Rishi preference, rejected unapproved voice override, no robotic fallback and spaced pain reactions');

const silent=new GameAudio(()=>({voice:true,voiceVolume:1}),{performance:{now:()=>0},speechSynthesis:{getVoices:()=>[{name:'Generic English',lang:'en-GB',voiceURI:'generic'}],speak(){assert.fail('Unapproved speech must never run');}},SpeechSynthesisUtterance:class{}});assert.equal(silent.speak('Ouch',{force:true,role:'pain'}),false);assert.equal(silent.speak('Spud buckets',{force:true}),false);
