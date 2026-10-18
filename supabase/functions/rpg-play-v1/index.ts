const PAGE="<!doctype html><html lang=\"zh-Hant\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>霧港試煉｜文字 RPG</title><style>\n*{box-sizing:border-box}body{margin:0;background:#11151d;color:#f2ede2;font:16px/1.7 system-ui,\"Noto Sans TC\",sans-serif}main{max-width:750px;margin:auto;padding:18px 16px 140px}h1{font-size:24px}.muted{color:#b5bfd0;font-size:13px}.box{background:#1d2532;border:1px solid #364358;border-radius:12px;padding:16px;margin:13px 0}.story{white-space:pre-wrap;font:17px/2.05 \"Noto Serif TC\",serif}button,input,textarea{font:inherit;border:1px solid #536079;background:#263247;color:#fff;border-radius:9px;padding:11px}button{cursor:pointer}button:disabled{opacity:.5}input,textarea{width:100%}.gold{background:#e1c78a;color:#141820;font-weight:bold}.options{display:grid;grid-template-columns:1fr 1fr;gap:8px}.options button{text-align:left}.composer{position:sticky;bottom:0;background:#11151d;padding:12px 0;display:flex;gap:8px}textarea{min-height:68px;flex:1;resize:vertical;min-width:0}.hide{display:none}.history{padding:12px 0;border-top:1px solid #455167}summary{cursor:pointer}@media(max-width:500px){.options{grid-template-columns:1fr}}</style>\n<main><h1>霧港試煉</h1><p class=\"muted\">原創單人開放式文字 RPG｜獨立存檔｜自由行動</p><section id=\"welcome\" class=\"box\"><h2>建立角色</h2><input id=\"name\" maxlength=\"24\" placeholder=\"輸入角色名稱\"><p><button class=\"gold\" id=\"start\">開始試煉</button></p></section><section id=\"game\" class=\"hide\"><div class=\"box\"><strong id=\"stats\"></strong><div id=\"meta\" class=\"muted\"></div></div><div class=\"box\"><h2 id=\"place\"></h2><div id=\"story\" class=\"story\"></div></div><div class=\"box\"><h2>建議選項（也可自由輸入）</h2><div id=\"options\" class=\"options\"></div></div><div class=\"box\"><details><summary>探索、人物與線索</summary><p id=\"world\"></p></details><details><summary>歷史回合</summary><div id=\"history\"></div></details></div><div class=\"composer\"><textarea id=\"input\" maxlength=\"300\" placeholder=\"輸入你想做的事，例如：我先檢查附近有沒有可疑痕跡。\"></textarea><button class=\"gold\" id=\"send\">執行</button></div><div class=\"muted\" id=\"status\"></div></section></main><script>\nconst g=x=>document.getElementById(x);let S=null,pending=false;const saved=()=>JSON.parse(localStorage.getItem('fog-rpg-play')||'null');async function api(p){let r=await fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)}),j=await r.json();if(!r.ok)throw Error(j.error||'請求失敗');return j}\nfunction busy(x){pending=x;g('start').disabled=x;g('send').disabled=x;g('status').textContent=x?'正在處理這次行動…':''}\nfunction render(){if(!S)return;g('welcome').classList.add('hide');g('game').classList.remove('hide');let s=S.session;g('stats').textContent='第 '+s.turn_no+' 回合｜'+s.place+'｜已過 '+s.minutes+' 分鐘｜危險度 '+s.danger;g('place').textContent=s.place;g('story').textContent=S.current?.narrative||'';g('meta').textContent='任務：查明失蹤補給船的去向';g('options').replaceChildren();for(const c of S.choices){const b=document.createElement('button');b.textContent=c.text;b.onclick=()=>{g('input').value=c.action;g('input').focus()};g('options').append(b)}g('world').textContent='已探索：'+s.visited.join('、')+'｜線索：'+(s.clues.join('、')||'尚無')+'｜芮安信任：'+s.relations.芮安;g('history').replaceChildren();for(const t of S.history.filter(x=>x.turn_no<s.turn_no)){const d=document.createElement('details'),sum=document.createElement('summary'),p=document.createElement('p');d.className='history';sum.textContent='第 '+t.turn_no+' 回合：'+t.intent;p.textContent=t.narrative;d.append(sum,p);g('history').append(d)}}\ng('start').onclick=async()=>{if(pending)return;try{busy(true);let j=await api({op:'new',name:g('name').value});localStorage.setItem('fog-rpg-play',JSON.stringify({id:j.state.session.id,key:j.key}));S=j.state;render()}catch(e){alert(e.message)}finally{busy(false)}};\ng('send').onclick=async()=>{if(pending||!S)return;let input=g('input').value.trim();if(!input)return;try{busy(true);let j=await api({...saved(),op:'act',input,expectedTurn:S.session.turn_no});S=j.state;g('input').value='';render();window.scrollTo({top:0,behavior:'smooth'})}catch(e){alert(e.message+'。輸入文字已保留，請先確認回合。')}finally{busy(false)}};\n(async()=>{try{if(saved()){let j=await api({...saved(),op:'load'});S=j.state;render()}}catch(e){console.warn(e.message)}})();\n</script></html>";
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
 if(req.method==='GET'){const url=new URL(req.url);if(url.searchParams.has('health'))return json({ok:true,service:'rpg-play-v1'});return new Response(PAGE,{headers:{...headers,'content-type':'text/html; charset=utf-8'}})}
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
