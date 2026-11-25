-- Run only on the disposable PostgreSQL CI database with review-storage-fixture.sql.
-- These are metadata fixtures. Use the Storage API for real Supabase integration tests.
begin;

insert into auth.users(id,raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000101','{"display_name":"Reviewer A"}'),
  ('00000000-0000-4000-8000-000000000102','{"display_name":"Reviewer B"}'),
  ('00000000-0000-4000-8000-000000000103','{"display_name":"Suspended"}');
update public.profiles set status = 'suspended'
where id = '00000000-0000-4000-8000-000000000103';

insert into public.ratings(id,user_id,place_id,score) overriding system value values
  (9101,'00000000-0000-4000-8000-000000000101',1,4),
  (9102,'00000000-0000-4000-8000-000000000102',1,3),
  (9103,'00000000-0000-4000-8000-000000000103',1,5);

-- Simulate an existing legacy review and a mislabeled/cross-owner Storage row.
-- The privileged historical fixture is required because new links are now checked.
alter table public.ratings disable trigger review_photo_attachment_guard;
update public.ratings set photo_paths = array['https://example.invalid/legacy.jpg']
where id = 9101;
alter table public.ratings enable trigger review_photo_attachment_guard;
insert into storage.objects(bucket_id,name,owner_id,metadata) values
  ('review-photos','9101/00000000-0000-4000-8000-000000000010.jpg',
    '00000000-0000-4000-8000-000000000102','{"mimetype":"image/jpeg"}'),
  ('review-photos','9101/00000000-0000-4000-8000-000000000011.jpg',
    '00000000-0000-4000-8000-000000000101','{"mimetype":"image/png"}'),
  ('review-photos','9103/00000000-0000-4000-8000-000000000021.png',
    '00000000-0000-4000-8000-000000000103','{"mimetype":"image/png"}'),
  ('other-bucket','9101/00000000-0000-4000-8000-000000000012.jpg',
    '00000000-0000-4000-8000-000000000101','{"mimetype":"image/jpeg"}');

-- A broad permissive policy must not allow bypasses or break existing buckets.
create policy ci_permissive_storage on storage.objects
for all to anon, authenticated using (true) with check (true);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select set_config('storage.test_operation','storage.object.upload',true);

insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'review-photos', '9101/00000000-0000-4000-8000-00000000000' || suffix || '.jpg',
       auth.uid()::text, '{"mimetype":"image/jpeg"}'::jsonb
from unnest(array['1','2','3','4']) as files(suffix)
returning name;

do $$
begin
  begin
    insert into storage.objects(bucket_id,name,owner_id)
    values ('review-photos','9102/00000000-0000-4000-8000-000000000001.jpg',auth.uid()::text);
    raise exception 'Uploaded to another rating';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects(bucket_id,name,owner_id)
    values ('review-photos','9101/nested/00000000-0000-4000-8000-000000000003.jpg',auth.uid()::text);
    raise exception 'Uploaded with a malformed key';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects(bucket_id,name,owner_id)
    values ('review-photos','9101/00000000-0000-4000-8000-000000000009.jpg',
      '00000000-0000-4000-8000-000000000102');
    raise exception 'Spoofed the object owner';
  exception when insufficient_privilege then null;
  end;
end;
$$;

update public.ratings set score = 5 where id = 9101;
do $$
declare
  bad_paths text[];
  invalid_key text;
begin
  if (select photo_paths from public.ratings where id = 9101)
      is distinct from array['https://example.invalid/legacy.jpg'] then
    raise exception 'Text-only edit lost the legacy reference';
  end if;

  foreach invalid_key in array array[
    'https://example.invalid/new.jpg',
    '9101/00000000-0000-4000-8000-000000000010.jpg', -- Wrong object owner.
    '9101/00000000-0000-4000-8000-000000000011.jpg', -- Wrong MIME metadata.
    '9101/00000000-0000-4000-8000-000000000012.jpg', -- Wrong bucket.
    '9101/00000000-0000-4000-8000-000000000099.jpg', -- Missing object.
    '9102/00000000-0000-4000-8000-000000000001.jpg'
  ] loop
    begin
      update public.ratings set photo_paths = array[invalid_key] where id = 9101;
      raise exception 'Accepted invalid attachment: %', invalid_key;
    exception when check_violation then null;
    end;
  end loop;

  bad_paths := array[
    '9101/00000000-0000-4000-8000-000000000001.jpg',
    '9101/00000000-0000-4000-8000-000000000002.jpg',
    '9101/00000000-0000-4000-8000-000000000003.jpg',
    '9101/00000000-0000-4000-8000-000000000004.jpg'
  ];
  begin
    update public.ratings set photo_paths = bad_paths where id = 9101;
    raise exception 'Accepted more than three managed photos';
  exception when check_violation then null;
  end;
  begin
    update public.ratings set photo_paths = array[bad_paths[1],bad_paths[1]] where id = 9101;
    raise exception 'Accepted duplicate managed keys';
  exception when check_violation then null;
  end;
  begin
    insert into public.ratings(place_id,score,photo_paths)
    values (2,4,array['http://example.invalid/injected.jpg']);
    raise exception 'Accepted a new raw URL on insert';
  exception when check_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    update public.ratings
    set photo_paths = array['9101/00000000-0000-4000-8000-000000000001.jpg'] where id = 9101;
    raise exception 'Attached a direct upload without trusted verification';
  exception when check_violation then null;
  end;
  begin
    perform public.record_review_photo_verification(
      '9101/00000000-0000-4000-8000-000000000001.jpg', 9101, auth.uid(), 'fixture-version');
    raise exception 'Member forged the server verification';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_review_photo_cleanup(10);
    raise exception 'Member accessed privileged cleanup';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role service_role;
do $$
begin
  begin
    perform public.record_review_photo_verification(
      '9101/00000000-0000-4000-8000-000000000001.jpg', 9101,
      '00000000-0000-4000-8000-000000000101', 'wrong-version');
    raise exception 'Recorded verification for an incorrect Storage version';
  exception when check_violation then null;
  end;
end;
$$;
select public.record_review_photo_verification(
  '9101/00000000-0000-4000-8000-00000000000' || suffix || '.jpg',
  9101, '00000000-0000-4000-8000-000000000101', 'fixture-version'
)
from unnest(array['1','2']) as files(suffix);
set local role authenticated;

-- A privileged Storage replacement cannot reuse verification for the old version.
reset role;
update storage.objects set version = 'changed-version'
where name = '9101/00000000-0000-4000-8000-000000000001.jpg';
set local role authenticated;
do $$
begin
  begin
    update public.ratings
    set photo_paths = array['9101/00000000-0000-4000-8000-000000000001.jpg'] where id = 9101;
    raise exception 'Attached a new Storage version using the old verification';
  exception when check_violation then null;
  end;
  begin
    update public.ratings
    set photo_paths = array['https://example.invalid/legacy.jpg','https://example.invalid/legacy.jpg']
    where id = 9101;
    raise exception 'Duplicated a legacy reference';
  exception when check_violation then null;
  end;
end;
$$;
reset role;
update storage.objects set version = 'fixture-version'
where name = '9101/00000000-0000-4000-8000-000000000001.jpg';
set local role authenticated;

update public.ratings
set photo_paths = array[
  'https://example.invalid/legacy.jpg',
  '9101/00000000-0000-4000-8000-000000000001.jpg'
] where id = 9101;

select set_config('storage.test_operation','storage.object.get_authenticated',true);
do $$
begin
  if not exists (select 1 from storage.objects
    where bucket_id = 'review-photos' and name = '9101/00000000-0000-4000-8000-000000000002.jpg') then
    raise exception 'Owner could not read their unattached photo';
  end if;
end;
$$;
select set_config('storage.test_operation','object.head_authenticated_info',true);
do $$
begin
  if not exists (select 1 from storage.objects
    where bucket_id = 'review-photos' and name = '9101/00000000-0000-4000-8000-000000000002.jpg') then
    raise exception 'Owner could not HEAD their unattached photo';
  end if;
end;
$$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('storage.test_operation','storage.object.get_authenticated',true);
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'review-photos') then
    raise exception 'Guest read private Storage metadata';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'other-bucket') then
    raise exception 'Other bucket permissions were changed';
  end if;
  if (select photo_paths from public.place_reviews where id = 9101) is distinct from array[
    'https://example.invalid/legacy.jpg',
    '9101/00000000-0000-4000-8000-000000000001.jpg'
  ] then
    raise exception 'Published review did not expose only the attached references';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$
