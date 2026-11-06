-- Ripristino sul database locale di ciò che la copia (supabase db dump) non porta: stanno negli schemi auth e storage.
-- Da eseguire come supabase_admin (auth.users e storage.objects appartengono agli utenti interni di Supabase).
-- 1) trigger che crea il profilo a ogni nuovo utente (senza profilo non si può fondare l'associazione)
-- 2) regole per stemmi delle associazioni e foto dei volontari
-- 3) profilo per gli utenti registrati mentre il trigger mancava

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "admin delete volunteer photos" on storage.objects;
create policy "admin delete volunteer photos" on storage.objects for delete to authenticated
  using (bucket_id = 'volunteer-photos' and public.is_admin());
drop policy if exists "admin edit volunteer photos" on storage.objects;
create policy "admin edit volunteer photos" on storage.objects for update to authenticated
  using (bucket_id = 'volunteer-photos' and public.is_admin());
drop policy if exists "admin upload volunteer photos" on storage.objects;
create policy "admin upload volunteer photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'volunteer-photos' and public.is_admin());

drop policy if exists "org logos delete" on storage.objects;
create policy "org logos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.my_org_id()::text);
drop policy if exists "org logos insert" on storage.objects;
create policy "org logos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.my_org_id()::text);
drop policy if exists "org logos read" on storage.objects;
create policy "org logos read" on storage.objects for select to authenticated
  using (bucket_id = 'org-logos');
drop policy if exists "org logos update" on storage.objects;
create policy "org logos update" on storage.objects for update to authenticated
  using (bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.my_org_id()::text);

insert into public.profiles (id, username)
select u.id, coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1) || '_' || substr(u.id::text, 1, 4))
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;
