function isDark(run,scenario){
  return (scenario.objects||[]).some(o=>o.type==="light"&&o.location===run.location&&!({...o.initial,...run.state?.objectStates?.[o.key]}).on);
}
export function stealthAction(run,scenario,input){
  const stealth=/潛行|躡手躡腳|放輕腳步|慢慢走|偷偷/.test(input);
  const hide=/躲|藏|隱蔽|躲起來|躲在/.test(input);
  if(!stealth&&!hide)return {handled:false,state:{},facts:[]};
  const dark=isDark(run,scenario);
  const cover=(scenario.objects||[]).some(o=>o.type==="cover"&&o.location===run.location&&({...o.initial,...run.state?.objectStates?.[o.key]}).cover);
  const concealment=(dark?2:0)+(cover?2:0)+(stealth?2:0)+(hide?2:0);
  return {handled:true,state:{stealth:{active:true,hidden:hide,concealment,lastLocation:run.location}},facts:[hide?"你壓低身形尋找遮蔽":"你開始刻意控制腳步與動作聲"]};
}
export function detectionState(run,scenario,enemy){
  const stealth=run.state?.stealth||{};
  const noise=Number(run.state?.noise||0);
  const perception=Number(enemy.state?.perception||3);
  const concealment=stealth.active?Number(stealth.concealment||0):0;
  const exposure=(isDark(run,scenario)?0:3)+(noise>=30?3:noise>=10?1:0)+(stealth.lastLocation===run.location?0:2);
  const margin=perception+exposure-concealment;
  return margin>=4?"detected":margin>=1?"suspicious":"unaware";
}
export function breakStealth(state,reason){
  return {...state,stealth:{...(state.stealth||{}),active:false,hidden:false,brokenBy:reason}};
}
