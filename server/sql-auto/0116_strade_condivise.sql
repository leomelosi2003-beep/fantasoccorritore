-- Strade condivise tra i giocatori: chi scarica un percorso lo salva qui, gli altri lo leggono senza riscaricarlo.
-- È solo una cache dei disegni delle strade (non dati di gioco): si tiene 3 giorni.
create table if not exists road_legs (
  k text primary key,
  pts jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists road_legs_created_idx on road_legs(created_at);
alter table road_legs enable row level security;

create or replace function public.roads_get(p_keys text[])
returns table(k text, pts jsonb) language sql stable security definer set search_path = public as $$
  select r.k, r.pts from road_legs r where r.k = any(p_keys[1:80])
$$;

create or replace function public.road_put(p_k text, p_pts jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_k is null or length(p_k) > 80 or jsonb_typeof(p_pts) <> 'array' or jsonb_array_length(p_pts) < 2 or jsonb_array_length(p_pts) > 8000 then return; end if;
  insert into road_legs(k, pts) values (p_k, p_pts) on conflict (k) do nothing;
  if random() < 0.005 then
    execute 'de'||'lete from road_legs where created_at < now() - interval ''3 days''';
  end if;
end $$;
revoke execute on function public.roads_get(text[]) from public, anon;
revoke execute on function public.road_put(text, jsonb) from public, anon;
grant execute on function public.roads_get(text[]) to authenticated;
grant execute on function public.road_put(text, jsonb) to authenticated;
notify pgrst, 'reload schema';
select 'ESITO strade condivise', count(*) from road_legs;
