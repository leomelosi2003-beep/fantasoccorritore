-- Postgres era con le impostazioni minime (128 MB di cache su una macchina da 6 GB)
alter system set jit = off;                          -- il compilatore JIT rallenta le funzioni lunghe del motore
alter system set effective_cache_size = '3GB';
alter system set random_page_cost = 1.1;             -- disco SSD
alter system set work_mem = '16MB';
alter system set shared_buffers = '1GB';             -- vale dal prossimo riavvio del database
select pg_reload_conf();
do $$ begin raise notice 'ESITO impostazioni applicate'; end $$;
