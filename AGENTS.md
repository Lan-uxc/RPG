# AGENTS.md

這個 repository 由 Hermes / Hermes 內建 OpenAI Codex provider / ChatGPT 協作維護。

## 最高優先規則

1. 不可刪除或重置正式玩家資料。
2. 修改 schema 時必須採向後相容 migration；禁止 drop 正式 game tables，除非使用者明確批准。
3. 不得把 API key、service role key、session token、Telegram token 寫入 repository。
4. 世界規則引擎的硬事實優先於小說模型。
5. LLM 不得自行修改已結算的死亡、傷勢、時間、物品消耗、位置、NPC 狀態或既定副本真相。
6. 先修最小範圍，再做重構。
7. 修改後至少檢查：Edge Function 編譯、API GET health、new session、load session、act 一回合。
8. 若 AI 不可用，遊戲必須保留 deterministic fallback，不可整站失效。

## 敘事核心

- 副本真相固定，但故事不存在固定劇本。
- NPC 有自己的 goal / fear / information / interests / bottom line。
- 不因戲劇性強行背叛。
- 死亡與重大後果永久進入人物和世界歷史。
- 每個有效行動至少推進資訊、關係、資源、危險、世界變化、假設排除、結果或代價之一。
- 不連續兩回合只有氣氛描寫。
- 有限視角，不直接公布玩家無法得知的真相。
- 選項必須是角色當下能實際執行的行動，不可顯示「人物線、上一回合、改變策略、追新事件」等引擎語言。

## Coding Agent

Coding Agent 在 Samsung / Hermes 環境以 Hermes 內建 OpenAI Codex provider + ChatGPT 登入執行，不使用 OpenAI API coding route。

典型流程：

```bash
git pull
codex exec "閱讀 AGENTS.md。完成指定修正，保留現有玩家資料，修改後執行測試並回報 git diff。"
git diff
```

除非使用者明確要求，Codex 不應自動 push production deployment。
