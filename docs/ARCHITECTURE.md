# Architecture

## Request flow

```
Player
  ↓
Frontend
  ↓
normandy-story-sandbox
  ↓
Deterministic Rule Engine
  ├─ action parser
  ├─ time cost
  ├─ world timeline
  ├─ NPC tick
  ├─ relationship / resource consequences
  └─ hard state settlement
  ↓
Director Agent (when configured)
  ↓
Narrator Agent (when configured)
  ↓
4 concrete next actions
  ↓
Supabase persistence
```

## Separation of responsibility

### Deterministic engine
Authoritative for:
- current time
- HP / stamina / focus
- location
- inventory
- NPC persistent state
- event threads
- death / injury
- ability conditions and costs
- fixed scenario truth

### Director Agent
May analyze:
- which active pressure deserves attention
- NPC motivation conflicts
- continuity
- scene dramatic focus
- four distinct action directions

It may not rewrite settled facts.

### Narrator Agent
Converts settled facts + director plan into readable Traditional Chinese prose and four natural in-world actions.

### Coding Agent
Runs outside the game server:
- Samsung
- Hermes Agent
- Codex CLI
- ChatGPT sign-in

It is for repository maintenance only.

### Art Agent
On-demand only. Visual assets are not required for the text RPG to continue functioning.

## Persistence

Live player state stays in Supabase:
- game_sessions
- game_turns
- game_memories
- game_npc_states
- game_inventory
- game_agent_runs
- game_visual_assets

GitHub contains source code and migrations only.
