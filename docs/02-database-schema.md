# Database Schema

PostgreSQL 15+ on Supabase. All tables use `uuid` primary keys, `created_at` / `updated_at` timestamps, soft delete via `deleted_at`, and audit-tracked mutations.

---

## ER overview

```
                       ┌──────────────┐
                       │    users     │
                       └──┬─────┬─────┘
                          │     │
                ┌─────────┘     └─────────┐
                ▼                         ▼
         ┌───────────────┐         ┌─────────────────┐
         │  departments  │         │ client_assignees│
         └───────────────┘         └────────┬────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                          ┌────────►│   clients    │◄────────┐
                          │         └──────┬───────┘         │
                          │                │                  │
                          │                ▼                  │
                  ┌───────┴───────┐  ┌───────────┐    ┌──────┴──────┐
                  │   tickets     │──│ job_codes │    │ revisions   │
                  └─┬───┬───┬─────┘  └───────────┘    └─────────────┘
                    │   │   │
        ┌───────────┘   │   └────────────┐
        ▼               ▼                ▼
  ┌───────────┐   ┌───────────┐    ┌──────────────────┐
  │ approvals │   │   tasks   │    │ change_requests  │
  └───────────┘   └─┬───────┬─┘    └──────────────────┘
                    │       │
                    ▼       ▼
              ┌──────────┐ ┌─────────────┐
              │time_logs │ │ attachments │
              └──────────┘ └─────────────┘

                  ┌──────────────┐
                  │  billables   │ ◄── derived from approved tickets
                  └──────────────┘

  Cross-cutting:  comments · notifications · audit_log
```

---

## Enums

```sql
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

create type job_code_type as char(1); -- R, C, V, E, S
```

---

## Tables

### `users`
Mirrors `auth.users` (Supabase). Role + department live here.

```sql
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  full_name   text not null,
  avatar_url  text,
  role        user_role not null default 'client_servicing',
  department_id uuid references departments(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index idx_users_role on users(role) where deleted_at is null;
```

### `departments`
```sql
create table departments (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  cost_center text,
  created_at  timestamptz not null default now()
);
```

### `clients`
The client master.

```sql
create table clients (
  id                    uuid primary key default gen_random_uuid(),
  client_code           text unique not null,           -- short code (TATA, IVAS, ONIDA)
  client_name           text not null,
  brand_name            text not null,                  -- FM / OV
  brand_code            text not null,                  -- 'FM' | 'OV'
  retainer_amount       numeric(12,2) not null default 0,
  retainer_currency     char(3) not null default 'INR',
  billing_cycle         text not null default 'monthly',
  scope_included        jsonb not null default '[]',    -- ["10 reels","8 posts","2 videos"]
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
```

### `client_assignees`
Many-to-many between users and clients (CS team coverage).

```sql
create table client_assignees (
  client_id  uuid not null references clients(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  primary key (client_id, user_id)
);
```

### `job_codes`
Atomic per (brand, client, month, type). Sequence drawn from a per-row counter table.

```sql
create table job_code_sequences (
  brand_code text not null,
  client_id  uuid not null references clients(id) on delete cascade,
  month_key  char(4) not null,         -- 'MMYY' e.g. '0526'
  type_code  char(1) not null,         -- R,C,V,E,S
  last_seq   int not null default 0,
  primary key (brand_code, client_id, month_key, type_code)
);

create table job_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,    -- 'FM-TATA-0526-E07'
  ticket_id   uuid unique references tickets(id) on delete cascade,
  brand_code  text not null,
  client_id   uuid not null references clients(id),
  month_key   char(4) not null,
  type_code   char(1) not null,
  sequence    int not null,
  created_at  timestamptz not null default now()
);
create index idx_job_codes_client on job_codes(client_id);
create index idx_job_codes_month on job_codes(month_key);
```

### `tickets`
Central commercial unit. One request = one ticket.

