-- ============================================================================
-- seed.sql — realistic demo data for a digital marketing agency
-- Run with: psql "$DATABASE_URL" -f supabase/seed.sql
-- ============================================================================
-- Safe to re-run: truncates demo rows and cleans demo auth.users.
--
-- Important: public.users.id FK-references auth.users.id, so we must
-- create auth.users rows first. The on_auth_user_created trigger will
-- auto-populate public.users; we then UPDATE to set the correct role.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Reset demo data (idempotent re-run support)
-- ----------------------------------------------------------------------------
truncate table
  audit_log, notifications, attachments, comments,
  billables, change_requests, revisions, time_logs,
  tasks, approvals, tickets, job_codes, job_code_sequences,
  client_assignees, clients, departments
restart identity cascade;

-- Wipe any prior demo auth users (cascades to public.users via FK).
delete from auth.users where email in (
  'ritesh@futuready.com',
  'mgmt@futuready.com',
  'finance@futuready.com',
  'priya@futuready.com',
  'rohan@futuready.com',
  'tanvi@orangevideos.com',
  'aman@orangevideos.com',
  'sneha@orangevideos.com',
  'devansh@futuready.com',
  'meera@futuready.com',
  'ops@futuready.com'
);

-- ----------------------------------------------------------------------------
-- Departments
-- ----------------------------------------------------------------------------
insert into departments (id, name, cost_center) values
  ('11111111-0000-0000-0000-000000000001', 'Client Servicing',   'CS'),
  ('11111111-0000-0000-0000-000000000002', 'Operations',         'OPS'),
  ('11111111-0000-0000-0000-000000000003', 'Video Team',         'VID'),
  ('11111111-0000-0000-0000-000000000004', 'Design Team',        'DES'),
  ('11111111-0000-0000-0000-000000000005', 'Accounts',           'FIN'),
  ('11111111-0000-0000-0000-000000000006', 'Management',         'MGT');

