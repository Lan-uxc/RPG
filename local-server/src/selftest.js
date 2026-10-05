import assert from "node:assert/strict";
import { settleAction, getWorldForScenario } from "./engine.js";
import { parseAction } from "./action-parser.js";
import { tradeOps } from "./transactions.js";
import { socialConsequence, autonomousNpcTick } from "./npc-engine.js";
import { resolveCombat } from "./combat-engine.js";
import { loadScenario, listScenarios } from "./scenario-loader.js";
import { discloseNpcInformation } from "./npc-disclosure.js";
import { resolveEnemyCombat } from "./enemy-engine.js";
import { evaluateSettlement } from "./settlement.js";
import { searchLoot, useConsumable } from "./loot-engine.js";

function run(overrides={}) {
  return {
    id:"test",scenario_id:"town_origin",turn:0,world_time:"08:10",location:"town_edge",status:"active",
    state:{hp:100,san:100,reward:0,facts:[],flags:{},visited:["town_edge"]},
    inventory:[
      {key:"phone",name:"手機",quantity:1,meta:{}},
      {key:"wallet",name:"錢包",quantity:1,meta:{cash:1200}}
    ],
    npcs:[],
    threads:[{key:"market_anomaly",title:"老市場屋頂的暗色紋路",status:"active",progress:0,state:{}}],
    ...overrides
  };
}

{
  const sc=loadScenario("town_origin");
  assert.equal(sc.start.location,"town_edge");
  assert.equal(getWorldForScenario("town_origin").old_market.name,"老市場");
  const harbor=loadScenario("harbor_trial");
  assert.equal(harbor.start.location,"harbor_gate");
  assert.ok(listScenarios().some(x=>x.id==="harbor_trial"));
}

{
  const p=parseAction("我去公車站搭車前往台北");
  assert.equal(p.type,"move");
  assert.equal(p.destination,"taipei_city");
}

{
  const p=parseAction("我客氣地詢問他昨晚有沒有看到什麼");
  assert.equal(p.type,"social");
  assert.equal(p.socialTone,"friendly");
}

{
  const s=settleAction(run(),"我走去老市場");
  assert.equal(s.location,"old_market");
  assert.equal(s.time,"08:18");
}

{
  const s=settleAction(run(),"我直接去台北");
  assert.equal(s.location,"bus_station");
  assert.equal(s.outcome,"travel_progress");
}

{
  const r=run({location:"old_market",threads:[{key:"market_anomaly",title:"x",status:"active",progress:1,state:{}}]});
  const s=settleAction(r,"我爬上去深入檢查屋頂裂痕");
  assert.equal(s.threadOps.find(x=>x.key==="market_anomaly")?.status,"resolved");
}

{
  const s=settleAction(run(),"我在鎮上找工作賺錢");
  assert.equal(s.threadOps[0].key,"income_search");
}

{
  const t=tradeOps(run(),parseAction("我買一瓶礦泉水"));
  assert.equal(t.outcome,"trade_complete");
  assert.equal(t.ops.find(x=>x.type==="cash").delta,-25);
  assert.equal(t.ops.find(x=>x.type==="add").key,"water");
}

{
  const r=run({
    location:"old_market",
    npcs:[{key:"market_keeper",name:"林伯",alive:true,relation:0,state:{location:"old_market",memories:[]}}]
  });
  const ops=socialConsequence(r,parseAction("我客氣地問林伯屋頂的事情"));
  assert.equal(ops[0].relation,2);
  assert.equal(ops[0].state.memories.at(-1).tone,"friendly");
}

{
  const c=resolveCombat(run(),parseAction("我硬闖過去直接攻擊"),"我硬闖過去直接攻擊");
  assert.equal(c.outcome,"combat_costly");
  assert.ok(c.hp<100);
  assert.ok(c.san<100);
}

{
  const empowered=run({
    scenario_id:"harbor_trial",
    location:"warehouse_lane",
    state:{hp:110,maxHp:110,san:110,maxSan:110,reward:0,facts:[],flags:{},visited:["warehouse_lane"],skills:["danger_sense"],bloodlines:[]},
    enemies:[{key:"feral_dog",name:"受驚的野犬",alive:true,hp:45,location:"warehouse_lane",state:{}}]
  });
  const s=settleAction(empowered,"我直接攻擊野犬");
  assert.ok(s.state.hp>82);
  assert.ok(s.state.hp<=110);
  assert.ok(s.state.facts.some(x=>x.includes("危機感知")));
}

{
  const resonant=run({
    location:"old_market",
    state:{hp:100,maxHp:100,san:100,maxSan:100,reward:0,facts:[],flags:{},visited:["old_market"],skills:["trace_reader"],bloodlines:[{key:"fate_mark_resonance",level:1}]}
  });
  const s=settleAction(resonant,"我調查屋頂的命痕紋路");
  assert.ok(s.state.facts.some(x=>x.includes("命痕現象")));
  assert.ok(s.state.facts.some(x=>x.includes("痕跡判讀")));
}

