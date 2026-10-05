function localObjects(scenario,location){return (scenario.objects||[]).filter(x=>x.location===location)}
export function interactEnvironment(run,scenario,input){
  const states={...(run.state?.objectStates||{})};
  const objects=localObjects(scenario,run.location);
  const target=objects.find(x=>!x.match||new RegExp(x.match).test(input));
  if(!target)return {handled:false,state:null,facts:[],blockedMove:null};
  const old={...target.initial,...states[target.key]};
  let next={...old},fact=null;
  if(target.type==="door"){
    if(/堵|擋住|封住/.test(input)){next.barricaded=true;next.open=false;fact="你把"+target.name+"堵住了"}
    else if(/上鎖|鎖門/.test(input)){if(old.open)return {handled:true,state:null,facts:["門還開著，無法直接上鎖"]};next.locked=true;fact="你鎖上了"+target.name}
    else if(/解鎖|開鎖/.test(input)){next.locked=false;fact="你解開了"+target.name}
    else if(/關門|關上/.test(input)){next.open=false;fact="你關上了"+target.name}
    else if(/開門|打開門/.test(input)){if(old.locked||old.barricaded)return {handled:true,state:null,facts:[target.name+"目前無法打開"]};next.open=true;fact="你打開了"+target.name}
  }else if(target.type==="window"&&/打破|砸破|破窗/.test(input)){next.broken=true;fact="你打破了"+target.name}
  else if(target.type==="light"){
    if(/開燈|打開燈/.test(input)){next.on=true;fact="你打開了"+target.name}
    else if(/關燈|熄燈/.test(input)){next.on=false;fact="你關掉了"+target.name}
  }else if(target.type==="cover"&&/搬|移動|堵|擋/.test(input)){next.moved=true;next.cover=true;fact="你移動"+target.name+"形成了掩體"}
  if(!fact)return {handled:false,state:null,facts:[]};
  return {handled:true,state:{...states,[target.key]:next},facts:[fact]};
}
export function movementBlockedByEnvironment(run,scenario,destination){
  for(const o of scenario.objects||[]){
    if(o.type!=="door"||!o.connects?.includes(run.location)||!o.connects?.includes(destination))continue;
    const s={...o.initial,...run.state?.objectStates?.[o.key]};
    if(s.locked||s.barricaded)return o.name;
  }
  return null;
}
