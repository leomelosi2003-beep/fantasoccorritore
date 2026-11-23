-- my_cards e missions_map: "chi sono io" calcolato una volta sola, prestiti cercati con un indice invece che carta per carta
do $$
declare d text; nd text; col text;
begin
  -- carte
  d := pg_get_viewdef('my_cards'::regclass, true);
  if position('me_.me' in d) = 0 then
    select column_name into col from information_schema.columns where table_schema = 'public' and table_name = 'card_loans' and column_name in ('card_id', 'card_inventory_id') limit 1;
    if col is null then raise exception 'ESITO colonna prestiti carte non trovata'; end if;
    nd := replace(d, 'my_org_id()', 'me_.me');
    nd := replace(nd, E'FROM card_inventory ci\n', E'FROM ( SELECT my_org_id() AS me) me_,\n    card_inventory ci\n');
    nd := replace(nd, 'OR card_borrower(ci.id) = me_.me',
      format('OR (EXISTS ( SELECT 1 FROM card_loans l WHERE l.%I = ci.id AND l.to_org = me_.me AND l.returned_at IS NULL AND l.ends_at > now()))', col));
    if position('FROM ( SELECT my_org_id() AS me) me_' in nd) = 0 or position('card_loans l' in nd) = 0 then raise exception 'ESITO patch carte non applicata'; end if;
    execute 'create or replace view public.my_cards as ' || nd;
    execute format('create index if not exists card_loans_open_idx on card_loans (%I) where returned_at is null', col);
  end if;
  create index if not exists vehicle_loans_open_idx on vehicle_loans (vehicle_id) where returned_at is null;
  -- servizi sulla mappa
  d := pg_get_viewdef('missions_map'::regclass, true);
  if position('me_.me' in d) = 0 then
    nd := replace(d, 'my_org_id()', 'me_.me');
    nd := replace(nd, E'FROM missions\n          WHERE', E'FROM missions,\n            ( SELECT my_org_id() AS me) me_\n          WHERE');
    if position('( SELECT my_org_id() AS me) me_' in nd) = 0 then raise exception 'ESITO patch servizi non applicata'; end if;
    execute 'create or replace view public.missions_map as ' || nd;
  end if;
  raise notice 'ESITO viste carte e servizi velocizzate';
end $$;
do $$
declare t0 timestamptz; n int; u uuid;
begin
  select owner_id into u from organizations where name ilike 'croce verde livorno%' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  t0 := clock_timestamp(); select count(*) into n from (select * from my_cards) x;
  raise notice 'ESITO carte % in % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); select count(*) into n from (select * from missions_map) x;
  raise notice 'ESITO servizi mappa % in % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
end $$;