{
  const r=run({
    scenario_id:"harbor_trial",
    location:"warehouse_lane",
    enemies:[{key:"feral_dog",name:"受驚的野犬",alive:true,hp:45,location:"warehouse_lane",state:{}}]
  });
  const e=resolveEnemyCombat(r,parseAction("我用刀砍野犬"),"我用刀砍野犬");
  assert.equal(e.enemyOps[0].hp,20);
  const r2={...r,enemies:e.enemyOps};
  const e2=resolveEnemyCombat(r2,parseAction("我再用刀砍"),"我再用刀砍");
  assert.equal(e2.enemyOps[0].alive,false);
}

{
  const r=run({
    location:"old_market",
    npcs:[{
      key:"market_keeper",name:"林伯",alive:true,relation:0,
      state:{
        location:"old_market",memories:[],goal:"守住市場",
        knowledge:["知道屋頂異常不是第一次出現","知道凌晨有人聽見金屬摩擦聲"]
      }
    }]
  });
  const d=discloseNpcInformation(r,parseAction("我問林伯屋頂異常"),"我問林伯屋頂異常");
  assert.equal(d.disclosed.length,1);
  assert.ok(d.npcOps[0].state.memories.some(x=>x.kind==="disclosed"));

  const ops=autonomousNpcTick(r,"old_market",8);
  assert.equal(ops.length,1);
  assert.ok(ops[0].state.lastAutonomousAction);
}

{
  const incomplete=run({
    threads:[{key:"market_anomaly",title:"x",status:"active",progress:50,state:{}}],
    enemies:[]
  });
  const s=evaluateSettlement(incomplete);
  assert.equal(s.complete,false);
}

{
  const complete=run({
    threads:[{key:"market_anomaly",title:"x",status:"resolved",progress:100,state:{}}],
    enemies:[]
  });
  const s=evaluateSettlement(complete);
  assert.equal(s.complete,true);
  assert.equal(s.reward,125);
}

{
  const harbor={
    ...run(),
    scenario_id:"harbor_trial",
    threads:[{key:"harbor_lockdown",title:"x",status:"resolved",progress:100,state:{}}],
    enemies:[{key:"feral_dog",name:"受驚的野犬",alive:false,hp:0,location:"warehouse_lane",state:{}}]
  };
  const s=evaluateSettlement(harbor);
  assert.equal(s.complete,true);
  assert.equal(s.reward,190);
}

{
  const closed=run({
    location:"old_market",
    threads:[{key:"market_anomaly",title:"x",status:"resolved",progress:100,state:{}}]
  });
  const s=settleAction(closed,"我再次深入調查屋頂命痕");
  assert.equal(s.threadOps.some(x=>x.key==="market_anomaly"),false);
}

{
  const base=run({
    scenario_id:"harbor_trial",location:"warehouse_lane",
    state:{hp:100,maxHp:100,san:100,maxSan:100,reward:0,facts:[],flags:{},visited:["warehouse_lane"],skills:[],bloodlines:[],equipment:[]},
    enemies:[{key:"feral_dog",name:"野犬",alive:true,hp:45,location:"warehouse_lane",state:{}}]
  });
  const armed={...base,state:{...base.state,equipment:[{key:"utility_knife",slot:"hand",combatBonus:5}]}};
  const plain=resolveEnemyCombat(base,parseAction("我用刀砍野犬"),"我用刀砍野犬");
  const boosted=resolveEnemyCombat(armed,parseAction("我用刀砍野犬"),"我用刀砍野犬");
  assert.ok(boosted.enemyOps[0].hp<plain.enemyOps[0].hp);
}

{
  const r=run({inventory:[...run().inventory,{key:"bandage",name:"簡易繃帶",quantity:1,meta:{extractable:true}}],state:{...run().state,hp:50,maxHp:100}});
  const u=useConsumable(r,"我用繃帶包紮傷口");
  assert.equal(u.used,true); assert.equal(u.state.hp,68); assert.equal(u.ops[0].type,"remove");
}

{
  const r=run({enemies:[{key:"feral_dog",name:"野犬",alive:false,hp:0,location:"town_edge",state:{}}]});
  const loot=searchLoot(r,"我搜刮野犬屍體");
  assert.equal(loot.ops[0].key,"dog_tag"); assert.equal(loot.ops[0].meta.extractable,true); assert.equal(loot.enemyOps[0].state.looted,true);
}

{
  const r=run({state:{...run().state,bagCapacity:1},inventory:[{key:"old_loot",name:"舊戰利品",quantity:1,meta:{loot:true,slots:1}}],enemies:[{key:"feral_dog",name:"野犬",alive:false,hp:0,location:"town_edge",state:{}}]});
  const loot=searchLoot(r,"搜索屍體");
  assert.equal(loot.ops.length,0); assert.equal(loot.enemyOps.length,0);
}

console.log("engine selftest: OK");
