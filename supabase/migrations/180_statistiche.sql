-- 180: Statistiche personali giorno per giorno (sola lettura).
create or replace function public.my_daily_stats(p_days int default 30)
returns table(day date, services bigint, rossi bigint, gialli bigint, altri bigint, mare bigint, trasf bigint,
              earnings bigint, avg_arrival_sec numeric)
language sql stable security definer set search_path = public as $$
  select (a.completed_at at time zone 'Europe/Rome')::date d,
         count(*),
         count(*) filter (where m.code = 'rosso'),
         count(*) filter (where m.code = 'giallo'),
         count(*) filter (where m.code not in ('rosso', 'giallo')),
         count(*) filter (where m.category = 'mare'),
         count(*) filter (where m.transport = 'trasferimento'),
         coalesce(sum(a.reward_funds), 0)::bigint,
         round(avg(extract(epoch from a.arrives_at - a.assigned_at))
                 filter (where m.category = 'emergenza_118')::numeric, 0)
    from mission_assignments a join missions m on m.id = a.mission_id
   where a.org_id = my_org_id() and a.status = 'conclusa'
     and a.completed_at >= ((current_date - least(greatest(p_days, 1), 90) + 1)::timestamp at time zone 'Europe/Rome')
   group by 1 order by 1
$$;
grant execute on function public.my_daily_stats(int) to authenticated;
