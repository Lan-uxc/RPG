
import { createClient } from 'npm:@supabase/supabase-js@2'

const secretJson=Deno.env.get('SUPABASE_SECRET_KEYS')||''
let serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
try{if(secretJson)serviceKey=JSON.parse(secretJson).default||serviceKey}catch{}
const db=createClient(Deno.env.get('SUPABASE_URL')||'',serviceKey,{auth:{persistSession:false}})
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'content-type, x-agent-admin','access-control-allow-methods':'GET,POST,OPTIONS'}
const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})

async function secret(name:string){
 const {data,error}=await db.rpc('game_ai_secret_get',{p_name:name})
 return !error&&typeof data==='string'?data:''
}
async function sha(s:string){
 const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))
 return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')
}
async function authSession(code:string,token:string){
 if(!code||!token)return null
 const {data}=await db.from('game_sessions').select('*').eq('session_code',code.toUpperCase()).maybeSingle()
 return data&&await sha(token)===data.access_token_hash?data:null
}
function responseText(data:any){
 for(const item of data?.output||[])if(item?.type==='message')for(const c of item.content||[])if(c?.type==='output_text'&&typeof c.text==='string')return c.text
 return ''
}
async function logRun(p:any){
 const {data}=await db.from('game_agent_runs').insert(p).select('id').single()
 return data?.id||null
}
async function finishRun(id:string|null,status:string,output:string,metadata:any={}){
 if(!id)return
 await db.from('game_agent_runs').update({status,output_summary:output.slice(0,1200),metadata,completed_at:new Date().toISOString()}).eq('id',id)
}

async function codeAgent(task:string,context:string){
 const key=await secret('GAME_OPENAI_API_KEY')
 if(!key)throw Error('AI_API_NOT_CONFIGURED')
 const body={
  model:'gpt-5.3-codex',
  reasoning:{effort:'high'},
  store:false,
  max_output_tokens:6000,
  input:[
   {role:'developer',content:[
    'You are the Coding Agent for a persistent browser RPG.',
    'Return implementation-oriented code/review advice only.',
    'Do not invent database schema or API facts that are not in the provided context.',
    'When proposing a patch, preserve existing state and avoid destructive resets.',
    'Prefer minimal safe changes, explicit tests, and backward compatibility.'
   ].join('\n')},
   {role:'user',content:'TASK\n'+task+'\n\nCURRENT CONTEXT\n'+context}
  ]
 }
 const rr=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body)})
 const data=await rr.json().catch(()=>({}))
 if(!rr.ok)throw Error(data?.error?.message||'Codex request failed')
 return responseText(data)
}

async function artAgent(session:any,subject:string,kind:string){
 const key=await secret('GAME_OPENAI_API_KEY')
 if(!key)throw Error('AI_API_NOT_CONFIGURED')
 const {data:turns=[]}=await db.from('game_turns').select('turn_no,narrative').eq('session_id',session.id).order('turn_no',{ascending:false}).limit(2)
 const w=session.world_state||{}
 const scene=String(turns?.[0]?.narrative||'').slice(0,2200)
 const prompt=[
  'Create an original cinematic game asset for a persistent alternate-history RPG.',
  'Historical setting: Normandy, 6 June 1944.',
  'Current in-world time: '+String(w.time||'unknown')+'.',
  'Current location: '+String(w.location||'unknown')+'.',
  'Asset type: '+kind+'.',
  'Requested subject: '+subject+'.',
  'Continuity constraints: grounded 1944 material culture unless the current story explicitly contains supernatural changes; no modern UI, no text overlays, no logos.',
  'Visual tone: restrained war-drama realism, readable composition, useful as a game illustration, not a poster.',
  'Recent scene context: '+scene
 ].join('\n')

 const runId=await logRun({session_id:session.id,turn_no:session.turn_no,agent_role:'art',model:'gpt-image-2',status:'started',input_summary:subject,metadata:{kind}})
 const rr=await fetch('https://api.openai.com/v1/images/generations',{
  method:'POST',
  headers:{authorization:'Bearer '+key,'content-type':'application/json'},
  body:JSON.stringify({model:'gpt-image-2',prompt,size:'1536x1024',quality:'medium',n:1})
 })
 const data=await rr.json().catch(()=>({}))
 if(!rr.ok){await finishRun(runId,'failed',data?.error?.message||'image generation failed');throw Error(data?.error?.message||'Image generation failed')}
 const b64=data?.data?.[0]?.b64_json
 if(!b64){await finishRun(runId,'failed','missing b64_json');throw Error('Image response missing data')}
 const bytes=Uint8Array.from(atob(b64),(c)=>c.charCodeAt(0))
 const assetKey=(kind+'-'+subject).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'-').slice(0,70)+'-'+Date.now()
 const path=session.id+'/'+assetKey+'.png'
 const up=await db.storage.from('game-assets').upload(path,bytes,{contentType:'image/png',upsert:false})
 if(up.error){await finishRun(runId,'failed',up.error.message);throw up.error}
 const {data:pub}=db.storage.from('game-assets').getPublicUrl(path)
 const url=pub.publicUrl
 await db.from('game_visual_assets').insert({
  session_id:session.id,asset_key:assetKey,asset_type:kind,subject_key:subject,storage_path:path,
  public_url:url,prompt,model:'gpt-image-2',metadata:{size:'1536x1024',quality:'medium'}
 })
 await finishRun(runId,'completed','image generated',{public_url:url})
 return{assetKey,url,model:'gpt-image-2'}
}

Deno.serve(async req=>{
 try{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS})
  if(req.method==='GET'){
   const key=await secret('GAME_OPENAI_API_KEY')
   return J({
    ok:true,configured:!!key,
    agents:{
     director:{model:'gpt-5.6-sol',reasoning:'high'},
     narrator:{model:'gpt-5.6-sol',reasoning:'high'},
     coding:{model:'Codex CLI',auth:'ChatGPT sign-in',scope:'external-hermes-maintenance',billing:'ChatGPT plan usage'},
     art:{model:'gpt-image-2',scope:'on-demand'}
    }
   })
  }
  if(req.method!=='POST')return J({error:'method'},405)
  const b=await req.json().catch(()=>({}))
  if(b.op==='art'){
   const s=await authSession(String(b.sessionCode||''),String(b.accessToken||''))
   if(!s)return J({error:'Session 驗證失敗'},401)
   const subject=String(b.subject||'current scene').slice(0,160)
   const kind=String(b.kind||'scene').slice(0,40)
   return J({ok:true,asset:await artAgent(s,subject,kind)})
  }
  if(b.op==='code'){
   return J({
    ok:false,
    error:'Coding Agent 已改為 Samsung/Hermes 上的 Codex CLI + ChatGPT 登入，不再透過 OpenAI API 執行。',
    mode:'external-codex-cli'
   },409)
  }
  return J({error:'unknown op'},400)
 }catch(e){
  return J({ok:false,error:String(e?.message||e)},500)
 }
})
