import assert from 'node:assert/strict';
import worker from '../server/index.js';
import {MAZE_LEVELS,LEVEL_COUNT} from '../server/profiles.js';
import {LEVELS} from '../dist/core.js';
// The server cannot import the game's level table, so the two are held together here instead:
// a maze added to the game without a line in MAZE_LEVELS fails this rather than silently
// rejecting every time players set on it.
const mazes=LEVELS.map((l,i)=>[i,l]).filter(([,l])=>l.mode==='race');
assert.deepEqual(Object.keys(MAZE_LEVELS).map(Number),mazes.map(([i])=>i),'server maze leaderboard indices must match the race levels');
assert.deepEqual(Object.values(MAZE_LEVELS),mazes.map(([,l])=>l.size),'server maze sizes must match the race levels');
assert.equal(LEVEL_COUNT,LEVELS.length,'server circuit bounds must match the number of levels');
const MAZE=mazes.at(-2)[0];
import {openDatabase} from '../server/sqlite-adapter.mjs';
const DB=await openDatabase(':memory:');
// The post room: every confirmation the server sends is captured here rather than delivered, so the
// whole signup can be walked exactly as a player would walk it.
const posted=[];const realFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{posted.push({url:String(url),...JSON.parse(init.body)});return new Response('{}',{status:200});};
const MAIL={MAIL_URL:'https://post.test/send',MAIL_TOKEN:'sekrit'};
const api=async(path,body={},env=MAIL)=>{const response=await worker.fetch(new Request('https://game.test/api/'+path,{method:'POST',headers:{'content-type':'application/json','origin':'https://game.test'},body:JSON.stringify(body)}),{DB,...env});return{status:response.status,...await response.json()};};
const confirmToken=()=>new URL(posted.at(-1).link).searchParams.get('confirm');
const saved=await api('player/save',{name:'SPUD CHAMP',motto:'Clogs on, Game on'});assert.equal(saved.status,200);const playerToken=saved.playerToken;
assert.equal((await api('player/get',{playerToken:'forged'})).status,401);
const changed=await api('player/save',{playerToken,name:'THE KLOMPEN',motto:'Totally Mash'});assert.equal(changed.player.id,saved.player.id);
const unplayed=await api('scores/start',{playerToken,level:0,duration:120,mode:'solo'});assert.equal((await api('scores/finish',{playerToken,run:unplayed.run,score:0,rounds:0,wins:0,knockouts:0,durations:[],times:[{level:MAZE,milliseconds:1000}]})).status,400);
const session=await api('scores/start',{playerToken,level:0,duration:120,mode:'online'});const payload={playerToken,run:session.run,score:21,rounds:LEVELS.length,wins:6,knockouts:8,complete:true,durations:Array(LEVELS.length).fill(120),times:[{level:1,milliseconds:35000}]};assert.equal((await api('scores/finish',payload)).status,400);
await DB.prepare('UPDATE runs SET started=? WHERE id=?').bind(Date.now()-(LEVELS.length*120+60)*1000,session.run).run();assert.equal((await api('scores/finish',payload)).saved,true);
assert.equal((await api('scores/finish',{...payload,score:39,times:[{level:1,milliseconds:1000}]})).saved,true);
let profile=await api('player/get',{playerToken});assert.equal(profile.stats.rounds,LEVELS.length);assert.equal(profile.stats.wins,6);assert.equal(profile.stats.bestCircuit,21);
// Nothing ranks until the address behind the name has been read. That is the whole anti-abuse
// story, so it is checked before the board is checked for anything else.
assert.equal((await api('scores/leaderboard')).rows.length,0,'an unconfirmed player does not appear on the board');
const signup=await api('player/save',{playerToken,name:'THE KLOMPEN',email:' Chip@Example.COM '});
assert.equal(signup.status,200);assert.equal(signup.sent,true);assert.equal(signup.player.verified,false);
assert.equal(posted.at(-1).to,'Chip@Example.COM','the address is written to as the player typed it');
assert.equal(posted.at(-1).url,MAIL.MAIL_URL);assert.ok(posted.at(-1).text.includes(posted.at(-1).link));
assert.equal((await api('scores/leaderboard')).rows.length,0,'and still does not while the link is unclicked');
assert.equal((await api('player/verify',{verifyToken:'made-up'})).status,410);
const confirmed=await api('player/verify',{verifyToken:confirmToken()});
assert.equal(confirmed.player.verified,true);assert.equal(confirmed.playerToken,playerToken);
assert.equal((await api('player/verify',{verifyToken:confirmToken()})).status,410,'a confirmation link works once');
let board=await api('scores/leaderboard');assert.equal(board.rows[0].score,2100);assert.equal(board.rows[0].name,'THE KLOMPEN');assert.ok(!JSON.stringify(board).includes(playerToken));
board=await api('scores/leaderboard',{level:1});assert.equal(board.rows[0].milliseconds,35000);assert.equal((await api('scores/leaderboard',{mode:'solo'})).rows.length,0);
const partial=await api('scores/start',{playerToken,level:MAZE,duration:120,mode:'solo'});await DB.prepare('UPDATE runs SET started=? WHERE id=?').bind(Date.now()-240000,partial.run).run();await api('scores/finish',{playerToken,run:partial.run,score:6,rounds:2,wins:2,knockouts:0,complete:true,durations:[120,120],times:[{level:MAZE,milliseconds:51000}]});profile=await api('player/get',{playerToken});assert.equal(profile.stats.rounds,LEVELS.length+2);assert.equal(profile.stats.bestCircuit,21);assert.equal((await api('scores/leaderboard',{level:MAZE})).rows[0].milliseconds,51000);
console.log('PASS durable profile update, ownership, circuit qualification, idempotent score save, per-maze ranking and mode filters');// Every playthrough is eligible, including an unfinished first round.
const second=await api('player/save',{name:"Zoë O’Neil",motto:'Test player',email:'zoe@example.org'}),token2=second.playerToken,runId=crypto.randomUUID();assert.equal(second.player.name,"Zoë O’Neil");
await api('player/verify',{verifyToken:confirmToken()});
// One address, one player. Otherwise the confirmation buys nothing.
assert.equal((await api('player/save',{name:'IMPOSTOR',email:'ZOE@example.org'})).status,409);
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

