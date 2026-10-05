import crypto from "node:crypto";
import { db } from "./db.js";

db.exec(`
CREATE TABLE IF NOT EXISTS city_crimes(
 id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES players(id),victim_id TEXT REFERENCES players(id),
 district TEXT NOT NULL,kind TEXT NOT NULL,severity INTEGER NOT NULL,evidence INTEGER NOT NULL DEFAULT 0,
 witnessed INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS city_wanted(
 player_id TEXT PRIMARY KEY REFERENCES players(id),heat INTEGER NOT NULL DEFAULT 0,bounty INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'clear',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS city_assaults(
 id TEXT PRIMARY KEY,attacker_id TEXT NOT NULL REFERENCES players(id),target_id TEXT NOT NULL REFERENCES players(id),
 district TEXT NOT NULL,lethal_intent INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'initiated',
 state_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const SAFE=new Set(["競技場"]);
function wantedStatus(heat){return heat>=80?"high_wanted":heat>=40?"wanted":heat>=15?"suspected":"clear"}
export function wantedState(playerId){
 const x=db.prepare("SELECT player_id,heat,bounty,status FROM city_wanted WHERE player_id=?").get(playerId);
 return x||{player_id:playerId,heat:0,bounty:0,status:"clear"};
}
export function recordCrime(actorId,{victimId=null,district="中央廣場",kind="assault",severity=20,witnessed=true,evidence=50}={}){
 const sev=Math.max(1,Math.min(100,Number(severity)||1)),proof=Math.max(0,Math.min(100,Number(evidence)||0));
 const effective=Math.round(sev*((witnessed?60:20)+proof)/100);
 const tx=db.transaction(()=>{
   db.prepare("INSERT INTO city_crimes(id,actor_id,victim_id,district,kind,severity,evidence,witnessed) VALUES (?,?,?,?,?,?,?,?)").run(crypto.randomUUID(),actorId,victimId,district,kind,sev,proof,witnessed?1:0);
   const before=wantedState(actorId),heat=Math.min(100,before.heat+effective),bounty=before.bounty+Math.max(0,sev*2);
   db.prepare("INSERT INTO city_wanted(player_id,heat,bounty,status) VALUES (?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET heat=excluded.heat,bounty=excluded.bounty,status=excluded.status,updated_at=CURRENT_TIMESTAMP").run(actorId,heat,bounty,wantedStatus(heat));
 });tx();return wantedState(actorId);
}
export function directAttack(attackerId,{targetId,district="中央廣場",lethal=false,witnessed=true,evidence=50}){
 if(attackerId===targetId)throw Error("invalid_target");
 if(!db.prepare("SELECT id FROM players WHERE id=?").get(targetId))throw Error("player_not_found");
 if(SAFE.has(district))throw Error("use_arena_rules");
 const id=crypto.randomUUID();
 db.prepare("INSERT INTO city_assaults(id,attacker_id,target_id,district,lethal_intent,state_json) VALUES (?,?,?,?,?,?)").run(id,attackerId,targetId,String(district).slice(0,40),lethal?1:0,JSON.stringify({unconsented:true}));
 const wanted=recordCrime(attackerId,{victimId:targetId,district,kind:lethal?"attempted_murder":"assault",severity:lethal?55:25,witnessed,evidence});
 return {assault:{id,attackerId,targetId,district,lethal:Boolean(lethal),status:"initiated"},wanted};
}
export function publicWanted(limit=20){
 return db.prepare("SELECT player_id,heat,bounty,status FROM city_wanted WHERE status!='clear' ORDER BY bounty DESC,heat DESC LIMIT ?").all(Math.max(1,Math.min(100,Number(limit)||20)));
}
