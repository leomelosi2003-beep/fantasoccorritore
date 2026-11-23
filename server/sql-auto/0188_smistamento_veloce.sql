-- smistamento automatico più veloce: se un mezzo fermo in sede non trova servizi, gli altri mezzi uguali della stessa sede non li cercano di nuovo
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('auto_dispatch_org'::regproc), E'\r\n', E'\n');
  if position('failed_keys' in src) > 0 then raise notice 'ESITO già fatto'; return; end if;
  new_src := replace(src, E'  free_cnt int; v_mid uuid;', E'  failed_keys text[]; fkey text; at_base boolean;\n  free_cnt int; v_mid uuid;');
  new_src := replace(new_src, E'    for v in select * from _auto_free f0 where f0.rid = v_rid order by random() loop\n      exit when free_cnt <= o.auto_reserve or drivers <= 0;\n',
    E'    failed_keys := ''{}'';\n    for v in select * from _auto_free f0 where f0.rid = v_rid order by random() loop\n      exit when free_cnt <= o.auto_reserve or drivers <= 0;\n'
    || E'      at_base := st_dwithin(v.vpos, v.bloc, 60);\n'
    || E'      fkey := concat_ws(''|'', v.base_id, v.certification, array_to_string(v.provides, '',''), v.transfer_only, v.transport_only, v.electric, round(coalesce(v.range_left, 0) / 5));\n'
    || E'      continue when at_base and fkey = any(failed_keys);\n');
  new_src := replace(new_src, E'      continue when not got;\n', E'      if not got then\n        if at_base then failed_keys := failed_keys || fkey; end if;\n        continue;\n      end if;\n');
  if new_src = src or position('continue when at_base and fkey' in new_src) = 0 or position('failed_keys := failed_keys || fkey' in new_src) = 0 or position('failed_keys text[]' in new_src) = 0 then
    raise exception 'ESITO patch non applicata'; end if;
  execute new_src;
  raise notice 'ESITO smistamento veloce attivo';
end $$;
