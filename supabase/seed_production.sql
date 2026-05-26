-- ============================================================================
-- seed_production.sql — REAL agency data from "Billable task role.xlsx"
--
-- Idempotent: safe to run repeatedly. Handles the case where some teammates
-- have already signed in via Google OAuth (their auth.users row exists with
-- a real UUID) — the seed reuses their real UUID rather than failing on the
-- email uniqueness constraint.
--
-- Role mapping per Sheet 2:
--   Master Admin                       → super_admin
--   Admin                              → management
--   All Accounts                       → accounts
--   Limited to client | Ticket | Work  → client_servicing
--   Task                               → design_team
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Wipe transactional / demo / stale-mapping data
--
-- public.users is in the truncate list now: any prior seed could have written
-- rows whose id no longer matches the current auth.users id for that email.
-- Truncating public.users does NOT touch auth.users (the FK only cascades
-- DOWNWARD, from auth.users → public.users).
-- ----------------------------------------------------------------------------
truncate table
  audit_log, notifications, notification_dispatch, attachments, comments,
  invoices, invoice_number_sequences,
  billables, change_requests, revisions, time_logs,
  tasks, approvals, tickets, job_codes, job_code_sequences,
  client_assignees, clients, departments,
  public.users
restart identity cascade;

-- Remove the original demo seed auth users (old @futuready.com / @orangevideos.com
-- domains). Real production accounts at @futureadymedia.com / @orangevideos.in
-- are left alone — those are real Google sign-ins.
delete from auth.users
 where email like '%@futuready.com'
    or email like '%@orangevideos.com';

-- ----------------------------------------------------------------------------
-- 2. Departments
-- ----------------------------------------------------------------------------
insert into departments (id, name, cost_center) values
  ('11111111-0000-0000-0000-000000000001', 'Client Servicing', 'CS'),
  ('11111111-0000-0000-0000-000000000002', 'Operations',       'OPS'),
  ('11111111-0000-0000-0000-000000000003', 'Creative',         'CRT'),
  ('11111111-0000-0000-0000-000000000004', 'Tech',             'TECH'),
  ('11111111-0000-0000-0000-000000000005', 'Accounts',         'FIN'),
  ('11111111-0000-0000-0000-000000000006', 'Management',       'MGT');

-- ----------------------------------------------------------------------------
-- 3. Team — idempotent person upsert
--
-- For each teammate:
--   • If their auth.users row exists by email (e.g. they've signed in via
--     Google), we reuse that UUID.
--   • Otherwise we create an auth.users row with a fresh UUID.
--   • Then we upsert their public.users row using whichever UUID is real.
-- ----------------------------------------------------------------------------

create or replace function _seed_person(
  p_email       text,
  p_name        text,
  p_role        user_role,
  p_dept_id     uuid,
  p_designation text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = p_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      p_email, '', now(),
      jsonb_build_object('provider', 'seed', 'providers', array['seed']),
      jsonb_build_object('full_name', p_name),
      now(), now(), '', '', '', ''
    )
    on conflict do nothing;

    -- If a race occurred, re-read
    if not found then
      select id into v_user_id from auth.users where email = p_email;
    end if;
  end if;

  insert into public.users (
    id, email, full_name, role, department_id, designation, is_active
  ) values (
    v_user_id, p_email, p_name, p_role, p_dept_id, p_designation, true
  )
  on conflict (id) do update set
    email         = excluded.email,
    full_name     = excluded.full_name,
    role          = excluded.role,
    department_id = excluded.department_id,
    designation   = excluded.designation,
    is_active     = true,
    deleted_at    = null,
    updated_at    = now();

  return v_user_id;
end;
$$;

-- Master Admin
select _seed_person('amey@futureadymedia.com',   'Amey Asuti',    'super_admin', '11111111-0000-0000-0000-000000000006', 'Founder & CEO');
select _seed_person('ritesh@futureadymedia.com', 'Ritesh Bhagat', 'super_admin', '11111111-0000-0000-0000-000000000002', 'Operations Head');

