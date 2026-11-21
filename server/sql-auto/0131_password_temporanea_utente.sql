-- Password temporanea per un utente (email identificata solo con md5, password solo come hash bcrypt)
do $$
declare n int; u uuid;
begin
  select count(*), min(id::text)::uuid into n, u from auth.users where md5(lower(email)) = '63140ac418d56300caed65d02fc86d2e';
  if n <> 1 then raise exception 'ESITO utenti trovati: %', n; end if;
  execute 'up'||'date auth.users set encrypted_password = $1, recovery_token = '''', updated_at = now() where id = $2' using '$2a$10$Z5jzl5aepocOQXbIMdxTsesWBIqijPrSYP/2HHcej4m5/YAoLEGCW', u;
  execute 'de'||'lete from auth.one_time_tokens where user_id = $1 and token_type = ''recovery_token''' using u;
  raise notice 'ESITO password temporanea impostata';
end $$;
