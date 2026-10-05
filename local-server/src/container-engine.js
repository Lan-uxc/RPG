export function searchContainer(run,scenario,input){
  if(!/搜|搜索|搜刮|翻找|打開|檢查/.test(input))return {handled:false,ops:[],state:null,facts:[]};
  const containers=(scenario.containers||[]).filter(x=>x.location===run.location);
  const flags=run.state?.containerStates||{};
  const box=containers.find(x=>!flags[x.key]?.looted && (!x.match||new RegExp(x.match).test(input)));
  if(!box)return {handled:false,ops:[],state:null,facts:[]};
  const current=(run.inventory||[]).reduce((n,x)=>n+(x.meta?.loot?Number(x.meta?.slots||1)*x.quantity:0),0);
  const needed=(box.items||[]).reduce((n,x)=>n+Number(x.slots||1)*(x.quantity||1),0);
  if(current+needed>Number(run.state?.bagCapacity||6))return {handled:true,ops:[],state:null,facts:["背包空間不足，容器內物品仍留在原處"]};
  return {
    handled:true,
    ops:(box.items||[]).map(x=>({type:"add",key:x.key,name:x.name,quantity:x.quantity||1,meta:{loot:true,extractable:true,value:x.value||0,slots:x.slots||1,containerSource:box.key}})),
    state:{...flags,[box.key]:{looted:true}},
    facts:["你搜刮了"+box.name+"，取得："+(box.items||[]).map(x=>x.name).join("、")]
  };
}

export function discardLoot(run,input){
  if(!/丟掉|丟棄|扔掉|放棄/.test(input))return {handled:false,ops:[],facts:[]};
  const item=(run.inventory||[]).find(x=>x.meta?.loot && input.includes(x.name));
  if(!item)return {handled:true,ops:[],facts:["你沒有找到要丟棄的戰利品"]};
  return {handled:true,ops:[{type:"remove",key:item.key,quantity:1}],facts:["你丟棄了"+item.name]};
}
