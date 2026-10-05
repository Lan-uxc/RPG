export const SHOP_ITEMS=[
  {key:"body_training_1",name:"基礎身體強化",type:"attribute",cost:100,description:"永久提高生命上限 10 點。",effect:{maxHp:10}},
  {key:"calm_mind_1",name:"精神穩定訓練",type:"attribute",cost:100,description:"永久提高 SAN 上限 10 點。",effect:{maxSan:10}},
  {key:"danger_sense",name:"危機感知",type:"skill",cost:180,description:"對明顯伏擊與危險環境更敏銳。",effect:{skill:"danger_sense"}},
  {key:"trace_reader",name:"痕跡判讀",type:"skill",cost:220,description:"調查現場時更容易理解足跡、破壞與殘留物。",effect:{skill:"trace_reader"}},
  {key:"fate_mark_resonance",name:"命痕共鳴・初階",type:"bloodline",cost:500,description:"建立對命痕現象的初步感應，但不保證理解或控制。",effect:{bloodline:"fate_mark_resonance",level:1}}
];

export function publicShopItems(){
  return SHOP_ITEMS.map(x=>({...x}));
}
export function getShopItem(key){
  return SHOP_ITEMS.find(x=>x.key===key)||null;
}
