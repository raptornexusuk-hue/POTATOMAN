const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const number=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export async function profileAPI(path,body,db){if(!path.startsWith('/api/player/')&&!path.startsWith('/api/scores/'))return null;
 const sql=(s,...args)=>db.prepare(s).bind(...args);
 if(path==='/api/scores/leaderboard'){
  const level=body.level,filter=['solo','local','online'].includes(body.mode)?body.mode:null;
  if(level!==undefined&&!([1,4,8,9].includes(level)))fail('Choose a maze leaderboard.');
  const rows=level===undefined?await sql('SELECT p.id,p.name,p.motto,MAX(CASE WHEN r.revision>0 THEN r.points ELSE r.score*100 END) AS score,COUNT(r.id) AS circuits FROM runs r JOIN profiles p ON p.id=r.profile WHERE (r.rounds>0 OR r.played_ms>0) AND (? IS NULL OR r.mode=?) GROUP BY p.id ORDER BY score DESC,p.name ASC LIMIT 50',filter,filter).all():await sql('SELECT p.id,p.name,p.motto,MIN(t.milliseconds) AS milliseconds FROM race_times t JOIN runs r ON r.id=t.run JOIN profiles p ON p.id=r.profile WHERE t.level=? AND (r.finished IS NOT NULL OR r.revision>0) AND (? IS NULL OR r.mode=?) GROUP BY p.id ORDER BY milliseconds ASC,p.name ASC LIMIT 50',level,filter,filter).all();return json({rows:rows.results});
 }
 let profile=body.playerToken?await sql('SELECT * FROM profiles WHERE token=?',String(body.playerToken)).first():null;
 if(path==='/api/player/save'){
  const name=typeof body.name==='string'?body.name.replace(/[^\p{L}\p{M}0-9 '’_-]/gu,'').trim().slice(0,24):'',motto=typeof body.motto==='string'?body.motto.trim().slice(0,60):'';if(name.length<2)fail('Enter your name with at least two characters.');
  if(body.playerToken&&!profile)fail('This player profile is unavailable.',403);
  if(profile)await sql('UPDATE profiles SET name=?,motto=? WHERE id=?',name,motto,profile.id).run();else{profile={id:crypto.randomUUID(),token:crypto.randomUUID()+crypto.randomUUID()};await sql('INSERT INTO profiles(id,token,name,motto,created) VALUES(?,?,?,?,?)',profile.id,profile.token,name,motto,Date.now()).run();}
  return json({player:{id:profile.id,name,motto},playerToken:profile.token});
 }
 if(!profile)fail('Set up your player profile to save scores.',401);
 if(path==='/api/player/get'){
  const stats=await sql('SELECT COALESCE(SUM(rounds),0) AS rounds,COALESCE(SUM(wins),0) AS wins,COALESCE(SUM(knockouts),0) AS knockouts,MAX(CASE WHEN complete=1 THEN score END) AS bestCircuit,MAX(CASE WHEN revision>0 THEN points ELSE score*100 END) AS bestScore FROM runs WHERE profile=? AND (rounds>0 OR played_ms>0)',profile.id).first();return json({player:{id:profile.id,name:profile.name,motto:profile.motto},stats});
 }
 if(path==='/api/scores/start'){
  if(!number(body.level,0,9)||!number(body.duration,60,600)||body.duration%30||!['solo','local','online'].includes(body.mode))fail('Invalid circuit settings.');
  const id=body.run??crypto.randomUUID();if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))fail('Invalid score session.');
  await sql('INSERT INTO runs(id,profile,started,start_level,round_seconds,mode) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',id,profile.id,Date.now(),body.level,body.duration,body.mode).run();
  const existing=await sql('SELECT * FROM runs WHERE id=?',id).first();if(existing.profile!==profile.id||existing.start_level!==body.level||existing.round_seconds!==body.duration||existing.mode!==body.mode)fail('This score session belongs to different settings.',409);return json({run:id});
 }
 if(path==='/api/scores/save'){
  const run=await sql('SELECT * FROM runs WHERE id=? AND profile=?',String(body.run??''),profile.id).first();if(!run)fail('This score session is unavailable.',404);
  if(!number(body.revision,1,1000000)||!number(body.points,0,1000000)||!number(body.playedMs,0,7200000)||!number(body.score,0,39)||!number(body.rounds,0,10-run.start_level)||!number(body.wins,0,body.rounds)||!number(body.knockouts,0,2000))fail('Invalid score progress.');
  if(body.revision<=run.revision)return json({saved:true,revision:run.revision,complete:!!run.complete});
  if(body.points<run.points||body.playedMs<run.played_ms||body.rounds<run.rounds||body.wins<run.wins||body.knockouts<run.knockouts)fail('Score progress cannot go backwards.');
  const times=Array.isArray(body.times)?body.times:[];if(times.length>4||new Set(times.map(t=>t.level)).size!==times.length||times.some(t=>![1,4,8,9].includes(t.level)||t.level<run.start_level||t.level>run.start_level+body.rounds||!number(t.milliseconds,1000,600000)))fail('Invalid maze time.');
  const complete=run.start_level===0&&body.rounds===10,statements=[];
  for(const t of times)statements.push(sql('INSERT INTO race_times(run,level,milliseconds) SELECT id,?,? FROM runs WHERE id=? AND revision<? ON CONFLICT(run,level) DO UPDATE SET milliseconds=MIN(milliseconds,excluded.milliseconds)',t.level,t.milliseconds,run.id,body.revision));
  statements.push(sql('UPDATE runs SET finished=?,score=?,points=?,played_ms=?,rounds=?,wins=?,knockouts=?,complete=?,revision=? WHERE id=? AND revision<?',body.final?Date.now():null,body.score,body.points,body.playedMs,body.rounds,body.wins,body.knockouts,complete?1:0,body.revision,run.id,body.revision));await db.batch(statements);return json({saved:true,revision:body.revision,complete});
 }
 if(path==='/api/scores/finish'){
  const run=await sql('SELECT * FROM runs WHERE id=? AND profile=?',String(body.run??''),profile.id).first();if(!run)fail('This score session is unavailable.',404);if(run.finished)return json({saved:true,complete:run.complete===1});
  if(!number(body.score,0,39)||!number(body.rounds,0,10-run.start_level)||!number(body.wins,0,body.rounds)||!number(body.knockouts,0,2000))fail('Invalid score summary.');
  const complete=run.start_level===0&&body.rounds===10;
  const durations=body.durations;if(!Array.isArray(durations)||durations.length!==body.rounds||durations.some(d=>!number(d,60,600)||d%30)||(durations.length&&durations[0]!==run.round_seconds))fail('Invalid completed-round durations.');
  const elapsed=Date.now()-run.started;if(elapsed<Math.max(0,durations.reduce((sum,d)=>sum+d,0)*1000-10000))fail('The score arrived before the rounds could finish.');
  const times=Array.isArray(body.times)?body.times:[];if(times.length>4||new Set(times.map(t=>t.level)).size!==times.length||times.some(t=>![1,4,8,9].includes(t.level)||t.level<run.start_level||t.level>=run.start_level+body.rounds||!number(t.milliseconds,Math.floor((({1:15,4:19,8:23,9:27})[t.level]-3)*3.2*Math.SQRT2/17*1000),600000)))fail('Invalid maze time.');
  const statements=[];for(const t of times)statements.push(sql('INSERT INTO race_times(run,level,milliseconds) SELECT id,?,? FROM runs WHERE id=? AND finished IS NULL ON CONFLICT(run,level) DO NOTHING',t.level,t.milliseconds,run.id));statements.push(sql('UPDATE runs SET finished=?,score=?,rounds=?,wins=?,knockouts=?,complete=? WHERE id=? AND finished IS NULL',Date.now(),body.score,body.rounds,body.wins,body.knockouts,complete?1:0,run.id));await db.batch(statements);return json({saved:true,complete});
 }
 return json({error:'Not found.'},404);
}
