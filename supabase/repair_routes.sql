-- ============================================================================
-- repair_routes.sql
-- One-shot repair for tickets that were created before the trigger-routing
-- fix: classification is set but the ticket is still stuck in
-- status='pending_classification' / approval_stage='not_required'.
--
-- This forces each such ticket through the classification router by
-- nulling and re-setting the classification.
-- ============================================================================

do $$
declare
  t record;
begin
  for t in
    select id, classification
      from tickets
     where classification is not null
       and (
         status = 'pending_classification'
         or (
           classification in ('extra_billable','goodwill','out_of_scope')
           and approval_stage = 'not_required'
         )
       )
  loop
    -- Step 1: clear classification (BEFORE UPDATE trigger fires but does nothing
    -- meaningful because new.classification is null and trigger returns early)
    update tickets set classification = null where id = t.id;

    -- Step 2: re-set classification — trigger fires properly now
    update tickets set classification = t.classification where id = t.id;
  end loop;
end $$;

-- Verify: every routed ticket should now have a non-default approval_stage
-- for the billable classifications.
-- select id, ticket_number, title, classification, status, approval_stage
--   from tickets
--   where classification in ('extra_billable','goodwill','out_of_scope')
--   order by created_at desc;
