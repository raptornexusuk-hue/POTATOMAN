import {equipWeapon} from './weapons.js';
// The spud gun is earned by a knockout, not by chipping away at hit counters: one mash, one gun.
export function earnedKill(p){if(p.respawn>0||p.weapon!=='throw')return false;p.weaponLevel=1;equipWeapon(p,'spud');return true;}
export function loseLoadout(p){p.weaponLevel=0;}
export function respawnLoadout(p){p.weaponLevel=0;equipWeapon(p,'throw');}
// Any three round wins across the circuit earn the crown — they no longer have to be consecutive,
// so one bad round cannot wipe out everything a player has already won.
export function awardRoundWins(players,winners){for(const p of winners)p.roundWins=(p.roundWins??0)+1;}
export function lastPlaceLine(players,trial,round){if(players.length<2)return'';const value=p=>trial?p.best:-p.score,worst=Math.max(...players.map(value)),last=players.filter(p=>value(p)===worst);if(last.length===players.length)return'';const p=last[round%last.length],name=p.name;return [`${name} threw some spuds out there today. Ha ha!`,`${name} has a nice potato bomb.`, `Spud buckets for ${name}!`,`${name} got well and truly mashed.`,`${name} is taking the scenic route to the butter.`][round%5];}