declare op text;
begin
  foreach op in array array['storage.object.get_authenticated','object.head_authenticated_info'] loop
    perform set_config('storage.test_operation',op,true);
    if exists (select 1 from storage.objects
      where bucket_id = 'review-photos' and name = '9101/00000000-0000-4000-8000-000000000002.jpg') then
      raise exception 'Another member accessed an unattached photo through %', op;
    end if;
  end loop;
  begin
    perform public.retire_review_photo('9101/00000000-0000-4000-8000-000000000002.jpg');
    raise exception 'Another member retired a private photo';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('storage.test_operation','storage.object.delete_many',true);
do $$
begin
  delete from storage.objects
  where bucket_id = 'review-photos' and name = '9101/00000000-0000-4000-8000-000000000002.jpg';
  if found then raise exception 'Deleted another member''s unattached photo'; end if;
end;
$$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
select set_config('storage.test_operation','storage.object.upload',true);
do $$
begin
  begin
    insert into storage.objects(bucket_id,name,owner_id)
    values ('review-photos','9103/00000000-0000-4000-8000-000000000001.jpg',auth.uid()::text);
    raise exception 'Suspended member uploaded a photo';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare op text;
begin
  foreach op in array array['storage.object.get_authenticated','object.head_authenticated_info'] loop
    perform set_config('storage.test_operation',op,true);
    if exists (select 1 from storage.objects
      where bucket_id = 'review-photos' and name = '9103/00000000-0000-4000-8000-000000000021.png') then
      raise exception 'Suspended member accessed a private photo through %', op;
    end if;
  end loop;
  begin
    perform public.retire_review_photo('9103/00000000-0000-4000-8000-000000000021.png');
    raise exception 'Suspended member retired a photo';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- A prior retirement must not let a suspended owner clean up through Storage.
