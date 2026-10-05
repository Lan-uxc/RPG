import crypto from "node:crypto";
import { db, getPlayerProfile } from "./db.js";

db.exec(`
CREATE TABLE IF NOT EXISTS city_listings(id TEXT PRIMARY KEY,seller_id TEXT NOT NULL REFERENCES players(id),item_key TEXT NOT NULL,name TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price INTEGER NOT NULL,meta_json TEXT NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS city_intel(id TEXT PRIMARY KEY,seller_id TEXT NOT NULL REFERENCES players(id),title TEXT NOT NULL,body TEXT NOT NULL,price INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS city_intel_access(intel_id TEXT NOT NULL REFERENCES city_intel(id),player_id TEXT NOT NULL REFERENCES players(id),acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(intel_id,player_id));
`);
function points(id){return Number(db.prepare("SELECT reward_points FROM player_profiles WHERE player_id=?").get(id)?.reward_points||0)}
function spend(id,n){if(points(id)<n)throw Error("insufficient_reward_points");db.prepare("UPDATE player_profiles SET reward_points=reward_points-?,updated_at=CURRENT_TIMESTAMP WHERE player_id=?").run(n,id)}
function earn(id,n){db.prepare("UPDATE player_profiles SET reward_points=reward_points+?,updated_at=CURRENT_TIMESTAMP WHERE player_id=?").run(n,id)}
export function marketSnapshot(){
 return {listings:db.prepare("SELECT id,seller_id,item_key,name,quantity,unit_price,meta_json FROM city_listings WHERE status='open' ORDER BY created_at DESC LIMIT 50").all().map(x=>({...x,meta:JSON.parse(x.meta_json)})),intel:db.prepare("SELECT id,seller_id,title,price FROM city_intel WHERE status='open' ORDER BY created_at DESC LIMIT 50").all()};
}
export function createListing(playerId,{itemKey,quantity=1,unitPrice}){
 const tx=db.transaction(()=>{const q=Math.max(1,Math.floor(Number(quantity)||1)),price=Math.max(1,Math.floor(Number(unitPrice)||0));const row=db.prepare("SELECT name,quantity,meta_json FROM player_stash WHERE player_id=? AND item_key=?").get(playerId,itemKey);if(!row||row.quantity<q)throw Error("stash_item_not_found");db.prepare("UPDATE player_stash SET quantity=quantity-? WHERE player_id=? AND item_key=?").run(q,playerId,itemKey);db.prepare("DELETE FROM player_stash WHERE player_id=? AND item_key=? AND quantity<=0").run(playerId,itemKey);db.prepare("INSERT INTO city_listings(id,seller_id,item_key,name,quantity,unit_price,meta_json) VALUES (?,?,?,?,?,?,?)").run(crypto.randomUUID(),playerId,itemKey,row.name,q,price,row.meta_json)});tx();return {profile:getPlayerProfile(playerId),...marketSnapshot()};
}
export function buyListing(playerId,id){
 const tx=db.transaction(()=>{const l=db.prepare("SELECT * FROM city_listings WHERE id=? AND status='open'").get(id);if(!l)throw Error("listing_not_found");if(l.seller_id===playerId)throw Error("cannot_buy_own_listing");const total=l.quantity*l.unit_price;spend(playerId,total);earn(l.seller_id,total);db.prepare("INSERT INTO player_stash(player_id,item_key,name,quantity,meta_json) VALUES (?,?,?,?,?) ON CONFLICT(player_id,item_key) DO UPDATE SET quantity=quantity+excluded.quantity").run(playerId,l.item_key,l.name,l.quantity,l.meta_json);db.prepare("UPDATE city_listings SET status='sold' WHERE id=?").run(id)});tx();return {profile:getPlayerProfile(playerId),...marketSnapshot()};
}
export function publishIntel(playerId,{title,body,price}){
 db.prepare("INSERT INTO city_intel(id,seller_id,title,body,price) VALUES (?,?,?,?,?)").run(crypto.randomUUID(),playerId,String(title).slice(0,80),String(body).slice(0,2000),Math.max(0,Math.floor(Number(price)||0)));return marketSnapshot();
}
export function acquireIntel(playerId,id){
 let found=null;const tx=db.transaction(()=>{const x=db.prepare("SELECT * FROM city_intel WHERE id=? AND status='open'").get(id);if(!x)throw Error("intel_not_found");if(x.seller_id!==playerId){spend(playerId,x.price);earn(x.seller_id,x.price)}db.prepare("INSERT OR IGNORE INTO city_intel_access(intel_id,player_id) VALUES (?,?)").run(id,playerId);found={id:x.id,title:x.title,body:x.body}});tx();return {intel:found,profile:getPlayerProfile(playerId),...marketSnapshot()};
}
