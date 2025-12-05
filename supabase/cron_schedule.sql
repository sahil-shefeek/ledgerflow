-- Enable the pg_cron extension if not already enabled
create extension if not exists pg_cron;

-- Enable the pg_net extension if not already enabled (required for making HTTP requests)
create extension if not exists pg_net;

-- Schedule the Edge Function to run every day at midnight (UTC)
-- REPLACE 'YOUR_SERVICE_ROLE_KEY' with your actual Service Role Key from Project Settings > API
select cron.schedule(
  'process-recurring-transactions', -- Name of the cron job
  '0 0 * * *',                      -- Cron schedule (Every day at 00:00 UTC)
  $$
  select
    net.http_post(
        url:='https://qfoalcsdorwfogayfcdn.supabase.co/functions/v1/process-recurring',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb2FsY3Nkb3J3Zm9nYXlmY2RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTQzMjksImV4cCI6MjA3OTk5MDMyOX0.123luyhXoQlFl2PYaS5gV4FJEsYdRxI0l276ceYqbH0"}'::jsonb
    ) as request_id;
  $$
);

-- To verify the job is scheduled:
-- select * from cron.job;

-- To unschedule/delete the job later:
-- select cron.unschedule('process-recurring-transactions');
