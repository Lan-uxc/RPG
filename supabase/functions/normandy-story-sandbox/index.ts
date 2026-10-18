
import { createClient } from 'npm:@supabase/supabase-js@2'
import { classifyFirstAction } from './action-intent.ts'

const sj=Deno.env.get('SUPABASE_SECRET_KEYS')||''
let sk=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
try{if(sj)sk=JSON.parse(sj).default||sk}catch{}
const db=createClient(Deno.env.get('SUPABASE_URL')||'',sk,{auth:{persistSession:false}})
const H={'access-control-allow-origin':'*','access-control-allow-headers':'content-type, authorization, apikey','access-control-allow-methods':'GET,POST,OPTIONS'}
const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...H,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)))
const uniq=(a:any[])=>[...new Set(a)]
const fmt=(m:number)=>String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')
function hash(s:string){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return Math.abs(h)}
function roll(s:string){return hash(s)%100+1}
function cleanShort(v:any,max=60){return String(v||'').trim().replace(/[<>]/g,'').slice(0,max)}
// Player actions deliberately have a wider limit than names. Keep plain-text input safe,
// but preserve enough context for multi-step free actions to be resolved deterministically.
function cleanAction(v:any){return String(v||'').trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,600)}
function normalizedTags(tags:any[]){return uniq((Array.isArray(tags)?tags:[]).map(x=>cleanShort(x,30)).filter(Boolean)).slice(0,3)}
const TAG_KIND:any={移動:'move',搜索:'observe',觀察:'observe',交涉:'talk',潛行:'hide',戰鬥:'fight',休息:'wait'}
function actionKind(input:string,tags:string[],ability:any){
 const parsed=parse(input)
 // A TAG only supplies intent when the text itself is genuinely unclassified; it never
 // overrides an explicit player action such as "交涉後撤退". A stealth movement phrase
 // is the narrow exception: "貼著陰影繞過去" is still movement, but its chosen method is hide.
 if(parsed!=='free'){
  if(parsed==='move'&&tags.includes('潛行')&&/陰影|無聲|悄|貼著/.test(input))return'hide'
  return parsed
 }
 const tag=tags.find(t=>TAG_KIND[t])
 if(tag)return TAG_KIND[tag]
 if(ability?.tag&&tags.includes(ability.tag)&&/轉化|血液|血裔|咬/.test(input))return'convert'
 return'free'
}
function tagForKind(kind:string,tags:string[]){return tags.find(t=>TAG_KIND[t]===kind)||''}
function choiceSemanticKey(choice:any){
 const input=String(choice?.input||'')
 const target=/柯爾|通訊/.test(input)?'cole':/里德|工兵|缺口/.test(input)?'reed':/佛斯特|救護|傷兵/.test(input)?'aid':/梅瑟/.test(input)?'mercer':/林蔚/.test(input)?'linwei':/陳墨/.test(input)?'chenmo':'world'
 return 'intent_'+parse(input)+'_'+target
}
function rememberChoiceKeys(w:any,choices:any[]){
 const prior=Array.isArray(w.choice_key_history)?w.choice_key_history:[]
 const keys=(choices||[]).flatMap((x:any)=>[String(x?.key||''),choiceSemanticKey(x)]).filter(Boolean)
 w.choice_key_history=uniq([...prior,...keys]).slice(-32)
}
function code(n=8){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=new Uint8Array(n);crypto.getRandomValues(b);return[...b].map(x=>a[x%a.length]).join('')}
function token(){const b=new Uint8Array(24);crypto.getRandomValues(b);return[...b].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function sha(s:string){const x=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(x)].map(v=>v.toString(16).padStart(2,'0')).join('')}

const VAMP={
 id:'progenitor_vampire',name:'始祖血裔',family:'血裔型',
 summary:'你是第一代吸血鬼，可將活著的人類轉化為血裔。你本人不懼怕陽光；由你轉化的血裔會受到日照傷害。',
 activation:'必須與活人建立直接血液接觸，並有明確轉化意圖。',
 limit:'不能復活死者，不能藉轉化控制思想、記憶或忠誠。',
 cost:'每次轉化消耗體力與血液；短時間大量轉化會造成明顯衰弱。',
 tag:'始祖血裔'
}
const ALT=[
 {id:'second_pulse',name:'第二脈衝',family:'反應型',summary:'在已意識到危險時，身體可提前約一秒出現預警。',activation:'先察覺附近存在風險。',limit:'不指出方向或原因。',cost:'連續觸發會造成心悸與反應遲滯。',tag:'第二脈衝'},
 {id:'fault_line',name:'裂隙感知',family:'解析型',summary:'長時間觀察後能感知結構或行動最可能失效的位置。',activation:'持續觀察同一目標。',limit:'不會直接給出答案。',cost:'複雜目標造成頭痛與專注下降。',tag:'裂隙感知'}
]
function abilityFor(n:string){if(n==='吸血鬼')return VAMP;return ALT[hash(n)%ALT.length]}

async function auth(c:string,t:string){
 const {data}=await db.from('game_sessions').select('*').eq('session_code',c.toUpperCase()).maybeSingle()
 return data&&await sha(t)===data.access_token_hash?data:null
}
async function npcPatch(id:string,p:any){
 const q:any={updated_at:new Date().toISOString()}
 for(const k of ['status','trust','tension','state'])if(p[k]!==undefined)q[k]=p[k]
 if(p.scene_key!==undefined)q.scene_key=legalScene(p.scene_key)
 await db.from('game_npc_states').update(q).eq('id',id)
}
function viewNpc(n:any){
 const s=n.state||{}
 let kind='盟軍士兵'
 if(s.actor_type==='survivor'){
  if(s.confirmed_by_player)kind='已確認倖存者'
  else if(Number(s.cover_adaptation||0)<65)kind='疑似倖存者'
  else kind='身分不明'
 }
 return {...n,relation_view:{kind,certainty:s.confirmed_by_player?'confirmed':s.actor_type==='survivor'?'uncertain':'historical'}}
}

function ensureThreads(w:any){w.threads=w.threads||{};return w.threads}
function threadTurn(w:any){return Number(w.current_turn||0)}
function openThread(w:any,key:string,title:string,note:string,pressure=3){
 const t=ensureThreads(w)
 if(!t[key])t[key]={key,title,status:'open',pressure,notes:[note],created_at:w.time,created_turn:threadTurn(w)}
 else{t[key].notes=uniq([...(t[key].notes||[]),note]).slice(-5);t[key].pressure=Math.max(Number(t[key].pressure||0),pressure)}
}
function resolveThread(w:any,key:string,note:string,status='resolved'){
 const t=ensureThreads(w)
 if(!t[key])t[key]={key,title:key,status,pressure:0,notes:[note],created_at:w.time,created_turn:threadTurn(w),resolved_turn:threadTurn(w)}
 else{t[key].status=status;t[key].notes=uniq([...(t[key].notes||[]),note]).slice(-5);t[key].pressure=0;t[key].resolved_turn=threadTurn(w)}
}
function visibleThreads(w:any){return Object.values(w.threads||{}).filter((x:any)=>x.status==='open'||x.status==='resolved').slice(-8)}
async function syncThreads(sessionId:string,w:any,turnNo:number){
 const rows=Object.values(w.threads||{}).map((t:any)=>({
  session_id:sessionId,thread_key:String(t.key),title:String(t.title||t.key),status:String(t.status||'open'),
  pressure:Math.max(0,Math.min(10,Number(t.pressure||0))),notes:Array.isArray(t.notes)?t.notes:[],
  state:{created_at:t.created_at||null},created_turn:Number(t.created_turn??turnNo),
  resolved_turn:['resolved','failed','changed','superseded'].includes(t.status)?Number(t.resolved_turn??turnNo):null,
  updated_at:new Date().toISOString()
 }))
 if(!rows.length)return
 try{await db.from('game_threads').upsert(rows,{onConflict:'session_id,thread_key'})}catch{}
}

const timeline=[
 {id:'h_hour',at:390,text:'第一波登陸艇陸續放下跳板。海灘上的火力、障礙和混亂同時把原本的編制切碎。'},
 {id:'tide',at:420,text:'潮水持續上升，海灘上的障礙逐漸被淹沒；新的登陸艇仍在靠岸，水際變得更擁擠。'},
 {id:'engineers',at:465,text:'工兵分隊開始在火力下處理障礙物。部分爆破成功，部分通道又被人群與車輛堵住。'},
 {id:'followup',at:510,text:'更多後續部隊抵達灘頭。命令、傷員、失散士兵和裝備混在一起，局部區域開始出現新的臨時指揮。'},
 {id:'bluff',at:570,text:'一些零散盟軍小組已經從不同位置越過海堤與高地。正面出口仍然危險，但戰場不再只存在於沙灘上。'},
 {id:'inland',at:660,text:'上午後段，越來越多小組向科勒維爾與聖洛朗方向內陸滲透。海灘與高地之間逐漸形成能來回傳遞人員和情報的路線。'},
 {id:'noon',at:750,text:'中午過後，戰鬥開始沿樹籬、農道與村鎮外圍分散。原本在海灘失散的人，有些重新找到單位，有些加入陌生小組。'},
 {id:'supply',at:900,text:'午後，更多補給、火力與人員經由已能使用的路線進入內陸；局部戰鬥仍然混亂，但灘頭已不再是唯一中心。'},
 {id:'evening',at:1080,text:'傍晚前，各處盟軍開始整理已取得的位置、傷員與聯絡線。遠處仍有零星戰鬥，白天留下的每一條人物線都開始顯出後果。'},
 {id:'dusk',at:1230,text:'天色逐漸暗下來。海灘方向的炮聲沒有停止，但第一日的局勢正在從搶灘轉成守住既有位置。'}
]

