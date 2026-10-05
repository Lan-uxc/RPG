export const LOOT_CATALOG={
  dog_tag:{name:"刻痕金屬牌",value:45,slots:1,extractable:true},
  anomaly_fragment:{name:"命痕碎片",value:120,slots:2,extractable:true},
  bandage:{name:"簡易繃帶",value:15,slots:1,extractable:true,consumable:{hp:18}},
  calming_tablet:{name:"鎮定片",value:25,slots:1,extractable:true,consumable:{san:15}}
};

export function usedSlots(run){return (run.inventory||[]).reduce((n,x)=>n+(x.meta?.loot?Number(x.meta?.slots||1)*x.quantity:0),0)}
export function capacity(run){return Number(run.state?.bagCapacity||6)}
export function searchLoot(run,input){
  if(!/搜|搜索|搜刮|翻找|檢查屍體|戰利品/.test(input))return {handled:false,ops:[],enemyOps:[],facts:[]};
  const corpse=(run.enemies||[]).find(e=>!e.alive&&e.location===run.location&&!e.state?.looted);
  if(!corpse){const corpseIntent=/屍體|敵人|野犬|戰利品/.test(input);return corpseIntent?{handled:true,ops:[],enemyOps:[],facts:["附近沒有尚未搜刮的敵對目標"]}:{handled:false,ops:[],enemyOps:[],facts:[]};}
  const def=corpse.key==="feral_dog"?LOOT_CATALOG.dog_tag:null;
  if(!def)return {handled:true,ops:[],enemyOps:[{...corpse,state:{...corpse.state,looted:true}}],facts:["你完成搜索，但沒有找到值得帶走的物品"]};
  if(usedSlots(run)+def.slots>capacity(run))return {handled:true,ops:[],enemyOps:[],facts:["背包沒有足夠空間，戰利品仍留在原處"]};
  return {handled:true,ops:[{type:"add",key:"dog_tag",name:def.name,quantity:1,meta:{loot:true,extractable:true,value:def.value,slots:def.slots,lootSource:corpse.key}}],enemyOps:[{...corpse,state:{...corpse.state,looted:true}}],facts:["你搜刮到："+def.name]};
}

export function useConsumable(run,input){
  const inventory=run.inventory||[];
  for(const [key,item] of Object.entries(LOOT_CATALOG).filter(([,v])=>v.consumable)){
    const owned=inventory.find(x=>x.key===key&&x.quantity>0); if(!owned)continue;
    if((key==="bandage"&&/繃帶|包紮|止血/.test(input))||(key==="calming_tablet"&&/鎮定|藥片|服藥/.test(input))){
      const hp=Math.min(run.state?.maxHp??100,(run.state?.hp??100)+Number(item.consumable.hp||0));
      const san=Math.min(run.state?.maxSan??100,(run.state?.san??100)+Number(item.consumable.san||0));
      return {used:true,state:{hp,san},ops:[{type:"remove",key,quantity:1}],fact:"你使用了"+item.name};
    }
  }
  return {used:false,state:{},ops:[],fact:null};
}
