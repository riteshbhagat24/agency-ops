# RBAC — Roles & Permissions

## Roles

| Role | Description | Typical user |
|------|-------------|--------------|
| `super_admin` | Full system access, schema migrations, user provisioning | CTO / founder |
| `management` | Approves billables, sees full margin data, all clients | Founder, COO |
| `accounts` | Reads everything finance needs; raises invoices | Finance team |
| `client_servicing` | Owns assigned clients; raises tickets; records approvals | CS execs, AMs |
| `operations` | Executes operations tasks | Ops team |
| `video_team` | Executes video tasks | Video editors / DOP |
| `design_team` | Executes design tasks | Designers |

---

## Permission matrix (UI-facing)

| Capability | super_admin | management | accounts | CS | ops | video | design |
|------------|:-----------:|:----------:|:--------:|:--:|:---:|:-----:|:------:|
| View dashboard (leadership) | ✓ | ✓ | ✓ | – | – | – | – |
| View personal dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create client | ✓ | ✓ | – | – | – | – | – |
| Edit client master | ✓ | ✓ | partial¹ | – | – | – | – |
| View all clients | ✓ | ✓ | ✓ | – | ✓² | ✓² | ✓² |
| View assigned clients only | – | – | – | ✓ | – | – | – |
| Create ticket | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Classify ticket | ✓ | ✓ | – | ✓ | – | – | – |
| Approve (management stage) | ✓ | ✓ | – | – | – | – | – |
| Record client approval | ✓ | ✓ | – | ✓ | – | – | – |
| Edit own tasks | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Log time | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| View billables | ✓ | ✓ | ✓ | partial³ | – | – | – |
| Mark billable as billed | ✓ | – | ✓ | – | – | – | – |
| Export reports | ✓ | ✓ | ✓ | – | – | – | – |
| Manage users | ✓ | – | – | – | – | – | – |

¹ Accounts can edit `retainer_amount`, `billing_cycle`, `profitability_status` — not scope.
² Ops/Video/Design see clients only as a read-only lookup for ticket context.
³ CS sees billables for their assigned clients.

---

## RLS implementation strategy

A helper function on every policy:

```sql
create or replace function current_user_role()
returns user_role
language sql
stable
as $$
  select role from users where id = auth.uid()
$$;

create or replace function current_user_assigned_clients()
returns table (client_id uuid)
language sql
stable
as $$
  select client_id from client_assignees where user_id = auth.uid()
$$;
```

Policy examples:

```sql
-- clients: read
create policy clients_select on clients
for select using (
  current_user_role() in ('super_admin','management','accounts','operations','video_team','design_team')
  or exists (
    select 1 from client_assignees ca
    where ca.client_id = clients.id and ca.user_id = auth.uid()
  )
);

-- tickets: read
create policy tickets_select on tickets
for select using (
  current_user_role() in ('super_admin','management','accounts')
  or requested_by_id = auth.uid()
  or assigned_to_id = auth.uid()
  or exists (
    select 1 from client_assignees ca
    where ca.client_id = tickets.client_id and ca.user_id = auth.uid()
  )
);

-- tickets: classify (only CS / management / super_admin)
create policy tickets_update_classify on tickets
for update using (
  current_user_role() in ('super_admin','management','client_servicing')
) with check (
  current_user_role() in ('super_admin','management','client_servicing')
);

-- approvals: insert "management approved" only by management role
create policy approvals_insert_mgmt on approvals
for insert with check (
  current_user_role() in ('super_admin','management')
  or (
    stage = 'pending_client'
    and current_user_role() = 'client_servicing'
  )
);
```

Full policy file lives at `supabase/migrations/0003_rls.sql`.

---

## Middleware-level guard (Next.js)

For UI routing, we mirror RBAC in middleware so unauthorized users don't even see the chrome:

```ts
// src/middleware.ts (excerpt)
const ROLE_ROUTES: Record<UserRole, RoutePattern[]> = {
  super_admin:      ['*'],
  management:       ['*'],
  accounts:         ['/dashboard','/clients','/billing','/analytics','/tickets'],
  client_servicing: ['/dashboard','/clients','/tickets','/tasks','/approvals'],
  operations:       ['/dashboard','/tasks','/tickets/:id','/clients'],
  video_team:       ['/dashboard','/tasks','/tickets/:id','/clients'],
  design_team:      ['/dashboard','/tasks','/tickets/:id','/clients'],
};
```

DB is still the source of truth; middleware just keeps the UX honest.
