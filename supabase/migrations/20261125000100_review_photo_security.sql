begin;

-- The private review-photos bucket is provisioned separately. This migration
-- adds policies and attachment coordination without changing bucket settings.
create function public.is_review_photo_key(object_key text, rating_id text)
returns boolean
language sql immutable strict set search_path = '' as $$
  select split_part(object_key, '/', 1) = rating_id
     and object_key ~ '^[1-9][0-9]{0,18}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png)$';
$$;
revoke all on function public.is_review_photo_key(text,text) from public, anon, authenticated;
grant execute on function public.is_review_photo_key(text,text) to authenticated;

-- Permanent retirement records prevent reuse of a key even if Storage
-- authorizes and finishes deletion in different transactions.
create table public.review_photo_keys (
  object_key text primary key,
  owner_id uuid not null,
  rating_id bigint references public.ratings(id) on delete set null,
  retired boolean not null default false,
  verified_version text,
  cleanup_after timestamptz,
  check (not retired or rating_id is null)
);
create index review_photo_keys_rating_idx on public.review_photo_keys(rating_id)
where rating_id is not null;
alter table public.review_photo_keys enable row level security;
revoke all on public.review_photo_keys from public, anon, authenticated, service_role;

create function public.review_photo_is_retired(target_key text)
returns boolean
language sql stable strict security definer set search_path = '' as $$
  select exists (
    select 1 from public.review_photo_keys k
    where k.object_key = target_key and k.owner_id = auth.uid() and k.retired
  );
$$;
revoke all on function public.review_photo_is_retired(text) from public, anon, authenticated;
grant execute on function public.review_photo_is_retired(text) to authenticated;

-- Detach the photo (or delete the rating), call this RPC, commit, then call
-- Storage remove(). Repeated retirement is safe, including after removal.
create function public.retire_review_photo(target_key text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or not public.aoun_active('member') then
    raise exception 'Active member required' using errcode = '42501';
  end if;
  if not coalesce(public.is_review_photo_key(target_key, split_part(target_key, '/', 1)), false) then
    raise exception 'Invalid review photo key' using errcode = '23514';
  end if;
  if public.review_photo_is_retired(target_key) then
    return;
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'review-photos' and o.name = target_key and o.owner_id = caller::text
  ) then
    raise exception 'Review photo is unavailable or not owned by the reviewer' using errcode = '42501';
  end if;

  -- Guard references that may have existed before this migration. All new
  -- attachments and retirements write the same registry row below.
  if exists (
    select 1 from public.ratings r
    where target_key = any (r.photo_paths)
  ) then
    raise exception 'Detach the review photo before retiring it' using errcode = '23514';
  end if;
  insert into public.review_photo_keys as k (object_key, owner_id, retired)
  values (target_key, caller, true)
  on conflict (object_key) do update set retired = true
  where k.owner_id = excluded.owner_id and k.rating_id is null;
  if not found then
    raise exception 'Review photo is attached or unavailable' using errcode = '23514';
  end if;
end;
$$;
revoke all on function public.retire_review_photo(text) from public, anon, authenticated;
grant execute on function public.retire_review_photo(text) to authenticated;

-- Only the backend may record verification after checking the stored bytes.
create function public.record_review_photo_verification(
  target_key text, target_rating bigint, reviewer uuid, object_version text
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_review_photo_key(target_key, target_rating::text), false)
    or coalesce(length(object_version), 0) not between 1 and 80
    or not exists (
      select 1 from public.ratings r join public.profiles p on p.id = r.user_id
      where r.id = target_rating and p.id = reviewer
        and p.role = 'member' and p.status = 'active'
    )
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'review-photos' and o.name = target_key
        and o.owner_id = reviewer::text and o.version::text = object_version
    ) then
    raise exception 'Review photo verification target is unavailable' using errcode = '23514';
  end if;
  insert into public.review_photo_keys as k (object_key, owner_id, verified_version)
  values (target_key, reviewer, object_version)
  on conflict (object_key) do update set verified_version = excluded.verified_version
  where not k.retired and k.owner_id = excluded.owner_id
    and (k.rating_id is null or k.verified_version = excluded.verified_version);
  if not found then
    raise exception 'Review photo cannot be verified' using errcode = '23514';
  end if;
