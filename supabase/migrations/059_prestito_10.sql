-- Chi presta un'ambulanza guadagna il 10% del premio di ogni servizio fatto con essa (prima 15%)
do $do$
declare src text;
begin
  src := pg_get_functiondef('complete_due_assignments()'::regprocedure);
  src := replace(src, 'funds = funds + round(reward * 0.15) where id = veh.org_id', 'funds = funds + round(reward * 0.10) where id = veh.org_id');
  execute src;
end $do$;
