# RPG Database

The connected Supabase application database was reset to an RPG-only state on 2026-10-01.

## Current application tables

- `public.game_sessions`
- `public.game_turns`
- `public.game_memories`
- `public.game_npc_states`
- `public.game_inventory`
- `public.game_agent_runs`
- `public.game_visual_assets`

Private support table:

- `private.ai_setup_tokens`

The former town simulation tables and data were removed, including residents, town memories, relationships, world events, activity logs, visitor state, town visual assets, and town world state.

The former `private.advance_world()` function and its cron job were also removed.

All RPG gameplay tables were reset to zero rows when the separation was performed. Old town/test player records were intentionally not migrated.

## Access model

All public gameplay tables have RLS enabled.

Direct `anon` and `authenticated` privileges are revoked from the gameplay tables. Persistence is handled through server-side Edge Functions.

The private setup-token table has direct privileges revoked from `public`, `anon`, and `authenticated`, with service-role access retained.

## Storage

`game-assets` remains the RPG asset bucket.

The separate site publishing bucket is not part of gameplay database state and was not deleted by the database reset.

## Source of truth

Schema source lives in `supabase/migrations/`.

Future schema changes should be backward-compatible unless the user explicitly approves destructive changes.

Do not reintroduce the former town simulation tables, resident data model, or `advance_world()` scheduler into this RPG project.
