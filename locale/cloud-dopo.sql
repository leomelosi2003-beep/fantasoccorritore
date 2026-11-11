-- Eseguito sul Supabase CLOUD da 6-torna-sul-cloud.ps1 dopo aver caricato lo schema public del PC.
-- Variabili psql: users, idents (JSON letti dai file /tmp/users.json e /tmp/idents.json)
\set ON_ERROR_STOP 1
\set users `cat /tmp/users.json`
\set idents `cat /tmp/idents.json`
begin;

\echo regole storage
-- 1) trigger e regole storage (come migr. 155) puntati al nuovo schema public
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
drop policy if exists "admin delete volunteer photos" on storage.objects;
create policy "admin delete volunteer photos" on storage.objects for delete to authenticated using (bucket_id = 'volunteer-photos' and public.is_admin());
drop policy if exists "admin edit volunteer photos" on storage.objects;
create policy "admin edit volunteer photos" on storage.objects for update to authenticated using (bucket_id = 'volunteer-photos' and public.is_admin());
drop policy if exists "admin upload volunteer photos" on storage.objects;
create policy "admin upload volunteer photos" on storage.objects for insert to authenticated with check (bucket_id = 'volunteer-photos' and public.is_admin());
drop policy if exists "org logos delete" on storage.objects;
create policy "org logos delete" on storage.objects for delete to authenticated using (bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.my_org_id()::text);
drop policy if exists "org logos insert" on storage.objects;
create policy "org logos insert" on storage.objects for insert to authenticated with check (bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.my_org_id()::text);
drop policy if exists "org logos read" on storage.objects;
create policy "org logos read" on storage.objects for select to authenticated using (bucket_id = 'org-logos');
drop policy if exists "org logos update" on storage.objects;
create policy "org logos update" on storage.objects for update to authenticated using (bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.my_org_id()::text);

\echo utenti
-- 2) utenti: aggiorno/aggiungo quelli del PC (password comprese), senza toccare le colonne generate
create function pg_temp.upsert_auth(tbl text, data json, conflict text) returns int language plpgsql as $f$
declare cols text; sets text; n int;
begin
  if json_array_length(data) = 0 then return 0; end if;
  select string_agg(quote_ident(a.attname), ',' order by a.attnum),
         string_agg(format('%1$I = excluded.%1$I', a.attname), ',' order by a.attnum)
    into cols, sets
    from pg_attribute a
   where a.attrelid = format('auth.%I', tbl)::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
     and (json_array_element(data, 0)::jsonb) ? a.attname;
  if conflict is null then
    execute format('insert into auth.%I (%s) select %s from json_populate_recordset(null::auth.%I, $1) on conflict do nothing', tbl, cols, cols, tbl) using data;
  else
    execute format('insert into auth.%I (%s) select %s from json_populate_recordset(null::auth.%I, $1) on conflict (%s) do update set %s', tbl, cols, cols, tbl, conflict, sets) using data;
  end if;
  get diagnostics n = row_count; return n;
end $f$;
select 'utenti ' || pg_temp.upsert_auth('users', :'users'::json, 'id');
select 'identita ' || pg_temp.upsert_auth('identities', :'idents'::json, null);

-- 2b) il collegamento profili -> utenti (pg_restore non riesce a crearlo prima che arrivino gli utenti nuovi)
\echo collegamento profili
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

\echo profili
-- 3) profili per eventuali utenti senza profilo (come migr. 155)
insert into public.profiles (id, username)
select u.id, coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1) || '_' || substr(u.id::text, 1, 4))
  from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

\echo indirizzi foto
-- 4) indirizzi di stemmi e foto: dal PC al cloud
do $$ declare r record; begin
  for r in select c.table_name t, c.column_name c from information_schema.columns c
             join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name
            where c.table_schema = 'public' and x.table_type = 'BASE TABLE' and c.data_type in ('text', 'character varying') loop
    execute format('alter table public.%I disable trigger user', r.t);
    execute format('update public.%I set %I = replace(%I, %L, %L) where %I like %L', r.t, r.c, r.c,
      'https://desktop-f0qb534.tail9a3baf.ts.net/sb/storage/', 'https://saagkulmwofgvlssiucw.supabase.co/storage/', r.c, '%desktop-f0qb534.tail9a3baf.ts.net/sb/storage/%');
    execute format('update public.%I set %I = %L || substr(%I, 13) where %I like %L', r.t, r.c,
      'https://saagkulmwofgvlssiucw.supabase.co/storage/', r.c, r.c, '/sb/storage/%');
    execute format('alter table public.%I enable trigger user', r.t);
  end loop;
end $$;

\echo realtime
-- 5) le vecchie tabelle del cloud escono dal realtime (restano salvate nello schema public_cloud_20261106)
do $$ declare r record; begin
  for r in select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname like 'public_cloud_%' loop
    execute format('alter publication supabase_realtime drop table %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';