reset role;
insert into public.review_photo_keys(object_key,owner_id,retired) values
  ('9103/00000000-0000-4000-8000-000000000021.png',
   '00000000-0000-4000-8000-000000000103',true);
set local role authenticated;
select set_config('storage.test_operation','storage.object.delete_many',true);
do $$
begin
  delete from storage.objects
  where bucket_id = 'review-photos' and name = '9103/00000000-0000-4000-8000-000000000021.png';
  if found then raise exception 'Suspended member deleted a retired photo'; end if;
end;
$$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$
declare op text;
begin
  foreach op in array array['storage.object.sign','storage.object.sign_many','storage.object.list'] loop
    perform set_config('storage.test_operation',op,true);
    if exists (select 1 from storage.objects where bucket_id = 'review-photos') then
      raise exception 'Unexpected owner access for %', op;
    end if;
  end loop;
end;
$$;

select set_config('storage.test_operation','storage.object.upload_signed',true);
do $$
begin
  begin
    insert into storage.objects(bucket_id,name,owner_id)
    values ('review-photos','9101/00000000-0000-4000-8000-000000000021.jpg',auth.uid()::text);
    raise exception 'Allowed a member to authorize a signed upload';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('storage.test_operation','storage.object.delete_many',true);
do $$
begin
  update storage.objects set metadata = '{"mimetype":"image/jpeg"}'
  where bucket_id = 'review-photos' and name = '9101/00000000-0000-4000-8000-000000000002.jpg';
  if found then raise exception 'Member overwrote Storage metadata'; end if;
  delete from storage.objects
  where bucket_id = 'review-photos' and name = '9101/00000000-0000-4000-8000-000000000001.jpg';
  if found then raise exception 'Deleted a still-attached photo'; end if;
  begin
    perform public.retire_review_photo('9101/00000000-0000-4000-8000-000000000001.jpg');
    raise exception 'Retired a still-attached photo';
  exception when check_violation then null;
  end;
end;
$$;

