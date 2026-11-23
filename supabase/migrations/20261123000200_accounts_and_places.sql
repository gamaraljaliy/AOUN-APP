-- Run once, after 20261123000100_place_discovery.sql. Existing places keep their IDs.
begin;

alter table public.places
  add column description_ar text, add column description_en text,
  add column address text, add column photo_path text,
  add column latitude double precision, add column longitude double precision,
  add constraint valid_coordinates check (
    (latitude is null) = (longitude is null)
    and latitude between -90 and 90 and longitude between -180 and 180
  );

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  preferred_language text not null default 'ar' check (preferred_language in ('ar','en')),
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'active' check (status in ('active','suspended'))
);

create function public.create_aoun_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values
    (new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'مستخدم'));
  return new;
end $$;
revoke all on function public.create_aoun_profile() from public,anon,authenticated;
create trigger aoun_user_created after insert on auth.users
for each row execute function public.create_aoun_profile();
insert into public.profiles(id,display_name)
select id,coalesce(nullif(trim(raw_user_meta_data->>'display_name'),''),'مستخدم') from auth.users
on conflict(id) do nothing;

-- Check only the caller. Roles and suspension are not taken from editable Auth metadata.
create function public.aoun_active(member_role text) returns boolean
language sql stable security definer set search_path = '' as $$
select exists(select 1 from public.profiles where id=auth.uid() and role=member_role and status='active');
$$;
revoke all on function public.aoun_active(text) from public,anon,authenticated;
grant execute on function public.aoun_active(text) to authenticated;

create table public.ratings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  place_id integer not null references public.places on delete cascade,
  score smallint not null check(score between 1 and 5),
  review_text text,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(user_id,place_id)
);
create index ratings_by_place on public.ratings(place_id);
create table public.favorites (
  user_id uuid default auth.uid() references public.profiles on delete cascade,
  place_id integer references public.places on delete cascade,
  primary key(user_id,place_id)
);
create table public.reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  place_id integer not null references public.places on delete cascade,
  issue_type text not null check(issue_type in ('incorrect','missing','outdated')),
  description text not null check(length(trim(description))>0),
  status text not null default 'submitted' check(status in ('submitted','under_review','resolved','rejected')),
  created_at timestamptz not null default now(),
  status_updated_at timestamptz not null default now()
);
create index reports_by_status on public.reports(status,created_at);

alter table public.profiles enable row level security;
alter table public.ratings enable row level security;
alter table public.favorites enable row level security;
alter table public.reports enable row level security;
revoke all on public.profiles,public.ratings,public.favorites,public.reports from public,anon,authenticated;

grant select,update(display_name,preferred_language) on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated
using (id=auth.uid() or public.aoun_active('admin'));
create policy profile_edit on public.profiles for update to authenticated
using (id=auth.uid() and status='active') with check (id=auth.uid() and status='active');

create function public.set_account_status(target_user uuid,new_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.aoun_active('admin') then raise exception 'Administrator required' using errcode='42501'; end if;
  update public.profiles set status=new_status where id=target_user and role='member';
  if not found then raise exception 'Member not found'; end if;
end $$;
revoke all on function public.set_account_status(uuid,text) from public,anon,authenticated;
grant execute on function public.set_account_status(uuid,text) to authenticated;

grant select,insert(place_id,score,review_text,photo_paths),update(score,review_text,photo_paths),delete on public.ratings to authenticated;
create policy ratings_read on public.ratings for select to authenticated using (user_id=auth.uid() or public.aoun_active('admin'));
create policy ratings_insert on public.ratings for insert to authenticated with check (user_id=auth.uid() and public.aoun_active('member'));
create policy ratings_edit on public.ratings for update to authenticated using (user_id=auth.uid() and public.aoun_active('member'));
create policy ratings_delete on public.ratings for delete to authenticated using ((user_id=auth.uid() and public.aoun_active('member')) or public.aoun_active('admin'));

-- Deliberate public projection. Keep account IDs, emails and other profile data private.
create view public.place_reviews with (security_barrier=true) as
select r.id,r.place_id,p.display_name,r.score,r.review_text,r.photo_paths,r.created_at
from public.ratings r join public.profiles p on p.id=r.user_id;
revoke all on public.place_reviews from public,anon,authenticated;
grant select on public.place_reviews to anon,authenticated;

grant select,insert(place_id),delete on public.favorites to authenticated;
create policy favorite_owner on public.favorites to authenticated
using (user_id=auth.uid() and public.aoun_active('member')) with check (user_id=auth.uid() and public.aoun_active('member'));

grant select,insert(place_id,issue_type,description),update(status) on public.reports to authenticated;
create policy report_read on public.reports for select to authenticated using (user_id=auth.uid() or public.aoun_active('admin'));
create policy report_submit on public.reports for insert to authenticated with check (user_id=auth.uid() and public.aoun_active('member'));
create policy report_manage on public.reports for update to authenticated using (public.aoun_active('admin'));
create function public.check_report_transition() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = old.status then return new; end if;
  if old.status in ('resolved','rejected') or new.status='submitted' then raise exception 'Invalid report transition'; end if;
  new.status_updated_at=clock_timestamp();
  return new;
end $$;
create trigger report_transition before update of status on public.reports
for each row execute function public.check_report_transition();

do $$
declare tbl text;
begin
  foreach tbl in array array['places','place_facilities','categories'] loop
    execute format('grant insert,update,delete on public.%I to authenticated',tbl);
    execute format('create policy admin_write on public.%I to authenticated using (public.aoun_active(''admin'')) with check (public.aoun_active(''admin''))',tbl);
  end loop;
end $$;

-- Keep the original details RPC and its existing response fields.
create or replace function public.place_details(target_id integer) returns jsonb
language sql stable security invoker set search_path = '' as $$
select to_jsonb(v) || jsonb_build_object(
  'address',p.address,'latitude',p.latitude,'longitude',p.longitude,'photo_path',p.photo_path,
  'description_ar',p.description_ar,'description_en',p.description_en,
  'facilities',(select jsonb_agg(jsonb_build_object('id',f.id,'name_ar',f.name_ar,'name_en',f.name_en,'status',s.status) order by f.id)
    from public.facilities f left join public.place_facilities s on s.facility_id=f.id and s.place_id=v.id),
  'average_rating',(select round(avg(score),2) from public.place_reviews where place_id=v.id),
  'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from public.place_reviews r where r.place_id=v.id),'[]'::jsonb))
from public.place_summary v join public.places p on p.id=v.id where v.id=target_id;
$$;

create function public.nearby_places(origin_lat double precision,origin_lon double precision)
returns table(place_id integer,name_ar text,name_en text,latitude double precision,longitude double precision,distance_km double precision)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if origin_lat is null or origin_lon is null or origin_lat not between -90 and 90 or origin_lon not between -180 and 180 then
    raise exception 'Invalid origin coordinates' using errcode='22023';
  end if;
  return query select p.id,p.name_ar,p.name_en,p.latitude,p.longitude,
    12742 * asin(sqrt(least(1.0, power(sin(radians(p.latitude-origin_lat)/2),2)
       +cos(radians(origin_lat))*cos(radians(p.latitude))*power(sin(radians(p.longitude-origin_lon)/2),2)))) as km
    from public.places p where p.latitude is not null order by km,p.id;
end $$;
revoke all on function public.nearby_places(double precision,double precision) from public,anon,authenticated;
grant execute on function public.nearby_places(double precision,double precision) to anon,authenticated;
notify pgrst,'reload schema';
commit;
