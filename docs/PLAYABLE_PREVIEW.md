# 霧港試煉可玩測試版（獨立入口）

網址：https://zegqmtlfoiczuyvkwrsl.supabase.co/functions/v1/rpg-play-v1

此版本是與原始 Normandy RPG **並行**的可玩垂直切片，沒有覆蓋正式前端、原始 `game_*` 資料表或玩家存檔。

## 已具備
- 公開網頁建立單人角色、裝置上儲存隨機存檔憑證、使用雜湊核對讀取
- 五個原創場景、有限合法路線與自由文字行動
- 回合、世界時間、線索、人物關係、危險度與回合歷史保存在 Supabase
- 建議選項只是輸入捷徑，玩家可自行描述動作
- 對目前回合採資料庫條件更新防止舊頁面覆蓋，失敗保留輸入
- 手機單欄版，當前敘事為主、過往敘事收合

## 部署
1. 套用 `supabase/migrations/20261018_rpg_playable_preview.sql`（可重複執行、只新增資料表）。
2. 在 Supabase 專案 Edge Functions 部署 `supabase/functions/rpg-play-v1/index.ts`，函式名稱 `rpg-play-v1`，`verify_jwt=false`（函式自行使用每玩家的隨機憑證驗證存檔）。
3. 檢查 `GET /functions/v1/rpg-play-v1?health=1`、一般 GET 頁面以及 POST new/load/act。
4. 確認角色、回合、線索等重新整理後存在，再公開分享網址。

## 限制與待改善
- **尚未接入 Ollama**：劇情目前是確定性規則搭配原創模板；不可稱為已啟用 AI 自由敘事。
- 狀態更新與回合事件寫入仍非單一資料庫交易；併發條件檢查只是第一道防護，需資料庫 RPC 原子化提交。
- 尚未實際從獨立外部用戶端完成端對端 POST 驗證。
- 此 URL 是測試用公開入口，並非原有主網域。
- 預覽版使用瀏覽器 localStorage 保留通行憑證；清除瀏覽器儲存可能遺失存檔入口。正式登入需另實作。
