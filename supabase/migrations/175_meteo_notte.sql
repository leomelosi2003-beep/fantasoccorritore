-- 175: Meteo e fasce orarie.
-- Il meteo cambia ogni 3 ore (uguale per tutti), con probabilita' diverse per stagione.
-- Effetti: piu' servizi col brutto tempo/caldo (moltiplica il volume in generate_missions)
--          e premio piu' alto per i servizi creati col brutto tempo e di notte (22-6).
-- Il bonus si applica alla CREAZIONE del servizio (trigger) e resta scritto in missions.bonus_tag.

alter table public.missions add column if not exists bonus_tag text;

create or replace function public.current_weather(p_at timestamptz default now())
returns jsonb language plpgsql stable set search_path = public as $$
declare
  t timestamp := p_at at time zone 'Europe/Rome';
  blk timestamp := date_trunc('day', t) + (floor(extract(hour from t) / 3) * interval '3 hours');
  mon int := extract(month from t);
  roll int := ('x' || substr(md5('meteo' || blk::text), 1, 8))::bit(32)::int;
  p int; h int := extract(hour from t);
  k text;
begin
  p := abs(roll) % 100;
  if mon in (6,7,8) then
    k := case when p < 55 then 'sereno' when p < 82 then 'caldo' when p < 94 then 'temporale' else 'pioggia' end;
  elsif mon in (12,1,2) then
    k := case when p < 40 then 'sereno' when p < 65 then 'pioggia' when p < 82 then 'nebbia' when p < 92 then 'temporale' else 'neve' end;
  elsif mon in (3,4,5) then
    k := case when p < 55 then 'sereno' when p < 80 then 'pioggia' when p < 90 then 'nebbia' else 'temporale' end;
  else
    k := case when p < 45 then 'sereno' when p < 72 then 'pioggia' when p < 87 then 'nebbia' else 'temporale' end;
  end if;
  return jsonb_build_object(
    'kind', k,
    'icon', case k when 'sereno' then case when h >= 20 or h < 6 then '🌙' else '☀️' end
                   when 'caldo' then '🥵' when 'pioggia' then '🌧️' when 'temporale' then '⛈️'
                   when 'nebbia' then '🌫️' else '🌨️' end,
    'label', case k when 'sereno' then 'Sereno' when 'caldo' then 'Ondata di caldo: più malori'
                    when 'pioggia' then 'Pioggia: più incidenti stradali' when 'temporale' then 'Temporale: molte chiamate'
                    when 'nebbia' then 'Nebbia: incidenti in aumento' else 'Neve: strade pericolose' end,
    'vol', case k when 'sereno' then 1.0 when 'caldo' then 1.15 when 'pioggia' then 1.2
                  when 'temporale' then 1.35 when 'nebbia' then 1.1 else 1.3 end,
    'reward', case k when 'sereno' then 1.0 when 'caldo' then 1.05 when 'pioggia' then 1.10
                     when 'temporale' then 1.20 when 'nebbia' then 1.10 else 1.25 end,
    'night', (h >= 22 or h < 6),
    'night_bonus', 1.20,
    'ends_at', (blk + interval '3 hours') at time zone 'Europe/Rome'
  );
end $$;
grant execute on function public.current_weather(timestamptz) to anon, authenticated;

-- Bonus sul premio dei servizi 118 e ordinari creati dal generatore
create or replace function public.missions_weather_bonus()
returns trigger language plpgsql set search_path = public as $$
declare w jsonb; f numeric := 1; tags text[] := '{}';
begin
  if new.source <> 'scheduler' or new.category not in ('emergenza_118', 'ordinario', 'mare') then return new; end if;
  w := current_weather(coalesce(new.opens_at, now()));
  if (w->>'reward')::numeric > 1 then
    f := f * (w->>'reward')::numeric;
    tags := tags || format('%s %s +%s%%', w->>'icon', initcap(w->>'kind'), round(((w->>'reward')::numeric - 1) * 100));
  end if;
  if (w->>'night')::boolean and new.category = 'emergenza_118' then
    f := f * (w->>'night_bonus')::numeric;
    tags := tags || format('🌙 Notte +%s%%', round(((w->>'night_bonus')::numeric - 1) * 100));
  end if;
  if f > 1 then
    new.reward_funds := round(new.reward_funds * f);
    new.bonus_tag := array_to_string(tags, ' · ');
  end if;
  return new;
end $$;
drop trigger if exists missions_weather on public.missions;
create trigger missions_weather before insert on public.missions
  for each row execute function public.missions_weather_bonus();

-- Volume dei servizi: il meteo moltiplica il fattore orario di generate_missions
do $$
declare src text;
begin
  src := replace(pg_get_functiondef('public.generate_missions'::regproc), E'\r\n', E'\n');
  if position('current_weather()' in src) = 0 then
    src := replace(src,
      E'when h < 20 then 1.4 when h < 22 then 0.9 else 0.7 end;',
      E'when h < 20 then 1.4 when h < 22 then 0.9 else 0.7 end;\n  mult := mult * coalesce((current_weather()->>''vol'')::numeric, 1);');
    if position('current_weather()' in src) = 0 then raise exception 'patch generate_missions non applicata'; end if;
    execute src;
  end if;
end $$;

-- La mappa mostra il bonus nel popup del servizio
do $$
declare def text;
begin
  def := pg_get_viewdef('public.missions_map'::regclass);
  if position('bonus_tag' in def) = 0 then
    def := replace(def, E'    won_by_automedica\n   FROM (', E'    won_by_automedica,\n    bonus_tag\n   FROM (');
    def := replace(def, E'AS won_by_automedica\n           FROM missions', E'AS won_by_automedica,\n            missions.bonus_tag\n           FROM missions');
    if (length(def) - length(replace(def, 'bonus_tag', ''))) / 9 <> 2 then raise exception 'patch missions_map non applicata'; end if;
    execute 'create or replace view public.missions_map with (security_invoker=false) as ' || def;
  end if;
end $$;
