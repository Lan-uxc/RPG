function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

export function settleAction(run, action) {
  const input = action.trim();
  const lower = input.toLowerCase();
  const next = structuredClone(run.state);

  let minutes = 5;
  if (/搭|開車|騎車|公車|火車|離開|前往|移動/.test(input)) minutes = 30;
  if (/休息|睡|等待/.test(input)) minutes = 60;

  let location = run.location;
  if (/台北/.test(input)) location = "前往台北途中";
  else if (/老市場|市場/.test(input)) location = "老市場";
  else if (/河堤/.test(input)) location = "河堤道路";
  else if (/工業區/.test(input)) location = "工業區入口";

  const facts = [...(next.facts || [])];
  if (/屋頂|暗色|命痕|裂痕/.test(input) && !facts.includes("玩家主動調查過老市場屋頂異常")) {
    facts.push("玩家主動調查過老市場屋頂異常");
  }
  if (/工作|打工|賺錢|生意/.test(input) && !facts.includes("玩家開始主動尋找收入來源")) {
    facts.push("玩家開始主動尋找收入來源");
  }

  next.facts = facts.slice(-80);

  return {
    turn: run.turn + 1,
    time: addMinutes(run.world_time, minutes),
    location,
    state: next,
    summary: `玩家執行：「${input.slice(0, 80)}」；世界時間推進 ${minutes} 分鐘。`,
    constraints: {
      noRetroactiveRewrite: true,
      noForcedNextAction: true,
      noHiddenDiceText: true
    }
  };
}

export function fallbackNarrative(settled, action) {
  return `你照自己的想法行動。\n\n「${action.trim()}」並沒有被系統改寫成別的選項。周遭環境隨著你的動作產生了實際變化，時間也繼續往前走。\n\n目前位置：${settled.location}。\n時間：${settled.time}。\n\n遠處的人聲與車流仍照自己的節奏運轉。這個世界沒有停下來等你，也沒有把你強行拉回某條預設路線。`;
}
