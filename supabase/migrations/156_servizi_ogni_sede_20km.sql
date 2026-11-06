-- 156: ogni sede (presente e futura) riceve servizi entro almeno 20 km.
-- generate_missions: toglie il tetto di 80 che lasciava molte sedi a 0 (riempie tutte le sedi sotto 4).
-- generate_missions_near: servizi 12 min invece di 5 (così la copertura regge tra un giro e l'altro); raggio 20 km;
--   se non ci sono punti noti vicino, i servizi si spargono tra 2 e 20 km dalla sede invece di restare addosso.
-- bases_new_missions: sede nuova -> 4 servizi subito, entro 20 km.

do $$
declare src text; src2 text;
begin
  -- generate_missions: riempie TUTTE le sedi sotto 4, raggio 20 km
  src := replace(pg_get_functiondef('public.generate_missions'::regproc), E'\r\n', E'\n');
  src2 := src;
  src2 := replace(src2,
    'if nb = 0 then return 0; end if;',
    'if nb = 0 then return 0; end if;'||E'\n  budget := greatest(200, nb * 6);');
  src2 := replace(src2,
    'generate_missions_near(r.id, least(r.manca, budget)::int, 18000)',
    'generate_missions_near(r.id, least(r.manca, budget)::int, 20000)');
  if src2 = src then raise exception 'generate_missions: patch non applicata'; end if;
  execute src2;

  -- generate_missions_near: 12 minuti e fallback sparso 2-20 km
  src := replace(pg_get_functiondef('public.generate_missions_near'::regproc), E'\r\n', E'\n');
  src2 := src;
  src2 := replace(src2, 'now() + interval ''5 minutes''', 'now() + interval ''12 minutes''');
  src2 := replace(src2,
    'st_project(bl, 500 + random() * 4500, random() * 2 * pi())',
    'st_project(bl, 2000 + random() * (p_radius - 2000), random() * 2 * pi())');
  if src2 = src then raise exception 'generate_missions_near: patch non applicata'; end if;
  execute src2;

  -- bases_new_missions: 4 servizi, 20 km
  src := replace(pg_get_functiondef('public.bases_new_missions'::regproc), E'\r\n', E'\n');
  src2 := replace(src, 'generate_missions_near(new.id, 3, 18000)', 'generate_missions_near(new.id, 4, 20000)');
  if src2 = src then raise exception 'bases_new_missions: patch non applicata'; end if;
  execute src2;
end $$;
