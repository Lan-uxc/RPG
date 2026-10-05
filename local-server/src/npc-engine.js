export const NPC_TEMPLATES = {
  market_keeper: {
    key:"market_keeper",
    name:"林伯",
    location:"old_market",
    goal:"守住老市場生意與鄰里秩序",
    fear:"異常現象引來外人與麻煩",
    interests:["市場","附近居民","屋頂異常"],
    bottomLine:"不願讓陌生人破壞市場或傷害住戶",
    knowledge:["知道屋頂異常不是第一次出現","知道凌晨有人聽見金屬摩擦聲"],
    personality:"寡言、務實、對陌生人先觀察再信任"
  },
  station_clerk: {
    key:"station_clerk",
    name:"陳小姐",
    location:"bus_station",
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
    if(npc.location!==location || existing.has(npc.key)) continue;
    ops.push({
      key:npc.key,name:npc.name,alive:true,relation:0,
      state:{
        location:npc.location,
        goal:npc.goal,
        fear:npc.fear,
        interests:npc.interests,
        bottomLine:npc.bottomLine,
        knowledge:npc.knowledge,
        personality:npc.personality,
        memories:[]
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
