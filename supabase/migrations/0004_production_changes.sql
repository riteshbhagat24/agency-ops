-- ============================================================================
-- 0004_production_changes.sql
-- Production-readiness changes:
--   • Brand code FRM (Futuready Media) in addition to FM legacy
--   • Country + tax rate + billing info on clients
--   • Invoices table + auto-generation trigger
--   • Tax-aware billables
--   • Designation on users
--   • Notification dispatch (webhook hook for n8n)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Brand code: allow FRM as the canonical brand for Futuready Media.
-- ----------------------------------------------------------------------------
alter table clients drop constraint if exists clients_brand_code_check;
alter table clients
  add constraint clients_brand_code_check
  check (brand_code in ('FRM', 'OV', 'FM'));  -- FM kept for legacy demo rows

-- ----------------------------------------------------------------------------
-- 2. Clients: country, tax, billing details
-- ----------------------------------------------------------------------------
alter table clients
  add column if not exists country              char(2) not null default 'IN',
  add column if not exists currency             char(3) not null default 'INR',
  add column if not exists tax_rate             numeric(5,2) not null default 18.00,
  add column if not exists gstin                text,
  add column if not exists billing_name         text,
  add column if not exists billing_address      text,
  add column if not exists billing_email        text,
  add column if not exists payment_terms_days   int not null default 30;

alter table clients drop column if exists retainer_currency;
-- retainer_currency was redundant with currency; we keep currency

-- ----------------------------------------------------------------------------
-- 3. Users: designation
-- ----------------------------------------------------------------------------
alter table users
  add column if not exists designation text;

-- ----------------------------------------------------------------------------
-- 4. Billables: tax-aware
-- ----------------------------------------------------------------------------
alter table billables
  add column if not exists tax_rate    numeric(5,2) not null default 0,
  add column if not exists tax_amount  numeric(12,2) not null default 0,
  add column if not exists total_amount numeric(12,2) generated always as (amount + tax_amount) stored;

-- ----------------------------------------------------------------------------
-- 5. Invoices table + numbering
-- ----------------------------------------------------------------------------
create table if not exists invoice_number_sequences (
  prefix     text primary key,           -- 'FRM' or 'OV'
  year       int not null,
  last_seq   int not null default 0
);

create table if not exists invoices (
  id                uuid primary key default gen_random_uuid(),
  invoice_number    text unique not null,    -- e.g. 'FRM-2026-0001'
  client_id         uuid not null references clients(id),
  brand_code        text not null,
  billing_period    char(7) not null,
  currency          char(3) not null default 'INR',
  subtotal          numeric(12,2) not null default 0,
  tax_rate          numeric(5,2) not null default 0,
  tax_amount        numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  status            text not null default 'draft'
                    check (status in ('draft','sent','paid','overdue','cancelled','written_off')),
  issued_at         timestamptz,
  due_at            timestamptz,
  paid_at           timestamptz,
  notes             text,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_period on invoices(billing_period);

-- Link billables to invoices (a billable may be on one invoice)
alter table billables
  add column if not exists invoice_id uuid references invoices(id) on delete set null;
create index if not exists idx_billables_invoice on billables(invoice_id);

-- ----------------------------------------------------------------------------
-- 6. Invoice number generator (atomic via advisory lock)
-- ----------------------------------------------------------------------------
create or replace function next_invoice_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now() at time zone 'Asia/Kolkata')::int;
  v_seq  int;
begin
  perform pg_advisory_xact_lock(hashtext(p_prefix || v_year::text));

  insert into invoice_number_sequences (prefix, year, last_seq)
       values (p_prefix, v_year, 1)
  on conflict (prefix) do update
    set year     = case when invoice_number_sequences.year < v_year then v_year else invoice_number_sequences.year end,
        last_seq = case when invoice_number_sequences.year < v_year then 1 else invoice_number_sequences.last_seq + 1 end
    returning last_seq into v_seq;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Trigger: auto-create invoice when a billable is inserted as pending_billing
