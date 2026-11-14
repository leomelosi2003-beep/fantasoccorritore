-- 228: gli incendi (grande_evento con venue AIB) non devono bloccare né far ripartire il conto della maxi
create or replace function public.spawn_maxi_if_due() returns void
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare last_at timestamptz; gap interval;
begin
  if exists (select 1 from missions where category='grande_evento' and event_id is null and coalesce(venue, '') <> 'AIB'
             and (status in ('aperta','completa','in_corso') or event_ends_at > now())) then return; end if;
  select max(created_at) into last_at from missions where category='grande_evento' and event_id is null and coalesce(venue, '') <> 'AIB';
  gap := make_interval(days => 7) + make_interval(hours => floor(random()*24)::int); -- 7..8 giorni
  if last_at is null or now() - last_at >= gap then
    perform spawn_maxi_emergency(3);
  end if;
end $function$;
select 'ESITO maxi: incendi esclusi', (select max(created_at) from missions where category='grande_evento' and event_id is null and venue = 'AIB') ultimo_incendio;
