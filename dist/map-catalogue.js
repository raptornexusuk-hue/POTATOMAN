export const MAPS=[
 {id:'village',name:'Gouda Old Town',mood:'Warm stone · cafés · market streets',description:'A central market square, shopfronts, café terraces and cobbled lanes.',color:'#e4bb79',art:0},
 {id:'estate',name:'Royal Butter Gardens',mood:'Topiary · fountains · garden paths',description:'Formal planting, a working fountain, rose arches and an estate maze.',color:'#9ac881',art:1},
 {id:'harbour',name:'Moonlight Quays',mood:'Canals · warehouses · guarded bridges',description:'Three protected crossings, loading quays, moored boats and cargo yards.',color:'#8abccc',art:2},
 {id:'farm',name:'Golden Harvest Farm',mood:'Barns · crop rows · working farmyard',description:'Red timber barns, stacked hay, field boundaries and a harvest yard.',color:'#e2b35d',art:0},
 {id:'quarry',name:'Chalk Quarry',mood:'Terraces · gantries · cutting floor',description:'Stepped chalk terraces, a cutting floor, gantry crane and stacked blocks.',color:'#b9c6cf',art:2},
 {id:'orchard',name:'Cider Orchard',mood:'Fruit rows · presses · mown lanes',description:'Rows of cider apples, pressing sheds, crate stacks and long mown lanes.',color:'#93c46b',art:1},
 {id:'shipyard',name:'Klompens Container Yard',mood:'Stacked steel · no cover for long',description:'A tight freight yard walled in by shipping containers. Nowhere is safe for more than a second.',color:'#d1774b',art:2},
 {id:'coast',name:'Butterscotch Bay',mood:'Sand · groynes · beach huts',description:'Open sand between timber groynes, a row of painted huts and the tide at your back.',color:'#f0d08a',art:0},
 {id:'polder',name:'Windmill Polder',mood:'Dykes · sluices · turning sails',description:'Reclaimed flats below sea level: a working windmill, raised dykes to fight along, sluice gates and stacked peat.',color:'#a8c4a0',art:0},
 {id:'interior',name:'The Chip Factory',mood:'Indoors · fryers · loading floor',description:'Inside the works: partition walls, doorways, vats, conveyor lines and a lit ceiling overhead.',color:'#9aa7b4',art:1}
];
export const mapId=level=>({market:'village',night:'village',hedge:'estate',garden:'estate',fort:'estate',canal:'harbour',depot:'harbour',course:'harbour',fair:'farm',corn:'farm',quarry:'quarry',pit:'quarry',orchard:'orchard',grove:'orchard',polder:'polder',mill:'polder',shipment:'shipyard',gantry:'shipyard',beach:'coast',dunes:'coast',factory:'interior',cannery:'interior'})[level.theme]??'village';
export const mapInfo=level=>MAPS.find(m=>m.id===mapId(level));
// Pick a seed whose opening WORLD differs from the previous circuit, even after a reload.
export function nextCircuitSeed(previous,randomSeed,levelForSeed){let seed=randomSeed%99999+1;for(let i=0;i<100;i++){if(mapId(levelForSeed(seed))!==previous)return seed;seed=seed%99999+1;}return seed;}
