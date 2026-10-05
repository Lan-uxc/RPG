import express from "express";
import helmet from "helmet";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensurePlayer, createRun, getRunForPlayer, getRecentTurns, saveTurn,
  createAuthSession, getAuthSession, deleteExpiredSessions,
  getPlayerProfile, settleRunForPlayer, purchaseUpgrade, returnFailedRunToHub, sellStashItem
} from "./db.js";
import { fallbackNarrative, getWorldForScenario } from "./engine.js";
import { settleActionSequence } from "./action-sequence.js";
import { enqueue, narrate, getQueueStatus } from "./ollama.js";
import { withRunLock } from "./run-lock.js";
import { evaluateSettlement } from "./settlement.js";
import { listScenarios } from "./scenario-loader.js";
import { randomToken, hashToken, readCookie, sessionCookie } from "./session-auth.js";
import { publicShopItems } from "./shop-catalog.js";
import { citySnapshot, buyProperty, openBusiness, befriend, challengePvp, respondPvp } from "./city-engine.js";
import { marketSnapshot, createListing, buyListing, publishIntel, acquireIntel } from "./city-market.js";

const app=express();
const PORT=Number(process.env.PORT||3000);
const OLLAMA_URL=process.env.OLLAMA_URL||"http://127.0.0.1:11434";
const OLLAMA_MODEL=process.env.OLLAMA_MODEL||"";

app.set("trust proxy",1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:"16kb"}));

const __dirname=path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.resolve(__dirname,"../public")));

const buckets=new Map();
function allow(key){
  const now=Date.now(),arr=(buckets.get(key)||[]).filter(t=>now-t<60000);
  if(arr.length>=8)return false;
  arr.push(now);buckets.set(key,arr);return true;
}

function getPlayerFromRequest(req){
  const token=readCookie(req,"rpg_session");
  if(!token)return null;
  const auth=getAuthSession(hashToken(token));
  return auth?.player_id||null;
}

function requirePlayer(req,res,next){
  const playerId=getPlayerFromRequest(req);
  if(!playerId)return res.status(401).json({error:"auth_required"});
  req.playerId=playerId;
  next();
}

app.get("/api/health",async(_req,res)=>{
  let ollama=false,models=[];
  try{
    const r=await fetch(`${OLLAMA_URL}/api/tags`,{signal:AbortSignal.timeout(2500)});
    const j=await r.json();models=(j.models||[]).map(m=>m.name);ollama=r.ok;
  }catch{}
  res.json({ok:true,ollama});
});

app.get("/api/scenarios",requirePlayer,(req,res)=>{
  try{res.json({scenarios:listScenarios(getPlayerProfile(req.playerId))})}
  catch{res.status(500).json({error:"scenario_list_failed"})}
});

app.post("/api/auth/guest",(req,res)=>{
  deleteExpiredSessions();
  const existing=getPlayerFromRequest(req);
  if(existing)return res.json({playerId:existing,reused:true});

  const playerId=crypto.randomUUID();
  const token=randomToken();
  const expires=new Date(Date.now()+30*24*60*60*1000).toISOString().replace("T"," ").replace("Z","");
  ensurePlayer(playerId);
  createAuthSession(hashToken(token),playerId,expires);
  res.setHeader("Set-Cookie",sessionCookie(token));
  res.json({playerId,reused:false});
});

app.get("/api/me",requirePlayer,(req,res)=>res.json({playerId:req.playerId,profile:getPlayerProfile(req.playerId)}));

app.get("/api/queue",requirePlayer,(_req,res)=>{
  res.json(getQueueStatus());
});

app.get("/api/hub",requirePlayer,(req,res)=>{
  res.json({profile:getPlayerProfile(req.playerId),shop:publicShopItems()});
});

app.post("/api/hub/purchase",requirePlayer,(req,res)=>{
  const itemKey=String(req.body?.itemKey||"").slice(0,80);
  try{
    const result=purchaseUpgrade(req.playerId,itemKey);
    res.json(result);
  }catch(err){
    const status=["shop_item_not_found"].includes(err.message)?404:
      ["insufficient_reward_points","upgrade_already_owned","requirements_not_met"].includes(err.message)?409:400;
    res.status(status).json({error:err.message||"purchase_failed"});
  }
});

app.post("/api/hub/stash/sell",requirePlayer,(req,res)=>{
  try{
    const profile=sellStashItem(req.playerId,String(req.body?.itemKey||"").slice(0,80),req.body?.quantity||1);
    res.json({profile});
  }catch(err){res.status(409).json({error:err.message||"stash_sell_failed"});}
});

