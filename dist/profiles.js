import {ScoreQueue} from './score-queue.js';
import {apiURL,apiRemote,apiBase} from './api.js';
import {LEVELS} from './core.js';
// Ranked maze boards follow the level list rather than a hand-written set of indices, which is
// what silently stopped four of the six race levels ever recording a time.
const RANKED_MAZES=LEVELS.map((l,i)=>i).filter(i=>LEVELS[i].mode==='race');
const $=id=>document.getElementById(id);
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Plain static hosting has no /api. That must not stop anyone playing, so a host without the game
// server drops to a local player kept in this browser: same name on the scoreboard, same
// per-device bests, no online rooms. Anything that looks like "there is no server here" — a failed
// fetch, a non-JSON reply, a 404/405 from a file host — trips it once and stays tripped.
const LOCAL_PLAYER='potatoman.player.local',LOCAL_SCORES='potatoman.scores.local';
const serverless=e=>!!e&&(e.offline||e.name==='TypeError'||[403,404,405,501,502,503].includes(e.status));
const readLocal=key=>{try{return JSON.parse(localStorage.getItem(key))||null;}catch{return null;}};
const writeLocal=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
export const playerAccount={player:null,token:null,session:null,onPlayer:null,ready:null,boardRequest:0,sample:null,offline:false,
 async api(path,data={},keepalive=false){
  if(this.offline)throw Object.assign(Error('This copy is running without the game server.'),{offline:true});
  let response;try{response=await fetch(apiURL(path),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({playerToken:this.token,...data}),keepalive,signal:AbortSignal.timeout(7000)});}
  // A request that simply took too long is not a host without a server. AbortSignal.timeout rejects
  // with a TimeoutError, so treating anything but AbortError as "there is nothing here" latched one
  // slow reply into rooms and shared scores being off for the rest of the session.
  catch(e){throw Object.assign(Error('Could not reach player services.'),{offline:!['AbortError','TimeoutError'].includes(e.name)});}
  let value;try{value=await response.json();}catch{throw Object.assign(Error('Player profiles need the Potatoman game server on this host.'),{offline:true});}
  if(!response.ok)throw Object.assign(Error(value.error||'Could not reach player services.'),{status:response.status});return value;},
 goOffline(){if(this.offline)return;this.offline=true;this.token=null;
  const saved=readLocal(LOCAL_PLAYER);if(saved)this.player=saved;
  $('onlineNote')&&($('onlineNote').textContent=apiRemote()?'The room and score server at '+apiBase()+' could not be reached. Solo and local split-screen work; scores are kept on this device meanwhile.':'Online rooms need the Potatoman game server. This copy is hosted as plain files, so solo and local split-screen work and scores are kept on this device. See config.js to point it at one.');
  if(this.player)this.showPlayer();},
 saveLocal(name,motto){this.player={id:'local',name:String(name||'PLAYER').slice(0,24),motto:String(motto||'').slice(0,60)};writeLocal(LOCAL_PLAYER,this.player);this.showPlayer();},
 localScores(){return readLocal(LOCAL_SCORES)||{best:0,points:0,rounds:0,wins:0,knockouts:0,times:{}};},
 recordLocal(){const s=this.session;if(!s)return;const store=this.localScores();
  store.best=Math.max(store.best,s.score);store.points=Math.max(store.points,s.points);store.rounds=Math.max(store.rounds,s.rounds);store.wins=Math.max(store.wins,s.wins);store.knockouts=Math.max(store.knockouts,s.knockouts);
  for(const t of s.times)store.times[t.level]=Math.min(store.times[t.level]??Infinity,t.milliseconds);
  writeLocal(LOCAL_SCORES,store);},
 showPlayer(){if(!this.player)return;$('playerName').value=this.player.name;$('playerMotto').value=this.player.motto;$('playerEmail').value=this.player.email??'';$('profileButton').textContent=this.player.name.toUpperCase();this.showVerification();this.onPlayer?.(this.player);},
 // Where this player stands with their address, in the one place they will look for it.
 showVerification(){const row=$('verifyRow'),state=$('verifyState');if(!row)return;
  const email=this.player?.email??'';row.hidden=this.offline||!this.player||!email;row.classList.toggle('confirmed',!!this.player?.verified);
  state.textContent=this.player?.verified?`${email} confirmed. Your scores are ranked.`:`We have written to ${email}. Follow the link in it to be ranked.`;
  $('resendVerify').hidden=!!this.player?.verified;},
 ranked(){return !!this.player&&!this.offline&&!!this.player.verified;},
 async resend(){const button=$('resendVerify');button.disabled=true;$('profileStatus').textContent='Sending it again…';
  try{await this.api('player/resend');$('profileStatus').textContent='Sent. Give it a minute, and check the spam folder.';}
  catch(e){$('profileStatus').textContent=e.message;}finally{button.disabled=false;}},
 async confirm(token){try{const data=await this.api('player/verify',{verifyToken:token});this.player=data.player;this.token=data.playerToken;
   try{localStorage.setItem('potatoman.player.access',this.token);}catch{}this.showPlayer();
   $('profileStatus').textContent='Address confirmed. Your scores are ranked from now on.';$('profileDialog').showModal();return true;}
  catch(e){$('profileStatus').textContent=e.message;$('profileDialog').showModal();return false;}},
 async forget(){if(!this.player)return;
  $('profileStatus').textContent='Deleting your player…';
  try{await this.api('player/forget');}catch(e){if(!serverless(e)){$('profileStatus').textContent=e.message;return;}}
  this.player=null;this.token=null;this.session=null;
  try{localStorage.removeItem('potatoman.player.access');localStorage.removeItem(LOCAL_PLAYER);localStorage.removeItem(LOCAL_SCORES);}catch{}
  $('playerName').value='';$('playerMotto').value='';$('playerEmail').value='';$('verifyRow').hidden=true;
  $('profileButton').textContent='PLAYER DETAILS';$('profileStatus').textContent='Deleted. Nothing of yours is left on the scoreboard.';},
 async requirePlayer(action){await this.ready;if(this.player)return true;this.afterSave=action;$('profileStatus').textContent='Add your real name so friends can find you on the scoreboard.';$('profileDialog').showModal();$('playerName').focus();return false;},
 async refresh(){if(this.offline)return;
  // Probe even without a token. Knowing at load time whether there is a server behind this copy is
  // what lets the online dialog and the score board say something true before anyone tries them.
  // The probe is the public score board rather than the profile endpoint, so an anonymous visitor
  // on a real server does not get a 401 logged on every page load.
  if(!this.token){const saved=readLocal(LOCAL_PLAYER);if(saved&&!this.player){this.player=saved;this.showPlayer();}
   try{await this.api('scores/leaderboard');}catch(e){if(serverless(e))this.goOffline();}
   return;}
  let data;try{data=await this.api('player/get');}catch(e){if(e.status===401){this.token=null;this.player=null;try{localStorage.removeItem('potatoman.player.access');}catch{}}if(serverless(e))this.goOffline();throw e;}this.player=data.player;this.showPlayer();const s=data.stats;$('profileStats').innerHTML=[['Best score',s.bestScore??'—'],['Rounds played',s.rounds],['Round wins',s.wins],['Knockouts',s.knockouts]].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');},
 async save(){const button=$('saveProfile');button.disabled=true;$('profileStatus').textContent='Saving your player…';try{const data=await this.api('player/save',{name:$('playerName').value,motto:$('playerMotto').value,email:$('playerEmail').value});this.player=data.player;this.token=data.playerToken;try{localStorage.setItem('potatoman.player.access',this.token);}catch{}this.showPlayer();$('profileStatus').textContent=data.sent?'Player saved. Check your email and follow the link to be ranked.':'Player saved. Every session counts, even if you leave a round early.';this.refresh().catch(()=>{});const next=this.afterSave;this.afterSave=null;if(next){$('profileDialog').close();next();}return true;}catch(e){
  // A file host cannot save a player, but it can still let someone name themselves and play.
  if(serverless(e)){this.goOffline();this.saveLocal($('playerName').value,$('playerMotto').value);$('profileStatus').textContent='Saved on this device. This copy has no game server, so scores stay here and online rooms are unavailable.';const next=this.afterSave;this.afterSave=null;if(next){$('profileDialog').close();next();}return true;}
  $('profileStatus').textContent=e.message;return false;}finally{button.disabled=false;}},
 begin(level,duration,mode,circuitId,remix=false){if(this.session?.circuitId===circuitId)return;if(!this.session?.final)this.finish(false);if(!this.player||!(this.token||this.offline))return;this.session={run:crypto.randomUUID(),token:this.token,start:{level,duration,mode},circuitId,remix,rounds:0,wins:0,score:0,points:0,playedMs:0,knockouts:0,times:[],seen:new Set(),revision:0,final:false};},
 updateTotal(score,knockouts,points,played){const s=this.session;if(!s||s.final)return;s.score=Math.max(s.score,score??0);s.knockouts=Math.max(s.knockouts,knockouts??0);s.points=Math.max(s.points,Math.floor(points??0));s.playedMs=Math.max(s.playedMs,Math.round((played??0)*1000));},
 record({epoch,level,won,total,best,knockouts,rankedMaze=true}){const s=this.session;if(!s||s.seen.has(epoch)||s.final)return;s.seen.add(epoch);s.rounds++;s.wins+=won?1:0;s.score=Math.max(s.score,total);s.knockouts=Math.max(s.knockouts,knockouts??0);if(!s.remix&&rankedMaze&&RANKED_MAZES.includes(level)&&Number.isFinite(best))this.raceTime(level,best);},
 raceTime(level,best){const s=this.session;if(!s||s.remix||!Number.isFinite(best)||!RANKED_MAZES.includes(level))return;const t=s.times.find(t=>t.level===level),milliseconds=Math.round(best*1000);if(t)t.milliseconds=Math.min(t.milliseconds,milliseconds);else s.times.push({level,milliseconds});},
 checkpoint(keepalive=false,final=false){this.sample?.();const s=this.session;if(s&&(!s.final||final)&&(s.playedMs>0||s.rounds>0)){s.final||=final;
  // Nothing is queued for a server that is not there; the local store takes it on flush instead.
  if(!this.offline){const payload={revision:++s.revision,score:s.score,points:s.points,playedMs:s.playedMs,rounds:s.rounds,wins:s.wins,knockouts:s.knockouts,times:s.times,final:s.final};this.queue.put({run:s.run,token:s.token,start:s.start,payload});}}return this.flush(keepalive);},
 async flush(keepalive=false){if(this.offline){this.recordLocal();$('scoreSaveStatus').textContent='Scores saved on this device · this copy has no game server.';return;}if(!this.queue)return;try{await this.queue.flush(keepalive);$('scoreSaveStatus').textContent=Object.keys(this.queue.items).length?'New progress queued for saving.':'Progress saved · every session counts.';}catch{$('scoreSaveStatus').textContent='Score queued on this device. Retrying when connected.';}},
 finish(){return this.checkpoint(false,true);},
 async leaderboard(){this.checkpoint();const request=++this.boardRequest,kind=$('leaderboardKind').value,mode=$('leaderboardMode').value;
  if(this.offline){const store=this.localScores(),name=this.player?.name??'YOU';
   $('leaderboardStatus').textContent='Scores on this device. Shared high scores need the Potatoman game server.';
   const rows=kind==='circuit'?[{value:store.best+' pts',label:'Best circuit score'},{label:'Rounds played',value:store.rounds},{label:'Round wins',value:store.wins},{label:'Knockouts',value:store.knockouts}]
    :[{label:'Best escape',value:store.times[Number(kind)]?(store.times[Number(kind)]/1000).toFixed(2)+'s':'—'}];
   $('leaderboardRows').innerHTML=rows.map((r,i)=>`<tr${i===0?' class="your-score"':''}><td>${i+1}</td><td><strong>${escape(name)}</strong><small>${escape(r.label)}</small></td><td>${escape(r.value)}</td></tr>`).join('');return;}$('leaderboardStatus').textContent='Loading scores…';$('leaderboardRows').innerHTML='';try{await this.flush();const {rows}=await this.api('scores/leaderboard',{...(kind==='circuit'?{}:{level:Number(kind)}),...(mode==='all'?{}:{mode})});if(request!==this.boardRequest)return;$('leaderboardStatus').textContent=rows.length?'':kind==='circuit'?'No scores yet. Play any level to put your name here.':'No escape times yet. Complete this maze to put your name here.';// A player who has not confirmed their address is playing, and their scores are being kept; they
   // simply are not ranked yet. Saying so here is kinder than an empty board they cannot explain.
   if(this.player&&!this.player.verified)$('leaderboardStatus').textContent=this.player.email?`${$('leaderboardStatus').textContent} Your own scores are saved but unranked until you follow the link we sent to ${this.player.email}.`:`${$('leaderboardStatus').textContent} Add an email to your player to have your own scores ranked here.`;
   let rank=0,last=null;$('leaderboardRows').innerHTML=rows.map((r,i)=>{const value=kind==='circuit'?r.score:r.milliseconds;if(value!==last)rank=i+1;last=value;return`<tr${r.id===this.player?.id?' class="your-score"':''}><td>${rank}</td><td><strong>${escape(r.name)}</strong>${r.motto?`<small>${escape(r.motto)}</small>`:''}</td><td>${kind==='circuit'?r.score+' pts':(r.milliseconds/1000).toFixed(2)+'s'}</td></tr>`;}).join('');}catch(e){if(request===this.boardRequest)$('leaderboardStatus').textContent=e.message;}}
};
export function initializeProfiles(onPlayer){playerAccount.onPlayer=onPlayer;let storage;try{storage=localStorage;playerAccount.token=storage.getItem('potatoman.player.access');}catch{}playerAccount.queue=new ScoreQueue(storage,(...args)=>playerAccount.api(...args));
 $('profileButton').onclick=()=>{playerAccount.afterSave=null;$('profileDialog').showModal();playerAccount.refresh().catch(e=>$('profileStatus').textContent=e.message);};$('saveProfile').onclick=()=>playerAccount.save();$('resendVerify').onclick=()=>playerAccount.resend();
 $('privacyLink').onclick=()=>$('privacyDialog').showModal();document.querySelectorAll('.close-privacy').forEach(b=>b.onclick=()=>$('privacyDialog').close());
 $('forgetPlayer').onclick=()=>{if($('forgetPlayer').dataset.armed){playerAccount.forget();delete $('forgetPlayer').dataset.armed;$('forgetPlayer').textContent='DELETE MY PLAYER';return;}
  $('forgetPlayer').dataset.armed='1';$('forgetPlayer').textContent='TAP AGAIN TO DELETE FOR GOOD';};
 // A confirmation link lands back on the game itself, so it is read here and then cleared out of
 // the address bar: nobody wants a one-shot token sitting in their history.
 {const from=new URLSearchParams(location.search),token=from.get('confirm');
  if(token){from.delete('confirm');const rest=from.toString();history.replaceState(null,'',location.pathname+(rest?'?'+rest:'')+location.hash);
   playerAccount.ready=playerAccount.confirm(token);}}
 $('profileDialog').addEventListener('close',()=>{playerAccount.afterSave=null;});
 const open=()=>{$('leaderboardDialog').showModal();playerAccount.leaderboard();};$('leaderboardButton').onclick=open;$('resultLeaderboard').onclick=open;$('leaderboardKind').onchange=$('leaderboardMode').onchange=$('refreshLeaderboard').onclick=()=>playerAccount.leaderboard();
 playerAccount.ready=playerAccount.refresh().catch(e=>{if(serverless(e))playerAccount.goOffline();});playerAccount.flush();setInterval(()=>playerAccount.checkpoint(),5000).unref?.();addEventListener('online',()=>playerAccount.checkpoint());addEventListener('pagehide',()=>playerAccount.checkpoint(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)playerAccount.checkpoint(true);});
}
