-- ============================================================================
-- 0001_init_schema.sql
-- Core schema: enums, tables, indexes, helper functions.
-- RLS policies live in 0003. Triggers live in 0002.
-- ============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type user_role as enum (
  'super_admin', 'management', 'accounts',
  'client_servicing', 'operations', 'video_team', 'design_team'
);

create type client_status as enum ('active','paused','churned','prospect');
create type profitability_status as enum ('healthy','at_risk','bleeding','unknown');

create type ticket_priority as enum ('low','medium','high','urgent');
create type ticket_status as enum (
  'pending_classification','approved','in_progress','waiting_approval',
  'completed','delivered','on_hold','rejected','cancelled'
);

create type classification as enum (
  'included','extra_billable','revision','out_of_scope','goodwill'
);

create type billing_status as enum (
  'not_billable','pending_billing','billed','written_off'
);

create type approval_stage as enum (
  'not_required','pending_management','pending_client','approved','rejected'
);

create type task_status as enum (
  'pending','in_progress','waiting_approval','completed','delivered','on_hold'
);

-- ============================================================================
-- TABLES
-- ============================================================================

create table departments (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  cost_center text,
  created_at  timestamptz not null default now()
);

create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  full_name     text not null,
  avatar_url    text,
  role          user_role not null default 'client_servicing',
  department_id uuid references departments(id),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index idx_users_role on users(role) where deleted_at is null;
create index idx_users_dept on users(department_id) where deleted_at is null;

