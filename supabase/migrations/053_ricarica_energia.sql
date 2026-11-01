-- Ricarica energia a pagamento: 100 € per ogni servizio fatto dall'ultimo riposo, 1.500 € se è a riposo.
create or replace function refill_cost(c card_inventory) returns int language sql stable as $$
  select case
    when c.state = 'in_servizio' or c.state = 'scaduta' then 0
    when c.training_until is not null and c.training_until > now() then 0
    when c.state = 'riposo' and c.rest_until > now() then 1500
    else c.services_since_rest * 100 end $$;

create or replace function refill_energy(p_cards uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); total int; n int;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select coalesce(sum(refill_cost(ci)), 0), count(*) filter (where refill_cost(ci) > 0) into total, n
    from card_inventory ci where ci.id = any(p_cards) and ci.org_id = v_org and card_borrower(ci.id) is null;
  if n = 0 then raise exception 'NOTHING_TO_REFILL'; end if;
  perform 1 from organizations where id = v_org for update;
  update organizations set funds = funds - total where id = v_org and funds >= total;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  update card_inventory ci
     set services_since_rest = 0, energy = 100, energy_updated_at = now(),
         state = case when ci.state = 'riposo' then 'attiva'::card_state else ci.state end,
         rest_until = null
   where ci.id = any(p_cards) and ci.org_id = v_org and card_borrower(ci.id) is null and refill_cost(ci) > 0;
  return jsonb_build_object('volontari', n, 'costo', total);
end $$;
grant execute on function refill_energy(uuid[]) to authenticated;
-- my_cards: aggiunta la colonna refill_cost (vedi SQL applicato)
