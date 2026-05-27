-- ============================================================================
-- 0010_notification_fanout.sql
--
-- Wires up email + in-app notifications for the routing rules:
--   Pending payment        → Account Manager (existing) + Accounts
--   New Task               → Assignee + Team Lead + Accounts
--   Anything to do with $$ → Accounts (invoice created / sent / paid / cancelled)
--   Approvals              → Management + Team Lead (request)
--                            AM + Accounts (decision)
--
-- Pattern:
--   Triggers compute the recipient set and call _notify_users(), which
--   inserts both an in-app `notifications` row AND a `notification_dispatch`
--   row per user. The existing /api/dispatch/run cron drains the dispatch
--   table → posts to N8N_WEBHOOK_URL → n8n sends the actual email.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Departments get a designated team lead
-- ----------------------------------------------------------------------------
alter table departments
  add column if not exists lead_user_id uuid references users(id);

-- Auto-fill leads from the production seed if not already set
update departments d set lead_user_id = u.id
  from users u
 where d.lead_user_id is null
   and (
     (d.name = 'Client Servicing' and u.email = 'zeeshan@futureadymedia.com')
     or (d.name = 'Operations'    and u.email = 'ritesh@futureadymedia.com')
     or (d.name = 'Creative'      and u.email = 'karen@futureadymedia.com')
     or (d.name = 'Tech'          and u.email = 'roshan@futureadymedia.com')
     or (d.name = 'Accounts'      and u.email = 'accounts@futureadymedia.com')
     or (d.name = 'Management'    and u.email = 'amey@futureadymedia.com')
   );

