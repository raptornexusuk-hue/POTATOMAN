// Bot-only tuning. Human movement, weapon speed and cooldowns are unchanged.
export const AI_LEVELS={
 chill:{label:'Chill',description:'A relaxed start: slower rivals, forgiving aim, no catches and long gaps between shots.',speed:.62,growth:.004,runner:.86,reaction:.85,fireInterval:1.8,gunInterval:.55,error:2.8,turn:2,catch:0,dodge:.05,hesitate:.35},
 easy:{label:'Easy',description:'A little more pressure, with slower reactions and plenty of openings.',speed:.72,growth:.006,runner:.91,reaction:.60,fireInterval:1.25,gunInterval:.38,error:1.9,turn:2.6,catch:.05,dodge:.12,hesitate:.2},
 normal:{label:'Normal',description:'Balanced rivals with quicker aim, occasional catches and steady fire.',speed:.80,growth:.012,runner:.96,reaction:.35,fireInterval:.85,gunInterval:.25,error:1,turn:3.3,catch:.15,dodge:.25,hesitate:0},
 hard:{label:'Hard',description:'Fast rivals, accurate aim and aggressive fire. Bring your best spuds.',speed:.90,growth:.010,runner:1,reaction:.18,fireInterval:.55,gunInterval:.16,error:.4,turn:4,catch:.30,dodge:.40,hesitate:0}
};
export function aiSettings(name,level=0){const a=AI_LEVELS[name]??AI_LEVELS.chill;return{...a,speed:Math.min(1,a.speed+Math.max(0,Math.min(9,level))*a.growth)};}
