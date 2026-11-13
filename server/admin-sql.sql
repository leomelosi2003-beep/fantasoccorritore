-- Accesso SQL per l'amministratore del gioco (usato da Claude dal browser, con la sessione dell'admin).
create or replace function public.admin_sql(p_sql text, p_select boolean default true)
returns jsonb language plpgsql security definer set search_path = public, extensions as $f$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_select then
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', p_sql) into r;
    return r;
  end if;
  execute p_sql;
  return jsonb_build_object('ok', true);
end $f$;
revoke all on function public.admin_sql(text, boolean) from public, anon;
grant execute on function public.admin_sql(text, boolean) to authenticated;
notify pgrst, 'reload schema';