// The rest of the signup: an address nobody can write to is refused outright, a changed address
// costs the player their ranking until they read the new one, resends are spaced, and a player can
// take their address and everything attached to it away again.
{
 assert.equal((await api('player/save',{name:'NO POST',email:'someone@example.net'},{})).status,501,'a server with nowhere to send mail does not collect addresses');
 for(const bad of['plainly-not','two@@at.com','who@','@nowhere.org','a@b','some one@example.org']){
  assert.equal((await api('player/save',{name:'BAD POST',email:bad})).status,400,`"${bad}" is not an address`);
 }
 assert.equal((await api('player/save',{name:'NO ADDRESS',email:'   '})).player.verified,false,'a blank address is no address, not a bad one');
 const mover=await api('player/save',{name:'MOVER',email:'first@example.org'});
 await api('player/verify',{verifyToken:confirmToken()});
 assert.equal((await api('player/get',{playerToken:mover.playerToken})).player.verified,true);
 const moved=await api('player/save',{playerToken:mover.playerToken,name:'MOVER',email:'second@example.org'});
 assert.equal(moved.player.verified,false,'a new address has not been read, so it has not been confirmed');
 assert.equal(posted.at(-1).to,'second@example.org');
 assert.equal((await api('player/resend',{playerToken:mover.playerToken})).status,429,'a resend straight after the first is refused');
 await DB.prepare('UPDATE profiles SET verify_sent=? WHERE token=?').bind(Date.now()-600000,mover.playerToken).run();
 assert.equal((await api('player/resend',{playerToken:mover.playerToken})).sent,true);
 await api('player/verify',{verifyToken:confirmToken()});
 assert.equal((await api('player/get',{playerToken:mover.playerToken})).player.verified,true);
 assert.equal((await api('player/resend',{playerToken:mover.playerToken})).status,400,'there is nothing to resend once it is confirmed');
 assert.equal((await api('player/forget',{playerToken:mover.playerToken})).forgotten,true);
 assert.equal((await api('player/get',{playerToken:mover.playerToken})).status,401,'and afterwards that player is gone');
 assert.equal((await api('player/save',{name:'SOMEBODY ELSE',email:'second@example.org'})).status,200,'which frees the address again');
 globalThis.fetch=realFetch;
 console.log('PASS scores rank only for a confirmed address: one player per address, re-confirmation on a change, spaced resends and a way out');
}

