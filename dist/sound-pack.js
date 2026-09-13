export const MUSIC_TRACKS={arena:'arena-funk.mp3',hunt:'hunt-electro.mp3'};
export const SAMPLE_NAMES=['step-wood-a','step-wood-b','step-grass-a','step-grass-b','punch-heavy-a','punch-heavy-b','wood-heavy','wood-plank','metal-heavy','bell','metal-pot','metal-click','cloth-a','cloth-b','whoosh-a','whoosh-b','splash-a','splash-b','slime-a','slime-b','water-loop'];
// Each cue is a short mix of recorded foley, with subtle pitch variation at playback.
// Format: sample, level, playback rate, delay in seconds.
export function soundRecipe(type,alternate=0){const foot=alternate%2?'b':'a';return({
 boost_run:[['whoosh-a',.8,.9],['cloth-a',.6,1.1],['step-wood-a',.55,1,.06],['step-wood-b',.45,1.12,.14],['bell',.18,1.3,.1]],
 boost_fire:[['metal-pot',.4,.75],['metal-click',.75,1],['metal-click',.5,1.25,.08],['metal-click',.45,1.5,.14],['whoosh-b',.5,1.2,.08]],
 boost_jump:[['slime-a',.75,.8],['whoosh-b',.65,.85,.06],['bell',.25,1.55,.18]],
 weaponPickup:[['metal-click',.85,1],['wood-plank',.35,.9,.035],['bell',.16,.85,.1]],
 weaponDrop:[['metal-heavy',.65,.9],['wood-heavy',.35,1.1,.035]],
 shot_throw:[['cloth-a',.55,1.15],['whoosh-a',.7,1.05]],
 shot_spud:[['wood-plank',.55,1.15],['punch-heavy-a',.72,.85],['whoosh-a',.35,1.4,.02]],
 shot_repeater:[['metal-click',.55,1.2],['punch-heavy-b',.75,1.35],['wood-plank',.25,1.65]],
 shot_scatter:[['wood-heavy',.7,.7],['punch-heavy-a',.85,.68],['metal-heavy',.35,1.1,.025]],
 shot_masher:[['metal-heavy',.45,1.25],['punch-heavy-b',.8,1.05],['metal-click',.4,1.6,.04]],
 shot_rpg:[['wood-heavy',.8,.65],['whoosh-b',.9,.55],['metal-pot',.35,.65,.035]],
 explosion:[['wood-heavy',.85,.42],['punch-heavy-a',.95,.45],['metal-heavy',.65,.50,.04],['splash-b',.45,.55,.09],['wood-plank',.5,.75,.18]],
 step:[['step-wood-'+foot,.72,.95],['cloth-'+foot,.12,1]],
 land:[['step-wood-a',.7,.82],['step-wood-b',.55,.9,.035],['cloth-b',.3,.85]],
 jump:[['step-wood-b',.45,1.05],['cloth-a',.6,1.1],['whoosh-a',.22,1.3]],
 dash:[['whoosh-'+foot,.85,.95],['cloth-b',.45,1.15]],
 catch:[['slime-a',.65,1.1],['punch-heavy-b',.45,.95],['cloth-a',.25,1.1]],
 crouch:[['cloth-'+foot,.45,.85],['step-grass-a',.15,1]],
 hit:[['punch-heavy-'+foot,.8,.85],['slime-b',.6,.9]],
 impact:[['wood-plank',.45,.95],['slime-a',.35,1.1]],
 duckGate:[['cloth-b',.4,1.1],['bell',.24,1.15,.04]],
 checkpoint:[['bell',.28,1],['metal-click',.35,1.2],['bell',.20,1.5,.13]],
 pickup:[['slime-a',.40,1.1],['bell',.24,1.25]],
 win:[['bell',.32,1],['bell',.26,1.25,.18],['bell',.25,1.5,.36],['whoosh-b',.4,.9]],
 })[type]??[];}