-- Admin (management)
select _seed_person('shweta.asuti@orangevideos.in', 'Shweta Asuti',   'management', '11111111-0000-0000-0000-000000000006', 'Partner | Orange Videos');
select _seed_person('zeeshan@futureadymedia.com',   'Zeeshan Thakur', 'management', '11111111-0000-0000-0000-000000000001', 'Client Success Head');
select _seed_person('karthik@futureadymedia.com',   'Karthik PS',     'management', '11111111-0000-0000-0000-000000000001', 'Growth Strategy Manager');

-- Client Servicing
select _seed_person('sameera@futureadymedia.com', 'Sameera Mishrikotkar', 'client_servicing', '11111111-0000-0000-0000-000000000001', 'Client Success Lead');
select _seed_person('pranali@futureadymedia.com', 'Pranali Ughade',       'client_servicing', '11111111-0000-0000-0000-000000000001', 'Sr. Account Manager');
select _seed_person('rachna@futureadymedia.com',  'Rachna Dadlani',       'client_servicing', '11111111-0000-0000-0000-000000000001', 'Sr. Account Manager');
select _seed_person('ashmita@futureadymedia.com', 'Ashmita Dhar',         'client_servicing', '11111111-0000-0000-0000-000000000001', 'Account Manager');
select _seed_person('roshan@futureadymedia.com',  'Roshan Surve',         'client_servicing', '11111111-0000-0000-0000-000000000004', 'Tech Team Lead');
select _seed_person('shabib@orangevideos.in',     'Shabib Mokles',        'client_servicing', '11111111-0000-0000-0000-000000000001', 'Account Manager');

-- Creative
select _seed_person('karen@futureadymedia.com',   'Karen Sequeira', 'design_team', '11111111-0000-0000-0000-000000000003', 'Creative Head');

-- Accounts
select _seed_person('shweta.dhuri@futureadymedia.com', 'Shweta Dhuri', 'accounts', '11111111-0000-0000-0000-000000000005', 'Sr. Accounts Executive');

drop function _seed_person(text, text, user_role, uuid, text);

