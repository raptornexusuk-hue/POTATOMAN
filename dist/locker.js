// Everything a player can put on their potato before a match. The ids here are what gets stored,
// what the locker screen lists and what world.js builds, so a new piece is one line here and one
// branch there. Bots wear entries from the same wardrobe, which is why BREEDS describes its four
// rivals in these terms rather than in their own.
export const WARDROBE=Object.freeze({
 head:[['none','BARE HEAD'],['cap','FLAT CAP'],['bucket','BUCKET HAT'],['beanie','BOBBLE HAT'],['tophat','TOP HAT'],['headscarf','HEADSCARF'],['goggles','WELDING GOGGLES']],
 eyes:[['none','NO EYEWEAR'],['glasses','ROUND GLASSES'],['shades','SUNGLASSES'],['minion','BANANA GOGGLES'],['visor','RACING VISOR'],['patch','EYE PATCH']],
 neck:[['none','BARE NECK'],['scarf','WOOLLY SCARF'],['bandana','BANDANA'],['tie','CLUB TIE']],
 skin:[['russet','RUSSET'],['maris','MARIS PIPER'],['rooster','ROOSTER'],['golden','GOLDEN WONDER'],['purple','PURPLE MAJESTY']]
});
export const SLOTS=Object.freeze([['head','HEADGEAR'],['eyes','EYEWEAR'],['neck','NECKWEAR'],['skin','VARIETY'],['tint','COLOUR']]);
export const SKIN_TINTS=Object.freeze({russet:0xc68b49,maris:0xe7c38e,rooster:0xa9702f,golden:0xd9a765,purple:0x8d6e93});
// One colour dresses whatever the potato is wearing, so a kit reads as an outfit rather than a pile.
export const TINTS=Object.freeze([['sun','SUNSHINE',0xe8b53a],['rust','PAPRIKA',0xc4483e],['sea','HARBOUR',0x2f6f8c],['moss','ALLOTMENT',0x3f7f4a],['plum','BEETROOT',0x7a4b9c],['slate','SLATE',0x4a5560],['coal','SOOT',0x3a3126],['bone','LINEN',0xe4dcc6]]);
export const defaultOutfit=()=>({head:'cap',eyes:'none',neck:'none',skin:'russet',tint:'sun'});
export function validateOutfit(input){const out=defaultOutfit();if(!input||typeof input!=='object')return out;
 for(const [slot]of SLOTS)if(slot!=='tint'&&WARDROBE[slot].some(([id])=>id===input[slot]))out[slot]=input[slot];
 if(TINTS.some(([id])=>id===input.tint))out.tint=input.tint;return out;}
export const tintColor=outfit=>(TINTS.find(([id])=>id===outfit?.tint)??TINTS[0])[2];
export const skinColor=outfit=>SKIN_TINTS[outfit?.skin]??SKIN_TINTS.russet;
export const pieceName=(slot,id)=>(slot==='tint'?TINTS:WARDROBE[slot]).find(([key])=>key===id)?.[1]??'—';
const KEY='potatoman.outfit.v1';
export function loadOutfit(storage){try{return validateOutfit(JSON.parse(storage?.getItem(KEY)??'null'));}catch{return defaultOutfit();}}
export function saveOutfit(outfit,storage){try{if(!storage)return false;storage.setItem(KEY,JSON.stringify(validateOutfit(outfit)));return true;}catch{return false;}}

