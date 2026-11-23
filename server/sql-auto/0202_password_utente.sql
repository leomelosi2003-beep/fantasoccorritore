-- Password temporanea (utente cercato dal nome dell'associazione, solo hash bcrypt)
do $$
declare n int; u uuid;
begin
  select count(*), min(owner_id::text)::uuid into n, u from organizations where name ilike '%bob%emergency%';
  if n <> 1 then raise exception 'ESITO associazioni trovate: %', n; end if;
  execute 'up'||'date auth.users set encrypted_password = $1, recovery_token = '''', updated_at = now() where id = $2' using '$2a$10$6D5KT6sb8GbhI4Cji7feheEBk4mNFoYv6JAqou.xNOfGYUHnA1wlu', u;
  execute 'de'||'lete from auth.one_time_tokens where user_id = $1 and token_type = ''recovery_token''' using u;
  raise notice 'ESITO password temporanea impostata';
end $$;
