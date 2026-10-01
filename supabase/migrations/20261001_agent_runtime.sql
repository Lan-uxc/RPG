create schema if not exists private;

create table if not exists public.game_agent_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.game_sessions(id) on delete cascade,
  turn_no integer,
  agent_role text not null,
  model text not null,
  reasoning_effort text,
  status text not null default 'started',
  input_summary text,
  output_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.game_visual_assets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.game_sessions(id) on delete cascade,
  asset_key text not null,
  asset_type text not null,
  subject_key text,
  storage_path text not null,
  public_url text,
  prompt text not null,
  model text not null default 'gpt-image-2',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id, asset_key)
);

alter table public.game_agent_runs enable row level security;
alter table public.game_visual_assets enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('game-assets','game-assets',true,10485760,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public=true,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create table if not exists private.ai_setup_tokens (
  token_hash text primary key,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.game_ai_setup_token_valid(p_token_hash text)
returns boolean
language sql
security definer
set search_path = private, public
as $$
  select exists(
    select 1 from private.ai_setup_tokens
    where token_hash = p_token_hash
      and used_at is null
      and expires_at > now()
  );
$$;

create or replace function public.game_ai_setup_token_consume(p_token_hash text)
returns void
language sql
security definer
set search_path = private, public
as $$
  update private.ai_setup_tokens
  set used_at = now()
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > now();
$$;
