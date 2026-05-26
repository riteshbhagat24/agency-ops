-- ============================================================================
-- 0007_invoice_timing_and_fixes.sql
--
-- Fixes:
--   1. generate_job_code() is now idempotent — returns the existing code if
--      one already exists, instead of erroring on the unique constraint.
--      (Root cause of the "approval click does nothing" bug: the previous
--      attempt left a job_code row that blocked retries.)
--
--   2. clients.invoice_timing: per-client setting for when invoices are
--      raised (advance_100 / advance_50_50 / on_approval / on_delivery).
--
--   3. Extra-billable tickets get a DRAFT invoice (via a draft billable)
--      the moment they are classified, so AMs can see the commercial impact
--      immediately without waiting for client sign-off. Once the approvals
--      complete, the billable's status flips from `not_billable` (draft) to
--      `pending_billing` so it lands on the next invoice export.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Idempotent generate_job_code
-- ----------------------------------------------------------------------------
create or replace function generate_job_code(p_ticket_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand     text;
  v_client_id uuid;
  v_client_code text;
  v_type      char(1);
  v_month     char(4) := to_char(now() at time zone 'Asia/Kolkata', 'MMYY');
  v_seq       int;
  v_code      text;
  v_jc_id     uuid;
  v_existing  text;
begin
  -- If a job code already exists for this ticket, return it. Makes the
  -- function safe to call from triggers that may fire more than once.
  select jc.code into v_existing
    from job_codes jc
   where jc.ticket_id = p_ticket_id
   limit 1;
  if v_existing is not null then
    return v_existing;
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

  insert into job_codes (code, ticket_id, brand_code, client_id, month_key, type_code, sequence)
       values (v_code, p_ticket_id, v_brand, v_client_id, v_month, v_type, v_seq)
  on conflict (ticket_id) do update set code = excluded.code
       returning id into v_jc_id;

  update tickets
     set job_code_id = v_jc_id,
         updated_at  = now()
   where id = p_ticket_id;

  return v_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. invoice_timing on clients
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_timing') then
    create type invoice_timing as enum (
      'advance_100',      -- Full 100% advance invoice on approval
      'advance_50_50',    -- 50% advance on approval, 50% on delivery
      'on_approval',      -- Single invoice raised on approval (default)
      'on_delivery'       -- Invoice only after work delivered
    );
  end if;
end$$;

alter table clients
  add column if not exists invoice_timing invoice_timing not null default 'on_approval';

-- ----------------------------------------------------------------------------
-- 3. Draft billable when extra_billable classification is set
--
-- A "draft" billable has status='not_billable' so it doesn't get billed yet.
-- The auto-invoice trigger on billables creates a DRAFT invoice for it.
-- When approvals complete, the existing tickets_to_billable trigger flips
-- the billable to status='pending_billing' (we'll update that path too).
-- ----------------------------------------------------------------------------

create or replace function tickets_draft_billable_on_classify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period   char(7);
  v_currency char(3);
  v_timing   invoice_timing;
begin
  -- Only for the billable classification, and only on transitions
  if new.classification is null
     or new.classification not in ('extra_billable', 'goodwill') then
    return new;
  end if;

  if (TG_OP = 'UPDATE'
      and old.classification is not distinct from new.classification) then
    return new;
  end if;

  -- Don't draft if client is set to on_delivery (they want invoice only after delivery)
  select coalesce(currency, 'INR'), coalesce(invoice_timing, 'on_approval')
    into v_currency, v_timing
    from clients where id = new.client_id;

  if v_timing = 'on_delivery' then
    return new;  -- skip; wait for delivery
  end if;

  v_period := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');

  insert into billables (
    ticket_id, client_id, job_code_id, classification,
    amount, currency, billing_period, status
  )
  values (
    new.id, new.client_id, new.job_code_id, new.classification,
    coalesce(new.estimated_amount, 0),
    v_currency,
    v_period,
    'not_billable'::billing_status  -- draft until approval flips it
  )
  on conflict (ticket_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_tickets_draft_billable_ai on tickets;
create trigger trg_tickets_draft_billable_ai
after insert on tickets
for each row execute function tickets_draft_billable_on_classify();

drop trigger if exists trg_tickets_draft_billable_au on tickets;
create trigger trg_tickets_draft_billable_au
after update of classification on tickets
for each row execute function tickets_draft_billable_on_classify();

-- ----------------------------------------------------------------------------
-- 4. Update tickets_to_billable to FLIP existing billable from draft to
-- pending_billing on approval (instead of inserting a new one)
-- ----------------------------------------------------------------------------

create or replace function tickets_to_billable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period   char(7);
  v_currency char(3);
  v_timing   invoice_timing;
begin
  if new.classification is null
     or new.classification not in ('extra_billable', 'goodwill') then
    return new;
  end if;

  if not (new.approval_stage = 'approved'
          and (old.approval_stage is null or old.approval_stage <> 'approved')) then
    return new;
  end if;

  v_period := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');

  select coalesce(currency, 'INR'), coalesce(invoice_timing, 'on_approval')
    into v_currency, v_timing
    from clients where id = new.client_id;

  if v_timing = 'on_delivery' then
    -- Don't create yet; tickets_to_billable_on_delivery handles this
    new.billing_status := 'not_billable';
    return new;
  end if;

  -- If a draft already exists, flip it to pending_billing
  update billables
     set status = 'pending_billing'::billing_status,
         job_code_id = new.job_code_id,
         updated_at = now()
   where ticket_id = new.id
     and status = 'not_billable';

  -- If no draft exists yet (e.g. client was on_delivery and got switched),
  -- create one now
  insert into billables (
    ticket_id, client_id, job_code_id, classification,
    amount, currency, billing_period, status
  )
  values (
    new.id, new.client_id, new.job_code_id, new.classification,
    coalesce(new.estimated_amount, 0),
    v_currency,
    v_period,
    (case when new.classification = 'goodwill' then 'not_billable' else 'pending_billing' end)::billing_status
  )
  on conflict (ticket_id) do nothing;

  new.billing_status := (case
    when new.classification = 'goodwill' then 'not_billable'
    else 'pending_billing'
  end)::billing_status;

  return new;
end;
$$;

-- The trigger binding from 0006 is still correct (BEFORE UPDATE OF approval_stage)

-- ----------------------------------------------------------------------------
-- 5. On-delivery billable for clients that set invoice_timing='on_delivery'
-- ----------------------------------------------------------------------------
create or replace function tickets_to_billable_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period   char(7);
  v_currency char(3);
  v_timing   invoice_timing;
begin
  if new.classification is null
     or new.classification not in ('extra_billable', 'goodwill') then
    return new;
  end if;

  if not (new.status = 'delivered'
          and (old.status is null or old.status <> 'delivered')) then
    return new;
  end if;

  select coalesce(currency, 'INR'), coalesce(invoice_timing, 'on_approval')
    into v_currency, v_timing
    from clients where id = new.client_id;

  v_period := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');

  -- For on_delivery clients, create the billable now (didn't earlier)
  if v_timing = 'on_delivery' then
    insert into billables (
      ticket_id, client_id, job_code_id, classification,
      amount, currency, billing_period, status
    )
    values (
      new.id, new.client_id, new.job_code_id, new.classification,
      coalesce(new.estimated_amount, 0),
      v_currency,
      v_period,
      (case when new.classification = 'goodwill' then 'not_billable' else 'pending_billing' end)::billing_status
    )
    on conflict (ticket_id) do update set
      status = excluded.status,
      job_code_id = excluded.job_code_id,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_billable_on_delivery on tickets;
create trigger trg_tickets_billable_on_delivery
before update of status on tickets
for each row execute function tickets_to_billable_on_delivery();
