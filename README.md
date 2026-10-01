# RPG / 小鎮：Agent RPG

這是目前「小鎮」專案中的開放世界文字 RPG / 歷史副本實驗版本。

## 目前架構

- **Frontend**：單頁手機優先文字 RPG
- **Backend**：Supabase Edge Functions
- **Database**：Supabase Postgres
- **世界規則**：deterministic rule engine，先決定不可被 LLM 改寫的硬事實
- **Director / Narrator**：規劃為 GPT-5.6 Sol / high reasoning
- **Coding Agent**：Samsung / Hermes 上的 Codex CLI + ChatGPT 登入
- **Art Agent**：按需圖片生成
- **正式玩家資料**：只存在 Supabase，不提交 GitHub

## 目錄

```
frontend/
  index.html

supabase/
  functions/
    normandy-story-sandbox/
    game-agent-hub/
    configure-game-ai/
  migrations/

docs/
  ARCHITECTURE.md
  GAME_RULES.md
  HERMES_CODEX.md
  DEPLOYMENT.md

AGENTS.md
```

## 核心原則

> 副本真相固定，但故事不存在固定劇本。

規則引擎負責世界真相、時間、位置、傷勢、物品、能力條件、死亡與不可逆結果；LLM 只能在這些硬事實之上做導演、人物推理與小說化敘事。

## 安全

此 repository **不得提交**：

- OpenAI API Key
- Supabase service role key
- Session access token
- 玩家存檔資料
- 一次性設定 token
- 任何 Telegram bot token

見 `.gitignore` 與 `AGENTS.md`。

## Samsung / Hermes

目標工作流：

```
Telegram
  → Hermes Agent
  → git pull
  → Codex CLI（Sign in with ChatGPT）
  → 修改 / 測試
  → git diff
  → commit / push
```

詳細見 `docs/HERMES_CODEX.md`。
