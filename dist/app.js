import {earnedKill,loseLoadout,respawnLoadout,awardRoundWins,lastPlaceLine} from './progression.js';
import {MAPS,mapInfo,mapId,nextCircuitSeed} from './map-catalogue.js';
import {bodyHeight,eyeHeight,updateStance} from './stance.js';
import {cameraPose,aimPoint,shotVelocity,cylinderContact,weaponAim,cameraHeight,CAMERA_SHOULDER,DEFAULT_PITCH,MIN_PITCH,MAX_PITCH} from './aiming.js';
import {createWeaponPickup,claimWeapon,useWeaponRound,dropWeapon,rearmWeapon} from './weapon-pickup.js';
import {THROW_DURATION,THROW_WINDUP,WEAPONS,equipWeapon,weaponConfig,dropFactor} from './weapons.js';
import {SOUND_TYPES} from './spatial-audio.js';
import {GameAudio,permittedVoice} from './game-audio.js';
import {AI_LEVELS,aiSettings} from './difficulty.js';
import {MouseCamera} from './camera-input.js';
import {playerAccount,initializeProfiles} from './profiles.js';
import {THROW_DROP,POWERUPS,isTrial,jump,movePlayer,applyPowerup,roundLevel,playableMap,STEP,CELL,ROUND_TIME,BONUS_TIME,LEVELS,MODES,makeMap,route,rng,movement,slideMove,segmentCircle,segmentBox,circleContact,boxContact,boxContact3D,launchVerticalSpeed,clearShot,deadzone,blocked} from './core.js';
import {World,colors} from './world.js';
import {ACTIONS,PAD_ACTIONS,PAD_BUTTONS,defaults,loadSettings,saveSettings,bindKey,bindButton,mouseButtonHeld,keyLabel,cameraDrag,resetCamera} from './controls.js';
import {RoomConnection} from './network.js';
import {packPlayer,unpackPlayer,validSnapshot,remoteControl} from './net-state.js';
const $=id=>document.getElementById(id),names=['YOU','PLAYER 2','ROAST','CHIP'],hex=colors.map(c=>'#'+c.toString(16).padStart(6,'0'));
// Avoid rebuilding unchanged HUD nodes during simulation and snapshot updates.
const hudHTML=new WeakMap();
function hudText(id,value){const node=$(id),text=String(value);if(node.textContent!==text)node.textContent=text;}
function hudMarkup(id,value){const node=$(id);if(hudHTML.get(node)!==value){node.innerHTML=value;hudHTML.set(node,value);}}
let circuitSeed=0;
let levelCache=null;const currentLevel=()=>{const key=levelIndex+':'+circuitSeed;if(levelCache?.key!==key)levelCache={key,value:{...roundLevel(levelIndex,circuitSeed),remix:!!circuitSeed}};return levelCache.value;};
let starting=false,arenaFailed=false,retryLevel=0,world=null,duo=false,state='menu',levelIndex=0,map,players=[],shots=[],targets=[],pickups=[],bonus=false,time=0,remaining=ROUND_TIME,activeDuration=ROUND_TIME,runnerId=0,shotId=0,acc=0,last=performance.now(),lastUI=0,captionUntil=0,penalty=new Set(),nextPenalty=new Set(),resultAction=null,paused=false;
let killFeed=[],damageFlashUntil=0;
function pushKillFeed(text){killFeed.unshift({text,until:performance.now()+4200});killFeed=killFeed.slice(0,4);}
const keys=new Set(),inputs=[{x:0,z:0,fire:false,catch:false,dodge:false,jump:false,crouch:false},{x:0,z:0,fire:false,catch:false,dodge:false,jump:false,crouch:false}],prior=[{},{ }];
let preferenceStorage;try{preferenceStorage=window.localStorage;}catch{}
let settings=loadSettings(preferenceStorage),bindingCapture=null,padAssignments=[null,null];
let mouseButtons=0,pointerX=0,pointerY=0,touchMove={x:0,z:0},touchFire=false,touchCatch=false,touchDodge=false,touchJump=false,touchCrouch=false,padPause=false,audioCtx=null,lastQuip=-99;
const isTouch=matchMedia('(pointer:coarse)').matches;
let audioEvents=[],audioEventId=0,guestAudioWatermark=0;
function sound(type,source=null){if(online&&!online.isHost)return;const position=source?{x:source.x,y:(source.y??0)+(Number.isInteger(source.id)&&source.hp!==undefined?type==='step'?.08:type==='land'?.12:1.1:0),z:source.z}:null;if(!SOUND_TYPES.has(type))return;if(position){audioEvents.push({id:++audioEventId,type,...position,time});audioEvents=audioEvents.filter(e=>time-e.time<1.5).slice(-128);}gameAudio.effect(type,position);}
function listenToWorld(){gameAudio.listener(world?.cameras?.[0],world?.solids??[...map.walls,...map.platforms],world?.waterFlows?.map(f=>f.position)??[]);}
function receiveAudioEvents(events,initial=false){const latest=events.at(-1)?.id??0;if(initial){guestAudioWatermark=latest;return;}for(const event of events){if(event.id<=guestAudioWatermark)continue;guestAudioWatermark=event.id;if(!paused&&!hostPaused&&time-event.time<.8)gameAudio.effect(event.type,event);}}

let musicPreviewUntil=0;
const gameAudio=new GameAudio(()=>settings);
function quip(text,force=false,spoken=text){if(!force&&time-lastQuip<5)return;lastQuip=time;$('caption').textContent=text;captionUntil=time+2.8;}
function initAudio(){audioCtx=gameAudio.unlock();}
// Browsers suspend an audio context whenever they feel like it — a tab switch, a focus change, a
// power-saving policy — and only a user gesture may resume it. Retrying on every gesture anywhere
// on the page means sound comes back on its own instead of staying dead for the rest of the match.
const recoverAudio=()=>{if(gameAudio.context?.state!=='running')initAudio();};
for(const event of['pointerdown','keydown','touchstart'])addEventListener(event,recoverAudio,{capture:true,passive:true});
function syncAudio(){if(document.hidden)musicPreviewUntil=0;
 // Silent audio is otherwise indistinguishable from a broken game, so say so on screen.
 $('audioNotice').hidden=!(state==='playing'&&!paused&&!document.hidden&&(settings.sound||settings.music)&&gameAudio.context?.state!=='running');const preview=performance.now()<musicPreviewUntil;gameAudio.effectsEnabled(['playing','results'].includes(state)&&!paused&&!document.hidden&&!(online&&!online.isHost&&hostPaused)&&settings.sound);gameAudio.sync(state==='playing'&&!paused&&!document.hidden&&!(online&&!online.isHost&&hostPaused)?bonus?'hunt':'arena':preview?'arena':null);if(preview){$('musicStatus').textContent=!settings.music?'Music is switched off.':settings.musicVolume===0?'Music volume is zero. Raise the slider to hear it.':gameAudio.context?.state!=='running'?'Audio is waiting for your browser. Press Preview Music again.':gameAudio.musicStatus()==='playing'?'Music preview playing · recorded soundtrack · adjust the volume below.':gameAudio.musicStatus()==='failed'?'The music could not load. Press Preview Music to retry.':'Loading the recorded soundtrack…';}else if($('musicStatus').textContent.startsWith('Music preview'))$('musicStatus').textContent='Preview finished. Music will play during the next round.';}
