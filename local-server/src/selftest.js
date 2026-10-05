import assert from "node:assert/strict";
import { settleAction, getWorldForScenario } from "./engine.js";
import { parseAction, splitActions } from "./action-parser.js";
import { settleActionSequence } from "./action-sequence.js";
import { tradeOps } from "./transactions.js";
import { socialConsequence, autonomousNpcTick } from "./npc-engine.js";
import { resolveCombat } from "./combat-engine.js";
import { loadScenario, listScenarios } from "./scenario-loader.js";
import { discloseNpcInformation } from "./npc-disclosure.js";
import { resolveEnemyCombat, autonomousEnemyTick } from "./enemy-engine.js";
import { evaluateSettlement } from "./settlement.js";
import { searchLoot, useConsumable } from "./loot-engine.js";
import { searchContainer, discardLoot } from "./container-engine.js";
import { interactEnvironment, movementBlockedByEnvironment, environmentEffects } from "./environment-engine.js";
import { stealthAction, detectionState } from "./stealth-engine.js";
import { resolveThreatByAction, threatsResolved } from "./threat-engine.js";
import { investigateEvidence } from "./investigation-engine.js";

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

{
  const sc=loadScenario("harbor_trial");
  const r=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,bagCapacity:6,containerStates:{}}});
  const found=searchContainer(r,sc,"我打開牆邊急救箱");
  assert.equal(found.handled,true); assert.equal(found.ops[0].key,"bandage"); assert.equal(found.state.warehouse_medkit.looted,true);
  const again=searchContainer({...r,state:{...r.state,containerStates:found.state}},sc,"我再打開牆邊急救箱");
  assert.equal(again.handled,false);
}

{
  const r=run({inventory:[...run().inventory,{key:"anomaly_fragment",name:"命痕碎片",quantity:1,meta:{loot:true,slots:2}}]});
  const d=discardLoot(r,"我丟棄命痕碎片");
  assert.equal(d.handled,true); assert.equal(d.ops[0].type,"remove");
}

{
  const parts=splitActions("我走進舊倉庫，然後打開急救箱，接著用繃帶包紮，最後休息");
  assert.deepEqual(parts,["我走進舊倉庫","打開急救箱","用繃帶包紮"]);
}

{
  const r=run({scenario_id:"harbor_trial",location:"warehouse_lane",world_time:"21:40",
    state:{...run().state,hp:50,maxHp:100,bagCapacity:6,containerStates:{},visited:["warehouse_lane"]},
    enemies:[],threads:[{key:"harbor_lockdown",title:"x",status:"active",progress:0,state:{}}]});
  const s=settleActionSequence(r,"我走進舊倉庫，然後打開急救箱，接著用繃帶包紮");
  assert.equal(s.location,"old_warehouse");
  assert.equal(s.subActions.length,3);
  assert.equal(s.state.hp,68);
  assert.ok(s.inventoryOps.some(x=>x.type==="add"&&x.key==="bandage"));
  assert.ok(s.inventoryOps.some(x=>x.type==="remove"&&x.key==="bandage"));
}

{
  const sc=loadScenario("harbor_trial");
  const r=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,objectStates:{},visited:["old_warehouse"]}});
  const shut=interactEnvironment(r,sc,"我關上鐵門");
  assert.equal(shut.state.warehouse_door.open,false);
  const locked=interactEnvironment({...r,state:{...r.state,objectStates:shut.state}},sc,"我鎖門");
  assert.equal(locked.state.warehouse_door.locked,true);
  const outside={...r,location:"warehouse_lane",state:{...r.state,objectStates:locked.state}};
  assert.equal(movementBlockedByEnvironment(outside,sc,"old_warehouse"),"舊倉庫鐵門");
  const s=settleAction(outside,"我走進舊倉庫");
  assert.equal(s.location,"warehouse_lane"); assert.equal(s.outcome,"blocked");
}

{
  const sc=loadScenario("harbor_trial");
  const r=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,objectStates:{}}});
  assert.equal(interactEnvironment(r,sc,"我打破側窗").state.warehouse_window.broken,true);
  assert.equal(interactEnvironment(r,sc,"我開燈").state.warehouse_light.on,true);
  assert.equal(interactEnvironment(r,sc,"我搬木箱堵住入口").state.cargo_crate.cover,true);
}

{
  const sc=loadScenario("harbor_trial");
  const base=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,hp:100,objectStates:{cargo_crate:{moved:true,cover:true},warehouse_light:{on:false}}},enemies:[{key:"raider",name:"測試敵人",alive:true,hp:100,location:"old_warehouse",state:{}}]});
  assert.equal(environmentEffects(base,sc).coverReduction,6);
  assert.equal(environmentEffects(base,sc).dark,true);
  const fight=settleAction(base,"我攻擊測試敵人");
  assert.ok(fight.state.hp>=95);
  const inspect=settleAction({...base,enemies:[]},"我調查地上的痕跡");
  assert.ok(inspect.state.facts.includes("黑暗限制了你能確認的細節"));
}

{
  const r=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,noise:0,objectStates:{}}});
  const s=settleAction(r,"我打破側窗");
  assert.equal(s.state.noise,30);
  assert.ok(s.state.facts.includes("破裂聲在倉庫區傳開"));
}

{
  const sc=loadScenario("harbor_trial");
  const noisy=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,noise:40,objectStates:{}},enemies:[{key:"feral_dog",name:"野犬",alive:true,hp:45,location:"warehouse_lane",state:{}}]});
  const tick=autonomousEnemyTick(noisy,sc);
  assert.equal(tick.enemyOps[0].location,"old_warehouse");
  assert.equal(tick.enemyOps[0].state.mode,"investigating");
  assert.equal(tick.noise,30);
}

