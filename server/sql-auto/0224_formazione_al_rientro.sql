-- Corso di formazione anche per chi è in servizio: si paga subito, il corso parte appena il volontario rientra in sede
alter table public.card_inventory add column if not exists training_queued volunteer_role;

do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('training_class'::regproc), E'\r\n', E'\n');
  if position('training_queued' in src) > 0 then raise notice 'ESITO già fatto'; return; end if;
  new_src := replace(src, $a$and ci.state not in ('in_servizio', 'scaduta') and card_borrower(ci.id) is null) <> n then$a$,
                          $a$and ci.state <> 'scaduta' and ci.training_queued is null and card_borrower(ci.id) is null) <> n then$a$);
  new_src := replace(new_src, $a$   where id = any(p_cards);
  return n;$a$, $a$   where id = any(p_cards) and state <> 'in_servizio';
  -- chi è in servizio: corso prenotato, parte al rientro
  update card_inventory set training_queued = p_target where id = any(p_cards) and state = 'in_servizio';
  return n;$a$);
  if new_src = src or position('training_queued = p_target' in new_src) = 0 or position($a$ci.state <> 'scaduta' and ci.training_queued is null$a$ in new_src) = 0 then
    raise exception 'ESITO patch non applicata'; end if;
  execute new_src;
end $$;

create or replace function public.trg_card_training_queue() returns trigger language plpgsql as $$
begin
  if new.training_queued is not null and new.state is distinct from 'in_servizio' and old.state = 'in_servizio' then
    new.role_override := new.training_queued;
    if new.training_queued = 'autista' then new.guida_override := 55; end if;
    new.training_until := now() + interval '1 hour';
    new.state := 'riposo';
    new.rest_until := greatest(coalesce(new.rest_until, now()), now() + interval '1 hour');
    new.training_queued := null;
  end if;
  return new;
end $$;
drop trigger if exists card_training_queue on card_inventory;
create trigger card_training_queue before update of state on card_inventory for each row execute function trg_card_training_queue();

create or replace function public.my_training_queue() returns table(card_id uuid, target volunteer_role)
 language sql stable security definer set search_path to 'public' as $$
  select id, training_queued from card_inventory where org_id = my_org_id() and training_queued is not null
$$;
grant execute on function public.my_training_queue() to authenticated;
do $$ begin raise notice 'ESITO formazione al rientro attiva'; end $$;
