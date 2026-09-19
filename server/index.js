import {profileAPI} from './profiles.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const failure=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const now=()=>Date.now();
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const cleanName=v=>typeof v==='string'?v.replace(/[^\p{L}\p{M}0-9 '’_-]/gu,'').trim().slice(0,24)||'SPUD':'SPUD';
export function cleanInput(v){if(!v||typeof v!=='object')return null;const n=(k,min,max)=>Number.isFinite(v[k])?Math.max(min,Math.min(max,v[k])):0;return{epoch:typeof v.epoch==='string'?v.epoch.slice(0,64):'',seq:n('seq',0,1e12),x:n('x',-1,1),z:n('z',-1,1),yaw:n('yaw',-100000,100000),pitch:n('pitch',-.85,.70),fire:v.fire===true,crouch:v.crouch===true,crouchSerial:n('crouchSerial',0,1e12),zoom:n('zoom',3,9)||5.6,dodge:n('dodge',0,1e12),catch:n('catch',0,1e12),jump:n('jump',0,1e12)};}
// A game uploaded to plain web hosting has to reach this service on a different origin. Only the
// origins the operator listed in POTATOMAN_ALLOWED_ORIGINS may do so; every other cross-origin
// request is still refused, which is what keeps the same-origin rule doing its job.
export default {async fetch(request,env){const url=new URL(request.url);if(!url.pathname.startsWith('/api/')){const asset=await env.ASSETS.fetch(request);if(url.pathname==='/'||/\.(html|js|css)$/.test(url.pathname)){const response=new Response(asset.body,asset);response.headers.set('cache-control','no-cache');return response;}return asset;}
 const origin=request.headers.get('origin'),foreign=!!origin&&origin!==url.origin,permitted=!foreign||(env.ORIGINS??[]).includes(origin);
 const response=request.method==='OPTIONS'?new Response(null,{status:permitted?204:403}):await rooms(request,env,url,permitted);
 response.headers.set('vary','origin');
 if(foreign&&permitted)for(const [key,value]of Object.entries({'access-control-allow-origin':origin,'access-control-allow-headers':'content-type','access-control-allow-methods':'POST,OPTIONS','access-control-max-age':'86400'}))response.headers.set(key,value);
 return response;
}};
async function rooms(request,env,url,permitted){
 try{
  if(!env.DB)return json({error:'Online rooms are not configured on this host.'},503);
  if(request.method!=='POST')return json({error:'Use POST.'},405);
  if(!permitted)return json({error:'Origin not allowed.'},403);
  const raw=await request.text();if(raw.length>110000)return json({error:'Request too large.'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
  const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
  const sql=(s,...args)=>db.prepare(s).bind(...args);const at=now();const profileResponse=await profileAPI(url.pathname,body,db,{...env,ORIGIN:env.ORIGIN??url.origin});if(profileResponse)return profileResponse;
  if(url.pathname==='/api/rooms/create'){
   const code=Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join(''),secret=token();
   await db.batch([sql('DELETE FROM rooms WHERE updated < ?',at-7200000),sql('INSERT INTO rooms(code,created,updated) VALUES(?,?,?)',code,at,at),sql('INSERT INTO members(room,slot,token,name,seen,generation) VALUES(?,0,?,?,?,?)',code,secret,cleanName(body.name),at,crypto.randomUUID())]);
   return json({code,slot:0,token:secret});
  }
  const code=String(body.code??'').toUpperCase();if(!/^[A-Z2-9]{10}$/.test(code))failure('Enter the 10-character room code.');
  const room=await sql('SELECT * FROM rooms WHERE code=?',code).first();if(!room||room.updated<at-90000)failure('This room has closed or expired. Create a new room.',404);
  if(url.pathname==='/api/rooms/join'){
   if(room.status!=='lobby')failure('This match has started. Join a new room.',409);
   const secret=token();await sql("INSERT INTO members(room,slot,token,name,seen,generation) SELECT ?,s.slot,?,?,?,? FROM (SELECT 1 AS slot UNION ALL SELECT 2) s WHERE NOT EXISTS(SELECT 1 FROM members m WHERE m.room=? AND m.slot=s.slot) AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='lobby') ORDER BY s.slot LIMIT 1",code,secret,cleanName(body.name),at,crypto.randomUUID(),code,code).run();
   const member=await sql('SELECT slot FROM members WHERE room=? AND token=?',code,secret).first();if(!member)failure('This room is full or the match just started.',409);return json({code,slot:member.slot,token:secret});
  }
  const member=await sql('SELECT * FROM members WHERE room=? AND token=?',code,String(body.token??'')).first();if(!member)failure('Your room connection has expired. Rejoin the room.',403);
  if(url.pathname==='/api/rooms/leave'){
   if(member.slot===0)await sql('DELETE FROM rooms WHERE code=?',code).run();else await db.batch([sql('DELETE FROM signals WHERE room=? AND (sender=? OR recipient=?)',code,member.slot,member.slot),sql('DELETE FROM members WHERE room=? AND slot=?',code,member.slot)]);return json({ok:true});
  }
  if(url.pathname!=='/api/rooms/exchange')return json({error:'Not found.'},404);
  const statements=[];
  if(member.slot===0){
   if(body.start===true&&room.status==='lobby'){const count=await sql('SELECT COUNT(*) AS n FROM members WHERE room=? AND seen>=?',code,at-30000).first();if(count.n!==3)failure('Three players are required to start. Online matches have no bots.',409);}
   statements.push(sql('UPDATE rooms SET updated=?, status=CASE WHEN ?=1 THEN ? ELSE status END WHERE code=?',at,body.start===true?1:0,'playing',code));
   statements.push(sql('DELETE FROM members WHERE room=? AND slot<>0 AND seen<?',code,at-30000));
   if(body.snapshot&&Number.isInteger(body.snapshot.seq)&&body.snapshot.seq>room.seq){const snapshot=JSON.stringify(body.snapshot);if(snapshot.length>90000)failure('Match update too large.');statements.push(sql('UPDATE rooms SET snapshot=?,seq=? WHERE code=? AND seq<?',snapshot,body.snapshot.seq,code,body.snapshot.seq));}
  }
  const input=cleanInput(body.input);if(input&&input.seq>member.input_seq)statements.push(sql('UPDATE members SET seen=?,input=?,input_seq=? WHERE room=? AND slot=? AND input_seq<?',at,JSON.stringify(input),input.seq,code,member.slot,input.seq));else statements.push(sql('UPDATE members SET seen=? WHERE room=? AND slot=?',at,code,member.slot));
  if(Array.isArray(body.signals))for(const signal of body.signals.slice(0,3)){
   if(!Number.isInteger(signal.to)||signal.to<0||signal.to>2||(member.slot!==0&&signal.to!==0)||signal.to===member.slot)failure('Invalid signal recipient.');
   if(!signal.description||!['offer','answer'].includes(signal.description.type)||typeof signal.description.sdp!=='string'||signal.description.sdp.length>20000)failure('Invalid connection signal.');
   statements.push(sql('INSERT INTO signals(room,sender,recipient,description) VALUES(?,?,?,?) ON CONFLICT(room,sender,recipient) DO UPDATE SET description=excluded.description',code,member.slot,signal.to,JSON.stringify(signal.description)));
  }
  await db.batch(statements);
  const [current,roster,signals]=await Promise.all([sql('SELECT status,snapshot,updated FROM rooms WHERE code=?',code).first(),sql('SELECT slot,name,seen,input,input_seq,generation FROM members WHERE room=? ORDER BY slot',code).all(),sql('SELECT sender,description FROM signals WHERE room=? AND recipient=?',code,member.slot).all()]);
  if(!current)failure('The host closed this room.',410);
  return json({status:current.status,hostSeen:current.updated,roster:roster.results.map(m=>({slot:m.slot,name:m.name,seen:m.seen,generation:m.generation,...(member.slot===0?{input:m.input?JSON.parse(m.input):null}:{})})),signals:signals.results.map(s=>({from:s.sender,description:JSON.parse(s.description)})),snapshot:member.slot!==0&&current.snapshot?JSON.parse(current.snapshot):null});
 }catch(e){if(!e.status)console.error('Room service error:',e.message);return json({error:e.status?e.message:'Online rooms are temporarily unavailable. Try again.'},e.status??503);}
}
