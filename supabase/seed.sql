-- Development fixtures only. These facility statuses are fictional.
insert into public.categories values (1,'مركز تسوق','Mall'),(2,'مقهى','Cafe') on conflict do nothing;
insert into public.places(id,name_ar,name_en,category_id) values
(1,'الرياض بارك','Riyadh Park',1),(2,'مقهى تجريبي','Demo Cafe',2) on conflict do nothing;
select setval(pg_get_serial_sequence('public.places','id'), (select max(id) from public.places));
insert into public.place_facilities
select 1,id,(case when id<=7 then 'available' else 'unavailable' end)::public.facility_status
from public.facilities on conflict do nothing;
insert into public.place_facilities values (2,1,'available') on conflict do nothing;
