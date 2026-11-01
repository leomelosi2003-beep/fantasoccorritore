-- PACCHETTI A PAGAMENTO: comune, epico, leggendario. Più paghi, più è facile trovare epiche e leggendarie.
create or replace function pack_catalog() returns jsonb language sql stable as $$
  select '[
    {"kind":"comune",      "price":3000,  "leg":0.02, "epi":0.13, "guarantee":null},
    {"kind":"epico",       "price":12000, "leg":0.08, "epi":0.42, "guarantee":"epica"},
    {"kind":"leggendario", "price":35000, "leg":0.25, "epi":0.50, "guarantee":"leggendaria"}
  ]'::jsonb $$;

-- Quante carte di ogni rarità puoi ancora trovare (quelle che non hai già)
create or replace function pack_availability() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_object_agg(r, n) from (
    select r::text, (select count(*) from volunteers v
                      where v.rarity = r and v.is_pack_eligible
                        and v.id not in (select volunteer_id from card_inventory where org_id = my_org_id() and state <> 'scaduta')) n
      from unnest(enum_range(null::rarity)) r) x $$;

create or replace function buy_pack(p_kind text) returns setof card_inventory
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := my_org_id(); cat jsonb; price int; p_leg numeric; p_epi numeric; guarantee text;
  owned uuid[]; picked uuid[] := '{}'; i int; r numeric; rar rarity; vol volunteers; best int := 0; missing int := 0;
  hq uuid;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select x into cat from jsonb_array_elements(pack_catalog()) x where x->>'kind' = p_kind;
  if cat is null then raise exception 'BAD_PACK'; end if;
  price := (cat->>'price')::int; p_leg := (cat->>'leg')::numeric; p_epi := (cat->>'epi')::numeric; guarantee := cat->>'guarantee';

  select coalesce(array_agg(volunteer_id), '{}') into owned
    from card_inventory where org_id = v_org and state <> 'scaduta';

  -- se la carta garantita non esiste (le hai già tutte), non ti facciamo pagare
  if guarantee = 'leggendaria' and not exists (select 1 from volunteers where rarity = 'leggendaria' and is_pack_eligible and id <> all(owned)) then
    raise exception 'NO_LEGENDARY_LEFT'; end if;
  if guarantee = 'epica' and not exists (select 1 from volunteers where rarity in ('epica','leggendaria') and is_pack_eligible and id <> all(owned)) then
    raise exception 'NO_EPIC_LEFT'; end if;

  perform 1 from organizations where id = v_org for update;
  update organizations set funds = funds - price where id = v_org and funds >= price;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  select id into hq from bases where org_id = v_org and is_headquarters;

  for i in 1..5 loop
    r := random();
    rar := case when r < p_leg then 'leggendaria' when r < p_leg + p_epi then 'epica' else 'comune' end;
    -- ultima carta: garantita se non è ancora uscita
    if i = 5 and guarantee = 'leggendaria' and best < 2 then rar := 'leggendaria'; end if;
    if i = 5 and guarantee = 'epica' and best < 1 and rar = 'comune' then rar := 'epica'; end if;

    vol := null;
    select * into vol from volunteers where rarity = rar and is_pack_eligible and id <> all(owned) and id <> all(picked)
     order by random() limit 1;
    -- se di quella rarità non ce ne sono più, scende di un gradino
    if vol.id is null and rar = 'leggendaria' then
      select * into vol from volunteers where rarity = 'epica' and is_pack_eligible and id <> all(owned) and id <> all(picked)
       order by random() limit 1;
    end if;
    if vol.id is null and guarantee = 'epica' and i = 5 and best < 1 then
      select * into vol from volunteers where rarity = 'leggendaria' and is_pack_eligible and id <> all(owned) and id <> all(picked)
       order by random() limit 1;
    end if;
    if vol.id is null then
      select * into vol from volunteers where rarity = 'comune' and is_pack_eligible and id <> all(owned) and id <> all(picked)
       order by random() limit 1;
    end if;
    if vol.id is null then missing := missing + 1; continue; end if;

    picked := picked || vol.id;
    best := greatest(best, case vol.rarity when 'leggendaria' then 2 when 'epica' then 1 else 0 end);
    return query
      insert into card_inventory (org_id, volunteer_id, base_id) values (v_org, vol.id, hq) returning *;
  end loop;

  -- carte che non c'erano più: rimborso
  if missing > 0 then
    update organizations set funds = funds + (price / 5) * missing where id = v_org;
  end if;
end $$;
grant execute on function buy_pack(text), pack_availability(), pack_catalog() to authenticated;

select pack_catalog() catalogo;
