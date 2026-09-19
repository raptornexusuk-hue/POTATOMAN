// The PHP service exists so the game can run on hosting that has PHP and MySQL but no Node, which
// is what an ordinary web hosting package is. It is a second implementation of the same API, and
// the danger with a second implementation is that it drifts: a level added to the game, or a bound
// tightened in the Node service, has to reach both or the two disagree about what a legal score is.
//
// Everything here that can be checked without a database is checked on every run. The live exercise
// against a real MySQL runs when POTATOMAN_TEST_DB names one, and says so plainly when it does not,
// rather than passing quietly.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {LEVELS} from '../dist/core.js';
import {MAZE_LEVELS,LEVEL_COUNT} from '../server/profiles.js';

const php=await fs.readFile(new URL('../php/profiles.php',import.meta.url),'utf8');

// The same table the Node service carries, and the same reason: neither can import the game's level
// list. A maze added to the game without a line in both is a maze whose times are refused.
{
 const table=php.match(/const MAZE_LEVELS = \[([^\]]*)\]/)[1];
 const parsed=Object.fromEntries([...table.matchAll(/(\d+)\s*=>\s*(\d+)/g)].map(([,k,v])=>[Number(k),Number(v)]));
 assert.deepEqual(parsed,MAZE_LEVELS,'the PHP maze table has drifted from the Node one');
 const fromGame=Object.fromEntries(LEVELS.map((l,i)=>[i,l]).filter(([,l])=>l.mode==='race').map(([i,l])=>[i,l.size]));
 assert.deepEqual(parsed,fromGame,'the PHP maze table has drifted from the game itself');
 assert.equal(Number(php.match(/const LEVEL_COUNT = (\d+)/)[1]),LEVELS.length,'the PHP circuit length has drifted from the game');
 assert.equal(LEVEL_COUNT,LEVELS.length);
 console.log(`PASS the PHP service agrees with the game and with the Node service: ${LEVELS.length} rounds, ${Object.keys(parsed).length} ranked mazes`);
}

// Every endpoint the game calls has to exist in the PHP, or a player on that hosting hits a 404 at
// whichever point in a match happens to reach it.
{
 const rooms=await fs.readFile(new URL('../php/rooms.php',import.meta.url),'utf8');
 const worker=await fs.readFile(new URL('../server/index.js',import.meta.url),'utf8');
 const node=await fs.readFile(new URL('../server/profiles.js',import.meta.url),'utf8');
 const routes=new Set([...(worker+node).matchAll(/'(\/api\/[a-z/]+)'/g)].map(m=>m[1]));
 assert.ok(routes.size>=12,`expected the whole API surface, found ${routes.size}`);
 const missing=[...routes].filter(route=>!php.includes(`'${route}'`)&&!rooms.includes(`'${route}'`));
 assert.deepEqual(missing,[],`the PHP service is missing endpoints the game calls: ${missing.join(', ')}`);
 console.log(`PASS all ${routes.size} endpoints the game calls exist in the PHP service`);
}

// PHP that does not parse is a 500 on every request, and nothing else here would notice.
{
 let php_bin=null;
 try{execFileSync('php',['--version'],{stdio:'ignore'});php_bin='php';}catch{}
 if(!php_bin)console.log('SKIP no php on this machine, so the PHP service was not syntax checked');
 else{
  for(const file of['index.php','db.php','profiles.php','rooms.php','config.sample.php']){
   const out=execFileSync(php_bin,['-l',new URL('../php/'+file,import.meta.url).pathname],{encoding:'utf8'});
   assert.match(out,/No syntax errors/,`${file}: ${out}`);
  }
  console.log('PASS the PHP service parses');
 }
}

