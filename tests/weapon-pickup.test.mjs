import assert from 'node:assert/strict';
import {LEVELS,makeMap,route,isTrial,blocked} from '../dist/core.js';
import {createWeaponPickup,claimWeapon,useWeaponRound,dropWeapon,rearmWeapon,REARM_SECONDS} from '../dist/weapon-pickup.js';
import {SPECIAL_WEAPONS} from '../dist/weapons.js';
const player=id=>({id,x:0,y:0,z:0,respawn:0,runner:false,weapon:'spud',mag:12});
for(const level of LEVELS.filter(l=>!isTrial(l))){const map=makeMap(level),item=createWeaponPickup(map,level.seed);assert.equal(item.phase,'available');const starts=[[2,2],[map.n-3,map.n-3],[map.n-3,2],[2,map.n-3]].map(([x,z])=>map.toWorld(x,z));const distances=starts.map(p=>route(map,p,item).length);assert.ok(distances[0]>0);assert.equal(new Set(distances).size,1,level.name+' starts must have equal route distance to the shared weapon');}
const map=makeMap(LEVELS[0]),item=createWeaponPickup(map,2),kind=item.weapon,players=[0,1,2,3].map(player);
assert.ok(SPECIAL_WEAPONS.includes(kind),'the box always carries one of the special weapons');
players.forEach(p=>Object.assign(p,{x:item.x,z:item.z}));assert.equal(claimWeapon(item,players,2).id,2);assert.equal(claimWeapon(item,players,2),null);assert.equal(players.filter(p=>p.weapon===kind).length,1);
const holder=players[2];holder.mag=2;useWeaponRound(item,holder);const wall=map.walls[0];Object.assign(holder,{x:wall.x,z:wall.z});assert.equal(dropWeapon(item,holder,map),true);assert.equal(item.ammo,2);assert.equal(holder.weapon,'throw');assert.equal(item.phase,'available');assert.equal(blocked(item.x,item.z,.45,[...map.walls,...map.platforms]),false);
players.forEach(p=>Object.assign(p,{x:99,z:99}));Object.assign(players[1],{x:item.x,z:item.z});assert.equal(claimWeapon(item,players,0).id,1);assert.equal(players[1].mag,2);players[1].mag=0;useWeaponRound(item,players[1]);assert.equal(item.phase,'spent');assert.equal(claimWeapon(item,players,0),null);assert.equal(dropWeapon(item,players[1],map),false);
// A spent box re-arms with the next weapon along, so one round cycles the whole special roster
// instead of offering the same launcher over and over.
assert.equal(rearmWeapon(item,REARM_SECONDS-.1,0),false,'the box does not come straight back');
assert.equal(rearmWeapon(item,.2,0),true);assert.equal(item.phase,'available');
assert.deepEqual({x:item.x,z:item.z},item.home,'a re-armed box returns to its contested home');
const seen=new Set([kind,item.weapon]);
for(let wave=0;wave<SPECIAL_WEAPONS.length*2;wave++){item.phase='spent';item.respawn=0;rearmWeapon(item,REARM_SECONDS,0);seen.add(item.weapon);}
assert.equal(seen.size,SPECIAL_WEAPONS.length,'every special weapon comes round in the rotation');
const bonus=createWeaponPickup(map,0,true);Object.assign(players[0],{x:bonus.x,z:bonus.z,runner:true});players.slice(1).forEach(p=>Object.assign(p,{x:99,z:99}));assert.equal(claimWeapon(bonus,players,0,true),null);Object.assign(players[3],{x:bonus.x,z:bonus.z});assert.equal(claimWeapon(bonus,players,0,true).weapon,'masher');
console.log('PASS equal opening route distances, one tie winner, finite death transfers, clear-floor drops, spent/re-arm lifecycle cycling every special weapon, and runner exclusion');
