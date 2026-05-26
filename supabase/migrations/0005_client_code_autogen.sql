-- ============================================================================
-- 0005_client_code_autogen.sql
--
-- Adds atomic client-code auto-generation with format:
--   <BRAND><DDMMYY>/<N>
-- Examples:
--   FRM250526/0
--   FRM250526/1
--   OV250226/0
--
-- N starts at 0 and increments per same-day same-brand client.
-- If a client is soft-deleted, its code becomes available again for reuse.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Switch unique constraint to deleted-aware (soft-delete frees the code)
-- ----------------------------------------------------------------------------
alter table clients drop constraint if exists clients_client_code_key;
drop index if exists clients_client_code_key;
drop index if exists clients_client_code_unique;

create unique index clients_client_code_unique
  on clients(client_code)
  where deleted_at is null;

-- ----------------------------------------------------------------------------
-- 2. Generator function
--
-- Uses pg_advisory_xact_lock so concurrent inserts on the same day for the
-- same brand can't pick the same number.
-- ----------------------------------------------------------------------------
create or replace function generate_client_code(p_brand_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date_part text := to_char(now() at time zone 'Asia/Kolkata', 'DDMMYY');
  v_prefix    text;
  v_used      int[];
  v_next_num  int := 0;
begin
  if p_brand_code is null or length(p_brand_code) = 0 then
    raise exception 'brand_code is required';
  end if;

  v_prefix := p_brand_code || v_date_part || '/';

  -- Lock per (brand, date) so two clients added in the same second don't
  -- end up with the same number. Released at transaction end.
  perform pg_advisory_xact_lock(hashtext(v_prefix));

  -- Collect numbers already used today by ACTIVE clients only.
  -- Soft-deleted rows are ignored, so their codes become reusable.
  select coalesce(
    array_agg(
      (substring(client_code from length(v_prefix) + 1))::int
    ),
    array[]::int[]
  )
  into v_used
  from clients
  where client_code like v_prefix || '%'
    and deleted_at is null
    and substring(client_code from length(v_prefix) + 1) ~ '^[0-9]+$';

  -- Find lowest gap starting from 0.
  -- e.g. used = {0,1,3} → next = 2; used = {0,1,2} → next = 3; used = {} → next = 0
  while v_next_num = any(v_used) loop
    v_next_num := v_next_num + 1;
  end loop;

  return v_prefix || v_next_num::text;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. (Optional) Cleanup helper: hard-delete a soft-deleted client.
-- Frees the slot entirely AND removes the audit-log historical reference
-- only after a grace period. Restricted to super_admin.
-- ----------------------------------------------------------------------------
create or replace function purge_client(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select current_user_role()) <> 'super_admin' then
    raise exception 'Only super_admin can purge clients';
  end if;

  if not exists (
    select 1 from clients
    where id = p_client_id
      and deleted_at is not null
      and deleted_at < now() - interval '30 days'
  ) then
    raise exception 'Client must be soft-deleted for at least 30 days before purge';
  end if;

  delete from clients where id = p_client_id;
end;
$$;