-- ----------------------------------------------------------------------------
-- Demo users.
--
-- Approach:
--   1. Insert into auth.users with minimum required columns
--      (Supabase's on_auth_user_created trigger auto-creates public.users)
--   2. UPDATE public.users to set role, department, full name
--
-- Passwords are intentionally unusable strings — these accounts are for
-- viewing seed data only. Real sign-in still goes through Google OAuth.
-- ----------------------------------------------------------------------------

-- Helper function: insert into auth.users with safe defaults.
create or replace function _seed_auth_user(
  p_id    uuid,
  p_email text,
  p_name  text
) returns void
language plpgsql
security definer
as $$
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    p_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    '',
    now(),
    jsonb_build_object('provider', 'seed', 'providers', array['seed']),
    jsonb_build_object('full_name', p_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;
end;
$$;

select _seed_auth_user('a0000000-0000-0000-0000-000000000001', 'ritesh@futuready.com',   'Ritesh Bhandari');
select _seed_auth_user('a0000000-0000-0000-0000-000000000002', 'mgmt@futuready.com',     'Aanya Mehta');
select _seed_auth_user('a0000000-0000-0000-0000-000000000003', 'finance@futuready.com',  'Karan Shah');
select _seed_auth_user('a0000000-0000-0000-0000-000000000004', 'priya@futuready.com',    'Priya Iyer');
select _seed_auth_user('a0000000-0000-0000-0000-000000000005', 'rohan@futuready.com',    'Rohan Sethi');
select _seed_auth_user('a0000000-0000-0000-0000-000000000006', 'tanvi@orangevideos.com', 'Tanvi Kapoor');
select _seed_auth_user('a0000000-0000-0000-0000-000000000007', 'aman@orangevideos.com',  'Aman Joshi');
select _seed_auth_user('a0000000-0000-0000-0000-000000000008', 'sneha@orangevideos.com', 'Sneha Rao');
select _seed_auth_user('a0000000-0000-0000-0000-000000000009', 'devansh@futuready.com',  'Devansh Patel');
select _seed_auth_user('a0000000-0000-0000-0000-00000000000a', 'meera@futuready.com',    'Meera Nair');
select _seed_auth_user('a0000000-0000-0000-0000-00000000000b', 'ops@futuready.com',      'Vikram Singh');

-- The on_auth_user_created trigger has created matching public.users rows
-- with default role = client_servicing (or super_admin if first user).
-- Now upsert to set the correct role + department + name for each.

insert into public.users (id, email, full_name, role, department_id, is_active) values
  ('a0000000-0000-0000-0000-000000000001', 'ritesh@futuready.com',     'Ritesh Bhandari',  'super_admin',      '11111111-0000-0000-0000-000000000006', true),
  ('a0000000-0000-0000-0000-000000000002', 'mgmt@futuready.com',       'Aanya Mehta',      'management',       '11111111-0000-0000-0000-000000000006', true),
  ('a0000000-0000-0000-0000-000000000003', 'finance@futuready.com',    'Karan Shah',       'accounts',         '11111111-0000-0000-0000-000000000005', true),
  ('a0000000-0000-0000-0000-000000000004', 'priya@futuready.com',      'Priya Iyer',       'client_servicing', '11111111-0000-0000-0000-000000000001', true),
  ('a0000000-0000-0000-0000-000000000005', 'rohan@futuready.com',      'Rohan Sethi',      'client_servicing', '11111111-0000-0000-0000-000000000001', true),
  ('a0000000-0000-0000-0000-000000000006', 'tanvi@orangevideos.com',   'Tanvi Kapoor',     'client_servicing', '11111111-0000-0000-0000-000000000001', true),
  ('a0000000-0000-0000-0000-000000000007', 'aman@orangevideos.com',    'Aman Joshi',       'video_team',       '11111111-0000-0000-0000-000000000003', true),
  ('a0000000-0000-0000-0000-000000000008', 'sneha@orangevideos.com',   'Sneha Rao',        'video_team',       '11111111-0000-0000-0000-000000000003', true),
  ('a0000000-0000-0000-0000-000000000009', 'devansh@futuready.com',    'Devansh Patel',    'design_team',      '11111111-0000-0000-0000-000000000004', true),
  ('a0000000-0000-0000-0000-00000000000a', 'meera@futuready.com',      'Meera Nair',       'design_team',      '11111111-0000-0000-0000-000000000004', true),
  ('a0000000-0000-0000-0000-00000000000b', 'ops@futuready.com',        'Vikram Singh',     'operations',       '11111111-0000-0000-0000-000000000002', true)
on conflict (id) do update set
  email         = excluded.email,
  full_name     = excluded.full_name,
  role          = excluded.role,
  department_id = excluded.department_id,
  is_active     = excluded.is_active,
  updated_at    = now();

drop function _seed_auth_user(uuid, text, text);

-- ----------------------------------------------------------------------------
-- Clients
-- ----------------------------------------------------------------------------
insert into clients (
  id, client_code, client_name, brand_name, brand_code,
  retainer_amount, scope_included, allowed_revisions,
  account_manager_id, department_id, status, profitability_status,
  start_date, end_date
) values
  ('c0000000-0000-0000-0000-000000000001', 'TATA',  'Tata Communications',  'Futuready Media', 'FM',
   350000, '["10 reels/mo","8 static posts/mo","2 long videos/mo","weekly review"]', 2,
   'a0000000-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001',
   'active', 'healthy', '2025-04-01', null),

  ('c0000000-0000-0000-0000-000000000002', 'IVAS',  'IVAS Skincare',        'Futuready Media', 'FM',
   120000, '["6 reels/mo","12 posts/mo","1 campaign/quarter"]', 2,
   'a0000000-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001',
   'active', 'at_risk', '2025-09-15', null),

  ('c0000000-0000-0000-0000-000000000003', 'ONIDA', 'Onida Electronics',    'Futuready Media', 'FM',
   90000,  '["4 reels/mo","8 posts/mo"]', 2,
   'a0000000-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001',
   'active', 'healthy', '2026-01-10', null),

  ('c0000000-0000-0000-0000-000000000004', 'HIRA',  'Hira Diamonds',        'Orange Videos',   'OV',
   200000, '["2 brand films/qtr","4 reels/mo","quarterly campaign"]', 1,
   'a0000000-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001',
   'active', 'bleeding', '2025-07-01', null),

  ('c0000000-0000-0000-0000-000000000005', 'BLUE',  'Bluebird Cafes',       'Futuready Media', 'FM',
   75000,  '["3 reels/mo","6 posts/mo"]', 2,
   'a0000000-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001',
   'active', 'healthy', '2026-02-01', null),

  ('c0000000-0000-0000-0000-000000000006', 'KAYA',  'Kaya Wellness',        'Orange Videos',   'OV',
   180000, '["2 long videos/mo","4 reels/mo","1 shoot/qtr"]', 2,
   'a0000000-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001',
   'paused', 'unknown', '2025-06-01', '2026-04-30');

-- Assign CS users to clients
insert into client_assignees (client_id, user_id, is_primary) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', true),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', false),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', true),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', true),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', true),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', true),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', true);