```sql
create table tickets (
  id                uuid primary key default gen_random_uuid(),
  ticket_number     bigserial unique,                   -- human-friendly running #
  client_id         uuid not null references clients(id),
  title             text not null,
  description       text,
  request_type      text not null,                      -- 'reel','post','video','strategy','shoot','edit',...
  classification    classification,                     -- nullable until set
  priority          ticket_priority not null default 'medium',
  status            ticket_status not null default 'pending_classification',
  approval_stage    approval_stage not null default 'not_required',
  billing_status    billing_status not null default 'not_billable',
  estimated_hours   numeric(6,2),
  deadline          timestamptz,
  requested_by_id   uuid not null references users(id),
  assigned_team     text,                                -- 'video_team','design_team','operations'
  assigned_to_id    uuid references users(id),
  job_code_id       uuid references job_codes(id),
  parent_ticket_id  uuid references tickets(id),         -- revision links to parent
  revision_round    int not null default 0,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint chk_classification_required_after_intake
    check (status = 'pending_classification' or classification is not null)
);

create index idx_tickets_client on tickets(client_id) where deleted_at is null;
create index idx_tickets_status on tickets(status) where deleted_at is null;
create index idx_tickets_classification on tickets(classification);
create index idx_tickets_approval_stage on tickets(approval_stage)
  where approval_stage in ('pending_management','pending_client');
create index idx_tickets_assigned on tickets(assigned_to_id) where deleted_at is null;
create index idx_tickets_deadline on tickets(deadline) where deleted_at is null;
```

### `approvals`
Approval state machine history. Append-only per stage transition.

```sql
create table approvals (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references tickets(id) on delete cascade,
  stage         approval_stage not null,
  decision      text not null check (decision in ('requested','approved','rejected','withdrawn')),
  actor_id      uuid references users(id),
  actor_label   text,                                    -- e.g. 'client:rahul@tata.com' for external decisions
  comment       text,
  estimated_amount numeric(12,2),
  created_at    timestamptz not null default now()
);
create index idx_approvals_ticket on approvals(ticket_id, created_at);
create index idx_approvals_pending on approvals(stage)
  where decision = 'requested';
```

### `tasks`
Execution units derived from a ticket. One ticket may produce many tasks (e.g. shoot + edit + post).

```sql
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
```

### `time_logs`
Time entries on tasks. Aggregated for utilization + profitability.

```sql
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
```

### `revisions`
Revision counter against scope budget per ticket/parent.

```sql
create table revisions (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references tickets(id) on delete cascade,
  parent_ticket_id uuid not null references tickets(id),
  round_number    int not null,
  within_scope    boolean not null default true,
  requested_by_id uuid references users(id),
  notes           text,
  created_at      timestamptz not null default now(),
  unique (parent_ticket_id, round_number)
);
```

### `change_requests`
Formal scope-change documents (bigger than a ticket).

```sql
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
```

### `billables`
Materialized commercial outcome. One row per ticket-once-billable.

```sql
create table billables (
  id                uuid primary key default gen_random_uuid(),
  ticket_id         uuid unique not null references tickets(id) on delete cascade,
  client_id         uuid not null references clients(id),
  job_code_id       uuid references job_codes(id),
  classification    classification not null,
  amount            numeric(12,2) not null default 0,
  currency          char(3) not null default 'INR',
  billing_period    char(7) not null,                   -- 'YYYY-MM'
  status            billing_status not null default 'pending_billing',
  invoiced_at       timestamptz,
  invoice_ref       text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_billables_client_period on billables(client_id, billing_period);
create index idx_billables_status on billables(status);
```

### `comments`
Polymorphic comment thread.

```sql
create table comments (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('ticket','task','change_request','client')),
  entity_id     uuid not null,
  author_id     uuid not null references users(id),
  body          text not null,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  deleted_at    timestamptz
);
create index idx_comments_entity on comments(entity_type, entity_id, created_at);
```

