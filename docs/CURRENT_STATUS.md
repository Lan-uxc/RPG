# Current Status

## Repository

- Owner: Lan-uxc
- Repository: RPG
- Visibility: Private
- Main branch: main

## Samsung

The Samsung phone has successfully cloned the repository to:

```text
~/RPG
```

Verified local state reported by Hermes:
- origin points to `https://github.com/Lan-uxc/RPG.git`
- branch: `main`
- local branch is up to date with `origin/main`
- working tree clean

## Live backend

Supabase project reference:
- zegqmtlfoiczuyvkwrsl

Primary Edge Functions mirrored in this repository:
- normandy-story-sandbox
- game-agent-hub
- configure-game-ai

## Coding Agent

Current mode:
- Samsung phone
- Hermes Agent
- Hermes built-in OpenAI Codex provider
- OpenAI Codex OAuth
- no separate Codex CLI
- no OpenAI coding API route

## Live player data

Live player data remains only in Supabase and is intentionally excluded from GitHub.

## AI runtime

Director / Narrator API integration exists in backend source but requires an explicitly configured OpenAI API key. If no key is configured, deterministic fallback remains active.

Art generation is also API-dependent and separate from Hermes repository maintenance.
