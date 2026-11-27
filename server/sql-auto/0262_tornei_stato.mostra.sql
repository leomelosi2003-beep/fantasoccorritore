\pset pager off
select id, left(title, 45), status, division, starts_at at time zone 'Europe/Rome' inizio, rounds, current_round, size,
       (select count(*) from tournament_entries e where e.tournament_id = t.id) iscritti,
       (select count(*) from tournament_matches m where m.tournament_id = t.id) incontri,
       (select count(*) from tournament_matches m where m.tournament_id = t.id and not m.done) aperti,
       (select max(ends_at) at time zone 'Europe/Rome' from tournament_matches m where m.tournament_id = t.id) ultimo_fine
  from tournaments t order by starts_at desc, division limit 12;
select 'board', jsonb_array_length(tournament_board());
