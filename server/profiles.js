const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const number=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
// Level index -> maze grid size, for the ranked escape boards. The server cannot import the game's
// level table, so this is checked against it by tests/profiles.test.mjs; a maze added to the game
// without a line here fails that test rather than silently rejecting every time players set on it.
export const MAZE_LEVELS={1:15,4:19,7:21,12:23,15:25,20:27};
// Everything the server bounds about a circuit follows from how many levels there are: the highest
// level a run may start on, how many rounds it may report, and the most circuit points a player can
// come away with (three for winning each main round, one for each hunt between them). These were
// written out as 9, 10 and 39 for a ten-level circuit and quietly rejected every save once the
// circuit grew. tests/profiles.test.mjs checks LEVEL_COUNT against the game's level list.
export const LEVEL_COUNT=22;
const MAX_TOTAL=LEVEL_COUNT*3+(LEVEL_COUNT-1);
const isMaze=level=>Object.hasOwn(MAZE_LEVELS,level);
// A board anybody can type a name into is a board nobody believes. Ranking is for players who have
// proved they can read an address they gave us, which costs an honest player one click and costs
// somebody minting a hundred aliases a hundred real mailboxes.
const EMAIL=/^[^\s@,;:<>"'\\]{1,64}@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const cleanEmail=value=>{const text=typeof value==='string'?value.trim():'';if(!text)return '';if(text.length>254||!EMAIL.test(text))fail('Enter an email address we can actually write to.');return text;};
const RESEND_GAP=120000;
// Delivery is somebody else's job. POTATOMAN_MAIL_URL is posted the address and the link, so an
// operator can point it at whatever they already send mail with; without one, the server says so
// rather than pretending an address was confirmed.
async function sendVerification(env,to,name,link){
 const endpoint=env?.MAIL_URL;if(!endpoint)return false;
 const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(env.MAIL_TOKEN?{authorization:'Bearer '+env.MAIL_TOKEN}:{})},
  body:JSON.stringify({to,name,link,subject:'Confirm your Potatoman scoreboard name',
   text:`Hello ${name},\n\nConfirm this address to have your scores ranked on the Potatoman leaderboard:\n${link}\n\nIf you did not ask for this, ignore it and nothing happens. The link stops working once it is used.`})});
 if(!response.ok)fail('Could not send the confirmation email. Try again shortly.',502);
 return true;
}
const publicPlayer=profile=>({id:profile.id,name:profile.name,motto:profile.motto,email:profile.email??'',verified:!!profile.verified});
export async function profileAPI(path,body,db,env){if(!path.startsWith('/api/player/')&&!path.startsWith('/api/scores/'))return null;
 const sql=(s,...args)=>db.prepare(s).bind(...args);
 if(path==='/api/scores/leaderboard'){
  const level=body.level,filter=['solo','local','online'].includes(body.mode)?body.mode:null;
  if(level!==undefined&&!isMaze(level))fail('Choose a maze leaderboard.');
  const rows=level===undefined?await sql('SELECT p.id,p.name,p.motto,MAX(CASE WHEN r.revision>0 THEN r.points ELSE r.score*100 END) AS score,COUNT(r.id) AS circuits FROM runs r JOIN profiles p ON p.id=r.profile WHERE p.verified=1 AND (r.rounds>0 OR r.played_ms>0) AND (? IS NULL OR r.mode=?) GROUP BY p.id ORDER BY score DESC,p.name ASC LIMIT 50',filter,filter).all():await sql('SELECT p.id,p.name,p.motto,MIN(t.milliseconds) AS milliseconds FROM race_times t JOIN runs r ON r.id=t.run JOIN profiles p ON p.id=r.profile WHERE p.verified=1 AND t.level=? AND (r.finished IS NOT NULL OR r.revision>0) AND (? IS NULL OR r.mode=?) GROUP BY p.id ORDER BY milliseconds ASC,p.name ASC LIMIT 50',level,filter,filter).all();return json({rows:rows.results});
 }
 let profile=body.playerToken?await sql('SELECT * FROM profiles WHERE token=?',String(body.playerToken)).first():null;
 if(path==='/api/player/verify'){
  const token=typeof body.verifyToken==='string'?body.verifyToken:'';
  const claimed=token?await sql('SELECT * FROM profiles WHERE verify_token=?',token).first():null;
  if(!claimed)fail('That confirmation link has already been used, or it has expired.',410);
  await sql('UPDATE profiles SET verified=1,verify_token=NULL WHERE id=?',claimed.id).run();
  return json({player:publicPlayer({...claimed,verified:1}),playerToken:claimed.token});
 }
 if(path==='/api/player/save'){
  const name=typeof body.name==='string'?body.name.replace(/[^\p{L}\p{M}0-9 '’_-]/gu,'').trim().slice(0,24):'',motto=typeof body.motto==='string'?body.motto.trim().slice(0,60):'';if(name.length<2)fail('Enter your name with at least two characters.');
  if(body.playerToken&&!profile)fail('This player profile is unavailable.',403);
  const email=cleanEmail(body.email),key=email.toLowerCase();
  if(email&&!env?.MAIL_URL)fail('This server cannot confirm email addresses, so it does not take them. Your scores are still saved.',501);
  if(email){const taken=await sql('SELECT id FROM profiles WHERE email_key=?',key).first();if(taken&&taken.id!==profile?.id)fail('That address already has a player on this scoreboard.',409);}
  const at=Date.now();
  if(profile)await sql('UPDATE profiles SET name=?,motto=? WHERE id=?',name,motto,profile.id).run();
  else{profile={id:crypto.randomUUID(),token:crypto.randomUUID()+crypto.randomUUID(),verified:0};await sql('INSERT INTO profiles(id,token,name,motto,created) VALUES(?,?,?,?,?)',profile.id,profile.token,name,motto,at).run();}
  // Changing the address un-verifies the player: the point of the confirmation is that this
  // particular address was read, and a new one has not been.
  let sent=false;
  if(email&&email.toLowerCase()!==(profile.email_key??'')){
   const verifyToken=crypto.randomUUID()+crypto.randomUUID();
   sent=await sendVerification(env,email,name,`${env.ORIGIN}/?confirm=${verifyToken}`);
   await sql('UPDATE profiles SET email=?,email_key=?,verified=0,verify_token=?,verify_sent=? WHERE id=?',email,key,verifyToken,at,profile.id).run();
   profile={...profile,email,email_key:key,verified:0};
  }
  const saved=await sql('SELECT * FROM profiles WHERE id=?',profile.id).first();
  return json({player:publicPlayer(saved),playerToken:saved.token,sent});
 }
 if(path==='/api/player/resend'){
  if(!profile)fail('Set up your player profile first.',401);
  if(!profile.email)fail('Add an email address first.');
  if(profile.verified)fail('That address is already confirmed.');
  if(Date.now()-profile.verify_sent<RESEND_GAP)fail('A confirmation was sent a moment ago. Check the address, including its spam folder.',429);
  const verifyToken=profile.verify_token||crypto.randomUUID()+crypto.randomUUID();
  const sent=await sendVerification(env,profile.email,profile.name,`${env.ORIGIN}/?confirm=${verifyToken}`);
  await sql('UPDATE profiles SET verify_token=?,verify_sent=? WHERE id=?',verifyToken,Date.now(),profile.id).run();
  return json({sent});
 }
 if(path==='/api/player/forget'){
  // A player who gave us an address can take it and everything attached to it away again. Runs and
  // race times hang off the profile with ON DELETE CASCADE, so one row is the whole of it.
  if(!profile)fail('Set up your player profile first.',401);
  await sql('DELETE FROM profiles WHERE id=?',profile.id).run();
  return json({forgotten:true});
 }
 if(!profile)fail('Set up your player profile to save scores.',401);
 if(path==='/api/player/get'){
  const stats=await sql('SELECT COALESCE(SUM(rounds),0) AS rounds,COALESCE(SUM(wins),0) AS wins,COALESCE(SUM(knockouts),0) AS knockouts,MAX(CASE WHEN complete=1 THEN score END) AS bestCircuit,MAX(CASE WHEN revision>0 THEN points ELSE score*100 END) AS bestScore FROM runs WHERE profile=? AND (rounds>0 OR played_ms>0)',profile.id).first();return json({player:publicPlayer(profile),stats});
 }
 if(path==='/api/scores/start'){
  if(!number(body.level,0,LEVEL_COUNT-1)||!number(body.duration,60,600)||body.duration%30||!['solo','local','online'].includes(body.mode))fail('Invalid circuit settings.');
  const id=body.run??crypto.randomUUID();if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))fail('Invalid score session.');
  await sql('INSERT INTO runs(id,profile,started,start_level,round_seconds,mode) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',id,profile.id,Date.now(),body.level,body.duration,body.mode).run();
  const existing=await sql('SELECT * FROM runs WHERE id=?',id).first();if(existing.profile!==profile.id||existing.start_level!==body.level||existing.round_seconds!==body.duration||existing.mode!==body.mode)fail('This score session belongs to different settings.',409);return json({run:id});
 }
 if(path==='/api/scores/save'){
  const run=await sql('SELECT * FROM runs WHERE id=? AND profile=?',String(body.run??''),profile.id).first();if(!run)fail('This score session is unavailable.',404);
  if(!number(body.revision,1,1000000)||!number(body.points,0,1000000)||!number(body.playedMs,0,7200000)||!number(body.score,0,MAX_TOTAL)||!number(body.rounds,0,LEVEL_COUNT-run.start_level)||!number(body.wins,0,body.rounds)||!number(body.knockouts,0,2000))fail('Invalid score progress.');
  if(body.revision<=run.revision)return json({saved:true,revision:run.revision,complete:!!run.complete});
  if(body.points<run.points||body.playedMs<run.played_ms||body.rounds<run.rounds||body.wins<run.wins||body.knockouts<run.knockouts)fail('Score progress cannot go backwards.');
  const times=Array.isArray(body.times)?body.times:[];if(times.length>Object.keys(MAZE_LEVELS).length||new Set(times.map(t=>t.level)).size!==times.length||times.some(t=>!isMaze(t.level)||t.level<run.start_level||t.level>run.start_level+body.rounds||!number(t.milliseconds,1000,600000)))fail('Invalid maze time.');
  const complete=run.start_level===0&&body.rounds===LEVEL_COUNT,statements=[];
  for(const t of times)statements.push(sql('INSERT INTO race_times(run,level,milliseconds) SELECT id,?,? FROM runs WHERE id=? AND revision<? ON CONFLICT(run,level) DO UPDATE SET milliseconds=MIN(milliseconds,excluded.milliseconds)',t.level,t.milliseconds,run.id,body.revision));
  statements.push(sql('UPDATE runs SET finished=?,score=?,points=?,played_ms=?,rounds=?,wins=?,knockouts=?,complete=?,revision=? WHERE id=? AND revision<?',body.final?Date.now():null,body.score,body.points,body.playedMs,body.rounds,body.wins,body.knockouts,complete?1:0,body.revision,run.id,body.revision));await db.batch(statements);return json({saved:true,revision:body.revision,complete});
 }
 if(path==='/api/scores/finish'){
  const run=await sql('SELECT * FROM runs WHERE id=? AND profile=?',String(body.run??''),profile.id).first();if(!run)fail('This score session is unavailable.',404);if(run.finished)return json({saved:true,complete:run.complete===1});
  if(!number(body.score,0,MAX_TOTAL)||!number(body.rounds,0,LEVEL_COUNT-run.start_level)||!number(body.wins,0,body.rounds)||!number(body.knockouts,0,2000))fail('Invalid score summary.');
  const complete=run.start_level===0&&body.rounds===LEVEL_COUNT;
  const durations=body.durations;if(!Array.isArray(durations)||durations.length!==body.rounds||durations.some(d=>!number(d,60,600)||d%30)||(durations.length&&durations[0]!==run.round_seconds))fail('Invalid completed-round durations.');
  const elapsed=Date.now()-run.started;if(elapsed<Math.max(0,durations.reduce((sum,d)=>sum+d,0)*1000-10000))fail('The score arrived before the rounds could finish.');
  const times=Array.isArray(body.times)?body.times:[];if(times.length>Object.keys(MAZE_LEVELS).length||new Set(times.map(t=>t.level)).size!==times.length||times.some(t=>!isMaze(t.level)||t.level<run.start_level||t.level>=run.start_level+body.rounds||!number(t.milliseconds,Math.floor((MAZE_LEVELS[t.level]-3)*3.2*Math.SQRT2/17*1000),600000)))fail('Invalid maze time.');
  const statements=[];for(const t of times)statements.push(sql('INSERT INTO race_times(run,level,milliseconds) SELECT id,?,? FROM runs WHERE id=? AND finished IS NULL ON CONFLICT(run,level) DO NOTHING',t.level,t.milliseconds,run.id));statements.push(sql('UPDATE runs SET finished=?,score=?,rounds=?,wins=?,knockouts=?,complete=? WHERE id=? AND finished IS NULL',Date.now(),body.score,body.rounds,body.wins,body.knockouts,complete?1:0,run.id));await db.batch(statements);return json({saved:true,complete});
 }
 return json({error:'Not found.'},404);
}
