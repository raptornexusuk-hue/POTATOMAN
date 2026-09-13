export const THROW_DURATION=.46,THROW_WINDUP=.12;
export const WEAPONS={
 throw:{name:'HAND-THROWN SPUDS',speed:23,damage:34,cooldown:.62,pellets:1,spread:0,ammo:0,gun:false,color:0xe4be7d},
 spud:{name:'SPUD GUN',speed:32,damage:40,cooldown:.34,pellets:1,spread:0,ammo:0,gun:false,color:0xe4be7d},
 repeater:{name:'CHIPPER AUTO',speed:30,damage:28,cooldown:.22,pellets:1,spread:0,ammo:40,gun:false,color:0x72e5cd},
 scatter:{name:'TRIPLE MASH',speed:26,damage:35,cooldown:.8,pellets:3,spread:.095,ammo:12,gun:false,color:0xb794ff},
 masher:{name:'THE MASHER',speed:62,damage:12,cooldown:.16,pellets:1,spread:0,ammo:12,gun:true,color:0x91c9f8},
 rpg:{name:'SPUD RPG',speed:22,damage:200,cooldown:1.35,pellets:1,spread:0,ammo:3,gun:true,color:0xff994f}
};
export function weaponConfig(p){return WEAPONS[p.weapon]??(p.gun?WEAPONS.masher:WEAPONS.spud);}
export function equipWeapon(p,kind='spud'){const w=WEAPONS[kind]??WEAPONS.spud;p.weapon=WEAPONS[kind]?kind:'spud';p.gun=w.gun;p.mag=w.ammo||12;p.reload=0;p.throwCD=0;p.pendingThrow=0;p.shotAnim=0;}
export function weaponPadKind(pad,wave,seed){return ['repeater','scatter','rpg'][(pad+wave+seed%3)%3];}
