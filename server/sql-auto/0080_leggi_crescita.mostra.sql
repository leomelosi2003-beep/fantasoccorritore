-- come si calcola la crescita e i numeri di Croce Verde Livorno (solo lettura, dati di gioco)
select 'FN', pg_get_functiondef('public.leaderboard_v2()'::regprocedure);
select 'CVL', name, funds, round(org_valuation(id)) valore_beni from organizations where id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06';
select 'SNAP', taken_at::date, wealth from org_snapshots where org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' and taken_at > now() - interval '9 days' order by taken_at limit 20;
