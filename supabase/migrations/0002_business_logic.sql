-- ============================================================================
-- 0002_business_logic.sql
-- Job code engine, classification router, approval transitions,
-- billables generation, audit trail.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Type derivation: from request_type + classification → single-char type code
-- ----------------------------------------------------------------------------
create or replace function derive_type_code(
  p_request_type text,
  p_classification classification
) returns char(1)
language sql
immutable
as $$
  select case
    when p_classification = 'extra_billable' then 'E'
    when p_request_type = 'shoot' then 'S'
    when p_request_type in ('video','reel-long','edit') then 'V'
    when p_request_type = 'campaign' then 'C'
    else 'R'
  end::char(1);
$$;

-- ----------------------------------------------------------------------------
-- Atomic job code generator.
-- Uses a transaction-scoped advisory lock per (brand,client,month,type)
-- to prevent duplicate sequence numbers under concurrent inserts.
-- ----------------------------------------------------------------------------
create or replace function generate_job_code(p_ticket_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand        text;
  v_client_id    uuid;
  v_client_code  text;
  v_type         char(1);
  v_month        char(4) := to_char((now() at time zone 'Asia/Kolkata'), 'MMYY');
  v_seq          int;
  v_code         text;
  v_jc_id        uuid;
begin
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
       returning id into v_jc_id;

  update tickets
     set job_code_id = v_jc_id,
         updated_at  = now()
   where id = p_ticket_id;

  return v_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- Classification router.
-- Fires on tickets when classification is first set (NULL -> value)
-- or changed.  Decides next approval_stage and status.
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
begin
  -- only act when classification transitions
  if (TG_OP = 'UPDATE' and new.classification is not distinct from old.classification) then
    return new;
  end if;

  if new.classification is null then
    return new;
  end if;

  -- INCLUDED → auto-approve, no approval stage
  if new.classification = 'included' then
    new.approval_stage := 'not_required';
    new.status := 'approved';
    new.billing_status := 'not_billable';

  -- REVISION → check budget against parent
  elsif new.classification = 'revision' then
    select allowed_revisions into v_allowed_revisions
      from clients where id = new.client_id;

    if new.parent_ticket_id is not null then
      select count(*) into v_rev_count
        from revisions
       where parent_ticket_id = new.parent_ticket_id;

      if v_rev_count >= coalesce(v_allowed_revisions, 0) then
        -- budget exhausted → escalate to extra billable
        new.classification := 'extra_billable';
        new.approval_stage := 'pending_management';
        new.status := 'waiting_approval';
        new.billing_status := 'pending_billing';

        insert into approvals (ticket_id, stage, decision, comment, estimated_amount)
        values (new.id, 'pending_management', 'requested',
                'Auto-routed: revision budget exhausted', new.estimated_amount);
      else
        new.approval_stage := 'not_required';
        new.status := 'approved';
        new.billing_status := 'not_billable';
      end if;
    else
      new.approval_stage := 'not_required';
      new.status := 'approved';
    end if;

  -- EXTRA BILLABLE → management approval first
  elsif new.classification = 'extra_billable' then
    new.approval_stage := 'pending_management';
    new.status := 'waiting_approval';
    new.billing_status := 'pending_billing';

    insert into approvals (ticket_id, stage, decision, comment, estimated_amount)
    values (new.id, 'pending_management', 'requested', null, new.estimated_amount);

  -- GOODWILL → management only
  elsif new.classification = 'goodwill' then
    new.approval_stage := 'pending_management';
    new.status := 'waiting_approval';
    new.billing_status := 'not_billable';

    insert into approvals (ticket_id, stage, decision, comment, estimated_amount)
    values (new.id, 'pending_management', 'requested',
            'Goodwill request — tracked, not billed', new.estimated_amount);

  -- OUT OF SCOPE → escalation
  elsif new.classification = 'out_of_scope' then
    new.approval_stage := 'pending_management';
    new.status := 'waiting_approval';
    new.billing_status := 'not_billable';

    insert into approvals (ticket_id, stage, decision, comment)
    values (new.id, 'pending_management', 'requested', 'Out of scope — escalated');
  end if;

  -- For 'included' tickets, generate a retainer job_code immediately
  if new.classification = 'included' and new.job_code_id is null then
    perform generate_job_code(new.id);
    -- generate_job_code does its own UPDATE; reload job_code_id
    select job_code_id into new.job_code_id from tickets where id = new.id;
  end if;

  return new;
end;
$$;

create trigger trg_tickets_classification_router
before update of classification on tickets
for each row
execute function tickets_classification_router();

-- Also run it after INSERT (initial classification set at creation)
create or replace function tickets_classification_router_ai()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed_revisions int;
  v_rev_count int;
begin
  if new.classification is null then
    return new;
  end if;

  if new.classification = 'included' and new.job_code_id is null then
    perform generate_job_code(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_tickets_classification_ai
after insert on tickets
for each row
execute function tickets_classification_router_ai();

-- ----------------------------------------------------------------------------
-- On final approval → generate job code (for extra_billable, goodwill, etc.)
-- ----------------------------------------------------------------------------
create or replace function tickets_job_code_on_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.approval_stage = 'approved'
      and old.approval_stage <> 'approved'
      and new.job_code_id is null
      and new.classification is not null) then
    perform generate_job_code(new.id);
    new.status := 'approved';
  end if;
  return new;
end;
$$;

create trigger trg_tickets_jobcode_on_approve
before update of approval_stage on tickets
for each row
execute function tickets_job_code_on_approve();

-- ----------------------------------------------------------------------------
-- Auto-promote tickets to billables when delivered.
-- ----------------------------------------------------------------------------
create or replace function tickets_to_billable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period char(7);
begin
  if (new.status = 'delivered'
      and old.status <> 'delivered'
      and new.classification in ('extra_billable','revision','goodwill')) then

    v_period := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');

    insert into billables (
      ticket_id, client_id, job_code_id, classification,
      amount, currency, billing_period, status
    )
    values (
      new.id, new.client_id, new.job_code_id, new.classification,
      coalesce(new.estimated_amount, 0),
      'INR',
      v_period,
      case when new.classification = 'goodwill' then 'not_billable' else 'pending_billing' end
    )
    on conflict (ticket_id) do nothing;

    new.billing_status := case
      when new.classification = 'goodwill' then 'not_billable'
      else 'pending_billing'
    end;
  end if;
  return new;
end;
$$;

create trigger trg_tickets_to_billable
before update of status on tickets
for each row
execute function tickets_to_billable();

-- ----------------------------------------------------------------------------
-- Generic audit log writer.
-- ----------------------------------------------------------------------------
create or replace function write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_before jsonb;
  v_after  jsonb;
  v_id     uuid;
begin
  if TG_OP = 'INSERT' then
    v_action := 'create';
    v_before := null;
    v_after  := to_jsonb(new);
    v_id     := new.id;
  elsif TG_OP = 'UPDATE' then
    v_action := 'update';
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);
    v_id     := new.id;
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
    v_before := to_jsonb(old);
    v_after  := null;
    v_id     := old.id;
  end if;

  insert into audit_log (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), v_action, TG_TABLE_NAME, v_id, v_before, v_after);

  return coalesce(new, old);
