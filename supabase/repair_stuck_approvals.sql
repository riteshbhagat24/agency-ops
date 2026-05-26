-- ============================================================================
-- repair_stuck_approvals.sql
--
-- For tickets where the user has recorded a client-approved decision but the
-- ticket's approval_stage is still 'pending_client' (the previous bug —
-- the recordClientApproval action's UPDATE was silently failing on a
-- duplicate job_code attempt), force the ticket through to 'approved'.
--
-- After applying migration 0007 (which makes generate_job_code idempotent),
-- this should never recur. Safe to re-run.
-- ============================================================================

-- Find tickets with at least one approved client-decision row but
-- still stuck at pending_client.
update tickets t
   set approval_stage = 'approved',
       status         = 'approved'
 where t.approval_stage = 'pending_client'
   and exists (
     select 1 from approvals a
      where a.ticket_id = t.id
        and a.stage = 'pending_client'
        and a.decision = 'approved'
   );

-- For approved tickets without a job code yet, generate one
do $$
declare
  t record;
begin
  for t in
    select id from tickets
     where approval_stage = 'approved'
       and job_code_id is null
       and classification is not null
       and deleted_at is null
  loop
    perform generate_job_code(t.id);
  end loop;
end$$;

-- For approved tickets without a billable, create one (drives invoice via
-- the billables_auto_invoice trigger)
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

-- Verify:
-- select t.ticket_number, t.title, t.classification, t.status, t.approval_stage,
--        jc.code as job_code,
--        b.amount, b.status as billable_status,
--        i.invoice_number, i.total, i.status as invoice_status
--   from tickets t
--   left join job_codes jc on jc.id = t.job_code_id
--   left join billables b  on b.ticket_id = t.id
--   left join invoices i   on i.id = b.invoice_id
--  where t.deleted_at is null
--  order by t.created_at desc;
