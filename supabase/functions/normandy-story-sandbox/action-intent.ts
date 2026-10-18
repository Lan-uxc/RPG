/**
 * Conservative first-action classifier for the deterministic RPG engine.
 * This never grants success, items or movement: the authoritative resolver
 * still checks routes, NPCs, resources and world state.
 */
export type ActionKind = 'convert'|'talk'|'aid'|'follow'|'radio'|'fight'|'hide'|'observe'|'move'|'wait'|'free'

const patterns: ReadonlyArray<[ActionKind, RegExp]> = [
  ['convert', /轉化|變成血裔|吸血|咬(?:住|向|下去)/],
  ['aid', /救援|救助|急救|包紮|治療|扶起傷者|拖.*(?:傷者|傷兵)/],
  ['radio', /無線電|呼叫電台|發送訊息|通訊|通信|頻道/],
  ['fight', /開火|射擊|攻擊|壓制射擊|投擲(?:手榴彈|武器)|格鬥|揮刀/],
  ['hide', /躲藏|躲進|藏身|隱蔽|潛行|趴下|尋找掩體/],
  ['observe', /觀察|查看|檢查|搜索|搜尋|調查|偵察|打量|確認周圍|尋找線索|找(?:出|尋)|看(?:看|清楚)/],
  ['talk', /詢問|問(?:他|她|你|候|話|清楚|一下)|交談|交涉|告訴|說服|搭話|叫住|喊話/],
  ['follow', /跟隨|跟上|尾隨|追上/],
  ['move', /走向|走到|跑向|跑到|前往|前進|撤退|後退|離開|靠近|攀爬|繞過|進入|衝向|移動/],
  ['wait', /等待|休息|停留|睡覺|睡一會/],
]

export function classifyFirstAction(raw: string): ActionKind {
  // A negative instruction such as 「不攻擊」 is a constraint, not an attack.
  const withoutNegatives = String(raw || '')
    .replace(/(?:不|不要|避免|禁止|暫不|先不|並不|不會|不打算|不主動)\s*(?:主動)?\s*(?:攻擊|開火|射擊|戰鬥|使用道具|交談|說話|移動|離開|轉化)/g, ' ')
    .trim()
  // Only the first explicitly sequenced step is attempted this turn.
  const first = withoutNegatives.split(/(?:，|,)?\s*(?:然後|接著|隨後|再來|之後|再)(?=\S)/, 1)[0].replace(/^(?:我|我們)?\s*(?:決定|打算|試著|嘗試|首先|先|立即|現在|準備)\s*/, '')
  // Recognize intent from the leftmost action phrase, rather than treating a
  // later mention of 「攻擊」 as stronger than an earlier 「觀察」.
  const found = patterns.map(([kind,re]) => ({kind, index: first.search(re)}))
    .filter(x=>x.index>=0)
    .sort((a,b)=>a.index-b.index)
  return found[0]?.kind || 'free'
}