app.get("/api/city",requirePlayer,(req,res)=>{res.json({...citySnapshot(req.playerId),...marketSnapshot()})});
app.post("/api/city/property/buy",requirePlayer,(req,res)=>{try{res.json(buyProperty(req.playerId,String(req.body?.id||"").slice(0,80)))}catch(err){res.status(409).json({error:err.message})}});
app.post("/api/city/business/open",requirePlayer,(req,res)=>{try{res.json(openBusiness(req.playerId,{propertyId:String(req.body?.propertyId||"").slice(0,80),name:req.body?.name,kind:req.body?.kind}))}catch(err){res.status(409).json({error:err.message})}});
app.post("/api/city/friend",requirePlayer,(req,res)=>{try{res.json(befriend(req.playerId,String(req.body?.targetId||"").slice(0,80)))}catch(err){res.status(409).json({error:err.message})}});
app.post("/api/city/market/list",requirePlayer,(req,res)=>{try{res.json(createListing(req.playerId,req.body||{}))}catch(err){res.status(409).json({error:err.message})}});
app.post("/api/city/market/buy",requirePlayer,(req,res)=>{try{res.json(buyListing(req.playerId,String(req.body?.id||"").slice(0,80)))}catch(err){res.status(409).json({error:err.message})}});
app.post("/api/city/intel/publish",requirePlayer,(req,res)=>{try{res.json(publishIntel(req.playerId,req.body||{}))}catch(err){res.status(409).json({error:err.message})}});
app.post("/api/city/intel/acquire",requirePlayer,(req,res)=>{try{res.json(acquireIntel(req.playerId,String(req.body?.id||"").slice(0,80)))}catch(err){res.status(409).json({error:err.message})}});
app.post("/api/city/pvp/challenge",requirePlayer,(req,res)=>{try{res.json(challengePvp(req.playerId,String(req.body?.targetId||"").slice(0,80)))}catch(err){res.status(409).json({error:err.message})}});
app.post("/api/city/pvp/respond",requirePlayer,(req,res)=>{try{res.json(respondPvp(req.playerId,String(req.body?.id||"").slice(0,80),Boolean(req.body?.accept)))}catch(err){res.status(409).json({error:err.message})}});

app.get("/api/world",requirePlayer,(req,res)=>{
  const scenarioId=String(req.query.scenario||"town_origin");
  try{
    res.json({scenarioId,places:getWorldForScenario(scenarioId)});
  }catch{
    res.status(404).json({error:"scenario_not_found"});
  }
});

app.post("/api/session",requirePlayer,(req,res)=>{
  const scenarioId=String(req.body?.scenarioId||"town_origin").slice(0,80);
  try{
    const runId=crypto.randomUUID();
    const loadout=Array.isArray(req.body?.loadout)?req.body.loadout:[];
    const run=createRun({id:runId,playerId:req.playerId,scenarioId,loadout});
    res.json({run});
  }catch(err){
    const status=["scenario_locked","invalid_loadout","loadout_slot_conflict"].includes(err.message)?409:400;
    res.status(status).json({error:err.message||"invalid_scenario"});
  }
});

app.get("/api/run/:id",requirePlayer,(req,res)=>{
  const run=getRunForPlayer(req.params.id,req.playerId);
  if(!run)return res.status(404).json({error:"run_not_found"});
  res.json({run,recent:getRecentTurns(run.id,30),settlement:evaluateSettlement(run)});
});

app.post("/api/run/:id/action",requirePlayer,async(req,res)=>{
  const action=String(req.body?.action||"").trim();
  if(!action)return res.status(400).json({error:"action_required"});
  if(action.length>1000)return res.status(400).json({error:"action_too_long"});

  const rateKey=String(req.ip||"unknown")+":"+req.playerId;
  if(!allow(rateKey))return res.status(429).json({error:"rate_limited"});

  try{
    const payload=await withRunLock(req.params.id,async()=>{
      const run=getRunForPlayer(req.params.id,req.playerId);
      if(!run)throw Object.assign(new Error("run_not_found"),{status:404});
      if(run.status!=="active")throw Object.assign(new Error("run_not_active"),{status:409});

      const settled=settleActionSequence(run,action,3);
      const recent=getRecentTurns(run.id,6);
      let narrative="",ai=false;

      const model=OLLAMA_MODEL||(await(async()=>{
        try{
          const r=await fetch(`${OLLAMA_URL}/api/tags`);
          const j=await r.json();
          return j.models?.[0]?.name||"";
        }catch{return""}
      })());

      if(model){
        try{
          narrative=await enqueue(()=>narrate({model,ollamaUrl:OLLAMA_URL,settled,action,recent}));
          ai=Boolean(narrative);
        }catch{}
      }
      if(!narrative)narrative=fallbackNarrative(settled,action);

      const updated=saveTurn({run,action,settled,narrative});
      const world=getWorldForScenario(updated.scenario_id);
      const settlement=evaluateSettlement(updated);

      return {
        ai,
        turn:updated.turn,
        time:updated.world_time,
        location:updated.location,
        locationName:world[updated.location]?.name||updated.location,
        state:updated.state,
        inventory:updated.inventory,
        npcs:updated.npcs,
        enemies:updated.enemies,
        threads:updated.threads,
        narrative,
        summary:settled.summary,
        outcome:settled.outcome,
        parsedIntent:settled.parsedIntent,
        settlement
      };
    });
    res.json(payload);
  }catch(err){
    res.status(err.status||500).json({error:err.message||"action_failed"});
  }
});

app.post("/api/run/:id/return",requirePlayer,(req,res)=>{
  try{
    const result=returnFailedRunToHub(req.params.id,req.playerId);
    res.json(result);
  }catch(err){
    res.status(err.message==="run_not_found"?404:409).json({error:err.message||"return_failed"});
  }
});

app.post("/api/run/:id/settle",requirePlayer,(req,res)=>{
  try{
    const run=getRunForPlayer(req.params.id,req.playerId);
    if(!run)return res.status(404).json({error:"run_not_found"});
    const result=evaluateSettlement(run);
    if(!result.complete)return res.status(409).json({error:"scenario_not_complete",settlement:result});
    const settled=settleRunForPlayer(run.id,req.playerId,result.reward);
    res.json({settlement:result,profile:settled.profile,run:settled.run});
  }catch(err){
    const status=err.message==="run_already_settled"?409:500;
    res.status(status).json({error:err.message||"settlement_failed"});
  }
});

app.listen(PORT,"127.0.0.1",()=>{
  console.log(`RPG server: http://127.0.0.1:${PORT}`);
  console.log(`Ollama: ${OLLAMA_URL}`);
});
