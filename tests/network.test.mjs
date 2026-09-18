import assert from 'node:assert/strict';
import worker from '../server/index.js';
import {openDatabase} from '../server/sqlite-adapter.mjs';
import {RoomConnection} from '../dist/network.js';
import {remoteControl,packPlayer,unpackPlayer} from '../dist/net-state.js';
const DB=await openDatabase(':memory:');
const request=async(action,body={})=>{const response=await worker.fetch(new Request('https://game.test/api/rooms/'+action,{method:'POST',headers:{'content-type':'application/json','origin':'https://game.test'},body:JSON.stringify(body)}),{DB});return{status:response.status,data:await response.json()};};
const room=(await request('create',{name:'<HOST>'})).data;assert.equal(room.slot,0);assert.equal(room.code.length,10);
assert.equal((await request('exchange',{...room,start:true})).status,409,'one player cannot start an online match');
const guests=await Promise.all([1,2].map(async i=>(await request('join',{code:room.code,name:'SPUD '+i})).data));assert.deepEqual(guests.map(g=>g.slot).sort(),[1,2]);assert.equal((await request('join',{code:room.code})).status,409);
const denied=await request('exchange',{...room,token:'wrong'});assert.equal(denied.status,403);
let sync=(await request('exchange',room)).data;assert.equal(sync.roster.length,3);assert.equal(sync.roster[0].name,'HOST');assert.ok(sync.roster.every(m=>m.generation));assert.ok(!JSON.stringify(sync).includes(room.token));
await request('exchange',{...guests[0],input:{seq:3,epoch:'one',x:100,z:0,yaw:Infinity,pitch:5,fire:true,dodge:1,catch:0},snapshot:{seq:999}});
await request('exchange',{...guests[0],input:{seq:2,epoch:'one',x:-1}});
sync=(await request('exchange',{...room,start:true,snapshot:{seq:1,test:'authoritative'}})).data;assert.equal(sync.status,'playing');assert.equal(sync.roster.find(m=>m.slot===guests[0].slot).input.seq,3);assert.equal(sync.roster.find(m=>m.slot===guests[0].slot).input.x,1);assert.equal((await request('join',{code:room.code})).status,409);
const received=(await request('exchange',guests[0])).data;assert.equal(received.snapshot.test,'authoritative');assert.equal(received.snapshot.seq,1);assert.ok(received.roster.every(m=>!('input'in m)));
await request('leave',room);assert.equal((await request('exchange',guests[0])).status,404);
console.log('PASS three-player room creation/join, capacity, tokens, slot ownership, ordered input, host snapshots, match lock and host leave');
// Exercise the real transport against the real API/database, without a browser or WebRTC.
const savedFetch=globalThis.fetch;globalThis.fetch=(url,init)=>worker.fetch(new Request('https://game.test'+url,init),{DB});
const host=new RoomConnection(),guest=new RoomConnection();await host.connect('create','HOST');await guest.connect('join','GUEST',host.code);const third=new RoomConnection();await third.connect('join','THIRD',host.code);clearTimeout(third.timer);clearTimeout(host.timer);clearTimeout(guest.timer);
await host.poll();clearTimeout(host.timer);host.latestSnapshot={version:10,seq:1,test:'relay'};host.startRequested=true;await host.poll();clearTimeout(host.timer);
let snapshot;guest.callbacks.snapshot=s=>snapshot=s;guest.input({x:1,z:0,fire:true,dodge:true,catch:false},{yaw:.3,pitch:0},'epoch-one');await guest.poll();clearTimeout(guest.timer);assert.equal(snapshot.test,'relay');await host.poll();clearTimeout(host.timer);assert.equal(host.remoteInputs.get(1).data.fire,true);
const p={yaw:0,pitch:0},edges={};assert.equal(remoteControl(host.remoteInputs.get(1).data,p,'epoch-one',edges,0).dodge,true);assert.equal(remoteControl(host.remoteInputs.get(1).data,p,'epoch-one',edges,1).dodge,false);assert.deepEqual(remoteControl(host.remoteInputs.get(1).data,p,'epoch-one',edges,600),{x:0,z:0,fire:false,catch:false,dodge:false,jump:false,crouch:false});
const newRound=guest.input({x:0,z:0,fire:false,dodge:false,catch:false},{yaw:0,pitch:0},'epoch-two');assert.equal(newRound.dodge,0);assert.equal(remoteControl(newRound,p,'epoch-two',{},0).dodge,false);
await guest.close();await third.close();await host.close();globalThis.fetch=savedFetch;console.log('PASS real host/guest HTTP relay, edge presses, stale-input stop and no phantom next-round actions');
// A Start click during an older poll must survive that response.
const delayed=new RoomConnection();delayed.active=true;delayed.isHost=true;delayed.roster=[];let resolve;delayed.request=()=>new Promise(r=>resolve=r);const pending=delayed.poll();delayed.startRequested=true;resolve({roster:[],signals:[],status:'lobby'});await pending;clearTimeout(delayed.timer);assert.equal(delayed.startRequested,true);await delayed.close(false);
// Closing an in-flight request must suppress all callbacks.
const closing=new RoomConnection();closing.active=true;closing.isHost=true;let callback=false,reply;closing.callbacks.roster=()=>callback=true;closing.request=()=>new Promise(r=>reply=r);const flight=closing.poll();await closing.close(false);reply({roster:[],signals:[],status:'lobby'});await flight;assert.equal(callback,false);
console.log('PASS start-click race and in-flight close cannot corrupt room lifecycle');
const record={weaponLevel:2,roundWins:3,kills:4,id:1,name:'SPUD',knockouts:0,points:0,played:0,weapon:'spud',x:0,y:0,z:0,vx:0,vy:0,vz:0,grounded:true,crouching:false,courseDuckEntry:0,runBoost:0,fireBoost:0,jumpBoost:0,courseStep:0,yaw:0,pitch:0,hp:100,score:0,total:0,attempt:0,respawn:0,invuln:0,throwCD:0,catchCD:0,catchTime:0,dashCD:0,dashTime:0,dashX:0,dashZ:0,shotAnim:0,pendingThrow:0,gun:false,mag:12,reload:0,runner:false,best:Infinity,checks:[false,false]};assert.equal(unpackPlayer(JSON.parse(JSON.stringify(packPlayer(record)))).best,Infinity);
// Every weapon the game can actually hand out has to survive the wire. The whitelist here was
// written out by hand and went stale the moment the weapon box started rotating through the new
// launchers: an unpackable weapon fails validSnapshot, and the host's packets are then dropped
// silently for the rest of the round.
const {WEAPONS}=await import('../dist/weapons.js');
for(const weapon of Object.keys(WEAPONS))assert.equal(unpackPlayer(JSON.parse(JSON.stringify(packPlayer({...record,weapon}))))?.weapon,weapon,weapon+' must survive an online snapshot');
assert.equal(unpackPlayer(JSON.parse(JSON.stringify(packPlayer({...record,weapon:'trebuchet'})))),null,'an unknown weapon is still rejected');
const packed=unpackPlayer(JSON.parse(JSON.stringify(packPlayer(record))));assert.equal(packed.weaponLevel,2);assert.equal(packed.roundWins,3);assert.equal(packed.kills,4);assert.equal(packed.cameraDistance,4.6);assert.equal(packed.visualShotSpeed,32);const aimed=unpackPlayer(packPlayer({...record,cameraDistance:8,visualShotSpeed:28.8,pendingThrow:.08}));assert.equal(aimed.cameraDistance,8);assert.equal(aimed.visualShotSpeed,28.8);assert.equal(aimed.pendingThrow,.08);
console.log('PASS race DNF, progression and crowns survive snapshot serialization');DB.close();

