import { splitActions } from "./action-parser.js";
import { settleAction } from "./engine.js";

function applyInventory(items,ops){
  const m=new Map((items||[]).map(x=>[x.key,structuredClone(x)]));
  for(const op of ops||[]){
    if(op.type==="add"){
      const old=m.get(op.key);
      if(old)old.quantity+=op.quantity||1;
      else m.set(op.key,{key:op.key,name:op.name,quantity:op.quantity||1,meta:op.meta||{}});
    }else if(op.type==="remove"){
      const old=m.get(op.key); if(!old)continue;
      old.quantity=Math.max(0,old.quantity-(op.quantity||1)); if(!old.quantity)m.delete(op.key);
    }
  }
  return [...m.values()];
}
function mergeByKey(base,ops){
  const m=new Map((base||[]).map(x=>[x.key,structuredClone(x)]));
  for(const x of ops||[])m.set(x.key,structuredClone(x));
  return [...m.values()];
}
export function settleActionSequence(run,input,max=3){
  const steps=splitActions(input,max);
  if(steps.length<=1)return {...settleAction(run,input),subActions:steps};
  let current=structuredClone(run),minutes=0,last=null;
  const inventoryOps=[],npcOps=[],enemyOps=[],threadOps=[],results=[];
  for(const text of steps){
    const s=settleAction(current,text);
    results.push({action:text,outcome:s.outcome,location:s.location,time:s.time});
    inventoryOps.push(...s.inventoryOps); npcOps.push(...s.npcOps); enemyOps.push(...s.enemyOps); threadOps.push(...s.threadOps);
    const [h1,m1]=current.world_time.split(":").map(Number),[h2,m2]=s.time.split(":").map(Number);
    minutes+=((h2*60+m2)-(h1*60+m1)+1440)%1440;
    current={...current,turn:s.turn,world_time:s.time,location:s.location,state:s.state,
      inventory:applyInventory(current.inventory,s.inventoryOps),
      npcs:mergeByKey(current.npcs,s.npcOps),enemies:mergeByKey(current.enemies,s.enemyOps),threads:mergeByKey(current.threads,s.threadOps)};
    last=s;
    if(s.runStatus==="failed"||s.outcome==="blocked")break;
  }
  return {...last,turn:run.turn+1,time:current.world_time,location:current.location,state:current.state,
    inventoryOps,npcOps,enemyOps,threadOps,subActions:results,
    summary:"玩家連續執行："+results.map(x=>x.action).join(" → ")+"；世界時間共推進 "+minutes+" 分鐘。"};
}
