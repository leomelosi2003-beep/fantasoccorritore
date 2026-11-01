-- Nomi delle ambulanze unici tra tutti i giocatori (senza distinzione maiuscole/spazi) + rinomina
update vehicles v set call_sign = v.call_sign || ' B'
 where v.id in (select id from (select id, row_number() over (partition by lower(regexp_replace(trim(call_sign), '\s+', ' ', 'g')) order by created_at) rn from vehicles) x where rn > 1);
create unique index if not exists vehicles_call_sign_unique on vehicles (lower(regexp_replace(trim(call_sign), '\s+', ' ', 'g')));

create or replace function rename_vehicle(p_vehicle uuid, p_name text) returns vehicles
language plpgsql security definer set search_path = public as $$
declare v vehicles; n text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if char_length(n) not between 2 and 20 then raise exception 'BAD_CALL_SIGN'; end if;
  if exists (select 1 from vehicles where id <> p_vehicle
             and lower(regexp_replace(trim(call_sign), '\s+', ' ', 'g')) = lower(n)) then
    raise exception 'CALL_SIGN_TAKEN'; end if;
  update vehicles set call_sign = n where id = p_vehicle and org_id = my_org_id() returning * into v;
  if v.id is null then raise exception 'NOT_FOUND'; end if;
  return v;
end $$;
grant execute on function rename_vehicle(uuid, text) to authenticated;

create or replace function call_sign_free(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from vehicles where lower(regexp_replace(trim(call_sign), '\s+', ' ', 'g'))
                                                = lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'))) $$;
grant execute on function call_sign_free(text) to authenticated;