update public.ratings set photo_paths = array['https://example.invalid/legacy.jpg'] where id = 9101;
do $$
begin
  delete from storage.objects
  where bucket_id = 'review-photos' and name = '9101/00000000-0000-4000-8000-000000000001.jpg';
  if found then raise exception 'A direct delete bypassed retirement'; end if;
  perform public.retire_review_photo('9101/00000000-0000-4000-8000-000000000001.jpg');
  delete from storage.objects
  where bucket_id = 'review-photos' and name = '9101/00000000-0000-4000-8000-000000000001.jpg';
  if not found then raise exception 'Could not clean up a detached photo'; end if;
  perform public.retire_review_photo('9101/00000000-0000-4000-8000-000000000001.jpg');
  perform set_config('storage.test_operation','storage.object.upload',true);
  begin
    insert into storage.objects(bucket_id,name,owner_id)
    values ('review-photos','9101/00000000-0000-4000-8000-000000000001.jpg',auth.uid()::text);
    raise exception 'Reused a retired key';
  exception when insufficient_privilege then null;
  end;
  perform set_config('storage.test_operation','storage.object.delete_many',true);

  update public.ratings
  set photo_paths = array['9101/00000000-0000-4000-8000-000000000002.jpg']
  where id = 9101;
  delete from public.ratings where id = 9101;
  if not found then raise exception 'Could not delete the owned rating'; end if;
  perform public.retire_review_photo('9101/00000000-0000-4000-8000-000000000002.jpg');
  delete from storage.objects
  where bucket_id = 'review-photos' and name = '9101/00000000-0000-4000-8000-000000000002.jpg';
  if not found then raise exception 'Could not clean up after rating deletion'; end if;
end;
$$;

-- Exercise durable recovery without any surviving client state, and make sure
-- expired leases can be retried. Storage rows here are CI metadata only.
reset role;
delete from storage.objects where name = '9103/00000000-0000-4000-8000-000000000021.png';
insert into public.ratings(id,user_id,place_id,score) overriding system value values
  (9104,'00000000-0000-4000-8000-000000000101',2,4),
  (9105,'00000000-0000-4000-8000-000000000102',2,4);
insert into storage.objects(bucket_id,name,owner_id,metadata,created_at) values
  ('review-photos','9104/00000000-0000-4000-8000-000000000031.jpg',
    '00000000-0000-4000-8000-000000000101','{"mimetype":"image/jpeg"}',now()-interval '25 hours'),
  ('review-photos','9104/00000000-0000-4000-8000-000000000032.jpg',
    '00000000-0000-4000-8000-000000000101','{"mimetype":"image/jpeg"}',now()),
  ('review-photos','9104/00000000-0000-4000-8000-000000000033.jpg',
    '00000000-0000-4000-8000-000000000101','{"mimetype":"image/jpeg"}',now()-interval '25 hours'),
  ('review-photos','9105/00000000-0000-4000-8000-000000000034.jpg',
    '00000000-0000-4000-8000-000000000102','{"mimetype":"image/jpeg"}',now()-interval '25 hours');
set local role service_role;
select public.record_review_photo_verification(
  '9104/00000000-0000-4000-8000-000000000033.jpg',9104,
  '00000000-0000-4000-8000-000000000101','fixture-version');
select public.record_review_photo_verification(
  '9105/00000000-0000-4000-8000-000000000034.jpg',9105,
  '00000000-0000-4000-8000-000000000102','fixture-version');
reset role;
update public.ratings set photo_paths = array['9104/00000000-0000-4000-8000-000000000033.jpg'] where id = 9104;
update public.ratings set photo_paths = array['9105/00000000-0000-4000-8000-000000000034.jpg'] where id = 9105;
-- The existing admin path deletes the rating row. A place deletion cascades it.
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000103';
update public.profiles set status = 'active' where id = '00000000-0000-4000-8000-000000000103';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
delete from public.ratings where id = 9105;

set local role service_role;
do $$
declare claimed text[];
begin
  select array_agg(key order by key) into claimed from public.claim_review_photo_cleanup(50) as keys(key);
  if claimed is distinct from array[
    '9104/00000000-0000-4000-8000-000000000031.jpg',
    '9105/00000000-0000-4000-8000-000000000034.jpg'
  ] then raise exception 'Unexpected cleanup batch: %', claimed; end if;
  if exists (select 1 from public.claim_review_photo_cleanup(50)) then
    raise exception 'An in-flight cleanup lease was claimed again';
  end if;
end;
$$;

reset role;
update public.review_photo_keys set cleanup_after = now() - interval '1 second' where retired;
delete from public.places where id = 2;
set local role service_role;
do $$
declare claimed text[];
begin
  select array_agg(key order by key) into claimed from public.claim_review_photo_cleanup(50) as keys(key);
  if claimed is distinct from array[
    '9104/00000000-0000-4000-8000-000000000031.jpg',
    '9104/00000000-0000-4000-8000-000000000033.jpg',
    '9105/00000000-0000-4000-8000-000000000034.jpg'
  ] then raise exception 'Failed to recover an expired claim or cascade: %', claimed; end if;
end;
$$;

rollback;