end;
$$;

create trigger trg_audit_tickets
after insert or update or delete on tickets
for each row execute function write_audit();

create trigger trg_audit_clients
after insert or update or delete on clients
for each row execute function write_audit();

create trigger trg_audit_approvals
after insert or update or delete on approvals
for each row execute function write_audit();

create trigger trg_audit_billables
after insert or update or delete on billables
for each row execute function write_audit();

create trigger trg_audit_change_requests
after insert or update or delete on change_requests
for each row execute function write_audit();

-- ----------------------------------------------------------------------------
-- View helper: ticket with denormalized client + job_code
-- ----------------------------------------------------------------------------
create or replace view v_tickets_full as
select
  t.*,
  c.client_name,
  c.client_code,
  c.brand_code,
  jc.code as job_code,
  rb.full_name as requested_by_name,
  rb.email     as requested_by_email,
  as_u.full_name as assigned_to_name
from tickets t
join clients c on c.id = t.client_id
left join job_codes jc on jc.id = t.job_code_id
left join users rb on rb.id = t.requested_by_id
left join users as_u on as_u.id = t.assigned_to_id
where t.deleted_at is null;

-- ----------------------------------------------------------------------------
-- Materialized view: client profitability
-- (refresh nightly via supabase scheduled function)
-- ----------------------------------------------------------------------------
create materialized view mv_client_profitability as
with monthly as (
  select
    b.client_id,
    b.billing_period,
    sum(case when b.classification = 'extra_billable' then b.amount else 0 end) as extra_billed,
    sum(case when b.classification = 'goodwill'        then b.amount else 0 end) as goodwill_value,
    sum(case when b.classification = 'revision'        then b.amount else 0 end) as revision_billed
  from billables b
  group by b.client_id, b.billing_period
)
select
  c.id as client_id,
  c.client_name,
  c.client_code,
  c.brand_code,
  c.retainer_amount,
  c.allowed_revisions,
  coalesce(m.extra_billed, 0)    as extra_billed,
  coalesce(m.goodwill_value, 0)  as goodwill_value,
  coalesce(m.revision_billed, 0) as revision_billed,
  m.billing_period
from clients c
left join monthly m on m.client_id = c.id
where c.deleted_at is null;

create unique index idx_mv_profit_client_period
  on mv_client_profitability(client_id, billing_period);

-- Refresh helper
create or replace function refresh_profitability()
returns void language sql security definer as $$
  refresh materialized view concurrently mv_client_profitability;
$$;
