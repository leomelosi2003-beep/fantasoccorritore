-- Colore dei pallini dei mezzi sulla mappa (quando si allontana lo zoom): li sceglie ogni associazione dal profilo.
alter table organizations add column if not exists dot_fill text;
alter table organizations add column if not exists dot_border text;

create or replace function public.set_dot_colors(p_fill text, p_border text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id();
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if (p_fill is not null and p_fill !~ '^#[0-9A-Fa-f]{6}$') or (p_border is not null and p_border !~ '^#[0-9A-Fa-f]{6}$') then raise exception 'BAD_COLOR'; end if;
  execute 'up'||'date organizations set dot_fill = $1, dot_border = $2 where id = $3' using p_fill, p_border, v_org;
end $$;

create or replace function public.org_dot_colors()
returns table(org_id uuid, fill text, border text) language sql stable security definer set search_path = public as $$
  select id, dot_fill, dot_border from organizations where dot_fill is not null or dot_border is not null
$$;
revoke execute on function public.set_dot_colors(text, text), public.org_dot_colors() from public, anon;
grant execute on function public.set_dot_colors(text, text), public.org_dot_colors() to authenticated;
-- il profilo mostra i colori dei pallini
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.org_profile(uuid)'::regprocedure), E'\r\n', E'\n');
  if position('dot_fill' in src) > 0 then return; end if;
  n := replace(src, $$'banner_url', o.profile_banner_url,$$, $$'banner_url', o.profile_banner_url, 'dot_fill', o.dot_fill, 'dot_border', o.dot_border,$$);
  if n = src then raise exception 'org_profile: patch non applicata'; end if;
  execute n;
end $d$;
notify pgrst, 'reload schema';
select 'ESITO pallini', count(*) from org_dot_colors();
