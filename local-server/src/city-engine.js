import crypto from "node:crypto";
import { db, getPlayerProfile } from "./db.js";

db.exec(`
CREATE TABLE IF NOT EXISTS city_properties(id TEXT PRIMARY KEY,district TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,price INTEGER NOT NULL,owner_id TEXT REFERENCES players(id),state_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS city_businesses(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES players(id),property_id TEXT NOT NULL REFERENCES city_properties(id),name TEXT NOT NULL,kind TEXT NOT NULL,state_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS city_relations(a_id TEXT NOT NULL REFERENCES players(id),b_id TEXT NOT NULL REFERENCES players(id),status TEXT NOT NULL DEFAULT 'friends',affinity INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(a_id,b_id));
CREATE TABLE IF NOT EXISTS city_pvp(id TEXT PRIMARY KEY,challenger_id TEXT NOT NULL REFERENCES players(id),target_id TEXT NOT NULL REFERENCES players(id),status TEXT NOT NULL DEFAULT 'pending',result_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`);
const pvpCols=db.prepare("PRAGMA table_info(city_pvp)").all();
if(!pvpCols.some(x=>x.name==="terms_json"))db.exec("ALTER TABLE city_pvp ADD COLUMN terms_json TEXT NOT NULL DEFAULT '{}'");
const seed=db.prepare("INSERT OR IGNORE INTO city_properties(id,district,name,kind,price,state_json) VALUES (?,?,?,?,?,?)");
[["res_a01","居住區","A01 小型公寓","home",300],["res_a02","居住區","A02 小型公寓","home",350],["market_s01","交易街","S01 街角店面","shop",600],["market_s02","交易街","S02 小型工作室","shop",500]].forEach(x=>seed.run(...x,"{}"));

export function citySnapshot(playerId){
 const properties=db.prepare("SELECT id,district,name,kind,price,owner_id FROM city_properties ORDER BY district,price").all();
 const businesses=db.prepare("SELECT id,owner_id,property_id,name,kind FROM city_businesses ORDER BY created_at DESC LIMIT 50").all();
 const relations=db.prepare("SELECT a_id,b_id,status,affinity FROM city_relations WHERE a_id=? OR b_id=?").all(playerId,playerId);
 const pvp=db.prepare("SELECT id,challenger_id,target_id,status,result_json,terms_json FROM city_pvp WHERE challenger_id=? OR target_id=? ORDER BY created_at DESC LIMIT 20").all(playerId,playerId).map(x=>({...x,result:JSON.parse(x.result_json),terms:JSON.parse(x.terms_json||"{}")}));
 return {profile:getPlayerProfile(playerId),districts:["中央廣場","居住區","交易街","情報館","競技場"],properties,businesses,relations,pvp};
}
export function buyProperty(playerId,id){
 const tx=db.transaction(()=>{const p=db.prepare("SELECT * FROM city_properties WHERE id=?").get(id);if(!p)throw Error("property_not_found");if(p.owner_id)throw Error("property_owned");const profile=db.prepare("SELECT reward_points FROM player_profiles WHERE player_id=?").get(playerId);if(Number(profile?.reward_points||0)<p.price)throw Error("insufficient_reward_points");db.prepare("UPDATE player_profiles SET reward_points=reward_points-?,updated_at=CURRENT_TIMESTAMP WHERE player_id=?").run(p.price,playerId);db.prepare("UPDATE city_properties SET owner_id=? WHERE id=? AND owner_id IS NULL").run(playerId,id)});
 tx();return citySnapshot(playerId);
}
export function openBusiness(playerId,{propertyId,name,kind}){
 const p=db.prepare("SELECT * FROM city_properties WHERE id=? AND owner_id=?").get(propertyId,playerId);if(!p)throw Error("property_not_owned");if(p.kind!=="shop")throw Error("business_requires_shop");if(db.prepare("SELECT id FROM city_businesses WHERE property_id=?").get(propertyId))throw Error("property_in_use");db.prepare("INSERT INTO city_businesses(id,owner_id,property_id,name,kind) VALUES (?,?,?,?,?)").run(crypto.randomUUID(),playerId,propertyId,String(name).slice(0,40),String(kind||"general").slice(0,30));return citySnapshot(playerId);
}
export function befriend(playerId,targetId){
 if(playerId===targetId)throw Error("invalid_target");if(!db.prepare("SELECT id FROM players WHERE id=?").get(targetId))throw Error("player_not_found");const [a,b]=[playerId,targetId].sort();db.prepare("INSERT INTO city_relations(a_id,b_id,status,affinity) VALUES (?,?,'friends',10) ON CONFLICT(a_id,b_id) DO UPDATE SET status='friends',affinity=MAX(affinity,10),updated_at=CURRENT_TIMESTAMP").run(a,b);return citySnapshot(playerId);
}
export function challengePvp(playerId,targetId,terms={}){
 if(playerId===targetId)throw Error("invalid_target");if(!db.prepare("SELECT id FROM players WHERE id=?").get(targetId))throw Error("player_not_found");
 const clean={mode:"arena",stake:Math.max(0,Math.floor(Number(terms.stake)||0)),lethal:Boolean(terms.lethal),rules:String(terms.rules||"").slice(0,300)};
 db.prepare("INSERT INTO city_pvp(id,challenger_id,target_id,terms_json) VALUES (?,?,?,?)").run(crypto.randomUUID(),playerId,targetId,JSON.stringify(clean));return citySnapshot(playerId);
}
export function respondPvp(playerId,id,accept){
 const p=db.prepare("SELECT * FROM city_pvp WHERE id=? AND target_id=? AND status='pending'").get(id,playerId);if(!p)throw Error("pvp_not_found");db.prepare("UPDATE city_pvp SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accept?"accepted":"declined",id);return citySnapshot(playerId);
}
