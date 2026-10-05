import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { loadScenario } from "./scenario-loader.js";

const dataDir=path.resolve("data");
fs.mkdirSync(dataDir,{recursive:true});
export const db=new Database(path.join(dataDir,"rpg.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_player ON auth_sessions(player_id);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  scenario_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  turn INTEGER NOT NULL DEFAULT 0,
  world_time TEXT NOT NULL DEFAULT '08:10',
  location TEXT NOT NULL DEFAULT 'town_edge',
  state_json TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id),
  turn_no INTEGER NOT NULL,
  player_input TEXT NOT NULL,
  settled_json TEXT NOT NULL,
  narrative TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(run_id, turn_no)
);
CREATE TABLE IF NOT EXISTS inventory (
  run_id TEXT NOT NULL REFERENCES runs(id),
  item_key TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  meta_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(run_id, item_key)
);
CREATE TABLE IF NOT EXISTS npcs (
  run_id TEXT NOT NULL REFERENCES runs(id),
  npc_key TEXT NOT NULL,
  name TEXT NOT NULL,
  alive INTEGER NOT NULL DEFAULT 1,
  relation INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(run_id, npc_key)
);
CREATE TABLE IF NOT EXISTS enemies (
  run_id TEXT NOT NULL REFERENCES runs(id),
  enemy_key TEXT NOT NULL,
  name TEXT NOT NULL,
  alive INTEGER NOT NULL DEFAULT 1,
  hp INTEGER NOT NULL DEFAULT 100,
  location TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(run_id, enemy_key)
);
CREATE TABLE IF NOT EXISTS threads (
  run_id TEXT NOT NULL REFERENCES runs(id),
  thread_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(run_id, thread_key)
);
`);

export function ensurePlayer(playerId){
  db.prepare(`INSERT INTO players(id) VALUES (?) ON CONFLICT(id) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP`).run(playerId);
}
export function createAuthSession(tokenHash,playerId,expiresAt){
  db.prepare("INSERT OR REPLACE INTO auth_sessions(token_hash,player_id,expires_at) VALUES (?,?,?)")
    .run(tokenHash,playerId,expiresAt);
}
export function getAuthSession(tokenHash){
  const row=db.prepare("SELECT token_hash,player_id,expires_at FROM auth_sessions WHERE token_hash=? AND expires_at>CURRENT_TIMESTAMP").get(tokenHash);
  return row||null;
}
export function deleteExpiredSessions(){
  db.prepare("DELETE FROM auth_sessions WHERE expires_at<=CURRENT_TIMESTAMP").run();
}

export function getInventory(runId){
  return db.prepare("SELECT item_key,name,quantity,meta_json FROM inventory WHERE run_id=? ORDER BY name").all(runId)
    .map(x=>({key:x.item_key,name:x.name,quantity:x.quantity,meta:JSON.parse(x.meta_json)}));
}
export function getNpcs(runId){
  return db.prepare("SELECT npc_key,name,alive,relation,state_json FROM npcs WHERE run_id=? ORDER BY name").all(runId)
    .map(x=>({key:x.npc_key,name:x.name,alive:Boolean(x.alive),relation:x.relation,state:JSON.parse(x.state_json)}));
}
export function getEnemies(runId){
  return db.prepare("SELECT enemy_key,name,alive,hp,location,state_json FROM enemies WHERE run_id=? ORDER BY name").all(runId)
    .map(x=>({key:x.enemy_key,name:x.name,alive:Boolean(x.alive),hp:x.hp,location:x.location,state:JSON.parse(x.state_json)}));
}
export function getThreads(runId){
  return db.prepare("SELECT thread_key,title,status,progress,state_json FROM threads WHERE run_id=? ORDER BY rowid").all(runId)
    .map(x=>({key:x.thread_key,title:x.title,status:x.status,progress:x.progress,state:JSON.parse(x.state_json)}));
}
export function getRun(runId){
  const row=db.prepare("SELECT * FROM runs WHERE id=?").get(runId);
  if(!row)return null;
  return {
    ...row,
    state:JSON.parse(row.state_json),
    inventory:getInventory(runId),
    npcs:getNpcs(runId),
    enemies:getEnemies(runId),
    threads:getThreads(runId)
  };
}
export function getRunForPlayer(runId,playerId){
  const run=getRun(runId);
  return run && run.player_id===playerId ? run : null;
}
export function createRun({id,playerId,scenarioId="town_origin"}){
  const sc=loadScenario(scenarioId);
  const initialState={
    hp:sc.start.hp??100,
    san:sc.start.san??100,
    reward:sc.start.reward??0,
    facts:[...(sc.facts||[])],
    flags:{},
    visited:[sc.start.location]
  };

  const tx=db.transaction(()=>{
    db.prepare(`
      INSERT INTO runs(id,player_id,scenario_id,world_time,location,state_json)
      VALUES (?,?,?,?,?,?)
    `).run(id,playerId,sc.id,sc.start.time||"08:10",sc.start.location,JSON.stringify(initialState));

    const inv=db.prepare("INSERT INTO inventory(run_id,item_key,name,quantity,meta_json) VALUES (?,?,?,?,?)");
    for(const item of sc.start.inventory||[]){
      inv.run(id,item.key,item.name,item.quantity||1,JSON.stringify(item.meta||{}));
    }

    const th=db.prepare("INSERT INTO threads(run_id,thread_key,title,status,progress,state_json) VALUES (?,?,?,?,?,?)");
    for(const t of sc.threads||[]){
      th.run(id,t.key,t.title,t.status||"active",t.progress||0,JSON.stringify(t.state||{}));
    }

    const en=db.prepare("INSERT INTO enemies(run_id,enemy_key,name,alive,hp,location,state_json) VALUES (?,?,?,?,?,?,?)");
    for(const e of sc.enemies||[]){
      en.run(id,e.key,e.name,e.alive===false?0:1,e.hp??100,e.location,JSON.stringify(e.state||{}));
    }
  });
  tx();
  return getRun(id);
}
export function saveTurn({run,action,settled,narrative}){
  const tx=db.transaction(()=>{
    db.prepare(`
      UPDATE runs SET turn=?,world_time=?,location=?,state_json=?,summary=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(settled.turn,settled.time,settled.location,JSON.stringify(settled.state),settled.summary||"",settled.runStatus||run.status||"active",run.id);

    for(const op of settled.inventoryOps||[]){
      if(op.type==="add"){
        db.prepare(`
          INSERT INTO inventory(run_id,item_key,name,quantity,meta_json)
          VALUES (?,?,?,?,?)
          ON CONFLICT(run_id,item_key) DO UPDATE SET quantity=quantity+excluded.quantity
        `).run(run.id,op.key,op.name,op.quantity||1,JSON.stringify(op.meta||{}));
      }else if(op.type==="remove"){
        db.prepare("UPDATE inventory SET quantity=MAX(0,quantity-?) WHERE run_id=? AND item_key=?").run(op.quantity||1,run.id,op.key);
        db.prepare("DELETE FROM inventory WHERE run_id=? AND item_key=? AND quantity<=0").run(run.id,op.key);
      }else if(op.type==="cash"){
        const wallet=db.prepare("SELECT meta_json FROM inventory WHERE run_id=? AND item_key='wallet'").get(run.id);
        const meta=wallet?JSON.parse(wallet.meta_json):{cash:0};
        meta.cash=Math.max(0,Number(meta.cash||0)+Number(op.delta||0));
        db.prepare("UPDATE inventory SET meta_json=? WHERE run_id=? AND item_key='wallet'").run(JSON.stringify(meta),run.id);
      }
    }

    for(const npc of settled.npcOps||[]){
      db.prepare(`
        INSERT INTO npcs(run_id,npc_key,name,alive,relation,state_json)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(run_id,npc_key) DO UPDATE SET
          name=excluded.name,alive=excluded.alive,relation=excluded.relation,state_json=excluded.state_json
      `).run(run.id,npc.key,npc.name,npc.alive?1:0,npc.relation||0,JSON.stringify(npc.state||{}));
    }

    for(const enemy of settled.enemyOps||[]){
      db.prepare(`
        INSERT INTO enemies(run_id,enemy_key,name,alive,hp,location,state_json)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(run_id,enemy_key) DO UPDATE SET
          name=excluded.name,alive=excluded.alive,hp=excluded.hp,location=excluded.location,state_json=excluded.state_json
      `).run(run.id,enemy.key,enemy.name,enemy.alive?1:0,enemy.hp,enemy.location,JSON.stringify(enemy.state||{}));
    }

    for(const th of settled.threadOps||[]){
      db.prepare(`
        INSERT INTO threads(run_id,thread_key,title,status,progress,state_json)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(run_id,thread_key) DO UPDATE SET
          title=excluded.title,status=excluded.status,progress=excluded.progress,state_json=excluded.state_json
      `).run(run.id,th.key,th.title,th.status,th.progress||0,JSON.stringify(th.state||{}));
    }

    db.prepare(`INSERT INTO turns(run_id,turn_no,player_input,settled_json,narrative) VALUES (?,?,?,?,?)`)
      .run(run.id,settled.turn,action,JSON.stringify(settled),narrative);
  });
  tx();
  return getRun(run.id);
}
export function getRecentTurns(runId,limit=8){
  return db.prepare(`SELECT turn_no,player_input,narrative,settled_json FROM turns WHERE run_id=? ORDER BY turn_no DESC LIMIT ?`)
    .all(runId,limit).reverse().map(x=>({turn_no:x.turn_no,player_input:x.player_input,narrative:x.narrative,settled:JSON.parse(x.settled_json)}));
}
