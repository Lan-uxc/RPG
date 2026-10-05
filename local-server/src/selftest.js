import assert from "node:assert/strict";
import { settleAction } from "./engine.js";

function run(overrides={}) {
  return {
    id:"test", turn:0, world_time:"08:10", location:"town_edge", status:"active",
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
  assert.equal(s.threadOps[0].status,"resolved");
}

{
  const s=settleAction(run(),"我在鎮上找工作賺錢");
  assert.equal(s.threadOps[0].key,"income_search");
}

console.log("engine selftest: OK");
