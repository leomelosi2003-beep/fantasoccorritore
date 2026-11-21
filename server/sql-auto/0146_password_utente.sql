-- Password temporanea (utente cercato per nome, password solo come hash bcrypt)
do $$
declare n int; u uuid;
begin
  select count(*), min(id::text)::uuid into n, u from auth.users
   where (lower(email) like '%favilli%' or raw_user_meta_data::text ilike '%favilli%')
     and (lower(email) like '%mattia%' or raw_user_meta_data::text ilike '%mattia%');
  if n <> 1 then raise exception 'ESITO utenti trovati: %', n; end if;
  execute 'up'||'date auth.users set encrypted_password = $1, recovery_token = '''', updated_at = now() where id = $2' using '$2a$10$.1Es.Maqb.muk/kZrVisjOikKFln42fp.le8.FAckfq6xo3gPqEci', u;
  execute 'de'||'lete from auth.one_time_tokens where user_id = $1 and token_type = ''recovery_token''' using u;
  raise notice 'ESITO password temporanea impostata';
end $$;
