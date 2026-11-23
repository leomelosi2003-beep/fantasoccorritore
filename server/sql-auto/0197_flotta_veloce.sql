-- vista my_fleet: "chi sono io" calcolato una volta sola invece che 5 volte per ognuno dei 1000 mezzi
do $$
declare d text; nd text; t0 timestamptz;
begin
  d := pg_get_viewdef('my_fleet'::regclass, true);
  if position('me_.me' in d) > 0 then raise notice 'ESITO già fatto'; return; end if;
  nd := replace(d, 'my_org_id()', 'me_.me');
  nd := replace(nd, E'FROM vehicles v\n', E'FROM ( SELECT my_org_id() AS me) me_,\n    vehicles v\n');
  nd := replace(nd, 'OR vehicle_borrower(id) = me_.me', 'OR (EXISTS ( SELECT 1 FROM vehicle_loans l WHERE l.vehicle_id = v.id AND l.to_org = me_.me AND l.returned_at IS NULL AND l.ends_at > now()))');
  if position('FROM ( SELECT my_org_id() AS me) me_' in nd) = 0 or position('vehicle_loans l' in nd) = 0 then raise exception 'ESITO patch non applicata: %', left(nd, 200); end if;
  execute 'create or replace view public.my_fleet as ' || nd;
  raise notice 'ESITO vista flotta velocizzata';
end $$;
-- prova di velocità come giocatore (Croce Verde Livorno)
do $$
declare t0 timestamptz; n int; u uuid;
begin
  select owner_id into u from organizations where name ilike 'croce verde livorno%' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  t0 := clock_timestamp();
  select count(*) into n from (select id, call_sign, status, moor_lat, vehicle_image from my_fleet where boat) x;
  raise notice 'ESITO barche % in % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp();
  select count(*) into n from (select * from my_fleet) x;
  raise notice 'ESITO flotta intera % mezzi in % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
end $$;
