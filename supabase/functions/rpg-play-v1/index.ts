import { createClient } from 'npm:@supabase/supabase-js@2'
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}})
const headers={'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'}
const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}})
async function digest(s:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const places:any={
 harbor:{name:'霧港碼頭',text:'鹹濕的霧沿著舊碼頭的木樁游走。遠處的燈塔時明時滅，巡夜人正尋找一艘失蹤的補給船。',routes:['market','tower']},
 market:{name:'舊城集市',text:'店家早早拉下鐵門，空氣裡還殘留藥草與焦油的味道。醫師芮安獨自整理散落的藥箱。',routes:['harbor','archive']},
 tower:{name:'黑潮燈塔',text:'潮浪敲打礁石。燈塔的舊機件因生鏽而停止，塔頂的訊號鏡仍指向北方海域。',routes:['harbor','archive']},
 archive:{name:'封存資料庫',text:'潮濕的資料室擺滿船舶紀錄，厚重鐵櫃上留下最近被打開的痕跡。',routes:['market','tower','shelter']},
 shelter:{name:'潮影避難所',text:'島民聚集在地下防空室，物資逐漸短缺。失蹤船隻的航線標記貼在牆面上。',routes:['archive']}
}
const labels:any={harbor:'返回碼頭',market:'前往集市',tower:'調查燈塔',archive:'前往資料庫',shelter:'前往避難所'}
const choices=(s:any)=>[...places[s.location].routes.map((id:string)=>({text:labels[id],action:'前往'+places[id].name})),{text:'搜索當前區域',action:'仔細觀察並搜索附近的線索'},{text:'詢問在場人物',action:'詢問附近的人有沒有新情報'}].slice(0,4)
const view=(session:any,turns:any[])=>({session:{id:session.id,player_name:session.player_name,turn_no:session.turn_no,...session.state,place:places[session.state.location]?.name},current:turns[0]||null,history:turns.map((t:any)=>({turn_no:t.turn_no,intent:t.intent,narrative:t.narrative})),choices:choices(session.state)})
async function load(id:string,key:string){if(!id||!key)return null;const {data}=await db.from('rpg_play_sessions').select('*').eq('id',id).eq('access_hash',await digest(key)).maybeSingle();return data}
async function getView(s:any){const {data,error}=await db.from('rpg_play_turns').select('turn_no,intent,narrative').eq('session_id',s.id).order('turn_no',{ascending:false}).limit(30);if(error)throw error;return view(s,data||[])}
function normalize(input:string){return input.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,300)}
function resolve(s:any,input:string){const state={...s.state,visited:[...s.state.visited],clues:[...s.state.clues],relations:{...s.state.relations}};const before=JSON.stringify(state);let type='自由行動',result='';let dest:string|undefined
 for(const [id,p] of Object.entries(places) as any){if((input.includes(p.name)||input.includes(labels[id]))&&/前往|去|移動|走|返回|抵達|進入/.test(input)){dest=id;break}}
 if(dest){type='移動';if(places[state.location].routes.includes(dest)){state.location=dest;if(!state.visited.includes(dest))state.visited.push(dest);result='你循著可通行的路線，抵達'+places[dest].name+'。'+places[dest].text}else result='你試著前往那裡，但目前沒有已知的直接通道。你可以先尋找路線或取得情報。'}
 else if(/搜索|調查|觀察|查看|檢查|探索|尋找|仔細看/.test(input)){type='調查';const clue='線索：'+places[state.location].name+'的異常';if(!state.clues.includes(clue)){state.clues.push(clue);result='你沒有急著離開，而是檢查現場留下的痕跡。你發現新的可追蹤情報：'+clue+'。'}else result='你重新勘查既有痕跡，確認先前的線索仍然成立，但沒有憑空出現新的物證。'}
 else if(/詢問|交談|說服|打聽|問|告訴|聊天/.test(input)){type='對話';state.relations.芮安=Math.min(5,(state.relations.芮安||0)+1);result='你向附近的人打聽。對方先是警戒，聽完你的問題後，才透露補給船失蹤前有人在夜間修改了航線紀錄。芮安開始願意交換情報。'}
 else if(/休息|等待|睡/.test(input)){type='休息';result='你在安全處短暫休息。霧沒有散去，時間卻仍然向前流動。'}
 else if(/攻擊|射擊|殺|傷害/.test(input)&&!/不(?:要|會|主動)?攻擊|不殺/.test(input)){type='衝突';result='你做出帶有敵意的動作。附近的人立刻退後，守衛注意到了這場騷動。行動造成了警戒，並非所有威脅都能一次解決。';state.danger=Math.min(100,state.danger+15)}
 else{type='嘗試';result='你嘗試採取自己的方法：「'+input.slice(0,70)+'」。周圍的人與環境不會自動配合；你觀察到'+places[state.location].name+'的局勢仍在變化。若想產生具體成果，可進一步指出對象與做法。'}
 state.minutes+=type==='移動'?20:type==='休息'?30:10
 if(state.minutes>=720)state.danger=Math.min(100,state.danger+5)
 state.turn=s.turn_no+1
 const narrative='【'+places[state.location].name+'】\n\n'+result+'\n\n'+places[state.location].text+'\n\n你仍可自由決定下一步；所有已確認的線索與路線會保存於這次副本。'
 return {state,type,narrative,delta:{location:state.location,minutes:state.minutes,clues:state.clues.length,danger:state.danger,changed:before!==JSON.stringify(state)}}
}
Deno.serve(async req=>{
try{
 if(req.method==='OPTIONS')return new Response('',{headers})
 if(req.method==='GET'){const url=new URL(req.url);if(url.searchParams.has('health'))return json({ok:true,service:'rpg-play-v1'});return new Response(await Deno.readTextFile(new URL('./index.html',import.meta.url)),{headers:{...headers,'content-type':'text/html; charset=utf-8'}})}
 if(req.method!=='POST')return json({error:'method'},405)
 const b=await req.json().catch(()=>({}))
 if(b.op==='new'){
  const name=normalize(String(b.name||'' )).slice(0,24);if(!name)return json({error:'請輸入角色名稱'},400)
  const key=crypto.randomUUID()+crypto.randomUUID()
  const state={location:'harbor',minutes:0,danger:0,turn:0,visited:['harbor'],clues:[],relations:{芮安:0}}
  const {data:s,error}=await db.from('rpg_play_sessions').insert({player_name:name,access_hash:await digest(key),state}).select('*').single();if(error)throw error
  const narrative='【霧港碼頭】\n\n'+places.harbor.text+'\n\n主線目標：查明失蹤補給船的去向。三天後大潮來臨；在此之前，你可以探索、交談、搜索或採取自己的方法。'
  const {error:e}=await db.from('rpg_play_turns').insert({session_id:s.id,turn_no:0,intent:'開始',action_type:'opening',narrative});if(e)throw e
  return json({key,state:await getView(s)})
 }
 const s=await load(String(b.id||''),String(b.key||''));if(!s)return json({error:'存檔驗證失敗'},401)
 if(b.op==='load')return json({state:await getView(s)})
 if(b.op==='act'){
  if(!Number.isSafeInteger(b.expectedTurn)||b.expectedTurn!==s.turn_no)return json({error:'回合已更新，請重新整理確認結果',code:'STALE_TURN'},409)
  const input=normalize(String(b.input||''));if(!input)return json({error:'請輸入行動'},400)
  const {state,type,narrative,delta}=resolve(s,input)
  const {data:updated,error}=await db.from('rpg_play_sessions').update({state,turn_no:s.turn_no+1,updated_at:new Date().toISOString()}).eq('id',s.id).eq('turn_no',s.turn_no).select('*').maybeSingle()
  if(error)throw error
  if(!updated)return json({error:'已有其他回合寫入，請重新讀取',code:'STALE_TURN'},409)
  const {error:te}=await db.from('rpg_play_turns').insert({session_id:s.id,turn_no:updated.turn_no,intent:input,action_type:type,narrative,state_delta:delta});if(te)throw te
  return json({state:await getView(updated)})
 }
 return json({error:'未知操作'},400)
}catch(e){return json({error:String((e as Error).message||e)},500)}
})
