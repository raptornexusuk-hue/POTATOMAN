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
