export const LOOT_CATALOG={
  dog_tag:{name:"刻痕金屬牌",value:45,extractable:true},
  anomaly_fragment:{name:"命痕碎片",value:120,extractable:true},
  bandage:{name:"簡易繃帶",value:15,extractable:true,consumable:{hp:18}},
  calming_tablet:{name:"鎮定片",value:25,extractable:true,consumable:{san:15}}
};

export function lootForDefeat(run,target){
  if(!target || target.alive)return [];
  const already=(run.inventory||[]).some(x=>x.meta?.lootSource===target.key);
  if(already)return [];
  if(target.key==="feral_dog")return [{type:"add",key:"dog_tag",name:LOOT_CATALOG.dog_tag.name,quantity:1,meta:{loot:true,extractable:true,value:45,lootSource:target.key}}];
  return [];
}

export function useConsumable(run,input){
  const inventory=run.inventory||[];
  const candidates=Object.entries(LOOT_CATALOG).filter(([,v])=>v.consumable);
  for(const [key,item] of candidates){
    const owned=inventory.find(x=>x.key===key&&x.quantity>0);
    if(!owned)continue;
    if((key==="bandage" && /繃帶|包紮|止血/.test(input)) || (key==="calming_tablet" && /鎮定|藥片|服藥/.test(input))){
      const hp=Math.min(run.state?.maxHp??100,(run.state?.hp??100)+Number(item.consumable.hp||0));
      const san=Math.min(run.state?.maxSan??100,(run.state?.san??100)+Number(item.consumable.san||0));
      return {used:true,state:{hp,san},ops:[{type:"remove",key,quantity:1}],fact:"你使用了"+item.name};
    }
  }
  return {used:false,state:{},ops:[],fact:null};
}
