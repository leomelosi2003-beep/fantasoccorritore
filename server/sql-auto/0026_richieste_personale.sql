-- 226: richieste di personale: un'associazione a corto di volontari lo segnala a tutti, gli altri possono prestarle volontari
create table if not exists public.staff_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  roles jsonb not null default '{}',
  message text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz
);
create index if not exists staff_requests_open_idx on public.staff_requests (expires_at) where closed_at is null;
create table if not exists public.staff_request_helps (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.staff_requests(id) on delete cascade,
  from_org uuid not null references public.organizations(id) on delete cascade,
  card_id uuid not null,
  hours int not null,
  at timestamptz not null default now()
);
alter table public.staff_requests enable row level security;
alter table public.staff_request_helps enable row level security;
drop policy if exists staff_requests_read on public.staff_requests;
create policy staff_requests_read on public.staff_requests for select to authenticated using (true);
drop policy if exists staff_helps_read on public.staff_request_helps;
create policy staff_helps_read on public.staff_request_helps for select to authenticated using (true);
grant select on public.staff_requests, public.staff_request_helps to authenticated;

create or replace function public.request_staff(p_roles jsonb, p_message text default null, p_hours int default 2)
returns uuid language plpgsql security definer set search_path = public, extensions as $f$
declare v_org uuid := my_org_id(); k text; v text; tot int := 0; rid uuid;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  for k, v in select * from jsonb_each_text(coalesce(p_roles, '{}')) loop
    if k not in ('autista','soccorritore_base','soccorritore_avanzato','caposervizio','infermiere','medico','bagnino','aib') then raise exception 'BAD_ROLE'; end if;
    if v::int < 0 or v::int > 10 then raise exception 'BAD_COUNT'; end if;
    tot := tot + v::int;
  end loop;
  if tot < 1 then raise exception 'NO_ROLES'; end if;
  execute 'up' || 'date staff_requests set closed_at = now() where org_id = $1 and closed_at is null' using v_org;
  insert into staff_requests (org_id, roles, message, expires_at)
  values (v_org, (select jsonb_object_agg(key, value::int) from jsonb_each_text(p_roles) where value::int > 0),
          nullif(left(trim(coalesce(p_message, '')), 140), ''), now() + make_interval(hours => greatest(1, least(8, p_hours))))
  returning id into rid;
  return rid;
end $f$;

create or replace function public.close_staff_request()
returns void language plpgsql security definer set search_path = public, extensions as $f$
begin
  execute 'up' || 'date staff_requests set closed_at = now() where org_id = $1 and closed_at is null' using my_org_id();
end $f$;

create or replace function public.staff_requests_open()
returns table(id uuid, org_id uuid, org_name text, org_type text, logo_url text, roles jsonb, message text,
              created_at timestamptz, expires_at timestamptz, mine boolean, ally boolean, helped int, last_helper text)
language sql stable security definer set search_path = public, extensions as $f$
  select r.id, r.org_id, o.name, o.type::text, o.logo_url, r.roles, r.message, r.created_at, r.expires_at,
         r.org_id = my_org_id(), coalesce(same_alliance(r.org_id, my_org_id()), false) and r.org_id <> my_org_id(),
         (select count(*)::int from staff_request_helps h where h.request_id = r.id),
         (select oo.name from staff_request_helps h join organizations oo on oo.id = h.from_org where h.request_id = r.id order by h.at desc limit 1)
  from staff_requests r join organizations o on o.id = r.org_id
  where r.closed_at is null and r.expires_at > now()
  order by r.created_at desc
$f$;

-- presta un volontario a chi ha chiesto personale (anche se non siete alleati)
create or replace function public.help_staff_request(p_request uuid, p_card uuid, p_hours int default 2)
returns void language plpgsql security definer set search_path = public, extensions as $f$
declare v_org uuid := my_org_id(); r staff_requests; c card_inventory; h int := greatest(1, least(8, coalesce(p_hours, 2)));
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into r from staff_requests where id = p_request and closed_at is null and expires_at > now();
  if not found then raise exception 'REQUEST_CLOSED'; end if;
  if r.org_id = v_org then raise exception 'OWN_REQUEST'; end if;
  select * into c from card_inventory where id = p_card and org_id = v_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if c.state in ('in_servizio', 'scaduta') then raise exception 'CARD_BUSY'; end if;
  if card_borrower(c.id) is not null then raise exception 'ALREADY_LENT'; end if;
  insert into card_loans (card_id, from_org, to_org, ends_at) values (c.id, v_org, r.org_id, now() + make_interval(hours => h));
  insert into staff_request_helps (request_id, from_org, card_id, hours) values (r.id, v_org, c.id, h);
end $f$;

grant execute on function public.request_staff(jsonb, text, int), public.close_staff_request(), public.staff_requests_open(),
  public.help_staff_request(uuid, uuid, int) to authenticated;
notify pgrst, 'reload schema';
select 'ESITO richieste personale ok';
