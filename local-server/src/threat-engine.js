export const TERMINAL_THREATS=new Set(["defeated","bypassed","contained","driven_off"]);
export function threatStatus(enemy){if(!enemy.alive)return "defeated";return enemy.state?.threatResolution||null}
export function resolveThreatByAction(run,input){
  const local=(run.enemies||[]).find(e=>e.alive&&e.location===run.location);
  if(!local)return {enemyOps:[],facts:[],handled:false};
  const hidden=run.state?.stealth?.active && local.state?.detection==="unaware";
  if(hidden && /繞過|避開|溜過|不驚動|繼續前進/.test(input)){
    return {handled:true,enemyOps:[{...local,state:{...local.state,threatResolution:"bypassed",mode:"unaware"}}],facts:["你在未被察覺的情況下繞過了"+local.name]};
  }
  if(/驅趕|嚇走|趕走|驅離/.test(input)){
    const can=Number(local.hp||0)<=25 || /火|巨響|強光/.test(input);
    if(can)return {handled:true,enemyOps:[{...local,state:{...local.state,threatResolution:"driven_off",mode:"fleeing"}}],facts:[local.name+"被迫退出這一帶"]};
    return {handled:true,enemyOps:[],facts:[local.name+"沒有被成功驅離"]};
  }
  return {enemyOps:[],facts:[],handled:false};
}
export function containedByWorld(enemy,run,scenario){
  if(!enemy.alive)return false;
  return (scenario.objects||[]).some(o=>{
    if(o.type!=="door"||!o.connects?.includes(enemy.location))return false;
    const s={...o.initial,...run.state?.objectStates?.[o.key]};
    return s.barricaded && enemy.state?.mode==="delayed" && Number(enemy.state?.blockedTurns||0)>=1;
  });
}
export function threatsResolved(run,scenario){
  return (run.enemies||[]).every(e=>TERMINAL_THREATS.has(threatStatus(e))||containedByWorld(e,run,scenario));
}
