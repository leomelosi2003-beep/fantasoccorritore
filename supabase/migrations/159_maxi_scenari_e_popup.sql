-- 159: descrizione/scenario della maxi-emergenza (varia a ogni maxi) + aggiorna quella attiva.

-- scenario casuale (titolo breve + descrizione)
create or replace function public.maxi_scenario()
returns table(t text, d text) language sql stable set search_path to 'public' as $fn$
  select v.t, v.d from (values
    ('Deragliamento di un treno', 'Un treno regionale è deragliato: decine di passeggeri feriti e persone ancora nei vagoni.'),
    ('Crollo di una palazzina', 'Una palazzina è crollata: feriti sotto le macerie e persone da estrarre.'),
    ('Esplosione in una fabbrica', 'Esplosione in uno stabilimento industriale: ustionati e intossicati, scenario critico.'),
    ('Maxi tamponamento in autostrada', 'Maxi tamponamento nella nebbia: decine di veicoli coinvolti e molti feriti.'),
    ('Incendio in un centro commerciale', 'Vasto incendio in un centro commerciale: folla da evacuare e intossicati dal fumo.'),
    ('Cedimento durante un concerto', 'Una struttura ha ceduto durante un concerto: calca e numerosi feriti.'),
    ('Fuga di gas in un quartiere', 'Fuga di gas con esplosione in zona residenziale: feriti e intossicati su più palazzi.'),
    ('Alluvione lampo', 'Alluvione improvvisa: persone intrappolate dall''acqua e feriti su più fronti.'),
    ('Scontro tra due autobus', 'Scontro frontale tra due autobus di linea: moltissimi passeggeri feriti.'),
    ('Scossa di terremoto', 'Una forte scossa ha lesionato diversi edifici: feriti sparsi in tutta la zona.')
  ) v(t, d) order by random() limit 1;
$fn$;

-- generatore: ora sceglie uno scenario e lo mette in titolo + descrizione
create or replace function public.spawn_maxi_emergency(p_hours int default 3)
returns uuid language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare bl geography; bname text; zname text; zloc geography; mid uuid; sc_t text; sc_d text;
begin
  select b.location, b.name into bl, bname from bases b
   order by (select count(distinct b2.org_id) from bases b2 where st_dwithin(b2.location, b.location, 25000)) desc, random()
   limit 1;
  if bl is null then return null; end if;
  select s.name, s.location into zname, zloc from (
    select comune as name, location from mission_spots where st_dwithin(location, bl, 15000)
    union all select comune, location from mission_spots_toscana where st_dwithin(location, bl, 15000)
    union all select comune, location from mission_spots_trentino where st_dwithin(location, bl, 15000)
    union all select city, location from italy_spots where st_dwithin(location, bl, 15000)
  ) s order by random() limit 1;
  if not found then zname := bname; zloc := bl; end if;
  select t, d into sc_t, sc_d from maxi_scenario();

  insert into missions (category, code, title, description, venue, location, slots_total, required_roles,
                        min_certification, duration_minutes, base_fatigue, reward_funds, reward_reputation,
                        requires, opens_at, expires_at, source, event_ends_at)
  values ('grande_evento', 'rosso', '🆘 MAXI-EMERGENZA: ' || sc_t || ' — ' || zname,
          sc_d || ' Servono quante più ambulanze possibile: più mezzi mandi, più guadagni (fino a 3× a mezzo). Dura circa ' || p_hours || ' ore.',
          'MAXI', zloc, 999, '{"autista":1,"soccorritore_base":1}'::jsonb,
          'base', p_hours * 60, 8, 12000, 8, '{}',
          now(), now() + make_interval(hours => p_hours), 'scheduler', now() + make_interval(hours => p_hours))
  returning id into mid;
  return mid;
end $fn$;

-- aggiorna la maxi ATTIVA ora (prima aveva un testo generico)
update missions m
set title = '🆘 MAXI-EMERGENZA: ' || s.t || ' — ' || nullif(split_part(m.title, ' — ', 2), ''),
    description = s.d || ' Servono quante più ambulanze possibile: più mezzi mandi, più guadagni (fino a 3× a mezzo). Dura circa 3 ore.'
from maxi_scenario() s
where m.category = 'grande_evento' and m.event_id is null and m.event_ends_at > now();
