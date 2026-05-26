# Notification Routing

Email + in-app notifications are wired to specific events. Every event writes both:
- A row in `notifications` (the bell icon in the topbar)
- A row in `notification_dispatch` (the email outbox)

The `/api/dispatch/run` cron drains the outbox every 5 minutes and sends emails **directly via SMTP** using nodemailer. No external service needed.

---

## Who gets what

| Event | In-app + email recipients |
|-------|---------------------------|
| **Task assigned** (assignee_id set or changed) | Assignee · Team Lead of task's department · All Accounts |
| **Approval requested** (any classification) | All Management · Team Lead of the assigned team |
| **Approval decided** (approved / rejected) | Account Manager · All Accounts (for billable classifications) |
| **Invoice draft created** (auto on approval) | All Accounts · Account Manager |
| **Invoice status change** (sent / paid / overdue / cancelled / written_off) | All Accounts · Account Manager |
| **Payment reminder** (cron — invoices due in 3 days or overdue) | Account Manager · All Accounts |

---

## Team leads (per department)

The `departments.lead_user_id` column designates the lead. Migration 0010 auto-fills these:

| Department | Default Lead |
|---|---|
| Client Servicing | Zeeshan Thakur (Client Success Head) |
| Operations | Ritesh Bhagat (Operations Head) |
| Creative | Karen Sequeira (Creative Head) |
| Tech | Roshan Surve (Tech Team Lead) |
| Accounts | Shweta Dhuri (Sr. Accounts Executive) |
| Management | Amey Asuti (Founder & CEO) |

To change a lead:
```sql
update departments
   set lead_user_id = (select id from public.users where email = 'newlead@futureadymedia.com')
 where name = 'Client Servicing';
```

---

## SMTP setup (one-time, ~5 minutes)

Pick whichever email provider your agency already uses. Add these to `.env` (local) and to your Vercel project env (production):

### Option A — Gmail / Google Workspace (most agencies)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@futureadymedia.com
SMTP_PASS=<App Password — 16 chars without spaces>
EMAIL_FROM="Agency Ops <notifications@futureadymedia.com>"
```

**Getting the App Password (required, not your normal Google password):**
1. Sign in to the Gmail/Workspace account you want to send from
2. Open https://myaccount.google.com/apppasswords (2FA must be on)
3. Pick **Other (custom name)** → name it "Agency Ops" → **Generate**
4. Copy the 16-character password (Google shows it without spaces)
5. Paste into `SMTP_PASS`

**Gmail rate limits:**
- Free Gmail: ~500 emails/day
- Google Workspace: ~2000 emails/day per account

For your scale (50-100 notifications/day across the team), Gmail is fine. If you grow past that, swap to a transactional email service (see Option C).

### Option B — Zoho Mail

```bash
SMTP_HOST=smtp.zoho.in        # use smtp.zoho.com for non-India accounts
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@futureadymedia.com
SMTP_PASS=<account password or app-specific password>
EMAIL_FROM="Agency Ops <notifications@futureadymedia.com>"
```

### Option C — Resend / SendGrid / Postmark (transactional, scales higher)

Resend example:
```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=<your Resend API key>
EMAIL_FROM="Agency Ops <noreply@futureadymedia.com>"
```

Free tier covers 3,000 emails/month. Sender domain must be verified in Resend's dashboard.

### Option D — Office 365

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@futureadymedia.com
SMTP_PASS=<account password>
EMAIL_FROM="Agency Ops <notifications@futureadymedia.com>"
```

---

## How emails are rendered

Each event has a template in `src/lib/email/templates.ts`. The template:
- Renders both **HTML** (mobile-friendly, works in Gmail/Outlook/Apple Mail) and **plain text** (fallback)
- Pulls event-specific fields from the dispatch row's `payload`
- Includes a CTA button that deep-links into the app (`task` → `/tickets/<id>`, `invoice_*` → `/invoices/<id>`)

You don't need to manage templates manually — they're code, version-controlled, and updated by editing `templates.ts`.

---

## Apply migration 0010

```sql
-- In Supabase SQL Editor:
-- 1. Paste supabase/migrations/0010_notification_fanout.sql
-- 2. Run
-- 3. Verify leads:
select d.name, u.full_name as lead, u.email
  from departments d left join users u on u.id = d.lead_user_id
  order by d.name;
```

Every department should have a lead email.

---

## Smoke test

After SMTP env is set and migration is applied:

### 1. Fire a notification

In the app, assign a task to yourself (Settings → Users → click a task, OR via SQL):
```sql
insert into tasks (ticket_id, title, status, assignee_id, department_id)
select t.id, 'Email test', 'pending',
       (select id from users where email = 'ritesh@futureadymedia.com'),
       (select id from departments where name = 'Operations')
  from tickets t limit 1;
```

### 2. Check the outbox

```sql
select id, user_id, type, subject, status, attempts, last_error, created_at
  from notification_dispatch
 where created_at > now() - interval '2 minutes'
 order by created_at desc;
```

You should see 2–3 rows, all with `status='pending'`.

### 3. Trigger the cron manually

In a terminal:
```bash
curl http://localhost:3000/api/dispatch/run \
  -H "Authorization: Bearer $DISPATCH_RUN_TOKEN"
```

Response:
```json
{ "ok": true, "data": { "processed": 3, "sent": 3, "failed": 0, "skipped": 0 } }
```

The recipients should receive the email within seconds.

### 4. Re-check the outbox

```sql
select status, attempts, sent_at from notification_dispatch
 where created_at > now() - interval '5 minutes';
```

All rows should now show `status='sent'` with a recent `sent_at`.

---

## Common SMTP errors

| Error | Cause | Fix |
|---|---|---|
| `Invalid login: 535-5.7.8 Username and Password not accepted` | Gmail password is the normal account password, not an App Password | Generate an App Password (see Option A) |
| `Self signed certificate` | Custom SMTP server with bad cert | Set `SMTP_SECURE=false` if not using SSL/465 |
| `connect ETIMEDOUT` | Firewall blocking port 587 | Confirm port 587 outbound is allowed. Locally try port 465 with `SMTP_SECURE=true`. |
| `Message has been blocked` (Gmail) | Sending too many in short window | Throttle — the dispatch cron sends at most 50/run; if you need more, use Resend (Option C). |
| `recipient inactive or missing` in `notification_dispatch.last_error` | User row deactivated or deleted | Expected — the row is marked sent and skipped silently. |

---

## On Vercel

When deploying:
1. Add all SMTP_* env vars + `EMAIL_FROM` + `DISPATCH_RUN_TOKEN` to Vercel → Project → Settings → Environment Variables (Production + Preview)
2. The cron schedule in `vercel.json` already fires `/api/dispatch/run` every 5 minutes — no manual setup needed
3. Vercel free plan = 1 cron · Pro plan = 40 crons. We use 2 (`dispatch/run` + `cron/payment-reminders`)

---

## What if a teammate complains "too many emails"?

Quickest fix: filter in Gmail. The subject line always starts with `[Agency Ops]` and the `From` is consistent.

Future: a `user_notification_prefs` table with mute toggles per event type. Open a follow-up when someone asks.

---

## Suppressing emails locally during development

Just leave SMTP env vars empty. The dispatch route will return `503 smtp_not_configured` and the dispatch rows will stay pending. The in-app bell will still light up correctly.

Or set up a local test SMTP server like **MailHog** or **Mailpit**:
```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
# Then in .env:
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=anything
SMTP_PASS=anything
```

Open `http://localhost:8025` to see captured emails without actually sending them.
