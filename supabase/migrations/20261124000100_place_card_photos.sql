create or replace view public.place_summary with (security_invoker = true) as
select p.id, p.name_ar, p.name_en, c.name_ar as category_ar, c.name_en as category_en,
  case when count(s.status) < 9 or count(*) filter (where s.status <> 'not_applicable') = 0 then null
       when 100 * count(*) filter (where s.status = 'available') >=
             70 * count(*) filter (where s.status <> 'not_applicable') then 'accessible'
       when count(*) filter (where s.status = 'available') > 0 then 'partially_accessible'
       else 'not_accessible' end as level, p.photo_path
from public.places p join public.categories c on c.id = p.category_id
left join public.place_facilities s on s.place_id = p.id
group by p.id, c.id;
