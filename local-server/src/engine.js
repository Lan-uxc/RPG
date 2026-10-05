import { parseAction } from "./action-parser.js";
import { ensureLocalNpcOps, socialConsequence, autonomousNpcTick } from "./npc-engine.js";
import { discloseNpcInformation } from "./npc-disclosure.js";
import { tradeOps } from "./transactions.js";
import { resolveCombat } from "./combat-engine.js";
import { resolveEnemyCombat } from "./enemy-engine.js";
import { loadScenario } from "./scenario-loader.js";

function addMinutes(hhmm,minutes){
  const [h,m]=hhmm.split(":").map(Number);
  const total=(h*60+m+minutes)%(24*60);
  return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
}
function clone(v){return structuredClone(v)}
function findPath(world,from,target){
  if(from===target)return {next:from,cost:5,arrived:true};
  const direct=world[from]?.routes?.[target];
  if(direct)return {next:target,cost:direct,arrived:true};
  const q=[[from,[]]],seen=new Set([from]);
  while(q.length){
    const [node,path]=q.shift();
    for(const [n,cost] of Object.entries(world[node]?.routes||{})){
      if(seen.has(n))continue;
      const p=[...path,{from:node,to:n,cost}];
      if(n===target)return {next:p[0].to,cost:p[0].cost,arrived:p.length===1,path:p};
      seen.add(n);q.push([n,p]);
    }
  }
  return null;
}

export function settleAction(run,action){
  const scenario=loadScenario(run.scenario_id||"town_origin");
  const world=scenario.places;
  const input=action.trim();
  const intent=parseAction(input);
  const next=clone(run.state);
  const inventoryOps=[],threadOps=[],enemyOps=[];
  let npcOps=[];
  let minutes=5,location=run.location,outcome="progress";

  if(intent.type==="move" && intent.destination && intent.destination!==run.location){
    const path=findPath(world,run.location,intent.destination);
    if(path){
      location=path.next;minutes=path.cost;
      if(!next.visited.includes(location))next.visited.push(location);
      if(!path.arrived)outcome="travel_progress";
    }else outcome="blocked";
  }else if(intent.type==="wait"){
    minutes=/睡/.test(input)?120:30;
  }

  const facts=[...(next.facts||[])];
  const marketThread=run.threads.find(t=>t.key==="market_anomaly");

  if(location==="old_market" && intent.type==="investigate" && /屋頂|暗色|裂痕|命痕/.test(input)){
    if(!facts.includes("老市場屋頂異常並非光影錯覺"))facts.push("老市場屋頂異常並非光影錯覺");
    threadOps.push({
      key:"market_anomaly",title:"老市場屋頂的暗色紋路",status:"active",
      progress:Math.max(1,(marketThread?.progress||0)+1),
      state:{lastEvidence:"屋瓦縫隙存在不自然的暗色紋路"}
    });
  }

  if(location==="old_market" && intent.type==="investigate" && /深入|爬上|靠近|追查|檢查屋頂/.test(input) && (marketThread?.progress||0)>=1){
    if(!facts.includes("暗色紋路會對附近金屬產生極輕微偏移"))facts.push("暗色紋路會對附近金屬產生極輕微偏移");
    threadOps.push({
      key:"market_anomaly",title:"老市場屋頂的暗色紋路",status:"resolved",progress:100,
      state:{resolution:"玩家取得足夠證據，確認異常存在；事件不再強制追蹤"}
    });
    outcome="thread_resolved";
  }

  const harborThread=run.threads.find(t=>t.key==="harbor_lockdown");
  if(run.scenario_id==="harbor_trial" && intent.type==="investigate" && /封鎖|倉庫|聲音|痕跡|檢查|調查/.test(input)){
    const nextProgress=Math.max(25,(harborThread?.progress||0)+35);
    const canResolve=(location==="old_warehouse" || location==="seawall") && nextProgress>=70;
    threadOps.push({
      key:"harbor_lockdown",title:"港區封鎖原因",
      status:canResolve?"resolved":"active",
      progress:canResolve?100:nextProgress,
      state:{
        lastEvidence:location==="old_warehouse"?"舊倉庫內留下近期搬運與封鎖相關痕跡":"港區封鎖與夜間異常活動有直接關聯",
        resolution:canResolve?"已取得足夠資訊理解封鎖原因":null
      }
    });
    facts.push(canResolve?"玩家已釐清港區封鎖原因":"玩家取得一項與港區封鎖有關的新線索");
    if(canResolve) outcome="thread_resolved";
  }

  if(/工作|打工|賺錢|生意/.test(input)){
    if(!facts.includes("玩家開始主動尋找收入來源"))facts.push("玩家開始主動尋找收入來源");
    threadOps.push({key:"income_search",title:"尋找收入來源",status:"active",progress:20,state:{}});
  }

  const trade=tradeOps(run,intent);
  inventoryOps.push(...trade.ops);
  facts.push(...trade.facts);
  if(trade.outcome)outcome=trade.outcome;

  const enemyResult=resolveEnemyCombat(run,intent,input);
  enemyOps.push(...enemyResult.enemyOps);
  facts.push(...enemyResult.facts);

  const combat=resolveCombat(run,intent,input);
  if(combat && enemyResult.target){
    next.hp=combat.hp;next.san=combat.san;
    facts.push(...combat.facts);
    inventoryOps.push(...combat.inventoryOps);
    outcome=enemyResult.target.alive ? combat.outcome : "enemy_defeated";
    if(combat.consequence.incapacitated){
      next.flags.incapacitated=true;
      threadOps.push({
        key:"medical_recovery",title:"處理重傷",status:"active",progress:0,
        state:{source:"combat",hp:0}
      });
    }
  } else if(intent.type==="combat" && !enemyResult.target) {
    outcome="blocked";
  }

  const spawned=ensureLocalNpcOps(run,location);
  npcOps.push(...spawned);

  const mergeNpcs=(base,ops)=>{
    const m=new Map(base.map(n=>[n.key,n]));
    for(const op of ops)m.set(op.key,op);
    return [...m.values()];
  };

  const socialOps=socialConsequence(run,intent);
  npcOps.push(...socialOps);
  const afterSocial={...run,npcs:mergeNpcs(run.npcs||[],socialOps)};

  const disclosure=discloseNpcInformation(afterSocial,intent,input);
  npcOps.push(...disclosure.npcOps);
  facts.push(...disclosure.facts);
  if(disclosure.disclosed.length) outcome="information_gained";

  const afterDisclosure={...run,npcs:mergeNpcs(afterSocial.npcs||[],disclosure.npcOps)};
  const autonomousOps=autonomousNpcTick(afterDisclosure,location,minutes);
  npcOps.push(...autonomousOps);

  const npcMap=new Map();
  for(const op of npcOps)npcMap.set(op.key,op);
  npcOps=[...npcMap.values()];

  next.facts=[...new Set(facts)].slice(-100);

  return {
    turn:run.turn+1,
    time:addMinutes(run.world_time,minutes),
    location,
    locationName:world[location]?.name||location,
    state:next,
    parsedIntent:intent,
    disclosedInformation:disclosure.disclosed,
    summary:`玩家執行：「${input.slice(0,80)}」；世界時間推進 ${minutes} 分鐘。`,
    outcome,inventoryOps,npcOps,enemyOps,threadOps,
    constraints:{noRetroactiveRewrite:true,noForcedNextAction:true,noHiddenDiceText:true}
  };
}

