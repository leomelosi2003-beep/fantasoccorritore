-- La scena dal vivo anche per i grandi eventi veri (concerti, partite...): tipo di evento, ambulanze richieste, inizio spettacolo.
do $d$
declare src text;
begin
  src := replace(pg_get_functiondef('public.maxi_scene(uuid)'::regprocedure), E'\r\n', E'\n');
  if position('''event_kind''' in src) = 0 then
    src := replace(src, $$'venue', m.venue,$$,
      $$'venue', m.venue, 'event_id', m.event_id, 'slots', m.slots_total,
    'event_kind', (select ev.kind from events ev where ev.id = m.event_id),
    'show_at', (select coalesce(ev.show_at, ev.starts_at) from events ev where ev.id = m.event_id),$$);
    if position('''event_kind''' in src) = 0 then raise exception 'patch maxi_scene non applicata'; end if;
    execute src;
  end if;
end $d$;
notify pgrst, 'reload schema';
select 'ESITO scena eventi', position('event_kind' in pg_get_functiondef('public.maxi_scene(uuid)'::regprocedure)) > 0;
