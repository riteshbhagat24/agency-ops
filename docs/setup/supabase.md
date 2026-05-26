# Supabase setup

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note the project ref, anon key, and service role key
3. Set the database password somewhere secure

## 2. Configure auth

In Supabase Studio → **Authentication → Providers**:

1. Enable **Google**
2. In Google Cloud Console, create OAuth credentials:
   - Authorized JS origins: `http://localhost:3000`, `https://<your-vercel-app>.vercel.app`
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
3. Paste Client ID / Secret into Supabase
4. (Optional but recommended) **Authentication → URL Configuration**:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<your-app>.vercel.app/auth/callback`

## 3. Run migrations

Two options:

### A. Supabase CLI (recommended)

```bash
brew install supabase/tap/supabase   # or scoop on Windows
supabase login
supabase link --project-ref <ref>
supabase db push
```

This applies everything in `supabase/migrations/` in order.

### B. SQL Editor

Open `supabase/migrations/0001_init_schema.sql`, paste into Supabase SQL Editor, run.
Repeat for `0002_business_logic.sql` and `0003_rls.sql`.

## 4. Seed demo data

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

`DATABASE_URL` is the connection string from Project Settings → Database → Connection string (URI).

> The seed truncates demo rows but **does not** delete `auth.users`. Real signups via Google OAuth keep working.

## 5. Configure storage (optional)

For attachments:

1. Storage → New bucket → `ticket-attachments`, public: **No**
2. Policy: only authenticated users can read/write rows whose folder prefix matches a ticket they can access (RLS-style)

## 6. Configure scheduled functions (optional, for refresh)

Database → Functions → `refresh_profitability()` is already created. Schedule it nightly via Database → Cron:

```sql
select cron.schedule('refresh_profitability', '0 2 * * *', $$select refresh_profitability();$$);
```

## 7. First sign-in

The `handle_new_user` trigger creates a `users` row on first OAuth login. The very first user becomes `super_admin` automatically. Subsequent users default to `client_servicing` — promote them via the `users` table in Supabase Studio.

## Troubleshooting

| Symptom | Fix |
|---|---|
| 403 on every query | RLS denied. Confirm the signed-in user has a row in `public.users`. |
| Trigger didn't fire | Check `pg_trigger` in Studio. Re-run `0002_business_logic.sql`. |
| Job code conflicts | Concurrent inserts — confirm `pg_advisory_xact_lock` ran (see `audit_log`). |
| Auth redirect mismatch | Check site URL and redirect URLs in Supabase **and** Google Cloud Console. |