-- ----------------------------------------------------------------------------
-- 2. Fan-out helper: insert in-app + dispatch rows for an array of user IDs
-- ----------------------------------------------------------------------------
create or replace function _notify_users(
  p_user_ids    uuid[],
  p_type        text,
  p_subject     text,
  p_body        text,
  p_entity_type text,
  p_entity_id   uuid,
  p_payload     jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_seen   uuid[] := array[]::uuid[];
begin
  if p_user_ids is null then return; end if;

  foreach v_uid in array p_user_ids loop
    if v_uid is null then continue; end if;
    if v_uid = any(v_seen) then continue; end if;   -- dedupe
    v_seen := v_seen || v_uid;

    insert into notifications (user_id, type, title, body, entity_type, entity_id)
    values (v_uid, p_type, p_subject, p_body, p_entity_type, p_entity_id);

    insert into notification_dispatch (user_id, channel, type, subject, body, payload)
    values (v_uid, 'email', p_type, p_subject, p_body,
            p_payload || jsonb_build_object(
              'recipient_id', v_uid,
              'app_url', current_setting('app.app_url', true)
            ));
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Recipient helpers
-- ----------------------------------------------------------------------------

-- Lead for the *department* associated with a task (task.department_id)
create or replace function _team_lead_for_dept(p_dept_id uuid)
returns uuid language sql stable as $$
  select lead_user_id from departments where id = p_dept_id
$$;

-- Lead for the *assigned_team* string on tickets (video_team, design_team, etc.)
create or replace function _team_lead_for_assigned(p_assigned_team text)
returns uuid language sql stable as $$
  select d.lead_user_id
    from departments d
   where lower(d.name) = case lower(coalesce(p_assigned_team,''))
     when 'video_team'        then 'creative'
     when 'design_team'       then 'creative'
     when 'creative'          then 'creative'
     when 'operations'        then 'operations'
     when 'client_servicing'  then 'client servicing'
     when 'tech'              then 'tech'
     else lower(p_assigned_team)
   end
$$;

create or replace function _accounts_users()
returns uuid[] language sql stable as $$
  select coalesce(array_agg(id), array[]::uuid[])
    from users
   where role = 'accounts'
     and is_active = true
     and deleted_at is null
$$;

create or replace function _management_users()
returns uuid[] language sql stable as $$
  select coalesce(array_agg(id), array[]::uuid[])
    from users
   where role in ('super_admin', 'management')
     and is_active = true
     and deleted_at is null
$$;

-- ----------------------------------------------------------------------------
-- 4. Tasks: NEW TASK → Assignee + Team Lead + Accounts
-- ----------------------------------------------------------------------------
drop function if exists tasks_notify_assignee() cascade;
create function tasks_notify_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
#variable_conflict use_variable
declare
  ctx record;
  recipients uuid[];
  lead_id    uuid;
  subject_   text;
  body_      text;
  payload_   jsonb;
begin
  if (TG_OP = 'INSERT' and new.assignee_id is null) then return new; end if;
  if (TG_OP = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id) then
    return new;
  end if;
  if new.assignee_id is null then return new; end if;

  select t.title          as ticket_title,
         t.ticket_number  as ticket_number,
         c.client_name    as client_name,
         c.client_code    as client_code
    into ctx
    from tickets t join clients c on c.id = t.client_id
   where t.id = new.ticket_id;

  recipients := array[new.assignee_id];

  if new.department_id is not null then
    lead_id := _team_lead_for_dept(new.department_id);
    if lead_id is not null then
      recipients := recipients || lead_id;
    end if;
  end if;

  recipients := recipients || _accounts_users();

  subject_ := '[Agency Ops] New task: ' || new.title;
  body_    := 'Task: ' || new.title
              || E'\nClient: '  || coalesce(ctx.client_name, 'N/A')
              || E'\nTicket: #' || coalesce(ctx.ticket_number::text, 'N/A')
              || E'\nDue: '     || coalesce(to_char(new.due_date, 'DD Mon YYYY HH24:MI'), 'No deadline');
  payload_ := jsonb_build_object(
      'task_id',       new.id,
      'task_title',    new.title,
      'ticket_id',     new.ticket_id,
      'ticket_number', ctx.ticket_number,
      'ticket_title',  ctx.ticket_title,
      'client_name',   ctx.client_name,
      'client_code',   ctx.client_code,
      'due_date',      new.due_date
  );

  perform _notify_users(recipients, 'task_assigned', subject_, body_, 'task', new.id, payload_);
  return new;
end;
$func$;

drop trigger if exists trg_tasks_notify_assignee on tasks;
create trigger trg_tasks_notify_assignee
after insert or update of assignee_id on tasks
for each row execute function tasks_notify_assignee();

-- ----------------------------------------------------------------------------
-- 5. Approvals: REQUEST → Management + Team Lead
--                DECISION → AM + Accounts
-- ----------------------------------------------------------------------------
drop function if exists approvals_notify() cascade;
create function approvals_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
#variable_conflict use_variable
declare
  ctx        record;
  recipients uuid[];
  lead_id    uuid;
  subject_   text;
  body_      text;
  payload_   jsonb;
begin
  select t.title             as ticket_title,
         t.ticket_number     as ticket_number,
         t.assigned_team     as assigned_team,
         t.classification    as classification,
         c.client_name       as client_name,
         c.client_code       as client_code,
         c.account_manager_id as am_id,
         c.currency          as currency
    into ctx
    from tickets t join clients c on c.id = t.client_id
   where t.id = new.ticket_id;

  if new.decision = 'requested' then
    recipients := _management_users();
    lead_id := _team_lead_for_assigned(ctx.assigned_team);
    if lead_id is not null then
      recipients := recipients || lead_id;
    end if;

    subject_ := '[Agency Ops] Approval needed: ' || ctx.ticket_title;
    body_    := 'Approval requested for ' || ctx.client_name
                || E'\nClassification: ' || coalesce(ctx.classification::text, '—')
                || E'\nAmount: '         || coalesce(ctx.currency, 'INR') || ' ' || coalesce(new.estimated_amount, 0)
                || E'\nStage: '          || new.stage;
    payload_ := jsonb_build_object(
        'ticket_id',      new.ticket_id,
        'ticket_title',   ctx.ticket_title,
        'ticket_number',  ctx.ticket_number,
        'client_name',    ctx.client_name,
        'client_code',    ctx.client_code,
        'classification', ctx.classification,
        'stage',          new.stage,
        'amount',         new.estimated_amount,
        'currency',       ctx.currency
    );

    perform _notify_users(recipients, 'approval_requested', subject_, body_, 'ticket', new.ticket_id, payload_);

  elsif new.decision in ('approved', 'rejected') then
    recipients := array[]::uuid[];
    if ctx.am_id is not null then
      recipients := recipients || ctx.am_id;
    end if;
    if ctx.classification in ('extra_billable', 'goodwill', 'revision') then
      recipients := recipients || _accounts_users();
    end if;

    subject_ := '[Agency Ops] Approval ' || new.decision || ': ' || ctx.ticket_title;
    body_    := ctx.client_name || ' · ' || new.stage || ' → ' || new.decision
                || coalesce(E'\n' || new.comment, '');
    payload_ := jsonb_build_object(
        'ticket_id',      new.ticket_id,
        'ticket_title',   ctx.ticket_title,
        'ticket_number',  ctx.ticket_number,
        'client_name',    ctx.client_name,
        'classification', ctx.classification,
        'stage',          new.stage,
        'decision',       new.decision,
        'comment',        new.comment,
        'amount',         new.estimated_amount,
        'currency',       ctx.currency
    );

    perform _notify_users(recipients, 'approval_' || new.decision, subject_, body_, 'ticket', new.ticket_id, payload_);
  end if;

  return new;
end;
$func$;

drop trigger if exists trg_approvals_notify on approvals;
create trigger trg_approvals_notify
after insert on approvals
for each row execute function approvals_notify();

-- ----------------------------------------------------------------------------
-- 6. Invoices: every create + status change → Accounts + AM
-- ----------------------------------------------------------------------------
drop function if exists invoices_notify() cascade;
create function invoices_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
#variable_conflict use_variable
declare
  ctx        record;
  recipients uuid[];
  event_     text;
  subject_   text;
  body_      text;
  payload_   jsonb;
begin
  select c.client_name        as client_name,
         c.client_code        as client_code,
         c.account_manager_id as am_id
    into ctx
    from clients c where c.id = new.client_id;

  recipients := _accounts_users();
  if ctx.am_id is not null then
    recipients := recipients || ctx.am_id;
  end if;

  if TG_OP = 'INSERT' then
    event_   := 'invoice_created';
    subject_ := '[Agency Ops] New invoice draft: ' || new.invoice_number;
    body_    := 'Invoice ' || new.invoice_number || ' for ' || ctx.client_name
                || E'\nAmount: ' || new.currency || ' ' || new.total
                || E'\nDue: '    || coalesce(to_char(new.due_at, 'DD Mon YYYY'), 'N/A');
    payload_ := jsonb_build_object(
        'invoice_id',     new.id,
        'invoice_number', new.invoice_number,
        'client_name',    ctx.client_name,
        'client_code',    ctx.client_code,
        'amount',         new.total,
        'currency',       new.currency,
        'status',         new.status,
        'due_at',         new.due_at
    );
    perform _notify_users(recipients, event_, subject_, body_, 'invoice', new.id, payload_);

  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    event_   := 'invoice_' || new.status;
    subject_ := '[Agency Ops] Invoice ' || new.invoice_number || ' → ' || new.status;
    body_    := 'Invoice ' || new.invoice_number || ' for ' || ctx.client_name
                || ' is now ' || new.status
                || E'\nAmount: ' || new.currency || ' ' || new.total;
    payload_ := jsonb_build_object(
        'invoice_id',     new.id,
        'invoice_number', new.invoice_number,
        'client_name',    ctx.client_name,
        'client_code',    ctx.client_code,
        'amount',         new.total,
        'currency',       new.currency,
        'status',         new.status,
        'prev_status',    old.status
    );
    perform _notify_users(recipients, event_, subject_, body_, 'invoice', new.id, payload_);
  end if;

  return new;
end;
$func$;

drop trigger if exists trg_invoices_notify on invoices;
create trigger trg_invoices_notify
after insert or update of status on invoices
for each row execute function invoices_notify();

-- ----------------------------------------------------------------------------
-- 7. Payment reminders: extend to CC Accounts (was AM only)
-- ----------------------------------------------------------------------------
drop function if exists queue_payment_reminders(int);
create function queue_payment_reminders(p_days_ahead int default 3)
returns int
language plpgsql
security definer
set search_path = public
as $func$
#variable_conflict use_variable
declare
  cnt        int := 0;
  inv        record;
  recipients uuid[];
  subject_   text;
  body_      text;
  payload_   jsonb;
begin
  for inv in
    select i.id              as id,
           i.invoice_number  as invoice_number,
           i.total           as total,
           i.due_at          as due_at,
           i.currency        as currency,
           c.client_name     as client_name,
           c.client_code     as client_code,
           c.account_manager_id as am_id,
           u.email           as am_email,
           u.full_name       as am_name
      from invoices i
      join clients c on c.id = i.client_id
      left join users u on u.id = c.account_manager_id
     where i.status in ('draft', 'sent', 'overdue')
       and i.due_at is not null
       and i.due_at::date <= (current_date + p_days_ahead)
       and i.due_at::date >= current_date - 30
       and not exists (
         select 1 from notification_dispatch nd
         where nd.type = 'payment_reminder'
           and nd.payload->>'invoice_id' = i.id::text
           and nd.created_at::date = current_date
       )
  loop
    recipients := _accounts_users();
    if inv.am_id is not null then
      recipients := recipients || inv.am_id;
    end if;

    subject_ := '[Agency Ops] Payment due — ' || inv.invoice_number;
    body_    := 'Invoice ' || inv.invoice_number || ' for ' || inv.client_name
                || ' is due ' || to_char(inv.due_at, 'DD Mon YYYY')
                || E'\nAmount: ' || inv.currency || ' ' || inv.total;
    payload_ := jsonb_build_object(
        'invoice_id',     inv.id,
        'invoice_number', inv.invoice_number,
        'client_name',    inv.client_name,
        'client_code',    inv.client_code,
        'amount',         inv.total,
        'currency',       inv.currency,
        'due_at',         inv.due_at,
        'am_email',       inv.am_email,
        'am_name',        inv.am_name
    );

    perform _notify_users(recipients, 'payment_reminder', subject_, body_, 'invoice', inv.id, payload_);
    cnt := cnt + 1;
  end loop;

  return cnt;
end;
$func$;

-- ----------------------------------------------------------------------------
-- 8. RLS on departments — allow read for all, write for admins
-- (lead_user_id is added by admins via SQL or future Settings UI)
-- ----------------------------------------------------------------------------
-- (departments already has policies from 0003; no change needed for the new column)
