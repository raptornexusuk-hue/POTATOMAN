import {WEAPONS,equipWeapon,weaponPadKind} from './weapons.js';
// A spent box comes back carrying the next weapon in the rotation rather than the same one all
// round, so a single match cycles through the whole special roster.
export const REARM_SECONDS=14;
import {blocked} from './core.js';
export function createWeaponPickup(map,seed,bonus=false){const wave=0,weapon=bonus?'masher':weaponPadKind(0,wave,seed),center=map.toWorld(Math.floor(map.n/2),Math.floor(map.n/2));return{...center,id:6,kind:'weapon',owner:-1,weapon,wave,home:{x:center.x,z:center.z},ammo:WEAPONS[weapon].ammo,phase:'available',holder:-1,collected:false,respawn:0};}
export function claimWeapon(item,players,seed,bonus=false){if(item.phase!=='available')return null;const contenders=players.filter(p=>p.respawn<=0&&(!bonus||!p.runner)&&p.y<1.4&&Math.hypot(p.x-item.x,p.z-item.z)<1).sort((a,b)=>Math.hypot(a.x-item.x,a.z-item.z)-Math.hypot(b.x-item.x,b.z-item.z)||((a.id-seed%players.length+players.length)%players.length)-((b.id-seed%players.length+players.length)%players.length));const p=contenders[0];if(!p)return null;equipWeapon(p,item.weapon);p.weaponLevel=2;p.mag=item.ammo;item.phase='held';item.holder=p.id;item.collected=true;return p;}
export function useWeaponRound(item,p){if(!item||item.phase!=='held'||item.holder!==p.id)return;item.ammo=p.mag;if(item.ammo<=0){item.phase='spent';item.holder=-1;item.collected=true;}}
export function dropWeapon(item,p,map){if(!item||item.phase!=='held'||item.holder!==p.id)return false;const ammo=p.mag,weapon=p.weapon;equipWeapon(p,'throw');item.holder=-1;item.ammo=Math.max(0,ammo);if(!ammo){item.phase='spent';item.collected=true;return false;}
 const solids=[...map.walls,...map.platforms],free=[];for(let z=1;z<map.n-1;z++)for(let x=1;x<map.n-1;x++){if(map.grid[z][x])continue;const at=map.toWorld(x,z);if(!blocked(at.x,at.z,.45,solids))free.push(at);}const cell=map.toCell(p.x,p.z),clear=map.grid[cell.z][cell.x]===0&&!blocked(p.x,p.z,.45,solids);const at=clear?p:free.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]??map.toWorld(Math.floor(map.n/2),Math.floor(map.n/2));Object.assign(item,{x:at.x,z:at.z,weapon,phase:'available',collected:false});return true;}
export function rearmWeapon(item,dt,seed,bonus=false){
 if(!item||item.phase!=='spent')return false;
 item.respawn=(item.respawn||REARM_SECONDS)-dt;if(item.respawn>0)return false;
 item.wave=(item.wave??0)+1;item.weapon=bonus?'masher':weaponPadKind(0,item.wave,seed);
 Object.assign(item,{...item.home,ammo:WEAPONS[item.weapon].ammo,phase:'available',holder:-1,collected:false,respawn:0});return true;
}
