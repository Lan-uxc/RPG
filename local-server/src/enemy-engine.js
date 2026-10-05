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
