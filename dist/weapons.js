export const THROW_DURATION=.46,THROW_WINDUP=.12;
// `gun` means a flat, fast, tight-tolerance round; everything else is lobbed. `drop` scales the
// lob against THROW_DROP and defaults from `gun`, so a launcher can arc far harder than a thrown
// spud without a second gravity constant appearing anywhere. `life` is the fuse or burn-out age,
// `blast`/`blastDamage` the explosion, and `pierce` lets a round carry on through a body. `carry`
// names how the weapon is held; `reach` below is how far it is sighted.
export const WEAPONS={
 throw:{name:'HAND-THROWN SPUDS',speed:23,damage:34,cooldown:.62,pellets:1,spread:0,ammo:0,gun:false,color:0xe4be7d,tier:0,blurb:'Lobbed by hand. Always with you.'},
 spud:{name:'SPUD GUN',speed:32,damage:40,cooldown:.34,pellets:1,spread:0,ammo:0,gun:false,color:0xe4be7d,tier:1,blurb:'Faster and flatter than a throw, and it never runs out.'},
 repeater:{name:'CHIPPER AUTO',speed:30,damage:28,cooldown:.22,pellets:1,spread:0,ammo:40,gun:false,color:0x72e5cd,tier:2,blurb:'Deep magazine, light damage. Hold the trigger.'},
 scatter:{name:'TRIPLE MASH',speed:26,damage:35,cooldown:.8,pellets:3,spread:.095,ammo:12,gun:false,color:0xb794ff,tier:2,blurb:'Three spuds a shot. Devastating up close.'},
 masher:{name:'THE MASHER',speed:62,damage:12,cooldown:.16,pellets:1,spread:0,ammo:12,gun:true,color:0x91c9f8,tier:2,blurb:'Flat, fast chips. Rewards tracking.'},
 // Shoulder-mounted, and what used to be a flat rocket and a high-arc mortar. They overlapped so
 // heavily that carrying one meant never wanting the other, so the mortar's job -- clearing what is
 // behind cover -- is done here by the blast rather than by the arc. It is deliberately dead flat:
 // a lobbed shell is solved to pass through the crosshair at whatever range the sight found, which
 // sends it sailing over the head of anything standing a few metres away, and a weapon whose every
 // shell is supposed to be fatal cannot miss the target in front of it. Five shells, each one lethal
 // on a direct hit and lethal again to anything within a couple of metres of where it lands.
 rpg:{name:'SPUD BAZOOKA',speed:30,damage:220,cooldown:1.5,pellets:1,spread:0,ammo:5,gun:true,color:0xff8a4a,tier:2,blast:5.2,blastDamage:150,barrel:'wide',carry:'shoulder',blurb:'Shoulder-mounted. Five shells, and every one of them is fatal.'},
 // Long, flat and punishing: a single well-led shot carries through the first body it finds.
 peeler:{name:'THE PEELER',speed:96,damage:92,cooldown:1.15,pellets:1,spread:0,ammo:5,gun:true,color:0xd8e4ec,tier:2,pierce:1,barrel:'long',blurb:'Precision rifle. Punches clean through the first spud it hits.'},
 // Hot oil, which burns out rather than carrying, so `life` is what sets its reach and the sight
 // stops at the end of it. It used to be sighted sixty metres out like every other gun while the
 // oil died at seven, so the jets were still fanning outward when they expired and nothing ever
 // arrived where the crosshair was. Now they converge on it, and they hurt when they land.
 fryer:{name:'CHIP FRYER',speed:20,damage:13,cooldown:.14,pellets:3,spread:.042,ammo:48,gun:true,color:0xffc04a,tier:2,life:.58,barrel:'wide',blurb:'A jet of scalding oil. Lethal in a doorway, useless across a street.'},
 // Lobbed, sticks nothing, but the fuse runs whether or not it hits.
 sticky:{name:'STICKY SPUD',speed:19,damage:26,cooldown:1,pellets:1,spread:0,ammo:4,gun:false,color:0x8fe36b,tier:2,drop:1.35,life:1.25,blast:4.2,blastDamage:105,barrel:'stubby',blurb:'Fused bomb on a high lob. Bank it round a corner.'}
};
export const dropFactor=w=>w.drop??(w.gun?0:1);
// How far a weapon is sighted. A round that burns out can only be aimed as far as it travels, so a
// short-lived one converges on the crosshair instead of being pointed at something it never reaches.
export const weaponReach=(w,long,short)=>w.life?Math.min(w.gun?long:short,w.speed*w.life):w.gun?long:short;
export const SPECIAL_WEAPONS=Object.keys(WEAPONS).filter(k=>WEAPONS[k].tier===2);
export function weaponConfig(p){return WEAPONS[p.weapon]??(p.gun?WEAPONS.masher:WEAPONS.spud);}
export function equipWeapon(p,kind='spud'){const w=WEAPONS[kind]??WEAPONS.spud;p.weapon=WEAPONS[kind]?kind:'spud';p.gun=w.gun;p.mag=w.ammo||12;p.reload=0;p.throwCD=0;p.pendingThrow=0;p.shotAnim=0;}
export function weaponPadKind(pad,wave,seed){return SPECIAL_WEAPONS[(pad+wave+seed%SPECIAL_WEAPONS.length)%SPECIAL_WEAPONS.length];}
