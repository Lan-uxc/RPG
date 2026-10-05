import { detectionState } from "./stealth-engine.js";
export function seedScenarioEnemies(run, scenario) {
  return (scenario.enemies||[]).map(e=>({
    key:e.key,
    name:e.name,
    alive:e.alive!==false,
    hp:e.hp??100,
    location:e.location,
    state:{...e.state}
  }));
}

export function resolveEnemyCombat(run,intent,input){
  if(intent.type!=="combat") return {enemyOps:[],facts:[],target:null};
  const living=(run.enemies||[]).filter(e=>e.alive && e.location===run.location);
  if(!living.length) return {enemyOps:[],facts:["附近沒有可交戰的敵對目標"],target:null};

  const target=living[0];
  let damage=18;
  if(/槍|射擊|開槍/.test(input)) damage=35;
  else if(/刀|砍/.test(input)) damage=25;
  else if(/拳|踢|徒手|打/.test(input)) damage=12;

  const gearBonus=(run.state?.equipment||[]).reduce((n,x)=>n+Number(x.combatBonus||0),0);
  if(gearBonus>0 && /刀|砍|攻擊|打|刺/.test(input)) damage+=gearBonus;

  const hp=Math.max(0,Number(target.hp||0)-damage);
  const alive=hp>0;
  const updated={...target,hp,alive};

  return {
    enemyOps:[updated],
    facts:[alive?`${target.name}受到傷害，仍具有威脅`:`${target.name}已失去戰鬥能力`],
    target:updated
  };
}

function nextStep(world,from,to){
  if(from===to)return from;
  const q=[[from,null]],seen=new Set([from]);
  while(q.length){
    const [node,first]=q.shift();
    for(const n of Object.keys(world[node]?.routes||{})){
      if(seen.has(n))continue;
      const step=first||n;if(n===to)return step;seen.add(n);q.push([n,step]);
    }
  }
  return null;
}
function blockedDoor(run,scenario,from,to){
  return (scenario.objects||[]).some(o=>{
    if(o.type!=="door"||!o.connects?.includes(from)||!o.connects?.includes(to))return false;
    const s={...o.initial,...run.state?.objectStates?.[o.key]};
    return s.barricaded||s.locked;
  });
}
export function autonomousEnemyTick(run,scenario){
  const ops=[],facts=[];let noise=Math.max(0,Number(run.state?.noise||0)-10);
  for(const enemy of run.enemies||[]){
    if(!enemy.alive)continue;
    let e={...enemy,state:{...enemy.state}};
    if(e.location===run.location){
      const detection=detectionState(run,scenario,e);
      e.state.detection=detection;
      if(detection==="detected"){e.state.mode="engaged";e.state.lastKnownPlayer=run.location;facts.push(e.name+"已發現你的確切位置");}
      else if(detection==="suspicious"){e.state.mode="searching";facts.push(e.name+"似乎察覺附近有異常，開始搜索");}
      else {e.state.mode="unaware";facts.push(e.name+"尚未察覺你的所在位置");}
      ops.push(e);continue;
    }
    if(Number(run.state?.noise||0)>=30){
      const step=nextStep(scenario.places,e.location,run.location);
      if(step){
        if(blockedDoor(run,scenario,e.location,step)){e.state.mode="delayed";e.state.blockedTurns=Number(e.state.blockedTurns||0)+1;facts.push(e.name+"被封堵的通路拖住");}
        else {e.location=step;e.state.mode="investigating";e.state.lastHeard=run.location;facts.push(e.name+"正朝聲響方向移動");}
        ops.push(e);
      }
    }
  }
  return {enemyOps:ops,facts,noise};
}
