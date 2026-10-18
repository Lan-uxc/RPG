-- Additive preview schema: original game_* tables and player saves are untouched.
create table if not exists public.rpg_play_sessions (
  id uuid primary key default gen_random_uuid(),
  access_hash text not null unique,
  player_name text not null,
  turn_no integer not null default 0,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.rpg_play_turns (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.rpg_play_sessions(id) on delete cascade,
  turn_no integer not null,
  intent text not null,
  action_type text not null,
  narrative text not null,
  state_delta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id,turn_no)
);
create index if not exists rpg_play_turns_session_idx on public.rpg_play_turns(session_id,turn_no desc);
alter table public.rpg_play_sessions enable row level security;
alter table public.rpg_play_turns enable row level security;
revoke all on public.rpg_play_sessions from anon, authenticated;
revoke all on public.rpg_play_turns from anon, authenticated;