{
  const sc=loadScenario("harbor_trial");
  const blocked=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,noise:40,objectStates:{warehouse_door:{open:false,locked:false,barricaded:true}}},enemies:[{key:"feral_dog",name:"野犬",alive:true,hp:45,location:"warehouse_lane",state:{}}]});
  const tick=autonomousEnemyTick(blocked,sc);
  assert.equal(tick.enemyOps[0].location,"warehouse_lane");
  assert.equal(tick.enemyOps[0].state.mode,"delayed");
}

{
  const sc=loadScenario("harbor_trial");
  const dark=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,noise:0,objectStates:{warehouse_light:{on:false}}},enemies:[{key:"feral_dog",name:"野犬",alive:true,hp:45,location:"old_warehouse",state:{}}]});
  const tick=autonomousEnemyTick(dark,sc);
  assert.equal(tick.enemyOps[0].state.mode,"engaged");
}

{
  const sc=loadScenario("harbor_trial");
  const base=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,noise:0,objectStates:{warehouse_light:{on:false},cargo_crate:{moved:true,cover:true}}}});
  const stealth=stealthAction(base,sc,"我躲在木箱後面放輕動作");
  const hidden={...base,state:{...base.state,...stealth.state}};
  const enemy={key:"feral_dog",name:"野犬",alive:true,hp:45,location:"old_warehouse",state:{perception:4}};
  assert.equal(detectionState(hidden,sc,enemy),"unaware");
  const loud={...hidden,state:{...hidden.state,noise:40}};
  assert.equal(detectionState(loud,sc,enemy),"suspicious");
}

{
  const r=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,noise:0,objectStates:{warehouse_light:{on:false},cargo_crate:{moved:true,cover:true}}},enemies:[{key:"feral_dog",name:"野犬",alive:true,hp:45,location:"old_warehouse",state:{perception:4}}]});
  const s=settleAction(r,"我躲在木箱後面");
  assert.equal(s.state.stealth.active,true);
  assert.equal(s.enemyOps[0].state.mode,"unaware");
}

{
  const sc=loadScenario("harbor_trial");
  const enemy={key:"feral_dog",name:"野犬",alive:true,hp:45,location:"old_warehouse",state:{perception:4,detection:"unaware"}};
  const hidden=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,stealth:{active:true,hidden:true}},enemies:[enemy]});
  const bypass=resolveThreatByAction(hidden,"我不驚動牠，繞過野犬繼續前進");
  assert.equal(bypass.enemyOps[0].state.threatResolution,"bypassed");
  assert.equal(threatsResolved({...hidden,enemies:bypass.enemyOps},sc),true);
}

{
  const harbor={...run(),scenario_id:"harbor_trial",threads:[{key:"harbor_lockdown",title:"x",status:"resolved",progress:100,state:{}}],
    enemies:[{key:"feral_dog",name:"野犬",alive:true,hp:45,location:"old_warehouse",state:{threatResolution:"bypassed"}}]};
  const s=evaluateSettlement(harbor);
  assert.equal(s.complete,true); assert.equal(s.enemiesCleared,false); assert.equal(s.threatsHandled,true); assert.equal(s.reward,190);
}

{
  const harbor={...run(),scenario_id:"harbor_trial",threads:[{key:"harbor_lockdown",title:"x",status:"resolved",progress:100,state:{}}],
    enemies:[{key:"feral_dog",name:"野犬",alive:true,hp:45,location:"warehouse_lane",state:{mode:"delayed",blockedTurns:1}}],
    state:{...run().state,objectStates:{warehouse_door:{open:false,barricaded:true}}}};
  assert.equal(evaluateSettlement(harbor).complete,true);
}

{
  const sc=loadScenario("harbor_trial");
  const base=run({scenario_id:"harbor_trial",location:"harbor_gate",threads:[{key:"harbor_lockdown",title:"harbor",status:"active",progress:0,state:{}}]});
  const first=investigateEvidence(base,sc,"檢查封鎖公告");
  assert.equal(first.evidence,"gate_notice");
  const repeat=investigateEvidence({...base,threads:first.threadOps},sc,"再次檢查封鎖公告");
  assert.equal(repeat.handled,false);
  const second=investigateEvidence({...base,location:"old_warehouse",threads:first.threadOps},sc,"調查倉庫地面痕跡");
  assert.equal(second.evidence,"warehouse_tracks");
  assert.equal(second.threadOps[0].status,"resolved");
}

{
  const r=run({scenario_id:"harbor_trial",location:"old_warehouse",state:{...run().state,bagCapacity:6,containerStates:{}},enemies:[]});
  const s=settleAction(r,"我搜索生鏽置物櫃");
  assert.ok(s.inventoryOps.some(x=>x.key==="anomaly_fragment"));
}

{
  const r=run({inventory:[{key:"wallet",name:"錢包",quantity:1,meta:{cash:30}}]});
  const s=settleActionSequence(r,"我買一瓶礦泉水，然後再買一瓶礦泉水");
  const cash=s.inventoryOps.filter(x=>x.type==="cash").reduce((n,x)=>n+x.delta,0);
  assert.equal(cash,-25);
}

{
  const sc=loadScenario("harbor_trial");
  const r=run({scenario_id:"harbor_trial",location:"harbor_gate",threads:[{key:"harbor_lockdown",title:"港區封鎖原因",status:"active",progress:0,state:{}}],
    npcs:[{key:"dock_guard",name:"港區警衛",alive:true,relation:0,state:{location:"harbor_gate",evidence:[{key:"guard_testimony",match:"封鎖|昨晚|原因",weight:1,fact:"警衛口供"}]}}]});
  const e=investigateEvidence(r,sc,"我詢問警衛昨晚封鎖原因");
  assert.equal(e.evidence,"guard_testimony");
}

console.log("engine selftest: OK");
