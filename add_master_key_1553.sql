-- Add 1553 as an additional admin/report master key.
-- Run this in the Supabase SQL editor for the existing orientation_2569 project.

create extension if not exists pgcrypto;

alter table survey_config
  add column if not exists master_key_hashes text[] not null default '{}';

update survey_config
   set master_key_hashes = array[
         master_key_hash,
         crypt('1553', gen_salt('bf'))
       ]
 where survey_id = 'orientation_2569';

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

select verify_master_key('orientation_2569', '10758') as old_master_key_ok,
       verify_master_key('orientation_2569', '1553')  as new_master_key_ok;
