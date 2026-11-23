-- impostazioni del database (valgono per le nuove connessioni: motore, sito)
alter database postgres set jit = off;
alter database postgres set effective_cache_size = '3GB';
alter database postgres set random_page_cost = 1.1;
alter database postgres set work_mem = '16MB';
do $$ begin raise notice 'ESITO impostazioni database applicate'; end $$;
