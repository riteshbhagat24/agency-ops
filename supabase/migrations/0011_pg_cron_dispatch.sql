-- ============================================================================
-- 0011_pg_cron_dispatch.sql
--
-- Vercel Hobby caps cron at daily. Run the 5-minute email dispatch from
-- Supabase's built-in pg_cron + pg_net instead. The daily payment reminder
-- cron stays on Vercel since it only fires once a day.
--
-- One-time prerequisites:
--   1. Enable pg_cron extension:
--      Supabase Studio → Database → Extensions → search "pg_cron" → toggle ON
--   2. Enable pg_net extension (same path, search "pg_net")
--   3. Edit the two ALTER DATABASE lines below with YOUR values BEFORE running
-- ============================================================================

-- Enable extensions (idempotent — these are no-ops if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- Schedule the dispatch ping every 5 minutes.
-- pg_net is non-blocking: returns immediately, response handled async.
--
-- The URL + token are inlined into the schedule SQL because Supabase
-- doesn't let regular users ALTER DATABASE to set GUCs.
-- If you ever need to rotate the token, drop and re-create the schedule.
-- ----------------------------------------------------------------------------

-- Remove any prior schedule (idempotent re-run)
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'agency_ops_dispatch';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end$$;

select cron.schedule(
  'agency_ops_dispatch',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://agency-ops.vercel.app/api/dispatch/run',
    headers := jsonb_build_object(
      'Authorization', 'Bearer b71bfbfeb9dc01f3d831a33626129986d80fc7da82af2a21220459ad0508ad5e',
      'Content-Type',  'application/json'
    )
  );
  $cron$
);

-- ----------------------------------------------------------------------------
-- Verify the schedule is active
-- ----------------------------------------------------------------------------
-- select jobid, jobname, schedule, active, last_run_status, last_run_ended_at
--   from cron.job
--   where jobname = 'agency_ops_dispatch';

-- See recent runs:
-- select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'agency_ops_dispatch')
--   order by start_time desc limit 10;

-- See pg_net HTTP responses:
-- select * from net._http_response order by created desc limit 10;
