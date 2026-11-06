-- Ogni sede arriva davvero ad almeno 4 servizi aperti entro 20 km: a ogni giro riceve tutti quelli che le mancano
-- (prima 1 a giro: con servizi da 5 minuti e giri ogni 2 minuti le sedi lontane restavano ferme a ~2).
-- Al massimo 80 servizi nuovi per giro per questa parte; poi il resto a caso come prima.

create or replace function public.generate_missions()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare
  h int := extract(hour from now() at time zone 'Europe/Rome');
  mult numeric; nb int; open_count int; cap int; to_create int; v_base uuid; r record; budget int := 80; n int := 0;
begin
  mult := case when h < 6 then 0.6 when h < 8 then 0.8 when h < 11 then 1.0 when h < 13 then 1.3
               when h < 15 then 0.9 when h < 17 then 1.0 when h < 20 then 1.4 when h < 22 then 0.9 else 0.7 end;
  select count(*) into nb from bases;
  if nb = 0 then return 0; end if;

  -- 1) ogni sede con meno di 4 servizi aperti entro 20 km riceve quelli che mancano (prima le più scoperte)
  for r in
    with aperti as materialized (
      select location from missions
       where status = 'aperta' and expires_at > now() and category <> 'mare' and transport is distinct from 'trasferimento'
    ), conta as (
      select b.id, (select count(*) from aperti a where st_dwithin(a.location, b.location, 20000)) c from bases b
    )
    select id, 4 - c as manca from conta where c < 4 order by c, random()
  loop
    exit when budget <= 0;
    n := n + generate_missions_near(r.id, least(r.manca, budget)::int, 18000);
    budget := budget - r.manca;
  end loop;

  -- 2) il resto a caso, con il tetto di sempre
  select count(*) into open_count from missions
   where status = 'aperta' and expires_at > now() and source = 'scheduler'
     and category <> 'mare' and transport is distinct from 'trasferimento';
  cap := round(least(60, 8 + nb * 0.75) * mult);
  to_create := least(cap - open_count, greatest(3, round(nb / 5.0))::int);
  for i in 1 .. greatest(0, to_create) loop
    select b.id into v_base from bases b
     where b.org_id = (select org_id from bases group by org_id order by random() limit 1)
     order by random() limit 1;
    n := n + generate_missions_near(v_base, 1);
  end loop;
  return n;
end $$;