### `attachments`
Polymorphic file references (Supabase Storage).

```sql
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
```

### `notifications`
Per-user inbox.

```sql
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  type        text not null,                    -- 'approval_request','status_change',...
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_notifications_user_unread on notifications(user_id, created_at)
  where read_at is null;
```

### `audit_log`
Append-only. Every mutation that matters is logged here by trigger.

```sql
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references users(id),
  action      text not null,                    -- 'create','update','classify','approve','reject',...
  entity_type text not null,
  entity_id   uuid not null,
  before      jsonb,
  after       jsonb,
  context     jsonb,
  created_at  timestamptz not null default now()
);
create index idx_audit_entity on audit_log(entity_type, entity_id, created_at);
create index idx_audit_actor on audit_log(actor_id, created_at);
```

---

## Triggers

### 1. `set_updated_at`
Single shared trigger function applied to every table with `updated_at`.

### 2. `tickets_classification_router`
On `tickets` UPDATE when `classification` changes from NULL:
- `included` → status='approved', approval_stage='not_required', auto-create default tasks
- `revision` → check revision budget; if exceeded, mark billing_status='pending_billing'
- `extra_billable` → approval_stage='pending_management'; insert approvals row
- `goodwill` → approval_stage='pending_management'
- `out_of_scope` → notify management; approval_stage='pending_management'

### 3. `tickets_job_code_on_approve`
On `tickets` UPDATE when `approval_stage` transitions to `'approved'`:
- Call `generate_job_code(brand_code, client_id, type_code)` → set `tickets.job_code_id`

### 4. `tickets_to_billable`
On `tickets` UPDATE when `status` becomes `'delivered'`:
- If `classification` in (`extra_billable`,`revision-out-of-budget`) → upsert into `billables`

### 5. `audit_trail`
Generic trigger writing before/after JSON to `audit_log` on INSERT/UPDATE of: tickets, approvals, classifications, billables, change_requests, clients.

---

## Materialized views

### `mv_client_profitability` (refresh nightly)
```sql
select
  c.id as client_id,
  c.client_name,
  c.retainer_amount,
  date_trunc('month', now()) as month,
  coalesce(sum(case when b.classification='extra_billable' then b.amount end), 0) as extra_billed,
  coalesce(sum(case when b.classification='goodwill' then b.amount end), 0) as goodwill_value,
  coalesce(sum(tl.hours), 0) as hours_logged,
  count(distinct t.id) filter (where t.classification='revision') as revisions_used,
  c.allowed_revisions
from clients c
left join tickets t on t.client_id = c.id
left join tasks tk on tk.ticket_id = t.id
left join time_logs tl on tl.task_id = tk.id
left join billables b on b.ticket_id = t.id
group by c.id;
```

### `mv_team_utilization` (refresh hourly)
Per-user weekly hours vs. capacity (assumes 40h/week).

### `mv_scope_leakage`
Per-client running total of goodwill + unbilled-but-out-of-scope work.

---

## RLS — high-level rules

| Role | clients | tickets | approvals | billables | users |
|------|---------|---------|-----------|-----------|-------|
| super_admin | all | all | all | all | all |
| management | all | all | approve mgmt-stage | all | read |
| accounts | read | read | read | all | read |
| client_servicing | assigned only | assigned client tickets | request only | none | self |
| operations | read | tickets routed to ops team | none | none | self |
| video_team | read | tickets routed to video | none | none | self |
| design_team | read | tickets routed to design | none | none | self |

Full policies in `supabase/migrations/0003_rls.sql`.

---

## Soft delete pattern

- Every "user-owned" table has `deleted_at timestamptz`.
- Default queries filter `where deleted_at is null` via a helper.
- Indexes are partial: `where deleted_at is null`.
- Restore is a single `update set deleted_at = null`.
- Hard delete is restricted to `super_admin` and writes to `audit_log` with action='hard_delete'.
