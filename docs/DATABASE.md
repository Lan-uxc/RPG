# RPG Database

The connected Supabase application database was reset to an RPG-only state on 2026-10-01.

## Current application tables

- `public.game_scenarios`
- `public.game_places`
- `public.game_routes`
- `public.game_sessions`
- `public.game_turns`
- `public.game_memories`
- `public.game_npc_states`
- `public.game_inventory`
- `public.game_threads`
- `public.game_agent_runs`
- `public.game_visual_assets`

Private support table:

- `private.ai_setup_tokens`

The former town simulation tables and data were removed, including residents, town memories, relationships, world events, activity logs, visitor state, town visual assets, and town world state.

The former `private.advance_world()` function was also removed.

All RPG gameplay/session tables were reset to zero rows when the separation was performed. Old town/test player records were intentionally not migrated.

## World graph

The RPG now has database-level scenario, place, route, and event-thread structures so the open world does not have to live only inside one JSON blob.

Current seeded scenario:

- `normandy_1944`

Initial place nodes:

- `normandy_open`
- `omaha_waterline`
- `omaha_shingle`
- `omaha_high`
- `inland_hedgerow`

Initial routes connect the landing craft, waterline, shingle/seawall, high ground, and inland hedgerow areas.

## Access model

All public gameplay tables have RLS enabled.

Direct `anon` and `authenticated` privileges are revoked from gameplay tables. Persistence is handled through server-side Edge Functions using server-side authorization.

The Supabase security advisor may report “RLS enabled with no policy” for these tables. That is expected for this server-only access model because no permissive browser/client policies are intended.

## Storage

`game-assets` remains the RPG asset bucket.

## Source of truth

Schema source lives in `supabase/migrations/`, including `20261001_rpg_world_graph.sql`.

Future schema changes should be backward-compatible unless the user explicitly approves destructive changes.

Do not reintroduce the former town simulation tables, resident data model, or `advance_world()` scheduler into this RPG project.
