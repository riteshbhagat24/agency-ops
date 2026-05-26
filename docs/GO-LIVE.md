# Production Go-Live Checklist

This is the end-to-end procedure to take Agency Ops from a working local dev setup to a live production instance for Futuready Media + Orange Videos.

---

## Pre-flight

- [ ] All migrations 0001–0004 applied
- [ ] Production seed `supabase/seed_production.sql` reviewed (emails match real team)
- [ ] Real Google OAuth credentials created
- [ ] Domain `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=futureadymedia.com,orangevideos.in`
- [ ] n8n workflow set up to handle dispatch webhook (see below)

---

## Step 1 — Apply migration 0004 to your Supabase project

In Supabase SQL Editor, run these in order:

1. `supabase/migrations/0004_production_changes.sql`

This adds:
- Brand code `FRM` (Futuready Media) as the canonical brand
- Per-client country, currency, tax_rate, GSTIN, billing details, payment terms
- The `invoices` table with auto-numbering (FRM-2026-0001, OV-2026-0001)
- An auto-invoice trigger on `billables` inserts
- The `notification_dispatch` outbox table
- Trigger that queues assignee notifications on task assignment
- `queue_payment_reminders(p_days_ahead)` function for due-date reminders

## Step 2 — Wipe demo data, install production seed

In SQL Editor:

```sql
\i supabase/seed_production.sql
```

Or paste the contents of `supabase/seed_production.sql` directly. This:
- Truncates every demo table
- Deletes seeded `@futuready.com` / `@orangevideos.com` auth users
- Inserts 6 departments
- Creates real auth + public.users rows for the 13 team members from your sheet
- Inserts 9 clients (Bhilosa, Balu, Neelkamal, HCL, ETG, BAC, TATA AIG, Hiranandani, Vodafone)
- Auto-assigns AMs and adds the Client Success Head + Lead as oversight assignees on every client

> Your real Google-signed-in accounts are NOT touched (they don't end in `@futuready.com`).

## Step 3 — Verify the team can sign in

Each teammate signs in once at `http://localhost:3000` (or your prod URL) using Google. The system links their OAuth identity to the pre-seeded `auth.users` row by email match.

Run this query after a few teammates have signed in:

```sql
select u.email, u.full_name, u.role, u.designation, u.last_sign_in_at
  from public.users u
  join auth.users au on au.id = u.id
 where u.deleted_at is null
 order by au.last_sign_in_at desc nulls last;
```

If anyone shows up as `client_servicing` who should be different, manually update:

```sql
update public.users set role = 'management' where email = 'wrong@futureadymedia.com';
```

Or simply use the **Users** admin panel at `/settings/users` (super_admin only).

---

## Step 4 — Set up Vercel

### Environment variables (all environments)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ufzbdxnkxxbyizdeluxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:<password>@db.ufzbdxnkxxbyizdeluxx.supabase.co:5432/postgres

NEXT_PUBLIC_APP_URL=https://agencyops.futureadymedia.com  # your actual domain
NEXT_PUBLIC_APP_NAME=Agency Ops
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=futureadymedia.com,orangevideos.in

INTAKE_WEBHOOK_TOKEN=<rotate from local>
APPROVAL_CALLBACK_TOKEN=<rotate from local>
DISPATCH_RUN_TOKEN=<new strong random>

N8N_WEBHOOK_URL=https://your-n8n.example.com/webhook/agency-ops-dispatch
```

Generate `DISPATCH_RUN_TOKEN`:

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

### Update OAuth redirect URLs

In Google Cloud → APIs & Services → Credentials → your OAuth client:
- Authorized JS origins: add `https://agencyops.futureadymedia.com`
- Authorized redirect URIs: keep `https://ufzbdxnkxxbyizdeluxx.supabase.co/auth/v1/callback`

In Supabase → Authentication → URL Configuration:
- Site URL: `https://agencyops.futureadymedia.com`
- Redirect URLs: add `https://agencyops.futureadymedia.com/auth/callback`

### Vercel Cron is auto-configured

`vercel.json` declares two crons:
- `*/5 * * * *` → `/api/dispatch/run` (drains email queue every 5 min)
- `0 9 * * *` → `/api/cron/payment-reminders?days=3` (daily 9am AM reminders)

Vercel reads this at deploy time. No manual config needed once deployed.

---

## Step 5 — Configure n8n for email delivery

The system writes to `notification_dispatch` and the cron POSTs each pending row to `N8N_WEBHOOK_URL`. Build an n8n workflow:

### Trigger
- **Webhook** node, POST method, path `/agency-ops-dispatch`

### Payload your workflow receives

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "channel": "email",
  "type": "task_assigned" | "payment_reminder",
  "subject": "[Agency Ops] …",
  "body": "Plain-text body",
  "payload": {
    "task_id": "…",
    "ticket_id": "…",
    "client_name": "…",
    "assignee_email": "priya@futureadymedia.com",
    "assignee_name": "Priya",
    "due_date": "2026-06-01T…",
    "invoice_id": "…",
    "invoice_number": "FRM-2026-0042",
    "amount": 9500,
    "currency": "INR",
    "am_email": "ashmita@futureadymedia.com"
  }
}
```

### Recommended n8n flow

1. **Webhook** trigger
2. **Switch** node on `{{$json.type}}`:
   - `task_assigned` → SMTP/Gmail node, To = `{{$json.payload.assignee_email}}`
   - `payment_reminder` → SMTP/Gmail node, To = `{{$json.payload.am_email}}`
3. **HTTP Request** node back to Supabase to mark `notification_dispatch.status = 'sent'` (optional — the cron already does this on 2xx response)
4. Return `{"ok": true}` from the Webhook response node

> **IMPORTANT:** the webhook must respond `2xx` for `dispatch/run` to mark the row sent. Anything else (or a timeout) marks it `failed` after 5 retries.

### Email templates (suggested)

**Task assigned:**
```
Hi {{ payload.assignee_name }},

