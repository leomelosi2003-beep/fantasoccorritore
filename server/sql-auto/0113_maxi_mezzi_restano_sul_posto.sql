-- Maxi: i mezzi restano sul posto finché la maxi non finisce davvero.
-- Bug: con l'aereo la fine della sosta veniva letta dal penultimo punto del percorso (che ora è lo sbarco del volo di ritorno),
-- e il prolungamento della maxi spostava solo l'orario di fine, non il percorso: sulla mappa i mezzi ripartivano.
set search_path = public, extensions;

-- fine della sosta sul posto = ultimo punto "Sul posto" del percorso
create or replace function public.fs_stay_end(r jsonb) returns timestamptz language sql immutable as $$
  select (x->>'t')::timestamptz from jsonb_array_elements(r) with ordinality q(x, i) where x->>'label' = 'Sul posto' order by i desc limit 1
$$;

-- sposta in avanti la fine della sosta e tutto il viaggio di ritorno (aereo compreso)
create or replace function public.fs_extend_stay(r jsonb, p_until timestamptz) returns jsonb language plpgsql immutable as $$
declare k int; d interval; out jsonb := '[]'::jsonb; x jsonb; i int;
begin
  select max(i) into k from jsonb_array_elements(r) with ordinality q(x, i) where x->>'label' = 'Sul posto';
  if k is null then return r; end if;
  d := p_until - (r->(k - 1)->>'t')::timestamptz;
  if d <= interval '0' then return r; end if;
  for x, i in select q.x, q.i from jsonb_array_elements(r) with ordinality q(x, i) order by q.i loop
    if i >= k then x := jsonb_set(x, '{t}', to_jsonb((x->>'t')::timestamptz + d)); end if;
    out := out || jsonb_build_array(x);
  end loop;
  return out;
end $$;

-- 1) mezzi già sul posto o in viaggio verso questa maxi: restano fino alla fine della maxi
do $d$
declare a record; nr jsonb; k int := 0;
begin
  for a in
    select ma.id, ma.route, mi.event_ends_at from mission_assignments ma join missions mi on mi.id = ma.mission_id
     where mi.category = 'grande_evento' and mi.event_id is null and coalesce(mi.venue, '') not in ('AIB', 'PC')
       and mi.status in ('aperta', 'completa', 'in_corso') and ma.status in ('in_viaggio', 'sul_posto')
       and fs_stay_end(ma.route) is not null
  loop
    nr := fs_extend_stay(a.route, greatest(a.event_ends_at, now() + interval '1 minute'));
    execute 'up'||'date mission_assignments set route = $1, completes_at = fs_stay_end($1) where id = $2' using nr, a.id;
    k := k + 1;
  end loop;
  raise notice 'ESITO mezzi rimessi sul posto: %', k;
end $d$;

-- 2) prolungamento della maxi: sposta anche il percorso (sosta e rientro)
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.maxi_patients_tick()'::regprocedure), E'\r\n', E'\n');
  if position('fs_extend_stay' in src) > 0 then return; end if;
  n := replace(src,
    $$execute 'up'||'date mission_assignments set completes_at = $1 where mission_id = $2 and status not in (''annullata'', ''conclusa'') and completes_at < $1'
        using new_end, m.id;$$,
    $$execute 'up'||'date mission_assignments set route = fs_extend_stay(route, $1), completes_at = greatest(completes_at, $1) where mission_id = $2 and status not in (''annullata'', ''conclusa'') and completes_at < $1'
        using new_end, m.id;$$);
  if n = src then raise exception 'patch maxi_patients_tick non applicata'; end if;
  execute n;
end $d$;

-- 3) claim: con l'aereo la fine della sosta è l'ultimo "Sul posto", non il penultimo punto
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  if position('fs_stay_end' in src) > 0 then return; end if;
  n := regexp_replace(src, $re$v_free := \(v_route->-2->>'t'\)::timestamptz$re$,
        $rp$v_free := case when v_route::text like '%C-130%' then coalesce(fs_stay_end(v_route), (v_route->-2->>'t')::timestamptz) else (v_route->-2->>'t')::timestamptz end$rp$, 'g');
  if n = src then
    raise notice 'ESITO claim: riga v_free non trovata, righe: %', (select string_agg(l, ' || ') from regexp_split_to_table(src, E'\n') l where l ~ 'v_free :=');
  else
    execute n;
    raise notice 'ESITO claim corretto';
  end if;
end $d$;
select 'ESITO stato', to_char(completes_at at time zone 'Europe/Rome', 'HH24:MI'), count(*) from mission_assignments
 where mission_id = 'a9ff6676-2c16-4047-8c9b-c5bc11f7623b' and status in ('in_viaggio', 'sul_posto') group by 2;
