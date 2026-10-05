import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "rpg.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  scenario_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  turn INTEGER NOT NULL DEFAULT 0,
  world_time TEXT NOT NULL DEFAULT '08:10',
  location TEXT NOT NULL DEFAULT '北台灣・邊緣城鎮',
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
`);

export function ensurePlayer(playerId) {
  db.prepare(`INSERT INTO players(id) VALUES (?) ON CONFLICT(id) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP`).run(playerId);
}

export function getRun(runId) {
  const row = db.prepare("SELECT * FROM runs WHERE id=?").get(runId);
  if (!row) return null;
  return { ...row, state: JSON.parse(row.state_json) };
}

export function createRun({ id, playerId }) {
  const initialState = {
    hp: 100,
    san: 100,
    reward: 0,
    facts: ["雨剛停", "老市場屋頂曾出現短暫的暗色紋路"],
    threads: [],
    inventory: ["手機", "錢包", "隨身背包"],
    flags: {}
  };
  db.prepare(`
    INSERT INTO runs(id, player_id, scenario_id, state_json)
    VALUES (?, ?, 'town_origin', ?)
  `).run(id, playerId, JSON.stringify(initialState));
  return getRun(id);
}

export function saveTurn({ run, action, settled, narrative }) {
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE runs
      SET turn=?, world_time=?, location=?, state_json=?, summary=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      settled.turn,
      settled.time,
      settled.location,
      JSON.stringify(settled.state),
      settled.summary || "",
      run.id
    );

    db.prepare(`
      INSERT INTO turns(run_id, turn_no, player_input, settled_json, narrative)
      VALUES (?, ?, ?, ?, ?)
    `).run(run.id, settled.turn, action, JSON.stringify(settled), narrative);
  });
  tx();
  return getRun(run.id);
}

export function getRecentTurns(runId, limit=8) {
  return db.prepare(`
    SELECT turn_no, player_input, narrative
    FROM turns
    WHERE run_id=?
    ORDER BY turn_no DESC
    LIMIT ?
  `).all(runId, limit).reverse();
}
