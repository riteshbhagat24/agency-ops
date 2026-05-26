-- ============================================================================
-- demo_overlay.sql
--
-- Loads a layer of realistic demo activity on top of the real client + team
-- data so dashboards / charts / approvals show something during the
-- management demo.
--
-- Idempotent: safe to re-run. Adds activity from the LAST 90 DAYS so the
-- leakage trend, revenue chart, and team utilization all have data.
--
-- To remove later: see DEMO CLEANUP section at the bottom.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Schema prep — make sure tasks has a metadata column we can tag with.
-- (tickets.metadata exists from 0001; billables does not, so we use the
-- ticket_id link to identify demo billables.)
-- ----------------------------------------------------------------------------
alter table tasks add column if not exists metadata jsonb not null default '{}';

-- ----------------------------------------------------------------------------
-- 2. Wipe any prior demo-overlay rows so we don't pile up on re-runs.
-- Order matters because of FK cascades.
-- ----------------------------------------------------------------------------
delete from time_logs
  where task_id in (
    select id from tasks where (metadata->>'demo')::boolean is true
  );

delete from tasks
  where (metadata->>'demo')::boolean is true;

delete from billables
  where ticket_id in (
    select id from tickets where (metadata->>'demo')::boolean is true
  );

delete from approvals
  where ticket_id in (
    select id from tickets where (metadata->>'demo')::boolean is true
  );

delete from tickets
  where (metadata->>'demo')::boolean is true;

-- ----------------------------------------------------------------------------
-- 2. Historical APPROVED tickets across various months for the leakage trend
-- ----------------------------------------------------------------------------

do $$
declare
  v_client record;
  v_user_id uuid;
  v_t_id uuid;
  v_month_offset int;
  v_amount numeric;
  v_classification classification;
  v_request_type text;
  v_priority ticket_priority;
  i int;
begin
  -- Pick a few CS users for requested_by
  for v_client in
    select c.id, c.client_code, c.brand_code, c.account_manager_id
      from clients c
     where c.deleted_at is null
       and c.status = 'active'
     order by c.client_code
  loop
    v_user_id := coalesce(v_client.account_manager_id,
                         (select id from users where role='client_servicing' and is_active limit 1));

    -- 2-4 tickets per client across last 90 days
    for i in 1 .. (2 + (random() * 2)::int) loop
      v_month_offset := (random() * 90)::int;
      v_classification := (
        case ((random() * 5)::int)
          when 0 then 'included'
          when 1 then 'extra_billable'
          when 2 then 'revision'
          when 3 then 'goodwill'
          else 'extra_billable'
        end
      )::classification;
      v_request_type := (case ((random() * 4)::int)
        when 0 then 'reel'
        when 1 then 'post'
        when 2 then 'edit'
        when 3 then 'video'
        else 'campaign'
      end);
      v_amount := case
        when v_classification = 'included' then 0
        when v_classification = 'goodwill' then 3000 + (random() * 8000)::int
        else 8000 + (random() * 40000)::int
      end;
      v_priority := (case ((random() * 3)::int)
        when 0 then 'low'
        when 1 then 'medium'
        when 2 then 'high'
        else 'high'
      end)::ticket_priority;

      insert into tickets (
        client_id, title, description, request_type, classification, priority,
        status, approval_stage, billing_status,
        estimated_hours, estimated_amount, deadline,
        requested_by_id, assigned_team, metadata,
        created_at, updated_at
      ) values (
        v_client.id,
        case ((random() * 5)::int)
          when 0 then 'Monthly content batch'
          when 1 then 'Quarterly brand film'
          when 2 then 'Reel revision request'
          when 3 then 'Festive campaign assets'
          when 4 then 'Strategy deck refresh'
          else 'Content deliverables'
        end,
        'Demo overlay item for dashboard population',
        v_request_type,
        v_classification,
        v_priority,
        (case when random() < 0.7 then 'delivered' else 'in_progress' end)::ticket_status,
        case when v_classification in ('extra_billable','goodwill','revision') then 'approved'::approval_stage
             else 'not_required'::approval_stage end,
        case when v_classification = 'extra_billable' then 'billed'::billing_status
             when v_classification = 'goodwill' then 'not_billable'::billing_status
             else 'not_billable'::billing_status end,
        4 + (random() * 12)::int,
        v_amount,
        (now() - (v_month_offset || ' days')::interval + interval '14 days'),
        v_user_id,
        case ((random() * 3)::int) when 0 then 'video_team' when 1 then 'design_team' else 'operations' end,
        jsonb_build_object('demo', true),
        now() - (v_month_offset || ' days')::interval,
        now() - (v_month_offset || ' days')::interval
      ) returning id into v_t_id;

      -- For extra_billable / goodwill / revision in past months — create a billable + invoice
      if v_classification in ('extra_billable','goodwill') then
        insert into billables (
          ticket_id, client_id, classification, amount, currency,
          billing_period, status, tax_rate, tax_amount, created_at
        ) values (
          v_t_id, v_client.id, v_classification, v_amount,
          (select currency from clients where id = v_client.id),
          to_char(now() - (v_month_offset || ' days')::interval, 'YYYY-MM'),
          case when v_classification = 'goodwill' then 'not_billable'::billing_status
               else (case when random() < 0.6 then 'billed' else 'pending_billing' end)::billing_status end,
          18,
          round(v_amount * 18 / 100, 2),
          now() - (v_month_offset || ' days')::interval
        )
        on conflict (ticket_id) do nothing;
      end if;
    end loop;
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- 3. Pending approval tickets — for "Awaiting your approval" inbox
-- ----------------------------------------------------------------------------

