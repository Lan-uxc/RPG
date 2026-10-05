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
  const evidence=(scenario.investigation?.evidence||[]).find(e=>!collected.has(e.key)&&matchEvidence(e,run,input));
  if(!evidence)return {handled:false,threadOps:[],facts:[],evidence:null};
  collected.add(evidence.key);
  const defs=scenario.investigation.evidence||[];
  const score=[...collected].reduce((n,k)=>n+Number(defs.find(e=>e.key===k)?.weight||1),0);
  const threshold=Number(scenario.investigation.threshold||2);
  const resolved=score>=threshold;
  return {handled:true,evidence:evidence.key,facts:[evidence.fact],threadOps:[{
    key:thread.key,title:thread.title,status:resolved?"resolved":"active",progress:resolved?100:Math.min(90,Math.round(score/threshold*100)),
    state:{...thread.state,evidence:[...collected],evidenceScore:score,lastEvidence:evidence.fact,resolution:resolved?(scenario.investigation.resolution||"已取得足夠證據"):null}
  }]};
}
