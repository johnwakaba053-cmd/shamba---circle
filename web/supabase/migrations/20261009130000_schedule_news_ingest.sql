-- News: run the Agriculture Today importer every minute.
--
-- Vercel's Hobby plan allows a cron job at most once a day, so the
-- schedule lives in Supabase: pg_cron fires every minute and pg_net POSTs
-- to the production importer, /api/internal/ingest-news, in auto mode
-- (import new stories, publish the clear-cut ones, keep the rest as
-- drafts). The importer sends each feed's ETag / Last-Modified, so an
-- unchanged feed costs the publisher a bodiless 304.
--
-- The importer's secret is never written here: it is read at call time
-- from Supabase Vault ('news_ingest_secret', the production
-- INGEST_SECRET), which an owner adds in the dashboard:
--   select vault.create_secret('<production INGEST_SECRET>', 'news_ingest_secret');
-- Until that secret exists the job does nothing.
--
-- To stop it:  select cron.unschedule('agriculture-today-ingest');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'agriculture-today-ingest',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://shamba-circle.vercel.app/api/internal/ingest-news',
      body := '{"autoPublish": true, "trigger": "cron"}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-ingest-secret', s.decrypted_secret
      ),
      timeout_milliseconds := 60000
    )
    from vault.decrypted_secrets s
    where s.name = 'news_ingest_secret';
  $job$
);
