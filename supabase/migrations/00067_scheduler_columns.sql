-- Migration: 00067_scheduler_columns
-- Adds scheduler state to tenant_installed_apps and sets up the pg_cron dispatcher.

-- ---------------------------------------------------------------------------
-- 1. New columns on tenant_installed_apps
-- ---------------------------------------------------------------------------

ALTER TABLE tenant_installed_apps
  ADD COLUMN IF NOT EXISTS next_run_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS schedule_timezone TEXT NOT NULL DEFAULT 'UTC';

-- ---------------------------------------------------------------------------
-- 2. Add triggered_by to integration_job_runs (manual | scheduler)
-- ---------------------------------------------------------------------------

ALTER TABLE integration_job_runs
  ADD COLUMN IF NOT EXISTS triggered_by TEXT NOT NULL DEFAULT 'manual';

-- ---------------------------------------------------------------------------
-- 3. pg_cron dispatcher — fires every minute, calls PulseBox dispatcher API
--
-- Before enabling, set these two database config vars (run once in SQL editor):
--   ALTER DATABASE postgres SET app.dispatcher_url    = 'https://<railway-url>/api/automata/dispatch';
--   ALTER DATABASE postgres SET app.dispatcher_secret = '<your-DISPATCHER_SECRET-value>';
--
-- Both pg_cron and pg_net must be enabled in your Supabase project.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- Remove any existing job with the same name before (re-)creating
  PERFORM cron.unschedule('automata-dispatcher')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'automata-dispatcher'
  );

  PERFORM cron.schedule(
    'automata-dispatcher',
    '* * * * *',
    $job$
      SELECT
        CASE
          WHEN current_setting('app.dispatcher_url', true) IS NOT NULL
          THEN net.http_post(
            url     := current_setting('app.dispatcher_url', true),
            body    := '{}'::jsonb,
            headers := json_build_object(
              'Content-Type', 'application/json',
              'X-Dispatcher-Secret',
              COALESCE(current_setting('app.dispatcher_secret', true), '')
            )::jsonb
          )
        END;
    $job$
  );

EXCEPTION WHEN OTHERS THEN
  -- pg_cron or pg_net not yet enabled — skip silently.
  -- Enable them in Supabase Dashboard → Database → Extensions, then re-run this migration.
  RAISE NOTICE 'pg_cron setup skipped: %', SQLERRM;
END;
$$;
