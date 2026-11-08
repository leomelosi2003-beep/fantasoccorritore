-- 179: Bacheca "Notizie dal territorio": fatti delle ultime 48 ore ricavati dai dati esistenti (sola lettura).
create or replace function public.news_feed()
returns table(at timestamptz, icon text, title text, body text)
language sql stable security definer set search_path = public as $$
  -- maxi-emergenze e incendi conclusi
  select m.expires_at, case when m.venue = 'AIB' then '🔥' else '🆘' end,
         case when m.venue = 'AIB' then 'Incendio spento a ' || regexp_replace(m.title, '^.*—\s*', '')
              else 'Maxi-emergenza conclusa: ' || regexp_replace(m.title, '^.*MAXI-EMERGENZA:\s*', '') end,
         format('%s mezzi da %s. In prima linea: %s (%s mezzi).', cnt.n,
                case when cnt.orgs = 1 then '1 associazione' else cnt.orgs || ' associazioni' end, o.name, cnt.top_n)
    from missions m
    join lateral (
      select count(*) n, count(distinct x.org_id) orgs,
             (select x2.org_id from mission_assignments x2 where x2.mission_id = m.id and x2.status <> 'annullata'
               group by x2.org_id order by count(*) desc limit 1) top_org,
             (select count(*) from mission_assignments x2 where x2.mission_id = m.id and x2.status <> 'annullata'
               group by x2.org_id order by count(*) desc limit 1) top_n
        from mission_assignments x where x.mission_id = m.id and x.status <> 'annullata') cnt on cnt.n > 0
    join organizations o on o.id = cnt.top_org
   where m.category = 'grande_evento' and m.event_id is null
     and m.expires_at > now() - interval '48 hours' and m.expires_at <= now()
  union all
  -- nuove associazioni
  select o.created_at, '🆕', 'Nuova associazione: ' || o.name, 'Benvenuti sul territorio!'
    from organizations o where o.created_at > now() - interval '48 hours'
  union all
  -- traguardi d'oro delle alleanze
  select min(c.claimed_at), '🥇', 'L''alleanza ' || al.name || ' ha raggiunto l''oro', 'Obiettivo di squadra della settimana completato al massimo.'
    from alliance_goal_claims c join alliances al on al.id = c.alliance_id
   where c.tier = 3 and c.claimed_at > now() - interval '48 hours' group by al.name
  union all
  -- re dei codici rossi di ieri
  (select (date_trunc('day', now() at time zone 'Europe/Rome')) at time zone 'Europe/Rome', '🔴',
          'Re dei codici rossi di ieri: ' || o.name, format('%s codici rossi conclusi in un giorno.', x.n)
     from (select a.org_id, count(*) n from mission_assignments a join missions m on m.id = a.mission_id
            where a.status = 'conclusa' and m.code = 'rosso'
              and a.completed_at >= (date_trunc('day', now() at time zone 'Europe/Rome') - interval '1 day') at time zone 'Europe/Rome'
              and a.completed_at <  (date_trunc('day', now() at time zone 'Europe/Rome')) at time zone 'Europe/Rome'
            group by a.org_id order by n desc limit 1) x join organizations o on o.id = x.org_id)
  union all
  -- il piu' veloce a soffiare servizi nelle ultime 24 ore
  (select max(s.created_at), '🥷', 'Il più rapido del giorno: ' || o.name,
          format('%s servizi soffiati agli altri arrivando per primo nelle ultime 24 ore.', count(*))
     from mission_steals s join organizations o on o.id = s.winner_org
    where s.created_at > now() - interval '24 hours'
    group by o.name having count(*) >= 5 order by count(*) desc limit 1)
  union all
  -- titoli di stagione assegnati
  select (a.season + interval '1 month')::timestamp at time zone 'Europe/Rome', '🏆',
         format('Stagione di %s: vince %s', to_char(a.season, 'MM/YYYY'), o.name),
         format('%s punti. Il titolo resta per sempre in classifica.', to_char(a.points, 'FM999G999G999'))
    from season_awards a join organizations o on o.id = a.org_id
   where a.category = 'punti' and a.rank = 1
     and (a.season + interval '1 month') > now() - interval '72 hours'
  order by 1 desc
  limit 30
$$;
grant execute on function public.news_feed() to anon, authenticated;
