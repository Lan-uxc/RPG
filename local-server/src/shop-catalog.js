export const SHOP_ITEMS=[
  {key:"body_training_1",name:"基礎身體強化",type:"attribute",tier:1,cost:100,description:"永久提高生命上限 10 點。",requires:[],effect:{maxHp:10}},
  {key:"calm_mind_1",name:"精神穩定訓練",type:"attribute",tier:1,cost:100,description:"永久提高 SAN 上限 10 點。",requires:[],effect:{maxSan:10}},
  {key:"danger_sense",name:"危機感知",type:"skill",tier:1,cost:180,description:"對明顯伏擊與危險環境更敏銳。",requires:[],effect:{skill:"danger_sense"}},
  {key:"trace_reader",name:"痕跡判讀",type:"skill",tier:1,cost:220,description:"調查現場時更容易理解足跡、破壞與殘留物。",requires:[],effect:{skill:"trace_reader"}},
  {key:"field_armor",name:"輕型防護背心",type:"equipment",tier:1,cost:160,description:"永久擁有，可在進入副本時選擇攜帶。",requires:[],effect:{equipment:"field_armor",slot:"body",damageReduction:3}},
  {key:"field_pack",name:"擴充行囊",type:"equipment",tier:1,cost:130,description:"永久擴充副本戰利品容量 4 格。",requires:[],effect:{bagCapacity:4}},
  {key:"utility_knife",name:"多用途戰術刀",type:"equipment",tier:1,cost:140,description:"永久擁有，可攜入副本作為工具與近身武器。",requires:[],effect:{equipment:"utility_knife",slot:"hand",combatBonus:5}},
  {key:"fate_mark_resonance",name:"命痕共鳴・初階",type:"bloodline",tier:2,cost:500,description:"建立對命痕現象的初步感應。需完成至少 1 個副本。",requires:[{type:"completed_runs",value:1}],effect:{bloodline:"fate_mark_resonance",level:1}},
  {key:"body_training_2",name:"身體強化・第二階",type:"attribute",tier:2,cost:350,description:"在基礎強化上再永久提高生命上限 20 點。",requires:[{type:"upgrade",key:"body_training_1"},{type:"completed_runs",value:2}],effect:{maxHp:20}}
];

export function requirementsMet(item,{profile,upgrades}){
  const owned=new Set((upgrades||[]).map(x=>x.key));
  for(const r of item.requires||[]){
    if(r.type==="upgrade"&&!owned.has(r.key))return false;
    if(r.type==="completed_runs"&&Number(profile?.completed_runs||0)<Number(r.value||0))return false;
  }
  return true;
}
export function publicShopItems(){return SHOP_ITEMS.map(x=>({...x}))}
export function getShopItem(key){return SHOP_ITEMS.find(x=>x.key===key)||null}