create table clients (
  id                    uuid primary key default gen_random_uuid(),
  client_code           text unique not null,
  client_name           text not null,
  brand_name            text not null,
  brand_code            text not null check (brand_code in ('FM','OV')),
  retainer_amount       numeric(12,2) not null default 0,
  retainer_currency     char(3) not null default 'INR',
  billing_cycle         text not null default 'monthly',
  scope_included        jsonb not null default '[]',
  allowed_revisions     int not null default 2,
  account_manager_id    uuid references users(id),
  department_id         uuid references departments(id),
  status                client_status not null default 'active',
  profitability_status  profitability_status not null default 'unknown',
  start_date            date,
  end_date              date,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
create index idx_clients_status on clients(status) where deleted_at is null;
create index idx_clients_am on clients(account_manager_id);
create index idx_clients_brand on clients(brand_code);

create table client_assignees (
  client_id   uuid not null references clients(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index idx_client_assignees_user on client_assignees(user_id);

create table job_code_sequences (
  brand_code text   not null,
  client_id  uuid   not null references clients(id) on delete cascade,
  month_key  char(4) not null,
  type_code  char(1) not null,
  last_seq   int    not null default 0,
  primary key (brand_code, client_id, month_key, type_code)
);

create table job_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  ticket_id   uuid unique,
  brand_code  text not null,
  client_id   uuid not null references clients(id),
  month_key   char(4) not null,
  type_code   char(1) not null,
  sequence    int  not null,
  created_at  timestamptz not null default now()
);
create index idx_job_codes_client on job_codes(client_id);
create index idx_job_codes_month on job_codes(month_key);

create table tickets (
  id                 uuid primary key default gen_random_uuid(),
  ticket_number      bigserial unique,
  client_id          uuid not null references clients(id),
  title              text not null,
  description        text,
  request_type       text not null,
  classification     classification,
  priority           ticket_priority not null default 'medium',
  status             ticket_status not null default 'pending_classification',
  approval_stage     approval_stage not null default 'not_required',
  billing_status     billing_status not null default 'not_billable',
  estimated_hours    numeric(6,2),
  estimated_amount   numeric(12,2),
  deadline           timestamptz,
  requested_by_id    uuid not null references users(id),
  assigned_team      text,
  assigned_to_id     uuid references users(id),
  job_code_id        uuid references job_codes(id),
  parent_ticket_id   uuid references tickets(id),
  revision_round     int not null default 0,
  metadata           jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint chk_class_required_after_intake
    check (status = 'pending_classification' or classification is not null)
);
create index idx_tickets_client on tickets(client_id) where deleted_at is null;
create index idx_tickets_status on tickets(status) where deleted_at is null;
create index idx_tickets_classification on tickets(classification);
create index idx_tickets_approval_stage on tickets(approval_stage)
  where approval_stage in ('pending_management','pending_client');
create index idx_tickets_assigned on tickets(assigned_to_id) where deleted_at is null;
create index idx_tickets_deadline on tickets(deadline) where deleted_at is null;
create index idx_tickets_jobcode on tickets(job_code_id);

-- Now we can add the FK from job_codes to tickets (circular: created after both)
alter table job_codes
  add constraint job_codes_ticket_fk
  foreign key (ticket_id) references tickets(id) on delete cascade;

create table approvals (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references tickets(id) on delete cascade,
  stage            approval_stage not null,
  decision         text not null check (decision in ('requested','approved','rejected','withdrawn')),
  actor_id         uuid references users(id),
  actor_label      text,
  comment          text,
  estimated_amount numeric(12,2),
  created_at       timestamptz not null default now()
);
create index idx_approvals_ticket on approvals(ticket_id, created_at);
create index idx_approvals_pending on approvals(stage)
  where decision = 'requested';

create table tasks (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references tickets(id) on delete cascade,
  title           text not null,
  description     text,
  status          task_status not null default 'pending',
  assignee_id     uuid references users(id),
  department_id   uuid references departments(id),
  due_date        timestamptz,
  estimated_hours numeric(6,2),
  actual_hours    numeric(6,2) not null default 0,
  completion_pct  int not null default 0 check (completion_pct between 0 and 100),
  depends_on      uuid references tasks(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index idx_tasks_ticket on tasks(ticket_id);
create index idx_tasks_assignee on tasks(assignee_id, status) where deleted_at is null;
create index idx_tasks_due on tasks(due_date) where status not in ('completed','delivered');

create table time_logs (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  user_id     uuid not null references users(id),
  hours       numeric(5,2) not null check (hours > 0),
  work_date   date not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index idx_time_logs_task on time_logs(task_id);
create index idx_time_logs_user_date on time_logs(user_id, work_date);

create table revisions (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references tickets(id) on delete cascade,
  parent_ticket_id uuid not null references tickets(id),
  round_number     int not null,
  within_scope     boolean not null default true,
  requested_by_id  uuid references users(id),
  notes            text,
  created_at       timestamptz not null default now(),
  unique (parent_ticket_id, round_number)
);
create index idx_revisions_parent on revisions(parent_ticket_id);

create table change_requests (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references clients(id),
  title              text not null,
  original_scope     text,
  additional_request text not null,
  estimated_cost     numeric(12,2),
  estimated_hours    numeric(6,2),
  timeline_impact    text,
  approval_stage     approval_stage not null default 'pending_management',
  created_by_id      uuid references users(id),
  approved_by_id     uuid references users(id),
  client_decision_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_cr_client on change_requests(client_id);
create index idx_cr_stage on change_requests(approval_stage);

create table billables (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid unique not null references tickets(id) on delete cascade,
  client_id       uuid not null references clients(id),
  job_code_id     uuid references job_codes(id),
  classification  classification not null,
  amount          numeric(12,2) not null default 0,
  currency        char(3) not null default 'INR',
  billing_period  char(7) not null,
  status          billing_status not null default 'pending_billing',
  invoiced_at     timestamptz,
  invoice_ref     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_billables_client_period on billables(client_id, billing_period);
create index idx_billables_status on billables(status);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('ticket','task','change_request','client')),
  entity_id   uuid not null,
  author_id   uuid not null references users(id),
  body        text not null,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz
);
create index idx_comments_entity on comments(entity_type, entity_id, created_at);

create table attachments (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('ticket','task','comment','change_request')),
  entity_id   uuid not null,
  bucket      text not null,
  path        text not null,
  filename    text not null,
  mime_type   text,
  size_bytes  bigint,
  uploaded_by uuid references users(id),
  created_at  timestamptz not null default now()
);
create index idx_attachments_entity on attachments(entity_type, entity_id);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_notifications_user_unread on notifications(user_id, created_at)
  where read_at is null;

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references users(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid not null,
  before      jsonb,
  after       jsonb,
  context     jsonb,
  created_at  timestamptz not null default now()
);
create index idx_audit_entity on audit_log(entity_type, entity_id, created_at);
create index idx_audit_actor on audit_log(actor_id, created_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

create or replace function current_user_role()
returns user_role
language sql
stable
as $$
  select role from users where id = auth.uid()
$$;

create or replace function is_staff()
returns boolean
language sql
stable
as $$
  select current_user_role() in ('super_admin','management','accounts')
$$;

create or replace function is_admin_or_management()
returns boolean
language sql
stable
as $$
  select current_user_role() in ('super_admin','management')
$$;

create or replace function user_can_access_client(p_client_id uuid)
returns boolean
language sql
stable
as $$
  select
    is_staff()
    or exists (
      select 1 from client_assignees
      where client_id = p_client_id and user_id = auth.uid()
    )
$$;

-- Generic updated_at trigger function
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at trigger to relevant tables
do $$
declare t text;
begin
  foreach t in array array[
    'users','clients','tickets','tasks','change_requests','billables'
  ]
  loop
    execute format(
      'create trigger trg_%I_updated_at before update on %I '
      'for each row execute function set_updated_at()',
      t, t
    );
  end loop;
end$$;
