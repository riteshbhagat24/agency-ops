-- ============================================================================
-- 0009_client_agreements.sql
--
-- Adds support for uploading signed client agreements / SOWs.
--
--   clients.agreement_path     — storage path inside the 'client-agreements'
--                                bucket (e.g. 'agreements/<uuid>.pdf')
--   clients.agreement_filename — original filename for display + download
--   clients.agreement_size     — file size in bytes (for UI)
--   clients.agreement_uploaded_at
--
-- The 'client-agreements' bucket is created via Supabase Studio (or the SQL
-- snippet at the bottom) with private access. Files are served via signed
-- URLs created server-side.
-- ============================================================================

alter table clients
  add column if not exists agreement_path        text,
  add column if not exists agreement_filename    text,
  add column if not exists agreement_size        bigint,
  add column if not exists agreement_uploaded_at timestamptz;

-- ----------------------------------------------------------------------------
-- Storage bucket + policies
--
-- Tries to create the bucket via the storage schema. If your project's
-- storage extension already restricts this, run it from Supabase Studio:
--   Storage → New bucket → name: client-agreements, public: OFF
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('client-agreements', 'client-agreements', false)
on conflict (id) do nothing;

-- Drop existing policies (idempotent re-run)
drop policy if exists "agreements_select" on storage.objects;
drop policy if exists "agreements_insert" on storage.objects;
drop policy if exists "agreements_update" on storage.objects;
drop policy if exists "agreements_delete" on storage.objects;

-- Read: any signed-in user with access to clients can read
-- (Signed URLs are issued server-side, so this RLS is mostly a defense-in-depth
-- in case the bucket gets mistakenly made public)
create policy "agreements_select"
  on storage.objects for select
  using (
    bucket_id = 'client-agreements'
    and auth.role() = 'authenticated'
  );

-- Write/Update/Delete: super_admin and management only
create policy "agreements_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'client-agreements'
    and exists (
      select 1 from public.users
      where id = auth.uid()
        and role in ('super_admin', 'management')
        and is_active = true
        and deleted_at is null
    )
  );

create policy "agreements_update"
  on storage.objects for update
  using (
    bucket_id = 'client-agreements'
    and exists (
      select 1 from public.users
      where id = auth.uid()
        and role in ('super_admin', 'management')
    )
  );

create policy "agreements_delete"
  on storage.objects for delete
  using (
    bucket_id = 'client-agreements'
    and exists (
      select 1 from public.users
      where id = auth.uid()
        and role in ('super_admin', 'management')
    )
  );
