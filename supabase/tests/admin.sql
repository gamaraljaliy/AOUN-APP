-- Run only in a disposable database after all migrations and seed.sql.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-9000-000000000001','member@test.invalid','{"display_name":"Member"}'),
 ('00000000-0000-4000-9000-000000000002','admin@test.invalid','{"display_name":"Admin"}');
update public.profiles set role='admin' where id='00000000-0000-4000-9000-000000000002';
set local role anon;
do $$ begin
  begin perform public.admin_accounts(); raise exception 'Guest read accounts'; exception when insufficient_privilege then null; end;
  begin perform public.admin_save_place(null,'{}','[]'); raise exception 'Guest saved place'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000001',true);
update public.profiles set display_name='Edited member',preferred_language='en' where id=auth.uid();
insert into public.ratings(place_id,score,review_text) values(1,1,'Remove this');
insert into public.reports(place_id,issue_type,description) values(1,'incorrect','Review this');
do $$ begin
  if not exists(select from public.profiles where id=auth.uid() and display_name='Edited member' and preferred_language='en') then raise exception 'Profile edit failed'; end if;
  begin perform public.admin_accounts(); raise exception 'Member read accounts'; exception when insufficient_privilege then null; end;
  begin perform public.admin_save_place(null,'{}','[]'); raise exception 'Member saved place'; exception when insufficient_privilege then null; end;
  begin perform public.set_account_status(auth.uid(),'suspended'); raise exception 'Member changed status'; exception when insufficient_privilege then null; end;
  begin update public.profiles set status='suspended' where id=auth.uid(); raise exception 'Member wrote status'; exception when insufficient_privilege then null; end;
  update public.reports set status='resolved';
  if found then raise exception 'Member resolved report'; end if;
  delete from public.places where id=1;
  if found then raise exception 'Member deleted place'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000002',true);
do $$ declare saved integer; original_name text; begin
  if not exists(select from public.admin_accounts() where email='member@test.invalid') then raise exception 'Admin email projection failed'; end if;
  saved := public.admin_save_place(null,'{"name_ar":"مكان","name_en":"Place","category_id":1,"latitude":null,"longitude":null}',
    '["available","unavailable","not_applicable",null,null,null,null,null,null]');
  if (select count(*) from public.place_facilities where place_id=saved) <> 3 then raise exception 'Facilities not saved'; end if;
  perform public.admin_save_place(saved,'{"name_ar":"معدّل","name_en":"Updated","category_id":2,"latitude":24.7,"longitude":46.7}',
    '[null,null,null,null,null,null,null,null,"available"]');
  if (select count(*) from public.place_facilities where place_id=saved) <> 1 or
     not exists(select from public.places where id=saved and category_id=2 and latitude=24.7) then raise exception 'Place update failed'; end if;
  begin
    perform public.admin_save_place(saved,'{"name_ar":"لن يحفظ","name_en":"Bad","category_id":1}',
      '["available","invalid",null,null,null,null,null,null,null]');
    raise exception 'Accepted invalid facility';
  exception when invalid_text_representation then null; end;
  if (select name_en from public.places where id=saved) <> 'Updated' or
     not exists(select from public.place_facilities where place_id=saved and facility_id=9) then raise exception 'Partial write persisted'; end if;
  begin
    perform public.admin_save_place(saved,'{"name_ar":"مكان","name_en":"Place","category_id":1,"latitude":95,"longitude":0}',
      '[null,null,null,null,null,null,null,null,null]');
    raise exception 'Accepted invalid coordinates';
  exception when check_violation then null; end;
  delete from public.places where id=saved;
  if exists(select from public.place_facilities where place_id=saved) then raise exception 'Place deletion left facilities'; end if;
  delete from public.ratings where user_id='00000000-0000-4000-9000-000000000001';
  if not found then raise exception 'Admin could not remove review'; end if;
end $$;
select public.set_account_status('00000000-0000-4000-9000-000000000001','suspended');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000001',true);
do $$ begin
  update public.profiles set display_name='Blocked' where id=auth.uid();
  if found then raise exception 'Suspended member edited profile'; end if;
  begin insert into public.reports(place_id,issue_type,description) values(1,'missing','Blocked'); raise exception 'Suspended member submitted report'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000002',true);
select public.set_account_status('00000000-0000-4000-9000-000000000001','active');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000001',true);
do $$ begin
  update public.profiles set display_name='Restored' where id=auth.uid();
  if not found then raise exception 'Reactivation failed'; end if;
end $$;
-- Revoking an admin's status must immediately deny the security-definer RPCs.
reset role;
update public.profiles set status='suspended' where id='00000000-0000-4000-9000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000002',true);
do $$ begin
  begin perform public.admin_accounts(); raise exception 'Suspended admin read accounts'; exception when insufficient_privilege then null; end;
  begin perform public.admin_save_place(null,'{}','[]'); raise exception 'Suspended admin saved place'; exception when insufficient_privilege then null; end;
end $$;
rollback;
