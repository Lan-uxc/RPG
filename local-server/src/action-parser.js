export function parseAction(input) {
  const text=String(input||"").trim();
  const intent={
    raw:text,
    type:"other",
    target:null,
    destination:null,
    item:null,
    socialTone:"neutral",
    risk:"normal"
  };

  if (/前往|去|到|離開|搭|開車|騎車|走到|移動/.test(text)) intent.type="move";
  if (/觀察|查看|調查|搜尋|檢查|翻找|研究/.test(text)) intent.type="investigate";
  if (/買|購買|賣|交易|付錢|付款/.test(text)) intent.type="trade";
  if (/問|詢問|聊天|交談|說服|威脅|拜託|請求/.test(text)) intent.type="social";
  if (/休息|等待|睡/.test(text)) intent.type="wait";
  if (/攻擊|打|射擊|開槍|砍|戰鬥|制服/.test(text)) intent.type="combat";

  if (/台北/.test(text)) intent.destination="taipei_city";
  else if (/老市場|市場/.test(text)) intent.destination="old_market";
  else if (/公車站|車站/.test(text)) intent.destination="bus_station";
  else if (/河堤/.test(text)) intent.destination="riverside";
  else if (/工業區/.test(text)) intent.destination="industrial_gate";
  else if (/港區入口|港口入口/.test(text)) intent.destination="harbor_gate";
  else if (/倉庫巷道|倉庫區/.test(text)) intent.destination="warehouse_lane";
  else if (/舊倉庫|老倉庫/.test(text)) intent.destination="old_warehouse";
  else if (/防波堤/.test(text)) intent.destination="seawall";

  if (/礦泉水|水/.test(text)) intent.item="water";
  if (/早餐|三明治/.test(text)) intent.item="breakfast";

  if (/威脅|恐嚇|逼/.test(text)) intent.socialTone="hostile";
  else if (/拜託|請求|客氣|禮貌/.test(text)) intent.socialTone="friendly";

  if (/偷偷|潛行|冒險|硬闖|強行/.test(text)) intent.risk="high";
  return intent;
}

export function splitActions(input,max=3){
  const text=String(input||"").trim();
  if(!text)return [];
  const normalized=text
    .replace(/[。；;]/g,"，")
    .replace(/，(?:然後|接著|再|之後|並且|最後)/g,"，")
    .replace(/(?:然後|接著|之後|並且|最後)/g,"，");
  const parts=normalized.split(/，+/).map(x=>x.trim()).filter(Boolean);
  if(parts.length<=1)return [text];
  return parts.slice(0,Math.max(1,max));
}
