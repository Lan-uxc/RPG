export function discloseNpcInformation(run,intent,input){
  if(intent.type!=="social") return {facts:[],npcOps:[],disclosed:[]};

  const living=(run.npcs||[]).filter(n=>n.alive && n.state?.location===run.location);
  if(!living.length) return {facts:[],npcOps:[],disclosed:[]};

  const npc=living[0];
  const knowledge=[...(npc.state?.knowledge||[])];
  const already=new Set((npc.state?.memories||[]).filter(m=>m.kind==="disclosed").map(m=>m.info));
  const relation=Number(npc.relation||0);

  let max=1;
  if(relation>=20) max=2;
  if(relation>=50) max=3;
  if(intent.socialTone==="hostile" && relation<30) max=0;

  let candidates=knowledge.filter(x=>!already.has(x));
  if(/班次|台北|車/.test(input)) candidates=candidates.filter(x=>/班次|台北|車/.test(x));
  else if(/屋頂|異常|市場|凌晨|聲音/.test(input)) candidates=candidates.filter(x=>/屋頂|異常|凌晨|市場|金屬/.test(x));

  const disclosed=candidates.slice(0,max);
  if(!disclosed.length) return {facts:[],npcOps:[],disclosed:[]};

  const memories=[...(npc.state?.memories||[])];
  for(const info of disclosed) memories.push({kind:"disclosed",info});
  const updated={...npc,state:{...npc.state,memories:memories.slice(-30)}};

  return {
    facts:disclosed.map(x=>`從${npc.name}口中得知：${x}`),
    npcOps:[updated],
    disclosed
  };
}
