-- Disposable test DB with seed data. Account fixtures and changes are rolled back.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000001','{"display_name":"اختبار","role":"admin"}'),
 ('00000000-0000-4000-8000-000000000002','{}'),
 ('00000000-0000-4000-8000-000000000003','{}');
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.ratings(place_id,score,review_text) values (1,4,'اختبار');
insert into public.favorites(place_id) values (1);
insert into public.reports(place_id,issue_type,description) values (1,'outdated','تغيّر المدخل');
do $$ begin
  if public.aoun_active('admin') then raise exception 'Unexpected admin'; end if;
  begin insert into public.ratings(place_id,score) values (1,4); raise exception 'Allowed duplicate'; exception when unique_violation then null; end;
  begin insert into public.ratings(place_id,score) values (2,6); raise exception 'Allowed invalid score'; exception when check_violation then null; end;
  begin update public.profiles set role='admin' where id=auth.uid(); raise exception 'Changed own role'; exception when insufficient_privilege then null; end;
  begin insert into public.reports(place_id,issue_type,description) values(1,'missing','  '); raise exception 'Empty report'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select from public.favorites) or exists(select from public.reports) then raise exception 'Private rows leaked'; end if;
  delete from public.ratings where place_id=1;
  if found then raise exception 'Removed another user rating'; end if;
end $$;
set local role anon;
do $$ declare detail jsonb:=public.place_details(1); begin
  if (detail->>'average_rating')::numeric is distinct from 4 or
     detail#>>'{reviews,0,display_name}' is distinct from 'اختبار' or
     detail#>'{reviews,0}' ?| array['user_id','email'] then raise exception 'Review projection'; end if;
  if has_table_privilege('anon','public.profiles','SELECT') then raise exception 'Profile exposure'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select public.set_account_status('00000000-0000-4000-8000-000000000001','suspended');
update public.reports set status='under_review';
do $$ begin
  begin
    update public.reports set status='rejected', admin_response='  ';
    raise exception 'Rejected report without explanation';
  exception when raise_exception then
    if sqlerrm <> 'Report response required' then raise; end if;
  end;
end $$;
update public.reports set status='resolved', admin_response='Updated place information';
do $$ begin
  if not exists(select from public.reports where status='resolved') then raise exception 'Admin report update failed'; end if;
  begin update public.reports set status='submitted'; exception when raise_exception then
    if sqlerrm='Invalid report transition' then return; end if; raise;
  end;
  raise exception 'Terminal report reopened';
end $$;
update public.places set latitude=24.7,longitude=46.7 where id=1;
do $$ begin
  if (select distance_km from public.nearby_places(24.7,46.7) where place_id=1) is distinct from 0::double precision then raise exception 'Nearby place missing'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin
  begin insert into public.ratings(place_id,score) values(2,3); raise exception 'Suspended submission'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select public.set_account_status('00000000-0000-4000-8000-000000000001','active');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
update public.ratings set score=5 where place_id=1;
delete from public.favorites where place_id=1;
do $$ begin
  if (public.place_details(1)->>'average_rating')::numeric is distinct from 5 or exists(select from public.favorites) then raise exception 'Member edit failed'; end if;
end $$;
rollback;
