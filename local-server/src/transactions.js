export function tradeOps(run, intent) {
  if(intent.type!=="trade") return {ops:[],facts:[],outcome:null};
  const wallet=run.inventory.find(x=>x.key==="wallet");
  const cash=Number(wallet?.meta?.cash||0);

  const catalog={
    water:{name:"礦泉水",price:25},
    breakfast:{name:"早餐三明治",price:55}
  };
  const item=catalog[intent.item];
  if(!item) return {ops:[],facts:["玩家嘗試進行交易，但目前沒有可識別的商品"],outcome:"blocked"};

  if(cash<item.price){
    return {ops:[],facts:[`現金不足，無法購買${item.name}`],outcome:"blocked"};
  }
  return {
    ops:[
      {type:"cash",delta:-item.price},
      {type:"add",key:intent.item,name:item.name,quantity:1,meta:{}}
    ],
    facts:[`玩家花費 ${item.price} 元購買${item.name}`],
    outcome:"trade_complete"
  };
}
