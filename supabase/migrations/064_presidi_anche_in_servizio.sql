-- I presidi si possono comprare e montare anche se l'ambulanza è in servizio o in officina
do $do$
declare src text;
begin
  src := pg_get_functiondef('install_equipment(uuid,text)'::regprocedure);
  src := replace(src, '  if v.status <> ''disponibile'' then raise exception ''VEHICLE_BUSY''; end if;',
                      '  -- si può montare anche mentre è in servizio (vale dal prossimo servizio)
  if v.status = ''fuori_servizio'' then raise exception ''VEHICLE_BUSY''; end if;');
  execute src;
end $do$;
