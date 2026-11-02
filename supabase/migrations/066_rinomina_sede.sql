-- Il proprietario può cambiare il nome delle proprie sedi
create or replace function rename_base(p_base uuid, p_name text) returns bases
language plpgsql security definer set search_path = public as $$
declare b bases; n text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if char_length(n) not between 2 and 40 then raise exception 'BAD_NAME'; end if;
  update bases set name = n where id = p_base and org_id = my_org_id() returning * into b;
  if b.id is null then raise exception 'NOT_FOUND'; end if;
  return b;
end $$;
grant execute on function rename_base(uuid, text) to authenticated;
