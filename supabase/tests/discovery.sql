-- Run after migrations and seed in a disposable development database.
begin;
do $$
declare
  fixture record;
  place_id_test integer;
  actual text;
begin
  for fixture in select * from (values
      (7,2,0,'accessible'),(6,3,0,'partially_accessible'),(0,9,0,'not_accessible'),
      (6,2,1,'accessible'),(0,0,9,null),(8,0,0,null)
  ) as cases(available,unavailable,na,expected)
  loop
    insert into public.places(name_ar,name_en,category_id) values ('اختبار','Fixture',1) returning id into place_id_test;
    insert into public.place_facilities
    select place_id_test,id,(case when id<=fixture.available then 'available'
       when id<=fixture.available+fixture.unavailable then 'unavailable' else 'not_applicable' end)::public.facility_status
    from public.facilities where id<=fixture.available+fixture.unavailable+fixture.na;
    select level into actual from public.place_summary where id=place_id_test;
    if actual is distinct from fixture.expected then raise exception 'TC-05 mismatch: %',fixture; end if;
  end loop;
end $$;
set local role anon;
do $$
begin
  if (select count(*) from public.search_places('Mall',array[1,2]) where id=1)<>1
    or exists(select from public.search_places('Demo Cafe',array[1,2]))
    or exists(select from public.search_places('missing-xyz','{}'))
    or public.place_details(999999) is not null
    or jsonb_array_length(public.place_details(2)->'facilities')<>9
    then raise exception 'Discovery contract failed'; end if;
  if has_table_privilege('anon','public.places','INSERT') then raise exception 'Unexpected guest write access'; end if;
end $$;
rollback;
