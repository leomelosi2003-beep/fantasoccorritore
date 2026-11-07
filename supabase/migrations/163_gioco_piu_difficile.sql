-- 163: gioco più difficile — servizi pagati un po' meno, buste più care, carte leggendarie nel negozio.

-- 1) servizi: -10% sul premio finale
do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.complete_due_assignments'::regproc), E'\r\n', E'\n');
  s := replace(src,
    'reward := round(reward * (1 + clinical_bonus(a.id, m.title, m.code::text)));',
    'reward := round(reward * (1 + clinical_bonus(a.id, m.title, m.code::text)));'||E'\n'||
    '    reward := round(reward * 0.90);  -- servizi un po'' meno pagati (gioco più difficile)');
  if s = src then raise exception 'complete_due_assignments: patch premio non applicata'; end if;
  execute s;
end $$;

-- 2) buste più costose
create or replace function public.pack_catalog()
 returns jsonb language sql stable as $fn$
  select '[
    {"kind":"comune",      "price":4500,  "leg":0.02, "epi":0.13, "guarantee":null},
    {"kind":"epico",       "price":17000, "leg":0.08, "epi":0.42, "guarantee":"epica"},
    {"kind":"leggendario", "price":52000, "leg":0.25, "epi":0.50, "guarantee":"leggendaria"}
  ]'::jsonb $fn$;

-- 3) carte leggendarie nel negozio (care): prezzo in base alle statistiche
update volunteers
   set shop_price = round((coalesce(stat_guida,0) + coalesce(stat_soccorso,0) + coalesce(stat_resilienza,0)) * 1000 + 80000)
 where rarity = 'leggendaria' and is_pack_eligible;
