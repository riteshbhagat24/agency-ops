-- ============================================================================
-- 0012_client_type_and_gst.sql
--
-- 1. client_type enum: 'project' | 'retainer' on clients table
-- 2. GST is India-only. tax_rate defaults to 18 for IN, 0 for others.
--    The label "GST" is always used (not VAT/Tax) but the field is
--    disabled for non-India clients in the UI.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'client_type') then
    create type client_type as enum ('project', 'retainer');
  end if;
end$$;

alter table clients
  add column if not exists client_type client_type not null default 'retainer';
