-- =====================================================
-- RELAY FALLBACK CRON - Automated seed when Relay never returns
-- =====================================================
-- Runs every 10 minutes via pg_cron. Calls relay-fallback-cron Edge Function
-- to create seed stores for orgs where Relay was triggered but never called back.
--
-- Prerequisites: Add to Supabase Vault (Dashboard > Database > Vault):
--   vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--   vault.create_secret('YOUR_ANON_KEY', 'anon_key');
-- (If you already have these for notification emails, you're good.)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule if already exists (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('relay-fallback-seed');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job didn't exist
END $$;

-- Schedule: every 10 minutes
-- Uses vault project_url + anon_key if present; otherwise defaults for this project
SELECT cron.schedule(
  'relay-fallback-seed',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1),
      'https://kgzhlvxzdlexsrozbbxs.supabase.co'
    ) || '/functions/v1/relay-fallback-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1), '')
    ),
    body := '{"minutesAgo": 10}'::jsonb
  ) AS request_id;
  $$
);
