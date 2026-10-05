let chain=Promise.resolve();
let pending=0;
let active=0;

export function getQueueStatus(){
  return {pending,active};
}

export function enqueue(task){
  pending++;
  const wrapped=async()=>{
    pending=Math.max(0,pending-1);
    active++;
    try{return await task()}
    finally{active=Math.max(0,active-1)}
  };
  const run=chain.then(wrapped,wrapped);
  chain=run.catch(()=>{});
  return run;
}

export async function narrate({model,ollamaUrl,settled,action,recent}){
  const system=`
你是開放世界文字 RPG 的小說敘事器，不是規則裁判。
硬規則：
- 所有 settled facts 都已由伺服器結算，你不可改寫。
- 不可復活已死亡 NPC，不可憑空增加物品，不可瞬移。
- 不顯示骰點、成功率、判定成功/失敗等後台語言。
- 不可替玩家擅自執行下一個重大行動。
- 每回合必須產生資訊、局勢、資源、關係、風險或結果的實際推進。
- 不要用「你沒有照預設選項」等系統語氣。
- 使用繁體中文、小說敘事風格。
- 文字以當前行動為中心，約 250~650 字。
`.trim();

  const payload={
    model,stream:false,
    messages:[
      {role:"system",content:system},
      {role:"user",content:JSON.stringify({settled,recent,player_action:action})}
    ],
    options:{temperature:0.78,num_predict:1000}
  };

  const response=await fetch(`${ollamaUrl.replace(/\/$/,"")}/api/chat`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(120000)
  });
  if(!response.ok)throw new Error(`Ollama HTTP ${response.status}`);
  const data=await response.json();
  return String(data?.message?.content||"").trim();
}
