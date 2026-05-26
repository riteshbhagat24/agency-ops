-- ============================================================================
-- repair_backfill_invoices.sql
--
-- Backfill: for every ticket that's already at approval_stage='approved' and
-- has an Extra-Billable / Goodwill classification but no billable yet,
-- create the billable now. The billables_auto_invoice trigger will then
-- create the draft invoice automatically.
--
-- Safe to re-run — `on conflict (ticket_id) do nothing` skips dupes.
-- ============================================================================

insert into billables (
  ticket_id, client_id, job_code_id, classification,
  amount, currency, billing_period, status
)
select
  t.id,
  t.client_id,
  t.job_code_id,
  t.classification,
  coalesce(t.estimated_amount, 0),
  coalesce(c.currency, 'INR'),
  to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM'),
  (case when t.classification = 'goodwill' then 'not_billable' else 'pending_billing' end)::billing_status
from tickets t
join clients c on c.id = t.client_id
where t.approval_stage = 'approved'
  and t.classification in ('extra_billable', 'goodwill')
  and t.deleted_at is null
  and not exists (select 1 from billables b where b.ticket_id = t.id)
on conflict (ticket_id) do nothing;

-- Update billing_status on those tickets to match
update tickets t
   set billing_status = (case
       when classification = 'goodwill' then 'not_billable'
       else 'pending_billing'
   end)::billing_status
 where t.approval_stage = 'approved'
   and t.classification in ('extra_billable', 'goodwill')
   and t.deleted_at is null;

-- Verify (paste in SQL Editor after):
-- select count(*) as invoices_created from invoices;
-- select i.invoice_number, c.client_name, i.total, i.currency, i.status
--   from invoices i join clients c on c.id = i.client_id
--   order by i.created_at desc;
