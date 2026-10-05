function hasItem(run,key){
  return (run.inventory||[]).some(x=>x.key===key && x.quantity>0);
}

export function resolveCombat(run,intent,input){
  if(intent.type!=="combat") return null;
  const nextHp=Number(run.state?.hp??100);
  const nextSan=Number(run.state?.san??100);
  const facts=[];
  const inventoryOps=[];
  let hpDelta=0,sanDelta=0,outcome="combat_exchange";

  const armed=/槍|刀|棍|武器/.test(input) || hasItem(run,"weapon");
  const reckless=/硬闖|正面|直接衝|不閃|拼命/.test(input);
  const careful=/掩體|躲|閃|觀察|防守|保持距離/.test(input);

  if(reckless){
    hpDelta=-18;
    sanDelta=-4;
    outcome="combat_costly";
    facts.push("玩家在高風險交戰中受傷");
  }else if(careful){
    hpDelta=-4;
    sanDelta=-2;
    outcome="combat_controlled";
    facts.push("玩家利用地形與防備降低了交戰代價");
  }else{
    hpDelta=armed?-7:-11;
    sanDelta=-3;
    outcome="combat_exchange";
    facts.push("交戰造成了實際體力與精神消耗");
  }

  const hp=Math.max(0,nextHp+hpDelta);
  const san=Math.max(0,nextSan+sanDelta);
  if(hp===0) outcome="incapacitated";

  return {
    hp,san,hpDelta,sanDelta,outcome,facts,inventoryOps,
    consequence:{incapacitated:hp===0}
  };
}
