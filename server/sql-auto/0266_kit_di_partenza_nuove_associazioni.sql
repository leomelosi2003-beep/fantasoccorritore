-- 0266: ogni associazione NUOVA, appena crea la sua prima sede, riceve un F-Ducalis con kit completo e un equipaggio
-- (1 autista, 1 soccorritore avanzato, 1 soccorritore base), così può fare servizio subito.
create or replace function public.starter_kit() returns trigger
language plpgsql security definer set search_path = public as $$
declare k int := 0; cs text; r text; vol uuid; owned uuid[] := '{}';
begin
  if exists (select 1 from vehicles where org_id = new.org_id) then return new; end if;
  if (select count(*) from bases where org_id = new.org_id) > 1 then return new; end if;
  begin
    loop
      k := k + 1; cs := 'Ducato ' || k;
      exit when not exists (select 1 from vehicles where call_sign = cs);
    end loop;
    perform prize_vehicle(new.org_id, 'F-Ducalis', cs);
    foreach r in array array['autista', 'soccorritore_avanzato', 'soccorritore_base'] loop
      select id into vol from volunteers where role = r::volunteer_role and rarity = 'comune' and is_pack_eligible and id <> all(owned)
       order by random() limit 1;
      if vol is not null then
        insert into card_inventory (org_id, volunteer_id, base_id) values (new.org_id, vol, new.id);
        owned := owned || vol;
      end if;
    end loop;
  exception when others then
    raise warning 'starter_kit: %', sqlerrm;   -- se qualcosa va storto la sede si crea comunque
  end;
  return new;
end $$;
drop trigger if exists bases_starter_kit on public.bases;
create trigger bases_starter_kit after insert on public.bases for each row execute function public.starter_kit();
do $$ begin raise notice 'ESITO kit di partenza attivo per le nuove associazioni'; end $$;
