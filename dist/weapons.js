export const THROW_DURATION=.46,THROW_WINDUP=.12;
// `gun` means a flat, fast, tight-tolerance round; everything else is lobbed. `drop` scales the
// lob against THROW_DROP and defaults from `gun`, so a mortar can arc far harder than a thrown
// spud without a second gravity constant appearing anywhere. `life` is the fuse or burn-out age,
// `blast`/`blastDamage` the explosion, and `pierce` lets a round carry on through a body.
export const WEAPONS={
 throw:{name:'HAND-THROWN SPUDS',speed:23,damage:34,cooldown:.62,pellets:1,spread:0,ammo:0,gun:false,color:0xe4be7d,tier:0,blurb:'Lobbed by hand. Always with you.'},
 spud:{name:'SPUD GUN',speed:32,damage:40,cooldown:.34,pellets:1,spread:0,ammo:0,gun:false,color:0xe4be7d,tier:1,blurb:'Earned with a knockout. Faster and flatter than a throw.'},
 repeater:{name:'CHIPPER AUTO',speed:30,damage:28,cooldown:.22,pellets:1,spread:0,ammo:40,gun:false,color:0x72e5cd,tier:2,blurb:'Deep magazine, light damage. Hold the trigger.'},
 scatter:{name:'TRIPLE MASH',speed:26,damage:35,cooldown:.8,pellets:3,spread:.095,ammo:12,gun:false,color:0xb794ff,tier:2,blurb:'Three spuds a shot. Devastating up close.'},
 masher:{name:'THE MASHER',speed:62,damage:12,cooldown:.16,pellets:1,spread:0,ammo:12,gun:true,color:0x91c9f8,tier:2,blurb:'Flat, fast chips. Rewards tracking.'},
 rpg:{name:'SPUD RPG',speed:22,damage:200,cooldown:1.35,pellets:1,spread:0,ammo:3,gun:true,color:0xff994f,tier:2,blast:4.5,blastDamage:80,blurb:'One rocket, one crater.'},
 // Long, flat and punishing: a single well-led shot carries through the first body it finds.
 peeler:{name:'THE PEELER',speed:96,damage:92,cooldown:1.15,pellets:1,spread:0,ammo:5,gun:true,color:0xd8e4ec,tier:2,pierce:1,barrel:'long',blurb:'Precision rifle. Punches clean through the first spud it hits.'},
 // Hot oil: a wide cone that burns out after half a second, so it only exists at knife range.
 fryer:{name:'CHIP FRYER',speed:17,damage:7,cooldown:.09,pellets:5,spread:.20,ammo:90,gun:true,color:0xffc04a,tier:2,life:.42,barrel:'wide',blurb:'A cone of scalding oil. Lethal in a doorway, useless across a street.'},
 // Lobbed, sticks nothing, but the fuse runs whether or not it hits.
 sticky:{name:'STICKY SPUD',speed:19,damage:26,cooldown:1,pellets:1,spread:0,ammo:4,gun:false,color:0x8fe36b,tier:2,drop:1.35,life:1.25,blast:4.2,blastDamage:105,barrel:'stubby',blurb:'Fused bomb on a high lob. Bank it round a corner.'},
 // Very high arc: the only weapon that reaches over a container stack or a hedge line.
 mortar:{name:'SPUD MORTAR',speed:16,damage:22,cooldown:1.6,pellets:1,spread:0,ammo:3,gun:false,color:0xff7f6b,tier:2,drop:2.4,blast:5,blastDamage:140,barrel:'wide',blurb:'Drops shells over cover. Aim high and lead hard.'}
};
export const dropFactor=w=>w.drop??(w.gun?0:1);
export const SPECIAL_WEAPONS=Object.keys(WEAPONS).filter(k=>WEAPONS[k].tier===2);
export function weaponConfig(p){return WEAPONS[p.weapon]??(p.gun?WEAPONS.masher:WEAPONS.spud);}
export function equipWeapon(p,kind='spud'){const w=WEAPONS[kind]??WEAPONS.spud;p.weapon=WEAPONS[kind]?kind:'spud';p.gun=w.gun;p.mag=w.ammo||12;p.reload=0;p.throwCD=0;p.pendingThrow=0;p.shotAnim=0;}
export function weaponPadKind(pad,wave,seed){return SPECIAL_WEAPONS[(pad+wave+seed%SPECIAL_WEAPONS.length)%SPECIAL_WEAPONS.length];}
