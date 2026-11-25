-- premi di fine stagione diversi per classifica: Stagione da 50 milioni, Rivelazione e Reputazione da 10 milioni
create or replace function public.season_prize(p_cat text, p_rank int) returns bigint language sql immutable as $$
  select case when p_cat = 'punti'
    then (array[50000000,40000000,32000000,25000000,20000000,15000000,12000000,10000000,7000000,5000000])[p_rank]
    else (array[10000000,8000000,6500000,5000000,4000000,3000000,2500000,2000000,1500000,1000000])[p_rank] end::bigint
$$;
do $$
declare src text; new_src text;
begin
  src := pg_get_functiondef('pay_season_prizes'::regproc);
  new_src := replace(src, 'season_prize(r.rk::int)', 'season_prize(r.cat, r.rk::int)');
  if new_src = src then raise exception 'ESITO patch non applicata'; end if;
  execute new_src;
  raise notice 'ESITO premi stagione per classifica';
end $$;
