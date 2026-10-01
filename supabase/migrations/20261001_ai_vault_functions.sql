create or replace function public.game_ai_secret_get(p_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
  order by created_at desc
  limit 1;
$$;

create or replace function public.game_ai_secret_upsert(p_name text, p_value text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from vault.decrypted_secrets
  where name = p_name
  order by created_at desc
  limit 1;

  if v_id is null then
    return vault.create_secret(p_value, p_name, 'AI key for RPG');
  else
    perform vault.update_secret(v_id, p_value, p_name, 'AI key for RPG');
    return v_id;
  end if;
end;
$$;

revoke all on function public.game_ai_secret_get(text) from public, anon, authenticated;
revoke all on function public.game_ai_secret_upsert(text,text) from public, anon, authenticated;

grant execute on function public.game_ai_secret_get(text) to service_role;
grant execute on function public.game_ai_secret_upsert(text,text) to service_role;