-- ----------------------------------------------------------------------------
-- Tickets — a realistic mix of classifications
-- We bypass the trigger for seed by setting status explicitly afterwards.
-- ----------------------------------------------------------------------------

-- 1. Included retainer post
insert into tickets (
  id, client_id, title, description, request_type, classification, priority,
  status, approval_stage, billing_status,
  estimated_hours, deadline, requested_by_id, assigned_team, assigned_to_id
) values (
  'b0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'May launch reel — Tata Network campaign',
  'Reel 1 of 10 for May. Brief attached.',
  'reel', 'included', 'high',
  'in_progress', 'not_required', 'not_billable',
  6, now() + interval '3 days',
  'a0000000-0000-0000-0000-000000000004', 'video_team',
  'a0000000-0000-0000-0000-000000000007'
);

-- 2. Extra billable awaiting management approval
insert into tickets (
  id, client_id, title, description, request_type, classification, priority,
  status, approval_stage, billing_status,
  estimated_hours, estimated_amount, deadline, requested_by_id, assigned_team
) values (
  'b0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000001',
  'Client requested 3 extra reels for Q2 push',
  'Outside retainer; client wants reshoot + edit.',
  'reel', 'extra_billable', 'urgent',
  'waiting_approval', 'pending_management', 'pending_billing',
  18, 18000, now() + interval '5 days',
  'a0000000-0000-0000-0000-000000000004', 'video_team'
);
insert into approvals (ticket_id, stage, decision, comment, estimated_amount)
values ('b0000000-0000-0000-0000-000000000002', 'pending_management', 'requested', 'Extra reels — needs mgmt approval', 18000);

-- 3. Goodwill request awaiting management
insert into tickets (
  id, client_id, title, description, request_type, classification, priority,
  status, approval_stage, billing_status,
  estimated_hours, estimated_amount, deadline, requested_by_id, assigned_team
) values (
  'b0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000002',
  'Anniversary social wishes pack',
  'Free goodwill — 3 design assets.',
  'post', 'goodwill', 'medium',
  'waiting_approval', 'pending_management', 'not_billable',
  4, 6000, now() + interval '2 days',
  'a0000000-0000-0000-0000-000000000005', 'design_team'
);
insert into approvals (ticket_id, stage, decision, comment, estimated_amount)
values ('b0000000-0000-0000-0000-000000000003', 'pending_management', 'requested', 'Goodwill — tracked but free', 6000);

-- 4. Out of scope escalated
insert into tickets (
  id, client_id, title, description, request_type, classification, priority,
  status, approval_stage, billing_status,
  estimated_hours, deadline, requested_by_id
) values (
  'b0000000-0000-0000-0000-000000000004',
  'c0000000-0000-0000-0000-000000000004',
  'Full brand re-positioning workshop',
  'Client asked for 2-day workshop. Not in SOW.',
  'campaign', 'out_of_scope', 'medium',
  'waiting_approval', 'pending_management', 'not_billable',
  16, now() + interval '14 days',
  'a0000000-0000-0000-0000-000000000006'
);
insert into approvals (ticket_id, stage, decision, comment)
values ('b0000000-0000-0000-0000-000000000004', 'pending_management', 'requested', 'Out of scope — needs decision');

-- 5. Revision in scope
insert into tickets (
  id, client_id, title, description, request_type, classification, priority,
  status, approval_stage, billing_status,
  estimated_hours, deadline, requested_by_id, parent_ticket_id, revision_round
) values (
  'b0000000-0000-0000-0000-000000000005',
  'c0000000-0000-0000-0000-000000000001',
  'Reel 1 — color grade revision',
  'Client wants warmer tone.',
  'edit', 'revision', 'medium',
  'in_progress', 'not_required', 'not_billable',
  2, now() + interval '1 days',
  'a0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000001', 1
);
insert into revisions (ticket_id, parent_ticket_id, round_number, within_scope, requested_by_id, notes)
values ('b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 1, true,
        'a0000000-0000-0000-0000-000000000004', 'Round 1 — color grade');