-- ----------------------------------------------------------------------------
create or replace function billables_auto_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client   record;
  v_inv_id   uuid;
  v_prefix   text;
  v_existing uuid;
  v_terms    int;
  v_tax_rate numeric(5,2);
  v_tax      numeric(12,2);
begin
  if (new.status not in ('pending_billing','billed') or new.classification = 'goodwill') then
    return new;
  end if;

  -- Lookup client details
  select c.brand_code, c.currency, c.tax_rate, c.payment_terms_days
    into v_client
    from clients c where c.id = new.client_id;

  -- Use client tax_rate unless explicitly set on billable
  v_tax_rate := coalesce(nullif(new.tax_rate, 0), v_client.tax_rate);
  v_tax := round(new.amount * v_tax_rate / 100, 2);
  v_terms := v_client.payment_terms_days;

  -- One open invoice per (client, billing_period) — pool billables into it.
  select id into v_existing
    from invoices
   where client_id = new.client_id
     and billing_period = new.billing_period
     and status in ('draft','sent')
   limit 1;

  if v_existing is not null then
    -- attach to existing invoice and recompute
    update invoices
       set subtotal    = (select coalesce(sum(amount), 0) from billables where invoice_id = v_existing),
           tax_amount  = (select coalesce(sum(tax_amount), 0) from billables where invoice_id = v_existing) + v_tax,
           total       = (select coalesce(sum(amount + tax_amount), 0) from billables where invoice_id = v_existing) + new.amount + v_tax,
           updated_at  = now()
     where id = v_existing;

    new.tax_rate   := v_tax_rate;
    new.tax_amount := v_tax;
    new.invoice_id := v_existing;
  else
    v_prefix := v_client.brand_code;
    insert into invoices (
      invoice_number, client_id, brand_code, billing_period, currency,
      subtotal, tax_rate, tax_amount, total, status, due_at
    ) values (
      next_invoice_number(v_prefix), new.client_id, v_client.brand_code,
      new.billing_period, v_client.currency,
      new.amount, v_tax_rate, v_tax, new.amount + v_tax,
      'draft', now() + (v_terms || ' days')::interval
    ) returning id into v_inv_id;

    new.tax_rate   := v_tax_rate;
    new.tax_amount := v_tax;
    new.invoice_id := v_inv_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_billables_auto_invoice on billables;
create trigger trg_billables_auto_invoice
before insert on billables
for each row execute function billables_auto_invoice();

