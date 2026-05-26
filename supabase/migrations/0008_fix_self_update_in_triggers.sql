-- ============================================================================
-- 0008_fix_self_update_in_triggers.sql
--
-- BEFORE-UPDATE triggers on tickets cannot run their own UPDATE on the same
-- row — Postgres throws "tuple to be updated was already modified by an
-- operation triggered by the current command".
--
-- Refactor: split job-code creation into a side-effect-free helper
-- (_create_job_code) that returns the new id, and have BEFORE triggers set
-- new.job_code_id := <returned id> directly.
--
-- The standalone generate_job_code() function (used by repair scripts and
-- INSERT-time AI trigger) still runs the outer UPDATE since it's not called
-- from within a BEFORE trigger on the same row.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Side-effect-free helper: creates the job_codes row, returns (jc_id, jc_code).
-- Does NOT touch tickets.
--
-- DROP first because Postgres won't let CREATE OR REPLACE change the
-- OUT parameter signature.
-- ----------------------------------------------------------------------------
drop function if exists _create_job_code(uuid);

create function _create_job_code(p_ticket_id uuid)
returns table (jc_id uuid, jc_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand       text;
  v_client_id   uuid;
  v_client_code text;
  v_type        char(1);
  v_month       char(4) := to_char(now() at time zone 'Asia/Kolkata', 'MMYY');
  v_seq         int;
  v_code        text;
  v_jc_id       uuid;
begin
  -- Reuse existing if one exists
  select jc.id, jc.code into v_jc_id, v_code
    from job_codes jc
   where jc.ticket_id = p_ticket_id
   limit 1;
  if v_jc_id is not null then
    jc_id   := v_jc_id;
    jc_code := v_code;
    return next;
    return;
  end if;

  select c.brand_code, c.id, c.client_code,
         derive_type_code(t.request_type, t.classification)
    into v_brand, v_client_id, v_client_code, v_type
    from tickets t
    join clients c on c.id = t.client_id
   where t.id = p_ticket_id;

  if v_brand is null then
    raise exception 'Ticket % not found or has no client', p_ticket_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_brand || v_client_id::text || v_month || v_type)
  );

  insert into job_code_sequences (brand_code, client_id, month_key, type_code, last_seq)
       values (v_brand, v_client_id, v_month, v_type, 1)
  on conflict (brand_code, client_id, month_key, type_code)
    do update set last_seq = job_code_sequences.last_seq + 1
    returning last_seq into v_seq;

  v_code := v_brand || '-' || v_client_code || '-' || v_month || '-' || v_type
            || lpad(v_seq::text, 2, '0');

  insert into job_codes as jc (code, ticket_id, brand_code, client_id, month_key, type_code, sequence)
       values (v_code, p_ticket_id, v_brand, v_client_id, v_month, v_type, v_seq)
  on conflict (ticket_id) do update set code = excluded.code
       returning jc.id into v_jc_id;

  jc_id   := v_jc_id;
  jc_code := v_code;
  return next;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Public generate_job_code wraps _create_job_code AND updates the
-- ticket. Safe for external callers (not triggers).
-- ----------------------------------------------------------------------------
create or replace function generate_job_code(p_ticket_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_code text;
begin
  select jc_id, jc_code into v_id, v_code from _create_job_code(p_ticket_id);

  update tickets t
     set job_code_id = v_id,
         updated_at  = now()
   where t.id = p_ticket_id
     and (t.job_code_id is null or t.job_code_id <> v_id);

  return v_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. BEFORE-UPDATE trigger: sets new.job_code_id directly (no inner UPDATE)
-- ----------------------------------------------------------------------------
create or replace function tickets_job_code_on_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jc_id uuid;
  v_code  text;
begin
  if not (new.approval_stage = 'approved'
          and (old.approval_stage is null or old.approval_stage <> 'approved')
          and new.classification is not null) then
    return new;
  end if;

  if new.job_code_id is not null then
    new.status := 'approved';
    return new;
  end if;

  select jc_id, jc_code into v_jc_id, v_code from _create_job_code(new.id);
  new.job_code_id := v_jc_id;
  new.status := 'approved';
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. BEFORE-UPDATE classification router: same fix for the 'included' path
-- ----------------------------------------------------------------------------
create or replace function tickets_classification_router()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed_revisions int;
  v_rev_count int;
  v_jc_id uuid;
  v_code  text;
begin
  if (TG_OP = 'UPDATE' and new.classification is not distinct from old.classification) then
    return new;
  end if;
  if new.classification is null then
    return new;
  end if;

  if new.classification = 'included' then
    new.approval_stage := 'not_required';
    new.status         := 'approved';
    new.billing_status := 'not_billable';

    if new.job_code_id is null then
      select jc_id, jc_code into v_jc_id, v_code from _create_job_code(new.id);
      new.job_code_id := v_jc_id;
    end if;

  elsif new.classification = 'revision' then
    select allowed_revisions into v_allowed_revisions
      from clients where id = new.client_id;

    if new.parent_ticket_id is not null then
      select count(*) into v_rev_count
        from revisions
       where parent_ticket_id = new.parent_ticket_id;

      if v_rev_count >= coalesce(v_allowed_revisions, 0) then
        new.classification := 'extra_billable';
        new.approval_stage := 'pending_management';
        new.status         := 'waiting_approval';
        new.billing_status := 'pending_billing';
        insert into approvals (ticket_id, stage, decision, comment, estimated_amount)
        values (new.id, 'pending_management', 'requested',
                'Auto-routed: revision budget exhausted', new.estimated_amount);
      else
        new.approval_stage := 'not_required';
        new.status         := 'approved';
        new.billing_status := 'not_billable';
      end if;
    else
      new.approval_stage := 'not_required';
      new.status         := 'approved';
    end if;

  elsif new.classification = 'extra_billable' then
    new.approval_stage := 'pending_management';
    new.status         := 'waiting_approval';
    new.billing_status := 'pending_billing';
    insert into approvals (ticket_id, stage, decision, comment, estimated_amount)
    values (new.id, 'pending_management', 'requested', null, new.estimated_amount);

  elsif new.classification = 'goodwill' then
    new.approval_stage := 'pending_management';
    new.status         := 'waiting_approval';
    new.billing_status := 'not_billable';
    insert into approvals (ticket_id, stage, decision, comment, estimated_amount)
    values (new.id, 'pending_management', 'requested',
            'Goodwill — tracked, not billed', new.estimated_amount);

  elsif new.classification = 'out_of_scope' then
    new.approval_stage := 'pending_management';
    new.status         := 'waiting_approval';
    new.billing_status := 'not_billable';
    insert into approvals (ticket_id, stage, decision, comment)
    values (new.id, 'pending_management', 'requested', 'Out of scope — escalated');
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. AFTER INSERT routing — runs only for the 'included' case (job code).
-- AFTER trigger can safely UPDATE the row because it's not in the BEFORE
-- phase of the original INSERT.
-- ----------------------------------------------------------------------------
create or replace function tickets_classification_router_ai()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.classification = 'included' and new.job_code_id is null then
    perform generate_job_code(new.id);
  end if;
  return new;
end;
$$;