A new task has been assigned to you:

  {{ subject.replace('[Agency Ops] ', '') }}

Client:  {{ payload.client_name }}
Ticket:  #{{ payload.ticket_number }}
Due:     {{ payload.due_date | date('DD MMM YYYY HH:mm') }}

Open it in Agency Ops:
https://agencyops.futureadymedia.com/tickets/{{ payload.ticket_id }}
```

**Payment reminder:**
```
Hi {{ payload.am_name }},

Heads up — invoice {{ payload.invoice_number }} for {{ payload.client_name }}
is due on {{ payload.due_at | date('DD MMM YYYY') }}.

Amount: {{ payload.currency }} {{ payload.amount }}

Please follow up with the client.

View invoice:
https://agencyops.futureadymedia.com/invoices/{{ payload.invoice_id }}
```

---

## Step 6 — Smoke-test the live system

After deploy:

1. **Sign-in flow:** sign in with each role's account, confirm the right sidebar items appear
2. **Create a ticket** → classify it Extra Billable → check that an approval row exists
3. **Approve as management** → confirm the job code generates
4. **Mark as delivered** → confirm a billable row appears AND a draft invoice is auto-created
5. **Open the invoice** → confirm GST is computed at 18%, totals are correct, due date is `created_at + 30 days`
6. **Assign a task to someone** → confirm a `notification_dispatch` row appears with `status='pending'`
7. **Hit `/api/dispatch/run` manually** with `Authorization: Bearer <DISPATCH_RUN_TOKEN>` → confirm n8n received the webhook and email arrived
8. **Run `/api/cron/payment-reminders?days=30`** → should queue reminders for any invoice due in the next 30 days

---

## Step 7 — Operational baseline

### Backups

Supabase Pro plan automatically backs up daily. Verify:
- Project Settings → Database → Backups
- Confirm daily backup is enabled
- Note retention period (7 days on Pro)

### Monitoring

- Vercel Analytics — turn on
- Supabase Logs → API → set up an alert for 5xx > 1% rate
- Optional: Sentry (`@sentry/nextjs`) for client + server error tracking

### Rate limits

The webhooks already have token auth. Add Upstash Redis rate-limiting if you start getting hit:
- Create a free Upstash Redis DB
- Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- Wrap webhook routes with `@upstash/ratelimit`

### Secrets rotation

Quarterly:
- Rotate `INTAKE_WEBHOOK_TOKEN`, `APPROVAL_CALLBACK_TOKEN`, `DISPATCH_RUN_TOKEN`
- Update them in Vercel env + n8n
- Rotate Supabase service-role key from Project Settings → JWT Keys (will require updating `SUPABASE_SERVICE_ROLE_KEY` everywhere)

### When a new teammate joins

Option A — Self-service: they sign in with Google. They land as `client_servicing`. A super_admin promotes them in `/settings/users`.

Option B — Pre-create: super_admin clicks **Add user** in `/settings/users`, enters their email and role. When they sign in via Google, their identity links automatically.

### When a teammate leaves

In `/settings/users`, click **Deactivate**. The user stays in the database (for audit history) but:
- Cannot log in (RLS policies check `is_active`)
- Doesn't appear in AM/assignee dropdowns
- Their assigned clients need to be reassigned (use the AM picker on each client)

---

## Step 8 — Custom domain

1. Vercel → Project → Settings → Domains → Add `agencyops.futureadymedia.com`
2. Configure CNAME at your DNS provider → `cname.vercel-dns.com`
3. Wait for DNS propagation (~5–60 min)
4. Update OAuth redirect URLs in Google + Supabase (see Step 4)
5. Update `NEXT_PUBLIC_APP_URL` env var to the new domain
6. Redeploy

---

## What's intentionally not in v1

- In-app PDF generation for invoices (export as JSON for now; Tally/Zoho consume CSV)
- Client portal (clients can't log in — only internal staff)
- Mobile app (PWA-installable via the existing site)
- Multi-currency conversion (invoices stay in client's home currency)
- File uploads beyond URL references (Supabase Storage bucket setup deferred)

These are all "Phase 2" items — call them out when the team asks.

---

## Troubleshooting common production issues

| Symptom | Cause | Fix |
|---|---|---|
| User can't sign in despite right domain | Trigger didn't create `public.users` row | Run `select handle_new_user();` or have super_admin invite from `/settings/users` |
| Invoice not auto-created when ticket delivered | `billables_auto_invoice` trigger missing | Re-run migration 0004 |
| GST applied at wrong rate | `clients.tax_rate` not set on that client | Update the client's tax_rate (Settings → Clients → edit) |
| Tasks page slow | Missing indexes on `assignee_id` after restore | `create index … on tasks(assignee_id, status)` |
| `notification_dispatch` rows pile up at `status=pending` | n8n webhook is down or returning non-2xx | Check n8n is reachable from Vercel; verify `N8N_WEBHOOK_URL` |
| Payment reminders fire twice | Cron ran twice (race) | Idempotency check inside `queue_payment_reminders` already prevents this — confirm Vercel Cron schedule is single-cron |