do $$
declare
  v_client record;
  v_cs_user uuid;
  v_t_id uuid;
begin
  for v_client in
    select id, client_code, account_manager_id from clients
     where deleted_at is null and status='active'
     order by client_code limit 4
  loop
    v_cs_user := coalesce(
      v_client.account_manager_id,
      (select id from users where role='client_servicing' and is_active limit 1)
    );

    insert into tickets (
      client_id, title, description, request_type, classification, priority,
      status, approval_stage, billing_status,
      estimated_hours, estimated_amount, deadline,
      requested_by_id, assigned_team, metadata
    ) values (
      v_client.id,
      'Out-of-scope creative ask',
      'Client asked for a one-off animation. Needs management decision.',
      'video', 'extra_billable', 'high',
      'waiting_approval', 'pending_management', 'pending_billing',
      12, 15000 + (random() * 25000)::int, now() + interval '5 days',
      v_cs_user, 'video_team',
      jsonb_build_object('demo', true)
    ) returning id into v_t_id;

    insert into approvals (ticket_id, stage, decision, comment, estimated_amount)
    values (v_t_id, 'pending_management', 'requested',
            'Demo: needs management approval', 15000 + (random() * 25000)::int);
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- 4. Tasks + time logs for the last 14 days across team members
-- ----------------------------------------------------------------------------

do $$
declare
  v_user record;
  v_ticket_id uuid;
  v_task_id uuid;
  v_dept_id uuid;
  v_dept_for_user uuid;
  i int;
begin
  for v_user in
    select id, full_name, department_id from users
     where is_active = true and deleted_at is null
       and role in ('client_servicing','video_team','design_team','operations')
  loop
    v_dept_for_user := v_user.department_id;

    for i in 1 .. (3 + (random() * 4)::int) loop
      -- Pick a random demo ticket to attach to
      select id into v_ticket_id from tickets
       where (metadata->>'demo')::boolean is true
         and status in ('delivered','in_progress','approved')
       order by random() limit 1;

      if v_ticket_id is null then continue; end if;

      insert into tasks (
        ticket_id, title, description, status, assignee_id,
        department_id, due_date, estimated_hours, actual_hours,
        completion_pct, metadata, created_at
      ) values (
        v_ticket_id,
        case ((random() * 5)::int)
          when 0 then 'Concept + storyboard'
          when 1 then 'Shoot day'
          when 2 then 'Edit pass'
          when 3 then 'Client review round'
          else 'Final delivery package'
        end,
        'Demo overlay task',
        (case when random() < 0.6 then 'completed' else 'in_progress' end)::task_status,
        v_user.id,
        v_dept_for_user,
        now() - (((random() * 14)::int) || ' days')::interval,
        2 + (random() * 4)::numeric,
        2 + (random() * 4)::numeric,
        case when random() < 0.6 then 100 else (50 + (random() * 50))::int end,
        jsonb_build_object('demo', true),
        now() - (((random() * 14)::int) || ' days')::interval
      ) returning id into v_task_id;

      -- Time logs for this task across last 14 days
      insert into time_logs (task_id, user_id, hours, work_date, note, created_at)
      select v_task_id, v_user.id,
             1 + (random() * 3)::numeric,
             (current_date - ((random() * 13)::int)),
             'Demo: ' || v_user.full_name || ' work',
             now() - (((random() * 13)::int) || ' days')::interval
      from generate_series(1, 1 + (random() * 2)::int);
    end loop;
  end loop;
end$$;

commit;

-- ============================================================================
-- VERIFY:
-- ============================================================================
-- select count(*) as demo_tickets from tickets where (metadata->>'demo')::boolean is true;
-- select count(*) as demo_tasks from tasks where (metadata->>'demo')::boolean is true;
-- select count(*) as time_logs_last_7 from time_logs where work_date >= current_date - 7;
-- select count(*) as billables_this_period from billables where billing_period = to_char(now(),'YYYY-MM');
-- select count(*) as invoices_total from invoices;

-- ============================================================================
-- DEMO CLEANUP — when you want to remove all demo overlay data:
-- ============================================================================
-- begin;
-- delete from time_logs where task_id in (select id from tasks where (metadata->>'demo')::boolean is true);
-- delete from tasks where (metadata->>'demo')::boolean is true;
-- delete from billables where ticket_id in (select id from tickets where (metadata->>'demo')::boolean is true);
-- delete from approvals where ticket_id in (select id from tickets where (metadata->>'demo')::boolean is true);
-- delete from tickets where (metadata->>'demo')::boolean is true;
-- commit;
