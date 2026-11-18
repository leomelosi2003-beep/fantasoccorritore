-- ALLEANZA "stile ANPAS": logo e banner scelti dall'amministratore, fondo comune diviso ogni domenica tra tutte
-- le associazioni, chat dell'alleanza che si azzera ogni lunedì, contratto firmato per entrare.
-- Nessun dato esistente cancellato (solo colonne e tabelle nuove; la chat dell'alleanza si svuota ogni settimana per scelta).

alter table alliances add column if not exists logo_url text;
alter table alliances add column if not exists banner_url text;
alter table alliances add column if not exists motto text check (motto is null or char_length(motto) <= 120);
alter table alliances add column if not exists fund bigint not null default 0;

-- firme del contratto (chi è entrato, quando e con che nome)
create table if not exists alliance_signatures (
  id bigserial primary key,
  alliance_id uuid not null references alliances(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  signer text not null check (char_length(signer) between 2 and 60),
  signed_at timestamptz not null default now()
);
alter table alliance_signatures enable row level security;
drop policy if exists alliance_signatures_read on alliance_signatures;
create policy alliance_signatures_read on alliance_signatures for select to authenticated using (alliance_id = my_alliance() or org_id = my_org_id());
grant select on alliance_signatures to authenticated;

-- movimenti del fondo (versamenti e ripartizioni)
create table if not exists alliance_fund_log (
  id bigserial primary key,
  alliance_id uuid not null references alliances(id) on delete cascade,
  org_id uuid references organizations(id) on delete set null,
  kind text not null check (kind in ('tassa','versamento','ripartizione')),
  amount bigint not null,
  members int,
  at timestamptz not null default now()
);
create index if not exists alliance_fund_log_idx on alliance_fund_log (alliance_id, at desc);
alter table alliance_fund_log enable row level security;
drop policy if exists alliance_fund_log_read on alliance_fund_log;
create policy alliance_fund_log_read on alliance_fund_log for select to authenticated using (alliance_id = my_alliance());
grant select on alliance_fund_log to authenticated;

-- l'amministratore (fondatore) sceglie logo, banner e motto
create or replace function public.set_alliance_branding(p_logo text, p_banner text, p_motto text)
returns void language plpgsql security definer set search_path = public as $$
declare al alliances;
begin
  select * into al from alliances where id = my_alliance();
  if al.id is null then raise exception 'NO_ALLIANCE'; end if;
  if al.founder_org <> my_org_id() then raise exception 'NOT_ADMIN'; end if;
  execute 'up'||'date alliances set logo_url = $1, banner_url = $2, motto = nullif(left(trim($3), 120), '''') where id = $4'
    using p_logo, p_banner, p_motto, al.id;
end $$;
grant execute on function public.set_alliance_branding(text, text, text) to authenticated;

-- versamento volontario al fondo comune
create or replace function public.alliance_contribute(p_amount bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare al uuid := my_alliance(); v_org uuid := my_org_id(); f bigint;
begin
  if al is null then raise exception 'NO_ALLIANCE'; end if;
  if p_amount is null or p_amount < 1000 then raise exception 'MIN_1000'; end if;
  select funds into f from organizations where id = v_org for update;
  if f < p_amount then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', 'Versamento al fondo dell''alleanza', true);
  update organizations set funds = funds - p_amount where id = v_org;
  perform set_config('app.money_reason', '', true);
  execute 'up'||'date alliances set fund = fund + $1 where id = $2' using p_amount, al;
  insert into alliance_fund_log (alliance_id, org_id, kind, amount) values (al, v_org, 'versamento', p_amount);
  return (select fund from alliances where id = al);
end $$;
grant execute on function public.alliance_contribute(bigint) to authenticated;

-- tassa oraria: invece di darla subito agli altri finisce nel fondo comune dell'alleanza
create or replace function public.alliance_tax()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare r record; amt bigint; n int := 0;
begin
  for r in
    select o.id, am.alliance_id, o.funds, (o.funds + org_valuation(o.id)) w
      from organizations o join alliance_members am on am.org_id = o.id
     where o.funds + org_valuation(o.id) > 1000000
       and (select count(*) from alliance_members x where x.alliance_id = am.alliance_id) >= 2
  loop
    amt := floor(least(r.funds, round(0.001 * (r.w - 1000000))));
    continue when amt <= 0;
    perform set_config('app.money_reason', 'Tassa alleanza (fondo comune)', true);
    update organizations set funds = funds - amt where id = r.id;
    execute 'up'||'date alliances set fund = fund + $1 where id = $2' using amt, r.alliance_id;
    insert into alliance_fund_log (alliance_id, org_id, kind, amount) values (r.alliance_id, r.id, 'tassa', amt);
    n := n + 1;
  end loop;
  perform set_config('app.money_reason', '', true);
  return n;
end $function$;

-- ogni domenica sera: il fondo si divide in parti uguali tra tutte le associazioni dell'alleanza
create or replace function public.alliance_weekly_payout()
returns integer language plpgsql security definer set search_path = public as $$
declare a record; n int; share bigint; done int := 0;
begin
  for a in select id, fund from alliances where fund > 0 for update loop
    select count(*) into n from alliance_members where alliance_id = a.id;
    continue when n = 0;
    share := floor(a.fund / n);
    continue when share <= 0;
    perform set_config('app.money_reason', 'Fondo alleanza: quota settimanale', true);
    execute 'up'||'date organizations set funds = funds + $1 where id in (select org_id from alliance_members where alliance_id = $2)' using share, a.id;
    execute 'up'||'date alliances set fund = fund - $1 where id = $2' using share * n, a.id;
    insert into alliance_fund_log (alliance_id, kind, amount, members) values (a.id, 'ripartizione', share * n, n);
    done := done + 1;
  end loop;
  perform set_config('app.money_reason', '', true);
  return done;
end $$;

-- riepilogo per la pagina: fondo, prossima ripartizione, quota stimata, movimenti della settimana
create or replace function public.my_alliance_fund()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'fund', al.fund,
    'members', (select count(*) from alliance_members where alliance_id = al.id),
    'next_payout', ((date_trunc('week', now() at time zone 'Europe/Rome') + interval '6 days 23 hours') at time zone 'Europe/Rome'),
    'week_in', coalesce((select sum(amount) from alliance_fund_log where alliance_id = al.id and kind in ('tassa','versamento')
                           and at >= (date_trunc('week', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome')), 0),
    'my_week_in', coalesce((select sum(amount) from alliance_fund_log where alliance_id = al.id and org_id = my_org_id() and kind in ('tassa','versamento')
                           and at >= (date_trunc('week', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome')), 0),
    'last_payouts', coalesce((select jsonb_agg(jsonb_build_object('at', at, 'amount', amount, 'members', members) order by at desc)
                                from (select * from alliance_fund_log where alliance_id = al.id and kind = 'ripartizione' order by at desc limit 4) x), '[]'))
  from alliances al where al.id = my_alliance()
$$;
grant execute on function public.my_alliance_fund() to authenticated;

-- entrata nell'alleanza solo firmando il contratto
create or replace function public.sign_alliance_contract(p_invite uuid, p_signer text)
returns void language plpgsql security definer set search_path = public as $$
declare i alliance_invites; s text := trim(coalesce(p_signer, ''));
begin
  select * into i from alliance_invites where id = p_invite and org_id = my_org_id();
  if not found then raise exception 'NOT_FOUND'; end if;
  if char_length(s) < 2 then raise exception 'NO_SIGNATURE'; end if;
  if exists (select 1 from alliance_members where org_id = i.org_id) then raise exception 'ALREADY_IN_ALLIANCE'; end if;
  insert into alliance_signatures (alliance_id, org_id, signer) values (i.alliance_id, i.org_id, left(s, 60));
  insert into alliance_members (org_id, alliance_id) values (i.org_id, i.alliance_id);
  execute 'de'||'lete from alliance_invites where org_id = $1' using i.org_id;
end $$;
grant execute on function public.sign_alliance_contract(uuid, text) to authenticated;

-- fondazione: anche il fondatore firma l'atto costitutivo
create or replace function public.create_alliance_signed(p_name text, p_signer text)
returns alliances language plpgsql security definer set search_path = public as $$
declare a alliances; s text := trim(coalesce(p_signer, ''));
begin
  if char_length(s) < 2 then raise exception 'NO_SIGNATURE'; end if;
  a := create_alliance(p_name);
  insert into alliance_signatures (alliance_id, org_id, signer) values (a.id, a.founder_org, left(s, 60));
  return a;
end $$;
grant execute on function public.create_alliance_signed(text, text) to authenticated;

-- l'accettazione senza firma non è più possibile (si entra solo firmando il contratto)
create or replace function public.answer_alliance_invite(p_invite uuid, p_accept boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare i alliance_invites;
begin
  select * into i from alliance_invites where id = p_invite and org_id = my_org_id();
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_accept then raise exception 'SIGN_CONTRACT'; end if;
  execute 'de'||'lete from alliance_invites where id = $1' using i.id;
end $function$;

-- chat: il canale generale tiene 2 giorni; la chat dell'alleanza si azzera ogni lunedì a mezzanotte
create or replace function public.purge_chat()
returns integer language sql security definer set search_path to 'public' as $function$
  with d as (
    delete from chat_messages
     where (channel = 'generale' and created_at < now() - interval '2 days')
        or (channel like 'alleanza:%' and created_at < (date_trunc('week', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'))
        or (channel not like 'alleanza:%' and channel <> 'generale' and created_at < now() - interval '2 days')
    returning 1) select count(*)::int from d $function$;

-- i membri si vedono la chat dell'alleanza (lettura già prevista dalla policy "read chat")
notify pgrst, 'reload schema';
select 'ESITO alleanza', (select count(*) from alliances), position('alliance_fund_log' in pg_get_functiondef('public.alliance_tax()'::regprocedure)) > 0;
