\pset pager off
select 'VB', pg_get_functiondef('vehicle_borrower'::regproc);
select 'MO', pg_get_functiondef('my_org_id'::regproc);
select 'N', count(*) from vehicles;
