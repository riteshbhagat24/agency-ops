# Architecture Overview

## System purpose

A commercial-operations system for digital marketing agencies. Every unit of work is:
1. **Tracked** — has a ticket, owner, deadline
2. **Classified commercially** — Included / Extra Billable / Revision / Out of Scope / Goodwill
3. **Approval-gated** when it touches revenue
4. **Mapped to a job code** — so finance can bill it
5. **Visible to leadership** — for margin protection

This is not Jira. It is the layer that sits between client requests, internal execution, and the invoice.

---

## High-level architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Next.js)                          │
│                                                                     │
│   ┌─────────────────┐   ┌──────────────────┐   ┌────────────────┐ │
│   │  Server Pages   │   │  Client Components│   │ Realtime feeds │ │
│   │  (RSC + Actions)│   │  (RHF, Zustand)  │   │ (Supabase WS)  │ │
│   └────────┬────────┘   └──────────┬───────┘   └────────┬───────┘ │
└────────────┼────────────────────────┼─────────────────────┼─────────┘
             │                        │                     │
             ▼                        ▼                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                       NEXT.JS RUNTIME (Vercel)                      │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│   │ Route        │  │ Server       │  │  Edge Middleware          │ │
│   │ Handlers     │  │ Actions      │  │  (auth gate, role check)  │ │
│   │ /api/*       │  │              │  │                          │ │
│   └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘ │
└──────────┼─────────────────┼────────────────────────────────────────┘
           │                 │
           ▼                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (Postgres)                         │
│                                                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │  Auth    │  │  RLS     │  │ Realtime │  │  Edge Functions  │  │
│   │ (Google) │  │ Policies │  │ Channels │  │  (jobcode, hooks)│  │
│   └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                                     │
│   Tables: users · clients · tickets · classifications · approvals  │
│           tasks · time_logs · billables · revisions · audit_log    │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼  (webhook)
┌────────────────────────────────────────────────────────────────────┐
│                    n8n (external automation)                        │
│   • WhatsApp / Email approvals  • Slack notifications              │
│   • Invoice export to Tally / Zoho  • Daily margin reports         │
└────────────────────────────────────────────────────────────────────┘
```

---

## Key architectural decisions

### 1. App Router with Server Components by default

- Reads → React Server Components fetching directly from Supabase with the user's session
- Writes → Server Actions (mutations) or Route Handlers (webhooks / file uploads)
- Client Components only where genuinely interactive (forms, tables, modals, command palette)

**Why:** kills the API-layer-for-its-own-sake. RLS is the authorization plane; we don't re-implement it in a controller.

### 2. Row-Level Security as the authorization plane

Every table has RLS policies keyed off `auth.uid()` and the `users.role` lookup. The Next.js layer never trusts client-supplied user IDs.

```sql
-- example: a CS exec can read their assigned client tickets
create policy "cs reads assigned client tickets"
  on tickets for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.role in ('super_admin','management','accounts')
    )
    or exists (
      select 1 from client_assignees ca
      where ca.client_id = tickets.client_id
        and ca.user_id = auth.uid()
    )
  );
```

### 3. Feature-sliced source layout (`src/features/<slice>`)

Each business capability is a vertical slice: server queries, mutations, UI components, types. This stops the codebase from becoming a heap of `components/` and `lib/`.

### 4. Job codes generated server-side, monotonic per (brand, client, month, type)

The job code is the bridge to finance. Generation must be:
- atomic (no duplicates under concurrency)
- deterministic (regeneration is reproducible)
- auditable

Implemented as a Postgres function `generate_job_code(...)` called from a `BEFORE INSERT` trigger. See [`03-job-code-engine.md`](./03-job-code-engine.md).

### 5. Classification is mandatory at the DB level

`tickets.classification` is `NOT NULL`. A `CHECK` constraint allows only the five legal values. Approval state machine is enforced by trigger, not application code:

```
classification = 'extra_billable' → approval_state must transition through:
  pending_management → pending_client → approved | rejected
```

### 6. Audit log is immutable

`audit_log` table is append-only (RLS denies UPDATE/DELETE for everyone except a maintenance role). Every state-changing mutation writes a row.

### 7. Realtime where it matters

Subscribe to:
- `tickets` channel for the live queue
- `approvals` channel for the management approval inbox
- `notifications` per-user

Everywhere else: server fetch + cache revalidation. Realtime is not free.

---

## Request lifecycle (canonical happy path)

```
Client Servicing
    │
    │  1. New request via intake form
    ▼
┌──────────────┐
│   tickets    │  status=pending, classification=REQUIRED, job_code=null
└──────┬───────┘
       │  2. CS picks classification → trigger fires
       ▼
   ┌─────────────────────────────────────────────────┐
   │ classification routing                          │
   ├─────────────────────────────────────────────────┤
   │ included      → tasks created, status=ready     │
   │ revision      → check revision budget, may flag │
   │ extra_billable→ approvals (mgmt → client)       │
   │ goodwill      → approval (mgmt only)            │
   │ out_of_scope  → escalation queue                │
   └─────────────────────────────────────────────────┘
       │  3. On approval → job_code generated
       ▼
┌──────────────┐
│  job_code    │  e.g. FM-TATA-0526-E07
└──────┬───────┘
       │  4. Tasks dispatched to Operations / Video / Design
       ▼
┌──────────────┐
│    tasks     │  with time_logs
└──────┬───────┘
       │  5. Completed → delivered → moved to billables
       ▼
┌──────────────┐
│  billables   │  surfaced in weekly/monthly billing summary
└──────────────┘
```

---

## Scaling notes

| Concern | Approach |
|---------|----------|
| Read traffic | RSC + Vercel ISR for analytics pages; revalidate on mutation |
| Heavy reports | Pre-aggregate via Postgres materialized views, refresh nightly |
| Realtime fan-out | Per-channel subscription; never broadcast tenant-wide payloads |
| File uploads | Supabase Storage, signed URLs, scoped buckets per client |
| Job-code contention | Postgres advisory lock per (brand, client, month) |
| Multi-tenancy (future) | Tenant column on every table + RLS by tenant; add when 2nd agency onboards |
| Background jobs | Supabase scheduled functions for nightly rollups; n8n for external |

---

## What we are explicitly NOT building (yet)

- A timesheet enforcement product. Time logging is opt-in for profitability, not for micromanagement.
- A CRM. Client master is a thin lookup, not a sales pipeline.
- A client-facing portal. v1 is internal only. Clients can be invited later behind an `external_client` role.
- A fully custom invoice generator. v1 exports invoice-ready CSV/JSON for Tally / Zoho / Xero.
