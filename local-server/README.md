# Ollama Local RPG Server v0.1

第一個正式本地後端骨架。

## 功能

- Node.js / Express
- SQLite + WAL
- guest player / run session
- turns 永久回合紀錄
- deterministic settlement 先於 LLM
- Ollama 單工 queue，避免 RTX 3070 被多 request 同時灌爆
- Ollama 不可用時 deterministic fallback
- 每 run / IP 每分鐘 8 次行動
- 純文字手機優先 UI
- Ollama 只需維持在 127.0.0.1:11434

## Windows

安裝 Node.js 22 LTS 後，雙擊：

```
START.bat
```

或：

```powershell
npm install
$env:OLLAMA_MODEL="你的模型名稱"
npm start
```

瀏覽器：

```
http://127.0.0.1:3000
```

## 公開測試

Cloudflare Tunnel 應指向 Node server，不要指向 Ollama：

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

正確路徑：

Player -> Cloudflare -> Node RPG Server -> Ollama localhost:11434

## 下一步

- account/password
- admin dashboard
- true rule parser / movement graph
- NPC persistent state
- inventory transactions
- scenario JSON loader
- fixed Cloudflare Tunnel
- server-side auth/session cookies
