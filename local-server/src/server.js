import express from "express";
import helmet from "helmet";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePlayer, createRun, getRun, getRecentTurns, saveTurn } from "./db.js";
import { settleAction, fallbackNarrative } from "./engine.js";
import { enqueue, narrate } from "./ollama.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "16kb" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.resolve(__dirname, "../public")));

const buckets = new Map();
function allow(key) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < 60000);
  if (arr.length >= 8) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

app.get("/api/health", async (_req, res) => {
  let ollama = false;
  let models = [];
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    models = (j.models || []).map(m => m.name);
    ollama = r.ok;
  } catch {}
  res.json({ ok: true, ollama, model: OLLAMA_MODEL || models[0] || null, models });
});

app.post("/api/session", (req, res) => {
  const playerId = String(req.body?.playerId || crypto.randomUUID()).slice(0, 100);
  ensurePlayer(playerId);
  const runId = crypto.randomUUID();
  const run = createRun({ id: runId, playerId });
  res.json({ playerId, run });
});

app.get("/api/run/:id", (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return res.status(404).json({ error: "run_not_found" });
  res.json({ run, recent: getRecentTurns(run.id, 30) });
});

app.post("/api/run/:id/action", async (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return res.status(404).json({ error: "run_not_found" });

  const action = String(req.body?.action || "").trim();
  if (!action) return res.status(400).json({ error: "action_required" });
  if (action.length > 1000) return res.status(400).json({ error: "action_too_long" });

  const rateKey = String(req.ip || "unknown") + ":" + run.id;
  if (!allow(rateKey)) return res.status(429).json({ error: "rate_limited" });

  const settled = settleAction(run, action);
  const recent = getRecentTurns(run.id, 6);
  let narrative = "";
  let ai = false;

  const model = OLLAMA_MODEL || (await (async () => {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`);
      const j = await r.json();
      return j.models?.[0]?.name || "";
    } catch { return ""; }
  })());

  if (model) {
    try {
      narrative = await enqueue(() => narrate({
        model, ollamaUrl: OLLAMA_URL, settled, action, recent
      }));
      ai = Boolean(narrative);
    } catch {}
  }

  if (!narrative) narrative = fallbackNarrative(settled, action);

  const updated = saveTurn({ run, action, settled, narrative });
  res.json({
    ai,
    turn: updated.turn,
    time: updated.world_time,
    location: updated.location,
    state: updated.state,
    narrative,
    summary: settled.summary
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`RPG server: http://127.0.0.1:${PORT}`);
  console.log(`Ollama: ${OLLAMA_URL}`);
});
