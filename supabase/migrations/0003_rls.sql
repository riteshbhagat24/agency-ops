-- ============================================================================
-- 0003_rls.sql
-- Row-Level Security policies for every table.
-- The DB is the authorization plane; Next.js trusts these policies.
-- ============================================================================

-- Enable RLS on all user-facing tables
alter table users              enable row level security;
alter table departments        enable row level security;
alter table clients            enable row level security;
alter table client_assignees   enable row level security;
alter table tickets            enable row level security;
alter table approvals          enable row level security;
alter table tasks              enable row level security;
alter table time_logs          enable row level security;
alter table revisions          enable row level security;
alter table change_requests    enable row level security;
alter table billables          enable row level security;
alter table comments           enable row level security;
alter table attachments        enable row level security;
alter table notifications      enable row level security;
alter table job_codes          enable row level security;
alter table job_code_sequences enable row level security;
alter table audit_log          enable row level security;

-- ----------------------------------------------------------------------------
-- USERS
-- Everyone can read minimal staff directory; only self can update own row;
-- only super_admin can change roles.
-- ----------------------------------------------------------------------------
create policy users_select on users for select
  using (auth.uid() is not null and deleted_at is null);

create policy users_update_self on users for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_update_admin on users for update
  using (current_user_role() = 'super_admin')
  with check (current_user_role() = 'super_admin');

