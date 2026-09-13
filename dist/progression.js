import {equipWeapon} from './weapons.js';
export function earnedHit(p){if(p.respawn>0||p.weapon!=='throw')return false;p.weaponHits=(p.weaponHits??0)+1;if(p.weaponHits<3)return false;p.weaponLevel=1;equipWeapon(p,'spud');return true;}
export function loseLoadout(p){p.weaponLevel=0;p.weaponHits=0;}
export function respawnLoadout(p){p.weaponLevel=0;p.weaponHits=0;equipWeapon(p,'throw');}
export function awardStreaks(players,winners){for(const p of players)p.winStreak=winners.length===1&&winners[0].id===p.id?(p.winStreak??0)+1:0;}
export function lastPlaceLine(players,trial,round){if(players.length<2)return'';const value=p=>trial?p.best:-p.score,worst=Math.max(...players.map(value)),last=players.filter(p=>value(p)===worst);if(last.length===players.length)return'';const p=last[round%last.length],name=p.name;return [`${name} threw some spuds out there today. Ha ha!`,`${name} has a nice potato bomb.`, `Spud buckets for ${name}!`,`${name} got well and truly mashed.`,`${name} is taking the scenic route to the butter.`][round%5];}
