export const NPC_TEMPLATES = {
  market_keeper: {
    key:"market_keeper",name:"林伯",location:"old_market",
    goal:"守住老市場生意與鄰里秩序",
    fear:"異常現象引來外人與麻煩",
    interests:["市場","附近居民","屋頂異常"],
    bottomLine:"不願讓陌生人破壞市場或傷害住戶",
    knowledge:["知道屋頂異常不是第一次出現","知道凌晨有人聽見金屬摩擦聲"],
    personality:"寡言、務實、對陌生人先觀察再信任"
  },
  station_clerk: {
    key:"station_clerk",name:"陳小姐",location:"bus_station",
    goal:"把班次與乘客服務做好",
    fear:"被捲入與工作無關的衝突",
    interests:["班次","旅客","鎮上的消息"],
    bottomLine:"不會為陌生人偽造紀錄或違規放行",
    knowledge:["知道往台北班次","知道最近有外地人詢問老市場"],
    personality:"有禮但保守，對具體問題回答清楚"
  }
};

export function ensureLocalNpcOps(run, location) {
  const existing=new Set((run.npcs||[]).map(n=>n.key));
  const ops=[];
  for(const npc of Object.values(NPC_TEMPLATES)){
    if(npc.location!==location || existing.has(npc.key) || (run.scenario_id&&run.scenario_id!=="town_origin")) continue;
    ops.push({
      key:npc.key,name:npc.name,alive:true,relation:0,
      state:{
        location:npc.location,goal:npc.goal,fear:npc.fear,
        interests:npc.interests,bottomLine:npc.bottomLine,
        knowledge:npc.knowledge,personality:npc.personality,
        memories:[],lastAutonomousAction:null
      }
    });
  }
  return ops;
}

export function socialConsequence(run, intent) {
  if(intent.type!=="social") return [];
  const living=(run.npcs||[]).filter(n=>n.alive && n.state?.location===run.location);
  if(!living.length) return [];
  return living.slice(0,1).map(n=>{
    let relation=n.relation||0;
    if(intent.socialTone==="friendly") relation=Math.min(100,relation+2);
    if(intent.socialTone==="hostile") relation=Math.max(-100,relation-6);
    const memories=[...(n.state?.memories||[])];
    memories.push({kind:"player_social",tone:intent.socialTone});
    return {...n,relation,state:{...n.state,memories:memories.slice(-20)}};
  });
}

export function autonomousNpcTick(run, nextLocation, elapsedMinutes){
  if(elapsedMinutes<5) return [];
  const ops=[];
  for(const n of run.npcs||[]){
    if(!n.alive) continue;
    const state={...(n.state||{})};
    const memories=[...(state.memories||[])];
    let note=null;

    if(n.key==="market_keeper"){
      if(state.location==="old_market" && (run.threads||[]).some(t=>t.key==="market_anomaly" && t.status==="active")){
        note="林伯巡了一次市場後方，特別留意屋頂附近是否有人靠近";
      }else{
        note="林伯照常整理攤位與市場周邊";
      }
    }else if(n.key==="station_clerk"){
      note="陳小姐更新了下一班往外地的班次資訊";
    }

    if(note){
      memories.push({kind:"autonomous",turn:(run.turn||0)+1,note});
      state.lastAutonomousAction=note;
      state.memories=memories.slice(-20);
      ops.push({...n,state});
    }
  }
  return ops;
}