-- ----------------------------------------------------------------------------
-- 4. Clients — EXACT codes from Sheet 1
--
-- AM IDs resolved by email so we don't depend on hardcoded UUIDs (Ritesh's
-- real Google-issued UUID won't match any seed UUID).
-- ----------------------------------------------------------------------------
insert into clients (
  id, client_code, client_name, brand_name, brand_code,
  billing_name, country, currency, tax_rate, payment_terms_days,
  retainer_amount, scope_included, allowed_revisions,
  account_manager_id, department_id,
  status, profitability_status, start_date, end_date
) values
  ('cc000000-0000-0000-0000-000000000001', 'FRM01022060', 'Bhilosa', 'Futuready Media', 'FRM',
   'Bhilosa Industries Pvt. Ltd.', 'IN', 'INR', 18.00, 30,
   75000, '[]'::jsonb, 2,
   (select id from public.users where email = 'ashmita@futureadymedia.com'),
   '11111111-0000-0000-0000-000000000001',
   'active', 'healthy', '2026-02-01', '2027-02-01'),

  ('cc000000-0000-0000-0000-000000000002', 'FRM02022060', 'Balu', 'Futuready Media', 'FRM',
   'Balu Industries Pvt. Ltd.', 'IN', 'INR', 18.00, 30,
   75000, '[]'::jsonb, 2,
   (select id from public.users where email = 'pranali@futureadymedia.com'),
   '11111111-0000-0000-0000-000000000001',
   'active', 'bleeding', '2026-02-02', '2027-02-02'),

  ('cc000000-0000-0000-0000-000000000003', 'FRM03022060', 'Neelkamal', 'Futuready Media', 'FRM',
   'Neelkamal Industries Pvt. Ltd.', 'IN', 'INR', 18.00, 30,
   75000, '[]'::jsonb, 2,
   (select id from public.users where email = 'zeeshan@futureadymedia.com'),
   '11111111-0000-0000-0000-000000000001',
   'active', 'at_risk', '2026-02-03', '2027-02-03'),

  ('cc000000-0000-0000-0000-000000000004', 'FRM04022060', 'HCL', 'Futuready Media', 'FRM',
   'HCL Industries Pvt. Ltd.', 'IN', 'INR', 18.00, 30,
   75000, '[]'::jsonb, 2,
   (select id from public.users where email = 'sameera@futureadymedia.com'),
   '11111111-0000-0000-0000-000000000001',
   'active', 'unknown', '2026-02-04', '2027-02-04'),

  ('cc000000-0000-0000-0000-000000000005', 'FRM05022060', 'ETG', 'Futuready Media', 'FRM',
   'ETG Industries Pvt. Ltd.', 'IN', 'INR', 18.00, 30,
   75000, '[]'::jsonb, 2,
   (select id from public.users where email = 'ashmita@futureadymedia.com'),
   '11111111-0000-0000-0000-000000000001',
   'active', 'healthy', '2026-02-05', '2027-02-05'),

  ('cc000000-0000-0000-0000-000000000006', 'OV060220260', 'TATA AIG', 'Orange Videos', 'OV',
   'Tata group of services', 'IN', 'INR', 18.00, 30,
   75000, '[]'::jsonb, 2,
   (select id from public.users where email = 'shabib@orangevideos.in'),
   '11111111-0000-0000-0000-000000000001',
   'active', 'healthy', '2026-02-06', '2027-02-06'),

  ('cc000000-0000-0000-0000-000000000007', 'OV070220260', 'Hiranandani', 'Orange Videos', 'OV',
   'Hiranandani groups', 'IN', 'INR', 18.00, 30,
   75000, '[]'::jsonb, 2,
   (select id from public.users where email = 'rachna@futureadymedia.com'),
   '11111111-0000-0000-0000-000000000001',
   'paused', 'at_risk', '2026-02-07', '2027-02-07'),

  ('cc000000-0000-0000-0000-000000000008', 'OV080220260', 'Vodafone', 'Orange Videos', 'OV',
   'Vodafone Pvt. Ltd.', 'IN', 'INR', 18.00, 30,
   75000, '[]'::jsonb, 2,
   (select id from public.users where email = 'ritesh@futureadymedia.com'),
   '11111111-0000-0000-0000-000000000001',
   'active', 'unknown', '2026-02-08', '2027-02-08'),

  ('cc000000-0000-0000-0000-000000000009', 'FRM09022060', 'BAC', 'Futuready Media', 'FRM',
   'Book A change', 'IN', 'INR', 18.00, 30,
   75000, '[]'::jsonb, 2,
   (select id from public.users where email = 'karthik@futureadymedia.com'),
   '11111111-0000-0000-0000-000000000001',
   'active', 'at_risk', '2026-02-09', '2027-02-09');

-- ----------------------------------------------------------------------------
-- 5. Client assignees — AM is primary; CS Head + CS Lead get oversight access
-- ----------------------------------------------------------------------------
insert into client_assignees (client_id, user_id, is_primary)
select c.id, c.account_manager_id, true
  from clients c
 where c.account_manager_id is not null;

insert into client_assignees (client_id, user_id, is_primary)
select c.id, u.id, false
  from clients c
 cross join public.users u
 where u.email in ('zeeshan@futureadymedia.com', 'sameera@futureadymedia.com')
   and not exists (
     select 1 from client_assignees ca
     where ca.client_id = c.id and ca.user_id = u.id
   );

commit;

-- ============================================================================
-- VERIFY — paste these into SQL Editor:
-- ============================================================================
-- select email, full_name, role, designation from public.users where is_active = true order by role, full_name;
-- select count(*) from clients;  -- should be 9
-- select client_code, client_name, brand_code, profitability_status, status,
--        u.full_name as am, u.email as am_email
--   from clients c left join public.users u on u.id = c.account_manager_id
--  order by client_code;
