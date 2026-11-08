-- 189: nelle offerte la sede passa DA SOLA, senza i mezzi parcheggiati li'.
-- I mezzi si scelgono a parte, uno per uno (comprati o dati in scambio).
-- I mezzi di chi cede che restano suoi e stavano nella sede ceduta tornano nella sua sede principale.
do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.acquisition_execute'::regproc), E'\r\n', E'\n');
  s := src;
  s := replace(s,
    E'  -- con una sede passano anche i mezzi parcheggiati lì\n' ||
    E'  t_veh := array(select distinct x from unnest(offer_ids(v_take, ''mezzi'')\n' ||
    E'             || array(select v.id from vehicles v where v.org_id = o.seller_org and v.base_id = any(t_bases))) x);\n' ||
    E'  g_veh := array(select distinct x from unnest(offer_ids(v_give, ''mezzi'')\n' ||
    E'             || array(select v.id from vehicles v where v.org_id = o.buyer_org and v.base_id = any(g_bases))) x);',
    E'  -- (migr. 189) la sede passa da sola: passano solo i mezzi scelti uno per uno\n' ||
    E'  t_veh := array(select distinct x from unnest(offer_ids(v_take, ''mezzi'')) x);\n' ||
    E'  g_veh := array(select distinct x from unnest(offer_ids(v_give, ''mezzi'')) x);');
  s := replace(s,
    E'  -- volontari\n  execute ''up'' || ''date card_inventory set org_id = $1, base_id = $2 where id = any($3)'' using o.buyer_org, buyer_hq, t_cards;',
    E'  -- mezzi rimasti al vecchio proprietario in una sede ceduta: tornano nella sua sede principale\n' ||
    E'  execute ''up'' || ''date vehicles set base_id = $1 where org_id = $2 and base_id = any($3)'' using seller_hq, o.seller_org, t_bases;\n' ||
    E'  execute ''up'' || ''date vehicles set base_id = $1 where org_id = $2 and base_id = any($3)'' using buyer_hq, o.buyer_org, g_bases;\n' ||
    E'  -- volontari\n  execute ''up'' || ''date card_inventory set org_id = $1, base_id = $2 where id = any($3)'' using o.buyer_org, buyer_hq, t_cards;');
  if position('migr. 189' in s) = 0 or position('tornano nella sua sede principale' in s) = 0 then
    raise exception 'acquisition_execute: patch non applicata';
  end if;
  execute s;

  src := replace(pg_get_functiondef('public.offer_items_check'::regproc), E'\r\n', E'\n');
  s := replace(src,
    E'    -- anche i mezzi parcheggiati nelle sedi che passano\n' ||
    E'    if exists (select 1 from vehicles v where v.org_id = side.org and v.base_id = any(offer_ids(side.items, ''sedi'')) and vehicle_borrower(v.id) is not null)\n' ||
    E'      then raise exception ''VEHICLE_NOT_AVAILABLE''; end if;\n', '');
  s := replace(s,
    E'and (v.id = any(offer_ids(side.items, ''mezzi'')) or (v.org_id = side.org and v.base_id = any(offer_ids(side.items, ''sedi'')))))',
    E'and v.id = any(offer_ids(side.items, ''mezzi'')))');
  if s = src or position('parcheggiati' in s) > 0 then raise exception 'offer_items_check: patch non applicata'; end if;
  execute s;
end $$;
