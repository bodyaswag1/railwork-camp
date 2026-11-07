-- Run the nightly job (weekly loops 4 weeks ahead, badges) at 02:15 UTC with pg_cron.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'bas-nightly';
select cron.schedule('bas-nightly', '15 2 * * *', $$select public.nightly()$$);
