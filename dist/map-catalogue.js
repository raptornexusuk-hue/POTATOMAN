export const MAPS=[
 {id:'village',name:'Gouda Old Town',mood:'Warm stone · cafés · market streets',description:'A central market square, shopfronts, café terraces and cobbled lanes.',color:'#e4bb79',art:0},
 {id:'estate',name:'Royal Butter Gardens',mood:'Topiary · fountains · garden paths',description:'Formal planting, a working fountain, rose arches and an estate maze.',color:'#9ac881',art:1},
 {id:'harbour',name:'Moonlight Quays',mood:'Canals · warehouses · guarded bridges',description:'Three protected crossings, loading quays, moored boats and cargo yards.',color:'#8abccc',art:2},
 {id:'farm',name:'Golden Harvest Farm',mood:'Barns · crop rows · working farmyard',description:'Red timber barns, stacked hay, field boundaries and a harvest yard.',color:'#e2b35d',art:0}
];
export const mapId=level=>({market:'village',night:'village',hedge:'estate',garden:'estate',fort:'estate',canal:'harbour',depot:'harbour',course:'harbour',fair:'farm',corn:'farm'})[level.theme]??'village';
export const mapInfo=level=>MAPS.find(m=>m.id===mapId(level));
// Pick a seed whose opening WORLD differs from the previous circuit, even after a reload.
export function nextCircuitSeed(previous,randomSeed,levelForSeed){let seed=randomSeed%99999+1;for(let i=0;i<100;i++){if(mapId(levelForSeed(seed))!==previous)return seed;seed=seed%99999+1;}return seed;}