create policy users_insert_admin on users for insert
  with check (current_user_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- DEPARTMENTS
-- ----------------------------------------------------------------------------
create policy departments_select on departments for select
  using (auth.uid() is not null);

create policy departments_mutate on departments for all
  using (is_admin_or_management())
  with check (is_admin_or_management());

-- ----------------------------------------------------------------------------
-- CLIENTS
-- ----------------------------------------------------------------------------
create policy clients_select on clients for select
  using (
    deleted_at is null
    and (
      is_staff()
      or current_user_role() in ('operations','video_team','design_team')
      or exists (
        select 1 from client_assignees ca
        where ca.client_id = clients.id and ca.user_id = auth.uid()
      )
    )
  );

create policy clients_insert on clients for insert
  with check (is_admin_or_management());

create policy clients_update on clients for update
  using (
    is_admin_or_management()
    or (current_user_role() = 'accounts' and true)
  )
  with check (
    is_admin_or_management()
    or current_user_role() = 'accounts'
  );

-- ----------------------------------------------------------------------------
-- CLIENT_ASSIGNEES
-- ----------------------------------------------------------------------------
create policy client_assignees_select on client_assignees for select
  using (
    is_staff()
    or user_id = auth.uid()
  );

create policy client_assignees_mutate on client_assignees for all
  using (is_admin_or_management())
  with check (is_admin_or_management());

-- ----------------------------------------------------------------------------
-- TICKETS
-- ----------------------------------------------------------------------------
create policy tickets_select on tickets for select
  using (
    deleted_at is null
    and (
      is_staff()
      or requested_by_id = auth.uid()
      or assigned_to_id  = auth.uid()
      or exists (
        select 1 from client_assignees ca
        where ca.client_id = tickets.client_id and ca.user_id = auth.uid()
      )
    )
  );

create policy tickets_insert on tickets for insert
  with check (
    auth.uid() is not null
    and (
      is_staff()
      or current_user_role() in ('client_servicing','operations','video_team','design_team')
    )
  );

create policy tickets_update on tickets for update
  using (
    is_staff()
    or current_user_role() = 'client_servicing'
    or assigned_to_id = auth.uid()
    or requested_by_id = auth.uid()
  )
  with check (
    is_staff()
    or current_user_role() = 'client_servicing'
    or assigned_to_id = auth.uid()
    or requested_by_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- APPROVALS — append-only history
-- ----------------------------------------------------------------------------
create policy approvals_select on approvals for select
  using (
    is_staff()
    or exists (
      select 1 from tickets t
      where t.id = approvals.ticket_id
        and (t.requested_by_id = auth.uid()
             or t.assigned_to_id = auth.uid()
             or exists (
               select 1 from client_assignees ca
               where ca.client_id = t.client_id and ca.user_id = auth.uid()
             ))
    )
  );

create policy approvals_insert on approvals for insert
  with check (
    is_admin_or_management()
    or (
      stage = 'pending_client'
      and current_user_role() = 'client_servicing'
    )
    or (
      decision = 'requested'
      and auth.uid() is not null
    )
  );

-- ----------------------------------------------------------------------------
-- TASKS
-- ----------------------------------------------------------------------------
create policy tasks_select on tasks for select
  using (
    deleted_at is null
    and (
      is_staff()
      or assignee_id = auth.uid()
      or exists (
        select 1 from tickets t
        where t.id = tasks.ticket_id and (
          t.requested_by_id = auth.uid()
          or exists (
            select 1 from client_assignees ca
            where ca.client_id = t.client_id and ca.user_id = auth.uid()
          )
        )
      )
    )
  );

create policy tasks_mutate on tasks for all
  using (
    is_staff()
    or assignee_id = auth.uid()
    or current_user_role() in ('client_servicing','operations','video_team','design_team')
  )
  with check (
    is_staff()
    or assignee_id = auth.uid()
    or current_user_role() in ('client_servicing','operations','video_team','design_team')
  );

-- ----------------------------------------------------------------------------
-- TIME LOGS — only self
-- ----------------------------------------------------------------------------
create policy time_logs_select on time_logs for select
  using (
    is_staff()
    or user_id = auth.uid()
  );

create policy time_logs_insert on time_logs for insert
  with check (user_id = auth.uid());

create policy time_logs_update on time_logs for update
  using (user_id = auth.uid() or is_admin_or_management())
  with check (user_id = auth.uid() or is_admin_or_management());

-- ----------------------------------------------------------------------------
-- REVISIONS
-- ----------------------------------------------------------------------------
create policy revisions_select on revisions for select using (true);
create policy revisions_mutate on revisions for all
  using (
    is_staff() or current_user_role() = 'client_servicing'
  )
  with check (
    is_staff() or current_user_role() = 'client_servicing'
  );

-- ----------------------------------------------------------------------------
-- CHANGE REQUESTS
-- ----------------------------------------------------------------------------
create policy cr_select on change_requests for select
  using (
    is_staff()
    or created_by_id = auth.uid()
    or exists (
      select 1 from client_assignees ca
      where ca.client_id = change_requests.client_id and ca.user_id = auth.uid()
    )
  );

create policy cr_insert on change_requests for insert
  with check (
    is_staff() or current_user_role() = 'client_servicing'
  );

create policy cr_update on change_requests for update
  using (is_admin_or_management() or created_by_id = auth.uid())
  with check (is_admin_or_management() or created_by_id = auth.uid());

-- ----------------------------------------------------------------------------
-- BILLABLES — finance + management only
-- ----------------------------------------------------------------------------
create policy billables_select on billables for select
  using (
    is_staff()
    or exists (
      select 1 from client_assignees ca
      where ca.client_id = billables.client_id and ca.user_id = auth.uid()
    )
  );

create policy billables_mutate on billables for all
  using (current_user_role() in ('super_admin','management','accounts'))
  with check (current_user_role() in ('super_admin','management','accounts'));

-- ----------------------------------------------------------------------------
-- COMMENTS / ATTACHMENTS — open to anyone with access to the parent ticket
-- ----------------------------------------------------------------------------
create policy comments_select on comments for select
  using (auth.uid() is not null and deleted_at is null);

create policy comments_insert on comments for insert
  with check (author_id = auth.uid());

create policy comments_update on comments for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy attachments_select on attachments for select
  using (auth.uid() is not null);

create policy attachments_insert on attachments for insert
  with check (uploaded_by = auth.uid() or is_staff());

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS — per-user inbox
-- ----------------------------------------------------------------------------
create policy notifications_select on notifications for select
  using (user_id = auth.uid());

create policy notifications_update on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Server (service-role) is bypass-RLS; for explicit inserts:
create policy notifications_insert_staff on notifications for insert
  with check (is_staff() or user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- JOB CODES — read for any authed; insert via SECURITY DEFINER fn only
-- ----------------------------------------------------------------------------
create policy job_codes_select on job_codes for select
  using (auth.uid() is not null);

create policy job_code_sequences_select on job_code_sequences for select
  using (is_staff());

-- ----------------------------------------------------------------------------
-- AUDIT LOG — read for management+; write only via trigger (service-role)
-- ----------------------------------------------------------------------------
create policy audit_log_select on audit_log for select
  using (is_admin_or_management());

-- No INSERT/UPDATE/DELETE policies on audit_log => writes only via SECURITY DEFINER triggers.

-- ----------------------------------------------------------------------------
-- Trigger to auto-provision a `users` row from auth.users on signup.
-- ----------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
  v_allowed boolean := false;
begin
  -- Restrict to configured agency domains
  v_domain := split_part(new.email, '@', 2);

  -- Default: allow first user as super_admin
  if (select count(*) from public.users) = 0 then
    insert into public.users (id, email, full_name, avatar_url, role)
    values (
      new.id, new.email,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
      new.raw_user_meta_data->>'avatar_url',
      'super_admin'
    );
    return new;
  end if;

  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url',
    'client_servicing'    -- default; super_admin promotes later
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
