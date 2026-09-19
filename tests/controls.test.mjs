import assert from 'node:assert/strict';
import {REST_ZOOM} from '../dist/aiming.js';
import {defaults,loadSettings,saveSettings,validateSettings,bindKey,bindButton,cameraDrag,mouseButtonHeld,resetCamera} from '../dist/controls.js';
const s=defaults();assert.equal(s.roundSeconds,120);assert.deepEqual(s.mouse,{fire:0});
const original=s.keys[1].forward;assert.equal(bindKey(s,0,'forward',original).ok,true);assert.equal(s.keys[1].forward,'KeyW');assert.equal(s.keys[0].forward,'ArrowUp');assert.equal(bindKey(s,0,'fire','Escape').ok,false);assert.equal(bindKey(s,0,'fire','MetaLeft').ok,false);console.log('PASS cross-player key conflicts swap; system keys are reserved');
assert.equal(bindButton(s,'mouse',0,'fire',0),true);assert.equal(bindButton(s,'pad',0,'fire',1),true);assert.equal(s.pad[0].dodge,7);assert.equal(bindButton(s,'pad',0,'fire',9),false);console.log('PASS mouse fire can be bound; controller swapping reserves Menu');
let value=null;const storage={setItem(k,v){value=v;},getItem(){return value;}};s.roundSeconds=210;assert.equal(saveSettings(s,storage),true);assert.deepEqual(loadSettings(storage),s);assert.equal(saveSettings(s,{setItem(){throw Error();}}),false);assert.deepEqual(loadSettings({getItem(){return '{broken';}}),defaults());const corrupt=validateSettings({roundSeconds:NaN,keys:[{},{}],mouse:{fire:2,look:2,pan:2},pad:[{}]});assert.deepEqual(corrupt,defaults());console.log('PASS settings survive reload; malformed or unavailable storage is safe');
const p={x:3,z:4,yaw:.5,pitch:.1,panX:0,panY:0};cameraDrag(p,50,-20,'pan',defaults());assert.equal(p.x,3);assert.equal(p.z,4);assert.equal(p.yaw,.5);assert.equal(p.pitch,.1);assert.notEqual(p.panX,0);assert.notEqual(p.panY,0);cameraDrag(p,1e6,1e6,'pan',defaults());assert.equal(p.panX,-2);assert.equal(p.panY,1.2);const old=p.yaw;cameraDrag(p,20,10,'look',defaults());assert.notEqual(p.yaw,old);resetCamera(p);assert.equal(p.panX,0);assert.equal(p.panY,0);assert.equal(p.cameraDistance,REST_ZOOM);console.log('PASS camera pan does not change movement or aim; bounds/reset work');
assert.equal(mouseButtonHeld(0,3),true);assert.equal(mouseButtonHeld(2,3),true);assert.equal(mouseButtonHeld(0,2),false);assert.equal(mouseButtonHeld(1,4),true);console.log('PASS chorded mouse button masks remain independent');

const {launchVerticalSpeed,THROW_DROP}=await import('../dist/core.js');for(const drop of[0,1,1.35,2.4])for(const pitch of[-.36,0,.48])for(const speed of[16,21.6,24,62,96]){const t=10.42/speed,y=1.22+launchVerticalSpeed(speed,pitch,drop)*t-drop*THROW_DROP*t*t;assert.ok(Math.abs(y-(1.2+pitch*7))<1e-9);}console.log('PASS flat rounds, thrown spuds and high-arc shells all converge with the crosshair at every supported pitch');
const newer=validateSettings({version:3,difficulty:'hard',music:false,musicVolume:9,voice:false,voiceVolume:-2});assert.equal(newer.difficulty,'hard');assert.equal(newer.music,false);assert.equal(newer.musicVolume,1);assert.equal(newer.voice,false);assert.equal(newer.voiceVolume,0);assert.equal(validateSettings({difficulty:'impossible'}).difficulty,'chill');assert.equal(validateSettings({version:2,voice:false}).voice,true);assert.equal(defaults().roundSeconds,120);console.log('PASS validated AI/audio settings; new audio defaults migrate once, later mute choices persist');

const legacy=defaults();legacy.version=5;legacy.keys[0].jump='KeyC';legacy.keys[0].dodge='Space';legacy.mouse={};const updated=validateSettings(legacy);assert.equal(updated.keys[0].jump,'Space');assert.equal(updated.keys[0].dodge,'ShiftLeft');assert.equal(updated.mouse.fire,0);legacy.keys[0].jump='KeyV';assert.equal(validateSettings(legacy).keys[0].jump,'KeyV');assert.equal(validateSettings({...defaults(),mouse:{fire:-1}}).mouse.fire,-1);
console.log('PASS Space jump / left click defaults migrate while customised jump and mouse choices persist');

assert.equal(validateSettings({version:6,zoom:5.6}).zoom,REST_ZOOM);assert.equal(validateSettings({version:6,zoom:7}).zoom,7);

// The locker writes into the same browser storage as everything else, so a hand-edited or
// out-of-date entry has to come back as a wearable outfit rather than an unbuildable one.
{
 const L=await import('../dist/locker.js');
 const kept={};const store={setItem(k,v){kept[k]=v;},getItem(k){return kept[k]??null;}};
 assert.deepEqual(L.validateOutfit(null),L.defaultOutfit());
 assert.deepEqual(L.validateOutfit({head:'sombrero',eyes:'shades',neck:7,skin:'maris',tint:'nope'}),
  {...L.defaultOutfit(),eyes:'shades',skin:'maris'},'unknown pieces fall back one slot at a time');
 const chosen={head:'tophat',eyes:'patch',neck:'tie',skin:'purple',tint:'plum'};
 assert.equal(L.saveOutfit(chosen,store),true);assert.deepEqual(L.loadOutfit(store),chosen);
 assert.equal(L.saveOutfit(chosen,{setItem(){throw Error('full');}}),false,'a blocked store is not a crash');
 assert.deepEqual(L.loadOutfit({getItem(){return '{not json';}}),L.defaultOutfit());
 assert.deepEqual(L.loadOutfit(undefined),L.defaultOutfit());
 // Every piece the racks offer has to be a piece the world can build and the preview can draw.
 const {World}=await import('../dist/world.js');
 for(const [slot] of L.SLOTS){
  const options=slot==='tint'?L.TINTS:L.WARDROBE[slot];
  assert.ok(options.length>1,`${slot} needs something to choose between`);
  for(const [id,name] of options){
   assert.equal(L.pieceName(slot,id),name);
   const svg=L.outfitPreview({head:'none',eyes:'none',neck:'none',skin:'russet',tint:'sun',[slot]:id});
   assert.ok(svg.startsWith('<svg')&&svg.endsWith('</svg>'),`${slot}/${id} must still draw a preview`);
   if(slot!=='tint'&&slot!=='skin'&&id!=='none')assert.ok(/<(path|circle|rect|ellipse|g) /.test(svg.slice(svg.indexOf('stroke-linecap'))),`${slot}/${id} draws nothing in the preview`);
   assert.ok(typeof World.prototype[{head:'headwear',eyes:'eyewear',neck:'neckwear'}[slot]??'character']==='function');
  }
 }
 assert.equal(L.tintColor({tint:'sea'}),0x2f6f8c);assert.equal(L.tintColor({tint:'bogus'}),L.TINTS[0][2]);
 assert.equal(L.skinColor({skin:'purple'}),L.SKIN_TINTS.purple);assert.equal(L.skinColor(null),L.SKIN_TINTS.russet);
 console.log('PASS the locker stores a wearable outfit, survives a broken or blocked store, and every rack entry draws and builds');
}
