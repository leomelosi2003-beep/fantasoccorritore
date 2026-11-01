-- Più servizi: tetto (12 + 3 × sedi) × andamento orario, fino a (2 + sedi/2) nuovi ogni 2 minuti; notte meno vuota.
do $do$
declare src text;
begin
  src := pg_get_functiondef('generate_missions()'::regprocedure);
  src := replace(src, 'mult := case when h < 6 then 0.35 when h < 8 then 0.6 when h < 11 then 1.0 when h < 13 then 1.3
               when h < 15 then 0.8 when h < 17 then 1.0 when h < 20 then 1.4 when h < 22 then 0.8 else 0.5 end;',
    'mult := case when h < 6 then 0.6 when h < 8 then 0.8 when h < 11 then 1.0 when h < 13 then 1.3
               when h < 15 then 0.9 when h < 17 then 1.0 when h < 20 then 1.4 when h < 22 then 0.9 else 0.7 end;');
  src := replace(src, 'cap := round((6 + 2 * nb) * mult);', 'cap := round((12 + 3 * nb) * mult);');
  src := replace(src, 'to_create := least(greatest(1, round((1 + nb / 3.0) * mult))::int, cap - open_count);',
                      'to_create := least(greatest(2, round((2 + nb / 2.0) * mult))::int, cap - open_count);');
  execute src;
end $do$;