-- 6. Approved & delivered extra billable (with billable record)
insert into tickets (
  id, client_id, title, description, request_type, classification, priority,
  status, approval_stage, billing_status,
  estimated_hours, estimated_amount, deadline, requested_by_id, assigned_team
) values (
  'b0000000-0000-0000-0000-000000000006',
  'c0000000-0000-0000-0000-000000000003',
  'Branded sticker pack design',
  'Pack of 8 stickers for festive push.',
  'post', 'extra_billable', 'medium',
  'delivered', 'approved', 'pending_billing',
  6, 9500, now() - interval '4 days',
  'a0000000-0000-0000-0000-000000000004', 'design_team'
);
insert into approvals (ticket_id, stage, decision, actor_id, comment, estimated_amount) values
  ('b0000000-0000-0000-0000-000000000006', 'pending_management', 'requested', null, 'requested', 9500),
  ('b0000000-0000-0000-0000-000000000006', 'pending_management', 'approved', 'a0000000-0000-0000-0000-000000000002', 'Approved', 9500),
  ('b0000000-0000-0000-0000-000000000006', 'pending_client', 'approved', null, 'Client approved via email', 9500);

-- Job code + billable for the delivered one
insert into job_code_sequences (brand_code, client_id, month_key, type_code, last_seq) values
  ('FM', 'c0000000-0000-0000-0000-000000000003', to_char(now(),'MMYY'), 'E', 4);
insert into job_codes (id, code, ticket_id, brand_code, client_id, month_key, type_code, sequence)
values ('00000001-0000-0000-0000-000000000006',
        'FM-ONIDA-' || to_char(now(),'MMYY') || '-E04',
        'b0000000-0000-0000-0000-000000000006', 'FM',
        'c0000000-0000-0000-0000-000000000003', to_char(now(),'MMYY'), 'E', 4);
update tickets set job_code_id = '00000001-0000-0000-0000-000000000006'
 where id = 'b0000000-0000-0000-0000-000000000006';

insert into billables (ticket_id, client_id, job_code_id, classification, amount, billing_period, status)
values ('b0000000-0000-0000-0000-000000000006',
        'c0000000-0000-0000-0000-000000000003',
        '00000001-0000-0000-0000-000000000006',
        'extra_billable', 9500, to_char(now(),'YYYY-MM'), 'pending_billing');

-- 7. Approved extra billable in progress (with job code)
insert into tickets (
  id, client_id, title, description, request_type, classification, priority,
  status, approval_stage, billing_status,
  estimated_hours, estimated_amount, deadline, requested_by_id, assigned_team
) values (
  'b0000000-0000-0000-0000-000000000007',
  'c0000000-0000-0000-0000-000000000004',
  'Long-form brand film — extra cut',
  'Client wants a 90s cinema cut.',
  'video', 'extra_billable', 'high',
  'in_progress', 'approved', 'pending_billing',
  24, 45000, now() + interval '10 days',
  'a0000000-0000-0000-0000-000000000006', 'video_team'
);
insert into job_code_sequences (brand_code, client_id, month_key, type_code, last_seq) values
  ('OV', 'c0000000-0000-0000-0000-000000000004', to_char(now(),'MMYY'), 'V', 3);
insert into job_codes (id, code, ticket_id, brand_code, client_id, month_key, type_code, sequence)
values ('00000001-0000-0000-0000-000000000007',
        'OV-HIRA-' || to_char(now(),'MMYY') || '-V03',
        'b0000000-0000-0000-0000-000000000007', 'OV',
        'c0000000-0000-0000-0000-000000000004', to_char(now(),'MMYY'), 'V', 3);
update tickets set job_code_id = '00000001-0000-0000-0000-000000000007'
 where id = 'b0000000-0000-0000-0000-000000000007';