export function fallbackNarrative(settled,action){
  const place=settled.locationName||settled.location;
  if(settled.outcome==="travel_progress"){
    return `你照自己的決定離開原地。\n\n路程沒有被壓縮成一次瞬移。街景、車流和時間一點一點往後推，你目前抵達的是「${place}」。真正的目的地還在前面。\n\n這一步已經發生，也已經寫進世界狀態；下一步要不要繼續，由你決定。`;
  }
  if(settled.outcome==="thread_resolved"){
    return `你把這件事追到了足以落地的程度。\n\n目前取得的證據已經能確認異常存在，而不是單純的錯覺。這條事件線已經收束，不會為了拖長遊戲又憑空冒出另一層幕後。\n\n你現在人在「${place}」，時間是 ${settled.time}。`;
  }
  if(settled.outcome==="information_gained"){
    return `對方沒有把所有事情一次說完，只透露了目前願意談、而且與你的問題有關的部分。\n\n你得到的新情報已經寫進世界紀錄。你仍在「${place}」，時間是 ${settled.time}。`;
  }
  if(settled.outcome==="trade_complete"){
    return `交易完成。你手上的東西與錢包都已經真正更新，而不是只寫在敘事裡。\n\n你目前仍在「${place}」，時間是 ${settled.time}。`;
  }
  if(settled.outcome==="enemy_defeated"){
    return `衝突結束了，敵對目標已失去戰鬥能力。它的狀態已經永久寫入世界，不會在下一回合憑空恢復。\n\n你的 HP 是 ${settled.state.hp}，SAN 是 ${settled.state.san}。`;
  }
  if(settled.outcome.startsWith("combat_") || settled.outcome==="incapacitated"){
    return `衝突真的造成了代價。你的 HP 現在是 ${settled.state.hp}，SAN 是 ${settled.state.san}。\n\n這些數值已經寫進世界狀態，不會在下一回合自動復原。你目前在「${place}」。`;
  }
  if(settled.outcome==="blocked"){
    return `你嘗試執行「${action.trim()}」，但目前條件不足，這件事沒有被系統假裝成成功。\n\n位置仍是「${place}」，時間來到 ${settled.time}。`;
  }
  return `你照自己的想法行動。\n\n「${action.trim()}」造成了實際的世界推進。時間來到 ${settled.time}，目前位置是「${place}」。\n\n這個世界不會把你拉回預設選項；已發生的結果會保留下來。`;
}

export function getWorldForScenario(scenarioId="town_origin"){
  return loadScenario(scenarioId).places;
}
