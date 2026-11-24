-- Isolated PostgreSQL CI only. Hosted Supabase already supplies all of these objects.
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb, email text);
create function auth.uid() returns uuid language sql stable as $$
select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth to anon,authenticated;
