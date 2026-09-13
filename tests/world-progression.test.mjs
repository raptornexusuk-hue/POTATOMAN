import assert from 'node:assert/strict';
import {MAPS,mapId,nextCircuitSeed} from '../dist/map-catalogue.js';
import {LEVELS,roundLevel,circuitLevels,makeMap,route} from '../dist/core.js';
import {lastPlaceLine,awardStreaks} from '../dist/progression.js';
import {preferredVoice,GameAudio} from '../dist/game-audio.js';

assert.equal(MAPS.length,6);assert.equal(new Set(LEVELS.map(mapId)).size,6);
for(const previous of MAPS.map(m=>m.id))for(let trial=0;trial<100;trial++){
 const seed=nextCircuitSeed(previous,trial*973,seed=>roundLevel(0,seed));
 assert.notEqual(mapId(roundLevel(0,seed)),previous);
 const circuit=circuitLevels(seed);assert.equal(new Set(circuit).size,LEVELS.length);assert.equal(circuit.at(-1),LEVELS.length-1);
 assert.equal(new Set(circuit.map(i=>mapId(LEVELS[i]))).size,6);
}
// Every authored combat level must stay navigable corner-to-centre with colliding props.
for(const i of LEVELS.map((l,i)=>i).filter(i=>!['race','assault'].includes(LEVELS[i].mode))){
 const map=makeMap(LEVELS[i]),mid=Math.floor(map.n/2),goal=map.toWorld(mid,mid);
 for(const [x,z]of[[2,2],[map.n-3,2],[2,map.n-3],[map.n-3,map.n-3]])assert.ok(route(map,map.toWorld(x,z),goal).length>0);
 for(const prop of map.props){const cell=map.toCell(prop.x,prop.z);assert.equal(map.grid[cell.z][cell.x],1);assert.ok(map.walls.includes(prop));}
}
console.log('PASS six world families, all fourteen rounds, 600 non-repeating openings and authored combat route/collider consistency');

const players=[{id:0,name:'MACCA',score:0,best:Infinity},{id:1,name:'JAMIE',score:8,best:40},{id:2,name:'SAM',score:4,best:70}];
for(let i=0;i<10;i++){assert.ok(lastPlaceLine(players,false,i).includes('MACCA'));assert.ok(lastPlaceLine(players,true,i).includes('MACCA'));}
assert.equal(lastPlaceLine(players.map(p=>({...p,score:0})),false,0),'');
for(let i=0;i<3;i++)awardStreaks(players,[players[1]]);assert.equal(players[1].winStreak,3);awardStreaks(players,[players[2]]);assert.equal(players[1].winStreak,0);assert.equal(players[2].winStreak,1);awardStreaks(players,[players[1],players[2]]);assert.ok(players.every(p=>p.winStreak===0));
console.log('PASS last-place-only named commentary, silent all-tied rounds and consecutive-win crown resets');

const voices=[{name:'Generic English',lang:'en-GB',voiceURI:'generic'},{name:'Moira (Enhanced)',lang:'en-IE',voiceURI:'moira'},{name:'Rishi',lang:'en-IN',voiceURI:'rishi'}];
assert.equal(preferredVoice(voices,'','commentary').voiceURI,'moira');assert.equal(preferredVoice(voices,'','pain').voiceURI,'rishi');assert.equal(preferredVoice(voices,'generic','pain').voiceURI,'rishi');assert.equal(preferredVoice(voices.slice(0,1),'','pain'),null);
let now=0;const spoken=[],audio=new GameAudio(()=>({voice:true,voiceVolume:1}),{performance:{now:()=>now},speechSynthesis:{getVoices:()=>voices,speaking:false,speak:u=>spoken.push(u)},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}});
assert.equal(audio.pain(),true);spoken.at(-1).onend();now=4000;assert.equal(audio.pain(),false);now=5000;assert.equal(audio.pain(),true);assert.equal(spoken.at(-1).voice.voiceURI,'rishi');
console.log('PASS Moira/Rishi preference, rejected unapproved voice override, no robotic fallback and spaced pain reactions');

const silent=new GameAudio(()=>({voice:true,voiceVolume:1}),{performance:{now:()=>0},speechSynthesis:{getVoices:()=>[{name:'Generic English',lang:'en-GB',voiceURI:'generic'}],speak(){assert.fail('Unapproved speech must never run');}},SpeechSynthesisUtterance:class{}});assert.equal(silent.speak('Ouch',{force:true,role:'pain'}),false);assert.equal(silent.speak('Spud buckets',{force:true}),false);
