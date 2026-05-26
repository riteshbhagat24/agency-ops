# Deployment

## Vercel

### One-time setup

1. Push the repo to GitHub
2. In Vercel → Add New Project → Import the repo
3. **Framework:** Next.js (auto-detected)
4. **Build command:** default (`next build`)
5. **Output directory:** default

### Environment variables

Add these in Vercel → Project → Settings → Environment Variables (Production + Preview):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase API settings (server only) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `Agency Ops` |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` | `futuready.com,orangevideos.com` |
| `INTAKE_WEBHOOK_TOKEN` | strong random secret (use `openssl rand -hex 32`) |
| `APPROVAL_CALLBACK_TOKEN` | strong random secret |

> **Never** put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` — that ships it to the browser.

### Domain & cookies

If you use a custom domain:
1. Point CNAME to `cname.vercel-dns.com`
2. In Supabase → Authentication → URL Configuration, add the new domain to **Site URL** and **Redirect URLs**
3. In Google Cloud → OAuth credentials, add the new domain to **Authorized JS origins**

## n8n / Automation

Two webhook endpoints are exposed:

### Intake

```
POST https://<your-app>.vercel.app/api/webhooks/intake
Authorization: Bearer <INTAKE_WEBHOOK_TOKEN>
Content-Type: application/json

{
  "client_code": "TATA",
  "title": "3 extra reels for Q2 push",
  "description": "...",
  "request_type": "reel",
  "priority": "high",
  "deadline": "2026-05-24T18:30:00Z",
  "requested_by_email": "priya@futuready.com",
  "metadata": { "source": "typeform" }
}
```

### Approval callback

```
POST https://<your-app>.vercel.app/api/webhooks/approval-callback
Authorization: Bearer <APPROVAL_CALLBACK_TOKEN>

{
  "ticket_id": "uuid",
  "decision": "approved",
  "actor_label": "client:rahul@tata.com",
  "comment": "Approved on WhatsApp",
  "attachment_url": "https://..."
}
```

## Production checklist

- [ ] Supabase migrations applied
- [ ] RLS policies enabled (`alter table … enable row level security`)
- [ ] Seed run (or initial clients created via UI)
- [ ] Google OAuth working end-to-end
- [ ] At least one `super_admin` user
- [ ] Webhook tokens set and rotated quarterly
- [ ] Domain restriction enforced via `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS`
- [ ] Storage bucket policies match RLS
- [ ] Nightly `refresh_profitability()` cron scheduled
- [ ] Vercel deployment protection enabled (password / SSO for previews)
- [ ] Sentry / Logflare / Logtail wired in (optional)

## Scaling notes

| If | Then |
|---|---|
| You hit 100+ clients | Add `tenant_id` to every table, migrate RLS to scope by tenant, multi-org friendly |
| Reports slow down | Refresh `mv_client_profitability` hourly, cache analytics pages with ISR |
| Approvals fan-out is heavy | Move notifications to a Supabase Edge Function that fans out to Slack/Email via n8n |
| Attachments get large | Move storage to a CDN-backed bucket or external (S3 + CloudFront) |
| Real-time noisy | Subscribe per-route rather than globally; debounce mutations |
| Multi-region | Supabase + Vercel both offer edge regions — pick the same primary region (e.g. `ap-south-1`) for low p99 |
