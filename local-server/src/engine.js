const WORLD = {
  town_edge: { name:"北台灣・邊緣城鎮", routes:{ old_market:8, bus_station:4, riverside:14, industrial_gate:22 } },
  old_market: { name:"老市場", routes:{ town_edge:8, bus_station:6, riverside:12 } },
  bus_station: { name:"公車站", routes:{ town_edge:4, old_market:6, taipei_transit:35 } },
  riverside: { name:"河堤道路", routes:{ town_edge:14, old_market:12, industrial_gate:16 } },
  industrial_gate: { name:"工業區入口", routes:{ town_edge:22, riverside:16 } },
  taipei_transit: { name:"前往台北途中", routes:{ bus_station:35, taipei_city:45 } },
  taipei_city: { name:"台北市區", routes:{ taipei_transit:45 } }
};

function addMinutes(hhmm, minutes) {
  const [h,m]=hhmm.split(":").map(Number);
  const total=(h*60+m+minutes)%(24*60);
  return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
}
function clone(v){ return structuredClone(v); }
function routeFor(current, input) {
  const map = [
    [/老市場|市場/, "old_market"],
    [/公車站|車站/, "bus_station"],
    [/河堤/, "riverside"],
    [/工業區/, "industrial_gate"],
    [/台北/, "taipei_city"]
  ];
  for (const [re,key] of map) if (re.test(input)) return key;
  return current;
}
function findPath(from, target) {
  if (from===target) return {next:from,cost:5,arrived:true};
  const direct=WORLD[from]?.routes?.[target];
  if (direct) return {next:target,cost:direct,arrived:true};
  const q=[[from,[]]], seen=new Set([from]);
  while(q.length){
    const [node,path]=q.shift();
    for(const [n,cost] of Object.entries(WORLD[node]?.routes||{})){
      if(seen.has(n))continue;
      const p=[...path,{from:node,to:n,cost}];
      if(n===target)return {next:p[0].to,cost:p[0].cost,arrived:p.length===1,path:p};
      seen.add(n);q.push([n,p]);
    }
  }
  return null;
}

export function settleAction(run, action) {
  const input=action.trim();
  const next=clone(run.state);
  const inventoryOps=[], npcOps=[], threadOps=[];
  let minutes=5, location=run.location, outcome="progress";

  const wantsMove=/前往|去|到|離開|搭|開車|騎車|走到|移動/.test(input);
  const target=routeFor(run.location,input);
  if(wantsMove && target!==run.location){
    const path=findPath(run.location,target);
    if(path){
      location=path.next;
      minutes=path.cost;
      if(!next.visited.includes(location))next.visited.push(location);
      if(!path.arrived) outcome="travel_progress";
    }
  } else if (/休息|等待/.test(input)) minutes=30;

  const facts=[...(next.facts||[])];
  const marketThread=run.threads.find(t=>t.key==="market_anomaly");

  if (location==="old_market" && /屋頂|暗色|裂痕|命痕|調查|觀察/.test(input)) {
    if(!facts.includes("老市場屋頂異常並非光影錯覺"))facts.push("老市場屋頂異常並非光影錯覺");
    threadOps.push({
      key:"market_anomaly", title:"老市場屋頂的暗色紋路",
      status:"active", progress:Math.max(1,(marketThread?.progress||0)+1),
      state:{ lastEvidence:"屋瓦縫隙存在不自然的暗色紋路" }
    });
  }

  if (location==="old_market" && /深入|爬上|靠近|追查|檢查屋頂/.test(input) && (marketThread?.progress||0)>=1) {
    if(!facts.includes("暗色紋路會對附近金屬產生極輕微偏移"))facts.push("暗色紋路會對附近金屬產生極輕微偏移");
    threadOps.push({
      key:"market_anomaly", title:"老市場屋頂的暗色紋路",
      status:"resolved", progress:100,
      state:{ resolution:"玩家取得足夠證據，確認異常存在；事件不再強制追蹤" }
    });
    outcome="thread_resolved";
  }

  if (/工作|打工|賺錢|生意/.test(input)) {
    if(!facts.includes("玩家開始主動尋找收入來源"))facts.push("玩家開始主動尋找收入來源");
    threadOps.push({key:"income_search",title:"尋找收入來源",status:"active",progress:20,state:{}});
  }

  if (/買水|礦泉水/.test(input)) {
    const wallet=run.inventory.find(x=>x.key==="wallet");
    const cash=Number(wallet?.meta?.cash||0);
    if(cash>=25){
      inventoryOps.push({type:"add",key:"water",name:"礦泉水",quantity:1,meta:{}});
      next.flags.cash = Math.max(0, Number(next.flags.cash ?? cash) - 25);
      facts.push("玩家花費 25 元購買一瓶礦泉水");
    } else {
      outcome="blocked";
      facts.push("玩家身上的現金不足以購買礦泉水");
    }
  }

  next.facts=facts.slice(-100);
  return {
    turn:run.turn+1,
    time:addMinutes(run.world_time,minutes),
    location,
    locationName:WORLD[location]?.name||location,
    state:next,
    summary:`玩家執行：「${input.slice(0,80)}」；世界時間推進 ${minutes} 分鐘。`,
    outcome,
    inventoryOps,npcOps,threadOps,
    constraints:{noRetroactiveRewrite:true,noForcedNextAction:true,noHiddenDiceText:true}
  };
}

export function fallbackNarrative(settled, action) {
  const place=settled.locationName||settled.location;
  if(settled.outcome==="travel_progress"){
    return `你照自己的決定離開原地。\n\n路程沒有被壓縮成一次瞬移。街景、車流和時間一點一點往後推，你目前抵達的是「${place}」。真正的目的地還在前面。\n\n這一步已經發生，也已經寫進世界狀態；下一步要不要繼續，由你決定。`;
  }
  if(settled.outcome==="thread_resolved"){
    return `你把這件事追到了足以落地的程度。\n\n目前取得的證據已經能確認異常存在，而不是單純的錯覺。這條事件線在系統中已經標記為收束，不會為了拖長遊戲又憑空冒出「真正幕後還有另一層」。\n\n你現在人在「${place}」，時間是 ${settled.time}。`;
  }
  return `你照自己的想法行動。\n\n「${action.trim()}」造成了實際的世界推進。時間來到 ${settled.time}，目前位置是「${place}」。\n\n這個世界不會把你拉回預設選項；已發生的結果會保留下來。`;
}

export { WORLD };