assert.equal(unpackPlayer(packPlayer({...record,shotDuration:.3286})).shotDuration,.3286);console.log('PASS shortened throw duration survives network round trip');

// Plain web hosting can serve the game but not this service, so the game has to be able to call it
// on another host. That is exactly the cross-origin request the CSRF guard exists to refuse, so it
// is allowed only for origins the operator listed and refused for every other.
const SITE='https://potatoman.co.uk',CORS_DB=await openDatabase(':memory:');
const call=(method,origin,env)=>worker.fetch(new Request('https://rooms.test/api/rooms/create',{method,headers:{'content-type':'application/json',...(origin?{origin}:{})},...(method==='POST'?{body:'{"name":"SPUD"}'}:{})}),{DB:CORS_DB,...env});
const listed={ORIGINS:[SITE]};
assert.equal((await call('POST',SITE,listed)).status,200,'a listed site may create a room from its own origin');
assert.equal((await call('POST',SITE,listed)).headers.get('access-control-allow-origin'),SITE,'and the browser is told so');
assert.equal((await call('POST','https://someone-else.example',listed)).status,403,'an unlisted origin is still refused');
assert.equal((await call('POST','https://someone-else.example',listed)).headers.get('access-control-allow-origin'),null,'and gets no permission header');
assert.equal((await call('POST',SITE,{})).status,403,'with nothing listed, cross-origin stays shut');
assert.equal((await call('POST','https://rooms.test',listed)).status,200,'the service always serves the page it hosts itself');
assert.equal((await call('POST',null,listed)).status,200,'requests with no origin at all are unaffected');
const preflight=await call('OPTIONS',SITE,listed);assert.equal(preflight.status,204);
assert.equal(preflight.headers.get('access-control-allow-headers'),'content-type','the JSON content type is what forces the preflight');
assert.equal(preflight.headers.get('vary'),'origin','a shared cache must not serve one origin the answer meant for another');
assert.equal((await call('OPTIONS','https://someone-else.example',listed)).status,403);
CORS_DB.close();
console.log('PASS the room service answers a listed game host cross-origin, including preflight, and refuses every other');