// A flat drawing of the same kit, for the locker screen. Three.js is not loaded until a match
// starts and a spinning model is not what the screen is for: it has to answer "what am I picking"
// instantly, so the preview is an SVG built from the same ids the world builds meshes from.
const hex=value=>'#'+value.toString(16).padStart(6,'0');
// `focus` frames the drawing on the part of the potato a rack is choosing, so a hat can be shown
// large without the tile having to crop it -- cropping cut the top off the tall ones, which is the
// one thing a picture of a hat must not do.
const FOCUS={head:'26 0 148 156',eyes:'26 0 148 156',neck:'26 62 148 156'};
export function outfitPreview(input,focus){const o=validateOutfit(input),kit=hex(tintColor(o)),skin=hex(skinColor(o)),dark='#2b2016',parts=[];
 parts.push(`<ellipse cx="100" cy="112" rx="58" ry="78" fill="${skin}"/>`);
 for(const side of[-1,1]){parts.push(`<ellipse cx="${100+side*21}" cy="96" rx="13" ry="15" fill="#fff6df"/><circle cx="${100+side*21}" cy="98" r="6" fill="${dark}"/>`);}
 parts.push(`<path d="M78 138 Q100 154 122 138" stroke="${dark}" stroke-width="5" fill="none" stroke-linecap="round"/>`);
 if(o.neck==='scarf')parts.push(`<path d="M50 146 Q100 170 150 146 L150 162 Q100 186 50 162 Z" fill="${kit}"/><path d="M114 162 l11 42 l18 -6 l-11 -40 Z" fill="${kit}"/>`);
 if(o.neck==='bandana')parts.push(`<path d="M54 144 Q100 168 146 144 L128 192 L72 192 Z" fill="${kit}"/>`);
 if(o.neck==='tie')parts.push(`<path d="M92 146 l16 0 l-3 12 l9 42 l-14 12 l-14 -12 l9 -42 Z" fill="${kit}"/>`);
 if(o.eyes==='glasses')parts.push(`<g fill="none" stroke="${kit}" stroke-width="4"><circle cx="79" cy="97" r="17"/><circle cx="121" cy="97" r="17"/><path d="M96 97 h8M62 94 l-14 -6M138 94 l14 -6"/></g>`);
 if(o.eyes==='shades')parts.push(`<path d="M58 84 h36 q6 0 6 6 v10 q0 12 -12 12 h-18 q-12 0 -12 -14 Z M142 84 h-36 q-6 0 -6 6 v10 q0 12 12 12 h18 q12 0 12 -14 Z" fill="${dark}"/><path d="M94 88 h12M58 86 l-12 -6M142 86 l12 -6" stroke="${kit}" stroke-width="4" fill="none"/>`);
 if(o.eyes==='minion')parts.push(`<path d="M40 90 h120 v18 h-120 Z" fill="#2b2f33"/><g><circle cx="76" cy="99" r="27" fill="#cbd1d8"/><circle cx="124" cy="99" r="27" fill="#cbd1d8"/><circle cx="76" cy="99" r="19" fill="#d8ecf4"/><circle cx="124" cy="99" r="19" fill="#d8ecf4"/><circle cx="76" cy="99" r="8" fill="${dark}"/><circle cx="124" cy="99" r="8" fill="${dark}"/><rect x="96" y="94" width="8" height="10" fill="#cbd1d8"/></g>`);
 if(o.eyes==='visor')parts.push(`<path d="M46 82 q54 -12 108 0 v20 q-54 14 -108 0 Z" fill="${kit}" opacity=".85"/>`);
 if(o.eyes==='patch')parts.push(`<path d="M46 74 q54 -10 108 0" stroke="${dark}" stroke-width="5" fill="none"/><ellipse cx="79" cy="97" rx="18" ry="19" fill="${dark}"/>`);
 if(o.head==='cap')parts.push(`<path d="M52 66 q48 -34 96 0 Z" fill="${kit}"/><path d="M50 64 q50 10 100 0 l4 10 q-54 12 -108 0 Z" fill="${kit}"/>`);
 if(o.head==='bucket')parts.push(`<path d="M60 62 q40 -30 80 0 l0 6 l-80 0 Z" fill="${kit}"/><path d="M40 66 q60 20 120 0 l0 12 q-60 22 -120 0 Z" fill="${kit}"/>`);
 if(o.head==='beanie')parts.push(`<path d="M54 68 q46 -42 92 0 Z" fill="${kit}"/><rect x="52" y="62" width="96" height="14" rx="7" fill="${kit}"/><circle cx="100" cy="24" r="12" fill="${kit}"/>`);
 if(o.head==='tophat')parts.push(`<rect x="72" y="4" width="56" height="58" fill="${kit}"/><rect x="44" y="58" width="112" height="12" rx="6" fill="${kit}"/>`);
 if(o.head==='headscarf')parts.push(`<path d="M50 70 q50 -40 100 0 q-50 16 -100 0 Z" fill="${kit}"/><path d="M148 66 l22 12 l-6 12 l-20 -16 Z" fill="${kit}"/>`);
 if(o.head==='goggles')parts.push(`<path d="M46 64 q54 -14 108 0 v12 q-54 -12 -108 0 Z" fill="${dark}"/><circle cx="76" cy="64" r="15" fill="${kit}"/><circle cx="124" cy="64" r="15" fill="${kit}"/>`);
 return `<svg viewBox="${FOCUS[focus]??'0 0 200 220'}" role="img" aria-label="Your potato">${parts.join('')}</svg>`;
}
