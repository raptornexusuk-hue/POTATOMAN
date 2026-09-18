import assert from 'node:assert/strict';
import {MouseCamera} from '../dist/camera-input.js';
import {defaults} from '../dist/controls.js';
function target(){const events=new Map();return{addEventListener(name,fn){events.set(name,fn);},emit(name,data={}){events.get(name)?.(data);}};}
const doc=target(),canvas=target();let active=true,p={yaw:0,pitch:0};canvas.getBoundingClientRect=()=>({left:0,top:0,right:1000,bottom:700,width:1000,height:700});doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.emit('pointerlockchange');};
const camera=new MouseCamera(canvas,{active:()=>active,player:()=>p,settings:defaults,document:doc});
canvas.emit('mousemove',{clientX:600,clientY:350});assert.equal(p.yaw,0);canvas.emit('mousemove',{clientX:620,clientY:350});assert.ok(p.yaw>0);
canvas.requestPointerLock=()=>Promise.reject(Error('denied'));camera.request();await Promise.resolve();assert.equal(camera.pending,false);canvas.emit('mousemove',{clientX:999,clientY:350});let before=p.yaw;for(let i=0;i<60;i++)camera.update(1/60);assert.ok(p.yaw-before>2,'edge turning continues after capture denial');canvas.emit('mousemove',{clientX:500,clientY:350});before=p.yaw;camera.update(1);assert.equal(p.yaw,before);
console.log('PASS no-click hover and continuous edge turning after denied capture');
canvas.requestPointerLock=()=>{doc.pointerLockElement=canvas;doc.emit('pointerlockchange');};camera.request(true);assert.equal(camera.locked,true);before=p.yaw;canvas.emit('mousemove',{movementX:20,movementY:0});assert.equal(p.yaw,before);doc.emit('mousemove',{movementX:20,movementY:0});assert.ok(Math.abs(p.yaw-before-.11)<1e-9);camera.update(1);assert.ok(Math.abs(p.yaw-before-.11)<1e-9);doc.exitPointerLock();assert.equal(active,true);
console.log('PASS canonical document mouse movement is applied once while captured; unlock retains play');
let resolve;canvas.requestPointerLock=()=>new Promise(r=>resolve=r);camera.request(true);active=false;camera.release();doc.pointerLockElement=canvas;doc.emit('pointerlockchange');resolve();await Promise.resolve();assert.equal(doc.pointerLockElement,null);assert.equal(camera.pending,false);before=p.yaw;doc.emit('mousemove',{movementX:20,movementY:0});camera.update(1);assert.equal(p.yaw,before);active=true;canvas.emit('mousemove',{clientX:900,clientY:600});assert.equal(p.yaw,before);canvas.emit('mousemove',{clientX:920,clientY:600});assert.ok(p.yaw>before);
console.log('PASS delayed lock after pause is released, and resume has no camera jump');
canvas.requestPointerLock=()=>{throw Error('unsupported');};camera.request(true);assert.equal(camera.pending,false);camera.release();

// A slow browser can grant capture after the request watchdog expires.
canvas.requestPointerLock=()=>undefined;camera.request(true);camera.lockFailed();
doc.pointerLockElement=canvas;doc.emit('pointerlockchange');assert.equal(camera.locked,true);
doc.emit('pointerlockerror');assert.equal(camera.locked,true);assert.equal(camera.wanted,true);
before=p.yaw;doc.emit('mousemove',{movementX:30,movementY:0});assert.ok(p.yaw>before);camera.release();
console.log('PASS delayed mouse capture is retained and stale errors cannot disable active panning');

// Walking into a wall has to crowd the boom in at once, or the camera ends up outside the level.
// Walking away from it has to give the view back on its own: on a tablet there is no mouse to
// nudge it loose, and "the camera never came back" was exactly the reported fault.
const {cameraPose,settleBoom,autoLevel,DEFAULT_PITCH,MIN_PITCH,MAX_PITCH,SIGHT_RANGE,CHEST_HEIGHT,REST_ZOOM}=await (async()=>{
 const aim=await import('../dist/aiming.js'),ctl=await import('../dist/controls.js');return{...aim,autoLevel:ctl.autoLevel};})();
const viewer=()=>({id:0,x:0,y:0,z:0,yaw:0,pitch:DEFAULT_PITCH,crouching:false,runner:false,cameraDistance:REST_ZOOM});
const backWall=[{x:0,z:1.6,w:9,d:.4,h:5}],step=1/60,settings={zoom:REST_ZOOM};
const v=viewer();assert.equal(settleBoom(v,settings,backWall,step),cameraPose(v,settings,backWall).fit,'cover must take the boom in on the very first frame');
assert.ok(v.boom<.5,`wall a step behind the shoulder must compress the boom, got ${v.boom}`);
assert.ok(Math.abs(cameraPose(v,settings,backWall).distance-REST_ZOOM*v.boom)<1e-12,'the rendered boom is the settled one, not the raw fit');
const compressed=v.boom;settleBoom(v,settings,[],step);
assert.ok(v.boom>compressed&&v.boom<.75,'the boom eases back out rather than snapping');
let frames=1;while(v.boom<.995&&frames<600){settleBoom(v,settings,[],step);frames++;}
assert.ok(v.boom<=1&&frames>12&&frames<90,`boom recovers smoothly in well under a second: ${frames} frames`);
// The rest pitch must sight a standing rival, not the dirt in front of one.
const sight=cameraPose(viewer(),settings,[]),at=t=>({y:sight.position.y+sight.direction.y*t});
const range=SIGHT_RANGE/Math.cos(DEFAULT_PITCH);
assert.ok(Math.abs(at(range).y-CHEST_HEIGHT)<.02,`resting sight lands on the chest at ${SIGHT_RANGE}m, not ${at(range).y.toFixed(2)}m`);
assert.ok(at(60).y>0,'the resting sight must not run into the ground inside a rifle shot');
// Auto-level is for thumbs and sticks: it waits, it only works while the player is moving, and
// any live aim input outranks it.
const walker=viewer();walker.pitch=MIN_PITCH;
for(let i=0;i<30;i++)autoLevel(walker,step,false,true);assert.equal(walker.pitch,MIN_PITCH,'a view still settling cannot be dragged off aim immediately');
for(let i=0;i<90;i++)autoLevel(walker,step,false,true);assert.ok(walker.pitch>MIN_PITCH+.1,'after the delay a moving player is walked back to level');
for(let i=0;i<600;i++)autoLevel(walker,step,false,true);assert.ok(Math.abs(walker.pitch-DEFAULT_PITCH)<.01,'and it arrives at the resting pitch');
const stander=viewer();stander.pitch=MAX_PITCH;for(let i=0;i<600;i++)autoLevel(stander,step,false,false);assert.equal(stander.pitch,MAX_PITCH,'standing still, the player keeps the view they chose');
const aimer=viewer();aimer.pitch=MAX_PITCH;for(let i=0;i<600;i++)autoLevel(aimer,step,true,true);assert.equal(aimer.pitch,MAX_PITCH,'a thumb on the aim pad always outranks the assist');
console.log('PASS boom compresses instantly and eases back, resting sight holds the chest at range, and auto-level waits for an idle stick and a moving player');
