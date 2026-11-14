-- 236: partita del Livorno di oggi alle 14:30 allo Stadio Picchi (mancava nel calendario letto in automatico): evento aggiunto a mano
do $$
declare d record; v uuid; t timestamptz := make_timestamptz(2026, 11, 14, 14, 30, 0, 'Europe/Rome');
begin
  select id into v from venues where name = 'Stadio Armando Picchi';
  if v is null then raise exception 'stadio non trovato'; end if;
  select * into d from event_defaults('calcio');
  insert into events (source_key, title, kind, venue_id, show_at, starts_at, ends_at, slots, required_roles, requires, reward_funds, time_confirmed, source_url, updated_at, locked)
  values ('manuale:calcio:2026-11-14', 'Livorno – partita di campionato (Serie C)', 'calcio', v, t,
          t - make_interval(mins => d.pre), t + make_interval(mins => d.dur + d.post), d.slots, d.roles, '{defib}', d.reward, true, null, now(), true)
  on conflict (source_key) do nothing;
  perform events_to_missions();
end $$;
select 'ESITO partita', e.title, e.show_at, (select count(*) from missions m where m.event_id = e.id) servizi
  from events e where e.source_key = 'manuale:calcio:2026-11-14';