// The live exercise. Same shape as tests/profiles.test.mjs: make a player, run a circuit, and try
// the three things a cheat would try.
const dsn=process.env.POTATOMAN_TEST_DB;
if(!dsn)console.log('SKIP set POTATOMAN_TEST_DB=host,database,user,password to exercise the PHP service against a real MySQL');
else{
 const [host,name,user,pass]=dsn.split(',');
 const dir=await fs.mkdtemp('/tmp/potatoman-php-');
 await fs.writeFile(dir+'/config.php',`<?php\nreturn ${JSON.stringify({db_host:host,db_name:name,db_user:user,db_pass:pass,mail_from:'',mail_name:'Potatoman',allowed_origins:[],site_origin:'https://example.test'}).replace(/[{]/g,'[').replace(/[}]/g,']').replace(/:/g,'=>')};\n`);
 for(const file of['index.php','db.php','profiles.php','rooms.php'])await fs.copyFile(new URL('../php/'+file,import.meta.url),dir+'/'+file);
 const {spawn}=await import('node:child_process');
 const port=8300+Math.floor(Math.random()*400);
 const server=spawn('php',['-S','127.0.0.1:'+port,'index.php'],{cwd:dir,stdio:'ignore'});
 try{
  await new Promise(r=>setTimeout(r,1200));
  const call=async(path,body)=>{const r=await fetch(`http://127.0.0.1:${port}/api/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return[r.status,await r.json()];};
  const [,saved]=await call('player/save',{name:'PHPTEST'});
  assert.equal(saved.player.name,'PHPTEST');assert.equal(saved.player.verified,false);
  const token=saved.playerToken;
  const [,started]=await call('scores/start',{playerToken:token,level:0,duration:120,mode:'solo'});
  assert.match(started.run,/^[a-f0-9-]{36}$/);
  const [,progress]=await call('scores/save',{playerToken:token,run:started.run,revision:1,points:900,playedMs:60000,score:9,rounds:3,wins:2,knockouts:5,times:[{level:1,milliseconds:41000}]});
  assert.equal(progress.saved,true);
  const [,board]=await call('scores/leaderboard',{});
  assert.equal(board.rows.filter(r=>r.name==='PHPTEST').length,0,'an unconfirmed player is playing, not ranking');
  for(const [what,payload] of [
   ['a score above what a circuit can yield',{revision:2,points:900,playedMs:60000,score:9999,rounds:3,wins:2,knockouts:5}],
   ['progress running backwards',{revision:3,points:10,playedMs:10,score:9,rounds:1,wins:0,knockouts:0}],
   ['a time on a maze the run never reached',{revision:4,points:950,playedMs:70000,score:10,rounds:3,wins:2,knockouts:5,times:[{level:20,milliseconds:41000}]}],
  ]){const [status,out]=await call('scores/save',{playerToken:token,run:started.run,...payload});
   assert.equal(status,400,`${what} was accepted`);assert.ok(out.error,what);}
  const [,room]=await call('rooms/create',{name:'HOST'});
  assert.match(room.code,/^[A-Z2-9]{10}$/);assert.equal(room.slot,0);
  const [,second]=await call('rooms/join',{code:room.code,name:'TWO'});assert.equal(second.slot,1);
  const [,third]=await call('rooms/join',{code:room.code,name:'THREE'});assert.equal(third.slot,2);
  const [fullStatus]=await call('rooms/join',{code:room.code,name:'FOUR'});
  assert.equal(fullStatus,409,'a fourth player is turned away: online matches are three players');
  const [,exchange]=await call('rooms/exchange',{code:room.code,token:room.token,input:{seq:1,x:.5,z:-1,yaw:2,pitch:0,fire:true,zoom:5}});
  assert.equal(exchange.roster.length,3);
  assert.equal(exchange.roster[0].input.fire,true,'the host is relayed its own input back');
  await call('rooms/leave',{code:room.code,token:room.token});
  console.log('PASS the PHP service runs a circuit, refuses three kinds of impossible score, and runs a three-player room');
 }finally{server.kill();await fs.rm(dir,{recursive:true,force:true});}
}
