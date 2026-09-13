import {cameraDrag} from './controls.js';

// MouseEvent movement is the Pointer Lock API's portable input path. Hover and
// edge turning remain available when a browser cannot capture the pointer.
export class MouseCamera {
 constructor(canvas,{active,player,settings,document:doc=globalThis.document}){
  Object.assign(this,{canvas,active,player,settings,doc});this.seeded=false;this.hover=false;this.pending=false;this.wanted=false;this.retryAfter=0;this.serial=0;
  canvas.addEventListener('mouseenter',e=>this.seed(e));
  canvas.addEventListener('mouseleave',()=>this.reset());
  canvas.addEventListener('mousemove',e=>{if(!this.locked)this.move(e,false);});
  doc.addEventListener('mousemove',e=>{if(this.locked)this.move(e,true);});
  doc.addEventListener('pointerlockchange',()=>this.lockChanged());
  doc.addEventListener('pointerlockerror',()=>this.lockFailed());
 }
 get locked(){return this.doc.pointerLockElement===this.canvas;}
 seed(e){this.x=e.clientX;this.y=e.clientY;this.seeded=true;this.hover=true;}
 reset(){this.seeded=false;this.hover=false;}
 move(e,locked){if(!this.active()||e.sourceCapabilities?.firesTouchEvents){this.reset();return;}
  const dx=locked?(Number.isFinite(e.movementX)?e.movementX:0):this.seeded?e.clientX-this.x:0;
  const dy=locked?(Number.isFinite(e.movementY)?e.movementY:0):this.seeded?e.clientY-this.y:0;
  this.seed(e);const settings=this.settings();cameraDrag(this.player(),dx,dy,'look',{...settings,sensitivity:settings.panSensitivity});
 }
 update(dt){if(!this.active()){this.reset();return;}if(this.locked||!this.hover||!this.seeded)return;
  const b=this.canvas.getBoundingClientRect(),margin=Math.min(32,b.width/8,b.height/8);
  const edge=(v,min,max)=>v<min+margin?-Math.min(1,(min+margin-v)/margin):v>max-margin?Math.min(1,(v-max+margin)/margin):0;
  const x=edge(this.x,b.left,b.right),y=edge(this.y,b.top,b.bottom);if(!x&&!y)return;
  const settings=this.settings();cameraDrag(this.player(),x*400*dt,y*260*dt,'look',{...settings,sensitivity:settings.panSensitivity});
 }
 request(force=false){if(!this.active()||this.locked||this.pending||!this.canvas.requestPointerLock||(!force&&performance.now()<this.retryAfter))return;
  this.pending=true;this.wanted=true;const serial=++this.serial;
  this.timeout=setTimeout(()=>{if(this.serial===serial&&this.pending)this.lockFailed();},2000);
  try{const promise=this.canvas.requestPointerLock();promise?.then?.(()=>{if(this.serial===serial)this.lockChanged();},()=>{if(this.serial===serial)this.lockFailed();});}catch{this.lockFailed();}
 }
 lockFailed(){if(this.locked&&this.active()){clearTimeout(this.timeout);this.pending=false;return;}clearTimeout(this.timeout);this.pending=false;this.retryAfter=performance.now()+3000;}
 lockChanged(){if(this.locked){if(!this.wanted||!this.active()){this.release();return;}clearTimeout(this.timeout);this.pending=false;this.reset();}
  else{clearTimeout(this.timeout);this.pending=false;this.wanted=false;this.retryAfter=performance.now()+800;this.reset();}
 }
 release(){++this.serial;clearTimeout(this.timeout);this.pending=false;this.wanted=false;this.reset();if(this.locked)try{this.doc.exitPointerLock?.();}catch{}}
}