insert into approvals (ticket_id, stage, decision, actor_id, comment, estimated_amount) values
  ('b0000000-0000-0000-0000-000000000007', 'pending_management', 'approved', 'a0000000-0000-0000-0000-000000000002', 'Approved', 45000),
  ('b0000000-0000-0000-0000-000000000007', 'pending_client', 'approved', null, 'Client approved via WhatsApp', 45000);

-- 8. Pending classification (just intake)
insert into tickets (
  id, client_id, title, description, request_type, priority,
  status, deadline, requested_by_id
) values (
  'b0000000-0000-0000-0000-000000000008',
  'c0000000-0000-0000-0000-000000000005',
  'New menu launch reel',
  'Pending — CS needs to classify.',
  'reel', 'medium',
  'pending_classification',
  now() + interval '7 days',
  'a0000000-0000-0000-0000-000000000005'
);

-- ----------------------------------------------------------------------------
-- Tasks
-- ----------------------------------------------------------------------------
insert into tasks (id, ticket_id, title, status, assignee_id, department_id, due_date, estimated_hours, completion_pct) values
  ('aa000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Shoot reel 1', 'completed',  'a0000000-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000003', now() - interval '2 days', 3, 100),
  ('aa000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Edit + grade', 'in_progress','a0000000-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000003', now() + interval '1 day',  3, 60),
  ('aa000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', 'Color grade pass 2', 'in_progress','a0000000-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000003', now() + interval '12 hours', 2, 30),
  ('aa000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000006', 'Design 8 stickers', 'completed', 'a0000000-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000004', now() - interval '5 days', 4, 100),
  ('aa000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000006', 'Final delivery package', 'completed', 'a0000000-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000004', now() - interval '4 days', 2, 100),
  ('aa000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000007', 'Cinema cut edit',     'in_progress','a0000000-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000003', now() + interval '8 days', 12, 25),
  ('aa000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 'Color + sound',       'pending',    'a0000000-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000003', now() + interval '10 days', 12, 0);

-- ----------------------------------------------------------------------------
-- Time logs
-- ----------------------------------------------------------------------------
insert into time_logs (task_id, user_id, hours, work_date, note) values
  ('aa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 3.0, current_date - 3, 'Shoot day'),
  ('aa000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000008', 1.5, current_date - 1, 'First edit pass'),
  ('aa000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000008', 1.0, current_date,     'Color grade'),
  ('aa000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000009', 4.0, current_date - 5, 'Stickers v1'),
  ('aa000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000009', 2.0, current_date - 4, 'Final pack'),
  ('aa000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000007', 4.0, current_date - 1, 'Rough cut'),
  ('aa000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000007', 2.0, current_date,     'Refinement');

-- ----------------------------------------------------------------------------
-- A few historical billables for the dashboard charts
-- ----------------------------------------------------------------------------
insert into billables (ticket_id, client_id, classification, amount, billing_period, status, invoiced_at, invoice_ref) values
  ('b0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000003','extra_billable',9500,  to_char(now() - interval '1 month','YYYY-MM'), 'billed', now() - interval '20 days', 'INV-2046'),
  ('b0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000004','extra_billable',45000, to_char(now() - interval '1 month','YYYY-MM'), 'billed', now() - interval '15 days', 'INV-2051')
on conflict (ticket_id) do nothing;

-- ----------------------------------------------------------------------------
-- Comments + sample notifications
-- ----------------------------------------------------------------------------
insert into comments (entity_type, entity_id, author_id, body) values
  ('ticket','b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000004','Client confirmed scope on WhatsApp — screenshot attached.'),
  ('ticket','b0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000006','Client wants delivery before quarterly review.');

insert into notifications (user_id, type, title, body, entity_type, entity_id) values
  ('a0000000-0000-0000-0000-000000000002', 'approval_request', 'New approval — 3 extra reels',
   'Priya raised an Extra Billable request for Tata Communications', 'ticket', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000002', 'approval_request', 'Goodwill — anniversary post pack',
   'Rohan raised a Goodwill request for IVAS', 'ticket', 'b0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000004', 'pending_client_approval', 'Awaiting client decision',
   'Management approved — record client decision for Tata Communications', 'ticket', 'b0000000-0000-0000-0000-000000000002');

-- Refresh profitability MV
refresh materialized view mv_client_profitability;

commit;
