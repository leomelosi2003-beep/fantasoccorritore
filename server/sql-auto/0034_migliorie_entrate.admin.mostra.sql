select 'LEDGER', created_at, amount, reason from org_ledger where org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' and reason like 'Miglior%' order by created_at desc limit 12;
select 'CRON', j.jobname, d.status, d.start_time, left(coalesce(d.return_message,''),120) from cron.job_run_details d join cron.job j on j.jobid = d.jobid
 where j.jobname in ('base-perks','base-rent') order by d.start_time desc limit 8;
select 'INC', b.name, base_income_h(b.id), base_rest_factor(b.id), base_wear_factor(b.id), base_reward_bonus(b.id) from bases b
 where b.org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' and exists (select 1 from base_perks p where p.base_id = b.id);
