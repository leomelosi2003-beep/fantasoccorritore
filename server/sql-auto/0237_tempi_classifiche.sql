do $$
declare t0 timestamptz; n int; u uuid;
begin
  select owner_id into u from organizations where name ilike 'croce verde livorno%' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  t0 := clock_timestamp(); select count(*) into n from season_board();
  raise notice 'ESITO season_board % righe in % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); select count(*) into n from reds_board();
  raise notice 'ESITO reds_board % righe in % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); select count(*) into n from leaderboard_v2();
  raise notice 'ESITO leaderboard_v2 % righe in % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); select count(*) into n from steals_board();
  raise notice 'ESITO steals_board % righe in % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
  raise notice 'ESITO timeout authenticated: %', (select setting from pg_settings where name='statement_timeout');
  raise notice 'ESITO ruolo: %', (select array_to_string(rolconfig, ',') from pg_roles where rolname = 'authenticated');
end $$;