function renderVoices(){const voices=window.speechSynthesis?.getVoices?.()??[];$('voiceName').innerHTML='<option value="">Moira commentary · Rishi reactions</option>'+voices.filter(permittedVoice).map(v=>`<option value="${escapeHTML(v.voiceURI)}">${escapeHTML(v.name)}</option>`).join('');$('voiceName').value=voices.some(v=>permittedVoice(v)&&v.voiceURI===settings.voiceName)?settings.voiceName:'';}
window.speechSynthesis?.addEventListener?.('voiceschanged',renderVoices);
$('testPain').onclick=()=>{initAudio();if(!settings.voice){settings.voice=true;$('voice').checked=true;persist();}const ok=gameAudio.speak('Ooh! Ouch! Oh my God, what are you doing?',{force:true,role:'pain'});$('audioStatus').textContent=ok?'Playing Rishi or Moira.':'Rishi and Moira are unavailable on this device. Speech stays off; music and effects still play.';};
$('testVoice').onclick=()=>{initAudio();if(!settings.voice){settings.voice=true;$('voice').checked=true;persist();}const ok=gameAudio.speak('Spud buckets for '+(playerAccount.player?.name??'MACCA')+'!',{force:true,role:'commentary'});$('audioStatus').textContent=ok?'Playing Rishi or Moira.':'Rishi and Moira are unavailable on this device. Speech stays off; music and effects still play. Potato captions still appear.';};
$('testMusic').onclick=()=>{settings.music=true;if(settings.musicVolume===0)settings.musicVolume=.45;$('music').checked=true;$('musicVolume').value=settings.musicVolume;musicPreviewUntil=performance.now()+20000;initAudio();gameAudio.loadAssets(true);syncAudio();persist();};
$('voiceName').onchange=e=>{settings.voiceName=e.target.value;persist();};
function dialog(id){$(id).showModal();}
function clearInput(){mouseCamera.reset();keys.clear();mouseButtons=0;movePointer=aimPointer=null;touchMove={x:0,z:0};touchFire=touchCatch=touchDodge=touchJump=touchCrouch=false;inputs.forEach(i=>Object.assign(i,{x:0,z:0,fire:false,catch:false,dodge:false,jump:false,crouch:false}));prior.forEach(i=>Object.keys(i).forEach(k=>delete i[k]));$('moveStick').querySelector('i').style.transform='';}
function setPlayers(two){if(two!==duo&&!manualPadAssignment)padAssignments=[null,null];duo=two;$('duo').classList.toggle('active',two);$('solo').classList.toggle('active',!two);$('duo').setAttribute('aria-pressed',two);$('solo').setAttribute('aria-pressed',!two);$('sessionNote').innerHTML=two?'Two players, one screen, two AI rivals.<br>Keyboard + controller, two controllers or shared keyboard.':`${durationLabel(settings.roundSeconds)} rounds. Bonus hunts between levels.<br>${AI_LEVELS[settings.difficulty].label} bots · keyboard, controller or touch.`;}
$('solo').onclick=()=>online?openOnline():setPlayers(false);$('duo').onclick=()=>{if(online){openOnline();return;}if(isTouch){$('sessionNote').textContent='Use a desktop or laptop for two-player split-screen. Touch supports solo play.';return;}setPlayers(true);};
$('levelsButton').onclick=()=>dialog('levelsDialog');$('controlsButton').onclick=openSettings;$('arsenalButton').onclick=()=>{renderArsenal();dialog('arsenalDialog');};$('artButton').onclick=()=>dialog('artDialog');document.querySelectorAll('.close').forEach(b=>b.onclick=()=>{if(b.closest('dialog').id==='settingsDialog')closeSettings();else b.closest('dialog').close();});
function durationLabel(seconds){return `${seconds/60}-minute`;}
function refreshDuration(){setPlayers(duo);$('durationSummary').textContent=`${settings.roundSeconds/60} minutes`;$('huntSummary').textContent=`${BONUS_TIME}-second`;document.querySelectorAll('[data-level-duration]').forEach(el=>el.textContent=`${settings.roundSeconds/60} MIN`);}
function refreshControlHint(){$('hint').textContent=`${keyLabel(settings.keys[0].forward)}${keyLabel(settings.keys[0].left)}${keyLabel(settings.keys[0].back)}${keyLabel(settings.keys[0].right)} move · mouse pan · ${settings.mouse.fire===0?'Left click / ':''}${keyLabel(settings.keys[0].fire)} fire · ${keyLabel(settings.keys[0].catch)} catch · ${keyLabel(settings.keys[0].jump)} jump · ${keyLabel(settings.keys[0].crouch)} duck · ${keyLabel(settings.keys[0].dodge)} dodge · ${keyLabel(settings.keys[0].resetCamera)} reset view · Esc settings`;}
function persist(message='Preferences saved on this device.'){refreshControlHint();const ok=saveSettings(settings,preferenceStorage);$('bindingStatus').textContent=ok?message:'Settings work for this session; browser storage is unavailable.';}
function renderBindings(){
 $('keyboardBindings').innerHTML=`<table class="binding-table"><thead><tr><th>Action</th><th>Player 1</th><th>Player 2</th></tr></thead><tbody>${ACTIONS.map(([a,label])=>`<tr><td>${label}</td>${[0,1].map(i=>`<td><button class="key-bind" data-player="${i}" data-action="${a}">${keyLabel(settings.keys[i][a])}</button></td>`).join('')}</tr>`).join('')}</tbody></table>`;
 $('padBindings').innerHTML=`<table class="binding-table"><thead><tr><th>Action</th><th>Player 1</th><th>Player 2</th></tr></thead><tbody>${PAD_ACTIONS.map(([a,label])=>`<tr><td>${label}</td>${[0,1].map(i=>`<td><select data-pad-player="${i}" data-pad-action="${a}" aria-label="Player ${i+1} controller ${label}">${PAD_BUTTONS.map(([v,l])=>`<option value="${v}" ${settings.pad[i][a]===v?'selected':''}>${l}</option>`).join('')}</select></td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function cameraValues(){$('fovValue').textContent=settings.fov+'°';$('zoomValue').textContent=Number(settings.zoom).toFixed(1)+'m';}
function renderSettings(){cameraValues();$('mouseFire').value=settings.mouse.fire;for(const id of['quality','sensitivity','panSensitivity','difficulty','musicVolume','voiceVolume','fov','zoom'])$(id).value=settings[id];for(const id of['sound','voice','music','invertY'])$(id).checked=settings[id];$('roundMinutes').value=settings.roundSeconds/60;renderBindings();renderVoices();refreshDifficulty();refreshDuration();}
function openSettings(){releaseMouse();bindingCapture=null;clearInput();renderSettings();dialog('settingsDialog');}
function closeSettings(){musicPreviewUntil=0;syncAudio();bindingCapture=null;clearInput();$('settingsDialog').close();if(paused)$('resume').focus();}
$('pauseSettings').onclick=openSettings;$('doneSettings').onclick=closeSettings;$('settingsDialog').addEventListener('cancel',e=>{e.preventDefault();if(bindingCapture){bindingCapture=null;renderBindings();$('bindingStatus').textContent='Rebinding cancelled.';}else closeSettings();});
$('keyboardBindings').onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;renderBindings();bindingCapture={player:+b.dataset.player,action:b.dataset.action};const current=document.querySelector(`[data-player="${bindingCapture.player}"][data-action="${bindingCapture.action}"]`);current?.classList.add('capturing');if(current)current.textContent='Press a key…';$('bindingStatus').textContent='Press a replacement key, or Escape to cancel.';};
$('mouseFire').onchange=e=>{bindButton(settings,'mouse',0,'fire',+e.target.value);persist('Mouse fire binding saved.');};
$('padBindings').onchange=e=>{const {padPlayer,padAction}=e.target.dataset;if(padAction){bindButton(settings,'pad',+padPlayer,padAction,+e.target.value);renderBindings();persist('Controller bindings saved.');}};
$('resetControls').onclick=()=>{settings=defaults();bindingCapture=null;world?.quality(settings.quality);renderSettings();gameAudio.stopVoice();syncAudio();persist('Defaults restored: Chill bots, two-minute rounds and audio on.');};
function refreshDifficulty(){$('difficultyHelp').textContent=AI_LEVELS[settings.difficulty].description+' Bot difficulty applies to solo and local play.';}
for(const id of['quality','sensitivity','panSensitivity','sound','voice','music','musicVolume','voiceVolume','invertY','difficulty','fov','zoom'])$(id).addEventListener(['sensitivity','panSensitivity','musicVolume','voiceVolume','fov','zoom'].includes(id)?'input':'change',e=>{settings[id]=['sound','voice','music','invertY'].includes(id)?e.target.checked:['quality','difficulty'].includes(id)?e.target.value:+e.target.value;cameraValues();if(id==='quality')world?.quality(settings.quality);if(id==='difficulty'){refreshDifficulty();setPlayers(duo);}if(id==='voice'&&!settings.voice||id==='voiceVolume'&&settings.voiceVolume<=0)gameAudio.stopVoice();initAudio();syncAudio();persist();});
$('roundMinutes').addEventListener('change',e=>{const value=Number(e.target.value);if(!Number.isFinite(value)||value<1||value>10||value*2%1){e.target.value=settings.roundSeconds/60;$('bindingStatus').textContent='Choose 1–10 minutes in half-minute steps.';return;}settings.roundSeconds=value*60;refreshDuration();persist(state==='playing'?'Duration saved for the next main round.':'Level duration saved.');});
let selectedWorld='all';
// The arsenal is read from the weapon table itself, so a weapon cannot be added to the game and
// quietly stay a secret — its stats and its one-line description come from the same place the
// simulation reads.
function renderArsenal(){
 const bar=(value,max)=>`<i style="width:${Math.max(4,Math.min(100,value/max*100))}%"></i>`;
 $('arsenalList').innerHTML=Object.entries(WEAPONS).map(([key,w])=>`<div class="arsenal-card${w.tier===0?' starter':w.tier===1?' earned':''}" style="--weapon:#${w.color.toString(16).padStart(6,'0')}">
  <header><strong>${escapeHTML(w.name)}</strong><small>${w.tier===0?'ALWAYS CARRIED':w.tier===1?'EARNED WITH A KNOCKOUT':'FROM THE WEAPON BOX'}</small></header>
  <p>${escapeHTML(w.blurb)}</p>
  <dl><div><dt>DAMAGE</dt><dd class="meter">${bar(w.damage*w.pellets,200)}</dd><dd class="figure">${w.damage}${w.pellets>1?' ×'+w.pellets:''}</dd></div>
   <div><dt>RATE</dt><dd class="meter">${bar(1/w.cooldown,11)}</dd><dd class="figure">${(1/w.cooldown).toFixed(1)}/s</dd></div>
   <div><dt>SPEED</dt><dd class="meter">${bar(w.speed,96)}</dd><dd class="figure">${w.speed}m/s</dd></div>
   <div><dt>AMMO</dt><dd class="meter">${bar(w.ammo||60,90)}</dd><dd class="figure">${w.ammo||'∞'}</dd></div></dl>
  <footer>${[dropFactor(w)===0?'Flat trajectory':dropFactor(w)>1?'High arc over cover':'Lobbed',w.blast?`Blast radius ${w.blast} metres`:'',w.pierce?'Punches through one body':'',w.life&&!w.blast?`Burns out after ${w.life}s`:'',w.life&&w.blast?`${w.life}s fuse`:''].filter(Boolean).join(' · ')}</footer>
 </div>`).join('');
}
const WORLD_ICON={village:'🧀',estate:'🌷',harbour:'⚓',farm:'🌾',quarry:'⛏️',orchard:'🍏',shipyard:'📦',coast:'🏖️',interior:'🏭'},MODE_ICON={battle:'⚔️',race:'🏁',assault:'🪜',capture:'👑',smash:'💥'};
function renderWorlds(id='all'){selectedWorld=id;$('mapTabs').innerHTML=[{id:'all',name:'ALL WORLDS'},...MAPS].map(m=>`<button data-world="${m.id}" class="${id===m.id?'active':''}" aria-pressed="${id===m.id}">${m.id==='all'?'🌍 ':WORLD_ICON[m.id]+' '}${m.name}</button>`).join('');$('mapDescription').textContent=MAPS.find(m=>m.id===id)?.description??'Choose the place first, then a game mode. Circuit play mixes every world.';$('levelGrid').innerHTML=LEVELS.map((l,i)=>({l,i})).filter(({l})=>id==='all'||mapId(l)===id).map(({l,i})=>`<button class="level-card" data-level="${i}" style="--map-color:${mapInfo(l).color}"><span class="level-num">${String(i+1).padStart(2,'0')}</span><span><small>${mapInfo(l).name.toUpperCase()}</small><strong>${MODE_ICON[l.mode]??''} ${MODES[l.mode]}</strong><small>${l.name} · <span data-level-duration>${settings.roundSeconds/60} MIN</span></small><span class="level-detail">${l.skill}</span></span></button>`).join('');}
$('mapTabs').onclick=e=>{const b=e.target.closest('[data-world]');if(b)renderWorlds(b.dataset.world);};
$('worldMenu').innerHTML=MAPS.map((m,i)=>`<button data-world="${m.id}" style="--map-color:${m.color}"><small>WORLD ${String(i+1).padStart(2,'0')}</small><strong>${WORLD_ICON[m.id]} ${m.name}</strong><span>${m.mood}</span></button>`).join('');
// Maze boards follow the level list, so added race levels appear without editing the markup.
$('leaderboardKind').innerHTML='<option value="circuit">Best session score</option>'+LEVELS.map((l,i)=>({l,i})).filter(({l})=>l.mode==='race').map(({l,i})=>`<option value="${i}">${l.name} · fastest escape</option>`).join('');
$('levelsButton').innerHTML=`WORLDS & MODES <span>${MAPS.length} / ${LEVELS.length}</span>`;$('worldMenu').onclick=e=>{const b=e.target.closest('[data-world]');if(b){renderWorlds(b.dataset.world);dialog('levelsDialog');}};
renderWorlds();
$('levelGrid').onclick=e=>{const b=e.target.closest('[data-level]');if(b){if(online){$('levelsDialog').close();openOnline();return;}$('levelsDialog').close();start(+b.dataset.level,true);}};
$('play').onclick=()=>online?openOnline():start(0);
function localPlayer(){return players[online?.slot??0];}
function isHuman(p){return online?online.roster.some(m=>m.slot===p.id):p.id<(duo?2:1);}
function newPlayer(id){return {id,name:id===1&&!duo?'MASH':names[id],knockouts:0,kills:0,points:0,played:0,weaponLevel:0,roundWins:0,x:0,y:0,z:0,vy:0,grounded:true,crouching:false,courseDuckEntry:0,runBoost:0,fireBoost:0,jumpBoost:0,courseStep:0,vx:0,vz:0,yaw:0,pitch:DEFAULT_PITCH,panX:0,panY:0,cameraDistance:4.6,hp:100,score:0,total:0,best:Infinity,attempt:0,respawn:0,invuln:0,throwCD:0,catchCD:0,catchTime:0,dashCD:0,dashTime:0,dashX:0,dashZ:0,shotAnim:0,pendingThrow:0,charge:0,weapon:'throw',gun:false,mag:12,reload:0,runner:false,checks:[false,false],claimTime:0,path:[],navTimer:0,goalKey:null,via:null,viaUntil:0,viaCooldown:0,viaCooldown:0,botDelay:0};}
async function start(index,practice=false){
 initAudio();musicPreviewUntil=0;
 if(starting||online&&(!online.isHost||online.roster.length!==3))return;if(!await playerAccount.requirePlayer(()=>start(index,practice)))return;if(starting)return;starting=true;playerAccount.finish();arenaFailed=false;initAudio();retryLevel=index;state='loading';paused=false;releaseMouse();clearInput();
 $('error').hidden=true;$('loading').hidden=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());
 try{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));world??=new World($('world'));await world.ready;world.quality(settings.quality);
  circuitId=crypto.randomUUID();let previous='';try{previous=preferenceStorage?.getItem('potatoman.lastWorld')??'';}catch{}circuitSeed=practice?0:nextCircuitSeed(previous,crypto.getRandomValues(new Uint32Array(1))[0],seed=>roundLevel(0,seed));try{if(!practice)preferenceStorage?.setItem('potatoman.lastWorld',mapId(roundLevel(0,circuitSeed)));}catch{}circuitHistory=[];players=Array.from({length:online?3:4},(_,i)=>newPlayer(i));if(online)for(const m of online.roster)players[m.slot].name=m.name;
  penalty.clear();nextPenalty.clear();levelIndex=index;if(playerAccount.player&&!online)players[0].name=playerAccount.player.name;
  initAudio();$('menu').hidden=true;$('hud').hidden=false;loadRound(false);playerAccount.begin(index,settings.roundSeconds,online?'online':duo?'local':'solo',circuitId,!!circuitSeed);
 }catch(e){showStartError('The arena could not start. Try again, or return to the menu and check that hardware acceleration and WebGL 2 are enabled in your browser. '+e.message,index);}
 finally{starting=false;$('loading').hidden=true;}
}
function showStartError(message,index=levelIndex){arenaFailed=true;roundEpoch='';retryLevel=index;state='menu';gameAudio.sync(null);gameAudio.stopVoice();gameAudio.stopEffects();document.querySelectorAll('dialog[open]').forEach(d=>d.close());paused=false;releaseMouse();clearInput();$('hud').hidden=true;$('menu').hidden=false;$('loading').hidden=true;$('errorMessage').textContent=message;$('error').hidden=false;if(world?.dispose)world.dispose();else{world?.characters?.forEach(m=>m.label?.dispose());world?.renderer?.dispose?.();}world=null;}
$('retryStart').onclick=()=>{if(online&&!online.isHost){arenaFailed=false;$('error').hidden=true;$('loading').hidden=false;state='loading';initAudio();if(pendingSnapshot&&!applyingSnapshot)drainSnapshots();return;}start(retryLevel);};
$('errorMenu').onclick=()=>{$('error').hidden=true;menu();};

function spawn(p,race=false){respawnLoadout(p);let pos;if(race){pos=map.start;}else if(bonus&&p.id===runnerId){pos=map.toWorld(Math.floor(map.n/2),map.n-3);}else{const cells=[[2,2],[map.n-3,map.n-3],[map.n-3,2],[2,map.n-3]];pos=map.toWorld(...cells[p.id]);}Object.assign(p,{x:pos.x,y:0,z:pos.z,vy:0,grounded:true,crouching:false,courseDuckEntry:0,runBoost:0,fireBoost:0,jumpBoost:0,courseStep:0,vx:0,vz:0,yaw:race?0:Math.atan2(-pos.x,pos.z),pitch:DEFAULT_PITCH,hp:p.runner?140:100,respawn:0,invuln:race?0:1.5,claimTime:0,path:[],navTimer:0,goalKey:null,via:null,viaUntil:0,viaCooldown:0,attempt:0,aiThink:0,aiFire:0,aiReady:time+aiSettings(settings.difficulty,levelIndex).reaction,aiAim:null,aiTarget:null,aiMoveGoal:null,aiMoveKey:null,aiMoveUntil:0,aiMoveCheck:0,aiMoveTarget:null,aiMoveAnchor:null,aiStoodSince:time,aiThreats:new Set()});world.cameraReady[p.id]=false;}
function loadRound(isBonus,hostDuration=null){
 if(!online||online.isHost)roundEpoch=crypto.randomUUID();remoteEdges.clear();processedInputs.clear();predictionHistory=[];guestPriorDodge=guestPriorJump=false;introRemaining=2.5;roundTick=0;resultData=null;$('resultDialog').close();$('pauseDialog').close();releaseMouse();
 audioEvents=[];audioEventId=0;guestAudioWatermark=0;markedUntil=0;gameAudio.stopEffects();bonus=isBonus;paused=false;state='playing';time=0;lastQuip=-99;killFeed=[];damageFlashUntil=0;acc=0;last=performance.now();activeDuration=bonus?BONUS_TIME:(hostDuration??settings.roundSeconds);remaining=activeDuration;lastUI=0;clearInput();$('caption').textContent='';runnerId=levelIndex%players.length;map=playableMap(currentLevel(),bonus,activeDuration);shots=[];targets=[];pickups=[];
 players.forEach(p=>{Object.assign(p,{score:0,kills:0,best:Infinity,throwCD:0,catchCD:0,catchTime:0,dashCD:0,dashTime:0,weapon:'throw',weaponLevel:0,gun:false,mag:12,reload:0,runner:bonus&&p.id===runnerId,checks:[false,false],claimTime:0,shotAnim:0,pendingThrow:0,botDelay:1.7+Math.max(0,7-levelIndex)*.4});});
 world.build(map,currentLevel(),players,bonus);players.forEach(p=>spawn(p,!bonus&&isTrial(currentLevel())));
 if(bonus){quip(`${players[runnerId].name} is Potatoman. Clogs on, Game on`,true,'Clogs on, Game on');}
 else if(currentLevel().mode==='smash'){for(const pos of map.targetSpots){const mesh=world.crate(pos.x,pos.z,0,.9),ring=world.marker(pos.x,pos.z,0xffcf44,'target');targets.push({...pos,hp:80,mesh,ring,respawn:0});}}
 world.aimTargets=targets;if(!bonus)spawnPowerups();if(bonus||!isTrial(currentLevel()))spawnWeaponPads();
 $('touch').hidden=!isTouch||duo;$('hint').textContent=`${keyLabel(settings.keys[0].forward)}${keyLabel(settings.keys[0].left)}${keyLabel(settings.keys[0].back)}${keyLabel(settings.keys[0].right)} move · mouse pan · ${settings.mouse.fire===0?'Left click / ':''}${keyLabel(settings.keys[0].fire)} fire · ${keyLabel(settings.keys[0].catch)} catch · ${keyLabel(settings.keys[0].jump)} jump · ${keyLabel(settings.keys[0].crouch)} duck · ${keyLabel(settings.keys[0].dodge)} dodge · ${keyLabel(settings.keys[0].resetCamera)} reset view · Esc settings`;
 $('reticles').innerHTML=duo?'<div class="split-line"></div><div class="reticle" style="left:25%"></div><div class="reticle" style="left:75%"></div>':'<div class="reticle"></div>';
 if(!bonus&&isTrial(currentLevel()))$('reticles').innerHTML=duo?'<div class="split-line"></div>':'';
 $('world').focus({preventScroll:true});updateHUD();updatePlayabilityHUD();
 // Construct and render once before starting the frame clock, including shader warm-up.
 world.updatePlayers(players,time,STEP);world.syncProjectiles(shots);world.viewSettings=settings;world.render(online?[localPlayer()]:players,duo,STEP);listenToWorld();acc=0;last=performance.now();
}
function spawnPowerups(){
 const level=currentLevel(),random=rng(level.seed+4207),trial=isTrial(level),kinds=trial?['run','jump']:['run','fire','jump'],half=(map.n-2)*CELL/2,count=trial?2:4;
 const candidates=maxRadius=>{const list=[];for(let z=2;z<map.n-2;z++)for(let x=2;x<map.n-2;x++){const p=map.toWorld(x,z),d=Math.hypot(p.x,p.z);if(d>3&&d<=maxRadius&&!map.grid[z][x]&&!blocked(p.x,p.z,1,map.walls)&&!map.platforms.some(w=>Math.hypot(w.x-p.x,w.z-p.z)<2))list.push(p);}return list;};
 // Fewer boosts, clustered around the contested midfield rather than scattered into quiet corners;
 // fall back to the full map only if a tight maze leaves too few candidates near the centre.
 let free=candidates(Math.max(9,half*.42));if(free.length<count*3)free=candidates(half+1);
 const chosen=[];for(let id=0;id<count&&free.length;id++){let at=Math.floor(random()*free.length),p=free.splice(at,1)[0];while(free.length&&chosen.some(c=>Math.hypot(c.x-p.x,c.z-p.z)<4))p=free.splice(Math.floor(random()*free.length),1)[0];chosen.push(p);const kind=kinds[id%kinds.length],item={...p,id,kind,owner:-1,collected:false,respawn:0};item.mesh=world.powerup?.(p.x,p.z,kind)??world.marker(p.x,p.z,POWERUPS[kind].color,'boost');pickups.push(item);}
}
function spawnWeaponPads(){const item=createWeaponPickup(map,currentLevel().seed,bonus);item.mesh=world.weaponDrop?.(item.x,item.z,item.weapon,item.ammo)??world.crate(item.x,item.z,0,.8);pickups.push(item);}
function sharedWeapon(){return pickups.find(p=>p.kind==='weapon');}
function syncWeaponItem(item){if(!item)return;item.mesh.visible=item.phase==='available';item.mesh.position?.set(item.x,0,item.z);world.relabelWeaponDrop?.(item.mesh,item.weapon,item.ammo);}
function dropHeldWeapon(p){const item=sharedWeapon();if(dropWeapon(item,p,map)){syncWeaponItem(item);sound('weaponDrop',item);}}
function updateSharedWeapon(dt=0){const item=sharedWeapon();if(!item)return;if(rearmWeapon(item,dt,currentLevel().seed+levelIndex,bonus)){syncWeaponItem(item);sound('weaponDrop',item);if(!bonus)quip(WEAPONS[item.weapon].name+' IN THE BOX',false);}const p=claimWeapon(item,players,currentLevel().seed+levelIndex,bonus);if(p){syncWeaponItem(item);sound('weaponPickup',p);if(p.id===(online?.slot??0))quip(`${WEAPONS[item.weapon].name} · ${p.mag} SHOTS — ${WEAPONS[item.weapon].blurb}`,true,'');}}
function updatePowerups(dt){for(const item of pickups){if(item.kind==='weapon')continue;if(item.collected){item.respawn=Math.max(0,item.respawn-dt);if(item.respawn<=0){item.collected=false;item.mesh.visible=true;}continue;}item.mesh.rotation&&(item.mesh.rotation.y=time*.65);for(const p of players){if(p.respawn>0||p.y>1.4||Math.hypot(p.x-item.x,p.z-item.z)>1.0)continue;applyPowerup(p,item.kind);item.collected=true;item.respawn=18;item.mesh.visible=false;sound('boost_'+item.kind,p);if(p.id===(online?.slot??0))quip(POWERUPS[item.kind].label+'!',true,item.kind==='run'?'Buttery':item.kind==='fire'?'Potato Bomb':'Chipper');break;}}}
function pause(){if(state!=='playing'||paused)return;releaseMouse();$('pauseMessage').textContent=online&&!online.isHost?'Your controls are paused. The online match continues.':'The clock and all players are paused.';paused=true;clearInput();gameAudio.stopVoice();syncAudio();dialog('pauseDialog');}
function resume(){if(state!=='playing')return;$('pauseDialog').close();paused=false;clearInput();acc=0;last=performance.now();$('world').focus({preventScroll:true});initAudio();syncAudio();}
function menu(){recordPlayerRound();arenaFailed=false;pendingSnapshot=null;$('error').hidden=true;playerAccount.finish(false);releaseMouse();if(online){online.close();online=null;resetLobby();}state='menu';paused=false;clearInput();document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('hud').hidden=true;$('menu').hidden=false;gameAudio.stopVoice();syncAudio();}
$('pauseButton').onclick=pause;$('resume').onclick=resume;$('exitMatch').onclick=menu;$('resultMenu').onclick=menu;$('pauseDialog').addEventListener('cancel',e=>{e.preventDefault();resume();});$('resultDialog').addEventListener('cancel',e=>e.preventDefault());
$('nextRound').onclick=()=>{if(online&&!online.isHost)return;$('resultDialog').close();resultAction?.();};
addEventListener('blur',()=>{clearInput();musicPreviewUntil=0;if(state==='playing')pause();syncAudio();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();syncAudio();});
for(const event of ['pointerdown','pointerup','click'])document.addEventListener(event,e=>{if(event!=='pointerdown'||e.pointerType==='mouse')initAudio();},{passive:true,capture:true});
addEventListener('keydown',e=>{if(!e.repeat)initAudio();
 if(bindingCapture){e.preventDefault();if(e.repeat)return;if(e.code==='Escape'){bindingCapture=null;renderBindings();$('bindingStatus').textContent='Rebinding cancelled.';return;}const result=bindKey(settings,bindingCapture.player,bindingCapture.action,e.code);if(result.ok){bindingCapture=null;renderBindings();persist(result.message);}else $('bindingStatus').textContent=result.message;return;}
 if($('settingsDialog').open||state!=='playing')return;
 if(e.code==='Escape'){e.preventDefault();if(e.repeat)return;paused?resume():pause();return;}if(paused||e.metaKey||e.altKey)return;
 if(settings.keys.some(k=>Object.values(k).includes(e.code))){e.preventDefault();keys.add(e.code);if(!e.repeat&&Object.values(settings.keys[0]).includes(e.code))captureMouse();}
});addEventListener('keyup',e=>keys.delete(e.code));
const canvas=$('world');canvas.addEventListener('contextmenu',e=>{if(state==='playing')e.preventDefault();});
function mouseReady(){return state==='playing'&&!paused&&!document.querySelector('dialog[open]')&&!!localPlayer();}
const mouseCamera=new MouseCamera(canvas,{active:mouseReady,player:localPlayer,settings:()=>settings});
function captureMouse(force=false){if(!isTouch)mouseCamera.request(force);}
function releaseMouse(){mouseCamera.release();}
canvas.addEventListener('mousedown',e=>{if(mouseReady()){e.preventDefault();mouseButtons=e.buttons??(mouseButtons|([1,4,2][e.button]??0));initAudio();captureMouse(true);}});
document.addEventListener('mouseup',e=>{mouseButtons=e.buttons??0;});document.addEventListener('mousemove',e=>{if(mouseReady()&&Number.isInteger(e.buttons))mouseButtons=e.buttons;});
canvas.addEventListener('pointercancel',clearInput);
let movePointer=null,aimPointer=null,moveOrigin=null,aimOrigin=null;
$('moveStick').addEventListener('pointerdown',e=>{movePointer=e.pointerId;const b=e.currentTarget.getBoundingClientRect();moveOrigin={x:b.x+b.width/2,y:b.y+b.height/2};e.currentTarget.setPointerCapture(e.pointerId);});$('moveStick').addEventListener('pointermove',e=>{if(movePointer!==e.pointerId)return;const dx=(e.clientX-moveOrigin.x)/42,dz=(e.clientY-moveOrigin.y)/42;touchMove=deadzone(dx,dz,.07);$('moveStick').querySelector('i').style.transform=`translate(${touchMove.x*30}px,${touchMove.z*30}px)`;});for(const name of['pointerup','pointercancel'])$('moveStick').addEventListener(name,()=>{movePointer=null;touchMove={x:0,z:0};$('moveStick').querySelector('i').style.transform='';});
$('aimPad').addEventListener('pointerdown',e=>{aimPointer=e.pointerId;aimOrigin={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);});$('aimPad').addEventListener('pointermove',e=>{if(e.pointerId!==aimPointer||!players.length)return;localPlayer().yaw+=(e.clientX-aimOrigin.x)*.009*settings.sensitivity;localPlayer().pitch=Math.max(MIN_PITCH,Math.min(MAX_PITCH,localPlayer().pitch-(e.clientY-aimOrigin.y)*.003*settings.sensitivity*(settings.invertY?-1:1)));aimOrigin={x:e.clientX,y:e.clientY};});for(const name of['pointerup','pointercancel'])$('aimPad').addEventListener(name,()=>aimPointer=null);
for(const[id,set]of[['fireTouch',v=>touchFire=v],['catchTouch',v=>touchCatch=v],['dodgeTouch',v=>touchDodge=v],['jumpTouch',v=>touchJump=v],['crouchTouch',v=>touchCrouch=v]]){const el=$(id);el.addEventListener('pointerdown',e=>{e.currentTarget.setPointerCapture(e.pointerId);set(true);});for(const evt of['pointerup','pointercancel'])el.addEventListener(evt,()=>set(false));}
function gamepads(){try{return Array.from(navigator.getGamepads?.()??[]).filter(p=>p&&p.connected&&p.mapping==='standard');}catch{return[];}}
function assignedPads(pads){
 if(manualPadAssignment&&duo)return padAssignments.map(id=>pads.find(p=>p.index===id));
 if(!duo&&manualPadAssignment)return[pads.find(p=>p.index===padAssignments[0])??pads[0],null];
 if(!duo){const p=pads.find(p=>p.index===padAssignments[0])??pads[0];padAssignments=[p?.index??null,null];return[p,null];}
 const assigned=padAssignments.map(id=>pads.find(p=>p.index===id)??null);const available=pads.filter(p=>!assigned.includes(p));
 if(assigned.every(p=>!p)&&available.length===1)assigned[1]=available.shift();else for(let i=0;i<2;i++)if(!assigned[i])assigned[i]=available.shift()??null;
 padAssignments=assigned.map(p=>p?.index??null);return assigned;
}
function readInputs(dt){const pads=gamepads(),assignment=assignedPads(pads);if(paused||document.querySelector('dialog[open]')){inputs.forEach(o=>Object.assign(o,{x:0,z:0,fire:false,catch:false,dodge:false,jump:false,crouch:false}));const held=pads.some(p=>p.buttons[9]?.pressed);if(paused&&held&&!padPause&&!$('settingsDialog').open&&!$('controllerDialog').open)resume();padPause=held;return;}
 inputs.slice(0,duo?2:1).forEach((o,i)=>{const p=online?localPlayer():players[i];if(!p)return;const binding=settings.keys[i],held=a=>keys.has(binding[a]);let x=Number(held('right'))-Number(held('left')),z=Number(held('back'))-Number(held('forward'));
 o.fire=held('fire');o.catch=held('catch');o.dodge=held('dodge');o.jump=held('jump');o.crouch=held('crouch');p.cameraDistance=settings.zoom;o.resetCamera=held('resetCamera');
 if(i===0){o.fire||=mouseButtonHeld(settings.mouse.fire,mouseButtons);x+=touchMove.x;z+=touchMove.z;o.fire||=touchFire;o.catch||=touchCatch;o.dodge||=touchDodge;o.jump||=touchJump;o.crouch||=touchCrouch;}
 p.yaw+=(Number(held('lookRight'))-Number(held('lookLeft')))*2.4*dt*settings.sensitivity;p.pitch=Math.max(MIN_PITCH,Math.min(MAX_PITCH,p.pitch+(Number(held('lookUp'))-Number(held('lookDown')))*.6*dt));
 const pad=assignment[i];if(pad){const m=deadzone(pad.axes[0]??0,pad.axes[1]??0),aim=deadzone(pad.axes[2]??0,pad.axes[3]??0);x+=m.x;z+=m.z;p.yaw+=aim.x*3.2*settings.sensitivity*dt;p.pitch=Math.max(MIN_PITCH,Math.min(MAX_PITCH,p.pitch+(settings.invertY?1:-1)*aim.z*.65*dt));for(const[a]of PAD_ACTIONS)o[a]||=!!pad.buttons[settings.pad[i][a]]?.pressed;}
 o.x=x*Math.cos(p.yaw)-z*Math.sin(p.yaw);o.z=x*Math.sin(p.yaw)+z*Math.cos(p.yaw);
 });if(online&&!online.isHost)online.observeInput?.(inputs[0],roundEpoch);const menuHeld=pads.some(p=>p.buttons[9]?.pressed);if(menuHeld&&!padPause&&!$('settingsDialog').open){paused?resume():pause();}padPause=menuHeld;
}
function fire(p){if(p.throwCD>0||p.respawn>0||p.reload>0||p.pendingThrow>0||(p.weapon==='throw'&&p.shotAnim>0))return;
 const w=weaponConfig(p);if(w.ammo&&p.mag<=0){equipWeapon(p,'spud');return;}p.throwCD=p.fireBoost>0?w.cooldown*.53:w.cooldown;
 p.shotDuration=p.weapon==='throw'?Math.min(THROW_DURATION,p.throwCD):.18;p.shotAnim=p.shotDuration;
 if(p.weapon==='throw'){p.pendingThrow=THROW_WINDUP;return;}launchShot(p);
}
function launchShot(p){const w=weaponConfig(p);if(w.ammo){p.mag--;useWeaponRound(sharedWeapon(),p);}
 const speed=w.speed*((!bonus&&time<15&&penalty.has(p.id)&&!w.gun)?.9:1),solids=[...map.walls,...map.platforms],{velocity,obstruction}=weaponAim(p,players.filter(q=>!bonus||q.runner),solids,!bonus&&currentLevel().mode==='smash'?targets:[],speed);
 p.visualShotSpeed=speed;
 if(p.weapon!=='throw')world.flash?.(velocity.x,velocity.y,velocity.z,w.color);
 // Spread is a cone, not a fan: an odd pellet count keeps one round dead centre, and each pellet
 // carries its own copy of the weapon's ballistics so the simulation never has to look the
 // weapon up again mid-flight.
 for(let pellet=0;pellet<w.pellets;pellet++){const angle=(pellet-(w.pellets-1)/2)*w.spread+(w.pellets>3?(rng(shotId+pellet*31)()-.5)*w.spread*.9:0),c=Math.cos(angle),sn=Math.sin(angle);
  shots.push({id:++shotId,owner:p.id,...velocity,...(obstruction??{}),vx:velocity.vx*c-velocity.vz*sn,vz:velocity.vx*sn+velocity.vz*c,age:0,gun:w.gun,weapon:p.weapon,damage:w.damage,drop:dropFactor(w),life:w.life??(w.blast?3:2),blast:w.blast??0,blastDamage:w.blastDamage??0,pierce:w.pierce??0,color:w.color});}
 sound('shot_'+p.weapon,p);
 if(w.ammo&&!p.mag){const cd=p.throwCD;equipWeapon(p,'spud');p.throwCD=cd;}
}
function explode(s,direct=null){const radius=s.blast||4.5,power=s.blastDamage||80;world.burst(s.x,s.z,s.color??0xff9f36,Math.round(14+radius*2.6));world.shockwave?.(s.x,s.z,0xffb35e,radius);sound('explosion',s);for(const p of players){if(p===direct||p.respawn>0||(bonus&&!p.runner))continue;const d=Math.hypot(p.x-s.x,p.z-s.z);if(d<radius&&clearShot(s,p,map.walls))hit(p,{...s,gun:true,damage:Math.round(power*(1-d/radius))});}if(!bonus&&currentLevel().mode==='smash')for(const t of targets){if(t.hp>0&&Math.hypot(t.x-s.x,t.z-s.z)<radius&&clearShot(s,t,map.walls)){t.hp=0;t.mesh.visible=t.ring.visible=false;t.respawn=6;players[s.owner].score++;players[s.owner].points+=50;world.shockwave?.(t.x,t.z,0xffd36b,2.4);}}}
function resetView(p){resetCamera(p);if(p.id===(online?.slot??0)||duo&&p.id<2){settings.zoom=4.6;cameraValues();persist();}}
function actions(p,input,index){if(updateStance(p,input.crouch,[...map.walls,...map.platforms]))sound('crouch',p);if(input.resetCamera&&!prior[index]?.resetCamera)resetView(p);if(input.jump&&!prior[index]?.jump&&jump(p))sound('jump',p);if(p.respawn>0)return;const race=!bonus&&isTrial(currentLevel());if(input.dodge&&!prior[index]?.dodge&&p.dashCD<=0){let dx=input.x,dz=input.z,l=Math.hypot(dx,dz);if(l<.1){dx=Math.sin(p.yaw);dz=-Math.cos(p.yaw);l=1;}p.dashX=dx/l;p.dashZ=dz/l;p.dashTime=.16;p.dashCD=p.runner?2.6:2;sound('dash',p);}
 if(!race){if(input.fire&&!p.runner)fire(p);if(input.catch&&!prior[index]?.catch&&p.catchCD<=0&&!p.runner){p.catchTime=levelIndex<3?.26:.21;p.catchCD=.8;}}
 prior[index]={jump:input.jump,dodge:input.dodge,catch:input.catch,resetCamera:input.resetCamera};
}
// Pick reachable firing positions, not an opponent's feet. Decisions run at navigation
// cadence; the existing difficulty still controls reaction, aim error and fire rate.
function botCombatGoal(p,target,capture=false){
 const key=capture?'zone':target.id??`${target.x},${target.z}`;
 if(p.aiMoveGoal&&p.aiMoveKey===key&&time<p.aiMoveCheck)return p.aiMoveGoal;
 p.aiMoveCheck=time+.6;
 if(!p.aiMoveAnchor||Math.hypot(p.x-p.aiMoveAnchor.x,p.z-p.aiMoveAnchor.z)>.75){p.aiMoveAnchor={x:p.x,z:p.z};p.aiStoodSince=time;}
 // A stream of dying/respawning targets must not keep resetting a stationary bot's hold.
 const stoodTooLong=time-p.aiStoodSince>4.8;
 if(!stoodTooLong&&p.aiMoveGoal&&p.aiMoveKey===key&&time<p.aiMoveUntil&&Math.hypot(target.x-p.aiMoveTarget.x,target.z-p.aiMoveTarget.z)<2.4&&Math.hypot(target.x-p.x,target.z-p.z)>(capture?0:3.2))return p.aiMoveGoal;
 const reposition=stoodTooLong||p.aiMoveGoal&&time>=p.aiMoveUntil,turn=Math.floor(time/4.2+p.id*.31),angle=capture?p.id*Math.PI/2+turn*.72:Math.atan2(p.z-target.z,p.x-target.x)+(p.id%2?1:-1)*(.5+turn%2*.45),candidates=[];
 if(capture){for(let i=0;i<8;i++){const a=angle+i*Math.PI/4;candidates.push({x:target.x+Math.cos(a)*1.9,z:target.z+Math.sin(a)*1.9});}}
 else{const cell=map.toCell(target.x,target.z);for(let z=Math.max(1,cell.z-3);z<=Math.min(map.n-2,cell.z+3);z++)for(let x=Math.max(1,cell.x-3);x<=Math.min(map.n-2,cell.x+3);x++){if(map.grid[z][x]!==0)continue;const q=map.toWorld(x,z),d=Math.hypot(q.x-target.x,q.z-target.z);if(d>=4&&d<=10&&clearShot(q,target,map.walls))candidates.push(q);}}
 for(const q of candidates){const a=Math.atan2(q.z-target.z,q.x-target.x),d=Math.hypot(q.x-target.x,q.z-target.z),crowd=players.reduce((n,other)=>n+(other.id!==p.id&&other.respawn<=0?Math.max(0,2-Math.hypot(q.x-other.x,q.z-other.z))*4:0),0);q.cost=(reposition?Math.max(0,3.2-Math.hypot(q.x-p.x,q.z-p.z))*3:0)+Math.hypot(q.x-p.x,q.z-p.z)*.24+Math.abs(Math.atan2(Math.sin(a-angle),Math.cos(a-angle)))*2+Math.abs(d-(capture?1.9:6.4))*.45+crowd;}
 candidates.sort((a,b)=>a.cost-b.cost);
 const goal=candidates.find(q=>!blocked(q.x,q.z,.48,map.walls)&&route(map,p,q).length>0)??target;
 p.aiMoveGoal={x:goal.x,z:goal.z};p.aiMoveTarget={x:target.x,z:target.z};p.aiMoveKey=key;p.aiMoveUntil=time+3.6+p.id*.25;
 return p.aiMoveGoal;
}
// Each bot holds a distinct offset from the shared route line, so a corridor carries them abreast
// rather than nose to tail. A maze corridor is 3.2m wide against a .42m collider, so this is the
// most lateral room there is to use.
const LANES=[0,-.95,.95,-.45];
// A braided maze usually offers more than one way round, so a racer held up behind a rival can
// take one instead of queueing. The via-point is an open cell a few metres off, picked per bot,
// and always one that is itself well closer to the exit — a detour that loses ground costs the
// bot the round, and the two-minute limit leaves no room for wandering.
function raceVia(p){
 const toExit=Math.hypot(map.exit.x-p.x,map.exit.z-p.z);if(toExit<12)return null;
 const cell=map.toCell(p.x,p.z),options=[];
 for(let z=Math.max(1,cell.z-4);z<=Math.min(map.n-2,cell.z+4);z++)for(let x=Math.max(1,cell.x-4);x<=Math.min(map.n-2,cell.x+4);x++){
  if(map.grid[z][x])continue;const q=map.toWorld(x,z),d=Math.hypot(q.x-p.x,q.z-p.z);
  if(d<5||d>11||Math.hypot(map.exit.x-q.x,map.exit.z-q.z)>toExit-5)continue;
  options.push(q);
 }
 return options.length?options[(p.id*7+Math.floor(time/6))%options.length]:null;
}
function raceGoal(p){
 const toExit=Math.hypot(map.exit.x-p.x,map.exit.z-p.z);
 if(p.via&&(time>p.viaUntil||Math.hypot(p.via.x-p.x,p.via.z-p.z)<2.2))p.via=null;
 const held=!p.via&&time>p.viaCooldown&&players.some(q=>q.id!==p.id&&q.respawn<=0&&Math.hypot(q.x-p.x,q.z-p.z)<4.5&&Math.hypot(map.exit.x-q.x,map.exit.z-q.z)<toExit);
 if(held){p.viaUntil=time+4;p.viaCooldown=time+7+p.id*1.5;p.via=raceVia(p);}
 return p.via??map.exit;
}
function botInput(p,dt){const ai=aiSettings(settings.difficulty,levelIndex);p.aiThink-=dt;p.aiFire=Math.max(0,p.aiFire-dt);const mode=currentLevel().mode;const enemies=players.filter(q=>q.id!==p.id&&q.respawn<=0&&(!bonus||(p.runner?true:q.runner)));let goal,enemy=enemies.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
 if(bonus&&p.runner){const n=p.checks.findIndex(v=>!v);goal=n<0?map.exit:{x:world.checkpoints[n].position.x,z:world.checkpoints[n].position.z};}
 else if(bonus)goal=enemy;
 else if(mode==='race')goal=raceGoal(p);
 else if(mode==='assault'||mode==='climb')goal=map.course[p.courseStep]??map.exit;
 else if(mode==='capture')goal=zonePosition();
 else if(mode==='smash')goal=targets.filter(t=>t.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]??enemy;
 else goal=enemy;
 const combat=bonus||!isTrial(currentLevel()),box=sharedWeapon(),seekingBox=combat&&!p.runner&&['throw','spud'].includes(p.weapon)&&box?.phase==='available';
 if(seekingBox)goal=box;
 else if(combat&&!p.runner&&goal)goal=botCombatGoal(p,goal,!bonus&&mode==='capture');
 if(mode==='climb'&&!bonus){
  // A climber walks to the foot of the next pillar and jumps when it is within a stride, rather
  // than hammering the jump key every time anything taller is nearby.
  const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),rise=(goal.h??0)-(p.y??0);
  return{x:p.botDelay>0?0:dx/Math.max(d,.001),z:p.botDelay>0?0:dz/Math.max(d,.001),crouch:false,
   jump:p.botDelay<=0&&p.grounded&&rise>.05&&d<2.6,fire:false,catch:false,dodge:false};
 }
 if(mode==='assault'&&!bonus){const gate=goal.duck;const targetX=goal.x+(gate?goal.direction*1.8:0);let dx=targetX-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);
  // The course runners used to trace one identical straight line to one identical point. Each now
  // holds its own lane on the approach, faded out over the last few metres so nobody is nudged off
  // a platform or away from a gate mouth by it.
  const lane=((p.id%3)-1)*2.9*Math.min(1,Math.max(0,(d-3.4)/4));
  if(lane&&d>.001){const px=-dz/d,pz=dx/d;dx+=px*lane;dz+=pz*lane;d=Math.hypot(dx,dz);}
  return{x:p.botDelay>0?0:dx/Math.max(d,.001),z:p.botDelay>0?0:dz/Math.max(d,.001),crouch:!!gate&&d<5,jump:!gate&&p.botDelay<=0&&p.grounded&&(goal.h>(p.y??0)+.05&&d<3.15||map.platforms.some(w=>w.h>p.y+.05&&Math.hypot(w.x-p.x,w.z-p.z)<2.6)),fire:false,catch:false,dodge:false};}
 if(!goal)return{x:0,z:0,fire:false,dodge:false,catch:false};p.navTimer-=dt;if(p.navTimer<=0){const c=map.toCell(goal.x,goal.z),goalKey=c.x+','+c.z;if(p.goalKey!==goalKey||!p.path.length){p.path=route(map,p,goal,p.id*2+Math.floor((time+p.id*3.1)/9)).slice(1);p.goalKey=goalKey;}p.navTimer=.6;}
 while(p.path.length&&Math.hypot(p.path[0].x-p.x,p.path[0].z-p.z)<.4)p.path.shift();const waypoint=p.path[0]??goal;let dx=waypoint.x-p.x,dz=waypoint.z-p.z,l=Math.hypot(dx,dz);
 // Each bot holds its own lane alongside the shared route, so rivals arrive spread out
 // instead of filing along one identical line.
 const lane=LANES[p.id%LANES.length];if(lane&&l>1.2){const px=-dz/l,pz=dx/l;dx+=px*lane;dz+=pz*lane;l=Math.hypot(dx,dz);}
 let moving=l>.3;
 // Engagement range follows the weapon, so a bot holding a burn-out sprayer closes the distance
 // and one holding the rifle opens it instead of every bot fighting at the same 21 metres.
 const reach=weaponConfig(p).life?6.5:p.weapon==='peeler'?34:p.weapon==='mortar'?26:21;
 let aim=(!bonus&&mode==='smash')?targets.filter(t=>t.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]:enemy,canShoot=aim&&Math.hypot(aim.x-p.x,aim.z-p.z)<reach&&clearShot(p,aim,map.walls)&&(!bonus||!p.runner)&&!isTrial(currentLevel());
 if(bonus&&!p.runner&&aim)canShoot=Math.hypot(aim.x-p.x,aim.z-p.z)<Math.max(26,reach)&&clearShot(p,aim,map.walls);
 if(bonus&&p.runner)canShoot=false;
 // Keep bodies separate while taking up firing/zone positions, including exact overlaps.
 if(combat&&!p.runner&&!seekingBox){let sx=0,sz=0;for(const q of players){if(q.id===p.id||q.respawn>0)continue;const distance=Math.hypot(p.x-q.x,p.z-q.z);if(distance<1.25){const a=(p.id-q.id)*2.4;sx+=(distance>.01?(p.x-q.x)/distance:Math.cos(a))*(1.25-distance);sz+=(distance>.01?(p.z-q.z)/distance:Math.sin(a))*(1.25-distance);}}if(Math.hypot(sx,sz)>.05){
  if(moving){const nx=dx/Math.max(l,.1),nz=dz/Math.max(l,.1),opposed=Math.min(0,sx*nx+sz*nz);sx-=nx*opposed;sz-=nz*opposed;
   // Yield sideways in a head-on meeting; never cancel forward navigation to zero.
   if(opposed<0&&Math.hypot(sx,sz)<.1){sx=-nz*.65;sz=nx*.65;}dx=nx+sx*2;dz=nz+sz*2;
  }else{dx=sx*2;dz=sz*2;}l=Math.hypot(dx,dz);moving=l>.05;
 }}
 const targetId=canShoot?(aim.id??`${aim.x},${aim.z}`):null;
 if(targetId!==p.aiTarget){p.aiTarget=targetId;p.aiReady=time+ai.reaction;p.aiThink=0;}
 // A marked runner is easier to lead: the hunters' aim wander shrinks for as long as the mark
 // lasts, which is what makes securing an objective a real decision rather than a free stop.
 const wander=ai.error*(bonus&&!p.runner&&time<markedUntil?.35:1);
 if(p.aiThink<=0){p.aiThink=ai.reaction;p.aiAim=canShoot?{x:aim.x+Math.sin(time*1.3+p.id*4)*wander,z:aim.z+Math.cos(time*.9+p.id*3)*wander}:null;}
 if(canShoot&&aim){const distance=Math.max(.8,Math.hypot(aim.x-p.x,aim.z-p.z)),height=!bonus&&mode==='smash'?.65:(aim.y??0)+bodyHeight(aim)*.63,desired=Math.max(MIN_PITCH,Math.min(MAX_PITCH,Math.atan2(height-(p.y+cameraHeight(p)),Math.sqrt(Math.max(.1,distance*distance-CAMERA_SHOULDER*CAMERA_SHOULDER)))));p.pitch+=(desired-p.pitch)*Math.min(1,dt*ai.turn);}else p.pitch+=(DEFAULT_PITCH-p.pitch)*Math.min(1,dt*3);
 const targetYaw=canShoot&&p.aiAim?Math.atan2(p.aiAim.x-p.x,-(p.aiAim.z-p.z))-Math.asin(Math.min(.8,CAMERA_SHOULDER/Math.max(.8,Math.hypot(p.aiAim.x-p.x,p.aiAim.z-p.z)))):Math.atan2(dx,-dz);const diff=Math.atan2(Math.sin(targetYaw-p.yaw),Math.cos(targetYaw-p.yaw));p.yaw+=Math.max(-dt*ai.turn,Math.min(dt*ai.turn,diff));
 if(p.botDelay>0||(!bonus&&mode==='race'&&(time+p.id*2)%8<ai.hesitate))moving=false;
 let dodge=false,catchSpud=false;const hazard=shots.find(s=>s.owner!==p.id&&!s.gun&&!p.aiThreats.has(s.id)&&Math.hypot(s.x-p.x,s.z-p.z)<3.5);
 if(hazard){p.aiThreats.add(hazard.id);if(p.aiThreats.size>128){const live=new Set(shots.map(s=>s.id));p.aiThreats=new Set([...p.aiThreats].filter(id=>live.has(id)));}const chance=rng(hazard.id*7919+p.id*971+currentLevel().seed)();catchSpud=chance<ai.catch&&p.catchCD<=0;dodge=!catchSpud&&chance<ai.catch+ai.dodge&&p.dashCD<=0;}
 const shooting=!!canShoot&&Math.abs(diff)<.13&&time>=p.aiReady&&p.botDelay<=0&&p.aiFire<=0&&p.throwCD<=0;
 if(shooting)p.aiFire=p.gun?ai.gunInterval:ai.fireInterval;
 return{x:moving?dx/Math.max(l,.1):0,z:moving?dz/Math.max(l,.1):0,fire:shooting,dodge,catch:catchSpud};
}
function zonePosition(){if(levelIndex<6)return{x:0,z:0};const n=Math.floor(time/45)%3;return n===0?{x:0,z:0}:map.toWorld(n===1?3:map.n-4,Math.floor(map.n/2));}
function hit(p,s){if(p.invuln>0)return;const fromX=-s.vx,fromZ=-s.vz,l=Math.hypot(fromX,fromZ),dot=(Math.sin(p.yaw)*fromX-Math.cos(p.yaw)*fromZ)/Math.max(l,.01);
 if(!s.gun&&p.catchTime>0&&dot>.25){p.catchTime=0;p.throwCD=0;sound('catch',p);world.burst(p.x,p.z,0xffeb9d,6);return;}
 p.hp-=s.damage;if(p.id!==s.owner)players[s.owner].points+=10;if(s.owner===(online?.slot??0))hitUntil=performance.now()+150;if(p.id===(online?.slot??0)){damageFlashUntil=performance.now()+260;gameAudio.pain();}sound('hit',p);if(s.owner===(online?.slot??0))quip('Baked');world.burst(p.x,p.z,colors[p.id]);if(p.hp<=0){loseLoadout(p);dropHeldWeapon(p);p.respawn=3;p.vx=p.vz=0;world.burst(p.x,p.z,colors[p.id],20);world.shockwave?.(p.x,p.z,colors[p.id],3);if(p.id!==s.owner){if(!bonus&&currentLevel().mode==='battle')players[s.owner].score++;players[s.owner].knockouts++;players[s.owner].kills=(players[s.owner].kills??0)+1;players[s.owner].points+=100;const killer=players[s.owner],now=performance.now();if(!bonus&&earnedKill(killer)){sound('weaponPickup',killer);if(killer.id===(online?.slot??0))quip('KILL EARNED · SPUD GUN',true,'');}killer.comboCount=(killer.comboUntil??0)>now?(killer.comboCount??1)+1:1;killer.comboUntil=now+6000;pushKillFeed(`${escapeHTML(killer.name)} mashed ${escapeHTML(p.name)}`);if(killer.comboCount>1){const label=killer.comboCount===2?'DOUBLE MASH!':killer.comboCount===3?'TRIPLE MASH!':'MASH FRENZY!';pushKillFeed(label);if(killer.id===(online?.slot??0))quip(label,true,label);}}if(bonus&&p.runner){finishBonus(false);return;}}}
function tick(dt){readInputs(dt);if(paused&&(!online||online.isHost))return;if(online&&paused)Object.assign(inputs[0],{x:0,z:0,fire:false,catch:false,dodge:false,jump:false,crouch:false});if(introRemaining>0){introRemaining=Math.max(0,introRemaining-dt);return;}time+=dt;remaining=Math.max(0,remaining-dt);const mode=currentLevel().mode;
 for(const p of players){if(online&&!isHuman(p))continue;p.played+=dt;for(const key of['throwCD','catchCD','catchTime','dashCD','dashTime','invuln','shotAnim','botDelay','runBoost','fireBoost','jumpBoost'])p[key]=Math.max(0,p[key]-dt);
 if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(!p.reload)p.mag=12;}
 if(p.respawn>0){p.pendingThrow=0;p.shotAnim=0;p.respawn-=dt;if(p.respawn<=0)spawn(p,!bonus&&isTrial(currentLevel()));continue;}
 if(p.pendingThrow>0){p.pendingThrow=Math.max(0,p.pendingThrow-dt);if(!p.pendingThrow&&p.weapon==='throw'&&!p.runner)launchShot(p);}
 let input=isHuman(p)?(online&&p.id!==online.slot?remoteInput(p):inputs[online?0:p.id]):botInput(p,dt);actions(p,input,p.id);let speed=p.runner?8.5:6;if(!isHuman(p)){const ai=aiSettings(settings.difficulty,levelIndex);speed*=p.runner?ai.runner:ai.speed;}
 const footX=p.x,footZ=p.z,wasGrounded=p.grounded;movePlayer(p,input,dt,map,speed);if(!wasGrounded&&p.grounded)sound('land',p);if(p.grounded){p.stepTravel=(p.stepTravel??0)+Math.hypot(p.x-footX,p.z-footZ);if(p.stepTravel>Math.PI/2.8){p.stepTravel-=Math.PI/2.8;sound('step',p);}}if(p.inWater){loseLoadout(p);dropHeldWeapon(p);p.hp=0;p.respawn=1.5;p.vx=p.vz=0;world.burst(p.x,p.z,0x8ccad0,12);if(p.id===(online?.slot??0))quip('IN THE DRINK · RESPAWNING',true,'Mashed');continue;}
 p.attempt+=dt;
 if(!bonus&&mode==='climb'){
  // Height is the objective, so credit the highest pillar actually stood on rather than insisting
  // the climb be done strictly in order — a lucky jump that skips a step still counts.
  for(const c of map.course)if(p.grounded&&Math.abs((p.y??0)-c.h)<.14&&Math.hypot(p.x-c.x,p.z-c.z)<(c.wide?1.9:1.1)&&c.index>=p.courseStep){p.courseStep=c.index+1;p.points+=20;sound('checkpoint',p);}
 }
 if(!bonus&&mode==='assault'){const c=map.course[p.courseStep];if(c){let cleared=false;if(c.duck){const progress=(p.x-c.x)*c.direction,inside=Math.abs(p.z-c.z)<1.4&&p.y<.12&&p.grounded&&p.crouching;if(inside&&progress<-1&&progress>-2.5)p.courseDuckEntry=1;if(inside&&Math.abs(progress)<.7&&p.courseDuckEntry===1)p.courseDuckEntry=2;cleared=inside&&progress>1.3&&p.courseDuckEntry===2;}else cleared=Math.hypot(p.x-c.x,p.z-c.z)<1.05&&Math.abs(p.y-c.h)<.12&&p.grounded;if(cleared){p.courseStep++;p.courseDuckEntry=0;p.points+=25;sound(c.duck?'duckGate':'checkpoint',p);}}}
 // A tower's exit sits directly above its own base, so reaching it has to mean reaching that
 // height as well as that spot on the floor plan.
 const atExit=Math.hypot(p.x-map.exit.x,p.z-map.exit.z)<1.25&&(map.exitHeight===undefined||Math.abs((p.y??0)-map.exitHeight)<.9);
 if(!bonus&&isTrial(currentLevel())&&(mode!=='assault'||p.courseStep===map.course.length)&&atExit){p.best=Math.min(p.best,p.attempt);p.score++;p.points+=300+Math.max(0,Math.round(120-p.attempt));p.respawn=1;world.burst(p.x,p.z,0x7dedc8,16);sound('win',p);if(p.id===(online?.slot??0))quip(`${p.name}: ${p.best.toFixed(2)} seconds. Go again!`,true,'Running down the fine river of butter');}
 if(bonus&&p.runner){
  // Securing an objective takes a moment standing over it. That pause is the whole round: it is
  // the only time the runner is predictable, and it is what gives the hunters a shot worth taking.
  const over=world.checkpoints.findIndex((c,i)=>!p.checks[i]&&Math.hypot(p.x-c.position.x,p.z-c.position.z)<1.6);
  if(over>=0){p.claimTime=(p.claimTime??0)+dt;
   if(p.claimTime>=CLAIM_SECONDS){p.checks[over]=true;p.claimTime=0;
    // Taking one marks the runner for the hunters and buys a burst of speed to break the hold.
    p.runBoost=Math.max(p.runBoost,4.5);markedUntil=time+MARKED_SECONDS;p.points+=150;
    sound('checkpoint',p);world.shockwave?.(p.x,p.z,0xffd36b,3.2);
    quip(p.checks.every(Boolean)?'BOTH SECURED · RUN FOR THE EXIT':'SECURED · YOU ARE MARKED',true,'');}
  }else p.claimTime=0;
  if(p.checks.every(Boolean)&&Math.hypot(p.x-map.exit.x,p.z-map.exit.z)<1.5){finishBonus(true);return;}
 }
 }
 if(state!=='playing')return;
 // Pressure rises through the hunt: the hunters get a run of speed for the closing stretch, so a
 // runner sitting on the exit with time to spare still has to earn it.
 if(bonus&&remaining<=HUNT_PUSH)for(const p of players)if(!p.runner&&p.respawn<=0)p.runBoost=Math.max(p.runBoost,.2);
 if(!bonus)updatePowerups(dt);
 updateSharedWeapon(dt);
 if(!bonus&&mode==='capture'){const pos=zonePosition();world.zone.position.set(pos.x,.03,pos.z);const inside=players.filter(p=>p.respawn<=0&&Math.hypot(p.x-pos.x,p.z-pos.z)<3);if(inside.length===1){inside[0].score+=dt;inside[0].points+=dt*5;}}
 for(let i=shots.length-1;i>=0;i--){const s=shots[i],ax=s.x,ay=s.y,az=s.z,g=s.drop*THROW_DROP;s.age+=dt;s.x+=s.vx*dt;s.z+=s.vz*dt;s.y+=s.vy*dt-g*dt*dt;if(g)s.vy-=2*g*dt;
 // A fused round detonates on its own clock; a burn-out round simply expires. Both read as
 // `life` running out, and only a round carrying a blast does anything when it does.
 const expired=s.age>s.life;let gone=expired||s.y<.1;let direct=null;
 if(!gone){let contact={t:Infinity,type:null,value:null};
  for(const w of [...map.walls,...map.platforms]){const t=boxContact3D(ax,ay,az,s.x,s.y,s.z,w,s.gun&&s.weapon!=='rpg'?.025:.18);if(t<contact.t)contact={t,type:'wall',value:w};}
  for(const p of players){if(p.id===s.owner||p.respawn>0||(bonus&&!p.runner))continue;const t=cylinderContact({x:ax,y:ay,z:az},s,p,s.gun?.03:.15);if(t<contact.t)contact={t,type:'player',value:p};}
  if(!bonus&&mode==='smash')for(const t of targets){if(t.hp<=0)continue;const at=circleContact(ax,az,s.x,s.z,t.x,t.z,.65);if(at<contact.t)contact={t:at,type:'target',value:t};}
  if(Number.isFinite(contact.t)){s.x=ax+(s.x-ax)*contact.t;s.y=ay+(s.y-ay)*contact.t;s.z=az+(s.z-az)*contact.t;gone=true;
   // A piercing round spends one charge on the body it passed through and carries on from the
   // far side of it, so a single well-led shot can line two rivals up.
   if(contact.type==='player'&&s.pierce>0){s.pierce--;hit(contact.value,s);gone=false;s.x+=s.vx*.06;s.z+=s.vz*.06;s.y+=s.vy*.06;}
   else if(contact.type==='player'){direct=contact.value;hit(contact.value,s);}
   else if(contact.type==='target'){const t=contact.value;t.hp-=s.damage;t.mesh.scale?.setScalar(t.hp>0?.9:1);world.burst(t.x,t.z);if(t.hp<=0){players[s.owner].score++;players[s.owner].points+=50;t.mesh.visible=t.ring.visible=false;t.respawn=6;sound('hit',t);world.shockwave?.(t.x,t.z,0xffd36b,2.4);}}
   else{world.burst(s.x,s.z,0xc9af82,4);sound('impact',s);}
  }
 }
 if(gone){if(s.blast)explode(s,direct);shots.splice(i,1);}if(state!=='playing')return;
 }
 for(const t of targets)if(t.hp<=0){t.respawn-=dt;if(t.respawn<=0){t.hp=80;t.mesh.scale?.setScalar(1);t.mesh.visible=t.ring.visible=true;}}
 if(time>captionUntil)$('caption').textContent='';
 if(remaining<=0){bonus?finishBonus(false):finishMain();return;}
 world.effectsUpdate(dt);
}
function finishMain(){if(state!=='playing'||online&&!online.isHost)return;releaseMouse();state='results';clearInput();const mode=currentLevel().mode,sorted=[...players].sort((a,b)=>isTrial(currentLevel())?a.best-b.best:b.score-a.score);const best=isTrial(currentLevel())?sorted[0].best:sorted[0].score;const winners=sorted.filter(p=>isTrial(currentLevel())?Number.isFinite(p.best)&&Math.abs(p.best-best)<STEP:Math.abs(p.score-best)<STEP);for(const p of winners){p.total+=3;p.points+=300;}awardRoundWins(players,winners);const closingLine=lastPlaceLine(players,isTrial(currentLevel()),levelIndex);if(closingLine)gameAudio.speak(closingLine,{force:true,role:'commentary'});
 $('resultTag').textContent=`LEVEL ${String(levelIndex+1).padStart(2,'0')} COMPLETE`;$('resultTitle').textContent=winners.length===1?`${winners[0].name} takes the round.`:winners.length?'A shared victory.':'No escape this round.';$('resultText').textContent=isTrial(currentLevel())?'Fastest completed escape wins. Each round winner earns 3 circuit points.':'Each round winner earns 3 circuit points. Equal scores share victory.';
 $('resultsTable').innerHTML=sorted.map(p=>`<div class="result-row"><span style="color:${hex[p.id]}">${escapeHTML(p.name)}${(p.roundWins??0)>=3?' ♛':''}</span><b>${isTrial(currentLevel())?(Number.isFinite(p.best)?p.best.toFixed(2)+'s':'DNF'):Math.floor(p.score)+(mode==='capture'?'s held':'')} <small>· ${p.kills??0} KO · ${p.total} circuit pts · ${Math.floor(p.points)} score</small></b></div>`).join('');
 if(levelIndex===LEVELS.length-1){$('nextRound').textContent='PLAY AGAIN →';resultAction=()=>start(0);const leaders=[...players].sort((a,b)=>b.total-a.total),top=leaders.filter(p=>p.total===leaders[0].total);$('resultText').textContent=`Circuit complete. ${top.map(p=>p.name).join(' + ')} ${top.length>1?'share the lead':'wins'} with ${top[0].total} points.`;}
 else{$('nextRound').textContent='BONUS HUNT →';resultAction=()=>loadRound(true);$('resultText').textContent+=` Next: ${players[levelIndex%players.length].name} becomes Potatoman.`;}if(closingLine)$('resultText').textContent+=' '+closingLine;sound('win');captureResult();resultData.commentary=closingLine;recordPlayerRound();playerAccount.checkpoint();dialog('resultDialog');}
function finishBonus(escaped){if(state!=='playing'||online&&!online.isHost)return;releaseMouse();state='results';clearInput();nextPenalty=new Set();if(escaped){players[runnerId].total+=1;players[runnerId].points+=100;players.filter(p=>p.id!==runnerId).forEach(p=>nextPenalty.add(p.id));}else players.filter(p=>p.id!==runnerId).forEach(p=>{p.total+=1;p.points+=100;});
 $('resultTag').textContent='THE GREAT SPUD ESCAPE';$('resultTitle').textContent=escaped?"Can't catch this spud!":'The hunters take it.';$('resultText').textContent=escaped?'Potatoman escaped. Hunters throw potatoes 10% slower for the first 15 seconds of the next level.':'Potatoman was stopped or ran out of time. Each hunter earns 1 circuit point. Normal throws next level.';$('resultsTable').innerHTML=players.map(p=>`<div class="result-row"><span style="color:${hex[p.id]}">${escapeHTML(p.name)}${p.id===runnerId?' · POTATOMAN':''}</span><b>${p.total} pts</b></div>`).join('');$('nextRound').textContent='NEXT LEVEL →';resultAction=()=>{penalty=new Set(nextPenalty);levelIndex++;loadRound(false);};sound('win');captureResult();recordPlayerRound();playerAccount.checkpoint();dialog('resultDialog');}
function updateHUD(){if(!players.length)return;const l=currentLevel(),mode=l.mode;hudText('roundIndex',bonus?'BONUS ROUND':`ROUND ${String(levelIndex+1).padStart(2,'0')} / ${LEVELS.length}`);hudText('levelName',bonus?'The Great Spud Escape':l.name);hudText('modeName',bonus?'HUNT POTATOMAN':MODES[mode]);hudText('timer',`${Math.floor(Math.ceil(remaining)/60)}:${String(Math.ceil(remaining)%60).padStart(2,'0')}`);$('timer').style.color=remaining<30?'#ff8c6e':'';$('timerWrap').classList.toggle('critical',remaining<=10);
 const feedNow=performance.now();killFeed=killFeed.filter(k=>k.until>feedNow);hudMarkup('killFeed',killFeed.map(k=>`<div class="feed-row">${k.text}</div>`).join(''));$('killFeed').hidden=!killFeed.length;
 hudText('objective',bonus?'Runner: hold both crates, then reach the exit. Hunters: stop him before he does.':({climb:`Climb all ${map.course.length} platforms to the top of the tower · fastest ascent wins`,assault:`Land on ${map.course.length} numbered platforms in order · fastest run wins`,race:`Fastest escape in ${activeDuration/60} minutes wins · repeat to improve`,battle:'Most knockouts wins · one shared weapon box at the centre',capture:'Hold the gold zone · contested earns nothing',smash:'Break the gold-ringed crates'})[mode]);
 // Knockouts still count for something in objective rounds, so they ride alongside the objective score.
 const showKills=!bonus&&mode!=='battle';
 hudMarkup('scoreboard',players.map(p=>`<div class="score-row" style="--player:${hex[p.id]}"><span>${p.runner?'★ ':''}${escapeHTML(p.name)}</span><b>${bonus?Math.max(0,p.hp)+' HP':isTrial(currentLevel())?(Number.isFinite(p.best)?p.best.toFixed(2)+'s':'—'):Math.floor(p.score)}${showKills?`<small>${p.kills??0} KO</small>`:''}</b></div>`).join(''));
 const showPenalty=!bonus&&time<15&&penalty.size&&!isTrial(currentLevel());$('bonusBanner').hidden=!bonus&&!showPenalty;hudText('bonusBanner',bonus?`${players[runnerId].name} · ${players[runnerId].checks.filter(Boolean).length}/2 SECURED · ${time<markedUntil?'MARKED — HUNTERS HAVE THE SCENT':players[runnerId].checks.every(Boolean)?'EXIT OPEN — RUN':players[runnerId].claimTime>0?`SECURING ${Math.round(players[runnerId].claimTime/CLAIM_SECONDS*100)}%`:'STAND ON A CRATE TO SECURE IT'}`:`SLOW SPUDS · ${Math.ceil(15-time)}s remaining`);
 hudMarkup('playerHud',(online?[localPlayer()]:players.slice(0,duo?2:1)).map(p=>`<div class="player-panel ${duo&&p.id===1?'second':''}" style="--player:${hex[p.id]}"><strong>${escapeHTML(p.name)}${(p.roundWins??0)>=3?' · ♛':''}${p.runner?' · POTATOMAN':!isTrial(currentLevel())||bonus?' · '+weaponConfig(p).name:''}</strong><div class="health"><i style="width:${Math.max(0,p.hp)/(p.runner?140:100)*100}%"></i></div><div class="player-status"><span>${p.respawn>0?'BACK IN '+Math.ceil(p.respawn)+'s':weaponConfig(p).ammo?(p.reload>0?'RELOADING…':p.mag+' SHOTS'):isTrial(currentLevel())&&!bonus?'RUN '+p.attempt.toFixed(1)+'s':Math.floor(p.points)+' PTS'}</span><span>${p.dashCD>0?'DODGE '+p.dashCD.toFixed(1)+'s':'DODGE READY'} · ${p.catchCD>0?'CATCH '+p.catchCD.toFixed(1)+'s':'CATCH READY'}</span></div><div class="boost-status">${p.weapon==='throw'&&(!isTrial(currentLevel())||bonus)?'MASH A RIVAL → SPUD GUN · ':''}${Object.values(POWERUPS).filter(b=>p[b.field]>0).map(b=>b.caption+' '+Math.ceil(p[b.field])+'s').join(' · ')}${!bonus&&['assault','climb'].includes(currentLevel().mode)?' · '+p.courseStep+'/'+map.course.length+(currentLevel().mode==='climb'?' UP · '+Math.round(p.y??0)+'m':' PLATFORMS'):''}</div></div>`).join(''));
}
playerAccount.sample=()=>{if(!players.length)return;const p=localPlayer();if(!p)return;playerAccount.updateTotal(p.total,p.knockouts,p.points,p.played);if(!bonus&&!circuitSeed&&currentLevel().mode==='race')playerAccount.raceTime(levelIndex,p.best);};
// The hunt's own clock: how long a grab takes, how long it leaves the runner lit up afterwards,
// and when the hunters get their closing push.
const CLAIM_SECONDS=1.1,MARKED_SECONDS=6,HUNT_PUSH=14;
let markedUntil=0;
let circuitHistory=[],circuitId='',online=null,roundEpoch='',roundTick=0,introRemaining=0,hitUntil=0,resultData=null,snapshotSeq=0,lastNetFrame=0,applyingSnapshot=false,pendingSnapshot=null,predictionHistory=[],lastGuestStateTime=0,hostPaused=false,manualPadAssignment=false;
const remoteEdges=new Map(),processedInputs=new Map();
const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function captureResult(){const ranked=[...players].sort((a,b)=>!bonus&&isTrial(currentLevel())?a.best-b.best:b.score-a.score),top=ranked[0],winners=bonus?[]:players.filter(p=>isTrial(currentLevel())?Number.isFinite(p.best)&&Math.abs(p.best-top.best)<STEP:Math.abs(p.score-top.score)<STEP).map(p=>p.id);if(!bonus&&!circuitHistory.some(r=>r.epoch===roundEpoch))circuitHistory.push({epoch:roundEpoch,level:levelIndex,duration:activeDuration,rankedMaze:!circuitSeed&&currentLevel().mode==='race',winners,players:players.map(p=>({id:p.id,total:p.total,best:Number.isFinite(p.best)?p.best:null,knockouts:p.knockouts}))});resultData={winners,tag:$('resultTag').textContent,title:$('resultTitle').textContent,text:$('resultText').textContent,button:$('nextRound').textContent,rows:players.map(p=>({id:p.id,value:!bonus&&isTrial(currentLevel())?(Number.isFinite(p.best)?p.best.toFixed(2)+'s':'DNF'):bonus?'':Math.floor(p.score)+(!bonus&&currentLevel().mode==='capture'?'s held':'')}))};}
function recordPlayerRound(){if(!players.length)return;const p=localPlayer();for(const round of circuitHistory){const data=round.players.find(q=>q.id===p.id);if(data)playerAccount.record({epoch:round.epoch,level:round.level,duration:round.duration,rankedMaze:round.rankedMaze,won:round.winners.includes(p.id),total:data.total,best:data.best,knockouts:data.knockouts});}playerAccount.updateTotal(p.total,p.knockouts,p.points,p.played);}

function resetLobby(){for(const id of['solo','duo','play','levelsButton'])$(id).disabled=false;$('onlineButton').innerHTML='PLAY ONLINE <span>3 PLAYERS · NO BOTS</span>';$('roomSetup').hidden=false;$('roomLobby').hidden=true;$('networkHud').hidden=true;$('nextRound').disabled=false;$('roomStatus').textContent='';}
function roomRoster(roster){$('roomRoster').innerHTML=Array.from({length:3},(_,i)=>{const m=roster.find(m=>m.slot===i);return`<div class="roster-player"><strong style="color:${hex[i]}">${m?escapeHTML(m.name):'WAITING FOR PLAYER'}</strong><span>${m?(i===0?'HOST':`PLAYER ${i+1}`):'OPEN PLACE'}</span></div>`;}).join('');$('startOnline').hidden=!online?.isHost;$('startOnline').disabled=roster.length!==3;$('roomConnection').textContent=online?.isHost?(roster.length!==3?`${roster.length}/3 players · invite your friends.`:'Three players ready. No bots.'):'Waiting for the host to start.';if(online?.isHost&&players.length)for(const m of roster)if(players[m.slot])players[m.slot].name=m.name;if(['playing','results'].includes(state)&&online&&roster.length!==3){menu();dialog('onlineDialog');$('roomStatus').textContent='A player left. Scores were saved. Create a new three-player room to continue.';}}
function openOnline(){if(online){dialog('onlineDialog');return;}resetLobby();dialog('onlineDialog');}
$('onlineButton').onclick=openOnline;
async function connectRoom(action){if(online)return;if(!await playerAccount.requirePlayer(()=>connectRoom(action)))return;$('createRoom').disabled=$('joinRoom').disabled=true;$('roomStatus').textContent=action==='create'?'Creating your room…':'Joining the room…';const connection=new RoomConnection({roster:r=>{if(online===connection)roomRoster(r);},snapshot:s=>{if(online===connection)receiveRemoteSnapshot(s,connection);},connection:label=>{if(online!==connection)return;$('networkHud').textContent=label;},closed:message=>{if(online!==connection)return;const wasPlaying=state==='playing'||state==='results';menu();if(wasPlaying)dialog('onlineDialog');resetLobby();$('roomStatus').textContent=message;}});online=connection;
 try{await connection.connect(action,playerAccount.player.name,$('joinCode').value.trim().toUpperCase());if(online!==connection||!connection.active)return;setPlayers(false);for(const id of['solo','duo','play','levelsButton'])$(id).disabled=true;$('onlineButton').textContent='RETURN TO ONLINE ROOM';$('roomSetup').hidden=true;$('roomLobby').hidden=false;$('roomCode').textContent=connection.code;$('roomStatus').textContent='';roomRoster(connection.roster);}catch(e){online=null;await connection.close(false);$('roomStatus').textContent=e.message;}finally{$('createRoom').disabled=$('joinRoom').disabled=false;}}
$('createRoom').onclick=()=>connectRoom('create');$('joinRoom').onclick=()=>connectRoom('join');
$('copyRoom').onclick=async()=>{const url=new URL(location.href);url.search='';url.hash='room='+online.code;try{await navigator.clipboard.writeText(url.href);$('roomStatus').textContent='Invite link copied.';}catch{$('roomStatus').textContent='Share this room code: '+online.code;}};
$('leaveRoom').onclick=async()=>{if(state==='playing'||state==='results'){menu();return;}const c=online;online=null;await c?.close();resetLobby();};
$('startOnline').onclick=async()=>{if(!online?.isHost||online.roster.length!==3)return;$('startOnline').disabled=true;online.startRequested=true;$('onlineDialog').close();await start(0);};
function remoteInput(p){const incoming=online.remoteInputs.get(p.id);const edges=remoteEdges.get(p.id)??{};remoteEdges.set(p.id,edges);if(incoming?.data.epoch===roundEpoch&&performance.now()-incoming.received<=500)processedInputs.set(p.id,incoming.data.seq);return remoteControl(incoming?.data,p,roundEpoch,edges,incoming?performance.now()-incoming.received:Infinity);}
function makeSnapshot(){return{version:10,audioEvents:audioEvents.filter(e=>time-e.time<1.5),circuitSeed,circuitId,history:circuitHistory,seq:++snapshotSeq,epoch:roundEpoch,roundTick,levelIndex,bonus,state,time,remaining,activeDuration,intro:introRemaining,paused,penalty:[...penalty],players:players.map(packPlayer),shots:shots.map(s=>({...s})),targets:targets.map(t=>({hp:t.hp,respawn:t.respawn})),pickups:pickups.map(p=>({id:p.id,kind:p.kind,owner:p.owner,collected:p.collected,respawn:p.respawn,weapon:p.weapon??null,x:p.x,z:p.z,ammo:p.ammo??0,phase:p.phase??null,holder:p.holder??-1})),result:resultData,acks:Object.fromEntries(processedInputs)};}
function networkFrame(now){if(!online?.active||!world||!players.length)return;$('networkHud').hidden=false;if(online.isHost){if(now-lastNetFrame>=50){lastNetFrame=now;if(['playing','results'].includes(state))online.publish(makeSnapshot());}}else if(state==='playing'&&now-lastNetFrame>=33){lastNetFrame=now;const p=localPlayer(),o=paused||hostPaused?{x:0,z:0,fire:false,catch:false,dodge:false,jump:false,crouch:false}:inputs[0];const packet=online.input(o,p,roundEpoch);predictionHistory.push({seq:packet.seq,x:p.x,y:p.y,vy:p.vy,z:p.z});if(predictionHistory.length>180)predictionHistory.shift();}}
function receiveRemoteSnapshot(snapshot,connection=online){if(connection!==online||!validSnapshot(snapshot))return;pendingSnapshot={snapshot,connection};if(!applyingSnapshot&&!arenaFailed)drainSnapshots();}
async function drainSnapshots(){applyingSnapshot=true;try{while(pendingSnapshot&&!arenaFailed&&online&&!online.isHost){const {snapshot:s,connection}=pendingSnapshot;pendingSnapshot=null;if(connection!==online)continue;
 if(!world){state='loading';roundEpoch='';$('error').hidden=true;$('loading').hidden=false;world=new World($('world'));await world.ready;world.quality(settings.quality);initAudio();}
 if(connection!==online)continue;
 if(s.circuitId!==circuitId){circuitId=s.circuitId;circuitHistory=[];playerAccount.begin(s.history[0]?.level??s.levelIndex,s.history[0]?.duration??(s.bonus?settings.roundSeconds:s.activeDuration),'online',circuitId,!!s.circuitSeed);}
 const newAudioEpoch=s.epoch!==roundEpoch;if(newAudioEpoch){players=Array.from({length:s.players.length},(_,i)=>newPlayer(i));levelIndex=s.levelIndex;circuitSeed=s.circuitSeed;penalty=new Set(s.penalty);loadRound(s.bonus,s.activeDuration);roundEpoch=s.epoch;$('menu').hidden=true;$('hud').hidden=false;$('onlineDialog').close();$('loading').hidden=true;predictionHistory=[];}
 const me=localPlayer(),aim={yaw:me.yaw,pitch:me.pitch,panX:me.panX,panY:me.panY,cameraDistance:me.cameraDistance};
 for(const data of s.players){const p=players[data.id],clean=unpackPlayer(data);if(p.id===online.slot){const oldX=p.x,oldY=p.y,oldVy=p.vy,oldZ=p.z,oldRespawn=p.respawn,entry=predictionHistory.find(h=>h.seq===s.acks?.[p.id]);if(clean.hp<p.hp&&clean.respawn<=0&&!paused&&!hostPaused)gameAudio.pain();Object.assign(p,clean);if(entry&&oldRespawn<=0&&p.respawn<=0&&s.intro<=0&&!s.paused){const tx=p.x+(oldX-entry.x),tz=p.z+(oldZ-entry.z),error=Math.hypot(tx-oldX,tz-oldZ);if(error<2&&!blocked(tx,tz,.42,map.walls)){p.x=oldX+(tx-oldX)*.45;p.z=oldZ+(tz-oldZ)*.45;if(Number.isFinite(entry.y)&&Math.abs(clean.y+(oldY-entry.y)-oldY)<.8){p.y=Math.max(0,clean.y+oldY-entry.y);p.vy=clean.vy+oldVy-entry.vy;}}}Object.assign(p,aim);predictionHistory=predictionHistory.filter(h=>h.seq>=(s.acks?.[p.id]??0));}else{const distance=Math.hypot(p.x-clean.x,p.z-clean.z);p.networkTarget={x:clean.x,y:clean.y,z:clean.z,yaw:clean.yaw};if(distance<4&&p.respawn<=0&&clean.respawn<=0){clean.x=p.x;clean.y=p.y;clean.z=p.z;clean.yaw=p.yaw;}Object.assign(p,clean);}}
 shots=s.shots.map(p=>({...p}));s.targets.forEach((t,i)=>{if(targets[i]){Object.assign(targets[i],t);targets[i].mesh.visible=targets[i].ring.visible=t.hp>0;targets[i].mesh.scale?.setScalar(t.hp>0&&t.hp<80?.9:1);}});s.pickups.forEach(t=>{const p=pickups.find(p=>p.id===t.id);if(p){p.collected=t.collected;p.respawn=t.respawn;if(p.kind==='weapon'){Object.assign(p,{weapon:t.weapon,x:t.x,z:t.z,ammo:t.ammo,phase:t.phase,holder:t.holder});syncWeaponItem(p);}else p.mesh.visible=!t.collected;}});
 circuitHistory=s.history;recordPlayerRound();time=s.time;remaining=s.remaining;activeDuration=s.activeDuration;introRemaining=s.intro;hostPaused=s.paused;lastGuestStateTime=performance.now();const previousState=state;state=s.state;receiveAudioEvents(s.audioEvents,newAudioEpoch);
 if(bonus)world.checkpoints.forEach((c,i)=>{const open=!players[levelIndex%players.length].checks[i];c.visible=open;if(c.userData?.crate)c.userData.crate.visible=open;});if(!bonus&&currentLevel().mode==='capture'){const pos=zonePosition();world.zone.position.set(pos.x,.03,pos.z);}
 if(state==='results'&&previousState!=='results'&&!paused&&!hostPaused){gameAudio.effect('win');if(s.result?.commentary)gameAudio.speak(s.result.commentary,{force:true,role:'commentary'});}
 if(state==='results'&&s.result){resultData=s.result;recordPlayerRound();releaseMouse();$('pauseDialog').close();$('resultTag').textContent=s.result.tag;$('resultTitle').textContent=s.result.title;$('resultText').textContent=s.result.text;$('nextRound').textContent='WAITING FOR HOST';$('nextRound').disabled=true;$('resultsTable').innerHTML=players.map(p=>`<div class="result-row"><span style="color:${hex[p.id]}">${escapeHTML(p.name)}</span><b>${escapeHTML(s.result.rows?.find(r=>r.id===p.id)?.value??'')} <small>· ${p.total} circuit pts · ${Math.floor(p.points)} score</small></b></div>`).join('');if(previousState!=='results'||!$('resultDialog').open)dialog('resultDialog');}
 updateHUD();updatePlayabilityHUD();
 }}catch(e){showStartError('Could not load the online arena. '+e.message);}finally{applyingSnapshot=false;$('loading').hidden=true;}}
function guestFrame(dt){readInputs(dt);const p=localPlayer(),stale=performance.now()-lastGuestStateTime>1500;
 if(paused||hostPaused||stale||introRemaining>0){inputs[0]={x:0,z:0,fire:false,catch:false,dodge:false,jump:false,crouch:false};}else{let steps=dt;while(steps>0){const d=Math.min(STEP,steps);if(p.respawn<=0){p.dashTime=Math.max(0,p.dashTime-d);p.dashCD=Math.max(0,p.dashCD-d);if(inputs[0].dodge&&!guestPriorDodge&&p.dashCD<=0){const l=Math.hypot(inputs[0].x,inputs[0].z);p.dashX=l>.1?inputs[0].x/l:Math.sin(p.yaw);p.dashZ=l>.1?inputs[0].z/l:-Math.cos(p.yaw);p.dashTime=.16;p.dashCD=p.runner?2.6:2;}updateStance(p,inputs[0].crouch,[...map.walls,...map.platforms]);if(inputs[0].jump&&!guestPriorJump)jump(p);guestPriorJump=inputs[0].jump;movePlayer(p,inputs[0],d,map,p.runner?8.5:6);}steps-=d;}time+=dt;remaining=Math.max(0,remaining-dt);}
 if(inputs[0].resetCamera&&!guestPriorReset)resetView(p);guestPriorReset=inputs[0].resetCamera;guestPriorDodge=inputs[0].dodge;
 for(const q of players)if(q.id!==p.id&&q.networkTarget){const k=1-Math.exp(-15*dt);q.x+=(q.networkTarget.x-q.x)*k;q.y+=(q.networkTarget.y-q.y)*k;q.z+=(q.networkTarget.z-q.z)*k;q.yaw+=Math.atan2(Math.sin(q.networkTarget.yaw-q.yaw),Math.cos(q.networkTarget.yaw-q.yaw))*k;}
 if(!hostPaused&&!stale){for(const q of players){q.shotAnim=Math.max(0,q.shotAnim-dt);q.catchTime=Math.max(0,q.catchTime-dt);}}
 if(!hostPaused&&!stale)for(const s of shots){s.x+=s.vx*dt;s.z+=s.vz*dt;s.y+=s.vy*dt;s.age+=dt;}
 $('networkHud').hidden=false;if(hostPaused)$('networkHud').textContent='Host paused the match';else if(stale)$('networkHud').textContent='Waiting for the host…';
 updatePlayabilityHUD();world.updatePlayers(players,time,dt);world.syncProjectiles(shots);world.viewSettings=settings;world.render([p],false,dt);listenToWorld();if(time-lastUI>.08||time<lastUI){updateHUD();lastUI=time;}}
let guestPriorJump=false,guestPriorDodge=false,guestPriorReset=false,guestFireHeld=false;
function updatePlayabilityHUD(){if(!map||!players.length)return;$('roundIntro').hidden=introRemaining<=0;
 $('damageFlash').style.opacity=Math.max(0,damageFlashUntil-performance.now())/260*.5;hudText('introTitle',bonus?'The Great Spud Escape':currentLevel().name);hudText('introMode',bonus?'BONUS HUNT':MODES[currentLevel().mode]);hudText('introDetail',bonus?'Runner: stand on each crate long enough to secure it, then reach the exit. Each grab lights you up for six seconds. Hunters: race for the one shared gun, and close in — you get a run of speed for the last fourteen seconds.':currentLevel().detail);hudText('introCount',Math.ceil(introRemaining));$('hitFeedback').hidden=performance.now()>hitUntil;
 const p=localPlayer();if(!bonus&&isTrial(currentLevel()))world.markTrail?.(p);let goal,label='';if(bonus){if(p.runner){const index=p.checks.findIndex(c=>!c);goal=index<0?map.exit:world.checkpoints[index].position;label=index<0?'EXIT':'CHECKPOINT';}else{goal=players[runnerId];label='POTATOMAN';}}else if(isTrial(currentLevel())){const trial=currentLevel().mode;goal=trial==='assault'||trial==='climb'?(map.course[p.courseStep]??map.exit):map.exit;label=trial==='assault'&&p.courseStep<map.course.length?(map.course[p.courseStep].duck?'DUCK GATE ':'PLATFORM ')+(p.courseStep+1):trial==='climb'&&p.courseStep<map.course.length?`STEP ${p.courseStep+1}/${map.course.length} · ${Math.round(p.y??0)}m`:'EXIT';}else if(currentLevel().mode==='capture'){goal=zonePosition();const inside=players.filter(p=>p.respawn<=0&&Math.hypot(p.x-goal.x,p.z-goal.z)<3);label=inside.length>1?'CONTESTED':'CROP ZONE';if(levelIndex>=6)label+=` · MOVES IN ${45-Math.floor(time%45)}s`;}
 $('navigationHud').hidden=!goal;if(goal){const angle=Math.atan2(goal.x-p.x,-(goal.z-p.z))-p.yaw;$('objectiveArrow').style.transform=`rotate(${angle}rad)`;hudText('objectiveDistance',`${label} · ${Math.round(Math.hypot(goal.x-p.x,goal.z-p.z))}m`);}
}
function allPads(){try{return Array.from(navigator.getGamepads?.()??[]).filter(p=>p?.connected);}catch{return[];}}
let controllerSignature='',testingPad=null;
function openControllers(){releaseMouse();controllerSignature='';dialog('controllerDialog');scanControllers();}
$('controllerButton').onclick=openControllers;$('controllerSettings').onclick=openControllers;
function scanControllers(){const pads=allPads(),signature=pads.map(p=>p.index+':'+p.id+':'+p.mapping).join('|')+'|'+padAssignments.join(',');if(signature===controllerSignature)return;controllerSignature=signature;$('controllerDevices').innerHTML=pads.length?pads.map(p=>`<div class="controller-device"><div><strong>${/dualsense|054c.*0ce6|wireless controller/i.test(p.id)?'PS5 / PlayStation controller':escapeHTML(p.id.slice(0,65))}</strong><small>${p.mapping==='standard'?'Connected · standard layout':'Detected · this browser has no standard layout for this controller'}</small></div>${p.mapping==='standard'?`<select data-controller="${p.index}" aria-label="Assign controller ${p.index+1}"><option value="auto">Choose player</option><option value="0" ${padAssignments[0]===p.index?'selected':''}>Player 1 / Online player</option><option value="1" ${padAssignments[1]===p.index?'selected':''}>Player 2 · local PvP</option></select>`:''}</div>`).join(''):'<p class="muted">Waiting for a controller. Connect it, then press Cross (×) or another button.</p>';}
$('controllerDevices').onchange=e=>{if(e.target.dataset.controller===undefined||e.target.value==='auto')return;const slot=+e.target.value,id=+e.target.dataset.controller;padAssignments[slot]=id;if(padAssignments[1-slot]===id)padAssignments[1-slot]=null;manualPadAssignment=true;testingPad=id;controllerSignature='';scanControllers();};
function controllerFeedback(){if(!$('controllerDialog').open)return;scanControllers();const pads=allPads().filter(p=>p.mapping==='standard'),p=pads.find(p=>p.index===testingPad)??pads.find(p=>p.buttons.some(b=>b.pressed)||p.axes.some(a=>Math.abs(a)>.2))??pads[0];if(!p){$('leftStickMeter').value=$('rightStickMeter').value=0;$('controllerFeedback').textContent='No controller input. Connect a controller and press a button.';return;}$('leftStickMeter').value=Math.min(1,Math.hypot(p.axes[0]??0,p.axes[1]??0));$('rightStickMeter').value=Math.min(1,Math.hypot(p.axes[2]??0,p.axes[3]??0));const pressed=p.buttons.map((b,i)=>b.pressed?i:-1).filter(i=>i>=0);$('controllerFeedback').textContent=pressed.length?`Controller ${p.index+1} · receiving buttons: `+pressed.map(i=>PAD_BUTTONS.find(([n])=>n===i)?.[1]??(i===9?'Options / Menu':i)).join(', '):`Controller ${p.index+1} connected. Move a stick or press a button to test.`;}
const invited=new URLSearchParams(location.hash.slice(1)).get('room');if(invited&&/^[A-Z2-9]{10}$/i.test(invited)){$('joinCode').value=invited.toUpperCase();openOnline();}

let frames=0,frameTime=0,padScanTime=0,qualityTicks=0;
function runFrame(now){requestAnimationFrame(frame);syncAudio();networkFrame(now);controllerFeedback();let delta=(now-last)/1000;last=now;frames++;frameTime+=delta;padScanTime+=delta;if(frameTime>1){const fps=Math.round(frames/frameTime);$('fps').textContent=fps+' FPS';if(state==='playing'&&!paused&&++qualityTicks%3===0)world?.balanceResolution?.(fps);frames=0;frameTime=0;}if(padScanTime>1){const pads=gamepads();$('padsInfo').textContent=pads.length?`${pads.length} controller${pads.length>1?'s':''} connected. ${duo&&pads.length===1?'Controller → Player 2; keyboard → Player 1.':'Controllers are assigned in connection order.'}`:'No standard controller detected. Connect it to your device, then press a button.';padScanTime=0;}
 if(state==='playing'&&paused&&(!online||online.isHost)){const held=gamepads().some(p=>p.buttons[9]?.pressed);if(held&&!padPause&&!$('settingsDialog').open)resume();padPause=held;return;}
 if(state!=='playing'||(paused&&(!online||online.isHost))||!world)return;
 // Bound foreground catch-up; slow frames must never open a pause dialog or trap the player.
 delta=Math.max(0,Math.min(delta,STEP*8));mouseCamera.update(delta);if(online&&!online.isHost){guestFrame(Math.min(delta,.05));return;}acc=Math.min(acc+delta,STEP*8);while(acc>=STEP&&state==='playing'&&!paused){tick(STEP);roundTick++;acc-=STEP;}
 updatePlayabilityHUD();world.updatePlayers(players,time,delta);world.syncProjectiles(shots);world.viewSettings=settings;world.render(online?[localPlayer()]:players,duo,delta);listenToWorld();
 if(time-lastUI>.08||time<lastUI){updateHUD();lastUI=time;}
}
function frame(now){try{runFrame(now);}catch(e){showStartError('The game encountered a problem. Retry the level to recover. '+e.message);}}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(state==='playing')showStartError('The graphics connection was interrupted. Retry the level to rebuild the arena.');});
initializeProfiles(p=>{$('onlineName').value=p.name;});
renderSettings();
requestAnimationFrame(frame);addEventListener('resize',()=>world?.resize());
