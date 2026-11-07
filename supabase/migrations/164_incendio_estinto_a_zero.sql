-- 164: quando l'intensità arriva a 0 l'incendio si estingue subito (missione chiusa, mezzi liberati).
create or replace function public.spread_wildfires()
returns void language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare f record; n int; needed int; new_int numeric;
begin
  for f in select w.*, m.event_ends_at from wildfires w join missions m on m.id = w.mission_id
           where m.status in ('aperta','completa','in_corso') and m.event_ends_at > now() loop
    select count(*) into n from mission_assignments a
      join vehicles v on v.id = a.vehicle_id join vehicle_models vm on vm.id = v.model_id
     where a.mission_id = f.mission_id and vm.aib and a.status in ('in_viaggio','sul_posto');
    needed := f.severity + 1;
    if n >= needed then new_int := greatest(0, f.intensity - (n - needed + 1) * 6);
    else new_int := least(100, f.intensity + (needed - n) * 4); end if;
    update wildfires set intensity = new_int, updated_at = now() where mission_id = f.mission_id;

    if new_int <= 0 then
      -- incendio domato: si estingue subito, la missione chiude e i mezzi rientrano/si liberano
      update missions set status = 'conclusa', event_ends_at = now(), expires_at = now() where id = f.mission_id;
      update mission_assignments set completes_at = now()
       where mission_id = f.mission_id and status in ('in_viaggio','sul_posto');
      continue;
    end if;

    -- fuori controllo: l'incendio dura di più (max +90 min dalla fine prevista)
    if new_int >= 100 and f.event_ends_at < now() + interval '30 minutes' then
      update missions set event_ends_at = event_ends_at + interval '20 minutes',
                          expires_at = expires_at + interval '20 minutes'
       where id = f.mission_id and event_ends_at < now() + interval '110 minutes';
    end if;
  end loop;
end $fn$;
