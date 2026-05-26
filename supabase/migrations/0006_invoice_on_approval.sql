-- ============================================================================
-- 0006_invoice_on_approval.sql
--
-- Generate the billable (and therefore the invoice via the auto-invoice
-- trigger on billables) when commercials are APPROVED, not when the work is
-- delivered. Matches typical Indian agency practice — invoice on sign-off,
-- payment-on-delivery handled via invoice status.
--
-- Also: pick the currency from the client record rather than hardcoding INR.
-- 'revision' classification is removed from the generator because the
-- classification router already reclassifies over-scope revisions to
-- 'extra_billable' before they reach this point.
-- ============================================================================

create or replace function tickets_to_billable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period   char(7);
  v_currency char(3);
begin
  -- Only generate billables for the two classifications that produce one
  if new.classification is null
     or new.classification not in ('extra_billable', 'goodwill') then
    return new;
  end if;

  -- Fire only on the approval_stage → 'approved' transition
  if not (new.approval_stage = 'approved'
          and (old.approval_stage is null or old.approval_stage <> 'approved')) then
    return new;
  end if;

  v_period := to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM');

  select coalesce(currency, 'INR') into v_currency
    from clients where id = new.client_id;

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

-- Re-bind the trigger to approval_stage column (was status before)
drop trigger if exists trg_tickets_to_billable on tickets;
create trigger trg_tickets_to_billable
before update of approval_stage on tickets
for each row
execute function tickets_to_billable();
