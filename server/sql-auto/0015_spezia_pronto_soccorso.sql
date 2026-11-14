-- 215: l'ospedale della Spezia esistente (solo trasferimenti) diventa anche pronto soccorso
update hospitals set capabilities = array(select distinct unnest(capabilities || '{ps,cardio,trauma_maggiore,pediatria,dialisi}'::text[]))
 where name = 'Sant''Andrea (La Spezia)';
select 'ESITO spezia', name, capabilities, transfer_dest from hospitals where name ~ 'Spezia';
