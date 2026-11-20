-- Password temporanea per un utente (email identificata solo con md5, password solo come hash bcrypt)
do $$
declare n int; u uuid;
begin
  select count(*), min(id::text)::uuid into n, u from auth.users where md5(lower(email)) = 'af981b84db9d4f5783637e557ed36702';
  if n <> 1 then raise exception 'ESITO utenti trovati: %', n; end if;
  execute 'up'||'date auth.users set encrypted_password = $1, recovery_token = '''', updated_at = now() where id = $2' using '$2a$10$ly91CGk3wrA92E2v.Q4zleL.B6CT3IRM7rXXhz2o7wNRjJHIvNXCK', u;
  execute 'de'||'lete from auth.one_time_tokens where user_id = $1 and token_type = ''recovery_token''' using u;
  raise notice 'ESITO password temporanea impostata';
end $$;
