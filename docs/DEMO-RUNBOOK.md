# Management Demo Runbook

A 20-minute walkthrough that hits every value prop of the system. Run through this once before showing it to anyone senior.

---

## Prep (one-time, ~5 min before)

### 1. Apply migrations + production seed
Make sure these have been run in Supabase SQL Editor, in order:

```
supabase/migrations/0001_init_schema.sql
supabase/migrations/0002_business_logic.sql
supabase/migrations/0003_rls.sql
supabase/migrations/0004_production_changes.sql
supabase/migrations/0005_client_code_autogen.sql
supabase/migrations/0006_invoice_on_approval.sql
supabase/migrations/0007_invoice_timing_and_fixes.sql
supabase/migrations/0008_fix_self_update_in_triggers.sql

supabase/seed_production.sql            -- real clients + team
supabase/demo_overlay.sql               -- demo activity for charts (REMOVES after demo)
```

> Re-run `supabase/repair_routes.sql` and `supabase/repair_stuck_approvals.sql` if any old test tickets are stuck.

### 2. Confirm data looks right
In SQL Editor:
```sql
select count(*) as users from users where is_active and deleted_at is null;     -- 13
select count(*) as clients from clients where deleted_at is null;               -- 9
select count(*) as billables_this_month from billables
  where billing_period = to_char(now(),'YYYY-MM');                              -- 5–15
select count(*) as time_logs_last_7 from time_logs
  where work_date >= current_date - 7;                                          -- 30–60
select count(*) as pending_approvals from tickets
  where approval_stage = 'pending_management' and deleted_at is null;           -- 4
```