function worldBand(min:number){
 if(min<390)return'approach'
 if(min<480)return'beach_chaos'
 if(min<600)return'breakout'
 if(min<750)return'highground'
 if(min<960)return'inland'
 if(min<1140)return'afternoon'
 return'evening'
}
function locationLabel(w:any){return w.location||'奧馬哈海灘外海'}
const DEFAULT_SCENARIO='normandy_1944'
const VALID_SCENES=new Set(['normandy_open','omaha_waterline','omaha_shingle','omaha_high','inland_hedgerow'])
function legalScene(scene:string|undefined,fallback='normandy_open'){return scene&&VALID_SCENES.has(scene)?scene:fallback}
async function loadScenario(key:string){
 const {data}=await db.from('game_scenarios').select('*').eq('scenario_key',key).eq('is_active',true).maybeSingle()
 return data||null
}
async function loadPlace(scenarioKey:string,sceneKey:string){
 const {data}=await db.from('game_places').select('*').eq('scenario_key',scenarioKey).eq('scene_key',sceneKey).maybeSingle()
 return data||null
}
async function loadEnabledRoutes(scenarioKey:string,sceneKey:string){
 const {data}=await db.from('game_routes').select('*').eq('scenario_key',scenarioKey).eq('from_scene_key',sceneKey).eq('is_enabled',true)
 return data||[]
}
function routeWords(route:any){
 const to=String(route.to_scene_key||'')
 const aliases:any={
  omaha_waterline:/靠岸|下艇|水際|海灘|障礙帶|登陸/,
  omaha_shingle:/碎石|海堤|障礙帶|掩體/,
  omaha_high:/高地|上坡|出口|峭壁/,
  inland_hedgerow:/內陸|樹籬|農地|村|道路/,
  normandy_open:/回船|登陸艇|外海/
 }
 return aliases[to]||new RegExp(String(route.label||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
}
function chooseRoute(input:string,routes:any[]){
 if(!routes.length)return null
 const matched=routes.filter(r=>routeWords(r).test(input)||String(r.label||'').split('').some(x=>x.length>1&&input.includes(x)))
 if(matched.length)return matched[0]
 // A scene with exactly one enabled outgoing route may be traversed by a general move action,
 // but an explicitly named unknown destination is never silently reinterpreted as that route.
 if(/前往|去(?:往)?|到達|直奔|直接/.test(input))return null
 return routes.length===1?routes[0]:null
}
async function resolveRoute(s:any,input:string){
 const scenarioKey=s.scenario_key||DEFAULT_SCENARIO
 const fromScene=s.current_scene_key||'normandy_open'
 const {data}=await db.from('game_routes').select('*').eq('scenario_key',scenarioKey).eq('from_scene_key',fromScene).eq('is_enabled',true)
 const route=chooseRoute(input,data||[])
 if(!route)return{route:null,fromScene,reason:'目前沒有已知直接路線；你得先搜索、取得情報或改變眼前條件。'}
 const place=await loadPlace(scenarioKey,route.to_scene_key)
 if(!place)return{route:null,fromScene,reason:'這條路線的目的地資訊尚未可用，不能冒然穿越。'}
 return{route,place,fromScene}
}
function sceneAfterMovement(s:any,movement:any){return movement?.route?.to_scene_key||s.current_scene_key||'normandy_open'}
function applyMovement(w:any,movement:any){
 if(!movement?.route||!movement?.place)return false
 w.location=movement.place.name
 w.location_scene_key=movement.route.to_scene_key
 return true
}

function parse(input:string){return classifyFirstAction(input)}
function namedTarget(input:string,npcs:any[]){
 const pairs:any[]=[
  [/梅瑟|中士/,'mercer'],[/佛斯特|醫護/,'foster'],[/里德|工兵/,'reed'],[/柯爾|通訊|通信/,'cole'],
  [/林蔚/,'linwei'],[/陳墨/,'chenmo']
 ]
 for(const [re,k] of pairs)if(re.test(input))return npcs.find(n=>n.npc_key===k)
 return null
}

function actionMinutes(kind:string,input:string,tags:string[]=[]){
 if(kind==='wait'){
  const m=input.match(/(\d+)\s*分鐘/)
  const base=m?Math.min(120,Math.max(5,Number(m[1]))):20
  return tags.includes('休息')?Math.max(10,base):base
 }
 const base:any={observe:4,talk:5,aid:8,follow:7,radio:5,fight:4,hide:5,move:9,convert:6,free:6}
 // A method TAG changes the cost of attempting the matching action; it never guarantees success.
 if(kind==='hide'&&tags.includes('潛行'))return (base[kind]||5)+2
 if(kind==='observe'&&(tags.includes('搜索')||tags.includes('觀察')))return (base[kind]||4)+1
 if(kind==='move'&&tags.includes('移動'))return Math.max(5,(base[kind]||9)-1)
 return base[kind]||6
}

function historicalEvents(w:any,from:number,to:number){
 const out:string[]=[]
 w.timeline_seen=w.timeline_seen||[]
 for(const e of timeline){
  if(e.at>from&&e.at<=to&&!w.timeline_seen.includes(e.id)){
   w.timeline_seen.push(e.id);out.push(e.text)
  }
 }
 return out
}

async function tickNpcs(w:any,npcs:any[],from:number,to:number,notes:string[]){
 const band=worldBand(to)
 for(const n of npcs){
  const st={...(n.state||{})}
  if(st.actor_type==='survivor'&&!st.confirmed_by_player){
   st.cover_adaptation=clamp(Number(st.cover_adaptation||0)+(to-from>=10?5:2))
   await npcPatch(n.id,{state:st})
  }
 }
 const m=npcs.find(n=>n.npc_key==='mercer')
 if(m&&m.status!=='死亡'){
  if(band==='beach_chaos')await npcPatch(m.id,{status:'把失散盟軍往較高的掩體集中',state:{...(m.state||{}),goal:'讓附近盟軍離開水際'}})
  else if(['breakout','highground'].includes(band))await npcPatch(m.id,{status:'帶著臨時小組尋找離開灘頭的路',scene_key:'omaha_high',state:{...(m.state||{}),goal:'把臨時小組帶過高地'}})
  else if(['inland','afternoon','evening'].includes(band))await npcPatch(m.id,{status:'與內陸盟軍重新建立編制聯絡',scene_key:'inland_hedgerow',state:{...(m.state||{}),goal:'重新接上指揮鏈'}})
 }
 const f=npcs.find(n=>n.npc_key==='foster')
 if(f&&f.status!=='死亡'){
  if(to>=510){await npcPatch(f.id,{status:'在較高地帶處理大量傷兵',scene_key:'omaha_high',state:{...(f.state||{}),goal:'維持臨時救護點'}});openThread(w,'aid_station','臨時救護點','佛斯特開始在較高位置集中處理傷兵。',4)}
 }
 const r=npcs.find(n=>n.npc_key==='reed')
 if(r&&r.status!=='死亡'&&!stBool(w,'engineer_breach')&&to>=465){
  w.engineer_breach=true
  await npcPatch(r.id,{status:'完成一處障礙爆破後往上方撤離',scene_key:'omaha_shingle',state:{...(r.state||{}),goal:'尋找下一個工兵任務'}})
  notes.push('不在你視線中心的另一邊傳來爆炸。里德那組工兵終於炸開一處障礙，幾個原本被壓在水際的人立刻往缺口靠。');openThread(w,'reed_breach','里德的爆破缺口','一處工兵缺口已形成，但能使用多久未知。',5)
 }
 const c=npcs.find(n=>n.npc_key==='cole')
 if(c&&c.status!=='死亡'&&!c.state?.rescued&&to>=425){
  await npcPatch(c.id,{status:'位置不明',state:{...(c.state||{}),missing:true,location_known:false}})
  if(!w.cole_lost_noted){w.cole_lost_noted=true;notes.push('你再去找柯爾原本的位置時，那裡只剩被海水沖斜的背帶痕跡。有人把他拖走了，或他自己移動了；至少現在沒有人能直接告訴你答案。');openThread(w,'cole_missing','失去聯絡的柯爾','柯爾與 SCR-300 的位置變成未知。',6)}
 }
}
function stBool(w:any,k:string){return !!w[k]}

async function resolveAction(s:any,w:any,npcs:any[],input:string,kind:string,r:number,tags:string[]=[],movement:any=null){
 let hp=s.hp,st=s.stamina,fo=s.focus,danger=Number(w.danger||70),short='',importance=5
 const p:string[]=[]
 const target=namedTarget(input,npcs)
 const band=worldBand(Number(w.time_min||387))
 const ab=w.player?.ability
 const method=tagForKind(kind,tags)
 const abilityAuthorized=!!(ab?.tag&&tags.includes(ab.tag))

 if(kind==='convert'&&ab?.id==='progenitor_vampire'){
  const t=abilityAuthorized?(target||npcs.find(n=>n.status!=='死亡'&&!n.state?.vampire)):null
  if(!t){
   p.push(abilityAuthorized?'你沒有找到一個能確認仍活著、又能完成血液接觸的目標。':'你知道自己有這項能力，但這回合沒有授權使用「'+ab.tag+'」的方法。')
   short=abilityAuthorized?'轉化條件沒有成立。':'能力沒有獲得本回合授權。'
  }
  else{
   st=clamp(st-14);fo=clamp(fo-4);danger=clamp(danger+6)
   await npcPatch(t.id,{status:'已轉化・必須避開直射日光',trust:Math.max(0,t.trust-8),tension:100,state:{...(t.state||{}),vampire:true,sunlight_weakness:true,converted_by:w.player.name}})
   w.converted=uniq([...(w.converted||[]),t.npc_key]);openThread(w,'blood_'+t.npc_key,t.name+'的血裔後果',t.name+'已被轉化，保留自由意志且懼怕日照。',8)
   p.push(t.name+'仍有脈搏。轉化完成後，他的呼吸和力量很快恢復，但晨光照到裸露皮膚時立刻出現灼傷。')
   p.push('這個變化沒有讓他變成你的傀儡。他先處理的是自己的疼痛與眼前戰場，是否跟你走仍取決於他自己的判斷。')
   short=t.name+'被轉化為血裔，日照與自由意志同時成為後續問題。';importance=9
  }
 }else if(kind==='talk'){
  if(target){
   p.push('你在槍聲或人群的空檔裡叫住'+target.name+'。他沒有停下手上的事情，只把能回答的部分用最短的話回給你。')
   const stt=target.state||{},parts=[] as string[]
   if(stt.goal)parts.push('目標是「'+stt.goal+'」')
   if(stt.fear)parts.push('最怕的是「'+stt.fear+'」')
   if(stt.bottom_line)parts.push('底線是「'+stt.bottom_line+'」')
   if(parts.length)p.push('從他的回答和反應，你至少能確定：'+parts.join('，')+'。')
   await npcPatch(target.id,{trust:Math.min(100,target.trust+(method==='交涉'?5:3)),tension:Math.max(0,target.tension-(method==='交涉'?2:1))})
   if(method==='交涉')p.push('你把問題收斂成他能立刻回答的部分，這讓他少了一點防備。')
   short='你取得了'+target.name+'目前目標與態度的直接線索。'
  }else{
   p.push('你找最近能聽見的人問話。答案並不一致：有人只知道自己的班散了，有人說上級在海堤方向，也有人根本沒聽清問題。')
   p.push('真正有價值的不是某個完整答案，而是你確認這一帶的資訊已經碎成很多互相矛盾的小片。')
   short='你取得零散情報，但沒有單一可靠答案。'
  }
 }else if(kind==='aid'){
  const t=target||npcs.find(n=>n.state?.wounded||/傷|中彈/.test(n.status))
  if(t){
   p.push('你先確認呼吸和出血，再決定怎麼移動'+t.name+'。在這種地方，單純把人拖走也可能讓你們兩個一起暴露。')
   await npcPatch(t.id,{status:'得到初步處置・仍需後送',trust:Math.min(100,t.trust+12),state:{...(t.state||{}),rescued:true,wounded:true}})
   st=clamp(st-6);openThread(w,'aid_'+t.npc_key,t.name+'的傷勢','已完成初步處置，但仍需要後續照顧。',5);short=t.name+'得到初步救助，後續位置與關係因此改變。';importance=8
  }else{
   p.push('你很快找到真正需要幫助的人，但傷勢多到不可能全部處理。你只能先把一名還能救的人拖離最暴露的位置。')
   short='你救下一名未具名傷兵，同時放棄了其他無法兼顧的人。'
  }
 }else if(kind==='follow'){
  const t=target||npcs.find(n=>n.status!=='死亡'&&/帶|移動|撤|尋找/.test(n.status))
  const moved=applyMovement(w,movement)
  if(t){
   p.push('你沒有叫住'+t.name+'，只是保持能看見他的距離跟上。這讓你看到的不是一段對話，而是他真正正在做的事。')
   if(t.state?.goal)p.push('他的路線和停頓都指向同一個目的：'+t.state.goal+'。')
   short=moved?'你跟著人物沿已知路線進入'+movement.place.name+'，並取得行動意圖。':'跟蹤沒有提供可確認的路線；'+(movement?.reason||'你暫時仍在原場景。');importance=7
  }else{
   p.push(moved?'你最後跟上另一組正在移動的盟軍，沿已知路線離開原來位置。':'煙、地形和人群把視線切斷；'+(movement?.reason||'你沒有因此穿越到未知地點。'))
   short=moved?'你跟上另一支盟軍小組，位置實際改變。':'原目標跟丟，且沒有可確認的直接路線。'
  }
 }else if(kind==='radio'){
  if(target?.npc_key==='cole'&&!target.state?.missing){
   p.push('柯爾還能回應。無線電在海水與碰撞後狀況很差，但耳機裡仍偶爾能分辨出盟軍口令。')
   w.radio_known=true;openThread(w,'radio','破碎的盟軍通訊','SCR-300 仍可收到部分盟軍口令。',5);short='無線電仍可提供有限情報。';importance=7
  }else if(w.radio_known){
   p.push('你調整頻道，只聽到被雜訊切碎的呼叫。不同單位的方向和位置互相交錯，沒有一條命令能直接替你決定下一步。')
   short='無線電提供局部情報，但沒有完整戰場圖。'
  }else{
   p.push('你沒有一部能立即使用的無線電。最近的通信裝備不是已經跟人一起移動，就是被水、沙和人群擋住。')
   short='目前無法直接使用通訊設備。'
  }
 }else if(kind==='fight'){
  st=clamp(st-7);danger=clamp(danger+(method==='戰鬥'?7:10));if(method==='戰鬥')fo=clamp(fo-2)
  if(r>45){
   p.push('你沒有把火力浪費在看不清的方向，而是等到一個反覆出現的射擊位置露出跡象才開火。那裡安靜了幾秒。')
   p.push('幾秒不代表摧毀了對方，但足夠讓附近的人改變位置。')
   short='短暫壓制改變了附近的移動窗口。'
  }else{
   hp=clamp(hp-6);openThread(w,'player_wound','你的傷勢','交火造成新的傷勢，需要後續處理。',4);p.push('你一露出身體，附近就有子彈打在障礙物邊緣。碎片劃開皮膚，你只能先換位置。')
   short='交火沒有達成原本目的，卻迫使你改變位置並付出傷勢。'
  }
 }else if(kind==='hide'){
  danger=clamp(danger-(method==='潛行'?11:7));if(method==='潛行')fo=clamp(fo-2)
  p.push('你選的地方確實能減少眼前暴露，但視野也被遮住。幾分鐘後再探頭時，原本熟悉的人和路線已經換了位置。')
  if(method==='潛行')p.push('你刻意壓低聲響與輪廓，換來更低的暴露，但專注被持續消耗。')
  short='你降低短期風險，同時失去部分即時資訊。'
 }else if(kind==='observe'){
  fo=clamp(fo-(method==='搜索'||method==='觀察'?3:2))
  const obs=[
   '你把注意力從槍聲本身移到人群的移動方式，很快看出真正危險的地方通常是所有人同時停下來的方向。',
   '你沒有找到一個「安全點」，但找到幾個只在數秒內相對安靜的位置；它們更像窗口，不像道路。',
   '你開始分辨哪些混亂只是恐慌，哪些變化代表某一側真的有部隊正在前進。',
   '你看見幾名士兵的注意力並不在同一件事上：有人只想離開水際，有人忙著找傷員，也有人一直在找失散的軍官。'
  ]
  p.push(obs[r%obs.length]);if(method==='搜索'||method==='觀察'){p.push('你把注意力集中在可驗證的細節上，留下了一條之後能回頭利用的線索。');w.last_observation={at:w.time,method,clue:'已辨認一個可利用的局勢差異'};importance=6}
  short=method==='搜索'||method==='觀察'?'你取得可回頭驗證的局部情報。':'觀察沒有停止世界，但讓你辨認出一個新的局勢差異。'
 }else if(kind==='move'){
  const moved=applyMovement(w,movement);st=clamp(st-5);danger=clamp(danger+(moved?(method==='移動'?1:3):0))
  if(moved){
   p.push('你沒有瞬間跨過地形。你沿著「'+(movement.route.label||'已知路線')+'」一段段穿過遮蔽與火力空檔，最後進入'+movement.place.name+'。')
   if(method==='移動')p.push('你把移動拆成短距離的可行路段，少暴露了一點，但沒有跳過地形與火力。')
   short='你沿已知路線抵達'+movement.place.name+'。'
  }else{
   p.push(movement?.reason||'目前沒有已知直接路線；你不能靠一句話瞬間穿越到目的地。')
   short='移動沒有成立，位置維持在目前場景。'
  }
 }else if(kind==='wait'){
  if(method==='休息'){st=clamp(st+7);fo=clamp(fo+4);danger=clamp(danger+2);p.push('你用短暫休息恢復呼吸與手腳的穩定，但戰場沒有替你停下。')}
  else p.push('你沒有主動介入眼前任何一條線。等待並不讓世界暫停；你只是把主動權交給其他人和時間。')
  short=method==='休息'?'你恢復了一部分體力與專注，但局勢繼續惡化。':'你選擇等待，世界事件與 NPC 行動將主導這段時間。'
 }else{
  const open=visibleThreads(w).filter((x:any)=>x.status==='open')
  if(target){
   const trustDelta=r%2===0?2:-1
   await npcPatch(target.id,{trust:clamp(Number(target.trust||0)+trustDelta),tension:clamp(Number(target.tension||0)+(trustDelta>0?-1:2))})
   p.push('你沒有照既有命令處理'+target.name+'，但他確實注意到你的做法；這改變了他此刻願不願意靠近你的程度。')
   short=target.name+'對你的自訂行動留下了可持續的態度變化。';importance=6
  }else if(open.length){
   const t:any=open[r%open.length]
   t.pressure=Math.max(1,Number(t.pressure||3)-1)
   t.notes=uniq([...(t.notes||[]),'你以自訂方法介入，事件壓力暫時改變。']).slice(-5)
   p.push('你的方法沒有直接結束「'+t.title+'」，但確實改變了它目前最急迫的部分。')
   short='你以自訂方式介入既有事件，壓力與可選後果已改變。';importance=6
  }else{
   const delta=r%2===0?-2:2;danger=clamp(danger+delta);w.last_free_consequence={input:input.slice(0,160),location:w.location,at:w.time,danger_delta:delta}
   p.push('你的方法沒有現成指令可套用，但它讓周圍的風險向一側偏移；下一步不能再把這裡當成原來的狀態。')
   short='自由行動改變了局部危險與後續判斷。';importance=6
  }
 }
 return{hp,st,fo,danger,paragraphs:p,short,importance}
}

function settleCoreThreads(w:any,input:string,kind:string,r:number,notes:string[]){
 const threads=ensureThreads(w)
 if(threads.cole_missing?.status==='open'&&/柯爾|通訊|無線電/.test(input)&&['follow','move','observe','radio','free'].includes(kind)){
  if(r>35){w.radio_known=true;resolveThread(w,'cole_missing','你取得柯爾與 SCR-300 的明確下落；通訊線索不再只是失蹤事件。','resolved');notes.push('你順著留下的痕跡確認了柯爾與無線電的下落。這件事沒有回到原點，而是轉成可以使用的通訊線索。')}
  else{resolveThread(w,'cole_missing','你沒有立刻找到柯爾，但確認他已被另一組人帶往較高位置；搜尋焦點改成追蹤其去向。','changed');notes.push('你沒有直接找到柯爾，但取得了足以改變搜尋方向的目擊線索。')}
 }
 if(threads.reed_breach?.status==='open'&&w.engineer_breach&&/里德|工兵|缺口/.test(input)&&['move','observe','free'].includes(kind)){
  if(r>30){resolveThread(w,'reed_breach','你確認缺口仍可使用，並實際通過或交給後續盟軍使用。','resolved');notes.push('缺口的可用性已被實際驗證；它不再只是反覆提醒你的未解問題。')}
  else{resolveThread(w,'reed_breach','你抵達時發現缺口已被火力與人群堵死，原本的機會已轉化為新的風險。','superseded');notes.push('工兵缺口仍存在，但已不再是目前可用的路線。')}
 }
 if(threads.aid_station?.status==='open'&&/佛斯特|救護|傷兵/.test(input)&&['aid','move','free'].includes(kind)){
  if(r>35){resolveThread(w,'aid_station','你將可處置的傷員或資訊帶到救護點，並確認其目前最缺的人手與物資。','resolved');notes.push('救護點的需求已被你實際接上；這條事件不再停留在遠處傳聞。')}
  else{resolveThread(w,'aid_station','救護點已被轉移或飽和，你只能確認原本的安排已失效。','changed');notes.push('你抵達後發現救護點的原狀已改變，後續必須改用新的救援方向。')}
 }
}
function storyTexture(w:any,npcs:any[],kind:string,r:number){
 const p:string[]=[]
 const band=worldBand(Number(w.time_min||387))
 const m=npcs.find(n=>n.npc_key==='mercer'),f=npcs.find(n=>n.npc_key==='foster'),rd=npcs.find(n=>n.npc_key==='reed')
 if(['beach_chaos','breakout'].includes(band)&&r%2===0)p.push('海水裡又有一批人往前擠。有人摔倒後再也沒站起來，也有人連自己原本屬於哪個班都顧不上，只跟著最近還在喊命令的人走。')
 if(band==='highground'&&m)p.push('海灘方向的槍聲還很密，但梅瑟那樣的臨時小組已經開始把人帶向更高地帶。戰場中心正在往內陸移。')
 if(['inland','afternoon'].includes(band))p.push('樹籬把視野切成十幾公尺一段。你聽得到遠處車輛和單發槍聲，卻很難從聲音判斷哪一道樹籬後面是友軍。')
 if(f&&/傷兵/.test(f.status)&&r%3===0)p.push('佛斯特沒有跟任何人長談。他的注意力一直在下一個傷口上，誰能走就被他趕走，誰站不起來才留下。')
 if(rd&&w.engineer_breach&&r%3===1)p.push('里德炸開的那處缺口已經不再只屬於工兵。更多人從那裡通過後，原本的爆破點開始變成一條真正的路。')
 return p
}

function candidates(w:any,npcs:any[]){
 const band=worldBand(Number(w.time_min||387)),a:any[]=[]
 const add=(label:string,input:string)=>a.push({label,input})
 const alive=npcs.filter(n=>n.status!=='死亡')
 const survivor=alive.find(n=>n.state?.actor_type==='survivor'&&!n.state?.confirmed_by_player&&Number(n.state?.cover_adaptation||0)<65)
 const moving=alive.find(n=>/帶|移動|撤|尋找|處理/.test(n.status))
 if(band==='approach'){
  add('先看火力','我先觀察艇首與岸上的火力來源，等跳板放下再決定落點。')
  add('記住身邊的人','我先記住艇內幾個重要人物的位置、裝備與反應。')
  add('問清楚編制','我趁還沒下艇，問梅瑟中士我們落地後原本應該跟哪個單位走。')
  add('準備直接下艇','我重新固定裝備，準備跳板一落就離開船艙。')
  add('找疑似倖存者','我觀察有沒有人對這個年代的裝備或口令反應異常。')
 }else{
  if(moving)add('跟上正在行動的人','我跟上'+moving.name+'，不叫停他，先看他實際要把事情帶到哪裡。')
  if(survivor)add('試探疑似倖存者','我找一個不會被歷史人物誤會的方式，試探'+survivor.name+'是不是和我一樣被捲進來的人。')
  if(w.engineer_breach)add('利用已出現的缺口','我不重做工兵的工作，直接評估已炸開的通道現在還能不能利用。')
  if(w.radio_known)add('聽一段通訊','我只聽一小段無線電，找現在還有效的方向與單位資訊。')
  if(['beach_chaos','breakout'].includes(band)){
   add('離開最暴露的位置','我找一條能分段移動的路，先讓自己離開水際和最開闊的火力區。')
   add('處理傷兵','我找最近一名真正無法自行移動的傷兵，先決定救人還是找人接手。')
   add('觀察新的火力變化','我不重複剛才的動作，只看這幾分鐘新出現的火力死角與人群流向。')
  }else if(band==='highground'){
   add('跟著高地突破的人走','我找一組正在越過高地的盟軍跟上，看他們從哪裡出去。')
   add('留在海堤整理情報','我先不往內陸，整理目前知道的人物位置、通訊和出口情況。')
   add('找失散單位','我沿著有盟軍口令的方向找能確認編制的小組。')
  }else{
   add('沿樹籬偵察','我沿樹籬邊緣走，不直接穿過開口，先判斷另一側是否有人。')
   add('尋找盟軍聯絡','我優先找能確認編制與命令的盟軍單位，而不是盲目往前。')
   add('處理人物線','我暫時不追地圖目標，先看目前跟我有關係的人各自在做什麼。')
   add('改走另一條方向','我刻意離開上一回合的方向，從另一條農道或掩蔽路線探索。')
  }
  add('自由觀察','我先不假設下一步，重新看現在位置、人物與時間發生了哪些新變化。')
  add('等待一段時間','我先保持隱蔽觀察十分鐘，看看世界在我不介入時會怎麼變。')
 }
 return a
}


function freshChoices(w:any,npcs:any[],routes:any[]=[]){
 const b=worldBand(Number(w.time_min||387))
 const serial=Number(w.choice_serial||0)
 const usedKeys=new Set(w.choice_key_history||[])
 const pool:any[]=[]
 const add=(key:string,label:string,input:string)=>pool.push({key,label,input})

 const open=visibleThreads(w).filter((x:any)=>x.status==='open').sort((a:any,b:any)=>Number(b.pressure)-Number(a.pressure))
 const sceneKey=legalScene(w.current_scene_key||w.location_scene_key||'normandy_open')
 const alive=npcs.filter((n:any)=>n.status!=='死亡')
 const local=alive.filter((n:any)=>n.scene_key===sceneKey&&!n.state?.missing&&n.state?.location_known!==false)
 const survivors=local.filter((n:any)=>n.state?.actor_type==='survivor'&&!n.state?.confirmed_by_player&&Number(n.state?.cover_adaptation||0)<65)
 const movers=local.filter((n:any)=>/帶|移動|撤|尋找|處理|維持|集中|聯絡/.test(n.status||''))
 const nearbyHistorical=local.filter((n:any)=>n.state?.actor_type==='historical')

 for(const route of routes.slice(0,2)){
  const key='route_'+String(route.from_scene_key)+'_'+String(route.to_scene_key)
  add(key,String(route.label||'沿已知路線前進'),'我沿著「'+String(route.label||'已知路線')+'」往前，確認這條路線現在仍可通行。')
 }
 if(b==='approach'){
  add('approach_fire','判斷岸上火力','我盯著艇首外的曳光和彈著，先判斷跳板放下後哪一側最容易被火力封死。')
  add('approach_mercer','問梅瑟集合方式','我靠近梅瑟中士，問清楚下艇後如果隊伍被打散，原本打算在哪裡重新集合。')
  add('approach_people','觀察艇內幾個人','我先記住梅瑟、佛斯特、里德、柯爾和兩名補充兵的位置與狀態。')
  add('approach_survivor','留意兩名補充兵','我不直接質問林蔚和陳墨，只觀察他們對裝備、口令與炮火的反應。')
  add('approach_gear','重新固定裝備','我把步槍、彈藥袋和背帶重新固定，避免一下水就被裝備拖住。')
  add('approach_medic','靠近醫護兵','我先確認佛斯特的急救包和位置，記住如果有人中彈應該往哪裡拖。')
 }else{
  if(open[0]){
   const t:any=open[0]
   if(t.key==='cole_missing')add('thread_cole_search','沿柯爾最後位置找人','我沿著柯爾最後被看見的位置往外找，先確認他是被拖走、自己離開，還是連人帶無線電一起失蹤。')
   else if(String(t.key).startsWith('blood_'))add('thread_blood_cover','處理血裔避光','我先替被轉化的人找能真正遮住直射陽光的位置，再問他現在願不願意跟我走。')
   else if(t.key==='reed_breach')add('thread_breach_check','查看工兵缺口','我靠近里德炸開的缺口，確認那裡現在還能不能通過，以及誰正在利用它。')
   else if(t.key==='aid_station')add('thread_aid_station','去臨時救護點','我往佛斯特所在的臨時救護點移動，看看傷員、物資和人手現在缺的是哪一項。')
   else if(t.key==='radio')add('thread_radio','重新聽無線電','我把無線電調回可辨認的頻道，只聽一小段，確認現在還有哪些單位在呼叫。')
   else add('thread_primary_'+String(t.key),'追查眼前事件','我沿著眼前這件尚未收束的事情繼續追查，先看它現在實際變成了什麼。')
  }

  if(open[1]){
   const t:any=open[1]
   add('thread_secondary_'+String(t.key),'改查另一件事','我暫時放下眼前這件事，改去看「'+t.title+'」現在發展到哪裡。')
  }

  if(movers.length){
   const m=movers[serial%movers.length]
   add('follow_'+m.npc_key,'跟上 '+m.name,'我跟上'+m.name+'，不先叫住他，看看他真正要往哪裡、正在替誰做什麼。')
  }

  if(survivors.length){
   const s=survivors[serial%survivors.length]
   add('probe_'+s.npc_key,'試探 '+s.name,'我找一個不會引起周圍盟軍注意的方式，試探'+s.name+'是不是和我一樣被捲進這裡的人。')
  }

  if(w.radio_known)add('radio_update','更新通訊情報','我再聽一次無線電，只記錄還能確認的方向、單位名稱和命令。')
  if(w.engineer_breach)add('breach_use','利用已打開的缺口','我沿著里德炸開的缺口往前看，判斷現在能不能藉它離開這段暴露區。')

  if(['beach_chaos','breakout'].includes(b)){
   add('beach_move','往更高的掩體移動','我找一條能用障礙物和彈坑分段前進的路，先離開最開闊的水際。')
   add('beach_wounded','救最近的傷兵','我先找最近一個無法自己移動的人，確認傷勢，再決定能不能把他拖到遮蔽後。')
   add('beach_fire','重新判斷火力','我不看剛才的路線，只看現在的彈著、曳光和人群移動，重新判斷哪裡出現了空檔。')
   add('beach_mercer','找梅瑟','我找梅瑟現在的位置，看看他手邊還剩多少人、正在往哪裡帶。')
   add('beach_engineer','看工兵動向','我找里德或其他工兵的位置，看看他們現在處理哪一段障礙。')
  }else if(b==='highground'){
   add('high_move','跟人越過高地','我跟上一組正在往高地另一側移動的盟軍，看看出口後面現在是什麼狀況。')
   add('high_unit','找能確認編制的單位','我沿著盟軍口令和人流去找一支還能說清自己編制與命令的小組。')
   add('high_survivor','找剛才那兩名補充兵','我回想林蔚和陳墨最後出現的方向，試著重新找到其中一個。')
   add('high_pause','先看高地另一側','我不急著下坡，先從遮蔽後觀察高地另一側的樹籬、道路與人員動向。')
  }else{
   add('inland_edge','沿樹籬邊走','我沿樹籬邊緣前進，不直接穿過開口，先判斷下一段農道有沒有人活動。')
   add('inland_contact','找盟軍聯絡','我優先找能確認命令與位置的盟軍單位，而不是只追著槍聲往前。')
   add('inland_people','看看同行的人','我先看目前還跟我有聯繫的人各自在哪裡、誰已經掉隊、誰改變了目標。')
   add('inland_route','換一條農道','我改走另一條有遮蔽的農道，看看會不會接到不同的盟軍小組或村鎮。')
   add('inland_listen','先聽再動','我停在樹籬後分辨槍聲、車輛聲和口令，確認前方更像友軍活動區還是交火區。')
  }

  if(nearbyHistorical.length){
   const h=nearbyHistorical[(serial+1)%nearbyHistorical.length]
   add('talk_'+h.npc_key,'問 '+h.name,'我找機會直接問'+h.name+'現在最缺什麼、最擔心什麼，以及他接下來打算去哪裡。')
  }

  add('wait_ten','觀察十分鐘','我先找好遮蔽，什麼都不介入，觀察十分鐘後再看人群、火力和人物位置怎麼變。')
 }

 // First prefer choices whose semantic key hasn't appeared recently.
 let fresh=pool.filter((x:any)=>!usedKeys.has(x.key)&&!usedKeys.has(choiceSemanticKey(x)))
 if(!fresh.length){
  // If every world-facing direction is recent, rotate them rather than returning no choices.
  // Otherwise the natural fallbacks below fill the remaining slots without mechanically
  // repeating the exact option the player just saw.
  fresh=pool
 }
 const rot=fresh.length?serial%fresh.length:0
 let out=[...fresh.slice(rot),...fresh.slice(0,rot)].slice(0,4)

 // Last-resort choices are still written as natural in-world actions; no timestamps or engine language.
 const fallbacks=[
  {key:'fallback_nearest_person_'+(serial%4),label:'叫住最近的人',input:'我叫住離我最近、還能正常行動的人，先問他剛才看見什麼、準備往哪裡走。'},
  {key:'fallback_cover_'+(serial%4),label:'找更好的位置',input:'我先不追任何人，重新找一個視野和遮蔽都更好的位置，再看下一步。'},
  {key:'fallback_missing_'+(serial%4),label:'找剛消失的人',input:'我回想剛才還在附近、現在卻看不見的人，挑一個方向去確認他發生了什麼。'},
  {key:'fallback_resource_'+(serial%4),label:'檢查能用的東西',input:'我先檢查附近還能使用的武器、醫療、通訊或遮蔽物，看看哪一樣能立刻改變現在的處境。'}
 ]
 for(const f of fallbacks){
  if(out.length>=4)break
  if(!out.some((x:any)=>x.input===f.input))out.push(f)
 }
 return out.slice(0,4)
}

function npcConflictBeat(w:any,npcs:any[],r:number){
 const beats:string[]=[],open=visibleThreads(w).filter((t:any)=>t.status==='open')
 const blood=npcs.filter(n=>n.state?.vampire&&n.status!=='死亡')
 const angry=blood.find(n=>Number(n.trust||0)<20)
 if(angry)beats.push(angry.name+'沒有把轉化當成恩情。他躲在陰影裡，第一次直接問你：「你有沒有想過我根本不想變成這樣？」')
 const confirmed=npcs.filter(n=>n.state?.actor_type==='survivor'&&n.state?.confirmed_by_player)
 if(!beats.length&&confirmed.length>=2&&w.time_min>750)beats.push('已確認的倖存者對下一步沒有相同意見：有人想趁白天還有盟軍掩護找更多資源，有人只想確保活到結算。沒有人先說「背叛」，但分歧已經存在。')
 if(!beats.length&&open.length>=3&&r%3===0)beats.push('你現在同時牽動了「'+(open[0] as any).title+'」與「'+(open[1] as any).title+'」。時間沒有替你把其中一件暫停。')
 return beats.slice(0,1)
}

const OPENROUTER_ENDPOINT='https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_DIRECTOR_MODEL='qwen/qwen3.8-27b:free'
const OPENROUTER_NARRATOR_MODEL='qwen/qwen3.8-27b:free'
let AI_KEY_CACHE:string|null=null
let AI_KEY_CACHE_AT=0

async function getAIKey(){
 const now=Date.now()
 if(AI_KEY_CACHE!==null&&now-AI_KEY_CACHE_AT<60000)return AI_KEY_CACHE
 const {data,error}=await db.rpc('game_ai_secret_get',{p_name:'GAME_OPENROUTER_API_KEY'})
 AI_KEY_CACHE_AT=now
 AI_KEY_CACHE=!error&&typeof data==='string'&&data.length>10?data:''
 return AI_KEY_CACHE
}

async function openRouterChat(key:string,body:any){
 const format=body?.text?.format
 const rr=await fetch(OPENROUTER_ENDPOINT,{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json','http-referer':'https://github.com/Lan-uxc/RPG','x-title':'RPG'},body:JSON.stringify({model:body.model,messages:body.input,response_format:format?{type:'json_schema',json_schema:{name:format.name,strict:true,schema:format.schema}}:undefined,max_tokens:body.max_output_tokens||1200})})
 const data=await rr.json().catch(()=>({}))
 if(!rr.ok){console.error('OpenRouter response error',rr.status,data?.error?.message||'unknown');return null}
 const text=data?.choices?.[0]?.message?.content
 const raw=typeof text==='string'?text:Array.isArray(text)?text.map((x:any)=>x?.text||'').join(''):''
 try{return raw?JSON.parse(raw):null}catch{return null}
}

function compactNpc(n:any){
 return{
  key:n.npc_key,name:n.name,status:n.status,trust:n.trust,tension:n.tension,
  scene:n.scene_key,actor_type:n.state?.actor_type,goal:n.state?.goal,
  fear:n.state?.fear,bottom_line:n.state?.bottom_line,
  vampire:!!n.state?.vampire,confirmed_survivor:!!n.state?.confirmed_by_player,
  cover_adaptation:n.state?.cover_adaptation
 }
}


async function openAIResponse(key:string,body:any){
 const rr=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',
  headers:{'authorization':'Bearer '+key,'content-type':'application/json'},
  body:JSON.stringify(body)
 })
 const data=await rr.json().catch(()=>({}))
 if(!rr.ok){
  console.error('OpenAI response error',rr.status,data?.error?.message||'unknown')
  return null
 }
 const txt=responseText(data)
 if(!txt)return null
 try{return JSON.parse(txt)}catch{return null}
}

async function runDirectorAgent(args:{
 input:string,kind:string,w:any,npcs:any[],recent:any[],facts:string[],short:string,status:string
}){
 const key=await getAIKey()
 if(!key)return null
 const schema={
  type:'object',additionalProperties:false,
  required:['scene_goal','dramatic_pressure','pressure_source','npc_actions','new_observable_information','consequences_to_emphasize','must_preserve','must_not_invent','choice_axes','pacing','continuity_note'],
  properties:{
   scene_goal:{type:'string'},
   dramatic_pressure:{type:'string'},
   pressure_source:{type:'string'},
   npc_actions:{type:'array',minItems:0,maxItems:4,items:{type:'object',additionalProperties:false,required:['npc_key','action'],properties:{npc_key:{type:'string'},action:{type:'string'}}}},
   new_observable_information:{type:'array',items:{type:'string'}},
   consequences_to_emphasize:{type:'array',items:{type:'string'}},
   must_preserve:{type:'array',items:{type:'string'}},
   must_not_invent:{type:'array',items:{type:'string'}},
   choice_axes:{type:'array',minItems:4,maxItems:4,items:{type:'string'}},
   pacing:{type:'string',enum:['quiet','tense','urgent','combat','aftermath']},
   continuity_note:{type:'string'}
  }
 }
 const context={
  player_input:args.input,
  intent:args.kind,
  time:args.w.time,
  current_scene_key:args.w.current_scene_key||'',
  location:args.w.location,
  visible_npcs:args.npcs.filter((n:any)=>n.scene_key===(args.w.current_scene_key||'')&&!n.state?.missing&&n.state?.location_known!==false).map(compactNpc),
  world_phase:worldBand(args.w.time_min),
  objective:args.w.objective,
  danger:args.w.danger,
  deterministic_facts:args.facts,
  deterministic_result:args.short,
  active_threads:visibleThreads(args.w),
  player:{name:args.w.player?.name,ability:args.w.player?.ability,converted:args.w.converted||[]},
  npcs:args.npcs.map(compactNpc),
  recent_turns:(args.recent||[]).slice(0,6).map((t:any)=>({
   input:t.player_input,narrative:String(t.narrative||'').slice(0,1000)
  })),
  prior_director_note:args.w.ai_director_note||'',
  session_status:args.status
 }
 const developer=[
  '你是原創無限流歷史 RPG 的 Director Agent。',
  '你只負責分析「下一個小說場景應該如何自然成立」，不要寫小說正文。',
  '規則引擎提供的 deterministic_facts / deterministic_result 是硬事實，不能修改；database/world state 次之，Director 只能在其上規劃。',
  'npc_actions 僅能使用 context.npcs 中既有 npc_key；依 goal、fear、bottom_line、resource、trust、tension、scene_key、status 做 0～4 個合理主動行動。不得瞬移、跨場景直接互動、讀心、擅自死亡、背叛或自動服從。',
  'new_observable_information 只能是有限視角下玩家目前可見、可聽、可合理推斷的線索，不能宣布敵軍計畫、真身、未確認死亡、未發現道路或未來事件。',
  'must_preserve 必列 deterministic 結果、時間、位置、傷勢、NPC 既有狀態與 open threads；must_not_invent 必列不可新增的人物、道路、場景、物品、死亡、瞬間結案。',
  '不要替玩家做尚未輸入的重大選擇，不要為戲劇性強制背叛，也不要把 open thread 或故事拉回預設劇情。',
  'choice_axes 固定給四個彼此不同且當下可行的方向：人物、移動／位置、情報／觀察、資源／救援／戰術；需符合 route 與 scene。',
  'pacing 只能是 quiet、tense、urgent、combat、aftermath。continuity_note 是下一回合短備忘，不得把尚未發生的事寫成既定事實。'
 ].join('\n')
 return await openRouterChat(key,{
  model:OPENROUTER_DIRECTOR_MODEL,
  reasoning:{effort:'high'},
  store:false,
  max_output_tokens:1200,
  input:[
   {role:'developer',content:developer},
   {role:'user',content:JSON.stringify(context)}
  ],
  text:{verbosity:'low',format:{type:'json_schema',name:'director_plan',strict:true,schema}}
 })
}

async function runNarratorAgent(args:{
 input:string,kind:string,w:any,npcs:any[],recent:any[],facts:string[],short:string,
 fallbackChoices:any[],status:string,director:any
}){
 const key=await getAIKey()
 if(!key)return null
 const forbidden=[
  ...(args.w.choice_history||[]).slice(-20),
  ...(args.w.offered_choices||[]).map((x:any)=>x.input)
 ].filter(Boolean)
 const context={
  player_input:args.input,
  intent:args.kind,
  time:args.w.time,
  current_scene_key:args.w.current_scene_key||'',
  location:args.w.location,
  state_delta:args.facts,
  visible_npcs:args.npcs.filter((n:any)=>n.scene_key===(args.w.current_scene_key||'')&&!n.state?.missing&&n.state?.location_known!==false).map(compactNpc),
  world_phase:worldBand(args.w.time_min),
  objective:args.w.objective,
  danger:args.w.danger,
  deterministic_facts:args.facts,
  deterministic_result:args.short,
  director_plan:args.director,
  active_threads:visibleThreads(args.w),
  player:{name:args.w.player?.name,ability:args.w.player?.ability,converted:args.w.converted||[]},
  npcs:args.npcs.map(compactNpc),
  recent_turns:(args.recent||[]).slice(0,6).map((t:any)=>({
   input:t.player_input,narrative:String(t.narrative||'').slice(0,1100)
  })),
  forbidden_choice_text:forbidden,
  fallback_choice_ideas:args.fallbackChoices.map((x:any)=>({label:x.label,input:x.input})),
  session_status:args.status
 }
 const schema={
  type:'object',additionalProperties:false,required:['narrative','choices'],
  properties:{
   narrative:{type:'string'},
   scene_summary:{type:'string'},
   mission_updates:{type:'array',items:{type:'string'}},
   choices:{
    type:'array',minItems:4,maxItems:4,
    items:{
     type:'object',additionalProperties:false,required:['label','input'],
     properties:{label:{type:'string'},input:{type:'string'}}
    }
   }
  }
 }
 const developer=[
  '你是原創無限流 RPG 的 Narrator Agent，使用繁體中文寫小說。',
  '事實優先順序不可倒置：1 deterministic engine facts，2 database/world state，3 Director plan，4 你的文學表現。高層不得推翻低層。deterministic_result 只能轉化後果，不能原句貼入正文。',
  '你的任務不是回報遊戲結果，而是把這一回合寫成能接在上一頁後面直接閱讀的小說場景。',
  '',
  '正文規則：',
  '1. 不要重複玩家輸入；禁止「你採取的行動是」「判定成功」「判定失敗」「系統不允許」「根據規則」「上一回合」「任務觸發」「事件線推進」「玩家選擇了」等引擎語言。',
  '2. 必須自然呈現行動過程、環境反應、人物反應／對話、可觀察新資訊、真實後果，以及下一個正在形成的問題。',
  '3. 開場約 700～1200 個中文字；一般回合約 450～900 字；只有純確認或極小動作才可為 250～450 字。',
  '4. 不要刻意把每回合寫成同樣長；依戲劇重量決定篇幅。',
  '5. 有限視角。不可透露玩家看不到的敵軍計畫、遠端 NPC 心理、未發現道路、NPC 真正身分、未確認死亡或未發生未來；只能透過當前可見、聲音、通訊、他人轉述或 thread 線索呈現。',
  '6. NPC 不是固定站點。同場景才可直接對話、碰觸、協助或衝突；遠端 NPC 只能間接影響。不得違反 scene_key、位置、傷勢與既定狀態。',
  '7. 歷史 NPC 不會推斷異時空；血裔不自動忠誠；倖存者辨識沒有超自然標記。',
  '8. 避免 recent_turns 已用過的開頭、結尾、環境句與比喻。',
  '9. 失敗也要留下新位置、新情報、人物反應、失去機會或成本，不能把場景重置。',
  '10. 不替玩家做尚未輸入的重大決策。',
  '',
  '選項規則：',
  '1. 產生四個全新的、具體、當下可執行的角色行動。',
  '2. 四個方向必須明顯不同，並盡量對應 Director 的 choice_axes。',
  '3. 禁止「人物線」「劇情」「上一回合」「改變策略」「追新事件」等編劇語言。',
  '4. 禁止重複 forbidden_choice_text，也不要只做同義改寫。',
  '5. 選項不是成功保證，只是角色可以嘗試的行動。'
 ].join('\n')
 const parsed=await openRouterChat(key,{
  model:OPENROUTER_NARRATOR_MODEL,
  reasoning:{effort:'high'},
  store:false,
  max_output_tokens:3000,
  input:[
   {role:'developer',content:developer},
   {role:'user',content:JSON.stringify(context)}
  ],
  text:{verbosity:'medium',format:{type:'json_schema',name:'novel_turn',strict:true,schema}}
 })
 if(!parsed?.narrative)return null
 let normalized:any[]=[]
 if(Array.isArray(parsed.choices)&&parsed.choices.length===4){
  const candidate=parsed.choices.map((x:any,i:number)=>({
   key:'sol_'+String(args.w.choice_serial||0)+'_'+String(i)+'_'+String(hash(String(x.input||''))%100000),
   label:String(x.label||'行動').slice(0,24),
   input:String(x.input||'').slice(0,320)
  }))
  const semantic=new Set(candidate.map((x:any)=>choiceSemanticKey(x))),axes=new Set(candidate.map((x:any)=>actionKind(x.input,[],args.w.player?.ability)))
  if(!candidate.some((x:any)=>!x.input)&&!(semantic.size<4||axes.size<3))normalized=candidate
 }
 return{narrative:String(parsed.narrative).trim(),choices:normalized,scene_summary:String(parsed.scene_summary||'').slice(0,360),mission_updates:Array.isArray(parsed.mission_updates)?parsed.mission_updates.map((x:any)=>String(x).slice(0,240)).slice(0,4):[],model:OPENROUTER_NARRATOR_MODEL}
}

async function writeAgentRun(sessionId:string|undefined,turnNo:number|undefined,role:string,model:string,reasoning:string,status:string,inputSummary:string,outputSummary:string,metadata:any={}){
 try{
  await db.from('game_agent_runs').insert({
   session_id:sessionId||null,turn_no:turnNo??null,agent_role:role,model,
   reasoning_effort:reasoning,status,input_summary:String(inputSummary||'').slice(0,1000),
   output_summary:String(outputSummary||'').slice(0,1600),metadata,
   completed_at:new Date().toISOString()
  })
 }catch{}
}

function deterministicFallbackNarrative(args:{kind:string,w:any,npcs:any[],facts:string[],short:string,status:string}){
 const local=args.npcs.filter((n:any)=>n.scene_key===args.w.current_scene_key&&!n.state?.missing&&n.state?.location_known!==false)
 const threads=visibleThreads(args.w).filter((t:any)=>t.status==='open')
 const phase:any={move:'你把注意力放在眼前可通行的方向上，先確認掩護與落腳點，再讓身體跟上判定後留下的空間。',follow:'你沒有把距離交給運氣，而是盯住前方留下的動線，隨時準備在局勢改變時停下。',talk:'你把話說出口之前先看清對方的手、呼吸與周圍能聽見的人；此刻每一句話都會留下位置。',search:'你沒有急著替那些痕跡命名，只把能碰到、能辨認、能帶走的細節逐一分開。',stealth:'你壓低身形與聲響，把下一步交給掩護、距離和還沒被驚動的空隙。',combat:'你先處理眼前最迫切的威脅，沒有把任何尚未發生的勝利當成事實。'}
 const process=phase[args.kind]||'你把行動收斂成眼前能承擔的一步，讓世界以已經存在的條件回應。'
 const facts=(args.facts||[]).filter(Boolean).slice(-5).join('　')||args.short
 const npc=local.length?'同一處場景裡，'+local.slice(0,2).map((n:any)=>n.name+'仍在'+String(n.status||'應對局勢')).join('；')+'。他們有自己的目標與限制，沒有任何一人因為你的動作就自動站到你這邊。':'周圍沒有能被確認就在你身邊的人；遠處的動靜只能當成訊號，不能替代親眼看見的事實。'
 const pressure=threads.length?'尚未收束的「'+threads[0].title+'」仍壓在這段時間裡。'+(threads[0].notes?.slice(-1)[0]||'它沒有因為一個動作自動結束。'):'危險度仍在 '+String(args.w.danger??'未知')+'。眼前留下的空間不是安全，只是下一個決定尚未被做出。'
 const continuity='時間、位置、體力、手上的物資與已經發生的後果都沒有被收回。你能依它們再試一次、換一種方法，或承擔放下其中一件事的代價；世界不會替你把局面重置。下一次呼吸之後，能改變局面的仍是你在場、能看見且願意承擔的那一步。'
 return [process,'環境沒有替任何人停下來。'+facts,npc,pressure,continuity].join('\n\n')
}

async function runAgentTurn(args:{
 input:string,kind:string,w:any,npcs:any[],recent:any[],facts:string[],short:string,
 fallbackChoices:any[],status:string,sessionId?:string,turnNo?:number
}){
 const director=await runDirectorAgent(args)
 await writeAgentRun(
  args.sessionId,args.turnNo,'director',OPENROUTER_DIRECTOR_MODEL,'high',
  director?'completed':'fallback',
  args.input,
  director?JSON.stringify(director):'Director unavailable; deterministic rules retained.'
 )
 const narrator=await runNarratorAgent({...args,director})
 await writeAgentRun(
  args.sessionId,args.turnNo,'narrator',OPENROUTER_NARRATOR_MODEL,'high',
  narrator?'completed':'fallback',
  args.short,
  narrator?.narrative||'Narrator unavailable; deterministic narrative used.',
  {choice_count:narrator?.choices?.length||0}
 )
 return{director,narrator}
}

async function payload(s:any){
 const scenarioKey=s.scenario_key||DEFAULT_SCENARIO,sceneKey=s.current_scene_key||'normandy_open'
 const [tr,nr,ir,mr,place,routes]=await Promise.all([
  db.from('game_turns').select('*').eq('session_id',s.id).order('turn_no',{ascending:false}).limit(60),
  db.from('game_npc_states').select('*').eq('session_id',s.id).order('name'),
  db.from('game_inventory').select('*').eq('session_id',s.id).gt('quantity',0),
  db.from('game_memories').select('*').eq('session_id',s.id).order('importance',{ascending:false}).limit(20),
  loadPlace(scenarioKey,sceneKey),
  loadEnabledRoutes(scenarioKey,sceneKey)
 ])
 const w=s.world_state||{},npcs=(nr.data||[]).map(viewNpc)
 return{session:{
  session_code:s.session_code,title:s.title,status:s.status,current_scene_key:sceneKey,
  scene_name:place?.name||locationLabel(w),scene_desc:place?.description||'1944 年 6 月 6 日，奧馬哈灘頭與其內陸正在持續演變。',
  scene_metadata:place?.metadata||{},scene_summary:w.narrative_scene_summary||'',mission_updates:w.narrative_mission_updates||[],turn_no:s.turn_no,hp:s.hp,stamina:s.stamina,focus:s.focus,time:w.time,danger:w.danger,
  objective:w.objective,progress:w.day_progress||0,stage:0,playerName:w.player?.name,ability:w.player?.ability,
  origin:'從盟軍登陸艇中的臨時補充兵開始；立場、忠誠與行動路線不鎖定。',worldBand:worldBand(w.time_min),worldBandLabel:({approach:'登陸前',beach_chaos:'灘頭混亂',breakout:'突破形成',highground:'高地與出口',inland:'樹籬與農道',afternoon:'內陸戰鬥',evening:'傍晚收束'} as any)[worldBand(w.time_min)]||worldBand(w.time_min),threads:visibleThreads(w)
 },turns:tr.data||[],npcs,inventory:ir.data||[],memories:mr.data||[],choices:(Array.isArray(w.offered_choices)&&w.offered_choices.length===4)?w.offered_choices:freshChoices({...w,current_scene_key:sceneKey},nr.data||[],routes),aiConfigured:!!(await getAIKey()),agentModels:{director:'OpenRouter / '+OPENROUTER_DIRECTOR_MODEL,narrator:'OpenRouter / '+OPENROUTER_NARRATOR_MODEL,coding:'Codex CLI + ChatGPT 登入（Samsung/Hermes）',art:'GPT-Image-2'}}
}

async function fresh(playerName:any){
 const name=cleanShort(playerName,60)||'無名者',ab=abilityFor(name),c=code(),t=token()
 const scenarioKey=DEFAULT_SCENARIO,scenario=await loadScenario(scenarioKey),startScene=scenario?.start_scene_key||'normandy_open'
 const w:any={
  time_min:387,time:'06:27',danger:76,day_progress:0,current_scene_key:startScene,
  location:'奧馬哈海灘外海・Easy Red 前方登陸艇',
  objective:'最低條件只有活過今天。你要救誰、跟誰走、拿什麼、相信誰、是否服從命令，都由實際行動決定。',
  player:{name,ability:ab,placement:'allied_landing',alignment_locked:false},
  timeline_seen:[],choice_history:[],choice_key_history:[],choice_serial:0,offered_choices:[],threads:{},
  converted:[],engineer_breach:false,radio_known:false
 }
 const {data:s,error}=await db.from('game_sessions').insert({
  session_code:c,access_token_hash:await sha(t),title:'歷史沙盒 II：諾曼第 1944',scenario_key:scenarioKey,current_scene_key:startScene,world_state:w
 }).select('*').single()
 if(error)throw error
 await Promise.all([
  db.from('game_npc_states').insert([
   {session_id:s.id,npc_key:'mercer',name:'丹尼爾・梅瑟中士',scene_key:startScene,disposition:52,trust:24,tension:58,status:'確認登陸後集合方式',state:{actor_type:'historical',role:'班長',goal:'盡可能維持附近盟軍的組織',fear:'在灘頭失去全部指揮與人員',bottom_line:'不會故意把傷兵當誘餌',resource:'幾名願意聽他命令的士兵',alive:true}},
   {session_id:s.id,npc_key:'foster',name:'伊萊・佛斯特醫護兵',scene_key:startScene,disposition:58,trust:20,tension:64,status:'檢查急救包與艇內暈船士兵',state:{actor_type:'historical',role:'醫護兵',goal:'救治仍有機會活下來的人',fear:'醫療物資耗盡',bottom_line:'不接受為了方便而放棄明顯可救的人',resource:'有限急救物資',alive:true}},
   {session_id:s.id,npc_key:'reed',name:'湯瑪斯・里德工兵',scene_key:startScene,disposition:47,trust:16,tension:69,status:'保護爆破器材',state:{actor_type:'historical',role:'工兵',goal:'在灘頭建立可通行缺口',fear:'炸藥在抵達障礙前損失',bottom_line:'不會在人群仍貼著障礙時起爆',resource:'爆破器材',alive:true}},
   {session_id:s.id,npc_key:'cole',name:'約瑟夫・柯爾通訊兵',scene_key:startScene,disposition:50,trust:14,tension:63,status:'保護 SCR-300 無線電',state:{actor_type:'historical',role:'通訊兵',goal:'維持有限通訊',alive:true}},
   {session_id:s.id,npc_key:'linwei',name:'林蔚',scene_key:startScene,disposition:45,trust:8,tension:54,status:'沉默地觀察艇內其他人',state:{actor_type:'survivor',role:'補充兵',goal:'確認規則並活下來',alive:true,confirmed_by_player:false,cover_adaptation:16}},
   {session_id:s.id,npc_key:'chenmo',name:'陳墨',scene_key:startScene,disposition:43,trust:7,tension:48,status:'反覆檢查不熟悉的裝備',state:{actor_type:'survivor',role:'補充兵',goal:'不先暴露身分',alive:true,confirmed_by_player:false,cover_adaptation:21}}
  ]),
  db.from('game_inventory').insert([
   {session_id:s.id,item_key:'m1',name:'M1 Garand 步槍',quantity:1,description:'標準步槍。'},
   {session_id:s.id,item_key:'ammo',name:'步槍彈藥',quantity:8,description:'有限彈夾。'},
   {session_id:s.id,item_key:'aid',name:'個人急救包',quantity:1,description:'可做初步止血。'}
  ]),
  db.from('game_memories').insert([
   {session_id:s.id,scope:'player',subject_key:'rule',content:'你從盟軍登陸艇開始，但系統不鎖定政治立場、服從關係或行動路線；歷史人物也不會因口音、服裝或緊張方式推斷你來自不同時空。',importance:10,tags:['規則']},
   {session_id:s.id,scope:'player',subject_key:'ability',content:'先天能力「'+ab.name+'」：'+ab.summary+' 條件：'+ab.activation+' 限制：'+ab.limit+' 代價：'+ab.cost,importance:10,tags:['能力']}
  ])
 ])
 const {data:npcs=[]}=await db.from('game_npc_states').select('*').eq('session_id',s.id)
 const routes=await loadEnabledRoutes(scenarioKey,startScene)
 w.offered_choices=freshChoices(w,npcs,routes)
 rememberChoiceKeys(w,w.offered_choices)
 await db.from('game_sessions').update({world_state:w}).eq('id',s.id)
 const n=
 '1944 年 6 月 6 日，06:27。\n\n'+
 '登陸艇每撞上一個浪頭，艇內的人就一起往某個方向傾。有人吐在靴邊，有人一直摸彈藥袋，也有人閉著眼，像是在心裡重複某個步驟。\n\n'+
 name+'站在這群盟軍士兵之間。制服、武器和識別牌都能讓你暫時不顯眼，但這不代表你必須成為任何人希望你成為的人。\n\n'+
 (ab.id==='progenitor_vampire'
  ?'你唯一確定的是自己的身體。你是第一代吸血鬼；晨光對你沒有影響，而由你轉化出的血裔沒有這項豁免。\n\n'
  :'你仍能感覺到那項不屬於普通人的能力——'+ab.name+'。\n\n')+
 '梅瑟中士正確認跳板落下後的集合方式。佛斯特醫護兵把急救包重新扣緊。里德工兵抱著爆破器材，柯爾的無線電背帶繞在肩上。\n\n'+
 '另外兩名補充兵比較奇怪。林蔚一直看別人的手腕；陳墨穿裝備的順序不像受過同一套訓練。但這些都只是線索，不是證明。\n\n'+
 '岸上的炮火聲越來越近。\n\n'+
 '沒有人知道你接下來會做什麼。'
 await db.from('game_turns').insert({session_id:s.id,turn_no:0,player_input:'（開始）',intent:'opening',resolution:{shortResult:'登陸艇距離 H-Hour 只剩幾分鐘。'},narrative:n,scene_key:startScene})
 return{accessToken:t,state:await payload({...s,world_state:w})}
}

async function act(s:any,input0:string,tags0:any[]){
 const input=cleanAction(input0);if(!input)throw Error('請輸入行動')
 const tags=normalizedTags(tags0)
 const [{data:npcs=[]},{data:recent=[]}]=await Promise.all([
  db.from('game_npc_states').select('*').eq('session_id',s.id),
  db.from('game_turns').select('turn_no,player_input,narrative').eq('session_id',s.id).order('turn_no',{ascending:false}).limit(6)
 ])
 const w:any={...(s.world_state||{})}
 const oldChoices=w.offered_choices||[]
 w.choice_history=uniq([...(w.choice_history||[]),...oldChoices.map((x:any)=>x.input)]).slice(-100)
 w.offered_choices=[]
 const kind=actionKind(input,tags,w.player?.ability),r=roll(s.id+'|'+String(s.turn_no+1)+'|'+input)
 w.current_turn=s.turn_no+1
 const movement=(kind==='move'||kind==='follow')?await resolveRoute(s,input):null
 const mins=movement?.route?Number(movement.route.travel_minutes):actionMinutes(kind,input,tags)
 const from=Number(w.time_min||387),to=Math.min(1260,from+mins)
 const result=await resolveAction(s,w,npcs,input,kind,r,tags,movement)
 w.current_scene_key=sceneAfterMovement(s,movement)
 const notes:string[]=[...result.paragraphs]
 notes.push(...historicalEvents(w,from,to))
 await tickNpcs(w,npcs,from,to,notes)
 settleCoreThreads(w,input,kind,r,notes)
 w.time_min=to;w.time=fmt(to);w.danger=result.danger
 w.day_progress=clamp(((to-387)/(1260-387))*100)
 const{data:freshForStory=[]}=await db.from('game_npc_states').select('*').eq('session_id',s.id)
 notes.push(...npcConflictBeat(w,freshForStory,r))
 notes.push(...storyTexture(w,freshForStory,kind,r))

 let status=s.status
 if(result.hp<=0)status='failed'
 if(to>=1260&&status==='active'){
  status='completed'
  const open=visibleThreads(w).filter((x:any)=>x.status==='open'),blood=freshForStory.filter((n:any)=>n.state?.vampire),confirmed=freshForStory.filter((n:any)=>n.state?.actor_type==='survivor'&&n.state?.confirmed_by_player)
  notes.push('21:00。第一日沒有因為你抵達某個指定格子而結束；只是時間終於走到可以結算的地方。')
  notes.push('你最後所在位置：'+w.location+'。')
  if(confirmed.length)notes.push('你真正互相確認過的其他倖存者：'+confirmed.map((n:any)=>n.name).join('、')+'。')
  if(blood.length)notes.push('由你造成的血裔仍存在：'+blood.map((n:any)=>n.name).join('、')+'。他們的自由意志、關係與日照弱點都沒有在結算時消失。')
  if(open.length)notes.push('仍未收束的事件：'+open.map((x:any)=>x.title).join('、')+'。它們會成為之後的歷史與人物記憶，而不是被刪除。')
  notes.push('這一天真正留下來的，不只是你有沒有活著，而是你改變了誰、欠了誰、錯過了什麼，以及哪些人決定還要不要跟你走。')
  result.short='第一日抵達結算時間，人物與事件後果保留下來。'
 }
 const {data:freshNpcs=[]}=await db.from('game_npc_states').select('*').eq('session_id',s.id)
 const currentRoutes=await loadEnabledRoutes(s.scenario_key||DEFAULT_SCENARIO,w.current_scene_key)
 w.choice_serial=Number(w.choice_serial||0)+1
 const fallbackChoices=status==='active'?freshChoices(w,freshNpcs,currentRoutes):[]
 const agents=await runAgentTurn({
  input,kind,w,npcs:freshNpcs,recent:recent||[],facts:notes,short:result.short,
  fallbackChoices,status,sessionId:s.id,turnNo:s.turn_no+1
 })
 const narrative=agents.narrator?.narrative||deterministicFallbackNarrative({kind,w,npcs:freshNpcs,facts:notes,short:result.short,status})
 if(agents.director?.continuity_note)w.ai_director_note=String(agents.director.continuity_note).slice(0,500)
 if(agents.narrator?.scene_summary)w.narrative_scene_summary=agents.narrator.scene_summary
 if(agents.narrator?.mission_updates?.length)w.narrative_mission_updates=agents.narrator.mission_updates
 w.offered_choices=status==='active'?(agents.narrator?.choices||fallbackChoices):[]
 rememberChoiceKeys(w,w.offered_choices)
 const next=s.turn_no+1
 const res={intent:kind,outcome:status==='failed'?'failure':'resolved',roll:r,tags:Array.isArray(tags)?tags.slice(0,3):[],shortResult:result.short,timeCost:mins,worldBand:worldBand(to),aiUsed:!!agents.narrator,aiModel:agents.narrator?.model||null,directorUsed:!!agents.director}
 const {data:u,error}=await db.from('game_sessions').update({
  turn_no:next,hp:result.hp,stamina:result.st,focus:result.fo,status,current_scene_key:sceneAfterMovement(s,movement),world_state:w,
  summary:((s.summary||'')+' '+next+'：'+input.slice(0,55)+' → '+result.short).slice(-2500),
  updated_at:new Date().toISOString(),last_played_at:new Date().toISOString()
 }).eq('id',s.id).select('*').single()
 if(error)throw error
 await db.from('game_turns').insert({session_id:s.id,turn_no:next,player_input:input,intent:kind,resolution:res,narrative,scene_key:u.current_scene_key})
 await syncThreads(s.id,w,next)
 if(result.importance>=7)await db.from('game_memories').insert({session_id:s.id,scope:'world',subject_key:'normandy',content:result.short,importance:result.importance,tags:[kind]})
 return payload(u)
}

Deno.serve(async req=>{
 try{
  if(req.method==='OPTIONS')return new Response('ok',{headers:H})
  if(req.method==='GET')return J({ok:true,service:'normandy-story-sandbox',apiVersion:1,engine:'rpg-world-graph',message:'API online'})
  if(req.method!=='POST')return J({error:'method'},405)
  const b=await req.json().catch(()=>({}))
  if(b.op==='new')return J(await fresh(b.playerName))
  const s=await auth(String(b.sessionCode||''),String(b.accessToken||''))
  if(!s)return J({error:'Session 驗證失敗'},401)
  if(b.op==='load')return J({state:await payload(s)})
  if(b.op==='act')return J({state:await act(s,String(b.input||''),b.tags||[])})
  return J({error:'unknown'},400)
 }catch(e){console.error(e);return J({error:String(e?.message||e)},500)}
})
