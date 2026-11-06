-- Ogni città con una sede ha sempre servizi.
-- Prima: un'associazione a caso e poi UNA sua sede a caso, quindi le sedi lontane delle associazioni grandi
-- (Roma, Milano, Capraia, Firenze, Trento...) restavano quasi sempre senza servizi; e nascevano fino a 50 km,
-- fuori dal raggio di 20 km della modalità automatica.
-- Ora a ogni giro: ogni sede con meno di 2 servizi aperti entro 20 km ne riceve 1 (al massimo 40 per giro),
-- poi il resto a caso come prima. Tutti i servizi nascono entro 20 km da una sede.

do $$
declare src text;
begin
  -- generate_missions_near: raggio come parametro (predefinito 20 km)
  if not exists (select 1 from pg_proc where proname = 'generate_missions_near' and pronargs = 3) then
    src := pg_get_functiondef('public.generate_missions_near(uuid, integer)'::regprocedure);
    if (length(src) - length(replace(src, '50000)', ''))) / length('50000)') <> 4 then
      raise exception 'generate_missions_near: attese 4 occorrenze di 50000';
    end if;
    src := replace(src, '50000)', 'p_radius)');
    src := replace(src, 'generate_missions_near(p_base uuid, p_count integer)',
                        'generate_missions_near(p_base uuid, p_count integer, p_radius integer DEFAULT 20000)');
    if position('p_radius integer DEFAULT 20000' in src) = 0 then raise exception 'firma generate_missions_near non trovata'; end if;
    drop function public.generate_missions_near(uuid, integer);
    execute src;
    revoke all on function public.generate_missions_near(uuid, integer, integer) from public, anon, authenticated;
  end if;
end $$;

create or replace function public.generate_missions()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare
  h int := extract(hour from now() at time zone 'Europe/Rome');
  mult numeric; nb int; open_count int; cap int; to_create int; v_base uuid; n int := 0;
begin
  mult := case when h < 6 then 0.6 when h < 8 then 0.8 when h < 11 then 1.0 when h < 13 then 1.3
               when h < 15 then 0.9 when h < 17 then 1.0 when h < 20 then 1.4 when h < 22 then 0.9 else 0.7 end;
  select count(*) into nb from bases;
  if nb = 0 then return 0; end if;

  -- 1) ogni sede con meno di 2 servizi aperti entro 20 km ne riceve uno (prima le più scoperte)
  for v_base in
    with aperti as materialized (
      select location from missions
       where status = 'aperta' and expires_at > now() and category <> 'mare' and transport is distinct from 'trasferimento'
    )
    select b.id from bases b
     where (select count(*) from aperti a where st_dwithin(a.location, b.location, 20000)) < 2
     order by (select count(*) from aperti a where st_dwithin(a.location, b.location, 20000)), random()
     limit 40
  loop
    n := n + generate_missions_near(v_base, 1, 18000);
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

-- sede nuova: 3 servizi entro 18 km, così la modalità automatica può prenderli
create or replace function public.bases_new_missions()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
begin
  begin
    perform generate_missions_near(new.id, 3, 18000);
  exception when others then
    raise warning 'servizi per la sede nuova non creati: %', sqlerrm; -- la sede si crea comunque
  end;
  return null;
end $$;
