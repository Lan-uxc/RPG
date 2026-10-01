# Hermes → Codex Task Template

Hermes 在呼叫 Codex CLI 前，先切到 RPG repository 並同步：

```bash
cd ~/smalltown/RPG
git pull
```

建議給 Codex 的固定前綴：

> 先閱讀 AGENTS.md、README.md 與 docs/ARCHITECTURE.md。  
> 這是正式 RPG 專案。不可刪除、重置或改寫現有玩家資料。  
> 優先做最小安全修正。修改程式後執行可行的測試，最後回報：修改檔案、原因、測試結果、git diff 摘要。  
> 不要自行部署 production，除非這次任務明確要求。

然後接使用者從 Telegram 傳來的實際工作內容。

## Example

使用者：

> 檢查選項為什麼又出現引擎文字，修好但不要動玩家存檔。

Hermes 對 Codex：

```text
先閱讀 AGENTS.md、README.md 與 docs/ARCHITECTURE.md。
不可刪除、重置或改寫現有玩家資料。
優先做最小安全修正。
任務：檢查選項為什麼又出現引擎文字，修好但不要動玩家存檔。
完成後執行測試，回報修改檔案、原因、測試結果與 git diff 摘要。
不要自行部署 production。
```
