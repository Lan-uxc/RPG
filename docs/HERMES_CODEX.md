# Samsung / Hermes / Codex OAuth

## Goal

Samsung phone is the remote development workstation.

```
Telegram
  ↓
Hermes
  ↓
OpenAI Codex OAuth provider
  ↓
~/RPG
  ↓
git
  ↓
GitHub
```

Supabase remains the live database and backend.

## Current local checkout

Repository is cloned directly to:

```bash
~/RPG
```

Remote:

```text
https://github.com/Lan-uxc/RPG.git
```

## Important

Hermes already uses the OpenAI Codex OAuth provider.

Do **not** install or depend on a separate Codex CLI for this project.

The normal Telegram workflow is:

> 進入 ~/RPG，先 git pull。閱讀 AGENTS.md 與相關 docs，再處理我的任務。不要動正式玩家資料。完成後回報修改內容、測試結果與 git diff 摘要。

## Sync rule

Before every coding task:

```bash
cd ~/RPG
git pull
git status
```

After every coding task:

```bash
git status
git diff
```

Push only when the user explicitly asks for it or when an agreed automation rule permits it.

## Android note

Termux background execution can be interrupted by Android battery management. Hermes should report interruptions rather than silently retry destructive operations.
