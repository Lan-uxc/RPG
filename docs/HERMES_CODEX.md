# Samsung / Hermes / Codex CLI

## Goal

Samsung phone is the remote development workstation.

```
Telegram
  ↓
Hermes
  ↓
local RPG git checkout
  ↓
Codex CLI
  ↓
tests / diff / commit
  ↓
GitHub
```

Supabase remains the live database and backend.

## First-time setup

When the Samsung phone is physically available:

1. Prepare Termux / Hermes.
2. Install Git.
3. Clone this repository.
4. Install official Codex CLI where supported.
5. Run Codex once and choose Sign in with ChatGPT.
6. Confirm Codex can read this repository.
7. Keep credentials local; never commit them.

Target checkout:

```bash
mkdir -p ~/smalltown
cd ~/smalltown
git clone https://github.com/Lan-uxc/RPG.git
cd RPG
```

## Telegram usage after initial setup

Example message to Hermes:

> 進入 RPG 專案，git pull。讓 Codex 先閱讀 AGENTS.md，再檢查目前選項系統。不要動正式玩家資料。修完後執行測試並把 git diff 摘要傳給我。

Hermes should translate that into a local Codex task rather than calling an OpenAI coding API.

## Android note

Termux background execution can be interrupted by Android battery management. For persistent Telegram control, exempt Termux/Hermes from aggressive battery optimization where possible.

## Sync rule

Before every coding task:
```bash
git pull
```

After every coding task:
```bash
git status
git diff
```

Push only after review or an explicit automation rule permits it.