### 3. Boot the app
```powershell
cd d:\Claude\billable_task_system
pnpm dev
```
Open `http://localhost:3000` and sign in. Confirm sidebar shows **Users** (you're super_admin).

---

## The walkthrough (~20 min)

### Opening line (30 sec)
> "Agency Ops is a commercial operations system, not a task manager. The product idea is simple: every request is classified commercially before anyone touches it, so quick edits stop being free work and revenue stops leaking."

### Slide 1 — Dashboard (3 min)

Open `/dashboard`.

**Point at the 4 KPIs (top row).** Talk to:
- **MRR ₹6L** — sum of active retainers across our 9 clients
- **Extra billables this month** — work we did beyond scope, with the MoM delta
- **Pending billing** — approved but not yet invoiced; money on the floor
- **Goodwill** — free work tracked at our internal rate card so management sees the cost of being nice

**Revenue per client chart.** "Each bar is one client. Blue = retainer baseline. Orange = extras this month. The orange tells you who is paying for our growth and who is taking advantage."

**Scope leakage trend.** "Six-month line of goodwill and unbilled out-of-scope work. The goal here is to make this line *visible*. We can argue about reducing it later — first we need to see it."

**Team utilization.** "Hours logged divided by capacity per team, last 7 days. Red bar = burnout risk. Green bar = bandwidth available for new clients."

**Awaiting management approval.** "This is your inbox. Each row is a billable that can't proceed until you approve it. Click Review on any of these."

### Slide 2 — End-to-end ticket flow (5 min)

This is the killer demo. **Create a brand-new ticket live**.

1. Click **New ticket** (top right of dashboard)
2. Pick client **TATA AIG** (or any active one)
3. Title: `Reshoot anchor video for festive push`
4. Request type: `video`, Priority: `High`
5. Estimated hours: `8`, Estimated amount: `₹25000`
6. Deadline: 5 days from now
7. Description: "Client wants a re-shoot of the anchor for the Diwali campaign"
8. **Pick classification: Extra Billable**
9. Click **Create ticket**

> "Watch what just happened. The system saw 'extra billable' — it didn't just save a row. It generated a job code, kicked off the management approval flow, and **drafted an invoice** while we were typing. Finance can already see the commercial impact."

Open the new ticket. Show:
- Job code (`OV-TATAAIG-MMYY-V0n`) auto-generated
- Status: Waiting Approval · Pending Management
- Approval timeline already has the requested entry

Click **Review (management)** → Approve → click "Approve & request client". Show that:
- Approval timeline now has the approved row
- Approval stage moves to Pending Client

Click **Record client decision** → enter `client:rahul@tata.com` → "Approved on WhatsApp 14:30 — proceeding" → **Mark approved**.

> "Now the ticket is fully approved, the job code is locked in, and the invoice transitions out of draft. Watch."

### Slide 3 — Invoice (3 min)

Sidebar → **Invoices**. Click into the freshly-created invoice (or the FRM-2026-0001 from earlier).

Show:
- Invoice number `FRM-2026-0001` — auto-numbered atomically per brand per year
- Bill to: billing-name from client master
- GSTIN if it's an India client
- Subtotal ₹25000 → GST @ 18% = ₹4500 → Total ₹29500
- Due date: 30 days out (from client's `payment_terms_days`)

Click **Edit** → change tax rate or add a note → save. Watch totals recompute.

Click **Add line item** → "Shoot day surcharge" / ₹5000 → save. Watch the invoice grow.

Click **Download / Print** → opens print view in a new tab → "This is the PDF clients see. Ctrl+P → save as PDF, attach to the email."

Back on the detail page → **Mark as sent** → status changes. **Mark as paid** → status changes, the underlying billable flips to `billed` automatically.

> "One invoice per (client, period). Every extra request gets a line item under the same monthly invoice. Clients don't get 8 emails."

### Slide 4 — Billing leakage protection (2 min)

Sidebar → **Tickets**. Set the classification filter to **Goodwill** or **Out of Scope**.

> "Every free favour is a row in this table. Right now we have N rupees of goodwill this month. Last quarter, we didn't know. Now we do."

Show the **Scope leakage trend** chart on dashboard. "Same data, charted over time."

### Slide 5 — Clients (2 min)

Sidebar → **Clients**. Filter by **Profitability: Bleeding**.

> "This is where your account managers find out which clients are draining margin. Click Balu — Pranali's account."

Open `/clients/<balu>`:
- Profitability chip = Bleeding
- KPI cards: retainer, extra billables, goodwill, open tickets
- AM picker — change AM live (auto-reassigns the assignee record)
- Tickets tab — every request this client has ever made
- Commercial tab — retainer, currency, tax_rate, payment_terms_days, allowed_revisions

Click **Delete** → confirm dialog requires typing the client code. Cancel — just showing it exists.

### Slide 6 — Users / RBAC (2 min)

Sidebar → **Users** (super_admin only).

> "Thirteen seats. Every role has explicit permissions — `client_servicing` can't see Bleeding profitability on other people's clients; `accounts` can't approve billables; only `super_admin` can manage users. The DB enforces this with Row-Level Security so even a malicious client-side change can't break it."

Show:
- Inline role editor (click any role badge → dropdown)
- Activate/Deactivate toggle
- **Add user** dialog → "If a new AM joins, pre-create their row. When they sign in with Google, OAuth links to it."
- Click any user's "N assigned" → client assignments dialog

### Slide 7 — Workflow automation (1 min)

> "Two things run in the background:"
- **Email/notification dispatch** (every 5 min) — when a task is assigned, the assignee gets an email via n8n. When an invoice is due in 3 days, the AM gets a payment-reminder email.
- **Daily cron** at 9am queues payment reminders for invoices due in the next 3 days.

Show: open `/api/dispatch/run` (paste the bearer token URL) → shows the JSON `{ok:true, data:{processed:N, sent:N, failed:0}}`. "n8n handles the actual SMTP — we just queue."

### Closing (30 sec)

> "Three things to take away. **One** — every request is now traceable from intake to invoice. **Two** — the math is enforced at the database, not at the application, so no engineer can accidentally undo a billable. **Three** — leadership sees scope leakage as a number, not a feeling, and can put a target on reducing it."

---

## After the demo

### Remove the demo overlay
The dashboards looked rich because `demo_overlay.sql` planted 30+ fake tickets and 60+ time logs. To wipe them:

```sql
begin;
delete from time_logs where task_id in (select id from tasks where (metadata->>'demo')::boolean is true);
delete from tasks      where (metadata->>'demo')::boolean is true;
delete from billables  where ticket_id in (select id from tickets where (metadata->>'demo')::boolean is true);
delete from approvals  where ticket_id in (select id from tickets where (metadata->>'demo')::boolean is true);
delete from tickets    where (metadata->>'demo')::boolean is true;
commit;
```

Your real client + team master is untouched.

### Common Q&A during the demo

| Q | A |
|---|---|
| "Can clients log in?" | Not in v1 — internal only. We can add a client portal in Phase 2. |
| "Where is data hosted?" | Supabase (Mumbai region for low latency). Daily backups. |
| "What if a teammate leaves?" | Deactivate in `/settings/users` — they can't sign in, but their audit history stays. Reassign their clients via the AM picker. |
| "Can we change GST rates?" | Per client. India defaults to 18%. UAE = 5%, UK = 20% etc. Per-invoice override too. |
| "Mobile?" | Works on phones (responsive web). PWA-installable. Native app deferred. |
| "Cost to run?" | Supabase Pro $25/mo + Vercel Pro $20/mo + Upstash + n8n self-hosted = ~₹5–8k/mo total at our scale. |

---

## Critical pre-demo checks (run 30 min before)

- [ ] `pnpm dev` boots, `http://localhost:3000` loads
- [ ] Sign in works
- [ ] Dashboard shows non-zero numbers
- [ ] Charts are populated (after demo_overlay)
- [ ] Approvals inbox has 3–4 items
- [ ] Clicking a ticket shows the approval timeline
- [ ] `/invoices` shows at least 5 invoices
- [ ] One invoice's `/print` view renders correctly
- [ ] No red console errors on the dashboard

If any check fails, paste the error and we debug in <5 min.
