-- Isolated PostgreSQL CI only, after auth-fixture.sql. Real Supabase supplies
-- the Storage tables, roles and operation context through its Storage API.
create schema storage;
create role service_role bypassrls;
create table storage.objects (
  bucket_id text not null,
  name text not null,
  owner_id text,
  metadata jsonb,
  version text default 'fixture-version',
  created_at timestamptz not null default now(),
  primary key (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;

create function storage.allow_any_operation(operations text[])
returns boolean language sql stable as $$
  select coalesce(
    regexp_replace(current_setting('storage.test_operation', true), '^storage[.]', '') in (
      select regexp_replace(op, '^storage[.]', '') from unnest(operations) as allowed(op)
    ),
    false
  );
$$;

-- The concurrency runner refuses databases without this CI-only marker.
create function storage.aoun_review_photo_ci_fixture()
returns boolean language sql immutable as $$ select true; $$;
