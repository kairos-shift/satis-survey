-- =====================================================================
-- BBT Orientation Satisfaction Survey 2569 — Supabase Schema
-- Run this entire file once in the Supabase SQL editor.
-- =====================================================================

-- Enable bcrypt/pgcrypto for password hashing
create extension if not exists pgcrypto;

-- =====================================================================
-- 1. survey_config — holds PIN + master key hashes
-- =====================================================================
create table if not exists survey_config (
  survey_id        text primary key,
  pin_hash         text not null,
  master_key_hash  text not null,
  master_key_hashes text[] not null default '{}',
  active           boolean default true,
  created_at       timestamptz default now()
);

alter table survey_config
  add column if not exists master_key_hashes text[] not null default '{}';

-- Lock down the config table entirely.
-- No policies = no direct access for anon or authenticated.
-- Only the SECURITY DEFINER RPCs below can read it.
alter table survey_config enable row level security;

-- =====================================================================
-- 2. orientation_responses_2569 — the actual survey responses
-- =====================================================================
create table if not exists orientation_responses_2569 (
  id              uuid primary key default gen_random_uuid(),
  submitted_date  date default current_date,  -- DATE only, never timestamptz
  payload         jsonb not null
);

alter table orientation_responses_2569 enable row level security;

-- Anonymous clients can INSERT only (for the survey form)
drop policy if exists "anon_insert_only" on orientation_responses_2569;
create policy "anon_insert_only" on orientation_responses_2569
  for insert
  to anon
  with check (true);

grant insert on orientation_responses_2569 to anon;

-- No SELECT policy for anon.
-- Admin reads go through the get_responses() RPC below,
-- which verifies the master key server-side.

-- =====================================================================
-- 3. Seed survey config with PIN and Master Key
-- =====================================================================
-- Participant PIN: LuvluvBBT (case-sensitive, 9 chars)
-- Master Keys:    10758, 1553
insert into survey_config (survey_id, pin_hash, master_key_hash, master_key_hashes, active)
values (
  'orientation_2569',
  crypt('LuvluvBBT', gen_salt('bf')),
  crypt('10758',     gen_salt('bf')),
  array[
    crypt('10758', gen_salt('bf')),
    crypt('1553',  gen_salt('bf'))
  ],
  true
)
on conflict (survey_id) do update
  set pin_hash         = excluded.pin_hash,
      master_key_hash  = excluded.master_key_hash,
      master_key_hashes = excluded.master_key_hashes,
      active           = excluded.active;

-- =====================================================================
-- 4. verify_survey_pin — called from participant gate
-- =====================================================================
create or replace function verify_survey_pin(
  p_survey_id text,
  p_pin       text
) returns boolean
language plpgsql
security definer
as $$
declare
  stored_hash  text;
  is_active    boolean;
begin
  select pin_hash, active
    into stored_hash, is_active
    from survey_config
   where survey_id = p_survey_id;

  if stored_hash is null or not is_active then
    return false;
  end if;

  return stored_hash = crypt(p_pin, stored_hash);
end;
$$;

grant execute on function verify_survey_pin(text, text) to anon;

-- =====================================================================
-- 5. verify_master_key — called from admin gate
-- =====================================================================
create or replace function verify_master_key(
  p_survey_id text,
  p_key       text
) returns boolean
language plpgsql
security definer
as $$
declare
  stored_hash text;
  stored_hashes text[];
  is_active boolean;
begin
  select master_key_hash, master_key_hashes, active
    into stored_hash, stored_hashes, is_active
    from survey_config
   where survey_id = p_survey_id;

  if not coalesce(is_active, false) then
    return false;
  end if;

  if stored_hash is null and coalesce(array_length(stored_hashes, 1), 0) = 0 then
    return false;
  end if;

  if stored_hash is not null and stored_hash = crypt(p_key, stored_hash) then
    return true;
  end if;

  return exists (
    select 1
      from unnest(coalesce(stored_hashes, '{}')) as keys(stored_key_hash)
     where stored_key_hash = crypt(p_key, stored_key_hash)
  );
end;
$$;

grant execute on function verify_master_key(text, text) to anon;

-- =====================================================================
-- 6. get_responses — admin data access, master-key gated
-- =====================================================================
-- This is the ONLY way the client can read responses.
-- It re-verifies the master key on every call. Raises exception on failure.
create or replace function get_responses(
  p_survey_id text,
  p_key       text
) returns setof orientation_responses_2569
language plpgsql
security definer
as $$
begin
  if not verify_master_key(p_survey_id, p_key) then
    raise exception 'unauthorized';
  end if;

  return query
    select *
      from orientation_responses_2569
     order by submitted_date desc, id desc;
end;
$$;

grant execute on function get_responses(text, text) to anon;

-- =====================================================================
-- 7. Verification queries (run these after setup to confirm)
-- =====================================================================
-- Expected results shown as comments.

-- select verify_survey_pin('orientation_2569', 'LuvluvBBT');   -- true
-- select verify_survey_pin('orientation_2569', 'wrong');        -- false
-- select verify_master_key('orientation_2569', '10758');        -- true
-- select verify_master_key('orientation_2569', '1553');         -- true
-- select verify_master_key('orientation_2569', 'wrong');        -- false

-- Confirm anon cannot SELECT responses directly (should return permission error):
-- set role anon;
-- select * from orientation_responses_2569;
-- reset role;

-- =====================================================================
-- End of schema
-- =====================================================================