-- ----------------------------------------------------------------------------
-- 8. Notification dispatch queue (webhook → n8n / email)
-- ----------------------------------------------------------------------------
create table if not exists notification_dispatch (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  channel     text not null check (channel in ('email','slack','whatsapp')) default 'email',
  type        text not null,
  subject     text not null,
  body        text,
  payload     jsonb not null default '{}',
  status      text not null default 'pending'
              check (status in ('pending','sent','failed')),
  attempts    int not null default 0,
  last_error  text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_dispatch_pending on notification_dispatch(status, created_at)
  where status = 'pending';

-- ----------------------------------------------------------------------------
-- 9. Trigger: notify assignee when a task is assigned to them
-- ----------------------------------------------------------------------------
create or replace function tasks_notify_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email text;
  v_user_name  text;
  v_ticket     record;
begin
  -- Only act when assignee changes or is newly set
  if (TG_OP = 'INSERT' and new.assignee_id is null) then return new; end if;
  if (TG_OP = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id) then return new; end if;
  if new.assignee_id is null then return new; end if;

  select email, full_name into v_user_email, v_user_name
    from users where id = new.assignee_id;

  select t.title, t.ticket_number, c.client_name
    into v_ticket
    from tickets t join clients c on c.id = t.client_id
   where t.id = new.ticket_id;

  -- In-app notification
  insert into notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    new.assignee_id,
    'task_assigned',
    'New task: ' || new.title,
    coalesce(v_ticket.client_name, 'Client') || ' · ' || coalesce(new.description, 'No description'),
    'task', new.id
  );

  -- Email dispatch (n8n will poll or webhook will pick up)
  insert into notification_dispatch (user_id, channel, type, subject, body, payload)
  values (
    new.assignee_id,
    'email',
    'task_assigned',
    '[Agency Ops] ' || new.title,
    'You have been assigned a new task: ' || new.title ||
    E'\nClient: ' || coalesce(v_ticket.client_name, 'N/A') ||
    E'\nTicket: #' || coalesce(v_ticket.ticket_number::text, 'N/A') ||
    E'\nDue: ' || coalesce(to_char(new.due_date, 'DD Mon YYYY HH24:MI'), 'No deadline'),
    jsonb_build_object(
      'task_id', new.id,
      'ticket_id', new.ticket_id,
      'ticket_number', v_ticket.ticket_number,
      'client_name', v_ticket.client_name,
      'due_date', new.due_date,
      'assignee_name', v_user_name,
      'assignee_email', v_user_email
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_tasks_notify_assignee on tasks;
create trigger trg_tasks_notify_assignee
after insert or update of assignee_id on tasks
for each row execute function tasks_notify_assignee();

-- ----------------------------------------------------------------------------
-- 10. Function: queue AM payment reminders for invoices approaching due date
-- ----------------------------------------------------------------------------
create or replace function queue_payment_reminders(p_days_ahead int default 3)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_inv   record;
begin
  for v_inv in
    select i.id, i.invoice_number, i.total, i.due_at, i.currency,
           c.client_name, c.account_manager_id, c.client_code,
           u.email as am_email, u.full_name as am_name
      from invoices i
      join clients c on c.id = i.client_id
      left join users u on u.id = c.account_manager_id
     where i.status in ('draft','sent')
       and i.due_at is not null
       and i.due_at::date <= (current_date + p_days_ahead)
       and i.due_at::date >= current_date
       and c.account_manager_id is not null
       and not exists (
         select 1 from notification_dispatch nd
         where nd.user_id = c.account_manager_id
           and nd.type = 'payment_reminder'
           and nd.payload->>'invoice_id' = i.id::text
           and nd.created_at::date = current_date
       )
  loop
    insert into notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      v_inv.account_manager_id,
      'payment_reminder',
      'Payment due soon: ' || v_inv.invoice_number,
      v_inv.client_name || ' · ' || v_inv.currency || ' ' || v_inv.total || ' · due ' || to_char(v_inv.due_at, 'DD Mon'),
      'invoice', v_inv.id
    );

    insert into notification_dispatch (user_id, channel, type, subject, body, payload)
    values (
      v_inv.account_manager_id, 'email', 'payment_reminder',
      '[Agency Ops] Payment due — ' || v_inv.invoice_number,
      'Invoice ' || v_inv.invoice_number || ' for ' || v_inv.client_name ||
        ' is due on ' || to_char(v_inv.due_at, 'DD Mon YYYY') ||
        '. Amount: ' || v_inv.currency || ' ' || v_inv.total ||
        E'.\n\nPlease follow up with the client.',
      jsonb_build_object(
        'invoice_id', v_inv.id,
        'invoice_number', v_inv.invoice_number,
        'client_name', v_inv.client_name,
        'amount', v_inv.total,
        'currency', v_inv.currency,
        'due_at', v_inv.due_at,
        'am_email', v_inv.am_email,
        'am_name', v_inv.am_name
      )
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. RLS on new tables
-- ----------------------------------------------------------------------------
alter table invoices              enable row level security;
alter table invoice_number_sequences enable row level security;
alter table notification_dispatch enable row level security;

create policy invoices_select on invoices for select
  using (
    is_staff()
    or exists (select 1 from client_assignees ca where ca.client_id = invoices.client_id and ca.user_id = auth.uid())
  );
create policy invoices_mutate on invoices for all
  using (current_user_role() in ('super_admin','management','accounts'))
  with check (current_user_role() in ('super_admin','management','accounts'));

create policy isq_select on invoice_number_sequences for select using (is_staff());

create policy dispatch_select on notification_dispatch for select
  using (is_staff() or user_id = auth.uid());
