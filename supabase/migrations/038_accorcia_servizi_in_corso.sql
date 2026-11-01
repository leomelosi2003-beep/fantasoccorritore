-- Accorcia i servizi già in corso con le regole nuove (sul posto max 10 min, ospedale 2 min / 5 per trasferimenti e dimissioni)
create or replace function shorten_route(r jsonb, p_transport text) returns jsonb
language plpgsql stable as $$
declare outr jsonb := '[]'; i int; p jsonb; q jsonb; prev_new timestamptz; dur interval; target interval; new_t timestamptz;
begin
  if r is null or jsonb_array_length(r) = 0 then return r; end if;
  outr := jsonb_build_array(r->0);
  prev_new := (r->0->>'t')::timestamptz;
  for i in 1 .. jsonb_array_length(r) - 1 loop
    p := r->(i - 1); q := r->i;
    dur := (q->>'t')::timestamptz - (p->>'t')::timestamptz;
    if p->>'lat' = q->>'lat' and p->>'lng' = q->>'lng' and (q->>'t')::timestamptz > now() then
      target := case when q->>'label' = 'Sul posto' then interval '10 minutes'
                     when q->>'label' = 'A casa del paziente' then dur
                     when p_transport in ('trasferimento', 'dimissione') then interval '5 minutes'
                     else interval '2 minutes' end;
      new_t := least(prev_new + dur, greatest(prev_new + least(dur, target), now()));
    else
      new_t := prev_new + dur;
    end if;
    outr := outr || jsonb_build_array(q || jsonb_build_object('t', new_t));
    prev_new := new_t;
  end loop;
  return outr;
end $$;

update mission_assignments a set route = shorten_route(a.route, m.transport)
  from missions m where m.id = a.mission_id and a.status <> 'conclusa' and a.route is not null;
update mission_assignments a set completes_at = greatest(now(), coalesce((a.route->-2->>'t')::timestamptz, a.completes_at))
 where a.status <> 'conclusa' and a.route is not null;
