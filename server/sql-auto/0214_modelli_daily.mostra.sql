\pset pager off
select 'M', name, image_url, maxi, aib, is_active from vehicle_models where name ilike '%daily%' or coalesce(maxi,false) or image_url ilike '%maxi%' order by name;