DB.close();

// Plain file hosting has no /api. The game must still get a named player and keep scores, because
// that is exactly what an IONOS webspace upload looks like from the browser.
const store=new Map();
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const nodes=new Map();
globalThis.document={querySelectorAll:()=>[],getElementById:id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,open:false,dataset:{},style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},focus(){},showModal(){this.open=true;},close(){this.open=false;},addEventListener(){},onclick:null});return nodes.get(id);},addEventListener(){}};
globalThis.addEventListener=()=>{};globalThis.setInterval=()=>({unref(){}});
globalThis.fetch=async()=>new Response('<!doctype html>',{status:404,headers:{'content-type':'text/html'}});
const {playerAccount}=await import('../dist/profiles.js');
playerAccount.queue={put(){},flush:async()=>{},items:{}};
// A reply that simply took too long is not a host with no server behind it. Latching on one slow
// request left rooms and the shared leaderboard switched off for the rest of the page.
{
 const server=globalThis.fetch;
 globalThis.fetch=async()=>{throw Object.assign(new Error('signal timed out'),{name:'TimeoutError'});};
 await assert.rejects(playerAccount.api('player/get'),e=>{assert.equal(e.offline,false,'a timeout is a slow server, not an absent one');return true;});
 assert.equal(playerAccount.offline,false,'and it must not latch the whole session offline');
 globalThis.fetch=async()=>{throw Object.assign(new Error('aborted'),{name:'AbortError'});};
 await assert.rejects(playerAccount.api('player/get'),e=>{assert.equal(e.offline,false);return true;});
 globalThis.fetch=async()=>{throw Object.assign(new TypeError('Failed to fetch'));};
 await assert.rejects(playerAccount.api('player/get'),e=>{assert.equal(e.offline,true,'a connection that cannot be made is still an absent host');return true;});
 globalThis.fetch=server;
 console.log('PASS a slow reply is a slow server; only an unreachable one drops the game to local scores');
}
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

// The address of the room and score service is the one thing a player editing config.js on a shared
// web host can get wrong, so every shape of wrong is rejected rather than turned into a dead URL.
{
 const api=await import('../dist/api.js');
 const set=value=>{if(value===undefined)delete globalThis.POTATOMAN_API;else globalThis.POTATOMAN_API=value;};
 globalThis.document={querySelector:()=>null};
 set(undefined);assert.equal(api.apiBase(),'','with nothing configured the game talks to its own origin');
 assert.equal(api.apiURL('player/get'),'/api/player/get');
 assert.equal(api.apiRemote(),false);
 set('https://rooms.example.com/');assert.equal(api.apiBase(),'https://rooms.example.com','a trailing slash cannot double up');
 assert.equal(api.apiURL('/rooms/create'),'https://rooms.example.com/api/rooms/create');
 assert.equal(api.apiRemote(),true);
 for(const bad of['rooms.example.com','  ','https://','ftp://rooms.example.com','javascript:alert(1)',42,null])
  {set(bad);assert.equal(api.apiBase(),'',`a host written as ${JSON.stringify(bad)} must fall back to this origin, not build a broken URL`);}
 set(undefined);globalThis.document={querySelector:selector=>selector==='meta[name="potatoman-api"]'?{content:'https://meta.example.com'}:null};
 assert.equal(api.apiBase(),'https://meta.example.com','a meta tag works for hosts that cannot add a script');
 globalThis.POTATOMAN_API='https://wins.example.com';assert.equal(api.apiBase(),'https://wins.example.com','an explicit setting outranks the tag');
 delete globalThis.POTATOMAN_API;delete globalThis.document;
 console.log('PASS the configured service address is validated, normalised and defaults to this origin');
}
