import { threatsResolved } from "./threat-engine.js";
import { loadScenario } from "./scenario-loader.js";

export function evaluateSettlement(run){
  const scenario=loadScenario(run.scenario_id);
  const required=scenario.completion?.requiredThreads||[];
  const resolved=required.every(key=>run.threads.some(t=>t.key===key && t.status==="resolved"));
  const enemiesCleared=(run.enemies||[]).every(e=>!e.alive);
  const threatsHandled=threatsResolved(run,scenario);
  const mode=scenario.completion?.mode||"all_threads_resolved";

  let complete=false;
  if(mode==="all_threads_resolved") complete=resolved;
  if(mode==="all_threads_resolved_and_enemies_cleared") complete=resolved && enemiesCleared;
  if(mode==="all_threads_resolved_and_threats_handled") complete=resolved && threatsHandled;

  const survived=(run.state?.hp??0)>0;
  const base=Number(scenario.rewards?.base||0);
  const survival=survived?Number(scenario.rewards?.survivalBonus||0):0;

  return {
    complete,
    survived,
    reward:complete?base+survival:0,
    scenarioId:scenario.id,
    scenarioName:scenario.name,
    resolvedRequired:resolved,
    enemiesCleared,
    threatsHandled
  };
}
