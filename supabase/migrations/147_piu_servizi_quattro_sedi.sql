-- Un po' più servizi e modalità automatica fino a 4 sedi.
-- Servizi aperti: da min(40, 5 + sedi/2) a min(60, 8 + sedi x 0,75), sempre x fascia oraria;
-- nuovi a ogni giro (2 min): da max(2, sedi/8) a max(3, sedi/5). Sempre entro 50 km da una sede.

do $$
declare src text;
begin
  src := pg_get_functiondef('public.generate_missions()'::regprocedure);
  if position('least(40, 5 + nb / 2.0)' in src) > 0 then
    src := replace(src, 'least(40, 5 + nb / 2.0)', 'least(60, 8 + nb * 0.75)');
    src := replace(src, 'greatest(2, round(nb / 8.0))', 'greatest(3, round(nb / 5.0))');
    execute src;
  end if;
  src := pg_get_functiondef('public.generate_missions()'::regprocedure);
  if position('least(60, 8 + nb * 0.75)' in src) = 0 or position('greatest(3, round(nb / 5.0))' in src) = 0 then
    raise exception 'patch generate_missions fallita';
  end if;

  src := pg_get_functiondef('public.set_auto_bases(uuid[])'::regprocedure);
  if position('cardinality(v_req) > 2' in src) > 0 then
    src := replace(src, 'cardinality(v_req) > 2', 'cardinality(v_req) > 4');
    execute src;
  end if;
  if position('cardinality(v_req) > 4' in pg_get_functiondef('public.set_auto_bases(uuid[])'::regprocedure)) = 0 then
    raise exception 'patch set_auto_bases fallita';
  end if;
end $$;
