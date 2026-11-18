select 'FN', p.oid::regprocedure::text, pg_get_functiondef(p.oid) from pg_proc p
 where p.proname in ('alliance_tax','answer_alliance_invite','create_alliance','leave_alliance','purge_chat','alliance_tax_preview') and p.pronamespace = 'public'::regnamespace;
select 'POL', policyname, cmd, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects';
select 'BUCKET', id, public from storage.buckets;
select 'CRON', jobname, schedule, command from cron.job where jobname in ('alliance-tax','purge-chat');
select 'COLS', column_name from information_schema.columns where table_name = 'alliances';
