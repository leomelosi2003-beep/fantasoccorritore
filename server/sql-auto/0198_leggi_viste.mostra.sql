\pset pager off
select 'V', c, pg_get_viewdef(c::regclass, true) from unnest(array['my_cards','missions_map','bases_map']) c;
