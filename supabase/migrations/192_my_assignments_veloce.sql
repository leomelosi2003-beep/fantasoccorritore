-- 192: la vista my_assignments (mezzi sulla mappa, ricaricata ogni 8-25 secondi da ogni giocatore)
-- leggeva TUTTE le assegnazioni dell'associazione (150.000+ per le piu' grandi) decodificando ogni percorso.
-- Servono solo quelle in corso o appena finite: si guardano solo gli ultimi 2 giorni (un servizio, anche
-- un incendio o una maxi-emergenza, non dura cosi' tanto) con un indice dedicato. Stesse righe di prima.
create index if not exists mission_assignments_org_assigned_idx on public.mission_assignments (org_id, assigned_at desc);

do $$
declare def text; opts text;
begin
  def := pg_get_viewdef('public.my_assignments'::regclass);
  if position('2 days' in def) > 0 then return; end if;
  if position('WHERE ((a.org_id = my_org_id()) AND (' in def) = 0 then raise exception 'my_assignments: WHERE non trovato'; end if;
  def := replace(def, 'WHERE ((a.org_id = my_org_id()) AND (', 'WHERE ((a.org_id = my_org_id()) AND (a.assigned_at > (now() - ''2 days''::interval)) AND (');
  select coalesce(array_to_string(reloptions, ', '), '') into opts from pg_class where oid = 'public.my_assignments'::regclass;
  execute 'create or replace view public.my_assignments' || case when opts <> '' then ' with (' || opts || ')' else '' end || ' as ' || def;
end $$;
