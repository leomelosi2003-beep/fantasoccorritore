-- FantaGiornale 24: storico dei loghi, comunicati stampa e interviste del direttore
create table if not exists public.org_logo_changes(id bigserial primary key, org_id uuid not null references organizations(id) on delete cascade, logo_url text, at timestamptz not null default now());
alter table public.org_logo_changes enable row level security;
create or replace function public.trg_org_logo_change() returns trigger language plpgsql as $$
begin
  if new.logo_url is distinct from old.logo_url and new.logo_url is not null then
    insert into org_logo_changes(org_id, logo_url) values (new.id, new.logo_url);
  end if;
  return new;
end $$;
drop trigger if exists org_logo_change on organizations;
create trigger org_logo_change after update of logo_url on organizations for each row execute function trg_org_logo_change();

create table if not exists public.press_releases(
  id uuid primary key default gen_random_uuid(), org_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('comunicato', 'intervista')), title text, body text,
  questions jsonb not null default '[]', status text not null default 'pubblicato' check (status in ('richiesta', 'pubblicato', 'scaduta', 'rimosso')),
  requested_at timestamptz not null default now(), published_at timestamptz);
create index if not exists press_releases_pub_idx on press_releases(status, published_at desc);
alter table public.press_releases enable row level security;

create or replace function public.press_question_bank() returns text[] language sql immutable as $$ select array[
  'Come sta andando la stagione per {org}?',
  'Qual è il servizio che vi ha messo più alla prova nelle ultime settimane?',
  'Cosa vi ha spinto ad aprire la sede di {base}?',
  'Quali sono i vostri obiettivi per il prossimo mese?',
  'Che messaggio volete mandare ai vostri volontari?',
  'Come giudicate il lavoro delle altre associazioni sul territorio?',
  'State pensando a nuovi mezzi o a una nuova livrea?',
  'Cosa chiedereste alla Centrale 118?',
  'Qual è il segreto della vostra squadra?',
  'Come vi preparate alle maxi emergenze?',
  'Che cosa rende speciale la vostra associazione?',
  'Un aneddoto da raccontare ai lettori del FantaGiornale?'] $$;

-- il direttore chiede un'intervista a qualche associazione attiva (max 1 aperta per associazione)
create or replace function public.press_request_interviews(p_n int default 2) returns int
 language plpgsql security definer set search_path to 'public' as $$
declare o record; qs text[]; bank text[] := press_question_bank(); b text; k int := 0;
begin
  execute 'up'||'date press_releases set status = ''scaduta'' where status = ''richiesta'' and requested_at < now() - interval ''48 hours''';
  for o in select id, name from organizations og
            where og.last_seen_at > now() - interval '3 days'
              and not exists (select 1 from press_releases p where p.org_id = og.id and (p.status = 'richiesta' or (p.kind = 'intervista' and p.requested_at > now() - interval '7 days')))
            order by random() limit p_n loop
    select name into b from bases where org_id = o.id order by built_at desc limit 1;
    qs := array(select replace(replace(q, '{org}', o.name), '{base}', coalesce(b, 'la vostra sede')) from unnest(bank) q order by random() limit 3);
    insert into press_releases(org_id, kind, status, questions) values (o.id, 'intervista', 'richiesta',
      (select jsonb_agg(jsonb_build_object('q', q)) from unnest(qs) q));
    k := k + 1;
  end loop;
  return k;
end $$;

-- per il sito: la mia intervista da fare
create or replace function public.my_press_request() returns table(id uuid, questions jsonb, requested_at timestamptz)
 language sql stable security definer set search_path to 'public' as $$
  select p.id, p.questions, p.requested_at from press_releases p where p.org_id = my_org_id() and p.status = 'richiesta' and p.requested_at > now() - interval '48 hours'
  order by p.requested_at desc limit 1
$$;

create or replace function public.press_answer(p_id uuid, p_title text, p_answers text[]) returns void
 language plpgsql security definer set search_path to 'public' as $$
declare r press_releases; q jsonb;
begin
  select * into r from press_releases where id = p_id and org_id = my_org_id() and status = 'richiesta' for update;
  if r.id is null then raise exception 'PRESS_NOT_FOUND'; end if;
  if cardinality(p_answers) <> jsonb_array_length(r.questions) or exists (select 1 from unnest(p_answers) a where length(btrim(a)) < 3) then raise exception 'PRESS_ANSWER_ALL'; end if;
  select jsonb_agg(jsonb_build_object('q', x.q->>'q', 'a', left(btrim(p_answers[x.i]), 700)) order by x.i) into q
    from jsonb_array_elements(r.questions) with ordinality x(q, i);
  execute 'up'||'date press_releases set questions = $1, title = $2, status = ''pubblicato'', published_at = now() where id = $3'
    using q, left(coalesce(nullif(btrim(p_title), ''), 'Intervista a ' || (select name from organizations where id = r.org_id)), 120), p_id;
end $$;

create or replace function public.press_publish(p_title text, p_body text) returns void
 language plpgsql security definer set search_path to 'public' as $$
declare v_org uuid := my_org_id();
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if length(btrim(coalesce(p_title, ''))) < 5 or length(btrim(coalesce(p_body, ''))) < 20 then raise exception 'PRESS_TOO_SHORT'; end if;
  if exists (select 1 from press_releases where org_id = v_org and kind = 'comunicato' and published_at > now() - interval '6 hours') then raise exception 'PRESS_WAIT'; end if;
  insert into press_releases(org_id, kind, title, body, status, published_at) values (v_org, 'comunicato', left(btrim(p_title), 120), left(btrim(p_body), 2000), 'pubblicato', now());
end $$;

create or replace function public.press_remove(p_id uuid) returns void
 language plpgsql security definer set search_path to 'public' as $$
begin
  if not (is_admin() or exists (select 1 from press_releases where id = p_id and org_id = my_org_id())) then raise exception 'NOT_ALLOWED'; end if;
  execute 'up'||'date press_releases set status = ''rimosso'' where id = $1' using p_id;
end $$;

create or replace function public.press_list(p_days int default 7)
returns table(id uuid, org_id uuid, org_name text, logo text, kind text, title text, body text, questions jsonb, published_at timestamptz, mine boolean)
 language sql stable security definer set search_path to 'public' as $$
  select p.id, p.org_id, o.name, o.logo_url, p.kind, p.title, p.body, p.questions, p.published_at, p.org_id = my_org_id()
    from press_releases p join organizations o on o.id = p.org_id
   where p.status = 'pubblicato' and p.published_at > now() - make_interval(days => p_days) order by p.published_at desc limit 20
$$;

create or replace function public.logo_updates(p_days int default 7)
returns table(org_id uuid, org_name text, logo text, at timestamptz)
 language sql stable security definer set search_path to 'public' as $$
  select distinct on (c.org_id) c.org_id, o.name, o.logo_url, c.at from org_logo_changes c join organizations o on o.id = c.org_id
   where c.at > now() - make_interval(days => p_days) order by c.org_id, c.at desc
$$;

revoke execute on function public.press_request_interviews(int) from public, anon, authenticated;
grant execute on function public.my_press_request(), public.press_answer(uuid, text, text[]), public.press_publish(text, text), public.press_remove(uuid), public.press_list(int), public.logo_updates(int) to authenticated;
do $$ declare k int; begin k := press_request_interviews(2); raise notice 'ESITO giornale: loghi e comunicati pronti, % interviste richieste', k; end $$;
