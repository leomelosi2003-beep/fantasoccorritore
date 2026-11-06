-- Modalità automatica: le ambulanze restano nella loro zona.
-- Servizio al massimo a 20 km dalla SEDE del mezzo (prima 25 km), per ambulanze, automediche e il cambio delle automediche.
-- La "distanza massima" scelta dal giocatore (dalla posizione dell'ambulanza) ora arriva al massimo a 20 km.
-- Barche invariate (servizi in mare entro 40 km dall'ormeggio). Gli invii a mano non cambiano.

do $$
declare src text; n int;
begin
  src := pg_get_functiondef('public.auto_dispatch_org(uuid)'::regprocedure);
  n := (length(src) - length(replace(src, ', 25000)', ''))) / length(', 25000)');
  if n > 0 then
    if n <> 4 then raise exception 'auto_dispatch_org: attese 4 occorrenze di 25000, trovate %', n; end if;
    execute replace(src, ', 25000)', ', 20000)');
  end if;
  if position(', 25000)' in pg_get_functiondef('public.auto_dispatch_org(uuid)'::regprocedure)) > 0 then
    raise exception 'patch auto_dispatch_org fallita';
  end if;

  src := pg_get_functiondef('public.auto_medical(uuid)'::regprocedure);
  n := (length(src) - length(replace(src, ', 25000)', ''))) / length(', 25000)');
  if n > 0 then
    if n <> 2 then raise exception 'auto_medical: attese 2 occorrenze di 25000, trovate %', n; end if;
    execute replace(src, ', 25000)', ', 20000)');
  end if;
  if position(', 25000)' in pg_get_functiondef('public.auto_medical(uuid)'::regprocedure)) > 0 then
    raise exception 'patch auto_medical fallita';
  end if;
end $$;

create or replace function public.set_auto_max_km(p_km integer)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $$
  update organizations set auto_max_km = greatest(2, least(20, p_km)) where id = my_org_id();
$$;

update public.organizations set auto_max_km = 20 where auto_max_km > 20;
