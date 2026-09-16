import assert from 'node:assert/strict';
import worker from '../server/index.js';
import {openDatabase} from '../server/sqlite-adapter.mjs';
const DB=await openDatabase(':memory:');
const api=async(path,body={})=>{const response=await worker.fetch(new Request('https://game.test/api/'+path,{method:'POST',headers:{'content-type':'application/json','origin':'https://game.test'},body:JSON.stringify(body)}),{DB});return{status:response.status,...await response.json()};};
const saved=await api('player/save',{name:'SPUD CHAMP',motto:'Clogs on, Game on'});assert.equal(saved.status,200);const playerToken=saved.playerToken;
assert.equal((await api('player/get',{playerToken:'forged'})).status,401);
const changed=await api('player/save',{playerToken,name:'THE KLOMPEN',motto:'Totally Mash'});assert.equal(changed.player.id,saved.player.id);
const unplayed=await api('scores/start',{playerToken,level:0,duration:120,mode:'solo'});assert.equal((await api('scores/finish',{playerToken,run:unplayed.run,score:0,rounds:0,wins:0,knockouts:0,durations:[],times:[{level:9,milliseconds:1000}]})).status,400);
const session=await api('scores/start',{playerToken,level:0,duration:120,mode:'online'});const payload={playerToken,run:session.run,score:21,rounds:10,wins:6,knockouts:8,complete:true,durations:Array(10).fill(120),times:[{level:1,milliseconds:35000}]};assert.equal((await api('scores/finish',payload)).status,400);
await DB.prepare('UPDATE runs SET started=? WHERE id=?').bind(Date.now()-1500000,session.run).run();assert.equal((await api('scores/finish',payload)).saved,true);
assert.equal((await api('scores/finish',{...payload,score:39,times:[{level:1,milliseconds:1000}]})).saved,true);
let profile=await api('player/get',{playerToken});assert.equal(profile.stats.rounds,10);assert.equal(profile.stats.wins,6);assert.equal(profile.stats.bestCircuit,21);
let board=await api('scores/leaderboard');assert.equal(board.rows[0].score,2100);assert.equal(board.rows[0].name,'THE KLOMPEN');assert.ok(!JSON.stringify(board).includes(playerToken));
board=await api('scores/leaderboard',{level:1});assert.equal(board.rows[0].milliseconds,35000);assert.equal((await api('scores/leaderboard',{mode:'solo'})).rows.length,0);
const partial=await api('scores/start',{playerToken,level:8,duration:120,mode:'solo'});await DB.prepare('UPDATE runs SET started=? WHERE id=?').bind(Date.now()-240000,partial.run).run();await api('scores/finish',{playerToken,run:partial.run,score:6,rounds:2,wins:2,knockouts:0,complete:true,durations:[120,120],times:[{level:8,milliseconds:51000}]});profile=await api('player/get',{playerToken});assert.equal(profile.stats.rounds,12);assert.equal(profile.stats.bestCircuit,21);assert.equal((await api('scores/leaderboard',{level:8})).rows[0].milliseconds,51000);
console.log('PASS durable profile update, ownership, circuit qualification, idempotent score save, per-maze ranking and mode filters');// Every playthrough is eligible, including an unfinished first round.
const second=await api('player/save',{name:"Zoë O’Neil",motto:'Test player'}),token2=second.playerToken,runId=crypto.randomUUID();assert.equal(second.player.name,"Zoë O’Neil");
const start={playerToken:token2,run:runId,level:0,duration:120,mode:'solo'};
assert.equal((await api('scores/start',start)).run,runId);assert.equal((await api('scores/start',start)).run,runId);
assert.equal((await api('scores/start',{...start,playerToken})).status,409);
const progress={playerToken:token2,run:runId,revision:1,score:0,points:110,playedMs:9000,rounds:0,wins:0,knockouts:1,times:[],final:false};
assert.equal((await api('scores/save',progress)).saved,true);
assert.equal((await api('scores/leaderboard',{mode:'solo'})).rows.find(r=>r.id===second.player.id).score,110);
const finalProgress={...progress,revision:3,points:220,playedMs:15000,knockouts:2,final:true};assert.equal((await api('scores/save',finalProgress)).saved,true);
assert.equal((await api('scores/save',progress)).revision,3);assert.equal((await api('scores/save',finalProgress)).revision,3);
assert.equal((await api('scores/save',{...finalProgress,playerToken})).status,404);
assert.equal((await api('scores/save',{...progress,revision:4})).status,400);
const stats2=(await api('player/get',{playerToken:token2})).stats;assert.equal(stats2.bestScore,220);assert.equal(stats2.knockouts,2);assert.equal(stats2.rounds,0);
console.log('PASS partial first-round scores, Unicode names, idempotent starts, duplicate/reversed saves and ownership');

DB.close();

// Plain file hosting has no /api. The game must still get a named player and keep scores, because
// that is exactly what an IONOS webspace upload looks like from the browser.
const store=new Map();
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const nodes=new Map();
globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,open:false,focus(){},showModal(){this.open=true;},close(){this.open=false;},addEventListener(){},onclick:null});return nodes.get(id);},addEventListener(){}};
globalThis.addEventListener=()=>{};globalThis.setInterval=()=>({unref(){}});
globalThis.fetch=async()=>new Response('<!doctype html>',{status:404,headers:{'content-type':'text/html'}});
const {playerAccount}=await import('../dist/profiles.js');
playerAccount.queue={put(){},flush:async()=>{},items:{}};
await playerAccount.refresh().catch(e=>{if(e)playerAccount.goOffline();});
assert.equal(playerAccount.offline,true,'a file host must be detected as having no game server');

let started=false;
assert.equal(await playerAccount.requirePlayer(()=>{started=true;}),false,'a first-time visitor is still asked to name themselves');
document.getElementById('playerName').value='MACCA';
assert.equal(await playerAccount.save(),true,'naming yourself must succeed without a server');
assert.equal(started,true,'and must carry straight on into the round that was waiting');
assert.equal(playerAccount.player.name,'MACCA');
assert.ok(document.getElementById('profileStatus').textContent.includes('device'),'and must say where the player was kept');

playerAccount.begin(0,120,'solo','circuit-1');
playerAccount.updateTotal(31,7,900,64);
playerAccount.record({epoch:'e1',level:1,won:true,total:31,best:34.5,knockouts:7});
await playerAccount.finish();
const kept=JSON.parse(localStorage.getItem('potatoman.scores.local'));
assert.equal(kept.best,31);assert.equal(kept.wins,1);assert.equal(kept.knockouts,7);assert.equal(kept.times[1],34500);
document.getElementById('leaderboardKind').value='circuit';document.getElementById('leaderboardMode').value='all';
await playerAccount.leaderboard();
assert.ok(document.getElementById('leaderboardRows').innerHTML.includes('MACCA'));
assert.ok(document.getElementById('leaderboardStatus').textContent.includes('this device'));
console.log('PASS a host with no game server still names a player, starts the round and keeps scores on the device');
