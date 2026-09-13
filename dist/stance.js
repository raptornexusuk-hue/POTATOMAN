export const STANDING_HEIGHT=2.15,CROUCH_HEIGHT=1.62;
export const bodyScale=p=>p.runner?1.18:1;
export const bodyHeight=p=>(p.crouching?CROUCH_HEIGHT:STANDING_HEIGHT)*bodyScale(p);
export const eyeHeight=p=>(p.crouching?1.25:1.63)*bodyScale(p);
export const muzzleHeight=p=>(p.crouching?1.08:1.32)*bodyScale(p);
export function hasHeadroom(p,solids,height=STANDING_HEIGHT*bodyScale(p)){
 return !solids.some(w=>(p.y??0)<(w.base??0)+w.h-.025&&(p.y??0)+height>(w.base??0)+.025&&Math.abs(p.x-w.x)<w.w/2+.41&&Math.abs(p.z-w.z)<w.d/2+.41);
}
export function updateStance(p,held,solids){const before=!!p.crouching;p.crouching=!!held||(before&&!hasHeadroom(p,solids));return before!==p.crouching;}
