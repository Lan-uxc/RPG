function matchEvidence(e,run,input){
  if(e.location && e.location!==run.location)return false;
  if(e.match && !new RegExp(e.match).test(input))return false;
  if(e.requiresItem && !(run.inventory||[]).some(x=>x.key===e.requiresItem&&x.quantity>0))return false;
  return true;
}
export function investigateEvidence(run,scenario,input){
  const thread=(run.threads||[]).find(t=>t.key===scenario.investigation?.thread);
  if(!thread||["resolved","failed","abandoned"].includes(thread.status))return {handled:false,threadOps:[],facts:[],evidence:null};
  const collected=new Set(thread.state?.evidence||[]);
  const npcEvidence=(run.npcs||[]).filter(n=>n.alive&&n.state?.location===run.location).flatMap(n=>(n.state?.evidence||[]).map(e=>({...e,sourceNpc:n.name,location:run.location})));
  const defs=[...(scenario.investigation?.evidence||[]),...npcEvidence];
  const candidates=defs.filter(e=>!collected.has(e.key)&&matchEvidence(e,run,input));
  const score=e=>(e.sourceNpc&&/問|詢問|交談|請教|警衛|口供/.test(input)?100:0)+(/監視|監控|畫面|攝影/.test(input)&&/camera|監視/.test(e.key+e.fact)?80:0)+(/文件|清單|貨單|紀錄/.test(input)&&/manifest|清單|文件|貨運/.test(e.key+e.fact)?80:0)+Number(e.weight||1);
  const evidence=candidates.sort((a,b)=>score(b)-score(a))[0];
  if(!evidence)return {handled:false,threadOps:[],facts:[],evidence:null};
  collected.add(evidence.key);
  const score=[...collected].reduce((n,k)=>n+Number(defs.find(e=>e.key===k)?.weight||1),0);
  const threshold=Number(scenario.investigation.threshold||2);
  const resolved=score>=threshold;
  return {handled:true,evidence:evidence.key,facts:[evidence.sourceNpc?`從${evidence.sourceNpc}取得可交叉驗證的口供：${evidence.fact}`:evidence.fact],threadOps:[{
    key:thread.key,title:thread.title,status:resolved?"resolved":"active",progress:resolved?100:Math.min(90,Math.round(score/threshold*100)),
    state:{...thread.state,evidence:[...collected],evidenceScore:score,lastEvidence:evidence.fact,resolution:resolved?(scenario.investigation.resolution||"已取得足夠證據"):null}
  }]};
}
