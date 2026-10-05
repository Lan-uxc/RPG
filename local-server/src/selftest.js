import assert from "node:assert/strict";
import { settleAction, getWorldForScenario } from "./engine.js";
import { parseAction } from "./action-parser.js";
import { tradeOps } from "./transactions.js";
import { socialConsequence, autonomousNpcTick } from "./npc-engine.js";
import { resolveCombat } from "./combat-engine.js";
import { loadScenario, listScenarios } from "./scenario-loader.js";
import { discloseNpcInformation } from "./npc-disclosure.js";
import { resolveEnemyCombat } from "./enemy-engine.js";

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

console.log("engine selftest: OK");
