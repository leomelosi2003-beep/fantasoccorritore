\pset pager off
select 'AUTOH', pg_get_functiondef('auto_hour_cost_org'::regproc);
select 'VAL', pg_get_functiondef('org_valuation'::regproc);
select 'TAX', l from regexp_split_to_table(replace(pg_get_functiondef('complete_due_assignments'::regproc), E'\r\n', E'\n'), E'\n') l
  where l ~* '(tax|tass|1000000|5000000|20000000|prog)';
select 'PREZZO', auto_hour_cost_org('fa0f81c2-fea9-449a-a66f-f84325fe1d06'), ceil(auto_hour_cost_org('fa0f81c2-fea9-449a-a66f-f84325fe1d06')/3.0);
select 'TURNI', b.name, s.shifts from auto_shifts s join bases b on b.id = s.base_id where s.org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' order by 2;
select 'MAREPREMIO', code, round(avg(reward_funds)), count(*) from missions where category = 'mare' and created_at > now() - interval '24 hours' group by 2;
select 'ORDPREMIO', code, round(avg(reward_funds)) from missions where category = 'ordinario' and created_at > now() - interval '24 hours' group by 2;
select 'EMPREMIO', code, round(avg(reward_funds)) from missions where category = 'emergenza_118' and created_at > now() - interval '24 hours' group by 2;
select 'STELLATA', b.name, round(st_y(b.location::geometry)::numeric,2), round(st_x(b.location::geometry)::numeric,2), (select count(*) from vehicles v where v.base_id=b.id)
  from bases b join organizations o on o.id = b.org_id where o.name = 'Croce Stellata del Nord Tirreno' order by 2;
