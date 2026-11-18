select 'SNAP', day, value from org_snapshots where org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' and day > current_date - 10 order by day;
select 'ADJ', coalesce(sum(amount), 0), count(*) from org_adjustments where org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06';
select 'ADJ7', created_at::date, amount from org_adjustments where org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' order by created_at desc limit 5;
select 'BOARD', name, wealth, growth_pct, earnings_7d from leaderboard_v2() order by growth_pct desc nulls last limit 8;
select 'CVLB', name, wealth, growth_pct, earnings_7d from leaderboard_v2() where org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06';
