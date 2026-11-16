-- nomi delle compagnie di traghetti inventati (simili, ma non quelli veri)
do $$
declare m jsonb := '{
  "Toremar / Moby": "Toremare / Mobi Linee", "Toremar": "Toremare", "Moby": "Mobi Linee", "Tirrenia": "Tirrenica",
  "Toremar / Maregiglio": "Toremare / Marigiglio", "Caronte & Tourist": "Caronti dello Stretto", "Caremar / Medmar": "Caremare / Medimare",
  "Caremar": "Caremare", "Tirrenia / GNV": "Tirrenica / Grandi Navi Liguri", "GNV": "Grandi Navi Liguri", "Moby / Tirrenia": "Mobi Linee / Tirrenica"}';
  k text;
begin
  for k in select jsonb_object_keys(m) loop
    execute 'up'||'date ferry_lines set company = $1 where company = $2' using m->>k, k;
  end loop;
end $$;
select 'ESITO compagnie', company, count(*) from ferry_lines group by company order by 2;
