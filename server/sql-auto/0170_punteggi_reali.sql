-- Punteggi reali delle partite (pagine squadra della Lega Basket / fonti degli eventi), aggiornati ogni 2 minuti durante le partite
create table if not exists public.event_scores(
  event_id uuid primary key references events(id) on delete cascade, team1 text, team2 text, score1 int, score2 int,
  updated_at timestamptz not null default now());
alter table public.event_scores enable row level security;
create table if not exists public.score_fetches(id bigint primary key, source text, requested_at timestamptz default now(), processed boolean default false);

create or replace function public.scores_tick() returns int
 language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare f record; x text; m text[]; e record; n int := 0;
begin
  -- 1) leggo le risposte arrivate
  for f in select sf.id, r.content, r.status_code from score_fetches sf join net._http_response r on r.id = sf.id where not sf.processed loop
    if f.status_code = 200 and f.content is not null then
      x := regexp_replace(regexp_replace(f.content, '<[^>]+>', '|', 'g'), '\s*\|[\s|]*', '|', 'g');
      for m in select regexp_matches(x, '\|(\d{1,3}) - (\d{1,3})\|([^|]+)\|(\d{2}/\d{2}/\d{4})[ |]*(\d{2}:\d{2})?\|([^|]+)\|([^|]+)\|', 'g') loop
        for e in select ev.id, ev.show_at from events ev
                  where ev.kind in ('basket', 'calcio') and ev.show_at between now() - interval '6 hours' and now() + interval '15 minutes'
                    and (ev.show_at at time zone 'Europe/Rome')::date = to_date(m[4], 'DD/MM/YYYY')
                    and (m[5] is null or to_char(ev.show_at at time zone 'Europe/Rome', 'HH24:MI') = m[5]) loop
          if (m[1]::int + m[2]::int) = 0 and now() < e.show_at then continue; end if;
          insert into event_scores(event_id, team1, team2, score1, score2) values (e.id, btrim(m[6]), btrim(m[7]), m[1]::int, m[2]::int)
          on conflict (event_id) do update set team1 = excluded.team1, team2 = excluded.team2, score1 = excluded.score1, score2 = excluded.score2,
            updated_at = case when (event_scores.score1, event_scores.score2) is distinct from (excluded.score1, excluded.score2) then now() else event_scores.updated_at end;
          n := n + 1;
        end loop;
      end loop;
    end if;
    execute 'up'||'date score_fetches set processed = true where id = $1' using f.id;
  end loop;
  execute 'de'||'lete from score_fetches where requested_at < now() - interval ''1 day''';
  -- 2) se c'è una partita in corso, richiedo di nuovo le pagine
  if exists (select 1 from events where kind in ('basket', 'calcio') and now() between show_at - interval '10 minutes' and show_at + interval '4 hours') then
    insert into score_fetches(id, source)
    select net.http_get(s.url, headers => '{"User-Agent":"Mozilla/5.0"}'::jsonb), s.source from event_sources s where s.source in ('libertas', 'pielle', 'calcio');
  end if;
  return n;
end $$;

create or replace function public.event_live_score(p_mission uuid)
returns table(team1 text, team2 text, score1 int, score2 int, updated_at timestamptz)
 language sql stable security definer set search_path to 'public' as $$
  select s.team1, s.team2, s.score1, s.score2, s.updated_at from missions m join event_scores s on s.event_id = m.event_id where m.id = p_mission
$$;
grant execute on function public.event_live_score(uuid) to authenticated, anon;
revoke execute on function public.scores_tick() from public, anon, authenticated;
select public.scores_tick();
do $$ begin raise notice 'ESITO punteggi reali pronti'; end $$;
