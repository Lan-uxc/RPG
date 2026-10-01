
import { createClient } from 'npm:@supabase/supabase-js@2'

const secretJson=Deno.env.get('SUPABASE_SECRET_KEYS')||''
let secretKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
try{if(secretJson)secretKey=JSON.parse(secretJson).default||secretKey}catch{}
const db=createClient(Deno.env.get('SUPABASE_URL')||'',secretKey,{auth:{persistSession:false}})

const CORS={
 'access-control-allow-origin':'*',
 'access-control-allow-headers':'content-type',
 'access-control-allow-methods':'GET,POST,OPTIONS'
}
const html=(body:string,status=200)=>new Response(body,{status,headers:{...CORS,'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})
const json=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:{...CORS,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})

async function sha(s:string){
 const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))
 return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')
}
async function validToken(token:string){
 if(!token)return false
 const {data,error}=await db.rpc('game_ai_setup_token_valid',{p_token_hash:await sha(token)})
 return !error&&data===true
}
function extractText(data:any){
 for(const item of data?.output||[]){
  if(item?.type==='message'){
   for(const c of item.content||[])if(c?.type==='output_text'&&typeof c.text==='string')return c.text
  }
 }
 return ''
}
async function testOpenRouter(key:string){
 const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{
  method:'POST',
  headers:{'authorization':'Bearer '+key,'content-type':'application/json','http-referer':'https://github.com/Lan-uxc/RPG','x-title':'RPG'},
  body:JSON.stringify({model:'qwen/qwen3.8-27b:free',messages:[{role:'user',content:'請只回覆 OK'}],max_tokens:8})
 })
 const data=await r.json().catch(()=>({}))
 if(!r.ok)return{ok:false,status:r.status,error:data?.error?.message||'OpenRouter API 驗證失敗'}
 return{ok:true,text:data?.choices?.[0]?.message?.content||''}
}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[c])}
function page(token:string,msg=''){
 const t=JSON.stringify(token)
 const m=msg?'<div class="msg">'+esc(msg)+'</div>':''
 return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>OpenRouter AI 連線設定</title><style>'+
 'body{margin:0;background:#0f0e0b;color:#e9e2d5;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;min-height:100vh;display:grid;place-items:center}'+
 '.card{width:min(92vw,560px);border:1px solid #3a352b;background:#15130f;padding:28px;border-radius:18px;box-shadow:0 30px 80px #0008}'+
 'h1{font-size:24px;margin:0 0 8px}.sub{color:#aaa08f;line-height:1.7;margin-bottom:22px}'+
 'input{width:100%;box-sizing:border-box;background:#0c0b09;color:#f4eee3;border:1px solid #454035;border-radius:10px;padding:14px;font-size:16px}'+
 'button{margin-top:14px;width:100%;border:0;border-radius:10px;padding:14px;font-size:16px;font-weight:700;background:#e8e0d2;color:#15120e;cursor:pointer}'+
 '.note{font-size:13px;color:#8f8779;line-height:1.6;margin-top:14px}.msg{margin:12px 0;padding:10px;border:1px solid #554d3f;border-radius:8px;background:#19160f}'+
 '</style></head><body><div class="card"><h1>OpenRouter AI 連線設定</h1>'+
 '<div class="sub">這個頁面只用一次。API Key 會經 HTTPS 傳到你的 Supabase 後端，寫入 Supabase Vault 加密保存，不會放進遊戲前端或 localStorage。小說／導演：OpenRouter · qwen/qwen3.8-27b:free。</div>'+
 m+'<input id="key" type="password" autocomplete="off" placeholder="貼上 OpenRouter API Key">'+
 '<button id="save">驗證並連接</button><div class="note">連接成功後，這個一次性設定連結會立即失效。</div>'+
 '<script>const token='+t+';const btn=document.getElementById("save"),key=document.getElementById("key");'+
 'btn.onclick=async()=>{const v=key.value.trim();if(!v){alert("請輸入 API Key");return}btn.disabled=true;btn.textContent="驗證中…";try{const r=await fetch(location.pathname,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,key:v})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"設定失敗");document.querySelector(".card").innerHTML="<h1>已連接</h1><div class=\\"sub\\">大型語言模型已接入遊戲後端。你可以回到遊戲重新整理後開始測試。</div>"}catch(e){alert(e.message||String(e));btn.disabled=false;btn.textContent="驗證並連接"}};'+
 '</script></div></body></html>'
}

Deno.serve(async req=>{
 try{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS})
  const url=new URL(req.url)
  if(req.method==='GET'){
   const token=url.searchParams.get('token')||''
   if(!await validToken(token))return html(page('', '這個設定連結無效或已經使用。'),403)
   return html(page(token))
  }
  if(req.method==='POST'){
   const b=await req.json().catch(()=>({}))
   const token=String(b.token||''),key=String(b.key||'').trim()
   if(!await validToken(token))return json({ok:false,error:'設定連結已失效'},403)
   if(!key.length > 20)return json({ok:false,error:'這不像有效的 OpenRouter API Key'},400)
   const check=await testOpenRouter(key)
   if(!check.ok)return json({ok:false,error:check.error||'API Key 驗證失敗'},400)
   const {error:saveError}=await db.rpc('game_ai_secret_upsert',{p_name:'GAME_OPENROUTER_API_KEY',p_value:key})
   if(saveError)return json({ok:false,error:'無法寫入 Supabase Vault'},500)
   const {error:consumeError}=await db.rpc('game_ai_setup_token_consume',{p_token_hash:await sha(token)})
   if(consumeError)return json({ok:false,error:'已儲存金鑰，但一次性連結狀態更新失敗'},500)
   return json({ok:true,models:{director:'gpt-5.6-sol/high',narrator:'gpt-5.6-sol/high',coding:'gpt-5.3-codex/high',art:'gpt-image-2'}})
  }
  return json({ok:false,error:'method'},405)
 }catch(e){return json({ok:false,error:String(e?.message||e)},500)}
})
