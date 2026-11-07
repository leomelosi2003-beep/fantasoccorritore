-- 158: Maxi-emergenze.
-- Una maxi è un 'grande_evento' con event_id NULL (gli eventi veri hanno sempre event_id): riusa la logica
-- degli eventi (tanti mezzi, finestra lunga con event_ends_at) senza toccare l'enum.
-- - richiede quante più ambulanze possibile (slots 999, equipaggio minimo autista+soccorritore)
-- - più mezzi manda un'associazione, più guadagna per mezzo (fino a x3)
-- - ne parte una ogni 7/8 giorni (cron giornaliero che controlla) + icona speciale lato web

-- 1) genera una maxi vicino alla sede da cui è raggiungibile dal maggior numero di associazioni
create or replace function public.spawn_maxi_emergency(p_hours int default 3)
returns uuid language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare bl geography; bname text; zname text; zloc geography; mid uuid;
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

  insert into missions (category, code, title, description, venue, location, slots_total, required_roles,
                        min_certification, duration_minutes, base_fatigue, reward_funds, reward_reputation,
                        requires, opens_at, expires_at, source, event_ends_at)
  values ('grande_evento', 'rosso', '🆘 MAXI-EMERGENZA — ' || zname,
          'Maxi-emergenza: servono quante più ambulanze possibile. Più mezzi mandi, più guadagni (fino a 3× a mezzo). Dura circa ' || p_hours || ' ore.',
          'MAXI', zloc, 999, '{"autista":1,"soccorritore_base":1}'::jsonb,
          'base', p_hours * 60, 8, 12000, 8, '{}',
          now(), now() + make_interval(hours => p_hours), 'scheduler', now() + make_interval(hours => p_hours))
  returning id into mid;
  return mid;
end $fn$;

-- 2) scheduler: una maxi ogni 7/8 giorni, mai due in contemporanea
create or replace function public.spawn_maxi_if_due()
returns void language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare last_at timestamptz; gap interval;
begin
  if exists (select 1 from missions where category='grande_evento' and event_id is null
             and (status in ('aperta','completa','in_corso') or event_ends_at > now())) then return; end if;
  select max(created_at) into last_at from missions where category='grande_evento' and event_id is null;
  gap := make_interval(days => 7) + make_interval(hours => floor(random()*24)::int); -- 7..8 giorni
  if last_at is null or now() - last_at >= gap then
    perform spawn_maxi_emergency(3);
  end if;
end $fn$;

-- 3) ricompensa: nelle maxi più mezzi manda l'associazione, più guadagna per mezzo (fino a x3)
do $$
declare src text; src2 text;
begin
  src := replace(pg_get_functiondef('public.complete_due_assignments'::regproc), E'\r\n', E'\n');
  src2 := replace(src,
    'reward := round(reward * (1 + clinical_bonus(a.id, m.title, m.code::text)));',
    'reward := round(reward * (1 + clinical_bonus(a.id, m.title, m.code::text)));'||E'\n'||
    '    if m.category = ''grande_evento'' and m.event_id is null then'||E'\n'||
    '      reward := round(reward * least(3.0, 1 + 0.2 * ((select count(*) from mission_assignments x'||E'\n'||
    '                      where x.mission_id = m.id and x.org_id = a.org_id and x.status <> ''annullata'') - 1)));'||E'\n'||
    '    end if;');
  if src2 = src then raise exception 'complete_due_assignments: patch non applicata'; end if;
  execute src2;
end $$;

-- 4) cron giornaliero (09:00 UTC) che controlla se è ora di una nuova maxi
select cron.schedule('maxi-emergency', '0 9 * * *', 'select public.spawn_maxi_if_due()');

-- 5) mandane una SUBITO, 3 ore
select public.spawn_maxi_emergency(3) as maxi_id;
