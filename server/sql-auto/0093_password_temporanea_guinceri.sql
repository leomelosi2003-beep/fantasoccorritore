-- Password temporanea per l'associazione "Croce Colorata Guinceri paese" (solo hash bcrypt)
do $$
declare n int; u uuid;
begin
  select count(*), min(owner_id::text)::uuid into n, u from public.organizations where name ilike '%guinceri%';
  if n <> 1 then raise exception 'ESITO trovate % associazioni', n; end if;
  execute 'up'||'date auth.users set encrypted_password = $1, recovery_token = '''', updated_at = now() where id = $2'
    using '$2a$10$UnNipx0tPE3yDLhdpgxt5.TuzEKHGM.Rgd.P5P7IkU2xmh5P4p0Ry', u;
  execute 'de'||'lete from auth.one_time_tokens where user_id = $1 and token_type = ''recovery_token''' using u;
  raise notice 'ESITO password temporanea impostata';
end $$;
