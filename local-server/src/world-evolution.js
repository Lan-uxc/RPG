function hour(hhmm){return Number(String(hhmm||"00:00").split(":")[0])||0}
function terminal(t){return ["resolved","failed","abandoned"].includes(t?.status)}

export function evolveWorld(run,scenario,{elapsedMinutes=5,location=run.location}={}){
  const state=structuredClone(run.state||{});
  const world={...(state.world||{})};
  world.elapsedMinutes=Number(world.elapsedMinutes||0)+Math.max(0,elapsedMinutes);
  world.day=Math.floor(world.elapsedMinutes/1440)+1;
  world.phase=hour(run.world_time)>=18||hour(run.world_time)<6?"night":"day";
  const events=[...(world.events||[])];
  const threadOps=[];
  for(const rule of scenario.worldEvolution||[]){
    const already=events.some(e=>e.key===rule.key);
    const dueTurn=(run.turn||0)+1>=Number(rule.afterTurn||Infinity);
    const dueMinutes=world.elapsedMinutes>=Number(rule.afterMinutes||Infinity);
    const thread=(run.threads||[]).find(t=>t.key===rule.thread);
    const condition=!rule.threadStatus||thread?.status===rule.threadStatus;
    if(!already&&(dueTurn||dueMinutes)&&condition){
      events.push({key:rule.key,turn:(run.turn||0)+1,fact:rule.fact,place:rule.place||null});
      if(rule.fact&&!state.facts?.includes(rule.fact))state.facts=[...(state.facts||[]),rule.fact].slice(-100);
      if(rule.thread&&!terminal(thread)&&rule.progress){
        threadOps.push({...thread,progress:Math.min(99,Math.max(Number(thread.progress||0),Number(rule.progress))),state:{...(thread.state||{}),worldPressure:rule.key}});
      }
    }
  }
  world.events=events.slice(-40); state.world=world;
  return {state,threadOps,events:events.slice(-(scenario.worldEvolution||[]).length)};
}

function routeStep(places,from,to){
  if(!from||!to||from===to)return from;
  if(places[from]?.routes?.[to]!=null)return to;
  const q=[from],prev=new Map([[from,null]]);
  while(q.length){const x=q.shift();for(const n of Object.keys(places[x]?.routes||{})){if(prev.has(n))continue;prev.set(n,x);if(n===to){let p=to;while(prev.get(p)!==from&&prev.get(p)!=null)p=prev.get(p);return p}q.push(n)}}
  return from;
}

export function evolveNpcs(run,scenario,{elapsedMinutes=5,playerLocation=run.location}={}){
  if(elapsedMinutes<5)return [];
  const places=scenario.places||{},ops=[];
  for(const n of run.npcs||[]){
    if(!n.alive)continue;
    const state=structuredClone(n.state||{}),mem=[...(state.memories||[])];
    state.ageMinutes=Number(state.ageMinutes||0)+elapsedMinutes;
    let target=state.location,reason="依照自己的目標繼續行動";
    const schedule=state.schedule||[];
    const h=hour(run.world_time);
    const slot=schedule.find(x=>h>=Number(x.from??0)&&h<Number(x.to??24));
    if(slot?.location){target=slot.location;reason=slot.activity||reason}
    const active=(run.threads||[]).find(t=>t.status==="active");
    if(state.reactToActiveThread&&active&&state.threadLocation)target=state.threadLocation;
    if(target&&target!==state.location)state.location=routeStep(places,state.location,target);
    if(playerLocation===state.location)state.playerSeenTurn=(run.turn||0)+1;
    const last=mem[mem.length-1];
    const note=state.location!==n.state?.location?`${n.name}前往${places[state.location]?.name||state.location}：${reason}`:`${n.name}：${reason}`;
    if(last?.note!==note)mem.push({kind:"autonomous",turn:(run.turn||0)+1,note,location:state.location});
    state.lastAutonomousAction=note;
    state.memories=mem.slice(-40);
    ops.push({...n,state});
  }
  return ops;
}
