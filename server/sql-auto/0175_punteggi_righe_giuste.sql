-- ordine giusto delle colonne nella pagina della Lega: data ora | squadra 1 | squadra 2 | punteggio | palazzetto
do $$
declare src text; new_src text;
begin
  src := pg_get_functiondef('scores_tick'::regproc);
  new_src := replace(src, '''\|(\d{1,3}) - (\d{1,3})\|([^|]+)\|(\d{2}/\d{2}/\d{4})[ |]*(\d{2}:\d{2})?\|([^|]+)\|([^|]+)(?=\|)''',
                          '''\|()()()(\d{2}/\d{2}/\d{4})[ |]*(\d{2}:\d{2})?\|([^|]+)\|([^|]+)\|(\d{1,3}) - (\d{1,3})(?=\|)''');
  new_src := replace(new_src, '(m[1]::int + m[2]::int) = 0', '(m[8]::int + m[9]::int) = 0');
  new_src := replace(new_src, 'values (e.id, btrim(m[6]), btrim(m[7]), m[1]::int, m[2]::int)', 'values (e.id, btrim(m[6]), btrim(m[7]), m[8]::int, m[9]::int)');
  if new_src = src or position('m[8]::int, m[9]::int)' in new_src) = 0 or position('(m[8]::int + m[9]::int) = 0' in new_src) = 0 then raise exception 'ESITO patch non applicata'; end if;
  execute new_src;
  -- 0-0 a partita iniziata = la Lega non ha ancora il risultato: non lo mostro
  new_src := replace(pg_get_functiondef('scores_tick'::regproc), 'if (m[8]::int + m[9]::int) = 0 and now() < e.show_at then continue; end if;', 'if (m[8]::int + m[9]::int) = 0 then continue; end if;');
  execute new_src;
  execute 'de'||'lete from event_scores';
  raise notice 'ESITO colonne corrette, punteggi sbagliati tolti';
end $$;