end;
$$;
revoke all on function public.record_review_photo_verification(text,bigint,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_review_photo_verification(text,bigint,uuid,text) to service_role;

-- Discover orphaned objects even when the client never received an upload
-- response. A lease gives failed deletes a durable retry and lets other keys
-- make progress. Storage removal occurs only after the retirement commits.
create function public.claim_review_photo_cleanup(batch_size integer default 10)
returns setof text
language plpgsql security definer set search_path = '' as $$
declare
  candidate record;
begin
  for candidate in
    select eligible.* from (
      select o.name, o.owner_id
      from storage.objects o
      left join public.review_photo_keys k on k.object_key = o.name
      where o.bucket_id = 'review-photos'
        and o.owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_review_photo_key(o.name, split_part(o.name, '/', 1))
        and k.rating_id is null
        and (k.retired or o.created_at < now() - interval '24 hours')
        and (k.cleanup_after is null or k.cleanup_after <= now())
        and not exists (select 1 from public.ratings r where o.name = any (r.photo_paths))
      order by o.created_at, o.name
      limit least(50, greatest(1, coalesce(batch_size, 10)))
    ) eligible
    order by eligible.name collate "C"
  loop
    insert into public.review_photo_keys as k (object_key, owner_id, retired, cleanup_after)
    values (candidate.name, candidate.owner_id::uuid, true, now() + interval '15 minutes')
    on conflict (object_key) do update set retired = true, cleanup_after = excluded.cleanup_after
    where k.owner_id = excluded.owner_id and k.rating_id is null
      and (k.cleanup_after is null or k.cleanup_after <= now());
    if found then return next candidate.name; end if;
  end loop;
end;
$$;
revoke all on function public.claim_review_photo_cleanup(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_review_photo_cleanup(integer) to service_role;

-- Restrictive policies also constrain any existing permissive policies that
-- happen to match this bucket. Other buckets keep their current policy behavior.
create policy review_photo_no_guest_access on storage.objects
as restrictive for all to anon
using (bucket_id <> 'review-photos')
with check (bucket_id <> 'review-photos');

create policy review_photo_insert_scope on storage.objects
as restrictive for insert to authenticated
with check (
  bucket_id <> 'review-photos' or (
    storage.allow_any_operation(array['storage.object.upload'])
    and owner_id = (select auth.uid()::text)
    and (select public.aoun_active('member'))
    and not public.review_photo_is_retired(storage.objects.name)
    and exists (
      select 1 from public.ratings r
      where r.user_id = (select auth.uid())
        and public.is_review_photo_key(storage.objects.name, r.id::text)
    )
  )
);

create policy review_photo_select_scope on storage.objects
as restrictive for select to authenticated
using (
  bucket_id <> 'review-photos' or (
    owner_id = (select auth.uid()::text)
    and (select public.aoun_active('member'))
    and storage.allow_any_operation(array[
      'storage.object.get_authenticated', 'object.get_authenticated_info',
      'object.head_authenticated_info',
      'storage.object.upload', 'storage.object.delete', 'storage.object.delete_many'
    ])
  )
);

create policy review_photo_delete_scope on storage.objects
as restrictive for delete to authenticated
using (
  bucket_id <> 'review-photos' or (
    owner_id = (select auth.uid()::text)
    and (select public.aoun_active('member'))
    and storage.allow_any_operation(array['storage.object.delete', 'storage.object.delete_many'])
    and public.review_photo_is_retired(storage.objects.name)
  )
);

create policy review_photo_no_update on storage.objects
as restrictive for update to authenticated
using (bucket_id <> 'review-photos')
with check (bucket_id <> 'review-photos');

create policy review_photo_member_insert on storage.objects
for insert to authenticated with check (bucket_id = 'review-photos');

create policy review_photo_member_select on storage.objects
for select to authenticated using (bucket_id = 'review-photos');

create policy review_photo_member_delete on storage.objects
for delete to authenticated using (bucket_id = 'review-photos');

-- Inspect Storage metadata even though normal members cannot query it outside
-- approved Storage operations. The definer function is callable only as a trigger.
create function public.check_review_photo_attachments()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  photo_key text;
  previous_paths text[] := '{}';
  legacy_budget text[] := '{}';
  legacy_index integer;
  storage_paths text[] := '{}';
begin
  if tg_op = 'UPDATE' then
    if new.photo_paths is not distinct from old.photo_paths then
      return new;
    end if;
    previous_paths := old.photo_paths;
    legacy_budget := previous_paths;
  end if;

  if new.photo_paths is null or coalesce(array_ndims(new.photo_paths), 1) <> 1 then
    raise exception 'Invalid review photo list' using errcode = '23514';
  end if;

  foreach photo_key in array new.photo_paths loop
    if photo_key is null then
      raise exception 'Invalid review photo reference' using errcode = '23514';
    end if;

    if photo_key ~* '^https?://' then
      legacy_index := array_position(legacy_budget, photo_key);
      if legacy_index is null then
        raise exception 'Unexpected legacy review photo reference' using errcode = '23514';
      end if;
      legacy_budget[legacy_index] := null;
      continue;
    end if;
    if not public.is_review_photo_key(photo_key, new.id::text)
       or photo_key = any (storage_paths)
       or cardinality(storage_paths) >= 3 then
      raise exception 'Invalid review photo reference' using errcode = '23514';
    end if;

    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'review-photos'
        and o.name = photo_key
        and o.owner_id = new.user_id::text
        and o.metadata->>'mimetype' =
          case when right(photo_key, 4) = '.jpg' then 'image/jpeg' else 'image/png' end
    ) then
      raise exception 'Review photo is unavailable or not owned by the reviewer'
        using errcode = '23514';
    end if;

    storage_paths := array_append(storage_paths, photo_key);
  end loop;
  -- Write the registry rows in deterministic order. Conflict updates lock and
  -- recheck the current row at READ COMMITTED. At higher isolation a
  -- concurrent change can fail with 40001; retry the whole transaction.
  for photo_key in
    select keys.key from (
      select unnest(storage_paths) as key
      union
      select unnest(previous_paths)
    ) keys
    where public.is_review_photo_key(keys.key, new.id::text)
    order by keys.key collate "C"
  loop
    if photo_key = any (storage_paths) then
      update public.review_photo_keys k set rating_id = new.id
      where k.object_key = photo_key and not k.retired and k.owner_id = new.user_id
        and (k.rating_id is null or k.rating_id = new.id)
        and exists (
          select 1 from storage.objects o
          where o.bucket_id = 'review-photos' and o.name = photo_key
            and o.owner_id = new.user_id::text and o.version::text = k.verified_version
        );
      if not found then
        raise exception 'Review photo is not verified or is unavailable' using errcode = '23514';
      end if;
    else
      update public.review_photo_keys k set rating_id = null
      where k.object_key = photo_key and k.rating_id = new.id;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.check_review_photo_attachments() from public, anon, authenticated;

create trigger review_photo_attachment_guard
after insert or update of photo_paths on public.ratings
for each row execute function public.check_review_photo_attachments();

commit;
