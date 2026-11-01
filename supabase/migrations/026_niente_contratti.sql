-- NIENTE PIÙ CONTRATTI: i volontari restano per sempre, conta solo la stanchezza.
select cron.unschedule(jobname) from cron.job where jobname = 'expire-cards';

-- Le carte scadute tornano attive (se il giocatore non ha già un'altra copia attiva dello stesso volontario)
update card_inventory ci set state = 'attiva', expires_at = null
 where ci.state = 'scaduta'
   and not exists (select 1 from card_inventory x where x.org_id = ci.org_id and x.volunteer_id = ci.volunteer_id
                   and x.state <> 'scaduta' and x.id <> ci.id)
   and ci.id = (select y.id from card_inventory y where y.org_id = ci.org_id and y.volunteer_id = ci.volunteer_id
                order by y.acquired_at desc limit 1);
update card_inventory set expires_at = null where expires_at is not null;

-- I pacchetti non danno più una scadenza
do $do$
declare src text;
begin
  src := pg_get_functiondef('open_weekly_pack()'::regprocedure);
  src := replace(src, 'now() + make_interval(days => days))', 'null)');
  execute src;
end $do$;

select (select count(*) from card_inventory where state = 'scaduta') ancora_scadute,
       (select count(*) from card_inventory where expires_at is not null) con_scadenza,
       position('make_interval(days' in pg_get_functiondef('open_weekly_pack()'::regprocedure)) = 0 as pacchetti_ok,
       not exists (select 1 from cron.job where jobname = 'expire-cards') as cron_tolto;
