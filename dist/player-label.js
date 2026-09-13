import {bodyHeight} from './stance.js';
import * as T from './assets/three.module.js';
import {boxContact3D} from './core.js';

// One cached canvas per player. Labels are camera-facing scene UI, not HTML overlays.
export class PlayerLabel {
 constructor(color){
  this.canvas=document.createElement('canvas');this.canvas.width=640;this.canvas.height=160;this.ctx=this.canvas.getContext('2d');
  this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=T.LinearFilter;
  this.material=new T.SpriteMaterial({map:this.texture,transparent:true,sizeAttenuation:false,depthTest:true,depthWrite:false,fog:false,toneMapped:false});
  this.sprite=new T.Sprite(this.material);this.sprite.center.set(.5,0);this.sprite.frustumCulled=false;this.sprite.visible=false;
  this.color='#'+color.toString(16).padStart(6,'0');this.head=new T.Vector3();this.alive=false;this.key='';
 }
 update(player,bob=0){
  const scale=player.runner?1.18:1,max=player.runner?140:100,hp=Math.max(0,Math.min(max,Number.isFinite(player.hp)?player.hp:0));
  this.alive=player.respawn<=0&&hp>0;this.sprite.visible=this.alive;this.sprite.position.set(player.x,(player.y??0)+bodyHeight(player)+bob+.12,player.z);this.head.set(player.x,(player.y??0)+bodyHeight(player)*.86+bob,player.z);
  const name=String(player.name||'SPUD'),key=JSON.stringify([name,Math.ceil(hp),max]);if(key===this.key)return;this.key=key;this.name=name;this.healthFraction=hp/max;
  const c=this.ctx;c.clearRect(0,0,640,160);
  c.fillStyle='rgba(8,22,29,0.88)';c.beginPath();c.roundRect(2,2,636,152,20);c.fill();
  c.fillStyle=this.color;c.fillRect(28,24,5,53);c.font='800 56px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';
  let text=name;while(text.length>1&&c.measureText(text+(text.length<name.length?'…':'')).width>556)text=text.slice(0,-1);if(text.length<name.length)text+='…';
  c.fillStyle='#ffffff';c.fillText(text,328,54);
  c.fillStyle='#34474e';c.beginPath();c.roundRect(28,106,584,24,8);c.fill();
  if(hp>0){c.fillStyle=this.healthFraction<=.25?'#ff6b62':this.healthFraction<=.5?'#ffce42':'#73e6ad';c.beginPath();c.roundRect(28,106,584*this.healthFraction,24,Math.min(8,292*this.healthFraction));c.fill();}
  this.texture.needsUpdate=true;
 }
 prepare(camera,viewportHeight,walls){
  // CSS pixel size is independent of distance, display pixel ratio and split-screen width.
  const unit=2/(Math.max(1,viewportHeight)*camera.projectionMatrix.elements[5]);this.sprite.scale.set(160*unit,40*unit,1);
  const a=camera.position,b=this.head;
  this.sprite.visible=this.alive&&!walls.some(w=>boxContact3D(a.x,a.y,a.z,b.x,b.y,b.z,w,0)<1);
 }
 dispose(){this.texture.dispose();this.material.dispose();}
}
